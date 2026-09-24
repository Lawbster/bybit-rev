/** Liquidation side tests: the live feed maps Bybit S=Buy to a long liquidation, and the research reader is right for old and new rows. */
import assert from 'assert/strict';
import { LiveFeed } from '../src/live-feed';
import { liquidationSide } from './liquidation-side';

// Live feed: Bybit allLiquidation `S` is the liquidated position's side.
{
  const feed = new LiveFeed('HYPEUSDT'), seen: any[] = [];
  feed.on('liquidation', l => seen.push(l));
  (feed as any).handleLiquidation({ data: [{ T: 1, s: 'HYPEUSDT', S: 'Buy', v: '2', p: '90' }, { T: 2, s: 'HYPEUSDT', S: 'Sell', v: '1', p: '110' }] });
  assert.deepEqual(seen.map(l => [l.rawSide, l.liquidatedSide]), [['Buy', 'long'], ['Sell', 'short']]);
}
// Research reader: an old inverted Bybit row, a new corrected one and a Binance row all resolve correctly.
assert.equal(liquidationSide({ venue: 'bybit', rawSide: 'Sell', liquidatedSide: 'long' }), 'short', 'old Bybit row: label inverted, raw side right');
assert.equal(liquidationSide({ venue: 'bybit', rawSide: 'Buy', liquidatedSide: 'long' }), 'long', 'new Bybit row');
assert.equal(liquidationSide({ venue: 'binance', rawSide: 'SELL', liquidatedSide: 'long' }), 'long', 'Binance forceOrder label is right');
assert.equal(liquidationSide({ venue: 'bybit' }), null);
console.log('liquidation-side tests passed: live feed mapping, research reader for old/new Bybit and Binance rows');
process.exit(0);
