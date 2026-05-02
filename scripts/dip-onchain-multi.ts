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

async function analyzeSymbol(symbol: string, cutoff: number): Promise<{ symbol: string, events: any[] }> {
  const c1m = (await load1m(`data/${symbol}_1m.jsonl`)).filter(c => c.ts >= cutoff);
  const c5m = aggregate(c1m, 5 * 60_000);

  const drops: any[] = [];
  for (let i = 48; i <= c5m.length; i++) {
    const win = c5m.slice(i - 48, i);
    const startP = win[0].o;
    const lowP = Math.min(...win.map(c => c.l));
    const lowIdx = win.findIndex(c => c.l === lowP);
    const tsTrough = win[lowIdx].ts;
    drops.push({
      tsStart: win[0].ts,
      tsEnd: win[win.length - 1].ts + 5 * 60_000,
      tsTrough,
      trough: (lowP - startP) / startP * 100,
      startP, lowP, endP: win[win.length - 1].c,
    });
  }
  const sorted = [...drops].sort((a, b) => a.trough - b.trough);
  const dedup: any[] = [];
  for (const d of sorted) {
    if (d.trough <= -3 || d.trough >= -2) continue;
    if (dedup.every(x => Math.abs(x.tsEnd - d.tsEnd) >= 4 * 3600 * 1000)) dedup.push(d);
  }
  dedup.sort((a, b) => a.tsStart - b.tsStart);

  const oiBy = await loadJsonl(`data/${symbol}_oi_live.jsonl`);
  const oiBn = await loadJsonl(`data/${symbol}_oi_live_binance.jsonl`);
  const fdBy = await loadJsonl(`data/${symbol}_funding_live.jsonl`);
  const fdBn = await loadJsonl(`data/${symbol}_funding_live_binance.jsonl`);
  const taker = await loadJsonl(`data/${symbol}_taker_binance.jsonl`);
  const lsBn = await loadJsonl(`data/${symbol}_lsratio_binance.jsonl`);
  const lsBy = await loadJsonl(`data/${symbol}_lsratio_bybit.jsonl`);
  const liq = await loadJsonl(`data/${symbol}_liquidations.jsonl`);
  const ob = await loadJsonl(`data/${symbol}_ob_bands.jsonl`);
  const basis = await loadJsonl(`data/${symbol}_basis.jsonl`);

  const lsBnTopPos = lsBn.filter(r => r.ratioType === "top_trader_position");
  const btc1m = (await load1m("data/BTCUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);

  const events: any[] = [];
  for (const d of dedup) {
    const dipStart = d.tsStart, trough = d.tsTrough, winEnd = d.tsEnd;

    const oiByPre = lastBefore(oiBy, dipStart)?.openInterestValue ?? null;
    const oiByTrough = lastBefore(oiBy, trough)?.openInterestValue ?? null;
    const oiBnPre = lastBefore(oiBn, dipStart)?.openInterestValue ?? null;
    const oiBnTrough = lastBefore(oiBn, trough)?.openInterestValue ?? null;
    const fdByPre = lastBefore(fdBy, dipStart)?.fundingRate ?? null;
    const fdByEnd = lastBefore(fdBy, winEnd)?.fundingRate ?? null;
    const fdBnPre = lastBefore(fdBn, dipStart)?.fundingRate ?? null;
    const fdBnEnd = lastBefore(fdBn, winEnd)?.fundingRate ?? null;
    const takerInDip = rowsBetween(taker, dipStart, trough);
    const takerBuyVol = takerInDip.reduce((s, r) => s + (r.buyVol || 0), 0);
    const takerSellVol = takerInDip.reduce((s, r) => s + (r.sellVol || 0), 0);
    const lsBnPos = { pre: lastBefore(lsBnTopPos, dipStart)?.longShortRatio, post: lastBefore(lsBnTopPos, winEnd)?.longShortRatio };
    const liqInDip = rowsBetween(liq, dipStart, trough);
    const liqLongUsd = liqInDip.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShortUsd = liqInDip.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const obPre = lastBefore(ob, dipStart)?.imbalance_0_5 ?? null;
    const obTrough = lastBefore(ob, trough)?.imbalance_0_5 ?? null;
    const basisPre = lastBefore(basis, dipStart)?.bybitBasisMarkMidPct ?? null;
    const basisTrough = lastBefore(basis, trough)?.bybitBasisMarkMidPct ?? null;
    const btcWin = btc1m.filter(c => c.ts >= dipStart && c.ts <= trough);
    const btcMove = btcWin.length ? (btcWin[btcWin.length - 1].c - btcWin[0].o) / btcWin[0].o * 100 : NaN;

    events.push({
      tsStart: d.tsStart, tsTrough: d.tsTrough,
      trough: d.trough, startP: d.startP, lowP: d.lowP,
      oiByPctTrough: oiByPre && oiByTrough ? (oiByTrough - oiByPre) / oiByPre * 100 : NaN,
      oiBnPctTrough: oiBnPre && oiBnTrough ? (oiBnTrough - oiBnPre) / oiBnPre * 100 : NaN,
      fdByPre, fdByEnd, fdBnPre, fdBnEnd,
      fdByFlipped: fdByPre != null && fdByEnd != null && fdByPre > 0 && fdByEnd < 0,
      fdBnFlipped: fdBnPre != null && fdBnEnd != null && fdBnPre > 0 && fdBnEnd < 0,
      takerRatio: takerBuyVol / (takerSellVol || 1),
      lsBnPosDelta: lsBnPos.pre && lsBnPos.post ? lsBnPos.post - lsBnPos.pre : NaN,
      liqLongUsd, liqShortUsd, liqLongShortRatio: liqLongUsd / (liqShortUsd || 1),
      obDelta: obPre != null && obTrough != null ? obTrough - obPre : NaN,
      basisDelta: basisPre != null && basisTrough != null ? basisTrough - basisPre : NaN,
      btcMove,
    });
  }
  return { symbol, events };
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const symbols = ["HYPEUSDT", "ETHUSDT", "SOLUSDT", "SUIUSDT"];
  const results = await Promise.all(symbols.map(s => analyzeSymbol(s, cutoff)));

  for (const { symbol, events } of results) {
    console.log(`\n========== ${symbol}  n=${events.length} 2-3% dip events ==========`);
    if (!events.length) { console.log("  (no events)"); continue; }
    console.log(`event-start          trough%   OI_by%    OI_bn%    taker  fdBy_flip fdBn_flip  liqL$   liqS$   L/S_pos_Δ  obΔ    basisΔ%   btc%`);
    for (const e of events) {
      console.log(
        `${new Date(e.tsStart).toISOString().slice(0, 16)}   ${e.trough.toFixed(2).padStart(5)}%  ${(isFinite(e.oiByPctTrough) ? e.oiByPctTrough.toFixed(2) : "  -  ").padStart(6)}%  ${(isFinite(e.oiBnPctTrough) ? e.oiBnPctTrough.toFixed(2) : "  -  ").padStart(6)}%  ${e.takerRatio.toFixed(2).padStart(5)}  ${(e.fdByFlipped ? " YES" : "  no").padStart(6)}    ${(e.fdBnFlipped ? " YES" : "  no").padStart(6)}    ${e.liqLongUsd.toFixed(0).padStart(6)}  ${e.liqShortUsd.toFixed(0).padStart(6)}  ${(isFinite(e.lsBnPosDelta) ? e.lsBnPosDelta.toFixed(3) : "  -  ").padStart(6)}    ${(isFinite(e.obDelta) ? e.obDelta.toFixed(3) : "  -  ").padStart(6)}  ${(isFinite(e.basisDelta) ? (e.basisDelta * 100).toFixed(3) : "  -  ").padStart(7)}  ${(isFinite(e.btcMove) ? e.btcMove.toFixed(2) : " - ").padStart(5)}%`
      );
    }
    console.log(`\n  --- aggregate medians (n=${events.length}) ---`);
    console.log(`  OI Bybit Δ%:           median ${median(events.map(e => e.oiByPctTrough).filter(Number.isFinite)).toFixed(2)}%`);
    console.log(`  OI Binance Δ%:         median ${median(events.map(e => e.oiBnPctTrough).filter(Number.isFinite)).toFixed(2)}%`);
    console.log(`  Taker buy/sell ratio:  median ${median(events.map(e => e.takerRatio)).toFixed(3)}`);
    console.log(`  Funding Bybit flipped: ${events.filter(e => e.fdByFlipped).length}/${events.length} events`);
    console.log(`  Funding Binance flip:  ${events.filter(e => e.fdBnFlipped).length}/${events.length} events`);
    console.log(`  Long liq $: median $${median(events.map(e => e.liqLongUsd)).toFixed(0)}`);
    console.log(`  Short liq $: median $${median(events.map(e => e.liqShortUsd)).toFixed(0)}`);
    console.log(`  Long/Short liq ratio:  median ${median(events.map(e => e.liqLongShortRatio).filter(Number.isFinite)).toFixed(3)}`);
    console.log(`  L/S top-pos Δ:         median ${median(events.map(e => e.lsBnPosDelta).filter(Number.isFinite)).toFixed(3)}`);
    console.log(`  OB imbalance Δ:        median ${median(events.map(e => e.obDelta).filter(Number.isFinite)).toFixed(4)}`);
    console.log(`  Basis Δ%:              median ${(median(events.map(e => e.basisDelta).filter(Number.isFinite)) * 100).toFixed(4)}%`);
    console.log(`  BTC concurrent move:   median ${median(events.map(e => e.btcMove).filter(Number.isFinite)).toFixed(2)}%`);
  }

  console.log("\n\n========== CROSS-SYMBOL COMPARISON (medians) ==========");
  const cols = ["symbol", "n", "OI_by%", "OI_bn%", "taker", "fdBy_flip", "fdBn_flip", "liqL$", "liqS$", "ratio", "lsΔ", "obΔ", "btc%"];
  console.log(cols.map(c => c.padStart(11)).join(""));
  for (const { symbol, events } of results) {
    const r = [
      symbol.replace("USDT", ""),
      String(events.length),
      events.length ? median(events.map(e => e.oiByPctTrough).filter(Number.isFinite)).toFixed(2) : "-",
      events.length ? median(events.map(e => e.oiBnPctTrough).filter(Number.isFinite)).toFixed(2) : "-",
      events.length ? median(events.map(e => e.takerRatio)).toFixed(2) : "-",
      events.length ? `${events.filter(e => e.fdByFlipped).length}/${events.length}` : "-",
      events.length ? `${events.filter(e => e.fdBnFlipped).length}/${events.length}` : "-",
      events.length ? median(events.map(e => e.liqLongUsd)).toFixed(0) : "-",
      events.length ? median(events.map(e => e.liqShortUsd)).toFixed(0) : "-",
      events.length ? median(events.map(e => e.liqLongShortRatio).filter(Number.isFinite)).toFixed(2) : "-",
      events.length ? median(events.map(e => e.lsBnPosDelta).filter(Number.isFinite)).toFixed(3) : "-",
      events.length ? median(events.map(e => e.obDelta).filter(Number.isFinite)).toFixed(3) : "-",
      events.length ? median(events.map(e => e.btcMove).filter(Number.isFinite)).toFixed(2) : "-",
    ];
    console.log(r.map(c => c.padStart(11)).join(""));
  }
})();
