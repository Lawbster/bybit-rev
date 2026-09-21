# Deep sizing and post-partial exposure audit

September 5, 2026. Local research only. No live config, state, execution or deployment changes.

[Findings and all monthly comparisons](../../research/codex-astra-ladder-sizing-findings-2026-09-05.md).

## First: transactional partial clock correction

The earlier replay removed selected IDs and reanchored lastAddTime to the newest
surviving position. Production S/R uses applyObservedPartialFill then
finalizePartialClose, which preserve the last actual add timestamp while inventory
remains. The old replay test exercised closePositionsByIndices instead.

The default replay now preserves the transactional clock. An explicit
partialClockModel=legacy_reanchor exists solely to reproduce old archives.
The old source bytes and SHA-256 are preserved in a private generated evidence
file; all four old baseline digests must match with that option before running
four corrected baselines. Prior studies are not silently recertified. This repair
is not a strategy proposal and changes no production behavior.

## Frozen experiment

[Definition](../../research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json).
Six variants plus one control, each in all four accepted cases:

- Standard rung 11 multiplied by 0.75 or 0.50.
- Standard rungs 9-11 multiplied by 0.75 or 0.50.
- Surviving entry-cost cap equal to a fresh ten-rung ladder, or that amount plus
  half the standard eleventh rung.
- Ten-rung count cap control.

Fractions apply to the standard size at the current position count; they do not
compound recursively. A clipped cap add requires at least one base rung ($800)
of available room, otherwise it waits without resetting the timer. This avoids
inventing tiny exchange orders in a model without lot/min-notional handling.
It is a research policy minimum, not a claim about Bybit instrument constraints.

All original gates and original-request affordability remain authoritative.
The research size hook can only reduce an approved size, never enlarge it or
open when the original affordability check failed. Existing exits, partial
selection, pulse and zone thresholds remain unchanged. All actions remain causal
next-open executions. A cost cap is not a mark-value cap, risk guarantee,
margin ceiling or automatic deleveraging rule.

## Audit and outputs

An immutable observer records before/after inventory at each actual fill.
For every partial, independently verify the selected IDs using decision-time
profit ranking and the production selected-ID allocator at complete fill.
Verify surviving quantities/costs, count-derived next sizing and transactional
clock continuity. Current live rounding/terminal partial/maker fragmentation can
leave additional residual positions: those are explicit model limitations.

Count baseline episodes with partials, retained-cost inflation relative to
fresh same-count inventory, and costs exceeding the fresh eleven-rung amount.
Report their winning and losing contributions. These outcome-conditioned
cohorts diagnose exposure; they are not causal predictors or add rules.

Every variant retains inventory, size decisions, closes, partials, monthly
realized/MTM accounting, affected episodes, gross wins/losses, worst losses,
DD, peak cost and maximum close-marked underwater duration. Missing profitable
cycles and remaining open inventory count. Fixed-path extra execution cost of
5bps per side is a sensitivity, NOT a slippage-path replay or actual funding.

Reuse the earlier predeclared profit and defensive screens. Report protection
versus profit costs even when screens fail. Overlapping repeatedly mined history
is not untouched validation. No promotion without resolving material execution
sensitivity and collecting new forward observations.

## Local reproduction

```powershell
npx.cmd ts-node scripts/ladder-sizing-tests.ts
npx.cmd ts-node scripts/replay-current-stack-tests.ts
$env:SIZING_OUT = 'backtests/hype/sizing-rerun'
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-sizing-study.ts
Remove-Item Env:SIZING_OUT
npx.cmd ts-node scripts/ladder-sizing-results-check.ts backtests/hype/sizing-rerun
npx.cmd ts-node scripts/ladder-sizing-monthly-check.ts backtests/hype/sizing-rerun
```

Use a NEW output folder and the preserved raw-input snapshot. Do not sync inputs
during a run. Never run this study on the trading VPS. Source hashes are pinned
before/after; the only prior shared source changes are the documented engine
hooks/clock repair and corrected regression test.

The second checker reconstructs every minute's adverse equity and monthly
realized/MTM totals from pinned repaired candles plus saved fills, without
calling the strategy engine. The separate live event diagnostic is:

```powershell
npx.cmd ts-node scripts/ladder-live-partial-exposure-audit.ts backtests/hype/live-partial-exposure-rerun.json
```
