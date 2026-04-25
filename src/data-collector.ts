import fs from "fs";
import path from "path";
import https from "https";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket: any = require("ws");
type WSInstance = any;
import { LiveFeed, LiveCandle, LiveTrade, LiveTicker, LiveLiquidation, OrderbookMetrics } from "./live-feed";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, computeRsi, computeRoc, IndicatorSnapshot } from "./indicators";

const SYMBOLS = [
  "HYPEUSDT",
  "SUIUSDT",
  "FARTCOINUSDT",
  "SOLUSDT",
  "BTCUSDT",  // macro risk anchor
  "ETHUSDT",  // macro risk anchor
];

// Cadences and endpoints
const BINANCE_POLL_MS = 60_000;          // OI + funding (60s)
const LSRATIO_POLL_MS = 5 * 60_000;       // long/short ratio + taker volume (5min, matches venue granularity)
const BINANCE_API = "https://fapi.binance.com";
const BYBIT_API = "https://api.bybit.com";


const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SNAPSHOT_INTERVAL = 60000; // 1 minute

interface SymbolState {
  symbol: string;
  logFile: string;
  candleFile: string;
  oiLiveFile: string;
  fundingLiveFile: string;
  liquidationsFile: string;
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
  const markPrice = state.ticker.markPrice ?? null;
  const indexPrice = state.ticker.indexPrice ?? null;
  const markIndexSpreadPct = (markPrice !== null && indexPrice !== null && indexPrice !== 0)
    ? ((markPrice - indexPrice) / indexPrice) * 100
    : null;
  if (state.ticker.openInterest !== undefined || state.ticker.openInterestValue !== undefined) {
    fs.appendFileSync(state.oiLiveFile, JSON.stringify({
      ts: row.ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,  // Bybit ticker ts not preserved per-snapshot; collector receive time
      symbol: state.symbol,
      venue: "bybit",
      openInterest: state.ticker.openInterest ?? null,
      openInterestValue: state.ticker.openInterestValue ?? null,
      markPrice,
      indexPrice,
      markIndexSpreadPct,
      source: "ticker",
    }) + "\n");
  }

  if (state.ticker.fundingRate !== undefined) {
    fs.appendFileSync(state.fundingLiveFile, JSON.stringify({
      ts: row.ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      symbol: state.symbol,
      venue: "bybit",
      fundingRate: state.ticker.fundingRate,
      nextFundingTime: state.ticker.nextFundingTime ?? null,
      markPrice,
      indexPrice,
      markIndexSpreadPct,
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

// ── Public REST helpers (no auth required) ──────────────────────────────────
function httpGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET" }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data) as T); }
        catch (e) { reject(new Error(`JSON parse: ${(e as Error).message}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Request timeout")));
    req.end();
  });
}

function binanceGet<T>(path: string): Promise<T> {
  return httpGet<T>(`${BINANCE_API}${path}`);
}

function bybitGet<T>(path: string): Promise<T> {
  return httpGet<T>(`${BYBIT_API}${path}`);
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
      exchangeTimestamp: oi.time,
      symbol: poller.symbol,
      venue: "binance",
      openInterest: oiBase,
      openInterestValue: oiUsd,
      markPrice,
      source: "rest_poll",
    }) + "\n");

    const indexPrice = parseFloat((premium as any).indexPrice);
    const markIndexSpreadPct = (Number.isFinite(markPrice) && Number.isFinite(indexPrice) && indexPrice !== 0)
      ? ((markPrice - indexPrice) / indexPrice) * 100
      : null;
    fs.appendFileSync(poller.fundingFile, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: premium.time,
      symbol: poller.symbol,
      venue: "binance",
      fundingRate: parseFloat(premium.lastFundingRate),
      nextFundingTime: premium.nextFundingTime,
      markPrice,
      indexPrice: Number.isFinite(indexPrice) ? indexPrice : null,
      markIndexSpreadPct,
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

// ── Long/short ratio pollers ──────────────────────────────────────
// Bybit's account-ratio is all-trader-account (per docs). Cross-venue comparable
// to Binance globalLongShortAccountRatio. Binance top-trader variants are kept
// as Binance-only "smart money" features.

interface RatioPoller {
  symbol: string;
  bybitFile: string;
  binanceFile: string;
  unsupportedBybit: boolean;
  unsupportedBinance: boolean;
  intervalId?: NodeJS.Timeout;
}

async function pollBybitLSRatio(poller: RatioPoller): Promise<void> {
  if (poller.unsupportedBybit) return;
  try {
    const r = await bybitGet<{ retCode: number; result?: { list: any[] } }>(
      `/v5/market/account-ratio?category=linear&symbol=${poller.symbol}&period=5min&limit=1`
    );
    if (r.retCode !== 0 || !r.result?.list?.length) return;
    const e = r.result.list[0];
    const ts = new Date().toISOString();
    fs.appendFileSync(poller.bybitFile, JSON.stringify({
      ts,
      timestamp: Date.parse(ts),
      exchangeTimestamp: Number(e.timestamp),
      symbol: poller.symbol,
      venue: "bybit",
      period: "5min",
      ratioType: "all_trader_account",
      buyRatio: parseFloat(e.buyRatio),
      sellRatio: parseFloat(e.sellRatio),
      longShortRatio: parseFloat(e.buyRatio) / parseFloat(e.sellRatio),
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("400")) {
      console.log(`  [bybit-ls] ${poller.symbol}: not supported — disabling`);
      poller.unsupportedBybit = true;
    } else {
      console.error(`[bybit-ls] ${poller.symbol}: ${msg}`);
    }
  }
}

const BINANCE_RATIO_TYPES = [
  { endpoint: "topLongShortAccountRatio", label: "top_trader_account" },
  { endpoint: "topLongShortPositionRatio", label: "top_trader_position" },
  { endpoint: "globalLongShortAccountRatio", label: "global_account" },
];

async function pollBinanceLSRatio(poller: RatioPoller): Promise<void> {
  if (poller.unsupportedBinance) return;
  for (const rt of BINANCE_RATIO_TYPES) {
    try {
      const arr = await binanceGet<any[]>(`/futures/data/${rt.endpoint}?symbol=${poller.symbol}&period=5m&limit=1`);
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const e = arr[0];
      const ts = new Date().toISOString();
      fs.appendFileSync(poller.binanceFile, JSON.stringify({
        ts,
        timestamp: Date.parse(ts),
        exchangeTimestamp: e.timestamp,
        symbol: poller.symbol,
        venue: "binance",
        period: "5m",
        ratioType: rt.label,
        longShortRatio: parseFloat(e.longShortRatio),
        longAccount: e.longAccount !== undefined ? parseFloat(e.longAccount) : null,
        shortAccount: e.shortAccount !== undefined ? parseFloat(e.shortAccount) : null,
        longPosition: e.longPosition !== undefined ? parseFloat(e.longPosition) : null,
        shortPosition: e.shortPosition !== undefined ? parseFloat(e.shortPosition) : null,
        source: "rest_poll",
      }) + "\n");
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes("Invalid symbol") || msg.includes("-1121")) {
        poller.unsupportedBinance = true;
        return;
      }
      console.error(`[binance-ls] ${poller.symbol}/${rt.endpoint}: ${msg}`);
    }
  }
}

function startRatioPoller(symbol: string): RatioPoller {
  const poller: RatioPoller = {
    symbol,
    bybitFile: path.join(DATA_DIR, `${symbol}_lsratio_bybit.jsonl`),
    binanceFile: path.join(DATA_DIR, `${symbol}_lsratio_binance.jsonl`),
    unsupportedBybit: false,
    unsupportedBinance: false,
  };
  // Backfill first if files don't exist (one-shot, available history depth varies per venue)
  backfillRatios(poller).catch(err => console.error(`[backfill-ls] ${symbol}: ${err.message}`));
  // Then live polling
  setTimeout(() => {
    pollBybitLSRatio(poller);
    pollBinanceLSRatio(poller);
  }, 5000);  // delay first poll so backfill writes appear first
  poller.intervalId = setInterval(() => {
    pollBybitLSRatio(poller);
    pollBinanceLSRatio(poller);
  }, LSRATIO_POLL_MS);
  return poller;
}

// ── Binance taker buy/sell volume poller (Codex Tier 1.5) ──────────
interface TakerPoller {
  symbol: string;
  file: string;
  unsupported: boolean;
  intervalId?: NodeJS.Timeout;
}

async function pollBinanceTaker(poller: TakerPoller): Promise<void> {
  if (poller.unsupported) return;
  try {
    const arr = await binanceGet<any[]>(`/futures/data/takerlongshortRatio?symbol=${poller.symbol}&period=5m&limit=1`);
    if (!Array.isArray(arr) || arr.length === 0) return;
    const e = arr[0];
    const ts = new Date().toISOString();
    fs.appendFileSync(poller.file, JSON.stringify({
      ts,
      timestamp: Date.parse(ts),
      exchangeTimestamp: e.timestamp,
      symbol: poller.symbol,
      venue: "binance",
      period: "5m",
      buySellRatio: parseFloat(e.buySellRatio),
      buyVol: parseFloat(e.buyVol),
      sellVol: parseFloat(e.sellVol),
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("Invalid symbol") || msg.includes("-1121")) {
      poller.unsupported = true;
      return;
    }
    console.error(`[binance-taker] ${poller.symbol}: ${msg}`);
  }
}

function startTakerPoller(symbol: string): TakerPoller {
  const poller: TakerPoller = {
    symbol,
    file: path.join(DATA_DIR, `${symbol}_taker_binance.jsonl`),
    unsupported: false,
  };
  backfillBinanceTaker(poller).catch(err => console.error(`[backfill-taker] ${symbol}: ${err.message}`));
  setTimeout(() => pollBinanceTaker(poller), 5000);
  poller.intervalId = setInterval(() => pollBinanceTaker(poller), LSRATIO_POLL_MS);
  return poller;
}

// ── One-shot backfills ────────────────────────────────────────────
// Run only if file doesn't exist (idempotent across restarts).

async function backfillRatios(poller: RatioPoller): Promise<void> {
  // Bybit account-ratio: docs say back to 2020-07-20, 5min granularity. Pull 30 days = 8640 rows max,
  // Bybit limit is 500/page. So loop pages with `cursor`. For now keep modest: last 7 days = 2016 rows.
  if (!fs.existsSync(poller.bybitFile) && !poller.unsupportedBybit) {
    try {
      let cursor: string | undefined = undefined;
      let rows = 0;
      const maxRows = 2016;  // ~7 days of 5min
      const lines: string[] = [];
      while (rows < maxRows) {
        const url: string = `/v5/market/account-ratio?category=linear&symbol=${poller.symbol}&period=5min&limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const r: any = await bybitGet<any>(url);
        if (r.retCode !== 0 || !r.result?.list?.length) break;
        for (const e of r.result.list) {
          lines.push(JSON.stringify({
            ts: new Date(Number(e.timestamp)).toISOString(),
            timestamp: Number(e.timestamp),
            exchangeTimestamp: Number(e.timestamp),
            symbol: poller.symbol,
            venue: "bybit",
            period: "5min",
            ratioType: "all_trader_account",
            buyRatio: parseFloat(e.buyRatio),
            sellRatio: parseFloat(e.sellRatio),
            longShortRatio: parseFloat(e.buyRatio) / parseFloat(e.sellRatio),
            source: "backfill",
          }));
          rows++;
          if (rows >= maxRows) break;
        }
        cursor = r.result.nextPageCursor;
        if (!cursor) break;
      }
      if (lines.length > 0) {
        // Bybit returns newest-first; reverse to ascending time order
        lines.reverse();
        fs.writeFileSync(poller.bybitFile, lines.join("\n") + "\n");
        console.log(`  [backfill-ls] ${poller.symbol} bybit: ${lines.length} rows`);
      }
    } catch (err: any) {
      console.error(`[backfill-ls] ${poller.symbol} bybit: ${err.message}`);
    }
  }

  if (!fs.existsSync(poller.binanceFile) && !poller.unsupportedBinance) {
    try {
      const allLines: string[] = [];
      for (const rt of BINANCE_RATIO_TYPES) {
        // 30 days = 8640 5min rows; Binance limit 500/page.
        const maxRows = 500 * 6;  // ~12.5 days, single batch of pages
        let endTime: number | undefined = undefined;
        let symRows = 0;
        while (symRows < maxRows) {
          const url: string = `/futures/data/${rt.endpoint}?symbol=${poller.symbol}&period=5m&limit=500${endTime ? `&endTime=${endTime}` : ""}`;
          const arr: any[] = await binanceGet<any[]>(url);
          if (!Array.isArray(arr) || arr.length === 0) break;
          for (const e of arr) {
            allLines.push(JSON.stringify({
              ts: new Date(e.timestamp).toISOString(),
              timestamp: e.timestamp,
              exchangeTimestamp: e.timestamp,
              symbol: poller.symbol,
              venue: "binance",
              period: "5m",
              ratioType: rt.label,
              longShortRatio: parseFloat(e.longShortRatio),
              longAccount: e.longAccount !== undefined ? parseFloat(e.longAccount) : null,
              shortAccount: e.shortAccount !== undefined ? parseFloat(e.shortAccount) : null,
              longPosition: e.longPosition !== undefined ? parseFloat(e.longPosition) : null,
              shortPosition: e.shortPosition !== undefined ? parseFloat(e.shortPosition) : null,
              source: "backfill",
            }));
            symRows++;
          }
          // Page back: set endTime to oldest timestamp seen - 1
          const oldest = Math.min(...arr.map(e => e.timestamp));
          endTime = oldest - 1;
          if (arr.length < 500) break;
        }
      }
      if (allLines.length > 0) {
        // Sort ascending by timestamp for clean append
        allLines.sort((a, b) => JSON.parse(a).timestamp - JSON.parse(b).timestamp);
        fs.writeFileSync(poller.binanceFile, allLines.join("\n") + "\n");
        console.log(`  [backfill-ls] ${poller.symbol} binance: ${allLines.length} rows across 3 ratio types`);
      }
    } catch (err: any) {
      console.error(`[backfill-ls] ${poller.symbol} binance: ${err.message}`);
    }
  }
}

async function backfillBinanceTaker(poller: TakerPoller): Promise<void> {
  if (fs.existsSync(poller.file) || poller.unsupported) return;
  try {
    const lines: string[] = [];
    let endTime: number | undefined = undefined;
    const maxRows = 500 * 6;  // ~12.5 days
    let rows = 0;
    while (rows < maxRows) {
      const url: string = `/futures/data/takerlongshortRatio?symbol=${poller.symbol}&period=5m&limit=500${endTime ? `&endTime=${endTime}` : ""}`;
      const arr: any[] = await binanceGet<any[]>(url);
      if (!Array.isArray(arr) || arr.length === 0) break;
      for (const e of arr) {
        lines.push(JSON.stringify({
          ts: new Date(e.timestamp).toISOString(),
          timestamp: e.timestamp,
          exchangeTimestamp: e.timestamp,
          symbol: poller.symbol,
          venue: "binance",
          period: "5m",
          buySellRatio: parseFloat(e.buySellRatio),
          buyVol: parseFloat(e.buyVol),
          sellVol: parseFloat(e.sellVol),
          source: "backfill",
        }));
        rows++;
      }
      const oldest = Math.min(...arr.map(e => e.timestamp));
      endTime = oldest - 1;
      if (arr.length < 500) break;
    }
    if (lines.length > 0) {
      lines.sort((a, b) => JSON.parse(a).timestamp - JSON.parse(b).timestamp);
      fs.writeFileSync(poller.file, lines.join("\n") + "\n");
      console.log(`  [backfill-taker] ${poller.symbol}: ${lines.length} rows`);
    }
  } catch (err: any) {
    console.error(`[backfill-taker] ${poller.symbol}: ${err.message}`);
  }
}

async function backfillBinanceOI(symbol: string): Promise<void> {
  // Binance openInterestHist — last ~30 days available. 5m granularity, 500/page.
  const file = path.join(DATA_DIR, `${symbol}_oi_hist_binance.jsonl`);
  if (fs.existsSync(file)) return;
  try {
    const lines: string[] = [];
    let endTime: number | undefined = undefined;
    const maxRows = 500 * 6;  // ~12.5 days of 5m
    let rows = 0;
    while (rows < maxRows) {
      const url: string = `/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=500${endTime ? `&endTime=${endTime}` : ""}`;
      const arr: any[] = await binanceGet<any[]>(url);
      if (!Array.isArray(arr) || arr.length === 0) break;
      for (const e of arr) {
        lines.push(JSON.stringify({
          ts: new Date(e.timestamp).toISOString(),
          timestamp: e.timestamp,
          exchangeTimestamp: e.timestamp,
          symbol,
          venue: "binance",
          openInterest: parseFloat(e.sumOpenInterest),
          openInterestValue: parseFloat(e.sumOpenInterestValue),
          source: "backfill",
        }));
        rows++;
      }
      const oldest = Math.min(...arr.map(e => e.timestamp));
      endTime = oldest - 1;
      if (arr.length < 500) break;
    }
    if (lines.length > 0) {
      lines.sort((a, b) => JSON.parse(a).timestamp - JSON.parse(b).timestamp);
      fs.writeFileSync(file, lines.join("\n") + "\n");
      console.log(`  [backfill-oi] ${symbol}: ${lines.length} historical rows (Binance)`);
    }
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("Invalid symbol") || msg.includes("-1121")) return;
    console.error(`[backfill-oi] ${symbol}: ${msg}`);
  }
}

// ── Binance liquidation WS (Tier 1.5) ─────────────────────────────
// One combined connection: wss://fstream.binance.com/stream?streams=<sym1>@forceOrder/<sym2>@forceOrder/...
// Binance only publishes the LARGEST liquidation per symbol per 1000ms — not full resolution.
function startBinanceLiquidationWs(symbols: string[]): WSInstance {
  const streams = symbols.map(s => `${s.toLowerCase()}@forceOrder`).join("/");
  const url = `wss://fstream.binance.com/stream?streams=${streams}`;
  let ws: WSInstance;

  function connect() {
    ws = new WebSocket(url);
    ws.on("open", () => console.log(`  [binance-liq] connected (${symbols.length} symbols)`));
    ws.on("message", (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        const o = msg.data?.o;
        if (!o) return;
        const symbol = o.s;
        const file = path.join(DATA_DIR, `${symbol}_liquidations.jsonl`);
        const ts = new Date().toISOString();
        const sizeBase = parseFloat(o.q);
        const orderPrice = parseFloat(o.p);
        const avgPrice = parseFloat(o.ap);
        // Binance side: SELL = long got liquidated, BUY = short got liquidated (same as Bybit semantics)
        const rawSide = o.S as "BUY" | "SELL";
        const liquidatedSide = rawSide === "SELL" ? "long" : "short";
        fs.appendFileSync(file, JSON.stringify({
          ts,
          timestamp: Date.parse(ts),
          exchangeTimestamp: o.T,
          symbol,
          venue: "binance",
          rawSide,
          liquidatedSide,
          orderPrice,
          avgPrice,
          sizeBase,
          notionalUsd: sizeBase * (Number.isFinite(avgPrice) ? avgPrice : orderPrice),
          source: "ws",
        }) + "\n");
      } catch (err: any) {
        console.error(`[binance-liq] parse: ${err.message}`);
      }
    });
    ws.on("close", () => {
      console.log("  [binance-liq] disconnected, reconnecting in 5s");
      setTimeout(connect, 5000);
    });
    ws.on("error", (err: Error) => console.error(`[binance-liq] ws error: ${err.message}`));
  }
  connect();
  return ws!;
}

function startSymbol(symbol: string): SymbolState {
  const state: SymbolState = {
    symbol,
    logFile: path.join(DATA_DIR, `${symbol}_market.jsonl`),
    candleFile: path.join(DATA_DIR, `${symbol}_1m.jsonl`),
    oiLiveFile: path.join(DATA_DIR, `${symbol}_oi_live.jsonl`),
    fundingLiveFile: path.join(DATA_DIR, `${symbol}_funding_live.jsonl`),
    liquidationsFile: path.join(DATA_DIR, `${symbol}_liquidations.jsonl`),
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

  feed.on("liquidation", (liq: LiveLiquidation) => {
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    const mark = state.ticker.markPrice ?? state.price;
    const distFromMark = (mark > 0)
      ? ((liq.bankruptcyPrice - mark) / mark) * 100
      : null;
    fs.appendFileSync(state.liquidationsFile, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: liq.exchangeTimestamp,
      symbol: liq.symbol,
      venue: "bybit",
      rawSide: liq.rawSide,
      liquidatedSide: liq.liquidatedSide,
      bankruptcyPrice: liq.bankruptcyPrice,
      sizeBase: liq.sizeBase,
      notionalUsd: liq.sizeBase * liq.bankruptcyPrice,
      markPriceAtReceive: mark > 0 ? mark : null,
      distanceFromMarkPct: distFromMark,
      source: "ws",
    }) + "\n");
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

  // Long/short ratio + taker buy/sell volume (5min cadence, both venues where applicable)
  console.log("Starting L/S ratio + taker volume pollers (5min interval)...");
  const ratioPollers = SYMBOLS.map(startRatioPoller);
  const takerPollers = SYMBOLS.map(startTakerPoller);

  // One-shot Binance OI history backfill (last ~12 days available retail-side)
  console.log("Backfilling Binance OI history (one-shot)...");
  for (const sym of SYMBOLS) {
    backfillBinanceOI(sym).catch(err => console.error(`[backfill-oi] ${sym}: ${err.message}`));
  }

  // Binance liquidation WS (one combined connection for all symbols)
  console.log("Starting Binance liquidation WS...");
  const binanceLiqWs = startBinanceLiquidationWs(SYMBOLS);

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

  console.log(`\n[${time()}] Collector running. ${SYMBOLS.length} symbols × (Bybit WS + Binance OI/funding + L/S ratios + taker vol + Bybit liq WS + Binance liq WS).`);
  console.log("Press Ctrl+C to stop\n");

  // Touch references so they aren't tree-shaken / unused
  void ratioPollers; void takerPollers; void binanceLiqWs; void binancePollers;
}

main().catch(console.error);
