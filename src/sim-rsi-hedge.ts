import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// RSI-triggered short hedge on 11 max longs
// When RSI hits extreme overbought, open short ladder
// ─────────────────────────────────────────────

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  // Short hedge
  hedgeEnabled: boolean;
  hedgeRsiTrigger: number;     // RSI threshold to start shorting
  hedgeRsiExit: number;        // RSI threshold to stop shorting / close shorts
  hedgeMaxPositions: number;
  hedgeTpPct: number;
  hedgeBasePosUsdt: number;
  hedgeAddInterval: number;
  hedgeScaleFactor: number;
  hedgeStaleHours: number;
  hedgeReducedTpPct: number;
  hedgeKillPct: number;
  rsiPeriod: number;           // RSI lookback (in 4h bars)
  rsiTimeframe: number;        // bar size in ms for RSI calc
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

// Build RSI from candles at a given timeframe
function buildRsi(candles: Candle[], period: number, barSizeMs: number) {
  // First aggregate into bars
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / barSizeMs);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
      curBar = bar;
    }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });

  // Compute RSI
  const rsiMap = new Map<number, number>();
  if (bars.length < period + 1) return rsiMap;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < bars.length; i++) {
    if (i > period) {
      const diff = bars[i].close - bars[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    // Map to the bar's timestamp bucket
    rsiMap.set(Math.floor(bars[i].ts / barSizeMs) * barSizeMs, rsi);
  }
  return rsiMap;
}

interface Stats {
  finalEq: number; maxDD: number; minEq: number; returnPct: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  hedgeTPs: number; hedgeStales: number; hedgeKills: number;
  hedgeActivations: number; hedgeGrossPnl: number;
}

function run(candles: Candle[], cfg: Cfg, rsiMap: Map<number, number>): Stats {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const longs: { ep: number; et: number; qty: number; notional: number }[] = [];
  const shorts: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastLongAdd = 0, lastShortAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();

  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let hedgeTPs = 0, hedgeStales = 0, hedgeKills = 0;
  let hedgeActivations = 0, hedgeGrossPnl = 0;
  let hedgeActive = false;
  let minEq = capital, maxDD = 0;

  function closeLongs(price: number, ts: number) {
    let netPnl = 0;
    for (const p of longs) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      netPnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    longs.length = 0;
    return netPnl;
  }

  function closeShorts(price: number, ts: number) {
    let netPnl = 0;
    for (const p of shorts) {
      const raw = (p.ep - price) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      netPnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    hedgeGrossPnl += netPnl;
    shorts.length = 0;
    return netPnl;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Get current RSI
    const barBucket = Math.floor(ts / cfg.rsiTimeframe) * cfg.rsiTimeframe;
    // Use previous bar's RSI (confirmed, no lookahead)
    const prevBucket = barBucket - cfg.rsiTimeframe;
    const rsi = rsiMap.get(prevBucket) ?? 50;

    // Equity
    const longUr = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const shortUr = shorts.reduce((s, p) => s + (p.ep - close) * p.qty, 0);
    const eq = capital + longUr + shortUr;
    if (eq > peakEq) peakEq = eq;
    if (eq < minEq) minEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // RSI hedge activation
    if (cfg.hedgeEnabled) {
      if (!hedgeActive && rsi >= cfg.hedgeRsiTrigger) {
        hedgeActive = true;
        hedgeActivations++;
      } else if (hedgeActive && rsi <= cfg.hedgeRsiExit) {
        hedgeActive = false;
        if (shorts.length > 0) closeShorts(close, ts);
      }
    }

    // ── Long exits ──
    if (longs.length > 0) {
      const tQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgE = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;
      const oldH = (ts - longs[0].et) / 3600000;
      const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
      const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tp / 100);

      if (high >= tpPrice) {
        closeLongs(tpPrice, ts);
        if (isStale) longStales++; else longTPs++;
        if (shorts.length > 0) closeShorts(close, ts);
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
        closeLongs(close, ts); longKills++; continue;
      }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
        closeLongs(close, ts); longFlats++; continue;
      }
    }

    // ── Short exits ──
    if (shorts.length > 0) {
      const tQty = shorts.reduce((s, p) => s + p.qty, 0);
      const avgE = shorts.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((avgE - close) / avgE) * 100;
      const oldH = (ts - shorts[0].et) / 3600000;
      const isStale = cfg.hedgeStaleHours > 0 && oldH >= cfg.hedgeStaleHours && avgPnl < 0;
      const tp = isStale ? cfg.hedgeReducedTpPct : cfg.hedgeTpPct;
      const tpPrice = avgE * (1 - tp / 100);

      if (low <= tpPrice) {
        closeShorts(tpPrice, ts);
        if (isStale) hedgeStales++; else hedgeTPs++;
        continue;
      }
      if (cfg.hedgeKillPct !== 0 && avgPnl <= -cfg.hedgeKillPct) {
        closeShorts(close, ts); hedgeKills++; continue;
      }
    }

    // ── Long entries ──
    const longGap = (ts - lastLongAdd) / 60000;
    if (longs.length < cfg.maxPositions && longGap >= cfg.addIntervalMin) {
      if (!isHostile(gate, ts)) {
        const lvl = longs.length;
        const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const longMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        const shortMargin = shorts.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - longMargin - shortMargin >= margin && capital > 0) {
          longs.push({ ep: close, et: ts, qty: notional / close, notional });
          lastLongAdd = ts;
        }
      }
    }

    // ── Short entries (RSI triggered) ──
    if (cfg.hedgeEnabled && hedgeActive) {
      const shortGap = (ts - lastShortAdd) / 60000;
      if (shorts.length < cfg.hedgeMaxPositions && shortGap >= cfg.hedgeAddInterval) {
        const lvl = shorts.length;
        const notional = cfg.hedgeBasePosUsdt * Math.pow(cfg.hedgeScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const longMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        const shortMargin = shorts.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - longMargin - shortMargin >= margin && capital > 0) {
          shorts.push({ ep: close, et: ts, qty: notional / close, notional });
          lastShortAdd = ts;
        }
      }
    }
  }

  if (longs.length > 0) closeLongs(candles[candles.length - 1].close, candles[candles.length - 1].timestamp);
  if (shorts.length > 0) closeShorts(candles[candles.length - 1].close, candles[candles.length - 1].timestamp);

  return {
    finalEq: capital, maxDD, minEq, returnPct: (capital / cfg.initialCapital - 1) * 100,
    longTPs, longStales, longKills, longFlats,
    hedgeTPs, hedgeStales, hedgeKills,
    hedgeActivations, hedgeGrossPnl,
  };
}

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// ════════════════════════════════════════════
// PART 0: RSI distribution — what values does HYPE actually hit?
// ════════════════════════════════════════════

console.log("=".repeat(110));
console.log("  RSI DISTRIBUTION — HYPE 4h bars, 14-period RSI");
console.log("=".repeat(110));

const rsi4h14 = buildRsi(candles, 14, 4 * 3600000);
const allRsi = Array.from(rsi4h14.values());
allRsi.sort((a, b) => a - b);

const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 100];
console.log(`\n  Total 4h RSI readings: ${allRsi.length}`);
console.log(`  Min: ${allRsi[0]?.toFixed(1)}  Max: ${allRsi[allRsi.length - 1]?.toFixed(1)}  Median: ${allRsi[Math.floor(allRsi.length / 2)]?.toFixed(1)}`);
console.log(`\n  RSI Range     Count    %      Cumulative%`);
console.log("  " + "-".repeat(55));
let cumul = 0;
for (let i = 0; i < buckets.length - 1; i++) {
  const lo = buckets[i], hi = buckets[i + 1];
  const cnt = allRsi.filter(r => r >= lo && r < hi).length;
  cumul += cnt;
  const pct = (cnt / allRsi.length * 100).toFixed(1);
  const cpct = (cumul / allRsi.length * 100).toFixed(1);
  const bar = "█".repeat(Math.floor(cnt / 3));
  console.log(`  ${String(lo).padStart(3)}-${String(hi).padStart(3)}     ${String(cnt).padStart(5)}  ${pct.padStart(5)}%  ${cpct.padStart(6)}%  ${bar}`);
}

// Top RSI readings
console.log(`\n  How many 4h bars had RSI above key thresholds:`);
for (const thresh of [70, 75, 80, 85, 90, 95]) {
  const cnt = allRsi.filter(r => r >= thresh).length;
  console.log(`  RSI >= ${thresh}: ${cnt} bars (${(cnt / allRsi.length * 100).toFixed(1)}%)`);
}

// ════════════════════════════════════════════
// PART 1: RSI-triggered short hedge sweep — full history
// ════════════════════════════════════════════

const base: Omit<Cfg, "label"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2024-12-06",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
  hedgeEnabled: false,
  hedgeRsiTrigger: 85, hedgeRsiExit: 50,
  hedgeMaxPositions: 5, hedgeTpPct: 1.0, hedgeBasePosUsdt: 400,
  hedgeAddInterval: 30, hedgeScaleFactor: 1.2,
  hedgeStaleHours: 6, hedgeReducedTpPct: 0.3, hedgeKillPct: 10,
  rsiPeriod: 14, rsiTimeframe: 4 * 3600000,
};

// Build RSI maps for different timeframes
const rsi4h = buildRsi(candles, 14, 4 * 3600000);
const rsi1h = buildRsi(candles, 14, 3600000);

function printRow(label: string, s: Stats, hedgeOn: boolean) {
  const hi = hedgeOn
    ? `${String(s.hedgeTPs + s.hedgeStales).padStart(7)} ${String(s.hedgeKills).padStart(6)} ${String(s.hedgeActivations).padStart(5)}  $${s.hedgeGrossPnl.toFixed(0).padStart(7)}`
    : `    n/a    n/a   n/a      n/a`;
  console.log(`  ${label.padEnd(46)} $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)} ${hi}`);
}

console.log("\n\n" + "=".repeat(110));
console.log("  PART 1: RSI-TRIGGERED SHORT HEDGE — 11 longs, $15K, full history");
console.log("  Short when 4h RSI crosses overbought, close when RSI drops below exit");
console.log("=".repeat(110));
console.log(`\n  Config                                        Final Eq  Return   MaxDD%  MinEq   HdgTPs HdgKil Acts  HedgePnL`);
console.log("  " + "-".repeat(110));

const tests: { label: string; ov: Partial<Cfg> }[] = [
  { label: "Baseline: 11L, no hedge", ov: { hedgeEnabled: false } },
  // RSI trigger sweep (4h RSI)
  { label: "RSI>70 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 70, hedgeRsiExit: 50 } },
  { label: "RSI>75 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 75, hedgeRsiExit: 50 } },
  { label: "RSI>80 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50 } },
  { label: "RSI>85 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 85, hedgeRsiExit: 50 } },
  { label: "RSI>90 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 90, hedgeRsiExit: 50 } },
  { label: "RSI>95 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 95, hedgeRsiExit: 50 } },
  // Exit threshold sweep
  { label: "RSI>80 exit<40, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 40 } },
  { label: "RSI>80 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50 } },
  { label: "RSI>80 exit<60, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 60 } },
  { label: "RSI>80 exit<70, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 70 } },
  // Hedge TP sweep at best RSI threshold
  { label: "RSI>80 exit<50, 5S TP0.5%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeTpPct: 0.5 } },
  { label: "RSI>80 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeTpPct: 1.0 } },
  { label: "RSI>80 exit<50, 5S TP1.4%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeTpPct: 1.4 } },
  { label: "RSI>80 exit<50, 5S TP2.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeTpPct: 2.0 } },
  // Max short positions sweep
  { label: "RSI>80 exit<50, 3S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeMaxPositions: 3 } },
  { label: "RSI>80 exit<50, 5S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeMaxPositions: 5 } },
  { label: "RSI>80 exit<50, 7S TP1.0%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeMaxPositions: 7 } },
  // Hedge base size sweep
  { label: "RSI>80, 5S $200 base", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeBasePosUsdt: 200 } },
  { label: "RSI>80, 5S $400 base", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeBasePosUsdt: 400 } },
  { label: "RSI>80, 5S $600 base", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeBasePosUsdt: 600 } },
  { label: "RSI>80, 5S $800 base", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeBasePosUsdt: 800 } },
  // Kill % sweep
  { label: "RSI>80, 5S kill@5%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeKillPct: 5 } },
  { label: "RSI>80, 5S kill@10%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeKillPct: 10 } },
  { label: "RSI>80, 5S kill@15%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeKillPct: 15 } },
  { label: "RSI>80, 5S no kill", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeKillPct: 0 } },
];

for (const t of tests) {
  const cfg: Cfg = { ...base, label: t.label, ...t.ov };
  const rsiMap = cfg.rsiTimeframe === 3600000 ? rsi1h : rsi4h;
  const s = run(candles, cfg, rsiMap);
  printRow(t.label, s, cfg.hedgeEnabled);
}

// ════════════════════════════════════════════
// PART 2: 1h RSI vs 4h RSI comparison
// ════════════════════════════════════════════

console.log("\n\n" + "=".repeat(110));
console.log("  PART 2: 1h RSI vs 4h RSI — best configs from above");
console.log("=".repeat(110));
console.log(`\n  Config                                        Final Eq  Return   MaxDD%  MinEq   HdgTPs HdgKil Acts  HedgePnL`);
console.log("  " + "-".repeat(110));

for (const tf of [{ label: "4h", ms: 4 * 3600000 }, { label: "1h", ms: 3600000 }]) {
  for (const trigger of [75, 80, 85, 90]) {
    const lbl = `${tf.label} RSI>${trigger} exit<50, 5S TP1.0%`;
    const rsiMap = tf.ms === 3600000 ? rsi1h : rsi4h;
    const cfg: Cfg = { ...base, label: lbl, hedgeEnabled: true, hedgeRsiTrigger: trigger, hedgeRsiExit: 50, rsiTimeframe: tf.ms };
    const s = run(candles, cfg, rsiMap);
    printRow(lbl, s, true);
  }
}

// ════════════════════════════════════════════
// PART 3: July 2025 start (your realistic window)
// ════════════════════════════════════════════

console.log("\n\n" + "=".repeat(110));
console.log("  PART 3: JULY 2025 START — RSI hedge on realistic window");
console.log("=".repeat(110));
console.log(`\n  Config                                        Final Eq  Return   MaxDD%  MinEq   HdgTPs HdgKil Acts  HedgePnL`);
console.log("  " + "-".repeat(110));

const julyTests: { label: string; ov: Partial<Cfg> }[] = [
  { label: "Baseline: 11L no hedge", ov: { hedgeEnabled: false, startDate: "2025-07-01" } },
  { label: "RSI>75 exit<50, 5S", ov: { hedgeEnabled: true, hedgeRsiTrigger: 75, hedgeRsiExit: 50, startDate: "2025-07-01" } },
  { label: "RSI>80 exit<50, 5S", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, startDate: "2025-07-01" } },
  { label: "RSI>85 exit<50, 5S", ov: { hedgeEnabled: true, hedgeRsiTrigger: 85, hedgeRsiExit: 50, startDate: "2025-07-01" } },
  { label: "RSI>90 exit<50, 5S", ov: { hedgeEnabled: true, hedgeRsiTrigger: 90, hedgeRsiExit: 50, startDate: "2025-07-01" } },
  { label: "RSI>80 exit<50, 5S TP1.4%", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeTpPct: 1.4, startDate: "2025-07-01" } },
  { label: "RSI>80 exit<50, 7S $600", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 50, hedgeMaxPositions: 7, hedgeBasePosUsdt: 600, startDate: "2025-07-01" } },
  { label: "RSI>80 exit<60, 5S", ov: { hedgeEnabled: true, hedgeRsiTrigger: 80, hedgeRsiExit: 60, startDate: "2025-07-01" } },
];

for (const t of julyTests) {
  const cfg: Cfg = { ...base, label: t.label, ...t.ov };
  const s = run(candles, cfg, rsi4h);
  printRow(t.label, s, cfg.hedgeEnabled);
}
