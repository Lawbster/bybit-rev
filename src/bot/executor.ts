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

export interface Executor {
  // Market data (no API key needed)
  getPrice(symbol: string): Promise<number>;
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;

  // Trading (needs API key in live mode)
  // orderLinkId is caller-generated — same ID persisted in state and sent to exchange
  openLong(symbol: string, notional: number, leverage: number, orderLinkId: string): Promise<OrderResult>;
  closeAllLongs(symbol: string, orderLinkId: string): Promise<OrderResult>;

  // Order queries (live mode)
  queryOrder(symbol: string, orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }>;

  // Info
  getMode(): string;
}

/** Generate a unique orderLinkId. Call from index.ts, pass to executor + state. */
export function genOrderLinkId(action: string): string {
  return `2moon_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  async queryOrder(_symbol: string, _orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }> {
    return { found: false, status: "dry-run", filledQty: 0, avgPrice: 0 };
  }
}

// ─────────────────────────────────────────────
// Live executor — places real orders on Bybit
// ─────────────────────────────────────────────
export class LiveExecutor implements Executor {
  private logger: BotLogger;
  private client: RestClientV5;

  constructor(apiKey: string, apiSecret: string, logger: BotLogger) {
    this.logger = logger;
    this.client = new RestClientV5({
      key: apiKey,
      secret: apiSecret,
    });
  }

  getMode(): string { return "LIVE"; }

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
        orderLinkId,
      });

      if (res.retCode !== 0) {
        this.logger.logError(`Order failed: ${res.retMsg}`);
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: roundedQty, notional, error: res.retMsg };
      }

      const result: OrderResult = {
        success: true,
        orderId: res.result.orderId,
        price: quotePrice,
        priceType: "quote",  // quote snapshot, NOT fill price
        qty: roundedQty,
        notional: roundedQty * quotePrice,
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

      const pos = posRes.result.list.find(
        (p: any) => p.symbol === symbol && parseFloat(p.size) > 0,
      );

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
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
        return { success: false, orderId: "", price: quotePrice, priceType: "quote", qty: size, notional: size * quotePrice, error: res.retMsg };
      }

      const result: OrderResult = {
        success: true,
        orderId: res.result.orderId,
        price: quotePrice,
        priceType: "quote",
        qty: size,
        notional: size * quotePrice,
      };
      this.logger.logTrade("CLOSE_ALL", symbol, result);
      return result;

    } catch (err: any) {
      this.logger.logError(`closeAllLongs error: ${err.message}`);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: err.message };
    }
  }

  async queryOrder(symbol: string, orderLinkId: string): Promise<{ found: boolean; status: string; filledQty: number; avgPrice: number }> {
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
          const order = histRes.result.list[0];
          return {
            found: true,
            status: order.orderStatus,
            filledQty: parseFloat(order.cumExecQty || "0"),
            avgPrice: parseFloat(order.avgPrice || "0"),
          };
        }
        return { found: false, status: "not_found", filledQty: 0, avgPrice: 0 };
      }

      const order = res.result.list[0];
      return {
        found: true,
        status: order.orderStatus,
        filledQty: parseFloat(order.cumExecQty || "0"),
        avgPrice: parseFloat(order.avgPrice || "0"),
      };
    } catch (err: any) {
      this.logger.logError(`queryOrder error: ${err.message}`);
      return { found: false, status: "error", filledQty: 0, avgPrice: 0 };
    }
  }
}
