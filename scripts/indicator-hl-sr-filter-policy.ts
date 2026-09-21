/** H01 research-only gates. Source delivery and order-fill delays are independent. */
import assert from "assert/strict";
import { validFlow, type Evidence, type Row, M, H } from "./indicator-hl-sr-context";
import { bookEvidence, finiteData as num } from "../src/hl-data-quality";
import { runCombination, type Gate, type Opportunity } from "./indicator-combination-engine";
import type { Candle } from "../src/fetch-candles";
import type { StandaloneOptions } from "./indicator-standalone-engine";

export const key = (r: Row) => `${r.arrivalDelayMs}|${r.delayMs}|${r.id}`;
export const deliveredAt = (r: Evidence, lag: number) => Math.ceil((r.availableAt + lag) / M) * M;
const ref = (r: Evidence | null, lag: number) => r ? { kind: r.kind, file: r.file, line: r.line,
  sourceAt: r.sourceAt, baseAvailableAt: r.availableAt, modeledAvailableAt: r.availableAt + lag,
  eligibleAt: deliveredAt(r, lag), timingBasis: r.timingBasis } : null;

export class DelayedContext {
  readonly rows: Evidence[];
  constructor(rows: readonly Evidence[], readonly quality: Row) {
    this.rows = [...rows].sort((a, b) => a.availableAt - b.availableAt || a.line - b.line);
  }
  snapshot(at: number, lag: number): Row {
    assert(Number.isSafeInteger(at) && at % M === 0 && Number.isSafeInteger(lag) && lag >= 0);
    const latest = (kind: string, t: number) => {
      for (let i = this.rows.length - 1; i >= 0; i--) {
        const r = this.rows[i]; if (r.kind === kind && deliveredAt(r, lag) <= t) return r;
      }
      return null;
    };
    const rows = this.rows.filter(r => r.kind === "hlTaker" && deliveredAt(r, lag) <= at &&
      deliveredAt(r, lag) > at - 15 * M && r.sourceAt > at - 15 * M && r.sourceAt <= at);
    const eligible = rows.filter(r => num(r.raw.buyNotional) !== null && num(r.raw.sellNotional) !== null && r.raw.buyNotional >= 0 && r.raw.sellNotional >= 0);
    const samples = new Set(eligible.map(r => r.sourceAt)).size, invalid = rows.filter(r => !validFlow(r)).length;
    const counts = new Map<number, number>(); eligible.forEach(r => counts.set(r.sourceAt, (counts.get(r.sourceAt) ?? 0) + 1));
    const duplicates = [...counts.values()].filter(n => n > 1).length;
    const buy = eligible.reduce((s, r) => s + Number(r.raw.buyNotional), 0), sell = eligible.reduce((s, r) => s + Number(r.raw.sellNotional), 0);
    const ratio = sell > 0 ? buy / sell : null;
    const ageSec = eligible.length ? (at - Math.max(...eligible.map(r => r.sourceAt))) / 1000 : null;
    const q = this.quality;
    const flowReasons = [samples < q.minTaker15mSamples ? "incomplete_minutes" : null,
      ageSec === null || ageSec < 0 || ageSec > q.maxTakerAgeSec ? "stale_or_unknown_age" : null,
      ratio === null ? "ratio_unavailable" : null, invalid ? "invalid_window" : null, duplicates ? "duplicate_window" : null].filter(Boolean);
    const br = latest("book", at), be = br ? bookEvidence(br.raw, at) : null, band = be?.band("pct_0_5");
    const bookReasons = [!br ? "missing" : null, be?.ageSec == null || be.ageSec < 0 || be.ageSec > q.maxBookAgeSec ? "stale_or_unknown_age" : null,
      !band?.healthy ? "invalid_05_band" : null].filter(Boolean);
    const ar = latest("asset", at), anchor = latest("asset", at - H);
    const currentAgeSec = ar ? (at - ar.sourceAt) / 1000 : null, anchorLagSec = anchor ? (at - H - anchor.sourceAt) / 1000 : null;
    const native = ar ? num(ar.raw.openInterest) : null, oldNative = anchor ? num(anchor.raw.openInterest) : null;
    const marked = (r: Evidence | null) => r ? num(r.raw.openInterestValue) ??
      (num(r.raw.openInterest) !== null && num(r.raw.markPrice) !== null ? Number(r.raw.openInterest) * Number(r.raw.markPrice) : null) : null;
    const pct = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? (a / b - 1) * 100 : null;
    const nativeChange = pct(native, oldNative), markedChange = pct(marked(ar), marked(anchor));
    const markChange = pct(ar ? num(ar.raw.markPrice) : null, anchor ? num(anchor.raw.markPrice) : null);
    const assetReasons = [!ar || !anchor ? "missing_current_or_anchor" : null,
      currentAgeSec === null || currentAgeSec < 0 || currentAgeSec > q.maxAssetAgeSec ? "stale_current" : null,
      anchorLagSec === null || anchorLagSec < 0 || anchorLagSec > q.maxAssetAnchorLagSec ? "stale_anchor" : null,
      nativeChange === null || markedChange === null || markChange === null ? "value_unavailable" : null].filter(Boolean);
    return { at, arrivalDelayMs: lag, historicalArrivalProven: false,
      flow: { buy: samples ? buy : null, sell: samples ? sell : null, ratio, samples, invalid, duplicates, ageSec,
        ready: !flowReasons.length, reasons: flowReasons, sources: rows.map(r => ref(r, lag)) },
      book: { ready: !bookReasons.length, reasons: bookReasons, ageSec: be?.ageSec ?? null,
        imbalance: bookReasons.length ? null : band!.imbalance, source: ref(br, lag) },
      oi: { ready: !assetReasons.length, reasons: assetReasons, currentAgeSec, anchorLagSec,
        nativeChange: assetReasons.length ? null : nativeChange, markedChange: assetReasons.length ? null : markedChange,
        source: ref(ar, lag), anchor: ref(anchor, lag) } };
  }
}

export function pulseGate(family: string, now: Row, before: Row, srRow: Row): Row {
  assert(now.at - before.at === 15 * M && now.arrivalDelayMs === before.arrivalDelayMs);
  let ready: boolean, pass: boolean, value: number | null;
  if (family === "flow") {
    ready = now.flow.ready && before.flow.ready;
    value = ready ? now.flow.ratio - before.flow.ratio : null; pass = value !== null && value < 0;
  } else if (family === "book") {
    ready = now.book.ready && before.book.ready;
    value = ready ? now.book.imbalance - before.book.imbalance : null; pass = value !== null && value < 0;
  } else if (family === "oi") {
    ready = now.oi.ready; value = ready ? now.oi.nativeChange : null; pass = value !== null && value >= 0;
  } else {
    assert.equal(family, "sr"); assert.equal(srRow.at, now.at);
    ready = srRow.sr.coverage.healthy && srRow.srMinus15.coverage.healthy;
    // Lack of a known level is a negative predicate, not a missing-data gate.
    value = ready ? Number(srRow.supportResponse.twoClosesBelow === true) : null; pass = value === 1;
  }
  return { family, ready, pass, value, reason: ready ? null : "source_unavailable",
    contextKey: `${now.arrivalDelayMs}|${now.at}`, previousContextKey: `${before.arrivalDelayMs}|${before.at}` };
}

export function combinedGate(id: string, at: number, cmf: Row | null, pulse: Row, readinessOnly = false): Row {
  const ready = (!cmf || cmf.ready) && pulse.ready;
  return { condition: id, expectedEnd: at, sourceStart: null, sourceEnd: null, availableAt: null, dayStart: null,
    evidenceKind: "mixed_context", cmf, pulse, readinessOnly,
    ready, pass: ready && (!cmf || cmf.pass) && (readinessOnly || pulse.pass), value: pulse.value,
    reason: ready ? null : "source_unavailable" };
}

/** Widen the legacy serialized Gate label at one research adapter, without relabeling mixed data as a candle. */
export function replay(minutes: readonly Candle[], opportunities: readonly Opportunity[], options: StandaloneOptions,
  gate?: (at: number) => Row) {
  return runCombination(minutes, opportunities, "short", options, gate as ((at: number) => Gate) | undefined);
}
