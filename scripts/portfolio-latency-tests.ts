/** Offline service telemetry and delivery tests. No exchange or Discord calls. */
import assert from 'assert/strict';
import { exitLatenessMs, PortfolioLatencyTracker, PortfolioNoticePump } from '../src/bot/portfolio/latency';
import { emptyLedger } from '../src/bot/portfolio/ledger';
import { emptyLifecycle } from '../src/bot/portfolio/lifecycle-state';

const T = Date.UTC(2026, 9, 20);
let cases = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); }
}
async function main() {
  await test('isolated slow reads stay quiet, sustained delay warns, healthy clearing is debounced', () => {
    const t = new PortfolioLatencyTracker();
    assert.equal(t.update(12000, 0, T + 12000).reason, null);
    assert.equal(t.update(1000, 0, T + 14000).reason, null);
    assert.equal(t.update(12000, 0, T + 30000).reason, null);
    assert.equal(t.update(12000, 0, T + 77000).reason, null);
    const warning = t.update(12000, 0, T + 78000);
    assert.equal(warning.reason, 'slow_service_loop'); assert.equal(warning.severity, 'warning');
    assert.equal(t.update(1000, 0, T + 79000).activeSince, warning.activeSince);
    assert.equal(t.update(1000, 0, T + 138999).reason, 'slow_service_loop');
    assert.equal(t.update(1000, 0, T + 139000).reason, null);
  });
  await test('late exits warn and escalate on the same lifecycle; a slow sample resets clearing', () => {
    const t = new PortfolioLatencyTracker();
    assert.equal(t.update(1000, 29999, T).reason, null);
    const warning = t.update(1000, 30000, T + 1);
    assert.equal(warning.reason, 'exit_overdue'); assert.equal(warning.severity, 'warning');
    assert.equal(t.update(1000, 60000, T + 30001).severity, 'critical');
    assert.equal(t.update(1000, 0, T + 31001).activeSince, warning.activeSince);
    t.update(12000, 0, T + 50000);
    assert.equal(t.update(1000, 0, T + 62000).severity, 'critical');
    assert.equal(t.update(1000, 0, T + 122000).reason, null);
    assert.equal(t.update(1000, 30000, T + 123000).severity, 'warning');
  });
  await test('five minutes of severe loop delay escalates; brief moderate loops do not', () => {
    const t = new PortfolioLatencyTracker();
    assert.equal(t.update(31000, 0, T + 31000).reason, null);
    assert.equal(t.update(31000, 0, T + 299999).severity, 'warning');
    assert.equal(t.update(31000, 0, T + 300000).severity, 'critical');
  });
  await test('due inventory and a newly filled timeout are measured; old fills and early TP are not', () => {
    const s = emptyLedger('555249668'); s.lifecycle = emptyLifecycle();
    s.lots.x = { id: 'x', owner: 'setup0', source: 'SF08', side: 1, qty: 1, cost: 100, entryFees: .05, openedAt: T };
    s.lifecycle.exits.x = { lotId: 'x', owner: 'setup0', source: 'SF08', entryAt: T,
      causeAt: T + 60000, dueAt: T + 60000, reason: 'timeout', recordedAt: T };
    assert.equal(exitLatenessMs(s, T + 59000, T), 0);
    assert.equal(exitLatenessMs(s, T + 114000, T), 54000);
    s.orders.close = { link: 'close', owner: 'setup0', source: 'SF08', side: 1, kind: 'close', at: T + 113000,
      qty: 1, appliedQty: 1, terminal: true, reason: 'timeout', lotId: 'x', allocations: [{ lotId: 'x', qty: 1, applied: 1 }] };
    s.executions.fill = { id: 'fill', link: 'close', orderId: 'venue', at: T + 114000,
      side: 'Sell', positionIdx: 1, qty: 1, price: 101, fee: .05 };
    delete s.lots.x;
    assert.equal(exitLatenessMs(s, T + 115000, T + 100000), 54000);
    assert.equal(exitLatenessMs(s, T + 116000, T + 115000), 0);
    s.orders.close.reason = 'target';
    assert.equal(exitLatenessMs(s, T + 115000, T + 100000), 0);
  });
  await test('notice delivery is nonblocking, single-flight, and backs off failed webhooks', async () => {
    let now = T, calls = 0, resolve!: (ok: boolean) => void;
    const p = new PortfolioNoticePump(() => now);
    const slow = () => { calls++; return new Promise<boolean>(r => { resolve = r; }); };
    p.request(slow); await Promise.resolve(); assert.equal(calls, 1);
    now += 10000; p.request(slow); assert.equal(calls, 1);
    resolve(false); await p.drain();
    now += 59999; p.request(slow); await Promise.resolve(); assert.equal(calls, 1);
    now++; p.request(slow); await Promise.resolve(); assert.equal(calls, 2);
    resolve(true); await p.drain();
    now += 4999; p.request(slow); await Promise.resolve(); assert.equal(calls, 2);
    now++; p.request(slow); await Promise.resolve(); assert.equal(calls, 3);
    resolve(true); await p.drain();
  });
  await test('delivery exceptions stay outside trading and use the same retry backoff', async () => {
    let now = T, calls = 0;
    const p = new PortfolioNoticePump(() => now), fail = async () => { calls++; throw Error('webhook'); };
    p.request(fail); await p.drain(); assert.equal(calls, 1);
    now += 59999; p.request(fail); await p.drain(); assert.equal(calls, 1);
    now++; p.request(fail); await p.drain(); assert.equal(calls, 2);
  });
  console.log(`Portfolio latency: ${cases} groups passed; no exchange or Discord calls`);
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
