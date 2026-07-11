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

export interface Executor {
  // Market data (no API key needed)
  getPrice(symbol: string): Promise<number>;
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;

  // Trading (needs API key in live mode)
  // orderLinkId is caller-generated — same ID persisted in state and sent to exchange
  openLong(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult>;
  closeAllLongs(symbol: string, orderLinkId: string): Promise<OrderResult>;
  // Partial reduce: market sell `qty` of the long side (reduceOnly).
  reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult>;
  reduceLongQtyDetailed(symbol: string, qty: number, orderLinkId: string): Promise<PartialReduceResult>;
  openShort(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult>;
  closeShort(symbol: string, orderLinkId: string): Promise<OrderResult>;

  // Set native TP/SL on the exchange position — survives bot restarts, catches wick TPs
  setPositionTp(symbol: string, tpPrice: number, positionIdx: number): Promise<void>;
  setPositionSl(symbol: string, slPrice: number, positionIdx: number): Promise<void>;

  // Set Bybit position mode to hedge (both sides) — required before running long+short simultaneously.
  // Returns true if confirmed, false if failed (hedge should be gated until true).
  ensureHedgeMode(symbol: string): Promise<boolean>;

  // Order queries (live mode)
  queryOrder(symbol: string, orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }>;
  queryOrderExecution(symbol: string, orderLinkId: string): Promise<OrderExecutionState>;
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

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const res = await this.client.getKline({
      category: "linear",
      symbol,
      interval: interval as any,
      limit,
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

  async setPositionTp(symbol: string, tpPrice: number, _positionIdx: number): Promise<void> {
    this.logger.info(`[DRY-RUN] setPositionTp ${symbol}: TP $${tpPrice.toFixed(4)}`);
  }

  async setPositionSl(symbol: string, slPrice: number, _positionIdx: number): Promise<void> {
    this.logger.info(`[DRY-RUN] setPositionSl ${symbol}: SL $${slPrice.toFixed(4)}`);
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

  async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const res = await this.client.getKline({
      category: "linear",
      symbol,
      interval: interval as any,
      limit,
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

      const roundedQty = Math.floor(qty * 10) / 10;
      if (roundedQty <= 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: 0, notional, error: "qty too small" };
      }

      const res = await this.client.submitOrder({
        category: "linear",
        symbol,
        side: "Buy",
        orderType: "Market",
        qty: String(roundedQty),
        positionIdx: 1,   // hedge mode: buy side
        orderLinkId,
      });

      if (res.retCode !== 0) {
        this.logger.logError(`Order failed: ${res.retMsg}`);
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: res.retMsg };
      }

      // Poll for actual fill to get confirmed execution price
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
          this.logger.info(`Open fill confirmed: $${fillPrice.toFixed(4)} x${filledQty} (quote was $${quotePrice.toFixed(4)})`);
          break;
        }
      }

      if (fillPriceType === "quote") {
        this.logger.warn(`Open fill not confirmed after polling — using quote price $${quotePrice.toFixed(4)}`);
      }

      const result: OrderResult = {
        success: true,
        orderId,
        price: fillPrice,
        priceType: fillPriceType,
        qty: filledQty,
        notional: filledQty * fillPrice,
      };
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
      let fillPrice = quotePrice;
      let fillPriceType: "quote" | "fill" = "quote";

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 500)); // 500ms between polls
        const fillCheck = await this.queryOrder(symbol, orderLinkId);
        if (fillCheck.found && fillCheck.status === "Filled" && fillCheck.avgPrice > 0) {
          fillPrice = fillCheck.avgPrice;
          fillPriceType = "fill";
          this.logger.info(`Close fill confirmed: $${fillPrice.toFixed(4)} (quote was $${quotePrice.toFixed(4)})`);
          break;
        }
      }

      if (fillPriceType === "quote") {
        this.logger.warn(`Close fill not confirmed after polling — using quote price $${quotePrice.toFixed(4)}`);
      }

      const result: OrderResult = {
        success: true,
        orderId,
        price: fillPrice,
        priceType: fillPriceType,
        qty: size,
        notional: size * fillPrice,
      };
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

  async setPositionTp(symbol: string, tpPrice: number, positionIdx: number): Promise<void> {
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
      }
    } catch (err: any) {
      this.logger.warn(`setPositionTp error: ${err.message}`);
    }
  }

  async setPositionSl(symbol: string, slPrice: number, positionIdx: number): Promise<void> {
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
      }
    } catch (err: any) {
      this.logger.warn(`setPositionSl error: ${err.message}`);
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
