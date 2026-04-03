// ─────────────────────────────────────────────
// sim-xwave.ts — xwave participation filter study
//
// Extends the canonical live sim with xwave's entry filter:
//   • minAtrPct:         only add when 5m ATR14% > X
//   • minDrawdownFromHigh: only add when price is X% below rolling 24h high
//   • maxEmaRatio:       only add when close / 5m EMA200 < X
//
// Runs 3 blocks:
//   1. xwave — derived params from overlay study (ATR>0.3%, DD>1.5%, EMA<1.02)
//      with aggressive stale TP (8h → 0.3%) and no price-trigger (PF replaces it)
//   2. Live (current) — current config, no PF, CRSI hedge
//   3. Sweep — PF dimensions × current live config
//
// npx ts-node src/sim-xwave.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { RSI, ATR } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";
import { loadBotConfig } from "./bot/bot-config";

// ── Config ────────────────────────────────────────────────────────
const cfg = loadBotConfig();
const START_DATE      = process.env.SIM_START ?? "2025-01-01";
const startTs         = new Date(START_DATE).getTime();
const FUNDING_RATE_8H = 0.0001;

// ── Data ─────────────────────────────────────────────────────────
const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);
const btc5m: Candle[] = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
btc5m.sort((a, b) => a.timestamp - b.timestamp);

const c4H   = aggregate(c5m, 240);
const c1H   = aggregate(c5m,  60);
const btc1H = aggregate(btc5m, 60);

// ── EMA helper ───────────────────────────────────────────────────
function ema(vals: number[], p: number): number[] {
  const k = 2 / (p + 1); const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i-1] * (1 - k));
  return r;
}

// ── Binary search ─────────────────────────────────────────────────
function bsearch(ts: number[], target: number): number {
  let lo = 0, hi = ts.length - 1, res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= target) { res = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return res;
}

console.log("Precomputing indicators...");

// ── 4H trend gate ─────────────────────────────────────────────────
const trendHostileMap = new Map<number, boolean>();
{
  const closes = c4H.map(b => b.close);
  const e200 = ema(closes, 200);
  const e50  = ema(closes, 50);
  for (let i = 1; i < c4H.length; i++) {
    trendHostileMap.set(c4H[i].timestamp, closes[i] < e200[i] && e50[i] < e50[i-1]);
  }
}
const ts4H = c4H.map(b => b.timestamp);
function isTrendHostile(ts: number): boolean {
  const i = bsearch(ts4H, ts);
  if (i < 1) return false;
  return trendHostileMap.get(c4H[i-1].timestamp) ?? false;
}

// ── BTC 1H returns ────────────────────────────────────────────────
const btcRetMap = new Map<number, number>();
{
  for (let i = 1; i < btc1H.length; i++) {
    const ret = (btc1H[i].close - btc1H[i-1].close) / btc1H[i-1].close * 100;
    btcRetMap.set(btc1H[i].timestamp, +ret.toFixed(4));
  }
}
const tsBtc1H = btc1H.map(b => b.timestamp);
function getBtcRet(ts: number): number | null {
  const i = bsearch(tsBtc1H, ts);
  if (i < 1) return null;
  return btcRetMap.get(btc1H[i-1].timestamp) ?? null;
}

// ── 1H ATR vol gate (hedge) ───────────────────────────────────────
const hedgeVolBlockMap = new Map<number, boolean>();
{
  const highs  = c1H.map(b => b.high);
  const lows   = c1H.map(b => b.low);
  const closes = c1H.map(b => b.close);
  const atr14  = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const offset = closes.length - atr14.length;
  for (let i = 0; i < atr14.length; i++) {
    const barIdx = i + offset;
    const atrPct = (atr14[i] / closes[barIdx]) * 100;
    const lookback = Math.min(100, i + 1);
    const window: number[] = [];
    for (let k = Math.max(0, i - lookback + 1); k <= i; k++) {
      window.push((atr14[k] / closes[k + offset]) * 100);
    }
    window.sort((a, b) => a - b);
    const med = window[Math.floor(window.length / 2)];
    hedgeVolBlockMap.set(c1H[barIdx].timestamp, med > 0 && atrPct > med * cfg.hedge.atrVolMultiplier);
  }
}
const ts1H = c1H.map(b => b.timestamp);
function isHedgeVolBlocked(ts: number): boolean {
  const i = bsearch(ts1H, ts);
  if (i < 1) return false;
  return hedgeVolBlockMap.get(c1H[i-1].timestamp) ?? false;
}

// ── CRSI 4H ──────────────────────────────────────────────────────
const crsi4HMap = new Map<number, number>();
{
  const closes = c4H.map(b => b.close);
  for (let i = 103; i < closes.length; i++) {
    const sl = closes.slice(0, i + 1);
    const r3 = RSI.calculate({ period: 3, values: sl });
    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < sl.length; j++) {
      if      (sl[j] > sl[j-1]) streak = streak > 0 ? streak + 1 :  1;
      else if (sl[j] < sl[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const sr   = RSI.calculate({ period: 2, values: streaks });
    const ret  = (sl[sl.length-1] - sl[sl.length-2]) / sl[sl.length-2] * 100;
    const hist = sl.slice(-101);
    const rets = hist.slice(1).map((v, k) => (v - hist[k]) / hist[k] * 100);
    const rank = rets.filter(r => r < ret).length / rets.length * 100;
    crsi4HMap.set(c4H[i].timestamp, +((r3[r3.length-1] + sr[sr.length-1] + rank) / 3).toFixed(2));
  }
}
function getCrsi4H(ts: number): number | null {
  const i = bsearch(ts4H, ts);
  if (i < 1) return null;
  return crsi4HMap.get(c4H[i-1].timestamp) ?? null;
}

// ── Participation filter: 5m ATR14% ───────────────────────────────
// Precomputed once, indexed by 5m bar index
const atr5mPct: number[] = [];
{
  const tr = [c5m[0].high - c5m[0].low];
  for (let j = 1; j < c5m.length; j++) {
    const h = c5m[j].high, l = c5m[j].low, pc = c5m[j-1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const k14 = 2 / 15;
  let atr = tr[0];
  atr5mPct.push((atr / c5m[0].close) * 100);
  for (let j = 1; j < tr.length; j++) {
    atr = tr[j] * k14 + atr * (1 - k14);
    atr5mPct.push((atr / c5m[j].close) * 100);
  }
}

// ── Participation filter: 5m EMA200 ───────────────────────────────
const ema200_5m: number[] = ema(c5m.map(b => b.close), 200);

// ── Types ─────────────────────────────────────────────────────────
interface Pos { ep: number; et: number; qty: number; notional: number; }
interface HedgePos { ep: number; qty: number; notional: number; et: number; }

interface SimCfg {
  // Participation filter
  minAtrPct:          number;   // 0 = disabled
  minDrawdownFromHigh: number;  // 0 = disabled
  maxEmaRatio:        number;   // 0 = disabled
  // If PF is active, bypass the 30m time gate in favour of PF quality check
  pfReplacesTimeGate: boolean;

  // Stale TP override (xwave uses aggressive 8h / 0.3%)
  staleHoursOverride:    number | null;  // null = use bot-config value
  reducedTpPctOverride:  number | null;

  // Price trigger (set 0 to disable, e.g. when PF replaces it)
  priceTriggerPct: number;

  // CRSI hedge
  crsiEnabled:    boolean;
  crsiThreshold:  number;
  crsiNotionalPct: number;
}

interface SimResult {
  finalEq:    number;
  maxDD:      number;
  episodes:   number;
  wins:       number;
  kills:      number;
  flats:      number;
  hedgeFires: number;
  hedgePnl:   number;
  pfBlocked:  number;
  monthlyLadder: Record<string, number>;
  monthlyHedge:  Record<string, number>;
}

// ── Core sim ──────────────────────────────────────────────────────
function runSim(sc: SimCfg): SimResult {
  let capital = cfg.initialCapital;
  let peakEq  = capital, maxDD = 0;

  let longs:  Pos[]        = [];
  let hedge:  HedgePos | null = null;
  let lastAdd = 0;
  let lastEntryPrice = 0;
  let riskOffUntil = 0;
  let hedgeArmed   = true;

  let episodes  = 0, wins = 0, kills = 0, flats = 0;
  let hedgeFires = 0, hedgePnl = 0;
  let pfBlocked  = 0;

  const monthlyLadder: Record<string, number> = {};
  const monthlyHedge:  Record<string, number> = {};

  const staleHours   = sc.staleHoursOverride   ?? cfg.exits.staleHours;
  const reducedTpPct = sc.reducedTpPctOverride  ?? cfg.exits.reducedTpPct;

  function closeLongs(price: number, ts: number, isWin: boolean, reason: string): number {
    let pnl = 0;
    for (const p of longs) {
      const raw  = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8 * 3600000));
      pnl += raw - fees - fund;
    }
    capital += pnl;
    episodes++;
    if (isWin) wins++;
    if (reason === "KILL") kills++;
    if (reason === "FLAT") flats++;

    const m = new Date(ts).toISOString().slice(0, 7);
    monthlyLadder[m] = (monthlyLadder[m] ?? 0) + pnl;

    // Close hedge with ladder
    if (hedge) {
      const hRaw  = (hedge.ep - price) * hedge.qty;
      const hFees = hedge.notional * cfg.feeRate + price * hedge.qty * cfg.feeRate;
      const hPnl  = hRaw - hFees;
      hedgePnl += hPnl;
      capital  += hPnl;
      monthlyHedge[m] = (monthlyHedge[m] ?? 0) + hPnl;
      hedge = null;
    }

    longs = [];
    lastEntryPrice = 0;
    hedgeArmed = true;
    return pnl;
  }

  for (let i = 0; i < c5m.length; i++) {
    const c = c5m[i];
    if (c.timestamp < startTs) continue;
    const { close, high, timestamp: ts } = c;

    // DD tracking
    const longUr  = longs.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const hedgeUr = hedge ? (hedge.ep - close) * hedge.qty : 0;
    const eq = capital + longUr + hedgeUr;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── Position exits ─────────────────────────────────────────────
    if (longs.length > 0) {
      const tQty    = longs.reduce((s, p) => s + p.qty, 0);
      const avgE    = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnlP = (close - avgE) / avgE * 100;
      const ageH    = (ts - longs[0].et) / 3600000;
      const hostile = isTrendHostile(ts);
      const stale   = cfg.exits.softStale && ageH >= staleHours && avgPnlP < 0;
      const tpPct   = stale ? reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tpPct / 100);

      // 1. Batch TP
      if (high >= tpPrice) {
        const pnl = closeLongs(tpPrice, ts, true, stale ? "STALE_TP" : "TP");
        continue;
      }

      // 2. Emergency kill
      if (cfg.exits.emergencyKill && avgPnlP <= cfg.exits.emergencyKillPct) {
        closeLongs(close, ts, false, "KILL");
        continue;
      }

      // 3. Hard flatten
      if (cfg.exits.hardFlatten && ageH >= cfg.exits.hardFlattenHours &&
          avgPnlP <= cfg.exits.hardFlattenPct && hostile) {
        closeLongs(close, ts, false, "FLAT");
        continue;
      }
    }

    // ── CRSI hedge ────────────────────────────────────────────────
    if (sc.crsiEnabled && longs.length > 0 && !hedge && hedgeArmed) {
      const cooldownOk = ts - (hedge ? 0 : 0) >= 0; // hedge is null here always
      const crsi = getCrsi4H(ts);
      if (crsi !== null && crsi < sc.crsiThreshold) {
        const volOk = !cfg.hedge.blockHighVol || !isHedgeVolBlocked(ts);
        const cooldownMs = cfg.hedge.cooldownMin * 60000;
        // track last hedge close time via closeLongs (hedge closed there)
        if (volOk) {
          const totalNotional = longs.reduce((s, p) => s + p.notional, 0);
          const hNotional = totalNotional * sc.crsiNotionalPct;
          hedge = { ep: close, qty: hNotional / close, notional: hNotional, et: ts };
          hedgeFires++;
          hedgeArmed = false; // one hedge per episode
        }
      }
    }

    // ── Entry: canAdd? ────────────────────────────────────────────
    const timeGap = (ts - lastAdd) / 60000;
    const timeOk  = timeGap >= cfg.addIntervalMin;
    const priceOk = sc.priceTriggerPct > 0 && longs.length > 0 &&
                    close <= lastEntryPrice * (1 - sc.priceTriggerPct / 100);
    const canAdd  = (timeOk || priceOk) && longs.length < cfg.maxPositions;
    if (!canAdd) continue;

    // ── Trend gate ────────────────────────────────────────────────
    if (isTrendHostile(ts)) continue;

    // ── BTC gate ──────────────────────────────────────────────────
    if (ts < riskOffUntil) continue;
    const btcRet = getBtcRet(ts);
    if (btcRet !== null && btcRet < cfg.filters.btcDropPct) {
      riskOffUntil = ts + cfg.filters.riskOffCooldownMin * 60000;
      continue;
    }

    // ── Ladder-local kill ─────────────────────────────────────────
    if (cfg.filters.ladderLocalKill && longs.length > 0) {
      const tQty  = longs.reduce((s, p) => s + p.qty, 0);
      const avgE  = longs.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPP = (close - avgE) / avgE * 100;
      const ageH  = (ts - longs[0].et) / 3600000;
      if (ageH >= cfg.filters.maxUnderwaterHours && avgPP <= cfg.filters.maxUnderwaterPct) continue;
    }

    // ── Participation filter ──────────────────────────────────────
    if (sc.minAtrPct > 0 || sc.minDrawdownFromHigh > 0 || sc.maxEmaRatio > 0) {
      let blocked = false;

      // ATR filter: 5m ATR14 as % of close
      if (!blocked && sc.minAtrPct > 0) {
        if (atr5mPct[i] < sc.minAtrPct) blocked = true;
      }

      // Drawdown from 24h rolling high
      if (!blocked && sc.minDrawdownFromHigh > 0) {
        const lookback = Math.min(i, 288); // 288 × 5m = 24h
        let high24h = 0;
        for (let j = i - lookback; j <= i; j++) {
          if (c5m[j].high > high24h) high24h = c5m[j].high;
        }
        const ddFromHigh = high24h > 0 ? (high24h - close) / high24h * 100 : 0;
        if (ddFromHigh < sc.minDrawdownFromHigh) blocked = true;
      }

      // EMA ratio: close / 5m EMA200
      if (!blocked && sc.maxEmaRatio > 0) {
        const ratio = close / ema200_5m[i];
        if (ratio > sc.maxEmaRatio) blocked = true;
      }

      if (blocked) { pfBlocked++; continue; }
    }

    // ── Size + margin check ───────────────────────────────────────
    const lvl      = longs.length;
    const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
    const usedMargin = longs.reduce((s, p) => s + p.notional / cfg.leverage, 0) +
                       (hedge ? hedge.notional / cfg.leverage : 0);
    const margin = notional / cfg.leverage;
    if (capital - usedMargin < margin || capital <= 0) continue;

    // ── Open rung ─────────────────────────────────────────────────
    longs.push({ ep: close, et: ts, qty: notional / close, notional });
    lastAdd = ts;
    lastEntryPrice = close;
  }

  return { finalEq: capital, maxDD, episodes, wins, kills, flats, hedgeFires, hedgePnl, pfBlocked, monthlyLadder, monthlyHedge };
}

// ── Output helpers ────────────────────────────────────────────────
const SEP  = "═".repeat(115);
const SEP2 = "─".repeat(115);
const $n   = (v: number) => (v >= 0 ? "$+" : "$") + v.toFixed(0);
const sum  = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);

function printResult(label: string, r: SimResult) {
  const wr = r.episodes ? (r.wins / r.episodes * 100).toFixed(0) : "—";
  console.log(
    `  ${label.padEnd(42)}` +
    `  Eq=${("$"+r.finalEq.toFixed(0)).padStart(8)}` +
    `  DD=${r.maxDD.toFixed(1).padStart(5)}%` +
    `  WR=${String(wr).padStart(3)}%` +
    `  Eps=${String(r.episodes).padStart(4)}` +
    `  K=${String(r.kills).padStart(3)}  F=${String(r.flats).padStart(2)}` +
    `  HgFires=${String(r.hedgeFires).padStart(4)}` +
    `  HgPnL=${$n(r.hedgePnl).padStart(7)}` +
    `  PFblk=${String(r.pfBlocked).padStart(5)}`
  );
}

function printMonthly(label: string, r: SimResult) {
  console.log(`\n  ── Monthly: ${label} ──`);
  console.log(`  ${"Month".padEnd(8)} ${"Ladder".padEnd(10)} ${"Hedge".padEnd(9)} ${"Net".padEnd(10)} WR`);
  console.log("  " + "─".repeat(50));
  const allMonths = new Set([...Object.keys(r.monthlyLadder), ...Object.keys(r.monthlyHedge)]);
  for (const m of [...allMonths].sort()) {
    const lp = r.monthlyLadder[m] ?? 0;
    const hp = r.monthlyHedge[m]  ?? 0;
    console.log(`  ${m}  ${$n(lp).padStart(8)}  ${$n(hp).padStart(7)}  ${$n(lp+hp).padStart(8)}`);
  }
  console.log(`  ${"TOTAL".padEnd(8)}  ${$n(sum(r.monthlyLadder)).padStart(8)}  ${$n(sum(r.monthlyHedge)).padStart(7)}  ${$n(sum(r.monthlyLadder)+sum(r.monthlyHedge)).padStart(8)}`);
}

// ════════════════════════════════════════════════════════════════
console.log(`\n${SEP}`);
console.log(`  SIM-XWAVE — Participation Filter Study — ${START_DATE} → present`);
console.log(`  Base: $${cfg.basePositionUsdt}  Capital: $${cfg.initialCapital}  Scale: ${cfg.addScaleFactor}  TP: ${cfg.tpPct}%  MaxPos: ${cfg.maxPositions}`);
console.log(SEP);
console.log(`\n  ${"Config".padEnd(42)} ${"Equity".padEnd(10)} ${"DD".padEnd(8)} ${"WR".padEnd(6)} ${"Eps".padEnd(7)} ${"K/F".padEnd(8)} ${"HgFires".padEnd(11)} ${"HgPnL".padEnd(10)} PFblk`);
console.log("  " + SEP2);

// ── BLOCK 1: xwave replication ────────────────────────────────────
console.log("\n  ── BLOCK 1: xwave (ATR>0.3%, DD>1.5%, EMA<1.02, stale 8h→0.3%, no price trigger) ──");

const xwaveBase: SimCfg = {
  minAtrPct:           0.30,
  minDrawdownFromHigh: 1.5,
  maxEmaRatio:         1.02,
  pfReplacesTimeGate:  false,
  staleHoursOverride:  8,
  reducedTpPctOverride: 0.3,
  priceTriggerPct:     0,      // xwave uses PF instead of priceTrigger
  crsiEnabled:         true,
  crsiThreshold:       cfg.hedge.crsiThreshold,
  crsiNotionalPct:     cfg.hedge.crsiNotionalPct,
};

const xwaveNoHedge: SimCfg = { ...xwaveBase, crsiEnabled: false };
const xwaveHedge:   SimCfg = { ...xwaveBase };
const xwaveRelaxed: SimCfg = { ...xwaveBase, minDrawdownFromHigh: 1.0, maxEmaRatio: 1.05 };
const xwaveTight:   SimCfg = { ...xwaveBase, minDrawdownFromHigh: 2.0, maxEmaRatio: 1.00 };
const xwaveAtrOnly: SimCfg = { ...xwaveBase, minDrawdownFromHigh: 0, maxEmaRatio: 0 };
const xwaveDdOnly:  SimCfg = { ...xwaveBase, minAtrPct: 0, maxEmaRatio: 0 };

printResult("xwave (ATR>0.3 DD>1.5 EMA<1.02) no hedge", runSim(xwaveNoHedge));
printResult("xwave (ATR>0.3 DD>1.5 EMA<1.02) + CRSI", runSim(xwaveHedge));
printResult("xwave relaxed  (DD>1.0 EMA<1.05) + CRSI", runSim(xwaveRelaxed));
printResult("xwave tight    (DD>2.0 EMA<1.00) + CRSI", runSim(xwaveTight));
printResult("xwave ATR-only (ATR>0.3)         + CRSI", runSim(xwaveAtrOnly));
printResult("xwave DD-only  (DD>1.5)          + CRSI", runSim(xwaveDdOnly));

// ── BLOCK 2: current live config ──────────────────────────────────
console.log("\n  ── BLOCK 2: current live config ──");

const liveBase: SimCfg = {
  minAtrPct:           0,
  minDrawdownFromHigh: 0,
  maxEmaRatio:         0,
  pfReplacesTimeGate:  false,
  staleHoursOverride:  null,
  reducedTpPctOverride: null,
  priceTriggerPct:     cfg.priceTriggerPct,
  crsiEnabled:         true,
  crsiThreshold:       cfg.hedge.crsiThreshold,
  crsiNotionalPct:     cfg.hedge.crsiNotionalPct,
};

const liveNoHedge: SimCfg = { ...liveBase, crsiEnabled: false };
const liveResult   = runSim(liveBase);
const liveNoHgResult = runSim(liveNoHedge);

printResult("live: no hedge (baseline)",      liveNoHgResult);
printResult("live: + CRSI hedge (deployed)",  liveResult);

// ── BLOCK 3: Sweep — PF on live config ────────────────────────────
console.log("\n  ── BLOCK 3: Sweep — participation filter on live config + CRSI hedge ──");

const sweeps: Array<[string, Partial<SimCfg>]> = [
  // ATR only
  ["PF: ATR>0.2",                    { minAtrPct: 0.2 }],
  ["PF: ATR>0.3",                    { minAtrPct: 0.3 }],
  ["PF: ATR>0.5",                    { minAtrPct: 0.5 }],
  // DD from high only
  ["PF: DD>0.5 (= priceTrig)",       { minDrawdownFromHigh: 0.5, priceTriggerPct: 0 }],
  ["PF: DD>1.5 (xwave)",             { minDrawdownFromHigh: 1.5, priceTriggerPct: 0 }],
  ["PF: DD>2.0",                     { minDrawdownFromHigh: 2.0, priceTriggerPct: 0 }],
  ["PF: DD>3.0",                     { minDrawdownFromHigh: 3.0, priceTriggerPct: 0 }],
  // EMA ratio only
  ["PF: EMA<1.02",                   { maxEmaRatio: 1.02 }],
  ["PF: EMA<1.05",                   { maxEmaRatio: 1.05 }],
  // Combined
  ["PF: ATR>0.3 + DD>1.5",          { minAtrPct: 0.3, minDrawdownFromHigh: 1.5, priceTriggerPct: 0 }],
  ["PF: ATR>0.3 + DD>2.0",          { minAtrPct: 0.3, minDrawdownFromHigh: 2.0, priceTriggerPct: 0 }],
  ["PF: ATR>0.3 + EMA<1.02",        { minAtrPct: 0.3, maxEmaRatio: 1.02 }],
  ["PF: ATR>0.3 + DD>1.5 + EMA<1.02", { minAtrPct: 0.3, minDrawdownFromHigh: 1.5, maxEmaRatio: 1.02, priceTriggerPct: 0 }],
  ["PF: ATR>0.3 + DD>1.5 + EMA<1.05", { minAtrPct: 0.3, minDrawdownFromHigh: 1.5, maxEmaRatio: 1.05, priceTriggerPct: 0 }],
  // Stale TP combos
  ["PF: ATR>0.3 + stale8h→0.3%",    { minAtrPct: 0.3, staleHoursOverride: 8, reducedTpPctOverride: 0.3 }],
  ["PF: ATR>0.3+DD>1.5 stale8→0.3", { minAtrPct: 0.3, minDrawdownFromHigh: 1.5, staleHoursOverride: 8, reducedTpPctOverride: 0.3, priceTriggerPct: 0 }],
  // Full xwave on live scale (ATR+DD+EMA+stale)
  ["PF: full-xwave on live config",  { minAtrPct: 0.3, minDrawdownFromHigh: 1.5, maxEmaRatio: 1.02, staleHoursOverride: 8, reducedTpPctOverride: 0.3, priceTriggerPct: 0 }],
];

let bestEq = liveResult.finalEq;
let bestLabel = "live + CRSI (deployed)";

for (const [label, overrides] of sweeps) {
  const sc: SimCfg = { ...liveBase, ...overrides };
  const r = runSim(sc);
  printResult(label, r);
  if (r.finalEq > bestEq) { bestEq = r.finalEq; bestLabel = label; }
}

// ── Summary ───────────────────────────────────────────────────────
console.log(`\n${SEP}`);
console.log(`  Best result: ${bestLabel}  →  $${bestEq.toFixed(0)}`);
console.log(SEP);

// ── Monthly detail on key configs ─────────────────────────────────
const xwaveFull = runSim(xwaveHedge);
const liveFull  = runSim(liveResult === liveResult ? liveBase : liveBase); // re-use result
printMonthly("xwave (ATR>0.3 DD>1.5 EMA<1.02 + CRSI)", xwaveFull);
printMonthly("live + CRSI (deployed)", runSim(liveBase));
