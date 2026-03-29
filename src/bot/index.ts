import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { loadBotConfig, saveBotConfigTemplate } from "./bot-config";
import { StateManager } from "./state";
import { BotLogger } from "./monitor";
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { PriceFeed, PriceUpdate } from "./price-feed";
import {
  checkBatchTp, calcAddSize, canAffordAdd,
  checkTrendGate, checkMarketRiskOff, checkLadderKill,
  checkVolExpansion, calcEquity,
} from "./strategy";
import { Candle } from "../fetch-candles";

// ─────────────────────────────────────────────
// 2Moon DCA Ladder Bot — Main Loop
// WebSocket-driven TP + REST candle refresh
// ─────────────────────────────────────────────

/** Returns true if the bot is connected to an exchange (paper subaccount or live main) */
function isExchangeMode(mode: string): boolean {
  return mode === "paper" || mode === "live";
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--init")) {
    saveBotConfigTemplate();
    return;
  }

  const configPath = args.find(a => a.startsWith("--config="))?.split("=")[1];
  const config = loadBotConfig(configPath);

  const logger = new BotLogger(config.logDir);
  const state = new StateManager(config.stateFile);

  // ── Choose executor ──
  let executor: Executor;

  if (config.mode === "paper") {
    const apiKey = process.env.BYBIT_SUBACOUNT_API_KEY;
    const apiSecret = process.env.BYBIT_SUBACOUNT_API_SECRET;
    if (!apiKey || !apiSecret) {
      logger.logError("PAPER mode requires BYBIT_SUBACOUNT_API_KEY and BYBIT_SUBACOUNT_API_SECRET in .env");
      process.exit(1);
    }
    executor = new LiveExecutor(apiKey, apiSecret, logger);
    logger.info("PAPER MODE — subaccount API, real orders on zero-balance account");
  } else if (config.mode === "live") {
    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      logger.logError("LIVE mode requires BYBIT_API_KEY and BYBIT_API_SECRET in .env");
      process.exit(1);
    }
    executor = new LiveExecutor(apiKey, apiSecret, logger);
    logger.warn("LIVE MODE — real orders will be placed on MAIN account!");
  } else {
    executor = new DryRunExecutor(logger);
    logger.info("DRY-RUN mode — no real orders, market data only");
  }

  logger.info(`Bot starting: ${config.symbol} | ${executor.getMode()} | ${config.basePositionUsdt}x${config.addScaleFactor} max${config.maxPositions} TP${config.tpPct}%`);
  logger.info(`Filters: trend=${config.filters.trendBreak} riskOff=${config.filters.marketRiskOff} vol=${config.filters.volExpansion} ladderKill=${config.filters.ladderLocalKill}`);

  // ── Startup reconciliation ──
  if (isExchangeMode(config.mode)) {
    await reconcileOnStartup(executor, state, config, logger);
  }

  const s = state.get();
  if (s.positions.length > 0) {
    logger.info(`Resumed with ${s.positions.length} open positions, $${s.realizedPnl.toFixed(2)} realized PnL`);
  }

  // ── Candle cache ──
  let hype4hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };
  let btc1hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };
  let hype1hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };

  const CACHE_TTL_4H = 4 * 60 * 60 * 1000;
  const CACHE_TTL_1H = 60 * 60 * 1000;

  async function getHype4h(): Promise<Candle[]> {
    if (Date.now() - hype4hCache.fetchedAt < CACHE_TTL_4H && hype4hCache.candles.length > 0) {
      return hype4hCache.candles;
    }
    hype4hCache.candles = await executor.getCandles(config.symbol, "240", 250);
    hype4hCache.fetchedAt = Date.now();
    return hype4hCache.candles;
  }

  async function getBtc1h(): Promise<Candle[]> {
    if (Date.now() - btc1hCache.fetchedAt < CACHE_TTL_1H && btc1hCache.candles.length > 0) {
      return btc1hCache.candles;
    }
    btc1hCache.candles = await executor.getCandles("BTCUSDT", "60", 5);
    btc1hCache.fetchedAt = Date.now();
    return btc1hCache.candles;
  }

  async function getHype1h(): Promise<Candle[]> {
    if (Date.now() - hype1hCache.fetchedAt < CACHE_TTL_1H && hype1hCache.candles.length > 0) {
      return hype1hCache.candles;
    }
    hype1hCache.candles = await executor.getCandles(config.symbol, "60", 750);
    hype1hCache.fetchedAt = Date.now();
    return hype1hCache.candles;
  }

  // ── Cancel recovery TP order on flatten ──
  async function cancelRecoveryTpIfExists(): Promise<void> {
    const tpOrderId = state.getRecoveryTpOrderId();
    if (!tpOrderId) return;

    if (isExchangeMode(config.mode) && executor instanceof LiveExecutor) {
      try {
        const cancelRes = await (executor as any).client.cancelOrder({
          category: "linear",
          symbol: config.symbol,
          orderId: tpOrderId,
        });
        if (cancelRes.retCode === 0) {
          logger.info(`Cancelled recovery TP order ${tpOrderId}`);
        } else {
          // Might already be filled or cancelled — that's fine
          logger.info(`Recovery TP order ${tpOrderId} cancel: ${cancelRes.retMsg} (may already be filled)`);
        }
      } catch (err: any) {
        logger.warn(`Failed to cancel recovery TP: ${err.message}`);
      }
    }
    state.setRecoveryTpOrderId("");
  }

  // ── Track capital ──
  let capital = config.initialCapital + state.get().realizedPnl;

  // ── WebSocket price feed for TP detection ──
  const priceFeed = new PriceFeed(config.symbol);
  let latestPrice: PriceUpdate | null = null;

  priceFeed.on("price", (update: PriceUpdate) => {
    latestPrice = update;
  });

  priceFeed.on("connected", () => {
    logger.info(`WebSocket connected for ${config.symbol} ticker`);
  });

  priceFeed.on("error", (err: any) => {
    logger.logError(`WebSocket error: ${err?.message || err}`);
  });

  priceFeed.on("reconnecting", () => {
    logger.warn("WebSocket reconnecting...");
  });

  priceFeed.start();
  logger.info("Waiting for WebSocket price feed...");

  try {
    await priceFeed.waitForPrice(15000);
    logger.info(`First price: $${latestPrice!.bid1.toFixed(4)} bid / $${latestPrice!.ask1.toFixed(4)} ask`);
  } catch {
    logger.warn("WebSocket timeout — falling back to REST for initial price");
    const restPrice = await executor.getPrice(config.symbol);
    latestPrice = { symbol: config.symbol, lastPrice: restPrice, bid1: restPrice, ask1: restPrice, timestamp: Date.now() };
  }

  // ── In-flight order protection ──
  let orderInFlight = false;

  // ── WS stale detection + REST heartbeat ──
  const WS_STALE_WARN_MS = 10_000;   // REST heartbeat if no WS for 10s
  const WS_STALE_BLOCK_MS = 30_000;  // block new adds if no WS for 30s
  let wsFeedStale = false;

  // REST heartbeat: check TP via REST when WS goes quiet
  const heartbeatInterval = setInterval(async () => {
    if (!latestPrice || orderInFlight) return;

    const wsSilence = Date.now() - latestPrice.timestamp;

    if (wsSilence > WS_STALE_BLOCK_MS) {
      if (!wsFeedStale) {
        wsFeedStale = true;
        logger.warn(`WS feed STALE (${(wsSilence / 1000).toFixed(0)}s) — blocking new adds, TP via REST`);
      }
    }

    // REST heartbeat for TP detection when WS is quiet
    if (wsSilence > WS_STALE_WARN_MS && state.get().positions.length > 0) {
      try {
        const restPrice = await executor.getPrice(config.symbol);
        // Update latestPrice with REST data (keeps WS timestamp to track staleness)
        latestPrice = {
          ...latestPrice,
          lastPrice: restPrice,
          bid1: restPrice,  // REST doesn't give bid1 separately, use lastPrice
          ask1: restPrice,
        };

        // Check TP on REST price
        const s = state.get();
        const tp = checkBatchTp(s.positions, config.tpPct, restPrice);
        if (tp.hit && !orderInFlight) {
          logger.info(`BATCH TP HIT via REST heartbeat: $${restPrice.toFixed(4)} >= TP $${tp.tpPrice.toFixed(4)}`);
          orderInFlight = true;
          try {
            if (isExchangeMode(config.mode)) {
              const clsId = genOrderLinkId("close");
              state.setPendingOrder({ orderLinkId: clsId, action: "close", symbol: config.symbol, notional: 0, createdAt: Date.now() });
              const closeResult = await executor.closeAllLongs(config.symbol, clsId);
              state.clearPendingOrder();
              if (closeResult.success) {
                const stateResult = state.closeAllPositions(closeResult.price, Date.now(), config.feeRate);
                capital += stateResult.totalPnl;
                logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, closeResult.price);
                if (state.isRecoveryMode()) {
                  state.setRecoveryMode(false);
                  logger.info("Recovery mode cleared — ladder fully closed on exchange.");
                }
              }
            } else {
              const stateResult = state.closeAllPositions(restPrice, Date.now(), config.feeRate);
              capital += stateResult.totalPnl;
              logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, restPrice);
            }
          } finally {
            orderInFlight = false;
          }
        }
      } catch (err: any) {
        logger.logError(`REST heartbeat error: ${err.message}`);
      }
    }
  }, 5000); // check every 5s

  // Clear stale flag when WS resumes
  priceFeed.on("price", () => {
    if (wsFeedStale) {
      wsFeedStale = false;
      logger.info("WS feed restored — resuming normal operation");
    }
  });

  // ── Main loop ──
  // TP detection runs on WS tick (sub-second).
  // Add/filter logic runs on slower REST interval.
  let cycleCount = 0;
  const SAVE_INTERVAL = 60;

  // TP watcher — runs on every WS price update
  priceFeed.on("price", async (update: PriceUpdate) => {
    if (orderInFlight) return;

    const s = state.get();
    if (s.positions.length === 0) return;

    // Use bid1 as executable exit price for longs
    const tp = checkBatchTp(s.positions, config.tpPct, update.bid1);
    if (!tp.hit) return;

    orderInFlight = true;
    try {
      logger.info(`BATCH TP HIT: bid $${update.bid1.toFixed(4)} >= TP $${tp.tpPrice.toFixed(4)} (avg entry $${tp.avgEntry.toFixed(4)})`);

      if (isExchangeMode(config.mode)) {
        const clsId = genOrderLinkId("close");
        state.setPendingOrder({ orderLinkId: clsId, action: "close", symbol: config.symbol, notional: 0, createdAt: Date.now() });
        const closeResult = await executor.closeAllLongs(config.symbol, clsId);
        state.clearPendingOrder();
        if (!closeResult.success) {
          logger.logError(`Batch close FAILED on exchange: ${closeResult.error} — state NOT cleared`);
          orderInFlight = false;
          return;
        }
        // Only clear state after confirmed exchange close
        const stateResult = state.closeAllPositions(closeResult.price, Date.now(), config.feeRate);
        capital += stateResult.totalPnl;
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, closeResult.price);
        // Clear recovery mode on successful batch close (back to flat)
        if (state.isRecoveryMode()) {
          await cancelRecoveryTpIfExists();
          state.setRecoveryMode(false);
          logger.info("Recovery mode cleared — ladder fully closed on exchange.");
        }
      } else {
        // Dry-run: simulate close at bid (quote price, not actual fill)
        const stateResult = state.closeAllPositions(update.bid1, Date.now(), config.feeRate);
        capital += stateResult.totalPnl;
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, update.bid1);
      }
    } catch (err: any) {
      logger.logError(`TP close error: ${err.message}`);
    } finally {
      orderInFlight = false;
    }
  });

  logger.info(`Main loop starting (add check every ${config.pollIntervalSec}s, TP on WebSocket bid)\n`);

  // Add/filter check loop — runs on REST interval
  while (true) {
    try {
      cycleCount++;
      const now = Date.now();
      const price = latestPrice?.bid1 || await executor.getPrice(config.symbol);
      const s = state.get();

      // Equity / drawdown
      const eq = calcEquity(s.positions, price, capital);
      const dd = s.peakEquity > 0 ? ((s.peakEquity - eq.equity) / s.peakEquity) * 100 : 0;
      state.updateEquity(eq.equity);

      // Hard drawdown kill switch
      if (config.maxDrawdownPct > 0 && dd >= config.maxDrawdownPct && !orderInFlight) {
        logger.warn(`DRAWDOWN KILL: ${dd.toFixed(1)}% >= ${config.maxDrawdownPct}%`);
        orderInFlight = true;
        if (isExchangeMode(config.mode) && s.positions.length > 0) {
          const clsId = genOrderLinkId("ddkill");
          state.setPendingOrder({ orderLinkId: clsId, action: "close", symbol: config.symbol, notional: 0, createdAt: now });
          const closeResult = await executor.closeAllLongs(config.symbol, clsId);
          state.clearPendingOrder();
          if (closeResult.success) {
            const stateResult = state.closeAllPositions(closeResult.price, now, config.feeRate);
            capital += stateResult.totalPnl;
          } else {
            logger.logError(`DD kill close FAILED: ${closeResult.error}`);
          }
        } else if (s.positions.length > 0) {
          const stateResult = state.closeAllPositions(price, now, config.feeRate);
          capital += stateResult.totalPnl;
        }
        orderInFlight = false;
        logger.logError("Bot killed by drawdown limit");
        break;
      }

      // Hard gate: no adds in recovery mode
      if (state.isRecoveryMode()) {
        if (cycleCount % 30 === 0) {
          logger.warn("RECOVERY MODE — no new adds. Manage exit only. Flatten on exchange and restart to clear.");
        }
        if (cycleCount % 6 === 0) {
          logger.printStatus(executor.getMode(), config.symbol, price, s.positions, eq.equity, capital, dd, s.lastTrendCheck.blocked, now < s.riskOffUntil);
        }
        if (cycleCount % SAVE_INTERVAL === 0) {
          logger.logEquity(s, price, eq.equity, dd);
          state.save();
        }
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // Block adds when WS feed is stale
      if (wsFeedStale) {
        if (cycleCount % 6 === 0) {
          logger.warn("WS feed stale — adds blocked until feed resumes");
        }
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // Check if we can add (timing)
      const timeSinceLastAdd = (now - s.lastAddTime) / 60000;
      const canAddTiming = s.positions.length < config.maxPositions && timeSinceLastAdd >= config.addIntervalMin;

      // Status display every ~1 min
      if (cycleCount % 6 === 0) {
        const trendCached = s.lastTrendCheck;
        logger.printStatus(executor.getMode(), config.symbol, price, s.positions, eq.equity, capital, dd, trendCached.blocked, now < s.riskOffUntil);
      }

      if (cycleCount % SAVE_INTERVAL === 0) {
        logger.logEquity(s, price, eq.equity, dd);
        state.save();
      }

      if (!canAddTiming) {
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // ── Check regime filters ──
      let blocked = false;
      let blockReason = "";

      // Trend-break gate (primary)
      const hype4h = await getHype4h();
      const trend = checkTrendGate(hype4h, config);
      state.updateTrendCheck(now, trend.blocked, trend.reason);
      if (trend.blocked) {
        blocked = true;
        blockReason = trend.reason;
      }

      // Market risk-off
      const btc1h = await getBtc1h();
      const riskOff = checkMarketRiskOff(btc1h, config, now, s.riskOffUntil);
      if (riskOff.riskOffUntil > 0) state.updateRiskOff(riskOff.riskOffUntil);
      if (riskOff.blocked) {
        blocked = true;
        blockReason = blockReason ? `${blockReason} + ${riskOff.reason}` : riskOff.reason;
      }

      // Ladder-local kill
      const ladderKill = checkLadderKill(s.positions, price, now, config);
      if (ladderKill.blocked) {
        blocked = true;
        blockReason = blockReason ? `${blockReason} + ${ladderKill.reason}` : ladderKill.reason;
      }

      // Vol expansion — SHADOW ONLY
      const hype1h = await getHype1h();
      const vol = checkVolExpansion(hype1h, config);
      logger.logFilterShadow("vol_expansion", vol.triggered, {
        atrPct: vol.atrPct,
        medianAtrPct: vol.medianAtrPct,
        reason: vol.reason,
      });

      if (blocked) {
        state.recordBlockedAdd();
        logger.logFilterBlock(blockReason);
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // ── Open new position ──
      if (orderInFlight) {
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      const level = s.positions.length;
      const notional = calcAddSize(level, config.basePositionUsdt, config.addScaleFactor);

      if (!canAffordAdd(s.positions, notional, config.leverage, capital)) {
        logger.warn(`Can't afford add: $${notional.toFixed(0)} notional, insufficient margin`);
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      logger.info(`Opening level ${level} add: $${notional.toFixed(0)} notional @ ~$${price.toFixed(4)}`);
      orderInFlight = true;

      try {
        if (isExchangeMode(config.mode)) {
          // Same orderLinkId in state and on exchange
          const openId = genOrderLinkId("open");
          state.setPendingOrder({
            orderLinkId: openId,
            action: "open",
            symbol: config.symbol,
            notional,
            createdAt: now,
          });

          const orderResult = await executor.openLong(config.symbol, notional, config.leverage, openId);
          state.clearPendingOrder();

          if (!orderResult.success) {
            logger.logError(`Failed to open position: ${orderResult.error}`);
            continue;
          }
          state.addPosition({
            entryPrice: orderResult.price,  // quote price, not fill
            entryTime: now,
            qty: orderResult.qty,
            notional: orderResult.notional,
            level,
            orderId: orderResult.orderId,
          });
        } else {
          const qty = notional / price;
          state.addPosition({
            entryPrice: price,
            entryTime: now,
            qty,
            notional,
            level,
          });
          logger.info(`[DRY-RUN] Added position: $${notional.toFixed(0)} @ $${price.toFixed(4)}, qty ${qty.toFixed(4)}`);
        }
      } finally {
        orderInFlight = false;
      }

      // Status + save after trade
      const updatedState = state.get();
      const updatedEq = calcEquity(updatedState.positions, price, capital);
      logger.printStatus(executor.getMode(), config.symbol, price, updatedState.positions, updatedEq.equity, capital, dd, trend.blocked, riskOff.blocked);
      logger.logEquity(updatedState, price, updatedEq.equity, dd);
      state.save();

    } catch (err: any) {
      logger.logError(`Main loop error: ${err.message}`);
      await sleep(30000);
      continue;
    }

    await sleep(config.pollIntervalSec * 1000);
  }

  // Cleanup
  clearInterval(heartbeatInterval);
  priceFeed.stop();
}

// ─────────────────────────────────────────────
// Startup reconciliation — compare exchange vs local state
// ─────────────────────────────────────────────
async function reconcileOnStartup(
  executor: Executor,
  state: StateManager,
  config: ReturnType<typeof loadBotConfig>,
  logger: BotLogger,
): Promise<void> {
  logger.info("Running startup reconciliation...");

  // Only LiveExecutor can query positions
  if (!(executor instanceof LiveExecutor)) return;

  // Check for stale pending order (bot crashed mid-order)
  const pendingOrder = state.getPendingOrder();
  if (pendingOrder) {
    logger.warn(`RECONCILIATION: Found stale pending ${pendingOrder.action} order (${pendingOrder.orderLinkId}) from ${new Date(pendingOrder.createdAt).toISOString()}`);

    // Query exchange for the actual status of this order
    const orderStatus = await executor.queryOrder(config.symbol, pendingOrder.orderLinkId);
    if (orderStatus.found) {
      logger.info(`RECONCILIATION: Pending order status on exchange: ${orderStatus.status}, filled ${orderStatus.filledQty} @ $${orderStatus.avgPrice.toFixed(4)}`);
      if (orderStatus.status === "Filled" && pendingOrder.action === "open" && orderStatus.filledQty > 0) {
        // Order filled but state wasn't updated — add position from exchange fill data
        logger.warn("RECONCILIATION: Pending open was FILLED on exchange. Importing fill into state.");
        state.addPosition({
          entryPrice: orderStatus.avgPrice,
          entryTime: pendingOrder.createdAt,
          qty: orderStatus.filledQty,
          notional: orderStatus.filledQty * orderStatus.avgPrice,
          level: state.get().positions.length,
          orderId: pendingOrder.orderLinkId,
        });
      }
      // For filled closes: position state will be reconciled in the position check below
    } else {
      logger.info("RECONCILIATION: Pending order not found on exchange (may have been rejected or expired).");
    }

    state.clearPendingOrder();
  }

  try {
    const liveExec = executor as LiveExecutor;
    // Query exchange for actual open position
    const posRes = await (liveExec as any).client.getPositionInfo({
      category: "linear",
      symbol: config.symbol,
    });

    if (posRes.retCode !== 0) {
      logger.logError(`Reconciliation failed: ${posRes.retMsg}`);
      return;
    }

    const exchangePos = posRes.result.list.find(
      (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Buy",
    );

    const localState = state.get();
    const localHasPositions = localState.positions.length > 0;
    const exchangeHasPosition = !!exchangePos;

    if (!localHasPositions && !exchangeHasPosition) {
      logger.info("Reconciliation: both local and exchange are flat. OK.");
      return;
    }

    if (localHasPositions && !exchangeHasPosition) {
      // Exchange is flat but local thinks we have positions — stale state
      logger.warn(`RECONCILIATION: Local has ${localState.positions.length} positions but exchange is FLAT. Clearing local state.`);
      // Close positions in state at zero PnL (already closed on exchange)
      state.get().positions = [];
      state.save();
      return;
    }

    if (!localHasPositions && exchangeHasPosition) {
      // Exchange has position but local doesn't know about it — RECOVERY MODE
      const size = parseFloat(exchangePos.size);
      const avgEntry = parseFloat(exchangePos.avgPrice);
      logger.warn(`RECONCILIATION: Exchange has ${size} ${config.symbol} (avg entry $${avgEntry}) but local state is EMPTY.`);
      logger.warn("Entering RECOVERY MODE — no new adds until manual review.");

      // Import exchange position into local state
      state.addPosition({
        entryPrice: avgEntry,
        entryTime: Date.now(),
        qty: size,
        notional: size * avgEntry,
        level: 0,
        orderId: "recovered_from_exchange",
      });

      // Set recovery flag — hard blocks all new adds
      state.setRecoveryMode(true);

      // Place exchange-native reduce-only TP as safety net
      const tpPrice = avgEntry * (1 + config.tpPct / 100);
      try {
        const liveClient = (liveExec as any).client;
        const tpRes = await liveClient.submitOrder({
          category: "linear",
          symbol: config.symbol,
          side: "Sell",
          orderType: "Limit",
          qty: String(size),
          price: String(tpPrice.toFixed(2)),
          reduceOnly: true,
          timeInForce: "GTC",
          orderLinkId: `recovery_tp_${Date.now()}`,
        });
        if (tpRes.retCode === 0) {
          state.setRecoveryTpOrderId(tpRes.result.orderId);
          logger.info(`RECOVERY: Placed exchange reduce-only TP at $${tpPrice.toFixed(4)} (order ${tpRes.result.orderId})`);
        } else {
          logger.logError(`RECOVERY: Failed to place TP order: ${tpRes.retMsg}`);
        }
      } catch (err: any) {
        logger.logError(`RECOVERY: TP order error: ${err.message}`);
      }

      logger.logError("RECOVERY: Imported exchange position. Bot will manage TP via WS watcher + exchange limit order. No new adds until recoveryMode cleared.");
      return;
    }

    // Both have positions — check for size mismatch
    const exchangeSize = parseFloat(exchangePos.size);
    const localSize = localState.positions.reduce((s, p) => s + p.qty, 0);
    const sizeDiff = Math.abs(exchangeSize - localSize) / exchangeSize;

    if (sizeDiff > 0.05) {
      logger.warn(`RECONCILIATION: Size mismatch — exchange ${exchangeSize.toFixed(4)} vs local ${localSize.toFixed(4)} (${(sizeDiff * 100).toFixed(1)}% diff)`);
      logger.warn("Continuing with local state but logging mismatch. Manual review recommended.");
    } else {
      logger.info(`Reconciliation: exchange ${exchangeSize.toFixed(4)} ~ local ${localSize.toFixed(4)}. OK.`);
    }

  } catch (err: any) {
    logger.logError(`Reconciliation error: ${err.message}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
