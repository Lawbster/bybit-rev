/**
 * Causal audit of user-marked 4h candles preceding material HYPE declines.
 *
 * Timestamp discipline:
 * - the supplied TradingView timestamps are Europe/Oslo summer time (UTC+2);
 * - each timestamp is treated as the START of a 4h candle;
 * - features at T use only source observations/candles strictly before T;
 * - outcomes may use candles stamped T and later.
 *
 * This is research-only. It writes ledgers/rankings under backtests/ and does
 * not import any executor or mutate live configuration/state.
 */

import fs from "fs";
import path from "path";
import { EMA } from "technicalindicators";
import {
  ROOT,
  ensureDir,
  iso,
  r,
  streamJsonl,
  writeCsv,
  type Candle,
} from "./hype-freerun-canonical-replay";

const MIN = 60_000;
const HOUR = 60 * MIN;
const FOUR_HOURS = 4 * HOUR;
const DAY = 24 * HOUR;
const START = Date.parse("2026-06-01T00:00:00Z");
const OUT = path.join(ROOT, "backtests", "hype", "user-drop-precursor-2026-08-14");
const FEATURE_CSV = path.join(OUT, "short-study", "decision-features.csv");
const SELECTED_TRADES_CSV = path.join(OUT, "short-study", "selected-trades.csv");
const PRICE_FILE = path.join(ROOT, "data", "HYPEUSDT_1m.jsonl");

const EVENT_LOCAL = [
  "2026-06-02T02:00:00+02:00",
  "2026-06-04T02:00:00+02:00",
  "2026-06-08T14:00:00+02:00",
  "2026-06-10T14:00:00+02:00",
  "2026-06-12T18:00:00+02:00",
  "2026-06-16T14:00:00+02:00",
  "2026-06-17T18:00:00+02:00",
  "2026-06-22T18:00:00+02:00",
  "2026-06-29T22:00:00+02:00",
  "2026-07-04T06:00:00+02:00",
  "2026-07-06T02:00:00+02:00",
  "2026-07-07T14:00:00+02:00",
  "2026-07-10T10:00:00+02:00",
  "2026-07-12T22:00:00+02:00",
  "2026-07-15T14:00:00+02:00",
  "2026-07-21T10:00:00+02:00",
  "2026-07-23T14:00:00+02:00",
  "2026-07-24T14:00:00+02:00",
  "2026-07-27T10:00:00+02:00",
  "2026-07-31T02:00:00+02:00",
  "2026-07-31T14:00:00+02:00",
  "2026-08-05T18:00:00+02:00",
  "2026-08-07T10:00:00+02:00",
  "2026-08-09T02:00:00+02:00", // user marked "iffy"
  "2026-08-10T18:00:00+02:00",
  "2026-08-13T14:00:00+02:00",
] as const;

const EVENT_TS = EVENT_LOCAL.map(Date.parse);
const EVENT_SET = new Set(EVENT_TS);

type Decision = Record<string, number | boolean | string | null> & { ts: number; price: number };
type Zone = { price: number; touches: number; highTouches: number; lowTouches: number };
type AuditRow = Record<string, any> & {
  ts: number;
  isUserEvent: boolean;
  price: number;
  objectiveDrop2_12h: boolean;
  objectiveDrop3_24h: boolean;
};
type Rule = { id: string; family: string; description: string; test: (x: AuditRow) => boolean };

function bool(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function scalar(value: string): number | boolean | string | null {
  const b = bool(value);
  if (b !== null) return b;
  if (value === "" || value === "NaN" || value === "null" || value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function loadDecisionFeatures(): Map<number, Decision> {
  const lines = fs.readFileSync(FEATURE_CSV, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const out = new Map<number, Decision>();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const raw: Record<string, any> = {};
    for (let j = 0; j < header.length; j++) raw[header[j]] = scalar(cells[j] ?? "");
    const ts = Date.parse(String(raw.ts));
    const price = Number(raw.price);
    if (Number.isFinite(ts) && Number.isFinite(price)) out.set(ts, { ...raw, ts, price });
  }
  return out;
}

function loadCsvRows(file: string): Record<string, string>[] {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cells = line.split(",");
    return Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""]));
  });
}

async function loadPrices(): Promise<Candle[]> {
  const out: Candle[] = [];
  await streamJsonl(PRICE_FILE, row => {
    const ts = Number(row.ts);
    const open = Number(row.o), high = Number(row.h), low = Number(row.l), close = Number(row.c);
    if (![ts, open, high, low, close].every(Number.isFinite)) return;
    out.push({ ts, endTs: ts + MIN, open, high, low, close, volume: Number(row.v) || 0, turnover: Number(row.t) || 0 });
  });
  return out.sort((a, b) => a.ts - b.ts);
}

function lowerBound<T>(rows: T[], target: number, pick: (x: T) => number): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pick(rows[mid]) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function aggregate(candles: Candle[], bucketMs: number): Candle[] {
  const out: Candle[] = [];
  let current: Candle | null = null;
  for (const c of candles) {
    const ts = Math.floor(c.ts / bucketMs) * bucketMs;
    if (!current || current.ts !== ts) {
      const next: Candle = { ts, endTs: ts + bucketMs, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover };
      current = next;
      out.push(next);
    } else {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
      current.volume += c.volume;
      current.turnover += c.turnover;
    }
  }
  return out;
}

function buildEmaMap(tf4h: Candle[], period: number): Map<number, number> {
  const closes = tf4h.map(x => x.close);
  const values = EMA.calculate({ period, values: closes });
  const out = new Map<number, number>();
  const offset = period - 1;
  for (let i = 0; i < values.length; i++) out.set(tf4h[i + offset].endTs, values[i]);
  return out;
}

function buildPivots(tf30: Candle[]) {
  const pivots: Array<{ confirmTs: number; price: number; side: "high" | "low" }> = [];
  for (let i = 4; i < tf30.length - 4; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - 4; j <= i + 4; j++) {
      if (i === j) continue;
      if (tf30[j].high >= tf30[i].high) isHigh = false;
      if (tf30[j].low <= tf30[i].low) isLow = false;
    }
    const confirmTs = tf30[i + 4].endTs;
    if (isHigh) pivots.push({ confirmTs, price: tf30[i].high, side: "high" });
    if (isLow) pivots.push({ confirmTs, price: tf30[i].low, side: "low" });
  }
  return pivots.sort((a, b) => a.confirmTs - b.confirmTs);
}

/** Exact live clustering order/threshold, rebuilt from the causal 14d pivot window. */
function zonesAt(pivots: ReturnType<typeof buildPivots>, ts: number): Zone[] {
  const active = pivots.filter(p => p.confirmTs >= ts - 14 * DAY && p.confirmTs <= ts);
  const levels: Array<{ price: number; touches: number; highTouches: number; lowTouches: number }> = [];
  for (const p of active) {
    let target: typeof levels[number] | null = null;
    for (const lv of levels) {
      if (Math.abs(lv.price - p.price) / lv.price <= 0.0045) { target = lv; break; }
    }
    if (!target) {
      target = { price: p.price, touches: 0, highTouches: 0, lowTouches: 0 };
      levels.push(target);
    }
    target.price = (target.price * target.touches + p.price) / (target.touches + 1);
    target.touches++;
    if (p.side === "high") target.highTouches++;
    else target.lowTouches++;
  }
  return levels.filter(x => x.touches >= 2).sort((a, b) => a.price - b.price);
}

function zoneContext(zones: Zone[], price: number) {
  const resistance = zones.filter(z => z.price > price).sort((a, b) => a.price - b.price)[0] ?? null;
  const support = zones.filter(z => z.price < price).sort((a, b) => b.price - a.price)[0] ?? null;
  const nearest = [...zones].sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))[0] ?? null;
  return {
    zoneCount: zones.length,
    resistancePrice: resistance?.price ?? null,
    resistanceDistPct: resistance ? ((resistance.price - price) / price) * 100 : null,
    resistanceTouches: resistance?.touches ?? null,
    resistanceHighTouches: resistance?.highTouches ?? null,
    supportPrice: support?.price ?? null,
    supportDistPct: support ? ((price - support.price) / price) * 100 : null,
    supportTouches: support?.touches ?? null,
    supportLowTouches: support?.lowTouches ?? null,
    nearestZonePrice: nearest?.price ?? null,
    nearestZoneDistSignedPct: nearest ? ((nearest.price - price) / price) * 100 : null,
    nearestZoneTouches: nearest?.touches ?? null,
  };
}

function outcomes(prices: Candle[], ts: number, entry: number) {
  const from = lowerBound(prices, ts, x => x.ts);
  const calc = (hours: number) => {
    const to = lowerBound(prices, ts + hours * HOUR, x => x.ts);
    const win = prices.slice(from, to);
    const min = win.length ? Math.min(...win.map(x => x.low)) : entry;
    const max = win.length ? Math.max(...win.map(x => x.high)) : entry;
    const close = win.length ? win[win.length - 1].close : entry;
    return {
      [`minRet${hours}h`]: ((min - entry) / entry) * 100,
      [`maxRet${hours}h`]: ((max - entry) / entry) * 100,
      [`closeRet${hours}h`]: ((close - entry) / entry) * 100,
    };
  };
  return { ...calc(4), ...calc(8), ...calc(12), ...calc(24) };
}

function num(x: AuditRow, key: string): number | null {
  const value = Number(x[key]);
  return Number.isFinite(value) ? value : null;
}

function yes(x: AuditRow, key: string): boolean { return x[key] === true; }

function candidateRules(): Rule[] {
  const nle = (x: AuditRow, k: string, v: number) => { const n = num(x, k); return n !== null && n <= v; };
  const nge = (x: AuditRow, k: string, v: number) => { const n = num(x, k); return n !== null && n >= v; };
  const resistance = (x: AuditRow, v: number) => { const n = num(x, "resistanceDistPct"); return n !== null && n <= v; };
  const short = (x: AuditRow) => yes(x, "red15") && yes(x, "breakPrev15Low") && nle(x, "ret15", -0.20)
    && nle(x, "hlTaker15", 0.90) && nle(x, "hlOb5", -0.05) && nle(x, "hlObDelta", -0.15);
  return [
    { id: "live_short_exact_boundary", family: "control", description: "Frozen live short inputs already true at 4h boundary", test: short },
    { id: "completed_15m_break", family: "control", description: "Red completed 15m break with ret<=-0.2", test: x => yes(x, "red15") && yes(x, "breakPrev15Low") && nle(x, "ret15", -0.20) },
    { id: "hl_sell_15m_0p85", family: "flow", description: "HL taker ratio <=0.85", test: x => nle(x, "hlTaker15", 0.85) },
    { id: "hl_sell_1h_0p90", family: "flow", description: "HL taker ratio <=0.90", test: x => nle(x, "hlTaker60", 0.90) },
    { id: "hl_book_pull", family: "book", description: "HL book ask-heavy and deteriorating", test: x => nle(x, "hlOb5", -0.05) && nle(x, "hlObDelta", -0.15) },
    { id: "resistance_0p3", family: "sr", description: "Production memory resistance within 0.3%", test: x => resistance(x, 0.30) },
    { id: "resistance_1p0", family: "sr", description: "Production memory resistance within 1%", test: x => resistance(x, 1.00) },
    { id: "resistance_1p0_hl_sell15", family: "sr_flow", description: "Resistance <=1% plus HL 15m sell flow", test: x => resistance(x, 1.00) && nle(x, "hlTaker15", 0.90) },
    { id: "resistance_1p0_hl_sell1h", family: "sr_flow", description: "Resistance <=1% plus HL 1h sell flow", test: x => resistance(x, 1.00) && nle(x, "hlTaker60", 0.90) },
    { id: "resistance_1p0_book_pull", family: "sr_book", description: "Resistance <=1% plus HL book withdrawal", test: x => resistance(x, 1.00) && nle(x, "hlOb5", -0.05) && nle(x, "hlObDelta", -0.15) },
    { id: "resistance_1p0_red15", family: "sr_price", description: "Resistance <=1% plus completed red 15m", test: x => resistance(x, 1.00) && yes(x, "red15") },
    { id: "damaged_4h_structure", family: "regime", description: "Completed 4h close <=-4% EMA200 and HL taker stress", test: x => nle(x, "distEma2004hPct", -4) && (nle(x, "hlTaker15", 0.85) || nle(x, "hlTaker60", 0.90)) },
    { id: "macro_bear_hl_sell", family: "regime", description: "Known 4h macro-bear plus HL selling", test: x => yes(x, "macroBear") && (nle(x, "hlTaker15", 0.85) || nle(x, "hlTaker60", 0.90)) },
    { id: "oi_unwind_sell", family: "oi_flow", description: "HL OI falls >=1%/4h plus sell flow", test: x => nle(x, "hlOi240", -1) && nle(x, "hlTaker60", 0.90) },
    { id: "crowded_at_resistance", family: "sr_oi", description: "Resistance <=1%, OI expanding, non-negative funding", test: x => resistance(x, 1) && nge(x, "hlOi240", 0.5) && nge(x, "fundingHl", 0) },
    { id: "topwatch_res0p3_oi", family: "top_watch", description: "Resistance <=0.3% with HL OI +0.5%/4h", test: x => resistance(x, 0.3) && nge(x, "hlOi240", 0.5) },
    { id: "topwatch_res0p3_rise", family: "top_watch", description: "Resistance <=0.3% after +0.5%/4h price rise", test: x => resistance(x, 0.3) && nge(x, "ret240", 0.5) },
    { id: "topwatch_res0p3_oi_rise", family: "top_watch", description: "Resistance <=0.3%, OI +0.25%/4h and rising price", test: x => resistance(x, 0.3) && nge(x, "hlOi240", 0.25) && nge(x, "ret240", 0) },
    { id: "topwatch_res0p3_extended", family: "top_watch", description: "Resistance <=0.3% while >=2% above 4h EMA200", test: x => resistance(x, 0.3) && nge(x, "distEma2004hPct", 2) },
  ];
}

function metrics(rows: AuditRow[], rule: Rule, label: (x: AuditRow) => boolean) {
  const labelled = rows.filter(label);
  const signals = rows.filter(rule.test);
  const tp = signals.filter(label).length;
  const base = rows.length ? labelled.length / rows.length : 0;
  const precision = signals.length ? tp / signals.length : 0;
  return {
    signals: signals.length,
    truePositives: tp,
    positives: labelled.length,
    precision,
    recall: labelled.length ? tp / labelled.length : 0,
    lift: base > 0 ? precision / base : 0,
    meanMin12h: signals.length ? signals.reduce((a, x) => a + Number(x.minRet12h), 0) / signals.length : 0,
    meanMin24h: signals.length ? signals.reduce((a, x) => a + Number(x.minRet24h), 0) / signals.length : 0,
  };
}

function shortReplay(rows: AuditRow[], rule: Rule, prices: Candle[], fromTs: number, toTs: number, feePct: number) {
  const signals = rows.filter(x => x.ts >= fromTs && x.ts <= toTs && rule.test(x));
  let availableAt = -Infinity;
  const trades: Array<Record<string, any>> = [];
  for (const signal of signals) {
    if (signal.ts < availableAt) continue;
    const entry = signal.price;
    const tp = entry * (1 - 0.0195), stop = entry * (1 + 0.04);
    const start = lowerBound(prices, signal.ts, x => x.ts);
    const end = lowerBound(prices, signal.ts + 12 * HOUR, x => x.ts);
    let exitTs = signal.ts + 12 * HOUR, exitPrice = prices[Math.max(start, end - 1)]?.close ?? entry, outcome = "timeout";
    for (let i = start; i < end; i++) {
      if (prices[i].high >= stop) { exitTs = prices[i].ts; exitPrice = stop; outcome = "stop"; break; }
      if (prices[i].low <= tp) { exitTs = prices[i].ts; exitPrice = tp; outcome = "tp"; break; }
    }
    const pnlPct = ((entry - exitPrice) / entry) * 100 - feePct;
    trades.push({ rule: rule.id, entryTs: signal.ts, entryIso: iso(signal.ts), exitTs, exitIso: iso(exitTs), entry, exitPrice, outcome, pnlPct });
    availableAt = exitTs + HOUR;
  }
  const total = trades.reduce((a, x) => a + x.pnlPct, 0);
  return {
    n: trades.length,
    expectancy: trades.length ? total / trades.length : 0,
    total,
    dollarPnl25k: total / 100 * 25_000,
    trades,
  };
}

async function main(): Promise<void> {
  ensureDir(OUT);
  const decision = loadDecisionFeatures();
  const prices = await loadPrices();
  const tf30 = aggregate(prices, 30 * MIN);
  const tf4h = aggregate(prices, FOUR_HOURS);
  const pivots = buildPivots(tf30);
  const ema50 = buildEmaMap(tf4h, 50);
  const ema200 = buildEmaMap(tf4h, 200);
  const fourByEnd = new Map(tf4h.map(x => [x.endTs, x]));
  const priceEnd = prices[prices.length - 1].endTs;
  const finalControlTs = Math.floor((priceEnd - 24 * HOUR) / FOUR_HOURS) * FOUR_HOURS;
  const rows: AuditRow[] = [];

  for (let ts = START; ts <= finalControlTs; ts += FOUR_HOURS) {
    const feature = decision.get(ts);
    const entryIndex = lowerBound(prices, ts, x => x.ts);
    const entry = prices[entryIndex]?.ts === ts ? prices[entryIndex].open : feature?.price;
    if (!feature || !Number.isFinite(entry)) continue;
    const prior4h = fourByEnd.get(ts);
    const e50 = ema50.get(ts) ?? null, e200 = ema200.get(ts) ?? null;
    const zone = zoneContext(zonesAt(pivots, ts), Number(entry));
    const future = outcomes(prices, ts, Number(entry));
    rows.push({
      ...feature,
      ts,
      utc: iso(ts),
      oslo: new Date(ts + 2 * HOUR).toISOString().replace("Z", "+02:00"),
      isUserEvent: EVENT_SET.has(ts),
      userIffy: ts === Date.parse("2026-08-09T02:00:00+02:00"),
      price: Number(entry),
      prior4hClose: prior4h?.close ?? null,
      ema50_4h: e50,
      ema200_4h: e200,
      distEma50_4hPct: prior4h && e50 ? ((prior4h.close - e50) / e50) * 100 : null,
      distEma2004hPct: prior4h && e200 ? ((prior4h.close - e200) / e200) * 100 : null,
      ...zone,
      ...future,
      objectiveDrop2_12h: Number(future.minRet12h) <= -2,
      objectiveDrop3_24h: Number(future.minRet24h) <= -3,
    });
  }

  const eventRows = rows.filter(x => x.isUserEvent);
  const controls = rows.filter(x => !x.isUserEvent);
  const split = Date.parse("2026-07-01T00:00:00Z");
  const rules = candidateRules();
  const rankings: Record<string, any>[] = [];
  const tradeRows: Record<string, any>[] = [];
  for (const rule of rules) {
    const allM = metrics(rows, rule, x => x.objectiveDrop2_12h);
    const trainM = metrics(rows.filter(x => x.ts < split), rule, x => x.objectiveDrop2_12h);
    const testM = metrics(rows.filter(x => x.ts >= split), rule, x => x.objectiveDrop2_12h);
    const eventHits = eventRows.filter(rule.test).length;
    const nonEventHits = controls.filter(rule.test).length;
    const replay = shortReplay(rows, rule, prices, START, finalControlTs, 0.11);
    const stress = shortReplay(rows, rule, prices, START, finalControlTs, 0.20);
    const replayTrain = shortReplay(rows, rule, prices, START, split - 1, 0.20);
    const replayTest = shortReplay(rows, rule, prices, split, finalControlTs, 0.20);
    tradeRows.push(...stress.trades);
    rankings.push({
      rule: rule.id, family: rule.family, description: rule.description,
      eventHits, eventN: eventRows.length,
      nonEventHits, nonEventN: controls.length,
      signals: allM.signals, objectiveN: allM.positives,
      precisionPct: r(allM.precision * 100, 2), recallPct: r(allM.recall * 100, 2), lift: r(allM.lift, 2),
      trainSignals: trainM.signals, trainLift: r(trainM.lift, 2), testSignals: testM.signals, testLift: r(testM.lift, 2),
      meanMin12hPct: r(allM.meanMin12h, 3), meanMin24hPct: r(allM.meanMin24h, 3),
      shortN: replay.n, shortExpectancyPct: r(replay.expectancy, 3), shortPnl25k: r(replay.dollarPnl25k, 2),
      stressExpectancyPct: r(stress.expectancy, 3), stressPnl25k: r(stress.dollarPnl25k, 2),
      trainStressN: replayTrain.n, trainStressExpPct: r(replayTrain.expectancy, 3),
      testStressN: replayTest.n, testStressExpPct: r(replayTest.expectancy, 3),
    });
  }
  rankings.sort((a, b) => (b.testStressExpPct - a.testStressExpPct) || (b.lift - a.lift));

  const sensitivity: Record<string, any>[] = [];
  for (const shiftH of [-4, 0, 4]) {
    const shifted = EVENT_TS.map(ts => rows.find(x => x.ts === ts + shiftH * HOUR)).filter((x): x is AuditRow => !!x);
    for (const rule of rules) {
      sensitivity.push({
        shiftHours: shiftH,
        rule: rule.id,
        n: shifted.length,
        hits: shifted.filter(rule.test).length,
        avgMin12hPct: shifted.length ? r(shifted.reduce((a, x) => a + Number(x.minRet12h), 0) / shifted.length, 3) : 0,
      });
    }
  }


  // Frozen short signal: S/R is evaluated at each actual 15m entry, not only
  // at the user-marked 4h boundaries. The selected trade file uses the
  // short-study's train-frozen S_tp2_sl4_h12 exit and includes fee stress.
  const liveShortTrades = loadCsvRows(SELECTED_TRADES_CSV)
    .filter(x => x.strategy === "hl_bid_pull_break")
    .map(x => {
      const entryTs = Date.parse(x.entryTime);
      const price = Number(x.entryPrice);
      const z = zoneContext(zonesAt(pivots, entryTs), price);
      const precedingMark = EVENT_TS
        .filter(ts => ts <= entryTs && entryTs < ts + 12 * HOUR)
        .sort((a, b) => b - a)[0] ?? null;
      return {
        ...x,
        entryTs,
        month: x.entryTime.slice(0, 7),
        stressPnlPct: Number(x.stressPnlPct),
        ...z,
        precededByUserMark12h: precedingMark !== null,
        precedingUserMark: precedingMark === null ? null : iso(precedingMark),
      };
    });
  const strataDefs: Array<[string, (x: typeof liveShortTrades[number]) => boolean]> = [
    ["all", () => true],
    ["resistance_le_0p3", x => x.resistanceDistPct !== null && Number(x.resistanceDistPct) <= 0.3],
    ["resistance_le_1p0", x => x.resistanceDistPct !== null && Number(x.resistanceDistPct) <= 1.0],
    ["no_resistance_within_1p0", x => x.resistanceDistPct === null || Number(x.resistanceDistPct) > 1.0],
    ["preceded_by_user_mark_12h", x => x.precededByUserMark12h],
    ["not_preceded_by_user_mark_12h", x => !x.precededByUserMark12h],
  ];
  const shortStrata: Record<string, any>[] = [];
  for (const [stratum, pred] of strataDefs) {
    for (const [period, predPeriod] of [
      ["all", (_x: typeof liveShortTrades[number]) => true],
      ["train_pre_july", (x: typeof liveShortTrades[number]) => x.entryTs < split],
      ["test_july_aug", (x: typeof liveShortTrades[number]) => x.entryTs >= split],
    ] as const) {
      const sample = liveShortTrades.filter(x => pred(x) && predPeriod(x));
      const total = sample.reduce((a, x) => a + x.stressPnlPct, 0);
      shortStrata.push({
        stratum, period, n: sample.length,
        expectancyStressPct: sample.length ? r(total / sample.length, 3) : 0,
        totalStressPct: r(total, 3),
        dollarPnl25k: r(total / 100 * 25_000, 2),
        winRatePct: sample.length ? r(sample.filter(x => x.stressPnlPct > 0).length / sample.length * 100, 1) : 0,
      });
    }
  }
  // Two-stage confidence test: establish a causal 4h top watch, but place no
  // short until the independently frozen 15m breakdown signal fires. This is
  // the only legitimate way to use the marked-candle mechanism as entry
  // context without shorting a still-rising candle.
  for (const rule of rules.filter(x => x.family === "top_watch" || x.id === "resistance_0p3")) {
    for (const windowH of [4, 8, 12]) {
      const pred = (trade: typeof liveShortTrades[number]) => rows.some(row =>
        rule.test(row) && row.ts <= trade.entryTs && trade.entryTs < row.ts + windowH * HOUR);
      for (const [period, predPeriod] of [
        ["all", (_x: typeof liveShortTrades[number]) => true],
        ["train_pre_july", (x: typeof liveShortTrades[number]) => x.entryTs < split],
        ["test_july_aug", (x: typeof liveShortTrades[number]) => x.entryTs >= split],
      ] as const) {
        const sample = liveShortTrades.filter(x => pred(x) && predPeriod(x));
        const total = sample.reduce((a, x) => a + x.stressPnlPct, 0);
        shortStrata.push({
          stratum: `${rule.id}_then_live_short_${windowH}h`, period, n: sample.length,
          expectancyStressPct: sample.length ? r(total / sample.length, 3) : 0,
          totalStressPct: r(total, 3), dollarPnl25k: r(total / 100 * 25_000, 2),
          winRatePct: sample.length ? r(sample.filter(x => x.stressPnlPct > 0).length / sample.length * 100, 1) : 0,
        });
      }
    }
  }
  const topWatchGrid: Record<string, any>[] = [];
  for (const resistanceMax of [0.2, 0.3, 0.5, 0.75, 1.0]) {
    for (const emaMin of [0, 1, 2, 3, 4]) {
      for (const windowH of [4, 8, 12]) {
        const watchRows = rows.filter(row => {
          const resistance = num(row, "resistanceDistPct");
          const ema = num(row, "distEma2004hPct");
          return resistance !== null && resistance <= resistanceMax && ema !== null && ema >= emaMin;
        });
        const match = (trade: typeof liveShortTrades[number]) => watchRows.some(row =>
          row.ts <= trade.entryTs && trade.entryTs < row.ts + windowH * HOUR);
        for (const [period, predPeriod] of [
          ["train_pre_july", (x: typeof liveShortTrades[number]) => x.entryTs < split],
          ["test_july_aug", (x: typeof liveShortTrades[number]) => x.entryTs >= split],
        ] as const) {
          const sample = liveShortTrades.filter(x => match(x) && predPeriod(x));
          const total = sample.reduce((a, x) => a + x.stressPnlPct, 0);
          topWatchGrid.push({
            resistanceMaxPct: resistanceMax, ema200MinPct: emaMin, windowH, period,
            n: sample.length,
            expectancyStressPct: sample.length ? r(total / sample.length, 3) : 0,
            totalStressPct: r(total, 3),
            winRatePct: sample.length ? r(sample.filter(x => x.stressPnlPct > 0).length / sample.length * 100, 1) : 0,
          });
        }
      }
    }
  }

  writeCsv(path.join(OUT, "event-ledger.csv"), eventRows);
  writeCsv(path.join(OUT, "all-4h-controls.csv"), rows);
  writeCsv(path.join(OUT, "precursor-rule-ranking.csv"), rankings);
  writeCsv(path.join(OUT, "precursor-short-trades-stress.csv"), tradeRows);
  writeCsv(path.join(OUT, "event-time-sensitivity.csv"), sensitivity);
  writeCsv(path.join(OUT, "live-short-sr-entry-ledger.csv"), liveShortTrades);
  writeCsv(path.join(OUT, "live-short-sr-strata.csv"), shortStrata);
  writeCsv(path.join(OUT, "live-short-topwatch-neighbor-grid.csv"), topWatchGrid);

  const objectiveN = rows.filter(x => x.objectiveDrop2_12h).length;
  const supplied2h = eventRows.filter(x => x.objectiveDrop2_12h).length;
  const supplied3d = eventRows.filter(x => x.objectiveDrop3_24h).length;
  const md = [
    "# HYPE User-Marked Drop-Precursor Audit — 2026-08-14",
    "",
    "## Causal Boundary",
    "",
    `- Supplied timestamps: ${EVENT_TS.length}, interpreted as UTC+2 4h candle starts and converted to UTC by subtracting two hours.`,
    `- Matched event rows: ${eventRows.length}. Control ledger: ${rows.length} completed 4h decision points from ${iso(START)} through ${iso(finalControlTs)}.`,
    "- Every feature at T is built from completed candles / pulse rows before T. Future candles are used only for labelled outcomes.",
    "- Production S/R parity: 30m pivots, left/right=4, 0.45% clustering, 2 touches, rolling 14d confirmed-pivot window.",
    "",
    "## Label Audit",
    "",
    `- Supplied events meeting <=-2% forward low within 12h: ${supplied2h}/${eventRows.length}.`,
    `- Supplied events meeting <=-3% forward low within 24h: ${supplied3d}/${eventRows.length}.`,
    `- Objective <=-2%/12h labels across all controls: ${objectiveN}/${rows.length} (${r(objectiveN / rows.length * 100, 1)}%).`,
    "",
    "## Predeclared Rule Ranking",
    "",
    "| Rule | Event hits | All signals | Precision | Lift | Train/test stress n | Train/test stress exp | Stress $ @25k |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rankings.map(x => `| ${x.rule} | ${x.eventHits}/${x.eventN} | ${x.signals} | ${x.precisionPct}% | ${x.lift}x | ${x.trainStressN}/${x.testStressN} | ${x.trainStressExpPct}%/${x.testStressExpPct}% | $${x.stressPnl25k} |`),
    "",
    "## Output Files",
    "",
    "- `event-ledger.csv`: exact supplied timestamps, causal inputs/SR, and forward outcomes.",
    "- `all-4h-controls.csv`: every comparable 4h boundary; required to prevent positive-only cherry-picking.",
    "- `precursor-rule-ranking.csv`: objective classification plus frozen TP1.95/SL4/12h short replay.",
    "- `event-time-sensitivity.csv`: same event hit test at T-4h, T, and T+4h.",
    "- `live-short-sr-strata.csv`: frozen hl_bid_pull_break expectancy split by causal resistance location at its actual 15m entries.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "precursor-audit.md"), md);
  console.log(md);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
