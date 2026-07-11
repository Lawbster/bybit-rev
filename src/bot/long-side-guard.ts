export type GuardRunResult<T> =
  | { acquired: true; value: T }
  | { acquired: false; activeLabel: string | null };

export class LongSideGuard {
  private activeLabel: string | null = null;

  get isBusy(): boolean {
    return this.activeLabel !== null;
  }

  get label(): string | null {
    return this.activeLabel;
  }

  async tryRun<T>(label: string, fn: () => Promise<T>): Promise<GuardRunResult<T>> {
    if (this.activeLabel !== null) {
      return { acquired: false, activeLabel: this.activeLabel };
    }
    this.activeLabel = label;
    try {
      return { acquired: true, value: await fn() };
    } finally {
      this.activeLabel = null;
    }
  }
}
