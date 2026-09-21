/** Research-only genuine-drop pulse confirmation. No mutable state or trading imports. */
import type { ResearchAddDecision } from "./replay-causal-engine";
import type { ExposureSpec } from "./ladder-exposure-policy";
export type DropFamily = "drop_sell15" | "drop_sell_either" | "drop_confirm15" | "drop_confirm_both" | "drop_sr_sell15" | "drop_sr_confirm";
export type DropVariant = { id: string; family: DropFamily; depth: number };
export type DropSpec = Omit<ExposureSpec, "families"> & { families: DropFamily[]; priorExposureDir: string; sell1hMax: number; neutral15mMin: number };
export function dropVariants(s: DropSpec): DropVariant[] {
  return s.families.flatMap(family => s.depths.map(depth => ({ id: `${family}_d${depth}`, family, depth })));
}
export function dropVeto(v: DropVariant, d: Readonly<ResearchAddDecision>, s: DropSpec) {
  const answer = (veto: boolean, reason: string, unknown = false) => ({ veto, unknown, reason });
  if (d.nextDepth < v.depth) return answer(false, "below_depth");
  if (!d.priceDropOk) return answer(false, "timer_only");
  if (v.family.startsWith("drop_sr_")) {
    if (!d.srHealthy) return answer(false, "sr_unknown", true);
    if (d.resistanceDistPct === null || d.resistanceDistPct < 0 || d.resistanceDistPct > s.resistanceBufferPct + 1e-10) return answer(false, "away_from_resistance");
  }
  const finite = (n: number | null) => n !== null && Number.isFinite(n);
  if (!finite(d.takerAgeSec) || d.takerAgeSec! < 0 || d.takerAgeSec! > s.maxTakerAgeSec || !finite(d.taker15m) || d.samples15m < s.min15mSamples)
    return answer(false, "taker15_unknown", true);
  const both = ["drop_sell_either", "drop_confirm_both", "drop_sr_confirm"].includes(v.family);
  if (both && (!finite(d.taker1h) || d.samples1h < s.min1hSamples)) return answer(false, "taker1h_unknown", true);
  if (v.family === "drop_sr_confirm" && !finite(d.ret15m)) return answer(false, "return_unknown", true);
  let veto: boolean;
  switch (v.family) {
    case "drop_sell15": case "drop_sr_sell15": veto = d.taker15m! <= s.sell15mMax; break;
    case "drop_sell_either": veto = d.taker15m! <= s.sell15mMax || d.taker1h! <= s.sell1hMax; break;
    case "drop_confirm15": veto = d.taker15m! < s.neutral15mMin; break;
    case "drop_confirm_both": veto = d.taker15m! < s.confirmBuy15mMin || d.taker1h! < s.confirmBuy1hMin; break;
    case "drop_sr_confirm": veto = d.taker15m! < s.confirmBuy15mMin || d.taker1h! < s.confirmBuy1hMin || d.ret15m! <= 0; break;
  }
  return answer(veto, veto ? v.family : "pulse_permits");
}
