# Aggressive10: activation and carry-in deployment

**Current, operator-confirmed October 12:** the ladder runs inside
`hype-portfolio-live`, live with entries paused on hypehedgeguy. The 07:03 UTC
status after deploying `2fcac75` shows one 9.15-HYPE rung and a verified $88.58
maker TP, but the minute feed is stuck at its October 10 bootstrap boundary.
The local journal catch-up fix is awaiting deployment; see the portfolio
runbook below. Keep entries paused until current candles and healthy status
are restored; the next eligible add still needs live verification.
`hedgeguy-bot` is stopped and must not run
alongside it. Main rules operate on ladder-owned rungs; quantity-owned maker TP
and conditional fallback replace full-side TP ownership. Repository portfolio
defaults remain disabled/observe, distinct from the armed VPS override.
Use the [current Ladder tab](live-strategy-overview.html#ladder) and
[portfolio runbook](portfolio-live.md), not the legacy activation steps below.
The earlier implementation-status and deployment paragraphs below are historical.

October 10 preparation update: the operator reports main entries paused and capital
consolidated into the existing ladder account for the planned shared portfolio.
The operator subsequently confirmed both owners paused, flat and without pending
orders; this is not a fresh exchange query or a stopped-process confirmation.
That owner is not deployable yet. Do not resume or clear the damaged-regime latch
as part of preparation; pausing does not close positions. Flat inventory, pending
transactions, orders and recovery must be checked before a later owner cutover.

October 11 implementation checkpoint: the shared-owner main execution controller
now passes simulation tests for owned rung accounting, maker TP/soft-stale policy,
S/R partials and restart-safe close cooldowns. The owned main policy/driver and
reused candle/pulse/S/R readers are now built and tested offline. Joint runtime
ordering, full economic parity, native fallback and the real account adapter
are **not complete**.
The existing main entrypoint/config has not changed. These tests are not a reason
to start the new owner or run it alongside the old one.

Read-only preparation check (old build supported): the standalone
`scripts/portfolio-vps-preflight.cjs` can be copied to `/tmp/` and run with Node
while the working directory is `/opt/bybit-rev`. It only queries the approved
account, checks pause markers and reports incomplete evidence explicitly; it
does not change leverage, orders, ownership or state. `readyToArm` is always
false. Use the builder handoff for its test evidence. Do not replace the armed
VPS-local SFP config or resume either owner to perform this check.

October 11 pagination correction: the operator's HYPE query returns the 25x
hedge pair followed by an empty terminal one-way placeholder. The checker now
retains that row but excludes it from mode/leverage checks only with identical
before/after evidence, established hedge rows, `seq=-1`, blank update time, zero
size/empty side and explicitly absent TP/SL/trailing protection. Other extra
rows still block. This changes the read-only checker, not the trading runtime.
Re-copy the script and re-run it; no leverage change or restart is required.

The operator subsequently returned `preparationChecksPassed=true`, no blockers
or errors, and only the expected placeholder warning. `readyToArm=false` remains
intentional. This is account preparation, not a cutover/venue execution certificate.

Latest implementation: `PortfolioSetupRuntime` now connects the six existing
setup/MACD policies' worker output to durable allocation, submission and timed
exits on the simulated account. Paused entries/missing indicators do not suspend
timeouts. The main policy/driver now evaluates the existing gates and exit
priority on owned rungs. Its joint ordering with setup allocation and historical
main feature/economic parity remain unverified.
There is no deployable portfolio daemon or real exchange transport yet.

### Approved isolated venue test — October 11

The operator approved preparing a foreground test on UID `555249668`: about $10
long, then about $10 short, sequentially. This is not approval to arm the portfolio.
Copy `scripts/portfolio-bracket-probe.cjs` and `scripts/portfolio-vps-preflight.cjs`
beside each other in `/tmp/`; run from `/opt/bybit-rev`. No pull/build is needed.

- `node /tmp/portfolio-bracket-probe.cjs --preview` is read-only (also the default).
- `node /tmp/portfolio-bracket-probe.cjs --inspect-orders` reads exact saved entry
  and child IDs from both realtime and history, without modifying the report or
  placing/cancelling orders. It is safe after an operator's manual cleanup.
- Before stopping owners, require fresh flat/no-pending/no-recovery health for
  both old bots and a passing account preflight. Keep both pause files present.
- Stop only `hedgeguy-bot` and `hype-sfp-live`. Other legacy trading owners must
  already be stopped; the probe checks PM2. Leave collectors/watchdog running.
- `node /tmp/portfolio-bracket-probe.cjs --execute-20-usd` checks the account again,
  records each intent before submission, attaches Partial TP/SL 5% away, captures
  parent-linked child evidence, cancels both known children and closes only the
  receipt-proven residual. It does not change leverage, strategy config or state.
- Success is `metadata_and_cleanup_passed`, two `observed_and_flat` sides. Keep
  the bots stopped and pauses intact; neither success nor `readyToArm=false`
  changes portfolio readiness. Save the stopped PM2 topology only after checks.
- Failure can leave a tiny position open. Inspect Bybit immediately and keep the
  owners stopped. Never delete the report, remove an ownership lock or repeat
  `--execute-20-usd` to force a retry. The drain-only mode is `--recover-only`;
  it observes original requests and cannot open another entry. Unknown children
  are never guessed/cancelled; an operator may have to resolve the position.

Evidence is saved in `data/HYPEUSDT_portfolio_bracket_probe.json` (checksummed;
no credentials). The test does not force TP/SL triggers and cannot certify OCO
races, production-size fills or liquidation safety.

October 11 actual probe result: both old writers were stopped and the PM2 list
saved. The long filled 0.11 HYPE; both quantity-matched Partial children were
observed with the correct parent link. After requesting their cancellation, the
probe stopped at `known_child_missing` before its close. The short was not opened.
The operator manually closed the tiny long and returned a passing fresh account
preflight with no blockers/errors. Keep both writers stopped and report intact;
**do not run recovery or execute again after this manual close**. It is not an
automatic cleanup success, a short-side certificate or an armed strategy.

Local correction: exact child-ID realtime plus historical lookup, bounded retry
of missing records, and retention of saved child identities. Absence/acknowledgment
never becomes terminal evidence. Twenty-seven probe tests pass, including lag,
conflicts, missing lineage, manual-close refusal and non-mutating diagnostics.
The precise first missing API response was not preserved. Bybit documents history
latency and exact-ID realtime queries of closed orders:
[history](https://bybit-exchange.github.io/docs/v5/order/order-list),
[realtime](https://bybit-exchange.github.io/docs/v5/order/open-order).

Subsequent operator inspection: both children are `Deactivated`, `CancelByUser`,
zero cumulative fills, with their original parent links intact in **both**
realtime and history. Thus protection ownership/cancellation is now witnessed
on the long side; immediate history availability and automatic long cleanup
were not proven. Both children report the same update time. The paired-cancel
race is regression-tested, not asserted to be universally guaranteed by Bybit.

The remaining originally approved ~$10 short now has an explicit isolated mode:

```bash
cd /opt/bybit-rev
node /tmp/portfolio-bracket-probe.cjs --execute-short-10-usd
```

First copy the latest CJS helper to `/tmp/`. No pull/build or restart. This mode
requires the original checksummed failed-long report, matching receipts within
the combined ~$20 entry budget, current terminal zero-fill child evidence, a
fresh clear account preflight, both old writers stopped and both pause files.
It can open **only one Sell entry**, then uses the corrected resolver and
receipt-backed reduce-only cleanup. It saves to
`data/HYPEUSDT_portfolio_bracket_short_probe.json`; it never overwrites or marks
the original manual-close report successful. An existing short report blocks
repeat execution. Thirty-four local probe cases pass.

**Operator result, October 11:** this separate short test returned
`metadata_and_cleanup_passed`, `complete:true`, one Sell `observed_and_flat`
with two children and `readyToArm:false`. The Buy seen afterward is the
reduce-only cleanup of that short. This is a successful short ownership,
cancellation and automatic-close test. It does not retroactively pass automatic
long cleanup, force native TP/SL triggers or certify production-size execution.
The evidence received here is the operator's summary; preserve the full VPS
report. Keep old owners stopped and pauses intact; no repeat test or restart.

On failure keep writers stopped and inspect Bybit. Do not repeat execution.
Short report inspection is `--inspect-short-orders`; its separate drain-only
mode is `--recover-short-only`, only if directed after reviewing actual state.
Do not use the old `--execute-20-usd` or `--recover-only` on the manually closed
long. Even a successful short test is not full portfolio arming approval.

Status update: 2026-09-25. Aggressive10 and maker TP are active in the Sep 25
11:00 UTC synced ladder snapshot. The operator subsequently confirmed the Sep 25
maintenance/exit deployment and resume; that later confirmation is not a fresh
exchange snapshot. The dedicated HL short is now disabled, separate from the
armed LAWBSTER SFP long. A repository commit is not proof of VPS activation.

For the complete operator-facing rule map, see the
[HTML strategy guide](live-strategy-overview.html) or its
[maintained Markdown source](live-strategy-overview-2026-09-25.md).

## Current exit additions and effective configuration

- Hard flatten is **21h AND gross ladder PnL <=-2% AND hostile 4h EMA trend**.
  The proposed 12h/-5% extra branch is not implemented.
- The **40h weak-week stop is live**: oldest surviving rung >=40h, completed-minute
  gross PnL <=0%, and price <= the exact minute close seven days earlier. It does
  not require hostile EMA trend. See the
  [weak-week stop runbook](weak-week-and-post-flatten-shadow.md) for guards,
  priority, missing-data handling and cooldown persistence.
- The post-flatten SFP observer is **read-only**, not automatic ladder re-entry.
- Agg10 still overrides the JSON deep-funding add guard and hot-RSI post-TP
  cooldown **off**. Its add throttle, outer entry gates, S/R profit partials,
  funding-spike exit and emergency kill remain active. The support-reopen
  exception has no operative funding block to override under this profile.
- Live S/R partials use the 30m/14-day map, not the researched historical 4h/1d
  maps. There is no live resistance-based rung-11 veto or half-size rung-11 rule.

The sections below retain the Sep 11 profile design and activation procedure;
the current exit additions above also apply to already-active Agg10 ladders.

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

**Historical Sep 11 eleven-rung carry-in:** it stayed on its baseline profile and
maker TP. That is not the current Sep 25 ladder: the later synced ladder has the
Agg10 profile. The migration rule still holds for any future baseline carry-in:
enabling the flag does not extend its stale TP, add the high exit, or remove gates.
Partial closes/re-adds remain the same ladder. Only after completely flat and
transaction/maker owners finalized can the next ladder select Agg10. No forced
flatten or state migration is required merely to deploy the profile flag.

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

## Planned shared-account owner — October 11, not a deployment

The earlier activation instructions above apply to the existing standalone main
owner, not the in-progress portfolio. Do not resume it alongside a new writer.
Operator reported both old owners paused/flat on October 10; verify fresh state
and process retirement again at cutover.

The portfolio's simulation-tested inventory boundary now isolates main rungs,
keeps the main intent-created age clock, and reuses selected/pro-rata allocation.
One quantity-owned maker or conditional order can protect those rungs. A durable
exit request waits for terminal cancellation evidence and imports racing fills
before sizing a residual close. Full passive fills finish immediately, including
inside the touch grace. No full-side native TP fallback is permitted on the shared
book. This is not yet connected to this runbook's main loop, gate stack, profile,
forced-close cooldown or finalizer; those semantics must remain intact at wiring.

Paired SF08/PA07 protection now has a simulation-tested attached-Partial path:
parent-linked child IDs, owned fill accounting, and both-sibling terminal proof
before any residual close. It does not use two independent pseudo-OCO orders.
No real exchange submission transport exists; Bybit pairing remains unverified.

Actual Bybit protection, common leverage/margin, paired setup TP/SL and full
integration/observation still require verification. Neither production execution
nor bot configuration changed. See the
[portfolio implementation checkpoint](../../research/codex-astra-hype-2026-three-slot-macd-builder-handoff-2026-10-10.md)
and [live overview](live-strategy-overview.html).
