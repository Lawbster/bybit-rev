import type { Candle } from "../fetch-candles";

export const CLOSED_BAR_TIMING_VERSION = "closed-bars-v1";
const DAY = 86_400_000;

export interface BarIntervals {
  sourceIntervalMs: number;
  targetIntervalMs: number;
}

export interface FinalCandleObservation {
  candle: Readonly<Candle>;
  receivedAt: number;
  final: true;
}

export type CandleAvailability =
  | { mode: "modeled_bar_end"; publicationLagMs: number }
  | { mode: "observed_final_receipt" };

/** An archived final bar, NOT necessarily available at a particular decision. */
export interface TimedClosedBar {
  readonly candle: Readonly<Candle>; // timestamp is UTC bucket START
  readonly barEnd: number;
  readonly availableAt: number;
}

export type ClosedWindowResult =
  | { ready: true; decisionAt: number; expectedBarStart: number;
      availableAt: number; bars: readonly TimedClosedBar[] }
  | { ready: false; decisionAt: number; expectedBarStart: number;
      reason: "missing_bar" | "bar_not_available"; blockedBarStart: number };

function integer(value: number, name: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${name}: ${value}`);
}

function validateCandle(c: Readonly<Candle>, interval: number): void {
  integer(c.timestamp, "UTC epoch-ms bar start");
  integer(c.timestamp + interval, "bar end");
  if (c.timestamp % interval !== 0) throw new Error("Source bar is not UTC interval-aligned");
  if (![c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0)
      || ![c.volume, c.turnover].every(x => Number.isFinite(x) && x >= 0)
      || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) {
    throw new Error(`Invalid OHLCV at ${c.timestamp}`);
  }
}

/** Research only. Fixed, UTC-aligned intraday/daily intervals; no calendar months
 * or exchange sessions. Inputs are immutable final observations, not forming-bar
 * updates. Conflicting final revisions need a versioned observation tape instead.
 */
export class ClosedBarSeries {
  readonly bars: readonly TimedClosedBar[];
  readonly availability: Readonly<CandleAvailability>;
  readonly sourceIntervalMs: number;
  readonly targetIntervalMs: number;
  private readonly byStart = new Map<number, TimedClosedBar>();

  static fromHistorical(candles: readonly Readonly<Candle>[],
    options: BarIntervals & { publicationLagMs: number }): ClosedBarSeries {
    integer(options.publicationLagMs, "publication lag");
    return new ClosedBarSeries(candles.map(candle => ({ candle,
      receivedAt: candle.timestamp + options.sourceIntervalMs + options.publicationLagMs, final: true })),
    options, { mode: "modeled_bar_end", publicationLagMs: options.publicationLagMs });
  }

  static fromObservations(rows: readonly FinalCandleObservation[], options: BarIntervals): ClosedBarSeries {
    return new ClosedBarSeries(rows, options, { mode: "observed_final_receipt" });
  }

  private constructor(rows: readonly FinalCandleObservation[], options: BarIntervals, availability: CandleAvailability) {
    const { sourceIntervalMs: source, targetIntervalMs: target } = options;
    integer(source, "source interval", 1); integer(target, "target interval", 1);
    if (DAY % source !== 0 || DAY % target !== 0 || target % source !== 0) {
      throw new Error("Intervals must divide a UTC day and target must be a multiple of source");
    }
    this.sourceIntervalMs = source; this.targetIntervalMs = target;
    this.availability = Object.freeze({ ...availability });
    const unique = new Map<number, TimedClosedBar>();
    for (const row of rows) {
      if (row.final !== true) throw new Error("A forming observation is not a final candle");
      validateCandle(row.candle, source); integer(row.receivedAt, "final receipt");
      const end = row.candle.timestamp + source;
      if (row.receivedAt < end) throw new Error("Final candle receipt precedes bar end");
      // Copy only the declared fields, so caller mutations/extraneous metadata cannot
      // change a prior feature or make otherwise identical duplicates conflict.
      const c = row.candle;
      const candle: Readonly<Candle> = Object.freeze({ timestamp: c.timestamp,
        open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover });
      const previous = unique.get(c.timestamp);
      if (previous && JSON.stringify(previous.candle) !== JSON.stringify(candle)) {
        throw new Error(`Conflicting final candles at ${c.timestamp}`);
      }
      unique.set(c.timestamp, { candle, barEnd: end,
        availableAt: Math.min(previous?.availableAt ?? Infinity, row.receivedAt) });
    }
    const sourceBars = [...unique.values()].sort((a, b) => a.candle.timestamp - b.candle.timestamp);
    const bars: TimedClosedBar[] = [];
    for (let i = 0; i < sourceBars.length;) {
      const start = Math.floor(sourceBars[i].candle.timestamp / target) * target;
      const group: TimedClosedBar[] = [];
      while (i < sourceBars.length && sourceBars[i].candle.timestamp < start + target) group.push(sourceBars[i++]);
      // Row count alone is insufficient: check every constituent timestamp.
      if (group.length !== target / source || group.some((b, k) => b.candle.timestamp !== start + k * source)) continue;
      integer(start + target, "aggregate bar end");
      const candle = Object.freeze({ timestamp: start, open: group[0].candle.open,
        high: group.reduce((v, b) => Math.max(v, b.candle.high), -Infinity),
        low: group.reduce((v, b) => Math.min(v, b.candle.low), Infinity),
        close: group[group.length - 1].candle.close,
        volume: group.reduce((v, b) => v + b.candle.volume, 0),
        turnover: group.reduce((v, b) => v + b.candle.turnover, 0) });
      validateCandle(candle, target);
      const bar = Object.freeze({ candle, barEnd: start + target,
        availableAt: group.reduce((v, b) => Math.max(v, b.availableAt), start + target) });
      bars.push(bar); this.byStart.set(start, bar);
    }
    this.bars = Object.freeze(bars);
  }

  /** Exact latest CLOSED bucket, never nearest/future/stale fallback. A missing
   * or delayed constituent anywhere in the requested window fails the window.
   * At 10:00, the latest hourly bucket is [09:00,10:00), not [10:00,11:00).
   */
  windowAt(decisionAt: number, lookbackBars: number): ClosedWindowResult {
    integer(decisionAt, "decision time"); integer(lookbackBars, "lookback bars", 1);
    const expectedBarStart = Math.floor(decisionAt / this.targetIntervalMs) * this.targetIntervalMs - this.targetIntervalMs;
    const bars: TimedClosedBar[] = [];
    let availableAt = 0;
    for (let k = 0; k < lookbackBars; k++) {
      const start = expectedBarStart - k * this.targetIntervalMs;
      const bar = this.byStart.get(start);
      if (!bar || bar.availableAt > decisionAt) return { ready: false, decisionAt, expectedBarStart,
        reason: bar ? "bar_not_available" : "missing_bar", blockedBarStart: start };
      bars.push(bar); availableAt = Math.max(availableAt, bar.availableAt);
    }
    return { ready: true, decisionAt, expectedBarStart, availableAt, bars: bars.reverse() };
  }
}
