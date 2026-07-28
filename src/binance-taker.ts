export interface BinanceTakerApiRow {
  timestamp: number | string;
  buySellRatio: number | string;
  buyVol: number | string;
  sellVol: number | string;
}

export interface BinanceTakerLiveRow {
  ts: string;
  timestamp: number;
  exchangeTimestamp: number;
  symbol: string;
  venue: "binance";
  period: "5m";
  buySellRatio: number;
  buyVol: number;
  sellVol: number;
  source: "rest_poll";
}

export function buildUnseenBinanceTakerRows(args: {
  apiRows: BinanceTakerApiRow[];
  lastExchangeTs: number;
  observedAt: number;
  symbol: string;
}): BinanceTakerLiveRow[] {
  const unseenByExchangeTs = new Map<number, BinanceTakerApiRow>();
  for (const row of args.apiRows) {
    const exchangeTimestamp = Number(row.timestamp);
    if (!Number.isFinite(exchangeTimestamp) || exchangeTimestamp <= args.lastExchangeTs) continue;
    unseenByExchangeTs.set(exchangeTimestamp, row);
  }

  const observedIso = new Date(args.observedAt).toISOString();
  return [...unseenByExchangeTs.entries()]
    .sort(([left], [right]) => left - right)
    .map(([exchangeTimestamp, row]) => ({
      ts: observedIso,
      timestamp: args.observedAt,
      exchangeTimestamp,
      symbol: args.symbol,
      venue: "binance",
      period: "5m",
      buySellRatio: parseFloat(String(row.buySellRatio)),
      buyVol: parseFloat(String(row.buyVol)),
      sellVol: parseFloat(String(row.sellVol)),
      source: "rest_poll",
    }));
}
