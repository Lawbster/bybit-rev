import fs from "fs";
import path from "path";
import { BollingerBands, EMA, RSI, SMA } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { aggregate } from "./regime-filters";

type Tf = "5m" | "1H";

interface SignalEvent {
  id: string;
  name: string;
  timeframe: Tf;
  logic: string;
  entryTs: number;
  entryPrice: number;
  sourceIndex: number;
  bearRegime: boolean;
}

interface SignalVariant {
  id: string;
  name: string;
  timeframe: Tf;
  logic: string;
  cooldownBars: number;
  generate: (data: PreparedData) => SignalEvent[];
}

interface ForwardStats {
  horizonBars: number;
  n: number;
  meanShortRetPct: number;
  posRatePct: number;
}

interface ComboStats {
  tpPct: number;
  stopPct: number;
  wins: number;
  losses: number;
  flats: number;
  wrPct: number;
  expectancyPct: number;
}

interface SliceStats {
  label: string;
  n: number;
  forward: ForwardStats[];
  combos: ComboStats[];
  avgMaePct: number;
  p95MaePct: number;
  avgMfePct: number;
  p95MfePct: number;
  bestCombo: ComboStats | null;
}

interface VariantResult {
  variant: SignalVariant;
  symbol: string;
  allRegime: SliceStats;
  bearRegime: SliceStats;
  discoveryAll: SliceStats;
  discoveryBear: SliceStats;
  validationAll: SliceStats;
  validationBear: SliceStats;
}

interface PreparedData {
  symbol: string;
  bars5m: Candle[];
  bars1h: Candle[];
  ema20_1h: Array<number | null>;
  ema50_1h: Array<number | null>;
  ema200_1h: Array<number | null>;
  rsi14_1h: Array<number | null>;
  smaVol20_1h: Array<number | null>;
  smaVol20_5m: Array<number | null>;
  bbUpper_1h: Array<number | null>;
  bbLower_1h: Array<number | null>;
  bbWidthPct_1h: Array<number | null>;
  sessionVwap5m: Array<number | null>;
  sessionVwap1h: Array<number | null>;
  bearRegime1h: boolean[];
  bearRegime5m: boolean[];
  hourCloseTs: number[];
  fiveCloseTs: number[];
}

const DISCOVERY_END_TS = new Date("2026-01-01T00:00:00Z").getTime();
const FEE_ROUND_TRIP_PCT = 0.11;
const TP_STOP_GRID = [
  { tpPct: 0.75, stopPct: 1.5 },
  { tpPct: 1.0, stopPct: 1.5 },
  { tpPct: 1.0, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 2.0 },
  { tpPct: 1.5, stopPct: 3.0 },
];
const HORIZONS = [1, 3, 6, 12, 24];
const OUTPUT_PATH = path.resolve(__dirname, "../research/codex-short-signal-results.md");

function loadCandles(symbol: string): Candle[] {
  const dataDir = path.resolve(__dirname, "../data");
  const full = path.join(dataDir, `${symbol}_5_full.json`);
  const std = path.join(dataDir, `${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;
  if (!file) throw new Error(`Missing candle file for ${symbol}`);
  const candles: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

function aligned(values: number[], totalLength: number): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: totalLength }, () => null);
  const offset = totalLength - values.length;
  for (let i = 0; i < values.length; i++) out[i + offset] = values[i];
  return out;
}

function alignedBb(
  values: Array<{ upper: number; middle: number; lower: number }>,
  totalLength: number,
): { upper: Array<number | null>; lower: Array<number | null>; widthPct: Array<number | null> } {
  const upper: Array<number | null> = Array.from({ length: totalLength }, () => null);
  const lower: Array<number | null> = Array.from({ length: totalLength }, () => null);
  const widthPct: Array<number | null> = Array.from({ length: totalLength }, () => null);
  const offset = totalLength - values.length;
  for (let i = 0; i < values.length; i++) {
    const idx = i + offset;
    upper[idx] = values[i].upper;
    lower[idx] = values[i].lower;
    widthPct[idx] = values[i].middle !== 0 ? ((values[i].upper - values[i].lower) / values[i].middle) * 100 : null;
  }
  return { upper, lower, widthPct };
}

function bsearch(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) {
      res = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return res;
}

function pctBody(bar: Candle): number {
  return ((bar.close - bar.open) / bar.open) * 100;
}

function upperWickPct(bar: Candle): number {
  const range = bar.high - bar.low;
  if (range <= 0) return 0;
  return ((bar.high - Math.max(bar.open, bar.close)) / range) * 100;
}

function closeLocationPct(bar: Candle): number {
  const range = bar.high - bar.low;
  if (range <= 0) return 50;
  return ((bar.close - bar.low) / range) * 100;
}

function minLow(bars: Candle[], startIdx: number, endIdx: number): number {
  let out = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, startIdx); i <= Math.min(bars.length - 1, endIdx); i++) out = Math.min(out, bars[i].low);
  return out;
}

function maxHigh(bars: Candle[], startIdx: number, endIdx: number): number {
  let out = Number.NEGATIVE_INFINITY;
  for (let i = Math.max(0, startIdx); i <= Math.min(bars.length - 1, endIdx); i++) out = Math.max(out, bars[i].high);
  return out;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function buildSessionVwap5m(bars5m: Candle[]): Array<number | null> {
  const out: Array<number | null> = [];
  let currentDay = "";
  let cumTurnover = 0;
  let cumVolume = 0;
  for (const bar of bars5m) {
    const day = new Date(bar.timestamp).toISOString().slice(0, 10);
    if (day !== currentDay) {
      currentDay = day;
      cumTurnover = 0;
      cumVolume = 0;
    }
    cumTurnover += bar.turnover;
    cumVolume += bar.volume;
    out.push(cumVolume > 0 ? cumTurnover / cumVolume : null);
  }
  return out;
}

function buildPreparedData(symbol: string): PreparedData {
  const bars5m = loadCandles(symbol);
  const bars1h = aggregate(bars5m, 60);
  const closes1h = bars1h.map((b) => b.close);
  const volumes1h = bars1h.map((b) => b.volume);
  const volumes5m = bars5m.map((b) => b.volume);

  const ema20_1h = aligned(EMA.calculate({ period: 20, values: closes1h }), bars1h.length);
  const ema50_1h = aligned(EMA.calculate({ period: 50, values: closes1h }), bars1h.length);
  const ema200_1h = aligned(EMA.calculate({ period: 200, values: closes1h }), bars1h.length);
  const rsi14_1h = aligned(RSI.calculate({ period: 14, values: closes1h }), bars1h.length);
  const smaVol20_1h = aligned(SMA.calculate({ period: 20, values: volumes1h }), bars1h.length);
  const smaVol20_5m = aligned(SMA.calculate({ period: 20, values: volumes5m }), bars5m.length);
  const bb = alignedBb(BollingerBands.calculate({ period: 20, values: closes1h, stdDev: 2 }), bars1h.length);

  const bearRegime1h = bars1h.map((_, i) => {
    const e50 = ema50_1h[i];
    const e200 = ema200_1h[i];
    return e50 !== null && e200 !== null && e50 < e200;
  });

  const sessionVwap5m = buildSessionVwap5m(bars5m);
  const fiveCloseTs = bars5m.map((b) => b.timestamp + 300000);
  const hourCloseTs = bars1h.map((b) => b.timestamp + 3600000);
  const sessionVwap1h: Array<number | null> = bars1h.map((bar) => {
    const idx5 = bsearch(fiveCloseTs, bar.timestamp + 3600000);
    return idx5 >= 0 ? sessionVwap5m[idx5] : null;
  });
  const bearRegime5m = bars5m.map((bar) => {
    const idx1h = bsearch(hourCloseTs, bar.timestamp + 300000);
    return idx1h >= 0 ? bearRegime1h[idx1h] : false;
  });

  return {
    symbol,
    bars5m,
    bars1h,
    ema20_1h,
    ema50_1h,
    ema200_1h,
    rsi14_1h,
    smaVol20_1h,
    smaVol20_5m,
    bbUpper_1h: bb.upper,
    bbLower_1h: bb.lower,
    bbWidthPct_1h: bb.widthPct,
    sessionVwap5m,
    sessionVwap1h,
    bearRegime1h,
    bearRegime5m,
    hourCloseTs,
    fiveCloseTs,
  };
}

function emit(
  data: PreparedData,
  variant: Omit<SignalVariant, "generate" | "cooldownBars">,
  timeframe: Tf,
  sourceIndex: number,
): SignalEvent {
  if (timeframe === "5m") {
    const bar = data.bars5m[sourceIndex];
    return {
      id: variant.id,
      name: variant.name,
      timeframe,
      logic: variant.logic,
      entryTs: bar.timestamp + 300000,
      entryPrice: bar.close,
      sourceIndex,
      bearRegime: data.bearRegime5m[sourceIndex],
    };
  }
  const bar = data.bars1h[sourceIndex];
  return {
    id: variant.id,
    name: variant.name,
    timeframe,
    logic: variant.logic,
    entryTs: bar.timestamp + 3600000,
    entryPrice: bar.close,
    sourceIndex,
    bearRegime: data.bearRegime1h[sourceIndex],
  };
}

function applyCooldown(events: SignalEvent[], cooldownBars: number): SignalEvent[] {
  const out: SignalEvent[] = [];
  let lastIndex = Number.NEGATIVE_INFINITY;
  for (const ev of events) {
    if (ev.sourceIndex - lastIndex < cooldownBars) continue;
    out.push(ev);
    lastIndex = ev.sourceIndex;
  }
  return out;
}

function buildSignalVariants(): SignalVariant[] {
  const variants: SignalVariant[] = [];
  const add = (variant: SignalVariant) => variants.push(variant);

  add({
    id: "PF1",
    name: "Bear-Regime Pump Failure 2.5%",
    timeframe: "1H",
    logic: "1H green body >=2.5%, next 1-3 bars fail to make new high >0.3%, short first red confirmation",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 2.5 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PF1", name: "Bear-Regime Pump Failure 2.5%", logic: "1H green body >=2.5%, next 1-3 bars fail to make new high >0.3%, short first red confirmation", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF2",
    name: "Bear-Regime Pump Failure 3.0%",
    timeframe: "1H",
    logic: "1H green body >=3.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 3.0 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PF2", name: "Bear-Regime Pump Failure 3.0%", logic: "1H green body >=3.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF3",
    name: "Pump Failure 3.0% + Vol",
    timeframe: "1H",
    logic: "PF2 plus pump volume >=1.5x SMA20",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        const volSma = data.smaVol20_1h[i];
        if (pctBody(pump) < 3.0 || pump.close <= pump.open || volSma === null) continue;
        if (pump.volume < volSma * 1.5) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PF3", name: "Pump Failure 3.0% + Vol", logic: "PF2 plus pump volume >=1.5x SMA20", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF4",
    name: "Pump 4.0% Next-Bar Failure",
    timeframe: "1H",
    logic: "1H pump >=4.0%, next bar red, no new high >0.3%, short next-bar close",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 1; i++) {
        const pump = data.bars1h[i];
        const next = data.bars1h[i + 1];
        if (pctBody(pump) < 4.0 || pump.close <= pump.open) continue;
        if (next.close >= next.open) continue;
        if (next.high > pump.high * 1.003) continue;
        evs.push(emit(data, { id: "PF4", name: "Pump 4.0% Next-Bar Failure", logic: "1H pump >=4.0%, next bar red, no new high >0.3%, short next-bar close", timeframe: "1H" }, "1H", i + 1));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF0",
    name: "Bear-Regime Pump Failure 2.0%",
    timeframe: "1H",
    logic: "1H green body >=2.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 2.0 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PF0", name: "Bear-Regime Pump Failure 2.0%", logic: "1H green body >=2.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF1A",
    name: "Pump Failure 2.5% Tight Delay",
    timeframe: "1H",
    logic: "1H green body >=2.5%, next 1-2 bars fail to make new high >0.2%, short first red confirmation",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 2; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 2.5 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.002;
        for (let j = i + 1; j <= Math.min(i + 2, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PF1A", name: "Pump Failure 2.5% Tight Delay", logic: "1H green body >=2.5%, next 1-2 bars fail to make new high >0.2%, short first red confirmation", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PF1M",
    name: "Pump Failure 2.5% Midpoint Confirm",
    timeframe: "1H",
    logic: "PF1 plus confirmation bar closes below pump midpoint",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 2.5 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.003;
        const midpoint = (pump.open + pump.close) / 2;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open && data.bars1h[j].close < midpoint) {
            evs.push(emit(data, { id: "PF1M", name: "Pump Failure 2.5% Midpoint Confirm", logic: "PF1 plus confirmation bar closes below pump midpoint", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PFLV",
    name: "Pump Failure 2.5% Low-Volume Pump",
    timeframe: "1H",
    logic: "PF1 plus pump volume <=1.3x SMA20",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        const volSma = data.smaVol20_1h[i];
        if (pctBody(pump) < 2.5 || pump.close <= pump.open || volSma === null) continue;
        if (pump.volume > volSma * 1.3) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          if (data.bars1h[j].high > invalidHigh) break;
          if (data.bars1h[j].close < data.bars1h[j].open) {
            evs.push(emit(data, { id: "PFLV", name: "Pump Failure 2.5% Low-Volume Pump", logic: "PF1 plus pump volume <=1.3x SMA20", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PFE20",
    name: "Pump Failure 2.5% + Confirm Below EMA20",
    timeframe: "1H",
    logic: "PF1 plus confirmation bar closes below EMA20",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 3; i++) {
        const pump = data.bars1h[i];
        if (pctBody(pump) < 2.5 || pump.close <= pump.open) continue;
        const invalidHigh = pump.high * 1.003;
        for (let j = i + 1; j <= Math.min(i + 3, data.bars1h.length - 1); j++) {
          const ema20 = data.ema20_1h[j];
          if (data.bars1h[j].high > invalidHigh) break;
          if (ema20 === null) continue;
          if (data.bars1h[j].close < data.bars1h[j].open && data.bars1h[j].close < ema20) {
            evs.push(emit(data, { id: "PFE20", name: "Pump Failure 2.5% + Confirm Below EMA20", logic: "PF1 plus confirmation bar closes below EMA20", timeframe: "1H" }, "1H", j));
            break;
          }
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PV1",
    name: "Pump + Blowoff Wick",
    timeframe: "1H",
    logic: "1H green pump >=3.0%, volume >=2x SMA20, upper wick >=25%, short at close",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const sma = data.smaVol20_1h[i];
        if (pctBody(bar) < 3.0 || bar.close <= bar.open || sma === null) continue;
        if (bar.volume < sma * 2.0) continue;
        if (upperWickPct(bar) < 25) continue;
        evs.push(emit(data, { id: "PV1", name: "Pump + Blowoff Wick", logic: "1H green pump >=3.0%, volume >=2x SMA20, upper wick >=25%, short at close", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PV2",
    name: "Pump + Volume Climax Rejection",
    timeframe: "1H",
    logic: "1H green pump >=3.0%, volume >=2.5x SMA20, next bar closes below pump midpoint",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length - 1; i++) {
        const pump = data.bars1h[i];
        const next = data.bars1h[i + 1];
        const sma = data.smaVol20_1h[i];
        if (pctBody(pump) < 3.0 || pump.close <= pump.open || sma === null) continue;
        if (pump.volume < sma * 2.5) continue;
        const midpoint = (pump.open + pump.close) / 2;
        if (next.close >= midpoint) continue;
        evs.push(emit(data, { id: "PV2", name: "Pump + Volume Climax Rejection", logic: "1H green pump >=3.0%, volume >=2.5x SMA20, next bar closes below pump midpoint", timeframe: "1H" }, "1H", i + 1));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PV3",
    name: "Three-Candle Pump Exhaustion",
    timeframe: "1H",
    logic: "Three consecutive green 1H candles with shrinking bodies and >=4% total move, short first red bar",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 2; i < data.bars1h.length - 1; i++) {
        const a = data.bars1h[i - 2];
        const b = data.bars1h[i - 1];
        const c = data.bars1h[i];
        const d = data.bars1h[i + 1];
        const ba = pctBody(a);
        const bb = pctBody(b);
        const bc = pctBody(c);
        if (!(ba > 0 && bb > 0 && bc > 0)) continue;
        if (!(bc < bb && bb < ba)) continue;
        const totalMove = ((c.close - a.open) / a.open) * 100;
        if (totalMove < 4.0) continue;
        if (d.close >= d.open) continue;
        evs.push(emit(data, { id: "PV3", name: "Three-Candle Pump Exhaustion", logic: "Three consecutive green 1H candles with shrinking bodies and >=4% total move, short first red bar", timeframe: "1H" }, "1H", i + 1));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "SR1",
    name: "5m Spike Rejection 12-Bar",
    timeframe: "5m",
    logic: "5m high >= prior 12-bar high by 0.5%, closes red and back below prior high",
    cooldownBars: 12,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 12; i < data.bars5m.length; i++) {
        const bar = data.bars5m[i];
        const priorHigh = maxHigh(data.bars5m, i - 12, i - 1);
        if (bar.high < priorHigh * 1.005) continue;
        if (bar.close >= bar.open) continue;
        if (bar.close >= priorHigh) continue;
        evs.push(emit(data, { id: "SR1", name: "5m Spike Rejection 12-Bar", logic: "5m high >= prior 12-bar high by 0.5%, closes red and back below prior high", timeframe: "5m" }, "5m", i));
      }
      return applyCooldown(evs, 12);
    },
  });

  add({
    id: "SR2",
    name: "5m Spike Rejection 24-Bar",
    timeframe: "5m",
    logic: "5m high >= prior 24-bar high by 0.7%, upper wick >=40%, closes in lower half",
    cooldownBars: 12,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars5m.length; i++) {
        const bar = data.bars5m[i];
        const priorHigh = maxHigh(data.bars5m, i - 24, i - 1);
        if (bar.high < priorHigh * 1.007) continue;
        if (upperWickPct(bar) < 40) continue;
        if (closeLocationPct(bar) > 50) continue;
        evs.push(emit(data, { id: "SR2", name: "5m Spike Rejection 24-Bar", logic: "5m high >= prior 24-bar high by 0.7%, upper wick >=40%, closes in lower half", timeframe: "5m" }, "5m", i));
      }
      return applyCooldown(evs, 12);
    },
  });

  add({
    id: "SR3",
    name: "5m Spike Rejection + Vol",
    timeframe: "5m",
    logic: "SR1 plus current 5m volume >=1.5x SMA20",
    cooldownBars: 12,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars5m.length; i++) {
        const bar = data.bars5m[i];
        const sma = data.smaVol20_5m[i];
        const priorHigh = maxHigh(data.bars5m, i - 12, i - 1);
        if (sma === null) continue;
        if (bar.high < priorHigh * 1.005) continue;
        if (bar.close >= bar.open) continue;
        if (bar.close >= priorHigh) continue;
        if (bar.volume < sma * 1.5) continue;
        evs.push(emit(data, { id: "SR3", name: "5m Spike Rejection + Vol", logic: "SR1 plus current 5m volume >=1.5x SMA20", timeframe: "5m" }, "5m", i));
      }
      return applyCooldown(evs, 12);
    },
  });

  add({
    id: "SR4",
    name: "5m Spike Rejection + Bear Regime",
    timeframe: "5m",
    logic: "SR2 plus last completed 1H bear regime",
    cooldownBars: 12,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars5m.length; i++) {
        const bar = data.bars5m[i];
        const priorHigh = maxHigh(data.bars5m, i - 24, i - 1);
        if (bar.high < priorHigh * 1.007) continue;
        if (upperWickPct(bar) < 40) continue;
        if (closeLocationPct(bar) > 50) continue;
        const ev = emit(data, { id: "SR4", name: "5m Spike Rejection + Bear Regime", logic: "SR2 plus last completed 1H bear regime", timeframe: "5m" }, "5m", i);
        if (!ev.bearRegime) continue;
        evs.push(ev);
      }
      return applyCooldown(evs, 12);
    },
  });

  add({
    id: "LH1",
    name: "Lower High Failure",
    timeframe: "1H",
    logic: "Prior 24h support break within 12 bars, >=0.8% bounce, lower-high failure, short first red rejection",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        if (bar.close >= bar.open) continue;
        let matched = false;
        for (let k = Math.max(24, i - 12); k < i && !matched; k++) {
          const priorLow = minLow(data.bars1h, k - 24, k - 1);
          if (!(data.bars1h[k].close < priorLow)) continue;
          const lowSinceBreak = minLow(data.bars1h, k, i);
          const highSinceBreak = maxHigh(data.bars1h, k + 1, i);
          if (highSinceBreak < lowSinceBreak * 1.008) continue;
          const preBreakHigh = maxHigh(data.bars1h, Math.max(0, k - 12), k - 1);
          if (highSinceBreak > preBreakHigh * 0.997) continue;
          evs.push(emit(data, { id: "LH1", name: "Lower High Failure", logic: "Prior 24h support break within 12 bars, >=0.8% bounce, lower-high failure, short first red rejection", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "LH2",
    name: "Lower High Failure + EMA20",
    timeframe: "1H",
    logic: "LH1 plus rejection bar closes below EMA20",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const ema20 = data.ema20_1h[i];
        if (ema20 === null || bar.close >= bar.open || bar.close >= ema20) continue;
        let matched = false;
        for (let k = Math.max(24, i - 12); k < i && !matched; k++) {
          const priorLow = minLow(data.bars1h, k - 24, k - 1);
          if (!(data.bars1h[k].close < priorLow)) continue;
          const lowSinceBreak = minLow(data.bars1h, k, i);
          const highSinceBreak = maxHigh(data.bars1h, k + 1, i);
          if (highSinceBreak < lowSinceBreak * 1.008) continue;
          const preBreakHigh = maxHigh(data.bars1h, Math.max(0, k - 12), k - 1);
          if (highSinceBreak > preBreakHigh * 0.997) continue;
          evs.push(emit(data, { id: "LH2", name: "Lower High Failure + EMA20", logic: "LH1 plus rejection bar closes below EMA20", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "LH3",
    name: "Support Break Retest Failure",
    timeframe: "1H",
    logic: "Close breaks prior 12-bar low, later retests from below within 0.2%, red rejection close",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 12; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        if (bar.close >= bar.open) continue;
        let matched = false;
        for (let k = Math.max(12, i - 12); k < i && !matched; k++) {
          const brokenLevel = minLow(data.bars1h, k - 12, k - 1);
          if (!(data.bars1h[k].close < brokenLevel)) continue;
          if (bar.high < brokenLevel * 0.998 || bar.high > brokenLevel * 1.002) continue;
          if (bar.close >= brokenLevel) continue;
          evs.push(emit(data, { id: "LH3", name: "Support Break Retest Failure", logic: "Close breaks prior 12-bar low, later retests from below within 0.2%, red rejection close", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "LH4",
    name: "Lower High + EMA20 + RSI55-75",
    timeframe: "1H",
    logic: "LH2 plus 1H RSI in 55-75 range on rejection bar",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const ema20 = data.ema20_1h[i];
        const rsi = data.rsi14_1h[i];
        if (ema20 === null || rsi === null) continue;
        if (bar.close >= bar.open || bar.close >= ema20) continue;
        if (rsi < 55 || rsi > 75) continue;
        let matched = false;
        for (let k = Math.max(24, i - 12); k < i && !matched; k++) {
          const priorLow = minLow(data.bars1h, k - 24, k - 1);
          if (!(data.bars1h[k].close < priorLow)) continue;
          const lowSinceBreak = minLow(data.bars1h, k, i);
          const highSinceBreak = maxHigh(data.bars1h, k + 1, i);
          if (highSinceBreak < lowSinceBreak * 1.008) continue;
          const preBreakHigh = maxHigh(data.bars1h, Math.max(0, k - 12), k - 1);
          if (highSinceBreak > preBreakHigh * 0.997) continue;
          evs.push(emit(data, { id: "LH4", name: "Lower High + EMA20 + RSI55-75", logic: "LH2 plus 1H RSI in 55-75 range on rejection bar", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "LH5",
    name: "Lower High + EMA20 + Low Volume",
    timeframe: "1H",
    logic: "LH2 plus rejection bar volume <=1.2x SMA20",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const ema20 = data.ema20_1h[i];
        const volSma = data.smaVol20_1h[i];
        if (ema20 === null || volSma === null) continue;
        if (bar.close >= bar.open || bar.close >= ema20) continue;
        if (bar.volume > volSma * 1.2) continue;
        let matched = false;
        for (let k = Math.max(24, i - 12); k < i && !matched; k++) {
          const priorLow = minLow(data.bars1h, k - 24, k - 1);
          if (!(data.bars1h[k].close < priorLow)) continue;
          const lowSinceBreak = minLow(data.bars1h, k, i);
          const highSinceBreak = maxHigh(data.bars1h, k + 1, i);
          if (highSinceBreak < lowSinceBreak * 1.008) continue;
          const preBreakHigh = maxHigh(data.bars1h, Math.max(0, k - 12), k - 1);
          if (highSinceBreak > preBreakHigh * 0.997) continue;
          evs.push(emit(data, { id: "LH5", name: "Lower High + EMA20 + Low Volume", logic: "LH2 plus rejection bar volume <=1.2x SMA20", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "LH6",
    name: "Lower High + EMA20 + Wick",
    timeframe: "1H",
    logic: "LH2 plus upper wick >=25% on rejection bar",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 24; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const ema20 = data.ema20_1h[i];
        if (ema20 === null) continue;
        if (bar.close >= bar.open || bar.close >= ema20) continue;
        if (upperWickPct(bar) < 25) continue;
        let matched = false;
        for (let k = Math.max(24, i - 12); k < i && !matched; k++) {
          const priorLow = minLow(data.bars1h, k - 24, k - 1);
          if (!(data.bars1h[k].close < priorLow)) continue;
          const lowSinceBreak = minLow(data.bars1h, k, i);
          const highSinceBreak = maxHigh(data.bars1h, k + 1, i);
          if (highSinceBreak < lowSinceBreak * 1.008) continue;
          const preBreakHigh = maxHigh(data.bars1h, Math.max(0, k - 12), k - 1);
          if (highSinceBreak > preBreakHigh * 0.997) continue;
          evs.push(emit(data, { id: "LH6", name: "Lower High + EMA20 + Wick", logic: "LH2 plus upper wick >=25% on rejection bar", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "PFLH",
    name: "Delayed Pump Failure + Lower High",
    timeframe: "1H",
    logic: "Recent 1H pump >=2.5% in prior 6 bars, no breakout >0.3%, current bar red below EMA20 and still below pump high",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 6; i < data.bars1h.length; i++) {
        const bar = data.bars1h[i];
        const ema20 = data.ema20_1h[i];
        if (ema20 === null) continue;
        if (bar.close >= bar.open || bar.close >= ema20) continue;
        let matched = false;
        for (let k = Math.max(0, i - 6); k < i && !matched; k++) {
          const pump = data.bars1h[k];
          if (pctBody(pump) < 2.5 || pump.close <= pump.open) continue;
          const invalidHigh = pump.high * 1.003;
          let brokeOut = false;
          for (let j = k + 1; j <= i; j++) {
            if (data.bars1h[j].high > invalidHigh) {
              brokeOut = true;
              break;
            }
          }
          if (brokeOut) continue;
          if (bar.high >= pump.high) continue;
          evs.push(emit(data, { id: "PFLH", name: "Delayed Pump Failure + Lower High", logic: "Recent 1H pump >=2.5% in prior 6 bars, no breakout >0.3%, current bar red below EMA20 and still below pump high", timeframe: "1H" }, "1H", i));
          matched = true;
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  function compositeScore(data: PreparedData, i: number): number {
    let score = 0;
    if (data.bearRegime1h[i]) score++;
    const rsi = data.rsi14_1h[i];
    if (rsi !== null && rsi >= 58 && rsi <= 75) score++;
    const ema50 = data.ema50_1h[i];
    const close = data.bars1h[i].close;
    if (ema50 !== null && close <= ema50 * 1.005 && close >= ema50 * 0.98) score++;
    if (upperWickPct(data.bars1h[i]) >= 30) score++;
    const volSma = data.smaVol20_1h[i];
    if (volSma !== null && data.bars1h[i].volume <= volSma * 1.2) score++;
    if (i >= 2) {
      const pump = data.bars1h[i - 2];
      const recentPump = pctBody(pump) >= 2.5 && pump.close > pump.open;
      const cap = Math.max(data.bars1h[i - 1].high, data.bars1h[i].high) <= pump.high * 1.003;
      if (recentPump && cap) score++;
    }
    return score;
  }

  add({
    id: "CS1",
    name: "Composite Score >=4",
    timeframe: "1H",
    logic: "Composite bear-rally score >=4",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 2; i < data.bars1h.length; i++) {
        if (compositeScore(data, i) >= 4) {
          evs.push(emit(data, { id: "CS1", name: "Composite Score >=4", logic: "Composite bear-rally score >=4", timeframe: "1H" }, "1H", i));
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "CS2",
    name: "Composite Score >=5",
    timeframe: "1H",
    logic: "Composite bear-rally score >=5",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 2; i < data.bars1h.length; i++) {
        if (compositeScore(data, i) >= 5) {
          evs.push(emit(data, { id: "CS2", name: "Composite Score >=5", logic: "Composite bear-rally score >=5", timeframe: "1H" }, "1H", i));
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "CS3",
    name: "Composite Score >=4 + Red",
    timeframe: "1H",
    logic: "Composite score >=4 and rejection bar closes red",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 2; i < data.bars1h.length; i++) {
        if (data.bars1h[i].close >= data.bars1h[i].open) continue;
        if (compositeScore(data, i) >= 4) {
          evs.push(emit(data, { id: "CS3", name: "Composite Score >=4 + Red", logic: "Composite score >=4 and rejection bar closes red", timeframe: "1H" }, "1H", i));
        }
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "BB1",
    name: "BB Walk Exhaustion 2-Bar",
    timeframe: "1H",
    logic: "Two consecutive closes above upper BB, then close back inside",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 2; i < data.bars1h.length; i++) {
        const upperNow = data.bbUpper_1h[i];
        const upper1 = data.bbUpper_1h[i - 1];
        const upper2 = data.bbUpper_1h[i - 2];
        if (upperNow === null || upper1 === null || upper2 === null) continue;
        if (data.bars1h[i - 2].close <= upper2) continue;
        if (data.bars1h[i - 1].close <= upper1) continue;
        if (data.bars1h[i].close >= upperNow) continue;
        evs.push(emit(data, { id: "BB1", name: "BB Walk Exhaustion 2-Bar", logic: "Two consecutive closes above upper BB, then close back inside", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "BB2",
    name: "BB Walk Exhaustion 3-Bar",
    timeframe: "1H",
    logic: "Three consecutive closes above upper BB, then close back inside",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 3; i < data.bars1h.length; i++) {
        const u0 = data.bbUpper_1h[i];
        const u1 = data.bbUpper_1h[i - 1];
        const u2 = data.bbUpper_1h[i - 2];
        const u3 = data.bbUpper_1h[i - 3];
        if ([u0, u1, u2, u3].some((v) => v === null)) continue;
        if (data.bars1h[i - 3].close <= (u3 as number)) continue;
        if (data.bars1h[i - 2].close <= (u2 as number)) continue;
        if (data.bars1h[i - 1].close <= (u1 as number)) continue;
        if (data.bars1h[i].close >= (u0 as number)) continue;
        evs.push(emit(data, { id: "BB2", name: "BB Walk Exhaustion 3-Bar", logic: "Three consecutive closes above upper BB, then close back inside", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "BB3",
    name: "BB Walk Exhaustion 3-Bar + Bear",
    timeframe: "1H",
    logic: "BB2 plus bear regime",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 3; i < data.bars1h.length; i++) {
        if (!data.bearRegime1h[i]) continue;
        const u0 = data.bbUpper_1h[i];
        const u1 = data.bbUpper_1h[i - 1];
        const u2 = data.bbUpper_1h[i - 2];
        const u3 = data.bbUpper_1h[i - 3];
        if ([u0, u1, u2, u3].some((v) => v === null)) continue;
        if (data.bars1h[i - 3].close <= (u3 as number)) continue;
        if (data.bars1h[i - 2].close <= (u2 as number)) continue;
        if (data.bars1h[i - 1].close <= (u1 as number)) continue;
        if (data.bars1h[i].close >= (u0 as number)) continue;
        evs.push(emit(data, { id: "BB3", name: "BB Walk Exhaustion 3-Bar + Bear", logic: "BB2 plus bear regime", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "VW1",
    name: "VWAP Rejection From Below",
    timeframe: "1H",
    logic: "Bear regime, rally into session VWAP within 0.25%, red close below VWAP",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length; i++) {
        if (!data.bearRegime1h[i]) continue;
        const vwap = data.sessionVwap1h[i];
        if (vwap === null) continue;
        const bar = data.bars1h[i];
        if (bar.close >= bar.open) continue;
        if (bar.close >= vwap) continue;
        if (bar.high < vwap * 0.9975 || bar.high > vwap * 1.0025) continue;
        evs.push(emit(data, { id: "VW1", name: "VWAP Rejection From Below", logic: "Bear regime, rally into session VWAP within 0.25%, red close below VWAP", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "VW2",
    name: "VWAP Intrabar Reclaim Failure",
    timeframe: "1H",
    logic: "Bear regime, bar trades above VWAP intrabar, closes back below, upper wick >=25%",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length; i++) {
        if (!data.bearRegime1h[i]) continue;
        const vwap = data.sessionVwap1h[i];
        if (vwap === null) continue;
        const bar = data.bars1h[i];
        if (bar.high <= vwap) continue;
        if (bar.close >= vwap) continue;
        if (upperWickPct(bar) < 25) continue;
        evs.push(emit(data, { id: "VW2", name: "VWAP Intrabar Reclaim Failure", logic: "Bear regime, bar trades above VWAP intrabar, closes back below, upper wick >=25%", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  add({
    id: "VW3",
    name: "VWAP Intrabar Reclaim Failure (All Regimes)",
    timeframe: "1H",
    logic: "Bar trades above VWAP intrabar, closes back below, upper wick >=25%",
    cooldownBars: 6,
    generate: (data) => {
      const evs: SignalEvent[] = [];
      for (let i = 0; i < data.bars1h.length; i++) {
        const vwap = data.sessionVwap1h[i];
        if (vwap === null) continue;
        const bar = data.bars1h[i];
        if (bar.high <= vwap) continue;
        if (bar.close >= vwap) continue;
        if (upperWickPct(bar) < 25) continue;
        evs.push(emit(data, { id: "VW3", name: "VWAP Intrabar Reclaim Failure (All Regimes)", logic: "Bar trades above VWAP intrabar, closes back below, upper wick >=25%", timeframe: "1H" }, "1H", i));
      }
      return applyCooldown(evs, 6);
    },
  });

  return variants;
}

function forwardReturns(events: SignalEvent[], data: PreparedData): ForwardStats[] {
  const bars = events.length > 0 && events[0].timeframe === "5m" ? data.bars5m : data.bars1h;
  return HORIZONS.map((horizonBars) => {
    const vals: number[] = [];
    for (const ev of events) {
      const targetIdx = ev.sourceIndex + horizonBars;
      if (targetIdx >= bars.length) continue;
      vals.push(((ev.entryPrice - bars[targetIdx].close) / ev.entryPrice) * 100);
    }
    return {
      horizonBars,
      n: vals.length,
      meanShortRetPct: vals.length > 0 ? avg(vals) : 0,
      posRatePct: vals.length > 0 ? (vals.filter((v) => v > 0).length / vals.length) * 100 : 0,
    };
  });
}

function getPathWindow(event: SignalEvent, data: PreparedData): Candle[] {
  const holdMinutes = event.timeframe === "5m" ? 24 * 5 : 12 * 60;
  const endTs = event.entryTs + holdMinutes * 60000;
  return data.bars5m.filter((bar) => bar.timestamp >= event.entryTs && bar.timestamp < endTs);
}

function buildMaeMfe(events: SignalEvent[], data: PreparedData): { avgMaePct: number; p95MaePct: number; avgMfePct: number; p95MfePct: number } {
  const maes: number[] = [];
  const mfes: number[] = [];
  for (const ev of events) {
    const barsToScan = getPathWindow(ev, data);
    if (barsToScan.length === 0) continue;
    let worst = 0;
    let best = 0;
    for (const bar of barsToScan) {
      const adverse = ((ev.entryPrice - bar.high) / ev.entryPrice) * 100;
      const favorable = ((ev.entryPrice - bar.low) / ev.entryPrice) * 100;
      worst = Math.min(worst, adverse);
      best = Math.max(best, favorable);
    }
    maes.push(worst);
    mfes.push(best);
  }
  return {
    avgMaePct: avg(maes),
    p95MaePct: percentile(maes, 0.95),
    avgMfePct: avg(mfes),
    p95MfePct: percentile(mfes, 0.95),
  };
}

function evaluateCombos(events: SignalEvent[], data: PreparedData): ComboStats[] {
  const results: ComboStats[] = [];
  for (const combo of TP_STOP_GRID) {
    let wins = 0;
    let losses = 0;
    let flats = 0;
    const pnls: number[] = [];

    for (const ev of events) {
      const tpPrice = ev.entryPrice * (1 - combo.tpPct / 100);
      const stopPrice = ev.entryPrice * (1 + combo.stopPct / 100);
      const barsToScan = getPathWindow(ev, data);
      let exitPrice = ev.entryPrice;
      let outcome: "win" | "loss" | "flat" = "flat";

      for (const bar of barsToScan) {
        if (bar.high >= stopPrice) {
          exitPrice = stopPrice;
          outcome = "loss";
          break;
        }
        if (bar.low <= tpPrice) {
          exitPrice = tpPrice;
          outcome = "win";
          break;
        }
        exitPrice = bar.close;
      }

      const grossPct = ((ev.entryPrice - exitPrice) / ev.entryPrice) * 100;
      pnls.push(grossPct - FEE_ROUND_TRIP_PCT);
      if (outcome === "win") wins++;
      else if (outcome === "loss") losses++;
      else flats++;
    }

    const total = wins + losses + flats;
    results.push({
      tpPct: combo.tpPct,
      stopPct: combo.stopPct,
      wins,
      losses,
      flats,
      wrPct: total > 0 ? (wins / total) * 100 : 0,
      expectancyPct: total > 0 ? avg(pnls) : 0,
    });
  }
  return results;
}

function makeSlice(label: string, events: SignalEvent[], data: PreparedData): SliceStats {
  const forward = forwardReturns(events, data);
  const combos = evaluateCombos(events, data);
  const maeMfe = buildMaeMfe(events, data);
  const bestCombo = combos.length > 0 ? [...combos].sort((a, b) => b.expectancyPct - a.expectancyPct)[0] : null;
  return {
    label,
    n: events.length,
    forward,
    combos,
    avgMaePct: maeMfe.avgMaePct,
    p95MaePct: maeMfe.p95MaePct,
    avgMfePct: maeMfe.avgMfePct,
    p95MfePct: maeMfe.p95MfePct,
    bestCombo,
  };
}

function evaluateVariant(variant: SignalVariant, data: PreparedData): VariantResult {
  const allEvents = variant.generate(data).sort((a, b) => a.entryTs - b.entryTs);
  const bearEvents = allEvents.filter((ev) => ev.bearRegime);
  const discoveryAll = allEvents.filter((ev) => ev.entryTs < DISCOVERY_END_TS);
  const discoveryBear = discoveryAll.filter((ev) => ev.bearRegime);
  const validationAll = allEvents.filter((ev) => ev.entryTs >= DISCOVERY_END_TS);
  const validationBear = validationAll.filter((ev) => ev.bearRegime);
  return {
    variant,
    symbol: data.symbol,
    allRegime: makeSlice("All Regime", allEvents, data),
    bearRegime: makeSlice("Bear Regime", bearEvents, data),
    discoveryAll: makeSlice("Discovery / All", discoveryAll, data),
    discoveryBear: makeSlice("Discovery / Bear", discoveryBear, data),
    validationAll: makeSlice("Validation / All", validationAll, data),
    validationBear: makeSlice("Validation / Bear", validationBear, data),
  };
}

function fmtPct(v: number, digits = 2): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

function sliceMd(slice: SliceStats): string {
  const best = slice.bestCombo;
  const comboLines = slice.combos
    .map(
      (c) =>
        `  | ${c.tpPct.toFixed(2)} | ${c.stopPct.toFixed(2)} | ${c.wins} | ${c.losses} | ${c.flats} | ${c.wrPct.toFixed(0)}% | ${fmtPct(c.expectancyPct, 3)} |`,
    )
    .join("\n");
  const forwardLine = slice.forward
    .map((f) => `${f.horizonBars}b: ${fmtPct(f.meanShortRetPct)} (${f.posRatePct.toFixed(0)}% pos, n=${f.n})`)
    .join(" | ");
  return [
    `#### ${slice.label}`,
    `- Sample size: N=${slice.n}`,
    `- Forward returns: ${forwardLine}`,
    `- MAE/MFE over default hold: avg MAE ${fmtPct(slice.avgMaePct)} | p95 MAE ${fmtPct(slice.p95MaePct)} | avg MFE ${fmtPct(slice.avgMfePct)} | p95 MFE ${fmtPct(slice.p95MfePct)}`,
    `- Best combo: ${best ? `TP ${best.tpPct.toFixed(2)} / Stop ${best.stopPct.toFixed(2)} | WR ${best.wrPct.toFixed(0)}% | Expectancy ${fmtPct(best.expectancyPct, 3)}` : "n/a"}`,
    `- TP/Stop results:`,
    `  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |`,
    `  |---|---|---|---|---|---|---|`,
    comboLines || "  | n/a | n/a | 0 | 0 | 0 | 0% | 0.000% |",
  ].join("\n");
}

function verdict(result: VariantResult): string {
  const best = result.validationBear.bestCombo ?? result.validationAll.bestCombo;
  if (!best) return "INSUFFICIENT";
  if (result.validationBear.n >= 10 && best.expectancyPct > 0) return "PROFITABLE";
  if (best.expectancyPct > -0.05) return "MARGINAL";
  return "USELESS";
}

function blockMd(result: VariantResult): string {
  return [
    `### Signal: ${result.variant.id} — ${result.variant.name}`,
    `- Timeframe: ${result.variant.timeframe}`,
    `- Logic: ${result.variant.logic}`,
    `- Symbol: ${result.symbol}`,
    `- Verdict: ${verdict(result)}`,
    ``,
    sliceMd(result.discoveryAll),
    ``,
    sliceMd(result.discoveryBear),
    ``,
    sliceMd(result.validationAll),
    ``,
    sliceMd(result.validationBear),
    ``,
    sliceMd(result.allRegime),
    ``,
    sliceMd(result.bearRegime),
    ``,
  ].join("\n");
}

function summaryTable(results: VariantResult[]): string {
  const rows = [...results].sort((a, b) => {
    const av = a.validationBear.bestCombo?.expectancyPct ?? -999;
    const bv = b.validationBear.bestCombo?.expectancyPct ?? -999;
    return bv - av;
  });
  return [
    `| ID | Signal | Val N (Bear) | Best Val Exp | Best Val WR | Verdict |`,
    `|---|---|---|---|---|---|`,
    ...rows.map((r) => {
      const best = r.validationBear.bestCombo ?? r.validationAll.bestCombo;
      return `| ${r.variant.id} | ${r.variant.name} | ${r.validationBear.n} | ${best ? fmtPct(best.expectancyPct, 3) : "n/a"} | ${best ? `${best.wrPct.toFixed(0)}%` : "n/a"} | ${verdict(r)} |`;
    }),
  ].join("\n");
}

function runForSymbol(symbol: string, subsetIds?: Set<string>): VariantResult[] {
  const data = buildPreparedData(symbol);
  const variants = buildSignalVariants();
  const selected = subsetIds ? variants.filter((v) => subsetIds.has(v.id)) : variants;
  return selected.map((variant) => evaluateVariant(variant, data));
}

function pickTopIds(results: VariantResult[], count: number): string[] {
  return [...results]
    .filter((r) => {
      const valBear = r.validationBear.bestCombo;
      const valAll = r.validationAll.bestCombo;
      return (
        (!!valBear && valBear.expectancyPct > 0 && r.validationBear.n >= 5) ||
        (!!valAll && valAll.expectancyPct > 0 && r.validationAll.n >= 10)
      );
    })
    .sort((a, b) => {
      const aBear = a.validationBear.bestCombo?.expectancyPct ?? 0;
      const bBear = b.validationBear.bestCombo?.expectancyPct ?? 0;
      const aAll = a.validationAll.bestCombo?.expectancyPct ?? 0;
      const bAll = b.validationAll.bestCombo?.expectancyPct ?? 0;
      const aScore = aBear * Math.sqrt(a.validationBear.n) + aAll * Math.sqrt(a.validationAll.n) * 0.5;
      const bScore = bBear * Math.sqrt(b.validationBear.n) + bAll * Math.sqrt(b.validationAll.n) * 0.5;
      return bScore - aScore;
    })
    .slice(0, count)
    .map((r) => r.variant.id);
}

function writeResults(hypeResults: VariantResult[], btcResults: VariantResult[]): void {
  const topIds = btcResults.map((r) => r.variant.id).join(", ");
  const md = [
    `# Codex Short Signal Results`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Scope`,
    ``,
    `This run covers the Codex shortlist / execution spec only: failed-continuation, spike-rejection, lower-high, composite, BB exhaustion, and VWAP rejection families.`,
    ``,
    `Assumptions:`,
    `- Fees: 0.11% round trip taker cost`,
    `- Discovery window: 2024-12-05 -> 2025-12-31`,
    `- Validation window: 2026-01-01 -> 2026-04-03`,
    `- Bear regime: last completed 1H EMA50 < EMA200`,
    `- TP/stop simulation uses 5m path data and stop-first ordering for shorts`,
    ``,
    `## HYPE Summary`,
    ``,
    summaryTable(hypeResults),
    ``,
    `## HYPE Detailed Blocks`,
    ``,
    ...hypeResults.map((r) => blockMd(r)),
    ``,
    `## BTC Falsifier`,
    ``,
    `Top HYPE variants retested on BTC: ${topIds || "none selected"}`,
    ``,
    summaryTable(btcResults),
    ``,
    `## BTC Detailed Blocks`,
    ``,
    ...btcResults.map((r) => blockMd(r)),
  ].join("\n");
  fs.writeFileSync(OUTPUT_PATH, md, "utf-8");
}

function main(): void {
  console.log("Building HYPE dataset...");
  const hypeResults = runForSymbol("HYPEUSDT");
  const topIds = pickTopIds(hypeResults, 5);
  console.log(`Selected BTC falsifier IDs: ${topIds.join(", ") || "none"}`);
  const btcResults = topIds.length > 0 ? runForSymbol("BTCUSDT", new Set(topIds)) : [];
  writeResults(hypeResults, btcResults);
  console.log(`Wrote results to ${OUTPUT_PATH}`);
  console.log("\nTop HYPE validation results:");
  for (const r of [...hypeResults]
    .sort((a, b) => (b.validationBear.bestCombo?.expectancyPct ?? -999) - (a.validationBear.bestCombo?.expectancyPct ?? -999))
    .slice(0, 10)) {
    const best = r.validationBear.bestCombo ?? r.validationAll.bestCombo;
    console.log(
      `  ${r.variant.id.padEnd(4)} ${r.variant.name.padEnd(40)} N=${String(r.validationBear.n).padStart(3)} ` +
      `Exp=${best ? fmtPct(best.expectancyPct, 3).padStart(8) : "n/a".padStart(8)} ` +
      `WR=${best ? `${best.wrPct.toFixed(0)}%`.padStart(5) : "n/a".padStart(5)}`,
    );
  }
}

main();
