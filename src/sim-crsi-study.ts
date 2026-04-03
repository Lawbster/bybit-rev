// ─────────────────────────────────────────────
// CRSI Event Study — HYPEUSDT
//
// ConnorsRSI(3,2,100) on 4H and 1H bars.
// Signal: CRSI crosses below threshold (re-arms when crosses back above rearm level).
// Measures forward returns at 4h, 8h, 24h with MFE/MAE.
// Segments by: session, day of week, funding regime.
//
// Run: npx ts-node src/sim-crsi-study.ts
// ─────────────────────────────────────────────

import fs from "fs";
import { RSI, SMA } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

const candles5m: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));
candles5m.sort((a, b) => a.timestamp - b.timestamp);

// ── CRSI implementation ──────────────────────────────────────────
function computeCrsiSeries(closes: number[], rsiPeriod = 3, streakPeriod = 2, lookback = 100): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  const minLen = Math.max(rsiPeriod + 1, streakPeriod + 1, lookback + 1);

  for (let i = minLen; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1);

    const rsi3vals = RSI.calculate({ period: rsiPeriod, values: slice });
    const rsi3 = rsi3vals[rsi3vals.length - 1];

    const streaks: number[] = [];
    let streak = 0;
    for (let j = 1; j < slice.length; j++) {
      if      (slice[j] > slice[j-1]) streak = streak > 0 ? streak + 1 : 1;
      else if (slice[j] < slice[j-1]) streak = streak < 0 ? streak - 1 : -1;
      else streak = 0;
      streaks.push(streak);
    }
    const streakRsi = RSI.calculate({ period: streakPeriod, values: streaks });
    const streakRsiVal = streakRsi[streakRsi.length - 1];

    const ret1d = (slice[slice.length-1] - slice[slice.length-2]) / slice[slice.length-2] * 100;
    const hist = slice.slice(-lookback - 1);
    const rets = hist.slice(1).map((v, k) => (v - hist[k]) / hist[k] * 100);
    const rank = rets.filter(r => r < ret1d).length / rets.length * 100;

    result[i] = +((rsi3 + streakRsiVal + rank) / 3).toFixed(2);
  }
  return result;
}

// ── Resample ────────────────────────────────────────────────────
const c4H = aggregate(candles5m, 240);
const c1H = aggregate(candles5m, 60);

// Restrict to post-launch data
const START = "2025-01-01";
const c4H_post = c4H.filter(c => new Date(c.timestamp).toISOString() >= START);
const c1H_post = c1H.filter(c => new Date(c.timestamp).toISOString() >= START);

console.log(`\n4H bars: ${c4H_post.length}  |  1H bars: ${c1H_post.length}`);

// ── Compute CRSI series ──────────────────────────────────────────
const closes4H = c4H_post.map(c => c.close);
const closes1H = c1H_post.map(c => c.close);

console.log("Computing CRSI series (this takes a moment)...");
const crsi4H = computeCrsiSeries(closes4H);
const crsi1H = computeCrsiSeries(closes1H);

// ── Forward returns helper ───────────────────────────────────────
function fwdReturns(bars: Candle[], idx: number, horizBars: number): { ret: number; mfe: number; mae: number } {
  const entry = bars[idx].close;
  const slice = bars.slice(idx + 1, idx + 1 + horizBars);
  if (slice.length === 0) return { ret: 0, mfe: 0, mae: 0 };
  const ret = (slice[slice.length - 1].close - entry) / entry * 100;
  const mfe = Math.max(...slice.map(b => (b.high  - entry) / entry * 100));
  const mae = Math.min(...slice.map(b => (b.low   - entry) / entry * 100));
  return { ret: +ret.toFixed(3), mfe: +mfe.toFixed(3), mae: +mae.toFixed(3) };
}

// ── Session label ────────────────────────────────────────────────
function session(ts: number): string {
  const h = new Date(ts).getUTCHours();
  if (h >= 0  && h < 8)  return "Asia";
  if (h >= 8  && h < 13) return "London";
  return "US";
}

function dayLabel(ts: number): string {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(ts).getUTCDay()];
}

// ── Signal detection (cross-below with re-arm) ───────────────────
interface Signal {
  ts: number;
  date: string;
  tf: string;
  crsi: number;
  session: string;
  day: string;
  ret4h: number;  ret8h: number;  ret24h: number;
  mfe4h: number;  mfe8h: number;  mfe24h: number;
  mae4h: number;  mae8h: number;  mae24h: number;
}

function detectSignals(
  bars: Candle[],
  crsiSeries: (number | null)[],
  tf: string,
  threshold: number,
  rearmLevel: number,
  barsPerH: number,   // how many bars = 1 hour
): Signal[] {
  const signals: Signal[] = [];
  let armed = true;

  for (let i = 1; i < bars.length; i++) {
    const prev = crsiSeries[i - 1];
    const curr = crsiSeries[i];
    if (prev === null || curr === null) continue;

    // Re-arm when CRSI rises back above rearmLevel
    if (!armed && curr >= rearmLevel) armed = true;

    // Signal: crossing below threshold while armed
    if (armed && prev >= threshold && curr < threshold) {
      armed = false;

      const horiz4h  = barsPerH * 4;
      const horiz8h  = barsPerH * 8;
      const horiz24h = barsPerH * 24;

      // Need enough forward bars
      if (i + horiz24h >= bars.length) continue;

      const f4  = fwdReturns(bars, i, horiz4h);
      const f8  = fwdReturns(bars, i, horiz8h);
      const f24 = fwdReturns(bars, i, horiz24h);

      signals.push({
        ts: bars[i].timestamp,
        date: new Date(bars[i].timestamp).toISOString().slice(0, 16),
        tf,
        crsi: curr,
        session: session(bars[i].timestamp),
        day: dayLabel(bars[i].timestamp),
        ret4h: f4.ret, ret8h: f8.ret, ret24h: f24.ret,
        mfe4h: f4.mfe, mfe8h: f8.mfe, mfe24h: f24.mfe,
        mae4h: f4.mae, mae8h: f8.mae, mae24h: f24.mae,
      });
    }
  }
  return signals;
}

// ── Run for both timeframes ──────────────────────────────────────
const THRESHOLD  = 20;
const REARM      = 30;

const sigs4H = detectSignals(c4H_post, crsi4H, "4H", THRESHOLD, REARM, 1);   // 1 bar = 4h, so 4h = 1 bar... wait
// 4H bars: 1 bar = 4h → horiz4h = 1, horiz8h = 2, horiz24h = 6
// But fwdReturns uses barsPerH → need to pass correctly
// Re-run with correct barsPerH:
const sigs4H_v2 = detectSignals(c4H_post, crsi4H, "4H", THRESHOLD, REARM, 0.25); // 0.25 bars per hour → 4h = 1 bar
// Actually simpler to just hardcode horizons in bars:

// Let's redo with explicit bar counts
function detectSignalsV2(
  bars: Candle[],
  crsiSeries: (number | null)[],
  tf: string,
  threshold: number,
  rearmLevel: number,
  h4bars: number,   // bars in 4h window
  h8bars: number,
  h24bars: number,
): Signal[] {
  const signals: Signal[] = [];
  let armed = true;

  for (let i = 1; i < bars.length; i++) {
    const prev = crsiSeries[i - 1];
    const curr = crsiSeries[i];
    if (prev === null || curr === null) continue;

    if (!armed && curr >= rearmLevel) armed = true;

    if (armed && prev >= threshold && curr < threshold) {
      armed = false;
      if (i + h24bars >= bars.length) continue;

      const f4  = fwdReturns(bars, i, h4bars);
      const f8  = fwdReturns(bars, i, h8bars);
      const f24 = fwdReturns(bars, i, h24bars);

      signals.push({
        ts: bars[i].timestamp,
        date: new Date(bars[i].timestamp).toISOString().slice(0, 16),
        tf,
        crsi: curr,
        session: session(bars[i].timestamp),
        day: dayLabel(bars[i].timestamp),
        ret4h: f4.ret, ret8h: f8.ret, ret24h: f24.ret,
        mfe4h: f4.mfe, mfe8h: f8.mfe, mfe24h: f24.mfe,
        mae4h: f4.mae, mae8h: f8.mae, mae24h: f24.mae,
      });
    }
  }
  return signals;
}

const signals4H = detectSignalsV2(c4H_post, crsi4H, "4H", THRESHOLD, REARM, 1, 2, 6);
const signals1H = detectSignalsV2(c1H_post, crsi1H, "1H", THRESHOLD, REARM, 4, 8, 24);

// ── Analysis helpers ─────────────────────────────────────────────
const avg   = (arr: number[]) => arr.length ? arr.reduce((s,v) => s+v, 0) / arr.length : 0;
const posPct = (arr: number[]) => arr.length ? arr.filter(v => v > 0).length / arr.length * 100 : 0;
const p = (n: number, d = 2) => (n >= 0 ? "+" : "") + n.toFixed(d) + "%";

function printSlice(label: string, sigs: Signal[]) {
  if (sigs.length === 0) { console.log(`  ${label.padEnd(22)} N=0`); return; }
  const r4  = sigs.map(s => s.ret4h);
  const r8  = sigs.map(s => s.ret8h);
  const r24 = sigs.map(s => s.ret24h);
  const mfe8 = avg(sigs.map(s => s.mfe8h));
  const mae8 = avg(sigs.map(s => s.mae8h));
  console.log(
    `  ${label.padEnd(22)} N=${String(sigs.length).padEnd(3)}` +
    `  pos4h=${posPct(r4).toFixed(0).padStart(3)}%` +
    `  ret4h=${p(avg(r4)).padStart(7)}` +
    `  ret8h=${p(avg(r8)).padStart(7)}` +
    `  ret24h=${p(avg(r24)).padStart(7)}` +
    `  mfe8h=${p(mfe8).padStart(7)}` +
    `  mae8h=${p(mae8).padStart(7)}`
  );
}

function analyse(tf: string, sigs: Signal[]) {
  const SEP = "─".repeat(110);
  console.log(`\n${"═".repeat(110)}`);
  console.log(`  CRSI < ${THRESHOLD} Event Study — ${tf}  |  N=${sigs.length}  |  ${new Date(sigs[0]?.ts ?? 0).toISOString().slice(0,10)} → ${new Date(sigs[sigs.length-1]?.ts ?? 0).toISOString().slice(0,10)}`);
  console.log(`${"═".repeat(110)}`);

  console.log(`\n  ${"Slice".padEnd(22)} ${"N".padEnd(5)} ${"pos4h%".padEnd(8)} ${"ret4h".padEnd(9)} ${"ret8h".padEnd(9)} ${"ret24h".padEnd(9)} ${"mfe8h".padEnd(9)} ${"mae8h"}`);
  console.log("  " + SEP);

  // All
  printSlice("ALL", sigs);

  // By session
  console.log(`\n  ── By session ──`);
  for (const sess of ["Asia", "London", "US"]) {
    printSlice(sess, sigs.filter(s => s.session === sess));
  }

  // By day
  console.log(`\n  ── By day ──`);
  for (const d of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
    const sub = sigs.filter(s => s.day === d);
    if (sub.length > 0) printSlice(d, sub);
  }

  // By CRSI depth (how oversold)
  console.log(`\n  ── By CRSI depth at signal ──`);
  printSlice("CRSI 15-20", sigs.filter(s => s.crsi >= 15));
  printSlice("CRSI 10-15", sigs.filter(s => s.crsi >= 10 && s.crsi < 15));
  printSlice("CRSI < 10",  sigs.filter(s => s.crsi < 10));

  // US session by day
  console.log(`\n  ── US session by day ──`);
  for (const d of ["Mon","Tue","Wed","Thu","Fri"]) {
    const sub = sigs.filter(s => s.session === "US" && s.day === d);
    if (sub.length > 0) printSlice(`US-${d}`, sub);
  }

  // Individual events
  console.log(`\n  ── All signals ──`);
  console.log(`  ${"Date".padEnd(18)} ${"Sess".padEnd(8)} ${"Day".padEnd(5)} ${"CRSI".padEnd(7)} ${"ret4h".padEnd(9)} ${"ret8h".padEnd(9)} ${"ret24h".padEnd(9)} ${"mfe8h".padEnd(9)} ${"mae8h"}`);
  console.log("  " + SEP);
  for (const s of sigs) {
    console.log(
      `  ${s.date.padEnd(18)} ${s.session.padEnd(8)} ${s.day.padEnd(5)}` +
      `  ${s.crsi.toFixed(1).padStart(5)}` +
      `  ${p(s.ret4h).padStart(8)}  ${p(s.ret8h).padStart(8)}  ${p(s.ret24h).padStart(8)}` +
      `  ${p(s.mfe8h).padStart(8)}  ${p(s.mae8h).padStart(8)}`
    );
  }
}

analyse("4H", signals4H);
analyse("1H", signals1H);

// ── US session combined view (1H signals filtered to US) ─────────
const us1H = signals1H.filter(s => s.session === "US");
const us4H = signals4H.filter(s => s.session === "US");
console.log(`\n${"═".repeat(60)}`);
console.log(`  Quick summary`);
console.log(`${"═".repeat(60)}`);
console.log(`  4H signals total: ${signals4H.length}  |  US only: ${us4H.length}`);
console.log(`  1H signals total: ${signals1H.length}  |  US only: ${us1H.length}`);
if (us4H.length) {
  console.log(`  4H US pos8h: ${posPct(us4H.map(s=>s.ret8h)).toFixed(0)}%  avg ret8h: ${p(avg(us4H.map(s=>s.ret8h)))}`);
}
if (us1H.length) {
  console.log(`  1H US pos8h: ${posPct(us1H.map(s=>s.ret8h)).toFixed(0)}%  avg ret8h: ${p(avg(us1H.map(s=>s.ret8h)))}`);
}
console.log();
