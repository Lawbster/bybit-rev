/** Frozen local research rules. No exchange, signal files, state or strategy-config writes. */
import type { ResearchAddDecision } from "./replay-causal-engine";
export type Family = "cap10" | "drop_only" | "sr_timer" | "sr_all" | "weak_timer" | "sr_weak_timer" | "sr_sell_timer" | "sr_weak_sell_timer" | "sr_confirm_timer";
export type ExposureVariant = { id: string; family: Family; depth: number };
export interface ExposureSpec {
  id: string; baselineDir: string; inputManifest: string; originalEngineSha256: string; repairFile: string; historyEnd: string; initialEquity: number;
  resistanceBufferPct: number; weakReturn12hPct: number; sell15mMax: number; confirmBuy15mMin: number; confirmBuy1hMin: number;
  min15mSamples: number; min1hSamples: number; maxTakerAgeSec: number; depths: number[]; families: Exclude<Family, "cap10">[]; variantCount: number;
  profitUpgrade: { minimumHlPnlDelta: number; minimumHlGrossLossReductionPct: number; maximumDdIncreasePp: number; minimumPublishedPnlDelta: number; minimumMonthlyMtmDelta: number };
  defensiveTradeoff: { minimumHlGrossLossReductionPct: number; minimumHlDdReductionPp: number; minimumPnlRetention: number; maximumPublishedDdIncreasePp: number; minimumMonthlyMtmDelta: number };
}
export function exposureVariants(s: ExposureSpec): ExposureVariant[] {
  return [{ id: "cap10", family: "cap10", depth: 11 }, ...s.families.flatMap(family => s.depths.map(depth => ({ id: `${family}_d${depth}`, family, depth })))];
}
export function exposureVeto(v: ExposureVariant, d: Readonly<ResearchAddDecision>, s: ExposureSpec): { veto: boolean; unknown: boolean; reason: string } {
  const no = { veto: false, unknown: false, reason: "outside_rule" };
  if (d.nextDepth < v.depth) return no;
  if (v.family === "cap10") return { veto: true, unknown: false, reason: "cap10" };
  if (v.family !== "sr_all" && d.priceDropOk) return no;
  const near = d.srHealthy && d.resistanceDistPct !== null && d.resistanceDistPct >= 0 && d.resistanceDistPct <= s.resistanceBufferPct + 1e-10;
  if (v.family.startsWith("sr_") && !near) return { ...no, unknown: !d.srHealthy, reason: !d.srHealthy ? "sr_unknown" : "away_from_resistance" };
  const weak = !d.aboveEma200 || d.ret12h !== null && d.ret12h <= s.weakReturn12hPct;
  if (v.family.includes("weak") && !weak) return no;
  const fresh = d.takerAgeSec !== null && d.takerAgeSec >= 0 && d.takerAgeSec <= s.maxTakerAgeSec;
  if (v.family.includes("sell") || v.family === "sr_confirm_timer") {
    if (!fresh || d.taker15m === null || d.samples15m < s.min15mSamples) return { ...no, unknown: true, reason: "taker15_unknown" };
    if (v.family.includes("sell") && d.taker15m > s.sell15mMax) return no;
    if (v.family === "sr_confirm_timer") {
      if (d.taker1h === null || d.samples1h < s.min1hSamples || d.ret15m === null) return { ...no, unknown: true, reason: "confirmation_unknown" };
      if (d.taker15m >= s.confirmBuy15mMin && d.taker1h >= s.confirmBuy1hMin && d.ret15m > 0) return no;
    }
  }
  return { veto: true, unknown: false, reason: v.family };
}
