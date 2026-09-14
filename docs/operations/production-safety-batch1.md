# Production safety: first implementation batch

Date: 2026-09-14. Status: locally tested maintenance release; deployment pending.

Plan: [Astra's response to the production review](../../research/codex-astra-production-review-response-and-plan-2026-09-14.md).
This implements **1A, 1B, 1C and 2**, not the entire plan. Review this boundary before extending it.

## What changes

| Boundary | Before | After |
| --- | --- | --- |
| Position/leverage open rejection | Five-minute sleep inside the long mutation guard | Five-minute entry-only deadline; normal polling, risk checks and guard acquisition continue |
| Manual `bot-pause` | Main loop skipped reconciliation and several risk exits | Pause is enforced after the exit stack; no new adds, including a late pause detected around maker quiescence |
| Runtime position cap | Repeated full config loads could throw or import startup defaults; file existence could falsely grant an override bridge | One strict read per eligible add-evaluation cycle; retain last validated base cap on failure; matching, typed override only |
| Unreadable/corrupt state | Could fall back to an empty account | Fatal startup error before executor creation; original bytes preserved |
| Missing state in main live/paper mode | Implicit empty initialization | Refuse startup; require explicit operator recovery/initialization |

The rejection classification remains the existing case-sensitive `position`/`leverage` substring match. The retry deadline is in-memory operational state: restart may retry a known rejection, but cannot bypass a durable unresolved order. It does not change `lastAddTime`, strategy cooldowns or receipts.

The cap remains the **only** hot-reloaded config field. Invalid/missing files retain the last valid base, not a temporary override. A valid override still works during a base-config read failure, and one-shot reset returns to the last valid base. Matching-symbol overrides require an integer cap of 1–25 and a boolean `oneShot`. Warnings repeat on changed error or after five minutes; failure to write that warning is non-fatal.

Manual flatten retains precedence. An existing operator pause is never automatically removed. **Paused positions may now close from eligible emergency, funding, hard-flatten, S/R partial or Aggressive10 exits.** This repairs the documented adds-only contract; it is a material operational change, not merely a logging change.

## State-loading boundary

The loader checks critical persisted types before defaults/migrations: inventory, accounting numbers, pending intents, allocations, receipts, maker ownership, profile and recovery fields. Future unsupported schema versions fail closed. This is shape validation, not proof that otherwise well-typed values match exchange reality; reconciliation is still mandatory.

Valid older state remains supported, including missing optional legacy fields, a legacy null damaged-regime latch and version-1 maker intent migration. State loading itself never writes a migration, substitutes a backup, submits an order or rewrites damaged evidence.

`StateManager` retains explicit new-state initialization for existing offline/test callers. Main `live` and `paper` modes pass `requireExisting: true`. Other callers also fail on corrupt existing files; genuine absent-file initialization keeps its prior default behavior.

If startup refuses state:

- Preserve the file and logs; do not delete state, clear receipts or generate an empty account to bypass the check.
- Stop the failed owner if it is restart-looping. This is an operator action, not automatic remediation.
- Verify actual positions/protection and executions since the last trusted snapshot. A flat exchange alone does not establish complete accounting or receipt history.
- Select/reconstruct authoritative state only through a reviewed recovery procedure. Do not copy an old backup over newer fills.

## Files to review

- [Main loop](../../src/bot/index.ts): entry-boundary pause/backoff, override wiring, strict exchange-mode state loading.
- [Entry availability helpers](../../src/bot/entry-availability.ts): retry deadline, override validation, last-good cap.
- [Config loader](../../src/bot/bot-config.ts): shared unchanged merge/profile validation plus strict runtime-cap read.
- [State loader](../../src/bot/state.ts), [critical shape validator](../../src/bot/state-load-validation.ts): fatal loading and preserved migrations.
- [Loop tests](../../scripts/main-loop-availability-tests.ts), [cap/backoff tests](../../scripts/entry-availability-tests.ts), [state-load tests](../../scripts/state-load-safety-tests.ts).

No strategy thresholds, live configs, transaction coordinator, maker-TP pricing/fees, collector, commander or VPS process changed. Pre-existing unrelated edits remain outside this batch. New files must be included if this is later committed; tracked-file diff statistics omit them.

## Verification completed locally

Both typechecks passed:

```text
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/typescript/bin/tsc -p tsconfig.vps.json --noEmit --pretty false
```

21 suites passed. Run each with `node -r ts-node/register scripts/<name>-tests.ts`:

```text
entry-availability
main-loop-availability
state-load-safety
long-state-transaction
long-transaction-coordinator
long-executor-transaction
long-close-finalizer
partial-close-transaction
long-side-guard
executor-normalization
maker-tp-transaction
maker-tp-coordinator
aggressive10-policy
aggressive10-crash
damaged-regime-latch
context-manager
sr-context-safety
sr-support-reopen
runtime-health
operational-health
operational-watchdog
```

The loop harness extracts the **actual production while-loop and mutation wrapper** via TypeScript AST and executes them with fake clocks/clients. It does not import/boot the entry point or access live signal files. Tests cover baseline/Aggressive10 paused exits, paused reconciliation and S/R partial, manual-close priority, late pause, rejected-open guard release and retry prohibition, retained unknown intent, malformed cap reload, override bridging and reset. Dependencies are stubbed: this is control-flow integration coverage, not a real exchange end-to-end test. The WS-related assertion proves the real guard is immediately acquirable after rejection; it does not simulate Bybit delivery.

State tests include an actual fatal child-process load, malformed JSON/types, simulated EACCES, missing live state, preserved legacy/maker migration and unchanged corrupt bytes. Existing Aggressive10 tests passed 18 crash/race cases, including 10 real child-process exits and four timestamp-evidence rejection checks.

The latest local mirrored state loaded read-only: 11 rungs, active maker, no pending, 64 long receipts. File bytes were unchanged. This is **not** a fresh VPS/exchange reconciliation or deployment approval.

## Still outstanding

This section records the batch-1 checkpoint. The included [batch 2](production-safety-batch2.md) and [batch 3](production-safety-batch3.md) describe subsequent work and remaining limits.

**Next: 1D, market-data availability.** Failed/hung candle requests and other awaited work can still delay exits. This patch removes the explicit pause/backoff suppression; it does not make the whole loop non-blocking. Next patch needs single-flight bounded requests, explicit finalized-window readiness, no promotion of stale forming OHLC into finalized evidence, and reject/hang tests. Unknown required trend inputs must block adds without suppressing independent price-based risk exits or inventing a trend-dependent flatten.

Performance/error telemetry comes before tail-reader memory optimization. Recovery protection, commander allowlisting, collector continuity and archive-aware rotation remain separate planned reviews. No duplicate Aggressive10 context alert or strategy retuning is included.

## Deployment boundary (after review/commit)

Use [PM2 preflight](pm2-vps.md) and [maker-TP runbook](maker-tp-live.md). Build/test first while existing risk management runs. Until this patch is deployed, **the old manual pause still skips main-loop downside exits**; do not leave an open ladder paused through a long unattended build.

Use a brief monitored preflight: fresh health, exact inventory agreement within lot tolerance, state snapshot, no pending/recovery, known maker/native protection, and no unresolved maker touch/cancel/partial/close request. Recheck immediately before restarting **only `hedgeguy-bot`**. Do not restart collectors/shorts or automatically clear an existing operator pause.

After restart verify retained inventory/profile/receipts, maker ownership, fresh runtime, quantity reconciliation and watchdog dry-run. Do not claim this first batch resolves the remaining candle-fetch availability risk.
