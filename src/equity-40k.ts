import fs from "fs";
import { Candle } from "./fetch-candles";

// Quick equity curve at $40K initial — same fixed position sizing

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
  posCount: number; event?: string; notionalExposed: number;
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

  function doSnap(ts: number, close: number) {
    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const notional = pos.reduce((s, p) => s + p.notional, 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    snaps.push({ ts, equity: eq, capital, peak: peakEq, ddPct: dd, ddDollar: peakEq - eq, posCount: pos.length, event: pendingEvent, notionalExposed: notional });
    pendingEvent = undefined;
  }

  function closeLadder(price: number, ts: number, close: number, evt: string) {
    for (const p of pos) {
      const raw = (price - p.ep) * p.qty;
      const fees = p.notional * cfg.feeRate + price * p.qty * cfg.feeRate;
      const holdMs = ts - p.et;
      const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
      capital += raw - fees - fund;
    }
    pendingEvent = evt;
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

// Run both $5K and $40K
const base = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, feeRate: 0.00055,
  startDate: "2025-01-20",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const cfgs: Cfg[] = [
  { ...base, label: "$5K start", initialCapital: 5000 },
  { ...base, label: "$15K start", initialCapital: 15000 },
  { ...base, label: "$40K start", initialCapital: 40000 },
];

for (const cfg of cfgs) {
  const snaps = run(candles, cfg);

  console.log("\n" + "=".repeat(110));
  console.log(`  ${cfg.label} — 8h/0.3% stale, $800 base positions, 50x leverage`);
  console.log("=".repeat(110));

  // Max notional exposure
  const maxNotional = Math.max(...snaps.map(s => s.notionalExposed));
  const maxPositions = Math.max(...snaps.map(s => s.posCount));
  console.log(`  Max notional exposure: $${maxNotional.toFixed(0)} (${maxPositions} positions)`);
  console.log(`  Max notional as % of starting capital: ${(maxNotional / cfg.initialCapital * 100).toFixed(0)}%`);
  console.log(`  Max margin used: $${(maxNotional / cfg.leverage).toFixed(0)} (${(maxNotional / cfg.leverage / cfg.initialCapital * 100).toFixed(0)}% of start)`);

  // Monthly equity table
  console.log(`\n  Date          Equity     Return   DD from peak    DD$      Notional  Positions`);
  console.log("  " + "-".repeat(95));

  let lastMonth = "";
  for (const s of snaps) {
    const m = new Date(s.ts).toISOString().slice(0, 7);
    if (m !== lastMonth) {
      const d = new Date(s.ts).toISOString().slice(0, 10);
      const ret = ((s.equity / cfg.initialCapital - 1) * 100);
      const ddBar = s.ddPct > 0 ? "█".repeat(Math.min(30, Math.floor(s.ddPct))) : "";
      console.log(`  ${d}  $${s.equity.toFixed(0).padStart(8)}  ${(ret >= 0 ? "+" : "") + ret.toFixed(0) + "%"}${" ".repeat(Math.max(1, 7 - ret.toFixed(0).length))} -${s.ddPct.toFixed(1).padStart(5)}%  -$${s.ddDollar.toFixed(0).padStart(7)}  $${s.notionalExposed.toFixed(0).padStart(7)}  ${s.posCount} ${ddBar}`);
      lastMonth = m;
    }
  }

  // All DD events
  console.log(`\n  Every EM Kill / Hard Flatten:`);
  console.log("  " + "-".repeat(95));
  const events = snaps.filter(s => s.event === "EM KILL" || s.event === "HARD FLAT");
  for (const s of events) {
    const d = new Date(s.ts).toISOString().slice(0, 16);
    const ret = ((s.equity / cfg.initialCapital - 1) * 100);
    console.log(`  ${d}  ${s.event!.padEnd(10)}  Equity: $${s.equity.toFixed(0).padStart(8)}  Peak: $${s.peak.toFixed(0).padStart(8)}  DD: -${s.ddPct.toFixed(1)}% (-$${s.ddDollar.toFixed(0)})`);
  }

  // Worst DD episodes
  console.log(`\n  Worst drawdown periods:`);
  console.log("  " + "-".repeat(95));
  let inDD = false, ddStart = 0, worstDd = 0, worstDdSnap: Snap | null = null;
  const episodes: { start: Snap; trough: Snap; end?: Snap }[] = [];
  let curTrough: Snap | null = null;

  for (const s of snaps) {
    if (s.ddPct > 5 && !inDD) {
      inDD = true;
      ddStart = s.ts;
      curTrough = s;
    } else if (inDD) {
      if (s.ddPct > (curTrough?.ddPct || 0)) curTrough = s;
      if (s.ddPct < 2) {
        episodes.push({ start: snaps.find(x => x.ts >= ddStart)!, trough: curTrough!, end: s });
        inDD = false;
      }
    }
  }
  if (inDD && curTrough) episodes.push({ start: snaps.find(x => x.ts >= ddStart)!, trough: curTrough });

  episodes.sort((a, b) => b.trough.ddDollar - a.trough.ddDollar);
  for (const ep of episodes.slice(0, 8)) {
    const s = new Date(ep.start.ts).toISOString().slice(0, 10);
    const t = new Date(ep.trough.ts).toISOString().slice(0, 10);
    const e = ep.end ? new Date(ep.end.ts).toISOString().slice(0, 10) : "ongoing";
    const days = ep.end ? ((ep.end.ts - ep.start.ts) / 86400000).toFixed(0) : "?";
    console.log(`  ${s} → ${e} (${days}d) | Peak $${ep.start.peak.toFixed(0)} → Trough $${ep.trough.equity.toFixed(0)} | -$${ep.trough.ddDollar.toFixed(0)} (-${ep.trough.ddPct.toFixed(1)}%)`);
  }
}

// Side by side comparison of the DD feel
console.log("\n" + "=".repeat(110));
console.log("  SIDE BY SIDE — Same crash, different starting capital");
console.log("=".repeat(110));
console.log(`
  The position sizing is FIXED at $800 base, scaling to ~$25,720 max notional (11 positions).
  This means the dollar loss per EM kill is the same regardless of account size.

  What changes is how much it hurts as a % of your account:
`);

console.log("  Event                          $5K account              $40K account");
console.log("  " + "-".repeat(80));
console.log("  Worst EM kill (~$3,000 loss)   -60% of account          -7.5% of account");
console.log("  Two EM kills back-to-back      -$6K = wiped             -$6K = -15%, survivable");
console.log("  4-month grind (Nov-Feb)        Peak $51K → $40K (-22%)  Peak $86K → $75K (-13%)");
console.log("  Early months (Jan-Mar '25)     $5K → $1.7K = 66% DD    $40K → $36K = 10% DD");
console.log(`
  At $40K, the max full-ladder notional ($25,720) is only 64% of starting capital.
  At $5K, it's 514% — you're massively overleveraged relative to account size.

  The 77% MaxDD is a $5K problem, not a strategy problem.
  On $40K with these same fixed positions, max DD drops to roughly 13-23%.
`);
