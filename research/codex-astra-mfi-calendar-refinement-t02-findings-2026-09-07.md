# T02: MFI replacement trades, nearby UTC exclusions and hold sensitivity

September 7, 2026. Research only; no live strategy/config/state changes, commit or push.

## TL;DR

- **Replacement trades explain the original benefit, not a losing-hour blacklist.** Full immediate: 68 removed baseline trades made **$1,635**, while 31 newly enabled trades made **$4,676**, a **+$3,041** change. Recent: 19 removed made **$1,816**, 12 new made **$2,826**, a **+$1,010** change. The excluded baseline trades themselves were profitable.
- **There is no broad, timing-insensitive result yet.** At 12h, excluding 15–19 improves both windows/delays; 17–21 loses recent profit. Keeping 16–20, the 13h variant improves its own baseline, but 11h hurts it. One May 26 episode contributes $994 of the original $1,010 recent improvement.
- **0/5 reviewed filters passes the unchanged complete profit, defense or strict-clock screen.** Retain 15–19/12h, original 16–20/12h and 16–20/13h as historical research leads with explicit failures, not deployable winners. All **64 logical cases** independently verified; **12 archived controls** reproduced exactly before new variants.

## 1. Exact comparison contract

| Item | Frozen choice |
|---|---|
| Full evaluation | **2025-07-01 00:00 → 2026-09-04 19:01 UTC** |
| Recent evaluation | **2026-05-17 20:43 → 2026-09-04 19:01 UTC**, starts flat |
| Relationship | Recent overlaps full; neither is a new holdout |
| Entry | Fully closed 15m MFI7 crosses **below 10**: previous signed value >=−0.8, current <−0.8 |
| Position | One independent long, fixed **$10,000 notional**, $32,000 reference equity |
| Exit | 11/12/13h from actual fill, as labeled; no TP, SL, ladder or compounding |
| Costs | 0.055% each side; additional fixed-path stress of 5bps each side |
| Execution | Minute open; either 0m or +1m delay on **both** entry and exit |
| Calendar | Original signal UTC time, start inclusive/end exclusive; failed signal discarded, not queued |
| Source | Same accepted T01 snapshot; 663,541 continuous repaired minute bars from June 1, 2025 |
| Accounting | After modeled fees, **before funding**; mark cutoff-open inventory separately |

These are **standalone strategy dollars, not improvements to the current live
Martingale ladder or combined account**. MFI is candle typical-price/volume
flow, not Hyperliquid's actual taker flow. No HL/S/R condition was added.

All five reviewed filters are shown below. Only four are new. Each changed
hold has its **own identical unfiltered MFI baseline**; comparing an 11h
filtered rule only with the old 12h baseline would confound exit and calendar.

| ID | Hold | Excluded UTC signals | Correct baseline |
|---|---:|---|---|
| T01-05, repeated | 12h | 16:00–20:00 | MFI12 |
| T02-01 | 12h | 15:00–19:00 | MFI12 |
| T02-02 | 12h | 17:00–21:00 | MFI12 |
| T02-03 | 11h | 16:00–20:00 | MFI11 |
| T02-04 | 13h | 16:00–20:00 | MFI13 |

No clock×hold cross-product or extra hour search was run.

## 2. Baseline-first wins, losses and net

Dollar amounts rounded for display; exact ledgers retained. DD is peak-to-
minute-adverse equity drawdown on the $32k reference account, not a $10k
notional loss percentage. Winning/losing dollars are **completed trades**.
For 13h, one cutoff-open trade contributes −$98 immediate or −$92 with delay
to both parent and filtered net; it is not counted as a completed loss.

### Full period — immediate fills

| Setup | Trades (W / L) | Winning $ | Losing $ | Open mark | Net | Δ own baseline | DD |
|---|---|---|---|---|---|---|---|
| 12h baseline: no exclusion | 441 (228 / 213) | $59,815 | -$46,703 | $0 | $13,112 | — | 10.19% |
| 12h / exclude 16–20 (original) | 404 (213 / 191) | $58,096 | -$41,943 | $0 | $16,153 | +$3,041 | 8.98% |
| 12h / exclude 15–19 | 402 (220 / 182) | $59,574 | -$40,814 | $0 | $18,760 | +$5,648 | 9.12% |
| 12h / exclude 17–21 | 404 (205 / 199) | $56,283 | -$43,108 | $0 | $13,176 | +$64 | 10.71% |
| 11h baseline: no exclusion | 459 (239 / 220) | $60,023 | -$47,294 | $0 | $12,729 | — | 12.23% |
| 11h / exclude 16–20 | 418 (214 / 204) | $55,894 | -$44,126 | $0 | $11,768 | -$961 | 12.69% |
| 13h baseline: no exclusion | 424 (224 / 200) | $58,667 | -$45,663 | -$98 | $12,906 | — | 10.76% |
| 13h / exclude 16–20 | 390 (204 / 186) | $57,189 | -$42,273 | -$98 | $14,818 | +$1,911 | 9.70% |

### Recent period — immediate fills

| Setup | Trades (W / L) | Winning $ | Losing $ | Open mark | Net | Δ own baseline | DD |
|---|---|---|---|---|---|---|---|
| 12h baseline: no exclusion | 106 (56 / 50) | $13,556 | -$9,599 | $0 | $3,957 | — | 7.18% |
| 12h / exclude 16–20 (original) | 99 (53 / 46) | $13,675 | -$8,708 | $0 | $4,968 | +$1,010 | 5.86% |
| 12h / exclude 15–19 | 96 (52 / 44) | $13,186 | -$8,504 | $0 | $4,683 | +$725 | 5.51% |
| 12h / exclude 17–21 | 97 (51 / 46) | $12,673 | -$8,826 | $0 | $3,847 | -$110 | 6.03% |
| 11h baseline: no exclusion | 110 (61 / 49) | $13,171 | -$9,261 | $0 | $3,910 | — | 6.89% |
| 11h / exclude 16–20 | 103 (56 / 47) | $12,150 | -$8,802 | $0 | $3,348 | -$562 | 5.94% |
| 13h baseline: no exclusion | 100 (54 / 46) | $13,361 | -$9,538 | -$98 | $3,724 | — | 6.17% |
| 13h / exclude 16–20 | 94 (52 / 42) | $13,737 | -$9,132 | -$98 | $4,507 | +$782 | 5.94% |

### Ranking by the weaker full-period increment across both execution delays

| Rank / setup | Full Δ 0m / +1m | Recent Δ 0m / +1m | Worst monthly Δ | Complete screen |
|---|---|---|---|---|
| 1. T02-01 | +$5,648 / +$5,913 | +$725 / +$854 | -$534.21 | Fail |
| 2. T01-05 | +$3,041 / +$4,175 | +$1,010 / +$1,183 | -$525.07 | Fail |
| 3. T02-04 | +$1,911 / +$2,059 | +$782 / +$854 | -$546.99 | Fail |
| 4. T02-02 | +$64 / +$1,114 | -$110 / -$43 | -$1,317.88 | Fail |
| 5. T02-03 | -$961 / -$56 | -$562 / -$504 | -$1,094.73 | Fail |

The earlier 15–19 exclusion has the highest full-period net, but **less recent
net than the original 16–20 exclusion**: $4,683 versus $4,968 immediate.
It also has slightly worse full DD than the original: 9.12% versus 8.98%.
There is not one setup dominating all outcomes.

### What answers questions 2 and 3?

**Clock boundary:** moving one hour earlier helps; moving one hour later
largely erases the full immediate increment (+$64) and reduces recent net
at both delays (−$110/−$43). The original result therefore does **not**
survive small changes in both directions. This does not prove which hour
causes price movement: filtering changes subsequent one-position occupancy.

**Hold length:** 13h preserves a positive calendar increment in all four
comparisons. 11h loses $961 full / $562 recent immediate, and $56 / $504
with +1m delays, relative to its own 11h baseline. So the result is not
unique to exactly 12h, but it is materially hold-sensitive. These are full
path replays: changing the hold can change later entries, not merely the
exit price of the original trades.

## 3. What distinguishes the original replacement trades?

T01-05, 16–20 exclusion / 12h. Trades match by exact signal timestamp;
there is no nearest-neighbor pairing or assumption of one-for-one replacement.
Common trades must match entry, exit, quantity and net exactly.

### Full immediate cohort accounting

| Cohort | Trades | W / L | Winning $ | Losing $ | Net |
|---|---|---|---|---|---|
| Whole baseline | 441 | 228 / 213 | $59,815 | -$46,703 | $13,112 |
| Unchanged trades | 373 | 191 / 182 | $52,081 | -$40,605 | $11,477 |
| Removed directly by clock | 62 | 34 / 28 | $6,901 | -$5,619 | $1,282 |
| Removed by later occupancy | 6 | 3 / 3 | $833 | -$480 | $353 |
| All removed baseline trades | 68 | 37 / 31 | $7,733 | -$6,099 | $1,635 |
| Newly enabled trades | 31 | 22 / 9 | $6,015 | -$1,339 | $4,676 |

### Recent immediate cohort accounting

| Cohort | Trades | W / L | Winning $ | Losing $ | Net |
|---|---|---|---|---|---|
| Whole baseline | 106 | 56 / 50 | $13,556 | -$9,599 | $3,957 |
| Unchanged trades | 87 | 43 / 44 | $10,823 | -$8,682 | $2,141 |
| Removed directly by clock | 17 | 11 / 6 | $2,369 | -$917 | $1,452 |
| Removed by later occupancy | 2 | 2 / 0 | $364 | $0 | $364 |
| All removed baseline trades | 19 | 13 / 6 | $2,733 | -$917 | $1,816 |
| Newly enabled trades | 12 | 10 / 2 | $2,852 | -$26 | $2,826 |

The full path removes **$7,733 of winning trades** and avoids **$6,099 of
losing trades**. New trades add **$6,015 of winners** and **$1,339 of losers**.
That reconciles the total change without ignoring either sacrificed wins
or newly incurred losses.

All 31 full immediate new trades arose at genuine fresh MFI crossings while
the unfiltered parent was still occupied. They fall between **20:00 and
06:59 UTC** in this sample: 16 between 20:00–23:59, 15 between 00:00–06:59.
This is a consequence of skipping afternoon inventory; it is not a tested
rule to buy those hours indiscriminately. Six otherwise eligible baseline
trades were then displaced by the new inventory.

Mean net per completed trade: full baseline $29.73, removed $24.04, new
$150.84. New win rate is 22/31 =71.0%, versus 37/68 =54.4% for removed trades.
Recent new trades are 10W/2L, versus removed 13W/6L. They are **small,
ex-post selected cohorts**, not independent estimates of a future win rate.

### Entry-state descriptors, known before entry

| Pre-entry median | Full baseline n441 | Full removed n68 | Full new n31 | Recent baseline n106 | Recent removed n19 | Recent new n12 |
|---|---|---|---|---|---|---|
| MFI7 | 6.811 | 6.456 | 6.547 | 7.242 | 7.204 | 5.100 |
| RSI14_15m | 38.640 | 35.693 | 37.862 | 38.858 | 35.650 | 37.076 |
| CRSI_15m | 21.727 | 20.007 | 26.635 | 24.192 | 17.150 | 26.101 |
| ADX14_15m | 22.187 | 23.048 | 21.896 | 24.545 | 22.321 | 21.727 |
| ATRpct_15m | 0.701 | 0.802 | 0.709 | 0.667 | 0.938 | 0.742 |
| RVOL20_15m | 1.327 | 1.220 | 1.039 | 1.304 | 1.318 | 0.800 |
| closed_return_15m | -0.244 | -0.335 | -0.184 | -0.200 | -0.369 | -0.214 |
| closed_return_1h | -0.980 | -1.290 | -0.700 | -0.837 | -1.446 | -0.851 |
| closed_return_4h | -1.180 | -1.758 | -0.779 | -1.459 | -1.950 | -0.616 |
| closed_15m_range_location | 0.383 | 0.417 | 0.604 | 0.453 | 0.505 | 0.327 |

Return and ATR fields are percent; RVOL is a ratio; range location is 0–1
within the just-completed 15m high/low. All fields use closed data available
at the signal, not values at the eventual profitable exit.

The new cohort generally enters after **less severe trailing 1h/4h weakness
and lower relative volume** than the removed cohort, with similar MFI
extremes. That is consistent with a later, less intense dip, but **does not
identify a validated extra filter**. Important counterexamples:

- Full new winners versus losers have nearly identical median RSI14
  (37.96 / 37.31) and 1h return (−0.64% / −0.71%).
- Full new losers actually have a higher median close-in-range than winners
  (0.687 / 0.494); a superficially stronger close is not sufficient.
- Recent close-in-range moves the opposite way from the full cohort:
  new median 0.327 versus removed 0.505. No universal candle-recovery shape.
- Recent new losers number only **two**. Their elevated median RVOL is not
  enough evidence for a threshold; the best full new winner had RVOL 3.21.

Quartiles, missing counts and separate winning/losing descriptor cohorts
are retained in the artifact, including +1m cases. No thresholds were fitted.

### Concrete inventory chains, good and bad

All timestamps below are UTC, immediate model; next-day dates explicit.

| Episode | Removed baseline trade(s) | Newly enabled trade | Net change |
|---|---|---|---:|
| May 26, 2026 | 16:15 at $62.295 → May 27 04:15 at $59.937: **−$389.31** | 21:45 at $59.409 → May 27 09:45 at $63.067: **+$604.39** | **+$993.71** |
| Oct 22, 2025 | 17:45 at $35.826 → Oct 23 05:45 at $37.667: **+$502.59** | 21:15 at $35.221 → Oct 23 09:15 at $38.886: **+$1,029.00** | **+$526.41** |
| June 5–7, 2026 | June 5 19:00 trade **+$384.44**, plus June 6 15:15 trade **+$62.20** later displaced | June 6 04:45 at $57.944 → 16:45 at $57.925: **−$14.28** | **−$460.92** |
| Dec 8–9, 2025 | Dec 8 19:00 **−$447.59**, plus Dec 9 09:45 **−$27.22** later displaced | Dec 8 23:30 at $29.442 → Dec 9 11:30 at $28.106: **−$464.52** | **+$10.29** |

The June chain shows why merely summing skipped trades is wrong: the new
position is still held at 15:15 and prevents a later profitable entry.
The December new trade is the largest full-period replacement loss; waiting
for a later crossing did not prevent a bad trade.

Causal trace for May 26: the 16:15 decision uses the 16:00–16:15 MFI bar,
is rejected on the clock alone, and is discarded. The 21:45 crossing uses
the **21:30–21:45 closed bar**, after the gate reopens; it is not a queued
16:15 signal. The parent skips it because its 16:15 trade remains open until
04:15. At +1m, decisions remain at these timestamps, entry and exit fills
shift independently by one minute, and the hold still starts at actual entry.

## 4. Concentration: much of the increment rests on a few episodes

An episode groups connected, overlapping changed-trade inventory intervals,
including subsequent displaced entries. Removing an episode below is
**ex-post arithmetic sensitivity, not another executable replay**.

| Window / delay | Increment | Without best episode | Without best 3 episodes | Without 3 largest new winners |
|---|---|---|---|---|
| full / 0m | +$3,041 | +$2,048 | +$504 | +$718 |
| full / 1m | +$4,175 | +$3,116 | +$1,637 | +$1,776 |
| recent / 0m | +$1,010 | +$17 | -$1,017 | -$703 |
| recent / 1m | +$1,183 | +$123 | -$908 | -$593 |

Full immediate: the best three episodes (May 26, December 17 and May 21)
contribute $2,538, **83.4% of the $3,041 increment**. The increment remains
+$504 without them, but is substantially smaller. Removing the three
largest newly enabled winners instead leaves +$718.

Recent immediate: the best single episode contributes $994, **98.4% of
the $1,010 increment**. Without it the difference is +$17; without the
best three episodes it is −$1,017. This concentration persists with +1m
delay, although the exact dollar amounts differ.

On the full marked monthly ledger, October 2025 and May 2026 contribute
+$1,096 and +$1,551: **87.0% of the net increment**. These are shares of a
net difference after negative months, not shares of all gross profits.
In the recent window, partial May alone contributes +$1,489—more than the
whole +$1,010 gain. June and August give some back.

Signal-month attribution is saved separately from marked calendar PnL.
For example, original full August's signal-cohort contribution is −$543,
but its marked month difference is −$389 because positions cross month
boundaries. **Use marked months for the stability screen.**

## 5. Month-by-month stability versus the correct baseline

Baseline net is shown explicitly. Filter cells show **net (change versus
its own same-hold baseline)**. September 2026 is partial through the cutoff.
Loss months remain real: every tested setup still loses money in November
2025 in the immediate model.

### Full period, immediate — clock sensitivity at 12h

| UTC month | MFI12 baseline net | T01-05 net (Δ own baseline) | T02-01 net (Δ own baseline) | T02-02 net (Δ own baseline) |
|---|---|---|---|---|
| 2025-07 | $988 | $822 (-$166) | $1,295 (+$307) | $639 (-$349) |
| 2025-08 | $1,683 | $1,834 (+$152) | $1,812 (+$129) | $1,482 (-$200) |
| 2025-09 | $1,580 | $1,883 (+$304) | $1,763 (+$183) | $1,119 (-$461) |
| 2025-10 | $2,407 | $3,504 (+$1,096) | $3,504 (+$1,096) | $3,617 (+$1,210) |
| 2025-11 | -$2,229 | -$2,259 (-$30) | -$2,473 (-$244) | -$2,507 (-$278) |
| 2025-12 | $1,356 | $1,817 (+$462) | $2,263 (+$907) | $1,362 (+$6) |
| 2026-01 | -$276 | -$83 (+$193) | $605 (+$881) | -$197 (+$79) |
| 2026-02 | -$747 | -$1,072 (-$324) | -$641 (+$107) | -$789 (-$42) |
| 2026-03 | $3,103 | $3,178 (+$75) | $3,596 (+$492) | $3,166 (+$63) |
| 2026-04 | $889 | $1,097 (+$208) | $1,686 (+$797) | $973 (+$84) |
| 2026-05 | $1,417 | $2,968 (+$1,551) | $2,627 (+$1,210) | $1,975 (+$557) |
| 2026-06 | $1,842 | $1,316 (-$525) | $1,640 (-$202) | $524 (-$1,318) |
| 2026-07 | -$1,194 | -$723 (+$471) | -$642 (+$553) | -$371 (+$824) |
| 2026-08 | $2,590 | $2,201 (-$389) | $2,056 (-$534) | $2,479 (-$111) |
| 2026-09 | -$296 | -$331 (-$35) | -$331 (-$35) | -$296 (+$0) |

### Full period, immediate — own-hold baselines at 11h and 13h

| UTC month | MFI11 baseline net | T02-03 net (Δ own baseline) | MFI13 baseline net | T02-04 net (Δ own baseline) |
|---|---|---|---|---|
| 2025-07 | $1,315 | $936 (-$379) | $1,603 | $1,056 (-$547) |
| 2025-08 | $756 | $1,030 (+$274) | $673 | $636 (-$37) |
| 2025-09 | $918 | $1,139 (+$221) | $363 | -$107 (-$471) |
| 2025-10 | $3,188 | $3,339 (+$151) | $2,803 | $4,136 (+$1,332) |
| 2025-11 | -$2,303 | -$3,153 (-$849) | -$2,056 | -$2,136 (-$80) |
| 2025-12 | $1,622 | $1,551 (-$72) | $567 | $1,318 (+$751) |
| 2026-01 | $189 | $325 (+$135) | $939 | $1,183 (+$244) |
| 2026-02 | $560 | $292 (-$267) | $879 | $692 (-$187) |
| 2026-03 | $1,960 | $1,855 (-$105) | $2,014 | $1,874 (-$140) |
| 2026-04 | $609 | $961 (+$351) | $742 | $920 (+$178) |
| 2026-05 | $780 | $1,417 (+$637) | $2,665 | $3,704 (+$1,039) |
| 2026-06 | $2,040 | $1,615 (-$425) | $925 | $994 (+$69) |
| 2026-07 | -$1,085 | -$618 (+$467) | -$639 | -$407 (+$231) |
| 2026-08 | $2,402 | $1,390 (-$1,012) | $1,642 | $1,276 (-$365) |
| 2026-09 | -$222 | -$311 (-$88) | -$215 | -$320 (-$105) |

For the separately started recent window, **June through September match
the respective full-window rows exactly** in every setup and delay.
Only its partial May differs:

| Case (partial May) | MFI12 | T01-05 | T02-01 | T02-02 | MFI11 | T02-03 | MFI13 | T02-04 |
|---|---|---|---|---|---|---|---|---|
| 0m delay | $1,016 | $2,505 (+$1,489) | $1,959 (+$944) | $1,511 (+$495) | $777 | $1,272 (+$495) | $2,011 | $2,964 (+$953) |
| 1m delay | $965 | $2,515 (+$1,550) | $1,935 (+$970) | $1,456 (+$490) | $797 | $1,383 (+$585) | $1,894 | $2,861 (+$967) |

The earlier 15–19 version is stronger across many full-period months, not
only the previous worst flatten interval. Nevertheless it gives up $534
in August and $425 in November under +1m delay. Its attractive total has
not cured the month-stability failure.

## 6. Unchanged screens and verdict

Every filter has enough trades, positive net, positive extra-cost-stress
net and no modeled equity exhaustion in all four cases. That common good
news is **not** equivalent to passing the entire research contract.

| Setup | Why complete profit screen fails | Additional defense issues |
|---|---|---|
| T02-01, 15–19 / 12h | Monthly Δ below −$320; worst **−$534.21**, Aug 2026 | Full DD improvement below required 20% |
| T01-05, 16–20 / 12h | Monthly Δ below −$320; worst **−$525.07**, June 2026 | Full immediate DD improvement below 20% |
| T02-04, 16–20 / 13h | Monthly Δ below −$320; worst **−$546.99**, July 2025 | Full DD improvement below 20%; exposure-scaled-parent test fails |
| T02-02, 17–21 / 12h | Monthly failure; recent increment negative; full immediate DD worse | Full DD requirement and exposure-scaled test fail |
| T02-03, 16–20 / 11h | Monthly failure; net increment negative; full DD worse | Recent retention <90%; full DD and exposure-scaled tests fail |

All five also fail the separate strict same-hold clock comparison. Changed
11h/13h clock controls are mechanical comparators, not extra alpha candidates.

**Verdict:** historical calendar benefit is credible as a reproduced result,
but neither broadly clock-insensitive nor hold-insensitive. Three exact
settings remain research leads; zero complete qualifiers. Preserve the
negative neighbors instead of presenting the best new total alone.
No universal live-ladder time block, new indicator condition or deployment
is justified by this study.

## 7. Delayed-fill W/L and monthly appendix

Same windows, not new independent market samples. +1m applies to both fills.

### Full +1m

| Setup | Trades (W / L) | Winning $ | Losing $ | Open mark | Net | Δ own baseline | DD |
|---|---|---|---|---|---|---|---|
| 12h baseline: no exclusion | 438 (226 / 212) | $57,742 | -$46,981 | $0 | $10,761 | — | 12.61% |
| 12h / exclude 16–20 (original) | 401 (210 / 191) | $56,735 | -$41,799 | $0 | $14,936 | +$4,175 | 9.76% |
| 12h / exclude 15–19 | 399 (219 / 180) | $57,558 | -$40,884 | $0 | $16,674 | +$5,913 | 11.01% |
| 12h / exclude 17–21 | 400 (203 / 197) | $54,968 | -$43,093 | $0 | $11,875 | +$1,114 | 11.53% |
| 11h baseline: no exclusion | 455 (235 / 220) | $58,521 | -$47,163 | $0 | $11,358 | — | 11.85% |
| 11h / exclude 16–20 | 416 (214 / 202) | $55,350 | -$44,048 | $0 | $11,302 | -$56 | 12.23% |
| 13h baseline: no exclusion | 420 (223 / 197) | $57,584 | -$45,870 | -$92 | $11,622 | — | 11.70% |
| 13h / exclude 16–20 | 386 (205 / 181) | $56,303 | -$42,530 | -$92 | $13,680 | +$2,059 | 10.19% |

### Recent +1m

| Setup | Trades (W / L) | Winning $ | Losing $ | Open mark | Net | Δ own baseline | DD |
|---|---|---|---|---|---|---|---|
| 12h baseline: no exclusion | 105 (57 / 48) | $12,752 | -$9,441 | $0 | $3,311 | — | 7.54% |
| 12h / exclude 16–20 (original) | 98 (54 / 44) | $13,049 | -$8,555 | $0 | $4,494 | +$1,183 | 5.96% |
| 12h / exclude 15–19 | 95 (53 / 42) | $12,507 | -$8,343 | $0 | $4,165 | +$854 | 5.72% |
| 12h / exclude 17–21 | 96 (52 / 44) | $12,007 | -$8,739 | $0 | $3,268 | -$43 | 6.15% |
| 11h baseline: no exclusion | 110 (60 / 50) | $12,929 | -$9,161 | $0 | $3,768 | — | 7.12% |
| 11h / exclude 16–20 | 103 (57 / 46) | $11,975 | -$8,710 | $0 | $3,265 | -$504 | 5.85% |
| 13h baseline: no exclusion | 100 (56 / 44) | $13,089 | -$9,373 | -$92 | $3,624 | — | 6.62% |
| 13h / exclude 16–20 | 94 (54 / 40) | $13,479 | -$8,909 | -$92 | $4,478 | +$854 | 6.03% |

### Full marked months +1m — clock sensitivity

| UTC month | MFI12 baseline net | T01-05 net (Δ own baseline) | T02-01 net (Δ own baseline) | T02-02 net (Δ own baseline) |
|---|---|---|---|---|
| 2025-07 | $638 | $634 (-$5) | $991 (+$353) | $370 (-$268) |
| 2025-08 | $1,351 | $1,612 (+$261) | $1,590 (+$240) | $1,252 (-$98) |
| 2025-09 | $1,456 | $1,710 (+$254) | $1,615 (+$160) | $955 (-$500) |
| 2025-10 | $2,176 | $3,326 (+$1,150) | $3,326 (+$1,150) | $3,410 (+$1,234) |
| 2025-11 | -$2,207 | -$2,296 (-$89) | -$2,631 (-$425) | -$2,439 (-$233) |
| 2025-12 | $467 | $1,453 (+$986) | $1,273 (+$806) | $941 (+$474) |
| 2026-01 | -$709 | -$163 (+$545) | $504 (+$1,213) | -$250 (+$458) |
| 2026-02 | -$392 | -$721 (-$329) | -$353 (+$39) | -$395 (-$4) |
| 2026-03 | $3,427 | $3,411 (-$16) | $3,859 (+$433) | $3,397 (-$29) |
| 2026-04 | $876 | $1,058 (+$182) | $1,690 (+$814) | $945 (+$69) |
| 2026-05 | $1,332 | $2,935 (+$1,602) | $2,580 (+$1,247) | $1,876 (+$543) |
| 2026-06 | $1,443 | $1,010 (-$433) | $1,299 (-$144) | $198 (-$1,245) |
| 2026-07 | -$1,337 | -$867 (+$469) | -$744 (+$593) | -$535 (+$801) |
| 2026-08 | $2,491 | $2,151 (-$340) | $1,990 (-$502) | $2,402 (-$89) |
| 2026-09 | -$252 | -$315 (-$63) | -$315 (-$63) | -$252 (+$0) |

### Full marked months +1m — hold sensitivity

| UTC month | MFI11 baseline net | T02-03 net (Δ own baseline) | MFI13 baseline net | T02-04 net (Δ own baseline) |
|---|---|---|---|---|
| 2025-07 | $1,088 | $752 (-$336) | $1,180 | $776 (-$404) |
| 2025-08 | $649 | $782 (+$132) | $622 | $592 (-$31) |
| 2025-09 | $776 | $1,138 (+$363) | $539 | $20 (-$519) |
| 2025-10 | $2,373 | $3,159 (+$785) | $2,597 | $4,124 (+$1,527) |
| 2025-11 | -$2,062 | -$2,974 (-$912) | -$2,175 | -$2,131 (+$44) |
| 2025-12 | $1,445 | $1,595 (+$149) | $398 | $1,070 (+$672) |
| 2026-01 | $123 | $238 (+$116) | $847 | $1,048 (+$201) |
| 2026-02 | $688 | $446 (-$242) | $757 | $654 (-$103) |
| 2026-03 | $1,920 | $1,877 (-$43) | $1,495 | $1,446 (-$48) |
| 2026-04 | $636 | $933 (+$297) | $970 | $836 (-$134) |
| 2026-05 | $750 | $1,474 (+$723) | $2,662 | $3,629 (+$967) |
| 2026-06 | $1,945 | $1,517 (-$428) | $891 | $934 (+$43) |
| 2026-07 | -$1,156 | -$639 (+$517) | -$792 | -$473 (+$319) |
| 2026-08 | $2,401 | $1,307 (-$1,095) | $1,813 | $1,450 (-$363) |
| 2026-09 | -$220 | -$302 (-$82) | -$183 | -$294 (-$112) |

### Original replacement attribution +1m

Full:

| Cohort | Trades | W / L | Winning $ | Losing $ | Net |
|---|---|---|---|---|---|
| Whole baseline | 438 | 226 / 212 | $57,742 | -$46,981 | $10,761 |
| Unchanged trades | 366 | 186 / 180 | $50,006 | -$40,120 | $9,886 |
| Removed directly by clock | 64 | 36 / 28 | $6,968 | -$6,068 | $900 |
| Removed by later occupancy | 8 | 4 / 4 | $767 | -$793 | -$26 |
| All removed baseline trades | 72 | 40 / 32 | $7,735 | -$6,861 | $875 |
| Newly enabled trades | 35 | 24 / 11 | $6,729 | -$1,679 | $5,050 |

Recent:

| Cohort | Trades | W / L | Winning $ | Losing $ | Net |
|---|---|---|---|---|---|
| Whole baseline | 105 | 57 / 48 | $12,752 | -$9,441 | $3,311 |
| Unchanged trades | 86 | 44 / 42 | $10,048 | -$8,493 | $1,555 |
| Removed directly by clock | 17 | 11 / 6 | $2,382 | -$948 | $1,434 |
| Removed by later occupancy | 2 | 2 / 0 | $322 | $0 | $322 |
| All removed baseline trades | 19 | 13 / 6 | $2,704 | -$948 | $1,756 |
| Newly enabled trades | 12 | 10 / 2 | $3,001 | -$62 | $2,939 |

## 8. Verification, preservation and scope

- Archived T01 MFI12, clock12 and T01-05 reproduce exactly in all four cases:
  **12 saved control cases**, including stats, trades, open marks, monthlies
  and signal outcomes. All three own-hold MFI parents also match the
  inherited standalone engine.
- Independent checker rebuilt MFI7 crossings from raw candles, UTC
  boundaries, occupancy, own-hold timeouts, fees, stress, minute DD, marked
  months, replacement accounting, concentration and screens.
- Verified **64 logical cases**, **20,213 completed ledger rows**,
  **25,948 decision rows**, **640 monthly rows**, and **1,355 changed-trade
  rows**. Counts include reused controls and overlapping windows; they are
  not independent trades or samples.
- New fixtures cover exact clock boundaries, delayed eligibility,
  discarded signals, 11/12/13h timeouts, cutoff inventory, occupancy,
  readiness-only controls and attribution conservation. Eleven real-data
  prefix checks pass; existing 10 entry-context and 14 combination fixture
  groups pass. Full and VPS TypeScript checks pass.
- New closed-return/MFI descriptors are independently recomputed. Other
  existing RSI/CRSI/ADX/ATR/RVOL descriptive values are reconciled to the
  pinned, previously validated feature implementation, not independently
  reimplemented again here.
- Four new filtered definitions + two own-hold MFI parents + two mechanical
  clock controls = **8 new definitions**. Accepted cumulative inventory:
  **5,244 standalone / 45 ladder**. The 44 economic primary cases and
  20 readiness-only logical duplicates are disclosed separately.
- Same frozen tape, thresholds and costs; no new economic reruns after
  results, no crossed clock×hold combinations, HL/S/R filters, long/short
  overlay or ladder transfer. Live files and archived T01 sources unchanged.

[Reproduction/schema](../docs/research/mfi-calendar-refinement-t02.md),
[frozen card](../research-inputs/indicators/time-gating-t02-2026-09-07.json),
[retained evidence snapshot](../research-inputs/indicators/t02-retained-candidates-2026-09-07.json),
[full local artifacts](../backtests/hype/hype-mfi-calendar-refinement-t02-2026-09-07/verification.json).

Accepted manifest SHA256:
`1a31364f2f5f5106d37ab66fff2aebb12439d4c2e306c616c7f434e552ba5505`

Verification SHA256:
`41bd3feebfe05b490abea8d82b12b8d39f776c16f280ff954df38f4d1d563e03`

S01 waiting-confirmation, broader R01 refinements, HL/S/R combinations and
actual ladder transfer remain unrun here and require separate approval.

