// analyze-pf0-hype-deep.ts — HYPE PF0: TP/SL sweep + roc12h + BTC context
// Same methodology as SUI analysis

import fs from "fs";

interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number; }

const bars5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
bars5m.sort((a, b) => a.timestamp - b.timestamp);

const btc5m: Candle[] = JSON.parse(fs.readFileSync("data/BTCUSDT_5_full.json", "utf-8"));
btc5m.sort((a, b) => a.timestamp - b.timestamp);

function agg(bars: Candle[], min: number): Candle[] {
  const ms = min * 60000, m = new Map<number, Candle>();
  for (const c of bars) {
    const k = Math.floor(c.timestamp / ms) * ms, e = m.get(k);
    if (!e) m.set(k, { ...c, timestamp: k });
    else { e.high = Math.max(e.high, c.high); e.low = Math.min(e.low, c.low); e.close = c.close; e.volume += c.volume; e.turnover += c.turnover; }
  }
  return [...m.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function bsearch(arr: number[], t: number): number {
  let lo = 0, hi = arr.length - 1, r = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; }
  return r;
}

// Use 5m for path sim (no 1m data for HYPE in vps folder)
const bars1h = agg(bars5m, 60);
const ts5m = bars5m.map(b => b.timestamp);
const ts1h = bars1h.map(b => b.timestamp);
const closes1h = bars1h.map(b => b.close);

const btc1h = agg(btc5m, 60);
const tsBtc1h = btc1h.map(b => b.timestamp);
const btcCloses1h = btc1h.map(b => b.close);

console.log(`HYPE 5m: ${bars5m.length} candles | 1h: ${bars1h.length} bars`);
console.log(`Range: ${new Date(bars5m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(bars5m[bars5m.length - 1].timestamp).toISOString().slice(0, 10)}\n`);

// ── Signals ──
interface Sig { ts: number; price: number; barIdx: number; }
const signals: Sig[] = [];
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
  signals.push({ ts: bars1h[i].timestamp, price: bars1h[i].close, barIdx: i });
  lastSigTs = bars1h[i].timestamp;
}
console.log(`PF0 signals: ${signals.length}\n`);

const FEE = 0.0011;
const MAX_HOLD_5M = 144; // 12h in 5m bars
const DISC_END = new Date("2026-01-01").getTime();

function simTrade(sig: Sig, notional: number, tpPct: number, slPct: number): { pnl: number; outcome: string; exitTs: number; exitPrice: number } | null {
  // Entry: first 5m bar after signal hour closes
  const entryIdx = bsearch(ts5m, sig.ts + 3600000);
  if (entryIdx < 0 || entryIdx >= bars5m.length - 10) return null;
  const ep = sig.price;
  const tp = ep * (1 - tpPct / 100);
  const sl = ep * (1 + slPct / 100);
  const maxIdx = Math.min(entryIdx + MAX_HOLD_5M, bars5m.length - 1);

  for (let j = entryIdx + 1; j <= maxIdx; j++) {
    if (bars5m[j].high >= sl) return { pnl: -slPct / 100 * notional - notional * FEE, outcome: "stop", exitTs: bars5m[j].timestamp, exitPrice: sl };
    if (bars5m[j].low <= tp) return { pnl: tpPct / 100 * notional - notional * FEE, outcome: "tp", exitTs: bars5m[j].timestamp, exitPrice: tp };
  }
  const exitPrice = bars5m[maxIdx].close;
  const pnl = ((ep - exitPrice) / ep) * notional - notional * FEE;
  return { pnl, outcome: "flat", exitTs: bars5m[maxIdx].timestamp, exitPrice };
}

// ═══════════════════════════════════════════════════════════════════
// PART 1: TP/SL SWEEP
// ═══════════════════════════════════════════════════════════════════
console.log("═".repeat(120));
console.log("PART 1: TP/SL SWEEP — $5k notional");
console.log("─".repeat(120));

const combos = [
  { tp: 1.0, sl: 2.0 },
  { tp: 1.5, sl: 2.0 },
  { tp: 1.5, sl: 3.0 },
  { tp: 2.0, sl: 3.0 },
  { tp: 2.0, sl: 4.0 },
  { tp: 2.5, sl: 3.0 },
  { tp: 2.5, sl: 4.0 },
  { tp: 3.0, sl: 5.0 },
];

const NOTIONAL = 5000;
const fmt = (v: number) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`;

console.log(`${"TP/SL".padEnd(10)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"F".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"$/t".padEnd(9)} ${"DiscN".padEnd(6)} ${"Disc$".padEnd(10)} ${"D$/t".padEnd(9)} ${"ValN".padEnd(6)} ${"Val$".padEnd(10)} ${"V$/t".padEnd(9)}`);
console.log("─".repeat(120));

for (const combo of combos) {
  let w = 0, l = 0, f = 0, pnl = 0;
  let discN = 0, discPnl = 0, valN = 0, valPnl = 0;
  for (const sig of signals) {
    const r = simTrade(sig, NOTIONAL, combo.tp, combo.sl);
    if (!r) continue;
    pnl += r.pnl;
    if (r.outcome === "tp") w++; else if (r.outcome === "stop") l++; else f++;
    if (sig.ts < DISC_END) { discPnl += r.pnl; discN++; } else { valPnl += r.pnl; valN++; }
  }
  const n = w + l + f;
  const wr = n > 0 ? (w / n * 100).toFixed(1) : "0.0";
  console.log(
    `${combo.tp}/${combo.sl}`.padEnd(10) +
    `${n}`.padEnd(5) + `${w}`.padEnd(5) + `${l}`.padEnd(5) + `${f}`.padEnd(5) +
    `${wr}%`.padEnd(7) + fmt(pnl).padEnd(10) + `$${(n > 0 ? (pnl / n).toFixed(1) : "0")}`.padEnd(9) +
    `${discN}`.padEnd(6) + fmt(discPnl).padEnd(10) + `$${(discN > 0 ? (discPnl / discN).toFixed(1) : "0")}`.padEnd(9) +
    `${valN}`.padEnd(6) + fmt(valPnl).padEnd(10) + `$${(valN > 0 ? (valPnl / valN).toFixed(1) : "0")}`.padEnd(9)
  );
}

// ═══════════════════════════════════════════════════════════════════
// PART 2: ROC12H BLOCK on best combos
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(120)}`);
console.log("PART 2: ROC12H BLOCK — best TP/SL combos, $5k notional");
console.log("─".repeat(120));

const bestCombos = [
  { tp: 1.0, sl: 2.0 },
  { tp: 1.5, sl: 3.0 },
  { tp: 2.0, sl: 3.0 },
  { tp: 2.5, sl: 3.0 },
  { tp: 2.5, sl: 4.0 },
];

const rocThresholds = [0, 3, 5, 7, 10];

for (const combo of bestCombos) {
  console.log(`\n  TP=${combo.tp}% / SL=${combo.sl}%`);
  console.log(`  ${"roc12h block".padEnd(18)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"$/t".padEnd(9)} ${"Blk".padEnd(5)} ${"BkL".padEnd(5)} ${"ValN".padEnd(6)} ${"Val$".padEnd(9)} ${"V$/t".padEnd(9)}`);
  console.log("  " + "─".repeat(105));

  for (const threshold of rocThresholds) {
    let w = 0, l = 0, f = 0, pnl = 0, blocked = 0, blkLoss = 0;
    let valN = 0, valPnl = 0;
    for (const sig of signals) {
      const r = simTrade(sig, NOTIONAL, combo.tp, combo.sl);
      if (!r) continue;

      if (threshold > 0 && sig.barIdx >= 12) {
        const roc = ((closes1h[sig.barIdx] - closes1h[sig.barIdx - 12]) / closes1h[sig.barIdx - 12]) * 100;
        if (roc > threshold) { blocked++; if (r.pnl < 0) blkLoss++; continue; }
      }

      pnl += r.pnl;
      if (r.outcome === "tp") w++; else if (r.outcome === "stop") l++; else f++;
      if (sig.ts >= DISC_END) { valPnl += r.pnl; valN++; }
    }
    const n = w + l + f;
    const wr = n > 0 ? (w / n * 100).toFixed(1) : "0.0";
    const label = threshold === 0 ? "none" : `> ${threshold}%`;
    console.log(`  ${label.padEnd(18)} ${String(n).padEnd(5)} ${String(w).padEnd(5)} ${String(l).padEnd(5)} ${(wr + "%").padEnd(7)} ${fmt(pnl).padEnd(10)} $${(n > 0 ? (pnl / n).toFixed(1) : "0")}`.padEnd(70) + ` ${String(blocked).padEnd(5)} ${String(blkLoss).padEnd(5)} ${String(valN).padEnd(6)} ${fmt(valPnl).padEnd(9)} $${(valN > 0 ? (valPnl / valN).toFixed(1) : "0")}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PART 3: BTC CONTEXT + TIMING on best combo
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(120)}`);
console.log("PART 3: BTC CONTEXT + TIMING — best TP/SL combo");
console.log("─".repeat(120));

// Find best combo from part 1 (by validation $/trade)
// We'll test the top 2-3

const testCombos = [
  { tp: 2.0, sl: 3.0, label: "2.0/3.0" },
  { tp: 2.5, sl: 3.0, label: "2.5/3.0" },
];

for (const combo of testCombos) {
  console.log(`\n  ═══ TP=${combo.tp}% / SL=${combo.sl}% ═══`);

  // Compute all trades with context
  interface HypeTrade { sig: Sig; pnl: number; outcome: string; hourUTC: number; btcRet1h: number; btcRet12h: number; roc12h: number; }
  const trades: HypeTrade[] = [];

  for (const sig of signals) {
    const r = simTrade(sig, NOTIONAL, combo.tp, combo.sl);
    if (!r) continue;
    const hourUTC = new Date(sig.ts).getUTCHours();
    const btcI = bsearch(tsBtc1h, sig.ts);
    let btcRet1h = 0, btcRet12h = 0;
    if (btcI >= 12) {
      btcRet1h = ((btcCloses1h[btcI - 1] - btcCloses1h[btcI - 2]) / btcCloses1h[btcI - 2]) * 100;
      btcRet12h = ((btcCloses1h[btcI] - btcCloses1h[btcI - 12]) / btcCloses1h[btcI - 12]) * 100;
    }
    const roc12h = sig.barIdx >= 12 ? ((closes1h[sig.barIdx] - closes1h[sig.barIdx - 12]) / closes1h[sig.barIdx - 12]) * 100 : 0;
    trades.push({ sig, pnl: r.pnl, outcome: r.outcome, hourUTC, btcRet1h, btcRet12h, roc12h });
  }

  function printBucket(label: string, bucket: HypeTrade[]) {
    if (bucket.length === 0) return;
    const w = bucket.filter(t => t.outcome === "tp").length;
    const l = bucket.filter(t => t.outcome === "stop").length;
    const p = bucket.reduce((s, t) => s + t.pnl, 0);
    const val = bucket.filter(t => t.sig.ts >= DISC_END);
    const vp = val.reduce((s, t) => s + t.pnl, 0);
    console.log(`    ${label.padEnd(35)} N=${String(bucket.length).padEnd(4)} W=${String(w).padEnd(3)} L=${String(l).padEnd(3)} WR=${(w / bucket.length * 100).toFixed(0).padStart(3)}%  $${(p >= 0 ? "+" : "") + p.toFixed(0).padStart(6)}  $/t=$${(p / bucket.length).toFixed(1).padStart(6)}  Val:${val.length} $${(vp >= 0 ? "+" : "") + vp.toFixed(0)}`);
  }

  // Sessions
  console.log("\n  SESSIONS:");
  printBucket("Asia (00-08 UTC)", trades.filter(t => t.hourUTC >= 0 && t.hourUTC < 8));
  printBucket("Europe (08-14 UTC)", trades.filter(t => t.hourUTC >= 8 && t.hourUTC < 14));
  printBucket("US (14-20 UTC)", trades.filter(t => t.hourUTC >= 14 && t.hourUTC < 20));
  printBucket("Late US (20-24 UTC)", trades.filter(t => t.hourUTC >= 20 && t.hourUTC < 24));

  // 3h blocks
  console.log("\n  3-HOUR BLOCKS:");
  for (let h = 0; h < 24; h += 3) {
    printBucket(`${String(h).padStart(2)}:00-${String(h + 3).padStart(2)}:00 UTC`, trades.filter(t => t.hourUTC >= h && t.hourUTC < h + 3));
  }

  // BTC 1H return
  console.log("\n  BTC 1H RETURN:");
  printBucket("BTC strong down (<-1%)", trades.filter(t => t.btcRet1h < -1));
  printBucket("BTC mild down (-1 to 0%)", trades.filter(t => t.btcRet1h >= -1 && t.btcRet1h < 0));
  printBucket("BTC flat (0 to +0.5%)", trades.filter(t => t.btcRet1h >= 0 && t.btcRet1h < 0.5));
  printBucket("BTC up (>+0.5%)", trades.filter(t => t.btcRet1h >= 0.5));

  // BTC 12H momentum
  console.log("\n  BTC 12H MOMENTUM:");
  printBucket("BTC 12h strong down (<-3%)", trades.filter(t => t.btcRet12h < -3));
  printBucket("BTC 12h mild down (-3 to -1%)", trades.filter(t => t.btcRet12h >= -3 && t.btcRet12h < -1));
  printBucket("BTC 12h flat (-1 to +1%)", trades.filter(t => t.btcRet12h >= -1 && t.btcRet12h < 1));
  printBucket("BTC 12h mild up (+1 to +3%)", trades.filter(t => t.btcRet12h >= 1 && t.btcRet12h < 3));
  printBucket("BTC 12h strong up (>+3%)", trades.filter(t => t.btcRet12h >= 3));

  // HYPE roc12h
  console.log("\n  HYPE ROC12H:");
  printBucket("roc12h < -5%", trades.filter(t => t.roc12h < -5));
  printBucket("roc12h -5 to 0%", trades.filter(t => t.roc12h >= -5 && t.roc12h < 0));
  printBucket("roc12h 0 to 5%", trades.filter(t => t.roc12h >= 0 && t.roc12h < 5));
  printBucket("roc12h 5 to 10%", trades.filter(t => t.roc12h >= 5 && t.roc12h < 10));
  printBucket("roc12h > 10%", trades.filter(t => t.roc12h >= 10));

  // Combined block candidates
  console.log("\n  COMBINED BLOCK CANDIDATES:");
  const blockFilters: { name: string; block: (t: HypeTrade) => boolean }[] = [
    { name: "baseline", block: () => false },
    { name: "block roc12h>5%", block: t => t.roc12h > 5 },
    { name: "block roc12h>7%", block: t => t.roc12h > 7 },
    { name: "block roc12h>10%", block: t => t.roc12h > 10 },
    { name: "block BTC12h>3%", block: t => t.btcRet12h > 3 },
    { name: "block roc12h>5% + BTC12h<-3%", block: t => t.roc12h > 5 || t.btcRet12h < -3 },
    { name: "block roc12h>5% + 15-18 UTC", block: t => t.roc12h > 5 || (t.hourUTC >= 15 && t.hourUTC < 18) },
    { name: "block roc12h>7% + BTC12h<-3%", block: t => t.roc12h > 7 || t.btcRet12h < -3 },
  ];

  console.log(`    ${"Filter".padEnd(38)} ${"N".padEnd(5)} ${"W".padEnd(5)} ${"L".padEnd(5)} ${"WR%".padEnd(7)} ${"Total$".padEnd(10)} ${"$/t".padEnd(9)} ${"Blk".padEnd(5)} ${"BkL".padEnd(5)} ${"ValN".padEnd(6)} ${"Val$".padEnd(9)}`);
  console.log("    " + "─".repeat(105));

  for (const bf of blockFilters) {
    const passing = trades.filter(t => !bf.block(t));
    const blocked = trades.filter(t => bf.block(t));
    const blkLoss = blocked.filter(t => t.pnl < 0).length;
    const w = passing.filter(t => t.outcome === "tp").length;
    const l = passing.filter(t => t.outcome === "stop").length;
    const n = passing.length;
    const p = passing.reduce((s, t) => s + t.pnl, 0);
    const wr = n > 0 ? (w / n * 100).toFixed(1) : "0.0";
    const val = passing.filter(t => t.sig.ts >= DISC_END);
    const vp = val.reduce((s, t) => s + t.pnl, 0);
    console.log(
      `    ${bf.name.padEnd(38)} ${String(n).padEnd(5)} ${String(w).padEnd(5)} ${String(l).padEnd(5)} ${(wr + "%").padEnd(7)} ${fmt(p).padEnd(10)} $${(n > 0 ? (p / n).toFixed(1) : "0")}`.padEnd(80) +
      ` ${String(blocked.length).padEnd(5)} ${String(blkLoss).padEnd(5)} ${String(val.length).padEnd(6)} ${fmt(vp)}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// PART 4: Monthly breakdown for best filtered setup
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(120)}`);
console.log("PART 4: MONTHLY — best setups at $10k notional");
console.log("─".repeat(120));

const finalTests = [
  { tp: 2.0, sl: 3.0, roc: 5, label: "2.0/3.0 roc12h>5% block" },
  { tp: 2.5, sl: 3.0, roc: 5, label: "2.5/3.0 roc12h>5% block" },
  { tp: 2.0, sl: 3.0, roc: 0, label: "2.0/3.0 no filter" },
];

const FINAL_NOT = 10000;

for (const test of finalTests) {
  console.log(`\n  ═══ ${test.label} — $${FINAL_NOT} notional ═══`);
  let totalW = 0, totalL = 0, totalF = 0, totalPnl = 0;
  const monthly = new Map<string, { n: number; w: number; l: number; f: number; pnl: number }>();

  for (const sig of signals) {
    // roc12h block
    if (test.roc > 0 && sig.barIdx >= 12) {
      const roc = ((closes1h[sig.barIdx] - closes1h[sig.barIdx - 12]) / closes1h[sig.barIdx - 12]) * 100;
      if (roc > test.roc) continue;
    }
    const r = simTrade(sig, FINAL_NOT, test.tp, test.sl);
    if (!r) continue;
    totalPnl += r.pnl;
    if (r.outcome === "tp") totalW++; else if (r.outcome === "stop") totalL++; else totalF++;

    const mo = new Date(sig.ts).toISOString().slice(0, 7);
    if (!monthly.has(mo)) monthly.set(mo, { n: 0, w: 0, l: 0, f: 0, pnl: 0 });
    const m = monthly.get(mo)!;
    m.n++; m.pnl += r.pnl;
    if (r.outcome === "tp") m.w++; else if (r.outcome === "stop") m.l++; else m.f++;
  }

  const n = totalW + totalL + totalF;
  console.log(`  Trades: ${n} | W: ${totalW} | L: ${totalL} | F: ${totalF} | WR: ${(totalW / n * 100).toFixed(1)}% | PnL: ${fmt(totalPnl)} | $/t: $${(totalPnl / n).toFixed(1)}\n`);
  console.log(`  ${"Month".padEnd(9)} ${"N".padEnd(5)} ${"W".padEnd(4)} ${"L".padEnd(4)} ${"F".padEnd(4)} ${"WR%".padEnd(7)} ${"PnL".padEnd(12)} Split`);
  console.log("  " + "─".repeat(60));

  for (const [mo, m] of [...monthly.entries()].sort()) {
    const mwr = m.n > 0 ? (m.w / m.n * 100).toFixed(0) : "0";
    const split = new Date(mo + "-01").getTime() < DISC_END ? "disc" : "val";
    console.log(`  ${mo}   ${String(m.n).padEnd(5)} ${String(m.w).padEnd(4)} ${String(m.l).padEnd(4)} ${String(m.f).padEnd(4)} ${(mwr + "%").padEnd(7)} $${(m.pnl >= 0 ? "+" : "") + m.pnl.toFixed(0).padStart(6)}     ${split}`);
  }
}
