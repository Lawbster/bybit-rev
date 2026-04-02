import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Top-rung peel sim — Codex Batch A, strategy #3
//
// Instead of opening a short, close the newest N long rungs
// when stress conditions are met, then pause re-adds for X minutes.
//
// Trigger: same stress family as hedge sim
//   rungs >= stressRungs + avgPnL <= stressPnlPct + RSI1h <= rsiMax + ROC5 <= roc5Max
//
// Action:
//   close newest peelRungs longs at market close
//   block new adds for peelCooldownMin
//
// Compare against: baseline, stress short hedge
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// ── Bar builder ──
function buildBars(candles: Candle[], ms: number) {
  const bars: { ts: number; close: number }[] = [];
  let cur: { ts: number; close: number } | null = null;
  for (const c of candles) {
    const barTs = Math.floor(c.timestamp / ms) * ms;
    if (!cur || cur.ts !== barTs) { if (cur) bars.push(cur); cur = { ts: barTs, close: c.close }; }
    else cur.close = c.close;
  }
  if (cur) bars.push(cur);
  return bars;
}

// ── RSI(14) ──
function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i-1]; if (d > 0) gains += d; else losses -= d; }
  let avgG = gains / period, avgL = losses / period;
  rsi[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgG = (avgG * (period-1) + g) / period; avgL = (avgL * (period-1) + l) / period;
    rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return rsi;
}

// ── ROC5 ──
function calcROC5(closes: number[]): number[] {
  return closes.map((c, i) => i < 5 ? NaN : (c - closes[i-5]) / closes[i-5] * 100);
}

// Precompute 1h indicators
const bars1h = buildBars(candles, 3600000);
const closes1h = bars1h.map(b => b.close);
const rsi1h = calcRSI(closes1h);
const roc1h = calcROC5(closes1h);
const idx1hMap = new Map<number, number>();
bars1h.forEach((b, i) => idx1hMap.set(b.ts, i));

function get1hInd(ts: number): { rsi: number; roc5: number } | null {
  const prevTs = Math.floor(ts / 3600000) * 3600000 - 3600000;
  const idx = idx1hMap.get(prevTs);
  if (idx === undefined || isNaN(rsi1h[idx]) || isNaN(roc1h[idx])) return null;
  return { rsi: rsi1h[idx], roc5: roc1h[idx] };
}

// ── 4h trend gate ──
const P4H = 4 * 3600000;
const bars4h: { ts: number; close: number }[] = [];
let cb = -1, lc = 0, lt = 0;
for (const c of candles) {
  const b = Math.floor(c.timestamp / P4H);
  if (b !== cb) { if (cb !== -1) bars4h.push({ ts: lt, close: lc }); cb = b; }
  lc = c.close; lt = c.timestamp;
}
bars4h.push({ ts: lt, close: lc });
const ema = (d: number[], p: number) => { const k = 2/(p+1); const r = [d[0]]; for (let i=1;i<d.length;i++) r.push(d[i]*k+r[i-1]*(1-k)); return r; };
const c4 = bars4h.map(b => b.close), e200 = ema(c4, 200), e50 = ema(c4, 50);
const h4map = new Map<number, boolean>();
for (let i = 1; i < bars4h.length; i++) h4map.set(Math.floor(bars4h[i].ts / P4H) * P4H, c4[i] < e200[i] && e50[i] < e50[i-1]);
const isHostile = (ts: number) => h4map.get(Math.floor(ts / P4H) * P4H - P4H) ?? false;

interface Cfg {
  label: string;
  startDate: string;
  base: number; scale: number; maxPos: number; capital: number;
  tp: number; addMin: number; staleH: number; reducedTp: number;
  flatH: number; flatPct: number; killPct: number; fee: number; fund8h: number;
  // Stress trigger
  stressRungs: number;
  stressPnlPct: number;
  rsiMax: number;
  roc5Max: number;
  // Peel action
  peelEnabled: boolean;
  peelRungs: number;         // how many newest rungs to close (1 or 2)
  peelCooldownMin: number;   // block re-adds for this long after peel
  // Short hedge (for comparison)
  shortEnabled: boolean;
  hedgeSizePct: number;
  hedgeTp: number;
  hedgeKill: number;
  hedgeCooldownMin: number;
}

interface Result {
  finalEq: number; ret: number; maxDD: number; minEq: number;
  longTPs: number; longStales: number; longKills: number; longFlats: number;
  peelEvents: number; peelRungsTotal: number; peelPnl: number;
  shortFires: number; shortTPs: number; shortKills: number; shortPnl: number;
}

function runSim(cfg: Cfg): Result {
  const startTs = new Date(cfg.startDate).getTime();
  let cap = cfg.capital, peak = cap, minEq = cap, maxDD = 0;
  type Pos = { ep: number; et: number; qty: number; not: number };
  const longs: Pos[] = [];
  let short: Pos | null = null;
  let lastAdd = 0, lastHedge = 0, peelCooldownUntil = 0;
  let longTPs = 0, longStales = 0, longKills = 0, longFlats = 0;
  let peelEvents = 0, peelRungsTotal = 0, peelPnl = 0;
  let shortFires = 0, shortTPs = 0, shortKills = 0, shortPnl = 0;

  for (const c of candles) {
    if (c.timestamp < startTs) continue;
    const { close, high, low, timestamp: ts } = c;

    // Equity
    const longUr = longs.reduce((a, p) => a + (close - p.ep) * p.qty, 0);
    const shortUr = short ? (short.ep - close) * short.qty : 0;
    const eq = cap + longUr + shortUr;
    if (eq > peak) peak = eq; if (eq < minEq) minEq = eq;
    const dd = peak > 0 ? (peak - eq) / peak * 100 : 0; if (dd > maxDD) maxDD = dd;

    // ── Short exit ──
    if (short) {
      const tpP = short.ep * (1 - cfg.hedgeTp / 100);
      const killP = short.ep * (1 + cfg.hedgeKill / 100);
      if (low <= tpP) {
        const pnl = (short.ep - tpP) * short.qty - (short.not * cfg.fee + tpP * short.qty * cfg.fee);
        cap += pnl; shortPnl += pnl; shortTPs++; short = null;
      } else if (high >= killP) {
        const pnl = (short.ep - killP) * short.qty - (short.not * cfg.fee + killP * short.qty * cfg.fee);
        cap += pnl; shortPnl += pnl; shortKills++; short = null;
      }
    }

    // ── Long exits ──
    if (longs.length > 0) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const oldH = (ts - longs[0].et) / 3600000;
      const isStale = cfg.staleH > 0 && oldH >= cfg.staleH && close < avgE;
      const tpPrice = avgE * (1 + (isStale ? cfg.reducedTp : cfg.tp) / 100);
      const avgPnl = (close - avgE) / avgE * 100;

      if (high >= tpPrice) {
        for (const p of longs) {
          const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
          cap += (tpPrice - p.ep) * p.qty - (p.not * cfg.fee + tpPrice * p.qty * cfg.fee) - fund;
        }
        longs.length = 0; lastAdd = 0;
        if (isStale) longStales++; else longTPs++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; shortPnl += pnl; short = null; }
        continue;
      }
      if (cfg.killPct !== 0 && avgPnl <= cfg.killPct) {
        for (const p of longs) { const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000)); cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund; }
        longs.length = 0; lastAdd = 0; longKills++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; shortPnl += pnl; short = null; }
        continue;
      }
      if (cfg.flatH > 0 && oldH >= cfg.flatH && avgPnl <= cfg.flatPct && isHostile(ts)) {
        for (const p of longs) { const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000)); cap += (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund; }
        longs.length = 0; lastAdd = 0; longFlats++;
        if (short) { const pnl = (short.ep - close) * short.qty - (short.not * cfg.fee + close * short.qty * cfg.fee); cap += pnl; shortPnl += pnl; short = null; }
        continue;
      }
    }

    // ── Long entries ──
    const addBlocked = ts < peelCooldownUntil;
    if (longs.length < cfg.maxPos && (ts - lastAdd) / 60000 >= cfg.addMin && !isHostile(ts) && !addBlocked) {
      const not = cfg.base * Math.pow(cfg.scale, longs.length);
      longs.push({ ep: close, et: ts, qty: not / close, not }); lastAdd = ts;
    }

    // ── Stress trigger check ──
    if (longs.length >= cfg.stressRungs) {
      const tQty = longs.reduce((a, p) => a + p.qty, 0);
      const avgE = longs.reduce((a, p) => a + p.ep * p.qty, 0) / tQty;
      const avgPnlPct = (close - avgE) / avgE * 100;

      if (avgPnlPct <= cfg.stressPnlPct) {
        const ind = get1hInd(ts);
        const indOk = ind && ind.rsi <= cfg.rsiMax && ind.roc5 <= cfg.roc5Max;

        // ── Peel action ──
        if (cfg.peelEnabled && indOk && ts >= peelCooldownUntil) {
          const n = Math.min(cfg.peelRungs, longs.length);
          let pnl = 0;
          for (let i = 0; i < n; i++) {
            const p = longs[longs.length - 1 - i];
            const fund = p.not * cfg.fund8h * ((ts - p.et) / (8 * 3600000));
            const positionPnl = (close - p.ep) * p.qty - (p.not * cfg.fee + close * p.qty * cfg.fee) - fund;
            pnl += positionPnl;
          }
          cap += pnl; peelPnl += pnl;
          longs.splice(longs.length - n, n);
          peelEvents++; peelRungsTotal += n;
          peelCooldownUntil = ts + cfg.peelCooldownMin * 60000;
        }

        // ── Short hedge action ──
        if (cfg.shortEnabled && indOk && short === null && (ts - lastHedge) / 60000 >= cfg.hedgeCooldownMin) {
          const totalNot = longs.reduce((a, p) => a + p.not, 0);
          const hedgeNot = totalNot * cfg.hedgeSizePct / 100;
          short = { ep: close, et: ts, qty: hedgeNot / close, not: hedgeNot };
          shortFires++; lastHedge = ts;
        }
      }
    }
  }

  // Close open at end
  const last = candles[candles.length - 1];
  for (const p of longs) cap += (last.close - p.ep) * p.qty - (p.not * cfg.fee + last.close * p.qty * cfg.fee);
  if (short) { const pnl = (short.ep - last.close) * short.qty - (short.not * cfg.fee + last.close * short.qty * cfg.fee); cap += pnl; shortPnl += pnl; }

  return { finalEq: cap, ret: (cap / cfg.capital - 1) * 100, maxDD, minEq, longTPs, longStales, longKills, longFlats, peelEvents, peelRungsTotal, peelPnl, shortFires, shortTPs, shortKills, shortPnl };
}

// ── Output ──
function row(label: string, r: Result) {
  const shortRate = r.shortFires > 0 ? (r.shortTPs / r.shortFires * 100).toFixed(0) + "%" : "n/a";
  return [
    `  ${label.padEnd(44)}`,
    `${("$"+r.finalEq.toFixed(0)).padStart(9)}`,
    `${((r.ret>=0?"+":"")+r.ret.toFixed(1)+"%").padStart(9)}`,
    `${(r.maxDD.toFixed(1)+"%").padStart(7)}`,
    `${("$"+r.minEq.toFixed(0)).padStart(9)}`,
    `${String(r.peelEvents).padStart(6)}`,
    `${"$"+(r.peelPnl>=0?"+":"")+r.peelPnl.toFixed(0).padStart(7)}`,
    `${String(r.shortFires).padStart(6)}`,
    `${"$"+(r.shortPnl>=0?"+":"")+r.shortPnl.toFixed(0).padStart(7)}`,
    `${shortRate.padStart(7)}`,
  ].join(" ");
}
const hdr = [
  `  ${"Config".padEnd(44)}`,
  `${"FinalEq".padStart(9)}`,
  `${"Return".padStart(9)}`,
  `${"MaxDD".padStart(7)}`,
  `${"MinEq".padStart(9)}`,
  `${"Peels".padStart(6)}`,
  `${"PeelPnL".padStart(9)}`,
  `${"Shorts".padStart(6)}`,
  `${"ShortPnL".padStart(9)}`,
  `${"TPrate".padStart(7)}`,
].join(" ");
const div = "  " + "-".repeat(120);
const SEP = "=".repeat(124);

const base: Omit<Cfg, "label"> = {
  startDate: "2024-12-06",
  base: 800, scale: 1.2, maxPos: 11, capital: 10000,
  tp: 1.4, addMin: 30, staleH: 8, reducedTp: 0.3,
  flatH: 40, flatPct: -6, killPct: -10, fee: 0.00055, fund8h: 0.0001,
  stressRungs: 9, stressPnlPct: -2.5, rsiMax: 40, roc5Max: -3.5,
  peelEnabled: false, peelRungs: 1, peelCooldownMin: 60,
  shortEnabled: false, hedgeSizePct: 20, hedgeTp: 2.0, hedgeKill: 3.0, hedgeCooldownMin: 60,
};
const base26: Omit<Cfg, "label"> = { ...base, startDate: "2026-01-01" };
const base2510: Omit<Cfg, "label"> = { ...base, startDate: "2025-10-01" };
const base257: Omit<Cfg, "label"> = { ...base, startDate: "2025-07-01" };
const base254: Omit<Cfg, "label"> = { ...base, startDate: "2025-04-01" };

// ─── Section 1: Core comparison — peel vs short vs both (Jan 2026) ───
console.log(SEP);
console.log("  PEEL SIM — Top-rung peel vs stress short (Codex Batch A, strategy #3)");
console.log("  Trigger: rungs>=9 + avgPnL<=-2.5% + RSI1h<=40 + ROC5<=-3.5%");
console.log("  Peel: close newest N rungs at market, pause re-adds X min");
console.log("  Short: 20% notional, TP=2%, kill=3%");
console.log(SEP);
console.log(hdr); console.log(div);
const bsl26 = runSim({ ...base26, label: "baseline (no hedge)" });
console.log(row("baseline (no hedge)", bsl26));
console.log(row("stress short only (current)", runSim({ ...base26, label: "", shortEnabled: true })));
console.log(row("peel 1 rung, cooldown 60m", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 1, peelCooldownMin: 60 })));
console.log(row("peel 2 rungs, cooldown 60m", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 2, peelCooldownMin: 60 })));
console.log(row("peel 1 rung, cooldown 30m", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 1, peelCooldownMin: 30 })));
console.log(row("peel 2 rungs, cooldown 30m", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 2, peelCooldownMin: 30 })));
console.log(row("peel 1 + short (combined)", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 1, shortEnabled: true })));
console.log(row("peel 2 + short (combined)", runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 2, shortEnabled: true })));

// ─── Section 2: Peel cooldown sweep ───
console.log("\n--- Peel: cooldown sweep, 1 rung (Jan 2026) ---");
console.log(hdr); console.log(div);
console.log(row("baseline", bsl26));
for (const cool of [0, 15, 30, 60, 90, 120]) {
  console.log(row(`peel 1 rung, cooldown=${cool}m`, runSim({ ...base26, label: "", peelEnabled: true, peelRungs: 1, peelCooldownMin: cool })));
}

// ─── Section 3: Peel rungs sweep ───
console.log("\n--- Peel: rungs swept, cooldown 60m (Jan 2026) ---");
console.log(hdr); console.log(div);
console.log(row("baseline", bsl26));
for (const n of [1, 2, 3]) {
  console.log(row(`peel ${n} rung(s), cooldown=60m`, runSim({ ...base26, label: "", peelEnabled: true, peelRungs: n, peelCooldownMin: 60 })));
}

// ─── Section 4: Multi-period validation — peel 1 rung, cooldown 60m ───
console.log("\n" + SEP);
console.log("  MULTI-PERIOD VALIDATION — peel 1 rung cooldown=60m vs stress short vs baseline");
console.log(SEP);
console.log(hdr); console.log(div);
for (const [label, cfg] of [
  ["Apr 2025 → Apr 2026", base254],
  ["Jul 2025 → Apr 2026", base257],
  ["Oct 2025 → Apr 2026", base2510],
  ["Jan 2026 → Apr 2026", base26],
  ["Dec 2024 → Apr 2026 (full)", base],
] as [string, typeof base][]) {
  const bsl = runSim({ ...cfg, label: "" });
  const str = runSim({ ...cfg, label: "", shortEnabled: true });
  const peel = runSim({ ...cfg, label: "", peelEnabled: true, peelRungs: 1, peelCooldownMin: 60 });
  const peel2 = runSim({ ...cfg, label: "", peelEnabled: true, peelRungs: 2, peelCooldownMin: 60 });
  console.log(row(`${label} — baseline`, bsl));
  console.log(row(`${label} — stress short`, str));
  console.log(row(`${label} — peel 1 rung`, peel));
  console.log(row(`${label} — peel 2 rungs`, peel2));
  console.log(div);
}
