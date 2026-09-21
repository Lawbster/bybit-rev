# SRR01: selected-resistance TP and scoped re-entry

Frozen September 16, 2026 before W/R outcomes. Local research only.

Four cells: A unchanged Agg10; D unchanged SRT03 SR-selected fixed1% TP;
W D plus fixed4h fresh-entry wait; R D plus the same wait released by a
post-fill completed5m close strictly above the frozen resistance times1.001.
Exactly two new definitions. Same14d map, partials, sizing and outer gates.

The [card](../../research-inputs/resistance-reentry-srr01-2026-09-16.json)
defines triggers, availability, exclusions, windows and screens. The preceding
[review](../../research/codex-astra-sr-direction-review-findings-2026-09-16.md)
explains the controls and explicitly corrects the causal claims being tested.

## Phases

1. `audit`: verify the accepted SRT03 pins and receipt, then reconstruct every
   D-selected full ordinary TP and next entry/outcome in all four paths. Seal
   the output before W/R economics. Future outcomes are diagnostic labels only;
   these records are not inputs to the trading controller.
2. Read that audit. `plan` hashes it, the frozen card, source/data and archived
   controls. `run` reproduces all eight A/D paths exactly before any W/R path.
3. Eight primary W/R paths and eight60s source-availability cases:24 executions
   total. The60s sensitivity delays new target geometry and breakout availability
   together, not baseline gates/partials or the four-hour wall-clock cap.
4. Independent verifier reconstructs target selection/lifecycle, native exits,
   every otherwise-approved add, wait activation/release, fills, fees, monthly
   equity and DD. It does not import the wait/shade controllers. Shared frozen
   native predicates and zone geometry are disclosed, not called independent.

## Causal details

Only a flat ordinary `tp` with a still-valid D target starts a wait. No wait
after stale, unselected TP, partial, emergency or high exit. Freeze the level
from target selection; moving zones cannot reset/release the wait. Inventory
mutation and ordinary/stale phase change invalidate target provenance.

Five-minute bars require all five consecutive closed minutes, UTC alignment,
bar start at or after modeled TP fill, and end plus delay at or before decision.
Missing data prevents early release. Breakout releases latch even if price
falls back or another existing entry gate blocks. Cap wins on exact equality.
Only otherwise-approved fresh adds can be vetoed. Existing-ladder adds/exits
and all native clocks are untouched. No pending limit entry or forced buying.

Resting fills have unknown intraminute time and inherit the conservative
bar-end timestamp. Close-confirmed fills occur at next open. These are replay
assumptions, not exact live maker fills. New entry decisions still execute at
next-minute open; no own-candle target fills or future/revised level backdating.

## Report and decision

Keep A/D beside every comparison and archived B17 as a separately labelled
reference. Show complete-ladder W/L counts/dollars, average loss, TP/partial
counts, realized versus open mark, net/DD and every monthly delta. Include
wait activations, first eligible blocked entries, release reasons, changed
entry prices, missed winners/replacement losers, time flat, connected occupancy
components and leave-largest-out arithmetic (not alternate replay returns).

Trace July2025, September9 and June29-July1 in all relevant paths and locate
the actual DD peak/trough. Never infer all DD regressions from one losing entry.
R must be compared to W, not just A; otherwise a timer benefit could be
mislabelled a resistance-release benefit. Keep the original screen: recent
net>=+$1k, longer>=0, monthly>=-$250, no DD increase,20 changed completed
episodes, nonnegative60s delta. The card separately fixes the R-vs-W screen.

No support-hold branch, boost, global cooldown, offset or duration sweep.
Windows remain mined/overlapping; $32k flat-start long-only,0.055% fees each
side, no maker credit/funding settlement/liquidation/shared-account proof.
Results cannot authorize deployment. Preserve every failed definition.

## Commands

```powershell
npx ts-node scripts/resistance-reentry-tests.ts
npx ts-node scripts/resistance-reentry-study.ts audit
# Read preaudit summary before proceeding:
npx ts-node scripts/resistance-reentry-study.ts plan
npx ts-node scripts/resistance-reentry-study.ts run KEY
npx ts-node scripts/resistance-reentry-verify.ts KEY
npx ts-node scripts/resistance-reentry-report.ts KEY
npm run research:workflow -- verify KEY
```

Audit path: `backtests/hype/resistance-reentry-srr01-preaudit-2026-09-16/`.
The plan requires unchanged audit/card hashes. Do not overwrite old or partial
evidence, steal a run claim, or sync data during execution.
