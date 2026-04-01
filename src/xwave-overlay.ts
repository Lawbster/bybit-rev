import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";
import { parseXwaveExport, XwaveTrade } from "./parse-xwave";

// ─────────────────────────────────────────────
// Xwave Trade / No-Trade Overlay Study
//
// For each 30-minute window in the xwave period:
//   1. Was xwave active? (opened or closed trades)
//   2. What was the market state?
//   3. Correlate: which indicators predict participation?
// ─────────────────────────────────────────────

const WINDOW_MS = 30 * 60 * 1000; // 30-minute windows

interface WindowState {
  timestamp: number;
  // Xwave activity
  tradesOpened: number;
  tradesClosed: number;
  notionalOpened: number;
  batchesStarted: number;  // new anchors set
  activity: "heavy" | "light" | "idle";
  // Market state (computed from 5m candles)
  close: number;
  ema50: number;
  ema200: number;
  emaRatio: number;        // close / ema200
  rsi14: number;
  atr14pct: number;        // ATR as % of price
  vol1h: number;           // 1h realized vol (std of 5m returns)
  vol4h: number;           // 4h realized vol
  drawdownFrom24hHigh: number;  // % below 24h high
  bounceCount1h: number;   // number of 0.3%+ reversals in last 1h
  bounceCount4h: number;   // number of 0.3%+ reversals in last 4h
  wickRatio1h: number;     // avg (high-low)/(abs(open-close)) over last 1h
  fwdHitRate: number;      // did price reach +0.7% within next 2h? (for validation)
}

// ─────────────────────────────────────────────
// Indicator helpers
// ─────────────────────────────────────────────

function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function computeRSI(closes: number[], period: number): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function computeATR(candles: Candle[], period: number): number[] {
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // EMA of TR
  const atr = computeEMA(tr, period);
  return atr;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Count reversals of at least minPct% in a series of candles
function countBounces(candles: Candle[], minPct: number): number {
  if (candles.length < 3) return 0;
  let bounces = 0;
  let lastExtreme = candles[0].close;
  let direction = 0; // 1 = up, -1 = down

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i].close;
    const move = (c - lastExtreme) / lastExtreme * 100;

    if (direction === 0) {
      if (Math.abs(move) >= minPct) {
        direction = move > 0 ? 1 : -1;
        lastExtreme = c;
      }
    } else if (direction === 1) {
      if (c > lastExtreme) lastExtreme = c;
      else if ((lastExtreme - c) / lastExtreme * 100 >= minPct) {
        bounces++;
        direction = -1;
        lastExtreme = c;
      }
    } else {
      if (c < lastExtreme) lastExtreme = c;
      else if ((c - lastExtreme) / lastExtreme * 100 >= minPct) {
        bounces++;
        direction = 1;
        lastExtreme = c;
      }
    }
  }
  return bounces;
}

function avgWickRatio(candles: Candle[]): number {
  if (candles.length === 0) return 1;
  let sum = 0;
  for (const c of candles) {
    const body = Math.abs(c.open - c.close);
    const range = c.high - c.low;
    sum += body > 0.0001 ? range / body : 1;
  }
  return sum / candles.length;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  const pair = process.argv[2] || "RIVERUSDT";
  console.log(`\nXWAVE OVERLAY STUDY — ${pair}\n`);

  // Load trades
  const allTrades = parseXwaveExport(
    path.resolve(process.cwd(), "bybit-exports/gui-pull-xwave.xlsx")
  );
  const trades = allTrades.filter(t => t.pair === pair);
  console.log(`Trades: ${trades.length}`);

  // Load candles
  let candles: Candle[];
  const fullPath = path.resolve(process.cwd(), `data/${pair}_5_full.json`);
  if (fs.existsSync(fullPath)) {
    candles = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  } else {
    candles = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), `data/${pair}_5.json`), "utf-8")
    );
  }
  console.log(`Candles: ${candles.length}`);

  // Trim candles to xwave period with some lookback for indicators
  const tradeTimestamps = trades.map(t => t.openedAt).filter(t => t > 0);
  const periodStart = Math.min(...tradeTimestamps) - 24 * 3600000; // 24h before first trade for indicator warmup
  const periodEnd = Math.max(...tradeTimestamps) + 4 * 3600000;
  const periodCandles = candles.filter(c => c.timestamp >= periodStart && c.timestamp <= periodEnd);
  console.log(`Period candles: ${periodCandles.length}`);

  if (periodCandles.length < 200) {
    console.log("Not enough candles for analysis");
    return;
  }

  // Precompute indicators on full period candles
  const closes = periodCandles.map(c => c.close);
  const ema50 = computeEMA(closes, 50);
  const ema200 = computeEMA(closes, 200);
  const rsi14 = computeRSI(closes, 14);
  const atr14 = computeATR(periodCandles, 14);

  // Build candle index by timestamp for fast lookup
  const candleIdx = new Map<number, number>();
  for (let i = 0; i < periodCandles.length; i++) {
    candleIdx.set(periodCandles[i].timestamp, i);
  }

  // Find candle index closest to a timestamp
  function findCandleIdx(ts: number): number {
    // Binary search for nearest candle
    let lo = 0, hi = periodCandles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (periodCandles[mid].timestamp < ts) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Build 30-minute windows
  const windowStart = Math.min(...tradeTimestamps);
  const windowEnd = Math.max(...tradeTimestamps);
  const windows: WindowState[] = [];

  for (let wTs = Math.floor(windowStart / WINDOW_MS) * WINDOW_MS; wTs <= windowEnd; wTs += WINDOW_MS) {
    const wEnd = wTs + WINDOW_MS;

    // Count xwave activity in this window
    const opened = trades.filter(t => t.openedAt >= wTs && t.openedAt < wEnd);
    const closed = trades.filter(t => t.closedAt >= wTs && t.closedAt < wEnd);
    const notionalOpened = opened.reduce((s, t) => s + t.qty * t.entryPrice, 0);

    // Count new anchors (trades with no other trade at same entry price opened before this window)
    const anchorPrices = new Set(opened.map(t => t.entryPrice));
    const priorPrices = new Set(
      trades.filter(t => t.openedAt < wTs && t.openedAt >= wTs - 4 * 3600000)
        .map(t => t.entryPrice)
    );
    let batchesStarted = 0;
    for (const p of anchorPrices) {
      if (!priorPrices.has(p)) batchesStarted++;
    }

    // Activity level
    let activity: "heavy" | "light" | "idle" = "idle";
    if (opened.length >= 5 || notionalOpened > 500) activity = "heavy";
    else if (opened.length >= 1) activity = "light";

    // Market state at window start
    const ci = findCandleIdx(wTs);
    if (ci < 200) continue; // need warmup

    const c = periodCandles[ci];

    // Realized vol: std of 5m returns over lookback
    const returns1h = [];
    for (let j = Math.max(0, ci - 12); j < ci; j++) {
      returns1h.push((periodCandles[j + 1].close - periodCandles[j].close) / periodCandles[j].close);
    }
    const vol1h = stddev(returns1h) * 100;

    const returns4h = [];
    for (let j = Math.max(0, ci - 48); j < ci; j++) {
      returns4h.push((periodCandles[j + 1].close - periodCandles[j].close) / periodCandles[j].close);
    }
    const vol4h = stddev(returns4h) * 100;

    // 24h high
    let high24h = 0;
    for (let j = Math.max(0, ci - 288); j <= ci; j++) {
      if (periodCandles[j].high > high24h) high24h = periodCandles[j].high;
    }
    const drawdownFrom24hHigh = ((high24h - c.close) / high24h) * 100;

    // Bounce count
    const candles1h = periodCandles.slice(Math.max(0, ci - 12), ci + 1);
    const candles4h = periodCandles.slice(Math.max(0, ci - 48), ci + 1);
    const bounceCount1h = countBounces(candles1h, 0.3);
    const bounceCount4h = countBounces(candles4h, 0.3);

    // Wick ratio
    const wickRatio1h = avgWickRatio(candles1h);

    // Forward hit rate: does price reach +0.7% within next 2h (24 candles)?
    let fwdHitRate = 0;
    const target = c.close * 1.007;
    for (let j = ci + 1; j < Math.min(ci + 24, periodCandles.length); j++) {
      if (periodCandles[j].high >= target) {
        fwdHitRate = 1;
        break;
      }
    }

    windows.push({
      timestamp: wTs,
      tradesOpened: opened.length,
      tradesClosed: closed.length,
      notionalOpened,
      batchesStarted,
      activity,
      close: c.close,
      ema50: ema50[ci],
      ema200: ema200[ci],
      emaRatio: c.close / ema200[ci],
      rsi14: rsi14[ci],
      atr14pct: (atr14[ci] / c.close) * 100,
      vol1h,
      vol4h,
      drawdownFrom24hHigh,
      bounceCount1h,
      bounceCount4h,
      wickRatio1h,
      fwdHitRate,
    });
  }

  console.log(`Windows analyzed: ${windows.length}`);
  const heavy = windows.filter(w => w.activity === "heavy");
  const light = windows.filter(w => w.activity === "light");
  const idle = windows.filter(w => w.activity === "idle");
  console.log(`Heavy: ${heavy.length} | Light: ${light.length} | Idle: ${idle.length}\n`);

  // ── Compute averages per activity level ──
  const indicators = [
    "emaRatio", "rsi14", "atr14pct", "vol1h", "vol4h",
    "drawdownFrom24hHigh", "bounceCount1h", "bounceCount4h",
    "wickRatio1h", "fwdHitRate",
  ] as const;

  function avg(arr: WindowState[], key: keyof WindowState): number {
    const vals = arr.map(w => w[key] as number).filter(v => !isNaN(v));
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }

  function med(arr: WindowState[], key: keyof WindowState): number {
    const vals = arr.map(w => w[key] as number).filter(v => !isNaN(v)).sort((a, b) => a - b);
    return vals.length > 0 ? vals[Math.floor(vals.length / 2)] : 0;
  }

  console.log("═".repeat(95));
  console.log("  INDICATOR AVERAGES BY ACTIVITY LEVEL");
  console.log("═".repeat(95));
  console.log("");
  console.log(
    "Indicator".padEnd(25) +
    "Heavy (avg)".padStart(12) +
    "Light (avg)".padStart(12) +
    "Idle (avg)".padStart(12) +
    "  │ " +
    "Heavy (med)".padStart(12) +
    "Light (med)".padStart(12) +
    "Idle (med)".padStart(12)
  );
  console.log("─".repeat(95));

  for (const ind of indicators) {
    const ha = avg(heavy, ind), la = avg(light, ind), ia = avg(idle, ind);
    const hm = med(heavy, ind), lm = med(light, ind), im = med(idle, ind);
    console.log(
      ind.padEnd(25) +
      ha.toFixed(4).padStart(12) +
      la.toFixed(4).padStart(12) +
      ia.toFixed(4).padStart(12) +
      "  │ " +
      hm.toFixed(4).padStart(12) +
      lm.toFixed(4).padStart(12) +
      im.toFixed(4).padStart(12)
    );
  }

  // ── Separation analysis: which indicator best separates heavy from idle? ──
  console.log("");
  console.log("═".repeat(95));
  console.log("  SEPARATION POWER (heavy vs idle)");
  console.log("═".repeat(95));
  console.log("");

  for (const ind of indicators) {
    const hVals = heavy.map(w => w[ind] as number).sort((a, b) => a - b);
    const iVals = idle.map(w => w[ind] as number).sort((a, b) => a - b);
    if (hVals.length === 0 || iVals.length === 0) continue;

    const hMed = hVals[Math.floor(hVals.length / 2)];
    const iMed = iVals[Math.floor(iVals.length / 2)];

    // Effect size: difference in medians / pooled std
    const allVals = [...hVals, ...iVals];
    const pooledStd = stddev(allVals);
    const effectSize = pooledStd > 0 ? Math.abs(hMed - iMed) / pooledStd : 0;

    // Direction
    const dir = hMed > iMed ? "heavy HIGHER" : "heavy LOWER";

    console.log(
      `${ind.padEnd(25)} effect: ${effectSize.toFixed(3).padStart(6)} | ${dir.padEnd(15)} | heavy med: ${hMed.toFixed(4)} | idle med: ${iMed.toFixed(4)}`
    );
  }

  // ── Threshold analysis: find cutoffs that best separate active from idle ──
  console.log("");
  console.log("═".repeat(95));
  console.log("  THRESHOLD ANALYSIS");
  console.log("═".repeat(95));
  console.log("");

  const activeWindows = windows.filter(w => w.activity !== "idle");
  const idleWindows = windows.filter(w => w.activity === "idle");

  for (const ind of indicators) {
    const allVals = windows.map(w => w[ind] as number).sort((a, b) => a - b);
    const percentiles = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90];

    let bestF1 = 0, bestThresh = 0, bestDir = ">" as ">" | "<";

    for (const pct of percentiles) {
      const thresh = allVals[Math.floor(allVals.length * pct / 100)];

      // Try "active when indicator > thresh"
      const tpGt = activeWindows.filter(w => (w[ind] as number) > thresh).length;
      const fpGt = idleWindows.filter(w => (w[ind] as number) > thresh).length;
      const fnGt = activeWindows.filter(w => (w[ind] as number) <= thresh).length;
      const precGt = tpGt + fpGt > 0 ? tpGt / (tpGt + fpGt) : 0;
      const recGt = tpGt + fnGt > 0 ? tpGt / (tpGt + fnGt) : 0;
      const f1Gt = precGt + recGt > 0 ? 2 * precGt * recGt / (precGt + recGt) : 0;

      // Try "active when indicator < thresh"
      const tpLt = activeWindows.filter(w => (w[ind] as number) < thresh).length;
      const fpLt = idleWindows.filter(w => (w[ind] as number) < thresh).length;
      const fnLt = activeWindows.filter(w => (w[ind] as number) >= thresh).length;
      const precLt = tpLt + fpLt > 0 ? tpLt / (tpLt + fpLt) : 0;
      const recLt = tpLt + fnLt > 0 ? tpLt / (tpLt + fnLt) : 0;
      const f1Lt = precLt + recLt > 0 ? 2 * precLt * recLt / (precLt + recLt) : 0;

      if (f1Gt > bestF1) { bestF1 = f1Gt; bestThresh = thresh; bestDir = ">"; }
      if (f1Lt > bestF1) { bestF1 = f1Lt; bestThresh = thresh; bestDir = "<"; }
    }

    if (bestF1 > 0) {
      // Compute precision/recall at best threshold
      const tp = activeWindows.filter(w =>
        bestDir === ">" ? (w[ind] as number) > bestThresh : (w[ind] as number) < bestThresh
      ).length;
      const fp = idleWindows.filter(w =>
        bestDir === ">" ? (w[ind] as number) > bestThresh : (w[ind] as number) < bestThresh
      ).length;
      const fn = activeWindows.length - tp;
      const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
      const rec = tp + fn > 0 ? tp / (tp + fn) : 0;

      console.log(
        `${ind.padEnd(25)} best: ${bestDir} ${bestThresh.toFixed(4).padStart(8)} | F1: ${bestF1.toFixed(3)} | prec: ${prec.toFixed(2)} rec: ${rec.toFixed(2)} | TP:${tp} FP:${fp} FN:${fn}`
      );
    }
  }

  // ── Time-of-day analysis ──
  console.log("");
  console.log("═".repeat(95));
  console.log("  TIME-OF-DAY ACTIVITY");
  console.log("═".repeat(95));
  console.log("");

  const hourActivity: Record<number, { heavy: number; light: number; idle: number; total: number }> = {};
  for (let h = 0; h < 24; h++) hourActivity[h] = { heavy: 0, light: 0, idle: 0, total: 0 };

  for (const w of windows) {
    const h = new Date(w.timestamp).getUTCHours();
    hourActivity[h][w.activity]++;
    hourActivity[h].total++;
  }

  console.log("Hour (UTC) | Heavy | Light | Idle  | Active%");
  console.log("─".repeat(50));
  for (let h = 0; h < 24; h++) {
    const a = hourActivity[h];
    const activePct = a.total > 0 ? ((a.heavy + a.light) / a.total * 100) : 0;
    const bar = "█".repeat(Math.round(activePct / 2));
    console.log(
      `${String(h).padStart(2)}:00      | ${String(a.heavy).padStart(5)} | ${String(a.light).padStart(5)} | ${String(a.idle).padStart(5)} | ${activePct.toFixed(0).padStart(3)}% ${bar}`
    );
  }

  // ── Forward hit rate validation ──
  console.log("");
  console.log("═".repeat(95));
  console.log("  FORWARD +0.7% HIT RATE BY ACTIVITY");
  console.log("═".repeat(95));
  console.log("");

  const hHit = avg(heavy, "fwdHitRate");
  const lHit = avg(light, "fwdHitRate");
  const iHit = avg(idle, "fwdHitRate");
  console.log(`Heavy windows: ${(hHit * 100).toFixed(1)}% of the time, +0.7% was reachable within 2h`);
  console.log(`Light windows: ${(lHit * 100).toFixed(1)}%`);
  console.log(`Idle windows:  ${(iHit * 100).toFixed(1)}%`);
  console.log("");
  console.log("If heavy >> idle, xwave is selecting windows where bounces actually happen.");
  console.log("If they're similar, participation is driven by something other than bounce probability.");
}

main();
