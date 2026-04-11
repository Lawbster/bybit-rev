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
  // Partial reduce: market sell `qty` of the long side (reduceOnly).
  reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult>;
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

  // Account
  getWalletEquity(): Promise<number>;

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

      const pos = posRes.result.list.find(
        (p: any) => p.symbol === symbol && p.side === "Buy" && parseFloat(p.size) > 0,
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
        positionIdx: 1,   // hedge mode: buy side close
        reduceOnly: true,
        orderLinkId,
      });

      if (res.retCode !== 0) {
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

  async reduceLongQty(symbol: string, qty: number, orderLinkId: string): Promise<OrderResult> {
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
