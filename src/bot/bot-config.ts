import fs from "fs";
import path from "path";
import { SRConfig, DEFAULT_SR_CONFIG } from "./sr-levels";
import { DEFAULT_SR_MEMORY_ZONE_CONFIG } from "./sr-memory-zones";

// ─────────────────────────────────────────────
// Bot configuration — loaded from bot-config.json
// ─────────────────────────────────────────────

export interface BotConfig {
  // Mode
  mode: "dry-run" | "paper" | "live";  // dry-run = log only, paper = subaccount API, live = main account
  symbol: string;                  // e.g. "HYPEUSDT"

  // DCA ladder params (v1 paper config)
  basePositionUsdt: number;        // notional of first add ($800)
  addScaleFactor: number;          // Martingale multiplier per level (1.20)
  maxPositions: number;            // max concurrent ladder positions (11)
  tpPct: number;                   // batch TP % on weighted avg entry (1.4)
  leverage: number;                // position leverage (50)
  addIntervalMin: number;          // min minutes between adds (30)
  priceTriggerPct: number;         // also add when price drops this % from last entry (0 = time-only)
  feeRate: number;                 // taker fee per side (0.00055)

  // Equity
  initialCapital: number;          // starting equity for risk calcs ($5000)
  maxDrawdownPct: number;          // hard kill switch — 0 = disabled

  // Regime filters
  filters: {
    trendBreak: boolean;           // 4h EMA200 + EMA50 slope gate
    trendEmaLong: number;          // 200
    trendEmaShort: number;         // 50
    marketRiskOff: boolean;        // BTC 1h crash gate
    btcDropPct: number;            // -3
    riskOffCooldownMin: number;    // 120
    volExpansion: boolean;         // ATR shadow signal (logged, not enforced in v1)
    atrMultiplier: number;         // 2.5
    ladderLocalKill: boolean;      // emergency brake
    maxUnderwaterHours: number;    // 12
    maxUnderwaterPct: number;      // -3
    overextendedEntry?: {
      enabled: boolean;            // block first-rung entry when chasing a pump
      slope12hMin: number;         // % — block when 12h price change ≥ this (2.55)
      crsi4HMax: number;           // block when CRSI 4H ≤ this (56.9)
      rsi1HMin: number;            // block when RSI 1H ≥ this (59.4)
    };
    regimeBreaker?: {
      enabled: boolean;            // block all new entries during consecutive-red-day streaks
      redDaysToFlat: number;       // N red days → enter flat mode (4)
      greenDaysToArm: number;      // M green days while flat → re-arm (2)
    };
  };

  // Exit stack (Codex v1 recommendations)
  exits: {
    softStale: boolean;            // reduce TP when ladder goes stale
    staleHours: number;            // age threshold for soft stale (20)
    reducedTpPct: number;          // reduced TP % in stale mode (0.9)
    hardFlatten: boolean;          // force-close stale + hostile + underwater ladder
    hardFlattenHours: number;      // age threshold for hard flatten (40)
    hardFlattenPct: number;        // avg PnL % threshold for hard flatten (-6)
    emergencyKill: boolean;        // emergency close on deep drawdown
    emergencyKillPct: number;      // avg ladder PnL % trigger (-10)
    fundingSpikeGuard?: {
      enabled: boolean;            // close ladder on deep+crowded-longs combo
      minRungs: number;            // active rung count threshold (8)
      maxFundingRate: number;      // funding rate decimal threshold (0.00012 = 0.012%/8h)
    };
  };

  // Stress hedge (short on deep ladder stress)
  hedge: {
    enabled: boolean;
    // ── Path 1: Crash / acceleration ──
    minRungs: number;         // min ladder positions to trigger (9)
    pnlTrigger: number;       // avg ladder PnL % at or below trigger (-2.5)
    rsi1hMax: number;         // 1h RSI must be <= this (40)
    roc5Max: number;          // 1h ROC5 must be <= this (-3.5)
    // ── Path 2: Deep hold / slow grind ──
    deepHoldEnabled: boolean; // enable second trigger path
    deepHoldPnlTrigger: number;    // avg ladder PnL <= this (-4.0)
    deepHoldRsi1hMax: number;      // 1h RSI <= this (50)
    deepHoldMinAgeHours: number;   // first position open >= this many hours (6)
    // ── Regime gate ──
    blockHighVol: boolean;    // skip hedge when ATR > atrVolMultiplier × 100-bar median
    atrVolMultiplier: number; // ATR expansion threshold multiplier (1.5)
    // ── CRSI 4H trigger (replaces RSI/ROC stress hedge) ──
    crsiThreshold: number;    // fire when CRSI 4H < this (15)
    crsiNotionalPct: number;  // short notional as fraction of total long notional (0.75)
    // ── Shared params ──
    notionalPct: number;      // legacy — unused by CRSI hedge
    tpPct: number;            // legacy — unused by CRSI hedge (no standalone TP)
    killPct: number;          // legacy — unused by CRSI hedge (no standalone kill)
    leverage: number;         // leverage for short (50)
    cooldownMin: number;      // min minutes before re-firing after a close (60)
  };

  // S/R level engine — skip-on-add gate + partial flatten on resistance touch
  srLevels?: SRConfig;

  // Dynamic add-throttle: slow adds when deep + price falling
  addThrottle?: {
    enabled: boolean;              // enable throttle
    depth: number;                 // rung count to start throttling (5)
    mult: number;                  // multiply addIntervalMin by this (2 = 30→60min)
    slopeThreshold: number;        // throttle when 6h slope ≤ this % (-0.5)
  };

  deepAddStressGuard?: {
    enabled: boolean;
    minDepth: number;
    mode: "requirePriceDrop" | "block";
    anyFundingNegative: boolean;
    fundingRateMax: number;
    binanceOi4hPctMax: number | null;
    hyperliquidOi4hPctMax: number | null;
  };

  // Custom score action path. Defaults to disabled/shadow-only; when enabled
  // it evaluates the Codex 5.27 deep/avoid pulse score and can reduce a share
  // of the long ladder once per ladder.
  scorePartialFlatten?: {
    enabled: boolean;
    shadowOnly: boolean;
    emitSignals?: boolean;         // write legacy score-partial signal rows/logs
    minDepth: number;
    pnlPctMax: number;
    scoreThreshold: number;
    closePct: number;
    oneShotPerLadder: boolean;
  };

  // Hard-flatten deferral shadow. Logs only: when a hard flatten would fire
  // during slow chop, record whether a 30m deferral would have helped.
  hfDeferShadow?: {
    enabled: boolean;
    minDepth: number;
    ret12hMin: number;
    delayMin: number;
  };

  // Flat-state blocked-entry shadow research. Logs candidate gate overrides
  // without changing live add decisions.
  gateShadow?: {
    enabled: boolean;
  };

  // Main-bot ownership of HYPE hedge research. This is shadow-only: it logs
  // D1/top-fade and active-ladder pulse hedge candidates, but never opens a short.
  hedgeShadow?: {
    enabled: boolean;
    minDepth: number;
    cooldownMin: number;
  };

  // S/R memory-zone shadow. Logs 30m local support/resistance candidates
  // without changing adds, exits, or sizing.
  srShadow?: {
    enabled: boolean;
    tfMin: number;
    pivotLeft: number;
    pivotRight: number;
    clusterPct: number;
    minTouches: number;
    bufferPct: number;
    recentDays: number;
    keepRungs: number;
    partialBufferPct: number;
    wideBufferPct: number;
    tpResistanceBufferPct: number;
    highFundingRate: number;
    cooldownMin: number;
  };

  // Live action for the vetted 30m memory-zone S/R partial-exit:
  // close most-profitable rungs at resistance, keep the worst rungs alive.
  srPartialExitAction?: {
    enabled: boolean;
    requiredCandidate: string;
    minDepth: number;
    keepRungs: number;
    resistanceBufferPct: number;
    minLadderPnlPct: number;
    requirePlanProfit: boolean;
    cooldownMin: number;
  };

  // Deep pullback full-exit shadow. Logs the candle-only VWAP/lower-low
  // protection candidate and its hypothetical reclaim re-entry; never trades.
  pullbackExitShadow?: {
    enabled: boolean;
    minDepth: number;
    pnlPctMax: number;
    ret12hMax: number;
    lowerLowLookbackMin: number;
    lowerLowBufferPct: number;
    vwapLookbackMin: number;
    cooldownMin: number;
    reclaimPct: number;
    momentumRet1hMin: number;
    momentumRet2hMin: number;
    staleCandleMaxSec: number;
  };

  // Optional live action for the vetted pullback-exit shadow trigger.
  // Uses the shadow's no-lookahead closed-candle decision, then closes at
  // current market and applies a post-exit cooldown.
  pullbackExitAction?: {
    enabled: boolean;
    requiredCandidate: string;
    cooldownMin: number;
  };

  // Optional live action for the stateful pullback reclaim watcher.
  // pullbackExitShadow identifies the flush, pullbackActionShadow starts and
  // resolves the reclaim watch, and this block decides whether a failed reclaim
  // is allowed to trade. "trim" reduces the existing long by closePct; "full_exit"
  // closes the whole ladder and applies a cooldown.
  pullbackAction?: {
    enabled: boolean;
    action: "trim" | "full_exit";
    closePct: number;
    cooldownMin: number;
  };

  // Stateful pullback action shadow. Score/HL stress arms the shadow only;
  // VWAP/lower-low confirmation starts a reclaim watch; failed reclaim logs
  // hypothetical trim/exit actions and later re-entry context. Never trades.
  pullbackActionShadow?: {
    enabled: boolean;
    minDepth: number;
    pnlPctMax: number;
    armScorePartial: boolean;
    armHlScoreMin: number;
    armMaxAgeMin: number;
    confirmationHlScoreMin: number;
    watchMin: number;
    reclaimPct: number;
    actionClosePct: number;
    reentryCooldownMin: number;
    reentryReclaimPct: number;
    staleCandleMaxSec: number;
  };

  // HYPE market-euphoria shadow. Price-only saturation gate using local
  // HYPE/BTC history: relative outperformance, ATH proximity, VWAP extension,
  // and BTC non-confirmation. Logs only; never blocks adds.
  euphoriaShadow?: {
    enabled: boolean;
    minScore: number;
    clearScore: number;
    checkIntervalMin: number;
    cooldownMin: number;
    cacheTtlSec: number;
    staleDataMaxMin: number;
    rel7dPctMin: number;
    rel30dPctMin: number;
    priceVsVwap7dPctMin: number;
    nearAthPctMin: number;
    hype7dMinPctForBtcDivergence: number;
    btc7dMaxPct: number;
    pullbackFromHighClearPct: number;
    athLookbackDays: number;
    localHighLookbackDays: number;
    suggestedMaxDepth: number;
    lateAddBlockDepth: number;
    armPullbackDepth: number;
  };

  // Trend-independent euphoria pullback stop shadow. This is the Fable-5
  // candidate: deep ladder, still above 4H EMA200, below 24h VWAP, then a
  // failed-reclaim/lower-low watch. Logs only; never closes positions.
  euphoriaStopShadow?: {
    enabled: boolean;
    minDepth: number;
    pnlPctMax: number;
    vwapLookbackMin: number;
    watchMin: number;
    reclaimPct: number;
    cooldownMin: number;
    staleCandleMaxSec: number;
  };

  // Post-TP conditional cooldown
  tpCooldown?: {
    enabled: boolean;              // gate re-entry after TP when RSI hot
    rsi1hThreshold: number;        // cooldown fires if 1H RSI > this at TP (60)
    cooldownMin: number;           // minutes to wait before re-entering (15)
  };

  // Operational
  pollIntervalSec: number;         // how often to check market (default 10)
  stateFile: string;               // path for persistent state (default "bot-state.json")
  logDir: string;                  // directory for trade logs (default "logs")
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  mode: "dry-run",
  symbol: "HYPEUSDT",

  basePositionUsdt: 800,
  addScaleFactor: 1.20,
  maxPositions: 11,
  tpPct: 1.4,
  leverage: 50,
  addIntervalMin: 30,
  priceTriggerPct: 0,
  feeRate: 0.00055,

  initialCapital: 5000,
  maxDrawdownPct: 0,

  filters: {
    trendBreak: true,
    trendEmaLong: 200,
    trendEmaShort: 50,
    marketRiskOff: true,
    btcDropPct: -3,
    riskOffCooldownMin: 120,
    volExpansion: false,       // v1: logged shadow only, NOT enforced
    atrMultiplier: 2.5,
    ladderLocalKill: true,
    maxUnderwaterHours: 12,
    maxUnderwaterPct: -3,
    overextendedEntry: {
      enabled: true,
      slope12hMin: 2.55,
      crsi4HMax: 56.9,
      rsi1HMin: 59.4,
    },
    regimeBreaker: {
      enabled: true,
      redDaysToFlat: 4,
      greenDaysToArm: 2,
    },
  },

  exits: {
    softStale: true,
    staleHours: 20,
    reducedTpPct: 0.9,
    hardFlatten: true,
    hardFlattenHours: 40,
    hardFlattenPct: -6,
    emergencyKill: true,
    emergencyKillPct: -10,
    fundingSpikeGuard: {
      enabled: true,
      minRungs: 8,
      maxFundingRate: 0.00012,
    },
  },

  hedge: {
    enabled: true,
    // Path 1: crash / acceleration
    minRungs: 9,
    pnlTrigger: -2.5,
    rsi1hMax: 40,
    roc5Max: -3.5,
    // Path 2: deep hold / slow grind
    deepHoldEnabled: true,
    deepHoldPnlTrigger: -4.0,
    deepHoldRsi1hMax: 50,
    deepHoldMinAgeHours: 6,
    // Regime gate
    blockHighVol: true,
    atrVolMultiplier: 1.5,
    // CRSI 4H trigger
    crsiThreshold: 15,
    crsiNotionalPct: 0.75,
    // Shared / legacy
    notionalPct: 0.20,
    tpPct: 2.0,
    killPct: 3.0,
    leverage: 50,
    cooldownMin: 60,
  },

  srLevels: { ...DEFAULT_SR_CONFIG },

  addThrottle: {
    enabled: false,
    depth: 5,
    mult: 2,
    slopeThreshold: -0.5,
  },

  deepAddStressGuard: {
    enabled: false,
    minDepth: 5,
    mode: "requirePriceDrop",
    anyFundingNegative: true,
    fundingRateMax: 0,
    binanceOi4hPctMax: null,
    hyperliquidOi4hPctMax: null,
  },

  scorePartialFlatten: {
    enabled: false,
    shadowOnly: true,
    emitSignals: true,
    minDepth: 6,
    pnlPctMax: -2,
    scoreThreshold: 100,
    closePct: 0.75,
    oneShotPerLadder: true,
  },

  hfDeferShadow: {
    enabled: false,
    minDepth: 8,
    ret12hMin: -3,
    delayMin: 30,
  },

  gateShadow: {
    enabled: false,
  },

  hedgeShadow: {
    enabled: false,
    minDepth: 1,
    cooldownMin: 15,
  },

  srShadow: {
    ...DEFAULT_SR_MEMORY_ZONE_CONFIG,
    keepRungs: 3,
    partialBufferPct: 0.3,
    wideBufferPct: 3.0,
    tpResistanceBufferPct: 0.75,
    highFundingRate: 0.00006,
    cooldownMin: 15,
  },

  srPartialExitAction: {
    enabled: false,
    requiredCandidate: "zone30_partial_exit_resistance_deep6_profit_deteriorating_shadow",
    minDepth: 6,
    keepRungs: 3,
    resistanceBufferPct: 0.3,
    minLadderPnlPct: 0.25,
    requirePlanProfit: true,
    cooldownMin: 60,
  },

  pullbackExitShadow: {
    enabled: false,
    minDepth: 8,
    pnlPctMax: -2,
    ret12hMax: -6,
    lowerLowLookbackMin: 720,
    lowerLowBufferPct: 0.2,
    vwapLookbackMin: 1440,
    cooldownMin: 240,
    reclaimPct: 1.2,
    momentumRet1hMin: 0,
    momentumRet2hMin: 0.5,
    staleCandleMaxSec: 180,
  },

  pullbackExitAction: {
    enabled: false,
    requiredCandidate: "vwap_lowerlow_deep8_exit_shadow",
    cooldownMin: 240,
  },

  pullbackAction: {
    enabled: false,
    action: "trim",
    closePct: 0.5,
    cooldownMin: 240,
  },

  pullbackActionShadow: {
    enabled: false,
    minDepth: 8,
    pnlPctMax: -2,
    armScorePartial: true,
    armHlScoreMin: 3,
    armMaxAgeMin: 720,
    confirmationHlScoreMin: 2,
    watchMin: 45,
    reclaimPct: 1.2,
    actionClosePct: 0.5,
    reentryCooldownMin: 240,
    reentryReclaimPct: 1.2,
    staleCandleMaxSec: 180,
  },

  euphoriaShadow: {
    enabled: false,
    minScore: 4,
    clearScore: -1,
    checkIntervalMin: 5,
    cooldownMin: 60,
    cacheTtlSec: 900,
    staleDataMaxMin: 20,
    rel7dPctMin: 25,
    rel30dPctMin: 60,
    priceVsVwap7dPctMin: 18,
    nearAthPctMin: -5,
    hype7dMinPctForBtcDivergence: 20,
    btc7dMaxPct: 5,
    pullbackFromHighClearPct: 10,
    athLookbackDays: 365,
    localHighLookbackDays: 30,
    suggestedMaxDepth: 9,
    lateAddBlockDepth: 8,
    armPullbackDepth: 6,
  },

  euphoriaStopShadow: {
    enabled: false,
    minDepth: 8,
    pnlPctMax: -9,
    vwapLookbackMin: 1440,
    watchMin: 45,
    reclaimPct: 1.2,
    cooldownMin: 240,
    staleCandleMaxSec: 180,
  },

  tpCooldown: {
    enabled: true,
    rsi1hThreshold: 60,
    cooldownMin: 15,
  },

  pollIntervalSec: 10,
  stateFile: "bot-state.json",
  logDir: "logs",
};

export function loadBotConfig(configPath?: string): BotConfig {
  const file = configPath || path.resolve(process.cwd(), "bot-config.json");

  if (!fs.existsSync(file)) {
    console.log(`No config at ${file}, using defaults (dry-run mode)`);
    return { ...DEFAULT_BOT_CONFIG };
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));

  // Deep merge with defaults
  const config: BotConfig = {
    ...DEFAULT_BOT_CONFIG,
    ...raw,
    filters: {
      ...DEFAULT_BOT_CONFIG.filters,
      ...(raw.filters || {}),
    },
    exits: {
      ...DEFAULT_BOT_CONFIG.exits,
      ...(raw.exits || {}),
    },
    hedge: {
      ...DEFAULT_BOT_CONFIG.hedge,
      ...(raw.hedge || {}),
    },
    addThrottle: {
      ...DEFAULT_BOT_CONFIG.addThrottle,
      ...(raw.addThrottle || {}),
    },
    deepAddStressGuard: {
      ...DEFAULT_BOT_CONFIG.deepAddStressGuard,
      ...(raw.deepAddStressGuard || {}),
    },
    scorePartialFlatten: {
      ...DEFAULT_BOT_CONFIG.scorePartialFlatten,
      ...(raw.scorePartialFlatten || {}),
    },
    hfDeferShadow: {
      ...DEFAULT_BOT_CONFIG.hfDeferShadow,
      ...(raw.hfDeferShadow || {}),
    },
    gateShadow: {
      ...DEFAULT_BOT_CONFIG.gateShadow,
      ...(raw.gateShadow || {}),
    },
    hedgeShadow: {
      ...DEFAULT_BOT_CONFIG.hedgeShadow,
      ...(raw.hedgeShadow || {}),
    },
    srShadow: {
      ...DEFAULT_BOT_CONFIG.srShadow,
      ...(raw.srShadow || {}),
    },
    srPartialExitAction: {
      ...DEFAULT_BOT_CONFIG.srPartialExitAction,
      ...(raw.srPartialExitAction || {}),
    },
    pullbackExitShadow: {
      ...DEFAULT_BOT_CONFIG.pullbackExitShadow,
      ...(raw.pullbackExitShadow || {}),
    },
    pullbackExitAction: {
      ...DEFAULT_BOT_CONFIG.pullbackExitAction,
      ...(raw.pullbackExitAction || {}),
    },
    pullbackAction: {
      ...DEFAULT_BOT_CONFIG.pullbackAction,
      ...(raw.pullbackAction || {}),
    },
    pullbackActionShadow: {
      ...DEFAULT_BOT_CONFIG.pullbackActionShadow,
      ...(raw.pullbackActionShadow || {}),
    },
    euphoriaShadow: {
      ...DEFAULT_BOT_CONFIG.euphoriaShadow,
      ...(raw.euphoriaShadow || {}),
    },
    euphoriaStopShadow: {
      ...DEFAULT_BOT_CONFIG.euphoriaStopShadow,
      ...(raw.euphoriaStopShadow || {}),
    },
    tpCooldown: {
      ...DEFAULT_BOT_CONFIG.tpCooldown,
      ...(raw.tpCooldown || {}),
    },
    srLevels: {
      ...DEFAULT_SR_CONFIG,
      ...(raw.srLevels || {}),
    },
  };

  return config;
}

export function saveBotConfigTemplate(outPath?: string): void {
  const file = outPath || path.resolve(process.cwd(), "bot-config.json");
  fs.writeFileSync(file, JSON.stringify(DEFAULT_BOT_CONFIG, null, 2));
  console.log(`Config template saved to ${file}`);
}
