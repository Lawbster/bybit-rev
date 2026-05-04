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
function lastBefore<T extends { ts: number }>(rows: T[], t: number): T | null {
  let lo = 0, hi = rows.length - 1, res: T | null = null;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (rows[m].ts <= t) { res = rows[m]; lo = m + 1; } else hi = m - 1;
  }
  return res;
}
function median(arr: number[]): number {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function mean(arr: number[]): number {
  return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN;
}
function std(arr: number[]): number {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

interface Sample {
  ts: number;
  price: number;
  // trailing features
  taker4h: number | null;
  taker1h: number | null;
  oiBy4hPct: number | null;
  oiBn4hPct: number | null;
  oiHl4hPct: number | null;
  oiDivergence4h: number | null;        // bybit% - binance%
  liqLong4h: number;
  liqShort4h: number;
  liqLSRatio4h: number | null;
  liqLSRatio1h: number | null;
  fdBy: number | null;
  fdBn: number | null;
  fdByDelta4h: number | null;
  btc4hMove: number | null;
  // forward returns from current price
  ret15m: number | null;
  ret1h: number | null;
  ret4h: number | null;
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const c1m = (await load1m("data/HYPEUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);
  const c5m = aggregate(c1m, 5 * 60_000);

  console.log(`5m bars: ${c5m.length} (Apr 25 → ${new Date(c5m[c5m.length - 1].ts).toISOString().slice(0, 10)})`);

  console.log("loading feeds…");
  const taker = await loadJsonl("data/HYPEUSDT_taker_binance.jsonl");
  const liq = await loadJsonl("data/HYPEUSDT_liquidations.jsonl");
  const oiBy = await loadJsonl("data/HYPEUSDT_oi_live.jsonl");
  const oiBn = await loadJsonl("data/HYPEUSDT_oi_live_binance.jsonl");
  const oiHl = await loadJsonl("data/HYPEUSDT_oi_live_hyperliquid.jsonl");
  const fdBy = await loadJsonl("data/HYPEUSDT_funding_live.jsonl");
  const fdBn = await loadJsonl("data/HYPEUSDT_funding_live_binance.jsonl");
  const btc1m = (await load1m("data/BTCUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);
  const btc5m = aggregate(btc1m, 5 * 60_000);

  const samples: Sample[] = [];

  for (let i = 0; i < c5m.length; i++) {
    const t = c5m[i].ts;
    const price = c5m[i].c;
    const t1h = t - 3600_000;
    const t4h = t - 4 * 3600_000;

    const taker4h = taker.filter(r => r.ts >= t4h && r.ts <= t);
    const tk4hBuy = taker4h.reduce((s, r) => s + (r.buyVol || 0), 0);
    const tk4hSell = taker4h.reduce((s, r) => s + (r.sellVol || 0), 0);
    const taker4hRatio = tk4hSell > 0 ? tk4hBuy / tk4hSell : null;
    const taker1h = taker.filter(r => r.ts >= t1h && r.ts <= t);
    const tk1hBuy = taker1h.reduce((s, r) => s + (r.buyVol || 0), 0);
    const tk1hSell = taker1h.reduce((s, r) => s + (r.sellVol || 0), 0);
    const taker1hRatio = tk1hSell > 0 ? tk1hBuy / tk1hSell : null;

    const liq4h = liq.filter(r => r.ts >= t4h && r.ts <= t);
    const liqLong4h = liq4h.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShort4h = liq4h.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liq1h = liq.filter(r => r.ts >= t1h && r.ts <= t);
    const liqLong1h = liq1h.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShort1h = liq1h.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);

    const oiByPre = lastBefore(oiBy, t4h)?.openInterestValue ?? null;
    const oiByNow = lastBefore(oiBy, t)?.openInterestValue ?? null;
    const oiBnPre = lastBefore(oiBn, t4h)?.openInterestValue ?? null;
    const oiBnNow = lastBefore(oiBn, t)?.openInterestValue ?? null;
    const oiHlPre = lastBefore(oiHl, t4h)?.openInterestValue ?? null;
    const oiHlNow = lastBefore(oiHl, t)?.openInterestValue ?? null;
    const oiBy4hPct = oiByPre && oiByNow ? (oiByNow - oiByPre) / oiByPre * 100 : null;
    const oiBn4hPct = oiBnPre && oiBnNow ? (oiBnNow - oiBnPre) / oiBnPre * 100 : null;
    const oiHl4hPct = oiHlPre && oiHlNow ? (oiHlNow - oiHlPre) / oiHlPre * 100 : null;
    const oiDivergence4h = oiBy4hPct != null && oiBn4hPct != null ? oiBy4hPct - oiBn4hPct : null;

    const fdByNow = lastBefore(fdBy, t)?.fundingRate ?? null;
    const fdByPre = lastBefore(fdBy, t4h)?.fundingRate ?? null;
    const fdByDelta4h = fdByNow != null && fdByPre != null ? fdByNow - fdByPre : null;
    const fdBnNow = lastBefore(fdBn, t)?.fundingRate ?? null;

    const btcWin = btc5m.filter(c => c.ts >= t4h && c.ts <= t);
    const btc4hMove = btcWin.length > 1 ? (btcWin[btcWin.length - 1].c - btcWin[0].o) / btcWin[0].o * 100 : null;

    // forward returns (look-ahead by definition for forward computation; this is correct)
    const idx15 = i + 3, idx1h = i + 12, idx4h = i + 48;
    const ret15m = idx15 < c5m.length ? (c5m[idx15].c - price) / price * 100 : null;
    const ret1h = idx1h < c5m.length ? (c5m[idx1h].c - price) / price * 100 : null;
    const ret4h = idx4h < c5m.length ? (c5m[idx4h].c - price) / price * 100 : null;

    samples.push({
      ts: t, price,
      taker4h: taker4hRatio, taker1h: taker1hRatio,
      oiBy4hPct, oiBn4hPct, oiHl4hPct, oiDivergence4h,
      liqLong4h, liqShort4h,
      liqLSRatio4h: liqShort4h > 0 ? liqLong4h / liqShort4h : null,
      liqLSRatio1h: liqShort1h > 0 ? liqLong1h / liqShort1h : null,
      fdBy: fdByNow, fdBn: fdBnNow, fdByDelta4h,
      btc4hMove,
      ret15m, ret1h, ret4h,
    });
  }

  console.log(`${samples.length} samples constructed\n`);

  // helper: bucket-by-quantile, compute forward return stats per bucket
  function bucketStats(name: string, getter: (s: Sample) => number | null, horizons: ("ret15m" | "ret1h" | "ret4h")[], nBuckets = 5) {
    const valid = samples.filter(s => getter(s) != null && Number.isFinite(getter(s)!));
    if (valid.length < 50) {
      console.log(`${name}: n=${valid.length} too small, skipping`);
      return;
    }
    const sorted = [...valid].sort((a, b) => getter(a)! - getter(b)!);
    const bucketSize = Math.floor(sorted.length / nBuckets);
    console.log(`\n=== ${name}  (n=${valid.length}, ${nBuckets}-quantile buckets) ===`);
    console.log(`bucket   range                    n     ` + horizons.map(h => `${h}_mean(±std)`.padStart(20)).join(""));
    for (let b = 0; b < nBuckets; b++) {
      const slice = b === nBuckets - 1 ? sorted.slice(b * bucketSize) : sorted.slice(b * bucketSize, (b + 1) * bucketSize);
      const lo = getter(slice[0])!;
      const hi = getter(slice[slice.length - 1])!;
      const cells = horizons.map(h => {
        const vals = slice.map(s => s[h]).filter((x): x is number => x != null && Number.isFinite(x));
        return `${(mean(vals) >= 0 ? "+" : "") + mean(vals).toFixed(3)}%(±${std(vals).toFixed(2)})`;
      });
      console.log(
        `Q${b + 1}    [${lo.toFixed(3)}, ${hi.toFixed(3)}]`.padEnd(35) +
        `${slice.length}`.padStart(5) +
        cells.map(c => c.padStart(20)).join("")
      );
    }
  }

  // single-feature forward-return tests
  console.log("\n========= SINGLE-FEATURE → FORWARD RETURN =========");
  bucketStats("taker4h", s => s.taker4h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("taker1h", s => s.taker1h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("oiBy4hPct", s => s.oiBy4hPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("oiBn4hPct", s => s.oiBn4hPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("oiHl4hPct", s => s.oiHl4hPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("oiDivergence4h (by-bn)", s => s.oiDivergence4h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("liqLSRatio4h", s => s.liqLSRatio4h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("liqLSRatio1h", s => s.liqLSRatio1h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("fdBy (current)", s => s.fdBy, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("fdByDelta4h", s => s.fdByDelta4h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("btc4hMove", s => s.btc4hMove, ["ret15m", "ret1h", "ret4h"]);

  // 2-feature combos: split each feature at median, look at quadrants
  function combo(nameA: string, getA: (s: Sample) => number | null, nameB: string, getB: (s: Sample) => number | null, horizon: "ret15m" | "ret1h" | "ret4h") {
    const valid = samples.filter(s => getA(s) != null && getB(s) != null && Number.isFinite(getA(s)!) && Number.isFinite(getB(s)!) && s[horizon] != null);
    if (valid.length < 50) return;
    const medA = median(valid.map(s => getA(s)!));
    const medB = median(valid.map(s => getB(s)!));
    const quads = {
      "A_lo_B_lo": [] as number[],
      "A_lo_B_hi": [] as number[],
      "A_hi_B_lo": [] as number[],
      "A_hi_B_hi": [] as number[],
    };
    for (const s of valid) {
      const a = getA(s)! < medA ? "lo" : "hi";
      const b = getB(s)! < medB ? "lo" : "hi";
      quads[`A_${a}_B_${b}`].push(s[horizon]!);
    }
    const baseline = mean(valid.map(s => s[horizon]!));
    console.log(`\n${nameA} (med=${medA.toFixed(3)}) × ${nameB} (med=${medB.toFixed(3)}) → ${horizon}  baseline=${baseline.toFixed(3)}%`);
    for (const [k, v] of Object.entries(quads)) {
      const m = mean(v);
      const delta = m - baseline;
      console.log(`  ${k.padEnd(15)} n=${String(v.length).padStart(4)}  ${horizon}=${(m >= 0 ? "+" : "") + m.toFixed(3)}%  Δ=${(delta >= 0 ? "+" : "") + delta.toFixed(3)}%  (±${std(v).toFixed(2)})`);
    }
  }

  console.log("\n\n========= 2-FEATURE COMBOS  (median splits → quadrant forward return) =========");

  // taker × OI
  combo("taker4h", s => s.taker4h, "oiBy4hPct", s => s.oiBy4hPct, "ret1h");
  combo("taker4h", s => s.taker4h, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  // taker × liq
  combo("taker4h", s => s.taker4h, "liqLSRatio4h", s => s.liqLSRatio4h, "ret1h");
  combo("taker4h", s => s.taker4h, "liqLSRatio4h", s => s.liqLSRatio4h, "ret4h");
  // OI × liq
  combo("oiBy4hPct", s => s.oiBy4hPct, "liqLSRatio4h", s => s.liqLSRatio4h, "ret1h");
  combo("oiBy4hPct", s => s.oiBy4hPct, "liqLSRatio4h", s => s.liqLSRatio4h, "ret4h");
  // taker × BTC
  combo("taker4h", s => s.taker4h, "btc4hMove", s => s.btc4hMove, "ret1h");
  combo("taker4h", s => s.taker4h, "btc4hMove", s => s.btc4hMove, "ret4h");
  // OI × BTC (idiosyncratic vs market)
  combo("oiBy4hPct", s => s.oiBy4hPct, "btc4hMove", s => s.btc4hMove, "ret1h");
  combo("oiBy4hPct", s => s.oiBy4hPct, "btc4hMove", s => s.btc4hMove, "ret4h");
  // taker derivative — taker1h vs taker4h
  combo("taker1h", s => s.taker1h, "taker4h", s => s.taker4h, "ret1h");
  // funding × OI
  combo("fdBy", s => s.fdBy, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  combo("fdByDelta4h", s => s.fdByDelta4h, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
})();
