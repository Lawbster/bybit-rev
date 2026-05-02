import * as fs from "fs";
import * as readline from "readline";

interface Candle { ts: number; o: number; h: number; l: number; c: number; v: number; }

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
    const bucket = Math.floor(c.ts / bucketMs) * bucketMs;
    const e = map.get(bucket);
    if (!e) map.set(bucket, { ts: bucket, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
    else {
      e.h = Math.max(e.h, c.h);
      e.l = Math.min(e.l, c.l);
      e.c = c.c;
      e.v += c.v;
    }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

(async () => {
  const cutoff = Date.UTC(2026, 3, 25);
  const all = await load1m("data/HYPEUSDT_1m.jsonl");
  const c1m = all.filter(c => c.ts >= cutoff);
  const c4h = aggregate(c1m, 4 * 3600_000);

  console.log(`=== fixed 4h buckets (UTC, aligned 00/04/08/12/16/20) ===\n`);
  console.log(`bucket-start          open      high      low       close     move%    range%   maxDD%   maxUp%    vol`);
  for (const c of c4h) {
    const mv = (c.c - c.o) / c.o * 100;
    const rg = (c.h - c.l) / c.l * 100;
    const dd = (c.l - c.o) / c.o * 100;
    const up = (c.h - c.o) / c.o * 100;
    const mvStr = (mv >= 0 ? "+" : "") + mv.toFixed(2);
    console.log(
      `${new Date(c.ts).toISOString().slice(0, 16).padEnd(20)}  ${c.o.toFixed(3).padStart(8)}  ${c.h.toFixed(3).padStart(8)}  ${c.l.toFixed(3).padStart(8)}  ${c.c.toFixed(3).padStart(8)}  ${mvStr.padStart(7)}%  ${rg.toFixed(2).padStart(6)}%  ${dd.toFixed(2).padStart(6)}%  ${("+" + up.toFixed(2)).padStart(7)}%  ${(c.v / 1000).toFixed(0).padStart(6)}k`
    );
  }

  console.log(`\n=== distribution of fixed-4h move% ===`);
  const moves = c4h.map(c => (c.c - c.o) / c.o * 100);
  const bucketsM = { "<-3": 0, "-3..-2": 0, "-2..-1": 0, "-1..0": 0, "0..1": 0, "1..2": 0, "2..3": 0, ">3": 0 };
  for (const m of moves) {
    if (m < -3) bucketsM["<-3"]++;
    else if (m < -2) bucketsM["-3..-2"]++;
    else if (m < -1) bucketsM["-2..-1"]++;
    else if (m < 0) bucketsM["-1..0"]++;
    else if (m < 1) bucketsM["0..1"]++;
    else if (m < 2) bucketsM["1..2"]++;
    else if (m < 3) bucketsM["2..3"]++;
    else bucketsM[">3"]++;
  }
  console.log(`total 4h candles: ${c4h.length}`);
  for (const [k, v] of Object.entries(bucketsM)) console.log(`  ${k.padStart(8)}%: ${v}`);

  console.log(`\n=== distribution of fixed-4h trough drawdown (open→low) ===`);
  const dds = c4h.map(c => (c.l - c.o) / c.o * 100);
  const bucketsD = { "<-4": 0, "-4..-3": 0, "-3..-2": 0, "-2..-1": 0, "-1..0": 0 };
  for (const d of dds) {
    if (d < -4) bucketsD["<-4"]++;
    else if (d < -3) bucketsD["-4..-3"]++;
    else if (d < -2) bucketsD["-3..-2"]++;
    else if (d < -1) bucketsD["-2..-1"]++;
    else bucketsD["-1..0"]++;
  }
  for (const [k, v] of Object.entries(bucketsD)) console.log(`  ${k.padStart(8)}%: ${v}`);

  console.log(`\n=== rolling 4h trough drops sorted (5m step, dedup'd 4h apart) ===`);
  const c5m = aggregate(c1m, 5 * 60_000);
  const drops: any[] = [];
  for (let i = 48; i <= c5m.length; i++) {
    const win = c5m.slice(i - 48, i);
    const startP = win[0].o;
    const endP = win[win.length - 1].c;
    const lowP = Math.min(...win.map(c => c.l));
    drops.push({
      tsEnd: win[win.length - 1].ts + 5 * 60_000,
      tsStart: win[0].ts,
      troughMove: (lowP - startP) / startP * 100,
      closeMove: (endP - startP) / startP * 100,
      startP, endP, lowP,
    });
  }
  const sorted = [...drops].sort((a, b) => a.troughMove - b.troughMove);
  const dedup: any[] = [];
  for (const d of sorted) {
    if (dedup.every(x => Math.abs(x.tsEnd - d.tsEnd) >= 4 * 3600 * 1000)) {
      dedup.push(d);
      if (dedup.length >= 25) break;
    }
  }
  console.log(`window-start         window-end           trough%   close%   open    trough   close`);
  for (const d of dedup) {
    console.log(
      `${new Date(d.tsStart).toISOString().slice(0, 16)}  →  ${new Date(d.tsEnd).toISOString().slice(0, 16)}  ${d.troughMove.toFixed(2).padStart(6)}%  ${d.closeMove.toFixed(2).padStart(6)}%  ${d.startP.toFixed(3).padStart(7)}  ${d.lowP.toFixed(3).padStart(7)}  ${d.endP.toFixed(3).padStart(7)}`
    );
  }
})();
