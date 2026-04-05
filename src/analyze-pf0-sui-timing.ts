// analyze-pf0-sui-timing.ts — Time-of-day and BTC context analysis for SUI PF0
// Already filtered by roc12h>5% block. Checks:
//   1. Hour-of-day buckets (UTC) — which hours produce losses?
//   2. Session buckets (Asia/Europe/US)
//   3. BTC 1H return at signal time
//   4. BTC 4H trend (above/below EMA20)
//   5. BTC 12h momentum
//   6. BTC support: distance from BTC 24h low
//   7. Combined: time + BTC filters

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars1m: Candle[] = JSON.parse(fs.readFileSync("data/vps/SUIUSDT_1_full.json", "utf-8"));
bars1m.sort((a, b) => a.timestamp - b.timestamp);

// Load BTC data
const btc1m: Candle[] = JSON.parse(fs.readFileSync("data/vps/BTCUSDT_1_full.json", "utf-8"));
btc1m.sort((a, b) => a.timestamp - b.timestamp);

function agg(bars: Candle[], min: number): Candle[] {
  const ms = min * 60000, m = new Map<number, Candle>();
  for (const c of bars) {
    const k = Math.floor(c.timestamp / ms) * ms, e = m.get(k);
    if (!e) m.set(k, { ...c, timestamp: k });
    else { e.high = Math.max(e.high, c.high); e.low = Math.min(e.low, c.low); e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function emaCalc(vals: number[], p: number): number[] {
  const k = 2 / (p + 1);
  const r = [vals[0]];
  for (let i = 1; i < vals.length; i++) r.push(vals[i] * k + r[i - 1] * (1 - k));
  return r;
}

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

const bars1h = agg(bars1m, 60);
const ts1m = bars1m.map(b => b.timestamp);
const ts1h = bars1h.map(b => b.timestamp);
const closes1h = bars1h.map(b => b.close);

// BTC timeframes
const btc1h = agg(btc1m, 60);
const btc4h = agg(btc1m, 240);
const tsBtc1h = btc1h.map(b => b.timestamp);
const tsBtc4h = btc4h.map(b => b.timestamp);
const btcCloses1h = btc1h.map(b => b.close);
const btcCloses4h = btc4h.map(b => b.close);
const btcEma20_4h = emaCalc(btcCloses4h, 20);
const btcEma50_1h = emaCalc(btcCloses1h, 50);

console.log(`SUI 1m: ${bars1m.length} | BTC 1m: ${btc1m.length}\n`);

// ── Signals (with roc12h>5% block already applied) ──
interface Sig { ts: number; price: number; barIdx: number; }
const allSignals: Sig[] = [];
let lastSigTs = 0;
for (let i = 4; i < bars1h.length; i++) {
  const pumpIdx = i - 3;
  const bar = bars1h[pumpIdx];
  const body = ((bar.close - bar.open) / bar.open) * 100;
  if (body < 2.0) continue;
  const pH = bar.high;
  let failed = true;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].high > pH * 1.003) { failed = false; break; } }
  if (!failed) continue;
  let hasRed = false;
  for (let j = pumpIdx + 1; j <= i; j++) { if (bars1h[j].close < bars1h[j].open) { hasRed = true; break; } }
  if (!hasRed) continue;
  if (bars1h[i].timestamp - lastSigTs < 2 * 3600000) continue;
  allSignals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close, barIdx: i });
  lastSigTs = bars1h[i].timestamp;
}

// Apply roc12h>5% block
const signals = allSignals.filter(sig => {
  if (sig.barIdx < 12) return false;
  const roc = ((closes1h[sig.barIdx] - closes1h[sig.barIdx - 12]) / closes1h[sig.barIdx - 12]) * 100;
  return roc <= 5;
});

console.log(`Signals after roc12h block: ${signals.length}\n`);

// ── Sim each at 2.5/3, $10k ──
const NOTIONAL = 10000;
const FEE = 0.0011;
const MAX_HOLD = 720;
const TP_PCT = 2.5;
const SL_PCT = 3.0;

interface Trade {
  ts: number;
  price: number;
  pnl: number;
  outcome: string;
  hourUTC: number;
  // BTC context
  btcRet1h: number;     // BTC 1H return at signal time
  btcRet4h: number;     // BTC 4H return
  btcRet12h: number;    // BTC 12H return
  btcAboveEma20_4h: boolean;
  btcAboveEma50_1h: boolean;
  btcDistFrom24hLow: number;  // BTC distance from its own 24h low
  btcDistFrom24hHigh: number;
}

const trades: Trade[] = [];

for (const sig of signals) {
  const entryIdx = bsearch(ts1m, sig.ts + 3600000);
  if (entryIdx < 0 || entryIdx >= bars1m.length - 10) continue;
  const ep = sig.price;
  const tp = ep * (1 - TP_PCT / 100);
  const sl = ep * (1 + SL_PCT / 100);
  const maxIdx = Math.min(entryIdx + MAX_HOLD, bars1m.length - 1);
  let pnl = 0, outcome = "flat";

  for (let j = entryIdx + 1; j <= maxIdx; j++) {
    if (bars1m[j].high >= sl) { pnl = -SL_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "stop"; break; }
    if (bars1m[j].low <= tp) { pnl = TP_PCT / 100 * NOTIONAL - NOTIONAL * FEE; outcome = "tp"; break; }
  }
  if (outcome === "flat") pnl = ((ep - bars1m[maxIdx].close) / ep) * NOTIONAL - NOTIONAL * FEE;

  const hourUTC = new Date(sig.ts).getUTCHours();

  // BTC context
  const btcI1h = bsearch(tsBtc1h, sig.ts);
  const btcI4h = bsearch(tsBtc4h, sig.ts);

  let btcRet1h = 0, btcRet4h = 0, btcRet12h = 0;
  let btcAboveEma20_4h = false, btcAboveEma50_1h = false;
  let btcDistFrom24hLow = 0, btcDistFrom24hHigh = 0;

  if (btcI1h > 12) {
    btcRet1h = ((btcCloses1h[btcI1h] - btcCloses1h[btcI1h - 1]) / btcCloses1h[btcI1h - 1]) * 100;
    btcRet12h = ((btcCloses1h[btcI1h] - btcCloses1h[btcI1h - 12]) / btcCloses1h[btcI1h - 12]) * 100;
    btcAboveEma50_1h = btcCloses1h[btcI1h] > btcEma50_1h[btcI1h];

    // BTC 24h high/low
    let btcHi24 = 0, btcLo24 = Infinity;
    for (let j = Math.max(0, btcI1h - 24); j <= btcI1h; j++) {
      if (btc1h[j].high > btcHi24) btcHi24 = btc1h[j].high;
      if (btc1h[j].low < btcLo24) btcLo24 = btc1h[j].low;
    }
    btcDistFrom24hLow = ((btcCloses1h[btcI1h] - btcLo24) / btcLo24) * 100;
    btcDistFrom24hHigh = ((btcCloses1h[btcI1h] - btcHi24) / btcHi24) * 100;
  }
  if (btcI4h > 4) {
    btcRet4h = ((btcCloses4h[btcI4h] - btcCloses4h[btcI4h - 1]) / btcCloses4h[btcI4h - 1]) * 100;
    btcAboveEma20_4h = btcCloses4h[btcI4h] > btcEma20_4h[btcI4h];
  }

  trades.push({ ts: sig.ts, price: ep, pnl, outcome, hourUTC,
    btcRet1h, btcRet4h, btcRet12h, btcAboveEma20_4h, btcAboveEma50_1h,
    btcDistFrom24hLow, btcDistFrom24hHigh });
}

// ── Helpers ──
function printBucket(label: string, bucket: Trade[]) {
  if (bucket.length === 0) return;
  const w = bucket.filter(t => t.outcome === "tp").length;
  const l = bucket.filter(t => t.outcome === "stop").length;
  const f = bucket.length - w - l;
  const p = bucket.reduce((s, t) => s + t.pnl, 0);
  const wr = (w / bucket.length * 100).toFixed(0);
  console.log(`  ${label.padEnd(32)} N=${String(bucket.length).padEnd(4)} W=${String(w).padEnd(3)} L=${String(l).padEnd(3)} F=${String(f).padEnd(3)} WR=${wr.padStart(3)}%  PnL=$${(p >= 0 ? "+" : "") + p.toFixed(0).padStart(6)}  $/t=$${(p / bucket.length).toFixed(1)}`);
}

// ═══════════════════════════════════════════════════════════════════
// 1. HOUR OF DAY
// ═══════════════════════════════════════════════════════════════════
console.log(`${"═".repeat(100)}`);
console.log("HOUR OF DAY (UTC) — signal fire time");
console.log("─".repeat(90));
for (let h = 0; h < 24; h++) {
  const bucket = trades.filter(t => t.hourUTC === h);
  if (bucket.length > 0) printBucket(`${String(h).padStart(2)}:00 UTC`, bucket);
}

// ═══════════════════════════════════════════════════════════════════
// 2. SESSIONS
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("SESSION BUCKETS");
console.log("─".repeat(90));
const sessions = [
  { label: "Asia       (00:00-08:00 UTC)", min: 0, max: 8 },
  { label: "Europe     (08:00-14:00 UTC)", min: 8, max: 14 },
  { label: "US         (14:00-20:00 UTC)", min: 14, max: 20 },
  { label: "Late US    (20:00-00:00 UTC)", min: 20, max: 24 },
];
for (const s of sessions) {
  printBucket(s.label, trades.filter(t => t.hourUTC >= s.min && t.hourUTC < s.max));
}

// ═══════════════════════════════════════════════════════════════════
// 3. HOUR BLOCKS (wider buckets for signal)
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("3-HOUR BLOCKS");
console.log("─".repeat(90));
for (let h = 0; h < 24; h += 3) {
  printBucket(`${String(h).padStart(2)}:00-${String(h + 3).padStart(2)}:00 UTC`, trades.filter(t => t.hourUTC >= h && t.hourUTC < h + 3));
}

// ═══════════════════════════════════════════════════════════════════
// 4. BTC 1H RETURN at signal
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("BTC 1H RETURN at signal time");
console.log("─".repeat(90));
const btcRetBuckets = [
  { label: "BTC 1h strong down (<-1%)", test: (t: Trade) => t.btcRet1h < -1 },
  { label: "BTC 1h mild down (-1 to 0%)", test: (t: Trade) => t.btcRet1h >= -1 && t.btcRet1h < 0 },
  { label: "BTC 1h flat (0 to +0.5%)", test: (t: Trade) => t.btcRet1h >= 0 && t.btcRet1h < 0.5 },
  { label: "BTC 1h mild up (+0.5 to +1%)", test: (t: Trade) => t.btcRet1h >= 0.5 && t.btcRet1h < 1 },
  { label: "BTC 1h strong up (>+1%)", test: (t: Trade) => t.btcRet1h >= 1 },
];
for (const b of btcRetBuckets) printBucket(b.label, trades.filter(b.test));

// ═══════════════════════════════════════════════════════════════════
// 5. BTC 12H MOMENTUM
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("BTC 12H MOMENTUM");
console.log("─".repeat(90));
const btcMomBuckets = [
  { label: "BTC 12h strong down (<-3%)", test: (t: Trade) => t.btcRet12h < -3 },
  { label: "BTC 12h mild down (-3 to -1%)", test: (t: Trade) => t.btcRet12h >= -3 && t.btcRet12h < -1 },
  { label: "BTC 12h flat (-1 to +1%)", test: (t: Trade) => t.btcRet12h >= -1 && t.btcRet12h < 1 },
  { label: "BTC 12h mild up (+1 to +3%)", test: (t: Trade) => t.btcRet12h >= 1 && t.btcRet12h < 3 },
  { label: "BTC 12h strong up (>+3%)", test: (t: Trade) => t.btcRet12h >= 3 },
];
for (const b of btcMomBuckets) printBucket(b.label, trades.filter(b.test));

// ═══════════════════════════════════════════════════════════════════
// 6. BTC ABOVE/BELOW EMA20 on 4H
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("BTC TREND — 4H EMA20 & 1H EMA50");
console.log("─".repeat(90));
printBucket("BTC above EMA20 4H", trades.filter(t => t.btcAboveEma20_4h));
printBucket("BTC below EMA20 4H", trades.filter(t => !t.btcAboveEma20_4h));
printBucket("BTC above EMA50 1H", trades.filter(t => t.btcAboveEma50_1h));
printBucket("BTC below EMA50 1H", trades.filter(t => !t.btcAboveEma50_1h));

// ═══════════════════════════════════════════════════════════════════
// 7. BTC SUPPORT — distance from 24h low
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("BTC SUPPORT — distance from BTC 24h low");
console.log("─".repeat(90));
const btcSupBuckets = [
  { label: "Near BTC 24h low (<1%)", test: (t: Trade) => t.btcDistFrom24hLow < 1 },
  { label: "Moderate (1-2%)", test: (t: Trade) => t.btcDistFrom24hLow >= 1 && t.btcDistFrom24hLow < 2 },
  { label: "Mid-range (2-4%)", test: (t: Trade) => t.btcDistFrom24hLow >= 2 && t.btcDistFrom24hLow < 4 },
  { label: "Near BTC 24h high (>4%)", test: (t: Trade) => t.btcDistFrom24hLow >= 4 },
];
for (const b of btcSupBuckets) printBucket(b.label, trades.filter(b.test));

// ═══════════════════════════════════════════════════════════════════
// 8. BTC RESISTANCE — distance from 24h high
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("BTC RESISTANCE — distance from BTC 24h high");
console.log("─".repeat(90));
const btcResBuckets = [
  { label: "Near BTC 24h high (>-1%)", test: (t: Trade) => t.btcDistFrom24hHigh > -1 },
  { label: "Moderate (-1 to -2%)", test: (t: Trade) => t.btcDistFrom24hHigh <= -1 && t.btcDistFrom24hHigh > -2 },
  { label: "Below (-2 to -4%)", test: (t: Trade) => t.btcDistFrom24hHigh <= -2 && t.btcDistFrom24hHigh > -4 },
  { label: "Far from high (<-4%)", test: (t: Trade) => t.btcDistFrom24hHigh <= -4 },
];
for (const b of btcResBuckets) printBucket(b.label, trades.filter(b.test));

// ═══════════════════════════════════════════════════════════════════
// 9. COMBINED BLOCK CANDIDATES
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(100)}`);
console.log("COMBINED BLOCK CANDIDATES — applied on top of roc12h>5% block");
console.log("─".repeat(90));

const DISC_END = new Date("2026-01-01").getTime();

const combos: { name: string; block: (t: Trade) => boolean }[] = [
  { name: "baseline (roc12h only)", block: () => false },
  { name: "block 00-06 UTC", block: t => t.hourUTC >= 0 && t.hourUTC < 6 },
  { name: "block 00-03 UTC", block: t => t.hourUTC >= 0 && t.hourUTC < 3 },
  { name: "block 03-06 UTC", block: t => t.hourUTC >= 3 && t.hourUTC < 6 },
  { name: "block 06-09 UTC", block: t => t.hourUTC >= 6 && t.hourUTC < 9 },
  { name: "block 15-18 UTC", block: t => t.hourUTC >= 15 && t.hourUTC < 18 },
  { name: "block BTC 12h >+3%", block: t => t.btcRet12h > 3 },
  { name: "block BTC 12h >+2%", block: t => t.btcRet12h > 2 },
  { name: "block BTC above EMA20 4H", block: t => t.btcAboveEma20_4h },
  { name: "block BTC near 24h high (>-1%)", block: t => t.btcDistFrom24hHigh > -1 },
  { name: "block BTC 1h >+1%", block: t => t.btcRet1h > 1 },
  // Combo filters
  { name: "block worst hours (00-06) + BTC12h>3%", block: t => (t.hourUTC >= 0 && t.hourUTC < 6) || t.btcRet12h > 3 },
  { name: "block BTC12h>3% + BTC near hi", block: t => t.btcRet12h > 3 || t.btcDistFrom24hHigh > -1 },
  { name: "block BTC12h>2% + hrs 00-03", block: t => t.btcRet12h > 2 || (t.hourUTC >= 0 && t.hourUTC < 3) },
];

console.log(`${"Filter".padEnd(42)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"$/t".padEnd(9)} ${"Blk".padEnd(5)} ${"BkL".padEnd(5)} ${"ValN".padEnd(6)} ${"Val$".padEnd(9)} ${"V$/t".padEnd(9)}`);
console.log("─".repeat(120));

for (const c of combos) {
  const passing = trades.filter(t => !c.block(t));
  const blocked = trades.filter(t => c.block(t));
  const blkLoss = blocked.filter(t => t.pnl < 0).length;
  const w = passing.filter(t => t.outcome === "tp").length;
  const l = passing.filter(t => t.outcome === "stop").length;
  const n = passing.length;
  const p = passing.reduce((s, t) => s + t.pnl, 0);
  const wr = n > 0 ? (w / n * 100).toFixed(1) : "0.0";
  const val = passing.filter(t => t.ts >= DISC_END);
  const vp = val.reduce((s, t) => s + t.pnl, 0);
  console.log(
    `${c.name.padEnd(42)} ${String(n).padEnd(5)} ${String(w).padEnd(5)} ${String(l).padEnd(5)} ` +
    `${(wr + "%").padEnd(7)} $${(p >= 0 ? "+" : "") + p.toFixed(0)}`.padEnd(17) +
    ` $${(n > 0 ? (p / n).toFixed(1) : "0")}`.padEnd(10) +
    `${String(blocked.length).padEnd(5)} ${String(blkLoss).padEnd(5)} ` +
    `${String(val.length).padEnd(6)} $${(vp >= 0 ? "+" : "") + vp.toFixed(0)}`.padEnd(15) +
    ` $${(val.length > 0 ? (vp / val.length).toFixed(1) : "0")}`
  );
}
