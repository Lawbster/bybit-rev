/** Frozen component wiring only; imports no trading executor and never writes config. */
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { Series } from "./hype-freerun-canonical-replay";
export const COMPONENTS = [
  ["price_drop", "0.3% alternative price-drop adds", "priceTriggerPct"],
  ["soft_stale", "4h soft-stale TP adjustment", "exits.softStale"],
  ["emergency", "-14% emergency exit", "exits.emergencyKill"],
  ["trend", "4h EMA trend gate (also hard-flatten dependency)", "filters.trendBreak"],
  ["hard_flatten", "12h/-2% hostile-trend flatten", "exits.hardFlatten"],
  ["forced_cooldown", "4h-boundary forced-exit cooldown", null],
  ["local_kill", "12h/-3% adds-only kill", "filters.ladderLocalKill"],
  ["btc_riskoff", "BTC hourly drop gate", "filters.marketRiskOff"],
  ["daily_regime", "5 red /2 non-red daily gate", "filters.regimeBreaker.enabled"],
  ["overextended", "First-rung slope/CRSI/RSI gate", "filters.overextendedEntry.enabled"],
  ["add_throttle", "Deep falling-price time-add throttle", "addThrottle.enabled"],
  ["deep_stress", "Deep negative-funding price-drop requirement", "deepAddStressGuard.enabled"],
  ["tp_cooldown", "Hot-RSI post-TP cooldown", "tpCooldown.enabled"],
  ["funding_spike", "Deep positive-funding spike exit", "exits.fundingSpikeGuard.enabled"],
  ["sr_partial", "Resistance/pulse profitable selected-rung partial", "srPartialExitAction.enabled"],
  ["sr_support", "Support/pulse funding-only reopen exception", "srSupportReopenAction.enabled"],
  ["damaged_latch", "Persistent EMA/HL damaged-regime gate", "filters.damagedRegimeLatch.enabled"],
] as const;
export type Component = typeof COMPONENTS[number][0];
export type ComponentPolicy = { id: string; enabled: Component[]; label: string };
export function componentPolicies() {
  const cumulative: ComponentPolicy[] = Array.from({ length: COMPONENTS.length + 1 }, (_, n) => ({
    id: `B${String(n).padStart(2, "0")}`, enabled: COMPONENTS.slice(0, n).map(c => c[0]),
    label: n ? `+ ${COMPONENTS[n - 1][1]}` : "BARE time-only ladder + normal TP" }));
  const removals = COMPONENTS.map(c => ({ component: c[0], policy: c[0] === "damaged_latch" ? "B16" : `minus_${c[0]}` }));
  const unique = [...cumulative, ...removals.filter(r => r.policy !== "B16").map(r => ({ id: r.policy,
    enabled: COMPONENTS.filter(c => c[0] !== r.component).map(c => c[0]), label: `Full current minus ${r.component}` }))];
  assert.equal(unique.length, 34); assert.equal(new Set(unique.map(p => p.enabled.join("|"))).size, 34);
  return { cumulative, removals, unique };
}
export function componentConfig(current: BotConfig, policy: ComponentPolicy) {
  const cfg = structuredClone(current), enabled = new Set(policy.enabled);
  for (const [id, , field] of COMPONENTS) {
    if (!field) continue;
    const keys = field.split("."); let object: any = cfg;
    for (const key of keys.slice(0, -1)) { assert(object[key] !== undefined, field); object = object[key]; }
    const key = keys.at(-1)!; assert(id === "price_drop" ? object[key] === .3 : object[key] === true, `Frozen current setting: ${field}`);
    if (!enabled.has(id)) object[key] = id === "price_drop" ? 0 : false;
  }
  return { cfg, cooldownMode: enabled.has("forced_cooldown") ? "live4h" as const : "0h" as const };
}
/** Input arrays are independent gates; do not erase daily when removing latch. */
export function componentSeries(s: Series, daily: boolean[], latch: boolean[], policy: ComponentPolicy): Series {
  assert.equal(daily.length, s.candles.length); assert.equal(latch.length, daily.length);
  const yes = new Set(policy.enabled), no = Array<boolean>(daily.length).fill(false);
  return { ...s, trendBlocked: yes.has("trend") ? s.trendBlocked : no,
    riskOffBlocked: yes.has("btc_riskoff") ? s.riskOffBlocked : no,
    regimeFlat: daily.map((v, i) => yes.has("daily_regime") && v || yes.has("damaged_latch") && latch[i]) };
}
