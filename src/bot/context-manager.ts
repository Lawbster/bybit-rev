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

// How many 5m candles to fetch from the API on each refresh.
// 200 = ~16.7 hours of 5m bars. Covers any gap since last poll.
const REFRESH_LIMIT = 200;

export class LiveContextManager {
  private symbol: string;
  private executor: Executor;
  private candles: Candle[] = [];
  private lastContext: TechnicalContext | null = null;

  constructor(executor: Executor, symbol: string) {
    this.executor = executor;
    this.symbol   = symbol;
  }

  // ── init ──────────────────────────────────────────────────────
  // Call once on bot startup. Loads local seed file, then fetches
  // any candles newer than the seed from the API to fill the gap.
  async init(): Promise<void> {
    this.candles = this._loadSeed();

    // If seed is empty or very old, do a one-time bulk fetch from API
    // to get at least REFRESH_LIMIT recent candles.
    const latestSeedTs = this.candles.length > 0
      ? this.candles[this.candles.length - 1].timestamp
      : 0;

    const nowMs = Date.now();
    const gapMs = nowMs - latestSeedTs;
    const fiveMins = 5 * 60 * 1000;

    if (gapMs > fiveMins) {
      // Fetch most recent candles from API to cover the gap
      // (up to REFRESH_LIMIT; longer gaps covered by next refresh cycles)
      const fresh = await this.executor.getCandles(this.symbol, "5", REFRESH_LIMIT);
      this._merge(fresh);
    }

    console.log(`[ContextManager:${this.symbol}] init: ${this.candles.length} candles, last=${new Date(this.candles[this.candles.length-1]?.timestamp ?? 0).toISOString().slice(0,16)}Z`);
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

    // Keep only the most recent WINDOW_SIZE candles from the seed
    const seed = raw.slice(-WINDOW_SIZE);
    console.log(`[ContextManager:${this.symbol}] Seed loaded: ${seed.length} candles from ${file.split(/[\\/]/).pop()}`);
    return seed;
  }

  // ── _merge ─────────────────────────────────────────────────────
  // Appends new candles, deduplicates by timestamp, sorts ascending,
  // trims to WINDOW_SIZE.
  private _merge(fresh: Candle[]): void {
    if (fresh.length === 0) return;

    const existingTs = new Set(this.candles.map(c => c.timestamp));
    const toAdd = fresh.filter(c => !existingTs.has(c.timestamp));

    if (toAdd.length === 0) return;

    this.candles.push(...toAdd);
    this.candles.sort((a, b) => a.timestamp - b.timestamp);

    // Trim to window size
    if (this.candles.length > WINDOW_SIZE) {
      this.candles = this.candles.slice(-WINDOW_SIZE);
    }
  }
}
