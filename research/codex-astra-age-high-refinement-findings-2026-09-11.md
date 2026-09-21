# L14: 8h + two-day-high exit refinement and combinations

September 11, 2026. Local long-ladder research only. No live configuration,
production code, state, exchange operations, deployment, commit or push changed.

## TL;DR

- **The recent improvement is broader than one exact setting.** 24 frozen new
  definitions,170 fresh replays,20 exact archived digest/metric controls and4
  recent single-rule refreshes. All24 improve recent total net in both TP
  models;22 also improve completed-episode net in both. This is a repeatedly
  mined overlapping historical window, not24 independent confirmations.
- **Best recent-profit combination:** original8h/high pair, deep funding guard
  disabled, hot-RSI TP cooldown disabled. Recent net **$42,134 / $40,616**
  (touch/confirmed), versus B17 **$20,887 / $15,812**; DD **20.40% /25.84%**
  versus **24.69% /31.11%**. But older touch DD rises to30.87% versus28.17%,
  with $8,933 MORE losing-episode cost than B17. It is not a universal
  loss-reduction improvement.
- **Cleaner cross-period refinement:10h TP cap, same2d/1% high exit.** Older
  touch/confirmed net **$67,781 /$40,382**, versus B17 **$46,832 /$19,490**,
  with lower DD in both. Recent **$36,542 /$34,839**, also lower DD than B17.
  Nevertheless it sacrifices up to$6,301 in an older month against B17.
  Only3/24 new variants improve aggregate net/DD versus B17 in all four cases;
  **0/24 pass the complete monthly screen**, and none dominates the original
  pair's net/DD in all four. Retain leads; do not change live settings.

## What the parent and changed knobs actually mean

The original pair is NOT an8h minimum hold. It combines:

1. One-way deferral of the ordinary4h soft-stale TP reduction until the oldest
   surviving rung reaches8h. While deferred, target stays1.4% rather than0.5%.
   Original ordinary eligibility still governs after release.
2. An independent full exit, from surviving-rung age4h onward at ANY depth,
   when the closed-minute price is within1% of the rolling2-day high.
   The high is the maximum of2880 contiguous, already-completed1m candles,
   not the eventual day's high or a future resistance level.
3. That discretionary exit executes at the NEXT minute OPEN and uses the
   original4-8h boundary forced-close cooldown. Ordinary full exits and S/R
   partials retain priority. There is no new entry veto or PnL floor.

The10h variant changes only item1's8h cap to10h; item2 can still close at4h.
It preserves S/R partials, deep funding guard, hot-RSI cooldown and all other
B17 controls. The aggressive combination retains8h but removes only the two
named controls. Deep-guard removal is NOT removal of trend, BTC, damaged
regime, daily breaker, ladder kill, emergency or hard flatten.

The fixed matrix is15 one-axis settings plus9 compositions. Exact definitions
and exclusions are in the [frozen method](../docs/research/age-high-refinement-l14.md)
and [card](../research-inputs/age-high-refinement-2026-09-11.json).
No post-result parameter expansion or new10h-plus-guard-removal combination
was smuggled into this pass.

## Periods, capital and accounting

- Older: **2025-07-01 00:00 to2026-08-19 21:32 UTC**.
- Recent: **2026-05-17 20:43 to2026-09-10 05:08 UTC**.
- Each starts flat with **$32,000**, $800 x1.35, maximum11, same repaired
  canonical B17 stack and transactional partial clocks.
- Fees remain **0.055% each side**, as agreed for comparative research.
  No live maker-fee savings are added. Funding settlement cash flows, live
  lot rounding, maker queues, liquidation/shared-account collateral and
  operating outages are not certified by this replay.
- Touch means a previously armed target may fill on a later minute's high.
  Confirmed means closed-minute TP confirmation then next-open execution.
  They have different occupancy paths, not a guaranteed best/worst envelope.
- Net includes open inventory marked at the cutoff and already-realized
  partials in the unfinished episode. W/L are COMPLETED flat-to-flat ladder
  episodes, not individual orders or partials.
- The periods overlap and have been repeatedly searched; do not sum their
  earnings or call one a fresh holdout.

The generic workflow's `economicQualification:not_evaluated` is intentional:
its hash verification is not an economic screen. The independent reviewer
passed, and the explicit strategy screen below returns0/24.

## What we learned beyond the headline profit

### 1. The original2-day/1%/4h high rule remains a strong reference

All five alternative proximity widths cost recent touch profit versus the
original pair.5h/6h minimum high-exit age costs profit in all four comparisons;
8h exit age lowers recent DD but also recent profit and worsens older DD.
The5d/6d high versions have attractive recent DD but older touch DD reaches
43.61%/46.27%.

The original pair's recent high exits are not mostly artifacts of an old high
rolling out of memory: of31 touch exits,14 fire when age first reaches4h,
16 follow a price crossing into the zone and1 follows an already-near state.
For confirmed,11/34 occur at first age eligibility,22 at a price crossing and1
already-near. None of these recent exits requires a falling rolling maximum
alone to cross the threshold. These are ex-post descriptions, not extra rules.

The broader family is positive recently, but there is no smooth parameter
plateau that guarantees dominance over the original pair across both periods.

### 2.10h improves balance, not every metric against the8h parent

Versus the original pair,10h adds **$9,699 recent confirmed net** but loses
**$685 recent touch net**. Older net improves by$5,187 confirmed and$6,450
touch; older confirmed DD rises from25.17% to27.32%, while older touch DD
falls from27.55% to24.67%.

Its losing-episode dollars are lower than B17 in all four cases. Against the
parent, recent touch losing dollars are unchanged; confirmed losing dollars
fall by$2,872. Older losing dollars fall in both models too. This is a more
direct continuation of the loss-reduction research than simply opening faster.

Monthly costs are still material: older confirmed September2025 net is
-$54 versus baseline+$6,247 (delta-$6,301); April2026 is-$3,140 versus
+$2,401 (delta-$5,541). All its recent monthly deltas are positive, but that
does not erase those older costs or prove the future regime will resemble
the recent window.

### 3. The aggressive winner earns more recently, but does not cut every loss bill

Recent touch winning-episode income rises from B17$57,130 to$69,851;
losing-episode cost falls from$33,009 to$27,717. Completed net improves
**$18,013**, plus **$3,234** ending-inventory/unfinished advantage, giving
the **$21,247** total improvement. Confirmed completed net improves$21,571,
plus$3,234 ending advantage, for$24,805 total.

Against the8h parent rather than B17, recent touch losing dollars actually
INCREASE by$2,171 while winning income rises$7,196. Older touch losing
dollars increase by **$17,990 versus the parent**, and total net is$4,377 lower.
Compared with B17, older touch loss cost is$149,839 versus$140,906.
Its worst older monthly sacrifice is$4,898 in February2026.

This is largely a changed construction/re-entry/cycling profile, not merely
an earlier exit on the same ladders. Only35 recent touch completed entries
match B17, versus233 replacement entries; confirmed has24 matched and201
replacement entries. Full occupancy attribution below includes what was
removed as well as what replaced it.

### 4. Smaller rung11 is not a monotonic safety improvement in a combined path

Adding half11 to the original pair reduces recent net from$37,226 to$26,651
touch and$25,140 to$20,126 confirmed. Touch DD rises24.35% ->31.09%.

A traced example explains the mechanism, not just the aggregate number:
the episode opened **2026-06-04 20:14 UTC**. Full rung11 gives weighted entry
$64.958927 and an already-armed1.4% TP at **$65.868352**; half11 gives
$65.078730 and TP **$65.989832**. The minute ending June5 01:34 has high
**$65.93**: the original target is touched; the half-size target is not.
Original episode closes+$770.41; the half-size path later emergency-closes
-$6,849.73 on June6 19:59. Both fill and target timings pass the independent
audit. Reducing the cheapest add changes weighted entry and future cycling;
it cannot be credited as the same ladder with proportionally smaller PnL.

### 5. Lower DD is not synonymous with lower aggregate losing dollars

Removing S/R partials from the parent improves recent confirmed DD from28.29%
to20.95%, yet losing-episode dollars RISE from$35,613 to$38,590. Touch losing
dollars rise$25,546 ->$32,195 even as DD falls24.35% ->22.13%.
More winning income and changed equity timing explain why those metrics can
move in opposite directions. Do not recommend disabling live S/R partials
from the DD column alone.

### 6. Sensitivity and remaining qualification

All50 delayed-high-source cases are checked.43 have identical net/DD;7
change net, ranging from-$56.32 to+$14.08. Only the1d touch case changes DD,
by-0.001834 percentage points. The original pair and all five ranked leaders
are economically unchanged. This tests a one-minute high-reference delay,
NOT slower market execution or an exchange queue.

Three new aggregate net/DD passes against B17 are `tp_age10`, `tp_age12`,
and `high_3d`. The12h/3d results trail the10h candidate's profit in both
periods/models; neither is promoted merely for passing the aggregate check.
All24 variants improve recent marked total net in both models, but the1d
high and half11+no-S/R variants have LOWER recent touch completed net than
B17; their ending marks create the positive headline.22/24 improve completed
net in both models.

The inherited screen remains recent net uplift >=$1,000, older >=0, no DD
increase, every monthly MTM delta >=-$250, >=20 recent intervention episodes,
no modeled nonpositive equity. **0/24 pass it.** Counts of target/high/size
episodes are separated below; they are not independent samples, and target
activity does not measure how often a disabled guard alone was decisive.

This is not a "nothing works" result: the gain is substantial across many
recent variants. It is a "profit and loss protection are not yet uniformly
better across historical regimes" result. Keep the original pair and10h
refinement as separate cross-period leads, and the double-removal combination
as an explicitly more aggressive recent-profit lead. No live change follows
from this study.

## All tested settings: baseline and original pair always shown

Ranking: smaller recent uplift across the two TP models; not independent validation. Values are dollars after unchanged modeled fees, including ending inventory.

### Recent: May 17-Sep 10, 2026

| Setup | Touch net $ | Touch DD | Confirmed net $ | Confirmed DD |
|---|---|---|---|---|
| B17 current | 20,887 | 24.69% | 15,812 | 31.11% |
| Original 8h + high pair | 37,226 | 24.35% | 25,140 | 28.29% |
| 8h alone | 29,732 | 20.35% | 24,380 | 25.44% |
| High exit alone | 24,438 | 22.96% | 23,152 | 21.08% |
| B17 no S/R partial | 21,036 | 23.80% | 24,003 | 24.95% |
| B17 no hot-RSI cooldown | 23,139 | 22.21% | 26,123 | 20.65% |
| Pair + no deep funding guard + no hot-RSI cooldown | 42,134 | 20.40% | 40,616 | 25.84% |
| Pair + no hot-RSI cooldown | 38,146 | 22.76% | 31,690 | 29.15% |
| TP cap 10h + high | 36,542 | 24.22% | 34,839 | 27.64% |
| Pair + no deep funding guard | 41,343 | 21.86% | 31,295 | 28.17% |
| Pair + no S/R partial | 37,081 | 22.13% | 30,798 | 20.95% |
| Pair + no deep funding guard + no S/R partial | 35,386 | 23.54% | 35,813 | 24.19% |
| Pair: high zone 1.5% | 32,500 | 25.68% | 27,624 | 29.51% |
| Pair + half11 + no deep funding guard | 33,468 | 25.82% | 27,339 | 26.22% |
| Pair: high zone 2% | 33,157 | 26.88% | 27,128 | 30.19% |
| Pair: 6d high | 35,449 | 21.36% | 26,901 | 25.41% |
| Pair: 5d high | 35,774 | 21.36% | 26,893 | 25.41% |
| Pair: high zone 0.5% | 29,706 | 23.71% | 28,276 | 23.80% |
| Pair + half11 + no hot-RSI cooldown | 29,508 | 25.68% | 29,271 | 27.42% |
| Pair: high exit from 8h | 34,911 | 20.35% | 24,199 | 25.15% |
| Pair: high zone 0.75% | 28,786 | 23.31% | 24,828 | 26.16% |
| Pair: high exit from 5h | 34,502 | 24.07% | 23,065 | 29.14% |
| TP cap 12h + high | 27,548 | 24.15% | 28,446 | 27.34% |
| Pair: high zone 1.25% | 36,344 | 25.24% | 22,004 | 29.43% |
| Pair: high exit from 6h | 32,109 | 21.31% | 21,116 | 31.04% |
| TP cap 6h + high | 25,961 | 29.20% | 22,745 | 31.26% |
| Pair + half11 | 26,651 | 31.09% | 20,126 | 26.96% |
| Pair: 3d high | 32,682 | 23.63% | 19,217 | 29.00% |
| Pair + half11 + no S/R partial | 22,216 | 25.31% | 26,048 | 19.90% |
| Pair: 1d high | 21,684 | 26.08% | 20,991 | 30.86% |

### Older: Jul 1, 2025-Aug 19, 2026

| Setup | Touch net $ | Touch DD | Confirmed net $ | Confirmed DD |
|---|---|---|---|---|
| B17 current | 46,832 | 28.17% | 19,490 | 45.65% |
| Original 8h + high pair | 61,332 | 27.55% | 35,194 | 25.17% |
| 8h alone | 51,354 | 36.85% | 37,582 | 34.19% |
| High exit alone | 44,159 | 36.27% | 28,652 | 45.02% |
| B17 no S/R partial | 52,225 | 28.23% | 35,733 | 30.74% |
| B17 no hot-RSI cooldown | 38,392 | 27.94% | 37,128 | 23.64% |
| Pair + no deep funding guard + no hot-RSI cooldown | 56,954 | 30.87% | 57,282 | 29.68% |
| Pair + no hot-RSI cooldown | 57,605 | 28.44% | 48,649 | 28.69% |
| TP cap 10h + high | 67,781 | 24.67% | 40,382 | 27.32% |
| Pair + no deep funding guard | 57,289 | 30.16% | 38,832 | 27.89% |
| Pair + no S/R partial | 63,587 | 29.33% | 41,886 | 28.43% |
| Pair + no deep funding guard + no S/R partial | 62,229 | 31.32% | 52,215 | 30.50% |
| Pair: high zone 1.5% | 41,238 | 29.79% | 20,529 | 29.72% |
| Pair + half11 + no deep funding guard | 50,679 | 26.52% | 32,251 | 25.49% |
| Pair: high zone 2% | 47,170 | 36.76% | 24,093 | 33.14% |
| Pair: 6d high | 38,942 | 46.27% | 19,810 | 35.83% |
| Pair: 5d high | 39,812 | 43.61% | 21,629 | 33.71% |
| Pair: high zone 0.5% | 48,088 | 30.75% | 33,143 | 31.44% |
| Pair + half11 + no hot-RSI cooldown | 37,643 | 29.16% | 46,790 | 25.80% |
| Pair: high exit from 8h | 54,430 | 29.33% | 38,526 | 29.35% |
| Pair: high zone 0.75% | 42,943 | 30.59% | 29,372 | 29.72% |
| Pair: high exit from 5h | 43,045 | 29.85% | 20,742 | 36.89% |
| TP cap 12h + high | 55,665 | 25.59% | 36,510 | 26.02% |
| Pair: high zone 1.25% | 62,289 | 26.88% | 27,141 | 28.62% |
| Pair: high exit from 6h | 44,873 | 31.88% | 27,405 | 32.96% |
| TP cap 6h + high | 49,847 | 27.55% | 32,442 | 28.38% |
| Pair + half11 | 48,214 | 24.31% | 29,558 | 22.78% |
| Pair: 3d high | 47,070 | 27.64% | 20,732 | 28.38% |
| Pair + half11 + no S/R partial | 47,673 | 25.23% | 40,708 | 25.70% |
| Pair: 1d high | 39,135 | 37.56% | 38,318 | 32.20% |

## Qualification and parent comparison

| New setup | Net/DD better than B17 all four? | Net/DD better than pair all four? | Complete screen | Failures |
|---|---|---|---|---|
| Pair + no deep funding guard + no hot-RSI cooldown | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| Pair + no hot-RSI cooldown | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| TP cap 10h + high | true | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly |
| Pair + no deep funding guard | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| Pair + no S/R partial | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| Pair + no deep funding guard + no S/R partial | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| Pair: high zone 1.5% | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-resting_touch:drawdown |
| Pair + half11 + no deep funding guard | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown |
| Pair: high zone 2% | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |
| Pair: 6d high | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| Pair: 5d high | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| Pair: high zone 0.5% | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| Pair + half11 + no hot-RSI cooldown | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |
| Pair: high exit from 8h | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:monthly |
| Pair: high zone 0.75% | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| Pair: high exit from 5h | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly |
| TP cap 12h + high | true | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-resting_touch:monthly |
| Pair: high zone 1.25% | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown |
| Pair: high exit from 6h | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-resting_touch:monthly |
| TP cap 6h + high | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:drawdown, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |
| Pair + half11 | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |
| Pair: 3d high | true | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| Pair + half11 + no S/R partial | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |
| Pair: 1d high | false | false | false | published_window-close_confirmed:monthly, published_window-resting_touch:net, published_window-resting_touch:drawdown, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly, hl_extended-resting_touch:net, hl_extended-resting_touch:drawdown, hl_extended-resting_touch:monthly |

Top-five shorthand used in the monthly tables:

- A: Pair + no deep funding guard + no hot-RSI cooldown (`plus_minus_deep_stress__minus_tp_cooldown`).
- B: Pair + no hot-RSI cooldown (`plus_minus_tp_cooldown`).
- C: TP cap 10h + high (`tp_age10`).
- D: Pair + no deep funding guard (`plus_minus_deep_stress`).
- E: Pair + no S/R partial (`plus_minus_sr_partial`).

## Complete-episode wins and losses: five highest-ranked new definitions

One W/L is a complete flat-to-flat ladder, including earlier partials and fees. Non-TP full closes include research high exits, some profitable, not just bad flattens.

### hl_extended / resting-touch

| Setup | W/L | Win $ | Loss $ | Completed net $ | Open + unfinished $ | Total net $ | DD | TP / other full |
|---|---|---|---|---|---|---|---|---|
| B17 current | 295/10 | 57,130 | -33,009 | 24,121 | -3,234 | 20,887 | 24.69% | 295/10 |
| Original 8h + high pair | 235/13 | 62,655 | -25,546 | 37,110 | 117 | 37,226 | 24.35% | 209/39 |
| Pair + no deep funding guard + no hot-RSI cooldown | 252/16 | 69,851 | -27,717 | 42,135 | -1 | 42,134 | 20.40% | 227/41 |
| Pair + no hot-RSI cooldown | 250/15 | 66,737 | -28,707 | 38,029 | 117 | 38,146 | 22.76% | 224/41 |
| TP cap 10h + high | 229/13 | 61,971 | -25,546 | 36,425 | 117 | 36,542 | 24.22% | 203/39 |
| Pair + no deep funding guard | 235/13 | 66,902 | -25,558 | 41,344 | -1 | 41,343 | 21.86% | 211/37 |
| Pair + no S/R partial | 268/16 | 69,013 | -32,195 | 36,818 | 263 | 37,081 | 22.13% | 247/37 |

### hl_extended / close-confirmed

| Setup | W/L | Win $ | Loss $ | Completed net $ | Open + unfinished $ | Total net $ | DD | TP / other full |
|---|---|---|---|---|---|---|---|---|
| B17 current | 243/11 | 59,238 | -40,192 | 19,046 | -3,234 | 15,812 | 31.11% | 242/12 |
| Original 8h + high pair | 193/15 | 60,636 | -35,613 | 25,023 | 117 | 25,140 | 28.29% | 167/41 |
| Pair + no deep funding guard + no hot-RSI cooldown | 209/16 | 72,341 | -31,724 | 40,617 | -1 | 40,616 | 25.84% | 181/44 |
| Pair + no hot-RSI cooldown | 203/15 | 65,038 | -33,464 | 31,573 | 117 | 31,690 | 29.15% | 173/45 |
| TP cap 10h + high | 196/14 | 67,463 | -32,741 | 34,722 | 117 | 34,839 | 27.64% | 168/42 |
| Pair + no deep funding guard | 188/16 | 65,781 | -34,486 | 31,295 | -1 | 31,295 | 28.17% | 160/44 |
| Pair + no S/R partial | 210/17 | 69,125 | -38,590 | 30,534 | 263 | 30,798 | 20.95% | 187/40 |

### published_window / resting-touch

| Setup | W/L | Win $ | Loss $ | Completed net $ | Open + unfinished $ | Total net $ | DD | TP / other full |
|---|---|---|---|---|---|---|---|---|
| B17 current | 955/57 | 187,738 | -140,906 | 46,832 | 0 | 46,832 | 28.17% | 953/59 |
| Original 8h + high pair | 772/69 | 193,180 | -131,848 | 61,332 | -0 | 61,332 | 27.55% | 661/180 |
| Pair + no deep funding guard + no hot-RSI cooldown | 784/77 | 206,793 | -149,839 | 56,954 | 0 | 56,954 | 30.87% | 667/194 |
| Pair + no hot-RSI cooldown | 814/73 | 200,413 | -142,807 | 57,605 | -0 | 57,605 | 28.44% | 697/190 |
| TP cap 10h + high | 756/69 | 198,212 | -130,431 | 67,781 | 0 | 67,781 | 24.67% | 642/183 |
| Pair + no deep funding guard | 734/72 | 197,261 | -139,973 | 57,289 | -0 | 57,289 | 30.16% | 624/182 |
| Pair + no S/R partial | 811/76 | 201,268 | -137,681 | 63,587 | 0 | 63,587 | 29.33% | 712/175 |

### published_window / close-confirmed

| Setup | W/L | Win $ | Loss $ | Completed net $ | Open + unfinished $ | Total net $ | DD | TP / other full |
|---|---|---|---|---|---|---|---|---|
| B17 current | 788/60 | 190,819 | -171,329 | 19,490 | -0 | 19,490 | 45.65% | 785/63 |
| Original 8h + high pair | 656/69 | 191,416 | -156,222 | 35,194 | 0 | 35,194 | 25.17% | 536/189 |
| Pair + no deep funding guard + no hot-RSI cooldown | 663/74 | 214,169 | -156,897 | 57,272 | 11 | 57,282 | 29.68% | 536/201 |
| Pair + no hot-RSI cooldown | 679/70 | 201,377 | -152,738 | 48,639 | 11 | 48,649 | 28.69% | 552/197 |
| TP cap 10h + high | 644/68 | 195,909 | -155,527 | 40,382 | 0 | 40,382 | 27.32% | 515/197 |
| Pair + no deep funding guard | 624/72 | 198,654 | -159,822 | 38,832 | 0 | 38,832 | 27.89% | 498/198 |
| Pair + no S/R partial | 693/74 | 203,477 | -161,591 | 41,886 | 0 | 41,886 | 28.43% | 584/183 |

## Monthly MTM: baseline absolute dollars; every other column is delta vs B17

Partial first/last months are not full months. Older/recent windows overlap, and are different initially-flat paths. Every top-five variant is included, even when it fails.

### hl_extended / resting-touch

| Month | B17 net $ | Pair delta $ | A delta $ | B delta $ | C delta $ | D delta $ | E delta $ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 13,483 | 2,007 | 6,419 | 4,999 | 2,458 | 3,688 | 2,271 |
| 2026-06 | 1,584 | 6,729 | 9,246 | 7,920 | 6,243 | 8,893 | 6,871 |
| 2026-07 | -3,950 | 5,389 | 2,638 | 886 | 5,016 | 5,193 | 3,851 |
| 2026-08 | 9,684 | 1,521 | 3,054 | 3,063 | 1,253 | 2,073 | 2,339 |
| 2026-09 | 85 | 693 | -111 | 392 | 686 | 610 | 863 |

### hl_extended / close-confirmed

| Month | B17 net $ | Pair delta $ | A delta $ | B delta $ | C delta $ | D delta $ | E delta $ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 17,131 | 345 | 2,392 | 1,241 | 745 | -31 | 2,147 |
| 2026-06 | -2,243 | -2,108 | 10,066 | 1,191 | 6,313 | 5,375 | 2,858 |
| 2026-07 | -7,858 | 7,888 | 8,596 | 8,291 | 7,726 | 6,936 | 6,708 |
| 2026-08 | 10,239 | 2,682 | 3,315 | 3,305 | 3,722 | 2,841 | 2,780 |
| 2026-09 | -1,456 | 521 | 435 | 1,850 | 521 | 361 | 494 |

### published_window / resting-touch

| Month | B17 net $ | Pair delta $ | A delta $ | B delta $ | C delta $ | D delta $ | E delta $ |
|---|---|---|---|---|---|---|---|
| 2025-07 | 2,668 | 4,881 | 1,642 | 5,747 | 5,431 | 589 | -132 |
| 2025-08 | 561 | -2,307 | -2,052 | -2,229 | -658 | -2,185 | -2,160 |
| 2025-09 | 5,608 | -4,864 | -4,222 | -4,222 | -4,864 | -4,864 | -4,321 |
| 2025-10 | 7,325 | 2,791 | -2,441 | -2,278 | 3,337 | 627 | 6,207 |
| 2025-11 | -1,443 | 2,591 | 2,944 | 3,686 | 3,642 | 1,095 | 4,644 |
| 2025-12 | -509 | 227 | 3,814 | 3,775 | 803 | 439 | -400 |
| 2026-01 | -246 | 1,943 | 4,723 | 3,684 | 1,899 | 3,999 | 5,572 |
| 2026-02 | 4,940 | 4,056 | -4,898 | -6,020 | 4,218 | 1,639 | 1,230 |
| 2026-03 | 11,159 | 2,336 | 917 | 5,407 | 2,028 | -135 | 3,754 |
| 2026-04 | 2,065 | -3,893 | -1,702 | -3,147 | -1,849 | -1,806 | -2,899 |
| 2026-05 | 15,753 | -5,103 | -456 | -2,674 | -4,020 | -2,496 | -4,685 |
| 2026-06 | 1,584 | 6,729 | 9,246 | 7,920 | 6,243 | 8,893 | 6,871 |
| 2026-07 | -3,950 | 5,389 | 2,638 | 886 | 5,016 | 5,193 | 3,851 |
| 2026-08 | 1,317 | -277 | -32 | 237 | -277 | -532 | -779 |

### published_window / close-confirmed

| Month | B17 net $ | Pair delta $ | A delta $ | B delta $ | C delta $ | D delta $ | E delta $ |
|---|---|---|---|---|---|---|---|
| 2025-07 | -3,050 | 11,830 | 5,334 | 9,739 | 12,039 | 7,383 | 6,565 |
| 2025-08 | 1,420 | -1,405 | -276 | -1,077 | -289 | -1,938 | -462 |
| 2025-09 | 6,247 | -5,511 | -4,029 | -4,029 | -6,301 | -5,511 | -4,993 |
| 2025-10 | 7,167 | 3,275 | 1,242 | 934 | 2,239 | 3,498 | 6,384 |
| 2025-11 | -688 | 1,934 | 2,339 | 3,055 | 3,334 | 645 | 4,251 |
| 2025-12 | 673 | 18 | 3,844 | 2,923 | 99 | 1,045 | -705 |
| 2026-01 | -8,750 | 2,760 | 13,238 | 12,513 | 2,715 | 3,583 | 5,139 |
| 2026-02 | -6,255 | 4,211 | -494 | -2,353 | 55 | 1,976 | 1,576 |
| 2026-03 | 12,689 | 416 | 364 | 3,594 | 1,454 | -260 | 2,603 |
| 2026-04 | 2,401 | -3,916 | -2,077 | -3,095 | -5,541 | 321 | -3,642 |
| 2026-05 | 15,721 | -3,585 | -826 | -3,071 | -2,848 | -3,685 | -2,423 |
| 2026-06 | -2,243 | -2,108 | 10,066 | 1,191 | 6,313 | 5,375 | 2,858 |
| 2026-07 | -7,858 | 7,888 | 8,596 | 8,291 | 7,726 | 6,936 | 6,708 |
| 2026-08 | 2,017 | -102 | 471 | 545 | -102 | -27 | -1,461 |

## Attribution: losing dollars, replacement cycles and unfinished inventory

These are accounting identities and ex-post attribution, not predictive labels. Same-entry episodes may still have different later adds/partials.

### Recent / resting-touch

| Setup | Win-income delta $ | Loss dollars avoided $ | Completed delta $ | End delta $ | Total vs B17 $ | Total vs pair $ |
|---|---|---|---|---|---|---|
| Original 8h + high pair | 5,525 | 7,464 | 12,988 | 3,351 | 16,340 | 0 |
| Pair + no deep funding guard + no hot-RSI cooldown | 12,721 | 5,293 | 18,013 | 3,234 | 21,247 | 4,907 |
| Pair + no hot-RSI cooldown | 9,606 | 4,302 | 13,908 | 3,351 | 17,259 | 920 |
| TP cap 10h + high | 4,840 | 7,464 | 12,304 | 3,351 | 15,655 | -685 |
| Pair + no deep funding guard | 9,772 | 7,451 | 17,223 | 3,234 | 20,456 | 4,117 |
| Pair + no S/R partial | 11,883 | 815 | 12,697 | 3,498 | 16,195 | -145 |

| Setup | Matched entry delta $ | Removed baseline net $ | Replacement net $ | End delta $ | Matched / removed / new |
|---|---|---|---|---|---|
| Original 8h + high pair | 8,385 | 4,956 | 9,560 | 3,351 | 120/185/128 |
| Pair + no deep funding guard + no hot-RSI cooldown | 5,656 | 18,957 | 31,314 | 3,234 | 35/270/233 |
| Pair + no hot-RSI cooldown | 4,740 | 19,079 | 28,248 | 3,351 | 34/271/231 |
| TP cap 10h + high | 10,124 | 5,600 | 7,780 | 3,351 | 117/188/125 |
| Pair + no deep funding guard | 8,962 | 10,476 | 18,736 | 3,234 | 94/211/154 |
| Pair + no S/R partial | 3,091 | 745 | 10,351 | 3,498 | 128/177/156 |

| Setup | High exits | Hard flatten | Emergency | Funding spike | S/R partials | Target episodes | Half-size episodes |
|---|---|---|---|---|---|---|---|
| B17 current | 0 | 7 | 2 | 1 | 87 | 0 | 0 |
| Original 8h + high pair | 31 | 6 | 1 | 1 | 93 | 103 | 0 |
| Pair + no deep funding guard + no hot-RSI cooldown | 33 | 5 | 1 | 2 | 79 | 95 | 0 |
| Pair + no hot-RSI cooldown | 32 | 6 | 1 | 2 | 84 | 99 | 0 |
| TP cap 10h + high | 31 | 6 | 1 | 1 | 89 | 102 | 0 |
| Pair + no deep funding guard | 29 | 6 | 1 | 1 | 86 | 104 | 0 |
| Pair + no S/R partial | 28 | 5 | 2 | 2 | 0 | 101 | 0 |

### Recent / close-confirmed

| Setup | Win-income delta $ | Loss dollars avoided $ | Completed delta $ | End delta $ | Total vs B17 $ | Total vs pair $ |
|---|---|---|---|---|---|---|
| Original 8h + high pair | 1,398 | 4,579 | 5,977 | 3,351 | 9,328 | 0 |
| Pair + no deep funding guard + no hot-RSI cooldown | 13,103 | 8,468 | 21,571 | 3,234 | 24,805 | 15,477 |
| Pair + no hot-RSI cooldown | 5,799 | 6,728 | 12,527 | 3,351 | 15,878 | 6,550 |
| TP cap 10h + high | 8,225 | 7,451 | 15,676 | 3,351 | 19,027 | 9,699 |
| Pair + no deep funding guard | 6,543 | 5,707 | 12,249 | 3,234 | 15,483 | 6,155 |
| Pair + no S/R partial | 9,887 | 1,602 | 11,488 | 3,498 | 14,986 | 5,658 |

| Setup | Matched entry delta $ | Removed baseline net $ | Replacement net $ | End delta $ | Matched / removed / new |
|---|---|---|---|---|---|
| Original 8h + high pair | 15,684 | 7,457 | -2,250 | 3,351 | 100/154/108 |
| Pair + no deep funding guard + no hot-RSI cooldown | 5,694 | 16,452 | 32,329 | 3,234 | 24/230/201 |
| Pair + no hot-RSI cooldown | 2,435 | 12,583 | 22,676 | 3,351 | 24/230/194 |
| TP cap 10h + high | 17,433 | 6,930 | 5,173 | 3,351 | 102/152/108 |
| Pair + no deep funding guard | 17,761 | 14,965 | 9,453 | 3,234 | 79/175/125 |
| Pair + no S/R partial | 5,787 | -1,008 | 4,693 | 3,498 | 90/164/137 |

| Setup | High exits | Hard flatten | Emergency | Funding spike | S/R partials | Target episodes | Half-size episodes |
|---|---|---|---|---|---|---|---|
| B17 current | 0 | 9 | 1 | 2 | 72 | 0 | 0 |
| Original 8h + high pair | 34 | 5 | 2 | 0 | 85 | 88 | 0 |
| Pair + no deep funding guard + no hot-RSI cooldown | 36 | 6 | 2 | 0 | 98 | 100 | 0 |
| Pair + no hot-RSI cooldown | 38 | 5 | 2 | 0 | 89 | 94 | 0 |
| TP cap 10h + high | 34 | 5 | 2 | 1 | 92 | 90 | 0 |
| Pair + no deep funding guard | 36 | 6 | 2 | 0 | 82 | 95 | 0 |
| Pair + no S/R partial | 31 | 5 | 2 | 2 | 0 | 84 | 0 |

## One-minute high-source delay

Current decision price and ordinary fills are unchanged. This does not certify market-fill latency.

| Setup | Touch net change $ | Touch DD change pp | Confirmed net change $ | Confirmed DD change pp |
|---|---|---|---|---|
| Original 8h + high pair | 0 | 0.000 | 0 | 0.000 |
| TP cap 6h + high | 0 | 0.000 | 0 | 0.000 |
| TP cap 10h + high | 0 | 0.000 | 0 | 0.000 |
| TP cap 12h + high | 0 | 0.000 | 0 | 0.000 |
| Pair: high zone 0.5% | 0 | 0.000 | 0 | 0.000 |
| Pair: high zone 0.75% | -56 | 0.000 | -56 | 0.000 |
| Pair: high zone 1.25% | 14 | 0.000 | 14 | 0.000 |
| Pair: high zone 1.5% | 0 | 0.000 | 0 | 0.000 |
| Pair: high zone 2% | 0 | 0.000 | -3 | 0.000 |
| Pair: high exit from 5h | 0 | 0.000 | 0 | 0.000 |
| Pair: high exit from 6h | 0 | 0.000 | 0 | 0.000 |
| Pair: high exit from 8h | 0 | 0.000 | 0 | 0.000 |
| Pair: 1d high | 1 | -0.002 | -3 | 0.000 |
| Pair: 3d high | 0 | 0.000 | 0 | 0.000 |
| Pair: 5d high | 0 | 0.000 | 0 | 0.000 |
| Pair: 6d high | 0 | 0.000 | 0 | 0.000 |
| Pair + half11 | 0 | 0.000 | 0 | 0.000 |
| Pair + no deep funding guard | 0 | 0.000 | 0 | 0.000 |
| Pair + no S/R partial | 0 | 0.000 | 0 | 0.000 |
| Pair + no hot-RSI cooldown | 0 | 0.000 | 0 | 0.000 |
| Pair + half11 + no deep funding guard | 0 | 0.000 | 0 | 0.000 |
| Pair + half11 + no S/R partial | 0 | 0.000 | 0 | 0.000 |
| Pair + half11 + no hot-RSI cooldown | 0 | 0.000 | 0 | 0.000 |
| Pair + no deep funding guard + no S/R partial | 0 | 0.000 | 0 | 0.000 |
| Pair + no deep funding guard + no hot-RSI cooldown | 0 | 0.000 | 0 | 0.000 |



## Reproduction and verification

Accepted job:
`4db33309cc7f9399f07f89d979b191752e227c64582928dc02c38aeca715fd3a`.

Definition identity:
`d2f16d0b5562ab9e881aacc96ec953ecf8c3dda86e24b7069a9cd74cdacd370b`.

Artifacts under `backtests/research-workflow/KEY/`:
`plan.json`, `state.json`, `verification.json`, and `output/` containing
`results.json`, `comparisons.json`, `ranking.json`, `overview.csv`,
`monthly.csv`, control parity, exact per-case inventory, all target arm
events, size permissions, high decisions and first-source evidence. Monthly
CSV includes absolute MTM, realized PnL, winning/losing dollars and counts for
EVERY setup; the displayed delta tables cover all top-five candidates.

Independent verification passed **722,334 fills**, **54,118,840 minute marks**,
**26,064,868 target-policy checks**, **26,003,071 high-exit checks**, and
**629,301 size permissions** across170 replay cases. These repeat shared
history across variants; they are not independent market observations.

Both project typechecks, focused strict research-file typecheck, L14 policy/
timing/accounting tests, L13 combination/target-audit tests, near-high tests,
current-stack replay tests, research-workflow tests, content pin verification
and whitespace checks passed. Original L13 sources remain unchanged. Six
protected live/config/state hashes are unchanged.

```powershell
npx ts-node scripts/age-high-refinement-tests.ts
npx ts-node scripts/hype-age-high-refinement-study.ts plan research-inputs/age-high-refinement-2026-09-11.json
# A completed job cannot be rerun/overwritten. Inspect the existing accepted key.
npx ts-node scripts/age-high-refinement-verify.ts 4db33309cc7f9399f07f89d979b191752e227c64582928dc02c38aeca715fd3a
npx ts-node scripts/age-high-refinement-report.ts 4db33309cc7f9399f07f89d979b191752e227c64582928dc02c38aeca715fd3a
```

Research registry becomes **5,261 standalone /153 ladder overlays**; L09
component profiles stay separate.24 new definitions, not170 new strategies.
Nearby settings or combinations absent from the frozen card remain untested;
this is a focused expansion, not a claim to exhaust all possible combinations.

