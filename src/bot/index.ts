import dotenv from "dotenv";
import path from "path";
import fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { loadBotConfig, saveBotConfigTemplate } from "./bot-config";
import { StateManager } from "./state";
import { BotLogger } from "./monitor";
import { LadderAlerter } from "./ladder-alerter";
import { DryRunExecutor, LiveExecutor, Executor, genOrderLinkId, InstrumentLotInfo, OrderResult } from "./executor";
import { LiveContextManager } from "./context-manager";
import { PriceFeed, PriceUpdate } from "./price-feed";
import { SRLevelEngine, DEFAULT_SR_CONFIG } from "./sr-levels";
import { SRMemoryZoneEngine, DEFAULT_SR_MEMORY_ZONE_CONFIG } from "./sr-memory-zones";
import {
  checkBatchTp, calcAddSize, canAffordAdd,
  checkTrendGate, checkMarketRiskOff, checkLadderKill,
  checkVolExpansion, checkCrsiHedge, calcEquity,
  checkEmergencyKill, checkHardFlatten, checkSoftStale, checkFundingSpike,
  checkOverextendedEntry,
  checkRegimeBreaker,
  checkPreKillWarning,
  checkDeepAddStressGuard,
} from "./strategy";
import { Candle } from "../fetch-candles";
import { computeOnChainFeatures, logDecision } from "./shadow-logger";
import {
  evaluateScorePartialFlatten,
  scorePartialFlattenLadderId,
  writeScorePartialFlattenSignal,
} from "./score-partial-flatten";
import { evaluateGateShadowCandidates, writeGateShadowSignal } from "./gate-shadow";
import { evaluateHedgeShadowCandidates, writeHedgeShadowSignal } from "./hedge-shadow";
import { evaluateSRShadowCandidates, writeSRShadowSignal } from "./sr-shadow";
import { evaluateDeepAddStressShadow, writeDeepAddStressShadowSignal } from "./deep-add-stress-shadow";
import {
  evaluatePullbackExitShadow,
  PullbackExitShadowDecision,
  writePullbackExitShadowSignal,
} from "./pullback-exit-shadow";
import { evaluatePullbackActionShadow, writePullbackActionShadowSignal } from "./pullback-action-shadow";
import { evaluateEuphoriaShadow, writeEuphoriaShadowSignal } from "./euphoria-shadow";
import { evaluateEuphoriaStopShadow, writeEuphoriaStopShadowSignal } from "./euphoria-stop-shadow";
import { evaluateHfDeferShadow, resolveHfDeferShadow, writeHfDeferShadowSignal } from "./hf-defer-shadow";
import { executePartialCloseTransaction, resolvePendingPartialClose } from "./partial-close-coordinator";
import { buildProRataAllocation, buildSelectedIdsAllocation } from "./partial-close-transaction";
import { LongSideGuard } from "./long-side-guard";

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

async function getReconciliationLotInfo(
  executor: Executor,
  symbol: string,
  logger: BotLogger,
): Promise<InstrumentLotInfo | null> {
  try {
    return await executor.getInstrumentLotInfo(symbol);
  } catch (err: any) {
    logger.logError(`RECONCILIATION: Could not load lot info for strict quantity check: ${err.message}`);
    return null;
  }
}

function calcQtySync(exchangeSize: number, localSize: number, lotInfo: InstrumentLotInfo) {
  const absDiff = Math.abs(exchangeSize - localSize);
  const pctDiff = exchangeSize > 0 ? absDiff / exchangeSize : (localSize > 0 ? absDiff / localSize : 0);
  // Allow float dust, but catch any real executable lot drift.
  const tolerance = Math.max(lotInfo.qtyStep / 2, 1e-8);
  return {
    absDiff,
    pctDiff,
    tolerance,
    synced: absDiff <= tolerance,
  };
}

function logQuantityMismatch(
  logger: BotLogger,
  label: string,
  exchangeSize: number,
  localSize: number,
  sync: ReturnType<typeof calcQtySync>,
) {
  logger.logError(
    `RECONCILIATION: ${label} size mismatch - exchange ${exchangeSize.toFixed(4)} vs local ${localSize.toFixed(4)} ` +
    `(diff ${sync.absDiff.toFixed(4)} / ${(sync.pctDiff * 100).toFixed(3)}%, tolerance ${sync.tolerance.toFixed(8)}). ` +
    "Entering recovery mode; no new adds until exchange/local state is repaired.",
  );
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
const SIGNAL_REGIME_ARM = path.join(SIGNAL_DIR, "bot-regime-arm");

function writeSrPartialExitAction(symbol: string, row: Record<string, any>): void {
  const outPath = path.resolve(SIGNAL_DIR, "data", `${symbol}_sr_partial_exit_actions.jsonl`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(row) + "\n");
}

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
    if (!localHasPositions && exchangeHasPosition) {
      const exchangeSize = parseFloat(exchangePos.size);
      const exchangeEntry = parseFloat(exchangePos.avgPrice);
      logger.logError(`RECONCILIATION: Exchange has untracked long ${exchangeSize.toFixed(4)} ${config.symbol} @ $${exchangeEntry.toFixed(4)} while local state is empty. Entering recovery mode; no new adds.`);
      state.setRecoveryMode(true);
      return { synced: false, exchangeFlat: false };
    }

    if (localHasPositions && exchangeHasPosition) {
      const exchangeSize = parseFloat(exchangePos.size);
      const localSize = localState.positions.reduce((s, p) => s + p.qty, 0);
      const lotInfo = await getReconciliationLotInfo(executor, config.symbol, logger);
      if (!lotInfo) {
        state.setRecoveryMode(true);
        return { synced: false, exchangeFlat: false };
      }
      const sync = calcQtySync(exchangeSize, localSize, lotInfo);

      if (!sync.synced) {
        logQuantityMismatch(logger, "Long", exchangeSize, localSize, sync);
        state.setRecoveryMode(true);
        return { synced: false, exchangeFlat: false };
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
      if (config.hedge.enabled) {
        const shortSize = parseFloat(exchangeShortPos.size);
        const shortEntry = parseFloat(exchangeShortPos.avgPrice);
        logger.warn(`RECONCILIATION: Orphaned short on exchange (${shortSize} @ $${shortEntry}) — no local hedge record. Manual review required.`);
      }
      // hedge.enabled=false → any short on positionIdx=2 belongs to wed/d1-short, not us. Silent.
    }

    if (localHasHedge && exchangeHasShort) {
      const localHedge = localState.hedgePosition!;
      const exchShortSize = parseFloat(exchangeShortPos.size);
      const lotInfo = await getReconciliationLotInfo(executor, config.symbol, logger);
      if (!lotInfo) {
        state.setRecoveryMode(true);
        return { synced: false, exchangeFlat: false };
      }
      const hedgeSync = calcQtySync(exchShortSize, localHedge.qty, lotInfo);
      if (!hedgeSync.synced) {
        logQuantityMismatch(logger, "Hedge short", exchShortSize, localHedge.qty, hedgeSync);
        state.setRecoveryMode(true);
        return { synced: false, exchangeFlat: false };
      }
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

  // Touch data/prekill_warnings.jsonl at startup so file absence on the VPS is
  // unambiguous (means "never deployed", not "deployed but quiet").
  try {
    const pkPath = path.resolve(SIGNAL_DIR, "data", "prekill_warnings.jsonl");
    const pkDir = path.dirname(pkPath);
    if (!fs.existsSync(pkDir)) fs.mkdirSync(pkDir, { recursive: true });
    if (!fs.existsSync(pkPath)) fs.writeFileSync(pkPath, "");
  } catch (err: any) {
    logger.warn(`Pre-kill warnings file init failed (non-fatal): ${err.message}`);
  }

  try {
    const hsPath = path.resolve(SIGNAL_DIR, "data", `${config.symbol}_hedge_shadow_signals.jsonl`);
    const hsDir = path.dirname(hsPath);
    if (!fs.existsSync(hsDir)) fs.mkdirSync(hsDir, { recursive: true });
    if (!fs.existsSync(hsPath)) fs.writeFileSync(hsPath, "");
  } catch (err: any) {
    logger.warn(`Hedge shadow file init failed (non-fatal): ${err.message}`);
  }

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

  const srMemoryConfig = {
    ...DEFAULT_SR_MEMORY_ZONE_CONFIG,
    ...(config.srShadow ?? {}),
    enabled: !!(config.srShadow?.enabled || config.srPartialExitAction?.enabled),
  };
  const srMemoryEngine = new SRMemoryZoneEngine(srMemoryConfig);
  try {
    const now = Date.now();
    srMemoryEngine.rebuild(ctxMgr.getCandles(), now);
    if (config.srShadow?.enabled) {
      logger.info(`S/R shadow: enabled ${config.srShadow.tfMin}m memory zones=${srMemoryEngine.countZones(now)} recentDays=${config.srShadow.recentDays} (no orders)`);
    }
  } catch (err: any) {
    logger.warn(`S/R shadow initial rebuild failed (non-fatal): ${err.message}`);
  }

  logger.info(`Bot starting: ${config.symbol} | ${executor.getMode()} | ${config.basePositionUsdt}x${config.addScaleFactor} max${config.maxPositions} TP${config.tpPct}%`);
  logger.info(`Filters: trend=${config.filters.trendBreak} riskOff=${config.filters.marketRiskOff} vol=${config.filters.volExpansion} ladderKill=${config.filters.ladderLocalKill}`);
  if (config.hedgeShadow?.enabled) {
    logger.info(`Hedge shadow: enabled minDepth=${config.hedgeShadow.minDepth} cooldown=${config.hedgeShadow.cooldownMin}m (no short orders)`);
  }
  if (config.srPartialExitAction?.enabled) {
    logger.warn(`S/R partial-exit LIVE: enabled candidate=${config.srPartialExitAction.requiredCandidate} minDepth=${config.srPartialExitAction.minDepth} keep=${config.srPartialExitAction.keepRungs} cooldown=${config.srPartialExitAction.cooldownMin}m`);
  }
  if (config.pullbackExitShadow?.enabled) {
    logger.info(`Pullback exit shadow: enabled depth>=${config.pullbackExitShadow.minDepth} pnl<=${config.pullbackExitShadow.pnlPctMax}% ret12h<=${config.pullbackExitShadow.ret12hMax}% reclaim=${config.pullbackExitShadow.reclaimPct}% (no orders)`);
  }
  if (config.pullbackExitAction?.enabled) {
    logger.warn(`Pullback exit ACTION: enabled candidate=${config.pullbackExitAction.requiredCandidate} cooldown=${config.pullbackExitAction.cooldownMin}m`);
  }
  if (config.pullbackActionShadow?.enabled) {
    logger.info(`Pullback action shadow: enabled depth>=${config.pullbackActionShadow.minDepth} watch=${config.pullbackActionShadow.watchMin}m closePct=${(config.pullbackActionShadow.actionClosePct * 100).toFixed(0)}% (no orders)`);
  }
  if (config.pullbackAction?.enabled) {
    logger.warn(`Pullback action LIVE: enabled action=${config.pullbackAction.action} closePct=${(config.pullbackAction.closePct * 100).toFixed(0)}% cooldown=${config.pullbackAction.cooldownMin}m`);
  }
  if (config.euphoriaShadow?.enabled) {
    logger.info(`Euphoria shadow: enabled score>=${config.euphoriaShadow.minScore}/5 rel7d>=${config.euphoriaShadow.rel7dPctMin}% rel30d>=${config.euphoriaShadow.rel30dPctMin}% check=${config.euphoriaShadow.checkIntervalMin}m pullbackClear=${config.euphoriaShadow.pullbackFromHighClearPct}% (no orders)`);
  }
  if (config.euphoriaStopShadow?.enabled) {
    logger.info(`Euphoria stop shadow: enabled depth>=${config.euphoriaStopShadow.minDepth} pnl<=${config.euphoriaStopShadow.pnlPctMax}% aboveEMA200 below24hVWAP watch=${config.euphoriaStopShadow.watchMin}m reclaim=${config.euphoriaStopShadow.reclaimPct}% (no orders)`);
  }
  if (config.hfDeferShadow?.enabled) {
    logger.info(`Hard-flatten defer shadow: enabled depth>=${config.hfDeferShadow.minDepth} ret12h>${config.hfDeferShadow.ret12hMin}% delay=${config.hfDeferShadow.delayMin}m (no orders)`);
  }
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

  const hedgeShadowLastFire = new Map<string, number>();
  const srShadowLastFire = new Map<string, number>();
  let deepAddStressShadowLastLog = 0;
  let preKillLastLog = 0;
  let euphoriaShadowLastCheck = 0;

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

  async function executeFullLongClose(orderLinkId: string, createdAt: number): Promise<OrderResult> {
    const existingPending = state.getPendingOrder();
    if (existingPending) {
      logger.logError(`Cannot start full close ${orderLinkId}: pending order ${existingPending.orderLinkId} (${existingPending.action}) is unresolved. Entering recovery mode.`);
      state.setRecoveryMode(true);
      return { success: false, orderId: "", price: 0, priceType: "quote", qty: 0, notional: 0, error: `pending order already active: ${existingPending.orderLinkId}` };
    }

    state.setPendingOrder({
      orderLinkId,
      action: "close",
      symbol: config.symbol,
      notional: 0,
      createdAt,
    });

    const closeResult = await executor.closeAllLongs(config.symbol, orderLinkId);
    if (closeResult.success) {
      return closeResult;
    }

    if (isExchangeMode(config.mode)) {
      const observed = await executor.queryOrderExecution(config.symbol, orderLinkId);
      if (observed.found && observed.cumExecQty > 0 && observed.avgPrice > 0 && observed.terminal) {
        const lotInfo = await getReconciliationLotInfo(executor, config.symbol, logger);
        const localQty = state.get().positions.reduce((sum, p) => sum + p.qty, 0);
        if (lotInfo) {
          const tolerance = Math.max(lotInfo.qtyStep / 2, 1e-8);
          const remainingLong = await executor.getLongPositionSize(config.symbol);
          const filledEnough = observed.cumExecQty >= localQty - tolerance;
          const exchangeFlat = remainingLong <= tolerance;
          if (filledEnough && exchangeFlat) {
            logger.warn(`Full close initially reported failed, but exchange confirms full terminal fill ${observed.status}: ${observed.cumExecQty.toFixed(4)} @ $${observed.avgPrice.toFixed(4)}.`);
            return {
              success: true,
              orderId: observed.orderId,
              price: observed.avgPrice,
              priceType: "fill",
              qty: observed.cumExecQty,
              notional: observed.cumExecQty * observed.avgPrice,
            };
          }
          logger.logError(`Full close ${orderLinkId} has terminal partial/ambiguous fill (${observed.status} ${observed.cumExecQty.toFixed(4)}/${localQty.toFixed(4)}, remaining ${remainingLong.toFixed(4)}); pending retained and recovery mode enabled.`);
        } else {
          logger.logError(`Full close ${orderLinkId} has terminal fill but lot info is unavailable; pending retained and recovery mode enabled.`);
        }
        state.setRecoveryMode(true);
        return {
          ...closeResult,
          orderId: observed.orderId,
          price: observed.avgPrice,
          priceType: "fill",
          qty: observed.cumExecQty,
          notional: observed.cumExecQty * observed.avgPrice,
          error: closeResult.error ?? `close not fully confirmed: ${observed.status}`,
        };
      }

      if (observed.found && !observed.terminal) {
        logger.logError(`Full close order ${orderLinkId} is unresolved on exchange (${observed.status}); pending order retained and recovery mode enabled.`);
        state.setRecoveryMode(true);
        return {
          ...closeResult,
          error: closeResult.error ?? `close unresolved: ${observed.status}`,
        };
      }
    }

    if (isExchangeMode(config.mode)) {
      logger.logError(`Full close ${orderLinkId} failed or is ambiguous (${closeResult.error ?? "unknown"}); pending retained and recovery mode enabled.`);
      state.setRecoveryMode(true);
      return closeResult;
    }

    state.clearPendingOrder();
    return closeResult;
  }

  function resolveFullCloseExitPrice(closeResult: OrderResult, fallbackPrice: number): number {
    if (closeResult.qty > 0 && closeResult.price > 0) return closeResult.price;
    if (fallbackPrice > 0) return fallbackPrice;
    if (closeResult.price > 0) return closeResult.price;
    return 0;
  }

  // ── Flatten helper — closes entire ladder ──
  async function flattenLadder(reason: string, price: number): Promise<boolean> {
    const result = await runLongSideMutation(`flatten:${reason.slice(0, 48)}`, async () => {
      const s = state.get();
      if (s.positions.length === 0) return false;

      logger.warn(`FLATTEN: ${reason}`);
      // Snapshot pre-close stats for the alert
      const preAvg = s.positions.reduce((a, p) => a + p.entryPrice * p.qty, 0) /
                     s.positions.reduce((a, p) => a + p.qty, 0);
      const preRungs = s.positions.length;
      const preOldest = Math.min(...s.positions.map(p => p.entryTime));

      logDecision(config.symbol, "flatten", {
        reason,
        price,
        rungs: preRungs,
        avgEntry: preAvg,
        avgPnlPct: preAvg > 0 ? ((price - preAvg) / preAvg) * 100 : 0,
        holdHours: (Date.now() - preOldest) / 3600000,
      });

      if (isExchangeMode(config.mode)) {
        const clsId = genOrderLinkId("exit");
        const closeResult = await executeFullLongClose(clsId, Date.now());
        if (!closeResult.success) {
          logger.logError(`Flatten FAILED on exchange: ${closeResult.error}`);
          return false;
        }
        const exitPrice = resolveFullCloseExitPrice(closeResult, price);
        if (exitPrice <= 0) {
          logger.logError("Flatten FAILED: full close succeeded but no usable exit price; pending retained and recovery mode enabled.");
          state.setRecoveryMode(true);
          return false;
        }
        const stateResult = state.closeAllPositions(exitPrice, Date.now(), config.feeRate);
        state.clearPendingOrder();
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, preAvg, exitPrice);
        await alerter.notifyClosed(reason, preRungs, preAvg, exitPrice, stateResult.totalPnl, (Date.now() - preOldest) / 3600000);
        if (state.isRecoveryMode()) {
          await cancelRecoveryTpIfExists();
          state.setRecoveryMode(false);
        }
      } else {
        const stateResult = state.closeAllPositions(price, Date.now(), config.feeRate);
        capital = await refreshCapital();
        logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, preAvg, price);
        await alerter.notifyClosed(reason, preRungs, preAvg, price, stateResult.totalPnl, (Date.now() - preOldest) / 3600000);
      }
      // Also close hedge if open — ladder gone, hedge rationale gone
      await closeHedge_internal(`ladder flattened (${reason})`, price);
      return true;
    });
    return result ?? false;
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
    state.setDesiredLongTp({
      price: tpPrice,
      positionQtyBasis: totalQty,
      activeTpPct,
      updatedAt: Date.now(),
      syncStatus: "pending",
    });
    const result = await executor.setPositionTp(config.symbol, tpPrice, 1);
    if (result.success) {
      state.markDesiredLongTpConfirmed(tpPrice, Date.now());
      const suffix = result.status === "not_modified" ? " (already set)" : "";
      logger.info(`Exchange TP updated${suffix}: $${tpPrice.toFixed(4)} (avg $${avgEntry.toFixed(4)}, ${activeTpPct}%)`);
    } else {
      const error = result.error ?? result.retMsg ?? "unknown TP sync failure";
      state.markDesiredLongTpFailed(tpPrice, Date.now(), error);
      logger.warn(`Exchange TP update FAILED: $${tpPrice.toFixed(4)} (avg $${avgEntry.toFixed(4)}, ${activeTpPct}%) — ${error}`);
    }
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
  const longSideGuard = new LongSideGuard();
  async function runLongSideMutation<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    if (orderInFlight && !longSideGuard.isBusy) {
      logger.warn(`LONG-SIDE ${label} skipped: legacy orderInFlight active`);
      return null;
    }
    const result = await longSideGuard.tryRun(label, async () => {
      orderInFlight = true;
      try {
        return await fn();
      } finally {
        orderInFlight = false;
      }
    });
    if (!result.acquired) {
      logger.warn(`LONG-SIDE ${label} skipped: ${result.activeLabel ?? "unknown"} already in flight`);
      return null;
    }
    return result.value;
  }
  async function executeGuardedPartialClose(
    label: string,
    req: Omit<Parameters<typeof executePartialCloseTransaction>[0], "state" | "executor">,
  ) {
    return runLongSideMutation(label, () => executePartialCloseTransaction({
      ...req,
      state,
      executor,
    }));
  }

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
          logDecision(config.symbol, "tp_fill", {
            reason: preTpReason,
            rungs: preTpRungs,
            avgEntry: tp.avgEntry,
            exitPrice: restPrice,
            tpPrice: tp.tpPrice,
            holdHours: (Date.now() - preTpOldest) / 3600000,
            tpPctActive: activeTpPct,
            stale: activeTpPct < config.tpPct,
          });
          try {
            if (isExchangeMode(config.mode)) {
              const clsId = genOrderLinkId("close");
              const closeResult = await executeFullLongClose(clsId, Date.now());
              if (closeResult.success) {
                const restExitPrice = resolveFullCloseExitPrice(closeResult, tp.tpPrice);
                if (restExitPrice <= 0) {
                  logger.logError("REST TP close succeeded but no usable exit price; pending retained and recovery mode enabled.");
                  state.setRecoveryMode(true);
                  return;
                }
                const stateResult = state.closeAllPositions(restExitPrice, Date.now(), config.feeRate);
                state.clearPendingOrder();
                capital = await refreshCapital();
                await closeHedge_internal("ladder TP (REST)", restExitPrice);
                logger.logBatchClose(config.symbol, stateResult.positionsClosed, stateResult.totalPnl, stateResult.totalFees, tp.avgEntry, restExitPrice);
                await alerter.notifyClosed(preTpReason, preTpRungs, tp.avgEntry, restExitPrice, stateResult.totalPnl, (Date.now() - preTpOldest) / 3600000);
                if (state.isRecoveryMode()) {
                  state.setRecoveryMode(false);
                  logger.info("Recovery mode cleared — ladder fully closed on exchange.");
                }
                checkTpCooldown();
              } else {
                logger.logError(`REST batch close FAILED on exchange: ${closeResult.error} - state NOT cleared`);
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
      logDecision(config.symbol, "tp_fill", {
        reason: preTpReason,
        rungs: preTpRungs,
        avgEntry: tp.avgEntry,
        exitPrice: update.bid1,
        tpPrice: tp.tpPrice,
        holdHours: (Date.now() - preTpOldest) / 3600000,
        tpPctActive: activeTpPct,
        stale: activeTpPct < config.tpPct,
      });

      if (isExchangeMode(config.mode)) {
        const clsId = genOrderLinkId("close");
        const closeResult = await executeFullLongClose(clsId, Date.now());
        if (!closeResult.success) {
          logger.logError(`Batch close FAILED on exchange: ${closeResult.error} — state NOT cleared`);
          orderInFlight = false;
          return;
        }
        // Only clear state after confirmed exchange close
        // If native TP already fired (qty=0), use calculated tpPrice as exit price
        const exitPrice = resolveFullCloseExitPrice(closeResult, tp.tpPrice);
        if (exitPrice <= 0) {
          logger.logError("Batch close FAILED: full close succeeded but no usable exit price; state NOT cleared");
          state.setRecoveryMode(true);
          orderInFlight = false;
          return;
        }
        const stateResult = state.closeAllPositions(exitPrice, Date.now(), config.feeRate);
        state.clearPendingOrder();
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
  const GATE_SHADOW_LOG_INTERVAL_MS = 5 * 60 * 1000;
  const gateShadowLastLog = new Map<string, number>();

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

      try {
        if (srMemoryEngine.needsRebuild(now)) {
          srMemoryEngine.rebuild(ctxMgr.getCandles(), now);
          if (config.srShadow?.enabled) {
            logger.info(`S/R shadow rebuild: ${srMemoryEngine.countZones(now)} memory zones`);
          }
        }
      } catch { /* non-fatal */ }

      // ── Signal file checks ──
      if (config.hfDeferShadow?.enabled) {
        try {
          const deferOutcome = resolveHfDeferShadow({
            symbol: config.symbol,
            nowMs: now,
            price,
            config,
          });
          if (deferOutcome?.fired) {
            writeHfDeferShadowSignal(config.symbol, deferOutcome);
            const delta = deferOutcome.outcome.estimatedDelta;
            const deltaText = typeof delta === "number" ? `$${delta.toFixed(2)}` : "NA";
            const direction = deferOutcome.outcome.betterThanImmediate ? "helped" : "hurt";
            logger.warn(`HF DEFER SHADOW: 30m outcome ${direction} by ${deltaText} | trigger=$${deferOutcome.trigger.triggerPrice?.toFixed(4) ?? "NA"} due=$${deferOutcome.outcome.duePrice?.toFixed(4) ?? "NA"} (shadow only)`);
          }
        } catch (err: any) {
          logger.warn(`Hard-flatten defer shadow resolve failed (non-fatal): ${err.message}`);
        }
      }

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
        const pending = state.getPendingOrder();
        if (orderInFlight || longSideGuard.isBusy || pending) {
          logger.warn(`Reconciliation deferred: ${orderInFlight ? "orderInFlight " : ""}${longSideGuard.isBusy ? `guard=${longSideGuard.label} ` : ""}${pending ? `pending=${pending.orderLinkId}` : ""}`.trim());
          await sleep(config.pollIntervalSec * 1000);
          continue;
        }
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
      let trendRefreshForExit: ReturnType<typeof checkTrendGate> | null = null;
      if (s.positions.length > 0) {
        const hype4hForExit = await getHype4h();
        const trendRefresh = checkTrendGate(hype4hForExit, config);
        trendRefreshForExit = trendRefresh;
        state.updateTrendCheck(now, trendRefresh.blocked, trendRefresh.reason);
      }

      // ── Pre-kill warning gate — WARNING ONLY, no position action ──
      // Replay 8/8 kill recall @ score>=4.5 (variable lead time pre-event).
      // Per-fire telemetry written to data/prekill_warnings.jsonl for component
      // attribution research (codex-5.7-r1a).
      if (s.positions.length > 0) {
        try {
          const ctxForWarn = (() => { try { return ctxMgr.getContext(); } catch { return null; } })();
          const btc1hForWarn = await getBtc1h();
          const preKill = checkPreKillWarning(s.positions, price, btc1hForWarn, ctxForWarn);
          if (preKill.score >= 4.5) {
            if (now - preKillLastLog >= 60_000) {
              preKillLastLog = now;
              logger.warn(`PRE-KILL WARNING: score=${preKill.score.toFixed(1)} ladderPnl=${preKill.ladderPnlPct.toFixed(2)}% depth=${preKill.depth} reasons=${preKill.reasons.join(",")}`);
            }
            // Structured telemetry — appended every fire, not rate-limited
            // (alerter handles dedup for Discord; this captures the full series).
            try {
              const ts = new Date().toISOString();
              const telemetryPath = path.resolve(SIGNAL_DIR, "data", "prekill_warnings.jsonl");
              const dir = path.dirname(telemetryPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              const oldestEntryTime = s.positions.length > 0 ? Math.min(...s.positions.map(p => p.entryTime)) : 0;
              const totalNotional = s.positions.reduce((sum, p) => sum + p.notional, 0);
              const oldestAgeHours = oldestEntryTime > 0 ? (Date.now() - oldestEntryTime) / 3600000 : 0;
              fs.appendFileSync(telemetryPath, JSON.stringify({
                ts,
                timestamp: Date.parse(ts),
                source: "hedgeguy-bot",
                symbol: config.symbol,
                ladderId: oldestEntryTime > 0 ? `ladder_${oldestEntryTime}` : null,
                score: preKill.score,
                ladderPnlPct: preKill.ladderPnlPct,
                avgEntry: preKill.avgEntry,
                price,
                depth: preKill.depth,
                totalNotional,
                oldestAgeHours,
                reasons: preKill.reasons,
                components: preKill.components,
              }) + "\n");
            } catch (telErr: any) {
              logger.warn(`Pre-kill telemetry write failed (non-fatal): ${telErr.message}`);
            }
            if (alerter) {
              await alerter.notifyPreKillWarning(preKill.score, preKill.reasons, preKill.ladderPnlPct, preKill.depth);
            }
          }
        } catch (err: any) {
          logger.warn(`Pre-kill warning check failed (non-fatal): ${err.message}`);
        }
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
          if (config.hfDeferShadow?.enabled) {
            try {
              const deferShadow = evaluateHfDeferShadow({
                symbol: config.symbol,
                nowMs: now,
                price,
                positions: s.positions,
                candles5m: ctxMgr.getCandles(),
                config,
                hardFlat,
              });
              if (deferShadow?.fired) {
                writeHfDeferShadowSignal(config.symbol, deferShadow);
                logger.warn(`HF DEFER SHADOW: would wait ${config.hfDeferShadow.delayMin}m before hard flatten | depth=${deferShadow.ladder.depth} pnl=${deferShadow.ladder.pnlPct?.toFixed(2) ?? "NA"}% ret12h=${deferShadow.trigger.ret12hPct?.toFixed(2) ?? "NA"}% (shadow only)`);
              }
            } catch (err: any) {
              logger.warn(`Hard-flatten defer shadow check failed (non-fatal): ${err.message}`);
            }
          }
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

        // 2a. Custom score partial-flatten path. Shadow-only by default:
        // logs first fire per ladder, but does not touch exchange state unless
        // scorePartialFlatten.shadowOnly is explicitly set false.
        const spfCfg = config.scorePartialFlatten;
        if (spfCfg?.enabled) {
          try {
            const ladderId = scorePartialFlattenLadderId(s.positions);
            const latch = state.get().scorePartialFlatten;
            const alreadyFired = spfCfg.oneShotPerLadder && latch?.ladderId === ladderId;
            const scoreDecision = await evaluateScorePartialFlatten(config.symbol, now, price, s.positions, ctxMgr.getCandles(), config);
            const emitScoreSignals = spfCfg.emitSignals !== false;

            if (emitScoreSignals) {
              logger.logFilterShadow("score_partial_flatten", scoreDecision.fire && !alreadyFired, {
                shadowOnly: spfCfg.shadowOnly,
                alreadyFired,
                reason: scoreDecision.reason,
                score: scoreDecision.snapshot.score,
                deepScore: scoreDecision.snapshot.deepScore,
                avoidScore: scoreDecision.snapshot.avoidScore,
                ladderPnlPct: scoreDecision.snapshot.ladderPnlPct,
                depth: scoreDecision.snapshot.depth,
              });
            }

            if (scoreDecision.fire && !alreadyFired) {
              const totalQty = s.positions.reduce((sum, p) => sum + p.qty, 0);
              const closePct = Math.max(0, Math.min(0.95, spfCfg.closePct));
              const closeQty = totalQty * closePct;
              const action = spfCfg.shadowOnly ? "shadow" : "partial_flatten";
              if (emitScoreSignals) {
                writeScorePartialFlattenSignal(config.symbol, scoreDecision, {
                  ladderId,
                  action,
                  closePct,
                  closeQty,
                  oneShotPerLadder: spfCfg.oneShotPerLadder,
                });
              }

              if (spfCfg.shadowOnly) {
                state.markScorePartialFlatten({
                  ladderId,
                  firedAt: now,
                  score: scoreDecision.snapshot.score,
                  action,
                });
                if (emitScoreSignals) {
                  logger.warn(`SCORE PARTIAL SHADOW: ${scoreDecision.reason}; would reduce ${(closePct * 100).toFixed(0)}% (${closeQty.toFixed(4)} qty)`);
                }
              } else if (closeQty > 0) {
                logger.warn(`SCORE PARTIAL FLATTEN: ${scoreDecision.reason}; reducing ${(closePct * 100).toFixed(0)}% (${closeQty.toFixed(4)} qty)`);
                  const scorePositions = state.get().positions;
                const txResult = await executeGuardedPartialClose("score-partial", {
                    symbol: config.symbol,
                    exchangeMode: isExchangeMode(config.mode),
                    now,
                    quotePrice: price,
                    feeRate: config.feeRate,
                    strategy: "score_partial",
                    orderAction: "scoreflat",
                    actionKey: `score:${ladderId}:${scoreDecision.snapshot.score.toFixed(2)}`,
                    requestedQty: closeQty,
                    allocation: buildProRataAllocation(scorePositions),
                    desiredPostCommit: {
                      scoreLatch: {
                        ladderId,
                        firedAt: now,
                        score: scoreDecision.snapshot.score,
                        action,
                      },
                    },
                  });

                if (txResult && txResult.outcome === "committed" && txResult.filledQty > 0 && txResult.fillPrice !== null) {
                    const actualShare = Math.max(0, Math.min(1, txResult.filledQty / totalQty));
                    capital = await refreshCapital();
                    const modeSuffix = isExchangeMode(config.mode) ? "" : " [dry-run]";
                    logger.info(`SCORE PARTIAL FLAT${modeSuffix}: reduced ${(actualShare * 100).toFixed(1)}% across ${txResult.positionsReduced} rungs PnL $${txResult.totalPnl.toFixed(2)} fees $${txResult.totalFees.toFixed(2)} @ $${txResult.fillPrice.toFixed(4)}`);
                    await updateExchangeTp();
                } else if (txResult?.outcome === "pending") {
                    logger.warn(`Score partial-flatten pending: ${txResult.status} ${txResult.filledQty.toFixed(4)}/${txResult.submittedQty.toFixed(4)} qty; state retained pending order ${txResult.orderLinkId}`);
                } else if (txResult) {
                    logger.logError(`Score partial-flatten reduce FAILED: ${txResult.error ?? txResult.status ?? txResult.outcome}`);
                  }
                await sleep(config.pollIntervalSec * 1000);
                continue;
              }
            }
          } catch (err: any) {
            logger.warn(`Score partial-flatten check failed (non-fatal): ${err.message}`);
          }
        }

        // 2b. SR partial-flatten: close most-profitable rungs on resistance touch.
        // (no-op when SR engine disabled or no active R within flattenBufferPct)
        try {
          const flatIdx = srEngine.partialFlattenIndices(s.positions, now, price);
          if (flatIdx && flatIdx.length > 0) {
            const closeQty = flatIdx.reduce((sum, i) => sum + s.positions[i].qty, 0);
            const r = srEngine.nearestActiveResistance(now, price);
            const reason = `SR partial-flatten: ${flatIdx.length} rung(s) (${closeQty.toFixed(4)} qty) near R=$${r?.lv.price.toFixed(4)} dist=${((r?.dist ?? 0) * 100).toFixed(2)}%`;
            logger.warn(reason);
              const srPositions = state.get().positions;
              const txResult = await executeGuardedPartialClose("sr-legacy-partial", {
                symbol: config.symbol,
                exchangeMode: isExchangeMode(config.mode),
                now,
                quotePrice: price,
                feeRate: config.feeRate,
                strategy: "sr_legacy",
                orderAction: "srflat",
                actionKey: `srlegacy:${flatIdx.map(i => srPositions[i]?.id ?? i).join("|")}:${r?.lv.price.toFixed(4) ?? "NA"}`,
                requestedQty: closeQty,
                allocation: buildSelectedIdsAllocation(srPositions, flatIdx.map(i => srPositions[i].id)),
                desiredPostCommit: {},
              });

              if (txResult && txResult.outcome === "committed" && txResult.filledQty > 0 && txResult.fillPrice !== null) {
                capital = await refreshCapital();
                const modeSuffix = isExchangeMode(config.mode) ? "" : " [dry-run]";
                logger.info(`SR FLAT${modeSuffix}: closed ${txResult.positionsClosed} rungs PnL $${txResult.totalPnl.toFixed(2)} fees $${txResult.totalFees.toFixed(2)} @ $${txResult.fillPrice.toFixed(4)}`);
                await updateExchangeTp();
              } else if (txResult?.outcome === "pending") {
                logger.warn(`SR partial-flatten pending: ${txResult.status} ${txResult.filledQty.toFixed(4)}/${txResult.submittedQty.toFixed(4)} qty; state retained pending order ${txResult.orderLinkId}`);
              } else if (txResult) {
                logger.logError(`SR partial-flatten reduce FAILED: ${txResult.error ?? txResult.status ?? txResult.outcome}`);
              }
            // Re-evaluate next tick — fall through and let normal exit/add logic resume
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
        } catch (err: any) {
          logger.warn(`SR partial-flatten check failed (non-fatal): ${err.message}`);
        }

        // 2c. Fable-5 S/R memory-zone action: bank the most-profitable rungs
        // into nearby resistance when pulse is deteriorating, keeping the worst
        // rungs alive for recovery.
        const srActionCfg = config.srPartialExitAction;
        if (
          srActionCfg?.enabled &&
          !state.isSrPartialExitActionCooldown(now) &&
          state.get().positions.length > 0
        ) {
          try {
            const actionPositions = state.get().positions;
            const pulse = await computeOnChainFeatures(config.symbol, now);
            const srDecision = evaluateSRShadowCandidates({
              symbol: config.symbol,
              nowMs: now,
              price,
              positions: actionPositions,
              pulse,
              config,
              zoneEngine: srMemoryEngine,
              addContext: {
                canAddTiming: false,
                timeGateOk: false,
                priceDropOk: false,
                atOldCap: false,
                tpPct: activeTpPct ?? config.tpPct,
              },
            });

            const required = srActionCfg.requiredCandidate;
            const plan = srDecision?.partialExitPlan ?? null;
            const resistance = srDecision?.levels.nearestResistance ?? null;
            const candidateReason = srDecision?.candidates.find(c => c.name === required)?.reason ?? "";
            const ladderPnl = srDecision?.ladder.pnlPct ?? null;
            const hasRequiredCandidate = !!srDecision?.firedCandidates.includes(required);
            const ladderPnlOk = ladderPnl !== null && ladderPnl >= srActionCfg.minLadderPnlPct;
            // Gate on NET (after entry+exit fees) plan PnL — matches the replay-validated behavior.
            const planProfitOk = !srActionCfg.requirePlanProfit || ((plan?.estimatedNetPnl ?? -Infinity) > 0);
            const resistanceOk = resistance !== null && resistance.distPct <= srActionCfg.resistanceBufferPct;
            const keepOk = plan !== null && plan.keepRungs === srActionCfg.keepRungs;

            if (
              srDecision &&
              hasRequiredCandidate &&
              plan &&
              resistance &&
              actionPositions.length >= srActionCfg.minDepth &&
              actionPositions.length > srActionCfg.keepRungs &&
              ladderPnlOk &&
              planProfitOk &&
              resistanceOk &&
              keepOk
            ) {
              // Close by position index (plan.closeIndices), never by rung level:
              // levels can duplicate after a partial exit + re-adds, which would
              // over-close. closeLevels stays telemetry-only.
              const flatIdx = (plan.closeIndices ?? []).filter(
                (i, k, arr) => Number.isInteger(i) && i >= 0 && i < actionPositions.length && arr.indexOf(i) === k,
              );
              const planValid = flatIdx.length === plan.closeCount;
              const closeQty = flatIdx.reduce((sum, i) => sum + actionPositions[i].qty, 0);
              const closeNotional = flatIdx.reduce((sum, i) => sum + actionPositions[i].notional, 0);
              const remainingRungs = actionPositions.length - flatIdx.length;

              if (!planValid) {
                logger.logError(`SR partial-exit action: invalid plan indices (${JSON.stringify(plan.closeIndices)}) for ${actionPositions.length} positions — skipping.`);
              }
              if (planValid && flatIdx.length > 0 && remainingRungs >= srActionCfg.keepRungs && closeQty > 0) {
                const reason = `SR PARTIAL EXIT ACTION: ${required}, close=${flatIdx.length}, keep=${srActionCfg.keepRungs}, estPnl=$${plan.estimatedPnl.toFixed(2)}, estNetPnl=$${plan.estimatedNetPnl.toFixed(2)}, R=$${resistance.price.toFixed(4)} ${resistance.distPct.toFixed(2)}%, pulseDeteriorating=${srDecision.pulse.pulseDeteriorating}`;
                logger.warn(`${reason}; reducing ${closeQty.toFixed(4)} qty`);
                writeSRShadowSignal(config.symbol, { ...srDecision, firedCandidates: [required] });
                writeSrPartialExitAction(config.symbol, {
                  ts: new Date(now).toISOString(),
                  timestamp: now,
                  source: "hedgeguy-bot",
                  symbol: config.symbol,
                  event: "candidate",
                  action: "partial_exit",
                  live: true,
                  candidate: required,
                  reason,
                  candidateReason,
                  price,
                  resistance,
                  closeIndices: flatIdx,
                  closeLevels: plan.closeLevels,
                  closeQty,
                  closeNotional,
                  estimatedPnl: plan.estimatedPnl,
                  estimatedNetPnl: plan.estimatedNetPnl,
                  ladder: srDecision.ladder,
                  pulse: srDecision.pulse,
                });
                  const until = now + srActionCfg.cooldownMin * 60000;
                  const actionKey = `srmem:${required}:${flatIdx.map(i => actionPositions[i].id).join("|")}:${resistance.price.toFixed(4)}`;
                  const txResult = await executeGuardedPartialClose("sr-memory-partial", {
                    symbol: config.symbol,
                    exchangeMode: isExchangeMode(config.mode),
                    now,
                    quotePrice: price,
                    feeRate: config.feeRate,
                    strategy: "sr_memory",
                    orderAction: "srmemflat",
                    actionKey,
                    requestedQty: closeQty,
                    allocation: buildSelectedIdsAllocation(actionPositions, flatIdx.map(i => actionPositions[i].id)),
                    desiredPostCommit: { srCooldownUntil: until },
                  });

                  if (txResult && txResult.outcome === "committed" && txResult.filledQty > 0 && txResult.fillPrice !== null) {
                      capital = await refreshCapital();
                    const modeSuffix = isExchangeMode(config.mode) ? "" : " [dry-run]";
                    logger.info(`SR PARTIAL EXIT${modeSuffix}: closed ${txResult.positionsClosed} rungs PnL $${txResult.totalPnl.toFixed(2)} fees $${txResult.totalFees.toFixed(2)} @ $${txResult.fillPrice.toFixed(4)}; cooldown until ${new Date(until).toISOString().slice(0, 16)}`);
                      writeSrPartialExitAction(config.symbol, {
                        ts: new Date().toISOString(),
                        timestamp: Date.now(),
                        source: "hedgeguy-bot",
                        symbol: config.symbol,
                        event: "executed",
                        action: "partial_exit",
                        live: true,
                        candidate: required,
                        reason,
                      orderId: txResult.orderId,
                      orderLinkId: txResult.orderLinkId,
                        requestedQty: closeQty,
                      filledQty: txResult.filledQty,
                      fillPrice: txResult.fillPrice,
                      fillPriceType: "fill",
                        resistance,
                        closeIndices: flatIdx,
                        closeLevels: plan.closeLevels,
                        closeNotional,
                        estimatedPnl: plan.estimatedPnl,
                        estimatedNetPnl: plan.estimatedNetPnl,
                      realizedPnl: txResult.totalPnl,
                      fees: txResult.totalFees,
                      positionsClosed: txResult.positionsClosed,
                      remainingRungs: txResult.remainingRungs,
                        cooldownUntil: until,
                      });
                      await alerter.notifySrPartialExit({
                      closedRungs: txResult.positionsClosed,
                      remainingRungs: txResult.remainingRungs,
                        keepRungs: srActionCfg.keepRungs,
                      price: txResult.fillPrice,
                        resistancePrice: resistance.price,
                        resistanceDistPct: resistance.distPct,
                      realizedPnl: txResult.totalPnl,
                        closeNotional,
                        reason,
                      });
                      await updateExchangeTp();
                  } else if (txResult?.outcome === "pending") {
                    logger.warn(`SR partial-exit action pending: ${txResult.status} ${txResult.filledQty.toFixed(4)}/${txResult.submittedQty.toFixed(4)} qty; state retained pending order ${txResult.orderLinkId}`);
                    writeSrPartialExitAction(config.symbol, {
                      ts: new Date(now).toISOString(),
                      timestamp: now,
                      source: "hedgeguy-bot",
                      symbol: config.symbol,
                      event: "pending",
                      action: "partial_exit",
                      live: isExchangeMode(config.mode),
                      candidate: required,
                      reason,
                      orderId: txResult.orderId,
                      orderLinkId: txResult.orderLinkId,
                      status: txResult.status,
                      submittedQty: txResult.submittedQty,
                      filledQty: txResult.filledQty,
                      error: txResult.error,
                    });
                  } else if (txResult && txResult.outcome !== "already_completed") {
                    logger.logError(`SR partial-exit action reduce FAILED: ${txResult.error ?? txResult.status ?? txResult.outcome}`);
                    writeSrPartialExitAction(config.symbol, {
                      ts: new Date().toISOString(),
                      timestamp: Date.now(),
                      source: "hedgeguy-bot",
                      symbol: config.symbol,
                      event: "failed",
                      action: "partial_exit",
                      live: isExchangeMode(config.mode),
                      candidate: required,
                      reason,
                      orderId: txResult.orderId,
                      orderLinkId: txResult.orderLinkId,
                      status: txResult.status,
                      error: txResult.error ?? txResult.outcome,
                    });
                  }
                await sleep(config.pollIntervalSec * 1000);
                continue;
              }
            }
          } catch (err: any) {
            logger.warn(`S/R partial-exit action check failed (non-fatal): ${err.message}`);
          }
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
          const closeResult = await executeFullLongClose(clsId, now);
          if (closeResult.success) {
            const exitPrice = resolveFullCloseExitPrice(closeResult, price);
            if (exitPrice <= 0) {
              logger.logError("DD kill close FAILED: full close succeeded but no usable exit price; state NOT cleared");
              state.setRecoveryMode(true);
              orderInFlight = false;
              break;
            }
            const stateResult = state.closeAllPositions(exitPrice, now, config.feeRate);
            state.clearPendingOrder();
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
        // Bot state snapshot (research join file). Same ~10min cadence as logEquity.
        try {
          const snapPath = path.resolve(SIGNAL_DIR, "data", `${config.symbol}_bot_state.jsonl`);
          const snapDir = path.dirname(snapPath);
          if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
          const totalQty = s.positions.reduce((sum, p) => sum + p.qty, 0);
          const avgEntry = totalQty > 0 ? s.positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / totalQty : 0;
          const totalNotional = s.positions.reduce((sum, p) => sum + p.notional, 0);
          const oldestEntryTime = s.positions.length > 0 ? Math.min(...s.positions.map(p => p.entryTime)) : 0;
          const oldestAgeHours = oldestEntryTime > 0 ? (Date.now() - oldestEntryTime) / 3600000 : 0;
          const tpPct = activeTpPct ?? config.tpPct;
          const tpPrice = avgEntry > 0 ? avgEntry * (1 + tpPct / 100) : 0;
          const ts = new Date().toISOString();
          fs.appendFileSync(snapPath, JSON.stringify({
            ts,
            timestamp: Date.parse(ts),
            source: "hedgeguy-bot",
            symbol: config.symbol,
            ladderId: oldestEntryTime > 0 ? `ladder_${oldestEntryTime}` : null,
            depth: s.positions.length,
            maxPositions: config.maxPositions,
            avgEntry,
            totalNotional,
            currentPrice: price,
            ladderPnlPct: avgEntry > 0 ? ((price - avgEntry) / avgEntry) * 100 : 0,
            tpPct,
            tpPrice,
            oldestAgeHours,
            equity: +eq.equity.toFixed(2),
            capital: +capital.toFixed(2),
            realizedPnl: +s.realizedPnl.toFixed(2),
            peakEquity: +s.peakEquity.toFixed(2),
            drawdownPct: +dd.toFixed(2),
            forcedExitCooldownUntil: s.forcedExitCooldownUntil,
            forcedExitCooldownActive: now < s.forcedExitCooldownUntil,
            riskOffUntil: s.riskOffUntil,
            riskOffActive: now < s.riskOffUntil,
            regime: s.regime,
            recoveryMode: s.recoveryMode,
            hedge: s.hedgePosition ? {
              entryPrice: s.hedgePosition.entryPrice,
              qty: s.hedgePosition.qty,
              notional: s.hedgePosition.notional,
              entryTime: s.hedgePosition.entryTime,
              ageHours: (Date.now() - s.hedgePosition.entryTime) / 3600000,
            } : null,
            positions: s.positions.map(p => ({
              entryPrice: p.entryPrice,
              entryTime: p.entryTime,
              qty: p.qty,
              notional: p.notional,
              level: p.level,
            })),
          }) + "\n");
        } catch (snapErr: any) {
          logger.warn(`Bot state snapshot write failed (non-fatal): ${snapErr.message}`);
        }
      }

      // Broad market-euphoria shadow. Uses only closed local HYPE/BTC 5m
      // history to identify HYPE saturation versus BTC/ATH/VWAP. It logs
      // hypothetical fresh-entry blocks / late-add caps but never acts.
      if (config.euphoriaShadow?.enabled && now - euphoriaShadowLastCheck >= config.euphoriaShadow.checkIntervalMin * 60000) {
        euphoriaShadowLastCheck = now;
        try {
          const euphoria = evaluateEuphoriaShadow({
            symbol: config.symbol,
            nowMs: now,
            positions: s.positions,
            config,
          });
          if (euphoria?.fired) {
            writeEuphoriaShadowSignal(config.symbol, euphoria);
            const m = euphoria.metrics;
            const summary = `score=${m.score}/${m.maxScore} HYPE/BTC7d=${m.hypeBtcRel7dPct?.toFixed(1) ?? "NA"}% HYPE/BTC30d=${m.hypeBtcRel30dPct?.toFixed(1) ?? "NA"}% ATHdist=${m.distanceToAthPct?.toFixed(1) ?? "NA"}% vwap7d=${m.priceVsVwap7dPct?.toFixed(1) ?? "NA"}%`;
            if (euphoria.event === "activated") {
              logger.warn(`EUPHORIA SHADOW: activated | ${summary} | blockFlat=${euphoria.action.wouldBlockFreshEntry} capLateAdds=${euphoria.action.wouldCapLateAdds} maxDepth=${euphoria.action.suggestedMaxDepth ?? "NA"} (shadow only)`);
            } else if (euphoria.event === "still_active") {
              logger.warn(`EUPHORIA SHADOW: still active | ${summary} pullbackFromHigh=${m.pullbackFromEuphoriaHighPct?.toFixed(1) ?? "NA"}% (shadow only)`);
            } else if (euphoria.event === "pullback_reached") {
              logger.warn(`EUPHORIA SHADOW: first pullback reached | pullbackFromHigh=${m.pullbackFromEuphoriaHighPct?.toFixed(1) ?? "NA"}% ${summary} (shadow only)`);
            } else if (euphoria.event === "cooled") {
              logger.warn(`EUPHORIA SHADOW: cooled | ${summary} (shadow only)`);
            }
          }
        } catch (err: any) {
          logger.warn(`Euphoria shadow check failed (non-fatal): ${err.message}`);
        }
      }

      // Fable-5 euphoria-stop candidate. Shadow-only: deep ladder, price still
      // above 4H EMA200, below 24h VWAP, then failed 45m reclaim with a lower
      // low. This fills the hard-flatten blind spot without changing live exits.
      if (config.euphoriaStopShadow?.enabled && s.positions.length > 0) {
        try {
          const trendForEuphoria = trendRefreshForExit ?? checkTrendGate(await getHype4h(), config);
          const euphoriaStop = await evaluateEuphoriaStopShadow({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            config,
            trend: trendForEuphoria,
          });
          if (euphoriaStop?.fired) {
            writeEuphoriaStopShadowSignal(config.symbol, euphoriaStop);
            const pnlText = typeof euphoriaStop.ladder.pnlPct === "number" ? euphoriaStop.ladder.pnlPct.toFixed(2) : "NA";
            const estText = typeof euphoriaStop.ladder.estimatedFullExitPnl === "number" ? euphoriaStop.ladder.estimatedFullExitPnl.toFixed(2) : "NA";
            const vwapText = typeof euphoriaStop.features.vwap24h === "number" ? `$${euphoriaStop.features.vwap24h.toFixed(4)}` : "NA";
            if (euphoriaStop.event === "watch_started") {
              logger.warn(`EUPHORIA STOP SHADOW: watch started | depth=${euphoriaStop.ladder.depth} pnl=${pnlText}% candle=$${euphoriaStop.candle.close?.toFixed(4) ?? "NA"} vwap24h=${vwapText} EMA200dist=${euphoriaStop.features.trendEma200DistPct?.toFixed(2) ?? "NA"}% reclaim=$${euphoriaStop.features.reclaimPrice?.toFixed(4) ?? "NA"} (shadow only)`);
            } else if (euphoriaStop.event === "reclaim_cleared") {
              logger.warn(`EUPHORIA STOP SHADOW: reclaim cleared | candle=$${euphoriaStop.candle.close?.toFixed(4) ?? "NA"} reclaim=$${euphoriaStop.features.reclaimPrice?.toFixed(4) ?? "NA"} (shadow only)`);
            } else if (euphoriaStop.event === "would_exit") {
              logger.warn(`EUPHORIA STOP SHADOW: WOULD EXIT | depth=${euphoriaStop.ladder.depth} pnl=${pnlText}% estPnl=$${estText} candle=$${euphoriaStop.candle.close?.toFixed(4) ?? "NA"} lowerLow=${euphoriaStop.features.madeLowerLow} (shadow only, no close)`);
              await alerter.notifyShadowSignal({
                family: "euphoria stop",
                event: "WOULD EXIT",
                candidates: euphoriaStop.firedCandidates,
                depth: euphoriaStop.ladder.depth,
                price: euphoriaStop.candle.close,
                pnlPct: euphoriaStop.ladder.pnlPct,
                summary: `estPnl=$${estText}; lowerLow=${euphoriaStop.features.madeLowerLow}; reclaim=$${euphoriaStop.features.reclaimPrice?.toFixed(4) ?? "NA"}`,
                cooldownMin: 240,
                severity: "bad",
              });
            } else if (euphoriaStop.event === "expired_no_lower_low") {
              logger.warn(`EUPHORIA STOP SHADOW: watch expired no lower low | depth=${euphoriaStop.ladder.depth} pnl=${pnlText}% (shadow only)`);
            } else {
              logger.warn(`EUPHORIA STOP SHADOW: reset | ${euphoriaStop.firedCandidates.join(",")} (shadow only)`);
            }
          }
        } catch (err: any) {
          logger.warn(`Euphoria stop shadow check failed (non-fatal): ${err.message}`);
        }
      }

      // Deep pullback exit/reclaim shadow. This is the candle-only
      // VWAP/lower-low candidate from the 5.41 replay plus HL score tags.
      // Evaluate/log first; live actions are handled only after the stateful
      // reclaim-watch machine has had a chance to record its verdict.
      let pullbackShadowForAction: PullbackExitShadowDecision | null = null;
      if (config.pullbackExitShadow?.enabled) {
        try {
          const pullbackShadow = await evaluatePullbackExitShadow({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            config,
          });
          pullbackShadowForAction = pullbackShadow;
          if (pullbackShadow?.fired) {
            writePullbackExitShadowSignal(config.symbol, pullbackShadow);
            if (pullbackShadow.event === "trigger") {
              const pnlText = typeof pullbackShadow.ladder.pnlPctAtClosedCandle === "number"
                ? pullbackShadow.ladder.pnlPctAtClosedCandle.toFixed(2)
                : "NA";
              const hlText = pullbackShadow.hl.score === null ? "NA" : `${pullbackShadow.hl.score}/4`;
              logger.warn(`PULLBACK EXIT SHADOW: ${pullbackShadow.firedCandidates.join(",")} | depth=${pullbackShadow.ladder.depth} candle=$${pullbackShadow.candle.close.toFixed(4)} ladderPnl=${pnlText}% ret12h=${pullbackShadow.features.ret12hPct?.toFixed(2) ?? "NA"}% HL=${hlText} (shadow only, no close)`);
            } else {
              logger.warn(`PULLBACK REENTRY SHADOW: ${pullbackShadow.firedCandidates.join(",")} | candle=$${pullbackShadow.candle.close.toFixed(4)} reclaim=$${pullbackShadow.shadow.reclaimPrice?.toFixed(4) ?? "NA"} (shadow only, no open)`);
            }
          }
        } catch (err: any) {
          logger.warn(`Pullback exit shadow check failed (non-fatal): ${err.message}`);
        }
      }

      // Stateful action layer on top of the pullback trigger:
      // score/HL stress only arms, VWAP/lower-low starts a reclaim watch,
      // then failed/successful reclaim is logged. Optional live action happens
      // only on failed reclaim, never on the first flush candle.
      if (config.pullbackActionShadow?.enabled) {
        try {
          const actionShadow = await evaluatePullbackActionShadow({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            config,
            scoreLatch: state.get().scorePartialFlatten,
            pullback: pullbackShadowForAction,
          });
          if (actionShadow?.fired) {
            writePullbackActionShadowSignal(config.symbol, actionShadow);
            const pnlText = typeof actionShadow.ladder.pnlPct === "number" ? actionShadow.ladder.pnlPct.toFixed(2) : "NA";
            if (actionShadow.event === "armed") {
              logger.warn(`PULLBACK ACTION SHADOW: armed | ${actionShadow.firedCandidates.join(",")} depth=${actionShadow.ladder.depth} pnl=${pnlText}% (shadow only)`);
            } else if (actionShadow.event === "watch_started") {
              logger.warn(`PULLBACK ACTION SHADOW: watch started | depth=${actionShadow.ladder.depth} pnl=${pnlText}% reclaim=$${actionShadow.action.reclaimPrice?.toFixed(4) ?? "NA"} until=${actionShadow.action.watchUntilIso ?? "NA"} (shadow only)`);
            } else if (actionShadow.event === "would_act") {
              const liveAction = config.pullbackAction;
              const actionSuffix = liveAction?.enabled ? `(live ${liveAction.action} enabled)` : "(shadow only)";
              logger.warn(`PULLBACK ACTION SHADOW: would trim/exit ${(actionShadow.action.closePct * 100).toFixed(0)}% | depth=${actionShadow.ladder.depth} pnl=${pnlText}% estPnl=$${actionShadow.action.estimatedRealizedPnl?.toFixed(2) ?? "NA"} ${actionSuffix}`);
              if (liveAction?.enabled && s.positions.length > 0) {
                const actionClosePct = Math.max(0, Math.min(0.95, liveAction.closePct || actionShadow.action.closePct || 0.5));
                const reason = `PULLBACK ACTION: failed reclaim ${liveAction.action}; watchUntil=${actionShadow.action.watchUntilIso ?? "NA"}, candle=$${actionShadow.candle.close?.toFixed(4) ?? "NA"}, live=$${price.toFixed(4)}, depth=${actionShadow.ladder.depth}, ladderPnl=${pnlText}%`;

                if (liveAction.action === "full_exit") {
                  const flattened = await flattenLadder(reason, price);
                  if (flattened) {
                    const until = now + liveAction.cooldownMin * 60000;
                    state.setForcedExitCooldown(until);
                    logger.warn(`Pullback action full-exit cooldown until ${new Date(until).toISOString().slice(0, 16)}`);
                    activeTpPct = config.tpPct;
                    state.save();
                    await sleep(config.pollIntervalSec * 1000);
                    continue;
                  }
                } else {
                  const totalQty = s.positions.reduce((sum, p) => sum + p.qty, 0);
                  const closeQty = totalQty * actionClosePct;
                  if (closeQty > 0) {
                    logger.warn(`PULLBACK ACTION TRIM: ${reason}; reducing ${(actionClosePct * 100).toFixed(0)}% (${closeQty.toFixed(4)} qty)`);
                      const pbPositions = state.get().positions;
                      const actionKey = `pullback:${actionShadow.action.watchUntilIso ?? "NA"}:${pbPositions.map(p => p.id).join("|")}`;
                    const txResult = await executeGuardedPartialClose("pullback-trim", {
                        symbol: config.symbol,
                        exchangeMode: isExchangeMode(config.mode),
                        now,
                        quotePrice: price,
                        feeRate: config.feeRate,
                        strategy: "pullback_trim",
                        orderAction: "pbtrim",
                      actionKey,
                        requestedQty: closeQty,
                        allocation: buildProRataAllocation(pbPositions),
                      desiredPostCommit: { pullbackActionKey: actionKey },
                      });

                    if (txResult && txResult.outcome === "committed" && txResult.filledQty > 0 && txResult.fillPrice !== null) {
                        const actualShare = Math.max(0, Math.min(1, txResult.filledQty / totalQty));
                        capital = await refreshCapital();
                        const modeSuffix = isExchangeMode(config.mode) ? "" : " [dry-run]";
                        logger.info(`PULLBACK ACTION TRIM${modeSuffix}: reduced ${(actualShare * 100).toFixed(1)}% across ${txResult.positionsReduced} rungs PnL $${txResult.totalPnl.toFixed(2)} fees $${txResult.totalFees.toFixed(2)} @ $${txResult.fillPrice.toFixed(4)}`);
                        await alerter.notifyPullbackAction({
                          action: "trim",
                          closePct: actualShare,
                          depth: actionShadow.ladder.depth,
                          price: txResult.fillPrice,
                          pnlPct: actionShadow.ladder.pnlPct,
                          realizedPnl: txResult.totalPnl,
                          reason,
                        });
                        await updateExchangeTp();
                    } else if (txResult?.outcome === "pending") {
                        logger.warn(`Pullback action trim pending: ${txResult.status} ${txResult.filledQty.toFixed(4)}/${txResult.submittedQty.toFixed(4)} qty; state retained pending order ${txResult.orderLinkId}`);
                    } else if (txResult) {
                        logger.logError(`Pullback action trim FAILED: ${txResult.error ?? txResult.status ?? txResult.outcome}`);
                      }
                    await sleep(config.pollIntervalSec * 1000);
                    continue;
                  }
                }
              }
            } else if (actionShadow.event === "reclaim_cleared") {
              logger.warn(`PULLBACK ACTION SHADOW: reclaim cleared | candle=$${actionShadow.candle.close?.toFixed(4) ?? "NA"} (shadow only)`);
            } else if (actionShadow.event === "would_reenter") {
              logger.warn(`PULLBACK ACTION SHADOW: would re-enter | candle=$${actionShadow.candle.close?.toFixed(4) ?? "NA"} (shadow only)`);
            } else {
              logger.warn(`PULLBACK ACTION SHADOW: reset | ${actionShadow.firedCandidates.join(",")} (shadow only)`);
            }
          }
        } catch (err: any) {
          logger.warn(`Pullback action shadow check failed (non-fatal): ${err.message}`);
        }
      }

      // Legacy instant full-exit path. This is intentionally bypassed whenever
      // the failed-reclaim action layer is enabled so an accidental config merge
      // cannot restore first-flush exits ahead of the state machine.
      const instantPullbackAction = config.pullbackExitAction;
      if (
        instantPullbackAction?.enabled &&
        !config.pullbackAction?.enabled &&
        s.positions.length > 0 &&
        pullbackShadowForAction?.event === "trigger" &&
        pullbackShadowForAction.firedCandidates.includes(instantPullbackAction.requiredCandidate)
      ) {
        const pnlText = typeof pullbackShadowForAction.ladder.pnlPctAtClosedCandle === "number"
          ? pullbackShadowForAction.ladder.pnlPctAtClosedCandle.toFixed(2)
          : "NA";
        const reason = `PULLBACK EXIT ACTION: ${instantPullbackAction.requiredCandidate}, candle $${pullbackShadowForAction.candle.close.toFixed(4)}, live $${price.toFixed(4)}, depth=${pullbackShadowForAction.ladder.depth}, ladderPnl=${pnlText}%, ret12h=${pullbackShadowForAction.features.ret12hPct?.toFixed(2) ?? "NA"}%`;
        const flattened = await flattenLadder(reason, price);
        if (flattened) {
          const until = now + instantPullbackAction.cooldownMin * 60000;
          state.setForcedExitCooldown(until);
          logger.warn(`Pullback exit action cooldown until ${new Date(until).toISOString().slice(0, 16)}`);
          activeTpPct = config.tpPct;
          state.save();
          await sleep(config.pollIntervalSec * 1000);
          continue;
        }
      }

      // 30m memory-zone S/R shadow. This records what S/R-aware add/exit
      // candidates would have done, but never blocks or closes anything.
      if (config.srShadow?.enabled && s.positions.length > 0) {
        try {
          const pulse = await computeOnChainFeatures(config.symbol, now);
          const srShadow = evaluateSRShadowCandidates({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            pulse,
            config,
            zoneEngine: srMemoryEngine,
            addContext: {
              canAddTiming,
              timeGateOk,
              priceDropOk,
              atOldCap,
              tpPct: activeTpPct ?? config.tpPct,
            },
          });
          if (srShadow?.fired) {
            const cooldownMs = (config.srShadow.cooldownMin ?? 15) * 60000;
            const writable = srShadow.firedCandidates.filter(name => now - (srShadowLastFire.get(name) ?? 0) >= cooldownMs);
            if (writable.length > 0) {
              for (const name of writable) srShadowLastFire.set(name, now);
              writeSRShadowSignal(config.symbol, { ...srShadow, firedCandidates: writable });
              const r = srShadow.levels.nearestResistance;
              const sZone = srShadow.levels.nearestSupport;
              logger.warn(`S/R SHADOW: ${writable.join(",")} | depth=${srShadow.ladder.depth} next=${srShadow.ladder.nextDepth} R=${r ? `$${r.price.toFixed(4)} ${r.distPct.toFixed(2)}%` : "NA"} S=${sZone ? `$${sZone.price.toFixed(4)} ${sZone.distPct.toFixed(2)}%` : "NA"}`);
            }
          }
        } catch (err: any) {
          logger.warn(`S/R shadow check failed (non-fatal): ${err.message}`);
        }
      }

      // ── CRSI 4H hedge trigger — fires once per episode, closes with ladder only ──
      // Main-bot hedge shadow. Owns future HYPE hedge research after retiring
      // standalone wed/D1 shorts; shadow-only, no short orders.
      if (config.hedgeShadow?.enabled && s.positions.length > 0) {
        try {
          const pulse = await computeOnChainFeatures(config.symbol, now);
          const hedgeShadow = evaluateHedgeShadowCandidates({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            candles5m: ctxMgr.getCandles(),
            candles1h: await getHype1h(),
            candles4h: await getHype4h(),
            pulse,
            config,
          });
          if (hedgeShadow?.fired) {
            const cooldownMs = (config.hedgeShadow.cooldownMin ?? 15) * 60000;
            const writable = hedgeShadow.firedCandidates.filter(name => now - (hedgeShadowLastFire.get(name) ?? 0) >= cooldownMs);
            if (writable.length > 0) {
              for (const name of writable) hedgeShadowLastFire.set(name, now);
              writeHedgeShadowSignal(config.symbol, { ...hedgeShadow, firedCandidates: writable });
              const ladderPnlText = typeof hedgeShadow.ladder.pnlPct === "number" ? hedgeShadow.ladder.pnlPct.toFixed(2) : "NA";
              const avgEntryText = typeof hedgeShadow.ladder.avgEntry === "number" ? `$${hedgeShadow.ladder.avgEntry.toFixed(4)}` : "NA";
              logger.warn(`HEDGE SHADOW: ${writable.join(",")} | depth=${hedgeShadow.ladder.depth} price=$${hedgeShadow.price.toFixed(4)} avg=${avgEntryText} ladderPnl=${ladderPnlText}% (shadow only, no short PnL)`);
            }
          }
        } catch (err: any) {
          logger.warn(`Hedge shadow check failed (non-fatal): ${err.message}`);
        }
      }

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
                logDecision(config.symbol, "hedge_open", {
                  reason: hedgeCheck.reason,
                  notional: hedgeCheck.notional,
                  crsi4H: hedgeCheck.crsi4H,
                  threshold: config.hedge.crsiThreshold,
                  ladderRungs: s.positions.length,
                  ladderNotional: s.positions.reduce((a, p) => a + p.notional, 0),
                  price,
                }, now);
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

      // Deep add stress guard: when pulse data is hostile, avoid time-only
      // expansion at high ladder depth unless price has actually moved lower.
      if (config.deepAddStressGuard?.enabled && s.positions.length >= config.deepAddStressGuard.minDepth) {
        try {
          const pulse = await computeOnChainFeatures(config.symbol, now);
          const deepStress = checkDeepAddStressGuard(s.positions, priceDropOk, pulse, config);
          const deepStressShadow = evaluateDeepAddStressShadow({
            symbol: config.symbol,
            nowMs: now,
            price,
            positions: s.positions,
            priceDropOk,
            pulse,
            liveGuard: deepStress,
            config,
          });
          if (deepStressShadow && now - deepAddStressShadowLastLog >= 60_000) {
            deepAddStressShadowLastLog = now;
            writeDeepAddStressShadowSignal(config.symbol, deepStressShadow);
          }
          const blockQty = s.positions.reduce((sum, pos) => sum + pos.qty, 0);
          const blockAvgEntry = blockQty > 0
            ? s.positions.reduce((sum, pos) => sum + pos.entryPrice * pos.qty, 0) / blockQty
            : price;
          const hlPulseScoreRaw = deepStressShadow?.candidates
            .find(candidate => candidate.name === "socket_hl_pulse_2of4_shadow")
            ?.components.hlPulseScore;
          const hlPulseScore = typeof hlPulseScoreRaw === "number" && Number.isFinite(hlPulseScoreRaw)
            ? hlPulseScoreRaw
            : null;
          await alerter.notifyDeepAddBlockState({
            active: deepStress.blocked,
            reason: deepStress.reason,
            depth: s.positions.length,
            maxDepth: config.maxPositions,
            price,
            avgEntry: blockAvgEntry,
            pnlPct: ((price - blockAvgEntry) / blockAvgEntry) * 100,
            nextNotional: calcAddSize(s.positions.length, config.basePositionUsdt, config.addScaleFactor),
            priceDropOk,
            firedReopenCandidates: deepStressShadow?.firedReopenCandidates ?? [],
            hlPulseScore,
          });
          logger.logFilterShadow("deep_add_stress_guard", deepStress.blocked, {
            stress: deepStress.stress,
            reason: deepStress.reason,
            reasons: deepStress.reasons,
            priceDropOk,
            depth: s.positions.length,
            oiBn4hPct: pulse.oiBn4hPct,
            oiHl4hPct: pulse.oiHl4hPct,
            fdByNow: pulse.fdByNow,
            fdBnNow: pulse.fdBnNow,
            fdHlNow: pulse.fdHlNow,
          });
          if (deepStress.blocked) {
            state.recordBlockedAdd();
            logger.logFilterBlock(deepStress.reason);
            await sleep(config.pollIntervalSec * 1000);
            continue;
          }
          if (deepStress.stress && cycleCount % 6 === 0) {
            logger.info(`DEEP-ADD STRESS: ${deepStress.reason}`);
          }
        } catch (err: any) {
          logger.warn(`Deep-add stress guard unavailable: ${err.message}`);
        }
      }

      // ── Check regime filters ──
      let blocked = false;
      let blockReason = "";
      let trendBlocked = false;
      let riskOffBlocked = false;
      let ladderKillBlocked = false;
      let overextendedBlocked = false;
      let regimeBlocked = false;
      let srBlocked = false;

      // Trend-break gate (primary)
      const hype4h = await getHype4h();
      const trend = checkTrendGate(hype4h, config);
      state.updateTrendCheck(now, trend.blocked, trend.reason);
      if (trend.blocked) {
        trendBlocked = true;
        blocked = true;
        blockReason = trend.reason;
      }

      // Market risk-off
      const btc1h = await getBtc1h();
      const riskOff = checkMarketRiskOff(btc1h, config, now, s.riskOffUntil);
      if (riskOff.riskOffUntil > 0) state.updateRiskOff(riskOff.riskOffUntil);
      if (riskOff.blocked) {
        riskOffBlocked = true;
        blocked = true;
        blockReason = blockReason ? `${blockReason} + ${riskOff.reason}` : riskOff.reason;
      }

      // Ladder-local kill
      const ladderKill = checkLadderKill(s.positions, price, now, config);
      if (ladderKill.blocked) {
        ladderKillBlocked = true;
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
        overextendedBlocked = true;
        blocked = true;
        blockReason = blockReason ? `${blockReason} + ${overext.reason}` : overext.reason;
      }

      // Regime circuit breaker — N consecutive red days → flat until M green days
      try {
        // bot-regime-arm signal: manual override to clear flat state
        // Sets lastDayProcessed to yesterday's UTC day index so prior reds aren't re-walked.
        if (fs.existsSync(SIGNAL_REGIME_ARM)) {
          const todayIdx = Math.floor(Date.now() / 86_400_000);
          state.updateRegime({ redStreak: 0, greenStreak: 0, flatActive: false, lastDayProcessed: todayIdx - 1 });
          fs.unlinkSync(SIGNAL_REGIME_ARM);
          logger.warn("SIGNAL: bot-regime-arm received — regime breaker manually re-armed");
        }
        const hype1d = await getHype1d();
        const regime = checkRegimeBreaker(hype1d, s.regime, config, now);
        state.updateRegime(regime.state);
        if (regime.blocked) {
          regimeBlocked = true;
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
          srBlocked = true;
          blocked = true;
          blockReason = blockReason ? `${blockReason} + ${reason}` : reason;
        }
      } catch { /* non-fatal */ }

      if (blocked) {
        if (config.gateShadow?.enabled) {
          try {
            const gateCtx = {
              blockReason,
              trendBlocked,
              trendLastClose: trend.lastClose,
              trendEma200: trend.ema200,
              trendEma200DistPct: trend.ema200 > 0 ? ((trend.lastClose - trend.ema200) / trend.ema200) * 100 : null,
              trendEma50SlopePct: trend.ema50Prev > 0 ? ((trend.ema50 - trend.ema50Prev) / trend.ema50Prev) * 100 : null,
              overextendedBlocked,
              overextendedSlope12hPct: overext.slope12hPct,
              overextendedCrsi4H: overext.crsi4H,
              overextendedRsi1H: overext.rsi1H,
              riskOffBlocked,
              regimeBlocked,
              srBlocked,
              ladderKillBlocked,
              priceDropOk,
              timeGateOk,
            };
            const gateShadow = await evaluateGateShadowCandidates(config.symbol, now, price, s.positions, ctxMgr.getCandles(), config, gateCtx);
            writeGateShadowSignal(config.symbol, now, price, gateCtx, gateShadow);
            if (gateShadow.fired) {
              const firedCandidates = gateShadow.candidates.filter(c => c.fired).map(c => c.name);
              const key = firedCandidates.join("|") || "none";
              const lastLogged = gateShadowLastLog.get(key) ?? 0;
              if (now - lastLogged >= GATE_SHADOW_LOG_INTERVAL_MS) {
                gateShadowLastLog.set(key, now);
                logger.logFilterShadow("gate_override_candidate", true, {
                  firedCandidates,
                  blockReason,
                  trendBlocked,
                  overextendedBlocked,
                  riskOffBlocked,
                  regimeBlocked,
                  srBlocked,
                  ladderKillBlocked,
                  ema200_4h_distPct: gateShadow.features.ema200_4h_distPct,
                  rsi1h: gateShadow.features.rsi1h,
                  crsi4h: gateShadow.features.crsi4h,
                  btc4hPct: gateShadow.features.btc4hPct,
                  taker4h: gateShadow.features.taker4h,
                  oiBreadth4h: gateShadow.features.oiBreadth4h,
                  reason: "blocked entry matches gate-shadow candidate",
                });
              }
            }
          } catch (err: any) {
            logger.warn(`Gate shadow evaluation failed (non-fatal): ${err.message}`);
          }
        }
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
      const opened = await runLongSideMutation(`open-level-${level}`, async () => {
        if (isExchangeMode(config.mode)) {
          // Same orderLinkId in state and on exchange
          const existingPending = state.getPendingOrder();
          if (existingPending) {
            logger.logError(`Cannot open level ${level}: pending order ${existingPending.orderLinkId} (${existingPending.action}) is unresolved. Entering recovery mode.`);
            state.setRecoveryMode(true);
            return false;
          }
          const openId = genOrderLinkId("open");
          state.setPendingOrder({
            orderLinkId: openId,
            action: "open",
            symbol: config.symbol,
            notional,
            createdAt: now,
          });

          logDecision(config.symbol, "ladder_add", {
            rungLevel: level,
            notional,
            quotePrice: price,
            existingRungs: s.positions.length,
            inCooldown: state.isForcedExitCooldown(now),
            recovery: state.isRecoveryMode(),
          }, now);
          const orderResult = await executor.openLong(config.symbol, notional, config.leverage, openId);

          if (!orderResult.success) {
            logger.logError(`Failed to open position: ${orderResult.error}`);
            if (orderResult.orderId) {
              logger.logError(`Open order ${openId} was accepted but not locally committed. Pending retained and recovery mode enabled.`);
              state.setRecoveryMode(true);
            } else {
              state.clearPendingOrder();
            }
            // Back off on exchange rejection to avoid spamming — wait 5 min before retrying
            const isPositionLimit = orderResult.error?.includes("position") || orderResult.error?.includes("leverage");
            if (isPositionLimit) {
              logger.warn(`Position limit hit at level ${level} — backing off 5 min`);
              await sleep(5 * 60 * 1000);
            }
            return false;
          }
          state.addPosition({
            entryPrice: orderResult.price,  // quote price, not fill
            entryTime: now,
            qty: orderResult.qty,
            notional: orderResult.notional,
            level,
            orderId: orderResult.orderId,
          });
          state.clearPendingOrder();
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
        return true;
      });
      if (!opened) {
        await sleep(config.pollIntervalSec * 1000);
        continue;
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

    if (pendingOrder.kind === "partial_close") {
      const partialResult = await resolvePendingPartialClose(state, executor, config.symbol, config.feeRate, Date.now());
      if (partialResult.outcome === "committed") {
        logger.warn(`RECONCILIATION: Pending partial close committed ${partialResult.filledQty.toFixed(4)} qty, PnL $${partialResult.totalPnl.toFixed(2)} @ $${partialResult.fillPrice?.toFixed(4) ?? "NA"}.`);
      } else if (partialResult.outcome === "rejected") {
        logger.warn(`RECONCILIATION: Pending partial close rejected/zero-fill (${partialResult.status}).`);
      } else {
        logger.logError(`RECONCILIATION: Pending partial close unresolved (${partialResult.status ?? partialResult.error ?? partialResult.outcome}); entering recovery mode and retaining pending order.`);
        state.setRecoveryMode(true);
        return;
      }
    } else {

    // Query exchange for the actual status of this order
    const orderStatus = await executor.queryOrder(config.symbol, pendingOrder.orderLinkId);
    if (orderStatus.found) {
      logger.info(`RECONCILIATION: Pending order status on exchange: ${orderStatus.status}, filled ${orderStatus.filledQty} @ $${orderStatus.avgPrice.toFixed(4)}`);
      const terminalStatuses = ["Filled", "Cancelled", "Rejected", "PartiallyFilledCanceled", "Deactivated"];
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
      } else if (orderStatus.status === "Filled" && pendingOrder.action === "close" && !pendingOrder.partialClose && orderStatus.filledQty > 0 && orderStatus.avgPrice > 0) {
        const lotInfo = await getReconciliationLotInfo(executor, config.symbol, logger);
        const localQty = state.get().positions.reduce((sum, p) => sum + p.qty, 0);
        const remainingLong = await executor.getLongPositionSize(config.symbol);
        const tolerance = lotInfo ? Math.max(lotInfo.qtyStep / 2, 1e-8) : 0;
        if (!lotInfo || orderStatus.filledQty < localQty - tolerance || remainingLong > tolerance) {
          logger.logError(`RECONCILIATION: Pending full close fill is incomplete/ambiguous (${orderStatus.filledQty.toFixed(4)}/${localQty.toFixed(4)}, remaining ${remainingLong.toFixed(4)}). Entering recovery mode and retaining pending order.`);
          state.setRecoveryMode(true);
          return;
        }
        logger.warn("RECONCILIATION: Pending FULL close was FILLED on exchange and exchange is flat. Importing batch close into state.");
        const fullRes = state.closeAllPositions(orderStatus.avgPrice, pendingOrder.createdAt, config.feeRate);
        logger.info(`RECONCILIATION: Full close imported - ${fullRes.positionsClosed} rungs, PnL $${fullRes.totalPnl.toFixed(2)} @ $${orderStatus.avgPrice.toFixed(4)}.`);
      } else if (orderStatus.status === "Filled" && pendingOrder.action === "close" && pendingOrder.partialClose && orderStatus.filledQty > 0) {
        // Partial (reduce) close filled but the process died before state was updated.
        // The saved plan indices still refer to the persisted positions array.
        logger.warn("RECONCILIATION: Pending PARTIAL close was FILLED on exchange. Importing partial close into state.");
        const partialRes = state.closePositionsByIndices(
          pendingOrder.partialClose.indices,
          orderStatus.avgPrice,
          pendingOrder.createdAt,
          config.feeRate,
        );
        logger.info(`RECONCILIATION: Partial close imported — ${partialRes.positionsClosed} rungs, PnL $${partialRes.totalPnl.toFixed(2)} @ $${orderStatus.avgPrice.toFixed(4)}.`);
      }
      if (
        (pendingOrder.action === "close" || pendingOrder.action === "open") &&
        !terminalStatuses.includes(orderStatus.status)
      ) {
        logger.logError(`RECONCILIATION: Pending ${pendingOrder.action} remains unresolved (${orderStatus.status}); entering recovery mode and retaining pending order.`);
        state.setRecoveryMode(true);
        return;
      }
    } else {
      logger.info("RECONCILIATION: Pending order not found on exchange (may have been rejected or expired).");
      if (pendingOrder.action === "close" || pendingOrder.action === "open") {
        logger.logError(`RECONCILIATION: Pending ${pendingOrder.action} not found; treating as unresolved until exchange/local state is reviewed.`);
        state.setRecoveryMode(true);
        return;
      }
      if (pendingOrder.action === "hedge_close") {
        // Close not found — could mean it was rejected (short still open) or filled immediately
        logger.warn("RECONCILIATION: Pending hedge_close not found on exchange. Clearing local hedge state — short position will be checked below.");
        state.clearHedge();
      }
    }

    state.clearPendingOrder();
    }
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
    const lotInfo = await getReconciliationLotInfo(executor, config.symbol, logger);
    if (!lotInfo) {
      logger.logError("RECONCILIATION: Strict size check unavailable at startup; entering recovery mode until next review.");
      state.setRecoveryMode(true);
      return;
    }
    const sync = calcQtySync(exchangeSize, localSize, lotInfo);

    if (!sync.synced) {
      logQuantityMismatch(logger, "Long", exchangeSize, localSize, sync);
      state.setRecoveryMode(true);
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
      const shortSize = parseFloat(exchangeShortPos.size);
      const shortEntry = parseFloat(exchangeShortPos.avgPrice);
      if (!config.hedge.enabled) {
        // Hedge feature disabled — any short on positionIdx=2 belongs to wed/d1-short bot.
        // Do NOT import as a hedge or the bot will close it via the TP check.
        logger.info(`Reconciliation: external short on exchange ${shortSize} @ $${shortEntry.toFixed(4)} (likely wed/d1-short, hedge.enabled=false). Ignoring.`);
      } else {
        // Hedge feature enabled — orphan likely means lost-state scenario, import to track it.
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
      }
    } else if (localHasHedge && exchangeHasShort) {
      const localHedge = localState.hedgePosition!;
      const exchShortSize = parseFloat(exchangeShortPos.size);
      const hedgeSync = calcQtySync(exchShortSize, localHedge.qty, lotInfo);
      if (!hedgeSync.synced) {
        logQuantityMismatch(logger, "Hedge short", exchShortSize, localHedge.qty, hedgeSync);
        state.setRecoveryMode(true);
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
