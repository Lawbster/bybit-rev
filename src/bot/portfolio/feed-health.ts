/** Feed transport diagnostics are NOT permission to trade. No clock retiming. */
import type { PortfolioFeedReader } from './feed-loader';
import { MINUTE, epoch } from './contract';
import type { Aggressive10Context } from '../aggressive10-context';

export const FEED_REFRESH_MS = 1000;
export const FEED_SNAPSHOT_MAX_AGE_MS = 5000;
type Snapshot = ReturnType<PortfolioFeedReader['snapshot']>;
export interface FeedDiagnostics {
  transport: 'ready' | 'bootstrapping' | 'refresh_delayed' | 'window_rollover' | 'worker_error' | 'worker_stopped' | 'clock_invalid';
  fault: string | null;
  snapshotAt: number | null; snapshotAgeMs: number | null; receivedAt: number | null;
  windowAt: number | null; requiredWindowAt: number; through: number | null; gapAt: number | null;
  refreshIntervalMs: number;
}
export function describeFeed(value: Snapshot | null, error: string | null, stopped: boolean,
  receivedAt: number | null, now: number): FeedDiagnostics {
  epoch(now);
  let transport: FeedDiagnostics['transport'] = 'ready';
  if (stopped) transport = 'worker_stopped';
  else if (error) transport = 'worker_error';
  else if (!value) transport = 'bootstrapping';
  else if (value.at > now || value.poll.windowAt > Math.floor(now / MINUTE) * MINUTE) transport = 'clock_invalid';
  else if (now - value.at > FEED_SNAPSHOT_MAX_AGE_MS) transport = 'refresh_delayed';
  else if (value.poll.windowAt !== Math.floor(now / MINUTE) * MINUTE) transport = 'window_rollover';
  // Preserve known data faults even when transport freshness has also expired.
  const fault = stopped ? 'feed_worker_stopped' : error ? 'feed_worker_error:' + error.slice(0, 180)
    : transport === 'clock_invalid' ? 'feed_clock_invalid'
    : value?.health.error ?? value?.loader.error ?? value?.health.policyError
      ?? (value && value.health.gapAt !== null ? 'minute_feed_gap' : null);
  return { transport, fault, snapshotAt: value?.at ?? null, snapshotAgeMs: value ? now - value.at : null,
    receivedAt, windowAt: value?.poll.windowAt ?? null, requiredWindowAt: Math.floor(now / MINUTE) * MINUTE,
    through: value?.health.through ?? null, gapAt: value?.health.gapAt ?? null, refreshIntervalMs: FEED_REFRESH_MS };
}

export interface PortfolioIssue { kind: 'fault' | 'feed_delay' | null; reason: string | null }
export function classifyPortfolioIssue(x: { feed: FeedDiagnostics; missingMain: string[];
  high?: ReturnType<Aggressive10Context['diagnostics']>;
  error: string | null; recovery: string | null; executionIssue: string | null; indicatorError: string | null }): PortfolioIssue {
  const delayed = ['bootstrapping', 'refresh_delayed', 'window_rollover'].includes(x.feed.transport);
  // Indicators are supplied by this worker: do not relabel that same transport
  // delay as a second input fault. Independent candle/input faults still win.
  const highRollover = x.missingMain.includes('high') && x.high?.transport === 'minute_rollover';
  const missing = x.missingMain.filter(k => (k !== 'indicators' || !delayed) && (k !== 'high' || !highRollover));
  const fault = x.error ?? x.recovery ?? x.executionIssue ?? x.feed.fault ?? x.indicatorError
    ?? (missing.length ? 'main_inputs_unavailable:' + missing.join(',') : null);
  return fault ? { kind: 'fault', reason: fault } : delayed
    ? { kind: 'feed_delay', reason: x.feed.transport } : highRollover
    ? { kind: 'feed_delay', reason: 'high_minute_rollover' } : { kind: null, reason: null };
}

/** Independent clocks: a refresh delay cannot borrow/reset a real fault's age. */
export class PortfolioIssueTracker {
  private degradedSince: number | null = null;
  private faultSince: number | null = null;
  private feedDelaySince: number | null = null;
  update(issue: PortfolioIssue, now: number) {
    this.degradedSince = issue.kind ? this.degradedSince ?? now : null;
    this.faultSince = issue.kind === 'fault' ? this.faultSince ?? now : null;
    this.feedDelaySince = issue.kind === 'feed_delay' ? this.feedDelaySince ?? now : null;
    return { ...issue, degradedSince: this.degradedSince, faultSince: this.faultSince, feedDelaySince: this.feedDelaySince };
  }
}
