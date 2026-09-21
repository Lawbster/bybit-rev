/** L11: research-only trailing-high permissions. No exchange/state mutations. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchAddDecision, ResearchReductionDecision, ResearchInventoryEvent } from "./replay-causal-engine";
export type R = Record<string, any>;
export type HighPolicy = { id: string; action: "block" | "exit"; days: number; proximityPct: number };
export const HIGH_POLICIES: HighPolicy[] = (["block", "exit"] as const).flatMap(action => [1, 7, 30].flatMap(days =>
  [1, 2].map(proximityPct => ({ id: `${action}_${days}d_${proximityPct}pct`, action, days, proximityPct }))));
export function trailingHighIndices(cs: readonly Pick<Candle, "ts" | "endTs" | "high">[], minutes: number): Int32Array {
  assert(Number.isSafeInteger(minutes) && minutes > 0);
  const result = new Int32Array(cs.length).fill(-1), q = new Int32Array(cs.length);
  let head = 0, tail = 0, contiguousStart = 0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]; assert(c.endTs === c.ts + 60000 && Number.isFinite(c.high) && c.high > 0);
    if (i) { assert(c.ts > cs[i - 1].ts); if (c.ts !== cs[i - 1].endTs) { head = tail = 0; contiguousStart = i; } }
    while (head < tail && q[head] <= i - minutes) head++;
    while (head < tail && cs[q[tail - 1]].high <= c.high) tail--;
    q[tail++] = i;
    if (i - contiguousStart + 1 >= minutes) result[i] = q[head];
  }
  return result;
}
export function highFeature(cs: readonly Candle[], indices: Int32Array, index: number, days: number, at: number, price: number, lagMs: number): R | null {
  assert(lagMs === 0 || lagMs === 60000); assert(cs[index].endTs === at);
  const sourceIndex = index - lagMs / 60000, highIndex = indices[sourceIndex];
  if (sourceIndex < 0 || highIndex === undefined || highIndex < 0) return null;
  const sourceEnd = cs[sourceIndex].endTs, high = cs[highIndex];
  if (sourceEnd + lagMs !== at) return null;
  return { high: high.high, highIndex, highAt: high.endTs, sourceEnd, sourceStart: sourceEnd - days * 86400000,
    availableAt: sourceEnd + lagMs, distancePct: Math.max(0, (1 - price / high.high) * 100), aboveReference: price > high.high };
}
export const nearHigh = (f: R | null, pct: number) => f !== null && f.distancePct <= pct + 1e-10;
export class HighController {
  inventory: readonly R[] = [];
  adds: Array<[number, number, boolean, boolean, boolean]> = [];
  reductions: Array<[number, number, number, boolean, boolean]> = [];
  traces: R[] = [];
  intervened = new Set<number>();
  counts = { adds: 0, eligibleAdds: 0, vetoes: 0, exitChecks: 0, eligibleExits: 0, exitIntents: 0, unknown: 0 };
  constructor(readonly policy: HighPolicy | null, readonly source: (index: number, at: number, price: number) => R | null) {}
  readonly observe = (e: Readonly<ResearchInventoryEvent>) => { assert.deepEqual(e.before, this.inventory); this.inventory = e.after; };
  private trace(d: R, f: R | null, action: string) {
    if (!this.intervened.has(d.episode)) this.traces.push({ action, decision: d, inventory: this.inventory, feature: f });
    this.intervened.add(d.episode);
  }
  readonly add = (d: Readonly<ResearchAddDecision>) => {
    assert.equal(d.nextDepth, this.inventory.length + 1); this.counts.adds++;
    const eligible = this.policy?.action === "block" && d.nextDepth >= 8;
    const f = eligible ? this.source(d.index, d.at, d.price) : null;
    // Missing history cannot authorise expansion. Exit rules, conversely, must
    // never turn unknown context into a discretionary forced close.
    const unknown = !!eligible && !f, veto = !!eligible && (unknown || nearHigh(f, this.policy!.proximityPct));
    this.counts.eligibleAdds += Number(eligible); this.counts.vetoes += Number(veto); this.counts.unknown += Number(unknown);
    this.adds.push([d.index, d.episode, d.priceDropOk, veto, unknown]);
    if (veto) this.trace(d, f, "block"); return veto;
  };
  readonly reduce = (d: Readonly<ResearchReductionDecision>) => {
    if (this.policy?.action !== "exit" || !d.depth) return null;
    assert.equal(d.depth, this.inventory.length); this.counts.exitChecks++;
    const age = d.at - Math.min(...this.inventory.map(p => p.entryTime));
    const eligible = d.canReduce && age >= 4 * 3600000;
    const f = eligible ? this.source(d.index, d.at, d.price) : null;
    const fire = eligible && nearHigh(f, this.policy.proximityPct);
    this.counts.eligibleExits += Number(eligible); this.counts.unknown += Number(eligible && !f); this.counts.exitIntents += Number(fire);
    this.reductions.push([d.index, d.episode, d.depth, d.canReduce, fire]);
    if (!fire) return null;
    this.trace({ ...d, ageHours: age / 3600000 }, f, "exit");
    return { fraction: 1, reason: `research_exit:${this.policy.id}`, fillDelayMs: 0 };
  };
}
