import { loadCandles, Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Hedged DCA Ladder — longs with short protection
// ─────────────────────────────────────────────
// Core idea: run 2Moon's DCA ladder for longs.
// When the ladder is full AND underwater, open shorts.
// Shorts profit during drawdowns, reducing the DD valley.
// When price recovers, longs hit batch TP and shorts close.

interface Cfg {
  // Long ladder params (same as sim-2moon)
  tpPct: number;
  leverage: number;
  maxLongPositions: number;
  addIntervalMin: number;
  basePositionUsdt: number;
  addScaleFactor: number;
  initialCapital: number;
  feeRate: number;
  startDate: string;

  // Short hedge params
  hedgeEnabled: boolean;
  hedgeTriggerPct: number;     // open short when avg long PnL% < this (e.g. -1.0 = -1%)
  hedgeSizePct: number;        // short size as % of total long notional (e.g. 50 = 50%)
  hedgeTpPct: number;          // short TP: close when price drops this % from short entry
  hedgeSlPct: number;          // short SL: close when price rises this % from short entry
  maxHedges: number;           // max concurrent short positions
  hedgeIntervalMin: number;    // min minutes between hedge opens
}

interface Pos {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
  side: "long" | "short";
}

interface TradeResult {
  side: "long" | "short";
  pnl: number;
  holdMs: number;
}

const DEFAULT: Cfg = {
  tpPct: 1.4,
  leverage: 50,
  maxLongPositions: 11,
  addIntervalMin: 30,
  basePositionUsdt: 800,
  addScaleFactor: 1.32,
  initialCapital: 5000,
  feeRate: 0.00055,
  startDate: "2026-01-20",

  hedgeEnabled: true,
  hedgeTriggerPct: -1.0,    // start hedging when avg long is -1% underwater
  hedgeSizePct: 30,          // each short = 30% of total long notional
  hedgeTpPct: 1.0,           // short TP at 1% drop from entry
  hedgeSlPct: 1.5,           // short SL at 1.5% rise from entry
  maxHedges: 3,
  hedgeIntervalMin: 60,
};

function run(candles: Candle[], cfg: Cfg) {
  let capital = cfg.initialCapital;
  const longs: Pos[] = [];
  const shorts: Pos[] = [];
  const trades: TradeResult[] = [];
  let lastLongAdd = 0;
  let lastHedgeAdd = 0;
  let peak = capital, maxDD = 0, maxConc = 0, minEq = capital;
  let totalFees = 0;
  let longWins = 0, longLosses = 0, shortWins = 0, shortLosses = 0;
  let longPnl = 0, shortPnl = 0;

  const startTs = new Date(cfg.startDate).getTime();

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { high, low, close, timestamp: ts } = c;

    // ── 1. Check long batch TP ──
    if (longs.length > 0) {
      const totalQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgEntry = longs.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const tp = avgEntry * (1 + cfg.tpPct / 100);

      if (high >= tp) {
        for (const p of longs) {
          const pnl = (tp - p.entryPrice) * p.qty - p.notional * cfg.feeRate - tp * p.qty * cfg.feeRate;
          capital += pnl; longPnl += pnl;
          totalFees += p.notional * cfg.feeRate + tp * p.qty * cfg.feeRate;
          trades.push({ side: "long", pnl, holdMs: ts - p.entryTime });
          if (pnl > 0) longWins++; else longLosses++;
        }
        longs.length = 0;

        // When longs TP, close all shorts too (trend reversed, cut hedge)
        for (const s of shorts) {
          // Short PnL: (entry - exit) * qty
          const pnl = (s.entryPrice - close) * s.qty - s.notional * cfg.feeRate - Math.abs(close * s.qty) * cfg.feeRate;
          capital += pnl; shortPnl += pnl;
          totalFees += s.notional * cfg.feeRate + Math.abs(close * s.qty) * cfg.feeRate;
          trades.push({ side: "short", pnl, holdMs: ts - s.entryTime });
          if (pnl > 0) shortWins++; else shortLosses++;
        }
        shorts.length = 0;
      }
    }

    // ── 2. Check short TPs and SLs ──
    for (let j = shorts.length - 1; j >= 0; j--) {
      const s = shorts[j];
      const shortTp = s.entryPrice * (1 - cfg.hedgeTpPct / 100);
      const shortSl = s.entryPrice * (1 + cfg.hedgeSlPct / 100);

      let exitPrice: number | null = null;
      if (low <= shortTp) exitPrice = shortTp;        // TP hit (price dropped)
      else if (high >= shortSl) exitPrice = shortSl;   // SL hit (price rose)

      if (exitPrice !== null) {
        const pnl = (s.entryPrice - exitPrice) * s.qty - s.notional * cfg.feeRate - Math.abs(exitPrice * s.qty) * cfg.feeRate;
        capital += pnl; shortPnl += pnl;
        totalFees += s.notional * cfg.feeRate + Math.abs(exitPrice * s.qty) * cfg.feeRate;
        trades.push({ side: "short", pnl, holdMs: ts - s.entryTime });
        if (pnl > 0) shortWins++; else shortLosses++;
        shorts.splice(j, 1);
      }
    }

    // ── 3. Equity tracking ──
    const longUr = longs.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const shortUr = shorts.reduce((s, p) => s + (p.entryPrice - close) * p.qty, 0);
    const eq = capital + longUr + shortUr;
    if (eq < minEq) minEq = eq;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── 4. Open new long (DCA ladder) ──
    if (longs.length < cfg.maxLongPositions && (ts - lastLongAdd) / 60000 >= cfg.addIntervalMin) {
      const sz = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, longs.length);
      const margin = sz / cfg.leverage;
      const usedMargin = [...longs, ...shorts].reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - usedMargin >= margin && capital > 0) {
        longs.push({ entryPrice: close, entryTime: ts, qty: sz / close, notional: sz, side: "long" });
        lastLongAdd = ts;
        if (longs.length + shorts.length > maxConc) maxConc = longs.length + shorts.length;
      }
    }

    // ── 5. Open short hedge if conditions met ──
    if (cfg.hedgeEnabled && longs.length >= cfg.maxLongPositions && shorts.length < cfg.maxHedges) {
      const totalQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgEntry = longs.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const avgPnlPct = ((close - avgEntry) / avgEntry) * 100;

      if (avgPnlPct <= cfg.hedgeTriggerPct && (ts - lastHedgeAdd) / 60000 >= cfg.hedgeIntervalMin) {
        const totalLongNotional = longs.reduce((s, p) => s + p.notional, 0);
        const hedgeSize = totalLongNotional * (cfg.hedgeSizePct / 100);
        const margin = hedgeSize / cfg.leverage;
        const usedMargin = [...longs, ...shorts].reduce((s, p) => s + p.notional / cfg.leverage, 0);

        if (capital - usedMargin >= margin) {
          shorts.push({ entryPrice: close, entryTime: ts, qty: hedgeSize / close, notional: hedgeSize, side: "short" });
          lastHedgeAdd = ts;
          if (longs.length + shorts.length > maxConc) maxConc = longs.length + shorts.length;
        }
      }
    }
  }

  // Force close remaining
  const lastC = candles[candles.length - 1].close;
  for (const p of longs) {
    const pnl = (lastC - p.entryPrice) * p.qty - p.notional * cfg.feeRate - Math.abs(lastC * p.qty) * cfg.feeRate;
    capital += pnl; longPnl += pnl; trades.push({ side: "long", pnl, holdMs: 0 });
    if (pnl > 0) longWins++; else longLosses++;
  }
  for (const s of shorts) {
    const pnl = (s.entryPrice - lastC) * s.qty - s.notional * cfg.feeRate - Math.abs(lastC * s.qty) * cfg.feeRate;
    capital += pnl; shortPnl += pnl; trades.push({ side: "short", pnl, holdMs: 0 });
    if (pnl > 0) shortWins++; else shortLosses++;
  }

  return { trades, capital, maxDD, minEq, maxConc, totalFees, longWins, longLosses, shortWins, shortLosses, longPnl, shortPnl };
}

// ─── Main ───
const candles = loadCandles("HYPEUSDT", "5");
const CAP = 5000;
const cfg = { ...DEFAULT };

// Parse CLI
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.split("=");
  if (k && v && k in cfg) {
    (cfg as any)[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
  }
}

console.log(`\n=== HEDGED DCA LADDER — $${CAP} equity ===`);
console.log(`Config:`, JSON.stringify(cfg, null, 2));

// Run base (no hedge) for comparison
const baseNoHedge = run(candles, { ...cfg, hedgeEnabled: false });
const baseWithHedge = run(candles, cfg);

function printResult(label: string, r: ReturnType<typeof run>) {
  const longCount = r.longWins + r.longLosses;
  const shortCount = r.shortWins + r.shortLosses;
  const ret = ((r.capital / CAP - 1) * 100);
  console.log(`\n─── ${label} ───`);
  console.log(`  Final capital:  $${r.capital.toFixed(0)} (${ret > 0 ? "+" : ""}${ret.toFixed(0)}% return)`);
  console.log(`  Total PnL:      $${(r.longPnl + r.shortPnl).toFixed(0)} (long: $${r.longPnl.toFixed(0)}, short: $${r.shortPnl.toFixed(0)})`);
  console.log(`  Fees:           $${r.totalFees.toFixed(0)}`);
  console.log(`  Long trades:    ${longCount} (${r.longWins}W / ${r.longLosses}L = ${longCount > 0 ? ((r.longWins/longCount)*100).toFixed(0) : 0}% WR)`);
  console.log(`  Short trades:   ${shortCount} (${r.shortWins}W / ${r.shortLosses}L = ${shortCount > 0 ? ((r.shortWins/shortCount)*100).toFixed(0) : 0}% WR)`);
  console.log(`  Max drawdown:   ${r.maxDD.toFixed(1)}%`);
  console.log(`  Min equity:     $${r.minEq.toFixed(0)}`);
  console.log(`  Max concurrent: ${r.maxConc}`);
  if (r.minEq < 0) console.log(`  ⚠ Wallet needed: $${(CAP + Math.abs(r.minEq)).toFixed(0)} to survive`);
}

printResult("NO HEDGE (longs only)", baseNoHedge);
printResult("WITH HEDGE (longs + shorts)", baseWithHedge);

const improvement = baseWithHedge.minEq - baseNoHedge.minEq;
const pnlDiff = (baseWithHedge.longPnl + baseWithHedge.shortPnl) - (baseNoHedge.longPnl + baseNoHedge.shortPnl);
console.log(`\n─── HEDGE IMPACT ───`);
console.log(`  Min equity improvement: $${improvement.toFixed(0)} (${improvement > 0 ? "better" : "worse"})`);
console.log(`  PnL difference:         $${pnlDiff.toFixed(0)} (${pnlDiff > 0 ? "more" : "less"} profit)`);
console.log(`  DD reduction:           ${(baseNoHedge.maxDD - baseWithHedge.maxDD).toFixed(1)}pp`);

// ─── Sweep hedge parameters ───
console.log(`\n${"═".repeat(90)}`);
console.log("HEDGE PARAMETER SWEEP");
console.log("═".repeat(90));
console.log(`${"Config".padEnd(52)} PnL      Ret    DD   MinEq  ShortPnl ShortWR`);

const sweeps: [string, Partial<Cfg>][] = [
  ["No hedge (baseline)", { hedgeEnabled: false }],
  // Trigger threshold
  ["Trigger -0.5%", { hedgeTriggerPct: -0.5 }],
  ["Trigger -1.0% (base)", {}],
  ["Trigger -2.0%", { hedgeTriggerPct: -2.0 }],
  ["Trigger -3.0%", { hedgeTriggerPct: -3.0 }],
  // Hedge size
  ["Size 20%", { hedgeSizePct: 20 }],
  ["Size 30% (base)", {}],
  ["Size 50%", { hedgeSizePct: 50 }],
  ["Size 80%", { hedgeSizePct: 80 }],
  ["Size 100%", { hedgeSizePct: 100 }],
  // Short TP/SL
  ["ShortTP 0.5% SL 1%", { hedgeTpPct: 0.5, hedgeSlPct: 1.0 }],
  ["ShortTP 1.0% SL 1.5% (base)", {}],
  ["ShortTP 1.5% SL 2%", { hedgeTpPct: 1.5, hedgeSlPct: 2.0 }],
  ["ShortTP 2.0% SL 2.5%", { hedgeTpPct: 2.0, hedgeSlPct: 2.5 }],
  // Max hedges
  ["1 hedge max", { maxHedges: 1 }],
  ["3 hedges max (base)", {}],
  ["5 hedges max", { maxHedges: 5 }],
  // Hedge interval
  ["Hedge every 30m", { hedgeIntervalMin: 30 }],
  ["Hedge every 60m (base)", {}],
  ["Hedge every 120m", { hedgeIntervalMin: 120 }],
  // Best combo attempts
  ["Best1: trig-2 sz50 tp1.5 sl2 max5", { hedgeTriggerPct: -2, hedgeSizePct: 50, hedgeTpPct: 1.5, hedgeSlPct: 2.0, maxHedges: 5 }],
  ["Best2: trig-1 sz50 tp1.0 sl1.5 max3", { hedgeTriggerPct: -1, hedgeSizePct: 50, hedgeTpPct: 1.0, hedgeSlPct: 1.5, maxHedges: 3 }],
  ["Best3: trig-0.5 sz80 tp0.5 sl1 max5", { hedgeTriggerPct: -0.5, hedgeSizePct: 80, hedgeTpPct: 0.5, hedgeSlPct: 1.0, maxHedges: 5 }],
  ["Best4: trig-1 sz30 tp2.0 sl1.0 max3", { hedgeTriggerPct: -1, hedgeSizePct: 30, hedgeTpPct: 2.0, hedgeSlPct: 1.0, maxHedges: 3 }],
  ["Best5: trig-3 sz100 tp2 sl3 max3", { hedgeTriggerPct: -3, hedgeSizePct: 100, hedgeTpPct: 2.0, hedgeSlPct: 3.0, maxHedges: 3 }],
];

for (const [label, ov] of sweeps) {
  const c = { ...cfg, ...ov };
  const r = run(candles, c);
  const ret = ((r.capital / CAP - 1) * 100).toFixed(0);
  const shortCount = r.shortWins + r.shortLosses;
  const swr = shortCount > 0 ? ((r.shortWins / shortCount) * 100).toFixed(0) : "-";
  const totalPnl = r.longPnl + r.shortPnl;
  const flag = r.minEq > 0 ? "✓" : "⚠";
  console.log(
    `  ${label.padEnd(52)}$${totalPnl.toFixed(0).padStart(7)}  ${ret.padStart(5)}%  ${r.maxDD.toFixed(0).padStart(4)}%  $${r.minEq.toFixed(0).padStart(6)}  $${r.shortPnl.toFixed(0).padStart(6)}  ${swr.padStart(4)}%  ${flag}`
  );
}
