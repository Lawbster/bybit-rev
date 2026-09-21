# L15: 10h + aggressive entry-guard combinations — findings

September 11, 2026. Local research; no live configuration or production changes.

## TL;DR

- **Three new definitions, 46 replays, 24 exact archived controls.** All three
  improve aggregate net profit AND maximum drawdown versus current B17 in both
  periods and both TP models. **0/3 pass the complete monthly screen.**
- **10h aggressive is the strongest new recent-profit candidate across the two
  TP assumptions**, not a universal winner: recent touch $40,783 / DD20.39%;
  confirmed $46,922 / DD25.68%, against B17 $20,887 /24.69% and $15,812 /31.11%.
  Versus aggressive8h, older profit improves in both models, but recent touch
  gives up $1,351 and older confirmed DD increases 0.48 percentage points.
- The older costs are concrete: aggressive10h has **$7,990 more losing dollars**
  than B17 in the older touch model, despite higher net profit/lower DD.
  February2026 MTM is **-$2,829 versus B17 +$4,940**, a -$7,769 difference.
  Entry traces show both damaging hot-TP reopens and beneficial earlier deep
  adds. Do not interpret aggregate improvement as proof that the guards are useless.

[Method and exact semantics](../docs/research/age10-gate-factorial-l15.md).
[Frozen card](../research-inputs/age10-gate-factorial-2026-09-11.json).
[Prior L14](codex-astra-age-high-refinement-findings-2026-09-11.md).

## What changed, and what did not

The three new setups are safeguarded10h + remove the RSI cooldown only;
+ remove the deep funding guard only; + remove both (aggressive10h).
All keep the same 2-day/1% high exit. Six previously tested controls complete
the eight-cell 8h/10h x two guards on/off factorial, plus B17. Three new
definitions, NOT eight new definitions or 46 independent samples.

TP patience keeps the ordinary1.4% target while the one-way soft-stale deferral
is active; the normal0.5% rule resumes after permission releases. This is not
a minimum hold or a full exit at10h. The separate full high exit is eligible
from oldest surviving age4h, at any depth and without a profit floor. Ordinary
exits and S/R partials retain priority. Its original4-8h forced cooldown remains.

Deep guard removal affects known negative-funding timer adds at existing
depth5+; genuine0.3% price-drop adds already bypass it. The existing S/R support
exception is included in attribution. RSI cooldown removal eliminates the30min
wait following a TP whose known1h RSI is >60. No trend/latch/emergency/hard
flatten removal; no sizing changes, new signals, live short or maker change.

Fixed windows, independently flat $32,000 each:

- Older: **2025-07-01 00:00 to2026-08-19 21:32 UTC**.
- Recent: **2026-05-17 20:43 to2026-09-10 05:08 UTC**.

Same repaired canonical replay, $800 x1.35 max11, modeled0.055% fees each side.
These windows overlap and have already been examined repeatedly; neither is
a fresh holdout. No actual funding settlement, maker queue/fee verification,
Bybit maintenance-margin liquidation or shared-short-collateral certification.
The two TP models are different occupancy paths, not guaranteed price bounds.

## Interpretation before the tables

### 1. Combining the two ideas helps, but does not remove the trade-off

Aggressive10h versus aggressive8h:

| Case | Net change $ | DD change, percentage points |
|---|---:|---:|
| Recent touch | -1,351 | -0.01 |
| Recent confirmed | +6,306 | -0.15 |
| Older touch | +4,680 | -5.78 |
| Older confirmed | +7,693 | +0.48 |

This is a better cross-period result than simply assuming aggressive must stay
at8h, but it is not dominance in every metric. Safeguarded10h still wins the
older touch profit comparison: **$67,781 versus $61,635**, with slightly lower
DD24.67% versus25.09%. Removing both guards adds $18,465 of losing dollars
against that safeguarded10h control in the older touch path.

All three new configurations qualify only as aggregate B17 improvements, not
complete-screen upgrades. The no-funding-guard-only10h arm also sacrifices
$1,196 in recent May under close-confirmed TP; both aggressive10h and
no-RSI-cooldown10h stay within the recent monthly tolerance but fail older months.

### 2. Recent touch gains over guarded10h are concentrated

For aggressive10h versus safeguarded10h, recent touch net improves **$4,241**:

| Accounting contribution | Dollars |
|---|---:|
| Matched-entry episode changes | +6,098 |
| Removed guarded10h completed-episode net | -37,531 |
| Replacement completed-episode net | +35,792 |
| Open/unfinished difference | -118 |
| Total | +4,241 |

One matched-entry episode, starting **June22 13:32 UTC**, changes from
**-$4,507** under safeguarded10h to **+$770** under aggressive10h: a **+$5,277**
difference, larger than the entire $4,241 marginal net improvement. Removing
that positive accounting contribution would reverse the marginal comparison.
That subtraction is a concentration diagnostic, NOT a replay that excludes
the episode; its later occupancy effects cannot be deleted arithmetically.

At the first independently flagged extra timer add in that ladder, rung7:
RSI1h52.55, above4h EMA200, 6h return+1.38%, HL15m taker2.63, HL1h taker0.916,
and Binance funding-0.003306%. The short flow window was buying, but the
hourly flow was not strong; a blanket requirement that both exceed1 would
have rejected this beneficial add. Four subsequent changed rung fills were
ordinary price-drop adds. The whole $5,277 cannot be assigned to rung7 alone.

In recent close-confirmed, the marginal improvement is more broadly split:
**+$3,556 matched-entry**, **+$8,645 replacement-minus-removed net**, **-$118
ending inventory** = **+$12,084**. That is primarily improved cycling and
replacement opportunities, not merely rescuing the same old bad ladders.

### 3. There are real reasons to retain some re-entry protection

A directly traceable older touch example:

| Path after the February3 08:26 UTC TP | Next entry | Outcome of that next ladder |
|---|---|---:|
| B17 | February3 08:56 | +$149 TP |
| Safeguarded10h | February3 08:56 | +$149 TP |
| Aggressive8h / aggressive10h | February3 08:27 | -$8,712 emergency close February5 |

The prior ladders do not have identical entry times, but they close at the
same08:26 TP time. The aggressive08:27 entry is explicitly inside the hot-RSI
cooldown. Current RSI1h74.38, positive6h return+4.69%, and aboveEMA200 did NOT
make the early reopen safe. This is not evidence that all early reopens lose:
the complete win/loss and replacement totals below include the successful ones.

Other losing aggressive10h replacement ladders in February started February9
and February27 inside the hot-TP cooldown; February14 and February21 included
newly permitted negative-funding timer adds. All had aboveEMA200 context at
the flagged entries. Therefore a simple above-EMA exception would not remove
these losses. They are diagnostic examples, not a hindsight blacklist.

Another shared-entry example, **March29 16:00**, makes the funding-side risk
visible: safeguarded10h earns about **+$233 touch /+$252 confirmed**, while
aggressive10h ultimately loses **-$5,558**. Three changed timer adds at depths
8,10,11 would have been blocked by the original funding guard, with RSI1h
roughly36.8-38.6 and slightly negative6h returns. HL observations are unavailable
in that older case; do not fabricate a flow explanation.

These examples explain why both guards can help and hurt. The full replay,
not a selected good/bad episode, remains the deciding evidence.

## Full factorial overview

Net includes ending marked inventory; fees unchanged. Periods overlap and start flat independently.

### Recent: May 17-Sep 10, 2026

| Setup | Touch net $ | Touch DD | Confirmed net $ | Confirmed DD |
|---|---|---|---|---|
| B17 current | 20,887 | 24.69% | 15,812 | 31.11% |
| 8h safeguarded | 37,226 | 24.35% | 25,140 | 28.29% |
| 10h safeguarded | 36,542 | 24.22% | 34,839 | 27.64% |
| 8h no funding guard | 41,343 | 21.86% | 31,295 | 28.17% |
| 8h no RSI cooldown | 38,146 | 22.76% | 31,690 | 29.15% |
| 8h aggressive | 42,134 | 20.40% | 40,616 | 25.84% |
| 10h no RSI cooldown | 37,580 | 22.69% | 41,275 | 29.03% |
| 10h no funding guard | 40,223 | 21.81% | 36,968 | 28.27% |
| 10h aggressive | 40,783 | 20.39% | 46,922 | 25.68% |

### Older: Jul 1, 2025-Aug 19, 2026

| Setup | Touch net $ | Touch DD | Confirmed net $ | Confirmed DD |
|---|---|---|---|---|
| B17 current | 46,832 | 28.17% | 19,490 | 45.65% |
| 8h safeguarded | 61,332 | 27.55% | 35,194 | 25.17% |
| 10h safeguarded | 67,781 | 24.67% | 40,382 | 27.32% |
| 8h no funding guard | 57,289 | 30.16% | 38,832 | 27.89% |
| 8h no RSI cooldown | 57,605 | 28.44% | 48,649 | 28.69% |
| 8h aggressive | 56,954 | 30.87% | 57,282 | 29.68% |
| 10h no RSI cooldown | 62,364 | 23.84% | 54,763 | 31.89% |
| 10h no funding guard | 64,328 | 25.98% | 44,288 | 26.13% |
| 10h aggressive | 61,635 | 25.09% | 64,976 | 30.17% |

## Complete ladder W/L dollars

One W/L is a flat-to-flat ladder including partials and fees. Open + unfinished includes marked inventory and partial cash from an unclosed episode.

### hl_extended / resting_touch

| Setup | W/L | Winning $ | Losing $ | Completed net $ | Open + unfinished $ | Total net $ | TP / other full |
|---|---|---|---|---|---|---|---|
| B17 current | 295/10 | 57,130 | -33,009 | 24,121 | -3,234 | 20,887 | 295/10 |
| 10h safeguarded | 229/13 | 61,971 | -25,546 | 36,425 | 117 | 36,542 | 203/39 |
| 8h aggressive | 252/16 | 69,851 | -27,717 | 42,135 | -1 | 42,134 | 227/41 |
| 10h no RSI cooldown | 242/15 | 66,170 | -28,707 | 37,463 | 117 | 37,580 | 215/42 |
| 10h no funding guard | 222/14 | 65,537 | -25,313 | 40,224 | -1 | 40,223 | 197/39 |
| 10h aggressive | 242/16 | 68,731 | -27,948 | 40,784 | -1 | 40,783 | 216/42 |

### hl_extended / close_confirmed

| Setup | W/L | Winning $ | Losing $ | Completed net $ | Open + unfinished $ | Total net $ | TP / other full |
|---|---|---|---|---|---|---|---|
| B17 current | 243/11 | 59,238 | -40,192 | 19,046 | -3,234 | 15,812 | 242/12 |
| 10h safeguarded | 196/14 | 67,463 | -32,741 | 34,722 | 117 | 34,839 | 168/42 |
| 8h aggressive | 209/16 | 72,341 | -31,724 | 40,617 | -1 | 40,616 | 181/44 |
| 10h no RSI cooldown | 211/14 | 71,753 | -30,594 | 41,159 | 117 | 41,275 | 179/46 |
| 10h no funding guard | 188/13 | 70,340 | -33,372 | 36,969 | -1 | 36,968 | 158/43 |
| 10h aggressive | 215/13 | 77,533 | -30,610 | 46,923 | -1 | 46,922 | 184/44 |

### published_window / resting_touch

| Setup | W/L | Winning $ | Losing $ | Completed net $ | Open + unfinished $ | Total net $ | TP / other full |
|---|---|---|---|---|---|---|---|
| B17 current | 955/57 | 187,738 | -140,906 | 46,832 | 0 | 46,832 | 953/59 |
| 10h safeguarded | 756/69 | 198,212 | -130,431 | 67,781 | 0 | 67,781 | 642/183 |
| 8h aggressive | 784/77 | 206,793 | -149,839 | 56,954 | 0 | 56,954 | 667/194 |
| 10h no RSI cooldown | 801/74 | 205,788 | -143,424 | 62,364 | -0 | 62,364 | 680/195 |
| 10h no funding guard | 710/71 | 203,271 | -138,943 | 64,328 | -0 | 64,328 | 594/187 |
| 10h aggressive | 765/75 | 210,530 | -148,896 | 61,635 | -0 | 61,635 | 642/198 |

### published_window / close_confirmed

| Setup | W/L | Winning $ | Losing $ | Completed net $ | Open + unfinished $ | Total net $ | TP / other full |
|---|---|---|---|---|---|---|---|
| B17 current | 788/60 | 190,819 | -171,329 | 19,490 | -0 | 19,490 | 785/63 |
| 10h safeguarded | 644/68 | 195,909 | -155,527 | 40,382 | 0 | 40,382 | 515/197 |
| 8h aggressive | 663/74 | 214,169 | -156,897 | 57,272 | 11 | 57,282 | 536/201 |
| 10h no RSI cooldown | 675/67 | 205,360 | -150,608 | 54,752 | 11 | 54,763 | 539/203 |
| 10h no funding guard | 616/67 | 202,499 | -158,212 | 44,288 | 0 | 44,288 | 480/203 |
| 10h aggressive | 670/67 | 220,017 | -155,052 | 64,965 | 11 | 64,976 | 532/205 |

## Monthly MTM: baseline absolute net, others delta vs B17

Partial first/last months are not complete calendar months. G=guarded10h, A=aggressive8h; N1=10h no RSI cooldown, N2=10h no funding guard, N3=aggressive10h.

### hl_extended / resting_touch

| Month | B17 net $ | G delta $ | A delta $ | N1 delta $ | N2 delta $ | N3 delta $ |
|---|---|---|---|---|---|---|
| 2026-05 | 13,483 | 2,458 | 6,419 | 5,509 | 3,966 | 6,758 |
| 2026-06 | 1,584 | 6,243 | 9,246 | 6,697 | 8,390 | 7,410 |
| 2026-07 | -3,950 | 5,016 | 2,638 | 886 | 4,305 | 2,638 |
| 2026-08 | 9,684 | 1,253 | 3,054 | 3,217 | 2,073 | 3,209 |
| 2026-09 | 85 | 686 | -111 | 384 | 602 | -118 |

### hl_extended / close_confirmed

| Month | B17 net $ | G delta $ | A delta $ | N1 delta $ | N2 delta $ | N3 delta $ |
|---|---|---|---|---|---|---|
| 2026-05 | 17,131 | 745 | 2,392 | 517 | -1,196 | 1,793 |
| 2026-06 | -2,243 | 6,313 | 10,066 | 10,304 | 8,326 | 12,975 |
| 2026-07 | -7,858 | 7,726 | 8,596 | 8,128 | 9,602 | 11,233 |
| 2026-08 | 10,239 | 3,722 | 3,315 | 4,664 | 4,063 | 4,674 |
| 2026-09 | -1,456 | 521 | 435 | 1,850 | 361 | 435 |

### published_window / resting_touch

| Month | B17 net $ | G delta $ | A delta $ | N1 delta $ | N2 delta $ | N3 delta $ |
|---|---|---|---|---|---|---|
| 2025-07 | 2,668 | 5,431 | 1,642 | 6,303 | 2,709 | 3,613 |
| 2025-08 | 561 | -658 | -2,052 | -62 | -411 | 115 |
| 2025-09 | 5,608 | -4,864 | -4,222 | -4,222 | -4,864 | -4,222 |
| 2025-10 | 7,325 | 3,337 | -2,441 | -2,284 | 1,441 | -317 |
| 2025-11 | -1,443 | 3,642 | 2,944 | 5,275 | 2,154 | 4,003 |
| 2025-12 | -509 | 803 | 3,814 | 1,247 | 1,015 | 1,649 |
| 2026-01 | -246 | 1,899 | 4,723 | 2,760 | 3,954 | 3,593 |
| 2026-02 | 4,940 | 4,218 | -4,898 | -4,465 | -457 | -7,769 |
| 2026-03 | 11,159 | 2,028 | 917 | 5,945 | -119 | 1,803 |
| 2026-04 | 2,065 | -1,849 | -1,702 | -622 | 780 | 1,855 |
| 2026-05 | 15,753 | -4,020 | -456 | -2,164 | -872 | 463 |
| 2026-06 | 1,584 | 6,243 | 9,246 | 6,697 | 8,390 | 7,410 |
| 2026-07 | -3,950 | 5,016 | 2,638 | 886 | 4,305 | 2,638 |
| 2026-08 | 1,317 | -277 | -32 | 237 | -532 | -32 |

### published_window / close_confirmed

| Month | B17 net $ | G delta $ | A delta $ | N1 delta $ | N2 delta $ | N3 delta $ |
|---|---|---|---|---|---|---|
| 2025-07 | -3,050 | 12,039 | 5,334 | 12,211 | 9,306 | 9,454 |
| 2025-08 | 1,420 | -289 | -276 | 1,198 | -822 | 1,999 |
| 2025-09 | 6,247 | -6,301 | -4,029 | -6,717 | -6,301 | -6,717 |
| 2025-10 | 7,167 | 2,239 | 1,242 | 279 | 2,463 | 392 |
| 2025-11 | -688 | 3,334 | 2,339 | 4,034 | 1,510 | 3,204 |
| 2025-12 | 673 | 99 | 3,844 | 1,725 | 1,125 | 2,448 |
| 2026-01 | -8,750 | 2,715 | 13,238 | 12,718 | 3,538 | 13,135 |
| 2026-02 | -6,255 | 55 | -494 | -5,238 | 2,320 | -3,521 |
| 2026-03 | 12,689 | 1,454 | 364 | 3,843 | -1,592 | 909 |
| 2026-04 | 2,401 | -5,541 | -2,077 | -3,962 | -1,471 | 538 |
| 2026-05 | 15,721 | -2,848 | -826 | -3,795 | -3,183 | -1,035 |
| 2026-06 | -2,243 | 6,313 | 10,066 | 10,304 | 8,326 | 12,975 |
| 2026-07 | -7,858 | 7,726 | 8,596 | 8,128 | 9,602 | 11,233 |
| 2026-08 | 2,017 | -102 | 471 | 545 | -27 | 471 |

## Monthly losing dollars: baseline and candidates

Negative numbers are the sum of losing completed ladders assigned to close month, not monthly net or drawdown.

### hl_extended / resting_touch

| Month | B17 losses $ | G losses $ | A losses $ | N1 losses $ | N2 losses $ | N3 losses $ |
|---|---|---|---|---|---|---|
| 2026-05 | 0 | 0 | -47 | 0 | 0 | -47 |
| 2026-06 | -24,396 | -18,311 | -18,349 | -18,311 | -18,580 | -18,580 |
| 2026-07 | -8,542 | -4,586 | -6,156 | -7,517 | -4,057 | -6,156 |
| 2026-08 | -71 | -1,124 | -1,154 | -1,125 | -1,152 | -1,154 |
| 2026-09 | 0 | -1,525 | -2,012 | -1,754 | -1,525 | -2,012 |

### hl_extended / close_confirmed

| Month | B17 losses $ | G losses $ | A losses $ | N1 losses $ | N2 losses $ | N3 losses $ |
|---|---|---|---|---|---|---|
| 2026-05 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-06 | -26,870 | -23,309 | -23,739 | -23,006 | -23,446 | -23,446 |
| 2026-07 | -13,167 | -6,310 | -4,834 | -4,535 | -6,775 | -4,013 |
| 2026-08 | -155 | -1,052 | -1,081 | -1,052 | -1,081 | -1,081 |
| 2026-09 | 0 | -2,070 | -2,070 | -2,001 | -2,070 | -2,070 |

### published_window / resting_touch

| Month | B17 losses $ | G losses $ | A losses $ | N1 losses $ | N2 losses $ | N3 losses $ |
|---|---|---|---|---|---|---|
| 2025-07 | -13,473 | -9,800 | -11,474 | -9,670 | -11,264 | -11,134 |
| 2025-08 | -15,251 | -14,675 | -14,831 | -14,831 | -14,675 | -14,831 |
| 2025-09 | -7,001 | -9,147 | -9,147 | -9,147 | -9,147 | -9,147 |
| 2025-10 | -11,114 | -8,984 | -11,362 | -11,375 | -11,168 | -9,784 |
| 2025-11 | -5,521 | -5,162 | -3,845 | -3,771 | -5,236 | -3,845 |
| 2025-12 | -5,660 | -5,590 | -3,174 | -4,157 | -5,598 | -3,927 |
| 2026-01 | -12,219 | -9,107 | -9,897 | -9,897 | -9,107 | -9,897 |
| 2026-02 | -13,900 | -13,903 | -24,486 | -23,375 | -16,922 | -27,004 |
| 2026-03 | -1,725 | -9,614 | -10,520 | -9,523 | -9,839 | -9,814 |
| 2026-04 | -17,385 | -12,254 | -16,590 | -12,413 | -14,937 | -15,381 |
| 2026-05 | -4,718 | -9,252 | -9,917 | -9,389 | -8,325 | -9,306 |
| 2026-06 | -24,396 | -18,311 | -18,349 | -18,311 | -18,580 | -18,580 |
| 2026-07 | -8,542 | -4,586 | -6,156 | -7,517 | -4,057 | -6,156 |
| 2026-08 | 0 | -45 | -89 | -45 | -89 | -89 |

### published_window / close_confirmed

| Month | B17 losses $ | G losses $ | A losses $ | N1 losses $ | N2 losses $ | N3 losses $ |
|---|---|---|---|---|---|---|
| 2025-07 | -19,614 | -9,724 | -12,516 | -9,536 | -11,189 | -11,000 |
| 2025-08 | -12,589 | -14,784 | -14,804 | -14,804 | -14,784 | -14,804 |
| 2025-09 | -6,719 | -8,969 | -9,167 | -8,969 | -8,969 | -8,969 |
| 2025-10 | -11,049 | -8,248 | -9,463 | -9,476 | -8,248 | -9,476 |
| 2025-11 | -5,428 | -5,568 | -3,920 | -3,845 | -5,642 | -3,920 |
| 2025-12 | -5,331 | -5,590 | -3,407 | -4,157 | -5,598 | -4,165 |
| 2026-01 | -21,883 | -17,774 | -10,037 | -10,037 | -17,774 | -10,037 |
| 2026-02 | -22,238 | -25,186 | -29,417 | -30,599 | -23,970 | -31,547 |
| 2026-03 | -1,340 | -5,487 | -9,451 | -7,259 | -7,671 | -9,451 |
| 2026-04 | -17,882 | -15,898 | -16,418 | -14,839 | -15,563 | -14,766 |
| 2026-05 | -7,219 | -8,635 | -9,635 | -9,502 | -8,494 | -9,370 |
| 2026-06 | -26,870 | -23,309 | -23,739 | -23,006 | -23,446 | -23,446 |
| 2026-07 | -13,167 | -6,310 | -4,834 | -4,535 | -6,775 | -4,013 |
| 2026-08 | 0 | -45 | -89 | -45 | -89 | -89 |

## Screening and non-additive interactions

| New setup | Recent minimum-model uplift $ | Aggregate net/DD better all four | Complete screen | Failures |
|---|---|---|---|---|
| 10h aggressive | 19,896 | true | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly |
| 10h no funding guard | 19,336 | true | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly, hl_extended-close_confirmed:monthly |
| 10h no RSI cooldown | 16,693 | true | false | published_window-close_confirmed:monthly, published_window-resting_touch:monthly |

Age benefit below is 10h minus the corresponding 8h cell; interaction = both - deep-only - RSI-only + safeguarded. These are historical accounting contrasts, not significance tests.

| Case | Age gain guarded $ | Age gain no funding $ | Age gain no RSI $ | Age gain aggressive $ | 8h guard interaction $ | 10h guard interaction $ |
|---|---|---|---|---|---|---|
| published_window-close_confirmed | 5,187 | 5,456 | 6,113 | 7,693 | 4,995 | 6,308 |
| published_window-resting_touch | 6,450 | 7,039 | 4,759 | 4,680 | 3,392 | 2,724 |
| hl_extended-close_confirmed | 9,699 | 5,673 | 9,586 | 6,306 | 2,772 | 3,517 |
| hl_extended-resting_touch | -685 | -1,120 | -566 | -1,351 | -129 | -478 |

## Entry-path attribution versus same-age safeguarded control

Same-entry ladders can have different later rungs. Removed and replacement sets are completed-episode classifications. Do not sum an extra rung's associated whole-episode PnL as its marginal benefit.

| Case / setup | Matched delta $ | Removed peer net $ | Replacement net $ | End delta $ | Total delta $ | Matched / removed / replacement |
|---|---|---|---|---|---|---|
| published_window-close_confirmed / 8h aggressive | -3,174 | 34,417 | 59,667 | 11 | 22,088 | 263/462/474 |
| published_window-resting_touch / 8h aggressive | 1,145 | 52,699 | 47,177 | 0 | -4,377 | 309/532/552 |
| hl_extended-close_confirmed / 8h aggressive | 2,973 | 27,014 | 39,635 | -118 | 15,477 | 73/135/152 |
| hl_extended-resting_touch / 8h aggressive | 6,089 | 35,310 | 34,247 | -118 | 4,907 | 81/167/187 |
| published_window-close_confirmed / 10h no RSI cooldown | 0 | 31,958 | 46,327 | 11 | 14,381 | 311/401/431 |
| published_window-resting_touch / 10h no RSI cooldown | 0 | 57,125 | 51,708 | -0 | -5,417 | 360/465/515 |
| hl_extended-close_confirmed / 10h no RSI cooldown | 0 | 31,766 | 38,203 | 0 | 6,437 | 78/132/147 |
| hl_extended-resting_touch / 10h no RSI cooldown | 0 | 34,537 | 35,576 | 0 | 1,038 | 92/150/165 |
| published_window-close_confirmed / 10h no funding guard | 4,092 | 19,292 | 19,106 | 0 | 3,906 | 574/138/109 |
| published_window-resting_touch / 10h no funding guard | 4,098 | 16,869 | 9,319 | -0 | -3,453 | 668/157/113 |
| hl_extended-close_confirmed / 10h no funding guard | 10,938 | 16,126 | 7,435 | -118 | 2,129 | 150/60/51 |
| hl_extended-resting_touch / 10h no funding guard | 5,928 | 16,232 | 14,103 | -118 | 3,681 | 177/65/59 |
| published_window-close_confirmed / 10h aggressive | -1,936 | 35,884 | 62,403 | 11 | 24,594 | 272/440/465 |
| published_window-resting_touch / 10h aggressive | 1,298 | 56,316 | 48,871 | -0 | -6,147 | 306/519/534 |
| hl_extended-close_confirmed / 10h aggressive | 3,556 | 35,668 | 44,313 | -118 | 12,084 | 66/144/162 |
| hl_extended-resting_touch / 10h aggressive | 6,098 | 37,531 | 35,792 | -118 | 4,241 | 78/164/180 |

Direct flag means original guard would block this accepted add ON THE OBSERVED PATH, after the support exception. Cohort whole-ladder PnL is association, not causal earnings from the flagged adds. Counts can overlap.

| Case / setup | Extra opens in flagged cohort | Deep flagged adds | Hot cooldown flagged adds | Flagged cohort W/L | Cohort winning $ | Cohort losing $ |
|---|---|---|---|---|---|---|
| published_window-close_confirmed / 8h aggressive | 3733 | 391 | 855 | 396/39 | 131,676 | -94,279 |
| published_window-resting_touch / 8h aggressive | 3764 | 392 | 971 | 467/36 | 124,932 | -80,233 |
| hl_extended-close_confirmed / 8h aggressive | 1400 | 168 | 280 | 150/7 | 53,126 | -9,757 |
| hl_extended-resting_touch / 8h aggressive | 1360 | 151 | 336 | 175/9 | 50,834 | -13,115 |
| published_window-close_confirmed / 10h no RSI cooldown | 2798 | 0 | 871 | 335/21 | 94,773 | -63,588 |
| published_window-resting_touch / 10h no RSI cooldown | 2898 | 0 | 1003 | 401/19 | 92,965 | -53,308 |
| hl_extended-close_confirmed / 10h no RSI cooldown | 957 | 0 | 281 | 118/1 | 35,720 | -4,184 |
| hl_extended-resting_touch / 10h no RSI cooldown | 969 | 0 | 311 | 136/3 | 33,228 | -5,289 |
| published_window-close_confirmed / 10h no funding guard | 1279 | 381 | 0 | 136/17 | 63,754 | -38,997 |
| published_window-resting_touch / 10h no funding guard | 1196 | 375 | 0 | 145/15 | 63,719 | -39,888 |
| hl_extended-close_confirmed / 10h no funding guard | 556 | 146 | 0 | 60/5 | 30,771 | -8,508 |
| hl_extended-resting_touch / 10h no funding guard | 557 | 143 | 0 | 64/5 | 30,132 | -8,010 |
| published_window-close_confirmed / 10h aggressive | 3791 | 400 | 872 | 402/35 | 136,345 | -92,534 |
| published_window-resting_touch / 10h aggressive | 3689 | 372 | 977 | 463/35 | 129,579 | -87,760 |
| hl_extended-close_confirmed / 10h aggressive | 1506 | 176 | 282 | 153/6 | 56,995 | -9,353 |
| hl_extended-resting_touch / 10h aggressive | 1309 | 142 | 329 | 170/9 | 50,329 | -13,346 |

## High-source60 sensitivity

Only high-reference availability is delayed; this is not market execution latency.

| Setup | Model | Net change $ | DD change pp |
|---|---|---|---|
| 10h safeguarded | close_confirmed | 0 | 0.0000 |
| 10h safeguarded | resting_touch | 0 | 0.0000 |
| 8h aggressive | close_confirmed | 0 | 0.0000 |
| 8h aggressive | resting_touch | 0 | 0.0000 |
| 10h no RSI cooldown | close_confirmed | 0 | 0.0000 |
| 10h no RSI cooldown | resting_touch | 0 | 0.0000 |
| 10h no funding guard | close_confirmed | 0 | 0.0000 |
| 10h no funding guard | resting_touch | 0 | 0.0000 |
| 10h aggressive | close_confirmed | 0 | 0.0000 |
| 10h aggressive | resting_touch | 0 | 0.0000 |

## Verification and reproducibility

Accepted immutable job:

`0b999800c49f7cf869e370252e1f95caaa879e396febb8eb06a65506c11781a9`

Definition ID:

`d7f95d03480b8749f9d2cab5f9235f54031b492935907a0099021124a7ac65a8`

Independent receipt: **46 cases,24 exact controls,208,935 fills,15,405,122
minute marks,7,468,663 target checks,7,476,191 high permissions,182,006 size
checks and48 attribution comparisons**. All passed. All ten high-source60
economic results are unchanged. Generic workflow verification also confirms
artifact integrity; its `economicQualification:not_evaluated` is intentional
and not a substitute for the independent economics receipt.

A concrete causal high-exit trace: May19 16:30 UTC, oldest surviving rung age
5.3h, observed completed-minute close48.236 versus trailing high48.691
(distance0.93446%). The high was already known from the minute ending11:11;
reference coverage is May17 16:30 through May19 16:30. Decision index763414
executes at index763415 OPEN48.236, not at the historical high. The timestamps
coincide because the next minute opens when the preceding minute closes;
the indices prove that the fill uses the next candle. Unknown high coverage
cannot force a close.

Entry observer data is separate from execution. It advances the same S/R
implementation every replay minute and uses the same pulse availability and
Bybit fallback. Original-guard-enabled controls admit no observer-flagged
forbidden entries. Each entry records source timing, known RSI, funding,
flow sample counts, support exception and hypothetical guard permissions.
For resting TP cooldowns the RSI is from before the fill bar, never its
eventual close or an old target-arm RSI.

Passed focused age10 tests (including prefix invariance and observer timing),
strict research typecheck, project/VPS typechecks, current-stack replay,
near-high, target-audit ordering and research-workflow tests, plus diff checks.
No protected live file, canonical replay engine, previous source or output was
changed. Large outputs remain local and ignored; sources/cards/findings are
available for version control. No commit/push or deployment is part of this pass.

Artifacts under `backtests/research-workflow/<key>/output/`:

- `results.json`, `overview.csv`, `monthly.csv`: complete nine-policy comparison.
- `ranking.json`, `comparisons.json`, `control-parity.json`: screen and controls.
- `entry-attribution.json`: full matched/removed/replacement details, source
  context for extra opens, monthly flagged cohorts and factorial contrasts.
- Per-case inventory JSONL, target arms, add sizes, entry contexts, TP
  observations and high-decision traces. Counts and outcomes can be rebuilt.
- Independent `verification.json` lives beside `plan.json`/`state.json`.

## Next checkpoint: isolated high-exit cooldown, not blanket gate removal

The three new combinations and their entry attribution are complete.
Selective guard relaxation is still a hypothesis: no new indicator threshold
or month-dependent selector has been tested here.

The next separate experiment should compare the original4-8h boundary cooldown
against **fixed1h and2h cooldowns after the research high exit only**, separately
on safeguarded10h and aggressive10h (four new definitions if approved/frozen).
Keep the emergency, hard-flatten, funding-spike and hot-RSI cooldown semantics
of each parent unchanged. Do not change a global cooldown setting and call it
a high-exit-only test.

This needs a narrow research-only cooldown override or isolated research engine
fork because the current hook does not expose exit-specific cooldown. Require
exact parent/control parity with the override inactive before testing shorter
values; persist close reason, assigned cooldown and each first permissible
post-exit entry. Preserve next-open execution, blocked outer gates and unknown
context behavior. Full occupancy, W/L dollars, monthly costs and both TP models
are mandatory. Freeze the card before outcomes, not add values adaptively.

Why this comes next: the current high rule inherits an emergency-style waiting
period even for profitable exits. Its contribution has not been isolated.
The evidence above does NOT imply shorter cooldown is better: earlier hot-TP
reopens can be harmful, and a high exit is a different event. Test them
separately. No new live deployment is recommended from this result alone.

