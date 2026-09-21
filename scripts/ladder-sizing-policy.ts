/** Frozen research sizing reductions. No trading, state or market imports. */
import type { ResearchSizeDecision } from "./replay-causal-engine";
export type SizingVariant = { id: string; family: "scale" | "cost_cap" | "rung_cap"; depth?: number; fraction?: number; capLastFraction?: number };
export function freshLadderCost(depth: number, base: number, scale: number): number {
  return Array.from({ length: depth }, (_, i) => base * scale ** i).reduce((a, b) => a + b, 0);
}
export function sizedAdd(v: SizingVariant | null, d: Readonly<ResearchSizeDecision>, base: number, scale: number, minimumBaseFraction = 1) {
  if (!v) return d.requestedNotional;
  if (v.family === "rung_cap") return d.nextDepth >= v.depth! ? 0 : d.requestedNotional;
  if (v.family === "scale") return d.requestedNotional * (d.nextDepth >= v.depth! ? v.fraction! : 1);
  const cap = freshLadderCost(10, base, scale) + base * scale ** 10 * v.capLastFraction!;
  const room = Math.max(0, cap - d.entryCostNotional);
  return room + 1e-8 < base * minimumBaseFraction ? 0 : Math.min(d.requestedNotional, room);
}
