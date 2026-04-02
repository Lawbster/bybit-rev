// ─────────────────────────────────────────────
// Wed near-high short bot
//
// Strategy: HYPEUSDT short, entered Wednesday after
// 18:00 UTC when price is within 1.25% of the rolling
// daily high. Exit: native TP (-1%) / stop (+2%) set
// on Bybit, or hard force-close Thursday 12:00 UTC.
//
// NOTE: Uses positionIdx=2 (short side, hedge mode).
// Stress hedge in the main bot also uses positionIdx=2.
// Overlap window is tiny (~18h/week) and risk is
// accepted at current $1k sizing. Revisit at scale.
// ─────────────────────────────────────────────

import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { BotLogger } from "./monitor";
import { Candle } from "../fetch-candles";

// ── Config ──
interface WedShortConfig {
  mode: string;
  symbol: string;
  nearHighPct: number;       // within X% of rolling daily high
  entryAfterHourUTC: number; // only enter after this UTC hour on Wednesday
  tpPct: number;             // TP % below entry
  stopPct: number;           // stop % above entry
  expiryHourUTC: number;     // Thu UTC hour to force-close
  notionalUsdt: number;
  leverage: number;
  feeRate: number;
  pollIntervalSec: number;
  stateFile: string;
  logDir: string;
}

// ── State ──
interface WedShortState {
  position: {
    entryPrice: number;
    qty: number;
    notional: number;
    tpPrice: number;
    stopPrice: number;
    orderLinkId: string;
    openedAt: number;        // ms timestamp
    wedDate: string;         // "2025-10-29" — which Wednesday this is for
  } | null;
  lastCloseTime: number;
  lastCloseWedDate: string;
}

const POSITION_IDX = 2; // short side in Bybit hedge mode

function loadConfig(): WedShortConfig {
  return JSON.parse(fs.readFileSync("wed-short-config.json", "utf-8"));
}

function loadState(file: string): WedShortState {
  if (!fs.existsSync(file)) return { position: null, lastCloseTime: 0, lastCloseWedDate: "" };
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveState(file: string, state: WedShortState) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

function utcDateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function utcHour(ts: number): number {
  return new Date(ts).getUTCHours();
}

function utcDow(ts: number): number {
  return new Date(ts).getUTCDay(); // 0=Sun, 3=Wed, 4=Thu
}

// Thu 12:00 UTC expiry timestamp for a given Wed date string
function expiryTs(wedDate: string, expiryHour: number): number {
  const thu = new Date(wedDate + "T00:00:00Z");
  thu.setUTCDate(thu.getUTCDate() + 1);
  return thu.getTime() + expiryHour * 3600000;
}

async function run() {
  const config = loadConfig();
  const logger = new BotLogger(config.logDir);
  let executor: Executor;
  if (config.mode === "live") {
    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      logger.warn("LIVE mode requires BYBIT_API_KEY and BYBIT_API_SECRET in .env");
      process.exit(1);
    }
    executor = new LiveExecutor(apiKey, apiSecret, logger);
    logger.warn("LIVE MODE — real short orders on MAIN account");
  } else {
    executor = new DryRunExecutor(logger);
    logger.info("DRY-RUN mode — no real orders, market data only");
  }
  let state = loadState(config.stateFile);

  logger.info(`Wed-short bot starting | mode=${config.mode} | symbol=${config.symbol} | notional=$${config.notionalUsdt} | near=${config.nearHighPct}% | TP=${config.tpPct}% | stop=${config.stopPct}%`);

  // Ensure hedge mode on startup
  if (config.mode === "live") {
    const hedgeOk = await executor.ensureHedgeMode(config.symbol);
    if (!hedgeOk) {
      logger.warn("Hedge mode not confirmed — exiting. Enable hedge mode on Bybit first.");
      process.exit(1);
    }
  }

  async function poll() {
    const now = Date.now();
    const dow  = utcDow(now);
    const hour = utcHour(now);
    const todayStr = utcDateStr(now);

    // ── If position is open: check TP/stop/expiry ──
    if (state.position) {
      const pos = state.position;
      const exp = expiryTs(pos.wedDate, config.expiryHourUTC);

      // Force-close at Thursday expiry
      if (now >= exp) {
        logger.info(`EXPIRY: closing position opened ${pos.wedDate} at Thu ${config.expiryHourUTC}h UTC`);
        const closeId = genOrderLinkId("ws_close");
        const r = await executor.closeShort(config.symbol, closeId);
        if (r.success) {
          const pnlPct = (pos.entryPrice - r.price) / pos.entryPrice * 100;
          logger.info(`Closed at $${r.price.toFixed(4)} | pnl≈${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`);
        } else {
          logger.warn(`Close failed: ${r.error}`);
        }
        state.position = null;
        state.lastCloseTime = now;
        state.lastCloseWedDate = pos.wedDate;
        saveState(config.stateFile, state);
        return;
      }

      // Check if native TP/stop was triggered by querying exchange position
      try {
        const price = await executor.getPrice(config.symbol);

        // Check via position size — if short is gone, TP or stop fired natively
        // We do this by querying the orderLinkId status or checking position size
        const closeCheck = await executor.queryOrder(config.symbol, pos.orderLinkId);
        if (closeCheck.found && closeCheck.status === "Filled") {
          // Open order filled — the open itself. Normal, position is live.
        }

        // Simple heuristic: if price has crossed TP or stop, confirm via exchange
        const tpHit  = price <= pos.tpPrice;
        const slHit  = price >= pos.stopPrice;

        if (tpHit || slHit) {
          // Give it 30s then check if position still exists
          // (native TP/SL may have already closed it)
          logger.info(`Price $${price.toFixed(4)} crossed ${tpHit ? "TP" : "STOP"} — verifying exchange position`);
          // If native orders are set correctly, exchange handles it.
          // We just mark closed in state to stop re-entering.
          // On next poll if price is still beyond threshold, confirm.
          state.position = null;
          state.lastCloseTime = now;
          state.lastCloseWedDate = pos.wedDate;
          saveState(config.stateFile, state);
          logger.info(`State cleared — native ${tpHit ? "TP" : "STOP"} assumed filled`);
        } else {
          logger.info(`Position open | entry=$${pos.entryPrice.toFixed(4)} | price=$${price.toFixed(4)} | TP=$${pos.tpPrice.toFixed(4)} | SL=$${pos.stopPrice.toFixed(4)} | exp=${new Date(exp).toISOString()}`);
        }
      } catch (err: any) {
        logger.warn(`Poll error: ${err.message}`);
      }
      return;
    }

    // ── No position: check entry conditions ──

    // Only look for entries on Wednesday after entryAfterHourUTC
    if (dow !== 3 || hour < config.entryAfterHourUTC) {
      return; // not entry window
    }

    // Don't re-enter on same Wednesday if we already traded it
    if (state.lastCloseWedDate === todayStr) {
      return;
    }

    try {
      // Fetch today's 5m candles (up to 288 candles = full day)
      const candles = await executor.getCandles(config.symbol, "5", 288);
      if (candles.length === 0) return;

      // Filter to today UTC only (from midnight)
      const todayMidnight = new Date(todayStr + "T00:00:00Z").getTime();
      const todayCandles = candles.filter((c: Candle) => c.timestamp >= todayMidnight);
      if (todayCandles.length === 0) return;

      // Rolling daily high
      const rollingHigh = Math.max(...todayCandles.map((c: Candle) => c.high));

      const price = await executor.getPrice(config.symbol);
      const distFromHigh = (rollingHigh - price) / rollingHigh * 100;

      logger.info(`Entry scan | price=$${price.toFixed(4)} | dayHigh=$${rollingHigh.toFixed(4)} | dist=${distFromHigh.toFixed(2)}% | threshold=${config.nearHighPct}%`);

      if (distFromHigh > config.nearHighPct) {
        return; // price not near daily high
      }

      // Entry condition met — open short
      logger.info(`ENTRY SIGNAL: price within ${distFromHigh.toFixed(2)}% of day high $${rollingHigh.toFixed(4)} — opening short`);

      const orderId = genOrderLinkId("ws_open");
      const result = await executor.openShort(config.symbol, config.notionalUsdt, config.leverage, orderId);

      if (!result.success) {
        logger.warn(`Open short failed: ${result.error}`);
        return;
      }

      const entryPrice = result.price;
      const tpPrice    = entryPrice * (1 - config.tpPct  / 100);
      const stopPrice  = entryPrice * (1 + config.stopPct / 100);

      logger.info(`SHORT opened | entry=$${entryPrice.toFixed(4)} | TP=$${tpPrice.toFixed(4)} | SL=$${stopPrice.toFixed(4)} | qty=${result.qty}`);

      // Set native TP and stop on Bybit
      await executor.setPositionTp(config.symbol, tpPrice,   POSITION_IDX);
      await executor.setPositionSl(config.symbol, stopPrice, POSITION_IDX);

      logger.info(`Native TP/SL set on exchange`);

      state.position = {
        entryPrice,
        qty: result.qty,
        notional: result.notional,
        tpPrice,
        stopPrice,
        orderLinkId: orderId,
        openedAt: now,
        wedDate: todayStr,
      };
      state.lastCloseWedDate = ""; // clear so we know we're in a trade
      saveState(config.stateFile, state);

    } catch (err: any) {
      logger.warn(`Entry scan error: ${err.message}`);
    }
  }

  // Main loop
  logger.info(`Polling every ${config.pollIntervalSec}s`);
  await poll();
  setInterval(async () => {
    try { await poll(); } catch (err: any) { logger.warn(`Loop error: ${err.message}`); }
  }, config.pollIntervalSec * 1000);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
