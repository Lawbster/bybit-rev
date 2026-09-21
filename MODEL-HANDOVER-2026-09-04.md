# Reverse Copy — Model Handover

Last updated: 2026-09-04  
Repository: `reverse-copy`  
Production checkout: `/opt/bybit-rev` on the VPS, owned by user `deploy`  
Primary market: Bybit HYPEUSDT in hedge mode

## Purpose of this document

This is the short, current entry point for a new coding or research model. It
does not replace the detailed architecture, runbooks, or findings. It explains
which documents matter, which statements are current, where evidence lives,
and which production decisions must not be accidentally reversed.

This repository controls real-money trading. Start read-only. Do not infer
exchange state from a config file, a locally copied health snapshot, or an old
runbook in isolation.

## Executive state

The project is a production HYPEUSDT trading and data system whose primary live
strategy is a long DCA/Martingale ladder. It also contains transactional close
handling, S/R actions, maker-TP execution, market-data collectors, read-only
strategy shadows, Discord controls, and an alert-only operational watchdog.

Current intended production state:

- The main HYPE long ladder is live.
- Long-side Bybit ownership is `positionIdx=1`.
- The main ladder uses a transactional maker TP for ordinary TP/stale-TP closes.
- S/R resistance partial exits and the narrow support-reopen exception are live.
- The damaged-regime latch is live and blocks entries/adds only when active.
- Main-bot hedge execution is disabled.
- The dedicated HYPE short owner remains online on `positionIdx=2` for
  reconciliation and health, but **new entries are paused**:
  `enabled=true`, `entryEnabled=false`.
- The original short shadow and BPV short shadow remain online and read-only so
  forward evidence continues accumulating.
- The old SUI PF0 runout owner was proved locally and exchange-flat, deleted
  from PM2, and the new PM2 topology was saved on 2026-09-04. Do not resurrect
  it as part of a routine deployment.
- The HYPE operational watchdog is read-only and alert-only. It never trades,
  writes control signals, or restarts PM2.

Latest Git commit at handoff:

```text
db4fda1 Pause HYPE short entries after forward replay
```

The operator confirmed the pause on the VPS: short owner healthy, exchange
quantity zero, no local position/pending/recovery, shadow online, watchdog
clean, and PM2 saved. A later local sync through September 4 approximately
19:02 UTC also shows `entryEnabled=false` and a healthy, flat short owner. It
shows 11 long rungs with a resting maker TP and synced long quantity. These are
dated copied observations, not a live exchange connection. Recheck embedded
timestamps before using local snapshots as current fact.

## Mandatory reading order

Read these in order before acting:

1. [`AGENTS.md`](AGENTS.md) — mandatory analysis, aggregate-evidence,
   no-lookahead, scope, and live-change discipline.
2. This handover — current production deltas and document precedence.
3. [`PROJECT-ONBOARDING.md`](PROJECT-ONBOARDING.md) — detailed system and
   repository map, updated for the maker activation and short pause.
4. [`CLAUDE.md`](CLAUDE.md) — broad build and legacy architecture reference.
   It predates several current transactional and operational components.
5. The relevant file under [`docs/operations/`](docs/operations/) before any
   deployment or process action.
6. The newest relevant document under `research/` before proposing a strategy,
   sizing, gate, or exit change.
7. Current config, source, state, health, logs, PM2 and exchange evidence for
   the exact surface being touched.

## Truth and authority hierarchy

Use the following hierarchy, while remembering that transaction safety depends
on agreement between several authorities:

1. Bybit position/order/execution evidence establishes actual exchange state.
2. Durable local state establishes bot intent, applied receipts, and what must
   be reconciled idempotently.
3. Current checked-in source and config establish intended behavior.
4. Fresh atomic health snapshots establish observed runtime behavior.
5. PM2 establishes which owners and observers are actually running.
6. Logs establish event sequence and error context.
7. Research findings establish what has been tested, proven, or falsified.
8. Runbooks describe the approved procedure but may contain a stale status
   sentence; verify their commands against current config and code.

Never resolve an exchange/local disagreement by choosing whichever source is
more convenient. Enter recovery, gather exact evidence, and follow the owning
coordinator's reconciliation path.

## Documentation currency and research preservation

The September 4 documentation pass corrects the old armed-short and
disabled-maker statements in onboarding/runbooks. The PM2 runbook labels its
July table as historical and records later operator-confirmed changes. CLAUDE
now points to the current tests and research entry points rather than prescribing
the old `$1200` base.

See [research preservation](research/README.md) for the source/findings bundle,
the local-only data boundary, and reproduction gaps. Several older research
references below remain local archive documents; the index distinguishes them
from the selected Git bundle. Source preservation is not proof of replay parity.

The short revalidation report's 14-trade composition was corrected from four
TPs to two after checking the CSV; its PnL total and verdict are unchanged.

When a status statement conflicts, prefer the latest commit/config plus fresh
VPS and exchange evidence. Do not silently edit runtime state to make an old
document appear correct.

## Repository map

| Location | What it owns |
|---|---|
| `src/bot/index.ts` | Main HYPE lifecycle, loop, gates, exits, reconciliation and integrations |
| `src/bot/strategy.ts` | Core long-ladder decisions |
| `src/bot/executor.ts` | Bybit execution boundary and normalized results |
| `src/bot/state.ts` | Durable main `bot-state.json` state |
| `src/bot/long-transaction*.ts` | Durable long intents, receipts and full-close coordinator |
| `src/bot/partial-close*.ts` | Durable S/R partial-close state and coordinator |
| `src/bot/maker-tp*.ts` | Transactional post-only TP ownership and fallback |
| `src/bot/long-side-guard.ts` | Prevents overlapping long-side mutations |
| `src/bot/context-manager.ts` | Hydrated, gap-checked rolling 5m context |
| `src/technical-engine.ts` | Multi-timeframe indicators and S/R inputs |
| `src/bot/sr-*.ts` | S/R memory, shadows and support-reopen qualification |
| `src/bot/damaged-regime-latch.ts` | Persistent damaged-regime entry/add block |
| `src/bot/hl-short-breakdown-*.ts` | Frozen original HYPE short signal and read-only shadow |
| `src/bot/hl-short-live*.ts` | Dedicated transactional HYPE short owner/state |
| `src/bot/hl-short-transaction-coordinator.ts` | HYPE short exchange/local transaction owner |
| `src/bot/hl-short-bidpullvolume-*.ts` | Independent BPV short candidate; read-only shadow only |
| `src/bot/operational-*.ts` | Pure health evaluation, watchdog and durable incident lifecycle |
| `src/data-collector.ts` | Bybit/Binance market streams |
| `src/hyperliquid-collector.ts` | HYPE Hyperliquid market streams |
| `scripts/` | Focused safety tests, causal replays, audits and sync tooling |
| `docs/operations/` | VPS/process/feature deployment and recovery runbooks |
| `docs/research/` | Research-tool documentation, including the event atlas |
| `research/` | Allowlisted findings/ledger; other experiments remain local/ignored |
| `backtests/` | Generated replay evidence; local/ignored |
| `data/` | Locally synced production streams and health snapshots |
| `logs/` | Application and copied PM2 logs |

## Main HYPE long ladder

Authoritative desired configuration: [`bot-config.json`](bot-config.json)

Current headline parameters:

- live HYPEUSDT, Bybit hedge-mode long side `positionIdx=1`;
- base position `$800`, scale factor `1.35`, maximum 11 rungs;
- 30-minute adds or a 0.3% price-drop trigger;
- normal batch TP 1.4%; after 4 hours, reduced TP 0.5%;
- hard flatten after 12 hours when average PnL is at or below -2% and trend is
  hostile;
- emergency kill at -14%;
- 4h EMA trend gate, BTC risk-off, five-red/two-green regime breaker,
  overextended-entry filter, add throttle, deep-add stress guard, and persistent
  damaged-regime latch;
- main hedge disabled;
- maker TP enabled;
- S/R partial-exit action enabled;
- S/R support-reopen action enabled, but outer gates remain authoritative.

Always reread the JSON and loader defaults rather than relying on this summary.

### Long transaction invariants

These are non-negotiable:

- Accepted orders are not assumed filled.
- Intent is persisted before submission.
- `not found` alone is ambiguity, not rejection.
- Fills use exact order/execution evidence and deduplicate execution IDs.
- Local position/PnL changes commit only after confirmed fill evidence.
- Terminal partial fills apply pro-rata state math before residual handling.
- Full close is final only after exchange/local residual quantity agrees within
  instrument tolerance.
- Restart uses the same resolver as normal runtime.
- One coordinator owns exchange submission, resolution, local commit, pending
  cleanup, and recovery for each transaction family.
- Every mutation must coordinate with maker TP and `LongSideGuard`.

Read before touching this boundary:

- `research/codex-transactional-close-reconciliation-safety-audit-2026-07-11.md`
- `research/codex-9d70564-close-stack-rereview-2026-07-12.md`
- `research/codex-long-transaction-cleanup-implementation-plan-2026-07-12.md`
- `research/codex-long-transaction-cleanup-implementation-closure-2026-07-12.md`
- `research/codex-recent-partial-flatten-audit-2026-07-16.md`
- [`docs/operations/maker-tp-live.md`](docs/operations/maker-tp-live.md)

## S/R and regime protection

The S/R action path depends on continuous recent 5m coverage, production-style
confirmed pivots, and the exact live context. S/R actions fail closed when
coverage is unhealthy; ordinary TP, forced exits and reconciliation continue.

Useful references:

- [`docs/operations/sr-support-reopen.md`](docs/operations/sr-support-reopen.md)
- [`docs/operations/damaged-regime-latch.md`](docs/operations/damaged-regime-latch.md)
- `research/codex-hype-sr-latest-regime-audit-2026-08-04.md`
- `research/codex-hype-rung11-daily-high-delay-findings-2026-08-20.md`
- `research/codex-hype-current-regime-ladder-pause-findings-2026-08-14.md`
- `research/codex-hype-user-drop-precursor-findings-2026-08-14.md`
- `research/codex-hype-trendlock-timing-audit-2026-08-11.md`

Human-labelled chart events can be converted into causal visual research with
the pair-agnostic event atlas:

- [`docs/research/event-atlas.md`](docs/research/event-atlas.md)
- `scripts/event-atlas.ts`
- `research-inputs/event-atlas/`

Use the atlas to generate hypotheses, never as direct permission to change live
configuration. Any numeric rule still needs full eligible-timestamp replay,
monthly stability, no-lookahead tracing, and untouched evidence.

## Dedicated HYPE short: paused entries

Authoritative desired config:
[`hl-short-live-config.json`](hl-short-live-config.json)

Current state is deliberately:

```json
{
  "enabled": true,
  "entryEnabled": false,
  "notionalUsdt": 25000,
  "leverage": 25
}
```

`enabled=true` keeps the sole transactional `positionIdx=2` owner online for
reconciliation, protection, recovery and health. `entryEnabled=false` blocks
new orders before `executeOpen`. Do not stop this owner merely because entries
are paused. Keep the signal shadows running to accumulate counterfactual data.

Why it was paused:

- 20 actual completed shorts: 7 wins / 13 losses, -$3,891.07 net;
- the same executed signals replayed near -$3,780 configured / -$4,230 stress;
- the untouched causal cohort was 14 exact trades and -20.544% stress;
- the full May–September replay remained profitable in-sample, alongside
  severe forward deterioration;
- no predeclared causal trend/regime suspension preserved old/monthly edge and
  improved both exact and one-minute-delay forward paths.

Read:

- `research/codex-hl-short-regime-revalidation-findings-2026-09-04.md`
- `research/codex-short-signal-results.md`
- [`docs/operations/hl-short-live.md`](docs/operations/hl-short-live.md)
- [`docs/operations/hl-short-breakdown-shadow.md`](docs/operations/hl-short-breakdown-shadow.md)
- [`docs/operations/hl-short-bidpullvolume-shadow.md`](docs/operations/hl-short-bidpullvolume-shadow.md)
- `scripts/hype-hl-short-regime-revalidation.ts`

Do not deploy a broad “block shorts in uptrends” patch from intuition. That
family was tested in the September 4 replay and failed stability. A replacement
requires a newly frozen hypothesis and new untouched evidence. Do not create a
second HYPE short owner.

## Maker TP

Ordinary and stale long TP can be owned by a post-only reduce-only maker order;
forced/emergency/operator exits remain market-first. The native/limit handoff,
partial fills, cancellation races and residual fallback are transactional.

Current desired config is `bot-config.json -> makerTp.enabled=true` with maker
fee 0.02% and a 2-second touch grace. Key commits:

```text
feed21d Add transactional maker TP execution
95fd9c6 Arm transactional maker TP
63a9adb Normalize native TP restoration to tick
```

Read [`docs/operations/maker-tp-live.md`](docs/operations/maker-tp-live.md), then
the maker transaction/coordinator tests, before touching this code. Never
replace the permanent market fallback or weaken exact order-contract checks.

## Operational processes

The VPS uses Node 24.18.1, npm 11.16.0 and PM2 6.0.14. PM2 persistence is owned
by `pm2-deploy.service` and `/home/deploy/.pm2/dump.pm2`.

Core current HYPE processes include:

- `hedgeguy-bot`
- `commander`
- `alarm-HYPEUSDT`
- `bybit-collect`
- `hl-collect`
- `hype-health-watchdog`
- `hype-hl-short-shadow`
- `hype-hl-short-bpv-shadow`
- `hype-hl-short-live` — online, entries disabled
- `hype-maker-tp-shadow`

Treat that as orientation, not an executable manifest. Always run
`pm2 ls --no-color`. Several non-HYPE alarms are intentionally stopped, and a
separate stable-corridor process may appear in the same PM2 namespace. Never
run `pm2 restart all` or resurrect a stopped legacy owner without explicit
authorization.

After an intentional topology change, inspect the final list before `pm2 save`.
PF0's state and logs remain historical evidence even though its process was
removed.

Primary runbooks:

- [`docs/operations/pm2-vps.md`](docs/operations/pm2-vps.md)
- [`docs/operations/vps-capacity.md`](docs/operations/vps-capacity.md)
- [`docs/operations/vps-data-sync.md`](docs/operations/vps-data-sync.md)
- [`docs/operations/hl-short-live.md`](docs/operations/hl-short-live.md)
- [`docs/operations/maker-tp-live.md`](docs/operations/maker-tp-live.md)
- [`BOT-COMMANDS.md`](BOT-COMMANDS.md)

Main-long filesystem controls are separate from the short-entry flag:

- `bot-pause` blocks new long adds while protective exits continue;
- `bot-flatten` requests a transactional full long close and then pauses;
- `bot-resume` clears the main-long pause;
- `hl-short-live-config.json -> entryEnabled=false` blocks new dedicated shorts.

Do not use one control as a substitute for another, and do not delete a signal
file merely to silence a log without first understanding whether the bot has
consumed it.

## Runtime evidence

Important files:

| File | Meaning |
|---|---|
| `bot-state.json` | Durable main long state, pending intents, maker TP and receipts |
| `data/HYPEUSDT_runtime_health.json` | Main process, websocket, context, TP intent, reconciliation and transaction health |
| `data/HYPEUSDT_hl_short_live_state.json` | Durable dedicated short receipts and transaction state |
| `data/HYPEUSDT_hl_short_live_health.json` | Short owner, protection, pending and exchange-quantity health |
| `data/HYPEUSDT_hl_short_breakdown_shadow.jsonl` | Original short decision/signal/outcome journal |
| `data/HYPEUSDT_hl_short_breakdown_shadow_health.json` | Original short-shadow heartbeat and coverage |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow*.json*` | BPV candidate journal/state/health |
| `data/HYPEUSDT_maker_tp_shadow*.json*` | Maker fill-observer journal/state/health |
| `data/HYPEUSDT_operational_watchdog_state.json` | Durable incident lifecycle state |
| `data/collector_health.jsonl` | Collector health observations |
| `logs/` | Application logs |
| `logs/pm2/` | Copied PM2 stdout/stderr logs |

Local data is a copied snapshot, not a live mount. Pull it before incident or
performance analysis. Follow [`docs/operations/vps-data-sync.md`](docs/operations/vps-data-sync.md):

```bash
cd /mnt/c/Users/emile/dev/Venzen/venzen-finance/reverse-copy
export REVERSE_COPY_REMOTE="deploy@46.225.80.0"
bash scripts/pull-vps-data.sh --dry-run
bash scripts/pull-vps-data.sh
```

Inspect embedded source timestamps, not Windows modification times. A clean
rsync does not by itself prove exchange or process health.

## Research discipline

The main objective is to maximize durable profit from HYPE within what is
actually proven. It is not to maximize the number of strategies or react to the
latest visible loss.

Before recommending a live strategy change:

1. Reproduce the unchanged baseline over the identical window.
2. Use UTC epoch milliseconds and only data available at decision time.
3. Trace at least one decision end-to-end for lookahead.
4. Report event count, net PnL after costs, maximum drawdown and per-month delta.
5. Test execution perturbation where applicable, including one-minute delay and
   stress fees.
6. Account for invisible upside: extra TP cycles, avoided cascades and signals
   a blocker would remove.
7. Require an explainable mechanism and no materially worse historical month.
8. Put candidates through forward shadow observation before live use.
9. Record falsified ideas in `research/codex-short-signal-results.md` or the
   relevant findings ledger.

Recent losses can motivate research. They do not authorize threshold tuning.
If nothing passes, say so and keep the negative result.

Canonical/recent research entry points:

- `research/codex-short-signal-results.md` — short-candidate/falsification ledger
- `research/codex-hl-short-regime-revalidation-findings-2026-09-04.md`
- `research/codex-hype-rung11-daily-high-delay-findings-2026-08-20.md`
- `research/codex-hype-current-regime-ladder-pause-findings-2026-08-14.md`
- `research/codex-hype-user-drop-precursor-findings-2026-08-14.md`
- `research/codex-hype-trendlock-timing-audit-2026-08-11.md`
- `research/codex-hype-sr-latest-regime-audit-2026-08-04.md`
- `research/fable-5-profitability-lever-survey-2026-08-12.md`

Selected research sources/findings are designated for version control.
`backtests/`, raw streams and runtime state remain ignored and need a separate
private backup. A fresh clone will not reproduce the local evidence library
automatically; use `research/README.md` and the dated provenance manifest.

## Verification by change surface

Baseline checks:

```bash
npm run build
npx tsc --noEmit --pretty false
npx tsc -p tsconfig.vps.json --noEmit --pretty false
git diff --check
```

There is no single comprehensive test command. Select all suites touching the
changed boundary.

Long transactions and partial closes:

```bash
npx ts-node scripts/long-state-transaction-tests.ts
npx ts-node scripts/long-transaction-coordinator-tests.ts
npx ts-node scripts/long-executor-transaction-tests.ts
npx ts-node scripts/partial-close-transaction-tests.ts
npx ts-node scripts/long-side-guard-tests.ts
```

Maker TP:

```bash
npm run test:maker-tp
```

Short execution:

```bash
npm run test:hl-short-live
```

Operational health:

```bash
npx ts-node scripts/operational-health-tests.ts
npx ts-node scripts/operational-watchdog-tests.ts
npm run watchdog -- --once --dry-run
```

Event-atlas research:

```bash
npm run test:event-atlas
```

Research harnesses run locally, not on the production VPS. Record the exact
data cutoff, inputs, fees, timing and parity totals in every findings document.

## Deployment boundary

- Production is `/opt/bybit-rev`.
- Build before restarting a compiled process.
- Restart only the named process affected by the change.
- Inspect pending/recovery/position state before stopping any execution owner.
- Snapshot durable state before transaction/state migrations.
- Prove local/exchange quantity sync; do not assume it.
- Keep intentionally stopped processes stopped.
- Never use `pm2 restart all`.
- Run the read-only watchdog after deployment.
- Save PM2 only after verifying the final intended topology.
- Never commit or paste `.env`, credentials, webhooks, raw PM2 environments, or
  unnecessary account details.

Live config changes require explicit user authorization. An analysis request is
not permission to edit production config, submit an order, restart a process,
or deploy a candidate.

## Current local worktree warning

At the original handoff the worktree contained pre-existing, user-owned local
changes and untracked research. The documentation/preservation pass adds to
that work. Do not reset, clean, stage or commit it wholesale.

Tracked modifications visible at handoff:

```text
.gitignore
PROJECT-ONBOARDING.md
docs/operations/vps-capacity.md
package.json
```

Untracked work includes `research-inputs/`, the event-atlas scripts, several
HYPE replay/audit scripts, and
`scripts/hype-hl-short-regime-revalidation.ts`. Inspect ownership and purpose
before committing any subset. The files selected for preservation are listed
in `research/README.md` and the provenance manifest; allowlisting does not
itself stage or commit them. Use path-limited `git add` and review the staged
diff every time. The existing `vps-capacity.md` and `package.json` changes must
not be silently included as unrelated documentation cleanup.

## Safe first task for a new model

The best first task is a read-only state and documentation audit:

1. Read the mandatory files above.
2. Run `git status --short` and do not alter existing changes.
3. Inspect current config and the latest locally synced health timestamps.
4. State what is live, paused, shadow-only, stale or unknown.
5. Identify the exact runbook and tests for one proposed task.
6. Make no code, config, PM2 or exchange changes until the user approves that
   task's scope.

## Ready-to-paste first prompt

```text
You are taking over reverse-copy, a live Bybit HYPEUSDT trading system. Start
read-only. Read AGENTS.md, MODEL-HANDOVER-2026-09-04.md,
PROJECT-ONBOARDING.md, CLAUDE.md, current configs, and the relevant operations
runbooks. Then inspect git status and the timestamps/content of the latest local
health snapshots.

Report:
1. the current long, maker-TP, S/R, damaged-regime, and short states;
2. which statements are verified production facts versus stale local/docs;
3. the execution owner and Bybit positionIdx for every live trading surface;
4. the five most important safety invariants;
5. the exact files/tests/runbook you would use for the next requested task.

Do not change code, config, PM2, state, or exchange state. Preserve all existing
worktree changes. Do not propose a live strategy change from recent events
without reproducing aggregate causal evidence.
```
