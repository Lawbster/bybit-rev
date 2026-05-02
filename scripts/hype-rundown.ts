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
    if (!e) {
      map.set(bucket, { ts: bucket, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v });
    } else {
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
  const c5m = aggregate(c1m, 5 * 60_000);
  const c1h = aggregate(c1m, 3600_000);

  console.log(`1m candles from ${new Date(c1m[0].ts).toISOString()} → ${new Date(c1m[c1m.length - 1].ts).toISOString()}`);
  console.log(`1m: ${c1m.length}  5m: ${c5m.length}  1h: ${c1h.length}`);

  const start = c1m[0].o;
  const end = c1m[c1m.length - 1].c;
  const high = Math.max(...c1m.map(c => c.h));
  const low = Math.min(...c1m.map(c => c.l));
  const highTs = c1m.find(c => c.h === high)!.ts;
  const lowTs = c1m.find(c => c.l === low)!.ts;
  console.log(`\nperiod open:  $${start.toFixed(4)}`);
  console.log(`period close: $${end.toFixed(4)}`);
  console.log(`net:          ${((end - start) / start * 100).toFixed(2)}%`);
  console.log(`period high:  $${high.toFixed(4)}  @ ${new Date(highTs).toISOString()}`);
  console.log(`period low:   $${low.toFixed(4)}  @ ${new Date(lowTs).toISOString()}`);
  console.log(`high-low:     ${((high - low) / low * 100).toFixed(2)}%`);

  console.log(`\n=== daily summary (UTC) ===`);
  console.log(`date         open      high      low       close     range%   day%      vol`);
  const dayMap = new Map<string, Candle[]>();
  for (const c of c1m) {
    const d = new Date(c.ts).toISOString().slice(0, 10);
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d)!.push(c);
  }
  for (const [day, cs] of [...dayMap.entries()].sort()) {
    const o = cs[0].o, cl = cs[cs.length - 1].c;
    const h = Math.max(...cs.map(c => c.h));
    const l = Math.min(...cs.map(c => c.l));
    const v = cs.reduce((s, c) => s + c.v, 0);
    console.log(
      `${day}  ${o.toFixed(3).padStart(8)}  ${h.toFixed(3).padStart(8)}  ${l.toFixed(3).padStart(8)}  ${cl.toFixed(3).padStart(8)}  ${((h - l) / l * 100).toFixed(2).padStart(6)}%  ${(((cl - o) / o * 100) >= 0 ? "+" : "") + ((cl - o) / o * 100).toFixed(2).padStart(6)}%  ${(v / 1000).toFixed(0).padStart(8)}k`
    );
  }

  console.log(`\n=== top 12 single 5m candle drops ===`);
  const drops5 = c5m.map(c => ({ ts: c.ts, pct: (c.c - c.o) / c.o * 100, o: c.o, c: c.c })).filter(d => d.pct < -0.5).sort((a, b) => a.pct - b.pct).slice(0, 12);
  for (const d of drops5) {
    console.log(`${new Date(d.ts).toISOString().slice(0, 19)}  ${d.pct.toFixed(2)}%  $${d.o.toFixed(3)} → $${d.c.toFixed(3)}`);
  }

  console.log(`\n=== top 15 30-min trough drops (rolling 6× 5m, dedup'd 30min) ===`);
  const drops30: any[] = [];
  for (let i = 6; i <= c5m.length; i++) {
    const win = c5m.slice(i - 6, i);
    const startP = win[0].o;
    const endP = win[win.length - 1].c;
    const lowP = Math.min(...win.map(c => c.l));
    drops30.push({ ts: win[win.length - 1].ts, troughMove: (lowP - startP) / startP * 100, closeMove: (endP - startP) / startP * 100, startP, endP, lowP });
  }
  const sorted30 = [...drops30].sort((a, b) => a.troughMove - b.troughMove);
  const dedup30: any[] = [];
  for (const d of sorted30) {
    if (dedup30.every(x => Math.abs(x.ts - d.ts) >= 30 * 60 * 1000)) {
      dedup30.push(d);
      if (dedup30.length >= 15) break;
    }
  }
  for (const d of dedup30) {
    console.log(`${new Date(d.ts).toISOString().slice(0, 19)}  trough ${d.troughMove.toFixed(2)}%  close ${d.closeMove.toFixed(2)}%  $${d.startP.toFixed(3)} → ${d.lowP.toFixed(3)} → ${d.endP.toFixed(3)}`);
  }

  console.log(`\n=== top 15 4h trough drops (rolling 4h, dedup'd 4h) ===`);
  const drops4: any[] = [];
  for (let i = 48; i <= c5m.length; i++) {
    const win = c5m.slice(i - 48, i);
    const startP = win[0].o;
    const endP = win[win.length - 1].c;
    const lowP = Math.min(...win.map(c => c.l));
    drops4.push({ ts: win[win.length - 1].ts, troughMove: (lowP - startP) / startP * 100, closeMove: (endP - startP) / startP * 100, startP, endP, lowP });
  }
  const sorted4 = [...drops4].sort((a, b) => a.troughMove - b.troughMove);
  const dedup4: any[] = [];
  for (const d of sorted4) {
    if (dedup4.every(x => Math.abs(x.ts - d.ts) >= 4 * 3600 * 1000)) {
      dedup4.push(d);
      if (dedup4.length >= 15) break;
    }
  }
  for (const d of dedup4) {
    console.log(`${new Date(d.ts).toISOString().slice(0, 19)}  trough ${d.troughMove.toFixed(2)}%  close ${d.closeMove.toFixed(2)}%  $${d.startP.toFixed(3)} → ${d.lowP.toFixed(3)} → ${d.endP.toFixed(3)}`);
  }

  console.log(`\n=== dip-bucket counts (4h trough, dedup'd 4h apart) ===`);
  const bucks = { "1-2%": 0, "2-3%": 0, "3-4%": 0, "4-5%": 0, "5%+": 0 };
  const seen: number[] = [];
  for (const d of [...drops4].sort((a, b) => a.troughMove - b.troughMove)) {
    if (d.troughMove > -1) continue;
    if (seen.some(t => Math.abs(t - d.ts) < 4 * 3600 * 1000)) continue;
    seen.push(d.ts);
    const m = -d.troughMove;
    if (m >= 5) bucks["5%+"]++;
    else if (m >= 4) bucks["4-5%"]++;
    else if (m >= 3) bucks["3-4%"]++;
    else if (m >= 2) bucks["2-3%"]++;
    else bucks["1-2%"]++;
  }
  console.log(bucks);
})();
