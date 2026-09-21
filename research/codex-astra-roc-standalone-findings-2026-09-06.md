# I05: ROC standalone findings — September 6, 2026

## TL;DR

- **600 frozen ROC definitions; 2,408 window/delay/control cases independently verified.** All 24 prior ROC/clock overlaps reproduced exactly. The checker audited 970,004 trade records and 24,080 monthly records; these include correlated variants and overlapping windows, not that many independent opportunities.
- **32 long definitions and one short survive the predeclared sample/net/extra-cost shortlist; 0/600 pass the complete strict screen.** The full-net long leader buys a crossing below -1% twelve-hour ROC on hourly closes: **+$12,223 full / +$7,122 recent**, versus clock long **+$3,305 / +$5,038**. Buying a -1% half-hour decline returns **+$10,645 / +$7,920**. Both survive the separate +1m action delay, but have bad months and severe crash exposure.
- **Useful indicator evidence, not a live upgrade or a ladder improvement.** A sharp-rise fade short with ROC-normalization exit remains positive, but only 95 full / 20 recent trades, substantial timing sensitivity and concentrated winners. Leading dip-buy longs suffer **51–53% adverse price excursions** in October 2025. Preserve these mechanisms and limitations for later individual-study comparisons; no live, ladder, short-owner, MACD or indicator/HL/S/R combination changes.

## 1. Exact scope and meanings

Simple ROC = `100 * (current closed price / close N completed bars ago - 1)`.
Unrounded, N+1 contiguous positive closes; zero is valid. Unlike RSI/CRSI it is
a percentage price change, not a bounded 0–100 oscillator.

| Closed candle | ROC1 horizon | ROC5 horizon | ROC12 horizon |
|---|---|---|---|
| 5m | 5m | 25m | 1h |
| 15m | 15m | 75m | 3h |
| 30m | 30m | 2.5h | 6h |
| 1h | 1h | 5h | 12h |
| 4h | 4h | 20h | 48h |

The same elapsed horizon with different candles is correlated, but different
decision cadence means it is not necessarily the same strategy.

| Mode | Long fresh crossing | Short fresh crossing | Magnitudes |
|---|---|---|---|
| Momentum | previous <=+M, current >+M | previous >=-M, current <-M | 0, 1, 2, 4% |
| Into / immediate fade | previous >-M, current <=-M | previous <+M, current >=+M | 1, 2, 4% |
| Back-out / ROC recovery | previous <=-M, current >-M | previous >=+M, current <+M | 1, 2, 4% |

Each uses **fixed 12h** or **indicator-or-12h** exit:
momentum exits at subsequent ROC <=0 long / >=0 short; fades and back-outs
exit at subsequent ROC >=0 long / <=0 short. A recovery crossing already
past zero does not get an instantaneous exit: a later closed observation must
satisfy the exit. Timeout from actual fill wins ties; pending exits are immutable.

**Important: ROC recovery does not necessarily mean price recovery.** The
denominator rolls. A flat current price can cross a threshold merely because
the older comparison price changes; slowing losses can yield a “back-out”
entry while absolute price continues down. ROC zero exit on a one-hour horizon
does not mean price has returned to the trade's entry price.

15 timeframe/lookback pairs x 10 mode/magnitude entries x 2 sides x 2 exits
= **600 definitions**, 596 new and four repeated I01 hourly ROC5/zero rules.
240 momentum, 180 into, 180 back-out; 300 each side.
2 overlapping windows x 2 action delays produce 2,400 strategy cases +8 clocks.

Frozen [card](../research-inputs/indicators/roc-standalone-2026-09-06.json) /
[method and reproduction](../docs/research/roc-standalone-study.md).
No daily clock, other lags, 0.5%/8% threshold, acceleration, persistence,
divergence, log/ATR-normalized ROC, TP/SL/trailing/partials, new gates,
ladder modifications or indicator/pulse/S/R combinations were tested.
A bounded pass is not a claim that all ROC possibilities are exhausted.

## 2. Periods, controls and accounting

| Item | Frozen convention |
|---|---|
| Full | **2025-07-01 00:00 → 2026-09-04 19:01 UTC** |
| Recent | **2026-05-17 20:43 → 2026-09-04 19:01 UTC**, contained in full |
| Seed / archive | Fixed June 1, 2025 00:00 seed; 663,541 continuous seeded minutes, same explicit 11-minute repair overlay as I01–I04 |
| Sizing / account | $10,000 fixed entry notional, $32,000 initial equity; one independent position per rule, no averaging/compounding |
| Trading fees | 0.055% on actual executed notional each side; all reported winning/losing/net dollars already include these |
| Funding | **Excluded**, incomplete settlement archive; these are not fully net exchange-account returns |
| Timing | Signal only after the selected candle fully closes; subsequent minute-open execution with zero modeled publication lag; separate +1m delay on every entry and exit |
| Exits / occupancy | 12h from actual entry, or defined subsequent ROC-zero exit capped at 12h; occupied signals skipped, no queued stale crossing |
| Main baseline | Same-side rolling 12h clock, near-continuous exposure; not exposure-matched and **not the Martingale ladder** |
| Exit baseline | Same entry's fixed12h path, rerun with its own occupancy; not merely changing an exit price on a frozen ledger |
| Cutoff inventory | Last-close mark with hypothetical exit fee, not a fabricated completed trade |
| Stress | Extra 5bps per side on the same turnover/path including marked closing turnover; not a liquidity/slippage-path replay |
| Drawdown | Prior close-equity peak to adverse minute-price equity on $32k; exit-minute extremes excluded for already closed inventory |

Never add full/recent PnLs or counts: they overlap. All history has already been
mined; no untouched holdout or multiple-testing-adjusted significance is claimed.
Likewise do not add a standalone PnL to the ladder without its own joint replay.
Liquidation/margin, shared collateral, live queue/fills and historical receipt
latency are not certified by completed OHLCV or a +1m scenario.

Cash returns $0. Fixed-initial-quantity buy/hold context returns **+$11,511 full /
+$8,383 recent**, before funding, with changing marked notional and different
exposure. These are contextual, not optimized controls.

## 3. Leaders with baseline W/L dollars

The predeclared descriptive shortlist requires >=30 full /10 recent closes in
**both** delays, positive net and extra-cost net in all four cases, and no
account-equity exhaustion. Rank by full immediate **absolute net**, not by
advantage over a weak short clock. Keep every strict-screen failure visible.

| Label | Exact rule | Plain meaning / exit |
|---|---|---|
| A | `roc_60m_n12_m1_into_long_fixed12h` | Hourly ROC12 crosses into <=-1%; buy, hold 12h |
| B | `roc_30m_n1_m1_into_long_fixed12h` | Half-hour ROC1 crosses into <=-1%; buy, hold 12h |
| C | `roc_30m_n1_m1_back_out_long_fixed12h` | Half-hour ROC1 recrosses >-1%; buy, hold 12h |
| D | `roc_5m_n12_m2_into_long_fixed12h` | Five-minute ROC12 (1h price change) crosses into <=-2%; buy, hold 12h |
| E | `roc_5m_n12_m1_into_long_fixed12h` | Five-minute ROC12 crosses into <=-1%; buy, hold 12h |
| M | `roc_240m_n5_m4_momentum_long_fixed12h` | Four-hour ROC5 (20h price change) crosses >+4%; buy momentum, hold 12h |
| S | `roc_5m_n12_m4_into_short_indicator_or12h` | Five-minute ROC12 (1h price change) crosses into >=+4%; short, exit subsequent ROC <=0 or 12h |

A–E are the frozen descriptive top five. M is shown separately because it is
the other long meeting positive clock deltas in all four cases; S is the only
adequately sampled short surviving net/delay/extra costs. This is not a new
post-result grid or a replacement screen.

### Full period, immediate execution

| Setup | W / L | Winning $ | Losing $ | Open $ | Net $ | Delta to clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 420 / 441 | 110,950 | -107,401 | -245 | +3,305 | baseline | 33.09% |
| A | 201 / 191 | 57,404 | -45,131 | -51 | +12,223 | +8,918 | 18.20% |
| B | 230 / 220 | 68,822 | -58,126 | -51 | +10,645 | +7,341 | 22.88% |
| C | 230 / 219 | 66,275 | -56,703 | -43 | +9,530 | +6,226 | 17.65% |
| D | 178 / 165 | 57,279 | -47,835 | +9 | +9,454 | +6,149 | 17.39% |
| E | 329 / 317 | 88,976 | -80,425 | +60 | +8,610 | +5,306 | 20.58% |
| M | 74 / 70 | 23,322 | -18,626 | 0 | +4,695 | +1,391 | 17.84% |
| Clock short | 414 / 447 | 98,162 | -120,668 | +223 | -22,283 | baseline | 71.27% |
| S | 65 / 30 | 8,677 | -5,513 | 0 | +3,165 | +25,447 | 4.05% |

### Recent period, immediate execution

| Setup | W / L | Winning $ | Losing $ | Open $ | Net $ | Delta to clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 114 / 105 | 29,120 | -23,837 | -245 | +5,038 | baseline | 12.94% |
| A | 49 / 44 | 15,593 | -8,420 | -51 | +7,122 | +2,084 | 5.84% |
| B | 59 / 43 | 18,951 | -10,981 | -51 | +7,920 | +2,882 | 7.54% |
| C | 58 / 44 | 17,869 | -11,214 | -43 | +6,613 | +1,575 | 8.45% |
| D | 43 / 34 | 13,513 | -9,869 | +9 | +3,653 | -1,385 | 8.83% |
| E | 78 / 70 | 20,863 | -18,135 | +60 | +2,788 | -2,250 | 14.95% |
| M | 21 / 11 | 8,112 | -1,621 | 0 | +6,491 | +1,453 | 3.82% |
| Clock short | 97 / 122 | 21,666 | -31,775 | +223 | -9,887 | baseline | 32.54% |
| S | 13 / 7 | 1,516 | -683 | 0 | +834 | +10,720 | 2.60% |

Net = winning dollars + losing dollars + open mark (rounding aside).
Do not subtract fees or losses again. Higher net here is not simply a higher
win rate: A wins 201/392 full trades, B 230/450, versus clock 420/861.
Differences include avoided occupancy, different entries, recoveries captured,
turnover and losses, not just trades visible on a chart.

### Every timing and cost case

Net and stressed net are paired; stress is **additional** to the included fees.

| Setup | Full 0m net / stress $ | Full +1m net / stress $ | Recent 0m net / stress $ | Recent +1m net / stress $ |
|---|---|---|---|---|
| Clock long | +3,305 / -5,322 | +3,792 / -4,815 | +5,038 / +2,835 | +5,104 / +2,910 |
| A | +12,223 / +8,284 | +11,263 / +7,355 | +7,122 / +6,178 | +7,170 / +6,236 |
| B | +10,645 / +6,127 | +9,090 / +4,703 | +7,920 / +6,885 | +7,623 / +6,608 |
| C | +9,530 / +5,023 | +9,667 / +5,269 | +6,613 / +5,579 | +6,718 / +5,704 |
| D | +9,454 / +6,007 | +8,913 / +5,477 | +3,653 / +2,871 | +3,482 / +2,700 |
| E | +8,610 / +2,133 | +8,576 / +2,128 | +2,788 / +1,296 | +2,844 / +1,351 |
| M | +4,695 / +3,252 | +7,255 / +5,920 | +6,491 / +6,168 | +6,646 / +6,353 |
| Clock short | -22,283 / -30,909 | -22,726 / -31,333 | -9,887 / -12,090 | -9,930 / -12,124 |
| S | +3,165 / +2,217 | +1,751 / +803 | +834 / +634 | +411 / +211 |

A, B, C and M beat the long clock in all four aggregate cases. D and E remain
positive but lose to the recent clock. M's full immediate +$4,695 versus recent
+$6,491 means its earlier portion is negative; it is not equally useful in
every regime. M changes 144 full closes to 133 under delay: later exits alter
which subsequent crossings are available, not just execution prices.

The A–E delayed full drawdowns are **17.94%, 30.12%, 20.47%, 17.29%, 22.53%**,
versus clock **33.53%**. B's 22.88% immediate to 30.12% delayed DD is a material
sensitivity even though its aggregate net remains positive.

## 4. What the exits tell us

For the top five long entries, replacing 12h with ROC-zero exit reduces net in
**all 20 entry/window/delay comparisons**. This is a result for these entries,
not a universal rejection of indicator exits or a fee-only explanation.

Full and recent immediate models; unchanged entry/12h is the baseline:

| Entry | Full baseline 12h net $ | Full ROC-zero net $ (delta) | Recent baseline 12h net $ | Recent ROC-zero net $ (delta) |
|---|---|---|---|---|
| A | +12,223 | +2,127 (-10,095) | +7,122 | +620 (-6,502) |
| B | +10,645 | -4,456 (-15,102) | +7,920 | -950 (-8,870) |
| C | +9,530 | -6,731 (-16,261) | +6,613 | -914 (-7,527) |
| D | +9,454 | +4,621 (-4,832) | +3,653 | +1,773 (-1,880) |
| E | +8,610 | -10,329 (-18,939) | +2,788 | -1,344 (-4,133) |

For B, full closes rise from 450 to 1,157 while net falls +$10,645 to -$4,456:
earlier normalization both cuts holding/recovery and permits many more trades.
For E, 646 becomes 2,170 and +$8,610 becomes -$10,329. Do not transplant the
normalization exit simply because it appears intuitive.

S behaves differently. Exact same short entry with original 12h versus ROC exit:

| Setup | W / L | Winning $ | Losing $ | Open $ | Net $ | Delta to clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock short | 414 / 447 | 98,162 | -120,668 | +223 | -22,283 | baseline | 71.27% |
| S / original 12h | 37 / 36 | 11,378 | -11,774 | 0 | -396 | +21,887 | 13.04% |
| S | 65 / 30 | 8,677 | -5,513 | 0 | +3,165 | +25,447 | 4.05% |

| Short exit | Full 0m net / DD | Full +1m net / DD | Recent 0m net / DD | Recent +1m net / DD |
|---|---|---|---|---|
| Clock short | -22,283 / 71.27% | -22,726 / 72.65% | -9,887 / 32.54% | -9,930 / 32.80% |
| S / original 12h | -396 / 13.04% | -1,781 / 14.66% | +1,115 / 5.68% | +802 / 6.20% |
| S | +3,165 / 4.05% | +1,751 / 4.75% | +834 / 2.60% | +411 / 2.55% |

The early exit gains **$3,561 full immediate** but sacrifices **$281 recent**.
In the full sample, all 95 S exits are indicator exits, averaging **67.8 minutes**;
recent 20 average **61.3 minutes**, not 12-hour short bets. Twelve-hour baseline
73 full /17 recent trades differs because of occupancy. This is not 95 identical
trades with a free exit-price improvement.

## 5. Short evidence: retain the idea, not a live conclusion

Of 300 short definitions, **264 are adequately sampled**. Of those, 233 lose
full immediate and 208 lose in all four cases. Eight are positive in all four;
**only S remains positive after the extra-cost test in all four**.

S's $3,165 full immediate becomes $1,751 with +1m; recent $834 becomes $411.
After extra costs, delayed recent net is just **$211 from 20 trades**.
Full delayed five-largest winners supply **93.31%** of closed net; recent
delayed **206.70%** (excluding those five leaves -$438). These are fragility
diagnostics, not a rule to discard winning trades or an adjusted strategy PnL.

Completed holding-minute scan:
- S's worst immediate adverse move is **8.58% / -$858 gross** on a $10k short,
  eventually closing **-$659**; recent worst is **6.50% / -$650**.
- Original 12h short has **16.79% / -$1,679** adverse exposure in August 2026.
- No stop-loss was tested. A ROC-normalization exit is neither a price stop nor
  a guarantee against a continuing squeeze, especially as the denominator rolls.
- Full immediate S has 0 trades in April, July and partial September 2026.
  June has 12 of the recent 20 trades. Monthly and event concentration matter.

A short beating near-continuous short exposure is not enough. Raw top five
by full delta to the own-side clock are all shorts, with $25,863–$28,046 apparent
improvements, but none survive the complete cost/window/monthly tests.

| Raw delta rank / exact ID | Full 0m net $ | Recent 0m net $ | Recent +1m net $ | Recent +1m stress $ |
|---|---|---|---|---|
| 1. `roc_240m_n5_m1_back_out_short_fixed12h` | +5,764 | +455 | +9 | -561 |
| 2. `roc_240m_n12_m4_back_out_short_indicator_or12h` | +3,745 | +183 | +142 | -167 |
| 3. `roc_240m_n5_m2_back_out_short_fixed12h` | +3,741 | -1,402 | -1,597 | -2,078 |
| 4. `roc_60m_n5_m2_back_out_short_fixed12h` | +3,712 | +38 | +1,054 | +235 |
| 5. `roc_60m_n5_m2_into_short_fixed12h` | +3,580 | -4,562 | -3,856 | -4,667 |

Side baselines above remain **-$22,283 full / -$9,887 recent** immediate,
**-$22,726 / -$9,930** delayed; cash $0. The raw leader's recent delayed **+$9**
becomes **-$561** after stress. Do not rank that as the strongest usable signal
just because its baseline is exceptionally poor.

## 6. Monthly stability: actual loss versus missed upside

Strict inherited screen: >=30 full /10 recent closes in both delays; net>0 and
own-side clock delta>0 in all four; every monthly marked delta >=-1e-8;
positive extra-cost nets; no equity exhaustion. **0/600 pass.**

A/B/C/M/S fail the monthly condition; D/E also fail aggregate recent clock
comparison. This preserves the predeclared bar without claiming every
regression is a catastrophic loss. For example:
- A January 2026 immediate **-$2,700**, clock **+$1,782**, delta **-$4,482**:
  a genuine losing month as well as foregone clock profit.
- D full May **+$434**, clock **+$5,789**, delta **-$5,356**:
  mainly missed upside, not a $5,356 cash loss.
- B recent June **+$2,840**, clock **-$1,256**, but July **-$2,676** versus
  **-$2,621**: it does not remove the bleed in every red month.
- A recent June **+$2,158** and July **-$1,282** show a different tradeoff;
  profitable recent aggregate is not proof that bad-regime exposure is solved.

Monthly **marked** net includes inventory changes and paid fees at month
boundaries. Completed-trade winning/losing dollars assign each whole trade to
its exit month; they are a different attribution view. Recent May and September
are partial months. The two periods are overlapping and have separate initial
occupancy, so partial-month results must not be spliced as identical paths.

### A–E: full immediate; baseline and net (delta), dollars

| Month | clock_long net $ | A net (delta) $ | B net (delta) $ | C net (delta) $ | D net (delta) $ | E net (delta) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -161 | -224 (-62) | +963 (+1,124) | +477 (+638) | +454 (+616) | +41 (+202) |
| 2025-08 | +510 | +3,484 (+2,974) | +254 (-256) | -531 (-1,042) | +2,007 (+1,497) | +2,377 (+1,867) |
| 2025-09 | -109 | +844 (+953) | +2,534 (+2,643) | +1,323 (+1,432) | +41 (+151) | +1,730 (+1,840) |
| 2025-10 | -470 | -2,333 (-1,863) | -1,054 (-583) | +300 (+770) | -675 (-205) | -179 (+291) |
| 2025-11 | -3,287 | +3,423 (+6,710) | -1,498 (+1,789) | -512 (+2,775) | +984 (+4,270) | -1,743 (+1,544) |
| 2025-12 | -2,574 | -1,106 (+1,468) | -2,907 (-333) | -1,790 (+784) | +14 (+2,588) | -2,079 (+495) |
| 2026-01 | +1,782 | -2,700 (-4,482) | -711 (-2,494) | -1,297 (-3,079) | -529 (-2,311) | +2,334 (+552) |
| 2026-02 | -122 | +2,171 (+2,293) | +2,200 (+2,322) | +1,570 (+1,692) | +2,629 (+2,751) | -375 (-253) |
| 2026-03 | +1,155 | +1,710 (+555) | +3,110 (+1,955) | +3,457 (+2,302) | +3,418 (+2,264) | +3,044 (+1,889) |
| 2026-04 | +307 | -26 (-333) | -926 (-1,233) | -568 (-876) | -1,420 (-1,727) | -51 (-359) |
| 2026-05 | +5,789 | +2,672 (-3,118) | +4,923 (-866) | +5,465 (-324) | +434 (-5,356) | +4,064 (-1,725) |
| 2026-06 | -1,256 | +2,158 (+3,414) | +2,840 (+4,095) | +1,289 (+2,545) | +923 (+2,179) | -3,221 (-1,965) |
| 2026-07 | -2,621 | -1,282 (+1,339) | -2,676 (-55) | -2,756 (-135) | -1,469 (+1,152) | -1,376 (+1,245) |
| 2026-08 | +4,306 | +3,544 (-762) | +3,367 (-939) | +2,930 (-1,376) | +2,633 (-1,672) | +4,402 (+96) |
| 2026-09 | +55 | -112 (-167) | +227 (+172) | +174 (+119) | +9 (-46) | -357 (-413) |

### A–E: full +1m actions

| Month | clock_long net $ | A net (delta) $ | B net (delta) $ | C net (delta) $ | D net (delta) $ | E net (delta) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -94 | -272 (-179) | +179 (+273) | -475 (-381) | +472 (+566) | -98 (-4) |
| 2025-08 | +754 | +3,501 (+2,747) | +214 (-541) | -820 (-1,574) | +1,894 (+1,140) | +2,410 (+1,656) |
| 2025-09 | -265 | +879 (+1,144) | +2,050 (+2,315) | +1,291 (+1,555) | +139 (+403) | +1,462 (+1,727) |
| 2025-10 | -484 | -2,121 (-1,637) | -2,458 (-1,974) | -81 (+403) | -736 (-252) | -289 (+195) |
| 2025-11 | -3,354 | +2,298 (+5,652) | -2,120 (+1,234) | -1,388 (+1,967) | +777 (+4,131) | -2,193 (+1,161) |
| 2025-12 | -2,606 | -1,337 (+1,270) | -3,005 (-398) | -1,562 (+1,044) | -156 (+2,451) | -2,110 (+496) |
| 2026-01 | +2,011 | -2,662 (-4,673) | +305 (-1,706) | -603 (-2,613) | -439 (-2,449) | +2,006 (-5) |
| 2026-02 | +102 | +2,096 (+1,993) | +2,404 (+2,301) | +2,469 (+2,367) | +2,766 (+2,664) | +378 (+275) |
| 2026-03 | +1,222 | +1,700 (+478) | +3,621 (+2,399) | +3,353 (+2,131) | +3,394 (+2,172) | +3,257 (+2,035) |
| 2026-04 | +243 | +12 (-230) | -997 (-1,239) | -499 (-742) | -1,428 (-1,671) | +224 (-18) |
| 2026-05 | +5,761 | +2,780 (-2,981) | +5,534 (-227) | +6,042 (+281) | +340 (-5,422) | +3,911 (-1,851) |
| 2026-06 | -1,159 | +2,275 (+3,434) | +1,935 (+3,094) | +1,795 (+2,953) | +912 (+2,071) | -3,092 (-1,934) |
| 2026-07 | -2,614 | -1,380 (+1,235) | -2,254 (+360) | -2,890 (-275) | -1,401 (+1,213) | -1,363 (+1,251) |
| 2026-08 | +4,311 | +3,606 (-705) | +3,407 (-904) | +2,886 (-1,425) | +2,383 (-1,928) | +4,465 (+154) |
| 2026-09 | -37 | -112 (-76) | +275 (+312) | +148 (+184) | -4 (+33) | -391 (-354) |

### A–E: recent immediate

| Month | clock_long net $ | A net (delta) $ | B net (delta) $ | C net (delta) $ | D net (delta) $ | E net (delta) $ |
|---|---|---|---|---|---|---|
| 2026-05 | +4,554 | +2,815 (-1,739) | +4,162 (-392) | +4,976 (+422) | +1,557 (-2,997) | +3,340 (-1,214) |
| 2026-06 | -1,256 | +2,158 (+3,414) | +2,840 (+4,095) | +1,289 (+2,545) | +923 (+2,179) | -3,221 (-1,965) |
| 2026-07 | -2,621 | -1,282 (+1,339) | -2,676 (-55) | -2,756 (-135) | -1,469 (+1,152) | -1,376 (+1,245) |
| 2026-08 | +4,306 | +3,544 (-762) | +3,367 (-939) | +2,930 (-1,376) | +2,633 (-1,672) | +4,402 (+96) |
| 2026-09 | +55 | -112 (-167) | +227 (+172) | +174 (+119) | +9 (-46) | -357 (-413) |

### A–E: recent +1m actions

| Month | clock_long net $ | A net (delta) $ | B net (delta) $ | C net (delta) $ | D net (delta) $ | E net (delta) $ |
|---|---|---|---|---|---|---|
| 2026-05 | +4,477 | +2,781 (-1,696) | +4,259 (-218) | +4,779 (+302) | +1,593 (-2,885) | +3,225 (-1,252) |
| 2026-06 | -1,129 | +2,275 (+3,404) | +1,935 (+3,064) | +1,795 (+2,923) | +912 (+2,041) | -3,092 (-1,964) |
| 2026-07 | -2,692 | -1,380 (+1,312) | -2,254 (+438) | -2,890 (-197) | -1,401 (+1,291) | -1,363 (+1,329) |
| 2026-08 | +4,384 | +3,606 (-778) | +3,407 (-977) | +2,886 (-1,498) | +2,383 (-2,001) | +4,465 (+82) |
| 2026-09 | +64 | -112 (-176) | +275 (+212) | +148 (+84) | -4 (-68) | -391 (-454) |

### Recent closed-trade loss costs: baseline and first three long entries

Each cell is winning dollars / losing dollars; losses are negative, after fees.
Use the marked tables above for portfolio month PnL, not this table alone.

| Exit month | Clock wins / losses $ | A wins / losses $ | B wins / losses $ | C wins / losses $ |
|---|---|---|---|---|
| 2026-05 | 6,666 / -2,733 | 2,902 / -674 | 6,215 / -2,053 | 6,041 / -1,685 |
| 2026-06 | 9,010 / -9,536 | 5,985 / -3,293 | 7,502 / -4,689 | 7,269 / -5,429 |
| 2026-07 | 4,732 / -7,013 | 1,857 / -3,086 | 781 / -3,430 | 528 / -3,215 |
| 2026-08 | 7,704 / -4,125 | 4,695 / -1,151 | 4,176 / -809 | 3,814 / -884 |
| 2026-09 | 1,007 / -430 | 154 / -216 | 278 / 0 | 217 / 0 |

### M: separate momentum long, not included by hiding a top-five loser

| Month | Full clock 0m $ | M 0m $ (delta) | Full clock +1m $ | M +1m $ (delta) |
|---|---|---|---|---|
| 2025-07 | -161 | +576 (+737) | -94 | +902 (+996) |
| 2025-08 | +510 | +218 (-292) | +754 | +318 (-436) |
| 2025-09 | -109 | -420 (-310) | -265 | -387 (-123) |
| 2025-10 | -470 | -655 (-185) | -484 | +6 (+490) |
| 2025-11 | -3,287 | -1,270 (+2,017) | -3,354 | -1,142 (+2,212) |
| 2025-12 | -2,574 | -1,508 (+1,066) | -2,606 | -1,017 (+1,590) |
| 2026-01 | +1,782 | +1,331 (-452) | +2,011 | +1,791 (-220) |
| 2026-02 | -122 | -1,790 (-1,668) | +102 | -1,497 (-1,599) |
| 2026-03 | +1,155 | -91 (-1,246) | +1,222 | -99 (-1,321) |
| 2026-04 | +307 | -297 (-604) | +243 | -386 (-629) |
| 2026-05 | +5,789 | +4,478 (-1,312) | +5,761 | +4,406 (-1,355) |
| 2026-06 | -1,256 | +1,934 (+3,190) | -1,159 | +1,963 (+3,122) |
| 2026-07 | -2,621 | +281 (+2,902) | -2,614 | +284 (+2,899) |
| 2026-08 | +4,306 | +1,680 (-2,626) | +4,311 | +1,884 (-2,427) |
| 2026-09 | +55 | +228 (+173) | -37 | +229 (+266) |

### S: full months, both timings and short baseline

| Month | Short clock 0m $ | S 0m $ (delta) / n | Short clock +1m $ | S +1m $ (delta) / n |
|---|---|---|---|---|
| 2025-07 | -1,203 | +215 (+1,419) / 1 | -1,271 | +187 (+1,458) / 1 |
| 2025-08 | -1,876 | +166 (+2,042) / 4 | -2,120 | +96 (+2,216) / 4 |
| 2025-09 | -1,211 | -22 (+1,189) / 4 | -1,056 | -128 (+928) / 4 |
| 2025-10 | -894 | -641 (+253) / 12 | -880 | -840 (+41) / 12 |
| 2025-11 | +1,970 | +797 (-1,172) / 13 | +2,037 | +643 (-1,394) / 13 |
| 2025-12 | +1,212 | +837 (-375) / 4 | +1,267 | +734 (-533) / 4 |
| 2026-01 | -3,149 | +110 (+3,259) / 11 | -3,378 | +47 (+3,425) / 11 |
| 2026-02 | -1,111 | +523 (+1,634) / 18 | -1,335 | +607 (+1,942) / 18 |
| 2026-03 | -2,521 | +915 (+3,436) / 6 | -2,588 | +596 (+3,185) / 6 |
| 2026-04 | -1,628 | 0 (+1,628) / 0 | -1,564 | 0 (+1,564) / 0 |
| 2026-05 | -7,161 | -235 (+6,925) / 5 | -7,132 | -384 (+6,748) / 5 |
| 2026-06 | -64 | +506 (+569) / 12 | -139 | +144 (+283) / 12 |
| 2026-07 | +1,259 | 0 (-1,259) / 0 | +1,252 | 0 (-1,252) / 0 |
| 2026-08 | -5,675 | -8 (+5,667) / 5 | -5,680 | +47 (+5,728) / 5 |
| 2026-09 | -231 | 0 (+231) / 0 | -139 | 0 (+139) / 0 |

Recent S's May partial accounts for a different slice; full May is not the
recent May result. All separate recent rows remain in `monthly.csv/json`.

## 7. Path risk and concentration

Read-only audit of already selected completed trades, immediate model.
Adverse dollar excursions below are **gross position PnL**, not account DD or
realized losses. Main net/DD audit also includes cutoff open inventory.

| Setup | Full worst adverse price / $ | Net of that full trade $ | Full worst closed trade $ | Top 5 winners / closed net full | Recent worst adverse price / $ | Top 5 / recent closed net |
|---|---|---|---|---|---|---|
| Clock long | 53.52% / -5,352 | -1,601 | -1,601 | 199.91% | 13.05% / -1,305 | 106.49% |
| A | 51.21% / -5,121 | -1,093 | -1,093 | 56.24% | 10.62% / -1,062 | 78.53% |
| B | 51.97% / -5,197 | -1,079 | -1,079 | 63.25% | 10.41% / -1,041 | 66.97% |
| C | 51.33% / -5,133 | -932 | -1,320 | 69.91% | 11.49% / -1,149 | 83.36% |
| D | 52.73% / -5,273 | -1,207 | -1,327 | 68.61% | 11.12% / -1,112 | 129.19% |
| E | 51.72% / -5,172 | -902 | -1,225 | 82.86% | 10.85% / -1,085 | 179.38% |
| Clock short | 23.65% / -2,365 | -1,885 | -1,885 | n/a negative net | 23.65% / -2,365 | n/a negative net |

A–E all hold through the **October 10, 2025 21:21 UTC** low ($20.784).
Their entry prices are $42.601–$43.969, gross adverse exposure $5,121–$5,273
per $10k position. They later recover some of those losses, but that does not
prove a leveraged/shared account would survive. B's model does not make a
half-hour drop a safe bottom; C's ROC recovery does not avoid this crash.

M has a lower observed worst adverse excursion (**11.50% full, 7.71% recent**),
but immediate full top-five winners supply **116.44%** of its closed net.
That is a different mechanism worth retaining, not an uncrowded proven edge.
Its no-month-regression failure and modest recent n=32/29 remain recorded.
No post-hoc stop or trend filter was added to make these paths look safer.

## 8. Timing / math audit and reproducibility

Concrete A decision, UTC:
- Denominator: June 30, 2025 12:00–13:00 hourly candle, close **39.878**.
- Numerator: July 1 00:00–01:00 candle, close **39.278**.
- Previous ROC -0.9912638614%; current `100*(39.278/39.878-1)` =
  **-1.5045889964%**: a fresh <=-1% crossing, known at **01:00** only.
- Immediate entry: July 1 **01:00** minute open **39.278**, not the start of
  the source hourly candle. Twelve-hour exit **13:00**. Separate delayed
  action model shifts fills and derives timeout from its actual entry.
- No July 1 01:00 minute high/low/close selects that entry.
  The verifier independently reconstructs denominator/current prices and times.

**Passed:**
- ROC math and strategy fixtures: **11 groups**, including all 600 boundary
  definitions, unbounded positive/zero/invalid values, N+1 warmup, changing
  denominator with flat current price, exact ROC5 overlap, gaps, stale/mismatched
  lookbacks, entry/exit timing, delayed rearm, pending cutoff and future prefixes.
- Old standalone **17**, indicator-feature **12**, closed-timing **11** groups.
- TypeScript full and VPS no-emit builds; `git diff --check`.
- **24** old/new/saved full ledger/stat/month/open overlap cases before outcomes.
- **45** actual-data feature-prefix and **600** strategy-prefix comparisons.
- Independent verifier: **2,408 cases / 970,004 trade rows / 24,080 months**,
  same signals/skips, earliest exits, prices, actual-notional fees, marked
  month boundaries, close/adverse equity, costs, rankings and traces.
- Read-only selected-path audit: source/input/artifact fingerprints unchanged.
  Additional S/own-12h/M path and concentration scans read the same verified
  ledger and canonical minutes; no new signal or strategy runs.

Accepted local artifacts:
`backtests/hype/hype-roc-standalone-2026-09-06/`.
Contains `manifest.json`, `validation.json`, `verification.json`,
`overlap-parity.json`, `results.json`, `summary.csv`,
`monthly.json/csv`, streamed `trades.jsonl`, `ranking.json`,
`shortlist.json`, `causal-traces.json`, `context-controls.json`.
Verifier checks source/input/artifact hashes before and after.
The large ledger is about 676MiB, local only; do not sync it onto the VPS.

Selected SHA-256 pins:
- `manifest.json`: `877ae061f5a2da265afeb64284e2596a9c16bc9bcb363219a7a5eeec9072b46e`
- `results.json`: `d3170cb67d0107f96ba4ee7a92025510033793a9581cb10891667afe51db000b`
- `trades.jsonl`: `27f3d297de25e4683c8a07dc4da65b7aaa4ed48f780dca7377e737c79fa91ef5`
- `monthly.json`: `6a320a3037c8b9b6b46dbe2abfb8d86881de4cae47371f517543a66be886cd3e`

Original engines, candles, config and live state are unchanged. This is an
additive ROC research engine/checker, not a live execution patch.
No commit/push/deploy was requested or performed.

## 9. What to retain before the next individual family

1. **ROC is useful as a move-size/time-horizon descriptor.** A/B/C's bounded
   dip entries and M's longer-horizon momentum entry survive aggregate
   clock, delay and cost comparisons; their monthly and crash failures remain.
2. **Exits are mechanism-specific.** ROC zero is harmful for the top dip-buy
   entries, helpful for S in full history but not its recent aggregate PnL.
   It means change versus a moving old price, not exit at break-even.
3. **S is a research feature candidate, not a reason to unpause shorts.**
   Twenty recent trades, ~$211 delayed/stressed profit and concentration do
   not establish a dependable live income stream.
4. **Move to MACD next under its own math/timing/card.** Do not keep extending
   ROC parameters or jump to RSI/CRSI/ROC/HL/S/R combinations yet. ATR/ADX,
   channels, VWAP/volume and the other agreed individual groups still need
   their own appropriate directional or conditioning studies.
5. Four repeats are explicitly deducted: I01–I04 268 distinct standalone
   definitions +596 new ROC = **864**, separate from the 45 ladder definitions.

## Appendix A. All 600 ranked definitions, including failures

Sorted by full immediate delta to each side's clock, exactly as frozen.
This ranking can put losing/sparse shorts high; do not confuse it with the
descriptive A–E absolute-net shortlist. All amounts after trading fees,
before funding; full/recent dates are those in section 2.

ID shorthand `TF/nN/mM/mode/side/exit` expands exactly to
`roc_TFm_nN_mM_mode_side_exit`; L=long, S=short, F=fixed12h,
Z=indicator_or12h. Zero magnitude exists only for momentum.
Each row is one definition; counts are full0m / recent0m, not summed.
`keep` marks the predeclared sample/net/cost descriptive subset, **not strict pass**.

Failure codes: **N** inadequate sample in any case; **P** nonpositive net in
any case; **B** not above same-side clock in any case; **M** monthly regression;
**C** nonpositive extra-cost net; **E** diagnostic account equity exhausted.
Equity-exhausted diagnostic totals are not feasible trading-account results.
A missing rare sample is **inconclusive**, not a falsified family.
Every row fails at least one strict condition.

| Rank / ID shorthand | n full / recent | Net full 0 / +1m $ | Net recent 0 / +1m $ | Full 0 delta $ | Worst month delta $ | Fail / subset |
|---|---|---|---|---|---|---|
| 1. `240m/n5/m1/back_out/S/F` | 226 / 61 | +5,764 / +4,912 | +455 / +9 | +28,046 | -1,533 | M,C |
| 2. `240m/n12/m4/back_out/S/Z` | 122 / 33 | +3,745 / +3,088 | +183 / +142 | +26,028 | -1,761 | M,C |
| 3. `240m/n5/m2/back_out/S/F` | 199 / 54 | +3,741 / +5,178 | -1,402 / -1,597 | +26,023 | -800 | P,M,C |
| 4. `60m/n5/m2/back_out/S/F` | 360 / 84 | +3,712 / +5,096 | +38 / +1,054 | +25,994 | -2,317 | M,C |
| 5. `60m/n5/m2/into/S/F` | 366 / 84 | +3,580 / +3,653 | -4,562 / -3,856 | +25,863 | -1,473 | P,M,C |
| 6. `5m/n12/m4/into/S/Z` | 95 / 20 | +3,165 / +1,751 | +834 / +411 | +25,447 | -1,394 | M / keep |
| 7. `60m/n1/m4/into/S/F` | 23 / 3 | +2,775 / +2,968 | -429 / -406 | +25,058 | -1,330 | N,P,M,C |
| 8. `240m/n5/m0/momentum/S/Z` | 260 / 69 | +2,448 / +2,332 | +1,085 / +1,263 | +24,731 | -1,928 | M,C |
| 9. `30m/n1/m4/into/S/F` | 13 / 2 | +2,256 / +1,854 | -322 / -358 | +24,538 | -1,408 | N,P,M,C |
| 10. `240m/n1/m1/into/S/Z` | 497 / 117 | +2,189 / +1,759 | -2,384 / -2,134 | +24,471 | -1,484 | P,M,C |
| 11. `60m/n1/m4/into/S/Z` | 23 / 3 | +2,110 / +1,978 | -169 / -212 | +24,393 | -1,330 | N,P,M,C |
| 12. `15m/n5/m2/into/S/Z` | 593 / 142 | +2,045 / +299 | +552 / +414 | +24,327 | -1,368 | M,C |
| 13. `30m/n12/m4/into/S/F` | 181 / 48 | +1,804 / +3,261 | +1,878 / +2,063 | +24,086 | -2,260 | M,C |
| 14. `240m/n1/m1/into/S/F` | 430 / 106 | +1,779 / -2,021 | -689 / +1,643 | +24,062 | -964 | P,M,C |
| 15. `5m/n12/m2/into/S/Z` | 691 / 162 | +1,580 / -1,089 | +346 / -171 | +23,862 | -1,420 | P,M,C |
| 16. `240m/n5/m1/back_out/S/Z` | 243 / 65 | +1,571 / -1,103 | +876 / +50 | +23,853 | -1,733 | P,M,C |
| 17. `15m/n5/m4/into/S/Z` | 83 / 18 | +1,400 / +718 | -77 / +12 | +23,683 | -1,431 | P,M,C |
| 18. `30m/n1/m4/back_out/S/F` | 13 / 2 | +1,393 / +1,272 | -234 / -246 | +23,676 | -1,963 | N,P,M,C |
| 19. `5m/n5/m2/into/S/Z` | 417 / 105 | +1,386 / -1,150 | -477 / -1,299 | +23,669 | -2,816 | P,M,C |
| 20. `15m/n1/m2/back_out/S/Z` | 129 / 26 | +1,382 / +396 | -150 / -131 | +23,664 | -2,070 | P,M,C |
| 21. `60m/n12/m4/into/S/Z` | 186 / 47 | +1,359 / +699 | -371 / -1,010 | +23,641 | -1,547 | P,M,C |
| 22. `60m/n1/m4/back_out/S/F` | 23 / 3 | +1,274 / +1,102 | -500 / -541 | +23,557 | -2,071 | N,P,M,C |
| 23. `15m/n1/m2/into/S/Z` | 129 / 27 | +1,202 / +1,071 | -274 / -1 | +23,485 | -1,859 | P,M,C |
| 24. `60m/n12/m4/back_out/S/Z` | 187 / 46 | +1,024 / +1,474 | +1,091 / +890 | +23,306 | -1,232 | M,C |
| 25. `30m/n1/m4/into/S/Z` | 15 / 2 | +1,000 / +623 | -30 / -63 | +23,282 | -1,546 | N,P,M,C |
| 26. `60m/n1/m4/back_out/S/Z` | 23 / 3 | +917 / +713 | +20 / -6 | +23,200 | -2,049 | N,P,M,C |
| 27. `60m/n1/m2/into/S/Z` | 273 / 64 | +849 / -417 | -521 / -783 | +23,131 | -1,360 | P,M,C |
| 28. `5m/n5/m2/back_out/S/Z` | 421 / 106 | +767 / -1,006 | -166 / -330 | +23,050 | -2,924 | P,M,C |
| 29. `15m/n1/m4/back_out/S/Z` | 8 / 1 | +755 / +719 | +1 / +28 | +23,038 | -2,045 | N,M,C |
| 30. `240m/n12/m4/back_out/S/F` | 122 / 33 | +709 / +532 | -310 / -489 | +22,992 | -2,463 | P,M,C |
| 31. `30m/n1/m4/back_out/S/Z` | 15 / 2 | +646 / +515 | +192 / +196 | +22,928 | -1,896 | N,M |
| 32. `60m/n1/m2/back_out/S/F` | 189 / 44 | +622 / -930 | -210 / +244 | +22,904 | -1,469 | P,M,C |
| 33. `60m/n12/m1/into/S/F` | 394 / 103 | +494 / -177 | -2,978 / -3,225 | +22,777 | -1,696 | P,M,C |
| 34. `60m/n1/m1/into/S/Z` | 1025 / 258 | +467 / -2,309 | +440 / +190 | +22,750 | -975 | P,M,C |
| 35. `60m/n5/m4/back_out/S/Z` | 150 / 35 | +400 / +812 | -1,361 / -1,171 | +22,682 | -1,877 | P,M,C |
| 36. `15m/n1/m4/into/S/Z` | 8 / 1 | +297 / +913 | -170 / +34 | +22,580 | -1,679 | N,P,M,C |
| 37. `30m/n1/m2/into/S/Z` | 202 / 49 | +209 / -1,159 | -778 / -1,088 | +22,492 | -1,480 | P,M,C |
| 38. `60m/n12/m2/back_out/S/Z` | 376 / 87 | +173 / -331 | +497 / +712 | +22,456 | -1,830 | P,M,C |
| 39. `30m/n12/m4/into/S/Z` | 191 / 51 | +163 / -242 | -635 / -646 | +22,446 | -1,268 | P,M,C |
| 40. `5m/n1/m2/back_out/S/Z` | 53 / 7 | +145 / -1,156 | +229 / +153 | +22,427 | -2,596 | N,P,M,C |
| 41. `60m/n1/m2/into/S/F` | 188 / 44 | +50 / -196 | -212 / -105 | +22,333 | -1,632 | P,M,C |
| 42. `5m/n5/m4/into/S/F` | 29 / 5 | +18 / -454 | +479 / +569 | +22,300 | -1,663 | N,P,M,C |
| 43. `60m/n12/m1/into/S/Z` | 500 / 126 | +5 / -898 | -2,553 / -2,915 | +22,288 | -1,628 | P,M,C |
| 44. `30m/n5/m4/back_out/S/Z` | 123 / 30 | -39 / -556 | +680 / +402 | +22,243 | -1,330 | P,M,C |
| 45. `30m/n5/m4/into/S/Z` | 124 / 29 | -112 / -334 | -342 / -374 | +22,170 | -1,330 | P,M,C |
| 46. `240m/n5/m0/momentum/S/F` | 232 / 60 | -136 / -276 | -209 / +574 | +22,146 | -1,977 | P,M,C |
| 47. `15m/n1/m4/momentum/S/Z` | 4 / 1 | -272 / -376 | -235 / -64 | +22,010 | -2,037 | N,P,M,C |
| 48. `5m/n5/m4/back_out/S/F` | 29 / 5 | -286 / -304 | +563 / +347 | +21,997 | -1,770 | N,P,M,C |
| 49. `5m/n1/m4/momentum/S/Z` | 4 / 1 | -348 / -1,095 | -31 / -737 | +21,935 | -2,161 | N,P,M,C |
| 50. `5m/n12/m4/into/S/F` | 73 / 17 | -396 / -1,781 | +1,115 / +802 | +21,887 | -1,330 | P,M,C |
| 51. `5m/n1/m4/into/S/Z` | 7 / 1 | -532 / -891 | -276 / -193 | +21,750 | -2,037 | N,P,M,C |
| 52. `15m/n1/m4/momentum/S/F` | 2 / 1 | -550 / -414 | -761 / -546 | +21,733 | -2,037 | N,P,M,C |
| 53. `15m/n1/m4/back_out/S/F` | 8 / 1 | -616 / -716 | -436 / -456 | +21,667 | -1,915 | N,P,M,C |
| 54. `15m/n1/m4/into/S/F` | 8 / 1 | -707 / -158 | -635 / -466 | +21,576 | -1,563 | N,P,M,C |
| 55. `15m/n1/m2/back_out/S/F` | 76 / 21 | -722 / -1,320 | +1,376 / +1,024 | +21,561 | -1,773 | P,M,C |
| 56. `5m/n5/m4/into/S/Z` | 36 / 5 | -781 / -1,381 | -154 / -177 | +21,502 | -2,097 | N,P,M,C |
| 57. `30m/n1/m2/back_out/S/Z` | 200 / 49 | -799 / -1,249 | +788 / +487 | +21,484 | -1,663 | P,M,C |
| 58. `60m/n5/m4/momentum/S/F` | 114 / 23 | -815 / -131 | -1,427 / -1,157 | +21,467 | -3,276 | P,M,C |
| 59. `60m/n5/m2/back_out/S/Z` | 454 / 99 | -815 / -53 | -2,649 / -2,045 | +21,467 | -1,675 | P,M,C |
| 60. `30m/n1/m4/momentum/S/Z` | 6 / 1 | -850 / -844 | -244 / -75 | +21,432 | -2,368 | N,P,M,C |
| 61. `60m/n12/m2/into/S/Z` | 367 / 85 | -861 / -1,989 | -3,349 / -3,858 | +21,421 | -1,756 | P,M,C |
| 62. `5m/n5/m4/back_out/S/Z` | 36 / 5 | -889 / -1,225 | -15 / -355 | +21,393 | -2,016 | N,P,M,C |
| 63. `60m/n5/m4/into/S/Z` | 148 / 33 | -897 / -1,130 | -1,667 / -1,708 | +21,385 | -2,140 | P,M,C |
| 64. `60m/n1/m2/back_out/S/Z` | 270 / 63 | -906 / -1,874 | -1,335 / -1,512 | +21,376 | -1,350 | P,M,C |
| 65. `5m/n12/m4/back_out/S/Z` | 95 / 20 | -955 / -1,182 | -47 / -452 | +21,327 | -2,106 | P,M,C |
| 66. `5m/n1/m2/into/S/Z` | 54 / 7 | -957 / -1,065 | -292 / +77 | +21,326 | -2,589 | N,P,M,C |
| 67. `240m/n1/m4/into/S/Z` | 73 / 15 | -980 / -1,576 | -116 / -175 | +21,303 | -3,092 | P,M,C |
| 68. `30m/n1/m4/momentum/S/F` | 5 / 1 | -1,032 / -1,305 | -761 / -546 | +21,250 | -2,474 | N,P,M,C |
| 69. `240m/n12/m2/momentum/S/Z` | 137 / 32 | -1,118 / -578 | -787 / -363 | +21,165 | -1,451 | P,M,C |
| 70. `240m/n12/m4/into/S/Z` | 121 / 35 | -1,152 / -1,550 | -15 / -577 | +21,130 | -1,241 | P,M,C |
| 71. `5m/n1/m4/back_out/S/Z` | 6 / 1 | -1,209 / -1,424 | +81 / +173 | +21,073 | -2,037 | N,P,M,C |
| 72. `240m/n1/m4/back_out/S/Z` | 74 / 16 | -1,238 / -557 | +1,943 / +1,995 | +21,045 | -3,019 | P,M,C |
| 73. `60m/n5/m2/into/S/Z` | 440 / 97 | -1,279 / -1,683 | -3,843 / -3,266 | +21,004 | -1,675 | P,M,C |
| 74. `60m/n12/m4/into/S/F` | 182 / 47 | -1,298 / -3,029 | -293 / -2,117 | +20,984 | -1,073 | P,M,C |
| 75. `15m/n5/m4/back_out/S/Z` | 83 / 18 | -1,329 / -1,646 | -33 / +7 | +20,953 | -2,005 | P,M,C |
| 76. `240m/n12/m4/into/S/F` | 121 / 35 | -1,342 / -2,175 | -461 / -1,084 | +20,940 | -1,216 | P,M,C |
| 77. `5m/n1/m4/momentum/S/F` | 4 / 1 | -1,435 / -2,248 | -10 / -733 | +20,848 | -1,940 | N,P,M,C |
| 78. `240m/n1/m4/into/S/F` | 70 / 15 | -1,477 / -2,060 | +678 / +497 | +20,805 | -3,755 | P,M,C |
| 79. `60m/n1/m4/momentum/S/Z` | 17 / 3 | -1,618 / -1,581 | -828 / -714 | +20,665 | -2,579 | N,P,M,C |
| 80. `15m/n5/m4/into/S/F` | 69 / 16 | -1,687 / -613 | +1,382 / +1,243 | +20,595 | -1,429 | P,M,C |
| 81. `60m/n1/m4/momentum/S/F` | 15 / 3 | -1,744 / -1,829 | -1,415 / -1,254 | +20,538 | -2,720 | N,P,M,C |
| 82. `240m/n12/m2/momentum/S/F` | 135 / 32 | -1,759 / -1,672 | -2,214 / -1,854 | +20,523 | -1,652 | P,M,C |
| 83. `15m/n5/m2/back_out/S/Z` | 607 / 146 | -1,822 / -2,355 | -40 / -575 | +20,461 | -1,296 | P,M,C |
| 84. `5m/n1/m2/momentum/S/F` | 18 / 5 | -1,898 / -1,815 | -146 / -590 | +20,384 | -3,436 | N,P,M,C |
| 85. `15m/n12/m4/into/S/Z` | 161 / 35 | -1,982 / -3,042 | -2,090 / -2,276 | +20,300 | -1,330 | P,M,C |
| 86. `15m/n12/m2/into/S/Z` | 616 / 144 | -2,041 / -4,810 | -3,074 / -3,440 | +20,241 | -1,399 | P,M,C |
| 87. `15m/n12/m1/into/S/Z` | 1254 / 294 | -2,052 / -5,684 | -5,227 / -6,024 | +20,231 | -1,555 | P,M,C |
| 88. `15m/n1/m2/into/S/F` | 75 / 20 | -2,090 / -1,518 | +1,001 / +1,234 | +20,193 | -2,267 | P,M,C |
| 89. `30m/n12/m2/into/S/Z` | 491 / 108 | -2,198 / -3,178 | -4,071 / -4,263 | +20,084 | -2,010 | P,M,C |
| 90. `5m/n1/m2/momentum/S/Z` | 29 / 6 | -2,199 / -3,018 | -522 / -900 | +20,083 | -2,417 | N,P,M,C |
| 91. `5m/n5/m4/momentum/S/Z` | 20 / 2 | -2,294 / -1,705 | -235 / -355 | +19,988 | -2,847 | N,P,M,C |
| 92. `240m/n1/m2/momentum/S/F` | 239 / 50 | -2,333 / +1,456 | -3,859 / -2,975 | +19,949 | -3,850 | P,M,C |
| 93. `30m/n12/m2/into/S/F` | 393 / 92 | -2,377 / -3,705 | -2,932 / -2,565 | +19,906 | -950 | P,M,C |
| 94. `5m/n1/m4/into/S/F` | 6 / 1 | -2,398 / -2,755 | -635 / -466 | +19,885 | -2,037 | N,P,M,C |
| 95. `5m/n5/m4/momentum/S/F` | 17 / 2 | -2,473 / -1,374 | -669 / -709 | +19,810 | -3,508 | N,P,M,C |
| 96. `15m/n5/m4/back_out/S/F` | 69 / 16 | -2,503 / -2,389 | +982 / +1,060 | +19,779 | -1,958 | P,M,C |
| 97. `240m/n1/m2/into/S/Z` | 266 / 64 | -2,597 / -3,521 | -2,045 / -1,390 | +19,685 | -2,172 | P,M,C |
| 98. `240m/n5/m2/back_out/S/Z` | 210 / 56 | -2,608 / -3,311 | -2,148 / -2,526 | +19,674 | -1,327 | P,M,C |
| 99. `15m/n12/m4/into/S/F` | 138 / 31 | -2,744 / -3,775 | -330 / -707 | +19,539 | -2,077 | P,M,C |
| 100. `5m/n1/m4/back_out/S/F` | 6 / 1 | -2,907 / -2,499 | -352 / -279 | +19,376 | -2,037 | N,P,M,C |
| 101. `30m/n5/m1/into/S/Z` | 1142 / 265 | -3,127 / -7,366 | -4,357 / -5,272 | +19,155 | -1,842 | P,M,C |
| 102. `60m/n5/m1/into/S/F` | 515 / 127 | -3,175 / -1,635 | -3,528 / -3,010 | +19,107 | -851 | P,M,C |
| 103. `240m/n5/m1/momentum/S/Z` | 244 / 60 | -3,230 / -3,557 | -583 / -600 | +19,052 | -2,630 | P,M,C |
| 104. `15m/n1/m2/momentum/S/Z` | 101 / 27 | -3,298 / -3,687 | -1,423 / -1,439 | +18,984 | -2,024 | P,M,C |
| 105. `30m/n5/m4/back_out/S/F` | 104 / 26 | -3,306 / -4,569 | -1,338 / -1,665 | +18,977 | -1,742 | P,M,C |
| 106. `5m/n1/m1/back_out/S/Z` | 660 / 139 | -3,482 / -5,821 | -556 / -873 | +18,801 | -3,488 | P,M,C |
| 107. `240m/n12/m4/momentum/S/F` | 128 / 24 | -3,529 / -4,382 | +7 / +592 | +18,754 | -3,496 | P,M,C |
| 108. `15m/n1/m1/back_out/S/Z` | 1071 / 259 | -3,575 / -3,895 | +752 / +682 | +18,708 | -2,825 | P,M,C |
| 109. `30m/n1/m2/momentum/S/F` | 116 / 26 | -3,597 / -5,406 | +312 / +741 | +18,686 | -4,022 | P,M,C |
| 110. `60m/n12/m4/momentum/S/F` | 170 / 38 | -3,605 / -4,657 | -2,382 / -2,475 | +18,677 | -2,221 | P,M,C |
| 111. `240m/n12/m2/into/S/Z` | 141 / 32 | -3,624 / -3,469 | -2,092 / -2,027 | +18,659 | -1,813 | P,M,C |
| 112. `60m/n5/m4/momentum/S/Z` | 122 / 24 | -3,743 / -3,137 | -2,276 / -1,919 | +18,539 | -2,870 | P,M,C |
| 113. `240m/n1/m2/into/S/F` | 245 / 61 | -3,783 / -8,048 | -3,279 / -2,344 | +18,500 | -2,203 | P,M,C |
| 114. `30m/n12/m1/into/S/Z` | 779 / 178 | -3,873 / -5,632 | -5,214 / -5,658 | +18,410 | -2,145 | P,M,C |
| 115. `15m/n1/m2/momentum/S/F` | 67 / 17 | -3,876 / -4,482 | +835 / +693 | +18,406 | -2,221 | P,M,C |
| 116. `30m/n5/m4/into/S/F` | 103 / 24 | -3,973 / -3,692 | -1,226 / -1,245 | +18,309 | -1,631 | P,M,C |
| 117. `240m/n12/m2/back_out/S/Z` | 145 / 34 | -4,060 / -4,205 | -1,788 / -1,852 | +18,223 | -2,174 | P,M,C |
| 118. `30m/n12/m1/into/S/F` | 516 / 124 | -4,078 / -2,891 | -2,112 / -1,964 | +18,204 | -970 | P,M,C |
| 119. `15m/n5/m4/momentum/S/Z` | 63 / 13 | -4,080 / -3,360 | -625 / -252 | +18,203 | -2,828 | P,M,C |
| 120. `240m/n5/m4/back_out/S/Z` | 143 / 32 | -4,213 / -3,435 | -4,894 / -4,708 | +18,070 | -2,857 | P,M,C |
| 121. `240m/n12/m1/into/S/Z` | 169 / 46 | -4,343 / -3,894 | -1,904 / -1,762 | +17,940 | -1,228 | P,M,C |
| 122. `240m/n5/m1/momentum/S/F` | 230 / 56 | -4,391 / -3,286 | -1,375 / -1,092 | +17,892 | -2,106 | P,M,C |
| 123. `30m/n12/m4/back_out/S/F` | 182 / 48 | -4,405 / -2,685 | +993 / +1,267 | +17,877 | -2,627 | P,M,C |
| 124. `15m/n12/m4/momentum/S/F` | 118 / 25 | -4,429 / -3,611 | -1,407 / -784 | +17,853 | -3,170 | P,M,C |
| 125. `60m/n5/m4/into/S/F` | 138 / 31 | -4,443 / -5,256 | -1,850 / -2,087 | +17,840 | -3,041 | P,M,C |
| 126. `30m/n12/m4/momentum/S/F` | 155 / 35 | -4,545 / -3,955 | -1,182 / -390 | +17,737 | -3,815 | P,M,C |
| 127. `240m/n5/m1/into/S/F` | 231 / 66 | -4,663 / -4,588 | -1,977 / -1,649 | +17,619 | -2,837 | P,M,C |
| 128. `240m/n5/m2/into/S/F` | 203 / 53 | -4,678 / -6,118 | -2,939 / -3,043 | +17,604 | -2,192 | P,M,C |
| 129. `5m/n12/m4/momentum/S/F` | 49 / 12 | -4,758 / -4,654 | -67 / -602 | +17,524 | -3,736 | P,M,C |
| 130. `30m/n12/m4/back_out/S/Z` | 193 / 52 | -4,788 / -4,240 | -1,093 / -1,386 | +17,494 | -1,374 | P,M,C |
| 131. `30m/n1/m1/into/S/Z` | 1143 / 268 | -4,811 / -9,763 | -3,694 / -4,656 | +17,472 | -2,086 | P,M,C |
| 132. `60m/n12/m2/into/S/F` | 325 / 78 | -4,856 / -5,144 | -4,235 / -5,719 | +17,427 | -968 | P,M,C |
| 133. `5m/n12/m4/back_out/S/F` | 73 / 17 | -4,886 / -4,402 | -114 / -12 | +17,396 | -1,715 | P,M,C |
| 134. `30m/n5/m2/into/S/Z` | 537 / 128 | -4,908 / -8,080 | -1,882 / -2,570 | +17,374 | -1,687 | P,M,C |
| 135. `240m/n1/m4/momentum/S/F` | 65 / 14 | -4,930 / -3,182 | +262 / +836 | +17,353 | -3,460 | P,M,C |
| 136. `60m/n5/m4/back_out/S/F` | 137 / 31 | -4,960 / -5,122 | -2,689 / -2,521 | +17,323 | -3,121 | P,M,C |
| 137. `240m/n12/m4/momentum/S/Z` | 128 / 24 | -5,007 / -5,516 | -372 / +91 | +17,275 | -3,361 | P,M,C |
| 138. `240m/n12/m2/into/S/F` | 141 / 32 | -5,119 / -4,695 | -3,076 / -2,999 | +17,163 | -1,813 | P,M,C |
| 139. `5m/n1/m2/back_out/S/F` | 37 / 6 | -5,177 / -5,287 | -30 / -7 | +17,106 | -2,896 | N,P,M,C |
| 140. `5m/n1/m2/into/S/F` | 37 / 6 | -5,224 / -5,278 | -118 / +173 | +17,058 | -2,933 | N,P,M,C |
| 141. `240m/n1/m2/momentum/S/Z` | 253 / 53 | -5,257 / -3,621 | -3,100 / -2,382 | +17,026 | -2,872 | P,M,C |
| 142. `240m/n1/m4/back_out/S/F` | 71 / 16 | -5,292 / -3,217 | +522 / +1,045 | +16,991 | -2,466 | P,M,C |
| 143. `240m/n5/m2/momentum/S/Z` | 209 / 44 | -5,460 / -5,317 | -1,821 / -1,966 | +16,823 | -2,655 | P,M,C |
| 144. `240m/n5/m4/back_out/S/F` | 139 / 31 | -5,514 / -5,134 | -5,539 / -4,993 | +16,768 | -2,573 | P,M,C |
| 145. `240m/n1/m2/back_out/S/Z` | 263 / 63 | -5,530 / -1,596 | -985 / +37 | +16,752 | -3,251 | P,M,C |
| 146. `5m/n12/m4/momentum/S/Z` | 64 / 14 | -5,543 / -5,335 | -1,525 / -2,039 | +16,740 | -2,821 | P,M,C |
| 147. `5m/n12/m2/back_out/S/Z` | 697 / 163 | -5,577 / -6,350 | -891 / -1,709 | +16,705 | -1,608 | P,M,C |
| 148. `15m/n1/m1/into/S/Z` | 1068 / 259 | -5,623 / -7,500 | -866 / -1,394 | +16,660 | -3,731 | P,M,C |
| 149. `240m/n5/m2/momentum/S/F` | 206 / 43 | -5,643 / -6,082 | -1,928 / -2,575 | +16,640 | -2,466 | P,M,C |
| 150. `240m/n5/m4/into/S/Z` | 144 / 32 | -5,772 / -6,884 | -6,872 / -7,121 | +16,511 | -2,056 | P,M,C |
| 151. `240m/n12/m1/back_out/S/Z` | 172 / 45 | -5,790 / -6,408 | -1,905 / -2,957 | +16,493 | -2,795 | P,M,C |
| 152. `15m/n12/m4/back_out/S/Z` | 160 / 36 | -6,155 / -6,514 | -2,659 / -2,756 | +16,127 | -1,650 | P,M,C |
| 153. `240m/n1/m1/back_out/S/Z` | 494 / 117 | -6,185 / -3,940 | -62 / -1,061 | +16,098 | -2,744 | P,M,C |
| 154. `240m/n12/m0/momentum/S/F` | 168 / 47 | -6,217 / -4,793 | -3,790 / -3,056 | +16,066 | -3,152 | P,M,C |
| 155. `240m/n1/m4/momentum/S/Z` | 68 / 14 | -6,228 / -5,974 | -143 / -4 | +16,054 | -3,313 | P,M,C |
| 156. `15m/n5/m4/momentum/S/F` | 48 / 11 | -6,234 / -6,255 | +294 / +581 | +16,049 | -3,762 | P,M,C |
| 157. `60m/n5/m1/back_out/S/F` | 510 / 129 | -6,336 / -9,421 | -4,007 / -1,572 | +15,946 | -1,115 | P,M,C |
| 158. `30m/n5/m4/momentum/S/Z` | 109 / 21 | -6,488 / -5,089 | -1,072 / -506 | +15,795 | -3,284 | P,M,C |
| 159. `30m/n1/m2/into/S/F` | 132 / 35 | -6,560 / -6,488 | -3,281 / -3,874 | +15,722 | -1,632 | P,M,C |
| 160. `5m/n1/m1/into/S/Z` | 661 / 135 | -6,694 / -7,088 | -2,086 / -2,117 | +15,589 | -3,264 | P,M,C |
| 161. `240m/n12/m1/into/S/F` | 164 / 45 | -6,702 / -5,426 | -3,136 / -1,915 | +15,581 | -1,105 | P,M,C |
| 162. `240m/n5/m2/into/S/Z` | 204 / 54 | -6,719 / -7,159 | -4,018 / -4,114 | +15,564 | -2,195 | P,M,C |
| 163. `30m/n1/m2/back_out/S/F` | 132 / 35 | -6,752 / -7,343 | -3,485 / -3,737 | +15,530 | -1,519 | P,M,C |
| 164. `15m/n12/m4/momentum/S/Z` | 144 / 31 | -6,756 / -5,885 | -1,860 / -1,450 | +15,527 | -2,931 | P,M,C |
| 165. `30m/n12/m2/back_out/S/Z` | 498 / 109 | -6,803 / -7,952 | -2,976 / -2,959 | +15,480 | -1,647 | P,M,C |
| 166. `15m/n1/m1/momentum/S/F` | 392 / 92 | -6,811 / -8,713 | -5,203 / -4,979 | +15,471 | -1,660 | P,M,C |
| 167. `60m/n1/m1/back_out/S/Z` | 1025 / 257 | -6,837 / -4,077 | -2,055 / -2,196 | +15,446 | -1,713 | P,M,C |
| 168. `240m/n12/m1/momentum/S/F` | 148 / 36 | -6,967 / -3,612 | -1,888 / -1,640 | +15,316 | -3,137 | P,M,C |
| 169. `240m/n12/m2/back_out/S/F` | 141 / 34 | -7,054 / -7,077 | -3,589 / -3,416 | +15,229 | -1,971 | P,M,C |
| 170. `30m/n1/m2/momentum/S/Z` | 180 / 40 | -7,067 / -5,112 | -1,426 / -982 | +15,215 | -3,613 | P,M,C |
| 171. `240m/n12/m1/momentum/S/Z` | 154 / 36 | -7,126 / -4,849 | -1,697 / -1,613 | +15,156 | -4,337 | P,M,C |
| 172. `5m/n12/m2/into/S/F` | 337 / 76 | -7,186 / -6,843 | -5,933 / -5,446 | +15,096 | -1,142 | P,M,C |
| 173. `60m/n12/m4/back_out/S/F` | 182 / 46 | -7,294 / -7,435 | -3,788 / -4,075 | +14,989 | -3,454 | P,M,C |
| 174. `60m/n1/m2/momentum/S/Z` | 244 / 58 | -7,433 / -6,742 | -2,201 / -1,761 | +14,850 | -3,169 | P,M,C |
| 175. `30m/n5/m4/momentum/S/F` | 93 / 18 | -7,435 / -6,711 | +510 / +1,124 | +14,848 | -3,418 | P,M,C |
| 176. `30m/n5/m2/back_out/S/Z` | 567 / 135 | -7,482 / -9,309 | -2,609 / -3,370 | +14,801 | -3,148 | P,M,C |
| 177. `240m/n5/m1/into/S/Z` | 237 / 67 | -7,665 / -7,663 | -5,064 / -4,815 | +14,618 | -2,850 | P,M,C |
| 178. `15m/n12/m4/back_out/S/F` | 134 / 32 | -7,736 / -8,341 | -1,189 / -1,247 | +14,546 | -2,889 | P,M,C |
| 179. `240m/n5/m4/into/S/F` | 144 / 32 | -7,870 / -10,190 | -7,203 / -7,292 | +14,412 | -2,137 | P,M,C |
| 180. `30m/n12/m2/back_out/S/F` | 389 / 91 | -7,933 / -6,703 | -1,076 / -768 | +14,350 | -1,624 | P,M,C |
| 181. `30m/n12/m4/momentum/S/Z` | 170 / 39 | -8,204 / -6,976 | -1,754 / -1,507 | +14,079 | -4,425 | P,M,C |
| 182. `5m/n5/m2/into/S/F` | 198 / 46 | -8,222 / -8,407 | -4,749 / -4,767 | +14,061 | -2,303 | P,M,C |
| 183. `15m/n5/m2/momentum/S/F` | 318 / 74 | -8,326 / -7,524 | -4,558 / -3,840 | +13,957 | -3,347 | P,M,C |
| 184. `5m/n1/m1/into/S/F` | 238 / 53 | -8,395 / -9,564 | -1,241 / -1,479 | +13,888 | -2,377 | P,M,C |
| 185. `240m/n12/m0/momentum/S/Z` | 189 / 52 | -8,465 / -8,953 | -3,055 / -3,179 | +13,817 | -3,452 | P,M,C |
| 186. `5m/n12/m2/back_out/S/F` | 339 / 77 | -8,520 / -7,795 | -6,149 / -6,257 | +13,762 | -1,297 | P,M,C |
| 187. `15m/n1/m1/back_out/S/F` | 377 / 92 | -8,558 / -8,043 | -3,182 / -2,119 | +13,725 | -614 | P,M,C |
| 188. `240m/n1/m2/back_out/S/F` | 239 / 59 | -8,723 / -4,340 | -2,849 / -1,014 | +13,560 | -3,190 | P,M,C |
| 189. `15m/n1/m1/into/S/F` | 377 / 92 | -8,784 / -8,197 | -2,342 / -1,578 | +13,499 | -1,542 | P,M,C |
| 190. `60m/n5/m1/into/S/Z` | 713 / 169 | -8,827 / -10,622 | -4,802 / -5,351 | +13,455 | -1,695 | P,M,C |
| 191. `15m/n5/m1/into/S/Z` | 1663 / 402 | -8,880 / -12,314 | -2,019 / -2,647 | +13,402 | -1,364 | P,M,C |
| 192. `240m/n12/m1/back_out/S/F` | 158 / 42 | -9,089 / -8,728 | -2,674 / -2,485 | +13,194 | -3,497 | P,M,C |
| 193. `60m/n12/m4/momentum/S/Z` | 174 / 39 | -9,114 / -9,456 | -3,124 / -3,208 | +13,168 | -2,586 | P,M,C |
| 194. `15m/n12/m2/back_out/S/Z` | 639 / 152 | -9,191 / -10,041 | -3,546 / -3,629 | +13,092 | -2,612 | P,M,C |
| 195. `60m/n12/m2/momentum/S/F` | 325 / 73 | -9,241 / -8,416 | -5,093 / -4,986 | +13,042 | -3,953 | P,M,C |
| 196. `5m/n1/m1/back_out/S/F` | 238 / 53 | -9,276 / -10,079 | -1,646 / -1,592 | +13,007 | -1,956 | P,M,C |
| 197. `15m/n12/m2/into/S/F` | 400 / 95 | -9,473 / -8,771 | -5,823 / -6,306 | +12,810 | -1,532 | P,M,C |
| 198. `5m/n5/m2/momentum/S/F` | 189 / 41 | -9,616 / -9,703 | +341 / -482 | +12,666 | -4,499 | P,M,C |
| 199. `60m/n5/m2/momentum/S/Z` | 404 / 88 | -9,691 / -8,033 | -3,893 / -3,257 | +12,592 | -3,718 | P,M,C |
| 200. `240m/n5/m4/momentum/S/Z` | 144 / 28 | -9,701 / -8,276 | -2,095 / -1,506 | +12,582 | -2,129 | P,M,C |
| 201. `60m/n12/m1/back_out/S/Z` | 528 / 141 | -9,731 / -8,379 | -5,240 / -3,966 | +12,551 | -2,646 | P,M,C |
| 202. `15m/n5/m2/into/S/F` | 326 / 76 | -9,815 / -10,742 | -3,621 / -3,781 | +12,468 | -1,298 | P,M,C |
| 203. `30m/n1/m1/into/S/F` | 448 / 106 | -9,982 / -11,927 | -5,406 / -7,450 | +12,301 | -1,952 | P,M,C |
| 204. `60m/n12/m2/back_out/S/F` | 317 / 77 | -10,049 / -9,955 | -3,833 / -4,934 | +12,233 | -2,186 | P,M,C |
| 205. `15m/n12/m2/momentum/S/F` | 392 / 89 | -10,061 / -9,973 | -5,300 / -5,966 | +12,222 | -2,079 | P,M,C |
| 206. `30m/n1/m1/back_out/S/F` | 450 / 108 | -10,111 / -13,757 | -4,352 / -7,918 | +12,172 | -2,323 | P,M,C |
| 207. `240m/n1/m1/back_out/S/F` | 426 / 105 | -10,134 / -4,815 | -6,660 / -4,654 | +12,148 | -1,466 | P,M,C |
| 208. `5m/n5/m1/back_out/S/F` | 565 / 136 | -10,181 / -10,270 | -7,791 / -7,463 | +12,102 | -627 | P,M,C |
| 209. `30m/n5/m2/into/S/F` | 358 / 83 | -10,191 / -8,019 | -5,211 / -4,393 | +12,092 | -2,056 | P,M,C |
| 210. `240m/n5/m4/momentum/S/F` | 144 / 28 | -10,212 / -8,277 | -2,128 / -1,409 | +12,071 | -1,805 | P,M,C |
| 211. `30m/n12/m0/momentum/S/F` | 570 / 143 | -10,387 / -11,289 | -3,911 / -4,433 | +11,896 | -2,639 | P,M,C |
| 212. `5m/n5/m2/back_out/S/F` | 198 / 46 | -10,783 / -10,802 | -4,961 / -4,961 | +11,500 | -2,310 | P,M,C |
| 213. `15m/n5/m2/back_out/S/F` | 327 / 77 | -10,801 / -9,392 | -4,407 / -4,519 | +11,481 | -1,860 | P,M,C |
| 214. `240m/n1/m1/momentum/S/F` | 414 / 99 | -10,817 / -6,893 | -6,808 / -5,360 | +11,465 | -2,733 | P,M,C |
| 215. `30m/n5/m2/back_out/S/F` | 359 / 83 | -10,870 / -11,355 | -6,021 / -6,952 | +11,412 | -2,814 | P,M,C |
| 216. `60m/n12/m2/momentum/S/Z` | 354 / 79 | -10,996 / -10,596 | -3,684 / -3,640 | +11,287 | -4,193 | P,M,C |
| 217. `30m/n12/m1/back_out/S/F` | 515 / 132 | -11,105 / -10,242 | -7,104 / -5,913 | +11,178 | -1,921 | P,M,C |
| 218. `30m/n1/m1/back_out/S/Z` | 1140 / 275 | -11,389 / -10,078 | +230 / -122 | +10,894 | -2,491 | P,M,C |
| 219. `30m/n5/m2/momentum/S/F` | 345 / 77 | -11,802 / -8,943 | -5,797 / -4,663 | +10,480 | -2,484 | P,M,C |
| 220. `15m/n12/m2/back_out/S/F` | 400 / 97 | -11,903 / -12,039 | -5,033 / -5,687 | +10,380 | -2,258 | P,M,C |
| 221. `60m/n1/m2/momentum/S/F` | 178 / 43 | -12,117 / -11,347 | -2,990 / -2,436 | +10,166 | -2,742 | P,M,C |
| 222. `60m/n5/m1/momentum/S/Z` | 689 / 161 | -12,138 / -10,563 | -5,283 / -4,499 | +10,145 | -2,889 | P,M,C |
| 223. `30m/n5/m2/momentum/S/Z` | 508 / 109 | -12,185 / -9,356 | -3,711 / -3,096 | +10,098 | -3,601 | P,M,C |
| 224. `30m/n12/m2/momentum/S/Z` | 452 / 102 | -12,253 / -10,809 | -4,471 / -3,845 | +10,030 | -3,210 | P,M,C |
| 225. `30m/n5/m1/into/S/F` | 586 / 140 | -12,283 / -9,332 | -5,365 / -7,764 | +9,999 | -1,308 | P,M,C |
| 226. `30m/n12/m2/momentum/S/F` | 376 / 86 | -12,417 / -11,340 | -8,044 / -8,350 | +9,866 | -4,481 | P,M,C |
| 227. `60m/n5/m2/momentum/S/F` | 349 / 76 | -12,425 / -9,465 | -5,442 / -5,155 | +9,857 | -3,872 | P,M,C |
| 228. `60m/n12/m1/momentum/S/Z` | 468 / 103 | -12,453 / -11,907 | -2,910 / -2,538 | +9,829 | -4,594 | P,M,C |
| 229. `30m/n5/m0/momentum/S/F` | 691 / 173 | -12,519 / -10,878 | -3,271 / -1,826 | +9,764 | -1,728 | P,M,C |
| 230. `15m/n12/m1/back_out/S/Z` | 1323 / 319 | -12,563 / -13,512 | -6,037 / -5,646 | +9,719 | -3,164 | P,M,C |
| 231. `60m/n1/m1/momentum/S/F` | 486 / 109 | -12,748 / -13,473 | -5,255 / -7,153 | +9,534 | -2,687 | P,M,C |
| 232. `60m/n5/m1/momentum/S/F` | 505 / 120 | -12,832 / -8,095 | -5,201 / -4,349 | +9,450 | -1,380 | P,M,C |
| 233. `5m/n5/m1/into/S/F` | 565 / 136 | -13,285 / -12,132 | -7,257 / -6,472 | +8,997 | -883 | P,M,C |
| 234. `60m/n12/m1/into/L/F` | 392 / 93 | +12,223 / +11,263 | +7,122 / +7,170 | +8,918 | -4,673 | M / keep |
| 235. `30m/n5/m1/momentum/S/F` | 568 / 133 | -13,443 / -15,467 | -4,950 / -5,139 | +8,840 | -2,879 | P,M,C |
| 236. `5m/n1/m1/momentum/S/F` | 234 / 52 | -13,454 / -11,393 | -5,467 / -4,371 | +8,829 | -2,720 | P,M,C |
| 237. `5m/n5/m2/momentum/S/Z` | 380 / 84 | -13,483 / -11,631 | -2,471 / -3,056 | +8,799 | -3,532 | P,M,C |
| 238. `60m/n5/m0/momentum/S/F` | 567 / 142 | -13,517 / -10,344 | -2,440 / -1,974 | +8,766 | -1,757 | P,M,C |
| 239. `5m/n5/m1/into/S/Z` | 2293 / 528 | -13,935 / -20,259 | -3,982 / -5,171 | +8,348 | -5,245 | P,M,C |
| 240. `15m/n5/m2/momentum/S/Z` | 563 / 124 | -14,016 / -11,611 | -2,828 / -1,899 | +8,266 | -2,872 | P,M,C |
| 241. `15m/n12/m1/into/S/F` | 609 / 148 | -14,058 / -15,869 | -9,103 / -8,984 | +8,225 | -1,723 | P,M,C |
| 242. `240m/n1/m1/momentum/S/Z` | 467 / 108 | -14,062 / -13,508 | -4,088 / -3,733 | +8,220 | -2,709 | P,M,C |
| 243. `15m/n5/m0/momentum/S/F` | 755 / 194 | -14,124 / -16,377 | -9,116 / -11,272 | +8,158 | -2,165 | P,B,M,C |
| 244. `5m/n1/m1/momentum/S/Z` | 630 / 132 | -14,155 / -11,873 | -2,170 / -2,392 | +8,128 | -3,668 | P,M,C |
| 245. `60m/n12/m0/momentum/S/Z` | 691 / 158 | -14,230 / -13,225 | -5,312 / -4,898 | +8,053 | -2,703 | P,M,C |
| 246. `30m/n12/m1/back_out/S/Z` | 840 / 197 | -14,235 / -15,281 | -7,857 / -8,184 | +8,048 | -2,957 | P,M,C |
| 247. `15m/n1/m1/momentum/S/Z` | 1084 / 255 | -14,827 / -12,775 | -5,800 / -5,148 | +7,456 | -2,162 | P,M,C |
| 248. `5m/n12/m1/into/S/Z` | 2236 / 534 | -14,843 / -19,311 | -3,214 / -4,763 | +7,439 | -2,950 | P,M,C |
| 249. `30m/n1/m1/into/L/F` | 450 / 102 | +10,645 / +9,090 | +7,920 / +7,623 | +7,341 | -2,494 | M / keep |
| 250. `60m/n5/m1/back_out/S/Z` | 768 / 181 | -15,158 / -13,257 | -6,885 / -5,067 | +7,124 | -1,941 | P,M,C |
| 251. `15m/n5/m1/back_out/S/Z` | 1767 / 432 | -15,443 / -14,835 | -5,370 / -5,535 | +6,839 | -1,901 | P,M,C |
| 252. `30m/n5/m1/into/L/Z` | 1133 / 255 | +10,011 / +6,206 | +2,121 / +1,272 | +6,707 | -4,432 | B,M,C |
| 253. `15m/n12/m1/momentum/S/F` | 594 / 138 | -15,694 / -13,978 | -2,835 / -3,068 | +6,589 | -2,118 | P,M,C |
| 254. `30m/n12/m1/momentum/S/F` | 511 / 120 | -15,822 / -16,024 | -6,225 / -6,272 | +6,461 | -1,622 | P,M,C |
| 255. `30m/n1/m1/back_out/L/F` | 449 / 102 | +9,530 / +9,667 | +6,613 / +6,718 | +6,226 | -3,079 | M / keep |
| 256. `5m/n5/m1/into/L/F` | 574 / 132 | +9,500 / +4,926 | +4,690 / +4,150 | +6,196 | -2,724 | B,M,C |
| 257. `5m/n12/m2/into/L/F` | 343 / 77 | +9,454 / +8,913 | +3,653 / +3,482 | +6,149 | -5,422 | B,M / keep |
| 258. `5m/n12/m1/into/S/F` | 651 / 158 | -16,148 / -16,880 | -7,340 / -7,942 | +6,135 | -2,248 | P,M,C |
| 259. `30m/n12/m1/momentum/S/Z` | 766 / 174 | -16,628 / -14,132 | -4,570 / -3,772 | +5,655 | -2,991 | P,M,C |
| 260. `60m/n1/m1/into/S/F` | 485 / 118 | -16,893 / -13,305 | -6,422 / -6,018 | +5,390 | -2,320 | P,M,C |
| 261. `5m/n12/m1/into/L/F` | 646 / 148 | +8,610 / +8,576 | +2,788 / +2,844 | +5,306 | -1,965 | B,M / keep |
| 262. `5m/n12/m2/momentum/S/F` | 343 / 77 | -17,036 / -16,473 | -5,374 / -5,203 | +5,246 | -3,747 | P,M,C |
| 263. `5m/n1/m1/into/L/F` | 234 / 52 | +8,272 / +6,280 | +4,296 / +3,267 | +4,967 | -5,375 | B,M / keep |
| 264. `15m/n12/m1/into/L/Z` | 1229 / 273 | +8,196 / +4,671 | +866 / -59 | +4,892 | -4,002 | P,B,M,C |
| 265. `60m/n1/m2/into/L/F` | 178 / 43 | +8,189 / +7,597 | +2,041 / +1,576 | +4,885 | -5,468 | B,M / keep |
| 266. `60m/n1/m1/back_out/S/F` | 483 / 118 | -17,427 / -15,933 | -7,718 / -7,996 | +4,856 | -1,928 | P,M,C |
| 267. `30m/n5/m1/back_out/S/Z` | 1203 / 279 | -17,591 / -14,039 | -7,402 / -6,649 | +4,692 | -2,613 | P,M,C |
| 268. `5m/n1/m1/back_out/L/F` | 234 / 52 | +7,956 / +7,437 | +4,724 / +4,210 | +4,652 | -5,337 | B,M / keep |
| 269. `30m/n12/m1/back_out/L/F` | 504 / 126 | +7,865 / +7,024 | +4,822 / +4,198 | +4,561 | -3,423 | B,M / keep |
| 270. `60m/n5/m0/momentum/S/Z` | 1095 / 271 | -17,746 / -16,401 | -6,123 / -5,883 | +4,537 | -2,099 | P,M,C |
| 271. `60m/n12/m1/back_out/S/F` | 393 / 106 | -18,034 / -17,706 | -7,661 / -7,000 | +4,248 | -4,257 | P,M,C |
| 272. `15m/n5/m1/into/S/F` | 617 / 150 | -18,183 / -22,881 | -8,773 / -9,054 | +4,100 | -2,529 | P,B,M,C |
| 273. `5m/n5/m1/back_out/S/Z` | 2346 / 540 | -18,286 / -20,516 | -3,034 / -4,165 | +3,997 | -4,731 | P,M,C |
| 274. `15m/n12/m0/momentum/S/F` | 688 / 175 | -18,524 / -16,396 | -6,790 / -8,540 | +3,759 | -1,543 | P,M,C |
| 275. `240m/n5/m4/into/L/F` | 144 / 28 | +7,034 / +5,366 | +1,510 / +836 | +3,730 | -4,180 | B,M / keep |
| 276. `5m/n5/m1/back_out/L/F` | 570 / 132 | +6,829 / +5,055 | +4,208 / +4,415 | +3,524 | -2,416 | B,M,C |
| 277. `5m/n12/m1/back_out/S/F` | 654 / 159 | -19,009 / -17,637 | -8,699 / -9,056 | +3,273 | -3,077 | P,M,C |
| 278. `240m/n5/m4/into/L/Z` | 144 / 28 | +6,524 / +5,320 | +1,477 / +911 | +3,219 | -5,319 | B,M / keep |
| 279. `15m/n12/m2/into/L/Z` | 603 / 133 | +6,351 / +4,285 | +839 / +271 | +3,046 | -5,262 | B,M,C |
| 280. `15m/n5/m1/momentum/S/F` | 603 / 142 | -19,321 / -18,438 | -7,197 / -6,042 | +2,961 | -3,084 | P,M,C |
| 281. `60m/n12/m0/momentum/S/F` | 409 / 101 | -19,380 / -18,119 | -8,432 / -8,318 | +2,902 | -5,399 | P,M,C |
| 282. `60m/n1/m1/momentum/L/F` | 485 / 118 | +6,188 / +2,934 | +3,798 / +3,483 | +2,884 | -2,679 | B,M,C |
| 283. `5m/n12/m1/back_out/L/F` | 646 / 150 | +6,187 / +5,136 | +1,985 / +1,911 | +2,882 | -2,621 | B,M,C |
| 284. `15m/n5/m1/into/L/F` | 603 / 142 | +6,019 / +5,269 | +4,045 / +2,913 | +2,715 | -3,216 | B,M,C |
| 285. `240m/n5/m0/momentum/L/Z` | 260 / 69 | +6,006 / +5,968 | +2,207 / +2,186 | +2,702 | -3,010 | B,M / keep |
| 286. `15m/n12/m2/momentum/S/Z` | 603 / 133 | -19,631 / -17,563 | -3,767 / -3,199 | +2,652 | -2,667 | P,M,C |
| 287. `5m/n12/m2/momentum/S/Z` | 689 / 161 | -19,793 / -18,594 | -5,319 / -6,127 | +2,490 | -4,491 | P,M,C |
| 288. `60m/n1/m0/momentum/S/F` | 748 / 192 | -19,926 / -17,475 | -8,501 / -5,589 | +2,357 | -1,380 | P,M,C |
| 289. `5m/n5/m2/into/L/F` | 189 / 41 | +5,428 / +5,514 | -1,264 / -442 | +2,123 | -5,517 | P,B,M,C |
| 290. `30m/n5/m4/into/L/F` | 93 / 18 | +5,382 / +4,703 | -905 / -1,518 | +2,077 | -5,897 | P,B,M,C |
| 291. `60m/n12/m4/into/L/Z` | 174 / 39 | +5,278 / +5,641 | +2,263 / +2,369 | +1,974 | -5,613 | B,M / keep |
| 292. `5m/n12/m0/momentum/S/F` | 794 / 203 | -20,398 / -22,211 | -8,170 / -8,731 | +1,885 | -1,418 | P,M,C |
| 293. `15m/n5/m4/into/L/F` | 48 / 11 | +5,172 / +5,193 | -535 / -822 | +1,867 | -6,569 | P,B,M,C |
| 294. `5m/n5/m2/into/L/Z` | 380 / 84 | +5,113 / +3,263 | +621 / +1,205 | +1,809 | -6,136 | B,M,C |
| 295. `60m/n1/m2/back_out/L/F` | 178 / 42 | +5,072 / +7,478 | +1,213 / +283 | +1,768 | -4,726 | B,M,C |
| 296. `30m/n1/m1/momentum/S/F` | 450 / 102 | -20,584 / -18,742 | -10,196 / -9,854 | +1,698 | -3,726 | P,B,M,C |
| 297. `30m/n12/m0/momentum/S/Z` | 1394 / 352 | -20,608 / -18,333 | -5,651 / -4,889 | +1,675 | -3,630 | P,M,C |
| 298. `5m/n1/m0/momentum/L/F` | 849 / 216 | +4,886 / +1,352 | +5,183 / +5,665 | +1,582 | -797 | B,M,C |
| 299. `240m/n1/m0/momentum/S/F` | 532 / 137 | -20,771 / -13,801 | -9,601 / -8,265 | +1,511 | -3,055 | P,M,C |
| 300. `240m/n1/m4/into/L/Z` | 68 / 14 | +4,726 / +4,473 | -165 / -304 | +1,422 | -6,000 | P,B,M,C |
| 301. `60m/n5/m2/into/L/F` | 349 / 76 | +4,716 / +2,154 | +3,743 / +3,566 | +1,411 | -6,575 | B,M,C |
| 302. `60m/n12/m1/momentum/S/F` | 392 / 93 | -20,887 / -19,860 | -9,199 / -9,225 | +1,396 | -6,167 | P,M,C |
| 303. `240m/n5/m4/momentum/L/F` | 144 / 32 | +4,695 / +7,255 | +6,491 / +6,646 | +1,391 | -2,626 | M / keep |
| 304. `5m/n12/m2/into/L/Z` | 689 / 161 | +4,621 / +3,423 | +1,773 / +2,581 | +1,317 | -5,843 | B,M,C |
| 305. `30m/n1/m1/momentum/S/Z` | 1157 / 253 | -21,007 / -16,777 | -4,618 / -3,822 | +1,276 | -4,711 | P,M,C |
| 306. `15m/n5/m1/momentum/L/F` | 617 / 150 | +4,574 / +9,509 | +5,444 / +5,768 | +1,270 | -2,842 | M,C |
| 307. `30m/n12/m1/into/L/F` | 511 / 120 | +4,569 / +4,925 | +3,579 / +3,626 | +1,264 | -3,563 | B,M,C |
| 308. `15m/n12/m1/back_out/L/F` | 602 / 138 | +4,461 / +6,435 | +2,345 / +2,087 | +1,157 | -2,274 | B,M,C |
| 309. `30m/n12/m4/into/L/Z` | 170 / 39 | +4,457 / +3,230 | +895 / +648 | +1,152 | -5,955 | B,M / keep |
| 310. `60m/n12/m4/back_out/L/Z` | 171 / 37 | +4,422 / +4,445 | +734 / +847 | +1,118 | -5,518 | B,M / keep |
| 311. `5m/n1/m2/momentum/L/F` | 37 / 6 | +4,405 / +4,458 | -14 / -304 | +1,101 | -6,051 | N,P,B,M,C |
| 312. `5m/n12/m2/back_out/L/F` | 341 / 78 | +4,310 / +4,150 | +2,502 / +2,485 | +1,005 | -5,351 | B,M / keep |
| 313. `5m/n12/m0/momentum/L/F` | 794 / 204 | +4,243 / +2,181 | +3,277 / +3,057 | +938 | -1,610 | B,M,C |
| 314. `240m/n1/m4/back_out/L/Z` | 68 / 14 | +4,221 / +4,510 | -131 / -426 | +916 | -5,772 | P,B,M,C |
| 315. `30m/n5/m2/into/L/F` | 345 / 77 | +4,181 / +1,501 | +4,076 / +3,009 | +877 | -5,008 | B,M,C |
| 316. `5m/n12/m4/into/L/Z` | 64 / 14 | +4,129 / +3,922 | +1,216 / +1,729 | +825 | -5,894 | B,M / keep |
| 317. `5m/n1/m0/momentum/S/F` | 850 / 216 | -21,468 / -20,953 | -9,970 / -9,843 | +815 | -717 | P,B,M,C |
| 318. `30m/n12/m2/into/L/F` | 376 / 86 | +4,114 / +3,148 | +6,122 / +6,428 | +809 | -4,985 | B,M,C |
| 319. `240m/n1/m0/momentum/S/Z` | 673 / 165 | -21,498 / -20,886 | -4,330 / -4,058 | +785 | -3,231 | P,M,C |
| 320. `30m/n5/m4/into/L/Z` | 109 / 21 | +4,084 / +2,686 | +609 / +43 | +780 | -5,427 | B,M,C |
| 321. `5m/n5/m2/momentum/L/F` | 198 / 46 | +3,859 / +4,044 | +3,732 / +3,750 | +555 | -4,271 | B,M / keep |
| 322. `60m/n1/m1/momentum/S/Z` | 987 / 228 | -21,730 / -19,583 | -7,413 / -7,067 | +552 | -4,232 | P,M,C |
| 323. `30m/n5/m1/back_out/S/F` | 585 / 141 | -21,778 / -15,812 | -12,463 / -10,407 | +504 | -3,628 | P,B,M,C |
| 324. `30m/n5/m4/back_out/L/F` | 92 / 18 | +3,787 / +3,673 | -2,137 / -2,314 | +482 | -6,396 | P,B,M,C |
| 325. `240m/n1/m1/into/L/Z` | 467 / 108 | +3,756 / +3,423 | +1,686 / +1,354 | +452 | -5,490 | B,M,C |
| 326. `30m/n5/m2/back_out/L/F` | 346 / 76 | +3,735 / +2,406 | +2,616 / +3,341 | +431 | -4,765 | B,M,C |
| 327. `240m/n12/m1/into/L/Z` | 154 / 36 | +3,732 / +1,634 | +904 / +842 | +428 | -4,707 | B,M / keep |
| 328. `240m/n12/m1/into/L/F` | 148 / 36 | +3,705 / +640 | +1,095 / +912 | +400 | -4,642 | B,M,C |
| 329. `60m/n1/m1/back_out/L/F` | 489 / 110 | +3,676 / +7,345 | +3,340 / +4,733 | +372 | -3,339 | B,M,C |
| 330. `5m/n12/m4/into/L/F` | 49 / 12 | +3,676 / +3,571 | -197 / +338 | +371 | -5,827 | P,B,M,C |
| 331. `30m/n1/m2/momentum/L/F` | 132 / 35 | +3,651 / +3,601 | +2,508 / +3,122 | +346 | -4,195 | B,M / keep |
| 332. `15m/n1/m2/back_out/L/F` | 67 / 17 | +3,645 / +2,957 | -858 / -890 | +341 | -6,825 | P,B,M,C |
| 333. `5m/n5/m2/back_out/L/F` | 190 / 41 | +3,616 / +3,662 | -707 / -1,005 | +311 | -5,558 | P,B,M,C |
| 334. `15m/n12/m4/into/L/Z` | 144 / 31 | +3,582 / +2,712 | +1,176 / +767 | +278 | -6,392 | B,M / keep |
| 335. `240m/n1/m4/into/L/F` | 65 / 14 | +3,495 / +1,815 | -569 / -1,121 | +191 | -6,251 | P,B,M,C |
| 336. `5m/n5/m1/momentum/S/F` | 574 / 132 | -22,168 / -17,479 | -7,623 / -7,082 | +115 | -1,548 | P,M,C |
| 337. `240m/n5/m4/back_out/L/F` | 146 / 27 | +3,268 / +3,001 | +655 / +183 | -37 | -4,119 | B,M,C |
| 338. `240m/n1/m4/back_out/L/F` | 65 / 14 | +3,191 / +2,356 | +32 / -310 | -114 | -5,420 | P,B,M,C |
| 339. `60m/n12/m2/into/L/Z` | 354 / 79 | +3,178 / +2,823 | +1,921 / +1,921 | -127 | -6,190 | B,M,C |
| 340. `5m/n1/m1/momentum/L/F` | 238 / 53 | +3,153 / +4,342 | +75 / +312 | -152 | -3,606 | B,M,C |
| 341. `30m/n1/m2/into/L/Z` | 180 / 40 | +3,102 / +1,149 | +545 / +101 | -203 | -6,043 | B,M,C |
| 342. `240m/n12/m1/momentum/L/F` | 164 / 45 | +3,088 / +2,143 | +2,143 / +1,033 | -216 | -4,568 | B,M / keep |
| 343. `15m/n12/m1/back_out/S/F` | 609 / 148 | -22,560 / -23,034 | -9,752 / -9,270 | -278 | -1,655 | P,B,M,C |
| 344. `60m/n5/m1/back_out/L/F` | 496 / 121 | +2,915 / +798 | +968 / +373 | -390 | -4,970 | B,M,C |
| 345. `15m/n12/m2/back_out/L/F` | 392 / 88 | +2,889 / +2,129 | +4,976 / +4,422 | -415 | -3,113 | B,M,C |
| 346. `240m/n5/m4/back_out/L/Z` | 147 / 27 | +2,889 / +2,510 | +1,461 / +753 | -416 | -5,260 | B,M / keep |
| 347. `15m/n5/m2/back_out/L/F` | 316 / 74 | +2,855 / +3,048 | +2,572 / +2,698 | -449 | -5,375 | B,M,C |
| 348. `240m/n12/m1/back_out/L/F` | 147 / 35 | +2,786 / +4,010 | +1,645 / +1,909 | -519 | -3,886 | B,M / keep |
| 349. `5m/n12/m1/momentum/S/F` | 646 / 148 | -22,862 / -22,761 | -6,071 / -6,126 | -579 | -1,795 | P,B,M,C |
| 350. `15m/n5/m4/into/L/Z` | 63 / 13 | +2,690 / +1,971 | +339 / -34 | -615 | -5,939 | P,B,M,C |
| 351. `5m/n12/m1/back_out/S/Z` | 2295 / 548 | -22,905 / -22,814 | -5,077 / -5,762 | -623 | -2,824 | P,B,M,C |
| 352. `15m/n5/m2/momentum/L/F` | 326 / 76 | +2,636 / +3,716 | +1,946 / +2,127 | -668 | -2,620 | B,M,C |
| 353. `15m/n12/m2/back_out/L/Z` | 611 / 133 | +2,616 / +2,220 | +1,157 / +1,402 | -689 | -5,610 | B,M,C |
| 354. `15m/n12/m1/into/L/F` | 594 / 138 | +2,616 / +1,122 | -203 / +30 | -689 | -3,481 | P,B,M,C |
| 355. `240m/n5/m4/momentum/L/Z` | 144 / 32 | +2,599 / +3,908 | +6,161 / +6,476 | -705 | -2,875 | B,M / keep |
| 356. `240m/n5/m1/momentum/L/Z` | 237 / 67 | +2,445 / +2,575 | +3,585 / +3,358 | -859 | -3,301 | B,M / keep |
| 357. `15m/n1/m2/into/L/F` | 67 / 17 | +2,377 / +2,982 | -1,230 / -1,088 | -928 | -6,819 | P,B,M,C |
| 358. `15m/n5/m4/back_out/L/F` | 48 / 11 | +2,374 / +2,231 | -1,664 / -1,805 | -931 | -6,642 | P,B,M,C |
| 359. `30m/n5/m2/momentum/L/F` | 358 / 83 | +2,308 / +293 | +3,380 / +2,607 | -996 | -3,581 | B,M,C |
| 360. `30m/n12/m2/into/L/Z` | 452 / 102 | +2,279 / +858 | +2,201 / +1,576 | -1,026 | -5,993 | B,M,C |
| 361. `5m/n1/m4/momentum/L/F` | 6 / 1 | +2,263 / +2,620 | +612 / +443 | -1,041 | -5,789 | N,B,M |
| 362. `240m/n5/m2/momentum/L/Z` | 204 / 54 | +2,226 / +2,886 | +2,826 / +2,922 | -1,078 | -2,778 | B,M / keep |
| 363. `240m/n12/m4/into/L/Z` | 128 / 24 | +2,187 / +2,959 | -156 / -552 | -1,117 | -4,686 | P,B,M,C |
| 364. `15m/n1/m0/momentum/S/F` | 826 / 210 | -23,417 / -17,481 | -7,875 / -9,011 | -1,135 | -1,549 | P,B,M,C |
| 365. `60m/n12/m1/into/L/Z` | 468 / 103 | +2,127 / +1,581 | +620 / +248 | -1,177 | -6,376 | B,M,C |
| 366. `5m/n5/m4/into/L/F` | 17 / 2 | +2,096 / +1,021 | +624 / +664 | -1,209 | -5,668 | N,B,M |
| 367. `5m/n5/m0/momentum/S/F` | 825 / 210 | -23,493 / -23,022 | -10,992 / -10,297 | -1,210 | -973 | P,B,M,C |
| 368. `60m/n12/m2/into/L/F` | 325 / 73 | +2,063 / +1,305 | +3,461 / +3,397 | -1,242 | -4,486 | B,M,C |
| 369. `60m/n1/m2/into/L/Z` | 244 / 58 | +2,060 / +1,370 | +923 / +484 | -1,245 | -5,363 | B,M,C |
| 370. `60m/n1/m1/into/L/F` | 486 / 109 | +2,026 / +3,343 | +2,831 / +4,837 | -1,278 | -4,155 | B,M,C |
| 371. `240m/n12/m2/momentum/L/F` | 141 / 32 | +2,013 / +1,809 | +2,369 / +2,314 | -1,291 | -4,464 | B,M / keep |
| 372. `15m/n1/m4/back_out/L/F` | 2 / 1 | +2,012 / +1,642 | +369 / +295 | -1,293 | -5,789 | N,B,M |
| 373. `5m/n5/m4/into/L/Z` | 20 / 2 | +1,852 / +1,263 | +191 / +311 | -1,453 | -5,783 | N,B,M |
| 374. `15m/n12/m4/into/L/F` | 118 / 25 | +1,808 / +991 | +834 / +211 | -1,497 | -6,735 | B,M,C |
| 375. `5m/n12/m1/momentum/L/F` | 651 / 158 | +1,794 / +2,548 | +3,836 / +4,437 | -1,510 | -2,649 | B,M,C |
| 376. `60m/n5/m1/into/L/F` | 505 / 120 | +1,714 / -2,337 | +2,557 / +1,881 | -1,590 | -3,575 | P,B,M,C |
| 377. `30m/n5/m4/momentum/L/F` | 103 / 24 | +1,704 / +1,445 | +697 / +716 | -1,600 | -5,696 | B,M / keep |
| 378. `240m/n1/m1/into/L/F` | 414 / 99 | +1,680 / -855 | +4,602 / +3,573 | -1,624 | -3,745 | P,B,M,C |
| 379. `15m/n1/m2/back_out/L/Z` | 102 / 27 | +1,647 / +1,078 | -211 / -31 | -1,658 | -6,200 | P,B,M,C |
| 380. `15m/n5/m2/into/L/Z` | 563 / 124 | +1,622 / -781 | +98 / -830 | -1,683 | -5,215 | P,B,M,C |
| 381. `30m/n5/m4/back_out/L/Z` | 112 / 22 | +1,577 / +765 | -240 / -636 | -1,728 | -5,829 | P,B,M,C |
| 382. `60m/n5/m4/back_out/L/Z` | 124 / 25 | +1,576 / +858 | +654 / +410 | -1,728 | -5,927 | B,M,C |
| 383. `5m/n1/m2/into/L/Z` | 29 / 6 | +1,559 / +2,377 | +390 / +767 | -1,745 | -5,887 | N,B,M |
| 384. `5m/n1/m2/into/L/F` | 18 / 5 | +1,500 / +1,417 | +36 / +479 | -1,804 | -5,744 | N,B,M,C |
| 385. `30m/n12/m4/back_out/L/Z` | 169 / 38 | +1,490 / +1,323 | -28 / -150 | -1,814 | -5,904 | P,B,M,C |
| 386. `240m/n5/m2/back_out/L/F` | 208 / 47 | +1,473 / +1,427 | -152 / +120 | -1,832 | -3,854 | P,B,M,C |
| 387. `60m/n1/m4/into/L/F` | 15 / 3 | +1,412 / +1,497 | +1,347 / +1,187 | -1,892 | -5,697 | N,B,M |
| 388. `15m/n12/m2/into/L/F` | 392 / 89 | +1,409 / +1,364 | +3,315 / +4,002 | -1,896 | -3,488 | B,M,C |
| 389. `60m/n5/m4/momentum/L/F` | 138 / 31 | +1,403 / +2,304 | +1,167 / +1,403 | -1,901 | -5,059 | B,M / keep |
| 390. `5m/n1/m4/into/L/F` | 4 / 1 | +1,345 / +2,158 | -12 / +710 | -1,960 | -5,789 | N,P,B,M,C |
| 391. `30m/n1/m2/back_out/L/F` | 116 / 26 | +1,324 / +2,662 | -1,291 / -1,528 | -1,980 | -6,311 | P,B,M,C |
| 392. `15m/n1/m4/back_out/L/Z` | 4 / 1 | +1,306 / +1,108 | -2 / 0 | -1,998 | -5,789 | N,P,B,M,C |
| 393. `15m/n5/m2/into/L/F` | 318 / 74 | +1,302 / +567 | +2,904 / +2,209 | -2,002 | -5,788 | B,M,C |
| 394. `15m/n5/m0/momentum/L/F` | 761 / 193 | +1,270 / +427 | +3,427 / +4,957 | -2,034 | -2,495 | B,M,C |
| 395. `240m/n12/m2/back_out/L/F` | 139 / 32 | +1,245 / +3,318 | +1,697 / +1,801 | -2,060 | -4,791 | B,M,C |
| 396. `60m/n1/m4/into/L/Z` | 17 / 3 | +1,242 / +1,205 | +761 / +647 | -2,062 | -5,749 | N,B,M |
| 397. `30m/n12/m4/into/L/F` | 155 / 35 | +1,132 / +542 | +411 / -380 | -2,172 | -5,358 | P,B,M,C |
| 398. `5m/n1/m4/back_out/L/F` | 4 / 1 | +1,120 / +1,260 | -40 / -15 | -2,184 | -5,789 | N,P,B,M,C |
| 399. `240m/n5/m2/into/L/F` | 206 / 43 | +1,107 / +1,897 | +980 / +1,671 | -2,197 | -5,765 | B,M,C |
| 400. `15m/n1/m2/into/L/Z` | 101 / 27 | +1,074 / +1,463 | +827 / +844 | -2,231 | -5,869 | B,M / keep |
| 401. `60m/n5/m4/into/L/Z` | 122 / 24 | +1,057 / +451 | +1,746 / +1,389 | -2,248 | -6,040 | B,M,C |
| 402. `240m/n12/m1/back_out/L/Z` | 157 / 38 | +1,049 / +300 | +1,515 / +1,111 | -2,256 | -5,307 | B,M,C |
| 403. `30m/n1/m2/into/L/F` | 116 / 26 | +1,042 / +2,894 | -883 / -1,312 | -2,262 | -6,386 | P,B,M,C |
| 404. `30m/n5/m2/into/L/Z` | 508 / 109 | +1,002 / -1,824 | +1,310 / +696 | -2,303 | -4,892 | P,B,M,C |
| 405. `30m/n5/m1/into/L/F` | 568 / 133 | +939 / +3,224 | +2,021 / +2,231 | -2,365 | -3,519 | B,M,C |
| 406. `5m/n1/m2/back_out/L/F` | 19 / 5 | +934 / +232 | -313 / -295 | -2,370 | -5,668 | N,P,B,M,C |
| 407. `30m/n1/m4/into/L/F` | 5 / 1 | +921 / +1,193 | +738 / +523 | -2,383 | -5,697 | N,B,M |
| 408. `15m/n12/m1/back_out/L/Z` | 1304 / 288 | +918 / +1,838 | -90 / +41 | -2,387 | -5,326 | P,B,M,C |
| 409. `60m/n1/m2/back_out/L/Z` | 237 / 56 | +910 / +586 | -1,124 / -747 | -2,395 | -6,047 | P,B,M,C |
| 410. `240m/n5/m2/into/L/Z` | 209 / 44 | +858 / +979 | +852 / +1,018 | -2,446 | -6,108 | B,M,C |
| 411. `30m/n1/m2/back_out/L/Z` | 182 / 40 | +850 / +660 | +493 / +208 | -2,454 | -5,775 | B,M,C |
| 412. `240m/n12/m0/momentum/L/F` | 173 / 47 | +841 / +798 | +980 / +740 | -2,464 | -3,718 | B,M,C |
| 413. `5m/n5/m1/momentum/L/F` | 565 / 136 | +825 / -304 | +4,237 / +3,453 | -2,479 | -1,797 | P,B,M,C |
| 414. `30m/n1/m4/back_out/L/F` | 5 / 1 | +817 / +1,122 | +279 / +298 | -2,488 | -5,811 | N,B,M |
| 415. `5m/n12/m4/back_out/L/F` | 49 / 12 | +803 / +461 | -1,015 / -1,211 | -2,502 | -5,934 | P,B,M,C |
| 416. `60m/n5/m2/into/L/Z` | 404 / 88 | +797 / -749 | +1,954 / +1,341 | -2,508 | -6,413 | P,B,M,C |
| 417. `5m/n5/m4/back_out/L/Z` | 22 / 2 | +764 / +17 | +152 / +328 | -2,540 | -5,760 | N,B,M,C |
| 418. `30m/n1/m4/into/L/Z` | 6 / 1 | +718 / +711 | +221 / +53 | -2,587 | -5,773 | N,B,M |
| 419. `240m/n12/m4/into/L/F` | 128 / 24 | +710 / +1,848 | -535 / -1,053 | -2,594 | -4,687 | P,B,M,C |
| 420. `15m/n1/m0/momentum/L/F` | 828 / 212 | +707 / -3,959 | +4,552 / +1,678 | -2,598 | -1,738 | P,B,M,C |
| 421. `15m/n12/m2/momentum/L/F` | 400 / 95 | +667 / +32 | +3,728 / +4,232 | -2,637 | -4,372 | B,M,C |
| 422. `5m/n5/m4/back_out/L/F` | 16 / 2 | +660 / +759 | +627 / +665 | -2,645 | -5,626 | N,B,M |
| 423. `15m/n12/m1/momentum/L/F` | 609 / 148 | +630 / +2,703 | +5,817 / +5,742 | -2,675 | -1,936 | B,M,C |
| 424. `240m/n12/m1/momentum/L/Z` | 169 / 46 | +622 / +306 | +890 / +792 | -2,683 | -4,565 | B,M,C |
| 425. `5m/n12/m4/back_out/L/Z` | 65 / 14 | +532 / +52 | +537 / +350 | -2,772 | -5,855 | B,M,C |
| 426. `15m/n1/m4/momentum/L/F` | 8 / 1 | +530 / -18 | +612 / +443 | -2,775 | -5,789 | N,P,B,M,C |
| 427. `60m/n1/m4/back_out/L/F` | 15 / 3 | +521 / +504 | +149 / +3 | -2,784 | -5,773 | N,B,M,C |
| 428. `240m/n12/m2/momentum/L/Z` | 141 / 32 | +520 / +497 | +1,386 / +1,322 | -2,785 | -4,574 | B,M,C |
| 429. `15m/n12/m4/back_out/L/Z` | 146 / 31 | +508 / +684 | +308 / +428 | -2,797 | -6,563 | B,M,C |
| 430. `15m/n1/m4/into/L/F` | 2 / 1 | +505 / +370 | +738 / +523 | -2,799 | -5,789 | N,B,M |
| 431. `240m/n12/m0/momentum/L/Z` | 189 / 52 | +504 / +346 | +992 / +877 | -2,800 | -4,447 | B,M,C |
| 432. `15m/n1/m1/momentum/L/F` | 377 / 92 | +485 / -57 | +316 / -446 | -2,820 | -3,759 | P,B,M,C |
| 433. `15m/n1/m2/momentum/L/F` | 75 / 20 | +438 / -133 | -1,440 / -1,673 | -2,866 | -4,507 | P,B,M,C |
| 434. `5m/n5/m0/momentum/L/F` | 826 / 211 | +397 / +4,247 | +3,285 / +4,077 | -2,908 | -1,190 | B,M,C |
| 435. `5m/n1/m4/momentum/L/Z` | 7 / 1 | +378 / +736 | +254 / +170 | -2,927 | -5,789 | N,B,M |
| 436. `15m/n5/m1/into/L/Z` | 1650 / 374 | +373 / -3,805 | +509 / -161 | -2,931 | -5,224 | P,B,M,C |
| 437. `5m/n1/m4/back_out/L/Z` | 4 / 1 | +342 / +882 | -10 / +109 | -2,962 | -5,789 | N,P,B,M,C |
| 438. `15m/n5/m1/back_out/S/F` | 618 / 150 | -25,279 / -27,062 | -10,588 / -11,788 | -2,997 | -2,562 | P,B,M,C |
| 439. `5m/n1/m1/into/L/Z` | 630 / 132 | +287 / -1,993 | -735 / -513 | -3,017 | -5,906 | P,B,M,C |
| 440. `240m/n1/m2/back_out/L/Z` | 257 / 52 | +280 / -3,167 | -160 / +251 | -3,024 | -6,511 | P,B,M,C |
| 441. `5m/n1/m4/into/L/Z` | 4 / 1 | +259 / +1,006 | +9 / +714 | -3,045 | -5,789 | N,B,M,C |
| 442. `240m/n5/m2/momentum/L/F` | 203 / 53 | +210 / +1,890 | +1,770 / +1,874 | -3,095 | -2,958 | B,M,C |
| 443. `15m/n5/m4/back_out/L/Z` | 64 / 14 | +187 / -601 | -298 / -512 | -3,118 | -6,100 | P,B,M,C |
| 444. `15m/n1/m4/into/L/Z` | 4 / 1 | +184 / +288 | +213 / +42 | -3,120 | -5,789 | N,B,M |
| 445. `15m/n5/m4/momentum/L/F` | 69 / 16 | +168 / -883 | -1,733 / -1,594 | -3,136 | -5,597 | P,B,M,C |
| 446. `60m/n1/m4/back_out/L/Z` | 17 / 3 | +126 / +201 | +18 / +17 | -3,179 | -5,737 | N,B,M,C |
| 447. `30m/n1/m1/momentum/L/F` | 448 / 106 | +98 / +2,239 | +3,047 / +5,133 | -3,206 | -2,795 | B,M,C |
| 448. `60m/n1/m1/into/L/Z` | 987 / 228 | +4 / -2,141 | +2,392 / +2,046 | -3,300 | -5,675 | P,B,M,C |
| 449. `5m/n5/m4/momentum/L/Z` | 36 / 5 | -12 / +588 | +44 / +67 | -3,316 | -5,849 | N,P,B,M,C |
| 450. `240m/n1/m4/momentum/L/F` | 70 / 15 | -64 / +650 | -1,007 / -804 | -3,368 | -7,147 | P,B,M,C |
| 451. `30m/n12/m0/momentum/L/F` | 569 / 143 | -72 / -271 | +2,976 / +3,189 | -3,376 | -2,639 | P,B,M,C |
| 452. `60m/n12/m4/into/L/F` | 170 / 38 | -137 / +936 | +1,543 / +1,659 | -3,441 | -5,000 | P,B,M,C |
| 453. `30m/n1/m4/back_out/L/Z` | 6 / 1 | -139 / +335 | +87 / +87 | -3,444 | -5,775 | N,P,B,M,C |
| 454. `30m/n5/m1/back_out/L/F` | 570 / 130 | -202 / -1,195 | +3,881 / +4,254 | -3,507 | -3,224 | P,B,M,C |
| 455. `5m/n12/m2/momentum/L/F` | 337 / 76 | -231 / -574 | +4,255 / +3,768 | -3,536 | -3,209 | P,B,M,C |
| 456. `5m/n1/m2/momentum/L/Z` | 54 / 7 | -232 / -124 | +138 / -231 | -3,536 | -6,079 | N,P,B,M,C |
| 457. `30m/n12/m1/into/L/Z` | 766 / 174 | -255 / -2,704 | +717 / -80 | -3,560 | -6,594 | P,B,M,C |
| 458. `15m/n5/m1/back_out/L/F` | 606 / 140 | -261 / -5,073 | +763 / -214 | -3,565 | -3,348 | P,B,M,C |
| 459. `15m/n12/m4/momentum/L/F` | 138 / 31 | -294 / +737 | -352 / +25 | -3,598 | -5,096 | P,B,M,C |
| 460. `240m/n12/m4/back_out/L/F` | 128 / 23 | -295 / -674 | +1,818 / +1,735 | -3,599 | -4,544 | P,B,M,C |
| 461. `240m/n1/m2/into/L/Z` | 253 / 53 | -334 / -1,880 | +1,910 / +1,236 | -3,639 | -6,595 | P,B,M,C |
| 462. `5m/n1/m2/back_out/L/Z` | 28 / 6 | -349 / -1,579 | +162 / +178 | -3,653 | -5,809 | N,P,B,M,C |
| 463. `240m/n5/m1/momentum/L/F` | 231 / 66 | -421 / -166 | +523 / +284 | -3,726 | -3,871 | P,B,M,C |
| 464. `60m/n12/m1/back_out/L/Z` | 508 / 116 | -434 / -1,418 | -48 / -1,077 | -3,739 | -5,320 | P,B,M,C |
| 465. `15m/n1/m4/momentum/L/Z` | 8 / 1 | -473 / -1,088 | +148 / -56 | -3,777 | -5,789 | N,P,B,M,C |
| 466. `5m/n5/m2/back_out/L/Z` | 383 / 86 | -489 / -746 | -360 / -713 | -3,794 | -6,445 | P,B,M,C |
| 467. `30m/n1/m0/momentum/S/F` | 800 / 205 | -26,154 / -18,732 | -11,096 / -8,834 | -3,872 | -1,173 | P,B,M,C |
| 468. `240m/n1/m4/momentum/L/Z` | 73 / 15 | -626 / -31 | -214 / -155 | -3,931 | -7,080 | P,B,M,C |
| 469. `30m/n5/m1/momentum/L/F` | 586 / 140 | -637 / -3,190 | +2,259 / +4,721 | -3,942 | -2,756 | P,B,M,C |
| 470. `5m/n5/m4/momentum/L/F` | 29 / 5 | -655 / -184 | -588 / -678 | -3,960 | -6,326 | N,P,B,M,C |
| 471. `240m/n5/m0/momentum/L/F` | 239 / 63 | -661 / +1,282 | -1,245 / -546 | -3,966 | -4,086 | P,B,M,C |
| 472. `240m/n5/m1/into/L/F` | 230 / 56 | -693 / -1,467 | +120 / -53 | -3,998 | -6,330 | P,B,M,C |
| 473. `60m/n5/m4/back_out/L/F` | 112 / 23 | -848 / -1,433 | -30 / -280 | -4,152 | -6,174 | P,B,M,C |
| 474. `30m/n12/m1/back_out/L/Z` | 835 / 194 | -887 / -2,299 | -1,158 / -1,575 | -4,192 | -7,167 | P,B,M,C |
| 475. `5m/n12/m4/momentum/L/F` | 73 / 17 | -1,210 / +174 | -1,488 / -1,174 | -4,514 | -6,454 | P,B,M,C |
| 476. `240m/n12/m2/into/L/F` | 135 / 32 | -1,211 / -1,122 | +1,508 / +1,170 | -4,516 | -5,484 | P,B,M,C |
| 477. `15m/n1/m1/back_out/L/F` | 392 / 92 | -1,235 / -943 | +2,678 / +2,690 | -4,540 | -4,290 | P,B,M,C |
| 478. `240m/n12/m4/momentum/L/F` | 121 / 35 | -1,320 / -290 | -309 / +423 | -4,624 | -5,040 | P,B,M,C |
| 479. `30m/n1/m4/momentum/L/Z` | 15 / 2 | -1,328 / -952 | -14 / +19 | -4,633 | -5,789 | N,P,B,M,C |
| 480. `60m/n5/m1/back_out/L/Z` | 737 / 174 | -1,380 / -2,390 | -1,366 / -1,859 | -4,685 | -7,031 | P,B,M,C |
| 481. `240m/n12/m4/momentum/L/Z` | 121 / 35 | -1,510 / -958 | -754 / -105 | -4,814 | -5,040 | P,B,M,C |
| 482. `15m/n12/m4/momentum/L/Z` | 161 / 35 | -1,560 / -501 | +1,318 / +1,504 | -4,864 | -4,840 | P,B,M,C |
| 483. `240m/n1/m2/momentum/L/F` | 245 / 61 | -1,608 / +3,246 | +1,934 / +1,110 | -4,913 | -5,736 | P,B,M,C |
| 484. `60m/n5/m4/into/L/F` | 114 / 23 | -1,692 / -2,332 | +920 / +650 | -4,997 | -6,252 | P,B,M,C |
| 485. `15m/n12/m4/back_out/L/F` | 119 / 24 | -1,717 / -1,396 | -937 / -931 | -5,022 | -6,995 | P,B,M,C |
| 486. `240m/n12/m4/back_out/L/Z` | 130 / 25 | -1,757 / -2,429 | +1,194 / +1,067 | -5,062 | -4,403 | P,B,M,C |
| 487. `15m/n1/m1/into/L/F` | 392 / 92 | -1,838 / +172 | +3,152 / +2,951 | -5,142 | -3,572 | P,B,M,C |
| 488. `240m/n12/m2/into/L/Z` | 137 / 32 | -1,896 / -2,259 | +82 / -319 | -5,200 | -5,386 | P,B,M,C |
| 489. `30m/n12/m2/back_out/L/F` | 377 / 90 | -2,041 / -1,830 | +4,477 / +4,929 | -5,345 | -4,021 | P,B,M,C |
| 490. `240m/n5/m1/into/L/Z` | 244 / 60 | -2,160 / -1,658 | -759 / -676 | -5,465 | -7,224 | P,B,M,C |
| 491. `240m/n5/m1/back_out/L/F` | 243 / 60 | -2,164 / -664 | +1,542 / +2,001 | -5,468 | -4,260 | P,B,M,C |
| 492. `30m/n12/m4/back_out/L/F` | 153 / 35 | -2,190 / -3,072 | +57 / -389 | -5,494 | -4,650 | P,B,M,C |
| 493. `60m/n12/m2/momentum/L/F` | 325 / 78 | -2,296 / -1,898 | +2,516 / +4,042 | -5,600 | -3,693 | P,B,M,C |
| 494. `5m/n12/m2/back_out/L/Z` | 690 / 161 | -2,323 / -2,287 | -591 / -140 | -5,627 | -6,345 | P,B,M,C |
| 495. `30m/n12/m2/back_out/L/Z` | 468 / 107 | -2,342 / -3,979 | +30 / -297 | -5,647 | -5,965 | P,B,M,C |
| 496. `60m/n5/m4/momentum/L/Z` | 148 / 33 | -2,358 / -2,104 | +940 / +980 | -5,662 | -4,664 | P,B,M,C |
| 497. `60m/n12/m4/back_out/L/F` | 165 / 37 | -2,420 / -2,255 | -447 / -342 | -5,725 | -4,730 | P,B,M,C |
| 498. `240m/n1/m1/back_out/L/Z` | 470 / 112 | -2,495 / +908 | -737 / +415 | -5,800 | -4,216 | P,B,M,C |
| 499. `30m/n1/m4/momentum/L/F` | 13 / 2 | -2,539 / -2,138 | +278 / +314 | -5,843 | -5,789 | N,P,B,M,C |
| 500. `240m/n12/m2/back_out/L/Z` | 140 / 33 | -2,565 / -977 | +5 / -64 | -5,869 | -5,567 | P,B,M,C |
| 501. `60m/n1/m4/momentum/L/Z` | 23 / 3 | -2,613 / -2,481 | +103 / +146 | -5,918 | -5,789 | N,P,B,M,C |
| 502. `30m/n5/m4/momentum/L/Z` | 124 / 29 | -2,614 / -2,393 | -296 / -264 | -5,919 | -5,063 | P,B,M,C |
| 503. `60m/n12/m4/momentum/L/F` | 182 / 47 | -2,705 / -932 | -741 / +1,125 | -6,009 | -4,411 | P,B,M,C |
| 504. `30m/n1/m0/momentum/L/F` | 801 / 204 | -2,734 / +5,573 | +2,906 / +3,062 | -6,039 | -1,456 | P,B,M,C |
| 505. `240m/n1/m2/into/L/F` | 239 / 50 | -2,946 / -6,226 | +2,734 / +1,982 | -6,251 | -5,996 | P,B,M,C |
| 506. `60m/n5/m0/momentum/L/F` | 562 / 142 | -3,002 / +2,034 | +619 / +3,813 | -6,307 | -2,319 | P,B,M,C |
| 507. `60m/n5/m1/into/L/Z` | 689 / 161 | -3,025 / -4,357 | +1,737 / +1,042 | -6,330 | -5,764 | P,B,M,C |
| 508. `60m/n5/m2/back_out/L/F` | 338 / 72 | -3,092 / -2,673 | +3,344 / +3,283 | -6,397 | -4,809 | P,B,M,C |
| 509. `5m/n1/m1/back_out/L/Z` | 634 / 134 | -3,122 / -6,324 | -403 / -859 | -6,427 | -6,013 | P,B,M,C |
| 510. `60m/n5/m2/back_out/L/Z` | 417 / 87 | -3,193 / -3,805 | -312 / -542 | -6,498 | -6,228 | P,B,M,C |
| 511. `30m/n5/m0/momentum/L/F` | 692 / 171 | -3,206 / -6,404 | +1,536 / +1,204 | -6,511 | -2,903 | P,B,M,C |
| 512. `15m/n5/m4/momentum/L/Z` | 83 / 18 | -3,223 / -2,542 | -319 / -407 | -6,528 | -5,153 | P,B,M,C |
| 513. `240m/n1/m2/momentum/L/Z` | 266 / 64 | -3,254 / -2,178 | +635 / +3 | -6,559 | -6,152 | P,B,M,C |
| 514. `60m/n1/m4/momentum/L/F` | 23 / 3 | -3,278 / -3,471 | +363 / +340 | -6,582 | -5,789 | N,P,B,M,C |
| 515. `30m/n5/m2/back_out/L/Z` | 521 / 108 | -3,584 / -4,417 | -829 / -862 | -6,888 | -6,244 | P,B,M,C |
| 516. `60m/n12/m0/momentum/L/F` | 412 / 101 | -3,683 / -3,892 | +4,436 / +4,573 | -6,988 | -3,843 | P,B,M,C |
| 517. `15m/n5/m2/back_out/L/Z` | 566 / 126 | -3,767 / -5,032 | -1,264 / -1,697 | -7,072 | -5,456 | P,B,M,C |
| 518. `15m/n1/m2/momentum/L/Z` | 129 / 27 | -4,038 / -3,906 | -320 / -593 | -7,342 | -5,671 | P,B,M,C |
| 519. `60m/n1/m2/momentum/L/F` | 188 / 44 | -4,184 / -3,784 | -756 / -819 | -7,488 | -3,649 | P,B,M,C |
| 520. `30m/n12/m4/momentum/L/Z` | 191 / 51 | -4,362 / -3,958 | -487 / -476 | -7,667 | -4,147 | P,B,M,C |
| 521. `240m/n5/m1/back_out/L/Z` | 252 / 61 | -4,434 / -3,905 | +583 / +507 | -7,738 | -6,254 | P,B,M,C |
| 522. `30m/n1/m1/into/L/Z` | 1157 / 253 | -4,456 / -8,682 | -950 / -1,745 | -7,761 | -7,072 | P,B,M,C |
| 523. `30m/n1/m2/momentum/L/Z` | 202 / 49 | -4,651 / -3,284 | -300 / +9 | -7,955 | -5,625 | P,B,M,C |
| 524. `60m/n12/m2/back_out/L/Z` | 378 / 83 | -4,780 / -4,919 | +694 / -106 | -8,084 | -5,255 | P,B,M,C |
| 525. `240m/n5/m2/back_out/L/Z` | 215 / 47 | -4,927 / -3,240 | -1,661 / -1,524 | -8,231 | -6,414 | P,B,M,C |
| 526. `60m/n12/m1/back_out/L/F` | 376 / 89 | -4,967 / -3,617 | +2,971 / +3,722 | -8,271 | -4,046 | P,B,M,C |
| 527. `60m/n1/m0/momentum/L/F` | 744 / 189 | -5,242 / +311 | +1,825 / +1,082 | -8,546 | -2,376 | P,B,M,C |
| 528. `5m/n12/m4/momentum/L/Z` | 95 / 20 | -5,250 / -3,838 | -1,273 / -850 | -8,554 | -5,665 | P,B,M,C |
| 529. `60m/n12/m4/momentum/L/Z` | 186 / 47 | -5,447 / -4,766 | -663 / -2 | -8,752 | -4,449 | P,B,M,C |
| 530. `240m/n1/m2/back_out/L/F` | 242 / 49 | -5,600 / -8,690 | -1,563 / -2,486 | -8,904 | -6,744 | P,B,M,C |
| 531. `30m/n12/m4/momentum/L/F` | 181 / 48 | -5,781 / -7,237 | -2,932 / -3,116 | -9,086 | -4,131 | P,B,M,C |
| 532. `60m/n1/m1/back_out/L/Z` | 974 / 221 | -5,833 / -5,405 | -3,008 / -2,863 | -9,138 | -5,726 | P,B,M,C |
| 533. `30m/n12/m2/momentum/L/F` | 393 / 92 | -6,267 / -4,786 | +906 / +540 | -9,572 | -2,734 | P,B,M,C |
| 534. `15m/n1/m1/back_out/L/Z` | 1095 / 253 | -6,500 / -6,719 | -1,394 / -590 | -9,805 | -6,154 | P,B,M,C |
| 535. `30m/n1/m1/back_out/L/Z` | 1160 / 259 | -6,731 / -6,896 | -914 / -801 | -10,036 | -6,677 | P,B,M,C |
| 536. `60m/n1/m2/momentum/L/Z` | 273 / 64 | -6,850 / -5,587 | -887 / -625 | -10,155 | -5,126 | P,B,M,C |
| 537. `60m/n5/m1/momentum/L/Z` | 713 / 169 | -6,860 / -4,957 | +1,081 / +1,673 | -10,164 | -3,430 | P,B,M,C |
| 538. `30m/n5/m2/momentum/L/Z` | 537 / 128 | -6,905 / -3,736 | -935 / -247 | -10,209 | -5,761 | P,B,M,C |
| 539. `60m/n12/m2/momentum/L/Z` | 367 / 85 | -7,209 / -5,994 | +1,476 / +2,028 | -10,514 | -5,416 | P,B,M,C |
| 540. `30m/n12/m1/momentum/L/F` | 516 / 124 | -7,294 / -8,128 | -638 / -699 | -10,598 | -2,652 | P,B,M,C |
| 541. `60m/n12/m0/momentum/L/Z` | 691 / 158 | -7,478 / -6,549 | +2,285 / +2,702 | -10,783 | -3,325 | P,B,M,C |
| 542. `5m/n1/m1/momentum/L/Z` | 661 / 135 | -7,848 / -7,453 | -885 / -853 | -11,152 | -6,512 | P,B,M,C |
| 543. `30m/n5/m1/back_out/L/Z` | 1210 / 274 | -8,065 / -6,704 | -3,399 / -2,573 | -11,369 | -6,318 | P,B,M,C |
| 544. `60m/n5/m1/momentum/L/F` | 515 / 127 | -8,174 / -9,097 | +709 / +303 | -11,478 | -3,166 | P,B,M,C |
| 545. `5m/n5/m1/momentum/S/Z` | 2277 / 503 | -33,845 / -32,691 | -8,519 / -7,416 | -11,562 | -4,342 | P,B,M,C,E |
| 546. `60m/n5/m2/momentum/L/Z` | 440 / 97 | -8,397 / -7,972 | +1,706 / +1,129 | -11,702 | -4,083 | P,B,M,C |
| 547. `240m/n1/m0/momentum/L/F` | 538 / 138 | -8,443 / -11,493 | -564 / -1,621 | -11,748 | -3,588 | P,B,M,C |
| 548. `30m/n12/m2/momentum/L/Z` | 491 / 108 | -8,600 / -7,622 | +1,692 / +1,884 | -11,905 | -3,606 | P,B,M,C |
| 549. `60m/n5/m0/momentum/L/Z` | 1095 / 269 | -8,706 / -6,801 | +690 / +1,217 | -12,010 | -2,906 | P,B,M,C |
| 550. `15m/n1/m1/into/L/Z` | 1084 / 255 | -9,024 / -11,074 | +187 / -464 | -12,329 | -5,766 | P,B,M,C |
| 551. `60m/n12/m1/momentum/L/F` | 394 / 103 | -9,179 / -8,355 | +688 / +979 | -12,483 | -3,583 | P,B,M,C |
| 552. `30m/n5/m1/momentum/S/Z` | 1133 / 255 | -34,962 / -31,153 | -7,737 / -6,886 | -12,679 | -5,922 | P,B,M,C,E |
| 553. `15m/n12/m1/momentum/S/Z` | 1229 / 273 | -35,258 / -31,729 | -6,876 / -5,950 | -12,976 | -3,415 | P,B,M,C,E |
| 554. `5m/n12/m1/into/L/Z` | 2170 / 503 | -10,329 / -14,086 | -1,344 / -2,167 | -13,633 | -6,975 | P,B,M,C |
| 555. `5m/n5/m2/momentum/L/Z` | 417 / 105 | -10,554 / -8,020 | -1,833 / -1,011 | -13,858 | -6,407 | P,B,M,C |
| 556. `60m/n12/m1/momentum/L/Z` | 500 / 126 | -10,999 / -10,053 | -220 / +163 | -14,304 | -4,632 | P,B,M,C |
| 557. `15m/n5/m1/momentum/S/Z` | 1650 / 374 | -36,694 / -32,511 | -8,742 / -8,072 | -14,411 | -5,251 | P,B,M,C,E |
| 558. `240m/n1/m1/momentum/L/F` | 430 / 106 | -11,254 / -6,183 | -1,664 / -3,730 | -14,559 | -4,733 | P,B,M,C |
| 559. `15m/n12/m2/momentum/L/Z` | 616 / 144 | -11,505 / -8,740 | -96 / +270 | -14,810 | -4,345 | P,B,M,C |
| 560. `60m/n5/m2/momentum/L/F` | 366 / 84 | -11,624 / -11,410 | +2,710 / +2,070 | -14,929 | -5,735 | P,B,M,C |
| 561. `5m/n12/m1/momentum/S/Z` | 2170 / 503 | -37,426 / -33,665 | -9,726 / -8,903 | -15,144 | -6,183 | P,B,M,C,E |
| 562. `240m/n1/m1/back_out/L/F` | 418 / 101 | -11,994 / -12,957 | -3,006 / -4,017 | -15,299 | -4,395 | P,B,M,C |
| 563. `15m/n12/m0/momentum/L/F` | 701 / 173 | -12,014 / -7,194 | +2,440 / +3,031 | -15,319 | -2,624 | P,B,M,C |
| 564. `240m/n1/m1/momentum/L/Z` | 497 / 117 | -13,114 / -12,488 | -191 / -397 | -16,419 | -4,381 | P,B,M,C |
| 565. `30m/n12/m1/momentum/L/Z` | 779 / 178 | -13,260 / -11,349 | +1,294 / +1,760 | -16,564 | -2,878 | P,B,M,C |
| 566. `15m/n5/m1/back_out/L/Z` | 1747 / 389 | -13,671 / -14,025 | -4,241 / -3,981 | -16,976 | -5,890 | P,B,M,C |
| 567. `30m/n12/m0/momentum/L/Z` | 1394 / 351 | -14,055 / -11,887 | -769 / -162 | -17,360 | -3,533 | P,B,M,C |
| 568. `240m/n1/m0/momentum/L/Z` | 672 / 165 | -14,602 / -13,891 | +1,489 / +1,915 | -17,907 | -3,832 | P,B,M,C |
| 569. `60m/n12/m2/back_out/L/F` | 327 / 72 | -14,991 / -14,107 | -2,677 / -2,669 | -18,295 | -4,969 | P,B,M,C |
| 570. `15m/n5/m2/momentum/L/Z` | 593 / 142 | -15,081 / -13,338 | -3,674 / -3,536 | -18,386 | -4,852 | P,B,M,C |
| 571. `5m/n5/m1/into/L/Z` | 2277 / 503 | -16,259 / -17,412 | -2,551 / -3,652 | -19,563 | -6,947 | P,B,M,C |
| 572. `5m/n12/m2/momentum/L/Z` | 691 / 162 | -16,772 / -14,106 | -3,908 / -3,391 | -20,076 | -4,992 | P,B,M,C |
| 573. `15m/n1/m1/momentum/L/Z` | 1068 / 259 | -17,866 / -15,992 | -4,830 / -4,302 | -21,171 | -5,893 | P,B,M,C |
| 574. `30m/n5/m0/momentum/S/Z` | 2219 / 555 | -44,746 / -39,221 | -11,650 / -10,562 | -22,463 | -5,418 | P,B,M,C,E |
| 575. `30m/n1/m1/momentum/L/Z` | 1143 / 268 | -20,327 / -15,380 | -2,202 / -1,241 | -23,631 | -4,996 | P,B,M,C |
| 576. `5m/n5/m1/back_out/L/Z` | 2351 / 519 | -20,443 / -19,046 | -4,113 / -3,970 | -23,748 | -7,457 | P,B,M,C |
| 577. `5m/n12/m1/back_out/L/Z` | 2231 / 521 | -20,515 / -18,933 | -3,633 / -2,518 | -23,819 | -7,039 | P,B,M,C |
| 578. `30m/n5/m1/momentum/L/Z` | 1142 / 265 | -22,008 / -17,774 | -1,497 / -582 | -25,313 | -5,337 | P,B,M,C |
| 579. `60m/n1/m1/momentum/L/Z` | 1025 / 258 | -23,004 / -20,232 | -6,112 / -5,862 | -26,309 | -5,818 | P,B,M,C |
| 580. `60m/n1/m0/momentum/S/Z` | 2657 / 692 | -48,988 / -47,684 | -18,549 / -18,620 | -26,706 | -7,144 | P,B,M,C,E |
| 581. `15m/n12/m1/momentum/L/Z` | 1254 / 294 | -25,545 / -21,917 | -1,265 / -469 | -28,850 | -5,784 | P,B,M,C |
| 582. `15m/n5/m1/momentum/L/Z` | 1663 / 402 | -27,696 / -24,265 | -6,822 / -6,195 | -31,000 | -5,238 | P,B,M,C |
| 583. `15m/n12/m0/momentum/S/Z` | 2893 / 718 | -53,914 / -50,778 | -13,038 / -12,425 | -31,631 | -5,927 | P,B,M,C,E |
| 584. `30m/n5/m0/momentum/L/Z` | 2218 / 554 | -33,190 / -27,666 | -5,417 / -4,227 | -36,494 | -4,490 | P,B,M,C,E |
| 585. `5m/n12/m1/momentum/L/Z` | 2236 / 534 | -34,338 / -29,876 | -8,531 / -6,983 | -37,643 | -5,702 | P,B,M,C,E |
| 586. `5m/n5/m1/momentum/L/Z` | 2293 / 528 | -36,499 / -30,182 | -7,632 / -6,445 | -39,803 | -6,017 | P,B,M,C,E |
| 587. `60m/n1/m0/momentum/L/Z` | 2658 / 690 | -36,704 / -35,567 | -11,062 / -11,191 | -40,009 | -6,707 | P,B,M,C,E |
| 588. `15m/n5/m0/momentum/S/Z` | 4332 / 1150 | -64,936 / -60,278 | -23,024 / -20,835 | -42,653 | -6,722 | P,B,M,C,E |
| 589. `15m/n12/m0/momentum/L/Z` | 2895 / 721 | -41,520 / -38,426 | -5,937 / -5,262 | -44,824 | -6,333 | P,B,M,C,E |
| 590. `15m/n5/m0/momentum/L/Z` | 4334 / 1152 | -51,725 / -47,267 | -15,849 / -13,820 | -55,030 | -6,179 | P,B,M,C,E |
| 591. `30m/n1/m0/momentum/S/Z` | 5344 / 1383 | -82,365 / -74,115 | -23,603 / -22,260 | -60,083 | -7,468 | P,B,M,C,E |
| 592. `30m/n1/m0/momentum/L/Z` | 5341 / 1383 | -69,100 / -60,942 | -16,236 / -14,912 | -72,404 | -7,858 | P,B,M,C,E |
| 593. `5m/n12/m0/momentum/S/Z` | 8242 / 2203 | -103,154 / -100,641 | -32,649 / -31,441 | -80,871 | -10,042 | P,B,M,C,E |
| 594. `5m/n12/m0/momentum/L/Z` | 8255 / 2198 | -91,350 / -88,493 | -25,238 / -24,094 | -94,655 | -9,877 | P,B,M,C,E |
| 595. `15m/n1/m0/momentum/S/Z` | 10605 / 2739 | -147,326 / -146,696 | -43,237 / -42,876 | -125,043 | -12,206 | P,B,M,C,E |
| 596. `15m/n1/m0/momentum/L/Z` | 10612 / 2740 | -134,455 / -133,601 | -36,021 / -35,455 | -137,759 | -12,768 | P,B,M,C,E |
| 597. `5m/n5/m0/momentum/S/Z` | 13013 / 3363 | -170,700 / -165,654 | -47,301 / -45,627 | -148,417 | -16,201 | P,B,M,C,E |
| 598. `5m/n5/m0/momentum/L/Z` | 13024 / 3368 | -158,496 / -153,395 | -40,057 / -38,276 | -161,801 | -15,389 | P,B,M,C,E |
| 599. `5m/n1/m0/momentum/S/Z` | 31264 / 8074 | -366,226 / -374,596 | -98,538 / -98,852 | -343,944 | -29,939 | P,B,M,C,E |
| 600. `5m/n1/m0/momentum/L/Z` | 31302 / 8080 | -354,852 / -363,738 | -91,163 / -91,377 | -358,156 | -29,938 | P,B,M,C,E |

## Appendix B. Raw-delta top-five monthly comparisons

These are R1–R5 from section 5, not A–E. Preserve their monthly failures
despite their flattering own-short-clock delta. Actual net and delta shown
together; same full/recent dates, fees and marking convention.

### Full / immediate

| Month | clock_short net $ | R1 net (delta) $ | R2 net (delta) $ | R3 net (delta) $ | R4 net (delta) $ | R5 net (delta) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,203 | -52 (+1,151) | +1,125 (+2,328) | +306 (+1,509) | +1,085 (+2,289) | +1,226 (+2,430) |
| 2025-08 | -1,876 | +245 (+2,121) | -347 (+1,528) | -501 (+1,374) | -129 (+1,747) | -819 (+1,056) |
| 2025-09 | -1,211 | -1,110 (+102) | +156 (+1,367) | -736 (+476) | +1,663 (+2,874) | -258 (+954) |
| 2025-10 | -894 | +2,938 (+3,832) | +253 (+1,147) | +1,238 (+2,132) | +2,177 (+3,071) | +4,755 (+5,649) |
| 2025-11 | +1,970 | +549 (-1,421) | +827 (-1,142) | +1,170 (-800) | -347 (-2,317) | +2,413 (+444) |
| 2025-12 | +1,212 | +2,147 (+935) | -232 (-1,444) | +1,620 (+408) | -977 (-2,189) | +1,023 (-189) |
| 2026-01 | -3,149 | +658 (+3,806) | +735 (+3,884) | +728 (+3,877) | +208 (+3,357) | +2 (+3,151) |
| 2026-02 | -1,111 | -1,326 (-216) | +1,123 (+2,234) | +59 (+1,170) | +200 (+1,310) | +1,263 (+2,373) |
| 2026-03 | -2,521 | +380 (+2,901) | -256 (+2,264) | -46 (+2,475) | +633 (+3,154) | -1,257 (+1,264) |
| 2026-04 | -1,628 | +237 (+1,865) | -30 (+1,598) | +756 (+2,384) | -591 (+1,038) | +67 (+1,695) |
| 2026-05 | -7,161 | -494 (+6,666) | -88 (+7,073) | -1,669 (+5,491) | -1,729 (+5,432) | -2,797 (+4,363) |
| 2026-06 | -64 | +319 (+382) | -322 (-259) | +32 (+96) | +2,735 (+2,798) | -54 (+9) |
| 2026-07 | +1,259 | +1,837 (+578) | +1,355 (+96) | +1,967 (+708) | -42 (-1,301) | -110 (-1,369) |
| 2026-08 | -5,675 | -522 (+5,153) | -482 (+5,193) | -1,141 (+4,534) | -1,036 (+4,639) | -1,522 (+4,154) |
| 2026-09 | -231 | -41 (+190) | -71 (+160) | -41 (+190) | -138 (+93) | -351 (-119) |

### Full / +1m actions

| Month | clock_short net $ | R1 net (delta) $ | R2 net (delta) $ | R3 net (delta) $ | R4 net (delta) $ | R5 net (delta) $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,271 | +2 (+1,272) | +1,198 (+2,469) | +297 (+1,568) | +639 (+1,910) | +1,103 (+2,374) |
| 2025-08 | -2,120 | +294 (+2,414) | -444 (+1,676) | -533 (+1,587) | -263 (+1,857) | -341 (+1,779) |
| 2025-09 | -1,056 | -1,138 (-82) | +153 (+1,209) | -63 (+993) | +1,788 (+2,844) | -532 (+524) |
| 2025-10 | -880 | +2,203 (+3,084) | +243 (+1,123) | +1,380 (+2,260) | +2,173 (+3,053) | +5,456 (+6,336) |
| 2025-11 | +2,037 | +504 (-1,533) | +470 (-1,567) | +1,388 (-649) | +505 (-1,532) | +2,304 (+267) |
| 2025-12 | +1,267 | +2,132 (+865) | -494 (-1,761) | +1,491 (+224) | -714 (-1,981) | -14 (-1,280) |
| 2026-01 | -3,378 | +749 (+4,127) | +882 (+4,259) | +1,142 (+4,520) | +234 (+3,612) | +186 (+3,563) |
| 2026-02 | -1,335 | -1,034 (+301) | +1,083 (+2,418) | +198 (+1,534) | -73 (+1,262) | +1,254 (+2,589) |
| 2026-03 | -2,588 | +373 (+2,961) | -250 (+2,339) | +842 (+3,430) | +429 (+3,018) | -1,309 (+1,280) |
| 2026-04 | -1,564 | +206 (+1,769) | -76 (+1,488) | +167 (+1,730) | -452 (+1,112) | -245 (+1,319) |
| 2026-05 | -7,132 | -662 (+6,470) | -134 (+6,999) | -1,772 (+5,361) | -1,301 (+5,831) | -1,922 (+5,210) |
| 2026-06 | -139 | +96 (+234) | -296 (-158) | +62 (+201) | +2,724 (+2,863) | +444 (+583) |
| 2026-07 | +1,252 | +1,838 (+586) | +1,384 (+132) | +1,931 (+679) | +31 (-1,221) | -142 (-1,395) |
| 2026-08 | -5,680 | -628 (+5,052) | -553 (+5,127) | -1,331 (+4,350) | -504 (+5,176) | -2,222 (+3,459) |
| 2026-09 | -139 | -22 (+117) | -77 (+62) | -22 (+117) | -121 (+19) | -369 (-229) |

### Recent / immediate

| Month | clock_short net $ | R1 net (delta) $ | R2 net (delta) $ | R3 net (delta) $ | R4 net (delta) $ | R5 net (delta) $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,175 | -1,137 (+4,039) | -296 (+4,880) | -2,218 (+2,958) | -1,479 (+3,696) | -2,525 (+2,651) |
| 2026-06 | -64 | +319 (+382) | -322 (-259) | +32 (+96) | +2,735 (+2,798) | -54 (+9) |
| 2026-07 | +1,259 | +1,837 (+578) | +1,355 (+96) | +1,967 (+708) | -42 (-1,301) | -110 (-1,369) |
| 2026-08 | -5,675 | -522 (+5,153) | -482 (+5,193) | -1,141 (+4,534) | -1,036 (+4,639) | -1,522 (+4,154) |
| 2026-09 | -231 | -41 (+190) | -71 (+160) | -41 (+190) | -138 (+93) | -351 (-119) |

### Recent / +1m actions

| Month | clock_short net $ | R1 net (delta) $ | R2 net (delta) $ | R3 net (delta) $ | R4 net (delta) $ | R5 net (delta) $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,099 | -1,274 (+3,825) | -315 (+4,784) | -2,238 (+2,861) | -1,077 (+4,021) | -1,567 (+3,532) |
| 2026-06 | -191 | +96 (+287) | -296 (-106) | +62 (+253) | +2,724 (+2,915) | +444 (+635) |
| 2026-07 | +1,330 | +1,838 (+508) | +1,384 (+54) | +1,931 (+601) | +31 (-1,299) | -142 (-1,473) |
| 2026-08 | -5,753 | -628 (+5,125) | -553 (+5,200) | -1,331 (+4,423) | -504 (+5,249) | -2,222 (+3,531) |
| 2026-09 | -218 | -22 (+196) | -77 (+140) | -22 (+196) | -121 (+97) | -369 (-151) |

## Side observations / untested boundaries

528 of 600 definitions meet the minimum trade count in all four cases;
72 do not. There are no all-zero definitions, but larger magnitudes on
short clocks remain sparse (36 inadequate5m definitions,12 each15m/30m/1h,
none4h). This cannot rule out rare move mechanisms. 123 definitions are
positive in all four cases regardless of sample; 48 also positive after extra
costs regardless of sample; 33 remain after sample/solvency requirements.

The descriptive subset comprises11 momentum,15 into,7 back-out rules,
32 long/1 short. These are correlated trials, not33 independent discoveries.
25 definitions exhaust modeled equity in at least one diagnostic case and
are disqualified; continuing diagnostic ledgers are not deployable PnL.

No observed ROC property here proves it adds information beyond CRSI/RSI,
the existing ladder gates, or HL/S/R. That needs later controls with each
component alone and the joint rule on the same already-causal data contract.
