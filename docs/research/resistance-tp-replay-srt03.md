# SRT03: five-way resistance TP portfolio replay

Frozen September16,2026 before outcomes. Local only; no deployment.

## Setups

Current Agg10 control; B exact resistance; C up-to0.3% below, floored at gross1%;
D fixed1% with identical S/R selector; E fixed1% without S/R selection. Four new
economic definitions. Same14d map and current partials throughout. SRT01/SRT02
qualifier retained: nearest within1%, point between avg+1% and ordinary1.4%,
three pooled confirmed touches at least6h apart. No new HL condition.

## Lifecycle and ordering (part of the tested mechanism)

Each variant generates its own complete path, not transplanted baseline trades.
An additive research-only hook runs after existing TP/emergency/funding/flatten,
partial, Agg10 high-exit and approved-add decisions. It can only lower an
ordinary target to >=gross1%; any scheduled mutation blocks new selection.
Once selected, hold the exact price until an executed inventory mutation or
ordinary/stale phase change. Existing target remains eligible for subsequent
TP fills while an add is pending, under the existing replay ordering; next-open
inventory mutation cancels/rearms before that minute's later intrabar test.
No refreshing the zone price every minute, no raising stale0.5%, no cancelling
an already-approved add or resetting add clocks. A pending partial/full exit
quiesces the target, as baseline does.

An already-crossed target schedules a next-minute-open full close with ordinary
`tp` reason/standard fees, not a retroactive maker fill. A new resting target
cannot use its own decision candle's high. The1% floor is a target-price
constraint, not a guarantee on subsequent market execution after fees.

Global fixed1% changes only this ordinary-target selection; all stale eligibility
and phase logic continue using original config. This isolates a price change
without silently retuning the stale policy or other calculations.

## Runs and controls

Eight archived B17/Agg10 controls must reproduce exactly before16 primary
variants (four x two windows x two TP assumptions). Then12 geometry60 cases
(three SR variants x two windows x two models). **36 runs total.** Global1%
needs no duplicated geometry lag case. No threshold search follows outcomes.

Recent May17,2026 20:43--Sep15,2026 20:20 UTC; longer Jul1,2025--Aug19,2026
21:32 UTC. $32k flat start, $800x1.35/max11,0.055% fees each side. Both
resting-touch and close-confirmed/next-open TP models, not two live TP modes.
Only shade geometry is delayed60s; baseline partials and all other sources stay.

Current source engine needs a bridge from SRP01; record its old/new hashes and
require unchanged disabled-hook control digests/metrics. No accepted files are
rewritten. Use separate immutable output directory and independent checker.

## Report and screen

W/L counts/dollars/average loss, net/realized/open mark, DD, monthly differences,
TP/partial counts and changed episodes. Attribute matched, removed and new
replacement ladders; early profits versus follow-on losses are not assumed.
Show top contributing matched/removed/replacement episodes, leave-largest-
contribution arithmetic as a concentration diagnostic (not an alternate replay),
and trace the September9 contact's subsequent sequence.

Screen against Agg10 separately in each window/model: recent >=+$1,000,
longer >=$0, no month below-$250, no DD increase, >=20 changed episodes;
geometry60 net delta>=0. Report failures, do not reclassify a sparse lead as
qualified. Larger net alone does not certify live deployment.

No maker queue/tick/actual-arrival certification, maker-fee bonus, funding cash
settlement or margin/liquidation/shared-account replay. Windows overlap and
are repeatedly mined, not holdouts. No economic claim from SRT02 anchor sums.

## Commands

```powershell
npx ts-node scripts/resistance-tp-replay-tests.ts
npx ts-node scripts/resistance-tp-replay-study.ts plan
npx ts-node scripts/resistance-tp-replay-study.ts run KEY
npx ts-node scripts/resistance-tp-replay-verify.ts KEY
npx ts-node scripts/resistance-tp-replay-report.ts KEY
npm run research:workflow -- verify KEY
```

Findings and a separate Fable review handoff follow independent verification.
