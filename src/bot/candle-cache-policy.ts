export const CANDLE_CLOSE_GRACE_MS = 10_000;

export type BoundaryAwareCandleCache<T> = {
  candles: T[];
  fetchedAt: number;
  refreshAt: number | null;
};

/**
 * If the newest row was still forming when fetched, require a refresh as soon
 * as that candle can be treated as completed. This prevents a cached partial
 * snapshot from later becoming decision evidence solely because time passed.
 */
export function candleBoundaryRefreshAt(
  candles: Array<{ timestamp: number }>,
  fetchedAt: number,
  periodMs: number,
  graceMs = CANDLE_CLOSE_GRACE_MS,
): number | null {
  if (candles.length === 0) return null;
  const newestTimestamp = candles.reduce(
    (latest, candle) => Math.max(latest, candle.timestamp),
    Number.NEGATIVE_INFINITY,
  );
  const completedAt = newestTimestamp + periodMs + graceMs;
  return completedAt > fetchedAt ? completedAt : null;
}

export function canReuseCandleCache<T>(
  cache: BoundaryAwareCandleCache<T>,
  now: number,
  ttlMs: number,
): boolean {
  if (cache.candles.length === 0) return false;
  if (now - cache.fetchedAt >= ttlMs) return false;
  return cache.refreshAt === null || now < cache.refreshAt;
}
