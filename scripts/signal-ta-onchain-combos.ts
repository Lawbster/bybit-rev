import * as fs from "fs";
import * as readline from "readline";
import { RSI, EMA, BollingerBands } from "technicalindicators";

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
function mean(arr: number[]): number { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : NaN; }
function std(arr: number[]): number {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

interface Sample {
  ts: number;
  price: number;
  // TA features (5m)
  rsi5m: number | null;
  ema20_5m_distPct: number | null;
  ema50_5m_distPct: number | null;
  bb20_5m_zscore: number | null;       // (price - mid) / std
  vol_zscore: number | null;            // current 5m vol vs trailing 24h mean
  // TA features (1h)
  rsi1h: number | null;
  ema20_1h_distPct: number | null;
  ema50_1h_distPct: number | null;
  ema200_1h_distPct: number | null;
  // on-chain
  taker4h: number | null;
  oiBy4hPct: number | null;
  oiBn4hPct: number | null;
  oiHl4hPct: number | null;
  liqLSRatio4h: number | null;
  fdBy: number | null;
  fdByDelta4h: number | null;
  btc4hMove: number | null;
  // forward returns
  ret15m: number | null;
  ret1h: number | null;
  ret4h: number | null;
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const c1m = (await load1m("data/HYPEUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);
  const c5m = aggregate(c1m, 5 * 60_000);
  const c1h = aggregate(c1m, 3600_000);

  console.log(`5m bars: ${c5m.length}  1h bars: ${c1h.length}`);
  console.log("computing TA…");

  // 5m TA
  const closes5m = c5m.map(c => c.c);
  const rsi5mArr = RSI.calculate({ values: closes5m, period: 14 });
  const ema20_5m = EMA.calculate({ values: closes5m, period: 20 });
  const ema50_5m = EMA.calculate({ values: closes5m, period: 50 });
  const bb20_5m = BollingerBands.calculate({ values: closes5m, period: 20, stdDev: 2 });

  // 1h TA
  const closes1h = c1h.map(c => c.c);
  const rsi1hArr = RSI.calculate({ values: closes1h, period: 14 });
  const ema20_1h = EMA.calculate({ values: closes1h, period: 20 });
  const ema50_1h = EMA.calculate({ values: closes1h, period: 50 });
  const ema200_1h = EMA.calculate({ values: closes1h, period: 200 });

  // map 1h indicator → ts using bar close
  function indByTs1h(ind: number[], offset: number): Map<number, number> {
    const m = new Map<number, number>();
    for (let i = 0; i < ind.length; i++) m.set(c1h[i + offset].ts, ind[i]);
    return m;
  }
  const rsi1hMap = indByTs1h(rsi1hArr, 14);
  const ema20_1h_map = indByTs1h(ema20_1h, 19);
  const ema50_1h_map = indByTs1h(ema50_1h, 49);
  const ema200_1h_map = indByTs1h(ema200_1h, 199);

  function lookup1h(map: Map<number, number>, t: number): number | null {
    const bucket = Math.floor(t / 3600_000) * 3600_000;
    const v = map.get(bucket);
    return v != null ? v : null;
  }

  // load on-chain
  console.log("loading on-chain feeds…");
  const taker = await loadJsonl("data/HYPEUSDT_taker_binance.jsonl");
  const liq = await loadJsonl("data/HYPEUSDT_liquidations.jsonl");
  const oiBy = await loadJsonl("data/HYPEUSDT_oi_live.jsonl");
  const oiBn = await loadJsonl("data/HYPEUSDT_oi_live_binance.jsonl");
  const oiHl = await loadJsonl("data/HYPEUSDT_oi_live_hyperliquid.jsonl");
  const fdBy = await loadJsonl("data/HYPEUSDT_funding_live.jsonl");
  const btc1m = (await load1m("data/BTCUSDT_1m.jsonl")).filter(c => c.ts >= cutoff);
  const btc5m = aggregate(btc1m, 5 * 60_000);

  console.log("constructing samples…");
  const samples: Sample[] = [];

  for (let i = 0; i < c5m.length; i++) {
    const t = c5m[i].ts;
    const price = c5m[i].c;
    const t4h = t - 4 * 3600_000;

    // 5m TA at this bar
    const rsi5mIdx = i - 14;
    const rsi5m = rsi5mIdx >= 0 ? rsi5mArr[rsi5mIdx] : null;
    const ema20Idx = i - 19;
    const ema20_5m_v = ema20Idx >= 0 ? ema20_5m[ema20Idx] : null;
    const ema50Idx = i - 49;
    const ema50_5m_v = ema50Idx >= 0 ? ema50_5m[ema50Idx] : null;
    const bbIdx = i - 19;
    const bb = bbIdx >= 0 ? bb20_5m[bbIdx] : null;

    const ema20_5m_distPct = ema20_5m_v ? (price - ema20_5m_v) / ema20_5m_v * 100 : null;
    const ema50_5m_distPct = ema50_5m_v ? (price - ema50_5m_v) / ema50_5m_v * 100 : null;
    const bb20_5m_zscore = bb ? ((price - bb.middle) / ((bb.upper - bb.lower) / 4)) : null;

    // volume z-score: current 5m vol vs trailing 288 bars (24h) mean
    const volWin = c5m.slice(Math.max(0, i - 288), i);
    const volMean = volWin.length ? mean(volWin.map(c => c.v)) : null;
    const volStd = volWin.length > 1 ? std(volWin.map(c => c.v)) : null;
    const vol_zscore = volMean != null && volStd && volStd > 0 ? (c5m[i].v - volMean) / volStd : null;

    // 1h TA
    const rsi1h = lookup1h(rsi1hMap, t);
    const ema20_1h_v = lookup1h(ema20_1h_map, t);
    const ema50_1h_v = lookup1h(ema50_1h_map, t);
    const ema200_1h_v = lookup1h(ema200_1h_map, t);
    const ema20_1h_distPct = ema20_1h_v ? (price - ema20_1h_v) / ema20_1h_v * 100 : null;
    const ema50_1h_distPct = ema50_1h_v ? (price - ema50_1h_v) / ema50_1h_v * 100 : null;
    const ema200_1h_distPct = ema200_1h_v ? (price - ema200_1h_v) / ema200_1h_v * 100 : null;

    // on-chain trailing 4h
    const taker4hRows = taker.filter(r => r.ts >= t4h && r.ts <= t);
    const tk4hBuy = taker4hRows.reduce((s, r) => s + (r.buyVol || 0), 0);
    const tk4hSell = taker4hRows.reduce((s, r) => s + (r.sellVol || 0), 0);
    const taker4h = tk4hSell > 0 ? tk4hBuy / tk4hSell : null;

    const liq4h = liq.filter(r => r.ts >= t4h && r.ts <= t);
    const liqLong4h = liq4h.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqShort4h = liq4h.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);
    const liqLSRatio4h = liqShort4h > 0 ? liqLong4h / liqShort4h : null;

    const oiByPre = lastBefore(oiBy, t4h)?.openInterestValue ?? null;
    const oiByNow = lastBefore(oiBy, t)?.openInterestValue ?? null;
    const oiBnPre = lastBefore(oiBn, t4h)?.openInterestValue ?? null;
    const oiBnNow = lastBefore(oiBn, t)?.openInterestValue ?? null;
    const oiHlPre = lastBefore(oiHl, t4h)?.openInterestValue ?? null;
    const oiHlNow = lastBefore(oiHl, t)?.openInterestValue ?? null;
    const oiBy4hPct = oiByPre && oiByNow ? (oiByNow - oiByPre) / oiByPre * 100 : null;
    const oiBn4hPct = oiBnPre && oiBnNow ? (oiBnNow - oiBnPre) / oiBnPre * 100 : null;
    const oiHl4hPct = oiHlPre && oiHlNow ? (oiHlNow - oiHlPre) / oiHlPre * 100 : null;

    const fdByNow = lastBefore(fdBy, t)?.fundingRate ?? null;
    const fdByPre = lastBefore(fdBy, t4h)?.fundingRate ?? null;
    const fdByDelta4h = fdByNow != null && fdByPre != null ? fdByNow - fdByPre : null;

    const btcWin = btc5m.filter(c => c.ts >= t4h && c.ts <= t);
    const btc4hMove = btcWin.length > 1 ? (btcWin[btcWin.length - 1].c - btcWin[0].o) / btcWin[0].o * 100 : null;

    // forward returns
    const ret15m = i + 3 < c5m.length ? (c5m[i + 3].c - price) / price * 100 : null;
    const ret1h = i + 12 < c5m.length ? (c5m[i + 12].c - price) / price * 100 : null;
    const ret4h = i + 48 < c5m.length ? (c5m[i + 48].c - price) / price * 100 : null;

    samples.push({
      ts: t, price,
      rsi5m, ema20_5m_distPct, ema50_5m_distPct, bb20_5m_zscore, vol_zscore,
      rsi1h, ema20_1h_distPct, ema50_1h_distPct, ema200_1h_distPct,
      taker4h, oiBy4hPct, oiBn4hPct, oiHl4hPct, liqLSRatio4h, fdBy: fdByNow, fdByDelta4h, btc4hMove,
      ret15m, ret1h, ret4h,
    });
  }

  console.log(`${samples.length} samples\n`);

  function bucketStats(name: string, getter: (s: Sample) => number | null, horizons: ("ret15m" | "ret1h" | "ret4h")[], nBuckets = 5) {
    const valid = samples.filter(s => getter(s) != null && Number.isFinite(getter(s)!));
    if (valid.length < 100) return;
    const sorted = [...valid].sort((a, b) => getter(a)! - getter(b)!);
    const bucketSize = Math.floor(sorted.length / nBuckets);
    console.log(`\n=== ${name}  n=${valid.length} ===`);
    console.log(`Q   range                       n     ` + horizons.map(h => `${h}_mean(±std)`.padStart(20)).join(""));
    for (let b = 0; b < nBuckets; b++) {
      const slice = b === nBuckets - 1 ? sorted.slice(b * bucketSize) : sorted.slice(b * bucketSize, (b + 1) * bucketSize);
      const lo = getter(slice[0])!;
      const hi = getter(slice[slice.length - 1])!;
      const cells = horizons.map(h => {
        const vals = slice.map(s => s[h]).filter((x): x is number => x != null && Number.isFinite(x));
        return `${(mean(vals) >= 0 ? "+" : "") + mean(vals).toFixed(3)}%(±${std(vals).toFixed(2)})`;
      });
      console.log(`Q${b + 1}  [${lo.toFixed(2)}, ${hi.toFixed(2)}]`.padEnd(35) + `${slice.length}`.padStart(5) + cells.map(c => c.padStart(20)).join(""));
    }
  }

  function combo3(nameA: string, getA: (s: Sample) => number | null, nameB: string, getB: (s: Sample) => number | null, nameC: string, getC: (s: Sample) => number | null, horizon: "ret15m" | "ret1h" | "ret4h") {
    const valid = samples.filter(s => getA(s) != null && getB(s) != null && getC(s) != null && Number.isFinite(getA(s)!) && Number.isFinite(getB(s)!) && Number.isFinite(getC(s)!) && s[horizon] != null);
    if (valid.length < 100) return;
    const medA = median(valid.map(s => getA(s)!));
    const medB = median(valid.map(s => getB(s)!));
    const medC = median(valid.map(s => getC(s)!));
    const bins: Record<string, number[]> = {};
    for (const s of valid) {
      const a = getA(s)! < medA ? "lo" : "hi";
      const b = getB(s)! < medB ? "lo" : "hi";
      const c = getC(s)! < medC ? "lo" : "hi";
      const k = `${a}-${b}-${c}`;
      if (!bins[k]) bins[k] = [];
      bins[k].push(s[horizon]!);
    }
    const baseline = mean(valid.map(s => s[horizon]!));
    console.log(`\n${nameA}/${nameB}/${nameC} → ${horizon}   baseline=${baseline.toFixed(3)}%`);
    const sorted = Object.entries(bins).sort((a, b) => mean(b[1]) - mean(a[1]));
    for (const [k, v] of sorted) {
      const m = mean(v);
      console.log(`  ${k.padEnd(11)} n=${String(v.length).padStart(4)}  ${horizon}=${(m >= 0 ? "+" : "") + m.toFixed(3)}%  Δ=${(m - baseline >= 0 ? "+" : "") + (m - baseline).toFixed(3)}%  σ=${std(v).toFixed(2)}`);
    }
  }

  function combo2(nameA: string, getA: (s: Sample) => number | null, nameB: string, getB: (s: Sample) => number | null, horizon: "ret15m" | "ret1h" | "ret4h") {
    const valid = samples.filter(s => getA(s) != null && getB(s) != null && Number.isFinite(getA(s)!) && Number.isFinite(getB(s)!) && s[horizon] != null);
    if (valid.length < 100) return;
    const medA = median(valid.map(s => getA(s)!));
    const medB = median(valid.map(s => getB(s)!));
    const bins: Record<string, number[]> = { "lo-lo": [], "lo-hi": [], "hi-lo": [], "hi-hi": [] };
    for (const s of valid) {
      const a = getA(s)! < medA ? "lo" : "hi";
      const b = getB(s)! < medB ? "lo" : "hi";
      bins[`${a}-${b}`].push(s[horizon]!);
    }
    const baseline = mean(valid.map(s => s[horizon]!));
    console.log(`\n${nameA}(med=${medA.toFixed(2)}) × ${nameB}(med=${medB.toFixed(2)}) → ${horizon}   base=${baseline.toFixed(3)}%`);
    const sorted = Object.entries(bins).sort((a, b) => mean(b[1]) - mean(a[1]));
    for (const [k, v] of sorted) {
      const m = mean(v);
      console.log(`  ${k.padEnd(7)} n=${String(v.length).padStart(4)}  ${(m >= 0 ? "+" : "") + m.toFixed(3)}%  Δ=${(m - baseline >= 0 ? "+" : "") + (m - baseline).toFixed(3)}%  σ=${std(v).toFixed(2)}`);
    }
  }

  console.log("========= SINGLE-FEATURE TA → FORWARD RETURN =========");
  bucketStats("rsi5m", s => s.rsi5m, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("rsi1h", s => s.rsi1h, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("ema50_5m_distPct", s => s.ema50_5m_distPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("ema50_1h_distPct", s => s.ema50_1h_distPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("ema200_1h_distPct", s => s.ema200_1h_distPct, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("bb20_5m_zscore", s => s.bb20_5m_zscore, ["ret15m", "ret1h", "ret4h"]);
  bucketStats("vol_zscore", s => s.vol_zscore, ["ret15m", "ret1h", "ret4h"]);

  console.log("\n\n========= 2-FEATURE: TA × ON-CHAIN =========");
  // RSI × taker
  combo2("rsi1h", s => s.rsi1h, "taker4h", s => s.taker4h, "ret1h");
  combo2("rsi1h", s => s.rsi1h, "taker4h", s => s.taker4h, "ret4h");
  // RSI × liq
  combo2("rsi1h", s => s.rsi1h, "liqLSRatio4h", s => s.liqLSRatio4h, "ret4h");
  // RSI × OI
  combo2("rsi1h", s => s.rsi1h, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  // EMA50 1h × taker
  combo2("ema50_1h_distPct", s => s.ema50_1h_distPct, "taker4h", s => s.taker4h, "ret4h");
  // EMA50 1h × OI
  combo2("ema50_1h_distPct", s => s.ema50_1h_distPct, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  // EMA200 × OI
  combo2("ema200_1h_distPct", s => s.ema200_1h_distPct, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  // BB × taker
  combo2("bb20_5m_zscore", s => s.bb20_5m_zscore, "taker4h", s => s.taker4h, "ret1h");
  // BB × liq
  combo2("bb20_5m_zscore", s => s.bb20_5m_zscore, "liqLSRatio4h", s => s.liqLSRatio4h, "ret1h");
  // Volume × OI
  combo2("vol_zscore", s => s.vol_zscore, "oiBy4hPct", s => s.oiBy4hPct, "ret1h");
  combo2("vol_zscore", s => s.vol_zscore, "oiBy4hPct", s => s.oiBy4hPct, "ret4h");
  // Volume × RSI
  combo2("vol_zscore", s => s.vol_zscore, "rsi1h", s => s.rsi1h, "ret1h");

  console.log("\n\n========= 3-FEATURE COMBOS  (deeper signal hunt) =========");
  combo3("rsi1h", s => s.rsi1h, "taker4h", s => s.taker4h, "btc4hMove", s => s.btc4hMove, "ret4h");
  combo3("rsi1h", s => s.rsi1h, "oiBy4hPct", s => s.oiBy4hPct, "btc4hMove", s => s.btc4hMove, "ret4h");
  combo3("rsi1h", s => s.rsi1h, "ema50_1h_distPct", s => s.ema50_1h_distPct, "taker4h", s => s.taker4h, "ret4h");
  combo3("ema50_1h_distPct", s => s.ema50_1h_distPct, "taker4h", s => s.taker4h, "btc4hMove", s => s.btc4hMove, "ret4h");
  combo3("bb20_5m_zscore", s => s.bb20_5m_zscore, "vol_zscore", s => s.vol_zscore, "liqLSRatio4h", s => s.liqLSRatio4h, "ret1h");
  combo3("rsi1h", s => s.rsi1h, "vol_zscore", s => s.vol_zscore, "fdByDelta4h", s => s.fdByDelta4h, "ret4h");

  // EXTREME-condition tail tests: when RSI is in extreme zone, what does on-chain say?
  console.log("\n\n========= EXTREME-RSI ZONE BREAKDOWNS =========");
  function extremeBreakdown(zoneName: string, filter: (s: Sample) => boolean, horizon: "ret15m" | "ret1h" | "ret4h") {
    const subset = samples.filter(filter).filter(s => s[horizon] != null);
    if (subset.length < 30) { console.log(`${zoneName}: n=${subset.length} too small`); return; }
    console.log(`\n--- ${zoneName}  n=${subset.length}  ${horizon}_overall=${mean(subset.map(s => s[horizon]!)).toFixed(3)}% (±${std(subset.map(s => s[horizon]!)).toFixed(2)}) ---`);
    const splits: { name: string; getter: (s: Sample) => number | null; }[] = [
      { name: "taker4h", getter: s => s.taker4h },
      { name: "oiBy4hPct", getter: s => s.oiBy4hPct },
      { name: "liqLSRatio4h", getter: s => s.liqLSRatio4h },
      { name: "btc4hMove", getter: s => s.btc4hMove },
      { name: "fdBy", getter: s => s.fdBy },
    ];
    for (const sp of splits) {
      const valid = subset.filter(s => sp.getter(s) != null);
      if (valid.length < 20) continue;
      const med = median(valid.map(s => sp.getter(s)!));
      const lo = valid.filter(s => sp.getter(s)! < med).map(s => s[horizon]!);
      const hi = valid.filter(s => sp.getter(s)! >= med).map(s => s[horizon]!);
      console.log(`  ${sp.name.padEnd(18)} med=${med.toFixed(3)}  lo n=${lo.length} ${horizon}=${(mean(lo) >= 0 ? "+" : "") + mean(lo).toFixed(3)}%  hi n=${hi.length} ${horizon}=${(mean(hi) >= 0 ? "+" : "") + mean(hi).toFixed(3)}%  spread=${(mean(hi) - mean(lo) >= 0 ? "+" : "") + (mean(hi) - mean(lo)).toFixed(3)}%`);
    }
  }

  extremeBreakdown("RSI1h < 30 (oversold)", s => s.rsi1h != null && s.rsi1h < 30, "ret4h");
  extremeBreakdown("RSI1h > 70 (overbought)", s => s.rsi1h != null && s.rsi1h > 70, "ret4h");
  extremeBreakdown("RSI5m < 25", s => s.rsi5m != null && s.rsi5m < 25, "ret1h");
  extremeBreakdown("RSI5m > 75", s => s.rsi5m != null && s.rsi5m > 75, "ret1h");
  extremeBreakdown("Price < EMA200_1h by 3%+", s => s.ema200_1h_distPct != null && s.ema200_1h_distPct < -3, "ret4h");
  extremeBreakdown("Price > EMA200_1h by 3%+", s => s.ema200_1h_distPct != null && s.ema200_1h_distPct > 3, "ret4h");
  extremeBreakdown("BB lower band touch (z<-1.5)", s => s.bb20_5m_zscore != null && s.bb20_5m_zscore < -1.5, "ret1h");
  extremeBreakdown("BB upper band touch (z>1.5)", s => s.bb20_5m_zscore != null && s.bb20_5m_zscore > 1.5, "ret1h");
  extremeBreakdown("Vol spike (z>2)", s => s.vol_zscore != null && s.vol_zscore > 2, "ret1h");
})();
