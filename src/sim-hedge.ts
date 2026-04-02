import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Sim: ladder size sweep + short hedge overlay during DD
// Hedge activates when account DD% crosses threshold
// Short ladder uses same DCA logic but inverted
// ─────────────────────────────────────────────

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
  // Hedge config
  hedgeEnabled: boolean;
  hedgeDdTrigger: number;      // DD% to activate hedge mode
  hedgeDdExit: number;         // DD% to deactivate hedge mode
  hedgeMaxPositions: number;   // max short positions
  hedgeTpPct: number;          // TP% for short ladder
  hedgeBasePosUsdt: number;    // base size for short
  hedgeAddInterval: number;    // min between short adds
  hedgeScaleFactor: number;
  hedgeStaleHours: number;
  hedgeReducedTpPct: number;
  hedgeKillPct: number;        // emergency kill for shorts (adverse move %)
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

interface Stats {
  finalEq: number; maxDD: number; minEq: number; returnPct: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  hedgeTPs: number; hedgeStales: number; hedgeKills: number;
  hedgeActivations: number; hedgeGrossPnl: number;
}

function run(candles: Candle[], cfg: Cfg): Stats {
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

    // Equity calc
    const longUr = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const shortUr = shorts.reduce((s, p) => s + (p.ep - close) * p.qty, 0);
    const eq = capital + longUr + shortUr;
    if (eq > peakEq) peakEq = eq;
    if (eq < minEq) minEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // Hedge activation/deactivation
    if (cfg.hedgeEnabled) {
      if (!hedgeActive && dd >= cfg.hedgeDdTrigger) {
        hedgeActive = true;
        hedgeActivations++;
      } else if (hedgeActive && dd <= cfg.hedgeDdExit) {
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
        // Also close shorts on long TP — trend reversed
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

    // ── Short (hedge) exits ──
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

    // ── Short entries (only in hedge mode) ──
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

const base: Omit<Cfg, "label"> = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2024-12-06",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
  hedgeEnabled: false, hedgeDdTrigger: 15, hedgeDdExit: 5,
  hedgeMaxPositions: 5, hedgeTpPct: 1.0, hedgeBasePosUsdt: 400,
  hedgeAddInterval: 30, hedgeScaleFactor: 1.2,
  hedgeStaleHours: 6, hedgeReducedTpPct: 0.3, hedgeKillPct: 10,
};

// ════════════════════════════════════════════
// PART 1: Ladder size sweep (longs only)
// ════════════════════════════════════════════

console.log("=".repeat(110));
console.log("  PART 1: LADDER SIZE SWEEP — $15K from Dec 2024 (full history), no hedge");
console.log("=".repeat(110));
console.log(`\n  MaxPos  Final Eq    Return    MaxDD%   MinEq     TPs   Stales  Kills  Flats`);
console.log("  " + "-".repeat(90));

for (const maxPos of [3, 5, 7, 9, 11, 13, 15]) {
  const cfg: Cfg = { ...base, label: `${maxPos}`, maxPositions: maxPos };
  const s = run(candles, cfg);
  console.log(`  ${String(maxPos).padStart(6)}  $${s.finalEq.toFixed(0).padStart(7)}   ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 7 - s.returnPct.toFixed(1).length))}  ${s.maxDD.toFixed(1).padStart(5)}%   $${s.minEq.toFixed(0).padStart(7)}   ${String(s.longTPs).padStart(5)}  ${String(s.longStales).padStart(6)}  ${String(s.longKills).padStart(5)}  ${String(s.longFlats).padStart(5)}`);
}

// ════════════════════════════════════════════
// PART 1b: $400 capital sweep — targeting ~50% max DD
// ════════════════════════════════════════════

console.log("\n" + "=".repeat(110));
console.log("  PART 1b: $10K CAPITAL SWEEP — base size & scale factor vs max drawdown");
console.log("=".repeat(110));
console.log(`\n  Label                  Final Eq    Return    MaxDD%   MinEq     TPs   Stales  Kills  Flats   Margin@full`);
console.log("  " + "-".repeat(105));

const base400 = { ...base, initialCapital: 10000 };
const sweep400 = [
  { label: "base=500 sc=1.2 mx=11", basePositionUsdt: 500, addScaleFactor: 1.2, maxPositions: 11 },
  { label: "base=600 sc=1.2 mx=11", basePositionUsdt: 600, addScaleFactor: 1.2, maxPositions: 11 },
  { label: "base=700 sc=1.2 mx=11", basePositionUsdt: 700, addScaleFactor: 1.2, maxPositions: 11 },
  { label: "base=800 sc=1.2 mx=11", basePositionUsdt: 800, addScaleFactor: 1.2, maxPositions: 11 },
  { label: "base=800 sc=1.2 mx=9 ", basePositionUsdt: 800, addScaleFactor: 1.2, maxPositions:  9 },
  { label: "base=800 sc=1.15 mx=11", basePositionUsdt: 800, addScaleFactor: 1.15, maxPositions: 11 },
  { label: "base=900 sc=1.2 mx=11", basePositionUsdt: 900, addScaleFactor: 1.2, maxPositions: 11 },
  { label: "base=1000 sc=1.2 mx=11", basePositionUsdt: 1000, addScaleFactor: 1.2, maxPositions: 11 },
];

for (const s4 of sweep400) {
  const cfg: Cfg = { ...base400, label: s4.label, ...s4 };
  const s = run(candles, cfg);
  const totalNot = Array.from({ length: s4.maxPositions }, (_, i) => s4.basePositionUsdt * Math.pow(s4.addScaleFactor, i)).reduce((a, b) => a + b, 0);
  const marginPct = (totalNot / base400.leverage / base400.initialCapital * 100).toFixed(1);
  const flag = s.maxDD >= 40 && s.maxDD <= 60 ? "  ← target" : s.maxDD < 40 ? "  (low)" : "  (HIGH)";
  console.log(`  ${s4.label.padEnd(22)} $${s.finalEq.toFixed(0).padStart(7)}   ${((s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%").padStart(8)}  ${(s.maxDD.toFixed(1) + "%").padStart(6)}   $${s.minEq.toFixed(0).padStart(6)}   ${String(s.longTPs).padStart(5)}  ${String(s.longStales).padStart(6)}  ${String(s.longKills).padStart(5)}  ${String(s.longFlats).padStart(5)}   ${marginPct}%${flag}`);
}

// ════════════════════════════════════════════
// PART 2: Detailed long+short combos (July 2025 start)
// ════════════════════════════════════════════

function printRow(label: string, s: Stats, hedgeEnabled: boolean) {
  const hi = hedgeEnabled
    ? `${String(s.hedgeTPs + s.hedgeStales).padStart(7)} ${String(s.hedgeKills).padStart(7)} ${String(s.hedgeActivations).padStart(5)}  $${s.hedgeGrossPnl.toFixed(0).padStart(7)}`
    : `    n/a     n/a   n/a      n/a`;
  console.log(`  ${label.padEnd(44)} $${s.finalEq.toFixed(0).padStart(7)} ${(s.returnPct >= 0 ? "+" : "") + s.returnPct.toFixed(1) + "%"}${" ".repeat(Math.max(1, 6 - s.returnPct.toFixed(1).length))} ${s.maxDD.toFixed(1).padStart(5)}%  $${s.minEq.toFixed(0).padStart(7)} ${hi}`);
}

console.log("\n\n" + "=".repeat(110));
console.log("  PART 2: LONG + SHORT COMBOS — $15K from Dec 2024 (full history)");
console.log("=".repeat(110));
console.log(`\n  Config                                      Final Eq  Return  MaxDD%  MinEq   HdgTPs HdgKill Acts  HedgePnL`);
console.log("  " + "-".repeat(110));

const combos: { label: string; maxL: number; maxS: number; hedgeTp?: number; ddTrig?: number; ddExit?: number; hBase?: number }[] = [
  // Baselines (no hedge)
  { label: "7 long, no hedge", maxL: 7, maxS: 0 },
  { label: "9 long, no hedge", maxL: 9, maxS: 0 },
  { label: "11 long, no hedge", maxL: 11, maxS: 0 },
  // 11 long + small hedge
  { label: "11 long + 2 short @DD>15%", maxL: 11, maxS: 2 },
  { label: "11 long + 3 short @DD>15%", maxL: 11, maxS: 3 },
  { label: "11 long + 5 short @DD>15%", maxL: 11, maxS: 5 },
  // 9 long + hedge
  { label: "9 long + 2 short @DD>15%", maxL: 9, maxS: 2 },
  { label: "9 long + 3 short @DD>15%", maxL: 9, maxS: 3 },
  { label: "9 long + 5 short @DD>15%", maxL: 9, maxS: 5 },
  { label: "9 long + 7 short @DD>15%", maxL: 9, maxS: 7 },
  // 7 long + hedge
  { label: "7 long + 3 short @DD>15%", maxL: 7, maxS: 3 },
  { label: "7 long + 5 short @DD>15%", maxL: 7, maxS: 5 },
  // Hedge TP sweep on best combo (9+5)
  { label: "9L + 5S @DD>15%, TP 0.5%", maxL: 9, maxS: 5, hedgeTp: 0.5 },
  { label: "9L + 5S @DD>15%, TP 0.7%", maxL: 9, maxS: 5, hedgeTp: 0.7 },
  { label: "9L + 5S @DD>15%, TP 1.0%", maxL: 9, maxS: 5, hedgeTp: 1.0 },
  { label: "9L + 5S @DD>15%, TP 1.4%", maxL: 9, maxS: 5, hedgeTp: 1.4 },
  // DD trigger sweep on 9+5
  { label: "9L + 5S @DD>10%", maxL: 9, maxS: 5, ddTrig: 10, ddExit: 3 },
  { label: "9L + 5S @DD>15%", maxL: 9, maxS: 5, ddTrig: 15, ddExit: 5 },
  { label: "9L + 5S @DD>20%", maxL: 9, maxS: 5, ddTrig: 20, ddExit: 8 },
  { label: "9L + 5S @DD>25%", maxL: 9, maxS: 5, ddTrig: 25, ddExit: 10 },
  // Hedge base size sweep on 9+5
  { label: "9L + 5S, hedge $200 base", maxL: 9, maxS: 5, hBase: 200 },
  { label: "9L + 5S, hedge $400 base", maxL: 9, maxS: 5, hBase: 400 },
  { label: "9L + 5S, hedge $600 base", maxL: 9, maxS: 5, hBase: 600 },
  { label: "9L + 5S, hedge $800 base", maxL: 9, maxS: 5, hBase: 800 },
];

for (const c of combos) {
  const hedgeOn = c.maxS > 0;
  const cfg: Cfg = {
    ...base, label: c.label, maxPositions: c.maxL,
    hedgeEnabled: hedgeOn, hedgeDdTrigger: c.ddTrig ?? 15, hedgeDdExit: c.ddExit ?? 5,
    hedgeMaxPositions: c.maxS, hedgeTpPct: c.hedgeTp ?? 1.0, hedgeBasePosUsdt: c.hBase ?? 400,
  };
  const s = run(candles, cfg);
  printRow(c.label, s, hedgeOn);
}

// ════════════════════════════════════════════
// PART 3: Feb 1 2026 → current (stress test)
// ════════════════════════════════════════════

const baseFeb = { ...base, startDate: "2026-02-01", initialCapital: 15000 };

console.log("\n\n" + "=".repeat(110));
console.log("  PART 3: FEB 2026 → CURRENT (worst-case stress test, $15K)");
console.log("=".repeat(110));
console.log(`\n  Config                                      Final Eq  Return  MaxDD%  MinEq   HdgTPs HdgKill Acts  HedgePnL`);
console.log("  " + "-".repeat(110));

const febCombos: { label: string; maxL: number; maxS: number; hedgeTp?: number; ddTrig?: number; ddExit?: number }[] = [
  { label: "11 long, no hedge", maxL: 11, maxS: 0 },
  { label: "9 long, no hedge", maxL: 9, maxS: 0 },
  { label: "11 long + 2 short @DD>15%", maxL: 11, maxS: 2 },
  { label: "11 long + 3 short @DD>15%", maxL: 11, maxS: 3 },
  { label: "9 long + 3 short @DD>15%", maxL: 9, maxS: 3 },
  { label: "9 long + 5 short @DD>15%", maxL: 9, maxS: 5 },
  { label: "9L + 5S @DD>15%, TP 1.4%", maxL: 9, maxS: 5, hedgeTp: 1.4 },
  { label: "9L + 5S @DD>10%", maxL: 9, maxS: 5, ddTrig: 10, ddExit: 3 },
  { label: "9L + 5S @DD>20%", maxL: 9, maxS: 5, ddTrig: 20, ddExit: 8 },
  { label: "7 long + 5 short @DD>15%", maxL: 7, maxS: 5 },
]

for (const c of febCombos) {
  const hedgeOn = c.maxS > 0;
  const cfg: Cfg = {
    ...baseFeb, label: c.label, maxPositions: c.maxL,
    hedgeEnabled: hedgeOn, hedgeDdTrigger: c.ddTrig ?? 15, hedgeDdExit: c.ddExit ?? 5,
    hedgeMaxPositions: c.maxS, hedgeTpPct: c.hedgeTp ?? 1.0, hedgeBasePosUsdt: 400,
  };
  const s = run(candles, cfg);
  printRow(c.label, s, hedgeOn);
}

// ════════════════════════════════════════════
// PART 3: Win-streak short — fire 1x short after N consecutive
//         positive-PnL ladder closes within a 3h window
//         Short: $1400 notional, 0.6% TP, 5% kill, no DCA
// ════════════════════════════════════════════

function runWinStreak(candles: Candle[], cfg: Omit<Cfg, "label">, streakN: number, streakTp?: number, windowH?: number): Stats & { streakFires: number; streakPnl: number } {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  type Pos = { ep: number; et: number; qty: number; notional: number };
  const longs: Pos[] = [];
  let streakShort: Pos | null = null;
  let lastLongAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let hedgeTPs = 0, hedgeKills = 0, streakFires = 0, streakPnl = 0;
  let minEq = capital, maxDD = 0;
  const winTimes: number[] = [];
  const WINDOW_MS = (windowH ?? 3) * 3600000;
  const STREAK_NOT = 1400, STREAK_TP = streakTp ?? cfg.hedgeTpPct, STREAK_KILL = cfg.hedgeKillPct;

  function closeLongs(price: number, ts: number) {
    let netPnl = 0;
    for (const p of longs) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const fund = p.notional * cfg.fundingRate8h * ((ts - p.et) / (8 * 3600000));
      netPnl += raw - fees - fund; capital += raw - fees - fund;
    }
    longs.length = 0; return netPnl;
  }

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;
    const longUr = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const shortUr = streakShort ? (streakShort.ep - close) * streakShort.qty : 0;
    const eq = capital + longUr + shortUr;
    if (eq > peakEq) peakEq = eq; if (eq < minEq) minEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0; if (dd > maxDD) maxDD = dd;

    if (streakShort) {
      const tpPrice = streakShort.ep * (1 - STREAK_TP / 100);
      const killPrice = streakShort.ep * (1 + STREAK_KILL / 100);
      if (low <= tpPrice) {
        const pnl = (streakShort.ep - tpPrice) * streakShort.qty - (streakShort.notional * cfg.feeRate + tpPrice * streakShort.qty * cfg.feeRate);
        capital += pnl; streakPnl += pnl; hedgeTPs++; streakShort = null;
      } else if (high >= killPrice) {
        const pnl = (streakShort.ep - killPrice) * streakShort.qty - (streakShort.notional * cfg.feeRate + killPrice * streakShort.qty * cfg.feeRate);
        capital += pnl; streakPnl += pnl; hedgeKills++; streakShort = null;
      }
    }

    if (longs.length > 0) {
      const tQty = longs.reduce((s, p) => s + p.qty, 0);
      const avgE = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const oldH = (ts - longs[0].et) / 3600000;
      const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && close < avgE;
      const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tp / 100);
      const avgPnl = ((close - avgE) / avgE) * 100;
      if (high >= tpPrice) {
        const pnl = closeLongs(tpPrice, ts);
        if (isStale) longStales++; else longTPs++;
        if (pnl > 0) { winTimes.push(ts); while (winTimes.length > 0 && ts - winTimes[0] > WINDOW_MS) winTimes.shift(); }
        else winTimes.length = 0;
        if (winTimes.length >= streakN && streakShort === null) {
          streakShort = { ep: close, et: ts, qty: STREAK_NOT / close, notional: STREAK_NOT };
          streakFires++; winTimes.length = 0;
        }
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) { closeLongs(close, ts); longKills++; winTimes.length = 0; continue; }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) { closeLongs(close, ts); longFlats++; winTimes.length = 0; continue; }
    }

    const longGap = (ts - lastLongAdd) / 60000;
    if (longs.length < cfg.maxPositions && longGap >= cfg.addIntervalMin && !isHostile(gate, ts)) {
      const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, longs.length);
      longs.push({ ep: close, et: ts, qty: notional / close, notional }); lastLongAdd = ts;
    }
  }
  if (longs.length > 0) closeLongs(candles[candles.length - 1].close, candles[candles.length - 1].timestamp);
  return { finalEq: capital, maxDD, minEq, returnPct: (capital / cfg.initialCapital - 1) * 100, longTPs, longStales, longKills, longFlats, hedgeTPs, hedgeStales: 0, hedgeKills, hedgeActivations: streakFires, hedgeGrossPnl: streakPnl, streakFires, streakPnl };
}

const streakBase: Omit<Cfg, "label"> = { ...base, initialCapital: 10000, basePositionUsdt: 800, hedgeEnabled: false, hedgeDdTrigger: 15, hedgeDdExit: 5, hedgeMaxPositions: 0, hedgeTpPct: 0.6, hedgeBasePosUsdt: 1400, hedgeAddInterval: 30, hedgeScaleFactor: 1.0, hedgeStaleHours: 0, hedgeReducedTpPct: 0, hedgeKillPct: 5 };
const streakJan26: Omit<Cfg, "label"> = { ...streakBase, startDate: "2026-01-01" };

const hdr = `  ${"Config".padEnd(32)} ${"FinalEq".padStart(9)} ${"Return".padStart(9)} ${"MaxDD".padStart(7)} ${"MinEq".padStart(9)} ${"Fires".padStart(6)} ${"ShortPnL".padStart(10)} ${"TPs".padStart(5)} ${"Kills".padStart(6)} ${"TPrate".padStart(7)}`;
const div = "  " + "-".repeat(110);

// ── Kill stop sweep (N=3, 3h window, TP=3%) ──
console.log("\n" + "=".repeat(120));
console.log("  PART 3a: KILL STOP SWEEP — N=3, 3h window, TP=3%");
console.log("=".repeat(120));
console.log(hdr); console.log(div);
const bsl = runWinStreak(candles, streakBase, 999);
console.log(`  ${"baseline (no short)".padEnd(32)} $${bsl.finalEq.toFixed(0).padStart(8)} ${((bsl.returnPct>=0?"+":"")+bsl.returnPct.toFixed(1)+"%").padStart(9)} ${(bsl.maxDD.toFixed(1)+"%").padStart(7)} $${bsl.minEq.toFixed(0).padStart(8)}    n/a          n/a   n/a    n/a      n/a`);
for (const kill of [3, 5, 7, 8, 10, 15]) {
  const s = runWinStreak(candles, { ...streakBase, hedgeKillPct: kill }, 3, 3.0, 3);
  const pnlStr = (s.streakPnl>=0?"+":"")+s.streakPnl.toFixed(0);
  const tpRate = s.streakFires > 0 ? (s.hedgeTPs/s.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${("kill="+kill+"%").padEnd(32)} $${s.finalEq.toFixed(0).padStart(8)} ${((s.returnPct>=0?"+":"")+s.returnPct.toFixed(1)+"%").padStart(9)} ${(s.maxDD.toFixed(1)+"%").padStart(7)} $${s.minEq.toFixed(0).padStart(8)} ${String(s.streakFires).padStart(6)} ${"$"+pnlStr.padStart(9)} ${String(s.hedgeTPs).padStart(5)} ${String(s.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`);
}

// ── Window sweep (N=3, best kill=10%, TP=3%) ──
console.log("\n" + "=".repeat(120));
console.log("  PART 3b: WINDOW SWEEP — N=3, TP=3%, kill=10% | window=1h/2h/3h/4h");
console.log("=".repeat(120));
console.log(hdr); console.log(div);
console.log(`  ${"baseline (no short)".padEnd(32)} $${bsl.finalEq.toFixed(0).padStart(8)} ${((bsl.returnPct>=0?"+":"")+bsl.returnPct.toFixed(1)+"%").padStart(9)} ${(bsl.maxDD.toFixed(1)+"%").padStart(7)} $${bsl.minEq.toFixed(0).padStart(8)}    n/a          n/a   n/a    n/a      n/a`);
for (const wh of [1, 2, 3, 4]) {
  const s = runWinStreak(candles, { ...streakBase, hedgeKillPct: 10 }, 3, 3.0, wh);
  const pnlStr = (s.streakPnl>=0?"+":"")+s.streakPnl.toFixed(0);
  const tpRate = s.streakFires > 0 ? (s.hedgeTPs/s.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${("window="+wh+"h").padEnd(32)} $${s.finalEq.toFixed(0).padStart(8)} ${((s.returnPct>=0?"+":"")+s.returnPct.toFixed(1)+"%").padStart(9)} ${(s.maxDD.toFixed(1)+"%").padStart(7)} $${s.minEq.toFixed(0).padStart(8)} ${String(s.streakFires).padStart(6)} ${"$"+pnlStr.padStart(9)} ${String(s.hedgeTPs).padStart(5)} ${String(s.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`);
}

// ── Full combo: best params ──
console.log("\n  --- Best combo check (TP=3%, kill=10%, 3h window) ---");
for (const n of [3, 6, 9]) {
  const s = runWinStreak(candles, { ...streakBase, hedgeKillPct: 10 }, n, 3.0, 3);
  const pnlStr = (s.streakPnl>=0?"+":"")+s.streakPnl.toFixed(0);
  const tpRate = s.streakFires > 0 ? (s.hedgeTPs/s.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${("N="+n).padEnd(32)} $${s.finalEq.toFixed(0).padStart(8)} ${((s.returnPct>=0?"+":"")+s.returnPct.toFixed(1)+"%").padStart(9)} ${(s.maxDD.toFixed(1)+"%").padStart(7)} $${s.minEq.toFixed(0).padStart(8)} ${String(s.streakFires).padStart(6)} ${"$"+pnlStr.padStart(9)} ${String(s.hedgeTPs).padStart(5)} ${String(s.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`);
}

// ════════════════════════════════════════════
// PART 4: Jan 2026 stress window (same best config)
// ════════════════════════════════════════════
console.log("\n" + "=".repeat(120));
console.log("  PART 4: JAN 2026 → PRESENT — best config: N=3, 3h window, TP=3%, kill=10%, $1400 notional");
console.log("  Price range Jan 2026: $20.52 → $43.48 | Includes Jan pump, Feb/Mar drawdown");
console.log("=".repeat(120));
console.log(hdr); console.log(div);

const bslJan = runWinStreak(candles, streakJan26, 999);
console.log(`  ${"baseline (no short)".padEnd(32)} $${bslJan.finalEq.toFixed(0).padStart(8)} ${((bslJan.returnPct>=0?"+":"")+bslJan.returnPct.toFixed(1)+"%").padStart(9)} ${(bslJan.maxDD.toFixed(1)+"%").padStart(7)} $${bslJan.minEq.toFixed(0).padStart(8)}    n/a          n/a   n/a    n/a      n/a`);

// TP sweep on Jan window
for (const tp of [0.6, 1.0, 1.5, 2.0, 3.0]) {
  const s = runWinStreak(candles, { ...streakJan26, hedgeKillPct: 10 }, 3, tp, 3);
  const pnlStr = (s.streakPnl>=0?"+":"")+s.streakPnl.toFixed(0);
  const tpRate = s.streakFires > 0 ? (s.hedgeTPs/s.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${("N=3 TP="+tp+"% 3h kill=10%").padEnd(32)} $${s.finalEq.toFixed(0).padStart(8)} ${((s.returnPct>=0?"+":"")+s.returnPct.toFixed(1)+"%").padStart(9)} ${(s.maxDD.toFixed(1)+"%").padStart(7)} $${s.minEq.toFixed(0).padStart(8)} ${String(s.streakFires).padStart(6)} ${"$"+pnlStr.padStart(9)} ${String(s.hedgeTPs).padStart(5)} ${String(s.hedgeKills).padStart(6)} ${tpRate.padStart(7)}`);
}

// ════════════════════════════════════════════
// PART 5: Quarter-by-quarter verification
// ════════════════════════════════════════════
const quarters = [
  { label: "2024-12 → 2025-03", start: "2024-12-06", end: "2025-04-01" },
  { label: "2025-04 → 2025-06", start: "2025-04-01", end: "2025-07-01" },
  { label: "2025-07 → 2025-09", start: "2025-07-01", end: "2025-10-01" },
  { label: "2025-10 → 2025-12", start: "2025-10-01", end: "2026-01-01" },
  { label: "2026-01 → 2026-03", start: "2026-01-01", end: "2026-04-01" },
  { label: "2025-04 → present",  start: "2025-04-01", end: "2026-04-01" },
];
console.log("\n" + "=".repeat(115));
console.log("  PART 5: QUARTER-BY-QUARTER — baseline vs N=3, 3h, TP=3%, kill=10%");
console.log("=".repeat(115));
console.log(`  ${"Period".padEnd(36)} ${"Base MaxDD".padStart(11)} ${"Short MaxDD".padStart(12)} ${"ΔDD".padStart(7)} ${"Short PnL".padStart(11)} ${"Fires".padStart(7)} ${"TPrate".padStart(7)}`);
console.log("  " + "-".repeat(100));
for (const q of quarters) {
  const qc = candles.filter(c => c.timestamp >= new Date(q.start).getTime() && c.timestamp < new Date(q.end).getTime());
  if (qc.length < 100) { console.log(`  ${q.label.padEnd(36)} insufficient data`); continue; }
  const qBase = { ...streakBase, startDate: q.start, hedgeKillPct: 10 };
  const bsl2 = runWinStreak(qc, qBase, 999);
  const s3 = runWinStreak(qc, qBase, 3, 3.0, 3);
  const dDD = (s3.maxDD - bsl2.maxDD);
  const dStr = (dDD <= 0 ? "" : "+") + dDD.toFixed(2) + "%";
  const tpR = s3.streakFires > 0 ? (s3.hedgeTPs/s3.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${q.label.padEnd(36)} ${(bsl2.maxDD.toFixed(2)+"%").padStart(11)} ${(s3.maxDD.toFixed(2)+"%").padStart(12)} ${dStr.padStart(7)} ${"$"+(s3.streakPnl>=0?"+":"")+s3.streakPnl.toFixed(0)}.padStart(10)} ${String(s3.streakFires).padStart(7)} ${tpR.padStart(7)}`);
}

// ════════════════════════════════════════════
// PART 5: Quarter-by-quarter verification
// ════════════════════════════════════════════
const quarters = [
  { label: "2024-12 → 2025-03", start: "2024-12-06", end: "2025-04-01" },
  { label: "2025-04 → 2025-06", start: "2025-04-01", end: "2025-07-01" },
  { label: "2025-07 → 2025-09", start: "2025-07-01", end: "2025-10-01" },
  { label: "2025-10 → 2025-12", start: "2025-10-01", end: "2026-01-01" },
  { label: "2026-01 → 2026-03", start: "2026-01-01", end: "2026-04-01" },
  { label: "2025-04 → present (post-launch block)", start: "2025-04-01", end: "2026-04-01" },
];

console.log("\n" + "=".repeat(120));
console.log("  PART 5: QUARTER-BY-QUARTER — baseline vs best short config (N=3, 3h, TP=3%, kill=10%)");
console.log("=".repeat(120));
console.log(`  ${"Period".padEnd(38)} ${"Base MaxDD".padStart(11)} ${"Short MaxDD".padStart(12)} ${"ΔDD".padStart(7)} ${"Short PnL".padStart(11)} ${"Fires".padStart(7)} ${"TP rate".padStart(8)}`);
console.log("  " + "-".repeat(100));

for (const q of quarters) {
  const qCandles = candles.filter(c => c.timestamp >= new Date(q.start).getTime() && c.timestamp < new Date(q.end).getTime());
  if (qCandles.length < 100) { console.log(`  ${q.label.padEnd(38)} insufficient data`); continue; }
  const qBase = { ...streakBase, startDate: q.start, hedgeKillPct: 10 };
  const bsl = runWinStreak(qCandles, qBase, 999);
  const short1 = runWinStreak(qCandles, qBase, 3, 1.0, 3);
  const short3 = runWinStreak(qCandles, qBase, 3, 3.0, 3);
  const dDD1 = (short1.maxDD - bsl.maxDD).toFixed(2);
  const dDD3 = (short3.maxDD - bsl.maxDD).toFixed(2);
  const tpRate3 = short3.streakFires > 0 ? (short3.hedgeTPs/short3.streakFires*100).toFixed(0)+"%" : "n/a";
  console.log(`  ${q.label.padEnd(38)} ${(bsl.maxDD.toFixed(2)+"%").padStart(11)} ${(short3.maxDD.toFixed(2)+"%").padStart(12)} ${(dDD3.startsWith("-")?dDD3:("+"+dDD3)+"%").padStart(7)} ${"$"+(short3.streakPnl>=0?"+":"")+short3.streakPnl.toFixed(0).padStart(8)} ${String(short3.streakFires).padStart(7)} ${tpRate3.padStart(8)}`);
}
