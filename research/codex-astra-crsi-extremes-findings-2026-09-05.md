# CRSI extremes standalone findings — September 5, 2026 UTC

## TL;DR

- **The expanded tests change the CRSI assessment.** Fifteen-minute oversold longs are materially stronger than the old 1h recross 20 rule. Into <=5: **+$11,044 full / +$6,603 recent**, n=142 / 33 completed trades; back above 5: **+$8,684 / +$6,272**, same counts. Both remain positive with +1m execution delay and extra modeled costs.
- **There is a real risk/profit trade-off, not a free upgrade.** Waiting for recovery lowers full-window adverse DD from 15.46% to 8.68%, but gives up $2,360 profit. Immediate entry's largest winner first loses $4,187 gross intratrade during the October crash. Results are standalone, before funding, not an increase to the ladder.
- **No live change or automatic promotion.** All 18 tested shorts lose in both windows/delays. 0/36 passes the complete strict I01 screen, principally because useful longs still miss some clock-baseline recovery months. This does not erase their positive results or reject CRSI as an indicator family. All 152 cases passed independent signal, execution and accounting verification.

## 1. Frozen question and comparisons

User-approved **I02** returns to standalone stage 2: 15m/30m/1h x upper 80/90/95
and mirrored lower 20/10/5 x into/back-out x long/short =36 definitions.
34 new, two repeated from I01. One fixed 12h exit from actual entry for every
rule; no TP/SL, sizing, exit-horizon, ladder, pulse/S/R or indicator combination
search. [Frozen card](../research-inputs/indicators/crsi-extremes-2026-09-05.json).

| Window | Exact UTC period | Status |
|---|---|---|
| Full | 2025-07-01 00:00 to 2026-09-04 19:01 | Previously mined, about 431 days |
| Recent | 2026-05-17 20:43 to 2026-09-04 19:01 | Previously mined, about 110 days; overlaps full |
| Indicator seed | 2025-06-01 00:00 | Fixed for all cases, no sliding reseed |

Do not add the two window PnLs or counts. Historical publication/receipt timing
is not recovered by repairing candles: finalized bar-end availability is an
explicit zero-lag model, with +1m sensitivity applied to **both entry and exit**.
Use the final completed selected-timeframe bar, never the forming bar or its
future wick. Research CRSI is unrounded (3,2,strict-less prior 100 return rank);
this study does not silently replace the different legacy live CRSI.

All financial tables use **$10,000 fixed entry notional, $32,000 initial equity**,
one independent position at a time, 0.055% fee on actual notional each side.
No compounding, leverage amplification or averaging. Cash earns $0.
Reported wins/losses are after trading fees; **do not subtract fees again**.
Open inventory reserves a hypothetical closing fee and is not counted as a
completed trade. Funding is excluded because settlement history is incomplete.

**Baseline is not the Martingale ladder.** It is the same-side rolling 12h
clock from I01, with near-continuous exposure. It starts at the next 00/12 UTC
and rolls after every timeout fill. It is not exposure/frequency matched.
The long buy-and-hold context is +$11,511 full / +$8,383 recent, with fixed
initial quantity and therefore changing notional, before funding. These CRSI
results do not establish superiority to every passive or risk-matched baseline.

Signal definitions: `into <=5` means previous CRSI>5, current<=5, then buy;
`back >5` means previous<=5, current>5, then buy. Shorts mirror this at 95.
One crossing per completed bar. Signals during an open/pending trade are
ignored, not queued; after closing, a fresh crossing is required.

## 2. Wins versus losses, with baseline

Zero-delay next-open execution. Whole-dollar rounding only in this document;
full precision stays in artifacts. Breakevens are zero in these displayed cases.
Total net = winning dollars + losing dollars + open mark.

### Full: July 1, 2025 to September 4, 2026 19:01 UTC

| Setup | Closed W / L | Winning dollars | Losing dollars | Open mark | Total net | Delta vs clock | Adverse DD |
|---|---|---|---|---|---|---|---|
| Clock long baseline | 420 / 441 | +$110,950 | -$107,401 | -$245 | +$3,305 | baseline | 33.09% |
| 1h long back >20 | 218 / 230 | +$56,442 | -$55,913 | +$49 | +$578 | -$2,726 | 23.01% |
| 15m long into <=10 | 201 / 198 | +$57,670 | -$45,512 | +$43 | +$12,202 | +$8,898 | 18.91% |
| 15m long into <=5 | 74 / 68 | +$26,201 | -$15,291 | +$134 | +$11,044 | +$7,740 | 15.46% |
| 15m long back >5 | 74 / 68 | +$23,334 | -$14,813 | +$163 | +$8,684 | +$5,380 | 8.68% |

### Recent: May 17, 2026 20:43 to September 4, 2026 19:01 UTC

| Setup | Closed W / L | Winning dollars | Losing dollars | Open mark | Total net | Delta vs clock | Adverse DD |
|---|---|---|---|---|---|---|---|
| Clock long baseline | 114 / 105 | +$29,120 | -$23,837 | -$245 | +$5,038 | baseline | 12.94% |
| 1h long back >20 | 53 / 58 | +$13,376 | -$13,497 | +$49 | -$71 | -$5,110 | 15.37% |
| 15m long into <=10 | 51 / 45 | +$13,459 | -$10,038 | +$43 | +$3,465 | -$1,574 | 6.45% |
| 15m long into <=5 | 21 / 12 | +$8,698 | -$2,230 | +$134 | +$6,603 | +$1,564 | 4.05% |
| 15m long back >5 | 22 / 11 | +$8,055 | -$1,946 | +$163 | +$6,272 | +$1,233 | 4.00% |

The strongest full-window profit among longs is 15m into<=10, but it trails
the recent clock baseline. This is why selecting solely by the full-period
total would be misleading. The <=5 pair has lower frequency, stronger recent
results and less exposure: approximately 16.5% of full-window time /15.2% recent,
versus nearly 100% for the clock. Its lower gross losses partly reflect taking
far fewer trades, not a proven improvement to every trade or ladder episode.

Full <=5 into: average winner $354 / average loser-$225, profit factor 1.71.
Back-out: $315 / -$218, profit factor 1.58. Recent: into 21W/12L and PF 3.90;
back-out 22W/11L and PF 4.14. Higher recent win rates are observations on 33 trades,
not a promised forward rate.

## 3. Delay and cost sensitivity

Additional stress is 5 bps **each side** on the same path, including marked
closing turnover; it is not a rerun with queue/spread-dependent fills.

| Setup / period | 0m net | 0m + extra cost | 1m net | 1m + extra cost | 0m / 1m DD |
|---|---|---|---|---|---|
| Clock long baseline / full | +$3,305 | -$5,322 | +$3,792 | -$4,815 | 33.09% / 33.53% |
| Clock long baseline / recent | +$5,038 | +$2,835 | +$5,104 | +$2,910 | 12.94% / 13.14% |
| 15m long into <=5 / full | +$11,044 | +$9,608 | +$10,773 | +$9,337 | 15.46% / 15.16% |
| 15m long into <=5 / recent | +$6,603 | +$6,259 | +$6,222 | +$5,878 | 4.05% / 4.06% |
| 15m long back >5 / full | +$8,684 | +$7,249 | +$7,744 | +$6,309 | 8.68% / 9.31% |
| 15m long back >5 / recent | +$6,272 | +$5,928 | +$6,023 | +$5,680 | 4.00% / 3.98% |
| 15m long into <=10 / full | +$12,202 | +$8,194 | +$10,174 | +$6,197 | 18.91% / 19.63% |
| 15m long into <=10 / recent | +$3,465 | +$2,492 | +$2,614 | +$1,642 | 6.45% / 6.98% |

Eight of 18 long definitions are positive in both windows/both delays. Seven
survive extra cost everywhere. All six 15m long definitions are in that
cost-surviving set; the seventh is 1h into<=10, whose recent profit is tiny.
Only three longs also beat the same-side clock everywhere:15m into<=20,
15m into<=5, and 15m back>5. They still do not pass the all-month screen.

## 4. Month-by-month: avoided loss versus missed upside

These are **monthly marked-equity changes**, including floating inventory and
fees when incurred. They differ from assigning every trade entirely to its
exit month. September 2026 is partial; recent May 2026 starts May 17 20:43.

### Full / zero delay

| UTC month | Clock net | Into <=5 net | Delta | Back >5 net | Delta |
|---|---|---|---|---|---|
| 2025-07 | -$161 | +$700 | +$861 | +$295 | +$457 |
| 2025-08 | +$510 | +$1,725 | +$1,215 | +$1,569 | +$1,058 |
| 2025-09 | -$109 | -$817 | -$708 | -$672 | -$562 |
| 2025-10 | -$470 | +$1,198 | +$1,668 | +$333 | +$804 |
| 2025-11 | -$3,287 | -$31 | +$3,256 | -$231 | +$3,056 |
| 2025-12 | -$2,574 | +$40 | +$2,614 | +$131 | +$2,705 |
| 2026-01 | +$1,782 | -$563 | -$2,345 | -$484 | -$2,266 |
| 2026-02 | -$122 | +$1,500 | +$1,622 | +$982 | +$1,104 |
| 2026-03 | +$1,155 | +$1,224 | +$69 | +$867 | -$288 |
| 2026-04 | +$307 | -$766 | -$1,073 | -$789 | -$1,096 |
| 2026-05 | +$5,789 | +$2,348 | -$3,442 | +$2,388 | -$3,401 |
| 2026-06 | -$1,256 | +$3,414 | +$4,670 | +$2,819 | +$4,075 |
| 2026-07 | -$2,621 | -$348 | +$2,273 | +$4 | +$2,625 |
| 2026-08 | +$4,306 | +$1,158 | -$3,148 | +$1,224 | -$3,082 |
| 2026-09 | +$55 | +$262 | +$207 | +$248 | +$193 |

### Recent / zero delay

| UTC month | Clock net | Into <=5 net | Delta | Back >5 net | Delta |
|---|---|---|---|---|---|
| 2026-05 | +$4,554 | +$2,116 | -$2,438 | +$1,976 | -$2,578 |
| 2026-06 | -$1,256 | +$3,414 | +$4,670 | +$2,819 | +$4,075 |
| 2026-07 | -$2,621 | -$348 | +$2,273 | +$4 | +$2,625 |
| 2026-08 | +$4,306 | +$1,158 | -$3,148 | +$1,224 | -$3,082 |
| 2026-09 | +$55 | +$262 | +$207 | +$248 | +$193 |

The <=5 rules improve June and July 2026 relative to clock, but miss much of
August's more continuous recovery. Across the full window they also
underperform clock in September 2025, January 2026, April 2026 and May 2026.
Back-out additionally lags in March 2026. This is the invisible upside cost:
the benchmark stays invested in recoveries when the selective rule is flat.

Example: full May 2026 clock+$5,789 versus into+$2,348 / back-out+$2,388;
August clock+$4,306 versus+$1,158 /+$1,224. Those missed dollars are material,
even while the complete study remains positive.

## 5. Tail exposure hidden inside winning trades

Read-only reconstruction from the verified trade inventories and repaired
minute tape reproduces the reported drawdowns; no additional strategy was run.

| Full-window rule | Maximum account DD / dollars | Trough |
|---|---|---|
| Into<=5, zero delay | 15.46% / $5,380 | 2025-10-10 21:21 UTC |
| Into<=5, +1m | 15.16% / $5,265 | Same crash wick |
| Back>5, zero delay | 8.68% / $3,001 | 2026-01-21 17:37 UTC |
| Back>5, +1m | 9.31% / $3,182 | Same accumulated drawdown |

Immediate entry on 2025-10-10 at 21:15 buys $35.753; six minutes later the
recorded minute low is $20.784. On $10k entry notional that is
**-$4,186.78 gross floating / -41.87% price excursion**. Yet its 12h exit
finishes+$1,241.91, the rule's largest zero-delay winning trade.
+1m entry still sees approximately-$4,050.50 gross floating.

Recovery entry arrives 21:45 at $39.241, after that low; this corresponding
trade still sees-$864.15 gross floating and only realizes+$341.75.
This explains much of the drawdown gap, but is **one influential crash event**,
not proof that waiting always prevents a cascade. The maximum back-out DD
occurs later, after accumulated losses; its worst single-trade adverse loss
is instead approximately-$1,088.74 on June 4,2026, before closing-$777.80.

This model funds a single $10k position inside $32k equity and never models
exchange liquidation or shared collateral. Closed profit cannot certify
survival for an isolated highly leveraged implementation or another concurrent
ladder. Do not transplant the old live short's25x/$25k settings into this result.

Evidence concentration also matters: each <=5 rule has 142 full/33 recent closes;
most full months have 6–14 trades. The five largest winners account for 52.35%
of into's closed net and 58.29% of back-out's closed net. Removing those five
arithmetically still leaves+$5,199 /+$3,554 closed net, respectively; that is
a concentration diagnostic, not an achievable modified strategy or fresh test.

## 6. Every tested setup — not only the attractive ones

All cells are after trading fees/before funding; n=completed trades. The order
within each side follows the frozen full/zero-delay delta-vs-clock ranking,
equivalent to net ranking within that side. Keep the clock row for each side.

### Longs

| Setup | Full 0m net (n) | Full +1m net (n) | Recent 0m net (n) | Recent +1m net (n) |
|---|---|---|---|---|
| Clock long baseline | +$3,305 (861) | +$3,792 (859) | +$5,038 (219) | +$5,104 (218) |
| 15m long into <=10 | +$12,202 (399) | +$10,174 (396) | +$3,465 (96) | +$2,614 (96) |
| 15m long into <=5 | +$11,044 (142) | +$10,773 (142) | +$6,603 (33) | +$6,222 (33) |
| 15m long back >20 | +$10,111 (708) | +$7,710 (694) | +$6,703 (179) | +$5,033 (176) |
| 15m long back >5 | +$8,684 (142) | +$7,744 (142) | +$6,272 (33) | +$6,023 (33) |
| 15m long into <=20 | +$7,553 (704) | +$8,360 (694) | +$5,797 (179) | +$5,332 (176) |
| 15m long back >10 | +$7,272 (398) | +$7,262 (397) | +$1,577 (96) | +$1,642 (96) |
| 30m long into <=10 | +$4,731 (251) | +$5,112 (247) | +$9 (56) | -$332 (55) |
| 1h long into <=20 | +$4,223 (451) | +$3,460 (435) | +$3,844 (112) | +$3,028 (109) |
| 30m long into <=20 | +$2,895 (599) | -$1,691 (579) | -$968 (146) | +$835 (143) |
| 30m long back >10 | +$2,631 (253) | +$2,374 (247) | -$847 (56) | -$577 (54) |
| 1h long back >10 | +$2,479 (139) | +$2,416 (139) | +$40 (35) | -$82 (35) |
| 1h long into <=10 | +$1,538 (139) | +$2,316 (138) | +$446 (35) | +$552 (34) |
| 1h long back >20 | +$578 (448) | +$321 (435) | -$71 (111) | +$374 (108) |
| 30m long back >20 | -$735 (602) | +$2,907 (584) | -$1,512 (147) | -$111 (143) |
| 1h long into <=5 | -$755 (30) | -$574 (30) | -$881 (5) | -$818 (5) |
| 1h long back >5 | -$801 (30) | -$893 (30) | -$504 (5) | -$514 (5) |
| 30m long into <=5 | -$915 (72) | -$798 (72) | -$1,226 (13) | -$1,307 (13) |
| 30m long back >5 | -$2,877 (73) | -$2,905 (73) | -$1,784 (13) | -$1,793 (13) |

### Shorts

| Setup | Full 0m net (n) | Full +1m net (n) | Recent 0m net (n) | Recent +1m net (n) |
|---|---|---|---|---|
| Clock short baseline | -$22,283 (861) | -$22,726 (859) | -$9,887 (219) | -$9,930 (218) |
| 30m short into >=90 | -$845 (252) | -$1,006 (250) | -$2,817 (61) | -$2,873 (61) |
| 1h short back <95 | -$1,619 (36) | -$1,449 (35) | -$2,510 (10) | -$2,223 (9) |
| 1h short into >=95 | -$1,808 (36) | -$1,626 (36) | -$2,360 (10) | -$2,370 (10) |
| 30m short back <90 | -$3,321 (255) | -$3,017 (252) | -$4,374 (62) | -$3,988 (62) |
| 1h short back <90 | -$4,008 (154) | -$4,240 (150) | -$2,551 (41) | -$2,705 (41) |
| 1h short into >=80 | -$4,172 (463) | -$5,984 (443) | -$3,704 (118) | -$2,947 (112) |
| 30m short into >=95 | -$5,025 (83) | -$5,313 (83) | -$1,530 (21) | -$1,737 (21) |
| 15m short back <95 | -$5,314 (139) | -$4,750 (138) | -$3,335 (30) | -$2,513 (29) |
| 15m short into >=95 | -$6,253 (139) | -$5,812 (138) | -$3,565 (30) | -$3,137 (29) |
| 30m short back <95 | -$6,550 (83) | -$6,699 (83) | -$1,600 (21) | -$1,771 (21) |
| 1h short into >=90 | -$6,623 (155) | -$6,784 (151) | -$2,480 (40) | -$2,774 (40) |
| 1h short back <80 | -$8,816 (462) | -$7,583 (441) | -$3,041 (121) | -$2,763 (113) |
| 15m short into >=80 | -$10,816 (713) | -$12,554 (695) | -$10,136 (178) | -$9,584 (173) |
| 30m short into >=80 | -$12,037 (604) | -$17,629 (582) | -$4,783 (155) | -$6,040 (150) |
| 30m short back <80 | -$13,033 (599) | -$14,921 (580) | -$3,998 (156) | -$3,815 (152) |
| 15m short into >=90 | -$15,828 (394) | -$16,140 (389) | -$6,256 (96) | -$6,055 (95) |
| 15m short back <90 | -$16,123 (394) | -$15,240 (391) | -$4,693 (96) | -$4,646 (96) |
| 15m short back <80 | -$16,848 (715) | -$17,226 (698) | -$10,583 (177) | -$7,705 (175) |

**All 18 short rules lose in both windows and both delays.** This rejects these
exact contrarian extreme entries with a12h hold as positive standalone shorts
on this history. It does not reject different exits, momentum-following CRSI,
regime-conditioned shorts, other thresholds/timeframes or combinations that
were not tested. No such extra definitions were run here.

The 1h <=5 long pair has only five recent closes, so its full 30-trade sample
does not provide enough recent evidence. Neither call that conclusive
family rejection nor promote it based on a tiny cohort.

## 7. Frozen screen and ranking audit

The unchanged I01 screen requires positive net and clock improvement in both
windows/delays, >=30 full/10 recent closes, every monthly marked delta>=0, positive
extra-cost stress, and no exhausted equity. **0/36 passes all conditions.**
This stringent screen is retained, not silently loosened after seeing the result.

| Useful long rule | Failed conditions |
|---|---|
| 15m long into <=10 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 15m long into <=5 | monthly_regression_vs_clock |
| 15m long back >20 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 15m long back >5 | monthly_regression_vs_clock |
| 15m long into <=20 | monthly_regression_vs_clock |

This is positive exploratory evidence for a specific long signal, but no
current-ladder upgrade or deployment candidate. The three rules passing all
aggregate/cost/sample comparisons only fail the no-month-worse requirement;
that is a real opportunity-cost trade-off, not an absence of profit.

The frozen **cross-side** clock-delta ranking mechanically puts five losing
shorts first because the short clock loses $22,283 full. Preserve that audit
ranking but do not confuse "less bad than always short" with alpha:

| Rank | Definition | Full 0m net | Full 0m delta vs short clock | Worst monthly delta, all cases |
|---|---|---|---|---|
| R1 | 30m short into >=90 | -$845 | +$21,437 | -$1,752 |
| R2 | 1h short back <95 | -$1,619 | +$20,664 | -$2,037 |
| R3 | 1h short into >=95 | -$1,808 | +$20,475 | -$2,037 |
| R4 | 30m short back <90 | -$3,321 | +$18,961 | -$1,930 |
| R5 | 1h short back <90 | -$4,008 | +$18,275 | -$2,304 |

### Required top-five monthly delta audit: full / zero delay

| UTC month | Short clock net | R1 delta | R2 delta | R3 delta | R4 delta | R5 delta |
|---|---|---|---|---|---|---|
| 2025-07 | -$1,203 | +$512 | +$204 | +$411 | +$399 | +$1,339 |
| 2025-08 | -$1,876 | +$1,029 | +$2,262 | +$2,060 | +$1,452 | +$2,610 |
| 2025-09 | -$1,211 | +$1,101 | +$1,364 | +$1,530 | +$1,722 | +$979 |
| 2025-10 | -$894 | +$1,120 | +$486 | +$693 | +$1,124 | +$905 |
| 2025-11 | +$1,970 | -$425 | -$1,970 | -$1,970 | -$895 | -$1,656 |
| 2025-12 | +$1,212 | +$1,437 | -$1,189 | -$1,249 | +$714 | -$2,234 |
| 2026-01 | -$3,149 | +$1,514 | +$3,330 | +$2,976 | +$1,098 | +$1,827 |
| 2026-02 | -$1,111 | +$1,760 | +$2,834 | +$2,731 | +$2,142 | +$1,827 |
| 2026-03 | -$2,521 | +$3,347 | +$2,231 | +$2,555 | +$2,730 | +$2,586 |
| 2026-04 | -$1,628 | +$2,480 | +$2,270 | +$2,389 | +$2,527 | +$2,004 |
| 2026-05 | -$7,161 | +$4,653 | +$5,750 | +$5,043 | +$4,085 | +$5,268 |
| 2026-06 | -$64 | +$1,013 | -$304 | -$162 | +$367 | -$198 |
| 2026-07 | +$1,259 | -$1,683 | -$1,657 | -$1,674 | -$1,827 | -$1,364 |
| 2026-08 | -$5,675 | +$3,378 | +$5,153 | +$5,293 | +$3,086 | +$4,465 |
| 2026-09 | -$231 | +$202 | -$100 | -$152 | +$237 | -$83 |

### Required top-five monthly delta audit: full / +1m

| UTC month | Short clock net | R1 delta | R2 delta | R3 delta | R4 delta | R5 delta |
|---|---|---|---|---|---|---|
| 2025-07 | -$1,271 | +$621 | +$320 | +$457 | +$173 | +$1,827 |
| 2025-08 | -$2,120 | +$1,590 | +$2,495 | +$2,318 | +$1,830 | +$3,145 |
| 2025-09 | -$1,056 | +$522 | +$1,189 | +$1,398 | +$1,738 | +$800 |
| 2025-10 | -$880 | +$1,395 | +$481 | +$649 | +$1,141 | +$951 |
| 2025-11 | +$2,037 | -$660 | -$2,037 | -$2,037 | -$982 | -$1,721 |
| 2025-12 | +$1,267 | +$1,582 | -$1,297 | -$1,282 | +$643 | -$2,304 |
| 2026-01 | -$3,378 | +$1,486 | +$3,503 | +$3,222 | +$1,293 | +$1,997 |
| 2026-02 | -$1,335 | +$2,048 | +$3,024 | +$3,027 | +$2,554 | +$977 |
| 2026-03 | -$2,588 | +$3,295 | +$2,352 | +$2,674 | +$2,588 | +$2,843 |
| 2026-04 | -$1,564 | +$2,351 | +$2,186 | +$2,335 | +$2,412 | +$2,035 |
| 2026-05 | -$7,132 | +$5,139 | +$5,725 | +$5,106 | +$4,393 | +$5,320 |
| 2026-06 | -$139 | +$765 | -$215 | -$128 | +$589 | -$237 |
| 2026-07 | +$1,252 | -$1,674 | -$1,613 | -$1,682 | -$1,852 | -$1,394 |
| 2026-08 | -$5,680 | +$3,168 | +$5,366 | +$5,296 | +$3,016 | +$4,423 |
| 2026-09 | -$139 | +$92 | -$202 | -$252 | +$173 | -$177 |

### Required top-five monthly delta audit: recent / zero delay

| UTC month | Short clock net | R1 delta | R2 delta | R3 delta | R4 delta | R5 delta |
|---|---|---|---|---|---|---|
| 2026-05 | -$5,175 | +$4,160 | +$4,285 | +$4,221 | +$3,649 | +$4,515 |
| 2026-06 | -$64 | +$1,013 | -$304 | -$162 | +$367 | -$198 |
| 2026-07 | +$1,259 | -$1,683 | -$1,657 | -$1,674 | -$1,827 | -$1,364 |
| 2026-08 | -$5,675 | +$3,378 | +$5,153 | +$5,293 | +$3,086 | +$4,465 |
| 2026-09 | -$231 | +$202 | -$100 | -$152 | +$237 | -$83 |

### Required top-five monthly delta audit: recent / +1m

| UTC month | Short clock net | R1 delta | R2 delta | R3 delta | R4 delta | R5 delta |
|---|---|---|---|---|---|---|
| 2026-05 | -$5,099 | +$4,581 | +$4,245 | +$4,202 | +$3,891 | +$4,485 |
| 2026-06 | -$191 | +$817 | -$163 | -$76 | +$641 | -$185 |
| 2026-07 | +$1,330 | -$1,752 | -$1,691 | -$1,760 | -$1,930 | -$1,472 |
| 2026-08 | -$5,753 | +$3,241 | +$5,439 | +$5,368 | +$3,089 | +$4,496 |
| 2026-09 | -$218 | +$170 | -$123 | -$174 | +$251 | -$99 |

## 8. Timing trace, reproduction and verification

The first actual <=5 entries illustrate the closed-bar contract:

- 15m long into <=5: previous bar 2025-07-01T05:00:00.000Z, CRSI 9.81691580; current bar 2025-07-01T05:15:00.000Z, CRSI 4.86037037. Final value available at 2025-07-01T05:30:00.000Z; next-open entry $38.700 at 2025-07-01T05:30:00.000Z.
- 15m long back >5: previous bar 2025-07-01T05:15:00.000Z, CRSI 4.86037037; current bar 2025-07-01T05:30:00.000Z, CRSI 14.48541962. Final value available at 2025-07-01T05:45:00.000Z; next-open entry $38.644 at 2025-07-01T05:45:00.000Z.

Entry price precision in the ledgers is unrounded. The trace does not inspect
that entry minute's high/low/close to decide or choose its fill. Both cases exit
12h after the actual fill; delayed runs additionally delay the timeout action.

- 16 old-overlap cases reproduce saved I01 stats, monthly rows and full ledgers
before new-grid outcomes: two old CRSI definitions plus two clocks x four cases.
- 9 actual-data feature-prefix checks (three per timeframe) and 36 engine-prefix
checks (one per rule) pass.
- 663,541 continuous source minutes;44,236 completed 15m,22,118 completed 30m and
11,059 completed 1h bars. Eleven repaired source minutes remain an explicit
overlay; raw archives and live files were not modified.
- Independent audit passed **152 cases,32,068 trade rows,1,520 monthly rows**.
It independently reconstructs CRSI, every eligible crossing/occupied skip,
terminal pending actions, minute-open fills, fees, full-minute drawdown,
monthly equity and 16 saved overlaps. Counts across overlapping cases are not
counts of independent market events.
- Tests:11 closed-timing groups,12 feature-math groups,17 old-engine groups,
10 new CRSI groups; main and VPS typechecks pass. New runner and verifier
also type-load under ts-node, because ordinary builds do not include scripts.
- Old pinned study source remains byte-for-byte unchanged. Initial parity
preflight stopped on IEEE negative-zero versus its JSON-serialized zero;
saved-ledger comparison now uses the exact JSON representation. Strict
new-versus-old engine comparison remains intact; no financial value changed.

[Engineering/reproduction guide](../docs/research/crsi-extremes-study.md).
Accepted local directory:
`backtests/hype/hype-crsi-extremes-2026-09-05/`.
Read `manifest.json`, `overlap-parity.json`, `validation.json` and independent
`verification.json` before using `summary.csv`, `results.json`,
`monthly.csv`, `monthly.json`, `trades.jsonl`, `ranking.json` or traces.
Incomplete/failed folders are not certified evidence. This pass has one
accepted result set and no additional parameter search.

## 9. Decision after these results

**Keep 15m CRSI<=5/recovery>5 on the research shortlist.** For the next bounded
standalone investigation, recovery>5 is the primary risk-conscious candidate;
into<=5 is its profit/risk comparator. That is a research priority, not a
declaration that one is universally optimal or safe live.

First establish that the same profitable cohort has survivable entry-to-exit
risk and holds up in fresh observations; retain both controls when discussing
a limited exit study. Only after that should a separately approved stage test
whether this signal changes ladder decisions usefully, with the unchanged
ladder beside it. Do not add the standalone PnL to ladder PnL: opportunity
overlap, collateral and correlated losses have not been replayed together.

No next test, new thresholds, shadow process, combination, live config change,
commit or push was undertaken automatically. The user's next decision should
be based on the above profit/loss and path-risk evidence.
