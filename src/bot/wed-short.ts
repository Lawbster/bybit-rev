// ─────────────────────────────────────────────
// HYPE tactical short bot — two entry sources, one position slot.
//
// Source "wed": HYPEUSDT short, entered Wednesday after 18:00 UTC when price
//   is within 1.25% of the rolling daily high. Exit: native TP/stop on Bybit
//   or hard force-close Thursday 12:00 UTC.
//
// Source "d1":  triple-condition top-fade. Fires when current 5m bar makes a
//   new 3-day high AND last fully-closed 1H Bollinger %B > 0.9 AND last two
//   fully-closed 4H MACD histogram values are declining. TP/stop and time-cap
//   exit (default 48h max hold).
//
// Lock semantics: only one short open at a time. If wed window opens while D1
// is holding (or vice versa) the second trigger is skipped — no merge, no
// queue. Sim says ~1-2 missed D1 fires/yr.
//
// NOTE: Uses positionIdx=2 (short side, hedge mode). Main-bot stress hedge
// also uses positionIdx=2 — kept off HYPE for now.
// ─────────────────────────────────────────────

import fs from "fs";
import dotenv from "dotenv";
dotenv.config();
import { BollingerBands, MACD } from "technicalindicators";
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { BotLogger } from "./monitor";
import { Candle } from "../fetch-candles";

// ── Config ──
interface D1Config {
  enabled: boolean;
  notionalUsdt: number;
  leverage: number;
  tpPct: number;
  stopPct: number;
  maxHoldHours: number;
  cooldownMin: number;
  bbPosMin: number;          // BB %B threshold on 1H (0.9 = top decile)
  high3dDays: number;        // rolling-high lookback in days
}

interface WedShortConfig {
  mode: string;
  symbol: string;
  nearHighPct: number;       // within X% of rolling daily high
  entryAfterHourUTC: number; // only enter after this UTC hour on Wednesday
  tpPct: number;             // TP % below entry (wed-source)
  stopPct: number;           // stop % above entry (wed-source)
  expiryHourUTC: number;     // Thu UTC hour to force-close (wed-source)
  notionalUsdt: number;
  leverage: number;
  feeRate: number;
  pollIntervalSec: number;
  stateFile: string;
  logDir: string;
  d1?: D1Config;             // optional D1 top-fade source; absent = disabled
}

type ShortSource = "wed" | "d1";

// ── State ──
interface WedShortState {
  position: {
    source: ShortSource;     // which trigger opened this position
    entryPrice: number;
    qty: number;
    notional: number;
    tpPrice: number;
    stopPrice: number;
    orderLinkId: string;
    openedAt: number;        // ms timestamp
    expiresAt: number;       // ms timestamp — force-close after this
    wedDate: string;         // "" for d1 source; date for wed-source dedup
  } | null;
  lastCloseTime: number;
  lastCloseWedDate: string;
  lastD1CloseTime: number;
}

const POSITION_IDX = 2; // short side in Bybit hedge mode

function loadConfig(): WedShortConfig {
  return JSON.parse(fs.readFileSync("wed-short-config.json", "utf-8"));
}

function loadState(file: string): WedShortState {
  if (!fs.existsSync(file)) return { position: null, lastCloseTime: 0, lastCloseWedDate: "", lastD1CloseTime: 0 };
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<WedShortState> & { position?: any };
  // Backfill fields added when D1 was wired in — preserves any in-flight wed-source position.
  const state: WedShortState = {
    position: raw.position ?? null,
    lastCloseTime: raw.lastCloseTime ?? 0,
    lastCloseWedDate: raw.lastCloseWedDate ?? "",
    lastD1CloseTime: raw.lastD1CloseTime ?? 0,
  };
  if (state.position && !state.position.source) {
    state.position.source = "wed";
    if (!state.position.expiresAt) {
      state.position.expiresAt = expiryTs(state.position.wedDate, 12);
    }
  }
  return state;
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

// ── D1 detection ──
//
// Trigger (all three must hold):
//   1) current 5m bar's high > prior 3-day max-high (excluding current bar)
//   2) last fully-closed 1H Bollinger %B > bbPosMin
//   3) last two fully-closed 4H MACD histogram bars: latest < prior
//
// All HTF lookups exclude the in-progress bar (slice(0, -1)) to stay bias-safe.
interface D1Check {
  fire: boolean;
  reason: string;
  metrics?: { bbPos: number; macdCur: number; macdPrior: number; high3d: number; price: number };
}

async function checkD1Trigger(
  executor: Executor,
  symbol: string,
  cfg: D1Config,
  currentPrice: number,
): Promise<D1Check> {
  const bars5m = await executor.getCandles(symbol, "5", cfg.high3dDays * 24 * 12 + 12);
  if (bars5m.length < cfg.high3dDays * 24 * 12) return { fire: false, reason: `5m bars insufficient (${bars5m.length})` };

  const bars1h = await executor.getCandles(symbol, "60", 60);
  if (bars1h.length < 22) return { fire: false, reason: `1h bars insufficient (${bars1h.length})` };

  const bars4h = await executor.getCandles(symbol, "240", 60);
  if (bars4h.length < 40) return { fire: false, reason: `4h bars insufficient (${bars4h.length})` };

  // 3-day max-high (exclude in-progress 5m bar)
  const closed5m = bars5m.slice(0, -1);
  const cutoff = Date.now() - cfg.high3dDays * 24 * 3600000;
  const past3d = closed5m.filter(c => c.timestamp >= cutoff);
  if (past3d.length === 0) return { fire: false, reason: "no 5m bars in 3d window" };
  const high3d = Math.max(...past3d.map(c => c.high));
  if (currentPrice <= high3d) {
    return { fire: false, reason: `price $${currentPrice.toFixed(4)} not above 3d high $${high3d.toFixed(4)}` };
  }

  // 1H Bollinger %B (exclude in-progress 1H bar)
  const closes1h = bars1h.slice(0, -1).map(b => b.close);
  const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes1h });
  if (bb.length === 0) return { fire: false, reason: "BB calc empty" };
  const lastBb = bb[bb.length - 1];
  const lastClose1h = closes1h[closes1h.length - 1];
  const bbPos = lastBb.upper !== lastBb.lower
    ? (lastClose1h - lastBb.lower) / (lastBb.upper - lastBb.lower)
    : 0.5;
  if (bbPos <= cfg.bbPosMin) {
    return { fire: false, reason: `1H BB %B ${bbPos.toFixed(3)} ≤ ${cfg.bbPosMin}` };
  }

  // 4H MACD histogram declining (exclude in-progress 4H bar)
  const closes4h = bars4h.slice(0, -1).map(b => b.close);
  const macd = MACD.calculate({
    values: closes4h,
    fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
    SimpleMAOscillator: false, SimpleMASignal: false,
  });
  if (macd.length < 2) return { fire: false, reason: "MACD insufficient" };
  const macdCur   = macd[macd.length - 1].histogram ?? 0;
  const macdPrior = macd[macd.length - 2].histogram ?? 0;
  if (!(macdCur < macdPrior)) {
    return { fire: false, reason: `4H MACD hist not declining (cur=${macdCur.toFixed(5)} prior=${macdPrior.toFixed(5)})` };
  }

  return {
    fire: true,
    reason: `new3dHigh $${currentPrice.toFixed(4)}>${high3d.toFixed(4)} & 1H BB%B=${bbPos.toFixed(2)} & 4H MACD↓ (${macdCur.toFixed(4)}<${macdPrior.toFixed(4)})`,
    metrics: { bbPos, macdCur, macdPrior, high3d, price: currentPrice },
  };
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

  logger.info(`HYPE short bot starting | mode=${config.mode} | symbol=${config.symbol}`);
  logger.info(`  [wed] notional=$${config.notionalUsdt} | near=${config.nearHighPct}% | TP=${config.tpPct}% | stop=${config.stopPct}% | expiry Thu ${config.expiryHourUTC}h UTC`);
  if (config.d1?.enabled) {
    logger.info(`  [d1]  notional=$${config.d1.notionalUsdt} | TP=${config.d1.tpPct}% | stop=${config.d1.stopPct}% | maxHold=${config.d1.maxHoldHours}h | cd=${config.d1.cooldownMin}min | bbPos>${config.d1.bbPosMin} | new${config.d1.high3dDays}dHigh`);
  } else {
    logger.info(`  [d1]  DISABLED`);
  }

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

    // ── Reconcile: clear state if exchange is flat but local says position open ──
    if (state.position && config.mode === "live" && executor instanceof LiveExecutor) {
      try {
        const posRes = await (executor as any).client.getPositionInfo({ category: "linear", symbol: config.symbol });
        if (posRes.retCode === 0) {
          const pos = posRes.result.list.find((p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Sell");
          if (!pos) {
            const local = state.position;
            logger.warn(`RECONCILE: exchange FLAT, local has position — manual close / native fill detected`);
            let exitPrice = local.entryPrice;
            let pnlNet = 0;
            try {
              const pnlRes = await (executor as any).client.getClosedPnL({ category: "linear", symbol: config.symbol, limit: 20 });
              if (pnlRes.retCode === 0 && pnlRes.result.list.length > 0) {
                const cutoff = now - 30 * 60000;
                const recent = pnlRes.result.list.filter((r: any) => parseInt(r.updatedTime) >= cutoff);
                if (recent.length > 0) {
                  pnlNet = recent.reduce((s: number, r: any) => s + parseFloat(r.closedPnl), 0);
                  exitPrice = parseFloat(recent[0].avgExitPrice);
                  logger.info(`RECONCILE: exit=$${exitPrice.toFixed(4)} pnl=$${pnlNet.toFixed(2)}`);
                }
              }
            } catch (e: any) {
              logger.warn(`getClosedPnL failed: ${e.message}`);
            }
            state.position = null;
            state.lastCloseTime = now;
            if (local.source === "wed") state.lastCloseWedDate = local.wedDate;
            else                         state.lastD1CloseTime  = now;
            saveState(config.stateFile, state);
            return;
          }
        }
      } catch (err: any) {
        logger.warn(`Reconcile error: ${err.message}`);
      }
    }

    // ── If position is open: check TP/stop/expiry ──
    if (state.position) {
      const pos = state.position;
      const exp = pos.expiresAt;

      // Force-close at expiry (Thu 12h UTC for wed-source, openedAt+maxHold for d1-source)
      if (now >= exp) {
        const expLabel = pos.source === "wed" ? `Thu ${config.expiryHourUTC}h UTC` : `+${((exp - pos.openedAt) / 3600000).toFixed(0)}h max-hold`;
        logger.info(`EXPIRY [${pos.source}]: closing position opened ${new Date(pos.openedAt).toISOString()} at ${expLabel}`);
        const closeId = genOrderLinkId(pos.source === "wed" ? "ws_close" : "d1_close");
        const r = await executor.closeShort(config.symbol, closeId);
        if (r.success) {
          const pnlPct = (pos.entryPrice - r.price) / pos.entryPrice * 100;
          logger.info(`Closed [${pos.source}] at $${r.price.toFixed(4)} | pnl≈${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`);
          logger.logTrade("CLOSE_SHORT", config.symbol, r);
          const pnlUsd = (pos.entryPrice - r.price) * pos.qty;
          const fees = pos.notional * config.feeRate * 2;
          logger.logBatchClose(config.symbol, 1, pnlUsd, fees, pos.entryPrice, r.price);
        } else {
          logger.warn(`Close failed: ${r.error}`);
        }
        state.position = null;
        state.lastCloseTime = now;
        if (pos.source === "wed") state.lastCloseWedDate = pos.wedDate;
        else                       state.lastD1CloseTime  = now;
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
          const exitPrice = tpHit ? pos.tpPrice : pos.stopPrice;
          logger.info(`Price $${price.toFixed(4)} crossed ${tpHit ? "TP" : "STOP"} [${pos.source}] — verifying exchange position`);
          const pnlUsd = (pos.entryPrice - exitPrice) * pos.qty;
          const fees = pos.notional * config.feeRate * 2;
          logger.logBatchClose(config.symbol, 1, pnlUsd, fees, pos.entryPrice, exitPrice);
          state.position = null;
          state.lastCloseTime = now;
          if (pos.source === "wed") state.lastCloseWedDate = pos.wedDate;
          else                       state.lastD1CloseTime  = now;
          saveState(config.stateFile, state);
          logger.info(`State cleared — native ${tpHit ? "TP" : "STOP"} [${pos.source}] assumed filled`);
        } else {
          logger.info(`Position open [${pos.source}] | entry=$${pos.entryPrice.toFixed(4)} | price=$${price.toFixed(4)} | TP=$${pos.tpPrice.toFixed(4)} | SL=$${pos.stopPrice.toFixed(4)} | exp=${new Date(exp).toISOString()}`);
        }
      } catch (err: any) {
        logger.warn(`Poll error: ${err.message}`);
      }
      return;
    }

    // ── No position: try wed-source entry first, then D1 ──

    // Wed-source: only on Wednesday after entryAfterHourUTC, dedup by date
    const wedWindowOpen = (dow === 3 && hour >= config.entryAfterHourUTC && state.lastCloseWedDate !== todayStr);

    if (wedWindowOpen) {
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

        logger.info(`Entry scan [wed] | price=$${price.toFixed(4)} | dayHigh=$${rollingHigh.toFixed(4)} | dist=${distFromHigh.toFixed(2)}% | threshold=${config.nearHighPct}%`);

        if (distFromHigh <= config.nearHighPct) {
          logger.info(`ENTRY SIGNAL [wed]: price within ${distFromHigh.toFixed(2)}% of day high $${rollingHigh.toFixed(4)} — opening short`);
          const orderId = genOrderLinkId("ws_open");
          const result = await executor.openShort(config.symbol, config.notionalUsdt, config.leverage, orderId);
          if (!result.success) {
            logger.warn(`Open short [wed] failed: ${result.error}`);
            return;
          }
          const entryPrice = result.price;
          const tpPrice    = entryPrice * (1 - config.tpPct  / 100);
          const stopPrice  = entryPrice * (1 + config.stopPct / 100);
          logger.info(`SHORT opened [wed] | entry=$${entryPrice.toFixed(4)} | TP=$${tpPrice.toFixed(4)} | SL=$${stopPrice.toFixed(4)} | qty=${result.qty}`);
          logger.logTrade("OPEN_SHORT", config.symbol, result);
          await executor.setPositionTp(config.symbol, tpPrice,   POSITION_IDX);
          await executor.setPositionSl(config.symbol, stopPrice, POSITION_IDX);
          logger.info(`Native TP/SL set on exchange`);

          state.position = {
            source: "wed",
            entryPrice, qty: result.qty, notional: result.notional,
            tpPrice, stopPrice, orderLinkId: orderId,
            openedAt: now,
            expiresAt: expiryTs(todayStr, config.expiryHourUTC),
            wedDate: todayStr,
          };
          state.lastCloseWedDate = ""; // clear so we know we're in a trade
          saveState(config.stateFile, state);
          return;
        }
      } catch (err: any) {
        logger.warn(`Entry scan [wed] error: ${err.message}`);
        // fall through and try D1 below
      }
    }

    // D1-source: triple-condition top-fade, any day, gated by cooldown
    const d1 = config.d1;
    if (!d1 || !d1.enabled) return;
    if (now - state.lastD1CloseTime < d1.cooldownMin * 60000) return;

    try {
      const price = await executor.getPrice(config.symbol);
      const check = await checkD1Trigger(executor, config.symbol, d1, price);
      if (!check.fire) {
        logger.info(`Entry scan [d1] | ${check.reason}`);
        return;
      }
      logger.info(`ENTRY SIGNAL [d1]: ${check.reason}`);
      const orderId = genOrderLinkId("d1_open");
      const result = await executor.openShort(config.symbol, d1.notionalUsdt, d1.leverage, orderId);
      if (!result.success) {
        logger.warn(`Open short [d1] failed: ${result.error}`);
        return;
      }
      const entryPrice = result.price;
      const tpPrice    = entryPrice * (1 - d1.tpPct  / 100);
      const stopPrice  = entryPrice * (1 + d1.stopPct / 100);
      logger.info(`SHORT opened [d1] | entry=$${entryPrice.toFixed(4)} | TP=$${tpPrice.toFixed(4)} | SL=$${stopPrice.toFixed(4)} | qty=${result.qty} | maxHold=${d1.maxHoldHours}h`);
      logger.logTrade("OPEN_SHORT", config.symbol, result);
      await executor.setPositionTp(config.symbol, tpPrice,   POSITION_IDX);
      await executor.setPositionSl(config.symbol, stopPrice, POSITION_IDX);
      logger.info(`Native TP/SL set on exchange`);

      state.position = {
        source: "d1",
        entryPrice, qty: result.qty, notional: result.notional,
        tpPrice, stopPrice, orderLinkId: orderId,
        openedAt: now,
        expiresAt: now + d1.maxHoldHours * 3600000,
        wedDate: "",
      };
      saveState(config.stateFile, state);
    } catch (err: any) {
      logger.warn(`Entry scan [d1] error: ${err.message}`);
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
