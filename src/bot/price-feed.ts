import { WebsocketClient } from "bybit-api";
import { EventEmitter } from "events";

// ─────────────────────────────────────────────
// WebSocket price feed for TP detection
// Emits 'price' on every ticker update with bid1
// ─────────────────────────────────────────────

export interface PriceUpdate {
  symbol: string;
  lastPrice: number;
  bid1: number;       // best bid — use for long TP (executable exit price)
  ask1: number;       // best ask
  fundingRate: number;       // current funding rate (per 8h interval)
  nextFundingTime: number;   // ms timestamp of next funding settlement
  timestamp: number;
}

export class PriceFeed extends EventEmitter {
  private ws: WebsocketClient;
  private symbol: string;
  private _lastUpdate: PriceUpdate | null = null;
  private _connected = false;

  constructor(symbol: string) {
    super();
    this.symbol = symbol;
    this.ws = new WebsocketClient({ market: "v5" });
    this.setup();
  }

  private setup() {
    this.ws.on("update", (data: any) => {
      const topic = data.topic as string;
      if (!topic.startsWith("tickers.")) return;

      const d = data.data;
      // Ticker updates are partial — merge with last known state
      const prev = this._lastUpdate || {
        symbol: this.symbol,
        lastPrice: 0,
        bid1: 0,
        ask1: 0,
        fundingRate: 0,
        nextFundingTime: 0,
        timestamp: Date.now(),
      };

      const update: PriceUpdate = {
        symbol: d.symbol || prev.symbol,
        lastPrice: d.lastPrice ? parseFloat(d.lastPrice) : prev.lastPrice,
        bid1: d.bid1Price ? parseFloat(d.bid1Price) : prev.bid1,
        ask1: d.ask1Price ? parseFloat(d.ask1Price) : prev.ask1,
        fundingRate: d.fundingRate ? parseFloat(d.fundingRate) : prev.fundingRate,
        nextFundingTime: d.nextFundingTime ? Number(d.nextFundingTime) : prev.nextFundingTime,
        timestamp: Date.now(),
      };

      this._lastUpdate = update;

      // Only emit once we have a valid bid
      if (update.bid1 > 0) {
        this.emit("price", update);
      }
    });

    (this.ws as any).on("open", () => {
      this._connected = true;
      this.emit("connected");
    });

    (this.ws as any).on("error", (err: any) => {
      this.emit("error", err);
    });

    (this.ws as any).on("reconnect", () => {
      this.emit("reconnecting");
    });
  }

  start(): void {
    this.ws.subscribeV5([`tickers.${this.symbol}`], "linear");
  }

  stop(): void {
    this.ws.closeAll();
    this._connected = false;
  }

  get lastUpdate(): PriceUpdate | null {
    return this._lastUpdate;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Convenience: wait for first price update with timeout */
  waitForPrice(timeoutMs: number = 10000): Promise<PriceUpdate> {
    return new Promise((resolve, reject) => {
      if (this._lastUpdate && this._lastUpdate.bid1 > 0) {
        return resolve(this._lastUpdate);
      }

      const timer = setTimeout(() => {
        this.removeListener("price", handler);
        reject(new Error(`No price update within ${timeoutMs}ms`));
      }, timeoutMs);

      const handler = (update: PriceUpdate) => {
        clearTimeout(timer);
        resolve(update);
      };

      this.once("price", handler);
    });
  }
}
