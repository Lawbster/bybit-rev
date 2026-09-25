# CLAUDE.md

Guidance for Claude Code in `reverse-copy`. Rewritten 2026-09-14. Behavioral rules live in
`AGENTS.md` and are not repeated here; this file is the build/run/layout/state map.

## What this repo is

A live Bybit HYPEUSDT trading system: a long DCA/Martingale ladder with transactional
execution, a paused dedicated short owner, market-data collectors, read-only strategy
shadows, an alert-only watchdog, Discord controls, and a large local research library.
It controls real money. Start read-only. Config is intended behavior; `bot-state.json`,
health snapshots, PM2 and Bybit are separate authorities that must reconcile explicitly.

Read in this order before acting: `AGENTS.md` (discipline), `MODEL-HANDOVER-2026-09-04.md`
(current production deltas), `PROJECT-ONBOARDING.md` (detailed map), the relevant
`docs/operations/*.md` runbook, then the newest `research/*findings*.md` for the surface
you are touching. Where an older doc conflicts, the newer doc plus current code/config wins.

## Build, typecheck, run

```bash
npm run build                          # tsc with tsconfig.json -> dist/
npx tsc --noEmit --pretty false        # full project typecheck
npx tsc -p tsconfig.vps.json --noEmit --pretty false   # VPS production file set
git diff --check
npm run bot                            # main HYPE ladder (src/bot/index.ts, reads bot-config.json)
npm run bot -- --config=x.json         # alternate config;  npm run bot:init  writes a template
npm run watchdog -- --once --dry-run   # read-only health check, no alerts
npm run collect / npm run hl-collect   # Bybit+Binance / Hyperliquid collectors
npm run commander / npm run discord-alarms   # Discord command listener / per-symbol alarms (SYMBOL env)
npm run hl-short-live / hl-short-shadow / hl-short-bpv-shadow / maker-tp-shadow
npm run research:workflow -- plan|run|verify|status <card|KEY>
```

`npm run build:vps` uses `rm -rf` and is for the VPS only. `tsconfig.json` excludes
`src/_legacy`, `src/sim-*`, `src/analyze-*`, `src/discover-*` and similar one-off scripts;
they are historical and do not typecheck as part of the project. Both typechecks passed on
2026-09-04 and 2026-09-13; treat a new compiler failure as real. No linter is configured.

## Tests

There is no single test command. Run the suites that touch the changed boundary:

| Surface | Command |
|---|---|
| Long transactions / partial closes | `npx ts-node scripts/long-state-transaction-tests.ts`, `long-transaction-coordinator-tests.ts`, `long-executor-transaction-tests.ts`, `long-close-finalizer-tests.ts`, `partial-close-transaction-tests.ts`, `long-side-guard-tests.ts`, `executor-normalization-tests.ts` |
| Maker TP | `npm run test:maker-tp`, `npm run test:maker-tp-shadow` |
| Aggressive10 profile | `npx ts-node scripts/aggressive10-policy-tests.ts`, `aggressive10-crash-tests.ts` |
| Short owner / shadows | `npm run test:hl-short-live`, `npm run test:hl-short-bpv` |
| S/R, latch, context, health | `sr-support-reopen-tests.ts`, `sr-context-safety-tests.ts`, `npm run test:damaged-regime-latch`, `context-manager-tests.ts`, `runtime-health-tests.ts`, `operational-health-tests.ts`, `operational-watchdog-tests.ts` |
| Replay / research infra | `replay-causality-tests.ts`, `replay-current-stack-tests.ts`, `replay-candle-repair-tests.ts`, `npm run test:closed-indicator-timing`, `npm run test:research-workflow`, `npm run test:event-atlas` |

Each research study also ships its own `scripts/<study>-tests.ts` and an independent
`-verify.ts`; the study's method doc under `docs/research/` names them.

## Layout

| Path | Contents |
|---|---|
| `src/bot/index.ts` | Main HYPE lifecycle: loop, gates, exits, reconciliation, signal files, profile selection |
| `src/bot/strategy.ts` | Pure ladder decisions: adds, batch TP, soft-stale, hard flatten, emergency, trend/BTC/regime gates |
| `src/bot/executor.ts` | Bybit boundary: `DryRunExecutor` (public API) and `LiveExecutor` (`mode: paper` runs LiveExecutor on a subaccount) |
| `src/bot/state.ts` | Durable `bot-state.json`: rungs, receipts, cooldowns, recovery, aggressive10 profile |
| `src/bot/long-transaction*.ts`, `partial-close-*.ts`, `maker-tp-*.ts`, `long-close-finalizer.ts`, `long-side-guard.ts` | Transactional ownership of every long-side exchange mutation |
| `src/bot/aggressive10-policy.ts`, `aggressive10-context.ts` | Pure aggressive10 decisions and bounded 1m candle hydration for the 48h high |
| `src/bot/sr-*.ts`, `damaged-regime-latch.ts`, `context-manager.ts` | S/R memory zones, resistance partials, support reopen, persistent damaged-regime block, rolling 5m context |
| `src/bot/hl-short-*.ts` | Frozen short signal policies, read-only shadows, the dedicated transactional short owner |
| `src/bot/operational-*.ts`, `runtime-health.ts`, `upside-readiness.ts` | Health snapshots, alert-only watchdog, shadow sizing telemetry |
| `src/bot/*-shadow.ts`, `score-partial-flatten.ts` | Read-only candidate observers; they never trade |
| `src/bot/wed-short.ts`, `pf0-short.ts`, `sui-ladder.ts` | Retired or runout-only owners. Do not start them |
| `src/technical-engine.ts`, `indicators.ts`, `regime-filters.ts` | Multi-timeframe indicators, zones, VWAP, regime filters built from 5m candles |
| `src/data-collector.ts`, `hyperliquid-collector.ts`, `binance-taker.ts`, `hl-data-quality.ts` | Stream collectors and freshness rules |
| `src/discord-commander.ts`, `discord-alarms.ts` | Discord commands and per-symbol alarms |
| `src/research/` | Closed-bar indicator features and the event atlas used by research scripts |
| `scripts/` | ~380 files: safety tests, causal replay engine (`hype-freerun-canonical-replay.ts`, `replay-*.ts`), study runners, verifiers, VPS data pull |
| `docs/operations/` | Runbooks: `pm2-vps`, `vps-data-sync`, `aggressive10-live`, `maker-tp-live`, `hl-short-live`, `sr-support-reopen`, `damaged-regime-latch`, shadows, capacity |
| `docs/research/` | Method docs per study, `current-live-hype-ladder-map-2026-09-07.md`, `local-research-workflow.md` |
| `research/` | Dated findings. Start at `research/README.md`, then `TESTED-SETUPS.md`, `INDICATOR-FINDINGS.md`, `COMBINATION-CANDIDATES.md` |
| `research-inputs/` | Frozen study cards (JSON), written before outcomes |
| `backtests/` | Generated replay evidence; git-ignored; accepted outputs are never overwritten |
| `data/`, `logs/`, `bot-state.json` | Synced copies of production streams, health, state and PM2 logs. Not a live mount. Use embedded UTC timestamps, not file mtimes |

## Live surfaces (intended state as of 2026-09-14; verify against VPS before acting)

- **Main HYPE long ladder** (`hedgeguy-bot`, Bybit hedge mode `positionIdx=1`): $800 base,
  x1.35, max 11 rungs, 25x, 1.4% batch TP, adds every 30 min or on a 0.3% drop. Exit stack
  in priority order: batch TP, soft-stale TP (0.5% from 4h when PnL < 0.5%), hard flatten
  (>=21h AND <=-2% AND hostile 4h trend; 12h until 2026-09-25, see
  `research/opus-5.5-ladder-exit-lab-2026-09-25.md`), emergency kill (-14%), funding-spike guard.
  Entry gates: 4h EMA trend break, BTC risk-off, five-red/two-green daily breaker,
  overextended-entry filter, add throttle, deep-add stress guard, ladder-local kill,
  damaged-regime latch. S/R resistance partials and the narrow support-reopen exception
  are live. Maker TP (post-only, 0.02%, 2s touch grace, market fallback) owns ordinary and
  stale TP closes. `hedge.enabled=false`.
- **Aggressive10 profile** (`bot-config.json -> aggressive10.enabled=true`, commit `bc06851`,
  2026-09-11): applies to the **next fresh ladder only**. Defers the soft-stale reduction
  until the oldest rung is 10h old, adds a full exit from age 4h when the closed minute is
  within 1% of the 48h high (no profit floor), and disables the deep negative-funding
  timer-add guard and the hot-RSI post-TP cooldown. Runbook: `docs/operations/aggressive10-live.md`.
  The carry-in ladder open at activation stays on the baseline profile until flat.
- **Dedicated HYPE short** (`hype-hl-short-live`, `positionIdx=2`): `enabled=true`,
  `entryEnabled=false` since 2026-09-04. Keep it online; do not re-arm entries or create a
  second short owner. `wed-short` is retired and must not run.
- **Observers**: `hype-hl-short-shadow`, `hype-hl-short-bpv-shadow`, `hype-maker-tp-shadow`,
  `hype-health-watchdog` are read-only. Collectors: `bybit-collect`, `hl-collect`.
  `commander` and `alarm-HYPEUSDT` are online; seven other `alarm-*` processes are
  intentionally stopped. `pf0-short-bot`, `sui-ladder` and `fart-ladder` are no longer in
  PM2 (operator-confirmed `pm2 ls`, 2026-09-14). A stopped `stable-corridor-*` process
  belongs to a separate project sharing the host; never start it from this repo.

Config files: `bot-config.json` (main), `bot-config.paper.json`, `bot-config.dryrun.json`,
`hl-short-live-config.json`, and legacy `wed-short-config.json`, `pf0-short-config.json`,
`sui-ladder-config.json`, `fart-ladder-config.json`. `.env` holds API keys, Discord token,
command channel and per-symbol webhooks. The local `.env` has read-only and test-subaccount
keys only; production keys exist only on the VPS.

## Manual controls

Filesystem signals checked every tick: `bot-pause` (blocks adds, exits continue, persists
until removed), `bot-flatten` (transactional full close then auto-pause; consumed),
`bot-resume` (clears pause; consumed), `override.json` (one-shot `maxPositions` raise).
Discord (`-help` in the command channel): `-close <bot>`, `-pause <bot>`, `-resume <bot>`,
`-status [bot]`, `-override <sym> <n|reset>`, `-regime-arm <bot>`. The commander registers
`hype`, `sui` and `fart` and override symbols for eight pairs, but only `hype` is live; the
others are legacy registrations. Details in `BOT-COMMANDS.md`.

## Non-negotiable conventions

- All timestamps are UTC epoch milliseconds. Never `toLocaleString`, `getHours` or local time.
- Hedge mode: long ladder `positionIdx=1`, short `positionIdx=2`. One owner per side.
- Transactions: persist intent before submission; accepted is not filled; `not found` is
  ambiguity; PnL commits only on exact execution evidence; full close is final only when
  exchange and local quantity agree; restart uses the same resolver as runtime. Read the
  July 2026 transaction-safety research before touching this boundary.
- Never edit `bot-state.json`, pending fields, cooldowns or receipts to make a check pass.
- No look-ahead in any replay or shadow: closed bars only, forward-only S/R state,
  explicit availability clocks, `ReplayMarketInputs` rather than live readers on history.
- Live config changes, order submission, PM2 restarts and deployments require explicit
  user authorization. An analysis request is not that authorization.
- Never commit `.env`, PM2 dumps, raw environment output, or credentials.

## Research rules (short form)

`AGENTS.md` sections 2 to 10 and `research/README.md` are authoritative. In brief: write
the frozen card under `research-inputs/` before outcomes; reproduce the unchanged baseline
digest first; report B17 and the incremental parent beside every result with W/L, winning
and losing dollars, average loss, realized versus marked net, DD, monthly deltas,
concentration and intervention counts; keep the monthly screen (no month worse than
-$250 versus baseline) visible even when a candidate is promoted by user decision; write
a dated `research/<agent>-<topic>-findings-<date>.md`; never overwrite accepted outputs;
research runs locally, never on the VPS. Current lead and its known costs:
`research/AGGRESSIVE-10H-CANDIDATE.md`; latest checkpoints are listed at the top of
`research/README.md`. Older `src/sim-*.ts` results predate the September 2026 execution
and input repairs and are not comparable with current-model totals.

## Deployment

Follow `docs/operations/pm2-vps.md` and the feature runbook. Build first, run the
transaction-state preflight, restart only the named process, never `pm2 restart all`,
never resurrect a retired owner, `pm2 save` only after confirming topology. Do not chain
`pm2 restart` onto `git pull && npm run build` with `&&`; run it as a separate line.

## Claude Code specifics

- Primary shell is PowerShell 5.1; the Bash tool is Git Bash. `gh` is not installed.
- Project skills in `.claude/skills/`: `hype-research-lite` (analysis-only, auto-invocable)
  and `hype-fable-single-pass` (manual). VS Code ignores their `model`/`effort` frontmatter.
- `.claude/settings.json` allowlists read-only PowerShell, git and `npx tsc --noEmit`.
- Codex (Astra) does most research passes; Claude is used for second-opinion reviews and
  handovers. Cross-agent handoffs go through dated files in `research/`, not chat history.

## Git and the research library

`research/`, `research-inputs/`, `docs/research/` and most September 2026 findings are
untracked by the operator's choice: they are used locally and will be committed later or
when the rig moves. Do not stage them wholesale, do not "clean up" untracked files, and
do not treat a clone as a complete evidence library. `backtests/`, `data/`, `logs/` and
`bot-state.json` are git-ignored and synced from the VPS. Commit only when asked, with
path-limited `git add`.

## Known stale or legacy documents

`CLAUDE_PATH_FORWARD.md` and `XWAVE_ANALYSIS.md` are early-project notes. The July table in
`docs/operations/pm2-vps.md` is historical; apply its September 4 deltas and the process
list above. `BOT-COMMANDS.md` predates the transactional close path. Several
`research/codex-5.x` and `fable-5-*` files use the superseded replay engine.
