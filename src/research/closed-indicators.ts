import { computeIndicators, type IndicatorSnapshot } from "../indicators";
import { CLOSED_BAR_TIMING_VERSION, ClosedBarSeries } from "./closed-bars";

export interface ClosedIndicatorSnapshot {
  readonly barStart: number;
  readonly barEnd: number;
  readonly availableAt: number;
  readonly seedBarStart: number;
  readonly contiguousBars: number;
  readonly values: Readonly<IndicatorSnapshot>;
}

export type ClosedIndicatorResult =
  | { ready: true; decisionAt: number; snapshot: ClosedIndicatorSnapshot }
  | { ready: false; decisionAt: number; expectedBarStart: number;
      reason: "missing_bar" | "bar_not_available" | "indicator_warmup"
        | "indicator_history_not_available" | "non_finite_indicator" };

/** Explicit closed-bar adapter for the EXISTING formula bundle. It certifies a
 * time boundary, not indicator math or predictive value. New individual formulas
 * can use ClosedBarSeries.windowAt with their own declared warmup/seed policy.
 * No live callers or canonical replay indicators are replaced by this adapter.
 */
export class ClosedIndicatorSeries {
  readonly timingVersion = CLOSED_BAR_TIMING_VERSION;
  readonly formulaVersion = "legacy-computeIndicators-v1";
  readonly seedPolicy = "explicit-fixed-start-no-gap-reseed";
  readonly seedBarStart: number;
  private readonly snapshots = new Map<number, ClosedIndicatorSnapshot>();
  private readonly continuousEnd: number;

  constructor(readonly source: ClosedBarSeries, options: { seedBarStart: number }) {
    const seed = options.seedBarStart;
    if (!Number.isSafeInteger(seed) || seed < 0 || seed % source.targetIntervalMs !== 0) {
      throw new Error("Invalid fixed indicator seed bar start");
    }
    this.seedBarStart = seed;
    // Never choose the seed from whatever happens to have arrived first. A late
    // bar bridging a gap must not retroactively change the seed of older signals.
    const segment = [];
    let expected = seed;
    for (const bar of source.bars) {
      if (bar.candle.timestamp < seed) continue;
      if (bar.candle.timestamp !== expected) break;
      segment.push(bar); expected = bar.barEnd;
    }
    this.continuousEnd = expected;
    const values = computeIndicators(segment.map(b => ({ ...b.candle })));
    let availableAt = 0;
    for (let k = 0; k < segment.length; k++) {
      const bar = segment[k];
      // EMA/OBV/etc depend on the earlier prefix, not just this last candle.
      availableAt = Math.max(availableAt, bar.availableAt);
      const value = values.get(bar.candle.timestamp);
      if (value) this.snapshots.set(bar.candle.timestamp, Object.freeze({
        barStart: bar.candle.timestamp, barEnd: bar.barEnd, availableAt,
        seedBarStart: seed, contiguousBars: k + 1, values: Object.freeze(value) }));
    }
  }

  at(decisionAt: number): ClosedIndicatorResult {
    const window = this.source.windowAt(decisionAt, 1);
    const unavailable = (reason: Extract<ClosedIndicatorResult, { ready: false }>['reason']): ClosedIndicatorResult =>
      ({ ready: false, decisionAt, expectedBarStart: window.expectedBarStart, reason });
    if (!window.ready) return unavailable(window.reason);
    if (window.bars[0].barEnd > this.continuousEnd) return unavailable("indicator_history_not_available");
    const snapshot = this.snapshots.get(window.expectedBarStart);
    if (!snapshot) return unavailable("indicator_warmup");
    if (snapshot.availableAt > decisionAt) return unavailable("indicator_history_not_available");
    if (Object.values(snapshot.values).some(v => typeof v === "number" && !Number.isFinite(v))) {
      return unavailable("non_finite_indicator");
    }
    return { ready: true, decisionAt, snapshot };
  }
}
