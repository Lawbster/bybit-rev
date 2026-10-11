/** Frozen HS01 portfolio terms. Margin budgets are NOT Bybit leverage settings. */
export const PORTFOLIO_POLICY = 'HS01-P2-THREE-SLOT-MACD-R3:v1';
export const MINUTE = 60_000;
export const SOURCES = ['SF08', 'L2', 'R5', 'PA07', 'CRSI', 'R3'] as const;
export type SetupSource = typeof SOURCES[number];
export type Source = SetupSource | 'main';
export type Owner = 'main' | 'setup0' | 'setup1' | 'setup2' | 'R3';
export type Side = 1 | -1;
export const OWNERS: readonly Owner[] = ['main', 'setup0', 'setup1', 'setup2', 'R3'];
export const TERMS = Object.freeze({
  SF08: { side: 1, notional: 20_000 / 3, bracket: true, deferTimeoutRelease: true },
  L2: { side: 1, notional: 20_000 / 3, bracket: false, deferTimeoutRelease: false },
  R5: { side: -1, notional: 20_000 / 3, bracket: false, deferTimeoutRelease: false },
  PA07: { side: -1, notional: 20_000 / 3, bracket: true, deferTimeoutRelease: false },
  CRSI: { side: 1, notional: 20_000 / 3, bracket: false, deferTimeoutRelease: false },
  R3: { side: -1, notional: 10_000, bracket: false, deferTimeoutRelease: false },
} as const);
export const BUDGET_LEVERAGE: Readonly<Record<Owner, number>> = Object.freeze({
  main: 25, setup0: 3, setup1: 3, setup2: 3, R3: 3,
});

export function epoch(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid UTC epoch milliseconds');
}
export function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid ${name}`);
}
export function owner(value: string): asserts value is Owner {
  if (!(OWNERS as readonly string[]).includes(value)) throw new Error('unknown portfolio owner');
}
export function source(value: string): asserts value is Source {
  if (value !== 'main' && !(SOURCES as readonly string[]).includes(value)) throw new Error('unknown source');
}

/** Actual receipts, never predicted future exits, authorize releasing a slot. */
export function releaseAt(s: Source, reason: string, executionAt: number, observedAt: number): number {
  epoch(executionAt); epoch(observedAt);
  if (observedAt < executionAt) throw new Error('receipt precedes execution');
  const defer = s !== 'main' && s !== 'R3'
    && (reason !== 'timeout' || TERMS[s].deferTimeoutRelease);
  return Math.max(observedAt, defer ? Math.floor(executionAt / MINUTE) * MINUTE + MINUTE : executionAt);
}
