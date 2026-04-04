import fs from 'fs';
import { Candle } from './fetch-candles';
import { aggregate } from './regime-filters';

const c5m: Candle[] = JSON.parse(fs.readFileSync('data/RIVERUSDT_5.json', 'utf-8'));
const c1m: Candle[] = JSON.parse(fs.readFileSync('data/RIVERUSDT_1.json', 'utf-8'));
const MERGE_TS = new Date('2026-02-16').getTime();
const allBars = [
  ...c5m.filter((b: Candle) => b.timestamp < MERGE_TS),
  ...c1m.filter((b: Candle) => b.timestamp >= MERGE_TS),
].sort((a: Candle, b: Candle) => a.timestamp - b.timestamp);

const c4H = aggregate(allBars, 240);
const closes = c4H.map((b: Candle) => b.close);
const ts4H   = c4H.map((b: Candle) => b.timestamp);

function emaArr(vals: number[], p: number): number[] {
  const k = 2/(p+1); const r = [vals[0]];
  for (let i=1;i<vals.length;i++) r.push(vals[i]*k+r[i-1]*(1-k));
  return r;
}
function atrArr(bars: Candle[], p: number): number[] {
  const tr = [bars[0].high-bars[0].low];
  for (let i=1;i<bars.length;i++) {
    const h=bars[i].high, l=bars[i].low, pc=bars[i-1].close;
    tr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
  }
  const k=2/(p+1); let a=tr[0]; const out=[a];
  for (let i=1;i<tr.length;i++){a=tr[i]*k+a*(1-k);out.push(a);}
  return out;
}

const e200 = emaArr(closes, 200);
const e50  = emaArr(closes, 50);
const atr14 = atrArr(c4H, 14);

const from = new Date('2026-03-18').getTime();
const to   = new Date('2026-04-04').getTime();

// Also find the crash low
let crashLow = Infinity, crashLowDate = '';
for (const b of allBars) {
  if (b.timestamp >= new Date('2026-03-26').getTime() && b.timestamp <= new Date('2026-04-04').getTime()) {
    if (b.low < crashLow) { crashLow = b.low; crashLowDate = new Date(b.timestamp).toISOString().slice(0,16); }
  }
}
console.log(`\nCrash low: $${crashLow.toFixed(3)} at ${crashLowDate} UTC\n`);

console.log('DateTime UTC          Close     EMA50     EMA200    ATR%   hostile  atr>10  STATUS');
console.log('-'.repeat(92));

let prevHostile = false;
let prevAtr = false;

for (let i = 1; i < c4H.length; i++) {
  const ts = ts4H[i];
  if (ts < from || ts > to) continue;

  const cl      = closes[i];
  const e5      = e50[i];
  const e2      = e200[i];
  const atrP    = (atr14[i] / cl) * 100;
  const hostile = cl < e2 && e5 < e50[i-1];
  const atrGate = atrP > 10;
  const gated   = hostile || atrGate;
  const changed = hostile !== prevHostile || atrGate !== prevAtr;
  prevHostile = hostile; prevAtr = atrGate;

  // print every 6th bar (daily) OR on state change
  if (i % 6 === 0 || changed) {
    const dt = new Date(ts).toISOString().replace('T',' ').slice(0,16);
    const h = hostile ? 'YES' : 'no ';
    const a = atrGate ? 'YES' : 'no ';
    const g = gated ? '<< BLOCKED' : 'open';
    console.log(`${dt}  ${cl.toFixed(3).padStart(8)}  ${e5.toFixed(3).padStart(8)}  ${e2.toFixed(3).padStart(8)}  ${atrP.toFixed(1).padStart(5)}%  ${h}      ${a}     ${g}`);
  }
}
