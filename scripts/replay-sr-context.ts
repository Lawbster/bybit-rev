import type { Candle } from "./hype-freerun-canonical-replay";
import type { Candle as NativeCandle } from "../src/fetch-candles";
import { SRMemoryZoneEngine, type SRMemoryZoneConfig } from "../src/bot/sr-memory-zones";
import type { CandleCoverageStatus } from "../src/bot/context-manager";

/** Shared live zone engine, rebuilt only from a closed historical prefix. */
export class ReplaySrContext {
  readonly engine: SRMemoryZoneEngine;
  private bars: NativeCandle[] = [];
  private runs: number[] = [];
  private buildAt = -Infinity;
  private lastQueryAt = -Infinity;
  constructor(candles: Candle[], readonly config: SRMemoryZoneConfig) {
    this.engine = new SRMemoryZoneEngine(config);
    // A missing source minute invalidates that 5m candle; never fabricate coverage.
    for (let i = 0; i < candles.length;) {
      const start = Math.floor(candles[i].ts / 300000) * 300000, rows: Candle[] = [];
      while (i < candles.length && candles[i].ts < start + 300000) rows.push(candles[i++]);
      if (rows.length !== 5 || rows.some((c, k) => c.ts !== start + k * 60000 || c.endTs !== c.ts + 60000)) continue;
      const prev = this.bars.at(-1);
      this.runs.push(prev?.timestamp === start - 300000 ? (this.runs.at(-1) ?? 0) + 1 : 1);
      this.bars.push({ timestamp: start, open: rows[0].open, close: rows[4].close,
        high: Math.max(...rows.map(x => x.high)), low: Math.min(...rows.map(x => x.low)),
        volume: rows.reduce((a, c) => a + c.volume, 0), turnover: rows.reduce((a, c) => a + c.turnover, 0) });
    }
  }
  at(now: number): { engine: SRMemoryZoneEngine; coverage: CandleCoverageStatus } {
    if (now < this.lastQueryAt) throw new Error("S/R replay must move forward; create a fresh context for a repeat");
    this.lastQueryAt = now;
    const latestClosedTs = Math.floor(now / 300000) * 300000 - 300000;
    let lo = 0, hi = this.bars.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (this.bars[m].timestamp <= latestClosedTs) lo = m + 1; else hi = m; }
    const idx = lo - 1, expectedBars = Math.max(1, Math.ceil(this.config.recentDays * 86400000 / 300000));
    const count = idx >= 0 && this.bars[idx].timestamp === latestClosedTs ? Math.min(expectedBars, this.runs[idx]) : 0;
    const coverage: CandleCoverageStatus = { healthy: count >= expectedBars,
      horizonStart: latestClosedTs - (expectedBars - 1) * 300000, latestClosedTs,
      earliestContinuousTs: count ? latestClosedTs - (count - 1) * 300000 : null,
      expectedBars, actualContinuousBars: count,
      ...(count < expectedBars ? { firstMissingTs: latestClosedTs - count * 300000, reason: "incomplete source-minute coverage" } : {}) };
    const boundary = Math.floor(now / (this.config.tfMin * 60000)) * this.config.tfMin * 60000;
    if (boundary > this.buildAt) {
      // Extra left/right pivot context precedes the confirmation-memory horizon.
      const warm = Math.ceil((this.config.pivotLeft + this.config.pivotRight + 2) * this.config.tfMin / 5);
      this.engine.rebuild(this.bars.slice(Math.max(0, lo - expectedBars - warm), lo), now);
      this.buildAt = boundary;
    }
    return { engine: this.engine, coverage };
  }
}
