// ─────────────────────────────────────────────
// Zone Fresh-Touch Event Study — HYPEUSDT (then multi-pair)
//
// Implements Codex spec: CODEX_FRESH_TOUCH_EVENT_STUDY_SPEC.md
//
// For each support zone, detects "fresh touch" events:
//   - first 5m candle whose low <= zone.high
//   - previous 5m candle had low > zone.high
//   - last prior zone interaction >= 24h ago
//   - max high since last interaction >= zone.high * 1.02
//   - at least one 5m close since last interaction >= zone.high * 1.005
//
// Outputs one JSONL row per event with full schema from spec.
// No trade sim in this file — purely event study.
//
// Usage:
//   npx ts-node src/sim-zone-event-study.ts HYPEUSDT
//   npx ts-node src/sim-zone-event-study.ts BTCUSDT
// ─────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";

const SYMBOL    = process.argv[2] || "HYPEUSDT";
const START_DATE = process.argv[3] || "2025-01-01";
const SEP = "=".repeat(110);

// ── Load candles ──
function loadCandles(symbol: string): Candle[] {
  const dataDir = path.resolve(__dirname, "../data");
  const full = path.join(dataDir, `${symbol}_5_full.json`);
  const std  = path.join(dataDir, `${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;
  if (!file) throw new Error(`No 5m data for ${symbol}`);
  const c: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  c.sort((a, b) => a.timestamp - b.timestamp);
  return c;
}

// ── Resample to daily ──
interface DailyBar {
  date: string; ts: number;
  open: number; high: number; low: number; close: number;
  volume: number; turnover: number;
}
function toDailyBars(candles: Candle[]): DailyBar[] {
  const map = new Map<string, DailyBar>();
  for (const c of candles) {
    const date = new Date(c.timestamp).toISOString().slice(0, 10);
    if (!map.has(date)) {
      map.set(date, { date, ts: new Date(date + "T00:00:00Z").getTime(), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover });
    } else {
      const d = map.get(date)!;
      if (c.high > d.high) d.high = c.high;
      if (c.low  < d.low)  d.low  = c.low;
      d.close    = c.close;
      d.volume  += c.volume;
      d.turnover += c.turnover;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ts - b.ts);
}

// ── Swing low pivot detection ──
function findSwingLows(bars: DailyBar[], wing: number) {
  const pivots: { idx: number; price: number; date: string }[] = [];
  for (let i = wing; i < bars.length - wing; i++) {
    const lo = bars[i].low;
    let isPivot = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j !== i && bars[j].low <= lo) { isPivot = false; break; }
    }
    if (isPivot) pivots.push({ idx: i, price: lo, date: bars[i].date });
  }
  return pivots;
}

// ── Zone clustering ──
interface Zone {
  id: string;
  midpoint: number; low: number; high: number;
  touches: number;
  firstDate: string; lastTouchDate: string;
  broken: boolean; brokenDate: string | null;
  formationTs: number;
}
function buildZones(
  pivots: { idx: number; price: number; date: string }[],
  clusterPct: number, bandHalfPct: number, minTouches: number,
): Zone[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const raw: Zone[] = [];
  let idCounter = 0;
  for (const p of sorted) {
    let merged = false;
    for (const z of raw) {
      if (Math.abs(p.price - z.midpoint) / z.midpoint * 100 <= clusterPct) {
        z.midpoint = (z.midpoint * z.touches + p.price) / (z.touches + 1);
        z.touches++;
        z.low  = z.midpoint * (1 - bandHalfPct / 100);
        z.high = z.midpoint * (1 + bandHalfPct / 100);
        if (p.date > z.lastTouchDate) z.lastTouchDate = p.date;
        if (p.date < z.firstDate)     { z.firstDate = p.date; z.formationTs = new Date(p.date + "T00:00:00Z").getTime(); }
        merged = true; break;
      }
    }
    if (!merged) {
      raw.push({ id: `z${++idCounter}`, midpoint: p.price, low: p.price * (1 - bandHalfPct/100), high: p.price * (1 + bandHalfPct/100), touches: 1, firstDate: p.date, lastTouchDate: p.date, broken: false, brokenDate: null, formationTs: new Date(p.date + "T00:00:00Z").getTime() });
    }
  }
  return raw.filter(z => z.touches >= minTouches);
}

// ── Session tag ──
function session(ts: number): string {
  const h = new Date(ts).getUTCHours();
  if (h <  8) return "asia";
  if (h < 13) return "london";
  if (h < 22) return "us";
  return "late";
}

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Touch type ──
function touchType(c: Candle, zoneHigh: number, zoneLow: number): string {
  if (c.close > zoneHigh) return "wick_touch_only";
  if (c.close >= zoneLow) return "close_inside_zone";
  return "close_below_zone";
}

// ── Forward outcome computation ──
function forwardOutcomes(candles: Candle[], fromIdx: number, touchClose: number) {
  const horizons = [4, 8, 24];
  const out: Record<string, number> = {};
  for (const h of horizons) {
    const endTs = candles[fromIdx].timestamp + h * 3600000;
    let mfe = 0, mae = 0, retClose = touchClose;
    for (let j = fromIdx + 1; j < candles.length && candles[j].timestamp <= endTs; j++) {
      const upMove   = (candles[j].high  - touchClose) / touchClose * 100;
      const downMove = (candles[j].low   - touchClose) / touchClose * 100;
      if (upMove   > mfe) mfe = upMove;
      if (downMove < mae) mae = downMove;
      retClose = candles[j].close;
    }
    out[`ret${h}hPct`]  = (retClose - touchClose) / touchClose * 100;
    out[`mfe${h}hPct`]  = mfe;
    out[`mae${h}hPct`]  = mae;
  }
  return out;
}

// ── Main event study ──
function runEventStudy(symbol: string, candles5m: Candle[], dailyBars: DailyBar[], startDate: string): object[] {
  const startMs    = new Date(startDate + "T00:00:00Z").getTime();
  const allPivots  = findSwingLows(dailyBars, 3);
  const events: object[] = [];

  // Per-zone interaction state
  interface ZoneState {
    lastInteractionTs: number;        // ts of last candle where low <= zone.high
    maxHighSinceLast: number;
    hadCloseAboveBuffer: boolean;     // any close >= zone.high * 1.005
    inZone: boolean;                  // true while price is actively inside/touching zone
  }

  // Process each candle in time order
  // For each candle, rebuild zones known as of that point (no lookahead)
  // For efficiency: rebuild zones once per day only

  let currentZones: Zone[] = [];
  let currentDayIdx = -1;
  const zoneState = new Map<string, ZoneState>();

  const prevDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  for (let i = 0; i < candles5m.length; i++) {
    const c = candles5m[i];
    if (c.timestamp < startMs) continue;

    const date    = new Date(c.timestamp).toISOString().slice(0, 10);
    const dayIdx  = dailyBars.findIndex(b => b.date >= date) - 1;

    // Rebuild zones once per day (as of previous day's close)
    if (dayIdx !== currentDayIdx && dayIdx >= 6) {
      currentDayIdx = dayIdx;
      const availPivots = allPivots.filter(p => p.date < date);
      if (availPivots.length === 0) continue;

      const newZones = buildZones(availPivots, 2.0, 1.0, 2);

      // Mark broken: any zone whose midpoint a prior daily bar closed below
      for (const z of newZones) {
        for (const b of dailyBars.slice(0, dayIdx + 1)) {
          if (b.date <= z.firstDate) continue;
          if (b.close < z.midpoint * (1 - 2.0 / 100)) {
            z.broken = true;
            z.brokenDate = b.date;
            break;
          }
        }
      }

      // Add new zones to state tracking, preserve existing state
      for (const z of newZones.filter(z => !z.broken)) {
        if (!zoneState.has(z.id)) {
          zoneState.set(z.id, {
            lastInteractionTs: z.formationTs,
            maxHighSinceLast: 0,
            hadCloseAboveBuffer: false,
            inZone: false,
          });
        }
      }
      currentZones = newZones.filter(z => !z.broken);
    }

    if (currentZones.length === 0) continue;

    for (const z of currentZones) {
      const st = zoneState.get(z.id);
      if (!st) continue;

      const touching = c.low <= z.high;

      if (!touching) {
        // Track excursion state while price is away from zone
        if (c.high > st.maxHighSinceLast) st.maxHighSinceLast = c.high;
        if (c.close >= z.high * 1.005)    st.hadCloseAboveBuffer = true;
        st.inZone = false;
        continue;
      }

      // ── Price is touching zone (low <= zone.high) ──
      const prevC = i > 0 ? candles5m[i - 1] : null;
      const prevNotTouching = prevC ? prevC.low > z.high : true;
      const hoursSinceLast  = (c.timestamp - st.lastInteractionTs) / 3600000;
      const maxExcursionPct = st.maxHighSinceLast > 0
        ? (st.maxHighSinceLast - z.high) / z.high * 100 : 0;

      // Fresh touch check
      const isFresh = (
        prevNotTouching &&
        hoursSinceLast >= 24 &&
        st.maxHighSinceLast >= z.high * 1.02 &&
        st.hadCloseAboveBuffer
      );

      if (isFresh) {
        // ── Compute approach metrics ──
        // Scan backwards from this candle to last interaction to find peak close
        let peakClose = 0, peakCloseTs = st.lastInteractionTs;
        for (let j = i - 1; j >= 0; j--) {
          if (candles5m[j].timestamp <= st.lastInteractionTs) break;
          if (candles5m[j].close > peakClose) {
            peakClose    = candles5m[j].close;
            peakCloseTs  = candles5m[j].timestamp;
          }
        }
        if (peakClose === 0) peakClose = c.close; // fallback

        const approachDistancePct    = (peakClose - c.close) / peakClose * 100;
        const hoursFromPeakToTouch   = Math.max((c.timestamp - peakCloseTs) / 3600000, 0.083);
        const approachSpeedPctPerHour = approachDistancePct / hoursFromPeakToTouch;

        // Touch-candle metrics
        const touchRangePct           = (c.high - c.low) / c.open * 100;
        const touchBodyPct            = Math.abs(c.close - c.open) / c.open * 100;
        const touchLowerWickPct       = (Math.min(c.close, c.open) - c.low) / c.open * 100;
        const touchCloseLocationInZone = (c.close - z.low) / (z.high - z.low) * 100;

        // Forward outcomes
        const fwd = forwardOutcomes(candles5m, i, c.close);

        const event = {
          // Identity
          symbol,
          eventTs:        c.timestamp,
          eventDate:      date,
          zoneId:         z.id,
          zoneMid:        +z.midpoint.toFixed(6),
          zoneLow:        +z.low.toFixed(6),
          zoneHigh:       +z.high.toFixed(6),
          zoneTouches:    z.touches,
          zoneFirstDate:  z.firstDate,
          // Re-arm state
          hoursSinceLastInteraction:        +hoursSinceLast.toFixed(1),
          maxHighSinceLastInteraction:      +st.maxHighSinceLast.toFixed(6),
          maxExcursionPctSinceLastInteraction: +maxExcursionPct.toFixed(2),
          hadCloseAboveRearmBuffer:         st.hadCloseAboveBuffer,
          // Approach metrics
          peakCloseSinceLastInteraction:    +peakClose.toFixed(6),
          peakCloseTs,
          approachDistancePct:              +approachDistancePct.toFixed(2),
          approachSpeedPctPerHour:          +approachSpeedPctPerHour.toFixed(4),
          // Touch-candle metrics
          touchOpen:                        c.open,
          touchHigh:                        c.high,
          touchLow:                         c.low,
          touchClose:                       c.close,
          touchTurnover:                    +c.turnover.toFixed(2),
          touchRangePct:                    +touchRangePct.toFixed(2),
          touchBodyPct:                     +touchBodyPct.toFixed(2),
          touchLowerWickPct:               +touchLowerWickPct.toFixed(2),
          touchCloseLocationInZonePct:     +touchCloseLocationInZone.toFixed(1),
          touchType:                        touchType(c, z.high, z.low),
          // Context
          session:    session(c.timestamp),
          dayOfWeek:  DOW[new Date(c.timestamp).getUTCDay()],
          // Forward outcomes
          ...fwd,
        };

        events.push(event);
      }

      // Update interaction state (whether or not fresh)
      if (!st.inZone) {
        // Transitioning INTO zone — update last interaction and reset excursion tracking
        st.lastInteractionTs   = c.timestamp;
        st.maxHighSinceLast    = 0;
        st.hadCloseAboveBuffer = false;
        st.inZone              = true;
      } else {
        st.lastInteractionTs = c.timestamp;
      }
    }
  }

  return events;
}

// ── Run + print summary ──
console.log("\n" + SEP);
console.log(`  Zone Fresh-Touch Event Study — ${SYMBOL}  (start: ${START_DATE})`);
console.log(SEP);

const candles5m  = loadCandles(SYMBOL);
const dailyBars  = toDailyBars(candles5m);
console.log(`\n  Data: ${candles5m.length} 5m candles | ${dailyBars.length} daily bars`);

const events = runEventStudy(SYMBOL, candles5m, dailyBars, START_DATE);

// Save JSONL
const outPath = path.resolve(__dirname, `../data/${SYMBOL}_zone_events.jsonl`);
fs.writeFileSync(outPath, events.map(e => JSON.stringify(e)).join("\n"));
console.log(`  Events written: ${events.length} → ${outPath}\n`);

if (events.length === 0) {
  console.log("  No fresh-touch events found. Check zone detection and date range.");
  process.exit(0);
}

// ── Console summary ──
const ev = events as any[];

function stats(vals: number[]) {
  if (vals.length === 0) return { n: 0, mean: 0, median: 0, pos: 0 };
  const sorted = [...vals].sort((a, b) => a - b);
  return {
    n:      vals.length,
    mean:   +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
    pos:    +(vals.filter(v => v > 0).length / vals.length * 100).toFixed(0),
  };
}

function printStats(label: string, subset: any[]) {
  if (subset.length === 0) { console.log(`  ${label}: no events`); return; }
  const r4  = stats(subset.map(e => e.ret4hPct));
  const r8  = stats(subset.map(e => e.ret8hPct));
  const r24 = stats(subset.map(e => e.ret24hPct));
  const mfe8 = stats(subset.map(e => e.mfe8hPct));
  const mae8 = stats(subset.map(e => e.mae8hPct));
  const spd  = stats(subset.map(e => e.approachSpeedPctPerHour));
  const dist = stats(subset.map(e => e.approachDistancePct));
  console.log(`  ${label} (n=${subset.length})`);
  console.log(`    ret4h:  mean=${r4.mean}%  median=${r4.median}%  pos%=${r4.pos}%`);
  console.log(`    ret8h:  mean=${r8.mean}%  median=${r8.median}%  pos%=${r8.pos}%`);
  console.log(`    ret24h: mean=${r24.mean}%  median=${r24.median}%  pos%=${r24.pos}%`);
  console.log(`    mfe8h:  mean=${mfe8.mean}%    mae8h: mean=${mae8.mean}%`);
  console.log(`    approachDist: mean=${dist.mean}%  approachSpeed: mean=${spd.mean}%/h`);
}

console.log("\n" + "─".repeat(80));
console.log("  ALL FRESH-TOUCH EVENTS");
console.log("─".repeat(80));
printStats("All sessions", ev);

console.log("\n" + "─".repeat(80));
console.log("  BY SESSION");
console.log("─".repeat(80));
for (const sess of ["asia", "london", "us", "late"]) {
  printStats(sess, ev.filter(e => e.session === sess));
}

console.log("\n" + "─".repeat(80));
console.log("  BY TOUCH TYPE");
console.log("─".repeat(80));
for (const tt of ["wick_touch_only", "close_inside_zone", "close_below_zone"]) {
  printStats(tt, ev.filter(e => e.touchType === tt));
}

console.log("\n" + "─".repeat(80));
console.log("  BY APPROACH SPEED (quartiles)");
console.log("─".repeat(80));
const speeds = ev.map(e => e.approachSpeedPctPerHour).sort((a, b) => a - b);
const q25 = speeds[Math.floor(speeds.length * 0.25)];
const q75 = speeds[Math.floor(speeds.length * 0.75)];
printStats(`slow approach  (speed < ${q25.toFixed(2)}%/h)`, ev.filter(e => e.approachSpeedPctPerHour < q25));
printStats(`fast approach  (speed > ${q75.toFixed(2)}%/h)`, ev.filter(e => e.approachSpeedPctPerHour > q75));

console.log("\n" + "─".repeat(80));
console.log("  BY DAY OF WEEK");
console.log("─".repeat(80));
for (const d of ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]) {
  const sub = ev.filter(e => e.dayOfWeek === d);
  if (sub.length > 0) printStats(d, sub);
}

console.log("\n" + "─".repeat(80));
console.log("  FULL EVENT LOG");
console.log("─".repeat(80));
console.log(`  ${"Date".padEnd(12)} ${"DOW".padEnd(4)} ${"Sess".padEnd(7)} ${"Zone".padStart(10)} ${"Dist%".padStart(7)} ${"Spd%/h".padStart(8)} ${"Type".padEnd(18)} ${"ret4h".padStart(7)} ${"ret8h".padStart(7)} ${"ret24h".padStart(7)} ${"mfe8h".padStart(7)} ${"mae8h".padStart(7)}`);
console.log("  " + "─".repeat(105));
for (const e of ev) {
  const dist = (e.approachDistancePct >= 0 ? "+" : "") + e.approachDistancePct.toFixed(1) + "%";
  const spd  = e.approachSpeedPctPerHour.toFixed(2);
  const r4   = (e.ret4hPct  >= 0 ? "+" : "") + e.ret4hPct.toFixed(1)  + "%";
  const r8   = (e.ret8hPct  >= 0 ? "+" : "") + e.ret8hPct.toFixed(1)  + "%";
  const r24  = (e.ret24hPct >= 0 ? "+" : "") + e.ret24hPct.toFixed(1) + "%";
  const mfe8 = "+" + e.mfe8hPct.toFixed(1) + "%";
  const mae8 = e.mae8hPct.toFixed(1) + "%";
  console.log(`  ${e.eventDate.padEnd(12)} ${e.dayOfWeek.padEnd(4)} ${e.session.padEnd(7)} ${"$"+e.zoneMid.toFixed(2).padStart(9)} ${dist.padStart(7)} ${spd.padStart(8)} ${e.touchType.padEnd(18)} ${r4.padStart(7)} ${r8.padStart(7)} ${r24.padStart(7)} ${mfe8.padStart(7)} ${mae8.padStart(7)}`);
}
