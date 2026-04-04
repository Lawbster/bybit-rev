// analyze-add-trigger.ts
// Measure actual price drop between consecutive rungs within xwave RIVER batches.
// Trades already have entry/exit/openedAt — group by same exit+closedAt to find batches.

import fs from "fs";

interface Trade {
  symbol: string; side: string;
  qty: number; entry: number; exit: number; tpPct: number;
  openedAt: string; closedAt: string; holdMs: number;
  leverage: number; marginMode: string; notional: number;
}

const trades = JSON.parse(fs.readFileSync("bybit-exports/xwave-river-trades.json", "utf-8")) as Trade[];
console.log(`Total trades: ${trades.length}`);

// ── Group into batches: same exit price + same closedAt minute ────
const batchMap = new Map<string, Trade[]>();
for (const t of trades) {
  const minute = t.closedAt.slice(0, 16); // "2026-02-16T19:05"
  const key = `${t.exit.toFixed(4)}_${minute}`;
  if (!batchMap.has(key)) batchMap.set(key, []);
  batchMap.get(key)!.push(t);
}

const batches = [...batchMap.values()].map(rungs => {
  rungs.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
  return rungs;
});

console.log(`Batches: ${batches.length}`);
const multiRung = batches.filter(b => b.length >= 2);
console.log(`Multi-rung batches (≥2 rungs): ${multiRung.length}`);
console.log(`Single-rung batches: ${batches.length - multiRung.length}\n`);

// ── Measure price drop between consecutive rungs ──────────────────
const dropPcts: number[] = [];
const intervalMins: number[] = [];

for (const batch of multiRung) {
  for (let i = 1; i < batch.length; i++) {
    const prev = batch[i - 1];
    const curr = batch[i];
    const drop = (prev.entry - curr.entry) / prev.entry * 100;
    const dtMin = (new Date(curr.openedAt).getTime() - new Date(prev.openedAt).getTime()) / 60000;
    if (drop >= 0 && drop < 20) {
      dropPcts.push(drop);
      intervalMins.push(dtMin);
    }
  }
}

function pct(arr: number[], p: number) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(Math.floor(s.length * p / 100), s.length - 1)];
}
const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

console.log("=== ADD TRIGGER: Price drop from prev rung to next rung ===");
console.log(`Intervals measured: ${dropPcts.length}`);
console.log(`  min:  ${Math.min(...dropPcts).toFixed(3)}%`);
console.log(`  p10:  ${pct(dropPcts, 10).toFixed(3)}%`);
console.log(`  p25:  ${pct(dropPcts, 25).toFixed(3)}%`);
console.log(`  p50:  ${pct(dropPcts, 50).toFixed(3)}%`);
console.log(`  p75:  ${pct(dropPcts, 75).toFixed(3)}%`);
console.log(`  p90:  ${pct(dropPcts, 90).toFixed(3)}%`);
console.log(`  p99:  ${pct(dropPcts, 99).toFixed(3)}%`);
console.log(`  max:  ${Math.max(...dropPcts).toFixed(3)}%`);
console.log(`  mean: ${mean(dropPcts).toFixed(3)}%\n`);

// Histogram
const buckets = [
  ["0.0–0.1%", (d: number) => d < 0.1],
  ["0.1–0.3%", (d: number) => d < 0.3],
  ["0.3–0.5%", (d: number) => d < 0.5],
  ["0.5–0.7%", (d: number) => d < 0.7],
  ["0.7–1.0%", (d: number) => d < 1.0],
  ["1.0–1.5%", (d: number) => d < 1.5],
  ["1.5–2.0%", (d: number) => d < 2.0],
  ["2.0%+",    (_: number) => true],
] as [string, (d: number) => boolean][];

console.log("Drop distribution:");
let remaining = [...dropPcts];
for (const [label, fn] of buckets) {
  const count = remaining.filter(fn).length;
  remaining = remaining.filter(d => !fn(d));
  const p = (count / dropPcts.length * 100).toFixed(1);
  const bar = "█".repeat(Math.round(count / dropPcts.length * 50));
  console.log(`  ${label.padEnd(10)} ${String(count).padStart(5)} (${p.padStart(5)}%)  ${bar}`);
}

console.log(`\n=== TIME between consecutive rungs ===`);
console.log(`  p25:  ${pct(intervalMins, 25).toFixed(1)} min`);
console.log(`  p50:  ${pct(intervalMins, 50).toFixed(1)} min`);
console.log(`  p75:  ${pct(intervalMins, 75).toFixed(1)} min`);
console.log(`  p90:  ${pct(intervalMins, 90).toFixed(1)} min`);
console.log(`  mean: ${mean(intervalMins).toFixed(1)} min`);
const sub1 = intervalMins.filter(m => m < 1).length;
console.log(`  Same-minute adds (<1 min): ${sub1} (${(sub1/intervalMins.length*100).toFixed(1)}%)`);

// ── Rung depth distribution ───────────────────────────────────────
console.log(`\n=== Batch depth (rungs per batch) ===`);
const depthBuckets: Record<string, number> = {};
for (const b of batches) {
  const k = String(b.length);
  depthBuckets[k] = (depthBuckets[k] ?? 0) + 1;
}
const maxDepth = Math.max(...Object.keys(depthBuckets).map(Number));
for (let i = 1; i <= Math.min(maxDepth, 15); i++) {
  const c = depthBuckets[String(i)] ?? 0;
  const p = (c / batches.length * 100).toFixed(1);
  const bar = "█".repeat(Math.round(c / batches.length * 40));
  console.log(`  ${String(i).padStart(2)} rungs: ${String(c).padStart(5)} (${p.padStart(5)}%)  ${bar}`);
}
if (maxDepth > 15) console.log(`  ... up to ${maxDepth} rungs`);

// ── Example deep batches ─────────────────────────────────────────
console.log(`\n=== Example deep batches (≥5 rungs) ===`);
const deep = batches.filter(b => b.length >= 5).slice(0, 4);
for (const b of deep) {
  console.log(`\n${b.length}-rung batch | exit=$${b[0].exit.toFixed(4)} | closed ${b[0].closedAt.slice(0,16)}`);
  for (let i = 0; i < b.length; i++) {
    const r = b[i];
    const drop = i === 0 ? "      " : `↓${((b[i-1].entry - r.entry)/b[i-1].entry*100).toFixed(3)}%`;
    const dt   = i === 0 ? "" : `+${((new Date(r.openedAt).getTime()-new Date(b[i-1].openedAt).getTime())/60000).toFixed(1)}min`;
    console.log(`  [${i+1}] entry=$${r.entry.toFixed(4)}  notional=$${r.notional.toFixed(2).padStart(8)}  ${drop}  ${dt}  opened ${r.openedAt.slice(11,19)}`);
  }
}
