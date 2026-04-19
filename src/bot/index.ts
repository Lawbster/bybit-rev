import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { loadBotConfig, saveBotConfigTemplate } from "./bot-config";
import { StateManager } from "./state";
import { BotLogger } from "./monitor";
import { LadderAlerter } from "./ladder-alerter";
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId } from "./executor";
import { LiveContextManager } from "./context-manager";
import { PriceFeed, PriceUpdate } from "./price-feed";
import { SRLevelEngine, DEFAULT_SR_CONFIG } from "./sr-levels";
import {
  checkBatchTp, calcAddSize, canAffordAdd,
  checkTrendGate, checkMarketRiskOff, checkLadderKill,
  checkVolExpansion, checkCrsiHedge, calcEquity,
  checkEmergencyKill, checkHardFlatten, checkSoftStale, checkFundingSpike,
  checkOverextendedEntry,
  checkRegimeBreaker,
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

// ─────────────────────────────────────────────
// Signal files — filesystem-based manual control
// touch bot-pause   → stop adding, keep monitoring
// touch bot-flatten → flatten all + pause
// touch bot-resume  → clear pause (or rm bot-pause)
// ─────────────────────────────────────────────
const SIGNAL_DIR = process.cwd();
const SIGNAL_PAUSE = path.join(SIGNAL_DIR, "bot-pause");
const SIGNAL_FLATTEN = path.join(SIGNAL_DIR, "bot-flatten");
const SIGNAL_RESUME = path.join(SIGNAL_DIR, "bot-resume");

interface SignalState {
  paused: boolean;
  flattenRequested: boolean;
}

function checkSignalFiles(logger: BotLogger): SignalState {
  let paused = false;
  let flattenRequested = false;

  // bot-resume clears bot-pause
  if (fs.existsSync(SIGNAL_RESUME)) {
    if (fs.existsSync(SIGNAL_PAUSE)) {
      fs.unlinkSync(SIGNAL_PAUSE);
      logger.info("SIGNAL: bot-resume received — pause cleared");
    }
    fs.unlinkSync(SIGNAL_RESUME);
  }

  // bot-flatten → consume the file, request flatten + pause
  if (fs.existsSync(SIGNAL_FLATTEN)) {
    flattenRequested = true;
    fs.unlinkSync(SIGNAL_FLATTEN);
    // Create pause file so bot stays paused after flatten
    if (!fs.existsSync(SIGNAL_PAUSE)) {
      fs.writeFileSync(SIGNAL_PAUSE, `paused by bot-flatten at ${new Date().toISOString()}\n`);
    }
    logger.warn("SIGNAL: bot-flatten received — will flatten all positions and pause");
  }

  // bot-pause → block adds
  if (fs.existsSync(SIGNAL_PAUSE)) {
    paused = true;
  }

  return { paused, flattenRequested };
}

// ─────────────────────────────────────────────
// Periodic position reconciliation (exchange mode)
// Compares exchange position against local state
// ─────────────────────────────────────────────
async function reconcilePositions(
  executor: Executor,
  state: StateManager,
  config: ReturnType<typeof loadBotConfig>,
  logger: BotLogger,
  alerter?: LadderAlerter,
): Promise<{ synced: boolean; exchangeFlat: boolean }> {
  if (!(executor instanceof LiveExecutor)) {
    return { synced: true, exchangeFlat: false };
  }

  try {
    const liveExec = executor as LiveExecutor;
    const posRes = await (liveExec as any).client.getPositionInfo({
      category: "linear",
      symbol: config.symbol,
    });

    if (posRes.retCode !== 0) {
      logger.logError(`Reconciliation query failed: ${posRes.retMsg}`);
      return { synced: false, exchangeFlat: false };
    }

    const exchangePos = posRes.result.list.find(
      (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Buy",
    );
    const exchangeShortPos = posRes.result.list.find(
      (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Sell",
    );

    const localState = state.get();
    const localHasPositions = localState.positions.length > 0;
    const exchangeHasPosition = !!exchangePos;

    // Exchange flat but local has positions → manual close detected
    if (localHasPositions && !exchangeHasPosition) {
      const posCount = localState.positions.length;
      const totalQty = localState.positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = localState.positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const firstEntryTime = Math.min(...localState.positions.map(p => p.entryTime));
      logger.warn(`RECONCILIATION: Exchange is FLAT but local has ${posCount} positions — manual close detected`);

      // Query Bybit closed PnL to get actual exit price + realized PnL
      try {
        const pnlRes = await (liveExec as any).client.getClosedPnL({
          category: "linear",
          symbol: config.symbol,
          limit: 20,
        });

        if (pnlRes.retCode === 0 && pnlRes.result.list.length > 0) {
          // Find recent closes (within last 5 minutes)
          const cutoff = Date.now() - 5 * 60000;
          const recentCloses = pnlRes.result.list.filter(
            (r: any) => parseInt(r.updatedTime) >= cutoff,
          );

          if (recentCloses.length > 0) {
            const totalClosedPnl = recentCloses.reduce((s: number, r: any) => s + parseFloat(r.closedPnl), 0);
            const exitPrice = parseFloat(recentCloses[0].avgExitPrice);
            const totalFees = localState.positions.reduce((s, p) => {
              return s + p.notional * config.feeRate + exitPrice * p.qty * config.feeRate;
            }, 0);

            // Update state with actual PnL from exchange
            localState.realizedPnl += totalClosedPnl;
            localState.totalFees += totalFees;
            localState.totalBatchCloses++;
            localState.positions = [];
            state.save();

            // Log as batch close with real numbers
            logger.logBatchClose(config.symbol, posCount, totalClosedPnl, totalFees, avgEntry, exitPrice);
            logger.info(`RECONCILIATION: Manual close tracked — PnL $${totalClosedPnl.toFixed(2)} @ exit $${exitPrice.toFixed(4)}`);
            if (alerter) {
              const holdHours = (Date.now() - firstEntryTime) / 3600000;
              await alerter.notifyClosed("reconciled (external close)", posCount, avgEntry, exitPrice, totalClosedPnl, holdHours);
            }
          } else {
            // No recent closes found — fall back to zero-PnL clear
            logger.warn("RECONCILIATION: No recent closed PnL found on exchange — clearing positions without PnL tracking.");
            localState.positions = [];
            state.save();
          }
        } else {
          logger.warn("RECONCILIATION: Could not query closed PnL — clearing positions without PnL tracking.");
          localState.positions = [];
          state.save();
        }
      } catch (pnlErr: any) {
        logger.logError(`RECONCILIATION: getClosedPnL failed: ${pnlErr.message} — clearing positions without PnL tracking.`);
        localState.positions = [];
        state.save();
      }

      return { synced: true, exchangeFlat: true };
    }

    // Both have positions — check size mismatch
    if (localHasPositions && exchangeHasPosition) {
      const exchangeSize = parseFloat(exchangePos.size);
      const localSize = localState.positions.reduce((s, p) => s + p.qty, 0);
      const sizeDiff = Math.abs(exchangeSize - localSize) / exchangeSize;

      if (sizeDiff > 0.05) {
        logger.warn(`RECONCILIATION: Size mismatch — exchange ${exchangeSize.toFixed(4)} vs local ${localSize.toFixed(4)} (${(sizeDiff * 100).toFixed(1)}% diff)`);
      }
    }

    // ── Short-side (hedge) reconciliation ──
    const localHasHedge = !!localState.hedgePosition;
    const exchangeHasShort = !!exchangeShortPos;

    if (localHasHedge && !exchangeHasShort) {
      // Local thinks hedge is open but exchange has no short — closed externally (native TP/SL or manual)
      logger.warn("RECONCILIATION: Local hedge state set but exchange has NO short — clearing stale hedge state.");
      state.clearHedge();
    } else if (!localHasHedge && exchangeHasShort) {
      const shortSize = parseFloat(exchangeShortPos.size);
      const shortEntry = parseFloat(exchangeShortPos.avgPrice);
      logger.warn(`RECONCILIATION: Orphaned short on exchange (${shortSize} @ $${shortEntry}) — no local hedge record. Manual review required.`);
    }

    // Exchange has position but local doesn't — handled by startup reconciliation / recovery mode
    // Don't auto-import during runtime to avoid surprises

    return { synced: true, exchangeFlat: false };
  } catch (err: any) {
    logger.logError(`Reconciliation error: ${err.message}`);
    return { synced: false, exchangeFlat: false };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--init")) {
    saveBotConfigTemplate();
    return;
  }

  const configPath = args.find(a => a.startsWith("--config="))?.split("=")[1];
  const config = loadBotConfig(configPath);

  // ── Override file — applied each tick, reset after TP ─────────
  const OVERRIDE_FILE = path.resolve(process.cwd(), "override.json");
  function readOverride(): { symbol: string; maxPositions: number; oneShot: boolean } | null {
    if (!fs.existsSync(OVERRIDE_FILE)) return null;
    try { return JSON.parse(fs.readFileSync(OVERRIDE_FILE, "utf-8")); } catch { return null; }
  }
  function applyOverride() {
    const ov = readOverride();
    if (ov && ov.symbol === config.symbol) {
      config.maxPositions = ov.maxPositions;
    } else {
      // no override or different symbol — reload from disk to restore default
      const fresh = loadBotConfig(configPath);
      config.maxPositions = fresh.maxPositions;
    }
  }
  function clearOverrideIfOneShot() {
    const ov = readOverride();
    if (ov && ov.symbol === config.symbol && ov.oneShot) {
      fs.unlinkSync(OVERRIDE_FILE);
    }
  }

  const logger = new BotLogger(config.logDir);
  const state = new StateManager(config.stateFile);
  const alerter = new LadderAlerter(config.symbol);
  if (alerter.enabled) logger.info(`Discord alerter enabled for ${config.symbol}`);

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

  // ── Technical context manager — rolling 5m candle window ──
  const ctxMgr = new LiveContextManager(executor, config.symbol);
  try {
    await ctxMgr.init();
  } catch (err: any) {
    logger.warn(`ContextManager init failed (non-fatal): ${err.message}`);
  }

  // ── S/R level engine — pivot detection on 4H aggregated bars ──
  // Skip-on-add (block new rungs near R) + partial-flatten (close most-profitable
  // rungs on R touch) when SR_LEVELS_ENABLED. No-op when no active levels exist.
  const srEngine = new SRLevelEngine(config.srLevels ?? DEFAULT_SR_CONFIG);
  try {
    srEngine.rebuild(ctxMgr.getCandles());
    if ((config.srLevels ?? DEFAULT_SR_CONFIG).enabled) {
      logger.info(`SR engine: ${srEngine.totalResistance()}R / ${srEngine.totalSupport()}S levels (active R=${srEngine.countActiveResistance(Date.now())})`);
    }
  } catch (err: any) {
    logger.warn(`SR engine initial rebuild failed (non-fatal): ${err.message}`);
  }

  logger.info(`Bot starting: ${config.symbol} | ${executor.getMode()} | ${config.basePositionUsdt}x${config.addScaleFactor} max${config.maxPositions} TP${config.tpPct}%`);
  logger.info(`Filters: trend=${config.filters.trendBreak} riskOff=${config.filters.marketRiskOff} vol=${config.filters.volExpansion} ladderKill=${config.filters.ladderLocalKill}`);
  logger.info(`Exits: emergency=${config.exits.emergencyKill}@${config.exits.emergencyKillPct}% hardFlatten=${config.exits.hardFlatten}@${config.exits.hardFlattenHours}h/${config.exits.hardFlattenPct}% softStale=${config.exits.softStale}@${config.exits.staleHours}h→${config.exits.reducedTpPct}%`);

  // ── Startup reconciliation ──
  if (isExchangeMode(config.mode)) {
    await reconcileOnStartup(executor, state, config, logger);
  }

  // ── Ensure hedge position mode (both sides) if hedge is enabled ──
  // hedgeModeConfirmed gates all hedge order execution — false = shadow log only, no orders
  let hedgeModeConfirmed = !isExchangeMode(config.mode); // dry-run always confirmed
  if (config.hedge.enabled && isExchangeMode(config.mode)) {
    hedgeModeConfirmed = await executor.ensureHedgeMode(config.symbol);
    if (!hedgeModeConfirmed) {
      logger.warn("Hedge position mode not confirmed — hedge will shadow-log only. Restart to retry.");
    }
  }

  const s = state.get();
  if (s.positions.length > 0) {
    logger.info(`Resumed with ${s.positions.length} open positions, $${s.realizedPnl.toFixed(2)} realized PnL`);
  }

  // ── Candle cache ──
  let hype4hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };
  let btc1hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };
  let hype1hCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };
  let hype1dCache: { candles: Candle[]; fetchedAt: number } = { candles: [], fetchedAt: 0 };

  const CACHE_TTL_4H = 4 * 60 * 60 * 1000;
  const CACHE_TTL_1H = 60 * 60 * 1000;
  const CACHE_TTL_1D = 60 * 60 * 1000; // refresh hourly; daily close resolves at UTC rollover

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

  async function getHype1d(): Promise<Candle[]> {
    if (Date.now() - hype1dCache.fetchedAt < CACHE_TTL_1D && hype1dCache.candles.length > 0) {
      return hype1dCache.candles;
    }
    hype1dCache.candles = await executor.getCandles(config.symbol, "D", 30);
    hype1dCache.fetchedAt = Date.now();
    return hype1dCache.candles;
  }

  // ── Post-TP conditional cooldown: pause re-entry when RSI 1H is hot ──
  function checkTpCooldown(): void {
    const cd = config.tpCooldown;
    if (!cd?.enabled) return;
    try {
      const ctx = ctxMgr.getContext();
      const rsi1h = ctx.indicators["1H"].rsi14;
      if (rsi1h !== null && rsi1h > cd.rsi1hThreshold) {
        const until = Date.now() + cd.cooldownMin * 60000;
        state.setForcedExitCooldown(until);
        logger.info(`TP COOLDOWN: RSI 1H ${rsi1h.toFixed(1)} > ${cd.rsi1hThreshold} — blocking re-entry for ${cd.cooldownMin}min`);
      } else {
        logger.info(`TP COOLDOWN: RSI 1H ${rsi1h?.toFixed(1) ?? "n/a"} <= ${cd.rsi1hThreshold} — re-entry allowed immediately`);
      }
    } catch {
      // Context not ready — skip cooldown (fail open)
    }
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

  // ── Flatten helper — closes entire ladder ──
  async function flattenLadder(reason: string, price: number): Promise<boolean> {
    const s = state.get();
    if (s.positions.length === 0) return false;

    logger.warn(`FLATTEN: ${reason}`);
    orderInFlight = true;
    try {
      // Snapshot pre-close stats for the alert
      const preAvg = s.positions.reduce((a, p) => a + p.entryPrice * p.qty, 0) /
                     s.positions.reduce((a, p) => a + p.qty, 0);
      const preRungs = s.positions.length;
      const preOldest = Math.min(...s.positions.map(p => p.entryTime));

      if (isExchangeMode(config.mode)) {
        const clsId = genOrderLinkId("exit");
        state.setPendingOrder({ orderLinkId: clsId, action: "close", symbol: config.symbol, notional: 0, createdAt: Date.now() });
        const closeResult = await executor.closeAllLongs(config.symbol, clsId);
        state.clearPendingOrder();
        if (!closeResult.success) {
          logger.logError(`Flatten FAILED on exchange: ${closeResult.error}`);
          return false;
        }
        const stateResult = state.closeAllPositions(closeResult.price, Date.now(), config.feeRate);
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, 0, closeResult.price);
        await alerter.notifyClosed(reason, preRungs, preAvg, closeResult.price, stateResult.totalPnl, (Date.now() - preOldest) / 3600000);
        if (state.isRecoveryMode()) {
          await cancelRecoveryTpIfExists();
          state.setRecoveryMode(false);
        }
      } else {
        const stateResult = state.closeAllPositions(price, Date.now(), config.feeRate);
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, 0, price);
        await alerter.notifyClosed(reason, preRungs, preAvg, price, stateResult.totalPnl, (Date.now() - preOldest) / 3600000);
      }
      // Also close hedge if open — ladder gone, hedge rationale gone
      await closeHedge_internal(`ladder flattened (${reason})`, price);
      return true;
    } finally {
      orderInFlight = false;
    }
  }

  // ── Close hedge helper — caller must hold orderInFlight ──
  async function closeHedge_internal(reason: string, price: number, wasKill = false): Promise<void> {
    const hs = state.get().hedgePosition;
    if (!hs) return;

    logger.info(`Closing hedge (${reason})`);
    if (isExchangeMode(config.mode)) {
      const closeId = genOrderLinkId("hclose");
      state.setPendingOrder({ orderLinkId: closeId, action: "hedge_close", symbol: config.symbol, notional: 0, createdAt: Date.now() });
      const result = await executor.closeShort(config.symbol, closeId);
      state.clearPendingOrder();
      if (result.success && result.qty > 0) {
        const { pnl, fees } = state.closeHedge(result.price, Date.now(), config.feeRate, wasKill);
        capital += pnl;
        logger.info(`HEDGE CLOSED: PnL $${pnl.toFixed(2)} fees $${fees.toFixed(2)} @ $${result.price.toFixed(4)}${wasKill ? " [kill]" : " [TP/forced]"}`);
      } else if (result.qty === 0) {
        // Exchange already flat — native TP/SL may have fired
        state.closeHedge(hs.entryPrice, Date.now(), config.feeRate, wasKill);
        logger.warn("HEDGE CLOSE: exchange already flat on short side — native TP/SL may have fired. PnL approximated from entry price.");
      } else {
        logger.logError(`Hedge close FAILED: ${result.error}`);
      }
    } else {
      const { pnl } = state.closeHedge(price, Date.now(), config.feeRate, wasKill);
      capital += pnl;
      logger.info(`HEDGE CLOSED [dry-run]: ${reason} | PnL $${pnl.toFixed(2)} @ $${price.toFixed(4)}`);
    }
  }

  // ── Update exchange-native TP on the long position ──
  // Call after every rung add and whenever activeTpPct changes.
  async function updateExchangeTp(): Promise<void> {
    const positions = state.get().positions;
    if (positions.length === 0) return;
    const totalQty = positions.reduce((s, p) => s + p.qty, 0);
    const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
    const tpPrice = avgEntry * (1 + activeTpPct / 100);
    await executor.setPositionTp(config.symbol, tpPrice, 1);
    logger.info(`Exchange TP updated: $${tpPrice.toFixed(4)} (avg $${avgEntry.toFixed(4)}, ${activeTpPct}%)`);
  }

  // ── Active TP % — may be reduced by soft stale ──
  let activeTpPct = config.tpPct;

  // ── Track capital (real wallet equity in live/paper, synthetic in dry-run) ──
  let capital: number;
  if (isExchangeMode(config.mode)) {
    const walletEq = await executor.getWalletEquity();
    if (walletEq > 0) {
      capital = walletEq;
      logger.info(`Wallet equity: $${walletEq.toFixed(2)}`);
    } else {
      capital = config.initialCapital + state.get().realizedPnl;
      logger.warn(`Could not read wallet equity, falling back to synthetic: $${capital.toFixed(2)}`);
    }
  } else {
    capital = config.initialCapital + state.get().realizedPnl;
  }

  /** Refresh capital from Bybit wallet (live/paper) or synthetic fallback */
  async function refreshCapital(): Promise<number> {
    if (isExchangeMode(config.mode)) {
      const walletEq = await executor.getWalletEquity();
      if (walletEq > 0) {
        logger.info(`Wallet equity refreshed: $${walletEq.toFixed(2)}`);
        return walletEq;
      }
    }
    return config.initialCapital + state.get().realizedPnl;
  }

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
    latestPrice = { symbol: config.symbol, lastPrice: restPrice, bid1: restPrice, ask1: restPrice, fundingRate: 0, nextFundingTime: 0, timestamp: Date.now() };
  }

  // Sync exchange TP if resuming with open positions
  if (isExchangeMode(config.mode) && state.get().positions.length > 0) {
    await updateExchangeTp();
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
    if (wsSilence > WS_STALE_WARN_MS && !orderInFlight) {
      try {
        const restPrice = await executor.getPrice(config.symbol);
        // Update latestPrice with REST data (keeps WS timestamp to track staleness)
        latestPrice = {
          ...latestPrice,
          lastPrice: restPrice,
          bid1: restPrice,  // REST doesn't give bid1 separately, use lastPrice
          ask1: restPrice,
        };

        const s = state.get();

        // Check hedge TP/kill via REST
        const hs = s.hedgePosition;
        if (hs && !orderInFlight) {
          if (restPrice <= hs.tpPrice) {
            orderInFlight = true;
            logger.info(`HEDGE TP HIT via REST: $${restPrice.toFixed(4)} <= TP $${hs.tpPrice.toFixed(4)}`);
            try { await closeHedge_internal("TP hit (REST)", restPrice, false); } finally { orderInFlight = false; }
          } else if (restPrice >= hs.killPrice) {
            orderInFlight = true;
            logger.warn(`HEDGE KILL HIT via REST: $${restPrice.toFixed(4)} >= kill $${hs.killPrice.toFixed(4)}`);
            try { await closeHedge_internal("kill stop hit (REST)", restPrice, true); } finally { orderInFlight = false; }
          }
        }

        // Check TP on REST price
        const tp = checkBatchTp(s.positions, activeTpPct, restPrice);
        if (tp.hit && !orderInFlight) {
          logger.info(`BATCH TP HIT via REST heartbeat: $${restPrice.toFixed(4)} >= TP $${tp.tpPrice.toFixed(4)}`);
          orderInFlight = true;
          const preTpRungs = s.positions.length;
          const preTpOldest = Math.min(...s.positions.map(p => p.entryTime));
          const preTpReason = activeTpPct < config.tpPct ? "STALE TP (REST)" : "TP (REST)";
          try {
            if (isExchangeMode(config.mode)) {
              const clsId = genOrderLinkId("close");
              state.setPendingOrder({ orderLinkId: clsId, action: "close", symbol: config.symbol, notional: 0, createdAt: Date.now() });
              const closeResult = await executor.closeAllLongs(config.symbol, clsId);
              state.clearPendingOrder();
              if (closeResult.success) {
                const restExitPrice = closeResult.qty > 0 ? closeResult.price : tp.tpPrice;
                const stateResult = state.closeAllPositions(restExitPrice, Date.now(), config.feeRate);
                capital = await refreshCapital();
                await closeHedge_internal("ladder TP (REST)", restExitPrice);
                logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, restExitPrice);
                await alerter.notifyClosed(preTpReason, preTpRungs, tp.avgEntry, restExitPrice, stateResult.totalPnl, (Date.now() - preTpOldest) / 3600000);
                if (state.isRecoveryMode()) {
                  state.setRecoveryMode(false);
                  logger.info("Recovery mode cleared — ladder fully closed on exchange.");
                }
                checkTpCooldown();
              }
            } else {
              const stateResult = state.closeAllPositions(restPrice, Date.now(), config.feeRate);
              capital = await refreshCapital();
              logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, restPrice);
              await alerter.notifyClosed(preTpReason, preTpRungs, tp.avgEntry, restPrice, stateResult.totalPnl, (Date.now() - preTpOldest) / 3600000);
              await closeHedge_internal("ladder TP (REST dry-run)", restPrice);
              checkTpCooldown();
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

    // ── Hedge TP/kill (checked first — independent of ladder) ──
    const hs = s.hedgePosition;
    if (hs) {
      // Short TP: price dropped to tpPrice
      if (update.bid1 <= hs.tpPrice) {
        orderInFlight = true;
        logger.info(`HEDGE TP HIT: bid $${update.bid1.toFixed(4)} <= TP $${hs.tpPrice.toFixed(4)}`);
        try {
          await closeHedge_internal("TP hit", update.bid1, false);
        } catch (err: any) {
          logger.logError(`Hedge TP close error: ${err.message}`);
        } finally {
          orderInFlight = false;
        }
        return;
      }
      // Short kill: price rose to killPrice
      if (update.ask1 >= hs.killPrice) {
        orderInFlight = true;
        logger.warn(`HEDGE KILL HIT: ask $${update.ask1.toFixed(4)} >= kill $${hs.killPrice.toFixed(4)}`);
        try {
          await closeHedge_internal("kill stop hit", update.ask1, true);
        } catch (err: any) {
          logger.logError(`Hedge kill close error: ${err.message}`);
        } finally {
          orderInFlight = false;
        }
        return;
      }
    }

    if (s.positions.length === 0) return;

    // ── Approach alerts (edge-triggered, cheap) ──
    {
      const totalQty = s.positions.reduce((a, p) => a + p.qty, 0);
      const avgEntry = s.positions.reduce((a, p) => a + p.entryPrice * p.qty, 0) / totalQty;
      void alerter.checkKillApproach(update.bid1, avgEntry, config.exits.emergencyKillPct, s.positions.length);
      const fg = config.exits.fundingSpikeGuard;
      if (fg?.enabled) {
        void alerter.checkFundingApproach(s.positions.length, fg.minRungs, update.fundingRate ?? 0, fg.maxFundingRate);
      }
    }

    // Use bid1 as executable exit price for longs
    const tp = checkBatchTp(s.positions, activeTpPct, update.bid1);
    if (!tp.hit) return;

    orderInFlight = true;
    try {
      logger.info(`BATCH TP HIT: bid $${update.bid1.toFixed(4)} >= TP $${tp.tpPrice.toFixed(4)} (avg entry $${tp.avgEntry.toFixed(4)})`);

      const preTpRungs = s.positions.length;
      const preTpOldest = Math.min(...s.positions.map(p => p.entryTime));
      const preTpReason = activeTpPct < config.tpPct ? "STALE TP" : "TP";

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
        // If native TP already fired (qty=0), use calculated tpPrice as exit price
        const exitPrice = closeResult.qty > 0 ? closeResult.price : tp.tpPrice;
        const stateResult = state.closeAllPositions(exitPrice, Date.now(), config.feeRate);
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, exitPrice);
        await alerter.notifyClosed(preTpReason, preTpRungs, tp.avgEntry, exitPrice, stateResult.totalPnl, (Date.now() - preTpOldest) / 3600000);
        clearOverrideIfOneShot(); // one-shot override resets after TP
        // Close hedge — ladder TP means price recovered, short is losing
        await closeHedge_internal("ladder TP", exitPrice);
        // Clear recovery mode on successful batch close (back to flat)
        if (state.isRecoveryMode()) {
          await cancelRecoveryTpIfExists();
          state.setRecoveryMode(false);
          logger.info("Recovery mode cleared — ladder fully closed on exchange.");
        }
        checkTpCooldown();
      } else {
        // Dry-run: simulate close at bid (quote price, not actual fill)
        clearOverrideIfOneShot(); // one-shot override resets after TP
        const stateResult = state.closeAllPositions(update.bid1, Date.now(), config.feeRate);
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, update.bid1);
        await alerter.notifyClosed(preTpReason, preTpRungs, tp.avgEntry, update.bid1, stateResult.totalPnl, (Date.now() - preTpOldest) / 3600000);
        await closeHedge_internal("ladder TP", update.bid1);
        checkTpCooldown();
      }
    } catch (err: any) {
      logger.logError(`TP close error: ${err.message}`);
    } finally {
      orderInFlight = false;
    }
  });

  logger.info(`Signal files: touch bot-pause | bot-flatten | bot-resume in ${SIGNAL_DIR}`);
  logger.info(`Main loop starting (add check every ${config.pollIntervalSec}s, TP on WebSocket bid)\n`);

  // Periodic reconciliation timer (exchange mode only)
  const RECONCILE_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
  let lastReconcileTime = Date.now();

  // Add/filter check loop — runs on REST interval
  while (true) {
    try {
      cycleCount++;
      const now = Date.now();
      const price = latestPrice?.bid1 || await executor.getPrice(config.symbol);
      const s = state.get();

      // ── Refresh technical context (1 API call, non-blocking on error) ──
      try { await ctxMgr.refresh(); } catch { /* non-fatal — stale context is fine */ }

      // ── Rebuild S/R levels on each new SR-tf bar close ──
      try {
        if (srEngine.needsRebuild(now)) {
          srEngine.rebuild(ctxMgr.getCandles());
          logger.info(`SR rebuild: ${srEngine.totalResistance()}R / ${srEngine.totalSupport()}S (active R=${srEngine.countActiveResistance(now)})`);
        }
      } catch { /* non-fatal */ }

      // ── Signal file checks ──
      const signals = checkSignalFiles(logger);

      if (signals.flattenRequested && s.positions.length > 0 && !orderInFlight) {
        await flattenLadder("MANUAL FLATTEN via bot-flatten signal", price);
        activeTpPct = config.tpPct;
        state.save();
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      if (signals.paused) {
        if (cycleCount % 6 === 0) {
          const eq = calcEquity(s.positions, price, capital);
          const dd = s.peakEquity > 0 ? ((s.peakEquity - eq.equity) / s.peakEquity) * 100 : 0;
          logger.info("PAUSED (bot-pause signal) — monitoring only, no adds. rm bot-pause or touch bot-resume to resume.");
          logger.printStatus(executor.getMode(), config.symbol, price, s.positions, eq.equity, capital, dd, s.lastTrendCheck.blocked, now < s.riskOffUntil, config.maxPositions);
        }
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // ── Periodic position reconciliation (exchange mode) ──
      if (isExchangeMode(config.mode) && now - lastReconcileTime >= RECONCILE_INTERVAL_MS) {
        lastReconcileTime = now;
        const recon = await reconcilePositions(executor, state, config, logger, alerter);
        if (recon.exchangeFlat && s.positions.length > 0) {
          // Local state was just cleared — skip rest of this cycle
          capital = await refreshCapital();
          activeTpPct = config.tpPct;
          await sleep(config.pollIntervalSec * 1000);
          continue;
        }
      }

      // ── Funding fee settlement (every 8h: 00:00, 08:00, 16:00 UTC) ──
      if (s.positions.length > 0 && latestPrice) {
        const FUNDING_INTERVAL_MS = 8 * 3600000;
        // Current 8h settlement bucket
        const currentBucket = Math.floor(now / FUNDING_INTERVAL_MS);
        const lastBucket = s.lastFundingSettlement > 0
          ? Math.floor(s.lastFundingSettlement / FUNDING_INTERVAL_MS)
          : currentBucket; // skip first cycle to avoid charging on startup
        if (currentBucket > lastBucket) {
          const rate = latestPrice.fundingRate || 0.0001; // fallback to 0.01% if WS hasn't sent it
          const { fundingCost } = state.deductFunding(rate, price);
          capital -= fundingCost;
          logger.info(`FUNDING: deducted $${fundingCost.toFixed(2)} (rate ${(rate * 100).toFixed(4)}%, total funding paid: $${s.totalFunding.toFixed(2)})`);
          state.save();
        }
      }

      // Equity / drawdown
      const eq = calcEquity(s.positions, price, capital);
      const dd = s.peakEquity > 0 ? ((s.peakEquity - eq.equity) / s.peakEquity) * 100 : 0;
      state.updateEquity(eq.equity);

      // ── Refresh trend state every cycle when positions exist ──
      // Decoupled from add path so exit stack always has fresh regime data
      if (s.positions.length > 0) {
        const hype4hForExit = await getHype4h();
        const trendRefresh = checkTrendGate(hype4hForExit, config);
        state.updateTrendCheck(now, trendRefresh.blocked, trendRefresh.reason);
      }

      // ── Exit stack checks (run every cycle when positions exist) ──
      if (s.positions.length > 0 && !orderInFlight) {
        // 1. Emergency kill — highest priority exit
        const emergency = checkEmergencyKill(s.positions, price, config);
        if (emergency.action === "flatten") {
          logger.warn(emergency.reason);
          const flattened = await flattenLadder(emergency.reason, price);
          if (flattened) {
            // Cooldown: end of the next completed 4h bar
            const fourH = 4 * 3600000;
            const nextBarEnd = (Math.floor(now / fourH) + 2) * fourH;
            state.setForcedExitCooldown(nextBarEnd);
            logger.info(`Post-exit cooldown until ${new Date(nextBarEnd).toISOString().slice(0, 16)}`);
            activeTpPct = config.tpPct;
            state.save();
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        }

        // 1b. Funding-spike top guard — deep ladder + crowded longs = mean revert
        const fundingForGuard = latestPrice?.fundingRate ?? null;
        const fundingGuard = checkFundingSpike(s.positions, fundingForGuard, config);
        if (fundingGuard.action === "flatten") {
          logger.warn(fundingGuard.reason);
          const flattened = await flattenLadder(fundingGuard.reason, price);
          if (flattened) {
            const fourH = 4 * 3600000;
            const nextBarEnd = (Math.floor(now / fourH) + 2) * fourH;
            state.setForcedExitCooldown(nextBarEnd);
            logger.info(`Post-exit cooldown until ${new Date(nextBarEnd).toISOString().slice(0, 16)}`);
            activeTpPct = config.tpPct;
            state.save();
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        }

        // 2. Hard flatten — requires trend hostile
        const trendForExit = s.lastTrendCheck.blocked;
        const hardFlat = checkHardFlatten(s.positions, price, now, trendForExit, config);
        if (hardFlat.action === "flatten") {
          logger.warn(hardFlat.reason);
          const flattened = await flattenLadder(hardFlat.reason, price);
          if (flattened) {
            // Cooldown: end of the next completed 4h bar
            const fourH = 4 * 3600000;
            const nextBarEnd = (Math.floor(now / fourH) + 2) * fourH;
            state.setForcedExitCooldown(nextBarEnd);
            logger.info(`Post-exit cooldown until ${new Date(nextBarEnd).toISOString().slice(0, 16)}`);
            activeTpPct = config.tpPct;
            state.save();
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        }

        // 2b. SR partial-flatten — close most-profitable rungs on resistance touch
        // (no-op when SR engine disabled or no active R within flattenBufferPct)
        try {
          const flatIdx = srEngine.partialFlattenIndices(s.positions, now, price);
          if (flatIdx && flatIdx.length > 0) {
            const closeQty = flatIdx.reduce((sum, i) => sum + s.positions[i].qty, 0);
            const r = srEngine.nearestActiveResistance(now, price);
            const reason = `SR partial-flatten: ${flatIdx.length} rung(s) (${closeQty.toFixed(4)} qty) near R=$${r?.lv.price.toFixed(4)} dist=${((r?.dist ?? 0) * 100).toFixed(2)}%`;
            logger.warn(reason);
            orderInFlight = true;
            try {
              if (isExchangeMode(config.mode)) {
                const reduceId = genOrderLinkId("srflat");
                state.setPendingOrder({ orderLinkId: reduceId, action: "close", symbol: config.symbol, notional: 0, createdAt: now });
                const closeResult = await executor.reduceLongQty(config.symbol, closeQty, reduceId);
                state.clearPendingOrder();
                if (closeResult.success && closeResult.qty > 0) {
                  const stateResult = state.closePositionsByIndices(flatIdx, closeResult.price, now, config.feeRate);
                  capital = await refreshCapital();
                  logger.info(`SR FLAT: closed ${stateResult.positionsClosed} rungs PnL $${stateResult.totalPnl.toFixed(2)} fees $${stateResult.totalFees.toFixed(2)} @ $${closeResult.price.toFixed(4)}`);
                  await updateExchangeTp();
                } else {
                  logger.logError(`SR partial-flatten reduce FAILED: ${closeResult.error}`);
                }
              } else {
                const stateResult = state.closePositionsByIndices(flatIdx, price, now, config.feeRate);
                capital = await refreshCapital();
                logger.info(`SR FLAT [dry-run]: closed ${stateResult.positionsClosed} rungs PnL $${stateResult.totalPnl.toFixed(2)} @ $${price.toFixed(4)}`);
                await updateExchangeTp();
              }
            } finally {
              orderInFlight = false;
            }
            // Re-evaluate next tick — fall through and let normal exit/add logic resume
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        } catch (err: any) {
          logger.warn(`SR partial-flatten check failed (non-fatal): ${err.message}`);
        }

        // 3. Soft stale — reduce TP target for escape hatch
        const stale = checkSoftStale(s.positions, price, now, config);
        if (stale.action === "reduce_tp" && stale.reducedTpPct) {
          if (activeTpPct !== stale.reducedTpPct) {
            logger.info(stale.reason);
            activeTpPct = stale.reducedTpPct;
            await updateExchangeTp();
          }
        } else {
          // Not stale anymore — restore normal TP
          if (activeTpPct !== config.tpPct) {
            logger.info(`Stale cleared — TP restored to ${config.tpPct}%`);
            activeTpPct = config.tpPct;
            await updateExchangeTp();
          }
        }
      } else if (s.positions.length === 0) {
        // No positions — ensure TP is at default
        activeTpPct = config.tpPct;
      }

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
            capital = await refreshCapital();
          } else {
            logger.logError(`DD kill close FAILED: ${closeResult.error}`);
          }
        } else if (s.positions.length > 0) {
          const stateResult = state.closeAllPositions(price, now, config.feeRate);
          capital = await refreshCapital();
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
          logger.printStatus(executor.getMode(), config.symbol, price, s.positions, eq.equity, capital, dd, s.lastTrendCheck.blocked, now < s.riskOffUntil, config.maxPositions);
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

      // Block adds during post-forced-exit cooldown
      if (state.isForcedExitCooldown(now)) {
        if (cycleCount % 6 === 0) {
          const remaining = ((s.forcedExitCooldownUntil - now) / 60000).toFixed(0);
          logger.info(`Post-exit cooldown: ${remaining}m remaining`);
        }
        await sleep(config.pollIntervalSec * 1000);
        continue;
      }

      // Check if we can add (timing or price-drop trigger)
      const timeSinceLastAdd = (now - s.lastAddTime) / 60000;
      // Dynamic add-throttle: when deep and price falling, double the add interval
      let effectiveAddInterval = config.addIntervalMin;
      if (config.addThrottle?.enabled && s.positions.length >= config.addThrottle.depth) {
        const candles5m = ctxMgr.getCandles();
        if (candles5m.length >= 72) {
          const cur = candles5m[candles5m.length - 1].close;
          const ago = candles5m[candles5m.length - 72].close;
          const slope6h = (cur - ago) / ago * 100;
          if (slope6h <= config.addThrottle.slopeThreshold) {
            effectiveAddInterval = config.addIntervalMin * config.addThrottle.mult;
            if (cycleCount % 6 === 0) {
              logger.info(`ADD-THROTTLE: depth=${s.positions.length} slope6h=${slope6h.toFixed(2)}% → interval ${config.addIntervalMin}→${effectiveAddInterval}min`);
            }
          }
        }
      }
      const timeGateOk = timeSinceLastAdd >= effectiveAddInterval;
      const lastEntryPrice = s.positions.length > 0 ? s.positions[s.positions.length - 1].entryPrice : 0;
      const priceDropOk = config.priceTriggerPct > 0
        && s.positions.length > 0
        && price <= lastEntryPrice * (1 - config.priceTriggerPct / 100);
      applyOverride(); // re-read override each tick — picks up new commands instantly
      // If override is active and we're exactly at the previous cap boundary,
      // bypass the 30-min time gate for that one bridging add only.
      const overrideActive = fs.existsSync(OVERRIDE_FILE);
      const freshConfig = loadBotConfig(configPath);
      const atOldCap = overrideActive && s.positions.length === freshConfig.maxPositions;
      const canAddTiming = s.positions.length < config.maxPositions && (timeGateOk || priceDropOk || atOldCap);

      // Status display every ~1 min
      if (cycleCount % 6 === 0) {
        capital = await refreshCapital();
        const trendCached = s.lastTrendCheck;
        logger.printStatus(executor.getMode(), config.symbol, price, s.positions, eq.equity, capital, dd, trendCached.blocked, now < s.riskOffUntil, config.maxPositions);
        try {
          const ctx = ctxMgr.getContext();
          const zoneStr = ["1D","4H","1H"].map(tf => {
            const z = ctx.zoneStack[tf as "1D"|"4H"|"1H"];
            return z ? `${tf}@$${z.mid.toFixed(2)}${z.isFreshTouch ? "✓" : ""}` : `${tf}—`;
          }).join(" ");
          const crsiStr = ctx.crsi1H !== null ? `  CRSI 1H=${ctx.crsi1H.toFixed(1)} 4H=${ctx.crsi4H?.toFixed(1) ?? "n/a"}` : "";
          logger.info(`CONTEXT: grade=${ctx.confluenceGrade} score=${ctx.confluenceScore} | ${zoneStr} | setups=${ctx.activeSetups.join(",") || "none"}${crsiStr}`);
        } catch { /* context not ready yet */ }
      }

      if (cycleCount % SAVE_INTERVAL === 0) {
        logger.logEquity(s, price, eq.equity, dd);
        state.save();
      }

      // ── CRSI 4H hedge trigger — fires once per episode, closes with ladder only ──
      if (config.hedge.enabled && hedgeModeConfirmed && s.positions.length > 0 && !state.get().hedgePosition && !orderInFlight) {
        const cooldownMs = config.hedge.cooldownMin * 60000;
        const cooldownOk = now - s.hedgeLastCloseTime >= cooldownMs;
        if (cooldownOk) {
          let crsi4H: number | null = null;
          try { crsi4H = ctxMgr.getContext().crsi4H ?? null; } catch { /* context not ready */ }

          const hedgeCheck = checkCrsiHedge(s.positions, crsi4H, config);

          logger.logFilterShadow("crsi_hedge", hedgeCheck.fire, {
            crsi4H: hedgeCheck.crsi4H,
            threshold: config.hedge.crsiThreshold,
            reason: hedgeCheck.reason,
          });

          if (hedgeCheck.fire) {
            logger.warn(`CRSI HEDGE TRIGGER: ${hedgeCheck.reason}`);
            orderInFlight = true;
            try {
              if (isExchangeMode(config.mode)) {
                const hedgeId = genOrderLinkId("hopen");
                state.setPendingOrder({ orderLinkId: hedgeId, action: "hedge_open", symbol: config.symbol, notional: hedgeCheck.notional, createdAt: now });
                const result = await executor.openShort(config.symbol, hedgeCheck.notional, config.hedge.leverage, hedgeId);
                state.clearPendingOrder();
                if (result.success) {
                  // No standalone TP/kill — hedge closes only when ladder closes
                  state.openHedge({
                    entryPrice: result.price,
                    entryTime: now,
                    qty: result.qty,
                    notional: result.notional,
                    tpPrice: 0,       // sentinel — never fires
                    killPrice: 999999, // sentinel — never fires
                    orderId: result.orderId,
                  });
                  logger.info(`CRSI HEDGE OPEN: short $${result.notional.toFixed(0)} @ $${result.price.toFixed(4)} | closes with ladder`);
                } else {
                  logger.logError(`CRSI hedge open failed: ${result.error}`);
                }
              } else {
                state.openHedge({
                  entryPrice: price,
                  entryTime: now,
                  qty: hedgeCheck.notional / price,
                  notional: hedgeCheck.notional,
                  tpPrice: 0,
                  killPrice: 999999,
                });
                logger.info(`CRSI HEDGE OPEN [dry-run]: short $${hedgeCheck.notional.toFixed(0)} @ $${price.toFixed(4)} | closes with ladder`);
              }
            } finally {
              orderInFlight = false;
            }
          }
        }
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

      // Overextended-entry filter (rung 1 only)
      let crsi4HForFilter: number | null = null;
      let rsi1HForFilter: number | null = null;
      try {
        const ctx = ctxMgr.getContext();
        crsi4HForFilter = ctx.crsi4H ?? null;
        rsi1HForFilter = ctx.indicators["1H"].rsi14 ?? null;
      } catch { /* context not ready */ }
      const overext = checkOverextendedEntry(s.positions, hype1h, crsi4HForFilter, rsi1HForFilter, config);
      if (overext.blocked) {
        blocked = true;
        blockReason = blockReason ? `${blockReason} + ${overext.reason}` : overext.reason;
      }

      // Regime circuit breaker — N consecutive red days → flat until M green days
      try {
        const hype1d = await getHype1d();
        const regime = checkRegimeBreaker(hype1d, s.regime, config, now);
        state.updateRegime(regime.state);
        if (regime.blocked) {
          blocked = true;
          blockReason = blockReason ? `${blockReason} + ${regime.reason}` : regime.reason;
        }
      } catch (err: any) {
        logger.warn(`Regime breaker check failed: ${err.message}`);
      }

      // SR skip-on-add — block new rung when nearest active R within bufferPct
      try {
        if (srEngine.shouldSkipAdd(now, price)) {
          const r = srEngine.nearestActiveResistance(now, price);
          const reason = `SR skip-add: nearest R=$${r?.lv.price.toFixed(4)} dist=${((r?.dist ?? 0) * 100).toFixed(2)}%`;
          blocked = true;
          blockReason = blockReason ? `${blockReason} + ${reason}` : reason;
        }
      } catch { /* non-fatal */ }

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
            // Back off on exchange rejection to avoid spamming — wait 5 min before retrying
            const isPositionLimit = orderResult.error?.includes("position") || orderResult.error?.includes("leverage");
            if (isPositionLimit) {
              logger.warn(`Position limit hit at level ${level} — backing off 5 min`);
              await sleep(5 * 60 * 1000);
            }
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
          await updateExchangeTp();
          {
            const sNew = state.get();
            const totalQty = sNew.positions.reduce((a, p) => a + p.qty, 0);
            const newAvg = sNew.positions.reduce((a, p) => a + p.entryPrice * p.qty, 0) / totalQty;
            const totalNotional = sNew.positions.reduce((a, p) => a + p.notional, 0);
            await alerter.notifyRungOpened(level, config.maxPositions, orderResult.price, newAvg, totalNotional);
          }
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
          await updateExchangeTp();
          {
            const sNew = state.get();
            const totalQty = sNew.positions.reduce((a, p) => a + p.qty, 0);
            const newAvg = sNew.positions.reduce((a, p) => a + p.entryPrice * p.qty, 0) / totalQty;
            const totalNotional = sNew.positions.reduce((a, p) => a + p.notional, 0);
            await alerter.notifyRungOpened(level, config.maxPositions, price, newAvg, totalNotional);
          }
        }
      } finally {
        orderInFlight = false;
      }

      // Status + save after trade
      const updatedState = state.get();
      const updatedEq = calcEquity(updatedState.positions, price, capital);
      logger.printStatus(executor.getMode(), config.symbol, price, updatedState.positions, updatedEq.equity, capital, dd, trend.blocked, riskOff.blocked, config.maxPositions);
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
      } else if (orderStatus.status === "Filled" && pendingOrder.action === "hedge_open" && orderStatus.filledQty > 0) {
        // Hedge open filled but state.openHedge() was never called
        logger.warn("RECONCILIATION: Pending hedge_open was FILLED on exchange. Importing hedge into state.");
        const tpPrice = orderStatus.avgPrice * (1 - config.hedge.tpPct / 100);
        const killPrice = orderStatus.avgPrice * (1 + config.hedge.killPct / 100);
        state.openHedge({
          entryPrice: orderStatus.avgPrice,
          entryTime: pendingOrder.createdAt,
          qty: orderStatus.filledQty,
          notional: orderStatus.filledQty * orderStatus.avgPrice,
          tpPrice,
          killPrice,
          orderId: pendingOrder.orderLinkId,
        });
      } else if (pendingOrder.action === "hedge_close") {
        // Hedge close was in-flight — whether filled or not, clear local hedge state
        // Short position status will be verified in the short reconciliation below
        logger.warn(`RECONCILIATION: Stale hedge_close pending order (status: ${orderStatus.status}). Clearing local hedge state — short position will be checked below.`);
        state.clearHedge();
      }
      // For filled closes (long): position state will be reconciled in the position check below
    } else {
      logger.info("RECONCILIATION: Pending order not found on exchange (may have been rejected or expired).");
      if (pendingOrder.action === "hedge_close") {
        // Close not found — could mean it was rejected (short still open) or filled immediately
        logger.warn("RECONCILIATION: Pending hedge_close not found on exchange. Clearing local hedge state — short position will be checked below.");
        state.clearHedge();
      }
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

    // ── Short-side (hedge) reconciliation ──
    const exchangeShortPos = posRes.result.list.find(
      (p: any) => p.symbol === config.symbol && parseFloat(p.size) > 0 && p.side === "Sell",
    );
    const localHasHedge = !!localState.hedgePosition;
    const exchangeHasShort = !!exchangeShortPos;

    if (localHasHedge && !exchangeHasShort) {
      // Local thinks hedge is open but exchange has no short — it was already closed (native TP/SL or manual)
      logger.warn("RECONCILIATION: Local hedge state is set but exchange has NO short position — clearing stale hedge state.");
      state.clearHedge();
    } else if (!localHasHedge && exchangeHasShort) {
      // Orphaned short on exchange — no local record
      const shortSize = parseFloat(exchangeShortPos.size);
      const shortEntry = parseFloat(exchangeShortPos.avgPrice);
      logger.warn(`RECONCILIATION: Exchange has ORPHANED SHORT ${shortSize} ${config.symbol} @ $${shortEntry} — no local hedge record.`);
      logger.warn("RECONCILIATION: Importing orphaned short into local hedge state to prevent untracked exposure.");
      const tpPrice = shortEntry * (1 - config.hedge.tpPct / 100);
      const killPrice = shortEntry * (1 + config.hedge.killPct / 100);
      state.openHedge({
        entryPrice: shortEntry,
        entryTime: Date.now(),
        qty: shortSize,
        notional: shortSize * shortEntry,
        tpPrice,
        killPrice,
        orderId: "recovered_short_from_exchange",
      });
      logger.warn(`RECONCILIATION: Imported short hedge — TP $${tpPrice.toFixed(4)} kill $${killPrice.toFixed(4)}. Review manually if unexpected.`);
    } else if (localHasHedge && exchangeHasShort) {
      const localHedge = localState.hedgePosition!;
      const exchShortSize = parseFloat(exchangeShortPos.size);
      const hedgeSizeDiff = Math.abs(exchShortSize - localHedge.qty) / exchShortSize;
      if (hedgeSizeDiff > 0.05) {
        logger.warn(`RECONCILIATION: Hedge size mismatch — exchange short ${exchShortSize.toFixed(4)} vs local ${localHedge.qty.toFixed(4)} (${(hedgeSizeDiff * 100).toFixed(1)}% diff)`);
      } else {
        logger.info(`Reconciliation: hedge short exchange ${exchShortSize.toFixed(4)} ~ local ${localHedge.qty.toFixed(4)}. OK.`);
      }
    }
    // else both flat on short side — nothing to do

  } catch (err: any) {
    logger.logError(`Reconciliation error: ${err.message}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
