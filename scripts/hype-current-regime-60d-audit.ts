/**
 * Causal current-regime audit for HYPE long ladder.
 *
 * Tests two separate surfaces against the current partial+support-reopen stack:
 *  1) exact HL support-reopen confirmation variants;
 *  2) damaged-structure pause/release variants for both first entries and adds.
 *
 * All inputs are timestamped at or before the simulated 1m decision close.
 */

import fs from "fs";
import path from "path";
import { EMA } from "technicalindicators";
import {
  ROOT,
  buildSeries,
  ensureDir,
  iso,
  lowerBound,
  runEngine,
  streamJsonl,
  writeCsv,
  type Candle,
  type EngineParams,
  type EngineResult,
  type Series,
} from "./hype-freerun-canonical-replay";
import { attachDormantSeries } from "./hype-dormant-edge-replay";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FOUR_HOURS = 4 * HOUR;
const DATA = path.join(ROOT, "data");
const OUT = path.join(ROOT, "backtests", "hype", "current-regime-60d-2026-08-14");
const HL_START = Date.parse("2026-05-17T20:43:00Z");
const ONE_YEAR_START = Date.parse("2025-07-01T00:00:00Z");

type NullableNumbers = Array<number | null>;
type Context = {
  taker15m: NullableNumbers;
  taker1h: NullableNumbers;
  taker4h: NullableNumbers;
  bidWall: boolean[];
  oiExpansion: boolean[];
  currentBoost: boolean[];
};

type FourHourState = {
  endTs: number;
  close: number;
  ema200: number | null;
  distPct: number | null;
  ret7dPct: number | null;
  ret14dPct: number | null;
};

type Variant = {
  id: string;
  family: "baseline" | "hl_confirmation" | "ladder_pause" | "reentry" | "risk_scale" | "combo";
  boost?: boolean[];
  regimeFlat?: boolean[];
  params?: Partial<EngineParams>;
  description: string;
};

function loadBoundaryPrecursorSignals(): { bookResistance: Set<number>; topWatchExtended: Set<number> } {
  const file = path.join(ROOT, "backtests", "hype", "user-drop-precursor-2026-08-14", "all-4h-controls.csv");
  if (!fs.existsSync(file)) return { bookResistance: new Set(), topWatchExtended: new Set() };
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const at = (name: string) => header.indexOf(name);
  const bookResistance = new Set<number>();
  const topWatchExtended = new Set<number>();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const ts = Date.parse(cells[at("utc")]);
    const resistance = Number(cells[at("resistanceDistPct")]);
    const ob5 = Number(cells[at("hlOb5")]);
    const obDelta = Number(cells[at("hlObDelta")]);
    const distEma200 = Number(cells[at("distEma2004hPct")]);
    if (Number.isFinite(ts) && Number.isFinite(resistance) && resistance <= 1
      && Number.isFinite(ob5) && ob5 <= -0.05
      && Number.isFinite(obDelta) && obDelta <= -0.15) bookResistance.add(ts);
    if (Number.isFinite(ts) && Number.isFinite(resistance) && resistance <= 0.3
      && Number.isFinite(distEma200) && distEma200 >= 2) topWatchExtended.add(ts);
  }
  return { bookResistance, topWatchExtended };
}

type MinuteValueMap = Map<number, number>;

async function minuteLast(
  file: string,
  pick: (row: any) => number | null,
  preserveExactTimestamp = false,
): Promise<MinuteValueMap> {
  const out = new Map<number, number>();
  await streamJsonl(path.join(DATA, file), row => {
    const ts = Number(row.timestamp ?? Date.parse(row.ts));
    if (!Number.isFinite(ts)) return;
    const value = pick(row);
    if (value !== null && Number.isFinite(value)) {
      out.set(preserveExactTimestamp ? ts : Math.floor(ts / MINUTE) * MINUTE, value);
    }
  });
  return out;
}

function upperBound(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function valueAt(map: MinuteValueMap, keys: number[], ts: number): number | null {
  const index = upperBound(keys, ts) - 1;
  return index >= 0 ? map.get(keys[index]) ?? null : null;
}

function pctChange(now: number | null, prior: number | null): number | null {
  return now !== null && prior !== null && prior !== 0 ? ((now - prior) / prior) * 100 : null;
}

function buildPrefix(buy: MinuteValueMap, sell: MinuteValueMap) {
  const keys = [...new Set([...buy.keys(), ...sell.keys()])].sort((a, b) => a - b);
  const buyPrefix = new Float64Array(keys.length + 1);
  const sellPrefix = new Float64Array(keys.length + 1);
  for (let i = 0; i < keys.length; i++) {
    buyPrefix[i + 1] = buyPrefix[i] + (buy.get(keys[i]) ?? 0);
    sellPrefix[i + 1] = sellPrefix[i] + (sell.get(keys[i]) ?? 0);
  }
  const ratio = (endTs: number, windowMs: number): number | null => {
    const from = upperBound(keys, endTs - windowMs);
    const to = upperBound(keys, endTs);
    const b = buyPrefix[to] - buyPrefix[from];
    const s = sellPrefix[to] - sellPrefix[from];
    return s > 0 ? b / s : null;
  };
  return { ratio };
}

async function buildHlContext(candles: Candle[], exactSnapshots = false): Promise<Context> {
  const buy = new Map<number, number>();
  const sell = new Map<number, number>();
  await streamJsonl(path.join(DATA, "HYPEUSDT_taker_hyperliquid.jsonl"), row => {
    const ts = Number(row.timestamp ?? Date.parse(row.ts));
    if (!Number.isFinite(ts)) return;
    const minute = Math.floor(ts / MINUTE) * MINUTE;
    buy.set(minute, (buy.get(minute) ?? 0) + (Number(row.buyNotional) || 0));
    sell.set(minute, (sell.get(minute) ?? 0) + (Number(row.sellNotional) || 0));
  });
  const taker = buildPrefix(buy, sell);

  const assetOi = await minuteLast("HYPEUSDT_asset_ctx_hyperliquid.jsonl", row => {
    const direct = Number(row.openInterestValue);
    if (Number.isFinite(direct)) return direct;
    const size = Number(row.openInterest);
    const mark = Number(row.markPrice);
    return Number.isFinite(size) && Number.isFinite(mark) ? size * mark : null;
  }, exactSnapshots);
  const legacyHlOi = await minuteLast("HYPEUSDT_oi_live_hyperliquid.jsonl", row => {
    const value = Number(row.openInterestValue);
    return Number.isFinite(value) && value !== 0 ? value : null;
  }, exactSnapshots);
  const imbalance = await minuteLast("HYPEUSDT_ob_bands_hyperliquid.jsonl", row => {
    const value = Number(row.imbalance_0_5);
    return Number.isFinite(value) ? value : null;
  }, exactSnapshots);
  const askBid = await minuteLast("HYPEUSDT_ob_bands_hyperliquid.jsonl", row => {
    const bid = Number(row.bidBands?.pct_0_5);
    const ask = Number(row.askBands?.pct_0_5);
    return Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) ? ask / bid : null;
  }, exactSnapshots);
  const oiKeys = [...assetOi.keys()].sort((a, b) => a - b);
  const legacyOiKeys = [...legacyHlOi.keys()].sort((a, b) => a - b);
  const imbalanceKeys = [...imbalance.keys()].sort((a, b) => a - b);
  const askBidKeys = [...askBid.keys()].sort((a, b) => a - b);

  const n = candles.length;
  const taker15m: NullableNumbers = new Array(n).fill(null);
  const taker1h: NullableNumbers = new Array(n).fill(null);
  const taker4h: NullableNumbers = new Array(n).fill(null);
  const bidWall = new Array(n).fill(false);
  const oiExpansion = new Array(n).fill(false);
  const currentBoost = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    const now = candles[i].endTs;
    const t15 = taker.ratio(now, 15 * MINUTE);
    const t1 = taker.ratio(now, HOUR);
    const t4 = taker.ratio(now, FOUR_HOURS);
    const oiNow = valueAt(assetOi, oiKeys, now);
    const oi1 = pctChange(oiNow, valueAt(assetOi, oiKeys, now - HOUR));
    const oi4 = pctChange(oiNow, valueAt(assetOi, oiKeys, now - FOUR_HOURS));
    const legacyOiNow = valueAt(legacyHlOi, legacyOiKeys, now);
    const legacyOi1 = pctChange(legacyOiNow, valueAt(legacyHlOi, legacyOiKeys, now - HOUR));
    const legacyOi4 = pctChange(legacyOiNow, valueAt(legacyHlOi, legacyOiKeys, now - FOUR_HOURS));
    const imb = valueAt(imbalance, imbalanceKeys, now);
    const ratio = valueAt(askBid, askBidKeys, now);
    const bookBid = (imb !== null && imb >= 0.20) || (ratio !== null && ratio <= 0.75);
    const hlOi1 = oi1 ?? legacyOi1;
    const hlOi4 = oi4 ?? legacyOi4;
    const oiExp = (hlOi1 !== null && hlOi1 >= 0.25) || (hlOi4 !== null && hlOi4 >= 0.75);
    const buyPressure = (t15 !== null && t15 >= 1.20) || (t1 !== null && t1 >= 1.20);
    taker15m[i] = t15;
    taker1h[i] = t1;
    taker4h[i] = t4;
    bidWall[i] = bookBid;
    oiExpansion[i] = oiExp;
    currentBoost[i] = buyPressure && bookBid && oiExp;
  }
  return { taker15m, taker1h, taker4h, bidWall, oiExpansion, currentBoost };
}

function confirmation(ctx: Context, mode: string): boolean[] {
  const out = new Array(ctx.currentBoost.length).fill(false);
  let currentStreak = 0;
  for (let i = 0; i < out.length; i++) {
    const t15 = ctx.taker15m[i];
    const t1 = ctx.taker1h[i];
    const core = ctx.bidWall[i] && ctx.oiExpansion[i];
    currentStreak = ctx.currentBoost[i] ? currentStreak + 1 : 0;
    if (mode === "taker15_only") out[i] = core && t15 !== null && t15 >= 1.20;
    else if (mode === "taker1h_only") out[i] = core && t1 !== null && t1 >= 1.20;
    else if (mode === "taker15_and_1h") out[i] = core && t15 !== null && t15 >= 1.20 && t1 !== null && t1 >= 1.20;
    else if (mode === "or_veto_t15_0p75") out[i] = ctx.currentBoost[i] && t15 !== null && t15 >= 0.75;
    else if (mode === "or_veto_t15_0p85") out[i] = ctx.currentBoost[i] && t15 !== null && t15 >= 0.85;
    else if (mode === "or_veto_t15_0p90") out[i] = ctx.currentBoost[i] && t15 !== null && t15 >= 0.90;
    else if (mode === "or_veto_t15_1p00") out[i] = ctx.currentBoost[i] && t15 !== null && t15 >= 1.00;
    else if (mode === "no_taker_fade") out[i] = ctx.currentBoost[i] && t15 !== null && t1 !== null && t15 >= t1 * 0.75;
    else if (mode === "persist_2m") out[i] = currentStreak >= 2;
    else if (mode === "persist_3m") out[i] = currentStreak >= 3;
    else if (mode === "persist_5m") out[i] = currentStreak >= 5;
    else throw new Error(`unknown confirmation mode ${mode}`);
  }
  return out;
}

function aggregate4h(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let active: Candle | null = null;
  for (const candle of candles) {
    const ts = Math.floor(candle.ts / FOUR_HOURS) * FOUR_HOURS;
    if (!active || active.ts !== ts) {
      active = { ...candle, ts, endTs: ts + FOUR_HOURS };
      out.push(active);
    } else {
      active.high = Math.max(active.high, candle.high);
      active.low = Math.min(active.low, candle.low);
      active.close = candle.close;
      active.volume += candle.volume;
      active.turnover += candle.turnover;
    }
  }
  return out;
}

function buildFourHourStates(candles: Candle[]): FourHourState[] {
  const bars = aggregate4h(candles);
  return bars.map((bar, index) => {
    const completed = bars.slice(0, index + 1).slice(-249);
    const closes = completed.map(row => row.close);
    const emaValues = EMA.calculate({ period: 200, values: closes });
    const ema200 = completed.length >= 201 && emaValues.length ? emaValues[emaValues.length - 1] : null;
    const distPct = ema200 !== null ? ((bar.close - ema200) / ema200) * 100 : null;
    const prior7 = index >= 42 ? bars[index - 42].close : null;
    const prior14 = index >= 84 ? bars[index - 84].close : null;
    return {
      endTs: bar.endTs,
      close: bar.close,
      ema200,
      distPct,
      ret7dPct: prior7 ? ((bar.close - prior7) / prior7) * 100 : null,
      ret14dPct: prior14 ? ((bar.close - prior14) / prior14) * 100 : null,
    };
  });
}

function mapStatesToMinutes(candles: Candle[], states: FourHourState[]): Array<FourHourState | null> {
  const out: Array<FourHourState | null> = new Array(candles.length).fill(null);
  let cursor = -1;
  for (let i = 0; i < candles.length; i++) {
    while (cursor + 1 < states.length && states[cursor + 1].endTs <= candles[i].endTs) cursor++;
    out[i] = cursor >= 0 ? states[cursor] : null;
  }
  return out;
}

function addLadderPause(base: boolean[], condition: (i: number) => boolean): boolean[] {
  return base.map((existing, i) => existing || condition(i));
}

function hysteresisPause(
  base: boolean[],
  trigger: (i: number) => boolean,
  release: (i: number) => boolean,
): boolean[] {
  const out = new Array(base.length).fill(false);
  let active = false;
  for (let i = 0; i < base.length; i++) {
    if (!active && trigger(i)) active = true;
    else if (active && release(i)) active = false;
    out[i] = base[i] || active;
  }
  return out;
}

function currentParams(id: string, extra: Partial<EngineParams> = {}): EngineParams {
  return {
    id,
    maxPositions: 11,
    hardFlattenHours: 12,
    hardFlattenPct: -2,
    cooldownMode: "live4h",
    pullbackMode: "none",
    srExec: {
      partialExit: {
        minDepth: 6,
        keepRungs: 3,
        bufferPct: 0.3,
        minLadderPnlPct: 0.25,
        requirePlanProfit: true,
        pulse: "deteriorating",
        cooldownMin: 60,
      },
      supportReopen: { minNextDepth: 5, bufferPct: 1.0, mode: "buy_pressure" },
    },
    ...extra,
  };
}

function total(result: EngineResult): number {
  return result.realized + result.openPnl;
}

function closeValue(close: EngineResult["closes"][number]): number {
  return close.pnl + close.trimPnlInEpisode + close.hedgePnlInEpisode;
}

function summarize(
  window: string,
  variant: Variant,
  result: EngineResult,
  baseline: EngineResult,
): Record<string, string | number> {
  const hard = result.closes.filter(close => close.reason === "hard_flatten");
  const forced = result.closes.filter(close => close.reason === "hard_flatten" || close.reason === "emergency_kill");
  return {
    window,
    family: variant.family,
    variant: variant.id,
    description: variant.description,
    totalPnl: Number(total(result).toFixed(2)),
    deltaVsCurrent: Number((total(result) - total(baseline)).toFixed(2)),
    closes: result.closes.length,
    tpCycles: result.closes.filter(close => close.reason === "tp" || close.reason === "stale_tp").length,
    hardFlattens: hard.length,
    hardFlattenPnl: Number(hard.reduce((sum, close) => sum + closeValue(close), 0).toFixed(2)),
    forcedCloses: forced.length,
    forcedClosePnl: Number(forced.reduce((sum, close) => sum + closeValue(close), 0).toFixed(2)),
    partials: result.actions.filter(action => action.kind === "sr_partial_exit").length,
    supportReopens: result.actions.filter(action => action.kind === "sr_support_reopen").length,
    worstClose: Number(result.worstClose.toFixed(2)),
    maxDrawdownPct: Number(result.maxDrawdownPct.toFixed(2)),
    maxOpenNotional: Number(result.maxOpenNotional.toFixed(2)),
  };
}

function monthlyRows(window: string, variant: Variant, result: EngineResult, baseline: EngineResult) {
  const totals = (value: EngineResult) => {
    const out = new Map<string, number>();
    for (const close of value.closes) {
      const month = close.closeIso.slice(0, 7);
      out.set(month, (out.get(month) ?? 0) + closeValue(close));
    }
    return out;
  };
  const current = totals(result);
  const base = totals(baseline);
  const keys = [...new Set([...current.keys(), ...base.keys()])].sort();
  return keys.map(month => ({
    window,
    family: variant.family,
    variant: variant.id,
    month,
    realizedPnl: Number((current.get(month) ?? 0).toFixed(2)),
    deltaVsCurrent: Number(((current.get(month) ?? 0) - (base.get(month) ?? 0)).toFixed(2)),
  }));
}

async function main(): Promise<void> {
  ensureDir(OUT);
  const base = await buildSeries();
  // HL-backed dormant inputs do not exist before HL_START. Starting the
  // attachment window 14 days earlier preserves every causal lookback while
  // avoiding months of guaranteed-empty prefix work.
  await attachDormantSeries(base, Math.max(0, lowerBound(base.candles, HL_START - 14 * DAY, candle => candle.endTs)));
  const parityContext = await buildHlContext(base.candles);
  const parityMismatchRows = parityContext.currentBoost.flatMap((value, i) => {
    if (base.candles[i].endTs < HL_START || value === (base.hlSupportBoost?.[i] ?? false)) return [];
    return [{
      ts: iso(base.candles[i].endTs),
      rebuilt: value,
      attached: base.hlSupportBoost?.[i] ?? false,
      taker15m: parityContext.taker15m[i],
      taker1h: parityContext.taker1h[i],
      bidWall: parityContext.bidWall[i],
      oiExpansion: parityContext.oiExpansion[i],
    }];
  });
  if (parityMismatchRows.length !== 0) {
    throw new Error(`HL support confirmation parity failed: ${parityMismatchRows.length} minute mismatches ${JSON.stringify(parityMismatchRows.slice(0, 10))}`);
  }
  // New variants use raw snapshot timestamps, not the legacy minute-last
  // approximation, so an OI/book sample that arrives later in a minute can
  // never influence an earlier decision in that minute.
  const context = await buildHlContext(base.candles, true);

  // Research-only bridge from the user-marked 4h precursor audit. A signal at
  // boundary T uses the audit's strict-before-T book/SR inputs, then remains
  // actionable only for [T,T+4h). It does not inspect the marked candle close.
  const precursorSignals = loadBoundaryPrecursorSignals();
  const bookResistance4h = base.candles.map(candle => {
    const boundary = Math.floor(candle.endTs / FOUR_HOURS) * FOUR_HOURS;
    return precursorSignals.bookResistance.has(boundary);
  });
  const topWatchExtended4h = base.candles.map(candle => {
    const boundary = Math.floor(candle.endTs / FOUR_HOURS) * FOUR_HOURS;
    return precursorSignals.topWatchExtended.has(boundary);
  });
  base.extraTriggers = new Map(base.extraTriggers ?? []);
  base.extraTriggers.set("boundary_book_resistance_4h", bookResistance4h);
  base.extraTriggers.set("boundary_topwatch_extended_4h", topWatchExtended4h);

  const fourHour = mapStatesToMinutes(base.candles, buildFourHourStates(base.candles));
  const dist = (i: number) => fourHour[i]?.distPct ?? null;
  const ret7 = (i: number) => fourHour[i]?.ret7dPct ?? null;
  const ret14 = (i: number) => fourHour[i]?.ret14dPct ?? null;
  const t15 = (i: number) => context.taker15m[i];
  const t1 = (i: number) => context.taker1h[i];
  const recovery4hStreak = new Int16Array(base.candles.length);
  let lastRecoveryBar = 0;
  let recoveryStreak = 0;
  for (let i = 0; i < base.candles.length; i++) {
    const state = fourHour[i];
    if (state && state.endTs !== lastRecoveryBar) {
      lastRecoveryBar = state.endTs;
      recoveryStreak = state.distPct !== null && state.distPct > -1 ? recoveryStreak + 1 : 0;
    }
    recovery4hStreak[i] = recoveryStreak;
  }
  const hlSellAny = (i: number) =>
    (t15(i) !== null && t15(i)! <= 0.85) || (t1(i) !== null && t1(i)! <= 0.90);
  const hl15BelowOne = (i: number) => t15(i) !== null && t15(i)! < 1;
  const hlFlowRecovered = (i: number) =>
    t15(i) !== null && t15(i)! > 1 && t1(i) !== null && t1(i)! > 1;

  const variants: Variant[] = [{
    id: "current",
    family: "baseline",
    description: "Current partial + OR(15m,1h) support reopen + current entry gates",
  }];

  for (const mode of [
    "taker15_only",
    "taker1h_only",
    "taker15_and_1h",
    "or_veto_t15_0p75",
    "or_veto_t15_0p85",
    "or_veto_t15_0p90",
    "or_veto_t15_1p00",
    "no_taker_fade",
    "persist_2m",
    "persist_3m",
    "persist_5m",
  ]) {
    variants.push({
      id: `hl_${mode}`,
      family: "hl_confirmation",
      boost: confirmation(context, mode),
      description: `Support reopen confirmation ${mode}`,
    });
  }
  variants.push({
    id: "hl_or_exact_snapshots",
    family: "hl_confirmation",
    boost: context.currentBoost,
    description: "Current OR(15m,1h) support confirmation with exact causal OI/book snapshot timestamps",
  });
  variants.push({
    id: "hl_disable_reopen_below_ema2",
    family: "hl_confirmation",
    boost: context.currentBoost.map((value, i) => value && !(dist(i) !== null && dist(i)! <= -2)),
    description: "Disable support reopens while completed 4h close is >=2% below EMA200",
  });
  variants.push({
    id: "hl_disable_reopen_deep2_sell",
    family: "hl_confirmation",
    boost: context.currentBoost.map((value, i) => value && !(dist(i) !== null && dist(i)! <= -2 && hlSellAny(i))),
    description: "Disable support reopens when >=2% below EMA200 with HL sell pressure",
  });

  for (const threshold of [2, 3, 4, 5, 6]) {
    variants.push({
      id: `entry_pause_ema200_below_${threshold}pct`,
      family: "ladder_pause",
      regimeFlat: addLadderPause(base.regimeFlat, i => dist(i) !== null && dist(i)! <= -threshold),
      description: `Pause first entries and adds while completed 4h close is >=${threshold}% below EMA200`,
    });
  }
  const pauseDefs: Array<[string, (i: number) => boolean, string]> = [
    ["deep2_ret7_negative", i => dist(i) !== null && dist(i)! <= -2 && ret7(i) !== null && ret7(i)! < 0, "EMA200 distance <=-2% and completed-4h 7d return <0"],
    ["deep2_ret7_minus3", i => dist(i) !== null && dist(i)! <= -2 && ret7(i) !== null && ret7(i)! <= -3, "EMA200 distance <=-2% and completed-4h 7d return <=-3%"],
    ["deep3_ret7_negative", i => dist(i) !== null && dist(i)! <= -3 && ret7(i) !== null && ret7(i)! < 0, "EMA200 distance <=-3% and completed-4h 7d return <0"],
    ["deep4_ret7_negative", i => dist(i) !== null && dist(i)! <= -4 && ret7(i) !== null && ret7(i)! < 0, "EMA200 distance <=-4% and completed-4h 7d return <0"],
    ["deep2_ret14_minus5", i => dist(i) !== null && dist(i)! <= -2 && ret14(i) !== null && ret14(i)! <= -5, "EMA200 distance <=-2% and completed-4h 14d return <=-5%"],
    ["deep4_ret14_negative", i => dist(i) !== null && dist(i)! <= -4 && ret14(i) !== null && ret14(i)! < 0, "EMA200 distance <=-4% and completed-4h 14d return <0"],
    ["deep2_hl15_sell085", i => dist(i) !== null && dist(i)! <= -2 && t15(i) !== null && t15(i)! <= 0.85, "EMA200 distance <=-2% and causal HL taker15m <=0.85"],
    ["deep2_hl15_below1", i => dist(i) !== null && dist(i)! <= -2 && t15(i) !== null && t15(i)! < 1, "EMA200 distance <=-2% and causal HL taker15m <1"],
    ["deep4_hl15_below1", i => dist(i) !== null && dist(i)! <= -4 && t15(i) !== null && t15(i)! < 1, "EMA200 distance <=-4% and causal HL taker15m <1"],
    ["deep2_hl_sell_any", i => dist(i) !== null && dist(i)! <= -2 && ((t15(i) !== null && t15(i)! <= 0.85) || (t1(i) !== null && t1(i)! <= 0.90)), "EMA200 distance <=-2% and either HL 15m/1h sell-pressure threshold"],
  ];
  for (const [id, condition, description] of pauseDefs) {
    variants.push({
      id: `entry_pause_${id}`,
      family: "ladder_pause",
      regimeFlat: addLadderPause(base.regimeFlat, condition),
      description: `Pause first entries and adds: ${description}`,
    });
  }

  variants.push({
    id: "entry_lock_deep5_release_deep2",
    family: "ladder_pause",
    regimeFlat: hysteresisPause(
      base.regimeFlat,
      i => dist(i) !== null && dist(i)! <= -5,
      i => dist(i) !== null && dist(i)! > -2,
    ),
    description: "Latch entry pause at 5% below EMA200; release only inside 2% below",
  });
  variants.push({
    id: "entry_lock_deep3_ret7neg_release_recovery",
    family: "ladder_pause",
    regimeFlat: hysteresisPause(
      base.regimeFlat,
      i => dist(i) !== null && dist(i)! <= -3 && ret7(i) !== null && ret7(i)! < 0,
      i => dist(i) !== null && ret7(i) !== null && dist(i)! > -1 && ret7(i)! >= 0,
    ),
    description: "Latch at <=-3% EMA200 with negative 7d return; release at >-1% and nonnegative 7d",
  });
  const pauseIntervals: Record<string, string | number | boolean>[] = [];
  const lockDefs: Array<[string, (i: number) => boolean, (i: number) => boolean, string]> = [
    [
      "deep2_hl_sell_release_inside1",
      i => dist(i) !== null && dist(i)! <= -2 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! > -1,
      "Latch at <=-2% EMA200 plus HL 15m/1h sell pressure; release inside -1% EMA200",
    ],
    [
      "deep2_hl_sell_release_inside1_flow",
      i => dist(i) !== null && dist(i)! <= -2 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! > -1 && hlFlowRecovered(i),
      "Latch at <=-2% EMA200 plus HL sell pressure; release inside -1% with both HL taker windows >1",
    ],
    [
      "deep2_hl_sell_release_above_ema",
      i => dist(i) !== null && dist(i)! <= -2 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! >= 0,
      "Latch at <=-2% EMA200 plus HL sell pressure; release above EMA200",
    ],
    [
      "deep2_hl15_below1_release_inside1",
      i => dist(i) !== null && dist(i)! <= -2 && hl15BelowOne(i),
      i => dist(i) !== null && dist(i)! > -1,
      "Latch at <=-2% EMA200 plus HL taker15m <1; release inside -1% EMA200",
    ],
    [
      "deep3_hl_sell_release_inside1",
      i => dist(i) !== null && dist(i)! <= -3 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! > -1,
      "Latch at <=-3% EMA200 plus HL sell pressure; release inside -1% EMA200",
    ],
    [
      "deep4_hl_sell_release_inside1",
      i => dist(i) !== null && dist(i)! <= -4 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! > -1,
      "Latch at <=-4% EMA200 plus HL sell pressure; release inside -1% EMA200",
    ],
    [
      "deep4_hl_sell_release_2x4h_inside1",
      i => dist(i) !== null && dist(i)! <= -4 && hlSellAny(i),
      i => recovery4hStreak[i] >= 2,
      "Latch at <=-4% EMA200 plus HL sell pressure; release after two completed 4h closes inside -1% EMA200",
    ],
    [
      "deep4_hl_sell_release_3x4h_inside1",
      i => dist(i) !== null && dist(i)! <= -4 && hlSellAny(i),
      i => recovery4hStreak[i] >= 3,
      "Latch at <=-4% EMA200 plus HL sell pressure; release after three completed 4h closes inside -1% EMA200",
    ],
  ];
  for (const [id, trigger, release, description] of lockDefs) {
    let active = false;
    let startedAt = 0;
    let startIndex = -1;
    for (let i = lowerBound(base.candles, HL_START, candle => candle.endTs); i < base.candles.length; i++) {
      if (!active && trigger(i)) {
        active = true;
        startedAt = base.candles[i].endTs;
        startIndex = i;
      } else if (active && release(i)) {
        pauseIntervals.push({
          variant: `ladder_lock_${id}`,
          startIso: iso(startedAt),
          endIso: iso(base.candles[i].endTs),
          openAtDataEnd: false,
          triggerDistPct: Number((dist(startIndex) ?? 0).toFixed(4)),
          triggerTaker15m: Number((t15(startIndex) ?? 0).toFixed(4)),
          triggerTaker1h: Number((t1(startIndex) ?? 0).toFixed(4)),
        });
        active = false;
      }
    }
    if (active) {
      pauseIntervals.push({
        variant: `ladder_lock_${id}`,
        startIso: iso(startedAt),
        endIso: "",
        openAtDataEnd: true,
        triggerDistPct: Number((dist(startIndex) ?? 0).toFixed(4)),
        triggerTaker15m: Number((t15(startIndex) ?? 0).toFixed(4)),
        triggerTaker1h: Number((t1(startIndex) ?? 0).toFixed(4)),
      });
    }
    variants.push({
      id: `ladder_lock_${id}`,
      family: "ladder_pause",
      regimeFlat: hysteresisPause(base.regimeFlat, trigger, release),
      description,
    });
  }
  variants.push({
    id: "ladder_pause_hl15_sell085",
    family: "ladder_pause",
    regimeFlat: addLadderPause(base.regimeFlat, i => t15(i) !== null && t15(i)! <= 0.85),
    description: "Pause first entries and adds whenever causal HL taker15m <=0.85",
  });
  variants.push({
    id: "ladder_pause_hl15_below1",
    family: "ladder_pause",
    regimeFlat: addLadderPause(base.regimeFlat, hl15BelowOne),
    description: "Pause first entries and adds whenever causal HL taker15m <1",
  });
  variants.push({
    id: "ladder_pause_hl_sell_any",
    family: "ladder_pause",
    regimeFlat: addLadderPause(base.regimeFlat, hlSellAny),
    description: "Pause first entries and adds whenever either causal HL taker window shows sell pressure",
  });
  variants.push({
    id: "precursor_book_resistance_pause_all_4h",
    family: "ladder_pause",
    regimeFlat: addLadderPause(base.regimeFlat, i => bookResistance4h[i]),
    description: "Pause first entries and all adds for 4h after boundary resistance<=1% plus exact HL book withdrawal",
  });
  variants.push({
    id: "precursor_book_resistance_pause_deep5_4h",
    family: "ladder_pause",
    params: {
      deepAddPause: {
        triggerKey: "boundary_book_resistance_4h",
        minNextDepth: 5,
        pauseMin: 1,
        blockPriceDrop: true,
      },
    },
    description: "Pause depth-5+ adds for the exact 4h boundary book-withdrawal/resistance window",
  });
  for (const closePct of [0.25, 0.50, 0.75]) {
    variants.push({
      id: `precursor_book_resistance_partial_${Math.round(closePct * 100)}pct_d6`,
      family: "combo",
      params: {
        scorePartialAction: {
          triggerKey: "boundary_book_resistance_4h",
          closePct,
          maxAgeH: null,
          minDepth: 6,
          pnlMax: 999,
        },
      },
      description: `One-shot ${Math.round(closePct * 100)}% ladder trim at depth>=6 on the boundary book-withdrawal/resistance precursor`,
    });
  }
  variants.push({
    id: "precursor_topwatch_extended_pause_all_4h",
    family: "ladder_pause",
    regimeFlat: addLadderPause(base.regimeFlat, i => topWatchExtended4h[i]),
    description: "Pause first entries and all adds for 4h after resistance<=0.3% while >=2% above completed-4h EMA200",
  });
  variants.push({
    id: "precursor_topwatch_extended_pause_deep5_4h",
    family: "ladder_pause",
    params: {
      deepAddPause: {
        triggerKey: "boundary_topwatch_extended_4h",
        minNextDepth: 5,
        pauseMin: 1,
        blockPriceDrop: true,
      },
    },
    description: "Pause depth-5+ adds for the 4h elevated-price/resistance top-watch window",
  });
  for (const closePct of [0.25, 0.50, 0.75]) {
    variants.push({
      id: `precursor_topwatch_extended_partial_${Math.round(closePct * 100)}pct_d6`,
      family: "combo",
      params: {
        scorePartialAction: {
          triggerKey: "boundary_topwatch_extended_4h",
          closePct,
          maxAgeH: null,
          minDepth: 6,
          pnlMax: 999,
        },
      },
      description: `One-shot ${Math.round(closePct * 100)}% ladder trim at depth>=6 on the elevated-price/resistance top-watch`,
    });
  }
  variants.push({
    id: "combo_lock_deep2_hl_sell_and_reopen_both",
    family: "combo",
    boost: confirmation(context, "taker15_and_1h"),
    regimeFlat: hysteresisPause(
      base.regimeFlat,
      i => dist(i) !== null && dist(i)! <= -2 && hlSellAny(i),
      i => dist(i) !== null && dist(i)! > -1,
    ),
    description: "HL damage latch plus AND(15m,1h) support-reopen confirmation",
  });
  variants.push({
    id: "forced_reentry_hl_normalized",
    family: "reentry",
    params: { reentry: { mode: "hl_normalized" } },
    description: "After a forced exit, require HL sell-pressure to normalize",
  });
  variants.push({
    id: "forced_reentry_drop2_reclaim1p2",
    family: "reentry",
    params: { reentry: { mode: "drop_reclaim", dropPct: 2, reclaimPct: 1.2 } },
    description: "After a forced exit, require another 2% drop then 1.2% reclaim",
  });
  variants.push({
    id: "fixed_base_500_risk_control",
    family: "risk_scale",
    params: { baseUsdt: 500 },
    description: "Risk control only: fixed $500 base, same signals and exits",
  });

  const end = base.candles[base.candles.length - 1].endTs;
  const windows = [
    { id: "hl_full", start: HL_START },
    { id: "recent_60d", start: end - 60 * DAY },
    { id: "recent_30d", start: end - 30 * DAY },
    { id: "one_year", start: ONE_YEAR_START },
  ];
  const summary: Record<string, string | number>[] = [];
  const monthly: Record<string, string | number>[] = [];
  const closes: Record<string, string | number>[] = [];

  for (const window of windows) {
    const startIdx = lowerBound(base.candles, window.start, candle => candle.endTs);
    const results: EngineResult[] = [];
    for (const variant of variants) {
      const series: Series = {
        ...base,
        hlSupportBoost: variant.boost ?? base.hlSupportBoost,
        regimeFlat: variant.regimeFlat ?? base.regimeFlat,
      };
      const result = runEngine(currentParams(variant.id, variant.params), series, { startIdx, recordSnapshots: false });
      results.push(result);
    }
    const baseline = results[0];
    for (let i = 0; i < variants.length; i++) {
      summary.push(summarize(window.id, variants[i], results[i], baseline));
      monthly.push(...monthlyRows(window.id, variants[i], results[i], baseline));
      for (const close of results[i].closes) {
        if (close.reason !== "hard_flatten" && close.reason !== "emergency_kill") continue;
        closes.push({
          window: window.id,
          family: variants[i].family,
          variant: variants[i].id,
          entryIso: close.entryIso,
          closeIso: close.closeIso,
          reason: close.reason,
          rungs: close.rungs,
          pnl: Number(closeValue(close).toFixed(2)),
        });
      }
    }
  }

  writeCsv(path.join(OUT, "summary.csv"), summary);
  writeCsv(path.join(OUT, "monthly.csv"), monthly);
  writeCsv(path.join(OUT, "forced-closes.csv"), closes);
  writeCsv(path.join(OUT, "pause-intervals.csv"), pauseIntervals);

  const primary = summary
    .filter(row => row.window === "recent_60d")
    .sort((a, b) => Number(b.deltaVsCurrent) - Number(a.deltaVsCurrent));
  const full = summary.filter(row => row.window === "hl_full");
  console.log(JSON.stringify({
    parity: { hlSupportConfirmationMismatchMinutes: parityMismatchRows.length },
    window: { end: iso(end), recent60Start: iso(end - 60 * DAY) },
    recent60Ranking: primary.slice(0, 20),
    hlFullByVariant: Object.fromEntries(full.map(row => [row.variant, {
      totalPnl: row.totalPnl,
      deltaVsCurrent: row.deltaVsCurrent,
      hardFlattens: row.hardFlattens,
      maxDrawdownPct: row.maxDrawdownPct,
    }])),
    outputs: OUT,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
