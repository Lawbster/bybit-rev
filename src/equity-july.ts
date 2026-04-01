import fs from "fs";
import { Candle } from "./fetch-candles";

interface Cfg {
  label: string;
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
}

function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

interface Snap {
  ts: number; equity: number; capital: number; peak: number; ddPct: number; ddDollar: number;
  posCount: number; event?: string; notional: number; avgEntry?: number; exitPrice?: number;
  ladderPnl?: number;
}

function run(candles: Candle[], cfg: Cfg): Snap[] {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  const snaps: Snap[] = [];
  const SAMPLE = 4 * 3600000;
  let lastSnap = 0;
  let pendingEvent: string | undefined;
  let pendingAvgE = 0, pendingExit = 0, pendingPnl = 0;

  function doSnap(ts: number, close: number) {
    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const not = pos.reduce((s, p) => s + p.notional, 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    snaps.push({ ts, equity: eq, capital, peak: peakEq, ddPct: dd, ddDollar: peakEq - eq,
      posCount: pos.length, event: pendingEvent, notional: not,
      avgEntry: pendingAvgE || undefined, exitPrice: pendingExit || undefined,
      ladderPnl: pendingPnl || undefined });
    pendingEvent = undefined; pendingAvgE = 0; pendingExit = 0; pendingPnl = 0;
  }

  function closeLadder(price: number, ts: number, close: number, evt: string) {
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    let netPnl = 0;
    for (const p of pos) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      netPnl += raw - fees - fund;
      capital += raw - fees - fund;
    }
    pendingEvent = evt; pendingAvgE = avgE; pendingExit = price; pendingPnl = netPnl;
    pos.length = 0;
    doSnap(ts, close);
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { close, high, timestamp: ts } = c;

    if (pos.length > 0) {
      const tQty = pos.reduce((s, p) => s + p.qty, 0);
      const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
      const avgPnl = ((close - avgE) / avgE) * 100;
      const oldH = (ts - pos[0].et) / 3600000;
      const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
      const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
      const tpPrice = avgE * (1 + tp / 100);
      if (high >= tpPrice) { closeLadder(tpPrice, ts, close, isStale ? "STALE" : "TP"); continue; }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) { closeLadder(close, ts, close, "EM KILL"); continue; }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) { closeLadder(close, ts, close, "HARD FLAT"); continue; }
    }

    if (ts - lastSnap >= SAMPLE) { doSnap(ts, close); lastSnap = ts; }

    const gap = (ts - lastAdd) / 60000;
    if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
      if (!isHostile(gate, ts)) {
        const lvl = pos.length;
        const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
        const margin = notional / cfg.leverage;
        const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - used >= margin && capital > 0) {
          pos.push({ ep: close, et: ts, qty: notional / close, notional });
          lastAdd = ts;
        }
      }
    }
  }
  if (pos.length > 0) { const l = candles[candles.length - 1]; doSnap(l.timestamp, l.close); }
  return snaps;
}

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

const cfg: Cfg = {
  label: "$15K from July 2025",
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 15000, feeRate: 0.00055,
  startDate: "2025-07-01",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const snaps = run(candles, cfg);
const finalEq = snaps[snaps.length - 1].equity;
const maxDD = Math.max(...snaps.map(s => s.ddPct));
const minEq = Math.min(...snaps.map(s => s.equity));

console.log("=".repeat(110));
console.log(`  $15K from July 1 2025 — 8h/0.3% stale, $800 base, 50x, 9 months`);
console.log("=".repeat(110));
console.log(`  Start: $15,000 | Final: $${finalEq.toFixed(0)} | Return: +${((finalEq/15000-1)*100).toFixed(0)}%`);
console.log(`  Max DD: ${maxDD.toFixed(1)}% | Min Equity: $${minEq.toFixed(0)}`);
console.log(`  Max notional: $25,720 (171% of starting capital)\n`);

// Monthly equity
console.log("  Month       Equity     Return    DD%      DD$      Note");
console.log("  " + "-".repeat(85));
let lastMonth = "";
for (const s of snaps) {
  const m = new Date(s.ts).toISOString().slice(0, 7);
  if (m !== lastMonth) {
    const d = new Date(s.ts).toISOString().slice(0, 10);
    const ret = ((s.equity / 15000 - 1) * 100);
    const bar = s.ddPct > 0 ? "█".repeat(Math.min(30, Math.floor(s.ddPct * 2))) : "";
    console.log(`  ${d}  $${s.equity.toFixed(0).padStart(7)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(0) + "%"}${" ".repeat(Math.max(1, 7 - ret.toFixed(0).length))} -${s.ddPct.toFixed(1).padStart(5)}%  -$${s.ddDollar.toFixed(0).padStart(6)}  ${bar}`);
    lastMonth = m;
  }
}

// Every loss event
console.log(`\n  Every EM Kill / Hard Flatten:`);
console.log("  " + "-".repeat(100));
const events = snaps.filter(s => s.event === "EM KILL" || s.event === "HARD FLAT");
let totalLoss = 0;
for (const s of events) {
  const d = new Date(s.ts).toISOString().slice(0, 16);
  const month = new Date(s.ts).toISOString().slice(0, 7);
  totalLoss += s.ladderPnl || 0;
  console.log(`  ${d}  ${s.event!.padEnd(10)}  $${s.avgEntry?.toFixed(2).padStart(7)} → $${s.exitPrice?.toFixed(2).padStart(7)}  PnL: $${(s.ladderPnl||0).toFixed(0).padStart(6)}  Equity: $${s.equity.toFixed(0).padStart(7)}  DD: -${s.ddPct.toFixed(1)}%`);
}
console.log(`\n  Total loss from EM kills + hard flattens: $${totalLoss.toFixed(0)}`);
console.log(`  Number of loss events: ${events.length}`);
console.log(`  Average loss per event: $${(totalLoss / events.length).toFixed(0)}`);

// Stale exits
const stales = snaps.filter(s => s.event === "STALE");
console.log(`\n  Stale TPs: ${stales.length} (avg PnL: $${stales.length > 0 ? (stales.reduce((s, e) => s + (e.ladderPnl || 0), 0) / stales.length).toFixed(0) : 0})`);

// Weekly equity for more detail
console.log(`\n  Weekly equity curve:`);
console.log("  " + "-".repeat(85));
let lastWeek = "";
for (const s of snaps) {
  const d = new Date(s.ts);
  const week = d.toISOString().slice(0, 10);
  const weekNum = Math.floor(s.ts / (7 * 86400000));
  const wk = String(weekNum);
  if (wk !== lastWeek) {
    const ret = ((s.equity / 15000 - 1) * 100);
    const bar = "█".repeat(Math.min(60, Math.max(0, Math.floor(s.equity / 500))));
    const ddBar = s.ddPct > 3 ? " DD:" + "▼".repeat(Math.floor(s.ddPct)) : "";
    console.log(`  ${week}  $${s.equity.toFixed(0).padStart(7)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(0) + "%".padEnd(7)}  ${bar}${ddBar}`);
    lastWeek = wk;
  }
}

// Worst DD episodes
console.log(`\n  Worst drawdown periods:`);
console.log("  " + "-".repeat(85));
let inDD = false, ddStartSnap: Snap | null = null, curTrough: Snap | null = null;
const episodes: { start: Snap; trough: Snap; end?: Snap }[] = [];

for (const s of snaps) {
  if (s.ddPct > 5 && !inDD) {
    inDD = true; ddStartSnap = s; curTrough = s;
  } else if (inDD) {
    if (s.ddPct > (curTrough?.ddPct || 0)) curTrough = s;
    if (s.ddPct < 1.5) {
      episodes.push({ start: ddStartSnap!, trough: curTrough!, end: s });
      inDD = false;
    }
  }
}
if (inDD && curTrough) episodes.push({ start: ddStartSnap!, trough: curTrough! });

episodes.sort((a, b) => b.trough.ddPct - a.trough.ddPct);
for (const ep of episodes.slice(0, 6)) {
  const s = new Date(ep.start.ts).toISOString().slice(0, 10);
  const t = new Date(ep.trough.ts).toISOString().slice(0, 10);
  const e = ep.end ? new Date(ep.end.ts).toISOString().slice(0, 10) : "ongoing";
  const days = ep.end ? ((ep.end.ts - ep.start.ts) / 86400000).toFixed(0) : "?";
  console.log(`  ${s} → ${e} (${days}d) | $${ep.start.peak.toFixed(0)} → $${ep.trough.equity.toFixed(0)} | -$${ep.trough.ddDollar.toFixed(0)} (-${ep.trough.ddPct.toFixed(1)}%)`);
}
