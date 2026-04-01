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
