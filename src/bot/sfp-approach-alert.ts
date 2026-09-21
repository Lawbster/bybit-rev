import fs from 'fs';
import { readCandleTail } from '../collector-candle-repair';
import { H, M, D, type Bar, type DetectorContext, type SetupEvent } from '../strategies/setup-context';
import { previewRangeLowSfp } from '../strategies/sfp-detector';
import { sfpActions, SFP_POLICY } from '../strategies/sfp-policy';
import { availableSfpMinutes, type SfpBarSnapshot, type SfpContextCache } from './sfp-candles';
import { atomicSfpJson } from './sfp-state';

export interface SfpApproach {
  id: string; observedAt: number; sourceThrough: number; closeAt: number;
  rangeLow: number; rangeHigh: number; sweepLow: number; reference: number;
  originalStop: number; stop: number; target: number;
}
export interface ApproachDelivery { sent: boolean; retryAfterMs?: number; }
interface Attempt {
  id: string; closeAt: number; attemptedAt: number; attempts: number;
  status: 'attempting' | 'sent' | 'rate_limited' | 'failed'; retryAt: number | null;
}
interface Ledger { version: 1; policy: string; accountUid: string; attempts: Attempt[]; }

export function approachWindow(now: number): boolean {
  const left = (Math.floor(now / (4 * H)) + 1) * 4 * H - now;
  return left > 0 && left <= 10 * M;
}

/** A preview is never an SfpSignal and is never fed to the execution coordinator. */
export function evaluateSfpApproach(snapshot: SfpBarSnapshot | null, rows: readonly any[], now: number, bootstrapAt: number): { reason: string; candidate: SfpApproach | null } {
  const no = (reason: string) => ({ reason, candidate: null });
  if (!approachWindow(now)) return no('outside_10m_window');
  const start = Math.floor(now / (4 * H)) * 4 * H, closeAt = start + 4 * H;
  if (!snapshot || snapshot.at !== start + M) return no('closed_context_unavailable');
  const { minutes, error } = availableSfpMinutes(rows, start, now, bootstrapAt);
  if (error) return no(error);
  // Keep the owner's 60s availability lag. Every minute in the forming prefix
  // must exist, including the most recent minute that should be knowable now.
  const lastTs = Math.floor(now / M) * M - 2 * M;
  const prefix = minutes.filter(m => m.ts <= lastTs);
  if (prefix.length !== (lastTs - start) / M + 1 || prefix.some((m, i) => m.ts !== start + i * M)) return no('forming_minutes_missing_or_late');
  const last = prefix.at(-1)!;
  const forming: Bar = { timestamp: start, open: prefix[0].open, close: last.close,
    high: Math.max(...prefix.map(m => m.high)), low: Math.min(...prefix.map(m => m.low)),
    volume: prefix.reduce((s, m) => s + m.volume, 0), turnover: prefix.reduce((s, m) => s + m.turnover, 0),
    availableAt: Math.max(...prefix.map(m => m.availableAt)) };
  const bars = snapshot.bars.filter(b => b.timestamp + 4 * H <= start && b.availableAt <= now);
  const pivots = snapshot.pivots.filter(p => p.availableAt <= now);
  const context: DetectorContext = { symbol: 'HYPEUSDT', minutes: [], lagMs: M,
    window: { start: bars[0]?.timestamp ?? start, end: now }, cutoff: now, params: {},
    bars: tf => { if (tf !== 4 * H) throw new Error('unexpected preview timeframe'); return bars; },
    pivots: (tf, width) => { if (tf !== 4 * H || width !== 2) throw new Error('unexpected preview pivots'); return pivots; },
    hit: () => { throw new Error('preview must not request unavailable minute history'); } };
  const previews = previewRangeLowSfp(context, forming);
  // Hypothetical bracket validation ONLY, using the unmodified SF08 action
  // builder (0.2%-5% original risk, 2R target, then 5% stop padding).
  const hypothetical: SetupEvent[] = previews.map(e => ({ ...e, stage: 'confirmed', knownAt: Math.floor(now / M) * M }));
  const terms = sfpActions(hypothetical)[0]; // same deterministic tie-break as live
  if (!terms) return no('no_eligible_provisional_reclaim');
  const e = previews.find(p => p.id === terms.id)!;
  return { reason: 'provisional_reclaim', candidate: { id: terms.id, observedAt: now,
    sourceThrough: last.endTs, closeAt, rangeLow: e.stages.level.price!, rangeHigh: e.stages.range.price!,
    sweepLow: terms.originalStop / 0.999, reference: terms.reference,
    originalStop: terms.originalStop, stop: terms.stop, target: terms.target } };
}

/** Sidecar notification owner: no orders, no mutations of trading state, no
 * full-history rescans. Persistent claim BEFORE HTTP prevents restart duplicates.
 * Only a definite HTTP 429 is retryable; an ambiguous delivery is not repeated. */
export class SfpApproachAlerts {
  readonly health = { error: null as string | null, lastCheckedAt: null as number | null,
    reason: 'waiting_for_10m_window', lastSetupId: null as string | null,
    lastSentAt: null as number | null, lastDelivery: null as string | null };
  private ledger: Ledger;
  private disabled = false;
  private lastMinute = -1;
  private work: Promise<void> | null = null;
  constructor(private readonly options: {
    file: string; candleFile: string; accountUid: string; bootstrapAt: number;
    cache: SfpContextCache; eligible: () => boolean;
    send: (candidate: SfpApproach) => Promise<ApproachDelivery>;
    clock?: () => number; read?: (file: string, since: number, span: number, maxBytes: number) => Promise<any[]>;
  }) {
    this.ledger = { version: 1, policy: SFP_POLICY, accountUid: options.accountUid, attempts: [] };
    try {
      if (fs.existsSync(options.file)) {
        const s = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        if (s.version !== 1 || s.policy !== SFP_POLICY || s.accountUid !== options.accountUid || !Array.isArray(s.attempts)
          || s.attempts.some((r: Attempt) => typeof r.id !== 'string' || !r.id.startsWith('SF01:long:')
            || !Number.isFinite(r.closeAt) || !Number.isFinite(r.attemptedAt) || !Number.isInteger(r.attempts) || r.attempts < 1 || r.attempts > 3
            || !['attempting', 'sent', 'rate_limited', 'failed'].includes(r.status)
            || !(r.retryAt === null || Number.isFinite(r.retryAt)))) throw new Error('invalid approach ledger');
        this.ledger = s;
      }
    } catch { this.disable('approach_ledger_unreadable'); }
  }
  private now() { return (this.options.clock ?? Date.now)(); }
  private disable(error: string) { this.disabled = true; this.health.error = error; }
  private save(): boolean {
    try { atomicSfpJson(this.options.file, this.ledger); return true; }
    catch { this.disable('approach_ledger_write_failed'); return false; }
  }
  tick(): void {
    const now = this.now();
    if (this.disabled || this.work) return;
    if (!this.options.eligible()) { this.health.reason = 'not_armed_flat_healthy'; return; }
    if (!approachWindow(now)) { this.health.reason = 'outside_10m_window'; return; }
    const minute = Math.floor(now / M);
    if (minute === this.lastMinute) return;
    this.lastMinute = minute;
    this.work = this.check().catch(() => { this.health.error = 'approach_observer_failed'; })
      .finally(() => { this.work = null; });
  }
  async drain(): Promise<void> { await this.work; }
  private async check(): Promise<void> {
    const start = Math.floor(this.now() / (4 * H)) * 4 * H;
    const rows = await (this.options.read ?? readCandleTail)(this.options.candleFile, start, M, 1024 * 1024);
    const now = this.now();
    // Recheck after I/O: do not deliver from stale asynchronous state.
    if (!this.options.eligible() || !approachWindow(now)) return;
    const result = evaluateSfpApproach(this.options.cache.value, rows, now, this.options.bootstrapAt);
    this.health.lastCheckedAt = now; this.health.reason = result.reason; this.health.error = null;
    const candidate = result.candidate;
    if (!candidate) return;
    this.health.lastSetupId = candidate.id;
    this.ledger.attempts = this.ledger.attempts.filter(r => r.attemptedAt >= now - 45 * D);
    let record = this.ledger.attempts.find(r => r.id === candidate.id || r.closeAt === candidate.closeAt);
    if (record && (record.id !== candidate.id || record.closeAt !== candidate.closeAt || record.status !== 'rate_limited'
      || record.retryAt === null || now < record.retryAt || record.attempts >= 3)) return;
    if (!record) {
      record = { id: candidate.id, closeAt: candidate.closeAt, attemptedAt: now, attempts: 0, status: 'attempting', retryAt: null };
      this.ledger.attempts.push(record);
    }
    record.status = 'attempting'; record.attempts++; record.retryAt = null;
    if (!this.save()) return;
    let response: ApproachDelivery;
    try { response = await this.options.send(candidate); }
    catch { response = { sent: false }; }
    const completedAt = this.now();
    if (response.sent) { record.status = 'sent'; this.health.lastSentAt = completedAt; }
    else if (Number.isFinite(response.retryAfterMs) && response.retryAfterMs! >= 0) {
      record.status = 'rate_limited'; record.retryAt = completedAt + Math.max(1000, response.retryAfterMs!);
    } else record.status = 'failed';
    this.health.lastDelivery = record.status;
    this.save();
  }
}
