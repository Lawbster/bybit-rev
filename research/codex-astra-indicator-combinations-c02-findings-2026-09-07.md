# C02: 32 additional indicator-entry/context combinations

September 7, 2026. Local research only; all results independently verified.
[Exact frozen card](../research-inputs/indicators/combinations-c02-2026-09-07.json).
[Reproduction and timing contract](../docs/research/indicator-entry-context-studies.md).

## TL;DR

- **0/32 profit qualifiers; 0/32 defensive qualifiers; 0/32 inherited strict-clock qualifiers.** All 296 logical cases verified. All 40 archived controls matched exactly before variants.
- **C02-27, MACD short + hourly shock veto**, is the strongest full-period incremental lead: parent $2,000 -> $3,399 immediate, but recent $1,933 -> $2,019. C02-32, Bollinger short + negative hourly CMF, also improves both windows/delays. Neither reaches the recent +$200 budget. These are saved hypotheses, not new live shorts.
- Full-period improvements from RSI + shock veto and MACD long + improving momentum reverse recently. Many extra conditions discard profitable rebounds. The results reject these exact configurations under the frozen screens, not entire indicators or all possible combinations. **No live/config/ladder changes.**

## Comparison contract and exact coverage

Full: **2025-07-01 00:00 to 2026-09-04 19:01 UTC**.
Recent: **2026-05-17 20:43 to the same cutoff**, starting flat.
Recent overlaps full and has already been examined; it is not fresh out-of-sample evidence.
Seed starts June 1, 2025. The hash-matched original repaired snapshot contains
663,541 continuous minute bars, including the original 11 repaired minutes.
Current pulled data and old C01 artifacts were not modified.

Each independent rule: **$10,000 entry notional / $32,000 reference equity**,
one position, no ladder, averaging, compounding, TP or SL. Exit is 12h after
actual entry, then the case's exit delay. Both entry and exit have either 0m
or +1m execution delay. Fees: inherited modeled 0.055% per side on actual
executed notional; extra-cost stress adds 5bps each side on the same path.
**Before funding; not incremental ladder PnL, account PnL, or liquidation certification.**
Open inventory is marked separately, including hypothetical closing fees.

All parents below are previously tested definitions, not new optimizations.
A fresh closed-bar parent crossing is evaluated against one current expected
closed 1h condition. False or unavailable means discard; no waiting until it
becomes favorable. Occupied signals are skipped, not queued. Each pair gets a
complete independent path; this is not removal of rows from the parent's ledger.

| Parent | Full / recent net, 0m | Full / recent closes | Full / recent adverse DD |
|---|---|---|---|
| P1: CRSI15m recovery >5 long | $8,684 / $6,272 | 142 / 33 | 8.68% / 4.00% |
| P2: RSI14 5m into <=30 long | $8,388 / $5,067 | 463 / 106 | 22.39% / 8.25% |
| P3: ROC12 1h into <=-1% long | $12,223 / $7,122 | 392 / 93 | 18.20% / 5.84% |
| P4: MFI7 15m into <10 long | $13,112 / $3,957 | 441 / 106 | 10.19% / 7.18% |
| P5: MACD12/26/9 4h bullish cross long | $8,270 / $2,587 | 90 / 24 | 7.28% / 2.84% |
| P6: 30m move into <-0.5 prior ATR14 long | $11,876 / $7,439 | 736 / 185 | 23.60% / 8.80% |
| P7: MACD12/26/9 4h bearish cross short | $2,000 / $1,933 | 91 / 25 | 15.17% / 3.71% |
| P8: Bollinger20/2 4h downside breakout short | $2,865 / $907 | 67 / 13 | 12.35% / 3.76% |

Parent IDs, modes and parameters are pinned in the card. P2's historical ID
contains the mirrored upper value70; its long threshold is30.

| Condition | Exact observed predicate |
|---|---|
| Q1 | Side-signed change in 1h MACD12/26/9 histogram is >0; immediately previous closed 1h bar required |
| Q2 | 1h ADX14 <25 for P1/P2/P3/P4/P6 reversion roles; >=25 for P5/P7/P8 continuation roles |
| Q3 | Absolute latest closed 1h close change / preceding 1h ATR14 <=1; zero/missing denominator unavailable |
| Q4 | Side-signed 1h CMF20 >0; zero fails the predicate but is valid data |

For longs side=+1; shorts side=-1. Roles were fixed before execution.
Eight parents x four independent conditions; no stacking C01 filters, votes,
time gates, new exits or thresholds. C02-01..04 are P1+Q1..4, then P2, etc.

All 128 logical readiness-only controls exactly matched their original
parents and were deduplicated only after equality checks. No variant benefits
from unequal missing-data coverage. Eight same-side clock cases are retained
as separate controls; they are not a substitute for each rule's own baseline.

## What the strongest comparisons actually say

**C02-27:** full immediate removes12 parent trades, sacrificing $1,380 of wins
and avoiding $2,780 of losses; there are no newly enabled trades. This is an
interpretable selection benefit in that panel. Recently it changes only four
closes: $331 foregone wins versus $418 avoided losses, just +$86 net.
The +1m recent gain is only +$45. Worst monthly regression is **-$325.57**,
slightly beyond the frozen -$320 limit; do not disguise a near miss as a pass.
Even ignoring that small breach, recent profit fails and recent DD is worse
than the ex-post reduced-size parent (3.36% versus3.15% immediate).

**C02-32:** full immediate parent $2,865 -> $3,426; +1m $746 -> $1,866.
Recent parent $907 -> $954 and $847 -> $890. The recent gain comes from
omitting **one small losing trade**, leaving12 closes. It passes the common
sample/net/stress/month budget but fails the profit and defense objectives.
Large full-window delay sensitivity remains inherited from its Bollinger
entry and changed occupancy; +1m is a distinct causal path, not a confidence interval.

**C02-07 and C02-17:** respectively +$1,957 and +$1,504 full immediate, but
-$1,142 and -$1,511 recent. Their full-history profit rankings cannot justify
calling them regime-stable improvements. C02-28 reduces drawdown but gives
up profit; keep it as a defensive comparator, not a qualified producer.

The per-case tables below explicitly retain baseline wins, losses, open
marks and drawdown. Reporting units are dollars except DD, which is peak
marked-equity drawdown using adverse minute prices.

## All 32 definitions, ranked by robust full-window increment

### Full-window ranking panels

Order is the smaller full-window increment across the two delays, not this panel's return.

| ID / condition | 0m parent -> variant net | Delta 0m | +1m parent -> variant net | Delta +1m | Variant closes 0m / +1m |
|---|---|---|---|---|---|
| C02-27 P7+Q3 | $2,000 -> $3,399 | $1,399 | $1,547 -> $3,136 | $1,589 | 79 / 79 |
| C02-07 P2+Q3 | $8,388 -> $10,345 | $1,957 | $9,291 -> $10,504 | $1,212 | 442 / 441 |
| C02-17 P5+Q1 | $8,270 -> $9,774 | $1,504 | $8,632 -> $9,607 | $975 | 54 / 54 |
| C02-32 P8+Q4 | $2,865 -> $3,426 | $561 | $746 -> $1,866 | $1,120 | 59 / 52 |
| C02-28 P7+Q4 | $2,000 -> $1,703 | -$297 | $1,547 -> $1,224 | -$323 | 73 / 72 |
| C02-20 P5+Q4 | $8,270 -> $7,650 | -$619 | $8,632 -> $7,786 | -$846 | 76 / 76 |
| C02-22 P6+Q2 | $11,876 -> $10,923 | -$953 | $8,234 -> $9,030 | $796 | 463 / 448 |
| C02-29 P8+Q1 | $2,865 -> $1,752 | -$1,113 | $746 -> $191 | -$556 | 56 / 50 |
| C02-26 P7+Q2 | $2,000 -> $425 | -$1,574 | $1,547 -> $387 | -$1,161 | 25 / 25 |
| C02-30 P8+Q2 | $2,865 -> $1,041 | -$1,824 | $746 -> -$517 | -$1,264 | 45 / 40 |
| C02-25 P7+Q1 | $2,000 -> $116 | -$1,883 | $1,547 -> -$290 | -$1,837 | 55 / 54 |
| C02-15 P4+Q3 | $13,112 -> $11,083 | -$2,029 | $10,761 -> $10,084 | -$677 | 381 / 379 |
| C02-06 P2+Q2 | $8,388 -> $7,165 | -$1,223 | $9,291 -> $7,244 | -$2,048 | 296 / 296 |
| C02-23 P6+Q3 | $11,876 -> $9,645 | -$2,231 | $8,234 -> $7,369 | -$866 | 719 / 692 |
| C02-02 P1+Q2 | $8,684 -> $6,197 | -$2,487 | $7,744 -> $5,703 | -$2,041 | 84 / 84 |
| C02-31 P8+Q3 | $2,865 -> $271 | -$2,594 | $746 -> $76 | -$670 | 51 / 48 |
| C02-19 P5+Q3 | $8,270 -> $5,485 | -$2,784 | $8,632 -> $5,811 | -$2,821 | 77 / 76 |
| C02-08 P2+Q4 | $8,388 -> $6,398 | -$1,990 | $9,291 -> $6,214 | -$3,077 | 266 / 266 |
| C02-11 P3+Q3 | $12,223 -> $8,653 | -$3,570 | $11,263 -> $9,139 | -$2,124 | 334 / 331 |
| C02-21 P6+Q1 | $11,876 -> $8,250 | -$3,626 | $8,234 -> $5,672 | -$2,562 | 561 / 547 |
| C02-03 P1+Q3 | $8,684 -> $4,651 | -$4,033 | $7,744 -> $4,206 | -$3,538 | 77 / 77 |
| C02-18 P5+Q2 | $8,270 -> $4,015 | -$4,255 | $8,632 -> $4,314 | -$4,318 | 25 / 24 |
| C02-14 P4+Q2 | $13,112 -> $7,873 | -$5,239 | $10,761 -> $8,223 | -$2,538 | 277 / 275 |
| C02-04 P1+Q4 | $8,684 -> $3,055 | -$5,629 | $7,744 -> $3,019 | -$4,725 | 62 / 62 |
| C02-10 P3+Q2 | $12,223 -> $4,226 | -$7,997 | $11,263 -> $4,623 | -$6,640 | 253 / 252 |
| C02-12 P3+Q4 | $12,223 -> $3,813 | -$8,410 | $11,263 -> $5,033 | -$6,230 | 198 / 197 |
| C02-16 P4+Q4 | $13,112 -> $4,609 | -$8,502 | $10,761 -> $3,793 | -$6,969 | 235 / 234 |
| C02-01 P1+Q1 | $8,684 -> -$82 | -$8,767 | $7,744 -> -$55 | -$7,799 | 4 / 4 |
| C02-09 P3+Q1 | $12,223 -> $3,379 | -$8,844 | $11,263 -> $3,679 | -$7,584 | 119 / 119 |
| C02-24 P6+Q4 | $11,876 -> $2,199 | -$9,677 | $8,234 -> $2,873 | -$5,361 | 510 / 495 |
| C02-05 P2+Q1 | $8,388 -> -$3,795 | -$12,182 | $9,291 -> -$2,707 | -$11,999 | 153 / 152 |
| C02-13 P4+Q1 | $13,112 -> -$1,761 | -$14,873 | $10,761 -> -$1,948 | -$12,709 | 87 / 87 |

### Recent-window ranking panels

Order is the smaller full-window increment across the two delays, not this panel's return.

| ID / condition | 0m parent -> variant net | Delta 0m | +1m parent -> variant net | Delta +1m | Variant closes 0m / +1m |
|---|---|---|---|---|---|
| C02-27 P7+Q3 | $1,933 -> $2,019 | $86 | $2,114 -> $2,159 | $45 | 21 / 21 |
| C02-07 P2+Q3 | $5,067 -> $3,925 | -$1,142 | $5,549 -> $4,276 | -$1,273 | 102 / 102 |
| C02-17 P5+Q1 | $2,587 -> $1,076 | -$1,511 | $2,603 -> $1,072 | -$1,530 | 12 / 12 |
| C02-32 P8+Q4 | $907 -> $954 | $47 | $847 -> $890 | $43 | 12 / 12 |
| C02-28 P7+Q4 | $1,933 -> $1,884 | -$48 | $2,114 -> $2,058 | -$56 | 19 / 19 |
| C02-20 P5+Q4 | $2,587 -> $1,828 | -$759 | $2,603 -> $1,879 | -$724 | 17 / 17 |
| C02-22 P6+Q2 | $7,439 -> $2,837 | -$4,602 | $5,282 -> $2,451 | -$2,831 | 110 / 105 |
| C02-29 P8+Q1 | $907 -> $433 | -$474 | $847 -> $369 | -$478 | 10 / 10 |
| C02-26 P7+Q2 | $1,933 -> $1,739 | -$194 | $2,114 -> $1,812 | -$303 | 8 / 8 |
| C02-30 P8+Q2 | $907 -> $83 | -$824 | $847 -> $9 | -$838 | 8 / 8 |
| C02-25 P7+Q1 | $1,933 -> $391 | -$1,541 | $2,114 -> $484 | -$1,631 | 15 / 15 |
| C02-15 P4+Q3 | $3,957 -> $2,945 | -$1,013 | $3,311 -> $2,792 | -$519 | 89 / 89 |
| C02-06 P2+Q2 | $5,067 -> -$50 | -$5,117 | $5,549 -> -$254 | -$5,804 | 65 / 65 |
| C02-23 P6+Q3 | $7,439 -> $4,838 | -$2,600 | $5,282 -> $3,901 | -$1,381 | 184 / 177 |
| C02-02 P1+Q2 | $6,272 -> $4,104 | -$2,168 | $6,023 -> $4,033 | -$1,990 | 23 / 23 |
| C02-31 P8+Q3 | $907 -> $1,198 | $291 | $847 -> $1,246 | $399 | 9 / 9 |
| C02-19 P5+Q3 | $2,587 -> $1,633 | -$954 | $2,603 -> $1,662 | -$941 | 21 / 21 |
| C02-08 P2+Q4 | $5,067 -> $3,889 | -$1,178 | $5,549 -> $4,199 | -$1,350 | 62 / 62 |
| C02-11 P3+Q3 | $7,122 -> $5,981 | -$1,141 | $7,170 -> $6,014 | -$1,156 | 83 / 82 |
| C02-21 P6+Q1 | $7,439 -> $3,717 | -$3,721 | $5,282 -> $3,634 | -$1,649 | 145 / 141 |
| C02-03 P1+Q3 | $6,272 -> $3,862 | -$2,409 | $6,023 -> $3,884 | -$2,139 | 20 / 20 |
| C02-18 P5+Q2 | $2,587 -> $1,354 | -$1,233 | $2,603 -> $1,368 | -$1,235 | 10 / 10 |
| C02-14 P4+Q2 | $3,957 -> -$839 | -$4,796 | $3,311 -> -$966 | -$4,277 | 64 / 64 |
| C02-04 P1+Q4 | $6,272 -> $4,538 | -$1,734 | $6,023 -> $4,471 | -$1,552 | 17 / 17 |
| C02-10 P3+Q2 | $7,122 -> $1,545 | -$5,577 | $7,170 -> $1,522 | -$5,649 | 62 / 61 |
| C02-12 P3+Q4 | $7,122 -> $4,157 | -$2,965 | $7,170 -> $4,373 | -$2,797 | 46 / 46 |
| C02-16 P4+Q4 | $3,957 -> $3,987 | $30 | $3,311 -> $3,347 | $36 | 63 / 62 |
| C02-01 P1+Q1 | $6,272 -> -$205 | -$6,476 | $6,023 -> -$167 | -$6,190 | 2 / 2 |
| C02-09 P3+Q1 | $7,122 -> $1,037 | -$6,085 | $7,170 -> $1,106 | -$6,065 | 27 / 27 |
| C02-24 P6+Q4 | $7,439 -> $5,242 | -$2,196 | $5,282 -> $5,102 | -$180 | 132 / 129 |
| C02-05 P2+Q1 | $5,067 -> -$1,163 | -$6,230 | $5,549 -> -$641 | -$6,191 | 39 / 39 |
| C02-13 P4+Q1 | $3,957 -> -$1,458 | -$5,415 | $3,311 -> -$1,588 | -$4,899 | 21 / 21 |


## Top-five baseline-first wins and losses

### C02-27 — MACD12/26/9 4h bearish cross short / Q3

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 47 / 44 | $12,939 | -$10,940 | $0 | $2,000 | 15.17% |
| full / 0m / C02-27 | 42 / 37 | $11,559 | -$8,160 | $0 | $3,399 | 10.13% |
| full / 1m / parent | 46 / 44 | $12,489 | -$10,941 | $0 | $1,547 | 15.49% |
| full / 1m / C02-27 | 42 / 37 | $11,394 | -$8,257 | $0 | $3,136 | 10.55% |
| recent / 0m / parent | 13 / 12 | $3,426 | -$1,493 | $0 | $1,933 | 3.71% |
| recent / 0m / C02-27 | 12 / 9 | $3,095 | -$1,075 | $0 | $2,019 | 3.36% |
| recent / 1m / parent | 14 / 11 | $3,572 | -$1,457 | $0 | $2,114 | 3.60% |
| recent / 1m / C02-27 | 13 / 8 | $3,222 | -$1,062 | $0 | $2,159 | 3.30% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `selection_not_better_than_exposure_scaling`.

### C02-07 — RSI14 5m into <=30 long / Q3

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 231 / 232 | $62,264 | -$53,876 | $0 | $8,388 | 22.39% |
| full / 0m / C02-07 | 223 / 219 | $60,322 | -$49,978 | $0 | $10,345 | 17.10% |
| full / 1m / parent | 228 / 234 | $63,309 | -$54,017 | $0 | $9,291 | 22.34% |
| full / 1m / C02-07 | 220 / 221 | $60,756 | -$50,252 | $0 | $10,504 | 17.82% |
| recent / 0m / parent | 51 / 55 | $15,819 | -$10,753 | $0 | $5,067 | 8.25% |
| recent / 0m / C02-07 | 49 / 53 | $14,433 | -$10,508 | $0 | $3,925 | 8.37% |
| recent / 1m / parent | 51 / 55 | $16,606 | -$11,057 | $0 | $5,549 | 8.70% |
| recent / 1m / C02-07 | 49 / 53 | $15,175 | -$10,899 | $0 | $4,276 | 8.60% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`, `drawdown_worse_than_parent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `profit_retention_below_90pct`, `recent_drawdown_worse`, `selection_not_better_than_exposure_scaling`.

### C02-17 — MACD12/26/9 4h bullish cross long / Q1

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 51 / 39 | $18,549 | -$10,280 | $0 | $8,270 | 7.28% |
| full / 0m / C02-17 | 34 / 20 | $14,912 | -$5,138 | $0 | $9,774 | 5.14% |
| full / 1m / parent | 50 / 39 | $18,791 | -$10,159 | $0 | $8,632 | 7.40% |
| full / 1m / C02-17 | 33 / 21 | $14,939 | -$5,332 | $0 | $9,607 | 5.13% |
| recent / 0m / parent | 13 / 11 | $4,452 | -$1,865 | $0 | $2,587 | 2.84% |
| recent / 0m / C02-17 | 5 / 7 | $2,379 | -$1,303 | $0 | $1,076 | 4.30% |
| recent / 1m / parent | 13 / 11 | $4,476 | -$1,873 | $0 | $2,603 | 2.84% |
| recent / 1m / C02-17 | 5 / 7 | $2,377 | -$1,305 | $0 | $1,072 | 4.35% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`, `drawdown_worse_than_parent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `selection_not_better_than_exposure_scaling`, `profit_retention_below_90pct`, `recent_drawdown_worse`.

### C02-32 — Bollinger20/2 4h downside breakout short / Q4

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 35 / 32 | $8,499 | -$5,634 | $0 | $2,865 | 12.35% |
| full / 0m / C02-32 | 32 / 27 | $8,005 | -$4,580 | $0 | $3,426 | 12.31% |
| full / 1m / parent | 29 / 30 | $6,397 | -$5,650 | $0 | $746 | 13.81% |
| full / 1m / C02-32 | 27 / 25 | $6,476 | -$4,610 | $0 | $1,866 | 13.54% |
| recent / 0m / parent | 8 / 5 | $1,590 | -$683 | $0 | $907 | 3.76% |
| recent / 0m / C02-32 | 8 / 4 | $1,590 | -$636 | $0 | $954 | 3.76% |
| recent / 1m / parent | 8 / 5 | $1,632 | -$786 | $0 | $847 | 4.01% |
| recent / 1m / C02-32 | 8 / 4 | $1,632 | -$743 | $0 | $890 | 4.01% |

Profit-screen failures: `increment_below_500_full_or_200_recent`.

Defense-screen failures: `full_drawdown_reduction_insufficient`, `selection_not_better_than_exposure_scaling`.

### C02-28 — MACD12/26/9 4h bearish cross short / Q4

| Window / delay / setup | W / L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
|---|---|---|---|---|---|---|
| full / 0m / parent | 47 / 44 | $12,939 | -$10,940 | $0 | $2,000 | 15.17% |
| full / 0m / C02-28 | 37 / 36 | $9,738 | -$8,035 | $0 | $1,703 | 9.28% |
| full / 1m / parent | 46 / 44 | $12,489 | -$10,941 | $0 | $1,547 | 15.49% |
| full / 1m / C02-28 | 36 / 36 | $9,204 | -$7,980 | $0 | $1,224 | 9.73% |
| recent / 0m / parent | 13 / 12 | $3,426 | -$1,493 | $0 | $1,933 | 3.71% |
| recent / 0m / C02-28 | 10 / 9 | $2,774 | -$890 | $0 | $1,884 | 2.62% |
| recent / 1m / parent | 14 / 11 | $3,572 | -$1,457 | $0 | $2,114 | 3.60% |
| recent / 1m / C02-28 | 11 / 8 | $2,913 | -$855 | $0 | $2,058 | 2.52% |

Profit-screen failures: `monthly_parent_regression_over_320`, `increment_below_500_full_or_200_recent`.

Defense-screen failures: `monthly_parent_regression_over_320`, `profit_retention_below_90pct`.


## Invisible upside, adverse paths and costs

Missed winners and newly enabled positions are included, not just avoided
losses. Removed/new counts concern completed closes; any cutoff mark remains
in the net tables. Ex-post exposure scaling means rerunning the parent's
equity accounting at a constant size ratio equal to variant/parent exposure;
it is a diagnostic, not a causal live-sizing rule.

| ID / window / delay | Removed closes | Missed winning $ | Avoided losing $ | New closes | New net | Extra-cost net parent -> variant | Ex-post scaled-parent DD -> variant DD | Worst held gross move |
|---|---|---|---|---|---|---|---|---|
| C02-27 / full / 0m | 12 | $1,380 | $2,780 | 0 | $0 | $1,091 -> $2,611 | 13.26% -> 10.13% | -10.67% |
| C02-27 / full / 1m | 11 | $1,095 | $2,684 | 0 | $0 | $649 -> $2,348 | 13.68% -> 10.55% | -10.81% |
| C02-27 / recent / 0m | 4 | $331 | $418 | 0 | $0 | $1,684 -> $1,810 | 3.15% -> 3.36% | -4.75% |
| C02-27 / recent / 1m | 4 | $350 | $395 | 0 | $0 | $1,866 -> $1,950 | 3.06% -> 3.30% | -4.81% |
| C02-07 / full / 0m | 59 | $6,932 | $8,047 | 38 | $842 | $3,751 -> $5,917 | 21.59% -> 17.10% | -14.27% |
| C02-07 / full / 1m | 61 | $7,271 | $8,559 | 40 | -$76 | $4,664 -> $6,086 | 21.54% -> 17.82% | -14.34% |
| C02-07 / recent / 0m | 10 | $2,083 | $1,289 | 6 | -$348 | $4,004 -> $2,902 | 7.97% -> 8.37% | -10.80% |
| C02-07 / recent / 1m | 10 | $2,158 | $1,263 | 6 | -$378 | $4,486 -> $3,254 | 8.41% -> 8.60% | -11.22% |
| C02-17 / full / 0m | 36 | $3,637 | $5,142 | 0 | $0 | $7,365 -> $9,229 | 4.41% -> 5.14% | -8.33% |
| C02-17 / full / 1m | 35 | $3,853 | $4,828 | 0 | $0 | $7,737 -> $9,062 | 4.54% -> 5.13% | -8.53% |
| C02-17 / recent / 0m | 12 | $2,073 | $562 | 0 | $0 | $2,345 -> $955 | 1.45% -> 4.30% | -4.19% |
| C02-17 / recent / 1m | 12 | $2,099 | $568 | 0 | $0 | $2,361 -> $952 | 1.45% -> 4.35% | -4.05% |
| C02-32 / full / 0m | 8 | $494 | $1,054 | 0 | $0 | $2,197 -> $2,838 | 11.06% -> 12.31% | -7.38% |
| C02-32 / full / 1m | 8 | $510 | $1,041 | 1 | $588 | $157 -> $1,347 | 12.34% -> 13.54% | -7.45% |
| C02-32 / recent / 0m | 1 | $0 | $47 | 0 | $0 | $777 -> $835 | 3.48% -> 3.76% | -6.22% |
| C02-32 / recent / 1m | 1 | $0 | $43 | 0 | $0 | $717 -> $770 | 3.71% -> 4.01% | -6.42% |
| C02-28 / full / 0m | 18 | $3,201 | $2,904 | 0 | $0 | $1,091 -> $974 | 12.29% -> 9.28% | -10.73% |
| C02-28 / full / 1m | 18 | $3,285 | $2,961 | 0 | $0 | $649 -> $505 | 12.52% -> 9.73% | -10.74% |
| C02-28 / recent / 0m | 6 | $652 | $603 | 0 | $0 | $1,684 -> $1,695 | 2.87% -> 2.62% | -3.06% |
| C02-28 / recent / 1m | 6 | $659 | $602 | 0 | $0 | $1,866 -> $1,869 | 2.79% -> 2.52% | -3.08% |

Concentration and exact worst adverse timestamps are preserved in
`diagnostics.json`. Do not add separately replayed variants together as a portfolio.

## Top-five monthly stability

Marked PnL includes month-boundary inventory changes, not just closes assigned
to their exit month. Recent May and September are partial months. Full and
recent are distinct flat-start paths, even when subsequent months agree.
Every displayed variant has its own parent beside it; all 32 have complete
monthly rows in the accepted artifacts.

### C02-27 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $1,252 | $1,071 | -$181 | $1,219 | $1,046 | -$173 |
| 2025-08 | -$1,232 | -$353 | $879 | -$1,231 | -$392 | $839 |
| 2025-09 | -$1,507 | -$850 | $657 | -$1,455 | -$800 | $655 |
| 2025-10 | -$315 | -$315 | $0 | -$517 | -$517 | $0 |
| 2025-11 | -$140 | -$140 | $0 | -$206 | -$206 | $0 |
| 2025-12 | $177 | $194 | $18 | $146 | $175 | $29 |
| 2026-01 | $621 | $730 | $109 | $535 | $729 | $194 |
| 2026-02 | $1,224 | $1,224 | $0 | $1,197 | $1,197 | $0 |
| 2026-03 | $102 | $102 | $0 | $125 | $125 | $0 |
| 2026-04 | $64 | -$105 | -$169 | -$178 | -$178 | $0 |
| 2026-05 | $325 | $325 | -$0 | $394 | $394 | $0 |
| 2026-06 | $454 | $716 | $262 | $502 | $766 | $264 |
| 2026-07 | $1,389 | $1,090 | -$299 | $1,379 | $1,054 | -$326 |
| 2026-08 | -$590 | -$467 | $123 | -$547 | -$441 | $106 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $503 | $503 | $0 | $595 | $595 | $0 |
| 2026-06 | $454 | $716 | $262 | $502 | $766 | $264 |
| 2026-07 | $1,389 | $1,090 | -$299 | $1,379 | $1,054 | -$326 |
| 2026-08 | -$590 | -$467 | $123 | -$547 | -$441 | $106 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |

### C02-07 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $1,567 | $1,292 | -$275 | $1,592 | $1,389 | -$203 |
| 2025-08 | $2,606 | $2,391 | -$215 | $2,564 | $2,328 | -$236 |
| 2025-09 | $2,052 | $2,411 | $359 | $1,995 | $2,256 | $261 |
| 2025-10 | $961 | -$432 | -$1,393 | $1,189 | -$786 | -$1,975 |
| 2025-11 | -$2,112 | -$1,602 | $510 | -$1,784 | -$1,238 | $546 |
| 2025-12 | -$1,233 | -$1,015 | $218 | -$1,128 | -$1,038 | $90 |
| 2026-01 | -$2,234 | -$894 | $1,340 | -$2,520 | -$1,148 | $1,372 |
| 2026-02 | $150 | $1,860 | $1,709 | $229 | $2,039 | $1,810 |
| 2026-03 | $3,474 | $3,519 | $45 | $3,459 | $3,515 | $56 |
| 2026-04 | -$934 | -$230 | $704 | -$935 | -$275 | $660 |
| 2026-05 | $826 | $1,224 | $397 | $762 | $1,104 | $342 |
| 2026-06 | $2,550 | $688 | -$1,862 | $2,606 | $613 | -$1,993 |
| 2026-07 | -$2,296 | -$2,148 | $148 | -$2,352 | -$2,165 | $187 |
| 2026-08 | $2,773 | $3,044 | $271 | $3,311 | $3,606 | $295 |
| 2026-09 | $237 | $237 | $0 | $303 | $303 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $1,804 | $2,104 | $301 | $1,681 | $1,919 | $238 |
| 2026-06 | $2,550 | $688 | -$1,862 | $2,606 | $613 | -$1,993 |
| 2026-07 | -$2,296 | -$2,148 | $148 | -$2,352 | -$2,165 | $187 |
| 2026-08 | $2,773 | $3,044 | $271 | $3,311 | $3,606 | $295 |
| 2026-09 | $237 | $237 | $0 | $303 | $303 | $0 |

### C02-17 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | -$20 | $658 | $678 | -$21 | $622 | $642 |
| 2025-08 | $92 | $248 | $156 | $2 | $175 | $173 |
| 2025-09 | -$117 | -$395 | -$278 | -$100 | -$441 | -$341 |
| 2025-10 | $730 | $506 | -$224 | $835 | $573 | -$262 |
| 2025-11 | $1,004 | $1,628 | $623 | $1,043 | $1,666 | $624 |
| 2025-12 | $320 | $712 | $392 | $255 | $623 | $368 |
| 2026-01 | $1,092 | $1,528 | $435 | $1,176 | $1,589 | $413 |
| 2026-02 | $1,344 | $2,139 | $794 | $1,361 | $2,104 | $743 |
| 2026-03 | $437 | $467 | $29 | $495 | $514 | $19 |
| 2026-04 | $243 | $653 | $410 | $523 | $650 | $127 |
| 2026-05 | $1,244 | $1,090 | -$153 | $1,124 | $971 | -$153 |
| 2026-06 | $755 | -$293 | -$1,048 | $757 | -$301 | -$1,058 |
| 2026-07 | $20 | -$370 | -$390 | $58 | -$341 | -$398 |
| 2026-08 | $859 | $896 | $37 | $870 | $885 | $15 |
| 2026-09 | $266 | $309 | $43 | $255 | $319 | $63 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $687 | $533 | -$153 | $664 | $511 | -$153 |
| 2026-06 | $755 | -$293 | -$1,048 | $757 | -$301 | -$1,058 |
| 2026-07 | $20 | -$370 | -$390 | $58 | -$341 | -$398 |
| 2026-08 | $859 | $896 | $37 | $870 | $885 | $15 |
| 2026-09 | $266 | $309 | $43 | $255 | $319 | $63 |

### C02-32 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | -$588 | -$265 | $323 | -$660 | -$302 | $358 |
| 2025-08 | $717 | $517 | -$200 | $69 | $449 | $380 |
| 2025-09 | $347 | $347 | $0 | -$13 | -$13 | $0 |
| 2025-10 | $614 | $614 | $0 | $603 | $603 | -$0 |
| 2025-11 | $701 | $701 | $0 | $88 | $88 | $0 |
| 2025-12 | -$230 | $273 | $503 | -$547 | -$80 | $467 |
| 2026-01 | $258 | $191 | -$67 | $217 | $152 | -$65 |
| 2026-02 | $216 | $171 | -$45 | $136 | $72 | -$64 |
| 2026-03 | -$307 | -$307 | $0 | -$269 | -$269 | $0 |
| 2026-04 | $204 | $204 | $0 | $215 | $215 | $0 |
| 2026-05 | $121 | $121 | $0 | $156 | $156 | $0 |
| 2026-06 | $366 | $366 | $0 | $287 | $287 | $0 |
| 2026-07 | $409 | $456 | $47 | $431 | $474 | $43 |
| 2026-08 | $36 | $36 | $0 | $32 | $32 | $0 |
| 2026-09 | $0 | $0 | $0 | $0 | $0 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $95 | $95 | $0 | $96 | $96 | $0 |
| 2026-06 | $366 | $366 | $0 | $287 | $287 | $0 |
| 2026-07 | $409 | $456 | $47 | $431 | $474 | $43 |
| 2026-08 | $36 | $36 | $0 | $32 | $32 | $0 |
| 2026-09 | $0 | $0 | $0 | $0 | $0 | $0 |

### C02-28 monthly marked PnL

**full** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2025-07 | $1,252 | $913 | -$339 | $1,219 | $862 | -$356 |
| 2025-08 | -$1,232 | -$1,094 | $138 | -$1,231 | -$1,115 | $116 |
| 2025-09 | -$1,507 | -$850 | $657 | -$1,455 | -$800 | $655 |
| 2025-10 | -$315 | $7 | $322 | -$517 | -$181 | $336 |
| 2025-11 | -$140 | -$513 | -$373 | -$206 | -$532 | -$326 |
| 2025-12 | $177 | $169 | -$8 | $146 | $120 | -$26 |
| 2026-01 | $621 | $907 | $286 | $535 | $824 | $289 |
| 2026-02 | $1,224 | $741 | -$483 | $1,197 | $691 | -$506 |
| 2026-03 | $102 | -$349 | -$450 | $125 | -$324 | -$449 |
| 2026-04 | $64 | $64 | $0 | -$178 | -$178 | $0 |
| 2026-05 | $325 | $325 | $0 | $394 | $394 | $0 |
| 2026-06 | $454 | $189 | -$265 | $502 | $239 | -$262 |
| 2026-07 | $1,389 | $1,348 | -$41 | $1,379 | $1,340 | -$40 |
| 2026-08 | -$590 | -$332 | $258 | -$547 | -$301 | $246 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |

**recent** (each delay has its own baseline):

| UTC month | 0m parent | 0m variant | Delta | +1m parent | +1m variant | Delta |
|---|---|---|---|---|---|---|
| 2026-05 | $503 | $503 | $0 | $595 | $595 | $0 |
| 2026-06 | $454 | $189 | -$265 | $502 | $239 | -$262 |
| 2026-07 | $1,389 | $1,348 | -$41 | $1,379 | $1,340 | -$40 |
| 2026-08 | -$590 | -$332 | $258 | -$547 | -$301 | $246 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |


## Frozen screens and interpretation

Common: at least30 full /10 recent closes in each delay; positive net and
extra-cost net; solvent; no monthly marked regression below-$320 versus
either original or readiness parent.

Profit: +$500 full /+$200 recent in each delay, DD no worse.
Defense: retain90% of positive parent net, reduce losing dollars, full DD
reduction of20% and at least1pp, no recent DD worsening, and beat the
ex-post exposure-scaled parent's DD and losing dollars in every case.
The inherited clock screen remains separate. All exact failure flags are
stored in `ranking.json`; no thresholds were rescored after inspection.

This screen is a research budget, not a proof that an economic effect is
absent. It also is not permission to deploy a screen-passing rule: future
observation, actual publication/fill checks, funding, portfolio collateral
and a separate implementation review would still be necessary.

## Timing trace and validation

Example rejected C02-27 signal: **2025-07-31 20:00 UTC**
(`1753992000000`). The MACD parent uses the completed16:00-20:00 4h bar.
The Q3 observation uses the completed19:00-20:00 1h bar; its immediately
previous bar ends19:00. Close41.631 versus42.782 and previous ATR0.65228381295
give1.7645693 >1, so the entry is discarded. No later bar determines that
decision; the evidence object records each source interval and availability.
Historical publication lag is modeled, not certified from old exchange delivery.

- 32 pair definitions /128 pair cases,40 archived repeated controls and128
  logical readiness controls = **296 verified cases**.
- 40 exact archived-control comparisons;32 all-true adapter/engine comparisons.
- 20 feature-prefix checks and32 full-path prefix checks; future appended
  data cannot change already-eligible decisions.
- New ten fixture groups cover formulas, mixed clocks, prior ATR, null/zero,
  timing boundaries, frozen decisions and calendar denominators. Prior
  C01 and shared-feature fixtures also passed.
- Independent checker reconstructed **49,427 trade rows,
  148,572 crossing rows and 2,960 monthly rows**,
  including indicator math, gate inputs, occupancy, fees, marks, minute DD,
  attribution and unchanged screen flags. Input/source/artifact hashes matched.

Accepted local folder:
`backtests/hype/hype-indicator-combinations-c02-2026-09-07/`.
Read `verification.json` for final independent acceptance;
`validation.json.independentVerificationPending` records the earlier runner
stage and is intentionally not rewritten after its hash was frozen.

## Preservation and next boundary

C02 adds **32 distinct standalone definitions**, taking5,192 to5,224 before
the separately approved T01 time-gating study. Ladder definitions stay45.
[Retained evidence](COMBINATION-CANDIDATES.md) appends the useful leads and
failure controls; original C01 results remain unchanged.
[Separate T01 findings](codex-astra-indicator-time-gating-t01-findings-2026-09-07.md)
do not stack calendar exclusions on these pairs. S01/R01/HL/SR/ladder follow-ups
have not been run by this task. No live change, commit or push.
