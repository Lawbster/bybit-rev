/** FR01: minute-level flow response; no live readers, execution or future labels. */
import assert from "assert/strict";
import fs from "fs";
import readline from "readline";
import { observationAvailability, firstDecisionAt, utcMs } from "./replay-causality";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchSizeDecision } from "./replay-causal-engine";
export type R = Record<string, any>;
export const M = 60000, PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
export const VARIANTS = [
  { id: "acceleration_half", requireImpact: false, fraction: .5 },
  { id: "impact_half", requireImpact: true, fraction: .5 },
  { id: "acceleration_block", requireImpact: false, fraction: 0 },
  { id: "impact_block", requireImpact: true, fraction: 0 },
] as const;
export type Variant = typeof VARIANTS[number];
export const FEATURES = { recentMinutes: 15, referenceMinutes: 45, minimumSellShare: .6, minimumSellRateRatio: 1.5,
  maximumImpactReturnPct: -.2, minimumNextDepth: 8, windowEndLagMs: M, requireAllMinutes: true };
export function validate(d: R) {
  assert.deepEqual(d.variants, VARIANTS); assert.deepEqual(d.features, FEATURES);
  assert.deepEqual(d.controls, ["baseline", PARENT]); assert.deepEqual(d.sourceLags, [0, M]);
  assert.equal(d.cutoff, "2026-09-10T05:08:00Z"); assert.equal(d.start, "2026-05-17T20:43:00Z");
  assert.equal(d.initialEquity, 32000); assert.equal(d.feeRate, .00055); assert.equal(d.runs, 32); assert.equal(d.newTradingDefinitions, 4);
}
export type FlowRow = { end: number; available: number; buy: number; sell: number; valid: boolean; line: number };
export class FlowResponseTape {
  readonly rows = new Map<number, FlowRow[]>();
  readonly audit = { rows: 0, invalid: 0, modeledReceipt: 0, unassignable: 0 };
  add(raw: R, line: number) {
    this.audit.rows++;
    let end: number;
    try { end = utcMs(raw.windowEnd ?? raw.timestamp); } catch { this.audit.unassignable++; return; }
    if (end % M) { this.audit.unassignable++; return; }
    let available = Infinity, valid = true;
    try {
      available = firstDecisionAt(Math.max(observationAvailability(raw, "hl_taker"), raw.availableAt == null ? 0 : utcMs(raw.availableAt)));
      if ([raw.receivedAt, raw.writtenAt, raw.observedAt, raw.ingestedAt].every(x => x == null)) this.audit.modeledReceipt++;
      valid = raw.symbol === "HYPEUSDT" && raw.venue === "hyperliquid" && Number(raw.windowStart) === end - M &&
        Number(raw.intervalMs) === M && [raw.buyNotional, raw.sellNotional, raw.buyVol, raw.sellVol, raw.buyCount, raw.sellCount]
          .every(x => x !== null && x !== undefined && Number.isFinite(Number(x)) && Number(x) >= 0) &&
        [raw.buyCount, raw.sellCount].every(x => Number.isInteger(Number(x))) && raw.complete !== false && raw.partial !== true &&
        (raw.firstTradeTime == null || Number(raw.firstTradeTime) >= end - M && Number(raw.firstTradeTime) < end) &&
        (raw.lastTradeTime == null || Number(raw.lastTradeTime) >= end - M && Number(raw.lastTradeTime) < end) &&
        (raw.firstTradeTime == null || raw.lastTradeTime == null || Number(raw.firstTradeTime) <= Number(raw.lastTradeTime));
    } catch { valid = false; }
    if (!valid) this.audit.invalid++;
    const row = { end, available, buy: Number(raw.buyNotional), sell: Number(raw.sellNotional), valid, line };
    const xs = this.rows.get(end) ?? []; xs.push(row); this.rows.set(end, xs);
  }
  at(decisionAt: number, lag: number, closeAt: (end: number) => number | null): R {
    assert(Number.isSafeInteger(decisionAt) && decisionAt % M === 0 && [0, M].includes(lag));
    const asOf = decisionAt - lag, end = asOf - M, reasons = new Set<string>(), ids: number[] = [];
    let recentBuy = 0, recentSell = 0, priorSell = 0, validMinutes = 0, latestAvailable = 0;
    for (let j = 0; j < 60; j++) {
      const candidates = (this.rows.get(end - j * M) ?? []).filter(r => r.available <= asOf);
      if (!candidates.length) { reasons.add("missing_or_not_yet_available"); continue; }
      if (candidates.length !== 1) { reasons.add("duplicate_window"); continue; }
      const row = candidates[0]; if (!row.valid) { reasons.add("invalid_window"); continue; }
      ids.push(row.line); validMinutes++; latestAvailable = Math.max(latestAvailable, row.available);
      if (j < 15) { recentBuy += row.buy; recentSell += row.sell; } else priorSell += row.sell;
    }
    const close = closeAt(end), earlier = closeAt(end - 15 * M);
    const priceReady = close !== null && earlier !== null && Number.isFinite(close) && Number.isFinite(earlier) && close > 0 && earlier > 0;
    if (!priceReady) reasons.add("price_coverage");
    if (!(recentBuy + recentSell > 0 && priorSell > 0)) reasons.add("zero_flow_denominator");
    const ready = !reasons.size, sellShare = ready ? recentSell / (recentBuy + recentSell) : null;
    const sellRateRatio = ready ? (recentSell / 15) / (priorSell / 45) : null;
    const ret15Pct = priceReady ? (close! / earlier! - 1) * 100 : null;
    const acceleration = ready ? sellShare! >= .6 && sellRateRatio! >= 1.5 : null;
    const impact = ready ? ret15Pct! <= -.2 : null;
    return { decisionAt, lag, asOf, end, start: end - 60 * M, ready, reasons: [...reasons].sort(), validMinutes,
      latestAvailable: ids.length ? latestAvailable : null, ids, recentBuy, recentSell, priorSell, sellShare, sellRateRatio,
      close, earlier, ret15Pct, acceleration, impact,
      response: !ready ? "unknown" : !acceleration ? "no_acceleration" : impact ? "selling_with_impact" : ret15Pct! >= 0 ? "absorption_compatible" : "small_decline" };
  }
}
export async function loadFlowTape(file: string, cutoff: number) {
  const t = new FlowResponseTape(); let line = 0;
  for await (const text of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) {
    line++; if (!text.trim()) continue;
    const raw = JSON.parse(text); // Unparseable evidence aborts, never silently disappears.
    if (utcMs(raw.windowEnd ?? raw.timestamp) <= cutoff) t.add(raw, line);
  }
  assert.equal(t.audit.unassignable, 0, "Unassignable source windows require an explicit data review"); return t;
}
export class FlowResponseContext {
  readonly cache = new Map<string, R>();
  constructor(readonly tape: FlowResponseTape, readonly candles: Candle[]) {}
  closeAt = (end: number) => {
    const i = (end - this.candles[0].endTs) / M, c = this.candles[i];
    return Number.isInteger(i) && c?.endTs === end ? c.close : null;
  };
  at(at: number, lag: number) {
    const key = `${at}:${lag}`; if (!this.cache.has(key)) this.cache.set(key, this.tape.at(at, lag, this.closeAt));
    return this.cache.get(key)!;
  }
}
export function approvedSize(p: Variant | null, add: Pick<ResearchSizeDecision, "nextDepth" | "requestedNotional">, f: R | null) {
  const fire = !!p && add.nextDepth >= 8 && f?.ready === true && f.acceleration === true && (!p.requireImpact || f.impact === true);
  return { fire, notional: add.requestedNotional * (fire ? p!.fraction : 1) };
}
