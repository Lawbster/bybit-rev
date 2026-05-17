// Hyperliquid native data collector — separate process from bybit-collect.
//
// Two streams, both REST-polled (no auth required):
//
// 1. HYPE perp ticker (60s) → data/HYPEUSDT_oi_live_hyperliquid.jsonl
//                            data/HYPEUSDT_funding_live_hyperliquid.jsonl
//    Provides: markPx, oraclePx, midPx, premium, openInterest, funding,
//    dayNtlVlm, dayBaseVlm. Joins with existing Bybit/Binance OI/funding
//    files on (symbol, timestamp) — research can compute Hyperliquid vs
//    Bybit perp-perp spread, OI breadth across 3 venues, funding divergence.
//
// 2. HLP vault state (5min) → data/HYPE_hlp_vault.jsonl
//    Provides: apr, maxDistributable (TVL proxy), maxWithdrawable, follower
//    count. HLP-vault-bleed is a unique HYPE-ecosystem stress signal that
//    no other venue exposes.
//
// HYPE-specific by design — Hyperliquid is the ecosystem this token lives on.
// Other Hyperliquid perps could be added if research demands; not in v1.

import fs from "fs";
import path from "path";
import https from "https";
const WebSocket: any = require("ws");

const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";
const HLP_VAULT_ADDRESS = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";
const HYPE_PERP_NAME = "HYPE";

const PERP_POLL_MS = 60_000;       // ticker (mark/OI/funding) every 60s
const VAULT_POLL_MS = 5 * 60_000;   // HLP vault state every 5min
const OB_SAMPLE_MS = 15_000;         // HL l2Book is event-driven; write sampled bands
const ASSET_CTX_SAMPLE_MS = 15_000;  // activeAssetCtx is event-driven; throttle disk writes
const HEALTH_LOG_MS = 5 * 60_000;   // periodic status line
const WS_STALE_MS = 90_000;

const PERP_OI_FILE = path.join(DATA_DIR, "HYPEUSDT_oi_live_hyperliquid.jsonl");
const PERP_FUNDING_FILE = path.join(DATA_DIR, "HYPEUSDT_funding_live_hyperliquid.jsonl");
const VAULT_FILE = path.join(DATA_DIR, "HYPE_hlp_vault.jsonl");
const HL_TAKER_FILE = path.join(DATA_DIR, "HYPEUSDT_taker_hyperliquid.jsonl");
const HL_OB_BANDS_FILE = path.join(DATA_DIR, "HYPEUSDT_ob_bands_hyperliquid.jsonl");
const HL_CANDLES_1M_FILE = path.join(DATA_DIR, "HYPEUSDT_1m_hyperliquid.jsonl");
const HL_CANDLES_5M_FILE = path.join(DATA_DIR, "HYPEUSDT_5m_hyperliquid.jsonl");
const HL_ASSET_CTX_FILE = path.join(DATA_DIR, "HYPEUSDT_asset_ctx_hyperliquid.jsonl");

const BOOK_BANDS = [0.001, 0.0025, 0.005, 0.01, 0.02];
const LARGE_TRADE_USD = 50_000;

function timeStr(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ── Hyperliquid REST helper ──────────────────────────────────────
function hlPost<T>(body: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HL HTTP ${res.statusCode}: ${d.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(d) as T); }
        catch (e) { reject(new Error(`HL JSON parse: ${(e as Error).message}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("HL request timeout")));
    req.write(data);
    req.end();
  });
}

// Cached perp index for HYPE (resolved once at startup; never changes)
let hypePerpIndex = -1;

async function resolveHypeIndex(): Promise<void> {
  const meta = await hlPost<{ universe: { name: string }[] }>({ type: "meta" });
  hypePerpIndex = meta.universe.findIndex(u => u.name === HYPE_PERP_NAME);
  if (hypePerpIndex < 0) throw new Error(`HYPE not in Hyperliquid perp universe (${meta.universe.length} entries scanned)`);
  console.log(`  [hl-perp] HYPE resolved at universe index ${hypePerpIndex}`);
}

interface PerpAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: string[];
  dayBaseVlm: string;
}

async function pollHypePerp(): Promise<void> {
  if (hypePerpIndex < 0) return;
  try {
    const arr = await hlPost<[any, PerpAssetCtx[]]>({ type: "metaAndAssetCtxs" });
    const ctx = arr[1][hypePerpIndex];
    if (!ctx) {
      console.error("[hl-perp] HYPE ctx missing in response");
      return;
    }
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    const markPx = parseFloat(ctx.markPx);
    const oraclePx = parseFloat(ctx.oraclePx);
    const midPx = parseFloat(ctx.midPx);
    const premium = parseFloat(ctx.premium);
    const oiBase = parseFloat(ctx.openInterest);
    const oiUsd = Number.isFinite(oiBase) && Number.isFinite(markPx) ? oiBase * markPx : null;
    const fundingRate = parseFloat(ctx.funding);
    const dayNtlVlm = parseFloat(ctx.dayNtlVlm);
    const dayBaseVlm = parseFloat(ctx.dayBaseVlm);

    fs.appendFileSync(PERP_OI_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      symbol: "HYPEUSDT",
      venue: "hyperliquid",
      openInterest: oiBase,
      openInterestValue: oiUsd,
      markPrice: markPx,
      oraclePrice: oraclePx,
      midPrice: midPx,
      premium,
      dayNtlVlm,
      dayBaseVlm,
      source: "rest_poll",
    }) + "\n");

    // Hyperliquid funding is hourly (not 8h like Bybit/Binance) — the rate here
    // is the per-hour rate that's actively accruing. Capture for HF research.
    fs.appendFileSync(PERP_FUNDING_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      symbol: "HYPEUSDT",
      venue: "hyperliquid",
      fundingRate,
      fundingIntervalHours: 1,
      markPrice: markPx,
      oraclePrice: oraclePx,
      premium,
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    console.error(`[hl-perp] poll failed: ${err.message}`);
  }
}

interface VaultDetails {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: any[];
  apr: number;
  followerState: any;
  leaderFraction: number;
  leaderCommission: number;
  followers: any[];        // can be huge — never write the array, only the count
  maxDistributable: number;
  maxWithdrawable: number;
  isClosed: boolean;
  relationship: any;
  allowDeposits: boolean;
  alwaysCloseOnWithdraw: boolean;
}

async function pollHlpVault(): Promise<void> {
  try {
    const v = await hlPost<VaultDetails>({ type: "vaultDetails", vaultAddress: HLP_VAULT_ADDRESS });
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    fs.appendFileSync(VAULT_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      vault: "HLP",
      vaultAddress: HLP_VAULT_ADDRESS,
      apr: v.apr,
      maxDistributable: v.maxDistributable,
      maxWithdrawable: v.maxWithdrawable,
      followerCount: Array.isArray(v.followers) ? v.followers.length : null,
      leaderFraction: v.leaderFraction,
      leaderCommission: v.leaderCommission,
      isClosed: v.isClosed,
      allowDeposits: v.allowDeposits,
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    console.error(`[hl-vault] poll failed: ${err.message}`);
  }
}

// Hyperliquid public WebSocket streams
interface WsTrade {
  coin: string;
  side: string;
  px: string | number;
  sz: string | number;
  hash?: string;
  time: number;
  tid?: number;
  users?: [string, string];
}

interface WsLevel {
  px: string | number;
  sz: string | number;
  n?: number;
}

interface WsBook {
  coin: string;
  levels: [WsLevel[], WsLevel[]];
  time: number;
}

interface WsCandle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string | number;
  c: string | number;
  h: string | number;
  l: string | number;
  v: string | number;
  n: number;
}

interface TradeBucket {
  windowStart: number;
  windowEnd: number;
  buyVol: number;
  sellVol: number;
  buyNotional: number;
  sellNotional: number;
  buyCount: number;
  sellCount: number;
  largeBuyNotional: number;
  largeSellNotional: number;
  largeBuyCount: number;
  largeSellCount: number;
  firstTradeTime: number | null;
  lastTradeTime: number | null;
}

let ws: any = null;
let wsReconnectAttempts = 0;
let wsMessages = 0;
let wsTrades = 0;
let wsBookUpdates = 0;
let wsCandles = 0;
let wsAssetCtxUpdates = 0;
let lastWsMessageAt = 0;
let latestBook: WsBook | null = null;
let latestAssetCtx: any = null;
let lastAssetCtxWriteAt = 0;
let tradeBucket: TradeBucket | null = null;
const pendingCandles = new Map<string, WsCandle>();
const emittedCandles = new Set<string>();

function num(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = typeof x === "number" ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : null;
}

function appendJsonLine(file: string, row: object): void {
  fs.appendFileSync(file, JSON.stringify(row) + "\n");
}

function makeTradeBucket(windowStart: number): TradeBucket {
  return {
    windowStart,
    windowEnd: windowStart + 60_000,
    buyVol: 0,
    sellVol: 0,
    buyNotional: 0,
    sellNotional: 0,
    buyCount: 0,
    sellCount: 0,
    largeBuyNotional: 0,
    largeSellNotional: 0,
    largeBuyCount: 0,
    largeSellCount: 0,
    firstTradeTime: null,
    lastTradeTime: null,
  };
}

function sideToAggressor(side: string): "buy" | "sell" | "unknown" {
  const s = String(side || "").toLowerCase();
  if (s === "b" || s === "buy" || s.includes("buy")) return "buy";
  if (s === "a" || s === "sell" || s.includes("sell")) return "sell";
  return "unknown";
}

function flushTradeBucket(force = false): void {
  if (!tradeBucket) return;
  const hasTrades = tradeBucket.buyCount + tradeBucket.sellCount > 0;
  if (!hasTrades) {
    tradeBucket = null;
    return;
  }
  if (!force && Date.now() < tradeBucket.windowEnd + 5_000) return;

  const buySellRatio = tradeBucket.sellVol > 0 ? tradeBucket.buyVol / tradeBucket.sellVol : null;
  const buySellNotionalRatio = tradeBucket.sellNotional > 0 ? tradeBucket.buyNotional / tradeBucket.sellNotional : null;
  appendJsonLine(HL_TAKER_FILE, {
    ts: new Date(tradeBucket.windowEnd).toISOString(),
    timestamp: tradeBucket.windowEnd,
    exchangeTimestamp: tradeBucket.lastTradeTime,
    symbol: "HYPEUSDT",
    coin: HYPE_PERP_NAME,
    venue: "hyperliquid",
    period: "1m",
    intervalMs: 60_000,
    windowStart: tradeBucket.windowStart,
    windowEnd: tradeBucket.windowEnd,
    buySellRatio,
    buySellNotionalRatio,
    buyVol: tradeBucket.buyVol,
    sellVol: tradeBucket.sellVol,
    buyNotional: tradeBucket.buyNotional,
    sellNotional: tradeBucket.sellNotional,
    netTakerVol: tradeBucket.buyVol - tradeBucket.sellVol,
    netTakerNotional: tradeBucket.buyNotional - tradeBucket.sellNotional,
    buyCount: tradeBucket.buyCount,
    sellCount: tradeBucket.sellCount,
    largeTradeThresholdUsd: LARGE_TRADE_USD,
    largeBuyNotional: tradeBucket.largeBuyNotional,
    largeSellNotional: tradeBucket.largeSellNotional,
    largeBuyCount: tradeBucket.largeBuyCount,
    largeSellCount: tradeBucket.largeSellCount,
    firstTradeTime: tradeBucket.firstTradeTime,
    lastTradeTime: tradeBucket.lastTradeTime,
    source: "ws_trades",
  });
  tradeBucket = null;
}

function handleTrades(payload: unknown): void {
  const trades: WsTrade[] = Array.isArray(payload)
    ? payload as WsTrade[]
    : Array.isArray((payload as any)?.trades)
      ? (payload as any).trades as WsTrade[]
      : [];

  for (const tr of trades) {
    if (tr.coin !== HYPE_PERP_NAME) continue;
    const tradeTs = num(tr.time);
    const px = num(tr.px);
    const sz = num(tr.sz);
    if (tradeTs === null || px === null || sz === null) continue;

    const bucketStart = Math.floor(tradeTs / 60_000) * 60_000;
    if (!tradeBucket) tradeBucket = makeTradeBucket(bucketStart);
    if (bucketStart > tradeBucket.windowStart) {
      flushTradeBucket(true);
      tradeBucket = makeTradeBucket(bucketStart);
    }
    if (bucketStart < tradeBucket.windowStart) continue;

    const notional = px * sz;
    const aggressor = sideToAggressor(tr.side);
    if (aggressor === "buy") {
      tradeBucket.buyVol += sz;
      tradeBucket.buyNotional += notional;
      tradeBucket.buyCount++;
      if (notional >= LARGE_TRADE_USD) {
        tradeBucket.largeBuyNotional += notional;
        tradeBucket.largeBuyCount++;
      }
    } else if (aggressor === "sell") {
      tradeBucket.sellVol += sz;
      tradeBucket.sellNotional += notional;
      tradeBucket.sellCount++;
      if (notional >= LARGE_TRADE_USD) {
        tradeBucket.largeSellNotional += notional;
        tradeBucket.largeSellCount++;
      }
    }
    tradeBucket.firstTradeTime = tradeBucket.firstTradeTime ?? tradeTs;
    tradeBucket.lastTradeTime = tradeTs;
    wsTrades++;
  }
}

function bandKey(band: number): string {
  if (band === 0.001) return "pct_0_1";
  if (band === 0.0025) return "pct_0_25";
  if (band === 0.005) return "pct_0_5";
  if (band === 0.01) return "pct_1_0";
  return "pct_2_0";
}

function sumDepthUsd(levels: WsLevel[], mid: number, band: number, side: "bid" | "ask"): number {
  const limit = side === "bid" ? mid * (1 - band) : mid * (1 + band);
  let sum = 0;
  for (const lvl of levels) {
    const px = num(lvl.px);
    const sz = num(lvl.sz);
    if (px === null || sz === null) continue;
    if (side === "bid" && px >= limit) sum += px * sz;
    if (side === "ask" && px <= limit) sum += px * sz;
  }
  return sum;
}

function writeLatestBookBands(): void {
  if (!latestBook) return;
  const bids = latestBook.levels?.[0] || [];
  const asks = latestBook.levels?.[1] || [];
  const bestBid = num(bids[0]?.px);
  const bestAsk = num(asks[0]?.px);
  if (bestBid === null || bestAsk === null || bestBid <= 0 || bestAsk <= 0) return;

  const midPrice = (bestBid + bestAsk) / 2;
  const bidBands: Record<string, number | null> = {};
  const askBands: Record<string, number | null> = {};
  const bidBandsTruncated: Record<string, boolean> = {};
  const askBandsTruncated: Record<string, boolean> = {};
  const bandResolutionTooCoarse: Record<string, boolean> = {};

  const bidPrices = bids.map(l => num(l.px)).filter((n): n is number => n !== null);
  const askPrices = asks.map(l => num(l.px)).filter((n): n is number => n !== null);
  const worstBid = bidPrices.length ? Math.min(...bidPrices) : null;
  const worstAsk = askPrices.length ? Math.max(...askPrices) : null;
  const bidCoveragePct = worstBid !== null ? ((midPrice - worstBid) / midPrice) * 100 : null;
  const askCoveragePct = worstAsk !== null ? ((worstAsk - midPrice) / midPrice) * 100 : null;

  for (const band of BOOK_BANDS) {
    const key = bandKey(band);
    const tooCoarse = band < 0.0025;
    bandResolutionTooCoarse[key] = tooCoarse;
    bidBands[key] = tooCoarse ? null : sumDepthUsd(bids, midPrice, band, "bid");
    askBands[key] = tooCoarse ? null : sumDepthUsd(asks, midPrice, band, "ask");
    bidBandsTruncated[key] = bidCoveragePct !== null ? bidCoveragePct < band * 100 : true;
    askBandsTruncated[key] = askCoveragePct !== null ? askCoveragePct < band * 100 : true;
  }

  const bid05 = bidBands.pct_0_5 ?? 0;
  const ask05 = askBands.pct_0_5 ?? 0;
  const bid2 = bidBands.pct_2_0 ?? 0;
  const ask2 = askBands.pct_2_0 ?? 0;
  const tsMs = Date.now();
  appendJsonLine(HL_OB_BANDS_FILE, {
    ts: new Date(tsMs).toISOString(),
    timestamp: tsMs,
    exchangeTimestamp: latestBook.time,
    symbol: "HYPEUSDT",
    coin: HYPE_PERP_NAME,
    venue: "hyperliquid",
    orderbookDepth: Math.min(bids.length, asks.length),
    bookAggregation: "nSigFigs_3",
    bestBidAskAreAggregated: true,
    midPrice,
    bestBidPrice: bestBid,
    bestAskPrice: bestAsk,
    spreadPct: ((bestAsk - bestBid) / midPrice) * 100,
    bidCoveragePct,
    askCoveragePct,
    bidBands,
    askBands,
    bidBandsTruncated,
    askBandsTruncated,
    bandResolutionTooCoarse,
    imbalance_0_5: bid05 + ask05 > 0 ? (bid05 - ask05) / (bid05 + ask05) : null,
    imbalance_2_0: bid2 + ask2 > 0 ? (bid2 - ask2) / (bid2 + ask2) : null,
    source: "ws_l2Book_sample",
  });
}

function queueCandle(payload: unknown): void {
  const candles: WsCandle[] = Array.isArray(payload)
    ? payload as WsCandle[]
    : (payload as any)?.candle
      ? [(payload as any).candle as WsCandle]
      : payload && typeof payload === "object"
        ? [payload as WsCandle]
        : [];

  for (const c of candles) {
    if (c.s !== HYPE_PERP_NAME || (c.i !== "1m" && c.i !== "5m")) continue;
    pendingCandles.set(`${c.i}:${c.t}`, c);
    wsCandles++;
  }
}

function flushClosedCandles(force = false): void {
  const now = Date.now();
  for (const [key, c] of Array.from(pendingCandles.entries())) {
    if (!force && now < c.T + 2_000) continue;
    if (emittedCandles.has(key)) {
      pendingCandles.delete(key);
      continue;
    }

    const open = num(c.o);
    const high = num(c.h);
    const low = num(c.l);
    const close = num(c.c);
    const volume = num(c.v);
    if (open === null || high === null || low === null || close === null || volume === null) continue;
    const turnover = volume * close;
    const file = c.i === "1m" ? HL_CANDLES_1M_FILE : HL_CANDLES_5M_FILE;
    appendJsonLine(file, {
      ts: c.t,
      timestamp: c.t,
      exchangeTimestamp: c.T,
      iso: new Date(c.t).toISOString(),
      symbol: "HYPEUSDT",
      coin: HYPE_PERP_NAME,
      venue: "hyperliquid",
      interval: c.i,
      open,
      high,
      low,
      close,
      volume,
      turnover,
      trades: c.n,
      source: "ws_candle_closed",
    });
    emittedCandles.add(key);
    if (emittedCandles.size > 10_000) {
      const first = emittedCandles.values().next().value;
      if (first !== undefined) emittedCandles.delete(first);
    }
    pendingCandles.delete(key);
  }
}

function writeLatestAssetCtx(force = false): void {
  if (!latestAssetCtx) return;
  const now = Date.now();
  if (!force && now - lastAssetCtxWriteAt < ASSET_CTX_SAMPLE_MS) return;
  lastAssetCtxWriteAt = now;

  const ctx = latestAssetCtx.ctx ?? latestAssetCtx;
  const markPx = num(ctx.markPx);
  const openInterest = num(ctx.openInterest);
  appendJsonLine(HL_ASSET_CTX_FILE, {
    ts: new Date(now).toISOString(),
    timestamp: now,
    exchangeTimestamp: latestAssetCtx.time ?? now,
    symbol: "HYPEUSDT",
    coin: HYPE_PERP_NAME,
    venue: "hyperliquid",
    markPrice: markPx,
    midPrice: num(ctx.midPx),
    oraclePrice: num(ctx.oraclePx),
    prevDayPx: num(ctx.prevDayPx),
    fundingRate: num(ctx.funding),
    openInterest,
    openInterestValue: openInterest !== null && markPx !== null ? openInterest * markPx : null,
    dayNtlVlm: num(ctx.dayNtlVlm),
    source: "ws_activeAssetCtx_sample",
  });
}

function handleWsMessage(raw: any): void {
  lastWsMessageAt = Date.now();
  wsMessages++;
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.channel === "subscriptionResponse") return;
  if (msg.channel === "trades") {
    handleTrades(msg.data);
  } else if (msg.channel === "l2Book") {
    const book = msg.data as WsBook;
    if (book?.coin === HYPE_PERP_NAME && Array.isArray(book.levels)) {
      latestBook = book;
      wsBookUpdates++;
    }
  } else if (msg.channel === "candle") {
    queueCandle(msg.data);
  } else if (msg.channel === "activeAssetCtx") {
    if (msg.data?.coin === HYPE_PERP_NAME || msg.data?.ctx) {
      latestAssetCtx = msg.data;
      wsAssetCtxUpdates++;
      writeLatestAssetCtx();
    }
  }
}

function subscribeWs(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const subs = [
    { type: "trades", coin: HYPE_PERP_NAME },
    { type: "l2Book", coin: HYPE_PERP_NAME, nSigFigs: 3 },
    { type: "candle", coin: HYPE_PERP_NAME, interval: "1m" },
    { type: "candle", coin: HYPE_PERP_NAME, interval: "5m" },
    { type: "activeAssetCtx", coin: HYPE_PERP_NAME },
  ];
  for (const subscription of subs) {
    ws.send(JSON.stringify({ method: "subscribe", subscription }));
  }
}

function startHyperliquidWs(): void {
  ws = new WebSocket(HL_WS_URL);
  ws.on("open", () => {
    wsReconnectAttempts = 0;
    lastWsMessageAt = Date.now();
    console.log(`[${timeStr()}] [hl-ws] connected; subscribing trades/l2Book(nSigFigs=3)/candles/assetCtx for ${HYPE_PERP_NAME}`);
    subscribeWs();
  });
  ws.on("message", handleWsMessage);
  ws.on("error", (err: Error) => {
    console.error(`[hl-ws] error: ${err.message}`);
  });
  ws.on("close", () => {
    const delay = Math.min(30_000, 2_000 * Math.max(1, ++wsReconnectAttempts));
    console.warn(`[${timeStr()}] [hl-ws] closed; reconnecting in ${delay / 1000}s`);
    setTimeout(startHyperliquidWs, delay);
  });
}

function stopHyperliquidWs(): void {
  flushTradeBucket(true);
  flushClosedCandles(true);
  writeLatestBookBands();
  writeLatestAssetCtx(true);
  try { ws?.close(); } catch { /* ignore */ }
}

async function main() {
  console.log(`\n=== HYPERLIQUID NATIVE COLLECTOR ===`);
  console.log(`Output: ${DATA_DIR}/HYPEUSDT_*_hyperliquid.jsonl + HYPE_hlp_vault.jsonl`);

  try {
    await resolveHypeIndex();
  } catch (err: any) {
    console.error(`Failed to resolve HYPE perp index: ${err.message}`);
    process.exit(1);
  }

  // Initial polls immediately so we have first rows on boot
  await pollHypePerp();
  await pollHlpVault();
  startHyperliquidWs();

  setInterval(pollHypePerp, PERP_POLL_MS);
  setInterval(pollHlpVault, VAULT_POLL_MS);
  setInterval(() => flushTradeBucket(), 5_000);
  setInterval(() => flushClosedCandles(), 5_000);
  setInterval(writeLatestBookBands, OB_SAMPLE_MS);
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const silentMs = Date.now() - lastWsMessageAt;
    if (silentMs > WS_STALE_MS) {
      console.warn(`[${timeStr()}] [hl-ws] stale ${(silentMs / 1000).toFixed(0)}s; terminating`);
      try { ws.terminate(); } catch { /* reconnect via close */ }
    } else {
      try { ws.ping(); } catch { /* ignore */ }
    }
  }, 30_000);

  // Periodic status
  setInterval(() => {
    const perpSize = fs.existsSync(PERP_OI_FILE) ? fs.statSync(PERP_OI_FILE).size : 0;
    const fundSize = fs.existsSync(PERP_FUNDING_FILE) ? fs.statSync(PERP_FUNDING_FILE).size : 0;
    const vaultSize = fs.existsSync(VAULT_FILE) ? fs.statSync(VAULT_FILE).size : 0;
    const takerSize = fs.existsSync(HL_TAKER_FILE) ? fs.statSync(HL_TAKER_FILE).size : 0;
    const obSize = fs.existsSync(HL_OB_BANDS_FILE) ? fs.statSync(HL_OB_BANDS_FILE).size : 0;
    const assetSize = fs.existsSync(HL_ASSET_CTX_FILE) ? fs.statSync(HL_ASSET_CTX_FILE).size : 0;
    const wsAgeSec = lastWsMessageAt > 0 ? ((Date.now() - lastWsMessageAt) / 1000).toFixed(0) : "n/a";
    console.log(`[${timeStr()}] perp_oi=${(perpSize/1024).toFixed(1)}kb funding=${(fundSize/1024).toFixed(1)}kb hlp_vault=${(vaultSize/1024).toFixed(1)}kb hl_taker=${(takerSize/1024).toFixed(1)}kb hl_ob=${(obSize/1024).toFixed(1)}kb hl_asset=${(assetSize/1024).toFixed(1)}kb wsMsgs=${wsMessages} trades=${wsTrades} books=${wsBookUpdates} candles=${wsCandles} assetCtx=${wsAssetCtxUpdates} wsAge=${wsAgeSec}s`);
  }, HEALTH_LOG_MS);

  process.on("SIGINT", () => { stopHyperliquidWs(); process.exit(0); });
  process.on("SIGTERM", () => { stopHyperliquidWs(); process.exit(0); });

  console.log(`\n[${timeStr()}] HL collector running. Perp ticker every ${PERP_POLL_MS/1000}s, HLP vault every ${VAULT_POLL_MS/1000}s, WS book sample every ${OB_SAMPLE_MS/1000}s.`);
  console.log("Press Ctrl+C to stop\n");
}

main().catch(err => { console.error(err); process.exit(1); });
