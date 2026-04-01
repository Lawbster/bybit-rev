import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Equity curve tracker — shows how the account actually feels
// Samples equity every 4h, marks DD events, draws ASCII chart
// ─────────────────────────────────────────────

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

interface EquitySnap {
  ts: number;
  equity: number;       // realized capital + unrealized PnL
  capital: number;      // realized only
  unrealized: number;
  peak: number;
  ddPct: number;
  posCount: number;
  event?: string;       // EM kill, hard flatten, stale TP, batch TP
}

function run(candles: Candle[], cfg: Cfg): EquitySnap[] {
  const gate = buildTrendGate(candles);
  let capital = cfg.initialCapital, peakEq = capital;
  const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
  let lastAdd = 0;
  const startTs = new Date(cfg.startDate).getTime();
  const snaps: EquitySnap[] = [];
  const SAMPLE_INTERVAL = 4 * 3600000; // snap every 4h
  let lastSnap = 0;
  let pendingEvent: string | undefined;

  function snap(ts: number, close: number) {
    const ur = pos.reduce((s, p) => s + (close - p.ep) * p.qty, 0);
    const eq = capital + ur;
    if (eq > peakEq) peakEq = eq;
    const dd = peakEq > 0 ? ((peakEq - eq) / peakEq) * 100 : 0;
    snaps.push({
      ts, equity: eq, capital, unrealized: ur,
      peak: peakEq, ddPct: dd, posCount: pos.length,
      event: pendingEvent,
    });
    pendingEvent = undefined;
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

      if (high >= tpPrice) {
        for (const p of pos) {
          const raw = (tpPrice - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + tpPrice * p.qty * cfg.feeRate;
          const holdMs = ts - p.et;
          const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
          capital += raw - fees - fund;
        }
        pendingEvent = isStale ? "STALE TP" : "TP";
        pos.length = 0;
        snap(ts, close);
        continue;
      }
      if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
        for (const p of pos) {
          const raw = (close - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + close * p.qty * cfg.feeRate;
          const holdMs = ts - p.et;
          const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
          capital += raw - fees - fund;
        }
        pendingEvent = "EM KILL";
        pos.length = 0;
        snap(ts, close);
        continue;
      }
      if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
        for (const p of pos) {
          const raw = (close - p.ep) * p.qty;
          const fees = p.notional * cfg.feeRate + close * p.qty * cfg.feeRate;
          const holdMs = ts - p.et;
          const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
          capital += raw - fees - fund;
        }
        pendingEvent = "HARD FLAT";
        pos.length = 0;
        snap(ts, close);
        continue;
      }
    }

    // Sample equity periodically
    if (ts - lastSnap >= SAMPLE_INTERVAL) {
      snap(ts, close);
      lastSnap = ts;
    }

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
  // Final snap
  if (pos.length > 0) {
    const l = candles[candles.length - 1];
    snap(l.timestamp, l.close);
  }
  return snaps;
}

// ─────────────────────────────────────────────
// ASCII chart renderer
// ─────────────────────────────────────────────

function drawChart(snaps: EquitySnap[], width: number, height: number, label: string) {
  // Resample to fit width
  const step = Math.max(1, Math.floor(snaps.length / width));
  const sampled: EquitySnap[] = [];
  for (let i = 0; i < snaps.length; i += step) {
    sampled.push(snaps[i]);
  }

  const eqs = sampled.map(s => s.equity);
  const minEq = Math.min(...eqs);
  const maxEq = Math.max(...eqs);
  const range = maxEq - minEq || 1;

  // Build grid
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) {
    grid.push(new Array(sampled.length).fill(" "));
  }

  // Plot equity line
  for (let x = 0; x < sampled.length; x++) {
    const y = Math.floor(((sampled[x].equity - minEq) / range) * (height - 1));
    const row = height - 1 - y;
    grid[row][x] = sampled[x].ddPct > 30 ? "!" : sampled[x].ddPct > 15 ? "v" : "·";
  }

  // Mark events
  for (let x = 0; x < sampled.length; x++) {
    if (sampled[x].event === "EM KILL" || sampled[x].event === "HARD FLAT") {
      const y = Math.floor(((sampled[x].equity - minEq) / range) * (height - 1));
      const row = height - 1 - y;
      grid[row][x] = "X";
    }
  }

  // Render
  console.log(`\n  ${label}`);
  console.log(`  ${"─".repeat(sampled.length + 14)}`);

  for (let r = 0; r < height; r++) {
    const val = maxEq - (r / (height - 1)) * range;
    const prefix = ("$" + val.toFixed(0)).padStart(10) + " │ ";
    console.log("  " + prefix + grid[r].join(""));
  }

  // X-axis with dates
  const dateRow = new Array(sampled.length).fill(" ");
  for (let x = 0; x < sampled.length; x++) {
    if (x % Math.floor(sampled.length / 8) === 0) {
      const d = new Date(sampled[x].ts).toISOString().slice(2, 7); // YY-MM
      for (let c = 0; c < d.length && x + c < sampled.length; c++) {
        dateRow[x + c] = d[c];
      }
    }
  }
  console.log("  " + " ".repeat(12) + "└" + "─".repeat(sampled.length));
  console.log("  " + " ".repeat(13) + dateRow.join(""));
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

const cfgB: Cfg = {
  label: "B: Simple 8h/0.3%",
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
  startDate: "2025-01-20",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const cfgA: Cfg = { ...cfgB, label: "A: Current (20h/0.9%)", staleHours: 20, reducedTpPct: 0.9 };

const snapsA = run(candles, cfgA);
const snapsB = run(candles, cfgB);

console.log("=".repeat(120));
console.log("  EQUITY CURVE — How your account actually looks over 14 months");
console.log("=".repeat(120));

drawChart(snapsA, 100, 20, "A: Current Live (20h/0.9%) — $5,000 → $38,428");
drawChart(snapsB, 100, 20, "B: Simple 8h/0.3% — $5,000 → $46,778");

// ── Drawdown timeline ──
console.log("\n" + "=".repeat(120));
console.log("  DRAWDOWN EPISODES — Every time equity drops >15% from peak");
console.log("=".repeat(120));

function findDDEpisodes(snaps: EquitySnap[], threshold: number): { start: EquitySnap; trough: EquitySnap; end?: EquitySnap; events: string[] }[] {
  const episodes: { start: EquitySnap; trough: EquitySnap; end?: EquitySnap; events: string[] }[] = [];
  let inDD = false;
  let ddStart: EquitySnap | null = null;
  let trough: EquitySnap | null = null;
  let events: string[] = [];

  for (const s of snaps) {
    if (s.ddPct >= threshold && !inDD) {
      inDD = true;
      ddStart = s;
      trough = s;
      events = [];
      if (s.event) events.push(`${new Date(s.ts).toISOString().slice(0, 10)} ${s.event}`);
    } else if (inDD) {
      if (s.event) events.push(`${new Date(s.ts).toISOString().slice(0, 10)} ${s.event}`);
      if (s.ddPct > (trough?.ddPct || 0)) trough = s;
      if (s.ddPct < threshold * 0.3) {
        // DD recovered
        episodes.push({ start: ddStart!, trough: trough!, end: s, events });
        inDD = false;
      }
    }
  }
  if (inDD) episodes.push({ start: ddStart!, trough: trough!, end: undefined, events });
  return episodes;
}

for (const { cfg, snaps, label } of [
  { cfg: cfgA, snaps: snapsA, label: "A: Current (20h/0.9%)" },
  { cfg: cfgB, snaps: snapsB, label: "B: Simple 8h/0.3%" },
]) {
  console.log(`\n  [${label}]`);
  const episodes = findDDEpisodes(snaps, 15);

  for (const ep of episodes) {
    const startDate = new Date(ep.start.ts).toISOString().slice(0, 10);
    const troughDate = new Date(ep.trough.ts).toISOString().slice(0, 10);
    const endDate = ep.end ? new Date(ep.end.ts).toISOString().slice(0, 10) : "ongoing";
    const daysToTrough = (ep.trough.ts - ep.start.ts) / 86400000;
    const daysToRecover = ep.end ? (ep.end.ts - ep.trough.ts) / 86400000 : "?";
    const totalDays = ep.end ? (ep.end.ts - ep.start.ts) / 86400000 : "?";
    const peakEq = ep.start.peak;
    const troughEq = ep.trough.equity;
    const dollarLoss = peakEq - troughEq;

    console.log(`\n  ${startDate} → ${endDate} (${typeof totalDays === 'number' ? totalDays.toFixed(0) : totalDays} days total)`);
    console.log(`    Peak:   $${peakEq.toFixed(0)}`);
    console.log(`    Trough: $${troughEq.toFixed(0)} on ${troughDate} (${daysToTrough.toFixed(0)} days to bottom)`);
    console.log(`    Drop:   -$${dollarLoss.toFixed(0)} (-${ep.trough.ddPct.toFixed(1)}%)`);
    console.log(`    Recovery: ${typeof daysToRecover === 'number' ? daysToRecover.toFixed(0) + " days" : "ongoing"}`);

    // Show what the account looks like day by day during this DD
    const ddSnaps = snaps.filter(s => s.ts >= ep.start.ts && s.ts <= (ep.end?.ts || snaps[snaps.length - 1].ts));
    const dailySnaps = ddSnaps.filter((s, i) => i === 0 || s.ts - ddSnaps[i - 1].ts >= 20 * 3600000);

    // Show key moments
    console.log(`    Timeline:`);
    let prevEq = peakEq;
    for (const s of dailySnaps.slice(0, 20)) {
      const d = new Date(s.ts).toISOString().slice(0, 10);
      const change = s.equity - prevEq;
      const bar = s.ddPct > 0
        ? "█".repeat(Math.min(40, Math.floor(s.ddPct / 2)))
        : "";
      const eventStr = s.event ? ` ← ${s.event}` : "";
      console.log(`      ${d}  $${s.equity.toFixed(0).padStart(7)}  DD:${s.ddPct.toFixed(1).padStart(5)}%  ${change >= 0 ? "+" : ""}$${change.toFixed(0).padStart(6)}  ${bar}${eventStr}`);
      prevEq = s.equity;
    }
    if (dailySnaps.length > 20) console.log(`      ... (${dailySnaps.length - 20} more snapshots)`);

    if (ep.events.length > 0) {
      console.log(`    Exit events during this DD:`);
      for (const e of ep.events.slice(0, 10)) console.log(`      ${e}`);
      if (ep.events.length > 10) console.log(`      ... and ${ep.events.length - 10} more`);
    }
  }
}

// ── What $5,000 actually feels like ──
console.log("\n" + "=".repeat(120));
console.log("  WHAT IT FEELS LIKE — Dollar amounts at key moments (Config B)");
console.log("=".repeat(120) + "\n");

// Find biggest DD events in B
const bigEvents = snapsB.filter(s => s.event === "EM KILL" || s.event === "HARD FLAT");
for (const s of bigEvents) {
  const d = new Date(s.ts).toISOString().slice(0, 16);
  const prevPeak = s.peak;
  const underwater = prevPeak - s.equity;
  console.log(`  ${d} ${s.event!.padEnd(10)} | Account: $${s.equity.toFixed(0).padStart(7)} | Peak was: $${prevPeak.toFixed(0)} | Underwater: -$${underwater.toFixed(0)} (-${s.ddPct.toFixed(1)}%)`);
}

// Show monthly equity snapshots
console.log("\n  Monthly account snapshots (Config B):");
console.log("  " + "-".repeat(80));
let lastMonth = "";
for (const s of snapsB) {
  const m = new Date(s.ts).toISOString().slice(0, 7);
  if (m !== lastMonth) {
    const d = new Date(s.ts).toISOString().slice(0, 10);
    const pctReturn = ((s.equity / cfgB.initialCapital - 1) * 100);
    const barLen = Math.max(0, Math.floor(s.equity / 1000));
    const bar = "█".repeat(Math.min(50, barLen));
    console.log(`  ${d}  $${s.equity.toFixed(0).padStart(7)}  (${pctReturn >= 0 ? "+" : ""}${pctReturn.toFixed(0)}%)  ${bar}`);
    lastMonth = m;
  }
}
