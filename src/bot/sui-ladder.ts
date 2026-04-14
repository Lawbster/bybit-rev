// ─────────────────────────────────────────────
// SUI EMA Dip Ladder Bot
//
// Strategy: SUIUSDT long ladder triggered when
// price closes X% below EMA(N) on a completed 1H bar.
// DCA martingale: each rung scales by scaleFactor,
// spaced rungSpacingPct apart.
//
// Exit: TP at tpPct% above weighted avg entry,
// SL at slPct% below, or force-close at maxHoldHours.
//
// Uses positionIdx=1 (long side, hedge mode).
// Shares the same Bybit account as the HYPE bot.
// ─────────────────────────────────────────────

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { BotLogger } from "./monitor";
import { PriceFeed, PriceUpdate } from "./price-feed";
import { Candle } from "../fetch-candles";
import { EMA } from "technicalindicators";
import { LadderAlerter } from "./ladder-alerter";

// ── Config ──

interface SuiLadderConfig {
  mode: string;
  symbol: string;
  leverage: number;
  feeRate: number;
  pollIntervalSec: number;
  stateFile: string;
  logDir: string;

  baseNotionalUsdt: number;
  scaleFactor: number;
  maxRungs: number;
  rungSpacingPct: number;
  tpPct: number;
  slPct: number;
  maxHoldHours: number;
  cooldownHours: number;

  emaPeriod: number;
  emaTriggerPct: number;
  emaInterval: string;  // "60" = 1H candles
  emaLookback: number;  // how many candles to fetch

  signalPrefix: string; // e.g. "sui" → sui-pause, sui-flatten, sui-resume
}

// ── State ──

interface LadderRung {
  price: number;
  qty: number;
  notional: number;
  orderId: string;
  addedAt: number;
}

interface SuiLadderState {
  rungs: LadderRung[];
  avgEntry: number;
  totalNotional: number;
  totalQty: number;
  openedAt: number;
  lastCloseTime: number;
  lastRungPrice: number;  // price at which last rung was added
  realizedPnl: number;
  tradeCount: number;
}

const EMPTY_STATE: SuiLadderState = {
  rungs: [],
  avgEntry: 0,
  totalNotional: 0,
  totalQty: 0,
  openedAt: 0,
  lastCloseTime: 0,
  lastRungPrice: 0,
  realizedPnl: 0,
  tradeCount: 0,
};

const POSITION_IDX = 1; // long side in Bybit hedge mode

function loadConfig(): SuiLadderConfig {
  const file = process.argv.find(a => a.startsWith("--config="))?.split("=")[1] || "sui-ladder-config.json";
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function loadState(file: string): SuiLadderState {
  if (!fs.existsSync(file)) return { ...EMPTY_STATE };
  try {
    return { ...EMPTY_STATE, ...JSON.parse(fs.readFileSync(file, "utf-8")) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

function saveState(file: string, state: SuiLadderState) {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

function recalcAvg(state: SuiLadderState) {
  if (state.rungs.length === 0) {
    state.avgEntry = 0;
    state.totalNotional = 0;
    state.totalQty = 0;
    return;
  }
  state.totalQty = state.rungs.reduce((s, r) => s + r.qty, 0);
  state.totalNotional = state.rungs.reduce((s, r) => s + r.notional, 0);
  state.avgEntry = state.rungs.reduce((s, r) => s + r.price * r.qty, 0) / state.totalQty;
}

// ── Signal file checks ──
const SIGNAL_DIR = process.cwd();

function checkSignals(prefix: string, logger: BotLogger): { paused: boolean; flattenRequested: boolean } {
  const PAUSE   = path.join(SIGNAL_DIR, `${prefix}-pause`);
  const FLATTEN = path.join(SIGNAL_DIR, `${prefix}-flatten`);
  const RESUME  = path.join(SIGNAL_DIR, `${prefix}-resume`);

  let paused = false;
  let flattenRequested = false;

  if (fs.existsSync(RESUME)) {
    if (fs.existsSync(PAUSE)) {
      fs.unlinkSync(PAUSE);
      logger.info(`SIGNAL: ${prefix}-resume — pause cleared`);
    }
    fs.unlinkSync(RESUME);
  }

  if (fs.existsSync(FLATTEN)) {
    flattenRequested = true;
    fs.unlinkSync(FLATTEN);
    if (!fs.existsSync(PAUSE)) {
      fs.writeFileSync(PAUSE, `paused by ${prefix}-flatten at ${new Date().toISOString()}\n`);
    }
    logger.warn(`SIGNAL: ${prefix}-flatten — will flatten and pause`);
  }

  if (fs.existsSync(PAUSE)) paused = true;

  return { paused, flattenRequested };
}

// ── Main ──

async function run() {
  const config = loadConfig();
  const logger = new BotLogger(config.logDir);
  const stateFile = path.resolve(process.cwd(), config.stateFile);
  let state = loadState(stateFile);

  // ── Executor ──
  let executor: Executor;
  if (config.mode === "live") {
    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      logger.logError("LIVE mode requires BYBIT_API_KEY and BYBIT_API_SECRET in .env");
      process.exit(1);
    }
    executor = new LiveExecutor(apiKey, apiSecret, logger);
    logger.warn(`${config.symbol} LADDER — LIVE MODE, real orders on MAIN account`);
  } else {
    executor = new DryRunExecutor(logger);
    logger.info(`${config.symbol} LADDER — DRY-RUN mode`);
  }

  // ── Ensure hedge mode ──
  if (config.mode === "live") {
    const hedgeOk = await executor.ensureHedgeMode(config.symbol);
    if (!hedgeOk) {
      logger.logError("Hedge mode not confirmed — exiting. Enable hedge mode on Bybit first.");
      process.exit(1);
    }
  }

  // Discord alerter (no-op if DISCORD_WEBHOOK_{SYMBOL} not set)
  const alerter = new LadderAlerter(config.symbol);
  if (alerter.enabled) logger.info(`Discord alerter enabled for ${config.symbol}`);

  // ── Reconcile on startup ──
  if (config.mode === "live" && state.rungs.length > 0) {
    try {
      const liveExec = executor as LiveExecutor;
      const posRes = await (liveExec as any).client.getPositionInfo({
        category: "linear",
        symbol: config.symbol,
      });
      if (posRes.retCode === 0) {
        const pos = posRes.result.list.find(
          (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Buy",
        );
        if (!pos) {
          logger.warn("RECONCILE: Exchange is FLAT but local has rungs — clearing state");
          const rungCount = state.rungs.length;
          const avgEntry = state.avgEntry;

          // Query closed PnL (wider window for startup — last 30 min)
          try {
            const pnlRes = await (liveExec as any).client.getClosedPnL({
              category: "linear",
              symbol: config.symbol,
              limit: 20,
            });
            if (pnlRes.retCode === 0 && pnlRes.result.list.length > 0) {
              const cutoff = Date.now() - 30 * 60000;
              const recentCloses = pnlRes.result.list.filter(
                (r: any) => parseInt(r.updatedTime) >= cutoff,
              );
              if (recentCloses.length > 0) {
                const totalClosedPnl = recentCloses.reduce((s: number, r: any) => s + parseFloat(r.closedPnl), 0);
                const exitPrice = parseFloat(recentCloses[0].avgExitPrice);
                const fees = state.totalNotional * config.feeRate + exitPrice * state.totalQty * config.feeRate;
                state.realizedPnl += totalClosedPnl;
                state.tradeCount++;
                state.lastCloseTime = Date.now();
                logger.logBatchClose(config.symbol, rungCount, totalClosedPnl, fees, avgEntry, exitPrice);
                logger.info(`RECONCILE (startup): Actual PnL from exchange: $${totalClosedPnl.toFixed(2)} @ exit $${exitPrice.toFixed(4)}`);
                const holdHours = state.openedAt ? (Date.now() - state.openedAt) / 3600000 : 0;
                await alerter.notifyClosed("reconciled on startup", rungCount, avgEntry, exitPrice, totalClosedPnl, holdHours);
              }
            }
          } catch (pnlErr: any) {
            logger.warn(`RECONCILE: getClosedPnL failed on startup: ${(pnlErr as Error).message}`);
          }

          state.rungs = [];
          recalcAvg(state);
          saveState(stateFile, state);
        }
      }
    } catch (err: any) {
      logger.warn(`Reconciliation error: ${err.message}`);
    }
  }

  const maxNotional = calcMaxNotional(config.baseNotionalUsdt, config.scaleFactor, config.maxRungs);
  logger.info(`${config.symbol} Ladder starting | ${config.mode} | base=$${config.baseNotionalUsdt} × ${config.scaleFactor} max ${config.maxRungs}R`);
  logger.info(`TP=${config.tpPct}% SL=${config.slPct}% hold=${config.maxHoldHours}h cooldown=${config.cooldownHours}h`);
  logger.info(`EMA${config.emaPeriod} trigger=${config.emaTriggerPct}% | spacing=${config.rungSpacingPct}%`);
  logger.info(`Max theoretical notional: $${maxNotional.toFixed(0)}`);

  if (state.rungs.length > 0) {
    logger.info(`Resumed: ${state.rungs.length} rungs open, avg $${state.avgEntry.toFixed(4)}, notional $${state.totalNotional.toFixed(0)}, PnL $${state.realizedPnl.toFixed(2)}`);
  }

  // ── WebSocket price feed ──
  const priceFeed = new PriceFeed(config.symbol);
  let latestPrice: PriceUpdate | null = null;
  let orderInFlight = false;

  priceFeed.on("price", (update: PriceUpdate) => { latestPrice = update; });
  priceFeed.on("connected", () => logger.info(`WebSocket connected for ${config.symbol}`));
  priceFeed.on("error", (err: any) => logger.logError(`WebSocket error: ${err?.message || err}`));
  priceFeed.on("reconnecting", () => logger.warn("WebSocket reconnecting..."));

  priceFeed.start();
  try {
    await priceFeed.waitForPrice(15000);
    logger.info(`First price: $${latestPrice!.bid1.toFixed(4)}`);
  } catch {
    logger.warn("WebSocket timeout — falling back to REST");
    const p = await executor.getPrice(config.symbol);
    latestPrice = { symbol: config.symbol, lastPrice: p, bid1: p, ask1: p, fundingRate: 0, nextFundingTime: 0, timestamp: Date.now() };
  }

  // ── Update native TP/SL on exchange ──
  async function updateExchangeTpSl(): Promise<void> {
    if (config.mode !== "live" || state.rungs.length === 0) return;
    const tpPrice = state.avgEntry * (1 + config.tpPct / 100);
    const slPrice = state.avgEntry * (1 - config.slPct / 100);
    await executor.setPositionTp(config.symbol, tpPrice, POSITION_IDX);
    await executor.setPositionSl(config.symbol, slPrice, POSITION_IDX);
    logger.info(`Native TP/SL set: TP $${tpPrice.toFixed(4)} SL $${slPrice.toFixed(4)} (avg $${state.avgEntry.toFixed(4)})`);
  }

  // Set TP/SL on startup if resuming
  if (state.rungs.length > 0) {
    await updateExchangeTpSl();
  }

  // ── Close ladder helper ──
  async function closeLadder(reason: string, price: number): Promise<void> {
    if (state.rungs.length === 0) return;
    orderInFlight = true;
    try {
      logger.warn(`CLOSE: ${reason}`);

      let exitPrice = price;
      if (config.mode === "live") {
        const closeId = genOrderLinkId(`${config.symbol.replace("USDT","").toLowerCase()}_close`);
        const result = await executor.closeAllLongs(config.symbol, closeId);
        if (!result.success) {
          logger.logError(`Close FAILED: ${result.error}`);
          return;
        }
        exitPrice = result.qty > 0 ? result.price : price;
        logger.logTrade("CLOSE_ALL", config.symbol, result);
      }

      const pnlRaw = (exitPrice - state.avgEntry) * state.totalQty;
      const fees = state.totalNotional * config.feeRate + exitPrice * state.totalQty * config.feeRate;
      const pnl = pnlRaw - fees;

      state.realizedPnl += pnl;
      state.tradeCount++;
      state.lastCloseTime = Date.now();

      const rungCount = state.rungs.length;
      const holdH = ((Date.now() - state.openedAt) / 3600000).toFixed(1);

      logger.info(`CLOSED ${rungCount}R | avg $${state.avgEntry.toFixed(4)} → $${exitPrice.toFixed(4)} | PnL $${pnl.toFixed(2)} | notional $${state.totalNotional.toFixed(0)} | ${holdH}h | ${reason}`);
      logger.info(`Cumulative: ${state.tradeCount} trades, $${state.realizedPnl.toFixed(2)} realized`);
      logger.logBatchClose(config.symbol, rungCount, pnlRaw, fees, state.avgEntry, exitPrice);

      await alerter.notifyClosed(reason, rungCount, state.avgEntry, exitPrice, pnl, parseFloat(holdH));

      state.rungs = [];
      recalcAvg(state);
      saveState(stateFile, state);
    } finally {
      orderInFlight = false;
    }
  }

  // ── Open/add rung helper ──
  async function addRung(price: number): Promise<boolean> {
    const rungIndex = state.rungs.length;
    const notional = config.baseNotionalUsdt * Math.pow(config.scaleFactor, rungIndex);
    const qty = notional / price;

    orderInFlight = true;
    try {
      let fillPrice = price;
      let fillQty = qty;
      let orderId = "";

      if (config.mode === "live") {
        const oid = genOrderLinkId(`${config.symbol.replace("USDT","").toLowerCase()}_add`);
        const result = await executor.openLong(config.symbol, notional, config.leverage, oid);
        if (!result.success) {
          logger.logError(`Add rung ${rungIndex + 1} FAILED: ${result.error}`);
          return false;
        }
        fillPrice = result.price;
        fillQty = result.qty;
        orderId = result.orderId;
        logger.logTrade("OPEN_LONG", config.symbol, result);
      }

      state.rungs.push({
        price: fillPrice,
        qty: fillQty,
        notional: fillQty * fillPrice,
        orderId,
        addedAt: Date.now(),
      });

      if (rungIndex === 0) state.openedAt = Date.now();
      state.lastRungPrice = fillPrice;
      recalcAvg(state);
      saveState(stateFile, state);

      logger.info(`RUNG ${rungIndex + 1}/${config.maxRungs} | $${fillPrice.toFixed(4)} | $${(fillQty * fillPrice).toFixed(0)} notional | avg $${state.avgEntry.toFixed(4)} | total $${state.totalNotional.toFixed(0)}`);

      await alerter.notifyRungOpened(rungIndex, config.maxRungs, fillPrice, state.avgEntry, state.totalNotional);

      // Update native TP/SL after every rung add
      await updateExchangeTpSl();

      return true;
    } finally {
      orderInFlight = false;
    }
  }

  // ── EMA cache ──
  let emaCache: { candles: Candle[]; ema: number; fetchedAt: number } = { candles: [], ema: 0, fetchedAt: 0 };
  const EMA_TTL = 55 * 60 * 1000; // refresh near the end of each hour

  async function getEma(): Promise<{ ema: number; lastClose: number } | null> {
    if (Date.now() - emaCache.fetchedAt < EMA_TTL && emaCache.ema > 0) {
      return { ema: emaCache.ema, lastClose: emaCache.candles[emaCache.candles.length - 1].close };
    }
    try {
      let candles: Candle[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          candles = await executor.getCandles(config.symbol, config.emaInterval, config.emaLookback);
          break;
        } catch (err: any) {
          if (attempt < 2 && /rate limit|too many/i.test(err.message)) {
            logger.warn(`Rate limited on getCandles, retry ${attempt + 1}/3 in ${(attempt + 1) * 2}s`);
            await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          } else {
            throw err;
          }
        }
      }
      if (candles.length < config.emaPeriod + 1) return null;

      // Use completed bars only — drop the last (in-progress) bar
      const completed = candles.slice(0, -1);
      const closes = completed.map(c => c.close);
      const emaValues = EMA.calculate({ period: config.emaPeriod, values: closes });
      if (emaValues.length === 0) return null;

      const ema = emaValues[emaValues.length - 1];
      const lastClose = completed[completed.length - 1].close;
      emaCache = { candles: completed, ema, fetchedAt: Date.now() };
      return { ema, lastClose };
    } catch (err: any) {
      logger.logError(`EMA fetch error: ${err.message}`);
      return null;
    }
  }

  // ── WS TP/SL watcher ──
  priceFeed.on("price", async (update: PriceUpdate) => {
    if (orderInFlight || state.rungs.length === 0) return;

    const tpPrice = state.avgEntry * (1 + config.tpPct / 100);
    const slPrice = state.avgEntry * (1 - config.slPct / 100);

    // TP hit — use bid (executable exit for longs)
    if (update.bid1 >= tpPrice) {
      logger.info(`TP HIT: bid $${update.bid1.toFixed(4)} >= TP $${tpPrice.toFixed(4)}`);
      await closeLadder("TP hit", update.bid1);
      return;
    }

    // SL hit — use bid
    if (update.bid1 <= slPrice) {
      logger.warn(`SL HIT: bid $${update.bid1.toFixed(4)} <= SL $${slPrice.toFixed(4)}`);
      await closeLadder("SL hit", update.bid1);
      return;
    }

    // Approach checks (edge-triggered, no-op if already fired this ladder)
    void alerter.checkSlApproach(update.bid1, slPrice, state.avgEntry, state.rungs.length);
    void alerter.checkNextRungApproach(update.bid1, state.lastRungPrice, config.rungSpacingPct, state.rungs.length, config.maxRungs);
  });

  // ── REST heartbeat for stale WS ──
  const WS_STALE_MS = 10_000;
  setInterval(async () => {
    if (!latestPrice || orderInFlight || state.rungs.length === 0) return;
    if (Date.now() - latestPrice.timestamp < WS_STALE_MS) return;

    try {
      const price = await executor.getPrice(config.symbol);
      const tpPrice = state.avgEntry * (1 + config.tpPct / 100);
      const slPrice = state.avgEntry * (1 - config.slPct / 100);

      if (price >= tpPrice) {
        logger.info(`TP HIT via REST: $${price.toFixed(4)} >= $${tpPrice.toFixed(4)}`);
        await closeLadder("TP hit (REST)", price);
      } else if (price <= slPrice) {
        logger.warn(`SL HIT via REST: $${price.toFixed(4)} <= $${slPrice.toFixed(4)}`);
        await closeLadder("SL hit (REST)", price);
      }
    } catch (err: any) {
      logger.logError(`REST heartbeat error: ${err.message}`);
    }
  }, 5000);

  // ── Periodic reconciliation ──
  const RECONCILE_MS = 5 * 60 * 1000;
  let lastReconcile = Date.now();

  // ── Main poll loop ──
  const sigPrefix = config.signalPrefix || config.symbol.replace("USDT", "").toLowerCase();
  logger.info(`Signal files: touch ${sigPrefix}-pause | ${sigPrefix}-flatten | ${sigPrefix}-resume`);
  logger.info(`Main loop starting (poll every ${config.pollIntervalSec}s, TP/SL on WebSocket)\n`);

  let cycleCount = 0;

  while (true) {
    try {
      cycleCount++;
      const now = Date.now();
      const price = latestPrice?.bid1 || await executor.getPrice(config.symbol);

      // ── Signal files ──
      const prefix = config.signalPrefix || config.symbol.replace("USDT", "").toLowerCase();
      const signals = checkSignals(prefix, logger);

      if (signals.flattenRequested && state.rungs.length > 0 && !orderInFlight) {
        await closeLadder(`MANUAL FLATTEN via ${prefix}-flatten`, price);
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      if (signals.paused) {
        if (cycleCount % 6 === 0) {
          logger.info(`PAUSED — ${state.rungs.length} rungs, $${state.realizedPnl.toFixed(2)} realized. touch sui-resume to resume.`);
        }
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // ── Reconciliation (live mode) ──
      if (config.mode === "live" && now - lastReconcile >= RECONCILE_MS) {
        lastReconcile = now;
        try {
          const liveExec = executor as LiveExecutor;
          const posRes = await (liveExec as any).client.getPositionInfo({
            category: "linear",
            symbol: config.symbol,
          });
          if (posRes.retCode === 0) {
            const pos = posRes.result.list.find(
              (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Buy",
            );
            if (state.rungs.length > 0 && !pos) {
              logger.warn("RECONCILE: Exchange FLAT, local has rungs — manual close or native TP/SL fired.");
              const rungCount = state.rungs.length;
              const avgEntry = state.avgEntry;
              const reconcileOpenedAt = state.openedAt;

              // Query Bybit closed PnL for actual exit price + realized PnL
              let usedExchange = false;
              let reconExitPrice = price;
              let reconPnlUsd = 0;
              try {
                const pnlRes = await (liveExec as any).client.getClosedPnL({
                  category: "linear",
                  symbol: config.symbol,
                  limit: 20,
                });
                if (pnlRes.retCode === 0 && pnlRes.result.list.length > 0) {
                  const cutoff = Date.now() - 5 * 60000;
                  const recentCloses = pnlRes.result.list.filter(
                    (r: any) => parseInt(r.updatedTime) >= cutoff,
                  );
                  if (recentCloses.length > 0) {
                    const totalClosedPnl = recentCloses.reduce((s: number, r: any) => s + parseFloat(r.closedPnl), 0);
                    const exitPrice = parseFloat(recentCloses[0].avgExitPrice);
                    const fees = state.totalNotional * config.feeRate + exitPrice * state.totalQty * config.feeRate;
                    state.realizedPnl += totalClosedPnl;
                    state.tradeCount++;
                    state.lastCloseTime = now;
                    logger.logBatchClose(config.symbol, rungCount, totalClosedPnl, fees, avgEntry, exitPrice);
                    logger.info(`RECONCILE: Actual PnL from exchange: $${totalClosedPnl.toFixed(2)} @ exit $${exitPrice.toFixed(4)}`);
                    reconExitPrice = exitPrice;
                    reconPnlUsd = totalClosedPnl;
                    usedExchange = true;
                  }
                }
              } catch (pnlErr: any) {
                logger.warn(`RECONCILE: getClosedPnL failed: ${pnlErr.message} — falling back to price approximation`);
              }

              if (!usedExchange) {
                // Fallback: approximate from last known price
                const pnlRaw = (price - state.avgEntry) * state.totalQty;
                const fees = state.totalNotional * config.feeRate * 2;
                state.realizedPnl += pnlRaw - fees;
                state.tradeCount++;
                state.lastCloseTime = now;
                logger.logBatchClose(config.symbol, rungCount, pnlRaw, fees, avgEntry, price);
                logger.info(`RECONCILE: PnL approximated: $${(pnlRaw - fees).toFixed(2)}`);
                reconExitPrice = price;
                reconPnlUsd = pnlRaw - fees;
              }

              state.rungs = [];
              recalcAvg(state);
              saveState(stateFile, state);

              // Discord alert for externally-closed ladder
              const holdHours = reconcileOpenedAt ? (Date.now() - reconcileOpenedAt) / 3600000 : 0;
              await alerter.notifyClosed("reconciled (external close)", rungCount, avgEntry, reconExitPrice, reconPnlUsd, holdHours);
            }
          }
        } catch (err: any) {
          logger.warn(`Reconcile error: ${err.message}`);
        }
      }

      // ── Max hold expiry ──
      if (state.rungs.length > 0) {
        const holdMs = now - state.openedAt;
        if (holdMs >= config.maxHoldHours * 3600000) {
          logger.warn(`MAX HOLD: ${(holdMs / 3600000).toFixed(1)}h >= ${config.maxHoldHours}h`);
          await closeLadder("max hold expiry", price);
          await sleep(config.pollIntervalSec * 1000);
          continue;
        }
      }

      // ── Status print ──
      if (cycleCount % 10 === 0) {
        if (state.rungs.length > 0) {
          const tpPrice = state.avgEntry * (1 + config.tpPct / 100);
          const slPrice = state.avgEntry * (1 - config.slPct / 100);
          const unrealPct = ((price - state.avgEntry) / state.avgEntry * 100).toFixed(2);
          const unrealUsd = ((price - state.avgEntry) * state.totalQty).toFixed(2);
          const holdH = ((now - state.openedAt) / 3600000).toFixed(1);
          logger.info(`${state.rungs.length}R | avg $${state.avgEntry.toFixed(4)} | price $${price.toFixed(4)} (${unrealPct}% / $${unrealUsd}) | TP $${tpPrice.toFixed(4)} SL $${slPrice.toFixed(4)} | ${holdH}h | $${state.totalNotional.toFixed(0)} notional`);
        } else {
          const emaData = await getEma();
          if (emaData) {
            const dist = ((price - emaData.ema) / emaData.ema * 100).toFixed(2);
            const coolRemain = state.lastCloseTime > 0
              ? Math.max(0, config.cooldownHours - (now - state.lastCloseTime) / 3600000).toFixed(1)
              : "0";
            logger.info(`FLAT | price $${price.toFixed(4)} | EMA${config.emaPeriod} $${emaData.ema.toFixed(4)} (${dist}%) | trigger <-${config.emaTriggerPct}% | cooldown ${coolRemain}h`);
          }
        }
      }

      // ── Entry / add rung logic ──
      if (!orderInFlight) {
        // Cooldown check
        if (state.rungs.length === 0 && state.lastCloseTime > 0) {
          const cooldownMs = config.cooldownHours * 3600000;
          if (now - state.lastCloseTime < cooldownMs) {
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        }

        if (state.rungs.length === 0) {
          // ── No position: check EMA trigger ──
          const emaData = await getEma();
          if (emaData) {
            const dist = ((emaData.lastClose - emaData.ema) / emaData.ema) * 100;
            if (dist <= -config.emaTriggerPct) {
              logger.info(`TRIGGER: 1H close $${emaData.lastClose.toFixed(4)} is ${dist.toFixed(2)}% below EMA${config.emaPeriod} $${emaData.ema.toFixed(4)} (threshold -${config.emaTriggerPct}%)`);
              await addRung(price);
            } else {
              // Approach alert: live price (not 1H close) approaching trigger line
              void alerter.checkTriggerApproach(price, emaData.ema, config.emaTriggerPct);
            }
          }
        } else if (state.rungs.length < config.maxRungs) {
          // ── Position open: check spacing for next rung ──
          const dropFromLastRung = ((price - state.lastRungPrice) / state.lastRungPrice) * 100;
          if (dropFromLastRung <= -config.rungSpacingPct) {
            logger.info(`SPACING: price $${price.toFixed(4)} dropped ${dropFromLastRung.toFixed(2)}% from last rung $${state.lastRungPrice.toFixed(4)}`);
            await addRung(price);
          }
        }
      }

    } catch (err: any) {
      logger.logError(`Loop error: ${err.message}`);
    }

    await sleep(config.pollIntervalSec * 1000);
  }
}

function calcMaxNotional(base: number, scale: number, maxRungs: number): number {
  let total = 0, rung = base;
  for (let i = 0; i < maxRungs; i++) { total += rung; rung *= scale; }
  return total;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
