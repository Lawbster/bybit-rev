import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  bybit: {
    apiKey: process.env.BYBIT_API_KEY || "",
    apiSecret: process.env.BYBIT_API_SECRET || "",
  },
  // The pairs we're tracking from the copy trader
  pairs: [
    "LIGHTUSDT",
    "SIRENUSDT",
    "DUSKUSDT",
    "CUSDT",
    "RIVERUSDT",
    "PIPPINUSDT",
    "VVVUSDT",
  ] as const,
};

export type TrackedPair = (typeof config.pairs)[number];
