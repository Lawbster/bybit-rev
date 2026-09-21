# F01: failed-recovery discrimination — September 8, 2026

## TL;DR

- **Diagnostic complete: four unchanged current-stack baselines, 695 correlated
  landmarks, ten frozen warnings, zero retained hypotheses under the primary
  screen.** No new exit simulation, live change, commit or push.
- In the recent **first deep −3%, then +60-minute** cohort, HL15≤0.85 AND
  HL1h≤0.90 flagged **7 winners / 1 loser** under touch fills and **8 winners /
  0 losers** under confirmed closes. Their remaining downside was **$5,114 /
  $0**, versus subsequent recovery of **$17,445 / $22,099**. These warnings
  mostly described an underwater ladder, not a failed recovery.
- Preserve the useful distinction: some large eventual failures already showed
  a price/flow rebound at this checkpoint. Older failed-support-retest cohorts
  had positive diagnostic balances, but recent counterparts were winners.
  Neither finding establishes a new tradable rule. This does not declare
  S/R, HL, or all possible recovery mechanisms exhausted.

## Periods, baseline and meaning of the numbers

**Long:** July 1, 2025 00:00 → August 19, 2026 21:32 UTC.
**Recent:** May 17, 2026 20:43 → September 8, 2026 17:47 UTC.

Both start independently flat with **$32,000**, $800×1.35, maximum 11 retained
rungs and **the full current B17 policy**. This is not the bare ladder from L09,
not a new no-soft-stale setup, and not the historical sequence of actual deployed
configs. The windows overlap; neither is an untouched validation sample.

Touch = prior resting TP target can fill on a later candle high.
Confirmed = TP requires a completed minute's close, then the following open.
These are execution assumptions, **not guaranteed upper/lower profit bounds**.
Both charge 0.055% per side. Actual maker fills, funding, liquidation and
shared-account effects remain outside the model.

## Unchanged full-stack baselines

| Period / TP model | Wins | Losses | Winning $ | Losing $ | Realized $ | Open $ | Net $ | Max DD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Long / touch | 955 | 57 | 187,738 | 140,906 | 46,832 | 0 | 46,832 | 28.17% |
| Long / confirmed | 788 | 60 | 190,819 | 171,329 | 19,490 | 0 | 19,490 | 45.65% |
| Recent / touch | 295 | 10 | 57,130 | 33,009 | 24,121 | -3,207 | 20,914 | 24.69% |
| Recent / confirmed | 243 | 11 | 59,238 | 40,192 | 19,046 | -3,207 | 15,839 | 31.11% |


## What was actually tested

First surviving completed-minute observation at retained depth≥9 and gross
inventory PnL≤−3%; repeat separately at−5%. At each first observation, attach
then-known context. Also observe exactly60 minutes later **only if the same
episode remains deep**. The later price need not remain below the initial loss
threshold; excluding rebounds would bias this research against recoveries.

The primary preselected comparison is **−3% / +60 minutes**. The−5% and immediate
checkpoints are sensitivity views, not alternative winners selected afterwards.
No repeated underwater minute is an independent training row.

Use complete episode PnL, including partials, for W/L labels. Also calculate:

> Remaining value change = final episode PnL − marked episode value at observation.

The mark includes already-realized episode partials and the same closing-fee
reserve as the baseline. A ladder may eventually close red yet improve from its
already-underwater landmark. Counting all of its final loss as avoidable would
overstate the benefit of an earlier exit.

**Diagnostic balance = subsequent downside − subsequent recovery. It is not
strategy PnL or a forecast of savings.** No actual earlier market close, trim,
cooldown, re-entry, replacement trade, capital release or new equity curve was
simulated. A positive balance would only justify considering an economic test.

There are224 first−3% observations across the four model/window views; models
and periods overlap. The total695 includes−5% and later-landmark repeats.
Do not report695 independent ladders or derive live odds by pooling these rows.

### Fixed warning definitions

| ID | Then-known condition |
|---|---|
| D1 | Completed4h close below its canonical EMA200 and EMA50 declining |
| D2 | Completed-minute price below rolling60m VWAP and ROC60≤0 |
| D3 | D2 now and15 minutes earlier; no intervening close above the earlier frozen VWAP |
| D4 | Healthy HL15≤0.85 |
| D5 | Healthy HL15≤0.85 AND HL1h≤0.90 |
| D6 | D5 both now and15 minutes earlier; two observations, not continuous persistence |
| D7 | D5 AND healthy native asset OI1h declining |
| D8 | D5 AND healthy dollar-valued asset OI1h declining; comparison for D7 |
| D9 | Support frozen15 minutes earlier; two actual completed5m closes below it by0.1% |
| D10 | D9 plus one of those5m bars trading back to the boundary and closing below it |

Book imbalance, four-hour OI, other returns and zone distances are retained
for future joins, **not mined into additional warnings during this pass**.
Unknown required data remains unknown, including in conjunctions.

## Main findings

### 1. A red episode is not the same as money still avoidable

At the recent touch model's first deep−3% observation:

- 27 completed episodes: **22 winners /5 losers**, plus one still open.
- Their final completed net is−$22,354, but they were already marked at−$52,571
  when sampled.
- Subsequent recovery totals$49,558 and further deterioration$19,341.

The confirmed model likewise has **20 winners /8 losers**, plus one open.
From the first−3% landmark, recovery totals$46,652 versus$23,333 of additional
deterioration. This is why “these losing ladders cost us$28k–$39k” is not evidence
that a new−3% exit would save that amount.

At+60m the same asymmetry remains: touch$43,463 recovery versus$19,266 downside;
confirmed$45,726 versus$24,435. This does **not** prove that waiting indefinitely
is optimal; existing exits are still part of these outcomes.

### 2. Persistent-looking selling does not separate these failures cleanly

At the primary recent landmark, D5 selects:

| Baseline / flagged cohort | Final W/L | Winning dollars | Losing dollars | Remaining downside | Subsequent recovery |
|---|---:|---:|---:|---:|---:|
| Touch: all deep landmarks | 21 /5 | $5,472 | $28,389 | $19,266 | $43,463 |
| Touch: D5 flagged | 7 /1 | $1,630 | $8,432 | $5,114 | $17,445 |
| Confirmed: all deep landmarks | 19 /8 | $6,397 | $38,541 | $24,435 | $45,726 |
| Confirmed: D5 flagged | 8 /0 | $3,221 | $0 | $0 | $22,099 |

Each baseline has one censored episode; D5 flags it, but it contributes **no
completed PnL or success/failure label**. It is not counted as a ninth completed
D5 case.

Adding negative native OI (D7) does not remove the false-positive recovery episodes
in the completed primary cohort: its selection is identical to D5. D8 is also
identical there. That does not mean native and marked OI are interchangeable:
their immediate−3% cohorts differ, and the raw features preserve both.

D4 alone is also weak: touch10W/1L, confirmed11W/1L. D6's two snapshots flag only
2/3 completed recent cases, all winners. These particular warnings cannot
justify tightening exits merely because their flow readings look hostile.

### 3. Weak momentum is partly built into the sampling condition

At the first−3% landmark, D2 flags **every completed recent episode** under
both models. It offers no separation there: the sampling condition already
selects a local adverse move.

An hour later, D2 flags10W/1L under touch and9W/0L under confirmed closes.
D3's failed VWAP reclaim selects6W/1L and7W/0L. The eventual winners can remain
weak for another hour before recovering.

Conversely, **three of the four** touch-model subsequent-deterioration cases
show positive ROC60 at the+60m checkpoint. Examples, all in the archived model:

| Landmark UTC | Then-known ROC60 | HL15 /HL1h | Final episode PnL | Further change after landmark |
|---|---:|---:|---:|---:|
| June9 04:56 | +1.14% | 1.073 /1.036 | −$8,374 | −$7,249 |
| June21 23:10 | +0.07% | 0.950 /1.018 | −$6,111 | −$4,246 |
| July7 22:38 | +0.84% | 1.189 /0.821 | −$4,108 | −$2,657 |

All ten fixed warnings are false at these three checkpoints. Their full rows,
including successful counterparts, remain in the export. **A temporary rebound
is not proof of repair.** Nor does this table prove that rebound itself predicts
failure: profitable recoveries also rebound.

### 4. S/R has a narrower historical observation, not a recent confirmation

D10 at−3%/+60m in the long window flags:

- Touch:2W/4L, diagnostic balance **+$2,879**.
- Confirmed:3W/6L, diagnostic balance **+$3,013**.

But recent D10 selects **1W/0L** and **2W/0L**, with balances−$2,456/−$5,243.
At−5%/+60m there are **zero recent D9/D10 flags**, so that view is absent evidence,
not a perfect loss-avoidance record. Its old positive cells are n=2.

The support level was frozen before the break. Later pivots and moving
reconstructed levels cannot rewrite it. This makes the observation causally
well-defined, but it remains sample/model/regime dependent. No blanket support
failure exit is earned.

### 5. Threshold neighbors do not rescue a robust rule

The immediate−3% D6 diagnostic is+$2,215 in recent touch but−$8,192 in confirmed.
At−5%/+60m D7 gives+$4,441 in touch (only2 cases), versus−$3,727 in confirmed
(3 cases). The full sensitivity table below retains these positive cells instead
of hiding them, while showing why they do not establish a cross-model signal.

No threshold optimization or extra condition was added after seeing these
results. No economic net-PnL ranking is asserted for descriptive bins.

## Chronology, coverage and censoring

The frozen early/late boundary is **July15 UTC**, not selected from performance.
All completed primary recent flagged cases for D1–D10 occur in the early segment.
The later segment has unflagged completed recoveries, one unflagged confirmed
loss, and the open September episode. Thus there is no later flagged sample with
which to establish chronological stability. Do not treat an empty late cell as
a successful validation.

Both recent primary paths lose one earlier profitable August22 episode when
moving from the immediate to the+60m landmark: it closed before that later
observation. Touch profit$563; confirmed$825. These exclusions are explicit.
Older views also have early forced closes that cannot be rescued by a warning
defined only an hour later. Every exclusion is listed in `attrition.json`.

Base-arrival recent primary HL coverage is27/27 touch and28/28 confirmed,
including their censored observations. Longer-history flow coverage is only
23/80 and23/82 at this checkpoint: **older missing HL is unknown**, not neutral.
The older table must not be read as full-history HL validation.

With the existing modeled publication plus an extra15 or60 seconds, the
minute-boundary15m sample count usually falls from14 to13 and fails the frozen
14-sample floor. **Recent primary D4–D8 coverage becomes zero.** This reproduces
the prior arrival fragility; it is not profitable abstention or a discovered
exchange problem. We did not relax freshness or sample thresholds to rescue it.

## Verdict and scope

**0/10 primary descriptive hypotheses retained. Zero economic variants tested.**
The frozen diagnostic screen requires adequate flagged samples, higher decline
frequency than known-unflagged cases, more remaining downside than recovery,
chronological support and delivery robustness in both recent TP models. The
failures are not only a strict monthly promotion veto: the primary recent
dollar separation itself points the wrong way for every bin.

No strategy is declared globally optimal, and no whole indicator family is
declared exhausted. In particular, this does not cancel L09's separate
soft-stale/deep-funding refinement leads; those were different decision questions.
It also does not test an adaptive trailing rule after a rebound, continuous
multi-hour persistence, or a stop/re-entry policy. Those require their own frozen
definitions and occupancy replays, not retrospective arithmetic on this table.

For now the useful product is a reproducible **failure-and-recovery event set**.
No new early-exit rule should be inferred from these ten warnings.

## Verification and reuse

- Four accepted B17 digests unchanged against archived controls; pinned
  source/input hashes match. **No redundant138-case sweep** was run.
- Reconstructed22,788 inventory events and1,522,876 raw-minute equity marks
  against the unchanged baselines, including partial-state allocation.
- Independently checked all695 landmarks,1,860 grouped/monthly cohort rows and
 208,207 original source-row identities.
- Additional raw arithmetic checker passed4,998 flow-window checks and697
  healthy OI checks; source time, native quantity and marked values separated.
- Closed-prefix/future-mutation fixtures, actual5m close alignment, frozen
  support, EMA-library comparison, unknown inputs, delayed publication and
  censored outcomes pass. Existing regroup and H00 context fixtures pass.
- Standard/VPS typechecks and strict explicit research compilation pass.
  Shared engine, live config, state and runtime code were not edited.

[Method and commands](../docs/research/failed-recovery-discrimination.md) /
[Frozen card](../research-inputs/failed-recovery-2026-09-08.json) /
[Study runner](../scripts/hype-failed-recovery-study.ts).

Accepted artifacts: `backtests/hype/hype-failed-recovery-2026-09-08/`.
Start with `observations.csv` for a small reusable event table. The full JSON
retains current/prior context, quality, delayed warnings and exact zone evidence;
`source-evidence.jsonl` retains original physical file/line identities.
`groups.json`, `monthly.json` and `retention.json` preserve every view.

## Complete diagnostic tables

Losing, downside and recovery dollars are **positive magnitudes** below.
Monthly rows group by **observation month**; final episode labels may settle
in a later month. The full baseline MTM column is an actual baseline monthly
result; warning balances alongside it are diagnostic attributions, **not**
monthly profit deltas, return simulations or a promotion screen.

## All deep-loss cohorts, including recoveries

| Period / TP | First loss | Checkpoint | Completed + open | Wins / losses | Winning $ | Losing $ | Already marked $ | Further downside $ | Subsequent recovery $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Long / touch | -3% | +0m | 83 + 0 | 51 / 32 | 13,376 | 129,173 | -158,214 | 69,137 | 111,554 |
| Long / touch | -3% | +60m | 80 + 0 | 51 / 29 | 13,376 | 123,312 | -152,853 | 66,666 | 109,583 |
| Long / touch | -5% | +0m | 47 + 0 | 26 / 21 | 6,793 | 106,283 | -147,370 | 43,474 | 91,354 |
| Long / touch | -5% | +60m | 46 + 0 | 26 / 20 | 6,793 | 102,772 | -134,302 | 42,896 | 81,219 |
| Long / confirmed | -3% | +0m | 84 + 0 | 46 / 38 | 14,996 | 162,954 | -162,540 | 91,131 | 105,713 |
| Long / confirmed | -3% | +60m | 82 + 0 | 45 / 37 | 14,487 | 160,966 | -158,877 | 89,198 | 101,595 |
| Long / confirmed | -5% | +0m | 46 + 0 | 19 / 27 | 6,102 | 139,999 | -144,333 | 58,466 | 68,902 |
| Long / confirmed | -5% | +60m | 45 + 0 | 19 / 26 | 6,102 | 136,512 | -133,516 | 61,541 | 64,648 |
| Recent / touch | -3% | +0m | 27 + 1 | 22 / 5 | 6,035 | 28,389 | -52,571 | 19,341 | 49,558 |
| Recent / touch | -3% | +60m | 26 + 1 | 21 / 5 | 5,472 | 28,389 | -47,113 | 19,266 | 43,463 |
| Recent / touch | -5% | +0m | 17 + 1 | 13 / 4 | 3,955 | 27,025 | -53,029 | 14,467 | 44,426 |
| Recent / touch | -5% | +60m | 16 + 1 | 12 / 4 | 3,392 | 27,025 | -43,711 | 13,107 | 33,185 |
| Recent / confirmed | -3% | +0m | 28 + 1 | 20 / 8 | 7,222 | 38,541 | -54,638 | 23,333 | 46,652 |
| Recent / confirmed | -3% | +60m | 27 + 1 | 19 / 8 | 6,397 | 38,541 | -53,435 | 24,435 | 45,726 |
| Recent / confirmed | -5% | +0m | 17 + 1 | 11 / 6 | 4,042 | 33,496 | -53,443 | 15,298 | 39,287 |
| Recent / confirmed | -5% | +60m | 16 + 1 | 10 / 6 | 3,217 | 33,496 | -44,605 | 18,722 | 33,048 |

## Long / touch: primary warning cohorts

| Diagnostic | W/L | Winning $ | Losing $ | Further declines / completed | Remaining downside $ | Subsequent recovery $ | Balance, NOT PnL | Unflagged decline rate | Unknown / open flagged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All baseline deep landmarks | 51/29 | 13,376 | 123,312 | 26/80 | 66,666 | 109,583 | -42,917 | n/a | 0/0 |
| D1 | 1/6 | 233 | 16,486 | 5/7 | 4,041 | 1,671 | 2,371 | 28.8% | 0/0 |
| D2 | 24/11 | 6,156 | 49,937 | 9/35 | 23,100 | 67,115 | -44,015 | 37.8% | 0/0 |
| D3 | 17/7 | 3,928 | 32,139 | 5/24 | 13,388 | 49,543 | -36,155 | 37.5% | 0/0 |
| D4 | 10/1 | 2,926 | 8,432 | 1/11 | 5,114 | 24,818 | -19,704 | 25.0% | 57/0 |
| D5 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 20.0% | 57/0 |
| D6 | 2/0 | 466 | 0 | 0/2 | 0 | 4,955 | -4,955 | 19.0% | 57/0 |
| D7 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 20.0% | 57/0 |
| D8 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 20.0% | 57/0 |
| D9 | 3/4 | 1,296 | 16,032 | 3/7 | 7,279 | 9,225 | -1,946 | 30.6% | 1/0 |
| D10 | 2/4 | 1,063 | 16,032 | 3/6 | 7,279 | 4,399 | 2,879 | 30.1% | 1/0 |

## Long / confirmed: primary warning cohorts

| Diagnostic | W/L | Winning $ | Losing $ | Further declines / completed | Remaining downside $ | Subsequent recovery $ | Balance, NOT PnL | Unflagged decline rate | Unknown / open flagged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All baseline deep landmarks | 45/37 | 14,487 | 160,966 | 32/82 | 89,198 | 101,595 | -12,398 | n/a | 0/0 |
| D1 | 2/6 | 603 | 15,147 | 4/8 | 2,903 | 2,908 | -5 | 37.8% | 0/0 |
| D2 | 18/11 | 5,805 | 53,567 | 9/29 | 26,362 | 50,150 | -23,788 | 43.4% | 0/0 |
| D3 | 14/7 | 4,436 | 36,303 | 5/21 | 17,567 | 39,844 | -22,277 | 44.3% | 0/0 |
| D4 | 11/1 | 4,400 | 3,606 | 1/12 | 2,008 | 28,550 | -26,542 | 54.5% | 59/0 |
| D5 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 46.7% | 59/0 |
| D6 | 3/0 | 1,683 | 0 | 0/3 | 0 | 7,847 | -7,847 | 35.0% | 59/0 |
| D7 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 46.7% | 59/0 |
| D8 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 46.7% | 59/0 |
| D9 | 3/7 | 1,801 | 31,048 | 6/10 | 16,465 | 7,199 | 9,267 | 36.1% | 0/0 |
| D10 | 3/6 | 1,801 | 22,389 | 5/9 | 10,212 | 7,199 | 3,013 | 37.0% | 0/0 |

## Recent / touch: primary warning cohorts

| Diagnostic | W/L | Winning $ | Losing $ | Further declines / completed | Remaining downside $ | Subsequent recovery $ | Balance, NOT PnL | Unflagged decline rate | Unknown / open flagged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All baseline deep landmarks | 21/5 | 5,472 | 28,389 | 4/26 | 19,266 | 43,463 | -24,196 | n/a | 0/1 |
| D1 | 1/0 | 233 | 0 | 0/1 | 0 | 1,671 | -1,671 | 16.0% | 0/0 |
| D2 | 10/1 | 2,895 | 8,432 | 1/11 | 5,114 | 26,429 | -21,315 | 20.0% | 0/0 |
| D3 | 6/1 | 1,366 | 8,432 | 1/7 | 5,114 | 16,758 | -11,644 | 15.8% | 0/0 |
| D4 | 10/1 | 2,926 | 8,432 | 1/11 | 5,114 | 24,818 | -19,704 | 20.0% | 0/1 |
| D5 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 16.7% | 0/1 |
| D6 | 2/0 | 466 | 0 | 0/2 | 0 | 4,955 | -4,955 | 16.7% | 0/0 |
| D7 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 16.7% | 0/0 |
| D8 | 7/1 | 1,630 | 8,432 | 1/8 | 5,114 | 17,445 | -12,331 | 16.7% | 0/0 |
| D9 | 1/0 | 830 | 0 | 0/1 | 0 | 2,456 | -2,456 | 16.0% | 0/0 |
| D10 | 1/0 | 830 | 0 | 0/1 | 0 | 2,456 | -2,456 | 16.0% | 0/0 |

## Recent / confirmed: primary warning cohorts

| Diagnostic | W/L | Winning $ | Losing $ | Further declines / completed | Remaining downside $ | Subsequent recovery $ | Balance, NOT PnL | Unflagged decline rate | Unknown / open flagged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All baseline deep landmarks | 19/8 | 6,397 | 38,541 | 7/27 | 24,435 | 45,726 | -21,291 | n/a | 0/1 |
| D1 | 1/0 | 301 | 0 | 0/1 | 0 | 1,739 | -1,739 | 26.9% | 0/0 |
| D2 | 9/0 | 2,980 | 0 | 0/9 | 0 | 25,199 | -25,199 | 38.9% | 0/0 |
| D3 | 7/0 | 2,132 | 0 | 0/7 | 0 | 19,965 | -19,965 | 35.0% | 0/0 |
| D4 | 11/1 | 4,400 | 3,606 | 1/12 | 2,008 | 28,550 | -26,542 | 40.0% | 0/1 |
| D5 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 36.8% | 0/1 |
| D6 | 3/0 | 1,683 | 0 | 0/3 | 0 | 7,847 | -7,847 | 29.2% | 0/0 |
| D7 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 36.8% | 0/0 |
| D8 | 8/0 | 3,221 | 0 | 0/8 | 0 | 22,099 | -22,099 | 36.8% | 0/0 |
| D9 | 2/0 | 1,556 | 0 | 0/2 | 0 | 5,243 | -5,243 | 28.0% | 0/0 |
| D10 | 2/0 | 1,556 | 0 | 0/2 | 0 | 5,243 | -5,243 | 28.0% | 0/0 |

## Threshold/checkpoint sensitivity: flagged diagnostic balance, NOT policy PnL

| Diagnostic | Recent touch -3/0m | Recent confirmed -3/0m | Recent touch -3/60m | Recent confirmed -3/60m | Recent touch -5/60m | Recent confirmed -5/60m |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | -2,126 (n=1) | -2,194 (n=1) | -1,671 (n=1) | -1,739 (n=1) | 0 (n=0) | 0 (n=0) |
| D2 | -30,217 (n=27) | -23,319 (n=28) | -21,315 (n=11) | -25,199 (n=9) | 930 (n=3) | -10,764 (n=4) |
| D3 | -24,263 (n=18) | -6,499 (n=19) | -11,644 (n=7) | -19,965 (n=7) | 733 (n=1) | -7,173 (n=3) |
| D4 | -23,297 (n=20) | -25,439 (n=22) | -19,704 (n=11) | -26,542 (n=12) | -4,079 (n=5) | -14,311 (n=6) |
| D5 | -18,977 (n=18) | -26,981 (n=19) | -12,331 (n=8) | -22,099 (n=8) | 930 (n=3) | -11,570 (n=5) |
| D6 | 2,215 (n=9) | -8,192 (n=9) | -4,955 (n=2) | -7,847 (n=3) | 4,441 (n=2) | -2,921 (n=2) |
| D7 | -9,968 (n=14) | -22,866 (n=14) | -12,331 (n=8) | -22,099 (n=8) | 4,441 (n=2) | -3,727 (n=3) |
| D8 | -18,977 (n=18) | -26,981 (n=19) | -12,331 (n=8) | -22,099 (n=8) | 930 (n=3) | -10,764 (n=4) |
| D9 | -8,547 (n=4) | 1,132 (n=4) | -2,456 (n=1) | -5,243 (n=2) | 0 (n=0) | 0 (n=0) |
| D10 | -8,547 (n=4) | 1,132 (n=4) | -2,456 (n=1) | -5,243 (n=2) | 0 (n=0) | 0 (n=0) |

## Long / touch monthly D1-D5: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D1 | D2 | D3 | D4 | D5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | 2,668 | 4/3 | 1,042 (n=1, ?=0) | 5,162 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=7) | 0 (n=0, ?=7) |
| 2025-08 | 561 | 5/2 | 0 (n=0, ?=0) | -6,494 (n=4, ?=0) | -3,807 (n=3, ?=0) | 0 (n=0, ?=7) | 0 (n=0, ?=7) |
| 2025-09 | 5,608 | 4/2 | 0 (n=0, ?=0) | 1,617 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=6) | 0 (n=0, ?=6) |
| 2025-10 | 7,325 | 0/2 | 0 (n=0, ?=0) | 4,295 (n=2, ?=0) | 4,295 (n=2, ?=0) | 0 (n=0, ?=2) | 0 (n=0, ?=2) |
| 2025-11 | -1,443 | 1/1 | 267 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=2) | 0 (n=0, ?=2) |
| 2025-12 | -509 | 0/1 | 0 (n=0, ?=0) | 1,436 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=1) | 0 (n=0, ?=1) |
| 2026-01 | -246 | 5/5 | 1,236 (n=3, ?=0) | -5,828 (n=4, ?=0) | -5,828 (n=4, ?=0) | 0 (n=0, ?=10) | 0 (n=0, ?=10) |
| 2026-02 | 4,940 | 7/3 | 1,496 (n=1, ?=0) | -15,692 (n=6, ?=0) | -14,254 (n=4, ?=0) | 0 (n=0, ?=10) | 0 (n=0, ?=10) |
| 2026-03 | 11,159 | 4/1 | 0 (n=0, ?=0) | -4,882 (n=2, ?=0) | -4,882 (n=2, ?=0) | 0 (n=0, ?=5) | 0 (n=0, ?=5) |
| 2026-04 | 2,065 | 2/2 | 0 (n=0, ?=0) | -34 (n=2, ?=0) | -34 (n=2, ?=0) | 0 (n=0, ?=4) | 0 (n=0, ?=4) |
| 2026-05 | 15,753 | 6/2 | 0 (n=0, ?=0) | -11,015 (n=4, ?=0) | -6,437 (n=2, ?=0) | -8,736 (n=3, ?=3) | -8,736 (n=3, ?=3) |
| 2026-06 | 1,584 | 11/3 | -1,671 (n=1, ?=0) | -7,727 (n=6, ?=0) | -354 (n=3, ?=0) | -8,534 (n=7, ?=0) | -1,161 (n=4, ?=0) |
| 2026-07 | -3,950 | 2/2 | 0 (n=0, ?=0) | -4,853 (n=2, ?=0) | -4,853 (n=2, ?=0) | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) |
| 2026-08 | 1,317 | 0/0 | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) |

## Long / touch monthly D6-D10: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D6 | D7 | D8 | D9 | D10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | 2,668 | 4/3 | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 3,387 (n=2, ?=1) | 3,387 (n=2, ?=1) |
| 2025-08 | 561 | 5/2 | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2025-09 | 5,608 | 4/2 | 0 (n=0, ?=6) | 0 (n=0, ?=6) | 0 (n=0, ?=6) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2025-10 | 7,325 | 0/2 | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 621 (n=1, ?=0) | 621 (n=1, ?=0) |
| 2025-11 | -1,443 | 1/1 | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2025-12 | -509 | 0/1 | 0 (n=0, ?=1) | 0 (n=0, ?=1) | 0 (n=0, ?=1) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-01 | -246 | 5/5 | 0 (n=0, ?=10) | 0 (n=0, ?=10) | 0 (n=0, ?=10) | -169 (n=1, ?=0) | -169 (n=1, ?=0) |
| 2026-02 | 4,940 | 7/3 | 0 (n=0, ?=10) | 0 (n=0, ?=10) | 0 (n=0, ?=10) | -3,330 (n=2, ?=0) | 1,496 (n=1, ?=0) |
| 2026-03 | 11,159 | 4/1 | 0 (n=0, ?=5) | 0 (n=0, ?=5) | 0 (n=0, ?=5) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-04 | 2,065 | 2/2 | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-05 | 15,753 | 6/2 | 0 (n=0, ?=3) | -8,736 (n=3, ?=3) | -8,736 (n=3, ?=3) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-06 | 1,584 | 11/3 | -2,521 (n=1, ?=0) | -1,161 (n=4, ?=0) | -1,161 (n=4, ?=0) | -2,456 (n=1, ?=0) | -2,456 (n=1, ?=0) |
| 2026-07 | -3,950 | 2/2 | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-08 | 1,317 | 0/0 | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) |

## Long / confirmed monthly D1-D5: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D1 | D2 | D3 | D4 | D5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -3,050 | 3/4 | 0 (n=0, ?=0) | 5,162 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=7) | 0 (n=0, ?=7) |
| 2025-08 | 1,420 | 6/2 | 0 (n=0, ?=0) | -2,953 (n=3, ?=0) | -176 (n=2, ?=0) | 0 (n=0, ?=8) | 0 (n=0, ?=8) |
| 2025-09 | 6,247 | 5/2 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=7) | 0 (n=0, ?=7) |
| 2025-10 | 7,167 | 2/2 | 0 (n=0, ?=0) | 4,295 (n=2, ?=0) | 4,295 (n=2, ?=0) | 0 (n=0, ?=4) | 0 (n=0, ?=4) |
| 2025-11 | -688 | 2/2 | 138 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=4) | 0 (n=0, ?=4) |
| 2025-12 | 673 | 0/2 | -46 (n=1, ?=0) | 1,331 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=2) | 0 (n=0, ?=2) |
| 2026-01 | -8,750 | 2/6 | 1,207 (n=3, ?=0) | 3,737 (n=5, ?=0) | 2,931 (n=4, ?=0) | 0 (n=0, ?=8) | 0 (n=0, ?=8) |
| 2026-02 | -6,255 | 4/4 | 435 (n=2, ?=0) | 316 (n=4, ?=0) | -1,180 (n=3, ?=0) | 0 (n=0, ?=8) | 0 (n=0, ?=8) |
| 2026-03 | 12,689 | 4/1 | 0 (n=0, ?=0) | -5,561 (n=2, ?=0) | -5,561 (n=2, ?=0) | 0 (n=0, ?=5) | 0 (n=0, ?=5) |
| 2026-04 | 2,401 | 1/2 | 0 (n=0, ?=0) | -2,622 (n=1, ?=0) | -2,622 (n=1, ?=0) | 0 (n=0, ?=3) | 0 (n=0, ?=3) |
| 2026-05 | 15,721 | 5/2 | 0 (n=0, ?=0) | -11,557 (n=4, ?=0) | -6,651 (n=2, ?=0) | -11,256 (n=4, ?=3) | -9,263 (n=3, ?=3) |
| 2026-06 | -2,243 | 9/5 | -1,739 (n=1, ?=0) | -10,837 (n=4, ?=0) | -8,214 (n=3, ?=0) | -12,609 (n=7, ?=0) | -10,160 (n=4, ?=0) |
| 2026-07 | -7,858 | 2/3 | 0 (n=0, ?=0) | -5,099 (n=2, ?=0) | -5,099 (n=2, ?=0) | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) |
| 2026-08 | 2,017 | 0/0 | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) |

## Long / confirmed monthly D6-D10: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D6 | D7 | D8 | D9 | D10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -3,050 | 3/4 | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 3,375 (n=2, ?=0) | 3,375 (n=2, ?=0) |
| 2025-08 | 1,420 | 6/2 | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 2,236 (n=1, ?=0) | 2,236 (n=1, ?=0) |
| 2025-09 | 6,247 | 5/2 | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=7) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2025-10 | 7,167 | 2/2 | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 621 (n=1, ?=0) | 621 (n=1, ?=0) |
| 2025-11 | -688 | 2/2 | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 0 (n=0, ?=4) | 697 (n=1, ?=0) | 697 (n=1, ?=0) |
| 2025-12 | 673 | 0/2 | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 0 (n=0, ?=2) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-01 | -8,750 | 2/6 | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 6,085 (n=2, ?=0) | -169 (n=1, ?=0) |
| 2026-02 | -6,255 | 4/4 | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 0 (n=0, ?=8) | 1,496 (n=1, ?=0) | 1,496 (n=1, ?=0) |
| 2026-03 | 12,689 | 4/1 | 0 (n=0, ?=5) | 0 (n=0, ?=5) | 0 (n=0, ?=5) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-04 | 2,401 | 1/2 | 0 (n=0, ?=3) | 0 (n=0, ?=3) | 0 (n=0, ?=3) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-05 | 15,721 | 5/2 | 0 (n=0, ?=3) | -9,263 (n=3, ?=3) | -9,263 (n=3, ?=3) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-06 | -2,243 | 9/5 | -5,171 (n=2, ?=0) | -10,160 (n=4, ?=0) | -10,160 (n=4, ?=0) | -5,243 (n=2, ?=0) | -5,243 (n=2, ?=0) |
| 2026-07 | -7,858 | 2/3 | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-08 | 2,017 | 0/0 | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) | 0 (n=0) |

## Recent / touch monthly D1-D5: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D1 | D2 | D3 | D4 | D5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 13,483 | 5/0 | 0 (n=0, ?=0) | -8,736 (n=3, ?=0) | -6,437 (n=2, ?=0) | -8,736 (n=3, ?=0) | -8,736 (n=3, ?=0) |
| 2026-06 | 1,584 | 11/3 | -1,671 (n=1, ?=0) | -7,727 (n=6, ?=0) | -354 (n=3, ?=0) | -8,534 (n=7, ?=0) | -1,161 (n=4, ?=0) |
| 2026-07 | -3,950 | 2/2 | 0 (n=0, ?=0) | -4,853 (n=2, ?=0) | -4,853 (n=2, ?=0) | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) |
| 2026-08 | 9,684 | 3/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-09 | 112 | 0/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |

## Recent / touch monthly D6-D10: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D6 | D7 | D8 | D9 | D10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 13,483 | 5/0 | 0 (n=0, ?=0) | -8,736 (n=3, ?=0) | -8,736 (n=3, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-06 | 1,584 | 11/3 | -2,521 (n=1, ?=0) | -1,161 (n=4, ?=0) | -1,161 (n=4, ?=0) | -2,456 (n=1, ?=0) | -2,456 (n=1, ?=0) |
| 2026-07 | -3,950 | 2/2 | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) | -2,434 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-08 | 9,684 | 3/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-09 | 112 | 0/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |

## Recent / confirmed monthly D1-D5: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D1 | D2 | D3 | D4 | D5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 17,131 | 4/0 | 0 (n=0, ?=0) | -9,263 (n=3, ?=0) | -6,651 (n=2, ?=0) | -11,256 (n=4, ?=0) | -9,263 (n=3, ?=0) |
| 2026-06 | -2,243 | 9/5 | -1,739 (n=1, ?=0) | -10,837 (n=4, ?=0) | -8,214 (n=3, ?=0) | -12,609 (n=7, ?=0) | -10,160 (n=4, ?=0) |
| 2026-07 | -7,858 | 2/3 | 0 (n=0, ?=0) | -5,099 (n=2, ?=0) | -5,099 (n=2, ?=0) | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) |
| 2026-08 | 10,239 | 3/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-09 | -1,429 | 1/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |

## Recent / confirmed monthly D6-D10: diagnostic balance, NOT monthly profit delta

| Observation month | Full baseline MTM $ | Deep baseline W/L | D6 | D7 | D8 | D9 | D10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 17,131 | 4/0 | 0 (n=0, ?=0) | -9,263 (n=3, ?=0) | -9,263 (n=3, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-06 | -2,243 | 9/5 | -5,171 (n=2, ?=0) | -10,160 (n=4, ?=0) | -10,160 (n=4, ?=0) | -5,243 (n=2, ?=0) | -5,243 (n=2, ?=0) |
| 2026-07 | -7,858 | 2/3 | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) | -2,676 (n=1, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-08 | 10,239 | 3/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |
| 2026-09 | -1,429 | 1/0 | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) | 0 (n=0, ?=0) |

## Arrival sensitivity at primary recent landmarks

| Period / TP | Diagnostic | Extra lag | Known / all | Flagged completed | Balance, NOT PnL |
| --- | --- | --- | --- | --- | --- |
| Recent / confirmed | D4 | 0s | 28/28 | 12 | -26,542 |
| Recent / confirmed | D4 | 15s | 0/28 | 0 | 0 |
| Recent / confirmed | D4 | 60s | 0/28 | 0 | 0 |
| Recent / confirmed | D5 | 0s | 28/28 | 8 | -22,099 |
| Recent / confirmed | D5 | 15s | 0/28 | 0 | 0 |
| Recent / confirmed | D5 | 60s | 0/28 | 0 | 0 |
| Recent / confirmed | D7 | 0s | 28/28 | 8 | -22,099 |
| Recent / confirmed | D7 | 15s | 0/28 | 0 | 0 |
| Recent / confirmed | D7 | 60s | 0/28 | 0 | 0 |
| Recent / touch | D4 | 0s | 27/27 | 11 | -19,704 |
| Recent / touch | D4 | 15s | 0/27 | 0 | 0 |
| Recent / touch | D4 | 60s | 0/27 | 0 | 0 |
| Recent / touch | D5 | 0s | 27/27 | 8 | -12,331 |
| Recent / touch | D5 | 15s | 0/27 | 0 | 0 |
| Recent / touch | D5 | 60s | 0/27 | 0 | 0 |
| Recent / touch | D7 | 0s | 27/27 | 8 | -12,331 |
| Recent / touch | D7 | 15s | 0/27 | 0 | 0 |
| Recent / touch | D7 | 60s | 0/27 | 0 | 0 |

