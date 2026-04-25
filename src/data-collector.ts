import fs from "fs";
import path from "path";
import https from "https";
import { LiveFeed, LiveCandle, LiveTrade, LiveTicker, OrderbookMetrics } from "./live-feed";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, computeRsi, computeRoc, IndicatorSnapshot } from "./indicators";

const SYMBOLS = [
  "HYPEUSDT",
  "SUIUSDT",
  "FARTCOINUSDT",
];

// Binance USDM perp polling — venue divergence research (vs Bybit ticker stream).
// Public endpoints, no auth required. Polls every 60s per symbol = 3 sym × 2 calls = 6 req/min.
// Binance USDM rate limit is 2400 weight/min, each call is weight 1.
const BINANCE_POLL_MS = 60_000;
const BINANCE_API = "https://fapi.binance.com";

const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SNAPSHOT_INTERVAL = 60000; // 1 minute

interface SymbolState {
  symbol: string;
  logFile: string;
  candleFile: string;
  oiLiveFile: string;
  fundingLiveFile: string;
  price: number;
  ticker: Partial<LiveTicker>;
  ob: OrderbookMetrics | null;
  snap: IndicatorSnapshot | null;
  candleBuffer: Candle[];
  live5mCandles: Candle[];
  live5mStart: number;
  flow: { buyVol: number; sellVol: number; buyCount: number; sellCount: number; start: number };
  kline1hCloses: number[];  // rolling buffer of confirmed 1h closes (max 30)
  rsi1h: number | null;
  roc5_1h: number | null;
}

function fmt(n: number, d = 2): string {
  return n.toFixed(d);
}

function time(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function writeSnapshot(state: SymbolState, event: string, extra?: Record<string, any>) {
  const row: Record<string, any> = {
    ts: new Date().toISOString(),
    event,
    symbol: state.symbol,
    price: state.price,
  };

  // Ticker
  if (state.ticker.fundingRate !== undefined) row.fundingRate = state.ticker.fundingRate;
  if (state.ticker.openInterestValue !== undefined) row.openInterest = state.ticker.openInterestValue;
  if (state.ticker.price24hPcnt !== undefined) row.price24hPcnt = state.ticker.price24hPcnt;

  // Orderbook
  if (state.ob) {
    row.ob = {
      bidDepth: state.ob.bidDepthUsdt,
      askDepth: state.ob.askDepthUsdt,
      imbalance: state.ob.imbalance,
      spread: state.ob.spreadPct,
      bidWall: state.ob.bidWall,
      askWall: state.ob.askWall,
      thinSide: state.ob.thinSide,
    };
  }

  // Indicators
  if (state.snap) {
    row.ind = {
      rsi: state.snap.rsi14,
      stochK: state.snap.stochK,
      stochD: state.snap.stochD,
      bbPos: state.snap.bbPosition,
      bbWidth: state.snap.bbWidth,
      atrPct: state.snap.atrPercent,
      volRatio: state.snap.volumeRatio,
      emaTrend: state.snap.emaTrend,
      roc5: state.snap.roc5,
      roc20: state.snap.roc20,
      macdHist: state.snap.macdHist,
      priceVsEma50: state.snap.priceVsEma50,
      rsi1h: state.rsi1h,
      roc5_1h: state.roc5_1h,
    };
  }

  // Trade flow since last snapshot
  row.flow = { ...state.flow };

  if (extra) row.detail = extra;

  fs.appendFileSync(state.logFile, JSON.stringify(row) + "\n");

  const tsMs = Date.parse(row.ts);
  if (state.ticker.openInterest !== undefined || state.ticker.openInterestValue !== undefined) {
    fs.appendFileSync(state.oiLiveFile, JSON.stringify({
      ts: row.ts,
      timestamp: tsMs,
      symbol: state.symbol,
      openInterest: state.ticker.openInterest ?? null,
      openInterestValue: state.ticker.openInterestValue ?? null,
      source: "ticker",
    }) + "\n");
  }

  if (state.ticker.fundingRate !== undefined) {
    fs.appendFileSync(state.fundingLiveFile, JSON.stringify({
      ts: row.ts,
      timestamp: tsMs,
      symbol: state.symbol,
      fundingRate: state.ticker.fundingRate,
      nextFundingTime: state.ticker.nextFundingTime ?? null,
      source: "ticker",
    }) + "\n");
  }
}

function onCandle(state: SymbolState, c: LiveCandle) {
  // 1h candle — maintain RSI buffer
  if (c.interval === "60" && c.confirmed) {
    state.kline1hCloses.push(c.close);
    if (state.kline1hCloses.length > 30) state.kline1hCloses.shift();
    state.rsi1h = computeRsi(state.kline1hCloses);
    state.roc5_1h = computeRoc(state.kline1hCloses);
    return;
  }

  if (c.interval !== "1") return;

  // Persist every confirmed 1m candle to JSONL
  if (c.confirmed) {
    const row = { ts: c.timestamp, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume, t: c.turnover };
    fs.appendFileSync(state.candleFile, JSON.stringify(row) + "\n");
  }

  if (!c.confirmed) return;

  const candle: Candle = {
    timestamp: c.timestamp, open: c.open, high: c.high,
    low: c.low, close: c.close, volume: c.volume, turnover: c.turnover,
  };

  const winStart = Math.floor(candle.timestamp / 300000) * 300000;
  if (winStart !== state.live5mStart) {
    state.live5mCandles = [candle];
    state.live5mStart = winStart;
  } else {
    state.live5mCandles.push(candle);
  }

  const cds = state.live5mCandles;
  const live5m: Candle = {
    timestamp: state.live5mStart,
    open: cds[0].open,
    high: Math.max(...cds.map((x) => x.high)),
    low: Math.min(...cds.map((x) => x.low)),
    close: cds[cds.length - 1].close,
    volume: cds.reduce((s, x) => s + x.volume, 0),
    turnover: cds.reduce((s, x) => s + x.turnover, 0),
  };

  const li = state.candleBuffer.length - 1;
  if (li >= 0 && state.candleBuffer[li].timestamp === state.live5mStart) {
    state.candleBuffer[li] = live5m;
  } else {
    state.candleBuffer.push(live5m);
  }
  if (state.candleBuffer.length > 300) {
    state.candleBuffer = state.candleBuffer.slice(-300);
  }
  if (state.candleBuffer.length >= 210) {
    const indicators = computeIndicators(state.candleBuffer);
    const lastTs = state.candleBuffer[state.candleBuffer.length - 1].timestamp;
    state.snap = getSnapshotAt(indicators, lastTs) || null;
  }
}

// ── Binance public REST helpers ──────────────────────────────────
function binanceGet<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(`${BINANCE_API}${path}`, { method: "GET" }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Binance HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data) as T); }
        catch (e) { reject(new Error(`Binance JSON parse: ${(e as Error).message}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("Binance request timeout")));
    req.end();
  });
}

interface BinancePoller {
  symbol: string;
  oiFile: string;
  fundingFile: string;
  unsupported: boolean;  // true if Binance doesn't list this symbol
  intervalId?: NodeJS.Timeout;
}

async function pollBinanceVenue(poller: BinancePoller): Promise<void> {
  if (poller.unsupported) return;
  try {
    // Parallel fetch OI + premium index (funding)
    const [oi, premium] = await Promise.all([
      binanceGet<{ symbol: string; openInterest: string; time: number }>(`/fapi/v1/openInterest?symbol=${poller.symbol}`),
      binanceGet<{ symbol: string; markPrice: string; lastFundingRate: string; nextFundingTime: number; time: number }>(`/fapi/v1/premiumIndex?symbol=${poller.symbol}`),
    ]);
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    const oiBase = parseFloat(oi.openInterest);
    const markPrice = parseFloat(premium.markPrice);
    const oiUsd = Number.isFinite(oiBase) && Number.isFinite(markPrice) ? oiBase * markPrice : null;

    fs.appendFileSync(poller.oiFile, JSON.stringify({
      ts,
      timestamp: tsMs,
      symbol: poller.symbol,
      venue: "binance",
      openInterest: oiBase,
      openInterestValue: oiUsd,
      markPrice,
      source: "rest_poll",
    }) + "\n");

    fs.appendFileSync(poller.fundingFile, JSON.stringify({
      ts,
      timestamp: tsMs,
      symbol: poller.symbol,
      venue: "binance",
      fundingRate: parseFloat(premium.lastFundingRate),
      nextFundingTime: premium.nextFundingTime,
      markPrice,
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    const msg = err.message || String(err);
    // -1121 = invalid symbol on Binance — disable future polls for this symbol
    if (msg.includes("-1121") || msg.includes("Invalid symbol")) {
      console.log(`  [binance] ${poller.symbol}: not listed on Binance USDM — disabling poller`);
      poller.unsupported = true;
      if (poller.intervalId) clearInterval(poller.intervalId);
      return;
    }
    // Other errors (network, rate limit, etc.) — log + continue
    console.error(`[binance] ${poller.symbol} poll failed: ${msg}`);
  }
}

function startBinancePoller(symbol: string): BinancePoller {
  const poller: BinancePoller = {
    symbol,
    oiFile: path.join(DATA_DIR, `${symbol}_oi_live_binance.jsonl`),
    fundingFile: path.join(DATA_DIR, `${symbol}_funding_live_binance.jsonl`),
    unsupported: false,
  };
  // Initial poll immediately, then on interval
  pollBinanceVenue(poller);
  poller.intervalId = setInterval(() => pollBinanceVenue(poller), BINANCE_POLL_MS);
  return poller;
}

function startSymbol(symbol: string): SymbolState {
  const state: SymbolState = {
    symbol,
    logFile: path.join(DATA_DIR, `${symbol}_market.jsonl`),
    candleFile: path.join(DATA_DIR, `${symbol}_1m.jsonl`),
    oiLiveFile: path.join(DATA_DIR, `${symbol}_oi_live.jsonl`),
    fundingLiveFile: path.join(DATA_DIR, `${symbol}_funding_live.jsonl`),
    price: 0,
    ticker: {},
    ob: null,
    snap: null,
    candleBuffer: [],
    live5mCandles: [],
    live5mStart: 0,
    flow: { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() },
    kline1hCloses: [],
    rsi1h: null,
    roc5_1h: null,
  };

  // Warmup from historical candles if available
  const historical = loadCandles(symbol, "5");
  if (historical.length > 0) {
    state.candleBuffer = historical.slice(-300);
    const indicators = computeIndicators(state.candleBuffer);
    const lastTs = state.candleBuffer[state.candleBuffer.length - 1].timestamp;
    state.snap = getSnapshotAt(indicators, lastTs) || null;

    // Build 1h closes from 5m data for RSI-1h warmup
    const H1 = 3600000;
    const h1Map = new Map<number, number>();
    for (const c of historical) {
      const bar = Math.floor(c.timestamp / H1) * H1;
      h1Map.set(bar, c.close); // last 5m close within each 1h bar
    }
    const h1Closes = [...h1Map.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
    state.kline1hCloses = h1Closes.slice(-30);
    state.rsi1h = computeRsi(state.kline1hCloses);
    state.roc5_1h = computeRoc(state.kline1hCloses);

    console.log(`  ${symbol}: warmed ${state.candleBuffer.length} candles, 1h RSI=${state.rsi1h?.toFixed(1) ?? "n/a"}`);
  } else {
    console.log(`  ${symbol}: no historical data, warming from live (needs ~210 candles)`);
  }

  // Connect WebSocket
  const feed = new LiveFeed(symbol);

  feed.on("candle", (c: LiveCandle) => onCandle(state, c));

  feed.on("ticker", (t: Partial<LiveTicker>) => {
    state.ticker = { ...state.ticker, ...t };
    if (t.lastPrice) state.price = t.lastPrice;
  });

  feed.on("ob-metrics", (m: OrderbookMetrics) => { state.ob = m; });

  feed.on("trade", (t: LiveTrade) => {
    if (t.side === "Buy") { state.flow.buyVol += t.size * t.price; state.flow.buyCount++; }
    else { state.flow.sellVol += t.size * t.price; state.flow.sellCount++; }
  });

  feed.start();

  // Periodic snapshot every 60s
  setInterval(() => {
    if (state.price > 0) {
      writeSnapshot(state, "periodic");
      state.flow = { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() };
    }
  }, SNAPSHOT_INTERVAL);

  return state;
}

async function main() {
  console.log(`\n=== DATA COLLECTOR — ${SYMBOLS.length} symbols ===`);
  console.log(`Snapshot interval: ${SNAPSHOT_INTERVAL / 1000}s`);
  console.log(`Output: ${DATA_DIR}/{SYMBOL}_market.jsonl\n`);

  console.log("Warming up...");
  const states = SYMBOLS.map(startSymbol);

  // Binance OI/funding pollers — venue divergence research data
  console.log("Starting Binance USDM pollers (60s interval)...");
  const binancePollers = SYMBOLS.map(startBinancePoller);

  // Status line every 60s
  setInterval(() => {
    const active = states.filter((s) => s.price > 0);
    const lines = states.map((s) => {
      const p = s.price > 0 ? `$${fmt(s.price, 5)}` : "---";
      const rsi = s.snap ? fmt(s.snap.rsi14) : "---";
      const trend = s.snap?.emaTrend || "---";
      const logSize = fs.existsSync(s.logFile)
        ? `${(fs.statSync(s.logFile).size / 1024).toFixed(0)}kb`
        : "0kb";
      return `  ${s.symbol.padEnd(14)} ${p.padStart(12)} RSI:${rsi.padStart(6)} ${trend.padEnd(7)} [${logSize}]`;
    });
    console.log(`\n[${time()}] ${active.length}/${states.length} active`);
    lines.forEach((l) => console.log(l));
  }, 60000);

  console.log(`\n[${time()}] Collector running. ${SYMBOLS.length} WebSocket feeds + ${binancePollers.length} Binance pollers active.`);
  console.log("Press Ctrl+C to stop\n");
}

main().catch(console.error);
