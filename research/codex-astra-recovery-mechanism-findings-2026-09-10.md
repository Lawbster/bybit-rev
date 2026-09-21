# F05: recovery-event exits and add-freeze controls

## TL;DR

- **No new upgrade passes the complete screen: 0/10 definitions.** This is a broader event-driven test, not another MFI threshold tweak: 124 full paths, including 28 exact F04 controls. Recent unchanged B17 earns **$20,914 touch / $15,839 confirmed**. New support-failure half-exits earn **$20,272 / $17,002**; rebound and both HL half-exit mechanisms earn substantially less than B17.
- **The earlier weekly-MFI result comes from the sale, not its add lock on these paths.** Weekly freeze-only reproduces B17 economically; weekly half with ordinary add permissions reproduces the existing half-plus-freeze results across both periods/models and both delay checks. Recent net stays **$24,303 / $20,893**, but the older monthly/DD failures remain. This is action attribution, not a new improvement.
- **Lower distress thresholds still mostly arrive after exposure is built.** Recent primary rebound arms are already at rung11 in **49/58 touch and 48/52 confirmed episodes**. The broader rules do reach August/September, but their early cuts sacrifice recovering inventory. Keep the current live stack unchanged; conditional soft-stale TP is the next separate roadmap experiment, not a rescue filter added to these losing rules.

## Baseline, dates and fees

Current modeled **B17**, not the bare ladder: $32,000 independent flat start,
$800 x1.35/max11, current modeled gates, S/R partial/support actions, damaged
latch and ordinary exits. Local config hash remains
`5b4ce89f5cf3d66b70bd118fab95697f8c6f5b26253d3d7a484555856153dba5`.
This is not a fresh authenticated check of the deployed VPS.

| Window | Start UTC | End UTC |
|---|---|---|
| Published | July 1, 2025 00:00 | August 19, 2026 21:32 |
| Recent HL | May 17, 2026 20:43 | September 8, 2026 17:47 |

Same frozen input set as F04. Windows overlap and have been studied already;
do not pool them or call either a new holdout. Resting-touch and close-confirmed
TP are distinct causal execution assumptions, not guaranteed bounds on actual
maker execution. There is no short overlay or shared-account simulation here.

Fees stay **0.055% per entry and exit side**. No maker-fee savings, funding
settlements or exchange liquidation model has been added. All experimental
half-sales pay their modeled costs; later trades and final open exposure are
included. The new policies are not being penalized with a different fee rate.

## Exactly what was tested

Two action-isolation controls use the exact existing F04 trigger: deep -3%
distress, +60m, completed30m MFI14<=20, completed-hour price below weekly VWAP
and five-hour ROC<=0. Test **freeze-only** and **half-sale with ordinary adds**
against repeated B17/original-MFI/weekly-half-plus-freeze controls.

Four new mechanisms each get freeze-only and half-plus-freeze:

| Mechanism | Observed sequence, not a forecast label |
|---|---|
| Support failure | Freeze a known support; closed break, later retest from below, still later break of the retest low |
| Rebound failure | Observe a >=0.5% closed-price rebound below the frozen prior15m high, then a later break of that rebound bar's low |
| Ineffective buying | Healthy HL15 buy/sell>=1.2 without positive price ROC15, then a later break of the pressure bar's low |
| Selling + native OI | HL15<=0.85, weaker than five minutes earlier, native OI1h>=0, then a later break of the pressure bar's low |

For those four, arm once per episode at actual depth>=6 and gross loss<=-1.5%,
on a newly available closed5m observation. Six-hour expiry; recover-to-gross0,
depth<6, reference reclaim, closed episode or unknown/gapped required input
invalidates. No MFI requirement, no fixed one-hour wait, no hindsight-selected
rebound top or later retry. The exact 0.1% break/reclaim buffers, support
distance and availability rules are in the [frozen card](../research-inputs/recovery-mechanisms-2026-09-10.json)
and [method](../docs/research/recovery-mechanisms-f05.md).

Six non-HL definitions run on four window/model pairs; four HL definitions
only on the two recent pairs. Each gets primary, source+60s, and action+60s:
**96 new cases plus28 repeated controls =124**, not124 independent strategies.
No older missing HL is filled with neutral values. Ten added definitions take
the ladder-overlay register from53 to63; standalone count stays5,261.

## Wins, losses and dollars

W/L counts completed flat-to-flat episodes including their partials and fees.
Winning/losing dollars are net dollars assigned to those completed episodes,
not gross before-fee trade proceeds. A TP can finish an episode that is still
net-negative after a prior loss-cut. Tables are rounded to dollars.

### Recent window: May17-September8,2026

| TP model | Setup | W / L | Winning $ | Losing $ | Net incl. open | Delta B17 | Max DD |
|---|---|---:|---:|---:|---:|---:|---:|
| Touch | **Current B17** | **295 / 10** | **$57,130** | **-$33,009** | **$20,914** | -- | **24.69%** |
| Touch | Weekly MFI half, existing reference / ordinary-add control | 292 / 13 | $56,417 | -$28,906 | $24,303 | +$3,389 | 20.06% |
| Touch | Support-failure half | 292 / 13 | $56,432 | -$32,952 | $20,272 | -$641 | 19.74% |
| Touch | Rebound-failure half | 276 / 28 | $52,757 | -$36,306 | $13,243 | -$7,671 | 20.82% |
| Touch | Ineffective-buying half | 275 / 28 | $51,570 | -$37,099 | $11,264 | -$9,650 | 23.06% |
| Touch | Selling + OI half | 275 / 28 | $51,577 | -$39,886 | $9,512 | -$11,401 | 28.57% |
| Confirmed | **Current B17** | **243 / 11** | **$59,238** | **-$40,192** | **$15,839** | -- | **31.11%** |
| Confirmed | Weekly MFI half, existing reference / ordinary-add control | 243 / 11 | $59,238 | -$35,138 | $20,893 | +$5,054 | 26.08% |
| Confirmed | Support-failure half | 238 / 16 | $57,917 | -$37,707 | $17,002 | +$1,164 | 25.88% |
| Confirmed | Rebound-failure half | 213 / 30 | $51,730 | -$42,541 | $5,981 | -$9,857 | 33.52% |
| Confirmed | Ineffective-buying half | 215 / 28 | $51,608 | -$41,080 | $7,320 | -$8,518 | 30.42% |
| Confirmed | Selling + OI half | 215 / 28 | $51,860 | -$45,604 | $4,078 | -$11,761 | 41.34% |

Recent ending open mark is **-$3,207** except selling+OI half, which leaves
**-$1,604** open mark plus **-$575 realized partial PnL in the unfinished
episode**. Both are included in net; neither is counted as a completed loss.
The smaller remainder supplies a +$1,029 net unfinished-inventory contribution
versus B17, already credited despite that strategy's poor completed results.

Recent minimum equity is $31,410 touch /$30,371 confirmed for these rows except
selling+OI confirmed, which falls to $27,174. DD is peak-to-trough, not loss
from the initial $32,000 balance.

### Published window: July2025-August19,2026

HL mechanisms are intentionally absent: unavailable older HL is not validation.

| TP model | Setup | W / L | Winning $ | Losing $ | Net | Delta B17 | Max DD |
|---|---|---:|---:|---:|---:|---:|---:|
| Touch | **Current B17** | **955 / 57** | **$187,738** | **-$140,906** | **$46,832** | -- | **28.17%** |
| Touch | Weekly MFI half / ordinary-add control | 946 / 66 | $185,487 | -$136,662 | $48,825 | +$1,993 | 29.85% |
| Touch | Support-failure half | 942 / 70 | $184,621 | -$136,040 | $48,581 | +$1,749 | 23.17% |
| Touch | Rebound-failure half | 899 / 111 | $174,040 | -$146,078 | $27,962 | -$18,870 | 26.97% |
| Confirmed | **Current B17** | **788 / 60** | **$190,819** | **-$171,329** | **$19,490** | -- | **45.65%** |
| Confirmed | Weekly MFI half / ordinary-add control | 784 / 64 | $189,789 | -$163,199 | $26,590 | +$7,100 | 40.79% |
| Confirmed | Support-failure half | 773 / 75 | $186,234 | -$161,992 | $24,242 | +$4,752 | 35.29% |
| Confirmed | Rebound-failure half | 724 / 110 | $172,270 | -$161,335 | $10,936 | -$8,554 | 36.43% |

Published paths end flat. Support's aggregate improvement is real under these
primary models, but is not sufficient qualification: recovery months get
materially worse, recent touch loses money relative to B17, and source timing
sensitivity is poor. The rebound rule sacrifices more winning dollars than
it saves in losing dollars even where DD improves.

## Action isolation and invisible opportunity cost

**Weekly freeze-only makes zero effective add vetoes**, and all its economic
metrics reproduce B17 across12 cases. The half-with-ordinary-add control
reproduces its corresponding F04 half-plus-freeze parent's metrics and paths
across12 cases, including delays. The full rung count is retained after a
pro-rata half-sale; ordinary adding cannot simply double the inventory back.
This does not show add locks are universally useless. An integration fixture
with an intervening S/R trim explicitly demonstrates that the opt-in ordinary
branch can rebuild, while the default branch stays locked.

The broader freezes are not all inert. Recent confirmed rebound freeze loses
**$2,581**, while direct matched-episode changes contribute only about **+$2**:
it removes19 baseline episodes totaling **-$8,442**, replaces them with8
totaling **-$11,026**, and captures **232 rather than242 TP cycles**. It has
11 rather than12 forced closes, yet loses more overall. Counting one fewer
flatten without later occupancy would give the wrong answer.

Recent support-half has **no removed or replacement episodes**; all delta is
within matched inventory paths. Touch saves only **$57 of losing-episode
dollars** while sacrificing **$699 of winning dollars**, net **-$641**.
Confirmed saves **$2,486** and sacrifices **$1,322**, net **+$1,164**.
The two models do not support the same profit conclusion.

Every variant's matched/removed/replacement and unfinished contributions,
including both the harmful and helpful cases, are retained in
[comparisons](../backtests/hype/hype-recovery-mechanisms-2026-09-10/comparisons.json).
Do not add independent rule deltas to estimate a combined strategy.

## All ten definitions: ranked recent increments

Order is by the smaller increment across the two recent TP models, not a new
acceptance criterion. Baseline absolute nets: **$20,914 touch /$15,839 confirmed**.

| Setup | Touch delta | Confirmed delta | Complete-screen verdict |
|---|---:|---:|---|
| Weekly half with ordinary adds | +$3,389 | +$5,054 | Same existing F04 result; older monthly/DD failures |
| Weekly freeze only | $0 | $0 | No effective intervention; not an improvement |
| Support freeze only | $0 | -$14 | No useful increment |
| Support half | -$641 | +$1,164 | Model disagreement and material monthly costs |
| Selling + OI freeze | -$607 | -$2,537 | Worse economics/DD; older HL unavailable |
| Ineffective-buying freeze | -$100 | -$2,551 | Worse economics; older HL unavailable |
| Rebound freeze | -$72 | -$2,581 | Worse economics/DD |
| Ineffective-buying half | -$9,650 | -$8,518 | Large recovery sacrifice; older HL unavailable |
| Rebound half | -$7,671 | -$9,857 | Large recovery sacrifice |
| Selling + OI half | -$11,401 | -$11,761 | Lower net and higher DD; older HL unavailable |

The frozen requirements are recent increment>=$1,000 in both models, published
increment>=0 in both, no DD increase, no monthly MTM delta below-$250, and no
modeled nonpositive equity. Missing full-history HL is not a pass. All must
hold; none of these definitions passes. The zero-action/control results are
not evidence that the entire mechanism family has negative edge.

## Monthly costs, not just the biggest saved flatten

Baseline is absolute monthly MTM. Every other column is **delta against that
same baseline**. May/September are partial months. Weekly denotes the existing
weekly-half reference and its identical ordinary-add control.

### Recent resting-touch

| Month | B17 | Weekly half delta | Support half delta | Rebound half delta | Buying-failure half delta | Selling/OI half delta |
|---|---:|---:|---:|---:|---:|---:|
| May | $13,483 | $0 | -$1,174 | -$3,740 | -$4,702 | -$5,262 |
| June | $1,584 | +$2,061 | +$668 | -$1,549 | -$2,176 | -$3,153 |
| July | -$3,950 | +$1,329 | -$135 | -$137 | -$102 | -$1,654 |
| August | $9,684 | $0 | $0 | -$2,246 | -$2,017 | -$1,881 |
| September | $112 | $0 | $0 | $0 | -$652 | +$548 |

### Recent close-confirmed

| Month | B17 | Weekly half delta | Support half delta | Rebound half delta | Buying-failure half delta | Selling/OI half delta |
|---|---:|---:|---:|---:|---:|---:|
| May | $17,131 | $0 | -$1,214 | -$4,068 | -$4,975 | -$5,658 |
| June | -$2,243 | +$5,047 | +$1,708 | -$2,461 | -$620 | -$4,670 |
| July | -$7,858 | +$7 | +$1,832 | -$50 | +$705 | -$566 |
| August | $10,239 | $0 | $0 | -$1,816 | -$2,322 | -$1,896 |
| September | -$1,429 | $0 | -$1,162 | -$1,461 | -$1,307 | +$1,029 |

The additional late-period actions are not new evidence of improvement: in
August all three broader rebound/HL half rules reduce profit under both models.
Support-half has no August cut, and its September confirmed action costs$1,162.

Published support-half also harms March, April and May2026 under both models:
touch deltas **-$1,010/-$1,162/-$2,221**, confirmed
**-$3,074/-$939/-$3,251**. The beneficial June/July and older cascade examples
cannot erase those months from the screen.

Every month for **every setup**, including all ten definitions, both TP models,
all available windows and both delays, is preserved in
[full tables](../backtests/hype/hype-recovery-mechanisms-2026-09-10/tables.md).
The [382-row primary monthly W/L table](../backtests/hype/hype-recovery-mechanisms-2026-09-10/primary-monthly-wl.csv)
also contains completed wins/losses and their dollars; completed episode money
uses the final-close month, unlike MTM's open-equity changes.

## Concentration and honest counterexamples

Recent touch support-half helps **1 of5 cuts** and hurts4. Confirmed helps4 and
hurts5, at8 distinct UTC dates. Published counts are14 helpful/14 harmful touch
and16/16 confirmed. These are overlapping model/window cases, not independent
replications of the same market evidence.

- **Helpful support cut, June4 07:00UTC:** support$70.45925 was frozen at06:30,
  already known from June2. Closed break at06:50, retest at06:55, then close
  $69.661 below retest low$69.954 by>0.1% at07:00. Next-open half-sale reduces
  823.7785qty to411.8893. The episode still emergency-closes on June5, but nets
  **-$5,434 versus B17-$8,432**, saving$2,998.
- **Harmful support cut, June26 13:10UTC:** support$61.6588 was frozen at10:05,
  known by June24. Break12:45, retest12:55 with low$61.517, then failure close
  $61.334 at13:10. Half of940.6238qty is sold. Ordinary stale TP follows at13:58;
  episode net becomes **-$948 versus B17+$233**, a$1,181 cost. This is the same
  causal pattern as the helpful example, followed by a recovery.
- **Harmful HL buying-failure cut, May26:** at21:35,14 available HL minutes
  through21:34 give buy/sell1.44045; price ROC15=-0.04053%. Only at21:55 does
  a later closed price$59.035 break the pressure-bar low$59.145 by>0.1%.
  The next-open half-sale is followed by a May27 stale-TP recovery: **-$1,642
  instead of+$233**, costing$1,874. Known buying without immediate price
  progress does not prove the later recovery has failed permanently.

These decisions use already-closed bars and available source rows, not the
later episode outcome. Next-open fill timestamps may equal the prior bar's
ending boundary; the audited fill **index is strictly one later** (two later
under action+60). No fill-bar high/low selects the exit price.

The [2,392 overlapping signal traces](../backtests/hype/hype-recovery-mechanisms-2026-09-10/execution-traces.json)
retain all signals, including frozen-only and delayed duplicates, not2,392
independent trades. Raw source references and quantities are included.
The [concentration diagnostic](../backtests/hype/hype-recovery-mechanisms-2026-09-10/concentration.json)
shows published touch support-half's+$1,749 falls to-$1,249 if the largest
helpful matched-date contribution is subtracted. Recent confirmed+$1,164
falls to-$1,707 on the same diagnostic. This is contribution subtraction,
**not** a policy rerun omitting that event or a holdout result.

## Source delay, action delay and availability

All24 action-isolation runs reproduce the paired B17/F04 economics and full
inventory paths after normalizing only the research-action reason label.
For the new support-half mechanism:

| Window / TP | B17 net | Primary net | Source+60s net | Action+60s net |
|---|---:|---:|---:|---:|
| Published / touch | $46,832 | $48,581 | $40,601 | $48,938 |
| Published / confirmed | $19,490 | $24,242 | $26,132 | $24,378 |
| Recent / touch | $20,914 | $20,272 | $15,313 | $20,451 |
| Recent / confirmed | $15,839 | $17,002 | $16,521 | $17,089 |

The support result is notably sensitive to the source clock. Source+60 shifts
when the actual inventory is observed at a newly available bar and can change
arming/reference selection and subsequent event paths. It is not merely an
extra fee or one minute of slippage. Action+60 preserves the broad failures of
all new half-sale mechanisms; all figures are retained, not only primary.

The four HL variants all take **zero actions under source+60s** and reproduce
B17. The fixed14/15 floor leaves these legacy flow windows incomplete; no
post-hoc floor reduction was made. This is *missing-data attrition*, not better
economic discrimination or a demonstrated real-time robust policy. Primary
HL paths do have valid events across several months; their poor results are
not explained simply by zero source coverage.

[Monthly opportunities](../backtests/hype/hype-recovery-mechanisms-2026-09-10/opportunity-monthly.csv)
store792 rows covering arms, signals, depth11 counts, known flow observations,
unknown-input cancellations and actual half-sales. Repeat observations are
not independent market samples; absence of an older HL window remains explicit.

## Verification and reproducibility

- **124/124 independent case checks passed**:631,826 fills;42,007,540 minute
  equity marks;2,821 raw MFI reconstructions;1,810 unique raw HL queries;377
  closed-prefix S/R checks. Source row selection, first eligible distress arms,
  transition predicates, pro-rata quantities/fees/clock, priority, occupancy
  accounting, monthly deltas and frozen screen are checked.
- All28 F04 cases reproduce exactly before new variants. A single opt-in
  research add-lock flag is the only replay-engine extension. Default behavior
  is unchanged; the byte-exact old source is preserved, rather than loosening
  its old pin. See the [method's engine bridge](../docs/research/recovery-mechanisms-f05.md#minimal-research-engine-bridge).
- Focused F05, F04 and F02 fixtures/integration; replay causality/current-stack;
  component and component-edge; closed-indicator timing suites passed. Normal
  and VPS TypeScript checks and explicit strict research-script compilation
  passed. The default-versus-ordinary S/R/rebuild fixture exercises both paths.
- [Verification](../backtests/hype/hype-recovery-mechanisms-2026-09-10/verification.json)
  and [report hashes](../backtests/hype/hype-recovery-mechanisms-2026-09-10/report-validation.json)
  tie findings to the saved inputs/source/artifacts. Generated datasets remain
  local; the frozen card, method, findings and reproducible source are retained.
- Protected config, long/short settings, local state and main live strategy/
  execution call sites are unchanged. No new live orders, remote polling or
  PM2 changes were part of this task.

## Scope of the conclusion

This rejects these exact definitions as robust upgrades, not support/resistance,
HL, event sequences or selective half-exits as entire families. More conditions
being economically tested does not guarantee more profitable conditions.

The first distressed observation is usually already full: recent rebound arms
are depth11 in49/58 touch and48/52 confirmed. Every recent primary support-half,
rebound-half and ineffective-buying-half signal is at depth11. Selling+OI half
has one depth8 touch signal; all its other recent signals are depth11.
These are not broad tests of pre-deep exposure budgets merely because the
formal minimum depth is6.

No automatic live change, commit, push or deployment. Keep the weekly-MFI half
as the prior research reference, still unqualified. The next independent
roadmap checkpoint remains **conditional soft-stale TP**, then exposure
expansion/recycling before the ladder becomes full. Neither is tested here.
