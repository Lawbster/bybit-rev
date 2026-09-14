/** A timeout releases the caller, NOT ownership of an unfinished request. */
export class BoundedRefresh<T> {
  private inFlight: Promise<T> | null = null;
  private deadlineAt = 0;
  lastAttemptAt: number | null = null;
  lastSuccessAt: number | null = null;
  lastError: string | null = null;
  constructor(private readonly timeoutMs = 2_000, private readonly retryMs = 10_000) {}

  get pending(): boolean { return this.inFlight !== null; }

  async run(load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (!this.inFlight) {
      if (this.lastError && this.lastAttemptAt !== null && now - this.lastAttemptAt < this.retryMs) {
        throw new Error(this.lastError);
      }
      this.lastAttemptAt = now;
      this.deadlineAt = now + this.timeoutMs;
      const request = Promise.resolve().then(load);
      this.inFlight = request;
      void request.then(() => {
        this.lastSuccessAt = Date.now(); this.lastError = null;
      }, err => { this.lastError = err instanceof Error ? err.message : String(err); })
        .finally(() => { if (this.inFlight === request) this.inFlight = null; });
    }
    const remaining = this.deadlineAt - Date.now();
    if (remaining <= 0) {
      this.lastError = "refresh timeout; original request still outstanding";
      throw new Error(this.lastError);
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([this.inFlight, new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          this.lastError = "refresh timeout; original request still outstanding";
          reject(new Error(this.lastError));
        }, remaining);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }
}
