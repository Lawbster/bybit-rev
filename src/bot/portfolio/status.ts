/** Read-only display of receipt inventory and decisions already made by the owner. */
import { OWNERS, type Owner } from './contract';
import { ownerPosition, type PortfolioLedger } from './ledger';
import { ownedMainPositions } from './main-inventory';
import type { PortfolioExchangeSnapshot } from './execution-coordinator';
import type { PortfolioRuntime } from './runtime';
import { childOpenKey, childTerminal } from './bracket-state';
import type { FeedDiagnostics } from './feed-health';

export const HEALTH_MAX_AGE = 30_000;
export const ACCOUNT_MAX_AGE = 60_000;
export function fresh(at: unknown, now: number, maxAge: number): boolean {
  return typeof at === 'number' && Number.isFinite(at) && at <= now && now - at <= maxAge;
}
type TickReport = Awaited<ReturnType<PortfolioRuntime['tick']>>;
export interface OwnerDisplay {
  owner: Owner; source: string; qty: number; side: number | null; cost: number;
  averageEntry: number | null; openedAt: number | null; rungs: number;
  unrealized: number | null; exitAt: number | null; exitReason: string | null;
  protection: string; exiting: boolean;
}
export interface PortfolioMonitor {
  version: 1; pauseRequested: boolean; flattenRequested: boolean;
  reservations: number; activeExits: number; accountAt: number | null;
  pendingMutations: number; confirmedResting: number;
  bid: number | null; ask: number | null; owners: OwnerDisplay[];
  lastGate: string; setupStatus: string; receipts: number;
}
export function buildPortfolioMonitor(s: PortfolioLedger, account: PortfolioExchangeSnapshot | null | undefined,
  report: TickReport | null, now: number, controls: { pauseRequested: boolean; flattenRequested: boolean },
  executionIssue: string | null): PortfolioMonitor {
  const validAccount = !!account && fresh(account.observedAt, now, ACCOUNT_MAX_AGE);
  const verified = validAccount && !s.recovery && !executionIssue;
  const orders = Object.values(s.orders);
  const pending = orders.filter(o => !o.terminal);
  const confirmedResting = pending.filter(o => verified && o.command?.protection && o.restingConfirmedAt !== undefined
    && o.cancelRequestedAt === undefined && account!.openLinks.includes(o.link)).length;
  const owners = OWNERS.map(owner => {
    const p = ownerPosition(s, owner), entry = orders.filter(o => o.owner === owner && o.kind === 'open'
      && p.lots.some(l => l.id === o.lotId));
    const quote = validAccount ? (p.side === 1 ? account!.bid : account!.ask) : null;
    const schedules = p.lots.map(l => s.lifecycle?.exits[l.id]).filter(e => !!e);
    let protection = p.qty ? 'timed/indicator exit; no price SL/TP by design' : 'none (flat)';
    if (p.qty && owner === 'main') {
      const tp = orders.find(o => o.owner === owner && !o.terminal && o.command?.protection?.kind === 'maker_tp');
      const confirmed = tp && verified && tp.restingConfirmedAt !== undefined && tp.cancelRequestedAt === undefined
        && Math.abs(tp.qty - tp.appliedQty - p.qty) < 1e-7 && account!.openLinks.includes(tp.link);
      protection = tp ? `maker TP ${tp.command!.protection!.price} (${confirmed ? 'last verified' : 'NOT confirmed'})`
        : 'maker TP not confirmed';
    } else if (p.qty && p.lots.some(l => l.source === 'SF08' || l.source === 'PA07')) {
      const brackets = entry.map(o => s.brackets?.[o.link]).filter((b): b is NonNullable<typeof b> => !!b && b.completedAt === undefined);
      const children = brackets.flatMap(b => b.children).filter(c => !childTerminal(c));
      const covered = (kind: 'tp' | 'sl') => children.filter(c => c.kind === kind).reduce((n, c) => n + c.qty - c.cumulativeQty, 0);
      const confirmed = verified && brackets.length > 0 && brackets.every(b => b.cancelRequestedAt === undefined)
        && children.every(c => account!.openLinks.includes(childOpenKey(c.orderId)))
        && Math.abs(covered('tp') - p.qty) < 1e-7 && Math.abs(covered('sl') - p.qty) < 1e-7;
      const prices = (kind: 'tp' | 'sl') => [...new Set(children.filter(c => c.kind === kind).map(c => c.price))].join('/') || '?';
      protection = `TP ${prices('tp')} / SL ${prices('sl')} (${confirmed ? 'last verified' : 'NOT confirmed'})`;
    }
    return { owner, source: p.lots[0]?.source ?? '', qty: p.qty, side: p.side, cost: p.cost,
      averageEntry: p.averageEntry, openedAt: p.lots.length ? Math.min(...p.lots.map(l => l.openedAt)) : null,
      rungs: owner === 'main' ? ownedMainPositions(s).length : 0,
      unrealized: p.qty && quote && quote > 0 ? p.side! * (quote * p.qty - p.cost) : p.qty ? null : 0,
      exitAt: schedules.length ? Math.min(...schedules.map(e => e.dueAt)) : null,
      exitReason: schedules[0]?.reason ?? null, protection,
      exiting: !!s.exitRequests?.[owner] && s.exitRequests[owner]!.completedAt === undefined };
  });
  const add = report?.add;
  return { version: 1, ...controls, reservations: Object.keys(s.reservations).length,
    pendingMutations: pending.length - confirmedResting, confirmedResting,
    activeExits: Object.values(s.exitRequests ?? {}).filter(e => e.completedAt === undefined).length,
    accountAt: account?.observedAt ?? null, bid: validAccount ? account!.bid : null, ask: validAccount ? account!.ask : null,
    owners, lastGate: add ? add.result.reason ?? (add.decision?.reasons.join(';') || add.result.state) : 'not evaluated',
    setupStatus: report?.setups.entryStatus ?? 'not evaluated', receipts: Object.keys(s.executions).length };
}

/** Health files are external JSON; the formatter intentionally tolerates old/missing fields. */
export interface StatusHealth {
  writtenAt?: number; mode?: string; enabled?: boolean; configuredEntryEnabled?: boolean; entryEnabled?: boolean;
  policy?: string; uid?: string; status?: string; error?: string | null; recovery?: string | null; tickMs?: number;
  reconciliation?: { at?: number; equity?: number; availableBalance?: number; longQty?: number; shortQty?: number } | null;
  pending?: { resting?: boolean }[]; monitor?: PortfolioMonitor;
  mainContext?: { horizonDays: number; coverage: { healthy: boolean; actualContinuousBars: number; expectedBars: number; firstMissingTs?: number };
    overextended: { missing: string[] }; repair: { pending: boolean; lastError: string | null; nextAttemptAt: number | null } };
  realizedBeforeFunding?: number; funding?: { amount?: number; unallocated?: number };
  feed?: { ready?: boolean; reason?: string; diagnostics?: FeedDiagnostics; health?: { through?: number | null; gapAt?: number | null } };
}
const number = (v: unknown, digits = 2) => typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '?';
const money = (v: unknown) => '$' + number(v);
const brief = (v: unknown, max = 180) => String(v ?? 'unknown').replace(/[\r\n`]/g, ' ').slice(0, max);
const utc = (v: number) => Number.isFinite(v) ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '?';
export function formatPortfolioStatus(h: StatusHealth, now = Date.now()): string {
  const stale = !fresh(h.writtenAt, now, HEALTH_MAX_AGE), a = h.reconciliation, m = h.monitor;
  const accountFresh = fresh(a?.at, now, ACCOUNT_MAX_AGE);
  const lines = [
    `HYPE PORTFOLIO | ${brief(h.mode)} | ${h.entryEnabled ? 'ENTRIES ARMED' : 'ENTRIES PAUSED/OFF'} | ${brief(h.status)}`,
    `${utc(h.writtenAt ?? NaN)} | age ${number(typeof h.writtenAt === 'number' ? (now - h.writtenAt) / 1000 : null, 1)}s${stale ? ' | STALE: last snapshot only' : ''}`,
    `Equity ${money(a?.equity)} | free ${money(a?.availableBalance)}${accountFresh && !stale ? '' : ' (account stale/unknown)'}`,
  ];
  if (m?.version === 1 && Array.isArray(m.owners)) {
    lines.push(`Bid/ask ${number(m.bid, 4)} / ${number(m.ask, 4)} | account age ${number(typeof a?.at === 'number' ? (now - a.at) / 1000 : null, 1)}s`);
    for (const p of m.owners) {
      const label = p.owner === 'main' ? `Ladder ${p.rungs}/11` : p.owner === 'R3' ? 'MACD R3' : `Slot ${Number(p.owner.slice(-1)) + 1}`;
      if (!p.qty) { lines.push(`${label}: flat${p.exiting ? ' (exit cleanup pending)' : ''}`); continue; }
      lines.push(`${label}: ${brief(p.source, 12)} ${p.side === 1 ? 'LONG' : 'SHORT'} | ${number(p.qty)} HYPE | cost ${money(p.cost)} | uPnL ${money(p.unrealized)}`);
      lines.push(`  avg ${number(p.averageEntry, 4)} | age ${number((now - (p.openedAt ?? now)) / 3600000, 1)}h | ${brief(p.protection, 120)}`);
      if (p.exiting) lines.push('  EXIT REQUEST ACTIVE');
      else if (p.exitAt !== null) lines.push(`  ${brief(p.exitReason, 20)} due ${utc(p.exitAt)}`);
    }
    const cost = (side: number) => m.owners.filter(p => p.side === side).reduce((n, p) => n + p.cost, 0);
    lines.push(`Exposure at entry cost: long ${money(cost(1))} | short ${money(cost(-1))} | net ${money(cost(1) - cost(-1))}`);
    lines.push(`Ladder gate: ${brief(m.lastGate)} | setups: ${brief(m.setupStatus, 80)}`);
    if (m.pauseRequested || m.flattenRequested) lines.push(`Controls: ${m.flattenRequested ? 'FLATTEN REQUEST ACTIVE; ' : ''}${m.pauseRequested ? 'pause file present' : ''}`);
  } else lines.push(`Exchange qty: long ${number(a?.longQty)} / short ${number(a?.shortQty)} | detailed status requires new owner build`);
  const pending = Array.isArray(h.pending) ? h.pending : [];
  lines.push(`Pending/unconfirmed orders ${m?.pendingMutations ?? pending.filter(p => !p.resting).length} | verified resting ${m?.confirmedResting ?? '?'} | reservations ${m?.reservations ?? '?'} | tick ${number((h.tickMs ?? NaN) / 1000, 1)}s`);
  const diagnostic = h.feed?.diagnostics, gap = diagnostic ? diagnostic.gapAt : h.feed?.health?.gapAt;
  lines.push(`Feed through ${utc(diagnostic?.through ?? h.feed?.health?.through ?? NaN)} | gap ${gap === null ? 'none' : brief(gap)}`);
  if (diagnostic) lines.push(`Feed ${diagnostic.transport} | snapshot age ${number(diagnostic.snapshotAgeMs, 0)}ms | fault ${brief(diagnostic.fault ?? 'none')}`);
  const context = h.mainContext;
  if (context?.coverage) {
    lines.push(`Ladder context ${context.horizonDays}d: ${context.coverage.actualContinuousBars}/${context.coverage.expectedBars} closed 5m | current missing inputs: ${brief(context.overextended?.missing.join(',') || 'none')}`);
    if (!context.coverage.healthy) lines.push(`History gap ${utc(context.coverage.firstMissingTs ?? NaN)} | repair ${context.repair?.pending ? 'in progress' : context.repair?.nextAttemptAt ? 'retry ' + utc(context.repair.nextAttemptAt) : 'scheduled'} | last repair error ${brief(context.repair?.lastError ?? 'none')}`);
  }
  lines.push(`Portfolio realized since activation ${money(h.realizedBeforeFunding)} (net trading fees, before funding); funding ${money(h.funding?.amount)}${h.funding?.unallocated ? ` (${h.funding.unallocated} unallocated)` : ''}`);
  if (h.error || h.recovery) lines.push(`ATTENTION: ${brief(h.error)} | recovery ${brief(h.recovery)}`);
  lines.push('uPnL estimate before exit fees. Protection = last verification, not a live guarantee.');
  return lines.join('\n');
}

/** No new process/timer: called by the existing serial owner loop. */
export class PortfolioStatusLogger {
  private lastAt = -Infinity;
  private key = '';
  emit(h: StatusHealth, now: number, write: (text: string) => void = console.log): void {
    const m = h.monitor;
    const key = JSON.stringify([h.mode, h.entryEnabled, h.status, h.error, h.recovery,
      m?.pauseRequested, m?.flattenRequested, m?.receipts,
      m?.owners.map(p => [p.owner, p.source, p.qty, p.protection, p.exiting])]);
    if (key !== this.key || now - this.lastAt >= 60_000) {
      write(formatPortfolioStatus(h, now)); this.lastAt = now; this.key = key;
    }
  }
}

export function discordStatusChunks(text: string): string[] {
  const chunks: string[] = []; let chunk = '';
  for (const line of text.split('\n')) {
    // Bound even malformed external text; leave room for optional code fences.
    for (let i = 0; i < Math.max(1, line.length); i += 1800) {
      const part = line.slice(i, i + 1800);
      if (chunk.length + part.length + 1 > 1850) { chunks.push(chunk); chunk = ''; }
      chunk += (chunk ? '\n' : '') + part;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
