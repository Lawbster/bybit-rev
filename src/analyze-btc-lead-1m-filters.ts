// BTC 0.5% surge → Long HYPE: ALL signals vs filtered by "surprise" indicators
// Tests: no filter, RSI low, prior move negative, low vol before, ATR compression

import fs from "fs";
import { RSI, EMA, ATR } from "technicalindicators";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

console.log("Loading 1m data...");
const btc1m: Candle[]  = JSON.parse(fs.readFileSync("data/vps/BTCUSDT_1_full.json", "utf-8"));
const hype1m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_1.json", "utf-8"));

const btcIdx  = new Map<number, number>();
const hypeIdx = new Map<number, number>();
btc1m.forEach((c, i)  => btcIdx.set(c.timestamp, i));
hype1m.forEach((c, i) => hypeIdx.set(c.timestamp, i));

// Precompute BTC RSI on 5m aggregated bars (14-period)
console.log("Computing indicators...");

// Aggregate BTC to 5m for RSI
function agg5m(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  const p = 300000;
  for (const c of candles) {
    const k = Math.floor(c.timestamp / p) * p;
    const e = map.get(k);
    if (!e) map.set(k, { ...c, timestamp: k });
    else { if (c.high > e.high) e.high = c.high; if (c.low < e.low) e.low = c.low; e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function agg15m(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  const p = 900000;
  for (const c of candles) {
    const k = Math.floor(c.timestamp / p) * p;
    const e = map.get(k);
    if (!e) map.set(k, { ...c, timestamp: k });
    else { if (c.high > e.high) e.high = c.high; if (c.low < e.low) e.low = c.low; e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

const btc5m = agg5m(btc1m);
const btc15m = agg15m(btc1m);
const hype5m = agg5m(hype1m);

// RSI maps
function makeRsiMap(candles: Candle[], period: number): Map<number, number> {
  const vals = RSI.calculate({ values: candles.map(c => c.close), period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period].timestamp, vals[i]);
  return m;
}

const btcRsi5m = makeRsiMap(btc5m, 14);
const btcRsi15m = makeRsiMap(btc15m, 14);
const hypeRsi5m = makeRsiMap(hype5m, 14);

// ATR for vol compression
function makeAtrMap(candles: Candle[], period: number): Map<number, number> {
  const vals = ATR.calculate({ high: candles.map(c => c.high), low: candles.map(c => c.low), close: candles.map(c => c.close), period });
  const m = new Map<number, number>();
  for (let i = 0; i < vals.length; i++) m.set(candles[i + period].timestamp, vals[i]);
  return m;
}

const btcAtr5m = makeAtrMap(btc5m, 14);

// Nearest lookup
function nearest(map: Map<number, number>, ts: number): number | null {
  // Snap to 5m or 15m boundary and check
  for (const snap of [300000, 900000]) {
    const k = Math.floor(ts / snap) * snap;
    if (map.has(k)) return map.get(k)!;
    if (map.has(k - snap)) return map.get(k - snap)!;
  }
  return null;
}

const THRESH = 0.5;
const COOLDOWN = 10;
const SEP = "═".repeat(130);
const DIV = "─".repeat(130);

// Collect ALL signals
interface Signal {
  ts: number;
  btcMove: number;
  hypeEntry: number;
  hypeSameBarMove: number;
  // Context
  btcPrior5m: number;
  btcPrior15m: number;
  btcRsi5m: number | null;
  btcRsi15m: number | null;
  hypeRsi5m: number | null;
  btcVolRatio: number;
  btcAtrRatio: number | null; // current ATR vs 50-bar median
  // Outcomes with TP/SL
  outcomes: Map<string, { pnl: number; hit: string }>; // "tp0.5_sl0.3" → result
}

console.log("Scanning signals...");
const signals: Signal[] = [];
let lastIdx = -COOLDOWN;

for (let i = 15; i < btc1m.length; i++) {
  const bar = btc1m[i];
  const move = (bar.close - bar.open) / bar.open * 100;
  if (move < THRESH) continue;
  if (i - lastIdx < COOLDOWN) continue;
  lastIdx = i;

  const hypeI = hypeIdx.get(bar.timestamp);
  if (hypeI === undefined || hypeI + 31 >= hype1m.length) continue;

  const hypeSame = hype1m[hypeI];
  const hypeSameMove = (hypeSame.close - hypeSame.open) / hypeSame.open * 100;
  const entry = hype1m[hypeI + 1].open;

  // Context
  const btcPrior5m = i >= 5 ? (btc1m[i].open - btc1m[i - 5].open) / btc1m[i - 5].open * 100 : 0;
  const btcPrior15m = i >= 15 ? (btc1m[i].open - btc1m[i - 15].open) / btc1m[i - 15].open * 100 : 0;
  const rsi5 = nearest(btcRsi5m, bar.timestamp);
  const rsi15 = nearest(btcRsi15m, bar.timestamp);
  const hRsi5 = nearest(hypeRsi5m, bar.timestamp);

  let volSum = 0;
  for (let j = i - 5; j < i; j++) volSum += btc1m[j].turnover;
  const volRatio = volSum > 0 ? bar.turnover / (volSum / 5) : 1;

  // ATR compression: is current 5m ATR below median of last 50 bars?
  const atr = nearest(btcAtr5m, bar.timestamp);
  let atrRatio: number | null = null;
  if (atr !== null) {
    // Compare to 50-bar rolling median ATR (approximate with recent bars)
    const snap = Math.floor(bar.timestamp / 300000) * 300000;
    const atrs: number[] = [];
    for (let t = snap - 50 * 300000; t < snap; t += 300000) {
      const v = btcAtr5m.get(t);
      if (v) atrs.push(v);
    }
    if (atrs.length > 10) {
      const medianAtr = [...atrs].sort((a, b) => a - b)[Math.floor(atrs.length / 2)];
      atrRatio = atr / medianAtr;
    }
  }

  // Simulate TP/SL combos
  const outcomes = new Map<string, { pnl: number; hit: string }>();
  const tpLevels = [0.5, 0.75, 1.0, 1.5];
  const slLevels = [0.3, 0.5, 0.75, 1.0];

  for (const tp of tpLevels) {
    for (const sl of slLevels) {
      let hit = "expiry";
      let pnl = 0;
      for (let m = 0; m < 30; m++) {
        const j = hypeI + 1 + m;
        if (j >= hype1m.length) break;
        const lo = (hype1m[j].low - entry) / entry * 100;
        const hi = (hype1m[j].high - entry) / entry * 100;
        if (lo <= -sl) { hit = "stop"; pnl = -sl; break; }
        if (hi >= tp) { hit = "tp"; pnl = tp; break; }
      }
      if (hit === "expiry") {
        const exitI = Math.min(hypeI + 31, hype1m.length - 1);
        pnl = (hype1m[exitI].close - entry) / entry * 100;
      }
      outcomes.set(`${tp}_${sl}`, { pnl, hit });
    }
  }

  signals.push({
    ts: bar.timestamp, btcMove: move, hypeEntry: entry, hypeSameBarMove: hypeSameMove,
    btcPrior5m, btcPrior15m, btcRsi5m: rsi5, btcRsi15m: rsi15, hypeRsi5m: hRsi5,
    btcVolRatio: volRatio, btcAtrRatio: atrRatio, outcomes,
  });
}

console.log(`Total signals: ${signals.length}\n`);

// ── Print results for a filter ──
function printFilter(label: string, group: Signal[]) {
  if (group.length === 0) return;

  console.log(`\n  ── ${label}: ${group.length} signals ──`);
  console.log(`  ${"TP/SL".padEnd(12)} ${"WR".padStart(6)} ${"AvgPnl".padStart(9)} ${"PF".padStart(6)} ${"TPs".padStart(5)} ${"Stops".padStart(6)} ${"Exp".padStart(5)} ${"$Net@3k".padStart(9)} ${"$Net@10k".padStart(10)}`);

  const combos = [
    [0.5, 0.3], [0.5, 0.5], [0.75, 0.3], [0.75, 0.5], [0.75, 0.75],
    [1.0, 0.5], [1.0, 0.75], [1.0, 1.0], [1.5, 0.75], [1.5, 1.0],
  ];

  for (const [tp, sl] of combos) {
    const key = `${tp}_${sl}`;
    let tps = 0, stops = 0, exps = 0, totalPnl = 0;
    for (const s of group) {
      const o = s.outcomes.get(key)!;
      totalPnl += o.pnl;
      if (o.hit === "tp") tps++;
      else if (o.hit === "stop") stops++;
      else exps++;
    }
    const wr = tps / group.length * 100;
    const avg = totalPnl / group.length;
    const grossWin = tps * tp;
    const grossLoss = stops * sl;
    const pf = grossLoss > 0 ? grossWin / grossLoss : Infinity;
    const fees3k = group.length * 3000 * 0.0011;
    const fees10k = group.length * 10000 * 0.0011;
    const net3k = totalPnl / 100 * 3000 - fees3k;
    const net10k = totalPnl / 100 * 10000 - fees10k;

    console.log(`  ${(tp + "/" + sl + "%").padEnd(12)} ${(wr.toFixed(0) + "%").padStart(6)} ${((avg >= 0 ? "+" : "") + avg.toFixed(3) + "%").padStart(9)} ${pf.toFixed(2).padStart(6)} ${String(tps).padStart(5)} ${String(stops).padStart(6)} ${String(exps).padStart(5)} ${(net3k >= 0 ? "+$" : "-$") + Math.abs(net3k).toFixed(0)}${" ".repeat(Math.max(0, 8 - ((net3k >= 0 ? "+$" : "-$") + Math.abs(net3k).toFixed(0)).length))} ${(net10k >= 0 ? "+$" : "-$") + Math.abs(net10k).toFixed(0)}`);
  }
}

console.log(SEP);
console.log(`  BTC >= +0.5% (1m bar) → LONG HYPE | ALL vs FILTERED | ${signals.length} total signals`);
console.log(SEP);

// 1. No filter — every single 0.5% move
printFilter("NO FILTER (all signals)", signals);

// 2. Fresh only (HYPE didn't move in same bar)
const fresh = signals.filter(s => s.hypeSameBarMove < 0.15);
printFilter("FRESH ONLY (HYPE < 0.15% in same bar)", fresh);

// 3. BTC RSI 5m < 50 (move was against the trend — surprise)
const rsiLow50 = signals.filter(s => s.btcRsi5m !== null && s.btcRsi5m < 50);
printFilter("BTC RSI(5m) < 50 (surprise — against trend)", rsiLow50);

// 4. BTC RSI 5m < 40
const rsiLow40 = signals.filter(s => s.btcRsi5m !== null && s.btcRsi5m < 40);
printFilter("BTC RSI(5m) < 40 (strong surprise)", rsiLow40);

// 5. BTC RSI 15m < 50
const rsi15Low = signals.filter(s => s.btcRsi15m !== null && s.btcRsi15m < 50);
printFilter("BTC RSI(15m) < 50", rsi15Low);

// 6. BTC RSI 15m < 40
const rsi15Low40 = signals.filter(s => s.btcRsi15m !== null && s.btcRsi15m < 40);
printFilter("BTC RSI(15m) < 40", rsi15Low40);

// 7. HYPE RSI 5m < 50 (HYPE was weak — room to catch up)
const hypeRsiLow50 = signals.filter(s => s.hypeRsi5m !== null && s.hypeRsi5m < 50);
printFilter("HYPE RSI(5m) < 50 (HYPE was weak)", hypeRsiLow50);

// 8. HYPE RSI 5m < 40
const hypeRsiLow40 = signals.filter(s => s.hypeRsi5m !== null && s.hypeRsi5m < 40);
printFilter("HYPE RSI(5m) < 40 (HYPE very weak)", hypeRsiLow40);

// 9. BTC prior 5m was negative (V-bounce reversal)
const reversal = signals.filter(s => s.btcPrior5m < 0);
printFilter("BTC prior 5m < 0 (reversal/V-bounce)", reversal);

// 10. BTC prior 5m < -0.2% (strong reversal)
const strongReversal = signals.filter(s => s.btcPrior5m < -0.2);
printFilter("BTC prior 5m < -0.2% (strong reversal)", strongReversal);

// 11. BTC prior 15m < 0
const reversal15 = signals.filter(s => s.btcPrior15m < 0);
printFilter("BTC prior 15m < 0 (wider reversal)", reversal15);

// 12. Low vol before (compression breakout)
const lowVolBefore = signals.filter(s => s.btcVolRatio > 3);
printFilter("BTC vol spike > 3x avg (institutional)", lowVolBefore);

// 13. ATR compression (low ATR before surge)
const atrCompressed = signals.filter(s => s.btcAtrRatio !== null && s.btcAtrRatio < 0.8);
printFilter("BTC ATR compressed (< 0.8x median)", atrCompressed);

// ── Combo filters ──
// 14. Reversal + HYPE RSI low
const comboReversalHypeWeak = signals.filter(s => s.btcPrior5m < 0 && s.hypeRsi5m !== null && s.hypeRsi5m < 50);
printFilter("COMBO: BTC reversal + HYPE RSI < 50", comboReversalHypeWeak);

// 15. BTC RSI < 50 + HYPE RSI < 50
const comboBothWeak = signals.filter(s => s.btcRsi5m !== null && s.btcRsi5m < 50 && s.hypeRsi5m !== null && s.hypeRsi5m < 50);
printFilter("COMBO: BTC RSI < 50 + HYPE RSI < 50", comboBothWeak);

// 16. BTC RSI < 40 + reversal
const comboRsiReversal = signals.filter(s => s.btcRsi5m !== null && s.btcRsi5m < 40 && s.btcPrior5m < 0);
printFilter("COMBO: BTC RSI < 40 + reversal", comboRsiReversal);

// 17. Strong reversal + HYPE RSI < 40
const comboStrongRevHypeWeak = signals.filter(s => s.btcPrior5m < -0.2 && s.hypeRsi5m !== null && s.hypeRsi5m < 40);
printFilter("COMBO: BTC reversal > -0.2% + HYPE RSI < 40", comboStrongRevHypeWeak);

// 18. Fresh + reversal
const freshReversal = signals.filter(s => s.hypeSameBarMove < 0.15 && s.btcPrior5m < 0);
printFilter("COMBO: Fresh + BTC reversal", freshReversal);

// 19. BTC RSI 15m < 45 + HYPE RSI 5m < 45
const combo1545 = signals.filter(s => s.btcRsi15m !== null && s.btcRsi15m < 45 && s.hypeRsi5m !== null && s.hypeRsi5m < 45);
printFilter("COMBO: BTC RSI(15m) < 45 + HYPE RSI(5m) < 45", combo1545);

console.log(`\n${SEP}`);
