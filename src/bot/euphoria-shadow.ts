import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";

type Candle5m = {
  ts: number;
  endTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

type EuphoriaState = {
  active: boolean;
  activatedAt: number;
  activatedPrice: number | null;
  activatedScore: number;
  maxPriceSinceActive: number | null;
  maxPriceTs: number;
  lastWriteAt: number;
  lastScore: number;
};

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
};

type DataCoverage = {
  hypeRows: number;
  btcRows: number;
  hypeFirstIso: string | null;
  hypeLastIso: string | null;
  btcFirstIso: string | null;
  btcLastIso: string | null;
};

type LoadedData = {
  loadedAt: number;
  hype: Candle5m[];
  btc: Candle5m[];
  coverage: DataCoverage;
};

export type EuphoriaShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  event: "activated" | "still_active" | "pullback_reached" | "cooled" | "snapshot";
  fired: boolean;
  firedCandidates: string[];
  candidates: Candidate[];
  state: EuphoriaState;
  ladder: {
    depth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
  };
  metrics: {
    price: number;
    btcPrice: number | null;
    hypeRet24hPct: number | null;
    btcRet24hPct: number | null;
    hypeRet7dPct: number | null;
    btcRet7dPct: number | null;
    hypeRet30dPct: number | null;
    btcRet30dPct: number | null;
    hypeBtcRel7dPct: number | null;
    hypeBtcRel30dPct: number | null;
    vwap7d: number | null;
    priceVsVwap7dPct: number | null;
    vwap30d: number | null;
    priceVsVwap30dPct: number | null;
    athHigh: number | null;
    athHighIso: string | null;
    distanceToAthPct: number | null;
    localHigh30d: number | null;
    pullbackFromLocalHigh30dPct: number | null;
    pullbackFromEuphoriaHighPct: number | null;
    score: number;
    maxScore: number;
    hasEnoughHistory: boolean;
  };
  action: {
    wouldBlockFreshEntry: boolean;
    wouldCapLateAdds: boolean;
    suggestedMaxDepth: number | null;
    wouldArmPullbackAction: boolean;
    clearReason: string | null;
  };
  dataCoverage: DataCoverage;
  dataGaps: string[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const ONE_MIN = 60_000;
const FIVE_MIN = 5 * ONE_MIN;
const ONE_DAY = 24 * 60 * ONE_MIN;
let dataCache: LoadedData | null = null;
const stateCache = new Map<string, EuphoriaState>();

function cleanState(): EuphoriaState {
  return {
    active: false,
    activatedAt: 0,
    activatedPrice: null,
    activatedScore: 0,
    maxPriceSinceActive: null,
    maxPriceTs: 0,
    lastWriteAt: 0,
    lastScore: 0,
  };
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTs(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
    const d = Date.parse(value);
    return Number.isFinite(d) ? d : null;
  }
  return null;
}

function iso(ts: number | null): string | null {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null;
}

function pct(now: number | null, prev: number | null): number | null {
  return now !== null && prev !== null && prev > 0 ? (now / prev - 1) * 100 : null;
}

function ratioPct(nowA: number | null, nowB: number | null, prevA: number | null, prevB: number | null): number | null {
  if (nowA === null || nowB === null || prevA === null || prevB === null || nowB <= 0 || prevB <= 0) return null;
  const nowRatio = nowA / nowB;
  const prevRatio = prevA / prevB;
  return prevRatio > 0 ? (nowRatio / prevRatio - 1) * 100 : null;
}

function normalizeRow(row: any, intervalMs = FIVE_MIN): Candle5m | null {
  const ts = parseTs(row.timestamp ?? row.ts ?? row.openTime ?? row.time ?? row.start);
  const open = num(row.open ?? row.o);
  const high = num(row.high ?? row.h);
  const low = num(row.low ?? row.l);
  const close = num(row.close ?? row.c);
  if (ts === null || open === null || high === null || low === null || close === null) return null;
  const volume = num(row.volume ?? row.v) ?? 0;
  const turnover = num(row.turnover ?? row.t) ?? volume * close;
  return { ts, endTs: ts + intervalMs, open, high, low, close, volume, turnover };
}

function readJsonCandles(file: string): Candle5m[] {
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const rows = Array.isArray(raw) ? raw : raw.data || raw.result || raw.list || [];
    return rows.map(normalizeRow).filter((row: Candle5m | null): row is Candle5m => row !== null);
  } catch {
    return [];
  }
}

function readJsonlCandles(file: string, intervalMs = FIVE_MIN): Candle5m[] {
  if (!fs.existsSync(file)) return [];
  const rows: Candle5m[] = [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = normalizeRow(JSON.parse(line), intervalMs);
      if (parsed) rows.push(parsed);
    } catch {
      // Ignore partial-copy tails.
    }
  }
  return rows;
}

function aggregate1mTo5m(candles: Candle5m[]): Candle5m[] {
  const buckets = new Map<number, Candle5m[]>();
  for (const candle of candles) {
    const bucketTs = Math.floor(candle.ts / FIVE_MIN) * FIVE_MIN;
    const bucket = buckets.get(bucketTs) ?? [];
    bucket.push(candle);
    buckets.set(bucketTs, bucket);
  }

  const out: Candle5m[] = [];
  for (const [ts, bucket] of buckets.entries()) {
    bucket.sort((a, b) => a.ts - b.ts);
    if (bucket.length < 3) continue;
    const open = bucket[0].open;
    const close = bucket[bucket.length - 1].close;
    const high = Math.max(...bucket.map(c => c.high));
    const low = Math.min(...bucket.map(c => c.low));
    const volume = bucket.reduce((sum, c) => sum + c.volume, 0);
    const turnover = bucket.reduce((sum, c) => sum + c.turnover, 0);
    out.push({ ts, endTs: ts + FIVE_MIN, open, high, low, close, volume, turnover });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function mergeCandles(...sources: Candle5m[][]): Candle5m[] {
  const byTs = new Map<number, Candle5m>();
  for (const candle of sources.flat()) byTs.set(candle.ts, candle);
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

function loadCandlesFor(symbol: string): Candle5m[] {
  const full = readJsonCandles(path.join(DATA_DIR, `${symbol}_5_full.json`));
  const compact = readJsonCandles(path.join(DATA_DIR, `${symbol}_5.json`));
  const live1m = aggregate1mTo5m(readJsonlCandles(path.join(DATA_DIR, `${symbol}_1m.jsonl`), ONE_MIN));
  const live = readJsonlCandles(path.join(DATA_DIR, `${symbol}_5m.jsonl`));
  return mergeCandles(full, compact, live1m, live);
}

function coverageFor(hype: Candle5m[], btc: Candle5m[]): DataCoverage {
  return {
    hypeRows: hype.length,
    btcRows: btc.length,
    hypeFirstIso: iso(hype[0]?.endTs ?? null),
    hypeLastIso: iso(hype[hype.length - 1]?.endTs ?? null),
    btcFirstIso: iso(btc[0]?.endTs ?? null),
    btcLastIso: iso(btc[btc.length - 1]?.endTs ?? null),
  };
}

function loadData(nowMs: number, cacheTtlSec: number): LoadedData {
  if (dataCache && nowMs - dataCache.loadedAt <= cacheTtlSec * 1000) return dataCache;
  const hype = loadCandlesFor("HYPEUSDT");
  const btc = loadCandlesFor("BTCUSDT");
  dataCache = {
    loadedAt: nowMs,
    hype,
    btc,
    coverage: coverageFor(hype, btc),
  };
  return dataCache;
}

function statePath(symbol: string): string {
  return path.join(DATA_DIR, `${symbol}_euphoria_shadow_state.json`);
}

function loadState(symbol: string): EuphoriaState {
  const cached = stateCache.get(symbol);
  if (cached) return cached;
  const file = statePath(symbol);
  if (fs.existsSync(file)) {
    try {
      const parsed = { ...cleanState(), ...JSON.parse(fs.readFileSync(file, "utf8")) } as EuphoriaState;
      stateCache.set(symbol, parsed);
      return parsed;
    } catch {
      // Use clean state on partial/corrupt copies.
    }
  }
  const state = cleanState();
  stateCache.set(symbol, state);
  return state;
}

function saveState(symbol: string, state: EuphoriaState): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  stateCache.set(symbol, state);
  fs.writeFileSync(statePath(symbol), JSON.stringify(state, null, 2));
}

function lastAtOrBefore(candles: Candle5m[], endTs: number): Candle5m | null {
  let lo = 0;
  let hi = candles.length - 1;
  let found: Candle5m | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (candles[mid].endTs <= endTs) {
      found = candles[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function windowCandles(candles: Candle5m[], endTs: number, lookbackMs: number): Candle5m[] {
  const start = endTs - lookbackMs;
  return candles.filter(c => c.endTs > start && c.endTs <= endTs);
}

function vwap(candles: Candle5m[]): number | null {
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);
  const turnover = candles.reduce((sum, c) => sum + c.turnover, 0);
  return volume > 0 ? turnover / volume : null;
}

function highInfo(candles: Candle5m[]): { high: number | null; ts: number } {
  let high: number | null = null;
  let ts = 0;
  for (const candle of candles) {
    if (high === null || candle.high > high) {
      high = candle.high;
      ts = candle.endTs;
    }
  }
  return { high, ts };
}

function avgEntry(positions: LadderPosition[]): number | null {
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  return qty > 0 ? positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / qty : null;
}

function ladderStats(positions: LadderPosition[], price: number) {
  const avg = avgEntry(positions);
  return {
    depth: positions.length,
    avgEntry: avg,
    pnlPct: avg !== null ? (price / avg - 1) * 100 : null,
    totalNotional: positions.reduce((sum, p) => sum + p.notional, 0),
  };
}

function buildDecision(args: {
  symbol: string;
  nowMs: number;
  event: EuphoriaShadowDecision["event"];
  firedCandidates: string[];
  candidates: Candidate[];
  state: EuphoriaState;
  positions: LadderPosition[];
  metrics: EuphoriaShadowDecision["metrics"];
  coverage: DataCoverage;
  dataGaps: string[];
  config: BotConfig;
}): EuphoriaShadowDecision {
  const cfg = args.config.euphoriaShadow!;
  const active = args.state.active;
  const depth = args.positions.length;
  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    event: args.event,
    fired: args.firedCandidates.length > 0,
    firedCandidates: args.firedCandidates,
    candidates: args.candidates,
    state: args.state,
    ladder: ladderStats(args.positions, args.metrics.price),
    metrics: args.metrics,
    action: {
      wouldBlockFreshEntry: active && depth === 0,
      wouldCapLateAdds: active && depth >= cfg.lateAddBlockDepth,
      suggestedMaxDepth: active ? cfg.suggestedMaxDepth : null,
      wouldArmPullbackAction: active && depth >= cfg.armPullbackDepth,
      clearReason: args.event === "pullback_reached" || args.event === "cooled"
        ? args.firedCandidates.join(",")
        : null,
    },
    dataCoverage: args.coverage,
    dataGaps: args.dataGaps,
  };
}

export function evaluateEuphoriaShadow(args: {
  symbol: string;
  nowMs: number;
  positions: LadderPosition[];
  config: BotConfig;
}): EuphoriaShadowDecision | null {
  const cfg = args.config.euphoriaShadow;
  if (!cfg?.enabled) return null;

  const loaded = loadData(args.nowMs, cfg.cacheTtlSec);
  const hypeClosed = loaded.hype.filter(c => c.endTs <= args.nowMs);
  const btcClosed = loaded.btc.filter(c => c.endTs <= args.nowMs);
  const latest = hypeClosed[hypeClosed.length - 1] ?? null;
  const btcLatest = latest ? lastAtOrBefore(btcClosed, latest.endTs) : null;
  const gaps: string[] = [];
  if (!latest) gaps.push("missing HYPE 5m history");
  if (!btcLatest) gaps.push("missing aligned BTC 5m history");
  if (!latest || !btcLatest) return null;
  if ((args.nowMs - latest.endTs) / ONE_MIN > cfg.staleDataMaxMin) gaps.push(`stale HYPE 5m data age>${cfg.staleDataMaxMin}m`);
  if ((args.nowMs - btcLatest.endTs) / ONE_MIN > cfg.staleDataMaxMin) gaps.push(`stale BTC 5m data age>${cfg.staleDataMaxMin}m`);

  const c24h = lastAtOrBefore(hypeClosed, latest.endTs - ONE_DAY);
  const b24h = lastAtOrBefore(btcClosed, latest.endTs - ONE_DAY);
  const c7d = lastAtOrBefore(hypeClosed, latest.endTs - 7 * ONE_DAY);
  const b7d = lastAtOrBefore(btcClosed, latest.endTs - 7 * ONE_DAY);
  const c30d = lastAtOrBefore(hypeClosed, latest.endTs - 30 * ONE_DAY);
  const b30d = lastAtOrBefore(btcClosed, latest.endTs - 30 * ONE_DAY);
  const w7d = windowCandles(hypeClosed, latest.endTs, 7 * ONE_DAY);
  const w30d = windowCandles(hypeClosed, latest.endTs, 30 * ONE_DAY);
  const wAth = windowCandles(hypeClosed, latest.endTs, cfg.athLookbackDays * ONE_DAY);
  const wLocal = windowCandles(hypeClosed, latest.endTs, cfg.localHighLookbackDays * ONE_DAY);

  const hasEnoughHistory = !!(c7d && b7d && c30d && b30d && w7d.length >= 7 * 24 * 12 * 0.9 && w30d.length >= 30 * 24 * 12 * 0.9);
  if (!hasEnoughHistory) gaps.push("insufficient 7d/30d aligned HYPE/BTC history");

  const vwap7d = vwap(w7d);
  const vwap30d = vwap(w30d);
  const ath = highInfo(wAth.length ? wAth : hypeClosed);
  const localHigh = highInfo(wLocal);
  const hypeRet24hPct = pct(latest.close, c24h?.close ?? null);
  const btcRet24hPct = pct(btcLatest.close, b24h?.close ?? null);
  const hypeRet7dPct = pct(latest.close, c7d?.close ?? null);
  const btcRet7dPct = pct(btcLatest.close, b7d?.close ?? null);
  const hypeRet30dPct = pct(latest.close, c30d?.close ?? null);
  const btcRet30dPct = pct(btcLatest.close, b30d?.close ?? null);
  const rel7d = ratioPct(latest.close, btcLatest.close, c7d?.close ?? null, b7d?.close ?? null);
  const rel30d = ratioPct(latest.close, btcLatest.close, c30d?.close ?? null, b30d?.close ?? null);
  const priceVsVwap7dPct = pct(latest.close, vwap7d);
  const priceVsVwap30dPct = pct(latest.close, vwap30d);
  const distanceToAthPct = pct(latest.close, ath.high);
  const pullbackFromLocalHigh30dPct = pct(latest.close, localHigh.high);

  const prevState = loadState(args.symbol);
  const stateHigh = prevState.active && prevState.maxPriceSinceActive !== null
    ? Math.max(prevState.maxPriceSinceActive, latest.high)
    : latest.high;
  const pullbackFromEuphoriaHighPct = pct(latest.close, stateHigh);

  const candidates: Candidate[] = [
    {
      name: "hype_btc_rel7d_hot_shadow",
      fired: rel7d !== null && rel7d >= cfg.rel7dPctMin,
      reason: `HYPE/BTC 7d=${rel7d?.toFixed(2) ?? "NA"}% >= ${cfg.rel7dPctMin}%`,
    },
    {
      name: "hype_btc_rel30d_hot_shadow",
      fired: rel30d !== null && rel30d >= cfg.rel30dPctMin,
      reason: `HYPE/BTC 30d=${rel30d?.toFixed(2) ?? "NA"}% >= ${cfg.rel30dPctMin}%`,
    },
    {
      name: "hype_above_vwap7d_hot_shadow",
      fired: priceVsVwap7dPct !== null && priceVsVwap7dPct >= cfg.priceVsVwap7dPctMin,
      reason: `priceVsVwap7d=${priceVsVwap7dPct?.toFixed(2) ?? "NA"}% >= ${cfg.priceVsVwap7dPctMin}%`,
    },
    {
      name: "hype_near_ath_shadow",
      fired: distanceToAthPct !== null && distanceToAthPct >= cfg.nearAthPctMin,
      reason: `distanceToATH=${distanceToAthPct?.toFixed(2) ?? "NA"}% >= ${cfg.nearAthPctMin}%`,
    },
    {
      name: "btc_not_confirming_hype_run_shadow",
      fired:
        hypeRet7dPct !== null &&
        btcRet7dPct !== null &&
        hypeRet7dPct >= cfg.hype7dMinPctForBtcDivergence &&
        btcRet7dPct <= cfg.btc7dMaxPct,
      reason: `HYPE7d=${hypeRet7dPct?.toFixed(2) ?? "NA"}% >= ${cfg.hype7dMinPctForBtcDivergence}%; BTC7d=${btcRet7dPct?.toFixed(2) ?? "NA"}% <= ${cfg.btc7dMaxPct}%`,
    },
  ];
  const score = candidates.filter(c => c.fired).length;
  const maxScore = candidates.length;
  const hot = hasEnoughHistory && gaps.every(g => !g.startsWith("stale")) && score >= cfg.minScore;
  const pullbackReached = prevState.active && pullbackFromEuphoriaHighPct !== null && pullbackFromEuphoriaHighPct <= -Math.abs(cfg.pullbackFromHighClearPct);
  const cooled = prevState.active && score <= cfg.clearScore;
  let nextState = { ...prevState };
  let event: EuphoriaShadowDecision["event"] | null = null;
  let firedCandidates: string[] = [];

  if (prevState.active) {
    nextState = {
      ...nextState,
      maxPriceSinceActive: stateHigh,
      maxPriceTs: stateHigh !== prevState.maxPriceSinceActive ? latest.endTs : prevState.maxPriceTs,
      lastScore: score,
    };
    if (pullbackReached) {
      event = "pullback_reached";
      firedCandidates = ["euphoria_pullback_reached_shadow"];
      nextState = cleanState();
    } else if (cooled) {
      event = "cooled";
      firedCandidates = ["euphoria_cooled_shadow"];
      nextState = cleanState();
    } else if (args.nowMs - prevState.lastWriteAt >= cfg.cooldownMin * ONE_MIN) {
      event = "still_active";
      firedCandidates = ["euphoria_still_active_shadow"];
      nextState.lastWriteAt = args.nowMs;
    }
  } else if (hot) {
    event = "activated";
    firedCandidates = ["euphoria_gate_active_shadow", ...candidates.filter(c => c.fired).map(c => c.name)];
    nextState = {
      active: true,
      activatedAt: args.nowMs,
      activatedPrice: latest.close,
      activatedScore: score,
      maxPriceSinceActive: latest.high,
      maxPriceTs: latest.endTs,
      lastWriteAt: args.nowMs,
      lastScore: score,
    };
  }

  const metrics: EuphoriaShadowDecision["metrics"] = {
    price: latest.close,
    btcPrice: btcLatest.close,
    hypeRet24hPct,
    btcRet24hPct,
    hypeRet7dPct,
    btcRet7dPct,
    hypeRet30dPct,
    btcRet30dPct,
    hypeBtcRel7dPct: rel7d,
    hypeBtcRel30dPct: rel30d,
    vwap7d,
    priceVsVwap7dPct,
    vwap30d,
    priceVsVwap30dPct,
    athHigh: ath.high,
    athHighIso: iso(ath.ts),
    distanceToAthPct,
    localHigh30d: localHigh.high,
    pullbackFromLocalHigh30dPct,
    pullbackFromEuphoriaHighPct,
    score,
    maxScore,
    hasEnoughHistory,
  };

  saveState(args.symbol, nextState);
  if (!event) return null;
  return buildDecision({
    symbol: args.symbol,
    nowMs: args.nowMs,
    event,
    firedCandidates,
    candidates,
    state: nextState,
    positions: args.positions,
    metrics,
    coverage: loaded.coverage,
    dataGaps: gaps,
    config: args.config,
  });
}

export function writeEuphoriaShadowSignal(symbol: string, decision: EuphoriaShadowDecision): void {
  const outPath = path.join(DATA_DIR, `${symbol}_euphoria_shadow.jsonl`);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
