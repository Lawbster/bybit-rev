// ─────────────────────────────────────────────
// PF0 pump-failure short bot
//
// Strategy: HYPEUSDT short on 1H pump failure.
// Signal: 1H green body >= 2%, next 1-3 bars fail
// to exceed pump high by > 0.3%, first red bar = entry.
// Short immediately at confirmation bar close.
//
// Exit: native TP (1.0%) / stop (2.0%) on Bybit,
// or hard force-close after maxHoldHours (12h).
//
// Uses positionIdx=2 (short side, hedge mode).
// Can coexist with wed-short — they won't overlap
// because PF0 checks for existing position before entry.
//
// Run on VPS: pm2 start dist/bot/pf0-short.js --name pf0-short-bot
// ─────────────────────────────────────────────

import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { EMA } from "technicalindicators";
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { BotLogger } from "./monitor";
import { Candle } from "../fetch-candles";

// ── Config ──
interface PF0Config {
  mode: string;              // "live" | "dry-run" | "paper"
  symbol: string;
  pumpBodyPct: number;       // min 1H green body % to qualify as pump (2.0)
  failHighPct: number;       // max new-high % above pump high to count as failed (0.3)
  lookbackBars: number;      // bars after pump to check failure + confirmation (3)
  tpPct: number;             // TP % below entry (1.0)
  stopPct: number;           // stop % above entry (2.0)
  maxHoldHours: number;      // force-close after this many hours (12)
  notionalUsdt: number;      // short size in USDT (200)
  leverage: number;          // (50)
  cooldownMin: number;       // min minutes between trades (60)
  feeRate: number;
  pollIntervalSec: number;
  stateFile: string;
  logDir: string;
}

// ── State ──
interface PF0State {
  position: {
    entryPrice: number;
    qty: number;
    notional: number;
    tpPrice: number;
    stopPrice: number;
    orderLinkId: string;
    openedAt: number;           // ms timestamp
    signalBarTs: number;        // 1H bar timestamp that triggered signal
  } | null;
  lastCloseTime: number;
  lastSignalBarTs: number;      // prevent re-triggering same signal
}

const POSITION_IDX = 2; // short side in Bybit hedge mode

function loadConfig(): PF0Config {
  return JSON.parse(fs.readFileSync("pf0-short-config.json", "utf-8"));
}

function loadState(file: string): PF0State {
  if (!fs.existsSync(file)) return { position: null, lastCloseTime: 0, lastSignalBarTs: 0 };
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveState(file: string, state: PF0State) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// ── Signal detection ──

interface PF0Signal {
  confirmIdx: number;       // index in 1H bars of the red confirmation bar
  confirmBarTs: number;
  entryPrice: number;       // confirmation bar close
}

function detectPF0(bars1h: Candle[], config: PF0Config): PF0Signal | null {
  // We need at least lookbackBars+1 completed bars
  // bars1h comes newest-first from Bybit, so reverse to oldest-first
  const sorted = [...bars1h].sort((a, b) => a.timestamp - b.timestamp);

  // Drop the last bar (current incomplete hour)
  const completed = sorted.slice(0, -1);
  if (completed.length < config.lookbackBars + 2) return null;

  // Check the most recent pump candidates (scan last ~10 completed bars)
  const scanStart = Math.max(0, completed.length - 10);

  for (let i = completed.length - config.lookbackBars - 1; i >= scanStart; i--) {
    const bar = completed[i];
    const bodyPct = ((bar.close - bar.open) / bar.open) * 100;
    if (bodyPct < config.pumpBodyPct) continue; // need green pump

    // Check next 1-3 bars fail to make new high > failHighPct%
    const pumpHigh = bar.high;
    let failed = true;
    const lookEnd = Math.min(i + config.lookbackBars, completed.length - 1);
    for (let j = i + 1; j <= lookEnd; j++) {
      if (completed[j].high > pumpHigh * (1 + config.failHighPct / 100)) {
        failed = false;
        break;
      }
    }
    if (!failed) continue;

    // Need first red confirmation bar in the window
    for (let j = i + 1; j <= lookEnd; j++) {
      if (completed[j].close < completed[j].open) {
        return {
          confirmIdx: j,
          confirmBarTs: completed[j].timestamp,
          entryPrice: completed[j].close,
        };
      }
    }
  }
  return null;
}

// ── Main ──

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
    logger.warn("PF0-SHORT LIVE MODE — real short orders");
  } else {
    executor = new DryRunExecutor(logger);
    logger.info("PF0-SHORT DRY-RUN mode");
  }

  let state = loadState(config.stateFile);
  logger.info(`PF0-short bot starting | mode=${config.mode} | symbol=${config.symbol} | notional=$${config.notionalUsdt} | pump>=${config.pumpBodyPct}% | TP=${config.tpPct}% | stop=${config.stopPct}%`);

  // Ensure hedge mode
  if (config.mode === "live") {
    const hedgeOk = await executor.ensureHedgeMode(config.symbol);
    if (!hedgeOk) {
      logger.warn("Hedge mode not confirmed — exiting. Enable hedge mode on Bybit first.");
      process.exit(1);
    }
  }

  async function poll() {
    const now = Date.now();

    // ── If position is open: check expiry and native TP/stop ──
    if (state.position) {
      const pos = state.position;
      const holdMs = now - pos.openedAt;
      const holdHours = holdMs / 3600000;

      // Force-close at maxHoldHours
      if (holdHours >= config.maxHoldHours) {
        logger.info(`EXPIRY: closing PF0 short after ${holdHours.toFixed(1)}h`);
        const closeId = genOrderLinkId("pf0_close");
        const r = await executor.closeShort(config.symbol, closeId);
        if (r.success) {
          const pnlPct = ((pos.entryPrice - r.price) / pos.entryPrice) * 100;
          logger.info(`Closed at $${r.price.toFixed(4)} | pnl=${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`);
        } else {
          logger.warn(`Close failed: ${r.error}`);
        }
        state.lastCloseTime = now;
        state.position = null;
        saveState(config.stateFile, state);
        return;
      }

      // Check if native TP/stop was hit
      try {
        const price = await executor.getPrice(config.symbol);
        const tpHit = price <= pos.tpPrice;
        const slHit = price >= pos.stopPrice;

        if (tpHit || slHit) {
          logger.info(`Price $${price.toFixed(4)} crossed ${tpHit ? "TP" : "STOP"} — clearing state`);
          state.lastCloseTime = now;
          state.position = null;
          saveState(config.stateFile, state);
          logger.info(`State cleared — native ${tpHit ? "TP" : "STOP"} assumed filled`);
        } else {
          const pnlPct = ((pos.entryPrice - price) / pos.entryPrice) * 100;
          logger.info(`Position open | entry=$${pos.entryPrice.toFixed(4)} | price=$${price.toFixed(4)} | pnl=${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | hold=${holdHours.toFixed(1)}h | TP=$${pos.tpPrice.toFixed(4)} | SL=$${pos.stopPrice.toFixed(4)}`);
        }
      } catch (err: any) {
        logger.warn(`Poll error: ${err.message}`);
      }
      return;
    }

    // ── No position: check for PF0 signal ──

    // Cooldown check
    const cooldownMs = config.cooldownMin * 60000;
    if (now - state.lastCloseTime < cooldownMs) {
      return; // still in cooldown
    }

    try {
      // Fetch 1H candles — need ~250 for EMA200 warm-up, but signal only checks last ~10
      // Bybit max for 1H is 1000
      const bars1h = await executor.getCandles(config.symbol, "60", 300);
      if (bars1h.length < 10) return;

      const signal = detectPF0(bars1h, config);
      if (!signal) return;

      // Don't re-trigger the same signal bar
      if (signal.confirmBarTs <= state.lastSignalBarTs) return;

      // Signal is fresh — check if it's recent enough (within last 2 hours)
      const signalAge = now - signal.confirmBarTs;
      if (signalAge > 2 * 3600000) {
        // Signal is stale (>2h old) — skip it, it was from before we were watching
        return;
      }

      logger.warn(`PF0 SIGNAL DETECTED | confirm bar: ${new Date(signal.confirmBarTs).toISOString().slice(0, 16)} | entry price: $${signal.entryPrice.toFixed(4)}`);

      // Open short at market
      const orderId = genOrderLinkId("pf0_open");
      const result = await executor.openShort(config.symbol, config.notionalUsdt, config.leverage, orderId);

      if (!result.success) {
        logger.warn(`Open short failed: ${result.error}`);
        return;
      }

      const entryPrice = result.price;
      const tpPrice = entryPrice * (1 - config.tpPct / 100);
      const stopPrice = entryPrice * (1 + config.stopPct / 100);

      logger.warn(`PF0 SHORT OPENED | entry=$${entryPrice.toFixed(4)} | TP=$${tpPrice.toFixed(4)} | SL=$${stopPrice.toFixed(4)} | qty=${result.qty}`);

      // Set native TP and stop on Bybit
      await executor.setPositionTp(config.symbol, tpPrice, POSITION_IDX);
      await executor.setPositionSl(config.symbol, stopPrice, POSITION_IDX);
      logger.info("Native TP/SL set on exchange");

      state.position = {
        entryPrice,
        qty: result.qty,
        notional: result.notional,
        tpPrice,
        stopPrice,
        orderLinkId: orderId,
        openedAt: now,
        signalBarTs: signal.confirmBarTs,
      };
      state.lastSignalBarTs = signal.confirmBarTs;
      saveState(config.stateFile, state);

    } catch (err: any) {
      logger.warn(`Signal scan error: ${err.message}`);
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
