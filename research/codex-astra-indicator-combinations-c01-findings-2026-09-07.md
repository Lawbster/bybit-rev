# C01 indicator combinations: bounded standalone findings

September 7, 2026 UTC. Research only; no live/config changes, commit or push.

## TL;DR

- **32 combinations / 128 strategy window-delay cases: zero profit-shortlist,
  zero defensive-shortlist and zero inherited strict-screen qualifiers.** Full:
  2025-07-01 00:00 to 2026-09-04 19:01 UTC; recent: 2026-05-17 20:43 to the
  same cutoff. $10,000 independent entry notional, $32,000 starting equity,
  12h exits, 0/+1m execution delays. Results include modeled trading fees,
  **before funding**, not incremental live-ladder profit.
- Three improve full/immediate parent PnL, three leave the executed path
  unchanged, and 26 worsen it. Only **C01-30 (OBV short + ER veto)** and
  **C01-20 (MACD long + daily VWAP)** improve parent net in all four cases;
  neither meets the frozen follow-up budgets. Nine rules are sample-limited;
  28 have at least one monthly parent regression worse than $320.
- **The replay and independent verification pass.** All 64 archived control
  cases reproduce; all 56 non-clock all-true cases match original engines.
  All 320 logical cases independently verified: 37,253 trade records, 75,062
  crossing records and 3,200 monthly rows. These include correlated windows,
  delays and duplicate availability controls, not that many unique market trades.

Accepted artifacts:
[verified C01 v2](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/verification.json),
[summary CSV](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/summary.csv),
[all monthly rows](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/monthly.csv),
[exact ranking/failures](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/ranking.json),
[attribution/path diagnostics](../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/diagnostics.json).

Method:
[approved original card](../research-inputs/indicators/combinations-c01-2026-09-07.json),
[planning rationale](../docs/research/indicator-combinations-c01-plan.md),
[reproduction guide](../docs/research/indicator-combinations-c01-study.md).

## 1. Scope, controls and what the numbers mean

Eight exact previously tested entries, four separate conditions each. Five long
entries and three short entries; **one trigger AND one condition** per definition.
No triple combinations, fitted votes, exit/stop/TP changes, waiting for later
confirmation, HL, S/R, ladder mutations, or shared-account portfolio.

| Anchor | Exact entry, always closed-bar / fresh crossing |
|---|---|
| A1 | Long: 15m research CRSI crosses into <=5 |
| A2 | Long: 15m research CRSI recovers above 5 |
| A3 | Long: 15m MFI7 crosses below 10 (exact signed metric <-0.8) |
| A4 | Long: 30m CMF10 crosses above 0 |
| A5 | Long: 4h MACD12/26/9 histogram crosses above 0 |
| A6 | Short: 4h MACD12/26/9 histogram crosses below 0 |
| A7 | Short: 30m ADX14 crosses above 40 with bearish DI |
| A8 | Short: 4h normalized OBV40 crosses above +0.25; contrarian fade |

| Condition | Exact requirement at the anchor's decision |
|---|---|
| B1 | Last completed 4h DMI14 agrees with trade direction |
| B2 | Last completed 1h signed ER20: side-adjusted value >-0.5 |
| B3 | Last completed 1h base volume >=1.5x mean of its prior 20 bars |
| B4 | Last completed 1h close above its own UTC-day VWAP for long / below for short |

The B2 short condition is ER20 <+0.5: do not fade an efficiently rising path.
It is not the same as demanding a bearish trend. B1 on A7 tests 30m/4h DMI
agreement, not independent indicator votes. Candle volume proxies are not
actual HL aggressor flow.

Every result is compared with its **own exact unfiltered entry**. Repeated
directional component-cross controls and long/short rolling 12h clocks are
context, not substitute baselines. The short clock is particularly poor:
beating it while still losing is not a useful short.

All 128 logical availability-only controls matched their original parents:
all relevant anchor opportunities had healthy expected B context. They were
deduplicated after checking all-crossing readiness and exact ledger/stat/month
equality. There is **no missing-data selection benefit** hiding in these results.

Recent starts flat; it is a subset of full, not an independent holdout.
Cutoff inventory is marked including hypothetical close fees and is not a
completed trade. Monthly marked equity includes held inventory across month
boundaries; monthly realized wins/losses need not equal the monthly equity mark.
Dollars below are rounded; machine artifacts retain full precision.

Fees: inherited research assumption 0.055% on each actual execution notional,
plus a separate extra 5bps/side fixed-path stress. Not a current account-fee
lookup. Funding is unavailable comprehensively and excluded. There is no
slippage, order-queue, liquidation or shared-account collateral certification.

## 2. Baseline-first wins and losses

These panels highlight the two positive all-case deltas and three instructive
trade-offs/failures, **not a selected list of qualifiers**. Every setup has its
own baseline directly above it. All are fixed 12h, $10k-notional standalone
positions, not the live ladder or the paused live HL short.

### full / immediate

| Setup | Closes | W/L | Winning dollars | Losing dollars | Open mark | Net | Adverse DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| clock_long context | 861 | 420/441 | $110,950 | -$107,401 | -$245 | $3,305 | 33.09% |
| clock_short context | 861 | 414/447 | $98,162 | -$120,668 | $223 | -$22,283 | 71.27% |
| OBV fade short baseline | 38 | 22/16 | $5,232 | -$4,702 | $223 | $753 | 7.19% |
| C01-30 + 1h ER veto | 29 | 19/10 | $4,530 | -$2,467 | $223 | $2,286 | 3.93% |
| MACD long baseline | 90 | 51/39 | $18,549 | -$10,280 | $0 | $8,270 | 7.28% |
| C01-20 + 1h day VWAP | 85 | 48/37 | $18,115 | -$9,688 | $0 | $8,427 | 7.19% |
| CMF continuation long baseline | 613 | 303/310 | $80,767 | -$70,581 | $0 | $10,186 | 15.66% |
| C01-14 + 1h ER veto | 602 | 297/305 | $80,284 | -$70,190 | $0 | $10,094 | 18.08% |
| CRSI recovery long baseline | 142 | 74/68 | $23,334 | -$14,813 | $163 | $8,684 | 8.68% |
| C01-07 + 1h RVOL | 78 | 44/34 | $14,955 | -$7,903 | $163 | $7,215 | 6.18% |
| MFI dip long baseline | 441 | 228/213 | $59,815 | -$46,703 | $0 | $13,112 | 10.19% |
| C01-11 + 1h RVOL | 143 | 67/76 | $16,365 | -$21,300 | $0 | -$4,935 | 22.73% |

### recent / immediate

| Setup | Closes | W/L | Winning dollars | Losing dollars | Open mark | Net | Adverse DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| clock_long context | 219 | 114/105 | $29,120 | -$23,837 | -$245 | $5,038 | 12.94% |
| clock_short context | 219 | 97/122 | $21,666 | -$31,775 | $223 | -$9,887 | 32.54% |
| OBV fade short baseline | 13 | 10/3 | $2,922 | -$1,074 | $223 | $2,071 | 2.63% |
| C01-30 + 1h ER veto | 10 | 9/1 | $2,340 | -$369 | $223 | $2,194 | 2.30% |
| MACD long baseline | 24 | 13/11 | $4,452 | -$1,865 | $0 | $2,587 | 2.84% |
| C01-20 + 1h day VWAP | 21 | 11/10 | $4,353 | -$1,661 | $0 | $2,692 | 2.59% |
| CMF continuation long baseline | 157 | 85/72 | $23,044 | -$14,806 | $0 | $8,238 | 7.41% |
| C01-14 + 1h ER veto | 153 | 84/69 | $23,027 | -$14,193 | $0 | $8,834 | 6.12% |
| CRSI recovery long baseline | 33 | 22/11 | $8,055 | -$1,946 | $163 | $6,272 | 4.00% |
| C01-07 + 1h RVOL | 18 | 14/4 | $5,170 | -$448 | $163 | $4,885 | 2.13% |
| MFI dip long baseline | 106 | 56/50 | $13,556 | -$9,599 | $0 | $3,957 | 7.18% |
| C01-11 + 1h RVOL | 37 | 18/19 | $4,157 | -$5,198 | $0 | -$1,041 | 7.22% |

## 3. All 32 ranked comparisons

Ranking is frozen: the smallest full net improvement across both delays and
both original/readiness parents. Since readiness parents equal original here,
this reduces to the worse of the two full-period delay deltas. An unchanged
rule can rank above a harmful rule without becoming a useful improvement.

### Immediate modeled execution

Full and recent dates are exactly those in the TL;DR. Arrow means baseline to
combination, not compounding/account growth. DD is adverse equity drawdown from
the $32k reference account, not worst adverse price movement.

| ID | Pair | Full parent -> pair | Full delta | Recent parent -> pair | Recent delta | Full DD parent -> pair | Pair closes full/recent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01-30 | OBV fade short + 1h ER veto | $753 -> $2,286 | $1,533 | $2,071 -> $2,194 | $123 | 7.19% -> 3.93% | 29/10 |
| C01-31 | OBV fade short + 1h RVOL | $753 -> $1,940 | $1,187 | $2,071 -> $1,223 | -$848 | 7.19% -> 2.44% | 13/5 |
| C01-20 | MACD long + 1h day VWAP | $8,270 -> $8,427 | $157 | $2,587 -> $2,692 | $105 | 7.28% -> 7.19% | 85/21 |
| C01-18 | MACD long + 1h ER veto | $8,270 -> $8,270 | $0 | $2,587 -> $2,587 | $0 | 7.28% -> 7.28% | 90/24 |
| C01-22 | MACD short + 1h ER veto | $2,000 -> $2,000 | $0 | $1,933 -> $1,933 | $0 | 15.17% -> 15.17% | 91/25 |
| C01-26 | ADX expansion short + 1h ER veto | $1,860 -> $1,860 | $0 | $1,863 -> $1,863 | $0 | 7.15% -> 7.15% | 62/15 |
| C01-14 | CMF continuation long + 1h ER veto | $10,186 -> $10,094 | -$92 | $8,238 -> $8,834 | $596 | 15.66% -> 18.08% | 602/153 |
| C01-25 | ADX expansion short + 4h DMI | $1,860 -> $1,455 | -$405 | $1,863 -> $1,906 | $43 | 7.15% -> 8.22% | 58/13 |
| C01-28 | ADX expansion short + 1h day VWAP | $1,860 -> $1,398 | -$462 | $1,863 -> $1,792 | -$71 | 7.15% -> 8.36% | 59/14 |
| C01-32 | OBV fade short + 1h day VWAP | $753 -> -$5 | -$758 | $2,071 -> $99 | -$1,972 | 7.19% -> 1.66% | 3/1 |
| C01-24 | MACD short + 1h day VWAP | $2,000 -> $1,065 | -$934 | $1,933 -> $1,933 | $0 | 15.17% -> 15.89% | 86/25 |
| C01-29 | OBV fade short + 4h DMI | $753 -> -$86 | -$839 | $2,071 -> $0 | -$2,071 | 7.19% -> 1.17% | 1/0 |
| C01-10 | MFI dip long + 1h ER veto | $13,112 -> $11,811 | -$1,301 | $3,957 -> $3,554 | -$403 | 10.19% -> 10.57% | 432/103 |
| C01-07 | CRSI recovery long + 1h RVOL | $8,684 -> $7,215 | -$1,469 | $6,272 -> $4,885 | -$1,387 | 8.68% -> 6.18% | 78/18 |
| C01-27 | ADX expansion short + 1h RVOL | $1,860 -> $253 | -$1,607 | $1,863 -> $870 | -$993 | 7.15% -> 7.38% | 25/6 |
| C01-21 | MACD short + 4h DMI | $2,000 -> $49 | -$1,950 | $1,933 -> $1,408 | -$525 | 15.17% -> 13.32% | 53/14 |
| C01-02 | CRSI extreme long + 1h ER veto | $11,044 -> $8,927 | -$2,117 | $6,603 -> $6,603 | $0 | 15.46% -> 15.19% | 135/33 |
| C01-06 | CRSI recovery long + 1h ER veto | $8,684 -> $6,434 | -$2,250 | $6,272 -> $6,272 | $0 | 8.68% -> 10.32% | 134/33 |
| C01-17 | MACD long + 4h DMI | $8,270 -> $6,279 | -$1,991 | $2,587 -> $1,951 | -$635 | 7.28% -> 4.53% | 43/11 |
| C01-19 | MACD long + 1h RVOL | $8,270 -> $5,813 | -$2,456 | $2,587 -> $1,203 | -$1,384 | 7.28% -> 2.29% | 19/6 |
| C01-23 | MACD short + 1h RVOL | $2,000 -> -$1,666 | -$3,666 | $1,933 -> $349 | -$1,584 | 15.17% -> 9.44% | 22/4 |
| C01-13 | CMF continuation long + 4h DMI | $10,186 -> $5,590 | -$4,596 | $8,238 -> $6,809 | -$1,429 | 15.66% -> 17.62% | 321/88 |
| C01-03 | CRSI extreme long + 1h RVOL | $11,044 -> $6,259 | -$4,785 | $6,603 -> $3,236 | -$3,367 | 15.46% -> 13.78% | 58/11 |
| C01-16 | CMF continuation long + 1h day VWAP | $10,186 -> $5,272 | -$4,915 | $8,238 -> $4,186 | -$4,052 | 15.66% -> 26.15% | 393/108 |
| C01-12 | MFI dip long + 1h day VWAP | $13,112 -> $6,781 | -$6,331 | $3,957 -> $2,480 | -$1,477 | 10.19% -> 16.91% | 142/42 |
| C01-05 | CRSI recovery long + 4h DMI | $8,684 -> $1,848 | -$6,836 | $6,272 -> $3,528 | -$2,744 | 8.68% -> 10.03% | 75/20 |
| C01-08 | CRSI recovery long + 1h day VWAP | $8,684 -> $1,603 | -$7,082 | $6,272 -> $1,183 | -$5,089 | 8.68% -> 4.01% | 20/6 |
| C01-09 | MFI dip long + 4h DMI | $13,112 -> $5,820 | -$7,291 | $3,957 -> $2,025 | -$1,932 | 10.19% -> 10.68% | 249/65 |
| C01-04 | CRSI extreme long + 1h day VWAP | $11,044 -> $3,374 | -$7,670 | $6,603 -> $2,407 | -$4,196 | 15.46% -> 4.00% | 30/9 |
| C01-01 | CRSI extreme long + 4h DMI | $11,044 -> $2,443 | -$8,601 | $6,603 -> $3,678 | -$2,925 | 15.46% -> 10.51% | 77/20 |
| C01-15 | CMF continuation long + 1h RVOL | $10,186 -> -$306 | -$10,492 | $8,238 -> $2,740 | -$5,498 | 15.66% -> 21.69% | 201/50 |
| C01-11 | MFI dip long + 1h RVOL | $13,112 -> -$4,935 | -$18,046 | $3,957 -> -$1,041 | -$4,998 | 10.19% -> 22.73% | 143/37 |

### +1m on BOTH entries and exits

No threshold was retuned for the delayed case. Extra-cost stress net is after
an additional 5bps per side on that case's fixed trade path.

| ID | Full parent -> pair | Full delta | Recent parent -> pair | Recent delta | Full DD parent -> pair | Stress net full / recent |
| --- | --- | --- | --- | --- | --- | --- |
| C01-30 | $957 -> $2,389 | $1,432 | $2,154 -> $2,246 | $92 | 7.31% -> 3.94% | $2,101 / $2,138 |
| C01-31 | $957 -> $1,967 | $1,010 | $2,154 -> $1,275 | -$879 | 7.31% -> 2.59% | $1,838 / $1,226 |
| C01-20 | $8,632 -> $8,689 | $57 | $2,603 -> $2,680 | $77 | 7.40% -> 7.32% | $7,844 / $2,468 |
| C01-18 | $8,632 -> $8,632 | $0 | $2,603 -> $2,603 | $0 | 7.40% -> 7.40% | $7,737 / $2,361 |
| C01-22 | $1,547 -> $1,547 | $0 | $2,114 -> $2,114 | $0 | 15.49% -> 15.49% | $649 / $1,866 |
| C01-26 | $1,617 -> $1,617 | $0 | $1,691 -> $1,691 | $0 | 7.15% -> 7.15% | $1,008 / $1,542 |
| C01-14 | $7,122 -> $7,205 | $83 | $7,718 -> $8,712 | $994 | 23.33% -> 26.22% | $1,378 / $7,217 |
| C01-25 | $1,617 -> $1,279 | -$338 | $1,691 -> $1,759 | $68 | 7.15% -> 7.52% | $710 / $1,630 |
| C01-28 | $1,617 -> $1,152 | -$465 | $1,691 -> $1,607 | -$84 | 7.15% -> 7.82% | $573 / $1,468 |
| C01-32 | $957 -> $66 | -$891 | $2,154 -> $134 | -$2,020 | 7.31% -> 1.56% | $36 / $124 |
| C01-24 | $1,547 -> $880 | -$667 | $2,114 -> $2,114 | $0 | 15.49% -> 16.04% | $21 / $1,866 |
| C01-29 | $957 -> -$84 | -$1,042 | $2,154 -> $0 | -$2,154 | 7.31% -> 1.17% | -$95 / $0 |
| C01-10 | $10,761 -> $9,422 | -$1,339 | $3,311 -> $2,939 | -$372 | 12.61% -> 13.06% | $5,125 / $1,916 |
| C01-07 | $7,744 -> $6,448 | -$1,296 | $6,023 -> $4,663 | -$1,360 | 9.31% -> 6.62% | $5,654 / $4,470 |
| C01-27 | $1,617 -> $169 | -$1,447 | $1,691 -> $802 | -$888 | 7.15% -> 7.46% | -$80 / $743 |
| C01-21 | $1,547 -> -$257 | -$1,805 | $2,114 -> $1,459 | -$655 | 15.49% -> 13.42% | -$787 / $1,320 |
| C01-02 | $10,773 -> $8,664 | -$2,109 | $6,222 -> $6,222 | $0 | 15.16% -> 14.99% | $7,299 / $5,878 |
| C01-06 | $7,744 -> $5,491 | -$2,253 | $6,023 -> $6,023 | $0 | 9.31% -> 10.98% | $4,137 / $5,680 |
| C01-17 | $8,632 -> $6,374 | -$2,257 | $2,603 -> $1,942 | -$661 | 7.40% -> 4.68% | $5,951 / $1,831 |
| C01-19 | $8,632 -> $5,708 | -$2,924 | $2,603 -> $1,223 | -$1,380 | 7.40% -> 2.44% | $5,515 / $1,162 |
| C01-23 | $1,547 -> -$1,696 | -$3,244 | $2,114 -> $445 | -$1,670 | 15.49% -> 9.72% | -$1,917 / $405 |
| C01-13 | $7,122 -> $5,936 | -$1,186 | $7,718 -> $6,432 | -$1,286 | 23.33% -> 17.68% | $2,821 / $5,558 |
| C01-03 | $10,773 -> $6,052 | -$4,721 | $6,222 -> $2,854 | -$3,368 | 15.16% -> 13.46% | $5,469 / $2,743 |
| C01-16 | $7,122 -> $6,317 | -$805 | $7,718 -> $4,751 | -$2,967 | 23.33% -> 26.42% | $2,442 / $3,688 |
| C01-12 | $10,761 -> $6,140 | -$4,621 | $3,311 -> $2,213 | -$1,098 | 12.61% -> 16.79% | $4,736 / $1,792 |
| C01-05 | $7,744 -> $1,536 | -$6,208 | $6,023 -> $3,493 | -$2,530 | 9.31% -> 10.35% | $775 / $3,281 |
| C01-08 | $7,744 -> $1,625 | -$6,119 | $6,023 -> $1,210 | -$4,813 | 9.31% -> 4.01% | $1,425 / $1,149 |
| C01-09 | $10,761 -> $5,221 | -$5,540 | $3,311 -> $1,541 | -$1,770 | 12.61% -> 11.96% | $2,747 / $900 |
| C01-04 | $10,773 -> $3,269 | -$7,504 | $6,222 -> $2,354 | -$3,868 | 15.16% -> 3.98% | $2,967 / $2,263 |
| C01-01 | $10,773 -> $2,381 | -$8,391 | $6,222 -> $3,503 | -$2,719 | 15.16% -> 9.58% | $1,600 / $3,291 |
| C01-15 | $7,122 -> -$1,088 | -$8,211 | $7,718 -> $2,070 | -$5,648 | 23.33% -> 21.78% | -$3,069 / $1,578 |
| C01-11 | $10,761 -> -$5,142 | -$15,904 | $3,311 -> -$1,520 | -$4,830 | 12.61% -> 23.02% | -$6,571 / -$1,889 |

## 4. What deserves remembering

### C01-30: a narrow OBV-short improvement, not a qualified producer

A8 alone versus A8 + B2:

- Full/immediate: $753 -> $2,286; DD 7.19% -> 3.93%; 38 -> 29 completed trades.
- Full/+1m: $957 -> $2,389; DD 7.31% -> 3.94%; 36 -> 28 completed trades.
- Recent/immediate: $2,071 -> $2,194; recent/+1m: $2,154 -> $2,246.
  Only 10 recent combination closes in each delay.
- Full/immediate avoids $2,235 of losing-parent trades but sacrifices $702 of
  winners: net +$1,533. It removes 9 completed parent trades; no newly enabled
  trades in that panel. Worst monthly delta is -$163, inside the $320 budget.

This is the clearest mechanism worth preserving: avoid fading up-volume when
the hourly20-bar path is efficiently rising. **But** full n 29/28 is below 30,
recent improvement +$123/+92 is below the predeclared +$200 requirement, and
recent risk does not beat the exposure-scaled parent under the defensive rule.
Its five largest winners are 109% of full closed net; a few outcomes still
matter substantially. Worst observed adverse short price movement is 10.04%,
despite the lower account DD.

Disposition: **small-sample / below -budget watchlist**, not live-qualified and
not promoted by lowering n or the recent-dollar floor after looking. Merely
obtaining a30th trade would not erase the other failures or establish a durable edge.

### C01-20: adding VWAP to the MACD long helps slightly

Full parent deltas are +$157 immediate and +$57 delayed. Recent deltas are
+$105 and +$77. Full DD improves by only about 0.08 percentage points.

It removes 5 full/immediate trades: $592 avoided losing dollars versus $434
missed winning dollars. This is directionally positive, but too small for the
+$500 full /+$200 recent budgets. February 2026 delayed monthly equity is $390
below the parent (unrounded -$390.10), outside the $320 ceiling. Full risk also
does not improve enough to qualify defensively.

Disposition: **small positive descriptive change, budget failure**. Do not
inflate it into proof of an important ladder enhancement.

### C01-14: recent CMF improvement is not a full-history improvement

CMF long + ER veto improves recent net by +$596 immediate /+$994 delayed and
recent DD 7.41% -> 6.12% immediate. Across full history the deltas are -$92 /+$83,
and full DD worsens15.66% -> 18.08% immediate,23.33% -> 26.22% delayed.

Why a mask of old trades would mislead: full/immediate removes 19 parent
trades, avoiding $2,374 of losses and sacrificing $675 of winners, apparently
+$1,699. But changed occupancy enables 8 different trades with net -$1,792.
The actual complete-path delta is **-$92**, not +$1,699.

Disposition: **fails full-history risk/monthly requirements**; do not select
the recent panel and discard the earlier months.

### C01-07: CRSI recovery + RVOL reduces DD, but misses too much profit

Full/immediate baseline $8,684 -> $7,215; DD 8.68% -> 6.18%; 142 -> 78 closes.
Recent $6,272 -> $4,885, retaining only 78%, below the agreed 90% minimum.
The full exposure ratio is 55%; an exposure-rescaled parent has 4.94% DD versus
the pair's6.18%, so it does not satisfy the added-defense diagnostic either.

The full path removes 77 parent trades, sacrificing $9,393 of winners while
avoiding $8,603 of losses, and adds 13 new trades costing another $679 net.
A higher return per dollar-hour can still be interesting, but it is a different
objective from passing this frozen profit-retention/drawdown screen.

Disposition: **defensive trade-off outside the agreed budget**, not a useless
indicator family and not a qualified loss-reduction patch.

### Three combinations have no executed-path effect

C01-18 (MACD long + ER), C01-22 (MACD short + ER) and C01-26 (ADX short + ER)
reproduce their parent trade paths/results in all four cases. The chosen veto
adds no demonstrated trade selection here. This is a finding about these
exact clocks, thresholds and triggers, not every possible efficiency condition.

## 5. Side observation: an entry filter can create crash exposure

C01-11, MFI dip long + RVOL, is the clearest harmful example. Full/immediate
parent net **+$13,112** becomes **-$4,935**; DD 10.19% becomes 22.73%.
It avoids $34,937 of losses but misses $51,322 of winning-parent trades;64 newly
enabled trades lose another $1,661 net. The full delta is **-$18,046**.

Exact October 10, 2025 path, UTC:

| Event | Unfiltered MFI parent | MFI + RVOL |
|---|---|---|
| 05:45 entry opportunity | Opens at 43.716 | Different earlier selection/path |
| 15:45 new MFI crossing | Already occupied; skips | Opens at 43.290 |
| 17:45 | Original12h trade closes, -$186 | Still holding its later entry |
| 21:21 extreme low20.784 | Flat | About51.99% adverse price move from its entry |
| 21:30 rebound crossing | Opens at 34.812; later closes +$1,643 | Still occupied; cannot take the same recovery |
| Oct11 03:45 | Holding its later rebound trade | Timed exit at 37.607, -$1,323 |

At the pair's15:45 decision, MFI7 was4.4973 from the completed 15:30-15:45 bar.
The RVOL context was the completed 14:00-15:00 hourly bar, value 2.1911, already
known by 15:00. No15:45 execution-minute high/low or future hour was consulted.

This is not a claim about actual live trades or leverage survivability. It is
a verified standalone path showing why fewer entries are **not automatically**
safer and why the entire post-filter sequence must be replayed. It also does
not license rejecting all volume conditions from this one example; the aggregate
C01-11 results and monthlies independently fail the budgets.

## 6. Causal decision trace

For C01-30's first gate rejection, July 11, 2025 08:00 UTC:

| Item | Evidence available at decision |
|---|---|
| A source | Completed 4h 04:00-08:00 bar; available08:00 |
| A trigger | Normalized OBV40 crosses above 0.25; current 0.29839824 |
| B source | Completed 1h 07:00-08:00 bar; available08:00 |
| B value | Signed ER20 = +0.66939053 |
| Short veto test | Requires ER <+0.5; false |
| Outcome | Skip this crossing permanently; no later catch-up entry |

The +1m case delays execution, not this recorded feature decision. Expected
higher-timeframe bars, source availability, previous/current bars, null handling
and every occupied/rejected crossing were independently reconstructed. At
midnight VWAP uses the closed source bar's own UTC-day anchor, not a forming
new-day VWAP.

## 7. Top-five monthly regime tables

These are the **top five by the predeclared full-delta ranking**, not five
qualifiers. Two have no executed effect; their zero-delta rows are retained
rather than replacing them with hand-picked alternatives. Every table shows
the original baseline and pair side by side, in both execution-delay models.
All other definitions' full/recent monthlies are in the accepted monthly CSV.

Each row is monthly **marked equity PnL**, not only exit-month realized profit.
Recent May starts May 17 20:43; September ends September 4 19:01. Full/recent
panels can differ because of their different starting-flat state.

### C01-30: OBV fade short + 1h ER veto


full window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | $37 | $402 | $365 | $111 | $436 | $325 |
| 2025-08 | -$414 | -$414 | $0 | -$349 | -$349 | $0 |
| 2025-09 | $351 | $230 | -$120 | $380 | $246 | -$135 |
| 2025-10 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2025-11 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2025-12 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2026-01 | -$1,123 | $0 | $1,123 | -$1,109 | $0 | $1,109 |
| 2026-02 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2026-03 | -$107 | -$107 | $0 | -$175 | -$175 | $0 |
| 2026-04 | -$268 | -$268 | $0 | -$243 | -$243 | $0 |
| 2026-05 | $1,447 | $1,349 | -$99 | $1,434 | $1,311 | -$123 |
| 2026-06 | $995 | $995 | $0 | $1,006 | $1,006 | $0 |
| 2026-07 | -$209 | -$209 | $0 | -$148 | -$148 | $0 |
| 2026-08 | -$180 | $85 | $264 | -$156 | $100 | $256 |
| 2026-09 | $223 | $223 | $0 | $206 | $206 | $0 |

recent window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | $1,241 | $1,100 | -$141 | $1,246 | $1,082 | -$163 |
| 2026-06 | $995 | $995 | $0 | $1,006 | $1,006 | $0 |
| 2026-07 | -$209 | -$209 | $0 | -$148 | -$148 | $0 |
| 2026-08 | -$180 | $85 | $264 | -$156 | $100 | $256 |
| 2026-09 | $223 | $223 | $0 | $206 | $206 | $0 |

### C01-31: OBV fade short + 1h RVOL


full window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | $37 | $402 | $365 | $111 | $436 | $325 |
| 2025-08 | -$414 | $0 | $414 | -$349 | $0 | $349 |
| 2025-09 | $351 | $118 | -$232 | $380 | $117 | -$263 |
| 2025-10 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2025-11 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2025-12 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2026-01 | -$1,123 | $0 | $1,123 | -$1,109 | $0 | $1,109 |
| 2026-02 | $0 | $0 | $0 | $0 | $0 | $0 |
| 2026-03 | -$107 | $342 | $449 | -$175 | $305 | $480 |
| 2026-04 | -$268 | -$104 | $164 | -$243 | -$125 | $118 |
| 2026-05 | $1,447 | $919 | -$529 | $1,434 | $948 | -$486 |
| 2026-06 | $995 | $442 | -$553 | $1,006 | $442 | -$563 |
| 2026-07 | -$209 | $0 | $209 | -$148 | $0 | $148 |
| 2026-08 | -$180 | -$180 | $0 | -$156 | -$156 | $0 |
| 2026-09 | $223 | $0 | -$223 | $206 | $0 | -$206 |

recent window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | $1,241 | $961 | -$281 | $1,246 | $989 | -$257 |
| 2026-06 | $995 | $442 | -$553 | $1,006 | $442 | -$563 |
| 2026-07 | -$209 | $0 | $209 | -$148 | $0 | $148 |
| 2026-08 | -$180 | -$180 | $0 | -$156 | -$156 | $0 |
| 2026-09 | $223 | $0 | -$223 | $206 | $0 | -$206 |

### C01-20: MACD long + 1h day VWAP


full window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -$20 | $369 | $388 | -$21 | $350 | $370 |
| 2025-08 | $92 | $92 | $0 | $2 | $2 | $0 |
| 2025-09 | -$117 | -$117 | $0 | -$100 | -$100 | $0 |
| 2025-10 | $730 | $730 | $0 | $835 | $835 | $0 |
| 2025-11 | $1,004 | $1,004 | $0 | $1,043 | $1,043 | $0 |
| 2025-12 | $320 | $320 | $0 | $255 | $255 | $0 |
| 2026-01 | $1,092 | $1,092 | $0 | $1,176 | $1,176 | $0 |
| 2026-02 | $1,344 | $1,008 | -$336 | $1,361 | $971 | -$390 |
| 2026-03 | $437 | $437 | $0 | $495 | $495 | $0 |
| 2026-04 | $243 | $243 | $0 | $523 | $523 | $0 |
| 2026-05 | $1,244 | $1,244 | $0 | $1,124 | $1,124 | $0 |
| 2026-06 | $755 | $958 | $203 | $757 | $941 | $184 |
| 2026-07 | $20 | -$3 | -$23 | $58 | $39 | -$18 |
| 2026-08 | $859 | $784 | -$75 | $870 | $781 | -$89 |
| 2026-09 | $266 | $266 | $0 | $255 | $255 | $0 |

recent window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | $687 | $687 | $0 | $664 | $664 | $0 |
| 2026-06 | $755 | $958 | $203 | $757 | $941 | $184 |
| 2026-07 | $20 | -$3 | -$23 | $58 | $39 | -$18 |
| 2026-08 | $859 | $784 | -$75 | $870 | $781 | -$89 |
| 2026-09 | $266 | $266 | $0 | $255 | $255 | $0 |

### C01-18: MACD long + 1h ER veto


full window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -$20 | -$20 | $0 | -$21 | -$21 | $0 |
| 2025-08 | $92 | $92 | $0 | $2 | $2 | $0 |
| 2025-09 | -$117 | -$117 | $0 | -$100 | -$100 | $0 |
| 2025-10 | $730 | $730 | $0 | $835 | $835 | $0 |
| 2025-11 | $1,004 | $1,004 | $0 | $1,043 | $1,043 | $0 |
| 2025-12 | $320 | $320 | $0 | $255 | $255 | $0 |
| 2026-01 | $1,092 | $1,092 | $0 | $1,176 | $1,176 | $0 |
| 2026-02 | $1,344 | $1,344 | $0 | $1,361 | $1,361 | $0 |
| 2026-03 | $437 | $437 | $0 | $495 | $495 | $0 |
| 2026-04 | $243 | $243 | $0 | $523 | $523 | $0 |
| 2026-05 | $1,244 | $1,244 | $0 | $1,124 | $1,124 | $0 |
| 2026-06 | $755 | $755 | $0 | $757 | $757 | $0 |
| 2026-07 | $20 | $20 | $0 | $58 | $58 | $0 |
| 2026-08 | $859 | $859 | $0 | $870 | $870 | $0 |
| 2026-09 | $266 | $266 | $0 | $255 | $255 | $0 |

recent window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | $687 | $687 | $0 | $664 | $664 | $0 |
| 2026-06 | $755 | $755 | $0 | $757 | $757 | $0 |
| 2026-07 | $20 | $20 | $0 | $58 | $58 | $0 |
| 2026-08 | $859 | $859 | $0 | $870 | $870 | $0 |
| 2026-09 | $266 | $266 | $0 | $255 | $255 | $0 |

### C01-22: MACD short + 1h ER veto


full window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | $1,252 | $1,252 | $0 | $1,219 | $1,219 | $0 |
| 2025-08 | -$1,232 | -$1,232 | $0 | -$1,231 | -$1,231 | $0 |
| 2025-09 | -$1,507 | -$1,507 | $0 | -$1,455 | -$1,455 | $0 |
| 2025-10 | -$315 | -$315 | $0 | -$517 | -$517 | $0 |
| 2025-11 | -$140 | -$140 | $0 | -$206 | -$206 | $0 |
| 2025-12 | $177 | $177 | $0 | $146 | $146 | $0 |
| 2026-01 | $621 | $621 | $0 | $535 | $535 | $0 |
| 2026-02 | $1,224 | $1,224 | $0 | $1,197 | $1,197 | $0 |
| 2026-03 | $102 | $102 | $0 | $125 | $125 | $0 |
| 2026-04 | $64 | $64 | $0 | -$178 | -$178 | $0 |
| 2026-05 | $325 | $325 | $0 | $394 | $394 | $0 |
| 2026-06 | $454 | $454 | $0 | $502 | $502 | $0 |
| 2026-07 | $1,389 | $1,389 | $0 | $1,379 | $1,379 | $0 |
| 2026-08 | -$590 | -$590 | $0 | -$547 | -$547 | $0 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |

recent window (each panel has its own starting-flat state):

| Month UTC | Parent 0m | Pair 0m | Delta 0m | Parent +1m | Pair +1m | Delta +1m |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | $503 | $503 | $0 | $595 | $595 | $0 |
| 2026-06 | $454 | $454 | $0 | $502 | $502 | $0 |
| 2026-07 | $1,389 | $1,389 | $0 | $1,379 | $1,379 | $0 |
| 2026-08 | -$590 | -$590 | $0 | -$547 | -$547 | $0 |
| 2026-09 | $176 | $176 | $0 | $186 | $186 | $0 |

## 8. Exact acceptance failures

Common requirements: sample>=30 full/10 recent in each delay; positive net and
extra-cost net; no equity exhaustion; no monthly parent/availability regression
below -$320. Profit additionally needs +$500 full/+$200 recent and no worse DD.
Defense requires 90% profit retention, reduced losing dollars, full DD reduction
>=20% relative and>=1 percentage point, no recent DD worsening, and a better
DD/loss result than exposure scaling. The separate inherited strict clock
screen remains unchanged. No criteria were relaxed after running.

| ID | Common research failures | Profit-only failures | Defensive-only failures |
| --- | --- | --- | --- |
| C01-30 | insufficient_trade_count | increment_below_500_full_or_200_recent | selection_not_better_than_exposure_scaling |
| C01-31 | insufficient_trade_count; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | selection_not_better_than_exposure_scaling; profit_retention_below_90pct |
| C01-20 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-18 | none | increment_below_500_full_or_200_recent | losing_dollars_not_reduced; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-22 | none | increment_below_500_full_or_200_recent | losing_dollars_not_reduced; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-26 | none | increment_below_500_full_or_200_recent | losing_dollars_not_reduced; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-14 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-25 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-28 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; losing_dollars_not_reduced |
| C01-32 | insufficient_trade_count; nonpositive_net; extra_cost_stress_nonpositive; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-24 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; losing_dollars_not_reduced |
| C01-29 | insufficient_trade_count; nonpositive_net; extra_cost_stress_nonpositive; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-10 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; profit_retention_below_90pct; losing_dollars_not_reduced |
| C01-07 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-27 | insufficient_trade_count; monthly_parent_regression_over_320; extra_cost_stress_nonpositive | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-21 | extra_cost_stress_nonpositive; monthly_parent_regression_over_320; nonpositive_net | increment_below_500_full_or_200_recent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-02 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; losing_dollars_not_reduced |
| C01-06 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; losing_dollars_not_reduced |
| C01-17 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-19 | insufficient_trade_count; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-23 | insufficient_trade_count; nonpositive_net; extra_cost_stress_nonpositive; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-13 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-03 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-16 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-12 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-05 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-08 | insufficient_trade_count; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-09 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; recent_drawdown_worse |
| C01-04 | monthly_parent_regression_over_320; insufficient_trade_count | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-01 | monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent | profit_retention_below_90pct; selection_not_better_than_exposure_scaling |
| C01-15 | nonpositive_net; extra_cost_stress_nonpositive; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling |
| C01-11 | nonpositive_net; extra_cost_stress_nonpositive; monthly_parent_regression_over_320 | increment_below_500_full_or_200_recent; drawdown_worse_than_parent | profit_retention_below_90pct; full_drawdown_reduction_insufficient; selection_not_better_than_exposure_scaling; recent_drawdown_worse |

Both shortlists are empty. **No automatic twelve-refinement expansion** is
justified by claiming something passed. C01-30 stays a documented small-sample
hypothesis; C01-20 stays a small positive change. Any later change in objective,
budget, timing or thresholds needs its own bounded card and preservation of
these failed/sparse results. Negative findings apply to the 32 exact pairs,
not to every combination of these indicators.

## 9. Reproducibility and validation

- Raw live JSONL had grown from 23,021,958 to23,321,778 bytes. Its first
  23,021,958 bytes matched the original I01 SHA-256 exactly. The runner copied
  that exact prefix into the new local artifact inputs directory, along with
  verified full/repair files. Current data and historical accepted folders
  were not overwritten. This was snapshot recovery, **not a rebaseline**.
- The first attempt stopped on an archive serialization assertion: JSON
  normalizes JavaScript negative zero. Only comparison with saved JSON was
  changed to serialized exact equality; in-memory original/new engine parity
  still uses exact deep equality. The incomplete unversioned folder is not
  accepted evidence. **Use the v2 folder linked above.**
- 14 C01 fixture groups passed: mixed clocks, expected missing/late bars,
  zero/null/boundaries, midnight VWAP, RVOL denominator, no catch-up, changed
  occupancy, frozen delayed entry, actual-fill timeout, same-time ordering,
  pending cutoff, prefix/future mutation and invalid input rejection.
- Reused indicator formula tests:12 shared-feature groups,8 ADX/DMI,8
  ATR/efficiency,8 VWAP/volume,10 volume-flow. Existing formula/engine sources
  were not edited.
- Actual-data prefix checks:32 feature/opportunity/condition comparisons and
  32 complete combination path comparisons through August 1, 2026.
- All 64 repeated archived control cases match ledgers, months and statistics;
  56 non-clock cases additionally match the new all-true engine exactly.
- 192 primary cases plus128 logical readiness cases; all 128 readiness cases
  reuse equal parents, no extra economic hypotheses. Independent verifier
  reconstructs all 320 logical cases, including separate formula calculations,
  every entry opportunity/gate and complete minute/month equity.
- Independent verification: 37,253 trade rows,75,062 crossing rows,3,200 monthly
  rows; source/artifact hashes match. The original validation file's
  independentVerificationPending flag records generation time; the separately
  added verification.json with passed=true is the final acceptance evidence.
- Focused strict TypeScript compilation, repository typecheck and VPS typecheck
  passed. Live config, state and owner-source hashes remain unchanged.

## 10. Scope decision and reusable conclusions

**No live or ladder change from C01.** There are no promoted profit or defensive
survivors under the approved criteria. Preserve C01-30's narrow mechanism and
C01-20's small gain without relabeling them as qualified strategies.

The reusable information is more specific than “combinations do not work”:
slow directional context often removes profitable dip/rebound entries; this
particular RVOL condition can change entry timing unfavorably; the lenient ER
veto is redundant for three parents; and one contrarian OBV short is sensitive
to an efficiently rising path. These statements describe the measured pairs,
not universal rules.

The original sequence still stands: bounded individual/pair work, selected
refinement if warranted, then decision-specific HL/S/R and ladder replays.
A positive standalone score cannot be added to ladder PnL, and a research
short does not authorize unpausing the live short owner.

Counts now **5,192 distinct standalone definitions**, of which32 are the new
C01 combinations and 5,160 are the prior I01-I11 definitions. **45 ladder
definitions remain unchanged.** All tested parameters/IDs and failed conditions
are retained so these exact scans need not be repeated.
