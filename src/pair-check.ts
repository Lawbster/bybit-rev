import { loadAllXlsx } from "./parse-xlsx";

const a = loadAllXlsx().filter((t) => t.trader === "aristo" && t.symbol === "ETHUSDT");
a.sort((x, y) => x.openedAt.getTime() - y.openedAt.getTime());

console.log(`\n=== ARISTO ETH — Checking for simultaneous L/S pairs ===`);
console.log(`Total ETH trades: ${a.length} (${a.filter((t) => t.side === "Long").length}L / ${a.filter((t) => t.side === "Short").length}S)\n`);

// Find opposite-side trades opened within 30 min
let pairs = 0;
const used = new Set<number>();
const pairList: string[] = [];

for (let i = 0; i < a.length; i++) {
  if (used.has(i)) continue;
  for (let j = i + 1; j < a.length; j++) {
    if (used.has(j)) continue;
    if (a[i].side === a[j].side) continue;
    const diff = Math.abs(a[i].openedAt.getTime() - a[j].openedAt.getTime());
    if (diff < 1800000) {
      pairs++;
      used.add(i);
      used.add(j);
      pairList.push(
        `  ${a[i].openedAt.toISOString().slice(0, 16)} ${a[i].side.padEnd(6)} @${a[i].entryPrice}  ↔  ${a[j].openedAt.toISOString().slice(0, 16)} ${a[j].side.padEnd(6)} @${a[j].entryPrice}  gap: ${Math.round(diff / 60000)}m`
      );
      break;
    }
  }
}

pairList.forEach((l) => console.log(l));
console.log(`\nPaired L/S within 30min: ${pairs} pairs = ${pairs * 2} trades out of ${a.length} (${Math.round((pairs * 2 / a.length) * 100)}% paired)`);
console.log(`Unpaired trades: ${a.length - pairs * 2}`);

// Also check: same entry price on opposite sides (grid levels)
console.log(`\n=== Same entry price on opposite sides ===`);
const longs = a.filter((t) => t.side === "Long");
const shorts = a.filter((t) => t.side === "Short");
let samePrice = 0;
for (const l of longs) {
  for (const s of shorts) {
    if (Math.abs(l.entryPrice - s.entryPrice) / l.entryPrice < 0.002) {
      samePrice++;
    }
  }
}
console.log(`Long/Short pairs within 0.2% of same price: ${samePrice}`);

// Timeline view — show trades chronologically with overlap
console.log(`\n=== Chronological view (last 30 trades) ===`);
const recent = a.slice(-30);
for (const t of recent) {
  const holdH = (t.holdDurationMs / 3600000).toFixed(1);
  const roi = t.pnlPercent > 0 ? `+${t.pnlPercent.toFixed(0)}%` : `${t.pnlPercent.toFixed(0)}%`;
  console.log(
    `  ${t.openedAt.toISOString().slice(0, 16)} → ${t.closedAt.toISOString().slice(0, 16)}  ${t.side.padEnd(6)} @${String(t.entryPrice).padEnd(10)} → @${String(t.exitPrice).padEnd(10)} ${roi.padStart(6)} hold:${holdH}h`
  );
}
