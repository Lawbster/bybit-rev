// ─────────────────────────────────────────────
// sim-combined.ts — ladder + CRSI hedge + wed-short on shared capital
//
// Runs both strategies on the same $1k account.
// Answers: does combined margin ever breach capital?
//          what is the real max DD and P&L split?
//
// npx ts-node src/sim-combined.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { RSI, EMA, ATR } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";
import { loadBotConfig } from "./bot/bot-config";

// ── Config ────────────────────────────────────────────────────────
const cfg = loadBotConfig();
const START_DATE      = process.env.SIM_START ?? "2025-01-01";
const startTs         = new Date(START_DATE).getTime();
const FUNDING_RATE_8H = 0.0001;

// Wed-short params (from wed-short-config.json)
const WS = {
  nearHighPct:      1.25,
  entryAfterHourUTC: 18,
  tpPct:            1.0,
  stopPct:          2.0,
  expiryHourUTC:    12,   // Thu 12:00 UTC
  notionalUsdt:     1000,
  leverage:         10,
  feeRate:          0.00055,
};

// CRSI hedge params (best from sweep)
const CRSI_THRESHOLD   = 15;
const CRSI_NOTIONAL_PCT = 0.75;

// ── Data ─────────────────────────────────────────────────────────
const c5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
c5m.sort((a, b) => a.timestamp - b.timestamp);
const btc5m: Candle[] = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
btc5m.sort((a, b) => a.timestamp - b.timestamp);

const c4H  = aggregate(c5m, 240);
const c1H  = aggregate(c5m,  60);
const btc1H = aggregate(btc5m, 60);

// ── EMA helper ───────────────────────────────────────────────────
function ema(vals: number[], p: number): number[] {
  const k = 2 / (p + 1); const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i-1] * (1 - k));
  return r;
}

function bsearch(ts: number[], target: number): number {
  let lo = 0, hi = ts.length - 1, res = -1;
  while (lo <= hi) { const mid = (lo+hi)>>1; if (ts[mid] <= target) { res=mid; lo=mid+1; } else hi=mid-1; }
  return res;
}

// ── Precompute indicators ─────────────────────────────────────────
console.log("Precomputing indicators...");

const trendHostileMap = new Map<number, boolean>();
{
  const closes = c4H.map(b => b.close);
  const e200 = ema(closes, 200), e50 = ema(closes, 50);
  for (let i = 1; i < c4H.length; i++)
    trendHostileMap.set(c4H[i].timestamp, closes[i] < e200[i] && e50[i] < e50[i-1]);
}
const ts4H = c4H.map(b => b.timestamp);
function isTrendHostile(ts: number): boolean {
  const i = bsearch(ts4H, ts); if (i < 1) return false;
  return trendHostileMap.get(c4H[i-1].timestamp) ?? false;
}

const btcRetMap = new Map<number, number>();
{ for (let i = 1; i < btc1H.length; i++) btcRetMap.set(btc1H[i].timestamp, (btc1H[i].close - btc1H[i-1].close) / btc1H[i-1].close * 100); }
const tsBtc1H = btc1H.map(b => b.timestamp);
function getBtcRet(ts: number): number | null {
  const i = bsearch(tsBtc1H, ts); if (i < 1) return null;
  return btcRetMap.get(btc1H[i-1].timestamp) ?? null;
}

const rsi1HMap = new Map<number, number>();
{ const cl = c1H.map(b=>b.close); const v = RSI.calculate({period:14,values:cl}); const off=cl.length-v.length; for(let i=0;i<v.length;i++) rsi1HMap.set(c1H[i+off].timestamp,v[i]); }
const ts1H = c1H.map(b => b.timestamp);
function getRsi1H(ts: number): number | null {
  const i = bsearch(ts1H, ts); if (i < 1) return null;
  return rsi1HMap.get(c1H[i-1].timestamp) ?? null;
}
function getRoc5(ts: number): number | null {
  const i = bsearch(ts1H, ts); if (i < 1) return null;
  const cl = c1H.map(b=>b.close); const idx = i-1; if(idx < 5) return null;
  return (cl[idx]-cl[idx-5])/cl[idx-5]*100;
}

// CRSI 4H
const crsi4HMap = new Map<number, number>();
{
  const closes = c4H.map(b => b.close);
  for (let i = 103; i < closes.length; i++) {
    const sl = closes.slice(0, i+1);
    const r3 = RSI.calculate({period:3, values:sl});
    const streaks: number[] = []; let streak = 0;
    for (let j=1;j<sl.length;j++) {
      if(sl[j]>sl[j-1]) streak=streak>0?streak+1:1;
      else if(sl[j]<sl[j-1]) streak=streak<0?streak-1:-1;
      else streak=0; streaks.push(streak);
    }
    const sr = RSI.calculate({period:2,values:streaks});
    const ret = (sl[sl.length-1]-sl[sl.length-2])/sl[sl.length-2]*100;
    const hist = sl.slice(-101); const rets = hist.slice(1).map((v,k)=>(v-hist[k])/hist[k]*100);
    const rank = rets.filter(r=>r<ret).length/rets.length*100;
    crsi4HMap.set(c4H[i].timestamp, +((r3[r3.length-1]+sr[sr.length-1]+rank)/3).toFixed(2));
  }
}
function getCrsi4H(ts: number): number | null {
  const i = bsearch(ts4H, ts); if (i < 1) return null;
  return crsi4HMap.get(c4H[i-1].timestamp) ?? null;
}

// Wednesday daily high map (ts of Wed midnight UTC → rolling high up to each 5m bar)
// Precompute per-5m: what is today's rolling high?
const rollingDayHighMap = new Map<number, number>(); // 5m ts → rolling high from day start
{
  let curDayStart = 0, curHigh = 0;
  for (const c of c5m) {
    const dayStart = Math.floor(c.timestamp / 86400000) * 86400000;
    if (dayStart !== curDayStart) { curDayStart = dayStart; curHigh = 0; }
    if (c.high > curHigh) curHigh = c.high;
    rollingDayHighMap.set(c.timestamp, curHigh);
  }
}

console.log("Done.\n");

// ── Sim ───────────────────────────────────────────────────────────
interface Pos { ep: number; et: number; qty: number; notional: number; }
interface HedgePos { ep: number; qty: number; notional: number; et: number; }
interface WedPos { ep: number; qty: number; notional: number; tpPrice: number; stopPrice: number; expiryTs: number; wedDate: string; }

interface MonthStats {
  ladderPnl: number; hedgePnl: number; wsPnl: number;
  ladderN: number; wsN: number; ladderWins: number; wsWins: number;
  maxMarginUsed: number;
}

function runCombined() {
  let capital = cfg.initialCapital;
  let peakEq  = capital, maxDD = 0;

  // Ladder state
  let longs: Pos[]        = [];
  let hedge: HedgePos | null = null;
  let lastAdd             = 0;
  let lastEntryPrice      = 0;
  let hedgeArmed          = true;
  let riskOffUntil        = 0;
  let hedgeLastCloseTs    = 0;

  // Wed-short state
  let wedPos: WedPos | null = null;
  let lastCloseWedDate      = "";

  // P&L accumulators
  let totalLadderPnl = 0, totalHedgePnl = 0, totalWsPnl = 0;
  let ladderKills = 0, ladderFlats = 0, ladderTps = 0;
  let wsWins = 0, wsLoss = 0, wsExpiry = 0;
  let hedgeFires = 0;
  let maxMarginEver = 0;

  const monthlyStats: Record<string, MonthStats> = {};
  function getMonth(ts: number): MonthStats {
    const m = new Date(ts).toISOString().slice(0,7);
    if (!monthlyStats[m]) monthlyStats[m] = { ladderPnl:0, hedgePnl:0, wsPnl:0, ladderN:0, wsN:0, ladderWins:0, wsWins:0, maxMarginUsed:0 };
    return monthlyStats[m];
  }

  // margin helpers
  function ladderMargin() { return longs.reduce((s,p) => s + p.notional/cfg.leverage, 0); }
  function hedgeMargin()  { return hedge  ? hedge.notional  / cfg.leverage : 0; }
  function wsMargin()     { return wedPos ? wedPos.notional / WS.leverage  : 0; }
  function totalMargin()  { return ladderMargin() + hedgeMargin() + wsMargin(); }

  function closeLongsInternal(price: number, ts: number, reason: string) {
    let pnl = 0;
    for (const p of longs) {
      const raw  = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const fund = p.notional * FUNDING_RATE_8H * ((ts - p.et) / (8*3600000));
      pnl += raw - fees - fund;
    }
    capital += pnl;
    totalLadderPnl += pnl;
    const ms = getMonth(ts);
    ms.ladderPnl += pnl; ms.ladderN++;
    if (pnl > 0) { ms.ladderWins++; ladderTps++; }
    else if (reason === "EMERGENCY_KILL") ladderKills++;
    else if (reason === "HARD_FLATTEN")  ladderFlats++;

    // Close CRSI hedge with ladder
    if (hedge) {
      const hRaw  = (hedge.ep - price) * hedge.qty;
      const hFees = hedge.notional * cfg.feeRate + price * hedge.qty * cfg.feeRate;
      const hPnl  = hRaw - hFees;
      capital += hPnl; totalHedgePnl += hPnl;
      getMonth(ts).hedgePnl += hPnl;
      hedge = null; hedgeLastCloseTs = ts;
    }
    longs = []; lastEntryPrice = 0; hedgeArmed = true;
    return pnl;
  }

  for (const c of c5m) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;
    const h = new Date(ts).getUTCHours();
    const dow = new Date(ts).getUTCDay(); // 0=Sun, 3=Wed, 4=Thu

    // ── Equity / DD ────────────────────────────────────────────────
    const longUr  = longs.reduce((s,p) => s + (close-p.ep)*p.qty, 0);
    const hedgeUr = hedge  ? (hedge.ep  - close) * hedge.qty  : 0;
    const wsUr    = wedPos ? (wedPos.ep - close) * wedPos.qty : 0;
    const eq = capital + longUr + hedgeUr + wsUr;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? (peakEq - eq) / peakEq * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // Track max margin
    const curMargin = totalMargin();
    if (curMargin > maxMarginEver) maxMarginEver = curMargin;
    const ms = getMonth(ts);
    if (curMargin > ms.maxMarginUsed) ms.maxMarginUsed = curMargin;

    // ── Wed-short: manage open position ───────────────────────────
    if (wedPos) {
      const expired = ts >= wedPos.expiryTs;
      const tpHit   = low  <= wedPos.tpPrice;
      const slHit   = high >= wedPos.stopPrice;

      if (expired || tpHit || slHit) {
        const exitPrice = tpHit ? wedPos.tpPrice : slHit ? wedPos.stopPrice : close;
        const raw   = (wedPos.ep - exitPrice) * wedPos.qty;
        const fees  = wedPos.notional * WS.feeRate + exitPrice * wedPos.qty * WS.feeRate;
        const pnl   = raw - fees;
        capital += pnl; totalWsPnl += pnl;
        getMonth(ts).wsPnl += pnl; getMonth(ts).wsN++;
        if (tpHit) { wsWins++; getMonth(ts).wsWins++; }
        else if (slHit) wsLoss++;
        else wsExpiry++;
        wedPos = null;
      }
    }

    // ── Wed-short: entry ──────────────────────────────────────────
    if (!wedPos && dow === 3 && h >= WS.entryAfterHourUTC) {
      const todayStr = new Date(ts).toISOString().slice(0,10);
      if (lastCloseWedDate !== todayStr) {
        const dayHigh = rollingDayHighMap.get(ts) ?? close;
        const distFromHigh = (dayHigh - close) / dayHigh * 100;
        if (distFromHigh <= WS.nearHighPct) {
          const margin = WS.notionalUsdt / WS.leverage;
          if (capital - totalMargin() >= margin) {
            const tpPrice    = close * (1 - WS.tpPct   / 100);
            const stopPrice  = close * (1 + WS.stopPct  / 100);
            const thu = new Date(todayStr + "T00:00:00Z");
            thu.setUTCDate(thu.getUTCDate() + 1);
            const exp = thu.getTime() + WS.expiryHourUTC * 3600000;
            wedPos = { ep: close, qty: WS.notionalUsdt/close, notional: WS.notionalUsdt, tpPrice, stopPrice, expiryTs: exp, wedDate: todayStr };
            lastCloseWedDate = todayStr;
          }
        }
      }
    }

    // ── Ladder exits ──────────────────────────────────────────────
    if (longs.length > 0) {
      const tQty  = longs.reduce((s,p)=>s+p.qty,0);
      const avgE  = longs.reduce((s,p)=>s+p.ep*p.qty,0)/tQty;
      const avgPP = (close-avgE)/avgE*100;
      const ageH  = (ts-longs[0].et)/3600000;
      const hostile = isTrendHostile(ts);
      const stale = cfg.exits.softStale && ageH >= cfg.exits.staleHours && avgPP < 0;
      const tpPct = stale ? cfg.exits.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tpPct/100);

      if (high >= tpPrice)                                                                       { closeLongsInternal(tpPrice, ts, stale ? "STALE_TP" : "TP"); continue; }
      if (cfg.exits.emergencyKill && avgPP <= cfg.exits.emergencyKillPct)                        { closeLongsInternal(close,   ts, "EMERGENCY_KILL"); continue; }
      if (cfg.exits.hardFlatten && ageH >= cfg.exits.hardFlattenHours && avgPP <= cfg.exits.hardFlattenPct && hostile) { closeLongsInternal(close, ts, "HARD_FLATTEN"); continue; }
    }

    // ── CRSI hedge ────────────────────────────────────────────────
    if (longs.length > 0 && !hedge && hedgeArmed && ts - hedgeLastCloseTs >= cfg.hedge.cooldownMin * 60000) {
      const crsi = getCrsi4H(ts);
      if (crsi !== null && crsi < CRSI_THRESHOLD) {
        const totalNotional = longs.reduce((s,p)=>s+p.notional,0);
        const hNotional = totalNotional * CRSI_NOTIONAL_PCT;
        hedge = { ep: close, qty: hNotional/close, notional: hNotional, et: ts };
        hedgeFires++;
      }
    }

    // ── Ladder entries ────────────────────────────────────────────
    const timeOk  = (ts - lastAdd) / 60000 >= cfg.addIntervalMin;
    const priceOk = cfg.priceTriggerPct > 0 && longs.length > 0 && close <= lastEntryPrice * (1 - cfg.priceTriggerPct/100);
    if (!(timeOk || priceOk) || longs.length >= cfg.maxPositions) continue;
    if (isTrendHostile(ts)) continue;
    if (ts < riskOffUntil) continue;
    const btcRet = getBtcRet(ts);
    if (btcRet !== null && btcRet < cfg.filters.btcDropPct) { riskOffUntil = ts + cfg.filters.riskOffCooldownMin * 60000; continue; }
    if (cfg.filters.ladderLocalKill && longs.length > 0) {
      const tQty = longs.reduce((s,p)=>s+p.qty,0);
      const avgE = longs.reduce((s,p)=>s+p.ep*p.qty,0)/tQty;
      if ((ts-longs[0].et)/3600000 >= cfg.filters.maxUnderwaterHours && (close-avgE)/avgE*100 <= cfg.filters.maxUnderwaterPct) continue;
    }

    const lvl      = longs.length;
    const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
    const margin   = notional / cfg.leverage;
    if (capital - totalMargin() < margin || capital <= 0) continue;

    longs.push({ ep: close, et: ts, qty: notional/close, notional });
    lastAdd = ts; lastEntryPrice = close;
  }

  return { totalLadderPnl, totalHedgePnl, totalWsPnl, maxDD, finalEq: capital,
    ladderKills, ladderFlats, ladderTps, wsWins, wsLoss, wsExpiry, hedgeFires,
    maxMarginEver, monthlyStats };
}

// ── Run ───────────────────────────────────────────────────────────
console.log("Running combined sim...\n");
const r = runCombined();

const SEP = "═".repeat(100);
const $   = (v: number) => (v>=0?"$+":"$")+v.toFixed(0);
const sum = (a: number[]) => a.reduce((s,v)=>s+v,0);

console.log(SEP);
console.log(`  COMBINED SIM — 2Moon Ladder + CRSI Hedge + Wed-Short — ${START_DATE} → present`);
console.log(`  Ladder: base=$${cfg.basePositionUsdt} scale=${cfg.addScaleFactor} maxPos=${cfg.maxPositions} TP=${cfg.tpPct}% capital=$${cfg.initialCapital}`);
console.log(`  CRSI hedge: CRSI4H<${CRSI_THRESHOLD}, ${CRSI_NOTIONAL_PCT*100}% notional, closes with ladder`);
console.log(`  Wed-short: $${WS.notionalUsdt} notional @${WS.leverage}x | TP=${WS.tpPct}% | SL=${WS.stopPct}% | entry Wed>${WS.entryAfterHourUTC}h UTC within ${WS.nearHighPct}% of day high`);
console.log(SEP);

console.log(`\n  Final equity:    $${r.finalEq.toFixed(0)}   (started $${cfg.initialCapital})`);
console.log(`  Total PnL:       ${$(r.totalLadderPnl + r.totalHedgePnl + r.totalWsPnl)}`);
console.log(`  Max DD:          ${r.maxDD.toFixed(1)}%`);
console.log(`  Max margin used: $${r.maxMarginEver.toFixed(0)} of $${cfg.initialCapital} capital (${(r.maxMarginEver/cfg.initialCapital*100).toFixed(1)}%)`);

console.log(`\n  ── P&L split ──`);
console.log(`  Ladder:     ${$(r.totalLadderPnl).padStart(9)}   (kills=${r.ladderKills}  flats=${r.ladderFlats}  TPs=${r.ladderTps})`);
console.log(`  CRSI hedge: ${$(r.totalHedgePnl).padStart(9)}   (fires=${r.hedgeFires})`);
console.log(`  Wed-short:  ${$(r.totalWsPnl).padStart(9)}   (wins=${r.wsWins}  stops=${r.wsLoss}  expiry=${r.wsExpiry})`);

console.log(`\n  ── Monthly breakdown ──`);
console.log(`  ${"Month".padEnd(8)} ${"Ladder".padEnd(11)} ${"Hedge".padEnd(10)} ${"WedShort".padEnd(10)} ${"Net".padEnd(10)} ${"MaxMargin".padEnd(11)} WR-ladder`);
console.log("  " + "─".repeat(75));
for (const [m, ms] of Object.entries(r.monthlyStats).sort()) {
  const net = ms.ladderPnl + ms.hedgePnl + ms.wsPnl;
  const lWr = ms.ladderN ? (ms.ladderWins/ms.ladderN*100).toFixed(0)+"%" : "—";
  console.log(
    `  ${m}  Ladder=${$(ms.ladderPnl).padStart(8)}  Hedge=${$(ms.hedgePnl).padStart(7)}` +
    `  WedShort=${$(ms.wsPnl).padStart(7)}  Net=${$(net).padStart(7)}` +
    `  margin=$${ms.maxMarginUsed.toFixed(0).padStart(4)}  WR=${lWr}`
  );
}
console.log();
