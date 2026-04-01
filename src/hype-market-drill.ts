import fs from "fs";

const snaps = fs.readFileSync("data/HYPEUSDT_market.jsonl", "utf-8").trim().split("\n").map(l => JSON.parse(l));

console.log(`HYPE market.jsonl: ${snaps.length} snaps`);
console.log(`Range: ${snaps[0].ts.slice(0, 16)} → ${snaps[snaps.length - 1].ts.slice(0, 16)}`);
console.log(`Price: $${snaps[0].price} → $${snaps[snaps.length - 1].price} (${(((snaps[snaps.length - 1].price - snaps[0].price) / snaps[0].price) * 100).toFixed(1)}%)`);
console.log(`OI: ${(snaps[0].openInterest / 1e6).toFixed(2)}M → ${(snaps[snaps.length - 1].openInterest / 1e6).toFixed(2)}M (${(((snaps[snaps.length - 1].openInterest - snaps[0].openInterest) / snaps[0].openInterest) * 100).toFixed(1)}%)`);

// Build hourly chunks
interface HourChunk {
  h: string;
  open: number; close: number; pct: number;
  oiStart: number; oiEnd: number; oiPct: number;
  buyVol: number; sellVol: number; sellRatio: number;
  avgImbal: number; fundRate: number;
  thinSide: string;
}

const chunks: HourChunk[] = [];
let curH = "", hBuy = 0, hSell = 0, hImb = 0, hN = 0, hOpen = 0, oiStart = 0;

for (let i = 0; i < snaps.length; i++) {
  const s = snaps[i];
  const h = s.ts.slice(0, 13);
  if (h !== curH) {
    if (curH && hN > 0) {
      const prev = snaps[i - 1];
      const oiPct = ((prev.openInterest - oiStart) / oiStart) * 100;
      chunks.push({
        h: curH, open: hOpen, close: prev.price,
        pct: ((prev.price - hOpen) / hOpen) * 100,
        oiStart, oiEnd: prev.openInterest, oiPct,
        buyVol: hBuy, sellVol: hSell,
        sellRatio: hBuy > 0 ? hSell / hBuy : 0,
        avgImbal: hImb / hN, fundRate: prev.fundingRate,
        thinSide: prev.ob.thinSide,
      });
    }
    curH = h; hBuy = 0; hSell = 0; hImb = 0; hN = 0;
    hOpen = s.price; oiStart = s.openInterest;
  }
  hBuy += s.flow.buyVol;
  hSell += s.flow.sellVol;
  hImb += s.ob.imbalance;
  hN++;
}
if (hN > 0) {
  const last = snaps[snaps.length - 1];
  const oiPct = ((last.openInterest - oiStart) / oiStart) * 100;
  chunks.push({
    h: curH, open: hOpen, close: last.price,
    pct: ((last.price - hOpen) / hOpen) * 100,
    oiStart, oiEnd: last.openInterest, oiPct,
    buyVol: hBuy, sellVol: hSell,
    sellRatio: hBuy > 0 ? hSell / hBuy : 0,
    avgImbal: hImb / hN, fundRate: last.fundingRate,
    thinSide: last.ob.thinSide,
  });
}

// Full hourly timeline
console.log(`\nHourly timeline:`);
console.log(`  ${"Hour".padEnd(12)} ${"Price".padStart(9)} ${"Chg%".padStart(7)} ${"OI(M)".padStart(8)} ${"OI∆%".padStart(6)} ${"Fund%".padStart(8)} ${"BuyVol".padStart(9)} ${"SellVol".padStart(9)} ${"S/B".padStart(5)} ${"Imbal".padStart(6)} ${"Thin".padStart(9)}`);
console.log(`  ${"-".repeat(100)}`);

for (const c of chunks) {
  console.log(`  ${c.h.slice(5, 13).padEnd(12)} ${"$" + c.close.toFixed(2)}${" ".repeat(Math.max(0, 9 - ("$" + c.close.toFixed(2)).length))} ${(c.pct >= 0 ? "+" : "") + c.pct.toFixed(2) + "%"}${" ".repeat(Math.max(0, 5 - c.pct.toFixed(2).length))} ${(c.oiEnd / 1e6).toFixed(2).padStart(8)} ${(c.oiPct >= 0 ? "+" : "") + c.oiPct.toFixed(1) + "%"}${" ".repeat(Math.max(0, 4 - c.oiPct.toFixed(1).length))} ${(c.fundRate * 100).toFixed(3).padStart(7)}% ${c.buyVol.toFixed(0).padStart(9)} ${c.sellVol.toFixed(0).padStart(9)} ${c.sellRatio.toFixed(1).padStart(5)} ${c.avgImbal.toFixed(2).padStart(6)} ${c.thinSide.padStart(9)}`);
}

// Top selloff hours
console.log(`\nTop 10 selloff hours (by price drop):`);
const sorted = [...chunks].sort((a, b) => a.pct - b.pct);
console.log(`  ${"Hour".padEnd(12)} ${"Price∆".padStart(7)} ${"OI∆".padStart(6)} ${"S/B".padStart(5)} ${"Imbal".padStart(6)} ${"Fund%".padStart(8)} ${"Thin".padStart(9)}  Signal?`);
console.log(`  ${"-".repeat(70)}`);
for (const c of sorted.slice(0, 10)) {
  // Would our signals have fired?
  const flowDom = c.sellRatio >= 1.5;
  const bookPress = c.avgImbal < -0.10 || c.thinSide === "bid";
  const oiNotWash = c.oiPct >= -0.5;
  const signal = flowDom && bookPress && oiNotWash ? "YES" : `${flowDom ? "F" : "-"}${bookPress ? "B" : "-"}${oiNotWash ? "O" : "-"}`;
  console.log(`  ${c.h.slice(5, 13).padEnd(12)} ${(c.pct.toFixed(2) + "%").padStart(7)} ${(c.oiPct.toFixed(1) + "%").padStart(6)} ${c.sellRatio.toFixed(1).padStart(5)} ${c.avgImbal.toFixed(2).padStart(6)} ${(c.fundRate * 100).toFixed(3).padStart(7)}% ${c.thinSide.padStart(9)}  ${signal}`);
}

// Top rally hours
console.log(`\nTop 10 rally hours (by price rise):`);
const sortedUp = [...chunks].sort((a, b) => b.pct - a.pct);
console.log(`  ${"Hour".padEnd(12)} ${"Price∆".padStart(7)} ${"OI∆".padStart(6)} ${"S/B".padStart(5)} ${"Imbal".padStart(6)} ${"Fund%".padStart(8)} ${"Thin".padStart(9)}`);
console.log(`  ${"-".repeat(60)}`);
for (const c of sortedUp.slice(0, 10)) {
  console.log(`  ${c.h.slice(5, 13).padEnd(12)} ${("+" + c.pct.toFixed(2) + "%").padStart(7)} ${(c.oiPct.toFixed(1) + "%").padStart(6)} ${c.sellRatio.toFixed(1).padStart(5)} ${c.avgImbal.toFixed(2).padStart(6)} ${(c.fundRate * 100).toFixed(3).padStart(7)}% ${c.thinSide.padStart(9)}`);
}

// OI vs Price correlation
console.log(`\nOI vs Price direction (hourly):`);
let upUp = 0, upDn = 0, dnUp = 0, dnDn = 0;
for (const c of chunks) {
  if (Math.abs(c.pct) < 0.05 || Math.abs(c.oiPct) < 0.05) continue;
  if (c.pct > 0 && c.oiPct > 0) upUp++;
  else if (c.pct > 0 && c.oiPct < 0) upDn++;
  else if (c.pct < 0 && c.oiPct > 0) dnUp++;
  else dnDn++;
}
console.log(`  Price↑ OI↑: ${upUp}  |  Price↑ OI↓: ${upDn}`);
console.log(`  Price↓ OI↑: ${dnUp}  |  Price↓ OI↓: ${dnDn}`);
