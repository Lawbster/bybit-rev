# Deep sizing and post-partial exposure: findings

September 5, 2026. Local research only. No live config, state, execution,
exchange operations, deployment, commit or push changed.

## TL;DR

- **A real replay-to-live timing mismatch was found and repaired before sizing.**
  The old replay reanchored the add timer after selected-rung partial exits;
  the live transactional path preserves the last actual add time. All four old
  digests reproduce with an explicit archival mode; four corrected baselines
  are the comparators below. This is a state-transition mismatch, not look-ahead.
- **Post-partial exposure can exceed a fresh ladder's size, but it is not the
  dominant recent loss source.** Among 25 comparable complete live-log partials,
  18 retained more entry cost than a fresh same-count ladder. In the corrected
  HL baselines, **74-88% of gross losing-episode cost** comes from episodes
  with no S/R partial. These are descriptive cohorts, not predictive rules.
- **Six frozen sizing variants plus cap10 control, 28 variant cases: 0/7 pass
  the full screens.** All reduce DD in all four cases. Halving rung 11 cuts HL
  gross losses by **11.9-14.5%** and DD by **3.34-4.13pp**, but the longer
  resting-touch control loses **$7,520 (16.1% of baseline profit)**. Protection
  is real; a robust cheap/free improvement is not established.

## Follow-up: baseline versus half-size rung 11, wins and losses

Requested September 5: separate winning-cycle income from losing-cycle cost,
always show baseline, and keep periods and execution assumptions separate.
This is a recomputation of the accepted saved runs, not a new optimization.

One win/loss means a **completed flat-to-flat ladder episode**, including its
earlier S/R partial PnL and modeled entry/exit fees (0.055% each side). A
profitable partial followed by a larger loss is not counted as a separate win.
The unfinished final episode is marked separately, never counted as a completed
loss. These are simulated long-only results starting flat with $32,000, not
authenticated live account returns or complete funding/maker-fill accounting.

### Recent period: May 17, 2026 20:43 to September 4, 2026 19:01 UTC

| Resting-touch TP model | Baseline | Half-size rung 11 |
|---|---:|---:|
| Completed episodes | 299 | 300 |
| Winning / losing episodes | 289 / 10 | 290 / 10 |
| Win rate | 96.66% | 96.67% |
| Total winning-episode PnL | +$56,071.59 | +$50,882.37 |
| Total losing-episode PnL | -$33,009.35 | -$29,094.95 |
| Average win / loss | +$194.02 / -$3,300.93 | +$175.46 / -$2,909.49 |
| Completed-episode net | +$23,062.24 | +$21,787.42 |
| Final open-episode mark | -$302.32 | -$345.73 |
| Total including final mark | +$22,759.92 | +$21,441.69 |
| Maximum drawdown | 24.69% | 21.35% |
| Forced closes | 10 | 10 |

| Close-confirmed, next-open TP model | Baseline | Half-size rung 11 |
|---|---:|---:|
| Completed episodes | 252 | 249 |
| Winning / losing episodes | 241 / 11 | 238 / 11 |
| Win rate | 95.63% | 95.58% |
| Total winning-episode PnL | +$58,958.29 | +$54,563.94 |
| Total losing-episode PnL | -$40,192.40 | -$34,377.15 |
| Average win / loss | +$244.64 / -$3,653.85 | +$229.26 / -$3,125.20 |
| Completed-episode net | +$18,765.89 | +$20,186.79 |
| Final open-episode mark | -$1,297.77 | -$1,120.71 |
| Total including final mark | +$17,468.13 | +$19,066.09 |
| Maximum drawdown | 31.11% | 26.98% |
| Forced closes | 12 | 12 |

### Longer period: July 1, 2025 00:00 to August 19, 2026 21:32 UTC

| Resting-touch TP model | Baseline | Half-size rung 11 |
|---|---:|---:|
| Completed episodes | 1,012 | 981 |
| Winning / losing episodes | 955 / 57 | 926 / 55 |
| Win rate | 94.37% | 94.39% |
| Total winning-episode PnL | +$187,738.05 | +$166,260.28 |
| Total losing-episode PnL | -$140,905.55 | -$126,948.14 |
| Average win / loss | +$196.58 / -$2,472.03 | +$179.55 / -$2,308.15 |
| Net PnL (both finish flat) | +$46,832.49 | +$39,312.14 |
| Maximum drawdown | 28.17% | 25.45% |
| Forced closes | 59 | 59 |

| Close-confirmed, next-open TP model | Baseline | Half-size rung 11 |
|---|---:|---:|
| Completed episodes | 848 | 832 |
| Winning / losing episodes | 788 / 60 | 774 / 58 |
| Win rate | 92.92% | 93.03% |
| Total winning-episode PnL | +$190,818.85 | +$173,903.59 |
| Total losing-episode PnL | -$171,329.22 | -$150,548.70 |
| Average win / loss | +$242.16 / -$2,855.49 | +$224.68 / -$2,595.67 |
| Net PnL (both finish flat) | +$19,489.63 | +$23,354.89 |
| Maximum drawdown | 45.65% | 31.35% |
| Forced closes | 63 | 63 |

### Where the difference comes from

Every dollar below is half-size rung 11 minus its same-window/model baseline.
Positive loss savings mean a smaller total losing-episode bill.

| Period / TP model | Change in winner income | Loss savings | Change in final open mark | Total net change |
|---|---:|---:|---:|---:|
| Recent / resting-touch | -$5,189.22 | +$3,914.40 | -$43.41 | -$1,318.23 |
| Recent / close-confirmed | -$4,394.35 | +$5,815.25 | +$177.06 | +$1,597.96 |
| Longer / resting-touch | -$21,477.77 | +$13,957.41 | $0.00 | -$7,520.36 |
| Longer / close-confirmed | -$16,915.26 | +$20,780.52 | $0.00 | +$3,865.26 |

**Winning-cycle income falls in all four cases. Where completed-cycle net
improves, smaller aggregate losses outweigh that lost winning income.** This
does not establish better signal discrimination or fewer forced exits. The
forced-close count is unchanged in all four cases, although individual episode
paths, timings and reasons differ. For example, longer resting-touch changes
36 hard flattens plus 2 emergency kills to 35 plus 3; both also have 21 funding
exits. Two fewer losing episodes there reflect more profitable funding exits,
not two fewer forced exits. These are full-path aggregate decompositions, not
one-to-one matching of the same trades or removal of bad events with hindsight.

Verification: rechecked the accepted baseline.json and results.json SHA-256
values below; matched each of the eight saved summaries to those archives;
independently rebuilt all 4,773 completed episode PnLs from saved inventory
fills and fees; reconciled wins, losses and final inventory marks to the prior
net totals. These overlapping model runs are not 4,773 independent market
observations. No accepted output, strategy, config or production file changed.

## Follow-up: month-by-month loss concentration

Same frozen baseline and last11_50 runs as above, not a new replay or another
parameter search. Four paired window/model comparisons; the histories overlap.

### Reading these tables

- Loss columns sum **net-negative completed ladder episodes**, after modeled
  trading fees and all their earlier partial exits. Parentheses are losing
  episode counts. Each entire episode is attributed to its final-close UTC month.
- Net columns show the **monthly change in modeled equity**, including winning
  activity, losses, partial proceeds when realized, and changes in marked open
  inventory. These reconcile to the previous total-PnL comparisons.
- These are deliberately different accounting views. Loss cost is not a net
  monthly loss, and subtracting the loss column from net does not reconstruct
  winning-cycle income. Partial proceeds can predate the final-close month;
  a ladder can also carry an already-marked loss across a month boundary.
- Values are rounded to dollars; totals use unrounded inputs. $0 loss does not
  mean zero open risk. Both policies start flat with $32,000; live funding and
  exact maker/native fills remain outside the certified model scope.

### Recent: May 17, 2026 20:43 to September 4, 2026 19:01 UTC

May and September are partial months.

| Resting-touch / UTC month | Baseline losses (n) | Half-11 losses (n) | Baseline net | Half-11 net |
|---|---:|---:|---:|---:|
| 2026-05 (partial) | $0 (0) | $0 (0) | +$13,483 | +$11,911 |
| 2026-06 | -$24,396 (5) | -$21,447 (5) | +$1,584 | +$1,918 |
| 2026-07 | -$8,542 (4) | -$7,427 (4) | -$3,950 | -$2,380 |
| 2026-08 | -$71 (1) | -$221 (1) | +$9,684 | +$8,326 |
| 2026-09 (partial) | $0 (0) | $0 (0) | +$1,959 | +$1,667 |
| **Total** | **-$33,009 (10)** | **-$29,095 (10)** | **+$22,760** | **+$21,442** |

| Close-confirmed / UTC month | Baseline losses (n) | Half-11 losses (n) | Baseline net | Half-11 net |
|---|---:|---:|---:|---:|
| 2026-05 (partial) | $0 (0) | $0 (0) | +$17,131 | +$16,332 |
| 2026-06 | -$26,870 (6) | -$23,967 (6) | -$2,243 | -$3,832 |
| 2026-07 | -$13,167 (4) | -$10,189 (4) | -$7,858 | -$4,908 |
| 2026-08 | -$155 (1) | -$221 (1) | +$10,239 | +$10,483 |
| 2026-09 (partial) | $0 (0) | $0 (0) | +$201 | +$990 |
| **Total** | **-$40,192 (11)** | **-$34,377 (11)** | **+$17,468** | **+$19,066** |

June-July share of all losing-episode dollars:

| Recent TP model | Baseline | Half-size rung 11 |
|---|---:|---:|
| Resting-touch | 99.78% ($32,938 of $33,009) | 99.24% ($28,874 of $29,095) |
| Close-confirmed | 99.61% ($40,037 of $40,192) | 99.36% ($34,157 of $34,377) |

The concentration is real in this window. But the opening May slice excludes
the earlier part of May, and September ends on the fourth; neither is a full
month of exposure. May's $0 losing-cycle cost here is not true for full May in
the longer run below.

### Longer: July 1, 2025 00:00 to August 19, 2026 21:32 UTC

August 2026 is partial and does not include the later August loss in the recent
window. Do not pool these overlapping histories as independent observations.

| Resting-touch / UTC month | Baseline losses (n) | Half-11 losses (n) | Baseline net | Half-11 net |
|---|---:|---:|---:|---:|
| 2025-07 | -$13,473 (15) | -$11,992 (14) | +$2,668 | +$1,872 |
| 2025-08 | -$15,251 (4) | -$13,706 (4) | +$561 | -$52 |
| 2025-09 | -$7,001 (4) | -$6,212 (4) | +$5,608 | +$4,351 |
| 2025-10 | -$11,114 (5) | -$9,757 (4) | +$7,325 | +$5,429 |
| 2025-11 | -$5,521 (3) | -$4,824 (3) | -$1,443 | -$825 |
| 2025-12 | -$5,660 (2) | -$4,680 (2) | -$509 | +$712 |
| 2026-01 | -$12,219 (5) | -$10,720 (5) | -$246 | +$205 |
| 2026-02 | -$13,900 (3) | -$12,178 (3) | +$4,940 | +$4,640 |
| 2026-03 | -$1,725 (1) | -$2,599 (1) | +$11,159 | +$8,575 |
| 2026-04 | -$17,385 (4) | -$15,390 (4) | +$2,065 | +$2,259 |
| 2026-05 | -$4,718 (2) | -$6,016 (2) | +$15,753 | +$11,732 |
| 2026-06 | -$24,396 (5) | -$21,447 (5) | +$1,584 | +$1,918 |
| 2026-07 | -$8,542 (4) | -$7,427 (4) | -$3,950 | -$2,380 |
| 2026-08 (partial) | $0 (0) | $0 (0) | +$1,317 | +$875 |
| **Total** | **-$140,906 (57)** | **-$126,948 (55)** | **+$46,832** | **+$39,312** |

| Close-confirmed / UTC month | Baseline losses (n) | Half-11 losses (n) | Baseline net | Half-11 net |
|---|---:|---:|---:|---:|
| 2025-07 | -$19,614 (16) | -$12,758 (14) | -$3,050 | +$2,051 |
| 2025-08 | -$12,589 (3) | -$13,534 (4) | +$1,420 | +$2,340 |
| 2025-09 | -$6,719 (4) | -$5,803 (4) | +$6,247 | +$5,810 |
| 2025-10 | -$11,049 (5) | -$10,416 (4) | +$7,167 | +$5,460 |
| 2025-11 | -$5,428 (3) | -$5,475 (3) | -$688 | -$705 |
| 2025-12 | -$5,331 (2) | -$4,640 (2) | +$673 | +$1,347 |
| 2026-01 | -$21,883 (6) | -$18,548 (6) | -$8,750 | -$5,637 |
| 2026-02 | -$22,238 (4) | -$19,577 (4) | -$6,255 | -$5,042 |
| 2026-03 | -$1,340 (1) | -$2,716 (1) | +$12,689 | +$9,449 |
| 2026-04 | -$17,882 (4) | -$15,660 (4) | +$2,401 | +$1,618 |
| 2026-05 | -$7,219 (2) | -$7,265 (2) | +$15,721 | +$13,582 |
| 2026-06 | -$26,870 (6) | -$23,967 (6) | -$2,243 | -$3,832 |
| 2026-07 | -$13,167 (4) | -$10,189 (4) | -$7,858 | -$4,908 |
| 2026-08 (partial) | $0 (0) | $0 (0) | +$2,017 | +$1,821 |
| **Total** | **-$171,329 (60)** | **-$150,549 (58)** | **+$19,490** | **+$23,355** |

### What the monthly view establishes

- **Recent loss dollars are concentrated in June-July, but longer-history losses
  are not confined to two or three months.** Each setup/model has losing cycles
  in 13 of 14 longer-window months. The largest three months hold 40.48% of
  baseline resting-touch losses versus 39.81% for half-11 (June/April 2026 and
  August 2025); close-confirmed is 41.44% versus 41.24% (June/February/January 2026).
- **July 2026 improves in both models without becoming profitable.** Net goes
  from -$3,950 to -$2,380 in resting-touch, and -$7,858 to -$4,908 in
  close-confirmed. This is less damage, not a recovered winning month.
- **Smaller loss totals do not guarantee a better net month.** June
  close-confirmed loses $26,870 versus $23,967 across six losing cycles, but
  winning-cycle income drops from $26,094 (99 winners) to $21,447 (91 winners).
  Monthly net worsens from -$2,243 to -$3,832. Conversely, recent resting-touch
  June has five large losers but enough winners to finish +$1,584 / +$1,918.
- **Not every loss improves with smaller size.** Longer resting-touch March
  loses $1,725 versus $2,599, and May loses $4,718 versus $6,016. Different
  weighted entries and subsequent exit/re-entry paths matter; this is not a
  proportional haircut to an identical fixed trade list.

Grouping by eventual close month is outcome attribution only. It does not show
that we could identify those months, or selectively shrink only their losers,
using information available before the adds. No new filter, regime label or
deployment recommendation follows from this table alone.

Verification: accepted baseline/results hashes rechecked; all eight monthly
loss-count/dollar series independently recomputed from closes.csv using final
close PnL plus trimPnlInEpisode, and matched to saved episode summaries.
Monthly losses, winners and equity changes reconcile to their full-run totals.
This follow-up changes documentation only; saved simulations remain untouched.

## What changed, and why this changes earlier claims

Production S/R selection is still shared with replay:
[src/bot/sr-shadow.ts](../src/bot/sr-shadow.ts), buildPartialExitPlan, sorts by
current gross dollar PnL and closes the most profitable selected positions.
The active call site in [index.ts](../src/bot/index.ts) builds a selected-ID
allocation and uses the guarded transactional partial-close coordinator.

However, the replay used the lastAddTime semantics of the older
StateManager.closePositionsByIndices helper. The actual active state methods,
applyObservedPartialFill and finalizePartialClose, **do not move lastAddTime
backward while any inventory remains**. Selection of the most recent rung
for closure does not erase the fact that an add just occurred.

Relevant sources:

- [index.ts](../src/bot/index.ts): selected-ID action around 2497-2547; timing
  reads s.lastAddTime around 2745; size uses s.positions.length around 3576.
- [state.ts](../src/bot/state.ts): legacy helper around 306-340 versus actual
  transactional apply/finalize around 1006-1115.
- [partial-close-coordinator.ts](../src/bot/partial-close-coordinator.ts):
  apply/finalize path, including startup pending resolution.
- [replay-causal-engine.ts](../scripts/replay-causal-engine.ts): default is now
  transactional preservation; legacy_reanchor is explicit archival behavior.
- [replay-current-stack-tests.ts](../scripts/replay-current-stack-tests.ts):
  old legacy-helper assertion is now labelled correctly; engine clock assertion
  updated. [New tests](../scripts/ladder-sizing-tests.ts) execute the actual
  transactional state API, including fragmented cumulative fills.

The replay also gains an optional reduce-only sizing callback and immutable
inventory observer. Neither is imported by the live bot. An inactive size hook
and observer preserve complete results for the same clock model.

### Clock-only baseline changes

| Case | Old net $ | Corrected net $ | Clock-only delta $ | Old DD | Corrected DD |
|---|---|---|---|---|---|
| hl_window_latest-close_confirmed | 17413.84 | 17468.13 | +54.29 | 31.10% | 31.11% |
| hl_window_latest-resting_touch | 21983.77 | 22759.92 | +776.15 | 23.36% | 24.69% |
| published_window-close_confirmed | 17071.51 | 19489.63 | +2418.12 | 47.74% | 45.65% |
| published_window-resting_touch | 43005.85 | 46832.49 | +3826.65 | 33.00% | 28.17% |

HL: May 17, 2026 20:43 through September 4 19:01 UTC.
Published: July 1, 2025 through August 19, 2026 21:32 UTC.

These are **not strategy profits gained by a patch on the VPS**. The correction
changes our estimate of an already-existing live behavior. The corrected
resting-touch HL profit increases while its DD also increases, illustrating
why a higher net total is not automatically safer.

Earlier exposure/drop/persistent findings remain preserved as results of their
recorded clock model. Their exact current-stack numerical rankings are
**not recertified** by this pass. This pass reruns the baseline and cap10 under
the corrected clock, not the entire earlier pulse grid. Existing source hash
checks must not be weakened to pretend old harnesses used the new source.

### Concrete timer trace

Same pre-partial inventory in old and corrected HL close-confirmed runs:

1. May 25 **05:46 UTC**: latest actual add.
2. **05:56 UTC**: S/R partial fills. Survivors were opened through **05:30**.
3. Old replay resets the clock to 05:30 and next adds at **06:00**, $62.463.
4. Corrected replay keeps 05:46 and next adds at **06:16**, $62.387.

Both prices are real next-open model fills. No future value enters the decision.
This trace proves an earlier timer permission under the wrong transition;
it does not claim every affected partial changes an actual trade. Price-drop
eligibility and other gates remain independent.

## Exposure audit: what remaining rung count means

Standard sizing at $800 x 1.35:

- Fresh three-rung entry cost: **$3,338.00**.
- Fresh ten-rung entry cost: **$43,672.13**.
- Fresh eleven-rung entry cost: **$59,757.37**.
- Standard next eleventh add: **$16,085.24**.

After partials the bot does not renumber or resize surviving inventory. It
uses the count to size the next add; larger old positions may remain.
Thus count alone does not specify current dollars at risk.

For every modeled fill, the audit records immutable before/after inventory.
For every modeled S/R partial it verifies decision-price selection and complete
selected-ID allocation using the production allocator, surviving quantity and
cost, and timer continuity. The model assumes complete planned fills; actual lot
rounding or terminal partial fills can leave residual rungs. Full live receipt,
fragmentation and maker/native state parity are not certified.

### Actual synced event evidence

Input: data/HYPEUSDT_sr_partial_exit_actions.jsonl.
July 7 through September 4; **26 unique executed order IDs**.

- 25 have a unique matching candidate and complete planned-quantity/count evidence.
- One older underfill is excluded from retained-cost comparisons, not zero-cleared.
- **18/25** comparable events leave more than $1 above the current fresh
  same-count entry-cost comparator.
- August 12 17:11:31 UTC leaves three rungs representing **$11,087.47** entry cost,
  compared with $3,338 fresh. This is reported event arithmetic, not a new
  authenticated exchange position reconstruction.

The fresh comparator is the current $800/1.35 policy, not proof every older
configuration was identical. This file does not establish subsequent complete
episode PnL or historical lastAddTime; the transactional state test establishes
the latter mechanism. Realized partial profit is not full-ladder profit.

Reproducer: [live partial audit](../scripts/ladder-live-partial-exposure-audit.ts).
Separate output: backtests/hype/hype-ladder-live-exposure-audit-2026-09-05.json.

### Corrected baseline frequency and both sides of PnL

| Case | All episodes (completed) | With partial (completed) | Inflated after partial | Over fresh11 cost | Gross loss: no partial $ | Gross loss: with partial $ | Gross win: with partial $ |
|---|---|---|---|---|---|---|---|
| hl_window_latest-close_confirmed | 253 (252) | 53 (53) | 40 | 9 | 35489.53 | 4702.87 | 18005.56 |
| hl_window_latest-resting_touch | 300 (299) | 60 (60) | 43 | 12 | 24448.74 | 8560.61 | 19677.10 |
| published_window-close_confirmed | 848 (848) | 136 (136) | 104 | 26 | 142457.31 | 28871.91 | 42784.30 |
| published_window-resting_touch | 1012 (1012) | 148 (148) | 105 | 23 | 115317.40 | 25588.16 | 45190.37 |

Gross winning/losing episode aggregates include prior partials and modeled fees.
A profitable partial followed by a larger losing full close is counted as the
net complete episode, not a stand-alone win. The final unfinished HL episode is
not assigned an invented final outcome.

In HL close-confirmed, no-partial episodes bear **$35,489.53 / $40,192.40**
gross losses (88.3%). In resting-touch it is **$24,448.74 / $33,009.35** (74.1%).

The 9 / 12 HL episodes that exceeded fresh-eleven entry cost all finish net
positive, producing $5,638.67 / $6,893.21 of gross wins. That does not prove
inflated exposure safe: in published close-confirmed, the analogous cohort has
five losers and $16,310.21 gross loss. It does mean that attributing the recent
bleeding mainly to repeated post-partial rebuilding would be wrong.

These outcome-conditioned subsets are diagnostic only. We do not use eventual
partials, losses or cohort membership as decision inputs.

## Frozen sizing policies

[Definition](../research-inputs/sr-pulse-encounters/ladder-sizing-2026-09-05.json)
and [method](../docs/research/ladder-sizing.md) precede the comparisons.

| ID | Intervention |
|---|---|
| last11_75 | Standard rung 11 at 75% size |
| last11_50 | Standard rung 11 at 50% size |
| deep9_75 | Standard rungs 9-11 at 75% size |
| deep9_50 | Standard rungs 9-11 at 50% size |
| cost_cap10 | Clip adds to $43,672.13 surviving entry cost |
| cost_cap10_half11 | Clip adds to $51,714.75 surviving entry cost |
| cap10_control | Skip next-depth 11 entirely; count cap, not dollar cap |

Fractions multiply the original count-based requested size, not the previous
executed size recursively. The caps include old retained inventory and permit
an add only when at least $800 of cap room remains. $800 is a research minimum
(one base rung), not a claimed exchange order minimum. No forced liquidation,
new exit, same-slot top-up, timing gate, pulse threshold or S/R geometry change.

The original gates and full-request affordability check run first. A smaller
research order does not bypass a rejection of the original affordability check.
Existing TP, partials, forced exits and subsequent ladder paths remain active.

## All-variant ranking versus corrected baseline

Sorted by the worse of the two HL net-PnL deltas. These are dollar differences,
not percent improvements or live account returns. Counts across models/windows
overlap and must not be pooled as independent trades.

| Rule | HL close $ | HL touch $ | Published close $ | Published touch $ | Min HL loss reduction | Min HL DD cut pp | HL affected episodes |
|---|---|---|---|---|---|---|---|
| last11_75 | -124.30 | -1135.76 | -3032.34 | -6003.43 | 5.09% | 0.83 | 94 / 99 |
| last11_50 | +1597.96 | -1318.23 | +3865.26 | -7520.36 | 11.86% | 3.34 | 94 / 100 |
| cost_cap10_half11 | +1569.89 | -1477.09 | +4292.53 | -7267.48 | 11.86% | 3.28 | 94 / 100 |
| deep9_75 | -2463.45 | -1251.53 | -5206.35 | -8371.58 | 14.20% | 3.90 | 120 / 129 |
| cap10_control | -2610.42 | -1479.07 | +7936.33 | -15396.86 | 23.23% | 6.82 | 90 / 104 |
| cost_cap10 | -2691.74 | -1307.83 | +6791.49 | -15122.18 | 23.94% | 6.82 | 93 / 106 |
| deep9_50 | -2121.36 | -3162.83 | +7127.56 | -14319.20 | 25.90% | 8.13 | 122 / 131 |

### Risk, recoveries and opportunity cost

| Rule / HL model | DD | Worst episode $ | TP-cycle delta | Forced-close delta | Peak entry cost $ | Gross-win delta $ |
|---|---|---|---|---|---|---|
| last11_75 / close | 30.28% | -7935.94 | -12 | 0 | 65746.84 | -2785.89 |
| last11_50 / close | 26.98% | -7361.08 | -3 | 0 | 56267.81 | -4394.35 |
| deep9_75 / close | 26.71% | -7194.64 | -18 | 0 | 56722.81 | -9643.12 |
| deep9_50 / close | 22.68% | -5878.48 | -16 | 0 | 47516.27 | -14537.29 |
| cost_cap10 / close | 24.21% | -6211.36 | -25 | 0 | 43672.13 | -13022.77 |
| cost_cap10_half11 / close | 26.83% | -7361.08 | -3 | 0 | 51714.75 | -4590.37 |
| cap10_control / close | 24.26% | -6211.36 | -25 | 0 | 48036.56 | -12744.04 |
| last11_75 / touch | 23.65% | -7909.26 | 0 | 0 | 60610.79 | -2794.00 |
| last11_50 / touch | 21.35% | -7297.62 | 1 | 0 | 56589.48 | -5189.22 |
| deep9_75 / touch | 20.79% | -7188.37 | -4 | 1 | 55425.56 | -6240.82 |
| deep9_50 / touch | 16.56% | -5873.73 | -11 | 1 | 47894.27 | -12013.46 |
| cost_cap10 / touch | 17.87% | -6221.10 | -1 | 0 | 43672.13 | -9123.09 |
| cost_cap10_half11 / touch | 21.41% | -7297.62 | 1 | 0 | 51714.75 | -5348.08 |
| cap10_control / touch | 17.88% | -6221.10 | 0 | 0 | 48546.86 | -9060.29 |

All seven reduce maximum DD in all four cases. This is a more consistent
protective mechanism than the prior pulse holds under their original model,
but the old pulse grid was not rerun here.

Halving rung 11 is the narrower trade-off:
HL net delta **+$1,598 / -$1,318**, gross-loss reduction **14.47% / 11.86%**,
DD cut **4.13 / 3.34pp**. Worst modeled HL episode falls from about
$8.51k / $8.43k to **$7.36k / $7.30k**. However, it loses $7,520 in published
resting-touch and $4,021 in its worst monthly comparison. It does not reduce
forced-close frequency in any case.

Halving all rungs 9-11 cuts HL gross losses **29.93% / 25.90%**, DD **8.43 / 8.13pp**
and worst episode to about **$5.88k**. HL profit costs **$2,121 / $3,163**;
published resting-touch cost is **$14,319 (30.6%)** with **66 fewer TP cycles**.
This is substantial risk reduction with substantial opportunity cost.

The dollar cap at fresh-ten cost is genuine bounding of modeled entry-cost
exposure, but not proof of a cheaper trade-off than the count cap.

### Dollar cap versus its nearest size/count comparator

First row: cost_cap10 minus cap10_control.
Second row: cost_cap10_half11 minus last11_50.

| Rule | HL close $ | HL touch $ | Published close $ | Published touch $ |
|---|---|---|---|---|
| cost_cap10 | -81.32 | +171.25 | -1144.84 | +274.68 |
| cost_cap10_half11 | -28.07 | -158.86 | +427.27 | +252.88 |

The additional post-partial bounding effect is mixed, not consistently positive
alpha. The ten-rung count cap still reaches **$48.0k / $48.5k** peak entry cost
in HL, whereas cost_cap10 never exceeds **$43,672.13**. This operationally clearer
bound is not itself proof of superior returns.

### Recovery duration is not uniformly improved

The longest observed interval below each path's own prior **close-marked equity
high** includes ongoing underwater periods at the data cutoff. It is not the
same as adverse-intrabar DD or a promise of when a live account will recover.

In HL close-confirmed, baseline is **1,817 hours**, versus **2,227 hours** for
every sizing variant. Shallower losses do not necessarily recover earlier when
profitable exposure is also reduced. In HL resting-touch, halving rung 11 changes
**2,004 -> 1,936 hours**, while cost_cap10 changes **2,004 -> 1,124 hours**.
Exact durations for every case are retained in summary.csv.

## Monthly stability: all seven variants

Monthly mark-to-market PnL deltas versus the corrected baseline, rounded to
whole dollars. All seven are shown, including all top-five rules. Exact
realized/MTM deltas are retained in monthly.csv. May/September HL and August
published rows are partial months. Price-only sizing applies throughout the
published window; unlike pulse gates, early nonzero results are meaningful
model interventions, though the history is still repeatedly mined.

### hl_window_latest-close_confirmed

| UTC month | last11_75 | last11_50 | cost_cap10_half11 | deep9_75 | cap10_control | cost_cap10 | deep9_50 |
|---|---|---|---|---|---|---|---|
| 2026-05 | -1510 | -798 | -840 | -3128 | -4680 | -4796 | -4820 |
| 2026-06 | -543 | -1588 | -1556 | -913 | -613 | -578 | +138 |
| 2026-07 | +658 | +2951 | +2951 | +3017 | +3440 | +3440 | +4037 |
| 2026-08 | +430 | +244 | +244 | -1315 | -751 | -751 | -2109 |
| 2026-09 | +841 | +790 | +772 | -125 | -6 | -6 | +633 |

### hl_window_latest-resting_touch

| UTC month | last11_75 | last11_50 | cost_cap10_half11 | deep9_75 | cap10_control | cost_cap10 | deep9_50 |
|---|---|---|---|---|---|---|---|
| 2026-05 | -1136 | -1573 | -1590 | -1746 | -2388 | -2387 | -2403 |
| 2026-06 | -52 | +334 | +228 | +819 | +1890 | +1767 | +298 |
| 2026-07 | +419 | +1570 | +1554 | +976 | +1420 | +1602 | +1441 |
| 2026-08 | -221 | -1358 | -1358 | -1420 | -1877 | -1877 | -2366 |
| 2026-09 | -146 | -292 | -310 | +119 | -524 | -413 | -133 |

### published_window-close_confirmed

| UTC month | last11_75 | last11_50 | cost_cap10_half11 | deep9_75 | cap10_control | cost_cap10 | deep9_50 |
|---|---|---|---|---|---|---|---|
| 2025-07 | +2617 | +5101 | +5149 | +2348 | +683 | +683 | +1615 |
| 2025-08 | +604 | +920 | +829 | +654 | +475 | +501 | -383 |
| 2025-09 | -186 | -437 | -437 | -623 | -3735 | -3745 | -937 |
| 2025-10 | -300 | -1707 | -1751 | -2505 | -481 | -483 | -2093 |
| 2025-11 | -150 | -17 | +106 | +122 | -185 | -60 | -43 |
| 2025-12 | +240 | +674 | +601 | +105 | +10 | -3 | +654 |
| 2026-01 | +846 | +3112 | +3110 | +3650 | +4509 | +4494 | +6032 |
| 2026-02 | -1342 | +1213 | +1213 | -354 | +11266 | +11266 | +10562 |
| 2026-03 | -3605 | -3239 | -3163 | -8179 | -2248 | -3597 | -5714 |
| 2026-04 | -590 | -783 | -711 | +965 | -1400 | -1198 | -642 |
| 2026-05 | -1255 | -2139 | -1852 | -3308 | -3218 | -3361 | -5583 |
| 2026-06 | -543 | -1588 | -1556 | -913 | -613 | -578 | +138 |
| 2026-07 | +658 | +2951 | +2951 | +3017 | +3440 | +3440 | +4037 |
| 2026-08 | -27 | -196 | -196 | -187 | -567 | -567 | -516 |

### published_window-resting_touch

| UTC month | last11_75 | last11_50 | cost_cap10_half11 | deep9_75 | cap10_control | cost_cap10 | deep9_50 |
|---|---|---|---|---|---|---|---|
| 2025-07 | +466 | -796 | -796 | -486 | -4603 | -4603 | -4855 |
| 2025-08 | -998 | -613 | -625 | -1851 | -156 | -168 | +657 |
| 2025-09 | -109 | -1257 | -1257 | +46 | -838 | -838 | -2212 |
| 2025-10 | -899 | -1896 | -1896 | -1775 | -2137 | -2150 | -2059 |
| 2025-11 | +21 | +617 | +741 | +61 | +442 | +567 | -310 |
| 2025-12 | +448 | +1222 | +1164 | +1328 | +1026 | +967 | +1521 |
| 2026-01 | +222 | +451 | +427 | +980 | +362 | +357 | +1376 |
| 2026-02 | +1017 | -300 | -309 | -1197 | +1303 | +1303 | -144 |
| 2026-03 | -2564 | -2585 | -2409 | -2818 | -6297 | -6105 | -6254 |
| 2026-04 | +1 | +195 | +397 | -62 | +492 | +483 | +395 |
| 2026-05 | -3699 | -4021 | -4044 | -4077 | -7795 | -7799 | -3648 |
| 2026-06 | -52 | +334 | +228 | +819 | +1890 | +1767 | +298 |
| 2026-07 | +419 | +1570 | +1554 | +976 | +1420 | +1602 | +1441 |
| 2026-08 | -276 | -442 | -442 | -316 | -505 | -505 | -523 |

## Causal cap decision trace

HL close-confirmed, cost_cap10_half11, May 18 **15:07 UTC**:

- Known decision price: **$44.393**; next depth 11, genuine drop eligible.
- Existing entry cost **$45,759.63**; standard requested add **$16,085.24**.
- Fixed cap **$51,714.75** leaves **$5,955.12**, above the $800 minimum.
- Only that amount is queued. It fills at the next modeled open, **$44.393**,
  quantity **134.1454136338**: decision index 761891, fill index 761892.

The decision candle closes at the same boundary timestamp as the next candle
opens. The equal prices/timestamps do not mean execution used the current
candle's earlier low. The distinct next index and independent source replay are
verified. No subsequent price, eventual loss or future partial enters the size.

## Execution and accounting sensitivity

Same $32k modeled initial equity, current $800/1.35 policy, fees **0.055% each
side**, corrected causal history. The close-confirmed and resting-touch models
are brackets, not exact maker/native execution reconstruction.

Actual funding settlements, live order/lot rounding, ten-second polling,
outages, liquidation and shared-account wallet effects are not certified.
The cap controls **entry cost**, not marked notional or collateral consumption.

As an additional fixed-path cost diagnostic, charge **5bps extra per side**
on every executed notional, plus the modeled final inventory liquidation.
These are stressed variant-minus-stressed-baseline dollars:

| Rule | HL close $ | HL touch $ | Published close $ | Published touch $ |
|---|---|---|---|---|
| last11_75 | +337.41 | -681.78 | -793.48 | -3866.37 |
| last11_50 | +2323.93 | -312.06 | +7347.20 | -3214.88 |
| cost_cap10_half11 | +2321.46 | -437.72 | +7885.61 | -2905.54 |
| deep9_75 | -939.58 | +64.56 | -857.06 | -3401.33 |
| cap10_control | -491.58 | +421.72 | +15019.57 | -7217.89 |
| cost_cap10 | -542.51 | +657.06 | +14001.02 | -6863.13 |
| deep9_50 | +143.12 | -827.28 | +15189.67 | -4910.91 |

This favors lower-turnover paths mechanically. It is not a new slippage-path
replay, funding settlement simulation or reason to retune thresholds. Every
variant remains negative against published resting-touch even under this
extra-cost scenario. A modest new live edge is not established by fee savings.

## Acceptance and scope boundary

Unchanged research screens:

- Profit upgrade: both HL models >=$1,000 net lift and >=10% gross-loss reduction;
  no case DD worsening; nonnegative published net deltas; every month >=-$250.
- Defensive trade-off: both HL models >=20% gross-loss reduction and >=3pp DD cut;
  >=90% baseline profit retained in every case; published DD worsening <=0.5pp;
  every month >=-$500.
- At least 20 affected episodes per HL model. No candidate fails merely from
  thin intervention counts here.

**0/7 pass.** This does not falsify sizing as risk control: all cases reduce DD.
It rejects the tested rules as qualifying upgrades under the declared
profit-retention and monthly limits. A different explicit risk preference could
accept a profit sacrifice, but no such choice is assumed for live trading.

The current configuration is the comparator, not a proven global optimum.
These results do not justify returning to a large pulse-threshold sweep, or
blaming the losses on post-partial cost inflation alone. No additional regime,
exit, short, maker or strategy family was added to this pass.

## Verification and artifacts

Accepted output: backtests/hype/hype-ladder-sizing-2026-09-05-validated/.

The first complete run used the same strategy/engine and produced the same
numerical results. Its artifact verifier caught a **-0 versus JSON 0 comparison**
in a zero-loss cohort. The verifier now compares the persisted JSON representation.
A full new-folder run pins the corrected verifier rather than altering old
manifest hashes. Repeated runs are not independent market evidence.

Verification passed:

- Main/VPS typechecks; sizing, transactional-state clock, current-stack, exposure,
  drop-pulse, persistent-pulse, deep-add and causal-prefix regression suites.
- All **four old baseline digests** reproduced; four corrected baselines precede
  the first variant. Inactive callbacks preserve the full same-clock result.
- Full independent permission/allocation checker: **761,643 decision records,
  196,185 fills and 4,372 partial events** across the 36 accepted cases.
- Independent accounting from saved fills plus raw repaired candles:
  **13,603,536 minute-case marks and 342 monthly-case records**, including
  adverse-path DD, minimum equity, monthly realized/MTM totals, decision-time
  source price/inventory/equity and close-marked underwater duration.
- Source/input hashes unchanged; first and repeated results, baselines, summary,
  monthly, rankings and clock-repair deltas are byte-identical.
- No live configuration/source mutation from this task. Existing unrelated
  worktree changes are preserved. Record counts overlap across cases; they
  are not independent market samples.

Accepted SHA-256:

```text
manifest.json a02b0187f125f917b2865dd34a22925b2674a6f3077b403a23987541a673d468
results.json e8b4a370646b8d5fa7615dce4c2232464822d93b36a694a515f77716398aea58
baseline.json ca3b4507a2a20a17ac8055d23d05118bdb70c9fa609a85a60d7f7e96b090539d
legacy-baseline.json a2089999fc9793139f7011e56cfc715392f9f2bf7f77b8469295c63e0a922b7d
summary.csv b5b12810d1a4114edb3f97ef0a8b3edaddd90d095554c858a58a710015a65b40
monthly.csv 4444f25531547b7907c3adcd869e7c9b10d7f66bbaa1759fbe3df10b991f6239
ranking.json 7b78f0683e477d37b3bbd00ea1a6bf5476ad2b4a7f616f05e74877aa5e4defcf
validation.json 755453cc0fcced704183ebaedeaf0a676e1c2fcfd3770eb8b0acf2a19317d06e
```

The separate live-event audit pins its input and source hashes inside its JSON.
The independent monthly checker prints its own source hash on successful
completion; it does not alter the accepted simulation artifacts.

Raw inputs and generated artifacts remain local/ignored. Only small definitions,
source, tests and findings are allowlisted for future review; no commit/push.
