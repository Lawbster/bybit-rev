/** L12 research only. BTC can remove this experiment's veto, never an outer gate. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchAddDecision, ResearchReductionDecision, ResearchInventoryEvent } from "./replay-causal-engine";
import { HighController, type HighPolicy, type R } from "./near-high-policy";
export const EXTENDED_DAYS = [1, 2, 3, 4, 5, 6, 7, 30];
export type ExtendedPolicy = HighPolicy & { btcLeniency: boolean };
export const EXTENDED_POLICIES: ExtendedPolicy[] = [
  ...(["block", "exit"] as const).flatMap(action => [2, 3, 4, 5, 6].flatMap(days => [1, 2].map(proximityPct =>
    ({ id: `${action}_${days}d_${proximityPct}pct`, action, days, proximityPct, btcLeniency: false })))),
  ...EXTENDED_DAYS.flatMap(days => [1, 2].map(proximityPct =>
    ({ id: `btc_block_${days}d_${proximityPct}pct`, action: "block" as const, days, proximityPct, btcLeniency: true }))),
];
export function btcStrength(cs: readonly Candle[], indices: Int32Array, at: number, days: number, lag: number): R | null {
  assert(lag === 0 || lag === 60000);
  const end = at - lag; let lo = 0, hi = cs.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (cs[m].endTs < end) lo = m + 1; else hi = m; }
  const i = lo, h = indices[i], previous = i - 240;
  // No stale-source substitution, gap fill or optimistic unknown regime.
  if (!cs[i] || cs[i].endTs !== end || h === undefined || h < 0 || previous < 0 || cs[previous].endTs !== end - 14400000) return null;
  assert(h >= i - days * 1440 + 1 && h <= i);
  const distancePct = Math.max(0, 100 * (1 - cs[i].close / cs[h].high));
  const return4hPct = 100 * (cs[i].close / cs[previous].close - 1);
  return { sourceEnd: end, availableAt: end + lag, sourceStart: end - days * 86400000, high: cs[h].high,
    highAt: cs[h].endTs, close: cs[i].close, previousClose: cs[previous].close, returnSourceEnd: cs[previous].endTs,
    distancePct, return4hPct, strong: distancePct <= 1 + 1e-10 && return4hPct >= 0 };
}
// Tuple: decision index, episode, price-drop, final veto, HYPE unknown,
// raw veto, BTC ready (null if not evaluated), BTC strong, relaxed.
export type ExtendedAdd = [number, number, boolean, boolean, boolean, boolean, boolean | null, boolean | null, boolean];
export class ExtendedHighController {
  readonly inner: HighController;
  adds: ExtendedAdd[] = [];
  intervened = new Set<number>(); relaxedEpisodes = new Set<number>();
  traces: R[] = []; relaxedTraces: R[] = [];
  vetoes = 0; btcChecks = 0; btcUnknown = 0; btcStrong = 0; relaxed = 0;
  constructor(readonly policy: ExtendedPolicy | null, source: (i: number, at: number, price: number) => R | null,
    readonly btc: (at: number) => R | null) { this.inner = new HighController(policy, source); }
  readonly observe = (e: Readonly<ResearchInventoryEvent>) => this.inner.observe(e);
  get counts() { return { ...this.inner.counts, rawVetoes: this.inner.counts.vetoes, vetoes: this.vetoes,
    btcChecks: this.btcChecks, btcUnknown: this.btcUnknown, btcStrong: this.btcStrong, relaxed: this.relaxed, relaxedEpisodes: this.relaxedEpisodes.size }; }
  get reductions() { return this.inner.reductions; }
  readonly add = (d: Readonly<ResearchAddDecision>) => {
    const raw = this.inner.add(d), unknown = this.inner.adds.at(-1)![4];
    const evaluate = !!this.policy?.btcLeniency && raw && !unknown;
    const context = evaluate ? this.btc(d.at) : null, relaxed = evaluate && context?.strong === true;
    const veto = raw && !relaxed;
    this.btcChecks += Number(evaluate); this.btcUnknown += Number(evaluate && !context);
    this.btcStrong += Number(relaxed); this.relaxed += Number(relaxed); this.vetoes += Number(veto);
    this.adds.push([d.index, d.episode, d.priceDropOk, veto, unknown, raw, evaluate ? !!context : null, evaluate ? context?.strong === true : null, relaxed]);
    if (veto) {
      if (!this.intervened.has(d.episode)) this.traces.push({ action: "block", decision: d, inventory: this.inner.inventory,
        feature: this.inner.source(d.index, d.at, d.price), btc: context });
      this.intervened.add(d.episode);
    }
    if (relaxed) {
      if (!this.relaxedEpisodes.has(d.episode)) this.relaxedTraces.push({ action: "relax", decision: d, inventory: this.inner.inventory,
        feature: this.inner.source(d.index, d.at, d.price), btc: context });
      this.relaxedEpisodes.add(d.episode);
    }
    return veto;
  };
  readonly reduce = (d: Readonly<ResearchReductionDecision>) => {
    const result = this.inner.reduce(d);
    if (result) { this.intervened.add(d.episode); this.traces = this.inner.traces; }
    return result;
  };
}
