import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Analyze market conditions leading into major DD events
// Goal: find indicators that predict EM kills / hard flattens
// so we can cooldown (stop opening new ladders) before they happen
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
console.log(`Loaded ${candles.length} candles\n`);

// ── Precompute indicators ──
const closes = candles.map(c => c.close);
const highs = candles.map(c => c.high);
const lows = candles.map(c => c.low);
const volumes = candles.map(c => c.volume);

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const r = [data[0]];
  for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
  return r;
}

function sma(data: number[], period: number): number[] {
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    r.push(i >= period - 1 ? sum / period : sum / (i + 1));
  }
  return r;
}

function rsi(data: number[], period: number): number[] {
  const r: number[] = [50];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    r.push(100 - 100 / (1 + rs));
  }
  return r;
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  return ema(tr, period);
}

// Use 5-min candles, convert lookbacks to bar counts
const BARS_1H = 12;
const BARS_4H = 48;
const BARS_12H = 144;
const BARS_24H = 288;

// Core indicators
const ema50 = ema(closes, 50 * BARS_4H / 12);   // ~200 bars on 5min ≈ EMA50 on 4h
const ema200 = ema(closes, 200 * BARS_4H / 12);  // ~800 bars on 5min ≈ EMA200 on 4h
const rsi14 = rsi(closes, 14 * BARS_1H);          // RSI14 on 1h scale
const atr14 = atr(highs, lows, closes, 14 * BARS_1H);
const atrPct = atr14.map((a, i) => (a / closes[i]) * 100);

// Drawdown from rolling highs
function rollingMax(data: number[], period: number): number[] {
  const r: number[] = [];
  for (let i = 0; i < data.length; i++) {
    let max = 0;
    for (let j = Math.max(0, i - period); j <= i; j++) if (data[j] > max) max = data[j];
    r.push(max);
  }
  return r;
}

const high24h = rollingMax(highs, BARS_24H);
const high48h = rollingMax(highs, BARS_24H * 2);
const ddFrom24h = closes.map((c, i) => ((high24h[i] - c) / high24h[i]) * 100);
const ddFrom48h = closes.map((c, i) => ((high48h[i] - c) / high48h[i]) * 100);

// Volume spike: current 1h vol vs 24h average vol
function rollingVolume(period: number): number[] {
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < volumes.length; i++) {
    sum += volumes[i];
    if (i >= period) sum -= volumes[i - period];
    r.push(i >= period - 1 ? sum / period : sum / (i + 1));
  }
  return r;
}
const vol1h = rollingVolume(BARS_1H);
const vol24h = rollingVolume(BARS_24H);
const volRatio = vol1h.map((v, i) => vol24h[i] > 0 ? v / vol24h[i] : 1);

// Consecutive red candles (on 1h bars)
function consecutiveRed(idx: number): number {
  let count = 0;
  for (let i = idx; i >= Math.max(0, idx - BARS_24H); i -= BARS_1H) {
    // Check if the 1h bar is red (close < open equivalent: close < close 1h ago)
    const prevIdx = Math.max(0, i - BARS_1H);
    if (closes[i] < closes[prevIdx]) count++;
    else break;
  }
  return count;
}

// Price rate of change
function roc(idx: number, bars: number): number {
  const prev = Math.max(0, idx - bars);
  return ((closes[idx] - closes[prev]) / closes[prev]) * 100;
}

// ── Now replay the sim to find DD events ──

interface Cfg {
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
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
  const _ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const _closes = bars.map(b => b.close), e200 = _ema(_closes, 200), e50 = _ema(_closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, _closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

interface DDEvent {
  type: "emKill" | "hardFlat";
  closeTs: number;
  openTs: number;
  candleIdx: number;
  holdHours: number;
  netPnl: number;
  positions: number;
  avgEntry: number;
  exitPrice: number;
  // Indicators at time of FIRST ENTRY (when the ladder opened)
  atEntry: {
    rsi: number; atrPct: number;
    ddFrom24h: number; ddFrom48h: number;
    emaRatio50: number; emaRatio200: number;
    volRatio: number; roc4h: number; roc12h: number; roc24h: number;
    consRed: number;
    trendHostile: boolean;
  };
  // Indicators at 4h, 8h, 12h after entry (if available)
  atCheckpoints: Record<string, {
    rsi: number; atrPct: number; ddFrom24h: number; ddFrom48h: number;
    unrealizedPct: number; roc4h: number; consRed: number; volRatio: number;
  }>;
}

const cfg: Cfg = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
  startDate: "2025-01-20",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const gate = buildTrendGate(candles);
let capital = cfg.initialCapital;
const pos: { ep: number; et: number; qty: number; notional: number; idx: number }[] = [];
let lastAdd = 0;
const startTs = new Date(cfg.startDate).getTime();
const ddEvents: DDEvent[] = [];

function getIndicators(idx: number) {
  return {
    rsi: rsi14[idx],
    atrPct: atrPct[idx],
    ddFrom24h: ddFrom24h[idx],
    ddFrom48h: ddFrom48h[idx],
    emaRatio50: closes[idx] / ema50[idx],
    emaRatio200: closes[idx] / ema200[idx],
    volRatio: volRatio[idx],
    roc4h: roc(idx, BARS_4H),
    roc12h: roc(idx, BARS_12H),
    roc24h: roc(idx, BARS_24H),
    consRed: consecutiveRed(idx),
    trendHostile: isHostile(gate, candles[idx].timestamp),
  };
}

function closeLadder(price: number, ts: number, idx: number, exitType: "emKill" | "hardFlat") {
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

  const entryIdx = pos[0].idx;
  const entryIndicators = getIndicators(entryIdx);

  // Checkpoints at 4h, 8h, 12h, 24h after entry
  const checkpoints: Record<string, any> = {};
  for (const [label, offset] of [["4h", BARS_4H], ["8h", BARS_4H * 2], ["12h", BARS_12H], ["24h", BARS_24H]] as const) {
    const cpIdx = entryIdx + (offset as number);
    if (cpIdx < candles.length && cpIdx <= idx) {
      const cpPrice = closes[cpIdx];
      checkpoints[label] = {
        rsi: rsi14[cpIdx],
        atrPct: atrPct[cpIdx],
        ddFrom24h: ddFrom24h[cpIdx],
        ddFrom48h: ddFrom48h[cpIdx],
        unrealizedPct: ((cpPrice - avgE) / avgE) * 100,
        roc4h: roc(cpIdx, BARS_4H),
        consRed: consecutiveRed(cpIdx),
        volRatio: volRatio[cpIdx],
      };
    }
  }

  ddEvents.push({
    type: exitType, closeTs: ts, openTs: pos[0].et, candleIdx: idx,
    holdHours: (ts - pos[0].et) / 3600000,
    netPnl, positions: pos.length, avgEntry: avgE, exitPrice: price,
    atEntry: entryIndicators,
    atCheckpoints: checkpoints,
  });

  pos.length = 0;
}

for (let i = 0; i < candles.length; i++) {
  const c = candles[i];
  if (c.timestamp < startTs) continue;
  const { close, high, timestamp: ts } = c;

  if (pos.length > 0) {
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const avgPnl = ((close - avgE) / avgE) * 100;
    const oldH = (ts - pos[0].et) / 3600000;
    const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
    const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
    const tpPrice = avgE * (1 + tp / 100);
    if (high >= tpPrice) {
      // Normal or stale TP — not a DD event, just close
      for (const p of pos) {
        const raw = (tpPrice - p.ep) * p.qty;
        const fees = p.notional * cfg.feeRate + tpPrice * p.qty * cfg.feeRate;
        const holdMs = ts - p.et;
        const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
        capital += raw - fees - fund;
      }
      pos.length = 0;
      continue;
    }
    if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) { closeLadder(close, ts, i, "emKill"); continue; }
    if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) { closeLadder(close, ts, i, "hardFlat"); continue; }
  }

  const gap = (ts - lastAdd) / 60000;
  if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
    if (!isHostile(gate, ts)) {
      const lvl = pos.length;
      const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
      const margin = notional / cfg.leverage;
      const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - used >= margin && capital > 0) {
        pos.push({ ep: close, et: ts, qty: notional / close, notional, idx: i });
        lastAdd = ts;
      }
    }
  }
}

// ── Output ──
console.log("=" .repeat(120));
console.log("  DRAWDOWN EVENT ANALYSIS — What did the market look like before each EM Kill / Hard Flatten?");
console.log("=".repeat(120));
console.log(`\nFound ${ddEvents.length} DD events (${ddEvents.filter(e => e.type === "emKill").length} EM kills, ${ddEvents.filter(e => e.type === "hardFlat").length} hard flattens)\n`);

for (const e of ddEvents) {
  const date = new Date(e.closeTs).toISOString().slice(0, 16);
  const entryDate = new Date(e.openTs).toISOString().slice(0, 16);
  console.log(`${"─".repeat(100)}`);
  console.log(`${e.type.toUpperCase()} | ${entryDate} → ${date} | held ${e.holdHours.toFixed(1)}h | ${e.positions} pos | net=$${e.netPnl.toFixed(0)} | price $${e.avgEntry.toFixed(2)} → $${e.exitPrice.toFixed(2)}`);

  const a = e.atEntry;
  console.log(`  AT ENTRY:`);
  console.log(`    RSI=${a.rsi.toFixed(1)} | ATR%=${a.atrPct.toFixed(3)} | DD24h=${a.ddFrom24h.toFixed(1)}% | DD48h=${a.ddFrom48h.toFixed(1)}%`);
  console.log(`    Close/EMA50=${a.emaRatio50.toFixed(3)} | Close/EMA200=${a.emaRatio200.toFixed(3)} | VolRatio=${a.volRatio.toFixed(2)}`);
  console.log(`    ROC4h=${a.roc4h.toFixed(2)}% | ROC12h=${a.roc12h.toFixed(2)}% | ROC24h=${a.roc24h.toFixed(2)}% | ConsRed=${a.consRed} | TrendHostile=${a.trendHostile}`);

  for (const [label, cp] of Object.entries(e.atCheckpoints)) {
    console.log(`  AT ${label.toUpperCase()} AFTER ENTRY:`);
    console.log(`    RSI=${cp.rsi.toFixed(1)} | ATR%=${cp.atrPct.toFixed(3)} | DD24h=${cp.ddFrom24h.toFixed(1)}% | DD48h=${cp.ddFrom48h.toFixed(1)}% | Unrealized=${cp.unrealizedPct.toFixed(2)}%`);
    console.log(`    ROC4h=${cp.roc4h.toFixed(2)}% | ConsRed=${cp.consRed} | VolRatio=${cp.volRatio.toFixed(2)}`);
  }
  console.log("");
}

// ── Pattern summary ──
console.log("=".repeat(120));
console.log("  INDICATOR DISTRIBUTIONS: DD EVENTS vs ALL ENTRIES");
console.log("=".repeat(120) + "\n");

// Compare DD entry indicators vs a sample of normal (profitable) ladder entries
// We already have DD entries. For "normal", we'd need to track all entries.
// Instead let's just summarize the DD entries to look for patterns.

const ddEntryRsi = ddEvents.map(e => e.atEntry.rsi);
const ddEntryAtr = ddEvents.map(e => e.atEntry.atrPct);
const ddEntryDd24 = ddEvents.map(e => e.atEntry.ddFrom24h);
const ddEntryDd48 = ddEvents.map(e => e.atEntry.ddFrom48h);
const ddEntryEma50 = ddEvents.map(e => e.atEntry.emaRatio50);
const ddEntryEma200 = ddEvents.map(e => e.atEntry.emaRatio200);
const ddEntryRoc4h = ddEvents.map(e => e.atEntry.roc4h);
const ddEntryRoc12h = ddEvents.map(e => e.atEntry.roc12h);
const ddEntryRoc24h = ddEvents.map(e => e.atEntry.roc24h);
const ddEntryConsRed = ddEvents.map(e => e.atEntry.consRed);
const ddEntryVolRatio = ddEvents.map(e => e.atEntry.volRatio);

// At 4h checkpoint (early warning)
const dd4hUnrealized = ddEvents.filter(e => e.atCheckpoints["4h"]).map(e => e.atCheckpoints["4h"].unrealizedPct);
const dd4hDd24 = ddEvents.filter(e => e.atCheckpoints["4h"]).map(e => e.atCheckpoints["4h"].ddFrom24h);
const dd4hRsi = ddEvents.filter(e => e.atCheckpoints["4h"]).map(e => e.atCheckpoints["4h"].rsi);
const dd4hRoc4h = ddEvents.filter(e => e.atCheckpoints["4h"]).map(e => e.atCheckpoints["4h"].roc4h);

// At 8h checkpoint
const dd8hUnrealized = ddEvents.filter(e => e.atCheckpoints["8h"]).map(e => e.atCheckpoints["8h"].unrealizedPct);
const dd8hDd24 = ddEvents.filter(e => e.atCheckpoints["8h"]).map(e => e.atCheckpoints["8h"].ddFrom24h);

const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;
const med = (arr: number[]) => {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s.length % 2 === 0 ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : s[Math.floor(s.length / 2)];
};

const stat = (label: string, arr: number[], fmt = 2) => {
  console.log(`  ${label.padEnd(30)} avg=${avg(arr).toFixed(fmt)}  med=${med(arr).toFixed(fmt)}  min=${min(arr).toFixed(fmt)}  max=${max(arr).toFixed(fmt)}`);
};

console.log(`AT ENTRY (${ddEvents.length} DD events):`);
stat("RSI", ddEntryRsi, 1);
stat("ATR%", ddEntryAtr, 3);
stat("DD from 24h high", ddEntryDd24, 1);
stat("DD from 48h high", ddEntryDd48, 1);
stat("Close/EMA50", ddEntryEma50, 3);
stat("Close/EMA200", ddEntryEma200, 3);
stat("ROC 4h", ddEntryRoc4h);
stat("ROC 12h", ddEntryRoc12h);
stat("ROC 24h", ddEntryRoc24h);
stat("Consecutive red 1h bars", ddEntryConsRed, 0);
stat("Volume ratio (1h/24h)", ddEntryVolRatio);

console.log(`\nAT 4H CHECKPOINT (${dd4hUnrealized.length} events):`);
stat("Unrealized %", dd4hUnrealized);
stat("DD from 24h high", dd4hDd24, 1);
stat("RSI", dd4hRsi, 1);
stat("ROC 4h", dd4hRoc4h);

console.log(`\nAT 8H CHECKPOINT (${dd8hUnrealized.length} events):`);
stat("Unrealized %", dd8hUnrealized);
stat("DD from 24h high", dd8hDd24, 1);

// ── Check: what fraction of DD events had specific warning signals at entry? ──
console.log("\n" + "=".repeat(120));
console.log("  POTENTIAL COOLDOWN TRIGGERS (% of DD events that would have been caught)");
console.log("=".repeat(120) + "\n");

interface Filter { label: string; test: (e: DDEvent) => boolean; }

const filters: Filter[] = [
  { label: "RSI < 30 at entry", test: e => e.atEntry.rsi < 30 },
  { label: "RSI < 35 at entry", test: e => e.atEntry.rsi < 35 },
  { label: "RSI < 40 at entry", test: e => e.atEntry.rsi < 40 },
  { label: "DD from 24h high > 5%", test: e => e.atEntry.ddFrom24h > 5 },
  { label: "DD from 24h high > 8%", test: e => e.atEntry.ddFrom24h > 8 },
  { label: "DD from 24h high > 10%", test: e => e.atEntry.ddFrom24h > 10 },
  { label: "DD from 48h high > 10%", test: e => e.atEntry.ddFrom48h > 10 },
  { label: "DD from 48h high > 15%", test: e => e.atEntry.ddFrom48h > 15 },
  { label: "ROC 4h < -3%", test: e => e.atEntry.roc4h < -3 },
  { label: "ROC 4h < -5%", test: e => e.atEntry.roc4h < -5 },
  { label: "ROC 12h < -5%", test: e => e.atEntry.roc12h < -5 },
  { label: "ROC 12h < -8%", test: e => e.atEntry.roc12h < -8 },
  { label: "ROC 24h < -8%", test: e => e.atEntry.roc24h < -8 },
  { label: "ROC 24h < -10%", test: e => e.atEntry.roc24h < -10 },
  { label: "ROC 24h < -15%", test: e => e.atEntry.roc24h < -15 },
  { label: "ConsRed >= 3", test: e => e.atEntry.consRed >= 3 },
  { label: "ConsRed >= 5", test: e => e.atEntry.consRed >= 5 },
  { label: "Close < EMA200", test: e => e.atEntry.emaRatio200 < 1 },
  { label: "Close < EMA50", test: e => e.atEntry.emaRatio50 < 1 },
  { label: "ATR% > 0.15", test: e => e.atEntry.atrPct > 0.15 },
  { label: "ATR% > 0.20", test: e => e.atEntry.atrPct > 0.20 },
  { label: "VolRatio > 2.0", test: e => e.atEntry.volRatio > 2.0 },
  { label: "VolRatio > 3.0", test: e => e.atEntry.volRatio > 3.0 },
  // Combos
  { label: "ROC12h<-5% AND DD24h>5%", test: e => e.atEntry.roc12h < -5 && e.atEntry.ddFrom24h > 5 },
  { label: "ROC24h<-8% AND RSI<40", test: e => e.atEntry.roc24h < -8 && e.atEntry.rsi < 40 },
  { label: "ROC4h<-3% AND DD24h>8%", test: e => e.atEntry.roc4h < -3 && e.atEntry.ddFrom24h > 8 },
  { label: "RSI<35 AND Close<EMA200", test: e => e.atEntry.rsi < 35 && e.atEntry.emaRatio200 < 1 },
  // 4h checkpoint triggers
  { label: "Unrealized<-3% at 4h", test: e => e.atCheckpoints["4h"]?.unrealizedPct < -3 },
  { label: "Unrealized<-5% at 4h", test: e => e.atCheckpoints["4h"]?.unrealizedPct < -5 },
  { label: "Unrealized<-3% at 8h", test: e => e.atCheckpoints["8h"]?.unrealizedPct < -3 },
  { label: "Unrealized<-5% at 8h", test: e => e.atCheckpoints["8h"]?.unrealizedPct < -5 },
];

for (const f of filters) {
  const caught = ddEvents.filter(f.test);
  const pct = (caught.length / ddEvents.length * 100).toFixed(0);
  const totalLoss = caught.reduce((s, e) => s + e.netPnl, 0);
  const allLoss = ddEvents.reduce((s, e) => s + e.netPnl, 0);
  const lossPct = allLoss !== 0 ? (totalLoss / allLoss * 100).toFixed(0) : "0";
  console.log(`  ${f.label.padEnd(40)} catches ${String(caught.length).padStart(2)}/${ddEvents.length} (${pct.padStart(3)}%) | loss caught: $${totalLoss.toFixed(0).padStart(7)} (${lossPct}% of total)`);
}

console.log(`\n  Total DD loss: $${ddEvents.reduce((s, e) => s + e.netPnl, 0).toFixed(0)}`);
