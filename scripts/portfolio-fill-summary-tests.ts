import assert from 'assert/strict';
import { emptyLedger, reserveGroup, prepareOpen, prepareClose, applyExecution, finishOrder } from '../src/bot/portfolio/ledger';
import { portfolioFillSummaries, portfolioFillFields } from '../src/bot/portfolio/fill-summary';
const at = Date.UTC(2026, 9, 13);
function example(side: 1 | -1, closePrices: number[]) {
  const s = emptyLedger('123'), source = side === 1 ? 'CRSI' : 'R5';
  const r = reserveGroup(s, { at, price: 100, priceKnownAt: at, equity: 19000, feeRate: .00055,
    signals: [{ id: 'lot', source, side, decisionAt: at, eligibleAt: at, knownAt: at, expiresAt: at + 86400000 }] })[0].reservation!;
  prepareOpen(s, r, 2, 'entry', at);
  applyExecution(s, { id: 'e', link: 'entry', orderId: 'openVenue', at, side: side === 1 ? 'Buy' : 'Sell',
    positionIdx: side === 1 ? 1 : 2, qty: 2, price: 100, fee: 1 }, at);
  finishOrder(s, 'entry', 'Filled', 2, at);
  for (const [n, price] of closePrices.entries()) {
    const link = `exit${n}`, time = at + n + 1;
    prepareClose(s, { owner: r.owner, link, at: time, reason: 'target', allocations: [{ lotId: 'lot', qty: 1 }] });
    applyExecution(s, { id: link, link, orderId: 'oneChildOrder', at: time, side: side === 1 ? 'Sell' : 'Buy',
      positionIdx: side === 1 ? 1 : 2, qty: 1, price, fee: .5 }, time);
    finishOrder(s, link, 'Filled', 1, time);
  }
  return s;
}
const long = example(1, [110]), before = JSON.stringify(long), rows = portfolioFillSummaries(long);
assert.equal(JSON.stringify(long), before, 'report must not mutate state');
assert.equal(rows[1].net, 9, 'partial closes allocate entry fee, not all entry fees');
assert.equal(rows[0].net, 0);
assert(portfolioFillFields(rows[0]).some(f => f.value.includes('Not realized')));
const both = portfolioFillSummaries(example(1, [110, 90]));
assert.equal(both.length, 2, 'child receipt intents consolidate by exchange order');
assert.equal(both[1].links.length, 2); assert.equal(both[1].net, -2);
assert(portfolioFillFields(both[1]).some(f => f.value.startsWith('-$2.00')));
assert.equal(portfolioFillSummaries(example(-1, [90, 90]))[1].net, 18);
assert.equal(portfolioFillSummaries(example(-1, [110, 110]))[1].net, -22);
const corrupt = example(1, [110]); corrupt.realizedBeforeFunding += 1;
assert.throws(() => portfolioFillSummaries(corrupt), /accounting mismatch/);
console.log('portfolio fill summaries: long/short, partial fees, grouped fills, immutable state and mismatch rejection passed');
