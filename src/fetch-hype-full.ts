import { fetchCandles } from "./fetch-candles";
import fs from "fs";
import path from "path";

async function main() {
  const start = new Date("2024-12-01").getTime();
  const end = Date.now();
  console.log("Fetching HYPEUSDT 5m from", new Date(start).toISOString().slice(0, 10), "to", new Date(end).toISOString().slice(0, 10));

  const candles = await fetchCandles("HYPEUSDT", "5", start, end);
  console.log("Got", candles.length, "candles");
  if (candles.length > 0) {
    console.log("From:", new Date(candles[0].timestamp).toISOString().slice(0, 10));
    console.log("To:", new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10));
  }

  const out = path.resolve(process.cwd(), "data/HYPEUSDT_5_full.json");
  console.log("Writing to", out, "...");
  const ws = fs.createWriteStream(out);
  ws.write("[");
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) ws.write(",");
    ws.write(JSON.stringify(candles[i]));
  }
  ws.write("]");
  await new Promise<void>((resolve) => ws.end(resolve));
  console.log("Saved to", out);
}

main().catch(e => console.error("Error:", e.message));
