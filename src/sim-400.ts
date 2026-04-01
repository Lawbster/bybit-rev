import fs from "fs";
import { Candle } from "./fetch-candles";

// Quick config sweep for $400 capital, targeting ~50% max drawdown
// Tests different base sizes and scale factors on full HYPE history from Dec 2024

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
const startTs = new Date("2024-12-05").getTime();
const data = candles.filter(c => c.timestamp >= startTs);

// ── 4h trend gate (EMA200/50) ──
const PERIOD = 4 * 3600000;
const bars: { ts: number; close: number }[] = [];
let curBar = -1, lastClose = 0, lastTs = 0;
for (const c of data) {
  const bar = Math.floor(c.timestamp / PERIOD);
  if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
  lastClose = c.close; lastTs = c.timestamp;
}
bars.push({ ts: lastTs, close: lastClose });
const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
const hostile = new Map<number, boolean>();
for (let i = 1; i < bars.length; i++) hostile.set(Math.floor(bars[i].ts / PERIOD) * PERIOD, closes[i] < e200[i] && e50[i] < e50[i - 1]);
const isHostile = (ts: number) => hostile.get(Math.floor(ts / PERIOD) * PERIOD - PERIOD) ?? false;

interface Cfg {
  label: string;
  base: number; scale: number; maxPos: number; capital: number;
  tp: number; addMin: number;
  staleH: number; reducedTp: number;
  flatH: number; flatPct: number; killPct: number; fee: number;
}

function sim(cfg: Cfg) {
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  let lastAdd = 0;
  let tps = 0, stales = 0, kills = 0, flats = 0;

  for (const c of data) {
    const ts = c.timestamp, price = c.close;
    if (longs.length === 0 && isHostile(ts)) continue;

    const avgEp = () => longs.reduce((a, p) => a + p.ep * p.not, 0) / longs.reduce((a, p) => a + p.not, 0);

    // TP
    if (longs.length > 0) {
      const tpP = avgEp() * (1 + cfg.tp / 100);
      if (c.high >= tpP) {
        let pnl = 0;
        for (const p of longs) pnl += (tpP - p.ep) * p.qty - (p.not * cfg.fee + tpP * p.qty * cfg.fee);
        cap += pnl; longs.length = 0; lastAdd = 0; tps++;
        if (cap > peak) peak = cap;
        const dd = (peak - cap) / peak * 100; if (dd > maxDD) maxDD = dd;
        if (cap < minEq) minEq = cap;
        continue;
      }
    }

    // stale exit
    if (longs.length > 0) {
      const staleMs = cfg.staleH * 3600000;
      if (longs.some(p => ts - p.et >= staleMs)) {
        const ep2 = Math.min(price, avgEp() * (1 + cfg.reducedTp / 100));
        let pnl = 0;
        for (const p of longs) pnl += (ep2 - p.ep) * p.qty - (p.not * cfg.fee + ep2 * p.qty * cfg.fee);
        cap += pnl; longs.length = 0; lastAdd = 0; stales++;
        if (cap > peak) peak = cap;
        const dd = (peak - cap) / peak * 100; if (dd > maxDD) maxDD = dd;
        if (cap < minEq) minEq = cap;
        continue;
      }
    }

    // hard flatten
    if (longs.length > 0) {
      const flatP = avgEp() * (1 + cfg.flatPct / 100);
      const oldest = Math.min(...longs.map(p => p.et));
      if (ts - oldest >= cfg.flatH * 3600000 || c.low <= flatP) {
        const ep2 = Math.min(price, flatP);
        let pnl = 0;
        for (const p of longs) pnl += (ep2 - p.ep) * p.qty - (p.not * cfg.fee + ep2 * p.qty * cfg.fee);
        cap += pnl; longs.length = 0; lastAdd = 0; flats++;
        if (cap > peak) peak = cap;
        const dd = (peak - cap) / peak * 100; if (dd > maxDD) maxDD = dd;
        if (cap < minEq) minEq = cap;
        continue;
      }
    }

    // emergency kill
    if (longs.length > 0) {
      const killP = avgEp() * (1 + cfg.killPct / 100);
      if (c.low <= killP) {
        let pnl = 0;
        for (const p of longs) pnl += (killP - p.ep) * p.qty - (p.not * cfg.fee + killP * p.qty * cfg.fee);
        cap += pnl; longs.length = 0; lastAdd = 0; kills++;
        if (cap > peak) peak = cap;
        const dd = (peak - cap) / peak * 100; if (dd > maxDD) maxDD = dd;
        if (cap < minEq) minEq = cap;
        continue;
      }
    }

    // add position
    if (longs.length < cfg.maxPos && ts - lastAdd >= cfg.addMin * 60000) {
      const not = cfg.base * Math.pow(cfg.scale, longs.length);
      const qty = not / price;
      longs.push({ ep: price, et: ts, qty, not });
      lastAdd = ts;
      // mark-to-market DD
      const unreal = longs.reduce((a, p) => a + (price - p.ep) * p.qty, 0);
      const fees = longs.reduce((a, p) => a + p.not * cfg.fee, 0);
      const eq = cap + unreal - fees;
      if (eq > peak) peak = eq;
      const dd = (peak - eq) / peak * 100; if (dd > maxDD) maxDD = dd;
      if (eq < minEq) minEq = eq;
    }
  }

  return { ret: (cap - cfg.capital) / cfg.capital * 100, maxDD, minEq, cap, tps, stales, kills, flats };
}

const CAPITAL = 400;
const BASE_CONFIGS = [
  { label: "base=5  sc=1.2", base: 5, scale: 1.2, maxPos: 11 },
  { label: "base=8  sc=1.2", base: 8, scale: 1.2, maxPos: 11 },
  { label: "base=10 sc=1.2", base: 10, scale: 1.2, maxPos: 11 },
  { label: "base=12 sc=1.2", base: 12, scale: 1.2, maxPos: 11 },
  { label: "base=15 sc=1.2", base: 15, scale: 1.2, maxPos: 11 },
  { label: "base=20 sc=1.2", base: 20, scale: 1.2, maxPos: 11 },
  { label: "base=10 sc=1.3", base: 10, scale: 1.3, maxPos: 11 },
  { label: "base=10 sc=1.15", base: 10, scale: 1.15, maxPos: 11 },
  { label: "base=10 sc=1.2 mx=9", base: 10, scale: 1.2, maxPos: 9 },
  { label: "base=15 sc=1.15", base: 15, scale: 1.15, maxPos: 11 },
];

console.log(`\nConfig sweep — capital=$${CAPITAL}, tp=1.4%, stale=8h→0.3%, flat=-6%@40h, kill=-10%`);
console.log(`(Dec 2024 → present, trend gate on)\n`);
console.log("Label".padEnd(22) + "Return%".padStart(9) + "MaxDD%".padStart(9) + "MinEq".padStart(9) + "TPs".padStart(7) + "Stales".padStart(8) + "Kills".padStart(7) + "Flats".padStart(7) + "  Note");
console.log("-".repeat(85));

for (const c of BASE_CONFIGS) {
  const r = sim({
    label: c.label, base: c.base, scale: c.scale, maxPos: c.maxPos,
    capital: CAPITAL, tp: 1.4, addMin: 30,
    staleH: 8, reducedTp: 0.3,
    flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055,
  });

  // Max margin at full ladder
  const totalMargin = Array.from({ length: c.maxPos }, (_, i) => c.base * Math.pow(c.scale, i)).reduce((a, b) => a + b, 0) / 50;
  const marginPct = (totalMargin / CAPITAL * 100).toFixed(0);

  const flag = r.maxDD >= 40 && r.maxDD <= 60 ? "  ← target" : r.maxDD < 40 ? "  (DD low)" : "  (DD HIGH)";
  console.log(
    c.label.padEnd(22) +
    (r.ret.toFixed(1) + "%").padStart(9) +
    (r.maxDD.toFixed(1) + "%").padStart(9) +
    ("$" + r.minEq.toFixed(0)).padStart(9) +
    r.tps.toString().padStart(7) +
    r.stales.toString().padStart(8) +
    r.kills.toString().padStart(7) +
    r.flats.toString().padStart(7) +
    `  margin@full=${marginPct}%` + flag
  );
}

// Recommended config detail
console.log("\n--- Full ladder notional by rung (base=10, scale=1.2, 11 max) ---");
let total = 0;
for (let i = 0; i < 11; i++) {
  const not = 10 * Math.pow(1.2, i);
  total += not;
  console.log(`  Rung ${(i + 1).toString().padStart(2)}: $${not.toFixed(2).padStart(8)} notional  margin=$${(not / 50).toFixed(2).padStart(6)}  cumulative=$${total.toFixed(2)}`);
}
console.log(`  Total margin at 50x: $${(total / 50).toFixed(2)} of $${CAPITAL} = ${(total / 50 / CAPITAL * 100).toFixed(1)}%`);
