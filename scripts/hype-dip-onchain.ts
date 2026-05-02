import * as fs from "fs";
import * as readline from "readline";

interface Candle { ts: number; o: number; h: number; l: number; c: number; v: number; }
interface Row { ts: number; [k: string]: any; }

async function loadJsonl(path: string): Promise<Row[]> {
  if (!fs.existsSync(path)) return [];
  const out: Row[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const ts = o.timestamp ?? (o.ts && typeof o.ts === "string" ? new Date(o.ts).getTime() : o.ts);
      if (typeof ts === "number") out.push({ ...o, ts });
    } catch {}
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function rowsBetween(rows: Row[], a: number, b: number): Row[] {
  return rows.filter(r => r.ts >= a && r.ts <= b);
}
function lastBefore(rows: Row[], t: number): Row | null {
  let last: Row | null = null;
  for (const r of rows) { if (r.ts <= t) last = r; else break; }
  return last;
}
function firstAfter(rows: Row[], t: number): Row | null {
  for (const r of rows) if (r.ts >= t) return r;
  return null;
}
function median(arr: number[]): number {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function mean(arr: number[]): number {
  if (!arr.length) return NaN;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

async function load1m(path: string): Promise<Candle[]> {
  const out: Candle[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      out.push({ ts: o.ts, o: +o.o, h: +o.h, l: +o.l, c: +o.c, v: +o.v });
    } catch {}
  }
  return out.sort((a, b) => a.ts - b.ts);
}
function aggregate(c1m: Candle[], bucketMs: number): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of c1m) {
    const b = Math.floor(c.ts / bucketMs) * bucketMs;
    const e = map.get(b);
    if (!e) map.set(b, { ts: b, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
    else { e.h = Math.max(e.h, c.h); e.l = Math.min(e.l, c.l); e.c = c.c; e.v += c.v; }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const c1m = (await load1m("data/HYPEUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);
  const c5m = aggregate(c1m, 5 * 60_000);

  // identify dip events: rolling 4h, 5m step, dedup'd 4h apart, trough -2 to -3%
  const drops: any[] = [];
  for (let i = 48; i <= c5m.length; i++) {
    const win = c5m.slice(i - 48, i);
    const startP = win[0].o;
    const lowP = Math.min(...win.map(c => c.l));
    const lowIdx = win.findIndex(c => c.l === lowP);
    const tsTrough = win[lowIdx].ts;
    const tsStart = win[0].ts;
    const tsEnd = win[win.length - 1].ts + 5 * 60_000;
    const trough = (lowP - startP) / startP * 100;
    drops.push({ tsStart, tsEnd, tsTrough, trough, startP, lowP, endP: win[win.length - 1].c });
  }
  const sorted = [...drops].sort((a, b) => a.trough - b.trough);
  const dedup: any[] = [];
  for (const d of sorted) {
    if (d.trough <= -3 || d.trough >= -2) continue;
    if (dedup.every(x => Math.abs(x.tsEnd - d.tsEnd) >= 4 * 3600 * 1000)) {
      dedup.push(d);
    }
  }
  dedup.sort((a, b) => a.tsStart - b.tsStart);

  // load on-chain feeds
  console.log("loading feeds…");
  const oiBy = await loadJsonl("data/HYPEUSDT_oi_live.jsonl");
  const oiBn = await loadJsonl("data/HYPEUSDT_oi_live_binance.jsonl");
  const oiHl = await loadJsonl("data/HYPEUSDT_oi_live_hyperliquid.jsonl");
  const fdBy = await loadJsonl("data/HYPEUSDT_funding_live.jsonl");
  const fdBn = await loadJsonl("data/HYPEUSDT_funding_live_binance.jsonl");
  const fdHl = await loadJsonl("data/HYPEUSDT_funding_live_hyperliquid.jsonl");
  const taker = await loadJsonl("data/HYPEUSDT_taker_binance.jsonl");
  const lsBn = await loadJsonl("data/HYPEUSDT_lsratio_binance.jsonl");
  const lsBy = await loadJsonl("data/HYPEUSDT_lsratio_bybit.jsonl");
  const liq = await loadJsonl("data/HYPEUSDT_liquidations.jsonl");
  const ob = await loadJsonl("data/HYPEUSDT_ob_bands.jsonl");
  const hlp = await loadJsonl("data/HYPE_hlp_vault.jsonl");

  // ratio type filtering for L/S
  const lsBnTopPos = lsBn.filter(r => r.ratioType === "top_trader_position");
  const lsBnTopAcc = lsBn.filter(r => r.ratioType === "top_trader_account");
  const lsBnGlobal = lsBn.filter(r => r.ratioType === "global_account");
  const lsByAccount = lsBy.filter(r => r.ratioType === "all_trader_account");
  // BTC concurrent move for regime tag
  const btc1m = (await load1m("data/BTCUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);

  const events: any[] = [];

  for (const d of dedup) {
    const preStart = d.tsStart - 30 * 60_000;
    const dipStart = d.tsStart;
    const trough = d.tsTrough;
    const winEnd = d.tsEnd;
    const postEnd = winEnd + 30 * 60_000;

    // OI Δ — sample first/last, compute % from window start to trough
    const oiByPre = lastBefore(oiBy, dipStart)?.openInterestValue ?? null;
    const oiByTrough = lastBefore(oiBy, trough)?.openInterestValue ?? null;
    const oiByEnd = lastBefore(oiBy, winEnd)?.openInterestValue ?? null;
    const oiBnPre = lastBefore(oiBn, dipStart)?.openInterestValue ?? null;
    const oiBnTrough = lastBefore(oiBn, trough)?.openInterestValue ?? null;
    const oiBnEnd = lastBefore(oiBn, winEnd)?.openInterestValue ?? null;
    const oiHlPre = lastBefore(oiHl, dipStart)?.openInterestValue ?? null;
    const oiHlTrough = lastBefore(oiHl, trough)?.openInterestValue ?? null;
    const oiHlEnd = lastBefore(oiHl, winEnd)?.openInterestValue ?? null;

    // funding
    const fdByPre = lastBefore(fdBy, dipStart)?.fundingRate ?? null;
    const fdByEnd = lastBefore(fdBy, winEnd)?.fundingRate ?? null;
    const fdBnPre = lastBefore(fdBn, dipStart)?.fundingRate ?? null;
    const fdBnEnd = lastBefore(fdBn, winEnd)?.fundingRate ?? null;
    const fdHlPre = lastBefore(fdHl, dipStart)?.fundingRate ?? null;
    const fdHlEnd = lastBefore(fdHl, winEnd)?.fundingRate ?? null;

    // taker (5m bars during dip)
    const takerInDip = rowsBetween(taker, dipStart, trough);
    const takerBuyVol = takerInDip.reduce((s, r) => s + (r.buyVol || 0), 0);
    const takerSellVol = takerInDip.reduce((s, r) => s + (r.sellVol || 0), 0);
    const takerRatio = takerBuyVol / (takerSellVol || 1);

    // L/S during dip
    const lsBnPosBefore = lastBefore(lsBnTopPos, dipStart)?.longShortRatio ?? null;
    const lsBnPosAfter = lastBefore(lsBnTopPos, winEnd)?.longShortRatio ?? null;
    const lsBnAccBefore = lastBefore(lsBnTopAcc, dipStart)?.longShortRatio ?? null;
    const lsBnAccAfter = lastBefore(lsBnTopAcc, winEnd)?.longShortRatio ?? null;
    const lsBnGlobBefore = lastBefore(lsBnGlobal, dipStart)?.longShortRatio ?? null;
    const lsBnGlobAfter = lastBefore(lsBnGlobal, winEnd)?.longShortRatio ?? null;
    const lsByBefore = lastBefore(lsByAccount, dipStart)?.longShortRatio ?? null;
    const lsByAfter = lastBefore(lsByAccount, winEnd)?.longShortRatio ?? null;

    // liquidations during dip (start to trough)
    const liqInDip = rowsBetween(liq, dipStart, trough);
    const liqLongUsd = liqInDip.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShortUsd = liqInDip.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqCount = liqInDip.length;

    // ob imbalance
    const obBefore = lastBefore(ob, dipStart)?.imbalance_0_5 ?? null;
    const obTrough = lastBefore(ob, trough)?.imbalance_0_5 ?? null;
    const obEnd = lastBefore(ob, winEnd)?.imbalance_0_5 ?? null;

    // HLP vault
    const hlpBefore = lastBefore(hlp, dipStart);
    const hlpAfter = lastBefore(hlp, winEnd);

    // BTC concurrent move
    const btcWin = btc1m.filter(c => c.ts >= dipStart && c.ts <= trough);
    const btcMove = btcWin.length ? (btcWin[btcWin.length - 1].c - btcWin[0].o) / btcWin[0].o * 100 : NaN;

    events.push({
      tsStart: d.tsStart, tsTrough: d.tsTrough, tsEnd: d.tsEnd,
      trough: d.trough, startP: d.startP, lowP: d.lowP, endP: d.endP,
      oiBy: { pre: oiByPre, trough: oiByTrough, end: oiByEnd },
      oiBn: { pre: oiBnPre, trough: oiBnTrough, end: oiBnEnd },
      oiHl: { pre: oiHlPre, trough: oiHlTrough, end: oiHlEnd },
      fdBy: { pre: fdByPre, end: fdByEnd },
      fdBn: { pre: fdBnPre, end: fdBnEnd },
      fdHl: { pre: fdHlPre, end: fdHlEnd },
      takerBuy: takerBuyVol, takerSell: takerSellVol, takerRatio,
      lsBnPos: { pre: lsBnPosBefore, post: lsBnPosAfter },
      lsBnAcc: { pre: lsBnAccBefore, post: lsBnAccAfter },
      lsBnGlob: { pre: lsBnGlobBefore, post: lsBnGlobAfter },
      lsBy: { pre: lsByBefore, post: lsByAfter },
      liqLongUsd, liqShortUsd, liqCount,
      obBefore, obTrough, obEnd,
      hlpAprPre: hlpBefore?.apr, hlpAprPost: hlpAfter?.apr,
      hlpMaxDistPre: hlpBefore?.maxDistributable, hlpMaxDistPost: hlpAfter?.maxDistributable,
      btcMove,
    });
  }

  console.log(`\n=== n=${events.length} dip events (2-3% trough, rolling 4h, dedup'd 4h) ===\n`);
  for (const [i, e] of events.entries()) {
    console.log(`--- Event ${i + 1}: ${new Date(e.tsStart).toISOString().slice(0, 16)} → ${new Date(e.tsEnd).toISOString().slice(0, 16)} ---`);
    console.log(`  Price: ${e.startP.toFixed(3)} → trough ${e.lowP.toFixed(3)} (${e.trough.toFixed(2)}%) → ${e.endP.toFixed(3)}`);
    console.log(`  Trough at: ${new Date(e.tsTrough).toISOString().slice(0, 16)}`);
    console.log(`  BTC concurrent move (start→trough): ${isFinite(e.btcMove) ? e.btcMove.toFixed(2) + "%" : "n/a"}`);

    const oiByPctTrough = e.oiBy.pre && e.oiBy.trough ? (e.oiBy.trough - e.oiBy.pre) / e.oiBy.pre * 100 : NaN;
    const oiByPctEnd = e.oiBy.pre && e.oiBy.end ? (e.oiBy.end - e.oiBy.pre) / e.oiBy.pre * 100 : NaN;
    const oiBnPctTrough = e.oiBn.pre && e.oiBn.trough ? (e.oiBn.trough - e.oiBn.pre) / e.oiBn.pre * 100 : NaN;
    const oiHlPctTrough = e.oiHl.pre && e.oiHl.trough ? (e.oiHl.trough - e.oiHl.pre) / e.oiHl.pre * 100 : NaN;

    console.log(`  OI value Δ (notional USD):`);
    console.log(`    Bybit:       ${(e.oiBy.pre / 1e6).toFixed(1)}M → ${(e.oiBy.trough / 1e6).toFixed(1)}M (${oiByPctTrough.toFixed(2)}%) → end ${(e.oiBy.end / 1e6).toFixed(1)}M (${oiByPctEnd.toFixed(2)}%)`);
    console.log(`    Binance:     ${(e.oiBn.pre / 1e6).toFixed(1)}M → ${(e.oiBn.trough / 1e6).toFixed(1)}M (${oiBnPctTrough.toFixed(2)}%)`);
    if (e.oiHl.pre) console.log(`    Hyperliquid: ${(e.oiHl.pre / 1e6).toFixed(1)}M → ${(e.oiHl.trough / 1e6).toFixed(1)}M (${oiHlPctTrough.toFixed(2)}%)`);
    console.log(`  Funding rate (pre → end of window):`);
    console.log(`    Bybit:       ${(e.fdBy.pre * 100).toFixed(4)}% → ${(e.fdBy.end * 100).toFixed(4)}%`);
    console.log(`    Binance:     ${(e.fdBn.pre * 100).toFixed(4)}% → ${(e.fdBn.end * 100).toFixed(4)}%`);
    if (e.fdHl.pre != null) console.log(`    Hyperliquid: ${(e.fdHl.pre * 100).toFixed(4)}% → ${(e.fdHl.end * 100).toFixed(4)}%`);
    console.log(`  Taker (Binance, dipStart→trough): buy=${e.takerBuy.toFixed(0)} sell=${e.takerSell.toFixed(0)} ratio=${e.takerRatio.toFixed(3)}`);
    console.log(`  L/S (Binance):`);
    console.log(`    top-position:  ${e.lsBnPos.pre?.toFixed(3) ?? "?"} → ${e.lsBnPos.post?.toFixed(3) ?? "?"}`);
    console.log(`    top-account:   ${e.lsBnAcc.pre?.toFixed(3) ?? "?"} → ${e.lsBnAcc.post?.toFixed(3) ?? "?"}`);
    console.log(`    global:        ${e.lsBnGlob.pre?.toFixed(3) ?? "?"} → ${e.lsBnGlob.post?.toFixed(3) ?? "?"}`);
    console.log(`  L/S (Bybit account): ${e.lsBy.pre?.toFixed(3) ?? "?"} → ${e.lsBy.post?.toFixed(3) ?? "?"}`);
    console.log(`  Liquidations (dipStart→trough): n=${e.liqCount} long=$${e.liqLongUsd.toFixed(0)} short=$${e.liqShortUsd.toFixed(0)}`);
    console.log(`  OB imbalance(0-0.5%): pre=${e.obBefore?.toFixed(3) ?? "?"}  trough=${e.obTrough?.toFixed(3) ?? "?"}  end=${e.obEnd?.toFixed(3) ?? "?"}`);
    if (e.hlpAprPre != null) console.log(`  HLP vault APR: ${(e.hlpAprPre * 100).toFixed(3)}% → ${(e.hlpAprPost * 100).toFixed(3)}%`);
    console.log("");
  }

  // aggregate
  console.log(`=== aggregate medians across n=${events.length} ===`);
  const oiByPct = events.map(e => e.oiBy.pre ? (e.oiBy.trough - e.oiBy.pre) / e.oiBy.pre * 100 : NaN).filter(Number.isFinite);
  const oiBnPct = events.map(e => e.oiBn.pre ? (e.oiBn.trough - e.oiBn.pre) / e.oiBn.pre * 100 : NaN).filter(Number.isFinite);
  const oiHlPct = events.map(e => e.oiHl.pre ? (e.oiHl.trough - e.oiHl.pre) / e.oiHl.pre * 100 : NaN).filter(Number.isFinite);
  const takerR = events.map(e => e.takerRatio).filter(Number.isFinite);
  const liqLong = events.map(e => e.liqLongUsd);
  const liqShort = events.map(e => e.liqShortUsd);
  const obDelta = events.map(e => e.obTrough != null && e.obBefore != null ? e.obTrough - e.obBefore : NaN).filter(Number.isFinite);
  const lsBnPosDelta = events.map(e => e.lsBnPos.pre && e.lsBnPos.post ? e.lsBnPos.post - e.lsBnPos.pre : NaN).filter(Number.isFinite);
  const btcMv = events.map(e => e.btcMove).filter(Number.isFinite);

  console.log(`  OI%Δ Bybit (start→trough):       median ${median(oiByPct).toFixed(2)}%   mean ${mean(oiByPct).toFixed(2)}%`);
  console.log(`  OI%Δ Binance:                     median ${median(oiBnPct).toFixed(2)}%   mean ${mean(oiBnPct).toFixed(2)}%`);
  console.log(`  OI%Δ Hyperliquid:                 median ${median(oiHlPct).toFixed(2)}%   mean ${mean(oiHlPct).toFixed(2)}%`);
  console.log(`  Taker buy/sell ratio (dip):       median ${median(takerR).toFixed(3)}    mean ${mean(takerR).toFixed(3)}`);
  console.log(`  Long liquidation $:               median $${median(liqLong).toFixed(0)}  mean $${mean(liqLong).toFixed(0)}`);
  console.log(`  Short liquidation $:              median $${median(liqShort).toFixed(0)}  mean $${mean(liqShort).toFixed(0)}`);
  console.log(`  OB imbalance Δ (pre→trough):      median ${median(obDelta).toFixed(4)}   mean ${mean(obDelta).toFixed(4)}`);
  console.log(`  Top-position L/S Δ (Binance):     median ${median(lsBnPosDelta).toFixed(3)}    mean ${mean(lsBnPosDelta).toFixed(3)}`);
  console.log(`  BTC concurrent move (start→trough): median ${median(btcMv).toFixed(2)}%   mean ${mean(btcMv).toFixed(2)}%`);
})();
