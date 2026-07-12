import { RestClientV5 } from "bybit-api";
import { Candle } from "../fetch-candles";
import { BotConfig } from "./bot-config";
import { BotLogger } from "./monitor";

// ─────────────────────────────────────────────
// Execution layer — dry-run vs live Bybit API
// ─────────────────────────────────────────────

export interface OrderResult {
  success: boolean;
  orderId: string;
  price: number;          // quote price at time of order (NOT actual fill price)
  priceType: "quote" | "fill";  // "quote" = pre-order snapshot, "fill" = actual execution
  qty: number;
  notional: number;
  error?: string;
}

export interface InstrumentLotInfo {
  qtyStep: number;
  minOrderQty: number;
  qtyDecimals: number;
}

export interface OrderExecutionState {
  found: boolean;
  orderId: string;
  orderLinkId: string;
  status: string;
  terminal: boolean;
  filledQty: number;
  avgPrice: number;
  cumExecQty: number;
  cumExecNotional: number | null;
  error?: string;
}

export interface PartialReduceResult {
  accepted: boolean;
  orderId: string;
  orderLinkId: string;
  status: string;
  terminal: boolean;
  submittedQty: number;
  quotePrice: number;
  cumExecQty: number;
  cumExecNotional: number | null;
  avgPrice: number | null;
  error?: string;
}

export type LongSubmitOutcome =
  | "not_submitted"
  | "rejected"
  | "accepted_unresolved"
  | "terminal"
  | "already_flat"
  | "unknown";

export interface LongExecutionResult {
  outcome: LongSubmitOutcome;
  orderId: string;
  orderLinkId: string;
  status: string;
  terminal: boolean;
  submittedQty: number;
  quotePrice: number;
  cumExecQty: number;
  cumExecNotional: number | null;
  avgPrice: number | null;
  remainingLongQty: number | null;
  qtyStep: number;
  executionIds: string[];
  error?: string;
}

export interface AggregatedExecutionEvidence {
  found: boolean;
  orderId: string;
  orderLinkId: string;
  executionIds: string[];
  cumExecQty: number;
  cumExecNotional: number | null;
  avgPrice: number | null;
  error?: string;
}

export interface LongCloseExecutionEvidence {
  execId: string;
  orderId: string;
  orderLinkId: string;
  execTime: number;
  closedSize: number;
  execQty: number;
  execPrice: number;
}

export interface ClosedPnlEvidence {
  orderId: string;
  side: string;
  updatedTime: number;
  closedSize: number;
  avgExitPrice: number;
  closedPnl: number;
}

export interface TradingStopResult {
  success: boolean;
  status: "confirmed" | "not_modified" | "failed";
  retCode?: number;
  retMsg?: string;
  error?: string;
}

export interface Executor {
  // Market data (no API key needed)
  getPrice(symbol: string): Promise<number>;
  getCandles(symbol: string, interval: string, limit: number, endMs?: number): Promise<Candle[]>;

  // Trading (needs API key in live mode)
  // orderLinkId is caller-generated — same ID persisted in state and sent to exchange
  openLong(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult>;
  closeAllLongs(symbol: string, orderLinkId: string): Promise<OrderResult>;
  openLongDetailed(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<LongExecutionResult>;
  closeAllLongsDetailed(symbol: string, orderLinkId: string): Promise<LongExecutionResult>;
  // Partial reduce: market sell `qty` of the long side (reduceOnly).
  reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult>;
  reduceLongQtyDetailed(symbol: string, qty: number, orderLinkId: string): Promise<PartialReduceResult>;
  openShort(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult>;
  closeShort(symbol: string, orderLinkId: string): Promise<OrderResult>;

  // Set native TP/SL on the exchange position — survives bot restarts, catches wick TPs
  setPositionTp(symbol: string, tpPrice: number, positionIdx: number): Promise<TradingStopResult>;
  setPositionSl(symbol: string, slPrice: number, positionIdx: number): Promise<TradingStopResult>;

  // Set Bybit position mode to hedge (both sides) — required before running long+short simultaneously.
  // Returns true if confirmed, false if failed (hedge should be gated until true).
  ensureHedgeMode(symbol: string): Promise<boolean>;

  // Order queries (live mode)
  queryOrder(symbol: string, orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }>;
  queryOrderExecution(symbol: string, orderLinkId: string): Promise<OrderExecutionState>;
  queryOrderExecutions(symbol: string, orderLinkId: string): Promise<AggregatedExecutionEvidence>;
  queryRecentLongCloseExecutions(symbol: string, startTime: number, endTime: number): Promise<LongCloseExecutionEvidence[]>;
  queryRecentClosedPnl(symbol: string, startTime: number, endTime: number): Promise<ClosedPnlEvidence[]>;
  getInstrumentLotInfo(symbol: string): Promise<InstrumentLotInfo>;
  getLongPositionSize(symbol: string): Promise<number>;

  // Account
  getWalletEquity(): Promise<number>;

  // Info
  getMode(): string;
}

/** Generate a unique orderLinkId. Call from index.ts, pass to executor + state. */
export function genOrderLinkId(action: string): string {
  return `2moon_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const TERMINAL_ORDER_STATUSES = new Set([
  "Filled",
  "Cancelled",
  "Rejected",
  "PartiallyFilledCanceled",
  "Deactivated",
]);

export function isTerminalOrderStatus(status: string): boolean {
  return TERMINAL_ORDER_STATUSES.has(status);
}

function decimalPlacesFromStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const text = step.toString().toLowerCase();
  if (text.includes("e-")) {
    const [, exp] = text.split("e-");
    return Number(exp) || 0;
  }
  const dot = text.indexOf(".");
  return dot >= 0 ? text.length - dot - 1 : 0;
}

export function normalizeQtyDown(qty: number, step: number): number {
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(step) || step <= 0) return 0;
  const decimals = decimalPlacesFromStep(step);
  const units = Math.floor((qty + step / 1_000_000) / step);
  return Number((units * step).toFixed(Math.min(decimals, 12)));
}

export function formatQtyForStep(qty: number, step: number): string {
  const decimals = decimalPlacesFromStep(step);
  return normalizeQtyDown(qty, step).toFixed(decimals);
}

function parseNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export function mergeOrderAndExecutionEvidence(
  order: Pick<OrderExecutionState, "orderId" | "cumExecQty" | "cumExecNotional" | "avgPrice"> | null,
  executions: AggregatedExecutionEvidence,
): {
  orderId: string;
  cumExecQty: number;
  cumExecNotional: number | null;
  avgPrice: number | null;
  executionIds: string[];
} {
  const orderQty = order?.cumExecQty ?? 0;
  const useExecutions = executions.found && executions.cumExecQty >= orderQty - 1e-9;
  if (useExecutions) {
    return {
      orderId: order?.orderId || executions.orderId,
      cumExecQty: executions.cumExecQty,
      cumExecNotional: executions.cumExecNotional,
      avgPrice: executions.avgPrice,
      executionIds: executions.executionIds,
    };
  }
  const orderNotional = order?.cumExecNotional ?? (
    orderQty > 0 && (order?.avgPrice ?? 0) > 0 ? orderQty * order!.avgPrice : null
  );
  return {
    orderId: order?.orderId || executions.orderId,
    cumExecQty: orderQty,
    cumExecNotional: orderNotional,
    avgPrice: orderQty > 0 && orderNotional !== null ? orderNotional / orderQty : null,
    executionIds: executions.executionIds,
  };
}

// ─────────────────────────────────────────────
// Dry-run executor — logs everything, trades nothing
// ─────────────────────────────────────────────
export class DryRunExecutor implements Executor {
  private logger: BotLogger;
  private client: RestClientV5;

  constructor(logger: BotLogger) {
    this.logger = logger;
    // Public API — no key needed for market data
    this.client = new RestClientV5();
  }

  getMode(): string { return "DRY-RUN"; }

  async getPrice(symbol: string): Promise<number> {
    const res = await this.client.getTickers({ category: "linear", symbol });
    if (res.retCode !== 0) throw new Error(`getTickers failed: ${res.retMsg}`);
    const ticker = res.result.list[0];
    if (!ticker) throw new Error(`No ticker for ${symbol}`);
    return parseFloat(ticker.lastPrice);
  }

  async getCandles(symbol: string, interval: string, limit: number, endMs?: number): Promise<Candle[]> {
    const res = await this.client.getKline({
      category: "linear",
      symbol,
      interval: interval as any,
      limit,
      ...(endMs === undefined ? {} : { end: endMs }),
    });
    if (res.retCode !== 0) throw new Error(`getKline failed: ${res.retMsg}`);

    return (res.result.list || []).map((c: any) => ({
      timestamp: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      turnover: Number(c[6]),
    })).reverse(); // API returns newest first, we want ascending
  }

  async openLong(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const qty = notional / price;
    const result: OrderResult = {
      success: true,
      orderId: orderLinkId,
      price,
      priceType: "quote",
      qty,
      notional,
    };
    this.logger.logTrade("OPEN_LONG", symbol, result);
    return result;
  }

  async closeAllLongs(symbol: string, orderLinkId: string): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const result: OrderResult = {
      success: true,
      orderId: orderLinkId,
      price,
      priceType: "quote",
      qty: 0,
      notional: 0,
    };
    this.logger.logTrade("CLOSE_ALL", symbol, result);
    return result;
  }

  async openLongDetailed(symbol: string, notional: number, _leverage: number, orderLinkId: string): Promise<LongExecutionResult> {
    const quotePrice = await this.getPrice(symbol);
    const lotInfo = await this.getInstrumentLotInfo(symbol);
    const submittedQty = normalizeQtyDown(notional / quotePrice, lotInfo.qtyStep);
    return {
      outcome: "terminal",
      orderId: orderLinkId,
      orderLinkId,
      status: "Filled",
      terminal: true,
      submittedQty,
      quotePrice,
      cumExecQty: submittedQty,
      cumExecNotional: submittedQty * quotePrice,
      avgPrice: quotePrice,
      remainingLongQty: null,
      qtyStep: lotInfo.qtyStep,
      executionIds: [`dry-${orderLinkId}`],
    };
  }

  async closeAllLongsDetailed(symbol: string, orderLinkId: string): Promise<LongExecutionResult> {
    const quotePrice = await this.getPrice(symbol);
    const lotInfo = await this.getInstrumentLotInfo(symbol);
    return {
      outcome: "already_flat",
      orderId: "dry-run",
      orderLinkId,
      status: "dry_run",
      terminal: true,
      submittedQty: 0,
      quotePrice,
      cumExecQty: 0,
      cumExecNotional: null,
      avgPrice: null,
      remainingLongQty: 0,
      qtyStep: lotInfo.qtyStep,
      executionIds: [],
    };
  }

  async reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const result: OrderResult = {
      success: true,
      orderId: orderLinkId,
      price,
      priceType: "quote",
      qty,
      notional: qty * price,
    };
    this.logger.logTrade("REDUCE_LONG", symbol, result);
    return result;
  }

  async reduceLongQtyDetailed(symbol: string, qty: number, orderLinkId: string): Promise<PartialReduceResult> {
    const price = await this.getPrice(symbol);
    return {
      accepted: true,
      orderId: orderLinkId,
      orderLinkId,
      status: "Filled",
      terminal: true,
      submittedQty: qty,
      quotePrice: price,
      cumExecQty: qty,
      cumExecNotional: qty * price,
      avgPrice: price,
    };
  }

  async openShort(symbol: string, notional: number, _leverage: number, orderLinkId: string): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const qty = notional / price;
    const result: OrderResult = { success: true, orderId: orderLinkId, price, priceType: "quote", qty, notional };
    this.logger.logTrade("OPEN_SHORT", symbol, result);
    return result;
  }

  async closeShort(symbol: string, orderLinkId: string): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const result: OrderResult = { success: true, orderId: orderLinkId, price, priceType: "quote", qty: 0, notional: 0 };
    this.logger.logTrade("CLOSE_SHORT", symbol, result);
    return result;
  }

  async setPositionTp(symbol: string, tpPrice: number, _positionIdx: number): Promise<TradingStopResult> {
    this.logger.info(`[DRY-RUN] setPositionTp ${symbol}: TP $${tpPrice.toFixed(4)}`);
    return { success: true, status: "confirmed" };
  }

  async setPositionSl(symbol: string, slPrice: number, _positionIdx: number): Promise<TradingStopResult> {
    this.logger.info(`[DRY-RUN] setPositionSl ${symbol}: SL $${slPrice.toFixed(4)}`);
    return { success: true, status: "confirmed" };
  }

  async ensureHedgeMode(_symbol: string): Promise<boolean> {
    return true; // Dry-run: always confirmed
  }

  async queryOrder(_symbol: string, _orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }> {
    return { found: false, status: "dry-run", filledQty: 0, avgPrice: 0 };
  }

  async queryOrderExecution(_symbol: string, orderLinkId: string): Promise<OrderExecutionState> {
    return {
      found: false,
      orderId: "",
      orderLinkId,
      status: "dry-run",
      terminal: false,
      filledQty: 0,
      avgPrice: 0,
      cumExecQty: 0,
      cumExecNotional: null,
    };
  }

  async queryOrderExecutions(_symbol: string, orderLinkId: string): Promise<AggregatedExecutionEvidence> {
    return { found: false, orderId: "", orderLinkId, executionIds: [], cumExecQty: 0, cumExecNotional: null, avgPrice: null };
  }

  async queryRecentLongCloseExecutions(_symbol: string, _startTime: number, _endTime: number): Promise<LongCloseExecutionEvidence[]> {
    return [];
  }

  async queryRecentClosedPnl(_symbol: string, _startTime: number, _endTime: number): Promise<ClosedPnlEvidence[]> {
    return [];
  }

  async getInstrumentLotInfo(_symbol: string): Promise<InstrumentLotInfo> {
    return { qtyStep: 0.1, minOrderQty: 0.1, qtyDecimals: 1 };
  }

  async getLongPositionSize(_symbol: string): Promise<number> {
    return 0;
  }

  async getWalletEquity(): Promise<number> {
    return 0; // Dry-run: no real account
  }
}

// ─────────────────────────────────────────────
// Live executor — places real orders on Bybit
// ─────────────────────────────────────────────
export class LiveExecutor implements Executor {
  private logger: BotLogger;
  private client: RestClientV5;
  private lotInfoCache = new Map<string, InstrumentLotInfo>();
  private longOrderPollAttempts = 5;
  private longOrderPollDelayMs = 500;

  constructor(apiKey: string, apiSecret: string, logger: BotLogger) {
    this.logger = logger;
    this.client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
    });
  }

  getMode(): string { return "LIVE"; }

  private findOpenLongPosition(posRes: any, symbol: string): any | undefined {
    return posRes.result.list.find(
      (p: any) => p.symbol === symbol && p.side === "Buy" && parseFloat(p.size) > 0,
    );
  }

  private isAlreadyFlatCloseError(message: string): boolean {
    return /current position is zero|position.*zero|reduce-only order qty|reduceOnly order qty/i.test(message);
  }

  async getInstrumentLotInfo(symbol: string): Promise<InstrumentLotInfo> {
    const cached = this.lotInfoCache.get(symbol);
    if (cached) return cached;

    const res = await (this.client as any).getInstrumentsInfo({
      category: "linear",
      symbol,
    });
    if (res.retCode !== 0) throw new Error(`getInstrumentsInfo failed: ${res.retMsg}`);

    const instrument = res.result?.list?.[0];
    if (!instrument?.lotSizeFilter) throw new Error(`No lot size filter for ${symbol}`);

    const qtyStep = parseNumber(instrument.lotSizeFilter.qtyStep);
    const minOrderQty = parseNumber(instrument.lotSizeFilter.minOrderQty);
    if (qtyStep <= 0) throw new Error(`Invalid qtyStep for ${symbol}: ${instrument.lotSizeFilter.qtyStep}`);

    const info: InstrumentLotInfo = {
      qtyStep,
      minOrderQty: minOrderQty > 0 ? minOrderQty : qtyStep,
      qtyDecimals: decimalPlacesFromStep(qtyStep),
    };
    this.lotInfoCache.set(symbol, info);
    return info;
  }

  async getLongPositionSize(symbol: string): Promise<number> {
    const posRes = await this.client.getPositionInfo({
      category: "linear",
      symbol,
    });
    if (posRes.retCode !== 0) throw new Error(`getPositionInfo failed: ${posRes.retMsg}`);
    const pos = this.findOpenLongPosition(posRes, symbol);
    return pos ? parseNumber(pos.size) : 0;
  }

  async getPrice(symbol: string): Promise<number> {
    const res = await this.client.getTickers({ category: "linear", symbol });
    if (res.retCode !== 0) throw new Error(`getTickers failed: ${res.retMsg}`);
    const ticker = res.result.list[0];
    if (!ticker) throw new Error(`No ticker for ${symbol}`);
    return parseFloat(ticker.lastPrice);
  }

  async getCandles(symbol: string, interval: string, limit: number, endMs?: number): Promise<Candle[]> {
    const res = await this.client.getKline({
      category: "linear",
      symbol,
      interval: interval as any,
      limit,
      ...(endMs === undefined ? {} : { end: endMs }),
    });
    if (res.retCode !== 0) throw new Error(`getKline failed: ${res.retMsg}`);

    return (res.result.list || []).map((c: any) => ({
      timestamp: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
      turnover: Number(c[6]),
    })).reverse();
  }

  private async submitReduceLongDetailed(symbol: string, qty: number, orderLinkId: string): Promise<PartialReduceResult> {
    try {
      const quotePrice = await this.getPrice(symbol);
      const posRes = await this.client.getPositionInfo({ category: "linear", symbol });
      if (posRes.retCode !== 0) {
        return { accepted: false, orderId: "", orderLinkId, status: "position_query_failed", terminal: true, submittedQty: 0, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null, error: posRes.retMsg };
      }

      const pos = this.findOpenLongPosition(posRes, symbol);
      if (!pos) {
        return { accepted: false, orderId: "no_position", orderLinkId, status: "no_position", terminal: true, submittedQty: 0, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null };
      }

      const lotInfo = await this.getInstrumentLotInfo(symbol);
      const liveSize = parseNumber(pos.size);
      const targetQty = Math.min(qty, liveSize);
      const submittedQty = normalizeQtyDown(targetQty, lotInfo.qtyStep);
      if (submittedQty <= 0) {
        return { accepted: false, orderId: "", orderLinkId, status: "qty_too_small", terminal: true, submittedQty: 0, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null, error: "reduce qty too small after rounding" };
      }
      if (submittedQty < lotInfo.minOrderQty) {
        return { accepted: false, orderId: "", orderLinkId, status: "qty_below_min", terminal: true, submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null, error: `reduce qty ${submittedQty} below minOrderQty ${lotInfo.minOrderQty}` };
      }

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Sell",
        orderType: "Market",
        qty: formatQtyForStep(submittedQty, lotInfo.qtyStep),
        positionIdx: 1,
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
        return { accepted: false, orderId: "", orderLinkId, status: "submit_failed", terminal: true, submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null, error: res.retMsg };
      }

      const orderId = res.result.orderId;
      let latest: OrderExecutionState | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        latest = await this.queryOrderExecution(symbol, orderLinkId);
        if (latest.found && latest.terminal) {
          if (latest.cumExecQty > 0 && latest.avgPrice > 0) {
            this.logger.info(`Reduce-long fill observed: ${latest.status} $${latest.avgPrice.toFixed(4)} x${latest.cumExecQty} (quote was $${quotePrice.toFixed(4)})`);
          }
          break;
        }
      }

      if (!latest || !latest.found) {
        this.logger.warn(`Reduce-long accepted but not found after polling: ${orderLinkId}`);
        return { accepted: true, orderId, orderLinkId, status: "accepted_unconfirmed", terminal: false, submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null };
      }

      return {
        accepted: true,
        orderId,
        orderLinkId,
        status: latest.status,
        terminal: latest.terminal,
        submittedQty,
        quotePrice,
        cumExecQty: latest.cumExecQty,
        cumExecNotional: latest.cumExecNotional,
        avgPrice: latest.avgPrice > 0 ? latest.avgPrice : null,
      };
    } catch (err: any) {
      this.logger.logError(`reduceLongQtyDetailed error: ${err.message}`);
      return { accepted: false, orderId: "", orderLinkId, status: "error", terminal: true, submittedQty: 0, quotePrice: 0, cumExecQty: 0, cumExecNotional: null, avgPrice: null, error: err.message };
    }
  }

  async reduceLongQtyDetailed(symbol: string, qty: number, orderLinkId: string): Promise<PartialReduceResult> {
    return this.submitReduceLongDetailed(symbol, qty, orderLinkId);
  }

  async reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult> {
    const detailed = await this.reduceLongQtyDetailed(symbol, qty, orderLinkId);
    const avgPrice = detailed.avgPrice ?? (
      detailed.cumExecQty > 0 && detailed.cumExecNotional !== null
        ? detailed.cumExecNotional / detailed.cumExecQty
        : 0
    );

    if (!detailed.accepted || detailed.cumExecQty <= 0 || avgPrice <= 0) {
      return {
        success: false,
        orderId: detailed.orderId,
        price: detailed.quotePrice,
        priceType: "quote",
        qty: detailed.submittedQty,
        notional: detailed.submittedQty * detailed.quotePrice,
        error: detailed.error ?? `reduce not confirmed: ${detailed.status}`,
      };
    }

    const result: OrderResult = {
      success: detailed.terminal && detailed.status === "Filled",
      orderId: detailed.orderId,
      price: avgPrice,
      priceType: "fill",
      qty: detailed.cumExecQty,
      notional: detailed.cumExecQty * avgPrice,
      error: detailed.terminal && detailed.status === "Filled" ? undefined : `reduce not terminal: ${detailed.status}`,
    };
    if (result.success) {
      this.logger.logTrade("REDUCE_LONG", symbol, result);
    } else {
      this.logger.warn(`Reduce-long accepted but not finalized: ${detailed.status} x${detailed.cumExecQty}/${detailed.submittedQty}`);
    }
    return result;
  }

  async openLongDetailed(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<LongExecutionResult> {
    let quotePrice = 0;
    let submittedQty = 0;
    let qtyStep = 0;
    let orderId = "";

    try {
      await this.client.setLeverage({ category: "linear", symbol, buyLeverage: String(leverage), sellLeverage: String(leverage) });
      quotePrice = await this.getPrice(symbol);
      const lotInfo = await this.getInstrumentLotInfo(symbol);
      qtyStep = lotInfo.qtyStep;
      submittedQty = normalizeQtyDown(notional / quotePrice, qtyStep);
      if (submittedQty <= 0 || submittedQty < lotInfo.minOrderQty) {
        return {
          outcome: "not_submitted", orderId, orderLinkId, status: "qty_invalid", terminal: true,
          submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
          remainingLongQty: null, qtyStep, executionIds: [], error: "open qty invalid after lot normalization",
        };
      }
    } catch (err: any) {
      return {
        outcome: "not_submitted", orderId, orderLinkId, status: "pre_submit_error", terminal: true,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: err.message,
      };
    }

    let res: any;
    try {
      res = await this.client.submitOrder({
        category: "linear", symbol, side: "Buy", orderType: "Market",
        qty: formatQtyForStep(submittedQty, qtyStep), positionIdx: 1, orderLinkId,
      });
    } catch (err: any) {
      return {
        outcome: "unknown", orderId: "", orderLinkId, status: "submit_unknown", terminal: false,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: err.message,
      };
    }

    if (res.retCode !== 0) {
      return {
        outcome: "rejected", orderId: "", orderLinkId, status: "Rejected", terminal: true,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: res.retMsg,
      };
    }
    orderId = String(res.result.orderId ?? "");

    let latest: OrderExecutionState | null = null;
    for (let attempt = 0; attempt < this.longOrderPollAttempts; attempt++) {
      if (this.longOrderPollDelayMs > 0) await new Promise(r => setTimeout(r, this.longOrderPollDelayMs));
      latest = await this.queryOrderExecution(symbol, orderLinkId);
      if (latest.found && latest.terminal) break;
    }
    const executions = await this.queryOrderExecutions(symbol, orderLinkId);
    const merged = mergeOrderAndExecutionEvidence(latest, executions);
    const { cumExecQty, cumExecNotional, avgPrice } = merged;

    if (!latest?.found || !latest.terminal) {
      return {
        outcome: "accepted_unresolved", orderId: orderId || executions.orderId, orderLinkId,
        status: latest?.found ? latest.status : "accepted_unconfirmed", terminal: false,
        submittedQty, quotePrice, cumExecQty, cumExecNotional, avgPrice,
        remainingLongQty: null, qtyStep, executionIds: merged.executionIds,
      };
    }
    return {
      outcome: "terminal", orderId: orderId || latest.orderId || executions.orderId, orderLinkId,
      status: latest.status, terminal: true, submittedQty, quotePrice, cumExecQty,
      cumExecNotional, avgPrice, remainingLongQty: null, qtyStep, executionIds: merged.executionIds,
    };
  }

  async closeAllLongsDetailed(symbol: string, orderLinkId: string): Promise<LongExecutionResult> {
    let quotePrice = 0;
    let submittedQty = 0;
    let qtyStep = 0;
    let orderId = "";

    try {
      const posRes = await this.client.getPositionInfo({ category: "linear", symbol });
      if (posRes.retCode !== 0) throw new Error(posRes.retMsg);
      const pos = this.findOpenLongPosition(posRes, symbol);
      if (!pos) {
        return {
          outcome: "already_flat", orderId: "no_position", orderLinkId, status: "already_flat", terminal: true,
          submittedQty: 0, quotePrice: 0, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
          remainingLongQty: 0, qtyStep: 0, executionIds: [],
        };
      }
      submittedQty = parseNumber(pos.size);
      const lotInfo = await this.getInstrumentLotInfo(symbol);
      qtyStep = lotInfo.qtyStep;
      quotePrice = await this.getPrice(symbol);
    } catch (err: any) {
      return {
        outcome: "not_submitted", orderId, orderLinkId, status: "pre_submit_error", terminal: true,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: err.message,
      };
    }

    let res: any;
    try {
      res = await this.client.submitOrder({
        category: "linear", symbol, side: "Sell", orderType: "Market",
        qty: formatQtyForStep(submittedQty, qtyStep), positionIdx: 1, reduceOnly: true, orderLinkId,
      });
    } catch (err: any) {
      return {
        outcome: "unknown", orderId: "", orderLinkId, status: "submit_unknown", terminal: false,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: err.message,
      };
    }

    if (res.retCode !== 0) {
      if (this.isAlreadyFlatCloseError(res.retMsg)) {
        try {
          const remainingLongQty = await this.getLongPositionSize(symbol);
          if (remainingLongQty <= Math.max(qtyStep / 2, 1e-8)) {
            return {
              outcome: "already_flat", orderId: "already_flat", orderLinkId, status: "already_flat", terminal: true,
              submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
              remainingLongQty, qtyStep, executionIds: [],
            };
          }
        } catch {
          // The coordinator must verify position truth before clearing intent.
        }
      }
      return {
        outcome: "rejected", orderId: "", orderLinkId, status: "Rejected", terminal: true,
        submittedQty, quotePrice, cumExecQty: 0, cumExecNotional: null, avgPrice: null,
        remainingLongQty: null, qtyStep, executionIds: [], error: res.retMsg,
      };
    }
    orderId = String(res.result.orderId ?? "");

    let latest: OrderExecutionState | null = null;
    for (let attempt = 0; attempt < this.longOrderPollAttempts; attempt++) {
      if (this.longOrderPollDelayMs > 0) await new Promise(r => setTimeout(r, this.longOrderPollDelayMs));
      latest = await this.queryOrderExecution(symbol, orderLinkId);
      if (latest.found && latest.terminal) break;
    }
    const executions = await this.queryOrderExecutions(symbol, orderLinkId);
    const merged = mergeOrderAndExecutionEvidence(latest, executions);
    const { cumExecQty, cumExecNotional, avgPrice } = merged;

    if (!latest?.found || !latest.terminal) {
      return {
        outcome: "accepted_unresolved", orderId: orderId || executions.orderId, orderLinkId,
        status: latest?.found ? latest.status : "accepted_unconfirmed", terminal: false,
        submittedQty, quotePrice, cumExecQty, cumExecNotional, avgPrice,
        remainingLongQty: null, qtyStep, executionIds: merged.executionIds,
      };
    }

    let remainingLongQty: number | null = null;
    try { remainingLongQty = await this.getLongPositionSize(symbol); } catch { remainingLongQty = null; }
    return {
      outcome: "terminal", orderId: orderId || latest.orderId || executions.orderId, orderLinkId,
      status: latest.status, terminal: true, submittedQty, quotePrice, cumExecQty,
      cumExecNotional, avgPrice, remainingLongQty, qtyStep, executionIds: merged.executionIds,
    };
  }

  async openLong(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult> {
    try {
      await this.client.setLeverage({
        category: "linear",
        symbol,
        buyLeverage: String(leverage),
        sellLeverage: String(leverage),
      });

      const quotePrice = await this.getPrice(symbol);
      const qty = notional / quotePrice;
      const lotInfo = await this.getInstrumentLotInfo(symbol);

      const roundedQty = normalizeQtyDown(qty, lotInfo.qtyStep);
      if (roundedQty <= 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: 0, notional, error: "qty too small" };
      }

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Buy",
        orderType: "Market",
        qty: formatQtyForStep(roundedQty, lotInfo.qtyStep),
        positionIdx: 1,   // hedge mode: buy side
        orderLinkId,
      });

      if (res.retCode !== 0) {
        this.logger.logError(`Order failed: ${res.retMsg}`);
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: res.retMsg };
      }

      // Poll for actual fill to get confirmed execution price
      const orderId = res.result.orderId;
      let latest: OrderExecutionState | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        latest = await this.queryOrderExecution(symbol, orderLinkId);
        if (latest.found && latest.terminal) {
          break;
        }
      }

      if (!latest || !latest.found) {
        this.logger.warn(`Open accepted but not found after polling: ${orderLinkId}`);
      }

      if (!latest || !latest.found) {
        return { success: false, orderId, price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: "open accepted but not confirmed" };
      }

      if (!latest.terminal) {
        this.logger.warn(`Open accepted but still nonterminal: ${latest.status} ${latest.cumExecQty}/${roundedQty}`);
        return { success: false, orderId, price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: `open not terminal: ${latest.status}` };
      }

      if (latest.cumExecQty <= 0 || latest.avgPrice <= 0) {
        return { success: false, orderId, price: quotePrice, priceType: "quote", qty: 0, notional, error: `open terminal with no fill: ${latest.status}` };
      }

      const result: OrderResult = {
        success: true,
        orderId,
        price: latest.avgPrice,
        priceType: "fill",
        qty: latest.cumExecQty,
        notional: latest.cumExecQty * latest.avgPrice,
      };
      this.logger.info(`Open fill confirmed: $${result.price.toFixed(4)} x${result.qty} (quote was $${quotePrice.toFixed(4)}, status ${latest.status})`);
      this.logger.logTrade("OPEN_LONG", symbol, result);
      return result;

    } catch (err: any) {
      this.logger.logError(`openLong error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional, error: err.message };
    }
  }

  async closeAllLongs(symbol: string, orderLinkId: string): Promise<OrderResult> {
    try {
      const posRes = await this.client.getPositionInfo({
        category: "linear",
        symbol,
      });

      if (posRes.retCode !== 0) {
        return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: posRes.retMsg };
      }

      const pos = this.findOpenLongPosition(posRes, symbol);

      if (!pos) {
        return { success: true, orderId: "no_position", price: 0, priceType: "quote", qty: 0, notional: 0 };
      }

      const size = parseFloat(pos.size);
      const lotInfo = await this.getInstrumentLotInfo(symbol);
      const qtyTolerance = Math.max(lotInfo.qtyStep / 2, 1e-8);
      const quotePrice = await this.getPrice(symbol);

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Sell",
        orderType: "Market",
        qty: String(size),
        positionIdx: 1,   // hedge mode: buy side close
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
        if (this.isAlreadyFlatCloseError(res.retMsg)) {
          const recheck = await this.client.getPositionInfo({
            category: "linear",
            symbol,
          });
          const stillOpen = recheck.retCode === 0 ? this.findOpenLongPosition(recheck, symbol) : undefined;
          if (recheck.retCode === 0 && !stillOpen) {
            const result: OrderResult = {
              success: true,
              orderId: "already_flat",
              price: quotePrice,
              priceType: "quote",
              qty: 0,
              notional: 0,
            };
            this.logger.warn(`Close order skipped: exchange is already flat after native TP/reduce-only race (${res.retMsg})`);
            this.logger.logTrade("CLOSE_ALL_ALREADY_FLAT", symbol, result);
            return result;
          }
        }
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: size, notional: size * quotePrice, error: res.retMsg };
      }

      // Poll for actual fill to get confirmed execution price
      const orderId = res.result.orderId;
      let latest: OrderExecutionState | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500)); // 500ms between polls
        latest = await this.queryOrderExecution(symbol, orderLinkId);
        if (latest.found && latest.terminal) {
          break;
        }
      }

      if (!latest || !latest.found) {
        this.logger.warn(`Close accepted but not found after polling: ${orderLinkId}`);
        return { success: false, orderId, price: quotePrice, priceType: "quote", qty: size, notional: size * quotePrice, error: "close accepted but not confirmed" };
      }

      if (!latest.terminal) {
        this.logger.warn(`Close accepted but still nonterminal: ${latest.status} ${latest.cumExecQty}/${size}`);
        return { success: false, orderId, price: quotePrice, priceType: "quote", qty: size, notional: size * quotePrice, error: `close not terminal: ${latest.status}` };
      }

      const remainingLong = await this.getLongPositionSize(symbol);
      const filledEnough = latest.cumExecQty >= size - qtyTolerance;
      const exchangeFlat = remainingLong <= qtyTolerance;
      if (!filledEnough || !exchangeFlat || latest.avgPrice <= 0) {
        return {
          success: false,
          orderId,
          price: latest.avgPrice > 0 ? latest.avgPrice : quotePrice,
          priceType: latest.avgPrice > 0 ? "fill" : "quote",
          qty: latest.cumExecQty,
          notional: latest.avgPrice > 0 ? latest.cumExecQty * latest.avgPrice : latest.cumExecQty * quotePrice,
          error: `close not fully confirmed: status=${latest.status} filled=${latest.cumExecQty}/${size} remaining=${remainingLong}`,
        };
      }

      const result: OrderResult = {
        success: true,
        orderId,
        price: latest.avgPrice,
        priceType: "fill",
        qty: latest.cumExecQty,
        notional: latest.cumExecQty * latest.avgPrice,
      };
      this.logger.info(`Close fill confirmed: $${result.price.toFixed(4)} x${result.qty} (quote was $${quotePrice.toFixed(4)}, status ${latest.status})`);
      this.logger.logTrade("CLOSE_ALL", symbol, result);
      return result;

    } catch (err: any) {
      this.logger.logError(`closeAllLongs error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: err.message };
    }
  }

  private async reduceLongQtyLegacy(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult> {
    try {
      const posRes = await this.client.getPositionInfo({ category: "linear", symbol });
      if (posRes.retCode !== 0) {
        return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: posRes.retMsg };
      }
      const pos = posRes.result.list.find(
        (p: any) => p.symbol === symbol && p.side === "Buy" && parseFloat(p.size) > 0,
      );
      if (!pos) {
        return { success: true, orderId: "no_position", price: 0, priceType: "quote", qty: 0, notional: 0 };
      }

      const liveSize = parseFloat(pos.size);
      // Cap reduce qty to live size and round down to lot step
      const targetQty = Math.min(qty, liveSize);
      const roundedQty = Math.floor(targetQty * 10) / 10;
      if (roundedQty <= 0) {
        return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: "reduce qty too small after rounding" };
      }

      const quotePrice = await this.getPrice(symbol);
      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Sell",
        orderType: "Market",
        qty: String(roundedQty),
        positionIdx: 1,   // hedge mode: long-side reduce
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: roundedQty, notional: roundedQty * quotePrice, error: res.retMsg };
      }

      const orderId = res.result.orderId;
      let fillPrice = quotePrice;
      let fillPriceType: "quote" | "fill" = "quote";
      let filledQty = roundedQty;

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        const fillCheck = await this.queryOrder(symbol, orderLinkId);
        if (fillCheck.found && fillCheck.status === "Filled" && fillCheck.avgPrice > 0) {
          fillPrice = fillCheck.avgPrice;
          fillPriceType = "fill";
          filledQty = fillCheck.filledQty;
          this.logger.info(`Reduce-long fill confirmed: $${fillPrice.toFixed(4)} x${filledQty} (quote was $${quotePrice.toFixed(4)})`);
          break;
        }
      }

      if (fillPriceType === "quote") {
        this.logger.warn(`Reduce-long fill not confirmed after polling — using quote price $${quotePrice.toFixed(4)}`);
      }

      const result: OrderResult = {
        success: true,
        orderId,
        price: fillPrice,
        priceType: fillPriceType,
        qty: filledQty,
        notional: filledQty * fillPrice,
      };
      this.logger.logTrade("REDUCE_LONG", symbol, result);
      return result;
    } catch (err: any) {
      this.logger.logError(`reduceLongQty error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: err.message };
    }
  }

  async openShort(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult> {
    try {
      await this.client.setLeverage({
        category: "linear",
        symbol,
        buyLeverage: String(leverage),
        sellLeverage: String(leverage),
      });

      const quotePrice = await this.getPrice(symbol);
      const qty = notional / quotePrice;
      const roundedQty = Math.floor(qty * 10) / 10;

      if (roundedQty <= 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: 0, notional, error: "qty too small" };
      }

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Sell",
        orderType: "Market",
        qty: String(roundedQty),
        positionIdx: 2,   // hedge mode: sell side
        orderLinkId,
      });

      if (res.retCode !== 0) {
        this.logger.logError(`Hedge short order failed: ${res.retMsg}`);
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: res.retMsg };
      }

      const orderId = res.result.orderId;
      let fillPrice = quotePrice;
      let fillPriceType: "quote" | "fill" = "quote";
      let filledQty = roundedQty;

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        const fillCheck = await this.queryOrder(symbol, orderLinkId);
        if (fillCheck.found && fillCheck.status === "Filled" && fillCheck.avgPrice > 0) {
          fillPrice = fillCheck.avgPrice;
          fillPriceType = "fill";
          filledQty = fillCheck.filledQty;
          this.logger.info(`Hedge short fill confirmed: $${fillPrice.toFixed(4)} x${filledQty}`);
          break;
        }
      }

      if (fillPriceType === "quote") {
        this.logger.warn(`Hedge short fill not confirmed — using quote price $${quotePrice.toFixed(4)}`);
      }

      const result: OrderResult = { success: true, orderId, price: fillPrice, priceType: fillPriceType, qty: filledQty, notional: filledQty * fillPrice };
      this.logger.logTrade("OPEN_SHORT", symbol, result);
      return result;
    } catch (err: any) {
      this.logger.logError(`openShort error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional, error: err.message };
    }
  }

  async closeShort(symbol: string, orderLinkId: string): Promise<OrderResult> {
    try {
      const posRes = await this.client.getPositionInfo({ category: "linear", symbol });

      if (posRes.retCode !== 0) {
        return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: posRes.retMsg };
      }

      const pos = posRes.result.list.find(
        (p: any) => p.symbol === symbol && p.side === "Sell" && parseFloat(p.size) > 0,
      );

      if (!pos) {
        // Already flat — clear local state cleanly
        return { success: true, orderId: "no_short_position", price: 0, priceType: "quote", qty: 0, notional: 0 };
      }

      const size = parseFloat(pos.size);
      const quotePrice = await this.getPrice(symbol);

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Buy",
        orderType: "Market",
        qty: String(size),
        positionIdx: 2,   // hedge mode: sell side close
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: size, notional: size * quotePrice, error: res.retMsg };
      }

      const orderId = res.result.orderId;
      let fillPrice = quotePrice;
      let fillPriceType: "quote" | "fill" = "quote";

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        const fillCheck = await this.queryOrder(symbol, orderLinkId);
        if (fillCheck.found && fillCheck.status === "Filled" && fillCheck.avgPrice > 0) {
          fillPrice = fillCheck.avgPrice;
          fillPriceType = "fill";
          this.logger.info(`Hedge short close fill confirmed: $${fillPrice.toFixed(4)}`);
          break;
        }
      }

      const result: OrderResult = { success: true, orderId, price: fillPrice, priceType: fillPriceType, qty: size, notional: size * fillPrice };
      this.logger.logTrade("CLOSE_SHORT", symbol, result);
      return result;
    } catch (err: any) {
      this.logger.logError(`closeShort error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: err.message };
    }
  }

  private tradingStopFailure(retCode: number, retMsg: string): TradingStopResult {
    if (/not modified/i.test(retMsg)) {
      return { success: true, status: "not_modified", retCode, retMsg };
    }
    return { success: false, status: "failed", retCode, retMsg, error: retMsg };
  }

  async setPositionTp(symbol: string, tpPrice: number, positionIdx: number): Promise<TradingStopResult> {
    try {
      const res = await (this.client as any).setTradingStop({
        category: "linear",
        symbol,
        takeProfit: tpPrice.toFixed(4),
        tpTriggerBy: "MarkPrice",
        tpslMode: "Full",
        positionIdx,
      });
      if (res.retCode !== 0) {
        this.logger.warn(`setPositionTp failed: ${res.retMsg}`);
        return this.tradingStopFailure(res.retCode, res.retMsg);
      }
      return { success: true, status: "confirmed", retCode: res.retCode, retMsg: res.retMsg };
    } catch (err: any) {
      this.logger.warn(`setPositionTp error: ${err.message}`);
      return { success: false, status: "failed", error: err.message };
    }
  }

  async setPositionSl(symbol: string, slPrice: number, positionIdx: number): Promise<TradingStopResult> {
    try {
      const res = await (this.client as any).setTradingStop({
        category: "linear",
        symbol,
        stopLoss: slPrice.toFixed(4),
        slTriggerBy: "MarkPrice",
        tpslMode: "Full",
        positionIdx,
      });
      if (res.retCode !== 0) {
        this.logger.warn(`setPositionSl failed: ${res.retMsg}`);
        return this.tradingStopFailure(res.retCode, res.retMsg);
      }
      return { success: true, status: "confirmed", retCode: res.retCode, retMsg: res.retMsg };
    } catch (err: any) {
      this.logger.warn(`setPositionSl error: ${err.message}`);
      return { success: false, status: "failed", error: err.message };
    }
  }

  async ensureHedgeMode(symbol: string): Promise<boolean> {
    try {
      const res = await (this.client as any).switchPositionMode({
        category: "linear",
        symbol,
        mode: 3,  // 3 = both sides (hedge mode)
      });
      if (res.retCode === 0) {
        this.logger.info(`Position mode set to hedge (both sides) for ${symbol}`);
        return true;
      } else if (res.retCode === 110025) {
        // "Position mode is not modified" — already in hedge mode
        this.logger.info(`${symbol} already in hedge position mode`);
        return true;
      } else {
        this.logger.warn(`ensureHedgeMode FAILED: ${res.retMsg} (retCode ${res.retCode}) — hedge disabled`);
        return false;
      }
    } catch (err: any) {
      this.logger.warn(`ensureHedgeMode error: ${err.message} — hedge disabled`);
      return false;
    }
  }

  private orderExecutionFromRaw(order: any, orderLinkId: string): OrderExecutionState {
    const cumExecQty = parseNumber(order.cumExecQty);
    const rawAvgPrice = parseNumber(order.avgPrice);
    const cumExecNotional = order.cumExecValue !== undefined ? parseNumber(order.cumExecValue) : null;
    const avgPrice = rawAvgPrice > 0
      ? rawAvgPrice
      : (cumExecQty > 0 && cumExecNotional && cumExecNotional > 0 ? cumExecNotional / cumExecQty : 0);
    const status = String(order.orderStatus ?? "unknown");
    return {
      found: true,
      orderId: String(order.orderId ?? ""),
      orderLinkId,
      status,
      terminal: isTerminalOrderStatus(status),
      filledQty: cumExecQty,
      avgPrice,
      cumExecQty,
      cumExecNotional,
    };
  }

  async queryOrderExecution(symbol: string, orderLinkId: string): Promise<OrderExecutionState> {
    try {
      const res = await this.client.getActiveOrders({
        category: "linear",
        symbol,
        orderLinkId,
      });

      if (res.retCode !== 0 || !res.result.list || res.result.list.length === 0) {
        // Check order history (filled orders move out of active)
        const histRes = await this.client.getHistoricOrders({
          category: "linear",
          symbol,
          orderLinkId,
        });
        if (histRes.retCode === 0 && histRes.result.list && histRes.result.list.length > 0) {
          return this.orderExecutionFromRaw(histRes.result.list[0], orderLinkId);
        }
        return {
          found: false,
          orderId: "",
          orderLinkId,
          status: "not_found",
          terminal: false,
          filledQty: 0,
          avgPrice: 0,
          cumExecQty: 0,
          cumExecNotional: null,
        };
      }

      return this.orderExecutionFromRaw(res.result.list[0], orderLinkId);
    } catch (err: any) {
      this.logger.logError(`queryOrderExecution error: ${err.message}`);
      return {
        found: false,
        orderId: "",
        orderLinkId,
        status: "error",
        terminal: false,
        filledQty: 0,
        avgPrice: 0,
        cumExecQty: 0,
        cumExecNotional: null,
        error: err.message,
      };
    }
  }

  async queryOrderExecutions(symbol: string, orderLinkId: string): Promise<AggregatedExecutionEvidence> {
    try {
      const res = await (this.client as any).getExecutionList({
        category: "linear",
        symbol,
        orderLinkId,
        limit: 100,
      });
      if (res.retCode !== 0) {
        return {
          found: false, orderId: "", orderLinkId, executionIds: [], cumExecQty: 0,
          cumExecNotional: null, avgPrice: null, error: res.retMsg,
        };
      }

      const byExecId = new Map<string, any>();
      for (const raw of res.result?.list ?? []) {
        const rawLinkId = String(raw.orderLinkId ?? "");
        if (rawLinkId && rawLinkId !== orderLinkId) continue;
        const execId = String(raw.execId ?? "");
        if (!execId || byExecId.has(execId)) continue;
        byExecId.set(execId, raw);
      }
      const executions = [...byExecId.values()];
      if (executions.length === 0) {
        return { found: false, orderId: "", orderLinkId, executionIds: [], cumExecQty: 0, cumExecNotional: null, avgPrice: null };
      }

      let cumExecQty = 0;
      let cumExecNotional = 0;
      for (const execution of executions) {
        const qty = parseNumber(execution.execQty);
        const price = parseNumber(execution.execPrice);
        cumExecQty += qty;
        cumExecNotional += qty * price;
      }
      return {
        found: cumExecQty > 0,
        orderId: String(executions[0].orderId ?? ""),
        orderLinkId,
        executionIds: executions.map(execution => String(execution.execId)),
        cumExecQty,
        cumExecNotional: cumExecQty > 0 ? cumExecNotional : null,
        avgPrice: cumExecQty > 0 ? cumExecNotional / cumExecQty : null,
      };
    } catch (err: any) {
      return {
        found: false, orderId: "", orderLinkId, executionIds: [], cumExecQty: 0,
        cumExecNotional: null, avgPrice: null, error: err.message,
      };
    }
  }

  async queryRecentLongCloseExecutions(
    symbol: string,
    startTime: number,
    endTime: number,
  ): Promise<LongCloseExecutionEvidence[]> {
    try {
      const res = await (this.client as any).getExecutionList({
        category: "linear",
        symbol,
        startTime,
        endTime,
        limit: 100,
      });
      if (res.retCode !== 0) throw new Error(res.retMsg);
      const byExecId = new Map<string, LongCloseExecutionEvidence>();
      for (const raw of res.result?.list ?? []) {
        const execTime = parseNumber(raw.execTime);
        const positionIdx = raw.positionIdx === undefined ? 1 : parseNumber(raw.positionIdx);
        const closedSize = parseNumber(raw.closedSize);
        if (String(raw.side ?? "") !== "Sell" || positionIdx !== 1 || closedSize <= 0) continue;
        if (execTime < startTime || execTime > endTime) continue;
        const execId = String(raw.execId ?? "");
        if (!execId || byExecId.has(execId)) continue;
        byExecId.set(execId, {
          execId,
          orderId: String(raw.orderId ?? ""),
          orderLinkId: String(raw.orderLinkId ?? ""),
          execTime,
          closedSize,
          execQty: parseNumber(raw.execQty),
          execPrice: parseNumber(raw.execPrice),
        });
      }
      return [...byExecId.values()].sort((a, b) => a.execTime - b.execTime);
    } catch (err: any) {
      this.logger.logError(`queryRecentLongCloseExecutions error: ${err.message}`);
      return [];
    }
  }

  async queryRecentClosedPnl(symbol: string, startTime: number, endTime: number): Promise<ClosedPnlEvidence[]> {
    try {
      const res = await (this.client as any).getClosedPnL({
        category: "linear",
        symbol,
        startTime,
        endTime,
        limit: 100,
      });
      if (res.retCode !== 0) throw new Error(res.retMsg);
      const byOrderId = new Map<string, ClosedPnlEvidence>();
      for (const raw of res.result?.list ?? []) {
        const updatedTime = parseNumber(raw.updatedTime);
        if (updatedTime < startTime || updatedTime > endTime) continue;
        const orderId = String(raw.orderId ?? "");
        if (!orderId || byOrderId.has(orderId)) continue;
        const side = String(raw.side ?? "");
        if (side && side !== "Sell") continue;
        const closedSize = parseNumber(raw.closedSize);
        const avgExitPrice = parseNumber(raw.avgExitPrice);
        if (closedSize <= 0 || avgExitPrice <= 0) continue;
        byOrderId.set(orderId, {
          orderId,
          side,
          updatedTime,
          closedSize,
          avgExitPrice,
          closedPnl: parseNumber(raw.closedPnl),
        });
      }
      return [...byOrderId.values()].sort((a, b) => a.updatedTime - b.updatedTime);
    } catch (err: any) {
      this.logger.logError(`queryRecentClosedPnl error: ${err.message}`);
      return [];
    }
  }

  async queryOrder(symbol: string, orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }> {
    const state = await this.queryOrderExecution(symbol, orderLinkId);
    return {
      found: state.found,
      status: state.status,
      filledQty: state.filledQty,
      avgPrice: state.avgPrice,
    };
  }

  async getWalletEquity(): Promise<number> {
    try {
      const res = await this.client.getWalletBalance({ accountType: "UNIFIED" });
      if (res.retCode !== 0) throw new Error(`getWalletBalance failed: ${res.retMsg}`);
      const acct = res.result.list?.[0];
      if (!acct) throw new Error("No account data in wallet response");
      return parseFloat(acct.totalWalletBalance);
    } catch (err: any) {
      this.logger.logError(`getWalletEquity error: ${err.message}`);
      return -1; // Caller should fall back to synthetic calc
    }
  }
}
