# Aggressive10: disabled implementation and release checks

Status: 2026-09-11. Implemented **off by default**, not armed. Existing maker TP remains enabled; shorts remain entry-disabled. No deployment, exchange calls or live state edits were performed during implementation.

Frozen candidate: `age10__minus_deep_stress__minus_tp_cooldown`. Research context is in [AGGRESSIVE-10H-CANDIDATE.md](../../research/AGGRESSIVE-10H-CANDIDATE.md). Engineering tests do not override its failed individual-month screen or establish forward profitability. Current-stack/maker-fee economic validation is a separate pending checkpoint.

## Exact changes when subsequently armed

| Component | Existing stack, flag off | Aggressive10 ladder |
| --- | --- | --- |
| Size | $800, multiplier 1.35, max 11 | Unchanged |
| Normal TP | 1.4% | Unchanged; TP can close before 10h |
| Soft-stale TP | Baseline 4h eligibility, reduced target 0.5% | Defer that reduction until oldest remaining rung reaches 10h; then follow baseline target selection |
| Near-high exit | Absent | Full close at age >=4h, completed-minute close within 1% of rolling 48h high |
| Deep funding stress timer-add gate | Enabled | Disabled; this does not remove outer trend/regime/risk gates |
| Hot-RSI post-TP cooldown | Enabled | Disabled |
| New high-exit cooldown | Absent | Preserve researched boundary: `(floor(fillAt / 4h) + 2) * 4h` |
| Maker TP | Existing execution stack | Same stack; high exits use its forced market-fallback route |

The high exit has no profit floor. It can deliberately realize a loss. It is not a new entry filter, an automatic 10h flatten, or a mandatory 10h hold. The soft-stale deferral is one-way per ladder: removing the oldest rung cannot re-arm an already released deferral.

## Profile and activation safety

`bot-config.json` contains `"aggressive10": { "enabled": false }`. Omitted flags also mean off. The loader rejects malformed flags and requires the frozen HYPE/4h/1.4%/0.5% basis when enabled.

- The flag selects the **next fresh ladder**, not an existing carry-in ladder.
- Selection and TP phase are persisted in `bot-state.json.aggressive10Ladder` before a new open. Pending orders, recovery and existing maker owners prevent profile selection.
- Disabling the flag does not switch an existing candidate ladder midway through its life. Its stored profile continues until flat. Startup validates the basis even when the flag is off but an existing profile remains.
- Full-close receipt finalization clears the profile. Existing cooldowns are never shortened.
- Do not delete the profile, cooldown or pending fields to force rollback. Do not run an older binary against an active candidate profile or pending high-exit policy.

## Closed-candle data and priority

The high reference requires exactly 2,880 continuous completed 1m OHLC candles. It includes the candle that just closed, not the forming candle. Decision timestamps are UTC minute boundaries. No synthetic gap filling or daily-high approximations are used.

Public candle hydration is background/single-flight, bounded to three requests per refresh. Cold startup normally needs three pages; healthy operation requests the latest few candles once per new minute. Retries are at least 10s apart. It never waits in the trading loop; the disabled profile makes no requests.

The new exit may act only in the first 30s after the minute closes, with healthy coverage and a fresh WebSocket feed. This is a freshness allowance, not proof of zero execution delay. The later release replay must include arrival/execution-delay sensitivity.

Missing coverage blocks **new entries/adds**, but never triggers a speculative high exit. Ordinary TP, emergency, funding, hard-flatten, operator exits and reconciliation continue. A warning is raised after 180s without healthy context. This exposure block is operational fail-closed handling; it was not a separately optimized research filter.

Ordinary exits and S/R partial actions run first. Before submitting a new high exit, the existing long-side guard rechecks pending/recovery, inventory identity, decision age, any existing maker close request, and whether ordinary TP has already hit. Drawdown kill retains precedence.

## Maker/native transaction handling

1. Save high decision facts and cooldown policy on the full-close intent, or on the maker close request **before** cancellation.
2. Use the existing maker cancellation resolver; an acknowledgement alone does not release ownership.
3. Account for maker partial fills before sizing the market residual. Residual quantity must reconcile with the exchange.
4. Transfer the maker receipt and residual full-close intent in one atomic state write, including when native TP wins the cancel race.
5. Import exact executions/PnL through the existing resolver. Do not account from a trigger price, quote or accepted order.
6. On full completion, persist receipt, cooldown and owner cleanup together. A restart cannot lose the cooldown after clearing pending or apply PnL twice.

The cooldown anchors to the last execution timestamp only when the execution aggregate has the exact order-link identity and complete filled quantity. Native evidence uses its exact execution timestamp. Without a complete timestamp, the receipt explicitly records `observation_fallback` and conservatively anchors to finalization time. A proven native close predating the high-exit request is not assigned a high-exit cooldown.

Missing orders remain ambiguous. A crash after intent save but before submit can therefore require operator recovery: **no blind resubmission or pending clear**. Rejected closes do not create a cooldown. Terminal partial market closes retain the existing partial-commit/recovery behavior; they are not treated as flat.

## Telemetry

- Runtime: `data/HYPEUSDT_runtime_health.json.aggressive10` reports configured/effective profile, TP phase, coverage, decision readiness, data errors and cooldown deadline.
- Decisions: `logs/aggressive10_YYYY-MM-DD.jsonl` records the exact completed-bar reference and `fire`. This is candidate evaluation, not proof an order was submitted or filled; confirm execution in transaction receipts/trade logs.
- State: `pendingOrder.closeCooldown`, `makerTpOrder.closeRequest.closeCooldown`; completed receipts include applied cooldown anchor/source.
- Watchdog: `aggressive10_context_unavailable` warning is alert-only. Existing pending/recovery incidents remain authoritative.

## Offline verification

No keys, private API calls or real orders are needed:

```bash
npx tsc --noEmit --pretty false
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npx ts-node scripts/aggressive10-policy-tests.ts
npx ts-node scripts/aggressive10-crash-tests.ts
```

Policy tests cover closed-bar boundaries, missing/invalid/future candles, 10h one-way semantics, current inventory not being adopted, persisted profile across restart/disable, bounded hydration, stalled-request single flight, cooldown boundaries and config validation.

The crash suite uses persisted fake exchange state and actual child-process termination. Ten kill points cover intent-before-submit, accepted market, applied market fill, completed receipt, maker close request before cancel, cancellation, maker-to-market handoff, maker partial fill, native-race handoff and fully filled maker receipt. Additional cases cover ambiguous cancellation, rejection, full maker race, a native close predating the request, missing timestamps, preservation of longer cooldowns and invalid policy rejection before mutation. Separate checks reject incomplete/mismatched timestamp evidence.

Also run the existing long state/coordinator/executor/finalizer, maker state/coordinator, partial-close, long-side guard, executor normalization, operational health/watchdog, runtime and S/R safety suites. All tests are offline. These are process-crash tests, not a claim of storage durability through host/disk power loss or a live-exchange soak test.

## Deploy code only: leave candidate OFF

Use the established main-bot deployment procedure. Before restarting, snapshot `bot-state.json`, confirm pending/recovery are clear, and verify current exchange/local long quantity and protection. An active normal maker order is not itself a reason to flatten; retain it for startup reconciliation. Preserve any existing operator pause.

After the reviewed commit is pushed, run on the VPS:

```bash
cd /opt/bybit-rev
git status --short
git pull --ff-only
jq -e '.aggressive10.enabled == false' bot-config.json
```

Stop here if pull failed, the flag is not false, or there are unexpected local config edits. Build/test before restarting:

```bash
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npx ts-node scripts/aggressive10-policy-tests.ts
npx ts-node scripts/aggressive10-crash-tests.ts
```

Only if all succeeded:

```bash
pm2 restart hedgeguy-bot
pm2 logs hedgeguy-bot --lines 100 --nostream
```

After startup reconciliation and fresh runtime telemetry:

```bash
jq '{ageSeconds: ((now * 1000 - .writtenAt) / 1000), aggressive10, makerTp, reconciliation, transaction, recovery, desiredLongTp, positions}' data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
```

Expect `aggressive10.configured=false`, `active=false`, no candidate profile, current maker settings unchanged, reconciliation synced, no unresolved transaction/recovery. The inactive feature's high-context coverage is expected to be unhydrated; it must not generate the new incident. Existing short services/config remain untouched. Observe the expected restart incident clear normally.

The watchdog evaluator change needs its own reviewed restart to load. After the main snapshot is healthy and dry-run is clean, restart only `hype-health-watchdog`; do not restart unrelated services. Arming is a separate approval after the economic replay, not part of these commands.

## Remaining release checkpoint

Replay the exact current baseline and candidate together at the same current-equity anchor, with full occupancy and fee accounting. Model maker fills, market fallback/native TP, partials and forced exits separately; do not apply a maker fee to every close or substitute average fee savings for execution behavior. Include target replacement, source/arrival delay and gap handling sensitivity. Report baseline alongside net, drawdown, wins/losses and monthly differences.

## Narrow commit scope

This workspace also contains unrelated existing edits and a large local research library. Do not use `git add .`. This implementation's files are:

```text
bot-config.json
src/bot/aggressive10-context.ts
src/bot/aggressive10-policy.ts
src/bot/close-cooldown.ts
src/bot/bot-config.ts
src/bot/index.ts
src/bot/state.ts
src/bot/long-transaction.ts
src/bot/long-transaction-coordinator.ts
src/bot/maker-tp-transaction.ts
src/bot/maker-tp-coordinator.ts
src/bot/runtime-health.ts
src/bot/operational-health.ts
scripts/aggressive10-policy-tests.ts
scripts/aggressive10-crash-tests.ts
scripts/operational-health-tests.ts
docs/operations/aggressive10-live.md
```

No package-script, collector, indicator, research-output, short-config or existing maker-config changes are required by this patch.
