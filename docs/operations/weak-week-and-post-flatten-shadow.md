# Weak-week exit and post-flatten SFP observation

Built 2026-09-25. **Operator approved deployment; VPS deployment not yet verified.** Main ladder only; unrelated to
the separate LAWBSTER/SF08 owner. Existing 21h hard flatten remains unchanged.

The checked-in HYPE config now selects `timeStop.mode: "live"` and
`postFlattenSfpShadow.enabled: true`, per the operator's explicit deployment
request. Activation occurs on main-owner restart, including an existing Agg10
ladder. The Sep25 11:00 UTC snapshot did not satisfy the weak-week condition;
that is not a guarantee about prices at deployment time. Code defaults below
remain off for configurations that omit these fields.

## Defaults and approval boundary

```json
"timeStop": { "mode": "off" },
"postFlattenSfpShadow": { "enabled": false }
```

Omitted settings have the same defaults. Settings load at main-owner startup,
not by hot reload. The time stop accepts only `off`, `shadow`, `live`; thresholds
are frozen in the shared predicate, not an untested runtime parameter sweep.
No extra history fetch or observer state write occurs while both are off.

An optional staging step is `shadow` plus observer enabled. This records decisions
but cannot execute a time stop or re-entry. The operator has instead approved
the live time stop after the offline verification below. Do not enable it on
an old Agg10 ladder without inspecting its current age and conditions: unlike
the Agg10 profile migration, this rule can fire on an already-open Agg10 ladder.
Legacy carry-in ladders without the durable Agg10 profile are excluded.

The SFP component has **no live switch, order API, or entry-veto capability**.
Implementing its all-rung reload remains outside this release.

## 40h weak-week rule

Same `evaluateTimeStop` predicate used by ELV01:

- Oldest **surviving** rung age >=40h.
- Closed-minute gross PnL <=0%, using sum(notional)/sum(qty).
- Closed-minute price <= the exact minute close seven days earlier.

Use the existing Agg10 snapshot only with complete closed-minute coverage and
its <=30s decision window. Historical minute lookup is background, single-flight,
bounded and backed off; one successful request prefetches up to60 reference
minutes. No interpolated/hourly substitute. Missing inputs suppress only this
new exit; independent exits remain available. No REST wait is added before exits.

Priority: existing ordinary exits/SR partials and the Agg10 high exit precede this
rule. A pending owner, recovery, changed inventory, stale executable price, active
maker close request, or already-hit TP refuses the new close. These checks are
repeated inside the long mutation guard.

Live capability reuses `flattenLadder`, the transactional full close, and maker
cancel/market-residual fallback. `weak_week_time_stop` is persisted in the close
intent before submission. Its 4h-boundary cooldown commits with the completed
fill: `(floor(finalExecutionTime / 4h) + 2) * 4h`; existing longer cooldown wins.
Missing exact execution time uses the existing conservative observation fallback.
Restart/disable does not erase an in-flight intent's consequence. Ambiguous
cancellation or missing orders never authorize duplicate submission.

A maker/native TP that wins this new rule's race remains a TP and gets no
time-stop cooldown. Existing Agg10-high cooldown semantics are unchanged.
Confirmed closes use the existing Discord close notifier with the actual reason.
Shadow candidates go to daily JSONL, not Discord; repeated fires are coalesced
per inventory/condition episode in memory. Restart can repeat a shadow log row;
it cannot submit while mode is `shadow`.

## Post-flatten SFP observer

Receipts, not the pre-submit `flatten` log, arm observations:

- Full-flat, owned market completion for `HARD FLATTEN:` or `EMERGENCY KILL:`.
- Agg10 profile, exact final execution timestamp, matching inventory/quantity.
- Durable pre-cancel/pre-submit **surviving rung notionals**, not the original
  geometric sizing schedule. Partial maker prefix plus market residual are
  combined, subtracting maker fills already accounted for at request time.
- Maker/native TP races do not arm a forced-close wait. Missing timestamps,
  legacy/incomplete receipts or conflicting attribution are unscorable.
- Partial prefix receipts never arm a second wait. Receipt identity deduplicates
  linked completions and survives observer restarts.

The observer follows each eligible close for up to24h, using the existing 48h
minute cache (no new collector/process). At every completed minute it abandons
if close >= forced-fill price *1.03. Expiry is strictly age **>24h**, matching PF60.
At UTC hourly boundaries, require21 complete hours: the latest hour sweeps the
lowest low of the preceding20 hours and closes strictly above that low, while
its close is <= forced-fill price. Equality at the sweep/reclaim does not qualify.

Signals include the frozen notionals, original close identity, signal time,
observation delay, and whether the real ladder is already open. A signal seen
late is labelled late; it is not a backdated executable entry. Missing minute
or hour history makes that observation unscorable rather than inventing a path.

This is **signal observation, not portfolio PnL**: the real bot does not enforce
PF60's24h first-rung veto. Multiple observed waits and real re-entry can therefore
diverge from the research portfolio. Signal logs do not claim margin approval,
entry fills, profitability, or an executable simultaneous reload. Offline scoring
must reuse the complete ladder replay.

The research reload bypasses several entry gates, including the damaged latch.
That live bypass, sizing/margin checks, durable wait/veto, one-order-to-many-rung
allocation and reload crash recovery still need separate approval/build work.

## Files, health and alarms

- `data/HYPEUSDT_runtime_health.json`: `.timeStop`, `.postFlattenSfpShadow`.
- `logs/time_stop_YYYY-MM-DD.jsonl`: first candidate per condition episode.
- `logs/HYPEUSDT_post_flatten_sfp_YYYY-MM-DD.jsonl`: `armed`, `signal`, expiry,
  abandonment and unscorable evidence.
- `data/HYPEUSDT_post_flatten_sfp_state.json`: observer-only waits, seen receipts
  and durable outbox. Never edit the trading `bot-state.json` to repair it.
- Existing VPS pull script already includes these data/state and log files.

Observer outbox delivery is at-least-once. Consumers **deduplicate journal `id`**
after a crash between append and acknowledgement. Its corrupt sidecar disables
only the observer and raises health; it is not silently reset. Do not run a second
writer for this observer state. The main process remains the sole owner.

Watchdog warnings: `time_stop_inputs_unavailable` after >3min while age-eligible;
`post_flatten_sfp_shadow_degraded` for observer I/O/state/context failures.
Neither performs automated trading. Ordinary shadow signals do not send alerts.

```bash
jq '{timeStop,postFlattenSfpShadow,reconciliation,transaction,recovery,makerTp}' \
  data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
```

## Verification and staging

Local verification passed on 2026-09-25:

- Full build and VPS typecheck; whitespace check.
- Shared predicate/history, runtime modes/freshness/race guards, config validation.
- Time-stop crash suite: 18 cases, 10 actual child-process exits and 4 rejected
  timestamp-evidence checks. Existing Agg10 suite also remains green.
- Forced-close observation exercised through the same 10 process-exit points;
  surviving notionals and combined prefix/residual evidence survived recovery.
- 15 observer cases: receipt causes, missing evidence, partial maker aggregation,
  restart/dedup, journal acknowledgement failure, late observation, corruption,
  gaps, abandonment, expiry and live-portfolio divergence; plus hourly causality.
- Existing long state/coordinator/finalizer, maker state/coordinator, partial
  close, Agg10 policy, runtime health and operational watchdog/health regressions.

Offline only; no keys or exchange calls needed:

```bash
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run test:time-stop
npm run test:time-stop-live
npm run test:post-flatten-sfp
npx ts-node scripts/aggressive10-crash-tests.ts
npx ts-node scripts/aggressive10-crash-tests.ts --observer
npm run test:maker-tp
npx ts-node scripts/operational-health-tests.ts
```

Reuse [Agg10 deployment preflight](aggressive10-live.md#deploy-with-an-active-baseline-ladder):
preserve any intentional pause, build while the owner still manages exits, inspect
pending/recovery/maker ownership, back up state/config and restart **only
`hedgeguy-bot`** after a clear preflight. Restart the watchdog separately to load
its new warnings. Do not restart LAWBSTER, collectors or retired short services.
Preserve the intentionally armed VPS `sfp-live-config.json` during pulls.

For default-off deployment, require fresh synced health, no pending/recovery,
unchanged position quantity and TP ownership, `.timeStop.mode == "off"` and
`.postFlattenSfpShadow.enabled == false`. Do not remove an operator's existing pause.

For this approved activation, expect `.timeStop.mode == "live"` and
`.postFlattenSfpShadow.enabled == true` instead. Recheck the current week return
and gross/age telemetry. A legitimate forced close can occur during verification;
do not interpret its resulting flat state as a quantity mismatch. Confirm its
completed receipt, reconciliation and cooldown. An existing pause does not
prevent exits. No SFP reload is authorized or implemented.

Rollback is config `off`/`false` with the **new code retained** until any new-format
pending close resolves. Do not roll old binaries back over an in-flight time-stop
intent, delete its policy, clear recovery, or edit its cooldown manually.

## Evidence boundary

[ELV01](../../research/codex-astra-exit-live-policy-elv01-findings-2026-09-25.md)
already verified the full HYPE policy and shared predicate across40 paths,
including34 exact archived path matches. That financial evidence is reused here,
not re-labelled as a new trial. Tests here verify runtime wiring/ownership,
not historical maker fills, live exchange latency, or a profitable forward period.
The weak-week rule remains post-hoc and fails the existing monthly screen in the
primary model. Operator approval to deploy does not mean that screen passed.
