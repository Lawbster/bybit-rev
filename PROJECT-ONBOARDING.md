# Reverse Copy: Project Onboarding and Repository Map

Last updated: 2026-09-04

Current model entry point: [September 4 handover](MODEL-HANDOVER-2026-09-04.md).
Research preservation and reproduction limits: [research index](research/README.md).

## What this project is

`reverse-copy` is a live cryptocurrency trading and market-data system centered
on HYPEUSDT. Its primary objective is to extract HYPE price movement through a
long DCA/Martingale ladder and a separate, regime-specific short strategy while
preserving crash-safe exchange/local state reconciliation.

This is not only a strategy-research repository. It contains production order
execution, durable transaction state, collectors, Discord controls, operational
health monitoring, backtest/replay harnesses, and the local copies of VPS data
used for incident analysis.

The production deployment is on Bybit in hedge mode:

- `positionIdx=1`: the main HYPE long ladder;
- `positionIdx=2`: the dedicated HYPE Hyperliquid-signal short owner.

Those sides have independent strategy logic and transaction state, but they
share account equity and margin. Portfolio evaluation must therefore measure
their combined dollar PnL and drawdown rather than adding isolated percentage
returns.

## Start here

Read these files in this order before making changes:

1. [AGENTS.md](AGENTS.md) — mandatory research and decision discipline,
   including aggregate evidence, no-lookahead rules, and the threshold for a
   live-config recommendation.
2. This document — current project and documentation map.
3. [CLAUDE.md](CLAUDE.md) — baseline build commands and broad architecture.
   Some production descriptions in it predate the transactional short owner,
   watchdog, and recent S/R work; where it conflicts with this file or a current
   operations runbook, use the newer document and verify against code/config.
4. The relevant runbook under [docs/operations](docs/operations) for the process
   being inspected or deployed.
5. The newest relevant findings under `research/` before proposing strategy or
   risk changes.

Do not infer the live exchange state from documentation. The checked-in config
is desired state; `bot-state.json`, atomic health snapshots, PM2, and Bybit are
separate operational authorities that must reconcile explicitly.

## Current production shape

### Main HYPE long ladder

Entry point: `src/bot/index.ts`

Checked-in live configuration: [bot-config.json](bot-config.json)

Current high-level policy:

- HYPEUSDT long ladder;
- `$800` base rung, `1.35x` scaling, maximum 11 rungs;
- `1.4%` batch TP;
- after four hours, reduced `0.5%` stale TP;
- 12-hour / -2% hard flatten when the completed-4H trend is hostile;
- -14% emergency kill;
- 4H EMA trend gate, BTC risk-off, five-red/two-green daily regime breaker,
  ladder-local guard, add throttle, and deep-add stress guard;
- S/R resistance partial exits are live;
- the exact S/R support-reopen exception is live, but outer risk gates remain
  authoritative;
- the persistent damaged-regime latch blocks entries/adds until structural recovery;
- ordinary/stale TP uses the transactional maker owner with verified residual
  market fallback;
- main-bot hedge execution is disabled.

The current rule is whatever is in `bot-config.json` and current source—not a
number copied into a research note. Inspect both before relying on this summary.

Important long-side modules:

| Surface | Purpose |
|---|---|
| `src/bot/index.ts` | Main lifecycle, market loop, gates, exits, startup and periodic reconciliation |
| `src/bot/strategy.ts` | Core ladder decision functions |
| `src/bot/executor.ts` | Bybit execution boundary and normalized results |
| `src/bot/state.ts` | Durable `bot-state.json` model and persistence |
| `src/bot/long-transaction.ts` | Durable long intent and receipt state |
| `src/bot/long-transaction-coordinator.ts` | Owns long exchange submission, resolution, and local commit |
| `src/bot/partial-close-transaction.ts` | Durable partial-close transaction model |
| `src/bot/partial-close-coordinator.ts` | Partial-close exchange/local commit owner |
| `src/bot/long-side-guard.ts` | Prevents overlapping long-side mutation |
| `src/bot/price-feed.ts` | Low-latency Bybit ticker feed used for TP detection |

Accepted orders are not assumed filled. Pending intent remains durable until
terminal exchange evidence and the local state commit agree. Missing exchange
rows alone are ambiguity, not proof of rejection. Any execution change must
preserve that invariant across crashes and startup replay.

### S/R and technical context

The main context path is:

```text
Bybit 5m candles
  -> src/bot/context-manager.ts
  -> src/technical-engine.ts
  -> trend/context decisions and S/R inputs
```

Important modules:

| Surface | Purpose |
|---|---|
| `src/bot/context-manager.ts` | Seeds, backfills, upserts, and bounds the rolling 5m context |
| `src/technical-engine.ts` | Multi-timeframe indicators, zones, VWAP, Fibonacci, and context score |
| `src/bot/sr-memory-zones.ts` | Confirmed 30m memory-zone construction |
| `src/bot/sr-shadow.ts` | S/R candidate telemetry |
| `src/bot/sr-support-reopen.ts` | Narrow live support-reopen qualification |
| `src/bot/score-partial-flatten.ts` | Shadow-only score partial system |

The action-oriented S/R system requires continuous, healthy recent candle
coverage and confirmed pivots. If coverage is unhealthy, S/R actions fail
closed while ordinary TP, emergency handling, reconciliation, and other core
protection continue.

### Dedicated HYPE short

The checked-in short owner is entry-paused in
[hl-short-live-config.json](hl-short-live-config.json):

- `enabled=true`, `entryEnabled=false`: management/reconciliation remain online;
- fixed `$25,000` notional;
- 25x leverage in account hedge mode;
- frozen `hl_bid_pull_break` signal;
- TP `1.95%`, SL `4%`, maximum hold 12 hours;
- one short at a time;
- sole authorized HYPE owner of `positionIdx=2`.

New entries were paused on September 4 after forward revalidation failed.
Do not re-arm as part of a routine pull. The architecture intentionally
separates observation from execution:

| Surface | Purpose |
|---|---|
| `src/bot/hl-short-breakdown-policy.ts` | Pure frozen signal policy |
| `src/bot/hl-short-breakdown-shadow.ts` | Produces deterministic decision/signal journal; cannot trade |
| `src/bot/hl-short-live.ts` | Live owner consuming the shadow signal journal |
| `src/bot/hl-short-live-state.ts` | Durable short state and receipts |
| `src/bot/hl-short-transaction-coordinator.ts` | Transactional open/close resolution and reconciliation |

The live owner does not independently recompute a similar signal. It consumes
the deterministic journal event, writes durable intent before submission, and
requires exact fill/protection evidence. An open short must have confirmed
native TP and SL. Unresolved evidence enters fail-closed recovery.

The old HYPE Wednesday short owner is retired and must not be restored. The main
HYPE hedge remains disabled. This prevents multiple processes from competing
for Bybit's single HYPE short-side position.

### New forward observers deployed August 12

Two additional read-only PM2 observers were deployed by the Fable 5 pass on
2026-08-12. Neither observer can submit orders or change live strategy state.

#### `hl_bid_pull_volume` short shadow

Process: `hype-hl-short-bpv-shadow`

This is a second frozen short candidate, not another execution owner. Its
policy, signal namespace, journal, state, and health files are deliberately
separate from the traded `hl_bid_pull_break` signal:

| Surface | Purpose |
|---|---|
| `src/bot/hl-short-bidpullvolume-policy.ts` | Pure `hl_bid_pull_volume` qualification and frozen TP1.5/SL4/4h outcome policy |
| `src/bot/hl-short-bidpullvolume-shadow.ts` | Read-only forward decision and theoretical-trade observer |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow.jsonl` | Independent append-only journal using the `hlbpv-` identity namespace |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow_health.json` | Atomic observer health |

Implementation parity compared 8,075 historical decisions with zero fire
mismatches. The production implementation is intentionally stricter about
one-minute gaps than the original study and fails closed rather than filling
missing volume coverage. The live short owner rejects this candidate and its
signal identity; never point `hl-short-live-config.json` at this observer.

The forward cohort began on August 12. Reassess only after 30–60 days, including
cost/delay stress and signal overlap with the existing short. A positive cohort
still requires a separate shared-capital and transactional-owner design review
before any live use.

#### Maker-TP fill shadow

Process: `hype-maker-tp-shadow`

`src/bot/maker-tp-fill-shadow.ts` measures whether real long TP/stale-TP closes
could have filled as resting maker limits. It follows the TP intent published
in runtime health, observes subsequent committed batch closes, and queries only
Bybit public trade prints to estimate postability, strict trade-through volume,
fee savings, and price delta.

Its durable artifacts are:

- `data/HYPEUSDT_maker_tp_shadow.jsonl`;
- `data/HYPEUSDT_maker_tp_shadow_state.json`;
- `data/HYPEUSDT_maker_tp_shadow_health.json`.

This observer has no API keys and no order path. The separate transactional
maker-TP execution path was subsequently deployed and armed on August 31;
see [maker-TP live execution](docs/operations/maker-tp-live.md). Observer
estimates are counterfactuals, not a substitute for actual fee/fill receipts.
The operational watchdog consumes this health file and raises warning-only
stale/degraded incidents. It never restarts or remediates the observer.

### Auxiliary systems

The repository also contains:

- `src/bot/pf0-short.ts` — SUI pump-failure short;
- `src/bot/sui-ladder.ts` — generic auxiliary ladder used for SUI/FARTCOIN;
- `src/discord-alarms.ts` — symbol alarm monitors;
- `src/discord-commander.ts` — Discord command listener;
- `src/data-collector.ts` — Bybit/Binance data collector;
- `src/hyperliquid-collector.ts` — HYPE-specific Hyperliquid collector.

The auxiliary trading configs are legacy/runout-oriented and do not inherit the
HYPE transaction coordinator automatically. Do not reactivate or broaden them
without a separate execution-safety review.

The operator retired `pf0-short-bot` from PM2 on September 4 after local and
exchange-flat checks, then saved the process list. Its files remain historical
evidence, not an instruction to restart it.

## Operational health and controls

The main bot publishes an atomic runtime snapshot approximately every ten
seconds:

```text
data/HYPEUSDT_runtime_health.json
```

The independent watchdog is read-only and alert-only:

```text
src/bot/operational-health.ts
src/bot/operational-watchdog.ts
src/bot/operational-watchdog-state.ts
```

It evaluates local snapshots and streams, sends incident lifecycle alerts, and
publishes upside-readiness shadow telemetry. It does not submit orders, write
bot control signals, restart PM2 processes, or auto-remediate incidents.

Key health artifacts:

| File | Meaning |
|---|---|
| `data/HYPEUSDT_runtime_health.json` | Main-loop, context, reconciliation, pending transaction, TP intent, and position health |
| `data/HYPEUSDT_operational_watchdog_state.json` | Durable alert lifecycle state |
| `data/HYPEUSDT_upside_readiness.json` | Read-only `$900`-base eligibility observation; never changes sizing |
| `data/HYPEUSDT_hl_short_breakdown_shadow_health.json` | Short signal observer health |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow_health.json` | Second, read-only short-candidate observer health |
| `data/HYPEUSDT_hl_short_live_health.json` | Transactional live short health and reconciliation |
| `data/HYPEUSDT_maker_tp_shadow_health.json` | Read-only maker-TP fill-study heartbeat; warning-only watchdog coverage |
| `data/collector_health.jsonl` | Append-only collector stream observations |

Manual controls are filesystem signals consumed by the main bot:

- `bot-pause` blocks new long adds while protection/exits remain active;
- `bot-flatten` requests a transactional full close and then pauses;
- `bot-resume` clears the manual pause path;
- `override.json` can raise maximum ladder depth temporarily and is a privileged
  exposure intervention.

See [BOT-COMMANDS.md](BOT-COMMANDS.md) for operator-facing Discord commands.

## Data, state, and log map

### Durable trading state

- `bot-state.json` — main long ladder state, receipts, cooldowns, recovery, and
  accounting. It is ignored by Git and copied from production for analysis.
- `data/HYPEUSDT_hl_short_live_state.json` — transactional short state.
- shadow/action state files under `data/` — restart continuity for observers;
  they are not exchange authority.

Never edit copied runtime state to make a reconciliation check pass. Diagnose
the exchange/local evidence instead.

### Market and pulse data

Common inputs include:

- `data/HYPEUSDT_1m.jsonl` and HYPE 5m history;
- Bybit/Binance trades, order book, OI, funding, taker, and liquidation data;
- `data/HYPEUSDT_taker_hyperliquid.jsonl`;
- `data/HYPEUSDT_ob_bands_hyperliquid.jsonl`;
- `data/HYPEUSDT_asset_ctx_hyperliquid.jsonl`;
- other HYPE Hyperliquid OI, funding, candle, trade, and vault streams.

JSONL streams are generally append-only. Small health/status JSON files are
atomically replaced snapshots. Use embedded UTC timestamps rather than Windows
file modification time when deciding whether a pull is fresh.

### Logs and decision journals

- `logs/trades_YYYY-MM-DD.jsonl` — committed trade accounting;
- `logs/equity_YYYY-MM-DD.jsonl` — equity and realized-PnL observations;
- `logs/pm2/hedgeguy-bot-out.log` — copied main process log;
- `data/HYPEUSDT_decisions.jsonl` — main decision telemetry;
- `data/HYPEUSDT_sr_partial_exit_actions.jsonl` — executed/blocked S/R partial
  lifecycle;
- `data/HYPEUSDT_sr_support_reopen_actions.jsonl` — support-reopen lifecycle;
- `data/HYPEUSDT_hl_short_breakdown_shadow.jsonl` — deterministic short signal
  and theoretical-trade journal.

For an incident, triangulate the durable state, committed trade row, decision
row, health snapshot, exchange evidence when available, and PM2 log. One log
line alone is not sufficient proof of the final transaction state.

## Documentation directory

### Production operations

Use these as the current runbooks:

- [PM2 VPS operations](docs/operations/pm2-vps.md) — process inventory,
  deployment boundaries, reboot persistence, and incident triage.
- [VPS data sync](docs/operations/vps-data-sync.md) — reviewed WSL/rsync pull of
  data, state, application logs, and PM2 logs.
- [VPS capacity](docs/operations/vps-capacity.md) — host baseline and upgrade
  triggers.
- [HYPE transactional short](docs/operations/hl-short-live.md) — owner safety,
  preflight, protection, recovery, deploy, and disarm procedure.
- [HYPE short forward shadow](docs/operations/hl-short-breakdown-shadow.md) —
  frozen signal definition and observer lifecycle.
- [HYPE bid-pull-volume forward shadow](docs/operations/hl-short-bidpullvolume-shadow.md)
  — isolated second short candidate, cohort rules, and promotion boundary.
- [Maker-TP fill shadow](docs/operations/maker-tp-fill-shadow.md) — read-only
  fee/fill counterfactual and stage-2 evidence gate.
- [Maker-TP execution](docs/operations/maker-tp-live.md) — live ownership,
  cancellation, restoration and residual fallback safety.
- [S/R support reopen](docs/operations/sr-support-reopen.md) — exact live policy,
  preserved gates, telemetry, and rollback.
- [Upside readiness](docs/operations/upside-readiness.md) — shadow-only sizing
  eligibility and evidence requirements.

The PM2 runbook separates the captured July inventory from subsequent operator
updates. Neither is an executable manifest. Always compare with `pm2 ls`,
health timestamps, and current config on the VPS.

### Transaction and execution safety history

Read these local research documents when changing long execution, partial
closes, or reconciliation:

- `research/codex-transactional-close-reconciliation-safety-audit-2026-07-11.md`;
- `research/codex-9d70564-close-stack-rereview-2026-07-12.md`;
- `research/codex-long-transaction-cleanup-implementation-plan-2026-07-12.md`;
- `research/codex-long-transaction-cleanup-implementation-closure-2026-07-12.md`;
- `research/codex-recent-partial-flatten-audit-2026-07-16.md`.

These explain why durable intent, exact fill evidence, idempotent replay, and a
single transaction coordinator are non-negotiable.

### Current long-strategy investigations

- `research/codex-hype-current-regime-ladder-pause-findings-2026-08-14.md` —
  evidence for the now-live damaged-regime latch; one prolonged damage episode.
- `research/codex-hype-rung11-daily-high-delay-findings-2026-08-20.md` — no
  tested daily-high delay passed; rung-11 behavior remains unchanged.
- `research/codex-hype-trendlock-timing-audit-2026-08-11.md` — latest trend
  rearm/hard-flatten timing audit before the August 14 latch study.
- `research/codex-hype-aug7-flatten-regime-audit-2026-08-08.md` — preceding
  regime/flatten analysis.
- `research/codex-hype-sr-latest-regime-audit-2026-08-04.md` — latest S/R level
  and execution review.
- `research/codex-2026-07-22-trend-blocker-regime-review.md` — earlier trend-gate
  causal replay.
- `research/codex-2026-07-12-sr-partial-exit-revalidation-findings.md` — S/R
  partial-exit validation.

### Current short-strategy investigations

- `research/codex-hl-short-regime-revalidation-findings-2026-09-04.md` —
  forward deterioration and failed suspension variants; supports the current
  new-entry pause, not a replacement live filter.
- `research/codex-short-signal-results.md` — long-running candidate/falsification
  ledger; search this before retesting an idea.
- `research/codex-hl-short-system-refresh-2026-08-10.md` — latest system and
  forward-trade refresh.
- `research/codex-hl-short-profit-protection-findings-2026-08-10.md` — partial
  profit-protection/S/R exit study.
- `research/codex-hl-short-timeout-window-findings-2026-08-10.md` — timeout-exit
  optimization study.
- `research/codex-hl-short-nearby-tp-findings-2026-08-10.md` — nearby TP target
  comparison supporting the current 1.95% policy.
- `research/codex-hl-short-shared-account-findings-2026-07-16.md` and
  `research/codex-hl-short-notional-frontier-findings-2026-07-16.md` — combined
  long/short portfolio and `$25k` notional evidence.
- `research/fable-5-hlp-vault-mining-findings-2026-08-12.md` — no standalone
  HLP-vault edge; a 24h vault-drain split remains observability-only.
- `research/fable-5-profitability-lever-survey-2026-08-12.md` — point-in-time
  account/risk and fee-opportunity survey that motivated the two August 12
  observers.
- `research/codex-shared-account-sizing-reanchor-findings-2026-08-13.md` —
  historical portfolio sizing matrix: `$500 / $25k` was the efficient
  defensive combination and `$800 / $25k` maximized tested profit. It predates
  both the damaged-regime latch and the short pause; it does not validate
  today's combined portfolio automatically. Automatic ±20% rebalancing failed.

The profitability survey recorded approximately `$21.6k` equity and 40.8%
drawdown at the August 11 pull, and warned that the fixed `$800` long base and
`$25k` short were large relative to the project's older survival anchors. It
suggested researching an equity-proportional re-anchor, but ran no replay and
made no config change. Treat it as a high-priority risk question, not an
approved sizing instruction. The checked-in live values remain `$800` and
`$25k` until a causal replay, stability review, and explicit authorization say
otherwise. The `$25k` short is currently an inactive notional setting, not
ongoing exposure.

Selected research sources, findings and small manifests are designated for
version control; raw datasets, runtime state and generated `backtests/` remain
local/ignored. See [research preservation](research/README.md) for the exact
scope and outstanding reproduction dependencies. A source checkout alone is
not the original dataset. Preserve local evidence separately and never
overwrite a historical output directory with a refreshed run.

## Research truth hierarchy

For strategy questions, use this order:

1. Current checked-in config and production code define the live behavior.
2. Current runtime state/logs establish what actually happened.
3. The newest relevant findings document establishes previously tested and
   falsified hypotheses.
4. Parity-validated causal replay establishes counterfactual performance.
5. Forward shadow/live evidence tests whether the historical result persists.

For the current HYPE ladder, prefer the parity-validated freerun engine in
`scripts/hype-freerun-canonical-replay.ts` and its task-specific wrappers.
The canonical engine and its dormant-series dependency are included in the
research preservation bundle. Reproduction still requires the matching data,
config, cutoffs and task-specific wrapper; parity is not implied by the name
"canonical." `src/sim-exact.ts` is an older broad harness and must not
be assumed to match the current live stack without an explicit parity check.

Before ranking a variant:

1. reproduce baseline totals over the identical window;
2. use only information available at the decision timestamp;
3. trace at least one decision end-to-end for lookahead;
4. report full-period net PnL, maximum drawdown, event count, and per-month delta;
5. account for invisible upside such as extra TP cycles and avoided cascades;
6. reject candidates with material monthly instability or an unexplained
   mechanism.

Recent visible losses can motivate an audit but cannot alone authorize a config
change. Negative findings are final results and should be added to the research
ledger instead of being reframed as weak deployment candidates.

## Build and verification

Standard local checks:

```bash
npm run build
npx tsc --noEmit --pretty false
npx tsc -p tsconfig.vps.json --noEmit --pretty false
git diff --check
```

There is no single comprehensive test runner. Relevant standalone suites live
under `scripts/`. Choose tests for every touched boundary. Common safety suites
include:

```bash
npx ts-node scripts/long-state-transaction-tests.ts
npx ts-node scripts/long-transaction-coordinator-tests.ts
npx ts-node scripts/long-executor-transaction-tests.ts
npx ts-node scripts/partial-close-transaction-tests.ts
npx ts-node scripts/long-side-guard-tests.ts
npx ts-node scripts/operational-health-tests.ts
npx ts-node scripts/operational-watchdog-tests.ts
npm run test:hl-short-live
```

Research harnesses can be expensive. Run them locally, not on the production
VPS, and record their exact data cutoff and arguments in the resulting findings.

## Deployment boundary

The production checkout is `/opt/bybit-rev` under user `deploy`. PM2 process
persistence is provided by `pm2-deploy.service` and `/home/deploy/.pm2/dump.pm2`.

Do not use a blanket `pm2 restart all`. Build first, restart only affected
processes, and preserve intentionally stopped entries. Execution/state changes
require the stricter runbook preflight: stop the owner when appropriate,
snapshot durable state, prove pending intent is clear or safely resumable, and
verify local/exchange quantity synchronization.

Never commit or paste:

- `.env`;
- API keys or Discord tokens/webhooks;
- raw PM2 environment dumps;
- production state snapshots containing unnecessary account detail.

After an intentional PM2 topology change, verify the final online/stopped set
before `pm2 save`. A temporary diagnostic stop must not accidentally become the
next reboot state.

## Task-specific reading paths

### Investigating a long loss or hard flatten

Read `AGENTS.md`, the newest trend/flatten findings, `bot-config.json`, relevant
trade/decision/PM2 rows, and the canonical replay wrapper. First prove whether
the event was transactionally correct; then compare it with aggregate history.

### Changing reconciliation, closes, or restart behavior

Read the transaction-safety history, all long coordinator/state files, and the
corresponding crash/replay suites. Design for unknown submission status,
terminal partial fills, already-flat races, and idempotent restart before
changing call sites.

### Investigating S/R behavior

Read the latest S/R audit, `sr-memory-zones.ts`, `sr-shadow.ts`, the action
coordinator path, and the S/R context safety tests. Validate confirmed timestamps
and continuous coverage before judging a level from a chart.

### Investigating or changing the HYPE short

Read both short runbooks, the current short findings/ledger, the policy module,
transaction coordinator, durable state, and live-owner tests. Never create a
second owner for `positionIdx=2`.

### Responding to a watchdog alert

Run the dry-run evaluator, inspect the incident's named producer and health
snapshot, then follow the PM2 runbook. A cleared alert means telemetry recovered;
it does not independently prove exchange position safety.

### Pulling fresh production evidence

Use [VPS data sync](docs/operations/vps-data-sync.md) and
`scripts/pull-vps-data.sh`. Preview with `--dry-run`, then inspect embedded source
timestamps after the pull.

## Safe handoff checklist

Before another builder or research agent acts, it should be able to state:

- which process and Bybit position side it is touching;
- whether the task is analysis, design, implementation, or deployment;
- which config/state/health artifacts are authoritative for the task;
- which prior findings already tested the idea;
- how baseline parity and no-lookahead will be demonstrated;
- which focused tests and VPS runbook checks will prove completion;
- whether any live configuration change is explicitly authorized.

If any of those answers is unclear, stop at analysis or a patch specification
rather than changing the live system.
