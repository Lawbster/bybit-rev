// Bybit spot top-of-book feed for perp-spot basis research (Tier 2).
// Subscribes to orderbook.1.{symbol} on category=spot to get bid/ask/mid.
// Bybit's spot ticker doesn't expose bid/ask, so orderbook.1 is the canonical source.

import { WebsocketClient } from "bybit-api";
import { EventEmitter } from "events";

export interface SpotQuote {
  symbol: string;
  exchangeTimestamp: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  mid: number;
}

/**
 * Per-symbol spot top-of-book feed. Emits 'spot-quote' on every update.
 */
export class SpotFeed extends EventEmitter {
  private ws: WebsocketClient;
  private symbol: string;

  constructor(symbol: string) {
    super();
    this.symbol = symbol;
    this.ws = new WebsocketClient({ market: "v5" });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.ws.on("update", (data: any) => {
      const topic = data.topic as string;
      if (!topic?.startsWith("orderbook.1.")) return;
      const bids: [string, string][] = data.data?.b || [];
      const asks: [string, string][] = data.data?.a || [];
      // orderbook.1 sometimes sends only one side on a delta — only emit when we have both
      const bidPrice = bids.length > 0 ? Number(bids[0][0]) : 0;
      const bidQty = bids.length > 0 ? Number(bids[0][1]) : 0;
      const askPrice = asks.length > 0 ? Number(asks[0][0]) : 0;
      const askQty = asks.length > 0 ? Number(asks[0][1]) : 0;
      if (bidPrice <= 0 || askPrice <= 0) return;
      const quote: SpotQuote = {
        symbol: this.symbol,
        exchangeTimestamp: Number(data.ts),
        bidPrice,
        bidQty,
        askPrice,
        askQty,
        mid: (bidPrice + askPrice) / 2,
      };
      this.emit("spot-quote", quote);
    });

    (this.ws as any).on("error", (err: any) => {
      console.error(`[spot-feed:${this.symbol}] error:`, err?.message ?? err);
    });
    (this.ws as any).on("open", (evt: any) => {
      console.log(`[spot-feed:${this.symbol}] connected: ${evt?.wsKey || "spot"}`);
    });
  }

  start() {
    this.ws.subscribeV5([`orderbook.1.${this.symbol}`], "spot");
  }

  stop() {
    this.ws.closeAll();
  }
}
