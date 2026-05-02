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
function rowsBetween(rows: Row[], a: number, b: number): Row[] { return rows.filter(r => r.ts >= a && r.ts <= b); }
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

interface DipPumpEvent {
  tsStart: number; tsExtreme: number; tsEnd: number;
  pct: number; startP: number; extremeP: number; endP: number;
  direction: "down" | "up";
}

async function findEvents(c1m: Candle[], pctMin: number, pctMax: number, direction: "down" | "up"): Promise<DipPumpEvent[]> {
  const c5m = aggregate(c1m, 5 * 60_000);
  const events: any[] = [];
  for (let i = 48; i <= c5m.length; i++) {
    const win = c5m.slice(i - 48, i);
    const startP = win[0].o;
    let extremeP: number, extremeIdx: number;
    if (direction === "down") {
      extremeP = Math.min(...win.map(c => c.l));
      extremeIdx = win.findIndex(c => c.l === extremeP);
    } else {
      extremeP = Math.max(...win.map(c => c.h));
      extremeIdx = win.findIndex(c => c.h === extremeP);
    }
    const pct = (extremeP - startP) / startP * 100;
    events.push({
      tsStart: win[0].ts,
      tsEnd: win[win.length - 1].ts + 5 * 60_000,
      tsExtreme: win[extremeIdx].ts,
      pct, startP, extremeP, endP: win[win.length - 1].c, direction,
    });
  }
  const sorted = direction === "down"
    ? [...events].sort((a, b) => a.pct - b.pct)
    : [...events].sort((a, b) => b.pct - a.pct);
  const dedup: any[] = [];
  for (const d of sorted) {
    const m = direction === "down" ? d.pct : -d.pct;
    if (m >= -pctMin || m <= -pctMax) continue;
    if (dedup.every(x => Math.abs(x.tsEnd - d.tsEnd) >= 4 * 3600 * 1000)) dedup.push(d);
  }
  dedup.sort((a, b) => a.tsStart - b.tsStart);
  return dedup as DipPumpEvent[];
}

interface FeatureRow {
  tsStart: number; tsExtreme: number; pct: number; startP: number; extremeP: number;
  oiByPct: number; oiBnPct: number;
  fdByPre: number | null; fdByEnd: number | null;
  fdBnPre: number | null; fdBnEnd: number | null;
  fdByFlippedNeg: boolean; fdBnFlippedNeg: boolean;
  fdByFlippedPos: boolean; fdBnFlippedPos: boolean;
  takerRatio: number;
  lsBnPosDelta: number;
  liqLongUsd: number; liqShortUsd: number; liqLongShortRatio: number;
  obDelta: number;
  basisDelta: number;
  btcMove: number;
}

async function extractFeatures(symbol: string, events: DipPumpEvent[], cutoff: number): Promise<FeatureRow[]> {
  const oiBy = await loadJsonl(`data/${symbol}_oi_live.jsonl`);
  const oiBn = await loadJsonl(`data/${symbol}_oi_live_binance.jsonl`);
  const fdBy = await loadJsonl(`data/${symbol}_funding_live.jsonl`);
  const fdBn = await loadJsonl(`data/${symbol}_funding_live_binance.jsonl`);
  const taker = await loadJsonl(`data/${symbol}_taker_binance.jsonl`);
  const lsBn = await loadJsonl(`data/${symbol}_lsratio_binance.jsonl`);
  const liq = await loadJsonl(`data/${symbol}_liquidations.jsonl`);
  const ob = await loadJsonl(`data/${symbol}_ob_bands.jsonl`);
  const basis = await loadJsonl(`data/${symbol}_basis.jsonl`);
  const lsBnTopPos = lsBn.filter(r => r.ratioType === "top_trader_position");
  const btc1m = (await load1m("data/BTCUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);

  const out: FeatureRow[] = [];
  for (const d of events) {
    const dipStart = d.tsStart, extreme = d.tsExtreme, winEnd = d.tsEnd;
    const oiByPre = lastBefore(oiBy, dipStart)?.openInterestValue ?? null;
    const oiByExtreme = lastBefore(oiBy, extreme)?.openInterestValue ?? null;
    const oiBnPre = lastBefore(oiBn, dipStart)?.openInterestValue ?? null;
    const oiBnExtreme = lastBefore(oiBn, extreme)?.openInterestValue ?? null;
    const fdByPre = lastBefore(fdBy, dipStart)?.fundingRate ?? null;
    const fdByEnd = lastBefore(fdBy, winEnd)?.fundingRate ?? null;
    const fdBnPre = lastBefore(fdBn, dipStart)?.fundingRate ?? null;
    const fdBnEnd = lastBefore(fdBn, winEnd)?.fundingRate ?? null;
    const takerInWin = rowsBetween(taker, dipStart, extreme);
    const takerBuy = takerInWin.reduce((s, r) => s + (r.buyVol || 0), 0);
    const takerSell = takerInWin.reduce((s, r) => s + (r.sellVol || 0), 0);
    const liqInWin = rowsBetween(liq, dipStart, extreme);
    const liqLong = liqInWin.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShort = liqInWin.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const lsBnPosBefore = lastBefore(lsBnTopPos, dipStart)?.longShortRatio ?? null;
    const lsBnPosAfter = lastBefore(lsBnTopPos, winEnd)?.longShortRatio ?? null;
    const obPre = lastBefore(ob, dipStart)?.imbalance_0_5 ?? null;
    const obExtreme = lastBefore(ob, extreme)?.imbalance_0_5 ?? null;
    const basisPre = lastBefore(basis, dipStart)?.bybitBasisMarkMidPct ?? null;
    const basisExtreme = lastBefore(basis, extreme)?.bybitBasisMarkMidPct ?? null;
    const btcWin = btc1m.filter(c => c.ts >= dipStart && c.ts <= extreme);
    const btcMove = btcWin.length ? (btcWin[btcWin.length - 1].c - btcWin[0].o) / btcWin[0].o * 100 : NaN;

    out.push({
      tsStart: d.tsStart, tsExtreme: d.tsExtreme, pct: d.pct, startP: d.startP, extremeP: d.extremeP,
      oiByPct: oiByPre && oiByExtreme ? (oiByExtreme - oiByPre) / oiByPre * 100 : NaN,
      oiBnPct: oiBnPre && oiBnExtreme ? (oiBnExtreme - oiBnPre) / oiBnPre * 100 : NaN,
      fdByPre, fdByEnd, fdBnPre, fdBnEnd,
      fdByFlippedNeg: fdByPre != null && fdByEnd != null && fdByPre > 0 && fdByEnd < 0,
      fdBnFlippedNeg: fdBnPre != null && fdBnEnd != null && fdBnPre > 0 && fdBnEnd < 0,
      fdByFlippedPos: fdByPre != null && fdByEnd != null && fdByPre < 0 && fdByEnd > 0,
      fdBnFlippedPos: fdBnPre != null && fdBnEnd != null && fdBnPre < 0 && fdBnEnd > 0,
      takerRatio: takerBuy / (takerSell || 1),
      lsBnPosDelta: lsBnPosBefore != null && lsBnPosAfter != null ? lsBnPosAfter - lsBnPosBefore : NaN,
      liqLongUsd: liqLong, liqShortUsd: liqShort, liqLongShortRatio: liqLong / (liqShort || 1),
      obDelta: obPre != null && obExtreme != null ? obExtreme - obPre : NaN,
      basisDelta: basisPre != null && basisExtreme != null ? basisExtreme - basisPre : NaN,
      btcMove,
    });
  }
  return out;
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const symbols = ["HYPEUSDT", "ETHUSDT", "SOLUSDT", "SUIUSDT"];

  const all: { symbol: string; dips: FeatureRow[]; pumps: FeatureRow[] }[] = [];
  for (const sym of symbols) {
    const c1m = (await load1m(`data/${sym}_1m.jsonl`)).filter(c => c.ts >= cutoff);
    const dipEvents = await findEvents(c1m, 2, 3, "down");
    const pumpEvents = await findEvents(c1m, 2, 3, "up");
    const dips = await extractFeatures(sym, dipEvents, cutoff);
    const pumps = await extractFeatures(sym, pumpEvents, cutoff);
    all.push({ symbol: sym, dips, pumps });
  }

  const fmt = (n: number, dp = 2) => isFinite(n) ? n.toFixed(dp) : "-";
  const pct = (n: number) => isFinite(n) ? n.toFixed(2) + "%" : "-";

  for (const { symbol, dips, pumps } of all) {
    console.log(`\n========== ${symbol}  DIPS n=${dips.length} | PUMPS n=${pumps.length} ==========`);

    if (dips.length) {
      console.log(`\n--- DIPS (-2 to -3%) ---`);
      console.log(`event-start          pct%   OI_by%  OI_bn%   taker  fdByFlipNeg  liqL$   liqS$   ratio   L/SΔ    obΔ    basisΔ   btc%`);
      for (const e of dips) {
        console.log(
          `${new Date(e.tsStart).toISOString().slice(0, 16)}  ${fmt(e.pct).padStart(5)}  ${fmt(e.oiByPct).padStart(5)}  ${fmt(e.oiBnPct).padStart(5)}   ${fmt(e.takerRatio, 2).padStart(4)}    ${(e.fdByFlippedNeg ? "YES" : " no").padStart(3)}      ${e.liqLongUsd.toFixed(0).padStart(8)} ${e.liqShortUsd.toFixed(0).padStart(8)}  ${fmt(e.liqLongShortRatio, 3).padStart(5)}   ${fmt(e.lsBnPosDelta, 3).padStart(6)}  ${fmt(e.obDelta, 3).padStart(6)}  ${fmt(e.basisDelta * 100, 3).padStart(7)}  ${fmt(e.btcMove).padStart(5)}%`
        );
      }
    }
    if (pumps.length) {
      console.log(`\n--- PUMPS (+2 to +3%) ---`);
      console.log(`event-start          pct%   OI_by%  OI_bn%   taker  fdByFlipPos  liqL$   liqS$   ratio   L/SΔ    obΔ    basisΔ   btc%`);
      for (const e of pumps) {
        console.log(
          `${new Date(e.tsStart).toISOString().slice(0, 16)}  ${"+" + fmt(e.pct).padStart(4)}  ${fmt(e.oiByPct).padStart(5)}  ${fmt(e.oiBnPct).padStart(5)}   ${fmt(e.takerRatio, 2).padStart(4)}    ${(e.fdByFlippedPos ? "YES" : " no").padStart(3)}      ${e.liqLongUsd.toFixed(0).padStart(8)} ${e.liqShortUsd.toFixed(0).padStart(8)}  ${fmt(e.liqLongShortRatio, 3).padStart(5)}   ${fmt(e.lsBnPosDelta, 3).padStart(6)}  ${fmt(e.obDelta, 3).padStart(6)}  ${fmt(e.basisDelta * 100, 3).padStart(7)}  ${fmt(e.btcMove).padStart(5)}%`
        );
      }
    }
  }

  console.log(`\n\n========== CROSS-SYMBOL DIP-vs-PUMP COMPARISON (medians) ==========\n`);
  console.log(`feature                      | HYPE-dip | HYPE-pmp | ETH-dip | ETH-pmp | SOL-dip | SOL-pmp | SUI-dip | SUI-pmp`);
  console.log(`-`.repeat(120));
  function row(name: string, getter: (e: FeatureRow) => number, dp = 2) {
    const cells = all.flatMap(({ dips, pumps }) => [
      dips.length ? fmt(median(dips.map(getter).filter(Number.isFinite)), dp) : "-",
      pumps.length ? fmt(median(pumps.map(getter).filter(Number.isFinite)), dp) : "-",
    ]);
    console.log(`${name.padEnd(28)} | ${cells.map(c => c.padStart(8)).join(" | ")}`);
  }
  row("price move %", e => e.pct);
  row("OI Bybit Δ%", e => e.oiByPct);
  row("OI Binance Δ%", e => e.oiBnPct);
  row("taker buy/sell ratio", e => e.takerRatio, 3);
  row("liq long $", e => e.liqLongUsd, 0);
  row("liq short $", e => e.liqShortUsd, 0);
  row("liq L/S ratio", e => e.liqLongShortRatio, 3);
  row("L/S top-pos Δ", e => e.lsBnPosDelta, 3);
  row("OB imbalance Δ", e => e.obDelta, 3);
  row("basis Δ %", e => e.basisDelta * 100, 3);
  row("BTC concurrent %", e => e.btcMove);

  console.log(`\nfunding flips:`);
  console.log(`feature                      | HYPE-dip | HYPE-pmp | ETH-dip | ETH-pmp | SOL-dip | SOL-pmp | SUI-dip | SUI-pmp`);
  const flipDip = (rows: FeatureRow[], k: keyof FeatureRow) => rows.length ? `${rows.filter(e => e[k]).length}/${rows.length}` : "-";
  console.log(`fd-Bybit flipped neg         | ${all.flatMap(({ dips, pumps }) => [flipDip(dips, "fdByFlippedNeg"), flipDip(pumps, "fdByFlippedNeg")]).map(c => c.padStart(8)).join(" | ")}`);
  console.log(`fd-Bybit flipped pos         | ${all.flatMap(({ dips, pumps }) => [flipDip(dips, "fdByFlippedPos"), flipDip(pumps, "fdByFlippedPos")]).map(c => c.padStart(8)).join(" | ")}`);
  console.log(`fd-Binance flipped neg       | ${all.flatMap(({ dips, pumps }) => [flipDip(dips, "fdBnFlippedNeg"), flipDip(pumps, "fdBnFlippedNeg")]).map(c => c.padStart(8)).join(" | ")}`);
  console.log(`fd-Binance flipped pos       | ${all.flatMap(({ dips, pumps }) => [flipDip(dips, "fdBnFlippedPos"), flipDip(pumps, "fdBnFlippedPos")]).map(c => c.padStart(8)).join(" | ")}`);
})();
