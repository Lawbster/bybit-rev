import fs from "fs";
import path from "path";
import readline from "readline";
import { BollingerBands, EMA, RSI } from "technicalindicators";
import { Candle } from "../fetch-candles";
import { LadderPosition } from "./state";
import { BotConfig } from "./bot-config";
import { aggregate } from "./sr-levels";

const DATA_DIR = path.join(process.cwd(), "data");
const FIVE_MIN = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;
const FOUR_HOURS = 4 * ONE_HOUR;
const CANDLE_GRACE_MS = 10_000;
const TAIL_TTL_MS = 30_000;
const TAIL_BYTES = 6 * 1024 * 1024;

type AnyRow = Record<string, any> & { ts: number };

interface TailCache {
  loadedAt: number;
  rows: AnyRow[];
}

const tailCache = new Map<string, TailCache>();

export interface ScorePartialFlattenSnapshot {
  ts: number;
  iso: string;
  symbol: string;
  price: number;
  depth: number;
  ladderPnlPct: number | null;
  totalQty: number;
  totalNotional: number;
  features: Record<string, number | null>;
  deepScore: number;
  avoidScore: number;
  score: number;
  deepGroups: ScoreGroupResult[];
  avoidGroups: ScoreGroupResult[];
}

export interface ScoreGroupResult {
  ids: string[];
  fired: boolean;
  firedAtoms: string[];
}

export interface ScorePartialFlattenDecision {
  fire: boolean;
  reason: string;
  snapshot: ScorePartialFlattenSnapshot;
}

interface Atom {
  id: string;
  feature: string;
  side: "high" | "low";
  threshold: number;
}

const ATOMS: Atom[] = [
  { id: "trend_hostile_4h", feature: "trendHostile4h", side: "high", threshold: 0.5 },
  { id: "trend_ok_4h", feature: "trendHostile4h", side: "low", threshold: 0.5 },
  { id: "below_ema200_4h", feature: "ema200_4h_distPct", side: "low", threshold: 0.348 },
  { id: "above_ema200_4h", feature: "ema200_4h_distPct", side: "high", threshold: 5.484 },
  { id: "ema50_4h_falling", feature: "ema50_4h_slopePct", side: "low", threshold: -0.088 },
  { id: "ema50_4h_rising", feature: "ema50_4h_slopePct", side: "high", threshold: 0.093 },
  { id: "rsi5m_low", feature: "rsi5m", side: "low", threshold: 40.86 },
  { id: "rsi1h_low", feature: "rsi1h", side: "low", threshold: 41.05 },
  { id: "crsi4h_low", feature: "crsi4h", side: "low", threshold: 35.14 },
  { id: "crsi4h_high", feature: "crsi4h", side: "high", threshold: 72.13 },
  { id: "bb5m_oversold", feature: "bb20_5m_z", side: "low", threshold: -1.199 },
  { id: "bb5m_overbought", feature: "bb20_5m_z", side: "high", threshold: 1.34 },
  { id: "btc1h_up", feature: "btc1hPct", side: "high", threshold: 0.234 },
  { id: "btc4h_up", feature: "btc4hPct", side: "high", threshold: 0.494 },
  { id: "oi_by_4h_down", feature: "oiBy4hPct", side: "low", threshold: -1.105 },
  { id: "oi_bn_1h_up", feature: "oiBn1hPct", side: "high", threshold: 0.533 },
  { id: "oi_bn_1h_down", feature: "oiBn1hPct", side: "low", threshold: -0.45 },
  { id: "oi_hl_1h_up", feature: "oiHl1hPct", side: "high", threshold: 0.497 },
  { id: "oi_hl_4h_down", feature: "oiHl4hPct", side: "low", threshold: -1.137 },
  { id: "oi_breadth_4h_down", feature: "oiBreadth4h", side: "low", threshold: -1.026 },
  { id: "taker1h_buy", feature: "taker1h", side: "high", threshold: 1.284 },
  { id: "taker4h_buy", feature: "taker4h", side: "high", threshold: 1.152 },
  { id: "funding_by_high", feature: "fundingBy", side: "high", threshold: 0.0001 },
  { id: "funding_hl_low", feature: "fundingHl", side: "low", threshold: 0.00000499 },
  { id: "funding_hl_falling", feature: "fundingHlDelta4h", side: "low", threshold: -0.00000317 },
  { id: "active_depth_high", feature: "activeDepth", side: "high", threshold: 11 },
  { id: "ladder_pnl_low", feature: "ladderPnlPct", side: "low", threshold: -1.931 },
];

const ATOM_BY_ID = new Map(ATOMS.map(atom => [atom.id, atom]));

const DEEP_GROUPS = [
  ["active_depth_high", "ladder_pnl_low"],
  ["trend_ok_4h", "above_ema200_4h", "ema50_4h_rising"],
  ["oi_hl_1h_up", "oi_bn_1h_up", "oi_by_4h_down", "oi_hl_4h_down", "oi_breadth_4h_down"],
  ["funding_hl_low", "funding_hl_falling"],
  ["rsi5m_low", "crsi4h_low", "bb5m_oversold"],
];

const AVOID_GROUPS = [
  ["trend_hostile_4h", "below_ema200_4h", "ema50_4h_falling"],
  ["btc4h_up", "btc1h_up", "taker1h_buy", "taker4h_buy"],
  ["oi_bn_1h_down", "oi_hl_4h_down", "oi_breadth_4h_down"],
  ["funding_hl_low", "funding_hl_falling", "funding_by_high"],
  ["bb5m_overbought", "rsi1h_low", "crsi4h_high"],
];

function parseTs(row: Record<string, any>): number | null {
  const raw = row.timestamp ?? row.ts ?? row.time;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) return asNumber;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function num(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function readTail(filename: string, sinceMs: number): Promise<AnyRow[]> {
  const cached = tailCache.get(filename);
  const now = Date.now();
  if (cached && now - cached.loadedAt < TAIL_TTL_MS) {
    return cached.rows.filter(row => row.ts >= sinceMs);
  }

  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];

  const rows: AnyRow[] = [];
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - TAIL_BYTES);
    const stream = fs.createReadStream(filePath, { start });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let first = start > 0;
    for await (const line of rl) {
      if (first) {
        first = false;
        continue;
      }
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const ts = parseTs(row);
        if (ts !== null) rows.push({ ...row, ts });
      } catch {
        // Ignore partial copy tails.
      }
    }
  } catch {
    return [];
  }

  rows.sort((a, b) => a.ts - b.ts);
  tailCache.set(filename, { loadedAt: now, rows });
  return rows.filter(row => row.ts >= sinceMs);
}

function lastBefore<T extends { ts: number }>(rows: T[], t: number): T | null {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].ts <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? rows[lo - 1] : null;
}

function rowsBetween(rows: AnyRow[], start: number, end: number): AnyRow[] {
  return rows.filter(row => row.ts > start && row.ts <= end);
}

function completedCandles(candles: Candle[], periodMs: number, nowMs: number): Candle[] {
  return candles
    .filter(c => Number.isFinite(c.timestamp) && c.timestamp + periodMs + CANDLE_GRACE_MS <= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function lastValue<T>(values: T[]): T | null {
  return values.length > 0 ? values[values.length - 1] : null;
}

function aligned<T>(values: T[], length: number): Array<T | null> {
  const pad = Array.from({ length: Math.max(0, length - values.length) }, () => null);
  return [...pad, ...values];
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function connorsRsiLatest(closes: number[]): number | null {
  if (closes.length < 102) return null;

  const rsi3 = aligned(RSI.calculate({ period: 3, values: closes }), closes.length);
  const streaks: number[] = [];
  let streak = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) streak = streak > 0 ? streak + 1 : 1;
    else if (closes[i] < closes[i - 1]) streak = streak < 0 ? streak - 1 : -1;
    else streak = 0;
    streaks.push(Math.abs(streak));
  }

  const rsi2 = aligned(RSI.calculate({ period: 2, values: streaks }), closes.length - 1);
  const roc1: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    roc1.push(((closes[i] - closes[i - 1]) / closes[i - 1]) * 100);
  }

  const i = closes.length - 1;
  const r3 = rsi3[i];
  const r2 = rsi2[i - 1] ?? null;
  if (r3 === null || r2 === null) return null;

  const window = roc1.slice(i - 100, i);
  const current = roc1[i - 1];
  const rank = percent(window.filter(v => v <= current).length, window.length);
  return (r3 + r2 + rank) / 3;
}

function roc(rows: AnyRow[], ts: number, windowMs: number, field: string): number | null {
  const now = num(lastBefore(rows, ts)?.[field]);
  const prev = num(lastBefore(rows, ts - windowMs)?.[field]);
  if (now === null || prev === null || prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function candleRoc(rows: AnyRow[], ts: number, windowMs: number): number | null {
  const now = lastBefore(rows, ts);
  const prev = lastBefore(rows, ts - windowMs);
  const nowClose = num(now?.c ?? now?.close);
  const prevClose = num(prev?.c ?? prev?.close);
  if (nowClose === null || prevClose === null || prevClose === 0) return null;
  return ((nowClose - prevClose) / prevClose) * 100;
}

function avgPnlPct(positions: LadderPosition[], price: number): number | null {
  const totalQty = positions.reduce((sum, pos) => sum + pos.qty, 0);
  if (totalQty <= 0) return null;
  const avgEntry = positions.reduce((sum, pos) => sum + pos.entryPrice * pos.qty, 0) / totalQty;
  return ((price - avgEntry) / avgEntry) * 100;
}

function atomFires(features: Record<string, number | null>, atom: Atom): boolean {
  const value = features[atom.feature];
  if (value === null || !Number.isFinite(value)) return false;
  return atom.side === "high" ? value >= atom.threshold : value <= atom.threshold;
}

function scoreGroups(features: Record<string, number | null>, groups: string[][]): { score: number; details: ScoreGroupResult[] } {
  const details = groups.map(ids => {
    const firedAtoms = ids.filter(id => {
      const atom = ATOM_BY_ID.get(id);
      return atom ? atomFires(features, atom) : false;
    });
    return { ids, fired: firedAtoms.length > 0, firedAtoms };
  });
  const fired = details.filter(group => group.fired).length;
  return { score: (fired / groups.length) * 100, details };
}

export async function buildScoreFeatures(
  symbol: string,
  nowMs: number,
  price: number,
  positions: LadderPosition[],
  candles5m: Candle[],
): Promise<Record<string, number | null>> {
  const c5m = completedCandles(candles5m, FIVE_MIN, nowMs);
  const c1h = completedCandles(aggregate(c5m, 60), ONE_HOUR, nowMs);
  const c4h = completedCandles(aggregate(c5m, 240), FOUR_HOURS, nowMs);
  const lastCompleted5m = c5m[c5m.length - 1];
  const featurePrice = lastCompleted5m?.close ?? price;

  const close5m = c5m.map(c => c.close);
  const close1h = c1h.map(c => c.close);
  const close4h = c4h.map(c => c.close);

  let trendHostile4h: number | null = null;
  let ema200_4h_distPct: number | null = null;
  let ema50_4h_slopePct: number | null = null;
  if (close4h.length >= 201) {
    const ema50 = EMA.calculate({ period: 50, values: close4h });
    const ema200 = EMA.calculate({ period: 200, values: close4h });
    const e50 = ema50[ema50.length - 1];
    const prev50 = ema50[ema50.length - 2];
    const e200 = ema200[ema200.length - 1];
    const close = close4h[close4h.length - 1];
    if ([e50, prev50, e200, close].every(Number.isFinite)) {
      ema200_4h_distPct = ((close - e200) / e200) * 100;
      ema50_4h_slopePct = ((e50 - prev50) / prev50) * 100;
      trendHostile4h = close < e200 && e50 < prev50 ? 1 : 0;
    }
  }

  const rsi5m = close5m.length >= 15 ? lastValue(RSI.calculate({ period: 14, values: close5m })) : null;
  const rsi1h = close1h.length >= 15 ? lastValue(RSI.calculate({ period: 14, values: close1h })) : null;
  const crsi4h = connorsRsiLatest(close4h);

  let bb20_5m_z: number | null = null;
  if (close5m.length >= 20) {
    const bb = lastValue(BollingerBands.calculate({ period: 20, values: close5m, stdDev: 2 }));
    if (bb) {
      const sd = (bb.upper - bb.lower) / 4;
      if (sd > 0) bb20_5m_z = (featurePrice - bb.middle) / sd;
    }
  }

  const since = nowMs - FOUR_HOURS - 10 * 60_000;
  const [
    oiBy,
    oiBn,
    oiHl,
    taker,
    fdBy,
    fdHl,
    btc1m,
  ] = await Promise.all([
    readTail(`${symbol}_oi_live.jsonl`, since),
    readTail(`${symbol}_oi_live_binance.jsonl`, since),
    readTail(`${symbol}_oi_live_hyperliquid.jsonl`, since),
    readTail(`${symbol}_taker_binance.jsonl`, since),
    readTail(`${symbol}_funding_live.jsonl`, since),
    readTail(`${symbol}_funding_live_hyperliquid.jsonl`, since),
    readTail("BTCUSDT_1m.jsonl", since),
  ]);

  const oiBy4hPct = roc(oiBy, nowMs, FOUR_HOURS, "openInterestValue");
  const oiBn1hPct = roc(oiBn, nowMs, ONE_HOUR, "openInterestValue");
  const oiBn4hPct = roc(oiBn, nowMs, FOUR_HOURS, "openInterestValue");
  const oiHl1hPct = roc(oiHl, nowMs, ONE_HOUR, "openInterestValue");
  const oiHl4hPct = roc(oiHl, nowMs, FOUR_HOURS, "openInterestValue");
  const breadthVals = [oiBy4hPct, oiBn4hPct, oiHl4hPct].filter((v): v is number => v !== null);
  const oiBreadth4h = breadthVals.length ? breadthVals.reduce((a, b) => a + b, 0) / breadthVals.length : null;

  const taker1hRows = rowsBetween(taker, nowMs - ONE_HOUR, nowMs);
  const taker4hRows = rowsBetween(taker, nowMs - FOUR_HOURS, nowMs);
  const taker1hBuy = taker1hRows.reduce((sum, row) => sum + (num(row.buyVol) ?? 0), 0);
  const taker1hSell = taker1hRows.reduce((sum, row) => sum + (num(row.sellVol) ?? 0), 0);
  const taker4hBuy = taker4hRows.reduce((sum, row) => sum + (num(row.buyVol) ?? 0), 0);
  const taker4hSell = taker4hRows.reduce((sum, row) => sum + (num(row.sellVol) ?? 0), 0);

  const fundingBy = num(lastBefore(fdBy, nowMs)?.fundingRate);
  const fundingHl = num(lastBefore(fdHl, nowMs)?.fundingRate);
  const fundingHlPrev = num(lastBefore(fdHl, nowMs - FOUR_HOURS)?.fundingRate);
  const fundingHlDelta4h = fundingHl !== null && fundingHlPrev !== null ? fundingHl - fundingHlPrev : null;

  const btcDecisionTs = nowMs - 70_000;
  const totalQty = positions.reduce((sum, pos) => sum + pos.qty, 0);
  const totalNotional = positions.reduce((sum, pos) => sum + pos.notional, 0);

  return {
    activeDepth: positions.length,
    ladderPnlPct: avgPnlPct(positions, price),
    totalQty,
    totalNotional,
    trendHostile4h,
    ema200_4h_distPct,
    ema50_4h_slopePct,
    rsi5m,
    rsi1h,
    crsi4h,
    bb20_5m_z,
    slope6hPct: close5m.length >= 73 ? ((featurePrice - close5m[close5m.length - 73]) / close5m[close5m.length - 73]) * 100 : null,
    slope12hPct: close5m.length >= 145 ? ((featurePrice - close5m[close5m.length - 145]) / close5m[close5m.length - 145]) * 100 : null,
    btc1hPct: candleRoc(btc1m, btcDecisionTs, ONE_HOUR),
    btc4hPct: candleRoc(btc1m, btcDecisionTs, FOUR_HOURS),
    oiBy4hPct,
    oiBn1hPct,
    oiBn4hPct,
    oiHl1hPct,
    oiHl4hPct,
    oiBreadth4h,
    taker1h: taker1hSell > 0 ? taker1hBuy / taker1hSell : null,
    taker4h: taker4hSell > 0 ? taker4hBuy / taker4hSell : null,
    fundingBy,
    fundingHl,
    fundingHlDelta4h,
  };
}

export async function evaluateScorePartialFlatten(
  symbol: string,
  nowMs: number,
  price: number,
  positions: LadderPosition[],
  candles5m: Candle[],
  config: BotConfig,
): Promise<ScorePartialFlattenDecision> {
  const cfg = config.scorePartialFlatten;
  const features = await buildScoreFeatures(symbol, nowMs, price, positions, candles5m);
  const deep = scoreGroups(features, DEEP_GROUPS);
  const avoid = scoreGroups(features, AVOID_GROUPS);
  const score = Math.max(deep.score, avoid.score);
  const ladderPnlPct = features.ladderPnlPct;
  const totalQty = features.totalQty ?? 0;
  const totalNotional = features.totalNotional ?? 0;
  const snapshot: ScorePartialFlattenSnapshot = {
    ts: nowMs,
    iso: new Date(nowMs).toISOString(),
    symbol,
    price,
    depth: positions.length,
    ladderPnlPct,
    totalQty,
    totalNotional,
    features,
    deepScore: deep.score,
    avoidScore: avoid.score,
    score,
    deepGroups: deep.details,
    avoidGroups: avoid.details,
  };

  if (!cfg || !cfg.enabled) {
    return { fire: false, reason: "score partial flatten disabled", snapshot };
  }

  if (positions.length < cfg.minDepth) {
    return { fire: false, reason: `depth ${positions.length} < ${cfg.minDepth}`, snapshot };
  }
  if (ladderPnlPct === null || ladderPnlPct > cfg.pnlPctMax) {
    return { fire: false, reason: `ladder PnL ${ladderPnlPct?.toFixed(2) ?? "n/a"}% > ${cfg.pnlPctMax}%`, snapshot };
  }
  if (score < cfg.scoreThreshold) {
    return { fire: false, reason: `score ${score.toFixed(1)} < ${cfg.scoreThreshold}`, snapshot };
  }

  const side = deep.score >= avoid.score ? "deep" : "avoid";
  return {
    fire: true,
    reason: `${side} score ${score.toFixed(1)} >= ${cfg.scoreThreshold}; pnl ${ladderPnlPct.toFixed(2)}%; depth ${positions.length}`,
    snapshot,
  };
}

export function scorePartialFlattenLadderId(positions: LadderPosition[]): string {
  if (positions.length === 0) return "";
  return `ladder_${Math.min(...positions.map(pos => pos.entryTime))}`;
}

export function writeScorePartialFlattenSignal(
  symbol: string,
  decision: ScorePartialFlattenDecision,
  context: Record<string, any>,
): void {
  try {
    const outPath = path.join(DATA_DIR, `${symbol}_score_partial_flatten_signals.jsonl`);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(outPath, JSON.stringify({
      ts: decision.snapshot.iso,
      timestamp: decision.snapshot.ts,
      source: "hedgeguy-bot",
      symbol,
      reason: decision.reason,
      fire: decision.fire,
      ...context,
      snapshot: decision.snapshot,
    }) + "\n");
  } catch {
    // Signal telemetry must never affect trading.
  }
}
