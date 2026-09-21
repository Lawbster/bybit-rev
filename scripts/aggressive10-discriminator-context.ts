/** Causal descriptive features only. No outcome, order, state mutation, or strategy hooks. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import { trailingHighIndices } from "./near-high-policy";
import { ReplayMarketInputs } from "./replay-market-inputs";
import { firstDecisionAt, observationAvailability } from "./replay-causality";
export type R = Record<string, any>;
export const M = 60000, H = 60 * M, D = 24 * H;
export const IDS = ["near_high_weak_hour", "remembered_high_break", "below_session_vwap_negative_roc", "lower_hour_structure",
  "hot_high_chase", "flow_deterioration", "flow_book_sell", "buying_recovery"];
export class PriceContext {
  readonly highs: Int32Array;
  readonly hours = new Map<number, Candle>();
  readonly sumVolume: Float64Array;
  readonly sumTurnover: Float64Array;
  constructor(readonly cs: Candle[]) {
    this.highs = trailingHighIndices(cs, 2880);
    this.sumVolume = new Float64Array(cs.length + 1); this.sumTurnover = new Float64Array(cs.length + 1);
    cs.forEach((c, i) => { assert.equal(c.endTs, c.ts + M); if (i) assert.equal(c.ts, cs[i - 1].endTs);
      this.sumVolume[i + 1] = this.sumVolume[i] + c.volume; this.sumTurnover[i + 1] = this.sumTurnover[i] + c.turnover; });
    for (let i = 0; i + 59 < cs.length; i++) {
      if (cs[i].ts % H) continue;
      const xs = cs.slice(i, i + 60), first = xs[0], last = xs[59];
      this.hours.set(last.endTs, { ts: first.ts, endTs: last.endTs, open: first.open, close: last.close,
        high: Math.max(...xs.map(c => c.high)), low: Math.min(...xs.map(c => c.low)),
        volume: xs.reduce((n, c) => n + c.volume, 0), turnover: xs.reduce((n, c) => n + c.turnover, 0) });
    }
  }
  index(end: number) { return (end - this.cs[0].endTs) / M; }
  candle(end: number) { const i = this.index(end); return Number.isInteger(i) ? this.cs[i] ?? null : null; }
  vwap(start: number, end: number) {
    const a = (start - this.cs[0].ts) / M, b = this.index(end) + 1;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b <= a || b > this.cs.length) return null;
    const v = this.sumVolume[b] - this.sumVolume[a]; return v > 0 ? (this.sumTurnover[b] - this.sumTurnover[a]) / v : null;
  }
  high(end: number) {
    const i = this.index(end), k = this.highs[i]; if (k === undefined || k < 0) return null;
    return { price: this.cs[k].high, highKnownAt: this.cs[k].endTs, sourceEnd: end, sourceStart: end - 2 * D };
  }
  at(asOf: number, entryAt: number): R {
    const c = this.candle(asOf); assert(c);
    const hourEnd = Math.floor(asOf / H) * H, hour = this.hours.get(hourEnd) ?? null, previous = this.hours.get(hourEnd - H) ?? null;
    const high = this.high(asOf), prior15 = this.candle(asOf - 15 * M);
    const distance = high ? 100 * (1 - c.close / high.price) : null;
    let anchor: R | null = null;
    for (let end = hourEnd; end > asOf - 6 * H; end -= H) {
      const h = this.hours.get(end), reference = this.high(end);
      if (h && reference && h.high >= reference.price * .99) { anchor = { ...h, reference }; break; }
    }
    const last15End = Math.floor(asOf / (15 * M)) * 15 * M;
    const closes15 = [last15End - 15 * M, last15End].map(end => this.candle(end)).map(c => c ? { end: c.endTs, close: c.close } : null);
    return { asOf, closedMinute: { start: c.ts, end: c.endTs, close: c.close }, high, distance2dPct: distance,
      hour, previousHour: previous, roc1h: hour && previous ? (hour.close / previous.close - 1) * 100 : null,
      sessionVwap: hour ? this.vwap(Math.floor(hour.ts / D) * D, hour.endTs) : null,
      ladderVwap: entryAt < asOf ? this.vwap(entryAt, asOf) : null,
      ret15m: prior15 ? (c.close / prior15.close - 1) * 100 : null, anchor, closes15 };
  }
}
type Flow = { at: number; sourceAt: number; valid: boolean; line: number };
export class PulseContext {
  readonly tape = new ReplayMarketInputs();
  readonly flow: Flow[] = [];
  readonly counts = { hlTaker: 0, book: 0, asset: 0 };
  constructor(readonly quality: R) {}
  add(kind: "hlTaker" | "book" | "asset", raw: R, line: number) {
    this.tape.add(kind, raw); this.counts[kind]++;
    if (kind !== "hlTaker") return;
    const sourceAt = Number(raw.windowEnd ?? raw.timestamp), start = Number(raw.windowStart);
    const valid = sourceAt % M === 0 && start === sourceAt - M &&
      [raw.buyNotional, raw.sellNotional, raw.buyVol, raw.sellVol, raw.buyCount, raw.sellCount].every(x => x != null && Number.isFinite(Number(x)) && Number(x) >= 0) &&
      (raw.firstTradeTime == null || (Number(raw.firstTradeTime) >= start && Number(raw.firstTradeTime) < sourceAt)) &&
      (raw.lastTradeTime == null || (Number(raw.lastTradeTime) >= start && Number(raw.lastTradeTime) < sourceAt));
    this.flow.push({ at: firstDecisionAt(observationAvailability(raw, "hl_taker")), sourceAt, valid, line });
  }
  seal() { this.tape.seal(); this.flow.sort((a, b) => a.at - b.at || a.line - b.line); }
  at(asOf: number, decisionAt: number): R {
    assert(asOf <= decisionAt && asOf % M === 0 && decisionAt % M === 0);
    const snap = this.tape.snapshot(asOf), p = snap.pulse, q = this.quality, extraAge = (decisionAt - asOf) / 1000;
    let lo = 0, hi = this.flow.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (this.flow[m].at <= asOf) lo = m + 1; else hi = m; }
    const flow = (minutes: number) => {
      const rows: Flow[] = []; for (let i = lo - 1; i >= 0 && this.flow[i].at > asOf - minutes * M; i--) {
        const r = this.flow[i]; if (r.sourceAt > asOf - minutes * M && r.sourceAt <= asOf) rows.push(r);
      }
      const samples = new Set(rows.map(r => r.sourceAt)).size, invalid = rows.filter(r => !r.valid).length;
      const duplicates = rows.length - samples, ageSec = rows.length ? (decisionAt - Math.max(...rows.map(r => r.sourceAt))) / 1000 : null;
      const ratio = minutes === 15 ? p.hlTaker15m : p.hlTaker1h;
      const required = minutes === 15 ? q.minTaker15mSamples : q.minTaker1hSamples;
      const reasons = [samples < required ? "incomplete_minutes" : null, invalid ? "invalid_windows" : null, duplicates ? "duplicate_windows" : null,
        ageSec === null || ageSec < 0 || ageSec > q.maxTakerAgeSec ? "stale_or_missing" : null, ratio === null ? "ratio_unknown" : null].filter(Boolean);
      return { ratio, samples, required, invalid, duplicates, ageSec, healthy: !reasons.length, reasons,
        firstSourceAt: rows.length ? Math.min(...rows.map(r => r.sourceAt)) : null,
        lastSourceAt: rows.length ? Math.max(...rows.map(r => r.sourceAt)) : null,
        latestEligibleAt: rows.length ? Math.max(...rows.map(r => r.at)) : null };
    };
    const ageBook = p.hlObAgeSec === null ? null : p.hlObAgeSec + extraAge;
    const bookHealthy = ageBook !== null && ageBook >= 0 && ageBook <= q.maxBookAgeSec && p.hlObImbalance05 !== null;
    const ageAsset = p.hlAssetAgeSec === null ? null : p.hlAssetAgeSec + extraAge;
    const assetHealthy = ageAsset !== null && ageAsset >= 0 && ageAsset <= q.maxAssetAgeSec && p.hlAsset1hAnchorLagSec !== null &&
      p.hlAsset1hAnchorLagSec >= 0 && p.hlAsset1hAnchorLagSec + extraAge <= q.maxAssetAnchorLagSec;
    return { asOf, decisionAt, flow15: flow(15), flow60: flow(60),
      book: { healthy: bookHealthy, ageSec: ageBook, imbalance05: bookHealthy ? p.hlObImbalance05 : null, source: snap.sources.book },
      asset: { healthy: assetHealthy, ageSec: ageAsset, source: snap.sources.asset,
        nativeOi1hPct: assetHealthy ? snap.research.nativeOi1hPct : null, markedOi1hPct: assetHealthy ? p.hlAssetOi1hPct : null },
      original: { hl15: p.hlTaker15m, hl1h: p.hlTaker1h, hl15Samples: p.hlTaker15mSamples, hl1hSamples: p.hlTaker1hSamples, hlAgeSec: p.hlTakerAgeSec } };
  }
}
export function descriptors(price: R, pulse: R, prior: R, decisionAt: number, lastTp: R | null): Record<string, boolean | null> {
  const near = price.distance2dPct === null ? null : price.distance2dPct <= 1 + 1e-10;
  const hour = price.hour, previous = price.previousHour;
  const flowHealthy = pulse.flow15.healthy && pulse.flow60.healthy && prior.flow15.healthy;
  const flowDeterioration = flowHealthy ? pulse.flow15.ratio < .9 && pulse.flow15.ratio < pulse.flow60.ratio && pulse.flow15.ratio <= prior.flow15.ratio : null;
  const anchor = price.anchor, closes: R[] = price.closes15;
  return {
    near_high_weak_hour: near === null || price.roc1h === null ? null : near && price.roc1h < 0,
    remembered_high_break: price.high === null || closes.some(c => !c) ? null : !!anchor && closes.every(c => c.end > anchor.endTs && c.close < anchor.low),
    below_session_vwap_negative_roc: !hour || price.sessionVwap === null || price.roc1h === null ? null : hour.close < price.sessionVwap && price.roc1h < 0,
    lower_hour_structure: !hour || !previous ? null : hour.high < previous.high && hour.close < previous.low,
    hot_high_chase: !lastTp ? false : lastTp.rsi === null || near === null ? null : lastTp.rsi >= 70 && decisionAt >= lastTp.at && decisionAt < lastTp.at + 10 * M && price.closedMinute.close >= lastTp.price && near,
    flow_deterioration: flowDeterioration,
    flow_book_sell: flowDeterioration === null || !pulse.book.healthy || !prior.book.healthy ? null : flowDeterioration && pulse.book.imbalance05 < 0 && pulse.book.imbalance05 < prior.book.imbalance05,
    buying_recovery: !pulse.flow15.healthy || !pulse.flow60.healthy || price.ret15m === null ? null : pulse.flow15.ratio > 1 && pulse.flow15.ratio > pulse.flow60.ratio && price.ret15m >= 0
  };
}
