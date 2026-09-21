/** Research-only individual indicator vetoes; no live gate replacements. */
import type { Candle } from "../src/fetch-candles";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { computeResearchFeatures, type ResearchFeature } from "../src/research/indicator-features";
export const HOUR = 3_600_000;
export const INDICATOR_VARIANTS = Object.freeze([
  { id: "rsi_hot_d11", family: "rsi_hot" },
  { id: "crsi_hot_d11", family: "crsi_hot" },
  { id: "roc_weak_d11", family: "roc_weak" },
  { id: "below_vwap_d11", family: "below_vwap" },
] as const);
export type IndicatorVariant = typeof INDICATOR_VARIANTS[number];
export interface IndicatorContext {
  barStart: number; barEnd: number; availableAt: number; close: number; features: Readonly<ResearchFeature>;
}
export class LadderIndicatorTape {
  private readonly bars: ClosedBarSeries;
  private readonly values = new Map<number, Readonly<ResearchFeature>>();
  constructor(minutes: readonly Readonly<Candle>[]) {
    if (!minutes.length || minutes[0].timestamp % HOUR !== 0) throw new Error("Require an explicit full-hour fixed seed");
    minutes.forEach((c, i) => {
      if (c.timestamp !== minutes[0].timestamp + i * 60000) throw new Error("Missing, duplicate or unordered indicator minute");
    });
    this.bars = ClosedBarSeries.fromHistorical(minutes, { sourceIntervalMs: 60000, targetIntervalMs: HOUR, publicationLagMs: 0 });
    const features = computeResearchFeatures(this.bars.bars.map(b => b.candle), HOUR);
    features.forEach(f => this.values.set(f.timestamp, Object.freeze(f)));
  }
  at(decisionAt: number): IndicatorContext | null {
    const window = this.bars.windowAt(decisionAt, 1);
    if (!window.ready) return null;
    const b = window.bars[0], features = this.values.get(b.candle.timestamp);
    if (!features) return null;
    return Object.freeze({ barStart: b.candle.timestamp, barEnd: b.barEnd, availableAt: b.availableAt, close: b.candle.close, features });
  }
}
export function indicatorVeto(v: IndicatorVariant, d: { at: number; nextDepth: number }, c: IndicatorContext | null) {
  if (d.nextDepth < 11) return { veto: false, unknown: false, reason: "outside_depth" };
  const expected = Math.floor(d.at / HOUR) * HOUR - HOUR;
  if (!c || c.barStart !== expected || c.barEnd !== expected + HOUR
      || !Number.isSafeInteger(c.availableAt) || c.availableAt < c.barEnd || c.availableAt > d.at
      || c.features.timestamp !== c.barStart) return { veto: false, unknown: true, reason: "hour_unavailable" };
  const value = v.family === "rsi_hot" ? c.features.rsi14 : v.family === "crsi_hot" ? c.features.crsi
    : v.family === "roc_weak" ? c.features.roc5 : c.features.vwapUtcDay;
  if (value === null || !Number.isFinite(value)) return { veto: false, unknown: true, reason: "feature_unavailable" };
  if (v.family === "below_vwap" && (!(value > 0) || !Number.isFinite(c.close) || !(c.close > 0))) {
    return { veto: false, unknown: true, reason: "feature_unavailable" };
  }
  const veto = v.family === "rsi_hot" ? value >= 70 : v.family === "crsi_hot" ? value >= 80
    : v.family === "roc_weak" ? value <= 0 : c.close < value;
  return { veto, unknown: false, reason: veto ? v.family : "condition_clear" };
}
