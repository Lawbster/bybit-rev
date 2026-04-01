import fs from "fs";
import path from "path";

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
  };

  return config;
}

export function saveBotConfigTemplate(outPath?: string): void {
  const file = outPath || path.resolve(process.cwd(), "bot-config.json");
  fs.writeFileSync(file, JSON.stringify(DEFAULT_BOT_CONFIG, null, 2));
  console.log(`Config template saved to ${file}`);
}
