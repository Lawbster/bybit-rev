import { WebsocketClient } from "bybit-api";
import { EventEmitter } from "events";

export interface LiveCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  interval: string;
  confirmed: boolean; // true when candle is closed
}

export interface LiveTrade {
  timestamp: number;
  symbol: string;
  side: "Buy" | "Sell";
  price: number;
  size: number;
  isBlockTrade: boolean;
}

export interface LiveOrderbook {
  timestamp: number;
  symbol: string;
  bids: [string, string][]; // [price, qty][]
  asks: [string, string][];
}

export interface LiveTicker {
  symbol: string;
  lastPrice: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  openInterestValue: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
  turnover24h: number;
  bid1Price: number;
  bid1Size: number;
  ask1Price: number;
  ask1Size: number;
}

export interface OrderbookMetrics {
  bidDepthUsdt: number;    // total USDT on bid side
  askDepthUsdt: number;    // total USDT on ask side
  imbalance: number;       // (bidDepth - askDepth) / (bidDepth + askDepth), -1 to 1
  spread: number;          // ask1 - bid1
  spreadPct: number;       // spread as % of mid
  bidWall: number;         // largest single bid in USDT
  askWall: number;         // largest single ask in USDT
  thinSide: "bid" | "ask" | "balanced";
}

/**
 * Real-time market data feed for a single symbol.
 * Emits: 'candle', 'trade', 'orderbook', 'ticker', 'ob-metrics'
 */
export class LiveFeed extends EventEmitter {
  private ws: WebsocketClient;
  private symbol: string;

  constructor(symbol: string = "SIRENUSDT") {
    super();
    this.symbol = symbol;
    this.ws = new WebsocketClient({ market: "v5" });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.ws.on("update", (data: any) => {
      const topic = data.topic as string;

      if (topic.startsWith("kline.")) {
        this.handleKline(data);
      } else if (topic.startsWith("publicTrade.")) {
        this.handleTrade(data);
      } else if (topic.startsWith("orderbook.")) {
        this.handleOrderbook(data);
      } else if (topic.startsWith("tickers.")) {
        this.handleTicker(data);
      }
    });

    (this.ws as any).on("error", (err: any) => {
      console.error("[WS] Error:", err);
    });

    (this.ws as any).on("open", (evt: any) => {
      console.log(`[WS] Connected: ${evt?.wsKey || "unknown"}`);
    });

    (this.ws as any).on("reconnect", () => {
      console.log("[WS] Reconnecting...");
    });
  }

  start() {
    const sym = this.symbol;
    console.log(`[WS] Subscribing to ${sym} streams...`);

    this.ws.subscribeV5(
      [
        `kline.1.${sym}`,       // 1m candles
        `kline.5.${sym}`,       // 5m candles
        `publicTrade.${sym}`,   // real-time trades
        `orderbook.50.${sym}`,  // orderbook depth 50
        `tickers.${sym}`,       // ticker + funding
      ],
      "linear"
    );
  }

  stop() {
    this.ws.closeAll();
  }

  private handleKline(data: any) {
    for (const k of data.data) {
      const candle: LiveCandle = {
        timestamp: Number(k.start),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
        turnover: Number(k.turnover),
        interval: k.interval,
        confirmed: k.confirm === true,
      };
      this.emit("candle", candle);
    }
  }

  private handleTrade(data: any) {
    for (const t of data.data) {
      const trade: LiveTrade = {
        timestamp: Number(t.T),
        symbol: t.s,
        side: t.S,
        price: Number(t.p),
        size: Number(t.v),
        isBlockTrade: t.BT === true,
      };
      this.emit("trade", trade);
    }
  }

  private handleOrderbook(data: any) {
    const ob: LiveOrderbook = {
      timestamp: Number(data.ts),
      symbol: this.symbol,
      bids: data.data.b || [],
      asks: data.data.a || [],
    };
    this.emit("orderbook", ob);

    // Compute orderbook metrics
    const metrics = this.computeObMetrics(ob);
    this.emit("ob-metrics", metrics);
  }

  private handleTicker(data: any) {
    const d = data.data;
    const ticker: Partial<LiveTicker> = {
      symbol: d.symbol,
    };

    // Ticker updates are partial — only changed fields are sent
    if (d.lastPrice) ticker.lastPrice = Number(d.lastPrice);
    if (d.markPrice) ticker.markPrice = Number(d.markPrice);
    if (d.indexPrice) ticker.indexPrice = Number(d.indexPrice);
    if (d.fundingRate) ticker.fundingRate = Number(d.fundingRate);
    if (d.nextFundingTime) ticker.nextFundingTime = Number(d.nextFundingTime);
    if (d.openInterest) ticker.openInterest = Number(d.openInterest);
    if (d.openInterestValue) ticker.openInterestValue = Number(d.openInterestValue);
    if (d.price24hPcnt) ticker.price24hPcnt = Number(d.price24hPcnt);
    if (d.highPrice24h) ticker.highPrice24h = Number(d.highPrice24h);
    if (d.lowPrice24h) ticker.lowPrice24h = Number(d.lowPrice24h);
    if (d.volume24h) ticker.volume24h = Number(d.volume24h);
    if (d.turnover24h) ticker.turnover24h = Number(d.turnover24h);
    if (d.bid1Price) ticker.bid1Price = Number(d.bid1Price);
    if (d.bid1Size) ticker.bid1Size = Number(d.bid1Size);
    if (d.ask1Price) ticker.ask1Price = Number(d.ask1Price);
    if (d.ask1Size) ticker.ask1Size = Number(d.ask1Size);

    this.emit("ticker", ticker);
  }

  private computeObMetrics(ob: LiveOrderbook): OrderbookMetrics {
    let bidDepth = 0;
    let askDepth = 0;
    let bidWall = 0;
    let askWall = 0;

    for (const [price, qty] of ob.bids) {
      const usdt = Number(price) * Number(qty);
      bidDepth += usdt;
      if (usdt > bidWall) bidWall = usdt;
    }

    for (const [price, qty] of ob.asks) {
      const usdt = Number(price) * Number(qty);
      askDepth += usdt;
      if (usdt > askWall) askWall = usdt;
    }

    const total = bidDepth + askDepth;
    const imbalance = total > 0 ? (bidDepth - askDepth) / total : 0;

    const bid1 = ob.bids.length > 0 ? Number(ob.bids[0][0]) : 0;
    const ask1 = ob.asks.length > 0 ? Number(ob.asks[0][0]) : 0;
    const mid = (bid1 + ask1) / 2;
    const spread = ask1 - bid1;

    return {
      bidDepthUsdt: bidDepth,
      askDepthUsdt: askDepth,
      imbalance,
      spread,
      spreadPct: mid > 0 ? (spread / mid) * 100 : 0,
      bidWall,
      askWall,
      thinSide: Math.abs(imbalance) < 0.1 ? "balanced" : imbalance > 0 ? "ask" : "bid",
    };
  }
}
