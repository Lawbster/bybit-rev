# Persistent deep-add pulse gate

Completed [findings and paired/monthly comparisons](../../research/codex-astra-ladder-persistent-pulse-findings-2026-09-05.md).

September 5, 2026. Local research follow-up to the
[genuine-drop confirmation study](ladder-drop-pulse.md). No live state/config change.

## Frozen question

Does preserving a pulse veto across timer/S/R releases improve its protection?
Six variants only: the existing sell15, confirm_both and sr_confirm rules at
depth 11 or >=9. See the
[definition](../../research-inputs/sr-pulse-encounters/ladder-persistent-pulse-2026-09-05.json).
No new numerical thresholds, durations, sizing or exit policies. Compare against
both the unchanged baseline and each exact nonpersistent rule's previous replay.

Only a healthy, otherwise-approved **genuine price-drop veto** can arm a hold.
It owns that episode/next-depth slot. While armed, timer eligibility and leaving
resistance do not clear it. Sell15 clears above 0.85; confirm_both clears at
15m >=1.2 AND 1h >=1; sr_confirm additionally needs ret15m >0. The old S/R map is
needed to arm, not to remove this already-existing restriction.

Evaluation occurs only at otherwise-approved add opportunities, not during an
outer trend/recovery/affordability block. Release permits the original next-open
submission; it never creates a trade or bypasses any original gate. A subsequent
new bad genuine-drop opportunity can arm a new hold. No release cooldown added.

Episode or next-depth change resets the slot, including after partial/full exits.
The callback sees every otherwise-approved add, even below the experimental
depth, so an inventory change is observed before a new add can inherit a hold.
Exits remain independent. Missing data cannot arm and cannot release a hold.
That latter behavior differs from the old stateless rule's inactive-on-unknown
fallback; count it separately rather than claiming perfect one-factor isolation.

## Evidence contract

Same four overlapping, mined historical cases, repaired candles, baseline digests,
$32k model equity, $800x1.35 sizing, 0.055% per-side fees and TP assumptions.
No new engine seam. All previous sources and raw inputs are pinned, and prior
nonpersistent control artifacts are hashed. Pre-HL history cannot validate pulse
gates; unknown-before-arm remains inactive.

Record each eligible add decision and gate result so the complete state machine
can be replayed independently, plus first-veto releases and aggregate transitions.
Count blocked timer/zone/unknown releases and inventory resets. Use realized plus
marked-open PnL, losing/winning episodes, DD, forced closes, TP cycles and full
monthly deltas. Report baseline AND paired nonpersistent deltas; improving a bad
rule is not proof of beating baseline.

Retain previous profit-upgrade/defensive screens, including >=20 intervened HL
episodes per model, and report all top-five monthly comparisons. No post-result
retuning. No exact live maker/funding/receipt/lot-rounding/ten-second/portfolio
or liquidation certification. Successful historical screens still need fresh
forward validation, never automatic live deployment.

## Run locally

```powershell
npx.cmd ts-node scripts/ladder-persistent-pulse-tests.ts
$env:PERSISTENT_PULSE_OUT = 'backtests/hype/persistent-pulse-rerun'
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-persistent-pulse-study.ts
Remove-Item Env:PERSISTENT_PULSE_OUT
```

New output directory only. Preserve private raw inputs and previous artifacts;
do not sync them during a run or run this on the trading VPS.

After completion, verify artifacts read-only with:

```powershell
npx.cmd ts-node scripts/ladder-persistent-pulse-results-check.ts backtests/hype/persistent-pulse-rerun
```

This replays every logged gate decision, checks actual opens against permissions,
reconciles baseline/paired/monthly/episode results, and verifies all hashes.
