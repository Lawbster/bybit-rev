# I06 MACD standalone findings — September 6, 2026

## TL;DR

- **300 frozen definitions, 1,208 independently verified cases, 0 complete strict-screen qualifiers.** Seventeen definitions (10 long, 7 short) meet the declared sample/net/delay/extra-cost subset. They are research leads, not 17 independent discoveries or live approvals.
- **4h 12/26/9 signal-cross long is the useful lower-exposure contrast:** signal-reversal-or-12h earns **+$8,905 full / +$2,623 recent**, with **6.93% / 2.84% historical DD**, versus long clock **+$3,305 / +$5,038**, DD33.09% /12.94%. It avoids the observed October crash holding, but sacrifices substantial recent upside. The higher-profit 30m histogram-turn long still suffers a **51.51%** adverse trade excursion.
- **Short evidence is genuinely positive in a narrow cluster, not just “less negative”:** standard4h signal-cross/reversal earns **+$2,047 full / +$1,849 recent**, n91/25; zero-line/reversal earns **+$2,607 / +$285**, n47/11. All seven cost-tolerant short definitions use standard4h MACD. Monthly losses, concentration and sparse recent zero-cross evidence remain. No live/ladder/short-config change. Next individual family: Bollinger/channel.

## 1. Scope, dates and what these dollars mean

New research only, requested after I05 ROC. This does not rerun or modify the
Martingale ladder and is not an overlay on the paused live HL short. No other
indicators, pulse features, S/R levels or new risk controls influence a trade.

| Item | Exact convention |
|---|---|
| Full | **2025-07-01 00:00 through 2026-09-04 19:01 UTC** |
| Recent | **2026-05-17 20:43 through 2026-09-04 19:01 UTC**, contained in full |
| Seed | Fixed2025-06-01 00:00 UTC; continuous minute history, explicit prior 11-minute repair overlay |
| Sizing | $10,000 fixed entry notional, $32,000 initial equity, one position per independent rule; no averaging or compounding |
| Fees | 0.055% of actual executed notional each side |
| Funding | **Excluded**: complete settlement evidence unavailable; all nets are after trading fees, before funding |
| Actions | Closed selected-timeframe decision, next minute-open execution under modeled zero publication lag; separate +1m applied to every entry AND exit |
| Exits | 12h from actual fill, or subsequent MACD condition capped at12h; no price TP/SL |
| Controls | Own-side rolling12h clock; cash$0 and fixed-initial-quantity buy/hold contextual only |
| Cutoff | Open inventory marked with hypothetical close fee, not counted as a completed trade |
| Stress | Extra5bps each side on same executed/marked turnover; not a dynamic liquidity or slippage-path replay |
| DD | Prior close-equity peak to minute adverse price, on $32k starting equity; no invented intraminute sequence |

Do not add overlapping windows, delays or related definitions. The same-side
clock is near-continuous and **not exposure-matched**. Lower DD can partly mean
less time invested. Long buy/hold context: +$11,511 full /+$8,383 recent, with
changing marked notional, not the fixed-notional clock. Cash makes$0.

This is previously mined development history, **not a held-out confirmation**.
No actual historical collector-arrival times, live fills, funding, liquidation,
margin, joint-account collateral or ladder contribution are certified.
Unrounded ledgers remain local. Tables round dollars; win/loss dollars already
include fees, so do not subtract either again.

## 2. What was frozen and validated

The standard reference is EMA12 minus EMA26, with EMA9 of the MACD line as
signal; histogram=line-signal. [Fidelity](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd)
and [TradingView](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/)
support that definition. Faster6/13/5 and slower24/52/18 are our declared
sensitivity presets, not claimed universal standards.

- **Five clocks:** 5m,15m,30m,1h,4h.
- **Three presets:** 6/13/5,12/26/9,24/52/18.
- **Five entry meanings, both directions, two exits:** 5×3×5×2×2 =300 definitions.
- 300 new MACD definitions; zero repeats. Eight prior clock cases are parity
  controls, not new hypotheses. Overall standalone inventory becomes **1,164**
  distinct definitions through I06; the45 ladder definitions remain separate.

| Entry name | Long | Short |
|---|---|---|
| signal_cross | Histogram moves from<=0 to>0 | From>=0 to<0 |
| signal_trend | Same fresh crossing, current MACD line>0 | Same crossing, line<0 |
| signal_counter | Same fresh crossing, current line<0 | Same crossing, line>0 |
| zero_cross | MACD line from<=0 to>0 | From>=0 to<0 |
| hist_turn | Three closed histograms: slope turns positive while latesthist<0 | Slope turns negative while latesthist>0 |

Exactly-zero line is excluded from both conditioned signal variants. Signal
cross and histogram-zero cross are the **same event**, not independent votes.
Hist-turn uses past/current slopes, never a future-confirmed pivot.

Price EMAs each start from their own firstN arithmetic-mean closes. Update:
`previous + 2/(N+1)*(input-previous)`. SignalEMA seeds from its firstS valid
MACD values, not zero-padding warmup. Null is missing; truezero is valid.
First histogram index is slow+S-2, with zero-based indexing. Values are raw
price units, not percent. Fixed seed, no reseed, interpolation or rounding.

Signal/trend/counter exits: subsequent hist<=0 long />=0 short.
Zero-line exits: subsequent line<=0 long />=0 short.
Hist-turn exits: subsequent hist>=0 long /<=0 short (normalization).
Timeout wins ties; entry-time observations cannot exit; pending actions stay
immutable; occupied signals are skipped, not queued. Fixed12h companion runs
keep the identical entry rule but recompute occupancy.

Formula validation is independent of the legacy live feature bundle:
weighted-sum EMA fixtures, installed library on varying-price series, truezero,
linear/scaled inputs, warmup, gap rejection and prefixes. Existing live
indicator/order/config code was not changed by this pass.

Not tested: other parameters/daily clocks, magnitude/PPO/ATR normalization,
persistent state, price divergence, multitimeframe rules, stops/targets/trailing/
partials, other indicators, HL/S/R or ladder/portfolio applications.

## 3. Baseline and selected W/L dollars

**Same full/recent UTC dates as section1, immediate model, $10k notional.**
Labels are merely shortened exact IDs, not newly chosen policies.
L1–L5 are the frozen descriptive subset's topfive by full absolute net.
R1–R5 are the full-delta rawtopfive; those rank shorts highly because their
short clock lost heavily. R5 lacks adequate samples and is not a survivor.

| Label | Exact rule ID |
|---|---|
| L1 | `macd_30m_12_26_9_hist_turn_long_fixed12h` |
| L2 | `macd_240m_12_26_9_signal_cross_long_indicator_or12h` |
| L3 | `macd_240m_12_26_9_signal_cross_long_fixed12h` |
| L4 | `macd_240m_6_13_5_zero_cross_long_fixed12h` |
| L5 | `macd_240m_12_26_9_signal_counter_long_indicator_or12h` |
| R1 | `macd_240m_12_26_9_zero_cross_short_indicator_or12h` |
| R2 | `macd_240m_12_26_9_zero_cross_short_fixed12h` |
| R3 | `macd_240m_12_26_9_signal_cross_short_indicator_or12h` |
| R4 | `macd_240m_12_26_9_signal_cross_short_fixed12h` |
| R5 | `macd_240m_24_52_18_signal_trend_short_fixed12h` |

### Full window: 2025-07-01 00:00 → 2026-09-04 19:01 UTC

| Rule | Closes W/L | Winning $ | Losing $ | Open $ | Net $ | Own clock Δ $ | DD |
|---|---|---|---|---|---|---|---|
| Long clock | 861 (420/441) | 110,950 | -107,401 | -245 | +3,305 | baseline | 33.09% |
| Short clock | 861 (414/447) | 98,162 | -120,668 | +223 | -22,283 | baseline | 71.27% |
| L1 | 577 (296/281) | 78,276 | -67,048 | -135 | +11,094 | +7,789 | 19.59% |
| L2 | 91 (51/40) | 18,497 | -9,592 | 0 | +8,905 | +5,600 | 6.93% |
| L3 | 90 (51/39) | 18,549 | -10,280 | 0 | +8,270 | +4,965 | 7.28% |
| L4 | 92 (47/45) | 13,864 | -9,449 | 0 | +4,414 | +1,110 | 8.97% |
| L5 | 64 (38/26) | 11,000 | -6,628 | 0 | +4,372 | +1,068 | 5.48% |
| R1 | 47 (21/26) | 6,113 | -3,506 | 0 | +2,607 | +24,890 | 4.05% |
| R2 | 47 (21/26) | 6,113 | -3,529 | 0 | +2,584 | +24,867 | 4.06% |
| R3 | 91 (47/44) | 12,939 | -10,893 | 0 | +2,047 | +24,329 | 14.26% |
| R4 | 91 (47/44) | 12,939 | -10,940 | 0 | +2,000 | +24,282 | 15.17% |
| R5 | 19 (7/12) | 3,112 | -1,417 | 0 | +1,695 | +23,978 | 3.58% |

### Recent: 2026-05-17 20:43 → 2026-09-04 19:01 UTC

| Rule | Closes W/L | Winning $ | Losing $ | Open $ | Net $ | Own clock Δ $ | DD |
|---|---|---|---|---|---|---|---|
| Long clock | 219 (114/105) | 29,120 | -23,837 | -245 | +5,038 | baseline | 12.94% |
| Short clock | 219 (97/122) | 21,666 | -31,775 | +223 | -9,887 | baseline | 32.54% |
| L1 | 143 (76/67) | 19,576 | -15,130 | -135 | +4,311 | -727 | 10.55% |
| L2 | 25 (14/11) | 4,480 | -1,858 | 0 | +2,623 | -2,416 | 2.84% |
| L3 | 24 (13/11) | 4,452 | -1,865 | 0 | +2,587 | -2,452 | 2.84% |
| L4 | 27 (15/12) | 3,734 | -2,466 | 0 | +1,268 | -3,770 | 4.35% |
| L5 | 17 (8/9) | 2,045 | -1,702 | 0 | +342 | -4,696 | 2.90% |
| R1 | 11 (4/7) | 1,846 | -1,560 | 0 | +285 | +10,172 | 4.34% |
| R2 | 11 (4/7) | 1,846 | -1,560 | 0 | +285 | +10,172 | 4.34% |
| R3 | 25 (13/12) | 3,426 | -1,577 | 0 | +1,849 | +11,735 | 3.80% |
| R4 | 25 (13/12) | 3,426 | -1,493 | 0 | +1,933 | +11,819 | 3.71% |
| R5 | 8 (3/5) | 1,033 | -461 | 0 | +572 | +10,459 | 1.33% |

The informative distinction is **L2 versus L1**, not just the highest PnL:
4h signal-cross/reversal L2 holds for1,008h full versus clock10,339h;276h recent
versus clock2,635h. It earns less recently but with much less exposure.
L1 earns more full but loses more than clock in July2026 and still holds through
the October collapse. A histogram beginning to improve is not price support.

R3's recent win rate is only52% (13/25); R1's is36.4% (4/11).
Both are profitable in this model, but “4h MACD short” is not a single
interchangeable rule. R3 retains more recent profit and more observations;
R1 has lower full DD but a much thinner recent dollar cushion.

## 4. Execution-delay and additional-cost sensitivity

Each cell is **net / net after extra5bps per side**. Costs are not funding.
Changed action delay can change trade membership and occupancy; it is not
merely the same trade ledger repriced.

| Rule | Full0m $ | Full+1m $ | Recent0m $ | Recent+1m $ |
|---|---|---|---|---|
| Long clock | +3,305 / -5,322 | +3,792 / -4,815 | +5,038 / +2,835 | +5,104 / +2,910 |
| Short clock | -22,283 / -30,909 | -22,726 / -31,333 | -9,887 / -12,090 | -9,930 / -12,124 |
| L1 | +11,094 / +5,305 | +8,669 / +2,952 | +4,311 / +2,869 | +4,541 / +3,108 |
| L2 | +8,905 / +7,990 | +9,071 / +8,156 | +2,623 / +2,371 | +2,694 / +2,442 |
| L3 | +8,270 / +7,365 | +8,632 / +7,737 | +2,587 / +2,345 | +2,603 / +2,361 |
| L4 | +4,414 / +3,492 | +4,438 / +3,536 | +1,268 / +997 | +1,253 / +992 |
| L5 | +4,372 / +3,730 | +4,670 / +4,027 | +342 / +172 | +410 / +240 |
| R1 | +2,607 / +2,139 | +2,428 / +1,960 | +285 / +176 | +226 / +117 |
| R2 | +2,584 / +2,116 | +2,416 / +1,947 | +285 / +176 | +226 / +117 |
| R3 | +2,047 / +1,138 | +1,805 / +896 | +1,849 / +1,600 | +2,048 / +1,799 |
| R4 | +2,000 / +1,091 | +1,547 / +649 | +1,933 / +1,684 | +2,114 / +1,866 |
| R5 | +1,695 / +1,506 | +1,561 / +1,372 | +572 / +492 | +515 / +436 |

R1's recent delayed/cost-stressed cushion is just **+$117**, n11.
R3 retains +$896 full /+$1,799 recent under delayed extra costs, but is still
sensitive to a few trades and genuine losing months. L2 survives these tests;
its recent shortfall against the long clock remains about$2,400.

### Mode-specific exit versus its OWN identical-entry fixed12h baseline

This table recomputes full strategy occupancy under each exit, not just closes
the original trades at a retrospectively chosen better point. It is distinct
from the clock comparison.

| Indicator-exit exact ID | Full0m fixed → exit (Δ) $ | Full+1m fixed → exit (Δ) $ | Recent0m fixed → exit (Δ) $ | Recent+1m fixed → exit (Δ) $ |
|---|---|---|---|---|
| `macd_30m_12_26_9_hist_turn_long_indicator_or12h` | +11,094 → -3,250 (-14,343) | +8,669 → -3,940 (-12,609) | +4,311 → +671 (-3,640) | +4,541 → +744 (-3,797) |
| `macd_240m_12_26_9_signal_cross_long_indicator_or12h` | +8,270 → +8,905 (+635) | +8,632 → +9,071 (+439) | +2,587 → +2,623 (+36) | +2,603 → +2,694 (+91) |
| `macd_240m_6_13_5_zero_cross_long_indicator_or12h` | +4,414 → +4,332 (-82) | +4,438 → +4,462 (+24) | +1,268 → +1,284 (+16) | +1,253 → +1,236 (-17) |
| `macd_240m_12_26_9_signal_counter_long_indicator_or12h` | +3,957 → +4,372 (+415) | +4,208 → +4,670 (+462) | +306 → +342 (+36) | +319 → +410 (+91) |
| `macd_240m_12_26_9_zero_cross_short_indicator_or12h` | +2,584 → +2,607 (+23) | +2,416 → +2,428 (+12) | +285 → +285 (0) | +226 → +226 (0) |
| `macd_240m_12_26_9_signal_cross_short_indicator_or12h` | +2,000 → +2,047 (+47) | +1,547 → +1,805 (+257) | +1,933 → +1,849 (-84) | +2,114 → +2,048 (-67) |

L2's reversal exit helps its own full and recent comparisons in both delays,
but only+$36/+91 recently. R3's reversal exit helps full but costs$84/$67
recently versus fixed12h. **There is no universal indicator-exit upgrade.**

## 5. Monthly regimes — profits AND opportunity cost

Every cell below shows **actual monthly marked net (delta versus own-side
clock)**. Clock columns show actual net. This includes changes in open marks
and fees when incurred; it is not exit-month losing-trade totals.
September2026 is partial; recentMay2026 starts May17, not May1.
Each table uses its own full/recent initialization and delay. Small differences
between overlapping-window totals can arise from starting flat.

### Descriptive topfive longs — full, 0m

| Month | long clock $ | L1 net (Δ) $ | L2 net (Δ) $ | L3 net (Δ) $ | L4 net (Δ) $ | L5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -161 | +26 (+188) | +303 (+464) | -20 (+142) | +660 (+821) | +270 (+431) |
| 2025-08 | +510 | +1,276 (+765) | +12 (-498) | +92 (-419) | +620 (+109) | -56 (-566) |
| 2025-09 | -109 | +943 (+1,053) | -117 (-7) | -117 (-7) | +29 (+138) | -88 (+22) |
| 2025-10 | -470 | +3,070 (+3,541) | +962 (+1,433) | +730 (+1,200) | +534 (+1,004) | +1,047 (+1,517) |
| 2025-11 | -3,287 | +939 (+4,226) | +1,085 (+4,372) | +1,004 (+4,291) | -2,037 (+1,250) | +1,427 (+4,714) |
| 2025-12 | -2,574 | -1,397 (+1,177) | +191 (+2,765) | +320 (+2,894) | -318 (+2,256) | +191 (+2,765) |
| 2026-01 | +1,782 | -1,597 (-3,379) | +1,092 (-690) | +1,092 (-690) | +1,039 (-744) | -184 (-1,967) |
| 2026-02 | -122 | +1,422 (+1,544) | +1,543 (+1,665) | +1,344 (+1,466) | -70 (+52) | +548 (+670) |
| 2026-03 | +1,155 | +1,584 (+429) | +437 (-718) | +437 (-718) | +1,187 (+32) | +127 (-1,028) |
| 2026-04 | +307 | -698 (-1,005) | +216 (-91) | +243 (-64) | +756 (+449) | -345 (-652) |
| 2026-05 | +5,789 | +4,373 (-1,416) | +1,244 (-4,546) | +1,244 (-4,546) | +1,213 (-4,577) | +1,093 (-4,697) |
| 2026-06 | -1,256 | +820 (+2,076) | +841 (+2,097) | +755 (+2,011) | -73 (+1,182) | +841 (+2,097) |
| 2026-07 | -2,621 | -2,839 (-219) | -18 (+2,603) | +20 (+2,641) | -138 (+2,483) | -162 (+2,459) |
| 2026-08 | +4,306 | +2,611 (-1,695) | +846 (-3,460) | +859 (-3,447) | +785 (-3,521) | -337 (-4,643) |
| 2026-09 | +55 | +560 (+505) | +266 (+211) | +266 (+211) | +228 (+173) | 0 (-55) |

### Descriptive topfive longs — full, +1m

| Month | long clock $ | L1 net (Δ) $ | L2 net (Δ) $ | L3 net (Δ) $ | L4 net (Δ) $ | L5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -94 | -482 (-388) | +301 (+395) | -21 (+73) | +559 (+653) | +261 (+355) |
| 2025-08 | +754 | +1,173 (+419) | -41 (-795) | +2 (-753) | +524 (-230) | -6 (-760) |
| 2025-09 | -265 | -68 (+196) | -89 (+176) | -100 (+165) | +78 (+343) | -53 (+212) |
| 2025-10 | -484 | +3,258 (+3,742) | +1,026 (+1,510) | +835 (+1,319) | +560 (+1,044) | +1,091 (+1,575) |
| 2025-11 | -3,354 | +779 (+4,133) | +1,132 (+4,486) | +1,043 (+4,397) | -2,088 (+1,266) | +1,486 (+4,841) |
| 2025-12 | -2,606 | -1,226 (+1,380) | +115 (+2,721) | +255 (+2,862) | -256 (+2,351) | +115 (+2,721) |
| 2026-01 | +2,011 | -1,570 (-3,580) | +1,176 (-835) | +1,176 (-835) | +1,143 (-868) | -112 (-2,122) |
| 2026-02 | +102 | -836 (-938) | +1,576 (+1,474) | +1,361 (+1,259) | -12 (-115) | +607 (+505) |
| 2026-03 | +1,222 | +1,564 (+342) | +495 (-727) | +495 (-727) | +1,196 (-26) | +191 (-1,031) |
| 2026-04 | +243 | +53 (-190) | +226 (-16) | +523 (+280) | +728 (+485) | -386 (-629) |
| 2026-05 | +5,761 | +4,835 (-927) | +1,124 (-4,637) | +1,124 (-4,637) | +1,214 (-4,547) | +1,065 (-4,696) |
| 2026-06 | -1,159 | +424 (+1,583) | +871 (+2,030) | +757 (+1,915) | -56 (+1,102) | +871 (+2,030) |
| 2026-07 | -2,614 | -2,381 (+233) | +31 (+2,646) | +58 (+2,672) | -143 (+2,472) | -131 (+2,484) |
| 2026-08 | +4,311 | +2,561 (-1,749) | +872 (-3,439) | +870 (-3,441) | +762 (-3,549) | -331 (-4,641) |
| 2026-09 | -37 | +586 (+623) | +255 (+292) | +255 (+292) | +229 (+266) | 0 (+37) |

### Descriptive topfive longs — recent, 0m

| Month | long clock $ | L1 net (Δ) $ | L2 net (Δ) $ | L3 net (Δ) $ | L4 net (Δ) $ | L5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2026-05 | +4,554 | +3,160 (-1,395) | +687 (-3,867) | +687 (-3,867) | +466 (-4,088) | 0 (-4,554) |
| 2026-06 | -1,256 | +820 (+2,076) | +841 (+2,097) | +755 (+2,011) | -73 (+1,182) | +841 (+2,097) |
| 2026-07 | -2,621 | -2,839 (-219) | -18 (+2,603) | +20 (+2,641) | -138 (+2,483) | -162 (+2,459) |
| 2026-08 | +4,306 | +2,611 (-1,695) | +846 (-3,460) | +859 (-3,447) | +785 (-3,521) | -337 (-4,643) |
| 2026-09 | +55 | +560 (+505) | +266 (+211) | +266 (+211) | +228 (+173) | 0 (-55) |

### Descriptive topfive longs — recent, +1m

| Month | long clock $ | L1 net (Δ) $ | L2 net (Δ) $ | L3 net (Δ) $ | L4 net (Δ) $ | L5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2026-05 | +4,477 | +3,351 (-1,126) | +664 (-3,814) | +664 (-3,814) | +461 (-4,016) | 0 (-4,477) |
| 2026-06 | -1,129 | +424 (+1,553) | +871 (+2,000) | +757 (+1,885) | -56 (+1,072) | +871 (+2,000) |
| 2026-07 | -2,692 | -2,381 (+311) | +31 (+2,724) | +58 (+2,750) | -143 (+2,550) | -131 (+2,562) |
| 2026-08 | +4,384 | +2,561 (-1,822) | +872 (-3,511) | +870 (-3,514) | +762 (-3,622) | -331 (-4,714) |
| 2026-09 | +64 | +586 (+523) | +255 (+192) | +255 (+192) | +229 (+166) | 0 (-64) |

### Raw delta topfive shorts — full, 0m

| Month | short clock $ | R1 net (Δ) $ | R2 net (Δ) $ | R3 net (Δ) $ | R4 net (Δ) $ | R5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,203 | -299 (+904) | -299 (+904) | +1,252 (+2,455) | +1,252 (+2,455) | -26 (+1,177) |
| 2025-08 | -1,876 | -26 (+1,849) | -26 (+1,849) | -1,232 (+644) | -1,232 (+644) | 0 (+1,876) |
| 2025-09 | -1,211 | -98 (+1,113) | -98 (+1,113) | -1,548 (-336) | -1,507 (-296) | 0 (+1,211) |
| 2025-10 | -894 | +657 (+1,551) | +657 (+1,551) | -315 (+578) | -315 (+578) | +363 (+1,257) |
| 2025-11 | +1,970 | +661 (-1,309) | +661 (-1,309) | -130 (-2,100) | -140 (-2,110) | +601 (-1,369) |
| 2025-12 | +1,212 | +483 (-729) | +483 (-729) | +177 (-1,035) | +177 (-1,035) | +153 (-1,059) |
| 2026-01 | -3,149 | -339 (+2,810) | -339 (+2,810) | +621 (+3,770) | +621 (+3,770) | -102 (+3,047) |
| 2026-02 | -1,111 | +1,029 (+2,139) | +1,029 (+2,139) | +1,224 (+2,335) | +1,224 (+2,335) | +156 (+1,267) |
| 2026-03 | -2,521 | -124 (+2,397) | -147 (+2,374) | +102 (+2,623) | +102 (+2,623) | 0 (+2,521) |
| 2026-04 | -1,628 | +464 (+2,092) | +464 (+2,092) | +226 (+1,854) | +64 (+1,692) | -21 (+1,607) |
| 2026-05 | -7,161 | -586 (+6,575) | -586 (+6,575) | +325 (+7,485) | +325 (+7,485) | 0 (+7,161) |
| 2026-06 | -64 | +382 (+445) | +382 (+445) | +454 (+518) | +454 (+518) | +301 (+365) |
| 2026-07 | +1,259 | +791 (-468) | +791 (-468) | +1,333 (+74) | +1,389 (+130) | +323 (-937) |
| 2026-08 | -5,675 | -267 (+5,408) | -267 (+5,408) | -618 (+5,057) | -590 (+5,085) | -52 (+5,624) |
| 2026-09 | -231 | -121 (+111) | -121 (+111) | +176 (+408) | +176 (+408) | 0 (+231) |

### Raw delta topfive shorts — full, +1m

| Month | short clock $ | R1 net (Δ) $ | R2 net (Δ) $ | R3 net (Δ) $ | R4 net (Δ) $ | R5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,271 | -313 (+958) | -313 (+958) | +1,219 (+2,489) | +1,219 (+2,489) | -42 (+1,229) |
| 2025-08 | -2,120 | +6 (+2,126) | +6 (+2,126) | -1,253 (+867) | -1,231 (+889) | 0 (+2,120) |
| 2025-09 | -1,056 | -111 (+945) | -111 (+945) | -1,531 (-476) | -1,455 (-399) | 0 (+1,056) |
| 2025-10 | -880 | +618 (+1,498) | +618 (+1,498) | -517 (+363) | -517 (+363) | +305 (+1,186) |
| 2025-11 | +2,037 | +720 (-1,317) | +720 (-1,317) | -150 (-2,187) | -206 (-2,243) | +659 (-1,378) |
| 2025-12 | +1,267 | +426 (-841) | +426 (-841) | +148 (-1,118) | +146 (-1,121) | +97 (-1,169) |
| 2026-01 | -3,378 | -325 (+3,053) | -325 (+3,053) | +547 (+3,924) | +535 (+3,913) | -145 (+3,233) |
| 2026-02 | -1,335 | +971 (+2,306) | +971 (+2,306) | +1,197 (+2,532) | +1,197 (+2,532) | +190 (+1,526) |
| 2026-03 | -2,588 | -175 (+2,413) | -188 (+2,401) | +125 (+2,714) | +125 (+2,714) | 0 (+2,588) |
| 2026-04 | -1,564 | +467 (+2,031) | +467 (+2,031) | +174 (+1,738) | -178 (+1,385) | -20 (+1,544) |
| 2026-05 | -7,132 | -579 (+6,553) | -579 (+6,553) | +394 (+7,526) | +394 (+7,526) | 0 (+7,132) |
| 2026-06 | -139 | +406 (+545) | +406 (+545) | +529 (+668) | +502 (+641) | +317 (+456) |
| 2026-07 | +1,252 | +750 (-502) | +750 (-502) | +1,320 (+67) | +1,379 (+127) | +271 (-982) |
| 2026-08 | -5,680 | -293 (+5,388) | -293 (+5,388) | -581 (+5,099) | -547 (+5,133) | -73 (+5,607) |
| 2026-09 | -139 | -139 (0) | -139 (0) | +186 (+325) | +186 (+325) | 0 (+139) |

### Raw delta topfive shorts — recent, 0m

| Month | short clock $ | R1 net (Δ) $ | R2 net (Δ) $ | R3 net (Δ) $ | R4 net (Δ) $ | R5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,175 | -500 (+4,676) | -500 (+4,676) | +503 (+5,679) | +503 (+5,679) | 0 (+5,175) |
| 2026-06 | -64 | +382 (+445) | +382 (+445) | +454 (+518) | +454 (+518) | +301 (+365) |
| 2026-07 | +1,259 | +791 (-468) | +791 (-468) | +1,333 (+74) | +1,389 (+130) | +323 (-937) |
| 2026-08 | -5,675 | -267 (+5,408) | -267 (+5,408) | -618 (+5,057) | -590 (+5,085) | -52 (+5,624) |
| 2026-09 | -231 | -121 (+111) | -121 (+111) | +176 (+408) | +176 (+408) | 0 (+231) |

### Raw delta topfive shorts — recent, +1m

| Month | short clock $ | R1 net (Δ) $ | R2 net (Δ) $ | R3 net (Δ) $ | R4 net (Δ) $ | R5 net (Δ) $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,099 | -497 (+4,601) | -497 (+4,601) | +595 (+5,693) | +595 (+5,693) | 0 (+5,099) |
| 2026-06 | -191 | +406 (+597) | +406 (+597) | +529 (+720) | +502 (+693) | +317 (+508) |
| 2026-07 | +1,330 | +750 (-580) | +750 (-580) | +1,320 (-11) | +1,379 (+49) | +271 (-1,060) |
| 2026-08 | -5,753 | -293 (+5,460) | -293 (+5,460) | -581 (+5,172) | -547 (+5,206) | -73 (+5,680) |
| 2026-09 | -218 | -139 (+78) | -139 (+78) | +186 (+404) | +186 (+404) | 0 (+218) |

### What those months actually tell us

- **L2 provides real historical loss avoidance:** fullNovember2025 clock
  -$3,287 versus L2+$1,085; December -$2,574 versus+$191; July2026 -$2,621
  versus-$18. The cost is missing upside: May+$5,789 versus+$1,244, and
  August+$4,306 versus+$846. Reduced exposure explains part of both effects.
- **L1 is not the defensive answer just because full net wins:** July2026
  -$2,839 versus clock-$2,621; January -$1,597 versus clock+$1,782.
  Those costs coexist with its real October/November profit improvements.
- **R3 still has losing short months:** August2025-$1,232, September2025
  -$1,548, August2026-$618. November2025 it loses$130 while the short clock
  earns$1,970. Beating the large-loss short clock in aggregate does not remove
  short squeeze risk or guarantee that every red month is captured.
- R1/R2 have just11 recent completed trades. A small positive total over
  recent months is a fragile result, not evidence the zero-line cross is
  invariably more efficient.

## 6. Path risk and winner concentration

Read-only scan of accepted completed holdings, immediate model. Exit-minute
extremes excluded because exit is at its open. These are **gross trade MAE**,
not fee-inclusive closed losses or account DD. Original path supplement
checks L1–L5 plus clocks; an additional read-only invocation extends that exact
calculation to the already-ranked rawtopfive, without any strategy rerun.

| Rule / period | Worst held adverse $ | Adverse move | Entry UTC | Worst closed $ | Top5 winners / closed net |
|---|---|---|---|---|---|
| Long clock / full | -5,352 | -53.52% | 2025-10-10T12:00:00Z | -1,601 | 199.91% |
| Long clock / recent | -1,305 | -13.05% | 2026-06-04T00:00:00Z | -1,078 | 106.49% |
| Short clock / full | -2,365 | -23.65% | 2026-08-19T12:00:00Z | -1,885 | net negative |
| Short clock / recent | -2,365 | -23.65% | 2026-08-19T12:00:00Z | -1,885 | net negative |
| L1 / full | -5,151 | -51.51% | 2025-10-10T20:00:00Z | -1,057 | 52.58% |
| L1 / recent | -1,125 | -11.25% | 2026-06-04T03:30:00Z | -794 | 86.63% |
| L2 / full | -833 | -8.33% | 2025-09-24T20:00:00Z | -835 | 67.65% |
| L2 / recent | -725 | -7.25% | 2026-06-25T04:00:00Z | -289 | 125.67% |
| L3 / full | -833 | -8.33% | 2025-09-24T20:00:00Z | -835 | 72.84% |
| L3 / recent | -725 | -7.25% | 2026-06-25T04:00:00Z | -293 | 127.41% |
| L4 / full | -1,008 | -10.08% | 2026-01-31T04:00:00Z | -956 | 113.55% |
| L4 / recent | -642 | -6.42% | 2026-08-07T12:00:00Z | -514 | 230.22% |
| L5 / full | -833 | -8.33% | 2025-09-24T20:00:00Z | -835 | 76.81% |
| L5 / recent | -725 | -7.25% | 2026-06-25T04:00:00Z | -289 | 544.01% |
| R1 / full | -628 | -6.28% | 2025-10-21T12:00:00Z | -500 | 111.71% |
| R1 / recent | -592 | -5.92% | 2026-05-28T08:00:00Z | -500 | 646.96% |
| R2 / full | -628 | -6.28% | 2025-10-21T12:00:00Z | -500 | 112.72% |
| R2 / recent | -592 | -5.92% | 2026-05-28T08:00:00Z | -500 | 646.96% |
| R3 / full | -1,073 | -10.73% | 2025-08-14T16:00:00Z | -1,079 | 182.69% |
| R3 / recent | -475 | -4.75% | 2026-08-23T04:00:00Z | -286 | 116.06% |
| R4 / full | -1,073 | -10.73% | 2025-08-14T16:00:00Z | -1,079 | 186.97% |
| R4 / recent | -475 | -4.75% | 2026-08-23T04:00:00Z | -262 | 111.03% |
| R5 / full | -566 | -5.66% | 2025-11-12T00:00:00Z | -477 | 164.99% |
| R5 / recent | -346 | -3.46% | 2026-07-22T16:00:00Z | -180 | 180.54% |

**L1 October10,2025:** entry20:00 UTC at$42.863; low21:21 at$20.784
creates approximately-$5,151 gross exposure on$10k. It eventually closes
-$877. A tolerable closed result hides that survival problem. L2's worst
observed adverse move is instead8.33%; it was not holding the October crash
low. That historical absence is not a guaranteed future loss cap.

L2's largest five winners are67.65% of full closed net,125.67% of recent.
R3's are182.69% full/116.06% recent. R1 has onlyfour recent winners, totaling
$1,846 against net$285; the "topfive" column therefore includes allfour.
Values above100% mean removing those winners makes the remainder negative.
This is a concentration diagnostic, not a rule to remove winners or a new sim.

Lower historical DD does not establish safety at the live short's leverage
or notional. No25k extrapolation, joint-account exposure, funding or margin
survival claim follows from this standalone$10k model.

## 7. Coverage, failures and what is retained

| Scope | Total | Adequate samples in both windows/delays | Positive net allfour | Sample + net + extra costs + solvency |
|---|---:|---:|---:|---:|
| Long |150|144|42|10|
| Short |150|144|12|7|
| Total |300|288|54|17|

Adequate means>=30full/10recent closes in each delay. Four of the54 positive
rules lack those samples, leaving50 adequately sampled positive rules before
the additional-cost screen. Twelve scarce definitions are **inconclusive**,
not evidence the family cannot work.

All seven descriptive short survivors are **4h12/26/9**: zero_cross with
either exit, signal_cross with either exit, signal_trend with either exit,
and signal_counter with reversal-or-12h. That is a correlated cluster of
four entry meanings, not seven independent confirmations.

| Entry family | Definitions | Adequate | Positive allfour | Descriptive survivors |
|---|---|---|---|---|
| signal_cross | 60 | 60 | 9 | 4 |
| signal_trend | 60 | 54 | 12 | 2 |
| signal_counter | 60 | 58 | 13 | 4 |
| zero_cross | 60 | 56 | 14 | 6 |
| hist_turn | 60 | 60 | 6 | 1 |

### All17 descriptive survivors, not just the headline winners

Nets/closes are immediate. Worst monthly delta is the minimum across both
windows and both delays. Every definition below still fails the complete
screen; this table is not a replacement approval criterion.

| Exact ID | Full net / closes | Recent net / closes | Worst monthly Δ | Strict failures |
|---|---|---|---|---|
| `macd_30m_12_26_9_hist_turn_long_fixed12h` | +11,094 / 577 | +4,311 / 143 | -3,580 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_cross_long_indicator_or12h` | +8,905 / 91 | +2,623 / 25 | -4,637 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_cross_long_fixed12h` | +8,270 / 90 | +2,587 / 24 | -4,637 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_6_13_5_zero_cross_long_fixed12h` | +4,414 / 92 | +1,268 / 27 | -4,577 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_counter_long_indicator_or12h` | +4,372 / 64 | +342 / 17 | -4,714 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_60m_24_52_18_zero_cross_long_indicator_or12h` | +4,371 / 97 | +1,040 / 28 | -4,888 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_6_13_5_zero_cross_long_indicator_or12h` | +4,332 / 94 | +1,284 / 27 | -4,576 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_counter_long_fixed12h` | +3,957 / 63 | +306 / 16 | -4,717 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_60m_24_52_18_zero_cross_long_fixed12h` | +3,522 / 96 | +1,408 / 27 | -4,739 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_60m_24_52_18_signal_counter_long_fixed12h` | +2,763 / 122 | +905 / 28 | -4,355 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| `macd_240m_12_26_9_zero_cross_short_indicator_or12h` | +2,607 / 47 | +285 / 11 | -1,317 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_zero_cross_short_fixed12h` | +2,584 / 47 | +285 / 11 | -1,317 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_cross_short_indicator_or12h` | +2,047 / 91 | +1,849 / 25 | -2,187 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_cross_short_fixed12h` | +2,000 / 91 | +1,933 / 25 | -2,243 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_trend_short_fixed12h` | +1,133 / 35 | +1,158 / 13 | -2,436 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_trend_short_indicator_or12h` | +1,088 / 35 | +1,074 / 13 | -2,323 | monthly_regression_vs_clock |
| `macd_240m_12_26_9_signal_counter_short_indicator_or12h` | +959 / 56 | +775 / 12 | -1,902 | monthly_regression_vs_clock |

**Strict inherited screen:** adequate samples, positive absolute net AND
own-clock delta in allfour, every monthly delta nonnegative within1e-8,
positive extra-cost net and no equity exhaustion. **0/300 pass.** All17
descriptive survivors fail monthly no-regression; the selected longs also
sacrifice recent aggregate clock upside. This strict criterion is deliberately
strong: failing it does not mean every rule loses or all defensive uses fail.

**Fast churn failure is substantial:** 5m6/13/5 signal-cross/reversal short
records9,594 full closes, fees$105,552 and diagnostic net-$128,900.
Its long counterpart9,595 closes records diagnostic net-$115,933.
Twenty-five definitions exhaust modeled$32k equity in at leastone case.
The harness retains later fixed-notional diagnostic ledgers to expose the
failure; these are **not executable post-bankruptcy account trajectories**.
The appendix marks all such definitions X. They are rejected, not low-ranked
deployable alternatives.

134/150 short definitions lose allfour cases; among adequately sampled shorts,
134/144 lose full immediate. Seven adequately sampled short rules survive the
cost test; do not erase that narrower positive evidence. No claim that all MACD
or later conditional uses are exhausted.

## 8. One causal decision traced explicitly

L1's first full trade uses the following **three completed30m** observations:

| Bar start UTC | Available UTC | Histogram |
|---|---|---|
| 2025-07-01T00:00:00.000Z | 2025-07-01T00:30:00.000Z | -0.154518408866 |
| 2025-07-01T00:30:00.000Z | 2025-07-01T01:00:00.000Z | -0.169955011550 |
| 2025-07-01T01:00:00.000Z | 2025-07-01T01:30:00.000Z | -0.145280408908 |

At **2025-07-01 01:30 UTC**, previous slope is
-0.015436602684, current slope
0.024674602643, and latest
histogram is still negative. Only then is the turn known. Immediate entry
uses the01:30 minute open **$39.683**, not the01:00–01:30
bar's final close or a later low. Fixed12h exit is13:30. The delayed model
moves eligible actions byone minute and separately recomputes its ledger.

The main run checked45 actual feature prefixes and300 strategy prefixes;
adding future observations did not alter earlier features/actions. Independent
audit reconstructs bars/EMA arrays, every eligible crossing/occupied skip,
earliest subsequent exit, all fills/fees/equity/month boundaries, and these
first-trade traces. Zero publication lag remains an optimistic modeling
assumption, not a claim that final bars arrive instantly in production.

## 9. Verification and reproduction

- Original clock controls reproduced **old engine + saved I01 + new engine**
  complete ledgers, monthly rows, open marks and statistics:8exact cases
  **before MACD outcomes**. This is standalone parity, not a new ladder
  canonical-baseline certification.
- Eight new regression groups cover all300 rule boundaries, explicit seeds,
  independently weighted EMA/library fixtures, null/zero/gap/scale/linear
  cases, timeout/delay/ties, pending/occupied states and future prefixes.
- Existing17 standalone and11 closed-timing tests passed. Both normal and
  VPS TypeScript checks passed; live sources untouched by this pass.
- **1,208 cases,606,491 trade rows,12,080 monthly rows independently verified**.
  Rows repeat windows/rules; they are not606k distinct market opportunities.
- Source/input and accepted artifact hashes match. Path supplement is
  read-only; all pins also rechecked on its rawtopfive extension.

[Method and commands](../docs/research/macd-standalone-study.md),
[frozen card](../research-inputs/indicators/macd-standalone-2026-09-06.json),
[feature math](../src/research/macd-features.ts),
[engine](../scripts/macd-standalone-engine.ts),
[runner](../scripts/hype-macd-standalone-study.ts),
[tests](../scripts/macd-standalone-tests.ts),
[independent verifier](../scripts/macd-standalone-results-check.ts),
[path check](../scripts/macd-standalone-path-check.ts).

Accepted local artifacts:
`backtests/hype/hype-macd-standalone-2026-09-06/`.
Keep manifest, results/summary, monthly, trades, overlap-parity, causal-traces,
ranking, shortlist, context-controls, validation and independent verification.
Do not silently overwrite them after a new data pull.

| Artifact | SHA-256 |
|---|---|
| manifest.json | `26acc11d8920a5e9f31ff7548e40aa83093263819087d09abf3fae8a12bfdb0d` |
| results.json | `1fc76abc097a816a26ac4f646fd4b4c90367848cc526f0df6d945283559b2256` |
| monthly.json | `14a86c588ab129c30690dc505561aa7c7bde85b0d927dad4bcd0f4744e7bcd59` |
| trades.jsonl | `fca0272d2c92f2c23f6585492823099740a9712a5326c7f5581b45a12afd227e` |

### Decision / next boundary

Keep **4h signal crossings (both sides)**, **4h zero-line shorts**, and
**30m histogram-turn longs** documented with their distinct risks for later
controlled comparisons. Retain all other definitions/failures, including
scarce slow presets. Do not keep tuning MACD until a better answer appears.

Next individual study is **Bollinger/channel**: validate formula/timing, freeze
a bounded reversal-versus-breakout card, then run its own controls.
Other pending families remain in [the indicator register](INDICATOR-FINDINGS.md).
No indicator combinations, HL/S/R combinations, ladder gate implementation,
unpause or deployment from this pass. No commit/push performed.

## Appendix: all300 definitions ranked by full0m delta versus own-side clock

Not an absolute-profit cross-side leaderboard. A short avoiding exposure can
rank highly while losing money or barely trading. Cash is$0.
Each result cell is **net $ / completed closes**. Full and recent dates are
section1; F0/F1 mean immediate/+1m full, R0/R1 immediate/+1m recent.

Failure codes: N=insufficient sample, P=nonpositive net, B=does not beat own
clock somewhere, M=monthly regression, C=extra-cost failure, X=equity exhaustion.
Codes aggregate across both windows/delays. N is inconclusive; X makes
post-exhaustion ledgers diagnostic only. “Worst Δ” is marked monthly delta
versus same-side clock. All exact definitions and scopes remain explicit.

| Rank | Exact ID | F0 $ / n | F1 $ / n | R0 $ / n | R1 $ / n | Full0 Δ $ | Worst monthly Δ $ | Failures |
|---|---|---|---|---|---|---|---|---|
| 1 | `macd_240m_12_26_9_zero_cross_short_indicator_or12h` | +2,607 / 47 | +2,428 / 47 | +285 / 11 | +226 / 11 | +24,890 | -1,317 | M |
| 2 | `macd_240m_12_26_9_zero_cross_short_fixed12h` | +2,584 / 47 | +2,416 / 47 | +285 / 11 | +226 / 11 | +24,867 | -1,317 | M |
| 3 | `macd_240m_12_26_9_signal_cross_short_indicator_or12h` | +2,047 / 91 | +1,805 / 91 | +1,849 / 25 | +2,048 / 25 | +24,329 | -2,187 | M |
| 4 | `macd_240m_12_26_9_signal_cross_short_fixed12h` | +2,000 / 91 | +1,547 / 90 | +1,933 / 25 | +2,114 / 25 | +24,282 | -2,243 | M |
| 5 | `macd_240m_24_52_18_signal_trend_short_fixed12h` | +1,695 / 19 | +1,561 / 19 | +572 / 8 | +515 / 8 | +23,978 | -1,378 | N,M |
| 6 | `macd_240m_24_52_18_signal_trend_short_indicator_or12h` | +1,695 / 19 | +1,561 / 19 | +572 / 8 | +515 / 8 | +23,978 | -1,378 | N,M |
| 7 | `macd_240m_24_52_18_zero_cross_short_fixed12h` | +1,266 / 20 | +1,261 / 20 | -131 / 4 | -207 / 4 | +23,549 | -1,982 | N,P,M,C |
| 8 | `macd_240m_24_52_18_zero_cross_short_indicator_or12h` | +1,266 / 20 | +1,234 / 20 | -131 / 4 | -207 / 4 | +23,549 | -1,982 | N,P,M,C |
| 9 | `macd_240m_12_26_9_signal_trend_short_fixed12h` | +1,133 / 35 | +1,024 / 35 | +1,158 / 13 | +1,209 / 13 | +23,415 | -2,436 | M |
| 10 | `macd_240m_12_26_9_signal_trend_short_indicator_or12h` | +1,088 / 35 | +1,008 / 35 | +1,074 / 13 | +1,142 / 13 | +23,370 | -2,323 | M |
| 11 | `macd_240m_12_26_9_signal_counter_short_indicator_or12h` | +959 / 56 | +797 / 56 | +775 / 12 | +905 / 12 | +23,241 | -1,902 | M |
| 12 | `macd_240m_12_26_9_signal_counter_short_fixed12h` | +867 / 56 | +524 / 55 | +775 / 12 | +905 / 12 | +23,149 | -1,844 | M,C |
| 13 | `macd_30m_24_52_18_zero_cross_short_fixed12h` | +724 / 169 | +872 / 168 | +1,513 / 42 | +1,398 / 42 | +23,007 | -2,679 | M,C |
| 14 | `macd_60m_12_26_9_zero_cross_short_fixed12h` | +379 / 161 | +573 / 160 | +1,486 / 39 | +1,815 / 39 | +22,661 | -2,914 | M,C |
| 15 | `macd_240m_6_13_5_signal_counter_short_fixed12h` | -235 / 128 | +487 / 121 | -2,313 / 37 | -1,241 / 34 | +22,048 | -1,792 | P,M,C |
| 16 | `macd_240m_24_52_18_signal_cross_short_fixed12h` | -247 / 45 | -565 / 45 | -206 / 13 | -311 / 13 | +22,036 | -1,378 | P,M,C |
| 17 | `macd_240m_24_52_18_signal_cross_short_indicator_or12h` | -247 / 45 | -565 / 45 | -206 / 13 | -311 / 13 | +22,036 | -1,378 | P,M,C |
| 18 | `macd_60m_24_52_18_signal_trend_short_indicator_or12h` | -522 / 64 | -278 / 64 | -387 / 12 | -428 / 12 | +21,760 | -2,682 | P,M,C |
| 19 | `macd_60m_24_52_18_signal_counter_short_fixed12h` | -856 / 137 | -694 / 137 | -1,689 / 36 | -1,671 / 36 | +21,426 | -2,226 | P,M,C |
| 20 | `macd_240m_6_13_5_signal_counter_short_indicator_or12h` | -923 / 130 | -815 / 130 | -2,254 / 37 | -2,109 / 37 | +21,359 | -1,792 | P,M,C |
| 21 | `macd_30m_24_52_18_zero_cross_short_indicator_or12h` | -961 / 184 | -1,209 / 184 | -232 / 49 | -339 / 49 | +21,322 | -2,556 | P,M,C |
| 22 | `macd_60m_24_52_18_signal_counter_short_indicator_or12h` | -1,143 / 145 | -988 / 145 | -1,615 / 38 | -1,592 / 38 | +21,139 | -2,281 | P,M,C |
| 23 | `macd_60m_24_52_18_signal_trend_short_fixed12h` | -1,306 / 63 | -711 / 62 | -53 / 11 | -88 / 11 | +20,976 | -2,798 | P,M,C |
| 24 | `macd_60m_24_52_18_signal_cross_short_indicator_or12h` | -1,666 / 209 | -1,266 / 209 | -2,001 / 50 | -2,020 / 50 | +20,617 | -2,963 | P,M,C |
| 25 | `macd_240m_6_13_5_signal_trend_short_indicator_or12h` | -1,704 / 71 | -1,965 / 71 | -859 / 16 | -851 / 16 | +20,578 | -2,818 | P,M,C |
| 26 | `macd_240m_24_52_18_signal_counter_short_fixed12h` | -1,942 / 26 | -2,126 / 26 | -778 / 5 | -827 / 5 | +20,341 | -2,037 | N,P,M,C |
| 27 | `macd_240m_24_52_18_signal_counter_short_indicator_or12h` | -1,942 / 26 | -2,126 / 26 | -778 / 5 | -827 / 5 | +20,341 | -2,037 | N,P,M,C |
| 28 | `macd_60m_24_52_18_signal_cross_short_fixed12h` | -1,946 / 199 | -1,210 / 198 | -1,742 / 47 | -1,759 / 47 | +20,336 | -3,054 | P,M,C |
| 29 | `macd_240m_6_13_5_signal_trend_short_fixed12h` | -2,102 / 69 | -2,590 / 67 | -763 / 15 | -562 / 14 | +20,180 | -2,578 | P,M,C |
| 30 | `macd_240m_6_13_5_signal_cross_short_fixed12h` | -2,338 / 197 | -2,102 / 188 | -3,076 / 52 | -1,803 / 48 | +19,945 | -2,332 | P,M,C |
| 31 | `macd_60m_12_26_9_zero_cross_short_indicator_or12h` | -2,498 / 177 | -2,310 / 177 | -290 / 45 | -48 / 45 | +19,784 | -2,884 | P,M,C |
| 32 | `macd_240m_6_13_5_signal_cross_short_indicator_or12h` | -2,627 / 201 | -2,780 / 201 | -3,113 / 53 | -2,959 / 53 | +19,655 | -2,573 | P,M,C |
| 33 | `macd_15m_24_52_18_signal_trend_short_fixed12h` | -2,781 / 188 | -2,725 / 188 | +759 / 40 | +655 / 40 | +19,502 | -996 | P,M,C |
| 34 | `macd_60m_24_52_18_zero_cross_short_indicator_or12h` | -3,408 / 97 | -3,694 / 97 | -325 / 28 | -328 / 28 | +18,875 | -1,394 | P,M,C |
| 35 | `macd_240m_6_13_5_zero_cross_short_fixed12h` | -3,994 / 93 | -5,098 / 91 | -1,361 / 27 | -1,149 / 26 | +18,289 | -1,174 | P,M,C |
| 36 | `macd_240m_6_13_5_zero_cross_short_indicator_or12h` | -4,401 / 94 | -4,715 / 94 | -287 / 27 | -146 / 27 | +17,881 | -1,356 | P,M,C |
| 37 | `macd_30m_12_26_9_signal_trend_short_fixed12h` | -4,797 / 193 | -4,110 / 190 | -1,111 / 41 | -1,551 / 41 | +17,486 | -1,100 | P,M,C |
| 38 | `macd_60m_24_52_18_zero_cross_short_fixed12h` | -4,858 / 93 | -4,809 / 93 | -1,637 / 26 | -1,484 / 26 | +17,424 | -1,466 | P,M,C |
| 39 | `macd_60m_12_26_9_signal_counter_short_fixed12h` | -5,077 / 228 | -4,562 / 226 | -947 / 62 | -1,053 / 61 | +17,206 | -2,392 | P,M,C |
| 40 | `macd_15m_24_52_18_signal_trend_short_indicator_or12h` | -5,121 / 298 | -4,526 / 298 | -637 / 66 | -385 / 66 | +17,162 | -2,438 | P,M,C |
| 41 | `macd_30m_24_52_18_signal_trend_short_indicator_or12h` | -5,671 / 128 | -5,301 / 128 | -2,113 / 27 | -2,217 / 27 | +16,611 | -4,436 | P,M,C |
| 42 | `macd_60m_12_26_9_signal_trend_short_indicator_or12h` | -5,816 / 132 | -5,646 / 132 | -2,075 / 28 | -2,306 / 28 | +16,467 | -3,003 | P,M,C |
| 43 | `macd_60m_6_13_5_signal_trend_short_indicator_or12h` | -5,876 / 305 | -4,549 / 305 | -918 / 59 | -759 / 59 | +16,406 | -3,249 | P,M,C |
| 44 | `macd_30m_12_26_9_signal_trend_short_indicator_or12h` | -6,205 / 302 | -5,660 / 302 | -1,404 / 65 | -1,292 / 65 | +16,077 | -2,015 | P,M,C |
| 45 | `macd_60m_6_13_5_signal_trend_short_fixed12h` | -6,223 / 211 | -5,067 / 204 | -3,355 / 43 | -3,334 / 42 | +16,060 | -1,068 | P,M,C |
| 46 | `macd_60m_12_26_9_signal_trend_short_fixed12h` | -6,789 / 115 | -5,450 / 112 | -3,616 / 26 | -3,661 / 25 | +15,493 | -2,606 | P,M,C |
| 47 | `macd_60m_6_13_5_signal_counter_short_indicator_or12h` | -6,841 / 468 | -5,383 / 468 | -4,622 / 127 | -4,558 / 127 | +15,442 | -1,739 | P,M,C |
| 48 | `macd_240m_24_52_18_hist_turn_short_fixed12h` | -7,044 / 138 | -7,432 / 126 | -3,467 / 28 | -3,173 / 27 | +15,238 | -2,224 | P,M,C |
| 49 | `macd_60m_24_52_18_hist_turn_short_indicator_or12h` | -7,244 / 329 | -6,310 / 317 | -1,763 / 86 | -2,186 / 81 | +15,038 | -1,497 | P,M,C |
| 50 | `macd_30m_24_52_18_signal_counter_short_fixed12h` | -7,295 / 230 | -6,140 / 227 | -2,485 / 64 | -2,276 / 63 | +14,987 | -2,346 | P,M,C |
| 51 | `macd_60m_6_13_5_hist_turn_short_fixed12h` | -7,368 / 545 | -5,904 / 515 | -4,943 / 137 | -3,386 / 131 | +14,915 | -939 | P,M,C |
| 52 | `macd_15m_12_26_9_signal_trend_short_fixed12h` | -7,458 / 300 | -5,819 / 296 | -368 / 68 | -502 / 67 | +14,825 | -2,964 | P,M,C |
| 53 | `macd_30m_24_52_18_signal_trend_short_fixed12h` | -7,483 / 109 | -6,529 / 108 | -3,280 / 24 | -3,295 / 24 | +14,800 | -4,223 | P,M,C |
| 54 | `macd_30m_24_52_18_hist_turn_short_indicator_or12h` | -7,618 / 485 | -7,680 / 483 | -3,738 / 122 | -3,777 / 120 | +14,665 | -3,483 | P,M,C |
| 55 | `macd_60m_12_26_9_signal_counter_short_indicator_or12h` | -7,619 / 275 | -7,503 / 274 | -2,076 / 75 | -2,076 / 74 | +14,664 | -2,977 | P,M,C |
| 56 | `macd_30m_12_26_9_hist_turn_short_fixed12h` | -7,682 / 585 | -4,074 / 572 | -5,500 / 144 | -4,638 / 141 | +14,600 | -1,324 | P,M,C |
| 57 | `macd_30m_24_52_18_signal_counter_short_indicator_or12h` | -7,863 / 276 | -7,197 / 275 | -3,825 / 78 | -3,515 / 77 | +14,420 | -2,174 | P,M,C |
| 58 | `macd_240m_24_52_18_hist_turn_short_indicator_or12h` | -7,902 / 138 | -8,150 / 126 | -3,435 / 28 | -3,121 / 27 | +14,380 | -2,224 | P,M,C |
| 59 | `macd_60m_12_26_9_hist_turn_short_indicator_or12h` | -8,846 / 454 | -9,230 / 444 | -5,571 / 115 | -5,285 / 111 | +13,437 | -3,280 | P,M,C |
| 60 | `macd_30m_24_52_18_hist_turn_short_fixed12h` | -9,058 / 455 | -7,695 / 451 | -5,683 / 115 | -4,894 / 111 | +13,224 | -3,143 | P,M,C |
| 61 | `macd_60m_24_52_18_hist_turn_short_fixed12h` | -9,157 / 323 | -7,628 / 311 | -2,840 / 85 | -3,334 / 80 | +13,125 | -1,741 | P,M,C |
| 62 | `macd_5m_24_52_18_signal_trend_short_fixed12h` | -9,191 / 385 | -9,225 / 384 | -4,127 / 94 | -3,868 / 93 | +13,092 | -2,067 | P,M,C |
| 63 | `macd_240m_12_26_9_hist_turn_short_fixed12h` | -9,300 / 176 | -7,099 / 168 | -3,590 / 47 | -3,639 / 43 | +12,983 | -3,200 | P,M,C |
| 64 | `macd_30m_12_26_9_signal_counter_short_indicator_or12h` | -9,348 / 528 | -7,796 / 528 | -4,332 / 136 | -4,171 / 136 | +12,935 | -1,820 | P,M,C |
| 65 | `macd_30m_6_13_5_signal_trend_short_fixed12h` | -9,627 / 326 | -6,996 / 321 | -1,276 / 73 | -771 / 72 | +12,655 | -2,150 | P,M,C |
| 66 | `macd_15m_6_13_5_signal_counter_short_fixed12h` | -9,758 / 621 | -11,580 / 612 | -7,942 / 154 | -8,608 / 153 | +12,524 | -2,283 | P,M,C |
| 67 | `macd_15m_24_52_18_zero_cross_short_indicator_or12h` | -9,882 / 372 | -8,918 / 372 | -2,378 / 91 | -2,239 / 91 | +12,401 | -3,347 | P,M,C |
| 68 | `macd_5m_24_52_18_signal_counter_short_fixed12h` | -9,886 / 584 | -8,922 / 582 | -6,068 / 146 | -5,070 / 146 | +12,396 | -673 | P,M,C |
| 69 | `macd_240m_6_13_5_hist_turn_short_indicator_or12h` | -9,990 / 240 | -4,491 / 214 | -2,683 / 63 | -2,049 / 57 | +12,293 | -2,543 | P,M,C |
| 70 | `macd_30m_6_13_5_zero_cross_short_fixed12h` | -10,037 / 458 | -13,275 / 454 | -3,359 / 117 | -4,363 / 116 | +12,246 | -1,816 | P,M,C |
| 71 | `macd_15m_6_13_5_zero_cross_short_fixed12h` | -10,175 / 593 | -9,729 / 588 | -5,156 / 150 | -5,494 / 149 | +12,107 | -980 | P,M,C |
| 72 | `macd_240m_12_26_9_hist_turn_short_indicator_or12h` | -10,216 / 176 | -8,293 / 168 | -3,641 / 47 | -3,730 / 43 | +12,067 | -3,427 | P,M,C |
| 73 | `macd_15m_12_26_9_signal_trend_short_indicator_or12h` | -10,505 / 593 | -9,980 / 593 | -2,277 / 148 | -1,825 / 148 | +11,778 | -3,882 | P,M,C |
| 74 | `macd_15m_24_52_18_signal_counter_short_indicator_or12h` | -10,716 / 547 | -9,202 / 547 | -4,970 / 142 | -4,706 / 142 | +11,567 | -1,668 | P,M,C |
| 75 | `macd_240m_6_13_5_hist_turn_short_fixed12h` | -10,890 / 240 | -5,417 / 214 | -3,913 / 63 | -3,203 / 57 | +11,393 | -2,721 | P,M,C |
| 76 | `macd_60m_6_13_5_hist_turn_short_indicator_or12h` | -11,461 / 654 | -11,659 / 644 | -5,717 / 162 | -5,439 / 160 | +10,821 | -3,230 | P,M,C |
| 77 | `macd_15m_24_52_18_signal_counter_short_fixed12h` | -11,542 / 351 | -10,641 / 348 | -2,906 / 93 | -3,052 / 93 | +10,741 | -3,347 | P,M,C |
| 78 | `macd_15m_24_52_18_hist_turn_short_fixed12h` | -11,851 / 603 | -11,751 / 596 | -7,748 / 150 | -6,606 / 149 | +10,432 | -1,659 | P,M,C |
| 79 | `macd_60m_12_26_9_hist_turn_short_fixed12h` | -11,889 / 430 | -11,113 / 417 | -6,259 / 110 | -5,112 / 105 | +10,393 | -2,471 | P,M,C |
| 80 | `macd_5m_24_52_18_zero_cross_short_fixed12h` | -12,268 / 545 | -11,271 / 542 | -4,753 / 139 | -3,999 / 138 | +10,015 | -1,999 | P,M,C |
| 81 | `macd_30m_12_26_9_hist_turn_short_indicator_or12h` | -12,366 / 762 | -12,337 / 758 | -5,088 / 193 | -5,137 / 193 | +9,916 | -2,299 | P,M,C |
| 82 | `macd_60m_12_26_9_signal_cross_short_fixed12h` | -12,632 / 341 | -10,464 / 334 | -4,563 / 88 | -4,714 / 86 | +9,651 | -3,034 | P,M,C |
| 83 | `macd_60m_6_13_5_signal_cross_short_indicator_or12h` | -12,717 / 773 | -9,932 / 773 | -5,540 / 186 | -5,317 / 186 | +9,565 | -2,122 | P,M,C |
| 84 | `macd_30m_12_26_9_zero_cross_short_indicator_or12h` | -12,979 / 380 | -12,203 / 380 | -3,958 / 97 | -3,507 / 97 | +9,304 | -4,045 | P,M,C |
| 85 | `macd_60m_6_13_5_zero_cross_short_indicator_or12h` | -13,176 / 374 | -12,549 / 374 | -4,096 / 96 | -3,629 / 96 | +9,106 | -3,677 | P,M,C |
| 86 | `macd_15m_12_26_9_signal_counter_short_fixed12h` | -13,220 / 490 | -12,953 / 484 | -4,265 / 124 | -4,667 / 121 | +9,062 | -2,959 | P,M,C |
| 87 | `macd_30m_6_13_5_signal_trend_short_indicator_or12h` | -13,261 / 624 | -11,138 / 624 | -2,864 / 155 | -1,956 / 155 | +9,022 | -3,746 | P,M,C |
| 88 | `macd_60m_12_26_9_signal_cross_short_indicator_or12h` | -13,435 / 407 | -13,149 / 406 | -4,151 / 103 | -4,381 / 102 | +8,848 | -3,943 | P,M,C |
| 89 | `macd_15m_12_26_9_zero_cross_short_fixed12h` | -13,501 / 455 | -13,667 / 453 | -4,716 / 116 | -4,547 / 116 | +8,781 | -2,815 | P,M,C |
| 90 | `macd_30m_24_52_18_signal_cross_short_indicator_or12h` | -13,534 / 404 | -12,498 / 403 | -5,938 / 105 | -5,732 / 104 | +8,749 | -4,578 | P,M,C |
| 91 | `macd_30m_6_13_5_signal_counter_short_fixed12h` | -13,948 / 472 | -9,086 / 463 | -5,073 / 121 | -3,801 / 119 | +8,334 | -2,569 | P,M,C |
| 92 | `macd_60m_6_13_5_signal_counter_short_fixed12h` | -14,109 / 330 | -12,893 / 317 | -3,862 / 89 | -4,275 / 88 | +8,174 | -2,157 | P,M,C |
| 93 | `macd_30m_12_26_9_signal_counter_short_fixed12h` | -14,165 / 346 | -12,791 / 343 | -3,531 / 93 | -3,316 / 93 | +8,118 | -3,368 | P,M,C |
| 94 | `macd_5m_6_13_5_signal_counter_short_fixed12h` | -14,486 / 764 | -18,325 / 760 | -6,452 / 196 | -7,559 / 195 | +7,797 | -1,672 | P,M,C |
| 95 | `macd_30m_12_26_9_hist_turn_long_fixed12h` | +11,094 / 577 | +8,669 / 570 | +4,311 / 143 | +4,541 / 142 | +7,789 | -3,580 | B,M |
| 96 | `macd_15m_24_52_18_signal_cross_short_fixed12h` | -14,736 / 504 | -13,603 / 500 | -3,049 / 124 | -3,148 / 124 | +7,547 | -3,115 | P,M,C |
| 97 | `macd_15m_12_26_9_signal_cross_short_fixed12h` | -15,034 / 636 | -14,124 / 625 | -5,432 / 159 | -5,075 / 157 | +7,249 | -1,671 | P,M,C |
| 98 | `macd_15m_24_52_18_zero_cross_short_fixed12h` | -15,162 / 300 | -14,297 / 299 | -4,922 / 77 | -4,410 / 76 | +7,121 | -3,779 | P,M,C |
| 99 | `macd_15m_24_52_18_hist_turn_short_indicator_or12h` | -15,192 / 825 | -14,764 / 822 | -6,160 / 209 | -6,351 / 209 | +7,090 | -1,995 | P,M,C |
| 100 | `macd_30m_6_13_5_zero_cross_short_indicator_or12h` | -15,288 / 746 | -14,845 / 746 | -3,808 / 178 | -4,021 / 178 | +6,995 | -2,076 | P,M,C |
| 101 | `macd_30m_24_52_18_signal_cross_short_fixed12h` | -15,544 / 337 | -13,440 / 333 | -5,765 / 88 | -5,571 / 87 | +6,739 | -4,558 | P,M,C |
| 102 | `macd_30m_12_26_9_signal_cross_short_indicator_or12h` | -15,553 / 830 | -13,456 / 830 | -5,736 / 201 | -5,463 / 201 | +6,729 | -1,986 | P,M,C |
| 103 | `macd_60m_6_13_5_zero_cross_short_fixed12h` | -15,581 / 311 | -15,372 / 304 | -6,284 / 82 | -4,864 / 81 | +6,702 | -3,763 | P,M,C |
| 104 | `macd_5m_24_52_18_signal_trend_short_indicator_or12h` | -15,586 / 922 | -13,870 / 922 | -3,815 / 231 | -3,422 / 231 | +6,696 | -5,132 | P,M,C |
| 105 | `macd_5m_12_26_9_hist_turn_short_fixed12h` | -15,704 / 799 | -19,399 / 794 | -8,174 / 205 | -10,464 / 202 | +6,579 | -1,328 | P,B,M,C |
| 106 | `macd_15m_24_52_18_signal_cross_short_indicator_or12h` | -15,836 / 845 | -13,728 / 845 | -5,608 / 208 | -5,091 / 208 | +6,446 | -1,775 | P,M,C |
| 107 | `macd_240m_12_26_9_signal_cross_long_indicator_or12h` | +8,905 / 91 | +9,071 / 91 | +2,623 / 25 | +2,694 / 25 | +5,600 | -4,637 | B,M |
| 108 | `macd_30m_12_26_9_zero_cross_short_fixed12h` | -16,794 / 305 | -16,248 / 301 | -6,167 / 80 | -5,877 / 79 | +5,489 | -3,407 | P,M,C |
| 109 | `macd_240m_12_26_9_signal_cross_long_fixed12h` | +8,270 / 90 | +8,632 / 89 | +2,587 / 24 | +2,603 / 24 | +4,965 | -4,637 | B,M |
| 110 | `macd_15m_12_26_9_zero_cross_short_indicator_or12h` | -17,895 / 747 | -17,426 / 747 | -5,428 / 180 | -5,369 / 180 | +4,387 | -2,778 | P,M,C |
| 111 | `macd_5m_12_26_9_zero_cross_short_fixed12h` | -17,932 / 674 | -15,636 / 670 | -8,771 / 171 | -7,974 / 170 | +4,350 | -1,012 | P,M,C |
| 112 | `macd_30m_12_26_9_signal_cross_short_fixed12h` | -18,292 / 508 | -17,267 / 499 | -3,438 / 125 | -3,908 / 124 | +3,991 | -2,558 | P,M,C |
| 113 | `macd_15m_6_13_5_signal_cross_short_fixed12h` | -18,436 / 734 | -16,851 / 721 | -7,880 / 188 | -6,817 / 185 | +3,846 | -1,166 | P,M,C |
| 114 | `macd_5m_24_52_18_hist_turn_short_fixed12h` | -18,920 / 758 | -19,011 / 754 | -11,037 / 192 | -9,825 / 191 | +3,363 | -2,726 | P,B,M,C |
| 115 | `macd_30m_6_13_5_signal_cross_short_fixed12h` | -19,199 / 641 | -16,182 / 622 | -6,017 / 160 | -5,367 / 157 | +3,083 | -1,968 | P,M,C |
| 116 | `macd_30m_6_13_5_hist_turn_short_indicator_or12h` | -19,331 / 1231 | -21,169 / 1228 | -5,673 / 319 | -6,417 / 319 | +2,952 | -2,791 | P,M,C |
| 117 | `macd_15m_24_52_18_hist_turn_long_fixed12h` | +6,116 / 602 | +4,619 / 594 | +6,499 / 146 | +6,121 / 145 | +2,812 | -3,261 | M,C |
| 118 | `macd_60m_6_13_5_signal_cross_short_fixed12h` | -19,480 / 514 | -15,733 / 490 | -6,141 / 127 | -6,539 / 124 | +2,803 | -3,326 | P,M,C |
| 119 | `macd_5m_6_13_5_hist_turn_long_fixed12h` | +5,888 / 823 | +3,622 / 815 | +4,816 / 209 | +4,317 / 208 | +2,583 | -1,651 | B,M,C |
| 120 | `macd_15m_6_13_5_signal_trend_short_fixed12h` | -19,710 / 471 | -19,367 / 465 | -8,327 / 121 | -8,470 / 120 | +2,573 | -5,413 | P,M,C |
| 121 | `macd_15m_6_13_5_signal_trend_short_indicator_or12h` | -19,939 / 1234 | -19,189 / 1234 | -4,951 / 328 | -4,499 / 328 | +2,344 | -5,717 | P,M,C |
| 122 | `macd_30m_6_13_5_signal_counter_short_indicator_or12h` | -20,123 / 948 | -18,035 / 948 | -9,218 / 253 | -8,576 / 253 | +2,160 | -3,789 | P,M,C |
| 123 | `macd_30m_6_13_5_hist_turn_long_fixed12h` | +5,191 / 661 | -2,743 / 635 | +835 / 168 | +2,419 / 163 | +1,887 | -3,371 | P,B,M,C |
| 124 | `macd_5m_24_52_18_signal_cross_short_fixed12h` | -20,519 / 703 | -18,218 / 701 | -7,184 / 179 | -6,484 / 178 | +1,764 | -1,676 | P,M,C |
| 125 | `macd_15m_6_13_5_hist_turn_short_fixed12h` | -20,653 / 751 | -17,451 / 736 | -9,681 / 191 | -8,104 / 187 | +1,630 | -2,235 | P,M,C |
| 126 | `macd_5m_12_26_9_signal_trend_short_fixed12h` | -20,805 / 536 | -21,371 / 536 | -7,563 / 134 | -7,499 / 134 | +1,478 | -4,014 | P,M,C |
| 127 | `macd_240m_12_26_9_signal_trend_long_indicator_or12h` | +4,532 / 27 | +4,402 / 27 | +2,280 / 8 | +2,284 / 8 | +1,228 | -5,702 | N,B,M |
| 128 | `macd_240m_6_13_5_zero_cross_long_fixed12h` | +4,414 / 92 | +4,438 / 90 | +1,268 / 27 | +1,253 / 26 | +1,110 | -4,577 | B,M |
| 129 | `macd_15m_6_13_5_signal_counter_long_fixed12h` | +4,385 / 613 | +5,490 / 604 | +4,334 / 155 | +5,100 / 154 | +1,081 | -2,699 | B,M,C |
| 130 | `macd_240m_12_26_9_signal_counter_long_indicator_or12h` | +4,372 / 64 | +4,670 / 64 | +342 / 17 | +410 / 17 | +1,068 | -4,714 | B,M |
| 131 | `macd_60m_24_52_18_zero_cross_long_indicator_or12h` | +4,371 / 97 | +4,489 / 97 | +1,040 / 28 | +1,081 / 28 | +1,067 | -4,888 | B,M |
| 132 | `macd_240m_6_13_5_zero_cross_long_indicator_or12h` | +4,332 / 94 | +4,462 / 94 | +1,284 / 27 | +1,236 / 27 | +1,028 | -4,576 | B,M |
| 133 | `macd_240m_12_26_9_signal_trend_long_fixed12h` | +4,313 / 27 | +4,424 / 26 | +2,280 / 8 | +2,284 / 8 | +1,008 | -5,702 | N,B,M |
| 134 | `macd_15m_12_26_9_hist_turn_short_indicator_or12h` | -21,324 / 1451 | -23,168 / 1450 | -6,299 / 373 | -6,560 / 373 | +959 | -3,600 | P,B,M,C |
| 135 | `macd_5m_24_52_18_hist_turn_long_fixed12h` | +4,102 / 764 | +6,840 / 761 | +2,967 / 195 | +3,300 / 194 | +797 | -1,850 | B,M,C |
| 136 | `macd_15m_12_26_9_hist_turn_short_fixed12h` | -21,517 / 699 | -20,314 / 690 | -9,154 / 175 | -9,376 / 171 | +766 | -1,990 | P,M,C |
| 137 | `macd_240m_12_26_9_signal_counter_long_fixed12h` | +3,957 / 63 | +4,208 / 63 | +306 / 16 | +319 / 16 | +652 | -4,717 | B,M |
| 138 | `macd_5m_24_52_18_signal_counter_long_fixed12h` | +3,946 / 583 | +5,042 / 579 | +6,667 / 142 | +6,796 / 142 | +641 | -3,102 | M,C |
| 139 | `macd_15m_12_26_9_signal_counter_short_indicator_or12h` | -21,714 / 1054 | -20,073 / 1054 | -7,046 / 271 | -6,493 / 271 | +568 | -3,594 | P,M,C |
| 140 | `macd_30m_6_13_5_signal_counter_long_fixed12h` | +3,864 / 480 | +1,653 / 471 | +3,595 / 119 | +3,832 / 116 | +559 | -3,616 | B,M,C |
| 141 | `macd_5m_12_26_9_signal_counter_short_fixed12h` | -21,781 / 696 | -21,497 / 693 | -8,318 / 179 | -6,369 / 177 | +502 | -3,543 | P,M,C |
| 142 | `macd_5m_6_13_5_signal_cross_long_fixed12h` | +3,654 / 813 | +245 / 810 | +4,488 / 207 | +3,361 / 206 | +349 | -1,353 | B,M,C |
| 143 | `macd_5m_6_13_5_zero_cross_short_fixed12h` | -21,975 / 756 | -23,213 / 750 | -10,593 / 194 | -11,005 / 192 | +308 | -1,539 | P,B,M,C |
| 144 | `macd_30m_6_13_5_hist_turn_short_fixed12h` | -21,988 / 673 | -20,499 / 648 | -7,854 / 169 | -8,177 / 163 | +294 | -2,666 | P,M,C |
| 145 | `macd_5m_6_13_5_signal_cross_short_fixed12h` | -22,005 / 814 | -20,850 / 809 | -10,218 / 208 | -9,327 / 207 | +277 | -1,815 | P,B,M,C |
| 146 | `macd_60m_6_13_5_hist_turn_long_fixed12h` | +3,545 / 531 | +3,705 / 513 | +3,410 / 133 | +1,845 / 129 | +241 | -3,779 | B,M,C |
| 147 | `macd_15m_12_26_9_signal_counter_long_fixed12h` | +3,525 / 497 | +2,904 / 488 | +7,142 / 122 | +6,972 / 121 | +220 | -3,652 | B,M,C |
| 148 | `macd_60m_24_52_18_zero_cross_long_fixed12h` | +3,522 / 96 | +3,651 / 96 | +1,408 / 27 | +1,407 / 27 | +218 | -4,739 | B,M |
| 149 | `macd_15m_6_13_5_signal_cross_long_fixed12h` | +3,383 / 741 | +4,858 / 727 | +3,555 / 189 | +6,597 / 186 | +78 | -2,091 | B,M,C |
| 150 | `macd_5m_12_26_9_signal_cross_short_fixed12h` | -22,443 / 774 | -21,828 / 771 | -11,060 / 198 | -11,442 / 196 | -160 | -2,086 | P,B,M,C |
| 151 | `macd_5m_12_26_9_signal_cross_long_fixed12h` | +2,962 / 775 | +3,152 / 769 | +5,278 / 197 | +4,047 / 195 | -343 | -2,347 | B,M,C |
| 152 | `macd_30m_12_26_9_signal_trend_long_fixed12h` | +2,772 / 205 | +2,471 / 203 | +684 / 54 | +381 / 54 | -533 | -4,521 | B,M,C |
| 153 | `macd_60m_24_52_18_signal_counter_long_fixed12h` | +2,763 / 122 | +2,417 / 120 | +905 / 28 | +759 / 27 | -542 | -4,355 | B,M |
| 154 | `macd_30m_12_26_9_zero_cross_long_fixed12h` | +2,668 / 296 | +3,139 / 292 | +1,764 / 80 | +2,526 / 78 | -637 | -3,805 | B,M,C |
| 155 | `macd_240m_6_13_5_signal_counter_long_fixed12h` | +2,038 / 119 | +2,288 / 115 | -265 / 27 | -308 / 27 | -1,266 | -4,439 | P,B,M,C |
| 156 | `macd_15m_6_13_5_signal_trend_long_fixed12h` | +1,890 / 479 | +2,463 / 474 | +5,930 / 123 | +5,909 / 122 | -1,414 | -2,435 | B,M,C |
| 157 | `macd_15m_24_52_18_signal_trend_long_fixed12h` | +1,710 / 207 | +2,290 / 204 | +1,187 / 55 | +1,607 / 54 | -1,594 | -4,113 | B,M,C |
| 158 | `macd_30m_24_52_18_signal_counter_long_fixed12h` | +1,529 / 217 | +2,099 / 216 | +3,259 / 50 | +2,830 / 49 | -1,775 | -4,616 | B,M,C |
| 159 | `macd_15m_6_13_5_hist_turn_short_indicator_or12h` | -24,135 / 2506 | -24,711 / 2506 | -7,895 / 639 | -7,746 / 639 | -1,853 | -2,765 | P,B,M,C |
| 160 | `macd_15m_24_52_18_zero_cross_long_fixed12h` | +1,435 / 288 | +2,089 / 287 | +1,649 / 77 | +2,226 / 77 | -1,869 | -3,667 | B,M,C |
| 161 | `macd_5m_6_13_5_hist_turn_short_fixed12h` | -24,222 / 821 | -22,555 / 815 | -8,649 / 209 | -7,931 / 208 | -1,940 | -1,521 | P,B,M,C |
| 162 | `macd_30m_24_52_18_zero_cross_long_indicator_or12h` | +1,337 / 184 | +987 / 184 | +1,321 / 49 | +1,231 / 49 | -1,967 | -4,991 | B,M,C |
| 163 | `macd_60m_24_52_18_signal_cross_long_fixed12h` | +1,284 / 195 | +632 / 192 | +1,947 / 49 | +1,749 / 48 | -2,020 | -4,228 | B,M,C |
| 164 | `macd_240m_12_26_9_zero_cross_long_indicator_or12h` | +1,227 / 47 | +1,109 / 47 | -675 / 11 | -732 / 11 | -2,078 | -5,377 | P,B,M,C |
| 165 | `macd_5m_6_13_5_signal_counter_long_fixed12h` | +1,167 / 759 | +6,182 / 756 | +3,919 / 192 | +4,795 / 192 | -2,137 | -3,141 | B,M,C |
| 166 | `macd_240m_12_26_9_zero_cross_long_fixed12h` | +1,132 / 47 | +1,032 / 47 | -491 / 11 | -507 / 11 | -2,173 | -5,377 | P,B,M,C |
| 167 | `macd_60m_12_26_9_zero_cross_long_indicator_or12h` | +996 / 177 | +554 / 177 | +2,154 / 45 | +2,064 / 45 | -2,309 | -4,516 | B,M,C |
| 168 | `macd_60m_24_52_18_signal_counter_long_indicator_or12h` | +917 / 128 | +891 / 128 | +365 / 28 | +362 / 28 | -2,387 | -4,355 | B,M,C |
| 169 | `macd_240m_6_13_5_hist_turn_long_indicator_or12h` | +762 / 260 | +799 / 231 | +84 / 63 | -343 / 54 | -2,542 | -5,033 | P,B,M,C |
| 170 | `macd_60m_24_52_18_hist_turn_long_indicator_or12h` | +758 / 330 | +575 / 319 | +131 / 72 | -40 / 69 | -2,546 | -5,559 | P,B,M,C |
| 171 | `macd_240m_6_13_5_signal_counter_long_indicator_or12h` | +747 / 122 | +969 / 122 | -277 / 29 | -220 / 29 | -2,558 | -4,478 | P,B,M,C |
| 172 | `macd_15m_6_13_5_hist_turn_long_fixed12h` | +667 / 754 | +494 / 740 | +3,593 / 190 | +2,017 / 188 | -2,638 | -3,054 | B,M,C |
| 173 | `macd_5m_12_26_9_hist_turn_long_fixed12h` | +650 / 799 | -1,601 / 793 | +2,667 / 203 | +4,081 / 203 | -2,655 | -1,636 | P,B,M,C |
| 174 | `macd_5m_6_13_5_zero_cross_long_fixed12h` | +605 / 762 | +1,279 / 754 | +3,898 / 192 | +4,264 / 191 | -2,700 | -2,093 | B,M,C |
| 175 | `macd_5m_6_13_5_signal_trend_long_fixed12h` | +367 / 677 | +2,088 / 674 | +6,725 / 175 | +6,905 / 173 | -2,937 | -3,929 | B,M,C |
| 176 | `macd_60m_12_26_9_signal_counter_long_fixed12h` | +264 / 213 | +828 / 210 | +2,637 / 48 | +2,683 / 48 | -3,041 | -4,689 | B,M,C |
| 177 | `macd_15m_12_26_9_signal_cross_long_fixed12h` | +181 / 641 | +2,622 / 632 | +4,321 / 162 | +5,656 / 161 | -3,123 | -2,898 | B,M,C |
| 178 | `macd_5m_12_26_9_signal_trend_long_fixed12h` | +139 / 544 | +793 / 540 | +4,833 / 137 | +4,533 / 135 | -3,166 | -1,713 | B,M,C |
| 179 | `macd_60m_6_13_5_zero_cross_long_fixed12h` | +93 / 299 | +2,364 / 292 | +1,597 / 78 | +1,720 / 77 | -3,211 | -3,496 | B,M,C |
| 180 | `macd_30m_24_52_18_zero_cross_long_fixed12h` | +32 / 167 | -443 / 164 | +755 / 44 | +755 / 44 | -3,273 | -4,945 | P,B,M,C |
| 181 | `macd_60m_6_13_5_signal_trend_long_fixed12h` | +7 / 218 | +1,352 / 208 | +2,846 / 59 | +3,069 / 57 | -3,298 | -4,561 | B,M,C |
| 182 | `macd_5m_24_52_18_zero_cross_long_fixed12h` | -21 / 547 | -154 / 545 | +4,824 / 135 | +4,491 / 134 | -3,325 | -2,428 | P,B,M,C |
| 183 | `macd_60m_12_26_9_zero_cross_long_fixed12h` | -373 / 161 | -830 / 160 | +1,380 / 42 | +1,356 / 42 | -3,678 | -4,510 | P,B,M,C |
| 184 | `macd_5m_6_13_5_signal_trend_short_fixed12h` | -26,255 / 667 | -24,069 / 663 | -6,321 / 169 | -6,275 / 169 | -3,972 | -4,083 | P,B,M,C |
| 185 | `macd_5m_12_26_9_signal_trend_short_indicator_or12h` | -26,565 / 1799 | -25,430 / 1799 | -7,513 / 463 | -7,501 / 463 | -4,282 | -5,088 | P,B,M,C |
| 186 | `macd_240m_24_52_18_zero_cross_long_fixed12h` | -1,011 / 20 | -1,023 / 20 | +311 / 4 | +279 / 4 | -4,316 | -6,307 | N,P,B,M,C |
| 187 | `macd_240m_24_52_18_zero_cross_long_indicator_or12h` | -1,011 / 20 | -1,023 / 20 | +311 / 4 | +279 / 4 | -4,316 | -6,307 | N,P,B,M,C |
| 188 | `macd_240m_24_52_18_signal_trend_long_fixed12h` | -1,065 / 10 | -1,033 / 10 | +118 / 1 | +158 / 1 | -4,370 | -5,757 | N,P,B,M,C |
| 189 | `macd_240m_24_52_18_signal_trend_long_indicator_or12h` | -1,065 / 10 | -1,028 / 10 | +118 / 1 | +158 / 1 | -4,370 | -5,757 | N,P,B,M,C |
| 190 | `macd_240m_6_13_5_signal_cross_long_fixed12h` | -1,087 / 197 | -1,207 / 191 | +28 / 50 | +8 / 50 | -4,391 | -4,682 | P,B,M,C |
| 191 | `macd_60m_24_52_18_signal_cross_long_indicator_or12h` | -1,096 / 209 | -1,017 / 209 | +1,833 / 50 | +1,826 / 50 | -4,400 | -3,898 | P,B,M,C |
| 192 | `macd_240m_24_52_18_signal_counter_long_indicator_or12h` | -1,107 / 34 | -1,056 / 34 | -512 / 11 | -438 / 11 | -4,412 | -5,293 | P,B,M,C |
| 193 | `macd_60m_6_13_5_signal_trend_long_indicator_or12h` | -1,138 / 303 | -383 / 303 | -581 / 83 | -514 / 83 | -4,443 | -5,090 | P,B,M,C |
| 194 | `macd_15m_12_26_9_zero_cross_long_fixed12h` | -1,181 / 446 | -2,136 / 440 | +2,445 / 110 | +2,197 / 110 | -4,486 | -3,135 | P,B,M,C |
| 195 | `macd_240m_24_52_18_signal_counter_long_fixed12h` | -1,248 / 34 | -1,226 / 34 | -653 / 11 | -608 / 11 | -4,553 | -5,293 | P,B,M,C |
| 196 | `macd_240m_6_13_5_signal_cross_long_indicator_or12h` | -1,259 / 201 | -1,006 / 201 | -127 / 53 | +46 / 53 | -4,564 | -5,021 | P,B,M,C |
| 197 | `macd_5m_24_52_18_hist_turn_short_indicator_or12h` | -26,857 / 2374 | -27,062 / 2374 | -8,069 / 612 | -8,180 / 612 | -4,574 | -3,133 | P,B,M,C |
| 198 | `macd_30m_6_13_5_signal_trend_long_fixed12h` | -1,418 / 326 | -19 / 320 | +3,011 / 92 | +2,243 / 92 | -4,722 | -2,666 | P,B,M,C |
| 199 | `macd_60m_24_52_18_signal_trend_long_fixed12h` | -1,479 / 73 | -1,325 / 73 | +1,041 / 21 | +990 / 21 | -4,783 | -4,520 | P,B,M,C |
| 200 | `macd_5m_24_52_18_signal_cross_long_fixed12h` | -1,515 / 700 | +609 / 698 | +4,591 / 176 | +4,961 / 176 | -4,820 | -2,303 | P,B,M,C |
| 201 | `macd_30m_12_26_9_signal_trend_long_indicator_or12h` | -1,542 / 311 | -630 / 311 | -1,800 / 77 | -1,586 / 77 | -4,847 | -5,313 | P,B,M,C |
| 202 | `macd_15m_24_52_18_signal_trend_long_indicator_or12h` | -1,555 / 311 | -588 / 311 | -1,719 / 80 | -1,473 / 80 | -4,859 | -5,477 | P,B,M,C |
| 203 | `macd_5m_24_52_18_zero_cross_short_indicator_or12h` | -27,336 / 1127 | -24,889 / 1127 | -6,798 / 273 | -6,545 / 273 | -5,054 | -4,159 | P,B,M,C |
| 204 | `macd_5m_24_52_18_signal_trend_long_fixed12h` | -1,770 / 384 | -2,012 / 384 | +1,423 / 104 | +1,221 / 104 | -5,074 | -3,767 | P,B,M,C |
| 205 | `macd_30m_24_52_18_signal_counter_long_indicator_or12h` | -1,939 / 252 | -597 / 252 | +2,726 / 57 | +2,578 / 57 | -5,243 | -4,553 | P,B,M,C |
| 206 | `macd_240m_6_13_5_signal_trend_long_indicator_or12h` | -2,006 / 79 | -1,975 / 79 | +150 / 24 | +265 / 24 | -5,310 | -4,927 | P,B,M,C |
| 207 | `macd_60m_24_52_18_signal_trend_long_indicator_or12h` | -2,013 / 81 | -1,908 / 81 | +1,468 / 22 | +1,464 / 22 | -5,318 | -4,616 | P,B,M,C |
| 208 | `macd_60m_6_13_5_signal_counter_long_indicator_or12h` | -2,099 / 470 | -31 / 470 | +906 / 102 | +950 / 102 | -5,404 | -3,288 | P,B,M,C |
| 209 | `macd_240m_24_52_18_signal_cross_long_indicator_or12h` | -2,172 / 44 | -2,083 / 44 | -395 / 12 | -280 / 12 | -5,477 | -5,249 | P,B,M,C |
| 210 | `macd_240m_6_13_5_hist_turn_long_fixed12h` | -2,299 / 260 | +761 / 228 | +864 / 63 | +516 / 54 | -5,604 | -4,387 | P,B,M,C |
| 211 | `macd_240m_24_52_18_signal_cross_long_fixed12h` | -2,313 / 44 | -2,259 / 44 | -536 / 12 | -450 / 12 | -5,618 | -5,249 | P,B,M,C |
| 212 | `macd_15m_12_26_9_hist_turn_long_fixed12h` | -2,474 / 695 | -2,482 / 685 | -254 / 179 | -1,151 / 176 | -5,778 | -2,724 | P,B,M,C |
| 213 | `macd_15m_12_26_9_signal_trend_long_fixed12h` | -2,508 / 316 | -2,852 / 315 | +461 / 86 | +719 / 85 | -5,812 | -2,492 | P,B,M,C |
| 214 | `macd_60m_12_26_9_signal_counter_long_indicator_or12h` | -2,579 / 249 | -2,046 / 249 | +2,286 / 55 | +2,095 / 55 | -5,884 | -4,278 | P,B,M,C |
| 215 | `macd_30m_24_52_18_signal_cross_long_fixed12h` | -2,589 / 339 | -2,264 / 338 | +2,457 / 84 | +1,871 / 83 | -5,894 | -4,466 | P,B,M,C |
| 216 | `macd_15m_24_52_18_hist_turn_long_indicator_or12h` | -2,741 / 808 | -4,783 / 806 | +756 / 196 | +703 / 196 | -6,045 | -5,757 | P,B,M,C |
| 217 | `macd_240m_6_13_5_signal_trend_long_fixed12h` | -3,125 / 78 | -3,064 / 77 | +293 / 23 | +316 / 23 | -6,429 | -4,627 | P,B,M,C |
| 218 | `macd_30m_24_52_18_hist_turn_long_fixed12h` | -3,141 / 451 | -3,134 / 440 | +3,129 / 115 | +3,034 / 112 | -6,445 | -2,888 | P,B,M,C |
| 219 | `macd_240m_12_26_9_hist_turn_long_fixed12h` | -3,151 / 202 | -4,181 / 179 | +957 / 55 | +653 / 48 | -6,455 | -5,862 | P,B,M,C |
| 220 | `macd_30m_6_13_5_zero_cross_long_fixed12h` | -3,167 / 450 | -3,744 / 440 | +1,066 / 111 | +1,138 / 110 | -6,471 | -3,414 | P,B,M,C |
| 221 | `macd_60m_6_13_5_hist_turn_long_indicator_or12h` | -3,172 / 637 | -4,910 / 633 | -141 / 153 | -762 / 152 | -6,476 | -6,209 | P,B,M,C |
| 222 | `macd_60m_6_13_5_signal_cross_long_indicator_or12h` | -3,237 / 773 | -414 / 773 | +325 / 185 | +436 / 185 | -6,542 | -2,897 | P,B,M,C |
| 223 | `macd_30m_12_26_9_hist_turn_long_indicator_or12h` | -3,250 / 740 | -3,940 / 736 | +671 / 183 | +744 / 182 | -6,554 | -6,540 | P,B,M,C |
| 224 | `macd_30m_6_13_5_hist_turn_long_indicator_or12h` | -3,277 / 1210 | -3,419 / 1209 | -175 / 305 | -301 / 305 | -6,582 | -5,063 | P,B,M,C |
| 225 | `macd_30m_12_26_9_zero_cross_long_indicator_or12h` | -3,429 / 380 | -2,374 / 380 | +1,978 / 97 | +2,641 / 97 | -6,733 | -4,260 | P,B,M,C |
| 226 | `macd_15m_24_52_18_zero_cross_long_indicator_or12h` | -3,449 / 372 | -2,032 / 372 | +2,561 / 91 | +3,179 / 91 | -6,754 | -5,044 | P,B,M,C |
| 227 | `macd_30m_24_52_18_hist_turn_long_indicator_or12h` | -3,598 / 495 | -5,214 / 483 | +849 / 130 | +864 / 126 | -6,903 | -6,049 | P,B,M,C |
| 228 | `macd_30m_6_13_5_signal_cross_long_fixed12h` | -3,747 / 644 | -4,341 / 631 | +1,725 / 166 | +2,112 / 162 | -7,052 | -2,490 | P,B,M,C |
| 229 | `macd_30m_24_52_18_signal_trend_long_indicator_or12h` | -3,813 / 152 | -3,748 / 152 | -2,045 / 47 | -2,121 / 47 | -7,117 | -5,474 | P,B,M,C |
| 230 | `macd_5m_12_26_9_zero_cross_long_fixed12h` | -3,830 / 676 | -3,625 / 672 | +3,292 / 167 | +3,516 / 167 | -7,135 | -2,682 | P,B,M,C |
| 231 | `macd_60m_12_26_9_signal_cross_long_fixed12h` | -3,900 / 341 | -2,380 / 335 | +1,748 / 83 | +2,661 / 81 | -7,204 | -4,691 | P,B,M,C |
| 232 | `macd_5m_24_52_18_signal_counter_short_indicator_or12h` | -29,628 / 1667 | -27,915 / 1667 | -10,767 / 435 | -10,878 / 435 | -7,345 | -3,230 | P,B,M,C |
| 233 | `macd_60m_12_26_9_signal_trend_long_indicator_or12h` | -4,418 / 158 | -3,985 / 158 | -1,656 / 47 | -1,495 / 47 | -7,723 | -5,313 | P,B,M,C |
| 234 | `macd_30m_12_26_9_signal_cross_long_fixed12h` | -4,463 / 514 | -6,123 / 497 | -762 / 126 | -131 / 123 | -7,768 | -3,893 | P,B,M,C |
| 235 | `macd_30m_24_52_18_signal_trend_long_fixed12h` | -4,506 / 124 | -4,247 / 123 | -802 / 34 | -959 / 34 | -7,811 | -5,639 | P,B,M,C |
| 236 | `macd_60m_12_26_9_signal_trend_long_fixed12h` | -4,778 / 132 | -3,185 / 127 | -1,275 / 38 | -236 / 35 | -8,083 | -5,792 | P,B,M,C |
| 237 | `macd_15m_6_13_5_signal_counter_short_indicator_or12h` | -30,444 / 1983 | -27,893 / 1983 | -12,492 / 503 | -12,281 / 503 | -8,161 | -4,179 | P,B,M,C |
| 238 | `macd_60m_6_13_5_zero_cross_long_indicator_or12h` | -5,272 / 374 | -5,013 / 374 | +1,936 / 96 | +2,054 / 96 | -8,577 | -4,740 | P,B,M,C |
| 239 | `macd_60m_12_26_9_hist_turn_long_indicator_or12h` | -5,441 / 454 | -5,610 / 440 | -219 / 112 | +616 / 109 | -8,746 | -6,271 | P,B,M,C |
| 240 | `macd_30m_24_52_18_signal_cross_long_indicator_or12h` | -5,751 / 404 | -4,345 / 404 | +682 / 104 | +457 / 104 | -9,056 | -4,237 | P,B,M,C |
| 241 | `macd_240m_12_26_9_hist_turn_long_indicator_or12h` | -5,924 / 202 | -6,769 / 179 | -813 / 55 | -1,259 / 48 | -9,228 | -5,863 | P,B,M,C |
| 242 | `macd_30m_12_26_9_signal_counter_long_indicator_or12h` | -6,159 / 519 | -4,753 / 519 | +233 / 123 | +199 / 123 | -9,463 | -3,508 | P,B,M,C |
| 243 | `macd_60m_24_52_18_hist_turn_long_fixed12h` | -6,318 / 327 | -5,809 / 316 | -603 / 72 | -120 / 69 | -9,623 | -4,842 | P,B,M,C |
| 244 | `macd_30m_12_26_9_signal_counter_long_fixed12h` | -6,355 / 348 | -8,109 / 335 | -1,398 / 85 | -516 / 82 | -9,660 | -4,526 | P,B,M,C |
| 245 | `macd_15m_12_26_9_signal_cross_short_indicator_or12h` | -32,219 / 1647 | -30,053 / 1647 | -9,323 / 419 | -8,318 / 419 | -9,937 | -4,597 | P,B,M,C,X |
| 246 | `macd_60m_12_26_9_hist_turn_long_fixed12h` | -6,719 / 426 | -4,137 / 409 | +1,427 / 105 | +2,160 / 100 | -10,023 | -3,435 | P,B,M,C |
| 247 | `macd_15m_12_26_9_hist_turn_long_indicator_or12h` | -6,746 / 1431 | -8,133 / 1431 | -2,579 / 363 | -2,994 / 363 | -10,051 | -5,663 | P,B,M,C |
| 248 | `macd_60m_12_26_9_signal_cross_long_indicator_or12h` | -6,997 / 407 | -6,031 / 407 | +630 / 102 | +599 / 102 | -10,302 | -4,517 | P,B,M,C |
| 249 | `macd_15m_24_52_18_signal_counter_long_indicator_or12h` | -7,144 / 534 | -5,672 / 534 | +1,343 / 127 | +1,641 / 127 | -10,449 | -3,435 | P,B,M,C |
| 250 | `macd_30m_12_26_9_signal_cross_long_indicator_or12h` | -7,701 / 830 | -5,383 / 830 | -1,567 / 200 | -1,386 / 200 | -11,006 | -3,709 | P,B,M,C |
| 251 | `macd_30m_6_13_5_signal_cross_short_indicator_or12h` | -33,384 / 1572 | -29,173 / 1572 | -12,081 / 408 | -10,532 / 408 | -11,101 | -5,008 | P,B,M,C,X |
| 252 | `macd_240m_24_52_18_hist_turn_long_fixed12h` | -7,903 / 132 | -7,977 / 120 | -2,901 / 41 | -3,201 / 35 | -11,208 | -4,591 | P,B,M,C |
| 253 | `macd_60m_6_13_5_signal_counter_long_fixed12h` | -8,224 / 331 | -8,257 / 312 | -4,091 / 75 | -3,812 / 71 | -11,529 | -6,122 | P,B,M,C |
| 254 | `macd_15m_12_26_9_signal_trend_long_indicator_or12h` | -8,250 / 609 | -7,293 / 609 | -2,368 / 166 | -2,009 / 166 | -11,555 | -4,053 | P,B,M,C |
| 255 | `macd_15m_6_13_5_zero_cross_short_indicator_or12h` | -33,896 / 1515 | -30,867 / 1515 | -9,711 / 380 | -8,607 / 380 | -11,613 | -4,225 | P,B,M,C,X |
| 256 | `macd_240m_24_52_18_hist_turn_long_indicator_or12h` | -8,509 / 132 | -8,666 / 120 | -3,364 / 41 | -3,770 / 35 | -11,814 | -4,591 | P,B,M,C |
| 257 | `macd_15m_6_13_5_zero_cross_long_fixed12h` | -8,644 / 614 | -6,698 / 602 | +1,386 / 152 | +920 / 149 | -11,948 | -3,308 | P,B,M,C |
| 258 | `macd_15m_24_52_18_signal_cross_long_fixed12h` | -8,665 / 505 | -7,316 / 501 | -1,325 / 124 | -804 / 123 | -11,969 | -4,727 | P,B,M,C |
| 259 | `macd_15m_24_52_18_signal_cross_long_indicator_or12h` | -8,699 / 845 | -6,261 / 845 | -377 / 207 | +169 / 207 | -12,003 | -3,122 | P,B,M,C |
| 260 | `macd_15m_24_52_18_signal_counter_long_fixed12h` | -9,002 / 346 | -9,092 / 345 | -2,320 / 83 | -2,256 / 83 | -12,307 | -5,195 | P,B,M,C |
| 261 | `macd_5m_12_26_9_signal_counter_long_fixed12h` | -9,090 / 690 | -10,205 / 685 | +696 / 174 | +480 / 172 | -12,394 | -4,542 | P,B,M,C |
| 262 | `macd_30m_6_13_5_signal_counter_long_indicator_or12h` | -9,297 / 957 | -6,591 / 957 | -1,423 / 232 | -382 / 232 | -12,601 | -5,751 | P,B,M,C |
| 263 | `macd_15m_12_26_9_signal_counter_long_indicator_or12h` | -11,387 / 1038 | -10,161 / 1038 | +268 / 252 | +836 / 252 | -14,691 | -4,339 | P,B,M,C |
| 264 | `macd_30m_6_13_5_signal_trend_long_indicator_or12h` | -11,618 / 615 | -10,133 / 615 | -3,738 / 175 | -3,329 / 175 | -14,922 | -4,817 | P,B,M,C |
| 265 | `macd_60m_6_13_5_signal_cross_long_fixed12h` | -12,695 / 514 | -10,732 / 481 | -3,326 / 122 | -2,631 / 116 | -15,999 | -5,559 | P,B,M,C |
| 266 | `macd_30m_6_13_5_zero_cross_long_indicator_or12h` | -13,524 / 747 | -12,759 / 747 | +658 / 178 | +308 / 178 | -16,829 | -4,505 | P,B,M,C |
| 267 | `macd_15m_12_26_9_zero_cross_long_indicator_or12h` | -14,354 / 748 | -13,674 / 748 | -261 / 180 | -286 / 180 | -17,659 | -4,798 | P,B,M,C |
| 268 | `macd_15m_6_13_5_signal_trend_long_indicator_or12h` | -14,679 / 1275 | -12,804 / 1275 | -4,001 / 339 | -3,499 / 339 | -17,984 | -5,792 | P,B,M,C |
| 269 | `macd_5m_24_52_18_signal_trend_long_indicator_or12h` | -15,369 / 934 | -13,910 / 934 | -4,604 / 263 | -4,756 / 263 | -18,674 | -5,798 | P,B,M,C |
| 270 | `macd_5m_24_52_18_hist_turn_long_indicator_or12h` | -16,597 / 2371 | -17,188 / 2371 | -4,466 / 609 | -3,592 / 609 | -19,902 | -5,415 | P,B,M,C |
| 271 | `macd_5m_12_26_9_signal_counter_short_indicator_or12h` | -42,768 / 3206 | -43,306 / 3206 | -15,137 / 834 | -15,340 / 834 | -20,486 | -4,809 | P,B,M,C,X |
| 272 | `macd_5m_24_52_18_signal_counter_long_indicator_or12h` | -17,228 / 1655 | -15,280 / 1655 | -2,830 / 402 | -2,417 / 402 | -20,533 | -6,641 | P,B,M,C |
| 273 | `macd_5m_24_52_18_zero_cross_long_indicator_or12h` | -17,347 / 1128 | -15,390 / 1128 | +19 / 273 | +144 / 273 | -20,652 | -3,607 | P,B,M,C |
| 274 | `macd_5m_12_26_9_zero_cross_short_indicator_or12h` | -44,708 / 2280 | -42,713 / 2280 | -12,535 / 580 | -11,283 / 580 | -22,426 | -4,476 | P,B,M,C,X |
| 275 | `macd_15m_6_13_5_hist_turn_long_indicator_or12h` | -19,154 / 2488 | -20,580 / 2488 | -2,747 / 648 | -3,322 / 648 | -22,459 | -6,530 | P,B,M,C |
| 276 | `macd_5m_24_52_18_signal_cross_short_indicator_or12h` | -45,214 / 2589 | -41,785 / 2589 | -14,582 / 666 | -14,301 / 666 | -22,932 | -5,001 | P,B,M,C,X |
| 277 | `macd_15m_12_26_9_signal_cross_long_indicator_or12h` | -19,637 / 1647 | -17,454 / 1647 | -2,100 / 418 | -1,172 / 418 | -22,942 | -4,973 | P,B,M,C |
| 278 | `macd_30m_6_13_5_signal_cross_long_indicator_or12h` | -20,915 / 1572 | -16,724 / 1572 | -5,160 / 407 | -3,711 / 407 | -24,219 | -4,569 | P,B,M,C |
| 279 | `macd_5m_12_26_9_signal_trend_long_indicator_or12h` | -21,988 / 1868 | -20,674 / 1867 | -4,728 / 503 | -4,733 / 502 | -25,293 | -5,211 | P,B,M,C |
| 280 | `macd_15m_6_13_5_signal_counter_long_indicator_or12h` | -22,989 / 1942 | -21,628 / 1942 | -6,221 / 491 | -6,058 / 491 | -26,294 | -7,225 | P,B,M,C |
| 281 | `macd_15m_6_13_5_zero_cross_long_indicator_or12h` | -23,522 / 1515 | -20,312 / 1515 | -1,817 / 379 | -763 / 379 | -26,826 | -4,177 | P,B,M,C |
| 282 | `macd_15m_6_13_5_signal_cross_short_indicator_or12h` | -50,383 / 3217 | -47,082 / 3217 | -17,444 / 831 | -16,780 / 831 | -28,100 | -5,397 | P,B,M,C,X |
| 283 | `macd_5m_12_26_9_hist_turn_short_indicator_or12h` | -54,714 / 4388 | -52,502 / 4387 | -13,338 / 1143 | -13,257 / 1142 | -32,432 | -5,867 | P,B,M,C,X |
| 284 | `macd_5m_12_26_9_zero_cross_long_indicator_or12h` | -32,104 / 2280 | -30,148 / 2280 | -4,718 / 579 | -3,560 / 579 | -35,408 | -5,633 | P,B,M,C,X |
| 285 | `macd_5m_24_52_18_signal_cross_long_indicator_or12h` | -32,597 / 2589 | -29,190 / 2589 | -7,434 / 665 | -7,173 / 665 | -35,902 | -5,545 | P,B,M,C,X |
| 286 | `macd_5m_6_13_5_signal_trend_short_indicator_or12h` | -60,178 / 3680 | -56,286 / 3680 | -17,111 / 985 | -16,459 / 985 | -37,895 | -7,412 | P,B,M,C,X |
| 287 | `macd_5m_12_26_9_signal_counter_long_indicator_or12h` | -34,685 / 3138 | -35,463 / 3138 | -10,637 / 795 | -10,847 / 795 | -37,989 | -6,495 | P,B,M,C,X |
| 288 | `macd_5m_12_26_9_hist_turn_long_indicator_or12h` | -35,438 / 4343 | -35,400 / 4343 | -6,310 / 1132 | -6,835 / 1132 | -38,743 | -7,427 | P,B,M,C,X |
| 289 | `macd_15m_6_13_5_signal_cross_long_indicator_or12h` | -37,669 / 3217 | -34,432 / 3217 | -10,222 / 830 | -9,557 / 830 | -40,973 | -5,351 | P,B,M,C,X |
| 290 | `macd_5m_6_13_5_signal_counter_short_indicator_or12h` | -68,722 / 5914 | -65,525 / 5914 | -20,075 / 1511 | -19,448 / 1511 | -46,439 | -6,805 | P,B,M,C,X |
| 291 | `macd_5m_12_26_9_signal_cross_short_indicator_or12h` | -69,333 / 5005 | -68,736 / 5005 | -22,649 / 1297 | -22,841 / 1297 | -47,051 | -6,409 | P,B,M,C,X |
| 292 | `macd_5m_6_13_5_zero_cross_short_indicator_or12h` | -70,272 / 4555 | -68,047 / 4555 | -23,586 / 1219 | -23,255 / 1219 | -47,990 | -6,405 | P,B,M,C,X |
| 293 | `macd_5m_6_13_5_hist_turn_short_indicator_or12h` | -72,296 / 7472 | -76,853 / 7472 | -15,690 / 1945 | -18,210 / 1945 | -50,013 | -6,793 | P,B,M,C,X |
| 294 | `macd_5m_6_13_5_signal_trend_long_indicator_or12h` | -48,202 / 3856 | -46,778 / 3856 | -9,857 / 994 | -10,155 / 994 | -51,506 | -9,445 | P,B,M,C,X |
| 295 | `macd_5m_12_26_9_signal_cross_long_indicator_or12h` | -56,673 / 5006 | -56,137 / 5005 | -15,365 / 1298 | -15,580 / 1297 | -59,977 | -7,158 | P,B,M,C,X |
| 296 | `macd_5m_6_13_5_zero_cross_long_indicator_or12h` | -57,664 / 4555 | -55,377 / 4555 | -16,493 / 1218 | -16,182 / 1218 | -60,968 | -7,848 | P,B,M,C,X |
| 297 | `macd_5m_6_13_5_signal_counter_long_indicator_or12h` | -67,731 / 5739 | -62,115 / 5739 | -20,092 / 1503 | -18,512 / 1503 | -71,036 | -10,290 | P,B,M,C,X |
| 298 | `macd_5m_6_13_5_hist_turn_long_indicator_or12h` | -71,538 / 7389 | -72,299 / 7389 | -15,253 / 1886 | -14,850 / 1886 | -74,842 | -9,950 | P,B,M,C,X |
| 299 | `macd_5m_6_13_5_signal_cross_short_indicator_or12h` | -128,900 / 9594 | -121,812 / 9594 | -37,186 / 2496 | -35,907 / 2496 | -106,617 | -12,009 | P,B,M,C,X |
| 300 | `macd_5m_6_13_5_signal_cross_long_indicator_or12h` | -115,933 / 9595 | -108,893 / 9595 | -29,949 / 2497 | -28,667 / 2497 | -119,238 | -12,362 | P,B,M,C,X |

