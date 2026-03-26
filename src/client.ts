import { RestClientV5 } from "bybit-api";
import { config } from "./config";

// Public client — no auth needed for market data
export const publicClient = new RestClientV5();

// Authenticated client — for trade history, positions, orders
export const authClient = new RestClientV5({
  key: config.bybit.apiKey,
  secret: config.bybit.apiSecret,
});
