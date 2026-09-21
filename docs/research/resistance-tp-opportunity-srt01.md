# SRT01: resistance-priced TP opportunity audit

Frozen September 16, 2026 before outcomes. Diagnostic only, no strategy replay.

Keep SRP01's exact four Agg10 paths, 14d map and existing resistance partials.
Recheck all eight archived B17/Agg10 ledgers/digests before measurement.
Recent May17 20:43--September15 20:20 UTC; longer July1,2025--August19,2026
21:32 UTC. Same $32k flat start and 0.055% fees each side. No refresh/restart.

## One fixed opportunity definition

While an ordinary 1.4% TP is active and there is no same-decision approved
mutation, use the unchanged engine's nearest resistance (within1% of current
close). Require healthy14d coverage, point >=average*1.01 and <normal target,
and at least three already-confirmed touches separated by six hours. Spacing
comes from the prior review's proposed quality field, not an outcome search.
Greedy earliest-touch selection counts maximum separated observations; support
and resistance pivots retain the map's pooled semantics. Report both.

The diagnostic candidate price is **the existing point centre**. There are no
existing lower zone bounds, and historical tick rules are not established here.
No invented lower bound, front-run tick or automatic floor uplift. Never raise
a0.5% stale target; do not look past a closer unqualified resistance. Repeat
with geometry delayed60s, without delaying price or changing the baseline.

Save all qualifying minute features, including exact touches and source clock.
First qualifying minute per existing TP/inventory arm is an anchor. Distinct
arms in the same ladder are correlated; show unique ladders and stages excluded.

## Forward labels, not simulated earnings

Freeze anchor price and quantity. Scan only later bars until the next baseline
target update, inventory mutation or approved action decision. A target update
or action at a minute close allows an already-armed touch during that minute;
an inventory change at minute open does not. A same-boundary alternative close
decision is flagged as competing. Last-window observations remain censored.

Measure shade-target versus ordinary-target contact under the matching
resting-touch/closed-price assumption. A close-confirmed target contact uses
the subsequent open as its fill proxy, never the signal close. Record both
same-bar contacts as sequence-ambiguous. No maker fill/queue guarantee.

Show normal-target give-up for the fixed inventory and join eventual baseline
episode outcomes. A losing baseline ladder preceded by a shade contact is
**potential reach**, not profit saved: replacements and exposure after an early
close are untested. Keep recovering winners, misses and all denominator minutes.
No new net/DD or monthly PnL delta for an unrun strategy; show current baseline
stats/months alongside opportunity counts instead.

## Reproduce

```powershell
npx ts-node scripts/resistance-tp-opportunity-tests.ts
npx ts-node scripts/resistance-tp-opportunity-study.ts plan
npx ts-node scripts/resistance-tp-opportunity-study.ts run KEY
npx ts-node scripts/resistance-tp-opportunity-verify.ts KEY
npm run research:workflow -- verify KEY
```

Features and labels are separate output artifacts. The independent checker
reconstructs eligibility, maximum spaced touches, first anchors, future-only
barriers, baseline joins, totals and closed-prefix geometry. No production
sources, execution policies, signal files, state or services are modified.
