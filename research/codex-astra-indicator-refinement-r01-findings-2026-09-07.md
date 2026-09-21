# R01: selected indicator-mechanism refinements

September 7, 2026. **Verified local research; no live changes.**
This completes the first checkpoint of the approved refinement → HL/S/R → actual-ladder sequence.
HL/S/R mixtures and ladder transfer have **not** been run in R01.

## TL;DR

- **Nine new one-axis rules, one profit-screen survivor: R01-08.** Short a fresh 4h Bollinger downside crossing only when the latest closed 1h CMF20 is below −0.05. Immediate full net: unfiltered **$2,864.82 → old CMF<0 pair $3,425.55 → refined $4,087.21**; recent **$906.64 → $954.13 → $1,190.58**. Both delayed cases also pass the unchanged profit screen.
- **The evidence is sparse and concentrated:** 54 full /11 recent closes immediate; 47 /11 delayed. Relative to the old pair, five full trades are removed and just **one recent trade**, June 22, supplies all the additional recent profit. Zero defensive or strict-clock qualifiers. This is an entry-selection lead, not demonstrated crash protection.
- **Baselines and causality verified:** 32 archived parent/pair/clock cases match exactly; all 116 logical cases independently checked. No entries/exits/sizing changed apart from the nine gates. The next checkpoint is known-time HL/S/R coverage and context; a profitable standalone short does not automatically justify blocking the long ladder.

## 1. Comparison contract

| Item | Fixed setting |
|---|---|
| Full window | **2025-07-01 00:00 → 2026-09-04 19:01 UTC** |
| Recent window | **2026-05-17 20:43 → 2026-09-04 19:01 UTC**, starts flat |
| Indicator seed | 2025-06-01 00:00 UTC |
| Input | Same accepted repaired T02 snapshot; 663,541 continuous 1m bars including seed |
| Position | One independent $10,000-notional position per rule; $32,000 reference equity |
| Exit | Fixed 12h from actual entry, no TP/SL, no averaging |
| Fill models | First eligible minute open; separate +1m delay on both entry and exit |
| Fees | 0.055% each side; extra-cost column adds another 5bps each side on the same path |
| Scope | Before funding, no maker queue simulation, no portfolio or live ladder dollars |

Full and recent overlap and were already examined in previous studies. They are
not independent samples or untouched out-of-sample tests. All selected paths
finish flat; open marked PnL is $0 in every row below. DD is the inherited
minute-adverse-price drawdown against close-marked peaks, not exchange liquidation
or a guaranteed intraminute worst-case ordering.

A filter gets a fresh occupancy replay; these results are not obtained by
simply deleting parent trades. Context-readiness-only controls were actually
run for all 12 pair versions × four cases, and all 48 equal the unfiltered
parent paths. Thus the parent columns are also the correct readiness baselines.

## 2. Exact scope: three mechanisms, three changes each

The MACD anchors are 4h MACD12/26/9 histogram zero crossings: upward for V,
downward for A. The Bollinger anchor is a 4h Bollinger20/2 downside crossing:
previous %B≥0 and current %B<0. Strict/inclusive comparisons below are intentional.

| Mechanism | Old pair, reproduced | New IDs and exact single change |
|---|---|---|
| V: MACD long + VWAP | C01-20: closed 1h close distance from its own UTC-day VWAP >0% | R01-01: >−0.25%; R01-02: >+0.25%; R01-03: 30m context, >0% |
| A: MACD short + shock veto | C02-27: absolute 1h close change / preceding ATR14 ≤1 | R01-04: ≤0.75; R01-05: ≤1.25; R01-06: 30m context, ≤1 |
| C: Bollinger short + CMF | C02-32: closed 1h CMF20 <0 | R01-07: <+0.05; R01-08: <−0.05; R01-09: 30m CMF20 <0 |

VWAP uses actual turnover/volume, not a typical-price approximation. Its UTC-day
anchor belongs to the completed source bar, including at midnight. ATR is from
the **previous** bar; a shock cannot enlarge its own denominator. CMF is
volume-weighted candle close location, **not** observed HL aggressor flow.

The three original pairs had positive increments in both windows/delays but
failed previously frozen budgets. This card tests neighboring strength and one
alternate context clock. It does not add an entry-family grid, calendar rules,
new exits, sequences or cross-products. T02's MFI clock cases remain frozen;
sample-limited C01-30 OBV remains parked, not rejected. The unused three slots
under the earlier 12-definition ceiling were not filled automatically.

## 3. Baseline-first results: immediate fills

W/L counts sum to completed trades; winning and losing dollars are after modeled
fees. Δ old pair isolates this refinement from improvement already achieved in C01/C02.

### Full: July 1, 2025 → September 4, 2026

#### V: MACD 4h long + VWAP

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 51 / 39 | $18,549.43 | −$10,279.90 | $8,269.53 | — | — | 7.28% | $7,364.90 |
| C01-20 | 48 / 37 | $18,115.00 | −$9,688.17 | $8,426.83 | +$157.30 | $0.00 | 7.19% | $7,572.14 |
| R01-01 | 50 / 37 | $18,213.28 | −$9,688.17 | $8,525.11 | +$255.58 | +$98.29 | 7.19% | $7,650.37 |
| R01-02 | 48 / 35 | $18,115.00 | −$9,221.91 | $8,893.08 | +$623.55 | +$466.26 | 7.19% | $8,058.18 |
| R01-03 | 48 / 37 | $18,115.00 | −$9,688.17 | $8,426.83 | +$157.30 | $0.00 | 7.19% | $7,572.14 |

#### A: MACD 4h short + prior-ATR shock veto

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 47 / 44 | $12,939.24 | −$10,939.58 | $1,999.66 | — | — | 15.17% | $1,091.16 |
| C02-27 | 42 / 37 | $11,558.87 | −$8,159.82 | $3,399.05 | +$1,399.39 | $0.00 | 10.13% | $2,611.19 |
| R01-04 | 38 / 34 | $11,052.10 | −$8,055.27 | $2,996.82 | +$997.16 | −$402.23 | 10.03% | $2,278.72 |
| R01-05 | 43 / 41 | $11,890.21 | −$10,280.94 | $1,609.27 | −$390.39 | −$1,789.79 | 15.34% | $770.53 |
| R01-06 | 44 / 40 | $12,180.11 | −$10,343.21 | $1,836.90 | −$162.76 | −$1,562.15 | 15.45% | $998.28 |

#### C: Bollinger 4h breakdown short + CMF

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 35 / 32 | $8,498.70 | −$5,633.87 | $2,864.82 | — | — | 12.35% | $2,196.62 |
| C02-32 | 32 / 27 | $8,005.12 | −$4,579.58 | $3,425.55 | +$560.72 | $0.00 | 12.31% | $2,837.58 |
| R01-07 | 32 / 30 | $8,005.12 | −$5,385.61 | $2,619.51 | −$245.31 | −$806.03 | 12.40% | $2,001.16 |
| R01-08 | 31 / 23 | $7,972.09 | −$3,884.88 | $4,087.21 | +$1,222.38 | +$661.66 | 12.22% | $3,549.55 |
| R01-09 | 32 / 29 | $7,573.08 | −$5,059.41 | $2,513.67 | −$351.15 | −$911.87 | 12.86% | $1,905.27 |

### Recent: May 17 → September 4, 2026

#### V: MACD 4h long + VWAP

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 13 / 11 | $4,451.52 | −$1,864.80 | $2,586.72 | — | — | 2.84% | $2,345.29 |
| C01-20 | 11 / 10 | $4,353.23 | −$1,661.39 | $2,691.84 | +$105.12 | $0.00 | 2.59% | $2,480.37 |
| R01-01 | 13 / 10 | $4,451.52 | −$1,661.39 | $2,790.12 | +$203.41 | +$98.29 | 2.71% | $2,558.60 |
| R01-02 | 11 / 9 | $4,353.23 | −$1,384.92 | $2,968.31 | +$381.59 | +$276.47 | 2.37% | $2,766.71 |
| R01-03 | 11 / 10 | $4,353.23 | −$1,661.39 | $2,691.84 | +$105.12 | $0.00 | 2.59% | $2,480.37 |

#### A: MACD 4h short + prior-ATR shock veto

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 13 / 12 | $3,426.00 | −$1,493.24 | $1,932.76 | — | — | 3.71% | $1,683.87 |
| C02-27 | 12 / 9 | $3,094.67 | −$1,075.43 | $2,019.23 | +$86.47 | $0.00 | 3.36% | $1,810.36 |
| R01-04 | 11 / 7 | $3,004.95 | −$1,011.13 | $1,993.81 | +$61.05 | −$25.42 | 3.19% | $1,814.91 |
| R01-05 | 13 / 11 | $3,426.00 | −$1,460.65 | $1,965.35 | +$32.59 | −$53.88 | 3.71% | $1,726.47 |
| R01-06 | 13 / 9 | $3,426.00 | −$1,276.89 | $2,149.11 | +$216.35 | +$129.88 | 3.45% | $1,930.30 |

#### C: Bollinger 4h breakdown short + CMF

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 8 / 5 | $1,589.94 | −$683.31 | $906.64 | — | — | 3.76% | $777.16 |
| C02-32 | 8 / 4 | $1,589.94 | −$635.81 | $954.13 | +$47.49 | $0.00 | 3.76% | $834.67 |
| R01-07 | 8 / 5 | $1,589.94 | −$683.31 | $906.64 | $0.00 | −$47.49 | 3.76% | $777.16 |
| R01-08 | 8 / 3 | $1,589.94 | −$399.36 | $1,190.58 | +$283.94 | +$236.45 | 3.05% | $1,081.23 |
| R01-09 | 8 / 4 | $1,589.94 | −$593.32 | $996.62 | +$89.98 | +$42.49 | 3.76% | $877.18 |

## 4. All nine new rules, ranked by worst-delay full increment

Ranking uses the smaller full-window increment across the two delay cases, not
the most flattering raw total. Recent and old-pair increments also show the
smaller value across delays. These minima can come from different cases.

| Rule | Min full Δ parent | Min recent Δ parent | Min full Δ old | Min recent Δ old | Worst marked month Δ parent | Result |
|---|---|---|---|---|---|---|
| R01-08 | +$1,222.38 | +$278.57 | +$661.66 | +$235.59 | −$199.96 | Profit PASS; defense/strict fail |
| R01-04 | +$997.16 | −$70.32 | −$430.33 | −$115.01 | −$325.57 | Monthly and recent-profit budgets fail |
| R01-02 | +$515.80 | +$360.07 | +$458.93 | +$276.47 | −$390.10 | Profit screen fails only monthly budget |
| R01-01 | +$164.14 | +$184.13 | +$98.29 | +$98.29 | −$390.10 | Monthly and profit budgets fail |
| R01-03 | +$56.87 | +$76.86 | $0.00 | $0.00 | −$390.10 | Same path as C01-20; monthly/profit fail |
| R01-06 | −$162.76 | +$188.36 | −$1,677.95 | +$129.88 | −$422.43 | Monthly/profit/DD fail |
| R01-07 | −$245.31 | $0.00 | −$806.03 | −$47.49 | −$199.96 | Profit/DD fail |
| R01-09 | −$351.15 | +$89.98 | −$911.87 | +$42.49 | −$641.36 | Monthly/profit/DD fail |
| R01-05 | −$390.39 | +$24.80 | −$1,789.79 | −$53.88 | −$208.07 | Profit/DD fail |

**Unchanged screens:** every case needs ≥30 full /10 recent closes, positive
net and cost-stress net, solvency, and every marked month no worse than −$320
versus both unfiltered and readiness parents. Profit requires ≥+$500 full /
+$200 recent at both delays and DD no worse. Defense separately requires ≥90%
positive-parent retention, fewer losing dollars, full DD at least 20% and 1pp
lower, recent DD no worse, and improvement beyond ex-post exposure scaling.
The strict same-side-clock comparison is separate. No screen was relaxed.

R01-02 is the retained **long-side comparison**, not a qualifier: February 2026
loses $336.15 immediate /$390.10 delayed versus the unfiltered MACD parent.
That regression was already present in C01-20; refinement does not erase it.
R01-04 has lower DD but less profit than the old ATR pair in every case.
R01-03 is numerically the same path as C01-20: at these 4h decision boundaries,
the actual-turnover UTC-day aggregate and last close agree for 30m and 1h.
Changing that clock supplied no distinct economic path.

## 5. What actually improved in R01-08?

This is a short continuation rule with stronger negative candle-volume
confirmation. It is **not** a support/resistance rule and does not yet use HL.
The exact common/removed/new trade bridge is independently verified.

| Window / delay | Comparator | Removed trades | Winning dollars forgone | Losing dollars avoided | New trades / net | Net improvement |
|---|---|---|---|---|---|---|
| full / 0m | Unfiltered | 13 | $526.61 | $1,748.99 | 0 / $0.00 | +$1,222.38 |
| full / 0m | Old CMF<0 | 5 | $33.03 | $694.69 | 0 / $0.00 | +$661.66 |
| full / +1m | Unfiltered | 13 | $509.66 | $1,809.67 | 1 / $588.43 | +$1,888.44 |
| full / +1m | Old CMF<0 | 5 | $0.00 | $768.92 | 0 / $0.00 | +$768.92 |
| recent / 0m | Unfiltered | 2 | $0.00 | $283.94 | 0 / $0.00 | +$283.94 |
| recent / 0m | Old CMF<0 | 1 | $0.00 | $236.45 | 0 / $0.00 | +$236.45 |
| recent / +1m | Unfiltered | 2 | $0.00 | $278.57 | 0 / $0.00 | +$278.57 |
| recent / +1m | Old CMF<0 | 1 | $0.00 | $235.59 | 0 / $0.00 | +$235.59 |

Full immediate versus unfiltered: 4 winners and 9 losers removed, no replacement
entries. Versus the old pair: 1 winner and 4 losers removed. Full delayed versus
unfiltered also enables **one different $588.43 winner** through changed
occupancy; do not call that case pure filtering. Versus the old delayed pair,
the five removed trades are all losers and there are no new entries.

Recent, both models retain all eight winning trades. The old pair already
excluded a July 8 loss; the tighter threshold additionally excludes June 22.
**All +$236.45 immediate /+$235.59 delayed refinement gain versus the old pair
comes from that one additional avoided trade.** This is not 11 independent
confirmations that the new threshold adds value.

### Every changed trade versus the old CMF pair

These are causal signal timestamps, not hindsight exit labels.

| Original signal UTC | Closed 1h CMF20 | Old pair net, 0m | Old pair net, +1m | R01-08 |
|---|---|---|---|---|
| 2025-09-02 00:00 | -0.03214342 | −$288.19 | −$278.68 | Discard at signal |
| 2025-10-22 00:00 | -0.03298498 | −$148.58 | −$175.92 | Discard at signal |
| 2025-12-09 04:00 | -0.03790217 | $33.03 | −$58.99 | Discard at signal |
| 2026-04-28 12:00 | -0.04730859 | −$21.47 | −$19.74 | Discard at signal |
| 2026-06-22 04:00 | -0.04352444 | −$236.45 | −$235.59 | Discard at signal |

Causal trace: at **2026-06-22 04:00 UTC**, the just-completed 00:00–04:00
Bollinger bar supplies the downside crossing. The 03:00–04:00 hourly CMF20
is −0.04352444, available at 04:00 in the historical closed-bar model.
C02-32 accepts it because it is below zero; R01-08 discards it because it is
not below −0.05. No rebound price, eventual PnL or future hourly bar enters the
decision. A rejected crossing is not queued for later. The December 9 example
shows the invisible cost: an immediate-fill $33.03 winner is also discarded.

### Risk and concentration still limit the result

| Window / delay | Parent DD | R01-08 DD | Exposure-scaled parent DD | Worst adverse move against short | Top 5 wins / closed net |
|---|---|---|---|---|---|
| full / 0m | 12.35% | 12.22% | 10.23% | 7.38% | 71.30% |
| full / +1m | 13.81% | 12.96% | 11.27% | 7.45% | 102.74% |
| recent / 0m | 3.76% | 3.05% | 3.20% | 5.78% | 114.07% |
| recent / +1m | 4.01% | 3.14% | 3.41% | 6.42% | 124.05% |

The full immediate DD improvement is only **0.135 percentage points**, not a
20% defensive improvement. Simply scaling the unfiltered parent's exposure
down produces lower full DD than this filter. Conversely the filter does
reduce full losing dollars and raises net, so its profit screen passes.

The retained full short still experiences about 7.38% adverse movement
(7.45% delayed); no stop was modeled. Top-five winning dollars exceed all
recent net profit because other trades offset them. Historical incremental
selection, execution-delay sensitivity, funding and sparse recent outcomes
remain material. The model is not proven suitable for $25k live sizing.

## 6. Month-by-month: all mechanisms and baselines

Marked monthly net, including open marks and fees at each boundary, drives the
screen. It is not PnL merely assigned to the month in which a trade opened.
Each non-parent cell is **net (Δ versus unfiltered)**. Readiness controls are
identical to that parent. Old-pair deltas for every row also exist in
`monthly.json/csv`; lead-specific old-pair deltas follow the general tables.

### Full / 0m — V: MACD 4h long + VWAP

| Month | Unfiltered | C01-20 | R01-01 | R01-02 | R01-03 |
|---|---|---|---|---|---|
| 2025-07 | −$19.60 | $368.72 (+$388.33) | $368.72 (+$388.33) | $368.72 (+$388.33) | $368.72 (+$388.33) |
| 2025-08 | $91.75 | $91.75 ($0.00) | $91.75 ($0.00) | $91.75 ($0.00) | $91.75 ($0.00) |
| 2025-09 | −$116.74 | −$116.74 ($0.00) | −$116.74 ($0.00) | −$116.74 ($0.00) | −$116.74 ($0.00) |
| 2025-10 | $729.73 | $729.73 ($0.00) | $729.73 ($0.00) | $729.73 ($0.00) | $729.73 ($0.00) |
| 2025-11 | $1,004.22 | $1,004.22 ($0.00) | $1,004.22 ($0.00) | $1,004.22 ($0.00) | $1,004.22 ($0.00) |
| 2025-12 | $320.38 | $320.38 ($0.00) | $320.38 ($0.00) | $320.38 ($0.00) | $320.38 ($0.00) |
| 2026-01 | $1,092.10 | $1,092.10 ($0.00) | $1,092.10 ($0.00) | $1,281.89 (+$189.79) | $1,092.10 ($0.00) |
| 2026-02 | $1,344.31 | $1,008.16 (−$336.15) | $1,008.16 (−$336.15) | $1,008.16 (−$336.15) | $1,008.16 (−$336.15) |
| 2026-03 | $437.08 | $437.08 ($0.00) | $437.08 ($0.00) | $437.08 ($0.00) | $437.08 ($0.00) |
| 2026-04 | $242.87 | $242.87 ($0.00) | $242.87 ($0.00) | $242.87 ($0.00) | $242.87 ($0.00) |
| 2026-05 | $1,243.51 | $1,243.51 ($0.00) | $1,243.51 ($0.00) | $1,243.51 ($0.00) | $1,243.51 ($0.00) |
| 2026-06 | $755.01 | $958.42 (+$203.41) | $958.42 (+$203.41) | $958.42 (+$203.41) | $958.42 (+$203.41) |
| 2026-07 | $19.91 | −$3.35 (−$23.26) | $19.91 ($0.00) | −$3.35 (−$23.26) | −$3.35 (−$23.26) |
| 2026-08 | $858.57 | $783.55 (−$75.02) | $858.57 ($0.00) | $1,060.02 (+$201.45) | $783.55 (−$75.02) |
| 2026-09 | $266.43 | $266.43 ($0.00) | $266.43 ($0.00) | $266.43 ($0.00) | $266.43 ($0.00) |

### Full / 0m — A: MACD 4h short + prior-ATR shock veto

| Month | Unfiltered | C02-27 | R01-04 | R01-05 | R01-06 |
|---|---|---|---|---|---|
| 2025-07 | $1,251.96 | $1,070.93 (−$181.03) | $1,022.96 (−$229.00) | $1,070.93 (−$181.03) | $829.54 (−$422.43) |
| 2025-08 | −$1,232.09 | −$353.15 (+$878.95) | −$312.90 (+$919.19) | −$1,432.06 (−$199.96) | −$1,432.06 (−$199.96) |
| 2025-09 | −$1,506.98 | −$849.98 (+$657.00) | −$849.98 (+$657.00) | −$1,506.98 ($0.00) | −$1,506.98 ($0.00) |
| 2025-10 | −$315.34 | −$315.34 ($0.00) | −$315.34 ($0.00) | −$315.34 ($0.00) | −$315.34 ($0.00) |
| 2025-11 | −$139.88 | −$139.88 ($0.00) | −$393.32 (−$253.44) | −$139.88 ($0.00) | −$139.88 ($0.00) |
| 2025-12 | $176.59 | $194.28 (+$17.69) | $194.28 (+$17.69) | $194.28 (+$17.69) | $556.62 (+$380.03) |
| 2026-01 | $620.97 | $730.24 (+$109.28) | $614.60 (−$6.37) | $730.24 (+$109.28) | $484.22 (−$136.75) |
| 2026-02 | $1,224.24 | $1,224.24 ($0.00) | $1,224.24 ($0.00) | $1,224.24 ($0.00) | $1,224.24 ($0.00) |
| 2026-03 | $101.88 | $101.88 ($0.00) | $101.88 ($0.00) | $101.88 ($0.00) | $101.88 ($0.00) |
| 2026-04 | $64.23 | −$104.72 (−$168.96) | −$104.72 (−$168.96) | −$104.72 (−$168.96) | $64.23 ($0.00) |
| 2026-05 | $324.54 | $324.54 ($0.00) | $327.99 (+$3.45) | $324.54 ($0.00) | $324.54 ($0.00) |
| 2026-06 | $454.17 | $716.48 (+$262.31) | $626.77 (+$172.59) | $454.17 ($0.00) | $454.17 ($0.00) |
| 2026-07 | $1,388.91 | $1,090.16 (−$298.75) | $1,090.16 (−$298.75) | $1,421.50 (+$32.59) | $1,421.50 (+$32.59) |
| 2026-08 | −$589.97 | −$467.06 (+$122.91) | −$406.21 (+$183.76) | −$589.97 ($0.00) | −$406.21 (+$183.76) |
| 2026-09 | $176.41 | $176.41 ($0.00) | $176.41 ($0.00) | $176.41 ($0.00) | $176.41 ($0.00) |

### Full / 0m — C: Bollinger 4h breakdown short + CMF

| Month | Unfiltered | C02-32 | R01-07 | R01-08 | R01-09 |
|---|---|---|---|---|---|
| 2025-07 | −$587.79 | −$264.99 (+$322.80) | −$520.56 (+$67.23) | −$264.99 (+$322.80) | −$332.22 (+$255.57) |
| 2025-08 | $717.21 | $517.25 (−$199.96) | $517.25 (−$199.96) | $517.25 (−$199.96) | $75.85 (−$641.36) |
| 2025-09 | $346.77 | $346.77 ($0.00) | $346.77 ($0.00) | $634.95 (+$288.19) | $346.77 ($0.00) |
| 2025-10 | $613.52 | $613.52 ($0.00) | $613.52 ($0.00) | $762.10 (+$148.58) | $613.52 ($0.00) |
| 2025-11 | $701.44 | $701.44 ($0.00) | $701.44 ($0.00) | $701.44 ($0.00) | $484.42 (−$217.03) |
| 2025-12 | −$230.22 | $272.76 (+$502.97) | −$230.22 ($0.00) | $239.72 (+$469.94) | −$1.31 (+$228.91) |
| 2026-01 | $258.06 | $190.83 (−$67.22) | $190.83 (−$67.22) | $190.83 (−$67.22) | $190.83 (−$67.22) |
| 2026-02 | $215.97 | $170.61 (−$45.36) | $170.61 (−$45.36) | $170.61 (−$45.36) | $215.97 ($0.00) |
| 2026-03 | −$307.29 | −$307.29 ($0.00) | −$307.29 ($0.00) | −$307.29 ($0.00) | −$307.29 ($0.00) |
| 2026-04 | $204.49 | $204.49 ($0.00) | $204.49 ($0.00) | $225.96 (+$21.47) | $204.49 ($0.00) |
| 2026-05 | $121.31 | $121.31 ($0.00) | $121.31 ($0.00) | $121.31 ($0.00) | $121.31 ($0.00) |
| 2026-06 | $366.42 | $366.42 ($0.00) | $366.42 ($0.00) | $602.87 (+$236.45) | $366.42 ($0.00) |
| 2026-07 | $408.55 | $456.05 (+$47.49) | $408.55 ($0.00) | $456.05 (+$47.49) | $408.55 ($0.00) |
| 2026-08 | $36.37 | $36.37 ($0.00) | $36.37 ($0.00) | $36.37 ($0.00) | $126.35 (+$89.98) |
| 2026-09 | $0.00 | $0.00 ($0.00) | $0.00 ($0.00) | $0.00 ($0.00) | $0.00 ($0.00) |

### Full / +1m — V: MACD 4h long + VWAP

| Month | Unfiltered | C01-20 | R01-01 | R01-02 | R01-03 |
|---|---|---|---|---|---|
| 2025-07 | −$20.53 | $349.58 (+$370.11) | $349.58 (+$370.11) | $349.58 (+$370.11) | $349.58 (+$370.11) |
| 2025-08 | $1.55 | $1.55 ($0.00) | $1.55 ($0.00) | $1.55 ($0.00) | $1.55 ($0.00) |
| 2025-09 | −$99.55 | −$99.55 ($0.00) | −$99.55 ($0.00) | −$99.55 ($0.00) | −$99.55 ($0.00) |
| 2025-10 | $834.69 | $834.69 ($0.00) | $834.69 ($0.00) | $834.69 ($0.00) | $834.69 ($0.00) |
| 2025-11 | $1,042.63 | $1,042.63 ($0.00) | $1,042.63 ($0.00) | $1,042.63 ($0.00) | $1,042.63 ($0.00) |
| 2025-12 | $255.40 | $255.40 ($0.00) | $255.40 ($0.00) | $255.40 ($0.00) | $255.40 ($0.00) |
| 2026-01 | $1,175.53 | $1,175.53 ($0.00) | $1,175.53 ($0.00) | $1,351.25 (+$175.72) | $1,175.53 ($0.00) |
| 2026-02 | $1,360.89 | $970.79 (−$390.10) | $970.79 (−$390.10) | $970.79 (−$390.10) | $970.79 (−$390.10) |
| 2026-03 | $495.12 | $495.12 ($0.00) | $495.12 ($0.00) | $495.12 ($0.00) | $495.12 ($0.00) |
| 2026-04 | $522.83 | $522.83 ($0.00) | $522.83 ($0.00) | $522.83 ($0.00) | $522.83 ($0.00) |
| 2026-05 | $1,124.18 | $1,124.18 ($0.00) | $1,124.18 ($0.00) | $1,124.18 ($0.00) | $1,124.18 ($0.00) |
| 2026-06 | $756.52 | $940.64 (+$184.13) | $940.64 (+$184.13) | $940.64 (+$184.13) | $940.64 (+$184.13) |
| 2026-07 | $57.50 | $39.32 (−$18.18) | $57.50 ($0.00) | $39.32 (−$18.18) | $39.32 (−$18.18) |
| 2026-08 | $869.71 | $780.62 (−$89.09) | $869.71 ($0.00) | $1,063.83 (+$194.12) | $780.62 (−$89.09) |
| 2026-09 | $255.47 | $255.47 ($0.00) | $255.47 ($0.00) | $255.47 ($0.00) | $255.47 ($0.00) |

### Full / +1m — A: MACD 4h short + prior-ATR shock veto

| Month | Unfiltered | C02-27 | R01-04 | R01-05 | R01-06 |
|---|---|---|---|---|---|
| 2025-07 | $1,218.61 | $1,046.07 (−$172.54) | $1,004.57 (−$214.04) | $1,046.07 (−$172.54) | $839.34 (−$379.27) |
| 2025-08 | −$1,230.87 | −$392.01 (+$838.85) | −$351.82 (+$879.05) | −$1,438.94 (−$208.07) | −$1,438.94 (−$208.07) |
| 2025-09 | −$1,455.11 | −$799.90 (+$655.22) | −$799.90 (+$655.22) | −$1,455.11 ($0.00) | −$1,455.11 ($0.00) |
| 2025-10 | −$517.29 | −$517.29 ($0.00) | −$517.29 ($0.00) | −$517.29 ($0.00) | −$517.29 ($0.00) |
| 2025-11 | −$206.29 | −$206.29 ($0.00) | −$415.89 (−$209.60) | −$206.29 ($0.00) | −$206.29 ($0.00) |
| 2025-12 | $145.96 | $174.61 (+$28.65) | $174.61 (+$28.65) | $174.61 (+$28.65) | $497.34 (+$351.38) |
| 2026-01 | $535.20 | $729.09 (+$193.88) | $624.67 (+$89.47) | $729.09 (+$193.88) | $493.62 (−$41.58) |
| 2026-02 | $1,196.58 | $1,196.58 ($0.00) | $1,196.58 ($0.00) | $1,196.58 ($0.00) | $1,196.58 ($0.00) |
| 2026-03 | $125.05 | $125.05 ($0.00) | $125.05 ($0.00) | $125.05 ($0.00) | $125.05 ($0.00) |
| 2026-04 | −$178.32 | −$178.32 ($0.00) | −$178.32 ($0.00) | −$178.32 ($0.00) | −$178.32 ($0.00) |
| 2026-05 | $393.93 | $393.93 ($0.00) | $329.99 (−$63.94) | $393.93 ($0.00) | $393.93 ($0.00) |
| 2026-06 | $501.86 | $765.84 (+$263.98) | $657.49 (+$155.63) | $501.86 ($0.00) | $501.86 ($0.00) |
| 2026-07 | $1,379.34 | $1,053.77 (−$325.57) | $1,053.77 (−$325.57) | $1,404.14 (+$24.80) | $1,404.14 (+$24.80) |
| 2026-08 | −$547.13 | −$440.84 (+$106.29) | −$383.57 (+$163.56) | −$547.13 ($0.00) | −$383.57 (+$163.56) |
| 2026-09 | $185.90 | $185.90 ($0.00) | $185.90 ($0.00) | $185.90 ($0.00) | $185.90 ($0.00) |

### Full / +1m — C: Bollinger 4h breakdown short + CMF

| Month | Unfiltered | C02-32 | R01-07 | R01-08 | R01-09 |
|---|---|---|---|---|---|
| 2025-07 | −$660.29 | −$301.83 (+$358.46) | −$549.85 (+$110.44) | −$301.83 (+$358.46) | −$412.26 (+$248.02) |
| 2025-08 | $68.81 | $449.17 (+$380.36) | $449.17 (+$380.36) | $449.17 (+$380.36) | $68.81 ($0.00) |
| 2025-09 | −$12.92 | −$12.92 ($0.00) | −$12.92 ($0.00) | $265.77 (+$278.68) | −$12.92 ($0.00) |
| 2025-10 | $603.28 | $603.28 ($0.00) | $603.28 ($0.00) | $779.20 (+$175.92) | $603.28 ($0.00) |
| 2025-11 | $88.16 | $88.16 ($0.00) | $88.16 ($0.00) | $88.16 ($0.00) | $667.61 (+$579.45) |
| 2025-12 | −$546.86 | −$80.09 (+$466.77) | −$546.86 ($0.00) | −$21.11 (+$525.76) | −$546.86 ($0.00) |
| 2026-01 | $217.01 | $152.24 (−$64.77) | $152.24 (−$64.77) | $152.24 (−$64.77) | $152.24 (−$64.77) |
| 2026-02 | $135.89 | $71.61 (−$64.28) | $71.61 (−$64.28) | $71.61 (−$64.28) | $135.89 ($0.00) |
| 2026-03 | −$268.79 | −$268.79 ($0.00) | −$268.79 ($0.00) | −$268.79 ($0.00) | −$268.79 ($0.00) |
| 2026-04 | $215.43 | $215.43 ($0.00) | $215.43 ($0.00) | $235.17 (+$19.74) | $215.43 ($0.00) |
| 2026-05 | $156.11 | $156.11 ($0.00) | $156.11 ($0.00) | $156.11 ($0.00) | $156.11 ($0.00) |
| 2026-06 | $287.13 | $287.13 ($0.00) | $287.13 ($0.00) | $522.72 (+$235.59) | $287.13 ($0.00) |
| 2026-07 | $431.04 | $474.02 (+$42.98) | $431.04 ($0.00) | $474.02 (+$42.98) | $431.04 ($0.00) |
| 2026-08 | $32.41 | $32.41 ($0.00) | $32.41 ($0.00) | $32.41 ($0.00) | $123.92 (+$91.50) |
| 2026-09 | $0.00 | $0.00 ($0.00) | $0.00 ($0.00) | $0.00 ($0.00) | $0.00 ($0.00) |

### Recent window: explicit partial May baseline

For all 15 parent/original/refined rules at both delays, **June–September marked
monthly values match the full-window tables exactly** (checked within 1e−6).
Only May differs because the recent replay starts flat on May 17. Use these
partial-May rows followed by the June–September rows above to reconstruct each
complete recent result; do not substitute full May.

#### Recent partial May / 0m

| Mechanism | Unfiltered | Old pair | First variant | Second variant | Third variant |
|---|---|---|---|---|---|
| V: MACD 4h long + VWAP | $686.79 | C01-20: $686.79 ($0.00) | R01-01: $686.79 ($0.00) | R01-02: $686.79 ($0.00) | R01-03: $686.79 ($0.00) |
| A: MACD 4h short + prior-ATR shock veto | $503.24 | C02-27: $503.24 ($0.00) | R01-04: $506.69 (+$3.45) | R01-05: $503.24 ($0.00) | R01-06: $503.24 ($0.00) |
| C: Bollinger 4h breakdown short + CMF | $95.29 | C02-32: $95.29 ($0.00) | R01-07: $95.29 ($0.00) | R01-08: $95.29 ($0.00) | R01-09: $95.29 ($0.00) |

#### Recent partial May / +1m

| Mechanism | Unfiltered | Old pair | First variant | Second variant | Third variant |
|---|---|---|---|---|---|
| V: MACD 4h long + VWAP | $663.63 | C01-20: $663.63 ($0.00) | R01-01: $663.63 ($0.00) | R01-02: $663.63 ($0.00) | R01-03: $663.63 ($0.00) |
| A: MACD 4h short + prior-ATR shock veto | $594.53 | C02-27: $594.53 ($0.00) | R01-04: $530.59 (−$63.94) | R01-05: $594.53 ($0.00) | R01-06: $594.53 ($0.00) |
| C: Bollinger 4h breakdown short + CMF | $96.21 | C02-32: $96.21 ($0.00) | R01-07: $96.21 ($0.00) | R01-08: $96.21 ($0.00) | R01-09: $96.21 ($0.00) |

### R01-08: monthly refinement delta versus old CMF<0

The remaining monthly regression versus the old pair is the December 2025
immediate missed $33.03 winner; delayed December improves. The worst −$199.96
month versus unfiltered is inherited from the older pair, not newly introduced
by tightening CMF. This distinction does not remove the parent-relative screen.

| Month | Old 0m | R01-08 0m | Δ old 0m | Old +1m | R01-08 +1m | Δ old +1m |
|---|---|---|---|---|---|---|
| 2025-07 | −$264.99 | −$264.99 | $0.00 | −$301.83 | −$301.83 | $0.00 |
| 2025-08 | $517.25 | $517.25 | $0.00 | $449.17 | $449.17 | $0.00 |
| 2025-09 | $346.77 | $634.95 | +$288.19 | −$12.92 | $265.77 | +$278.68 |
| 2025-10 | $613.52 | $762.10 | +$148.58 | $603.28 | $779.20 | +$175.92 |
| 2025-11 | $701.44 | $701.44 | $0.00 | $88.16 | $88.16 | $0.00 |
| 2025-12 | $272.76 | $239.72 | −$33.03 | −$80.09 | −$21.11 | +$58.99 |
| 2026-01 | $190.83 | $190.83 | $0.00 | $152.24 | $152.24 | $0.00 |
| 2026-02 | $170.61 | $170.61 | $0.00 | $71.61 | $71.61 | $0.00 |
| 2026-03 | −$307.29 | −$307.29 | $0.00 | −$268.79 | −$268.79 | $0.00 |
| 2026-04 | $204.49 | $225.96 | +$21.47 | $215.43 | $235.17 | +$19.74 |
| 2026-05 | $121.31 | $121.31 | $0.00 | $156.11 | $156.11 | $0.00 |
| 2026-06 | $366.42 | $602.87 | +$236.45 | $287.13 | $522.72 | +$235.59 |
| 2026-07 | $456.05 | $456.05 | $0.00 | $474.02 | $474.02 | $0.00 |
| 2026-08 | $36.37 | $36.37 | $0.00 | $32.41 | $32.41 | $0.00 |
| 2026-09 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

## 7. Independent verification and saved evidence

- The same repaired snapshot and archived source hashes are pinned before
  execution. **32** original parent/pair/clock cases match archived statistics,
  fills and monthlies exactly; pair decision schedules match too.
- Pure fixtures cover strict thresholds, 30m/1h closed sources, previous ATR,
  zero/null, midnight, unavailable sources, discard, readiness, delay and prefix.
  Existing entry-context and combination fixtures also pass.
- **12 real-data prefix comparisons** pass: 3 entry-opportunity prefixes plus
  9 variant replay prefixes, with all relevant context observations compared.
  No forming source bar or post-cutoff observation is needed for earlier decisions.
- A separate checker rebuilds entry crossings and context values using the
  independent reference formulas, then independently checks scheduling, fills,
  fees, minute DD, monthly marks, attribution and acceptance screens.
- Accepted `verification.json`: **116 logical cases, 9,558 completed ledger
  rows, 5,688 decisions, 1,160 month rows and 96 attribution comparisons**.
  Repeated controls/windows/delays are included: these are verification counts,
  not independent trades.
- Full and VPS TypeScript checks and `git diff --check` passed. Six protected
  live/config/state paths match their pre-run hashes.

Nine new rules take the accepted inventory from 5,244 to **5,253 standalone /
45 ladder definitions**. Primary runs: 17 definitions × four cases =68;
48 readiness controls make 116. No extra threshold, gate or execution-delay
combinations were added after reading results.

[Exact frozen card](../research-inputs/indicators/refinement-r01-2026-09-07.json),
[reproduction and artifact schema](../docs/research/indicator-refinement-r01.md),
[retained machine-readable results](../research-inputs/indicators/r01-retained-candidates-2026-09-07.json).

Accepted local bundle:
`backtests/hype/hype-indicator-refinement-r01-2026-09-07/`

Manifest SHA256: `4f334952b4a5280de81dc2ed1f1d2cce853c60e925ba348ad53dfa095b02d079`

Independent verification SHA256: `8b8e9c3a9066cea62643d8ec0ebb0750bef92d43139f15cbaf45239e9670919d`

## 8. What proceeds, and what does not

**Proceed to a coverage-first HL/S/R checkpoint with R01-08 frozen as the lead.**
Keep its unfiltered Bollinger parent and C02-32 as explicit controls. The next
join must include all original entry opportunities, rejected/occupied ones as
well as executed trades, with entry-time source provenance. Do not mine only
the eleven winners/losers or look backward from known TPs.

R01-02 and original C02-27 remain documented comparisons with their failures;
they are not silently promoted to qualified candidates. MFI timing and OBV
are not broadened again in this pass.

A small, predeclared HL/S/R card must preserve healthy-overlap and readiness
controls and test single conditions before conjunctions. With only eleven
recent closes, filtering may leave too little evidence; missing-data loss and
small n are stop conditions, not reasons to lower the screen. See the
[staged handoff](../docs/research/indicator-hl-sr-ladder-path-2026-09-07.md).

Only after that checkpoint should a separately defined condition be tested at
**one actual ladder decision**, against the exact current canonical replay.
Standalone short profit is neither incremental ladder profit nor proof that
the inverse long veto is beneficial. Count avoided/new forced closes and
foregone/extra TPs, losses, DD, monthlies and recovery costs. No production gate,
short unpause, config edit, commit, push or deployment follows this result.

## Appendix: +1 minute on both actions

### Full / +1m

#### V: MACD 4h long + VWAP

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 50 / 39 | $18,791.23 | −$10,159.30 | $8,631.93 | — | — | 7.40% | $7,737.12 |
| C01-20 | 47 / 37 | $18,293.86 | −$9,605.06 | $8,688.80 | +$56.87 | $0.00 | 7.32% | $7,843.99 |
| R01-01 | 49 / 37 | $18,401.12 | −$9,605.06 | $8,796.07 | +$164.14 | +$107.27 | 7.32% | $7,931.19 |
| R01-02 | 47 / 35 | $18,293.86 | −$9,146.13 | $9,147.73 | +$515.80 | +$458.93 | 7.32% | $8,322.70 |
| R01-03 | 47 / 37 | $18,293.86 | −$9,605.06 | $8,688.80 | +$56.87 | $0.00 | 7.32% | $7,843.99 |

#### A: MACD 4h short + prior-ATR shock veto

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 46 / 44 | $12,488.89 | −$10,941.47 | $1,547.42 | — | — | 15.49% | $648.69 |
| C02-27 | 42 / 37 | $11,393.60 | −$8,257.42 | $3,136.18 | +$1,588.76 | $0.00 | 10.55% | $2,348.18 |
| R01-04 | 37 / 35 | $10,865.80 | −$8,159.95 | $2,705.85 | +$1,158.43 | −$430.33 | 10.45% | $1,987.60 |
| R01-05 | 43 / 41 | $11,743.97 | −$10,329.83 | $1,414.14 | −$133.28 | −$1,722.04 | 15.67% | $575.31 |
| R01-06 | 43 / 40 | $11,859.97 | −$10,401.73 | $1,458.24 | −$89.19 | −$1,677.95 | 15.77% | $629.42 |

#### C: Bollinger 4h breakdown short + CMF

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 29 / 30 | $6,396.83 | −$5,650.41 | $746.42 | — | — | 13.81% | $157.11 |
| C02-32 | 27 / 25 | $6,475.60 | −$4,609.66 | $1,865.94 | +$1,119.52 | $0.00 | 13.54% | $1,347.15 |
| R01-07 | 27 / 28 | $6,475.60 | −$5,367.44 | $1,108.16 | +$361.75 | −$757.77 | 13.72% | $559.02 |
| R01-08 | 27 / 20 | $6,475.60 | −$3,840.74 | $2,634.86 | +$1,888.44 | +$768.92 | 12.96% | $2,166.43 |
| R01-09 | 28 / 27 | $6,465.23 | −$4,864.61 | $1,600.62 | +$854.20 | −$265.31 | 12.60% | $1,051.72 |

### Recent / +1m

#### V: MACD 4h long + VWAP

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 13 / 11 | $4,475.72 | −$1,872.90 | $2,602.82 | — | — | 2.84% | $2,361.39 |
| C01-20 | 11 / 10 | $4,368.45 | −$1,688.77 | $2,679.68 | +$76.86 | $0.00 | 2.57% | $2,468.23 |
| R01-01 | 13 / 10 | $4,475.72 | −$1,688.77 | $2,786.95 | +$184.13 | +$107.27 | 2.70% | $2,555.43 |
| R01-02 | 11 / 9 | $4,368.45 | −$1,405.56 | $2,962.89 | +$360.07 | +$283.21 | 2.29% | $2,761.30 |
| R01-03 | 11 / 10 | $4,368.45 | −$1,688.77 | $2,679.68 | +$76.86 | $0.00 | 2.57% | $2,468.23 |

#### A: MACD 4h short + prior-ATR shock veto

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 14 / 11 | $3,571.89 | −$1,457.40 | $2,114.49 | — | — | 3.60% | $1,865.69 |
| C02-27 | 13 / 8 | $3,221.52 | −$1,062.33 | $2,159.19 | +$44.70 | $0.00 | 3.30% | $1,950.39 |
| R01-04 | 11 / 7 | $3,049.24 | −$1,005.06 | $2,044.18 | −$70.32 | −$115.01 | 3.15% | $1,865.30 |
| R01-05 | 14 / 10 | $3,571.89 | −$1,432.60 | $2,139.29 | +$24.80 | −$19.90 | 3.60% | $1,900.49 |
| R01-06 | 14 / 8 | $3,571.89 | −$1,269.04 | $2,302.85 | +$188.36 | +$143.66 | 3.43% | $2,084.13 |

#### C: Bollinger 4h breakdown short + CMF

| Setup | W / L | Winning dollars | Losing dollars | Net | Δ unfiltered | Δ old pair | DD | Extra-cost net |
|---|---|---|---|---|---|---|---|---|
| Unfiltered parent | 8 / 5 | $1,632.37 | −$785.58 | $846.79 | — | — | 4.01% | $717.28 |
| C02-32 | 8 / 4 | $1,632.37 | −$742.60 | $889.77 | +$42.98 | $0.00 | 4.01% | $770.28 |
| R01-07 | 8 / 5 | $1,632.37 | −$785.58 | $846.79 | $0.00 | −$42.98 | 4.01% | $717.28 |
| R01-08 | 8 / 3 | $1,632.37 | −$507.01 | $1,125.36 | +$278.57 | +$235.59 | 3.14% | $1,015.98 |
| R01-09 | 8 / 4 | $1,632.37 | −$694.08 | $938.29 | +$91.50 | +$48.52 | 4.01% | $818.83 |
