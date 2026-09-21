/** F05 causal five-minute and two-stream evidence; no exchange access. */
import assert from "assert/strict";
import { lines } from "./hype-failed-recovery-study";
import { evidence, validFlow } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
import type { Candle } from "./hype-freerun-canonical-replay";
export const M = 60000, B = 5 * M;
export type R = Record<string, any>;
export type Frame = { end: number; availableAt: number; open: number; high: number; low: number; close: number; roc15: number; prior15High: number };
export function priceFrame(cs: Candle[], at: number, lag: number): Frame | null {
  const end = Math.floor((at - lag) / B) * B, i = (end - cs[0].endTs) / M;
  const xs = cs.slice(i - 4, i + 1), p = cs[i - 15], e15 = Math.floor(end / (15 * M)) * 15 * M;
  const j = (e15 - cs[0].endTs) / M, prior = cs.slice(j - 14, j + 1);
  if (xs.length !== 5 || prior.length !== 15 || !p || p.endTs !== end - 15 * M
    || xs.some((c, k) => c.endTs !== end - (4 - k) * M) || prior.some((c, k) => c.endTs !== e15 - (14 - k) * M)) return null;
  assert(end + lag <= at);
  return { end, availableAt: end + lag, open: xs[0].open, high: Math.max(...xs.map(c => c.high)), low: Math.min(...xs.map(c => c.low)),
    close: xs[4].close, roc15: 100 * (xs[4].close / p.close - 1), prior15High: Math.max(...prior.map(c => c.high)) };
}
export function supportSource(cs: Candle[], cfg: R) {
  const sr = new ReplaySrContext(cs, cfg as any); let boundary = -Infinity;
  return (end: number, price: number) => {
    const b = Math.floor(end / (30 * M)) * 30 * M; if (b > boundary) { sr.at(b); boundary = b; }
    const x = sr.at(end), z = x.engine.getZones(end).filter(z => z.price < price).sort((a, b) => b.price - a.price)[0];
    if (!x.coverage.healthy || !z) return null;
    const knownAt = Math.max(...z.touchData.map(t => t.ts)); assert(knownAt <= end);
    return { price: z.price, knownAt, observedAt: end, distancePct: 100 * (1 - z.price / price), touches: z.touchData, coverage: x.coverage };
  };
}
type F = { at: number; source: number; line: number; buy: number; sell: number; valid: boolean };
type A = { at: number; source: number; line: number; oi: number | null };
function upper<T extends { at: number }>(rows: T[], at: number) { let lo = 0, hi = rows.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (rows[m].at <= at) lo = m + 1; else hi = m; } return lo; }
export class RecoveryPulseTape {
  flow: F[] = []; asset: A[] = [];
  constructor(readonly quality: R) {}
  add(kind: "hlTaker" | "asset", raw: R, file: string, line: number) {
    const e = evidence(kind, raw, file, line);
    if (kind === "hlTaker") this.flow.push({ at: e.eligibleAt, source: e.sourceAt, line, buy: Number(raw.buyNotional), sell: Number(raw.sellNotional), valid: validFlow(e) });
    else this.asset.push({ at: e.eligibleAt, source: e.sourceAt, line, oi: Number.isFinite(Number(raw.openInterest)) && raw.openInterest != null && Number(raw.openInterest) >= 0 ? Number(raw.openInterest) : null });
  }
  seal() { this.flow.sort((a, b) => a.at - b.at || a.line - b.line); this.asset.sort((a, b) => a.at - b.at || a.line - b.line); }
  snapshot(at: number, lag: number): R {
    const rows: F[] = []; let i = upper(this.flow, at - lag) - 1;
    for (; i >= 0 && this.flow[i].at > at - 15 * M - lag; i--) {
      const f = this.flow[i]; if (f.source > at - 15 * M && f.source <= at) rows.push(f);
    }
    const samples = new Set(rows.map(x => x.source)).size, duplicate = rows.length !== samples, invalid = rows.some(x => !x.valid);
    const buy = rows.reduce((n, x) => n + x.buy, 0), sell = rows.reduce((n, x) => n + x.sell, 0), ratio = sell > 0 ? buy / sell : null;
    const age = rows.length ? at - Math.max(...rows.map(x => x.source)) : null;
    const a = this.asset[upper(this.asset, at - lag) - 1], p = this.asset[upper(this.asset, at - 60 * M - lag) - 1];
    const assetAge = a ? at - a.source : null, anchorLag = p ? at - 60 * M - p.source : null;
    const oi = a?.oi != null && p?.oi != null && p.oi > 0 ? 100 * (a.oi / p.oi - 1) : null;
    const flowHealthy = samples >= this.quality.min15 && !duplicate && !invalid && ratio !== null && Number.isFinite(ratio) && age !== null && age >= 0 && age <= this.quality.maxFlowAgeMs;
    const oiHealthy = oi !== null && assetAge !== null && assetAge >= 0 && assetAge <= this.quality.maxAssetAgeMs && anchorLag !== null && anchorLag >= 0 && anchorLag <= this.quality.maxAnchorLagMs;
    return { at, lag, flowHealthy, ratio, samples, duplicate, invalid, age, buy, sell, flowRows: rows,
      oiHealthy, nativeOi1hPct: oi, assetAge, anchorLag, current: a ?? null, anchor: p ?? null };
  }
}
export async function loadRecoveryPulse(spec: R) {
  const tape = new RecoveryPulseTape(spec.quality), start = Date.parse(spec.windows[1].start) - 2 * 3600000, end = Date.parse(spec.cutoff);
  for (const [kind, file] of [["hlTaker", "data/HYPEUSDT_taker_hyperliquid.jsonl"], ["asset", "data/HYPEUSDT_asset_ctx_hyperliquid.jsonl"]] as const) {
    await lines(file, (r, line) => { const ts = Number(r.windowEnd ?? r.timestamp); if (ts >= start && ts <= end) tape.add(kind, r, file, line); });
    console.log(`[F05 sources] ${kind} loaded`);
  }
  tape.seal(); return tape;
}
