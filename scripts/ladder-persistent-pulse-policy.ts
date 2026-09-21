/** In-memory research gate only. One unresolved next-add slot; never controls exits. */
import { dropVariants, dropVeto, type DropSpec, type DropVariant } from "./ladder-drop-pulse-policy";
import type { ResearchAddDecision } from "./replay-causal-engine";
export type PersistentSpec = DropSpec & { priorDropDir: string };
export type PersistentVariant = DropVariant & { controlId: string };
export type PulseHold = Readonly<{ episode: number; nextDepth: number; armedAt: number }>;
export function persistentVariants(s: PersistentSpec): PersistentVariant[] {
  return dropVariants(s).map(v => ({ ...v, controlId: v.id, id: `hold_${v.id}` }));
}
export function createPersistentGate(v: PersistentVariant, s: PersistentSpec) {
  if (!["drop_sell15", "drop_confirm_both", "drop_sr_confirm"].includes(v.family)) throw Error("Unfrozen persistence family");
  let active: PulseHold | null = null;
  const state = () => active ? { ...active } : null;
  function evaluate(d: Readonly<ResearchAddDecision>) {
    const before = state(); let reset: PulseHold | null = null;
    if (active && (d.episode !== active.episode || d.nextDepth !== active.nextDepth)) { reset = active; active = null; }
    const original = dropVeto(v, d, s);
    if (!active) {
      if (original.veto) active = Object.freeze({ episode: d.episode, nextDepth: d.nextDepth, armedAt: d.at });
      return { ...original, before, reset, active: state(), event: original.veto ? "armed" : reset ? "inventory_reset" : "none", preventedRelease: null as string | null };
    }
    // Once armed, price-drop/timer and zone membership cannot release the slot.
    // Only the original pulse predicate is reconsidered; no fictitious market inputs.
    const finite = (n: number | null) => n !== null && Number.isFinite(n);
    let unknown: string | null = null;
    if (!finite(d.takerAgeSec) || d.takerAgeSec! < 0 || d.takerAgeSec! > s.maxTakerAgeSec || !finite(d.taker15m) || d.samples15m < s.min15mSamples) unknown = "taker15_unknown";
    else if (v.family !== "drop_sell15" && (!finite(d.taker1h) || d.samples1h < s.min1hSamples)) unknown = "taker1h_unknown";
    else if (v.family === "drop_sr_confirm" && !finite(d.ret15m)) unknown = "return_unknown";
    const clear = !unknown && (v.family === "drop_sell15" ? d.taker15m! > s.sell15mMax :
      d.taker15m! >= s.confirmBuy15mMin && d.taker1h! >= s.confirmBuy1hMin && (v.family !== "drop_sr_confirm" || d.ret15m! > 0));
    if (clear) active = null;
    return { veto: !clear, unknown: unknown !== null, reason: clear ? "pulse_release" : unknown ? `held_${unknown}` : "pulse_hold",
      before, reset, active: state(), event: clear ? "released" : "held", preventedRelease: !clear && !original.veto ? original.reason : null };
  }
  return { evaluate, state };
}
