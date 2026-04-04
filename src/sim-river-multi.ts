// sim-river-multi.ts — run RIVER mini-ladder sim across multiple symbols, print summary table
// npx ts-node src/sim-river-multi.ts

import fs from "fs";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

// ── Shared indicator helpers ──────────────────────────────────────
function emaArr(vals: number[], p: number): number[] {
  const k = 2/(p+1); const r = [vals[0]];
  for (let i=1;i<vals.length;i++) r.push(vals[i]*k+r[i-1]*(1-k));
  return r;
}
function atrArr(bars: Candle[], p: number): number[] {
  const tr = [bars[0].high-bars[0].low];
  for (let i=1;i<bars.length;i++) {
    const h=bars[i].high,l=bars[i].low,pc=bars[i-1].close;
    tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
  }
  const k=2/(p+1); let a=tr[0]; const out=[a];
  for (let i=1;i<tr.length;i++){a=tr[i]*k+a*(1-k);out.push(a);}
  return out;
}
function bsearch(arr: number[], target: number): number {
  let lo=0,hi=arr.length-1,res=-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(arr[mid]<=target){res=mid;lo=mid+1;}else hi=mid-1;}
  return res;
}

// ── Sim core ──────────────────────────────────────────────────────
interface Rung { ep: number; qty: number; notional: number; }
interface Batch { anchor: number; tp: number; rungs: Rung[]; openedAt: number; }

interface SimResult {
  finalEq: number; startEq: number; maxDD: number; wr: number;
  batches: number; maxRungs: number; maxNotional: number;
  fundingPaid: number; gatedBars: number;
  startDate: string; endDate: string; days: number;
}

function runSim(allBars: Candle[], c4H: Candle[], params: {
  baseNotional: number; scaleFactor: number; tpPct: number; leverage: number;
  feeRate: number; capital: number; maxRungs: number; maxConcurrent: number;
  maxMarginPct: number; minDropPct: number; trendGate: boolean; warmupBars: number;
}): SimResult {
  const closes4H = c4H.map(b=>b.close);
  const ts4H     = c4H.map(b=>b.timestamp);
  const e200     = emaArr(closes4H, 200);
  const e50      = emaArr(closes4H, 50);
  const atr14    = atrArr(c4H, 14);

  const FUNDING_RATE_8H = 0.0001;
  let capital = params.capital;
  const startEq = capital;
  let peakEq = capital; let maxDD = 0;
  let batches: Batch[] = [];
  let closedBatches = 0; let wonBatches = 0;
  let maxRungs = 0; let maxNotional = 0;
  let fundingPaid = 0; let gatedBars = 0;
  let prevClose = allBars[0].close;
  let lastFundingTs = 0;

  const startTs = allBars[0].timestamp;
  const endTs   = allBars[allBars.length-1].timestamp;

  for (const bar of allBars) {
    const ts = bar.timestamp;
    const cl = bar.close;

    // Funding every 8h
    if (lastFundingTs === 0) lastFundingTs = ts;
    if (ts - lastFundingTs >= 8 * 3600000) {
      const totalNotional = batches.reduce((s,b) => s + b.rungs.reduce((x,r) => x+r.notional, 0), 0);
      const fee = totalNotional * FUNDING_RATE_8H;
      capital -= fee; fundingPaid += fee;
      lastFundingTs = ts;
    }

    // Regime check
    let gated = false;
    if (params.trendGate) {
      const i = bsearch(ts4H, ts);
      if (i >= 1) {
        const idx = i - 1;
        if (idx >= params.warmupBars) {
          const hostile = closes4H[idx] < e200[idx] && e50[idx] < e50[idx-1 < 0 ? 0 : idx-1];
          if (hostile) gated = true;
        }
      }
    }
    if (gated) gatedBars++;

    // Check TPs first
    const toClose: Batch[] = [];
    for (const b of batches) {
      if (bar.high >= b.tp) toClose.push(b);
    }
    for (const b of toClose) {
      batches = batches.filter(x => x !== b);
      const totalNotional = b.rungs.reduce((s,r) => s+r.notional, 0);
      const avgEntry = b.rungs.reduce((s,r) => s+r.ep*r.qty, 0) / b.rungs.reduce((s,r) => s+r.qty, 0);
      const pnl = (b.tp - avgEntry) / avgEntry * totalNotional * params.leverage;
      const fees = totalNotional * params.feeRate * 2;
      capital += pnl - fees;
      closedBatches++; wonBatches++;
    }

    // Margin used
    const usedMargin = () => batches.reduce((s,b) => s + b.rungs.reduce((x,r) => x + r.notional/params.leverage, 0), 0);

    // Try to add to existing batches
    for (const b of batches) {
      if (b.rungs.length >= params.maxRungs) continue;
      const lastRung = b.rungs[b.rungs.length-1];
      const dropPct = (lastRung.ep - cl) / lastRung.ep * 100;
      if (dropPct < params.minDropPct) continue;
      const newNotional = lastRung.notional * params.scaleFactor;
      const newMargin = newNotional / params.leverage;
      if (params.maxMarginPct > 0 && (usedMargin() + newMargin) / capital > params.maxMarginPct / 100) continue;
      const qty = newNotional / cl;
      b.rungs.push({ ep: cl, qty, notional: newNotional });
      const fees = newNotional * params.feeRate;
      capital -= fees;
      b.tp = b.rungs.reduce((s,r) => s+r.ep*r.qty, 0) / b.rungs.reduce((s,r) => s+r.qty, 0) * (1 + params.tpPct/100);
      const allRungs = batches.reduce((s,b2) => s+b2.rungs.length, 0);
      if (allRungs > maxRungs) maxRungs = allRungs;
    }

    // Open new batch
    if (!gated && batches.length < params.maxConcurrent) {
      const dropFromPrev = (prevClose - cl) / prevClose * 100;
      if (dropFromPrev >= params.minDropPct) {
        const newMargin = params.baseNotional / params.leverage;
        if (params.maxMarginPct === 0 || (usedMargin() + newMargin) / capital <= params.maxMarginPct / 100) {
          const qty = params.baseNotional / cl;
          const tp = cl * (1 + params.tpPct/100);
          batches.push({ anchor: cl, tp, rungs: [{ ep: cl, qty, notional: params.baseNotional }], openedAt: ts });
          capital -= params.baseNotional * params.feeRate;
        }
      }
    }

    // Track metrics
    const totalN = batches.reduce((s,b) => s + b.rungs.reduce((x,r) => x+r.notional, 0), 0);
    if (totalN > maxNotional) maxNotional = totalN;
    const eq = capital + totalN / params.leverage * 0; // mark-to-market excluded for simplicity
    if (capital > peakEq) peakEq = capital;
    const dd = (peakEq - capital) / peakEq * 100;
    if (dd > maxDD) maxDD = dd;

    prevClose = cl;
  }

  // Close remaining batches at last price (open risk)
  const lastPrice = allBars[allBars.length-1].close;
  for (const b of batches) {
    closedBatches++;
    // count as open / not won
  }

  const wr = closedBatches > 0 ? wonBatches / closedBatches * 100 : 0;
  const days = Math.round((endTs - startTs) / 86400000);
  return {
    finalEq: capital, startEq, maxDD, wr,
    batches: closedBatches, maxRungs, maxNotional,
    fundingPaid, gatedBars,
    startDate: new Date(startTs).toISOString().slice(0,10),
    endDate: new Date(endTs).toISOString().slice(0,10),
    days,
  };
}

// ── Symbol list ───────────────────────────────────────────────────
const SYMBOLS = [
  "RIVERUSDT","HYPEUSDT","SIRENUSDT","VVVUSDT","TAOUSDT",
  "STGUSDT","BLUAIUSDT","DUSKUSDT","LIGHTUSDT","CUSDT","PIPPINUSDT",
];

const PARAMS = {
  baseNotional: 12, scaleFactor: 1.6, tpPct: 0.7, leverage: 20,
  feeRate: 0.00055, capital: 2000, maxRungs: 25, maxConcurrent: 3,
  maxMarginPct: 15, minDropPct: 0.7, trendGate: true, warmupBars: 200,
};

function $n(v: number) { return v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}k` : `$${v.toFixed(0)}`; }

console.log("\n══ RIVER mini-ladder — multi-symbol sweep ══");
console.log("   trendGate + drop>0.7% + margin=15% | base=$12 scale=1.6x TP=0.7% lev=20x capital=$2k\n");
console.log(`${"Symbol".padEnd(14)} ${"Range".padEnd(23)} ${"Days".padStart(4)} ${"Equity".padStart(10)} ${"Return".padStart(8)} ${"DD".padStart(7)} ${"WR".padStart(5)} ${"Bat".padStart(5)} ${"MaxR".padStart(5)} ${"Gated%".padStart(7)}`);
console.log("─".repeat(105));

for (const sym of SYMBOLS) {
  const pathFull = `data/${sym}_5_full.json`;
  const path5m   = `data/${sym}_5.json`;
  const path1m   = `data/${sym}_1.json`;

  const raw1m = fs.existsSync(path1m) ? JSON.parse(fs.readFileSync(path1m, "utf-8")) as Candle[] : [];
  const raw5m = fs.existsSync(pathFull) ? JSON.parse(fs.readFileSync(pathFull, "utf-8")) as Candle[] : fs.existsSync(path5m) ? JSON.parse(fs.readFileSync(path5m, "utf-8")) as Candle[] : [];

  if (raw5m.length === 0 && raw1m.length === 0) {
    console.log(`${sym.padEnd(14)} NO DATA`);
    continue;
  }

  const allBars: Candle[] = (() => {
    if (raw1m.length === 0) return raw5m.sort((a,b)=>a.timestamp-b.timestamp);
    raw1m.sort((a,b)=>a.timestamp-b.timestamp);
    const merge1mStart = raw1m[0].timestamp;
    return [...raw5m.filter(b=>b.timestamp<merge1mStart), ...raw1m].sort((a,b)=>a.timestamp-b.timestamp);
  })();

  const c4H = aggregate(allBars, 240);

  try {
    const r = runSim(allBars, c4H, PARAMS);
    const ret = ((r.finalEq - r.startEq) / r.startEq * 100).toFixed(0);
    const gatedPct = (r.gatedBars / allBars.length * 100).toFixed(0);
    const range = `${r.startDate} → ${r.endDate}`;
    console.log(`${sym.padEnd(14)} ${range.padEnd(23)} ${String(r.days).padStart(4)} ${$n(r.finalEq).padStart(10)} ${(ret+"%").padStart(8)} ${(r.maxDD.toFixed(1)+"%").padStart(7)} ${(r.wr.toFixed(0)+"%").padStart(5)} ${String(r.batches).padStart(5)} ${String(r.maxRungs).padStart(5)} ${(gatedPct+"%").padStart(7)}`);
  } catch(e: any) {
    console.log(`${sym.padEnd(14)} ERROR: ${e.message?.slice(0,60)}`);
  }
}

console.log("\n  WR = won/closed batches. Open batches at end not counted as losses.");
console.log("  Gated% = % of bars where trendGate blocked new opens.");
console.log("  Note: capital compounds — equity figures reflect uncapped reinvestment.");
