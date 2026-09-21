/** Research-only time alignment. Minute keys mean FIRST eligible decision, never bucket start. */
export const MINUTE_MS = 60_000;
export const REPLAY_CAUSALITY_VERSION = "source-asof-v2";
export type ReplayRow = Record<string, any>;
export type ObservationKind = "point" | "hl_taker" | "binance_taker";

export function utcMs(value: unknown): number {
  const parsed = typeof value === "number" ? value
    : typeof value === "string" && /^\d{13}$/.test(value) ? Number(value)
    : typeof value === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid UTC epoch-ms/ISO timestamp: ${String(value)}`);
  return parsed;
}

export function observationAvailability(row: ReplayRow, kind: ObservationKind = "point"): number {
  const timestamp = utcMs(row.timestamp ?? row.ts);
  // Explicit receipt time wins over event/window time. Never use nextFundingTime.
  const receipts = [row.receivedAt, row.observedAt, row.writtenAt, row.ingestedAt]
    .filter(x => x !== undefined && x !== null).map(utcMs);
  let availableAt = Math.max(timestamp, ...receipts);
  if (kind === "hl_taker") {
    const end = row.windowEnd == null ? timestamp : utcMs(row.windowEnd);
    // Collector timestamps these at windowEnd, but flush happens later and historical
    // rows omit receipt time. One decision-minute publication lag is an explicit
    // MODEL assumption, not proof that a delayed/disconnected collector delivered it.
    availableAt = Math.max(availableAt, end + (receipts.length ? 0 : MINUTE_MS));
  } else if (kind === "binance_taker" && row.source === "backfill") {
    // Historical backfills have no receipt timestamp. Treat their 5m aggregate as
    // unavailable until at least the period end, not its start. Not live-arrival proof.
    availableAt = Math.max(availableAt, timestamp + 5 * MINUTE_MS);
  } else if (row.windowEnd != null) {
    availableAt = Math.max(availableAt, utcMs(row.windowEnd));
  }
  return availableAt;
}

export function firstDecisionAt(availableAt: number): number {
  return Math.ceil(utcMs(availableAt) / MINUTE_MS) * MINUTE_MS;
}

/** Exact as-of values at minute decision boundaries, retaining selected availability time.
 * Compression is safe ONLY for queries at minute boundaries (including lookback anchors).
 */
export class CausalMinuteLatest<T> extends Map<number, T> {
  readonly availableAt = new Map<number, number>();
  observe(at: number, value: T): void {
    const key = firstDecisionAt(at);
    const previous = this.availableAt.get(key);
    if (previous !== undefined && previous > at) return; // out-of-order older record
    if (previous === at && JSON.stringify(this.get(key)) !== JSON.stringify(value)) {
      throw new Error(`Conflicting observations with identical availability timestamp ${at}`);
    }
    this.availableAt.set(key, at);
    super.set(key, value);
  }
}

export function addAtAvailability(map: Map<number, number>, at: number, value: number): void {
  if (!Number.isFinite(value)) throw new Error("Non-finite aggregate value");
  const key = firstDecisionAt(at);
  map.set(key, (map.get(key) ?? 0) + value);
}

export function isClosedBy(start: number, intervalMs: number, end: number): boolean {
  return start + intervalMs <= end;
}
