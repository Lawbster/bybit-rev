// ─────────────────────────────────────────────
// PF0 pump-failure short bot (multi-symbol)
//
// Strategy: Short on 1H pump failure.
// Signal: 1H green body >= 2%, next 1-3 bars fail
// to exceed pump high by > 0.3%, at least one red
// confirmation bar. Entry at end of full lookback
// window (no look-ahead bias).
//
// Exit: native TP (1.0%) / stop (2.0%) on Bybit,
// or hard force-close after maxHoldHours (12h).
//
// Uses positionIdx=2 (short side, hedge mode).
// Each symbol has independent state and position.
//
// Run on VPS: pm2 start dist/bot/pf0-short.js --name pf0-short-bot
// ─────────────────────────────────────────────

import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { BotLogger } from "./monitor";
import { Candle } from "../fetch-candles";

// ── Config ──
interface PF0Config {
  mode: string;              // "live" | "dry-run" | "paper"
  symbols: string[];         // ["HYPEUSDT", "SUIUSDT"]
  pumpBodyPct: number;       // min 1H green body % to qualify as pump (2.0)
  failHighPct: number;       // max new-high % above pump high to count as failed (0.3)
  lookbackBars: number;      // bars after pump to check failure + confirmation (3)
  tpPct: number;             // TP % below entry (1.0)
  stopPct: number;           // stop % above entry (2.0)
  maxHoldHours: number;      // force-close after this many hours (12)
  notionalUsdt: number;      // short size in USDT per symbol (3000)
  leverage: number;          // (50)
  cooldownMin: number;       // min minutes between trades per symbol (60)
  feeRate: number;
  pollIntervalSec: number;
  stateDir: string;          // directory for per-symbol state files
  logDir: string;
}

// ── Per-symbol state ──
interface SymbolState {
  position: {
    entryPrice: number;
    qty: number;
    notional: number;
    tpPrice: number;
    stopPrice: number;
    orderLinkId: string;
    openedAt: number;
    signalBarTs: number;
  } | null;
  lastCloseTime: number;
  lastSignalBarTs: number;
}

const POSITION_IDX = 2; // short side in Bybit hedge mode

function loadConfig(): PF0Config {
  return JSON.parse(fs.readFileSync("pf0-short-config.json", "utf-8"));
}

function stateFile(dir: string, symbol: string): string {
  return `${dir}/pf0-state-${symbol}.json`;
}

function loadState(filepath: string): SymbolState {
  if (!fs.existsSync(filepath)) return { position: null, lastCloseTime: 0, lastSignalBarTs: 0 };
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function saveState(filepath: string, state: SymbolState) {
  fs.writeFileSync(filepath, JSON.stringify(state, null, 2));
}

// ── Signal detection ──

interface PF0Signal {
  confirmBarTs: number;
  entryPrice: number;
}

function detectPF0(bars1h: Candle[], config: PF0Config): PF0Signal | null {
  const sorted = [...bars1h].sort((a, b) => a.timestamp - b.timestamp);

  // Drop the last bar (current incomplete hour)
  const completed = sorted.slice(0, -1);
  if (completed.length < config.lookbackBars + 2) return null;

  const scanStart = Math.max(0, completed.length - 10);

  for (let i = completed.length - config.lookbackBars - 1; i >= scanStart; i--) {
    const bar = completed[i];
    const bodyPct = ((bar.close - bar.open) / bar.open) * 100;
    if (bodyPct < config.pumpBodyPct) continue;

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

    let hasRedConfirm = false;
    for (let j = i + 1; j <= lookEnd; j++) {
      if (completed[j].close < completed[j].open) { hasRedConfirm = true; break; }
    }
    if (!hasRedConfirm) continue;

    // Enter at end of full lookback window — no look-ahead
    const entryBar = completed[lookEnd];
    return {
      confirmBarTs: entryBar.timestamp,
      entryPrice: entryBar.close,
    };
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

  // Ensure state directory exists
  if (!fs.existsSync(config.stateDir)) fs.mkdirSync(config.stateDir, { recursive: true });

  // Load per-symbol state
  const states = new Map<string, SymbolState>();
  for (const sym of config.symbols) {
    states.set(sym, loadState(stateFile(config.stateDir, sym)));
  }

  logger.info(`PF0-short bot starting | mode=${config.mode} | symbols=${config.symbols.join(",")} | notional=$${config.notionalUsdt} | pump>=${config.pumpBodyPct}% | TP=${config.tpPct}% | stop=${config.stopPct}%`);

  // Ensure hedge mode on each symbol
  if (config.mode === "live") {
    for (const sym of config.symbols) {
      const hedgeOk = await executor.ensureHedgeMode(sym);
      if (!hedgeOk) {
        logger.warn(`Hedge mode not confirmed for ${sym} — skipping. Enable hedge mode on Bybit first.`);
      }
    }
  }

  async function pollSymbol(symbol: string) {
    const now = Date.now();
    const state = states.get(symbol)!;
    const sf = stateFile(config.stateDir, symbol);

    // ── If position is open: check expiry and native TP/stop ──
    if (state.position) {
      const pos = state.position;
      const holdHours = (now - pos.openedAt) / 3600000;

      // Force-close at maxHoldHours
      if (holdHours >= config.maxHoldHours) {
        logger.info(`[${symbol}] EXPIRY: closing PF0 short after ${holdHours.toFixed(1)}h`);
        const closeId = genOrderLinkId("pf0_close");
        const r = await executor.closeShort(symbol, closeId);
        if (r.success) {
          const pnlPct = ((pos.entryPrice - r.price) / pos.entryPrice) * 100;
          logger.info(`[${symbol}] Closed at $${r.price.toFixed(4)} | pnl=${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`);
        } else {
          logger.warn(`[${symbol}] Close failed: ${r.error}`);
        }
        state.lastCloseTime = now;
        state.position = null;
        saveState(sf, state);
        return;
      }

      // Check if native TP/stop was hit
      try {
        const price = await executor.getPrice(symbol);
        const tpHit = price <= pos.tpPrice;
        const slHit = price >= pos.stopPrice;

        if (tpHit || slHit) {
          logger.info(`[${symbol}] Price $${price.toFixed(4)} crossed ${tpHit ? "TP" : "STOP"} — clearing state`);
          state.lastCloseTime = now;
          state.position = null;
          saveState(sf, state);
          logger.info(`[${symbol}] Native ${tpHit ? "TP" : "STOP"} assumed filled`);
        } else {
          const pnlPct = ((pos.entryPrice - price) / pos.entryPrice) * 100;
          logger.info(`[${symbol}] Position open | entry=$${pos.entryPrice.toFixed(4)} | price=$${price.toFixed(4)} | pnl=${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% | hold=${holdHours.toFixed(1)}h`);
        }
      } catch (err: any) {
        logger.warn(`[${symbol}] Poll error: ${err.message}`);
      }
      return;
    }

    // ── No position: check for PF0 signal ──
    const cooldownMs = config.cooldownMin * 60000;
    if (now - state.lastCloseTime < cooldownMs) return;

    try {
      const bars1h = await executor.getCandles(symbol, "60", 300);
      if (bars1h.length < 10) return;

      const signal = detectPF0(bars1h, config);
      if (!signal) return;

      if (signal.confirmBarTs <= state.lastSignalBarTs) return;

      // Signal must be recent (within last 4 hours — window is 3 bars = 3h)
      const signalAge = now - signal.confirmBarTs;
      if (signalAge > 4 * 3600000) return;

      logger.warn(`[${symbol}] PF0 SIGNAL | bar: ${new Date(signal.confirmBarTs).toISOString().slice(0, 16)} | price: $${signal.entryPrice.toFixed(4)}`);

      const orderId = genOrderLinkId("pf0_open");
      const result = await executor.openShort(symbol, config.notionalUsdt, config.leverage, orderId);

      if (!result.success) {
        logger.warn(`[${symbol}] Open short failed: ${result.error}`);
        return;
      }

      const entryPrice = result.price;
      const tpPrice = entryPrice * (1 - config.tpPct / 100);
      const stopPrice = entryPrice * (1 + config.stopPct / 100);

      logger.warn(`[${symbol}] PF0 SHORT OPENED | entry=$${entryPrice.toFixed(4)} | TP=$${tpPrice.toFixed(4)} | SL=$${stopPrice.toFixed(4)} | qty=${result.qty}`);

      await executor.setPositionTp(symbol, tpPrice, POSITION_IDX);
      await executor.setPositionSl(symbol, stopPrice, POSITION_IDX);
      logger.info(`[${symbol}] Native TP/SL set on exchange`);

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
      saveState(sf, state);

    } catch (err: any) {
      logger.warn(`[${symbol}] Signal scan error: ${err.message}`);
    }
  }

  async function pollAll() {
    for (const sym of config.symbols) {
      await pollSymbol(sym);
    }
  }

  logger.info(`Polling ${config.symbols.length} symbols every ${config.pollIntervalSec}s`);
  await pollAll();
  setInterval(async () => {
    try { await pollAll(); } catch (err: any) { logger.warn(`Loop error: ${err.message}`); }
  }, config.pollIntervalSec * 1000);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
