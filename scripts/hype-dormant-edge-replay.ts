/**
 * Fable-5 pass 3: dormant edge mining — S/R execution actions, pulse hedges,
 * deep-add reopen, ladder shape, composite policies.
 *
 * Reuses the historical engine (scripts/hype-freerun-canonical-replay.ts).
 * September 4: source-time alignment repaired; exact live/maker parity NOT certified.
 * Old output totals and cached variants must be revalidated, not treated as controls.
 * Phase A (ledger) is ANCHORED DIAGNOSTIC (recorded shadow fires joined to live
 * episodes); phases B-E are free-running.
 *
 * Usage:
 *   npx ts-node scripts/hype-dormant-edge-replay.ts            # HL-era, phases A-E
 *   SET=long SIM_START=2025-07-01T00:00:00Z npx ts-node scripts/hype-dormant-edge-replay.ts  # Phase D candle-only
 */

import fs from "fs";
import path from "path";
import { BollingerBands, MACD } from "technicalindicators";
import { CausalMinuteLatest, observationAvailability, addAtAvailability, REPLAY_CAUSALITY_VERSION } from "./replay-causality";
import {
  buildSeries, runEngine, loadLiveEpisodes, loadCandles1m, streamJsonl, loadFundingRows,
  writeCsv, weekKey, iso, lowerBound, r, ensureDir, OUT_DIR, ROOT, START_TS,
  EngineParams, EngineResult, Series, Candle, HedgeOverlayCfg, SrExecCfg, EuphoriaCfg,
} from "./hype-freerun-canonical-replay";

const SET = (process.env.SET ?? "hl") as "hl" | "long";
const ONE_MIN = 60_000;
const ONE_HOUR = 3_600_000;
const FOUR_H = 4 * ONE_HOUR;
const DATA = path.join(ROOT, "data");
const FEE = 0.00055;

const EU_STOP: EuphoriaCfg = {
  minDepth: 8, pnlMax: -9, ret12hMax: null, requireAboveEma200: true, requireBelowVwap: true,
  avgEntryNearHighPct: null, watchMin: 45, reclaimPct: 1.2, hlScoreMin: null, lowerLowAlt: true,
};

// ── extra per-minute features + trigger series (attached onto Series) ────────

export async function minuteLast(file: string, pick: (row: any) => number | null, dataDir = DATA): Promise<CausalMinuteLatest<number>> {
  const out = new CausalMinuteLatest<number>();
  await streamJsonl(path.join(dataDir, file), row => {
    const ts = observationAvailability(row);
    const v = pick(row);
    if (v !== null && Number.isFinite(v)) out.observe(ts, v);
  });
  return out;
}

function lastAtOrBefore(keys: number[], startIdx: number, target: number): number {
  let k = startIdx;
  while (k + 1 < keys.length && keys[k + 1] <= target) k++;
  return k;
}

export async function attachDormantSeries(s: Series, fromIdx: number, dataDir = DATA): Promise<void> {
  if (fromIdx < 0 || fromIdx >= s.candles.length) throw new Error("Invalid S/R feature start");
  s.causalityVersion = REPLAY_CAUSALITY_VERSION;
  const candles = s.candles;
  const n = candles.length;
  console.error("[dormant] streaming extra feature files...");

  // Binance taker (vol ratio)
  const tBuy = new Map<number, number>();
  const tSell = new Map<number, number>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_taker_binance.jsonl"), row => {
    const at = observationAvailability(row, "binance_taker");
    addAtAvailability(tBuy, at, Number(row.buyVol) || 0);
    addAtAvailability(tSell, at, Number(row.sellVol) || 0);
  });
  // HL taker (notional ratio)
  const hBuy = new Map<number, number>();
  const hSell = new Map<number, number>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_taker_hyperliquid.jsonl"), row => {
    const at = observationAvailability(row, "hl_taker");
    addAtAvailability(hBuy, at, Number(row.buyNotional) || 0);
    addAtAvailability(hSell, at, Number(row.sellNotional) || 0);
  });
  // OI values
  const oiBy = await minuteLast("HYPEUSDT_oi_live.jsonl", row => Number(row.openInterestValue) || null, dataDir);
  const oiBn = await minuteLast("HYPEUSDT_oi_live_binance.jsonl", row => Number(row.openInterestValue) || null, dataDir);
  const oiHl = await minuteLast("HYPEUSDT_oi_live_hyperliquid.jsonl", row => Number(row.openInterestValue) || null, dataDir);
  const assetOi = await minuteLast("HYPEUSDT_asset_ctx_hyperliquid.jsonl", row => {
    const v = Number(row.openInterestValue);
    if (Number.isFinite(v)) return v;
    const oi = Number(row.openInterest); const mk = Number(row.markPrice);
    return Number.isFinite(oi) && Number.isFinite(mk) ? oi * mk : null;
  }, dataDir);
  const assetFd = await minuteLast("HYPEUSDT_asset_ctx_hyperliquid.jsonl", row => Number.isFinite(Number(row.fundingRate)) ? Number(row.fundingRate) : null, dataDir);
  const obImb = await minuteLast("HYPEUSDT_ob_bands_hyperliquid.jsonl", row => Number.isFinite(Number(row.imbalance_0_5)) ? Number(row.imbalance_0_5) : null, dataDir);
  const obRatio = await minuteLast("HYPEUSDT_ob_bands_hyperliquid.jsonl", row => {
    const b = Number(row.bidBands?.pct_0_5); const a = Number(row.askBands?.pct_0_5);
    return Number.isFinite(b) && b > 0 && Number.isFinite(a) ? a / b : null;
  }, dataDir);
  // Liquidations per minute (long/short usd)
  const liqLong = new Map<number, number>();
  const liqShort = new Map<number, number>();
  await streamJsonl(path.join(dataDir, "HYPEUSDT_liquidations.jsonl"), row => {
    const at = observationAvailability(row);
    const usd = Number(row.notionalUsd) || 0;
    if (row.liquidatedSide === "long") addAtAvailability(liqLong, at, usd);
    else if (row.liquidatedSide === "short") addAtAvailability(liqShort, at, usd);
  });
  const fdBy = await loadFundingRows(path.join(dataDir, "HYPEUSDT_funding_live.jsonl"));
  const fdBn = await loadFundingRows(path.join(dataDir, "HYPEUSDT_funding_live_binance.jsonl"));
  const fdHl = await loadFundingRows(path.join(dataDir, "HYPEUSDT_funding_live_hyperliquid.jsonl"));
  const btc = await loadCandles1m("BTCUSDT", dataDir);

  const oiByKeys = [...oiBy.keys()].sort((a, b) => a - b);
  const oiBnKeys = [...oiBn.keys()].sort((a, b) => a - b);
  const oiHlKeys = [...oiHl.keys()].sort((a, b) => a - b);
  const assetKeys = [...assetOi.keys()].sort((a, b) => a - b);
  const fdKeys = [...assetFd.keys()].sort((a, b) => a - b);
  const obKeys = [...obImb.keys()].sort((a, b) => a - b);

  console.error("[dormant] building per-minute features...");
  const trig: Record<string, boolean[]> = {};
  const T = ["cascade_book_pull", "ladder_deleverage", "pulse4", "pulse3", "may22", "d1_top_pulse", "d1_top_exhaustion", "cascade_liq", "ladder_downside"];
  for (const k of T) trig[k] = new Array(n).fill(false);
  s.pulseHostile = new Array(n).fill(false);
  s.pulseDeteriorating = new Array(n).fill(false);
  s.pulseReclaim = new Array(n).fill(false);
  s.hlAskWall = new Array(n).fill(false);
  s.hlExhaustion = new Array(n).fill(false);
  s.hlSupportBoost = new Array(n).fill(false);

  // d1Top building blocks: high3d rolling, bb1h %B, macd4h falling (completed bars)
  const done1h: number[] = [];
  const done4h: number[] = [];
  let cur1h = -1; let cur4h = -1; let c1hClose = 0; let c4hClose = 0;
  let bb1hPctB: number | null = null;
  let macdFalling = false;
  const highDeque: number[] = [];
  let h3Start = 0;
  const cursor = { oiBy: 0, oiBy4: 0, oiBn: 0, oiBn4: 0, oiHl: 0, oiHl4: 0, oiHl1: 0, a: 0, a1: 0, a4: 0, fd: 0, ob: 0, fby: 0, fbn: 0, fhl: 0, btc: 0, btc4: 0 };

  const oiPct = (map: Map<number, number>, keys: number[], ck: keyof typeof cursor, ck2: keyof typeof cursor, now: number, backMs: number): number | null => {
    if (!keys.length) return null;
    cursor[ck] = lastAtOrBefore(keys, cursor[ck], now);
    cursor[ck2] = lastAtOrBefore(keys, cursor[ck2], now - backMs);
    if (keys[cursor[ck]] > now || keys[cursor[ck2]] > now - backMs) return null;
    const a = map.get(keys[cursor[ck]])!;
    const b = map.get(keys[cursor[ck2]])!;
    return b ? ((a - b) / b) * 100 : null;
  };

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const now = c.endTs;
    // completed 1h/4h closes
    const b1 = Math.floor(c.ts / ONE_HOUR);
    const b4 = Math.floor(c.ts / FOUR_H);
    if (b1 !== cur1h) {
      if (cur1h >= 0) {
        done1h.push(c1hClose);
        if (done1h.length >= 22) {
          const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: done1h.slice(-60) });
          const last = bb[bb.length - 1];
          bb1hPctB = last && last.upper !== last.lower ? (done1h[done1h.length - 1] - last.lower) / (last.upper - last.lower) : null;
        }
      }
      cur1h = b1;
    }
    if (b4 !== cur4h) {
      if (cur4h >= 0) {
        done4h.push(c4hClose);
        if (done4h.length >= 40) {
          const m = MACD.calculate({ values: done4h.slice(-120), fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
          const h1 = m[m.length - 1]?.histogram; const h0 = m[m.length - 2]?.histogram;
          macdFalling = h1 !== undefined && h0 !== undefined && h1 < h0;
        }
      }
      cur4h = b4;
    }
    c1hClose = c.close;
    c4hClose = c.close;
    // rolling 3d high (incl current)
    const cutoff = now - 3 * 86_400_000;
    while (h3Start < i && candles[h3Start].endTs <= cutoff) {
      if (highDeque.length && highDeque[0] === h3Start) highDeque.shift();
      h3Start++;
    }
    while (highDeque.length && highDeque[0] < h3Start) highDeque.shift();
    while (highDeque.length && candles[highDeque[highDeque.length - 1]].high <= c.high) highDeque.pop();
    highDeque.push(i);
    if (i < fromIdx) continue;
    const high3d = candles[highDeque[0]].high;

    // taker windows (sum minute buckets)
    let tb1 = 0, ts1 = 0, tb4 = 0, ts4 = 0, hb15 = 0, hs15 = 0, hb1 = 0, hs1 = 0;
    for (let m = now - FOUR_H + ONE_MIN; m <= now; m += ONE_MIN) {
      const bv = tBuy.get(m) ?? 0; const sv = tSell.get(m) ?? 0;
      tb4 += bv; ts4 += sv;
      if (m > now - ONE_HOUR) {
        tb1 += bv; ts1 += sv;
        const hbv = hBuy.get(m) ?? 0; const hsv = hSell.get(m) ?? 0;
        hb1 += hbv; hs1 += hsv;
        if (m > now - 15 * ONE_MIN) { hb15 += hbv; hs15 += hsv; }
      }
    }
    const taker4h = ts4 > 0 ? tb4 / ts4 : null;
    const hlT15 = hs15 > 0 ? hb15 / hs15 : null;
    const hlT1h = hs1 > 0 ? hb1 / hs1 : null;

    const oiBy4 = oiPct(oiBy, oiByKeys, "oiBy", "oiBy4", now, FOUR_H);
    const oiBn4 = oiPct(oiBn, oiBnKeys, "oiBn", "oiBn4", now, FOUR_H);
    const oiHl4 = oiPct(oiHl, oiHlKeys, "oiHl", "oiHl4", now, FOUR_H);
    const oiHl1 = oiPct(oiHl, oiHlKeys, "oiHl", "oiHl1", now, ONE_HOUR);
    const aOi1 = oiPct(assetOi, assetKeys, "a", "a1", now, ONE_HOUR);
    const aOi4 = oiPct(assetOi, assetKeys, "a", "a4", now, FOUR_H);
    cursor.fd = lastAtOrBefore(fdKeys, cursor.fd, now);
    const hlFd = fdKeys.length && fdKeys[cursor.fd] <= now ? assetFd.get(fdKeys[cursor.fd])! : null;
    cursor.ob = lastAtOrBefore(obKeys, cursor.ob, now);
    const imb = obKeys.length && obKeys[cursor.ob] <= now ? obImb.get(obKeys[cursor.ob]) ?? null : null;
    const ratio = obKeys.length && obKeys[cursor.ob] <= now ? obRatio.get(obKeys[cursor.ob]) ?? null : null;
    while (cursor.fby + 1 < fdBy.length && fdBy[cursor.fby + 1].ts <= now) cursor.fby++;
    while (cursor.fbn + 1 < fdBn.length && fdBn[cursor.fbn + 1].ts <= now) cursor.fbn++;
    while (cursor.fhl + 1 < fdHl.length && fdHl[cursor.fhl + 1].ts <= now) cursor.fhl++;
    const by = fdBy.length && fdBy[cursor.fby].ts <= now ? fdBy[cursor.fby].rate : null;
    const bn = fdBn.length && fdBn[cursor.fbn].ts <= now ? fdBn[cursor.fbn].rate : null;
    const fhl = fdHl.length && fdHl[cursor.fhl].ts <= now ? fdHl[cursor.fhl].rate : null;
    const anyFundNeg = [by, bn, fhl].some(x => x !== null && x < 0);
    // BTC 4h move
    let btc4h: number | null = null;
    {
      let k = cursor.btc;
      while (k + 1 < btc.length && btc[k + 1].endTs <= now) k++;
      cursor.btc = k;
      let k4 = cursor.btc4;
      const t4 = now - FOUR_H;
      while (k4 + 1 < btc.length && btc[k4 + 1].ts <= t4) k4++;
      cursor.btc4 = k4;
      if (btc.length && btc[k].endTs <= now && btc[k4].ts >= t4 - 2 * ONE_MIN && btc[k4].open > 0) {
        btc4h = ((btc[k].close - btc[k4].open) / btc[k4].open) * 100;
      }
    }
    let liqL = 0, liqS = 0;
    for (let m = now - FOUR_H + ONE_MIN; m <= now; m += ONE_MIN) {
      liqL += liqLong.get(m) ?? 0;
      liqS += liqShort.get(m) ?? 0;
    }

    const breadthVals = [oiBy4, oiBn4, oiHl4].filter((x): x is number => x !== null);
    const breadth = breadthVals.length ? breadthVals.reduce((a, b) => a + b, 0) / breadthVals.length : null;
    const hlOi1 = aOi1 ?? oiHl1;
    const hlOi4 = aOi4 ?? oiHl4;
    const askWall = (imb !== null && imb <= -0.20) || (ratio !== null && ratio >= 1.35);
    const bidWall = (imb !== null && imb >= 0.20) || (ratio !== null && ratio <= 0.75);
    const fade = hlT15 !== null && hlT1h !== null && hlT15 < hlT1h * 0.75;
    const sellP = (hlT15 !== null && hlT15 <= 0.85) || (hlT1h !== null && hlT1h <= 0.90);
    const buyP = (hlT15 !== null && hlT15 >= 1.20) || (hlT1h !== null && hlT1h >= 1.20);
    const oiUnwind = (hlOi1 !== null && hlOi1 <= -0.50) || (hlOi4 !== null && hlOi4 <= -1.00);
    const oiExp = (hlOi1 !== null && hlOi1 >= 0.25) || (hlOi4 !== null && hlOi4 >= 0.75);
    const hlAnyFundNeg = anyFundNeg || (hlFd !== null && hlFd < 0);
    const score = [hlAnyFundNeg, sellP, oiUnwind, askWall].filter(Boolean).length;
    const d1Top = ((c.close - high3d) / high3d) * 100 >= -0.1 && bb1hPctB !== null && bb1hPctB >= 0.9 && macdFalling;
    const pulseFade = (taker4h !== null && taker4h <= 1.05) || (breadth !== null && breadth <= 0) || anyFundNeg || (btc4h !== null && btc4h <= 0);

    s.pulseHostile![i] = (breadth !== null && breadth < 0) || (taker4h !== null && taker4h < 1) || anyFundNeg;
    s.pulseDeteriorating![i] = (breadth !== null && breadth <= -0.25) || (taker4h !== null && taker4h <= 0.98) || (btc4h !== null && btc4h <= -0.25) || (anyFundNeg && ((breadth !== null && breadth <= 0) || (taker4h !== null && taker4h <= 1.05)));
    s.pulseReclaim![i] = breadth !== null && breadth > 0 && taker4h !== null && taker4h > 1 && !anyFundNeg;
    s.hlAskWall![i] = askWall;
    s.hlExhaustion![i] = sellP || fade || oiUnwind;
    s.hlSupportBoost![i] = buyP && bidWall && oiExp;

    trig.cascade_book_pull[i] = askWall && sellP && (oiUnwind || liqL >= 25_000);
    trig.ladder_deleverage[i] = (oiUnwind || (imb !== null && imb <= -0.25)) && (sellP || fade || (hlFd !== null && hlFd < 0));
    trig.pulse4[i] = score >= 4;
    trig.pulse3[i] = score >= 3 && btc4h !== null && btc4h <= 0;
    trig.may22[i] = ((hlOi1 !== null && hlOi1 <= -2) || (hlOi4 !== null && hlOi4 <= -2)) && ((hlT1h !== null && hlT1h <= 0.80) || (hlT15 !== null && hlT15 <= 0.75)) && (btc4h !== null && btc4h <= -0.25) && (breadth !== null && breadth <= -4) && hlAnyFundNeg;
    trig.d1_top_pulse[i] = d1Top && pulseFade;
    trig.d1_top_exhaustion[i] = d1Top && (askWall || fade || sellP) && (oiExp || (hlFd !== null && hlFd < 0));
    trig.cascade_liq[i] = liqL >= 25_000 && (liqS <= 0 || liqL / liqS >= 1.5) && ((breadth !== null && breadth <= 0) || anyFundNeg);
    trig.ladder_downside[i] = ((breadth !== null && breadth <= -0.75) || (oiHl4 !== null && oiHl4 <= -1.0)) && ((taker4h !== null && taker4h <= 0.95) || (btc4h !== null && btc4h <= -0.35) || anyFundNeg);
  }
  s.extraTriggers = new Map(Object.entries(trig));

  // ── memory-zone S/R (30m tf, live srShadow config) ──
  console.error("[dormant] building memory zones...");
  const tfMs = 30 * ONE_MIN;
  const tf: Candle[] = [];
  {
    const map = new Map<number, Candle>();
    for (const c of candles) {
      const k = Math.floor(c.ts / tfMs) * tfMs;
      const bar = map.get(k);
      if (!bar) map.set(k, { ...c, ts: k, endTs: k + tfMs });
      else { bar.high = Math.max(bar.high, c.high); bar.low = Math.min(bar.low, c.low); bar.close = c.close; }
    }
    tf.push(...[...map.values()].sort((a, b) => a.ts - b.ts));
  }
  type Piv = { confirmTs: number; price: number };
  const pivots: Piv[] = [];
  for (let i = 4; i < tf.length - 4; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - 4; j <= i + 4; j++) {
      if (j === i) continue;
      if (tf[j].high >= tf[i].high) isHigh = false;
      if (tf[j].low <= tf[i].low) isLow = false;
    }
    const confirmTs = tf[i + 4].ts + tfMs;
    if (isHigh) pivots.push({ confirmTs, price: tf[i].high });
    if (isLow) pivots.push({ confirmTs, price: tf[i].low });
  }
  pivots.sort((a, b) => a.confirmTs - b.confirmTs);
  const zones: Array<{ ts: number; prices: number[] }> = [];
  const zoneStart = candles[Math.max(0, fromIdx)].ts - 86_400_000;
  let pLo = 0, pHi = 0;
  for (const bar of tf) {
    if (bar.ts < zoneStart) continue;
    while (pHi < pivots.length && pivots[pHi].confirmTs <= bar.ts) pHi++;
    while (pLo < pHi && pivots[pLo].confirmTs < bar.ts - 14 * 86_400_000) pLo++;
    const win = pivots.slice(pLo, pHi);
    const levels: Array<{ sum: number; cnt: number }> = [];
    for (const p of win) {
      let merged = false;
      for (const lv of levels) {
        const mean = lv.sum / lv.cnt;
        if (Math.abs(mean - p.price) / mean <= 0.0045) { lv.sum += p.price; lv.cnt++; merged = true; break; }
      }
      if (!merged) levels.push({ sum: p.price, cnt: 1 });
    }
    zones.push({ ts: bar.ts, prices: levels.filter(l => l.cnt >= 2).map(l => l.sum / l.cnt).sort((a, b) => a - b) });
  }
  s.srZones = zones;
}

// ── Phase A: anchored shadow ledger ──────────────────────────────────────────

async function phaseALedger(): Promise<Record<string, any>[]> {
  const episodes = loadLiveEpisodes();
  const findEp = (ts: number) => episodes.find(e => ts >= e.firstOpenTs && ts <= e.closeTs);
  type Fire = { ts: number; depth: number; pnlPct: number | null; notional: number; price: number };
  const fires = new Map<string, Fire[]>();
  const add = (name: string, f: Fire) => {
    if (!fires.has(name)) fires.set(name, []);
    fires.get(name)!.push(f);
  };
  await streamJsonl(path.join(DATA, "HYPEUSDT_hedge_shadow_signals.jsonl"), row => {
    for (const name of row.firedCandidates ?? []) {
      add(name, { ts: row.timestamp, depth: row.ladder?.depth ?? 0, pnlPct: row.ladder?.pnlPct ?? null, notional: row.ladder?.totalNotional ?? 0, price: row.price });
    }
  });
  await streamJsonl(path.join(DATA, "HYPEUSDT_sr_shadow_signals.jsonl"), row => {
    for (const name of row.firedCandidates ?? []) {
      add(name, { ts: row.timestamp, depth: row.ladder?.depth ?? 0, pnlPct: row.ladder?.pnlPct ?? null, notional: row.ladder?.totalNotional ?? 0, price: row.price });
    }
  });
  // deep-add stress: continuous rows -> record false->true transitions per candidate
  const lastState = new Map<string, boolean>();
  await streamJsonl(path.join(DATA, "HYPEUSDT_deep_add_stress_shadow.jsonl"), row => {
    for (const cand of row.candidates ?? []) {
      const prev = lastState.get(cand.name) ?? false;
      if (cand.wouldBlock && !prev) add(cand.name, { ts: row.timestamp, depth: row.ladder?.depth ?? 0, pnlPct: row.ladder?.pnlPct ?? null, notional: row.ladder?.totalNotional ?? 0, price: row.price });
      lastState.set(cand.name, !!cand.wouldBlock);
    }
    for (const cand of row.reopenCandidates ?? []) {
      const prev = lastState.get(cand.name) ?? false;
      if (cand.fired && !prev) add(cand.name, { ts: row.timestamp, depth: row.ladder?.depth ?? 0, pnlPct: row.ladder?.pnlPct ?? null, notional: row.ladder?.totalNotional ?? 0, price: row.price });
      lastState.set(cand.name, !!cand.fired);
    }
  });

  const bigLosses = episodes.filter(e => e.closePnl < -1000);
  const rows: Record<string, any>[] = [];
  const med = (xs: number[]) => xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : "";
  for (const [name, fs] of [...fires.entries()].sort()) {
    const byEp = new Map<number, Fire>();
    for (const f of fs) {
      const ep = findEp(f.ts);
      if (ep && !byEp.has(ep.index)) byEp.set(ep.index, f);
    }
    let exitDelta = 0, trim50 = 0, hedge35 = 0, fp = 0;
    for (const [epIdx, f] of byEp.entries()) {
      const ep = episodes[epIdx];
      const est = (f.pnlPct ?? 0) / 100 * f.notional - 2 * FEE * f.notional;
      exitDelta += est - ep.closePnl;
      trim50 += 0.5 * (est - ep.closePnl);
      hedge35 += 0.35 * f.notional * ((f.price - ep.exitPrice) / f.price) - 2 * FEE * 0.35 * f.notional;
      if (ep.closePnl > 0) fp++;
    }
    const hitLosses = bigLosses.filter(e => byEp.has(e.index)).length;
    rows.push({
      candidate: name,
      fires: fs.length,
      episodes: byEp.size,
      medDepth: med(fs.map(f => f.depth)),
      medPnlPct: r(med(fs.map(f => f.pnlPct ?? 0)) as number, 2),
      exitNowDelta: r(exitDelta, 0),
      trim50Delta: r(trim50, 0),
      hedge35ToClose: r(hedge35, 0),
      falsePositiveEpisodes: fp,
      bigLossEpisodesHit: hitLosses,
      bigLossEpisodesMissed: bigLosses.length - hitLosses,
    });
  }
  return rows;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  ensureDir(OUT_DIR);
  const series = await buildSeries();
  const candles = series.candles;
  const startIdx = lowerBound(candles, START_TS, c => c.endTs);

  const summaries: Record<string, any>[] = [];
  const weekly: Record<string, any>[] = [];
  const allActions: Record<string, any>[] = [];
  const results = new Map<string, EngineResult>();

  const runV = (params: EngineParams, phase: string, winStart = startIdx, winLabel = "hl") => {
    const result = runEngine(params, series, { startIdx: winStart });
    results.set(params.id, result);
    const hedgePnl = result.closes.reduce((a, x) => a + x.hedgePnlInEpisode, 0);
    summaries.push({
      phase, window: winLabel, variant: params.id,
      totalPnl: r(result.realized + result.openPnl, 2),
      closes: result.closes.length,
      tp: result.closes.filter(x => x.reason === "tp").length,
      staleTp: result.closes.filter(x => x.reason === "stale_tp").length,
      hardFlatten: result.closes.filter(x => x.reason === "hard_flatten").length,
      emergencyKill: result.closes.filter(x => x.reason === "emergency_kill").length,
      euphoriaStop: result.closes.filter(x => x.reason === "euphoria_stop").length,
      pullbackExit: result.closes.filter(x => x.reason.startsWith("pullback")).length,
      trims: result.trims.length,
      trimPnl: r(result.trims.reduce((a, t) => a + t.pnl, 0), 2),
      hedgeOpens: result.actions.filter(a => a.kind === "ovhedge_open").length,
      hedgeWins: result.actions.filter(a => a.kind === "ovhedge_close" && a.detail.startsWith("tp")).length,
      hedgeKills: result.actions.filter(a => a.kind === "ovhedge_close" && a.detail.startsWith("kill")).length,
      hedgePnl: r(hedgePnl, 2),
      srSkipBlocks: result.blocked.srSkipAdd ?? 0,
      srReopens: result.actions.filter(a => a.kind === "sr_support_reopen").length,
      worstClose: r(result.worstClose, 2),
      maxDrawdownPct: r(result.maxDrawdownPct, 2),
    });
    for (const cl of result.closes) {
      const wk = weekKey(cl.closeTs);
      const key = `${params.id}|${wk}`;
      const existing = weekly.find(x => x.key === key);
      if (existing) existing.realizedPnl = r(existing.realizedPnl + cl.pnl + cl.trimPnlInEpisode + cl.hedgePnlInEpisode, 2);
      else weekly.push({ key, variant: params.id, weekStart: wk, realizedPnl: r(cl.pnl + cl.trimPnlInEpisode + cl.hedgePnlInEpisode, 2) });
    }
    allActions.push(...(result.actions as unknown as Record<string, any>[]));
    return result;
  };

  const base = (id: string, extra?: Partial<EngineParams>): EngineParams => ({
    id, maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2,
    cooldownMode: "live4h", pullbackMode: "none", ...extra,
  });

  if (SET === "long") {
    // Phase D candle-only long-window sanity (no pulse features; SR zones are candle-only).
    console.error("[phaseD-long]");
    await attachDormantSeries(series, Math.max(0, startIdx - 2880));
    runV(base("REF_hf12-2_pbnone"), "refD", startIdx, "1yr");
    runV(base("D_partial_keep3_none", {
      srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse: "none", cooldownMin: 60 } },
    }), "phaseD", startIdx, "1yr");
    runV(base("D_eu_partial_none", {
      euphoriaStop: EU_STOP,
      srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse: "none", cooldownMin: 60 } },
    }), "phaseD", startIdx, "1yr");
    for (const max of [9, 10, 11, 12]) runV(base(`D_max${max}`, { maxPositions: max }), "phaseD", startIdx, "1yr");
    for (const scale of [1.25, 1.45]) runV(base(`D_scale${scale}`, { addScale: scale }), "phaseD", startIdx, "1yr");
    for (const tr of [0.45, 0.6]) runV(base(`D_trig${tr}`, { priceTriggerPct: tr }), "phaseD", startIdx, "1yr");
    for (const ai of [45, 60]) runV(base(`D_int${ai}`, { addIntervalMin: ai }), "phaseD", startIdx, "1yr");
    runV(base("D_eu9near10", { euphoriaMaxDepth: { maxPositions: 9, nearHighPct: 10 } }), "phaseD", startIdx, "1yr");
    summaries.sort((a, b) => b.totalPnl - a.totalPnl);
    writeCsv(path.join(OUT_DIR, "fable5-dormant-policy-summary-long.csv"), summaries);
    writeCsv(path.join(OUT_DIR, "fable5-dormant-policy-weekly-long.csv"), weekly);
    console.log(JSON.stringify({ set: SET, rows: summaries }, null, 2));
    return;
  }

  await attachDormantSeries(series, Math.max(0, startIdx - 2880));

  console.error("[phaseA]");
  const ledger = await phaseALedger();
  writeCsv(path.join(OUT_DIR, "fable5-dormant-shadow-ledger.csv"), ledger);

  // ── refs ──
  runV(base("REF_hf12-2_pbnone"), "ref");
  runV(base("REF_liveSegmented", { hardFlattenHours: 16, hardFlattenPct: -3, pullbackMode: "liveSegmented" }), "ref");
  runV(base("REF_eu_stop", { euphoriaStop: EU_STOP }), "ref");

  // ── Phase B: S/R execution actions (standalone on hf12/-2 pbnone) ──
  console.error("[phaseB]");
  for (const nd of [5, 8]) {
    for (const timeOnly of [true, false]) {
      for (const pulse of ["hostile", "deteriorating"] as const) {
        runV(base(`B_skip_nd${nd}_${timeOnly ? "timeonly" : "all"}_${pulse}`, {
          srExec: { skipAdd: { minNextDepth: nd, timeOnly, pulse, bufferPct: 1.0 } },
        }), "phaseB");
      }
    }
  }
  for (const keep of [3, 5]) {
    for (const pulse of ["none", "deteriorating", "hostile"] as const) {
      runV(base(`B_partial_keep${keep}_${pulse}`, {
        srExec: { partialExit: { minDepth: 6, keepRungs: keep, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse, cooldownMin: 60 } },
      }), "phaseB");
    }
  }
  for (const mode of ["askwall", "exhaustion"] as const) {
    runV(base(`B_protect_${mode}`, {
      srExec: { profitProtect: { minDepth: 3, minLadderPnlPct: 0.25, mode, tpBufferPct: 0.75, nearBufferPct: 1.0 } },
    }), "phaseB");
  }
  for (const mode of ["reclaim", "buy_pressure"] as const) {
    runV(base(`B_reopen_${mode}`, {
      srExec: { supportReopen: { minNextDepth: 5, bufferPct: 1.0, mode } },
    }), "phaseB");
  }

  // ── Phase C: pulse hedge overlays ──
  console.error("[phaseC]");
  const hedgeMeta: Record<string, { minDepth: number; pnlMax: number | null }> = {
    cascade_book_pull: { minDepth: 5, pnlMax: -2.5 },
    ladder_deleverage: { minDepth: 1, pnlMax: -1.5 },
    pulse4: { minDepth: 8, pnlMax: -1.0 },
    pulse3: { minDepth: 8, pnlMax: -1.5 },
    may22: { minDepth: 8, pnlMax: -1.5 },
    d1_top_pulse: { minDepth: 1, pnlMax: null },
    d1_top_exhaustion: { minDepth: 1, pnlMax: null },
    cascade_liq: { minDepth: 5, pnlMax: -2.5 },
    ladder_downside: { minDepth: 1, pnlMax: -1.5 },
  };
  const c1Ids: string[] = [];
  for (const [key, meta] of Object.entries(hedgeMeta)) {
    for (const size of [0.35, 0.5]) {
      const id = `C_${key}_s${size}`;
      c1Ids.push(id);
      runV(base(id, {
        hedgeOverlay: { triggerKey: key, minDepth: meta.minDepth, pnlMax: meta.pnlMax, sizePct: size, tpPct: 2.5, killPct: 3, cooldownMin: 240 },
      }), "phaseC");
    }
  }
  const c1Rows = summaries.filter(x => c1Ids.includes(x.variant)).sort((a, b) => b.totalPnl - a.totalPnl);
  const bestTrigs = [...new Set(c1Rows.slice(0, 3).map(x => x.variant.replace(/^C_/, "").replace(/_s0\.\d+$/, "")))].slice(0, 2);
  console.error(`[phaseC] refine: ${bestTrigs.join(", ")}`);
  for (const key of bestTrigs) {
    const meta = hedgeMeta[key];
    for (const size of [0.25, 0.75]) {
      runV(base(`C_${key}_s${size}`, { hedgeOverlay: { triggerKey: key, minDepth: meta.minDepth, pnlMax: meta.pnlMax, sizePct: size, tpPct: 2.5, killPct: 3, cooldownMin: 240 } }), "phaseC");
    }
    for (const tp of [1.5, 4]) {
      for (const kill of [2, 5]) {
        runV(base(`C_${key}_s0.5_tp${tp}_k${kill}`, { hedgeOverlay: { triggerKey: key, minDepth: meta.minDepth, pnlMax: meta.pnlMax, sizePct: 0.5, tpPct: tp, killPct: kill, cooldownMin: 240 } }), "phaseC");
      }
    }
  }

  // ── Phase D: ladder shape (HL era + sub-windows) ──
  console.error("[phaseD]");
  const idx30 = lowerBound(candles, candles[candles.length - 1].endTs - 30 * 86_400_000, c => c.endTs);
  const idx14 = lowerBound(candles, candles[candles.length - 1].endTs - 14 * 86_400_000, c => c.endTs);
  const shapes: Array<[string, Partial<EngineParams>]> = [
    ...[9, 10, 12].map(m => [`D_max${m}`, { maxPositions: m }] as [string, Partial<EngineParams>]),
    ["D_scale1.25", { addScale: 1.25 }], ["D_scale1.45", { addScale: 1.45 }],
    ["D_trig0.45", { priceTriggerPct: 0.45 }], ["D_trig0.6", { priceTriggerPct: 0.6 }],
    ["D_int45", { addIntervalMin: 45 }], ["D_int60", { addIntervalMin: 60 }],
    ["D_base1000", { baseUsdt: 1000 }],
    ["D_eu9near5", { euphoriaMaxDepth: { maxPositions: 9, nearHighPct: 5 } }],
    ["D_eu9near10", { euphoriaMaxDepth: { maxPositions: 9, nearHighPct: 10 } }],
  ];
  for (const [id, extra] of shapes) runV(base(id, extra), "phaseD");
  runV(base("REF_hf12-2_pbnone_30d"), "phaseD", idx30, "30d");
  runV(base("REF_hf12-2_pbnone_14d"), "phaseD", idx14, "14d");
  for (const [id, extra] of shapes.slice(0, 5)) {
    runV(base(`${id}_30d`, extra), "phaseD", idx30, "30d");
    runV(base(`${id}_14d`, extra), "phaseD", idx14, "14d");
  }

  // ── Phase E: composites (built on the euphoria-stop candidate) ──
  console.error("[phaseE]");
  const bRows = summaries.filter(x => x.phase === "phaseB").sort((a, b) => b.totalPnl - a.totalPnl);
  const bestB = bRows[0];
  const cRows = summaries.filter(x => x.phase === "phaseC").sort((a, b) => b.totalPnl - a.totalPnl);
  const bestC = cRows[0];
  console.error(`[phaseE] bestB=${bestB?.variant} bestC=${bestC?.variant}`);
  runV(base("E1_eu_skipdeep8", {
    euphoriaStop: EU_STOP,
    srExec: { skipAdd: { minNextDepth: 8, timeOnly: true, pulse: "hostile", bufferPct: 1.0 } },
  }), "phaseE");
  const bestKey = bestC ? bestC.variant.replace(/^C_/, "").replace(/_s.*$/, "") : null;
  runV(base("E2_eu_bestHedge", {
    euphoriaStop: EU_STOP,
    hedgeOverlay: bestKey && hedgeMeta[bestKey] ? { triggerKey: bestKey, minDepth: hedgeMeta[bestKey].minDepth, pnlMax: hedgeMeta[bestKey].pnlMax, sizePct: 0.5, tpPct: 2.5, killPct: 3, cooldownMin: 240 } : undefined,
  }), "phaseE");
  runV(base("E3_eu_protect_askwall", {
    euphoriaStop: EU_STOP,
    srExec: { profitProtect: { minDepth: 3, minLadderPnlPct: 0.25, mode: "askwall", tpBufferPct: 0.75, nearBufferPct: 1.0 } },
  }), "phaseE");
  runV(base("E4_eu_maxdepth9near10", {
    euphoriaStop: EU_STOP,
    euphoriaMaxDepth: { maxPositions: 9, nearHighPct: 10 },
  }), "phaseE");
  runV(base("E6_eu_partial_deter", {
    euphoriaStop: EU_STOP,
    srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 } },
  }), "phaseE");
  runV(base("E7_eu_partial_reopen", {
    euphoriaStop: EU_STOP,
    srExec: {
      partialExit: { minDepth: 6, keepRungs: 3, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 },
      supportReopen: { minNextDepth: 5, bufferPct: 1.0, mode: "buy_pressure" },
    },
  }), "phaseE");
  runV(base("E8_partial_deter_only_skipEu", {
    srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: 0.3, minLadderPnlPct: 0.25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 } },
    euphoriaStop: EU_STOP,
    euphoriaMaxDepth: { maxPositions: 9, nearHighPct: 10 },
  }), "phaseE");
  runV(base("E5_eu_skip_protect", {
    euphoriaStop: EU_STOP,
    srExec: {
      skipAdd: { minNextDepth: 8, timeOnly: true, pulse: "hostile", bufferPct: 1.0 },
      profitProtect: { minDepth: 3, minLadderPnlPct: 0.25, mode: "askwall", tpBufferPct: 0.75, nearBufferPct: 1.0 },
    },
  }), "phaseE");

  for (const row of weekly) delete row.key;
  summaries.sort((a, b) => b.totalPnl - a.totalPnl);
  writeCsv(path.join(OUT_DIR, "fable5-dormant-policy-summary.csv"), summaries);
  writeCsv(path.join(OUT_DIR, "fable5-dormant-policy-weekly.csv"), weekly);
  writeCsv(path.join(OUT_DIR, "fable5-dormant-policy-actions.csv"), allActions);

  console.log(JSON.stringify({
    window: { start: iso(START_TS), end: iso(candles[candles.length - 1].endTs) },
    ledgerTop: ledger.sort((a, b) => (b.exitNowDelta as number) - (a.exitNowDelta as number)).slice(0, 10),
    refs: summaries.filter(x => x.phase === "ref"),
    top20: summaries.slice(0, 20).map(x => ({ v: x.variant, pnl: x.totalPnl, worst: x.worstClose, dd: x.maxDrawdownPct, ek: x.emergencyKill, hedgePnl: x.hedgePnl })),
  }, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
