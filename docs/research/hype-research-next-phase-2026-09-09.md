# HYPE research: coverage gaps and the next program

September 9, 2026. **Review and proposed plan only. No new simulations, trading
definitions, code/config/state changes, commit, push or deployment.** The budgets
below are proposals, not permission to execute every branch automatically.

## 1. Conclusion

There is substantial unexplored scope, but not evidence that a profitable rule
must exist in it. Our work is broad in indicator parameters and much narrower
in **decision mechanism**. Most definitions ask whether to enter at a crossing,
veto an otherwise-approved add, or cut at one predetermined loss checkpoint.

The next program should prioritize:

1. **Recovery-aware loss control:** separate failed recoveries from recoverable
   dips using observed event sequences, not another conjunction at MFI <= 20.
2. **Conditional soft-stale TP:** refine the largest demonstrated current-stack
   trade-off rather than removing it wholesale.
3. **Inventory expansion and recycling:** manage how dollar risk builds before
   rung 11 and after partial exits, not only whether the final add is allowed.
4. **Price response at known levels plus pulse:** absorption, failed reclaims,
   and acceptance/breakdown, with causal level identity and source availability.
5. **Separate standalone sequence entries:** complete the proposed S01 work and
   preserve the existing narrow combination lead; only later test a shared
   account. Do not add standalone dollars to ladder dollars.

This is a change in research emphasis, not a conclusion that current protections
should be removed. In particular, the component audit supports retaining the
trend/forced-exit framework, damaged latch and other tail protections.

## 2. Baseline and evidence boundary

Unchanged modeled **B17**: starts flat with $32,000, $800 x 1.35, max 11 retained
rungs; all current modeled gates, S/R partial/support actions, damaged latch and
ordinary exits. Fees stay **0.055% per side**. No maker-fee uplift in this phase.

| Window / TP assumption | Completed W/L | Winning dollars | Losing dollars | Final open mark | Net | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Published / resting touch | 955 / 57 | $187,738 | -$140,906 | $0 | $46,832 | 28.17% |
| Published / close confirmed | 788 / 60 | $190,819 | -$171,329 | $0 | $19,490 | 45.65% |
| Recent / resting touch | 295 / 10 | $57,130 | -$33,009 | -$3,207 | $20,914 | 24.69% |
| Recent / close confirmed | 243 / 11 | $59,238 | -$40,192 | -$3,207 | $15,839 | 31.11% |

- Published: **2025-07-01 00:00 to 2026-08-19 21:32 UTC**.
- Recent HL: **2026-05-17 20:43 to 2026-09-08 17:47 UTC**.
- Windows overlap, start independently, and have already been examined. They
  are not independent or untouched validation samples.
- TP assumptions are different causal execution models, not guaranteed bounds
  for actual maker execution. Funding, liquidation and shared-account effects
  remain outside these results.
- B17 controls agree across L09/F02/F04. Local `bot-config.json` still matches
  their SHA-256: `5b4ce89f5cf3d66b70bd118fab95697f8c6f5b26253d3d7a484555856153dba5`.
  This is a local check, not an authenticated deployed-state check.

Numbers were checked against the saved [L09 overview](../../backtests/hype/hype-ladder-components-2026-09-08/overview.csv)
and [F04 overview](../../backtests/hype/hype-mfi-weekly-exit-2026-09-09/overview.csv).

## 3. What is covered, and what a negative result actually excludes

The current register contains **5,261 standalone definitions and 53 ladder
overlays**, plus L09's 33 non-current reconstruction/removal profiles. These are
not thousands of independent mechanisms, and not all ladder overlays use the
latest corrected state clock. Repeated windows, models, delays and controls do
not add independent market evidence.

| Work | Coverage actually established | Important remaining boundary |
|---|---|---|
| I01-I11 individual indicators | Thirteen validated math families; many threshold, timeframe and entry/exit definitions | Mostly bounded single-position fixed-notional rules. Not a complete strategy for sequencing events, sizing inventory or managing deep ladders |
| C01/C02, T01/T02, R01 | 64 initial pairs, calendar exclusions, limited neighboring clocks/holds and nine selected refinements | Not arbitrary combinations, full interaction search, event waiting, or every indicator transferred to the ladder |
| H00/H01 | Descriptive HL/S/R joins and four filters on one particular refined short parent, with interaction controls | Not a general test of price/flow response at levels, long exits, or all HL combinations |
| L01-L05 | S/R/flow encounters, deep-add attribution, 17 static blockers, 12 drop-flow rules, six persistent holds | L03-L05 economic results use the older partial clock; only selected controls were subsequently rerun. Persistence was tested, but not every release/sequence mechanism |
| L06-L08 | Static fractional sizing/cost caps, four individual hourly rung-11 vetoes, three conditional half-rung rules | Not volatility-conditioned spacing, pre-deep risk budgets, episode recycling control, or every indicator/pulse combination |
| L09 component audit | Bare-to-current build-up and full-minus-one removal of each of 17 components | Removal is not optimization of that component's thresholds, context or interactions |
| F01/P01/F03 | Broad indicator/HL/level descriptions, pressure points, matched recoveries and failed-recovery contrasts | Broad observation is not broad economic testing. Four-hour market samples can miss transient intrahour signals |
| F02/F04 | Four original exit rules plus one weekly filter; one depth/loss/timer/MFI checkpoint | Not a general adaptive exit system; half-exits also prohibit later adds, bundling two actions |
| Actual TP/HL atlas | 327 classified long TPs, 28 S/R partials and separate short/other closes, with context and references | Exit-selected observations do not demonstrate an entry/exit policy's incremental profit |

Sources: [tested setups](../../research/TESTED-SETUPS.md),
[indicator register](../../research/INDICATOR-FINDINGS.md),
[retained combinations](../../research/COMBINATION-CANDIDATES.md).

Important wording corrections for future reports:

- Zero qualifiers means those definitions failed their stated screen. It does
  not establish that RSI, HL, S/R, partials, or the entire idea family is useless.
- Zero interventions is insufficient coverage, not evidence of negative edge.
- A profitable rule that breaches risk/monthly requirements is not a qualified
  upgrade; its economic effect and exact failure must both remain visible.
- Earlier-clock studies are useful priors, not current-clock certifications.
  Do not rerun every old grid: revalidate only named comparators needed by a new
  mechanism, explicitly recording which ones remain historical.

## 4. The strongest evidence we have not adequately developed

### A. Soft-stale TP has the largest measured component trade-off

| Window / model | B17 net / DD | Without soft-stale net / DD | Net change |
|---|---|---|---:|
| Published / touch | $46,832 / 28.17% | $59,178 / 25.48% | +$12,346 |
| Published / confirmed | $19,490 / 45.65% | $51,156 / 27.91% | +$31,666 |
| Recent / touch | $20,914 / 24.69% | $27,738 / 24.19% | +$6,824 |
| Recent / confirmed | $15,839 / 31.11% | $30,085 / 28.13% | +$14,246 |

This is not permission to disable it. In recent touch, winning dollars rise
$9,434 but losing dollars also rise $2,609; forced closes rise 10 -> 12. July
gets worse, from -$3,950 to -$6,426. Published touch January gets worse by $4,464.
All these costs already include the changed later ladder entries.

The unanswered question is **when the age-based 0.5% target is useful risk
recycling, versus when it exits a recovering inventory too cheaply**. We have
tested on/off, not a small set of causal context-dependent target policies.

### B. MFI-half is a narrow late-loss intervention

F04 weekly context improves the older original-half result, but selects the
same six/four recent model cases, all in June/early July. It has no new cut after
July 13. Its exact rule is depth >= 9, first gross loss <= -3%, wait exactly
60 minutes, MFI14 on 30m <= 20; then a 50% pro-rata cut and no later adds.

Thus we have barely tested:

- A recovery that starts and then fails at a known reference.
- A fresh lower low after an observed rebound rather than at a fixed timer.
- Strong buying that fails to lift price versus strong selling that stops
  pushing price down. Flow level and price response are different questions.
- Earlier exposure restraint before the inventory is already deep and down 3%.
- Whether freezing adds alone captures some of the half-exit's benefit.
- Whether the post-cut prohibition on adding helps or hurts independently.

F03 already tested some fixed rebound/retest descriptions. The new question is
an actual **event-driven action with a lifetime and invalidation rule**, across
all eligible distressed episodes, not merely another label on the same MFI set.

### C. Expansion and recycling deserve their own study

The last three fresh rungs supply about **61.6%** of the full $59,757 requested
inventory. A rung-11-only veto sees only the last part of that build-up.
Static dollar caps were tested in L06; that does not test a cap which depends
on already-observed volatility, the episode's damage or a failed recovery.

Current S/R trims also allow later rebuilding. The S/R-action cooldown is not
a blanket add cooldown. Removing S/R partials changes that entire path, not
just the booked trim profit. Possible controls are post-trim re-expansion
permissions and an episode-level expansion budget, not simply another near-
resistance percentage. Preserve the **transactional last actual add clock**;
older docs/helper comments describing reanchoring are not the current contract.

### D. New standalone avenues remain separate

S01 confirmation-wait entries are still unrun. They test oversold trigger ->
observed recovery -> entry, with immediate and unconditional-wait controls.
This is a different mechanism from entering on the oversold print itself.

R01-08, the 4h Bollinger downside/1h CMF short, passed its standalone profit
screen, not its defensive/strict screens. Its recent parent/refined net was
$907 -> $1,191 at the original $10k notional, with only 11 refined closes.
One avoided loss explains the refinement's recent gain. H01's added HL/S/R
filters all trailed that parent. Preserve it; do not invent more conditions
merely to rescue a sparse sample or treat it as a replacement for the paused
$25k live short. A corrected current-stack joint replay is still required.

## 5. Proposed order and bounded experiments

### Step 0: consolidate evidence, without another broad rerun

Reuse existing indicator features, F01/P01/F03 event data and accepted ledgers.
Add only missing **event-transition and action-opportunity** records:

- First observed distress, then known running low, rebound, reclaim, retest,
  subsequent failure, ordinary TP and forced exit.
- Actual eligibility/depth/exposure at each transition, not just the state at
  the eventual flatten. Include recoveries, no-action paths and censored ends.
- Before/after distinction for each known level; freeze its identity when the
  event starts. A pivot becomes usable at confirmation, not at the old pivot.
- At soft-stale eligibility, retain then-known trend, return/volatility,
  VWAP/recovery and room to already-known resistance.

Do not rebuild the all-indicator atlas or fit hundreds of cut points. This
small extension should produce an opportunity/sample table and then a frozen
card. The old P01 four-hour grid is not adequate for rejecting all brief signals.

### Step 1: loss-control mechanisms, not more MFI levels

Proposed first economic budget: **at most 12 new definitions**, including new
controls. Repeated B17/original-MFI/F04-weekly paths remain comparators, not new
strategies. The ceiling is not a target to fill with weak ideas.

First isolate two action components under the exact F04 trigger:

1. **Freeze adds only**, with no experimental sale.
2. **Half-exit with ordinary add permissions restored**, without bypassing
   existing gates or inventing a new re-entry signal.

The existing F04 half-plus-freeze is the paired comparator. Replenishment,
subsequent S/R trims and rung sizing must follow the real state transitions.
Do not assume these controls are distinct until the actual paths show it.

Then allocate up to eight definitions to four separate event mechanisms, each
with the same two actions: freeze expansion, or half-reduce plus freeze:

| Mechanism to specify | Distinction being tested |
|---|---|
| Broken support, observed retest, failure below the frozen boundary | Persistent failure versus an initial support breach that recovers |
| Observed rebound, failed local reclaim, then renewed weakness | Failure after recovery versus the first oversold print |
| Buy-dominant flow without price progress, followed by observed price failure | Ineffective buying versus simply requiring more selling |
| Renewed selling with a fresh price low and non-declining native OI | Continued pressure/new positioning versus declining-OI liquidation or deleveraging |

No MFI requirement for these broader branches. No assumption that every
distressed episode or every qualifying row is independent. Some mechanisms
may have too little valid data; leave those slots empty and report why.

This is **not yet an executable frozen card**: arming depth/loss, observation
clock, exact reference, trigger thresholds, expiry, recovery invalidation,
missing-data behavior and rearm permissions must be fixed before its economic
runs. Prefer existing validated quantities; no hindsight-selected bounce top,
bottom, threshold or best exit within a window. Count any added fixed-wait or
availability control against the remaining budget, or explicitly revise the
budget before running. No hidden Cartesian product.

Price-only branches receive both full/recent tests. HL-dependent branches use
genuinely covered periods with explicit availability and delay panels; a
long-history overlay which is inactive before HL exists is **not** validation
of HL during that older period.

### Step 2: conditional soft-stale TP, independently

Proposed budget: **up to four new policies**, with repeated B17 and no-soft-stale
controls. Evaluate a small set of distinct hypotheses, not a TP percentage grid:

- Retain the normal target longer only in already-observed healthy structure.
- Retain it only while an observed price/VWAP recovery remains intact.
- Retain it only when there is room to known resistance; unknown level context
  must not be silently treated as unlimited room.
- One unconditional later-age control to distinguish context from mere delay.

Specify each policy's transition rule before testing. Prefer a monotonic switch
from 1.4% to 0.5% over repeated target raising/lowering for this first study.
Keep hard flatten, emergency, funding exits and other gates authoritative.
A newly changed target cannot fill on an earlier high in the same candle.

The objective is to retain more of L09's profit improvement **without its
additional losing dollars and bad-month damage**. No profit estimate for these
conditional policies exists yet. None is to be combined with Step 1 in its
initial comparison.

### Step 3: inventory expansion and post-partial behavior

After the earlier steps, consider a separate budget of up to six definitions:
two volatility-conditioned spacing rules, two underwater/failed-recovery
expansion budgets and two post-partial re-expansion rules. Preserve repeated
L06 static-sizing/cap controls where needed; define all risk quantities as
observed price/exposure measures, not a guarantee about maximum exchange loss.

This is where to test changes before rungs 9-11, and whether profitable partials
are followed by costly inventory rebuilding. Do not combine a new spacing
curve, size curve, entry gate and exit in the same first variant.

If two independently useful interventions survive, compare **B17, A, B, A+B**.
Report the interaction `delta(A+B) - delta(A) - delta(B)` and changed occupancy;
standalone savings cannot be added arithmetically.

### Step 4: level/flow events and standalone follow-through

Keep current S/R geometry fixed while testing event response. Then, only if
the mechanism works, use a small alternate level-construction check to see if
it depends on exactly 30m/14d/0.45% geometry. Do not cross an S/R geometry sweep
with an indicator/pulse/exit sweep.

Potential later references include confirmed prior-day/week extremes,
event-anchored VWAP, level acceptance/reclaim and higher-/lower-timeframe
alignment. Test causal anchors and invalidation explicitly. Aggregated depth
cannot prove individual cancellations, and OHLCV volume profile is not exact
executed volume-at-price.

For a separate new trade stream, use the existing
[S01 specification](indicator-combinations-next-steps-2026-09-07.md#4-s01-waiting-for-price-recovery-is-a-different-strategy)
rather than inventing a duplicate. It budgets eight confirmation entries plus
eight fixed-wait controls and separately counted readiness checks. It has not
run. Standalone entries keep their own baselines; ladder influence and shared-
account dollar/DD/margin effects require subsequent actual joint replays.

## 6. What remains on the shelf, and why it is not first

- Donchian/Keltner breakouts, Bollinger squeeze -> expansion, Stochastic/%R,
  CHOP/KAMA, causal divergences, event-anchored VWAP and HYPE-relative-to-BTC
  residual strength: incomplete or untested under the new contracts. Select
  them to answer a mechanism question, not to finish a list of indicator names.
- Broader base/multiplier/rung/TP/timer optimization: not exhausted, but jointly
  searching these now makes attribution and overfitting worse. Fixed-notional
  profit cannot justify a different leverage or tail budget automatically.
- Re-enabling or adding many shorts: old short architecture, exit and uptrend-
  suspension campaigns already exist. None should be called new without a
  duplication/clock/date check; old forward failure remains relevant.
- F04 MFI threshold/timeframe neighbors: reasonable eventual sensitivity, but
  another sequence of tiny refinements on June/early-July cases is not new
  cross-regime evidence. Keep weekly-half frozen as the reference for now.

## 7. Research validity and reporting contract

1. Reproduce identical B17 controls on the same inputs and current transactional
   clock before each new economic card. No modification of accepted archives.
2. Keep all completed-bar and pulse availability clocks explicit. In prior
   studies an extra 60s of legacy HL lag made many 15m windows unavailable under
   the 14/15 floor. Do not lower that floor to manufacture a pass. If a window
   ending at the latest observable source bucket is proposed, it is a distinct
   source/feature contract requiring its own live-parity and delay tests.
3. Outcomes may label recoveries/failures after the fact; decisions cannot use
   those labels. Never evaluate only eventual flattens or only selected TPs.
4. Group repeated landmarks by episode and overlapping market events. Report
   unique dates and concentration; do not pool TP models or overlapping windows.
5. Keep the existing frozen economic screens. A rule may be net-positive yet
   fail the drawdown/monthly budget. Report both; do not retroactively relabel
   it as a pass. A different objective requires separate advance approval.
6. Add chronological and leave-one-event/month-out sensitivity as diagnostics,
   not an untouched holdout claim or a way to remove inconvenient months.
   Exclude overlapping outcomes when training/selecting for later periods.
7. More simulated variants are not more data. No guarantee exists of cutting
   every loser without sacrificing any winner. Track the actual trade-off:
   losing dollars saved versus winning dollars sacrificed, plus replacement
   trades and final open exposure.
8. Always show baseline-adjacent W/L, winning/losing dollars, realized/open/net,
   max DD, minimum equity, forced closes, worst month and every monthly delta.
   Add matched/removed/replacement episode attribution and source availability.
9. Fees remain fixed for discovery. Before promotion, account for the candidate's
   actual extra actions, funding/execution assumptions and portfolio interactions;
   fee differences are not guaranteed to be a constant offset across policies.
10. Research survival is not live authorization. A frozen candidate still needs
    the prescribed forward observation and operational review. No deployment
    follows automatically from this roadmap.

## 8. Recommended immediate handoff

**Next task:** reuse the accepted event/ledger material to freeze the Step 1
recovery-mechanism card and its two action-isolation controls, then run that
bounded economic comparison. Keep the soft-stale study queued immediately
after it, not forgotten behind further MFI threshold tweaks.

This broadens the economic questions while keeping each result interpretable.
It does not pretend the tested config is globally optimal, or that an enormous
search space guarantees an exploitable edge.

## Reading order

1. [Tested setups and old-clock boundaries](../../research/TESTED-SETUPS.md).
2. [L09 component audit](../../research/codex-astra-ladder-components-findings-2026-09-08.md).
3. [F01 recoveries](../../research/codex-astra-failed-recovery-findings-2026-09-08.md),
   [P01 pressure atlas](../../research/codex-astra-pressure-point-atlas-findings-2026-09-09.md),
   [F03 context](../../research/codex-astra-mfi-recovery-context-findings-2026-09-09.md).
4. [F04 actual weekly-filter replay](../../research/codex-astra-mfi-weekly-exit-findings-2026-09-09.md).
5. [Indicator coverage](../../research/INDICATOR-FINDINGS.md),
   [retained standalone mechanisms](../../research/COMBINATION-CANDIDATES.md),
   [S01 and prior combination roadmap](indicator-combinations-next-steps-2026-09-07.md).
