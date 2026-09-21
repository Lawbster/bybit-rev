/** H00 descriptive evidence only. No orders, strategy decisions, network or clock reads. */
import assert from "assert/strict";
import crypto from "crypto";
import { ReplayMarketInputs } from "./replay-market-inputs";
import { observationAvailability, firstDecisionAt, utcMs } from "./replay-causality";
import { assetObservationAt, bookEvidence, finiteData as num } from "../src/hl-data-quality";
import { ReplaySrContext } from "./replay-sr-context";
import type { Candle } from "./hype-freerun-canonical-replay";

export const M = 60_000, H = 60 * M;
export type Row = Record<string, any>;
export type Kind = "hlTaker" | "book" | "asset";
export interface Evidence { kind: Kind; file: string; line: number; availableAt: number; eligibleAt: number; sourceAt: number; timingBasis: string; raw: Row; }
export function evidence(kind: Kind, raw: Row, file: string, line: number): Evidence {
  const receipts = [raw.receivedAt, raw.observedAt, raw.writtenAt, raw.ingestedAt].filter(x => x != null);
  const at = observationAvailability(raw, kind === "hlTaker" ? "hl_taker" : "point");
  const sourceAt = kind === "hlTaker" ? utcMs(raw.windowEnd ?? raw.timestamp)
    : kind === "asset" ? assetObservationAt(raw)! : utcMs(raw.exchangeTimestamp);
  return { kind, file, line, availableAt: at, eligibleAt: firstDecisionAt(at), sourceAt,
    timingBasis: receipts.length ? "recorded_receipt_or_write" : kind === "hlTaker" ? "modeled_end_plus_1m" : "sample_time_proxy", raw };
}
export function ref(r: Evidence | null): Row | null {
  if (!r) return null;
  const { raw, ...out } = r; return out;
}
export function validFlow(r: Evidence): boolean {
  const x = r.raw, end = r.sourceAt, start = num(x.windowStart);
  return start === end - M && end % M === 0 &&
    [x.buyNotional, x.sellNotional, x.buyVol, x.sellVol, x.buyCount, x.sellCount].every(v => num(v) !== null && Number(v) >= 0) &&
    (x.firstTradeTime == null || (num(x.firstTradeTime) !== null && Number(x.firstTradeTime) >= start)) &&
    (x.lastTradeTime == null || (num(x.lastTradeTime) !== null && Number(x.lastTradeTime) < end));
}
const closeEnough = (a: any, b: any) => a == null || b == null ? a == null && b == null : Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
const pct = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? (a / b - 1) * 100 : null;

export class IndicatorContextTape {
  readonly replay = new ReplayMarketInputs();
  readonly records: Evidence[] = [];
  constructor(readonly spec: Row) {}
  add(r: Evidence) { this.records.push(r); this.replay.add(r.kind, r.raw); }
  seal() { this.records.sort((a, b) => a.availableAt - b.availableAt || a.line - b.line); this.replay.seal(); }
  latest(kind: Kind, at: number): Evidence | null {
    for (let i = this.records.length - 1; i >= 0; i--) {
      const r = this.records[i]; if (r.kind === kind && r.eligibleAt <= at) return r;
    }
    return null;
  }
  snapshot(at: number): Row {
    assert(Number.isSafeInteger(at) && at % M === 0);
    const q = this.spec.quality, snap = this.replay.snapshot(at), p = snap.pulse;
    const flow = (minutes: number) => {
      const rows = this.records.filter(r => r.kind === "hlTaker" && r.eligibleAt <= at && r.eligibleAt > at - minutes * M && r.sourceAt > at - minutes * M && r.sourceAt <= at);
      const eligible = rows.filter(r => num(r.raw.buyNotional) !== null && num(r.raw.sellNotional) !== null && r.raw.buyNotional >= 0 && r.raw.sellNotional >= 0);
      const byEnd = new Map<number, number>(); eligible.forEach(r => byEnd.set(r.sourceAt, (byEnd.get(r.sourceAt) ?? 0) + 1));
      const invalid = rows.filter(r => !validFlow(r)).length, duplicates = [...byEnd.values()].filter(n => n > 1).length;
      const buy = eligible.reduce((s, r) => s + Number(r.raw.buyNotional), 0), sell = eligible.reduce((s, r) => s + Number(r.raw.sellNotional), 0);
      const ratio = sell > 0 ? buy / sell : null, samples = new Set(eligible.map(r => Math.floor(r.sourceAt / M))).size;
      const ageSec = eligible.length ? (at - Math.max(...eligible.map(r => r.sourceAt))) / 1000 : null;
      const required = minutes === 15 ? q.minTaker15mSamples : q.minTaker1hSamples;
      const reasons = [!samples ? "missing" : null, samples < required ? "incomplete_minutes" : null,
        ageSec === null || ageSec < 0 || ageSec > q.maxTakerAgeSec ? "stale_or_unknown_age" : null,
        ratio === null ? "ratio_unavailable" : null, invalid ? "invalid_window" : null, duplicates ? "duplicate_window" : null].filter(Boolean);
      assert(closeEnough(ratio, minutes === 15 ? p.hlTaker15m : p.hlTaker1h), "Flow metric differs from shared replay");
      assert.equal(samples, minutes === 15 ? p.hlTaker15mSamples : p.hlTaker1hSamples);
      return { start: at - minutes * M, end: at, ratio, buy: samples ? buy : null, sell: samples ? sell : null,
        net: samples ? buy - sell : null, samples, expected: minutes, required, ageSec, invalid, duplicates,
        healthy: reasons.length === 0, reasons, sources: rows.map(ref) };
    };
    const f15 = flow(15), f60 = flow(60), br = this.latest("book", at), ar = this.latest("asset", at);
    const be = br ? bookEvidence(br.raw, at) : null, b05 = be?.band("pct_0_5"), b2 = be?.band("pct_2_0");
    const bookFresh = be?.ageSec != null && be.ageSec >= 0 && be.ageSec <= q.maxBookAgeSec;
    const bookReasons = [!br ? "missing" : null, !bookFresh ? "stale_or_unknown_age" : null, !b05?.healthy ? "invalid_05_band" : null].filter(Boolean);
    const book = { source: ref(br), ageSec: be?.ageSec ?? null, aggregated: be?.aggregated ?? null,
      observedBand05: b05 ?? null, observedBand2: b2 ?? null, healthy: bookReasons.length === 0, reasons: bookReasons,
      imbalance05: bookFresh && b05?.healthy ? b05.imbalance : null, imbalance2: bookFresh && b2?.healthy ? b2.imbalance : null };
    if (br && at - br.availableAt <= 4 * H) assert(closeEnough(b05?.imbalance, p.hlObImbalance05), "Book metric differs from shared replay");
    const age = ar ? (at - ar.sourceAt) / 1000 : null, assetFresh = age !== null && age >= 0 && age <= q.maxAssetAgeSec;
    const changes = [60, 240].map(minutes => {
      const anchorAt = at - minutes * M, a = this.latest("asset", anchorAt), lagSec = a ? (anchorAt - a.sourceAt) / 1000 : null;
      const marked = (r: Evidence | null) => r ? num(r.raw.openInterestValue) ?? (num(r.raw.openInterest) !== null && num(r.raw.markPrice) !== null ? Number(r.raw.openInterest) * Number(r.raw.markPrice) : null) : null;
      const native = pct(ar ? num(ar.raw.openInterest) : null, a ? num(a.raw.openInterest) : null), usd = pct(marked(ar), marked(a));
      const mark = pct(ar ? num(ar.raw.markPrice) : null, a ? num(a.raw.markPrice) : null);
      const reasons = [!ar || !a ? "missing_current_or_anchor" : null, !assetFresh ? "stale_current" : null,
        lagSec === null || lagSec < 0 || lagSec > q.maxAssetAnchorLagSec ? "stale_anchor" : null,
        native === null || usd === null || mark === null ? "value_unavailable" : null].filter(Boolean);
      if (ar && a && ar.availableAt >= at - 8 * H && a.availableAt >= at - 8 * H) {
        assert(closeEnough(usd, minutes === 60 ? p.hlAssetOi1hPct : p.hlAssetOi4hPct));
        if (minutes === 60) assert(closeEnough(native, snap.research.nativeOi1hPct));
      }
      return { minutes, anchorAt, source: ref(a), anchorLagSec: lagSec, healthy: reasons.length === 0, reasons,
        nativeOiChangePct: reasons.length ? null : native, markedOiChangePct: reasons.length ? null : usd, markChangePct: reasons.length ? null : mark };
    });
    return { at, flow15: f15, flow60: f60, book, asset: { source: ref(ar), ageSec: age, currentFresh: assetFresh, changes },
      historicalArrivalProven: false, eligibilityUsesModeledOrProxyTime: true };
  }
}

export function zoneSnapshot(lv: Row): Row {
  const touches = [...lv.touchData].sort((a, b) => a.ts - b.ts);
  return { ...lv, snapshotId: crypto.createHash("sha256").update(JSON.stringify(touches)).digest("hex").slice(0, 24),
    usableAt: touches[1]?.ts ?? null, lastTouchKnownAt: touches.at(-1)?.ts ?? null };
}
export function attachSr(candles: Candle[], at: number, context: ReplaySrContext): Row {
  const idx = (at - candles[0].ts) / M - 1, c = candles[idx]; assert(c && c.endTs === at);
  const { engine, coverage } = context.at(at), zones = engine.getZones(at).map(zoneSnapshot), price = c.close;
  const nearest = (side: "support" | "resistance") => {
    const rows = zones.filter(z => side === "support" ? z.price < price : z.price > price).sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
    return rows.length ? { zone: rows[0], distancePct: Math.abs(rows[0].price / price - 1) * 100 } : null;
  };
  const support = nearest("support"), resistance = nearest("resistance");
  for (const z of zones) assert(z.touchData.every((t: Row) => t.ts <= at) && z.usableAt <= at && z.lastTouchKnownAt <= at);
  return { at, price, priceSource: { start: c.ts, end: c.endTs, availableAt: c.endTs }, coverage, zones,
    nearestSupport: support, nearestResistance: resistance, equalPriceZones: zones.filter(z => z.price === price),
    configuredSupportHit: engine.nearestSupport(at, price), configuredResistanceHit: engine.nearestResistance(at, price) };
}
export function joinSignal(at: number, snapshots: Map<number, Row>, sr: Map<number, Row>, candles: Candle[], spec: Row): Row {
  const now = snapshots.get(at)!, prev5 = snapshots.get(at - 5 * M)!, prev15 = snapshots.get(at - 15 * M)!;
  const current = sr.get(at)!, prior = sr.get(at - 15 * M)!;
  const closes = [at - 5 * M, at].map(end => { const c = candles[(end - candles[0].ts) / M - 1]; assert(c.endTs === end); return { end, price: c.close }; });
  const response = (side: "support" | "resistance") => {
    const level = prior[side === "support" ? "nearestSupport" : "nearestResistance"], b = spec.srResponseBufferPct / 100;
    const healthy = current.coverage.healthy && prior.coverage.healthy && level !== null;
    return { knownAt: at - 15 * M, frozenLevel: level, closed5mPrices: closes,
      twoClosesBelow: healthy ? closes.every(c => c.price < level.zone.price * (1 - b)) : null,
      twoClosesAbove: healthy ? closes.every(c => c.price > level.zone.price * (1 + b)) : null };
  };
  const change = (p: Row) => now.book.healthy && p.book.healthy ? now.book.imbalance05 - p.book.imbalance05 : null;
  const healthy = { flow15: now.flow15.healthy, flow60: now.flow60.healthy, book05: now.book.healthy,
    bookChange5: change(prev5) !== null, bookChange15: change(prev15) !== null,
    asset1h: now.asset.changes[0].healthy, asset4h: now.asset.changes[1].healthy, sr: current.coverage.healthy };
  return { at, iso: new Date(at).toISOString(), context: now, contextMinus5: prev5, contextMinus15: prev15,
    sr: current, srMinus15: prior, supportResponse: response("support"), resistanceResponse: response("resistance"),
    bookChange5: change(prev5), bookChange15: change(prev15), healthy,
    intersections: { flowSr: healthy.flow15 && healthy.sr, core: healthy.flow15 && healthy.book05 && healthy.asset1h && healthy.sr,
      fullContext: Object.values(healthy).every(Boolean) },
    descriptors: { flow15Class: !healthy.flow15 ? "unknown" : now.flow15.ratio <= spec.descriptiveClasses.flowSellMax ? "sell" : now.flow15.ratio >= spec.descriptiveClasses.flowBuyMin ? "buy" : "neutral",
      supportWithin1pct: current.coverage.healthy ? current.nearestSupport !== null && current.nearestSupport.distancePct <= spec.descriptiveClasses.srNearbyPct : null,
      resistanceWithin1pct: current.coverage.healthy ? current.nearestResistance !== null && current.nearestResistance.distancePct <= spec.descriptiveClasses.srNearbyPct : null } };
}
