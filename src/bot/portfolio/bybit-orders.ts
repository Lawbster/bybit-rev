/** Staged real-order boundary; NOT a PortfolioExecutionPort and not wired into
 * any daemon. The coordinator still rejects non-simulation transport. Caller
 * must persist the intent and hold both owner leases before authorizing I/O.
 * No retries, credentials, account-wide cancels or full-position TP/SL writes.
 */
import type { OrderParamsV5, RestClientV5 } from 'bybit-api';
import { attachedEntryPayload } from './attached-bracket';
import { childTerminal } from './bracket-state';
import { epoch } from './contract';
import { validateCommand, type PortfolioOrderCommand } from './order-command';
import { BybitPortfolioEvidenceReader, type BybitEvidenceClient } from './bybit-evidence';

export type BybitOrderClient = BybitEvidenceClient & Pick<RestClientV5, 'submitOrder' | 'cancelOrder'>;
export type PortfolioWriteRequest =
  | { kind: 'submit'; command: Readonly<PortfolioOrderCommand> }
  | { kind: 'cancel'; command: Readonly<PortfolioOrderCommand>; orderId: string }
  | { kind: 'cancel_child'; command: Readonly<PortfolioOrderCommand>; orderId: string };

function checked(c: PortfolioOrderCommand, uid: string): void {
  validateCommand(c);
  if (c.uid !== uid || (c.side === 'Buy') !== ((c.positionIdx === 1) !== c.reduceOnly))
    throw new Error('portfolio orders: command_account_or_side');
}
/** Reuses the tested attached-entry builder; other payloads contain only fields
 * from the durable command. No rounding, resizing or strategy changes here. */
export function portfolioOrderPayload(c: Readonly<PortfolioOrderCommand>): OrderParamsV5 {
  checked(c, c.uid);
  if (c.bracket) return attachedEntryPayload(c);
  const payload: OrderParamsV5 = { category: 'linear', symbol: c.symbol, orderLinkId: c.link,
    orderType: c.orderType, side: c.side, positionIdx: c.positionIdx, qty: c.qty, reduceOnly: c.reduceOnly };
  if (c.protection?.kind === 'maker_tp') {
    payload.price = c.protection.price; payload.timeInForce = 'PostOnly';
  } else if (c.protection) {
    payload.triggerPrice = c.protection.price; payload.triggerBy = c.protection.triggerBy;
    payload.triggerDirection = c.protection.triggerDirection; payload.closeOnTrigger = true;
  }
  return payload;
}

export class BybitPortfolioOrders {
  readonly evidence: BybitPortfolioEvidenceReader;
  /** Mandatory permit checks durable command/cancel intent, both leases, recent
   * account reconciliation and legacy-owner fencing. It is checked immediately
   * before each request. There is deliberately no permissive default. */
  constructor(private readonly client: BybitOrderClient, private readonly uid: string,
    private readonly authorize: (request: PortfolioWriteRequest) => true, private readonly clock = Date.now) {
    if (typeof authorize !== 'function') throw new Error('portfolio orders: authorization_required');
    this.evidence = new BybitPortfolioEvidenceReader(client, uid, clock);
  }
  private check(c: PortfolioOrderCommand): void {
    checked(c, this.uid); epoch(this.clock());
    if (c.at > this.clock()) throw new Error('portfolio orders: future_command');
  }
  private fresh(at: number): void {
    if (at > this.clock() || this.clock() - at > 5000) throw new Error('portfolio orders: stale_evidence');
  }
  private permit(request: PortfolioWriteRequest): void {
    // Async/false/omitted permits cannot fall through into a write.
    if (this.authorize(request) !== true) throw new Error('portfolio orders: authorization_denied');
  }
  private ack(response: unknown, link?: string, expectedId?: string): { orderId: string } {
    // Even an API rejection is left for receipt reconciliation. Never turn an
    // uncertain submission into permission to reuse a link or release reserve.
    if (!response || typeof response !== 'object') throw new Error('portfolio orders: invalid_acknowledgment');
    const r = response as { retCode?: unknown; result?: { orderId?: unknown; orderLinkId?: unknown } };
    if (r.retCode !== 0) throw new Error('portfolio orders: request_rejected');
    const orderId = r.result?.orderId;
    if (typeof orderId !== 'string' || !orderId || expectedId && orderId !== expectedId
      || link && r.result?.orderLinkId && r.result.orderLinkId !== link)
      throw new Error('portfolio orders: acknowledgment_identity');
    return { orderId };
  }
  async submit(command: Readonly<PortfolioOrderCommand>): Promise<{ orderId: string }> {
    const c = structuredClone(command); this.check(c);
    const payload = portfolioOrderPayload(c);
    this.permit({ kind: 'submit', command: structuredClone(c) });
    let response: unknown;
    try { response = await this.client.submitOrder(payload); }
    catch { throw new Error('portfolio orders: submission_unknown'); }
    return this.ack(response, c.link);
  }
  async cancel(command: Readonly<PortfolioOrderCommand>): Promise<void> {
    const c = structuredClone(command); this.check(c);
    const e = await this.evidence.observe(c); this.fresh(e.observedAt);
    if (!e.found) throw new Error('portfolio orders: cancellation_target_unknown');
    if (['Filled', 'Cancelled', 'Rejected'].includes(e.status)) return;
    this.permit({ kind: 'cancel', command: structuredClone(c), orderId: e.orderId });
    let response: unknown;
    try { response = await this.client.cancelOrder({ category: 'linear', symbol: c.symbol, orderId: e.orderId }); }
    catch { throw new Error('portfolio orders: cancellation_unknown'); }
    this.ack(response, c.link, e.orderId); // ACK is NOT evidence the order is terminal.
  }
  async cancelAttached(parent: Readonly<PortfolioOrderCommand>, orderId: string): Promise<void> {
    const c = structuredClone(parent); this.check(c);
    const e = await this.evidence.observeAttached(c, [orderId]); this.fresh(e.observedAt);
    const child = e.children.find(x => x.orderId === orderId);
    if (!e.complete || !child) throw new Error('portfolio orders: child_cancellation_target_unknown');
    if (childTerminal(child)) return;
    this.permit({ kind: 'cancel_child', command: structuredClone(c), orderId });
    let response: unknown;
    try { response = await this.client.cancelOrder({ category: 'linear', symbol: c.symbol, orderId }); }
    catch { throw new Error('portfolio orders: child_cancellation_unknown'); }
    this.ack(response, undefined, orderId);
  }
}
