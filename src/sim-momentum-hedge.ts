import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Momentum-collapse short hedge (Codex findings)
// Entry: ladder >= N pos, avg PnL <= -X%, 1h RSI <= Y, 1h ROC5 <= -Z%
// Structure: one-shot or micro-ladder (2-3 legs), quick TP, tight kill
// ─────────────────────────────────────────────

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  // Momentum hedge
  hedgeEnabled: boolean;
  hedgeMinPositions: number;    // long ladder must have >= this many positions
  hedgeMinPnlPct: number;      // avg long PnL must be <= this (negative, e.g. -2.5)
  hedgeRsi1hMax: number;        // 1h RSI must be <= this
  hedgeRoc1hMax: number;        // 1h ROC5 must be <= this (negative, e.g. -3)
  hedgePriceVsEma1h?: number;   // optional: 1h price vs EMA50 must be <= this
  hedgeMode: "oneshot" | "micro"; // one position or micro-ladder
  hedgeMicroMax: number;        // max legs if micro mode
  hedgeMicroInterval: number;   // min between micro adds
  hedgeSizeNotionalPct: number; // short size as % of active long notional
  hedgeTpPct: number;
  hedgeKillPct: number;
  hedgeMaxHoldHours: number;    // force close after this
  hedgeStaleHours: number;
  hedgeReducedTpPct: number;
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

// Build 1h bars and compute RSI + ROC5 + price vs EMA50
function build1hIndicators(candles: Candle[]) {
  const period = 3600000;
  const bars: { ts: number; open: number; close: number; high: number; low: number }[] = [];
  let curBar = -1, barO = 0, barH = 0, barL = Infinity, barC = 0, barTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: barTs, open: barO, close: barC, high: barH, low: barL });
      curBar = bar; barO = c.open; barH = c.high; barL = c.low;
    }
    if (c.high > barH) barH = c.high;
    if (c.low < barL) barL = c.low;
    barC = c.close; barTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: barTs, open: barO, close: barC, high: barH, low: barL });

  // RSI 14
  const rsiMap = new Map<number, number>();
  const rsiPeriod = 14;
  if (bars.length > rsiPeriod) {
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = bars[i].close - bars[i - 1].close;
      if (diff > 0) avgGain += diff; else avgLoss -= diff;
    }
    avgGain /= rsiPeriod; avgLoss /= rsiPeriod;
    for (let i = rsiPeriod; i < bars.length; i++) {
      if (i > rsiPeriod) {
        const diff = bars[i].close - bars[i - 1].close;
        avgGain = (avgGain * (rsiPeriod - 1) + (diff > 0 ? diff : 0)) / rsiPeriod;
        avgLoss = (avgLoss * (rsiPeriod - 1) + (diff < 0 ? -diff : 0)) / rsiPeriod;
      }
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiMap.set(Math.floor(bars[i].ts / period) * period, 100 - (100 / (1 + rs)));
    }
  }

  // ROC5
  const rocMap = new Map<number, number>();
  for (let i = 5; i < bars.length; i++) {
    const roc = ((bars[i].close - bars[i - 5].close) / bars[i - 5].close) * 100;
    rocMap.set(Math.floor(bars[i].ts / period) * period, roc);
  }

  // EMA50
  const ema50Map = new Map<number, number>();
  const k = 2 / 51;
  let emaVal = bars[0]?.close || 0;
  for (let i = 0; i < bars.length; i++) {
    emaVal = bars[i].close * k + emaVal * (1 - k);
    ema50Map.set(Math.floor(bars[i].ts / period) * period, emaVal);
  }

  return { rsiMap, rocMap, ema50Map };
}

interface Stats {
  finalEq: number; maxDD: number; minEq: number; returnPct: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  hedgeTPs: number; hedgeStales: number; hedgeKills: number; hedgeTimeouts: number;
  hedgeActivations: number; hedgeGrossPnl: number; hedgeLongClosePnl: number;
}

function run(candles: Candle[], cfg: Cfg, ind: ReturnType<typeof build1hIndicators>): Stats {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const longs: { ep: number; et: number; qty: number; notional: number }[] = [];
  const shorts: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastLongAdd = 0, lastShortAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();

  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let hedgeTPs = 0, hedgeStales = 0, hedgeKills = 0, hedgeTimeouts = 0;
  let hedgeActivations = 0, hedgeGrossPnl = 0, hedgeLongClosePnl = 0;
  let minEq = capital, maxDD = 0;
  let hedgeSignalActive = false;

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

  function closeShorts(price: number, ts: number, reason: string) {
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
    if (reason === "long_close") hedgeLongClosePnl += netPnl;
    shorts.length = 0;
    hedgeSignalActive = false;
    return netPnl;
  }

  const period1h = 3600000;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Equity
    const longUr = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const shortUr = shorts.reduce((s, p) => s + (p.ep - close) * p.qty, 0);
    const eq = capital + longUr + shortUr;
    if (eq > peakEq) peakEq = eq;
    if (eq < minEq) minEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

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
        if (shorts.length > 0) closeShorts(close, ts, "long_close");
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
        closeLongs(close, ts); longKills++;
        if (shorts.length > 0) closeShorts(close, ts, "long_close");
        continue;
      }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
        closeLongs(close, ts); longFlats++;
        if (shorts.length > 0) closeShorts(close, ts, "long_close");
        continue;
      }
    }

    // ── Short exits ──
    if (shorts.length > 0) {
      const tQty = shorts.reduce((s, p) => s + p.qty, 0);
      const avgE = shorts.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((avgE - close) / avgE) * 100;
      const oldH = (ts - shorts[0].et) / 3600000;

      // Stale short
      const isStale = cfg.hedgeStaleHours > 0 && oldH >= cfg.hedgeStaleHours && avgPnl < 0;
      const tp = isStale ? cfg.hedgeReducedTpPct : cfg.hedgeTpPct;
      const tpPrice = avgE * (1 - tp / 100);

      if (low <= tpPrice) {
        closeShorts(tpPrice, ts, "tp");
        if (isStale) hedgeStales++; else hedgeTPs++;
        continue;
      }
      if (cfg.hedgeKillPct !== 0 && avgPnl <= -cfg.hedgeKillPct) {
        closeShorts(close, ts, "kill"); hedgeKills++; continue;
      }
      // Max hold timeout
      if (cfg.hedgeMaxHoldHours > 0 && oldH >= cfg.hedgeMaxHoldHours) {
        closeShorts(close, ts, "timeout"); hedgeTimeouts++; continue;
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

    // ── Momentum-collapse hedge entry ──
    if (cfg.hedgeEnabled && !hedgeSignalActive && shorts.length === 0 && longs.length >= cfg.hedgeMinPositions) {
      const tQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgE = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;

      if (avgPnl <= cfg.hedgeMinPnlPct) {
        // Get 1h indicators (previous confirmed bar)
        const prevBar = Math.floor(ts / period1h) * period1h - period1h;
        const rsi1h = ind.rsiMap.get(prevBar) ?? 50;
        const roc1h = ind.rocMap.get(prevBar) ?? 0;
        const ema50 = ind.ema50Map.get(prevBar) ?? close;
        const priceVsEma = ((close - ema50) / ema50) * 100;

        const rsiOk = rsi1h <= cfg.hedgeRsi1hMax;
        const rocOk = roc1h <= cfg.hedgeRoc1hMax;
        const emaOk = cfg.hedgePriceVsEma1h === undefined || priceVsEma <= cfg.hedgePriceVsEma1h;

        if (rsiOk && rocOk && emaOk) {
          hedgeSignalActive = true;
          hedgeActivations++;

          // Size based on % of active long notional
          const longNotional = longs.reduce((s, p) => s + p.notional, 0);
          const shortNotional = longNotional * (cfg.hedgeSizeNotionalPct / 100);

          if (cfg.hedgeMode === "oneshot") {
            const margin = shortNotional / cfg.leverage;
            const longMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
            const shortMargin = shorts.reduce((s, p) => s + p.notional / cfg.leverage, 0);
            if (capital - longMargin - shortMargin >= margin && capital > 0) {
              shorts.push({ ep: close, et: ts, qty: shortNotional / close, notional: shortNotional });
              lastShortAdd = ts;
            }
          } else {
            // Micro-ladder: first leg now
            const legNotional = shortNotional / cfg.hedgeMicroMax;
            const margin = legNotional / cfg.leverage;
            const longMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
            if (capital - longMargin >= margin && capital > 0) {
              shorts.push({ ep: close, et: ts, qty: legNotional / close, notional: legNotional });
              lastShortAdd = ts;
            }
          }
        }
      }
    }

    // ── Micro-ladder short adds ──
    if (cfg.hedgeEnabled && cfg.hedgeMode === "micro" && hedgeSignalActive && shorts.length > 0 && shorts.length < cfg.hedgeMicroMax) {
      const shortGap = (ts - lastShortAdd) / 60000;
      if (shortGap >= cfg.hedgeMicroInterval) {
        const longNotional = longs.reduce((s, p) => s + p.notional, 0);
        const totalShortTarget = longNotional * (cfg.hedgeSizeNotionalPct / 100);
        const legNotional = totalShortTarget / cfg.hedgeMicroMax;
        const margin = legNotional / cfg.leverage;
        const longMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        const shortMargin = shorts.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - longMargin - shortMargin >= margin && capital > 0) {
          shorts.push({ ep: close, et: ts, qty: legNotional / close, notional: legNotional });
          lastShortAdd = ts;
        }
      }
    }
  }

  if (longs.length > 0) closeLongs(candles[candles.length - 1].close, candles[candles.length - 1].timestamp);
  if (shorts.length > 0) closeShorts(candles[candles.length - 1].close, candles[candles.length - 1].timestamp, "end");

  return {
    finalEq: capital, maxDD, minEq, returnPct: (capital / cfg.initialCapital - 1) * 100,
    longTPs, longStales, longKills, longFlats,
    hedgeTPs, hedgeStales, hedgeKills, hedgeTimeouts,
    hedgeActivations, hedgeGrossPnl, hedgeLongClosePnl,
  };
}

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
const ind = build1hIndicators(candles);

const base: Omit<Cfg, "label"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2024-12-06",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
  hedgeEnabled: false,
  hedgeMinPositions: 9, hedgeMinPnlPct: -2.5,
  hedgeRsi1hMax: 42, hedgeRoc1hMax: -3,
  hedgeMode: "oneshot", hedgeMicroMax: 3, hedgeMicroInterval: 15,
  hedgeSizeNotionalPct: 20, hedgeTpPct: 1.0, hedgeKillPct: 1.0,
  hedgeMaxHoldHours: 12, hedgeStaleHours: 6, hedgeReducedTpPct: 0.3,
};

function printRow(label: string, s: Stats, hedgeOn: boolean) {
  const hi = hedgeOn
    ? `${String(s.hedgeTPs).padStart(5)} ${String(s.hedgeStales).padStart(5)} ${String(s.hedgeKills).padStart(5)} ${String(s.hedgeTimeouts).padStart(4)} ${String(s.hedgeActivations).padStart(4)}  $${s.hedgeGrossPnl.toFixed(0).padStart(7)}`
    : `  n/a   n/a   n/a  n/a  n/a      n/a`;
  console.log(`  ${label.padEnd(48)} $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)} ${hi}`);
}

function header() {
  console.log(`\n  Config                                          Final Eq  Return   MaxDD%  MinEq   HdgTP HdStl HdKil TOut Acts  HedgePnL`);
  console.log("  " + "-".repeat(115));
}

// ════════════════════════════════════════════
// PART 1: Full history — Codex v1 entry conditions
// ════════════════════════════════════════════

console.log("=".repeat(120));
console.log("  MOMENTUM-COLLAPSE HEDGE — Codex v1 conditions");
console.log("  Entry: ladder >= N pos, avg PnL <= -X%, 1h RSI <= Y, 1h ROC5 <= -Z%");
console.log("  Full history: Dec 2024 → Mar 2026, $15K");
console.log("=".repeat(120));
header();

const tests: { label: string; ov: Partial<Cfg> }[] = [
  { label: "Baseline: 11L no hedge", ov: { hedgeEnabled: false } },
  // Codex Candidate A: RSI<=42, ROC<=-3
  { label: "A: oneshot 20% TP1.0% kill1.0%", ov: { hedgeEnabled: true } },
  { label: "A: oneshot 20% TP0.7% kill1.0%", ov: { hedgeEnabled: true, hedgeTpPct: 0.7 } },
  { label: "A: oneshot 20% TP1.4% kill1.0%", ov: { hedgeEnabled: true, hedgeTpPct: 1.4 } },
  { label: "A: oneshot 15% TP1.0% kill1.0%", ov: { hedgeEnabled: true, hedgeSizeNotionalPct: 15 } },
  { label: "A: oneshot 25% TP1.0% kill1.0%", ov: { hedgeEnabled: true, hedgeSizeNotionalPct: 25 } },
  { label: "A: oneshot 20% TP1.0% kill1.5%", ov: { hedgeEnabled: true, hedgeKillPct: 1.5 } },
  { label: "A: oneshot 20% TP1.0% kill0.5%", ov: { hedgeEnabled: true, hedgeKillPct: 0.5 } },
  // Max hold sweep
  { label: "A: oneshot 20% maxHold 6h", ov: { hedgeEnabled: true, hedgeMaxHoldHours: 6 } },
  { label: "A: oneshot 20% maxHold 12h", ov: { hedgeEnabled: true, hedgeMaxHoldHours: 12 } },
  { label: "A: oneshot 20% maxHold 24h", ov: { hedgeEnabled: true, hedgeMaxHoldHours: 24 } },
  // Codex Candidate B: stricter RSI<=40, ROC<=-3.5
  { label: "B: oneshot 20% RSI40 ROC-3.5", ov: { hedgeEnabled: true, hedgeRsi1hMax: 40, hedgeRoc1hMax: -3.5 } },
  { label: "B: oneshot 25% RSI40 ROC-3.5", ov: { hedgeEnabled: true, hedgeRsi1hMax: 40, hedgeRoc1hMax: -3.5, hedgeSizeNotionalPct: 25 } },
  // Codex Candidate C: + price vs EMA50 filter
  { label: "C: oneshot 20% + priceVsEma<-1%", ov: { hedgeEnabled: true, hedgePriceVsEma1h: -1 } },
  { label: "C: oneshot 20% + priceVsEma<-4%", ov: { hedgeEnabled: true, hedgePriceVsEma1h: -4 } },
  // Micro-ladder variants
  { label: "micro 3-leg 20% TP1.0% kill1.0%", ov: { hedgeEnabled: true, hedgeMode: "micro" as const } },
  { label: "micro 2-leg 20% TP1.0% kill1.0%", ov: { hedgeEnabled: true, hedgeMode: "micro" as const, hedgeMicroMax: 2 } },
  { label: "micro 3-leg 25% TP0.7% kill1.0%", ov: { hedgeEnabled: true, hedgeMode: "micro" as const, hedgeSizeNotionalPct: 25, hedgeTpPct: 0.7 } },
  // Min positions sweep
  { label: "A: minPos 7, oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPositions: 7 } },
  { label: "A: minPos 9, oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPositions: 9 } },
  { label: "A: minPos 11, oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPositions: 11 } },
  // Avg PnL threshold sweep
  { label: "A: pnl<=-1.5% oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPnlPct: -1.5 } },
  { label: "A: pnl<=-2.5% oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPnlPct: -2.5 } },
  { label: "A: pnl<=-4.0% oneshot 20%", ov: { hedgeEnabled: true, hedgeMinPnlPct: -4.0 } },
];

for (const t of tests) {
  const cfg: Cfg = { ...base, label: t.label, ...t.ov };
  const s = run(candles, cfg, ind);
  printRow(t.label, s, cfg.hedgeEnabled);
}

// ════════════════════════════════════════════
// PART 2: July 2025 start
// ════════════════════════════════════════════

console.log("\n\n" + "=".repeat(120));
console.log("  JULY 2025 START — realistic window");
console.log("=".repeat(120));
header();

const julyTests: { label: string; ov: Partial<Cfg> }[] = [
  { label: "Baseline: 11L no hedge", ov: { hedgeEnabled: false, startDate: "2025-07-01" } },
  { label: "A: oneshot 20% TP1.0%", ov: { hedgeEnabled: true, startDate: "2025-07-01" } },
  { label: "A: oneshot 20% TP0.7%", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgeTpPct: 0.7 } },
  { label: "B: stricter RSI40 ROC-3.5", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgeRsi1hMax: 40, hedgeRoc1hMax: -3.5 } },
  { label: "C: + priceVsEma<-1%", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgePriceVsEma1h: -1 } },
  { label: "micro 3-leg 20% TP1.0%", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgeMode: "micro" as const } },
  { label: "A: oneshot 25% TP1.0% kill1.5%", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgeSizeNotionalPct: 25, hedgeKillPct: 1.5 } },
  { label: "A: oneshot 20% maxHold 6h", ov: { hedgeEnabled: true, startDate: "2025-07-01", hedgeMaxHoldHours: 6 } },
];

for (const t of julyTests) {
  const cfg: Cfg = { ...base, label: t.label, ...t.ov };
  const s = run(candles, cfg, ind);
  printRow(t.label, s, cfg.hedgeEnabled);
}

// ════════════════════════════════════════════
// PART 3: Feb 2026 stress test
// ════════════════════════════════════════════

console.log("\n\n" + "=".repeat(120));
console.log("  FEB 2026 START — stress test");
console.log("=".repeat(120));
header();

const febTests: { label: string; ov: Partial<Cfg> }[] = [
  { label: "Baseline: 11L no hedge", ov: { hedgeEnabled: false, startDate: "2026-02-01" } },
  { label: "A: oneshot 20% TP1.0%", ov: { hedgeEnabled: true, startDate: "2026-02-01" } },
  { label: "B: stricter RSI40 ROC-3.5", ov: { hedgeEnabled: true, startDate: "2026-02-01", hedgeRsi1hMax: 40, hedgeRoc1hMax: -3.5 } },
  { label: "micro 3-leg 20% TP1.0%", ov: { hedgeEnabled: true, startDate: "2026-02-01", hedgeMode: "micro" as const } },
  { label: "A: oneshot 25% TP1.0% kill1.5%", ov: { hedgeEnabled: true, startDate: "2026-02-01", hedgeSizeNotionalPct: 25, hedgeKillPct: 1.5 } },
];

for (const t of febTests) {
  const cfg: Cfg = { ...base, label: t.label, ...t.ov };
  const s = run(candles, cfg, ind);
  printRow(t.label, s, cfg.hedgeEnabled);
}
