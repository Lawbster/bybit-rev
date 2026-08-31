# Transactional maker TP

Status: implemented behind an explicitly disabled live flag. Live execution
behavior is unchanged; activation remains a separate reviewed decision.

## Objective

Replace ordinary long-ladder TP and stale-TP market exits with a resting
post-only, reduce-only sell limit when that order is healthy. Preserve the
current market close as the permanent fallback. Forced, emergency, funding,
drawdown, and operator exits remain market-first.

This is execution optimization only. It must not change ladder sizing, entry
gates, TP percentages, stale timing, partial-exit policy, or strategy priority.

## Safety invariants

1. Persist maker intent before submitting it to Bybit.
2. Use one unique `orderLinkId` for every maker order and every fallback order.
3. Submission timeout or `not found` is ambiguous, never proof of rejection.
4. Apply fills from cumulative execution evidence and deduplicate execution IDs.
5. Commit every partial fill before calculating the residual quantity.
6. Market fallback quantity comes from verified exchange/local residual sync,
   rounded to instrument lot step. It never comes from the original request.
7. Cancel/replace is complete only after terminal order evidence and a residual
   quantity check. A cancel acknowledgement alone is insufficient because a
   final fill can race the cancellation.
8. `reduceOnly` protects the exchange position from flipping, but is not a
   substitute for correct local PnL and receipt accounting.
9. A full close is final only when exchange and local residual quantities match
   within half a lot step and all observed fills have durable receipts.
10. Restart reconciliation runs the same resolver used during normal runtime.
11. An unresolved maker order enters recovery and blocks new long mutations.
12. Existing forced-exit market behavior remains authoritative.
13. A terminal maker leg and its residual market-close intent are persisted in
    one atomic state write before the market order is submitted.
14. Every close request is durable before maker cancellation. Its reason,
    source, request time, and fallback deadline survive a process death.
15. The enable flag controls creation only. An existing maker owner is always
    resolved, observed, or transactionally retired even after the flag is off.
16. An active order is trusted only after Bybit confirms its exact side, type,
    post-only policy, reduce-only flag, position index, price, quantity, and
    leaves/fill reconciliation.

## Ownership

`pendingOrder` remains the single owner for short-lived long opens, transactional
partial closes, and market full closes. A resting TP cannot occupy it because
doing so would block every future ladder add.

Maker TP therefore receives a separate durable `makerTpOrder` state containing:

- maker order identity and requested price/quantity;
- the exact pre-order position allocation;
- cumulative maker fill quantity/notional and execution IDs;
- touch and fallback timing;
- durable close-request reason/source/timing;
- exchange-confirmed price, submitted quantity, and instrument tick;
- cancellation/replacement status;
- PnL/fee amounts already committed locally.

Completed maker legs receive bounded receipts so startup evidence cannot apply
the same exchange execution twice.

## State machine

```text
none
  -> intent_persisted
  -> active
  -> fully_filled -> commit full close -> none
  -> partially_filled -> commit delta -> cancel remainder
  -> cancel_requested -> resolve final fills
       -> terminal + synced residual -> market fallback
       -> ambiguous/mismatched -> recovery
  -> explicit_reject with zero fill -> native/current market path
```

TP replacement before an add or partial action uses the same cancellation
resolver. If any fill appears while quiescing, the strategy action is aborted
and the TP close is completed instead.

## Exchange protection

The existing native TP must not race a maker order at the identical trigger.
The implemented handoff sequence is:

1. Keep the current native TP while maker placement is unresolved.
2. Confirm the maker order's full exchange contract, not merely `New` status.
3. Clear the native TP only after that confirmation, then read the position
   back until the clear is exactly verified.
4. If the clear cannot be verified, restore and verify the exact native TP
   before cancellation. If neither state can be verified, retain maker
   ownership in recovery and block long mutations.
5. If the native TP wins the narrow handoff race, import only exact,
   non-receipted execution evidence; ambiguity remains in recovery.

Once the maker order is active it is itself durable exchange-side protection.
At TP touch, the bot grants a bounded passive-fill window and then cancels and
market-closes only the verified residual. No naked-position window is permitted
during arming or rollback.

## Fallback triggers

- explicit post-only rejection;
- touch grace expires without a complete fill;
- partial fill stops progressing;
- price reverses after touch;
- maker price/quantity must be replaced;
- any forced, emergency, drawdown, funding, or operator close;
- terminal maker degradation with a synchronized residual;
- startup finds a terminal partial maker transaction.

Ambiguous submission, cancellation, or order lookup never initiates a blind
fallback. It retains durable ownership in recovery until exchange evidence is
conclusive.

## Delivery stages

### Stage A: durable primitives

- maker transaction types and receipts;
- state persistence and idempotent cumulative fill application;
- detailed executor placement/cancel/observation methods;
- no call-site or configuration activation.

### Stage B: coordinator

- ensure, observe, quiesce, replace, touch, and fallback operations;
- exchange/local lot-step reconciliation;
- exact combined maker + market close result;
- restart resolver.

### Stage C: main-bot integration

- ordinary and stale TP use the coordinator;
- every add/partial/forced path quiesces maker ownership first;
- startup and periodic reconciliation resolve maker state first;
- runtime health and watchdog coverage;
- disabled-by-default configuration and startup banner.

### Stage D: activation review

- all fake-executor crash points pass;
- TypeScript and existing long/partial transaction suites pass;
- live maker execution remains disabled;
- deploy code disabled, confirm health, then arm in a separate reviewed config
  change.

## Configuration and activation boundary

The checked-in `bot-config.json` and the loaded default are both explicitly
disabled:

```json
{
  "makerTp": {
    "enabled": false,
    "makerFeeRate": 0.0002,
    "touchGraceMs": 2000
  }
}
```

Enabling it is a separate live-config action. Before doing that, the bot must be
flat or have `pendingOrder=null`, `makerTpOrder=null`, recovery disabled, and an
exact exchange/local long quantity match. After restart, verify the startup
banner, a confirmed native TP followed by `Maker TP armed`, the runtime-health
`makerTp` block, and a clean watchdog dry-run.

Rollback is also transactional. Disabling the flag prevents new maker creation
but does not hide an existing owner from startup, the periodic resolver, forced
closes, or the watchdog. The resolver first restores and verifies the exact
native TP, then cancels and terminally reconciles the maker. Never manually
cancel the exchange order and delete local maker state independently.

The checked-in 2-second touch grace remains an unactivated engineering default,
not a profitability conclusion. Activation still requires forward evidence or
a bias-free replay showing that the chosen grace improves net execution after
fees without unacceptable missed-fill or adverse-selection cost.

## Required crash tests

- crash before submit, after exchange acceptance, and after submit timeout;
- crash after a maker partial fill but before local commit;
- crash after local commit but before state cleanup;
- cancel acknowledgement racing a final fill;
- cancel timeout with order still active;
- TP replacement while a fill lands;
- partial maker fill followed by full market fallback;
- fallback submission timeout and restart resolution;
- native TP wins the race and exchange is already flat;
- operator/forced flatten while maker order is active;
- process death after durable close request and exchange cancellation but before
  the maker-to-market state transition;
- active partial fill without a WebSocket bid-touch event starts its own durable
  fallback deadline;
- feature disabled with an existing owner restores verified native protection
  before cancellation, or retains maker recovery if verification fails;
- active-order contract mismatch fails closed;
- startup with active, filled, cancelled, rejected, not-found, and ambiguous
  maker states;
- repeated resolver calls do not duplicate quantity, PnL, fees, or alerts.
