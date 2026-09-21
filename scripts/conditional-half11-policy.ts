/** Frozen research-only sizing overlay. Never imported by the live bot. */
import type { IndicatorContext } from "./ladder-indicator-policy";
export const HALF11_VARIANTS = ["baseline", "last11_50", "structure_half11", "vwap_roc_half11", "hl_two_window_half11"] as const;
export type Half11Variant = typeof HALF11_VARIANTS[number];
export type Half11Input = { at: number; nextDepth: number; requestedNotional: number;
  aboveEma200: boolean | null; ret12h: number | null; hour: IndicatorContext | null;
  taker15m: number | null; taker1h: number | null; samples15m: number; samples1h: number; takerAgeSec: number | null };
const finite = (x: number | null): x is number => x !== null && Number.isFinite(x);
export function conditionalHalf11(variant: Half11Variant, d: Half11Input) {
  if (!HALF11_VARIANTS.includes(variant)) throw new Error("Unfrozen half11 policy");
  if (!Number.isFinite(d.requestedNotional) || d.requestedNotional <= 0 || !Number.isSafeInteger(d.at)
      || !Number.isSafeInteger(d.nextDepth) || d.nextDepth < 1) throw new Error("Invalid size decision");
  let weak = false, unknown = false, reason = "outside_depth";
  if (d.nextDepth === 11) {
    reason = "condition_clear";
    if (variant === "last11_50") weak = true;
    else if (variant === "structure_half11") {
      weak = d.aboveEma200 === false || finite(d.ret12h) && d.ret12h <= -2;
      unknown = !weak && (d.aboveEma200 === null || !finite(d.ret12h));
    } else if (variant === "vwap_roc_half11") {
      const c = d.hour, expected = Math.floor(d.at / 3600000) * 3600000 - 3600000;
      unknown = !c || c.barStart !== expected || c.barEnd !== expected + 3600000 || c.features.timestamp !== expected
        || !Number.isSafeInteger(c.availableAt) || c.availableAt < c.barEnd || c.availableAt > d.at
        || !Number.isFinite(c.close) || c.close <= 0 || !finite(c.features.vwapUtcDay) || c.features.vwapUtcDay <= 0 || !finite(c.features.roc5);
      weak = !unknown && c!.close < c!.features.vwapUtcDay! && c!.features.roc5! <= 0;
    } else if (variant === "hl_two_window_half11") {
      unknown = !finite(d.taker15m) || !finite(d.taker1h) || d.taker15m < 0 || d.taker1h < 0
        || !Number.isInteger(d.samples15m) || !Number.isInteger(d.samples1h) || d.samples15m < 14 || d.samples1h < 55
        || !finite(d.takerAgeSec) || d.takerAgeSec < 0 || d.takerAgeSec > 90;
      weak = !unknown && d.taker15m! <= .85 && d.taker1h! <= .90;
    }
    reason = unknown ? "required_context_unknown" : weak ? variant : "condition_clear";
  }
  return { notional: d.requestedNotional * (weak ? .5 : 1), weak, unknown, reason };
}
