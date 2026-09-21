/** Research input tape: availability, event windows, source age and missingness are distinct. */
import path from "path";
import type { OnChainFeatures } from "../src/bot/shadow-logger";
import { assetObservationAt, bookEvidence, finiteData as num, fundingPerHour } from "../src/hl-data-quality";
import { CausalMinuteLatest, firstDecisionAt, observationAvailability, utcMs } from "./replay-causality";
import { streamJsonl } from "./hype-freerun-canonical-replay";

type Point = { at: number; sourceAt: number; data: Record<string, number | null> };
class Points {
  map = new CausalMinuteLatest<Point>();
  keys: number[] = [];
  seal() { this.keys = [...this.map.keys()].sort((a, b) => a - b); }
  at(now: number, oldestAllowed = -Infinity): Point | null {
    let lo = 0, hi = this.keys.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (this.keys[m] <= now) lo = m + 1; else hi = m; }
    const row = lo ? this.map.get(this.keys[lo - 1])! : null;
    return row && row.at >= oldestAllowed ? row : null;
  }
}
type Flow = { availableAt: number; eventAt: number; buy: number; sell: number; largeBuy: number; largeSell: number; count: number };
class Flows {
  rows: Flow[] = [];
  seal() { this.rows.sort((a, b) => a.availableAt - b.availableAt); }
  window(now: number, span: number) {
    let lo = 0, hi = this.rows.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (this.rows[m].availableAt <= now) lo = m + 1; else hi = m; }
    let buy = 0, sell = 0, largeBuy = 0, largeSell = 0, count = 0, last: number | null = null;
    const minutes = new Set<number>();
    // Late fragments retain their event time; never shift old flow into a newer window.
    for (let i = lo - 1; i >= 0 && this.rows[i].availableAt > now - span; i--) {
      const r = this.rows[i];
      if (r.eventAt <= now - span || r.eventAt > now) continue;
      buy += r.buy; sell += r.sell; largeBuy += r.largeBuy; largeSell += r.largeSell; count += r.count;
      minutes.add(Math.floor(r.eventAt / 60000)); last = Math.max(last ?? 0, r.eventAt);
    }
    return { buy, sell, largeBuy, largeSell, count, samples: minutes.size, last,
      ratio: sell > 0 ? buy / sell : null, net: minutes.size ? buy - sell : null };
  }
}

export function emptyReplayPulse(): OnChainFeatures {
  return { taker4h: null, taker1h: null, taker4hBuyVol: null, taker4hSellVol: null, taker1hBuyVol: null, taker1hSellVol: null,
    hlTaker15m: null, hlTaker1h: null, hlTaker4h: null, hlTaker15mSamples: 0, hlTaker1hSamples: 0, hlTakerAgeSec: null,
    hlTaker15mNetNotional: null, hlTaker1hNetNotional: null, hlTaker4hNetNotional: null, hlTaker15mBuyNotional: null, hlTaker15mSellNotional: null,
    liq4hLongUsd: null, liq4hShortUsd: null, liq4hLongShortRatio: null,
    oiBy4hPct: null, oiBn4hPct: null, oiHl4hPct: null, oiHl1hPct: null, hlAssetOi1hPct: null, hlAssetOi4hPct: null,
    hlAssetFundingNow: null, hlAssetAgeSec: null, hlAsset1hAnchorLagSec: null, hlAsset4hAnchorLagSec: null,
    fdByNow: null, fdBnNow: null, fdHlNow: null, hlObBid025Usd: null, hlObAsk025Usd: null, hlObBid05Usd: null, hlObAsk05Usd: null,
    hlObBid2Usd: null, hlObAsk2Usd: null, hlObImbalance05: null, hlObImbalance2: null, hlObAskBid05Ratio: null, hlObAskBid2Ratio: null,
    hlObAgeSec: null, btc4hMovePct: null };
}
type Kind = "byOi" | "bnOi" | "hlOi" | "asset" | "book" | "byFunding" | "bnFunding" | "hlFunding" | "vault";
export class ReplayMarketInputs {
  private points = Object.fromEntries(["byOi", "bnOi", "hlOi", "asset", "book", "byFunding", "bnFunding", "hlFunding", "vault"].map(k => [k, new Points()])) as Record<Kind, Points>;
  private hl = new Flows();
  private bn = new Flows();
  readonly audit = { accepted: 0, invalidFlow: 0, bookBandInvalid: 0, modeledTakerReceipt: 0 };
  add(kind: Kind | "hlTaker" | "bnTaker", row: any) {
    const flow = kind === "hlTaker" || kind === "bnTaker";
    const at = observationAvailability(row, kind === "hlTaker" ? "hl_taker" : kind === "bnTaker" ? "binance_taker" : "point");
    if (flow) {
      const buy = num(kind === "hlTaker" ? row.buyNotional : row.buyVol), sell = num(kind === "hlTaker" ? row.sellNotional : row.sellVol);
      if (buy === null || sell === null || buy < 0 || sell < 0) { this.audit.invalidFlow++; return; }
      if (kind === "hlTaker" && row.writtenAt == null && row.receivedAt == null) this.audit.modeledTakerReceipt++;
      const eventAt = utcMs(row.windowEnd ?? (kind === "bnTaker" && row.source === "backfill" ? utcMs(row.timestamp) + 300000 : row.timestamp));
      (kind === "hlTaker" ? this.hl : this.bn).rows.push({ availableAt: firstDecisionAt(at), eventAt, buy, sell,
        largeBuy: num(row.largeBuyNotional) ?? 0, largeSell: num(row.largeSellNotional) ?? 0,
        count: (num(row.buyCount) ?? 0) + (num(row.sellCount) ?? 0) });
    } else {
      let sourceAt = utcMs(row.timestamp ?? row.ts);
      if (kind === "asset") sourceAt = assetObservationAt(row) ?? sourceAt;
      let data: Point["data"];
      if (kind === "book") {
        const b = bookEvidence(row, at), b05 = b.band("pct_0_5"), b2 = b.band("pct_2_0"), b025 = b.band("pct_0_25");
        sourceAt = Math.min(b.sourceAt ?? sourceAt, num(row.receivedAt) ?? Infinity);
        if (!b05.healthy) this.audit.bookBandInvalid++;
        data = { bid05: b05.bid, ask05: b05.ask, imb05: b05.imbalance, ratio05: b05.askBidRatio,
          bid2: b2.bid, ask2: b2.ask, imb2: b2.imbalance, ratio2: b2.askBidRatio, bid025: b025.bid, ask025: b025.ask };
      } else data = { oi: num(row.openInterest), value: num(row.openInterestValue) ??
        (num(row.openInterest) !== null && num(row.markPrice) !== null ? Number(row.openInterest) * Number(row.markPrice) : null), mark: num(row.markPrice),
        rate: num(row.fundingRate), hourlyRate: fundingPerHour(row.fundingRate, row.fundingIntervalHours),
        premium: num(row.premium), oracle: num(row.oraclePrice), apr: num(row.apr), distributable: num(row.maxDistributable) };
      this.points[kind].map.observe(at, { at, sourceAt, data });
    }
    this.audit.accepted++;
  }
  seal() { Object.values(this.points).forEach(p => p.seal()); this.hl.seal(); this.bn.seal(); }
  latchPulse(now: number) {
    const a = this.hl.window(now, 900000), b = this.hl.window(now, 3600000);
    return { taker15m: a.ratio, taker1h: b.ratio, taker15mSamples: a.samples, taker1hSamples: b.samples,
      takerAgeSec: b.last === null ? null : (now - b.last) / 1000 };
  }
  snapshot(now: number) {
    const p = emptyReplayPulse();
    const h15 = this.hl.window(now, 900000), h1 = this.hl.window(now, 3600000), h4 = this.hl.window(now, 14400000);
    const b1 = this.bn.window(now, 3600000), b4 = this.bn.window(now, 14400000);
    Object.assign(p, { hlTaker15m: h15.ratio, hlTaker1h: h1.ratio, hlTaker4h: h4.ratio,
      hlTaker15mSamples: h15.samples, hlTaker1hSamples: h1.samples, hlTakerAgeSec: h1.last === null ? null : (now - h1.last) / 1000,
      hlTaker15mNetNotional: h15.net, hlTaker1hNetNotional: h1.net, hlTaker4hNetNotional: h4.net,
      hlTaker15mBuyNotional: h15.samples ? h15.buy : null, hlTaker15mSellNotional: h15.samples ? h15.sell : null,
      taker4h: b4.ratio, taker1h: b1.ratio, taker4hBuyVol: b4.samples ? b4.buy : null, taker4hSellVol: b4.samples ? b4.sell : null,
      taker1hBuyVol: b1.samples ? b1.buy : null, taker1hSellVol: b1.samples ? b1.sell : null });
    const change = (kind: Kind, ms: number, field = "value") => {
      // Live computeOnChainFeatures reads an 8h source tail for OI/asset anchors.
      const a = this.points[kind].at(now, now - 28800000), b = this.points[kind].at(now - ms, now - 28800000);
      const x = a?.data[field], y = b?.data[field];
      return x != null && y != null && y > 0 ? (x / y - 1) * 100 : null;
    };
    p.oiBy4hPct = change("byOi", 14400000); p.oiBn4hPct = change("bnOi", 14400000);
    p.oiHl4hPct = change("hlOi", 14400000); p.oiHl1hPct = change("hlOi", 3600000);
    p.hlAssetOi1hPct = change("asset", 3600000); p.hlAssetOi4hPct = change("asset", 14400000);
    const a = this.points.asset.at(now, now - 28800000), a1 = this.points.asset.at(now - 3600000, now - 28800000), a4 = this.points.asset.at(now - 14400000, now - 28800000);
    p.hlAssetFundingNow = a?.data.rate ?? null; p.hlAssetAgeSec = a ? (now - a.sourceAt) / 1000 : null;
    p.hlAsset1hAnchorLagSec = a1 ? (now - 3600000 - a1.sourceAt) / 1000 : null;
    p.hlAsset4hAnchorLagSec = a4 ? (now - 14400000 - a4.sourceAt) / 1000 : null;
    p.fdByNow = this.points.byFunding.at(now, now - 14400000)?.data.rate ?? null;
    p.fdBnNow = this.points.bnFunding.at(now, now - 14400000)?.data.rate ?? null;
    p.fdHlNow = this.points.hlFunding.at(now, now - 14400000)?.data.rate ?? null;
    const book = this.points.book.at(now, now - 14400000);
    p.hlObAgeSec = book ? (now - Math.min(book.at, book.sourceAt)) / 1000 : null;
    if (book) Object.assign(p, { hlObBid05Usd: book.data.bid05, hlObAsk05Usd: book.data.ask05,
      hlObImbalance05: book.data.imb05, hlObAskBid05Ratio: book.data.ratio05, hlObBid2Usd: book.data.bid2,
      hlObAsk2Usd: book.data.ask2, hlObImbalance2: book.data.imb2, hlObAskBid2Ratio: book.data.ratio2,
      hlObBid025Usd: book.data.bid025, hlObAsk025Usd: book.data.ask025 });
    return { pulse: p, sources: Object.fromEntries(Object.entries(this.points).map(([k, v]) => {
      const row = v.at(now); return [k, row ? { availableAt: row.at, sourceAt: row.sourceAt, ageSec: (now - row.sourceAt) / 1000 } : null];
    })), research: { nativeOi1hPct: change("asset", 3600000, "oi"), markedOi1hPct: p.hlAssetOi1hPct,
      mark1hPct: change("asset", 3600000, "mark"), hlFundingPerHour: this.points.hlFunding.at(now, now - 14400000)?.data.hourlyRate ?? null,
      largeBuy15m: h15.samples ? h15.largeBuy : null, largeSell15m: h15.samples ? h15.largeSell : null,
      tradeCount15m: h15.samples ? h15.count : null, vaultDistributable: this.points.vault.at(now, now - 1800000)?.data.distributable ?? null },
      health: { book05Known: p.hlObImbalance05 !== null, hl15mSamples: h15.samples, hl1hSamples: h1.samples,
        binance4hSamples: b4.samples, arrivalParityProven: false } };
  }
}

export async function loadReplayMarketInputs(dataDir: string, symbol: string, cutoff: number) {
  const tape = new ReplayMarketInputs();
  const files: Array<[Parameters<ReplayMarketInputs["add"]>[0], string]> = [
    ["hlTaker", `${symbol}_taker_hyperliquid.jsonl`], ["bnTaker", `${symbol}_taker_binance.jsonl`],
    ["asset", `${symbol}_asset_ctx_hyperliquid.jsonl`], ["book", `${symbol}_ob_bands_hyperliquid.jsonl`],
    ["byOi", `${symbol}_oi_live.jsonl`], ["bnOi", `${symbol}_oi_live_binance.jsonl`], ["hlOi", `${symbol}_oi_live_hyperliquid.jsonl`],
    ["byFunding", `${symbol}_funding_live.jsonl`], ["bnFunding", `${symbol}_funding_live_binance.jsonl`], ["hlFunding", `${symbol}_funding_live_hyperliquid.jsonl`],
    ["vault", `${symbol.replace(/USDT$/, "")}_hlp_vault.jsonl`],
  ];
  // Sequential to bound memory/IO pressure; no exchange polling.
  for (const [kind, file] of files) await streamJsonl(path.join(dataDir, file), row => {
    if (utcMs(row.timestamp ?? row.ts) <= cutoff) tape.add(kind, row);
  });
  tape.seal(); return tape;
}
