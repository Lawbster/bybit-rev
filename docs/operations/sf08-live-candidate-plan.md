# SF08 SFP: live candidate and coexistence plan

2026-09-21. Status: operator-selected implementation candidate; not armed or
deployment-approved. Request: assess running the ladder and SF08 concurrently
and prepare implementation. This document does not change live configuration.

Implementation update: the disabled first version is now built. See the
[SF08 operating guide](sf08-live.md) for implemented boundaries, verification,
and remaining gates. This plan is not deployment approval.

## Decision

Both strategies can run in this repo and on the same VPS. Recommended account
layout: existing ladder on its current account; SF08 on a dedicated Bybit
standard subaccount with its own credentials, collateral and position owner.

Two independent HYPE long bots on the **same account are not supported by the
current architecture**. Both would own `positionIdx=1`. Distinct order IDs or
API keys on the same account do not create distinct positions. The paused
short owner uses `positionIdx=2`; this does not provide a second long slot.

| Layout | Feasibility | Required work |
|---|---|---|
| Same VPS/repo, dedicated SF08 subaccount | Recommended | New SFP owner with isolated state/account; reuse infrastructure |
| Same account, concurrent longs | Possible only after redesign | Single long execution owner, strategy allocation ledger and coordinated protection for combined inventory |
| Same account, SF08 only while ladder flat | Different strategy | Mutual exclusion across both owners and a new occupancy replay; not SF08 concurrent operation |

Observed code conflicts on the same account:

- `src/bot/index.ts`, startup reconciliation around line 4095, compares the
  entire exchange Buy quantity with ladder inventory; an unrecognized long can
  be imported under recovery. SF08 size would produce a mismatch.
- `src/bot/executor.ts`, `setPositionTp`, uses full-position native TP. Ladder
  recovery/fallback protection could close both strategies at the ladder target.
- Maker TP and long transaction coordination allocate reductions against ladder
  rungs. `reduceOnly` prevents increasing exposure, but does not isolate strategies.
- `LongSideGuard` is an in-process guard; another independent process does not
  share it. Giving the second bot different order IDs does not resolve this.

For a same-account design, every entry, partial, TP, stop, recovery import and
external fill would need one account/symbol/side coordinator. Aggregate quantity
must equal the sum of strategy inventories; protection must use bounded quantities
instead of full-position exits; fees and realized results require virtual-lot
allocation. This is a larger ladder migration, not the recommended first release.

## Frozen candidate and evidence

References:

- [SF08 findings](../../research/codex-astra-sfp-latest-candles-findings-2026-09-21.md)
- [Original SF01 specification](../research/range-low-sfp-sf01.md)
- [SF07 sizing limitations](../../research/codex-astra-sfp-5pct-sizing-findings-2026-09-21.md)
- Local accepted job: `backtests/sfp-latest-candles/54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e/`.

Full period: 2024-12-27 through 2026-09-21 00:22 UTC. Recent: 2026-06-01
through the same cutoff. Fixed notional; DD denominator starts at $32,000.

| Window / setup | Wins / losses | Net | Adverse DD |
|---|---:|---:|---:|
| Full, original stop, $10k | 44 / 79 | $2,842.23 | 7.92% |
| Full, SF08 5% padding, $10k | 66 / 36 | $11,709.71 | 5.29% |
| Full, SF08 5% padding, $20k | 66 / 36 | $23,419.41 | 9.01% |
| Recent, original stop, $10k | 13 / 11 | $1,549.55 | 2.47% |
| Recent, SF08 5% padding, $10k | 16 / 5 | $3,447.03 | 3.06% |
| Recent, SF08 5% padding, $20k | 16 / 5 | $6,894.05 | 5.92% |

Independent saved-ledger check today: all 22 SF08 artifact hashes match.
The primary $10k ledger has $23,616.20 winning PnL, -$11,906.49 losing PnL,
average loss -$330.74 and worst loss -$963.06. Exit counts: 49 targets,
7 stops, 46 timeouts. A timeout can win; the 66 wins are not 66 TP hits.

These are historical development results, with 0.055% taker fees per side,
before funding. SF08 completes an existing trade; it adds no newly confirmed
post-cutoff entry. Prior monthly and recent-DD screen failures remain. The
operator's candidate selection does not turn those failures into a screen pass.
No combined account, margin, liquidation or live-fill claim is established.

### Exact policy to reproduce

| Component | Frozen rule |
|---|---|
| Market / direction | Bybit HYPEUSDT linear perpetual, long only |
| Anchors | Completed UTC 4h bars; strict pivots with 2 bars on each side |
| Publication | Pivot after second right bar closes plus availability delay |
| Sweep | First 0.1% breach below known low, within 30 days; no reused first sweep |
| Range | Low at least 24h old; later already-published high >=2% above low, highest qualifying high; unconsumed before sweep |
| Reclaim | Completed 4h close above low within 24h after sweep bar ends; below still-unconsumed range high |
| Original stop S0 | Lowest sweep-through-reclaim low multiplied by 0.999 |
| Original eligibility | Reference-to-S0 risk between 0.2% and 5% |
| Target | Reclaim close C + 2 * (C - S0); fixed absolute target |
| Execution stop | S0 * 0.95, applied after original eligibility and target calculation |
| Entry | First eligible market action after confirmation availability; never the past sweep price |
| Hold | 24h from scheduled entry time; durable deadline, no restart/partial-fill extension |
| Occupancy | One SFP position or pending entry; signals during occupancy skipped, not queued |
| Other filters | No HL/RSI/EMA/POC additions, no ladder gates inherited |

Primary modeled source delay is 60s; 120s is the sensitivity. Retain actual receipt
times as well as the modeled minimum. A late bar cannot become an on-time signal.
At signal ties preserve the existing oldest-formation then event-ID ordering.
Intraminute target/stop closes do not free the same minute's open for a new entry.

The 5% is **not** a fixed 5% loss from entry. SF07 median entry-to-stop distance
is about 6.95%; the September 15 example is 6.18%. After padding, the target is
no longer 2R against the enlarged risk. Do not recompute target from actual fill
or padded stop, and do not silently impose a new 5% actual-risk cap.

## Implementation sequence

### 1. Shared policy and candle adapter

Reuse `scripts/setup-detectors/sf01-range-low.ts`, aggregation/pivots from
`scripts/setup-scan-core.ts`, and the SF08 `buildActions` policy from
`scripts/setup-replay.ts`. Extract only the pure functions needed under
`src/strategies/`; research callers import the same implementation.
Production must not import filesystem-heavy replay runners outside `src`.
Retain old accepted artifacts and source pins; compare exact event/action outputs
before accepting the extraction. No second detector or new replay engine.

Build a bounded closed-minute adapter using the existing Bybit candle collector,
availability and refresh machinery. Start with the detector's 32-day warmup,
prove rolling-boundary parity against the full saved scan, and persist consumed
pivots/attempt identities so rolling eviction cannot resurrect a sweep. Retain
pending reclaim anchors until resolved/expired, even across buffer eviction.
Evaluate on each newly available 4h boundary, not on every price tick.

Separate historical bootstrap from current decision receipts. Bootstrap can
restore old structure but cannot emit historical entries; later backfill retains
its retrieval time. Missing/late required bars block that signal with evidence.
Choose and test a finite entry window at the scheduled minute; after missed
availability or restart, expire the entry rather than replay old signals. Such
operational skips and quote/bracket rejection must appear in the parity report.

### 2. Subaccount execution owner

Implemented files: `src/bot/sfp-live.ts`, `sfp-state.ts`,
`sfp-coordinator.ts`, `sfp-live-config.json`; process
`hype-sfp-live`. One process can own its scheduled detector and trade lifecycle;
a second full-history scanner process is unnecessary.

Reuse the existing durable intent/receipt pattern, owner lock, exact fill
reconciliation, quantity/tick normalizers, fatal diagnostics and alert transport.
`LiveExecutor` accepts explicit credentials. Its long methods are reusable
boundaries, but the short coordinator and ladder coordinator are **not** generic
drop-ins: they encode short-side or rung inventory assumptions. Implement a small
single-position coordinator over proven execution primitives; share helpers where
their contracts match, with regression tests for the current owners.

- Require `BYBIT_API_KEY_LAWBSTER` / `BYBIT_API_SECRET_LAWBSTER` and expected
  account UID. Never fall back to main credentials. Preflight verifies the actual
  authenticated UID is the configured SF08 account and differs from the ladder's.
  Credentials name the account, not the strategy; future setup owners can use
  this alias, but cannot independently own the same account/symbol/side.
- Bind durable state/locks to account UID, symbol, side and policy version.
  Reject a second owner, changed account, incompatible active policy or corrupt state.
- Dedicated state, journal, health and log paths. Alerts include `SF08` and
  account alias so they cannot be mistaken for ladder closes. No shared bot-state,
  maker state, pause file or ladder cooldown mutation.
- Explicit account mode/hedge-side validation. Reuse `positionIdx=1` only on the
  isolated SF08 account. Never silently change the main account's mode/leverage.
- Config ships `enabled=false`, `entryEnabled=false`. `entryEnabled=false`
  suppresses new signals while protection, reconciliation and timeouts continue.
- Persist event ID, scheduled entry, original/ref/padded prices, rounded order
  prices, deadline and order identity before exchange submission. Unknown API
  results remain owned pending intents; never submit another entry from uncertainty.
- One market buy; partial execution creates only the filled exposure. Verify
  account/side/quantity, reconcile executions idempotently and protect that quantity.
- Install exchange-native TP **and SL**, LastPrice triggers to match the candle
  basis, with market execution. Attach provisional fixed-price protection to entry
  where supported, verify and repair after execution. Protect any partial fill.
  Test tick rounding explicitly; do not shift targets with the fill price.
- Missing protection triggers bounded immediate repair attempts, then an owned
  reduce-only close if verification still fails. Source outages block entries but
  do not suspend timeout/exit management. Native TP/SL remain during process downtime;
  a timed exit still requires an operating process, so overdue timeout is an alert.
- Native fill versus timeout races settle once by exact executions; residual
  quantity remains owned until confirmed flat. Unrecognized exchange inventory
  enters recovery for review rather than being attributed to a historical signal.
- Begin with modeled taker-style exits. Ladder maker TP is not silently reused;
  SFP maker execution would need a separate fill and ownership validation.

### 3. Capital and portfolio qualification

Operator update, 2026-09-21: the dedicated account is available; planned transfer
is $5,000 to SF08, leaving approximately $18,000 on the ladder account. Treat
these as the intended split-capital replay inputs, pending actual balances and
transfer confirmation. The transfer is not additional external funding. Account
selection/funding intent does not authorize entries or establish capital adequacy.

At the $10k reference trade notional, the saved SF08 worst realized loss of
$963.06 is 19.26% of $5k; average losing trade $330.74 is 6.61%, and median
initial entry-to-stop dollar risk $694.49 is 13.89%, before exit costs/funding.
At $20k those dollar risks double. These are single-trade capital ratios, not
recomputed portfolio drawdown. The earlier 5.29% DD must not be reused for $5k.

The nominal full ladder ($800, factor 1.35, 11 rungs) is $59,757.37. A 14%
loss on that notional is $8,366.03, or 46.48% of approximately $18k, before
fees/funding/slippage. This is an exposure illustration, not a predicted loss
or proof that every ladder reaches the emergency exit. Agg10 can exit earlier.
Verify the actual current sizing and post-transfer margin before deploying.

Use $10k notional as the implementation/reference setting; retain $20k as the
already-measured sizing alternative. Neither is an armed sizing decision here.
Before arming, record actual subaccount capital, margin mode and leverage.
Recompute equity/DD on that capital and include fees, funding, maintenance margin,
liquidation distance and adverse execution. Do not transplant the $32k-account DD.
In particular, copying the ladder's 25x setting with only minimum initial margin
can liquidate a position before this wider stop. Verify liquidation remains beyond
the stop with a buffer under actual account/risk-tier conditions.

Reuse the current causal ladder replay and frozen SF08 signals for a combined
calendar. Compare current Agg10 alone with Agg10 + SF08 at $10k/$20k, same cutoff,
capital basis and costs. Also show a split-capital control if SFP funding comes
from the ladder account; moving collateral can alter the ladder's feasible path.
For additional external funding, show the larger total starting capital explicitly.
No implicit transfers, margin sharing or extra capital from the $32k study account.

Report both account curves plus their aligned sum, monthly wins/losses and amounts,
combined MTM drawdown, simultaneous exposure, losing-trade overlap, funding, capital
shortfalls and skipped entries. Confirm unchanged ladder baseline parity. Two
long systems may lose together even with exchange-account separation.

### 4. Parity and crash verification

Required before funding/arming:

1. Incremental live-style feed reproduces frozen SF08 event IDs, decisions,
   brackets, ties, skipped signals and expiry at 60/120s clocks. Future poisoning,
   missing/delayed candles, rolling warmup and restart cutpoints are covered.
2. Tick/quantity rounding, actual fills, stale quotes, target/stop already crossed,
   signal expiration and late submissions are traced against modeled execution.
   Exact next-minute-open fills are a simulation convention, not a live promise.
3. Persist-before-submit crashes; accept/response loss; partial fills; duplicate
   executions; rejected/cancelled orders; native TP/SL versus timeout races;
   unresolved position mismatch; malformed state; process lock; wrong account key.
4. Both owners active in the same test harness with separate mock account books:
   SFP open/exit/stop cannot alter ladder quantity, maker TP, pause or state. An
   attempt to configure identical account identities must fail preflight.
5. Prove deadline persistence: research schedules 24h from entry action (including
   modeled action delay), not from a later acknowledgement/restart. Define live
   scheduled entry once and never extend it while resolving an uncertain order.
6. Existing ladder/maker/short tests and both production typechecks pass after
   shared-helper changes. Measure added VPS memory, CPU and API traffic with bounded
   data; do not load research tapes or the complete map on each poll.

### 5. Deployment stages

Build and review with execution disabled. Create/fund the selected subaccount and
configure its credentials outside git. Run UID/mode/instrument/position/order
preflight; confirm subaccount inventory is empty. Observe the live detector with
entries disabled and compare decisions/receipt timing; complete controlled
execution and recovery tests before arming. Record a forward-observation decision
explicitly: existing repo guidance calls for 30-60 days; a shorter route requires
an explicit operator exception and does not imply historical screen failures passed.

Add `hype-sfp-live` health/watchdog coverage, labelled Discord events and state/log
paths to the existing sync/runbook. Arm only after the chosen notional/collateral,
portfolio replay and deployment checks have been reviewed. The ladder can remain
open during subaccount deployment; it does not need flattening or a restart just
to introduce this independent process. Stopping entries must retain the SFP owner
until all exposure and pending/recovery state are settled.

## Verification performed for the original plan

Read the exact detector, action construction, replay deadline/occupancy handling,
ladder reconciliation, full-position TP and short owner contracts. Verified 22
saved artifact hashes and independently totaled the 102-trade primary ledger.
No full replay rerun or exchange mutation was necessary. The preceding commit
passed the SF01 detector/research-tape tests and both typechecks; that is existing
infrastructure evidence, not proof of the subsequently implemented SFP owner.
Local health is only a synced snapshot, not a fresh exchange/account preflight.
The operating guide records the new implementation tests separately.

## Exchange references

- [Bybit position indexes and full/partial protection](https://bybit-exchange.github.io/docs/v5/position/trading-stop)
- [Order creation and position-side parameters](https://bybit-exchange.github.io/docs/v5/order/create-order)
- [Standard subaccounts: API trading and segregated PnL](https://www.bybit.com/en/help-center/article/FAQ-Standard-Subaccount)
- [Subaccount funds are isolated](https://www.bybit.com/en/help-center/article/How-to-Manage-Funds-in-Unified-Trading-Account)
- [Leverage depends on position/margin mode](https://bybit-exchange.github.io/docs/v5/position/leverage)

Official documentation checked 2026-09-21. Account permissions, supported mode,
HYPE instrument filters and risk tiers must be checked again during preflight.
