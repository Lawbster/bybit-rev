import { randomBytes } from 'crypto';
import type { SfpSignal } from '../strategies/sfp-policy';
import type { SfpExchange, SfpSnapshot } from './sfp-exchange';
import { SfpStore, type SfpIntent, SfpPersistenceError } from './sfp-state';
import { accountDiagnostic } from './named-bybit-account';

const epsilon = 1e-7;
export class SfpCoordinator {
  observed: SfpSnapshot | null = null;
  checkedAt: number | null = null;
  constructor(readonly store: SfpStore, readonly exchange: SfpExchange,
    private readonly clock: () => number = Date.now) {}
  private link(kind: 'open' | 'close') { return `sf08_${kind}_${this.clock()}_${randomBytes(3).toString('hex')}`; }
  private fail(reason: string) { this.store.value.recovery = reason; this.store.save(this.clock()); }
  private async send(i: SfpIntent): Promise<void> {
    // The exact ID and absolute protection/deadline already exist on disk.
    const result = await this.exchange.submit(i);
    if (result.rejected) {
      this.store.value.receipts.push({ id: i.link, kind: `${i.kind}_rejected`, at: this.clock(), net: 0, qty: 0 });
      this.store.value.pending = null;
      this.store.value.recovery = i.kind === 'close' ? 'close_rejected' : null;
    } else i.orderId = result.orderId;
    this.store.save(this.clock());
  }
  async consider(signal: SfpSignal, notional: number, entryEnabled: boolean): Promise<void> {
    const s = this.store.value, now = this.clock();
    if (signal.at <= s.lastDecisionAt) return;
    // Persist consumption even when busy/paused: signals are never queued for later.
    s.lastDecisionAt = signal.at;
    this.store.save(now);
    const skip = !entryEnabled ? 'entries_disabled' : s.pending || s.position ? 'occupied' : s.recovery ? 'recovery'
      : now < s.nextEntryAt ? 'same_minute_exit' : now < signal.at ? 'not_yet_available' : now >= signal.entryDeadline ? 'expired' : null;
    if (skip) {
      s.receipts.push({ id: `skip:${signal.id}:${signal.at}`, kind: `skipped:${skip}`, at: now, net: 0, qty: 0 }); this.store.save(now); return;
    }
    try {
      const snap = await this.exchange.snapshot();
      if (snap.qty !== 0 || snap.shortQty !== 0) { this.fail('unowned_exchange_inventory'); return; }
      const terms = await this.exchange.entryTerms(notional, signal.stop, signal.target);
      if (this.clock() >= signal.entryDeadline) return;
      const intent: SfpIntent = { kind: 'open', link: this.link('open'), at: this.clock(), qty: terms.qty,
        signal, stop: terms.stop, target: terms.target, reason: 'signal' };
      s.pending = intent; this.store.save(this.clock());
      await this.send(intent);
    } catch (e) {
      if (e instanceof SfpPersistenceError) throw e;
      this.fail(s.pending ? 'entry_submit_unresolved' : `entry_preflight:${accountDiagnostic(e)}`);
    }
  }
  private async requestClose(reason: string): Promise<void> {
    const s = this.store.value, p = s.position;
    if (!p || s.pending) return;
    p.exitReason = reason;
    const i: SfpIntent = { kind: 'close', link: this.link('close'), at: this.clock(), qty: p.qty,
      signal: p.signal, stop: p.stop, target: p.target, reason };
    s.pending = i; this.store.save(this.clock());
    await this.send(i);
  }
  private async importCloses(): Promise<void> {
    const s = this.store.value, p = s.position;
    if (!p) return;
    const rows = (await this.exchange.closeFills(p.entryAt)).filter(f => !p.closeIds.includes(f.id));
    if (!rows.length) return;
    if (new Set(rows.map(f => f.id)).size !== rows.length || rows.some(f => f.at < p.entryAt || f.at > this.clock()
      || !Number.isFinite(f.qty + f.price + f.fee) || f.qty <= 0 || f.price <= 0)) throw new Error('invalid close execution evidence');
    const qty = rows.reduce((sum, f) => sum + f.qty, 0);
    if (qty > p.qty + epsilon) throw new Error('close executions exceed owned SF08 quantity');
    const fee = rows.reduce((sum, f) => sum + f.fee, 0);
    const allocatedEntryFee = p.entryFeeRemaining * Math.min(1, qty / p.qty);
    const gross = rows.reduce((sum, f) => sum + f.qty * (f.price - p.entryPrice), 0);
    const net = gross - fee - allocatedEntryFee;
    p.qty = Math.max(0, p.qty - qty); p.entryFeeRemaining -= allocatedEntryFee;
    p.closeIds.push(...rows.map(f => f.id)); p.realized += net;
    s.realizedPnl += net; s.fees += fee;
    s.receipts.push({ id: rows.map(f => f.id).sort().join(','), kind: p.qty <= epsilon ? 'closed' : 'partial_close',
      at: Math.max(...rows.map(f => f.at)), qty, net, price: rows.reduce((v, f) => v + f.price * f.qty, 0) / qty });
    if (p.qty <= epsilon) {
      // A touch exit cannot retroactively make its minute-open available.
      s.nextEntryAt = (Math.floor(Math.max(...rows.map(f => f.at)) / 60_000) + 1) * 60_000;
      s.position = null;
    }
    this.store.save(this.clock());
  }
  async maintain(): Promise<void> {
    const s = this.store.value;
    try {
      let i = s.pending;
      if (i?.kind === 'open') {
        const o = await this.exchange.observe(i);
        if (!o.terminal) {
          const snap = await this.exchange.snapshot(); this.observed = snap; this.checkedAt = this.clock();
          if (snap.shortQty || snap.qty > i.qty + epsilon) throw new Error('unexpected inventory during SF08 entry');
          if (snap.qty > 0 && (snap.tp !== i.target || snap.sl !== i.stop)) {
            try { await this.exchange.protect(i.stop, i.target); } catch { /* cancel below if still unprotected */ }
            const check = await this.exchange.snapshot();
            if (check.qty > 0 && (check.tp !== i.target || check.sl !== i.stop)) i.reason = 'protection_failure';
          }
          if (this.clock() >= i.signal.expiresAt) i.reason = 'timeout';
          if (i.reason !== 'signal' || this.clock() - i.at >= 60_000) {
            s.recovery = 'entry_pending_terminal_evidence'; this.store.save(this.clock());
            if (o.found) await this.exchange.cancel(i);
          }
          return;
        }
        const qty = o.fills.reduce((sum, f) => sum + f.qty, 0);
        if (Math.abs(qty - o.cumulativeQty) > epsilon || qty > i.qty + epsilon
          || new Set(o.fills.map(f => f.id)).size !== o.fills.length
          || o.fills.some(f => f.at < i!.at || f.at > this.clock() || f.qty <= 0 || f.price <= 0
            || !Number.isFinite(f.qty + f.price + f.fee) || f.orderId !== o.orderId)) throw new Error('open order/fill evidence mismatch');
        if (qty > epsilon) {
          const fee = o.fills.reduce((sum, f) => sum + f.fee, 0);
          const entry = o.fills.reduce((sum, f) => sum + f.qty * f.price, 0) / qty;
          s.position = { signal: i.signal, openLink: i.link, openOrderId: o.orderId,
            entryAt: Math.min(...o.fills.map(f => f.at)), initialQty: qty, qty, entryPrice: entry,
            entryFeeRemaining: fee, stop: i.stop, target: i.target, closeIds: [], realized: 0,
            protectionFailures: 0, ...(i.reason !== 'signal' ? { exitReason: i.reason } : {}) };
          s.fees += fee;
          s.receipts.push({ id: i.link, kind: 'opened', at: this.clock(), qty, net: 0, price: entry });
        } else s.receipts.push({ id: i.link, kind: 'open_unfilled', at: this.clock(), qty: 0, net: 0 });
        s.pending = null; this.store.save(this.clock());
      }
      await this.importCloses();
      let snap = await this.exchange.snapshot(); this.observed = snap; this.checkedAt = this.clock();
      if (snap.shortQty !== 0 || Math.abs(snap.qty - (s.position?.qty ?? 0)) > epsilon) throw new Error('account_inventory_mismatch');
      i = s.pending;
      if (i?.kind === 'close') {
        const o = await this.exchange.observe(i);
        if (o.terminal) {
          if (Math.abs(o.fills.reduce((sum, f) => sum + f.qty, 0) - o.cumulativeQty) > epsilon) throw new Error('close order/fill evidence mismatch');
          // Re-read imports before releasing the order: execution and position APIs
          // can become consistent in different polls.
          await this.importCloses();
          snap = await this.exchange.snapshot(); this.observed = snap;
          if (Math.abs(snap.qty - (s.position?.qty ?? 0)) > epsilon) throw new Error('close_reconciliation_incomplete');
          const accounted = new Set(s.receipts.filter(r => r.kind === 'closed' || r.kind === 'partial_close')
            .flatMap(r => r.id.split(',')));
          if (o.fills.some(f => !accounted.has(f.id))) throw new Error('close_executions_not_accounted');
          s.pending = null; this.store.save(this.clock());
        } else {
          if (snap.qty === 0 && o.found) await this.exchange.cancel(i);
          s.recovery = 'close_pending_terminal_evidence'; this.store.save(this.clock()); return;
        }
      }
      s.recovery = null;
      const p = s.position;
      if (!p) { this.store.save(this.clock()); return; }
      if (p.exitReason || this.clock() >= p.signal.expiresAt) {
        await this.requestClose(p.exitReason ?? 'timeout'); return;
      }
      // Conservative fail-close when the account cannot demonstrate room below SL.
      if (!Number.isFinite(snap.liquidationPrice) || snap.liquidationPrice <= 0 || snap.liquidationPrice >= p.stop * 0.995) {
        await this.requestClose('liquidation_buffer_unconfirmed'); return;
      }
      if (snap.tp !== p.target || snap.sl !== p.stop) {
        try { await this.exchange.protect(p.stop, p.target); } catch { /* observation decides success */ }
        snap = await this.exchange.snapshot(); this.observed = snap;
        // A native close racing the repair is resolved from executions next poll.
        if (Math.abs(snap.qty - p.qty) > epsilon) { this.fail('protection_position_changed'); return; }
        if (snap.tp !== p.target || snap.sl !== p.stop) {
          p.protectionFailures++; s.recovery = 'protection_unconfirmed'; this.store.save(this.clock());
          if (p.protectionFailures >= 3) await this.requestClose('protection_failure');
          return;
        }
      }
      p.protectionFailures = 0; this.store.save(this.clock());
    } catch (e) {
      if (e instanceof SfpPersistenceError) throw e;
      this.fail(`reconciliation:${accountDiagnostic(e)}`);
    }
  }
}
