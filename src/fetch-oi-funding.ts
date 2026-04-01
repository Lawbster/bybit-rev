import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// Fetch historical OI (1h) and Funding Rate (8h) from Bybit REST API
// Saves to data/{SYMBOL}_oi.json and data/{SYMBOL}_funding.json
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");

const SYMBOLS = [
  "HYPEUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "SUIUSDT",
  "SIRENUSDT",
  "LIGHTUSDT",
  "DUSKUSDT",
  "RIVERUSDT",
  "CUSDT",
  "PIPPINUSDT",
  "BLUAIUSDT",
  "STGUSDT",
  "VVVUSDT",
  "TAOUSDT",
];

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  return res.json();
}

// ── OI: paginate backwards from now ──
interface OiRow { timestamp: number; openInterest: number }

async function fetchOi(symbol: string): Promise<OiRow[]> {
  const all: OiRow[] = [];
  let cursor = Date.now();
  let requests = 0;

  process.stdout.write(`  ${symbol} OI: `);

  while (true) {
    const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=1h&limit=200&endTime=${cursor}`;
    const j = await fetchJson(url);
    requests++;

    if (j.retCode !== 0) {
      if (j.retMsg?.includes("Rate Limit")) {
        process.stdout.write("R");
        await sleep(2000);
        continue;
      }
      console.log(`API error: ${j.retMsg}`);
      break;
    }

    const list = j.result?.list;
    if (!list || list.length === 0) break;

    for (const r of list) {
      all.push({
        timestamp: Number(r.timestamp),
        openInterest: Number(r.openInterest),
      });
    }

    const oldest = Number(list[list.length - 1].timestamp);
    if (oldest >= cursor) break;
    cursor = oldest - 1;

    process.stdout.write(".");
    await sleep(250);
  }

  // Dedupe and sort ascending
  const seen = new Set<number>();
  const deduped = all.filter(r => {
    if (seen.has(r.timestamp)) return false;
    seen.add(r.timestamp);
    return true;
  });
  deduped.sort((a, b) => a.timestamp - b.timestamp);

  const first = deduped.length > 0 ? new Date(deduped[0].timestamp).toISOString().slice(0, 10) : "N/A";
  const last = deduped.length > 0 ? new Date(deduped[deduped.length - 1].timestamp).toISOString().slice(0, 10) : "N/A";
  console.log(` ${deduped.length} rows, ${first} → ${last} (${requests} reqs)`);

  return deduped;
}

// ── Funding: paginate backwards from now ──
interface FundingRow { timestamp: number; fundingRate: number }

async function fetchFunding(symbol: string): Promise<FundingRow[]> {
  const all: FundingRow[] = [];
  let cursor = Date.now();
  let requests = 0;

  process.stdout.write(`  ${symbol} Funding: `);

  while (true) {
    const url = `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}&limit=200&endTime=${cursor}`;
    const j = await fetchJson(url);
    requests++;

    if (j.retCode !== 0) {
      if (j.retMsg?.includes("Rate Limit")) {
        process.stdout.write("R");
        await sleep(2000);
        continue;
      }
      console.log(`API error: ${j.retMsg}`);
      break;
    }

    const list = j.result?.list;
    if (!list || list.length === 0) break;

    for (const r of list) {
      all.push({
        timestamp: Number(r.fundingRateTimestamp),
        fundingRate: Number(r.fundingRate),
      });
    }

    const oldest = Number(list[list.length - 1].fundingRateTimestamp);
    if (oldest >= cursor) break;
    cursor = oldest - 1;

    process.stdout.write(".");
    await sleep(250);
  }

  const seen = new Set<number>();
  const deduped = all.filter(r => {
    if (seen.has(r.timestamp)) return false;
    seen.add(r.timestamp);
    return true;
  });
  deduped.sort((a, b) => a.timestamp - b.timestamp);

  const first = deduped.length > 0 ? new Date(deduped[0].timestamp).toISOString().slice(0, 10) : "N/A";
  const last = deduped.length > 0 ? new Date(deduped[deduped.length - 1].timestamp).toISOString().slice(0, 10) : "N/A";
  console.log(` ${deduped.length} rows, ${first} → ${last} (${requests} reqs)`);

  return deduped;
}

async function main() {
  console.log("=".repeat(80));
  console.log("  Fetching historical OI + Funding for all tracked pairs");
  console.log("=".repeat(80));
  console.log();

  for (const symbol of SYMBOLS) {
    console.log(`── ${symbol} ──`);

    // Fetch OI
    const oi = await fetchOi(symbol);
    if (oi.length > 0) {
      const oiPath = path.join(DATA_DIR, `${symbol}_oi.json`);
      fs.writeFileSync(oiPath, JSON.stringify(oi));
      const sizeMb = (fs.statSync(oiPath).size / 1024 / 1024).toFixed(2);
      console.log(`    Saved ${oiPath} (${sizeMb} MB)`);
    }

    // Fetch Funding
    const funding = await fetchFunding(symbol);
    if (funding.length > 0) {
      const fundPath = path.join(DATA_DIR, `${symbol}_funding.json`);
      fs.writeFileSync(fundPath, JSON.stringify(funding));
      const sizeMb = (fs.statSync(fundPath).size / 1024 / 1024).toFixed(2);
      console.log(`    Saved ${fundPath} (${sizeMb} MB)`);
    }

    console.log();
  }

  console.log("Done!");
}

main().catch(console.error);
