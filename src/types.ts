export type Side = "Long" | "Short";

// Primary trade format — parsed from GUI copy-paste xlsx
export interface Trade {
  symbol: string;       // e.g. "SIRENUSDT"
  side: Side;
  leverage: number;     // e.g. 10
  marginMode: string;   // e.g. "Cross"
  qty: number;
  qtyAsset: string;     // e.g. "SIREN"
  openedAt: Date;
  closedAt: Date;
  entryPrice: number;
  exitPrice: number;
  closeReason: string;  // e.g. "Closed via Copied Trade"
  pnl: number;          // in USDT
  pnlPercent: number;   // leveraged %
  fees: number;
  orderId: string;
  holdDurationMs: number;
}

// Legacy CSV format — kept for backlog/backtesting fill-level analysis
export interface RawCsvRow {
  uid: string;
  time: string;
  currency: string;
  contract: string;
  type: string;
  direction: string;
  quantity: number;
  position: number;
  filledPrice: number;
  funding: number;
  feePaid: number;
  cashFlow: number;
  change: number;
  walletBalance: number;
  feeRate: number;
  tradeId: string;
  orderId: string;
}
