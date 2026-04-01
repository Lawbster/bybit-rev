import fs from "fs";
import path from "path";
import { loadCandles, Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// DCA Ladder Sim with Full Exit Stack
//
// Exit rules (from Codex quant analysis):
// 1. Batch TP: weighted avg entry + tpPct%
// 2. Soft stale: oldest pos > staleHours → reduce TP to reducedTpPct
// 3. Hard flatten: oldest pos > hardFlattenHours AND avg PnL ≤ hardFlattenPct AND trend hostile
// 4. Emergency kill: avg ladder PnL ≤ emergencyKillPct → flatten
// 5. Portfolio kill: equity DD ≥ portfolioKillPct → flatten all
// ─────────────────────────────────────────────

interface SimConfig {
  symbol: string;
  tpPct: number;
  leverage: number;
  maxPositions: number;
  addIntervalMin: number;
  basePositionUsdt: number;
  addScaleFactor: number;
  initialCapital: number;
  feeRate: number;
  startDate: string;

  // Exit stack
  staleHours: number;         // 0 = disabled. soft stale: reduce TP after this many hours
  reducedTpPct: number;       // TP% to use in soft stale mode (e.g. 0.9)
  hardFlattenHours: number;   // 0 = disabled. hard flatten if oldest > this AND conditions met
  hardFlattenPct: number;     // avg ladder PnL must be worse than this (e.g. -6)
  emergencyKillPct: number;   // 0 = disabled. flatten if avg ladder PnL ≤ this (e.g. -10)
  portfolioKillPct: number;   // 0 = disabled. flatten if equity DD ≥ this (e.g. 30)

  // Funding fee
  fundingRate8h: number;      // funding rate per 8h interval (e.g. 0.0001 = 0.01%)

  // Trend gate (simple: 4h EMA200 + EMA50 slope)
  useTrendGate: boolean;

  // Participation filter (from xwave overlay study)
  useParticipationFilter: boolean;
  minAtrPct: number;            // only add when ATR14% > this (0 = disabled). RIVER: 0.73, HYPE: 0.30
  minDrawdownFromHigh: number;  // only add when DD from 24h high > this % (0 = disabled). RIVER: 2.2, HYPE: 1.5
  maxEmaRatio: number;          // only add when close/EMA200 < this (0 = disabled). e.g. 1.02
}

const DEFAULT_CONFIG: SimConfig = {
  symbol: "HYPEUSDT",
  tpPct: 1.4,
  leverage: 50,
  maxPositions: 11,
  addIntervalMin: 30,
  basePositionUsdt: 800,
  addScaleFactor: 1.2,
  initialCapital: 5000,
  feeRate: 0.00055,
  startDate: "2025-01-20",

  // Exit stack — Codex recommended values
  staleHours: 20,
  reducedTpPct: 0.9,
  hardFlattenHours: 40,
  hardFlattenPct: -6,
  emergencyKillPct: -10,
  portfolioKillPct: 0,       // OFF — fires too early in normal drawdowns (Jan 2025)

  fundingRate8h: 0.0001,     // 0.01% per 8h — typical baseline for USDT perps

  useTrendGate: true,

  useParticipationFilter: false,
  minAtrPct: 0,
  minDrawdownFromHigh: 0,
  maxEmaRatio: 0,
};

interface Position {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
}

// ─────────────────────────────────────────────
// Trend gate: 4h EMA200 + EMA50 slope
// ─────────────────────────────────────────────
function buildTrendGate(candles: Candle[]): Map<number, boolean> {
  // Resample to 4h bars
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;

  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
      curBar = bar;
    }
    lastClose = c.close;
    lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });

  // Compute EMAs
  const ema = (data: number[], p: number): number[] => {
    const k = 2 / (p + 1);
    const r = [data[0]];
    for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
    return r;
  };

  const closes = bars.map(b => b.close);
  const ema200 = ema(closes, 200);
  const ema50 = ema(closes, 50);

  // Build a map: for each 4h bar timestamp, is trend hostile?
  // hostile = close < EMA200 AND EMA50 slope < 0
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    const isHostile = closes[i] < ema200[i] && ema50[i] < ema50[i - 1];
    // Apply to all 5m candles in this 4h window
    const barStart = Math.floor(bars[i].ts / period) * period;
    hostile.set(barStart, isHostile);
  }

  return hostile;
}

function isTrendHostile(trendGate: Map<number, boolean>, timestamp: number): boolean {
  // IMPORTANT: use the PREVIOUS completed 4h bar, not the current one.
  // At any point during the 12:00-16:00 bar, we only know the 08:00-12:00 bar's close.
  const period = 4 * 3600000;
  const currentBarStart = Math.floor(timestamp / period) * period;
  const prevBarStart = currentBarStart - period;
  return trendGate.get(prevBarStart) ?? false;
}

// ─────────────────────────────────────────────
// Simulator
// ─────────────────────────────────────────────
function runSim(candles: Candle[], config: SimConfig) {
  const {
    tpPct, leverage, maxPositions, addIntervalMin, basePositionUsdt, addScaleFactor,
    initialCapital, feeRate, fundingRate8h, staleHours, reducedTpPct, hardFlattenHours, hardFlattenPct,
    emergencyKillPct, portfolioKillPct, useTrendGate,
  } = config;

  // Build trend gate
  const trendGate = useTrendGate ? buildTrendGate(candles) : new Map<number, boolean>();

  // Precompute participation filter indicators (ATR14, EMA200 on 5m candles)
  let atr14: number[] = [];
  let ema200_5m: number[] = [];
  if (config.useParticipationFilter) {
    // ATR14
    const tr = [candles[0].high - candles[0].low];
    for (let j = 1; j < candles.length; j++) {
      const h = candles[j].high, l = candles[j].low, pc = candles[j - 1].close;
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    const k14 = 2 / 15;
    atr14 = [tr[0]];
    for (let j = 1; j < tr.length; j++) atr14.push(tr[j] * k14 + atr14[j - 1] * (1 - k14));

    // EMA200 on 5m closes
    const k200 = 2 / 201;
    ema200_5m = [candles[0].close];
    for (let j = 1; j < candles.length; j++) ema200_5m.push(candles[j].close * k200 + ema200_5m[j - 1] * (1 - k200));
  }

  let capital = initialCapital;
  const positions: Position[] = [];
  let lastAddTime = 0;
  let peakCapital = capital;
  let maxDrawdown = 0;
  let maxConcurrent = 0;
  let totalFees = 0;
  let totalFunding = 0;
  let totalTrades = 0;
  let wins = 0;
  let minEquity = capital;
  let killed = false;
  let killReason = "";

  // Exit counters
  let batchTpCloses = 0;
  let staleTpCloses = 0;
  let hardFlattenCloses = 0;
  let emergencyKillCloses = 0;
  let portfolioKillCloses = 0;
  let trendBlockedAdds = 0;
  let participationBlockedAdds = 0;

  const monthPnl: Record<string, { trades: number; pnl: number; wins: number; exitTypes: Record<string, number> }> = {};

  const startTs = config.startDate ? new Date(config.startDate).getTime() : 0;

  function closeLadder(exitPrice: number, ts: number, exitType: string) {
    const m = new Date(ts).toISOString().slice(0, 7);
    if (!monthPnl[m]) monthPnl[m] = { trades: 0, pnl: 0, wins: 0, exitTypes: {} };
    if (!monthPnl[m].exitTypes[exitType]) monthPnl[m].exitTypes[exitType] = 0;

    for (const p of positions) {
      const pnlRaw = (exitPrice - p.entryPrice) * p.qty;
      const fees = p.notional * feeRate + exitPrice * p.qty * feeRate;
      // Funding: charged per 8h interval on position notional (longs pay when rate positive)
      const holdMs = ts - p.entryTime;
      const fundingIntervals = holdMs / (8 * 3600000);
      const funding = p.notional * fundingRate8h * fundingIntervals;
      const pnl = pnlRaw - fees - funding;
      capital += pnl;
      totalFees += fees;
      totalFunding += funding;
      totalTrades++;
      if (pnl > 0) { wins++; monthPnl[m].wins++; }
      monthPnl[m].trades++;
      monthPnl[m].pnl += pnl;
    }
    monthPnl[m].exitTypes[exitType] += positions.length;
    positions.length = 0;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    if (killed) break;

    const close = c.close;
    const high = c.high;
    const ts = c.timestamp;

    // ── Exit checks (in priority order) ──

    if (positions.length > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
      const avgPnlPct = ((close - avgEntry) / avgEntry) * 100;
      const oldestAge = (ts - positions[0].entryTime) / 3600000;

      // 1. Batch TP (check high vs TP price)
      const isStale = staleHours > 0 && oldestAge >= staleHours && avgPnlPct < 0;
      const activeTpPct = isStale ? reducedTpPct : tpPct;
      const tpPrice = avgEntry * (1 + activeTpPct / 100);

      if (high >= tpPrice) {
        if (isStale) { staleTpCloses++; } else { batchTpCloses++; }
        closeLadder(tpPrice, ts, isStale ? "stale_tp" : "batch_tp");
        continue;
      }

      // 2. Emergency kill: avg PnL too deep
      if (emergencyKillPct !== 0 && avgPnlPct <= emergencyKillPct) {
        emergencyKillCloses++;
        closeLadder(close, ts, "emergency_kill");
        continue;
      }

      // 3. Hard flatten: old + underwater + hostile trend
      if (hardFlattenHours > 0 && oldestAge >= hardFlattenHours && avgPnlPct <= hardFlattenPct) {
        const hostile = useTrendGate ? isTrendHostile(trendGate, ts) : true;
        if (hostile) {
          hardFlattenCloses++;
          closeLadder(close, ts, "hard_flatten");
          continue;
        }
      }
    }

    // 4. Portfolio kill: equity drawdown
    const ur = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const equity = capital + ur;
    if (equity < minEquity) minEquity = equity;
    if (equity > peakCapital) peakCapital = equity;
    const dd = peakCapital > 0 ? ((peakCapital - equity) / peakCapital) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (portfolioKillPct > 0 && dd >= portfolioKillPct && positions.length > 0) {
      portfolioKillCloses++;
      closeLadder(close, ts, "portfolio_kill");
      killed = true;
      killReason = `Portfolio DD ${dd.toFixed(1)}% >= ${portfolioKillPct}% at ${new Date(ts).toISOString().slice(0, 16)}`;
      break;
    }

    // ── Open new position ──
    const timeSinceAdd = (ts - lastAddTime) / 60000;
    if (positions.length < maxPositions && timeSinceAdd >= addIntervalMin && !killed) {
      // Trend gate: block adds in hostile regime
      if (useTrendGate && isTrendHostile(trendGate, ts)) {
        trendBlockedAdds++;
      } else if (config.useParticipationFilter) {
        // Participation filter: only add when vol is elevated + price is in dip
        let blocked = false;

        // ATR check
        if (config.minAtrPct > 0 && i < atr14.length) {
          const atrPct = (atr14[i] / close) * 100;
          if (atrPct < config.minAtrPct) blocked = true;
        }

        // Drawdown from 24h high check
        if (!blocked && config.minDrawdownFromHigh > 0) {
          let high24h = 0;
          const lookback = Math.min(i, 288); // 288 × 5min = 24h
          for (let j = i - lookback; j <= i; j++) {
            if (candles[j].high > high24h) high24h = candles[j].high;
          }
          const ddFromHigh = ((high24h - close) / high24h) * 100;
          if (ddFromHigh < config.minDrawdownFromHigh) blocked = true;
        }

        // EMA ratio check
        if (!blocked && config.maxEmaRatio > 0 && i < ema200_5m.length) {
          const ratio = close / ema200_5m[i];
          if (ratio > config.maxEmaRatio) blocked = true;
        }

        if (blocked) {
          participationBlockedAdds++;
        } else {
          const level = positions.length;
          const notional = basePositionUsdt * Math.pow(addScaleFactor, level);
          const margin = notional / leverage;
          const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
          if (capital - usedMargin >= margin && capital > 0) {
            positions.push({ entryPrice: close, entryTime: ts, qty: notional / close, notional });
            lastAddTime = ts;
            if (positions.length > maxConcurrent) maxConcurrent = positions.length;
          }
        }
      } else {
        const level = positions.length;
        const notional = basePositionUsdt * Math.pow(addScaleFactor, level);
        const margin = notional / leverage;
        const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
        if (capital - usedMargin >= margin && capital > 0) {
          positions.push({ entryPrice: close, entryTime: ts, qty: notional / close, notional });
          lastAddTime = ts;
          if (positions.length > maxConcurrent) maxConcurrent = positions.length;
        }
      }
    }
  }

  // Force close remaining
  if (positions.length > 0 && !killed) {
    const last = candles[candles.length - 1];
    closeLadder(last.close, last.timestamp, "sim_end");
  }

  return {
    capital, totalTrades, wins, totalFees, totalFunding, maxDrawdown, maxConcurrent, minEquity,
    peakCapital, killed, killReason, monthPnl,
    exitCounts: { batchTpCloses, staleTpCloses, hardFlattenCloses, emergencyKillCloses, portfolioKillCloses, trendBlockedAdds, participationBlockedAdds },
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  const config = { ...DEFAULT_CONFIG };

  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split("=");
    if (k && v && k in config) {
      (config as any)[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
    }
  }

  // Load candles — use full data if available
  let candles: Candle[];
  const fullPath = path.resolve(process.cwd(), `data/${config.symbol}_5_full.json`);
  if (fs.existsSync(fullPath)) {
    candles = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    console.log(`Using full history: ${candles.length} candles`);
  } else {
    candles = loadCandles(config.symbol, "5");
    console.log(`Using standard data: ${candles.length} candles`);
  }

  const from = new Date(candles[0].timestamp).toISOString().slice(0, 10);
  const to = new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10);
  console.log(`Period: ${from} → ${to}`);

  // ── Run: no exits (baseline) ──
  const baseline = runSim(candles, {
    ...config,
    staleHours: 0, hardFlattenHours: 0, emergencyKillPct: 0, portfolioKillPct: 0, useTrendGate: false,
  });

  // ── Run: trend gate only ──
  const trendOnly = runSim(candles, {
    ...config,
    staleHours: 0, hardFlattenHours: 0, emergencyKillPct: 0, portfolioKillPct: 0, useTrendGate: true,
  });

  // ── Run: full exit stack ──
  const full = runSim(candles, config);

  // ── Run: exit stack WITHOUT trend gate ──
  const exitsNoTrend = runSim(candles, { ...config, useTrendGate: false });

  // ── Print comparison ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("  EXIT STACK COMPARISON — " + config.symbol);
  console.log(`${"═".repeat(80)}\n`);

  console.log(`Config: $${config.basePositionUsdt} base, ${config.addScaleFactor}x, $${config.initialCapital} cap, ${config.maxPositions} max, ${config.tpPct}% TP`);
  console.log(`Exits: stale ${config.staleHours}h→${config.reducedTpPct}%, hard ${config.hardFlattenHours}h@${config.hardFlattenPct}%, emerg ${config.emergencyKillPct}%, port ${config.portfolioKillPct}%\n`);

  const fmt = (r: typeof baseline, label: string) => {
    const ret = ((r.capital / config.initialCapital - 1) * 100);
    const wr = r.totalTrades > 0 ? (r.wins / r.totalTrades * 100) : 0;
    const surv = r.minEquity > 0 ? "YES" : "NO";
    console.log(`  ${label.padEnd(30)} | Return: ${(ret.toFixed(1) + "%").padStart(8)} | DD: ${r.maxDrawdown.toFixed(1).padStart(5)}% | MinEq: $${r.minEquity.toFixed(0).padStart(7)} | Survived: ${surv} | Trades: ${r.totalTrades} (${wr.toFixed(0)}% WR)`);
    if (r.killed) console.log(`  ${"".padEnd(30)} | KILLED: ${r.killReason}`);
    console.log(`  ${"".padEnd(30)} | Fees: $${r.totalFees.toFixed(0)} trading + $${r.totalFunding.toFixed(0)} funding = $${(r.totalFees + r.totalFunding).toFixed(0)} total`);
    console.log(`  ${"".padEnd(30)} | Exits: batchTP=${r.exitCounts.batchTpCloses} staleTP=${r.exitCounts.staleTpCloses} hardFlat=${r.exitCounts.hardFlattenCloses} emKill=${r.exitCounts.emergencyKillCloses} portKill=${r.exitCounts.portfolioKillCloses} trendBlock=${r.exitCounts.trendBlockedAdds} participBlock=${r.exitCounts.participationBlockedAdds}`);
  };

  fmt(baseline, "No exits (baseline)");
  console.log("");
  fmt(trendOnly, "Trend gate only");
  console.log("");
  fmt(exitsNoTrend, "Exit stack (no trend gate)");
  console.log("");
  fmt(full, "Full stack (trend + exits)");

  // ── Monthly detail for full stack ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("  MONTHLY — Full Exit Stack");
  console.log(`${"═".repeat(80)}\n`);

  console.log("Month     | Trades |    PnL   |  WR  | Exit breakdown");
  console.log("─".repeat(75));

  for (const [m, v] of Object.entries(full.monthPnl).sort()) {
    const wr = v.trades > 0 ? (v.wins / v.trades * 100).toFixed(0) : "0";
    const exits = Object.entries(v.exitTypes).map(([t, n]) => `${t}:${n}`).join(" ");
    console.log(
      `${m.padEnd(10)}| ${String(v.trades).padStart(6)} | $${v.pnl.toFixed(0).padStart(7)} | ${wr.padStart(3)}% | ${exits}`
    );
  }

  // ── Sweep: vary exit params ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("  EXIT PARAM SWEEP");
  console.log(`${"═".repeat(80)}\n`);

  console.log("Config".padEnd(45) + "Return".padStart(9) + "MaxDD".padStart(8) + "MinEq".padStart(10) + "  Surv" + "  Trades");
  console.log("─".repeat(90));

  const sweeps: [string, Partial<SimConfig>][] = [
    // Stale TP variations
    ["Stale 12h → 0.9% TP", { staleHours: 12, reducedTpPct: 0.9 }],
    ["Stale 18h → 0.9% TP", { staleHours: 18, reducedTpPct: 0.9 }],
    ["Stale 24h → 0.9% TP", { staleHours: 24, reducedTpPct: 0.9 }],
    ["Stale 18h → 0.5% TP", { staleHours: 18, reducedTpPct: 0.5 }],

    // Hard flatten variations
    ["Hard 24h @ -6%", { hardFlattenHours: 24, hardFlattenPct: -6 }],
    ["Hard 36h @ -6%", { hardFlattenHours: 36, hardFlattenPct: -6 }],
    ["Hard 48h @ -6%", { hardFlattenHours: 48, hardFlattenPct: -6 }],
    ["Hard 36h @ -4%", { hardFlattenHours: 36, hardFlattenPct: -4 }],
    ["Hard 36h @ -8%", { hardFlattenHours: 36, hardFlattenPct: -8 }],

    // Emergency kill variations
    ["Emergency -8%", { emergencyKillPct: -8 }],
    ["Emergency -10%", { emergencyKillPct: -10 }],
    ["Emergency -12%", { emergencyKillPct: -12 }],

    // Portfolio kill variations
    ["Portfolio -20%", { portfolioKillPct: 20 }],
    ["Portfolio -25%", { portfolioKillPct: 25 }],
    ["Portfolio -30%", { portfolioKillPct: 30 }],
    ["Portfolio -40%", { portfolioKillPct: 40 }],

    // Combined stacks
    ["Stack: stale20 + hard40@-6 + em-10", { staleHours: 20, hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10, portfolioKillPct: 0 }],
    ["Stack: stale20 + hard40@-6 + port30", { staleHours: 20, hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: 0, portfolioKillPct: 30 }],
    ["Stack: stale20 + hard40@-6 + em-10 + port30", { staleHours: 20, hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10, portfolioKillPct: 30 }],
    ["Stack: stale18 + hard36@-4 + em-8 + port25", { staleHours: 18, hardFlattenHours: 36, hardFlattenPct: -4, emergencyKillPct: -8, portfolioKillPct: 25 }],
    ["Codex recommended (default)", {}],

    // With/without trend gate
    ["Codex + no trend gate", { useTrendGate: false }],
    ["No exits + trend gate", { staleHours: 0, hardFlattenHours: 0, emergencyKillPct: 0, portfolioKillPct: 0, useTrendGate: true }],

    // ── Participation filter (from xwave overlay study) ──
    // ATR only
    ["PF: ATR>0.2%", { useParticipationFilter: true, minAtrPct: 0.2 }],
    ["PF: ATR>0.3%", { useParticipationFilter: true, minAtrPct: 0.3 }],
    ["PF: ATR>0.5%", { useParticipationFilter: true, minAtrPct: 0.5 }],
    ["PF: ATR>0.7%", { useParticipationFilter: true, minAtrPct: 0.7 }],

    // Drawdown from 24h high only
    ["PF: DD24h>2%", { useParticipationFilter: true, minDrawdownFromHigh: 2 }],
    ["PF: DD24h>5%", { useParticipationFilter: true, minDrawdownFromHigh: 5 }],
    ["PF: DD24h>8%", { useParticipationFilter: true, minDrawdownFromHigh: 8 }],

    // EMA ratio only
    ["PF: EMA<1.00", { useParticipationFilter: true, maxEmaRatio: 1.00 }],
    ["PF: EMA<1.02", { useParticipationFilter: true, maxEmaRatio: 1.02 }],
    ["PF: EMA<1.05", { useParticipationFilter: true, maxEmaRatio: 1.05 }],

    // Combined: best from overlay
    ["PF: ATR>0.3 + DD>2%", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 2 }],
    ["PF: ATR>0.3 + DD>5%", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 5 }],
    ["PF: ATR>0.3 + EMA<1.02", { useParticipationFilter: true, minAtrPct: 0.3, maxEmaRatio: 1.02 }],
    ["PF: ATR>0.3 + DD>2% + EMA<1.02", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 2, maxEmaRatio: 1.02 }],
    ["PF: ATR>0.5 + DD>5% + EMA<1.00", { useParticipationFilter: true, minAtrPct: 0.5, minDrawdownFromHigh: 5, maxEmaRatio: 1.00 }],

    // Combined with no trend gate (PF replaces trend gate)
    ["PF: ATR>0.3 + DD>2% (no trend)", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 2, useTrendGate: false }],
    ["PF: ATR>0.3 + DD>5% (no trend)", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 5, useTrendGate: false }],

    // Aggressive stale TP (xwave finding: 0.2-0.3% reduced TP)
    ["Stale 12h → 0.5% TP", { staleHours: 12, reducedTpPct: 0.5 }],
    ["Stale 12h → 0.3% TP", { staleHours: 12, reducedTpPct: 0.3 }],
    ["Stale 8h → 0.5% TP", { staleHours: 8, reducedTpPct: 0.5 }],
    ["Stale 8h → 0.3% TP", { staleHours: 8, reducedTpPct: 0.3 }],

    // PF + aggressive stale combined
    ["PF:ATR>0.3+DD>2% + stale12h→0.5%", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 2, staleHours: 12, reducedTpPct: 0.5 }],
    ["PF:ATR>0.3+DD>2% + stale12h→0.3%", { useParticipationFilter: true, minAtrPct: 0.3, minDrawdownFromHigh: 2, staleHours: 12, reducedTpPct: 0.3 }],
  ];

  for (const [label, overrides] of sweeps) {
    const tc = { ...config, ...overrides };
    const r = runSim(candles, tc);
    const ret = ((r.capital / tc.initialCapital - 1) * 100);
    const surv = r.minEquity > 0 ? "YES" : "NO ";
    console.log(
      label.padEnd(45) +
      (ret.toFixed(1) + "%").padStart(9) +
      (r.maxDrawdown.toFixed(1) + "%").padStart(8) +
      ("$" + r.minEquity.toFixed(0)).padStart(10) +
      "  " + surv +
      "  " + String(r.totalTrades).padStart(5)
    );
  }
}

main();
