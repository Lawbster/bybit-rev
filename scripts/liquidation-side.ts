/**
 * The liquidated side of a collector liquidation row (data/<SYMBOL>_liquidations.jsonl), correct for every row.
 * Bybit rows written before 2026-09-24 carry `liquidatedSide` inverted (the collector read Bybit's `S`, the position
 * side, as the closing order's side). Bybit's raw `S` is right for old and new rows alike: Buy = a long was liquidated.
 * Binance rows (forceOrder, whose side is the closing order) were always labelled correctly.
 */
export type LiqRow = { venue?: string; rawSide?: string; liquidatedSide?: string };
export function liquidationSide(r: LiqRow): 'long' | 'short' | null {
  if (r.venue === 'bybit') return r.rawSide === 'Buy' ? 'long' : r.rawSide === 'Sell' ? 'short' : null;
  return r.liquidatedSide === 'long' || r.liquidatedSide === 'short' ? r.liquidatedSide : null;
}
