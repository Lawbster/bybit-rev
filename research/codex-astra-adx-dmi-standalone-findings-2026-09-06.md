# I08: ADX/DMI standalone findings

September 6, 2026. Research only; no live, config, ladder, short-state, commit,
push or deployment changes. This is a bounded individual-indicator study,
not an indicator/HL/S/R combination or a ladder improvement claim.

## TL;DR

- **540 new definitions; 37 descriptive survivors (35 long, 2 short), zero
  complete-screen qualifiers.** Five clocks, three tied DI/ADX periods, nine
  entries, both sides, two exits. All 2,168 cases independently verified.
  There are 359 adequately sampled definitions and 181 sparse/inconclusive
  ones; 15 definitions exhaust modeled equity in at least one case.
- **The useful finding is selective continuation, not a magic ADX filter.**
  Leading 4h N7 DI-cross long with ADX>=20 earns +$6,852 full / +$3,174 recent,
  versus its unfiltered DI control +$6,639 / +$3,127: only **+$213 / +$47**
  immediate-model improvement. Full adverse account DD falls 13.43%→10.08%.
  The long clock earns +$3,305 / +$5,038; recent clock upside is sacrificed.
- **Short and tail claims remain narrow.** 30m N14 ADX crossing above40 with
  negative DI direction, fixed12h, earns +$1,860 full / +$1,863 recent with
  62/15 closes, positive under +1m and extra costs. Its best five winners
  exceed full completed net. The best descriptive ADX-peak-fade long holds
  through October's crash, with a 51.54% adverse price excursion. Falling
  ADX is not demonstrated crash protection or a reliable reversal by itself.

All dollars are after trading fees, **before funding**. Recent is contained
within full; neither window is an untouched holdout. Do not add the windows,
correlated rules or delay cases.

## 1. Frozen contract and baselines

| Item | Exact scope |
|---|---|
| Full window | 2025-07-01 00:00 → 2026-09-04 19:01 UTC |
| Recent window | 2026-05-17 20:43 → 2026-09-04 19:01 UTC |
| Seed / tape | Fixed June 1, 2025 UTC seed; 663,541 continuous minute observations, including the same explicit 11-minute repair overlay as I01–I07 |
| Account / order | $32,000 initial equity; $10,000 fixed entry notional; one independent position per rule |
| Decisions / execution | Fully closed selected-timeframe bars; next minute open under modeled zero publication lag; separate +1m delay to BOTH entry and exit |
| Primary / alternative exit | 12h from actual entry; or the first subsequent DI condition, capped at 12h |
| Fees | 0.055% each side on actual executed notional; winning/losing dollars below already include these |
| Funding | Not included: complete settlement evidence unavailable |
| Cost sensitivity | Additional 5bps each side on unchanged traded/marked turnover; not an execution-path/slippage simulation |
| End inventory | Last-close mark less hypothetical exit fee; not a completed trade |
| Drawdown | Prior close-equity peak to each minute's adverse price, on the $32k account; no inferred intraminute ordering |
| Main baseline | Same-side rolling12h clock; approximately continuous exposure, not exposure-matched |
| Mechanism controls | DI-strength gates retain their unfiltered same-clock/period/side/exit control; indicator exits retain their own fixed12h entry control |

No compounding, averaging, price TP/SL grid, actual funding, liquidation,
portfolio collateral or live queue/fill certification. A repaired final candle
does not establish its historical collector receipt time. These are **not
incremental dollars on top of the Martingale ladder or live $25k short**.

| Control | Full 0m net / closes | Full +1m net / closes | Recent 0m net / closes | Recent +1m net / closes |
| --- | ---: | ---: | ---: | ---: |
| Clock long | +$3,305 / 861 | +$3,792 / 859 | +$5,038 / 219 | +$5,104 / 218 |
| Clock short | −$22,283 / 861 | −$22,726 / 859 | −$9,887 / 219 | −$9,930 / 218 |
| Cash / no trade | $0 / 0 | $0 / 0 | $0 / 0 | $0 / 0 |

Fixed-initial-quantity long buy-and-hold context is +$11,511 full / +$8,383
recent before funding. It has changing marked notional and is not a matched
exposure baseline. Baseline improvement over a badly losing short clock is
not the same thing as positive short profit.

## 2. What ADX/DMI means, and precisely what we tested

+DI and -DI provide direction; ADX measures directional-movement strength.
Common 20/25 reference levels are conventions, not a demonstrated HYPE edge.
[Fidelity's DMI guide](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/DMI),
[TradingView's ADX description](https://www.tradingview.com/support/solutions/43000589099-average-directional-index-adx/).

The study uses **5m / 15m / 30m / 1h / 4h**, tied DI/ADX lengths **7 / 14 / 28**.
At each of the 15 clock/length pairs:

| Entry mode | Levels | Exact long / short condition |
|---|---|---|
| `di_cross` | 0 | Fresh +DI-minus-DI crossing from<=0 to>0 for long; >=0 to<0 for short |
| `di_strong` | 20 / 25 / 40 | The same fresh DI cross AND current ADX>=level; no catch-up when a rejected crossing later strengthens |
| `adx_cross` | 20 / 25 / 40 | Previous ADX<=level, current ADX>level, with positive DI spread for long / negative for short |
| `adx_peak_fade` | 40 / 50 | Three closed ADX observations: older<=previous, current<previous, previous>=level; DI direction opposite the entry side |

ADX need not be valid yet for the unfiltered DI cross. Other modes require
their complete valid inputs. A threshold touch is not an ADX cross above it.

Each entry gets long/short × fixed12h/indicator-or12h:
**5 × 3 × (1+3+3+2) × 2 × 2 = 540 definitions**.
There are 270 longs and 270 shorts. Two overlapping windows × two action
delays give 2,160 strategy cases, plus eight repeated clocks = 2,168.
No prior standalone DMI entry is being relabeled new; period14 numeric
overlap is revalidation of a feature already present in I01.

The optional DI exit is the earliest subsequent closed observation:
continuation long exits spread<=0, short>=0; peak-fade long exits spread>=0,
short<=0. It is not a guaranteed profitable exit. Timeout wins ties, no
same-entry-observation exit, pending decisions cannot be revised, and occupied
crossings are skipped rather than queued. A new crossing is needed after exit.
All comparisons re-run the full position-occupancy path, not a trade filter
applied retrospectively to the unfiltered ledger.

### Formula identity

`adx-dmi-wilder-sma-seed-v1`: TR begins with bar1 against previous close;
up=high-prevHigh, down=prevLow-low. Only the strictly greater positive move
contributes its DM; a tie contributes zero to both. Seed the first N changes
by their arithmetic mean; recurse (previous×(N−1)+current)/N. DI is100×DM/TR;
zero TR gives zero DI. DX is100×abs(DI spread)/(DI sum), zero sum gives zero.
ADX seeds N valid DX observations and uses the same recurrence. DI first
valid index N; ADX first valid index 2N−1. Null warmup, valid zero, unrounded,
no gap bridging, sliding reseed or forming candle.

Independent fixtures match the installed library for all 15 clock/period
combinations. Period14 exactly matches the accepted shared module's arrays
on all five clocks. Added parameterized fields are related measurements,
not six new independent indicators.

**Important interpretation:** high ADX at a fresh DI flip can retain memory
of the preceding opposite trend. It does not certify a strong new trend.
Likewise, falling ADX can accompany continuing price movement. The peak-fade
mode tests that hypothesis; it does not assume that a future top is known.

## 3. Ranking, sample limits and labels

The inherited strict screen requires >=30 full and >=10 recent closes in
both delays; positive absolute net and same-side clock delta in all four
cases; every monthly marked delta >=−1e−8; positive extra-cost net; solvency.
**0/540 pass.** No qualifier is being promoted by relaxing this screen.

A separately frozen *descriptive* subset requires sample/absolute net/extra
costs/solvency in all four cases, but retains failed clock/monthly comparisons.
It contains 37 definitions, ranked by full immediate absolute net. Its first
five are L1–L5. Raw ranking instead sorts all540 by full immediate delta
against own-side clock; its first five are R1–R5. This naturally favors
avoiding the highly negative short clock, so raw rank is not approval.

| Mode | Side | Definitions | Adequate sample | Positive net all4 | Negative net all4 | Descriptive survivors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| di_cross | long | 30 | 30 | 8 | 8 | 3 |
| di_cross | short | 30 | 30 | 2 | 24 | 1 |
| di_strong | long | 90 | 56 | 22 | 35 | 10 |
| di_strong | short | 90 | 53 | 5 | 60 | 0 |
| adx_cross | long | 90 | 66 | 42 | 13 | 20 |
| adx_cross | short | 90 | 64 | 6 | 59 | 1 |
| adx_peak_fade | long | 60 | 30 | 10 | 20 | 2 |
| adx_peak_fade | short | 60 | 30 | 0 | 51 | 0 |

181 sparse definitions (88 long / 93 short) are inconclusive, not proof that
their indicators cannot work. Fifteen definitions exhaust modeled equity in
at least one case; continued fixed-notional diagnostics are not an executable
post-failure account projection. Counts/windows are correlated.

| Label | Exact definition ID | Meaning |
| --- | ---: | ---: |
| L1 | `adx_240m_n7_di_strong_t20_long_fixed12h` | 4h N7 fresh bullish DI cross, ADX>=20, fixed12h |
| L2 | `adx_15m_n28_adx_cross_t25_long_fixed12h` | 15m N28 ADX crosses above25, bullish DI, fixed12h |
| L3 | `adx_240m_n7_di_cross_t0_long_fixed12h` | 4h N7 fresh bullish DI cross, unfiltered, fixed12h (L1 control) |
| L4 | `adx_240m_n7_di_cross_t0_long_indicator_or12h` | Same unfiltered L3 entry, DI reversal-or12h |
| L5 | `adx_60m_n14_adx_cross_t25_long_fixed12h` | 1h N14 ADX crosses above25, bullish DI, fixed12h |
| R1 | `adx_15m_n14_di_strong_t25_short_fixed12h` | 15m N14 fresh bearish DI cross, ADX>=25, fixed12h |
| R2 | `adx_240m_n14_adx_cross_t25_short_fixed12h` | 4h N14 ADX crosses above25, bearish DI, fixed12h (sparse) |
| R3 | `adx_240m_n14_adx_cross_t25_short_indicator_or12h` | Same R2 entry, DI reversal-or12h (sparse, same saved outcomes) |
| R4 | `adx_30m_n14_adx_cross_t20_short_fixed12h` | 30m N14 ADX crosses above20, bearish DI, fixed12h |
| R5 | `adx_30m_n14_adx_cross_t40_short_fixed12h` | 30m N14 ADX crosses above40, bearish DI, fixed12h (stronger short candidate) |
| S2 | `adx_240m_n28_di_cross_t0_short_fixed12h` | 4h N28 fresh bearish DI cross, unfiltered, fixed12h (other descriptive short) |
| F1 | `adx_15m_n7_adx_peak_fade_t50_long_fixed12h` | 15m N7 known ADX peak>=50, buy while DI remains bearish, fixed12h (fade contrast) |

S2 and F1 are read-only mechanism contrasts from the same frozen540, not
additional trials. R2/R3 are not two independent discoveries.

## 4. Wins, losses and dollars beside the baseline

Immediate model, $10k fixed entry, after trading fees / before funding.
W/L counts completed wins/losses; all displayed cases have zero breakevens.
Winning and losing dollars already include fees. Net=winning+losing+open mark;
rounding can produce a dollar difference. Clock open marks are not closed wins.

### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Clock long | 861 | 420/441 | +$110,950 | −$107,401 | −$245 | +$3,305 | 33.09% |
| L1 | 115 | 61/54 | +$19,583 | −$12,731 | $0 | +$6,852 | 10.08% |
| L2 | 77 | 42/35 | +$12,630 | −$5,942 | $0 | +$6,687 | 6.21% |
| L3 | 156 | 82/74 | +$25,864 | −$19,225 | $0 | +$6,639 | 13.43% |
| L4 | 161 | 76/85 | +$24,031 | −$18,279 | $0 | +$5,752 | 17.01% |
| L5 | 85 | 44/41 | +$13,417 | −$7,925 | $0 | +$5,491 | 8.79% |
| Clock short | 861 | 414/447 | +$98,162 | −$120,668 | +$223 | −$22,283 | 71.27% |
| R1 | 225 | 114/111 | +$30,180 | −$24,984 | $0 | +$5,196 | 11.69% |
| R2 | 20 | 13/7 | +$4,255 | −$1,556 | $0 | +$2,699 | 12.38% |
| R3 | 20 | 13/7 | +$4,255 | −$1,556 | $0 | +$2,699 | 12.38% |
| R4 | 159 | 81/78 | +$20,212 | −$18,121 | $0 | +$2,090 | 13.52% |
| R5 | 62 | 31/31 | +$7,962 | −$6,103 | $0 | +$1,860 | 7.15% |
| S2 | 75 | 37/38 | +$8,610 | −$7,752 | $0 | +$858 | 5.97% |
| F1 | 262 | 130/132 | +$34,854 | −$30,216 | +$80 | +$4,719 | 17.18% |

### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open mark | Net | Adverse DD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Clock long | 219 | 114/105 | +$29,120 | −$23,837 | −$245 | +$5,038 | 12.94% |
| L1 | 31 | 17/14 | +$5,715 | −$2,541 | $0 | +$3,174 | 2.83% |
| L2 | 22 | 14/8 | +$3,826 | −$935 | $0 | +$2,891 | 4.08% |
| L3 | 36 | 19/17 | +$6,276 | −$3,149 | $0 | +$3,127 | 4.09% |
| L4 | 36 | 18/18 | +$6,243 | −$2,849 | $0 | +$3,394 | 3.65% |
| L5 | 20 | 10/10 | +$3,392 | −$1,005 | $0 | +$2,388 | 3.06% |
| Clock short | 219 | 97/122 | +$21,666 | −$31,775 | +$223 | −$9,887 | 32.54% |
| R1 | 60 | 27/33 | +$6,326 | −$6,751 | $0 | −$425 | 6.99% |
| R2 | 5 | 4/1 | +$847 | −$180 | $0 | +$667 | 1.90% |
| R3 | 5 | 4/1 | +$847 | −$180 | $0 | +$667 | 1.90% |
| R4 | 37 | 16/21 | +$3,706 | −$4,151 | $0 | −$445 | 7.35% |
| R5 | 15 | 10/5 | +$2,501 | −$638 | $0 | +$1,863 | 2.28% |
| S2 | 15 | 8/7 | +$2,446 | −$1,515 | $0 | +$931 | 2.94% |
| F1 | 62 | 39/23 | +$8,683 | −$6,257 | +$80 | +$2,506 | 6.54% |


### Action delay and cost sensitivity, not four independent samples

Cells show **net / net after extra5bps per side**, both before funding.
The delay applies to entry AND exit; trade membership can change around
occupancy, so differences need not be merely a price deterioration.

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m |
| --- | ---: | ---: | ---: | ---: |
| Clock long | +$3,305 / −$5,322 | +$3,792 / −$4,815 | +$5,038 / +$2,835 | +$5,104 / +$2,910 |
| L1 | +$6,852 / +$5,698 | +$6,363 / +$5,239 | +$3,174 / +$2,863 | +$2,836 / +$2,534 |
| L2 | +$6,687 / +$5,914 | +$6,380 / +$5,607 | +$2,891 / +$2,669 | +$2,801 / +$2,580 |
| L3 | +$6,639 / +$5,075 | +$4,491 / +$3,018 | +$3,127 / +$2,765 | +$2,827 / +$2,486 |
| L4 | +$5,752 / +$4,138 | +$5,606 / +$3,992 | +$3,394 / +$3,032 | +$3,500 / +$3,138 |
| L5 | +$5,491 / +$4,638 | +$5,495 / +$4,642 | +$2,388 / +$2,186 | +$2,409 / +$2,207 |
| Clock short | −$22,283 / −$30,909 | −$22,726 / −$31,333 | −$9,887 / −$12,090 | −$9,930 / −$12,124 |
| R1 | +$5,196 / +$2,950 | +$6,341 / +$4,095 | −$425 / −$1,025 | −$429 / −$1,028 |
| R2 | +$2,699 / +$2,500 | +$2,559 / +$2,361 | +$667 / +$617 | +$619 / +$569 |
| R3 | +$2,699 / +$2,500 | +$2,559 / +$2,361 | +$667 / +$617 | +$619 / +$569 |
| R4 | +$2,090 / +$502 | +$1,672 / +$93 | −$445 / −$815 | −$304 / −$674 |
| R5 | +$1,860 / +$1,241 | +$1,617 / +$1,008 | +$1,863 / +$1,714 | +$1,691 / +$1,542 |
| S2 | +$858 / +$109 | +$734 / +$14 | +$931 / +$781 | +$853 / +$704 |
| F1 | +$4,719 / +$2,085 | +$4,814 / +$2,190 | +$2,506 / +$1,875 | +$2,461 / +$1,829 |

## 5. Does ADX itself add value? Keep the unfiltered control visible

L1 is the full-net leader of the adequately sampled, positive/cost-tolerant
subset. But much of its value is already in L3's selective DI entry.
The proper strength-filter comparison is L1 versus L3, not only the clock.

| Case | Plain DI closes | ADX>=20 closes | Plain DI net | Filtered net | Own delta | Plain / filtered DD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| full / 0m | 156 | 115 | +$6,638.73 | +$6,851.58 | +$212.85 | 13.43% / 10.08% |
| full /  +1m | 147 | 112 | +$4,491.17 | +$6,362.58 | +$1,871.41 | 14.54% / 10.68% |
| recent / 0m | 36 | 31 | +$3,127.13 | +$3,174.31 | +$47.18 | 4.09% / 2.83% |
| recent /  +1m | 34 | 30 | +$2,827.22 | +$2,836.08 | +$8.85 | 5.03% / 3.92% |

| Immediate case | Losing-trade dollars avoided | Winning-trade dollars sacrificed | Net improvement |
| --- | ---: | ---: | ---: |
| full | +$6,493.70 | +$6,280.85 | +$212.85 |
| recent | +$607.79 | +$560.61 | +$47.18 |

These are whole-ledger differences, not an assertion that exactly the removed
trades alone caused them; occupancy can change later entries. Full +1m is
more favorable to the ADX filter, but recent +1m adds only $8.85. This is useful
risk-conditioning evidence, not a large, consistent profit multiplier.

Across all180 `di_strong` definitions,88 improve on their own unfiltered
DI control in all four cases and26 worsen it in all four. Only eight of the88
also have positive absolute net throughout, and only five additionally meet
the descriptive sample/cost requirement. **“Improves DI” often means
“less unprofitable churn,” not a profitable rule.**

ADX cross-through thresholds is a distinct entry mechanism, not confirmation
of the DI filter. For example L2 enters when ADX itself crosses25 with bullish
DI; its modest recent exposure and smaller DD do not prove a ladder veto.

### Changing exits is also not a free improvement

| Entry | Full0 fixed / DI-exit / delta | Full+1 fixed / DI-exit / delta | Recent0 fixed / DI-exit / delta | Recent+1 fixed / DI-exit / delta |
| --- | ---: | ---: | ---: | ---: |
| L1 | +$6,852 / +$5,473 / −$1,379 | +$6,363 / +$5,391 / −$972 | +$3,174 / +$3,144 / −$30 | +$2,836 / +$3,198 / +$362 |
| L2 | +$6,687 / +$5,310 / −$1,378 | +$6,380 / +$5,274 / −$1,106 | +$2,891 / +$2,365 / −$526 | +$2,801 / +$2,282 / −$519 |
| L3 → L4 | +$6,639 / +$5,752 / −$887 | +$4,491 / +$5,606 / +$1,115 | +$3,127 / +$3,394 / +$267 | +$2,827 / +$3,500 / +$672 |
| L5 | +$5,491 / +$4,469 / −$1,022 | +$5,495 / +$4,892 / −$603 | +$2,388 / +$1,418 / −$970 | +$2,409 / +$1,703 / −$706 |

L3→L4 sacrifices $887 full immediate profit while adding $267 recently.
No general “exit whenever DI changes” upgrade follows. These companions are
already in the frozen540; this comparison adds no exit or threshold.

## 6. Shorts: two retained ingredients, no restart recommendation

R5 has 62 full /15 recent closes and stays positive with action delay and
extra costs. Its full +1m net is $1,617, stressed $1,008; recent +1m net
$1,691, stressed $1,542. That is more resilient on these assumptions than a
barely positive full-history number, but it is still a small, mined sample.

S2 also survives the descriptive screen, yet full +1m extra-cost profit is
only **$14.44**, versus $733.68 before the extra cost. It has 75 full/15
recent immediate closes. Do not present these two short candidates as equally
strong. Both retain monthly underperformance and concentration.

R1 tops raw clock-delta ranking and earns $5,196 full immediate, but
**loses $425 recently** (and $429 with +1m). It improves its own unfiltered
short substantially while still losing recent money:

| Case | Unfiltered DI short net | R1 ADX>=25 net | Own-control delta | R1 extra-cost net |
| --- | ---: | ---: | ---: | ---: |
| full / 0m | −$10,628 | +$5,196 | +$15,824 | +$2,950 |
| full / +1m | −$10,773 | +$6,341 | +$17,114 | +$4,095 |
| recent / 0m | −$6,328 | −$425 | +$5,903 | −$1,025 |
| recent / +1m | −$6,518 | −$429 | +$6,089 | −$1,028 |

R2/R3 have only20 full/5 recent closes. They are sparse, not proven profitable
alternatives. R4 earns $2,090 full but loses $445 recently.

Of60 frozen peak-fade SHORT definitions, zero are positive in all four cases,
and51 lose in all four. Thirty are adequately sampled. This fails the claim
that these specific high-ADX downturn fades are consistently profitable;
it does not reject all ADX shorts, lower-strength fades, untested periods or
combinations. No adequately sampled strength-gated DI short survives the
full sample/net/cost subset either.

The live HL short remains unchanged/paused as configured. These fixed-$10k
standalone tests do not justify arming it or scaling these results to $25k.

## 7. Monthly marked performance and opportunity cost

Each cell is **variant monthly PnL (delta versus the same-side clock)**.
Monthly equity marks include open inventory movement and fees when incurred.
They are not just losses of trades closed that month. Each table totals to
its own marked-period net; rounded entries may not sum exactly.

September2026 is partial; recent May2026 starts May17 20:43, so it is not
the same May as the full window. Baselines are repeated for each action model.
The recent window restarts flat; its trading path need not equal a truncated
full-history ledger.

### Top-five descriptive longs

#### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC — 0m

| Month | Clock long | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | −$161 | −$695 (−$533) | +$969 (+$1,130) | −$695 (−$533) | −$586 (−$425) | +$471 (+$632) |
| 2025-08 | +$510 | +$139 (−$371) | +$655 (+$145) | −$98 (−$608) | −$401 (−$912) | +$494 (−$16) |
| 2025-09 | −$109 | +$224 (+$333) | +$67 (+$177) | +$456 (+$565) | +$238 (+$348) | +$644 (+$753) |
| 2025-10 | −$470 | −$1,322 (−$852) | +$156 (+$626) | −$1,726 (−$1,255) | −$1,776 (−$1,306) | +$1,212 (+$1,682) |
| 2025-11 | −$3,287 | −$289 (+$2,997) | −$602 (+$2,685) | −$462 (+$2,825) | −$1,282 (+$2,005) | −$1,173 (+$2,114) |
| 2025-12 | −$2,574 | +$76 (+$2,650) | −$214 (+$2,360) | +$69 (+$2,642) | +$45 (+$2,619) | −$247 (+$2,327) |
| 2026-01 | +$1,782 | +$1,621 (−$161) | +$1,261 (−$521) | +$1,164 (−$618) | +$1,402 (−$380) | +$501 (−$1,281) |
| 2026-02 | −$122 | +$967 (+$1,089) | −$440 (−$318) | +$2,881 (+$3,003) | +$2,413 (+$2,535) | −$1,581 (−$1,460) |
| 2026-03 | +$1,155 | +$454 (−$701) | −$896 (−$2,050) | −$180 (−$1,335) | +$45 (−$1,110) | +$1,362 (+$207) |
| 2026-04 | +$307 | +$481 (+$173) | +$532 (+$225) | +$460 (+$152) | +$453 (+$145) | +$850 (+$543) |
| 2026-05 | +$5,789 | +$1,920 (−$3,870) | +$3,798 (−$1,992) | +$1,542 (−$4,248) | +$1,706 (−$4,084) | +$1,198 (−$4,591) |
| 2026-06 | −$1,256 | +$762 (+$2,018) | −$34 (+$1,222) | +$1,311 (+$2,567) | +$1,397 (+$2,653) | +$75 (+$1,331) |
| 2026-07 | −$2,621 | +$251 (+$2,872) | −$82 (+$2,539) | −$314 (+$2,307) | −$182 (+$2,439) | +$215 (+$2,836) |
| 2026-08 | +$4,306 | +$2,035 (−$2,271) | +$1,541 (−$2,765) | +$2,004 (−$2,302) | +$2,052 (−$2,253) | +$1,380 (−$2,926) |
| 2026-09 | +$55 | +$228 (+$173) | −$24 (−$79) | +$228 (+$173) | +$228 (+$173) | +$90 (+$35) |

#### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC — +1m

| Month | Clock long | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | −$94 | −$701 (−$607) | +$988 (+$1,081) | −$701 (−$607) | −$606 (−$512) | +$518 (+$612) |
| 2025-08 | +$754 | −$37 (−$791) | +$656 (−$98) | −$271 (−$1,025) | −$495 (−$1,249) | +$600 (−$155) |
| 2025-09 | −$265 | +$93 (+$358) | −$96 (+$169) | +$335 (+$600) | +$210 (+$475) | +$696 (+$960) |
| 2025-10 | −$484 | −$1,328 (−$843) | +$12 (+$497) | −$2,392 (−$1,908) | −$1,744 (−$1,260) | +$1,138 (+$1,622) |
| 2025-11 | −$3,354 | −$222 (+$3,132) | −$583 (+$2,771) | −$438 (+$2,916) | −$1,279 (+$2,075) | −$1,201 (+$2,153) |
| 2025-12 | −$2,606 | +$85 (+$2,691) | −$148 (+$2,458) | +$653 (+$3,260) | +$4 (+$2,611) | −$158 (+$2,449) |
| 2026-01 | +$2,011 | +$1,716 (−$295) | +$1,246 (−$765) | +$1,213 (−$798) | +$1,469 (−$542) | +$439 (−$1,572) |
| 2026-02 | +$102 | +$894 (+$792) | −$562 (−$664) | +$1,204 (+$1,101) | +$2,242 (+$2,140) | −$1,662 (−$1,764) |
| 2026-03 | +$1,222 | +$489 (−$734) | −$889 (−$2,111) | −$82 (−$1,304) | +$57 (−$1,166) | +$1,383 (+$161) |
| 2026-04 | +$243 | +$463 (+$220) | +$583 (+$340) | +$446 (+$203) | +$398 (+$155) | +$789 (+$546) |
| 2026-05 | +$5,761 | +$1,999 (−$3,762) | +$3,830 (−$1,932) | +$1,622 (−$4,139) | +$1,777 (−$3,985) | +$1,173 (−$4,589) |
| 2026-06 | −$1,159 | +$723 (+$1,882) | −$43 (+$1,116) | +$1,280 (+$2,439) | +$1,395 (+$2,554) | +$89 (+$1,248) |
| 2026-07 | −$2,614 | +$299 (+$2,914) | −$73 (+$2,541) | −$259 (+$2,355) | −$78 (+$2,536) | +$200 (+$2,814) |
| 2026-08 | +$4,311 | +$1,659 (−$2,652) | +$1,510 (−$2,801) | +$1,652 (−$2,659) | +$2,029 (−$2,282) | +$1,413 (−$2,897) |
| 2026-09 | −$37 | +$229 (+$266) | −$51 (−$14) | +$229 (+$266) | +$229 (+$266) | +$80 (+$116) |

#### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC — 0m

| Month | Clock long | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | +$4,554 | −$102 (−$4,656) | +$1,490 (−$3,064) | −$102 (−$4,656) | −$102 (−$4,656) | +$627 (−$3,927) |
| 2026-06 | −$1,256 | +$762 (+$2,018) | −$34 (+$1,222) | +$1,311 (+$2,567) | +$1,397 (+$2,653) | +$75 (+$1,331) |
| 2026-07 | −$2,621 | +$251 (+$2,872) | −$82 (+$2,539) | −$314 (+$2,307) | −$182 (+$2,439) | +$215 (+$2,836) |
| 2026-08 | +$4,306 | +$2,035 (−$2,271) | +$1,541 (−$2,765) | +$2,004 (−$2,302) | +$2,052 (−$2,253) | +$1,380 (−$2,926) |
| 2026-09 | +$55 | +$228 (+$173) | −$24 (−$79) | +$228 (+$173) | +$228 (+$173) | +$90 (+$35) |

#### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC — +1m

| Month | Clock long | L1 | L2 | L3 | L4 | L5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | +$4,477 | −$75 (−$4,552) | +$1,458 (−$3,019) | −$75 (−$4,552) | −$75 (−$4,552) | +$627 (−$3,850) |
| 2026-06 | −$1,129 | +$723 (+$1,852) | −$43 (+$1,086) | +$1,280 (+$2,409) | +$1,395 (+$2,524) | +$89 (+$1,217) |
| 2026-07 | −$2,692 | +$299 (+$2,991) | −$73 (+$2,619) | −$259 (+$2,433) | −$78 (+$2,614) | +$200 (+$2,892) |
| 2026-08 | +$4,384 | +$1,659 (−$2,724) | +$1,510 (−$2,874) | +$1,652 (−$2,732) | +$2,029 (−$2,355) | +$1,413 (−$2,970) |
| 2026-09 | +$64 | +$229 (+$166) | −$51 (−$114) | +$229 (+$166) | +$229 (+$166) | +$80 (+$16) |


The invisible cost is real: L1 earns $1,920 in full May2026 versus clock
$5,789, and $2,035 in August versus $4,306. It avoids much of July's clock
loss but gives up substantial rally profit. L2 still loses $896 in March2026
while its clock earns $1,155. Avoiding one crash exposure does not imply
no losing months; L1 loses $1,322 in October2025.

### Raw top-five shorts

These rankings are retained even where sparse or recently negative; no
replacement of failed R1/R4 by a prettier sample.

#### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC — 0m

| Month | Clock short | R1 | R2 | R3 | R4 | R5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | −$1,203 | +$487 (+$1,690) | +$413 (+$1,616) | +$413 (+$1,616) | +$508 (+$1,711) | −$543 (+$661) |
| 2025-08 | −$1,876 | +$536 (+$2,411) | −$78 (+$1,798) | −$78 (+$1,798) | +$161 (+$2,037) | +$842 (+$2,718) |
| 2025-09 | −$1,211 | −$200 (+$1,012) | +$422 (+$1,633) | +$422 (+$1,633) | −$830 (+$382) | −$252 (+$959) |
| 2025-10 | −$894 | +$1,600 (+$2,494) | +$856 (+$1,750) | +$856 (+$1,750) | +$2,275 (+$3,168) | −$1,039 (−$145) |
| 2025-11 | +$1,970 | +$504 (−$1,466) | +$93 (−$1,876) | +$93 (−$1,876) | +$657 (−$1,313) | +$64 (−$1,905) |
| 2025-12 | +$1,212 | +$38 (−$1,174) | −$479 (−$1,691) | −$479 (−$1,691) | −$34 (−$1,246) | −$187 (−$1,399) |
| 2026-01 | −$3,149 | +$2,735 (+$5,884) | +$275 (+$3,424) | +$275 (+$3,424) | −$286 (+$2,863) | +$519 (+$3,668) |
| 2026-02 | −$1,111 | +$1,575 (+$2,686) | −$46 (+$1,065) | −$46 (+$1,065) | −$1,368 (−$257) | +$616 (+$1,726) |
| 2026-03 | −$2,521 | −$1,039 (+$1,482) | +$344 (+$2,865) | +$344 (+$2,865) | −$238 (+$2,283) | −$97 (+$2,424) |
| 2026-04 | −$1,628 | +$204 (+$1,832) | −$7 (+$1,621) | −$7 (+$1,621) | +$535 (+$2,163) | +$427 (+$2,055) |
| 2026-05 | −$7,161 | −$2,068 (+$5,092) | +$238 (+$7,399) | +$238 (+$7,399) | +$1,482 (+$8,642) | −$354 (+$6,806) |
| 2026-06 | −$64 | +$947 (+$1,011) | +$615 (+$679) | +$615 (+$679) | +$252 (+$315) | +$1,225 (+$1,288) |
| 2026-07 | +$1,259 | +$832 (−$427) | +$52 (−$1,208) | +$52 (−$1,208) | −$253 (−$1,512) | +$879 (−$380) |
| 2026-08 | −$5,675 | −$1,084 (+$4,592) | $0 (+$5,675) | $0 (+$5,675) | −$610 (+$5,065) | −$241 (+$5,435) |
| 2026-09 | −$231 | +$129 (+$361) | $0 (+$231) | $0 (+$231) | −$161 (+$71) | $0 (+$231) |

#### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC — +1m

| Month | Clock short | R1 | R2 | R3 | R4 | R5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | −$1,271 | +$499 (+$1,769) | +$393 (+$1,664) | +$393 (+$1,664) | +$559 (+$1,830) | −$536 (+$735) |
| 2025-08 | −$2,120 | +$811 (+$2,931) | −$59 (+$2,061) | −$59 (+$2,061) | +$64 (+$2,184) | +$851 (+$2,971) |
| 2025-09 | −$1,056 | −$5 (+$1,050) | +$450 (+$1,505) | +$450 (+$1,505) | −$791 (+$264) | −$290 (+$765) |
| 2025-10 | −$880 | +$1,527 (+$2,407) | +$877 (+$1,757) | +$877 (+$1,757) | +$2,012 (+$2,892) | −$942 (−$62) |
| 2025-11 | +$2,037 | +$735 (−$1,302) | +$17 (−$2,020) | +$17 (−$2,020) | +$432 (−$1,605) | +$151 (−$1,886) |
| 2025-12 | +$1,267 | +$209 (−$1,057) | −$468 (−$1,734) | −$468 (−$1,734) | +$70 (−$1,197) | −$137 (−$1,404) |
| 2026-01 | −$3,378 | +$2,858 (+$6,236) | +$232 (+$3,610) | +$232 (+$3,610) | −$473 (+$2,905) | +$380 (+$3,757) |
| 2026-02 | −$1,335 | +$1,611 (+$2,946) | −$40 (+$1,295) | −$40 (+$1,295) | −$1,417 (−$81) | +$680 (+$2,015) |
| 2026-03 | −$2,588 | −$838 (+$1,751) | +$309 (+$2,897) | +$309 (+$2,897) | −$245 (+$2,343) | −$106 (+$2,482) |
| 2026-04 | −$1,564 | +$184 (+$1,748) | +$9 (+$1,573) | +$9 (+$1,573) | +$559 (+$2,123) | +$247 (+$1,811) |
| 2026-05 | −$7,132 | −$1,980 (+$5,152) | +$220 (+$7,353) | +$220 (+$7,353) | +$1,526 (+$8,658) | −$370 (+$6,762) |
| 2026-06 | −$139 | +$857 (+$996) | +$576 (+$715) | +$576 (+$715) | +$328 (+$466) | +$1,064 (+$1,202) |
| 2026-07 | +$1,252 | +$801 (−$452) | +$42 (−$1,210) | +$42 (−$1,210) | −$238 (−$1,490) | +$874 (−$378) |
| 2026-08 | −$5,680 | −$1,078 (+$4,602) | $0 (+$5,680) | $0 (+$5,680) | −$547 (+$5,133) | −$247 (+$5,433) |
| 2026-09 | −$139 | +$151 (+$290) | $0 (+$139) | $0 (+$139) | −$167 (−$27) | $0 (+$139) |

#### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC — 0m

| Month | Clock short | R1 | R2 | R3 | R4 | R5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | −$5,175 | −$1,250 (+$3,925) | $0 (+$5,175) | $0 (+$5,175) | +$327 (+$5,503) | $0 (+$5,175) |
| 2026-06 | −$64 | +$947 (+$1,011) | +$615 (+$679) | +$615 (+$679) | +$252 (+$315) | +$1,225 (+$1,288) |
| 2026-07 | +$1,259 | +$832 (−$427) | +$52 (−$1,208) | +$52 (−$1,208) | −$253 (−$1,512) | +$879 (−$380) |
| 2026-08 | −$5,675 | −$1,084 (+$4,592) | $0 (+$5,675) | $0 (+$5,675) | −$610 (+$5,065) | −$241 (+$5,435) |
| 2026-09 | −$231 | +$129 (+$361) | $0 (+$231) | $0 (+$231) | −$161 (+$71) | $0 (+$231) |

#### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC — +1m

| Month | Clock short | R1 | R2 | R3 | R4 | R5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | −$5,099 | −$1,158 (+$3,940) | $0 (+$5,099) | $0 (+$5,099) | +$321 (+$5,419) | $0 (+$5,099) |
| 2026-06 | −$191 | +$857 (+$1,048) | +$576 (+$767) | +$576 (+$767) | +$328 (+$518) | +$1,064 (+$1,255) |
| 2026-07 | +$1,330 | +$801 (−$530) | +$42 (−$1,288) | +$42 (−$1,288) | −$238 (−$1,568) | +$874 (−$456) |
| 2026-08 | −$5,753 | −$1,078 (+$4,675) | $0 (+$5,753) | $0 (+$5,753) | −$547 (+$5,206) | −$247 (+$5,506) |
| 2026-09 | −$218 | +$151 (+$368) | $0 (+$218) | $0 (+$218) | −$167 (+$51) | $0 (+$218) |

### Extra mechanism contrasts S2 and F1 — immediate model

Separate clock sides are retained. Their +1m monthly failures are also recorded
in the full saved monthly ledger and all-definition ranking.

#### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC

| Month | Clock short | S2 net (delta) | Clock long | F1 net (delta) |
| --- | ---: | ---: | ---: | ---: |
| 2025-07 | −$1,203 | −$297 (+$906) | −$161 | +$1,435 (+$1,597) |
| 2025-08 | −$1,876 | −$977 (+$898) | +$510 | −$364 (−$875) |
| 2025-09 | −$1,211 | +$217 (+$1,429) | −$109 | +$3,042 (+$3,151) |
| 2025-10 | −$894 | +$33 (+$927) | −$470 | −$112 (+$359) |
| 2025-11 | +$1,970 | +$457 (−$1,513) | −$3,287 | −$1,102 (+$2,185) |
| 2025-12 | +$1,212 | +$96 (−$1,116) | −$2,574 | +$246 (+$2,819) |
| 2026-01 | −$3,149 | +$634 (+$3,783) | +$1,782 | +$386 (−$1,396) |
| 2026-02 | −$1,111 | +$183 (+$1,294) | −$122 | −$864 (−$742) |
| 2026-03 | −$2,521 | −$365 (+$2,156) | +$1,155 | +$894 (−$260) |
| 2026-04 | −$1,628 | −$481 (+$1,147) | +$307 | −$641 (−$948) |
| 2026-05 | −$7,161 | +$426 (+$7,587) | +$5,789 | +$199 (−$5,591) |
| 2026-06 | −$64 | +$591 (+$655) | −$1,256 | +$1,068 (+$2,324) |
| 2026-07 | +$1,259 | +$1,085 (−$174) | −$2,621 | −$1,087 (+$1,534) |
| 2026-08 | −$5,675 | +$13 (+$5,689) | +$4,306 | +$1,337 (−$2,968) |
| 2026-09 | −$231 | −$759 (−$528) | +$55 | +$279 (+$224) |

#### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC

| Month | Clock short | S2 net (delta) | Clock long | F1 net (delta) |
| --- | ---: | ---: | ---: | ---: |
| 2026-05 | −$5,175 | $0 (+$5,175) | +$4,554 | +$908 (−$3,646) |
| 2026-06 | −$64 | +$591 (+$655) | −$1,256 | +$1,068 (+$2,324) |
| 2026-07 | +$1,259 | +$1,085 (−$174) | −$2,621 | −$1,087 (+$1,534) |
| 2026-08 | −$5,675 | +$13 (+$5,689) | +$4,306 | +$1,337 (−$2,968) |
| 2026-09 | −$231 | −$759 (−$528) | +$55 | +$279 (+$224) |


## 8. Adverse paths and winner concentration

Read-only path scan over completed immediate-model trades. Gross adverse
price movement is **not account DD**, ignores liquidation, and excludes the
exit minute's unknowable post-exit extremes. Cutoff-open positions are not
included in this completed-trade diagnostic.

The selected continuation longs do not hold through the October10 crash low;
their worst historical gross excursions are approximately7.6–9.6%, rather
than the much deeper crash exposure observed in several dip-entry families.
This is useful differentiation, not a guarantee of protection on a future
cascade or proof that they can use the live leverage.

### Full: July 1, 2025 00:00 → September 4, 2026 19:01 UTC — completed paths, 0m

| Setup | Completed trades | Worst gross adverse $ / price % | Date of worst adverse mark (UTC) | That trade's eventual net | Best5 winning $ / completed net |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clock long | 861 | −$5,352 / -53.52% | 2025-10-10T21:21:00.000Z | −$1,601 | 199.91% |
| L1 | 115 | −$959 / -9.59% | 2026-02-01T15:36:00.000Z | −$798 | 91.64% |
| L2 | 77 | −$763 / -7.63% | 2026-03-02T07:10:00.000Z | −$591 | 87.54% |
| L3 | 156 | −$959 / -9.59% | 2026-02-01T15:36:00.000Z | −$798 | 104.60% |
| L4 | 161 | −$959 / -9.59% | 2026-02-01T15:36:00.000Z | −$798 | 120.72% |
| L5 | 85 | −$929 / -9.29% | 2026-06-25T13:59:00.000Z | −$139 | 87.38% |
| Clock short | 861 | −$2,365 / -23.65% | 2026-08-19T21:45:00.000Z | −$1,885 | — |
| R5 | 62 | −$1,132 / -11.32% | 2025-12-19T11:44:00.000Z | −$941 | 164.81% |
| S2 | 75 | −$874 / -8.74% | 2026-04-07T23:31:00.000Z | −$632 | 313.36% |
| F1 | 262 | −$5,154 / -51.54% | 2025-10-10T21:21:00.000Z | −$968 | 91.16% |

### Recent: May 17, 2026 20:43 → September 4, 2026 19:01 UTC — completed paths, 0m

| Setup | Completed trades | Worst gross adverse $ / price % | Date of worst adverse mark (UTC) | That trade's eventual net | Best5 winning $ / completed net |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clock long | 219 | −$1,305 / -13.05% | 2026-06-04T10:52:00.000Z | −$1,078 | 106.49% |
| L1 | 31 | −$642 / -6.42% | 2026-08-07T17:35:00.000Z | −$514 | 112.04% |
| L2 | 22 | −$365 / -3.65% | 2026-06-30T09:18:00.000Z | −$333 | 115.43% |
| L3 | 36 | −$665 / -6.65% | 2026-07-08T02:36:00.000Z | −$559 | 119.65% |
| L4 | 36 | −$642 / -6.42% | 2026-08-07T17:35:00.000Z | −$420 | 110.25% |
| L5 | 20 | −$929 / -9.29% | 2026-06-25T13:59:00.000Z | −$139 | 122.85% |
| Clock short | 219 | −$2,365 / -23.65% | 2026-08-19T21:45:00.000Z | −$1,885 | — |
| R5 | 15 | −$539 / -5.39% | 2026-06-04T16:59:00.000Z | +$245 | 105.01% |
| S2 | 15 | −$744 / -7.44% | 2026-09-03T23:43:00.000Z | −$664 | 237.09% |
| F1 | 62 | −$838 / -8.38% | 2026-06-05T07:13:00.000Z | −$370 | 135.33% |


A ratio above100% means the other completed trades sum negative. It is not a
counterfactual “remove the best5” replay, and ratios are undefined for a
nonpositive completed net. L1/L2 top5 ratios are91.64%/87.54% full and
112.04%/115.43% recent. R5 is164.81% full /105.01% recent; S2 is313.36% /
237.09%. This is concentrated evidence, not a stable forward profit guarantee.

**F1 is the decisive fade caveat:** buy October10,2025 16:45 at$42.889;
low$20.784 at21:21: gross adverse −$5,154 /−51.54% on $10k entry.
It eventually closes −$968, so the closing loss alone hides the larger risk.
F1's positive aggregate net does not make a known ADX downturn a safe bottom
signal. Its recent worst adverse move is still8.38%.

R5's full worst adverse move is11.32% against its short, eventually closing
−$941. Recent worst is5.39% against it before eventually closing+$245.
A positive winning close does not imply the position stayed comfortable.

### Side observation: a known ADX downturn need not reverse price

A read-only synthetic calculation using the pinned feature/engine demonstrates
this without inventing a new strategy. After rising hourly closes with ADX100,
a bar still closes higher (149→150) but extends its low; ADX falls to96.64
while DI spread remains positive27.27. The frozen peak-fade SHORT can fire.
It is causal and correctly calculated, but “trend strength weakened” is not
equivalent to “price has turned down.” No extra historical rules were tested.

## 9. One decision traced end to end: L1

Only fully closed 4h data is used. This first full-window L1 trade illustrates
both causal timing and ADX memory of the prior trend.

| Observation | UTC bar start | Known at bar end | ADX | DI spread |
| --- | ---: | ---: | ---: | ---: |
| older | 2025-07-02T00:00:00.000Z | 2025-07-02T04:00:00.000Z | 35.41516416 | -15.42661040 |
| previous | 2025-07-02T04:00:00.000Z | 2025-07-02T08:00:00.000Z | 32.61681146 | -5.92849644 |
| current | 2025-07-02T08:00:00.000Z | 2025-07-02T12:00:00.000Z | 29.07517543 | 3.29760965 |

Current DI changes from nonpositive to positive and ADX remains>=20, so
L1 qualifies at **2025-07-02T12:00:00.000Z**. Its zero-publication-lag
entry is the next minute's open, **$38.2670**, at that timestamp.
Timeout exit is **2025-07-03T00:00:00.000Z**. No execution-minute
high, low or close informed the entry.

ADX is actually falling across these observations. The code does not quietly
require rising ADX or add a confirmation bar: either would be a different,
currently untested rule. Bar-end availability is a model, not evidence of
instantaneous live receipt. The separate +1m case tests delayed actions, and
prefix tests ensure future bars cannot alter earlier features/decisions.

## 10. Verification, provenance and exact reproduction

Accepted artifacts:
`backtests/hype/hype-adx-dmi-standalone-2026-09-06/`.

- Eight old/new/saved clock ledgers, stats, monthly and cutoff states match
  exactly before the strategy grid. The standalone model is different from
  the ladder; `sim-exact.ts` ladder parity is not claimed or required as an
  identical baseline for this intentionally fixed-notional study.
- Eight new test groups, all540 rule boundaries, hand seed/TR/tie/flat cases,
  15 clock/period library matches, period14 shared-module exactness,
  scale/translation/mirrored-price invariants and invalid-gap handling pass.
- Timing tests cover occupied/pending signals, strict threshold crossings,
  rejected-cross non-catch-up, first eligible exit, fees, delays, timeout ties,
  cutoff decisions, immutable pending exits and unrelated-feature isolation.
- Seventeen prior standalone groups,11 closed-bar timing groups and both
  TypeScript build configurations pass; research runner/checker/path scripts
  were also typechecked. Prior pinned sources are unchanged.
- Actual tape: zero missing minutes;45 feature-prefix checks;540 engine-prefix
  checks; exact period14 shared arrays on allfive clocks.
- Independent verifier passes **2,168 cases,466,909 overlapping trade records
  and21,680 monthly records**. It independently aggregates OHLC and computes
  array-form Wilder recurrences without importing the strategy/feature engine;
  checks all eligible/occupied signals, first exits, prices, fees, marks,
  turnover, full-minute DD, monthlies, own controls, ranks and traces.
- Input/source and accepted artifact hashes are unchanged. Both
  `validation.json` and `verification.json` are complete; no unfinished or
  abandoned I08 strategy run is being treated as evidence.
- The pinned read-only path helper checks selected topfive/rawtopfive/clocks.
  S2/F1 path rows additionally use an in-memory ID-list extension to that same
  helper, with unchanged pinned files; no new entries, exits or strategy
  simulations. All path pins matched.

| Pinned source / artifact | SHA-256 |
| --- | ---: |
| `research-inputs/indicators/adx-dmi-standalone-2026-09-06.json` | `303e4685f5abfafac58d6af8566a55da01baff2433e8395be6b34a3bf0ab9d4a` |
| `scripts/adx-dmi-standalone-engine.ts` | `2d053774a34b48684fb886018814a225197cef3c3a10e28450d1fdc06656258a` |
| `scripts/hype-adx-dmi-standalone-study.ts` | `c57f66cc2f83efeacdb7a06e4cfcc9510f2abcdf065877e4cd506019e59e491c` |
| `src/research/adx-dmi-features.ts` | `a1f09b5aa266f314969533bf52d7bb082ae304a03682b73b4d2ce143c30425bf` |
| `scripts/adx-dmi-standalone-tests.ts` | `a422b4286910f71a68798b2a0e537ce7e006f1f25e46ecdc8bc56b80e13c4d1a` |
| `scripts/adx-dmi-standalone-results-check.ts` | `0120d896801b5542d6dc000a403b14bc4a08f1e99334371c7ed0f5e73951528b` |
| `scripts/adx-dmi-standalone-path-check.ts` | `df053a9e3347e363e48d17f482fa1e9639f124eecaa677c264fe245aa1819e52` |
| `manifest.json` | `4f76e30cb812cff1f101be99e7657259ababfe23aab79cc63cdfd66269673c9a` |
| `results.json` | `5c3e09a3991c2829fe7283b873042188bcf6df06da6052784f359b273679f43d` |
| `trades.jsonl` | `b9355a230a464a7cce944fb94f92ed853ac132444a73fcf3967c58c3663ffce5` |
| `validation.json` | `840de7f7b86cc6b05a600f1761e35d5fe30f990a460f9cf610528bffc81d82a4` |

Complete raw input and prior-artifact fingerprints are in the manifest. Both
long minute streams, the explicit repair overlay and the saved I01 evidence
are pinned; reading newer local market data must not silently replace them.

[Method / commands](../docs/research/adx-dmi-standalone-study.md),
[frozen card](../research-inputs/indicators/adx-dmi-standalone-2026-09-06.json).
The runner refuses overwrite and writes only a new local artifact directory.
No exchange connection or VPS work is needed for these local studies.
Generated data/ledgers remain ignored; only small source/card/docs are
allowlisted for later review. This task does not commit or push them.

## 11. Disposition and still-untested scope

Keep L1/L3's strength-filter contrast, L2/L5's ADX strength-cross entries,
R5's narrow short and F1's fade failure as **ingredients for later controlled
work**, with all opportunity costs and sparse/concentrated results attached.
S2 is too thin under costs to describe alongside R5 without that warning.

No rule clears the full predeclared screen. The monthly condition is strict
against a nearly always-invested clock, so failure does not mean every
selective strategy is useless. It does mean this pass cannot label one a
proven replacement, infer a ladder exposure gate, or skip new validation.
No live threshold, short unpause or ladder change is recommended from I08.

Not tested: independent ADX smoothing lengths, other periods/clocks or daily;
DI magnitude and persistent-state entries; rising-only ADX or slope levels;
low-strength fades; price stops, targets, trailing or partial exits; indicator
combinations, HL/S/R conditioning, actual funding and shared-account execution.
Do not generalize a failed discrete rule into rejection of the whole family.

**Next bounded individual area: ATR / efficiency**, with an explicit
conditioning/risk question and its own directional control, rather than an
invented “ATR buys” rule. VWAP and volume coverage remain queued. No next
study has been launched here; complete the agreed individual coverage before
stage4 indicator combinations and stage5 indicator/HL/S/R work.

The inventory now contains **1,944 distinct standalone definitions**:
1,404 through I07 plus540 new I08. Ladder definitions remain45 and are not
added into this count. Parameter variants, repeated windows and delays are
not independent discoveries or additional indicator families.

## Appendix A. All37 descriptive survivors

These meet sample/net/cost/solvency in allfour cases, **not** the complete
clock/monthly screen. Sorted by full immediate absolute net. Each case shows
completed closes / net / extra-cost net. Baselines are in sections1 and4.

| Rank / exact ID | Full0: n / net / stress | Full+1: n / net / stress | Recent0: n / net / stress | Recent+1: n / net / stress |
| --- | ---: | ---: | ---: | ---: |
| 1. `adx_240m_n7_di_strong_t20_long_fixed12h` | 115 / +$6,852 / +$5,698 | 112 / +$6,363 / +$5,239 | 31 / +$3,174 / +$2,863 | 30 / +$2,836 / +$2,534 |
| 2. `adx_15m_n28_adx_cross_t25_long_fixed12h` | 77 / +$6,687 / +$5,914 | 77 / +$6,380 / +$5,607 | 22 / +$2,891 / +$2,669 | 22 / +$2,801 / +$2,580 |
| 3. `adx_240m_n7_di_cross_t0_long_fixed12h` | 156 / +$6,639 / +$5,075 | 147 / +$4,491 / +$3,018 | 36 / +$3,127 / +$2,765 | 34 / +$2,827 / +$2,486 |
| 4. `adx_240m_n7_di_cross_t0_long_indicator_or12h` | 161 / +$5,752 / +$4,138 | 161 / +$5,606 / +$3,992 | 36 / +$3,394 / +$3,032 | 36 / +$3,500 / +$3,138 |
| 5. `adx_60m_n14_adx_cross_t25_long_fixed12h` | 85 / +$5,491 / +$4,638 | 85 / +$5,495 / +$4,642 | 20 / +$2,388 / +$2,186 | 20 / +$2,409 / +$2,207 |
| 6. `adx_240m_n7_di_strong_t20_long_indicator_or12h` | 119 / +$5,473 / +$4,279 | 119 / +$5,391 / +$4,198 | 31 / +$3,144 / +$2,832 | 31 / +$3,198 / +$2,887 |
| 7. `adx_15m_n28_adx_cross_t25_long_indicator_or12h` | 77 / +$5,310 / +$4,536 | 77 / +$5,274 / +$4,501 | 22 / +$2,365 / +$2,143 | 22 / +$2,282 / +$2,061 |
| 8. `adx_240m_n7_di_strong_t25_long_fixed12h` | 83 / +$4,801 / +$3,968 | 82 / +$4,923 / +$4,100 | 22 / +$921 / +$701 | 22 / +$1,006 / +$786 |
| 9. `adx_15m_n7_adx_peak_fade_t50_long_fixed12h` | 262 / +$4,719 / +$2,085 | 261 / +$4,814 / +$2,190 | 62 / +$2,506 / +$1,875 | 62 / +$2,461 / +$1,829 |
| 10. `adx_15m_n14_adx_cross_t40_long_fixed12h` | 95 / +$4,672 / +$3,719 | 95 / +$4,807 / +$3,854 | 26 / +$2,561 / +$2,300 | 26 / +$2,528 / +$2,266 |
| 11. `adx_15m_n28_adx_cross_t20_long_indicator_or12h` | 139 / +$4,624 / +$3,230 | 138 / +$4,492 / +$3,109 | 39 / +$2,511 / +$2,119 | 39 / +$2,566 / +$2,174 |
| 12. `adx_15m_n7_di_strong_t40_long_fixed12h` | 153 / +$4,622 / +$3,078 | 153 / +$4,930 / +$3,387 | 35 / +$1,392 / +$1,032 | 35 / +$1,443 / +$1,082 |
| 13. `adx_5m_n28_di_strong_t25_long_fixed12h` | 80 / +$4,547 / +$3,745 | 80 / +$4,831 / +$4,028 | 19 / +$1,060 / +$869 | 19 / +$1,040 / +$849 |
| 14. `adx_30m_n14_adx_cross_t40_long_indicator_or12h` | 49 / +$4,545 / +$4,053 | 49 / +$4,511 / +$4,019 | 16 / +$1,466 / +$1,305 | 16 / +$1,514 / +$1,354 |
| 15. `adx_60m_n14_adx_cross_t25_long_indicator_or12h` | 85 / +$4,469 / +$3,617 | 85 / +$4,892 / +$4,039 | 20 / +$1,418 / +$1,217 | 20 / +$1,703 / +$1,502 |
| 16. `adx_60m_n7_adx_cross_t40_long_fixed12h` | 141 / +$4,361 / +$2,948 | 141 / +$4,435 / +$3,022 | 39 / +$3,328 / +$2,936 | 39 / +$3,219 / +$2,827 |
| 17. `adx_60m_n7_di_cross_t0_long_fixed12h` | 418 / +$4,351 / +$166 | 400 / +$5,050 / +$1,045 | 101 / +$5,651 / +$4,637 | 97 / +$5,612 / +$4,639 |
| 18. `adx_30m_n28_di_strong_t20_long_fixed12h` | 57 / +$4,180 / +$3,608 | 57 / +$4,225 / +$3,653 | 16 / +$2,315 / +$2,153 | 16 / +$2,272 / +$2,111 |
| 19. `adx_5m_n28_di_strong_t20_long_fixed12h` | 251 / +$4,106 / +$1,593 | 250 / +$4,386 / +$1,882 | 67 / +$4,352 / +$3,679 | 67 / +$4,738 / +$4,065 |
| 20. `adx_30m_n14_adx_cross_t40_long_fixed12h` | 49 / +$3,773 / +$3,281 | 49 / +$3,933 / +$3,440 | 16 / +$1,148 / +$988 | 16 / +$1,268 / +$1,107 |
| 21. `adx_15m_n14_adx_cross_t40_long_indicator_or12h` | 96 / +$3,729 / +$2,766 | 96 / +$4,603 / +$3,640 | 26 / +$1,785 / +$1,524 | 26 / +$1,938 / +$1,677 |
| 22. `adx_30m_n14_adx_cross_t25_long_indicator_or12h` | 182 / +$3,500 / +$1,677 | 181 / +$3,297 / +$1,485 | 47 / +$1,837 / +$1,366 | 47 / +$1,677 / +$1,206 |
| 23. `adx_30m_n28_adx_cross_t25_long_indicator_or12h` | 49 / +$3,369 / +$2,877 | 49 / +$3,089 / +$2,597 | 16 / +$2,197 / +$2,036 | 16 / +$1,988 / +$1,827 |
| 24. `adx_30m_n28_adx_cross_t25_long_fixed12h` | 49 / +$3,341 / +$2,849 | 49 / +$3,106 / +$2,615 | 16 / +$1,948 / +$1,787 | 16 / +$1,735 / +$1,575 |
| 25. `adx_5m_n14_adx_peak_fade_t40_long_fixed12h` | 259 / +$3,203 / +$600 | 257 / +$3,016 / +$433 | 59 / +$1,369 / +$768 | 57 / +$1,092 / +$511 |
| 26. `adx_60m_n7_adx_cross_t40_long_indicator_or12h` | 145 / +$2,968 / +$1,516 | 145 / +$2,878 / +$1,426 | 41 / +$1,188 / +$777 | 41 / +$985 / +$575 |
| 27. `adx_30m_n28_di_strong_t20_long_indicator_or12h` | 75 / +$2,954 / +$2,203 | 75 / +$3,213 / +$2,461 | 22 / +$1,808 / +$1,587 | 22 / +$1,841 / +$1,620 |
| 28. `adx_240m_n7_di_strong_t25_long_indicator_or12h` | 84 / +$2,680 / +$1,839 | 84 / +$2,680 / +$1,838 | 22 / +$805 / +$584 | 22 / +$887 / +$666 |
| 29. `adx_30m_n7_adx_cross_t20_long_fixed12h` | 182 / +$2,611 / +$789 | 178 / +$3,015 / +$1,233 | 48 / +$1,217 / +$737 | 48 / +$1,290 / +$809 |
| 30. `adx_30m_n14_adx_cross_t40_short_fixed12h` | 62 / +$1,860 / +$1,241 | 61 / +$1,617 / +$1,008 | 15 / +$1,863 / +$1,714 | 15 / +$1,691 / +$1,542 |
| 31. `adx_60m_n14_di_strong_t20_long_fixed12h` | 134 / +$1,681 / +$339 | 134 / +$1,784 / +$442 | 34 / +$3,001 / +$2,660 | 34 / +$3,301 / +$2,959 |
| 32. `adx_30m_n28_adx_cross_t20_long_indicator_or12h` | 77 / +$1,389 / +$618 | 77 / +$1,011 / +$241 | 20 / +$2,040 / +$1,839 | 20 / +$1,910 / +$1,709 |
| 33. `adx_240m_n7_adx_cross_t25_long_indicator_or12h` | 41 / +$1,121 / +$710 | 41 / +$943 / +$532 | 10 / +$959 / +$858 | 10 / +$965 / +$865 |
| 34. `adx_30m_n28_adx_cross_t20_long_fixed12h` | 77 / +$1,059 / +$288 | 76 / +$782 / +$21 | 20 / +$2,118 / +$1,917 | 19 / +$2,209 / +$2,018 |
| 35. `adx_240m_n7_adx_cross_t25_long_fixed12h` | 41 / +$1,019 / +$608 | 41 / +$869 / +$458 | 10 / +$959 / +$858 | 10 / +$965 / +$865 |
| 36. `adx_240m_n28_di_cross_t0_short_fixed12h` | 75 / +$858 / +$109 | 72 / +$734 / +$14 | 15 / +$931 / +$781 | 15 / +$853 / +$704 |
| 37. `adx_60m_n14_adx_cross_t40_long_fixed12h` | 37 / +$594 / +$223 | 37 / +$699 / +$329 | 14 / +$494 / +$354 | 14 / +$562 / +$422 |

## Appendix B. All540 ranked definitions, including failures

Raw rank is full immediate delta against own-side clock, not absolute
profit or a deployment ranking. Each row retains both windows/delays;
completed trade counts are 0m/+1m for each window. Worst monthly delta is
across all four cases against each one's own clock.

Failure codes: **N** insufficient count; **P** not positive absolute net in
all four; **C** not positive clock delta throughout; **M** monthly regression;
**F** extra-cost net nonpositive; **E** equity exhausted. Full failure strings
and all ledgers are in the saved artifacts. Zero complete qualifiers.

| Rank / exact ID | Full n 0/+1 | Full net0 | Full net+1 | Recent n 0/+1 | Recent net0 | Recent net+1 | Full0 own-clock delta | Worst monthly delta | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1. `adx_15m_n14_di_strong_t25_short_fixed12h` | 225/225 | +$5,196 | +$6,341 | 60/60 | −$425 | −$429 | +$27,479 | −$1,466 | P,M,F |
| 2. `adx_240m_n14_adx_cross_t25_short_fixed12h` | 20/20 | +$2,699 | +$2,559 | 5/5 | +$667 | +$619 | +$24,981 | −$2,020 | N,M |
| 3. `adx_240m_n14_adx_cross_t25_short_indicator_or12h` | 20/20 | +$2,699 | +$2,559 | 5/5 | +$667 | +$619 | +$24,981 | −$2,020 | N,M |
| 4. `adx_30m_n14_adx_cross_t20_short_fixed12h` | 159/158 | +$2,090 | +$1,672 | 37/37 | −$445 | −$304 | +$24,373 | −$1,605 | P,M,F |
| 5. `adx_30m_n14_adx_cross_t40_short_fixed12h` | 62/61 | +$1,860 | +$1,617 | 15/15 | +$1,863 | +$1,691 | +$24,142 | −$1,905 | M |
| 6. `adx_15m_n28_di_strong_t25_short_fixed12h` | 29/29 | +$1,183 | +$1,212 | 7/7 | +$160 | +$218 | +$23,465 | −$2,037 | N,M |
| 7. `adx_240m_n28_di_strong_t20_short_fixed12h` | 7/7 | +$1,121 | +$1,194 | 3/3 | +$749 | +$769 | +$23,403 | −$1,833 | N,M |
| 8. `adx_240m_n28_di_strong_t20_short_indicator_or12h` | 7/7 | +$1,121 | +$1,194 | 3/3 | +$749 | +$769 | +$23,403 | −$1,833 | N,M |
| 9. `adx_240m_n28_di_cross_t0_short_indicator_or12h` | 77/77 | +$1,029 | +$758 | 15/15 | +$1,222 | +$1,240 | +$23,311 | −$1,513 | M,F |
| 10. `adx_240m_n7_adx_cross_t20_short_fixed12h` | 39/38 | +$940 | +$1,085 | 10/10 | +$61 | −$44 | +$23,222 | −$879 | P,M,F |
| 11. `adx_240m_n7_adx_cross_t20_short_indicator_or12h` | 39/38 | +$910 | +$1,108 | 10/10 | −$10 | −$75 | +$23,192 | −$935 | P,M,F |
| 12. `adx_5m_n14_di_strong_t40_short_fixed12h` | 28/28 | +$865 | +$939 | 7/7 | −$1,057 | −$1,068 | +$23,148 | −$1,742 | N,P,M,F |
| 13. `adx_240m_n28_di_cross_t0_short_fixed12h` | 75/72 | +$858 | +$734 | 15/15 | +$931 | +$853 | +$23,141 | −$1,513 | M |
| 14. `adx_240m_n7_adx_cross_t40_short_fixed12h` | 30/30 | +$760 | +$587 | 8/8 | +$827 | +$785 | +$23,043 | −$2,707 | N,M |
| 15. `adx_240m_n7_adx_cross_t40_short_indicator_or12h` | 30/30 | +$656 | +$486 | 8/8 | +$827 | +$785 | +$22,938 | −$2,707 | N,M |
| 16. `adx_30m_n14_di_strong_t40_short_fixed12h` | 5/5 | +$587 | +$589 | 0/0 | $0 | $0 | +$22,870 | −$2,037 | N,P,M,F |
| 17. `adx_240m_n28_di_strong_t25_short_fixed12h` | 2/2 | +$557 | +$578 | 1/1 | +$412 | +$429 | +$22,840 | −$2,037 | N,M |
| 18. `adx_240m_n28_di_strong_t25_short_indicator_or12h` | 2/2 | +$557 | +$578 | 1/1 | +$412 | +$429 | +$22,840 | −$2,037 | N,M |
| 19. `adx_30m_n28_adx_cross_t40_short_fixed12h` | 7/7 | +$458 | +$410 | 2/2 | −$97 | −$125 | +$22,741 | −$2,037 | N,P,M,F |
| 20. `adx_30m_n28_adx_cross_t40_short_indicator_or12h` | 7/7 | +$458 | +$410 | 2/2 | −$97 | −$125 | +$22,741 | −$2,037 | N,P,M,F |
| 21. `adx_60m_n28_adx_cross_t20_short_fixed12h` | 43/42 | +$373 | +$549 | 14/13 | +$286 | +$565 | +$22,655 | −$3,020 | M,F |
| 22. `adx_240m_n14_adx_cross_t20_short_fixed12h` | 24/24 | +$352 | +$334 | 3/3 | −$257 | −$232 | +$22,635 | −$2,824 | N,P,M,F |
| 23. `adx_60m_n28_adx_cross_t40_short_fixed12h` | 5/5 | +$313 | +$258 | 0/0 | $0 | $0 | +$22,596 | −$2,541 | N,P,M,F |
| 24. `adx_60m_n28_adx_cross_t40_short_indicator_or12h` | 5/5 | +$313 | +$258 | 0/0 | $0 | $0 | +$22,596 | −$2,541 | N,P,M,F |
| 25. `adx_240m_n14_adx_cross_t20_short_indicator_or12h` | 24/24 | +$161 | +$77 | 3/3 | −$257 | −$232 | +$22,444 | −$3,073 | N,P,M,F |
| 26. `adx_240m_n7_di_strong_t40_short_indicator_or12h` | 11/11 | +$41 | +$175 | 3/3 | −$323 | −$317 | +$22,323 | −$2,037 | N,P,M,F |
| 27. `adx_30m_n28_adx_peak_fade_t50_short_fixed12h` | 2/2 | +$13 | +$19 | 0/0 | $0 | $0 | +$22,296 | −$2,037 | N,P,M,F |
| 28. `adx_30m_n28_adx_peak_fade_t50_short_indicator_or12h` | 2/2 | +$13 | +$19 | 0/0 | $0 | $0 | +$22,296 | −$2,037 | N,P,M,F |
| 29. `adx_15m_n28_di_strong_t40_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 30. `adx_15m_n28_di_strong_t40_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 31. `adx_30m_n28_di_strong_t40_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 32. `adx_30m_n28_di_strong_t40_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 33. `adx_60m_n28_di_strong_t40_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 34. `adx_60m_n28_di_strong_t40_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 35. `adx_240m_n28_di_strong_t40_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 36. `adx_240m_n28_di_strong_t40_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 37. `adx_240m_n28_adx_cross_t40_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 38. `adx_240m_n28_adx_cross_t40_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 39. `adx_240m_n28_adx_peak_fade_t50_short_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 40. `adx_240m_n28_adx_peak_fade_t50_short_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | +$22,283 | −$2,037 | N,P,M,F |
| 41. `adx_240m_n7_di_strong_t40_short_fixed12h` | 11/11 | −$50 | +$73 | 3/3 | −$365 | −$350 | +$22,232 | −$2,037 | N,P,M,F |
| 42. `adx_240m_n28_adx_peak_fade_t40_short_fixed12h` | 3/3 | −$62 | −$46 | 3/3 | −$62 | −$46 | +$22,221 | −$2,037 | N,P,M,F |
| 43. `adx_240m_n28_adx_peak_fade_t40_short_indicator_or12h` | 3/3 | −$62 | −$46 | 3/3 | −$62 | −$46 | +$22,221 | −$2,037 | N,P,M,F |
| 44. `adx_60m_n14_di_strong_t40_short_indicator_or12h` | 3/3 | −$125 | −$286 | 0/0 | $0 | $0 | +$22,158 | −$2,037 | N,P,M,F |
| 45. `adx_5m_n28_di_strong_t40_short_indicator_or12h` | 1/1 | −$129 | −$37 | 0/0 | $0 | $0 | +$22,154 | −$2,037 | N,P,M,F |
| 46. `adx_60m_n28_adx_peak_fade_t50_short_fixed12h` | 1/1 | −$129 | −$134 | 0/0 | $0 | $0 | +$22,154 | −$2,037 | N,P,M,F |
| 47. `adx_60m_n28_adx_peak_fade_t50_short_indicator_or12h` | 1/1 | −$129 | −$134 | 0/0 | $0 | $0 | +$22,154 | −$2,037 | N,P,M,F |
| 48. `adx_60m_n14_adx_cross_t25_short_fixed12h` | 89/88 | −$153 | −$60 | 23/22 | −$565 | +$310 | +$22,130 | −$2,036 | P,M,F |
| 49. `adx_240m_n28_adx_cross_t25_short_fixed12h` | 3/3 | −$206 | −$127 | 1/1 | +$171 | +$164 | +$22,077 | −$2,037 | N,P,M,F |
| 50. `adx_240m_n28_adx_cross_t25_short_indicator_or12h` | 3/3 | −$206 | −$127 | 1/1 | +$171 | +$164 | +$22,077 | −$2,037 | N,P,M,F |
| 51. `adx_15m_n28_di_strong_t25_short_indicator_or12h` | 30/30 | −$216 | −$278 | 7/7 | −$407 | −$399 | +$22,066 | −$2,037 | N,P,M,F |
| 52. `adx_240m_n14_di_strong_t40_short_fixed12h` | 1/1 | −$222 | −$269 | 0/0 | $0 | $0 | +$22,061 | −$2,037 | N,P,M,F |
| 53. `adx_240m_n14_di_strong_t40_short_indicator_or12h` | 1/1 | −$222 | −$269 | 0/0 | $0 | $0 | +$22,061 | −$2,037 | N,P,M,F |
| 54. `adx_60m_n28_adx_cross_t20_short_indicator_or12h` | 43/42 | −$256 | −$35 | 14/13 | +$91 | +$397 | +$22,026 | −$3,089 | P,M,F |
| 55. `adx_15m_n28_adx_cross_t40_short_fixed12h` | 14/14 | −$337 | −$250 | 3/3 | −$109 | −$102 | +$21,945 | −$2,317 | N,P,M,F |
| 56. `adx_5m_n28_adx_peak_fade_t50_short_indicator_or12h` | 1/1 | −$350 | −$305 | 0/0 | $0 | $0 | +$21,933 | −$2,037 | N,P,M,F |
| 57. `adx_60m_n28_di_strong_t25_short_indicator_or12h` | 11/11 | −$381 | −$281 | 4/4 | −$441 | −$427 | +$21,902 | −$1,954 | N,P,M,F |
| 58. `adx_240m_n28_adx_cross_t20_short_fixed12h` | 10/10 | −$382 | −$430 | 2/2 | +$46 | +$54 | +$21,900 | −$2,208 | N,P,M,F |
| 59. `adx_240m_n28_adx_cross_t20_short_indicator_or12h` | 10/10 | −$382 | −$430 | 2/2 | +$46 | +$54 | +$21,900 | −$2,208 | N,P,M,F |
| 60. `adx_60m_n28_di_strong_t20_short_fixed12h` | 34/34 | −$413 | −$224 | 10/10 | −$728 | −$693 | +$21,869 | −$1,954 | P,M,F |
| 61. `adx_240m_n14_adx_cross_t40_short_fixed12h` | 7/7 | −$416 | −$450 | 2/2 | −$1,105 | −$1,107 | +$21,867 | −$1,982 | N,P,M,F |
| 62. `adx_240m_n14_adx_cross_t40_short_indicator_or12h` | 7/7 | −$416 | −$450 | 2/2 | −$1,105 | −$1,107 | +$21,867 | −$1,982 | N,P,M,F |
| 63. `adx_30m_n14_di_strong_t40_short_indicator_or12h` | 5/5 | −$451 | −$483 | 0/0 | $0 | $0 | +$21,832 | −$2,037 | N,P,M,F |
| 64. `adx_5m_n28_di_strong_t40_short_fixed12h` | 1/1 | −$477 | −$401 | 0/0 | $0 | $0 | +$21,805 | −$2,037 | N,P,M,F |
| 65. `adx_60m_n14_di_strong_t40_short_fixed12h` | 3/3 | −$526 | −$710 | 0/0 | $0 | $0 | +$21,757 | −$2,037 | N,P,M,F |
| 66. `adx_5m_n28_adx_peak_fade_t50_short_fixed12h` | 1/1 | −$797 | −$810 | 0/0 | $0 | $0 | +$21,486 | −$2,037 | N,P,M,F |
| 67. `adx_60m_n14_adx_cross_t25_short_indicator_or12h` | 89/88 | −$797 | −$1,085 | 23/22 | −$128 | +$191 | +$21,485 | −$1,561 | P,M,F |
| 68. `adx_240m_n7_adx_cross_t25_short_fixed12h` | 42/42 | −$967 | −$1,133 | 11/11 | −$2,043 | −$2,024 | +$21,316 | −$1,927 | P,M,F |
| 69. `adx_60m_n28_di_strong_t25_short_fixed12h` | 11/11 | −$988 | −$893 | 4/4 | −$451 | −$407 | +$21,294 | −$1,954 | N,P,M,F |
| 70. `adx_60m_n14_adx_cross_t20_short_indicator_or12h` | 88/88 | −$1,003 | −$1,085 | 26/26 | −$763 | −$572 | +$21,280 | −$1,659 | P,M,F |
| 71. `adx_5m_n14_di_strong_t40_short_indicator_or12h` | 29/29 | −$1,011 | −$888 | 8/8 | −$448 | −$336 | +$21,272 | −$1,695 | N,P,M,F |
| 72. `adx_15m_n14_di_strong_t40_short_indicator_or12h` | 13/13 | −$1,016 | −$1,039 | 5/5 | −$346 | −$349 | +$21,266 | −$2,037 | N,P,M,F |
| 73. `adx_240m_n14_adx_peak_fade_t50_short_fixed12h` | 6/6 | −$1,017 | −$832 | 4/4 | −$291 | −$215 | +$21,266 | −$2,037 | N,P,M,F |
| 74. `adx_240m_n14_adx_peak_fade_t50_short_indicator_or12h` | 6/6 | −$1,017 | −$832 | 4/4 | −$291 | −$215 | +$21,266 | −$2,037 | N,P,M,F |
| 75. `adx_15m_n28_adx_cross_t40_short_indicator_or12h` | 14/14 | −$1,036 | −$1,019 | 3/3 | −$120 | −$107 | +$21,247 | −$2,443 | N,P,M,F |
| 76. `adx_60m_n28_adx_peak_fade_t40_short_fixed12h` | 6/6 | −$1,044 | −$954 | 3/3 | −$1,165 | −$1,093 | +$21,238 | −$2,037 | N,P,M,F |
| 77. `adx_60m_n28_adx_peak_fade_t40_short_indicator_or12h` | 6/6 | −$1,044 | −$954 | 3/3 | −$1,165 | −$1,093 | +$21,238 | −$2,037 | N,P,M,F |
| 78. `adx_15m_n28_adx_peak_fade_t50_short_indicator_or12h` | 4/4 | −$1,051 | −$1,147 | 1/1 | −$285 | −$305 | +$21,232 | −$2,037 | N,P,M,F |
| 79. `adx_60m_n14_adx_cross_t40_short_indicator_or12h` | 26/26 | −$1,075 | −$975 | 8/8 | −$488 | −$430 | +$21,208 | −$2,505 | N,P,M,F |
| 80. `adx_15m_n28_adx_peak_fade_t50_short_fixed12h` | 4/4 | −$1,076 | −$1,148 | 1/1 | −$285 | −$305 | +$21,206 | −$2,037 | N,P,M,F |
| 81. `adx_30m_n14_adx_cross_t40_short_indicator_or12h` | 62/62 | −$1,078 | −$1,158 | 15/15 | +$1,821 | +$1,638 | +$21,204 | −$2,354 | P,M,F |
| 82. `adx_240m_n14_di_strong_t25_short_fixed12h` | 15/15 | −$1,300 | −$1,401 | 5/5 | −$130 | −$25 | +$20,983 | −$2,037 | N,P,M,F |
| 83. `adx_60m_n28_adx_cross_t25_short_fixed12h` | 22/22 | −$1,397 | −$1,430 | 6/6 | −$311 | −$332 | +$20,885 | −$2,342 | N,P,M,F |
| 84. `adx_30m_n7_di_strong_t40_short_fixed12h` | 92/92 | −$1,449 | −$1,388 | 27/27 | +$179 | +$327 | +$20,834 | −$1,622 | P,M,F |
| 85. `adx_60m_n14_adx_cross_t40_short_fixed12h` | 26/26 | −$1,465 | −$1,376 | 8/8 | −$470 | −$414 | +$20,818 | −$2,502 | N,P,M,F |
| 86. `adx_240m_n7_di_strong_t25_short_indicator_or12h` | 77/77 | −$1,480 | −$1,371 | 21/21 | −$488 | −$339 | +$20,803 | −$2,438 | P,M,F |
| 87. `adx_60m_n28_di_strong_t20_short_indicator_or12h` | 41/41 | −$1,587 | −$1,517 | 14/14 | −$1,579 | −$1,577 | +$20,696 | −$1,954 | P,M,F |
| 88. `adx_240m_n14_di_strong_t25_short_indicator_or12h` | 15/15 | −$1,636 | −$1,720 | 5/5 | +$34 | +$133 | +$20,647 | −$2,037 | N,P,M,F |
| 89. `adx_15m_n14_di_strong_t40_short_fixed12h` | 13/13 | −$1,639 | −$1,619 | 5/5 | −$524 | −$505 | +$20,643 | −$2,037 | N,P,M,F |
| 90. `adx_60m_n28_adx_cross_t25_short_indicator_or12h` | 22/22 | −$1,647 | −$1,661 | 6/6 | −$311 | −$332 | +$20,636 | −$2,382 | N,P,M,F |
| 91. `adx_60m_n14_adx_cross_t20_short_fixed12h` | 88/87 | −$1,787 | −$1,764 | 26/26 | −$1,461 | −$1,326 | +$20,496 | −$2,180 | P,M,F |
| 92. `adx_30m_n28_adx_cross_t20_short_fixed12h` | 77/77 | −$1,805 | −$2,053 | 20/20 | −$295 | −$253 | +$20,478 | −$1,499 | P,M,F |
| 93. `adx_30m_n28_adx_cross_t25_short_indicator_or12h` | 48/48 | −$1,884 | −$1,795 | 12/12 | +$619 | +$699 | +$20,399 | −$2,273 | P,M,F |
| 94. `adx_240m_n14_adx_peak_fade_t40_short_indicator_or12h` | 22/21 | −$1,966 | −$1,567 | 8/8 | −$668 | −$205 | +$20,317 | −$2,037 | N,P,M,F |
| 95. `adx_30m_n28_adx_cross_t20_short_indicator_or12h` | 77/77 | −$1,980 | −$1,905 | 20/20 | −$132 | −$30 | +$20,303 | −$1,421 | P,M,F |
| 96. `adx_240m_n14_adx_peak_fade_t40_short_fixed12h` | 22/21 | −$1,991 | −$1,627 | 8/8 | −$668 | −$205 | +$20,292 | −$2,037 | N,P,M,F |
| 97. `adx_240m_n7_adx_cross_t25_short_indicator_or12h` | 42/42 | −$2,028 | −$2,225 | 11/11 | −$2,073 | −$2,092 | +$20,254 | −$1,959 | P,M,F |
| 98. `adx_240m_n7_di_strong_t25_short_fixed12h` | 77/74 | −$2,152 | −$1,864 | 21/20 | +$35 | +$77 | +$20,131 | −$2,465 | P,M,F |
| 99. `adx_30m_n28_adx_cross_t25_short_fixed12h` | 48/48 | −$2,232 | −$2,260 | 12/12 | +$339 | +$401 | +$20,051 | −$2,273 | P,M,F |
| 100. `adx_30m_n28_adx_peak_fade_t40_short_indicator_or12h` | 8/8 | −$2,251 | −$2,038 | 3/3 | −$483 | −$438 | +$20,031 | −$2,037 | N,P,M,F |
| 101. `adx_15m_n14_adx_cross_t40_short_fixed12h` | 106/106 | −$2,257 | −$2,443 | 25/25 | +$375 | +$371 | +$20,025 | −$1,639 | P,M,F |
| 102. `adx_60m_n7_di_strong_t40_short_indicator_or12h` | 43/43 | −$2,260 | −$2,509 | 8/8 | −$1,037 | −$1,005 | +$20,022 | −$1,878 | N,P,M,F |
| 103. `adx_60m_n14_adx_peak_fade_t40_short_indicator_or12h` | 41/40 | −$2,294 | −$2,362 | 15/15 | −$741 | −$707 | +$19,988 | −$2,037 | P,M,F |
| 104. `adx_30m_n14_adx_cross_t20_short_indicator_or12h` | 171/170 | −$2,326 | −$1,638 | 42/42 | −$1,574 | −$1,444 | +$19,957 | −$3,437 | P,M,F |
| 105. `adx_15m_n14_adx_peak_fade_t50_short_indicator_or12h` | 27/27 | −$2,348 | −$2,323 | 9/9 | −$605 | −$634 | +$19,935 | −$2,037 | N,P,M,F |
| 106. `adx_60m_n7_di_strong_t40_short_fixed12h` | 43/43 | −$2,409 | −$2,552 | 8/8 | −$1,206 | −$1,200 | +$19,874 | −$1,802 | N,P,M,F |
| 107. `adx_30m_n28_adx_peak_fade_t40_short_fixed12h` | 8/8 | −$2,468 | −$2,356 | 3/3 | −$483 | −$438 | +$19,815 | −$2,037 | N,P,M,F |
| 108. `adx_5m_n28_adx_cross_t40_short_indicator_or12h` | 34/34 | −$2,482 | −$2,211 | 8/8 | −$802 | −$692 | +$19,800 | −$2,059 | N,P,M,F |
| 109. `adx_60m_n14_adx_peak_fade_t50_short_indicator_or12h` | 11/10 | −$2,535 | −$2,442 | 4/4 | −$485 | −$464 | +$19,748 | −$2,037 | N,P,M,F |
| 110. `adx_15m_n14_di_strong_t20_short_fixed12h` | 396/390 | −$2,573 | −$1,526 | 101/101 | −$3,299 | −$3,301 | +$19,710 | −$682 | P,M,F |
| 111. `adx_30m_n28_di_strong_t25_short_indicator_or12h` | 23/23 | −$2,620 | −$2,661 | 5/5 | −$502 | −$496 | +$19,662 | −$2,037 | N,P,M,F |
| 112. `adx_30m_n14_adx_peak_fade_t50_short_fixed12h` | 23/23 | −$2,694 | −$2,383 | 8/8 | −$1,319 | −$1,252 | +$19,589 | −$2,037 | N,P,M,F |
| 113. `adx_240m_n7_di_strong_t20_short_indicator_or12h` | 112/112 | −$2,732 | −$3,007 | 30/30 | −$352 | −$266 | +$19,551 | −$2,297 | P,M,F |
| 114. `adx_60m_n14_adx_peak_fade_t50_short_fixed12h` | 11/10 | −$2,751 | −$2,761 | 4/4 | −$485 | −$464 | +$19,531 | −$2,037 | N,P,M,F |
| 115. `adx_240m_n7_di_cross_t0_short_indicator_or12h` | 161/161 | −$2,780 | −$3,240 | 36/36 | +$332 | +$336 | +$19,502 | −$2,587 | P,M,F |
| 116. `adx_5m_n28_adx_peak_fade_t40_short_indicator_or12h` | 17/17 | −$2,831 | −$2,696 | 6/6 | −$2,356 | −$2,334 | +$19,452 | −$2,037 | N,P,M,F |
| 117. `adx_5m_n14_adx_peak_fade_t50_short_indicator_or12h` | 77/77 | −$2,967 | −$2,757 | 20/20 | +$320 | +$203 | +$19,316 | −$2,088 | P,M,F |
| 118. `adx_240m_n14_di_cross_t0_short_indicator_or12h` | 114/114 | −$2,972 | −$3,722 | 22/22 | +$644 | +$638 | +$19,310 | −$1,932 | P,M,F |
| 119. `adx_30m_n7_di_strong_t40_short_indicator_or12h` | 94/94 | −$3,173 | −$3,001 | 27/27 | −$873 | −$864 | +$19,110 | −$2,139 | P,M,F |
| 120. `adx_60m_n7_adx_cross_t25_short_indicator_or12h` | 162/162 | −$3,200 | −$2,991 | 36/36 | −$135 | −$185 | +$19,083 | −$1,927 | P,M,F |
| 121. `adx_60m_n7_adx_cross_t20_short_fixed12h` | 104/103 | −$3,201 | −$2,989 | 26/26 | −$2,785 | −$2,532 | +$19,082 | −$2,731 | P,M,F |
| 122. `adx_5m_n28_adx_cross_t40_short_fixed12h` | 34/34 | −$3,268 | −$2,931 | 8/8 | −$650 | −$564 | +$19,015 | −$2,192 | N,P,M,F |
| 123. `adx_30m_n14_adx_peak_fade_t50_short_indicator_or12h` | 23/23 | −$3,360 | −$3,056 | 8/8 | −$1,118 | −$1,057 | +$18,922 | −$2,037 | N,P,M,F |
| 124. `adx_5m_n28_adx_peak_fade_t40_short_fixed12h` | 17/17 | −$3,368 | −$3,371 | 6/6 | −$2,430 | −$2,411 | +$18,914 | −$2,037 | N,P,M,F |
| 125. `adx_60m_n28_di_cross_t0_short_fixed12h` | 217/209 | −$3,378 | −$1,701 | 49/48 | −$1,097 | −$345 | +$18,905 | −$2,352 | P,M,F |
| 126. `adx_15m_n28_adx_peak_fade_t40_short_indicator_or12h` | 15/15 | −$3,533 | −$3,567 | 3/3 | −$764 | −$737 | +$18,749 | −$2,037 | N,P,M,F |
| 127. `adx_240m_n14_di_strong_t20_short_fixed12h` | 43/40 | −$3,615 | −$3,616 | 10/9 | +$134 | +$238 | +$18,667 | −$1,946 | N,P,M,F |
| 128. `adx_240m_n14_di_strong_t20_short_indicator_or12h` | 43/43 | −$3,624 | −$3,765 | 10/10 | +$4 | +$65 | +$18,659 | −$1,946 | P,M,F |
| 129. `adx_15m_n28_adx_cross_t25_short_fixed12h` | 96/96 | −$3,667 | −$3,263 | 22/22 | +$69 | +$226 | +$18,615 | −$1,377 | P,M,F |
| 130. `adx_30m_n14_di_strong_t25_short_indicator_or12h` | 141/141 | −$3,741 | −$4,125 | 33/33 | −$1,489 | −$1,699 | +$18,542 | −$2,279 | P,M,F |
| 131. `adx_15m_n28_di_strong_t20_short_fixed12h` | 100/100 | −$3,812 | −$3,728 | 25/25 | −$1,575 | −$1,559 | +$18,470 | −$2,346 | P,M,F |
| 132. `adx_60m_n14_di_strong_t25_short_indicator_or12h` | 67/67 | −$3,825 | −$4,132 | 17/17 | −$31 | −$64 | +$18,458 | −$2,182 | P,M,F |
| 133. `adx_60m_n7_adx_cross_t25_short_fixed12h` | 155/152 | −$3,913 | −$2,982 | 34/33 | −$476 | −$326 | +$18,370 | −$2,407 | P,M,F |
| 134. `adx_60m_n7_adx_cross_t20_short_indicator_or12h` | 108/108 | −$4,018 | −$3,720 | 27/27 | −$746 | −$657 | +$18,265 | −$2,838 | P,M,F |
| 135. `adx_30m_n7_adx_cross_t40_short_indicator_or12h` | 257/256 | −$4,101 | −$3,570 | 58/58 | −$1,725 | −$1,428 | +$18,182 | −$4,071 | P,M,F |
| 136. `adx_30m_n7_adx_peak_fade_t50_short_indicator_or12h` | 143/143 | −$4,159 | −$4,369 | 41/41 | −$1,874 | −$2,078 | +$18,123 | −$1,874 | P,M,F |
| 137. `adx_30m_n28_di_strong_t20_short_indicator_or12h` | 73/73 | −$4,179 | −$3,896 | 20/20 | −$1,320 | −$1,166 | +$18,103 | −$2,238 | P,M,F |
| 138. `adx_15m_n28_adx_peak_fade_t40_short_fixed12h` | 15/15 | −$4,198 | −$4,324 | 3/3 | −$762 | −$801 | +$18,084 | −$2,037 | N,P,M,F |
| 139. `adx_15m_n7_di_strong_t40_short_fixed12h` | 140/140 | −$4,229 | −$4,886 | 39/39 | −$4,064 | −$4,151 | +$18,053 | −$1,397 | P,M,F |
| 140. `adx_5m_n14_adx_peak_fade_t50_short_fixed12h` | 75/75 | −$4,265 | −$3,991 | 19/19 | −$781 | −$843 | +$18,017 | −$1,879 | P,M,F |
| 141. `adx_240m_n7_adx_peak_fade_t50_short_fixed12h` | 42/40 | −$4,281 | −$4,827 | 17/17 | −$3,679 | −$3,710 | +$18,001 | −$2,014 | P,M,F |
| 142. `adx_240m_n7_di_strong_t20_short_fixed12h` | 112/108 | −$4,349 | −$4,080 | 30/28 | −$505 | −$259 | +$17,934 | −$2,209 | P,M,F |
| 143. `adx_15m_n14_adx_peak_fade_t50_short_fixed12h` | 27/27 | −$4,351 | −$4,279 | 9/9 | −$1,075 | −$1,066 | +$17,932 | −$2,037 | N,P,M,F |
| 144. `adx_15m_n14_di_strong_t25_short_indicator_or12h` | 279/279 | −$4,467 | −$3,750 | 79/79 | −$637 | −$663 | +$17,816 | −$3,019 | P,M,F |
| 145. `adx_30m_n7_di_strong_t25_short_fixed12h` | 409/407 | −$4,559 | −$2,896 | 108/107 | −$4,218 | −$3,759 | +$17,724 | −$1,583 | P,M,F |
| 146. `adx_30m_n14_di_strong_t25_short_fixed12h` | 124/124 | −$4,559 | −$4,360 | 30/30 | −$3,289 | −$3,404 | +$17,723 | −$2,629 | P,M,F |
| 147. `adx_240m_n7_adx_peak_fade_t50_short_indicator_or12h` | 42/40 | −$4,585 | −$4,808 | 17/17 | −$3,679 | −$3,696 | +$17,698 | −$2,014 | P,M,F |
| 148. `adx_240m_n14_di_cross_t0_short_fixed12h` | 113/107 | −$4,712 | −$5,044 | 22/21 | +$297 | +$295 | +$17,571 | −$2,233 | P,M,F |
| 149. `adx_15m_n28_adx_cross_t25_short_indicator_or12h` | 97/97 | −$4,746 | −$4,158 | 22/22 | +$825 | +$1,027 | +$17,536 | −$2,369 | P,M,F |
| 150. `adx_240m_n7_di_cross_t0_short_fixed12h` | 161/152 | −$4,801 | −$4,832 | 36/34 | +$245 | +$410 | +$17,482 | −$2,746 | P,M,F |
| 151. `adx_30m_n7_adx_peak_fade_t40_short_indicator_or12h` | 283/283 | −$4,890 | −$5,492 | 67/67 | −$2,544 | −$2,925 | +$17,393 | −$1,671 | P,M,F |
| 152. `adx_15m_n14_adx_cross_t40_short_indicator_or12h` | 109/109 | −$4,900 | −$4,472 | 25/25 | −$113 | +$51 | +$17,383 | −$2,633 | P,M,F |
| 153. `adx_60m_n14_adx_peak_fade_t40_short_fixed12h` | 41/40 | −$4,947 | −$4,995 | 15/15 | −$1,764 | −$1,701 | +$17,335 | −$2,037 | P,M,F |
| 154. `adx_60m_n14_di_strong_t25_short_fixed12h` | 61/61 | −$5,000 | −$5,131 | 16/16 | −$374 | −$386 | +$17,283 | −$2,412 | P,M,F |
| 155. `adx_15m_n7_adx_peak_fade_t50_short_indicator_or12h` | 288/288 | −$5,135 | −$4,823 | 76/76 | −$2,483 | −$2,314 | +$17,148 | −$1,780 | P,M,F |
| 156. `adx_5m_n28_di_strong_t25_short_indicator_or12h` | 88/88 | −$5,139 | −$5,716 | 25/25 | −$1,692 | −$2,295 | +$17,144 | −$2,185 | P,M,F |
| 157. `adx_60m_n14_di_strong_t20_short_indicator_or12h` | 159/159 | −$5,177 | −$5,068 | 38/38 | −$1,678 | −$1,516 | +$17,105 | −$2,045 | P,M,F |
| 158. `adx_60m_n28_di_cross_t0_short_indicator_or12h` | 304/304 | −$5,325 | −$5,145 | 73/73 | −$2,759 | −$2,399 | +$16,958 | −$3,024 | P,M,F |
| 159. `adx_30m_n7_adx_peak_fade_t50_short_fixed12h` | 139/139 | −$5,386 | −$5,120 | 40/40 | −$2,537 | −$2,560 | +$16,897 | −$1,479 | P,M,F |
| 160. `adx_30m_n28_di_strong_t20_short_fixed12h` | 56/56 | −$5,649 | −$5,709 | 14/14 | −$2,725 | −$2,766 | +$16,634 | −$1,917 | P,M,F |
| 161. `adx_5m_n7_adx_peak_fade_t50_short_indicator_or12h` | 851/851 | −$5,691 | −$6,051 | 220/220 | −$980 | −$960 | +$16,592 | −$1,703 | P,M,F |
| 162. `adx_60m_n7_adx_peak_fade_t40_short_indicator_or12h` | 173/169 | −$5,706 | −$5,085 | 51/49 | −$3,796 | −$4,052 | +$16,576 | −$1,966 | P,M,F |
| 163. `adx_30m_n28_di_strong_t25_short_fixed12h` | 20/20 | −$5,749 | −$5,810 | 4/4 | −$1,582 | −$1,559 | +$16,534 | −$2,037 | N,P,M,F |
| 164. `adx_15m_n7_di_strong_t40_short_indicator_or12h` | 154/154 | −$5,765 | −$6,152 | 43/43 | −$2,017 | −$1,809 | +$16,518 | −$2,035 | P,M,F |
| 165. `adx_5m_n14_adx_peak_fade_t40_short_fixed12h` | 212/212 | −$5,866 | −$6,088 | 62/62 | −$2,312 | −$2,048 | +$16,416 | −$2,609 | P,M,F |
| 166. `adx_5m_n14_adx_peak_fade_t40_short_indicator_or12h` | 258/258 | −$5,924 | −$6,530 | 75/75 | −$746 | −$887 | +$16,359 | −$2,000 | P,M,F |
| 167. `adx_15m_n28_di_strong_t20_short_indicator_or12h` | 132/132 | −$5,928 | −$6,012 | 34/34 | −$1,275 | −$1,307 | +$16,355 | −$2,587 | P,M,F |
| 168. `adx_30m_n7_di_strong_t20_short_fixed12h` | 501/495 | −$6,008 | −$4,533 | 125/123 | −$2,058 | −$2,372 | +$16,275 | −$2,050 | P,M,F |
| 169. `adx_15m_n14_adx_peak_fade_t40_short_indicator_or12h` | 96/96 | −$6,034 | −$6,041 | 28/28 | −$2,378 | −$2,409 | +$16,248 | −$1,529 | P,M,F |
| 170. `adx_60m_n7_adx_peak_fade_t50_short_indicator_or12h` | 87/84 | −$6,045 | −$5,615 | 30/30 | −$2,069 | −$2,107 | +$16,238 | −$1,901 | P,M,F |
| 171. `adx_30m_n7_adx_cross_t20_short_fixed12h` | 184/183 | −$6,049 | −$6,992 | 39/39 | −$192 | −$94 | +$16,234 | −$2,155 | P,M,F |
| 172. `adx_30m_n7_adx_cross_t20_short_indicator_or12h` | 229/229 | −$6,069 | −$5,689 | 51/51 | −$462 | −$292 | +$16,214 | −$2,245 | P,M,F |
| 173. `adx_30m_n14_adx_peak_fade_t40_short_indicator_or12h` | 54/53 | −$6,072 | −$5,452 | 19/19 | −$3,123 | −$2,855 | +$16,210 | −$2,037 | P,M,F |
| 174. `adx_30m_n7_adx_cross_t40_short_fixed12h` | 241/239 | −$6,103 | −$5,742 | 56/55 | −$3,652 | −$2,904 | +$16,180 | −$2,892 | P,M,F |
| 175. `adx_240m_n7_adx_peak_fade_t40_short_fixed12h` | 65/61 | −$6,193 | −$7,018 | 22/22 | −$4,663 | −$4,673 | +$16,089 | −$2,567 | P,M,F |
| 176. `adx_30m_n14_adx_peak_fade_t40_short_fixed12h` | 54/53 | −$6,236 | −$5,812 | 19/19 | −$2,933 | −$2,713 | +$16,046 | −$2,037 | P,M,F |
| 177. `adx_15m_n28_di_cross_t0_short_fixed12h` | 476/470 | −$6,280 | −$6,351 | 114/114 | −$6,023 | −$5,566 | +$16,003 | −$2,077 | P,M,F |
| 178. `adx_30m_n7_adx_peak_fade_t40_short_fixed12h` | 256/253 | −$6,446 | −$6,394 | 63/62 | −$2,949 | −$3,338 | +$15,837 | −$2,152 | P,M,F |
| 179. `adx_240m_n7_adx_peak_fade_t40_short_indicator_or12h` | 65/61 | −$6,518 | −$7,211 | 22/22 | −$4,750 | −$4,754 | +$15,765 | −$2,567 | P,M,F |
| 180. `adx_15m_n7_di_strong_t25_short_fixed12h` | 567/560 | −$6,930 | −$5,522 | 136/135 | −$588 | −$1,027 | +$15,353 | −$346 | P,M,F |
| 181. `adx_60m_n7_adx_peak_fade_t40_short_fixed12h` | 170/166 | −$6,947 | −$6,729 | 51/49 | −$5,076 | −$5,117 | +$15,336 | −$2,091 | P,M,F |
| 182. `adx_60m_n14_di_strong_t20_short_fixed12h` | 140/139 | −$7,031 | −$6,201 | 31/31 | −$1,298 | −$1,127 | +$15,252 | −$2,471 | P,M,F |
| 183. `adx_60m_n7_adx_peak_fade_t50_short_fixed12h` | 87/84 | −$7,366 | −$7,643 | 30/30 | −$2,918 | −$3,004 | +$14,917 | −$1,615 | P,M,F |
| 184. `adx_5m_n28_di_strong_t25_short_fixed12h` | 83/83 | −$7,720 | −$8,227 | 24/24 | −$2,439 | −$3,321 | +$14,562 | −$3,487 | P,M,F |
| 185. `adx_15m_n14_adx_peak_fade_t40_short_fixed12h` | 95/95 | −$7,874 | −$7,502 | 28/28 | −$3,610 | −$3,630 | +$14,409 | −$2,132 | P,M,F |
| 186. `adx_5m_n28_di_strong_t20_short_fixed12h` | 261/260 | −$7,884 | −$7,508 | 72/72 | −$2,920 | −$3,388 | +$14,398 | −$4,060 | P,M,F |
| 187. `adx_30m_n14_di_strong_t20_short_indicator_or12h` | 331/331 | −$7,940 | −$8,310 | 82/82 | −$1,914 | −$2,129 | +$14,342 | −$2,883 | P,M,F |
| 188. `adx_15m_n14_adx_cross_t25_short_fixed12h` | 277/276 | −$8,203 | −$8,242 | 67/67 | −$4,265 | −$3,936 | +$14,080 | −$1,849 | P,M,F |
| 189. `adx_5m_n7_di_strong_t40_short_fixed12h` | 324/324 | −$8,301 | −$7,499 | 83/83 | −$5,178 | −$5,167 | +$13,981 | −$1,854 | P,M,F |
| 190. `adx_5m_n7_adx_peak_fade_t50_short_fixed12h` | 451/448 | −$8,398 | −$9,018 | 113/113 | −$6,850 | −$6,769 | +$13,885 | −$1,093 | P,M,F |
| 191. `adx_15m_n14_adx_cross_t25_short_indicator_or12h` | 324/324 | −$8,680 | −$7,723 | 77/77 | −$2,820 | −$2,543 | +$13,603 | −$4,105 | P,M,F |
| 192. `adx_5m_n7_di_strong_t40_short_indicator_or12h` | 504/504 | −$8,961 | −$8,001 | 128/128 | −$2,929 | −$3,185 | +$13,321 | −$2,504 | P,M,F |
| 193. `adx_30m_n14_adx_cross_t25_short_indicator_or12h` | 175/174 | −$9,217 | −$8,595 | 43/43 | −$2,946 | −$2,786 | +$13,066 | −$3,114 | P,M,F |
| 194. `adx_30m_n7_di_strong_t25_short_indicator_or12h` | 623/623 | −$9,301 | −$7,104 | 167/167 | −$5,846 | −$4,919 | +$12,981 | −$2,925 | P,M,F |
| 195. `adx_60m_n7_adx_cross_t40_short_indicator_or12h` | 147/147 | −$9,493 | −$9,327 | 35/35 | −$551 | −$497 | +$12,789 | −$1,946 | P,M,F |
| 196. `adx_15m_n28_adx_cross_t20_short_fixed12h` | 152/152 | −$9,498 | −$9,633 | 37/37 | −$1,020 | −$1,013 | +$12,785 | −$2,625 | P,M,F |
| 197. `adx_5m_n7_adx_cross_t25_short_fixed12h` | 647/645 | −$9,550 | −$9,778 | 165/165 | −$3,387 | −$4,639 | +$12,733 | −$1,596 | P,M,F |
| 198. `adx_15m_n14_di_strong_t20_short_indicator_or12h` | 635/635 | −$9,878 | −$9,275 | 162/162 | −$2,929 | −$2,936 | +$12,405 | −$3,010 | P,M,F |
| 199. `adx_30m_n7_adx_cross_t25_short_indicator_or12h` | 345/345 | −$9,910 | −$8,762 | 84/84 | −$2,433 | −$2,289 | +$12,372 | −$2,178 | P,M,F |
| 200. `adx_15m_n28_adx_cross_t20_short_indicator_or12h` | 158/158 | −$9,994 | −$9,922 | 39/39 | −$1,771 | −$1,753 | +$12,288 | −$2,706 | P,M,F |
| 201. `adx_15m_n7_adx_peak_fade_t50_short_fixed12h` | 248/247 | −$10,195 | −$9,574 | 65/65 | −$2,806 | −$2,853 | +$12,087 | −$1,099 | P,M,F |
| 202. `adx_5m_n28_di_strong_t20_short_indicator_or12h` | 374/374 | −$10,408 | −$9,871 | 105/105 | −$3,764 | −$3,912 | +$11,874 | −$2,567 | P,M,F |
| 203. `adx_15m_n7_adx_peak_fade_t40_short_indicator_or12h` | 547/547 | −$10,460 | −$10,353 | 137/137 | −$4,583 | −$4,549 | +$11,823 | −$2,222 | P,M,F |
| 204. `adx_5m_n14_di_strong_t25_short_fixed12h` | 435/433 | −$10,460 | −$9,817 | 108/108 | −$3,069 | −$3,046 | +$11,822 | −$1,034 | P,M,F |
| 205. `adx_60m_n7_adx_cross_t40_short_fixed12h` | 146/145 | −$10,530 | −$11,025 | 35/34 | −$2,370 | −$2,444 | +$11,752 | −$1,844 | P,M,F |
| 206. `adx_15m_n7_adx_peak_fade_t40_short_fixed12h` | 391/386 | −$10,533 | −$9,324 | 97/97 | −$6,632 | −$7,140 | +$11,750 | −$1,366 | P,M,F |
| 207. `adx_15m_n14_di_cross_t0_short_fixed12h` | 585/580 | −$10,628 | −$10,773 | 149/147 | −$6,328 | −$6,518 | +$11,654 | −$1,099 | P,M,F |
| 208. `adx_5m_n14_di_strong_t20_short_fixed12h` | 620/617 | −$11,097 | −$11,278 | 157/155 | −$8,803 | −$8,867 | +$11,186 | −$1,198 | P,M,F |
| 209. `adx_30m_n14_di_strong_t20_short_fixed12h` | 257/254 | −$11,174 | −$11,225 | 65/64 | −$4,241 | −$4,502 | +$11,108 | −$2,508 | P,M,F |
| 210. `adx_5m_n7_adx_cross_t20_short_fixed12h` | 557/551 | −$11,246 | −$10,164 | 147/144 | −$5,341 | −$4,667 | +$11,037 | −$3,198 | P,M,F |
| 211. `adx_60m_n7_di_strong_t25_short_indicator_or12h` | 322/322 | −$11,376 | −$11,397 | 82/82 | −$4,585 | −$4,366 | +$10,906 | −$3,751 | P,M,F |
| 212. `adx_5m_n14_adx_cross_t40_short_fixed12h` | 256/256 | −$11,421 | −$11,091 | 58/58 | −$4,936 | −$4,736 | +$10,861 | −$3,327 | P,M,F |
| 213. `adx_30m_n14_adx_cross_t25_short_fixed12h` | 172/170 | −$11,504 | −$10,876 | 42/42 | −$2,737 | −$2,886 | +$10,779 | −$2,796 | P,M,F |
| 214. `adx_5m_n28_adx_cross_t25_short_indicator_or12h` | 277/277 | −$11,628 | −$13,719 | 65/65 | −$2,114 | −$1,897 | +$10,654 | −$5,451 | P,M,F |
| 215. `adx_15m_n7_adx_cross_t40_short_fixed12h` | 390/384 | −$11,640 | −$11,137 | 92/92 | −$4,058 | −$3,986 | +$10,643 | −$4,026 | P,M,F |
| 216. `adx_30m_n14_di_cross_t0_short_fixed12h` | 449/440 | −$12,177 | −$11,720 | 106/104 | −$3,863 | −$3,726 | +$10,106 | −$3,035 | P,M,F |
| 217. `adx_15m_n7_adx_cross_t20_short_indicator_or12h` | 423/423 | −$12,381 | −$11,644 | 108/108 | −$3,137 | −$2,795 | +$9,902 | −$2,741 | P,M,F |
| 218. `adx_15m_n7_adx_cross_t40_short_indicator_or12h` | 534/534 | −$12,381 | −$10,122 | 125/125 | −$2,576 | −$1,607 | +$9,901 | −$3,291 | P,M,F |
| 219. `adx_30m_n28_di_cross_t0_short_fixed12h` | 335/332 | −$12,394 | −$14,476 | 78/78 | −$3,059 | −$3,076 | +$9,888 | −$2,319 | P,M,F |
| 220. `adx_5m_n28_adx_cross_t20_short_fixed12h` | 348/347 | −$12,461 | −$11,392 | 86/86 | −$4,396 | −$3,745 | +$9,822 | −$2,758 | P,M,F |
| 221. `adx_60m_n14_di_cross_t0_short_fixed12h` | 298/293 | −$12,464 | −$11,950 | 65/64 | −$707 | −$1,373 | +$9,818 | −$3,781 | P,M,F |
| 222. `adx_15m_n7_di_strong_t20_short_fixed12h` | 650/643 | −$13,019 | −$13,646 | 165/163 | −$5,149 | −$4,513 | +$9,264 | −$819 | P,M,F |
| 223. `adx_15m_n14_adx_cross_t20_short_fixed12h` | 305/300 | −$13,036 | −$12,753 | 71/71 | −$2,862 | −$2,770 | +$9,247 | −$3,875 | P,M,F |
| 224. `adx_5m_n14_adx_cross_t40_short_indicator_or12h` | 331/331 | −$13,059 | −$15,795 | 74/74 | −$1,812 | −$1,677 | +$9,223 | −$7,624 | P,M,F |
| 225. `adx_30m_n7_adx_cross_t25_short_fixed12h` | 280/278 | −$13,107 | −$11,836 | 71/70 | −$7,933 | −$7,433 | +$9,176 | −$3,857 | P,M,F |
| 226. `adx_60m_n14_di_cross_t0_short_indicator_or12h` | 417/417 | −$13,119 | −$12,748 | 98/98 | −$2,690 | −$2,662 | +$9,164 | −$4,303 | P,M,F |
| 227. `adx_30m_n7_di_cross_t0_short_fixed12h` | 564/553 | −$13,127 | −$9,652 | 140/137 | −$3,971 | −$3,014 | +$9,156 | −$2,326 | P,M,F |
| 228. `adx_5m_n28_adx_cross_t25_short_fixed12h` | 239/239 | −$13,316 | −$12,449 | 59/59 | −$4,082 | −$4,048 | +$8,967 | −$2,853 | P,M,F |
| 229. `adx_30m_n28_di_cross_t0_short_indicator_or12h` | 602/602 | −$13,558 | −$12,900 | 147/147 | −$3,569 | −$3,286 | +$8,725 | −$3,375 | P,M,F |
| 230. `adx_5m_n14_di_strong_t25_short_indicator_or12h` | 810/810 | −$14,085 | −$13,147 | 214/214 | −$4,109 | −$4,918 | +$8,197 | −$2,605 | P,M,F |
| 231. `adx_15m_n7_adx_cross_t25_short_fixed12h` | 427/423 | −$14,175 | −$13,487 | 107/106 | −$6,966 | −$6,175 | +$8,108 | −$3,018 | P,M,F |
| 232. `adx_5m_n14_adx_cross_t25_short_fixed12h` | 516/513 | −$14,245 | −$13,569 | 125/125 | −$3,719 | −$4,277 | +$8,037 | −$2,575 | P,M,F |
| 233. `adx_15m_n7_adx_cross_t25_short_indicator_or12h` | 695/695 | −$14,269 | −$12,485 | 173/173 | −$5,058 | −$4,232 | +$8,014 | −$4,185 | P,M,F |
| 234. `adx_15m_n14_adx_cross_t20_short_indicator_or12h` | 395/395 | −$14,481 | −$13,735 | 88/88 | −$3,617 | −$3,694 | +$7,802 | −$2,828 | P,M,F |
| 235. `adx_5m_n28_adx_cross_t20_short_indicator_or12h` | 463/463 | −$14,655 | −$12,320 | 111/111 | −$4,089 | −$3,148 | +$7,628 | −$3,668 | P,M,F |
| 236. `adx_60m_n7_di_strong_t25_short_fixed12h` | 273/265 | −$14,679 | −$14,813 | 67/66 | −$6,106 | −$5,761 | +$7,604 | −$3,195 | P,M,F |
| 237. `adx_15m_n7_adx_cross_t20_short_fixed12h` | 298/298 | −$15,192 | −$15,033 | 81/81 | −$5,263 | −$5,284 | +$7,091 | −$2,334 | P,M,F |
| 238. `adx_60m_n7_di_strong_t20_short_indicator_or12h` | 492/492 | −$15,251 | −$14,999 | 119/119 | −$6,223 | −$5,715 | +$7,031 | −$3,619 | P,M,F |
| 239. `adx_5m_n7_adx_peak_fade_t40_short_indicator_or12h` | 1601/1601 | −$15,716 | −$16,869 | 415/415 | −$3,864 | −$3,954 | +$6,567 | −$2,648 | P,M,F |
| 240. `adx_5m_n28_di_cross_t0_short_fixed12h` | 682/678 | −$16,222 | −$14,872 | 173/173 | −$7,037 | −$7,032 | +$6,061 | −$1,427 | P,M,F |
| 241. `adx_30m_n14_di_cross_t0_short_indicator_or12h` | 876/876 | −$16,368 | −$16,929 | 211/211 | −$5,787 | −$6,068 | +$5,915 | −$3,892 | P,M,F |
| 242. `adx_30m_n7_di_strong_t20_short_indicator_or12h` | 968/968 | −$16,789 | −$13,931 | 243/243 | −$6,871 | −$5,997 | +$5,494 | −$3,577 | P,M,F |
| 243. `adx_60m_n7_di_strong_t20_short_fixed12h` | 359/346 | −$16,793 | −$18,053 | 84/83 | −$6,279 | −$6,683 | +$5,490 | −$4,285 | P,M,F |
| 244. `adx_5m_n7_di_strong_t25_long_fixed12h` | 730/726 | +$8,049 | +$5,497 | 188/187 | +$5,235 | +$3,544 | +$4,744 | −$1,829 | C,M,F |
| 245. `adx_5m_n14_adx_cross_t20_short_fixed12h` | 536/532 | −$18,193 | −$18,003 | 127/126 | −$2,671 | −$2,380 | +$4,090 | −$3,065 | P,M,F |
| 246. `adx_240m_n7_di_strong_t20_long_fixed12h` | 115/112 | +$6,852 | +$6,363 | 31/30 | +$3,174 | +$2,836 | +$3,547 | −$4,656 | C,M |
| 247. `adx_15m_n28_adx_cross_t25_long_fixed12h` | 77/77 | +$6,687 | +$6,380 | 22/22 | +$2,891 | +$2,801 | +$3,383 | −$3,064 | C,M |
| 248. `adx_240m_n7_di_cross_t0_long_fixed12h` | 156/147 | +$6,639 | +$4,491 | 36/34 | +$3,127 | +$2,827 | +$3,334 | −$4,656 | C,M |
| 249. `adx_15m_n28_di_cross_t0_short_indicator_or12h` | 1180/1180 | −$19,375 | −$19,086 | 290/290 | −$7,727 | −$7,272 | +$2,907 | −$2,486 | P,M,F |
| 250. `adx_5m_n7_adx_peak_fade_t40_short_fixed12h` | 612/606 | −$19,521 | −$18,058 | 153/153 | −$9,195 | −$8,242 | +$2,762 | −$2,366 | P,M,F |
| 251. `adx_5m_n7_di_strong_t25_short_fixed12h` | 730/727 | −$19,758 | −$18,540 | 185/184 | −$8,870 | −$8,594 | +$2,524 | −$1,613 | P,M,F |
| 252. `adx_240m_n7_di_cross_t0_long_indicator_or12h` | 161/161 | +$5,752 | +$5,606 | 36/36 | +$3,394 | +$3,500 | +$2,447 | −$4,656 | C,M |
| 253. `adx_60m_n7_di_cross_t0_short_indicator_or12h` | 661/661 | −$19,998 | −$19,379 | 161/161 | −$6,506 | −$6,037 | +$2,285 | −$4,311 | P,M,F |
| 254. `adx_60m_n14_adx_cross_t25_long_fixed12h` | 85/85 | +$5,491 | +$5,495 | 20/20 | +$2,388 | +$2,409 | +$2,187 | −$4,591 | C,M |
| 255. `adx_240m_n7_di_strong_t20_long_indicator_or12h` | 119/119 | +$5,473 | +$5,391 | 31/31 | +$3,144 | +$3,198 | +$2,168 | −$4,656 | C,M |
| 256. `adx_60m_n7_di_cross_t0_short_fixed12h` | 418/400 | −$20,116 | −$19,043 | 99/96 | −$5,469 | −$5,521 | +$2,166 | −$3,884 | P,M,F |
| 257. `adx_15m_n28_adx_cross_t25_long_indicator_or12h` | 77/77 | +$5,310 | +$5,274 | 22/22 | +$2,365 | +$2,282 | +$2,005 | −$3,341 | C,M |
| 258. `adx_240m_n7_di_strong_t25_long_fixed12h` | 83/82 | +$4,801 | +$4,923 | 22/22 | +$921 | +$1,006 | +$1,496 | −$4,656 | C,M |
| 259. `adx_15m_n7_adx_peak_fade_t50_long_fixed12h` | 262/261 | +$4,719 | +$4,814 | 62/62 | +$2,506 | +$2,461 | +$1,414 | −$5,591 | C,M |
| 260. `adx_15m_n14_adx_cross_t40_long_fixed12h` | 95/95 | +$4,672 | +$4,807 | 26/26 | +$2,561 | +$2,528 | +$1,368 | −$3,280 | C,M |
| 261. `adx_15m_n28_adx_cross_t20_long_indicator_or12h` | 139/138 | +$4,624 | +$4,492 | 39/39 | +$2,511 | +$2,566 | +$1,319 | −$4,375 | C,M |
| 262. `adx_15m_n7_di_strong_t40_long_fixed12h` | 153/153 | +$4,622 | +$4,930 | 35/35 | +$1,392 | +$1,443 | +$1,317 | −$5,273 | C,M |
| 263. `adx_5m_n28_di_strong_t25_long_fixed12h` | 80/80 | +$4,547 | +$4,831 | 19/19 | +$1,060 | +$1,040 | +$1,243 | −$5,232 | C,M |
| 264. `adx_30m_n14_adx_cross_t40_long_indicator_or12h` | 49/49 | +$4,545 | +$4,511 | 16/16 | +$1,466 | +$1,514 | +$1,241 | −$4,179 | C,M |
| 265. `adx_60m_n14_adx_cross_t25_long_indicator_or12h` | 85/85 | +$4,469 | +$4,892 | 20/20 | +$1,418 | +$1,703 | +$1,165 | −$4,591 | C,M |
| 266. `adx_60m_n7_adx_cross_t40_long_fixed12h` | 141/141 | +$4,361 | +$4,435 | 39/39 | +$3,328 | +$3,219 | +$1,057 | −$3,824 | C,M |
| 267. `adx_60m_n7_di_cross_t0_long_fixed12h` | 418/400 | +$4,351 | +$5,050 | 101/97 | +$5,651 | +$5,612 | +$1,046 | −$2,556 | M |
| 268. `adx_5m_n14_di_cross_t0_short_fixed12h` | 752/745 | −$21,362 | −$21,532 | 189/188 | −$10,052 | −$9,283 | +$920 | −$1,280 | P,C,M,F |
| 269. `adx_30m_n28_di_strong_t20_long_fixed12h` | 57/57 | +$4,180 | +$4,225 | 16/16 | +$2,315 | +$2,272 | +$876 | −$4,447 | C,M |
| 270. `adx_5m_n7_adx_peak_fade_t40_long_fixed12h` | 636/635 | +$4,125 | +$4,250 | 159/159 | +$2,510 | +$3,305 | +$821 | −$3,269 | C,M,F |
| 271. `adx_5m_n28_di_strong_t20_long_fixed12h` | 251/250 | +$4,106 | +$4,386 | 67/67 | +$4,352 | +$4,738 | +$802 | −$4,391 | C,M |
| 272. `adx_30m_n14_adx_cross_t40_long_fixed12h` | 49/49 | +$3,773 | +$3,933 | 16/16 | +$1,148 | +$1,268 | +$468 | −$4,198 | C,M |
| 273. `adx_60m_n14_adx_cross_t20_long_indicator_or12h` | 92/92 | +$3,753 | +$4,062 | 21/21 | +$22 | −$17 | +$448 | −$5,448 | P,C,M,F |
| 274. `adx_15m_n7_adx_peak_fade_t40_long_fixed12h` | 409/406 | +$3,743 | +$4,148 | 99/99 | +$3,759 | +$4,195 | +$438 | −$3,121 | C,M,F |
| 275. `adx_15m_n14_adx_cross_t40_long_indicator_or12h` | 96/96 | +$3,729 | +$4,603 | 26/26 | +$1,785 | +$1,938 | +$424 | −$5,198 | C,M |
| 276. `adx_30m_n14_di_cross_t0_long_fixed12h` | 439/431 | +$3,656 | +$3,670 | 107/103 | +$4,176 | +$4,147 | +$352 | −$3,128 | C,M,F |
| 277. `adx_15m_n7_di_cross_t0_short_fixed12h` | 684/676 | −$22,020 | −$20,198 | 173/171 | −$9,405 | −$7,622 | +$262 | −$2,531 | P,M,F |
| 278. `adx_30m_n14_adx_cross_t25_long_indicator_or12h` | 182/181 | +$3,500 | +$3,297 | 47/47 | +$1,837 | +$1,677 | +$195 | −$3,911 | C,M |
| 279. `adx_5m_n28_adx_cross_t40_long_fixed12h` | 17/17 | +$3,378 | +$3,277 | 5/5 | +$2,028 | +$2,073 | +$73 | −$4,366 | N,C,M |
| 280. `adx_30m_n28_adx_cross_t25_long_indicator_or12h` | 49/49 | +$3,369 | +$3,089 | 16/16 | +$2,197 | +$1,988 | +$64 | −$4,231 | C,M |
| 281. `adx_5m_n14_adx_cross_t20_short_indicator_or12h` | 1106/1106 | −$22,241 | −$18,479 | 269/269 | −$5,719 | −$4,713 | +$42 | −$4,028 | P,M,F |
| 282. `adx_30m_n28_adx_cross_t25_long_fixed12h` | 49/49 | +$3,341 | +$3,106 | 16/16 | +$1,948 | +$1,735 | +$37 | −$4,231 | C,M |
| 283. `adx_5m_n7_di_cross_t0_short_fixed12h` | 794/791 | −$22,248 | −$20,452 | 202/201 | −$7,773 | −$7,304 | +$35 | −$1,119 | P,M,F |
| 284. `adx_15m_n7_di_strong_t25_short_indicator_or12h` | 1247/1247 | −$22,307 | −$21,815 | 303/303 | −$6,022 | −$5,980 | −$24 | −$2,916 | P,C,M,F |
| 285. `adx_60m_n7_di_strong_t25_long_fixed12h` | 270/264 | +$3,256 | +$1,614 | 66/64 | +$6,665 | +$6,103 | −$48 | −$4,439 | C,M,F |
| 286. `adx_5m_n14_adx_peak_fade_t40_long_fixed12h` | 259/257 | +$3,203 | +$3,016 | 59/57 | +$1,369 | +$1,092 | −$102 | −$4,916 | C,M |
| 287. `adx_60m_n7_di_strong_t20_long_fixed12h` | 355/343 | +$3,161 | +$2,418 | 86/83 | +$6,386 | +$5,913 | −$143 | −$4,182 | C,M,F |
| 288. `adx_60m_n14_adx_cross_t20_long_fixed12h` | 92/92 | +$3,119 | +$3,496 | 21/21 | −$481 | −$460 | −$185 | −$5,812 | P,C,M,F |
| 289. `adx_5m_n7_adx_cross_t20_short_indicator_or12h` | 1431/1431 | −$22,471 | −$21,006 | 395/395 | −$8,769 | −$8,300 | −$188 | −$4,112 | P,C,M,F |
| 290. `adx_5m_n28_adx_cross_t40_long_indicator_or12h` | 17/17 | +$3,076 | +$3,182 | 5/5 | +$2,018 | +$2,066 | −$229 | −$4,864 | N,C,M |
| 291. `adx_60m_n7_adx_cross_t40_long_indicator_or12h` | 145/145 | +$2,968 | +$2,878 | 41/41 | +$1,188 | +$985 | −$336 | −$5,869 | C,M |
| 292. `adx_30m_n28_di_strong_t20_long_indicator_or12h` | 75/75 | +$2,954 | +$3,213 | 22/22 | +$1,808 | +$1,841 | −$350 | −$4,380 | C,M |
| 293. `adx_5m_n7_di_strong_t40_long_fixed12h` | 354/354 | +$2,868 | +$2,792 | 86/86 | +$2,127 | +$2,023 | −$436 | −$4,543 | C,M,F |
| 294. `adx_5m_n14_di_cross_t0_long_fixed12h` | 750/747 | +$2,830 | +$4,138 | 191/190 | +$4,873 | +$4,582 | −$474 | −$2,018 | C,M,F |
| 295. `adx_240m_n7_di_strong_t25_long_indicator_or12h` | 84/84 | +$2,680 | +$2,680 | 22/22 | +$805 | +$887 | −$624 | −$4,656 | C,M |
| 296. `adx_60m_n28_adx_cross_t40_long_fixed12h` | 5/5 | +$2,650 | +$2,717 | 2/2 | +$752 | +$777 | −$655 | −$5,268 | N,C,M |
| 297. `adx_60m_n28_adx_cross_t40_long_indicator_or12h` | 5/5 | +$2,650 | +$2,717 | 2/2 | +$752 | +$777 | −$655 | −$5,268 | N,C,M |
| 298. `adx_30m_n7_adx_cross_t20_long_fixed12h` | 182/178 | +$2,611 | +$3,015 | 48/48 | +$1,217 | +$1,290 | −$693 | −$4,817 | C,M |
| 299. `adx_15m_n28_adx_cross_t40_long_fixed12h` | 14/14 | +$2,607 | +$2,531 | 3/3 | +$642 | +$579 | −$697 | −$4,833 | N,C,M |
| 300. `adx_5m_n14_di_strong_t25_long_fixed12h` | 450/447 | +$2,539 | +$3,577 | 115/115 | +$5,989 | +$6,159 | −$765 | −$3,256 | C,M,F |
| 301. `adx_5m_n7_adx_peak_fade_t50_long_fixed12h` | 494/494 | +$2,436 | +$3,737 | 119/119 | +$1,757 | +$2,190 | −$869 | −$6,960 | C,M,F |
| 302. `adx_15m_n7_adx_peak_fade_t50_long_indicator_or12h` | 314/314 | +$2,426 | +$1,652 | 75/75 | +$1,183 | +$969 | −$878 | −$5,654 | C,M,F |
| 303. `adx_240m_n28_adx_cross_t20_long_fixed12h` | 12/12 | +$2,296 | +$2,264 | 3/3 | +$771 | +$827 | −$1,009 | −$5,524 | N,C,M |
| 304. `adx_240m_n28_adx_cross_t20_long_indicator_or12h` | 12/12 | +$2,296 | +$2,264 | 3/3 | +$771 | +$827 | −$1,009 | −$5,524 | N,C,M |
| 305. `adx_30m_n14_di_strong_t20_long_fixed12h` | 243/241 | +$2,295 | +$2,608 | 63/63 | +$1,884 | +$1,990 | −$1,009 | −$3,648 | C,M,F |
| 306. `adx_5m_n7_adx_cross_t40_short_fixed12h` | 609/607 | −$23,442 | −$20,885 | 152/151 | −$6,658 | −$5,860 | −$1,160 | −$3,049 | P,C,M,F |
| 307. `adx_15m_n28_adx_cross_t40_long_indicator_or12h` | 14/14 | +$2,093 | +$2,062 | 3/3 | +$642 | +$633 | −$1,211 | −$4,833 | N,C,M |
| 308. `adx_30m_n14_adx_cross_t20_long_fixed12h` | 172/170 | +$2,042 | +$1,301 | 45/45 | +$81 | +$65 | −$1,263 | −$4,301 | C,M,F |
| 309. `adx_5m_n7_di_strong_t20_short_fixed12h` | 783/778 | −$23,602 | −$25,028 | 200/197 | −$10,887 | −$10,777 | −$1,319 | −$1,878 | P,C,M,F |
| 310. `adx_60m_n14_di_strong_t20_long_fixed12h` | 134/134 | +$1,681 | +$1,784 | 34/34 | +$3,001 | +$3,301 | −$1,624 | −$3,235 | C,M |
| 311. `adx_240m_n14_adx_cross_t25_long_fixed12h` | 23/23 | +$1,545 | +$1,553 | 8/8 | +$1,118 | +$1,176 | −$1,760 | −$5,927 | N,C,M |
| 312. `adx_240m_n14_adx_cross_t25_long_indicator_or12h` | 23/23 | +$1,545 | +$1,556 | 8/8 | +$1,118 | +$1,176 | −$1,760 | −$5,927 | N,C,M |
| 313. `adx_30m_n14_adx_cross_t20_long_indicator_or12h` | 183/183 | +$1,532 | +$1,311 | 47/47 | +$1,684 | +$1,611 | −$1,772 | −$4,128 | C,M,F |
| 314. `adx_60m_n28_adx_cross_t20_long_fixed12h` | 42/41 | +$1,445 | +$1,643 | 14/14 | −$325 | −$297 | −$1,859 | −$5,769 | P,C,M,F |
| 315. `adx_240m_n14_di_cross_t0_long_fixed12h` | 111/103 | +$1,417 | +$1,964 | 22/21 | −$472 | −$494 | −$1,887 | −$5,038 | P,C,M,F |
| 316. `adx_30m_n28_adx_cross_t20_long_indicator_or12h` | 77/77 | +$1,389 | +$1,011 | 20/20 | +$2,040 | +$1,910 | −$1,915 | −$4,079 | C,M |
| 317. `adx_240m_n14_adx_cross_t20_long_fixed12h` | 23/23 | +$1,379 | +$1,347 | 6/6 | −$340 | −$435 | −$1,926 | −$5,864 | N,P,C,M,F |
| 318. `adx_240m_n14_adx_cross_t20_long_indicator_or12h` | 23/23 | +$1,379 | +$1,347 | 6/6 | −$340 | −$435 | −$1,926 | −$5,864 | N,P,C,M,F |
| 319. `adx_30m_n28_di_strong_t25_long_fixed12h` | 18/18 | +$1,367 | +$1,317 | 3/3 | +$979 | +$910 | −$1,938 | −$5,831 | N,C,M |
| 320. `adx_60m_n28_adx_cross_t20_long_indicator_or12h` | 42/41 | +$1,348 | +$1,593 | 14/14 | −$450 | −$382 | −$1,957 | −$5,769 | P,C,M,F |
| 321. `adx_30m_n7_adx_cross_t40_long_indicator_or12h` | 270/269 | +$1,287 | +$2,165 | 64/63 | +$1,704 | +$1,615 | −$2,017 | −$4,190 | C,M,F |
| 322. `adx_15m_n14_adx_peak_fade_t50_long_indicator_or12h` | 39/39 | +$1,245 | +$1,138 | 10/10 | +$84 | +$75 | −$2,060 | −$5,977 | C,M,F |
| 323. `adx_240m_n14_di_cross_t0_long_indicator_or12h` | 114/114 | +$1,153 | +$1,197 | 22/22 | −$363 | −$344 | −$2,151 | −$4,973 | P,C,M,F |
| 324. `adx_15m_n14_adx_peak_fade_t40_long_indicator_or12h` | 113/113 | +$1,152 | +$1,059 | 26/26 | −$491 | −$429 | −$2,152 | −$6,123 | P,C,M,F |
| 325. `adx_240m_n7_adx_cross_t25_long_indicator_or12h` | 41/41 | +$1,121 | +$943 | 10/10 | +$959 | +$965 | −$2,184 | −$5,316 | C,M |
| 326. `adx_15m_n14_adx_cross_t25_long_indicator_or12h` | 309/309 | +$1,072 | +$2,004 | 82/82 | +$1,660 | +$1,686 | −$2,232 | −$5,199 | C,M,F |
| 327. `adx_30m_n28_adx_cross_t20_long_fixed12h` | 77/76 | +$1,059 | +$782 | 20/19 | +$2,118 | +$2,209 | −$2,245 | −$4,079 | C,M |
| 328. `adx_240m_n7_adx_cross_t25_long_fixed12h` | 41/41 | +$1,019 | +$869 | 10/10 | +$959 | +$965 | −$2,286 | −$5,316 | C,M |
| 329. `adx_5m_n28_adx_peak_fade_t50_long_fixed12h` | 1/1 | +$867 | +$831 | 0/0 | $0 | $0 | −$2,438 | −$5,789 | N,P,C,M,F |
| 330. `adx_30m_n28_adx_cross_t40_long_fixed12h` | 7/7 | +$849 | +$953 | 3/3 | +$228 | +$248 | −$2,456 | −$5,356 | N,C,M |
| 331. `adx_30m_n28_adx_cross_t40_long_indicator_or12h` | 7/7 | +$849 | +$953 | 3/3 | +$228 | +$248 | −$2,456 | −$5,356 | N,C,M |
| 332. `adx_60m_n14_di_cross_t0_long_fixed12h` | 284/276 | +$801 | +$1,434 | 69/68 | +$3,059 | +$3,064 | −$2,504 | −$3,635 | C,M,F |
| 333. `adx_30m_n7_adx_cross_t20_long_indicator_or12h` | 222/222 | +$706 | +$1,641 | 64/64 | +$693 | +$967 | −$2,599 | −$4,533 | C,M,F |
| 334. `adx_60m_n28_di_strong_t25_long_indicator_or12h` | 6/6 | +$705 | +$797 | 1/1 | +$12 | +$21 | −$2,600 | −$4,554 | N,C,M |
| 335. `adx_5m_n14_adx_peak_fade_t50_long_fixed12h` | 83/83 | +$631 | +$745 | 19/19 | +$184 | +$426 | −$2,674 | −$5,583 | C,M,F |
| 336. `adx_60m_n14_adx_cross_t40_long_fixed12h` | 37/37 | +$594 | +$699 | 14/14 | +$494 | +$562 | −$2,711 | −$5,013 | C,M |
| 337. `adx_5m_n28_adx_peak_fade_t40_long_fixed12h` | 34/34 | +$587 | +$480 | 8/8 | +$117 | +$2 | −$2,718 | −$6,125 | N,C,M,F |
| 338. `adx_30m_n14_adx_cross_t25_long_fixed12h` | 173/172 | +$512 | −$908 | 46/46 | +$253 | +$243 | −$2,793 | −$4,739 | P,C,M,F |
| 339. `adx_5m_n28_adx_peak_fade_t40_long_indicator_or12h` | 34/34 | +$472 | +$378 | 8/8 | +$220 | +$195 | −$2,833 | −$5,947 | N,C,M |
| 340. `adx_240m_n28_di_cross_t0_long_fixed12h` | 75/69 | +$442 | +$1,409 | 15/14 | −$1,147 | −$1,472 | −$2,862 | −$4,949 | P,C,M,F |
| 341. `adx_5m_n28_di_cross_t0_long_fixed12h` | 680/676 | +$362 | +$973 | 170/169 | +$1,224 | +$517 | −$2,942 | −$2,051 | C,M,F |
| 342. `adx_240m_n28_di_cross_t0_long_indicator_or12h` | 77/77 | +$355 | +$88 | 15/15 | −$1,334 | −$1,297 | −$2,950 | −$4,889 | P,C,M,F |
| 343. `adx_60m_n28_adx_cross_t25_long_fixed12h` | 28/27 | +$325 | +$481 | 10/10 | +$61 | +$41 | −$2,979 | −$6,063 | N,C,M,F |
| 344. `adx_5m_n28_adx_peak_fade_t50_long_indicator_or12h` | 1/1 | +$300 | +$201 | 0/0 | $0 | $0 | −$3,005 | −$5,789 | N,P,C,M,F |
| 345. `adx_60m_n28_adx_cross_t25_long_indicator_or12h` | 28/27 | +$243 | +$391 | 10/10 | +$61 | +$41 | −$3,061 | −$6,063 | N,C,M,F |
| 346. `adx_60m_n7_di_strong_t25_long_indicator_or12h` | 313/313 | +$234 | +$1,241 | 77/77 | +$2,266 | +$2,596 | −$3,071 | −$3,915 | C,M,F |
| 347. `adx_5m_n28_di_strong_t40_long_fixed12h` | 2/2 | +$233 | +$312 | 0/0 | $0 | $0 | −$3,072 | −$5,789 | N,P,C,M,F |
| 348. `adx_240m_n7_adx_peak_fade_t50_long_fixed12h` | 30/28 | +$188 | +$12 | 7/6 | −$365 | −$458 | −$3,116 | −$4,554 | N,P,C,M,F |
| 349. `adx_240m_n7_di_strong_t40_long_fixed12h` | 8/8 | +$179 | +$205 | 2/2 | −$345 | −$343 | −$3,125 | −$4,867 | N,P,C,M,F |
| 350. `adx_5m_n14_di_strong_t40_long_indicator_or12h` | 28/28 | +$149 | +$740 | 11/11 | +$764 | +$997 | −$3,155 | −$5,809 | N,C,M,F |
| 351. `adx_30m_n28_adx_peak_fade_t50_long_fixed12h` | 1/1 | +$107 | +$132 | 0/0 | $0 | $0 | −$3,198 | −$5,789 | N,P,C,M,F |
| 352. `adx_30m_n28_adx_peak_fade_t50_long_indicator_or12h` | 1/1 | +$107 | +$132 | 0/0 | $0 | $0 | −$3,198 | −$5,789 | N,P,C,M,F |
| 353. `adx_60m_n28_di_cross_t0_long_indicator_or12h` | 303/303 | +$55 | +$24 | 72/72 | +$1,523 | +$1,424 | −$3,250 | −$3,898 | C,M,F |
| 354. `adx_30m_n7_adx_cross_t40_long_fixed12h` | 242/237 | +$47 | +$462 | 59/56 | +$767 | +$694 | −$3,258 | −$5,089 | C,M,F |
| 355. `adx_60m_n14_di_strong_t25_long_fixed12h` | 65/65 | +$45 | +$135 | 18/18 | +$1,057 | +$1,216 | −$3,260 | −$4,305 | C,M,F |
| 356. `adx_240m_n7_adx_peak_fade_t50_long_indicator_or12h` | 30/28 | +$31 | −$232 | 7/6 | −$219 | −$456 | −$3,273 | −$4,880 | N,P,C,M,F |
| 357. `adx_240m_n14_adx_cross_t40_long_fixed12h` | 14/14 | +$29 | +$67 | 4/4 | +$791 | +$779 | −$3,275 | −$5,827 | N,C,M,F |
| 358. `adx_240m_n14_adx_cross_t40_long_indicator_or12h` | 14/14 | +$29 | +$67 | 4/4 | +$791 | +$779 | −$3,275 | −$5,827 | N,C,M,F |
| 359. `adx_5m_n14_di_strong_t40_long_fixed12h` | 28/28 | +$17 | +$204 | 11/11 | +$1,331 | +$1,441 | −$3,288 | −$5,179 | N,C,M,F |
| 360. `adx_15m_n28_adx_peak_fade_t50_long_fixed12h` | 1/1 | +$16 | −$11 | 0/0 | $0 | $0 | −$3,289 | −$5,789 | N,P,C,M,F |
| 361. `adx_15m_n28_adx_peak_fade_t50_long_indicator_or12h` | 1/1 | +$16 | −$11 | 0/0 | $0 | $0 | −$3,289 | −$5,789 | N,P,C,M,F |
| 362. `adx_15m_n28_di_strong_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 363. `adx_15m_n28_di_strong_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 364. `adx_30m_n28_di_strong_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 365. `adx_30m_n28_di_strong_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 366. `adx_60m_n28_di_strong_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 367. `adx_60m_n28_di_strong_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 368. `adx_240m_n14_di_strong_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 369. `adx_240m_n14_di_strong_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 370. `adx_240m_n28_di_strong_t25_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 371. `adx_240m_n28_di_strong_t25_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 372. `adx_240m_n28_di_strong_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 373. `adx_240m_n28_di_strong_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 374. `adx_240m_n28_adx_peak_fade_t40_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 375. `adx_240m_n28_adx_peak_fade_t40_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 376. `adx_240m_n28_adx_peak_fade_t50_long_fixed12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 377. `adx_240m_n28_adx_peak_fade_t50_long_indicator_or12h` | 0/0 | $0 | $0 | 0/0 | $0 | $0 | −$3,305 | −$5,789 | N,P,C,M,F |
| 378. `adx_5m_n7_adx_cross_t20_long_fixed12h` | 556/553 | −$22 | −$1,007 | 145/143 | +$2,928 | +$3,424 | −$3,327 | −$2,074 | P,C,M,F |
| 379. `adx_240m_n7_di_strong_t40_long_indicator_or12h` | 8/8 | −$36 | −$12 | 2/2 | −$416 | −$393 | −$3,340 | −$4,867 | N,P,C,M,F |
| 380. `adx_15m_n28_adx_cross_t20_long_fixed12h` | 136/135 | −$39 | −$489 | 38/38 | +$1,388 | +$1,372 | −$3,344 | −$4,259 | P,C,M,F |
| 381. `adx_5m_n14_adx_cross_t25_short_indicator_or12h` | 1002/1002 | −$25,638 | −$22,911 | 237/237 | −$6,542 | −$5,904 | −$3,355 | −$2,853 | P,C,M,F |
| 382. `adx_60m_n28_di_strong_t20_long_fixed12h` | 34/34 | −$73 | +$68 | 11/11 | +$712 | +$649 | −$3,378 | −$4,586 | P,C,M,F |
| 383. `adx_60m_n28_di_strong_t25_long_fixed12h` | 6/6 | −$118 | −$95 | 1/1 | +$12 | +$21 | −$3,423 | −$4,554 | N,P,C,M,F |
| 384. `adx_60m_n7_adx_peak_fade_t50_long_indicator_or12h` | 83/82 | −$172 | +$66 | 17/17 | −$414 | −$396 | −$3,477 | −$5,511 | P,C,M,F |
| 385. `adx_60m_n14_di_strong_t40_long_indicator_or12h` | 4/4 | −$208 | −$233 | 0/0 | $0 | $0 | −$3,513 | −$5,836 | N,P,C,M,F |
| 386. `adx_30m_n7_adx_peak_fade_t50_long_indicator_or12h` | 155/155 | −$218 | +$57 | 39/39 | −$920 | −$737 | −$3,522 | −$6,158 | P,C,M,F |
| 387. `adx_60m_n7_di_strong_t40_long_fixed12h` | 50/50 | −$224 | −$343 | 12/12 | +$1,842 | +$1,786 | −$3,528 | −$4,912 | P,C,M,F |
| 388. `adx_60m_n14_di_strong_t40_long_fixed12h` | 4/4 | −$248 | −$395 | 0/0 | $0 | $0 | −$3,552 | −$5,883 | N,P,C,M,F |
| 389. `adx_30m_n28_di_strong_t25_long_indicator_or12h` | 21/21 | −$250 | −$267 | 4/4 | +$688 | +$611 | −$3,555 | −$5,664 | N,P,C,M,F |
| 390. `adx_5m_n28_di_strong_t40_long_indicator_or12h` | 3/3 | −$275 | −$142 | 0/0 | $0 | $0 | −$3,580 | −$5,789 | N,P,C,M,F |
| 391. `adx_240m_n14_di_strong_t25_long_fixed12h` | 15/15 | −$316 | −$308 | 4/4 | −$450 | −$435 | −$3,621 | −$4,867 | N,P,C,M,F |
| 392. `adx_240m_n28_adx_cross_t40_long_fixed12h` | 2/2 | −$332 | −$399 | 2/2 | −$332 | −$399 | −$3,636 | −$6,150 | N,P,C,M,F |
| 393. `adx_240m_n28_adx_cross_t40_long_indicator_or12h` | 2/2 | −$332 | −$399 | 2/2 | −$332 | −$399 | −$3,636 | −$6,150 | N,P,C,M,F |
| 394. `adx_240m_n7_adx_cross_t20_long_fixed12h` | 24/24 | −$333 | −$381 | 4/4 | −$667 | −$639 | −$3,637 | −$6,016 | N,P,C,M,F |
| 395. `adx_15m_n7_adx_peak_fade_t40_long_indicator_or12h` | 565/565 | −$362 | −$869 | 132/132 | +$489 | +$6 | −$3,667 | −$5,398 | P,C,M,F |
| 396. `adx_60m_n28_di_strong_t20_long_indicator_or12h` | 38/38 | −$418 | −$335 | 13/13 | −$709 | −$780 | −$3,723 | −$4,857 | P,C,M,F |
| 397. `adx_15m_n14_di_strong_t40_long_indicator_or12h` | 12/12 | −$433 | −$375 | 3/3 | −$117 | −$85 | −$3,738 | −$5,789 | N,P,C,M,F |
| 398. `adx_60m_n28_adx_peak_fade_t50_long_fixed12h` | 3/3 | −$435 | −$383 | 0/0 | $0 | $0 | −$3,739 | −$5,789 | N,P,C,M,F |
| 399. `adx_60m_n28_adx_peak_fade_t50_long_indicator_or12h` | 3/3 | −$435 | −$383 | 0/0 | $0 | $0 | −$3,739 | −$5,789 | N,P,C,M,F |
| 400. `adx_240m_n7_adx_cross_t20_long_indicator_or12h` | 24/24 | −$441 | −$483 | 4/4 | −$711 | −$698 | −$3,746 | −$6,013 | N,P,C,M,F |
| 401. `adx_60m_n14_adx_cross_t40_long_indicator_or12h` | 37/37 | −$447 | −$390 | 14/14 | −$75 | +$15 | −$3,751 | −$5,013 | P,C,M,F |
| 402. `adx_240m_n14_di_strong_t25_long_indicator_or12h` | 15/15 | −$453 | −$469 | 4/4 | −$450 | −$415 | −$3,757 | −$4,867 | N,P,C,M,F |
| 403. `adx_30m_n14_di_strong_t40_long_indicator_or12h` | 6/6 | −$499 | −$427 | 2/2 | −$143 | −$158 | −$3,804 | −$5,789 | N,P,C,M,F |
| 404. `adx_15m_n28_adx_peak_fade_t40_long_indicator_or12h` | 14/14 | −$507 | −$491 | 3/3 | +$419 | +$458 | −$3,811 | −$5,789 | N,P,C,M,F |
| 405. `adx_60m_n7_di_strong_t40_long_indicator_or12h` | 52/52 | −$585 | −$424 | 13/13 | +$1,263 | +$1,236 | −$3,889 | −$5,736 | P,C,M,F |
| 406. `adx_30m_n7_di_cross_t0_short_indicator_or12h` | 1317/1317 | −$26,173 | −$22,712 | 325/325 | −$10,076 | −$8,758 | −$3,891 | −$4,723 | P,C,M,F |
| 407. `adx_240m_n14_adx_peak_fade_t50_long_fixed12h` | 4/4 | −$588 | −$611 | 0/0 | $0 | $0 | −$3,893 | −$5,789 | N,P,C,M,F |
| 408. `adx_240m_n14_adx_peak_fade_t50_long_indicator_or12h` | 4/4 | −$588 | −$611 | 0/0 | $0 | $0 | −$3,893 | −$5,789 | N,P,C,M,F |
| 409. `adx_60m_n28_adx_peak_fade_t40_long_fixed12h` | 6/6 | −$601 | −$434 | 0/0 | $0 | $0 | −$3,906 | −$5,789 | N,P,C,M,F |
| 410. `adx_60m_n28_adx_peak_fade_t40_long_indicator_or12h` | 6/6 | −$601 | −$434 | 0/0 | $0 | $0 | −$3,906 | −$5,789 | N,P,C,M,F |
| 411. `adx_240m_n14_adx_peak_fade_t40_long_fixed12h` | 10/9 | −$620 | −$1,082 | 2/2 | −$552 | −$511 | −$3,924 | −$5,789 | N,P,C,M,F |
| 412. `adx_240m_n14_adx_peak_fade_t40_long_indicator_or12h` | 10/9 | −$620 | −$1,082 | 2/2 | −$552 | −$511 | −$3,924 | −$5,789 | N,P,C,M,F |
| 413. `adx_240m_n7_adx_peak_fade_t40_long_fixed12h` | 52/48 | −$620 | −$477 | 12/11 | −$1,327 | −$1,387 | −$3,925 | −$4,667 | P,C,M,F |
| 414. `adx_30m_n28_di_cross_t0_long_fixed12h` | 330/324 | −$682 | +$149 | 86/85 | +$1,527 | +$1,542 | −$3,986 | −$3,751 | P,C,M,F |
| 415. `adx_240m_n7_adx_cross_t40_long_indicator_or12h` | 42/41 | −$727 | −$608 | 12/12 | +$398 | +$383 | −$4,031 | −$5,548 | P,C,M,F |
| 416. `adx_5m_n14_adx_cross_t40_long_fixed12h` | 208/207 | −$744 | −$2,570 | 61/61 | +$555 | +$615 | −$4,049 | −$4,445 | P,C,M,F |
| 417. `adx_30m_n7_adx_peak_fade_t50_long_fixed12h` | 151/150 | −$786 | −$586 | 38/38 | −$1,353 | −$1,148 | −$4,091 | −$5,954 | P,C,M,F |
| 418. `adx_240m_n28_adx_cross_t25_long_fixed12h` | 8/8 | −$835 | −$830 | 2/2 | +$134 | +$133 | −$4,139 | −$5,894 | N,P,C,M,F |
| 419. `adx_240m_n28_adx_cross_t25_long_indicator_or12h` | 8/8 | −$835 | −$830 | 2/2 | +$134 | +$133 | −$4,139 | −$5,894 | N,P,C,M,F |
| 420. `adx_30m_n14_adx_peak_fade_t50_long_indicator_or12h` | 20/20 | −$844 | −$890 | 6/6 | +$90 | +$103 | −$4,149 | −$5,789 | N,P,C,M,F |
| 421. `adx_240m_n28_di_strong_t20_long_fixed12h` | 7/7 | −$886 | −$927 | 2/2 | −$601 | −$563 | −$4,191 | −$5,789 | N,P,C,M,F |
| 422. `adx_5m_n28_di_strong_t25_long_indicator_or12h` | 99/99 | −$895 | −$459 | 22/22 | −$927 | −$853 | −$4,199 | −$5,947 | P,C,M,F |
| 423. `adx_240m_n7_adx_cross_t40_long_fixed12h` | 42/41 | −$907 | −$754 | 12/12 | +$371 | +$362 | −$4,212 | −$5,548 | P,C,M,F |
| 424. `adx_240m_n28_di_strong_t20_long_indicator_or12h` | 7/7 | −$908 | −$864 | 2/2 | −$601 | −$542 | −$4,212 | −$5,789 | N,P,C,M,F |
| 425. `adx_5m_n14_adx_peak_fade_t50_long_indicator_or12h` | 89/89 | −$925 | −$945 | 21/21 | +$577 | +$625 | −$4,230 | −$5,855 | P,C,M,F |
| 426. `adx_5m_n14_di_strong_t20_long_fixed12h` | 616/613 | −$936 | −$1,114 | 159/158 | +$1,395 | −$256 | −$4,240 | −$2,820 | P,C,M,F |
| 427. `adx_60m_n7_adx_peak_fade_t40_long_fixed12h` | 167/166 | −$1,007 | −$928 | 39/39 | +$1,275 | +$1,588 | −$4,312 | −$5,736 | P,C,M,F |
| 428. `adx_240m_n7_adx_peak_fade_t40_long_indicator_or12h` | 52/48 | −$1,161 | −$1,120 | 12/11 | −$1,181 | −$1,385 | −$4,465 | −$4,667 | P,C,M,F |
| 429. `adx_60m_n7_adx_cross_t25_long_indicator_or12h` | 169/169 | −$1,192 | −$914 | 39/39 | +$1,063 | +$1,162 | −$4,496 | −$4,908 | P,C,M,F |
| 430. `adx_5m_n14_adx_peak_fade_t40_long_indicator_or12h` | 333/333 | −$1,248 | −$1,834 | 74/74 | −$1,271 | −$1,374 | −$4,553 | −$5,958 | P,C,M,F |
| 431. `adx_30m_n28_di_cross_t0_long_indicator_or12h` | 603/603 | −$1,261 | −$600 | 147/147 | +$1,494 | +$1,321 | −$4,565 | −$3,166 | P,C,M,F |
| 432. `adx_5m_n7_di_strong_t20_long_fixed12h` | 776/772 | −$1,275 | +$447 | 199/198 | +$5,528 | +$5,516 | −$4,580 | −$1,599 | P,C,M,F |
| 433. `adx_15m_n28_di_strong_t25_long_indicator_or12h` | 46/46 | −$1,293 | −$1,267 | 10/10 | −$501 | −$421 | −$4,597 | −$5,933 | P,C,M,F |
| 434. `adx_60m_n14_di_strong_t25_long_indicator_or12h` | 70/70 | −$1,293 | −$1,028 | 18/18 | +$646 | +$677 | −$4,598 | −$4,653 | P,C,M,F |
| 435. `adx_15m_n14_di_strong_t40_long_fixed12h` | 12/12 | −$1,369 | −$1,265 | 3/3 | −$87 | −$96 | −$4,674 | −$5,789 | N,P,C,M,F |
| 436. `adx_60m_n14_adx_peak_fade_t50_long_fixed12h` | 14/13 | −$1,447 | −$2,019 | 3/3 | −$713 | −$758 | −$4,752 | −$5,789 | N,P,C,M,F |
| 437. `adx_30m_n7_adx_cross_t25_long_indicator_or12h` | 340/340 | −$1,454 | −$0 | 90/90 | +$3,529 | +$4,189 | −$4,759 | −$3,354 | P,C,M,F |
| 438. `adx_30m_n28_adx_peak_fade_t40_long_fixed12h` | 10/10 | −$1,486 | −$1,545 | 2/2 | −$135 | −$159 | −$4,790 | −$5,789 | N,P,C,M,F |
| 439. `adx_30m_n14_di_strong_t40_long_fixed12h` | 6/6 | −$1,488 | −$1,504 | 2/2 | −$270 | −$274 | −$4,793 | −$5,789 | N,P,C,M,F |
| 440. `adx_30m_n28_adx_peak_fade_t40_long_indicator_or12h` | 10/10 | −$1,489 | −$1,568 | 2/2 | −$135 | −$159 | −$4,794 | −$5,789 | N,P,C,M,F |
| 441. `adx_60m_n7_adx_cross_t20_long_indicator_or12h` | 95/95 | −$1,540 | −$1,601 | 23/23 | −$1,040 | −$953 | −$4,844 | −$5,928 | P,C,M,F |
| 442. `adx_15m_n28_adx_peak_fade_t40_long_fixed12h` | 14/14 | −$1,544 | −$1,589 | 3/3 | +$278 | +$288 | −$4,848 | −$5,789 | N,P,C,M,F |
| 443. `adx_30m_n14_adx_peak_fade_t40_long_indicator_or12h` | 68/67 | −$1,545 | −$1,094 | 17/17 | −$2,440 | −$2,178 | −$4,850 | −$5,540 | P,C,M,F |
| 444. `adx_60m_n14_adx_peak_fade_t40_long_fixed12h` | 40/37 | −$1,608 | −$1,574 | 10/10 | +$158 | +$230 | −$4,912 | −$4,864 | P,C,M,F |
| 445. `adx_60m_n14_adx_peak_fade_t50_long_indicator_or12h` | 14/13 | −$1,609 | −$2,080 | 3/3 | −$713 | −$758 | −$4,914 | −$5,789 | N,P,C,M,F |
| 446. `adx_240m_n14_di_strong_t20_long_fixed12h` | 36/36 | −$1,655 | −$1,591 | 9/9 | −$335 | −$271 | −$4,959 | −$4,349 | N,P,C,M,F |
| 447. `adx_240m_n14_di_strong_t20_long_indicator_or12h` | 36/36 | −$1,678 | −$1,680 | 9/9 | −$332 | −$255 | −$4,983 | −$4,344 | N,P,C,M,F |
| 448. `adx_15m_n14_adx_peak_fade_t50_long_fixed12h` | 39/39 | −$1,698 | −$1,712 | 10/10 | −$873 | −$915 | −$5,003 | −$5,842 | P,C,M,F |
| 449. `adx_5m_n7_adx_cross_t40_long_fixed12h` | 590/589 | −$1,715 | −$2,671 | 150/150 | +$1,660 | +$1,788 | −$5,020 | −$3,550 | P,C,M,F |
| 450. `adx_60m_n7_adx_peak_fade_t40_long_indicator_or12h` | 168/167 | −$1,767 | −$1,616 | 39/39 | −$554 | −$468 | −$5,071 | −$5,796 | P,C,M,F |
| 451. `adx_5m_n7_di_cross_t0_long_fixed12h` | 793/788 | −$1,822 | −$2,700 | 203/201 | +$5,039 | +$5,101 | −$5,127 | −$2,636 | P,C,M,F |
| 452. `adx_30m_n7_adx_cross_t25_long_fixed12h` | 274/271 | −$1,881 | −$2,259 | 71/70 | +$3,315 | +$2,834 | −$5,186 | −$3,328 | P,C,M,F |
| 453. `adx_15m_n14_adx_cross_t25_long_fixed12h` | 259/259 | −$1,933 | −$1,211 | 68/68 | +$2,303 | +$2,318 | −$5,237 | −$5,339 | P,C,M,F |
| 454. `adx_30m_n7_adx_peak_fade_t40_long_fixed12h` | 263/259 | −$1,977 | −$2,841 | 65/65 | −$525 | −$639 | −$5,281 | −$6,702 | P,C,M,F |
| 455. `adx_60m_n7_di_strong_t20_long_indicator_or12h` | 488/488 | −$2,000 | −$839 | 116/116 | +$3,236 | +$3,699 | −$5,304 | −$3,833 | P,C,M,F |
| 456. `adx_60m_n7_adx_cross_t20_long_fixed12h` | 86/85 | −$2,044 | −$1,939 | 19/19 | −$954 | −$741 | −$5,348 | −$6,456 | P,C,M,F |
| 457. `adx_60m_n28_di_cross_t0_long_fixed12h` | 223/216 | −$2,100 | −$2,493 | 57/55 | +$1,406 | +$876 | −$5,405 | −$5,586 | P,C,M,F |
| 458. `adx_15m_n7_di_strong_t40_long_indicator_or12h` | 168/168 | −$2,200 | −$1,487 | 37/37 | −$208 | +$108 | −$5,505 | −$5,939 | P,C,M,F |
| 459. `adx_5m_n28_adx_cross_t25_long_fixed12h` | 192/191 | −$2,204 | −$2,462 | 60/60 | +$546 | +$551 | −$5,509 | −$3,782 | P,C,M,F |
| 460. `adx_30m_n7_adx_peak_fade_t40_long_indicator_or12h` | 278/277 | −$2,228 | −$2,074 | 70/70 | −$520 | −$528 | −$5,532 | −$6,327 | P,C,M,F |
| 461. `adx_15m_n7_di_strong_t25_long_fixed12h` | 564/556 | −$2,233 | +$304 | 142/141 | −$1,986 | −$1,684 | −$5,537 | −$5,754 | P,C,M,F |
| 462. `adx_15m_n28_di_cross_t0_long_fixed12h` | 470/463 | −$2,257 | −$2,057 | 118/114 | +$3,120 | +$2,833 | −$5,561 | −$3,262 | P,C,M,F |
| 463. `adx_60m_n7_adx_cross_t25_long_fixed12h` | 159/156 | −$2,390 | −$1,375 | 38/37 | +$722 | +$1,009 | −$5,694 | −$5,682 | P,C,M,F |
| 464. `adx_5m_n14_adx_cross_t40_long_indicator_or12h` | 253/253 | −$2,438 | −$1,282 | 73/73 | −$1,626 | −$1,281 | −$5,742 | −$4,655 | P,C,M,F |
| 465. `adx_30m_n7_di_strong_t40_long_indicator_or12h` | 87/87 | −$2,443 | −$2,042 | 22/22 | −$768 | −$741 | −$5,747 | −$5,931 | P,C,M,F |
| 466. `adx_15m_n7_adx_cross_t25_long_fixed12h` | 417/414 | −$2,451 | −$1,622 | 106/105 | +$2,654 | +$3,098 | −$5,756 | −$3,672 | P,C,M,F |
| 467. `adx_60m_n14_adx_peak_fade_t40_long_indicator_or12h` | 40/37 | −$2,530 | −$2,310 | 10/10 | −$3 | +$80 | −$5,835 | −$5,789 | P,C,M,F |
| 468. `adx_30m_n14_adx_peak_fade_t50_long_fixed12h` | 20/20 | −$2,654 | −$2,803 | 6/6 | −$609 | −$635 | −$5,959 | −$5,789 | N,P,C,M,F |
| 469. `adx_5m_n28_adx_cross_t25_long_indicator_or12h` | 218/218 | −$2,702 | −$2,608 | 68/68 | −$708 | −$1,150 | −$6,007 | −$5,145 | P,C,M,F |
| 470. `adx_30m_n7_di_strong_t40_long_fixed12h` | 86/86 | −$2,841 | −$2,425 | 22/22 | +$1,088 | +$1,280 | −$6,145 | −$5,512 | P,C,M,F |
| 471. `adx_15m_n28_di_strong_t20_long_fixed12h` | 117/117 | −$2,922 | −$2,938 | 29/29 | −$484 | −$582 | −$6,227 | −$4,680 | P,C,M,F |
| 472. `adx_5m_n14_di_strong_t20_short_indicator_or12h` | 1865/1865 | −$28,530 | −$26,709 | 471/471 | −$7,832 | −$8,447 | −$6,248 | −$5,732 | P,C,M,F |
| 473. `adx_5m_n28_adx_cross_t20_long_indicator_or12h` | 368/368 | −$3,142 | −$2,777 | 101/101 | +$1,056 | +$392 | −$6,446 | −$4,816 | P,C,M,F |
| 474. `adx_60m_n7_adx_peak_fade_t50_long_fixed12h` | 83/82 | −$3,204 | −$3,026 | 17/17 | −$1,132 | −$1,124 | −$6,509 | −$5,750 | P,C,M,F |
| 475. `adx_5m_n7_adx_cross_t25_long_fixed12h` | 643/641 | −$3,352 | −$4,454 | 155/154 | +$3,571 | +$3,489 | −$6,656 | −$3,350 | P,C,M,F |
| 476. `adx_30m_n14_di_strong_t25_long_fixed12h` | 122/122 | −$3,412 | −$3,272 | 24/24 | +$321 | +$256 | −$6,717 | −$4,797 | P,C,M,F |
| 477. `adx_5m_n28_di_strong_t20_long_indicator_or12h` | 388/388 | −$3,575 | −$2,615 | 104/104 | −$319 | +$40 | −$6,880 | −$6,398 | P,C,M,F |
| 478. `adx_15m_n7_adx_cross_t20_long_fixed12h` | 296/294 | −$3,590 | −$3,651 | 77/76 | +$2,537 | +$2,852 | −$6,894 | −$4,472 | P,C,M,F |
| 479. `adx_15m_n14_adx_cross_t20_long_fixed12h` | 274/273 | −$3,746 | −$3,561 | 68/67 | +$3,642 | +$4,165 | −$7,051 | −$4,431 | P,C,M,F |
| 480. `adx_5m_n28_adx_cross_t20_long_fixed12h` | 295/295 | −$3,747 | −$3,845 | 82/82 | +$3,643 | +$3,602 | −$7,052 | −$5,841 | P,C,M,F |
| 481. `adx_60m_n14_di_strong_t20_long_indicator_or12h` | 154/154 | −$3,870 | −$3,143 | 39/39 | +$2,124 | +$2,169 | −$7,175 | −$3,362 | P,C,M,F |
| 482. `adx_30m_n14_di_strong_t25_long_indicator_or12h` | 134/134 | −$3,877 | −$3,685 | 28/28 | −$804 | −$936 | −$7,181 | −$6,273 | P,C,M,F |
| 483. `adx_5m_n7_adx_cross_t40_short_indicator_or12h` | 1624/1624 | −$29,537 | −$27,729 | 400/400 | −$9,479 | −$8,932 | −$7,254 | −$4,835 | P,C,M,F |
| 484. `adx_60m_n14_di_cross_t0_long_indicator_or12h` | 417/417 | −$3,998 | −$3,167 | 98/98 | +$2,553 | +$2,676 | −$7,303 | −$3,439 | P,C,M,F |
| 485. `adx_15m_n28_di_strong_t25_long_fixed12h` | 43/43 | −$4,053 | −$3,941 | 10/10 | −$1,364 | −$1,350 | −$7,357 | −$6,288 | P,C,M,F |
| 486. `adx_5m_n14_adx_cross_t25_long_fixed12h` | 479/478 | −$4,746 | −$5,616 | 120/120 | +$1,770 | +$2,182 | −$8,050 | −$3,423 | P,C,M,F |
| 487. `adx_15m_n14_adx_cross_t20_long_indicator_or12h` | 353/353 | −$4,907 | −$3,213 | 89/89 | +$1,839 | +$2,496 | −$8,211 | −$3,885 | P,C,M,F |
| 488. `adx_30m_n7_di_cross_t0_long_fixed12h` | 559/539 | −$4,939 | −$6,024 | 139/132 | −$797 | −$1,475 | −$8,243 | −$4,039 | P,C,M,F |
| 489. `adx_15m_n7_adx_cross_t40_long_fixed12h` | 370/367 | −$4,950 | −$4,663 | 92/92 | +$5,231 | +$5,164 | −$8,255 | −$6,149 | P,C,M,F |
| 490. `adx_30m_n14_adx_peak_fade_t40_long_fixed12h` | 68/67 | −$5,303 | −$4,766 | 17/17 | −$2,634 | −$2,411 | −$8,607 | −$5,780 | P,C,M,F |
| 491. `adx_15m_n7_di_cross_t0_long_fixed12h` | 685/677 | −$5,328 | −$3,685 | 173/172 | +$266 | +$485 | −$8,632 | −$2,596 | P,C,M,F |
| 492. `adx_30m_n7_di_strong_t25_long_fixed12h` | 406/394 | −$5,459 | −$4,721 | 99/96 | −$3,119 | −$2,028 | −$8,763 | −$3,725 | P,C,M,F |
| 493. `adx_5m_n7_adx_peak_fade_t50_long_indicator_or12h` | 949/949 | −$5,669 | −$6,369 | 226/226 | −$406 | +$68 | −$8,974 | −$6,078 | P,C,M,F |
| 494. `adx_15m_n14_di_cross_t0_short_indicator_or12h` | 1754/1754 | −$31,723 | −$29,530 | 434/434 | −$9,999 | −$9,285 | −$9,440 | −$2,583 | P,C,M,F |
| 495. `adx_15m_n14_adx_peak_fade_t40_long_fixed12h` | 109/109 | −$6,269 | −$6,088 | 26/26 | −$1,503 | −$1,423 | −$9,574 | −$5,594 | P,C,M,F |
| 496. `adx_15m_n7_adx_cross_t40_long_indicator_or12h` | 523/523 | −$6,314 | −$5,381 | 132/132 | +$1,983 | +$2,181 | −$9,619 | −$3,781 | P,C,M,F |
| 497. `adx_15m_n28_di_strong_t20_long_indicator_or12h` | 147/147 | −$6,402 | −$6,591 | 37/37 | −$2,428 | −$2,437 | −$9,707 | −$6,688 | P,C,M,F |
| 498. `adx_30m_n7_di_strong_t20_long_fixed12h` | 510/495 | −$6,635 | −$7,140 | 125/120 | +$1,080 | +$1,005 | −$9,939 | −$4,024 | P,C,M,F |
| 499. `adx_15m_n7_di_strong_t20_short_indicator_or12h` | 1982/1982 | −$32,377 | −$31,178 | 501/501 | −$8,509 | −$7,972 | −$10,094 | −$3,779 | P,C,M,F,E |
| 500. `adx_60m_n7_di_cross_t0_long_indicator_or12h` | 662/662 | −$6,830 | −$5,744 | 161/161 | +$999 | +$1,400 | −$10,134 | −$4,004 | P,C,M,F |
| 501. `adx_15m_n7_adx_cross_t25_long_indicator_or12h` | 678/678 | −$7,091 | −$6,865 | 169/169 | +$804 | +$802 | −$10,395 | −$5,713 | P,C,M,F |
| 502. `adx_15m_n14_di_strong_t25_long_indicator_or12h` | 285/285 | −$7,095 | −$6,291 | 78/78 | −$1,654 | −$1,427 | −$10,400 | −$4,819 | P,C,M,F |
| 503. `adx_30m_n14_di_cross_t0_long_indicator_or12h` | 877/877 | −$7,425 | −$7,407 | 211/211 | +$718 | +$697 | −$10,729 | −$3,708 | P,C,M,F |
| 504. `adx_15m_n7_adx_cross_t20_long_indicator_or12h` | 450/450 | −$7,687 | −$7,074 | 113/113 | +$67 | +$428 | −$10,991 | −$6,113 | P,C,M,F |
| 505. `adx_30m_n14_di_strong_t20_long_indicator_or12h` | 318/318 | −$7,865 | −$7,527 | 80/80 | −$2,109 | −$1,899 | −$11,169 | −$6,542 | P,C,M,F |
| 506. `adx_15m_n7_di_strong_t20_long_fixed12h` | 655/645 | −$8,460 | −$4,785 | 166/164 | −$666 | −$763 | −$11,764 | −$2,912 | P,C,M,F |
| 507. `adx_5m_n14_adx_cross_t20_long_fixed12h` | 521/519 | −$8,980 | −$9,648 | 135/134 | +$1,614 | +$839 | −$12,285 | −$3,801 | P,C,M,F |
| 508. `adx_15m_n14_di_cross_t0_long_fixed12h` | 594/589 | −$10,584 | −$11,981 | 150/149 | +$2,757 | +$958 | −$13,888 | −$3,841 | P,C,M,F |
| 509. `adx_15m_n14_di_strong_t25_long_fixed12h` | 219/218 | −$10,586 | −$9,968 | 62/62 | −$1,989 | −$2,143 | −$13,891 | −$5,001 | P,C,M,F |
| 510. `adx_5m_n7_di_strong_t40_long_indicator_or12h` | 542/542 | −$10,588 | −$9,684 | 127/127 | −$2,081 | −$2,054 | −$13,892 | −$6,772 | P,C,M,F |
| 511. `adx_5m_n7_adx_cross_t25_short_indicator_or12h` | 2154/2154 | −$36,483 | −$33,805 | 547/547 | −$11,113 | −$10,314 | −$14,200 | −$5,415 | P,C,M,F,E |
| 512. `adx_15m_n14_di_strong_t20_long_fixed12h` | 396/394 | −$11,069 | −$11,164 | 98/97 | −$39 | −$391 | −$14,373 | −$3,736 | P,C,M,F |
| 513. `adx_30m_n7_di_strong_t25_long_indicator_or12h` | 608/608 | −$12,808 | −$11,079 | 153/153 | −$5,458 | −$4,583 | −$16,112 | −$5,322 | P,C,M,F |
| 514. `adx_15m_n28_di_cross_t0_long_indicator_or12h` | 1181/1181 | −$13,333 | −$13,316 | 290/290 | −$980 | −$534 | −$16,637 | −$4,058 | P,C,M,F |
| 515. `adx_30m_n7_di_strong_t20_long_indicator_or12h` | 969/969 | −$13,535 | −$10,819 | 241/241 | −$2,921 | −$1,983 | −$16,840 | −$4,490 | P,C,M,F |
| 516. `adx_5m_n14_di_strong_t25_long_indicator_or12h` | 837/837 | −$14,501 | −$12,217 | 197/197 | −$2,346 | −$2,458 | −$17,805 | −$6,052 | P,C,M,F |
| 517. `adx_15m_n14_di_strong_t20_long_indicator_or12h` | 646/646 | −$14,758 | −$13,948 | 157/157 | −$1,608 | −$1,589 | −$18,063 | −$5,709 | P,C,M,F |
| 518. `adx_5m_n7_adx_peak_fade_t40_long_indicator_or12h` | 1726/1726 | −$15,024 | −$15,554 | 422/422 | −$1,625 | −$1,700 | −$18,328 | −$6,470 | P,C,M,F |
| 519. `adx_5m_n14_adx_cross_t20_long_indicator_or12h` | 1084/1084 | −$15,262 | −$14,346 | 286/286 | −$2,330 | −$2,192 | −$18,567 | −$5,344 | P,C,M,F |
| 520. `adx_5m_n14_adx_cross_t25_long_indicator_or12h` | 911/911 | −$16,830 | −$15,091 | 243/243 | −$3,195 | −$2,829 | −$20,134 | −$5,324 | P,C,M,F |
| 521. `adx_30m_n7_di_cross_t0_long_indicator_or12h` | 1318/1318 | −$19,630 | −$16,108 | 325/325 | −$3,780 | −$2,493 | −$22,934 | −$4,690 | P,C,M,F |
| 522. `adx_15m_n7_di_cross_t0_short_indicator_or12h` | 2619/2619 | −$45,368 | −$43,251 | 663/663 | −$13,866 | −$12,804 | −$23,085 | −$4,748 | P,C,M,F,E |
| 523. `adx_15m_n7_di_strong_t25_long_indicator_or12h` | 1260/1260 | −$19,931 | −$18,797 | 308/308 | −$6,269 | −$5,493 | −$23,235 | −$6,236 | P,C,M,F |
| 524. `adx_5m_n7_adx_cross_t20_long_indicator_or12h` | 1427/1427 | −$20,172 | −$17,963 | 379/379 | −$6,038 | −$5,584 | −$23,477 | −$7,300 | P,C,M,F |
| 525. `adx_15m_n14_di_cross_t0_long_indicator_or12h` | 1755/1755 | −$23,619 | −$21,520 | 434/434 | −$2,215 | −$1,340 | −$26,924 | −$4,727 | P,C,M,F |
| 526. `adx_5m_n7_adx_cross_t40_long_indicator_or12h` | 1501/1501 | −$24,255 | −$20,328 | 396/396 | −$5,923 | −$4,604 | −$27,560 | −$4,988 | P,C,M,F |
| 527. `adx_5m_n7_di_strong_t25_short_indicator_or12h` | 3664/3664 | −$52,920 | −$48,377 | 922/922 | −$12,907 | −$12,890 | −$30,637 | −$5,593 | P,C,M,F,E |
| 528. `adx_5m_n7_adx_cross_t25_long_indicator_or12h` | 2097/2097 | −$27,998 | −$24,870 | 522/522 | −$6,482 | −$5,923 | −$31,303 | −$6,212 | P,C,M,F |
| 529. `adx_15m_n7_di_strong_t20_long_indicator_or12h` | 1949/1949 | −$28,487 | −$26,698 | 492/492 | −$7,424 | −$6,757 | −$31,792 | −$6,032 | P,C,M,F |
| 530. `adx_5m_n28_di_cross_t0_short_indicator_or12h` | 3733/3733 | −$54,869 | −$54,031 | 946/946 | −$15,443 | −$16,137 | −$32,587 | −$5,511 | P,C,M,F,E |
| 531. `adx_5m_n14_di_strong_t20_long_indicator_or12h` | 1900/1900 | −$32,388 | −$29,255 | 496/496 | −$7,924 | −$8,346 | −$35,693 | −$7,269 | P,C,M,F,E |
| 532. `adx_15m_n7_di_cross_t0_long_indicator_or12h` | 2619/2619 | −$34,542 | −$32,417 | 662/662 | −$7,308 | −$6,224 | −$37,846 | −$5,603 | P,C,M,F,E |
| 533. `adx_5m_n28_di_cross_t0_long_indicator_or12h` | 3734/3734 | −$44,455 | −$43,175 | 946/946 | −$8,615 | −$9,312 | −$47,760 | −$6,173 | P,C,M,F,E |
| 534. `adx_5m_n7_di_strong_t25_long_indicator_or12h` | 3717/3717 | −$51,210 | −$45,949 | 945/945 | −$12,552 | −$12,146 | −$54,514 | −$7,692 | P,C,M,F,E |
| 535. `adx_5m_n14_di_cross_t0_short_indicator_or12h` | 5508/5508 | −$77,106 | −$71,980 | 1420/1420 | −$22,438 | −$22,631 | −$54,824 | −$8,712 | P,C,M,F,E |
| 536. `adx_5m_n7_di_strong_t20_short_indicator_or12h` | 5871/5871 | −$82,670 | −$77,352 | 1487/1487 | −$21,108 | −$21,527 | −$60,387 | −$9,587 | P,C,M,F,E |
| 537. `adx_5m_n14_di_cross_t0_long_indicator_or12h` | 5508/5508 | −$64,726 | −$59,410 | 1419/1419 | −$15,276 | −$15,377 | −$68,031 | −$8,025 | P,C,M,F,E |
| 538. `adx_5m_n7_di_strong_t20_long_indicator_or12h` | 5888/5888 | −$75,430 | −$68,606 | 1492/1492 | −$17,447 | −$17,236 | −$78,735 | −$8,207 | P,C,M,F,E |
| 539. `adx_5m_n7_di_cross_t0_short_indicator_or12h` | 8133/8133 | −$111,520 | −$105,297 | 2107/2107 | −$32,584 | −$32,730 | −$89,238 | −$11,829 | P,C,M,F,E |
| 540. `adx_5m_n7_di_cross_t0_long_indicator_or12h` | 8133/8133 | −$98,728 | −$92,503 | 2106/2106 | −$25,445 | −$25,608 | −$102,033 | −$10,043 | P,C,M,F,E |
