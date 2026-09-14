/** Operational retry state only. Never reuse strategy/fill/cooldown timestamps. */
export class AddRetryBackoff {
  until = 0;

  recordFailure(error: string | undefined, now: number): boolean {
    // Preserve the existing classification and five-minute delay.
    if (!error?.includes("position") && !error?.includes("leverage")) return false;
    this.until = Math.max(this.until, now + 5 * 60_000);
    return true;
  }

  blocked(now: number): boolean { return now < this.until; }
}

export interface PositionCapOverride { symbol: string; maxPositions: number; oneShot: boolean }

export function validPositionCapOverride(value: unknown, symbol: string): value is PositionCapOverride {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PositionCapOverride>;
  return v.symbol === symbol && Number.isInteger(v.maxPositions) && v.maxPositions! >= 1
    && v.maxPositions! <= 25 && typeof v.oneShot === "boolean";
}

/** Only maxPositions is hot-reloaded; bad reads retain the last valid base cap. */
export class RuntimePositionCap {
  private lastWarningAt = -Infinity;
  private lastError = "";

  constructor(public base: number, private readonly warn: (message: string) => void) {
    this.check(base);
  }

  private check(cap: unknown): asserts cap is number {
    if (typeof cap !== "number" || !Number.isInteger(cap) || cap < 1) {
      throw new Error("maxPositions must be a positive integer");
    }
  }

  refresh(load: () => { maxPositions: number }, now: number): number {
    try {
      const cap = load().maxPositions;
      this.check(cap);
      this.base = cap;
      this.lastError = "";
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      if (error !== this.lastError || now - this.lastWarningAt >= 5 * 60_000) {
        try { this.warn(`Config cap reload unavailable; retaining maxPositions=${this.base}: ${error}`); }
        catch { /* Diagnostics must not turn a handled read failure into a failed tick. */ }
        this.lastWarningAt = now;
      }
      this.lastError = error;
    }
    return this.base;
  }
}
