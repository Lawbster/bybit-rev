# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm run build              # TypeScript compilation (tsc → dist/)
npm run bot                # Main DCA ladder bot (reads bot-config.json)
npm run bot -- --config=x.json  # Custom config
npm run bot -- --init      # Generate config template
npm run discord-alarms     # Discord exit alarm monitor (per-symbol via SYMBOL env)
npm run commander          # Discord bot command listener
npm run fetch              # Fetch historical candles from Bybit
npm run collect            # Real-time data collector (candles, trades, OB, tickers)
```

There are no tests or linter configured. Typecheck with `npx tsc --noEmit` but expect errors in legacy sim files (`noEmitOnError: false` in tsconfig).

## Architecture

This is a production crypto trading system with four layers:

### Bot Layer (`src/bot/`)
- **`index.ts`** — Main poll loop. Reads config, runs tick cycle (price → exits → hedge → entries), manages WebSocket + REST price feeds, signal file checks, position reconciliation.
- **`strategy.ts`** — Pure decision functions (no side effects). Checks: batch TP, soft stale, hard flatten, emergency kill, stress hedge triggers.
- **`executor.ts`** — Three modes behind one interface: `DryRunExecutor` (public API only), `LiveExecutor` (authenticated Bybit). Paper mode uses LiveExecutor on a subaccount.
- **`state.ts`** — Persistent `bot-state.json`. Tracks ladder positions, hedge, equity, cooldowns. Survives crashes.
- **`wed-short.ts`** — Separate Wednesday short bot (pm2 process). Opens short Wed 18:00 UTC near daily high, native TP/stop on Bybit, force-close Thu 12:00 UTC.
- **`context-manager.ts`** — Rolling 5m candle window (~140 days). Seeds from `data/` files, fills gaps from API. Feeds technical engine.
- **`price-feed.ts`** — WebSocket ticker for low-latency TP detection.
- **`bot-config.ts`** — Config loader with defaults. Merges JSON file with hardcoded defaults for filters, exits, hedge params.

### Technical Analysis (`src/bot/technical-engine.ts`, `indicators.ts`, `regime-filters.ts`)
- Builds multi-timeframe context from 5m candles only (aggregates to 1H/4H/1D in-memory).
- Zone detection (support/resistance), VWAP, Fibonacci, 20+ indicators per timeframe.
- Regime filters: EMA trend-break, BTC risk-off, ATR vol expansion, ladder-local kill.

### Discord Layer
- **`discord-alarms.ts`** — Runs per-symbol (8 instances via pm2, `SYMBOL` env var). Three signals: OI divergence, funding alarm, price structure break. Re-alerts every 4h, tracks `alertSent` to prevent spurious CLEAREDs.
- **`discord-commander.ts`** — Polls Discord channel for commands. Writes signal files (`bot-flatten`, `bot-pause`, `bot-resume`) and `override.json` for the bot to consume.

### Data Pipeline
- **`fetch-candles.ts`** — Bulk historical candle fetch from Bybit REST.
- **`data-collector.ts`** — Continuous 1m snapshots (OHLCV, funding, OI, trades, orderbook).
- Data files: `data/{SYMBOL}_5.json` (5m candles), `data/{SYMBOL}_5_full.json` (extended), `*_funding.json`, `*_oi.json`.

## Key Control Flow

**Manual control via filesystem signals** (checked every tick):
- `touch bot-pause` → blocks new adds, exits still active
- `touch bot-flatten` → market-close all + auto-pause
- `touch bot-resume` → clears pause

**Discord commands** (`-closeladder`, `-pause`, `-resume`, `-override HYPE 15`, `-status`) write these same signal files via the commander.

**Override system**: `override.json` lets Discord raise `maxPositions` mid-ladder. Bot reads it each tick, one-shot resets after TP.

## Strategy Logic (DCA Ladder)

Entry: time-based (every `addIntervalMin`) OR price-trigger (price drops `priceTriggerPct`% from last entry). Each rung scales by `addScaleFactor` (Martingale). Gated by trend filter (4H EMA), BTC risk-off, and ladder-local kill.

Exit stack (priority order):
1. Batch TP at weighted-average entry + `tpPct`%
2. Soft stale: after `staleHours`, reduce TP to `reducedTpPct`
3. Hard flatten: after `hardFlattenHours` + deep loss + hostile trend
4. Emergency kill: avg PnL below `emergencyKillPct`

Hedge: CRSI 4H < threshold opens short sized at `crsiNotionalPct` of total long notional. Closes with ladder only.

## Config Files

- `bot-config.json` — Main bot (mode, symbol, DCA params, filters, exits, hedge)
- `wed-short-config.json` — Wednesday short bot params
- `.env` — API keys (`BYBIT_API_KEY`, `BYBIT_API_SECRET`, `BYBIT_SUBACOUNT_*`, `DISCORD_WEBHOOK_{SYMBOL}`, `DISCORD_BOT_TOKEN`, `DISCORD_COMMAND_CHANNEL_ID`)

## Simulation

40+ sim files in `src/sim-*.ts`. The canonical sim is **`sim-exact.ts`** — reads `bot-config.json` directly, supports multi-mode comparison (`runSim("full" | "no-hedge" | "ladder-only")`). Always use `$10k capital / $800 base` for sims regardless of live config equity.

Run: `npx ts-node src/sim-exact.ts` (env: `SIM_START=2025-10-01`, `SIM_NO_PRICE_TRIG=1`)

## Critical Conventions

- **All timestamps are UTC epoch milliseconds.** Never use local time methods (`toLocaleString`, `getHours`). Use `getUTCHours()`, `toISOString()`.
- **Hedge mode on Bybit**: Long ladder uses `positionIdx=1`, short hedge uses `positionIdx=2`. Both can coexist.
- **State recovery**: Bot reconciles local state vs exchange position on startup and periodically. Don't assume local state is authoritative.
- **Signal files are consumed and deleted** (flatten, resume). Pause persists until manually removed.

## Deployment (VPS)

Runs via pm2. Key processes: `hedgeguy-bot`, `wed-short-bot`, `discord-commander`, `alarm-{SYMBOL}` (8 instances).
Rebuild: `git pull && npm run build && pm2 restart hedgeguy-bot`

## Research

`research/` folder contains analysis documents and Codex task specs. See `research/hype-short-signal-analysis.md` for short signal testing results and `research/codex-short-signal-task.md` for ongoing work.
