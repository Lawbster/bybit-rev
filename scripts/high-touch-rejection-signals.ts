/** HT03 frozen rejection receipts.  This module deliberately has no replay or live imports. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { Action } from "./poc-indicator-bias-engine";
import type { HighEvidence } from "./high-touch-short-signals";

export type { Candle, Action, HighEvidence };
export const M = 60_000;
export type Status = "emitted" | "deduplicated" | "not_qualified" | "censored";
export interface Decision {
  anchorId: string; anchorAt: number; reference: number; status: Status;
  at: number | null; sourceStart: number | null; sourceEnd: number | null;
  close: number | null; winnerId: string | null;
}
export interface Group { id: string; candidate: boolean; control: string; signals: Action[]; decisions: Decision[]; }

type Rule = "baseline" | "close_back" | "wick_reject" | "confirm" | "failed_break" | "wait" | "above_close";
type Spec = { id: string; candidate: boolean; control: string; rule: Rule; tf?: number; horizon?: number };
const SPECS: readonly Spec[] = [
  { id: "baseline", candidate: false, control: "baseline", rule: "baseline" },
  { id: "close_back", candidate: true, control: "baseline", rule: "close_back" },
  { id: "wick_reject", candidate: true, control: "baseline", rule: "wick_reject" },
  { id: "confirm_5m", candidate: true, control: "wait_5m", rule: "confirm", tf: 5 * M },
  { id: "confirm_15m", candidate: true, control: "wait_15m", rule: "confirm", tf: 15 * M },
  { id: "failed_break_5m", candidate: true, control: "above_close", rule: "failed_break", horizon: 5 * M },
  { id: "failed_break_15m", candidate: true, control: "above_close", rule: "failed_break", horizon: 15 * M },
  { id: "wait_5m", candidate: false, control: "baseline", rule: "wait", tf: 5 * M },
  { id: "wait_15m", candidate: false, control: "baseline", rule: "wait", tf: 15 * M },
  { id: "above_close", candidate: false, control: "baseline", rule: "above_close" },
];

function decision(a: HighEvidence, status: Status, at: number | null, sourceStart: number | null, sourceEnd: number | null, close: number | null): Decision {
  return { anchorId: a.id, anchorAt: a.at, reference: a.high, status, at, sourceStart, sourceEnd, close, winnerId: null };
}
function immediate(a: HighEvidence, status: Status): Decision {
  return decision(a, status, a.at, a.observationStart, a.observationEnd, a.close);
}
function validate(cs: readonly Candle[], anchors: readonly HighEvidence[]) {
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]; assert.equal(c.endTs, c.ts + M, "minute end");
    if (i) assert.equal(c.ts, cs[i - 1].endTs, "continuous minutes");
    assert([c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0), "finite candle");
    assert(c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close), "valid OHLC");
  }
  const byStart = new Map(cs.map(c => [c.ts, c]));
  for (const a of anchors) {
    assert(a.id.length > 0 && Number.isFinite(a.high) && a.high > 0, "anchor reference");
    assert.equal(a.observationEnd, a.observationStart + M, "anchor observation minute");
    assert.equal(a.at, a.observationEnd + M, "anchor availability");
    assert.equal(a.referenceAvailableAt, a.observationStart, "anchor reference availability");
    assert.equal(a.sourceEnd, a.observationStart - M, "HT01 i-2 source end");
    const c = byStart.get(a.observationStart); assert(c, "anchor observation must be in tape");
    assert.equal(c.open, a.open); assert.equal(c.high, a.observedHigh); assert.equal(c.low, a.low); assert.equal(c.close, a.close);
  }
  return byStart;
}
function aligned(a: HighEvidence, cs: readonly Candle[], byStart: Map<number, Candle>, tf: number, qualifying: boolean): Decision {
  const start = Math.ceil(a.at / tf) * tf, end = start + tf;
  const bars: Candle[] = [];
  for (let t = start; t < end; t += M) { const c = byStart.get(t); if (!c) return decision(a, "censored", null, start, null, null); bars.push(c); }
  const close = bars[bars.length - 1].close;
  return decision(a, qualifying ? "emitted" : "not_qualified", end + M, start, end, close);
}
function failed(a: HighEvidence, cs: readonly Candle[], byStart: Map<number, Candle>, horizon: number): Decision {
  if (!(a.close > a.high)) return immediate(a, "not_qualified");
  const deadline = a.at + horizon, firstStart = a.observationEnd, lastStart = deadline - 2 * M;
  let last: Candle | undefined;
  // A later minute is published one minute after its end.  The final eligible
  // observation therefore starts two minutes before the inclusive deadline.
  for (let t = firstStart; t <= lastStart; t += M) {
    const c = byStart.get(t);
    if (!c) return decision(a, "censored", null, firstStart, last?.endTs ?? null, last?.close ?? null);
    last = c;
    if (c.close < a.high) return decision(a, "emitted", c.endTs + M, c.ts, c.endTs, c.close);
  }
  return decision(a, "not_qualified", null, firstStart, last?.endTs ?? null, last?.close ?? null);
}

/** Builds the exact ten frozen HT03 groups; each group retains every anchor decision. */
export function buildRejectionGroups(cs: readonly Candle[], anchors: readonly HighEvidence[]): Group[] {
  const byStart = validate(cs, anchors);
  return SPECS.map(spec => {
    const decisions = anchors.map(a => {
      if (spec.rule === "baseline") return immediate(a, "emitted");
      if (spec.rule === "above_close") return immediate(a, a.close > a.high ? "emitted" : "not_qualified");
      if (spec.rule === "close_back") return immediate(a, a.close < a.high ? "emitted" : "not_qualified");
      if (spec.rule === "wick_reject") {
        const range = a.observedHigh - a.low, wick = a.observedHigh - Math.max(a.open, a.close);
        return immediate(a, a.close < a.high && range > 0 && wick >= 0.5 * range ? "emitted" : "not_qualified");
      }
      if (spec.rule === "failed_break") return failed(a, cs, byStart, spec.horizon!);
      const tf = spec.tf!;
      const endClose = byStart.get(Math.ceil(a.at / tf) * tf + tf - M)?.close;
      const d = aligned(a, cs, byStart, tf, spec.rule === "wait" || (endClose !== undefined && endClose < a.high));
      return d;
    });
    const receipts = new Map<number, Decision[]>();
    for (const d of decisions) if (d.status === "emitted") receipts.set(d.at!, [...(receipts.get(d.at!) ?? []), d]);
    for (const ds of receipts.values()) if (ds.length > 1) {
      ds.sort((a, b) => a.anchorAt - b.anchorAt || (a.anchorId < b.anchorId ? -1 : a.anchorId > b.anchorId ? 1 : 0));
      for (const d of ds.slice(1)) { d.status = "deduplicated"; d.winnerId = ds[0].anchorId; }
    }
    const signals = decisions.filter(d => d.status === "emitted").map(d => ({ id: d.anchorId, at: d.at!, side: -1 as const }));
    signals.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return { id: spec.id, candidate: spec.candidate, control: spec.control, signals, decisions };
  });
}
