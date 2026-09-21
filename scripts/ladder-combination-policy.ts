/** L13: composition of frozen research mechanisms, never a live policy. */
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { ResearchSizeDecision } from "./replay-causal-engine";
export type R = Record<string, any>;
export const TP_LEGS = ["age8", "minus_soft_stale"] as const;
export const OTHER_LEGS = ["last11_50", "minus_deep_stress", "mfi_weekly_half", "exit_2d_1pct"] as const;
export const SINGLES = ["baseline", ...TP_LEGS, ...OTHER_LEGS];
export const COMBINATIONS = TP_LEGS.flatMap(a => OTHER_LEGS.map(b => `${a}__${b}`));
export const POLICIES = [...SINGLES, ...COMBINATIONS];
export function legs(id: string): string[] { assert(POLICIES.includes(id), `Unfrozen policy ${id}`); return id === "baseline" ? [] : id.split("__"); }
export function runConfig(current: BotConfig, id: string): BotConfig {
  const cfg = structuredClone(current), l = legs(id);
  assert.equal(cfg.exits.softStale, true); assert.equal(cfg.deepAddStressGuard?.enabled, true);
  if (l.includes("minus_soft_stale")) cfg.exits.softStale = false;
  if (l.includes("minus_deep_stress")) cfg.deepAddStressGuard!.enabled = false;
  return cfg;
}
export function requestedSize(id: string, d: Readonly<ResearchSizeDecision>): number {
  assert(Number.isFinite(d.requestedNotional) && d.requestedNotional > 0);
  return d.requestedNotional * (legs(id).includes("last11_50") && d.nextDepth === 11 ? .5 : 1);
}
export const WEEKLY_POLICY = { id: "mfi_weekly_half", fraction: .5, mfiRequired: true, weeklyRequired: true };
export const HIGH_POLICY = { id: "exit_2d_1pct", action: "exit" as const, days: 2, proximityPct: 1 };
export function validateCombinationCard(d: R) {
  assert.equal(d.start, "2026-05-17T20:43:00Z"); assert.equal(d.cutoff, "2026-09-10T05:08:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055);
  assert.deepEqual(d.singles, SINGLES); assert.deepEqual(d.combinations, COMBINATIONS);
  assert.equal(d.newTradingDefinitions, 8); assert.equal(d.runs, 86);
  assert.deepEqual(d.sourceLags, [0, 60000]);
}
