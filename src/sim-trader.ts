import fs from "fs";
import path from "path";
import { LiveFeed, LiveCandle, LiveTrade, LiveTicker, OrderbookMetrics } from "./live-feed";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

const SYMBOL = process.argv[2] || "SIRENUSDT";
const BALANCE = parseFloat(process.argv[3] || "5000"); // starting sim balance

// --- Sim state ---
interface SimPosition {
  id: number;
  symbol: string;
  side: "Long" | "Short";
  entryPrice: number;
  qty: number;
  leverage: number;
  entryTime: Date;
  entrySnap: IndicatorSnapshot;
  stopLoss: number;
  takeProfit: number;
}

interface ClosedPosition extends SimPosition {
  exitPrice: number;
  exitTime: Date;
  exitReason: "tp" | "sl" | "signal-flip" | "manual";
  pnl: number;
  pnlPercent: number;
  fees: number;
}

let balance = BALANCE;
let positionId = 0;
let openPositions: SimPosition[] = [];
let closedPositions: ClosedPosition[] = [];
let latestPrice = 0;
let latestTicker: Partial<LiveTicker> = {};
let latestObMetrics: OrderbookMetrics | null = null;
let latestSnap: IndicatorSnapshot | null = null;
let candleBuffer: Candle[] = [];
let indicators: Map<number, IndicatorSnapshot> = new Map();

// Config
const CONFIG = {
  leverage: 5,
  riskPerTrade: 0.02,     // 2% of balance per trade
  feeRate: 0.0011,        // 0.11% taker
  maxOpenPositions: 2,
  // Entry thresholds (from strategy detection + orderbook analysis)
  longEntry: {
    rsi: 35,
    stochK: 35,
    bbPosition: 0.35,
    volumeRatio: 0.5,
    atrPercent: 8,
    minScore: 5,           // out of 8 (indicator + OB)
  },
  shortEntry: {
    rsi: 40,
    stochK: 45,
    atrPercent: 8,
    minScore: 5,           // out of 8
  },
  // Orderbook thresholds (from overnight PIPPIN data)
  ob: {
    imbalanceStrong: 0.5,    // heavy one-sided book (abs value)
    emptyAskThreshold: 500,  // ask depth < $500 = "pulled liquidity"
    emptyBidThreshold: 500,  // bid depth < $500
    wallRatio: 3,            // wall size > 3x opposite side's wall
    sellFlowRatio: 1.3,      // sell flow > 1.3x buy flow = distribution
  },
  // Exit: ATR-based SL/TP
  slMultiplier: 1.5,       // SL at 1.5x ATR from entry
  tpMultiplier: 0.75,      // TP at 0.75x ATR from entry (0.5:1 R:R — quick scalp)
};

const LOG_FILE = path.resolve(__dirname, "../data/sim-trades.jsonl");
const MARKET_LOG = path.resolve(__dirname, `../data/${SYMBOL}_market.jsonl`);

function fmt(n: number, d = 2): string {
  return n.toFixed(d);
}

function time(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// Trade flow aggregation (rolling 1-min)
let tradeFlow = { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() };

function logTrade(trade: ClosedPosition) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(trade) + "\n");
}

function logMarketSnapshot(event: string, extra?: Record<string, any>) {
  const snap: Record<string, any> = {
    ts: new Date().toISOString(),
    event,
    symbol: SYMBOL,
    price: latestPrice,
  };

  // Ticker
  if (latestTicker.fundingRate !== undefined) snap.fundingRate = latestTicker.fundingRate;
  if (latestTicker.openInterestValue !== undefined) snap.openInterest = latestTicker.openInterestValue;
  if (latestTicker.price24hPcnt !== undefined) snap.price24hPcnt = latestTicker.price24hPcnt;

  // Orderbook
  if (latestObMetrics) {
    snap.ob = {
      bidDepth: latestObMetrics.bidDepthUsdt,
      askDepth: latestObMetrics.askDepthUsdt,
      imbalance: latestObMetrics.imbalance,
      spread: latestObMetrics.spreadPct,
      bidWall: latestObMetrics.bidWall,
      askWall: latestObMetrics.askWall,
      thinSide: latestObMetrics.thinSide,
    };
  }

  // Indicators
  if (latestSnap) {
    snap.ind = {
      rsi: latestSnap.rsi14,
      stochK: latestSnap.stochK,
      stochD: latestSnap.stochD,
      bbPos: latestSnap.bbPosition,
      bbWidth: latestSnap.bbWidth,
      atrPct: latestSnap.atrPercent,
      volRatio: latestSnap.volumeRatio,
      emaTrend: latestSnap.emaTrend,
      roc5: latestSnap.roc5,
      roc20: latestSnap.roc20,
      macdHist: latestSnap.macdHist,
      priceVsEma50: latestSnap.priceVsEma50,
    };
  }

  // Trade flow since last snapshot
  snap.flow = { ...tradeFlow };

  // Extra event-specific data
  if (extra) snap.detail = extra;

  fs.appendFileSync(MARKET_LOG, JSON.stringify(snap) + "\n");
}

// --- Position management ---

function openPosition(side: "Long" | "Short", price: number, snap: IndicatorSnapshot) {
  if (openPositions.length >= CONFIG.maxOpenPositions) return;
  // Don't open same side if already in one
  if (openPositions.some((p) => p.side === side)) return;

  const riskAmount = balance * CONFIG.riskPerTrade;
  const atr = snap.atr14;
  const slDistance = atr * CONFIG.slMultiplier;
  const tpDistance = atr * CONFIG.tpMultiplier;

  // Position size from risk amount and SL distance
  const qty = riskAmount / slDistance;
  const notional = qty * price;
  const fee = notional * CONFIG.feeRate;

  let stopLoss: number;
  let takeProfit: number;
  if (side === "Long") {
    stopLoss = price - slDistance;
    takeProfit = price + tpDistance;
  } else {
    stopLoss = price + slDistance;
    takeProfit = price - tpDistance;
  }

  const pos: SimPosition = {
    id: ++positionId,
    symbol: SYMBOL,
    side,
    entryPrice: price,
    qty,
    leverage: CONFIG.leverage,
    entryTime: new Date(),
    entrySnap: snap,
    stopLoss,
    takeProfit,
  };

  openPositions.push(pos);
  balance -= fee;
  logMarketSnapshot("open-position", { posId: pos.id, side, price, qty, stopLoss, takeProfit, riskAmount });

  console.log(
    `\n>> [${time()}] OPEN ${side.toUpperCase()} #${pos.id} | ` +
    `${fmt(qty, 2)} ${SYMBOL} @ $${fmt(price, 5)} | ` +
    `SL: $${fmt(stopLoss, 5)} | TP: $${fmt(takeProfit, 5)} | ` +
    `Risk: $${fmt(riskAmount)} | Fee: $${fmt(fee, 4)}`
  );
  console.log(
    `   RSI: ${fmt(snap.rsi14)} | Stoch: ${fmt(snap.stochK)} | ` +
    `BB: ${fmt(snap.bbPosition)} | ATR%: ${fmt(snap.atrPercent)} | ` +
    `Vol: ${fmt(snap.volumeRatio)}x`
  );
}

function closePosition(pos: SimPosition, exitPrice: number, reason: ClosedPosition["exitReason"]) {
  const notional = pos.qty * exitPrice;
  const fee = notional * CONFIG.feeRate;

  let pnl: number;
  if (pos.side === "Long") {
    pnl = (exitPrice - pos.entryPrice) * pos.qty;
  } else {
    pnl = (pos.entryPrice - exitPrice) * pos.qty;
  }
  const netPnl = pnl - fee;
  const pnlPercent = (pnl / (pos.qty * pos.entryPrice)) * 100 * pos.leverage;

  balance += netPnl;

  const closed: ClosedPosition = {
    ...pos,
    exitPrice,
    exitTime: new Date(),
    exitReason: reason,
    pnl: netPnl,
    pnlPercent,
    fees: fee + pos.qty * pos.entryPrice * CONFIG.feeRate, // entry + exit fees
  };

  closedPositions.push(closed);
  openPositions = openPositions.filter((p) => p.id !== pos.id);
  logTrade(closed);
  logMarketSnapshot("close-position", { posId: pos.id, side: pos.side, exitPrice, reason, pnl: netPnl, pnlPercent });

  const pnlSign = netPnl >= 0 ? "+" : "";
  const icon = netPnl >= 0 ? "W" : "L";
  console.log(
    `\n<< [${time()}] CLOSE ${pos.side.toUpperCase()} #${pos.id} [${icon}] | ` +
    `${fmt(pos.qty, 2)} ${SYMBOL} @ $${fmt(exitPrice, 5)} (${reason}) | ` +
    `PnL: ${pnlSign}$${fmt(netPnl, 4)} (${pnlSign}${fmt(pnlPercent)}%) | ` +
    `Balance: $${fmt(balance)}`
  );
}

function checkStopsTakeProfits(price: number) {
  for (const pos of [...openPositions]) {
    if (pos.side === "Long") {
      if (price <= pos.stopLoss) closePosition(pos, price, "sl");
      else if (price >= pos.takeProfit) closePosition(pos, price, "tp");
    } else {
      if (price >= pos.stopLoss) closePosition(pos, price, "sl");
      else if (price <= pos.takeProfit) closePosition(pos, price, "tp");
    }
  }
}

// --- Signal detection ---

function checkSignals() {
  if (!latestSnap || !latestObMetrics || latestPrice === 0) return;

  const s = latestSnap;
  const ob = latestObMetrics;

  // --- Long signal: indicator + orderbook conditions ---
  const longConds = {
    // Indicator conditions (from SIREN strategy detect)
    rsiOversold: s.rsi14 < CONFIG.longEntry.rsi,
    stochOversold: s.stochK < CONFIG.longEntry.stochK,
    lowBB: s.bbPosition < CONFIG.longEntry.bbPosition,
    lowVolume: s.volumeRatio < CONFIG.longEntry.volumeRatio,
    highATR: s.atrPercent > CONFIG.longEntry.atrPercent,
    bearTrend: s.emaTrend === "bear",
    // Orderbook conditions (bid liquidity pulled = dump incoming, then reversal)
    obBidThin: ob.bidDepthUsdt < CONFIG.ob.emptyBidThreshold,      // bids pulled before dump
    obAskWall: ob.askWall > ob.bidWall * CONFIG.ob.wallRatio,      // big ask wall = selling pressure peaking
  };
  const longScore = Object.values(longConds).filter(Boolean).length;

  if (longScore >= CONFIG.longEntry.minScore) {
    console.log(`\n!! [${time()}] LONG SIGNAL (${longScore}/8) @ $${fmt(latestPrice, 5)}`);
    logMarketSnapshot("long-signal", { score: longScore, conditions: longConds });
    openPosition("Long", latestPrice, s);
  }

  // --- Short signal: indicator + orderbook conditions ---
  const shortConds = {
    // Indicator conditions
    rsiMid: s.rsi14 > 45 && s.rsi14 < 65,                          // not oversold — fading a bounce/rally
    stochElevated: s.stochK > 40,                                   // stoch mid-high
    lowVolume: s.volumeRatio < CONFIG.longEntry.volumeRatio,        // quiet market
    highATR: s.atrPercent > CONFIG.shortEntry.atrPercent,
    macdFading: s.macdHist < 0,                                     // momentum fading
    rocNeg: s.roc5 < 0,                                             // price turning down
    // Orderbook conditions (from PIPPIN overnight data)
    obAskEmpty: ob.askDepthUsdt < CONFIG.ob.emptyAskThreshold,      // ask liquidity pulled
    obBidImbalance: ob.imbalance > CONFIG.ob.imbalanceStrong,       // heavy bid side = spoofing before dump
  };
  const shortScore = Object.values(shortConds).filter(Boolean).length;

  if (shortScore >= CONFIG.shortEntry.minScore) {
    console.log(`\n!! [${time()}] SHORT SIGNAL (${shortScore}/8) @ $${fmt(latestPrice, 5)}`);
    logMarketSnapshot("short-signal", { score: shortScore, conditions: shortConds });
    openPosition("Short", latestPrice, s);
  }
}

// --- Candle handler ---

// Accumulate 1m candles within the current 5m window
let current5mCandles: Candle[] = [];
let current5mStart = 0;

function onConfirmedCandle1m(candle: LiveCandle) {
  const c: Candle = {
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover,
  };

  // Which 5m window does this 1m candle belong to?
  const windowStart = Math.floor(c.timestamp / 300000) * 300000;

  if (windowStart !== current5mStart) {
    // New 5m window — finalize previous if we had data
    current5mCandles = [c];
    current5mStart = windowStart;
  } else {
    current5mCandles.push(c);
  }

  // Build a synthetic "live" 5m candle from accumulated 1m candles
  const live5m: Candle = {
    timestamp: current5mStart,
    open: current5mCandles[0].open,
    high: Math.max(...current5mCandles.map((x) => x.high)),
    low: Math.min(...current5mCandles.map((x) => x.low)),
    close: current5mCandles[current5mCandles.length - 1].close,
    volume: current5mCandles.reduce((s, x) => s + x.volume, 0),
    turnover: current5mCandles.reduce((s, x) => s + x.turnover, 0),
  };

  // Replace or append the live 5m candle at the end of the buffer
  const lastIdx = candleBuffer.length - 1;
  if (lastIdx >= 0 && candleBuffer[lastIdx].timestamp === current5mStart) {
    candleBuffer[lastIdx] = live5m; // update in-progress candle
  } else {
    candleBuffer.push(live5m); // new 5m period
  }

  // Trim buffer
  if (candleBuffer.length > 300) {
    candleBuffer = candleBuffer.slice(-300);
  }

  // Recompute indicators
  if (candleBuffer.length >= 210) {
    indicators = computeIndicators(candleBuffer);
    const lastTs = candleBuffer[candleBuffer.length - 1].timestamp;
    latestSnap = getSnapshotAt(indicators, lastTs) || null;
  }
}

// --- Main ---

async function main() {
  console.log(`\n=== SIM TRADER — ${SYMBOL} ===`);
  console.log(`Starting balance: $${fmt(BALANCE)}`);
  console.log(`Leverage: ${CONFIG.leverage}x | Risk/trade: ${CONFIG.riskPerTrade * 100}% | Fee: ${CONFIG.feeRate * 100}%`);
  console.log(`SL: ${CONFIG.slMultiplier}x ATR | TP: ${CONFIG.tpMultiplier}x ATR (${(CONFIG.tpMultiplier / CONFIG.slMultiplier).toFixed(1)}:1 R:R)`);
  console.log(`Log: ${LOG_FILE}`);
  console.log(`Market data: ${MARKET_LOG}\n`);

  // Warmup
  console.log(`Loading historical candles...`);
  const historical = loadCandles(SYMBOL, "5");
  if (historical.length > 0) {
    candleBuffer = historical.slice(-300);
    indicators = computeIndicators(candleBuffer);
    const lastTs = candleBuffer[candleBuffer.length - 1].timestamp;
    latestSnap = getSnapshotAt(indicators, lastTs) || null;
    console.log(`Warmed up: ${candleBuffer.length} candles, ${indicators.size} snapshots`);
  }

  // Live feed
  const feed = new LiveFeed(SYMBOL);

  feed.on("candle", (c: LiveCandle) => {
    if (c.interval === "1" && c.confirmed) {
      onConfirmedCandle1m(c);
      checkSignals();
    }
  });

  feed.on("ticker", (t: Partial<LiveTicker>) => {
    latestTicker = { ...latestTicker, ...t };
    if (t.lastPrice) {
      latestPrice = t.lastPrice;
      checkStopsTakeProfits(latestPrice);
    }
  });

  feed.on("ob-metrics", (m: OrderbookMetrics) => {
    latestObMetrics = m;
  });

  feed.on("trade", (t: LiveTrade) => {
    if (t.side === "Buy") { tradeFlow.buyVol += t.size * t.price; tradeFlow.buyCount++; }
    else { tradeFlow.sellVol += t.size * t.price; tradeFlow.sellCount++; }
  });

  feed.start();

  // Market snapshot every 60s
  setInterval(() => {
    if (latestPrice > 0) {
      logMarketSnapshot("periodic");
      // Reset trade flow after logging
      tradeFlow = { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() };
    }
  }, 60000);

  // Status every 30s
  setInterval(() => {
    const price = latestPrice > 0 ? `$${fmt(latestPrice, 5)}` : "---";
    const rsi = latestSnap ? fmt(latestSnap.rsi14) : "---";
    const atr = latestSnap ? `${fmt(latestSnap.atrPercent)}%` : "---";
    const trend = latestSnap?.emaTrend || "---";

    const openStr = openPositions.length > 0
      ? openPositions.map((p) => {
          const uPnl = p.side === "Long"
            ? (latestPrice - p.entryPrice) * p.qty
            : (p.entryPrice - latestPrice) * p.qty;
          return `${p.side[0]}#${p.id}:${uPnl >= 0 ? "+" : ""}$${fmt(uPnl, 2)}`;
        }).join(" ")
      : "flat";

    const wins = closedPositions.filter((p) => p.pnl > 0).length;
    const total = closedPositions.length;
    const totalPnl = closedPositions.reduce((s, p) => s + p.pnl, 0);

    console.log(
      `[${time()}] ${SYMBOL} ${price} | RSI:${rsi} ATR:${atr} ${trend} | ` +
      `Pos: ${openStr} | ` +
      `Bal: $${fmt(balance)} | ` +
      `Trades: ${wins}W/${total} PnL:$${fmt(totalPnl)}`
    );
  }, 30000);

  // --- Watch-only symbols (data logging, no trading) ---
  // Usage: npm run sim SIRENUSDT 5000 PIPPINUSDT VVVUSDT
  const watchSymbols = process.argv.slice(4).filter((s) => s.match(/^[A-Z]+$/));
  for (const ws of watchSymbols) {
    const wLog = path.resolve(__dirname, `../data/${ws}_market.jsonl`);
    const wFeed = new LiveFeed(ws);
    let wPrice = 0;
    let wTicker: Partial<LiveTicker> = {};
    let wOb: OrderbookMetrics | null = null;
    let wSnap: IndicatorSnapshot | null = null;
    let wCandleBuffer: Candle[] = [];
    let wFlow = { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() };
    let w5mCandles: Candle[] = [];
    let w5mStart = 0;

    // Warmup from historical data
    const wHistorical = loadCandles(ws, "5");
    if (wHistorical.length > 0) {
      wCandleBuffer = wHistorical.slice(-300);
      const wIndicators = computeIndicators(wCandleBuffer);
      const wLastTs = wCandleBuffer[wCandleBuffer.length - 1].timestamp;
      wSnap = getSnapshotAt(wIndicators, wLastTs) || null;
      console.log(`[WATCH] ${ws}: warmed up ${wCandleBuffer.length} candles`);
    } else {
      console.log(`[WATCH] ${ws}: no historical data, will warm up from live`);
    }

    function wLogSnapshot(event: string, extra?: Record<string, any>) {
      const snap: Record<string, any> = { ts: new Date().toISOString(), event, symbol: ws, price: wPrice };
      if (wTicker.fundingRate !== undefined) snap.fundingRate = wTicker.fundingRate;
      if (wTicker.openInterestValue !== undefined) snap.openInterest = wTicker.openInterestValue;
      if (wOb) {
        snap.ob = {
          bidDepth: wOb.bidDepthUsdt, askDepth: wOb.askDepthUsdt, imbalance: wOb.imbalance,
          spread: wOb.spreadPct, bidWall: wOb.bidWall, askWall: wOb.askWall, thinSide: wOb.thinSide,
        };
      }
      if (wSnap) {
        snap.ind = {
          rsi: wSnap.rsi14, stochK: wSnap.stochK, stochD: wSnap.stochD, bbPos: wSnap.bbPosition,
          bbWidth: wSnap.bbWidth, atrPct: wSnap.atrPercent, volRatio: wSnap.volumeRatio,
          emaTrend: wSnap.emaTrend, roc5: wSnap.roc5, roc20: wSnap.roc20,
          macdHist: wSnap.macdHist, priceVsEma50: wSnap.priceVsEma50,
        };
      }
      snap.flow = { ...wFlow };
      if (extra) snap.detail = extra;
      fs.appendFileSync(wLog, JSON.stringify(snap) + "\n");
    }

    wFeed.on("candle", (c: LiveCandle) => {
      if (c.interval === "1" && c.confirmed) {
        const candle: Candle = {
          timestamp: c.timestamp, open: c.open, high: c.high,
          low: c.low, close: c.close, volume: c.volume, turnover: c.turnover,
        };
        const winStart = Math.floor(candle.timestamp / 300000) * 300000;
        if (winStart !== w5mStart) { w5mCandles = [candle]; w5mStart = winStart; }
        else { w5mCandles.push(candle); }

        const live5m: Candle = {
          timestamp: w5mStart, open: w5mCandles[0].open,
          high: Math.max(...w5mCandles.map((x) => x.high)),
          low: Math.min(...w5mCandles.map((x) => x.low)),
          close: w5mCandles[w5mCandles.length - 1].close,
          volume: w5mCandles.reduce((s, x) => s + x.volume, 0),
          turnover: w5mCandles.reduce((s, x) => s + x.turnover, 0),
        };
        const li = wCandleBuffer.length - 1;
        if (li >= 0 && wCandleBuffer[li].timestamp === w5mStart) wCandleBuffer[li] = live5m;
        else wCandleBuffer.push(live5m);
        if (wCandleBuffer.length > 300) wCandleBuffer = wCandleBuffer.slice(-300);
        if (wCandleBuffer.length >= 210) {
          const wInd = computeIndicators(wCandleBuffer);
          wSnap = getSnapshotAt(wInd, wCandleBuffer[wCandleBuffer.length - 1].timestamp) || null;
        }
      }
    });

    wFeed.on("ticker", (t: Partial<LiveTicker>) => {
      wTicker = { ...wTicker, ...t };
      if (t.lastPrice) wPrice = t.lastPrice;
    });
    wFeed.on("ob-metrics", (m: OrderbookMetrics) => { wOb = m; });
    wFeed.on("trade", (t: LiveTrade) => {
      if (t.side === "Buy") { wFlow.buyVol += t.size * t.price; wFlow.buyCount++; }
      else { wFlow.sellVol += t.size * t.price; wFlow.sellCount++; }
    });

    wFeed.start();

    setInterval(() => {
      if (wPrice > 0) {
        wLogSnapshot("periodic");
        wFlow = { buyVol: 0, sellVol: 0, buyCount: 0, sellCount: 0, start: Date.now() };
      }
    }, 60000);

    console.log(`[WATCH] ${ws}: logging market data to ${wLog}`);
  }

  const allSymbols = [SYMBOL, ...watchSymbols];
  console.log(`\n[${time()}] Sim trader running. Trading ${SYMBOL}, watching ${watchSymbols.length > 0 ? watchSymbols.join(", ") : "none"}...`);
  console.log("Press Ctrl+C to stop\n");
}

main().catch(console.error);
