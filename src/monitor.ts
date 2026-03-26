import { LiveFeed, LiveCandle, LiveTrade, LiveTicker, OrderbookMetrics } from "./live-feed";
import { loadCandles, Candle } from "./fetch-candles";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

const SYMBOL = process.argv[2] || "SIRENUSDT";

// Rolling state
let latestTicker: Partial<LiveTicker> = {};
let latestObMetrics: OrderbookMetrics | null = null;
let latestSnap: IndicatorSnapshot | null = null;

// Rolling candle buffer for live indicator computation
let candleBuffer: Candle[] = [];
let indicators: Map<number, IndicatorSnapshot> = new Map();

// Trade aggregation (rolling 1-min windows)
let tradeAggWindow: { buyVol: number; sellVol: number; count: number; start: number } = {
  buyVol: 0, sellVol: 0, count: 0, start: Date.now(),
};

// Signal thresholds (from strategy detection)
const SIGNAL = {
  rsiOversold: 35,
  rsiOverbought: 70,
  stochOversold: 35,
  volumeRatioLow: 0.5,
  atrPercentHigh: 8,
  bbPositionLow: 0.35,
  bbPositionHigh: 0.65,
  obImbalanceThreshold: 0.3,
};

function fmt(n: number | undefined, d = 2): string {
  if (n === undefined || isNaN(n)) return "---";
  return n.toFixed(d);
}

function time(): string {
  return new Date().toISOString().slice(11, 19);
}

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

  const windowStart = Math.floor(c.timestamp / 300000) * 300000;

  if (windowStart !== current5mStart) {
    current5mCandles = [c];
    current5mStart = windowStart;
  } else {
    current5mCandles.push(c);
  }

  // Build synthetic live 5m candle from accumulated 1m candles
  const live5m: Candle = {
    timestamp: current5mStart,
    open: current5mCandles[0].open,
    high: Math.max(...current5mCandles.map((x) => x.high)),
    low: Math.min(...current5mCandles.map((x) => x.low)),
    close: current5mCandles[current5mCandles.length - 1].close,
    volume: current5mCandles.reduce((s, x) => s + x.volume, 0),
    turnover: current5mCandles.reduce((s, x) => s + x.turnover, 0),
  };

  // Replace or append at end of historical buffer
  const lastIdx = candleBuffer.length - 1;
  if (lastIdx >= 0 && candleBuffer[lastIdx].timestamp === current5mStart) {
    candleBuffer[lastIdx] = live5m;
  } else {
    candleBuffer.push(live5m);
  }

  if (candleBuffer.length > 300) {
    candleBuffer = candleBuffer.slice(-300);
  }

  if (candleBuffer.length >= 210) {
    indicators = computeIndicators(candleBuffer);
    const lastTs = candleBuffer[candleBuffer.length - 1].timestamp;
    latestSnap = getSnapshotAt(indicators, lastTs) || null;
  }
}

/**
 * Check if current conditions match the trader's entry pattern.
 */
function checkSignals() {
  if (!latestSnap || !latestObMetrics) return;

  const s = latestSnap;
  const ob = latestObMetrics;

  // Long signal: oversold + low volume + high volatility
  const longConditions = {
    rsiOversold: s.rsi14 < SIGNAL.rsiOversold,
    stochOversold: s.stochK < SIGNAL.stochOversold,
    lowBB: s.bbPosition < SIGNAL.bbPositionLow,
    lowVolume: s.volumeRatio < SIGNAL.volumeRatioLow,
    highATR: s.atrPercent > SIGNAL.atrPercentHigh,
    bearTrend: s.emaTrend === "bear",
  };
  const longScore = Object.values(longConditions).filter(Boolean).length;

  // Short signal: brief bounce within bear trend
  const shortConditions = {
    rsiLow: s.rsi14 < 40,
    stochTurning: s.stochK > s.stochD && s.stochK < 45,
    bearTrend: s.emaTrend === "bear",
    highATR: s.atrPercent > SIGNAL.atrPercentHigh,
    rocPositive: s.roc5 > 0, // bouncing
    askPressure: ob.imbalance < -SIGNAL.obImbalanceThreshold,
  };
  const shortScore = Object.values(shortConditions).filter(Boolean).length;

  if (longScore >= 5) {
    const matched = Object.entries(longConditions)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");
    console.log(
      `\n${"!".repeat(longScore)} [${time()}] LONG SIGNAL (${longScore}/6) ${SYMBOL} @ $${fmt(s.price, 5)}`
    );
    console.log(`  Matched: ${matched}`);
    console.log(
      `  RSI: ${fmt(s.rsi14)} | Stoch: ${fmt(s.stochK)}/${fmt(s.stochD)} | ` +
      `BB: ${fmt(s.bbPosition)} | Vol: ${fmt(s.volumeRatio)}x | ATR: ${fmt(s.atrPercent)}%`
    );
    console.log(
      `  OB: bid $${fmt(ob.bidDepthUsdt, 0)} / ask $${fmt(ob.askDepthUsdt, 0)} | ` +
      `imbalance: ${fmt(ob.imbalance)} | spread: ${fmt(ob.spreadPct, 4)}%`
    );
  }

  if (shortScore >= 5) {
    const matched = Object.entries(shortConditions)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");
    console.log(
      `\n${"!".repeat(shortScore)} [${time()}] SHORT SIGNAL (${shortScore}/6) ${SYMBOL} @ $${fmt(s.price, 5)}`
    );
    console.log(`  Matched: ${matched}`);
    console.log(
      `  RSI: ${fmt(s.rsi14)} | Stoch: ${fmt(s.stochK)}/${fmt(s.stochD)} | ` +
      `ROC5: ${fmt(s.roc5)}% | ATR: ${fmt(s.atrPercent)}%`
    );
    console.log(
      `  OB: bid $${fmt(ob.bidDepthUsdt, 0)} / ask $${fmt(ob.askDepthUsdt, 0)} | ` +
      `imbalance: ${fmt(ob.imbalance)} | spread: ${fmt(ob.spreadPct, 4)}%`
    );
  }
}

async function main() {
  // Load historical candles for initial indicator warmup
  console.log(`Loading historical ${SYMBOL} candles for indicator warmup...`);
  const historical = loadCandles(SYMBOL, "5");
  if (historical.length > 0) {
    // Take last 300 candles
    candleBuffer = historical.slice(-300);
    indicators = computeIndicators(candleBuffer);
    const lastTs = candleBuffer[candleBuffer.length - 1].timestamp;
    latestSnap = getSnapshotAt(indicators, lastTs) || null;
    console.log(`Warmed up with ${candleBuffer.length} candles, ${indicators.size} indicator snapshots`);
    if (latestSnap) {
      console.log(
        `Latest: RSI ${fmt(latestSnap.rsi14)} | Stoch ${fmt(latestSnap.stochK)} | ` +
        `BB ${fmt(latestSnap.bbPosition)} | ATR% ${fmt(latestSnap.atrPercent)} | ` +
        `EMA trend: ${latestSnap.emaTrend}`
      );
    }
  } else {
    console.log("No historical data — indicators will warm up from live feed (needs ~300 candles)");
  }

  // Start live feed
  const feed = new LiveFeed(SYMBOL);

  feed.on("candle", (c: LiveCandle) => {
    if (c.interval === "1" && c.confirmed) {
      onConfirmedCandle1m(c);
      checkSignals();
    }
  });

  feed.on("ticker", (t: Partial<LiveTicker>) => {
    latestTicker = { ...latestTicker, ...t };
  });

  feed.on("ob-metrics", (m: OrderbookMetrics) => {
    latestObMetrics = m;
  });

  feed.on("trade", (t: LiveTrade) => {
    if (t.side === "Buy") tradeAggWindow.buyVol += t.size * t.price;
    else tradeAggWindow.sellVol += t.size * t.price;
    tradeAggWindow.count++;
  });

  feed.start();

  // Status line every 30s
  setInterval(() => {
    const price = latestTicker.lastPrice ? `$${fmt(latestTicker.lastPrice, 5)}` : "---";
    const funding = latestTicker.fundingRate ? `${fmt(latestTicker.fundingRate * 100, 4)}%` : "---";
    const oi = latestTicker.openInterestValue ? `$${(latestTicker.openInterestValue / 1e6).toFixed(2)}M` : "---";

    const rsi = latestSnap ? fmt(latestSnap.rsi14) : "---";
    const stoch = latestSnap ? `${fmt(latestSnap.stochK)}/${fmt(latestSnap.stochD)}` : "---";
    const bb = latestSnap ? fmt(latestSnap.bbPosition) : "---";
    const atr = latestSnap ? `${fmt(latestSnap.atrPercent)}%` : "---";
    const trend = latestSnap?.emaTrend || "---";

    const obStr = latestObMetrics
      ? `bid:$${(latestObMetrics.bidDepthUsdt / 1000).toFixed(1)}k ask:$${(latestObMetrics.askDepthUsdt / 1000).toFixed(1)}k imb:${fmt(latestObMetrics.imbalance)}`
      : "---";

    const buyVol = (tradeAggWindow.buyVol / 1000).toFixed(1);
    const sellVol = (tradeAggWindow.sellVol / 1000).toFixed(1);
    const trades = tradeAggWindow.count;

    console.log(
      `[${time()}] ${SYMBOL} ${price} | ` +
      `RSI:${rsi} Stoch:${stoch} BB:${bb} ATR:${atr} ${trend} | ` +
      `${obStr} | ` +
      `funding:${funding} OI:${oi} | ` +
      `30s flow: buy:$${buyVol}k sell:$${sellVol}k (${trades} trades)`
    );

    // Reset trade aggregation
    tradeAggWindow = { buyVol: 0, sellVol: 0, count: 0, start: Date.now() };
  }, 30000);

  console.log(`\n[${time()}] Monitor running. Watching for signals on ${SYMBOL}...`);
  console.log("Press Ctrl+C to stop\n");
}

main().catch(console.error);
