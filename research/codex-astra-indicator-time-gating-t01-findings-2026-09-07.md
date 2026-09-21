# T01: standalone MFI/CMF entry-time gating

September 7, 2026. Local research only; independently verified.
[Exact frozen card](../research-inputs/indicators/time-gating-t01-2026-09-07.json).
[Reproduction and timing contract](../docs/research/indicator-entry-context-studies.md).

## TL;DR

- **0/12 complete profit qualifiers; 0/12 defensive qualifiers; 0 strict-clock qualifiers.** Two preselected unfiltered parents x six fixed single-block exclusions. All112 logical cases and696 calendar-attribution rows independently verified.
- **T01-05, MFI15m long excluding16:00-20:00 UTC entries**, is the useful new lead: immediate full parent $13,112 -> $16,153 and recent $3,957 -> $4,968; +1m full $10,761 -> $14,936 and recent $3,311 -> $4,494. Net, losing dollars, stress and DD improve in all four cases. It fails the unchanged monthly budget, worst **-$525.07**, and the defensive full-DD reduction threshold in the immediate case.
- This is **not proof of a universally bad trading session**. The excluded original entries were profitable; the benefit comes from different later positions becoming available. No CMF exclusion improves both windows/delays. Save T01-05 for further research, not live deployment. No ladder, short-owner or live setting changed.

## Windows, accounting and what was actually tested

Full: **2025-07-01 00:00 to 2026-09-04 19:01 UTC**.
Recent: **2026-05-17 20:43 to the same cutoff**, starts flat and overlaps full.
Already-mined historical data, not a new holdout. Original repaired input
snapshot/seed/costs are identical to C01/C02;663,541 continuous minute bars.

Independent **$10,000 entry notional / $32,000 reference equity**, one long
position, fixed12h exit measured from actual fill. No TP/SL, ladder averaging,
compounding or combined portfolio. Both entry and exit receive0m or+1m delay.
Modeled fees0.055% each side; extra5bps each side on the same path is the stress
panel. **Before funding; these are not incremental live-ladder dollars.**
No time restrictions on exits. Cutoff open marks are separate from completed wins/losses.

| Parent | Full / recent net, 0m | Full / recent closes | Full / recent adverse DD |
|---|---|---|---|
| T1: MFI7 15m into <10 long | $13,112 / $3,957 | 441 / 106 | 10.19% / 7.18% |
| T2: CMF10 30m trend cross above0 long | $10,186 / $8,238 | 613 / 157 | 15.66% / 7.41% |

The two unfiltered entries were selected before the calendar audit, not chosen
from an hourly profitability leaderboard. Each original fresh signal is
discarded if it occurs in one excluded UTC block. It is never deferred until
that block reopens. A+1m fill may cross a boundary: eligibility stays fixed at
the original signal. All source bars are completed by the decision timestamp.

| Excluded UTC interval | MFI ID | CMF ID |
|---|---|---|
| 00:00 <= t <04:00 | T01-01 | T01-07 |
| 04:00 <= t <08:00 | T01-02 | T01-08 |
| 08:00 <= t <12:00 | T01-03 | T01-09 |
| 12:00 <= t <16:00 | T01-04 | T01-10 |
| 16:00 <= t <20:00 | T01-05 | T01-11 |
| 20:00 <= t <24:00 | T01-06 | T01-12 |

No multi-block exclusions, weekday gating, variable exit, calendar optimization
on a C02 pair, country-session/DST labels, HL or S/R conditions. Weekday/weekend
is descriptive only. In the artifact condition IDs, UTC0..5 correspond to these
six intervals. Repeated parents/clock/readiness cases are not new strategies.

## Descriptive calendar audit, saved before exclusion replays

Every expected decision slot and every fresh unfiltered opportunity is counted,
including signals rejected because the rule was occupied. This prevents a
TP-only or winner-only denominator. The six time blocks partition the sample;
weekday/weekend partitions it separately and must not be added to those totals.

Signal-origin outcomes group trades by when their original signal occurred.
Exit-clock outcomes group the same completed PnL by exit time. Neither grouping
authorizes using future results to select the original entry. With a12h fixed
hold, the two clock tables are mechanically shifted; this is not an independent
confirmation of a time-of-day edge.

Actual exposure hours measure inventory held during the clock group, not
merely the number of signals in that group. The full artifact also contains
signal-origin exposure, pending counts, acceptance/occupied rates and monthly
panels for both execution delays. Immediate baselines below have no cutoff open
inventory or pending entries.

### full unfiltered parents, immediate execution

| Parent / UTC group | Market hours | Decision slots | Fresh signals | Filled / occupied | W / L | Winning $ | Losing $ | Signal-origin net | Exit-clock net | Actual exposure hours |
|---|---|---|---|---|---|---|---|---|---|---|
| CMF / 00-04 | 1724.0 | 3448 | 295 | 115 / 180 | 60 / 55 | $13,538 | -$12,351 | $1,187 | $1,048 | 1283.5 |
| CMF / 04-08 | 1724.0 | 3448 | 271 | 101 / 170 | 52 / 49 | $12,447 | -$9,377 | $3,069 | $5,163 | 1286.0 |
| CMF / 08-12 | 1724.0 | 3448 | 237 | 81 / 156 | 39 / 42 | $10,193 | -$12,580 | -$2,386 | $2,105 | 1217.0 |
| CMF / 12-16 | 1724.0 | 3448 | 289 | 118 / 171 | 54 / 64 | $16,756 | -$15,708 | $1,048 | $1,187 | 1168.5 |
| CMF / 16-20 | 1723.0 | 3447 | 233 | 87 / 146 | 46 / 41 | $14,364 | -$9,201 | $5,163 | $3,069 | 1166.0 |
| CMF / 20-24 | 1720.0 | 3440 | 297 | 111 / 186 | 52 / 59 | $13,469 | -$11,364 | $2,105 | -$2,386 | 1235.0 |
| CMF / weekday | 7411.0 | 14823 | 1166 | 446 / 720 | 218 / 228 | $61,751 | -$54,941 | $6,811 | $4,110 | 5335.5 |
| CMF / weekend | 2928.0 | 5856 | 456 | 167 / 289 | 85 / 82 | $19,016 | -$15,641 | $3,375 | $6,076 | 2020.5 |
| MFI / 00-04 | 1724.0 | 6896 | 136 | 81 / 55 | 49 / 32 | $13,204 | -$6,746 | $6,457 | -$2,554 | 813.7 |
| MFI / 04-08 | 1724.0 | 6896 | 155 | 92 / 63 | 36 / 56 | $8,660 | -$10,999 | -$2,339 | $1,282 | 879.2 |
| MFI / 08-12 | 1724.0 | 6896 | 131 | 61 / 70 | 36 / 25 | $10,516 | -$4,272 | $6,244 | $4,022 | 910.2 |
| MFI / 12-16 | 1724.0 | 6896 | 153 | 86 / 67 | 37 / 49 | $10,674 | -$13,228 | -$2,554 | $6,457 | 950.2 |
| MFI / 16-20 | 1723.0 | 6893 | 117 | 62 / 55 | 34 / 28 | $6,901 | -$5,619 | $1,282 | -$2,339 | 884.7 |
| MFI / 20-24 | 1720.0 | 6880 | 121 | 59 / 62 | 36 / 23 | $9,861 | -$5,838 | $4,022 | $6,244 | 853.7 |
| MFI / weekday | 7411.0 | 29645 | 569 | 313 / 256 | 161 / 152 | $45,084 | -$34,125 | $10,958 | $6,692 | 3778.3 |
| MFI / weekend | 2928.0 | 11712 | 244 | 128 / 116 | 67 / 61 | $14,731 | -$12,578 | $2,153 | $6,420 | 1513.7 |

### recent unfiltered parents, immediate execution

| Parent / UTC group | Market hours | Decision slots | Fresh signals | Filled / occupied | W / L | Winning $ | Losing $ | Signal-origin net | Exit-clock net | Actual exposure hours |
|---|---|---|---|---|---|---|---|---|---|---|
| CMF / 00-04 | 440.0 | 880 | 74 | 28 / 46 | 18 / 10 | $3,781 | -$2,196 | $1,585 | -$399 | 308.0 |
| CMF / 04-08 | 440.0 | 880 | 81 | 31 / 50 | 17 / 14 | $4,779 | -$2,377 | $2,402 | $1,828 | 341.0 |
| CMF / 08-12 | 440.0 | 880 | 55 | 23 / 32 | 11 / 12 | $3,727 | -$2,379 | $1,348 | $1,475 | 327.5 |
| CMF / 12-16 | 440.0 | 880 | 78 | 25 / 53 | 10 / 15 | $3,218 | -$3,617 | -$399 | $1,585 | 320.0 |
| CMF / 16-20 | 439.0 | 879 | 54 | 19 / 35 | 10 / 9 | $3,730 | -$1,902 | $1,828 | $2,402 | 287.0 |
| CMF / 20-24 | 439.3 | 878 | 79 | 31 / 48 | 19 / 12 | $3,809 | -$2,334 | $1,475 | $1,348 | 300.5 |
| CMF / weekday | 1915.0 | 3831 | 297 | 114 / 183 | 59 / 55 | $17,349 | -$11,986 | $5,363 | $6,635 | 1386.0 |
| CMF / weekend | 723.3 | 1446 | 124 | 43 / 81 | 26 / 17 | $5,695 | -$2,820 | $2,875 | $1,603 | 498.0 |
| MFI / 00-04 | 440.0 | 1760 | 30 | 20 / 10 | 10 / 10 | $2,141 | -$2,036 | $105 | -$827 | 221.8 |
| MFI / 04-08 | 440.0 | 1760 | 37 | 18 / 19 | 5 / 13 | $1,384 | -$2,002 | -$618 | $1,452 | 233.0 |
| MFI / 08-12 | 440.0 | 1760 | 28 | 15 / 13 | 10 / 5 | $2,842 | -$500 | $2,341 | $1,504 | 208.5 |
| MFI / 12-16 | 440.0 | 1760 | 28 | 19 / 9 | 9 / 10 | $2,389 | -$3,216 | -$827 | $105 | 202.3 |
| MFI / 16-20 | 439.0 | 1757 | 31 | 17 / 14 | 11 / 6 | $2,369 | -$917 | $1,452 | -$618 | 191.0 |
| MFI / 20-24 | 439.3 | 1757 | 31 | 17 / 14 | 11 / 6 | $2,432 | -$928 | $1,504 | $2,341 | 215.5 |
| MFI / weekday | 1915.0 | 7661 | 135 | 80 / 55 | 40 / 40 | $10,863 | -$8,640 | $2,222 | $2,563 | 938.2 |
| MFI / weekend | 723.3 | 2893 | 50 | 26 / 24 | 16 / 10 | $2,694 | -$959 | $1,735 | $1,394 | 333.8 |


## Best lead: baseline-first practical interpretation

T01-05 full immediate: **228W/213L ->213W/191L**.
Winning dollars $59,815 -> $58,096; losing dollars -$46,703 -> -$41,943.
The $4,760 reduction in losing dollars more than offsets $1,719 fewer winning
dollars. Net gain+$3,041. DD10.19% ->8.98%;441 ->404 completed trades.

Recent immediate: **56W/50L ->53W/46L**, wins $13,556 -> $13,675 and losses
-$9,599 ->-$8,708. Net gain+$1,010; DD7.18% ->5.86%;106 ->99 closes.
The +1m panel also improves, rather than reversing the direction.

**Why this is not simply a bad-hour blacklist:**

- Full baseline16:00-20:00 signal cohort:62 closes, net **+$1,282**.
  Recent same cohort:17 closes, **+$1,452**.
- The complete full variant removes68 original completed trades, including
  six displaced later entries: it sacrifices$7,733 winning dollars and avoids
  $6,099 losing dollars, removing a net **+$1,635**.
- It enables31 different later trades, net **+$4,676**, for total incremental
  **+$3,041**. Recent:19 removed trades net+$1,816, twelve new trades net+$2,826,
  giving+$1,010. Removing just the original clock cohort from a trade CSV would
  give the wrong conclusion.
- The same exclusion on CMF (T01-11) **loses**$2,867 full /$2,172 recent immediate.
  Calendar behavior is strategy/path-specific, not a blanket instruction to
  pause HYPE or the current ladder during these hours.

There is plausible occupancy selection here, but the calendar cause is not
established. Later profitable trades on mined history can be contingent on
specific regime sequences. No economic-news or exchange-flow causal claim is made.

## Why it does not pass the frozen screen

The profit screen's only failure for T01-05 is **monthly regression beyond-$320**:

| Month | 0m parent -> variant marked PnL | Delta | +1m parent -> variant | Delta |
|---|---|---:|---|---:|
| February2026, full only | -$747 -> -$1,072 | -$324.14 | -$392 -> -$721 | -$328.93 |
| June2026, full and recent | $1,842 -> $1,316 | -$525.07 | $1,443 -> $1,010 | -$432.94 |
| August2026, full and recent | $2,590 -> $2,201 | -$389.28 | $2,491 -> $2,151 | -$340.18 |

June and August remain profitable; these are foregone profits, not additional
net losing months. The rule does **not** improve every month. We preserve the
predeclared budget instead of changing it after seeing the result.

Defense additionally fails the immediate full-DD reduction requirement:
10.19% ->8.98% is about11.9%, below20%, although it exceeds1pp.
It does beat the ex-post exposure-scaled parent's DD and losing dollars in all
four cases. That distinguishes the result from a filter whose apparent risk
improvement is explained solely by less notional exposure.

Common requirements: n>=30full/10recent each delay, positive/stress net,
solvent, every monthly delta>=-$320 versus original and readiness parent.
Profit requires+$500full/+$200recent each delay and DD no worse.
Defense requires90% profit retention, fewer losing dollars, full DD-20% and
-1pp, no recent worsening, plus the scaled-parent test.
The separate inherited strict-clock screen also fails; it was not substituted
for the own-parent comparison. This is a research lead, not a deployment result.

## All twelve exclusions, ranked by smaller full-window increment across delays

### Full-window ranking panels

Order is the smaller full-window increment across the two delays, not this panel's return.

| ID / condition | 0m parent -> variant net | Delta 0m | +1m parent -> variant net | Delta +1m | Variant closes 0m / +1m |
|---|---|---|---|---|---|
| T01-05 T1+UTC4 | $13,112 -> $16,153 | $3,041 | $10,761 -> $14,936 | $4,175 | 404 / 401 |
| T01-02 T1+UTC1 | $13,112 -> $14,300 | $1,188 | $10,761 -> $12,848 | $2,087 | 393 / 389 |
| T01-09 T2+UTC2 | $10,186 -> $10,696 | $510 | $7,122 -> $9,024 | $1,902 | 573 / 555 |
| T01-10 T2+UTC3 | $10,186 -> $10,333 | $146 | $7,122 -> $7,184 | $62 | 549 / 531 |
| T01-04 T1+UTC3 | $13,112 -> $12,266 | -$845 | $10,761 -> $10,875 | $114 | 391 / 386 |
| T01-08 T2+UTC1 | $10,186 -> $8,130 | -$2,057 | $7,122 -> $9,177 | $2,055 | 566 / 546 |
| T01-06 T1+UTC5 | $13,112 -> $10,390 | -$2,721 | $10,761 -> $9,407 | -$1,354 | 409 / 408 |
| T01-11 T2+UTC4 | $10,186 -> $7,319 | -$2,867 | $7,122 -> $5,851 | -$1,271 | 575 / 554 |
| T01-01 T1+UTC0 | $13,112 -> $10,116 | -$2,996 | $10,761 -> $7,295 | -$3,466 | 388 / 386 |
| T01-07 T2+UTC0 | $10,186 -> $6,509 | -$3,677 | $7,122 -> $4,244 | -$2,878 | 551 / 538 |
| T01-03 T1+UTC2 | $13,112 -> $6,109 | -$7,003 | $10,761 -> $5,160 | -$5,601 | 400 / 397 |
| T01-12 T2+UTC5 | $10,186 -> $610 | -$9,576 | $7,122 -> -$1,347 | -$8,469 | 559 / 536 |

### Recent-window ranking panels

Order is the smaller full-window increment across the two delays, not this panel's return.

| ID / condition | 0m parent -> variant net | Delta 0m | +1m parent -> variant net | Delta +1m | Variant closes 0m / +1m |
|---|---|---|---|---|---|
| T01-05 T1+UTC4 | $3,957 -> $4,968 | $1,010 | $3,311 -> $4,494 | $1,183 | 99 / 98 |
| T01-02 T1+UTC1 | $3,957 -> $3,483 | -$474 | $3,311 -> $2,687 | -$624 | 94 / 93 |
| T01-09 T2+UTC2 | $8,238 -> $5,408 | -$2,830 | $7,718 -> $4,776 | -$2,942 | 148 / 144 |
| T01-10 T2+UTC3 | $8,238 -> $7,127 | -$1,111 | $7,718 -> $7,030 | -$687 | 141 / 137 |
| T01-04 T1+UTC3 | $3,957 -> $4,171 | $214 | $3,311 -> $4,176 | $865 | 95 / 94 |
| T01-08 T2+UTC1 | $8,238 -> $4,714 | -$3,524 | $7,718 -> $4,909 | -$2,809 | 142 / 139 |
| T01-06 T1+UTC5 | $3,957 -> $4,002 | $45 | $3,311 -> $3,387 | $76 | 95 / 94 |
| T01-11 T2+UTC4 | $8,238 -> $6,066 | -$2,172 | $7,718 -> $5,981 | -$1,736 | 150 / 147 |
| T01-01 T1+UTC0 | $3,957 -> $3,103 | -$854 | $3,311 -> $2,756 | -$555 | 91 / 91 |
| T01-07 T2+UTC0 | $8,238 -> $5,406 | -$2,832 | $7,718 -> $5,457 | -$2,261 | 143 / 141 |
| T01-03 T1+UTC2 | $3,957 -> $2,355 | -$1,602 | $3,311 -> $1,596 | -$1,715 | 97 / 95 |
| T01-12 T2+UTC5 | $8,238 -> $4,345 | -$3,893 | $7,718 -> $4,774 | -$2,944 | 144 / 140 |


## Top-five detailed wins/losses, including baselines

### T01-05 — MFI7 15m into <10 long / UTC4

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 228 / 213 | $59,815 | -$46,703 | $0 | $13,112 | 10.19% |
| full / 0m / T01-05 | 213 / 191 | $58,096 | -$41,943 | $0 | $16,153 | 8.98% |
| full / 1m / parent | 226 / 212 | $57,742 | -$46,981 | $0 | $10,761 | 12.61% |
| full / 1m / T01-05 | 210 / 191 | $56,735 | -$41,799 | $0 | $14,936 | 9.76% |
| recent / 0m / parent | 56 / 50 | $13,556 | -$9,599 | $0 | $3,957 | 7.18% |
| recent / 0m / T01-05 | 53 / 46 | $13,675 | -$8,708 | $0 | $4,968 | 5.86% |
| recent / 1m / parent | 57 / 48 | $12,752 | -$9,441 | $0 | $3,311 | 7.54% |
| recent / 1m / T01-05 | 54 / 44 | $13,049 | -$8,555 | $0 | $4,494 | 5.96% |

Profit-screen failures: `monthly_parent_regression_over_320`.

Defense-screen failures: `monthly_parent_regression_over_320`, `full_drawdown_reduction_insufficient`.

### T01-02 — MFI7 15m into <10 long / UTC1

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 228 / 213 | $59,815 | -$46,703 | $0 | $13,112 | 10.19% |
| full / 0m / T01-02 | 212 / 181 | $56,324 | -$42,025 | $0 | $14,300 | 18.23% |
| full / 1m / parent | 226 / 212 | $57,742 | -$46,981 | $0 | $10,761 | 12.61% |
| full / 1m / T01-02 | 213 / 176 | $54,636 | -$41,788 | $0 | $12,848 | 18.26% |
| recent / 0m / parent | 56 / 50 | $13,556 | -$9,599 | $0 | $3,957 | 7.18% |
| recent / 0m / T01-02 | 52 / 42 | $12,193 | -$8,710 | $0 | $3,483 | 6.18% |
| recent / 1m / parent | 57 / 48 | $12,752 | -$9,441 | $0 | $3,311 | 7.54% |
| recent / 1m / T01-02 | 52 / 41 | $11,260 | -$8,574 | $0 | $2,687 | 6.80% |

Profit-screen failures: `monthly_parent_regression_over_320`, `drawdown_worse_than_parent`, `increment_below_500_full_or_200_recent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `full_drawdown_reduction_insufficient`, `selection_not_better_than_exposure_scaling`, `profit_retention_below_90pct`.

### T01-09 — CMF10 30m trend cross above0 long / UTC2

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 303 / 310 | $80,767 | -$70,581 | $0 | $10,186 | 15.66% |
| full / 0m / T01-09 | 279 / 294 | $76,540 | -$65,844 | $0 | $10,696 | 13.56% |
| full / 1m / parent | 284 / 309 | $75,332 | -$68,210 | $0 | $7,122 | 23.33% |
| full / 1m / T01-09 | 261 / 294 | $72,900 | -$63,876 | $0 | $9,024 | 13.62% |
| recent / 0m / parent | 85 / 72 | $23,044 | -$14,806 | $0 | $8,238 | 7.41% |
| recent / 0m / T01-09 | 74 / 74 | $20,416 | -$15,009 | $0 | $5,408 | 12.30% |
| recent / 1m / parent | 82 / 71 | $22,573 | -$14,855 | $0 | $7,718 | 7.95% |
| recent / 1m / T01-09 | 70 / 74 | $19,527 | -$14,751 | $0 | $4,776 | 12.69% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`, `drawdown_worse_than_parent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `full_drawdown_reduction_insufficient`, `selection_not_better_than_exposure_scaling`, `profit_retention_below_90pct`, `losing_dollars_not_reduced`, `recent_drawdown_worse`.

### T01-10 — CMF10 30m trend cross above0 long / UTC3

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 303 / 310 | $80,767 | -$70,581 | $0 | $10,186 | 15.66% |
| full / 0m / T01-10 | 288 / 261 | $71,395 | -$61,062 | $0 | $10,333 | 17.48% |
| full / 1m / parent | 284 / 309 | $75,332 | -$68,210 | $0 | $7,122 | 23.33% |
| full / 1m / T01-10 | 277 / 254 | $67,283 | -$60,099 | $0 | $7,184 | 20.69% |
| recent / 0m / parent | 85 / 72 | $23,044 | -$14,806 | $0 | $8,238 | 7.41% |
| recent / 0m / T01-10 | 81 / 60 | $20,501 | -$13,374 | $0 | $7,127 | 7.35% |
| recent / 1m / parent | 82 / 71 | $22,573 | -$14,855 | $0 | $7,718 | 7.95% |
| recent / 1m / T01-10 | 78 / 59 | $20,556 | -$13,526 | $0 | $7,030 | 7.90% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`, `drawdown_worse_than_parent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `full_drawdown_reduction_insufficient`, `selection_not_better_than_exposure_scaling`, `profit_retention_below_90pct`.

### T01-04 — MFI7 15m into <10 long / UTC3

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 228 / 213 | $59,815 | -$46,703 | $0 | $13,112 | 10.19% |
| full / 0m / T01-04 | 204 / 187 | $53,050 | -$40,784 | $0 | $12,266 | 11.53% |
| full / 1m / parent | 226 / 212 | $57,742 | -$46,981 | $0 | $10,761 | 12.61% |
| full / 1m / T01-04 | 201 / 185 | $51,334 | -$40,460 | $0 | $10,875 | 13.56% |
| recent / 0m / parent | 56 / 50 | $13,556 | -$9,599 | $0 | $3,957 | 7.18% |
| recent / 0m / T01-04 | 51 / 44 | $12,039 | -$7,868 | $0 | $4,171 | 5.80% |
| recent / 1m / parent | 57 / 48 | $12,752 | -$9,441 | $0 | $3,311 | 7.54% |
| recent / 1m / T01-04 | 52 / 42 | $11,811 | -$7,635 | $0 | $4,176 | 6.20% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`, `drawdown_worse_than_parent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `full_drawdown_reduction_insufficient`, `selection_not_better_than_exposure_scaling`.


## Paths, missed upside, extra costs and adverse excursions

| ID / window / delay | Removed closes | Missed winning $ | Avoided losing $ | New closes | New net | Extra-cost net parent -> variant | Ex-post scaled-parent DD -> variant DD | Worst held gross move |
|---|---|---|---|---|---|---|---|---|
| T01-05 / full / 0m | 68 | $7,733 | $6,099 | 31 | $4,676 | $8,693 -> $12,103 | 9.48% -> 8.98% | -12.43% |
| T01-05 / full / 1m | 72 | $7,735 | $6,861 | 35 | $5,050 | $6,373 -> $10,917 | 11.71% -> 9.76% | -12.46% |
| T01-05 / recent / 0m | 19 | $2,733 | $917 | 12 | $2,826 | $2,895 -> $3,974 | 6.75% -> 5.86% | -11.22% |
| T01-05 / recent / 1m | 19 | $2,704 | $948 | 12 | $2,939 | $2,259 -> $3,511 | 7.08% -> 5.96% | -11.32% |
| T01-02 / full / 0m | 108 | $12,343 | $12,382 | 60 | $1,149 | $8,693 -> $10,360 | 9.27% -> 18.23% | -51.99% |
| T01-02 / full / 1m | 107 | $12,109 | $12,549 | 58 | $1,647 | $6,373 -> $8,949 | 11.41% -> 18.26% | -51.68% |
| T01-02 / recent / 0m | 22 | $2,294 | $2,122 | 10 | -$302 | $2,895 -> $2,540 | 6.44% -> 6.18% | -11.22% |
| T01-02 / recent / 1m | 22 | $2,328 | $2,180 | 10 | -$476 | $2,259 -> $1,755 | 6.75% -> 6.80% | -11.32% |
| T01-09 / full / 0m | 130 | $14,444 | $19,183 | 90 | -$4,229 | $4,048 -> $4,957 | 14.73% -> 13.56% | -11.84% |
| T01-09 / full / 1m | 134 | $15,724 | $18,414 | 96 | -$788 | $1,185 -> $3,466 | 21.90% -> 13.62% | -11.67% |
| T01-09 / recent / 0m | 35 | $5,417 | $3,309 | 26 | -$722 | $6,663 -> $3,924 | 7.06% -> 12.30% | -9.03% |
| T01-09 / recent / 1m | 36 | $6,605 | $3,720 | 27 | -$56 | $6,183 -> $3,332 | 7.56% -> 12.69% | -9.11% |
| T01-10 / full / 0m | 190 | $22,922 | $24,464 | 126 | -$1,396 | $4,048 -> $4,834 | 14.16% -> 17.48% | -14.00% |
| T01-10 / full / 1m | 184 | $19,597 | $21,425 | 122 | -$1,765 | $1,185 -> $1,868 | 21.00% -> 20.69% | -13.83% |
| T01-10 / recent / 0m | 37 | $4,492 | $4,916 | 21 | -$1,535 | $6,663 -> $5,712 | 6.78% -> 7.35% | -11.61% |
| T01-10 / recent / 1m | 36 | $3,792 | $4,079 | 20 | -$974 | $6,183 -> $5,656 | 7.26% -> 7.90% | -11.77% |
| T01-04 / full / 0m | 104 | $13,441 | $14,544 | 54 | -$1,948 | $8,693 -> $8,348 | 9.23% -> 11.53% | -11.22% |
| T01-04 / full / 1m | 104 | $12,666 | $14,999 | 52 | -$2,219 | $6,373 -> $7,007 | 11.33% -> 13.56% | -11.32% |
| T01-04 / recent / 0m | 22 | $2,389 | $3,323 | 11 | -$721 | $2,895 -> $3,218 | 6.50% -> 5.80% | -11.22% |
| T01-04 / recent / 1m | 21 | $1,750 | $3,283 | 10 | -$668 | $2,259 -> $3,233 | 6.82% -> 6.20% | -11.32% |

The full T01-05 path still holds a worst gross adverse move of about-12.43%.
Calendar gating is not crash protection. Its top-five completed winners
contribute34.3% of full net and69.3% of recent net in the immediate model
(+1m:35.0% and77.5%). These are concentration diagnostics, not mutually
exclusive event samples or guarantees of future returns.

## Top-five monthly stability

Monthly marked rather than exit-only accounting. Recent May and September
are partial. Both delay baselines and all months are kept; no cherry-picked
bad periods. Complete monthly results for all12 exclusions are also saved.

### T01-05 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $988 | $822 | -$166 | $638 | $634 | -$5 |
| 2025-08 | $1,683 | $1,834 | $152 | $1,351 | $1,612 | $261 |
| 2025-09 | $1,580 | $1,883 | $304 | $1,456 | $1,710 | $254 |
| 2025-10 | $2,407 | $3,504 | $1,096 | $2,176 | $3,326 | $1,150 |
| 2025-11 | -$2,229 | -$2,259 | -$30 | -$2,207 | -$2,296 | -$89 |
| 2025-12 | $1,356 | $1,817 | $462 | $467 | $1,453 | $986 |
| 2026-01 | -$276 | -$83 | $193 | -$709 | -$163 | $545 |
| 2026-02 | -$747 | -$1,072 | -$324 | -$392 | -$721 | -$329 |
| 2026-03 | $3,103 | $3,178 | $75 | $3,427 | $3,411 | -$16 |
| 2026-04 | $889 | $1,097 | $208 | $876 | $1,058 | $182 |
| 2026-05 | $1,417 | $2,968 | $1,551 | $1,332 | $2,935 | $1,602 |
| 2026-06 | $1,842 | $1,316 | -$525 | $1,443 | $1,010 | -$433 |
| 2026-07 | -$1,194 | -$723 | $471 | -$1,337 | -$867 | $469 |
| 2026-08 | $2,590 | $2,201 | -$389 | $2,491 | $2,151 | -$340 |
| 2026-09 | -$296 | -$331 | -$35 | -$252 | -$315 | -$63 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $1,016 | $2,505 | $1,489 | $965 | $2,515 | $1,550 |
| 2026-06 | $1,842 | $1,316 | -$525 | $1,443 | $1,010 | -$433 |
| 2026-07 | -$1,194 | -$723 | $471 | -$1,337 | -$867 | $469 |
| 2026-08 | $2,590 | $2,201 | -$389 | $2,491 | $2,151 | -$340 |
| 2026-09 | -$296 | -$331 | -$35 | -$252 | -$315 | -$63 |

### T01-02 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $988 | $1,663 | $674 | $638 | $1,407 | $768 |
| 2025-08 | $1,683 | $1,886 | $204 | $1,351 | $1,964 | $613 |
| 2025-09 | $1,580 | $1,765 | $186 | $1,456 | $1,672 | $217 |
| 2025-10 | $2,407 | -$1,170 | -$3,578 | $2,176 | -$1,146 | -$3,322 |
| 2025-11 | -$2,229 | $125 | $2,354 | -$2,207 | $406 | $2,612 |
| 2025-12 | $1,356 | $1,686 | $331 | $467 | $908 | $441 |
| 2026-01 | -$276 | $804 | $1,080 | -$709 | $379 | $1,087 |
| 2026-02 | -$747 | -$671 | $77 | -$392 | -$391 | $0 |
| 2026-03 | $3,103 | $2,827 | -$277 | $3,427 | $3,106 | -$320 |
| 2026-04 | $889 | $918 | $29 | $876 | $911 | $35 |
| 2026-05 | $1,417 | $1,999 | $582 | $1,332 | $1,911 | $578 |
| 2026-06 | $1,842 | $771 | -$1,071 | $1,443 | $395 | -$1,047 |
| 2026-07 | -$1,194 | -$798 | $397 | -$1,337 | -$1,032 | $305 |
| 2026-08 | $2,590 | $2,642 | $51 | $2,491 | $2,483 | -$8 |
| 2026-09 | -$296 | -$148 | $148 | -$252 | -$126 | $126 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $1,016 | $1,016 | $0 | $965 | $965 | $0 |
| 2026-06 | $1,842 | $771 | -$1,071 | $1,443 | $395 | -$1,047 |
| 2026-07 | -$1,194 | -$798 | $397 | -$1,337 | -$1,032 | $305 |
| 2026-08 | $2,590 | $2,642 | $51 | $2,491 | $2,483 | -$8 |
| 2026-09 | -$296 | -$148 | $148 | -$252 | -$126 | $126 |

### T01-09 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $1,107 | $1,539 | $433 | $422 | $141 | -$281 |
| 2025-08 | $229 | -$85 | -$314 | -$49 | -$468 | -$419 |
| 2025-09 | -$867 | -$81 | $786 | -$1,408 | $194 | $1,602 |
| 2025-10 | $523 | $3,123 | $2,600 | $110 | $2,484 | $2,374 |
| 2025-11 | $244 | $1,142 | $899 | -$303 | $971 | $1,274 |
| 2025-12 | -$2,166 | -$1,514 | $653 | -$3,596 | -$3,122 | $475 |
| 2026-01 | $500 | $291 | -$209 | $815 | $1,788 | $974 |
| 2026-02 | $2,156 | $592 | -$1,563 | $1,950 | $752 | -$1,198 |
| 2026-03 | -$900 | -$756 | $144 | $271 | $819 | $548 |
| 2026-04 | $1,057 | $805 | -$252 | $1,199 | $561 | -$638 |
| 2026-05 | $4,628 | $4,427 | -$201 | $4,617 | $4,469 | -$148 |
| 2026-06 | $1,361 | -$139 | -$1,501 | $1,346 | $153 | -$1,193 |
| 2026-07 | -$1,228 | -$1,996 | -$768 | -$1,357 | -$2,547 | -$1,189 |
| 2026-08 | $3,826 | $3,629 | -$196 | $3,412 | $3,132 | -$280 |
| 2026-09 | -$283 | -$283 | $0 | -$306 | -$306 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $4,561 | $4,196 | -$365 | $4,622 | $4,343 | -$280 |
| 2026-06 | $1,361 | -$139 | -$1,501 | $1,346 | $153 | -$1,193 |
| 2026-07 | -$1,228 | -$1,996 | -$768 | -$1,357 | -$2,547 | -$1,189 |
| 2026-08 | $3,826 | $3,629 | -$196 | $3,412 | $3,132 | -$280 |
| 2026-09 | -$283 | -$283 | $0 | -$306 | -$306 | $0 |

### T01-10 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $1,107 | $632 | -$475 | $422 | $1,015 | $593 |
| 2025-08 | $229 | $500 | $271 | -$49 | $259 | $308 |
| 2025-09 | -$867 | -$1,267 | -$400 | -$1,408 | -$1,488 | -$80 |
| 2025-10 | $523 | $141 | -$382 | $110 | -$276 | -$387 |
| 2025-11 | $244 | $487 | $243 | -$303 | $227 | $530 |
| 2025-12 | -$2,166 | -$1,412 | $754 | -$3,596 | -$1,821 | $1,776 |
| 2026-01 | $500 | $138 | -$361 | $815 | $157 | -$658 |
| 2026-02 | $2,156 | $2,433 | $278 | $1,950 | $1,147 | -$802 |
| 2026-03 | -$900 | $1,380 | $2,281 | $271 | $814 | $543 |
| 2026-04 | $1,057 | $823 | -$234 | $1,199 | $1,135 | -$64 |
| 2026-05 | $4,628 | $3,916 | -$712 | $4,617 | $3,884 | -$733 |
| 2026-06 | $1,361 | $726 | -$635 | $1,346 | $618 | -$729 |
| 2026-07 | -$1,228 | -$1,580 | -$353 | -$1,357 | -$1,728 | -$370 |
| 2026-08 | $3,826 | $3,943 | $117 | $3,412 | $3,740 | $328 |
| 2026-09 | -$283 | -$528 | -$245 | -$306 | -$499 | -$193 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $4,561 | $4,566 | $5 | $4,622 | $4,899 | $277 |
| 2026-06 | $1,361 | $726 | -$635 | $1,346 | $618 | -$729 |
| 2026-07 | -$1,228 | -$1,580 | -$353 | -$1,357 | -$1,728 | -$370 |
| 2026-08 | $3,826 | $3,943 | $117 | $3,412 | $3,740 | $328 |
| 2026-09 | -$283 | -$528 | -$245 | -$306 | -$499 | -$193 |

### T01-04 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $988 | $240 | -$748 | $638 | $422 | -$216 |
| 2025-08 | $1,683 | $865 | -$818 | $1,351 | $1,093 | -$258 |
| 2025-09 | $1,580 | $802 | -$778 | $1,456 | $756 | -$700 |
| 2025-10 | $2,407 | $3,119 | $711 | $2,176 | $2,725 | $550 |
| 2025-11 | -$2,229 | -$2,434 | -$205 | -$2,207 | -$2,594 | -$387 |
| 2025-12 | $1,356 | $1,068 | -$287 | $467 | $207 | -$260 |
| 2026-01 | -$276 | $102 | $379 | -$709 | -$314 | $395 |
| 2026-02 | -$747 | $411 | $1,159 | -$392 | $487 | $879 |
| 2026-03 | $3,103 | $3,235 | $131 | $3,427 | $3,242 | -$184 |
| 2026-04 | $889 | $1,052 | $163 | $876 | $1,066 | $190 |
| 2026-05 | $1,417 | $360 | -$1,058 | $1,332 | $317 | -$1,016 |
| 2026-06 | $1,842 | $1,339 | -$502 | $1,443 | $1,504 | $61 |
| 2026-07 | -$1,194 | -$229 | $965 | -$1,337 | -$326 | $1,011 |
| 2026-08 | $2,590 | $2,633 | $42 | $2,491 | $2,539 | $48 |
| 2026-09 | -$296 | -$296 | $0 | -$252 | -$252 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $1,016 | $724 | -$292 | $965 | $710 | -$255 |
| 2026-06 | $1,842 | $1,339 | -$502 | $1,443 | $1,504 | $61 |
| 2026-07 | -$1,194 | -$229 | $965 | -$1,337 | -$326 | $1,011 |
| 2026-08 | $2,590 | $2,633 | $42 | $2,491 | $2,539 | $48 |
| 2026-09 | -$296 | -$296 | $0 | -$252 | -$252 | $0 |


## Causal example and independent verification

T01-05 rejected the fresh MFI signal at **2025-07-01 18:30 UTC**
(`1751394600000`). Its source15m bar is18:15-18:30; current MFI7 is9.42117
after the fresh threshold crossing. Calendar block4 is known at18:30 and is
excluded. No future price is inspected. That crossing is not queued for20:00.
The calendar evidence object's same-time fields describe the known clock,
not a fictitious market bar. A separate fixture verifies+1m fills crossing a
calendar boundary retain their original decision and exits stay unrestricted.

- 16 archived parent/clock cases reproduced exactly;8 all-true adapters match
  old engines before variants.
- 12 definitions /48 variant cases +16 repeated cases +48 exact readiness
  controls = **112 logical cases**. Calendar readiness always matches parents;
  no missing-input sample selection.
- 696 descriptive calendar rows independently rebuilt, including market/slot/
  opportunity/occupancy/exposure and signal-origin versus exit-clock outcomes.
- 36,793 trade rows,79,066 crossing rows and
  1,120 month rows independently verified; all case screens/attribution
  and source/input/artifact hashes checked.
- Ten new fixture groups, prior C01/shared-feature fixtures, TypeScript checks,
  and per-definition future-prefix invariance passed.

Accepted local folder:
`backtests/hype/hype-indicator-time-gating-t01-2026-09-07/`.
`verification.json` is final independent acceptance. The earlier runner
`validation.json` pending-verification field is historical and remains
hash-frozen. Historical publication/fills are modeled; the verification is
not a claim of tick-exact live execution or funding completeness.

## Saved evidence and stopping point

T01-05 is retained as the strongest new research lead, with its monthly and
defensive failures intact. T01-02 and T01-09 are useful full-versus-recent
counterexamples, not producers. T01-11 tests and refutes a direct transfer of
the MFI calendar exclusion to CMF. Original C01 evidence remains untouched.

[Candidate register](COMBINATION-CANDIDATES.md).
[Separate C02 report](codex-astra-indicator-combinations-c02-findings-2026-09-07.md).
[Roadmap](../docs/research/indicator-combinations-next-steps-2026-09-07.md).

This task adds32 C02 +12 T01 =44 new standalone definitions:
**5,236 total standalone /45 ladder**, not44 new live settings.
S01 confirmation waits, R01 refinements, HL/SR mixtures and ladder transfer
remain unrun. No additional sweep follows automatically. Live configuration,
state and order logic were untouched; no commit or push.
