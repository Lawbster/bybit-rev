# Aggressive10: activation and carry-in deployment

Status: 2026-09-11. User authorized activation after the release replay and causality audit. The checked-in HYPE flag is **enabled for the next fresh ladder**; loader/template defaults remain off. Existing maker TP remains enabled; shorts remain entry-disabled. A repository commit is not proof of VPS activation.

Frozen candidate: `age10__minus_deep_stress__minus_tp_cooldown`. Research context is in [AGGRESSIVE-10H-CANDIDATE.md](../../research/AGGRESSIVE-10H-CANDIDATE.md). The local September 11 release checkpoint ran 52 replays with exact archived controls and maker/fallback scenarios. Net improved in all 20 paired main comparisons; drawdown improved in 12 and worsened in 8. The user accepted that trade-off and authorized this activation; this does **not** reclassify the failed individual-month screen as a pass or prove forward profitability. Candle/policy timing tests passed; exact historical pulse receipt and maker queue behavior remain unproven. Detailed parity/causality findings and raw replay artifacts remain in the local research library, not prerequisites for a VPS build.

## Exact changes for candidate ladders

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

`bot-config.json` contains `"aggressive10": { "enabled": true }`. Omitted flags still mean off. The loader rejects malformed flags and requires the frozen HYPE/4h/1.4%/0.5% basis when enabled. Do **not** change global `exits.staleHours`, `deepAddStressGuard` or `tpCooldown`: the stored per-ladder profile applies the candidate differences.

- The flag selects the **next fresh ladder**, not an existing carry-in ladder.
- Selection and TP phase are persisted in `bot-state.json.aggressive10Ladder` before a new open. Pending orders, recovery and existing maker owners prevent profile selection.
- Disabling the flag does not switch an existing candidate ladder midway through its life. Its stored profile continues until flat. Startup validates the basis even when the flag is off but an existing profile remains.
- Full-close receipt finalization clears the profile. Existing cooldowns are never shortened.
- Do not delete the profile, cooldown or pending fields to force rollback. Do not run an older binary against an active candidate profile or pending high-exit policy.

**Current eleven-rung carry-in:** leave it on its existing baseline profile and maker TP. Enabling the flag does not extend its stale TP, give it the new high exit, or remove its gates. Partial closes/re-adds remain the same ladder. Only after it is completely flat and its transaction/maker owners are finalized can the next ladder select aggressive10. No flatten or state migration is needed to deploy this config.

## Closed-candle data and priority

The high reference requires exactly 2,880 continuous completed 1m OHLC candles. It includes the candle that just closed, not the forming candle. Decision timestamps are UTC minute boundaries. No synthetic gap filling or daily-high approximations are used.

Public candle hydration is background/single-flight, bounded to three requests per refresh. Cold startup normally needs three pages; healthy operation requests the latest few candles once per new minute. Retries are at least 10s apart. It never waits in the trading loop; the disabled profile makes no requests.

The new exit may act only in the first 30s after the minute closes, with healthy coverage and a fresh WebSocket feed. This is a freshness allowance, not proof of zero execution delay. The release replay included additional high-exit fill delay and temporary coverage-loss scenarios; they do not reconstruct historical delivery.

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

Activation regressions additionally cover omitted/explicit off/on flags and an eleven-rung baseline ladder with a confirmed stale TP and active maker order: restart/enable writes no state, maker partial fills do not adopt the profile, flat inventory with an unfinalized owner still cannot adopt, and only completed owner finalization permits the new profile. Disabling again preserves an already-started candidate ladder.

The crash suite uses persisted fake exchange state and actual child-process termination. Ten kill points cover intent-before-submit, accepted market, applied market fill, completed receipt, maker close request before cancel, cancellation, maker-to-market handoff, maker partial fill, native-race handoff and fully filled maker receipt. Additional cases cover ambiguous cancellation, rejection, full maker race, a native close predating the request, missing timestamps, preservation of longer cooldowns and invalid policy rejection before mutation. Separate checks reject incomplete/mismatched timestamp evidence.

Also run the existing long state/coordinator/executor/finalizer, maker state/coordinator, partial-close, long-side guard, executor normalization, operational health/watchdog, runtime and S/R safety suites. All tests are offline. These are process-crash tests, not a claim of storage durability through host/disk power loss or a live-exchange soak test.

## Deploy with an active baseline ladder

Run one block at a time in VPS SSH, **not local PowerShell**. Stop on any error; do not use shell-wide `set -e` (previous sessions exited on failed checks). Keep the main bot running during the build so exits remain managed. Restart only the main owner at the end; never `pm2 restart all`.

### 1. Pause new adds; inspect and back up

```bash
cd /opt/bybit-rev
test -e bot-pause && echo "Already paused: preserve that operator pause"
touch bot-pause
sleep 15
pm2 logs hedgeguy-bot --lines 30 --nostream
jq '{rungs: (.positions | length), pendingOrder, recoveryMode, aggressive10Ladder,
  maker: (.makerTpOrder | {phase, orderLinkId, appliedQty, touchedAt, closeRequest, fallbackDeadlineAt})}' bot-state.json
jq '{ageSeconds: ((now * 1000 - .writtenAt) / 1000), reconciliation,
  transaction, recovery, makerTp, desiredLongTp, positions}' data/HYPEUSDT_runtime_health.json
cp bot-state.json "$HOME/bot-state.pre-aggressive10.$(date -u +%Y%m%dT%H%M%SZ).json"
cp bot-config.json "$HOME/bot-config.pre-aggressive10.$(date -u +%Y%m%dT%H%M%SZ).json"
git status --short
```

Expect fresh telemetry, `pendingOrder=null`, recovery false, matching exchange/local long quantity and a normal active maker owner with no touch/close/fallback underway. Verify the corresponding reduce-only long TP is still present on Bybit; do not cancel it. Existing untracked state backups are harmless. If pending, recovery, partial/touched/cancelling maker activity or a mismatch appears, leave paused and resolve it before restarting. Pause blocks adds, **not exits**, so a TP/partial can still occur during these steps.

### 2. Pull and verify the activation flag

```bash
git pull --ff-only
jq -e '.aggressive10.enabled == true and .makerTp.enabled == true' bot-config.json
```

Stop if pull failed or there are unexpected config edits. Do not overwrite them or apply a blanket stash/reset. Build/test before restarting:

```bash
npm run build &&
npx tsc -p tsconfig.vps.json --noEmit --pretty false &&
npx ts-node scripts/aggressive10-policy-tests.ts &&
npx ts-node scripts/aggressive10-crash-tests.ts
```

### 3. Recheck transaction state and restart only after all tests passed

```bash
jq -e '.pendingOrder == null and .recoveryMode == false and
  (.makerTpOrder == null or (.makerTpOrder.phase == "active" and
    .makerTpOrder.appliedQty == 0 and .makerTpOrder.touchedAt == null and
    .makerTpOrder.closeRequest == null and .makerTpOrder.fallbackDeadlineAt == null))' bot-state.json &&
pm2 restart hedgeguy-bot
sleep 45
pm2 logs hedgeguy-bot --lines 100 --nostream
```

Do not clear any state to make the check pass. Startup must reconcile the retained maker owner and long quantity. A normal active maker order is not a reason to flatten.

### 4. Verify the running profile and health

```bash
jq '{ageSeconds: ((now * 1000 - .writtenAt) / 1000), aggressive10, makerTp, reconciliation, transaction, recovery, desiredLongTp, positions}' data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
```

Require a new process start in the logs, a fresh runtime snapshot (normally <=10s), `configured=true`, reconciliation synced, no pending/recovery, and healthy existing maker protection. If startup hydration takes longer, wait for these checks rather than restarting repeatedly.

| Situation | Expected `aggressive10` telemetry |
|---|---|
| Original eleven-rung ladder still open | `configured=true`, `active=false`, `policyId=null`; existing TP stays in force. High coverage can be unhydrated while inactive. |
| Fully flat with all owners finalized | Profile can become `active=true` before rung 1. Requires healthy 2,880-bar high context before opening. |
| New candidate ladder started | `configured=true`, `active=true`, expected policy ID, healthy high context. |

The expected `main_process_restarted` warning can take around two minutes to clear. Require no other unresolved incidents; rerun the dry-run after it clears. If a TP happened during deployment, inspect the receipts/new inventory rather than insisting the old rung count is still eleven.

This activation changes no watchdog code relative to the already-deployed `4029d80`; no watchdog/collector/short restarts are needed. Existing short entries stay paused.

### 5. Resume only after clean checks

If the pause was created for this deployment (not an earlier operator decision):

```bash
touch bot-resume
sleep 15
pm2 logs hedgeguy-bot --lines 30 --nostream
pm2 save
```

Confirm the pause cleared. Trend/regime/cooldown gates can still legitimately prevent new entries. The baseline carry-in does not become aggressive10 merely because it was resumed.

## Rollback boundary

Pause new adds, set only `aggressive10.enabled=false` in a separately reviewed config change and restart with the same transaction checks. That prevents selection for future ladders; **it does not undo an already active candidate profile**. Do not edit the stored profile, maker/pending ownership or cooldown. Do not restore a backup state after subsequent exchange fills. Use current transaction-capable code for any active candidate; no downgrade to a pre-profile binary.

## Activation commit scope

Only these files change; do not include unrelated local collector/research edits:

```text
bot-config.json
scripts/aggressive10-policy-tests.ts
docs/operations/aggressive10-live.md
```

No runtime implementation, package/dependency, collector, indicator, research-output, short-config or existing maker-config changes are required for activation. The frozen implementation was already deployed disabled.
