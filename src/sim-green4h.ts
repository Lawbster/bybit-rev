import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Sim: ladder size sweep + short hedge overlay during DD
// ─────────────────────────────────────────────

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  // Hedge config
  hedgeEnabled: boolean;
  hedgeDdTrigger: number;
  hedgeDdExit: number;
  hedgeMaxPositions: number;
  hedgeTpPct: number;
  hedgeBasePosUsdt: number;
  hedgeAddInterval: number;
  hedgeScaleFactor: number;
  hedgeStaleHours: number;
  hedgeReducedTpPct: number;
  hedgeKillPct: number;
}

function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

// Build 4h bars with open/close so we can detect green closes
function build4hBars(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; open: number; close: number; barIdx: number }[] = [];
  let curBarIdx = -1, barOpen = 0, barClose = 0, barTs = 0;
  for (const c of candles) {
    const idx = Math.floor(c.timestamp / period);
    if (idx !== curBarIdx) {
      if (curBarIdx !== -1) bars.push({ ts: barTs, open: barOpen, close: barClose, barIdx: curBarIdx });
      curBarIdx = idx;
      barOpen = c.open;
    }
    barClose = c.close;
    barTs = c.timestamp;
  }
  if (curBarIdx !== -1) bars.push({ ts: barTs, open: barOpen, close: barClose, barIdx: curBarIdx });
  return bars;
}

interface Snap {
  ts: number; equity: number; capital: number; peak: number; ddPct: number; ddDollar: number;
  posCount: number; event?: string; notional: number; avgEntry?: number; exitPrice?: number;
  ladderPnl?: number;
}

function run(candles: Candle[], cfg: Cfg, useGreenGate: boolean): { snaps: Snap[]; stats: { tpCount: number; staleCount: number; killCount: number; flatCount: number; greenGateBlocks: number; addsAllowed: number } } {
  const gate = buildTrendGate(candles);
  const bars4h = build4hBars(candles);

  // Build a map: 4h bar index → is green
  const greenBar = new Map<number, boolean>();
  for (const b of bars4h) {
    greenBar.set(b.barIdx, b.close >= b.open);
  }

  let capital = cfg.initialCapital, peakEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  const snaps: Snap[] = [];
  const SAMPLE = 4 * 3600000;
  let lastSnap = 0;
  let pendingEvent: string | undefined;
  let pendingAvgE = 0, pendingExit = 0, pendingPnl = 0;

  // Green gate state: how many adds remain from last green 4h close
  let addsRemaining = 0;
  let lastGreenBarIdx = -1;

  let tpCount = 0, staleCount = 0, killCount = 0, flatCount = 0, greenGateBlocks = 0, addsAllowed = 0;

  function doSnap(ts: number, close: number) {
    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const not = pos.reduce((s, p) => s + p.notional, 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    snaps.push({ ts, equity: eq, capital, peak: peakEq, ddPct: dd, ddDollar: peakEq - eq,
      posCount: pos.length, event: pendingEvent, notional: not,
      avgEntry: pendingAvgE || undefined, exitPrice: pendingExit || undefined,
      ladderPnl: pendingPnl || undefined });
    pendingEvent = undefined; pendingAvgE = 0; pendingExit = 0; pendingPnl = 0;
  }

  function closeLadder(price: number, ts: number, close: number, evt: string) {
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    let netPnl = 0;
    for (const p of pos) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      netPnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    pendingEvent = evt; pendingAvgE = avgE; pendingExit = price; pendingPnl = netPnl;
    pos.length = 0;
    addsRemaining = 0; // reset on close
    doSnap(ts, close);
  }

  const period = 4 * 3600000;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { close, high, timestamp: ts } = c;

    // Check if a new 4h bar just completed and was green → grant 2 adds
    if (useGreenGate) {
      const curBarIdx = Math.floor(ts / period);
      const prevBarIdx = curBarIdx - 1;
      if (prevBarIdx !== lastGreenBarIdx && greenBar.has(prevBarIdx)) {
        if (greenBar.get(prevBarIdx)) {
          addsRemaining = 2;
          lastGreenBarIdx = prevBarIdx;
        } else {
          lastGreenBarIdx = prevBarIdx;
        }
      }
    }

    if (pos.length > 0) {
      const tQty = pos.reduce((s, p) => s + p.qty, 0);
      const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;
      const oldH = (ts - pos[0].et) / 3600000;
      const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
      const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tp / 100);
      if (high >= tpPrice) {
        if (isStale) staleCount++; else tpCount++;
        closeLadder(tpPrice, ts, close, isStale ? "STALE" : "TP");
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) { killCount++; closeLadder(close, ts, close, "EM KILL"); continue; }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) { flatCount++; closeLadder(close, ts, close, "HARD FLAT"); continue; }
    }

    if (ts - lastSnap >= SAMPLE) { doSnap(ts, close); lastSnap = ts; }

    const gap = (ts - lastAdd) / 60000;
    if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
      if (!isHostile(gate, ts)) {
        // Green gate check
        if (useGreenGate && addsRemaining <= 0) {
          greenGateBlocks++;
          continue; // blocked — no green 4h close permission
        }

        const lvl = pos.length;
        const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - used >= margin && capital > 0) {
          pos.push({ ep: close, et: ts, qty: notional / close, notional });
          lastAdd = ts;
          if (useGreenGate) { addsRemaining--; addsAllowed++; }
        }
      }
    }
  }
  if (pos.length > 0) { const l = candles[candles.length - 1]; doSnap(l.timestamp, l.close); }
  return { snaps, stats: { tpCount, staleCount, killCount, flatCount, greenGateBlocks, addsAllowed } };
}

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

const baseCfg: Cfg = {
  label: "", tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2025-07-01",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const configs: { label: string; greenGate: boolean; addsPerGreen: number }[] = [
  { label: "A: Baseline (no green gate)", greenGate: false, addsPerGreen: 0 },
  { label: "B: Green 4h gate (2 adds per green)", greenGate: true, addsPerGreen: 2 },
];

console.log("=".repeat(110));
console.log("  GREEN 4H GATE SIM — $15K from July 2025");
console.log("  Rule: only add positions after a green 4h close. Each green close allows 2 consecutive adds.");
console.log("=".repeat(110));

for (const c of configs) {
  const cfg = { ...baseCfg, label: c.label };
  const { snaps, stats } = run(candles, cfg, c.greenGate);

  const finalEq = snaps[snaps.length - 1].equity;
  const maxDD = Math.max(...snaps.map(s => s.ddPct));
  const minEq = Math.min(...snaps.map(s => s.equity));
  const maxNot = Math.max(...snaps.map(s => s.notional));

  console.log(`\n  ${c.label}`);
  console.log("  " + "-".repeat(100));
  console.log(`  Final: $${finalEq.toFixed(0)} | Return: ${((finalEq / 15000 - 1) * 100).toFixed(1)}% | MaxDD: ${maxDD.toFixed(1)}% | MinEq: $${minEq.toFixed(0)} | MaxNotional: $${maxNot.toFixed(0)}`);
  console.log(`  TPs: ${stats.tpCount} | Stale TPs: ${stats.staleCount} | EM Kills: ${stats.killCount} | Hard Flattens: ${stats.flatCount}`);
  if (c.greenGate) {
    console.log(`  Green gate blocks: ${stats.greenGateBlocks} | Adds allowed: ${stats.addsAllowed}`);
  }

  // Monthly equity
  console.log(`\n  Month       Equity     Return    DD%      DD$      Positions`);
  console.log("  " + "-".repeat(80));
  let lastMonth = "";
  for (const s of snaps) {
    const m = new Date(s.ts).toISOString().slice(0, 7);
    if (m !== lastMonth) {
      const d = new Date(s.ts).toISOString().slice(0, 10);
      const ret = ((s.equity / 15000 - 1) * 100);
      console.log(`  ${d}  $${s.equity.toFixed(0).padStart(7)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(0) + "%"}${" ".repeat(Math.max(1, 7 - ret.toFixed(0).length))} -${s.ddPct.toFixed(1).padStart(5)}%  -$${s.ddDollar.toFixed(0).padStart(6)}  ${s.posCount}`);
      lastMonth = m;
    }
  }

  // Loss events
  const events = snaps.filter(s => s.event === "EM KILL" || s.event === "HARD FLAT");
  if (events.length > 0) {
    console.log(`\n  Loss events:`);
    console.log("  " + "-".repeat(100));
    let totalLoss = 0;
    for (const s of events) {
      const d = new Date(s.ts).toISOString().slice(0, 16);
      totalLoss += s.ladderPnl || 0;
      console.log(`  ${d}  ${s.event!.padEnd(10)}  avg $${s.avgEntry?.toFixed(2).padStart(7)} → $${s.exitPrice?.toFixed(2).padStart(7)}  PnL: $${(s.ladderPnl || 0).toFixed(0).padStart(6)}  Equity: $${s.equity.toFixed(0).padStart(7)}  DD: -${s.ddPct.toFixed(1)}%`);
    }
    console.log(`  Total loss: $${totalLoss.toFixed(0)} | Avg per event: $${(totalLoss / events.length).toFixed(0)} | Count: ${events.length}`);
  }
}

// Drawdown comparison
console.log("\n" + "=".repeat(110));
console.log("  COMPARISON SUMMARY");
console.log("=".repeat(110));
console.log(`
  The green 4h gate hypothesis:
  - Only enter when the 4h candle closes green (bullish confirmation)
  - Limits to 2 adds per green close, forcing slower ladder build-up
  - Should reduce exposure going into dumps (red 4h = no new entries)

  What we're looking for:
  - Fewer EM kills (less likely to be fully loaded when crash comes)
  - Lower max DD% (less notional exposed during downturns)
  - Trade-off: possibly fewer TPs too (slower entry = miss some bounces)
`);
