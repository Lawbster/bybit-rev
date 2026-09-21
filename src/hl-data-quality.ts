/** Pure collector/research quality contract. No I/O, trading, or clock reads. */
export function finiteData(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function bookEvidence(row: any, now: number) {
  const written = finiteData(row?.writtenAt ?? row?.timestamp);
  const source = finiteData(row?.exchangeTimestamp);
  const received = finiteData(row?.receivedAt);
  const validTime = written !== null && source !== null && source > 0 &&
    written <= now && source <= now && (received === null || received <= now);
  const ageSec = validTime ? (now - Math.min(written!, source!, received ?? now)) / 1000 : null;
  const band = (key: string) => {
    const bid = finiteData(row?.bidBands?.[key]), ask = finiteData(row?.askBands?.[key]);
    const healthy = validTime && row?.bidBandsTruncated?.[key] === false &&
      row?.askBandsTruncated?.[key] === false && row?.bandResolutionTooCoarse?.[key] === false &&
      bid !== null && ask !== null && bid >= 0 && ask >= 0 && bid + ask > 0;
    return { healthy, bid: healthy ? bid : null, ask: healthy ? ask : null,
      imbalance: healthy ? (bid! - ask!) / (bid! + ask!) : null,
      askBidRatio: healthy && bid! > 0 ? ask! / bid! : null };
  };
  return { ageSec, sourceAt: source, writtenAt: written, validTime,
    aggregated: row?.bestBidAskAreAggregated === true, band };
}

/** A sample write is not a new market observation. Retain both clocks. */
export function observationMetadata(writtenAt: number, receivedAt: number | null) {
  return { observationVersion: 1, writtenAt, receivedAt };
}

/** Legacy asset rows lack a receipt clock: retain their weaker sample-time proxy. */
export function assetObservationAt(row: any): number | null {
  const sampled = finiteData(row?.timestamp ?? row?.ts);
  const received = finiteData(row?.receivedAt);
  return sampled === null ? null : Math.min(sampled, received ?? sampled);
}

export function fundingPerHour(rate: unknown, intervalHours: unknown): number | null {
  const r = finiteData(rate), h = finiteData(intervalHours);
  return r !== null && h !== null && h > 0 ? r / h : null;
}
