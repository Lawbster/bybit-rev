# I09: ATR-normalized movement and efficiency — standalone findings

September 6, 2026. Individual-indicator research only. ATR movement and signed
efficiency are **separate branches**, not a combined strategy. No live/config,
ladder, short-state, commit, push or deployment changes.

## TL;DR

- **720 new definitions, 2,888 verified cases:** 39 descriptive survivors (8 ATR, 31 efficiency; all long), **zero complete strict-screen qualifiers**. 504 definitions meet the trade-count floor; 216 remain sparse. These are bounded normalized-movement entries, not ATR stops or a ladder replay.
- On $10k fixed notional, the highest-full-net survivor E1 earns **+$12,441 full / +$4,694 recent**, versus the long clock **+$3,305 / +$5,038**. The leading ATR rule A1 earns **+$11,876 / +$7,439**, but delay reduces those to +$8,234 / +$5,282. All five overall profit leaders hold through the October 2025 collapse.
- E5's hourly efficiency continuation/zero exit is a distinct lower-DD lead: **+$7,341 / +$3,781**, 235/62 closes, DD **12.39% / 4.42%** versus clock **33.09% / 12.94%**. It sacrifices recent upside and fails monthly comparisons. **No short survivor or live/ladder change is justified by this pass.**

## Frozen comparison contract

| Item | Meaning |
|---|---|
| Full window | 2025-07-01 00:00 →2026-09-04 19:01 UTC |
| Recent window | 2026-05-17 20:43 →2026-09-04 19:01 UTC; overlaps full, previously mined |
| Seed / data | Fixed June1,2025 seed; same663,541 continuous minute observations and explicit11-minute repair used by I01–I08 |
| Position / account | $10,000 fixed entry notional, $32,000 initial equity; one position per independent rule, no averaging/compounding |
| Signal / execution | Fully completed selected-timeframe bars; next minute-open under modeled zero publication lag; separate+1m to BOTH entry and exit |
| Fees / funding | 0.055% each side on actual notional; after trading fees, **before funding**, incomplete settlement archive |
| Extra costs | Additional5bps/side on unchanged traded/marked turnover, not a slippage-path or queue simulation |
| Exit | Fixed12h from actual entry or first subsequent metric-zero condition capped12h |
| Baseline | Same-side rolling12h clock, not exposure-matched and not the Martingale ladder; optional exits retain own fixed12h |
| Cutoff / monthly | Open inventory marked including hypothetical exit fee, not a completed trade; monthlies use equity marks and fees when incurred |
| Drawdown | Prior close-equity peak to minute adverse price, on $32k equity; no inferred intraminute ordering |
| Limits | No actual funding, publication-history, liquidation/shared collateral, portfolio overlay or live execution certification |

Do not add overlapping windows, correlated rules, delay cases or their PnLs.
These are not improvements in dollars or percent to the deployed ladder.
Cash earns$0. Fixed-initial-quantity buy/hold context is+$11,511 full /
+$8,383 recent before funding; its changing marked notional is not matched
exposure. Clock net includes cutoff inventory, not just completed W/L.

## What exactly was tested

All use **5m/15m/30m/1h/4h** closed bars and both sides.

| Branch | Signed metric / grid | Definitions |
|---|---|---:|
| ATR-normalized movement | One-bar close change / preceding ATR14; levels0.5/1/2 | 180 |
| Efficiency | N-bar signed displacement / N-bar absolute close travel; N10/20/40, levels0.25/0.50/0.75 | 540 |

Each parameter/clock/level has three entry interpretations and two exits:
720 new definitions total;2,880 window/delay strategy cases plus eight
repeated clock controls=2,888 cases. No prior standalone ATR/ER entry repeats.
Existing ATR14 math is revalidation, not a new indicator family.

Let v=entry-side sign × signed metric and k=positive threshold:

- **trend:** previous v<=k, current v>k — follow the directional move;
- **into:** previous v>=−k, current v<−k — fade a newly extreme opposite move;
- **recovery:** previous v<=−k, current v>−k — wait for the metric to retreat.

The crossing is strict on the current side, inclusive on the previous side.
No persistent-state entries, queued crossings or future confirmation. Exits
are fixed12h or earliest subsequent zero condition: trend signed<=0;
into/recovery signed>=0. Timeout wins ties; no entry-observation exit;
pending decisions immutable, occupied opportunities skipped. Normalization
is not a guaranteed TP, and “recovery” does **not** promise price has bounced.

ATR itself is unsigned volatility; ordinary ER is unsigned price-path
efficiency, not informational market efficiency or a predicted direction.
The signed displacement explicitly supplies direction. Reference definitions:
[Fidelity ATR](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr),
[TradingView's ER calculation](https://www.tradingview.com/support/solutions/43000773012-kaufman-s-adaptive-moving-average-kama/).
The latter describes ER within KAMA; this study does **not** implement KAMA.

### Formula and causal timing

Formula identity: `atr14-prior-scale-er-signed-v1`.

ATR14 uses true range from bar1 against previous close. Seed first14 changes
with their arithmetic mean; update (previous×13+TR)/14. **The current shock
is excluded from its own scale:** signed movement divides current close
change by ATR[t−1], first valid index15. Zero/unavailable preceding ATR is
null, not an enormous artificial signal. Current ATR14 matches the shared
validated module exactly on allfive clocks.

Signed ER=(close[t]−close[t−N])/sum(abs(close[j]−close[j−1])),
j=t−N+1..t. N+1 closes are needed; first valid indexN. Flat zero travel gives
valid0, distinct from null warmup. Ordinary ER=abs(signed ER). No rounding,
clamping, gap bridging, current forming bar, moving seed or future data.
Both ATR recovery and rolling ER retreat may occur without price reversing.

### Screens frozen before outcomes

Strict: >=30 full/10 recent closes in both delays, positive absolute net and
own-clock delta allfour cases, every monthly marked delta>=−1e−8, positive
extra-cost net, no equity exhaustion. The separately frozen descriptive
sample/net/cost/solvency subset retains failed clock/monthly comparisons.
Rank its overall and per-branch topfive by full immediate net; also retain
raw full-clock-delta topfive. No relaxed deployment gate.

Sparse definitions remain inconclusive; post-equity-exhaustion fixed-notional
diagnostics do not represent executable account results. A strict monthly
clock condition is deliberately demanding; failing it is not proof that
every selective strategy or the whole indicator family is useless.


## Results: baseline, wins, losses and open inventory

A/E labels rank the descriptive subset within each branch by full immediate
absolute net. The overall top five are **E1, A1, A2, A3, E2**, not a different
set of optimized rules. R labels are the raw top five by full same-side clock
delta across all 720 definitions; their favorable delta against a losing short
clock must not hide negative recent absolute profit.

| Label | Exact interpretation | Exact rule ID |
|---|---|---|
| A1 | 30m ATR14 move crosses below −0.5; long / 12h | `atr_move_30m_n14_into_t0.5_long_fixed12h` |
| A2 | 5m ATR14 move crosses below −2; long / 12h | `atr_move_5m_n14_into_t2_long_fixed12h` |
| A3 | 1h ATR14 move crosses below −0.5; long / 12h | `atr_move_60m_n14_into_t0.5_long_fixed12h` |
| A4 | 1h ATR14 move crosses below −1; long / 12h | `atr_move_60m_n14_into_t1_long_fixed12h` |
| A5 | 5m ATR14 move recovers above −2; long / 12h | `atr_move_5m_n14_recovery_t2_long_fixed12h` |
| E1 | 30m ER10 crosses below −0.25; long / 12h | `efficiency_30m_n10_into_t0.25_long_fixed12h` |
| E2 | 5m ER40 crosses below −0.25; long / 12h | `efficiency_5m_n40_into_t0.25_long_fixed12h` |
| E3 | 15m ER20 crosses below −0.25; long / 12h | `efficiency_15m_n20_into_t0.25_long_fixed12h` |
| E4 | 5m ER10 crosses below −0.5; long / 12h | `efficiency_5m_n10_into_t0.5_long_fixed12h` |
| E5 | 1h ER20 crosses above +0.25; long / ER<=0 or 12h | `efficiency_60m_n20_trend_t0.25_long_indicator_or12h` |
| R1 | 30m ER20 crosses above +0.5; short / 12h | `efficiency_30m_n20_into_t0.5_short_fixed12h` |
| R2 | 4h ER20 crosses above +0.25; short / 12h | `efficiency_240m_n20_into_t0.25_short_fixed12h` |
| R3 | 30m ATR14 move crosses below −2; short / 12h | `atr_move_30m_n14_trend_t2_short_fixed12h` |
| R4 | 1h ATR14 move crosses below −2; short / 12h | `atr_move_60m_n14_trend_t2_short_fixed12h` |
| R5 | 5m ER20 crosses above +0.75; short / 12h | `efficiency_5m_n20_into_t0.75_short_fixed12h` |

Amounts below are USD rounded independently. W/L counts completed trades;
winning and losing dollars already include fees. **Net = winning dollars +
losing dollars + open mark** (up to rounding); do not subtract fees again.
DD is account-equity drawdown, not the adverse percentage of an individual
trade. Zero-delay execution is a model, not a claim of zero live latency.

### Full: July 1, 2025 → September 4, 2026 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Δ clock $ | DD |
|---|---|---|---|---|---|---|---|---|
| clock_long | 861 | 420/441 | +110,950 | −107,401 | −245 | +3,305 | — | 33.09% |
| A1 | 736 | 365/371 | +94,045 | −82,118 | −51 | +11,876 | +8,572 | 23.60% |
| A2 | 386 | 208/178 | +52,397 | −41,200 | −71 | +11,127 | +7,822 | 16.33% |
| A3 | 631 | 311/320 | +83,614 | −73,179 | 0 | +10,435 | +7,130 | 21.91% |
| A4 | 326 | 171/155 | +49,206 | −39,766 | −51 | +9,390 | +6,085 | 19.41% |
| A5 | 386 | 209/177 | +50,989 | −41,688 | −79 | +9,222 | +5,917 | 16.67% |
| E1 | 555 | 291/264 | +74,651 | −62,210 | 0 | +12,441 | +9,137 | 18.22% |
| E2 | 493 | 247/246 | +67,656 | −57,479 | 0 | +10,177 | +6,872 | 20.80% |
| E3 | 496 | 252/244 | +66,227 | −56,134 | 0 | +10,093 | +6,789 | 16.21% |
| E4 | 712 | 353/359 | +92,345 | −83,634 | −53 | +8,658 | +5,353 | 23.40% |
| E5 | 235 | 116/119 | +32,871 | −25,530 | 0 | +7,341 | +4,036 | 12.39% |
| clock_short | 861 | 414/447 | +98,162 | −120,668 | +223 | −22,283 | — | 71.27% |
| R1 | 119 | 65/54 | +19,876 | −17,610 | 0 | +2,265 | +24,548 | 14.49% |
| R2 | 86 | 48/38 | +13,142 | −11,329 | 0 | +1,812 | +24,095 | 7.93% |
| R3 | 77 | 43/34 | +9,592 | −7,874 | +29 | +1,747 | +24,030 | 12.44% |
| R4 | 38 | 21/17 | +5,539 | −4,163 | 0 | +1,376 | +23,659 | 13.39% |
| R5 | 58 | 31/27 | +7,695 | −6,445 | 0 | +1,250 | +23,532 | 6.23% |

### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Δ clock $ | DD |
|---|---|---|---|---|---|---|---|---|
| clock_long | 219 | 114/105 | +29,120 | −23,837 | −245 | +5,038 | — | 12.94% |
| A1 | 185 | 101/84 | +24,312 | −16,823 | −51 | +7,439 | +2,400 | 8.80% |
| A2 | 101 | 61/40 | +15,873 | −10,006 | −71 | +5,796 | +758 | 7.98% |
| A3 | 160 | 86/74 | +21,362 | −17,034 | 0 | +4,328 | −710 | 9.23% |
| A4 | 81 | 43/38 | +12,845 | −9,073 | −51 | +3,721 | −1,317 | 9.14% |
| A5 | 101 | 63/38 | +15,604 | −9,741 | −79 | +5,784 | +746 | 7.34% |
| E1 | 140 | 77/63 | +18,233 | −13,538 | 0 | +4,694 | −344 | 8.71% |
| E2 | 121 | 62/59 | +17,225 | −11,235 | 0 | +5,990 | +951 | 7.29% |
| E3 | 125 | 70/55 | +18,212 | −11,642 | 0 | +6,570 | +1,532 | 9.79% |
| E4 | 181 | 96/85 | +25,100 | −18,081 | −53 | +6,967 | +1,928 | 10.30% |
| E5 | 62 | 36/26 | +8,875 | −5,094 | 0 | +3,781 | −1,257 | 4.42% |
| clock_short | 219 | 97/122 | +21,666 | −31,775 | +223 | −9,887 | — | 32.54% |
| R1 | 32 | 20/12 | +3,946 | −4,973 | 0 | −1,027 | +8,860 | 8.89% |
| R2 | 24 | 14/10 | +2,239 | −3,419 | 0 | −1,180 | +8,707 | 5.98% |
| R3 | 19 | 10/9 | +2,416 | −3,773 | +29 | −1,328 | +8,559 | 8.85% |
| R4 | 11 | 6/5 | +1,458 | −1,777 | 0 | −319 | +9,568 | 4.32% |
| R5 | 8 | 2/6 | +368 | −1,543 | 0 | −1,175 | +8,712 | 5.90% |

### Delay and extra-cost sensitivity

Each cell is **net / extra-cost net**, USD; +1m delays BOTH entry and exit.
These are separate full-path ledgers: delays also change occupied/skipped
opportunities, so differences are not just one minute's entry slippage.
The extra-cost column is a same-path extra 5bps/side charge, not a new fill
simulation. Cash $0; no baseline is omitted.

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m |
|---|---|---|---|---|
| clock_long | +3,305 / −5,322 | +3,792 / −4,815 | +5,038 / +2,835 | +5,104 / +2,910 |
| A1 | +11,876 / +4,496 | +8,234 / +1,126 | +7,439 / +5,574 | +5,282 / +3,469 |
| A2 | +11,127 / +7,249 | +9,719 / +5,852 | +5,796 / +4,773 | +5,699 / +4,686 |
| A3 | +10,435 / +4,116 | +9,067 / +3,079 | +4,328 / +2,725 | +4,026 / +2,493 |
| A4 | +9,390 / +6,113 | +9,692 / +6,586 | +3,721 / +2,899 | +3,533 / +2,741 |
| A5 | +9,222 / +5,345 | +8,365 / +4,498 | +5,784 / +4,761 | +5,951 / +4,938 |
| E1 | +12,441 / +6,882 | +11,800 / +6,381 | +4,694 / +3,291 | +5,368 / +4,014 |
| E2 | +10,177 / +5,239 | +10,026 / +5,108 | +5,990 / +4,776 | +6,252 / +5,038 |
| E3 | +10,093 / +5,126 | +9,847 / +4,910 | +6,570 / +5,316 | +6,674 / +5,430 |
| E4 | +8,658 / +1,520 | +10,820 / +3,700 | +6,967 / +5,142 | +7,086 / +5,271 |
| E5 | +7,341 / +4,986 | +7,380 / +5,095 | +3,781 / +3,159 | +4,273 / +3,650 |
| clock_short | −22,283 / −30,909 | −22,726 / −31,333 | −9,887 / −12,090 | −9,930 / −12,124 |
| R1 | +2,265 / +1,077 | +2,237 / +1,049 | −1,027 / −1,347 | −1,017 / −1,337 |
| R2 | +1,812 / +954 | +2,270 / +1,442 | −1,180 / −1,420 | −1,406 / −1,636 |
| R3 | +1,747 / +969 | +950 / +181 | −1,328 / −1,528 | −1,323 / −1,513 |
| R4 | +1,376 / +997 | +1,557 / +1,188 | −319 / −429 | −10 / −110 |
| R5 | +1,250 / +671 | +1,274 / +695 | −1,175 / −1,255 | −1,109 / −1,189 |

A1's +1m recent edge over clock is only **$179**, despite its headline $2,400
immediate advantage. A2 and A5 retain approximately $595 / $848 delayed recent
clock advantages. E1's recent clock delta changes sign with delay; do not
present it as uniformly beating the recent baseline. All three are development
observations on the same already-mined history, not independent confirmation.

## What the two branches tell us

### ATR: normalized dip entries, not yet a bleeding-control mechanism

The strongest sampled ATR entries buy weakness. A2 buys a fresh five-minute
drop exceeding two **preceding** ATR14 units. A5 waits for that normalized
reading to recover above −2, but this does not require the price to rise.

| Case | Clock net $ | A2 into −2 net $ | A5 recovery net $ | Recovery − into $ |
|---|---|---|---|---|
| full / 0m | +3,305 | +11,127 | +9,222 | −1,905 |
| full / 1m | +3,792 | +9,719 | +8,365 | −1,354 |
| recent / 0m | +5,038 | +5,796 | +5,784 | −12 |
| recent / 1m | +5,104 | +5,699 | +5,951 | +252 |

Recovery sacrifices $1,905 full immediate net and does not avoid October's
collapse: A2's worst price excursion is −50.46%; A5's is −50.14%. The recent
A5 DD is modestly lower (7.34% versus 7.98%) and delayed recent net modestly
higher, but that does not establish a consistently safer entry.

This is a test of observed price direction divided by prior volatility.
It is **not** a test of changing the ladder's last rung, an unsigned ATR
volatility veto, or ATR-derived position sizing/stops.

### Efficiency: keep directional continuation distinct from fading

E1/E2/E3/E4 buy newly efficient **downward** movement, expecting a later
rebound; they do not follow an efficient uptrend. E5 instead follows a fresh
hourly ER20 move above +0.25 and exits at the first subsequent ER<=0 or 12h.
It survives the bounded cost/sample checks with lower observed DD, but earns
less than the recent clock and is concentrated in a few winners.

The same hourly ER20/+0.25 parameter set's other entry interpretations were
already in the frozen grid; these are comparisons, not additional tuning:

| Hourly ER20 long | Full net $ | Recent net $ | Full / recent closes | Full / recent DD |
|---|---|---|---|---|
| Clock baseline | +3,305 | +5,038 | 861 / 219 | 33.09% / 12.94% |
| trend t0.25 long fixed12h | +4,690 | +3,482 | 232 / 61 | 19.66% / 5.47% |
| trend t0.25 long indicator or12h | +7,341 | +3,781 | 235 / 62 | 12.39% / 4.42% |
| into t0.25 long fixed12h | +3,783 | +2,787 | 228 / 58 | 15.17% / 4.64% |
| into t0.25 long indicator or12h | +3,128 | +1,752 | 230 / 58 | 15.33% / 4.51% |
| recovery t0.25 long fixed12h | +5,098 | +5,689 | 223 / 57 | 20.49% / 6.36% |
| recovery t0.25 long indicator or12h | +315 | +2,651 | 225 / 57 | 17.05% / 6.10% |

No standalone result here certifies ER as an incremental ladder filter.
The benefit of cutting an existing ladder versus merely opening a separate
small trade has not been measured.

### Exit comparison: zero normalization is not generically better

Own fixed-12h companions are the relevant exit controls, alongside the clock.
Changing exit changes future eligibility too; these are not matched-trade
exit-only markups.

| Entry | Case | Clock $ | Own fixed12h $ | Zero-or12h $ | Δ own $ |
|---|---|---|---|---|---|
| A1 | full/0m | +3,305 | +11,876 | −14,736 | −26,612 |
| A1 | full/1m | +3,792 | +8,234 | −21,384 | −29,618 |
| A1 | recent/0m | +5,038 | +7,439 | −1,892 | −9,330 |
| A1 | recent/1m | +5,104 | +5,282 | −3,118 | −8,400 |
| A2 | full/0m | +3,305 | +11,127 | −2,866 | −13,993 |
| A2 | full/1m | +3,792 | +9,719 | −4,965 | −14,683 |
| A2 | recent/0m | +5,038 | +5,796 | −1,312 | −7,108 |
| A2 | recent/1m | +5,104 | +5,699 | −1,057 | −6,756 |
| E1 | full/0m | +3,305 | +12,441 | −386 | −12,827 |
| E1 | full/1m | +3,792 | +11,800 | −2,307 | −14,107 |
| E1 | recent/0m | +5,038 | +4,694 | +2,425 | −2,269 |
| E1 | recent/1m | +5,104 | +5,368 | +1,798 | −3,570 |
| E5 | full/0m | +3,305 | +4,690 | +7,341 | +2,651 |
| E5 | full/1m | +3,792 | +4,886 | +7,380 | +2,494 |
| E5 | recent/0m | +5,038 | +3,482 | +3,781 | +300 |
| E5 | recent/1m | +5,104 | +3,873 | +4,273 | +400 |

A1's short-horizon zero exit increases full immediate closes from 736 to
2,942 and turns +$11,876 into −$14,736. A2 also becomes negative. E1's full
net turns slightly negative. These are explicit failed upgrades, not a
general verdict against all fast exits.

E5 is the contrast: its zero exit improves its own full net by $2,651
immediate / $2,494 delayed; recent by $300 / $400. Full immediate DD falls
19.66%→12.39%, recent 5.47%→4.42%. Keep this specific entry/exit pair in the
individual-indicator register, not as permission to add a generic zero exit.

## Short findings: no adequately sampled cost-tolerant survivor

Of 360 short definitions, 252 meet the count floor and 108 are sparse;
**zero** pass the descriptive subset. The five raw full-clock-delta leaders
all lose in the recent window. Their complete W/L, delay and monthly results
remain in this report instead of advertising the +$23k–$25k improvement
against the very losing full short clock.

Only four short definitions have positive absolute net in all four cases:

- Two 4h ER20 fade-above-0.75 exit variants share the same tiny ledger:
  4 full immediate closes (3 delayed), just 1 recent. Full +$371 / recent +$255.
  **Sparse, not falsified as a family and not actionable evidence.**
- 4h ATR14 below−2 momentum short with zero exit: 7 full / 2 recent,
  +$313 / +$780. Also sparse.
- 4h ATR14 below−1 momentum short /12h: 112 full /25 recent,
  +$29 /+$698. Full extra-cost net is **−$1,100**, delayed **−$710**.
  Adequate sample but no cost margin.

The best raw short R1 earns +$2,265 full but −$1,027 recent. R3 loses $1,860
in its August 19 squeeze trade after approximately 23.82% adverse price
movement. A short-clock delta does not establish a usable standalone short.

## Month-by-month regimes and invisible upside

All values below are **marked-equity PnL**, not closed-trade month attribution.
Each rule column shows **net (Δ versus same-side clock)**; clock is explicit.
Full and recent are separate flat starts; recent May is partial and its state
can differ later as well. September 2026 ends at September 4 19:01 UTC.
Do not sum the two windows.

All overall descriptive top-five, per-branch top-five and raw top-five
monthlies are covered below for BOTH delays. No favorable-month-only subset.

### ATR top five — full, 0m

| Month | clock_long $ | A1 $ (Δ) | A2 $ (Δ) | A3 $ (Δ) | A4 $ (Δ) | A5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −161 | +1,013 (+1,174) | +382 (+543) | +877 (+1,038) | +454 (+616) | +702 (+863) |
| 2025-08 | +510 | +740 (+230) | +1,742 (+1,232) | +406 (−104) | +1,664 (+1,153) | +1,650 (+1,139) |
| 2025-09 | −109 | +726 (+836) | +1,359 (+1,469) | +1,225 (+1,335) | +874 (+983) | +944 (+1,053) |
| 2025-10 | −470 | −698 (−227) | −1,250 (−780) | −865 (−394) | +154 (+625) | −1,813 (−1,343) |
| 2025-11 | −3,287 | −1,625 (+1,662) | +1,566 (+4,853) | −1,675 (+1,612) | −761 (+2,526) | +1,169 (+4,456) |
| 2025-12 | −2,574 | −2,621 (−47) | +1,139 (+3,713) | −1,443 (+1,131) | +76 (+2,649) | +573 (+3,147) |
| 2026-01 | +1,782 | +817 (−965) | −195 (−1,977) | +974 (−809) | +2,080 (+298) | −61 (−1,843) |
| 2026-02 | −122 | +1,481 (+1,603) | +53 (+175) | +1,904 (+2,026) | +205 (+327) | −426 (−304) |
| 2026-03 | +1,155 | +2,124 (+970) | +1,141 (−14) | +2,499 (+1,345) | +1,463 (+308) | +1,177 (+22) |
| 2026-04 | +307 | +1,085 (+778) | −660 (−967) | +779 (+471) | −464 (−771) | −637 (−944) |
| 2026-05 | +5,789 | +5,356 (−433) | +1,547 (−4,242) | +4,883 (−906) | +2,422 (−3,368) | +1,586 (−4,204) |
| 2026-06 | −1,256 | +714 (+1,970) | +1,868 (+3,123) | +1,085 (+2,341) | +1,300 (+2,556) | +2,028 (+3,284) |
| 2026-07 | −2,621 | −2,065 (+556) | −1,941 (+680) | −2,704 (−83) | −2,859 (−238) | −2,015 (+606) |
| 2026-08 | +4,306 | +4,505 (+199) | +4,258 (−47) | +2,495 (−1,810) | +2,747 (−1,558) | +4,265 (−41) |
| 2026-09 | +55 | +324 (+269) | +115 (+60) | −7 (−62) | +34 (−21) | +80 (+25) |

### ATR top five — full, +1m

| Month | clock_long $ | A1 $ (Δ) | A2 $ (Δ) | A3 $ (Δ) | A4 $ (Δ) | A5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −94 | +1,562 (+1,656) | +612 (+706) | +282 (+376) | −515 (−421) | +520 (+614) |
| 2025-08 | +754 | −173 (−928) | +1,585 (+831) | +745 (−9) | +713 (−41) | +1,548 (+794) |
| 2025-09 | −265 | +499 (+764) | +1,108 (+1,373) | +3,084 (+3,348) | +820 (+1,085) | +771 (+1,035) |
| 2025-10 | −484 | −1,450 (−966) | −1,635 (−1,151) | −684 (−200) | −23 (+461) | −2,101 (−1,617) |
| 2025-11 | −3,354 | −2,522 (+832) | +1,415 (+4,770) | −1,725 (+1,629) | +468 (+3,822) | +1,186 (+4,540) |
| 2025-12 | −2,606 | −937 (+1,669) | +671 (+3,278) | −903 (+1,704) | +230 (+2,836) | +308 (+2,915) |
| 2026-01 | +2,011 | +1,276 (−735) | −147 (−2,158) | −947 (−2,958) | +3,699 (+1,688) | −325 (−2,336) |
| 2026-02 | +102 | −204 (−306) | −103 (−205) | +433 (+330) | +282 (+179) | −310 (−412) |
| 2026-03 | +1,222 | +1,917 (+694) | +865 (−357) | +3,227 (+2,004) | +1,460 (+238) | +1,112 (−110) |
| 2026-04 | +243 | +923 (+680) | −608 (−851) | +787 (+544) | −898 (−1,141) | −515 (−758) |
| 2026-05 | +5,761 | +6,612 (+850) | +1,887 (−3,874) | +5,055 (−707) | +2,123 (−3,638) | +1,631 (−4,130) |
| 2026-06 | −1,159 | −343 (+816) | +1,754 (+2,913) | −561 (+597) | +1,239 (+2,398) | +2,216 (+3,375) |
| 2026-07 | −2,614 | −2,110 (+505) | −2,110 (+504) | −3,338 (−723) | −2,771 (−157) | −2,060 (+554) |
| 2026-08 | +4,311 | +2,859 (−1,452) | +4,285 (−26) | +3,468 (−843) | +2,797 (−1,513) | +4,300 (−11) |
| 2026-09 | −37 | +327 (+364) | +138 (+175) | +145 (+182) | +69 (+106) | +83 (+120) |

### ATR top five — recent, 0m

| Month | clock_long $ | A1 $ (Δ) | A2 $ (Δ) | A3 $ (Δ) | A4 $ (Δ) | A5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | +4,554 | +3,961 (−593) | +1,496 (−3,058) | +3,458 (−1,096) | +2,499 (−2,055) | +1,426 (−3,128) |
| 2026-06 | −1,256 | +714 (+1,970) | +1,868 (+3,123) | +1,085 (+2,341) | +1,300 (+2,556) | +2,028 (+3,284) |
| 2026-07 | −2,621 | −2,065 (+556) | −1,941 (+680) | −2,704 (−83) | −2,859 (−238) | −2,015 (+606) |
| 2026-08 | +4,306 | +4,505 (+199) | +4,258 (−47) | +2,495 (−1,810) | +2,747 (−1,558) | +4,265 (−41) |
| 2026-09 | +55 | +324 (+269) | +115 (+60) | −7 (−62) | +34 (−21) | +80 (+25) |

### ATR top five — recent, +1m

| Month | clock_long $ | A1 $ (Δ) | A2 $ (Δ) | A3 $ (Δ) | A4 $ (Δ) | A5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | +4,477 | +4,256 (−222) | +1,632 (−2,845) | +4,312 (−165) | +2,199 (−2,279) | +1,412 (−3,065) |
| 2026-06 | −1,129 | −50 (+1,079) | +1,754 (+2,882) | −561 (+567) | +1,239 (+2,368) | +2,216 (+3,345) |
| 2026-07 | −2,692 | −2,110 (+583) | −2,110 (+582) | −3,338 (−646) | −2,771 (−79) | −2,060 (+632) |
| 2026-08 | +4,384 | +2,859 (−1,525) | +4,285 (−98) | +3,468 (−916) | +2,797 (−1,586) | +4,300 (−84) |
| 2026-09 | +64 | +327 (+264) | +138 (+75) | +145 (+82) | +69 (+6) | +83 (+20) |

### Efficiency top five — full, 0m

| Month | clock_long $ | E1 $ (Δ) | E2 $ (Δ) | E3 $ (Δ) | E4 $ (Δ) | E5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −161 | +1,417 (+1,578) | +1,693 (+1,854) | +365 (+526) | +310 (+471) | +613 (+775) |
| 2025-08 | +510 | +1,566 (+1,055) | +2,285 (+1,775) | +1,535 (+1,024) | +2,420 (+1,909) | +169 (−341) |
| 2025-09 | −109 | −133 (−23) | −747 (−637) | +1,979 (+2,088) | −1,249 (−1,140) | −194 (−85) |
| 2025-10 | −470 | +3,742 (+4,212) | +2,121 (+2,591) | +328 (+799) | −82 (+388) | −189 (+281) |
| 2025-11 | −3,287 | −205 (+3,082) | −871 (+2,415) | +177 (+3,464) | −3,449 (−162) | −1,923 (+1,364) |
| 2025-12 | −2,574 | −282 (+2,292) | −2,177 (+397) | −608 (+1,966) | −122 (+2,452) | −357 (+2,217) |
| 2026-01 | +1,782 | −87 (−1,869) | −1,643 (−3,426) | −623 (−2,406) | −677 (−2,460) | +2,228 (+446) |
| 2026-02 | −122 | −1,761 (−1,640) | +1,626 (+1,748) | −263 (−141) | +1,423 (+1,545) | +1,403 (+1,525) |
| 2026-03 | +1,155 | +3,407 (+2,253) | +1,719 (+564) | +1,170 (+16) | +1,630 (+475) | +96 (−1,059) |
| 2026-04 | +307 | −340 (−647) | +1,162 (+855) | +586 (+279) | +496 (+189) | +143 (−164) |
| 2026-05 | +5,789 | +3,384 (−2,405) | +491 (−5,298) | +1,258 (−4,531) | +4,580 (−1,209) | +3,111 (−2,678) |
| 2026-06 | −1,256 | −349 (+907) | +1,838 (+3,093) | +2,045 (+3,301) | +1,885 (+3,140) | +1,017 (+2,273) |
| 2026-07 | −2,621 | −2,062 (+559) | −1,767 (+854) | −2,416 (+204) | −2,338 (+283) | −344 (+2,277) |
| 2026-08 | +4,306 | +3,877 (−429) | +4,232 (−73) | +4,903 (+597) | +3,659 (−646) | +1,223 (−3,083) |
| 2026-09 | +55 | +266 (+211) | +215 (+160) | −343 (−398) | +172 (+117) | +345 (+290) |

### Efficiency top five — full, +1m

| Month | clock_long $ | E1 $ (Δ) | E2 $ (Δ) | E3 $ (Δ) | E4 $ (Δ) | E5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −94 | +1,251 (+1,345) | +1,539 (+1,633) | +466 (+560) | +583 (+677) | +528 (+622) |
| 2025-08 | +754 | +1,453 (+698) | +2,306 (+1,552) | +1,755 (+1,001) | +2,180 (+1,426) | +359 (−395) |
| 2025-09 | −265 | −828 (−564) | −860 (−595) | +1,809 (+2,073) | −562 (−297) | +162 (+426) |
| 2025-10 | −484 | +3,613 (+4,097) | +2,364 (+2,849) | +479 (+963) | −132 (+353) | −517 (−33) |
| 2025-11 | −3,354 | −177 (+3,177) | −444 (+2,910) | −248 (+3,106) | −2,766 (+588) | −2,243 (+1,111) |
| 2025-12 | −2,606 | +85 (+2,692) | −2,656 (−50) | −803 (+1,803) | −120 (+2,486) | −444 (+2,163) |
| 2026-01 | +2,011 | −754 (−2,765) | −1,798 (−3,809) | −725 (−2,736) | −856 (−2,866) | +1,970 (−41) |
| 2026-02 | +102 | −1,929 (−2,032) | +1,613 (+1,510) | +73 (−30) | +1,592 (+1,490) | +1,526 (+1,424) |
| 2026-03 | +1,222 | +3,134 (+1,911) | +1,844 (+622) | +670 (−552) | +1,952 (+729) | +145 (−1,077) |
| 2026-04 | +243 | −39 (−282) | +864 (+622) | +682 (+439) | +623 (+381) | +160 (−83) |
| 2026-05 | +5,761 | +3,116 (−2,645) | +662 (−5,100) | +1,274 (−4,488) | +4,988 (−774) | +3,076 (−2,685) |
| 2026-06 | −1,159 | +872 (+2,030) | +1,744 (+2,903) | +1,909 (+3,068) | +1,953 (+3,112) | +1,287 (+2,446) |
| 2026-07 | −2,614 | −1,349 (+1,265) | −1,508 (+1,107) | −2,614 (+1) | −2,430 (+185) | −365 (+2,250) |
| 2026-08 | +4,311 | +3,570 (−740) | +4,121 (−190) | +5,438 (+1,128) | +3,431 (−879) | +1,368 (−2,943) |
| 2026-09 | −37 | −216 (−179) | +234 (+271) | −318 (−281) | +382 (+419) | +367 (+403) |

### Efficiency top five — recent, 0m

| Month | clock_long $ | E1 $ (Δ) | E2 $ (Δ) | E3 $ (Δ) | E4 $ (Δ) | E5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | +4,554 | +2,962 (−1,592) | +1,471 (−3,083) | +2,382 (−2,172) | +3,589 (−965) | +1,541 (−3,013) |
| 2026-06 | −1,256 | −349 (+907) | +1,838 (+3,093) | +2,045 (+3,301) | +1,885 (+3,140) | +1,017 (+2,273) |
| 2026-07 | −2,621 | −2,062 (+559) | −1,767 (+854) | −2,416 (+204) | −2,338 (+283) | −344 (+2,277) |
| 2026-08 | +4,306 | +3,877 (−429) | +4,232 (−73) | +4,903 (+597) | +3,659 (−646) | +1,223 (−3,083) |
| 2026-09 | +55 | +266 (+211) | +215 (+160) | −343 (−398) | +172 (+117) | +345 (+290) |

### Efficiency top five — recent, +1m

| Month | clock_long $ | E1 $ (Δ) | E2 $ (Δ) | E3 $ (Δ) | E4 $ (Δ) | E5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | +4,477 | +2,491 (−1,987) | +1,660 (−2,817) | +2,258 (−2,220) | +3,749 (−728) | +1,616 (−2,862) |
| 2026-06 | −1,129 | +872 (+2,000) | +1,744 (+2,873) | +1,909 (+3,037) | +1,953 (+3,082) | +1,287 (+2,416) |
| 2026-07 | −2,692 | −1,349 (+1,343) | −1,508 (+1,185) | −2,614 (+78) | −2,430 (+263) | −365 (+2,328) |
| 2026-08 | +4,384 | +3,570 (−813) | +4,121 (−263) | +5,438 (+1,055) | +3,431 (−952) | +1,368 (−3,015) |
| 2026-09 | +64 | −216 (−279) | +234 (+171) | −318 (−381) | +382 (+319) | +367 (+303) |

### Raw short top five — full, 0m

| Month | clock_short $ | R1 $ (Δ) | R2 $ (Δ) | R3 $ (Δ) | R4 $ (Δ) | R5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −1,203 | +286 (+1,489) | +9 (+1,212) | −450 (+754) | +421 (+1,624) | +119 (+1,323) |
| 2025-08 | −1,876 | +668 (+2,544) | +195 (+2,071) | −129 (+1,747) | +26 (+1,902) | −201 (+1,675) |
| 2025-09 | −1,211 | +556 (+1,767) | −384 (+828) | +117 (+1,328) | −116 (+1,096) | +508 (+1,719) |
| 2025-10 | −894 | −411 (+483) | +717 (+1,611) | +1,243 (+2,137) | +1,072 (+1,966) | −386 (+507) |
| 2025-11 | +1,970 | +3,406 (+1,437) | +1,612 (−358) | −189 (−2,159) | −942 (−2,911) | +445 (−1,524) |
| 2025-12 | +1,212 | −610 (−1,822) | +737 (−475) | +413 (−799) | −8 (−1,220) | +1,055 (−157) |
| 2026-01 | −3,149 | −1,851 (+1,298) | −936 (+2,213) | +1,564 (+4,713) | +599 (+3,748) | −533 (+2,616) |
| 2026-02 | −1,111 | +3,455 (+4,565) | +1,777 (+2,887) | +4 (+1,114) | +278 (+1,388) | +630 (+1,740) |
| 2026-03 | −2,521 | −121 (+2,400) | −672 (+1,849) | −137 (+2,384) | −130 (+2,390) | +145 (+2,666) |
| 2026-04 | −1,628 | −354 (+1,274) | −133 (+1,495) | +723 (+2,351) | +463 (+2,091) | −187 (+1,441) |
| 2026-05 | −7,161 | −2,453 (+4,708) | −932 (+6,228) | +156 (+7,317) | +32 (+7,193) | +257 (+7,418) |
| 2026-06 | −64 | −161 (−98) | −421 (−358) | −997 (−934) | −997 (−934) | −394 (−330) |
| 2026-07 | +1,259 | +248 (−1,011) | +571 (−688) | +1,931 (+672) | +1,127 (−132) | −205 (−1,464) |
| 2026-08 | −5,675 | −353 (+5,322) | −110 (+5,565) | −2,530 (+3,145) | −449 (+5,226) | −3 (+5,672) |
| 2026-09 | −231 | −40 (+191) | −217 (+14) | +29 (+260) | 0 (+231) | 0 (+231) |

### Raw short top five — full, +1m

| Month | clock_short $ | R1 $ (Δ) | R2 $ (Δ) | R3 $ (Δ) | R4 $ (Δ) | R5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2025-07 | −1,271 | +223 (+1,493) | +16 (+1,287) | −542 (+729) | +430 (+1,701) | +126 (+1,396) |
| 2025-08 | −2,120 | +703 (+2,823) | +162 (+2,282) | −177 (+1,942) | +11 (+2,131) | −254 (+1,865) |
| 2025-09 | −1,056 | +683 (+1,739) | −420 (+635) | +79 (+1,135) | −132 (+924) | +456 (+1,512) |
| 2025-10 | −880 | −355 (+525) | +564 (+1,444) | +1,044 (+1,924) | +1,063 (+1,943) | −363 (+517) |
| 2025-11 | +2,037 | +3,286 (+1,249) | +1,729 (−308) | −637 (−2,674) | −945 (−2,982) | +465 (−1,572) |
| 2025-12 | +1,267 | −651 (−1,918) | +637 (−630) | +498 (−769) | +13 (−1,253) | +1,060 (−206) |
| 2026-01 | −3,378 | −1,822 (+1,556) | −512 (+2,866) | +1,499 (+4,876) | +533 (+3,911) | −510 (+2,868) |
| 2026-02 | −1,335 | +3,495 (+4,830) | +1,843 (+3,178) | −16 (+1,319) | +279 (+1,614) | +626 (+1,961) |
| 2026-03 | −2,588 | −136 (+2,453) | −782 (+1,807) | −180 (+2,408) | −113 (+2,475) | +68 (+2,656) |
| 2026-04 | −1,564 | −434 (+1,130) | −107 (+1,457) | +859 (+2,423) | +502 (+2,066) | −166 (+1,398) |
| 2026-05 | −7,132 | −2,413 (+4,720) | −502 (+6,630) | +100 (+7,232) | −74 (+7,058) | +304 (+7,437) |
| 2026-06 | −139 | −224 (−86) | −428 (−289) | −781 (−643) | −781 (−643) | −456 (−317) |
| 2026-07 | +1,252 | +263 (−989) | +395 (−858) | +1,623 (+370) | +1,155 (−97) | −202 (−1,455) |
| 2026-08 | −5,680 | −355 (+5,325) | −113 (+5,567) | −2,405 (+3,275) | −384 (+5,296) | +121 (+5,801) |
| 2026-09 | −139 | −27 (+113) | −212 (−73) | −12 (+127) | 0 (+139) | 0 (+139) |

### Raw short top five — recent, 0m

| Month | clock_short $ | R1 $ (Δ) | R2 $ (Δ) | R3 $ (Δ) | R4 $ (Δ) | R5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | −5,175 | −721 (+4,455) | −1,003 (+4,172) | +240 (+5,416) | 0 (+5,175) | −573 (+4,603) |
| 2026-06 | −64 | −161 (−98) | −421 (−358) | −997 (−934) | −997 (−934) | −394 (−330) |
| 2026-07 | +1,259 | +248 (−1,011) | +571 (−688) | +1,931 (+672) | +1,127 (−132) | −205 (−1,464) |
| 2026-08 | −5,675 | −353 (+5,322) | −110 (+5,565) | −2,530 (+3,145) | −449 (+5,226) | −3 (+5,672) |
| 2026-09 | −231 | −40 (+191) | −217 (+14) | +29 (+260) | 0 (+231) | 0 (+231) |

### Raw short top five — recent, +1m

| Month | clock_short $ | R1 $ (Δ) | R2 $ (Δ) | R3 $ (Δ) | R4 $ (Δ) | R5 $ (Δ) |
|---|---|---|---|---|---|---|
| 2026-05 | −5,099 | −674 (+4,424) | −1,047 (+4,051) | +254 (+5,352) | 0 (+5,099) | −571 (+4,527) |
| 2026-06 | −191 | −224 (−33) | −428 (−237) | −781 (−591) | −781 (−591) | −456 (−265) |
| 2026-07 | +1,330 | +263 (−1,067) | +395 (−936) | +1,623 (+292) | +1,155 (−175) | −202 (−1,533) |
| 2026-08 | −5,753 | −355 (+5,398) | −113 (+5,640) | −2,405 (+3,348) | −384 (+5,369) | +121 (+5,874) |
| 2026-09 | −218 | −27 (+191) | −212 (+6) | −12 (+206) | 0 (+218) | 0 (+218) |

### Interpretation of the monthly trade-off

For full-window 0m June 2026, the long clock loses $1,256 while A2 makes
$1,868 and E5 $1,017. In July the clock loses $2,621, A2 loses $1,941 and
E5 $344: lower losses are real within this model.

The invisible cost is also real: May's long clock makes $5,789 versus A2
$1,547 and E2 $491. August's $4,306 clock profit compares with E5 $1,223.
A more selective strategy can avoid exposure and lose fewer dollars while
missing profitable recovery. None passes the frozen all-month clock condition.
That condition is deliberately demanding; failure alone is not proof of
zero economic value or that every possible ATR/ER application is dead.

## Adverse paths and winner concentration

Immediate completed trades only; end-open inventory excluded from this
supplement. Gross price excursion excludes fees and is **not account DD**.
The exit minute's high/low is excluded because execution is at its open.
Top-five winning dollars / closed net is concentration, not a rerun that
removes those trades and recreates later eligibility.

| Setup | Full worst price excursion | Gross $ at $10k | Worst entry UTC | Eventual trade net $ | Best 5 winners / closed net: full / recent |
|---|---|---|---|---|---|
| clock_long | -53.52% | −5,352 | 2025-10-10 12:00:00 | −1,601 | 199.91% / 106.49% |
| A1 | -51.49% | −5,149 | 2025-10-10 18:00:00 | −938 | 63.35% / 68.59% |
| A2 | -50.46% | −5,046 | 2025-10-10 20:55:00 | −496 | 49.18% / 72.32% |
| A3 | -50.98% | −5,098 | 2025-10-10 19:00:00 | −807 | 62.82% / 95.75% |
| A4 | -53.09% | −5,309 | 2025-10-10 15:00:00 | −1,163 | 76.68% / 151.92% |
| A5 | -50.14% | −5,014 | 2025-10-10 21:05:00 | −419 | 57.14% / 73.33% |
| E1 | -49.05% | −4,905 | 2025-10-10 21:00:00 | −232 | 43.69% / 77.21% |
| E2 | -49.05% | −4,905 | 2025-10-10 21:00:00 | −232 | 58.92% / 60.56% |
| E3 | -51.99% | −5,199 | 2025-10-10 15:45:00 | −1,323 | 53.39% / 70.28% |
| E4 | -53.09% | −5,309 | 2025-10-10 15:00:00 | −1,163 | 70.92% / 63.74% |
| E5 | -10.43% | −1,043 | 2026-08-22 03:00:00 | −485 | 81.16% / 102.49% |
| clock_short | -23.65% | −2,365 | 2026-08-19 12:00:00 | −1,885 | n/a / n/a |
| R1 | -17.43% | −1,743 | 2026-08-19 16:00:00 | −1,244 | 197.13% / n/a |
| R2 | -17.43% | −1,743 | 2026-08-19 16:00:00 | −1,244 | 201.14% / n/a |
| R3 | -23.82% | −2,382 | 2026-08-19 14:00:00 | −1,860 | 190.75% / n/a |
| R4 | -11.24% | −1,124 | 2026-06-25 14:00:00 | −761 | 231.52% / n/a |
| R5 | -7.46% | −746 | 2025-08-13 08:50:00 | −493 | 273.76% / n/a |

**All five overall leaders hold the October 10, 2025 collapse**, with worst
adverse moves of approximately 49–51%. E1 buys at 21:00 UTC, then falls
from $40.796 to $20.784 by 21:21; its eventual −$232 close obscures a
roughly −$4,905 gross excursion on $10k notional. A1 buys earlier at 18:00,
suffers roughly −$5,149 gross, eventually closes −$938.

E5 avoids that particular crash low but still loses approximately 10.43%
of entry notional intratrade in the August 22, 2026 episode. Its five biggest
recent winners total 102.49% of closed net. That is a different path, not
certified tail immunity or a leverage recommendation. Correlated survivor
rules are not independent witnesses.

## Causal trace examples

The independent checker verifies all 720 first-trade traces and all later
opportunities, not only these illustrations. The reported current-bar values
become available at bar end; nothing from the next bar's close is used.

- **A2:** previous/current bar starts 2025-07-01T18:10:00.000Z /
  2025-07-01T18:15:00.000Z; signed reading -0.49514364→-3.33413962.
  Available/signal/zero-delay entry 2025-07-01T18:20:00.000Z, minute-open $38.014.
  First exit 2025-07-02T06:20:00.000Z.
- **E1:** previous/current bar starts 2025-07-01T04:30:00.000Z /
  2025-07-01T05:00:00.000Z; signed reading -0.23213493→-0.27096502.
  Available/signal/zero-delay entry 2025-07-01T05:30:00.000Z, minute-open $38.7.
  First exit 2025-07-01T17:30:00.000Z.
- **E5:** previous/current bar starts 2025-07-02T14:00:00.000Z /
  2025-07-02T15:00:00.000Z; signed reading 0.22076323→0.43008280.
  Available/signal/zero-delay entry 2025-07-02T16:00:00.000Z, minute-open $38.898.
  First exit 2025-07-03T04:00:00.000Z.

A2's current close change is −$0.536, divided by the preceding ATR14
0.16076111435856505, not current ATR 0.18834960619009591. E1's current
ER numerator/travel is −0.643 / 2.373, crossing −0.25 only after that
30-minute bar completes. +1m ledgers independently delay the actions.

## Verification and reproducibility

**Accepted:** independent audit passed 2026-09-06T14:50:42.219Z.
It checked **2,888 cases, 1,128,453 trade records and 28,880 monthly records**.
These are overlapping artifact rows, not that many independent market trades.
Eight saved clock cases match exactly; all input/source/artifact hashes match.
The read-only path supplement checked 34 rule/window cases. No abandoned
historical I09 run, revised threshold or outcome-driven replacement run.

- Eight new test groups pass: external ATR and exact shared math on five
  clocks; independent ER gain/loss travel on15 clock/period sets; hand
  seeds/zero/flat/monotone; scale/translation/mirror and prefix invariants;
  all720 rule boundaries/provenance; eight forced-old-ROC ledgers/four
  synthetic clocks; every definition's zero exits/delays/fees/timeout and
  pending lifecycle; future exclusion and unrelated-field isolation.
- Seventeen inherited standalone groups and11 closed-bar timing groups pass.
  Both TypeScript configurations and direct runner/checker/path typechecks
  pass. The inherited accounting tail is unchanged (names normalized).
- Saved clock comparison is exact before outcomes; this is a deliberately
  different standalone model, not an assertion it equals the ladder.
- Independent checker imports canonical candle normalization/repair only,
  builds its own OHLC aggregation, array ATR and direct-window ER, enumerates
  ALL eligible/occupied opportunities and first exits, checks prices/fees,
  turnover/open marks, full minute drawdown, monthly PnL, own-exit controls,
  shortlist/rankings and causal traces. Source/input/output pins are checked.
- Pinned read-only path supplement adds no rules or execution simulations.
  Gross adverse movement is not account DD; exit-minute highs/lows excluded,
  completed trades only, no liquidation or shared-margin certification.

Local artifact directory:
`backtests/hype/hype-atr-efficiency-standalone-2026-09-06/`.
[Method and commands](../docs/research/atr-efficiency-standalone-study.md),
[frozen card](../research-inputs/indicators/atr-efficiency-standalone-2026-09-06.json).
No overwrite, live writes, raw-data edits, commit or push.

## Side observation: both “recoveries” can happen before price recovers

The checked ATR fixture closes100→90→89. Before the first drop ATR14 is2,
so the move is−5ATR; next close falls again but the preceding ATR is37/14,
so the normalized next change is approximately−0.378ATR. That crosses back
above−0.5 and qualifies as a metric recovery without a bullish close.

A separate read-only ER10 fixture has prices
110,100,101,100,100,100,100,100,100,100,100,99.9.
The previous ten-change displacement/travel is−10/12=−0.8333.
When the old−10 change leaves the window, current displacement/travel becomes
−0.1/2.1=−0.04762. The existing ER10 recovery-long rule fires although price
falls100→99.9. This is expected rolling-window behavior, not future data.
No extra historical definition or price-confirmation filter was added.

## Explicitly untested

ATR lengths other than14, multi-bar ATR-normalized displacement, ATR stops,
targets/trailing, position sizing, fixed-entry volatility filters; ER other
lengths/levels, unsigned-only/persistent-state conditioning; KAMA; ATR+ER,
other-indicator/HL/S/R combinations; ladder interventions, actual funding,
historical arrival, queue/slippage and liquidation/shared collateral.

The count is **2,664 distinct standalone definitions through I09**:
1,944 through I08 plus720 new here. Ladder definitions remain45. Ten math
families are now validated under declared contracts (ER added; ATR already
existed). The new generic metric module adds six numeric field slots, with
related/repeated meanings; period/family/timestamp are metadata. This does
not certify KAMA or turn multiple transformations into independent evidence.

## Disposition and next boundary

No deployment candidate passes the inherited screen; no live code/config,
short unpause, ladder change, commit or push. Keep the positive sampled longs,
failed controls, sparsity and path risks in the register. ATR and ER have
**bounded individual-entry coverage**, not exhaustive indicator certification.

The next individual area is **VWAP/volume**, after freezing its own card and
math/timing tests. Do not start indicator/HL/S/R combinations or apply these
signals to the ladder without separate decision-specific controls.

## Appendix A: all 39 descriptive survivors

Sorted by full immediate absolute net, as frozen. Each cell is net USD;
count is full/recent immediate. Full/recent +1m and extra-cost minimum across
all four cases remain visible. All fail strict monthly tests; some also fail
aggregate clock tests. This is not a relaxed live shortlist.

| # | ID | Closes F/R | Full 0m | Full +1m | Recent 0m | Recent +1m | Min stressed $ | Strict failure |
|---|---|---|---|---|---|---|---|---|
| 1 | `efficiency_30m_n10_into_t0.25_long_fixed12h` | 555/140 | +12,441 | +11,800 | +4,694 | +5,368 | +3,291 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 2 | `atr_move_30m_n14_into_t0.5_long_fixed12h` | 736/185 | +11,876 | +8,234 | +7,439 | +5,282 | +1,126 | monthly_regression_vs_clock |
| 3 | `atr_move_5m_n14_into_t2_long_fixed12h` | 386/101 | +11,127 | +9,719 | +5,796 | +5,699 | +4,686 | monthly_regression_vs_clock |
| 4 | `atr_move_60m_n14_into_t0.5_long_fixed12h` | 631/160 | +10,435 | +9,067 | +4,328 | +4,026 | +2,493 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 5 | `efficiency_5m_n40_into_t0.25_long_fixed12h` | 493/121 | +10,177 | +10,026 | +5,990 | +6,252 | +4,776 | monthly_regression_vs_clock |
| 6 | `efficiency_15m_n20_into_t0.25_long_fixed12h` | 496/125 | +10,093 | +9,847 | +6,570 | +6,674 | +4,910 | monthly_regression_vs_clock |
| 7 | `atr_move_60m_n14_into_t1_long_fixed12h` | 326/81 | +9,390 | +9,692 | +3,721 | +3,533 | +2,741 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 8 | `atr_move_5m_n14_recovery_t2_long_fixed12h` | 386/101 | +9,222 | +8,365 | +5,784 | +5,951 | +4,498 | monthly_regression_vs_clock |
| 9 | `efficiency_5m_n10_into_t0.5_long_fixed12h` | 712/181 | +8,658 | +10,820 | +6,967 | +7,086 | +1,520 | monthly_regression_vs_clock |
| 10 | `efficiency_60m_n20_trend_t0.25_long_indicator_or12h` | 235/62 | +7,341 | +7,380 | +3,781 | +4,273 | +3,159 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 11 | `efficiency_15m_n10_into_t0.5_long_fixed12h` | 514/129 | +7,154 | +6,664 | +6,007 | +6,123 | +1,568 | monthly_regression_vs_clock |
| 12 | `efficiency_15m_n40_into_t0.25_long_indicator_or12h` | 269/64 | +6,925 | +6,130 | +3,868 | +3,402 | +2,750 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 13 | `efficiency_60m_n10_into_t0.25_long_indicator_or12h` | 439/109 | +6,676 | +5,668 | +3,772 | +3,300 | +1,283 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 14 | `efficiency_30m_n10_into_t0.75_long_fixed12h` | 130/32 | +6,526 | +6,525 | +3,089 | +3,101 | +2,757 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 15 | `efficiency_15m_n40_into_t0.25_long_fixed12h` | 266/63 | +6,444 | +5,564 | +2,521 | +1,983 | +1,342 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 16 | `efficiency_60m_n10_into_t0.25_long_fixed12h` | 400/100 | +6,163 | +4,120 | +5,077 | +4,113 | +256 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 17 | `efficiency_30m_n20_into_t0.25_long_fixed12h` | 362/93 | +6,014 | +5,440 | +6,162 | +6,444 | +1,835 | monthly_regression_vs_clock |
| 18 | `efficiency_60m_n10_into_t0.75_long_indicator_or12h` | 71/15 | +5,988 | +5,750 | +494 | +387 | +237 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 19 | `efficiency_60m_n20_trend_t0.5_long_fixed12h` | 71/19 | +5,410 | +5,269 | +2,633 | +2,582 | +2,390 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 20 | `efficiency_60m_n20_trend_t0.5_long_indicator_or12h` | 71/19 | +5,218 | +5,105 | +2,058 | +2,060 | +1,867 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 21 | `efficiency_60m_n20_recovery_t0.25_long_fixed12h` | 223/57 | +5,098 | +5,956 | +5,689 | +4,376 | +2,865 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 22 | `efficiency_15m_n40_recovery_t0.25_long_indicator_or12h` | 273/64 | +5,098 | +4,430 | +2,068 | +2,024 | +1,372 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 23 | `efficiency_30m_n10_recovery_t0.75_long_fixed12h` | 130/32 | +4,951 | +5,694 | +1,821 | +1,940 | +1,489 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 24 | `efficiency_30m_n20_into_t0.25_long_indicator_or12h` | 386/97 | +4,749 | +4,114 | +3,825 | +3,909 | +289 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 25 | `efficiency_60m_n20_trend_t0.25_long_fixed12h` | 232/61 | +4,690 | +4,886 | +3,482 | +3,873 | +2,366 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 26 | `efficiency_60m_n10_into_t0.75_long_fixed12h` | 71/15 | +4,611 | +4,456 | +818 | +750 | +599 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 27 | `efficiency_30m_n40_into_t0.25_long_indicator_or12h` | 163/36 | +3,789 | +3,588 | +1,539 | +1,595 | +1,178 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 28 | `efficiency_15m_n20_into_t0.5_long_fixed12h` | 184/40 | +2,864 | +2,548 | +1,262 | +1,171 | +706 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 29 | `efficiency_30m_n10_into_t0.75_long_indicator_or12h` | 134/35 | +2,854 | +2,324 | +2,474 | +2,253 | +983 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 30 | `atr_move_30m_n14_trend_t2_long_fixed12h` | 91/19 | +2,616 | +2,739 | +2,715 | +2,898 | +1,705 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 31 | `efficiency_240m_n10_recovery_t0.25_long_fixed12h` | 147/35 | +2,614 | +2,301 | +2,371 | +2,406 | +899 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 32 | `efficiency_30m_n40_trend_t0.25_long_fixed12h` | 180/52 | +2,149 | +1,813 | +2,983 | +2,741 | +11 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 33 | `efficiency_5m_n40_trend_t0.5_long_fixed12h` | 63/11 | +2,148 | +2,012 | +1,107 | +821 | +711 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 34 | `efficiency_60m_n10_trend_t0.75_long_indicator_or12h` | 81/21 | +1,834 | +1,859 | +1,652 | +1,745 | +1,023 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 35 | `atr_move_15m_n14_trend_t2_long_fixed12h` | 148/46 | +1,834 | +1,753 | +464 | +791 | +3 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 36 | `efficiency_60m_n10_trend_t0.75_long_fixed12h` | 81/21 | +1,723 | +1,921 | +2,682 | +2,841 | +912 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 37 | `efficiency_30m_n10_recovery_t0.75_long_indicator_or12h` | 134/35 | +1,549 | +1,774 | +1,129 | +1,094 | +207 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 38 | `atr_move_240m_n14_trend_t1_long_indicator_or12h` | 122/35 | +1,495 | +2,103 | +1,066 | +953 | +273 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| 39 | `efficiency_240m_n20_recovery_t0.25_long_fixed12h` | 78/21 | +1,338 | +1,523 | +1,183 | +1,159 | +557 | not_above_clock_all_windows_delays, monthly_regression_vs_clock |

## Appendix B: all 720 definitions, including negative and sparse results

Sorted exactly as saved `ranking.json`: full immediate same-side clock delta,
not absolute profit and not live priority. Case order is full0, full+1,
recent0, recent+1. Each net already includes fees and any cutoff mark.
The complete four-ledger details and monthlies remain in local artifacts.

Failure abbreviations: N=insufficient sample, P=not positive in every
window/delay, C=not above clock in every case, M=monthly regression,
S=nonpositive extra-cost net, X=equity exhausted in diagnostic. Multiple
failures can apply. The 31 X definitions are not executable account claims.

| # | ID | Closes F0/F1/R0/R1 | Full0 $ | Full1 $ | Recent0 $ | Recent1 $ | Δ full0 clock $ | Worst monthly Δ $ | Fail |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `efficiency_30m_n20_into_t0.5_short_fixed12h` | 119/119/32/32 | +2,265 | +2,237 | −1,027 | −1,017 | +24,548 | −1,918 | P,M,S |
| 2 | `efficiency_240m_n20_into_t0.25_short_fixed12h` | 86/83/24/23 | +1,812 | +2,270 | −1,180 | −1,406 | +24,095 | −936 | P,M,S |
| 3 | `atr_move_30m_n14_trend_t2_short_fixed12h` | 77/76/19/18 | +1,747 | +950 | −1,328 | −1,323 | +24,030 | −2,674 | P,M,S |
| 4 | `atr_move_60m_n14_trend_t2_short_fixed12h` | 38/37/11/10 | +1,376 | +1,557 | −319 | −10 | +23,659 | −2,982 | P,M,S |
| 5 | `efficiency_5m_n20_into_t0.75_short_fixed12h` | 58/58/8/8 | +1,250 | +1,274 | −1,175 | −1,109 | +23,532 | −1,572 | N,P,M,S |
| 6 | `efficiency_240m_n20_into_t0.25_short_indicator_or12h` | 86/83/24/23 | +1,159 | +1,256 | −1,274 | −1,462 | +23,442 | −932 | P,M,S |
| 7 | `efficiency_30m_n20_recovery_t0.5_short_fixed12h` | 120/119/33/33 | +1,043 | +1,433 | −1,608 | −1,443 | +23,326 | −2,217 | P,M,S |
| 8 | `atr_move_15m_n14_trend_t2_short_fixed12h` | 150/149/43/42 | +954 | −135 | +210 | +80 | +23,237 | −2,954 | P,M,S |
| 9 | `efficiency_15m_n10_into_t0.75_short_fixed12h` | 233/233/58/58 | +827 | −384 | −152 | −388 | +23,109 | −1,831 | P,M,S |
| 10 | `efficiency_15m_n10_recovery_t0.75_short_fixed12h` | 236/235/60/60 | +490 | +742 | −187 | −254 | +22,772 | −2,250 | P,M,S |
| 11 | `efficiency_5m_n40_trend_t0.75_short_indicator_or12h` | 1/1/0/0 | +472 | +435 | 0 | 0 | +22,754 | −1,963 | N,P,M,S |
| 12 | `atr_move_15m_n14_recovery_t2_short_indicator_or12h` | 175/173/58/58 | +447 | −27 | −530 | −801 | +22,730 | −1,831 | P,M,S |
| 13 | `efficiency_5m_n20_recovery_t0.75_short_fixed12h` | 58/58/8/8 | +427 | +316 | −1,375 | −1,333 | +22,709 | −1,547 | N,P,M,S |
| 14 | `efficiency_5m_n40_trend_t0.75_short_fixed12h` | 1/1/0/0 | +397 | +401 | 0 | 0 | +22,680 | −1,963 | N,P,M,S |
| 15 | `atr_move_30m_n14_into_t2_short_indicator_or12h` | 101/101/22/22 | +380 | −80 | −924 | −1,145 | +22,662 | −1,454 | P,M,S |
| 16 | `efficiency_240m_n20_into_t0.75_short_fixed12h` | 4/3/1/1 | +371 | +102 | +255 | +253 | +22,653 | −2,037 | N,M |
| 17 | `efficiency_240m_n20_into_t0.75_short_indicator_or12h` | 4/3/1/1 | +371 | +102 | +255 | +253 | +22,653 | −2,037 | N,M |
| 18 | `atr_move_240m_n14_trend_t2_short_indicator_or12h` | 7/7/2/2 | +313 | +103 | +780 | +721 | +22,596 | −1,680 | N,M |
| 19 | `efficiency_15m_n20_trend_t0.75_short_fixed12h` | 18/18/2/2 | +187 | +446 | −443 | −418 | +22,470 | −2,254 | N,P,M,S |
| 20 | `efficiency_60m_n40_recovery_t0.25_short_indicator_or12h` | 103/96/26/25 | +174 | −74 | −206 | −284 | +22,456 | −1,732 | P,M,S |
| 21 | `atr_move_240m_n14_trend_t2_short_fixed12h` | 7/7/2/2 | +152 | −76 | +780 | +719 | +22,435 | −1,952 | N,P,M,S |
| 22 | `efficiency_240m_n20_trend_t0.25_short_fixed12h` | 79/76/22/20 | +120 | −17 | −1,752 | −1,286 | +22,402 | −1,134 | P,M,S |
| 23 | `efficiency_240m_n20_trend_t0.25_short_indicator_or12h` | 79/76/22/20 | +113 | −41 | −1,752 | −1,286 | +22,396 | −1,134 | P,M,S |
| 24 | `efficiency_60m_n40_trend_t0.5_short_fixed12h` | 5/5/1/1 | +82 | +125 | −99 | −97 | +22,365 | −2,037 | N,P,M,S |
| 25 | `efficiency_60m_n40_trend_t0.5_short_indicator_or12h` | 5/5/1/1 | +82 | +125 | −99 | −97 | +22,365 | −2,037 | N,P,M,S |
| 26 | `atr_move_240m_n14_trend_t1_short_fixed12h` | 112/108/25/24 | +29 | +379 | +698 | +843 | +22,312 | −2,114 | M,S |
| 27 | `efficiency_5m_n40_into_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 28 | `efficiency_5m_n40_into_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 29 | `efficiency_5m_n40_recovery_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 30 | `efficiency_5m_n40_recovery_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 31 | `efficiency_15m_n40_trend_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 32 | `efficiency_15m_n40_trend_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 33 | `efficiency_30m_n40_trend_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 34 | `efficiency_30m_n40_trend_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 35 | `efficiency_30m_n40_into_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 36 | `efficiency_30m_n40_into_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 37 | `efficiency_30m_n40_recovery_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 38 | `efficiency_30m_n40_recovery_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 39 | `efficiency_60m_n20_trend_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 40 | `efficiency_60m_n20_trend_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 41 | `efficiency_60m_n40_trend_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 42 | `efficiency_60m_n40_trend_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 43 | `efficiency_60m_n40_into_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 44 | `efficiency_60m_n40_into_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 45 | `efficiency_60m_n40_recovery_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 46 | `efficiency_60m_n40_recovery_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 47 | `efficiency_240m_n40_trend_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 48 | `efficiency_240m_n40_trend_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 49 | `efficiency_240m_n40_into_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 50 | `efficiency_240m_n40_into_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 51 | `efficiency_240m_n40_recovery_t0.75_short_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 52 | `efficiency_240m_n40_recovery_t0.75_short_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | +22,283 | −2,037 | N,P,M,S |
| 53 | `efficiency_240m_n20_trend_t0.75_short_fixed12h` | 3/3/0/0 | −19 | −37 | 0 | 0 | +22,264 | −2,037 | N,P,M,S |
| 54 | `efficiency_240m_n20_trend_t0.75_short_indicator_or12h` | 3/3/0/0 | −19 | −37 | 0 | 0 | +22,264 | −2,037 | N,P,M,S |
| 55 | `efficiency_5m_n20_into_t0.75_short_indicator_or12h` | 58/58/8/8 | −87 | +409 | +786 | +1,517 | +22,196 | −2,045 | N,P,M,S |
| 56 | `efficiency_240m_n20_recovery_t0.75_short_fixed12h` | 4/3/1/1 | −171 | +327 | +46 | +74 | +22,111 | −2,037 | N,P,M,S |
| 57 | `efficiency_240m_n20_recovery_t0.75_short_indicator_or12h` | 4/3/1/1 | −171 | +327 | +46 | +74 | +22,111 | −2,037 | N,P,M,S |
| 58 | `efficiency_15m_n40_into_t0.75_short_indicator_or12h` | 1/1/1/1 | −186 | −175 | −186 | −175 | +22,097 | −2,037 | N,P,M,S |
| 59 | `efficiency_60m_n20_into_t0.75_short_indicator_or12h` | 8/8/3/3 | −187 | −122 | −422 | −435 | +22,095 | −2,037 | N,P,M,S |
| 60 | `efficiency_240m_n40_trend_t0.5_short_fixed12h` | 2/2/0/0 | −234 | −189 | 0 | 0 | +22,048 | −2,037 | N,P,M,S |
| 61 | `efficiency_240m_n40_trend_t0.5_short_indicator_or12h` | 2/2/0/0 | −234 | −189 | 0 | 0 | +22,048 | −2,037 | N,P,M,S |
| 62 | `efficiency_60m_n20_into_t0.75_short_fixed12h` | 8/8/3/3 | −236 | −288 | −422 | −435 | +22,047 | −2,037 | N,P,M,S |
| 63 | `efficiency_15m_n40_into_t0.75_short_fixed12h` | 1/1/1/1 | −264 | −256 | −264 | −256 | +22,018 | −2,037 | N,P,M,S |
| 64 | `efficiency_15m_n40_recovery_t0.75_short_indicator_or12h` | 1/1/1/1 | −390 | −437 | −390 | −437 | +21,893 | −2,037 | N,P,M,S |
| 65 | `atr_move_15m_n14_trend_t2_short_indicator_or12h` | 178/178/53/53 | −416 | −1,238 | −1,601 | −1,548 | +21,867 | −2,190 | P,M,S |
| 66 | `efficiency_5m_n20_into_t0.5_short_indicator_or12h` | 658/658/169/169 | −433 | −1,174 | +1,729 | +1,923 | +21,849 | −1,374 | P,M,S |
| 67 | `efficiency_15m_n40_recovery_t0.75_short_fixed12h` | 1/1/1/1 | −518 | −507 | −518 | −507 | +21,765 | −2,037 | N,P,M,S |
| 68 | `efficiency_15m_n20_trend_t0.75_short_indicator_or12h` | 18/18/2/2 | −605 | −270 | −12 | +16 | +21,677 | −2,153 | N,P,M,S |
| 69 | `atr_move_240m_n14_recovery_t2_short_fixed12h` | 13/13/5/5 | −671 | −456 | −288 | −179 | +21,611 | −2,037 | N,P,M,S |
| 70 | `efficiency_240m_n40_recovery_t0.5_short_fixed12h` | 3/3/2/2 | −826 | −646 | −378 | −316 | +21,457 | −2,037 | N,P,M,S |
| 71 | `efficiency_240m_n40_recovery_t0.5_short_indicator_or12h` | 3/3/2/2 | −826 | −646 | −378 | −316 | +21,457 | −2,037 | N,P,M,S |
| 72 | `efficiency_30m_n20_trend_t0.75_short_fixed12h` | 5/5/0/0 | −861 | −796 | 0 | 0 | +21,421 | −2,317 | N,P,M,S |
| 73 | `efficiency_5m_n20_recovery_t0.75_short_indicator_or12h` | 58/58/8/8 | −890 | −504 | +603 | +1,265 | +21,393 | −2,092 | N,P,M,S |
| 74 | `efficiency_60m_n40_recovery_t0.25_short_fixed12h` | 103/96/26/25 | −910 | −254 | +60 | −53 | +21,373 | −1,894 | P,M,S |
| 75 | `atr_move_240m_n14_recovery_t2_short_indicator_or12h` | 13/13/5/5 | −949 | −709 | +219 | +370 | +21,334 | −2,037 | N,P,M,S |
| 76 | `atr_move_240m_n14_recovery_t1_short_indicator_or12h` | 124/115/37/35 | −994 | −801 | +1,025 | +803 | +21,289 | −2,669 | P,M,S |
| 77 | `efficiency_30m_n20_trend_t0.75_short_indicator_or12h` | 5/5/0/0 | −1,044 | −901 | 0 | 0 | +21,238 | −2,279 | N,P,M,S |
| 78 | `efficiency_15m_n20_recovery_t0.75_short_indicator_or12h` | 16/16/5/5 | −1,107 | −1,255 | −203 | −285 | +21,176 | −2,037 | N,P,M,S |
| 79 | `atr_move_240m_n14_into_t2_short_fixed12h` | 14/13/4/4 | −1,141 | −1,569 | −139 | −84 | +21,141 | −2,037 | N,P,M,S |
| 80 | `efficiency_15m_n40_trend_t0.5_short_fixed12h` | 22/22/1/1 | −1,202 | −1,596 | −249 | −247 | +21,081 | −1,864 | N,P,M,S |
| 81 | `atr_move_15m_n14_into_t2_short_indicator_or12h` | 174/174/58/58 | −1,265 | −1,140 | −671 | −757 | +21,017 | −1,573 | P,M,S |
| 82 | `atr_move_60m_n14_trend_t2_short_indicator_or12h` | 41/41/11/11 | −1,295 | −1,259 | −245 | −127 | +20,988 | −2,670 | P,M,S |
| 83 | `efficiency_240m_n10_recovery_t0.25_short_fixed12h` | 136/126/39/35 | −1,298 | −2,176 | +1,429 | +689 | +20,984 | −2,641 | P,M,S |
| 84 | `efficiency_60m_n20_recovery_t0.75_short_indicator_or12h` | 7/7/2/2 | −1,304 | −1,120 | −395 | −384 | +20,979 | −2,037 | N,P,M,S |
| 85 | `efficiency_15m_n20_into_t0.75_short_indicator_or12h` | 16/16/5/5 | −1,333 | −1,358 | −289 | −199 | +20,949 | −2,037 | N,P,M,S |
| 86 | `efficiency_240m_n20_recovery_t0.25_short_fixed12h` | 86/84/23/22 | −1,354 | −898 | −1,016 | −685 | +20,929 | −3,261 | P,M,S |
| 87 | `efficiency_240m_n40_into_t0.5_short_fixed12h` | 3/2/2/1 | −1,367 | −1,294 | −346 | −256 | +20,916 | −2,037 | N,P,M,S |
| 88 | `efficiency_240m_n40_into_t0.5_short_indicator_or12h` | 3/2/2/1 | −1,367 | −1,294 | −346 | −256 | +20,916 | −2,037 | N,P,M,S |
| 89 | `atr_move_240m_n14_trend_t1_short_indicator_or12h` | 114/114/25/25 | −1,384 | −1,510 | +276 | +270 | +20,899 | −2,251 | P,M,S |
| 90 | `efficiency_60m_n20_recovery_t0.75_short_fixed12h` | 7/7/2/2 | −1,422 | −1,357 | −395 | −384 | +20,860 | −2,037 | N,P,M,S |
| 91 | `efficiency_240m_n20_recovery_t0.25_short_indicator_or12h` | 86/84/23/22 | −1,444 | −964 | −1,049 | −655 | +20,839 | −3,331 | P,M,S |
| 92 | `efficiency_5m_n40_into_t0.25_short_indicator_or12h` | 761/761/201/201 | −1,476 | −4,111 | −1,593 | −2,013 | +20,807 | −670 | P,M,S |
| 93 | `efficiency_30m_n40_recovery_t0.25_short_indicator_or12h` | 174/171/54/53 | −1,566 | −1,367 | −1,338 | −1,076 | +20,716 | −1,843 | P,M,S |
| 94 | `efficiency_15m_n40_trend_t0.5_short_indicator_or12h` | 22/22/1/1 | −1,604 | −1,917 | −206 | −206 | +20,678 | −1,784 | N,P,M,S |
| 95 | `efficiency_240m_n10_trend_t0.75_short_fixed12h` | 16/16/4/4 | −1,731 | −1,845 | −304 | −425 | +20,551 | −2,876 | N,P,M,S |
| 96 | `efficiency_240m_n20_trend_t0.5_short_fixed12h` | 23/21/3/3 | −1,762 | −2,088 | −692 | −668 | +20,520 | −2,458 | N,P,M,S |
| 97 | `efficiency_240m_n20_trend_t0.5_short_indicator_or12h` | 23/21/3/3 | −1,762 | −2,088 | −692 | −668 | +20,520 | −2,458 | N,P,M,S |
| 98 | `efficiency_240m_n10_into_t0.75_short_fixed12h` | 25/23/9/7 | −1,769 | −2,018 | −574 | −1,008 | +20,513 | −2,037 | N,P,M,S |
| 99 | `efficiency_240m_n10_into_t0.75_short_indicator_or12h` | 25/23/9/7 | −1,769 | −2,014 | −574 | −1,008 | +20,513 | −2,037 | N,P,M,S |
| 100 | `efficiency_30m_n10_into_t0.25_short_fixed12h` | 558/543/140/136 | −1,843 | −468 | −3,988 | −3,750 | +20,440 | −919 | P,M,S |
| 101 | `efficiency_240m_n40_into_t0.25_short_fixed12h` | 37/35/12/12 | −1,861 | −1,862 | +78 | +91 | +20,422 | −2,037 | P,M,S |
| 102 | `efficiency_240m_n40_into_t0.25_short_indicator_or12h` | 37/35/12/12 | −1,861 | −1,862 | +78 | +91 | +20,422 | −2,037 | P,M,S |
| 103 | `efficiency_5m_n40_into_t0.25_short_fixed12h` | 512/509/129/129 | −1,893 | −4,307 | −4,302 | −4,510 | +20,390 | −668 | P,M,S |
| 104 | `atr_move_30m_n14_into_t1_short_indicator_or12h` | 995/995/274/274 | −1,898 | −4,770 | −1,396 | −2,205 | +20,384 | −1,843 | P,M,S |
| 105 | `efficiency_240m_n10_trend_t0.75_short_indicator_or12h` | 16/16/4/4 | −1,922 | −2,083 | −304 | −414 | +20,360 | −3,125 | N,P,M,S |
| 106 | `efficiency_60m_n10_into_t0.25_short_fixed12h` | 403/392/104/99 | −2,015 | −842 | −4,201 | −3,670 | +20,267 | −1,275 | P,M,S |
| 107 | `atr_move_5m_n14_into_t2_short_fixed12h` | 394/393/110/110 | −2,077 | −3,255 | −1,653 | −1,795 | +20,206 | −935 | P,M,S |
| 108 | `efficiency_30m_n20_into_t0.5_short_indicator_or12h` | 119/119/32/32 | −2,088 | −2,350 | −1,552 | −1,731 | +20,195 | −1,821 | P,M,S |
| 109 | `efficiency_30m_n20_into_t0.75_short_fixed12h` | 11/11/4/4 | −2,092 | −2,003 | −1,462 | −1,400 | +20,191 | −1,648 | N,P,M,S |
| 110 | `atr_move_240m_n14_into_t2_short_indicator_or12h` | 14/14/4/4 | −2,111 | −2,313 | −445 | −480 | +20,172 | −2,037 | N,P,M,S |
| 111 | `efficiency_15m_n20_into_t0.25_short_fixed12h` | 514/508/129/129 | −2,121 | −3,598 | −5,461 | −5,309 | +20,162 | −952 | P,M,S |
| 112 | `atr_move_60m_n14_recovery_t1_short_fixed12h` | 331/327/84/83 | −2,126 | −649 | −4,269 | −3,139 | +20,157 | −1,404 | P,M,S |
| 113 | `atr_move_240m_n14_into_t0.5_short_indicator_or12h` | 386/378/93/91 | −2,149 | −3,226 | −2,036 | −1,414 | +20,134 | −2,001 | P,M,S |
| 114 | `efficiency_5m_n40_trend_t0.5_short_indicator_or12h` | 57/57/9/9 | −2,166 | −1,581 | −875 | −648 | +20,117 | −1,941 | N,P,M,S |
| 115 | `efficiency_240m_n40_recovery_t0.25_short_fixed12h` | 38/35/16/14 | −2,166 | −2,145 | −1,401 | −893 | +20,116 | −2,037 | P,M,S |
| 116 | `efficiency_240m_n40_recovery_t0.25_short_indicator_or12h` | 38/35/16/14 | −2,166 | −2,145 | −1,401 | −893 | +20,116 | −2,037 | P,M,S |
| 117 | `efficiency_30m_n20_recovery_t0.75_short_fixed12h` | 11/11/4/4 | −2,193 | −2,087 | −1,648 | −1,624 | +20,090 | −1,874 | N,P,M,S |
| 118 | `efficiency_240m_n10_recovery_t0.5_short_fixed12h` | 80/77/27/27 | −2,199 | −2,761 | −1,471 | −1,493 | +20,084 | −1,785 | P,M,S |
| 119 | `efficiency_60m_n20_trend_t0.5_short_fixed12h` | 62/62/14/14 | −2,227 | −2,259 | +382 | +411 | +20,055 | −2,320 | P,M,S |
| 120 | `efficiency_60m_n40_into_t0.25_short_indicator_or12h` | 109/106/31/30 | −2,230 | −2,349 | −2,668 | −2,778 | +20,053 | −1,811 | P,M,S |
| 121 | `efficiency_240m_n10_into_t0.5_short_fixed12h` | 81/75/29/26 | −2,245 | −2,336 | −2,943 | −2,151 | +20,038 | −1,673 | P,M,S |
| 122 | `efficiency_30m_n20_recovery_t0.75_short_indicator_or12h` | 11/11/4/4 | −2,247 | −2,210 | −1,704 | −1,703 | +20,036 | −1,923 | N,P,M,S |
| 123 | `atr_move_60m_n14_recovery_t2_short_indicator_or12h` | 44/43/9/9 | −2,251 | −2,465 | −2,034 | −2,003 | +20,031 | −2,147 | N,P,M,S |
| 124 | `efficiency_240m_n10_into_t0.5_short_indicator_or12h` | 81/75/29/26 | −2,267 | −2,316 | −2,943 | −2,126 | +20,016 | −1,673 | P,M,S |
| 125 | `efficiency_60m_n10_recovery_t0.75_short_fixed12h` | 81/80/21/20 | −2,288 | −2,160 | −3,179 | −2,897 | +19,995 | −1,758 | P,M,S |
| 126 | `efficiency_240m_n10_recovery_t0.25_short_indicator_or12h` | 140/127/39/36 | −2,324 | −1,771 | −59 | +19 | +19,959 | −2,820 | P,M,S |
| 127 | `efficiency_30m_n20_into_t0.75_short_indicator_or12h` | 11/11/4/4 | −2,352 | −2,307 | −1,617 | −1,563 | +19,930 | −1,820 | N,P,M,S |
| 128 | `efficiency_60m_n40_into_t0.5_short_fixed12h` | 14/14/5/5 | −2,358 | −2,214 | −340 | −336 | +19,924 | −2,037 | N,P,M,S |
| 129 | `efficiency_60m_n40_into_t0.5_short_indicator_or12h` | 14/14/5/5 | −2,358 | −2,214 | −340 | −336 | +19,924 | −2,037 | N,P,M,S |
| 130 | `efficiency_60m_n40_recovery_t0.5_short_fixed12h` | 14/13/5/5 | −2,363 | −419 | −732 | −729 | +19,920 | −2,037 | N,P,M,S |
| 131 | `efficiency_60m_n40_recovery_t0.5_short_indicator_or12h` | 14/13/5/5 | −2,363 | −419 | −732 | −729 | +19,920 | −2,037 | N,P,M,S |
| 132 | `efficiency_30m_n40_into_t0.5_short_indicator_or12h` | 16/16/6/6 | −2,424 | −2,253 | −990 | −917 | +19,859 | −2,037 | N,P,M,S |
| 133 | `efficiency_60m_n40_into_t0.25_short_fixed12h` | 109/106/31/30 | −2,442 | −2,617 | −2,481 | −2,588 | +19,840 | −1,811 | P,M,S |
| 134 | `atr_move_60m_n14_into_t1_short_fixed12h` | 332/327/84/83 | −2,492 | −298 | −4,387 | −3,370 | +19,790 | −1,820 | P,M,S |
| 135 | `efficiency_15m_n20_recovery_t0.75_short_fixed12h` | 16/16/5/5 | −2,518 | −2,659 | −1,005 | −1,005 | +19,765 | −2,037 | N,P,M,S |
| 136 | `atr_move_60m_n14_into_t1_short_indicator_or12h` | 491/491/134/134 | −2,536 | −3,679 | −2,134 | −2,378 | +19,747 | −1,266 | P,M,S |
| 137 | `efficiency_30m_n40_trend_t0.5_short_fixed12h` | 10/10/2/2 | −2,580 | −2,376 | −283 | −300 | +19,702 | −2,159 | N,P,M,S |
| 138 | `efficiency_240m_n40_trend_t0.25_short_fixed12h` | 47/42/14/12 | −2,591 | −2,777 | +232 | +112 | +19,692 | −2,804 | P,M,S |
| 139 | `efficiency_240m_n40_trend_t0.25_short_indicator_or12h` | 47/42/14/12 | −2,591 | −2,777 | +232 | +112 | +19,692 | −2,804 | P,M,S |
| 140 | `efficiency_5m_n10_recovery_t0.75_short_fixed12h` | 479/478/123/123 | −2,617 | −3,658 | −3,774 | −3,788 | +19,665 | −1,016 | P,M,S |
| 141 | `efficiency_30m_n40_recovery_t0.25_short_fixed12h` | 173/170/53/52 | −2,642 | −1,922 | −2,570 | −2,271 | +19,641 | −1,457 | P,M,S |
| 142 | `efficiency_30m_n40_into_t0.5_short_fixed12h` | 16/16/6/6 | −2,714 | −2,652 | −990 | −917 | +19,569 | −2,037 | N,P,M,S |
| 143 | `efficiency_60m_n40_trend_t0.25_short_fixed12h` | 99/96/19/19 | −2,718 | −1,423 | +1,057 | +1,413 | +19,565 | −2,409 | P,M,S |
| 144 | `atr_move_60m_n14_into_t2_short_indicator_or12h` | 44/44/9/9 | −2,738 | −2,902 | −2,536 | −2,540 | +19,545 | −1,957 | N,P,M,S |
| 145 | `efficiency_60m_n20_trend_t0.5_short_indicator_or12h` | 62/62/14/14 | −2,745 | −2,905 | +374 | +458 | +19,538 | −2,320 | P,M,S |
| 146 | `efficiency_30m_n40_trend_t0.5_short_indicator_or12h` | 10/10/2/2 | −2,773 | −2,457 | −365 | −357 | +19,510 | −2,159 | N,P,M,S |
| 147 | `atr_move_5m_n14_recovery_t2_short_fixed12h` | 394/393/110/110 | −2,782 | −3,444 | −1,850 | −1,533 | +19,501 | −1,583 | P,M,S |
| 148 | `efficiency_60m_n10_recovery_t0.25_short_indicator_or12h` | 457/430/116/114 | −2,839 | −3,560 | −4,929 | −4,904 | +19,444 | −2,853 | P,M,S |
| 149 | `atr_move_30m_n14_trend_t2_short_indicator_or12h` | 91/91/23/23 | −2,904 | −2,666 | −898 | −697 | +19,379 | −2,212 | P,M,S |
| 150 | `efficiency_5m_n10_into_t0.75_short_fixed12h` | 481/480/123/123 | −2,932 | −4,100 | −3,941 | −4,171 | +19,350 | −1,114 | P,M,S |
| 151 | `efficiency_15m_n10_into_t0.75_short_indicator_or12h` | 271/271/69/69 | −2,936 | −3,972 | −336 | −464 | +19,346 | −1,427 | P,M,S |
| 152 | `efficiency_15m_n20_into_t0.75_short_fixed12h` | 16/16/5/5 | −3,007 | −2,945 | −1,040 | −945 | +19,275 | −2,037 | N,P,M,S |
| 153 | `efficiency_5m_n20_trend_t0.75_short_fixed12h` | 42/42/6/6 | −3,017 | −6,701 | +115 | +58 | +19,266 | −6,989 | N,P,M,S |
| 154 | `atr_move_30m_n14_recovery_t2_short_indicator_or12h` | 99/97/22/22 | −3,022 | −2,055 | +20 | −120 | +19,261 | −1,904 | P,M,S |
| 155 | `efficiency_60m_n40_trend_t0.25_short_indicator_or12h` | 99/96/19/19 | −3,038 | −1,213 | +1,099 | +1,474 | +19,244 | −3,087 | P,M,S |
| 156 | `efficiency_60m_n10_recovery_t0.75_short_indicator_or12h` | 81/80/21/20 | −3,064 | −2,917 | −2,014 | −1,797 | +19,219 | −1,899 | P,M,S |
| 157 | `efficiency_15m_n10_into_t0.5_short_indicator_or12h` | 867/867/211/211 | −3,078 | −6,681 | −3,740 | −3,928 | +19,205 | −2,109 | P,M,S |
| 158 | `efficiency_15m_n20_recovery_t0.5_short_fixed12h` | 187/186/48/48 | −3,138 | −3,732 | −567 | −510 | +19,144 | −2,555 | P,M,S |
| 159 | `efficiency_30m_n20_recovery_t0.5_short_indicator_or12h` | 120/119/33/33 | −3,149 | −3,213 | −1,774 | −1,786 | +19,134 | −2,073 | P,M,S |
| 160 | `efficiency_30m_n10_into_t0.75_short_indicator_or12h` | 145/144/41/41 | −3,171 | −4,154 | +66 | −142 | +19,111 | −1,419 | P,M,S |
| 161 | `atr_move_60m_n14_recovery_t1_short_indicator_or12h` | 487/456/131/122 | −3,228 | −4,950 | −3,926 | −4,117 | +19,054 | −1,244 | P,M,S |
| 162 | `efficiency_240m_n10_recovery_t0.5_short_indicator_or12h` | 80/77/27/27 | −3,256 | −3,655 | −1,885 | −1,883 | +19,026 | −1,785 | P,M,S |
| 163 | `efficiency_5m_n40_trend_t0.5_short_fixed12h` | 56/56/9/9 | −3,275 | −2,485 | +172 | +519 | +19,008 | −1,663 | N,P,M,S |
| 164 | `efficiency_60m_n20_recovery_t0.25_short_fixed12h` | 227/220/62/60 | −3,331 | −1,124 | −2,976 | −1,472 | +18,951 | −2,645 | P,M,S |
| 165 | `efficiency_60m_n10_into_t0.75_short_fixed12h` | 81/81/21/21 | −3,508 | −3,707 | −3,148 | −3,306 | +18,774 | −1,615 | P,M,S |
| 166 | `efficiency_5m_n40_into_t0.5_short_fixed12h` | 63/63/11/11 | −3,537 | −3,401 | −1,351 | −1,064 | +18,745 | −1,920 | P,M,S |
| 167 | `efficiency_240m_n20_recovery_t0.5_short_fixed12h` | 27/26/9/9 | −3,561 | −3,527 | −2,656 | −2,739 | +18,721 | −2,037 | N,P,M,S |
| 168 | `efficiency_240m_n20_recovery_t0.5_short_indicator_or12h` | 27/26/9/9 | −3,561 | −3,527 | −2,656 | −2,739 | +18,721 | −2,037 | N,P,M,S |
| 169 | `atr_move_15m_n14_recovery_t2_short_fixed12h` | 148/148/46/46 | −3,610 | −4,228 | −1,658 | −1,787 | +18,673 | −1,382 | P,M,S |
| 170 | `efficiency_60m_n10_into_t0.75_short_indicator_or12h` | 81/81/21/21 | −3,619 | −3,644 | −2,116 | −2,209 | +18,664 | −1,660 | P,M,S |
| 171 | `efficiency_240m_n10_trend_t0.5_short_fixed12h` | 81/74/14/14 | −3,675 | −4,122 | +119 | +159 | +18,607 | −3,736 | P,M,S |
| 172 | `efficiency_15m_n40_recovery_t0.25_short_fixed12h` | 264/263/77/76 | −3,729 | −3,262 | −3,226 | −3,506 | +18,554 | −1,458 | P,M,S |
| 173 | `atr_move_240m_n14_into_t1_short_fixed12h` | 119/111/34/33 | −3,811 | −6,440 | −1,026 | −1,102 | +18,472 | −2,976 | P,M,S |
| 174 | `efficiency_5m_n20_trend_t0.75_short_indicator_or12h` | 44/44/6/6 | −3,824 | −7,320 | −506 | −579 | +18,459 | −6,469 | N,P,M,S |
| 175 | `efficiency_15m_n40_recovery_t0.25_short_indicator_or12h` | 273/272/79/78 | −3,836 | −3,544 | −2,095 | −2,243 | +18,447 | −1,796 | P,M,S |
| 176 | `efficiency_30m_n20_into_t0.25_short_indicator_or12h` | 392/386/102/101 | −3,859 | −4,971 | −4,059 | −4,357 | +18,423 | −2,449 | P,M,S |
| 177 | `efficiency_240m_n10_trend_t0.5_short_indicator_or12h` | 81/74/14/14 | −3,863 | −4,275 | +119 | +160 | +18,420 | −3,974 | P,M,S |
| 178 | `efficiency_240m_n10_recovery_t0.75_short_fixed12h` | 22/22/8/8 | −3,874 | −3,686 | −1,024 | −984 | +18,409 | −2,037 | N,P,M,S |
| 179 | `efficiency_240m_n20_into_t0.5_short_fixed12h` | 28/26/11/10 | −3,911 | −3,803 | −2,617 | −2,202 | +18,372 | −2,037 | N,P,M,S |
| 180 | `efficiency_240m_n20_into_t0.5_short_indicator_or12h` | 28/26/11/10 | −3,911 | −3,803 | −2,617 | −2,202 | +18,372 | −2,037 | N,P,M,S |
| 181 | `efficiency_5m_n40_into_t0.5_short_indicator_or12h` | 66/66/13/13 | −3,932 | −3,966 | −508 | −266 | +18,351 | −2,160 | P,M,S |
| 182 | `efficiency_15m_n10_recovery_t0.75_short_indicator_or12h` | 271/271/70/70 | −3,989 | −4,446 | −26 | −123 | +18,293 | −1,925 | P,M,S |
| 183 | `efficiency_5m_n20_recovery_t0.5_short_indicator_or12h` | 659/659/170/170 | −4,001 | −4,305 | +799 | +943 | +18,282 | −1,548 | P,M,S |
| 184 | `efficiency_240m_n10_recovery_t0.75_short_indicator_or12h` | 22/22/8/8 | −4,116 | −3,931 | −1,212 | −1,160 | +18,167 | −2,037 | N,P,M,S |
| 185 | `efficiency_30m_n40_recovery_t0.5_short_fixed12h` | 15/15/6/6 | −4,150 | −4,227 | −1,158 | −1,279 | +18,132 | −2,037 | N,P,M,S |
| 186 | `efficiency_30m_n40_recovery_t0.5_short_indicator_or12h` | 15/15/6/6 | −4,161 | −4,218 | −1,158 | −1,279 | +18,122 | −2,037 | N,P,M,S |
| 187 | `atr_move_240m_n14_recovery_t1_short_fixed12h` | 117/110/36/33 | −4,164 | −3,983 | −875 | −243 | +18,119 | −2,442 | P,M,S |
| 188 | `efficiency_15m_n40_into_t0.5_short_fixed12h` | 21/21/5/5 | −4,167 | −4,172 | −2,244 | −2,191 | +18,115 | −1,566 | N,P,M,S |
| 189 | `efficiency_30m_n20_recovery_t0.25_short_indicator_or12h` | 389/383/105/103 | −4,171 | −3,749 | −5,424 | −5,561 | +18,112 | −2,632 | P,M,S |
| 190 | `atr_move_240m_n14_into_t1_short_indicator_or12h` | 122/121/35/35 | −4,182 | −4,768 | −1,838 | −1,724 | +18,101 | −1,581 | P,M,S |
| 191 | `efficiency_30m_n20_into_t0.25_short_fixed12h` | 358/351/94/93 | −4,223 | −4,467 | −3,846 | −4,700 | +18,059 | −2,451 | P,M,S |
| 192 | `efficiency_15m_n20_recovery_t0.25_short_fixed12h` | 511/506/131/131 | −4,306 | −3,324 | −5,267 | −4,598 | +17,977 | −1,265 | P,M,S |
| 193 | `efficiency_15m_n40_into_t0.25_short_fixed12h` | 275/273/77/76 | −4,343 | −4,541 | −2,263 | −2,546 | +17,940 | −1,560 | P,M,S |
| 194 | `efficiency_30m_n10_recovery_t0.75_short_indicator_or12h` | 144/144/41/41 | −4,364 | −4,705 | −796 | −958 | +17,919 | −1,660 | P,M,S |
| 195 | `efficiency_30m_n10_into_t0.75_short_fixed12h` | 140/137/40/39 | −4,402 | −4,715 | −211 | −912 | +17,881 | −1,986 | P,M,S |
| 196 | `efficiency_5m_n40_recovery_t0.5_short_fixed12h` | 63/63/11/11 | −4,420 | −4,153 | −1,007 | −1,029 | +17,862 | −2,197 | P,M,S |
| 197 | `efficiency_30m_n10_recovery_t0.75_short_fixed12h` | 139/138/39/39 | −4,559 | −4,970 | −1,581 | −1,895 | +17,724 | −2,203 | P,M,S |
| 198 | `efficiency_15m_n40_into_t0.5_short_indicator_or12h` | 21/21/5/5 | −4,601 | −4,670 | −2,349 | −2,235 | +17,681 | −1,836 | N,P,M,S |
| 199 | `atr_move_30m_n14_into_t2_short_fixed12h` | 91/91/19/19 | −4,622 | −4,745 | −3,136 | −3,319 | +17,660 | −1,878 | P,M,S |
| 200 | `efficiency_15m_n20_into_t0.5_short_fixed12h` | 187/184/48/48 | −4,714 | −4,393 | +82 | −198 | +17,569 | −1,631 | P,M,S |
| 201 | `efficiency_5m_n10_into_t0.75_short_indicator_or12h` | 908/908/223/223 | −4,776 | −6,555 | −242 | −532 | +17,506 | −1,777 | P,M,S |
| 202 | `efficiency_15m_n40_recovery_t0.5_short_fixed12h` | 21/21/5/5 | −4,792 | −4,818 | −2,577 | −2,450 | +17,491 | −1,632 | N,P,M,S |
| 203 | `atr_move_60m_n14_into_t0.5_short_indicator_or12h` | 1468/1468/379/379 | −4,807 | −7,375 | −1,665 | −1,897 | +17,476 | −1,495 | P,M,S |
| 204 | `atr_move_5m_n14_into_t2_short_indicator_or12h` | 674/674/178/178 | −4,808 | −6,431 | −1,688 | −1,711 | +17,475 | −2,084 | P,M,S |
| 205 | `atr_move_240m_n14_into_t0.5_short_fixed12h` | 352/306/87/78 | −4,849 | −7,382 | −3,515 | −1,369 | +17,433 | −2,612 | P,M,S |
| 206 | `efficiency_5m_n40_recovery_t0.5_short_indicator_or12h` | 66/66/13/13 | −4,869 | −4,922 | −275 | −289 | +17,414 | −2,146 | P,M,S |
| 207 | `efficiency_15m_n20_trend_t0.5_short_indicator_or12h` | 197/196/43/42 | −4,878 | −3,808 | −2,427 | −1,884 | +17,405 | −2,888 | P,M,S |
| 208 | `atr_move_60m_n14_recovery_t2_short_fixed12h` | 43/43/9/9 | −4,887 | −5,050 | −2,676 | −2,648 | +17,396 | −1,754 | N,P,M,S |
| 209 | `efficiency_30m_n40_into_t0.25_short_indicator_or12h` | 181/180/53/53 | −4,962 | −4,904 | −2,398 | −2,095 | +17,320 | −1,754 | P,M,S |
| 210 | `efficiency_30m_n40_trend_t0.25_short_fixed12h` | 163/162/36/36 | −4,977 | −4,651 | −3,297 | −3,320 | +17,305 | −1,954 | P,M,S |
| 211 | `efficiency_5m_n20_into_t0.5_short_fixed12h` | 408/407/100/100 | −4,999 | −3,666 | −5,315 | −5,386 | +17,283 | −1,500 | P,M,S |
| 212 | `atr_move_15m_n14_into_t2_short_fixed12h` | 148/148/46/46 | −5,094 | −5,013 | −1,477 | −1,804 | +17,189 | −1,455 | P,M,S |
| 213 | `efficiency_15m_n40_recovery_t0.5_short_indicator_or12h` | 21/21/5/5 | −5,143 | −5,069 | −2,598 | −2,443 | +17,139 | −1,869 | N,P,M,S |
| 214 | `efficiency_30m_n10_into_t0.25_short_indicator_or12h` | 813/809/203/201 | −5,149 | −7,365 | −4,603 | −5,289 | +17,133 | −1,598 | P,M,S |
| 215 | `efficiency_15m_n20_recovery_t0.5_short_indicator_or12h` | 197/197/49/49 | −5,152 | −5,760 | −3,020 | −3,127 | +17,131 | −1,510 | P,M,S |
| 216 | `efficiency_240m_n10_into_t0.25_short_indicator_or12h` | 143/134/41/41 | −5,156 | −5,116 | −345 | −410 | +17,126 | −1,388 | P,M,S |
| 217 | `efficiency_15m_n20_into_t0.5_short_indicator_or12h` | 198/197/49/49 | −5,633 | −6,404 | −2,534 | −2,778 | +16,650 | −1,380 | P,M,S |
| 218 | `efficiency_30m_n10_into_t0.5_short_indicator_or12h` | 447/446/123/122 | −5,716 | −7,098 | −2,805 | −3,047 | +16,566 | −2,238 | P,M,S |
| 219 | `efficiency_240m_n10_into_t0.25_short_fixed12h` | 143/132/41/39 | −5,724 | −5,971 | −394 | −676 | +16,558 | −1,388 | P,M,S |
| 220 | `efficiency_30m_n10_trend_t0.75_short_indicator_or12h` | 134/133/35/34 | −5,807 | −5,277 | −3,247 | −3,026 | +16,476 | −1,899 | P,M,S |
| 221 | `efficiency_15m_n40_into_t0.25_short_indicator_or12h` | 279/276/78/77 | −5,866 | −6,660 | −1,822 | −2,062 | +16,417 | −1,974 | P,M,S |
| 222 | `atr_move_30m_n14_recovery_t2_short_fixed12h` | 91/91/19/19 | −5,961 | −6,159 | −3,377 | −3,559 | +16,322 | −1,866 | P,M,S |
| 223 | `efficiency_60m_n10_into_t0.25_short_indicator_or12h` | 448/442/114/111 | −6,069 | −6,074 | −4,251 | −4,018 | +16,213 | −2,567 | P,M,S |
| 224 | `efficiency_60m_n10_trend_t0.5_short_indicator_or12h` | 232/229/57/56 | −6,095 | −5,435 | −2,066 | −1,992 | +16,188 | −3,309 | P,M,S |
| 225 | `efficiency_30m_n40_into_t0.25_short_fixed12h` | 180/179/52/52 | −6,135 | −5,777 | −4,152 | −3,911 | +16,148 | −1,709 | P,M,S |
| 226 | `atr_move_30m_n14_into_t1_short_fixed12h` | 494/481/130/126 | −6,139 | −4,835 | −5,846 | −5,408 | +16,144 | −2,868 | P,M,S |
| 227 | `atr_move_5m_n14_recovery_t2_short_indicator_or12h` | 676/665/179/177 | −6,146 | −7,898 | −1,927 | −2,107 | +16,137 | −2,577 | P,M,S |
| 228 | `efficiency_30m_n20_trend_t0.5_short_fixed12h` | 107/106/23/22 | −6,157 | −5,849 | −67 | +11 | +16,125 | −2,729 | P,M,S |
| 229 | `efficiency_15m_n10_recovery_t0.5_short_fixed12h` | 535/530/134/134 | −6,172 | −7,963 | −4,094 | −4,596 | +16,111 | −1,877 | P,M,S |
| 230 | `efficiency_60m_n10_trend_t0.75_short_fixed12h` | 71/71/15/15 | −6,179 | −6,024 | −1,149 | −1,081 | +16,104 | −3,552 | P,M,S |
| 231 | `atr_move_60m_n14_into_t2_short_fixed12h` | 43/43/9/9 | −6,241 | −6,109 | −3,373 | −3,321 | +16,041 | −1,799 | N,P,M,S |
| 232 | `efficiency_30m_n10_recovery_t0.5_short_indicator_or12h` | 451/447/124/123 | −6,274 | −6,668 | −4,026 | −4,696 | +16,008 | −2,216 | P,M,S |
| 233 | `efficiency_60m_n10_recovery_t0.5_short_indicator_or12h` | 240/233/71/71 | −6,342 | −5,508 | −2,375 | −2,234 | +15,941 | −2,039 | P,M,S |
| 234 | `efficiency_15m_n10_into_t0.5_short_fixed12h` | 536/525/131/130 | −6,383 | −9,245 | −5,215 | −5,623 | +15,900 | −1,097 | P,M,S |
| 235 | `efficiency_30m_n20_trend_t0.5_short_indicator_or12h` | 107/106/23/22 | −6,445 | −5,518 | −285 | +154 | +15,837 | −2,997 | P,M,S |
| 236 | `efficiency_240m_n10_trend_t0.25_short_indicator_or12h` | 151/135/39/33 | −6,454 | −5,965 | −978 | −879 | +15,829 | −3,262 | P,M,S |
| 237 | `efficiency_15m_n10_into_t0.25_short_indicator_or12h` | 1580/1580/401/401 | −6,475 | −10,392 | −5,003 | −5,690 | +15,807 | −1,744 | P,M,S |
| 238 | `efficiency_15m_n20_recovery_t0.25_short_indicator_or12h` | 702/698/183/182 | −6,556 | −6,236 | −6,411 | −6,699 | +15,727 | −1,879 | P,M,S |
| 239 | `efficiency_240m_n10_trend_t0.25_short_fixed12h` | 150/135/38/33 | −6,622 | −6,690 | −1,120 | −1,264 | +15,661 | −2,536 | P,M,S |
| 240 | `efficiency_60m_n20_recovery_t0.5_short_indicator_or12h` | 71/70/20/20 | −6,635 | −6,655 | −2,351 | −2,444 | +15,647 | −1,657 | P,M,S |
| 241 | `efficiency_5m_n10_recovery_t0.75_short_indicator_or12h` | 908/908/223/223 | −6,711 | −6,647 | −469 | −268 | +15,571 | −1,770 | P,M,S |
| 242 | `efficiency_60m_n10_into_t0.5_short_fixed12h` | 245/239/75/73 | −6,744 | −7,618 | +63 | −1,198 | +15,539 | −2,652 | P,M,S |
| 243 | `efficiency_60m_n20_into_t0.5_short_indicator_or12h` | 71/71/19/19 | −6,786 | −6,674 | −2,479 | −2,481 | +15,496 | −1,376 | P,M,S |
| 244 | `efficiency_60m_n20_recovery_t0.25_short_indicator_or12h` | 231/221/64/61 | −6,852 | −5,507 | −3,079 | −2,281 | +15,431 | −2,150 | P,M,S |
| 245 | `efficiency_5m_n20_recovery_t0.5_short_fixed12h` | 412/409/103/102 | −6,890 | −5,436 | −6,045 | −5,809 | +15,393 | −1,889 | P,M,S |
| 246 | `efficiency_15m_n20_trend_t0.5_short_fixed12h` | 184/183/40/39 | −6,939 | −6,601 | −2,166 | −2,052 | +15,344 | −2,397 | P,M,S |
| 247 | `atr_move_240m_n14_recovery_t0.5_short_indicator_or12h` | 379/330/90/83 | −6,952 | −2,604 | +313 | −127 | +15,330 | −2,938 | P,M,S |
| 248 | `efficiency_60m_n20_into_t0.5_short_fixed12h` | 71/71/19/19 | −6,978 | −6,838 | −3,054 | −3,003 | +15,304 | −1,384 | P,M,S |
| 249 | `efficiency_60m_n20_recovery_t0.5_short_fixed12h` | 71/70/20/20 | −7,215 | −7,170 | −2,974 | −3,008 | +15,067 | −1,835 | P,M,S |
| 250 | `efficiency_30m_n10_trend_t0.5_short_indicator_or12h` | 416/415/100/99 | −7,326 | −5,630 | −2,761 | −2,391 | +14,956 | −3,135 | P,M,S |
| 251 | `efficiency_5m_n40_recovery_t0.25_short_fixed12h` | 513/511/131/131 | −7,369 | −6,319 | −4,635 | −4,310 | +14,914 | −1,552 | P,M,S |
| 252 | `efficiency_60m_n10_into_t0.5_short_indicator_or12h` | 246/241/75/73 | −7,370 | −7,779 | −1,406 | −1,920 | +14,913 | −2,184 | P,M,S |
| 253 | `efficiency_5m_n40_recovery_t0.25_short_indicator_or12h` | 762/761/202/202 | −7,374 | −9,370 | −2,922 | −4,217 | +14,909 | −1,571 | P,M,S |
| 254 | `efficiency_30m_n40_trend_t0.25_short_indicator_or12h` | 163/162/36/36 | −7,381 | −7,158 | −2,333 | −2,389 | +14,902 | −2,139 | P,M,S |
| 255 | `efficiency_5m_n20_into_t0.25_short_fixed12h` | 711/708/181/181 | −7,421 | −7,740 | −6,039 | −6,553 | +14,862 | −499 | P,M,S |
| 256 | `efficiency_60m_n10_recovery_t0.5_short_fixed12h` | 240/230/71/71 | −7,442 | −6,781 | −1,270 | −1,195 | +14,841 | −2,565 | P,M,S |
| 257 | `efficiency_15m_n10_recovery_t0.5_short_indicator_or12h` | 876/866/215/212 | −7,521 | −8,868 | −4,802 | −4,504 | +14,762 | −2,795 | P,M,S |
| 258 | `efficiency_60m_n10_trend_t0.75_short_indicator_or12h` | 71/71/15/15 | −7,557 | −7,319 | −825 | −718 | +14,725 | −3,262 | P,M,S |
| 259 | `atr_move_30m_n14_recovery_t1_short_indicator_or12h` | 983/930/268/258 | −7,572 | −6,902 | +46 | −580 | +14,711 | −1,154 | P,M,S |
| 260 | `efficiency_15m_n10_trend_t0.75_short_fixed12h` | 207/206/45/45 | −7,677 | −6,339 | −2,135 | −1,940 | +14,605 | −2,116 | P,M,S |
| 261 | `efficiency_5m_n20_into_t0.25_short_indicator_or12h` | 2141/2141/555/555 | −7,846 | −10,255 | −1,826 | −2,524 | +14,437 | −1,193 | P,M,S |
| 262 | `efficiency_15m_n10_trend_t0.75_short_indicator_or12h` | 249/249/51/51 | −7,876 | −5,819 | −1,583 | −1,241 | +14,406 | −1,708 | P,M,S |
| 263 | `efficiency_15m_n20_into_t0.25_short_indicator_or12h` | 700/699/181/180 | −7,893 | −9,478 | −5,468 | −6,127 | +14,389 | −1,435 | P,M,S |
| 264 | `efficiency_60m_n20_trend_t0.25_short_indicator_or12h` | 230/220/58/57 | −8,194 | −6,042 | −3,031 | −2,671 | +14,089 | −1,554 | P,M,S |
| 265 | `efficiency_30m_n10_recovery_t0.5_short_fixed12h` | 373/361/101/100 | −8,296 | −7,772 | −3,460 | −3,457 | +13,987 | −1,580 | P,M,S |
| 266 | `efficiency_30m_n10_recovery_t0.25_short_indicator_or12h` | 865/795/220/200 | −8,420 | −7,185 | −6,217 | −6,708 | +13,863 | −2,102 | P,M,S |
| 267 | `atr_move_240m_n14_trend_t0.5_short_indicator_or12h` | 349/342/85/83 | −8,508 | −7,608 | −3,575 | −2,933 | +13,774 | −3,043 | P,M,S |
| 268 | `efficiency_30m_n10_trend_t0.5_short_fixed12h` | 351/347/87/85 | −8,669 | −10,235 | −3,984 | −4,195 | +13,613 | −3,032 | P,M,S |
| 269 | `efficiency_30m_n10_into_t0.5_short_fixed12h` | 367/360/100/99 | −8,764 | −9,755 | −2,505 | −2,308 | +13,518 | −1,175 | P,M,S |
| 270 | `efficiency_60m_n20_trend_t0.25_short_fixed12h` | 228/218/58/57 | −8,806 | −5,949 | −4,067 | −3,456 | +13,476 | −2,025 | P,M,S |
| 271 | `efficiency_15m_n10_into_t0.25_short_fixed12h` | 678/661/172/168 | −8,989 | −9,668 | −6,536 | −6,495 | +13,294 | −1,110 | P,M,S |
| 272 | `efficiency_60m_n10_trend_t0.5_short_fixed12h` | 230/227/57/56 | −9,351 | −8,354 | −1,909 | −1,624 | +12,932 | −4,701 | P,M,S |
| 273 | `atr_move_240m_n14_trend_t0.5_short_fixed12h` | 323/286/80/69 | −9,377 | −7,696 | −6,012 | −5,636 | +12,905 | −3,028 | P,M,S |
| 274 | `efficiency_30m_n10_trend_t0.75_short_fixed12h` | 130/130/32/32 | −9,417 | −9,416 | −3,819 | −3,831 | +12,866 | −1,747 | P,M,S |
| 275 | `efficiency_60m_n20_into_t0.25_short_fixed12h` | 232/225/61/61 | −9,802 | −9,844 | −4,829 | −5,220 | +12,481 | −2,296 | P,M,S |
| 276 | `efficiency_30m_n10_recovery_t0.25_short_fixed12h` | 545/535/139/138 | −9,827 | −5,988 | −6,682 | −4,574 | +12,456 | −1,875 | P,M,S |
| 277 | `atr_move_15m_n14_recovery_t1_short_fixed12h` | 628/620/164/161 | −10,019 | −7,695 | −6,167 | −6,277 | +12,264 | −1,481 | P,M,S |
| 278 | `efficiency_60m_n10_recovery_t0.25_short_fixed12h` | 394/385/103/102 | −10,107 | −8,564 | −8,399 | −6,990 | +12,176 | −2,073 | P,M,S |
| 279 | `atr_move_60m_n14_recovery_t0.5_short_indicator_or12h` | 1469/1260/381/323 | −10,258 | −6,931 | −3,930 | −4,043 | +12,025 | −2,217 | P,M,S |
| 280 | `atr_move_30m_n14_recovery_t1_short_fixed12h` | 493/481/130/126 | −10,504 | −9,322 | −7,366 | −7,373 | +11,778 | −3,441 | P,M,S |
| 281 | `atr_move_240m_n14_recovery_t0.5_short_fixed12h` | 343/303/85/79 | −10,541 | −7,698 | −4,564 | −992 | +11,742 | −2,620 | P,M,S |
| 282 | `atr_move_15m_n14_into_t1_short_fixed12h` | 628/621/164/161 | −10,945 | −11,279 | −5,968 | −5,847 | +11,337 | −963 | P,M,S |
| 283 | `efficiency_5m_n10_recovery_t0.5_short_fixed12h` | 716/714/182/182 | −11,222 | −11,905 | −6,632 | −5,253 | +11,061 | −1,742 | P,M,S |
| 284 | `atr_move_60m_n14_trend_t1_short_indicator_or12h` | 452/452/110/110 | −11,513 | −10,857 | −4,378 | −4,137 | +10,770 | −3,467 | P,M,S |
| 285 | `atr_move_5m_n14_trend_t2_short_indicator_or12h` | 658/658/170/170 | −11,614 | −9,514 | −2,429 | −2,684 | +10,668 | −2,472 | P,M,S |
| 286 | `atr_move_60m_n14_into_t0.5_short_fixed12h` | 632/593/162/147 | −11,737 | −10,705 | −4,461 | −5,185 | +10,545 | −1,587 | P,M,S |
| 287 | `efficiency_15m_n40_trend_t0.25_short_fixed12h` | 266/266/63/63 | −12,329 | −11,447 | −3,932 | −3,394 | +9,954 | −4,033 | P,M,S |
| 288 | `efficiency_60m_n20_into_t0.25_short_indicator_or12h` | 235/228/62/62 | −12,522 | −12,406 | −5,150 | −5,642 | +9,761 | −1,436 | P,M,S |
| 289 | `efficiency_5m_n10_trend_t0.75_short_fixed12h` | 462/459/115/115 | −12,631 | −12,504 | −3,735 | −3,417 | +9,652 | −3,852 | P,M,S |
| 290 | `efficiency_15m_n40_trend_t0.25_short_indicator_or12h` | 269/269/64/64 | −12,876 | −12,080 | −5,303 | −4,837 | +9,407 | −4,681 | P,M,S |
| 291 | `efficiency_30m_n10_into_t0.25_long_fixed12h` | 555/541/140/135 | +12,441 | +11,800 | +4,694 | +5,368 | +9,137 | −2,765 | C,M |
| 292 | `efficiency_30m_n20_trend_t0.25_short_indicator_or12h` | 386/381/97/96 | −13,273 | −12,527 | −5,986 | −6,049 | +9,010 | −3,706 | P,M,S |
| 293 | `atr_move_30m_n14_into_t0.5_short_fixed12h` | 728/702/187/179 | −13,409 | −10,152 | −4,887 | −3,809 | +8,874 | −1,432 | P,M,S |
| 294 | `atr_move_15m_n14_recovery_t1_short_indicator_or12h` | 2039/1927/544/523 | −13,452 | −13,635 | −2,050 | −1,925 | +8,830 | −2,816 | P,M,S |
| 295 | `efficiency_5m_n10_into_t0.5_short_fixed12h` | 714/711/183/183 | −13,705 | −12,669 | −5,540 | −5,539 | +8,577 | −1,331 | P,M,S |
| 296 | `atr_move_30m_n14_into_t0.5_long_fixed12h` | 736/709/185/180 | +11,876 | +8,234 | +7,439 | +5,282 | +8,572 | −1,525 | M |
| 297 | `efficiency_30m_n20_recovery_t0.25_short_fixed12h` | 361/352/100/97 | −13,897 | −12,270 | −8,117 | −7,325 | +8,386 | −2,662 | P,M,S |
| 298 | `efficiency_30m_n20_trend_t0.25_short_fixed12h` | 362/359/93/92 | −14,011 | −13,370 | −8,238 | −8,498 | +8,271 | −2,794 | P,M,S |
| 299 | `atr_move_5m_n14_into_t2_long_fixed12h` | 386/385/101/100 | +11,127 | +9,719 | +5,796 | +5,699 | +7,822 | −4,242 | M |
| 300 | `atr_move_15m_n14_recovery_t0.5_short_fixed12h` | 793/775/202/197 | −14,491 | −16,818 | −6,556 | −8,672 | +7,791 | −2,004 | P,M,S |
| 301 | `efficiency_5m_n20_recovery_t0.25_short_indicator_or12h` | 2165/2139/562/555 | −14,608 | −14,838 | −2,921 | −2,446 | +7,675 | −2,514 | P,M,S |
| 302 | `atr_move_15m_n14_into_t1_short_indicator_or12h` | 2050/2050/552/552 | −14,826 | −17,510 | −4,483 | −5,127 | +7,457 | −4,197 | P,M,S |
| 303 | `efficiency_60m_n10_trend_t0.25_short_fixed12h` | 400/385/100/99 | −14,997 | −12,622 | −7,306 | −6,319 | +7,286 | −4,240 | P,M,S |
| 304 | `atr_move_60m_n14_into_t0.5_long_fixed12h` | 631/597/160/152 | +10,435 | +9,067 | +4,328 | +4,026 | +7,130 | −2,958 | C,M |
| 305 | `efficiency_5m_n40_into_t0.25_long_fixed12h` | 493/491/121/121 | +10,177 | +10,026 | +5,990 | +6,252 | +6,872 | −5,298 | M |
| 306 | `efficiency_15m_n20_into_t0.25_long_fixed12h` | 496/493/125/124 | +10,093 | +9,847 | +6,570 | +6,674 | +6,789 | −4,531 | M |
| 307 | `efficiency_5m_n20_trend_t0.5_short_fixed12h` | 417/416/93/93 | −15,694 | −15,201 | −1,498 | −1,647 | +6,589 | −5,010 | P,M,S |
| 308 | `atr_move_60m_n14_recovery_t0.5_short_fixed12h` | 631/592/163/150 | −16,108 | −17,320 | −6,273 | −7,258 | +6,175 | −3,741 | P,M,S |
| 309 | `efficiency_5m_n20_trend_t0.5_short_indicator_or12h` | 670/670/154/154 | −16,126 | −14,870 | −3,268 | −3,473 | +6,156 | −2,531 | P,M,S |
| 310 | `atr_move_60m_n14_into_t1_long_fixed12h` | 326/309/81/78 | +9,390 | +9,692 | +3,721 | +3,533 | +6,085 | −3,638 | C,M |
| 311 | `efficiency_5m_n10_into_t0.5_short_indicator_or12h` | 2659/2659/664/664 | −16,212 | −19,317 | −3,318 | −4,313 | +6,070 | −2,845 | P,M,S |
| 312 | `atr_move_5m_n14_recovery_t2_long_fixed12h` | 386/385/101/100 | +9,222 | +8,365 | +5,784 | +5,951 | +5,917 | −4,204 | M |
| 313 | `efficiency_60m_n10_trend_t0.25_short_indicator_or12h` | 439/437/109/109 | −16,369 | −15,316 | −6,197 | −5,725 | +5,914 | −3,501 | P,M,S |
| 314 | `atr_move_60m_n14_trend_t1_short_fixed12h` | 326/309/81/78 | −16,598 | −16,527 | −5,530 | −5,276 | +5,685 | −3,034 | P,M,S |
| 315 | `atr_move_30m_n14_recovery_t0.5_short_fixed12h` | 723/704/186/179 | −16,804 | −14,137 | −7,888 | −7,437 | +5,479 | −2,258 | P,M,S |
| 316 | `efficiency_15m_n10_trend_t0.25_short_fixed12h` | 660/652/164/163 | −16,896 | −16,382 | −5,248 | −6,337 | +5,386 | −2,418 | P,M,S |
| 317 | `efficiency_5m_n10_into_t0.5_long_fixed12h` | 712/710/181/180 | +8,658 | +10,820 | +6,967 | +7,086 | +5,353 | −2,866 | M |
| 318 | `atr_move_15m_n14_trend_t1_short_fixed12h` | 625/621/161/161 | −16,951 | −15,489 | −8,634 | −8,296 | +5,331 | −1,883 | P,M,S |
| 319 | `efficiency_30m_n10_trend_t0.25_short_indicator_or12h` | 795/791/197/194 | −17,113 | −15,124 | −6,764 | −6,092 | +5,169 | −2,311 | P,M,S |
| 320 | `atr_move_15m_n14_into_t0.5_short_fixed12h` | 790/774/202/198 | −17,132 | −19,982 | −7,387 | −7,875 | +5,150 | −1,575 | P,M,S |
| 321 | `efficiency_15m_n20_trend_t0.25_short_indicator_or12h` | 674/673/168/167 | −17,274 | −15,559 | −6,967 | −6,410 | +5,008 | −3,680 | P,M,S |
| 322 | `efficiency_5m_n20_trend_t0.25_short_fixed12h` | 698/697/175/175 | −17,413 | −20,211 | −9,518 | −8,188 | +4,869 | −1,433 | P,M,S |
| 323 | `efficiency_5m_n10_into_t0.25_short_fixed12h` | 787/781/200/199 | −17,727 | −18,370 | −7,762 | −8,088 | +4,556 | −963 | P,M,S |
| 324 | `efficiency_5m_n10_recovery_t0.25_short_fixed12h` | 789/781/202/200 | −17,817 | −19,042 | −7,936 | −7,536 | +4,465 | −1,647 | P,M,S |
| 325 | `atr_move_30m_n14_into_t1_long_fixed12h` | 469/458/112/109 | +7,744 | +8,685 | +428 | +522 | +4,440 | −3,915 | C,M,S |
| 326 | `atr_move_60m_n14_recovery_t1_long_fixed12h` | 325/306/81/77 | +7,656 | +6,143 | +714 | +57 | +4,351 | −2,626 | C,M,S |
| 327 | `efficiency_15m_n10_recovery_t0.25_short_fixed12h` | 676/662/176/172 | −18,034 | −19,321 | −11,059 | −10,807 | +4,249 | −2,028 | P,C,M,S |
| 328 | `atr_move_15m_n14_trend_t0.5_short_fixed12h` | 791/777/202/200 | −18,050 | −19,325 | −9,452 | −10,590 | +4,233 | −1,414 | P,C,M,S |
| 329 | `atr_move_30m_n14_trend_t1_short_fixed12h` | 469/458/112/109 | −18,076 | −18,776 | −2,894 | −2,921 | +4,206 | −2,958 | P,M,S |
| 330 | `efficiency_5m_n10_trend_t0.75_short_indicator_or12h` | 879/879/221/221 | −18,152 | −16,244 | −4,905 | −4,499 | +4,130 | −3,200 | P,M,S |
| 331 | `efficiency_60m_n20_trend_t0.25_long_indicator_or12h` | 235/228/62/62 | +7,341 | +7,380 | +3,781 | +4,273 | +4,036 | −3,083 | C,M |
| 332 | `efficiency_5m_n20_recovery_t0.25_short_fixed12h` | 716/714/181/181 | −18,398 | −15,596 | −9,756 | −8,959 | +3,885 | −1,689 | P,M,S |
| 333 | `atr_move_5m_n14_into_t0.5_short_fixed12h` | 839/834/214/213 | −18,409 | −19,163 | −7,039 | −8,282 | +3,873 | −687 | P,M,S |
| 334 | `efficiency_15m_n10_into_t0.5_long_fixed12h` | 514/509/129/127 | +7,154 | +6,664 | +6,007 | +6,123 | +3,850 | −4,469 | M |
| 335 | `efficiency_15m_n10_trend_t0.5_short_fixed12h` | 514/509/129/127 | −18,477 | −17,875 | −8,853 | −8,925 | +3,806 | −3,782 | P,M,S |
| 336 | `efficiency_5m_n40_trend_t0.25_short_indicator_or12h` | 734/734/169/169 | −18,545 | −17,233 | −4,356 | −4,005 | +3,738 | −3,384 | P,M,S |
| 337 | `atr_move_5m_n14_recovery_t1_short_fixed12h` | 776/771/198/197 | −18,551 | −18,867 | −8,980 | −9,504 | +3,732 | −820 | P,M,S |
| 338 | `efficiency_15m_n40_into_t0.25_long_indicator_or12h` | 269/269/64/64 | +6,925 | +6,130 | +3,868 | +3,402 | +3,621 | −6,599 | C,M |
| 339 | `atr_move_30m_n14_into_t0.5_short_indicator_or12h` | 2972/2972/769/769 | −18,843 | −26,761 | −6,847 | −8,654 | +3,440 | −2,524 | P,C,M,S |
| 340 | `efficiency_60m_n10_into_t0.25_long_indicator_or12h` | 439/437/109/109 | +6,676 | +5,668 | +3,772 | +3,300 | +3,371 | −6,380 | C,M |
| 341 | `efficiency_5m_n10_recovery_t0.5_long_fixed12h` | 714/703/182/179 | +6,675 | +4,268 | +6,100 | +4,959 | +3,371 | −3,221 | C,M,S |
| 342 | `atr_move_5m_n14_into_t1_long_fixed12h` | 780/773/199/197 | +6,608 | +3,237 | +5,878 | +4,064 | +3,304 | −1,904 | C,M,S |
| 343 | `efficiency_30m_n10_into_t0.75_long_fixed12h` | 130/130/32/32 | +6,526 | +6,525 | +3,089 | +3,101 | +3,221 | −5,573 | C,M |
| 344 | `efficiency_5m_n20_into_t0.5_long_fixed12h` | 417/416/93/93 | +6,508 | +6,037 | −548 | −399 | +3,203 | −5,691 | P,C,M,S |
| 345 | `efficiency_15m_n40_into_t0.25_long_fixed12h` | 266/266/63/63 | +6,444 | +5,564 | +2,521 | +1,983 | +3,140 | −5,696 | C,M |
| 346 | `efficiency_15m_n10_into_t0.5_long_indicator_or12h` | 847/847/204/204 | +6,400 | +3,854 | +1,347 | +569 | +3,095 | −4,604 | C,M,S |
| 347 | `atr_move_5m_n14_recovery_t0.5_short_fixed12h` | 839/833/214/213 | −19,284 | −22,304 | −7,570 | −8,919 | +2,999 | −970 | P,M,S |
| 348 | `atr_move_5m_n14_into_t1_short_fixed12h` | 776/771/198/197 | −19,386 | −17,889 | −8,950 | −9,139 | +2,897 | −1,106 | P,M,S |
| 349 | `efficiency_60m_n10_into_t0.25_long_fixed12h` | 400/385/100/99 | +6,163 | +4,120 | +5,077 | +4,113 | +2,858 | −4,615 | C,M |
| 350 | `efficiency_30m_n20_into_t0.25_long_fixed12h` | 362/359/93/92 | +6,014 | +5,440 | +6,162 | +6,444 | +2,710 | −3,223 | M |
| 351 | `efficiency_60m_n10_into_t0.75_long_indicator_or12h` | 71/71/15/15 | +5,988 | +5,750 | +494 | +387 | +2,683 | −5,674 | C,M |
| 352 | `atr_move_5m_n14_trend_t2_short_fixed12h` | 386/385/101/100 | −19,658 | −18,226 | −8,048 | −7,929 | +2,625 | −4,110 | P,M,S |
| 353 | `atr_move_30m_n14_trend_t1_short_indicator_or12h` | 939/939/221/221 | −19,680 | −16,654 | −5,788 | −5,959 | +2,602 | −2,779 | P,M,S |
| 354 | `atr_move_5m_n14_into_t0.5_long_fixed12h` | 837/832/213/212 | +5,722 | +5,006 | +4,344 | +4,934 | +2,417 | −1,033 | C,M,S |
| 355 | `efficiency_5m_n10_into_t0.25_long_fixed12h` | 784/776/199/197 | +5,610 | −1,712 | +3,643 | +2,446 | +2,306 | −1,961 | P,C,M,S |
| 356 | `efficiency_15m_n10_into_t0.25_long_indicator_or12h` | 1587/1587/407/407 | +5,592 | +1,934 | +504 | −694 | +2,288 | −4,787 | P,C,M,S |
| 357 | `efficiency_60m_n20_trend_t0.5_long_fixed12h` | 71/71/19/19 | +5,410 | +5,269 | +2,633 | +2,582 | +2,105 | −3,788 | C,M |
| 358 | `atr_move_30m_n14_recovery_t1_long_fixed12h` | 470/460/112/110 | +5,389 | +7,740 | −1,420 | −1,487 | +2,084 | −3,707 | P,C,M,S |
| 359 | `atr_move_60m_n14_trend_t2_long_fixed12h` | 43/43/9/9 | +5,289 | +5,157 | +3,171 | +3,120 | +1,985 | −4,580 | N,C,M |
| 360 | `efficiency_60m_n20_trend_t0.5_long_indicator_or12h` | 71/71/19/19 | +5,218 | +5,105 | +2,058 | +2,060 | +1,913 | −3,999 | C,M |
| 361 | `efficiency_60m_n20_recovery_t0.25_long_fixed12h` | 223/218/57/54 | +5,098 | +5,956 | +5,689 | +4,376 | +1,794 | −3,944 | C,M |
| 362 | `efficiency_15m_n40_recovery_t0.25_long_indicator_or12h` | 273/272/64/64 | +5,098 | +4,430 | +2,068 | +2,024 | +1,794 | −6,724 | C,M |
| 363 | `efficiency_30m_n10_recovery_t0.75_long_fixed12h` | 130/130/32/32 | +4,951 | +5,694 | +1,821 | +1,940 | +1,647 | −5,138 | C,M |
| 364 | `efficiency_15m_n10_recovery_t0.25_short_indicator_or12h` | 1682/1548/425/393 | −20,761 | −21,073 | −11,218 | −10,270 | +1,522 | −2,645 | P,C,M,S |
| 365 | `efficiency_30m_n20_into_t0.25_long_indicator_or12h` | 386/381/97/96 | +4,749 | +4,114 | +3,825 | +3,909 | +1,444 | −6,226 | C,M |
| 366 | `atr_move_5m_n14_recovery_t1_long_fixed12h` | 779/773/199/197 | +4,725 | +3,330 | +5,545 | +5,256 | +1,421 | −1,727 | C,M,S |
| 367 | `efficiency_60m_n10_recovery_t0.75_long_indicator_or12h` | 71/71/15/15 | +4,707 | +4,635 | −302 | −284 | +1,402 | −5,378 | P,C,M,S |
| 368 | `efficiency_60m_n20_trend_t0.25_long_fixed12h` | 232/225/61/61 | +4,690 | +4,886 | +3,482 | +3,873 | +1,385 | −3,545 | C,M |
| 369 | `efficiency_60m_n10_into_t0.75_long_fixed12h` | 71/71/15/15 | +4,611 | +4,456 | +818 | +750 | +1,306 | −5,382 | C,M |
| 370 | `efficiency_15m_n20_trend_t0.25_short_fixed12h` | 496/493/125/124 | −21,023 | −20,710 | −9,329 | −9,410 | +1,260 | −2,984 | P,M,S |
| 371 | `efficiency_5m_n40_trend_t0.25_short_fixed12h` | 493/491/121/121 | −21,040 | −20,845 | −8,660 | −8,922 | +1,243 | −2,569 | P,M,S |
| 372 | `efficiency_5m_n20_recovery_t0.5_long_fixed12h` | 417/415/93/93 | +4,432 | +3,629 | −570 | −756 | +1,127 | −5,283 | P,C,M,S |
| 373 | `efficiency_60m_n10_into_t0.5_long_fixed12h` | 230/227/57/56 | +4,261 | +3,332 | +631 | +369 | +957 | −4,579 | C,M,S |
| 374 | `efficiency_15m_n40_trend_t0.5_long_indicator_or12h` | 21/21/5/5 | +4,134 | +4,203 | +2,236 | +2,123 | +830 | −4,207 | N,C,M |
| 375 | `efficiency_30m_n20_into_t0.5_long_indicator_or12h` | 107/106/23/22 | +4,086 | +3,181 | −221 | −638 | +781 | −6,412 | P,C,M,S |
| 376 | `efficiency_30m_n20_into_t0.5_long_fixed12h` | 107/106/23/22 | +3,798 | +3,512 | −438 | −495 | +493 | −6,457 | P,C,M,S |
| 377 | `efficiency_30m_n40_into_t0.25_long_indicator_or12h` | 163/162/36/36 | +3,789 | +3,588 | +1,539 | +1,595 | +484 | −5,771 | C,M |
| 378 | `efficiency_60m_n20_into_t0.25_long_fixed12h` | 228/218/58/57 | +3,783 | +1,150 | +2,787 | +2,199 | +479 | −6,387 | C,M,S |
| 379 | `atr_move_5m_n14_recovery_t0.5_long_fixed12h` | 838/833/214/213 | +3,747 | +3,536 | +3,972 | +6,584 | +442 | −844 | C,M,S |
| 380 | `efficiency_15m_n40_trend_t0.5_long_fixed12h` | 21/21/5/5 | +3,701 | +3,706 | +2,131 | +2,079 | +396 | −4,295 | N,C,M |
| 381 | `efficiency_5m_n40_recovery_t0.25_long_fixed12h` | 495/495/120/120 | +3,596 | +5,065 | +5,546 | +5,855 | +291 | −5,752 | M,S |
| 382 | `efficiency_240m_n10_into_t0.25_long_fixed12h` | 150/135/38/33 | +3,317 | +3,714 | +283 | +537 | +12 | −4,080 | C,M,S |
| 383 | `efficiency_5m_n10_recovery_t0.25_long_fixed12h` | 785/780/199/198 | +3,310 | +3,908 | +1,926 | +1,160 | +6 | −2,168 | C,M,S |
| 384 | `efficiency_240m_n20_trend_t0.5_long_fixed12h` | 28/26/11/10 | +3,291 | +3,227 | +2,372 | +1,980 | −14 | −4,752 | N,C,M |
| 385 | `efficiency_240m_n20_trend_t0.5_long_indicator_or12h` | 28/26/11/10 | +3,291 | +3,227 | +2,372 | +1,980 | −14 | −4,752 | N,C,M |
| 386 | `atr_move_15m_n14_into_t1_long_fixed12h` | 625/621/161/161 | +3,168 | +1,795 | +5,062 | +4,725 | −136 | −2,496 | C,M,S |
| 387 | `efficiency_60m_n20_into_t0.25_long_indicator_or12h` | 230/220/58/57 | +3,128 | +1,198 | +1,752 | +1,414 | −177 | −6,592 | C,M,S |
| 388 | `efficiency_240m_n10_into_t0.25_long_indicator_or12h` | 151/135/39/33 | +3,126 | +2,990 | +120 | +153 | −178 | −3,792 | C,M,S |
| 389 | `efficiency_15m_n10_into_t0.75_long_fixed12h` | 207/206/45/45 | +3,095 | +1,781 | +1,121 | +926 | −209 | −6,292 | C,M,S |
| 390 | `atr_move_30m_n14_recovery_t0.5_long_fixed12h` | 733/708/184/179 | +2,926 | +9,792 | +4,085 | +3,977 | −378 | −2,246 | C,M,S |
| 391 | `efficiency_15m_n20_into_t0.5_long_fixed12h` | 184/183/40/39 | +2,864 | +2,548 | +1,262 | +1,171 | −441 | −6,687 | C,M |
| 392 | `efficiency_30m_n10_into_t0.75_long_indicator_or12h` | 134/133/35/34 | +2,854 | +2,324 | +2,474 | +2,253 | −451 | −6,029 | C,M |
| 393 | `efficiency_5m_n20_into_t0.75_long_indicator_or12h` | 44/44/6/6 | +2,852 | +6,345 | +373 | +447 | −452 | −5,721 | N,C,M |
| 394 | `efficiency_5m_n10_trend_t0.25_short_fixed12h` | 784/776/199/197 | −22,896 | −15,390 | −8,049 | −6,807 | −614 | −1,962 | P,C,M,S |
| 395 | `efficiency_15m_n20_trend_t0.75_long_fixed12h` | 16/16/5/5 | +2,652 | +2,590 | +929 | +834 | −652 | −4,599 | N,C,M |
| 396 | `atr_move_30m_n14_trend_t2_long_fixed12h` | 91/91/19/19 | +2,616 | +2,739 | +2,715 | +2,898 | −688 | −5,311 | C,M |
| 397 | `efficiency_240m_n10_recovery_t0.25_long_fixed12h` | 147/140/35/34 | +2,614 | +2,301 | +2,371 | +2,406 | −690 | −3,890 | C,M |
| 398 | `efficiency_240m_n10_trend_t0.25_long_fixed12h` | 143/132/41/39 | +2,574 | +3,062 | −508 | −183 | −731 | −4,756 | P,C,M,S |
| 399 | `efficiency_30m_n40_into_t0.5_long_indicator_or12h` | 10/10/2/2 | +2,550 | +2,235 | +321 | +313 | −755 | −5,789 | N,C,M |
| 400 | `atr_move_60m_n14_recovery_t0.5_long_fixed12h` | 637/601/160/154 | +2,496 | +8,559 | +3,105 | +3,114 | −809 | −2,437 | C,M,S |
| 401 | `efficiency_5m_n40_trend_t0.5_long_indicator_or12h` | 66/66/13/13 | +2,476 | +2,510 | +221 | −20 | −828 | −6,090 | P,C,M,S |
| 402 | `efficiency_5m_n10_into_t0.75_long_fixed12h` | 462/459/115/115 | +2,458 | +2,398 | +1,202 | +885 | −846 | −4,752 | C,M,S |
| 403 | `efficiency_15m_n20_into_t0.25_long_indicator_or12h` | 674/673/168/167 | +2,435 | +722 | +3,265 | +2,709 | −869 | −5,893 | C,M,S |
| 404 | `efficiency_15m_n10_into_t0.75_long_indicator_or12h` | 249/249/51/51 | +2,393 | +337 | +459 | +118 | −912 | −5,643 | C,M,S |
| 405 | `efficiency_5m_n40_into_t0.25_long_indicator_or12h` | 734/734/169/169 | +2,385 | +1,075 | +636 | +285 | −919 | −5,839 | C,M,S |
| 406 | `efficiency_30m_n40_trend_t0.5_long_fixed12h` | 16/16/6/6 | +2,359 | +2,297 | +857 | +784 | −945 | −5,097 | N,C,M |
| 407 | `efficiency_30m_n40_into_t0.5_long_fixed12h` | 10/10/2/2 | +2,358 | +2,153 | +238 | +256 | −947 | −5,789 | N,C,M |
| 408 | `efficiency_15m_n10_into_t0.25_long_fixed12h` | 660/652/164/163 | +2,344 | +2,005 | +1,614 | +2,724 | −961 | −2,540 | C,M,S |
| 409 | `atr_move_5m_n14_trend_t1_long_fixed12h` | 776/771/198/197 | +2,280 | +895 | +4,564 | +4,775 | −1,025 | −1,179 | C,M,S |
| 410 | `atr_move_240m_n14_into_t0.5_long_fixed12h` | 323/286/80/69 | +2,243 | +1,377 | +4,225 | +4,090 | −1,062 | −5,267 | C,M,S |
| 411 | `efficiency_30m_n10_recovery_t0.25_long_fixed12h` | 538/524/136/133 | +2,231 | +5,665 | +4,129 | +4,400 | −1,073 | −3,399 | C,M,S |
| 412 | `efficiency_30m_n40_trend_t0.25_long_fixed12h` | 180/179/52/52 | +2,149 | +1,813 | +2,983 | +2,741 | −1,156 | −3,927 | C,M |
| 413 | `efficiency_5m_n40_trend_t0.5_long_fixed12h` | 63/63/11/11 | +2,148 | +2,012 | +1,107 | +821 | −1,156 | −4,828 | C,M |
| 414 | `efficiency_30m_n20_trend_t0.75_long_indicator_or12h` | 11/11/4/4 | +2,108 | +2,063 | +1,528 | +1,473 | −1,197 | −4,195 | N,C,M |
| 415 | `efficiency_5m_n20_into_t0.75_long_fixed12h` | 42/42/6/6 | +2,090 | +5,770 | −247 | −190 | −1,215 | −6,267 | N,P,C,M,S |
| 416 | `efficiency_240m_n10_into_t0.5_long_indicator_or12h` | 81/74/14/14 | +2,078 | +2,643 | −427 | −468 | −1,227 | −5,851 | P,C,M,S |
| 417 | `efficiency_30m_n40_trend_t0.5_long_indicator_or12h` | 16/16/6/6 | +2,070 | +1,899 | +857 | +784 | −1,235 | −5,458 | N,C,M |
| 418 | `efficiency_30m_n20_recovery_t0.25_long_indicator_or12h` | 382/378/94/93 | +2,057 | +2,247 | +1,582 | +1,801 | −1,248 | −6,020 | C,M,S |
| 419 | `efficiency_60m_n40_trend_t0.5_long_fixed12h` | 14/14/5/5 | +2,048 | +1,904 | +229 | +226 | −1,257 | −6,641 | N,C,M |
| 420 | `efficiency_60m_n40_trend_t0.5_long_indicator_or12h` | 14/14/5/5 | +2,048 | +1,904 | +229 | +226 | −1,257 | −6,641 | N,C,M |
| 421 | `efficiency_5m_n40_into_t0.5_long_fixed12h` | 56/56/9/9 | +2,040 | +1,251 | −370 | −717 | −1,265 | −5,830 | N,P,C,M,S |
| 422 | `efficiency_5m_n20_into_t0.25_long_fixed12h` | 698/697/175/175 | +2,024 | +4,841 | +5,637 | +4,309 | −1,280 | −3,057 | C,M,S |
| 423 | `efficiency_240m_n10_trend_t0.25_long_indicator_or12h` | 143/134/41/41 | +2,006 | +2,164 | −557 | −492 | −1,298 | −4,763 | P,C,M,S |
| 424 | `efficiency_60m_n10_trend_t0.5_long_indicator_or12h` | 246/241/75/73 | +1,953 | +2,471 | −245 | +313 | −1,352 | −4,577 | P,C,M,S |
| 425 | `efficiency_15m_n20_recovery_t0.25_long_fixed12h` | 501/496/125/122 | +1,922 | −2,086 | +5,108 | +4,381 | −1,382 | −4,903 | P,C,M,S |
| 426 | `efficiency_240m_n10_into_t0.5_long_fixed12h` | 81/74/14/14 | +1,890 | +2,490 | −427 | −467 | −1,414 | −5,851 | P,C,M,S |
| 427 | `efficiency_240m_n20_recovery_t0.5_long_fixed12h` | 23/22/3/3 | +1,863 | +426 | +752 | +725 | −1,441 | −5,660 | N,C,M |
| 428 | `efficiency_30m_n20_trend_t0.75_long_fixed12h` | 11/11/4/4 | +1,848 | +1,759 | +1,372 | +1,310 | −1,457 | −4,195 | N,C,M |
| 429 | `efficiency_60m_n10_trend_t0.75_long_indicator_or12h` | 81/81/21/21 | +1,834 | +1,859 | +1,652 | +1,745 | −1,471 | −3,746 | C,M |
| 430 | `atr_move_15m_n14_trend_t2_long_fixed12h` | 148/148/46/46 | +1,834 | +1,753 | +464 | +791 | −1,471 | −4,459 | C,M |
| 431 | `atr_move_240m_n14_trend_t2_long_indicator_or12h` | 14/14/4/4 | +1,800 | +2,003 | +356 | +392 | −1,504 | −6,436 | N,C,M |
| 432 | `atr_move_5m_n14_trend_t1_short_fixed12h` | 780/773/199/197 | −23,807 | −20,278 | −10,287 | −8,427 | −1,524 | −1,911 | P,C,M,S |
| 433 | `atr_move_60m_n14_trend_t2_long_indicator_or12h` | 44/44/9/9 | +1,767 | +1,931 | +2,335 | +2,340 | −1,537 | −4,597 | N,C,M |
| 434 | `efficiency_60m_n10_trend_t0.75_long_fixed12h` | 81/81/21/21 | +1,723 | +1,921 | +2,682 | +2,841 | −1,581 | −3,574 | C,M |
| 435 | `efficiency_30m_n20_recovery_t0.5_long_indicator_or12h` | 106/106/22/22 | +1,640 | +2,203 | −1,120 | −1,007 | −1,664 | −5,968 | P,C,M,S |
| 436 | `efficiency_240m_n10_into_t0.75_long_indicator_or12h` | 16/16/4/4 | +1,569 | +1,729 | +216 | +325 | −1,736 | −5,789 | N,C,M |
| 437 | `atr_move_60m_n14_into_t1_long_indicator_or12h` | 452/452/110/110 | +1,561 | +907 | +1,954 | +1,714 | −1,743 | −5,468 | C,M,S |
| 438 | `efficiency_240m_n40_into_t0.25_long_fixed12h` | 47/42/14/12 | +1,555 | +1,851 | −539 | −376 | −1,750 | −6,160 | P,C,M,S |
| 439 | `efficiency_240m_n40_into_t0.25_long_indicator_or12h` | 47/42/14/12 | +1,555 | +1,851 | −539 | −376 | −1,750 | −6,160 | P,C,M,S |
| 440 | `efficiency_30m_n10_recovery_t0.75_long_indicator_or12h` | 134/133/35/34 | +1,549 | +1,774 | +1,129 | +1,094 | −1,756 | −5,878 | C,M |
| 441 | `efficiency_240m_n40_recovery_t0.25_long_fixed12h` | 49/41/16/14 | +1,542 | +2,022 | +378 | +115 | −1,763 | −4,667 | C,M,S |
| 442 | `atr_move_240m_n14_trend_t1_long_indicator_or12h` | 122/121/35/35 | +1,495 | +2,103 | +1,066 | +953 | −1,810 | −5,823 | C,M |
| 443 | `atr_move_240m_n14_recovery_t0.5_long_indicator_or12h` | 350/303/83/72 | +1,480 | +727 | −624 | −21 | −1,825 | −5,761 | P,C,M,S |
| 444 | `efficiency_5m_n10_recovery_t0.75_long_fixed12h` | 462/460/115/115 | +1,438 | +1,031 | −25 | −483 | −1,867 | −4,472 | P,C,M,S |
| 445 | `atr_move_5m_n14_trend_t0.5_short_fixed12h` | 837/832/213/212 | −24,174 | −23,347 | −9,059 | −9,628 | −1,892 | −1,216 | P,C,M,S |
| 446 | `efficiency_60m_n10_recovery_t0.75_long_fixed12h` | 71/71/15/15 | +1,391 | +1,489 | −22 | +50 | −1,914 | −5,305 | P,C,M,S |
| 447 | `efficiency_30m_n40_into_t0.25_long_fixed12h` | 163/162/36/36 | +1,388 | +1,084 | +2,501 | +2,525 | −1,917 | −5,534 | C,M,S |
| 448 | `efficiency_60m_n20_into_t0.5_long_indicator_or12h` | 62/62/14/14 | +1,379 | +1,538 | −682 | −765 | −1,926 | −5,546 | P,C,M,S |
| 449 | `efficiency_240m_n10_into_t0.75_long_fixed12h` | 16/16/4/4 | +1,377 | +1,491 | +216 | +336 | −1,927 | −5,789 | N,C,M |
| 450 | `efficiency_5m_n20_into_t0.5_long_indicator_or12h` | 670/670/154/154 | +1,376 | +121 | −122 | +83 | −1,928 | −5,195 | P,C,M,S |
| 451 | `efficiency_60m_n10_trend_t0.5_long_fixed12h` | 245/239/75/73 | +1,349 | +2,354 | −1,712 | −408 | −1,955 | −4,810 | P,C,M,S |
| 452 | `efficiency_240m_n20_recovery_t0.25_long_fixed12h` | 78/72/21/18 | +1,338 | +1,523 | +1,183 | +1,159 | −1,966 | −4,221 | C,M |
| 453 | `efficiency_240m_n20_recovery_t0.5_long_indicator_or12h` | 23/22/3/3 | +1,338 | +426 | +752 | +725 | −1,966 | −5,660 | N,C,M |
| 454 | `efficiency_30m_n10_trend_t0.75_long_fixed12h` | 140/137/40/39 | +1,319 | +1,698 | −669 | +54 | −1,986 | −4,646 | P,C,M,S |
| 455 | `efficiency_240m_n40_trend_t0.5_long_fixed12h` | 3/2/2/1 | +1,299 | +1,249 | +302 | +234 | −2,005 | −5,789 | N,C,M |
| 456 | `efficiency_240m_n40_trend_t0.5_long_indicator_or12h` | 3/2/2/1 | +1,299 | +1,249 | +302 | +234 | −2,005 | −5,789 | N,C,M |
| 457 | `efficiency_15m_n20_trend_t0.5_long_indicator_or12h` | 198/197/49/49 | +1,273 | +2,065 | +1,453 | +1,698 | −2,032 | −5,007 | C,M,S |
| 458 | `efficiency_240m_n20_into_t0.5_long_fixed12h` | 23/21/3/3 | +1,255 | +1,623 | +625 | +601 | −2,050 | −5,942 | N,C,M |
| 459 | `efficiency_240m_n20_into_t0.5_long_indicator_or12h` | 23/21/3/3 | +1,255 | +1,623 | +625 | +601 | −2,050 | −5,942 | N,C,M |
| 460 | `atr_move_60m_n14_trend_t0.5_short_fixed12h` | 631/597/160/152 | −24,336 | −22,240 | −7,855 | −7,398 | −2,053 | −3,022 | P,C,M,S |
| 461 | `efficiency_5m_n10_trend_t0.5_short_fixed12h` | 712/710/181/180 | −24,362 | −26,482 | −10,980 | −11,078 | −2,079 | −2,924 | P,C,M,S |
| 462 | `efficiency_240m_n10_trend_t0.75_long_fixed12h` | 25/23/9/7 | +1,217 | +1,510 | +376 | +853 | −2,087 | −6,146 | N,C,M |
| 463 | `efficiency_240m_n10_trend_t0.75_long_indicator_or12h` | 25/23/9/7 | +1,217 | +1,507 | +376 | +853 | −2,087 | −6,146 | N,C,M |
| 464 | `atr_move_240m_n14_trend_t1_long_fixed12h` | 119/111/34/33 | +1,190 | +3,992 | +277 | +375 | −2,114 | −6,214 | C,M,S |
| 465 | `efficiency_15m_n40_into_t0.5_long_indicator_or12h` | 22/22/1/1 | +1,119 | +1,431 | +184 | +184 | −2,186 | −5,691 | N,C,M |
| 466 | `efficiency_15m_n10_recovery_t0.75_long_fixed12h` | 206/206/45/45 | +1,118 | +1,132 | +439 | +292 | −2,186 | −6,283 | C,M,S |
| 467 | `efficiency_240m_n40_trend_t0.25_long_fixed12h` | 37/35/12/12 | +1,023 | +1,069 | −364 | −377 | −2,281 | −6,082 | P,C,M,S |
| 468 | `efficiency_240m_n40_trend_t0.25_long_indicator_or12h` | 37/35/12/12 | +1,023 | +1,069 | −364 | −377 | −2,281 | −6,082 | P,C,M,S |
| 469 | `efficiency_240m_n40_recovery_t0.25_long_indicator_or12h` | 49/41/16/14 | +1,017 | +1,566 | +378 | +115 | −2,288 | −5,192 | C,M,S |
| 470 | `efficiency_15m_n20_trend_t0.75_long_indicator_or12h` | 16/16/5/5 | +980 | +1,004 | +179 | +88 | −2,324 | −5,758 | N,C,M |
| 471 | `efficiency_30m_n40_trend_t0.25_long_indicator_or12h` | 181/180/53/53 | +977 | +941 | +1,230 | +928 | −2,327 | −4,073 | C,M,S |
| 472 | `efficiency_60m_n10_into_t0.5_long_indicator_or12h` | 232/229/57/56 | +965 | +372 | +788 | +736 | −2,339 | −6,526 | C,M,S |
| 473 | `efficiency_30m_n10_into_t0.5_long_fixed12h` | 351/347/87/85 | +942 | +2,572 | +2,067 | +2,299 | −2,363 | −5,029 | C,M,S |
| 474 | `atr_move_240m_n14_recovery_t1_long_indicator_or12h` | 118/110/26/24 | +940 | −38 | −142 | −192 | −2,365 | −6,666 | P,C,M,S |
| 475 | `efficiency_30m_n20_into_t0.75_long_indicator_or12h` | 5/5/0/0 | +933 | +790 | 0 | 0 | −2,371 | −5,566 | N,P,C,M,S |
| 476 | `efficiency_30m_n10_trend_t0.25_short_fixed12h` | 555/541/140/135 | −24,672 | −23,721 | −7,781 | −8,345 | −2,389 | −3,732 | P,C,M,S |
| 477 | `efficiency_5m_n40_into_t0.5_long_indicator_or12h` | 57/57/9/9 | +910 | +326 | +676 | +450 | −2,394 | −5,848 | N,C,M,S |
| 478 | `atr_move_30m_n14_into_t2_long_indicator_or12h` | 91/91/23/23 | +900 | +662 | +391 | +190 | −2,405 | −5,763 | C,M,S |
| 479 | `efficiency_60m_n20_into_t0.5_long_fixed12h` | 62/62/14/14 | +862 | +894 | −689 | −719 | −2,443 | −5,459 | P,C,M,S |
| 480 | `efficiency_60m_n40_into_t0.25_long_indicator_or12h` | 99/96/19/19 | +858 | −900 | −1,515 | −1,891 | −2,446 | −5,463 | P,C,M,S |
| 481 | `atr_move_240m_n14_trend_t2_long_fixed12h` | 14/13/4/4 | +832 | +1,281 | +51 | −4 | −2,472 | −6,324 | N,P,C,M,S |
| 482 | `atr_move_240m_n14_into_t0.5_long_indicator_or12h` | 349/342/85/83 | +803 | +57 | +1,680 | +1,082 | −2,501 | −6,947 | C,M,S |
| 483 | `efficiency_30m_n20_into_t0.75_long_fixed12h` | 5/5/0/0 | +750 | +686 | 0 | 0 | −2,554 | −5,473 | N,P,C,M,S |
| 484 | `efficiency_30m_n20_recovery_t0.75_long_fixed12h` | 5/5/0/0 | +717 | +805 | 0 | 0 | −2,587 | −5,542 | N,P,C,M,S |
| 485 | `efficiency_15m_n40_into_t0.5_long_fixed12h` | 22/22/1/1 | +717 | +1,111 | +227 | +225 | −2,588 | −5,644 | N,C,M |
| 486 | `efficiency_30m_n10_trend_t0.5_long_fixed12h` | 367/360/100/99 | +663 | +1,807 | +281 | +107 | −2,641 | −4,187 | C,M,S |
| 487 | `atr_move_15m_n14_into_t0.5_long_fixed12h` | 791/777/202/200 | +637 | +2,219 | +5,000 | +6,180 | −2,667 | −2,394 | C,M,S |
| 488 | `efficiency_5m_n40_recovery_t0.5_long_fixed12h` | 57/57/9/9 | +614 | +867 | −905 | −870 | −2,691 | −6,043 | N,P,C,M,S |
| 489 | `efficiency_15m_n20_trend_t0.5_long_fixed12h` | 187/184/48/48 | +597 | +343 | −1,138 | −858 | −2,708 | −6,717 | P,C,M,S |
| 490 | `efficiency_30m_n20_recovery_t0.75_long_indicator_or12h` | 5/5/0/0 | +541 | +482 | 0 | 0 | −2,764 | −5,595 | N,P,C,M,S |
| 491 | `efficiency_15m_n20_into_t0.5_long_indicator_or12h` | 197/196/43/42 | +541 | −528 | +1,479 | +936 | −2,764 | −6,539 | P,C,M,S |
| 492 | `efficiency_60m_n40_into_t0.25_long_fixed12h` | 99/96/19/19 | +538 | −689 | −1,473 | −1,829 | −2,766 | −5,463 | P,C,M,S |
| 493 | `efficiency_15m_n10_trend_t0.5_short_indicator_or12h` | 847/847/204/204 | −25,051 | −22,503 | −5,839 | −5,060 | −2,768 | −3,499 | P,C,M,S |
| 494 | `efficiency_240m_n10_trend_t0.5_long_indicator_or12h` | 81/75/29/26 | +484 | +664 | +2,302 | +1,552 | −2,821 | −5,938 | C,M,S |
| 495 | `efficiency_240m_n10_trend_t0.5_long_fixed12h` | 81/75/29/26 | +461 | +684 | +2,302 | +1,577 | −2,843 | −5,938 | C,M,S |
| 496 | `atr_move_60m_n14_into_t2_long_indicator_or12h` | 41/41/11/11 | +392 | +356 | +3 | −115 | −2,913 | −5,663 | P,C,M,S |
| 497 | `efficiency_5m_n10_trend_t0.25_long_fixed12h` | 787/781/200/199 | +381 | +1,177 | +3,334 | +3,704 | −2,923 | −897 | C,M,S |
| 498 | `efficiency_60m_n20_recovery_t0.25_long_indicator_or12h` | 225/219/57/54 | +315 | +497 | +2,651 | +1,758 | −2,989 | −5,996 | C,M,S |
| 499 | `atr_move_15m_n14_recovery_t0.5_long_fixed12h` | 792/776/202/198 | +274 | +1,777 | +5,868 | +6,400 | −3,031 | −3,126 | C,M,S |
| 500 | `efficiency_240m_n20_recovery_t0.25_long_indicator_or12h` | 78/72/21/18 | +257 | +380 | +611 | +563 | −3,048 | −4,703 | C,M,S |
| 501 | `efficiency_15m_n40_trend_t0.75_long_fixed12h` | 1/1/1/1 | +242 | +234 | +242 | +234 | −3,062 | −5,789 | N,C,M |
| 502 | `efficiency_15m_n20_into_t0.75_long_indicator_or12h` | 18/18/2/2 | +209 | −126 | −32 | −60 | −3,096 | −5,789 | N,P,C,M,S |
| 503 | `efficiency_240m_n40_into_t0.5_long_fixed12h` | 2/2/0/0 | +190 | +145 | 0 | 0 | −3,114 | −5,789 | N,P,C,M,S |
| 504 | `efficiency_240m_n40_into_t0.5_long_indicator_or12h` | 2/2/0/0 | +190 | +145 | 0 | 0 | −3,114 | −5,789 | N,P,C,M,S |
| 505 | `efficiency_60m_n20_recovery_t0.5_long_fixed12h` | 66/62/15/15 | +174 | −1,193 | −1,042 | −1,078 | −3,131 | −5,233 | P,C,M,S |
| 506 | `efficiency_15m_n40_trend_t0.75_long_indicator_or12h` | 1/1/1/1 | +164 | +152 | +164 | +152 | −3,141 | −5,789 | N,C,M |
| 507 | `efficiency_5m_n20_recovery_t0.75_long_indicator_or12h` | 44/44/6/6 | +149 | −99 | +396 | +421 | −3,156 | −5,711 | N,P,C,M,S |
| 508 | `atr_move_30m_n14_recovery_t2_long_indicator_or12h` | 91/91/23/23 | +82 | +236 | +236 | +229 | −3,223 | −5,782 | C,M,S |
| 509 | `efficiency_15m_n40_recovery_t0.25_long_fixed12h` | 270/269/63/63 | +68 | −466 | +508 | +171 | −3,237 | −5,582 | P,C,M,S |
| 510 | `efficiency_60m_n20_trend_t0.75_long_fixed12h` | 8/8/3/3 | +60 | +112 | +355 | +369 | −3,245 | −6,388 | N,C,M,S |
| 511 | `efficiency_60m_n40_trend_t0.25_long_fixed12h` | 109/106/31/30 | +43 | +284 | +1,797 | +1,925 | −3,262 | −4,227 | C,M,S |
| 512 | `efficiency_240m_n40_recovery_t0.5_long_fixed12h` | 1/1/0/0 | +20 | +29 | 0 | 0 | −3,285 | −5,789 | N,P,C,M,S |
| 513 | `efficiency_240m_n40_recovery_t0.5_long_indicator_or12h` | 1/1/0/0 | +20 | +29 | 0 | 0 | −3,285 | −5,789 | N,P,C,M,S |
| 514 | `efficiency_15m_n10_recovery_t0.75_long_indicator_or12h` | 250/250/51/51 | +18 | −1,121 | −372 | −728 | −3,287 | −5,992 | P,C,M,S |
| 515 | `efficiency_30m_n40_recovery_t0.5_long_indicator_or12h` | 10/10/2/2 | +12 | +96 | +163 | +152 | −3,292 | −5,789 | N,C,M,S |
| 516 | `efficiency_60m_n20_trend_t0.75_long_indicator_or12h` | 8/8/3/3 | +11 | −54 | +355 | +369 | −3,293 | −6,518 | N,P,C,M,S |
| 517 | `efficiency_5m_n40_trend_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 518 | `efficiency_5m_n40_trend_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 519 | `efficiency_15m_n40_into_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 520 | `efficiency_15m_n40_into_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 521 | `efficiency_15m_n40_recovery_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 522 | `efficiency_15m_n40_recovery_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 523 | `efficiency_30m_n40_trend_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 524 | `efficiency_30m_n40_trend_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 525 | `efficiency_30m_n40_into_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 526 | `efficiency_30m_n40_into_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 527 | `efficiency_30m_n40_recovery_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 528 | `efficiency_30m_n40_recovery_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 529 | `efficiency_60m_n20_into_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 530 | `efficiency_60m_n20_into_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 531 | `efficiency_60m_n20_recovery_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 532 | `efficiency_60m_n20_recovery_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 533 | `efficiency_60m_n40_trend_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 534 | `efficiency_60m_n40_trend_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 535 | `efficiency_60m_n40_into_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 536 | `efficiency_60m_n40_into_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 537 | `efficiency_60m_n40_recovery_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 538 | `efficiency_60m_n40_recovery_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 539 | `efficiency_240m_n40_trend_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 540 | `efficiency_240m_n40_trend_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 541 | `efficiency_240m_n40_into_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 542 | `efficiency_240m_n40_into_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 543 | `efficiency_240m_n40_recovery_t0.75_long_fixed12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 544 | `efficiency_240m_n40_recovery_t0.75_long_indicator_or12h` | 0/0/0/0 | 0 | 0 | 0 | 0 | −3,305 | −5,789 | N,P,C,M,S |
| 545 | `efficiency_30m_n10_trend_t0.75_long_indicator_or12h` | 145/144/41/41 | −21 | +983 | −967 | −759 | −3,325 | −4,991 | P,C,M,S |
| 546 | `efficiency_240m_n20_into_t0.75_long_fixed12h` | 3/3/0/0 | −47 | −29 | 0 | 0 | −3,352 | −5,789 | N,P,C,M,S |
| 547 | `efficiency_240m_n20_into_t0.75_long_indicator_or12h` | 3/3/0/0 | −47 | −29 | 0 | 0 | −3,352 | −5,789 | N,P,C,M,S |
| 548 | `atr_move_5m_n14_trend_t0.5_long_fixed12h` | 839/834/214/213 | −81 | +782 | +2,304 | +3,568 | −3,385 | −1,302 | P,C,M,S |
| 549 | `efficiency_15m_n20_recovery_t0.75_long_indicator_or12h` | 18/18/2/2 | −115 | −93 | −80 | −53 | −3,419 | −5,789 | N,P,C,M,S |
| 550 | `efficiency_60m_n40_trend_t0.25_long_indicator_or12h` | 109/106/31/30 | −169 | +16 | +1,983 | +2,115 | −3,474 | −4,227 | P,C,M,S |
| 551 | `efficiency_60m_n10_recovery_t0.25_long_indicator_or12h` | 468/422/116/101 | −175 | −1,110 | +452 | −486 | −3,480 | −5,087 | P,C,M,S |
| 552 | `efficiency_30m_n20_recovery_t0.5_long_fixed12h` | 106/106/22/22 | −186 | +967 | −1,446 | −1,315 | −3,491 | −6,036 | P,C,M,S |
| 553 | `efficiency_60m_n40_into_t0.5_long_fixed12h` | 5/5/1/1 | −192 | −235 | +77 | +75 | −3,496 | −5,789 | N,P,C,M,S |
| 554 | `efficiency_60m_n40_into_t0.5_long_indicator_or12h` | 5/5/1/1 | −192 | −235 | +77 | +75 | −3,496 | −5,789 | N,P,C,M,S |
| 555 | `efficiency_30m_n40_recovery_t0.5_long_fixed12h` | 10/10/2/2 | −193 | −9 | +92 | +95 | −3,498 | −5,789 | N,P,C,M,S |
| 556 | `efficiency_15m_n10_recovery_t0.25_long_fixed12h` | 665/651/164/164 | −217 | −2,426 | +2,243 | +3,184 | −3,522 | −2,663 | P,C,M,S |
| 557 | `efficiency_15m_n40_trend_t0.25_long_indicator_or12h` | 279/276/78/77 | −275 | +584 | +105 | +366 | −3,580 | −4,541 | P,C,M,S |
| 558 | `atr_move_15m_n14_trend_t0.5_long_fixed12h` | 790/774/202/198 | −279 | +2,920 | +2,916 | +3,491 | −3,584 | −1,607 | P,C,M,S |
| 559 | `atr_move_240m_n14_into_t2_long_fixed12h` | 7/7/2/2 | −306 | −78 | −823 | −762 | −3,610 | −5,789 | N,P,C,M,S |
| 560 | `efficiency_5m_n10_recovery_t0.5_short_indicator_or12h` | 2680/2660/672/663 | −25,896 | −25,843 | −6,294 | −6,139 | −3,613 | −3,501 | P,C,M,S |
| 561 | `atr_move_240m_n14_recovery_t2_long_indicator_or12h` | 7/7/2/2 | −361 | −346 | −280 | −280 | −3,665 | −5,789 | N,P,C,M,S |
| 562 | `efficiency_30m_n10_into_t0.25_long_indicator_or12h` | 795/791/197/194 | −386 | −2,307 | +2,425 | +1,798 | −3,691 | −5,873 | P,C,M,S |
| 563 | `efficiency_5m_n40_into_t0.75_long_fixed12h` | 1/1/0/0 | −419 | −422 | 0 | 0 | −3,723 | −5,789 | N,P,C,M,S |
| 564 | `efficiency_5m_n40_recovery_t0.5_long_indicator_or12h` | 57/57/9/9 | −425 | −410 | +231 | +331 | −3,729 | −6,006 | N,P,C,M,S |
| 565 | `efficiency_240m_n20_trend_t0.75_long_fixed12h` | 4/3/1/1 | −458 | −168 | −276 | −275 | −3,763 | −5,789 | N,P,C,M,S |
| 566 | `efficiency_240m_n20_trend_t0.75_long_indicator_or12h` | 4/3/1/1 | −458 | −168 | −276 | −275 | −3,763 | −5,789 | N,P,C,M,S |
| 567 | `efficiency_15m_n40_recovery_t0.5_long_indicator_or12h` | 22/22/1/1 | −461 | −553 | +142 | +138 | −3,766 | −5,717 | N,P,C,M,S |
| 568 | `efficiency_15m_n40_recovery_t0.5_long_fixed12h` | 22/22/1/1 | −462 | −711 | +188 | +175 | −3,767 | −5,644 | N,P,C,M,S |
| 569 | `atr_move_240m_n14_into_t2_long_indicator_or12h` | 7/7/2/2 | −467 | −257 | −823 | −765 | −3,771 | −5,789 | N,P,C,M,S |
| 570 | `efficiency_30m_n40_recovery_t0.25_long_indicator_or12h` | 169/167/39/39 | −471 | −444 | +117 | +40 | −3,775 | −5,229 | P,C,M,S |
| 571 | `efficiency_5m_n40_recovery_t0.75_long_indicator_or12h` | 1/1/0/0 | −473 | −451 | 0 | 0 | −3,778 | −5,789 | N,P,C,M,S |
| 572 | `efficiency_15m_n20_recovery_t0.5_long_indicator_or12h` | 197/196/43/42 | −478 | −1,537 | +924 | +473 | −3,783 | −6,499 | P,C,M,S |
| 573 | `efficiency_5m_n40_recovery_t0.75_long_fixed12h` | 1/1/0/0 | −479 | −496 | 0 | 0 | −3,784 | −5,789 | N,P,C,M,S |
| 574 | `efficiency_5m_n40_into_t0.75_long_indicator_or12h` | 1/1/0/0 | −493 | −456 | 0 | 0 | −3,798 | −5,789 | N,P,C,M,S |
| 575 | `efficiency_30m_n20_trend_t0.5_long_indicator_or12h` | 119/119/32/32 | −531 | −270 | +846 | +1,026 | −3,836 | −4,306 | P,C,M,S |
| 576 | `efficiency_15m_n10_recovery_t0.5_long_fixed12h` | 511/506/127/126 | −567 | −2,516 | +3,126 | +2,266 | −3,872 | −5,091 | P,C,M,S |
| 577 | `atr_move_240m_n14_recovery_t2_long_fixed12h` | 7/7/2/2 | −580 | −543 | −428 | −426 | −3,884 | −5,789 | N,P,C,M,S |
| 578 | `efficiency_15m_n20_into_t0.75_long_fixed12h` | 18/18/2/2 | −583 | −842 | +399 | +374 | −3,887 | −5,789 | N,P,C,M,S |
| 579 | `atr_move_60m_n14_recovery_t2_long_indicator_or12h` | 41/41/11/11 | −723 | −622 | −7 | +17 | −4,027 | −5,583 | P,C,M,S |
| 580 | `atr_move_15m_n14_recovery_t2_long_indicator_or12h` | 177/177/52/52 | −760 | −356 | −575 | −339 | −4,065 | −6,101 | P,C,M,S |
| 581 | `efficiency_240m_n10_recovery_t0.25_long_indicator_or12h` | 149/140/35/34 | −775 | −1,045 | +825 | +737 | −4,080 | −4,062 | P,C,M,S |
| 582 | `efficiency_15m_n10_recovery_t0.5_long_indicator_or12h` | 856/848/210/204 | −793 | −2,804 | −1,654 | −1,928 | −4,098 | −5,360 | P,C,M,S |
| 583 | `efficiency_60m_n20_recovery_t0.5_long_indicator_or12h` | 66/62/15/15 | −857 | −947 | −961 | −1,003 | −4,162 | −5,399 | P,C,M,S |
| 584 | `efficiency_60m_n40_recovery_t0.25_long_fixed12h` | 101/99/23/23 | −859 | −1,399 | −1,129 | −1,026 | −4,163 | −4,511 | P,C,M,S |
| 585 | `efficiency_60m_n40_recovery_t0.5_long_fixed12h` | 5/5/1/1 | −986 | −1,003 | +12 | +23 | −4,290 | −5,789 | N,P,C,M,S |
| 586 | `efficiency_60m_n40_recovery_t0.5_long_indicator_or12h` | 5/5/1/1 | −986 | −1,003 | +12 | +23 | −4,290 | −5,789 | N,P,C,M,S |
| 587 | `atr_move_30m_n14_into_t1_long_indicator_or12h` | 939/939/221/221 | −988 | −4,011 | +922 | +1,093 | −4,292 | −6,544 | P,C,M,S |
| 588 | `atr_move_15m_n14_recovery_t1_long_fixed12h` | 626/621/161/161 | −1,014 | −1,216 | +3,895 | +3,597 | −4,319 | −2,624 | P,C,M,S |
| 589 | `efficiency_30m_n40_recovery_t0.25_long_fixed12h` | 169/166/39/39 | −1,042 | −1,872 | +862 | +814 | −4,347 | −3,911 | P,C,M,S |
| 590 | `efficiency_240m_n20_recovery_t0.75_long_fixed12h` | 3/3/0/0 | −1,082 | −979 | 0 | 0 | −4,386 | −5,789 | N,P,C,M,S |
| 591 | `efficiency_240m_n20_recovery_t0.75_long_indicator_or12h` | 3/3/0/0 | −1,082 | −979 | 0 | 0 | −4,386 | −5,789 | N,P,C,M,S |
| 592 | `efficiency_30m_n10_recovery_t0.5_long_fixed12h` | 358/354/87/86 | −1,111 | −1,045 | +148 | +51 | −4,416 | −4,902 | P,C,M,S |
| 593 | `atr_move_240m_n14_recovery_t1_long_fixed12h` | 112/108/25/24 | −1,129 | −1,361 | +288 | −65 | −4,433 | −6,377 | P,C,M,S |
| 594 | `efficiency_5m_n20_recovery_t0.75_long_fixed12h` | 42/42/6/6 | −1,135 | −1,016 | −186 | −153 | −4,439 | −6,206 | N,P,C,M,S |
| 595 | `atr_move_240m_n14_into_t1_long_indicator_or12h` | 114/114/25/25 | −1,146 | −1,021 | −847 | −842 | −4,451 | −6,279 | P,C,M,S |
| 596 | `efficiency_5m_n20_trend_t0.75_long_indicator_or12h` | 58/58/8/8 | −1,189 | −1,684 | −961 | −1,691 | −4,493 | −5,674 | N,P,C,M,S |
| 597 | `efficiency_5m_n10_into_t0.75_long_indicator_or12h` | 879/879/221/221 | −1,195 | −3,101 | +40 | −365 | −4,499 | −5,997 | P,C,M,S |
| 598 | `efficiency_15m_n20_recovery_t0.75_long_fixed12h` | 18/18/2/2 | −1,236 | −1,088 | +335 | +375 | −4,540 | −5,789 | N,P,C,M,S |
| 599 | `efficiency_60m_n10_recovery_t0.5_long_indicator_or12h` | 234/233/56/56 | −1,412 | −1,361 | −805 | −732 | −4,717 | −6,507 | P,C,M,S |
| 600 | `atr_move_60m_n14_into_t0.5_long_indicator_or12h` | 1471/1471/377/377 | −1,552 | −3,530 | +1,565 | +1,259 | −4,857 | −5,295 | P,C,M,S |
| 601 | `efficiency_60m_n40_recovery_t0.25_long_indicator_or12h` | 101/99/23/23 | −1,654 | −2,188 | −1,072 | −997 | −4,958 | −5,147 | P,C,M,S |
| 602 | `efficiency_15m_n40_trend_t0.25_long_fixed12h` | 275/273/77/76 | −1,709 | −1,466 | +568 | +872 | −5,013 | −4,518 | P,C,M,S |
| 603 | `efficiency_30m_n10_into_t0.5_long_indicator_or12h` | 416/415/100/99 | −1,829 | −3,523 | +559 | +190 | −5,133 | −6,617 | P,C,M,S |
| 604 | `atr_move_15m_n14_trend_t1_short_indicator_or12h` | 2039/2039/506/506 | −27,425 | −24,329 | −10,616 | −9,792 | −5,142 | −3,773 | P,C,M,S |
| 605 | `efficiency_240m_n20_into_t0.25_long_indicator_or12h` | 79/76/22/20 | −1,850 | −1,630 | +1,267 | +844 | −5,154 | −5,217 | P,C,M,S |
| 606 | `efficiency_240m_n20_into_t0.25_long_fixed12h` | 79/76/22/20 | −1,856 | −1,654 | +1,267 | +844 | −5,161 | −5,224 | P,C,M,S |
| 607 | `efficiency_240m_n10_recovery_t0.75_long_fixed12h` | 16/16/4/4 | −1,880 | −1,553 | −159 | −87 | −5,185 | −5,789 | N,P,C,M,S |
| 608 | `efficiency_15m_n20_recovery_t0.5_long_fixed12h` | 188/187/41/40 | −1,954 | −2,062 | −111 | −156 | −5,259 | −6,760 | P,C,M,S |
| 609 | `efficiency_5m_n10_trend_t0.5_long_fixed12h` | 714/711/183/183 | −2,031 | −3,000 | +1,488 | +1,488 | −5,336 | −1,587 | P,C,M,S |
| 610 | `efficiency_240m_n10_recovery_t0.75_long_indicator_or12h` | 16/16/4/4 | −2,188 | −1,871 | −421 | −371 | −5,492 | −5,789 | N,P,C,M,S |
| 611 | `atr_move_60m_n14_trend_t0.5_long_fixed12h` | 632/593/162/147 | −2,194 | −2,367 | +872 | +1,925 | −5,499 | −4,006 | P,C,M,S |
| 612 | `atr_move_60m_n14_into_t2_long_fixed12h` | 38/37/11/10 | −2,210 | −2,369 | +77 | −210 | −5,515 | −5,866 | P,C,M,S |
| 613 | `efficiency_5m_n20_recovery_t0.5_long_indicator_or12h` | 672/671/155/155 | −2,317 | −2,604 | −1,132 | −979 | −5,621 | −5,338 | P,C,M,S |
| 614 | `efficiency_5m_n40_recovery_t0.25_long_indicator_or12h` | 737/735/169/169 | −2,394 | −3,278 | +411 | +176 | −5,698 | −6,179 | P,C,M,S |
| 615 | `atr_move_30m_n14_recovery_t2_long_fixed12h` | 77/76/19/18 | −2,430 | −2,215 | +422 | +427 | −5,734 | −6,130 | P,C,M,S |
| 616 | `efficiency_5m_n20_recovery_t0.25_long_fixed12h` | 700/699/177/177 | −2,513 | −1,532 | +2,570 | +2,994 | −5,817 | −3,098 | P,C,M,S |
| 617 | `atr_move_240m_n14_into_t1_long_fixed12h` | 112/108/25/24 | −2,514 | −2,775 | −1,269 | −1,392 | −5,819 | −7,197 | P,C,M,S |
| 618 | `efficiency_5m_n20_trend_t0.75_long_fixed12h` | 58/58/8/8 | −2,524 | −2,548 | +998 | +932 | −5,828 | −6,175 | N,P,C,M,S |
| 619 | `atr_move_30m_n14_trend_t0.5_short_fixed12h` | 736/709/185/180 | −28,112 | −23,872 | −11,541 | −9,272 | −5,829 | −1,774 | P,C,M,S |
| 620 | `atr_move_15m_n14_trend_t2_long_indicator_or12h` | 174/174/58/58 | −2,562 | −2,687 | −605 | −519 | −5,866 | −5,558 | P,C,M,S |
| 621 | `atr_move_60m_n14_recovery_t1_long_indicator_or12h` | 449/432/111/104 | −2,594 | −1,911 | −1,552 | −1,569 | −5,898 | −5,922 | P,C,M,S |
| 622 | `atr_move_30m_n14_trend_t2_long_indicator_or12h` | 101/101/22/22 | −2,600 | −2,141 | +440 | +660 | −5,905 | −5,674 | P,C,M,S |
| 623 | `atr_move_30m_n14_trend_t0.5_long_fixed12h` | 728/702/187/179 | −2,635 | −5,316 | +748 | −153 | −5,940 | −3,007 | P,C,M,S |
| 624 | `atr_move_15m_n14_recovery_t2_long_fixed12h` | 150/149/43/42 | −2,847 | −2,588 | −743 | −592 | −6,152 | −6,373 | P,C,M,S |
| 625 | `atr_move_5m_n14_into_t2_long_indicator_or12h` | 658/658/170/170 | −2,866 | −4,965 | −1,312 | −1,057 | −6,171 | −6,390 | P,C,M,S |
| 626 | `atr_move_15m_n14_trend_t1_long_fixed12h` | 628/621/164/161 | −2,897 | −2,410 | +2,333 | +2,279 | −6,202 | −2,765 | P,C,M,S |
| 627 | `atr_move_240m_n14_trend_t0.5_long_fixed12h` | 352/306/87/78 | −2,918 | +624 | +1,576 | −369 | −6,222 | −5,840 | P,C,M,S |
| 628 | `efficiency_15m_n10_trend_t0.75_long_indicator_or12h` | 271/271/69/69 | −3,026 | −1,991 | −1,182 | −1,054 | −6,330 | −5,105 | P,C,M,S |
| 629 | `efficiency_240m_n20_trend_t0.25_long_indicator_or12h` | 86/83/24/23 | −3,049 | −3,080 | +745 | +954 | −6,354 | −5,479 | P,C,M,S |
| 630 | `efficiency_30m_n20_recovery_t0.25_long_fixed12h` | 358/354/92/90 | −3,052 | −2,896 | +2,338 | +1,891 | −6,357 | −3,897 | P,C,M,S |
| 631 | `atr_move_60m_n14_recovery_t2_long_fixed12h` | 38/37/11/10 | −3,342 | −3,538 | −541 | −715 | −6,646 | −5,852 | P,C,M,S |
| 632 | `efficiency_15m_n20_recovery_t0.25_long_indicator_or12h` | 682/673/167/166 | −3,389 | −5,484 | +1,341 | +921 | −6,693 | −5,787 | P,C,M,S |
| 633 | `atr_move_30m_n14_into_t2_long_fixed12h` | 77/76/19/18 | −3,461 | −2,642 | +886 | +903 | −6,765 | −6,055 | P,C,M,S |
| 634 | `atr_move_15m_n14_into_t2_long_indicator_or12h` | 178/178/53/53 | −3,499 | −2,677 | +434 | +381 | −6,803 | −5,770 | P,C,M,S |
| 635 | `efficiency_30m_n20_trend_t0.25_long_fixed12h` | 358/351/94/93 | −3,653 | −3,256 | +1,775 | +2,650 | −6,958 | −4,594 | P,C,M,S |
| 636 | `efficiency_240m_n20_trend_t0.25_long_fixed12h` | 86/83/24/23 | −3,701 | −4,093 | +651 | +899 | −7,006 | −5,479 | P,C,M,S |
| 637 | `efficiency_240m_n10_recovery_t0.5_long_fixed12h` | 79/74/14/14 | −3,715 | −2,288 | −1,164 | −1,074 | −7,020 | −4,575 | P,C,M,S |
| 638 | `efficiency_60m_n10_trend_t0.25_long_indicator_or12h` | 448/442/114/111 | −3,788 | −3,651 | +1,740 | +1,573 | −7,092 | −5,205 | P,C,M,S |
| 639 | `efficiency_30m_n10_recovery_t0.5_long_indicator_or12h` | 421/416/102/100 | −3,835 | −4,204 | −1,094 | −1,352 | −7,139 | −6,492 | P,C,M,S |
| 640 | `efficiency_5m_n20_into_t0.25_long_indicator_or12h` | 2077/2077/527/527 | −3,943 | −6,468 | −1,086 | −1,194 | −7,248 | −6,007 | P,C,M,S |
| 641 | `efficiency_5m_n20_trend_t0.5_long_fixed12h` | 408/407/100/100 | −3,977 | −5,287 | +3,110 | +3,181 | −7,282 | −4,695 | P,C,M,S |
| 642 | `atr_move_240m_n14_recovery_t0.5_long_fixed12h` | 321/290/77/67 | −3,981 | −7,858 | −2,014 | −3,400 | −7,285 | −4,998 | P,C,M,S |
| 643 | `efficiency_60m_n10_recovery_t0.5_long_fixed12h` | 232/231/56/56 | −4,064 | −3,924 | −1,725 | −1,438 | −7,368 | −6,339 | P,C,M,S |
| 644 | `efficiency_30m_n10_trend_t0.5_long_indicator_or12h` | 447/446/123/122 | −4,119 | −2,716 | +97 | +361 | −7,423 | −4,658 | P,C,M,S |
| 645 | `efficiency_240m_n10_recovery_t0.5_long_indicator_or12h` | 79/74/14/14 | −4,253 | −3,067 | −1,256 | −1,204 | −7,558 | −4,688 | P,C,M,S |
| 646 | `atr_move_30m_n14_recovery_t0.5_short_indicator_or12h` | 2981/2511/776/658 | −29,854 | −22,205 | −5,242 | −3,514 | −7,571 | −2,986 | P,C,M,S |
| 647 | `atr_move_15m_n14_into_t2_long_fixed12h` | 150/149/43/42 | −4,274 | −3,163 | −1,177 | −1,026 | −7,578 | −6,322 | P,C,M,S |
| 648 | `atr_move_30m_n14_recovery_t1_long_indicator_or12h` | 939/885/223/207 | −4,464 | −4,880 | −748 | −743 | −7,769 | −6,691 | P,C,M,S |
| 649 | `atr_move_30m_n14_trend_t1_long_fixed12h` | 494/481/130/126 | −4,752 | −5,768 | +2,959 | +2,609 | −8,056 | −3,974 | P,C,M,S |
| 650 | `efficiency_30m_n20_trend_t0.25_long_indicator_or12h` | 392/386/102/101 | −4,764 | −3,521 | +1,811 | +2,132 | −8,069 | −5,498 | P,C,M,S |
| 651 | `atr_move_60m_n14_trend_t1_long_fixed12h` | 332/327/84/83 | −4,810 | −6,892 | +2,535 | +1,541 | −8,115 | −3,832 | P,C,M,S |
| 652 | `efficiency_30m_n10_recovery_t0.25_long_indicator_or12h` | 834/775/206/194 | −4,873 | −4,315 | −264 | +77 | −8,177 | −5,327 | P,C,M,S |
| 653 | `efficiency_30m_n20_trend_t0.5_long_fixed12h` | 119/119/32/32 | −4,879 | −4,851 | +322 | +312 | −8,184 | −4,227 | P,C,M,S |
| 654 | `atr_move_60m_n14_trend_t0.5_short_indicator_or12h` | 1471/1471/377/377 | −30,826 | −28,846 | −9,865 | −9,559 | −8,543 | −4,203 | P,C,M,S |
| 655 | `efficiency_15m_n10_trend_t0.5_long_fixed12h` | 536/525/131/130 | −5,431 | −2,331 | +2,307 | +2,737 | −8,736 | −3,865 | P,C,M,S |
| 656 | `atr_move_60m_n14_recovery_t0.5_long_indicator_or12h` | 1462/1262/368/312 | −5,510 | −3,469 | −4,786 | −2,951 | −8,814 | −5,596 | P,C,M,S |
| 657 | `efficiency_15m_n10_trend_t0.75_long_fixed12h` | 233/233/58/58 | −5,949 | −4,740 | −1,124 | −888 | −9,254 | −5,506 | P,C,M,S |
| 658 | `efficiency_15m_n10_trend_t0.25_long_fixed12h` | 678/661/172/168 | −5,951 | −4,899 | +2,725 | +2,772 | −9,255 | −2,692 | P,C,M,S |
| 659 | `atr_move_240m_n14_trend_t0.5_long_indicator_or12h` | 386/378/93/91 | −6,341 | −5,089 | −11 | −588 | −9,645 | −5,041 | P,C,M,S |
| 660 | `atr_move_5m_n14_trend_t2_long_fixed12h` | 394/393/110/110 | −6,589 | −5,390 | −767 | −626 | −9,893 | −3,788 | P,C,M,S |
| 661 | `efficiency_60m_n10_trend_t0.25_long_fixed12h` | 403/392/104/99 | −6,848 | −7,778 | +1,910 | +1,489 | −10,153 | −3,978 | P,C,M,S |
| 662 | `efficiency_5m_n10_recovery_t0.75_long_indicator_or12h` | 879/879/221/221 | −6,892 | −6,990 | −900 | −1,080 | −10,197 | −6,339 | P,C,M,S |
| 663 | `atr_move_5m_n14_recovery_t2_long_indicator_or12h` | 661/652/171/170 | −7,036 | −8,932 | −1,149 | −1,453 | −10,341 | −5,960 | P,C,M,S |
| 664 | `efficiency_15m_n20_trend_t0.25_long_indicator_or12h` | 700/699/181/180 | −7,507 | −5,902 | +1,482 | +2,162 | −10,811 | −2,945 | P,C,M,S |
| 665 | `efficiency_5m_n10_trend_t0.75_long_fixed12h` | 481/480/123/123 | −7,647 | −6,458 | +1,232 | +1,462 | −10,952 | −4,137 | P,C,M,S |
| 666 | `efficiency_5m_n20_trend_t0.25_long_fixed12h` | 711/708/181/181 | −8,243 | −7,858 | +2,031 | +2,544 | −11,547 | −2,659 | P,C,M,S |
| 667 | `atr_move_60m_n14_trend_t1_long_indicator_or12h` | 491/491/134/134 | −8,263 | −7,121 | −815 | −571 | −11,567 | −5,364 | P,C,M,S |
| 668 | `efficiency_5m_n10_into_t0.25_short_indicator_or12h` | 4771/4771/1254/1254 | −34,347 | −38,674 | −7,481 | −8,686 | −12,065 | −3,548 | P,C,M,S,X |
| 669 | `efficiency_15m_n20_trend_t0.25_long_fixed12h` | 514/508/129/129 | −9,183 | −7,576 | +2,618 | +2,467 | −12,488 | −3,061 | P,C,M,S |
| 670 | `efficiency_5m_n40_trend_t0.25_long_fixed12h` | 512/509/129/129 | −9,389 | −6,912 | +1,439 | +1,647 | −12,694 | −2,984 | P,C,M,S |
| 671 | `atr_move_5m_n14_trend_t2_long_indicator_or12h` | 674/674/178/178 | −10,017 | −8,396 | −2,228 | −2,205 | −13,322 | −6,576 | P,C,M,S |
| 672 | `efficiency_30m_n10_trend_t0.25_long_fixed12h` | 558/543/140/136 | −10,450 | −11,494 | +884 | +734 | −13,755 | −2,997 | P,C,M,S |
| 673 | `efficiency_60m_n10_recovery_t0.25_long_fixed12h` | 397/374/97/91 | −10,689 | −12,692 | +350 | −903 | −13,993 | −3,524 | P,C,M,S |
| 674 | `efficiency_15m_n10_recovery_t0.25_long_indicator_or12h` | 1690/1560/438/401 | −10,733 | −11,414 | −4,030 | −3,953 | −14,037 | −6,985 | P,C,M,S |
| 675 | `efficiency_5m_n20_recovery_t0.25_long_indicator_or12h` | 2104/2076/535/527 | −11,862 | −13,082 | −2,840 | −2,875 | −15,167 | −7,013 | P,C,M,S |
| 676 | `efficiency_30m_n10_trend_t0.25_long_indicator_or12h` | 813/809/203/201 | −12,733 | −10,431 | +134 | +863 | −16,037 | −3,636 | P,C,M,S |
| 677 | `efficiency_5m_n10_into_t0.5_long_indicator_or12h` | 2651/2651/668/668 | −13,831 | −16,492 | −2,618 | −2,881 | −17,136 | −6,987 | P,C,M,S |
| 678 | `efficiency_5m_n20_trend_t0.5_long_indicator_or12h` | 658/658/169/169 | −14,035 | −13,296 | −5,443 | −5,636 | −17,340 | −6,577 | P,C,M,S |
| 679 | `atr_move_30m_n14_into_t0.5_long_indicator_or12h` | 2942/2942/751/751 | −14,736 | −21,384 | −1,892 | −3,118 | −18,040 | −7,886 | P,C,M,S |
| 680 | `efficiency_15m_n10_trend_t0.25_short_indicator_or12h` | 1587/1587/407/407 | −40,532 | −36,870 | −9,463 | −8,264 | −18,249 | −6,074 | P,C,M,S,X |
| 681 | `efficiency_5m_n10_trend_t0.75_long_indicator_or12h` | 908/908/223/223 | −15,194 | −13,417 | −4,661 | −4,372 | −18,499 | −6,043 | P,C,M,S |
| 682 | `efficiency_5m_n40_trend_t0.25_long_indicator_or12h` | 761/761/201/201 | −15,281 | −12,648 | −2,850 | −2,431 | −18,585 | −4,109 | P,C,M,S |
| 683 | `efficiency_15m_n10_trend_t0.5_long_indicator_or12h` | 867/867/211/211 | −16,011 | −12,412 | −926 | −738 | −19,316 | −5,310 | P,C,M,S |
| 684 | `efficiency_5m_n20_trend_t0.25_short_indicator_or12h` | 2077/2077/527/527 | −41,771 | −39,244 | −10,514 | −10,405 | −19,489 | −5,109 | P,C,M,S,X |
| 685 | `atr_move_15m_n14_recovery_t1_long_indicator_or12h` | 2045/1918/502/473 | −17,050 | −18,126 | −3,360 | −3,652 | −20,354 | −6,632 | P,C,M,S |
| 686 | `atr_move_15m_n14_into_t1_long_indicator_or12h` | 2039/2039/506/506 | −17,439 | −20,531 | −521 | −1,345 | −20,743 | −6,553 | P,C,M,S |
| 687 | `efficiency_5m_n10_trend_t0.5_short_indicator_or12h` | 2651/2651/668/668 | −44,508 | −41,844 | −12,083 | −11,820 | −22,225 | −5,196 | P,C,M,S,X |
| 688 | `atr_move_30m_n14_recovery_t0.5_long_indicator_or12h` | 2942/2500/747/639 | −19,154 | −14,153 | −5,888 | −3,941 | −22,459 | −7,262 | P,C,M,S |
| 689 | `efficiency_5m_n10_recovery_t0.5_long_indicator_or12h` | 2681/2650/674/669 | −19,251 | −18,930 | −4,357 | −4,427 | −22,555 | −6,669 | P,C,M,S |
| 690 | `atr_move_30m_n14_trend_t1_long_indicator_or12h` | 995/995/274/274 | −19,982 | −17,113 | −4,631 | −3,822 | −23,286 | −5,796 | P,C,M,S |
| 691 | `atr_move_30m_n14_trend_t0.5_short_indicator_or12h` | 2942/2942/751/751 | −50,008 | −43,353 | −14,637 | −13,410 | −27,725 | −5,904 | P,C,M,S,X |
| 692 | `efficiency_5m_n10_recovery_t0.25_short_indicator_or12h` | 5137/4683/1339/1233 | −52,858 | −49,307 | −13,892 | −12,459 | −30,575 | −5,397 | P,C,M,S,X |
| 693 | `atr_move_60m_n14_trend_t0.5_long_indicator_or12h` | 1468/1468/379/379 | −27,477 | −24,911 | −6,670 | −6,438 | −30,781 | −5,305 | P,C,M,S |
| 694 | `efficiency_15m_n10_trend_t0.25_long_indicator_or12h` | 1580/1580/401/401 | −28,295 | −24,383 | −3,842 | −3,156 | −31,599 | −5,224 | P,C,M,S |
| 695 | `atr_move_15m_n14_into_t0.5_short_indicator_or12h` | 6040/6039/1556/1555 | −53,950 | −57,958 | −11,964 | −13,650 | −31,667 | −6,634 | P,C,M,S,X |
| 696 | `atr_move_15m_n14_trend_t1_long_indicator_or12h` | 2050/2050/552/552 | −30,266 | −27,585 | −7,659 | −7,016 | −33,570 | −6,745 | P,C,M,S |
| 697 | `efficiency_5m_n10_into_t0.25_long_indicator_or12h` | 4647/4647/1205/1205 | −33,748 | −35,535 | −8,246 | −9,154 | −37,052 | −8,061 | P,C,M,S,X |
| 698 | `atr_move_15m_n14_recovery_t0.5_short_indicator_or12h` | 6008/5074/1521/1309 | −59,954 | −50,866 | −16,796 | −13,359 | −37,671 | −6,954 | P,C,M,S,X |
| 699 | `atr_move_5m_n14_recovery_t1_short_indicator_or12h` | 6664/6250/1697/1585 | −62,770 | −65,804 | −19,065 | −18,411 | −40,487 | −6,821 | P,C,M,S,X |
| 700 | `efficiency_5m_n10_recovery_t0.25_long_indicator_or12h` | 4972/4564/1287/1183 | −39,007 | −35,790 | −8,468 | −8,151 | −42,311 | −7,188 | P,C,M,S,X |
| 701 | `efficiency_5m_n20_trend_t0.25_long_indicator_or12h` | 2141/2141/555/555 | −39,239 | −36,832 | −10,379 | −9,682 | −42,543 | −6,543 | P,C,M,S,X |
| 702 | `atr_move_5m_n14_into_t1_short_indicator_or12h` | 6644/6644/1696/1696 | −67,418 | −71,638 | −20,670 | −21,116 | −45,136 | −7,117 | P,C,M,S,X |
| 703 | `efficiency_5m_n10_trend_t0.5_long_indicator_or12h` | 2659/2659/664/664 | −42,271 | −39,170 | −11,286 | −10,291 | −45,576 | −6,752 | P,C,M,S,X |
| 704 | `efficiency_5m_n10_trend_t0.25_short_indicator_or12h` | 4647/4647/1205/1205 | −68,505 | −66,717 | −18,269 | −17,361 | −46,223 | −7,670 | P,C,M,S,X |
| 705 | `atr_move_30m_n14_trend_t0.5_long_indicator_or12h` | 2972/2972/769/769 | −46,526 | −38,617 | −10,069 | −8,264 | −49,831 | −6,641 | P,C,M,S,X |
| 706 | `atr_move_15m_n14_into_t0.5_long_indicator_or12h` | 5982/5982/1526/1526 | −48,908 | −52,034 | −7,678 | −8,738 | −52,213 | −8,296 | P,C,M,S,X |
| 707 | `atr_move_15m_n14_recovery_t0.5_long_indicator_or12h` | 5986/5047/1515/1282 | −49,562 | −46,992 | −10,250 | −9,175 | −52,866 | −9,062 | P,C,M,S,X |
| 708 | `atr_move_15m_n14_trend_t0.5_short_indicator_or12h` | 5982/5982/1526/1526 | −82,714 | −79,585 | −25,904 | −24,843 | −60,432 | −8,768 | P,C,M,S,X |
| 709 | `atr_move_5m_n14_into_t1_long_indicator_or12h` | 6833/6833/1598/1598 | −57,933 | −66,272 | −14,522 | −16,024 | −61,238 | −9,192 | P,C,M,S,X |
| 710 | `atr_move_5m_n14_trend_t1_short_indicator_or12h` | 6833/6833/1598/1598 | −92,412 | −84,064 | −20,638 | −19,134 | −70,129 | −8,980 | P,C,M,S,X |
| 711 | `atr_move_5m_n14_recovery_t1_long_indicator_or12h` | 6862/6416/1619/1518 | −68,074 | −66,910 | −12,355 | −12,134 | −71,379 | −8,884 | P,C,M,S,X |
| 712 | `efficiency_5m_n10_trend_t0.25_long_indicator_or12h` | 4771/4771/1254/1254 | −70,595 | −66,273 | −20,100 | −18,897 | −73,899 | −9,274 | P,C,M,S,X |
| 713 | `atr_move_5m_n14_trend_t1_long_indicator_or12h` | 6644/6644/1696/1696 | −78,743 | −74,528 | −16,644 | −16,199 | −82,048 | −9,563 | P,C,M,S,X |
| 714 | `atr_move_15m_n14_trend_t0.5_long_indicator_or12h` | 6040/6039/1556/1555 | −78,916 | −74,913 | −22,262 | −20,579 | −82,221 | −11,014 | P,C,M,S,X |
| 715 | `atr_move_5m_n14_recovery_t0.5_short_indicator_or12h` | 18433/15580/4728/3989 | −182,057 | −159,147 | −47,312 | −40,506 | −159,774 | −13,972 | P,C,M,S,X |
| 716 | `atr_move_5m_n14_into_t0.5_short_indicator_or12h` | 18471/18471/4741/4741 | −189,689 | −193,454 | −51,400 | −51,074 | −167,406 | −16,272 | P,C,M,S,X |
| 717 | `atr_move_5m_n14_into_t0.5_long_indicator_or12h` | 18367/18367/4681/4681 | −168,248 | −175,488 | −42,505 | −44,777 | −171,553 | −16,696 | P,C,M,S,X |
| 718 | `atr_move_5m_n14_recovery_t0.5_long_indicator_or12h` | 18381/15450/4701/3951 | −183,610 | −159,740 | −41,867 | −36,520 | −186,914 | −16,678 | P,C,M,S,X |
| 719 | `atr_move_5m_n14_trend_t0.5_short_indicator_or12h` | 18367/18367/4681/4681 | −235,863 | −228,616 | −60,487 | −58,212 | −213,580 | −19,501 | P,C,M,S,X |
| 720 | `atr_move_5m_n14_trend_t0.5_long_indicator_or12h` | 18471/18471/4741/4741 | −216,658 | −212,897 | −52,901 | −53,227 | −219,963 | −20,861 | P,C,M,S,X |

