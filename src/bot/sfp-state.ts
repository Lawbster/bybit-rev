import fs from 'fs';
import path from 'path';
import { type SfpSignal, SFP_POLICY } from '../strategies/sfp-policy';

export interface SfpFill { id: string; orderId: string; at: number; qty: number; price: number; fee: number; }
export interface SfpIntent {
  kind: 'open' | 'close'; link: string; at: number; qty: number; signal: SfpSignal;
  stop: number; target: number; reason: string; orderId?: string;
}
export interface SfpPosition {
  signal: SfpSignal; openLink: string; openOrderId: string; entryAt: number;
  initialQty: number; qty: number; entryPrice: number; entryFeeRemaining: number;
  stop: number; target: number; closeIds: string[]; realized: number;
  protectionFailures: number;
  exitReason?: string;
}
export interface SfpState {
  version: 1; policy: string; accountAlias: string; accountUid: string;
  createdAt: number; updatedAt: number; lastDecisionAt: number; nextEntryAt: number;
  pending: SfpIntent | null; position: SfpPosition | null;
  recovery: string | null; realizedPnl: number; fees: number;
  receipts: { id: string; kind: string; at: number; net: number; qty: number; price?: number }[];
}
export class SfpPersistenceError extends Error {}
function validSignal(s: SfpSignal): boolean {
  return !!s && typeof s.id === 'string' && s.id.startsWith('SF01:long:')
    && Number.isSafeInteger(s.at) && s.at % 60_000 === 0
    && s.expiresAt === s.at + 86400_000 && s.entryDeadline === s.at + 60_000
    && [s.reference, s.originalStop, s.stop, s.target].every(v => Number.isFinite(v) && v > 0)
    && s.originalStop < s.reference && s.target > s.reference
    && Math.abs(s.stop - s.originalStop * 0.95) < 1e-8
    && Math.abs(s.target - (s.reference + 2 * (s.reference - s.originalStop))) < 1e-8;
}
export function atomicSfpJson(file: string, value: unknown): void {
  try {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  // Best effort directory sync (unsupported on Windows); file data is fsynced.
  try { const d = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } } catch { /* Windows */ }
  } catch { throw new SfpPersistenceError('SF08 durable write failed'); }
}
export class SfpStore {
  value: SfpState;
  constructor(readonly file: string, alias: string, uid: string, now: number) {
    if (fs.existsSync(file)) {
      const s = JSON.parse(fs.readFileSync(file, 'utf8')) as SfpState;
      if (s.version !== 1 || s.policy !== SFP_POLICY || s.accountAlias !== alias || s.accountUid !== uid
        || !Number.isFinite(s.lastDecisionAt) || !Number.isFinite(s.realizedPnl) || !Number.isFinite(s.fees)
        || !Number.isFinite(s.nextEntryAt) || !Array.isArray(s.receipts)
        || !('pending' in s) || !('position' in s) || !(s.recovery === null || typeof s.recovery === 'string')) {
        throw new Error('SF08 state corrupt or wrong account/policy');
      }
      if (s.position && (![s.position.qty, s.position.entryPrice, s.position.initialQty, s.position.entryAt,
        s.position.stop, s.position.target, s.position.entryFeeRemaining, s.position.realized, s.position.protectionFailures].every(Number.isFinite)
        || !validSignal(s.position.signal) || !s.position.openLink || !s.position.openOrderId
        || s.position.entryPrice <= 0 || s.position.stop <= 0 || s.position.target <= s.position.stop
        || s.position.qty <= 0 || s.position.qty > s.position.initialQty || !Array.isArray(s.position.closeIds)
        || s.position.closeIds.some(id => typeof id !== 'string') || s.pending?.kind === 'open')) throw new Error('invalid SF08 position');
      if (s.pending && (!['open', 'close'].includes(s.pending.kind) || !s.pending.link
        || ![s.pending.qty, s.pending.at, s.pending.stop, s.pending.target, s.pending.signal?.expiresAt].every(Number.isFinite)
        || !validSignal(s.pending.signal) || s.pending.qty <= 0 || s.pending.stop <= 0 || s.pending.target <= s.pending.stop)) throw new Error('invalid SF08 pending intent');
      this.value = s;
    } else this.value = { version: 1, policy: SFP_POLICY, accountAlias: alias, accountUid: uid,
      createdAt: now, updatedAt: now, lastDecisionAt: now, nextEntryAt: now,
      pending: null, position: null, recovery: null, realizedPnl: 0, fees: 0, receipts: [] };
  }
  save(now: number): void {
    this.value.updatedAt = now;
    this.value.receipts = this.value.receipts.slice(-512);
    // A save failure is fatal. Callers must not catch it and continue trading.
    atomicSfpJson(this.file, this.value);
  }
}

/** Account/symbol/side ownership, shared naming contract for future setup owners. */
export function lockAccountLong(directory: string, uid: string, symbol: string): () => void {
  if (!/^\d+$/.test(uid) || !/^[A-Z0-9]+$/.test(symbol)) throw new Error('invalid lock identity');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${uid}-${symbol}-1.lock`);
  // Never guess a lock is stale from PID alone (PID reuse and parallel hosts).
  let fd: number;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch { throw new Error(`account long owner lock exists: ${file}; verify stopped owner before removing`); }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, uid, symbol, side: 1, at: Date.now() }));
  fs.fsyncSync(fd); fs.closeSync(fd);
  return () => { fs.unlinkSync(file); };
}
