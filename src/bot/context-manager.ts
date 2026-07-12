// ─────────────────────────────────────────────
// LiveContextManager — keeps a rolling 5m candle window hydrated
// from the local data file + live Bybit API pulls.
//
// Usage in a bot poll loop:
//
//   const ctx_mgr = new LiveContextManager(executor, "HYPEUSDT");
//   await ctx_mgr.init();          // once on startup
//
//   // each poll tick:
//   await ctx_mgr.refresh();       // merges latest ~200 candles from API
//   const ctx = ctx_mgr.getContext();
//   if (ctx.confluenceGrade !== "none" && ctx.confluenceScore >= 30) { ... }
//
// Why a rolling window + local seed?
//   The technical engine needs ~8,640 5m candles (30 days) for 4H/1H zones
//   and 90 daily pivots for 1D zone detection. The Bybit API only returns
//   1000 candles per call (3.5 days of 5m). The local data files already
//   cover months of history, so we seed from them and append live data
//   incrementally — no repeated bulk fetches during operation.
// ─────────────────────────────────────────────

import * as fs   from "fs";
import * as path from "path";
import { Candle } from "../fetch-candles";
import { getContext, TechnicalContext } from "../technical-engine";
import { Executor } from "./executor";

// Rolling window: keep this many 5m candles in memory.
// 40,320 = 140 days × 288 candles/day.
// Covers 1D zone lookback (90 bars) + satisfies the 120-day
// asset class detection threshold in technical-engine.ts.
// Memory cost: ~40k × ~80 bytes ≈ 3.2 MB — negligible.
const WINDOW_SIZE = 40_320;
const FIVE_MIN_MS = 5 * 60 * 1000;

// How many 5m candles to fetch from the API on each refresh.
// 200 = ~16.7 hours of 5m bars. Covers any gap since last poll.
const REFRESH_LIMIT = 200;
const BACKFILL_LIMIT = 1000;
const BACKFILL_DELAY_MS = 200;
const MAX_BACKFILL_PAGES = Math.ceil(WINDOW_SIZE / BACKFILL_LIMIT) + 2;

export interface CandleCoverageStatus {
  healthy: boolean;
  horizonStart: number;
  latestClosedTs: number;
  earliestContinuousTs: number | null;
  expectedBars: number;
  actualContinuousBars: number;
  firstMissingTs?: number;
  reason?: string;
}

export interface ContextHydrationStatus {
  pagesFetched: number;
  stoppedReason: "window_complete" | "listing_start" | "api_error" | "no_progress" | "page_limit";
  error?: string;
}

export class LiveContextManager {
  private symbol: string;
  private executor: Executor;
  private candles: Candle[] = [];
  private lastContext: TechnicalContext | null = null;
  private hydrationStatus: ContextHydrationStatus = { pagesFetched: 0, stoppedReason: "page_limit" };

  constructor(executor: Executor, symbol: string) {
    this.executor = executor;
    this.symbol   = symbol;
  }

  // ── init ──────────────────────────────────────────────────────
  // Call once on bot startup. Loads local seed file, then fetches
  // any candles newer than the seed from the API to fill the gap.
  async init(): Promise<void> {
    this.candles = this._loadSeed();

    const nowMs = Date.now();
    this.hydrationStatus = await this._hydrateContinuousWindow(nowMs, BACKFILL_DELAY_MS);

    console.log(`[ContextManager:${this.symbol}] init: ${this.candles.length} candles, last=${new Date(this.candles[this.candles.length-1]?.timestamp ?? 0).toISOString().slice(0,16)}Z, backfillPages=${this.hydrationStatus.pagesFetched}, backfillStop=${this.hydrationStatus.stoppedReason}`);
  }

  // ── refresh ───────────────────────────────────────────────────
  // Call on every poll tick. Fetches the most recent REFRESH_LIMIT
  // 5m candles from the API and merges them into the window.
  async refresh(): Promise<void> {
    const fresh = await this.executor.getCandles(this.symbol, "5", REFRESH_LIMIT);
    this._merge(fresh);
    // Recompute context with updated candles
    this.lastContext = null;  // invalidate cache
  }

  // ── getContext ────────────────────────────────────────────────
  // Returns the TechnicalContext for the current candle window.
  // Result is cached per refresh cycle — safe to call multiple times.
  getContext(): TechnicalContext {
    if (!this.lastContext) {
      if (this.candles.length < 50) {
        throw new Error(`[ContextManager:${this.symbol}] Not enough candles (${this.candles.length}), call init() first`);
      }
      this.lastContext = getContext(this.symbol, this.candles);
    }
    return this.lastContext;
  }

  // ── windowSize ────────────────────────────────────────────────
  windowSize(): number { return this.candles.length; }

  // ── getCandles ────────────────────────────────────────────────
  // Exposes the rolling 5m window for downstream engines (e.g. SRLevelEngine)
  // that need raw candles. Returns the live array reference — callers must NOT
  // mutate it. Cheap; no copy.
  getCandles(): Candle[] { return this.candles; }

  getHydrationStatus(): ContextHydrationStatus { return { ...this.hydrationStatus }; }

  getClosedCoverageStatus(nowMs: number, horizonDays: number): CandleCoverageStatus {
    const latestClosedTs = Math.floor(nowMs / FIVE_MIN_MS) * FIVE_MIN_MS - FIVE_MIN_MS;
    const expectedBars = Math.max(1, Math.ceil(horizonDays * 86400000 / FIVE_MIN_MS));
    const horizonStart = latestClosedTs - (expectedBars - 1) * FIVE_MIN_MS;
    const tail = this._continuousClosedTail(latestClosedTs, horizonStart);
    const healthy = tail.actualContinuousBars >= expectedBars;

    return {
      healthy,
      horizonStart,
      latestClosedTs,
      earliestContinuousTs: tail.earliestContinuousTs,
      expectedBars,
      actualContinuousBars: tail.actualContinuousBars,
      ...(tail.firstMissingTs === undefined ? {} : { firstMissingTs: tail.firstMissingTs }),
      ...(healthy ? {} : {
        reason: tail.firstMissingTs === undefined
          ? "no closed candles available"
          : `missing 5m candle at ${new Date(tail.firstMissingTs).toISOString()}`,
      }),
    };
  }

  // ── _loadSeed ─────────────────────────────────────────────────
  // Tries SYMBOL_5_full.json first, then SYMBOL_5.json.
  // Returns empty array if neither exists.
  private _loadSeed(): Candle[] {
    const dataDir = path.resolve(__dirname, "../../data");
    const full = path.join(dataDir, `${this.symbol}_5_full.json`);
    const std  = path.join(dataDir, `${this.symbol}_5.json`);
    const file = fs.existsSync(full) ? full : fs.existsSync(std) ? std : null;

    if (!file) {
      console.warn(`[ContextManager:${this.symbol}] No local seed file — starting from API only`);
      return [];
    }

    const raw: Candle[] = JSON.parse(fs.readFileSync(file, "utf-8"));
    raw.sort((a, b) => a.timestamp - b.timestamp);
    const byTimestamp = new Map<number, Candle>();
    for (const candle of raw) byTimestamp.set(candle.timestamp, candle);
    const deduped = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);

    // Keep only the most recent WINDOW_SIZE candles from the seed
    const seed = deduped.slice(-WINDOW_SIZE);
    console.log(`[ContextManager:${this.symbol}] Seed loaded: ${seed.length} candles from ${file.split(/[\\/]/).pop()}`);
    return seed;
  }

  private async _hydrateContinuousWindow(nowMs: number, delayMs: number): Promise<ContextHydrationStatus> {
    const latestClosedTs = Math.floor(nowMs / FIVE_MIN_MS) * FIVE_MIN_MS - FIVE_MIN_MS;
    const targetClosedBars = WINDOW_SIZE - 1; // reserve one slot for the forming REST candle
    let cursorEnd = nowMs;
    let previousTailStart: number | null = null;

    for (let page = 0; page < MAX_BACKFILL_PAGES; page++) {
      let fresh: Candle[];
      try {
        fresh = await this.executor.getCandles(this.symbol, "5", BACKFILL_LIMIT, cursorEnd);
      } catch (err: any) {
        return {
          pagesFetched: page,
          stoppedReason: "api_error",
          error: err?.message ?? String(err),
        };
      }

      if (fresh.length === 0) {
        return { pagesFetched: page + 1, stoppedReason: "listing_start" };
      }

      this._merge(fresh);
      const tail = this._continuousClosedTail(latestClosedTs);
      if (tail.actualContinuousBars >= targetClosedBars) {
        return { pagesFetched: page + 1, stoppedReason: "window_complete" };
      }

      const oldestFreshTs = fresh.reduce((min, candle) => Math.min(min, candle.timestamp), Infinity);
      const nextEnd = (tail.earliestContinuousTs ?? oldestFreshTs) - 1;
      if (
        !Number.isFinite(nextEnd) ||
        nextEnd >= cursorEnd ||
        (previousTailStart !== null && tail.earliestContinuousTs === previousTailStart)
      ) {
        return { pagesFetched: page + 1, stoppedReason: "no_progress" };
      }

      previousTailStart = tail.earliestContinuousTs;
      cursorEnd = nextEnd;
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return { pagesFetched: MAX_BACKFILL_PAGES, stoppedReason: "page_limit" };
  }

  private _continuousClosedTail(
    latestClosedTs: number,
    minimumTs: number = Number.NEGATIVE_INFINITY,
  ): { earliestContinuousTs: number | null; actualContinuousBars: number; firstMissingTs?: number } {
    const timestamps = new Set(this.candles.map(candle => candle.timestamp));
    let actualContinuousBars = 0;
    let earliestContinuousTs: number | null = null;

    for (let ts = latestClosedTs; ts >= minimumTs; ts -= FIVE_MIN_MS) {
      if (!timestamps.has(ts)) {
        return { earliestContinuousTs, actualContinuousBars, firstMissingTs: ts };
      }
      earliestContinuousTs = ts;
      actualContinuousBars++;
      if (actualContinuousBars >= WINDOW_SIZE) break;
    }

    return { earliestContinuousTs, actualContinuousBars };
  }

  // ── _merge ─────────────────────────────────────────────────────
  // Upserts candles by timestamp so a forming REST candle is replaced by
  // later snapshots and, eventually, its final closed OHLC. New timestamps
  // are appended, sorted ascending, and trimmed to WINDOW_SIZE.
  private _merge(fresh: Candle[]): void {
    if (fresh.length === 0) return;

    const indexByTimestamp = new Map<number, number>();
    this.candles.forEach((candle, index) => indexByTimestamp.set(candle.timestamp, index));
    let appended = false;

    for (const candle of fresh) {
      const existingIndex = indexByTimestamp.get(candle.timestamp);
      if (existingIndex === undefined) {
        indexByTimestamp.set(candle.timestamp, this.candles.length);
        this.candles.push(candle);
        appended = true;
      } else {
        this.candles[existingIndex] = candle;
      }
    }

    if (appended) this.candles.sort((a, b) => a.timestamp - b.timestamp);

    // Trim to window size
    if (this.candles.length > WINDOW_SIZE) {
      this.candles = this.candles.slice(-WINDOW_SIZE);
    }
  }
}
