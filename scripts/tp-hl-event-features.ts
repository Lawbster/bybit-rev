/** Research-only, exact-millisecond as-of HL joins. No trading or network imports. */
export const MIN = 60_000;
export type Kind = "taker" | "book" | "asset" | "oi" | "funding" | "vault" | "candle1m" | "candle5m";
export type Row = Record<string, any>;
export type Observation = {
  kind: Kind; file: string; line: number; sampleAt: number; sourceAt: number;
  baseAvailableAt: number; recordedPublication: boolean; modeledLag: boolean;
  data: Row;
};
export const numberOrNull = (x: any): number | null => x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x);
export function epoch(x: any): number {
  const n = typeof x === "number" ? x : typeof x === "string" && /^\d+$/.test(x) ? Number(x) : Date.parse(x);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid UTC epoch: ${x}`);
  return n;
}
const ratio = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? a / b : null;
const pct = (a: number | null, b: number | null) => { const x = ratio(a, b); return x === null ? null : (x - 1) * 100; };
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

export function normalize(kind: Kind, raw: Row, file: string, line: number): Observation {
  const sampleAt = epoch(raw.timestamp ?? raw.ts);
  const clocks = [raw.receivedAt, raw.observedAt, raw.writtenAt, raw.ingestedAt].filter(v => v !== null && v !== undefined).map(epoch);
  const modeledLag = kind === "taker" || kind.startsWith("candle");
  const end = kind === "taker" ? epoch(raw.windowEnd ?? sampleAt)
    : kind === "candle1m" ? sampleAt + MIN : kind === "candle5m" ? sampleAt + 5 * MIN : sampleAt;
  const sourceAt = kind === "book" ? epoch(raw.exchangeTimestamp)
    : kind === "asset" ? Math.min(sampleAt, numberOrNull(raw.receivedAt) ?? sampleAt)
    : modeledLag ? end : sampleAt;
  const baseAvailableAt = Math.max(sampleAt, end, ...clocks, kind === "book" ? sourceAt : 0);
  let data: Row;
  if (kind === "taker") {
    data = Object.fromEntries(["buyNotional", "sellNotional", "buyVol", "sellVol", "buyCount", "sellCount", "largeBuyNotional", "largeSellNotional", "largeBuyCount", "largeSellCount", "firstTradeTime", "lastTradeTime", "largeTradeThresholdUsd"].map(k => [k, numberOrNull(raw[k])]));
    data.windowStart = epoch(raw.windowStart ?? end - MIN); data.windowEnd = end;
    data.valid = end - data.windowStart === MIN && end % MIN === 0 && [data.buyNotional, data.sellNotional, data.buyVol, data.sellVol, data.buyCount, data.sellCount].every(v => v !== null && v >= 0)
      && (data.firstTradeTime === null || data.firstTradeTime >= data.windowStart)
      && (data.lastTradeTime === null || data.lastTradeTime < end);
  } else if (kind === "book") {
    const band = (key: string) => {
      const bid = numberOrNull(raw.bidBands?.[key]), ask = numberOrNull(raw.askBands?.[key]);
      const healthy = raw.bidBandsTruncated?.[key] === false && raw.askBandsTruncated?.[key] === false
        && raw.bandResolutionTooCoarse?.[key] === false && bid !== null && ask !== null && bid >= 0 && ask >= 0 && bid + ask > 0;
      return { healthy, bid: healthy ? bid : null, ask: healthy ? ask : null,
        imbalance: healthy ? (bid! - ask!) / (bid! + ask!) : null };
    };
    data = { band025: band("pct_0_25"), band05: band("pct_0_5"), band2: band("pct_2_0"),
      mid: numberOrNull(raw.midPrice), aggregated: raw.bestBidAskAreAggregated === true,
      spreadPct: numberOrNull(raw.spreadPct), coarse01: raw.bandResolutionTooCoarse?.pct_0_1 === true };
  } else if (kind.startsWith("candle")) {
    data = Object.fromEntries(["open", "high", "low", "close", "volume", "trades"].map(k => [k, numberOrNull(raw[k])]));
    data.end = end; data.start = sampleAt;
    data.valid = [data.open, data.high, data.low, data.close].every(v => v !== null && v > 0)
      && data.volume !== null && data.volume >= 0 && data.high >= Math.max(data.open, data.close)
      && data.low <= Math.min(data.open, data.close) && sampleAt % (kind === "candle1m" ? MIN : 5 * MIN) === 0;
  } else data = Object.fromEntries(["openInterest", "openInterestValue", "markPrice", "midPrice", "oraclePrice", "fundingRate", "fundingIntervalHours", "premium", "dayNtlVlm", "apr", "maxDistributable"].map(k => [k, numberOrNull(raw[k])]));
  return { kind, file, line, sampleAt, sourceAt, baseAvailableAt, recordedPublication: raw.writtenAt != null || raw.ingestedAt != null,
    modeledLag: modeledLag && clocks.length === 0, data };
}
export function availableAt(o: Observation, legacyLagMs: number): number {
  return Math.max(o.baseAvailableAt, o.modeledLag ? o.sourceAt + legacyLagMs : 0);
}
export function reference(o: Observation | null, lag: number): Row | null {
  return o ? { file: o.file, line: o.line, sampleAt: o.sampleAt, sourceAt: o.sourceAt, availableAt: availableAt(o, lag),
    availabilityBasis: o.modeledLag ? `modeled_end_plus_${lag}ms` : o.recordedPublication ? "recorded_publication" : "sample_time_proxy" } : null;
}
function upper(rows: Observation[], at: number): number {
  let lo = 0, hi = rows.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (rows[m].sourceAt <= at) lo = m + 1; else hi = m; }
  return lo;
}

export class TpHlTape {
  readonly rows: Record<Kind, Observation[]> = { taker: [], book: [], asset: [], oi: [], funding: [], vault: [], candle1m: [], candle5m: [] };
  constructor(readonly spec: Row) {}
  add(o: Observation) { this.rows[o.kind].push(o); }
  seal() { Object.values(this.rows).forEach(rs => rs.sort((a, b) => a.sourceAt - b.sourceAt || a.baseAvailableAt - b.baseAvailableAt || a.line - b.line)); }
  latest(kind: Kind, now: number, lag: number): Observation | null {
    const rs = this.rows[kind];
    for (let i = upper(rs, now) - 1; i >= 0; i--) {
      const r = rs[i]; if (availableAt(r, lag) <= now) {
        if (kind === "taker" || kind.startsWith("candle")) {
          const copies = this.range(kind, r.sourceAt - 1, r.sourceAt, now, lag);
          // Conflicting copies of a completed bucket are ambiguity, not an update
          // we can silently choose using today's full file.
          if (new Set(copies.map(x => JSON.stringify(x.data))).size > 1) return null;
        }
        return r;
      }
    }
    return null;
  }
  range(kind: Kind, start: number, end: number, now: number, lag: number): Observation[] {
    return this.rows[kind].slice(upper(this.rows[kind], start), upper(this.rows[kind], end)).filter(r => availableAt(r, lag) <= now);
  }
  flow(now: number, spanMinutes: number, lag: number, end = now) {
    const groups = new Map<number, Observation[]>();
    for (const r of this.range("taker", end - spanMinutes * MIN, end, now, lag)) {
      const a = groups.get(r.sourceAt) ?? []; a.push(r); groups.set(r.sourceAt, a);
    }
    const selected: Observation[] = []; let ambiguous = 0;
    for (const bucket of groups.values()) {
      const variants = new Map(bucket.map(r => [JSON.stringify(r.data), r]));
      if (variants.size !== 1 || !bucket[0].data.valid) { ambiguous++; continue; }
      // Earliest available copy is sufficient; no later duplicate can backdate availability.
      selected.push([...bucket].sort((a, b) => availableAt(a, lag) - availableAt(b, lag))[0]);
    }
    const sum = (key: string): number | null => selected.length && selected.every(r => r.data[key] !== null) ? selected.reduce((a, r) => a + r.data[key], 0) : null;
    const buy = sum("buyNotional"), sell = sum("sellNotional"), total = buy !== null && sell !== null ? buy + sell : null;
    const largeBuy = sum("largeBuyNotional"), largeSell = sum("largeSellNotional");
    const required = this.spec.windowCoverage[`flow${spanMinutes}m`] ?? spanMinutes - 1;
    const healthy = selected.length >= required && ambiguous === 0 && total !== null && total > 0;
    return { start: end - spanMinutes * MIN, end, samples: selected.length, expected: spanMinutes, ambiguous,
      healthy, buy, sell, total, net: buy !== null && sell !== null ? buy - sell : null,
      buyShare: ratio(buy, total), buySellRatio: ratio(buy, sell), largeBuy, largeSell,
      largeShare: largeBuy !== null && largeSell !== null ? ratio(largeBuy + largeSell, total) : null,
      count: selected.length ? selected.reduce((a, r) => a + r.data.buyCount + r.data.sellCount, 0) : null,
      sources: selected.map(r => reference(r, lag)), sourceMax: selected.length ? Math.max(...selected.map(r => r.sourceAt)) : null };
  }
  snapshot(now: number, lag = this.spec.legacyPublicationLagMs): Row {
    const source: Row = {}, quality: Row = {}, features: Record<string, number | null> = {};
    const pick = (kind: Kind, at = now): Observation | null => {
      const o = this.latest(kind, at, lag); const ref = reference(o, lag);
      const age = o ? at - o.sourceAt : null;
      const fresh = o !== null && age! >= 0 && age! <= this.spec.freshnessMs[kind];
      source[at === now ? kind : `${kind}_${(now - at) / MIN}m_anchor`] = ref && { ...ref, queryAt: at, ageMs: age, fresh };
      return fresh ? o : null;
    };
    const f15 = this.flow(now, 15, lag), f5 = this.flow(now, 5, lag), p10 = this.flow(now, 10, lag, now - 5 * MIN);
    source.taker15 = { sources: f15.sources, start: f15.start, end: f15.end, samples: f15.samples, expected: f15.expected, ambiguous: f15.ambiguous };
    source.taker5 = { sources: f5.sources, start: f5.start, end: f5.end, samples: f5.samples, expected: f5.expected, ambiguous: f5.ambiguous };
    source.takerPrior10 = { sources: p10.sources, start: p10.start, end: p10.end, samples: p10.samples, expected: p10.expected, ambiguous: p10.ambiguous };
    quality.flow15Healthy = f15.healthy; quality.flow5Healthy = f5.healthy; quality.flow15Samples = f15.samples;
    features.buyShare15 = f15.healthy ? f15.buyShare : null; features.takerRatio15 = f15.healthy ? f15.buySellRatio : null;
    features.netTaker15Usd = f15.healthy ? f15.net : null; features.turnover15Usd = f15.healthy ? f15.total : null;
    features.tradeCount15 = f15.healthy ? f15.count : null; features.largeShare15 = f15.healthy ? f15.largeShare : null;
    features.largeBuy15Usd = f15.healthy ? f15.largeBuy : null; features.largeSell15Usd = f15.healthy ? f15.largeSell : null;
    features.buyShare5 = f5.healthy ? f5.buyShare : null;
    features.buyShareAcceleration = f5.healthy && p10.healthy && f5.buyShare !== null && p10.buyShare !== null ? f5.buyShare - p10.buyShare : null;
    features.turnoverPaceRatio = f5.healthy && p10.healthy && f5.total !== null && p10.total !== null ? ratio(f5.total / f5.samples, p10.total / p10.samples) : null;
    const lastFlow = pick("taker"); features.lastMinuteBuyShare = lastFlow?.data.valid ? ratio(lastFlow.data.buyNotional, lastFlow.data.buyNotional + lastFlow.data.sellNotional) : null;
    const book = pick("book"), bookAnchor = pick("book", now - 15 * MIN);
    for (const band of ["025", "05", "2"]) {
      const x = book?.data[`band${band}`];
      features[`bookImbalance${band}`] = x?.healthy ? x.imbalance : null;
      features[`bookBid${band}Usd`] = x?.healthy ? x.bid : null; features[`bookAsk${band}Usd`] = x?.healthy ? x.ask : null;
    }
    quality.book05Healthy = book?.data.band05.healthy === true;
    features.bookImbalance05Change15 = quality.book05Healthy && bookAnchor?.data.band05.healthy ? book!.data.band05.imbalance - bookAnchor.data.band05.imbalance : null;
    features.bookBid05Change15Pct = quality.book05Healthy && bookAnchor?.data.band05.healthy ? pct(book!.data.band05.bid, bookAnchor.data.band05.bid) : null;
    features.bookAsk05Change15Pct = quality.book05Healthy && bookAnchor?.data.band05.healthy ? pct(book!.data.band05.ask, bookAnchor.data.band05.ask) : null;
    features.aggregatedSpreadPct = book?.data.spreadPct ?? null;
    const minuteBooks = new Map<number, Observation>();
    for (const r of this.range("book", now - 15 * MIN, now, now, lag)) {
      if (r.data.band05.healthy && r.sampleAt - r.sourceAt <= this.spec.freshnessMs.book) minuteBooks.set(Math.floor(r.sampleAt / MIN), r);
    }
    const bookSamples = [...minuteBooks.values()]; quality.book15MinuteBins = bookSamples.length;
    source.book15 = { sources: bookSamples.map(r => reference(r, lag)), start: now - 15 * MIN, end: now };
    features.bookBidDominantShare15 = bookSamples.length >= this.spec.windowCoverage.book15mMinMinuteBins ? bookSamples.filter(r => r.data.band05.imbalance > 0).length / bookSamples.length : null;
    features.bookMeanImbalance15 = bookSamples.length >= this.spec.windowCoverage.book15mMinMinuteBins ? mean(bookSamples.map(r => r.data.band05.imbalance)) : null;
    for (const kind of ["asset", "oi"] as const) {
      const current = pick(kind), anchor = pick(kind, now - 15 * MIN);
      quality[`${kind}Healthy`] = current !== null;
      features[`${kind}NativeOi`] = current?.data.openInterest ?? null;
      features[`${kind}MarkedOiUsd`] = current?.data.openInterestValue ?? null;
      features[`${kind}NativeOiChange15Pct`] = pct(current?.data.openInterest ?? null, anchor?.data.openInterest ?? null);
      features[`${kind}MarkedOiChange15Pct`] = pct(current?.data.openInterestValue ?? null, anchor?.data.openInterestValue ?? null);
      features[`${kind}MarkChange15Pct`] = pct(current?.data.markPrice ?? null, anchor?.data.markPrice ?? null);
      features[`${kind}Mark`] = current?.data.markPrice ?? null;
    }
    const funding = pick("funding"), fundingAnchor = pick("funding", now - 15 * MIN);
    quality.fundingHealthy = funding !== null;
    const hourly = (x: Observation | null) => ratio(x?.data.fundingRate ?? null, x?.data.fundingIntervalHours ?? null);
    features.fundingPerHour = hourly(funding); features.fundingHourlyChange15 = hourly(funding) !== null && hourly(fundingAnchor) !== null ? hourly(funding)! - hourly(fundingAnchor)! : null;
    features.premium = funding?.data.premium ?? null;
    const vault = pick("vault"), vaultAnchor = pick("vault", now - 15 * MIN);
    features.vaultApr = vault?.data.apr ?? null; features.vaultDistributableUsd = vault?.data.maxDistributable ?? null;
    features.vaultDistributableChange15Pct = pct(vault?.data.maxDistributable ?? null, vaultAnchor?.data.maxDistributable ?? null);
    const c = pick("candle1m"), ca = pick("candle1m", now - 15 * MIN), c5 = pick("candle5m");
    features.hlClosedPrice = c?.data.valid ? c.data.close : null;
    const cs = c && ca ? this.range("candle1m", ca.sourceAt, c.sourceAt, now, lag) : [];
    const bins = new Map<number, Observation[]>(); for (const x of cs) { const a = bins.get(x.sourceAt) ?? []; a.push(x); bins.set(x.sourceAt, a); }
    const continuous = c !== null && ca !== null && c.data.valid && ca.data.valid && c.sourceAt - ca.sourceAt === 15 * MIN && bins.size === 15
      && [...bins.values()].every(rs => rs.every(r => r.data.valid) && new Set(rs.map(r => JSON.stringify(r.data))).size === 1);
    quality.candle15Healthy = continuous;
    source.candle15 = { sources: [...bins.values()].map(rs => reference(rs[0], lag)), start: ca?.sourceAt ?? null, end: c?.sourceAt ?? null };
    features.hlClosedReturn15Pct = continuous ? pct(c!.data.close, ca!.data.close) : null;
    features.hlClosedVolume15 = continuous ? [...bins.values()].reduce((a, rs) => a + rs[0].data.volume, 0) : null;
    features.hlLast5mReturnPct = c5?.data.valid ? pct(c5.data.close, c5.data.open) : null;
    quality.coreHealthy = f15.healthy && quality.book05Healthy && quality.assetHealthy;
    quality.historicalArrivalProven = Object.values(source).filter((r: any) => r && r.availabilityBasis).every((r: any) => r.availabilityBasis === "recorded_publication")
      && f15.sources.length > 0 && f15.sources.every((r: any) => r?.availabilityBasis === "recorded_publication");
    return { asOf: now, iso: new Date(now).toISOString(), legacyLagMs: lag, features, quality, sources: source,
      observedFlow15: { buy: f15.buy, sell: f15.sell, samples: f15.samples, ambiguous: f15.ambiguous } };
  }
}

export function stats(xs: Array<number | null | undefined>): Row {
  const a = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  const q = (p: number) => { const j = (a.length - 1) * p, i = Math.floor(j); return a.length ? a[i] + (a[Math.ceil(j)] - a[i]) * (j - i) : null; };
  return { n: a.length, mean: mean(a), p10: q(.1), median: q(.5), p90: q(.9), min: a[0] ?? null, max: a.at(-1) ?? null,
    positiveShare: a.length ? a.filter(v => v > 0).length / a.length : null };
}
