# I07 Bollinger standalone findings — September 6, 2026

## TL;DR

- **240 frozen definitions, 968 independently verified cases; 0 complete strict-screen qualifiers.** The descriptive sample/net/delay/extra-cost subset contains 25 long and 2 short definitions. These are correlated research leads, not live approvals.
- **The top five long profit results are dip/reclaim entries, not crash protection.** L1 (15m,50 closes,2 SD, into lower band, midpoint-or-12h) earns **+$10,417 full /+$3,487 recent**, n 427/105, versus long clock **+$3,305 /+$5,038**. All five held October's collapse, with roughly 49–53% gross adverse price excursions. B1, a narrower breakout long, earns **+$5,983 /+$2,062**, n 69/17, historical DD7.17% /4.01%; fewer trades and concentrated winners remain.
- **Only the 4h20/2 downside-breakout entry survives short sample/net/cost checks under both exits.** Fixed 12h earns **+$2,865 /+$907**, n 67/13, versus short clock **-$22,283 /-$9,887**. Full +1m profit falls to +$746, or just +$157 under extra costs. No live/ladder/short-config changes. Next complementary individual study: ADX/DMI, not combinations yet.

## 1. Why this step, and what these dollars mean

After MACD the user delegated the next research direction. We chose the next
documented complementary individual family: **price location and dispersion**.
CRSI/RSI/ROC/MACD already cover several momentum meanings. Combining apparent
winners now would obscure which component contributes. I07 is not a ladder
application and does not reopen the paused live short.

| Item | Frozen convention |
|---|---|
| Full | **2025-07-01 00:00 to 2026-09-04 19:01 UTC** |
| Recent | **2026-05-17 20:43 to 2026-09-04 19:01 UTC**, contained within full |
| Seed | Fixed 2025-06-01 00:00;663,541 continuous minute observations including explicit 11-minute repair overlay |
| Position/account | $10,000 fixed entry notional; $32,000 initial equity; one independent position per rule; no averaging/compounding |
| Trading fees | 0.055% each side, actual executed notional |
| Funding | **Excluded**: complete settlement evidence unavailable; all net figures are before funding |
| Actions | Completed timeframe observation; next minute-open with modeled zero publication lag; separate +1m to every entry AND exit |
| Controls | Same-side rolling12h clock, plus own-entry/fixed 12h companions for midpoint exits |
| Cutoff inventory | Mark with hypothetical closing fee; not a completed trade |
| Extra-cost stress | Additional 5bps per side on the same traded/marked turnover, not a new slippage-path replay |
| DD | Prior close-equity peak to a minute's adverse price, on $32k; no inferred intraminute ordering |

The clock has near-continuous exposure and is **not exposure-matched**. Cash
earns $0. Fixed-initial-quantity long buy/hold context earns +$11,511 full /
+$8,383 recent; its marked notional changes. None of these dollars represents
incremental profit to the Martingale ladder.

Periods and delays overlap. This is previously mined development history,
**not an untouched holdout**. Real historical data-arrival times, funding,
queue/fills, liquidation and shared-account collateral are not certified.
Tables round full precision; W/L dollars already include trading fees.
Net=winning dollars +losing dollars +cutoff open mark.

## 2. Frozen scope and exact meanings

[Card](../research-inputs/indicators/bollinger-standalone-2026-09-06.json) and
[method/reproduction guide](../docs/research/bollinger-standalone-study.md).
5 clocks(5m/15m/30m/1h/4h) ×2 periods(20/50) ×2 SD multipliers(2/3)
×3 entries ×2 sides ×2 exits = **240 new definitions**, no Bollinger repeats.
Four window/delay cases each=960, plus 8 repeated clock controls.

Formula identity: `bollinger-sma-population-sd-v1`. Each completed bar uses
the current-inclusive lastN closes, arithmetic mean, population SD with
denominatorN, upper/lower=mean±K×SD; percentB=(close-lower)/(upper-lower).
PercentB is a fraction,0 lower/1 upper. BandwidthPct is 100×width/mean.
FirstN-1 rows null; zeroSD gives valid zero width but null percentB, preventing
crosses. Two-pass centered variance; no rounding, gap bridge or moving reseed.

20/2 is a reference starting point, not a universal optimum. Our50/2,20/3,
50/3 are sensitivity choices, not equal-containment settings recommended by
the originator. A band tag is not automatically a reversal and prices can
walk a band. [John Bollinger's primary rules](https://www.bollingerbands.com/bollinger-band-rules)

| Mode | Long entry | Short entry |
|---|---|---|
| Breakout | Previous%b<=1, current>1 | Previous%b>=0, current<0 |
| Into/fade | Previous%b>0, current<=0 | Previous%b<1, current>=1 |
| Reclaim | Previous%b<=0, current>0 | Previous%b>=1, current<1 |

Both observations use their own closed bands. A moving band can produce a
long reclaim **while price continues falling**; an explicit regression covers
this. No intrabar touches or future pivots are used.

Exits are 12h from actual fill, or earliest subsequent closed midpoint
condition capped at 12h. For breakout: long close<=middle, short>=middle.
For into/reclaim: long close>=middle, short<=middle. The midpoint moves;
this is not a guaranteed profitable TP. Timeout wins ties, entry-time
observations cannot exit, pending decisions are immutable. Occupied signals
are skipped, not queued; a fresh crossing is required later.

Bandwidth is recorded, **not a squeeze filter**. Not tested: other periods/
widths, EMA bands, persistence/divergence, squeeze/expansion percentiles,
Donchian/Keltner, price TP/SL/trailing/partials, other indicators, HL/S/R,
ladder sizing/gates or portfolio combinations. No blanket family rejection.

## 3. Screens and population

Strict, unchanged:>=30 full/10 recent completed trades in both delays,
positive absolute net AND own-clock delta in all four cases, every monthly
marked delta>=-1e-8, positive extra-cost net and no equity exhaustion.
**0/240 pass.** A monthly opportunity-cost failure is not necessarily an
absolute loss, but all failures remain in the result.

The descriptive subset requires sample/net/extra-cost/solvency in all four,
then ranks full immediate absolute net. It deliberately retains clock/monthly
failures; it is **not a relaxed deployment gate**.

| Side | Definitions | Adequate sample | Positive net all 4 | Negative net all 4 | Descriptive subset |
|---|---|---|---|---|---|
| long | 120 | 102 | 45 | 37 | 25 |
| short | 120 | 106 | 7 | 94 | 2 |

32 definitions are sparse (18long/14short), not disproven by low activity.
Two5m20/2 breakout/midpoint definitions (one each side) exhaust account equity
in at least one diagnostic case; subsequent fixed-notional trades are
diagnostic, not an executable account loss projection.

## 4. Labels and baseline-side-by-side results

L1–L5 are the predeclared descriptive top five by full immediate absolute net.
R1–R5 are the raw top five by full immediate **delta to own-side clock**.
The very bad short clock makes all raw top five shorts; beating it is not
the same as making money. B1 is the highest-full-profit breakout long in
the 27-member descriptive subset, a labeled post-result mechanism contrast,
not an extra rule or separately validated discovery.

| Label | Exact frozen ID |
|---|---|
| Clock long | `clock_long` |
| Clock short | `clock_short` |
| L1 | `bollinger_15m_n50_k2_into_long_indicator_or12h` |
| L2 | `bollinger_5m_n50_k3_into_long_fixed12h` |
| L3 | `bollinger_15m_n50_k2_reclaim_long_indicator_or12h` |
| L4 | `bollinger_60m_n50_k2_into_long_fixed12h` |
| L5 | `bollinger_5m_n50_k3_reclaim_long_fixed12h` |
| R1 | `bollinger_15m_n20_k2_into_short_fixed12h` |
| R2 | `bollinger_240m_n20_k2_breakout_short_fixed12h` |
| R3 | `bollinger_240m_n20_k2_breakout_short_indicator_or12h` |
| R4 | `bollinger_5m_n50_k3_reclaim_short_fixed12h` |
| R5 | `bollinger_5m_n50_k3_into_short_fixed12h` |
| B1 | `bollinger_30m_n20_k3_breakout_long_indicator_or12h` |

### Full: July 1, 2025–September 4, 2026 19:01 UTC — immediate model

| Setup | W/L | Winning $ | Losing $ | Open $ | Net $ | Δ own clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 420/441 | 110,950 | -107,401 | -245 | +3,305 | baseline | 33.09% |
| L1 | 298/129 | 43,106 | -32,654 | -34 | +10,417 | +7,113 | 16.42% |
| L2 | 155/142 | 43,515 | -33,234 | -71 | +10,211 | +6,906 | 18.40% |
| L3 | 294/133 | 37,218 | -28,289 | +56 | +8,985 | +5,681 | 15.36% |
| L4 | 83/61 | 23,660 | -14,813 | +0 | +8,847 | +5,542 | 16.04% |
| L5 | 154/144 | 41,745 | -34,311 | -79 | +7,355 | +4,050 | 19.58% |
| B1 | 35/34 | 12,447 | -6,464 | +0 | +5,983 | +2,679 | 7.17% |
| Clock short | 414/447 | 98,162 | -120,668 | +223 | -22,283 | baseline | 71.27% |
| R1 | 274/250 | 71,935 | -66,356 | +0 | +5,578 | +27,861 | 16.60% |
| R2 | 35/32 | 8,499 | -5,634 | +0 | +2,865 | +25,147 | 12.35% |
| R3 | 35/32 | 8,499 | -5,674 | +0 | +2,824 | +25,107 | 12.37% |
| R4 | 164/159 | 43,177 | -41,928 | +0 | +1,249 | +23,531 | 16.69% |
| R5 | 166/157 | 43,794 | -42,579 | +0 | +1,215 | +23,498 | 15.93% |

### Recent: May 17, 2026 20:43–September 4, 2026 19:01 UTC — immediate model

| Setup | W/L | Winning $ | Losing $ | Open $ | Net $ | Δ own clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 114/105 | 29,120 | -23,837 | -245 | +5,038 | baseline | 12.94% |
| L1 | 74/31 | 9,760 | -6,239 | -34 | +3,487 | -1,552 | 4.90% |
| L2 | 35/37 | 9,905 | -8,504 | -71 | +1,331 | -3,707 | 9.05% |
| L3 | 73/32 | 8,170 | -5,721 | +56 | +2,505 | -2,533 | 5.13% |
| L4 | 22/13 | 7,600 | -3,559 | +0 | +4,041 | -997 | 4.18% |
| L5 | 35/37 | 9,891 | -8,278 | -79 | +1,534 | -3,504 | 9.31% |
| B1 | 9/8 | 3,088 | -1,026 | +0 | +2,062 | -2,976 | 4.01% |
| Clock short | 97/122 | 21,666 | -31,775 | +223 | -9,887 | baseline | 32.54% |
| R1 | 63/67 | 14,636 | -17,334 | +0 | -2,698 | +7,189 | 13.78% |
| R2 | 8/5 | 1,590 | -683 | +0 | +907 | +10,793 | 3.76% |
| R3 | 8/5 | 1,590 | -683 | +0 | +907 | +10,793 | 3.76% |
| R4 | 41/51 | 10,150 | -13,351 | +0 | -3,201 | +6,686 | 12.31% |
| R5 | 44/48 | 9,991 | -13,276 | +0 | -3,285 | +6,602 | 12.32% |

### Visible costs AND missed upside

L1 reduces full DD from 33.09% to 16.42% and recent DD12.94% to 4.90%, but
sacrifices **$1,552 recent profit** to the clock. In full May 2026 it earns only
+$177 versus clock +$5,789 (Δ-$5,612); in August +$1,807 versus +$4,306
(Δ-$2,499). January is an actual-$1,716 loss versus clock +$1,782.
December, April and July also lose absolutely. Good whole-period net does not
eliminate bad months or prove protection for a leveraged ladder.

B1's DD is lower at 7.17% /4.01%, but it earns +$2,062 recent versus +$5,038
clock. Full May opportunity cost is-$4,214 and August-$2,812. It is invested
about 566h full versus 10,339h clock; lower exposure is part of the answer,
not evidence it can protect existing 11-rung inventory.

R1 looks best in raw delta (+$27,861 full versus short clock) yet loses
**-$2,698 recent**. R4/R5 similarly turn full positive net into recent losses.
These exact fades fail stability; that does not reject every countertrend
short or every other Bollinger use.

## 5. Delay, extra costs and exit attribution

Cells are **net $ / extra-cost net $**, before funding. Separate +1m changes
both fills and occupancy; it is not a haircut to an unchanged selected list.

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m |
|---|---|---|---|---|
| Clock long | +3,305 / -5,322 | +3,792 / -4,815 | +5,038 / +2,835 | +5,104 / +2,910 |
| L1 | +10,417 / +6,130 | +9,002 / +4,735 | +3,487 / +2,424 | +3,159 / +2,096 |
| L2 | +10,211 / +7,224 | +8,968 / +5,982 | +1,331 / +600 | +1,296 / +565 |
| L3 | +8,985 / +4,699 | +7,669 / +3,423 | +2,505 / +1,443 | +2,304 / +1,252 |
| L4 | +8,847 / +7,402 | +6,983 / +5,599 | +4,041 / +3,689 | +3,886 / +3,534 |
| L5 | +7,355 / +4,359 | +6,820 / +3,825 | +1,534 / +803 | +1,602 / +871 |
| B1 | +5,983 / +5,290 | +5,945 / +5,251 | +2,062 / +1,891 | +2,132 / +1,961 |
| Clock short | -22,283 / -30,909 | -22,726 / -31,333 | -9,887 / -12,090 | -9,930 / -12,124 |
| R1 | +5,578 / +344 | +5,704 / +500 | -2,698 / -3,999 | -3,324 / -4,615 |
| R2 | +2,865 / +2,197 | +746 / +157 | +907 / +777 | +847 / +717 |
| R3 | +2,824 / +2,156 | +672 / +83 | +907 / +777 | +847 / +717 |
| R4 | +1,249 / -1,979 | +1,163 / -2,065 | -3,201 / -4,122 | -3,613 / -4,535 |
| R5 | +1,215 / -2,012 | +86 / -3,143 | -3,285 / -4,206 | -3,804 / -4,725 |

### Midpoint exit versus its own fixed 12h companion

Recomputes the complete inventory path for each exit, not just selected trade
endings. Cells: fixed 12h net → midpoint net (Δ). These are entry-matched
controls but differing occupancy can change trades.

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m |
|---|---|---|---|---|
| L1 | +7,222 → +10,417 (+3,195) | +7,809 → +9,002 (+1,193) | +4,362 → +3,487 (-876) | +4,441 → +3,159 (-1,282) |
| L3 | +4,792 → +8,985 (+4,193) | +4,774 → +7,669 (+2,896) | +2,556 → +2,505 (-51) | +2,806 → +2,304 (-502) |
| B1 | +4,901 → +5,983 (+1,082) | +4,440 → +5,945 (+1,505) | +2,099 → +2,062 (-37) | +2,018 → +2,132 (+114) |
| R3 | +2,865 → +2,824 (-41) | +746 → +672 (-74) | +907 → +907 (+0) | +847 → +847 (+0) |

L1 midpoint adds +$3,195 full immediate but **loses $876 recent** versus its
own12h exit; with +1m the differences are +$1,193 /-$1,282. Lower recent DD
is a trade-off, not a universal exit upgrade. R2/R3 have identical recent
outcomes; two exits are not two independent short signals.

### Why the narrow short is fragile to one minute

R2 full n 67 falls to 59 with +1m. Of 59 shared signals, altered execution
contributes **-$584**; eight immediate-only trades sum **+$1,534**. Total
full net falls $2,118, from +$2,865 to +$746; stressed +$157 remains thin.
R3 stressed full +1m is only +$83.

Concrete saved-ledger trace: a short entered2025-07-31 20:00 UTC exits at
2025-08-01 08:00 in the immediate model, permitting the fresh08:00 crossing.
The delayed version entered20:01, times out08:01, exits08:02. It is still
occupied at 08:00, so **skips rather than queues** that next signal. The
immediate-only 08:00 trade later makes +$641. This is causal occupancy
sensitivity, not evidence to optimize on instant fills or ignore delay.

## 6. Trade-path and concentration checks

Read-only saved-ledger analysis; minute extremes from entry inclusive to exit
exclusive. MAE below is a gross price move on $10k entry notional, not DD on
the $32k account, not a realized loss and not a liquidation calculation.
Top five winning dollars as% of completed net can exceed100% because other
trades lose; n/a means no positive completed net to use as a denominator.
This is not a remove-top five rerun with recomputed occupancy.

| Setup/window | Closes | Worst gross MAE | MAE $ | Worst closed $ | Top5 wins / closed net |
|---|---|---|---|---|---|
| Clock long full | 861 | -53.52% | -5,352 | -1,601 | 199.91% |
| Clock long recent | 219 | -13.05% | -1,305 | -1,078 | 106.49% |
| L1 full | 427 | -51.97% | -5,197 | -1,098 | 20.70% |
| L1 recent | 105 | -10.07% | -1,007 | -633 | 47.48% |
| L2 full | 297 | -52.73% | -5,273 | -1,207 | 48.61% |
| L2 recent | 72 | -10.80% | -1,080 | -963 | 278.85% |
| L3 full | 427 | -52.26% | -5,226 | -1,025 | 25.25% |
| L3 recent | 105 | -9.28% | -928 | -651 | 59.81% |
| L4 full | 144 | -49.05% | -4,905 | -1,099 | 65.79% |
| L4 recent | 35 | -8.95% | -895 | -618 | 114.04% |
| L5 full | 298 | -52.82% | -5,282 | -1,293 | 63.58% |
| L5 recent | 72 | -11.22% | -1,122 | -1,011 | 239.52% |
| B1 full | 69 | -9.00% | -900 | -742 | 102.57% |
| B1 recent | 17 | -9.00% | -900 | -312 | 143.36% |
| Clock short full | 861 | -23.65% | -2,365 | -1,885 | n/a |
| Clock short recent | 219 | -23.65% | -2,365 | -1,885 | n/a |
| R2 full | 67 | -7.38% | -738 | -715 | 101.72% |
| R2 recent | 13 | -6.22% | -622 | -236 | 149.79% |
| R1 full | 524 | -23.65% | -2,365 | -2,084 | 112.69% |
| R1 recent | 130 | -23.65% | -2,365 | -2,084 | n/a |

All L1–L5 hold through **2025-10-10 21:21 UTC, HYPE low $20.784**.
L1 entered15:30 at $43.276, saw a51.97% gross adverse move, then closed
for-$1,079. L2/L3/L4/L5 see 52.73% /52.26% /49.05% /52.82%.
Recovery before modeled exit hides much of the intratrade danger; high
win rates do not certify leverage or safe deep-ladder adds.

B1 does not hold that crash. Its observed worst adverse move is 9.00%
(Aug 22, 2026, entry $79.53, low $72.37); however top five winners equal 102.57%
of full completed net and 143.36% of recent. Only 17 recent trades means
limited evidence, not demonstrated tail immunity.

R2 worst full gross adverse move is 7.38%; top five winners equal101.72%
of full completed net,149.79% recent. R1/R4/R5 fade shorts instead hold
through the August 19 pump with roughly 23.6% adverse moves. Long and short
mean-reversion tail risks are symmetric in mechanism, not identical outcomes.

## 7. Monthly marked-equity comparison — retain every top-five failure

Each cell is **actual marked net $ (Δ versus same-side clock)**. Baseline
column gives actual net. These are portfolio mark-to-market months, not
all trade PnL allocated to exit month. September and recentMay are partial.
Recent starts flat at its own start; it is not simply a slice of full trades.
Alltop five and rawtop five are shown in both windows and both delays.
B1 is included as the explicitly labeled mechanism contrast.


### full, 0m delay, long

| Month | Clock long $ | L1 net (Δ) | L2 net (Δ) | L3 net (Δ) | L4 net (Δ) | L5 net (Δ) | B1 net (Δ) |
|---|---|---|---|---|---|---|---|
| 2025-07 | -161 | +977 (+1,138) | +1,469 (+1,630) | +793 (+955) | +1,318 (+1,480) | +1,170 (+1,332) | +0 (+161) |
| 2025-08 | +510 | +1,189 (+679) | +2,655 (+2,144) | +636 (+126) | +559 (+48) | +2,184 (+1,674) | +1,432 (+921) |
| 2025-09 | -109 | +1,383 (+1,493) | +453 (+563) | +1,675 (+1,784) | +1,084 (+1,193) | +118 (+227) | +865 (+975) |
| 2025-10 | -470 | +1,906 (+2,377) | -1,363 (-893) | +1,593 (+2,064) | -269 (+201) | -1,680 (-1,210) | -369 (+101) |
| 2025-11 | -3,287 | +1,818 (+5,105) | +2,281 (+5,568) | +1,968 (+5,255) | -216 (+3,071) | +2,405 (+5,692) | -513 (+2,774) |
| 2025-12 | -2,574 | -624 (+1,949) | -560 (+2,014) | -251 (+2,323) | +643 (+3,217) | -1,318 (+1,255) | -527 (+2,047) |
| 2026-01 | +1,782 | -1,716 (-3,498) | +789 (-993) | -2,463 (-4,245) | -229 (-2,011) | -126 (-1,909) | +1,876 (+94) |
| 2026-02 | -122 | +1,834 (+1,956) | +2,249 (+2,371) | +2,386 (+2,508) | +62 (+184) | +2,111 (+2,233) | -865 (-743) |
| 2026-03 | +1,155 | +1,711 (+556) | +1,198 (+43) | +1,250 (+95) | +637 (-517) | +1,028 (-127) | +726 (-429) |
| 2026-04 | +307 | -1,105 (-1,412) | -205 (-512) | -569 (-876) | +252 (-55) | +3 (-304) | +108 (-199) |
| 2026-05 | +5,789 | +177 (-5,612) | +40 (-5,750) | -402 (-6,192) | +1,412 (-4,377) | -52 (-5,841) | +1,575 (-4,214) |
| 2026-06 | -1,256 | +1,728 (+2,984) | +998 (+2,253) | +1,515 (+2,771) | +842 (+2,098) | +1,472 (+2,727) | +135 (+1,391) |
| 2026-07 | -2,621 | -761 (+1,860) | -2,150 (+471) | -952 (+1,669) | -56 (+2,565) | -2,215 (+406) | +99 (+2,720) |
| 2026-08 | +4,306 | +1,807 (-2,499) | +2,150 (-2,156) | +1,583 (-2,723) | +2,807 (-1,499) | +1,985 (-2,321) | +1,494 (-2,812) |
| 2026-09 | +55 | +92 (+37) | +209 (+153) | +223 (+168) | +0 (-55) | +271 (+216) | -54 (-109) |

### full, 0m delay, short

| Month | Clock short $ | R1 net (Δ) | R2 net (Δ) | R3 net (Δ) | R4 net (Δ) | R5 net (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | -1,203 | +576 (+1,779) | -588 (+616) | -588 (+616) | +1,184 (+2,387) | +1,188 (+2,391) |
| 2025-08 | -1,876 | -256 (+1,620) | +717 (+2,593) | +717 (+2,593) | -283 (+1,593) | -272 (+1,604) |
| 2025-09 | -1,211 | -359 (+853) | +347 (+1,558) | +306 (+1,517) | -41 (+1,170) | -416 (+795) |
| 2025-10 | -894 | +4,368 (+5,262) | +614 (+1,507) | +614 (+1,507) | +1,177 (+2,071) | +1,494 (+2,388) |
| 2025-11 | +1,970 | +2,708 (+738) | +701 (-1,268) | +701 (-1,268) | +61 (-1,909) | -31 (-2,001) |
| 2025-12 | +1,212 | +1,885 (+673) | -230 (-1,442) | -230 (-1,442) | +2,723 (+1,511) | +3,512 (+2,301) |
| 2026-01 | -3,149 | -1,128 (+2,021) | +258 (+3,407) | +258 (+3,407) | -837 (+2,312) | -1,573 (+1,576) |
| 2026-02 | -1,111 | +1,896 (+3,006) | +216 (+1,327) | +216 (+1,327) | +1,918 (+3,028) | +1,678 (+2,789) |
| 2026-03 | -2,521 | -640 (+1,881) | -307 (+2,213) | -307 (+2,213) | +55 (+2,576) | +423 (+2,944) |
| 2026-04 | -1,628 | +1,028 (+2,657) | +204 (+1,833) | +204 (+1,833) | +407 (+2,035) | +422 (+2,050) |
| 2026-05 | -7,161 | -5,468 (+1,692) | +121 (+7,282) | +121 (+7,282) | -4,169 (+2,992) | -3,943 (+3,218) |
| 2026-06 | -64 | +2,982 (+3,046) | +366 (+430) | +366 (+430) | +1,245 (+1,309) | +1,319 (+1,382) |
| 2026-07 | +1,259 | +1,855 (+596) | +409 (-851) | +409 (-851) | +637 (-622) | +753 (-506) |
| 2026-08 | -5,675 | -3,439 (+2,236) | +36 (+5,712) | +36 (+5,712) | -2,560 (+3,116) | -3,129 (+2,547) |
| 2026-09 | -231 | -431 (-200) | +0 (+231) | +0 (+231) | -269 (-38) | -211 (+20) |

### full, 1m delay, long

| Month | Clock long $ | L1 net (Δ) | L2 net (Δ) | L3 net (Δ) | L4 net (Δ) | L5 net (Δ) | B1 net (Δ) |
|---|---|---|---|---|---|---|---|
| 2025-07 | -94 | +664 (+758) | +1,472 (+1,565) | +645 (+739) | +1,209 (+1,303) | +985 (+1,079) | +0 (+94) |
| 2025-08 | +754 | +960 (+206) | +2,471 (+1,717) | +379 (-375) | +686 (-68) | +2,054 (+1,300) | +1,352 (+598) |
| 2025-09 | -265 | +1,229 (+1,494) | +104 (+368) | +1,567 (+1,832) | +907 (+1,171) | +213 (+478) | +893 (+1,157) |
| 2025-10 | -484 | +1,875 (+2,359) | -1,648 (-1,164) | +1,607 (+2,091) | -87 (+397) | -1,610 (-1,126) | -451 (+33) |
| 2025-11 | -3,354 | +1,453 (+4,807) | +2,000 (+5,354) | +1,616 (+4,970) | -1,780 (+1,575) | +2,198 (+5,552) | -463 (+2,891) |
| 2025-12 | -2,606 | -337 (+2,269) | -606 (+2,001) | +38 (+2,645) | +616 (+3,223) | -1,041 (+1,566) | -633 (+1,973) |
| 2026-01 | +2,011 | -2,101 (-4,112) | +497 (-1,514) | -2,755 (-4,765) | -157 (-2,168) | -197 (-2,208) | +1,944 (-67) |
| 2026-02 | +102 | +1,727 (+1,624) | +2,415 (+2,312) | +2,164 (+2,061) | +8 (-94) | +1,834 (+1,732) | -984 (-1,086) |
| 2026-03 | +1,222 | +1,942 (+720) | +1,176 (-46) | +1,179 (-43) | +550 (-672) | +803 (-419) | +818 (-404) |
| 2026-04 | +243 | -1,060 (-1,303) | -195 (-438) | -478 (-721) | +219 (-24) | +52 (-190) | +118 (-125) |
| 2026-05 | +5,761 | +50 (-5,711) | +96 (-5,665) | -362 (-6,123) | +1,399 (-4,362) | -216 (-5,978) | +1,553 (-4,209) |
| 2026-06 | -1,159 | +1,729 (+2,887) | +1,044 (+2,203) | +1,334 (+2,493) | +649 (+1,808) | +1,671 (+2,830) | +113 (+1,272) |
| 2026-07 | -2,614 | -882 (+1,733) | -2,215 (+399) | -948 (+1,666) | -49 (+2,566) | -2,174 (+440) | +108 (+2,722) |
| 2026-08 | +4,311 | +1,673 (-2,638) | +2,093 (-2,218) | +1,437 (-2,873) | +2,812 (-1,499) | +1,928 (-2,383) | +1,625 (-2,686) |
| 2026-09 | -37 | +79 (+115) | +266 (+303) | +246 (+283) | +0 (+37) | +318 (+355) | -48 (-11) |

### full, 1m delay, short

| Month | Clock short $ | R1 net (Δ) | R2 net (Δ) | R3 net (Δ) | R4 net (Δ) | R5 net (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | -1,271 | +1,016 (+2,286) | -660 (+610) | -660 (+610) | +1,237 (+2,508) | +1,291 (+2,562) |
| 2025-08 | -2,120 | -240 (+1,880) | +69 (+2,189) | +69 (+2,189) | -116 (+2,003) | -390 (+1,730) |
| 2025-09 | -1,056 | -113 (+943) | -13 (+1,043) | -89 (+967) | -80 (+976) | -322 (+734) |
| 2025-10 | -880 | +5,682 (+6,562) | +603 (+1,483) | +603 (+1,483) | +1,168 (+2,048) | +1,083 (+1,963) |
| 2025-11 | +2,037 | +1,819 (-218) | +88 (-1,949) | +88 (-1,949) | +348 (-1,689) | +121 (-1,916) |
| 2025-12 | +1,267 | +1,648 (+381) | -547 (-1,813) | -545 (-1,811) | +2,683 (+1,416) | +3,151 (+1,884) |
| 2026-01 | -3,378 | -1,369 (+2,009) | +217 (+3,595) | +217 (+3,595) | -903 (+2,475) | -1,574 (+1,803) |
| 2026-02 | -1,335 | +1,336 (+2,672) | +136 (+1,471) | +136 (+1,471) | +1,893 (+3,229) | +1,560 (+2,895) |
| 2026-03 | -2,588 | -165 (+2,424) | -269 (+2,320) | -269 (+2,320) | +49 (+2,638) | +334 (+2,922) |
| 2026-04 | -1,564 | +1,240 (+2,804) | +215 (+1,779) | +215 (+1,779) | +397 (+1,961) | +550 (+2,114) |
| 2026-05 | -7,132 | -5,490 (+1,642) | +156 (+7,289) | +156 (+7,289) | -4,379 (+2,753) | -4,061 (+3,072) |
| 2026-06 | -139 | +2,918 (+3,057) | +287 (+426) | +287 (+426) | +1,040 (+1,178) | +1,156 (+1,295) |
| 2026-07 | +1,252 | +1,845 (+593) | +431 (-821) | +431 (-821) | +619 (-634) | +696 (-557) |
| 2026-08 | -5,680 | -3,972 (+1,708) | +32 (+5,713) | +32 (+5,713) | -2,500 (+3,180) | -3,283 (+2,398) |
| 2026-09 | -139 | -452 (-313) | +0 (+139) | +0 (+139) | -291 (-152) | -224 (-85) |

### recent, 0m delay, long

| Month | Clock long $ | L1 net (Δ) | L2 net (Δ) | L3 net (Δ) | L4 net (Δ) | L5 net (Δ) | B1 net (Δ) |
|---|---|---|---|---|---|---|---|
| 2026-05 | +4,554 | +620 (-3,934) | +125 (-4,429) | +136 (-4,418) | +449 (-4,105) | +22 (-4,532) | +387 (-4,167) |
| 2026-06 | -1,256 | +1,728 (+2,984) | +998 (+2,253) | +1,515 (+2,771) | +842 (+2,098) | +1,472 (+2,727) | +135 (+1,391) |
| 2026-07 | -2,621 | -761 (+1,860) | -2,150 (+471) | -952 (+1,669) | -56 (+2,565) | -2,215 (+406) | +99 (+2,720) |
| 2026-08 | +4,306 | +1,807 (-2,499) | +2,150 (-2,156) | +1,583 (-2,723) | +2,807 (-1,499) | +1,985 (-2,321) | +1,494 (-2,812) |
| 2026-09 | +55 | +92 (+37) | +209 (+153) | +223 (+168) | +0 (-55) | +271 (+216) | -54 (-109) |

### recent, 0m delay, short

| Month | Clock short $ | R1 net (Δ) | R2 net (Δ) | R3 net (Δ) | R4 net (Δ) | R5 net (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | -5,175 | -3,665 (+1,510) | +95 (+5,271) | +95 (+5,271) | -2,254 (+2,921) | -2,016 (+3,159) |
| 2026-06 | -64 | +2,982 (+3,046) | +366 (+430) | +366 (+430) | +1,245 (+1,309) | +1,319 (+1,382) |
| 2026-07 | +1,259 | +1,855 (+596) | +409 (-851) | +409 (-851) | +637 (-622) | +753 (-506) |
| 2026-08 | -5,675 | -3,439 (+2,236) | +36 (+5,712) | +36 (+5,712) | -2,560 (+3,116) | -3,129 (+2,547) |
| 2026-09 | -231 | -431 (-200) | +0 (+231) | +0 (+231) | -269 (-38) | -211 (+20) |

### recent, 1m delay, long

| Month | Clock long $ | L1 net (Δ) | L2 net (Δ) | L3 net (Δ) | L4 net (Δ) | L5 net (Δ) | B1 net (Δ) |
|---|---|---|---|---|---|---|---|
| 2026-05 | +4,477 | +560 (-3,917) | +109 (-4,368) | +235 (-4,243) | +473 (-4,005) | -142 (-4,619) | +333 (-4,144) |
| 2026-06 | -1,129 | +1,729 (+2,857) | +1,044 (+2,172) | +1,334 (+2,462) | +649 (+1,778) | +1,671 (+2,800) | +113 (+1,242) |
| 2026-07 | -2,692 | -882 (+1,810) | -2,215 (+477) | -948 (+1,744) | -49 (+2,644) | -2,174 (+518) | +108 (+2,800) |
| 2026-08 | +4,384 | +1,673 (-2,711) | +2,093 (-2,291) | +1,437 (-2,946) | +2,812 (-1,571) | +1,928 (-2,455) | +1,625 (-2,758) |
| 2026-09 | +64 | +79 (+15) | +266 (+203) | +246 (+183) | +0 (-64) | +318 (+255) | -48 (-111) |

### recent, 1m delay, short

| Month | Clock short $ | R1 net (Δ) | R2 net (Δ) | R3 net (Δ) | R4 net (Δ) | R5 net (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | -5,099 | -3,663 (+1,436) | +96 (+5,195) | +96 (+5,195) | -2,480 (+2,618) | -2,148 (+2,950) |
| 2026-06 | -191 | +2,918 (+3,109) | +287 (+478) | +287 (+478) | +1,040 (+1,231) | +1,156 (+1,347) |
| 2026-07 | +1,330 | +1,845 (+515) | +431 (-899) | +431 (-899) | +619 (-712) | +696 (-635) |
| 2026-08 | -5,753 | -3,972 (+1,781) | +32 (+5,786) | +32 (+5,786) | -2,500 (+3,253) | -3,283 (+2,470) |
| 2026-09 | -218 | -452 (-234) | +0 (+218) | +0 (+218) | -291 (-74) | -224 (-7) |

## 8. Descriptive subset: all 27, not cherry-picked positives

Ordered by full immediate absolute net. Each passes sample/positive-net/
extra-cost/solvency in all four cases, **none the complete strict screen**.
All definitions and their failures remain in Appendix A. Counts for related
entries/exits overlap; do not add them as portfolio profits.

| Exact ID | Full n/net $ | Recent n/net $ | Full +1m stress $ | Worst monthly Δ $ |
|---|---|---|---|---|
| `bollinger_15m_n50_k2_into_long_indicator_or12h` | 427 / +10,417 | 105 / +3,487 | +4,735 | -5,711 |
| `bollinger_5m_n50_k3_into_long_fixed12h` | 297 / +10,211 | 72 / +1,331 | +5,982 | -5,750 |
| `bollinger_15m_n50_k2_reclaim_long_indicator_or12h` | 427 / +8,985 | 105 / +2,505 | +3,423 | -6,192 |
| `bollinger_60m_n50_k2_into_long_fixed12h` | 144 / +8,847 | 35 / +4,041 | +5,599 | -4,377 |
| `bollinger_5m_n50_k3_reclaim_long_fixed12h` | 298 / +7,355 | 72 / +1,534 | +3,825 | -5,978 |
| `bollinger_15m_n50_k2_into_long_fixed12h` | 367 / +7,222 | 90 / +4,362 | +4,143 | -5,017 |
| `bollinger_30m_n20_k3_breakout_long_indicator_or12h` | 69 / +5,983 | 17 / +2,062 | +5,251 | -4,214 |
| `bollinger_60m_n50_k2_into_long_indicator_or12h` | 144 / +5,950 | 35 / +1,708 | +2,418 | -5,354 |
| `bollinger_15m_n50_k3_breakout_long_indicator_or12h` | 150 / +5,788 | 41 / +2,769 | +4,593 | -5,013 |
| `bollinger_30m_n20_k2_into_long_fixed12h` | 352 / +5,553 | 84 / +4,576 | +485 | -5,107 |
| `bollinger_60m_n20_k3_breakout_long_indicator_or12h` | 34 / +5,119 | 13 / +1,350 | +4,821 | -5,499 |
| `bollinger_30m_n20_k3_breakout_long_fixed12h` | 68 / +4,901 | 17 / +2,099 | +3,757 | -4,195 |
| `bollinger_15m_n50_k2_reclaim_long_fixed12h` | 366 / +4,792 | 91 / +2,556 | +1,129 | -5,193 |
| `bollinger_60m_n50_k3_breakout_long_indicator_or12h` | 38 / +4,456 | 10 / +1,626 | +4,232 | -4,792 |
| `bollinger_60m_n20_k2_into_long_indicator_or12h` | 222 / +4,217 | 52 / +2,167 | +1,173 | -5,581 |
| `bollinger_60m_n50_k3_breakout_long_fixed12h` | 38 / +4,189 | 10 / +1,626 | +3,957 | -4,802 |
| `bollinger_60m_n20_k3_breakout_long_fixed12h` | 34 / +4,006 | 13 / +701 | +3,712 | -6,129 |
| `bollinger_60m_n20_k2_reclaim_long_indicator_or12h` | 220 / +3,970 | 52 / +1,469 | +1,451 | -5,495 |
| `bollinger_15m_n50_k3_breakout_long_fixed12h` | 149 / +3,790 | 40 / +1,697 | +2,864 | -5,697 |
| `bollinger_60m_n20_k2_breakout_long_indicator_or12h` | 238 / +3,286 | 64 / +2,272 | +605 | -4,455 |
| `bollinger_30m_n50_k3_breakout_long_fixed12h` | 80 / +3,189 | 23 / +1,887 | +2,887 | -4,529 |
| `bollinger_30m_n50_k3_breakout_long_indicator_or12h` | 82 / +2,893 | 24 / +1,682 | +2,487 | -4,666 |
| `bollinger_240m_n20_k2_breakout_short_fixed12h` | 67 / +2,865 | 13 / +907 | +157 | -1,949 |
| `bollinger_240m_n20_k2_breakout_long_indicator_or12h` | 79 / +2,828 | 22 / +1,171 | +696 | -4,504 |
| `bollinger_240m_n20_k2_breakout_short_indicator_or12h` | 67 / +2,824 | 13 / +907 | +83 | -1,949 |
| `bollinger_60m_n50_k2_reclaim_long_fixed12h` | 138 / +2,227 | 34 / +1,774 | +810 | -4,840 |
| `bollinger_30m_n50_k3_into_long_indicator_or12h` | 65 / +1,187 | 22 / +459 | +765 | -5,789 |

## 9. One explicit no-lookahead trace

First full immediate L2 entry (5m50/3 into lower band):

| Observation | UTC/value |
|---|---|
| Previous bar start | 2025-07-01T05:15:00.000Z |
| Previous closed percentB | 0.03527451304803648 |
| Signal bar interval | 2025-07-01T05:20:00.000Z to 2025-07-01T05:25:00.000Z (exclusive end) |
| Closed percentB / lower band | -0.017766797530039694 / 38.658295118438886 |
| Known/decision time | 2025-07-01T05:25:00.000Z |
| Entry minute open | 2025-07-01T05:25:00.000Z @38.633 |
| Fixed 12h exit | 2025-07-01T17:25:00.000Z |

Previous%b>0 and newly closed%b<=0 is a fresh into-band long. The signal
bar closes before the next bar's open used for entry; no entry-minute H/L/C
enters the decision. With +1m it executes one minute later. This assumes
zero publication lag in the immediate model, not proof live data arrived
instantaneously. Prefix tests and the separate checker cover every case.

## 10. Verification and reproducibility

Accepted directory: `backtests/hype/hype-bollinger-standalone-2026-09-06/`.
Require both completed `validation.json` and `verification.json`.
The runner refused overwrite and checked source/input hashes unchanged.

- Eight new test groups,240 boundary combinations; independent population/
  pairwise variance and installed-library comparisons, all 20 clock/parameter
  pairs; null/zero/affine/prefix/gap checks and moving-band reclaim regression.
- Shared standalone17groups and closed-bar11groups pass.
- Eight clock cases reproduce old/new/saved I01 **complete ledgers, monthly
  rows, stats and open inventory exactly before new outcomes**. No ladder
  variant is tested; this baseline is the canonical standalone I01 engine.
- Actual-data60 feature-prefix and 240 strategy-prefix checks pass.
- Independent checker imports the candle/repair loader, not feature/strategy/
  closed-bar implementations; direct-window formulas reconstruct signal
  eligibility, occupied skips, terminal pending, first exit, opens/prices, fees,
  marks, monthly PnL, minute DD, rankings and traces.
- **968 cases,174,379 trade records,9,680 monthly records verified**. These
  are overlapping artifact records, not174k unique market trades.
- Read-only selected-top five/rawtop five/clock path audit passes every pin.
  B1 was an additional read-only selected-ID path inspection of saved trades,
  not a new strategy run or edited accepted source.
- Both TypeScript configurations and diff whitespace checks pass. No live
  policy/config/state/exchange changes, commit, push or deployment.

An earlier incomplete development run is preserved at
`backtests/hype/hype-bollinger-standalone-2026-09-06-aborted-checker-typecheck/`.
A mixed null/numeric Map inference error in the separate checker was found,
the runner stopped, the compile-only annotation fixed, and the same grid
rerun fresh after typecheck. **That incomplete folder is not accepted evidence.**
No parameters or selection thresholds changed after initial stdout.

### Pinned evidence (full SHA256)

| File | SHA256 |
|---|---|
| `research-inputs/indicators/bollinger-standalone-2026-09-06.json` | `7b34da7b01c013c1b9b3865912d881ca22d8b68cef3ee3fb38003ea9911c7c62` |
| `scripts/bollinger-standalone-engine.ts` | `f750ca1cce6f1f6570ba28b2f6c60889f99a32cadba3b431d86d068a5246d953` |
| `scripts/hype-bollinger-standalone-study.ts` | `26228873838c1523a0380f7f7394a4e2d8fa44c6f7d888841ebf3ce37ec06005` |
| `src/research/bollinger-features.ts` | `fc4080dae916560f86eb01a5212c08d692763787c4de81ea86fe614fa2aad02b` |
| `scripts/bollinger-standalone-tests.ts` | `9fbfe666b05b1b33872b0de90cff73cc6503bdfcde6d8ef99f7e7007a40627cd` |
| `scripts/bollinger-standalone-results-check.ts` | `52391a8c85ae88ae913c4d715e347baa2efbe0c2290b8c1509a95d83e7c4a330` |
| `scripts/bollinger-standalone-path-check.ts` | `199640990c99fcc6517854ccabdc981454c177f7e64669ba18f1c1b07e81aea6` |
| `data/HYPEUSDT_1_full.json` | `feb790184fb2f32a4b4d0d03f331abf51e708aaf778051011a66e81f85fa3fdf` |
| `data/HYPEUSDT_1m.jsonl` | `1e3a6e1617b3d3fc49a98da20c5d39832562f96de6ecadea8bd1ba36b82cbbb9` |
| `backtests/hype/candle-repair-2026-09-05/repair.json` | `a8169356a401f65e7a3c58a86f9507782759035de059c5bca0a27b2d142bc61d` |
| `manifest.json` | `1e278da12c46e4d1f652af86b9e41f042bb86d0ff2a441aa25771be443ccb2a8` |
| `results.json` | `1a886e9e75c228ce9d4be520bd067280c6eada57e8c76f6f1226cd8080579e2c` |
| `monthly.json` | `ec73e99742bedc701ede040d7b973ca23635b274b8a5362b8c3b73ed008b3c34` |
| `trades.jsonl` | `b4d6fada89413d3b68540012b7a3b9338be9a32a25902928d7eebc32a85881a1` |
| `validation.json` | `3a5b737eced39308543ca7e3246296452a8aa829b7004a3ef72b9048d8121fc1` |

See the [method](../docs/research/bollinger-standalone-study.md) for local
commands and original input dependencies. Generated output stays local;
preserve its immutable snapshot privately. Registers now count **1,404
distinct standalone definitions**, separate from 45 ladder definitions.

## 11. Decision and next boundary

This bounded Bollinger pass is complete. Retain the positive entries with
their exact weaknesses; none qualifies for live deployment or demonstrates
a new ladder blocker. “Into oversold” and “breakout” answer different
questions, and their risk differences are useful future research inputs.

**Next useful individual family: ADX/DMI**, to distinguish directional
movement from strength rather than add another momentum oscillator.
Freeze its own card and preserve standalone controls before combinations.
ATR/efficiency and broader VWAP/volume remain queued. ADX alone is unsigned;
do not invent a long direction from a high ADX reading.

Donchian/Keltner and Bollinger squeeze/persistence remain untested, not
silently marked complete. A later ladder application needs its own
same-window canonical replay baseline and decision-specific counterfactual.
A combination needs component-only controls. Nothing here changes live risk.

## Appendix A. All 240 ranked definitions, including failures

Ranked by full immediate **delta versus own-side clock**, not raw profit.
Baseline nets(full 0/full 1/recent 0/recent 1): long +3,305/+3,792/+5,038/+5,104;
short-22,283/-22,726/-9,887/-9,930. Case cells are closes/net $.

Failure codes: **N** insufficient count; **P** nonpositive net in>=1case;
**C** not above clock in>=1case; **M** monthly regression; **S** extra-cost
nonpositive; **E** account-equity exhaustion in diagnostic path.
All monthly rows and unrounded stats remain in accepted artifacts.

| Rank / exactID | Full 0 n/net $ | Full 1 n/net $ | Recent 0 n/net $ | Recent 1 n/net $ | Full 0 Δ$ | Worst monthly Δ$ | Failures |
|---|---|---|---|---|---|---|---|
| 1. `bollinger_15m_n20_k2_into_short_fixed12h` | 524/+5,578 | 521/+5,704 | 130/-2,698 | 129/-3,324 | +27,861 | -313 | P, M, S |
| 2. `bollinger_240m_n20_k2_breakout_short_fixed12h` | 67/+2,865 | 59/+746 | 13/+907 | 13/+847 | +25,147 | -1,949 | M |
| 3. `bollinger_240m_n20_k2_breakout_short_indicator_or12h` | 67/+2,824 | 59/+672 | 13/+907 | 13/+847 | +25,107 | -1,949 | M |
| 4. `bollinger_5m_n50_k3_reclaim_short_fixed12h` | 323/+1,249 | 323/+1,163 | 92/-3,201 | 92/-3,613 | +23,531 | -1,909 | P, M, S |
| 5. `bollinger_5m_n50_k3_into_short_fixed12h` | 323/+1,215 | 323/+86 | 92/-3,285 | 92/-3,804 | +23,498 | -2,001 | P, M, S |
| 6. `bollinger_60m_n50_k3_breakout_short_indicator_or12h` | 27/+891 | 27/+911 | 7/+628 | 7/+730 | +23,173 | -1,432 | N, M |
| 7. `bollinger_240m_n50_k3_breakout_short_fixed12h` | 7/+811 | 7/+582 | 1/+59 | 1/+69 | +23,094 | -1,952 | N, M |
| 8. `bollinger_240m_n50_k3_breakout_short_indicator_or12h` | 7/+811 | 7/+582 | 1/+59 | 1/+69 | +23,094 | -1,952 | N, M |
| 9. `bollinger_60m_n50_k3_breakout_short_fixed12h` | 27/+754 | 27/+745 | 7/+570 | 7/+630 | +23,037 | -1,432 | N, M |
| 10. `bollinger_60m_n50_k2_reclaim_short_fixed12h` | 140/+749 | 136/+419 | 35/+347 | 35/+331 | +23,032 | -1,084 | M, S |
| 11. `bollinger_30m_n50_k2_breakout_short_fixed12h` | 217/+373 | 213/+1,441 | 50/-275 | 49/-72 | +22,655 | -1,584 | P, M, S |
| 12. `bollinger_240m_n50_k2_breakout_short_fixed12h` | 44/-76 | 40/+986 | 11/-1,303 | 11/-1,413 | +22,206 | -2,727 | P, M, S |
| 13. `bollinger_240m_n50_k2_breakout_short_indicator_or12h` | 44/-76 | 40/+986 | 11/-1,303 | 11/-1,413 | +22,206 | -2,727 | P, M, S |
| 14. `bollinger_15m_n20_k3_breakout_short_indicator_or12h` | 114/-107 | 114/+62 | 24/+42 | 24/+238 | +22,175 | -2,431 | P, M, S |
| 15. `bollinger_60m_n50_k2_reclaim_short_indicator_or12h` | 141/-110 | 137/-792 | 35/+459 | 35/+395 | +22,173 | -1,084 | P, M, S |
| 16. `bollinger_60m_n20_k3_breakout_short_fixed12h` | 31/-182 | 31/+59 | 11/-0 | 11/+227 | +22,101 | -2,037 | P, M, S |
| 17. `bollinger_60m_n20_k3_breakout_short_indicator_or12h` | 31/-185 | 31/+66 | 11/-113 | 11/+113 | +22,097 | -2,037 | P, M, S |
| 18. `bollinger_240m_n50_k2_into_short_fixed12h` | 58/-383 | 58/-27 | 16/-2,151 | 16/-2,066 | +21,900 | -2,037 | P, M, S |
| 19. `bollinger_240m_n50_k2_into_short_indicator_or12h` | 58/-383 | 58/-27 | 16/-2,151 | 16/-2,066 | +21,900 | -2,037 | P, M, S |
| 20. `bollinger_30m_n20_k3_breakout_short_fixed12h` | 47/-743 | 46/-186 | 13/+1,131 | 13/+1,255 | +21,539 | -2,003 | P, M, S |
| 21. `bollinger_15m_n50_k2_into_short_fixed12h` | 372/-909 | 368/-4,082 | 98/-4,378 | 97/-5,632 | +21,373 | -1,427 | P, M, S |
| 22. `bollinger_240m_n20_k3_reclaim_short_fixed12h` | 8/-940 | 8/-841 | 2/-757 | 2/-695 | +21,343 | -2,037 | N, P, M, S |
| 23. `bollinger_240m_n20_k3_reclaim_short_indicator_or12h` | 8/-940 | 8/-835 | 2/-757 | 2/-695 | +21,343 | -2,037 | N, P, M, S |
| 24. `bollinger_240m_n20_k3_breakout_short_fixed12h` | 6/-1,213 | 6/-1,337 | 0/+0 | 0/+0 | +21,070 | -2,492 | N, P, M, S |
| 25. `bollinger_240m_n20_k3_breakout_short_indicator_or12h` | 6/-1,213 | 6/-1,337 | 0/+0 | 0/+0 | +21,070 | -2,492 | N, P, M, S |
| 26. `bollinger_240m_n50_k3_reclaim_short_fixed12h` | 14/-1,252 | 13/-943 | 3/+149 | 3/+191 | +21,030 | -2,037 | N, P, M, S |
| 27. `bollinger_240m_n50_k3_reclaim_short_indicator_or12h` | 14/-1,252 | 13/-943 | 3/+149 | 3/+191 | +21,030 | -2,037 | N, P, M, S |
| 28. `bollinger_30m_n50_k2_into_short_fixed12h` | 236/-1,298 | 232/-1,643 | 62/-933 | 61/-1,038 | +20,985 | -2,346 | P, M, S |
| 29. `bollinger_30m_n50_k3_breakout_short_fixed12h` | 65/-1,509 | 65/-1,900 | 22/-1,110 | 22/-1,093 | +20,774 | -2,611 | P, M, S |
| 30. `bollinger_15m_n50_k3_breakout_short_indicator_or12h` | 129/-1,523 | 129/-1,082 | 33/-3 | 33/+71 | +20,760 | -2,287 | P, M, S |
| 31. `bollinger_15m_n20_k3_into_short_fixed12h` | 131/-1,653 | 130/-2,218 | 42/-3,174 | 42/-3,458 | +20,630 | -1,493 | P, M, S |
| 32. `bollinger_15m_n20_k3_breakout_short_fixed12h` | 108/-1,654 | 108/-1,593 | 22/-659 | 22/-495 | +20,629 | -2,437 | P, M, S |
| 33. `bollinger_30m_n20_k3_breakout_short_indicator_or12h` | 47/-1,654 | 46/-1,180 | 13/+615 | 13/+810 | +20,629 | -2,902 | P, M, S |
| 34. `bollinger_30m_n20_k2_into_short_fixed12h` | 372/-1,662 | 364/-1,454 | 96/-3,926 | 93/-3,928 | +20,621 | -1,105 | P, M, S |
| 35. `bollinger_240m_n50_k3_into_short_fixed12h` | 15/-1,673 | 14/-1,711 | 3/+10 | 3/+66 | +20,610 | -2,037 | N, P, M, S |
| 36. `bollinger_240m_n50_k3_into_short_indicator_or12h` | 15/-1,673 | 14/-1,711 | 3/+10 | 3/+66 | +20,610 | -2,037 | N, P, M, S |
| 37. `bollinger_240m_n20_k3_into_short_fixed12h` | 8/-1,693 | 8/-1,574 | 2/-910 | 2/-876 | +20,589 | -2,037 | N, P, M, S |
| 38. `bollinger_240m_n20_k3_into_short_indicator_or12h` | 8/-1,693 | 8/-1,574 | 2/-910 | 2/-876 | +20,589 | -2,037 | N, P, M, S |
| 39. `bollinger_15m_n20_k3_into_short_indicator_or12h` | 137/-2,006 | 137/-2,510 | 45/-3,723 | 45/-3,826 | +20,277 | -1,491 | P, M, S |
| 40. `bollinger_15m_n20_k3_reclaim_short_fixed12h` | 131/-2,081 | 130/-2,200 | 42/-3,120 | 42/-3,049 | +20,202 | -1,408 | P, M, S |
| 41. `bollinger_5m_n50_k3_into_short_indicator_or12h` | 424/-2,165 | 424/-3,326 | 126/-2,745 | 126/-2,517 | +20,117 | -1,997 | P, M, S |
| 42. `bollinger_5m_n20_k3_into_short_indicator_or12h` | 347/-2,233 | 347/-4,107 | 111/-1,315 | 111/-1,615 | +20,049 | -1,697 | P, M, S |
| 43. `bollinger_15m_n20_k2_reclaim_short_fixed12h` | 526/-2,478 | 522/-470 | 131/-4,763 | 130/-4,053 | +19,805 | -515 | P, M, S |
| 44. `bollinger_30m_n50_k3_breakout_short_indicator_or12h` | 65/-2,619 | 65/-2,848 | 22/-943 | 22/-926 | +19,664 | -3,641 | P, M, S |
| 45. `bollinger_5m_n20_k3_reclaim_short_indicator_or12h` | 347/-2,943 | 347/-3,272 | 111/-1,411 | 111/-1,705 | +19,339 | -1,677 | P, M, S |
| 46. `bollinger_60m_n50_k2_into_short_fixed12h` | 144/-3,138 | 141/-3,279 | 38/-1,939 | 37/-2,139 | +19,144 | -1,074 | P, M, S |
| 47. `bollinger_15m_n20_k3_reclaim_short_indicator_or12h` | 137/-3,190 | 137/-3,293 | 45/-3,613 | 45/-3,621 | +19,092 | -1,306 | P, M, S |
| 48. `bollinger_60m_n20_k3_reclaim_short_fixed12h` | 34/-3,358 | 34/-3,211 | 13/-407 | 13/-361 | +18,925 | -2,466 | P, M, S |
| 49. `bollinger_15m_n20_k2_into_short_indicator_or12h` | 795/-3,441 | 795/-6,904 | 209/-1,927 | 209/-2,719 | +18,841 | -1,543 | P, M, S |
| 50. `bollinger_240m_n20_k2_into_short_fixed12h` | 79/-3,685 | 73/-2,145 | 22/-1,657 | 22/-1,609 | +18,598 | -1,703 | P, M, S |
| 51. `bollinger_60m_n50_k3_reclaim_short_fixed12h` | 38/-3,696 | 38/-3,586 | 11/-1,228 | 11/-1,244 | +18,587 | -2,037 | P, M, S |
| 52. `bollinger_30m_n50_k2_breakout_short_indicator_or12h` | 223/-3,698 | 220/-3,462 | 52/-1,807 | 51/-1,590 | +18,585 | -2,979 | P, M, S |
| 53. `bollinger_60m_n50_k3_reclaim_short_indicator_or12h` | 38/-3,862 | 38/-3,682 | 11/-1,228 | 11/-1,244 | +18,420 | -2,037 | P, M, S |
| 54. `bollinger_240m_n20_k2_reclaim_short_fixed12h` | 76/-3,925 | 74/-2,882 | 20/-2,061 | 20/-2,026 | +18,358 | -2,082 | P, M, S |
| 55. `bollinger_5m_n50_k3_reclaim_short_indicator_or12h` | 424/-4,153 | 424/-3,849 | 126/-2,955 | 126/-2,430 | +18,129 | -1,808 | P, M, S |
| 56. `bollinger_60m_n50_k2_into_short_indicator_or12h` | 145/-4,229 | 142/-4,771 | 38/-2,264 | 37/-2,444 | +18,054 | -1,074 | P, M, S |
| 57. `bollinger_240m_n20_k2_reclaim_short_indicator_or12h` | 76/-4,271 | 74/-3,158 | 20/-2,088 | 20/-2,043 | +18,011 | -2,172 | P, M, S |
| 58. `bollinger_15m_n50_k3_breakout_short_fixed12h` | 128/-4,405 | 128/-4,088 | 32/-1,347 | 32/-1,412 | +17,877 | -2,459 | P, M, S |
| 59. `bollinger_60m_n20_k3_reclaim_short_indicator_or12h` | 34/-4,487 | 34/-4,384 | 13/-1,047 | 13/-977 | +17,796 | -2,466 | P, M, S |
| 60. `bollinger_5m_n50_k2_into_short_fixed12h` | 591/-4,490 | 590/-4,679 | 150/-7,067 | 149/-6,410 | +17,793 | -134 | P, M, S |
| 61. `bollinger_240m_n20_k2_into_short_indicator_or12h` | 79/-4,571 | 73/-3,036 | 22/-1,657 | 22/-1,609 | +17,712 | -1,703 | P, M, S |
| 62. `bollinger_30m_n50_k3_into_short_indicator_or12h` | 82/-4,701 | 82/-5,117 | 24/-2,212 | 24/-2,314 | +17,582 | -1,493 | P, M, S |
| 63. `bollinger_5m_n50_k2_reclaim_short_fixed12h` | 590/-4,705 | 589/-5,781 | 149/-6,811 | 149/-6,879 | +17,578 | -2,007 | P, M, S |
| 64. `bollinger_60m_n20_k3_into_short_fixed12h` | 34/-4,758 | 34/-4,807 | 13/-988 | 13/-1,031 | +17,524 | -2,458 | P, M, S |
| 65. `bollinger_30m_n50_k3_into_short_fixed12h` | 80/-4,953 | 80/-5,454 | 23/-2,395 | 23/-2,514 | +17,329 | -1,395 | P, M, S |
| 66. `bollinger_60m_n50_k3_into_short_fixed12h` | 38/-5,030 | 38/-5,181 | 10/-1,848 | 10/-1,879 | +17,252 | -2,037 | P, M, S |
| 67. `bollinger_60m_n50_k3_into_short_indicator_or12h` | 38/-5,298 | 38/-5,456 | 10/-1,848 | 10/-1,879 | +16,985 | -2,037 | P, M, S |
| 68. `bollinger_240m_n50_k2_reclaim_short_fixed12h` | 60/-5,332 | 56/-5,833 | 18/-3,688 | 17/-4,073 | +16,951 | -2,037 | P, M, S |
| 69. `bollinger_240m_n50_k2_reclaim_short_indicator_or12h` | 60/-5,332 | 56/-5,833 | 18/-3,688 | 17/-4,073 | +16,951 | -2,037 | P, M, S |
| 70. `bollinger_30m_n50_k3_reclaim_short_indicator_or12h` | 82/-5,529 | 82/-5,438 | 24/-3,187 | 24/-3,367 | +16,754 | -1,663 | P, M, S |
| 71. `bollinger_60m_n20_k3_into_short_indicator_or12h` | 34/-5,873 | 34/-5,918 | 13/-1,638 | 13/-1,648 | +16,410 | -2,458 | P, M, S |
| 72. `bollinger_60m_n20_k2_reclaim_short_fixed12h` | 233/-5,920 | 226/-7,795 | 63/-3,515 | 62/-4,014 | +16,363 | -1,874 | P, M, S |
| 73. `bollinger_30m_n50_k3_reclaim_short_fixed12h` | 80/-5,935 | 80/-5,986 | 23/-3,510 | 23/-3,745 | +16,347 | -1,565 | P, M, S |
| 74. `bollinger_15m_n50_k2_into_short_indicator_or12h` | 429/-5,961 | 428/-7,154 | 115/-4,037 | 114/-4,355 | +16,322 | -2,291 | P, M, S |
| 75. `bollinger_60m_n20_k2_into_short_fixed12h` | 229/-6,110 | 225/-6,480 | 63/-2,099 | 61/-2,253 | +16,172 | -1,812 | P, M, S |
| 76. `bollinger_30m_n20_k3_reclaim_short_fixed12h` | 68/-6,112 | 68/-6,432 | 17/-1,932 | 17/-1,973 | +16,170 | -1,841 | P, M, S |
| 77. `bollinger_60m_n20_k2_breakout_short_fixed12h` | 216/-6,345 | 211/-5,131 | 49/-834 | 49/-352 | +15,938 | -2,029 | P, M, S |
| 78. `bollinger_30m_n20_k3_into_short_fixed12h` | 68/-6,404 | 68/-5,942 | 17/-2,476 | 17/-2,395 | +15,879 | -1,693 | P, M, S |
| 79. `bollinger_30m_n50_k2_into_short_indicator_or12h` | 242/-6,780 | 239/-8,146 | 62/-3,178 | 61/-3,562 | +15,503 | -1,932 | P, M, S |
| 80. `bollinger_30m_n50_k2_reclaim_short_fixed12h` | 235/-6,806 | 231/-5,846 | 61/-2,357 | 60/-2,207 | +15,477 | -2,331 | P, M, S |
| 81. `bollinger_15m_n50_k3_into_short_fixed12h` | 149/-7,074 | 148/-7,610 | 40/-2,580 | 40/-2,665 | +15,208 | -1,748 | P, M, S |
| 82. `bollinger_30m_n20_k2_into_short_indicator_or12h` | 424/-7,130 | 421/-6,978 | 110/-4,483 | 110/-3,926 | +15,152 | -2,368 | P, M, S |
| 83. `bollinger_60m_n20_k2_reclaim_short_indicator_or12h` | 240/-7,491 | 234/-7,987 | 64/-3,497 | 63/-3,505 | +14,791 | -2,120 | P, M, S |
| 84. `bollinger_30m_n20_k3_into_short_indicator_or12h` | 69/-7,509 | 69/-7,470 | 17/-2,438 | 17/-2,508 | +14,774 | -1,684 | P, M, S |
| 85. `bollinger_30m_n20_k3_reclaim_short_indicator_or12h` | 69/-7,586 | 69/-7,584 | 17/-1,941 | 17/-2,009 | +14,697 | -2,013 | P, M, S |
| 86. `bollinger_15m_n50_k2_reclaim_short_fixed12h` | 375/-7,601 | 368/-9,148 | 101/-6,633 | 99/-7,390 | +14,681 | -1,813 | P, M, S |
| 87. `bollinger_5m_n20_k3_breakout_short_fixed12h` | 226/-7,757 | 225/-7,239 | 58/-2,613 | 58/-2,666 | +14,526 | -3,539 | P, M, S |
| 88. `bollinger_5m_n20_k3_into_short_fixed12h` | 264/-7,799 | 264/-8,733 | 82/-5,303 | 82/-5,453 | +14,484 | -1,991 | P, M, S |
| 89. `bollinger_5m_n20_k3_reclaim_short_fixed12h` | 264/-8,020 | 264/-7,242 | 82/-5,471 | 82/-5,329 | +14,263 | -1,922 | P, M, S |
| 90. `bollinger_15m_n50_k3_reclaim_short_fixed12h` | 148/-8,121 | 148/-7,987 | 40/-2,440 | 40/-2,237 | +14,161 | -1,680 | P, M, S |
| 91. `bollinger_5m_n50_k2_into_short_indicator_or12h` | 1142/-8,291 | 1142/-10,754 | 294/-5,183 | 294/-5,230 | +13,992 | -1,754 | P, M, S |
| 92. `bollinger_60m_n20_k2_into_short_indicator_or12h` | 238/-8,529 | 235/-8,134 | 64/-3,684 | 62/-3,409 | +13,754 | -2,191 | P, M, S |
| 93. `bollinger_15m_n20_k2_reclaim_short_indicator_or12h` | 799/-8,795 | 793/-10,335 | 210/-2,208 | 208/-2,533 | +13,488 | -2,375 | P, M, S |
| 94. `bollinger_5m_n20_k3_breakout_short_indicator_or12h` | 310/-8,806 | 310/-7,479 | 86/-1,431 | 86/-2,050 | +13,476 | -2,359 | P, M, S |
| 95. `bollinger_5m_n50_k3_breakout_short_indicator_or12h` | 380/-8,919 | 380/-7,278 | 98/-1,666 | 98/-1,340 | +13,364 | -3,598 | P, M, S |
| 96. `bollinger_15m_n50_k3_into_short_indicator_or12h` | 150/-9,096 | 150/-9,405 | 41/-3,675 | 41/-3,657 | +13,186 | -1,524 | P, M, S |
| 97. `bollinger_60m_n50_k2_breakout_short_indicator_or12h` | 144/-9,126 | 138/-6,842 | 35/-2,480 | 35/-2,255 | +13,156 | -2,153 | P, M, S |
| 98. `bollinger_60m_n20_k2_breakout_short_indicator_or12h` | 222/-9,130 | 218/-8,191 | 52/-3,336 | 52/-2,963 | +13,152 | -3,330 | P, M, S |
| 99. `bollinger_30m_n20_k2_reclaim_short_indicator_or12h` | 420/-9,348 | 417/-8,175 | 110/-3,391 | 110/-3,644 | +12,935 | -2,782 | P, M, S |
| 100. `bollinger_30m_n20_k2_reclaim_short_fixed12h` | 369/-9,383 | 363/-5,679 | 95/-5,231 | 94/-4,982 | +12,900 | -1,513 | P, M, S |
| 101. `bollinger_15m_n50_k3_reclaim_short_indicator_or12h` | 150/-9,496 | 150/-9,585 | 41/-3,522 | 41/-3,409 | +12,787 | -1,565 | P, M, S |
| 102. `bollinger_15m_n50_k2_reclaim_short_indicator_or12h` | 427/-9,624 | 425/-9,269 | 114/-4,862 | 113/-5,460 | +12,658 | -3,175 | P, M, S |
| 103. `bollinger_5m_n20_k2_into_short_indicator_or12h` | 2318/-10,795 | 2318/-16,316 | 609/-1,672 | 609/-2,433 | +11,487 | -2,303 | P, M, S |
| 104. `bollinger_30m_n50_k2_reclaim_short_indicator_or12h` | 241/-10,992 | 239/-10,163 | 61/-3,597 | 60/-3,862 | +11,291 | -1,679 | P, M, S |
| 105. `bollinger_30m_n20_k2_breakout_short_indicator_or12h` | 392/-11,139 | 390/-9,715 | 97/-4,024 | 97/-3,819 | +11,144 | -2,927 | P, M, S |
| 106. `bollinger_5m_n50_k2_reclaim_short_indicator_or12h` | 1143/-11,542 | 1141/-11,347 | 294/-4,146 | 294/-3,712 | +10,741 | -2,064 | P, M, S |
| 107. `bollinger_60m_n50_k2_breakout_short_fixed12h` | 144/-12,026 | 138/-10,028 | 35/-4,816 | 35/-4,660 | +10,256 | -2,192 | P, M, S |
| 108. `bollinger_30m_n20_k2_breakout_short_fixed12h` | 352/-13,330 | 343/-11,505 | 84/-6,453 | 82/-6,137 | +8,953 | -3,678 | P, M, S |
| 109. `bollinger_5m_n20_k2_reclaim_short_indicator_or12h` | 2320/-13,605 | 2315/-15,147 | 611/-522 | 608/-1,467 | +8,678 | -2,073 | P, M, S |
| 110. `bollinger_15m_n50_k2_into_long_indicator_or12h` | 427/+10,417 | 425/+9,002 | 105/+3,487 | 105/+3,159 | +7,113 | -5,711 | C, M |
| 111. `bollinger_15m_n50_k2_breakout_short_fixed12h` | 367/-15,331 | 365/-15,874 | 90/-6,370 | 90/-6,449 | +6,952 | -2,466 | P, M, S |
| 112. `bollinger_5m_n50_k3_into_long_fixed12h` | 297/+10,211 | 297/+8,968 | 72/+1,331 | 72/+1,296 | +6,906 | -5,750 | C, M |
| 113. `bollinger_15m_n50_k2_reclaim_long_indicator_or12h` | 427/+8,985 | 423/+7,669 | 105/+2,505 | 104/+2,304 | +5,681 | -6,192 | C, M |
| 114. `bollinger_5m_n20_k2_into_short_fixed12h` | 698/-16,636 | 692/-17,143 | 178/-8,832 | 176/-9,913 | +5,646 | -749 | P, M, S |
| 115. `bollinger_60m_n50_k2_into_long_fixed12h` | 144/+8,847 | 138/+6,983 | 35/+4,041 | 35/+3,886 | +5,542 | -4,377 | C, M |
| 116. `bollinger_5m_n50_k3_breakout_short_fixed12h` | 297/-16,781 | 297/-15,538 | 72/-2,940 | 72/-2,905 | +5,501 | -4,759 | P, M, S |
| 117. `bollinger_15m_n20_k2_into_long_fixed12h` | 508/+8,061 | 504/+10,278 | 122/+1,228 | 122/+870 | +4,756 | -4,193 | C, M, S |
| 118. `bollinger_5m_n50_k3_reclaim_long_fixed12h` | 298/+7,355 | 298/+6,820 | 72/+1,534 | 72/+1,602 | +4,050 | -5,978 | C, M |
| 119. `bollinger_5m_n50_k2_breakout_short_fixed12h` | 581/-18,284 | 577/-15,574 | 145/-5,376 | 145/-4,773 | +3,998 | -2,896 | P, M, S |
| 120. `bollinger_5m_n20_k2_reclaim_short_fixed12h` | 695/-18,301 | 693/-17,356 | 177/-8,324 | 177/-8,075 | +3,982 | -1,043 | P, M, S |
| 121. `bollinger_15m_n50_k2_into_long_fixed12h` | 367/+7,222 | 365/+7,809 | 90/+4,362 | 90/+4,441 | +3,918 | -5,017 | C, M |
| 122. `bollinger_5m_n20_k2_into_long_fixed12h` | 693/+7,214 | 688/+5,667 | 177/+6,269 | 176/+6,340 | +3,910 | -3,008 | M, S |
| 123. `bollinger_5m_n20_k2_reclaim_long_fixed12h` | 694/+6,999 | 687/+4,244 | 177/+4,928 | 176/+5,371 | +3,694 | -3,232 | C, M, S |
| 124. `bollinger_15m_n20_k2_breakout_short_fixed12h` | 508/-19,252 | 504/-21,383 | 122/-3,914 | 122/-3,557 | +3,031 | -3,328 | P, M, S |
| 125. `bollinger_30m_n20_k3_breakout_long_indicator_or12h` | 69/+5,983 | 69/+5,945 | 17/+2,062 | 17/+2,132 | +2,679 | -4,214 | C, M |
| 126. `bollinger_60m_n50_k2_into_long_indicator_or12h` | 144/+5,950 | 138/+3,801 | 35/+1,708 | 35/+1,482 | +2,646 | -5,354 | C, M |
| 127. `bollinger_15m_n50_k3_breakout_long_indicator_or12h` | 150/+5,788 | 150/+6,097 | 41/+2,769 | 41/+2,751 | +2,484 | -5,013 | C, M |
| 128. `bollinger_15m_n50_k2_breakout_short_indicator_or12h` | 427/-19,850 | 425/-18,389 | 105/-5,824 | 105/-5,495 | +2,432 | -4,582 | P, M, S |
| 129. `bollinger_30m_n20_k2_into_long_fixed12h` | 352/+5,553 | 343/+3,929 | 84/+4,576 | 82/+4,306 | +2,249 | -5,107 | C, M |
| 130. `bollinger_5m_n50_k2_into_long_fixed12h` | 581/+5,489 | 577/+2,870 | 145/+2,182 | 145/+1,579 | +2,185 | -4,312 | C, M, S |
| 131. `bollinger_15m_n20_k2_reclaim_long_fixed12h` | 507/+5,334 | 502/+6,551 | 122/-850 | 122/+63 | +2,030 | -4,147 | P, C, M, S |
| 132. `bollinger_60m_n20_k3_breakout_long_indicator_or12h` | 34/+5,119 | 34/+5,164 | 13/+1,350 | 13/+1,360 | +1,814 | -5,499 | C, M |
| 133. `bollinger_30m_n20_k3_breakout_long_fixed12h` | 68/+4,901 | 68/+4,440 | 17/+2,099 | 17/+2,018 | +1,597 | -4,195 | C, M |
| 134. `bollinger_15m_n50_k2_reclaim_long_fixed12h` | 366/+4,792 | 363/+4,774 | 91/+2,556 | 90/+2,806 | +1,488 | -5,193 | C, M |
| 135. `bollinger_60m_n50_k3_breakout_long_indicator_or12h` | 38/+4,456 | 38/+4,614 | 10/+1,626 | 10/+1,657 | +1,152 | -4,792 | C, M |
| 136. `bollinger_15m_n20_k2_breakout_short_indicator_or12h` | 774/-21,154 | 773/-20,085 | 187/-4,953 | 187/-4,546 | +1,129 | -3,849 | P, M, S |
| 137. `bollinger_60m_n20_k2_into_long_indicator_or12h` | 222/+4,217 | 218/+3,366 | 52/+2,167 | 52/+1,795 | +912 | -5,581 | C, M |
| 138. `bollinger_60m_n50_k3_breakout_long_fixed12h` | 38/+4,189 | 38/+4,340 | 10/+1,626 | 10/+1,657 | +885 | -4,802 | C, M |
| 139. `bollinger_15m_n20_k2_into_long_indicator_or12h` | 774/+4,112 | 773/+3,066 | 187/+836 | 187/+430 | +807 | -5,380 | C, M, S |
| 140. `bollinger_60m_n20_k3_breakout_long_fixed12h` | 34/+4,006 | 34/+4,054 | 13/+701 | 13/+744 | +701 | -6,129 | C, M |
| 141. `bollinger_60m_n20_k2_reclaim_long_indicator_or12h` | 220/+3,970 | 220/+3,664 | 52/+1,469 | 52/+1,637 | +665 | -5,495 | C, M |
| 142. `bollinger_5m_n50_k2_into_long_indicator_or12h` | 1131/+3,833 | 1131/+204 | 273/-279 | 273/-1,418 | +528 | -6,144 | P, C, M, S |
| 143. `bollinger_15m_n50_k3_breakout_long_fixed12h` | 149/+3,790 | 148/+4,347 | 40/+1,697 | 40/+1,783 | +486 | -5,697 | C, M |
| 144. `bollinger_30m_n20_k2_reclaim_long_fixed12h` | 346/+3,314 | 340/+2,840 | 82/+2,785 | 82/+2,639 | +10 | -5,711 | C, M, S |
| 145. `bollinger_60m_n20_k2_breakout_long_indicator_or12h` | 238/+3,286 | 235/+2,958 | 64/+2,272 | 62/+2,042 | -18 | -4,455 | C, M |
| 146. `bollinger_30m_n50_k3_breakout_long_fixed12h` | 80/+3,189 | 80/+3,689 | 23/+1,887 | 23/+2,005 | -116 | -4,529 | C, M |
| 147. `bollinger_5m_n20_k2_breakout_short_fixed12h` | 693/-22,499 | 688/-20,839 | 177/-10,194 | 176/-10,243 | -216 | -2,513 | P, C, M, S |
| 148. `bollinger_30m_n50_k3_breakout_long_indicator_or12h` | 82/+2,893 | 82/+3,309 | 24/+1,682 | 24/+1,784 | -412 | -4,666 | C, M |
| 149. `bollinger_240m_n20_k2_breakout_long_indicator_or12h` | 79/+2,828 | 73/+1,427 | 22/+1,171 | 22/+1,124 | -476 | -4,504 | C, M |
| 150. `bollinger_5m_n20_k3_into_long_fixed12h` | 226/+2,757 | 225/+2,261 | 58/+1,313 | 58/+1,366 | -547 | -5,780 | C, M, S |
| 151. `bollinger_30m_n20_k2_into_long_indicator_or12h` | 392/+2,485 | 390/+1,107 | 97/+1,865 | 97/+1,660 | -819 | -6,225 | C, M, S |
| 152. `bollinger_60m_n50_k2_reclaim_long_fixed12h` | 138/+2,227 | 134/+2,151 | 34/+1,774 | 32/+1,414 | -1,078 | -4,840 | C, M |
| 153. `bollinger_5m_n20_k3_breakout_long_fixed12h` | 264/+1,986 | 264/+2,919 | 82/+3,494 | 82/+3,644 | -1,319 | -4,099 | C, M, S |
| 154. `bollinger_5m_n20_k3_into_long_indicator_or12h` | 310/+1,980 | 310/+654 | 86/-461 | 86/+157 | -1,324 | -6,385 | P, C, M, S |
| 155. `bollinger_240m_n20_k2_breakout_long_fixed12h` | 79/+1,944 | 73/+538 | 22/+1,171 | 22/+1,124 | -1,361 | -4,504 | C, M, S |
| 156. `bollinger_240m_n50_k2_reclaim_long_fixed12h` | 46/+1,713 | 43/+1,231 | 11/+557 | 9/-53 | -1,591 | -4,554 | N, P, C, M, S |
| 157. `bollinger_30m_n20_k2_reclaim_long_indicator_or12h` | 394/+1,713 | 388/-79 | 96/+123 | 95/-185 | -1,591 | -6,853 | P, C, M, S |
| 158. `bollinger_15m_n20_k2_reclaim_long_indicator_or12h` | 775/+1,685 | 773/+244 | 187/-715 | 187/-1,320 | -1,619 | -5,366 | P, C, M, S |
| 159. `bollinger_5m_n50_k2_reclaim_long_fixed12h` | 584/+1,598 | 581/+2,025 | 145/+2,405 | 145/+2,755 | -1,707 | -3,955 | C, M, S |
| 160. `bollinger_60m_n20_k2_into_long_fixed12h` | 216/+1,566 | 211/+464 | 49/-267 | 49/-747 | -1,738 | -5,741 | P, C, M, S |
| 161. `bollinger_15m_n50_k3_into_long_fixed12h` | 128/+1,564 | 128/+1,247 | 32/+619 | 32/+684 | -1,741 | -4,982 | C, M, S |
| 162. `bollinger_240m_n20_k3_breakout_long_fixed12h` | 8/+1,515 | 8/+1,397 | 2/+865 | 2/+831 | -1,789 | -5,613 | N, C, M |
| 163. `bollinger_240m_n20_k3_breakout_long_indicator_or12h` | 8/+1,515 | 8/+1,397 | 2/+865 | 2/+831 | -1,789 | -5,613 | N, C, M |
| 164. `bollinger_30m_n50_k2_breakout_long_indicator_or12h` | 242/+1,451 | 239/+2,882 | 62/+1,812 | 61/+2,216 | -1,853 | -4,057 | C, M, S |
| 165. `bollinger_240m_n50_k3_breakout_long_fixed12h` | 15/+1,341 | 14/+1,401 | 3/-76 | 3/-132 | -1,963 | -5,789 | N, P, C, M, S |
| 166. `bollinger_240m_n50_k3_breakout_long_indicator_or12h` | 15/+1,341 | 14/+1,401 | 3/-76 | 3/-132 | -1,963 | -5,789 | N, P, C, M, S |
| 167. `bollinger_5m_n20_k2_breakout_long_fixed12h` | 698/+1,248 | 692/+1,887 | 178/+4,886 | 176/+6,010 | -2,056 | -1,684 | C, M, S |
| 168. `bollinger_5m_n20_k3_reclaim_long_fixed12h` | 226/+1,206 | 225/+1,229 | 58/+1,594 | 58/+1,707 | -2,099 | -6,046 | C, M, S |
| 169. `bollinger_240m_n50_k2_reclaim_long_indicator_or12h` | 46/+1,188 | 43/+775 | 11/+557 | 9/-53 | -2,116 | -5,049 | N, P, C, M, S |
| 170. `bollinger_30m_n50_k3_into_long_indicator_or12h` | 65/+1,187 | 65/+1,416 | 22/+459 | 22/+441 | -2,118 | -5,789 | C, M |
| 171. `bollinger_5m_n50_k2_reclaim_long_indicator_or12h` | 1133/+1,179 | 1131/-787 | 274/-686 | 273/-1,302 | -2,125 | -5,957 | P, C, M, S |
| 172. `bollinger_240m_n20_k3_into_long_fixed12h` | 6/+1,079 | 6/+1,204 | 0/+0 | 0/+0 | -2,225 | -5,789 | N, P, C, M, S |
| 173. `bollinger_240m_n20_k3_into_long_indicator_or12h` | 6/+1,079 | 6/+1,204 | 0/+0 | 0/+0 | -2,225 | -5,789 | N, P, C, M, S |
| 174. `bollinger_60m_n20_k2_breakout_long_fixed12h` | 229/+1,068 | 225/+1,525 | 63/+711 | 61/+909 | -2,236 | -4,516 | C, M, S |
| 175. `bollinger_60m_n50_k2_breakout_long_indicator_or12h` | 145/+1,036 | 142/+1,644 | 38/+1,426 | 37/+1,628 | -2,269 | -4,219 | C, M, S |
| 176. `bollinger_30m_n20_k3_into_long_indicator_or12h` | 47/+619 | 46/+167 | 13/-900 | 13/-1,095 | -2,686 | -5,550 | P, C, M, S |
| 177. `bollinger_5m_n50_k3_into_long_indicator_or12h` | 380/+554 | 380/-1,085 | 98/-491 | 98/-816 | -2,751 | -6,303 | P, C, M, S |
| 178. `bollinger_15m_n50_k3_reclaim_long_fixed12h` | 128/+341 | 128/+301 | 32/-172 | 32/-199 | -2,963 | -5,261 | P, C, M, S |
| 179. `bollinger_30m_n50_k3_into_long_fixed12h` | 65/+78 | 65/+469 | 22/+625 | 22/+608 | -3,226 | -5,789 | C, M, S |
| 180. `bollinger_60m_n50_k2_breakout_long_fixed12h` | 144/-31 | 141/+175 | 38/+1,101 | 37/+1,323 | -3,336 | -4,226 | P, C, M, S |
| 181. `bollinger_240m_n20_k3_reclaim_long_fixed12h` | 6/-243 | 6/-261 | 0/+0 | 0/+0 | -3,548 | -5,789 | N, P, C, M, S |
| 182. `bollinger_240m_n20_k3_reclaim_long_indicator_or12h` | 6/-243 | 6/-261 | 0/+0 | 0/+0 | -3,548 | -5,789 | N, P, C, M, S |
| 183. `bollinger_30m_n20_k3_into_long_fixed12h` | 47/-291 | 46/-825 | 13/-1,416 | 13/-1,540 | -3,595 | -5,697 | P, C, M, S |
| 184. `bollinger_5m_n20_k3_reclaim_long_indicator_or12h` | 310/-302 | 310/-988 | 86/-520 | 86/-101 | -3,607 | -6,413 | P, C, M, S |
| 185. `bollinger_60m_n20_k2_reclaim_long_fixed12h` | 216/-415 | 215/-67 | 51/-1,001 | 51/-563 | -3,720 | -5,684 | P, C, M, S |
| 186. `bollinger_30m_n50_k3_reclaim_long_indicator_or12h` | 65/-443 | 65/-528 | 22/-64 | 22/-127 | -3,748 | -5,789 | P, C, M, S |
| 187. `bollinger_60m_n50_k2_reclaim_long_indicator_or12h` | 138/-488 | 134/-378 | 34/-507 | 32/-602 | -3,793 | -5,902 | P, C, M, S |
| 188. `bollinger_60m_n20_k3_into_long_indicator_or12h` | 31/-497 | 31/-748 | 11/-128 | 11/-355 | -3,801 | -5,789 | P, C, M, S |
| 189. `bollinger_60m_n20_k3_into_long_fixed12h` | 31/-500 | 31/-740 | 11/-242 | 11/-469 | -3,805 | -5,789 | P, C, M, S |
| 190. `bollinger_15m_n20_k3_into_long_fixed12h` | 108/-723 | 108/-783 | 22/+175 | 22/+11 | -4,027 | -6,349 | P, C, M, S |
| 191. `bollinger_240m_n50_k2_into_long_fixed12h` | 44/-891 | 40/-1,864 | 11/+1,060 | 11/+1,170 | -4,196 | -5,945 | P, C, M, S |
| 192. `bollinger_240m_n50_k2_into_long_indicator_or12h` | 44/-891 | 40/-1,864 | 11/+1,060 | 11/+1,170 | -4,196 | -5,945 | P, C, M, S |
| 193. `bollinger_240m_n50_k2_breakout_long_fixed12h` | 58/-893 | 58/-1,248 | 16/+1,796 | 16/+1,712 | -4,198 | -6,609 | P, C, M, S |
| 194. `bollinger_240m_n50_k2_breakout_long_indicator_or12h` | 58/-893 | 58/-1,248 | 16/+1,796 | 16/+1,712 | -4,198 | -6,609 | P, C, M, S |
| 195. `bollinger_240m_n50_k3_into_long_fixed12h` | 7/-964 | 7/-736 | 1/-81 | 1/-91 | -4,269 | -5,789 | N, P, C, M, S |
| 196. `bollinger_240m_n50_k3_into_long_indicator_or12h` | 7/-964 | 7/-736 | 1/-81 | 1/-91 | -4,269 | -5,789 | N, P, C, M, S |
| 197. `bollinger_15m_n20_k3_breakout_long_indicator_or12h` | 137/-1,009 | 137/-505 | 45/+2,729 | 45/+2,832 | -4,313 | -4,584 | P, C, M, S |
| 198. `bollinger_15m_n50_k3_reclaim_long_indicator_or12h` | 129/-1,158 | 129/-1,251 | 33/-1,269 | 33/-1,195 | -4,463 | -5,850 | P, C, M, S |
| 199. `bollinger_30m_n50_k2_into_long_indicator_or12h` | 223/-1,210 | 220/-1,379 | 52/+662 | 51/+467 | -4,514 | -6,786 | P, C, M, S |
| 200. `bollinger_15m_n20_k3_breakout_long_fixed12h` | 131/-1,229 | 130/-643 | 42/+2,247 | 42/+2,531 | -4,534 | -3,991 | P, C, M, S |
| 201. `bollinger_240m_n50_k3_reclaim_long_fixed12h` | 8/-1,265 | 8/-1,064 | 1/-105 | 1/-92 | -4,570 | -5,789 | N, P, C, M, S |
| 202. `bollinger_240m_n50_k3_reclaim_long_indicator_or12h` | 8/-1,265 | 8/-1,064 | 1/-105 | 1/-92 | -4,570 | -5,789 | N, P, C, M, S |
| 203. `bollinger_15m_n50_k3_into_long_indicator_or12h` | 129/-1,337 | 129/-1,778 | 33/-744 | 33/-818 | -4,642 | -5,725 | P, C, M, S |
| 204. `bollinger_60m_n50_k3_into_long_fixed12h` | 27/-1,347 | 27/-1,338 | 7/-724 | 7/-783 | -4,651 | -5,789 | N, P, C, M, S |
| 205. `bollinger_15m_n20_k3_reclaim_long_fixed12h` | 108/-1,353 | 107/-1,319 | 22/+35 | 22/+112 | -4,658 | -6,253 | P, C, M, S |
| 206. `bollinger_60m_n50_k3_into_long_indicator_or12h` | 27/-1,484 | 27/-1,504 | 7/-781 | 7/-883 | -4,788 | -5,789 | N, P, C, M, S |
| 207. `bollinger_60m_n50_k3_reclaim_long_indicator_or12h` | 27/-1,484 | 27/-1,623 | 7/-1,225 | 7/-1,279 | -4,789 | -5,789 | N, P, C, M, S |
| 208. `bollinger_30m_n20_k3_reclaim_long_indicator_or12h` | 47/-1,491 | 46/-1,355 | 13/-1,754 | 13/-1,816 | -4,796 | -5,578 | P, C, M, S |
| 209. `bollinger_60m_n50_k3_reclaim_long_fixed12h` | 27/-1,581 | 27/-1,732 | 7/-1,283 | 7/-1,331 | -4,886 | -5,789 | N, P, C, M, S |
| 210. `bollinger_60m_n20_k3_reclaim_long_fixed12h` | 31/-1,585 | 31/-1,865 | 11/-1,186 | 11/-1,290 | -4,889 | -5,789 | P, C, M, S |
| 211. `bollinger_60m_n20_k3_reclaim_long_indicator_or12h` | 31/-1,604 | 31/-1,926 | 11/-841 | 11/-934 | -4,909 | -5,789 | P, C, M, S |
| 212. `bollinger_5m_n50_k3_reclaim_long_indicator_or12h` | 380/-1,770 | 380/-2,354 | 98/-510 | 98/-488 | -5,075 | -6,202 | P, C, M, S |
| 213. `bollinger_30m_n50_k3_reclaim_long_fixed12h` | 65/-1,779 | 65/-1,663 | 22/+28 | 22/+2 | -5,084 | -5,789 | P, C, M, S |
| 214. `bollinger_30m_n20_k2_breakout_long_indicator_or12h` | 424/-2,200 | 421/-2,286 | 110/+2,060 | 110/+1,503 | -5,505 | -4,638 | P, C, M, S |
| 215. `bollinger_15m_n20_k3_reclaim_long_indicator_or12h` | 114/-2,226 | 114/-2,392 | 24/-570 | 24/-459 | -5,530 | -6,478 | P, C, M, S |
| 216. `bollinger_15m_n20_k3_into_long_indicator_or12h` | 114/-2,399 | 114/-2,569 | 24/-570 | 24/-765 | -5,704 | -6,391 | P, C, M, S |
| 217. `bollinger_5m_n50_k2_breakout_short_indicator_or12h` | 1131/-28,732 | 1131/-25,100 | 273/-5,730 | 273/-4,590 | -6,450 | -4,170 | P, C, M, S |
| 218. `bollinger_30m_n20_k3_reclaim_long_fixed12h` | 47/-3,354 | 46/-3,380 | 13/-2,474 | 13/-2,505 | -6,658 | -5,811 | P, C, M, S |
| 219. `bollinger_15m_n50_k2_breakout_long_indicator_or12h` | 429/-3,479 | 428/-2,265 | 115/+1,504 | 114/+1,843 | -6,783 | -4,231 | P, C, M, S |
| 220. `bollinger_30m_n50_k2_breakout_long_fixed12h` | 236/-3,893 | 232/-3,460 | 62/-431 | 61/-305 | -7,197 | -4,656 | P, C, M, S |
| 221. `bollinger_240m_n20_k2_into_long_indicator_or12h` | 67/-4,294 | 59/-1,969 | 13/-1,191 | 13/-1,132 | -7,599 | -5,999 | P, C, M, S |
| 222. `bollinger_240m_n20_k2_into_long_fixed12h` | 67/-4,335 | 59/-2,043 | 13/-1,191 | 13/-1,132 | -7,639 | -5,999 | P, C, M, S |
| 223. `bollinger_5m_n20_k2_into_long_indicator_or12h` | 2342/-4,395 | 2342/-9,210 | 599/+1,580 | 599/+700 | -7,699 | -6,379 | P, C, M, S |
| 224. `bollinger_30m_n50_k2_reclaim_long_indicator_or12h` | 222/-4,409 | 219/-4,648 | 51/+601 | 49/+147 | -7,714 | -6,380 | P, C, M, S |
| 225. `bollinger_30m_n50_k2_into_long_fixed12h` | 217/-5,144 | 213/-6,123 | 50/-824 | 49/-1,006 | -8,448 | -6,999 | P, C, M, S |
| 226. `bollinger_5m_n20_k3_breakout_long_indicator_or12h` | 347/-5,399 | 347/-3,527 | 111/-1,127 | 111/-828 | -8,703 | -5,123 | P, C, M, S |
| 227. `bollinger_30m_n20_k2_breakout_long_fixed12h` | 372/-6,519 | 364/-6,551 | 96/+1,811 | 93/+1,879 | -9,824 | -5,697 | P, C, M, S |
| 228. `bollinger_240m_n20_k2_reclaim_long_fixed12h` | 67/-6,702 | 59/-5,469 | 14/-1,110 | 12/-1,046 | -10,006 | -5,784 | P, C, M, S |
| 229. `bollinger_240m_n20_k2_reclaim_long_indicator_or12h` | 67/-6,727 | 59/-5,444 | 14/-1,110 | 12/-1,011 | -10,032 | -5,784 | P, C, M, S |
| 230. `bollinger_30m_n50_k2_reclaim_long_fixed12h` | 217/-6,786 | 213/-6,490 | 50/-461 | 48/-580 | -10,090 | -6,132 | P, C, M, S |
| 231. `bollinger_5m_n50_k3_breakout_long_indicator_or12h` | 424/-7,160 | 424/-6,000 | 126/-29 | 126/-256 | -10,465 | -4,392 | P, C, M, S |
| 232. `bollinger_15m_n50_k2_breakout_long_fixed12h` | 372/-7,271 | 368/-4,014 | 98/+2,218 | 97/+3,493 | -10,576 | -5,301 | P, C, M, S |
| 233. `bollinger_5m_n50_k3_breakout_long_fixed12h` | 323/-8,316 | 323/-7,188 | 92/+1,258 | 92/+1,777 | -11,620 | -2,826 | P, C, M, S |
| 234. `bollinger_5m_n50_k2_breakout_long_fixed12h` | 591/-8,532 | 590/-8,321 | 150/+3,740 | 149/+3,105 | -11,836 | -3,446 | P, C, M, S |
| 235. `bollinger_5m_n20_k2_reclaim_long_indicator_or12h` | 2340/-11,423 | 2337/-13,508 | 599/-112 | 598/-1,051 | -14,727 | -6,961 | P, C, M, S |
| 236. `bollinger_15m_n20_k2_breakout_long_indicator_or12h` | 795/-14,043 | 795/-10,584 | 209/-2,670 | 209/-1,879 | -17,347 | -4,576 | P, C, M, S |
| 237. `bollinger_5m_n50_k2_breakout_long_indicator_or12h` | 1142/-16,828 | 1142/-14,368 | 294/-1,287 | 294/-1,240 | -20,133 | -5,181 | P, C, M, S |
| 238. `bollinger_15m_n20_k2_breakout_long_fixed12h` | 524/-17,094 | 521/-17,153 | 130/-163 | 129/+484 | -20,398 | -6,071 | P, C, M, S |
| 239. `bollinger_5m_n20_k2_breakout_short_indicator_or12h` | 2342/-47,153 | 2342/-42,332 | 599/-14,767 | 599/-13,886 | -24,870 | -5,255 | P, C, M, S, E |
| 240. `bollinger_5m_n20_k2_breakout_long_indicator_or12h` | 2318/-40,184 | 2318/-34,670 | 609/-11,720 | 609/-10,961 | -43,489 | -6,606 | P, C, M, S, E |
