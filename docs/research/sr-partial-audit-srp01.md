# SRP01: exact Agg10 partial-exit audit

Frozen September 16, 2026 before economic runs. Local research only.

## Scope

Current Agg10 versus three definitions: disable resistance partials; remove only
their pulse requirement; substitute the existing hostile predicate. Do not alter
the 14d map, depth6/keep3, profit/distance conditions, 60m cooldown, sizing, normal
TPs,10h deferral,48h-high exit, other gates, or inventory clocks. All remaining
conditions and transaction sequencing continue through the shared causal engine.
Hostile means the existing pulse formula, not the depth7 hostile shadow candidate.

Eight exact MS02 archived B17/Agg10 controls precede twelve primary paths
(three alternatives x two windows x two TP models). Four recent pulse60 paths
repeat current and hostile with only partial-action pulse evidence delayed one
minute. Pulse-free/disabled outputs are reused against the delayed baseline.
Total24 runs,3 new trading definitions. No shading, skip-add or six-hour exit here.

Windows: May17 20:43–September15 20:20,2026 and July1,2025–August19 21:32,2026,
UTC. The dates overlap and are mined development data. $32,000 flat start,
$800 x1.35 max11,0.055% fees both sides. No maker/funding cash/liquidation claims.

## Predicates and clocks

OI breadth is the mean of available Bybit/Binance/HL four-hour changes.
Hostile: breadth<0 OR Binance taker4h<1 OR any negative venue funding.
Deteriorating: breadth<=-0.25 OR Binance taker4h<=0.98 OR BTC4h<=-0.25 OR
(negative funding AND (breadth<=0 OR Binance taker4h<=1.05)). They are not nested.
Missing operands remain null/false; historical Bybit funding fallback and BTC
returns remain explicit as in the controls. The older history is not HL-complete.

Partial decisions use closed candles and as-of pulse snapshots, execute next
minute open, and retain the original last-add/surviving-entry clocks. Pivot
right-wing confirmation and closed-prefix map reconstruction remain unchanged.
Pulse60 delays OI/taker/funding evidence and funding/BTC fallbacks together;
current price, geometry and unrelated gates are not delayed. No retrospective
intrabar execution or market-fill-delay certification.

## Implementation boundary and checks

One additive research-only candidate-gate hook in `scripts/replay-causal-engine.ts`.
Unset/default behavior stays identical; an override cannot bypass the shared
depth, context, distance, profit, selection or cooldown gates. No `src/bot` edits.
An explicit engine-source bridge is recorded, other inherited sources pinned,
and all eight original engine digests plus full metrics must reproduce before
alternatives. Accepted artifacts are never overwritten.

Synthetic tests: identity, exact next-open/keep3/clock preservation, disabled
mode, inability to override depth safety, unknown pulse and future poisoning.
Independent verifier reconstructs all eligible decision minutes (not fired-row
samples), predicates, selected rungs, pulse clocks, closed-prefix zones, every
fill, fee, minute equity mark, target and high-exit check. Report both acted and
rejected opportunities, availability, changed decisions and distinct ladders.

Report full-period/monthly W/L counts and dollars, net/DD, TP cycles, terminal
open inventory, removed/replacement outcomes, and overlapping occupancy-component
concentration. Removing the largest component is arithmetic, not a new replay.
Screen: both recent models >=$1,000 uplift, older>=0, no DD increase, no month
below baseline by more than$250, at least20 changed recent ladders, nonnegative
delayed-pulse uplift. Failure remains a negative result, not deployment approval.

## Reproduce

```powershell
npx ts-node scripts/sr-partial-audit-tests.ts
npx ts-node scripts/replay-current-stack-tests.ts
npx ts-node scripts/sr-partial-audit-study.ts plan
npx ts-node scripts/sr-partial-audit-study.ts run KEY
npx ts-node scripts/sr-partial-audit-verify.ts KEY
npx ts-node scripts/sr-partial-audit-report.ts KEY
npm run research:workflow -- verify KEY
```

Do not run on VPS or sync source data during the job. Qualifying research still
requires forward observation; no live change is authorized by this card.
