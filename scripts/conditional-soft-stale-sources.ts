/** F06 completed-bar features; no outcome labels or mutable bot state. */
import assert from "assert/strict";
import { EMA } from "technicalindicators";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { ReplaySrContext } from "./replay-sr-context";
import type { SRMemoryZoneEngine } from "../src/bot/sr-memory-zones";
import type { Candle, Series } from "./hype-freerun-canonical-replay";
import type { ResearchTpDecision } from "./replay-causal-engine";
import type { SoftStaleFamily, Context, R } from "./conditional-soft-stale-policy";
export function closedFrames(cs: Candle[], interval: number): Candle[] {
  return ClosedBarSeries.fromHistorical(cs.map(c => ({ ...c, timestamp: c.ts })), {
    sourceIntervalMs: 60000, targetIntervalMs: interval, publicationLagMs: 0 }).bars.map(b => ({ ...b.candle, ts: b.candle.timestamp, endTs: b.barEnd }));
}
export function latest<T extends { endTs: number }>(xs: T[], at: number): T | null {
  let l = 0, h = xs.length; while (l < h) { const m = (l + h) >>> 1; if (xs[m].endTs <= at) l = m + 1; else h = m; } return xs[l - 1] ?? null;
}
/** Unlike the live proximity helper, target room needs the nearest known zone at ANY distance. */
export function knownResistance(engine: Pick<SRMemoryZoneEngine, "getZones">, at: number, price: number) {
  const lv = engine.getZones(at).filter(z => z.price > price).sort((a, b) => a.price - b.price)[0];
  return lv ? { lv, dist: (lv.price - price) / price } : null;
}
export function buildSoftStaleSources(cs: Candle[], canonical?: Series) {
  const h4 = closedFrames(cs, 14400000), h1 = closedFrames(cs, 3600000);
  const structure = h4.map((b, i) => {
    const rows = h4.slice(Math.max(0, i - 248), i + 1), healthy = rows.length >= 201 && rows.every((v, k) => !k || v.ts === rows[k - 1].endTs);
    const p = rows.map(c => c.close), a = EMA.calculate({ period: 200, values: p }), e = EMA.calculate({ period: 50, values: p });
    return { endTs: b.endTs, close: b.close, healthy, ema200: a.at(-1) ?? null, ema50: e.at(-1) ?? null, ema50Prev: e.at(-2) ?? null };
  });
  let day = -1, volume = 0, turnover = 0, continuous = false;
  const vwap = h1.map((b, i) => {
    const d = Math.floor(b.ts / 86400000) * 86400000;
    if (d !== day) { day = d; volume = 0; turnover = 0; continuous = b.ts === day; }
    if (i && b.ts !== h1[i - 1].endTs) continuous = false;
    volume += b.volume; turnover += b.turnover;
    const six = h1.slice(Math.max(0, i - 5), i + 1), rocHealthy = six.length === 6 && six.every((v, k) => !k || v.ts === six[k - 1].endTs);
    return { endTs: b.endTs, close: b.close, dayStart: day, healthy: continuous && rocHealthy && volume > 0,
      vwap: continuous && volume > 0 ? turnover / volume : null, roc5: rocHealthy ? (b.close / six[0].close - 1) * 100 : null };
  });
  let matched = 0;
  if (canonical) for (let i = 0; i < cs.length; i++) {
    const f = latest(structure, cs[i].endTs); if (!f?.healthy || cs[i].endTs < (structure[248]?.endTs ?? Infinity)) continue;
    assert.equal(cs[i].endTs - f.endTs < 14400000, true);
    assert.equal(f.close >= f.ema200!, canonical.aboveEma200[i], `canonical EMA200 ${cs[i].endTs}`);
    assert.equal(f.close < f.ema200! && f.ema50! < f.ema50Prev!, canonical.trendBlocked[i], `canonical trend ${cs[i].endTs}`); matched++;
  }
  return { structure, vwap, canonicalMatchedMinutes: matched };
}
export function softStaleContext(family: SoftStaleFamily, tape: ReturnType<typeof buildSoftStaleSources>, cs: Candle[], cfg: R, lag: number, room: number) {
  const sr = family === "resistance" ? new ReplaySrContext(cs, cfg.srShadow) : null;
  let lastBoundary = -Infinity;
  return (d: Readonly<ResearchTpDecision>): Context => {
    const at = d.at - lag;
    if (family === "structure") {
      const f = latest(tape.structure, at), healthy = !!f?.healthy && at - f.endTs < 14400000;
      return { healthy, allowed: healthy && f!.close >= f!.ema200! && f!.ema50! >= f!.ema50Prev!, evidence: { ...f, sourceAt: at, lag } };
    }
    if (family === "vwap") {
      const f = latest(tape.vwap, at), healthy = !!f?.healthy && at - f.endTs < 3600000;
      return { healthy, allowed: healthy && f!.close > f!.vwap! && f!.roc5! > 0, evidence: { ...f, sourceAt: at, lag } };
    }
    if (family === "resistance") {
      const boundary = Math.floor(at / (cfg.srShadow.tfMin * 60000)) * cfg.srShadow.tfMin * 60000;
      if (boundary > lastBoundary) { sr!.at(boundary); lastBoundary = boundary; }
      const c = sr!.at(at), r = knownResistance(c.engine, at, d.price);
      const knownAt = r ? Math.max(...r.lv.touchData.map(t => t.ts)) : null;
      assert(knownAt === null || knownAt <= at);
      return { healthy: c.coverage.healthy && !!r, allowed: c.coverage.healthy && !!r && r.lv.price >= d.normalTarget * (1 + room / 100),
        evidence: { sourceAt: at, lag, coverage: c.coverage, resistance: r?.lv ?? null, knownAt, normalTarget: d.normalTarget, roomPct: room } };
    }
    return { healthy: true, allowed: true, evidence: {} };
  };
}
