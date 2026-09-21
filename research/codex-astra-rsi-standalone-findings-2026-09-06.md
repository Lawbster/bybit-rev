# I04: RSI14 standalone findings — September 6, 2026

## TL;DR

- **210 frozen RSI14 definitions, 848 window/delay/control cases.** All 24 prior baseline/RSI overlaps matched exactly; independent verification checked 104,143 trade records and 8,480 monthly records. These are repeated artifact records, not 104,143 independent market opportunities.
- **14 definitions meet the predeclared sample, positive-net and extra-cost shortlist rules; all are long.** The full-window leaders are 15m into <=40 / 12h (+$8,458) and 5m into <=30 / 12h (+$8,388), versus clock-long +$3,305. Recent results are +$3,775 / +$5,067 versus clock +$5,038. **0/210 pass the complete strict screen**; monthly opportunity-cost regressions remain.
- **Not a live upgrade or a rejection of RSI as a feature.** All 53 adequately sampled short definitions lose in full immediate execution; rare 90/95 extremes are insufficient or absent. The leading oversold longs suffer roughly 49–52% worst adverse price excursions, before eventual exits. Preserve useful mechanisms and failures for later combinations; live ladder and paused short configuration remain unchanged.

## 1. Exactly what was tested

| Dimension | Frozen choice |
|---|---|
| Indicator | Unrounded Wilder RSI14; 14-difference arithmetic seed, then 1/14 recursion; flat=50, gains-only=100, losses-only=0 |
| Timeframes | 5m, 15m, 30m, 1h, 4h, complete contiguous UTC candles |
| Mirrored levels | Long <=40/30/20/10/5; short >=60/70/80/90/95 |
| Into-extreme entry | Long previous >L, current <=L; short previous <U, current >=U |
| Recovery entry | Long previous <=L, current >L; short previous >=U, current <U |
| Extreme-rule exits | Fixed 12h, or first subsequent completed RSI >=50 long / <=50 short, capped at 12h |
| Separate trend interpretation | Long crosses above50 / short below50, each timeframe, fixed12h only |
| Definitions | 5 TF x 5 level pairs x 2 modes x 2 sides x 2 exits =200; plus10 center rules =210 |
| New versus repeated | 206 new; four repeat I01 hourly recross30/70 side/exit rules. Clock controls are not hypotheses |
| Cases | 210 x 2 windows x 2 action delays =840 strategy cases; 8 clock cases |
| Exclusions | No RSI-length optimization, TP/SL, trailing/partials, divergence, extra trend filters, ladder changes, RSI mixtures, HL or S/R combinations |

Exact IDs and all attempted outcomes appear in Appendix A. A rule ID's number is
the **upper** level; e.g. `rsi_15m_60_into_long_fixed12h` buys at a crossing
into RSI <=40, not <=60. This study is bounded, not an exhaustive RSI search.

Frozen [card](../research-inputs/indicators/rsi-standalone-2026-09-06.json) /
[engineering and reproduction guide](../docs/research/rsi-standalone-study.md).

## 2. Dates, baseline and accounting contract

| Item | Convention |
|---|---|
| Full window | **2025-07-01 00:00 → 2026-09-04 19:01 UTC** |
| Recent window | **2026-05-17 20:43 → 2026-09-04 19:01 UTC**, contained within full |
| Fixed indicator seed | 2025-06-01 00:00 UTC; 663,541 continuous seeded minutes through cutoff |
| Position / equity | $10,000 fixed entry notional, $32,000 initial equity, one independent position per rule; no averaging or compounding |
| Fees | 0.055% each side on actual executed notional; all reported profits after these fees |
| Funding | **Excluded** because complete settlement history is unavailable; these are not fully net live account returns |
| Immediate execution | Signal only when selected candle completes; fill at subsequent minute open, modeling zero publication lag |
| Delayed execution | Separate +1m delay to **every entry and exit**; hold measured from actual fill |
| Cost stress | Additional 5bps/side on the same path and turnover, including marked closing turnover; not a changed liquidity/fill path |
| Main baseline | Same-side rolling12h clock, near-continuous exposure. Not exposure-matched, and **not the Martingale ladder** |
| Own-exit baseline | Every RSI50 exit also compared with its identical entry rule's unchanged fixed12h path |
| Open inventory | Final close marked with hypothetical exit fee; not fabricated as a completed trade |
| Drawdown | Close-equity peak to minute adverse-price equity, including fee accounting, on $32k; no inferred intraminute path |

Windows overlap and are already mined development history; do not add their
PnLs/counts or treat them as independent validation. The +1m models also change
which later crossings are available while flat, not only fill prices.
No actual historical receipt-time, funding, liquidation, shared collateral,
exchange queue or simultaneous-ladder validation is claimed.

Cash/no-trade is $0. Buy-and-hold context from I01 is +$11,511 full / +$8,383
recent at fixed initial quantity, with changing notional: not a matched strategy
control. Winning and losing dollars below already include fees; do not subtract
them again. Net = winning dollars + losing dollars + open mark (no breakevens
in the displayed cases). Rounded cells may differ by a dollar.

### Primary baselines: no cherry-picked execution delay

| Window / delay | Long clock net / closes | Long clock DD | Short clock net / closes | Short clock DD |
|---|---:|---:|---:|---:|
| full / 0m | +3,305 / 861 | 33.09% | -22,283 / 861 | 71.27% |
| full / +1m | +3,792 / 859 | 33.53% | -22,726 / 859 | 72.65% |
| recent / 0m | +5,038 / 219 | 12.94% | -9,887 / 219 | 32.54% |
| recent / +1m | +5,104 / 218 | 13.14% | -9,930 / 218 | 32.80% |

## 3. What qualifies for description, versus an upgrade

The strict inherited I01 screen requires >=30 full /10 recent completed trades
in **both** delays, positive net and positive same-side-clock improvement in all
four cases, no negative monthly marked delta (apart from numerical epsilon),
positive extra-cost net, and no equity exhaustion. **No RSI definition passes.**

The separate shortlist was declared **before outcomes**: the same counts,
positive net and extra-cost net in all four cases, and solvency, ranked by full
immediate **absolute net**. It does not require beating every month or the clock.
Do not turn this descriptive subset into a relaxed pass of the strict screen.

| Across 210 definitions | Count |
|---|---:|
| Adequate completed counts in all four cases | 98 |
| Positive net in all four cases, including sparse rules | 32 |
| Positive extra-cost net in all four cases, including sparse rules | 22 |
| Adequately sampled + positive net/stress + solvent shortlist | 14 (all long) |
| Strict screen passes / deployment candidates | 0 / 0 |
| No completed trade in any case | 52 |

53 adequately sampled definitions are short, 45 are long. Every one of those
53 shorts loses in full immediate execution; 51 lose in **all four** cases.
The two exceptions are 4h recovery below60 shorts whose signs improve in some
+1m cases, not stable positive strategies.

The raw frozen all-rule ranking is by improvement versus its own side clock.
Its top five are **sparse shorts**: losing clock-short -$22,283 makes nearly
inactive rules rank very high. This is why absolute net and sample counts are
always displayed. Appendix A preserves that raw ranking instead of hiding it.

## 4. Best adequately sampled RSI longs, with baseline W/L dollars

A–E are the predeclared top-five descriptive selection. F is the separate,
lower-drawdown center-cross observation, not a sixth selected winner.

### Full: July 1, 2025 → September 4, 2026 19:01 UTC

Immediate model. Dollars after trading fees, before funding.

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Delta vs clock $ | DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clock long baseline | 861 | 420/441 | 110,950 | -107,401 | -245 | +3,305 | baseline | 33.09% |
| A: 15m into <=40 / 12h | 521 | 262/259 | 69,725 | -61,266 | 0 | +8,458 | +5,154 | 18.02% |
| B: 5m into <=30 / 12h | 463 | 231/232 | 62,264 | -53,876 | 0 | +8,388 | +5,083 | 22.39% |
| C: 30m into <=30 / 12h | 149 | 83/66 | 22,988 | -15,946 | +163 | +7,205 | +3,901 | 16.18% |
| D: 30m into <=40 / RSI50-or-12h | 449 | 295/154 | 44,607 | -37,448 | +2 | +7,161 | +3,857 | 18.16% |
| E: 30m into <=30 / RSI50-or-12h | 150 | 100/50 | 20,480 | -13,648 | +163 | +6,995 | +3,690 | 17.27% |
| F: 4h crosses above50 / 12h | 136 | 72/64 | 20,408 | -15,072 | 0 | +5,336 | +2,032 | 7.87% |
| Clock short baseline | 861 | 414/447 | 98,162 | -120,668 | +223 | -22,283 | baseline | 71.27% |

### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC

Immediate model. Dollars after trading fees, before funding.

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Delta vs clock $ | DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Clock long baseline | 219 | 114/105 | 29,120 | -23,837 | -245 | +5,038 | baseline | 12.94% |
| A: 15m into <=40 / 12h | 125 | 63/62 | 16,410 | -12,635 | 0 | +3,775 | -1,263 | 7.95% |
| B: 5m into <=30 / 12h | 106 | 51/55 | 15,819 | -10,753 | 0 | +5,067 | +29 | 8.25% |
| C: 30m into <=30 / 12h | 38 | 27/11 | 6,355 | -3,169 | +163 | +3,349 | -1,690 | 5.35% |
| D: 30m into <=40 / RSI50-or-12h | 101 | 65/36 | 9,381 | -7,788 | +2 | +1,596 | -3,443 | 6.74% |
| E: 30m into <=30 / RSI50-or-12h | 38 | 28/10 | 5,879 | -2,964 | +163 | +3,078 | -1,960 | 4.78% |
| F: 4h crosses above50 / 12h | 31 | 16/15 | 4,796 | -3,267 | 0 | +1,528 | -3,510 | 6.87% |
| Clock short baseline | 219 | 97/122 | 21,666 | -31,775 | +223 | -9,887 | baseline | 32.54% |

A has the highest full net, but gives up $1,263 recent versus the clock.
B beats both full and recent clocks in both execution models, yet recent
immediate improvement is only **$29**, and substantial monthly regressions
remain. C takes many fewer trades and sacrifices recent upside. D improves
its own fixed12h entry baseline, but has a thin delayed cost cushion.
F is interesting for a different, trend-following interpretation; its lower
drawdown is **not** proof that it is an effective ladder blocker.

### Delay and cost sensitivity: same selected rules, no re-ranking

Each cell is **ordinary net / extra-cost net**, in dollars. Stress is additional
5bps each side, not total fee rate. No new exit or threshold is selected here.

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m |
|---|---:|---:|---:|---:|
| Clock long baseline | +3,305 / -5,322 | +3,792 / -4,815 | +5,038 / +2,835 | +5,104 / +2,910 |
| A: 15m into <=40 / 12h | +8,458 / +3,241 | +8,563 / +3,395 | +3,775 / +2,523 | +3,473 / +2,231 |
| B: 5m into <=30 / 12h | +8,388 / +3,751 | +9,291 / +4,664 | +5,067 / +4,004 | +5,549 / +4,486 |
| C: 30m into <=30 / 12h | +7,205 / +5,701 | +6,968 / +5,473 | +3,349 / +2,957 | +2,874 / +2,482 |
| D: 30m into <=40 / RSI50-or-12h | +7,161 / +2,655 | +4,669 / +214 | +1,596 / +574 | +1,234 / +213 |
| E: 30m into <=30 / RSI50-or-12h | +6,995 / +5,481 | +6,149 / +4,645 | +3,078 / +2,686 | +2,882 / +2,490 |
| F: 4h crosses above50 / 12h | +5,336 / +3,973 | +5,807 / +4,564 | +1,528 / +1,218 | +1,269 / +979 |
| Clock short baseline | -22,283 / -30,909 | -22,726 / -31,333 | -9,887 / -12,090 | -9,930 / -12,124 |

## 5. Monthly opportunity cost: where the losses and sacrificed upside sit

These are **monthly marked-equity PnL**, not sums assigned only by closing date.
Each variant cell is **its PnL (delta versus clock)**. Negative delta may be
sacrificed profit, not an actual losing month. September is partial; recent May
starts May17 20:43. Tables retain all top-five rules, including bad months.

### full / immediate actions

| Month | Clock long $ | A $ (delta) | B $ (delta) | C $ (delta) | D $ (delta) | E $ (delta) |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | -161 | +1,285 (+1,446) | +1,567 (+1,729) | -70 (+92) | +514 (+676) | +672 (+834) |
| 2025-08 | +510 | +1,445 (+934) | +2,606 (+2,096) | +81 (-429) | +1,393 (+882) | +178 (-332) |
| 2025-09 | -109 | +1,434 (+1,544) | +2,052 (+2,162) | +465 (+575) | +1,054 (+1,164) | -341 (-232) |
| 2025-10 | -470 | +67 (+537) | +961 (+1,432) | +593 (+1,064) | +447 (+918) | +518 (+988) |
| 2025-11 | -3,287 | +293 (+3,580) | -2,112 (+1,175) | +257 (+3,544) | +1,892 (+5,178) | +1,317 (+4,604) |
| 2025-12 | -2,574 | -976 (+1,598) | -1,233 (+1,341) | -270 (+2,304) | -661 (+1,913) | +1 (+2,574) |
| 2026-01 | +1,782 | -932 (-2,714) | -2,234 (-4,016) | +714 (-1,068) | -1,426 (-3,208) | +2 (-1,780) |
| 2026-02 | -122 | +511 (+633) | +150 (+272) | +913 (+1,035) | +1,929 (+2,051) | +1,265 (+1,387) |
| 2026-03 | +1,155 | +2,666 (+1,511) | +3,474 (+2,319) | +474 (-680) | +1,844 (+690) | +947 (-208) |
| 2026-04 | +307 | -390 (-697) | -934 (-1,241) | +285 (-22) | -571 (-878) | -305 (-612) |
| 2026-05 | +5,789 | +189 (-5,601) | +826 (-4,963) | +881 (-4,908) | -871 (-6,660) | +67 (-5,723) |
| 2026-06 | -1,256 | +1,812 (+3,068) | +2,550 (+3,806) | +2,757 (+4,013) | +1,251 (+2,507) | +2,576 (+3,831) |
| 2026-07 | -2,621 | -2,144 (+477) | -2,296 (+325) | -1,353 (+1,268) | -917 (+1,704) | -1,115 (+1,505) |
| 2026-08 | +4,306 | +3,198 (-1,108) | +2,773 (-1,533) | +1,007 (-3,299) | +1,113 (-3,193) | +738 (-3,568) |
| 2026-09 | +55 | +1 (-54) | +237 (+181) | +469 (+414) | +168 (+113) | +475 (+419) |

### full / +1m actions

| Month | Clock long $ | A $ (delta) | B $ (delta) | C $ (delta) | D $ (delta) | E $ (delta) |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | -94 | +1,410 (+1,504) | +1,592 (+1,686) | -12 (+81) | +95 (+189) | +557 (+651) |
| 2025-08 | +754 | +1,405 (+650) | +2,564 (+1,810) | +70 (-684) | +1,025 (+271) | +127 (-627) |
| 2025-09 | -265 | +1,584 (+1,849) | +1,995 (+2,260) | +375 (+640) | +850 (+1,114) | -478 (-213) |
| 2025-10 | -484 | +525 (+1,010) | +1,189 (+1,673) | +584 (+1,068) | +259 (+743) | +495 (+980) |
| 2025-11 | -3,354 | +229 (+3,583) | -1,784 (+1,570) | +123 (+3,477) | +1,583 (+4,937) | +1,227 (+4,581) |
| 2025-12 | -2,606 | -309 (+2,297) | -1,128 (+1,479) | -28 (+2,578) | -746 (+1,861) | -316 (+2,291) |
| 2026-01 | +2,011 | -1,188 (-3,198) | -2,520 (-4,531) | +907 (-1,104) | -1,766 (-3,777) | +116 (-1,895) |
| 2026-02 | +102 | +735 (+633) | +229 (+127) | +902 (+799) | +1,526 (+1,423) | +1,130 (+1,028) |
| 2026-03 | +1,222 | +1,686 (+463) | +3,459 (+2,236) | +396 (-826) | +1,846 (+624) | +970 (-252) |
| 2026-04 | +243 | -148 (-391) | -935 (-1,177) | +289 (+46) | -564 (-807) | -249 (-492) |
| 2026-05 | +5,761 | -0 (-5,761) | +762 (-4,999) | +945 (-4,816) | -706 (-6,468) | +67 (-5,694) |
| 2026-06 | -1,159 | +1,675 (+2,833) | +2,606 (+3,765) | +2,197 (+3,356) | +1,110 (+2,269) | +2,320 (+3,479) |
| 2026-07 | -2,614 | -2,254 (+361) | -2,352 (+262) | -1,320 (+1,294) | -988 (+1,626) | -1,063 (+1,552) |
| 2026-08 | +4,311 | +3,186 (-1,125) | +3,311 (-999) | +1,055 (-3,255) | +1,036 (-3,275) | +753 (-3,558) |
| 2026-09 | -37 | +26 (+62) | +303 (+339) | +486 (+522) | +110 (+146) | +492 (+529) |

### recent / immediate actions

| Month | Clock long $ | A $ (delta) | B $ (delta) | C $ (delta) | D $ (delta) | E $ (delta) |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | +4,554 | +908 (-3,646) | +1,804 (-2,750) | +469 (-4,085) | -20 (-4,574) | +405 (-4,149) |
| 2026-06 | -1,256 | +1,812 (+3,068) | +2,550 (+3,806) | +2,757 (+4,013) | +1,251 (+2,507) | +2,576 (+3,831) |
| 2026-07 | -2,621 | -2,144 (+477) | -2,296 (+325) | -1,353 (+1,268) | -917 (+1,704) | -1,115 (+1,505) |
| 2026-08 | +4,306 | +3,198 (-1,108) | +2,773 (-1,533) | +1,007 (-3,299) | +1,113 (-3,193) | +738 (-3,568) |
| 2026-09 | +55 | +1 (-54) | +237 (+181) | +469 (+414) | +168 (+113) | +475 (+419) |

### recent / +1m actions

| Month | Clock long $ | A $ (delta) | B $ (delta) | C $ (delta) | D $ (delta) | E $ (delta) |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | +4,477 | +841 (-3,637) | +1,681 (-2,796) | +456 (-4,021) | -34 (-4,511) | +380 (-4,098) |
| 2026-06 | -1,129 | +1,675 (+2,803) | +2,606 (+3,735) | +2,197 (+3,326) | +1,110 (+2,239) | +2,320 (+3,449) |
| 2026-07 | -2,692 | -2,254 (+439) | -2,352 (+340) | -1,320 (+1,372) | -988 (+1,704) | -1,063 (+1,629) |
| 2026-08 | +4,384 | +3,186 (-1,198) | +3,311 (-1,072) | +1,055 (-3,328) | +1,036 (-3,348) | +753 (-3,630) |
| 2026-09 | +64 | +26 (-38) | +303 (+239) | +486 (+422) | +110 (+46) | +492 (+429) |

The main pattern is not simply “avoid red months.” In full immediate execution,
A–E improve on the clock in June and July2026, but all still **lose in July**
($917–$2,296). All sacrifice substantial May and August clock profit.
B also loses $2,112 in November2025 and $2,234 in January2026. Avoiding exposure
removes winning as well as losing trades. There is no demonstrated monthly
non-regressing replacement here.

## 6. What RSI actually tells us, and what it does not

### Entering weakness and waiting for recovery are not interchangeable

| Same-level long entry comparison / fixed12h | Full into / recovery net $ | Recent into / recovery net $ |
|---|---:|---:|
| 15m level40 | +8,458 / -959 | +3,775 / +469 |
| 5m level30 | +8,388 / +5,155 | +5,067 / +4,688 |

For 5m level30, recovery worsens full DD22.39% →25.98% but improves recent
DD8.25% →7.25%. For 15m level40, delayed recovery full +$444 is still far below
delayed into +$8,563. Do not import CRSI's recovery-entry result into RSI.
Each is a complete independent path with different occupancy and entry times.

### RSI50 exits can help a particular RSI rule; not a universal exit

| 30m into <=40 | Full net / closes | Recent net / closes |
|---|---:|---:|
| Own fixed12h baseline | -$1,808 / 374 | -$1,467 / 82 |
| RSI50-or-12h (D) | +$7,161 / 449 | +$1,596 / 101 |
| Improvement | +$8,969 | +$3,062 |

Its +1m own-baseline improvements are +$4,414 full / +$2,303 recent. However,
delayed extra-cost net is only **+$214 full / +$213 recent**. This is a fragile
exit/turnover finding, not robust free profit. It also changes subsequent trade
membership and is not a same-trade price-only attribution.

By contrast, adding RSI50 to 30m into<=30 (E versus C) reduces full immediate
net by $210 and recent by $270. Full +1m declines $819; recent +1m improves just
$8. There is no general rule that “RSI50 is better.”

### The separate 4h RSI50 long deserves a record, not a trading claim

F earns +$5,336 full /+$1,528 recent, versus clocks +$3,305 /+$5,038.
Full adverse DD7.87% is far below clock33.09%, but there are only136 full /
31 recent closes. It retains just 1,632h of full completed-position holding
time (136 x12h), far less exposure than the clock.
The +1m model has124 full /29 recent closes because shifted occupancy skips
crossings, not because future signals are added.
Its profit concentration is severe (next section). Whether this is useful as
a conditioning feature with another indicator is **untested**.

### Extreme thresholds: absent is not falsified

| Upper / mirrored lower | Definitions | Zero-trade definitions in all four cases |
|---|---:|---:|
| 60 /40 | 40 | 0 |
| 70 /30 | 40 | 0 |
| 80 /20 | 40 | 0 |
| 90 /10 | 40 | 12 |
| 95 /5 | 40 | 40 |

There are **zero raw95/5 crossings**, not rejected fills. RSI14 is much smoother
than CRSI(3,2,100); identical numeric levels do not have identical rarity.
The 90/10 rules that do trade are too sparse for the frozen minimum counts.
No conclusion follows about RSI2/3/7, other seed contracts or another asset.

The best raw-ranked short is 4h recovery below90: +$505 from **one full trade
and zero recent trades**, identical under both tested exits. The 5m into>=90 /
RSI50 short has +$71 from **two trades** (both recent). These are observations,
not reliable profitable shorts. Best adequately sampled full short is 4h
recovery below60 /12h: -$54 full (95 closes), -$1,079 recent (28), versus
short clocks -$22,283 /-$9,887. +1m changes it to +$873 /+$51, but extra costs
turn both negative. This exact setup is not robust.

## 7. Worst paths and concentration: closing profits hide exposure

Read-only supplement: `scripts/rsi-standalone-path-check.ts`. It validates the
pinned inputs/sources and all verified artifacts, scans only already completed
trade intervals, excludes exit-minute highs/lows, and introduces no strategy.
Table uses immediate full-window trades. Gross adverse excursion excludes
fees and is relative to $10k entry notional; it is **not account DD**.

| Setup | Worst gross adverse $ / price % | Final net of that trade $ | Worst completed trade $ | Top5 winners / closed net |
|---|---:|---:|---:|---:|
| Clock long baseline | -5,352 / -53.52% | -1,601 | -1,601 | 199.91% |
| A: 15m into <=40 / 12h | -5,161 / -51.61% | -953 | -1,098 | 65.71% |
| B: 5m into <=30 / 12h | -4,905 / -49.05% | -232 | -1,185 | 66.50% |
| C: 30m into <=30 / 12h | -5,121 / -51.21% | -1,093 | -1,093 | 65.14% |
| D: 30m into <=40 / RSI50-or-12h | -5,197 / -51.97% | -1,079 | -1,098 | 33.45% |
| E: 30m into <=30 / RSI50-or-12h | -5,121 / -51.21% | -1,093 | -1,093 | 45.19% |
| F: 4h crosses above50 / 12h | -872 / -8.72% | -705 | -787 | 116.55% |

A–E all hold through **October10,2025 21:21 UTC**, whose minute low is $20.784.
For example A enters17:45 at$42.95, floats gross -$5,161, then eventually exits
net -$953. A profitable aggregate table does not prove that leverage, execution
or an account sharing the ladder could survive that path.

F's worst completed-trade excursion is instead October21–22: entry$37.855,
low$34.554, gross -$872 and eventual net -$705. This avoids the specific October10
path historically, not all future crashes. Its largest five winners exceed
**116% of full closed net and216% of recent closed net**; removing them would
leave losses. A's recent five largest winners likewise exceed its closed net.
This is substantial concentration, not 14 independent discoveries.

Recent worst completed-trade excursions are smaller but still material:
clock long -$1,305; A -$1,068; B -$1,080; C/E -$813; D -$1,041; F -$699,
all gross on$10k. These path diagnostics exclude still-open cutoff inventory;
the main verified DD and net calculations include that inventory.

## 8. Full shortlist inventory and later-combination notes

All14 rows pass only the descriptive sample/net/stress filter; none passes
the complete strict screen. Main-case figures are full immediate net, recent
immediate net, and worst monthly delta across both windows and delays.

| Exact ID | Full net $ / closes | Recent net $ / closes | Worst monthly delta $ |
|---|---:|---:|---:|
| `rsi_15m_60_into_long_fixed12h` | +8,458 / 521 | +3,775 / 125 | -5,761 |
| `rsi_5m_70_into_long_fixed12h` | +8,388 / 463 | +5,067 / 106 | -4,999 |
| `rsi_30m_70_into_long_fixed12h` | +7,205 / 149 | +3,349 / 38 | -4,908 |
| `rsi_30m_60_into_long_indicator_or12h` | +7,161 / 449 | +1,596 / 101 | -6,660 |
| `rsi_30m_70_into_long_indicator_or12h` | +6,995 / 150 | +3,078 / 38 | -5,723 |
| `rsi_60m_60_into_long_fixed12h` | +5,741 / 262 | +1,317 / 62 | -5,273 |
| `rsi_240m_center50_long_fixed12h` | +5,336 / 136 | +1,528 / 31 | -4,195 |
| `rsi_5m_70_back_out_long_fixed12h` | +5,155 / 463 | +4,688 / 107 | -5,316 |
| `rsi_60m_60_into_long_indicator_or12h` | +5,016 / 269 | +2,103 / 64 | -5,555 |
| `rsi_15m_70_into_long_fixed12h` | +4,493 / 232 | +2,919 / 59 | -6,212 |
| `rsi_30m_70_back_out_long_indicator_or12h` | +3,568 / 150 | +1,490 / 37 | -6,015 |
| `rsi_30m_70_back_out_long_fixed12h` | +2,972 / 149 | +1,729 / 37 | -4,826 |
| `rsi_5m_80_into_long_indicator_or12h` | +2,970 / 118 | +570 / 22 | -5,425 |
| `rsi_5m_80_into_long_fixed12h` | +2,663 / 107 | +556 / 20 | -6,111 |

Preserve these distinctions for later work, **without running combinations now**:

- **Location of weakness:** 5m/15m/30m oversold entries can have positive standalone
  returns, but do not distinguish a temporary dip from a cascade. Any proposed
  independent confirmation must retain the RSI-alone control and show the
  lost rebound upside as well as avoided losses.
- **Slower momentum:** 4h crosses above50 is a different interpretation from
  shorting “overbought.” It is a candidate feature to examine later, not a
  proven regime filter or permanent >50-state rule (we tested crossings only).
- **Exit context:** 30m RSI50 recovery helps the particular level40 entry, but
  is cost/delay-sensitive. Pairing it with a new entry or HL/SR level is a new
  hypothesis; it does not inherit this result.
- **Do not overcount correlated evidence:**14 selected definitions share
  prices, RSI14 and many entries. Raw numeric RSI levels are not independent
  votes alongside CRSI's RSI components.

The next individual-family work in the coverage register is **ROC, then MACD**
with independent formula validation, before broader combinations. This report
does not authorize those next grids or tune the live system.
Still untested: RSI lengths other than14; daily and other bar sizes; sustained
state rather than crossing; momentum extreme-breakout entries; confirmed
divergence; stops/targets/trailing/partial exits; walk-forward untouched data;
actual funding; shared-account/ladder and indicator/HL/SR combinations.

## 9. Timing and independent verification

Example B, July1,2025:

1. Closed5m bar00:25–00:30 has RSI32.4353216857.
2. Bar00:30–00:35 completes with RSI28.4422311721. Only at00:35 is the <=30
   crossing eligible. The immediate entry uses the **00:35 minute open $39.169**,
   never that minute's eventual close, high or low.
3. Fixed timeout is12h after actual entry:12:35 open. In the delayed case
   entry is00:36, timeout decision12:36, exit12:37, if no earlier permitted exit.
4. RSI50 exits use the first subsequent selected-timeframe completed
   observation and cannot use a bar completing before or exactly at the entry
   as an immediate same-decision exit.

All five timeframes independently rebuild WilderRSI14 from minute-derived
closes. Independent verifier enumerates every eligible flat crossing and
occupied skip, identifies first permitted exit, and reconstructs fees, holdings,
minute equity/DD, month boundaries, clock and own-exit deltas.

| Check | Result |
|---|---|
| Prior I01 engine + saved ledger/stat/monthly overlap | 24 exact cases |
| Actual-data feature prefixes | 15 checks (3 per timeframe) |
| Actual-data strategy prefixes | 210 checks |
| New RSI unit/math/timing tests | 10 groups passed |
| Independent artifact verifier | 848 cases;104,143 trade rows;8,480 monthly rows |
| Source/input pins | Stable before/after run and verifier; path supplement rechecks |
| Regression tests | Prior standalone17, feature12, closed-timing11 groups passed |
| Production type checks | Both normal and VPS no-emit checks passed |
| Live/config/state/order actions | None |

Strategy/method sources are additive; old I01/I02/I03 engines and accepted
evidence are preserved. Supplemental path checks run on the saved selected
trades, not a second strategy grid. The normal production build excludes many
research scripts; execution of their tests and verifier is the relevant check.

Local accepted evidence:
`backtests/hype/hype-rsi-standalone-2026-09-06/`, containing frozen source/input
manifest, overlap parity, validation, independent verification, summary/trade/
monthly ledgers, ranking, shortlist, and causal traces. Raw market data and
generated outputs remain private/local; source/card/findings are allowlisted
for Git. No commit/push is performed by this study.

## Appendix A. Every attempted definition, frozen raw ranking

Descending full immediate improvement versus **same-side clock**. This combines
different side baselines and is deliberately **not** a ranking of absolute
profitability. Long absolute-net leaders and the short sparse leaders are
discussed above; no absent or losing rule is hidden.

Counts are full0m/recent0m completed trades. Net cells show **0m /+1m**.
`S` means insufficient counts in at least one case; `P` nonpositive net;
`C` fails aggregate clock improvement; `M` a monthly clock regression;
`K` nonpositive extra-cost net; `E` equity exhaustion.
Every listed definition fails the strict screen. Full-precision all-case
counts/DD/fees/own-exit deltas are in `summary.csv`; month rows in
`monthly.csv`, not rounded from this appendix.

| Rank | Exact ID | Full/recent closes | Full net $ 0m/+1m | Recent net $ 0m/+1m | Full0 delta $ | Failures |
|---|---|---:|---:|---:|---:|---|
| 1 | `rsi_240m_90_back_out_short_fixed12h` | 1/0 | +505 / +504 | 0 / 0 | +22,787 | S,P,M,K |
| 2 | `rsi_240m_90_back_out_short_indicator_or12h` | 1/0 | +505 / +504 | 0 / 0 | +22,787 | S,P,M,K |
| 3 | `rsi_5m_90_into_short_indicator_or12h` | 2/2 | +71 / +176 | +71 / +176 | +22,353 | S,M |
| 4 | `rsi_240m_90_into_short_fixed12h` | 1/0 | +2 / +20 | 0 / 0 | +22,285 | S,P,M,K |
| 5 | `rsi_240m_90_into_short_indicator_or12h` | 1/0 | +2 / +20 | 0 / 0 | +22,285 | S,P,M,K |
| 6 | `rsi_5m_95_into_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 7 | `rsi_5m_95_into_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 8 | `rsi_5m_95_back_out_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 9 | `rsi_5m_95_back_out_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 10 | `rsi_15m_95_into_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 11 | `rsi_15m_95_into_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 12 | `rsi_15m_95_back_out_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 13 | `rsi_15m_95_back_out_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 14 | `rsi_30m_95_into_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 15 | `rsi_30m_95_into_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 16 | `rsi_30m_95_back_out_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 17 | `rsi_30m_95_back_out_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 18 | `rsi_60m_95_into_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 19 | `rsi_60m_95_into_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 20 | `rsi_60m_95_back_out_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 21 | `rsi_60m_95_back_out_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 22 | `rsi_240m_95_into_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 23 | `rsi_240m_95_into_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 24 | `rsi_240m_95_back_out_short_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 25 | `rsi_240m_95_back_out_short_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | +22,283 | S,P,M,K |
| 26 | `rsi_240m_60_back_out_short_fixed12h` | 95/28 | -54 / +873 | -1,079 / +51 | +22,229 | P,M,K |
| 27 | `rsi_5m_90_back_out_short_indicator_or12h` | 2/2 | -163 / -102 | -163 / -102 | +22,120 | S,P,M,K |
| 28 | `rsi_15m_90_into_short_indicator_or12h` | 2/1 | -180 / -278 | +24 / -1 | +22,102 | S,P,M,K |
| 29 | `rsi_60m_90_back_out_short_fixed12h` | 1/1 | -197 / -183 | -197 / -183 | +22,085 | S,P,M,K |
| 30 | `rsi_60m_90_back_out_short_indicator_or12h` | 1/1 | -197 / -183 | -197 / -183 | +22,085 | S,P,M,K |
| 31 | `rsi_60m_90_into_short_fixed12h` | 1/1 | -264 / -256 | -264 / -256 | +22,018 | S,P,M,K |
| 32 | `rsi_60m_90_into_short_indicator_or12h` | 1/1 | -264 / -256 | -264 / -256 | +22,018 | S,P,M,K |
| 33 | `rsi_15m_90_back_out_short_indicator_or12h` | 2/1 | -296 / -367 | +12 / -40 | +21,986 | S,P,M,K |
| 34 | `rsi_5m_90_into_short_fixed12h` | 2/2 | -642 / -534 | -642 / -534 | +21,641 | S,P,M,K |
| 35 | `rsi_30m_90_back_out_short_fixed12h` | 2/1 | -736 / -693 | -280 / -285 | +21,546 | S,P,M,K |
| 36 | `rsi_30m_90_back_out_short_indicator_or12h` | 2/1 | -736 / -693 | -280 / -285 | +21,546 | S,P,M,K |
| 37 | `rsi_30m_90_into_short_fixed12h` | 2/1 | -772 / -777 | -436 / -456 | +21,511 | S,P,M,K |
| 38 | `rsi_30m_90_into_short_indicator_or12h` | 2/1 | -772 / -777 | -436 / -456 | +21,511 | S,P,M,K |
| 39 | `rsi_240m_60_back_out_short_indicator_or12h` | 96/28 | -795 / +1,449 | -1,505 / -283 | +21,488 | P,M,K |
| 40 | `rsi_240m_70_into_short_fixed12h` | 42/15 | -889 / -1,727 | -1,441 / -2,327 | +21,393 | P,M,K |
| 41 | `rsi_240m_70_into_short_indicator_or12h` | 42/15 | -889 / -1,727 | -1,441 / -2,327 | +21,393 | P,M,K |
| 42 | `rsi_15m_90_into_short_fixed12h` | 2/1 | -897 / -933 | -436 / -456 | +21,386 | S,P,M,K |
| 43 | `rsi_5m_90_back_out_short_fixed12h` | 2/2 | -915 / -797 | -915 / -797 | +21,367 | S,P,M,K |
| 44 | `rsi_15m_90_back_out_short_fixed12h` | 2/1 | -944 / -873 | -518 / -507 | +21,339 | S,P,M,K |
| 45 | `rsi_240m_80_into_short_fixed12h` | 9/6 | -1,521 / -1,986 | -32 / -552 | +20,762 | S,P,M,K |
| 46 | `rsi_240m_80_into_short_indicator_or12h` | 9/6 | -1,521 / -1,986 | -32 / -552 | +20,762 | S,P,M,K |
| 47 | `rsi_240m_70_back_out_short_fixed12h` | 39/13 | -1,628 / -2,688 | -928 / -1,081 | +20,655 | P,M,K |
| 48 | `rsi_240m_70_back_out_short_indicator_or12h` | 39/13 | -1,628 / -2,682 | -928 / -1,081 | +20,655 | P,M,K |
| 49 | `rsi_240m_60_into_short_fixed12h` | 95/30 | -1,903 / -732 | -651 / -570 | +20,379 | P,M,K |
| 50 | `rsi_240m_80_back_out_short_fixed12h` | 7/5 | -2,153 / -1,955 | -1,430 / -1,373 | +20,130 | S,P,M,K |
| 51 | `rsi_240m_80_back_out_short_indicator_or12h` | 7/5 | -2,153 / -1,955 | -1,430 / -1,373 | +20,130 | S,P,M,K |
| 52 | `rsi_240m_60_into_short_indicator_or12h` | 95/30 | -2,155 / -1,323 | -745 / -574 | +20,128 | P,M,K |
| 53 | `rsi_5m_80_into_short_indicator_or12h` | 141/30 | -2,327 / -3,092 | -790 / -390 | +19,956 | P,M,K |
| 54 | `rsi_15m_60_into_short_fixed12h` | 529/136 | -2,376 / -3,501 | -5,778 / -5,160 | +19,907 | P,M,K |
| 55 | `rsi_60m_80_back_out_short_fixed12h` | 17/5 | -2,539 / -2,565 | -1,283 / -1,306 | +19,744 | S,P,M,K |
| 56 | `rsi_30m_80_into_short_fixed12h` | 23/7 | -2,604 / -2,580 | -978 / -915 | +19,678 | S,P,M,K |
| 57 | `rsi_60m_80_back_out_short_indicator_or12h` | 17/5 | -2,692 / -2,651 | -1,283 / -1,306 | +19,590 | S,P,M,K |
| 58 | `rsi_30m_80_into_short_indicator_or12h` | 23/7 | -3,046 / -2,879 | -827 / -735 | +19,237 | S,P,M,K |
| 59 | `rsi_60m_80_into_short_fixed12h` | 16/5 | -3,122 / -3,101 | -521 / -599 | +19,161 | S,P,M,K |
| 60 | `rsi_60m_80_into_short_indicator_or12h` | 16/5 | -3,122 / -3,111 | -521 / -599 | +19,161 | S,P,M,K |
| 61 | `rsi_30m_70_back_out_short_fixed12h` | 153/48 | -3,456 / -1,646 | -1,396 / -831 | +18,826 | P,M,K |
| 62 | `rsi_5m_70_into_short_indicator_or12h` | 823/221 | -3,531 / -6,586 | -1,552 / -1,246 | +18,751 | P,M,K |
| 63 | `rsi_30m_60_into_short_indicator_or12h` | 463/122 | -3,824 / -4,262 | -4,209 / -4,410 | +18,458 | P,M,K |
| 64 | `rsi_30m_80_back_out_short_indicator_or12h` | 23/7 | -3,990 / -3,879 | -1,377 / -1,411 | +18,292 | S,P,M,K |
| 65 | `rsi_30m_80_back_out_short_fixed12h` | 23/7 | -4,122 / -3,902 | -1,731 / -1,696 | +18,160 | S,P,M,K |
| 66 | `rsi_15m_70_back_out_short_indicator_or12h` | 281/74 | -4,293 / -5,430 | -1,944 / -2,122 | +17,989 | P,M,K |
| 67 | `rsi_60m_60_into_short_fixed12h` | 278/75 | -4,337 / -3,341 | -3,889 / -3,618 | +17,946 | P,M,K |
| 68 | `rsi_15m_60_into_short_indicator_or12h` | 812/212 | -4,435 / -7,760 | -2,832 / -3,636 | +17,847 | P,M,K |
| 69 | `rsi_5m_80_back_out_short_indicator_or12h` | 141/30 | -4,563 / -4,319 | -928 / -315 | +17,720 | P,M,K |
| 70 | `rsi_60m_60_into_short_indicator_or12h` | 286/79 | -4,611 / -4,430 | -4,201 / -3,743 | +17,672 | P,M,K |
| 71 | `rsi_30m_70_back_out_short_indicator_or12h` | 154/48 | -4,950 / -3,768 | -2,217 / -1,687 | +17,333 | P,M,K |
| 72 | `rsi_15m_70_into_short_indicator_or12h` | 284/74 | -5,320 / -6,412 | -3,824 / -3,578 | +16,962 | P,M,K |
| 73 | `rsi_15m_80_into_short_fixed12h` | 46/12 | -5,679 / -6,023 | -1,658 / -1,719 | +16,603 | P,M,K |
| 74 | `rsi_15m_80_into_short_indicator_or12h` | 47/12 | -5,867 / -6,438 | -2,100 / -2,151 | +16,416 | P,M,K |
| 75 | `rsi_5m_80_into_short_fixed12h` | 126/23 | -5,956 / -7,013 | -3,471 / -3,627 | +16,326 | P,M,K |
| 76 | `rsi_30m_60_into_short_fixed12h` | 387/103 | -6,167 / -3,880 | -2,500 / -2,546 | +16,116 | P,M,K |
| 77 | `rsi_60m_60_back_out_short_indicator_or12h` | 282/78 | -6,294 / -5,831 | -5,837 / -5,683 | +15,989 | P,M,K |
| 78 | `rsi_60m_70_back_out_short_fixed12h` | 91/26 | -6,317 / -6,435 | -2,113 / -2,574 | +15,966 | P,M,K |
| 79 | `rsi_15m_60_back_out_short_indicator_or12h` | 840/227 | -6,589 / -6,384 | -2,189 / -2,603 | +15,694 | P,M,K |
| 80 | `rsi_30m_center50_short_fixed12h` | 502/123 | -6,667 / -8,449 | -3,778 / -3,669 | +15,615 | P,M,K |
| 81 | `rsi_5m_70_into_short_fixed12h` | 463/118 | -6,681 / -7,749 | -5,272 / -5,625 | +15,602 | P,M,K |
| 82 | `rsi_30m_70_into_short_fixed12h` | 153/49 | -7,044 / -6,833 | -1,970 / -1,961 | +15,239 | P,M,K |
| 83 | `rsi_60m_70_into_short_fixed12h` | 98/28 | -7,049 / -7,040 | -2,803 / -3,272 | +15,233 | P,M,K |
| 84 | `rsi_240m_center50_short_fixed12h` | 137/30 | -7,069 / -6,052 | -3,544 / -3,197 | +15,214 | P,M,K |
| 85 | `rsi_15m_80_back_out_short_fixed12h` | 46/12 | -7,134 / -6,882 | -1,950 / -2,016 | +15,148 | P,M,K |
| 86 | `rsi_60m_70_back_out_short_indicator_or12h` | 91/26 | -7,232 / -7,068 | -2,555 / -2,824 | +15,050 | P,M,K |
| 87 | `rsi_15m_80_back_out_short_indicator_or12h` | 47/12 | -7,451 / -7,468 | -2,315 / -2,230 | +14,831 | P,M,K |
| 88 | `rsi_30m_70_into_short_indicator_or12h` | 155/49 | -7,669 / -7,484 | -3,152 / -2,793 | +14,614 | P,M,K |
| 89 | `rsi_30m_60_back_out_short_indicator_or12h` | 464/118 | -7,852 / -7,563 | -3,971 / -3,753 | +14,431 | P,M,K |
| 90 | `rsi_60m_70_into_short_indicator_or12h` | 98/28 | -8,053 / -7,443 | -3,418 / -3,743 | +14,230 | P,M,K |
| 91 | `rsi_5m_70_back_out_short_indicator_or12h` | 823/221 | -8,152 / -9,897 | -2,609 / -2,471 | +14,130 | P,M,K |
| 92 | `rsi_15m_70_back_out_short_fixed12h` | 253/66 | -8,234 / -7,762 | -4,958 / -4,881 | +14,049 | P,M,K |
| 93 | `rsi_15m_70_into_short_fixed12h` | 261/65 | -8,308 / -9,627 | -5,018 / -5,852 | +13,975 | P,M,K |
| 94 | `rsi_5m_80_back_out_short_fixed12h` | 126/23 | -8,601 / -8,036 | -3,653 / -3,662 | +13,682 | P,M,K |
| 95 | `rsi_15m_60_back_out_short_fixed12h` | 534/136 | -8,605 / -9,409 | -8,048 / -7,510 | +13,678 | P,M,K |
| 96 | `rsi_5m_70_back_out_short_fixed12h` | 465/118 | -10,059 / -11,606 | -4,862 / -4,803 | +12,224 | P,M,K |
| 97 | `rsi_30m_60_back_out_short_fixed12h` | 384/99 | -10,275 / -8,507 | -3,663 / -3,136 | +12,008 | P,M,K |
| 98 | `rsi_60m_60_back_out_short_fixed12h` | 268/75 | -10,407 / -8,523 | -7,350 / -6,868 | +11,876 | P,M,K |
| 99 | `rsi_5m_60_into_short_fixed12h` | 710/182 | -11,933 / -11,634 | -5,227 / -4,500 | +10,350 | P,M,K |
| 100 | `rsi_60m_center50_short_fixed12h` | 358/84 | -12,522 / -15,192 | -5,635 / -5,963 | +9,761 | P,M,K |
| 101 | `rsi_5m_60_into_short_indicator_or12h` | 2449/642 | -14,146 / -18,931 | -5,250 / -5,932 | +8,137 | P,M,K |
| 102 | `rsi_5m_center50_short_fixed12h` | 773/198 | -14,932 / -20,128 | -8,103 / -10,944 | +7,351 | P,C,M,K |
| 103 | `rsi_15m_center50_short_fixed12h` | 647/162 | -16,643 / -14,619 | -7,665 / -6,465 | +5,640 | P,M,K |
| 104 | `rsi_15m_60_into_long_fixed12h` | 521/125 | +8,458 / +8,563 | +3,775 / +3,473 | +5,154 | C,M |
| 105 | `rsi_5m_70_into_long_fixed12h` | 463/106 | +8,388 / +9,291 | +5,067 / +5,549 | +5,083 | M |
| 106 | `rsi_30m_70_into_long_fixed12h` | 149/38 | +7,205 / +6,968 | +3,349 / +2,874 | +3,901 | C,M |
| 107 | `rsi_30m_60_into_long_indicator_or12h` | 449/101 | +7,161 / +4,669 | +1,596 / +1,234 | +3,857 | C,M |
| 108 | `rsi_30m_70_into_long_indicator_or12h` | 150/38 | +6,995 / +6,149 | +3,078 / +2,882 | +3,690 | C,M |
| 109 | `rsi_5m_60_into_long_fixed12h` | 709/178 | +6,173 / +3,120 | +3,381 / +1,641 | +2,868 | C,M,K |
| 110 | `rsi_60m_60_into_long_fixed12h` | 262/62 | +5,741 / +4,496 | +1,317 / +881 | +2,436 | C,M |
| 111 | `rsi_5m_60_back_out_short_fixed12h` | 713/182 | -19,862 / -19,392 | -7,695 / -7,762 | +2,420 | P,M,K |
| 112 | `rsi_15m_60_into_long_indicator_or12h` | 809/189 | +5,353 / +3,606 | -75 / -980 | +2,048 | P,C,M,K |
| 113 | `rsi_240m_center50_long_fixed12h` | 136/31 | +5,336 / +5,807 | +1,528 / +1,269 | +2,032 | C,M |
| 114 | `rsi_5m_70_back_out_long_fixed12h` | 463/107 | +5,155 / +5,440 | +4,688 / +4,225 | +1,851 | C,M |
| 115 | `rsi_60m_60_into_long_indicator_or12h` | 269/64 | +5,016 / +5,177 | +2,103 / +1,458 | +1,712 | C,M |
| 116 | `rsi_5m_60_back_out_short_indicator_or12h` | 2517/664 | -20,709 / -21,772 | -7,461 / -6,942 | +1,573 | P,M,K |
| 117 | `rsi_15m_70_into_long_fixed12h` | 232/59 | +4,493 / +4,761 | +2,919 / +2,553 | +1,188 | C,M |
| 118 | `rsi_5m_90_into_long_indicator_or12h` | 5/1 | +4,448 / +7,832 | +81 / +106 | +1,144 | S,C,M |
| 119 | `rsi_5m_70_into_long_indicator_or12h` | 800/185 | +3,710 / +1,910 | +1,298 / +1,257 | +405 | C,M,K |
| 120 | `rsi_30m_60_back_out_long_indicator_or12h` | 452/104 | +3,640 / +2,603 | -364 / -699 | +335 | P,C,M,K |
| 121 | `rsi_30m_70_back_out_long_indicator_or12h` | 150/37 | +3,568 / +3,620 | +1,490 / +1,350 | +263 | C,M |
| 122 | `rsi_5m_90_into_long_fixed12h` | 5/1 | +3,479 / +7,116 | -505 / -494 | +175 | S,P,C,M,K |
| 123 | `rsi_60m_70_into_long_fixed12h` | 87/16 | +3,014 / +3,149 | -298 / +72 | -290 | P,C,M,K |
| 124 | `rsi_30m_70_back_out_long_fixed12h` | 149/37 | +2,972 / +3,662 | +1,729 / +1,804 | -333 | C,M |
| 125 | `rsi_5m_80_into_long_indicator_or12h` | 118/22 | +2,970 / +1,761 | +570 / +495 | -335 | C,M |
| 126 | `rsi_5m_80_into_long_fixed12h` | 107/20 | +2,663 / +1,621 | +556 / +556 | -642 | C,M |
| 127 | `rsi_15m_80_into_long_fixed12h` | 35/8 | +2,656 / +2,530 | +852 / +531 | -649 | S,C,M |
| 128 | `rsi_15m_70_into_long_indicator_or12h` | 256/63 | +2,407 / +1,332 | +2,357 / +2,064 | -897 | C,M,K |
| 129 | `rsi_60m_70_into_long_indicator_or12h` | 87/16 | +2,328 / +1,995 | -530 / -196 | -977 | P,C,M,K |
| 130 | `rsi_15m_70_back_out_long_fixed12h` | 233/58 | +2,287 / +2,011 | +675 / +236 | -1,018 | C,M,K |
| 131 | `rsi_60m_70_back_out_long_fixed12h` | 81/16 | +2,144 / +861 | +141 / +162 | -1,160 | C,M,K |
| 132 | `rsi_60m_center50_long_fixed12h` | 348/84 | +1,915 / +2,594 | +2,570 / +2,449 | -1,389 | C,M,K |
| 133 | `rsi_5m_80_back_out_long_indicator_or12h` | 118/22 | +1,508 / +1,044 | +438 / +314 | -1,796 | C,M,K |
| 134 | `rsi_5m_center50_long_fixed12h` | 772/197 | +1,368 / +4,942 | +2,295 / +6,529 | -1,937 | C,M,K |
| 135 | `rsi_15m_80_into_long_indicator_or12h` | 35/8 | +1,344 / +1,128 | +383 / +115 | -1,960 | S,C,M |
| 136 | `rsi_5m_90_back_out_long_indicator_or12h` | 5/1 | +1,331 / +1,265 | +81 / +62 | -1,973 | S,C,M |
| 137 | `rsi_15m_80_back_out_long_fixed12h` | 35/8 | +1,092 / +687 | +236 / +144 | -2,212 | S,C,M |
| 138 | `rsi_15m_70_back_out_long_indicator_or12h` | 256/62 | +1,059 / -108 | +611 / +372 | -2,245 | P,C,M,K |
| 139 | `rsi_240m_70_into_long_fixed12h` | 28/8 | +988 / +1,157 | +1,286 / +1,332 | -2,317 | S,C,M |
| 140 | `rsi_240m_70_into_long_indicator_or12h` | 28/8 | +988 / +1,157 | +1,286 / +1,332 | -2,317 | S,C,M |
| 141 | `rsi_30m_80_into_long_fixed12h` | 15/1 | +882 / +736 | -515 / -533 | -2,422 | S,P,C,M,K |
| 142 | `rsi_30m_80_into_long_indicator_or12h` | 15/1 | +848 / +603 | -515 / -533 | -2,457 | S,P,C,M,K |
| 143 | `rsi_5m_60_back_out_long_fixed12h` | 702/178 | +606 / -589 | +3,274 / +2,516 | -2,699 | P,C,M,K |
| 144 | `rsi_60m_70_back_out_long_indicator_or12h` | 81/16 | +531 / +122 | -395 / -341 | -2,773 | P,C,M,K |
| 145 | `rsi_5m_80_back_out_long_fixed12h` | 107/20 | +455 / +152 | +507 / +472 | -2,849 | C,M,K |
| 146 | `rsi_240m_70_back_out_long_fixed12h` | 27/8 | +359 / +489 | +20 / +44 | -2,945 | S,C,M,K |
| 147 | `rsi_240m_80_back_out_long_fixed12h` | 2/0 | +204 / +238 | 0 / 0 | -3,101 | S,P,C,M,K |
| 148 | `rsi_240m_80_back_out_long_indicator_or12h` | 2/0 | +204 / +238 | 0 / 0 | -3,101 | S,P,C,M,K |
| 149 | `rsi_60m_80_into_long_fixed12h` | 8/2 | +173 / 0 | -333 / -554 | -3,131 | S,P,C,M,K |
| 150 | `rsi_60m_80_into_long_indicator_or12h` | 8/2 | +173 / 0 | -333 / -554 | -3,131 | S,P,C,M,K |
| 151 | `rsi_240m_80_into_long_fixed12h` | 2/0 | +160 / +95 | 0 / 0 | -3,144 | S,P,C,M,K |
| 152 | `rsi_240m_80_into_long_indicator_or12h` | 2/0 | +160 / +95 | 0 / 0 | -3,144 | S,P,C,M,K |
| 153 | `rsi_5m_90_back_out_long_fixed12h` | 5/1 | +159 / +423 | -527 / -539 | -3,146 | S,P,C,M,K |
| 154 | `rsi_15m_90_back_out_long_indicator_or12h` | 1/0 | +97 / +78 | 0 / 0 | -3,207 | S,P,C,M,K |
| 155 | `rsi_15m_80_back_out_long_indicator_or12h` | 35/8 | +58 / -380 | -119 / -203 | -3,246 | S,P,C,M,K |
| 156 | `rsi_5m_95_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 157 | `rsi_5m_95_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 158 | `rsi_5m_95_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 159 | `rsi_5m_95_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 160 | `rsi_15m_95_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 161 | `rsi_15m_95_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 162 | `rsi_15m_95_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 163 | `rsi_15m_95_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 164 | `rsi_30m_90_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 165 | `rsi_30m_90_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 166 | `rsi_30m_90_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 167 | `rsi_30m_90_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 168 | `rsi_30m_95_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 169 | `rsi_30m_95_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 170 | `rsi_30m_95_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 171 | `rsi_30m_95_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 172 | `rsi_60m_90_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 173 | `rsi_60m_90_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 174 | `rsi_60m_90_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 175 | `rsi_60m_90_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 176 | `rsi_60m_95_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 177 | `rsi_60m_95_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 178 | `rsi_60m_95_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 179 | `rsi_60m_95_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 180 | `rsi_240m_90_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 181 | `rsi_240m_90_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 182 | `rsi_240m_90_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 183 | `rsi_240m_90_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 184 | `rsi_240m_95_into_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 185 | `rsi_240m_95_into_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 186 | `rsi_240m_95_back_out_long_fixed12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 187 | `rsi_240m_95_back_out_long_indicator_or12h` | 0/0 | 0 / 0 | 0 / 0 | -3,305 | S,P,C,M,K |
| 188 | `rsi_15m_60_back_out_long_indicator_or12h` | 831/192 | -10 / -37 | -1,746 / -1,698 | -3,315 | P,C,M,K |
| 189 | `rsi_15m_90_into_long_indicator_or12h` | 1/0 | -41 / -52 | 0 / 0 | -3,346 | S,P,C,M,K |
| 190 | `rsi_15m_90_back_out_long_fixed12h` | 1/0 | -143 / -173 | 0 / 0 | -3,448 | S,P,C,M,K |
| 191 | `rsi_240m_70_back_out_long_indicator_or12h` | 27/8 | -166 / +33 | +20 / +44 | -3,470 | S,P,C,M,K |
| 192 | `rsi_15m_90_into_long_fixed12h` | 1/0 | -212 / -240 | 0 / 0 | -3,517 | S,P,C,M,K |
| 193 | `rsi_240m_60_back_out_long_fixed12h` | 86/18 | -564 / -1,075 | -1,286 / -1,210 | -3,869 | P,C,M,K |
| 194 | `rsi_60m_80_back_out_long_fixed12h` | 7/1 | -721 / -749 | -317 / -317 | -4,026 | S,P,C,M,K |
| 195 | `rsi_60m_80_back_out_long_indicator_or12h` | 7/1 | -721 / -749 | -317 / -317 | -4,026 | S,P,C,M,K |
| 196 | `rsi_60m_60_back_out_long_fixed12h` | 254/63 | -739 / -1,173 | -451 / -726 | -4,043 | P,C,M,K |
| 197 | `rsi_15m_60_back_out_long_fixed12h` | 518/122 | -959 / +444 | +469 / +1,057 | -4,263 | P,C,M,K |
| 198 | `rsi_60m_60_back_out_long_indicator_or12h` | 269/65 | -1,312 / -1,487 | +68 / +388 | -4,616 | P,C,M,K |
| 199 | `rsi_30m_80_back_out_long_indicator_or12h` | 15/1 | -1,456 / -1,138 | -593 / -565 | -4,760 | S,P,C,M,K |
| 200 | `rsi_240m_60_back_out_long_indicator_or12h` | 87/18 | -1,470 / -1,805 | -987 / -849 | -4,775 | P,C,M,K |
| 201 | `rsi_30m_80_back_out_long_fixed12h` | 15/1 | -1,668 / -1,374 | -593 / -565 | -4,973 | S,P,C,M,K |
| 202 | `rsi_30m_60_into_long_fixed12h` | 374/82 | -1,808 / +254 | -1,467 / -1,069 | -5,112 | P,C,M,K |
| 203 | `rsi_240m_60_into_long_fixed12h` | 90/18 | -2,381 / -1,598 | -1,404 / -940 | -5,685 | P,C,M,K |
| 204 | `rsi_5m_70_back_out_long_indicator_or12h` | 802/185 | -2,742 / -3,512 | +45 / -262 | -6,046 | P,C,M,K |
| 205 | `rsi_30m_center50_long_fixed12h` | 504/124 | -2,744 / -3,709 | +4,407 / +4,275 | -6,049 | P,C,M,K |
| 206 | `rsi_240m_60_into_long_indicator_or12h` | 90/18 | -2,789 / -1,965 | -1,404 / -940 | -6,093 | P,C,M,K |
| 207 | `rsi_15m_center50_long_fixed12h` | 647/157 | -4,468 / -3,613 | +4,725 / +3,537 | -7,772 | P,C,M,K |
| 208 | `rsi_30m_60_back_out_long_fixed12h` | 371/89 | -5,522 / -4,627 | -2,447 / -1,859 | -8,827 | P,C,M,K |
| 209 | `rsi_5m_60_into_long_indicator_or12h` | 2415/619 | -7,995 / -13,166 | -847 / -1,595 | -11,299 | P,C,M,K |
| 210 | `rsi_5m_60_back_out_long_indicator_or12h` | 2489/636 | -16,703 / -18,385 | -4,750 / -5,601 | -20,008 | P,C,M,K |

## Appendix B. Raw top-five monthly deltas (sparse shorts, not candidates)

For completeness, these preserve monthly checks for the **raw** rank top-five,
not just the descriptive long shortlist. R1/R2 are 4h recovery<90 fixed12h /
RSI50-or-12h; R3 is5m into>=90 /RSI50-or-12h; R4/R5 are4h into>=90 fixed12h /
RSI50-or-12h. R1/R2 and R4/R5 have identical outcomes here because the indicator
exit never changes their one observed trade. Each cell is **PnL (delta)**.

### Raw top-five full / 0m

| Month | Short clock $ | R1/R2 $ (delta) | R3 $ (delta) | R4/R5 $ (delta) |
|---|---:|---:|---:|---:|
| 2025-07 | -1,203 | 0 (+1,203) | 0 (+1,203) | 0 (+1,203) |
| 2025-08 | -1,876 | 0 (+1,876) | 0 (+1,876) | 0 (+1,876) |
| 2025-09 | -1,211 | 0 (+1,211) | 0 (+1,211) | 0 (+1,211) |
| 2025-10 | -894 | 0 (+894) | 0 (+894) | 0 (+894) |
| 2025-11 | +1,970 | 0 (-1,970) | 0 (-1,970) | 0 (-1,970) |
| 2025-12 | +1,212 | 0 (-1,212) | 0 (-1,212) | 0 (-1,212) |
| 2026-01 | -3,149 | +505 (+3,654) | 0 (+3,149) | +2 (+3,151) |
| 2026-02 | -1,111 | 0 (+1,111) | 0 (+1,111) | 0 (+1,111) |
| 2026-03 | -2,521 | 0 (+2,521) | 0 (+2,521) | 0 (+2,521) |
| 2026-04 | -1,628 | 0 (+1,628) | 0 (+1,628) | 0 (+1,628) |
| 2026-05 | -7,161 | 0 (+7,161) | 0 (+7,161) | 0 (+7,161) |
| 2026-06 | -64 | 0 (+64) | +41 (+104) | 0 (+64) |
| 2026-07 | +1,259 | 0 (-1,259) | 0 (-1,259) | 0 (-1,259) |
| 2026-08 | -5,675 | 0 (+5,675) | +30 (+5,705) | 0 (+5,675) |
| 2026-09 | -231 | 0 (+231) | 0 (+231) | 0 (+231) |

### Raw top-five full / +1m

| Month | Short clock $ | R1/R2 $ (delta) | R3 $ (delta) | R4/R5 $ (delta) |
|---|---:|---:|---:|---:|
| 2025-07 | -1,271 | 0 (+1,271) | 0 (+1,271) | 0 (+1,271) |
| 2025-08 | -2,120 | 0 (+2,120) | 0 (+2,120) | 0 (+2,120) |
| 2025-09 | -1,056 | 0 (+1,056) | 0 (+1,056) | 0 (+1,056) |
| 2025-10 | -880 | 0 (+880) | 0 (+880) | 0 (+880) |
| 2025-11 | +2,037 | 0 (-2,037) | 0 (-2,037) | 0 (-2,037) |
| 2025-12 | +1,267 | 0 (-1,267) | 0 (-1,267) | 0 (-1,267) |
| 2026-01 | -3,378 | +504 (+3,882) | 0 (+3,378) | +20 (+3,398) |
| 2026-02 | -1,335 | 0 (+1,335) | 0 (+1,335) | 0 (+1,335) |
| 2026-03 | -2,588 | 0 (+2,588) | 0 (+2,588) | 0 (+2,588) |
| 2026-04 | -1,564 | 0 (+1,564) | 0 (+1,564) | 0 (+1,564) |
| 2026-05 | -7,132 | 0 (+7,132) | 0 (+7,132) | 0 (+7,132) |
| 2026-06 | -139 | 0 (+139) | -0 (+139) | 0 (+139) |
| 2026-07 | +1,252 | 0 (-1,252) | 0 (-1,252) | 0 (-1,252) |
| 2026-08 | -5,680 | 0 (+5,680) | +176 (+5,856) | 0 (+5,680) |
| 2026-09 | -139 | 0 (+139) | 0 (+139) | 0 (+139) |

### Raw top-five recent / 0m

| Month | Short clock $ | R1/R2 $ (delta) | R3 $ (delta) | R4/R5 $ (delta) |
|---|---:|---:|---:|---:|
| 2026-05 | -5,175 | 0 (+5,175) | 0 (+5,175) | 0 (+5,175) |
| 2026-06 | -64 | 0 (+64) | +41 (+104) | 0 (+64) |
| 2026-07 | +1,259 | 0 (-1,259) | 0 (-1,259) | 0 (-1,259) |
| 2026-08 | -5,675 | 0 (+5,675) | +30 (+5,705) | 0 (+5,675) |
| 2026-09 | -231 | 0 (+231) | 0 (+231) | 0 (+231) |

### Raw top-five recent / +1m

| Month | Short clock $ | R1/R2 $ (delta) | R3 $ (delta) | R4/R5 $ (delta) |
|---|---:|---:|---:|---:|
| 2026-05 | -5,099 | 0 (+5,099) | 0 (+5,099) | 0 (+5,099) |
| 2026-06 | -191 | 0 (+191) | -0 (+191) | 0 (+191) |
| 2026-07 | +1,330 | 0 (-1,330) | 0 (-1,330) | 0 (-1,330) |
| 2026-08 | -5,753 | 0 (+5,753) | +176 (+5,929) | 0 (+5,753) |
| 2026-09 | -218 | 0 (+218) | 0 (+218) | 0 (+218) |
