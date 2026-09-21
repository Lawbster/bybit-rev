# C01: first bounded indicator-combination study

September 7, 2026 UTC. **Original pre-run study plan, now executed as approved.**

Execution update: all 32 combinations are complete and independently verified;
zero pass the frozen profit or defensive follow-up screens. See the
[findings](../../research/codex-astra-indicator-combinations-c01-findings-2026-09-07.md)
and [reproduction guide](indicator-combinations-c01-study.md). The plan below
and its hash-pinned JSON card retain the original pre-run wording and budgets;
their review/not-run fields are historical, not the current execution status.

Direction agreed: standalone long/short combinations first, selected ladder
applications later. Hard cap **32 new combinations in this first batch**.
Then review the results and dig deeper into a few mechanisms, not a larger
automatic grid. No live, short-owner, ladder, executor or configuration changes.

Exact definitions: [machine-readable card](../../research-inputs/indicators/combinations-c01-2026-09-07.json).
Existing evidence: [indicator register](../../research/INDICATOR-FINDINGS.md),
[tested setups](../../research/TESTED-SETUPS.md),
[closed-bar contract](closed-bar-indicator-testing.md).

## 1. What we want to learn

Can **one condition at an existing entry trigger** distinguish the trades worth
taking from the damaging ones? Keep two useful outcomes separate:

- Profit: improve dollars earned without worsening drawdown.
- Defense: materially reduce losses/drawdown while retaining most of the
  original profit. This can deserve later ladder testing even if it is not the
  largest standalone profit producer.

First test entry selection only. Same $10,000 notional and 12h exit for every
parent and combination. A candidate is **A AND one B**, never A plus all four
conditions, a vote, an OR rule, a confirmation-wait strategy, or a fitted score.

## 2. Eight exact entry anchors

The two CRSI entries deliberately compare entering an extreme versus waiting
for recovery. They are related, not two independent discoveries. The remaining
entries cover volume-weighted dip buying, continuation, higher-timeframe
crossings, bearish expansion and a contrarian short. Selection uses existing
results and mechanism diversity; it is not an unbiased sample of indicators.

| Anchor | Side | Fresh closed-bar trigger | Four separate combinations |
|---|---|---|---|
| A1 | Long | 15m CRSI enters <=5 from >5 | C01-01 through C01-04 |
| A2 | Long | 15m CRSI recovers >5 from <=5 | C01-05 through C01-08 |
| A3 | Long | 15m MFI7 enters <10; exact signed-metric rule in card | C01-09 through C01-12 |
| A4 | Long | 30m CMF10 crosses above zero | C01-13 through C01-16 |
| A5 | Long | 4h MACD12/26/9 histogram crosses above zero | C01-17 through C01-20 |
| A6 | Short | 4h MACD12/26/9 histogram crosses below zero | C01-21 through C01-24 |
| A7 | Short | 30m ADX14 crosses >40 with -DI > +DI | C01-25 through C01-28 |
| A8 | Short | 4h normalized OBV40 crosses >+0.25; fade the up-volume burst | C01-29 through C01-32 |

Exact parent IDs and their accepted artifact directories are pinned in the
card. Do not accidentally substitute MACD's reversal exit, MFI recovery,
rounded legacy CRSI, raw cumulative OBV, or a persistent entry level.

These are **not eight live-qualified strategies**. All prior full strict screens
failed. A7/A8 have just 15/13 recent parent closes, respectively; adding a
condition can leave too few trades to judge. Keep that result visible rather
than lowering the sample floor or filling their slots with newly searched rules.

Other studied families (RSI, ROC, Bollinger and ATR entry variants) are not
rejected. They are outside this first capped anchor set. ER and VWAP/relative
volume participate as conditions. Pending Stochastic/%R, Donchian/Keltner,
CHOP and other field-guide expansions are explicitly deferred for C01, not
recorded as completed or unhelpful. No implicit obligation to exhaust every
possible indicator before learning from this bounded batch.

## 3. Four conditions, tested individually

Every anchor gets the same four tests. No per-anchor threshold fitting.
`s = +1` for a long; `s = -1` for a short.

| Order / condition | Exact condition at A's decision | Question |
|---|---|---|
| B1: direction | Last completed 4h DMI14: `s * (+DI - -DI) > 0` | Does trading with the slower directional context help? |
| B2: adverse-path veto | Last completed 1h signed ER20: `s * ER > -0.5` | Can we avoid an efficient move against our intended trade? |
| B3: participation | Last completed 1h volume / mean of prior 20 completed 1h volumes `>= 1.5` | Does meaningful activity improve the entry's information? |
| B4: location | Last completed 1h close on the entry-side of its own UTC-day VWAP | Does requiring long-above/short-below VWAP avoid weak entries? |

ER20 uses `(close - close20barsAgo) / sum(abs(each of 20 close changes))`;
zero travel is valid zero. This is not the unsigned ER nor ATR-normalized ROC.
VWAP uses actual Bybit quote turnover divided by base volume, not typical-price
substitution. Relative volume excludes the current bar from its denominator.
Nulls fail closed; real zeros retain the meanings specified in the card.

These are overlapping price/volume descriptions, not four independent votes.
A7+B1 specifically tests 30m/4h agreement within the DMI family. MFI/CMF/OBV
with relative volume also share input information. Measure redundancy rather
than claiming extra confidence merely from a second indicator name.

## 4. Historical baseline: what is already known

Full window: **2025-07-01 00:00 to 2026-09-04 19:01 UTC**.
Recent window: **2026-05-17 20:43 to the same cutoff**. Recent starts flat and
is a subset of full; do not add their PnL or counts together.

Archived parent results below are **not combination results**. Dollar figures
rounded to the nearest dollar; DD is minute-adverse equity drawdown using the
inherited $32,000 starting equity, not raw price MAE. Net includes cutoff
inventory marks and modeled fees, **before funding**.

| Existing baseline | Full net, 0m / +1m | Recent net, 0m / +1m | Closed trades, full/recent at 0m | Full adverse DD, 0m |
|---|---:|---:|---:|---:|
| Same-side long rolling 12h clock | $3,305 / $3,792 | $5,038 / $5,104 | 861 / 219 | 33.09% |
| Same-side short rolling 12h clock | -$22,283 / -$22,726 | -$9,887 / -$9,930 | 861 / 219 | 71.27% |
| A1: CRSI enters extreme long | $11,044 / $10,773 | $6,603 / $6,222 | 142 / 33 | 15.46% |
| A2: CRSI recovers long | $8,684 / $7,744 | $6,272 / $6,023 | 142 / 33 | 8.68% |
| A3: MFI dip long | $13,112 / $10,761 | $3,957 / $3,311 | 441 / 106 | 10.19% |
| A4: CMF continuation long | $10,186 / $7,122 | $8,238 / $7,718 | 613 / 157 | 15.66% |
| A5: MACD long | $8,270 / $8,632 | $2,587 / $2,603 | 90 / 24 | 7.28% |
| A6: MACD short | $2,000 / $1,547 | $1,933 / $2,114 | 91 / 25 | 15.17% |
| A7: ADX bearish expansion short | $1,860 / $1,617 | $1,863 / $1,691 | 62 / 15 | 7.15% |
| A8: OBV contrarian short | $753 / $957 | $2,071 / $2,154 | 38 / 13 | 7.19% |

Primary baseline for C01-01 is **A1**, not the clock and not the live ladder.
The clock is contextual and not matched for time in the market. Beating a very
poor short clock while losing money is not success. Cash is zero profit and
zero drawdown, not a profitable trading edge.

The code/manifest must reproduce exact archived numbers, ledgers and monthly
series, not these rounded presentation values. Existing study summary hashes
are recorded in the card; acceptance also requires their full verified artifact
hashes and I01 source/input identity.

## 5. Timing and controls: implementation must preserve these

1. Use the inherited fixed June 1, 2025 seed and repaired 663,541-minute history.
   Do not quietly use a newer data pull. If the pinned inputs have changed,
   stop and recover the original snapshot or explicitly rebaseline before C01.
2. Evaluate A only at its closed-bar crossing. At decision `t`, B must come
   from its expected last fully closed interval, ending
   `floor(t / B.timeframeMs) * B.timeframeMs`, and be available by `t`.
   At 10:15, a 4h B must use the 04:00-08:00 bar, never 08:00-12:00.
   If the expected bar is missing, do not fall back to a stale older value.
3. A true/B false means skip this crossing. Do not enter later when B improves.
   A true/B true schedules one entry; freeze both features at that decision.
   No new feature sample at the delayed fill. Existing occupied/pending
   crossings remain consumed, not queued for post-exit re-entry.
4. At 00:15 UTC, the latest closed 1h VWAP feature belongs to the previous
   day's 23:00-00:00 bar. Use and label that bar's own day anchor. Do not
   pretend it is a forming new-day VWAP, a new cross or a fresh day's close.
5. Repeat modeled zero-lag and +60s execution-delay cases for **entries and
   exits**. A bar at its nominal close with instant execution is an idealized
   historical model, not proof of real publication/receipt timing. No future
   1m high/low/close can determine an entry or retroactive best fill.
6. Fixed 12h from actual entry, then the case's exit delay; inherit exact
   event ordering. Mark unclosed cutoff inventory with hypothetical exit fee
   separately from W/L. No fitted stop, target, early normalization exit or
   multiple-position portfolio in this batch.
7. Each pair needs original A and **A plus B-data-ready-only**. The latter
   tests identical information availability with no B threshold. An omitted
   bad trade due to missing data is not evidence of an effective condition.
   Reuse a parent run only after proving equality; log every deduplication.
8. Reproduce six existing B-only directional-cross controls (card IDs).
   Their fresh crossings provide standalone context, not equivalence to a B
   state at A. RVOL has no direction by itself; do not invent a new volume-only
   buy/sell rule and hide it among controls. It gets parent/readiness/exposure
   comparisons instead.
9. Replay every combination's own complete path. Filtering parent trades is
   insufficient: a blocked trade can free the bot to take a later crossing
   that the parent ignored. Attribution must identify both those new trades
   and the original winners/losses excluded.

### Count budget

| Run type | Definitions / slots | Full/recent x two delays |
|---|---:|---:|
| New combinations | 32 | 128 |
| Repeated A-alone parents | 8 | 32 |
| Repeated directional B-only controls | 6 | 24 |
| Repeated clock controls | 2 | 8 |
| Primary total | 48 | 192 |
| Additional readiness-only controls, before exact deduplication | 32 logical slots | Up to 128 |

At most **320 primary plus readiness case executions before deduplication**;
only **32 new optimized combination hypotheses**. Cash, monthly breakdowns,
fixed-path cost stress and arithmetic exposure-scaling diagnostics are not
additional entry/exit strategies. Independent verification reruns are counted
as verification, never independent evidence. No hidden randomized gate sweep.

## 6. Proposed criteria for a deeper follow-up

These are **research-shortlist budgets for review**, not previously approved
live risk tolerances. Set them before looking at C01 outcomes; do not loosen
them afterwards just to obtain winners. The existing strict clock screen and
repo deployment requirements remain separately reported and unchanged.

Common requirements in both windows and both delays:

- At least 30 full / 10 recent completed trades; solvent; positive net and
  positive net after an extra 5bps per side fixed-path cost stress.
- All parity, availability, causal-prefix and independent accounting checks
  pass. Failures stop acceptance, not merely reduce a score.
- No marked monthly delta worse than **-$320** against either original A or
  readiness-matched A, including partial months. This proposed research budget
  is 1% of the $32,000 reference equity, not a forecast of live losses.

**Profit shortlist:** at least +$500 full and +$200 recent against both parents
in each delay, with max adverse DD no worse than readiness-parent. This is
additional $10k-standalone PnL, not improvement to a $67k ladder.

**Defensive shortlist:** retain at least **90% of each positive parent's net**,
reduce absolute losing-trade dollars versus both parents in all four cases,
and reduce full-period adverse DD by at least 20% relative **and** one percentage
point in each delay; recent DD cannot worsen. If a reproduced parent is not
positive, stop to review the retention rule rather than misuse a percentage
of a negative number.

To avoid congratulating a filter simply for taking less exposure, also compare
with a constant-notional-rescaled readiness-parent matching the candidate's
dollar-hours exposure. Rebuild equity/DD from scaled dollar PnL, not by scaling
DD percentages. Defense must beat this diagnostic on DD and losing dollars;
otherwise label it **reduced exposure only; selection benefit not demonstrated**.
This ratio uses full-period exposure and is explicitly an ex-post diagnostic,
not a proposed sizing policy or a matched entry-time experiment.

Rank profit survivors by the smallest full-period delta across both parents
and both delays;
rank defensive survivors by their smaller full DD percentage-point improvement.
Tie-break on smaller recent net, then exact ID. Take **up to two from each
track**, at most four distinct mechanisms; a dual qualifier takes one slot.
Show identical/similar signal-ledger overlap and prefer one representative
rather than calling related CRSI results two confirmations. Never pad to four
if none/fewer pass. Sparse rules remain inconclusive with exact sample counts.

The inherited strict diagnostic also requires positive own-side clock delta
and **no negative monthly clock deltas**. A research-shortlist pass with a
strict-screen failure must show both labels. No result becomes live-approved
from this card, even if all research tests pass.

## 7. Report format and reusable artifacts

Always lead with dates, notional and **baseline beside candidate**. Separate
full/recent and immediate/+1m panels. For each comparison report:

| Metric | Original A | Readiness-matched A | A + B | Delta vs original / matched |
|---|---:|---:|---:|---:|
| Closed trades: W / L / flat | pending | pending | pending | pending |
| Winning-trade dollars | pending | pending | pending | pending |
| Losing-trade dollars | pending | pending | pending | pending |
| Closed net / open mark / total net | pending | pending | pending | pending |
| Fees / extra-cost net | pending | pending | pending | pending |
| Adverse DD / worst trade MAE | pending | pending | pending | pending |
| Exposure hours / dollar-hours | pending | pending | pending | pending |

Then give the full monthly baseline/candidate/delta table, not just the recent
bad months. Store it for all32; highlight top5 and every shortlisted candidate.
Show blocked-parent winning dollars as clearly as avoided-parent losing
dollars, plus newly enabled trades caused by changed occupancy. Those event
comparisons are descriptive; they cannot replace the full-path net difference.

Archive immutable card/source/input hashes, rule definitions, all decisions
(including rejected and occupied crossings), source start/end/availableAt,
day anchors, null reasons, features, trade ledgers, monthly marked series,
cost/delay tables and acceptance failures. Include worst MAE/DD paths and
top-five winner concentration. Independent verification must recompute trade
fees, open marks, months, totals and adverse equity paths.

Prefix fixtures must cover mixed timeframes, exact4h boundaries, midnight
VWAP, missing expected bars, valid zero versus null, no catch-up entry, frozen
delayed entry evidence, occupied signals, same-timestamp timeout ordering,
and cutoff inventory. One all-true-condition path per anchor must reproduce
the original engine exactly before looking at any new combination results.

## 8. Circle back, but keep it bounded

First review C01. Proposed deeper pass: **at most 12 new refinements**, up to
three per selected mechanism, in a separate card agreed before running.
This is a later budget, not 12 hidden additions to the current32.

Choose one axis based on the observed mechanism: a small neighbor check for a
threshold, one alternative confirmation clock, or a sequence/exit hypothesis.
Do not change threshold, timeframe and exit together. Repeated baselines and
earlier failed variants stay visible. A sparse case may need more data rather
than finer tuning; no automatic expansion when the first32 disappoint.

All these dates have already informed thousands of choices (5,160 distinct
standalone definitions through I11). Full/recent agreement, neighboring
thresholds and chronological splits on already-mined history are development
robustness, **not untouched out-of-sample validation**. Keep all trials/failures
in the registry. Do not assign a new "holdout" label retrospectively. Future
unseen/forward observations remain necessary for stronger evidence.

Only after the indicator-pair review/refinement:

1. Add HL or S/R to selected mechanisms one at a time, with equal healthy
   overlap and indicator-only / pulse-only / S/R controls. The TP atlas can
   propose hypotheses, but completed TPs are outcome-selected; compare all
   eligible decision events rather than learning only from known winners.
2. Test selected indicators in the actual ladder at **one named decision**:
   initial entry, genuine deep add, exposure increment or exit. Defensive
   standalone survivors qualify for consideration even without top raw profit.
   Reproduce the exact canonical current-stack baseline on that same window
   first; neither standalone nor an outdated biased ladder replay substitutes.
3. Evaluate chosen long/short components together in the shared account,
   including incremental dollar PnL, monthly loss concentration, drawdown,
   funding evidence and collateral. This is where overlap/hedging usefulness
   is measured, not by summing standalone percentages.

Execution safety and the repo's forward-observation/deployment gate remain
separate. Nothing here unpauses shorts or changes the live ladder.

## 9. Current handoff

Prepared exact32 IDs, eight historical parents, six named component controls,
hash-pinned summary references, timing/counting rules and proposed follow-up
budgets. **No new combination engine or simulations in this planning step.**
No live/config changes and no commit/push. Tested counts remain
**5,160 standalone / 45 ladder** until a new verified study is actually accepted.

Planning validation completed: 32 unique anchor/condition pairs, exact8+6
parent/component IDs and all56 archived window/delay rows matched; six summary
SHA-256 pins and accepted verification markers checked; inherited windows,
notional, costs and seed matched I01; four condition formula-version names and
run-count arithmetic checked. The eight archived clock rows were also checked
against the displayed rounded baseline. This is card/reference validation,
not a rerun of parent engines, raw input hashes, mathematical tests or C01 sims.
