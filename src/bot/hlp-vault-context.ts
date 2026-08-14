const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MAX_SAMPLE_AGE_MS = 30 * MINUTE;

export interface HlpVaultSample {
  timestamp: number;
  apr: number;
  maxDistributable: number;
}

export interface HlpVaultObservationContextV1 {
  version: 1;
  observationalOnly: true;
  ready: boolean;
  blockers: string[];
  decisionTs: number;
  currentTs: number | null;
  currentAgeMs: number | null;
  anchor4hTs: number | null;
  anchor24hTs: number | null;
  apr: number | null;
  aprChange4h: number | null;
  aprChange24h: number | null;
  maxDistributable: number | null;
  maxDistributableChange4hPct: number | null;
  maxDistributableChange24hPct: number | null;
  drain24hBelowFrozenMedian: boolean | null;
}

export const HLP_VAULT_DRAIN_24H_FROZEN_MEDIAN_PCT = -0.41;

function latestBefore(
  samples: HlpVaultSample[],
  timestamp: number,
  maximumAgeMs = MAX_SAMPLE_AGE_MS,
): HlpVaultSample | null {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (samples[middle].timestamp < timestamp) low = middle + 1;
    else high = middle;
  }
  const sample = samples[low - 1];
  return sample && timestamp - sample.timestamp <= maximumAgeMs ? sample : null;
}

function finiteChange(current: number, anchor: number): number | null {
  return Number.isFinite(current) && Number.isFinite(anchor) ? current - anchor : null;
}

function finitePctChange(current: number, anchor: number): number | null {
  return Number.isFinite(current) && Number.isFinite(anchor) && anchor > 0
    ? ((current - anchor) / anchor) * 100
    : null;
}

export function computeHlpVaultObservationContext(
  samples: HlpVaultSample[],
  decisionTs: number,
): HlpVaultObservationContextV1 {
  const current = latestBefore(samples, decisionTs);
  const anchor4h = latestBefore(samples, decisionTs - 4 * HOUR);
  const anchor24h = latestBefore(samples, decisionTs - 24 * HOUR);
  const blockers: string[] = [];
  if (!current) blockers.push("current_missing_or_stale");
  if (!anchor4h) blockers.push("anchor_4h_missing_or_stale");
  if (!anchor24h) blockers.push("anchor_24h_missing_or_stale");
  const mdChange4h = current && anchor4h
    ? finitePctChange(current.maxDistributable, anchor4h.maxDistributable)
    : null;
  const mdChange24h = current && anchor24h
    ? finitePctChange(current.maxDistributable, anchor24h.maxDistributable)
    : null;
  return {
    version: 1,
    observationalOnly: true,
    ready: blockers.length === 0,
    blockers,
    decisionTs,
    currentTs: current?.timestamp ?? null,
    currentAgeMs: current ? decisionTs - current.timestamp : null,
    anchor4hTs: anchor4h?.timestamp ?? null,
    anchor24hTs: anchor24h?.timestamp ?? null,
    apr: current?.apr ?? null,
    aprChange4h: current && anchor4h ? finiteChange(current.apr, anchor4h.apr) : null,
    aprChange24h: current && anchor24h ? finiteChange(current.apr, anchor24h.apr) : null,
    maxDistributable: current?.maxDistributable ?? null,
    maxDistributableChange4hPct: mdChange4h,
    maxDistributableChange24hPct: mdChange24h,
    drain24hBelowFrozenMedian: mdChange24h === null
      ? null
      : mdChange24h < HLP_VAULT_DRAIN_24H_FROZEN_MEDIAN_PCT,
  };
}
