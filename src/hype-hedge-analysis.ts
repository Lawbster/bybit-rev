import fs from "fs";
import path from "path";
import { EMA } from "technicalindicators";
import { Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";
import { loadBotConfig } from "./bot/bot-config";
import {
  calcAddSize,
  canAffordAdd,
  checkEmergencyKill,
  checkHardFlatten,
  checkSoftStale,
  checkLadderKill,
} from "./bot/strategy";

interface LadderPosition {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
}

interface TrendState {
  barStart: number;
  close: number;
  ema50: number;
  ema200: number;
  ema50Prev: number;
  hostile: boolean;
}

interface FeatureSet {
  price: number;
  rsi5m: number;
  roc5m: number;
  roc20_5m: number;
  bbPos5m: number;
  atr5mPct: number;
  priceVsEma50_5m: number;
  volumeRatio5m: number;
  candleBody5m: number;
  lowerWick5m: number;
  upperWick5m: number;
  rsi1h: number;
  atr1hPct: number;
  atr1hVs30dMedian: number;
  priceVsEma50_1h: number;
  roc5_1h: number;
  roc20_1h: number;
  trendHostile4h: boolean;
  closeVsEma200_4h: number;
  ema50Slope4hPct: number;
  return1hPct: number;
  return4hPct: number;
  return12hPct: number;
  return24hPct: number;
  drawdown6hPct: number;
  drawdown24hPct: number;
  reboundFrom3hLowPct: number;
  reboundFrom6hLowPct: number;
}

interface HedgeOutcome {
  mfe6hPct: number;
  mfe12hPct: number;
  mfe24hPct: number;
  mae6hPct: number;
  mae12hPct: number;
  mae24hPct: number;
  short10x10_12h: "tp" | "sl" | "none" | "ambiguous";
  short07x10_12h: "tp" | "sl" | "none" | "ambiguous";
  short14x10_24h: "tp" | "sl" | "none" | "ambiguous";
}

interface HedgeCandidate {
  ladderId: number;
  timestamp: number;
  index: number;
  positions: number;
  avgPnlPct: number;
  hoursUnderwater: number;
  features: FeatureSet;
  outcome: HedgeOutcome;
}

interface LadderRecord {
  id: number;
  startTs: number;
  endTs: number;
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  maxPositions: number;
  exitType: string;
  durationHours: number;
  maxAdversePct: number;
  worstTs: number;
  worstPrice: number;
  worstPositions: number;
  maxAgeHours: number;
  fullTs?: number;
  staleTriggered: boolean;
  hedgeCandidate?: HedgeCandidate;
}

interface WorkingLadder {
  id: number;
  startTs: number;
  startIndex: number;
  startPrice: number;
  maxPositions: number;
  maxAdversePct: number;
  worstTs: number;
  worstPrice: number;
  worstPositions: number;
  maxAgeHours: number;
  fullTs?: number;
  staleTriggered: boolean;
  hedgeCandidate?: Omit<HedgeCandidate, "outcome">;
}

const fullPath = path.resolve(process.cwd(), "data/HYPEUSDT_5_full.json");
const candles: Candle[] = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
const botConfig = loadBotConfig(path.resolve(process.cwd(), "bot-config.json"));

const HEDGE_POS_THRESHOLD = 9;
const HEDGE_PNL_THRESHOLD = -2.5;

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(0)}%` : "n/a";
}

function fmtPct(value: number, digits: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function fmtNum(value: number, digits: number = 2): string {
  return value.toFixed(digits);
}

function resampleCandles(source: Candle[], periodMs: number): Candle[] {
  const out: Candle[] = [];
  let currentBucket = -1;
  let open = 0;
  let high = 0;
  let low = 0;
  let close = 0;
  let volume = 0;
  let turnover = 0;
  let bucketStart = 0;

  for (const c of source) {
    const bucket = Math.floor(c.timestamp / periodMs);
    if (bucket !== currentBucket) {
      if (currentBucket !== -1) {
        out.push({ timestamp: bucketStart, open, high, low, close, volume, turnover });
      }
      currentBucket = bucket;
      bucketStart = bucket * periodMs;
      open = c.open;
      high = c.high;
      low = c.low;
      close = c.close;
      volume = c.volume;
      turnover = c.turnover;
    } else {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      close = c.close;
      volume += c.volume;
      turnover += c.turnover;
    }
  }

  if (currentBucket !== -1) {
    out.push({ timestamp: bucketStart, open, high, low, close, volume, turnover });
  }

  return out;
}

function buildTrendStates(candles4h: Candle[]): Map<number, TrendState> {
  const closes = candles4h.map((c) => c.close);
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });
  const offset50 = candles4h.length - ema50.length;
  const offset200 = candles4h.length - ema200.length;
  const states = new Map<number, TrendState>();

  for (let i = 0; i < candles4h.length; i++) {
    if (i < offset200 || i < offset50 + 1) continue;
    const ema50Val = ema50[i - offset50];
    const ema50Prev = ema50[i - offset50 - 1];
    const ema200Val = ema200[i - offset200];
    const close = candles4h[i].close;
    states.set(candles4h[i].timestamp, {
      barStart: candles4h[i].timestamp,
      close,
      ema50: ema50Val,
      ema200: ema200Val,
      ema50Prev,
      hostile: close < ema200Val && ema50Val < ema50Prev,
    });
  }

  return states;
}

function getTrendStateAt(states: Map<number, TrendState>, timestamp: number): TrendState | null {
  const barMs = 4 * 3600000;
  const currentBarStart = Math.floor(timestamp / barMs) * barMs;
  const prevBarStart = currentBarStart - barMs;
  return states.get(prevBarStart) ?? null;
}

const ind5m = computeIndicators(candles);
const candles1h = resampleCandles(candles, 3600000);
const ind1h = computeIndicators(candles1h);
const candles4h = resampleCandles(candles, 4 * 3600000);
const trendStates = buildTrendStates(candles4h);

const indexByTimestamp = new Map<number, number>();
for (let i = 0; i < candles.length; i++) {
  indexByTimestamp.set(candles[i].timestamp, i);
}

const atr1hSeries = candles1h
  .map((c) => ({ ts: c.timestamp, snap: getSnapshotAt(ind1h, c.timestamp, 3600000) }))
  .filter((x): x is { ts: number; snap: IndicatorSnapshot } => !!x.snap)
  .map((x) => ({ ts: x.ts, atrPct: x.snap.atrPercent }));

function getTrailingMedianAtr1h(timestamp: number, lookbackHours: number = 24 * 30): number {
  const eligible = atr1hSeries.filter((x) => x.ts <= timestamp).slice(-lookbackHours);
  return median(eligible.map((x) => x.atrPct));
}

function closeAtOrBefore(targetTs: number): Candle {
  let lo = 0;
  let hi = candles.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].timestamp <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return candles[best];
}

function windowExtremes(index: number, lookbackCandles: number): { high: number; low: number } {
  const from = Math.max(0, index - lookbackCandles);
  let high = candles[from].high;
  let low = candles[from].low;
  for (let i = from + 1; i <= index; i++) {
    if (candles[i].high > high) high = candles[i].high;
    if (candles[i].low < low) low = candles[i].low;
  }
  return { high, low };
}

function buildFeatures(index: number): FeatureSet {
  const candle = candles[index];
  const snap5 = getSnapshotAt(ind5m, candle.timestamp);
  const snap1h = getSnapshotAt(ind1h, candle.timestamp, 3600000);
  const trend = getTrendStateAt(trendStates, candle.timestamp);

  const oneHourAgo = closeAtOrBefore(candle.timestamp - 3600000).close;
  const fourHoursAgo = closeAtOrBefore(candle.timestamp - 4 * 3600000).close;
  const twelveHoursAgo = closeAtOrBefore(candle.timestamp - 12 * 3600000).close;
  const twentyFourHoursAgo = closeAtOrBefore(candle.timestamp - 24 * 3600000).close;
  const win3h = windowExtremes(index, 36);
  const win6h = windowExtremes(index, 72);
  const win24h = windowExtremes(index, 288);

  const atrMedian = getTrailingMedianAtr1h(candle.timestamp);

  return {
    price: candle.close,
    rsi5m: snap5?.rsi14 ?? 0,
    roc5m: snap5?.roc5 ?? 0,
    roc20_5m: snap5?.roc20 ?? 0,
    bbPos5m: snap5?.bbPosition ?? 0,
    atr5mPct: snap5?.atrPercent ?? 0,
    priceVsEma50_5m: snap5?.priceVsEma50 ?? 0,
    volumeRatio5m: snap5?.volumeRatio ?? 0,
    candleBody5m: snap5?.candleBody ?? 0,
    lowerWick5m: snap5?.lowerWick ?? 0,
    upperWick5m: snap5?.upperWick ?? 0,
    rsi1h: snap1h?.rsi14 ?? 0,
    atr1hPct: snap1h?.atrPercent ?? 0,
    atr1hVs30dMedian: atrMedian > 0 && snap1h ? snap1h.atrPercent / atrMedian : 0,
    priceVsEma50_1h: snap1h?.priceVsEma50 ?? 0,
    roc5_1h: snap1h?.roc5 ?? 0,
    roc20_1h: snap1h?.roc20 ?? 0,
    trendHostile4h: trend?.hostile ?? false,
    closeVsEma200_4h: trend ? ((trend.close - trend.ema200) / trend.ema200) * 100 : 0,
    ema50Slope4hPct: trend ? ((trend.ema50 - trend.ema50Prev) / trend.ema50Prev) * 100 : 0,
    return1hPct: ((candle.close - oneHourAgo) / oneHourAgo) * 100,
    return4hPct: ((candle.close - fourHoursAgo) / fourHoursAgo) * 100,
    return12hPct: ((candle.close - twelveHoursAgo) / twelveHoursAgo) * 100,
    return24hPct: ((candle.close - twentyFourHoursAgo) / twentyFourHoursAgo) * 100,
    drawdown6hPct: ((win6h.high - candle.close) / win6h.high) * 100,
    drawdown24hPct: ((win24h.high - candle.close) / win24h.high) * 100,
    reboundFrom3hLowPct: ((candle.close - win3h.low) / win3h.low) * 100,
    reboundFrom6hLowPct: ((candle.close - win6h.low) / win6h.low) * 100,
  };
}

function shortOutcome(
  startIndex: number,
  horizonHours: number,
  tpPct: number,
  slPct: number,
): "tp" | "sl" | "none" | "ambiguous" {
  const entry = candles[startIndex].close;
  const tpPrice = entry * (1 - tpPct / 100);
  const slPrice = entry * (1 + slPct / 100);
  const horizonMs = horizonHours * 3600000;
  const startTs = candles[startIndex].timestamp;

  for (let i = startIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp - startTs > horizonMs) break;
    const hitTp = c.low <= tpPrice;
    const hitSl = c.high >= slPrice;
    if (hitTp && hitSl) return "ambiguous";
    if (hitTp) return "tp";
    if (hitSl) return "sl";
  }
  return "none";
}

function getHedgeOutcome(index: number): HedgeOutcome {
  const entry = candles[index].close;
  let mfe6 = 0;
  let mfe12 = 0;
  let mfe24 = 0;
  let mae6 = 0;
  let mae12 = 0;
  let mae24 = 0;
  const startTs = candles[index].timestamp;

  for (let i = index + 1; i < candles.length; i++) {
    const c = candles[i];
    const hours = (c.timestamp - startTs) / 3600000;
    if (hours > 24) break;
    const favorable = ((entry - c.low) / entry) * 100;
    const adverse = ((c.high - entry) / entry) * 100;

    if (hours <= 6) {
      if (favorable > mfe6) mfe6 = favorable;
      if (adverse > mae6) mae6 = adverse;
    }
    if (hours <= 12) {
      if (favorable > mfe12) mfe12 = favorable;
      if (adverse > mae12) mae12 = adverse;
    }
    if (favorable > mfe24) mfe24 = favorable;
    if (adverse > mae24) mae24 = adverse;
  }

  return {
    mfe6hPct: mfe6,
    mfe12hPct: mfe12,
    mfe24hPct: mfe24,
    mae6hPct: mae6,
    mae12hPct: mae12,
    mae24hPct: mae24,
    short10x10_12h: shortOutcome(index, 12, 1.0, 1.0),
    short07x10_12h: shortOutcome(index, 12, 0.7, 1.0),
    short14x10_24h: shortOutcome(index, 24, 1.4, 1.0),
  };
}

function ladderGroup(record: LadderRecord): "bad" | "normal" {
  if (
    record.exitType === "emergency_kill" ||
    record.exitType === "hard_flatten" ||
    record.maxAdversePct <= -5 ||
    record.durationHours >= 24
  ) {
    return "bad";
  }
  return "normal";
}

function finalizeCandidate(candidate: Omit<HedgeCandidate, "outcome">): HedgeCandidate {
  return { ...candidate, outcome: getHedgeOutcome(candidate.index) };
}

function simulate(): LadderRecord[] {
  const records: LadderRecord[] = [];
  let positions: LadderPosition[] = [];
  let capital = botConfig.initialCapital;
  let lastAddTime = 0;
  let forcedCooldownUntil = 0;
  let ladderId = 0;
  let current: WorkingLadder | null = null;

  function closePositions(index: number, exitType: string, exitPrice: number) {
    const now = candles[index].timestamp;
    for (const p of positions) {
      const pnlRaw = (exitPrice - p.entryPrice) * p.qty;
      const fees = p.notional * botConfig.feeRate + exitPrice * p.qty * botConfig.feeRate;
      capital += pnlRaw - fees;
    }

    if (current) {
      records.push({
        id: current.id,
        startTs: current.startTs,
        endTs: now,
        startIndex: current.startIndex,
        endIndex: index,
        startPrice: current.startPrice,
        endPrice: exitPrice,
        maxPositions: current.maxPositions,
        exitType,
        durationHours: (now - current.startTs) / 3600000,
        maxAdversePct: current.maxAdversePct,
        worstTs: current.worstTs,
        worstPrice: current.worstPrice,
        worstPositions: current.worstPositions,
        maxAgeHours: current.maxAgeHours,
        fullTs: current.fullTs,
        staleTriggered: current.staleTriggered,
        hedgeCandidate: current.hedgeCandidate ? finalizeCandidate(current.hedgeCandidate) : undefined,
      });
    }

    positions = [];
    current = null;

    if (exitType === "hard_flatten" || exitType === "emergency_kill") {
      const fourH = 4 * 3600000;
      forcedCooldownUntil = (Math.floor(now / fourH) + 2) * fourH;
    }
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const trendState = getTrendStateAt(trendStates, c.timestamp);
    const trendHostile = trendState?.hostile ?? false;

    if (positions.length > 0 && current) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const avgPnlPct = ((c.close - avgEntry) / avgEntry) * 100;
      const oldestEntry = Math.min(...positions.map((p) => p.entryTime));
      const ageHours = (c.timestamp - oldestEntry) / 3600000;

      if (positions.length > current.maxPositions) current.maxPositions = positions.length;
      if (positions.length === botConfig.maxPositions && !current.fullTs) current.fullTs = c.timestamp;
      if (avgPnlPct < current.maxAdversePct) {
        current.maxAdversePct = avgPnlPct;
        current.worstTs = c.timestamp;
        current.worstPrice = c.close;
        current.worstPositions = positions.length;
      }
      if (ageHours > current.maxAgeHours) current.maxAgeHours = ageHours;

      if (!current.hedgeCandidate && positions.length >= HEDGE_POS_THRESHOLD && avgPnlPct <= HEDGE_PNL_THRESHOLD) {
        current.hedgeCandidate = {
          ladderId: current.id,
          timestamp: c.timestamp,
          index: i,
          positions: positions.length,
          avgPnlPct,
          hoursUnderwater: ageHours,
          features: buildFeatures(i),
        };
      }

      const emergency = checkEmergencyKill(positions as any, c.close, botConfig);
      if (emergency.action === "flatten") {
        closePositions(i, "emergency_kill", c.close);
        continue;
      }

      const hardFlat = checkHardFlatten(positions as any, c.close, c.timestamp, trendHostile, botConfig);
      if (hardFlat.action === "flatten") {
        closePositions(i, "hard_flatten", c.close);
        continue;
      }

      const stale = checkSoftStale(positions as any, c.close, c.timestamp, botConfig);
      if (stale.action === "reduce_tp") {
        current.staleTriggered = true;
      }

      const activeTpPct = stale.action === "reduce_tp" && stale.reducedTpPct ? stale.reducedTpPct : botConfig.tpPct;
      const tpPrice = avgEntry * (1 + activeTpPct / 100);
      if (c.high >= tpPrice) {
        closePositions(i, stale.action === "reduce_tp" ? "stale_tp" : "batch_tp", tpPrice);
        continue;
      }
    }

    if (c.timestamp < forcedCooldownUntil) continue;

    const timeSinceLastAdd = (c.timestamp - lastAddTime) / 60000;
    if (timeSinceLastAdd < botConfig.addIntervalMin) continue;
    if (positions.length >= botConfig.maxPositions) continue;
    if (trendHostile) continue;

    const ladderKill = checkLadderKill(positions as any, c.close, c.timestamp, botConfig);
    if (ladderKill.blocked) continue;

    const notional = calcAddSize(positions.length, botConfig.basePositionUsdt, botConfig.addScaleFactor);
    if (!canAffordAdd(positions as any, notional, botConfig.leverage, capital)) continue;

    if (!current) {
      ladderId += 1;
      current = {
        id: ladderId,
        startTs: c.timestamp,
        startIndex: i,
        startPrice: c.close,
        maxPositions: 0,
        maxAdversePct: 0,
        worstTs: c.timestamp,
        worstPrice: c.close,
        worstPositions: 1,
        maxAgeHours: 0,
        staleTriggered: false,
      };
    }

    positions.push({
      entryPrice: c.close,
      entryTime: c.timestamp,
      qty: notional / c.close,
      notional,
    });
    lastAddTime = c.timestamp;

    if (positions.length > current.maxPositions) current.maxPositions = positions.length;
    if (positions.length === botConfig.maxPositions && !current.fullTs) current.fullTs = c.timestamp;
  }

  if (positions.length > 0 && current) {
    const last = candles[candles.length - 1];
    closePositions(candles.length - 1, "end_of_data", last.close);
  }

  return records;
}

const ladders = simulate();
const badLadders = ladders.filter((l) => ladderGroup(l) === "bad");
const normalLadders = ladders.filter((l) => ladderGroup(l) === "normal");
const candidates = ladders
  .map((l) => l.hedgeCandidate)
  .filter((x): x is HedgeCandidate => !!x);

function compareFeatures(label: string, items: HedgeCandidate[]) {
  const pick = (fn: (x: HedgeCandidate) => number) => median(items.map(fn));
  const hostileCount = items.filter((x) => x.features.trendHostile4h).length;
  const tp10 = items.filter((x) => x.outcome.short10x10_12h === "tp").length;
  const sl10 = items.filter((x) => x.outcome.short10x10_12h === "sl").length;
  console.log(`\n${label} (${items.length})`);
  console.log(`  4h hostile:       ${hostileCount}/${items.length} (${pct(hostileCount, items.length)})`);
  console.log(`  short 1.0/1.0:    TP ${tp10}/${items.length} (${pct(tp10, items.length)}) | SL ${sl10}/${items.length} (${pct(sl10, items.length)})`);
  console.log(`  avgPnL @event:    ${pick((x) => x.avgPnlPct).toFixed(2)}%`);
  console.log(`  hours underwater: ${pick((x) => x.hoursUnderwater).toFixed(1)}h`);
  console.log(`  RSI 5m / 1h:      ${pick((x) => x.features.rsi5m).toFixed(1)} / ${pick((x) => x.features.rsi1h).toFixed(1)}`);
  console.log(`  5m ROC / 1h ROC:  ${pick((x) => x.features.roc5m).toFixed(2)} / ${pick((x) => x.features.roc5_1h).toFixed(2)}`);
  console.log(`  1h vs EMA50:      ${pick((x) => x.features.priceVsEma50_1h).toFixed(2)}%`);
  console.log(`  1h ATR% x med:    ${pick((x) => x.features.atr1hPct).toFixed(2)}% x ${pick((x) => x.features.atr1hVs30dMedian).toFixed(2)}`);
  console.log(`  12h / 24h ret:    ${pick((x) => x.features.return12hPct).toFixed(2)}% / ${pick((x) => x.features.return24hPct).toFixed(2)}%`);
  console.log(`  DD24 / reb6h:     ${pick((x) => x.features.drawdown24hPct).toFixed(2)}% / ${pick((x) => x.features.reboundFrom6hLowPct).toFixed(2)}%`);
  console.log(`  4h close vs EMA200: ${pick((x) => x.features.closeVsEma200_4h).toFixed(2)}%`);
  console.log(`  4h EMA50 slope:   ${pick((x) => x.features.ema50Slope4hPct).toFixed(3)}%`);
  console.log(`  short MFE 12h / MAE 12h: ${pick((x) => x.outcome.mfe12hPct).toFixed(2)}% / ${pick((x) => x.outcome.mae12hPct).toFixed(2)}%`);
}

interface FilterResult {
  name: string;
  count: number;
  tp07: number;
  tp10: number;
  tp14: number;
  sl10: number;
  mfe12: number;
  mae12: number;
}

function runFilter(name: string, predicate: (x: HedgeCandidate) => boolean): FilterResult {
  const subset = candidates.filter(predicate);
  return {
    name,
    count: subset.length,
    tp07: subset.filter((x) => x.outcome.short07x10_12h === "tp").length,
    tp10: subset.filter((x) => x.outcome.short10x10_12h === "tp").length,
    tp14: subset.filter((x) => x.outcome.short14x10_24h === "tp").length,
    sl10: subset.filter((x) => x.outcome.short10x10_12h === "sl").length,
    mfe12: mean(subset.map((x) => x.outcome.mfe12hPct)),
    mae12: mean(subset.map((x) => x.outcome.mae12hPct)),
  };
}

const filterResults: FilterResult[] = [
  runFilter("all stress events", () => true),
  runFilter("4h hostile", (x) => x.features.trendHostile4h),
  runFilter("4h hostile + DD24>8", (x) => x.features.trendHostile4h && x.features.drawdown24hPct > 8),
  runFilter("4h hostile + DD24>10", (x) => x.features.trendHostile4h && x.features.drawdown24hPct > 10),
  runFilter("4h hostile + ret12<-5", (x) => x.features.trendHostile4h && x.features.return12hPct < -5),
  runFilter("4h hostile + ATR1h>1.25x", (x) => x.features.trendHostile4h && x.features.atr1hVs30dMedian > 1.25),
  runFilter("hostile + DD24>8 + ret12<-5", (x) => x.features.trendHostile4h && x.features.drawdown24hPct > 8 && x.features.return12hPct < -5),
  runFilter("1h RSI<=42", (x) => x.features.rsi1h <= 42),
  runFilter("1h ROC<=-3", (x) => x.features.roc5_1h <= -3),
  runFilter("RSI<=42 + ROC<=-3", (x) => x.features.rsi1h <= 42 && x.features.roc5_1h <= -3),
  runFilter("RSI<=42 + ROC<=-3 + 1h<-EMA50", (x) => x.features.rsi1h <= 42 && x.features.roc5_1h <= -3 && x.features.priceVsEma50_1h < -4),
  runFilter("RSI<=40 + ROC<=-3.5", (x) => x.features.rsi1h <= 40 && x.features.roc5_1h <= -3.5),
  runFilter("accel selloff", (x) => x.features.return1hPct <= -1.5 && x.features.roc5_1h <= -3 && x.features.rsi1h <= 43),
  runFilter(
    "bounce-fail in accel selloff",
    (x) =>
      x.features.rsi1h <= 42 &&
      x.features.roc5_1h <= -3 &&
      x.features.reboundFrom6hLowPct >= 0.5 &&
      x.features.reboundFrom6hLowPct <= 2.0 &&
      x.features.rsi5m >= 35 &&
      x.features.rsi5m <= 55 &&
      x.features.roc5m < 0 &&
      x.features.priceVsEma50_5m < 0,
  ),
  runFilter(
    "bounce-failure candidate",
    (x) =>
      x.features.trendHostile4h &&
      x.features.drawdown24hPct > 8 &&
      x.features.reboundFrom6hLowPct >= 0.8 &&
      x.features.reboundFrom6hLowPct <= 2.5 &&
      x.features.rsi5m >= 40 &&
      x.features.rsi5m <= 58 &&
      x.features.roc5m < 0 &&
      x.features.priceVsEma50_5m < 0,
  ),
];

console.log("=".repeat(110));
console.log("  HYPE HEDGE ANALYSIS");
console.log("=".repeat(110));
console.log(`Candles: ${candles.length} 5m bars | Range: ${new Date(candles[0].timestamp).toISOString().slice(0, 10)} -> ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)}`);
console.log(`Config: ${botConfig.symbol} | base $${botConfig.basePositionUsdt} | scale ${botConfig.addScaleFactor} | max ${botConfig.maxPositions} | TP ${botConfig.tpPct}% | stale ${botConfig.exits.staleHours}h->${botConfig.exits.reducedTpPct}%`);
console.log("");
console.log(`Ladders: ${ladders.length} total | bad ${badLadders.length} (${pct(badLadders.length, ladders.length)}) | normal ${normalLadders.length}`);
console.log(`Full ladders: ${ladders.filter((l) => l.maxPositions >= botConfig.maxPositions).length}/${ladders.length} (${pct(ladders.filter((l) => l.maxPositions >= botConfig.maxPositions).length, ladders.length)})`);
console.log(`Stale-triggered: ${ladders.filter((l) => l.staleTriggered).length}/${ladders.length} (${pct(ladders.filter((l) => l.staleTriggered).length, ladders.length)})`);
console.log(`Exit types: ${["batch_tp", "stale_tp", "hard_flatten", "emergency_kill", "end_of_data"].map((type) => `${type}=${ladders.filter((l) => l.exitType === type).length}`).join(" | ")}`);

console.log(`\nTop 10 worst ladders by max adverse avg-entry drawdown`);
console.log("-".repeat(110));
for (const ladder of [...ladders].sort((a, b) => a.maxAdversePct - b.maxAdversePct).slice(0, 10)) {
  const start = new Date(ladder.startTs).toISOString().slice(0, 16);
  const end = new Date(ladder.endTs).toISOString().slice(0, 16);
  console.log(
    `${String(ladder.id).padStart(3)} | ${start} -> ${end} | ${ladder.exitType.padEnd(14)} | maxPos ${String(ladder.maxPositions).padStart(2)} | ` +
    `maxAdv ${fmtPct(ladder.maxAdversePct)} | age ${fmtNum(ladder.maxAgeHours, 1)}h | start $${fmtNum(ladder.startPrice)} -> worst $${fmtNum(ladder.worstPrice)}`,
  );
}

const badCandidates = candidates.filter((x) => {
  const ladder = ladders.find((l) => l.id === x.ladderId);
  return ladder ? ladderGroup(ladder) === "bad" : false;
});
const normalCandidates = candidates.filter((x) => {
  const ladder = ladders.find((l) => l.id === x.ladderId);
  return ladder ? ladderGroup(ladder) === "normal" : false;
});

console.log(`\nStress events (first time ladder >=${HEDGE_POS_THRESHOLD} positions and avgPnL <= ${HEDGE_PNL_THRESHOLD}%): ${candidates.length}`);
compareFeatures("Bad ladder stress events", badCandidates);
compareFeatures("Normal ladder stress events", normalCandidates);

console.log(`\nFilter table for immediate short hedge from stress point`);
console.log("-".repeat(110));
console.log("Filter".padEnd(34) + "Count".padStart(7) + " TP0.7".padStart(8) + " TP1.0".padStart(8) + " TP1.4".padStart(8) + " SL1.0".padStart(8) + " MFE12".padStart(8) + " MAE12".padStart(8));
for (const row of filterResults) {
  console.log(
    row.name.padEnd(34) +
    String(row.count).padStart(7) +
    pct(row.tp07, row.count).padStart(8) +
    pct(row.tp10, row.count).padStart(8) +
    pct(row.tp14, row.count).padStart(8) +
    pct(row.sl10, row.count).padStart(8) +
    fmtNum(row.mfe12, 2).padStart(8) +
    fmtNum(row.mae12, 2).padStart(8),
  );
}

console.log(`\nMonthly bad ladder counts`);
console.log("-".repeat(110));
const badByMonth = new Map<string, LadderRecord[]>();
for (const ladder of badLadders) {
  const month = new Date(ladder.startTs).toISOString().slice(0, 7);
  if (!badByMonth.has(month)) badByMonth.set(month, []);
  badByMonth.get(month)!.push(ladder);
}
for (const [month, ls] of [...badByMonth.entries()].sort()) {
  const avgMaxAdverse = mean(ls.map((l) => l.maxAdversePct));
  const fullCount = ls.filter((l) => l.maxPositions >= botConfig.maxPositions).length;
  console.log(`${month}: ${String(ls.length).padStart(2)} bad ladders | full ${String(fullCount).padStart(2)} | avg maxAdv ${fmtPct(avgMaxAdverse)} | exits ${ls.map((l) => l.exitType).join(", ")}`);
}
