# I11: OBV / MFI / CMF standalone findings

Accepted September 7, 2026. HYPEUSDT / Bybit candle research only.
[Coverage register](INDICATOR-FINDINGS.md) · [Tested setups](TESTED-SETUPS.md) ·
[Frozen card](../research-inputs/indicators/volume-flow-standalone-2026-09-07.json) ·
[Formula, timing and reproduction guide](../docs/research/volume-flow-standalone-study.md).

## TL;DR

- **1,800 new definitions, 7,208 cases independently verified.** The descriptive
  sample/net/delay/extra-cost subset retains **114 longs and four shorts**;
  **zero pass the complete predeclared screen**. This is positive evidence for
  specific entries, not a deployment approval or a rejection of entire families.
- **Different paths matter more than the best profit alone.** Leading OBV
  dip/12h earns +$14,477 full /+$6,787 recent, but holds a 49.05% adverse price
  excursion during October's crash. Leading 15m MFI7 below10 earns
  +$13,112 /+$3,957, avoids that particular low and has 10.19% full account DD,
  but sacrifices recent upside versus the +$5,038 clock. No generic volume
  indicator “makes dips safe.”
- **Neutral exits usually damage the selected rebound entries.** Three narrow
  short entry mechanisms survive costs/sample tests (four exit definitions,
  two identical OBV ledgers), with concentration/monthly failures. Preserve
  these distinct mechanisms for later study; no combinations, ladder changes
  or live-short unpause were performed.

## What the comparison measures

| Item | Exact convention |
|---|---|
| Full period | 2025-07-01 00:00 to 2026-09-04 19:01 UTC |
| Recent period | 2026-05-17 20:43 to the same cutoff; starts flat; contained within full |
| Data | Same fingerprinted I01 snapshot, fixed 2025-06-01 seed, 663,541 contiguous one-minute candles, explicit 11-minute repair |
| Position / account | $10,000 fixed entry notional, $32,000 initial equity, one independent position per rule |
| Decisions / fills | Only completed contiguous selected-timeframe bars; minute-open execution at modeled zero publication lag; separate +1m delay to BOTH entries and exits |
| Costs | 0.055% each side on actual executed notional; **BEFORE FUNDING**; extra 5bps each side fixed-path stress |
| Exits | 12h from actual entry, or subsequent mode-specific neutral condition capped at12h; no TP, SL, averaging or compounding |
| Baseline | Same-side rolling12h clock; approximately continuous exposure, not exposure-matched and **not the Martingale ladder** |
| Open inventory | Fee-adjusted cutoff mark, separate from completed W/L |
| DD | Prior close-equity peak to each minute's adverse price; no intraminute sequence, liquidation or shared-collateral model |

The windows overlap and have already been mined. The 2,102,236 verified trade
rows are overlapping artifact records, **not that many independent trades**.
Do not add full/recent profit or the correlated policies together. No complete
historical funding archive or original collector receipt record is available.

## Practical side-by-side

Immediate model; winning/losing dollars already include trading fees.
Net also includes the open mark, so rounded columns can differ by a dollar.
Labels identify exact IDs in the later tables, not new variants.


### Full: July 1, 2025 – September 4, 2026, 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Account DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clock long baseline | 861 | 420/441 | 110,950 | -107,401 | -245 | 3,305 | 33.09% |
| G1: OBV10 5m crosses below −0.75 / 12h | 480 | 243/237 | 70,654 | -56,106 | -71 | 14,477 | 18.37% |
| M1: MFI7 15m crosses below raw10 / 12h | 441 | 228/213 | 59,815 | -46,703 | 0 | 13,112 | 10.19% |
| G4: CMF20 5m crosses below −0.20 / 12h | 629 | 326/303 | 87,889 | -74,488 | 40 | 13,441 | 23.03% |
| O4: OBV20 15m recovers above −0.50 / 12h | 219 | 117/102 | 34,058 | -21,986 | 80 | 12,152 | 7.88% |
| C3: CMF10 5m crosses below −0.20 / 12h | 758 | 375/383 | 104,072 | -90,659 | -222 | 13,191 | 22.12% |
| C5: CMF10 30m crosses above zero / 12h | 613 | 303/310 | 80,767 | -70,581 | 0 | 10,186 | 15.66% |

### Recent: May 17, 2026, 20:43 – September 4, 2026, 19:01 UTC

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | Account DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clock long baseline | 219 | 114/105 | 29,120 | -23,837 | -245 | 5,038 | 12.94% |
| G1: OBV10 5m crosses below −0.75 / 12h | 121 | 66/55 | 17,887 | -11,029 | -71 | 6,787 | 6.24% |
| M1: MFI7 15m crosses below raw10 / 12h | 106 | 56/50 | 13,556 | -9,599 | 0 | 3,957 | 7.18% |
| G4: CMF20 5m crosses below −0.20 / 12h | 159 | 86/73 | 23,920 | -16,716 | 40 | 7,243 | 9.05% |
| O4: OBV20 15m recovers above −0.50 / 12h | 43 | 23/20 | 5,860 | -4,278 | 80 | 1,663 | 4.85% |
| C3: CMF10 5m crosses below −0.20 / 12h | 196 | 102/94 | 26,888 | -18,712 | -222 | 7,954 | 9.79% |
| C5: CMF10 30m crosses above zero / 12h | 157 | 85/72 | 23,044 | -14,806 | 0 | 8,238 | 7.41% |

## What each family actually tells us

### OBV: a strong rebound comparator, not a proven safety filter

G1 buys when five-minute normalized OBV10 crosses below −0.75 and holds12h.
It earns +$14,477 full /+$6,787 recent; +1m still earns +$14,426 /+$6,996.
After the delayed extra-cost stress it retains +$9,616 /+$5,782. This is not
just a favorable zero-delay fill. Nevertheless, its October10 entry at21:00
first suffers **49.05% gross adverse movement**, then closes only −$232.
A tolerable eventual loss hides a severe path. Full November still loses$3,243.

Waiting for recovery can be different, but is not universally safer:
G2's 15m OBV20 into−0.50 earns +$13,673 full /+$1,948 recent with12.05% /
4.11% account DD; O4's recovery above−0.50 gives +$12,152 /+$1,663 and7.88% /
4.85% DD: lower full DD but higher recent DD. O4 is flat at October's21:21 low in both delays, next entering22:00 /
22:01. It still experiences12.59% /11.13% worst full adverse price movement.
Its recent five largest winners supply229% of closed net, and much of May's
clock upside is missed.

That does **not** prove “always wait for OBV recovery”: the same G1 entry
changed to recovery above−0.75 earns +$10,501 /+$6,072, while full DD actually
rises18.37% to19.72% and recent DD6.24% to6.63%. Each clock/period/entry
definition needs its own control.

### MFI: several dip entries have a meaningfully different observed path

M1 is **raw MFI7 on15m crosses below10**, not RSI10 or centered MFI below0.8.
It earns +$13,112 full /+$3,957 recent from441 /106 closes. Full/recent account
DD is10.19% /7.18%; +1m net declines to+$10,761 /+$3,311. Delayed extra-cost
nets remain+$6,373 /+$2,259. It trails the recent long clock in both delays.

M1 is flat at the October10 21:21 low: its previous trade exits17:45 and the
next entry is21:30, after the21:15–21:30 bar finishes. With+1m, these become
17:47 /21:31. Its worst full gross adverse movement is12.43% /12.46%, not
the approximately50% moves held by several other dip rules. M3 (30m MFI7
below10) and M4 (15m MFI14 below10) also remain flat at that low in both
delay cases. Their worst full adverse movements are11.43% /11.51% and
9.36% /9.21% respectively.

Keep the limits visible. M3 earns+$8,806 /+$1,969 with278 /60 closes;
M4 earns+$8,722 /+$1,720 with108 /20 closes. Recent top-five winners are
165% /152% of their closed net. M1 still loses$2,229 in November and$1,194
in July; its recent top-five winners supply80% of closed net.

There is **no family-wide crash protection**: M2 (15m MFI14 below20) holds
51.99% adverse movement; M5 (5m MFI7 below5) holds53.23%. A more extreme
numerical threshold does not automatically delay entry enough or reduce risk.
Observed non-exposure during one known crash is a useful distinction, not
proof a future collapse will be avoided.

### CMF: distinguish dip entries from positive-location continuation

G4, five-minute CMF20 crossing below−0.20 /12h, earns+$13,441 /+$7,243
with629 /159 closes, but holds53.23% adverse movement in October. Requiring
its recovery above−0.20 (C4) reduces net to+$10,830 /+$6,373; full DD falls
23.03% to20.85% but recent DD rises9.05% to9.33%, and October exposure remains.

C3, five-minute CMF10 below−0.20 /12h, earns+$13,191 /+$7,954.
Its **worst monthly delta across both windows/delays is only−$703**, closer
to the clock's monthly opportunity capture than G1 or M1. That is not a
reason to relax the frozen screen after seeing results. November/December
still lose$2,022 /$2,092, and the worst adverse price path is53.28%.

C5, **30m CMF10 crossing above zero /12h**, is a different mechanism:
+$10,186 full /+$8,238 recent, n613 /157, DD15.66% /7.41%. It is flat during
the October21:21 low in both delays (previous exit21:00 /21:02, next
entry21:30 /21:31); worst full adverse move14.00% /13.83%.
However, +1m full net falls to+$7,122 and full account DD rises to23.33%.
Recent delayed net is+$7,718, DD7.95%; delayed extra-cost full/recent net is
+$1,185 /+$6,183. Do not call the lower immediate DD timing-robust.

All of these are **candle-volume proxies**, not observed capital inflow or
aggressor buying. CMF can remain positive on a gap-down candle that closes
near its own high. Normalized OBV uses whole-bar close direction; MFI uses
typical-price direction. Different labels do not establish independent
information. No volume-removal control was in I11, so it cannot isolate the
incremental value of volume versus the underlying price pattern.

## Does an indicator-neutral exit secure more of the profit?

No general upgrade appears in the selected leading rebound entries.
The following are complete independent paths with the **same entry rule**,
not hindsight-selected exit prices. An earlier exit changes occupancy and
allows different subsequent entries; trade membership is not held fixed.
Dollars below include fees and the cutoff mark; same dates as above.


| Entry | Full fixed12h / neutral / delta | Recent fixed12h / neutral / delta | Full +1m fixed / neutral | Recent +1m fixed / neutral |
| --- | --- | --- | --- | --- |
| G1 | 14,477 / -8,828 / -23,305 | 6,787 / -1,257 / -8,044 | 14,426 / -8,415 | 6,996 / -688 |
| M1 | 13,112 / 4,502 / -8,609 | 3,957 / 1,006 / -2,951 | 10,761 / 2,801 | 3,311 / 732 |
| G4 | 13,441 / 907 / -12,534 | 7,243 / -511 / -7,754 | 14,425 / 238 | 8,189 / -489 |
| G2 | 13,673 / -1,333 / -15,005 | 1,948 / 36 / -1,912 | 13,471 / -1,493 | 1,901 / -93 |
| C3 | 13,191 / -21,837 / -35,028 | 7,954 / -3,740 / -11,694 | 13,245 / -22,204 | 7,455 / -3,589 |

For G1, neutral exits increase full closes480 to902 and turn+$14,477 into
−$8,828. M1's neutral exit reduces+$13,112 to+$4,502; G4 falls+$13,441 to+$907.
C3 drops+$13,191 to−$21,837 with758 to3,734 closes. Recovering indicator
balance does not mean the subsequent price rebound is finished. This does
not reject other untested stops, partial exits or timed-exit definitions.

## Loss months and invisible upside

Full-window immediate **marked-equity** monthly profit is shown below.
It includes open inventory changes and fees when incurred, not just trades
closed that month. Full May beginsMay1, unlike recent May's partial window;
September2026 ends at the stated cutoff. All selected leaders' monthly
controls under both delays and both windows are retained later.

G1 captures$2,928 more than clock inJune and$1,983 more inJuly, but gives
up$4,629 inMay. M1 gains$3,097 inJune and$3,929 inDecember, but misses$4,372
inMay and$1,715 inAugust. G4 improvesJune/July by$1,153 /$1,328, but
January is−$528 versus clock+$1,782. These missed recoveries are real costs.

Lower exposure also matters: full clock exposure is10,339h versusG1 5,766h,
M1 5,292h andG4 7,549h; recent2,635h versus1,458h /1,272h /1,909h.
A lower DD at lower exposure is not automatically a better ladder gate.


| Month | Clock long $ | G1 OBV $ (delta) | M1 MFI $ (delta) | G4 CMF $ (delta) |
| --- | --- | --- | --- | --- |
| 2025-07 | -161 | 1,124 (1,285) | 988 (1,149) | 884 (1,045) |
| 2025-08 | 510 | 2,971 (2,461) | 1,683 (1,172) | 343 (-167) |
| 2025-09 | -109 | 1,403 (1,512) | 1,580 (1,689) | -1,104 (-995) |
| 2025-10 | -470 | 1,520 (1,991) | 2,407 (2,878) | 3,545 (4,016) |
| 2025-11 | -3,287 | -3,243 (44) | -2,229 (1,058) | -2,412 (875) |
| 2025-12 | -2,574 | -1,354 (1,220) | 1,356 (3,929) | -171 (2,403) |
| 2026-01 | 1,782 | 2,836 (1,054) | -276 (-2,059) | -528 (-2,310) |
| 2026-02 | -122 | -528 (-406) | -747 (-625) | 831 (953) |
| 2026-03 | 1,155 | 1,455 (301) | 3,103 (1,949) | 1,238 (84) |
| 2026-04 | 307 | 924 (616) | 889 (582) | 1,352 (1,045) |
| 2026-05 | 5,789 | 1,160 (-4,629) | 1,417 (-4,372) | 6,165 (376) |
| 2026-06 | -1,256 | 1,673 (2,928) | 1,842 (3,097) | -103 (1,153) |
| 2026-07 | -2,621 | -638 (1,983) | -1,194 (1,426) | -1,293 (1,328) |
| 2026-08 | 4,306 | 5,412 (1,106) | 2,590 (-1,715) | 4,850 (544) |
| 2026-09 | 55 | -237 (-292) | -296 (-351) | -159 (-214) |

## Shorts: three narrow entry mechanisms, no live-unpause result

Of900 short definitions,618 meet sample floors and282 are sparse.
642 lose in all four window/delay cases. Four survive the descriptive
sample/net/cost/solvency subset, but **none the strict monthly screen**:

- OS1/OS2:4h OBV40 crosses **above+0.25**, fade short. Fixed12h and
  neutral-or12h have identical realized ledgers in both windows/delays;
  the optional exit never changes this history. Immediate net+$753 full /
  +$2,071 recent,n38 /13. Full includes+$223 open mark and just+$530 closed
  net; the five largest winners supply463% of full closed net.
- MS1:4h MFI28 crosses **below raw50**, trend short, subsequent recovery
  to50 or12h exit. +$1,471 /+$562,n73 /18. +1m and extra costs leave
  +$706 /+$316. Its best five winners supply224% /364% of closed net.
- CS1:4h CMF10 recrosses **below+0.20**, short, subsequent CMF<=0 or12h.
  +$1,543 /+$606,n100 /32. Delayed extra costs leave+$652 /**+$47 recent**.
  Best five winners supply145% /311% of closed net.

Compare the immediate short clock:−$22,283 full /−$9,887 recent,n861 /219;
cash$0. The raw topfive by full clock delta all lose recently. A favorable
delta against this losing baseline is not itself a positive short strategy.
The full tables retain their W/L dollars, delayed losses and monthly regressions.

The survivor shorts' worst full adverse price paths are11.94% OBV,
8.57% MFI and10.73% CMF. No SL, liquidation, shared account or25k deployment
model was tested. Sparse thresholds are **inconclusive**, not falsified by
lack of signals. The local live short entry setting remains unchanged/disabled.

## Exact scope and mathematical contract

I11 adds600 OBV +600 MFI +600 CMF definitions, zero repeated strategy
definitions. Both directions,5m/15m/30m/1h/4h completed bars, fresh crossings,
fixed12h versus a subsequent neutral condition capped12h.

| Family | Periods | Trend thresholds on side-signed centered metric | Into/recovery thresholds |
|---|---|---|---|
| OBV normalized signed-volume window |10/20/40|0/.25/.50/.75|.25/.50/.75|
| MFI |7/14/28|0/.20/.60/.80|.60/.80/.90|
| CMF |10/20/40|0/.05/.20/.50|.05/.20/.50|

Let v=side sign ×centered metric. Trend:previous<=k,current>k.
Into:previous>=−k,current<−k. Recovery:previous<=−k,current>−k.
MFI centered=(rawMFI−50)/50, so long into levels are raw20/10/5,
short into80/90/95. No sustained-state entry, zero-level duplicate,
same-observation exit or occupied-signal queue. Timeout starts at actual
entry, wins exit ties; +1m affects both actions, not just entry prices.

Raw OBV starts at0. The tested OBV value is the lastN signed-volume changes
divided by ALL N volumes, including tied-close volumes; it is not a threshold
on arbitrary cumulative OBV. MFI uses HLC3 ×base volume, positive/negative by
HLC3 change, ignoring ties; unrounded100P/(P+N). CMF uses volume-weighted
((C−L)−(H−C))/(H−L), with a zero multiplier but retained volume on flat ranges.
Zero denominators are null; balanced valid flows are zero (MFI50).
OBV/MFI require N comparisons; CMF needsN bars.

Primary formula references: [Fidelity OBV](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/obv),
[Fidelity MFI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/mfi),
[TradingView MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/),
[Fidelity CMF](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cmf).
These sources establish indicator definitions, **not profitability**.
The installed MFI library emits later, rounds and treats ties differently;
the differences are explicit in fixtures, not silently inherited.
External rawOBV agrees exactly. No live indicator math was changed.

## Evidence gate and verification

Strict inherited screen:>=30full /10recent closes at both delays; positive
net and own-side clock delta in allfour cases; no monthly marked delta
below−1e−8; positive extra-cost net; no equity exhaustion.
**0/1,800 qualifiers and0 deployment candidates.** The descriptive subset
retains sample/net/cost/solvency only and exposes clock/month failures;
it does not replace the strict screen. No threshold was changed after outcomes.

118 descriptive definitions =114 long /4 short. Counts overlap across
related parameters;72 definitions have an equity-exhausted diagnostic case.
Their continued fixed-notional ledger is explicitly non-executable,
not an account that could really trade below zero equity.

Local accepted artifacts:
`backtests/hype/hype-volume-flow-standalone-2026-09-07/`.

| Check | Accepted result |
|---|---|
| All cases |7,208:7,200 new-rule cases +8 clock controls|
| Independent ledger/accounting |2,102,236 trade records;72,080 monthly rows|
| Prior control parity |All8 I01 saved clock ledgers, monthly results, stats and cutoff marks exactly match|
| Historical timing |135 actual feature-prefix checks;1,800 actual engine-prefix checks|
| Missing minutes |0 with the pinned explicit repair|
| Feature/engine tests |10 groups, including all1,800 entry boundaries and45 parameter/timeframe independent reference comparisons|
| Independent checker |Does not import the new feature module or strategy engine; checks every eligible and occupied signal, earliest exit, price, fee, exposure, DD, month, rank and trace|
| Pin checks |All source/input/artifact hashes match; protected live/config/state files unchanged|
| Verified at |2026-09-07T00:05:53.576Z|
| Verifier SHA256 |`c70c93d1d43e7f2f1161bd72116cf079507c15b6925f90c6f6ab0704cf4d31de`|
| Read-only risk supplement |62 immediate cases plus16 specified delayed-path inspections; no new strategy runs|

Both TypeScript builds pass. Timing11, shared-feature12 and old standalone17
test groups also pass. `git diff --check` passes. The runner, independent
checker and path commands are documented in the linked method. Source,
small card and findings are allowlisted; bulky JSON/CSV/trade artifacts
remain local/ignored. No commit or push was requested.

### Trace real decisions, not just a general no-lookahead claim

All rows below are actual first five-minute trend0 long entries onJuly1,2025.
The reference was computed only from the prefix strictly before the fill
minute. The fill minute's own high/low/close is not available to the signal.

| Metric | Previous centered value | Closed signal value | Last source minute | Signal / fill UTC | Next-minute open |
|---|---:|---:|---|---|---:|
| OBV10 |−0.1525443574|+0.0530359283|01:19|01:20|39.689|
| MFI7 |−0.2119952181|+0.6289629733 (raw81.4481)|01:09|01:10|39.433|
| CMF10 |−0.0310319076|+0.1000956642|01:19|01:20|39.689|

This certifies the modeled closed-bar calculation/decision boundary, not an
unrecorded live publication timestamp. The +1m test is a sensitivity, not proof
of historical latency or queue fills.

## Side observations and deliberately untested scope

No new indicator/HL/S/R combination, ladder gate or shared-account overlay
was run. No volume-removal controls: apparent candle-volume profitability
does not prove volume adds information beyond price alone. Confirmed
divergence, rawOBV MA/channel rules, CMF21, daily clocks, other periods/levels,
persistence, price confirmation, event anchors, new stops/TP/partial exits,
risk sizing and funding/receipt/queue/liquidation validation remain untested.

All thresholds were evaluated on overlapping, previously examined history;
there is no untouched holdout or multiple-testing-adjusted claim.
Do not select an entry specifically to avoid the known October timestamp.
Its path inspection is a warning/description, not a newly fitted crash gate.

The remaining individual families in the coverage register still need an
explicit complete/sparse/deferred status before combinations. This task ends
at OBV/MFI/CMF. Future component combinations must keep both components alone
as controls; a ladder application must freshly reproduce its own canonical
same-window baseline. Standalone dollars cannot be added to ladder PnL.

## Detailed evidence tables

Overall and per-family topfive are descriptive-subset rankings by full
immediate **absolute net**, not a deployment selection. Raw R1–R5 are ranked
by full **same-side clock delta** and kept even when they fail. OS/MS/CS
contain all four descriptive short definitions; family lists may share labels.
Dollar rounding can move totals by a dollar. All1,800 ranked IDs/failures
remain at the end so losses, sparse rules and diagnostic bankrupt paths are
not discarded.


## Exact tested leaders and their preserved failures

| Label | Frozen rule ID | Research screen failures |
| --- | --- | --- |
| G1 | `obv_5m_n10_into_t0.75_long_fixed12h` | monthly_regression_vs_clock |
| G2 | `obv_15m_n20_into_t0.5_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| G3 | `obv_60m_n10_into_t0.25_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| G4 | `cmf_5m_n20_into_t0.2_long_fixed12h` | monthly_regression_vs_clock |
| G5 | `cmf_60m_n10_into_t0.2_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| O4 | `obv_15m_n20_recovery_t0.5_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| O5 | `obv_5m_n40_into_t0.25_long_fixed12h` | monthly_regression_vs_clock |
| M1 | `mfi_15m_n7_into_t0.8_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| M2 | `mfi_15m_n14_into_t0.6_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| M3 | `mfi_30m_n7_into_t0.8_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| M4 | `mfi_15m_n14_into_t0.8_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| M5 | `mfi_5m_n7_into_t0.9_long_fixed12h` | not_above_clock_all_windows_delays, monthly_regression_vs_clock |
| C3 | `cmf_5m_n10_into_t0.2_long_fixed12h` | monthly_regression_vs_clock |
| C4 | `cmf_5m_n20_recovery_t0.2_long_fixed12h` | monthly_regression_vs_clock |
| C5 | `cmf_30m_n10_trend_t0_long_fixed12h` | monthly_regression_vs_clock |
| R1 | `obv_60m_n10_recovery_t0.5_short_indicator_or12h` | not_positive_all_windows_delays, monthly_regression_vs_clock, extra_cost_stress_nonpositive |
| R2 | `cmf_15m_n40_recovery_t0.2_short_fixed12h` | not_positive_all_windows_delays, monthly_regression_vs_clock, extra_cost_stress_nonpositive |
| R3 | `cmf_5m_n40_into_t0.2_short_indicator_or12h` | not_positive_all_windows_delays, monthly_regression_vs_clock, extra_cost_stress_nonpositive |
| R4 | `cmf_60m_n10_into_t0.2_short_fixed12h` | not_positive_all_windows_delays, monthly_regression_vs_clock, extra_cost_stress_nonpositive |
| R5 | `obv_60m_n10_into_t0.5_short_indicator_or12h` | not_positive_all_windows_delays, monthly_regression_vs_clock, extra_cost_stress_nonpositive |
| OS1 | `obv_240m_n40_into_t0.25_short_fixed12h` | monthly_regression_vs_clock |
| OS2 | `obv_240m_n40_into_t0.25_short_indicator_or12h` | monthly_regression_vs_clock |
| MS1 | `mfi_240m_n28_trend_t0_short_indicator_or12h` | monthly_regression_vs_clock |
| CS1 | `cmf_240m_n10_recovery_t0.2_short_indicator_or12h` | monthly_regression_vs_clock |


## Family coverage counts

| Family / side | Slots | Adequately sampled | Positive all4 | Extra-cost positive all4 | Descriptive | Strict | Exhausted diagnostics |
| --- | --- | --- | --- | --- | --- | --- | --- |
| all /both | 1800 | 1222 | 318 | 197 | 118 | 0 | 72 |
| obv /both | 600 | 408 | 99 | 70 | 46 | 0 | 20 |
| obv /long | 300 | 202 | 94 | 66 | 44 | 0 | 9 |
| obv /short | 300 | 206 | 5 | 4 | 2 | 0 | 11 |
| mfi /both | 600 | 388 | 129 | 80 | 41 | 0 | 23 |
| mfi /long | 300 | 194 | 113 | 65 | 40 | 0 | 10 |
| mfi /short | 300 | 194 | 16 | 15 | 1 | 0 | 13 |
| cmf /both | 600 | 426 | 90 | 47 | 31 | 0 | 29 |
| cmf /long | 300 | 208 | 81 | 42 | 30 | 0 | 11 |
| cmf /short | 300 | 218 | 9 | 5 | 1 | 0 | 18 |


## full immediate: wins, losses, open marks and account DD

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| clock_long | 861 | 420/441 | 110,950 | -107,401 | -245 | 3,305 | 33.09% |
| clock_short | 861 | 414/447 | 98,162 | -120,668 | 223 | -22,283 | 71.27% |
| G1 | 480 | 243/237 | 70,654 | -56,106 | -71 | 14,477 | 18.37% |
| G2 | 220 | 116/104 | 35,012 | -21,503 | 163 | 13,673 | 12.05% |
| G3 | 393 | 207/186 | 57,721 | -44,252 | 163 | 13,633 | 17.38% |
| G4 | 629 | 326/303 | 87,889 | -74,488 | 40 | 13,441 | 23.03% |
| G5 | 292 | 157/135 | 44,335 | -31,133 | 0 | 13,202 | 15.38% |
| O4 | 219 | 117/102 | 34,058 | -21,986 | 80 | 12,152 | 7.88% |
| O5 | 550 | 286/264 | 75,331 | -64,482 | 0 | 10,848 | 25.75% |
| M1 | 441 | 228/213 | 59,815 | -46,703 | 0 | 13,112 | 10.19% |
| M2 | 349 | 174/175 | 46,546 | -35,579 | 0 | 10,966 | 18.72% |
| M3 | 278 | 146/132 | 37,757 | -29,115 | 163 | 8,806 | 11.95% |
| M4 | 108 | 54/54 | 19,073 | -10,351 | 0 | 8,722 | 6.82% |
| M5 | 551 | 282/269 | 73,059 | -65,190 | 0 | 7,870 | 25.09% |
| C3 | 758 | 375/383 | 104,072 | -90,659 | -222 | 13,191 | 22.12% |
| C4 | 628 | 320/308 | 84,905 | -74,061 | -13 | 10,830 | 20.85% |
| C5 | 613 | 303/310 | 80,767 | -70,581 | 0 | 10,186 | 15.66% |
| R1 | 214 | 123/91 | 19,449 | -16,203 | 0 | 3,246 | 6.47% |
| R2 | 210 | 113/97 | 29,834 | -26,743 | 0 | 3,091 | 12.52% |
| R3 | 613 | 365/248 | 42,050 | -38,960 | 0 | 3,090 | 12.83% |
| R4 | 358 | 186/172 | 46,809 | -43,961 | 201 | 3,049 | 17.04% |
| R5 | 209 | 123/86 | 25,119 | -22,427 | 0 | 2,692 | 12.09% |
| OS1 | 38 | 22/16 | 5,232 | -4,702 | 223 | 753 | 7.19% |
| OS2 | 38 | 22/16 | 5,232 | -4,702 | 223 | 753 | 7.19% |
| MS1 | 73 | 38/35 | 8,827 | -7,356 | 0 | 1,471 | 7.46% |
| CS1 | 100 | 58/42 | 11,936 | -10,392 | 0 | 1,543 | 8.23% |

All closed dollar amounts already include trading fees. Net also includes cutoff mark; funding excluded. Cash/no trade=$0. Labels are not recommendations.


## recent immediate: wins, losses, open marks and account DD

| Setup | Closes | W/L | Winning $ | Losing $ | Open $ | Net $ | DD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| clock_long | 219 | 114/105 | 29,120 | -23,837 | -245 | 5,038 | 12.94% |
| clock_short | 219 | 97/122 | 21,666 | -31,775 | 223 | -9,887 | 32.54% |
| G1 | 121 | 66/55 | 17,887 | -11,029 | -71 | 6,787 | 6.24% |
| G2 | 43 | 24/19 | 6,020 | -4,236 | 163 | 1,948 | 4.11% |
| G3 | 93 | 50/43 | 12,383 | -8,576 | 163 | 3,970 | 5.72% |
| G4 | 159 | 86/73 | 23,920 | -16,716 | 40 | 7,243 | 9.05% |
| G5 | 73 | 45/28 | 10,390 | -7,069 | 0 | 3,321 | 6.98% |
| O4 | 43 | 23/20 | 5,860 | -4,278 | 80 | 1,663 | 4.85% |
| O5 | 142 | 75/67 | 20,805 | -12,689 | 0 | 8,115 | 7.40% |
| M1 | 106 | 56/50 | 13,556 | -9,599 | 0 | 3,957 | 7.18% |
| M2 | 82 | 43/39 | 10,161 | -7,083 | 0 | 3,078 | 5.17% |
| M3 | 60 | 33/27 | 7,778 | -5,972 | 163 | 1,969 | 6.45% |
| M4 | 20 | 10/10 | 3,607 | -1,887 | 0 | 1,720 | 4.30% |
| M5 | 138 | 80/58 | 17,773 | -13,671 | 0 | 4,102 | 8.82% |
| C3 | 196 | 102/94 | 26,888 | -18,712 | -222 | 7,954 | 9.79% |
| C4 | 158 | 84/74 | 23,657 | -17,272 | -13 | 6,373 | 9.33% |
| C5 | 157 | 85/72 | 23,044 | -14,806 | 0 | 8,238 | 7.41% |
| R1 | 70 | 40/30 | 4,834 | -5,294 | 0 | -461 | 5.72% |
| R2 | 53 | 28/25 | 7,129 | -7,175 | 0 | -46 | 7.18% |
| R3 | 154 | 91/63 | 8,714 | -10,828 | 0 | -2,113 | 9.31% |
| R4 | 97 | 50/47 | 12,469 | -13,318 | 201 | -648 | 11.36% |
| R5 | 65 | 39/26 | 7,602 | -8,020 | 0 | -418 | 6.39% |
| OS1 | 13 | 10/3 | 2,922 | -1,074 | 223 | 2,071 | 2.63% |
| OS2 | 13 | 10/3 | 2,922 | -1,074 | 223 | 2,071 | 2.63% |
| MS1 | 18 | 7/11 | 2,145 | -1,583 | 0 | 562 | 3.07% |
| CS1 | 32 | 15/17 | 3,566 | -2,960 | 0 | 606 | 3.69% |

All closed dollar amounts already include trading fees. Net also includes cutoff mark; funding excluded. Cash/no trade=$0. Labels are not recommendations.


## Delay and extra-cost sensitivity

| Setup | Full 0m | Full +1m | Recent 0m | Recent +1m | Full extra 0m/+1m | Recent extra 0m/+1m |
| --- | --- | --- | --- | --- | --- | --- |
| clock_long | 3,305 | 3,792 | 5,038 | 5,104 | -5,322 /-4,815 | 2,835 /2,910 |
| clock_short | -22,283 | -22,726 | -9,887 | -9,930 | -30,909 /-31,333 | -12,090 /-12,124 |
| G1 | 14,477 | 14,426 | 6,787 | 6,996 | 9,657 /9,616 | 5,563 /5,782 |
| G2 | 13,673 | 13,471 | 1,948 | 1,901 | 11,455 /11,273 | 1,506 /1,460 |
| G3 | 13,633 | 10,642 | 3,970 | 3,053 | 9,684 /6,814 | 3,028 /2,131 |
| G4 | 13,441 | 14,425 | 7,243 | 8,189 | 7,131 /8,175 | 5,639 /6,614 |
| G5 | 13,202 | 11,230 | 3,321 | 2,639 | 10,274 /8,363 | 2,589 /1,917 |
| O4 | 12,152 | 12,137 | 1,663 | 1,622 | 9,945 /9,950 | 1,222 /1,181 |
| O5 | 10,848 | 9,929 | 8,115 | 7,743 | 5,340 /4,441 | 6,691 /6,318 |
| M1 | 13,112 | 10,761 | 3,957 | 3,311 | 8,693 /6,373 | 2,895 /2,259 |
| M2 | 10,966 | 10,894 | 3,078 | 3,205 | 7,469 /7,417 | 2,256 /2,383 |
| M3 | 8,806 | 9,191 | 1,969 | 1,590 | 6,010 /6,405 | 1,358 /979 |
| M4 | 8,722 | 8,748 | 1,720 | 1,680 | 7,637 /7,663 | 1,519 /1,479 |
| M5 | 7,870 | 7,521 | 4,102 | 3,898 | 2,353 /2,024 | 2,719 /2,515 |
| C3 | 13,191 | 13,245 | 7,954 | 7,455 | 5,590 /5,674 | 5,979 /5,500 |
| C4 | 10,830 | 10,789 | 6,373 | 6,590 | 4,531 /4,541 | 4,779 /5,016 |
| C5 | 10,186 | 7,122 | 8,238 | 7,718 | 4,048 /1,185 | 6,663 /6,183 |
| R1 | 3,246 | 3,363 | -461 | -378 | 1,109 /1,266 | -1,161 /-1,058 |
| R2 | 3,091 | 3,201 | -46 | -13 | 994 /1,103 | -576 /-542 |
| R3 | 3,090 | 1,087 | -2,113 | -2,669 | -3,035 /-5,039 | -3,654 /-4,209 |
| R4 | 3,049 | 2,126 | -648 | -943 | -537 /-1,321 | -1,628 /-1,903 |
| R5 | 2,692 | 2,631 | -418 | -435 | 605 /563 | -1,068 /-1,085 |
| OS1 | 753 | 957 | 2,071 | 2,154 | 364 /588 | 1,932 /2,015 |
| OS2 | 753 | 957 | 2,071 | 2,154 | 364 /588 | 1,932 /2,015 |
| MS1 | 1,471 | 1,435 | 562 | 496 | 742 /706 | 382 /316 |
| CS1 | 1,543 | 1,610 | 606 | 337 | 544 /652 | 287 /47 |

+1m delays both entry and exit. Extra stress adds5bps per side on the same turnover, not a new fill/slippage path. Baseline comparisons are not exposure-matched.


## Own fixed12h exit comparisons

| Indicator-exit setup | Full fixed / optional / delta | Recent fixed / optional / delta | Full +1m delta | Recent +1m delta |
| --- | --- | --- | --- | --- |
| R1 | 193 /3,246 /3,053 | -2,221 /-461 /1,760 | 2,765 | 2,016 |
| R3 | -3,609 /3,090 /6,699 | -2,059 /-2,113 /-55 | 5,199 | -167 |
| R5 | 1,998 /2,692 /694 | 121 /-418 /-539 | 199 | -485 |
| OS2 | 753 /753 /0 | 2,071 /2,071 /0 | 0 | 0 |
| MS1 | 9 /1,471 /1,462 | 1,169 /562 /-607 | 1,095 | -719 |
| CS1 | 2,301 /1,543 /-758 | 100 /606 /506 | -258 | 540 |


## Complete selected monthly comparisons

Each cell is **monthly marked net (delta to same-side clock)**. Full and recent windows start independently; recent May and September are partial. Baselines appear in every table. All topfive overall/per-family/raw selections and every descriptive short are retained at both delays.


### Overall leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | G4 | G5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 1,124 (1,285) | 1,443 (1,604) | 153 (314) | 884 (1,045) | 945 (1,106) |
| 2025-08 | 510 | -1,876 | 2,971 (2,461) | 2,714 (2,204) | 1,461 (950) | 343 (-167) | 145 (-365) |
| 2025-09 | -109 | -1,211 | 1,403 (1,512) | 968 (1,077) | 2,140 (2,249) | -1,104 (-995) | 2,246 (2,355) |
| 2025-10 | -470 | -894 | 1,520 (1,991) | 2,941 (3,412) | -1,219 (-749) | 3,545 (4,016) | 1,714 (2,185) |
| 2025-11 | -3,287 | 1,970 | -3,243 (44) | 1,648 (4,935) | 2,919 (6,206) | -2,412 (875) | 1,058 (4,345) |
| 2025-12 | -2,574 | 1,212 | -1,354 (1,220) | -844 (1,730) | -1,361 (1,213) | -171 (2,403) | 666 (3,240) |
| 2026-01 | 1,782 | -3,149 | 2,836 (1,054) | 527 (-1,256) | -1,158 (-2,940) | -528 (-2,310) | 339 (-1,443) |
| 2026-02 | -122 | -1,111 | -528 (-406) | 452 (574) | 3,844 (3,966) | 831 (953) | 1,772 (1,894) |
| 2026-03 | 1,155 | -2,521 | 1,455 (301) | 2,799 (1,644) | 1,565 (410) | 1,238 (84) | 1,690 (536) |
| 2026-04 | 307 | -1,628 | 924 (616) | -413 (-721) | 20 (-287) | 1,352 (1,045) | -234 (-541) |
| 2026-05 | 5,789 | -7,161 | 1,160 (-4,629) | -424 (-6,213) | 2,789 (-3,001) | 6,165 (376) | 549 (-5,240) |
| 2026-06 | -1,256 | -64 | 1,673 (2,928) | 1,761 (3,016) | 883 (2,138) | -103 (1,153) | 933 (2,189) |
| 2026-07 | -2,621 | 1,259 | -638 (1,983) | -325 (2,296) | -505 (2,116) | -1,293 (1,328) | -1,223 (1,398) |
| 2026-08 | 4,306 | -5,675 | 5,412 (1,106) | 263 (-4,043) | 2,200 (-2,106) | 4,850 (544) | 2,614 (-1,691) |
| 2026-09 | 55 | -231 | -237 (-292) | 163 (108) | -96 (-152) | -159 (-214) | -13 (-69) |


### Overall leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | G4 | G5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 1,249 (1,343) | 1,347 (1,441) | 198 (292) | 1,070 (1,164) | 847 (941) |
| 2025-08 | 754 | -2,120 | 2,845 (2,091) | 2,723 (1,969) | 180 (-574) | -189 (-943) | 83 (-671) |
| 2025-09 | -265 | -1,056 | 1,038 (1,302) | 897 (1,162) | 2,077 (2,342) | -1,145 (-881) | 2,079 (2,344) |
| 2025-10 | -484 | -880 | 1,667 (2,151) | 3,077 (3,561) | -1,573 (-1,089) | 3,387 (3,871) | 1,660 (2,145) |
| 2025-11 | -3,354 | 2,037 | -3,273 (81) | 1,765 (5,119) | 2,883 (6,237) | -1,506 (1,848) | 1,117 (4,471) |
| 2025-12 | -2,606 | 1,267 | -1,409 (1,198) | -880 (1,726) | -1,318 (1,288) | -376 (2,231) | 376 (2,982) |
| 2026-01 | 2,011 | -3,378 | 2,694 (683) | 380 (-1,631) | -1,092 (-3,102) | -434 (-2,444) | 512 (-1,498) |
| 2026-02 | 102 | -1,335 | -595 (-697) | 500 (398) | 3,141 (3,039) | 816 (713) | 1,562 (1,460) |
| 2026-03 | 1,222 | -2,588 | 1,507 (284) | 2,684 (1,462) | 1,440 (217) | 1,317 (94) | 863 (-359) |
| 2026-04 | 243 | -1,564 | 1,132 (890) | -503 (-745) | 176 (-67) | 1,278 (1,035) | -153 (-396) |
| 2026-05 | 5,761 | -7,132 | 1,325 (-4,436) | -254 (-6,015) | 2,886 (-2,876) | 6,263 (501) | 615 (-5,147) |
| 2026-06 | -1,159 | -139 | 1,685 (2,844) | 1,714 (2,872) | 654 (1,813) | -191 (968) | 556 (1,715) |
| 2026-07 | -2,614 | 1,252 | -761 (1,853) | -330 (2,284) | -750 (1,864) | -1,242 (1,373) | -1,294 (1,321) |
| 2026-08 | 4,311 | -5,680 | 5,540 (1,229) | 185 (-4,126) | 1,830 (-2,481) | 5,569 (1,258) | 2,438 (-1,873) |
| 2026-09 | -37 | -139 | -219 (-183) | 166 (202) | -90 (-53) | -191 (-154) | -32 (5) |


### Overall leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | G4 | G5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 577 (-3,977) | 86 (-4,468) | 1,489 (-3,065) | 3,948 (-606) | 1,010 (-3,544) |
| 2026-06 | -1,256 | -64 | 1,673 (2,928) | 1,761 (3,016) | 883 (2,138) | -103 (1,153) | 933 (2,189) |
| 2026-07 | -2,621 | 1,259 | -638 (1,983) | -325 (2,296) | -505 (2,116) | -1,293 (1,328) | -1,223 (1,398) |
| 2026-08 | 4,306 | -5,675 | 5,412 (1,106) | 263 (-4,043) | 2,200 (-2,106) | 4,850 (544) | 2,614 (-1,691) |
| 2026-09 | 55 | -231 | -237 (-292) | 163 (108) | -96 (-152) | -159 (-214) | -13 (-69) |


### Overall leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | G4 | G5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 751 (-3,726) | 167 (-4,310) | 1,409 (-3,068) | 4,243 (-234) | 971 (-3,506) |
| 2026-06 | -1,129 | -191 | 1,685 (2,814) | 1,714 (2,842) | 654 (1,783) | -191 (938) | 556 (1,684) |
| 2026-07 | -2,692 | 1,330 | -761 (1,931) | -330 (2,362) | -750 (1,942) | -1,242 (1,451) | -1,294 (1,399) |
| 2026-08 | 4,384 | -5,753 | 5,540 (1,156) | 185 (-4,198) | 1,830 (-2,553) | 5,569 (1,185) | 2,438 (-1,946) |
| 2026-09 | 64 | -218 | -219 (-283) | 166 (102) | -90 (-153) | -191 (-254) | -32 (-95) |


### OBV leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | O4 | O5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 1,124 (1,285) | 1,443 (1,604) | 153 (314) | 1,026 (1,188) | 157 (319) |
| 2025-08 | 510 | -1,876 | 2,971 (2,461) | 2,714 (2,204) | 1,461 (950) | 1,756 (1,246) | 2,522 (2,012) |
| 2025-09 | -109 | -1,211 | 1,403 (1,512) | 968 (1,077) | 2,140 (2,249) | 1,272 (1,381) | -2,061 (-1,951) |
| 2025-10 | -470 | -894 | 1,520 (1,991) | 2,941 (3,412) | -1,219 (-749) | 1,302 (1,773) | 457 (927) |
| 2025-11 | -3,287 | 1,970 | -3,243 (44) | 1,648 (4,935) | 2,919 (6,206) | 2,988 (6,275) | -511 (2,776) |
| 2025-12 | -2,574 | 1,212 | -1,354 (1,220) | -844 (1,730) | -1,361 (1,213) | -1,234 (1,340) | -1,277 (1,297) |
| 2026-01 | 1,782 | -3,149 | 2,836 (1,054) | 527 (-1,256) | -1,158 (-2,940) | 1,029 (-753) | 1,964 (182) |
| 2026-02 | -122 | -1,111 | -528 (-406) | 452 (574) | 3,844 (3,966) | 1,005 (1,127) | 142 (264) |
| 2026-03 | 1,155 | -2,521 | 1,455 (301) | 2,799 (1,644) | 1,565 (410) | 1,979 (824) | 1,923 (768) |
| 2026-04 | 307 | -1,628 | 924 (616) | -413 (-721) | 20 (-287) | -690 (-997) | 388 (81) |
| 2026-05 | 5,789 | -7,161 | 1,160 (-4,629) | -424 (-6,213) | 2,789 (-3,001) | 157 (-5,632) | 133 (-5,656) |
| 2026-06 | -1,256 | -64 | 1,673 (2,928) | 1,761 (3,016) | 883 (2,138) | 1,526 (2,782) | 2,369 (3,625) |
| 2026-07 | -2,621 | 1,259 | -638 (1,983) | -325 (2,296) | -505 (2,116) | -619 (2,002) | -1,040 (1,581) |
| 2026-08 | 4,306 | -5,675 | 5,412 (1,106) | 263 (-4,043) | 2,200 (-2,106) | 574 (-3,732) | 5,249 (943) |
| 2026-09 | 55 | -231 | -237 (-292) | 163 (108) | -96 (-152) | 80 (25) | 432 (377) |


### OBV leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | O4 | O5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 1,249 (1,343) | 1,347 (1,441) | 198 (292) | 1,012 (1,106) | 196 (290) |
| 2025-08 | 754 | -2,120 | 2,845 (2,091) | 2,723 (1,969) | 180 (-574) | 1,743 (989) | 2,689 (1,935) |
| 2025-09 | -265 | -1,056 | 1,038 (1,302) | 897 (1,162) | 2,077 (2,342) | 1,233 (1,498) | -2,241 (-1,976) |
| 2025-10 | -484 | -880 | 1,667 (2,151) | 3,077 (3,561) | -1,573 (-1,089) | 1,514 (1,998) | 612 (1,096) |
| 2025-11 | -3,354 | 2,037 | -3,273 (81) | 1,765 (5,119) | 2,883 (6,237) | 2,710 (6,064) | -769 (2,585) |
| 2025-12 | -2,606 | 1,267 | -1,409 (1,198) | -880 (1,726) | -1,318 (1,288) | -1,156 (1,450) | -1,181 (1,426) |
| 2026-01 | 2,011 | -3,378 | 2,694 (683) | 380 (-1,631) | -1,092 (-3,102) | 1,080 (-930) | 1,632 (-379) |
| 2026-02 | 102 | -1,335 | -595 (-697) | 500 (398) | 3,141 (3,039) | 1,113 (1,011) | -622 (-724) |
| 2026-03 | 1,222 | -2,588 | 1,507 (284) | 2,684 (1,462) | 1,440 (217) | 1,965 (743) | 2,186 (964) |
| 2026-04 | 243 | -1,564 | 1,132 (890) | -503 (-745) | 176 (-67) | -721 (-963) | 634 (391) |
| 2026-05 | 5,761 | -7,132 | 1,325 (-4,436) | -254 (-6,015) | 2,886 (-2,876) | 183 (-5,578) | 0 (-5,761) |
| 2026-06 | -1,159 | -139 | 1,685 (2,844) | 1,714 (2,872) | 654 (1,813) | 1,349 (2,508) | 2,199 (3,358) |
| 2026-07 | -2,614 | 1,252 | -761 (1,853) | -330 (2,284) | -750 (1,864) | -692 (1,922) | -939 (1,676) |
| 2026-08 | 4,311 | -5,680 | 5,540 (1,229) | 185 (-4,126) | 1,830 (-2,481) | 709 (-3,602) | 5,102 (792) |
| 2026-09 | -37 | -139 | -219 (-183) | 166 (202) | -90 (-53) | 95 (131) | 430 (466) |


### OBV leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | O4 | O5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 577 (-3,977) | 86 (-4,468) | 1,489 (-3,065) | 102 (-4,453) | 1,106 (-3,448) |
| 2026-06 | -1,256 | -64 | 1,673 (2,928) | 1,761 (3,016) | 883 (2,138) | 1,526 (2,782) | 2,369 (3,625) |
| 2026-07 | -2,621 | 1,259 | -638 (1,983) | -325 (2,296) | -505 (2,116) | -619 (2,002) | -1,040 (1,581) |
| 2026-08 | 4,306 | -5,675 | 5,412 (1,106) | 263 (-4,043) | 2,200 (-2,106) | 574 (-3,732) | 5,249 (943) |
| 2026-09 | 55 | -231 | -237 (-292) | 163 (108) | -96 (-152) | 80 (25) | 432 (377) |


### OBV leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | G1 | G2 | G3 | O4 | O5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 751 (-3,726) | 167 (-4,310) | 1,409 (-3,068) | 161 (-4,316) | 950 (-3,527) |
| 2026-06 | -1,129 | -191 | 1,685 (2,814) | 1,714 (2,842) | 654 (1,783) | 1,349 (2,478) | 2,199 (3,328) |
| 2026-07 | -2,692 | 1,330 | -761 (1,931) | -330 (2,362) | -750 (1,942) | -692 (2,000) | -939 (1,753) |
| 2026-08 | 4,384 | -5,753 | 5,540 (1,156) | 185 (-4,198) | 1,830 (-2,553) | 709 (-3,675) | 5,102 (719) |
| 2026-09 | 64 | -218 | -219 (-283) | 166 (102) | -90 (-153) | 95 (31) | 430 (366) |


### MFI leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | M1 | M2 | M3 | M4 | M5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 988 (1,149) | 1,502 (1,663) | 1,067 (1,228) | 1,798 (1,959) | 208 (370) |
| 2025-08 | 510 | -1,876 | 1,683 (1,172) | 3,358 (2,848) | 3,169 (2,658) | -531 (-1,041) | 1,323 (813) |
| 2025-09 | -109 | -1,211 | 1,580 (1,689) | -204 (-94) | 620 (730) | 235 (345) | -1,200 (-1,091) |
| 2025-10 | -470 | -894 | 2,407 (2,878) | 1,323 (1,793) | -641 (-171) | 2,882 (3,352) | 1,575 (2,045) |
| 2025-11 | -3,287 | 1,970 | -2,229 (1,058) | -52 (3,235) | -132 (3,155) | -893 (2,394) | -822 (2,465) |
| 2025-12 | -2,574 | 1,212 | 1,356 (3,929) | -1,811 (763) | -616 (1,958) | -181 (2,393) | -674 (1,900) |
| 2026-01 | 1,782 | -3,149 | -276 (-2,059) | 109 (-1,673) | 826 (-956) | 1,187 (-595) | 239 (-1,543) |
| 2026-02 | -122 | -1,111 | -747 (-625) | 1,419 (1,541) | 562 (684) | 2,412 (2,534) | 466 (588) |
| 2026-03 | 1,155 | -2,521 | 3,103 (1,949) | 2,324 (1,170) | 2,692 (1,537) | 385 (-770) | 1,715 (560) |
| 2026-04 | 307 | -1,628 | 889 (582) | 455 (147) | 47 (-260) | 1 (-306) | 368 (61) |
| 2026-05 | 5,789 | -7,161 | 1,417 (-4,372) | 755 (-5,034) | -301 (-6,091) | 120 (-5,670) | 4,206 (-1,584) |
| 2026-06 | -1,256 | -64 | 1,842 (3,097) | 1,582 (2,838) | 293 (1,549) | 476 (1,732) | -522 (734) |
| 2026-07 | -2,621 | 1,259 | -1,194 (1,426) | -914 (1,707) | -33 (2,588) | 73 (2,694) | -1,619 (1,002) |
| 2026-08 | 4,306 | -5,675 | 2,590 (-1,715) | 1,172 (-3,134) | 875 (-3,431) | 757 (-3,549) | 2,511 (-1,795) |
| 2026-09 | 55 | -231 | -296 (-351) | -52 (-107) | 377 (322) | 0 (-55) | 94 (39) |


### MFI leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | M1 | M2 | M3 | M4 | M5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 638 (732) | 1,393 (1,487) | 1,067 (1,161) | 1,841 (1,935) | 773 (867) |
| 2025-08 | 754 | -2,120 | 1,351 (596) | 3,225 (2,471) | 3,228 (2,474) | -237 (-991) | 1,028 (274) |
| 2025-09 | -265 | -1,056 | 1,456 (1,720) | -124 (140) | 745 (1,010) | 127 (391) | -3 (262) |
| 2025-10 | -484 | -880 | 2,176 (2,660) | 1,269 (1,754) | -960 (-476) | 2,518 (3,002) | 1,143 (1,627) |
| 2025-11 | -3,354 | 2,037 | -2,207 (1,148) | -705 (2,649) | -122 (3,232) | -767 (2,587) | -1,083 (2,271) |
| 2025-12 | -2,606 | 1,267 | 467 (3,074) | -1,117 (1,489) | 42 (2,648) | -262 (2,345) | -835 (1,772) |
| 2026-01 | 2,011 | -3,378 | -709 (-2,719) | -49 (-2,060) | 987 (-1,024) | 1,175 (-836) | 82 (-1,928) |
| 2026-02 | 102 | -1,335 | -392 (-494) | 1,496 (1,394) | 765 (663) | 2,583 (2,480) | 173 (70) |
| 2026-03 | 1,222 | -2,588 | 3,427 (2,204) | 2,307 (1,085) | 2,428 (1,206) | 378 (-844) | 1,592 (369) |
| 2026-04 | 243 | -1,564 | 876 (633) | 547 (304) | 110 (-133) | -23 (-266) | 428 (186) |
| 2026-05 | 5,761 | -7,132 | 1,332 (-4,429) | 712 (-5,050) | -294 (-6,056) | 204 (-5,558) | 3,943 (-1,818) |
| 2026-06 | -1,159 | -139 | 1,443 (2,601) | 1,585 (2,744) | 141 (1,299) | 417 (1,575) | -559 (600) |
| 2026-07 | -2,614 | 1,252 | -1,337 (1,278) | -831 (1,783) | -154 (2,460) | 82 (2,696) | -1,629 (986) |
| 2026-08 | 4,311 | -5,680 | 2,491 (-1,819) | 1,244 (-3,067) | 852 (-3,459) | 712 (-3,598) | 2,328 (-1,983) |
| 2026-09 | -37 | -139 | -252 (-215) | -58 (-21) | 358 (394) | 0 (37) | 138 (174) |


### MFI leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | M1 | M2 | M3 | M4 | M5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 1,016 (-3,538) | 1,290 (-3,264) | 457 (-4,097) | 414 (-4,141) | 3,638 (-916) |
| 2026-06 | -1,256 | -64 | 1,842 (3,097) | 1,582 (2,838) | 293 (1,549) | 476 (1,732) | -522 (734) |
| 2026-07 | -2,621 | 1,259 | -1,194 (1,426) | -914 (1,707) | -33 (2,588) | 73 (2,694) | -1,619 (1,002) |
| 2026-08 | 4,306 | -5,675 | 2,590 (-1,715) | 1,172 (-3,134) | 875 (-3,431) | 757 (-3,549) | 2,511 (-1,795) |
| 2026-09 | 55 | -231 | -296 (-351) | -52 (-107) | 377 (322) | 0 (-55) | 94 (39) |


### MFI leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | M1 | M2 | M3 | M4 | M5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 965 (-3,512) | 1,265 (-3,212) | 394 (-4,084) | 469 (-4,008) | 3,620 (-858) |
| 2026-06 | -1,129 | -191 | 1,443 (2,571) | 1,585 (2,714) | 141 (1,269) | 417 (1,545) | -559 (570) |
| 2026-07 | -2,692 | 1,330 | -1,337 (1,355) | -831 (1,861) | -154 (2,538) | 82 (2,774) | -1,629 (1,064) |
| 2026-08 | 4,384 | -5,753 | 2,491 (-1,892) | 1,244 (-3,139) | 852 (-3,531) | 712 (-3,671) | 2,328 (-2,055) |
| 2026-09 | 64 | -218 | -252 (-316) | -58 (-122) | 358 (294) | 0 (-64) | 138 (74) |


### CMF leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | G4 | G5 | C3 | C4 | C5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 884 (1,045) | 945 (1,106) | 1,428 (1,589) | 189 (350) | 1,107 (1,268) |
| 2025-08 | 510 | -1,876 | 343 (-167) | 145 (-365) | 1,170 (660) | 251 (-259) | 229 (-281) |
| 2025-09 | -109 | -1,211 | -1,104 (-995) | 2,246 (2,355) | 111 (220) | -727 (-618) | -867 (-758) |
| 2025-10 | -470 | -894 | 3,545 (4,016) | 1,714 (2,185) | 196 (667) | 4,031 (4,501) | 523 (994) |
| 2025-11 | -3,287 | 1,970 | -2,412 (875) | 1,058 (4,345) | -2,022 (1,265) | -1,265 (2,022) | 244 (3,530) |
| 2025-12 | -2,574 | 1,212 | -171 (2,403) | 666 (3,240) | -2,092 (482) | -2,065 (509) | -2,166 (408) |
| 2026-01 | 1,782 | -3,149 | -528 (-2,310) | 339 (-1,443) | 1,478 (-304) | -144 (-1,926) | 500 (-1,282) |
| 2026-02 | -122 | -1,111 | 831 (953) | 1,772 (1,894) | 1,513 (1,635) | 504 (626) | 2,156 (2,277) |
| 2026-03 | 1,155 | -2,521 | 1,238 (84) | 1,690 (536) | 2,183 (1,028) | 1,265 (110) | -900 (-2,055) |
| 2026-04 | 307 | -1,628 | 1,352 (1,045) | -234 (-541) | 254 (-53) | 1,592 (1,285) | 1,057 (750) |
| 2026-05 | 5,789 | -7,161 | 6,165 (376) | 549 (-5,240) | 6,180 (391) | 4,855 (-934) | 4,628 (-1,161) |
| 2026-06 | -1,256 | -64 | -103 (1,153) | 933 (2,189) | 76 (1,332) | 110 (1,366) | 1,361 (2,617) |
| 2026-07 | -2,621 | 1,259 | -1,293 (1,328) | -1,223 (1,398) | -1,801 (820) | -1,729 (892) | -1,228 (1,393) |
| 2026-08 | 4,306 | -5,675 | 4,850 (544) | 2,614 (-1,691) | 4,311 (5) | 4,007 (-299) | 3,826 (-480) |
| 2026-09 | 55 | -231 | -159 (-214) | -13 (-69) | 205 (149) | -43 (-98) | -283 (-338) |


### CMF leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | G4 | G5 | C3 | C4 | C5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 1,070 (1,164) | 847 (941) | 1,523 (1,617) | 304 (397) | 422 (516) |
| 2025-08 | 754 | -2,120 | -189 (-943) | 83 (-671) | 1,548 (793) | 258 (-496) | -49 (-803) |
| 2025-09 | -265 | -1,056 | -1,145 (-881) | 2,079 (2,344) | 329 (594) | -5 (260) | -1,408 (-1,143) |
| 2025-10 | -484 | -880 | 3,387 (3,871) | 1,660 (2,145) | -3 (481) | 3,596 (4,081) | 110 (594) |
| 2025-11 | -3,354 | 2,037 | -1,506 (1,848) | 1,117 (4,471) | -2,857 (497) | -1,871 (1,483) | -303 (3,051) |
| 2025-12 | -2,606 | 1,267 | -376 (2,231) | 376 (2,982) | -1,754 (852) | -2,116 (490) | -3,596 (-990) |
| 2026-01 | 2,011 | -3,378 | -434 (-2,444) | 512 (-1,498) | 1,308 (-703) | -347 (-2,357) | 815 (-1,196) |
| 2026-02 | 102 | -1,335 | 816 (713) | 1,562 (1,460) | 1,172 (1,070) | 403 (300) | 1,950 (1,847) |
| 2026-03 | 1,222 | -2,588 | 1,317 (94) | 863 (-359) | 2,515 (1,293) | 1,418 (195) | 271 (-951) |
| 2026-04 | 243 | -1,564 | 1,278 (1,035) | -153 (-396) | 727 (485) | 1,637 (1,394) | 1,199 (957) |
| 2026-05 | 5,761 | -7,132 | 6,263 (501) | 615 (-5,147) | 6,563 (801) | 5,326 (-435) | 4,617 (-1,145) |
| 2026-06 | -1,159 | -139 | -191 (968) | 556 (1,715) | -97 (1,062) | 64 (1,223) | 1,346 (2,505) |
| 2026-07 | -2,614 | 1,252 | -1,242 (1,373) | -1,294 (1,321) | -2,721 (-106) | -1,864 (750) | -1,357 (1,257) |
| 2026-08 | 4,311 | -5,680 | 5,569 (1,258) | 2,438 (-1,873) | 4,786 (475) | 4,044 (-267) | 3,412 (-899) |
| 2026-09 | -37 | -139 | -191 (-154) | -32 (5) | 207 (243) | -56 (-20) | -306 (-269) |


### CMF leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | G4 | G5 | C3 | C4 | C5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 3,948 (-606) | 1,010 (-3,544) | 5,163 (609) | 4,029 (-526) | 4,561 (7) |
| 2026-06 | -1,256 | -64 | -103 (1,153) | 933 (2,189) | 76 (1,332) | 110 (1,366) | 1,361 (2,617) |
| 2026-07 | -2,621 | 1,259 | -1,293 (1,328) | -1,223 (1,398) | -1,801 (820) | -1,729 (892) | -1,228 (1,393) |
| 2026-08 | 4,306 | -5,675 | 4,850 (544) | 2,614 (-1,691) | 4,311 (5) | 4,007 (-299) | 3,826 (-480) |
| 2026-09 | 55 | -231 | -159 (-214) | -13 (-69) | 205 (149) | -43 (-98) | -283 (-338) |


### CMF leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | G4 | G5 | C3 | C4 | C5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 4,243 (-234) | 971 (-3,506) | 5,280 (802) | 4,402 (-75) | 4,622 (145) |
| 2026-06 | -1,129 | -191 | -191 (938) | 556 (1,684) | -97 (1,032) | 64 (1,193) | 1,346 (2,475) |
| 2026-07 | -2,692 | 1,330 | -1,242 (1,451) | -1,294 (1,399) | -2,721 (-28) | -1,864 (828) | -1,357 (1,335) |
| 2026-08 | 4,384 | -5,753 | 5,569 (1,185) | 2,438 (-1,946) | 4,786 (403) | 4,044 (-340) | 3,412 (-972) |
| 2026-09 | 64 | -218 | -191 (-254) | -32 (-95) | 207 (143) | -56 (-120) | -306 (-369) |


### Raw leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | -1,008 (195) | -1,047 (156) | 1,090 (2,293) | -750 (453) | -1,472 (-269) |
| 2025-08 | 510 | -1,876 | 1,054 (2,929) | 178 (2,054) | -112 (1,764) | -477 (1,399) | 570 (2,446) |
| 2025-09 | -109 | -1,211 | -510 (701) | 559 (1,770) | -1,156 (56) | 1,457 (2,668) | -280 (932) |
| 2025-10 | -470 | -894 | 1,343 (2,237) | 1,563 (2,457) | 1,394 (2,288) | 3,196 (4,090) | 2,255 (3,149) |
| 2025-11 | -3,287 | 1,970 | 1,594 (-376) | 2,275 (305) | 3,069 (1,100) | 1,540 (-430) | 2,818 (849) |
| 2025-12 | -2,574 | 1,212 | 52 (-1,160) | -558 (-1,770) | 862 (-350) | 1,359 (147) | 813 (-399) |
| 2026-01 | 1,782 | -3,149 | -365 (2,784) | -420 (2,729) | -248 (2,901) | -711 (2,438) | -635 (2,514) |
| 2026-02 | -122 | -1,111 | 1,670 (2,781) | 1,934 (3,044) | 1,154 (2,264) | 603 (1,713) | 626 (1,737) |
| 2026-03 | 1,155 | -2,521 | -91 (2,430) | -136 (2,385) | 525 (3,046) | -386 (2,135) | 115 (2,636) |
| 2026-04 | 307 | -1,628 | -1 (1,627) | -1,334 (294) | 757 (2,385) | -52 (1,576) | -246 (1,382) |
| 2026-05 | 5,789 | -7,161 | -1,221 (5,939) | -222 (6,938) | -3,682 (3,478) | -4,295 (2,865) | -3,054 (4,106) |
| 2026-06 | -1,256 | -64 | 860 (924) | -701 (-638) | 11 (75) | 2,878 (2,941) | 1,000 (1,064) |
| 2026-07 | -2,621 | 1,259 | -224 (-1,483) | 1,567 (308) | 1,163 (-96) | -906 (-2,165) | 396 (-863) |
| 2026-08 | 4,306 | -5,675 | 360 (6,035) | -442 (5,233) | -1,348 (4,327) | -225 (5,450) | 92 (5,768) |
| 2026-09 | 55 | -231 | -267 (-35) | -123 (108) | -390 (-159) | -182 (49) | -308 (-77) |


### Raw leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | -890 (381) | -801 (469) | 907 (2,178) | -155 (1,116) | -1,433 (-162) |
| 2025-08 | 754 | -2,120 | 925 (3,044) | 387 (2,507) | -373 (1,746) | -659 (1,461) | 447 (2,566) |
| 2025-09 | -265 | -1,056 | -519 (536) | 445 (1,500) | -1,226 (-171) | 1,297 (2,353) | -302 (754) |
| 2025-10 | -484 | -880 | 1,495 (2,375) | 1,440 (2,320) | 1,333 (2,213) | 3,022 (3,902) | 2,217 (3,097) |
| 2025-11 | -3,354 | 2,037 | 1,682 (-355) | 2,246 (209) | 2,924 (887) | 1,837 (-200) | 2,923 (886) |
| 2025-12 | -2,606 | 1,267 | 5 (-1,261) | -610 (-1,877) | 593 (-674) | 1,091 (-175) | 738 (-528) |
| 2026-01 | 2,011 | -3,378 | -445 (2,933) | -340 (3,038) | -674 (2,704) | -1,260 (2,117) | -642 (2,736) |
| 2026-02 | 102 | -1,335 | 1,636 (2,971) | 1,776 (3,111) | 929 (2,264) | 880 (2,215) | 557 (1,892) |
| 2026-03 | 1,222 | -2,588 | -117 (2,472) | -131 (2,457) | 568 (3,157) | -524 (2,065) | 131 (2,720) |
| 2026-04 | 243 | -1,564 | -13 (1,551) | -1,379 (185) | 903 (2,467) | -170 (1,394) | -255 (1,308) |
| 2026-05 | 5,761 | -7,132 | -1,050 (6,083) | -175 (6,958) | -3,920 (3,212) | -4,309 (2,823) | -2,841 (4,292) |
| 2026-06 | -1,159 | -139 | 804 (943) | -482 (-343) | -176 (-38) | 2,761 (2,899) | 996 (1,135) |
| 2026-07 | -2,614 | 1,252 | -135 (-1,387) | 1,601 (348) | 1,069 (-183) | -990 (-2,242) | 384 (-868) |
| 2026-08 | 4,311 | -5,680 | 250 (5,930) | -559 (5,122) | -1,397 (4,283) | -495 (5,185) | 12 (5,692) |
| 2026-09 | -37 | -139 | -266 (-127) | -216 (-77) | -375 (-235) | -200 (-60) | -303 (-163) |


### Raw leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | -1,190 (3,985) | -347 (4,829) | -1,550 (3,625) | -2,212 (2,963) | -1,599 (3,576) |
| 2026-06 | -1,256 | -64 | 860 (924) | -701 (-638) | 11 (75) | 2,878 (2,941) | 1,000 (1,064) |
| 2026-07 | -2,621 | 1,259 | -224 (-1,483) | 1,567 (308) | 1,163 (-96) | -906 (-2,165) | 396 (-863) |
| 2026-08 | 4,306 | -5,675 | 360 (6,035) | -442 (5,233) | -1,348 (4,327) | -225 (5,450) | 92 (5,768) |
| 2026-09 | 55 | -231 | -267 (-35) | -123 (108) | -390 (-159) | -182 (49) | -308 (-77) |


### Raw leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | -1,031 (4,067) | -356 (4,742) | -1,790 (3,309) | -2,019 (3,079) | -1,525 (3,574) |
| 2026-06 | -1,129 | -191 | 804 (995) | -482 (-291) | -176 (14) | 2,761 (2,952) | 996 (1,187) |
| 2026-07 | -2,692 | 1,330 | -135 (-1,465) | 1,601 (270) | 1,069 (-261) | -990 (-2,320) | 384 (-946) |
| 2026-08 | 4,384 | -5,753 | 250 (6,003) | -559 (5,194) | -1,397 (4,356) | -495 (5,258) | 12 (5,765) |
| 2026-09 | 64 | -218 | -266 (-48) | -216 (1) | -375 (-157) | -200 (18) | -303 (-85) |


### OBV shorts leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | OS1 | OS2 |
| --- | --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 37 (1,241) | 37 (1,241) |
| 2025-08 | 510 | -1,876 | -414 (1,461) | -414 (1,461) |
| 2025-09 | -109 | -1,211 | 351 (1,562) | 351 (1,562) |
| 2025-10 | -470 | -894 | 0 (894) | 0 (894) |
| 2025-11 | -3,287 | 1,970 | 0 (-1,970) | 0 (-1,970) |
| 2025-12 | -2,574 | 1,212 | 0 (-1,212) | 0 (-1,212) |
| 2026-01 | 1,782 | -3,149 | -1,123 (2,026) | -1,123 (2,026) |
| 2026-02 | -122 | -1,111 | 0 (1,111) | 0 (1,111) |
| 2026-03 | 1,155 | -2,521 | -107 (2,414) | -107 (2,414) |
| 2026-04 | 307 | -1,628 | -268 (1,360) | -268 (1,360) |
| 2026-05 | 5,789 | -7,161 | 1,447 (8,608) | 1,447 (8,608) |
| 2026-06 | -1,256 | -64 | 995 (1,059) | 995 (1,059) |
| 2026-07 | -2,621 | 1,259 | -209 (-1,468) | -209 (-1,468) |
| 2026-08 | 4,306 | -5,675 | -180 (5,496) | -180 (5,496) |
| 2026-09 | 55 | -231 | 223 (455) | 223 (455) |


### OBV shorts leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | OS1 | OS2 |
| --- | --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 111 (1,382) | 111 (1,382) |
| 2025-08 | 754 | -2,120 | -349 (1,770) | -349 (1,770) |
| 2025-09 | -265 | -1,056 | 380 (1,436) | 380 (1,436) |
| 2025-10 | -484 | -880 | 0 (880) | 0 (880) |
| 2025-11 | -3,354 | 2,037 | 0 (-2,037) | 0 (-2,037) |
| 2025-12 | -2,606 | 1,267 | 0 (-1,267) | 0 (-1,267) |
| 2026-01 | 2,011 | -3,378 | -1,109 (2,268) | -1,109 (2,268) |
| 2026-02 | 102 | -1,335 | 0 (1,335) | 0 (1,335) |
| 2026-03 | 1,222 | -2,588 | -175 (2,413) | -175 (2,413) |
| 2026-04 | 243 | -1,564 | -243 (1,321) | -243 (1,321) |
| 2026-05 | 5,761 | -7,132 | 1,434 (8,567) | 1,434 (8,567) |
| 2026-06 | -1,159 | -139 | 1,006 (1,144) | 1,006 (1,144) |
| 2026-07 | -2,614 | 1,252 | -148 (-1,400) | -148 (-1,400) |
| 2026-08 | 4,311 | -5,680 | -156 (5,524) | -156 (5,524) |
| 2026-09 | -37 | -139 | 206 (346) | 206 (346) |


### OBV shorts leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | OS1 | OS2 |
| --- | --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 1,241 (6,417) | 1,241 (6,417) |
| 2026-06 | -1,256 | -64 | 995 (1,059) | 995 (1,059) |
| 2026-07 | -2,621 | 1,259 | -209 (-1,468) | -209 (-1,468) |
| 2026-08 | 4,306 | -5,675 | -180 (5,496) | -180 (5,496) |
| 2026-09 | 55 | -231 | 223 (455) | 223 (455) |


### OBV shorts leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | OS1 | OS2 |
| --- | --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 1,246 (6,344) | 1,246 (6,344) |
| 2026-06 | -1,129 | -191 | 1,006 (1,196) | 1,006 (1,196) |
| 2026-07 | -2,692 | 1,330 | -148 (-1,478) | -148 (-1,478) |
| 2026-08 | 4,384 | -5,753 | -156 (5,597) | -156 (5,597) |
| 2026-09 | 64 | -218 | 206 (424) | 206 (424) |


### MFI shorts leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | MS1 |
| --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 678 (1,881) |
| 2025-08 | 510 | -1,876 | -349 (1,526) |
| 2025-09 | -109 | -1,211 | 517 (1,728) |
| 2025-10 | -470 | -894 | 893 (1,787) |
| 2025-11 | -3,287 | 1,970 | -2,192 (-4,162) |
| 2025-12 | -2,574 | 1,212 | 424 (-788) |
| 2026-01 | 1,782 | -3,149 | 573 (3,722) |
| 2026-02 | -122 | -1,111 | 592 (1,702) |
| 2026-03 | 1,155 | -2,521 | -22 (2,499) |
| 2026-04 | 307 | -1,628 | 153 (1,781) |
| 2026-05 | 5,789 | -7,161 | -358 (6,803) |
| 2026-06 | -1,256 | -64 | 478 (542) |
| 2026-07 | -2,621 | 1,259 | 890 (-369) |
| 2026-08 | 4,306 | -5,675 | -891 (4,784) |
| 2026-09 | 55 | -231 | 85 (316) |


### MFI shorts leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | MS1 |
| --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 692 (1,962) |
| 2025-08 | 754 | -2,120 | -243 (1,877) |
| 2025-09 | -265 | -1,056 | 577 (1,633) |
| 2025-10 | -484 | -880 | 859 (1,739) |
| 2025-11 | -3,354 | 2,037 | -2,161 (-4,198) |
| 2025-12 | -2,606 | 1,267 | 375 (-892) |
| 2026-01 | 2,011 | -3,378 | 517 (3,895) |
| 2026-02 | 102 | -1,335 | 580 (1,916) |
| 2026-03 | 1,222 | -2,588 | -11 (2,578) |
| 2026-04 | 243 | -1,564 | 131 (1,695) |
| 2026-05 | 5,761 | -7,132 | -378 (6,754) |
| 2026-06 | -1,159 | -139 | 429 (568) |
| 2026-07 | -2,614 | 1,252 | 848 (-405) |
| 2026-08 | 4,311 | -5,680 | -897 (4,783) |
| 2026-09 | -37 | -139 | 116 (256) |


### MFI shorts leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | MS1 |
| --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 0 (5,175) |
| 2026-06 | -1,256 | -64 | 478 (542) |
| 2026-07 | -2,621 | 1,259 | 890 (-369) |
| 2026-08 | 4,306 | -5,675 | -891 (4,784) |
| 2026-09 | 55 | -231 | 85 (316) |


### MFI shorts leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | MS1 |
| --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | 0 (5,099) |
| 2026-06 | -1,129 | -191 | 429 (620) |
| 2026-07 | -2,692 | 1,330 | 848 (-483) |
| 2026-08 | 4,384 | -5,753 | -897 (4,856) |
| 2026-09 | 64 | -218 | 116 (334) |


### CMF shorts leaders: full, 0m delay

| Month | Clock long $ | Clock short $ | CS1 |
| --- | --- | --- | --- |
| 2025-07 | -161 | -1,203 | 1,680 (2,884) |
| 2025-08 | 510 | -1,876 | -1,296 (579) |
| 2025-09 | -109 | -1,211 | -708 (503) |
| 2025-10 | -470 | -894 | -110 (784) |
| 2025-11 | -3,287 | 1,970 | 448 (-1,521) |
| 2025-12 | -2,574 | 1,212 | 505 (-707) |
| 2026-01 | 1,782 | -3,149 | 528 (3,677) |
| 2026-02 | -122 | -1,111 | 302 (1,412) |
| 2026-03 | 1,155 | -2,521 | -288 (2,233) |
| 2026-04 | 307 | -1,628 | -397 (1,231) |
| 2026-05 | 5,789 | -7,161 | 291 (7,451) |
| 2026-06 | -1,256 | -64 | 170 (234) |
| 2026-07 | -2,621 | 1,259 | 1,043 (-216) |
| 2026-08 | 4,306 | -5,675 | -647 (5,028) |
| 2026-09 | 55 | -231 | 22 (254) |


### CMF shorts leaders: full, 1m delay

| Month | Clock long $ | Clock short $ | CS1 |
| --- | --- | --- | --- |
| 2025-07 | -94 | -1,271 | 1,822 (3,093) |
| 2025-08 | 754 | -2,120 | -1,267 (853) |
| 2025-09 | -265 | -1,056 | -686 (369) |
| 2025-10 | -484 | -880 | -21 (859) |
| 2025-11 | -3,354 | 2,037 | 448 (-1,589) |
| 2025-12 | -2,606 | 1,267 | 589 (-678) |
| 2026-01 | 2,011 | -3,378 | 609 (3,987) |
| 2026-02 | 102 | -1,335 | 353 (1,688) |
| 2026-03 | 1,222 | -2,588 | -409 (2,179) |
| 2026-04 | 243 | -1,564 | -420 (1,144) |
| 2026-05 | 5,761 | -7,132 | 221 (7,353) |
| 2026-06 | -1,159 | -139 | 50 (189) |
| 2026-07 | -2,614 | 1,252 | 687 (-565) |
| 2026-08 | 4,311 | -5,680 | -512 (5,168) |
| 2026-09 | -37 | -139 | 147 (286) |


### CMF shorts leaders: recent, 0m delay

| Month | Clock long $ | Clock short $ | CS1 |
| --- | --- | --- | --- |
| 2026-05 | 4,554 | -5,175 | 18 (5,194) |
| 2026-06 | -1,256 | -64 | 170 (234) |
| 2026-07 | -2,621 | 1,259 | 1,043 (-216) |
| 2026-08 | 4,306 | -5,675 | -647 (5,028) |
| 2026-09 | 55 | -231 | 22 (254) |


### CMF shorts leaders: recent, 1m delay

| Month | Clock long $ | Clock short $ | CS1 |
| --- | --- | --- | --- |
| 2026-05 | 4,477 | -5,099 | -35 (5,063) |
| 2026-06 | -1,129 | -191 | 50 (241) |
| 2026-07 | -2,692 | 1,330 | 687 (-643) |
| 2026-08 | 4,384 | -5,753 | -512 (5,241) |
| 2026-09 | 64 | -218 | 147 (365) |


## Saved-ledger risk paths and concentration

These are read-only inspections, not new strategies. The pinned helper verified source/input/artifact hashes and checked **62 cases:31 IDs ×two windows**, immediate model, completed trades only. Negative or tiny closed-net denominators make concentration percentages economically awkward; they are shown rather than interpreted as independent win probabilities. Gross adverse price movement is not account DD or a stop/liquidation bound. Open cutoff positions are already accounted for in the main tables, not in this completed-trade path supplement.

| Setup / window | Closes | Five largest winners $ | % of closed net | Worst gross adverse % / $ | Worst path timestamp UTC | Eventual close net $ |
| --- | --- | --- | --- | --- | --- | --- |
| clock_long / full | 861 | 7,095 | 199.91% | -53.52% / -5,352 | 2025-10-10T21:21:00.000Z | -1,601 |
| clock_long / recent | 219 | 5,626 | 106.49% | -13.05% / -1,305 | 2026-06-04T10:52:00.000Z | -1,078 |
| clock_short / full | 861 | 6,119 | n/a | -23.65% / -2,365 | 2026-08-19T21:45:00.000Z | -1,885 |
| clock_short / recent | 219 | 4,214 | n/a | -23.65% / -2,365 | 2026-08-19T21:45:00.000Z | -1,885 |
| G1 / full | 480 | 8,052 | 55.35% | -49.05% / -4,905 | 2025-10-10T21:21:00.000Z | -232 |
| G1 / recent | 121 | 5,540 | 80.78% | -9.29% / -929 | 2026-05-23T00:22:00.000Z | -760 |
| G2 / full | 220 | 5,712 | 42.28% | -41.87% / -4,187 | 2025-10-10T21:21:00.000Z | 1,242 |
| G2 / recent | 43 | 3,321 | 186.14% | -6.56% / -656 | 2026-06-04T10:52:00.000Z | -342 |
| G3 / full | 393 | 5,362 | 39.81% | -51.21% / -5,121 | 2025-10-10T21:21:00.000Z | -1,093 |
| G3 / recent | 93 | 3,223 | 84.66% | -8.72% / -872 | 2026-06-10T00:41:00.000Z | -710 |
| G4 / full | 629 | 7,463 | 55.69% | -53.23% / -5,323 | 2025-10-10T21:21:00.000Z | -1,395 |
| G4 / recent | 159 | 5,713 | 79.31% | -13.70% / -1,370 | 2026-06-04T10:52:00.000Z | -1,256 |
| G5 / full | 292 | 5,821 | 44.09% | -51.21% / -5,121 | 2025-10-10T21:21:00.000Z | -1,093 |
| G5 / recent | 73 | 2,903 | 87.44% | -7.08% / -708 | 2026-06-10T00:41:00.000Z | -402 |
| O4 / full | 219 | 5,275 | 43.70% | -12.59% / -1,259 | 2025-10-10T22:46:00.000Z | -196 |
| O4 / recent | 43 | 3,623 | 228.89% | -7.19% / -719 | 2026-06-25T13:59:00.000Z | 110 |
| O5 / full | 550 | 7,066 | 65.13% | -51.72% / -5,172 | 2025-10-10T21:21:00.000Z | -902 |
| O5 / recent | 142 | 5,601 | 69.02% | -10.34% / -1,034 | 2026-06-04T10:52:00.000Z | -783 |
| M1 / full | 441 | 5,378 | 41.01% | -12.43% / -1,243 | 2026-01-30T02:53:00.000Z | -960 |
| M1 / recent | 106 | 3,176 | 80.26% | -11.22% / -1,122 | 2026-06-04T10:52:00.000Z | -1,011 |
| M2 / full | 349 | 4,727 | 43.10% | -51.99% / -5,199 | 2025-10-10T21:21:00.000Z | -1,323 |
| M2 / recent | 82 | 2,892 | 93.96% | -9.66% / -966 | 2026-06-10T00:41:00.000Z | -552 |
| M3 / full | 278 | 5,195 | 60.11% | -11.43% / -1,143 | 2025-11-22T20:09:00.000Z | -865 |
| M3 / recent | 60 | 2,988 | 165.48% | -10.89% / -1,089 | 2026-06-04T10:52:00.000Z | -778 |
| M4 / full | 108 | 5,327 | 61.08% | -9.36% / -936 | 2026-06-04T10:52:00.000Z | -567 |
| M4 / recent | 20 | 2,610 | 151.74% | -9.36% / -936 | 2026-06-04T10:52:00.000Z | -567 |
| M5 / full | 551 | 6,895 | 87.61% | -53.23% / -5,323 | 2025-10-10T21:21:00.000Z | -1,395 |
| M5 / recent | 138 | 3,902 | 95.13% | -10.07% / -1,007 | 2026-06-10T00:41:00.000Z | -633 |
| C3 / full | 758 | 8,034 | 59.89% | -53.28% / -5,328 | 2025-10-10T21:21:00.000Z | -1,024 |
| C3 / recent | 196 | 5,816 | 71.13% | -10.61% / -1,061 | 2026-06-05T07:13:00.000Z | -655 |
| C4 / full | 628 | 7,583 | 69.93% | -53.31% / -5,331 | 2025-10-10T21:21:00.000Z | -1,344 |
| C4 / recent | 158 | 5,865 | 91.84% | -13.63% / -1,363 | 2026-06-04T10:52:00.000Z | -1,162 |
| C5 / full | 613 | 8,293 | 81.42% | -14.00% / -1,400 | 2025-10-30T19:42:00.000Z | -1,321 |
| C5 / recent | 157 | 5,374 | 65.24% | -8.88% / -888 | 2026-06-05T07:13:00.000Z | -421 |
| R1 / full | 214 | 2,741 | 84.44% | -12.80% / -1,280 | 2026-01-27T08:54:00.000Z | -1,133 |
| R1 / recent | 70 | 2,016 | n/a | -11.20% / -1,120 | 2026-05-24T09:51:00.000Z | -908 |
| R2 / full | 210 | 4,532 | 146.62% | -13.99% / -1,399 | 2026-01-27T04:57:00.000Z | -1,341 |
| R2 / recent | 53 | 3,057 | n/a | -12.05% / -1,205 | 2026-05-21T15:27:00.000Z | -706 |
| R3 / full | 613 | 2,636 | 85.32% | -18.41% / -1,841 | 2026-08-19T21:45:00.000Z | -1,677 |
| R3 / recent | 154 | 2,044 | n/a | -18.41% / -1,841 | 2026-08-19T21:45:00.000Z | -1,677 |
| R4 / full | 358 | 5,048 | 177.22% | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| R4 / recent | 97 | 3,938 | n/a | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| R5 / full | 209 | 3,532 | 131.20% | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| R5 / recent | 65 | 2,853 | n/a | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| OS1 / full | 38 | 2,455 | 463.08% | -11.94% / -1,194 | 2026-01-27T23:56:00.000Z | -1,123 |
| OS1 / recent | 13 | 2,124 | 114.97% | -8.17% / -817 | 2026-05-21T09:31:00.000Z | -441 |
| OS2 / full | 38 | 2,455 | 463.08% | -11.94% / -1,194 | 2026-01-27T23:56:00.000Z | -1,123 |
| OS2 / recent | 13 | 2,124 | 114.97% | -8.17% / -817 | 2026-05-21T09:31:00.000Z | -441 |
| MS1 / full | 73 | 3,302 | 224.45% | -8.57% / -857 | 2025-11-18T03:48:00.000Z | -737 |
| MS1 / recent | 18 | 2,046 | 364.09% | -5.34% / -534 | 2026-08-26T10:38:00.000Z | -281 |
| CS1 / full | 100 | 2,233 | 144.73% | -10.73% / -1,073 | 2025-08-15T03:59:00.000Z | -1,079 |
| CS1 / recent | 32 | 1,885 | 310.75% | -5.31% / -531 | 2026-08-21T08:42:00.000Z | -291 |
| obv_60m_n10_recovery_t0.5_short_fixed12h / full | 211 | 4,758 | 2469.20% | -12.80% / -1,280 | 2026-01-27T08:54:00.000Z | -1,133 |
| obv_60m_n10_recovery_t0.5_short_fixed12h / recent | 67 | 2,642 | n/a | -11.20% / -1,120 | 2026-05-24T09:51:00.000Z | -908 |
| cmf_5m_n40_into_t0.2_short_fixed12h / full | 438 | 4,272 | n/a | -22.50% / -2,250 | 2026-08-19T21:45:00.000Z | -1,967 |
| cmf_5m_n40_into_t0.2_short_fixed12h / recent | 109 | 3,383 | n/a | -22.50% / -2,250 | 2026-08-19T21:45:00.000Z | -1,967 |
| obv_60m_n10_into_t0.5_short_fixed12h / full | 208 | 4,779 | 239.19% | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| obv_60m_n10_into_t0.5_short_fixed12h / recent | 64 | 3,657 | 3032.40% | -17.43% / -1,743 | 2026-08-19T21:45:00.000Z | -1,244 |
| mfi_240m_n28_trend_t0_short_fixed12h / full | 71 | 3,302 | 38288.13% | -15.70% / -1,570 | 2026-02-06T02:02:00.000Z | -923 |
| mfi_240m_n28_trend_t0_short_fixed12h / recent | 18 | 2,114 | 180.94% | -5.34% / -534 | 2026-08-26T10:38:00.000Z | -281 |
| cmf_240m_n10_recovery_t0.2_short_fixed12h / full | 100 | 3,377 | 146.75% | -10.73% / -1,073 | 2025-08-15T03:59:00.000Z | -1,079 |
| cmf_240m_n10_recovery_t0.2_short_fixed12h / recent | 32 | 1,825 | 1822.94% | -7.80% / -780 | 2026-08-21T13:41:00.000Z | -620 |

### Additional delayed-path cross-check

A read-only check of the same accepted ledgers inspected eight specified IDs at both delays (**16 cases**, no new rules). The observed historical low is October10,2025 21:21 UTC, not a signal input. “Next entry” is the next actual executed trade, not a claim every intervening crossing was absent; occupancy and finalized bars remain authoritative. These data describe this particular path, not a crash-prevention guarantee.

| Setup | Delay | Worst full gross adverse % | Worst timestamp UTC | Held Oct10 21:21 UTC? | Previous exit before low | Next entry after low |
| --- | --- | --- | --- | --- | --- | --- |
| clock_long | 0m | -53.52% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T12:00:00.000Z | 2025-10-11T00:00:00.000Z |
| clock_long | 1m | -51.37% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T18:46:00.000Z | 2025-10-11T06:49:00.000Z |
| G1 | 0m | -49.05% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T17:05:00.000Z | 2025-10-11T14:30:00.000Z |
| G1 | 1m | -48.70% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T17:07:00.000Z | 2025-10-11T14:31:00.000Z |
| O4 | 0m | -12.59% | 2025-10-10T22:46:00.000Z | no | 2025-10-10T04:00:00.000Z | 2025-10-10T22:00:00.000Z |
| O4 | 1m | -11.13% | 2025-10-10T22:46:00.000Z | no | 2025-10-10T04:02:00.000Z | 2025-10-10T22:01:00.000Z |
| M1 | 0m | -12.43% | 2026-01-30T02:53:00.000Z | no | 2025-10-10T17:45:00.000Z | 2025-10-10T21:30:00.000Z |
| M1 | 1m | -12.46% | 2026-01-30T02:53:00.000Z | no | 2025-10-10T17:47:00.000Z | 2025-10-10T21:31:00.000Z |
| M3 | 0m | -11.43% | 2025-11-22T20:09:00.000Z | no | 2025-10-09T21:30:00.000Z | 2025-10-10T21:30:00.000Z |
| M3 | 1m | -11.51% | 2025-11-22T20:09:00.000Z | no | 2025-10-09T21:32:00.000Z | 2025-10-10T21:31:00.000Z |
| M4 | 0m | -9.36% | 2026-06-04T10:52:00.000Z | no | 2025-10-07T12:00:00.000Z | 2025-10-10T21:30:00.000Z |
| M4 | 1m | -9.21% | 2026-01-20T17:47:00.000Z | no | 2025-10-07T12:02:00.000Z | 2025-10-10T21:31:00.000Z |
| G4 | 0m | -53.23% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T03:10:00.000Z | 2025-10-11T01:50:00.000Z |
| G4 | 1m | -53.22% | 2025-10-10T21:21:00.000Z | yes | 2025-10-10T03:12:00.000Z | 2025-10-11T01:51:00.000Z |
| C5 | 0m | -14.00% | 2025-10-30T19:42:00.000Z | no | 2025-10-10T21:00:00.000Z | 2025-10-10T21:30:00.000Z |
| C5 | 1m | -13.83% | 2025-10-30T19:42:00.000Z | no | 2025-10-10T21:02:00.000Z | 2025-10-10T21:31:00.000Z |


## Complete ranked grid: all1,800 definitions retained

Sorted full immediate delta to SAME-SIDE clock, not absolute profit. Four cells show net/closes:full0m, full+1m, recent0m, recent+1m. Sparse or failed rules are retained; no outcome-driven threshold changes.

| # | Exact ID | Full 0m | Full +1m | Recent 0m | Recent +1m | Failure codes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `obv_60m_n10_recovery_t0.5_short_indicator_or12h` | 3,246/214 | 3,363/210 | -461/70 | -378/68 | P,M,C |
| 2 | `cmf_15m_n40_recovery_t0.2_short_fixed12h` | 3,091/210 | 3,201/210 | -46/53 | -13/53 | P,M,C |
| 3 | `cmf_5m_n40_into_t0.2_short_indicator_or12h` | 3,090/613 | 1,087/613 | -2,113/154 | -2,669/154 | P,M,C |
| 4 | `cmf_60m_n10_into_t0.2_short_fixed12h` | 3,049/358 | 2,126/344 | -648/97 | -943/95 | P,M,C |
| 5 | `obv_60m_n10_into_t0.5_short_indicator_or12h` | 2,692/209 | 2,631/207 | -418/65 | -435/65 | P,M,C |
| 6 | `cmf_240m_n40_recovery_t0.05_short_indicator_or12h` | 2,458/89 | 2,650/83 | -2,127/21 | -1,768/19 | P,M,C |
| 7 | `cmf_15m_n40_into_t0.2_short_fixed12h` | 2,317/215 | 2,527/215 | -674/54 | -800/54 | P,M,C |
| 8 | `cmf_240m_n10_recovery_t0.2_short_fixed12h` | 2,301/100 | 1,869/96 | 100/32 | -203/29 | P,M,C |
| 9 | `cmf_30m_n40_trend_t0.2_short_indicator_or12h` | 2,188/41 | 2,571/41 | 674/7 | 961/7 | N,M |
| 10 | `cmf_5m_n20_into_t0.5_short_fixed12h` | 2,113/84 | 2,154/84 | -463/17 | -211/17 | P,M,C |
| 11 | `obv_60m_n10_into_t0.5_short_fixed12h` | 1,998/208 | 2,432/204 | 121/64 | 49/64 | M,C |
| 12 | `cmf_240m_n40_recovery_t0.05_short_fixed12h` | 1,593/89 | 1,904/83 | -2,153/21 | -1,619/19 | P,M,C |
| 13 | `cmf_240m_n10_recovery_t0.2_short_indicator_or12h` | 1,543/100 | 1,610/96 | 606/32 | 337/29 | M |
| 14 | `mfi_240m_n28_trend_t0_short_indicator_or12h` | 1,471/73 | 1,435/73 | 562/18 | 496/18 | M |
| 15 | `obv_240m_n20_recovery_t0.5_short_fixed12h` | 1,345/15 | 1,296/13 | -58/4 | -374/3 | N,P,M,C |
| 16 | `obv_240m_n20_recovery_t0.5_short_indicator_or12h` | 1,345/15 | 1,287/13 | -58/4 | -374/3 | N,P,M,C |
| 17 | `mfi_60m_n28_trend_t0.6_short_fixed12h` | 1,288/17 | 1,200/17 | 259/5 | 283/5 | N,M |
| 18 | `mfi_60m_n28_trend_t0.6_short_indicator_or12h` | 1,288/17 | 1,200/17 | 259/5 | 283/5 | N,M |
| 19 | `mfi_15m_n14_into_t0.9_short_indicator_or12h` | 1,278/16 | 1,201/16 | 300/4 | 173/4 | N,M |
| 20 | `mfi_240m_n7_recovery_t0.9_short_fixed12h` | 1,138/25 | 1,257/25 | -655/9 | -536/9 | N,P,M,C |
| 21 | `cmf_30m_n40_trend_t0.2_short_fixed12h` | 1,064/41 | 1,547/41 | 1,018/7 | 1,281/7 | N,M |
| 22 | `cmf_240m_n20_recovery_t0.05_short_fixed12h` | 1,015/126 | 2,313/112 | 1,139/31 | 1,339/29 | M,C |
| 23 | `mfi_240m_n7_recovery_t0.9_short_indicator_or12h` | 964/25 | 1,108/25 | -880/9 | -763/9 | N,P,M,C |
| 24 | `mfi_15m_n14_recovery_t0.9_short_indicator_or12h` | 957/16 | 906/16 | 261/4 | 183/4 | N,M |
| 25 | `cmf_5m_n20_recovery_t0.5_short_fixed12h` | 934/85 | 743/85 | -48/17 | -85/17 | P,M,C |
| 26 | `mfi_240m_n14_recovery_t0.8_short_fixed12h` | 878/8 | 895/8 | 101/4 | 83/4 | N,M |
| 27 | `mfi_240m_n14_recovery_t0.8_short_indicator_or12h` | 878/8 | 895/8 | 101/4 | 83/4 | N,M |
| 28 | `obv_240m_n10_recovery_t0.75_short_fixed12h` | 848/12 | 541/11 | -39/4 | -21/4 | N,P,M,C |
| 29 | `mfi_15m_n14_into_t0.9_short_fixed12h` | 791/16 | 577/16 | 671/4 | 551/4 | N,M |
| 30 | `obv_5m_n40_trend_t0.5_short_indicator_or12h` | 779/174 | 857/174 | -638/39 | -708/39 | P,M,C |
| 31 | `mfi_240m_n14_recovery_t0.9_short_fixed12h` | 772/2 | 755/2 | 267/1 | 251/1 | N,M |
| 32 | `mfi_240m_n14_recovery_t0.9_short_indicator_or12h` | 772/2 | 755/2 | 267/1 | 251/1 | N,M |
| 33 | `mfi_15m_n14_recovery_t0.9_short_fixed12h` | 757/16 | 576/16 | 559/4 | 583/4 | N,M |
| 34 | `obv_240m_n40_into_t0.25_short_fixed12h` | 753/38 | 957/36 | 2,071/13 | 2,154/13 | M |
| 35 | `obv_240m_n40_into_t0.25_short_indicator_or12h` | 753/38 | 957/36 | 2,071/13 | 2,154/13 | M |
| 36 | `obv_60m_n40_trend_t0.5_short_fixed12h` | 726/6 | 704/6 | -123/2 | -125/2 | N,P,M,C |
| 37 | `obv_60m_n40_trend_t0.5_short_indicator_or12h` | 726/6 | 705/6 | -123/2 | -124/2 | N,P,M,C |
| 38 | `cmf_240m_n40_into_t0.05_short_indicator_or12h` | 719/86 | 70/84 | -2,642/20 | -2,510/20 | P,M,C |
| 39 | `obv_240m_n10_recovery_t0.75_short_indicator_or12h` | 660/12 | 370/11 | -227/4 | -198/4 | N,P,M,C |
| 40 | `obv_30m_n40_trend_t0_short_fixed12h` | 548/334 | -1,819/327 | 1,389/85 | 157/83 | P,M,C |
| 41 | `cmf_240m_n40_into_t0.05_short_fixed12h` | 537/86 | -85/84 | -2,642/20 | -2,510/20 | P,M,C |
| 42 | `mfi_240m_n28_recovery_t0.8_short_fixed12h` | 505/1 | 504/1 | 0/0 | 0/0 | N,P,M,C |
| 43 | `mfi_240m_n28_recovery_t0.8_short_indicator_or12h` | 505/1 | 504/1 | 0/0 | 0/0 | N,P,M,C |
| 44 | `obv_240m_n20_trend_t0.5_short_fixed12h` | 420/12 | 366/12 | 15/1 | 23/1 | N,M |
| 45 | `obv_240m_n20_trend_t0.5_short_indicator_or12h` | 420/12 | 366/12 | 15/1 | 23/1 | N,M |
| 46 | `mfi_240m_n14_into_t0.8_short_fixed12h` | 402/8 | 303/8 | 1,146/4 | 1,156/4 | N,M |
| 47 | `mfi_240m_n14_into_t0.8_short_indicator_or12h` | 402/8 | 303/8 | 1,146/4 | 1,156/4 | N,M |
| 48 | `cmf_60m_n20_into_t0.5_short_indicator_or12h` | 384/3 | 328/3 | -292/1 | -359/1 | N,P,M,C |
| 49 | `cmf_60m_n20_into_t0.5_short_fixed12h` | 365/3 | 316/3 | -292/1 | -359/1 | N,P,M,C |
| 50 | `cmf_15m_n10_trend_t0.5_short_fixed12h` | 349/91 | 710/90 | -1,823/19 | -1,556/18 | P,M,C |
| 51 | `cmf_60m_n20_recovery_t0.5_short_fixed12h` | 345/3 | 373/3 | -197/1 | -183/1 | N,P,M,C |
| 52 | `mfi_240m_n28_trend_t0.6_short_fixed12h` | 341/3 | 419/3 | 0/0 | 0/0 | N,P,M,C |
| 53 | `mfi_240m_n28_trend_t0.6_short_indicator_or12h` | 341/3 | 419/3 | 0/0 | 0/0 | N,P,M,C |
| 54 | `cmf_240m_n20_trend_t0.05_short_fixed12h` | 324/111 | 2,088/107 | 1,195/28 | 2,115/26 | M,C |
| 55 | `cmf_60m_n20_recovery_t0.5_short_indicator_or12h` | 318/3 | 310/3 | -197/1 | -183/1 | N,P,M,C |
| 56 | `mfi_240m_n7_trend_t0_short_fixed12h` | 312/172 | -984/167 | 2,554/42 | 2,111/41 | P,M,C |
| 57 | `obv_15m_n20_recovery_t0.25_short_fixed12h` | 265/500 | -36/496 | -4,668/129 | -4,323/127 | P,M,C |
| 58 | `cmf_30m_n20_recovery_t0.5_short_indicator_or12h` | 212/4 | 178/4 | -24/1 | -31/1 | N,P,M,C |
| 59 | `mfi_240m_n14_into_t0.9_short_fixed12h` | 211/2 | 206/2 | 209/1 | 186/1 | N,M |
| 60 | `mfi_240m_n14_into_t0.9_short_indicator_or12h` | 211/2 | 206/2 | 209/1 | 186/1 | N,M |
| 61 | `obv_240m_n10_into_t0.5_short_indicator_or12h` | 203/66 | 30/62 | -549/22 | -634/22 | P,M,C |
| 62 | `obv_60m_n10_recovery_t0.5_short_fixed12h` | 193/211 | 598/207 | -2,221/67 | -2,393/66 | P,M,C |
| 63 | `obv_240m_n10_into_t0.5_short_fixed12h` | 160/66 | -22/62 | -549/22 | -627/22 | P,M,C |
| 64 | `mfi_240m_n14_trend_t0.6_short_fixed12h` | 144/29 | 143/27 | -1,082/5 | -1,127/5 | N,P,M,C |
| 65 | `mfi_240m_n14_trend_t0.6_short_indicator_or12h` | 144/29 | 143/27 | -1,082/5 | -1,127/5 | N,P,M,C |
| 66 | `obv_5m_n40_trend_t0.75_short_indicator_or12h` | 143/6 | 212/6 | 0/0 | 0/0 | N,P,M,C |
| 67 | `mfi_30m_n28_trend_t0.8_short_fixed12h` | 92/1 | 125/1 | 0/0 | 0/0 | N,P,M,C |
| 68 | `mfi_30m_n28_trend_t0.8_short_indicator_or12h` | 92/1 | 125/1 | 0/0 | 0/0 | N,P,M,C |
| 69 | `cmf_240m_n10_recovery_t0.5_short_fixed12h` | 75/7 | 231/7 | 74/3 | 160/3 | N,M,C |
| 70 | `cmf_240m_n10_recovery_t0.5_short_indicator_or12h` | 75/7 | 231/7 | 74/3 | 160/3 | N,M,C |
| 71 | `cmf_15m_n20_trend_t0.5_short_indicator_or12h` | 68/10 | -305/10 | 0/0 | 0/0 | N,P,M,C |
| 72 | `cmf_240m_n10_trend_t0.5_short_fixed12h` | 59/1 | 69/1 | 59/1 | 69/1 | N,M |
| 73 | `cmf_240m_n10_trend_t0.5_short_indicator_or12h` | 59/1 | 69/1 | 59/1 | 69/1 | N,M |
| 74 | `cmf_30m_n20_recovery_t0.5_short_fixed12h` | 55/4 | 7/4 | -70/1 | -95/1 | N,P,M,C |
| 75 | `cmf_60m_n40_trend_t0.2_short_fixed12h` | 35/19 | 178/18 | -487/5 | -501/5 | N,P,M,C |
| 76 | `obv_240m_n40_recovery_t0.5_short_fixed12h` | 33/1 | 22/1 | 0/0 | 0/0 | N,P,M,C |
| 77 | `obv_240m_n40_recovery_t0.5_short_indicator_or12h` | 33/1 | 22/1 | 0/0 | 0/0 | N,P,M,C |
| 78 | `obv_5m_n20_into_t0.75_short_indicator_or12h` | 31/64 | -153/64 | -118/19 | -6/19 | P,M,C |
| 79 | `cmf_60m_n10_trend_t0.5_short_fixed12h` | 9/12 | 201/12 | 0/0 | 0/0 | N,P,M,C |
| 80 | `mfi_240m_n14_trend_t0.8_short_fixed12h` | 9/4 | 91/4 | 0/0 | 0/0 | N,P,M,C |
| 81 | `mfi_240m_n14_trend_t0.8_short_indicator_or12h` | 9/4 | 91/4 | 0/0 | 0/0 | N,P,M,C |
| 82 | `mfi_240m_n28_trend_t0_short_fixed12h` | 9/71 | 340/67 | 1,169/18 | 1,215/15 | M,C |
| 83 | `obv_240m_n40_into_t0.5_short_fixed12h` | 2/1 | 20/1 | 0/0 | 0/0 | N,P,M,C |
| 84 | `obv_240m_n40_into_t0.5_short_indicator_or12h` | 2/1 | 20/1 | 0/0 | 0/0 | N,P,M,C |
| 85 | `mfi_240m_n28_into_t0.8_short_fixed12h` | 2/1 | 20/1 | 0/0 | 0/0 | N,P,M,C |
| 86 | `mfi_240m_n28_into_t0.8_short_indicator_or12h` | 2/1 | 20/1 | 0/0 | 0/0 | N,P,M,C |
| 87 | `obv_15m_n40_trend_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 88 | `obv_15m_n40_trend_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 89 | `obv_15m_n40_into_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 90 | `obv_15m_n40_into_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 91 | `obv_15m_n40_recovery_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 92 | `obv_15m_n40_recovery_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 93 | `mfi_15m_n28_into_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 94 | `mfi_15m_n28_into_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 95 | `mfi_15m_n28_recovery_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 96 | `mfi_15m_n28_recovery_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 97 | `cmf_15m_n40_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 98 | `cmf_15m_n40_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 99 | `obv_30m_n40_trend_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 100 | `obv_30m_n40_trend_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 101 | `cmf_30m_n40_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 102 | `cmf_30m_n40_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 103 | `cmf_30m_n40_into_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 104 | `cmf_30m_n40_into_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 105 | `cmf_30m_n40_recovery_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 106 | `cmf_30m_n40_recovery_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 107 | `obv_60m_n40_trend_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 108 | `obv_60m_n40_trend_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 109 | `obv_60m_n40_into_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 110 | `obv_60m_n40_into_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 111 | `obv_60m_n40_recovery_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 112 | `obv_60m_n40_recovery_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 113 | `mfi_60m_n28_trend_t0.8_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 114 | `mfi_60m_n28_trend_t0.8_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 115 | `mfi_60m_n28_into_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 116 | `mfi_60m_n28_into_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 117 | `mfi_60m_n28_recovery_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 118 | `mfi_60m_n28_recovery_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 119 | `cmf_60m_n20_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 120 | `cmf_60m_n20_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 121 | `cmf_60m_n40_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 122 | `cmf_60m_n40_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 123 | `cmf_60m_n40_into_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 124 | `cmf_60m_n40_into_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 125 | `cmf_60m_n40_recovery_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 126 | `cmf_60m_n40_recovery_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 127 | `obv_240m_n20_trend_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 128 | `obv_240m_n20_trend_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 129 | `obv_240m_n20_into_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 130 | `obv_240m_n20_into_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 131 | `obv_240m_n20_recovery_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 132 | `obv_240m_n20_recovery_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 133 | `obv_240m_n40_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 134 | `obv_240m_n40_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 135 | `obv_240m_n40_trend_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 136 | `obv_240m_n40_trend_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 137 | `obv_240m_n40_into_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 138 | `obv_240m_n40_into_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 139 | `obv_240m_n40_recovery_t0.75_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 140 | `obv_240m_n40_recovery_t0.75_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 141 | `mfi_240m_n28_trend_t0.8_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 142 | `mfi_240m_n28_trend_t0.8_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 143 | `mfi_240m_n28_into_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 144 | `mfi_240m_n28_into_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 145 | `mfi_240m_n28_recovery_t0.9_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 146 | `mfi_240m_n28_recovery_t0.9_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 147 | `cmf_240m_n20_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 148 | `cmf_240m_n20_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 149 | `cmf_240m_n20_into_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 150 | `cmf_240m_n20_into_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 151 | `cmf_240m_n20_recovery_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 152 | `cmf_240m_n20_recovery_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 153 | `cmf_240m_n40_trend_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 154 | `cmf_240m_n40_trend_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 155 | `cmf_240m_n40_into_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 156 | `cmf_240m_n40_into_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 157 | `cmf_240m_n40_recovery_t0.5_short_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 158 | `cmf_240m_n40_recovery_t0.5_short_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,M,C |
| 159 | `cmf_30m_n20_trend_t0.5_short_fixed12h` | -10/5 | -21/5 | 0/0 | 0/0 | N,P,M,C |
| 160 | `obv_240m_n20_into_t0.5_short_fixed12h` | -95/16 | -309/14 | -123/4 | -168/4 | N,P,M,C |
| 161 | `obv_240m_n20_into_t0.5_short_indicator_or12h` | -95/16 | -309/14 | -123/4 | -168/4 | N,P,M,C |
| 162 | `mfi_5m_n28_into_t0.9_short_indicator_or12h` | -96/1 | 113/1 | -96/1 | 113/1 | N,P,M,C |
| 163 | `cmf_60m_n40_into_t0.05_short_fixed12h` | -140/223 | -1,209/219 | 331/59 | 489/58 | P,M,C |
| 164 | `obv_60m_n20_trend_t0.75_short_fixed12h` | -160/1 | -132/1 | 0/0 | 0/0 | N,P,M,C |
| 165 | `obv_60m_n20_trend_t0.75_short_indicator_or12h` | -160/1 | -132/1 | 0/0 | 0/0 | N,P,M,C |
| 166 | `mfi_5m_n28_into_t0.9_short_fixed12h` | -169/1 | -29/1 | -169/1 | -29/1 | N,P,M,C |
| 167 | `cmf_15m_n20_trend_t0.5_short_fixed12h` | -170/10 | -347/10 | 0/0 | 0/0 | N,P,M,C |
| 168 | `mfi_5m_n14_into_t0.9_short_indicator_or12h` | -182/118 | -77/118 | -467/31 | -412/31 | P,M,C |
| 169 | `cmf_30m_n20_into_t0.5_short_indicator_or12h` | -183/4 | -171/4 | 56/1 | 44/1 | N,P,M,C |
| 170 | `cmf_15m_n40_trend_t0.2_short_indicator_or12h` | -192/115 | -125/115 | -2,480/26 | -2,273/26 | P,M,C |
| 171 | `obv_30m_n20_into_t0.75_short_indicator_or12h` | -220/5 | -214/5 | -927/2 | -941/2 | N,P,M,C |
| 172 | `cmf_240m_n40_trend_t0.2_short_fixed12h` | -249/10 | -280/8 | 139/2 | 124/2 | N,P,M,C |
| 173 | `cmf_240m_n40_trend_t0.2_short_indicator_or12h` | -249/10 | -280/8 | 139/2 | 124/2 | N,P,M,C |
| 174 | `cmf_30m_n10_trend_t0.5_short_fixed12h` | -267/41 | 87/41 | -1,267/8 | -1,052/8 | N,P,M,C |
| 175 | `obv_30m_n40_recovery_t0.75_short_fixed12h` | -280/1 | -285/1 | -280/1 | -285/1 | N,P,M,C |
| 176 | `obv_30m_n40_recovery_t0.75_short_indicator_or12h` | -280/1 | -285/1 | -280/1 | -285/1 | N,P,M,C |
| 177 | `cmf_30m_n20_into_t0.5_short_fixed12h` | -282/4 | -286/4 | 23/1 | -18/1 | N,P,M,C |
| 178 | `cmf_240m_n10_into_t0.5_short_fixed12h` | -294/8 | -478/8 | -260/4 | -307/4 | N,P,M,C |
| 179 | `cmf_240m_n10_into_t0.5_short_indicator_or12h` | -294/8 | -478/8 | -260/4 | -307/4 | N,P,M,C |
| 180 | `cmf_5m_n20_into_t0.5_short_indicator_or12h` | -309/92 | -510/92 | -826/18 | -628/18 | P,M,C |
| 181 | `obv_5m_n20_recovery_t0.75_short_indicator_or12h` | -309/64 | -283/64 | 99/19 | 124/19 | P,M,C |
| 182 | `obv_30m_n20_into_t0.75_short_fixed12h` | -312/5 | -253/5 | -871/2 | -880/2 | N,P,M,C |
| 183 | `cmf_15m_n40_into_t0.2_short_indicator_or12h` | -314/218 | -355/218 | -1,404/55 | -1,399/55 | P,M,C |
| 184 | `cmf_240m_n20_recovery_t0.05_short_indicator_or12h` | -340/128 | 1,183/112 | 1,673/31 | 1,541/29 | P,M,C |
| 185 | `mfi_5m_n28_recovery_t0.9_short_indicator_or12h` | -347/1 | -322/1 | -347/1 | -322/1 | N,P,M,C |
| 186 | `mfi_240m_n7_recovery_t0.8_short_fixed12h` | -362/49 | -233/49 | -1,072/15 | -979/15 | P,M,C |
| 187 | `mfi_15m_n7_into_t0.9_short_indicator_or12h` | -384/348 | -2,219/347 | -1,176/86 | -1,595/85 | P,M,C |
| 188 | `obv_30m_n20_recovery_t0.75_short_indicator_or12h` | -416/5 | -465/5 | -1,207/2 | -1,228/2 | N,P,M,C |
| 189 | `obv_60m_n40_into_t0.5_short_fixed12h` | -421/6 | -448/6 | -999/5 | -1,017/5 | N,P,M,C |
| 190 | `obv_60m_n40_into_t0.5_short_indicator_or12h` | -421/6 | -448/6 | -999/5 | -1,017/5 | N,P,M,C |
| 191 | `mfi_5m_n28_recovery_t0.9_short_fixed12h` | -436/1 | -456/1 | -436/1 | -456/1 | N,P,M,C |
| 192 | `obv_30m_n40_into_t0.75_short_fixed12h` | -436/1 | -456/1 | -436/1 | -456/1 | N,P,M,C |
| 193 | `obv_30m_n40_into_t0.75_short_indicator_or12h` | -436/1 | -456/1 | -436/1 | -456/1 | N,P,M,C |
| 194 | `cmf_15m_n10_into_t0.5_short_indicator_or12h` | -477/166 | -1,090/166 | -2,121/43 | -1,970/43 | P,M,C |
| 195 | `cmf_15m_n40_recovery_t0.5_short_fixed12h` | -486/2 | -402/2 | 0/0 | 0/0 | N,P,M,C |
| 196 | `cmf_15m_n40_recovery_t0.5_short_indicator_or12h` | -486/2 | -408/2 | 0/0 | 0/0 | N,P,M,C |
| 197 | `cmf_15m_n40_into_t0.5_short_fixed12h` | -490/2 | -501/2 | 0/0 | 0/0 | N,P,M,C |
| 198 | `cmf_15m_n40_into_t0.5_short_indicator_or12h` | -490/2 | -501/2 | 0/0 | 0/0 | N,P,M,C |
| 199 | `mfi_240m_n14_into_t0.6_short_fixed12h` | -522/35 | -630/32 | -1,054/12 | -1,013/12 | P,M,C |
| 200 | `mfi_240m_n14_into_t0.6_short_indicator_or12h` | -522/35 | -630/32 | -1,054/12 | -1,013/12 | P,M,C |
| 201 | `obv_15m_n20_trend_t0.75_short_fixed12h` | -528/23 | -233/23 | 140/2 | 136/2 | N,P,M,C |
| 202 | `obv_5m_n40_trend_t0.75_short_fixed12h` | -530/6 | -432/6 | 0/0 | 0/0 | N,P,M,C |
| 203 | `mfi_240m_n28_into_t0.6_short_fixed12h` | -530/11 | -345/10 | -44/7 | 188/6 | N,P,M,C |
| 204 | `mfi_240m_n28_into_t0.6_short_indicator_or12h` | -530/11 | -345/10 | -44/7 | 188/6 | N,P,M,C |
| 205 | `cmf_30m_n20_trend_t0.5_short_indicator_or12h` | -531/5 | -483/5 | 0/0 | 0/0 | N,P,M,C |
| 206 | `mfi_240m_n7_recovery_t0.8_short_indicator_or12h` | -606/49 | -507/49 | -1,465/15 | -1,344/15 | P,M,C |
| 207 | `mfi_5m_n14_recovery_t0.9_short_indicator_or12h` | -615/118 | -478/118 | -397/31 | -416/31 | P,M,C |
| 208 | `obv_15m_n10_into_t0.75_short_indicator_or12h` | -626/207 | -1,552/207 | -1,207/48 | -1,364/48 | P,M,C |
| 209 | `obv_30m_n20_recovery_t0.75_short_fixed12h` | -629/5 | -694/5 | -1,250/2 | -1,252/2 | N,P,M,C |
| 210 | `cmf_5m_n20_recovery_t0.5_short_indicator_or12h` | -640/92 | -1,038/92 | -392/18 | -337/18 | P,M,C |
| 211 | `cmf_15m_n20_into_t0.5_short_fixed12h` | -665/15 | -618/15 | -821/3 | -672/3 | N,P,M,C |
| 212 | `cmf_60m_n40_trend_t0.2_short_indicator_or12h` | -675/19 | -361/18 | -487/5 | -501/5 | N,P,M,C |
| 213 | `mfi_60m_n28_trend_t0_short_indicator_or12h` | -693/340 | -1,052/340 | 861/78 | 607/78 | P,M,C |
| 214 | `cmf_240m_n40_into_t0.2_short_fixed12h` | -721/27 | -837/25 | 22/13 | 54/12 | N,P,M,C |
| 215 | `cmf_240m_n40_into_t0.2_short_indicator_or12h` | -721/27 | -837/25 | 22/13 | 54/12 | N,P,M,C |
| 216 | `mfi_30m_n28_into_t0.9_short_fixed12h` | -750/2 | -765/2 | 0/0 | 0/0 | N,P,M,C |
| 217 | `mfi_30m_n28_into_t0.9_short_indicator_or12h` | -750/2 | -765/2 | 0/0 | 0/0 | N,P,M,C |
| 218 | `mfi_30m_n28_recovery_t0.9_short_fixed12h` | -757/2 | -724/2 | 0/0 | 0/0 | N,P,M,C |
| 219 | `mfi_30m_n28_recovery_t0.9_short_indicator_or12h` | -757/2 | -724/2 | 0/0 | 0/0 | N,P,M,C |
| 220 | `mfi_30m_n7_into_t0.8_short_fixed12h` | -776/280 | -726/277 | 1,967/73 | 1,968/72 | P,M,C |
| 221 | `mfi_60m_n28_into_t0.8_short_fixed12h` | -785/2 | -842/2 | -272/1 | -314/1 | N,P,M,C |
| 222 | `mfi_60m_n28_into_t0.8_short_indicator_or12h` | -785/2 | -842/2 | -272/1 | -314/1 | N,P,M,C |
| 223 | `obv_240m_n10_trend_t0.75_short_fixed12h` | -786/7 | -654/7 | -123/2 | -94/2 | N,P,M,C |
| 224 | `obv_240m_n10_trend_t0.75_short_indicator_or12h` | -786/7 | -654/7 | -123/2 | -94/2 | N,P,M,C |
| 225 | `mfi_5m_n28_into_t0.6_short_indicator_or12h` | -801/297 | -787/296 | -348/79 | 309/78 | P,M,C |
| 226 | `obv_15m_n20_trend_t0.75_short_indicator_or12h` | -801/23 | -627/23 | -77/2 | -49/2 | N,P,M,C |
| 227 | `obv_60m_n40_recovery_t0.5_short_fixed12h` | -811/6 | -813/6 | -1,011/5 | -1,012/5 | N,P,M,C |
| 228 | `obv_60m_n40_recovery_t0.5_short_indicator_or12h` | -811/6 | -813/6 | -1,011/5 | -1,012/5 | N,P,M,C |
| 229 | `cmf_60m_n10_trend_t0.5_short_indicator_or12h` | -835/12 | -739/12 | 0/0 | 0/0 | N,P,M,C |
| 230 | `obv_15m_n20_into_t0.25_short_fixed12h` | -857/500 | -859/497 | -3,408/129 | -3,530/128 | P,M,C |
| 231 | `cmf_240m_n20_trend_t0.05_short_indicator_or12h` | -860/112 | 913/108 | 742/28 | 1,654/26 | P,M,C |
| 232 | `mfi_60m_n14_into_t0.8_short_fixed12h` | -865/25 | -934/25 | -304/8 | -318/8 | N,P,M,C |
| 233 | `obv_15m_n20_into_t0.75_short_indicator_or12h` | -891/13 | -988/13 | -539/3 | -573/3 | N,P,M,C |
| 234 | `cmf_15m_n10_recovery_t0.5_short_fixed12h` | -934/145 | -336/141 | -1,005/39 | -458/38 | P,M,C |
| 235 | `cmf_15m_n10_into_t0.5_short_fixed12h` | -938/141 | -1,450/141 | -751/38 | -746/38 | P,M,C |
| 236 | `cmf_240m_n10_trend_t0.05_short_fixed12h` | -1,008/172 | -182/162 | -13/44 | 13/41 | P,M,C |
| 237 | `cmf_15m_n40_recovery_t0.2_short_indicator_or12h` | -1,010/213 | -796/213 | -2,001/54 | -2,172/54 | P,M,C |
| 238 | `mfi_60m_n28_recovery_t0.8_short_fixed12h` | -1,013/2 | -1,004/2 | -197/1 | -183/1 | N,P,M,C |
| 239 | `mfi_60m_n28_recovery_t0.8_short_indicator_or12h` | -1,013/2 | -1,004/2 | -197/1 | -183/1 | N,P,M,C |
| 240 | `cmf_60m_n10_into_t0.2_short_indicator_or12h` | -1,038/376 | -955/367 | -4,425/102 | -4,588/101 | P,M,C |
| 241 | `cmf_15m_n20_recovery_t0.5_short_fixed12h` | -1,039/15 | -905/15 | -767/3 | -709/3 | N,P,M,C |
| 242 | `obv_30m_n20_trend_t0.75_short_fixed12h` | -1,039/12 | -758/12 | 597/1 | 625/1 | N,P,M,C |
| 243 | `cmf_240m_n40_recovery_t0.2_short_fixed12h` | -1,059/26 | -677/25 | -1,010/11 | -859/10 | N,P,M,C |
| 244 | `cmf_240m_n40_recovery_t0.2_short_indicator_or12h` | -1,059/26 | -677/25 | -1,010/11 | -859/10 | N,P,M,C |
| 245 | `cmf_240m_n20_trend_t0_short_indicator_or12h` | -1,072/135 | -980/135 | 953/27 | 1,260/27 | P,M,C |
| 246 | `mfi_5m_n28_trend_t0.8_short_indicator_or12h` | -1,085/29 | -824/29 | -304/7 | -267/7 | N,P,M,C |
| 247 | `mfi_60m_n14_recovery_t0.9_short_fixed12h` | -1,117/5 | -1,191/5 | -1,082/2 | -1,108/2 | N,P,M,C |
| 248 | `obv_30m_n40_trend_t0.5_short_fixed12h` | -1,123/14 | -892/14 | 413/2 | 422/2 | N,P,M,C |
| 249 | `obv_30m_n40_trend_t0.5_short_indicator_or12h` | -1,123/14 | -892/14 | 413/2 | 422/2 | N,P,M,C |
| 250 | `obv_5m_n40_into_t0.75_short_indicator_or12h` | -1,128/3 | -962/3 | -127/1 | 14/1 | N,P,M,C |
| 251 | `mfi_60m_n14_into_t0.8_short_indicator_or12h` | -1,147/25 | -1,170/25 | -389/8 | -405/8 | N,P,M,C |
| 252 | `mfi_15m_n28_trend_t0.8_short_indicator_or12h` | -1,192/6 | -877/6 | -157/1 | -152/1 | N,P,M,C |
| 253 | `mfi_30m_n28_recovery_t0.8_short_fixed12h` | -1,197/6 | -1,161/6 | -280/1 | -285/1 | N,P,M,C |
| 254 | `mfi_30m_n28_into_t0.8_short_fixed12h` | -1,224/6 | -1,259/6 | -436/1 | -456/1 | N,P,M,C |
| 255 | `cmf_15m_n20_into_t0.5_short_indicator_or12h` | -1,264/15 | -1,243/15 | -771/3 | -676/3 | N,P,M,C |
| 256 | `mfi_60m_n14_recovery_t0.9_short_indicator_or12h` | -1,272/5 | -1,331/5 | -1,082/2 | -1,108/2 | N,P,M,C |
| 257 | `mfi_15m_n28_into_t0.8_short_indicator_or12h` | -1,292/5 | -1,305/5 | -1,365/2 | -1,378/2 | N,P,M,C |
| 258 | `obv_240m_n20_trend_t0_short_indicator_or12h` | -1,298/126 | -781/126 | 478/27 | 592/27 | P,M,C |
| 259 | `obv_15m_n10_into_t0.5_short_indicator_or12h` | -1,302/817 | -2,885/817 | -1,286/212 | -1,671/212 | P,M,C |
| 260 | `mfi_30m_n28_recovery_t0.8_short_indicator_or12h` | -1,305/6 | -1,258/6 | -280/1 | -285/1 | N,P,M,C |
| 261 | `mfi_5m_n28_into_t0.8_short_indicator_or12h` | -1,306/20 | -1,314/20 | -878/10 | -759/10 | N,P,M,C |
| 262 | `obv_5m_n40_recovery_t0.75_short_indicator_or12h` | -1,309/3 | -1,258/3 | -284/1 | -234/1 | N,P,M,C |
| 263 | `obv_15m_n20_into_t0.75_short_fixed12h` | -1,346/13 | -1,457/13 | -1,388/3 | -1,397/3 | N,P,M,C |
| 264 | `cmf_5m_n40_recovery_t0.5_short_indicator_or12h` | -1,348/6 | -1,186/6 | -165/2 | -19/2 | N,P,M,C |
| 265 | `obv_30m_n20_into_t0.25_short_indicator_or12h` | -1,352/378 | -679/375 | -3,476/101 | -3,041/100 | P,M,C |
| 266 | `obv_60m_n20_into_t0.25_short_indicator_or12h` | -1,366/213 | -1,240/210 | -2,709/57 | -2,504/57 | P,M,C |
| 267 | `mfi_30m_n28_into_t0.8_short_indicator_or12h` | -1,419/6 | -1,491/6 | -436/1 | -456/1 | N,P,M,C |
| 268 | `cmf_15m_n20_recovery_t0.5_short_indicator_or12h` | -1,421/15 | -1,428/15 | -690/3 | -714/3 | N,P,M,C |
| 269 | `mfi_5m_n28_recovery_t0.8_short_indicator_or12h` | -1,427/20 | -1,376/20 | -655/10 | -569/10 | N,P,M,C |
| 270 | `obv_30m_n20_trend_t0.75_short_indicator_or12h` | -1,428/12 | -1,193/12 | 597/1 | 625/1 | N,P,M,C |
| 271 | `obv_60m_n20_into_t0.75_short_fixed12h` | -1,457/3 | -1,480/3 | -1,149/2 | -1,180/2 | N,P,M,C |
| 272 | `obv_60m_n20_into_t0.75_short_indicator_or12h` | -1,457/3 | -1,480/3 | -1,149/2 | -1,180/2 | N,P,M,C |
| 273 | `obv_240m_n20_trend_t0.25_short_fixed12h` | -1,463/86 | -1,744/83 | 361/15 | 228/15 | P,M,C |
| 274 | `mfi_60m_n7_trend_t0.8_short_fixed12h` | -1,466/152 | -1,314/148 | -1,286/36 | -1,350/36 | P,M,C |
| 275 | `obv_5m_n40_into_t0.75_short_fixed12h` | -1,469/3 | -1,316/3 | -169/1 | -29/1 | N,P,M,C |
| 276 | `mfi_30m_n7_into_t0.9_short_fixed12h` | -1,483/171 | -2,056/170 | 1,016/40 | 658/39 | P,M,C |
| 277 | `mfi_30m_n14_recovery_t0.6_short_fixed12h` | -1,485/180 | -95/178 | -99/44 | -104/44 | P,M,C |
| 278 | `obv_15m_n20_recovery_t0.75_short_indicator_or12h` | -1,494/13 | -1,552/13 | -839/3 | -836/3 | N,P,M,C |
| 279 | `mfi_60m_n14_recovery_t0.8_short_fixed12h` | -1,516/25 | -1,447/25 | -1,104/8 | -1,165/8 | N,P,M,C |
| 280 | `mfi_240m_n28_recovery_t0.6_short_fixed12h` | -1,548/10 | -1,432/9 | -2,516/7 | -2,444/6 | N,P,M,C |
| 281 | `mfi_240m_n28_recovery_t0.6_short_indicator_or12h` | -1,548/10 | -1,432/9 | -2,516/7 | -2,444/6 | N,P,M,C |
| 282 | `cmf_60m_n20_trend_t0.2_short_fixed12h` | -1,549/104 | -811/102 | 441/20 | 502/20 | P,M,C |
| 283 | `mfi_30m_n14_into_t0.6_short_fixed12h` | -1,550/180 | -1,942/180 | -348/45 | -826/45 | P,M,C |
| 284 | `obv_60m_n20_recovery_t0.75_short_fixed12h` | -1,578/3 | -1,667/3 | -1,245/2 | -1,342/2 | N,P,M,C |
| 285 | `obv_60m_n20_recovery_t0.75_short_indicator_or12h` | -1,578/3 | -1,667/3 | -1,245/2 | -1,342/2 | N,P,M,C |
| 286 | `mfi_15m_n28_recovery_t0.8_short_indicator_or12h` | -1,596/5 | -1,514/5 | -1,478/2 | -1,420/2 | N,P,M,C |
| 287 | `cmf_15m_n40_trend_t0.2_short_fixed12h` | -1,623/115 | -1,089/115 | -2,863/26 | -2,516/26 | P,M,C |
| 288 | `obv_30m_n40_recovery_t0.5_short_indicator_or12h` | -1,626/12 | -1,702/12 | -833/4 | -957/4 | N,P,M,C |
| 289 | `mfi_15m_n28_trend_t0.8_short_fixed12h` | -1,640/6 | -1,283/6 | -322/1 | -300/1 | N,P,M,C |
| 290 | `obv_30m_n40_into_t0.5_short_indicator_or12h` | -1,643/12 | -1,618/12 | -1,426/4 | -1,510/4 | N,P,M,C |
| 291 | `mfi_60m_n14_into_t0.9_short_indicator_or12h` | -1,645/5 | -1,645/5 | -1,313/2 | -1,272/2 | N,P,M,C |
| 292 | `obv_240m_n20_trend_t0.25_short_indicator_or12h` | -1,646/86 | -1,919/83 | 371/15 | 255/15 | P,M,C |
| 293 | `mfi_240m_n7_trend_t0.6_short_fixed12h` | -1,660/92 | -1,786/89 | 1,605/20 | 1,855/20 | P,M,C |
| 294 | `mfi_15m_n28_into_t0.8_short_fixed12h` | -1,682/5 | -1,636/5 | -1,309/2 | -1,271/2 | N,P,M,C |
| 295 | `mfi_60m_n14_into_t0.9_short_fixed12h` | -1,688/5 | -1,683/5 | -1,313/2 | -1,272/2 | N,P,M,C |
| 296 | `mfi_30m_n7_recovery_t0.9_short_fixed12h` | -1,715/172 | -721/171 | -55/39 | -255/39 | P,M,C |
| 297 | `obv_30m_n40_into_t0.5_short_fixed12h` | -1,716/12 | -1,781/12 | -1,426/4 | -1,510/4 | N,P,M,C |
| 298 | `cmf_15m_n10_recovery_t0.5_short_indicator_or12h` | -1,719/166 | -1,912/166 | -2,141/43 | -2,123/43 | P,M,C |
| 299 | `cmf_30m_n20_recovery_t0.2_short_indicator_or12h` | -1,728/282 | -1,301/279 | -904/70 | -1,162/70 | P,M,C |
| 300 | `cmf_240m_n20_trend_t0_short_fixed12h` | -1,745/123 | 1,097/113 | -367/24 | -12/24 | P,M,C |
| 301 | `mfi_60m_n14_recovery_t0.8_short_indicator_or12h` | -1,782/25 | -1,711/25 | -840/8 | -899/8 | N,P,M,C |
| 302 | `obv_5m_n40_recovery_t0.75_short_fixed12h` | -1,788/3 | -1,747/3 | -352/1 | -279/1 | N,P,M,C |
| 303 | `obv_240m_n40_recovery_t0.25_short_fixed12h` | -1,793/37 | -1,880/36 | -1,034/12 | -959/12 | P,M,C |
| 304 | `obv_240m_n40_recovery_t0.25_short_indicator_or12h` | -1,793/37 | -1,880/36 | -1,034/12 | -959/12 | P,M,C |
| 305 | `obv_30m_n40_recovery_t0.5_short_fixed12h` | -1,797/12 | -1,955/12 | -833/4 | -957/4 | N,P,M,C |
| 306 | `cmf_30m_n10_trend_t0.5_short_indicator_or12h` | -1,816/42 | -1,085/42 | -1,696/8 | -1,447/8 | N,P,M,C |
| 307 | `cmf_5m_n40_into_t0.5_short_indicator_or12h` | -1,830/6 | -1,667/6 | -550/2 | -382/2 | N,P,M,C |
| 308 | `cmf_60m_n20_trend_t0.2_short_indicator_or12h` | -1,854/104 | -1,087/102 | -472/20 | -401/20 | P,M,C |
| 309 | `obv_5m_n20_into_t0.75_short_fixed12h` | -1,901/62 | -1,986/62 | -1,902/18 | -1,679/18 | P,M,C |
| 310 | `mfi_240m_n14_recovery_t0.6_short_fixed12h` | -1,905/35 | -1,940/34 | -1,171/12 | -1,134/12 | P,M,C |
| 311 | `mfi_240m_n14_recovery_t0.6_short_indicator_or12h` | -1,905/35 | -1,937/34 | -1,171/12 | -1,131/12 | P,M,C |
| 312 | `cmf_30m_n20_into_t0.2_short_fixed12h` | -1,934/274 | -2,061/271 | -433/70 | -810/69 | P,M,C |
| 313 | `mfi_30m_n7_into_t0.6_short_indicator_or12h` | -1,938/595 | -3,042/595 | 816/161 | 609/161 | P,M,C |
| 314 | `mfi_60m_n14_trend_t0.6_short_fixed12h` | -1,942/112 | -2,226/111 | 1,153/25 | 830/25 | P,M,C |
| 315 | `mfi_15m_n28_recovery_t0.8_short_fixed12h` | -1,944/5 | -1,941/5 | -1,481/2 | -1,468/2 | N,P,M,C |
| 316 | `cmf_5m_n40_recovery_t0.2_short_indicator_or12h` | -1,956/612 | -1,836/611 | -3,281/154 | -3,596/154 | P,M,C |
| 317 | `cmf_5m_n40_recovery_t0.5_short_fixed12h` | -1,958/6 | -1,727/6 | -733/2 | -547/2 | N,P,M,C |
| 318 | `cmf_5m_n40_trend_t0.2_short_fixed12h` | -2,018/334 | -2,345/333 | 311/76 | 413/76 | P,M,C |
| 319 | `obv_15m_n40_into_t0.5_short_fixed12h` | -2,027/26 | -1,890/26 | -1,898/3 | -1,898/3 | N,P,M,C |
| 320 | `mfi_240m_n28_trend_t0.2_short_indicator_or12h` | -2,040/69 | -2,023/65 | -1,363/16 | -1,510/15 | P,M,C |
| 321 | `cmf_5m_n10_into_t0.5_short_indicator_or12h` | -2,045/708 | -3,795/708 | -1,016/158 | -935/158 | P,M,C |
| 322 | `mfi_15m_n14_into_t0.8_short_fixed12h` | -2,058/91 | -2,305/91 | -1,586/19 | -1,497/19 | P,M,C |
| 323 | `mfi_240m_n7_trend_t0.6_short_indicator_or12h` | -2,062/92 | -2,255/89 | 1,605/20 | 1,855/20 | P,M,C |
| 324 | `mfi_30m_n14_recovery_t0.6_short_indicator_or12h` | -2,073/183 | -1,772/181 | -429/44 | -506/44 | P,M,C |
| 325 | `cmf_30m_n20_recovery_t0.2_short_fixed12h` | -2,081/273 | -1,686/271 | -2,470/67 | -2,622/67 | P,M,C |
| 326 | `mfi_30m_n7_recovery_t0.8_short_fixed12h` | -2,089/281 | -1,914/280 | -165/73 | -422/72 | P,M,C |
| 327 | `obv_15m_n20_recovery_t0.75_short_fixed12h` | -2,096/13 | -2,130/13 | -1,745/3 | -1,692/3 | N,P,M,C |
| 328 | `obv_60m_n20_recovery_t0.5_short_indicator_or12h` | -2,115/50 | -1,903/50 | -1,534/17 | -1,521/17 | P,M,C |
| 329 | `mfi_60m_n28_into_t0.6_short_fixed12h` | -2,128/23 | -2,220/23 | -247/7 | -242/7 | N,P,M,C |
| 330 | `mfi_60m_n28_into_t0.6_short_indicator_or12h` | -2,128/23 | -2,220/23 | -247/7 | -242/7 | N,P,M,C |
| 331 | `mfi_240m_n14_trend_t0.2_short_indicator_or12h` | -2,146/113 | -1,933/105 | 114/28 | 400/25 | P,M,C |
| 332 | `mfi_60m_n14_trend_t0.8_short_fixed12h` | -2,150/22 | -2,135/22 | 541/5 | 485/5 | N,P,M,C |
| 333 | `mfi_15m_n28_trend_t0.6_short_indicator_or12h` | -2,158/86 | -2,368/86 | -109/13 | -100/13 | P,M,C |
| 334 | `mfi_240m_n7_trend_t0_short_indicator_or12h` | -2,177/180 | -3,034/180 | 1,467/46 | 1,276/46 | P,M,C |
| 335 | `mfi_240m_n14_trend_t0.2_short_fixed12h` | -2,179/113 | -1,891/105 | 413/28 | 723/25 | P,M,C |
| 336 | `cmf_240m_n40_trend_t0.05_short_indicator_or12h` | -2,189/78 | -2,870/73 | -765/21 | -1,359/20 | P,M,C |
| 337 | `cmf_15m_n40_into_t0.05_short_fixed12h` | -2,201/508 | -2,936/501 | -1,521/130 | -2,633/127 | P,M,C |
| 338 | `obv_240m_n20_trend_t0_short_fixed12h` | -2,202/114 | -1,297/109 | 1,177/26 | 601/23 | P,M,C |
| 339 | `cmf_240m_n20_trend_t0.2_short_fixed12h` | -2,212/39 | -2,223/38 | -1,298/7 | -1,248/7 | N,P,M,C |
| 340 | `cmf_240m_n20_trend_t0.2_short_indicator_or12h` | -2,212/39 | -2,223/38 | -1,298/7 | -1,248/7 | N,P,M,C |
| 341 | `mfi_5m_n28_trend_t0.8_short_fixed12h` | -2,231/28 | -1,981/28 | -218/6 | -216/6 | N,P,M,C |
| 342 | `obv_240m_n10_recovery_t0.5_short_indicator_or12h` | -2,238/65 | -1,811/60 | -2,073/22 | -1,623/20 | P,M,C |
| 343 | `mfi_60m_n14_trend_t0.8_short_indicator_or12h` | -2,245/22 | -2,210/22 | 491/5 | 443/5 | N,P,M,C |
| 344 | `obv_15m_n20_recovery_t0.25_short_indicator_or12h` | -2,267/687 | -2,838/681 | -2,671/176 | -2,981/172 | P,M,C |
| 345 | `mfi_60m_n14_recovery_t0.6_short_indicator_or12h` | -2,275/99 | -1,716/99 | -1,113/30 | -1,010/30 | P,M,C |
| 346 | `mfi_30m_n14_recovery_t0.9_short_fixed12h` | -2,296/14 | -2,372/14 | -554/1 | -556/1 | N,P,M,C |
| 347 | `mfi_240m_n7_trend_t0.8_short_indicator_or12h` | -2,323/49 | -2,614/46 | -65/12 | -14/12 | P,M,C |
| 348 | `mfi_30m_n14_recovery_t0.8_short_fixed12h` | -2,346/49 | -2,380/49 | -108/8 | -177/8 | N,P,M,C |
| 349 | `mfi_30m_n14_into_t0.9_short_fixed12h` | -2,348/14 | -2,552/14 | -429/1 | -458/1 | N,P,M,C |
| 350 | `obv_240m_n10_into_t0.75_short_fixed12h` | -2,373/11 | -2,376/11 | -624/4 | -636/4 | N,P,M,C |
| 351 | `obv_240m_n10_into_t0.75_short_indicator_or12h` | -2,373/11 | -2,376/11 | -624/4 | -636/4 | N,P,M,C |
| 352 | `mfi_60m_n28_recovery_t0.6_short_fixed12h` | -2,374/21 | -2,186/21 | -131/6 | -36/6 | N,P,M,C |
| 353 | `mfi_60m_n28_recovery_t0.6_short_indicator_or12h` | -2,374/21 | -2,186/21 | -131/6 | -36/6 | N,P,M,C |
| 354 | `mfi_30m_n14_recovery_t0.9_short_indicator_or12h` | -2,390/14 | -2,448/14 | -554/1 | -556/1 | N,P,M,C |
| 355 | `mfi_240m_n7_trend_t0.8_short_fixed12h` | -2,413/49 | -2,668/46 | -65/12 | 3/12 | P,M,C |
| 356 | `mfi_30m_n14_into_t0.8_short_fixed12h` | -2,438/48 | -2,496/48 | -46/8 | -62/8 | N,P,M,C |
| 357 | `cmf_5m_n40_into_t0.5_short_fixed12h` | -2,445/6 | -2,269/6 | -1,100/2 | -923/2 | N,P,M,C |
| 358 | `obv_15m_n40_into_t0.5_short_indicator_or12h` | -2,450/26 | -2,445/26 | -1,898/3 | -1,904/3 | N,P,M,C |
| 359 | `mfi_60m_n14_recovery_t0.6_short_fixed12h` | -2,472/99 | -2,101/99 | -1,172/30 | -1,096/30 | P,M,C |
| 360 | `obv_60m_n20_trend_t0.5_short_indicator_or12h` | -2,523/54 | -1,469/52 | -1,417/13 | -1,340/13 | P,M,C |
| 361 | `mfi_5m_n28_recovery_t0.6_short_indicator_or12h` | -2,558/298 | -2,279/297 | -168/79 | 286/78 | P,M,C |
| 362 | `mfi_240m_n28_trend_t0.2_short_fixed12h` | -2,599/69 | -2,571/65 | -1,363/16 | -1,510/15 | P,M,C |
| 363 | `obv_240m_n40_trend_t0.25_short_fixed12h` | -2,604/36 | -800/31 | 834/5 | 932/4 | N,P,M,C |
| 364 | `mfi_240m_n7_into_t0.9_short_fixed12h` | -2,613/25 | -2,406/25 | -1,439/8 | -1,397/8 | N,P,M,C |
| 365 | `mfi_240m_n7_into_t0.9_short_indicator_or12h` | -2,613/25 | -2,392/25 | -1,439/8 | -1,397/8 | N,P,M,C |
| 366 | `cmf_60m_n40_recovery_t0.2_short_fixed12h` | -2,626/71 | -2,803/70 | -2,325/25 | -2,437/24 | P,M,C |
| 367 | `cmf_60m_n40_recovery_t0.2_short_indicator_or12h` | -2,636/72 | -2,487/70 | -2,325/25 | -2,437/24 | P,M,C |
| 368 | `mfi_30m_n14_trend_t0.6_short_indicator_or12h` | -2,660/187 | -2,129/187 | -1,952/44 | -1,791/44 | P,M,C |
| 369 | `obv_240m_n10_recovery_t0.5_short_fixed12h` | -2,699/65 | -2,178/60 | -2,011/22 | -1,584/20 | P,M,C |
| 370 | `cmf_15m_n20_into_t0.2_short_fixed12h` | -2,720/432 | -3,668/430 | -2,918/111 | -3,298/111 | P,M,C |
| 371 | `mfi_5m_n14_into_t0.9_short_fixed12h` | -2,733/111 | -2,987/111 | -3,525/29 | -3,742/29 | P,M,C |
| 372 | `obv_240m_n40_trend_t0.25_short_indicator_or12h` | -2,738/36 | -800/31 | 834/5 | 932/4 | N,P,M,C |
| 373 | `cmf_240m_n40_trend_t0.05_short_fixed12h` | -2,822/78 | -3,455/73 | -1,006/21 | -1,605/20 | P,M,C |
| 374 | `obv_5m_n20_recovery_t0.75_short_fixed12h` | -2,839/62 | -2,860/62 | -1,896/18 | -1,930/18 | P,M,C |
| 375 | `cmf_30m_n10_into_t0.5_short_fixed12h` | -2,842/68 | -2,799/67 | -708/15 | -647/15 | P,M,C |
| 376 | `obv_30m_n20_recovery_t0.25_short_indicator_or12h` | -2,844/391 | -3,267/381 | -2,260/105 | -2,733/103 | P,M,C |
| 377 | `obv_60m_n20_trend_t0.5_short_fixed12h` | -2,961/54 | -1,136/52 | -1,223/13 | -1,100/13 | P,M,C |
| 378 | `mfi_30m_n14_trend_t0.6_short_fixed12h` | -2,974/183 | -2,503/183 | -2,452/44 | -2,291/44 | P,M,C |
| 379 | `obv_60m_n10_recovery_t0.75_short_indicator_or12h` | -2,975/40 | -2,852/40 | -1,470/11 | -1,375/11 | P,M,C |
| 380 | `cmf_240m_n10_trend_t0.2_short_fixed12h` | -2,994/107 | -2,333/96 | -572/29 | 160/24 | P,M,C |
| 381 | `obv_15m_n10_into_t0.75_short_fixed12h` | -3,037/183 | -3,468/181 | -781/43 | -798/43 | P,M,C |
| 382 | `obv_15m_n10_recovery_t0.75_short_indicator_or12h` | -3,059/207 | -2,999/207 | -1,801/49 | -1,819/49 | P,M,C |
| 383 | `obv_30m_n10_trend_t0.75_short_indicator_or12h` | -3,074/110 | -2,222/109 | -3,057/24 | -2,539/23 | P,M,C |
| 384 | `cmf_60m_n20_trend_t0.05_short_indicator_or12h` | -3,090/371 | -4,525/366 | -1,906/90 | -2,139/89 | P,M,C |
| 385 | `cmf_60m_n10_recovery_t0.5_short_indicator_or12h` | -3,124/30 | -2,956/30 | -1,289/4 | -1,243/4 | N,P,M,C |
| 386 | `cmf_240m_n10_trend_t0.05_short_indicator_or12h` | -3,134/178 | -2,464/174 | -34/45 | -253/43 | P,M,C |
| 387 | `obv_60m_n20_recovery_t0.5_short_fixed12h` | -3,160/50 | -3,000/50 | -1,665/17 | -1,579/17 | P,M,C |
| 388 | `mfi_5m_n14_into_t0.8_short_indicator_or12h` | -3,177/366 | -3,799/366 | -1,072/104 | -923/104 | P,M,C |
| 389 | `obv_15m_n20_into_t0.25_short_indicator_or12h` | -3,218/683 | -3,398/683 | -2,217/174 | -2,527/174 | P,M,C |
| 390 | `obv_240m_n10_into_t0.25_short_indicator_or12h` | -3,239/133 | -2,181/126 | -11/36 | 967/34 | P,M,C |
| 391 | `obv_60m_n10_into_t0.25_short_indicator_or12h` | -3,260/419 | -3,938/414 | -3,842/115 | -4,038/112 | P,M,C |
| 392 | `mfi_15m_n7_into_t0.6_short_indicator_or12h` | -3,264/1227 | -5,436/1226 | -3,486/314 | -3,554/313 | P,M,C |
| 393 | `obv_240m_n10_into_t0.25_short_fixed12h` | -3,279/133 | -2,397/126 | 431/36 | 1,369/34 | P,M,C |
| 394 | `mfi_30m_n14_into_t0.9_short_indicator_or12h` | -3,295/14 | -3,593/14 | -429/1 | -458/1 | N,P,M,C |
| 395 | `obv_5m_n10_into_t0.75_short_indicator_or12h` | -3,297/812 | -4,082/812 | 290/211 | -291/211 | P,M,C |
| 396 | `cmf_60m_n10_recovery_t0.5_short_fixed12h` | -3,331/30 | -3,085/30 | -1,531/4 | -1,489/4 | N,P,M,C |
| 397 | `mfi_60m_n7_into_t0.9_short_indicator_or12h` | -3,350/84 | -3,321/83 | -648/20 | -767/20 | P,M,C |
| 398 | `obv_30m_n20_recovery_t0.25_short_fixed12h` | -3,356/361 | -4,511/350 | -4,648/96 | -4,852/94 | P,M,C |
| 399 | `mfi_30m_n7_recovery_t0.9_short_indicator_or12h` | -3,372/182 | -3,387/182 | 194/45 | 94/45 | P,M,C |
| 400 | `cmf_5m_n40_trend_t0.5_short_indicator_or12h` | -3,411/1 | -6,955/1 | 0/0 | 0/0 | N,P,M,C |
| 401 | `cmf_240m_n10_into_t0.2_short_indicator_or12h` | -3,463/98 | -2,705/95 | -3,263/31 | -2,949/31 | P,M,C |
| 402 | `cmf_60m_n40_into_t0.2_short_indicator_or12h` | -3,464/70 | -3,875/70 | -2,110/26 | -2,184/26 | P,M,C |
| 403 | `obv_60m_n40_into_t0.25_short_fixed12h` | -3,478/96 | -3,496/93 | -630/31 | -288/30 | P,M,C |
| 404 | `mfi_60m_n14_trend_t0.6_short_indicator_or12h` | -3,483/112 | -3,846/111 | 177/25 | -42/25 | P,M,C |
| 405 | `mfi_15m_n7_into_t0.8_short_indicator_or12h` | -3,522/662 | -5,204/661 | -1,053/176 | -1,201/175 | P,M,C |
| 406 | `obv_5m_n40_recovery_t0.25_short_fixed12h` | -3,546/532 | -3,402/530 | -5,166/138 | -5,470/138 | P,M,C |
| 407 | `obv_60m_n20_into_t0.5_short_indicator_or12h` | -3,570/48 | -3,654/48 | -2,138/16 | -2,143/16 | P,M,C |
| 408 | `cmf_5m_n20_trend_t0.5_short_indicator_or12h` | -3,572/50 | -3,177/50 | -899/6 | -734/6 | N,P,M,C |
| 409 | `cmf_5m_n40_into_t0.2_short_fixed12h` | -3,609/438 | -4,112/435 | -2,059/109 | -2,502/109 | P,M,C |
| 410 | `mfi_30m_n7_into_t0.6_short_fixed12h` | -3,656/456 | -5,753/444 | -2,572/116 | -3,135/112 | P,M,C |
| 411 | `mfi_60m_n7_trend_t0.8_short_indicator_or12h` | -3,657/155 | -2,563/152 | -815/37 | -764/37 | P,M,C |
| 412 | `mfi_5m_n14_recovery_t0.9_short_fixed12h` | -3,658/111 | -3,462/111 | -3,952/29 | -3,832/29 | P,M,C |
| 413 | `obv_60m_n40_into_t0.25_short_indicator_or12h` | -3,664/96 | -3,485/93 | -654/31 | -389/30 | P,M,C |
| 414 | `obv_15m_n40_into_t0.25_short_fixed12h` | -3,670/263 | -4,159/263 | -2,334/68 | -2,261/68 | P,M,C |
| 415 | `cmf_240m_n10_trend_t0.2_short_indicator_or12h` | -3,680/107 | -2,948/96 | -891/29 | -132/24 | P,M,C |
| 416 | `mfi_15m_n14_into_t0.6_short_indicator_or12h` | -3,689/390 | -5,080/390 | -961/97 | -1,482/97 | P,M,C |
| 417 | `cmf_240m_n10_into_t0.2_short_fixed12h` | -3,694/98 | -2,727/95 | -3,567/31 | -3,265/31 | P,M,C |
| 418 | `obv_60m_n20_into_t0.25_short_fixed12h` | -3,725/208 | -3,002/205 | -1,369/57 | -1,116/57 | P,M,C |
| 419 | `mfi_5m_n14_recovery_t0.8_short_indicator_or12h` | -3,763/366 | -4,028/366 | -854/104 | -997/104 | P,M,C |
| 420 | `mfi_30m_n14_into_t0.6_short_indicator_or12h` | -3,766/183 | -3,770/183 | -1,738/45 | -1,926/45 | P,M,C |
| 421 | `obv_15m_n40_trend_t0.5_short_indicator_or12h` | -3,777/46 | -3,419/46 | 45/5 | 72/5 | N,P,M,C |
| 422 | `mfi_15m_n14_into_t0.8_short_indicator_or12h` | -3,786/95 | -4,235/95 | -1,254/22 | -1,216/22 | P,M,C |
| 423 | `mfi_30m_n7_into_t0.9_short_indicator_or12h` | -3,812/181 | -4,355/181 | 1,140/45 | 1,219/45 | P,M,C |
| 424 | `obv_5m_n10_into_t0.75_short_fixed12h` | -3,849/447 | -2,696/443 | -5,341/113 | -4,203/112 | P,M,C |
| 425 | `mfi_30m_n14_recovery_t0.8_short_indicator_or12h` | -3,850/49 | -3,698/49 | -504/8 | -480/8 | N,P,M,C |
| 426 | `obv_5m_n40_into_t0.25_short_fixed12h` | -3,888/531 | -4,396/531 | -3,021/137 | -2,652/137 | P,M,C |
| 427 | `cmf_240m_n40_trend_t0_short_fixed12h` | -3,898/85 | -3,104/78 | -842/15 | -1,310/13 | P,M,C |
| 428 | `obv_60m_n20_into_t0.5_short_fixed12h` | -3,903/48 | -4,072/48 | -2,110/16 | -2,129/16 | P,M,C |
| 429 | `obv_15m_n20_trend_t0.5_short_indicator_or12h` | -3,905/237 | -3,744/237 | -1,092/47 | -963/47 | P,M,C |
| 430 | `mfi_60m_n28_trend_t0_short_fixed12h` | -3,910/236 | -4,630/232 | -2,257/60 | -3,083/59 | P,M,C |
| 431 | `mfi_5m_n28_into_t0.8_short_fixed12h` | -3,910/20 | -3,918/20 | -2,092/10 | -1,943/10 | N,P,M,C |
| 432 | `mfi_30m_n7_into_t0.8_short_indicator_or12h` | -3,910/316 | -4,691/316 | 394/84 | 580/84 | P,M,C |
| 433 | `obv_60m_n40_recovery_t0.25_short_fixed12h` | -3,923/99 | -2,246/94 | 1,019/33 | 746/31 | P,M,C |
| 434 | `cmf_60m_n20_into_t0.05_short_fixed12h` | -3,939/339 | -1,687/328 | -2,601/78 | -1,492/73 | P,M,C |
| 435 | `obv_30m_n10_into_t0.5_short_fixed12h` | -3,940/332 | -5,365/329 | 1,017/90 | 626/90 | P,M,C |
| 436 | `mfi_5m_n28_recovery_t0.8_short_fixed12h` | -3,948/20 | -3,841/20 | -1,701/10 | -1,649/10 | N,P,M,C |
| 437 | `obv_60m_n10_trend_t0.75_short_indicator_or12h` | -3,975/53 | -3,883/53 | -41/9 | -119/9 | N,P,M,C |
| 438 | `obv_15m_n40_recovery_t0.5_short_fixed12h` | -3,998/27 | -3,969/27 | -2,881/4 | -2,858/4 | N,P,M,C |
| 439 | `mfi_30m_n7_recovery_t0.6_short_indicator_or12h` | -4,024/598 | -3,627/596 | 572/161 | 462/161 | P,M,C |
| 440 | `obv_60m_n10_into_t0.25_short_fixed12h` | -4,078/386 | -4,479/365 | -4,532/105 | -4,663/98 | P,M,C |
| 441 | `obv_60m_n40_recovery_t0.25_short_indicator_or12h` | -4,082/99 | -2,380/94 | 675/33 | 257/31 | P,M,C |
| 442 | `cmf_60m_n40_trend_t0_short_fixed12h` | -4,111/241 | -3,724/230 | -987/61 | -1,025/58 | P,M,C |
| 443 | `obv_30m_n20_into_t0.25_short_fixed12h` | -4,128/352 | -3,657/345 | -2,766/93 | -3,032/89 | P,M,C |
| 444 | `cmf_60m_n40_into_t0.2_short_fixed12h` | -4,145/70 | -4,456/70 | -2,110/26 | -2,184/26 | P,M,C |
| 445 | `cmf_15m_n10_trend_t0.5_short_indicator_or12h` | -4,166/100 | -3,778/100 | -2,393/20 | -2,118/20 | P,M,C |
| 446 | `cmf_30m_n20_into_t0.2_short_indicator_or12h` | -4,167/280 | -4,085/278 | -888/72 | -1,045/71 | P,M,C |
| 447 | `obv_60m_n10_recovery_t0.75_short_fixed12h` | -4,169/40 | -4,001/40 | -2,344/11 | -2,195/11 | P,M,C |
| 448 | `obv_60m_n10_trend_t0.75_short_fixed12h` | -4,173/53 | -4,142/53 | -458/9 | -444/9 | N,P,M,C |
| 449 | `cmf_5m_n40_trend_t0.5_short_fixed12h` | -4,191/1 | -7,936/1 | 0/0 | 0/0 | N,P,M,C |
| 450 | `cmf_5m_n20_trend_t0.5_short_fixed12h` | -4,228/48 | -3,715/48 | 178/6 | 247/6 | N,P,M,C |
| 451 | `mfi_60m_n7_into_t0.9_short_fixed12h` | -4,237/84 | -3,891/83 | -929/20 | -1,076/20 | P,M,C |
| 452 | `mfi_30m_n14_trend_t0.8_short_indicator_or12h` | -4,284/50 | -3,950/50 | -118/10 | -132/10 | P,M,C |
| 453 | `mfi_60m_n7_recovery_t0.9_short_indicator_or12h` | -4,335/84 | -4,304/84 | -1,116/20 | -1,052/20 | P,M,C |
| 454 | `obv_15m_n40_recovery_t0.5_short_indicator_or12h` | -4,368/27 | -4,398/27 | -2,900/4 | -2,929/4 | N,P,M,C |
| 455 | `obv_240m_n10_recovery_t0.25_short_fixed12h` | -4,398/135 | -3,045/125 | 691/39 | 582/37 | P,M,C |
| 456 | `cmf_60m_n40_into_t0.05_short_indicator_or12h` | -4,422/234 | -5,607/232 | 356/62 | 157/61 | P,M,C |
| 457 | `obv_240m_n20_into_t0.25_short_indicator_or12h` | -4,505/88 | -4,731/83 | -537/27 | -538/25 | P,M,C |
| 458 | `obv_60m_n10_into_t0.75_short_indicator_or12h` | -4,507/41 | -3,938/40 | -3,406/12 | -2,980/11 | P,M,C |
| 459 | `mfi_15m_n28_trend_t0.6_short_fixed12h` | -4,519/86 | -4,855/86 | -471/13 | -498/13 | P,M,C |
| 460 | `cmf_30m_n10_recovery_t0.5_short_fixed12h` | -4,538/66 | -4,157/66 | -1,405/15 | -1,591/15 | P,M,C |
| 461 | `mfi_30m_n7_recovery_t0.6_short_fixed12h` | -4,541/454 | -1,827/443 | -3,768/114 | -4,340/111 | P,M,C |
| 462 | `obv_5m_n10_recovery_t0.75_short_fixed12h` | -4,560/449 | -5,943/447 | -6,112/113 | -6,475/113 | P,M,C |
| 463 | `obv_240m_n20_into_t0.25_short_fixed12h` | -4,589/88 | -4,784/83 | -537/27 | -538/25 | P,M,C |
| 464 | `mfi_30m_n14_into_t0.8_short_indicator_or12h` | -4,617/48 | -4,782/48 | -519/8 | -532/8 | N,P,M,C |
| 465 | `cmf_60m_n10_into_t0.5_short_fixed12h` | -4,628/30 | -4,629/30 | -1,287/4 | -1,269/4 | N,P,M,C |
| 466 | `obv_15m_n40_into_t0.25_short_indicator_or12h` | -4,630/271 | -5,130/271 | -3,091/70 | -3,010/70 | P,M,C |
| 467 | `cmf_60m_n10_into_t0.5_short_indicator_or12h` | -4,636/30 | -4,780/30 | -1,353/4 | -1,371/4 | N,P,M,C |
| 468 | `mfi_15m_n14_recovery_t0.8_short_indicator_or12h` | -4,645/95 | -4,857/95 | -1,128/22 | -1,255/22 | P,M,C |
| 469 | `obv_30m_n10_into_t0.75_short_fixed12h` | -4,665/86 | -4,878/86 | -1,798/23 | -1,762/23 | P,M,C |
| 470 | `mfi_240m_n14_trend_t0_short_fixed12h` | -4,741/119 | -4,510/116 | -843/31 | -664/31 | P,M,C |
| 471 | `cmf_5m_n10_recovery_t0.5_short_indicator_or12h` | -4,770/711 | -5,278/708 | -734/158 | -531/158 | P,M,C |
| 472 | `obv_5m_n40_into_t0.5_short_indicator_or12h` | -4,910/108 | -5,317/108 | -2,425/24 | -2,437/24 | P,M,C |
| 473 | `obv_5m_n10_recovery_t0.75_short_indicator_or12h` | -4,913/812 | -5,534/812 | -464/211 | -966/211 | P,M,C |
| 474 | `cmf_15m_n20_recovery_t0.2_short_fixed12h` | -4,921/434 | -4,777/434 | -3,442/109 | -3,915/109 | P,M,C |
| 475 | `mfi_60m_n7_recovery_t0.9_short_fixed12h` | -4,949/84 | -4,799/84 | -1,550/20 | -1,310/20 | P,M,C |
| 476 | `obv_60m_n10_into_t0.75_short_fixed12h` | -4,958/41 | -4,198/40 | -3,508/12 | -3,105/11 | P,M,C |
| 477 | `obv_60m_n20_trend_t0_short_fixed12h` | -4,960/326 | -6,602/319 | -427/73 | -703/68 | P,M,C |
| 478 | `cmf_240m_n40_trend_t0_short_indicator_or12h` | -4,996/95 | -4,923/95 | -1,174/15 | -1,245/15 | P,M,C |
| 479 | `obv_5m_n40_trend_t0.5_short_fixed12h` | -5,031/155 | -4,945/155 | 696/37 | 461/37 | P,M,C |
| 480 | `obv_60m_n20_recovery_t0.25_short_fixed12h` | -5,036/204 | -3,654/194 | -8/57 | 1,173/53 | P,M,C |
| 481 | `mfi_15m_n7_recovery_t0.9_short_indicator_or12h` | -5,041/348 | -5,655/347 | -1,825/86 | -1,650/85 | P,M,C |
| 482 | `mfi_240m_n14_trend_t0_short_indicator_or12h` | -5,091/124 | -4,857/124 | -866/33 | -678/33 | P,M,C |
| 483 | `obv_30m_n10_recovery_t0.5_short_fixed12h` | -5,096/332 | -4,430/327 | -2,034/90 | -2,101/89 | P,M,C |
| 484 | `obv_240m_n10_trend_t0.5_short_fixed12h` | -5,110/66 | -4,257/62 | 84/13 | 38/13 | P,M,C |
| 485 | `obv_30m_n20_into_t0.5_short_fixed12h` | -5,136/95 | -5,061/95 | 490/23 | 320/23 | P,M,C |
| 486 | `obv_240m_n10_trend_t0_short_fixed12h` | -5,179/182 | -3,986/163 | -2,255/48 | -1,918/41 | P,M,C |
| 487 | `mfi_15m_n14_recovery_t0.8_short_fixed12h` | -5,192/91 | -5,396/91 | -1,902/19 | -2,065/19 | P,M,C |
| 488 | `obv_240m_n10_trend_t0.5_short_indicator_or12h` | -5,257/66 | -4,432/62 | -205/13 | -248/13 | P,M,C |
| 489 | `obv_15m_n10_recovery_t0.75_short_fixed12h` | -5,345/184 | -4,373/181 | -1,117/44 | -1,086/44 | P,M,C |
| 490 | `cmf_240m_n10_recovery_t0.05_short_indicator_or12h` | -5,346/191 | -3,708/174 | -3,904/43 | -3,416/40 | P,M,C |
| 491 | `cmf_60m_n20_recovery_t0.2_short_indicator_or12h` | -5,411/156 | -5,277/153 | -6,640/50 | -6,571/48 | P,M,C |
| 492 | `obv_240m_n10_trend_t0_short_indicator_or12h` | -5,518/195 | -5,721/195 | -2,496/49 | -2,701/49 | P,M,C |
| 493 | `obv_5m_n20_into_t0.5_short_indicator_or12h` | -5,525/779 | -5,463/779 | -1,444/214 | -1,407/214 | P,M,C |
| 494 | `mfi_60m_n14_into_t0.6_short_indicator_or12h` | -5,529/103 | -5,079/103 | -2,630/32 | -2,384/32 | P,M,C |
| 495 | `mfi_30m_n7_recovery_t0.8_short_indicator_or12h` | -5,543/318 | -5,256/318 | -932/84 | -958/84 | P,M,C |
| 496 | `obv_15m_n40_trend_t0.5_short_fixed12h` | -5,551/46 | -5,345/46 | 184/5 | 198/5 | N,P,M,C |
| 497 | `cmf_30m_n20_trend_t0.2_short_indicator_or12h` | -5,561/199 | -4,928/199 | -2,147/40 | -1,395/40 | P,M,C |
| 498 | `cmf_240m_n20_into_t0.2_short_fixed12h` | -5,569/57 | -5,470/51 | -3,967/16 | -3,274/14 | P,M,C |
| 499 | `cmf_240m_n20_into_t0.2_short_indicator_or12h` | -5,569/57 | -5,455/51 | -3,967/16 | -3,274/14 | P,M,C |
| 500 | `mfi_30m_n14_trend_t0.8_short_fixed12h` | -5,582/50 | -5,506/50 | 308/10 | 184/10 | P,M,C |
| 501 | `obv_60m_n20_trend_t0.25_short_fixed12h` | -5,595/219 | -4,485/208 | -316/50 | 36/46 | P,M,C |
| 502 | `obv_240m_n10_recovery_t0.25_short_indicator_or12h` | -5,662/135 | -4,006/125 | -517/39 | -610/37 | P,M,C |
| 503 | `cmf_30m_n10_into_t0.5_short_indicator_or12h` | -5,676/69 | -5,910/68 | -1,355/15 | -1,450/15 | P,M,C |
| 504 | `mfi_60m_n14_into_t0.6_short_fixed12h` | -5,719/103 | -5,645/103 | -2,491/32 | -2,503/32 | P,M,C |
| 505 | `cmf_60m_n20_into_t0.05_short_indicator_or12h` | -5,744/405 | -6,798/401 | -2,598/92 | -2,495/91 | P,M,C |
| 506 | `mfi_15m_n7_into_t0.6_short_fixed12h` | -5,783/593 | -6,672/586 | -5,526/150 | -6,376/149 | P,M,C |
| 507 | `obv_5m_n40_recovery_t0.5_short_indicator_or12h` | -5,804/108 | -6,153/108 | -2,354/24 | -2,323/24 | P,M,C |
| 508 | `mfi_15m_n28_recovery_t0.6_short_indicator_or12h` | -5,816/70 | -5,818/70 | -1,073/19 | -965/19 | P,M,C |
| 509 | `cmf_15m_n40_recovery_t0.05_short_indicator_or12h` | -5,868/771 | -3,668/741 | -2,974/201 | -2,457/196 | P,M,C |
| 510 | `obv_5m_n20_trend_t0.75_short_indicator_or12h` | -5,874/106 | -8,469/106 | -1,117/25 | -929/25 | P,M,C |
| 511 | `mfi_15m_n7_into_t0.9_short_fixed12h` | -5,876/276 | -7,154/275 | -3,009/67 | -3,454/67 | P,M,C |
| 512 | `obv_30m_n20_into_t0.5_short_indicator_or12h` | -5,901/95 | -6,035/95 | -512/23 | -637/23 | P,M,C |
| 513 | `obv_30m_n20_recovery_t0.5_short_indicator_or12h` | -5,950/96 | -5,984/96 | 284/23 | 198/23 | P,M,C |
| 514 | `cmf_5m_n10_trend_t0.5_short_fixed12h` | -5,954/318 | -6,102/317 | -1,045/71 | -697/70 | P,M,C |
| 515 | `cmf_5m_n10_trend_t0.5_short_indicator_or12h` | -5,964/468 | -5,866/468 | -2,060/97 | -1,952/97 | P,M,C |
| 516 | `cmf_60m_n10_recovery_t0.2_short_indicator_or12h` | -5,976/379 | -4,062/364 | -5,830/106 | -3,950/101 | P,M,C |
| 517 | `cmf_60m_n20_recovery_t0.2_short_fixed12h` | -5,979/153 | -6,079/151 | -5,440/48 | -5,580/47 | P,M,C |
| 518 | `cmf_30m_n40_recovery_t0.2_short_indicator_or12h` | -6,010/98 | -4,912/98 | -2,621/28 | -2,203/28 | P,M,C |
| 519 | `obv_15m_n20_into_t0.5_short_indicator_or12h` | -6,049/212 | -7,141/212 | -3,600/52 | -3,959/52 | P,M,C |
| 520 | `cmf_30m_n10_recovery_t0.5_short_indicator_or12h` | -6,073/69 | -5,869/69 | -1,891/15 | -1,974/15 | P,M,C |
| 521 | `obv_15m_n40_recovery_t0.25_short_indicator_or12h` | -6,101/276 | -6,223/274 | -2,508/72 | -2,796/72 | P,M,C |
| 522 | `cmf_30m_n20_trend_t0.2_short_fixed12h` | -6,122/195 | -5,602/195 | -2,523/40 | -1,749/40 | P,M,C |
| 523 | `mfi_15m_n28_recovery_t0.6_short_fixed12h` | -6,173/70 | -5,858/70 | -1,769/19 | -1,606/19 | P,M,C |
| 524 | `cmf_60m_n10_into_t0.05_short_indicator_or12h` | -6,204/660 | -7,038/655 | -6,191/163 | -6,615/163 | P,M,C |
| 525 | `cmf_240m_n10_trend_t0_short_indicator_or12h` | -6,214/211 | -6,596/211 | 69/47 | 25/47 | P,M,C |
| 526 | `obv_240m_n10_trend_t0.25_short_indicator_or12h` | -6,220/152 | -7,113/141 | -929/36 | -787/33 | P,M,C |
| 527 | `cmf_60m_n20_into_t0.2_short_indicator_or12h` | -6,222/158 | -7,002/151 | -5,840/50 | -6,449/47 | P,M,C |
| 528 | `cmf_240m_n20_recovery_t0.2_short_indicator_or12h` | -6,222/56 | -4,985/52 | -4,066/16 | -3,891/16 | P,M,C |
| 529 | `obv_240m_n40_trend_t0_short_indicator_or12h` | -6,227/91 | -6,778/91 | -2,375/24 | -2,356/24 | P,M,C |
| 530 | `mfi_240m_n7_into_t0.8_short_fixed12h` | -6,231/51 | -5,836/50 | -3,515/15 | -3,193/14 | P,M,C |
| 531 | `mfi_240m_n7_into_t0.8_short_indicator_or12h` | -6,231/51 | -5,827/50 | -3,515/15 | -3,193/14 | P,M,C |
| 532 | `cmf_30m_n40_into_t0.2_short_indicator_or12h` | -6,276/101 | -5,729/100 | -2,455/27 | -1,735/27 | P,M,C |
| 533 | `mfi_15m_n28_into_t0.6_short_fixed12h` | -6,288/68 | -6,540/68 | -2,345/19 | -2,582/19 | P,M,C |
| 534 | `cmf_240m_n20_recovery_t0.2_short_fixed12h` | -6,317/56 | -5,039/52 | -4,066/16 | -3,891/16 | P,M,C |
| 535 | `obv_15m_n20_recovery_t0.5_short_indicator_or12h` | -6,330/212 | -6,973/212 | -3,140/53 | -3,327/53 | P,M,C |
| 536 | `obv_60m_n20_recovery_t0.25_short_indicator_or12h` | -6,370/211 | -5,112/200 | -2,789/59 | -2,260/55 | P,M,C |
| 537 | `obv_30m_n10_trend_t0.5_short_indicator_or12h` | -6,376/391 | -5,398/390 | -3,815/91 | -3,635/90 | P,M,C |
| 538 | `cmf_60m_n20_into_t0.2_short_fixed12h` | -6,468/156 | -7,767/149 | -5,053/50 | -5,589/47 | P,M,C |
| 539 | `obv_15m_n10_trend_t0.75_short_indicator_or12h` | -6,472/224 | -5,862/224 | -149/52 | 44/52 | P,M,C |
| 540 | `obv_5m_n40_into_t0.5_short_fixed12h` | -6,485/103 | -6,532/103 | -3,250/23 | -3,161/23 | P,M,C |
| 541 | `mfi_15m_n28_trend_t0_short_fixed12h` | -6,486/549 | -7,425/543 | -3,656/140 | -3,559/138 | P,M,C |
| 542 | `obv_5m_n20_into_t0.5_short_fixed12h` | -6,550/455 | -7,108/453 | -4,281/120 | -4,530/119 | P,M,C |
| 543 | `mfi_15m_n14_trend_t0.8_short_indicator_or12h` | -6,583/113 | -6,550/113 | -2,403/22 | -2,430/22 | P,M,C |
| 544 | `obv_30m_n20_recovery_t0.5_short_fixed12h` | -6,590/96 | -6,755/96 | -37/23 | -137/23 | P,M,C |
| 545 | `obv_30m_n40_into_t0.25_short_fixed12h` | -6,692/157 | -6,221/154 | -2,297/51 | -2,711/49 | P,M,C |
| 546 | `cmf_30m_n40_into_t0.05_short_indicator_or12h` | -6,736/432 | -8,857/429 | -1,941/108 | -2,567/107 | P,M,C |
| 547 | `mfi_30m_n28_into_t0.6_short_indicator_or12h` | -6,744/29 | -6,732/28 | -2,224/6 | -2,107/6 | N,P,M,C |
| 548 | `cmf_60m_n10_into_t0.05_short_fixed12h` | -6,766/477 | -7,296/457 | -5,150/121 | -3,998/117 | P,M,C |
| 549 | `cmf_30m_n40_recovery_t0.2_short_fixed12h` | -6,796/98 | -5,802/98 | -2,469/28 | -2,122/28 | P,M,C |
| 550 | `obv_30m_n10_recovery_t0.75_short_fixed12h` | -6,824/87 | -5,939/86 | -2,758/24 | -2,703/23 | P,M,C |
| 551 | `cmf_15m_n40_trend_t0.05_short_indicator_or12h` | -6,847/647 | -6,307/646 | -4,778/154 | -3,992/153 | P,M,C |
| 552 | `cmf_240m_n20_into_t0.05_short_indicator_or12h` | -6,856/124 | -7,370/111 | 284/31 | -534/27 | P,M,C |
| 553 | `mfi_240m_n7_recovery_t0.6_short_fixed12h` | -6,891/97 | -6,445/96 | -4,153/30 | -4,163/30 | P,M,C |
| 554 | `cmf_240m_n20_into_t0.05_short_fixed12h` | -6,904/124 | -7,057/111 | -54/31 | -606/27 | P,M,C |
| 555 | `cmf_5m_n40_trend_t0.2_short_indicator_or12h` | -6,940/437 | -6,711/437 | -365/93 | -314/93 | P,M,C |
| 556 | `obv_60m_n10_recovery_t0.25_short_indicator_or12h` | -6,948/436 | -6,491/414 | -5,432/123 | -5,328/114 | P,M,C |
| 557 | `cmf_60m_n10_recovery_t0.2_short_fixed12h` | -7,011/360 | -3,066/349 | -5,305/103 | -1,449/99 | P,M,C |
| 558 | `cmf_30m_n40_into_t0.2_short_fixed12h` | -7,067/100 | -6,592/99 | -2,440/27 | -1,694/27 | P,M,C |
| 559 | `cmf_5m_n40_recovery_t0.2_short_fixed12h` | -7,142/446 | -6,819/444 | -4,251/109 | -4,758/108 | P,M,C |
| 560 | `mfi_30m_n28_trend_t0.6_short_fixed12h` | -7,157/36 | -6,911/36 | 493/3 | 531/3 | N,P,M,C |
| 561 | `mfi_240m_n7_into_t0.6_short_indicator_or12h` | -7,192/96 | -7,480/93 | -2,153/30 | -1,904/30 | P,M,C |
| 562 | `mfi_15m_n28_into_t0.6_short_indicator_or12h` | -7,195/69 | -7,494/69 | -2,579/19 | -2,697/19 | P,M,C |
| 563 | `mfi_15m_n14_recovery_t0.6_short_indicator_or12h` | -7,226/390 | -7,816/390 | -3,304/97 | -3,623/97 | P,M,C |
| 564 | `obv_5m_n40_into_t0.25_short_indicator_or12h` | -7,241/842 | -9,287/842 | -3,630/219 | -4,025/219 | P,M,C |
| 565 | `cmf_30m_n40_trend_t0_short_fixed12h` | -7,263/366 | -6,189/359 | -2,693/96 | -2,320/95 | P,M,C |
| 566 | `mfi_240m_n7_into_t0.6_short_fixed12h` | -7,308/96 | -7,592/93 | -2,153/30 | -1,865/30 | P,M,C |
| 567 | `mfi_60m_n7_recovery_t0.6_short_fixed12h` | -7,322/290 | -5,145/280 | -3,589/79 | -2,139/78 | P,M,C |
| 568 | `obv_240m_n20_recovery_t0.25_short_fixed12h` | -7,356/92 | -7,685/84 | -3,645/28 | -3,802/27 | P,M,C |
| 569 | `obv_240m_n10_trend_t0.25_short_fixed12h` | -7,391/152 | -7,910/141 | -1,480/36 | -933/33 | P,M,C |
| 570 | `cmf_30m_n20_recovery_t0.05_short_indicator_or12h` | -7,399/785 | -6,990/697 | -1,475/199 | -2,155/176 | P,M,C |
| 571 | `obv_15m_n20_trend_t0_short_fixed12h` | -7,436/622 | -5,521/612 | -5,827/162 | -4,219/159 | P,M,C |
| 572 | `mfi_30m_n28_recovery_t0.6_short_indicator_or12h` | -7,474/29 | -6,726/29 | -2,459/6 | -2,527/6 | N,P,M,C |
| 573 | `mfi_60m_n7_recovery_t0.8_short_fixed12h` | -7,497/152 | -6,646/150 | -2,617/45 | -2,371/45 | P,M,C |
| 574 | `mfi_240m_n7_recovery_t0.6_short_indicator_or12h` | -7,497/97 | -7,033/96 | -4,479/30 | -4,401/30 | P,M,C |
| 575 | `obv_60m_n20_trend_t0.25_short_indicator_or12h` | -7,515/221 | -6,885/212 | -674/51 | -90/47 | P,M,C |
| 576 | `mfi_5m_n7_into_t0.9_short_indicator_or12h` | -7,544/1198 | -9,698/1198 | -3,254/318 | -3,635/318 | P,M,C |
| 577 | `cmf_30m_n40_into_t0.05_short_fixed12h` | -7,551/355 | -10,183/346 | -1,323/91 | -2,739/88 | P,M,C |
| 578 | `cmf_240m_n10_into_t0.05_short_indicator_or12h` | -7,561/182 | -7,366/177 | -2,977/41 | -2,983/40 | P,M,C |
| 579 | `obv_240m_n20_recovery_t0.25_short_indicator_or12h` | -7,564/92 | -7,870/84 | -3,628/28 | -3,742/27 | P,M,C |
| 580 | `mfi_30m_n28_trend_t0.6_short_indicator_or12h` | -7,575/36 | -7,531/36 | 493/3 | 531/3 | N,P,M,C |
| 581 | `mfi_30m_n28_into_t0.6_short_fixed12h` | -7,594/29 | -7,412/28 | -2,308/6 | -2,213/6 | N,P,M,C |
| 582 | `mfi_5m_n28_into_t0.6_short_fixed12h` | -7,622/238 | -8,011/238 | -3,687/62 | -3,630/62 | P,M,C |
| 583 | `cmf_240m_n10_trend_t0_short_fixed12h` | -7,671/196 | -5,128/178 | 310/44 | 1,061/41 | P,M,C |
| 584 | `mfi_15m_n14_into_t0.6_short_fixed12h` | -7,685/324 | -7,189/319 | -2,440/81 | -2,947/80 | P,M,C |
| 585 | `obv_30m_n40_trend_t0.25_short_indicator_or12h` | -7,691/195 | -8,263/193 | -1,526/41 | -1,637/40 | P,M,C |
| 586 | `cmf_60m_n20_recovery_t0.05_short_indicator_or12h` | -7,751/416 | -7,440/373 | 769/96 | 112/87 | P,M,C |
| 587 | `mfi_5m_n14_trend_t0.8_short_indicator_or12h` | -7,777/432 | -6,992/432 | -2,112/101 | -2,090/101 | P,M,C |
| 588 | `cmf_15m_n40_recovery_t0.05_short_fixed12h` | -7,870/507 | -5,975/502 | -3,436/129 | -3,136/126 | P,M,C |
| 589 | `obv_5m_n20_recovery_t0.5_short_fixed12h` | -7,888/456 | -7,762/452 | -3,523/121 | -3,529/119 | P,M,C |
| 590 | `mfi_60m_n7_recovery_t0.8_short_indicator_or12h` | -7,957/155 | -7,796/154 | -3,349/46 | -3,028/46 | P,M,C |
| 591 | `cmf_240m_n10_recovery_t0.05_short_fixed12h` | -7,971/185 | -6,125/170 | -3,559/43 | -3,186/39 | P,M,C |
| 592 | `obv_15m_n10_recovery_t0.5_short_indicator_or12h` | -7,991/822 | -8,393/818 | -3,970/215 | -4,398/213 | P,M,C |
| 593 | `mfi_60m_n7_recovery_t0.6_short_indicator_or12h` | -8,018/304 | -8,274/300 | -3,647/84 | -3,564/83 | P,M,C |
| 594 | `mfi_15m_n7_trend_t0.6_short_fixed12h` | -8,059/586 | -6,343/578 | -7,316/148 | -7,006/147 | P,M,C |
| 595 | `cmf_60m_n40_trend_t0.05_short_fixed12h` | -8,109/198 | -7,062/194 | 220/46 | 46/46 | P,M,C |
| 596 | `obv_15m_n40_recovery_t0.25_short_fixed12h` | -8,139/267 | -7,938/264 | -3,785/70 | -4,088/70 | P,M,C |
| 597 | `cmf_60m_n40_recovery_t0.05_short_indicator_or12h` | -8,170/244 | -7,432/231 | -459/65 | -4/61 | P,M,C |
| 598 | `obv_5m_n40_recovery_t0.5_short_fixed12h` | -8,181/103 | -8,580/103 | -3,622/23 | -3,739/23 | P,M,C |
| 599 | `obv_30m_n20_trend_t0.25_short_indicator_or12h` | -8,221/395 | -7,541/391 | -7,032/92 | -6,774/91 | P,M,C |
| 600 | `cmf_15m_n20_trend_t0.2_short_indicator_or12h` | -8,254/432 | -6,434/432 | -4,903/110 | -4,275/110 | P,M,C |
| 601 | `cmf_5m_n20_into_t0.2_short_indicator_or12h` | -8,282/1690 | -11,977/1690 | -3,213/431 | -4,026/431 | P,M,C |
| 602 | `mfi_30m_n28_recovery_t0.6_short_fixed12h` | -8,294/29 | -7,590/29 | -2,506/6 | -2,570/6 | N,P,M,C |
| 603 | `obv_60m_n40_trend_t0.25_short_indicator_or12h` | -8,296/119 | -7,818/116 | -2,316/25 | -2,260/25 | P,M,C |
| 604 | `cmf_240m_n10_into_t0.05_short_fixed12h` | -8,326/178 | -8,207/163 | -3,332/41 | -3,464/37 | P,M,C |
| 605 | `obv_5m_n20_recovery_t0.5_short_indicator_or12h` | -8,362/781 | -7,828/779 | -2,473/215 | -2,415/214 | P,M,C |
| 606 | `cmf_60m_n40_recovery_t0.05_short_fixed12h` | -8,365/225 | -6,994/217 | 441/61 | 590/58 | P,M,C |
| 607 | `cmf_60m_n20_recovery_t0.05_short_fixed12h` | -8,480/323 | -7,372/317 | 1,543/72 | 1,054/72 | P,M,C |
| 608 | `cmf_30m_n10_into_t0.2_short_fixed12h` | -8,489/486 | -9,191/477 | -2,382/127 | -2,745/126 | P,M,C |
| 609 | `mfi_240m_n7_trend_t0.2_short_indicator_or12h` | -8,533/169 | -7,207/162 | 583/39 | 894/37 | P,M,C |
| 610 | `obv_5m_n20_trend_t0.75_short_fixed12h` | -8,547/95 | -11,756/95 | -659/22 | -540/22 | P,M,C |
| 611 | `cmf_5m_n10_into_t0.2_short_fixed12h` | -8,568/767 | -7,787/765 | -7,488/196 | -7,390/194 | P,M,C |
| 612 | `obv_240m_n40_trend_t0_short_fixed12h` | -8,623/83 | -7,498/77 | -4,818/23 | -4,241/21 | P,M,C |
| 613 | `obv_30m_n10_trend_t0.75_short_fixed12h` | -8,634/108 | -8,514/108 | -2,751/23 | -2,475/23 | P,M,C |
| 614 | `cmf_5m_n10_into_t0.5_short_fixed12h` | -8,645/394 | -9,084/394 | -2,518/94 | -2,494/94 | P,M,C |
| 615 | `cmf_15m_n10_into_t0.2_short_indicator_or12h` | -8,711/1259 | -11,944/1259 | -6,139/307 | -7,084/307 | P,M,C |
| 616 | `obv_5m_n20_trend_t0.5_short_fixed12h` | -8,714/488 | -9,151/488 | -7,086/120 | -7,321/120 | P,M,C |
| 617 | `obv_30m_n10_trend_t0.25_short_fixed12h` | -8,780/539 | -6,320/521 | -7,041/139 | -6,940/132 | P,M,C |
| 618 | `mfi_60m_n14_trend_t0_short_indicator_or12h` | -8,789/546 | -10,216/546 | -2,979/130 | -3,400/130 | P,M,C |
| 619 | `cmf_15m_n20_into_t0.2_short_indicator_or12h` | -8,791/529 | -10,544/529 | -4,091/138 | -4,587/138 | P,M,C |
| 620 | `mfi_240m_n7_trend_t0.2_short_fixed12h` | -8,842/169 | -6,892/160 | -883/39 | -405/37 | P,M,C |
| 621 | `obv_30m_n40_into_t0.25_short_indicator_or12h` | -8,954/157 | -9,112/154 | -4,559/51 | -4,745/49 | P,M,C |
| 622 | `cmf_30m_n20_into_t0.05_short_indicator_or12h` | -8,977/744 | -10,473/741 | -3,726/185 | -4,369/184 | P,M,C |
| 623 | `mfi_15m_n7_recovery_t0.8_short_indicator_or12h` | -8,993/663 | -9,433/661 | -2,322/176 | -2,357/175 | P,M,C |
| 624 | `obv_5m_n20_into_t0.25_short_indicator_or12h` | -9,017/2158 | -11,190/2158 | -2,822/552 | -3,397/552 | P,M,C |
| 625 | `obv_15m_n20_trend_t0.25_short_fixed12h` | -9,039/501 | -9,336/499 | -1,825/121 | -1,670/120 | P,M,C |
| 626 | `mfi_60m_n7_into_t0.6_short_indicator_or12h` | -9,054/304 | -9,489/302 | -5,055/82 | -5,247/81 | P,M,C |
| 627 | `mfi_60m_n7_trend_t0.2_short_fixed12h` | -9,082/471 | -8,193/449 | -4,006/113 | -4,141/104 | P,M,C |
| 628 | `obv_60m_n40_trend_t0.25_short_fixed12h` | -9,092/119 | -8,525/116 | -2,584/25 | -2,560/25 | P,M,C |
| 629 | `obv_30m_n10_trend_t0_short_fixed12h` | -9,095/593 | -5,871/576 | -5,865/153 | -5,312/150 | P,M,C |
| 630 | `obv_30m_n10_into_t0.25_short_fixed12h` | -9,135/532 | -8,139/518 | -2,674/140 | -2,573/138 | P,M,C |
| 631 | `mfi_15m_n7_recovery_t0.9_short_fixed12h` | -9,169/277 | -9,617/276 | -4,221/68 | -4,334/67 | P,M,C |
| 632 | `obv_30m_n20_trend_t0.5_short_indicator_or12h` | -9,232/134 | -9,242/132 | -3,812/27 | -3,572/27 | P,M,C |
| 633 | `obv_15m_n10_into_t0.25_short_fixed12h` | -9,251/657 | -6,621/645 | -6,119/166 | -5,423/162 | P,M,C |
| 634 | `cmf_30m_n40_recovery_t0.05_short_indicator_or12h` | -9,357/436 | -9,324/411 | -3,116/108 | -3,004/103 | P,M,C |
| 635 | `mfi_5m_n28_recovery_t0.6_short_fixed12h` | -9,388/241 | -9,408/239 | -3,543/62 | -3,779/62 | P,M,C |
| 636 | `cmf_30m_n40_recovery_t0.05_short_fixed12h` | -9,505/341 | -8,180/339 | -4,164/88 | -3,300/87 | P,M,C |
| 637 | `obv_15m_n20_into_t0.5_short_fixed12h` | -9,510/196 | -11,261/194 | -1,666/50 | -2,034/50 | P,M,C |
| 638 | `obv_30m_n40_recovery_t0.25_short_fixed12h` | -9,588/159 | -9,725/156 | -3,683/49 | -3,846/48 | P,M,C |
| 639 | `obv_30m_n40_trend_t0.25_short_fixed12h` | -9,645/191 | -10,190/189 | -2,272/41 | -2,399/40 | P,M,C |
| 640 | `obv_15m_n10_into_t0.25_short_indicator_or12h` | -9,670/1513 | -12,374/1513 | -6,258/387 | -7,157/387 | P,M,C |
| 641 | `cmf_60m_n20_trend_t0.05_short_fixed12h` | -9,814/308 | -8,688/298 | -5,235/73 | -5,366/72 | P,M,C |
| 642 | `cmf_5m_n10_recovery_t0.5_short_fixed12h` | -9,826/395 | -10,306/394 | -2,680/95 | -2,876/94 | P,M,C |
| 643 | `cmf_30m_n10_trend_t0.2_short_indicator_or12h` | -9,833/542 | -8,784/542 | -4,637/123 | -4,278/123 | P,M,C |
| 644 | `obv_30m_n40_trend_t0_short_indicator_or12h` | -9,922/714 | -9,983/714 | -3,319/203 | -3,831/203 | P,M,C |
| 645 | `cmf_15m_n40_into_t0.05_short_indicator_or12h` | -9,924/763 | -10,814/753 | -5,323/203 | -5,674/203 | P,M,C |
| 646 | `cmf_30m_n20_trend_t0_short_fixed12h` | -9,995/501 | -6,468/488 | -6,087/128 | -4,452/125 | P,M,C |
| 647 | `cmf_60m_n40_trend_t0.05_short_indicator_or12h` | -10,012/206 | -8,583/202 | -666/46 | -861/46 | P,M,C |
| 648 | `obv_5m_n10_into_t0.5_short_fixed12h` | -10,037/710 | -10,968/705 | -7,076/179 | -5,913/179 | P,M,C |
| 649 | `obv_30m_n10_into_t0.75_short_indicator_or12h` | -10,063/87 | -10,166/87 | -2,870/24 | -2,897/24 | P,M,C |
| 650 | `mfi_15m_n14_recovery_t0.6_short_fixed12h` | -10,101/328 | -9,751/328 | -4,171/81 | -4,145/81 | P,M,C |
| 651 | `mfi_60m_n7_into_t0.6_short_fixed12h` | -10,102/293 | -9,649/287 | -4,741/79 | -4,949/78 | P,M,C |
| 652 | `mfi_60m_n7_into_t0.8_short_indicator_or12h` | -10,209/156 | -10,221/155 | -3,845/46 | -3,837/46 | P,M,C |
| 653 | `obv_60m_n20_trend_t0_short_indicator_or12h` | -10,377/558 | -11,023/558 | -499/126 | -540/126 | P,M,C |
| 654 | `mfi_60m_n7_into_t0.8_short_fixed12h` | -10,536/154 | -9,950/153 | -3,865/46 | -3,964/46 | P,M,C |
| 655 | `cmf_15m_n20_recovery_t0.2_short_indicator_or12h` | -10,659/532 | -11,259/527 | -4,676/137 | -5,117/136 | P,M,C |
| 656 | `mfi_60m_n7_trend_t0.6_short_indicator_or12h` | -10,755/311 | -9,346/308 | -2,318/77 | -2,074/76 | P,M,C |
| 657 | `mfi_5m_n28_into_t0.6_long_fixed12h` | 14,818/278 | 18,017/277 | 272/64 | 405/63 | B,M,C |
| 658 | `obv_5m_n40_recovery_t0.25_short_indicator_or12h` | -10,786/848 | -12,179/842 | -4,242/222 | -5,132/219 | P,M,C |
| 659 | `cmf_30m_n40_trend_t0.05_short_indicator_or12h` | -10,859/370 | -10,919/366 | -3,683/88 | -3,495/88 | P,M,C |
| 660 | `obv_30m_n10_recovery_t0.75_short_indicator_or12h` | -10,864/87 | -10,771/87 | -3,039/24 | -3,207/24 | P,M,C |
| 661 | `obv_15m_n10_recovery_t0.5_short_fixed12h` | -10,867/496 | -12,521/488 | -8,776/127 | -8,985/125 | P,M,C |
| 662 | `cmf_30m_n10_into_t0.05_short_fixed12h` | -10,908/610 | -11,062/585 | -3,846/159 | -3,051/155 | P,M,C |
| 663 | `mfi_5m_n7_recovery_t0.9_short_indicator_or12h` | -10,909/1198 | -11,702/1198 | -3,534/318 | -3,510/318 | P,M,C |
| 664 | `cmf_30m_n10_into_t0.2_short_indicator_or12h` | -10,957/638 | -12,405/636 | -2,915/165 | -3,735/164 | P,M,C |
| 665 | `mfi_30m_n7_trend_t0.8_short_indicator_or12h` | -10,982/324 | -10,082/324 | -4,035/68 | -3,905/68 | P,M,C |
| 666 | `obv_5m_n10_trend_t0.75_short_indicator_or12h` | -11,018/902 | -11,431/902 | -3,518/217 | -4,088/217 | P,M,C |
| 667 | `cmf_60m_n40_trend_t0_short_indicator_or12h` | -11,029/411 | -10,548/411 | -1,905/100 | -1,271/100 | P,M,C |
| 668 | `cmf_30m_n20_into_t0.05_short_fixed12h` | -11,068/493 | -12,587/483 | -7,056/125 | -8,087/123 | P,M,C |
| 669 | `mfi_15m_n14_trend_t0.8_short_fixed12h` | -11,109/108 | -11,135/108 | -2,162/20 | -2,122/20 | P,M,C |
| 670 | `obv_5m_n10_into_t0.75_long_fixed12h` | 14,477/480 | 14,426/479 | 6,787/121 | 6,996/120 | M |
| 671 | `mfi_60m_n14_trend_t0.2_short_fixed12h` | -11,114/323 | -7,526/315 | -1,332/74 | -7/73 | P,M,C |
| 672 | `mfi_5m_n14_trend_t0.8_short_fixed12h` | -11,137/310 | -9,819/308 | -5,557/70 | -5,306/69 | P,M,C |
| 673 | `cmf_30m_n40_trend_t0.05_short_fixed12h` | -11,267/304 | -9,594/297 | -573/72 | 343/71 | P,M,C |
| 674 | `obv_15m_n20_trend_t0.25_short_indicator_or12h` | -11,289/685 | -11,336/683 | -5,299/174 | -4,697/174 | P,M,C |
| 675 | `cmf_60m_n20_trend_t0_short_indicator_or12h` | -11,297/585 | -9,539/585 | -2,537/143 | -2,407/143 | P,M,C |
| 676 | `cmf_60m_n10_recovery_t0.05_short_indicator_or12h` | -11,390/692 | -12,647/599 | -7,706/171 | -7,644/150 | P,M,C |
| 677 | `obv_30m_n40_recovery_t0.25_short_indicator_or12h` | -11,533/159 | -11,040/156 | -5,751/49 | -5,737/48 | P,M,C |
| 678 | `cmf_30m_n10_recovery_t0.2_short_fixed12h` | -11,565/495 | -10,864/485 | -3,180/128 | -1,613/126 | P,M,C |
| 679 | `mfi_15m_n7_recovery_t0.6_short_indicator_or12h` | -11,574/1230 | -12,340/1226 | -4,356/316 | -3,932/314 | P,M,C |
| 680 | `obv_30m_n20_trend_t0.5_short_fixed12h` | -11,671/134 | -12,306/132 | -3,407/27 | -3,066/27 | P,M,C |
| 681 | `cmf_15m_n10_into_t0.2_short_fixed12h` | -11,688/617 | -13,534/611 | -6,060/153 | -5,864/150 | P,M,C |
| 682 | `mfi_5m_n14_into_t0.6_short_indicator_or12h` | -11,785/1295 | -13,913/1295 | -3,515/349 | -4,117/349 | P,M,C |
| 683 | `obv_30m_n10_recovery_t0.25_short_fixed12h` | -11,816/536 | -12,426/522 | -4,036/137 | -4,833/133 | P,M,C |
| 684 | `obv_30m_n10_into_t0.5_short_indicator_or12h` | -11,823/381 | -12,300/381 | -2,033/103 | -1,907/103 | P,M,C |
| 685 | `obv_15m_n20_into_t0.5_long_fixed12h` | 13,673/220 | 13,471/218 | 1,948/43 | 1,901/43 | B,M |
| 686 | `obv_60m_n10_into_t0.25_long_fixed12h` | 13,633/393 | 10,642/381 | 3,970/93 | 3,053/91 | B,M |
| 687 | `mfi_15m_n14_trend_t0.6_short_indicator_or12h` | -11,966/428 | -11,297/428 | -2,546/101 | -2,674/101 | P,M,C |
| 688 | `mfi_5m_n7_into_t0.8_short_indicator_or12h` | -12,002/2190 | -16,354/2190 | -4,008/568 | -4,699/568 | P,M,C |
| 689 | `obv_15m_n10_into_t0.5_short_fixed12h` | -12,062/496 | -12,486/491 | -9,096/125 | -10,562/122 | P,B,M,C |
| 690 | `mfi_15m_n7_into_t0.8_short_fixed12h` | -12,082/425 | -13,848/421 | -3,289/111 | -3,842/110 | P,M,C |
| 691 | `mfi_15m_n28_trend_t0.2_short_indicator_or12h` | -12,135/593 | -11,272/592 | -7,435/155 | -7,538/155 | P,M,C |
| 692 | `cmf_5m_n20_into_t0.2_long_fixed12h` | 13,441/629 | 14,425/624 | 7,243/159 | 8,189/157 | M |
| 693 | `obv_30m_n10_trend_t0.25_short_indicator_or12h` | -12,252/776 | -10,244/772 | -8,328/204 | -7,502/201 | P,M,C |
| 694 | `obv_15m_n10_trend_t0.75_short_fixed12h` | -12,359/200 | -11,830/200 | 626/44 | 899/44 | P,M,C |
| 695 | `cmf_60m_n10_into_t0.2_long_fixed12h` | 13,202/292 | 11,230/286 | 3,321/73 | 2,639/72 | B,M |
| 696 | `cmf_5m_n10_into_t0.2_long_fixed12h` | 13,191/758 | 13,245/755 | 7,954/196 | 7,455/194 | M |
| 697 | `obv_30m_n10_into_t0.25_short_indicator_or12h` | -12,396/766 | -13,159/765 | -3,987/201 | -3,781/201 | P,M,C |
| 698 | `mfi_15m_n7_into_t0.8_long_fixed12h` | 13,112/441 | 10,761/438 | 3,957/106 | 3,311/105 | B,M |
| 699 | `mfi_30m_n28_trend_t0.2_short_fixed12h` | -12,486/321 | -9,882/315 | -4,609/77 | -4,562/75 | P,M,C |
| 700 | `mfi_15m_n14_trend_t0_short_fixed12h` | -12,505/640 | -11,910/628 | -9,216/162 | -8,756/161 | P,M,C |
| 701 | `cmf_15m_n10_trend_t0_short_fixed12h` | -12,515/703 | -9,963/694 | -8,267/180 | -7,622/177 | P,M,C |
| 702 | `cmf_15m_n20_trend_t0.2_short_fixed12h` | -12,617/352 | -10,931/350 | -4,329/88 | -4,091/87 | P,M,C |
| 703 | `obv_5m_n20_recovery_t0.25_short_fixed12h` | -12,656/708 | -14,575/703 | -9,200/177 | -8,721/176 | P,M,C |
| 704 | `obv_60m_n10_recovery_t0.25_short_fixed12h` | -12,796/377 | -11,728/370 | -9,299/104 | -9,062/103 | P,M,C |
| 705 | `mfi_60m_n14_trend_t0_short_fixed12h` | -12,819/360 | -12,016/352 | -4,616/90 | -4,252/88 | P,M,C |
| 706 | `mfi_5m_n14_into_t0.6_short_fixed12h` | -12,910/583 | -12,680/581 | -10,284/146 | -9,798/146 | P,B,M,C |
| 707 | `mfi_5m_n14_into_t0.8_short_fixed12h` | -13,009/274 | -13,191/274 | -7,308/73 | -7,393/73 | P,M,C |
| 708 | `mfi_5m_n14_recovery_t0.6_short_fixed12h` | -13,029/582 | -15,395/577 | -9,683/147 | -10,352/146 | P,B,M,C |
| 709 | `cmf_15m_n40_trend_t0.05_short_fixed12h` | -13,246/452 | -10,662/447 | -7,493/112 | -7,362/111 | P,M,C |
| 710 | `mfi_60m_n7_trend_t0_short_fixed12h` | -13,252/477 | -14,036/462 | -7,565/117 | -7,609/112 | P,M,C |
| 711 | `obv_15m_n20_recovery_t0.5_long_fixed12h` | 12,152/219 | 12,137/217 | 1,663/43 | 1,622/43 | B,M |
| 712 | `obv_30m_n10_trend_t0.5_short_fixed12h` | -13,464/350 | -13,624/348 | -7,077/83 | -7,106/83 | P,M,C |
| 713 | `cmf_60m_n20_trend_t0_short_fixed12h` | -13,522/344 | -12,145/328 | -2,255/79 | -2,031/75 | P,M,C |
| 714 | `mfi_60m_n7_trend_t0.6_short_fixed12h` | -13,570/303 | -10,999/293 | -5,286/76 | -4,494/73 | P,M,C |
| 715 | `obv_15m_n10_trend_t0.5_short_fixed12h` | -13,652/501 | -12,677/497 | -2,757/119 | -2,463/119 | P,M,C |
| 716 | `mfi_30m_n7_trend_t0_short_fixed12h` | -13,663/620 | -11,315/602 | -5,068/164 | -4,489/157 | P,M,C |
| 717 | `mfi_30m_n7_trend_t0.6_short_indicator_or12h` | -13,671/595 | -12,403/595 | -4,828/136 | -4,552/136 | P,M,C |
| 718 | `cmf_15m_n20_trend_t0.05_short_fixed12h` | -13,778/594 | -14,511/591 | -7,202/148 | -6,768/148 | P,M,C |
| 719 | `cmf_15m_n10_recovery_t0.2_short_indicator_or12h` | -13,812/1311 | -15,582/1250 | -5,736/322 | -6,427/305 | P,M,C |
| 720 | `obv_60m_n10_trend_t0_short_fixed12h` | -13,819/466 | -16,097/452 | -5,635/116 | -5,328/114 | P,M,C |
| 721 | `mfi_5m_n7_into_t0.6_short_fixed12h` | -13,910/755 | -16,322/752 | -9,579/190 | -10,005/189 | P,B,M,C |
| 722 | `cmf_5m_n20_recovery_t0.2_short_indicator_or12h` | -13,940/1713 | -16,075/1687 | -2,729/437 | -3,060/431 | P,M,C |
| 723 | `cmf_30m_n10_recovery_t0.2_short_indicator_or12h` | -13,989/648 | -14,192/628 | -4,188/167 | -4,399/161 | P,M,C |
| 724 | `obv_15m_n20_recovery_t0.5_short_fixed12h` | -13,989/196 | -14,367/196 | -1,886/51 | -2,384/51 | P,M,C |
| 725 | `mfi_5m_n7_trend_t0.8_short_fixed12h` | -14,182/666 | -15,835/665 | -11,089/173 | -11,610/173 | P,B,M,C |
| 726 | `obv_15m_n10_trend_t0.25_short_fixed12h` | -14,212/657 | -16,763/645 | -4,372/166 | -5,121/164 | P,M,C |
| 727 | `mfi_60m_n14_trend_t0.2_short_indicator_or12h` | -14,360/350 | -13,129/341 | -2,338/79 | -1,902/78 | P,M,C |
| 728 | `obv_60m_n10_trend_t0.5_short_indicator_or12h` | -14,416/211 | -14,435/209 | -1,981/49 | -1,644/48 | P,M,C |
| 729 | `mfi_5m_n14_recovery_t0.8_short_fixed12h` | -14,437/275 | -13,944/274 | -7,708/74 | -7,589/73 | P,M,C |
| 730 | `obv_5m_n10_into_t0.5_short_indicator_or12h` | -14,442/2644 | -17,960/2644 | -5,469/652 | -6,683/652 | P,M,C |
| 731 | `mfi_5m_n28_trend_t0.2_short_fixed12h` | -14,445/683 | -9,693/676 | -8,209/174 | -5,781/172 | P,M,C |
| 732 | `cmf_5m_n20_into_t0.2_short_fixed12h` | -14,501/662 | -18,906/657 | -8,480/168 | -9,059/167 | P,M,C |
| 733 | `cmf_30m_n20_trend_t0.05_short_indicator_or12h` | -14,540/667 | -13,487/662 | -4,224/163 | -3,613/163 | P,M,C |
| 734 | `obv_15m_n40_trend_t0.25_short_fixed12h` | -14,586/296 | -13,487/292 | -6,736/73 | -6,559/73 | P,M,C |
| 735 | `cmf_30m_n10_recovery_t0.05_short_fixed12h` | -14,616/613 | -15,429/593 | -2,638/155 | -3,225/149 | P,M,C |
| 736 | `mfi_15m_n14_into_t0.6_long_fixed12h` | 10,966/349 | 10,894/347 | 3,078/82 | 3,205/82 | B,M |
| 737 | `cmf_15m_n10_recovery_t0.05_short_fixed12h` | -14,685/707 | -8,311/691 | -10,467/181 | -7,601/175 | P,B,M,C |
| 738 | `obv_5m_n40_into_t0.25_long_fixed12h` | 10,848/550 | 9,929/548 | 8,115/142 | 7,743/142 | M |
| 739 | `mfi_30m_n28_trend_t0_short_indicator_or12h` | -14,743/761 | -14,781/761 | -3,018/191 | -3,389/191 | P,M,C |
| 740 | `cmf_5m_n20_recovery_t0.2_long_fixed12h` | 10,830/628 | 10,789/624 | 6,373/158 | 6,590/157 | M |
| 741 | `mfi_30m_n7_trend_t0.2_short_fixed12h` | -14,785/609 | -13,587/585 | -5,227/156 | -5,345/150 | P,M,C |
| 742 | `obv_15m_n40_trend_t0_short_fixed12h` | -14,845/514 | -15,447/508 | -5,575/130 | -6,569/127 | P,M,C |
| 743 | `obv_60m_n10_trend_t0.5_short_fixed12h` | -14,937/211 | -14,584/208 | -1,668/49 | -1,403/48 | P,M,C |
| 744 | `mfi_30m_n7_trend_t0.8_short_fixed12h` | -14,957/278 | -15,321/277 | -3,314/60 | -2,934/60 | P,M,C |
| 745 | `obv_60m_n40_trend_t0_short_fixed12h` | -14,958/237 | -13,298/230 | -2,926/55 | -2,752/53 | P,M,C |
| 746 | `cmf_30m_n10_trend_t0.2_short_fixed12h` | -14,966/424 | -15,220/420 | -4,133/102 | -4,455/101 | P,M,C |
| 747 | `obv_30m_n10_recovery_t0.5_short_indicator_or12h` | -15,052/385 | -14,744/382 | -4,079/103 | -3,862/103 | P,M,C |
| 748 | `mfi_5m_n14_recovery_t0.6_short_indicator_or12h` | -15,081/1296 | -15,480/1295 | -4,275/349 | -4,212/349 | P,M,C |
| 749 | `obv_5m_n10_recovery_t0.75_long_fixed12h` | 10,501/483 | 12,005/477 | 6,072/121 | 6,054/120 | M |
| 750 | `cmf_30m_n20_trend_t0.05_short_fixed12h` | -15,103/460 | -17,805/448 | -6,816/118 | -6,459/113 | P,M,C |
| 751 | `mfi_60m_n28_trend_t0.2_short_indicator_or12h` | -15,116/206 | -13,527/201 | -3,148/47 | -2,508/46 | P,M,C |
| 752 | `mfi_5m_n28_trend_t0.6_short_indicator_or12h` | -15,123/343 | -17,834/343 | -2,688/82 | -2,652/82 | P,M,C |
| 753 | `obv_60m_n40_trend_t0_short_indicator_or12h` | -15,139/375 | -14,507/375 | -3,614/91 | -3,133/91 | P,M,C |
| 754 | `mfi_30m_n14_trend_t0.2_short_fixed12h` | -15,286/482 | -13,111/467 | -7,127/118 | -5,563/115 | P,M,C |
| 755 | `obv_15m_n40_into_t0.25_long_indicator_or12h` | 10,281/310 | 9,028/308 | 4,720/76 | 4,365/76 | B,M |
| 756 | `obv_60m_n10_into_t0.5_long_fixed12h` | 10,281/211 | 9,995/208 | 589/49 | 346/48 | B,M,C |
| 757 | `cmf_15m_n10_into_t0.05_short_fixed12h` | -15,323/709 | -20,513/697 | -8,355/182 | -7,782/179 | P,M,C |
| 758 | `cmf_5m_n10_recovery_t0.2_short_fixed12h` | -15,375/769 | -13,938/768 | -7,030/197 | -6,009/197 | P,M,C |
| 759 | `cmf_30m_n10_trend_t0_long_fixed12h` | 10,186/613 | 7,122/593 | 8,238/157 | 7,718/153 | M |
| 760 | `cmf_30m_n20_recovery_t0.05_short_fixed12h` | -15,412/498 | -12,063/493 | -7,387/129 | -7,391/129 | P,M,C |
| 761 | `obv_15m_n10_recovery_t0.25_short_fixed12h` | -15,665/659 | -16,675/648 | -5,151/170 | -6,626/168 | P,M,C |
| 762 | `cmf_30m_n40_trend_t0_short_indicator_or12h` | -15,672/798 | -13,916/798 | -6,307/213 | -5,711/213 | P,M,C |
| 763 | `obv_60m_n10_into_t0.25_long_indicator_or12h` | 9,845/424 | 9,119/419 | 3,340/96 | 2,903/95 | B,M |
| 764 | `cmf_60m_n10_trend_t0.2_short_indicator_or12h` | -15,745/299 | -14,493/295 | -3,923/74 | -3,260/73 | P,M,C |
| 765 | `mfi_30m_n28_trend_t0.2_short_indicator_or12h` | -15,765/345 | -14,563/342 | -5,712/82 | -5,559/81 | P,M,C |
| 766 | `mfi_15m_n7_recovery_t0.6_short_fixed12h` | -15,795/593 | -14,510/586 | -6,428/150 | -6,174/150 | P,M,C |
| 767 | `obv_60m_n10_into_t0.5_long_indicator_or12h` | 9,761/211 | 9,824/209 | 901/49 | 586/48 | B,M |
| 768 | `cmf_15m_n10_into_t0.2_long_fixed12h` | 9,743/590 | 5,185/583 | 5,121/149 | 2,320/147 | B,M,C |
| 769 | `mfi_30m_n14_trend_t0.2_short_indicator_or12h` | -15,937/626 | -14,176/624 | -5,136/154 | -4,439/154 | P,M,C |
| 770 | `obv_5m_n20_into_t0.25_short_fixed12h` | -15,962/702 | -16,335/698 | -8,477/176 | -8,046/175 | P,M,C |
| 771 | `cmf_15m_n40_trend_t0_short_fixed12h` | -16,021/517 | -14,819/510 | -4,716/129 | -4,810/127 | P,M,C |
| 772 | `cmf_5m_n40_into_t0.05_short_indicator_or12h` | -16,031/1951 | -18,222/1951 | -7,817/510 | -8,381/510 | P,M,C |
| 773 | `mfi_5m_n14_trend_t0.6_short_fixed12h` | -16,037/601 | -14,128/599 | -4,877/150 | -4,689/150 | P,M,C |
| 774 | `mfi_60m_n7_trend_t0.2_short_indicator_or12h` | -16,167/571 | -14,311/562 | -1,286/124 | -1,533/121 | P,M,C |
| 775 | `mfi_30m_n28_trend_t0_short_fixed12h` | -16,322/390 | -16,795/383 | -5,545/100 | -5,459/99 | P,M,C |
| 776 | `cmf_30m_n10_trend_t0.05_short_fixed12h` | -16,378/604 | -14,699/583 | -6,087/151 | -7,308/146 | P,M,C |
| 777 | `mfi_60m_n28_trend_t0.2_short_fixed12h` | -16,378/204 | -14,565/199 | -4,417/46 | -3,762/45 | P,M,C |
| 778 | `cmf_60m_n10_into_t0.2_long_indicator_or12h` | 9,153/299 | 7,991/295 | 2,292/74 | 1,652/73 | B,M |
| 779 | `cmf_5m_n40_trend_t0.05_short_fixed12h` | -16,525/669 | -16,047/664 | -9,668/170 | -10,212/169 | P,B,M,C |
| 780 | `obv_15m_n40_recovery_t0.25_long_indicator_or12h` | 8,936/312 | 8,671/308 | 3,660/73 | 3,720/73 | B,M |
| 781 | `cmf_15m_n20_into_t0.05_short_indicator_or12h` | -16,672/1338 | -18,814/1336 | -6,640/358 | -7,574/357 | P,M,C |
| 782 | `obv_30m_n20_into_t0.25_long_fixed12h` | 8,844/375 | 9,954/368 | 8,700/90 | 8,879/89 | M |
| 783 | `mfi_30m_n7_into_t0.8_long_fixed12h` | 8,806/278 | 9,191/277 | 1,969/60 | 1,590/60 | B,M |
| 784 | `mfi_5m_n7_into_t0.9_short_fixed12h` | -16,785/518 | -15,698/518 | -7,230/132 | -6,743/132 | P,M,C |
| 785 | `mfi_15m_n14_into_t0.8_long_fixed12h` | 8,722/108 | 8,748/108 | 1,720/20 | 1,680/20 | B,M |
| 786 | `obv_30m_n20_into_t0.5_long_fixed12h` | 8,690/134 | 9,368/132 | 2,788/27 | 2,447/27 | B,M |
| 787 | `cmf_60m_n10_trend_t0_short_indicator_or12h` | -16,929/789 | -15,365/789 | -3,047/191 | -2,691/191 | P,M,C |
| 788 | `mfi_5m_n7_recovery_t0.9_short_fixed12h` | -16,960/518 | -16,222/516 | -6,014/132 | -5,825/132 | P,M,C |
| 789 | `mfi_30m_n7_trend_t0.6_short_fixed12h` | -17,011/449 | -15,674/439 | -8,065/107 | -7,264/104 | P,M,C |
| 790 | `obv_5m_n10_recovery_t0.5_short_fixed12h` | -17,027/711 | -18,953/702 | -8,628/179 | -10,407/177 | P,B,M,C |
| 791 | `obv_5m_n40_trend_t0_short_fixed12h` | -17,093/697 | -17,603/696 | -9,182/178 | -7,831/177 | P,M,C |
| 792 | `mfi_15m_n7_recovery_t0.8_short_fixed12h` | -17,121/428 | -18,824/420 | -3,233/113 | -4,261/111 | P,M,C |
| 793 | `obv_30m_n20_trend_t0.25_short_fixed12h` | -17,130/375 | -18,088/368 | -10,712/90 | -10,870/89 | P,B,M,C |
| 794 | `obv_15m_n40_trend_t0.25_short_indicator_or12h` | -17,138/310 | -15,839/308 | -6,421/76 | -6,065/76 | P,M,C |
| 795 | `obv_15m_n10_trend_t0_short_fixed12h` | -17,201/706 | -13,027/696 | -8,714/180 | -7,582/177 | P,M,C |
| 796 | `cmf_30m_n10_into_t0.05_short_indicator_or12h` | -17,359/1244 | -19,120/1242 | -3,566/328 | -4,470/327 | P,M,C |
| 797 | `cmf_15m_n10_recovery_t0.2_short_fixed12h` | -17,385/615 | -18,112/608 | -7,621/149 | -6,430/149 | P,M,C |
| 798 | `obv_30m_n10_trend_t0.75_long_indicator_or12h` | 8,139/87 | 8,241/87 | 2,339/24 | 2,366/24 | B,M |
| 799 | `mfi_5m_n28_recovery_t0.6_long_fixed12h` | 8,062/278 | 7,688/277 | 600/64 | 380/63 | B,M,C |
| 800 | `obv_15m_n40_into_t0.25_long_fixed12h` | 8,040/296 | 7,029/292 | 5,102/73 | 4,925/73 | B,M |
| 801 | `cmf_5m_n20_trend_t0_long_fixed12h` | 7,975/761 | 10,807/754 | 6,785/196 | 6,222/194 | M |
| 802 | `cmf_60m_n10_into_t0.05_long_fixed12h` | 7,954/441 | 9,261/418 | 4,986/109 | 6,136/103 | B,M |
| 803 | `obv_15m_n10_into_t0.75_long_fixed12h` | 7,948/200 | 7,419/200 | -1,593/44 | -1,866/44 | P,B,M,C |
| 804 | `cmf_60m_n10_trend_t0.05_short_indicator_or12h` | -17,648/611 | -15,620/607 | -4,691/147 | -4,639/147 | P,M,C |
| 805 | `cmf_60m_n10_trend_t0.05_short_fixed12h` | -17,692/441 | -18,473/418 | -7,412/109 | -8,410/103 | P,M,C |
| 806 | `mfi_5m_n7_into_t0.9_long_fixed12h` | 7,870/551 | 7,521/549 | 4,102/138 | 3,898/138 | B,M |
| 807 | `mfi_15m_n14_recovery_t0.6_long_fixed12h` | 7,805/349 | 7,614/346 | 2,631/82 | 2,622/81 | B,M |
| 808 | `mfi_15m_n7_recovery_t0.8_long_fixed12h` | 7,798/443 | 7,405/437 | 2,322/106 | 2,353/103 | B,M |
| 809 | `mfi_15m_n28_trend_t0.2_short_fixed12h` | -17,868/479 | -17,710/475 | -10,971/125 | -10,903/124 | P,B,M,C |
| 810 | `mfi_5m_n7_recovery_t0.6_short_fixed12h` | -18,009/761 | -17,807/756 | -11,477/194 | -9,969/192 | P,B,M,C |
| 811 | `obv_5m_n20_recovery_t0.25_short_indicator_or12h` | -18,012/2178 | -18,169/2154 | -3,932/558 | -4,226/549 | P,M,C |
| 812 | `mfi_5m_n28_into_t0.6_long_indicator_or12h` | 7,565/343 | 10,272/343 | 882/82 | 846/82 | B,M |
| 813 | `cmf_5m_n10_recovery_t0.2_long_fixed12h` | 7,427/763 | 6,447/759 | 5,288/196 | 4,676/195 | B,M,C |
| 814 | `cmf_5m_n10_recovery_t0.05_short_fixed12h` | -18,177/800 | -13,971/793 | -8,524/205 | -9,616/204 | P,M,C |
| 815 | `mfi_15m_n7_recovery_t0.9_long_fixed12h` | 7,374/279 | 6,677/278 | 176/66 | 83/66 | B,M,C |
| 816 | `cmf_5m_n10_trend_t0_short_fixed12h` | -18,219/800 | -19,883/797 | -6,291/204 | -9,139/204 | P,M,C |
| 817 | `mfi_15m_n14_trend_t0.2_short_fixed12h` | -18,221/615 | -17,758/607 | -5,624/159 | -4,966/157 | P,M,C |
| 818 | `obv_60m_n10_recovery_t0.5_long_fixed12h` | 7,286/208 | 7,092/208 | -230/48 | -230/48 | P,B,M,C |
| 819 | `cmf_30m_n10_recovery_t0.05_long_fixed12h` | 7,266/591 | 7,069/573 | 3,100/152 | 4,040/146 | B,M |
| 820 | `obv_60m_n10_recovery_t0.5_long_indicator_or12h` | 7,198/209 | 7,259/209 | -64/48 | -22/48 | P,B,M,C |
| 821 | `cmf_15m_n20_into_t0.05_short_fixed12h` | -18,444/624 | -17,735/614 | -9,778/159 | -9,840/154 | P,M,C |
| 822 | `mfi_60m_n7_trend_t0.8_long_fixed12h` | 7,138/154 | 6,575/153 | 2,850/46 | 2,948/46 | B,M |
| 823 | `mfi_30m_n7_into_t0.6_long_fixed12h` | 7,119/449 | 6,004/439 | 5,704/107 | 4,969/104 | B,M |
| 824 | `obv_30m_n10_recovery_t0.25_short_indicator_or12h` | -18,519/801 | -16,580/757 | -3,270/211 | -2,368/197 | P,M,C |
| 825 | `cmf_15m_n10_trend_t0.05_short_fixed12h` | -18,528/690 | -18,004/679 | -10,056/174 | -7,848/171 | P,B,M,C |
| 826 | `obv_15m_n20_trend_t0.5_short_fixed12h` | -18,552/220 | -18,307/218 | -2,918/43 | -2,872/43 | P,M,C |
| 827 | `cmf_5m_n40_trend_t0.05_long_fixed12h` | 7,015/691 | 4,387/688 | 3,743/176 | 3,916/176 | B,M,C |
| 828 | `obv_5m_n20_trend_t0.5_short_indicator_or12h` | -18,581/857 | -16,942/857 | -3,458/206 | -3,209/206 | P,M,C |
| 829 | `mfi_5m_n14_trend_t0.8_long_fixed12h` | 6,948/274 | 7,130/274 | 5,673/73 | 5,758/73 | M |
| 830 | `mfi_30m_n28_trend_t0.6_long_fixed12h` | 6,948/29 | 6,788/28 | 2,173/6 | 2,079/6 | N,B,M |
| 831 | `mfi_15m_n14_trend_t0.6_short_fixed12h` | -18,661/349 | -18,544/347 | -4,886/82 | -5,014/82 | P,M,C |
| 832 | `mfi_60m_n7_into_t0.6_long_fixed12h` | 6,893/303 | 4,544/293 | 3,609/76 | 2,884/73 | B,M |
| 833 | `mfi_30m_n28_into_t0.6_long_indicator_or12h` | 6,775/36 | 6,731/36 | -559/3 | -596/3 | N,P,B,M,C |
| 834 | `mfi_60m_n7_trend_t0.8_long_indicator_or12h` | 6,768/156 | 6,801/155 | 2,830/46 | 2,822/46 | B,M |
| 835 | `cmf_60m_n10_trend_t0_short_fixed12h` | -18,834/470 | -19,407/449 | -9,169/119 | -8,617/112 | P,M,C |
| 836 | `mfi_5m_n7_recovery_t0.6_long_fixed12h` | 6,722/758 | 7,542/756 | 4,400/192 | 4,449/192 | B,M,C |
| 837 | `mfi_240m_n7_trend_t0.2_long_fixed12h` | 6,708/164 | 7,275/156 | 3,531/44 | 4,358/42 | B,M |
| 838 | `cmf_5m_n40_trend_t0_short_fixed12h` | -18,927/700 | -17,437/696 | -6,348/178 | -6,110/177 | P,M,C |
| 839 | `mfi_15m_n14_recovery_t0.8_long_fixed12h` | 6,659/108 | 6,679/107 | 1,763/20 | 1,694/19 | B,M |
| 840 | `obv_5m_n10_into_t0.25_short_fixed12h` | -18,984/784 | -15,768/777 | -11,901/195 | -9,254/194 | P,B,M,C |
| 841 | `mfi_5m_n7_recovery_t0.8_short_indicator_or12h` | -19,014/2190 | -19,516/2190 | -5,269/568 | -5,146/568 | P,M,C |
| 842 | `cmf_5m_n10_trend_t0.05_short_fixed12h` | -19,015/796 | -19,242/791 | -8,269/204 | -7,529/202 | P,M,C |
| 843 | `obv_15m_n10_recovery_t0.25_short_indicator_or12h` | -19,040/1558 | -19,600/1491 | -8,491/402 | -9,324/381 | P,M,C |
| 844 | `obv_60m_n40_into_t0.25_long_fixed12h` | 6,466/119 | 5,965/116 | 2,031/25 | 2,008/25 | B,M |
| 845 | `obv_5m_n20_into_t0.75_long_fixed12h` | 6,449/95 | 9,654/95 | 175/22 | 55/22 | B,M,C |
| 846 | `obv_30m_n20_recovery_t0.5_long_fixed12h` | 6,389/134 | 6,532/133 | 1,682/27 | 1,721/27 | B,M |
| 847 | `mfi_60m_n7_trend_t0_short_indicator_or12h` | -19,201/766 | -18,183/766 | -6,014/181 | -5,899/181 | P,M,C |
| 848 | `obv_60m_n10_trend_t0.25_short_indicator_or12h` | -19,211/424 | -18,374/419 | -5,479/96 | -5,019/95 | P,M,C |
| 849 | `mfi_30m_n28_into_t0.6_long_fixed12h` | 6,358/36 | 6,112/36 | -559/3 | -596/3 | N,P,B,M,C |
| 850 | `obv_5m_n40_trend_t0.25_short_indicator_or12h` | -19,239/882 | -18,175/882 | -7,175/226 | -6,635/226 | P,M,C |
| 851 | `obv_15m_n10_recovery_t0.75_long_fixed12h` | 6,255/200 | 6,258/198 | -2,361/44 | -2,410/44 | P,B,M,C |
| 852 | `obv_30m_n20_into_t0.5_long_indicator_or12h` | 6,254/134 | 6,307/132 | 3,192/27 | 2,953/27 | B,M |
| 853 | `obv_30m_n10_into_t0.75_long_fixed12h` | 6,227/108 | 6,108/108 | 2,221/23 | 1,945/23 | B,M |
| 854 | `mfi_240m_n14_trend_t0.2_long_fixed12h` | 6,210/101 | 5,440/98 | 4,463/23 | 4,246/23 | B,M |
| 855 | `mfi_30m_n14_trend_t0_short_fixed12h` | -19,400/531 | -18,618/522 | -9,373/136 | -8,751/133 | P,M,C |
| 856 | `mfi_15m_n7_trend_t0.8_short_indicator_or12h` | -19,453/679 | -17,750/679 | -4,551/161 | -4,277/161 | P,M,C |
| 857 | `mfi_30m_n28_trend_t0.6_long_indicator_or12h` | 6,099/29 | 6,109/28 | 2,090/6 | 1,972/6 | N,B,M |
| 858 | `obv_5m_n10_recovery_t0.25_long_fixed12h` | 6,045/785 | 3,952/779 | 6,669/202 | 5,275/201 | M,C |
| 859 | `mfi_240m_n7_trend_t0.2_long_indicator_or12h` | 6,030/165 | 5,824/159 | 2,968/44 | 3,703/42 | B,M |
| 860 | `obv_5m_n10_trend_t0.5_short_fixed12h` | -19,563/714 | -16,248/709 | -9,476/182 | -8,355/179 | P,M,C |
| 861 | `mfi_15m_n7_into_t0.9_long_fixed12h` | 6,010/277 | 6,689/277 | 1,881/66 | 1,858/66 | B,M |
| 862 | `obv_5m_n20_trend_t0.25_short_fixed12h` | -19,588/710 | -16,330/705 | -9,223/182 | -8,418/180 | P,M,C |
| 863 | `cmf_30m_n10_trend_t0.05_short_indicator_or12h` | -19,622/1194 | -18,731/1193 | -7,566/305 | -7,193/305 | P,M,C |
| 864 | `cmf_60m_n10_trend_t0.2_short_fixed12h` | -19,644/292 | -17,538/286 | -4,931/73 | -4,227/72 | P,M,C |
| 865 | `mfi_5m_n7_into_t0.8_short_fixed12h` | -19,645/662 | -20,348/657 | -11,384/168 | -11,351/166 | P,B,M,C |
| 866 | `obv_60m_n20_recovery_t0.25_long_fixed12h` | 5,929/224 | 6,396/218 | 3,179/51 | 2,594/49 | B,M |
| 867 | `cmf_30m_n40_recovery_t0.05_long_fixed12h` | 5,868/297 | 4,679/290 | 350/73 | 56/72 | B,M,C |
| 868 | `cmf_30m_n10_trend_t0_short_fixed12h` | -19,726/617 | -17,619/598 | -5,896/156 | -4,630/151 | P,M,C |
| 869 | `cmf_5m_n20_into_t0.05_long_fixed12h` | 5,838/753 | 8,864/753 | 6,581/194 | 6,981/193 | M,C |
| 870 | `obv_30m_n10_into_t0.5_long_fixed12h` | 5,731/350 | 5,936/348 | 5,223/83 | 5,251/83 | M |
| 871 | `obv_60m_n40_into_t0.25_long_indicator_or12h` | 5,671/119 | 5,259/116 | 1,764/25 | 1,708/25 | B,M |
| 872 | `mfi_15m_n28_trend_t0.6_long_indicator_or12h` | 5,670/69 | 5,969/69 | 2,159/19 | 2,277/19 | B,M |
| 873 | `cmf_30m_n10_into_t0.2_long_fixed12h` | 5,626/424 | 5,968/420 | 1,886/102 | 2,230/101 | B,M |
| 874 | `obv_30m_n20_recovery_t0.5_long_indicator_or12h` | 5,587/134 | 5,535/133 | 2,347/27 | 2,299/27 | B,M |
| 875 | `obv_15m_n10_trend_t0.5_short_indicator_or12h` | -20,037/807 | -18,105/807 | -5,406/192 | -4,805/192 | P,M,C |
| 876 | `cmf_30m_n20_recovery_t0.05_long_fixed12h` | 5,516/458 | 6,258/448 | 1,845/117 | 1,617/112 | B,M |
| 877 | `obv_240m_n40_trend_t0_long_fixed12h` | 5,501/81 | 4,508/77 | 2,674/23 | 1,693/21 | B,M |
| 878 | `obv_30m_n40_trend_t0.25_long_indicator_or12h` | 5,492/157 | 5,716/154 | 3,432/51 | 3,662/49 | B,M |
| 879 | `cmf_60m_n40_into_t0.05_long_indicator_or12h` | 5,471/206 | 4,132/202 | -347/46 | -151/46 | P,B,M,C |
| 880 | `mfi_15m_n7_trend_t0.2_short_fixed12h` | -20,116/715 | -22,110/700 | -8,436/180 | -8,116/178 | P,M,C |
| 881 | `obv_30m_n40_into_t0.25_long_fixed12h` | 5,435/191 | 6,023/189 | 1,368/41 | 1,517/40 | B,M |
| 882 | `obv_5m_n10_trend_t0.25_short_fixed12h` | -20,303/783 | -17,942/780 | -9,190/199 | -8,735/198 | P,M,C |
| 883 | `mfi_240m_n14_trend_t0.2_long_indicator_or12h` | 5,243/101 | 4,500/98 | 4,463/23 | 4,246/23 | B,M |
| 884 | `mfi_5m_n7_trend_t0_long_fixed12h` | 5,225/808 | 4,358/804 | 4,402/207 | 4,794/205 | B,M,C |
| 885 | `cmf_60m_n10_recovery_t0.2_long_fixed12h` | 5,215/294 | 5,207/287 | 1,028/73 | 1,125/72 | B,M |
| 886 | `obv_15m_n20_trend_t0.5_long_fixed12h` | 5,190/196 | 6,983/194 | 565/50 | 932/50 | B,M |
| 887 | `mfi_240m_n7_trend_t0.6_long_fixed12h` | 5,189/96 | 5,538/93 | 1,491/30 | 1,203/30 | B,M |
| 888 | `obv_5m_n20_trend_t0_long_fixed12h` | 5,174/760 | 5,207/752 | 5,610/192 | 7,121/190 | M,C |
| 889 | `cmf_15m_n20_recovery_t0.05_short_fixed12h` | -20,466/625 | -19,953/614 | -7,847/157 | -7,820/152 | P,M,C |
| 890 | `mfi_240m_n7_trend_t0.8_long_fixed12h` | 5,103/51 | 4,730/50 | 3,181/15 | 2,881/14 | B,M |
| 891 | `mfi_240m_n7_trend_t0.8_long_indicator_or12h` | 5,103/51 | 4,721/50 | 3,181/15 | 2,881/14 | B,M |
| 892 | `obv_5m_n10_recovery_t0.25_short_fixed12h` | -20,497/780 | -19,168/776 | -9,123/197 | -8,841/196 | P,M,C |
| 893 | `mfi_240m_n7_trend_t0.6_long_indicator_or12h` | 5,074/96 | 5,427/93 | 1,491/30 | 1,243/30 | B,M |
| 894 | `mfi_5m_n7_trend_t0.8_long_fixed12h` | 5,046/662 | 5,857/657 | 7,656/168 | 7,667/166 | M,C |
| 895 | `cmf_5m_n20_into_t0.05_short_fixed12h` | -20,544/757 | -16,744/753 | -10,837/195 | -6,280/193 | P,B,M,C |
| 896 | `obv_5m_n40_recovery_t0.25_long_fixed12h` | 5,007/551 | 5,105/550 | 6,679/141 | 6,790/141 | M,C |
| 897 | `cmf_15m_n10_into_t0.05_short_indicator_or12h` | -20,594/2485 | -26,323/2485 | -10,085/634 | -12,135/634 | P,B,M,C |
| 898 | `cmf_30m_n20_into_t0.05_long_fixed12h` | 4,950/460 | 7,913/448 | 4,192/118 | 3,946/113 | B,M |
| 899 | `mfi_5m_n14_trend_t0_short_fixed12h` | -20,644/771 | -20,865/767 | -7,965/197 | -7,269/197 | P,M,C |
| 900 | `cmf_5m_n10_into_t0.05_short_fixed12h` | -20,660/797 | -23,677/791 | -8,058/203 | -9,339/201 | P,B,M,C |
| 901 | `mfi_5m_n7_into_t0.6_long_fixed12h` | 4,913/752 | 7,175/749 | 5,265/190 | 6,492/189 | M,C |
| 902 | `mfi_60m_n14_trend_t0_long_fixed12h` | 4,906/354 | 3,664/346 | 4,097/91 | 2,887/87 | B,M |
| 903 | `cmf_15m_n20_into_t0.2_long_fixed12h` | 4,863/352 | 3,223/350 | 2,389/88 | 2,174/87 | B,M,C |
| 904 | `cmf_30m_n40_trend_t0.2_long_fixed12h` | 4,860/100 | 4,408/99 | 1,844/27 | 1,098/27 | B,M |
| 905 | `cmf_15m_n40_trend_t0_short_indicator_or12h` | -20,745/1506 | -19,376/1506 | -6,365/407 | -5,605/407 | P,M,C |
| 906 | `obv_30m_n20_trend_t0_short_indicator_or12h` | -20,756/1088 | -19,462/1088 | -8,192/270 | -8,032/270 | P,M,C |
| 907 | `mfi_15m_n28_trend_t0.6_long_fixed12h` | 4,786/68 | 5,038/68 | 1,925/19 | 2,161/19 | B,M |
| 908 | `obv_60m_n10_recovery_t0.25_long_indicator_or12h` | 4,780/438 | 4,385/415 | 2,953/98 | 2,521/92 | B,M |
| 909 | `cmf_15m_n20_trend_t0.05_long_fixed12h` | 4,681/624 | 4,193/614 | 6,249/159 | 6,421/154 | M,C |
| 910 | `mfi_5m_n28_trend_t0.6_short_fixed12h` | -20,954/278 | -24,134/277 | -1,681/64 | -1,792/63 | P,B,M,C |
| 911 | `cmf_5m_n20_recovery_t0.05_short_fixed12h` | -20,986/760 | -20,754/757 | -7,218/195 | -6,757/195 | P,M,C |
| 912 | `cmf_30m_n40_into_t0.05_long_fixed12h` | 4,570/304 | 3,053/297 | -1,010/72 | -1,903/71 | P,B,M,C |
| 913 | `obv_15m_n40_into_t0.5_long_fixed12h` | 4,533/46 | 4,328/46 | -294/5 | -307/5 | N,P,B,M,C |
| 914 | `mfi_15m_n7_into_t0.8_long_indicator_or12h` | 4,502/679 | 2,801/679 | 1,006/161 | 732/161 | B,M,C |
| 915 | `mfi_30m_n14_into_t0.8_long_fixed12h` | 4,476/50 | 4,401/50 | -528/10 | -404/10 | P,B,M,C |
| 916 | `obv_240m_n20_trend_t0_long_fixed12h` | 4,435/112 | 5,279/106 | 237/24 | 485/23 | B,M,C |
| 917 | `mfi_30m_n7_into_t0.9_long_fixed12h` | 4,429/154 | 4,431/152 | 972/36 | 1,061/34 | B,M |
| 918 | `cmf_240m_n10_trend_t0.05_long_fixed12h` | 4,403/178 | 4,614/163 | 2,427/41 | 2,647/37 | B,M |
| 919 | `cmf_240m_n20_trend_t0.2_long_fixed12h` | 4,309/57 | 4,343/51 | 3,611/16 | 2,962/14 | B,M |
| 920 | `cmf_240m_n20_trend_t0.2_long_indicator_or12h` | 4,309/57 | 4,328/51 | 3,611/16 | 2,962/14 | B,M |
| 921 | `mfi_5m_n14_into_t0.8_long_fixed12h` | 4,308/310 | 3,036/308 | 4,011/70 | 3,783/69 | B,M,C |
| 922 | `obv_5m_n40_trend_t0.5_long_fixed12h` | 4,213/103 | 4,261/103 | 2,741/23 | 2,652/23 | B,M |
| 923 | `cmf_60m_n10_into_t0.05_long_indicator_or12h` | 4,172/611 | 2,234/607 | 1,432/147 | 1,380/147 | B,M,C |
| 924 | `cmf_240m_n20_trend_t0.05_long_fixed12h` | 4,170/124 | 4,609/111 | -628/31 | 12/27 | P,B,M,C |
| 925 | `mfi_15m_n7_into_t0.6_long_indicator_or12h` | 4,166/1215 | 2,456/1215 | 1,444/305 | 934/305 | B,M,C |
| 926 | `cmf_5m_n40_into_t0.5_long_fixed12h` | 4,165/1 | 7,905/1 | 0/0 | 0/0 | N,P,B,M,C |
| 927 | `cmf_30m_n10_trend_t0.5_long_indicator_or12h` | 4,153/69 | 4,409/68 | 1,024/15 | 1,119/15 | B,M |
| 928 | `mfi_5m_n14_trend_t0.6_short_indicator_or12h` | -21,440/1399 | -18,693/1399 | -6,900/343 | -6,327/343 | P,M,C |
| 929 | `mfi_5m_n14_trend_t0_long_fixed12h` | 4,137/775 | 6,666/770 | 5,311/196 | 6,168/195 | M,C |
| 930 | `cmf_240m_n20_trend_t0.05_long_indicator_or12h` | 4,122/124 | 4,921/111 | -966/31 | -60/27 | P,B,M,C |
| 931 | `mfi_5m_n7_trend_t0.6_short_fixed12h` | -21,493/752 | -23,692/749 | -9,475/190 | -10,681/189 | P,B,M,C |
| 932 | `mfi_15m_n14_into_t0.8_long_indicator_or12h` | 4,091/113 | 4,058/113 | 1,917/22 | 1,943/22 | B,M |
| 933 | `cmf_30m_n10_recovery_t0.2_long_fixed12h` | 4,079/421 | 3,740/416 | 4,629/103 | 4,236/101 | B,M,C |
| 934 | `obv_60m_n20_trend_t0_long_fixed12h` | 4,070/335 | 3,683/329 | 1,674/75 | 2,089/74 | B,M |
| 935 | `obv_60m_n20_recovery_t0.25_long_indicator_or12h` | 4,053/230 | 4,558/224 | 1,013/52 | 913/50 | B,M |
| 936 | `obv_60m_n10_trend_t0.75_long_fixed12h` | 4,051/41 | 3,314/40 | 3,240/12 | 2,860/11 | B,M |
| 937 | `cmf_30m_n40_trend_t0.2_long_indicator_or12h` | 4,048/101 | 3,524/100 | 1,858/27 | 1,140/27 | B,M |
| 938 | `obv_240m_n10_into_t0.25_long_fixed12h` | 4,041/152 | 4,801/141 | 687/36 | 206/33 | B,M,C |
| 939 | `cmf_60m_n10_trend_t0.5_long_indicator_or12h` | 3,972/30 | 4,115/30 | 1,263/4 | 1,281/4 | N,B,M |
| 940 | `cmf_60m_n10_trend_t0.5_long_fixed12h` | 3,964/30 | 3,964/30 | 1,198/4 | 1,179/4 | N,B,M |
| 941 | `obv_5m_n20_into_t0.25_long_fixed12h` | 3,955/710 | 810/705 | 5,212/182 | 4,451/180 | B,M,C |
| 942 | `mfi_240m_n7_trend_t0_long_indicator_or12h` | 3,919/181 | 3,754/181 | 358/46 | 392/46 | B,M,C |
| 943 | `mfi_5m_n7_recovery_t0.8_short_fixed12h` | -21,674/666 | -24,233/658 | -12,328/167 | -12,330/166 | P,B,M,C |
| 944 | `mfi_60m_n7_into_t0.6_long_indicator_or12h` | 3,905/311 | 2,563/308 | 622/77 | 400/76 | B,M,C |
| 945 | `cmf_5m_n20_trend_t0.05_long_fixed12h` | 3,855/757 | 168/753 | 6,515/195 | 2,029/193 | B,M,C |
| 946 | `mfi_30m_n7_into_t0.8_long_indicator_or12h` | 3,846/324 | 2,947/324 | 2,535/68 | 2,406/68 | B,M,C |
| 947 | `obv_5m_n10_into_t0.5_long_fixed12h` | 3,842/714 | 641/709 | 5,463/182 | 4,410/179 | B,M,C |
| 948 | `cmf_15m_n10_trend_t0_long_fixed12h` | 3,830/711 | 3,691/698 | 6,854/178 | 6,392/176 | B,M,C |
| 949 | `obv_30m_n20_trend_t0.5_long_indicator_or12h` | 3,806/95 | 3,939/95 | 5/23 | 131/23 | B,M,C |
| 950 | `obv_240m_n10_into_t0.5_long_indicator_or12h` | 3,800/66 | 3,064/62 | -81/13 | -38/13 | P,B,M,C |
| 951 | `cmf_30m_n40_recovery_t0.05_long_indicator_or12h` | 3,799/365 | 3,917/352 | 354/87 | 420/84 | B,M,C |
| 952 | `mfi_60m_n28_trend_t0_long_indicator_or12h` | 3,797/340 | 4,238/340 | 2,313/78 | 2,381/78 | B,M |
| 953 | `mfi_5m_n28_trend_t0_short_fixed12h` | -21,828/720 | -23,842/715 | -8,198/185 | -7,807/183 | P,B,M,C |
| 954 | `cmf_60m_n40_into_t0.05_long_fixed12h` | 3,746/198 | 2,789/194 | -1,232/46 | -1,057/46 | P,B,M,C |
| 955 | `cmf_5m_n20_recovery_t0.2_short_fixed12h` | -21,841/658 | -21,192/656 | -8,557/168 | -8,519/167 | P,M,C |
| 956 | `mfi_5m_n14_trend_t0.2_long_fixed12h` | 3,736/761 | 2,921/757 | 1,930/195 | 1,725/194 | B,M,C |
| 957 | `obv_240m_n10_into_t0.5_long_fixed12h` | 3,653/66 | 2,889/62 | -369/13 | -324/13 | P,B,M,C |
| 958 | `mfi_60m_n7_trend_t0.6_long_fixed12h` | 3,648/293 | 3,328/287 | 2,998/79 | 3,229/78 | B,M |
| 959 | `obv_30m_n10_trend_t0_short_indicator_or12h` | -21,962/1515 | -20,427/1514 | -11,244/398 | -10,710/397 | P,B,M,C |
| 960 | `obv_60m_n10_trend_t0.75_long_indicator_or12h` | 3,600/41 | 3,054/40 | 3,138/12 | 2,735/11 | B,M |
| 961 | `obv_30m_n40_recovery_t0.25_long_fixed12h` | 3,565/192 | 1,553/187 | 637/41 | 708/41 | B,M,C |
| 962 | `mfi_30m_n14_trend_t0.8_long_indicator_or12h` | 3,556/48 | 3,721/48 | 342/8 | 355/8 | N,B,M |
| 963 | `cmf_240m_n10_trend_t0.05_long_indicator_or12h` | 3,551/182 | 3,466/177 | 2,072/41 | 2,100/40 | B,M |
| 964 | `obv_5m_n20_into_t0.75_long_indicator_or12h` | 3,537/106 | 6,129/106 | 566/25 | 378/25 | B,M |
| 965 | `cmf_60m_n10_recovery_t0.2_long_indicator_or12h` | 3,495/307 | 3,918/299 | 1,490/76 | 1,964/72 | B,M |
| 966 | `mfi_5m_n28_trend_t0.8_long_fixed12h` | 3,466/20 | 3,474/20 | 1,870/10 | 1,721/10 | N,B,M |
| 967 | `obv_240m_n20_trend_t0_long_indicator_or12h` | 3,459/127 | 3,776/127 | -106/27 | -130/27 | P,B,M,C |
| 968 | `obv_30m_n20_trend_t0_short_fixed12h` | -22,137/495 | -17,064/483 | -8,098/124 | -5,800/119 | P,M,C |
| 969 | `mfi_60m_n14_trend_t0.6_long_fixed12h` | 3,448/103 | 3,374/103 | 1,785/32 | 1,797/32 | B,M |
| 970 | `cmf_15m_n20_recovery_t0.05_short_indicator_or12h` | -22,150/1476 | -21,208/1268 | -7,291/400 | -8,275/341 | P,M,C |
| 971 | `obv_30m_n10_trend_t0.5_long_indicator_or12h` | 3,432/381 | 3,909/381 | -234/103 | -360/103 | P,B,M,C |
| 972 | `cmf_15m_n20_trend_t0_short_fixed12h` | -22,171/633 | -21,101/625 | -8,442/157 | -7,735/156 | P,M,C |
| 973 | `obv_30m_n40_into_t0.25_long_indicator_or12h` | 3,395/195 | 4,010/193 | 623/41 | 755/40 | B,M |
| 974 | `cmf_5m_n40_into_t0.5_long_indicator_or12h` | 3,385/1 | 6,926/1 | 0/0 | 0/0 | N,P,B,M,C |
| 975 | `cmf_5m_n40_into_t0.05_short_fixed12h` | -22,255/691 | -19,558/688 | -7,643/176 | -7,817/176 | P,M,C |
| 976 | `mfi_240m_n7_trend_t0_long_fixed12h` | 3,329/174 | 1,270/166 | 1,625/44 | 555/39 | B,M,C |
| 977 | `cmf_15m_n10_into_t0.05_long_fixed12h` | 3,314/690 | 3,033/679 | 6,197/174 | 4,057/171 | B,M,C |
| 978 | `obv_5m_n10_recovery_t0.5_short_indicator_or12h` | -22,287/2659 | -24,028/2642 | -6,710/653 | -7,338/652 | P,B,M,C |
| 979 | `cmf_15m_n40_into_t0.05_long_fixed12h` | 3,271/452 | 800/447 | 5,000/112 | 4,891/111 | B,M,C |
| 980 | `obv_60m_n10_trend_t0.25_short_fixed12h` | -22,320/393 | -19,062/381 | -6,044/93 | -5,082/91 | P,B,M,C |
| 981 | `mfi_60m_n14_trend_t0.6_long_indicator_or12h` | 3,258/103 | 2,808/103 | 1,923/32 | 1,678/32 | B,M |
| 982 | `obv_30m_n40_trend_t0.25_long_fixed12h` | 3,232/157 | 2,828/154 | 1,173/51 | 1,630/49 | B,M |
| 983 | `mfi_30m_n28_recovery_t0.6_long_indicator_or12h` | 3,217/36 | 3,328/36 | -530/3 | -494/3 | N,P,B,M,C |
| 984 | `mfi_30m_n14_into_t0.8_long_indicator_or12h` | 3,179/50 | 2,846/50 | -102/10 | -88/10 | P,B,M,C |
| 985 | `cmf_5m_n20_into_t0.5_long_fixed12h` | 3,168/48 | 2,656/48 | -309/6 | -378/6 | N,P,B,M,C |
| 986 | `mfi_15m_n7_trend_t0_short_fixed12h` | -22,421/721 | -22,824/708 | -7,244/185 | -7,840/181 | P,B,M,C |
| 987 | `obv_15m_n10_into_t0.25_long_indicator_or12h` | 3,163/1525 | 483/1525 | 1,985/373 | 1,672/373 | B,M,C |
| 988 | `cmf_15m_n10_into_t0.2_long_indicator_or12h` | 3,157/1175 | 274/1175 | -1,386/295 | -1,902/295 | P,B,M,C |
| 989 | `cmf_5m_n40_recovery_t0.05_long_fixed12h` | 3,151/672 | 2,609/670 | 6,740/168 | 5,043/166 | B,M,C |
| 990 | `cmf_5m_n20_trend_t0.05_short_fixed12h` | -22,441/753 | -25,470/753 | -10,880/194 | -11,259/193 | P,B,M,C |
| 991 | `mfi_5m_n28_recovery_t0.6_long_indicator_or12h` | 3,144/344 | 2,957/344 | 781/82 | 736/82 | B,M,C |
| 992 | `cmf_60m_n20_recovery_t0.05_long_fixed12h` | 3,128/308 | 3,704/296 | 1,813/76 | 1,509/75 | B,M |
| 993 | `cmf_15m_n20_recovery_t0.2_long_fixed12h` | 3,094/353 | 3,146/351 | 2,157/88 | 2,079/88 | B,M,C |
| 994 | `cmf_5m_n20_trend_t0_short_fixed12h` | -22,495/768 | -22,339/758 | -10,688/198 | -11,158/194 | P,B,M,C |
| 995 | `cmf_5m_n10_trend_t0.05_long_fixed12h` | 3,091/797 | 6,236/791 | 3,564/203 | 4,887/201 | B,M,C |
| 996 | `cmf_5m_n40_trend_t0_long_fixed12h` | 3,058/701 | 1,011/697 | 5,263/181 | 3,993/179 | B,M,C |
| 997 | `cmf_30m_n10_into_t0.05_long_fixed12h` | 3,057/604 | 1,841/583 | 2,738/151 | 4,067/146 | B,M,C |
| 998 | `obv_5m_n10_into_t0.25_long_fixed12h` | 3,042/783 | 749/780 | 4,783/199 | 4,350/198 | B,M,C |
| 999 | `obv_30m_n20_trend_t0.5_long_fixed12h` | 3,041/95 | 2,966/95 | -995/23 | -826/23 | P,B,M,C |
| 1000 | `obv_60m_n40_trend_t0_long_fixed12h` | 3,040/235 | 3,231/226 | 1,567/55 | 1,235/52 | B,M |
| 1001 | `cmf_60m_n20_trend_t0.2_long_fixed12h` | 3,031/156 | 4,482/149 | 3,948/50 | 4,549/47 | B,M |
| 1002 | `cmf_60m_n20_into_t0.05_long_fixed12h` | 3,009/308 | 2,104/298 | 3,602/73 | 3,755/72 | B,M,C |
| 1003 | `mfi_240m_n14_trend_t0_long_fixed12h` | 3,009/121 | 3,235/110 | 567/34 | 1,395/28 | B,M |
| 1004 | `obv_60m_n10_into_t0.75_long_fixed12h` | 3,004/53 | 2,972/53 | 260/9 | 245/9 | N,B,M |
| 1005 | `cmf_30m_n20_trend_t0_short_indicator_or12h` | -22,667/1150 | -21,173/1150 | -7,800/299 | -7,577/299 | P,B,M,C |
| 1006 | `obv_60m_n40_recovery_t0.25_long_fixed12h` | 2,875/113 | 2,419/111 | 1,243/24 | 1,315/24 | B,M |
| 1007 | `obv_240m_n10_into_t0.25_long_indicator_or12h` | 2,871/152 | 4,005/141 | 137/36 | 60/33 | B,M,C |
| 1008 | `mfi_15m_n7_into_t0.9_long_indicator_or12h` | 2,866/352 | 2,264/352 | 794/79 | 709/79 | B,M,C |
| 1009 | `mfi_5m_n7_recovery_t0.9_long_fixed12h` | 2,855/552 | 2,653/550 | 2,715/137 | 2,407/137 | B,M,C |
| 1010 | `obv_60m_n20_trend_t0.5_long_fixed12h` | 2,843/48 | 3,012/48 | 1,756/16 | 1,774/16 | B,M |
| 1011 | `cmf_15m_n10_trend_t0.2_short_fixed12h` | -22,763/590 | -18,046/583 | -8,429/149 | -5,580/147 | P,B,M,C |
| 1012 | `obv_60m_n10_into_t0.75_long_indicator_or12h` | 2,805/53 | 2,713/53 | -157/9 | -79/9 | N,P,B,M,C |
| 1013 | `mfi_5m_n14_into_t0.6_long_fixed12h` | 2,804/601 | 942/599 | 1,573/150 | 1,386/150 | B,M,C |
| 1014 | `obv_30m_n10_trend_t0.75_long_fixed12h` | 2,769/86 | 2,981/86 | 1,290/23 | 1,254/23 | B,M |
| 1015 | `obv_15m_n40_into_t0.5_long_indicator_or12h` | 2,761/46 | 2,404/46 | -155/5 | -181/5 | N,P,B,M,C |
| 1016 | `mfi_15m_n7_trend_t0.8_short_fixed12h` | -22,833/441 | -20,414/438 | -6,295/106 | -5,626/105 | P,B,M,C |
| 1017 | `cmf_60m_n20_trend_t0.2_long_indicator_or12h` | 2,741/158 | 3,674/151 | 4,734/50 | 5,408/47 | B,M |
| 1018 | `cmf_60m_n10_recovery_t0.05_short_fixed12h` | -22,850/479 | -21,590/464 | -10,465/124 | -9,211/120 | P,B,M,C |
| 1019 | `cmf_30m_n40_into_t0.05_long_indicator_or12h` | 2,712/370 | 2,859/366 | 1,744/88 | 1,556/88 | B,M,C |
| 1020 | `mfi_5m_n28_trend_t0.2_long_fixed12h` | 2,709/667 | 1,694/664 | 7,968/165 | 8,730/163 | B,M,C |
| 1021 | `mfi_15m_n7_trend_t0.8_long_fixed12h` | 2,702/425 | 4,554/421 | 823/111 | 1,397/110 | B,M,C |
| 1022 | `obv_5m_n10_trend_t0_long_fixed12h` | 2,700/799 | -152/794 | 4,416/203 | 3,786/201 | P,B,M,C |
| 1023 | `cmf_30m_n40_trend_t0_long_fixed12h` | 2,684/362 | 2,184/358 | -2,878/96 | -2,946/96 | P,B,M,C |
| 1024 | `obv_240m_n20_trend_t0.25_long_fixed12h` | 2,649/88 | 2,954/83 | -57/27 | -12/25 | P,B,M,C |
| 1025 | `obv_60m_n20_into_t0.25_long_indicator_or12h` | 2,648/221 | 2,216/212 | -448/51 | -943/47 | P,B,M,C |
| 1026 | `mfi_15m_n28_into_t0.6_long_fixed12h` | 2,623/86 | 2,959/86 | 185/13 | 211/13 | B,M |
| 1027 | `obv_15m_n10_into_t0.5_long_fixed12h` | 2,621/501 | 1,735/497 | 137/119 | -156/119 | P,B,M,C |
| 1028 | `obv_5m_n40_trend_t0.25_short_fixed12h` | -22,967/550 | -22,003/548 | -11,250/142 | -10,877/142 | P,B,M,C |
| 1029 | `obv_60m_n40_recovery_t0.25_long_indicator_or12h` | 2,594/114 | 2,786/111 | 1,118/24 | 1,183/24 | B,M |
| 1030 | `cmf_60m_n40_trend_t0.2_long_fixed12h` | 2,580/70 | 2,890/70 | 1,514/26 | 1,587/26 | B,M |
| 1031 | `obv_30m_n10_recovery_t0.75_long_fixed12h` | 2,574/108 | 2,704/108 | 722/23 | 724/23 | B,M |
| 1032 | `obv_240m_n20_trend_t0.25_long_indicator_or12h` | 2,565/88 | 2,900/83 | -57/27 | -12/25 | P,B,M,C |
| 1033 | `mfi_30m_n7_recovery_t0.8_long_fixed12h` | 2,562/281 | 2,770/275 | 894/61 | 1,062/58 | B,M,C |
| 1034 | `mfi_15m_n14_into_t0.6_long_indicator_or12h` | 2,542/428 | 1,874/428 | 322/101 | 450/101 | B,M,C |
| 1035 | `obv_5m_n40_trend_t0.5_long_indicator_or12h` | 2,530/108 | 2,936/108 | 1,895/24 | 1,906/24 | B,M |
| 1036 | `obv_240m_n40_recovery_t0.25_long_fixed12h` | 2,523/35 | 2,756/33 | 598/4 | 662/4 | N,B,M |
| 1037 | `obv_240m_n40_recovery_t0.25_long_indicator_or12h` | 2,523/35 | 2,762/33 | 598/4 | 662/4 | N,B,M |
| 1038 | `obv_60m_n20_trend_t0.5_long_indicator_or12h` | 2,510/48 | 2,595/48 | 1,783/16 | 1,789/16 | B,M |
| 1039 | `obv_5m_n20_recovery_t0.75_long_fixed12h` | 2,504/95 | 2,852/95 | -397/22 | -235/22 | P,B,M,C |
| 1040 | `cmf_5m_n20_into_t0.5_long_indicator_or12h` | 2,468/50 | 2,075/50 | 766/6 | 602/6 | N,B,M |
| 1041 | `mfi_30m_n28_recovery_t0.6_long_fixed12h` | 2,432/36 | 2,362/36 | -599/3 | -582/3 | N,P,B,M,C |
| 1042 | `mfi_60m_n7_trend_t0.6_long_indicator_or12h` | 2,360/304 | 2,838/302 | 3,247/82 | 3,461/81 | B,M,C |
| 1043 | `mfi_5m_n28_trend_t0.6_long_fixed12h` | 2,358/238 | 2,747/238 | 2,297/62 | 2,241/62 | B,M,C |
| 1044 | `obv_5m_n20_recovery_t0.25_long_fixed12h` | 2,352/709 | 3,121/707 | 3,927/181 | 4,203/180 | B,M,C |
| 1045 | `mfi_5m_n14_into_t0.9_long_fixed12h` | 2,329/112 | 1,630/112 | 648/25 | 524/25 | B,M |
| 1046 | `cmf_5m_n40_trend_t0.5_long_fixed12h` | 2,311/6 | 2,135/6 | 1,055/2 | 878/2 | N,B,M |
| 1047 | `cmf_240m_n40_recovery_t0.05_long_fixed12h` | 2,271/79 | 1,860/71 | 269/20 | 5/18 | B,M,C |
| 1048 | `obv_15m_n10_into_t0.5_long_indicator_or12h` | 2,271/807 | 341/807 | 1,178/192 | 578/192 | B,M,C |
| 1049 | `cmf_30m_n10_recovery_t0.05_short_indicator_or12h` | -23,388/1358 | -16,346/1112 | -9,027/357 | -6,869/291 | P,B,M,C |
| 1050 | `obv_240m_n40_trend_t0_long_indicator_or12h` | 2,187/92 | 2,162/92 | 2,261/24 | 2,316/24 | B,M |
| 1051 | `obv_15m_n40_recovery_t0.25_long_fixed12h` | 2,148/295 | 3,140/294 | 1,640/69 | 2,457/69 | B,M,C |
| 1052 | `obv_240m_n10_trend_t0.75_long_fixed12h` | 2,129/11 | 2,132/11 | 536/4 | 547/4 | N,B,M |
| 1053 | `obv_240m_n10_trend_t0.75_long_indicator_or12h` | 2,129/11 | 2,132/11 | 536/4 | 547/4 | N,B,M |
| 1054 | `cmf_240m_n40_trend_t0_long_fixed12h` | 2,114/87 | 2,325/79 | -741/13 | -923/12 | P,B,M,C |
| 1055 | `mfi_240m_n14_trend_t0_long_indicator_or12h` | 2,102/124 | 2,443/124 | 595/34 | 794/34 | B,M |
| 1056 | `cmf_5m_n20_recovery_t0.5_long_fixed12h` | 2,072/48 | 2,157/48 | -500/6 | -553/6 | N,P,B,M,C |
| 1057 | `cmf_240m_n40_recovery_t0.05_long_indicator_or12h` | 2,061/80 | 1,214/71 | 222/20 | 14/18 | B,M,C |
| 1058 | `mfi_30m_n28_trend_t0_long_fixed12h` | 2,054/386 | 1,148/382 | 1,737/98 | 1,516/97 | B,M,C |
| 1059 | `cmf_15m_n10_recovery_t0.05_long_fixed12h` | 1,993/699 | 3,480/689 | 4,985/177 | 5,780/174 | B,M,C |
| 1060 | `mfi_30m_n7_recovery_t0.9_long_fixed12h` | 1,977/155 | 2,929/154 | 770/35 | 821/35 | B,M |
| 1061 | `cmf_15m_n10_into_t0.5_long_indicator_or12h` | 1,963/100 | 1,575/100 | 1,951/20 | 1,676/20 | B,M |
| 1062 | `obv_240m_n40_into_t0.25_long_indicator_or12h` | 1,944/36 | 117/31 | -943/5 | -1,018/4 | N,P,B,M,C |
| 1063 | `cmf_60m_n40_trend_t0.2_long_indicator_or12h` | 1,899/70 | 2,309/70 | 1,514/26 | 1,587/26 | B,M |
| 1064 | `obv_15m_n40_trend_t0.5_long_indicator_or12h` | 1,876/26 | 1,871/26 | 1,830/3 | 1,836/3 | N,B,M |
| 1065 | `cmf_15m_n10_recovery_t0.5_long_indicator_or12h` | 1,868/100 | 1,304/100 | 1,291/20 | 1,062/20 | B,M |
| 1066 | `cmf_5m_n20_recovery_t0.05_long_fixed12h` | 1,858/747 | 961/744 | 5,818/191 | 4,335/190 | B,M,C |
| 1067 | `cmf_30m_n20_into_t0.2_long_fixed12h` | 1,828/195 | 1,308/195 | 1,641/40 | 868/40 | B,M,C |
| 1068 | `mfi_60m_n28_trend_t0_long_fixed12h` | 1,822/248 | 1,390/243 | 2,467/59 | 2,374/58 | B,M,C |
| 1069 | `obv_240m_n40_into_t0.25_long_fixed12h` | 1,809/36 | 117/31 | -943/5 | -1,018/4 | N,P,B,M,C |
| 1070 | `mfi_5m_n14_recovery_t0.8_long_fixed12h` | 1,804/309 | 2,033/309 | 3,207/70 | 3,473/70 | B,M,C |
| 1071 | `cmf_5m_n40_into_t0.05_long_fixed12h` | 1,774/669 | 1,408/664 | 5,898/170 | 6,463/169 | B,M,C |
| 1072 | `obv_60m_n20_into_t0.5_long_fixed12h` | 1,771/54 | -8/52 | 935/13 | 813/13 | P,B,M,C |
| 1073 | `mfi_60m_n14_into_t0.8_long_indicator_or12h` | 1,759/22 | 1,724/22 | -600/5 | -552/5 | N,P,B,M,C |
| 1074 | `mfi_5m_n14_into_t0.9_long_indicator_or12h` | 1,739/126 | 1,247/126 | 1,115/27 | 1,027/27 | B,M,C |
| 1075 | `mfi_5m_n14_trend_t0.2_short_fixed12h` | -23,854/762 | -21,881/756 | -9,166/194 | -8,746/193 | P,B,M,C |
| 1076 | `cmf_5m_n20_recovery_t0.5_long_indicator_or12h` | 1,705/50 | 1,756/50 | 520/6 | 453/6 | N,B,M |
| 1077 | `obv_5m_n10_trend_t0.25_long_fixed12h` | 1,703/784 | -1,356/777 | 7,578/195 | 4,956/194 | P,B,M,C |
| 1078 | `cmf_5m_n40_trend_t0.5_long_indicator_or12h` | 1,696/6 | 1,533/6 | 506/2 | 337/2 | N,B,M |
| 1079 | `mfi_15m_n14_trend_t0.8_long_indicator_or12h` | 1,693/95 | 2,141/95 | 769/22 | 730/22 | B,M |
| 1080 | `obv_60m_n10_recovery_t0.75_long_indicator_or12h` | 1,676/53 | 1,714/53 | -7/9 | 17/9 | N,P,B,M,C |
| 1081 | `mfi_60m_n14_into_t0.8_long_fixed12h` | 1,664/22 | 1,649/22 | -651/5 | -594/5 | N,P,B,M,C |
| 1082 | `mfi_30m_n7_into_t0.9_long_indicator_or12h` | 1,647/162 | 1,248/162 | 986/36 | 1,055/36 | B,M,C |
| 1083 | `mfi_15m_n28_recovery_t0.6_long_fixed12h` | 1,638/86 | 1,861/86 | 32/13 | -35/13 | P,B,M,C |
| 1084 | `mfi_240m_n28_trend_t0_long_fixed12h` | 1,638/70 | 906/68 | 554/18 | 361/17 | B,M |
| 1085 | `obv_15m_n40_recovery_t0.5_long_fixed12h` | 1,623/46 | 1,589/46 | -701/5 | -782/5 | N,P,B,M,C |
| 1086 | `mfi_60m_n28_trend_t0.6_long_fixed12h` | 1,620/23 | 1,712/23 | 92/7 | 88/7 | N,B,M |
| 1087 | `mfi_60m_n28_trend_t0.6_long_indicator_or12h` | 1,620/23 | 1,712/23 | 92/7 | 88/7 | N,B,M |
| 1088 | `obv_5m_n40_into_t0.5_long_fixed12h` | 1,617/155 | 1,531/155 | -1,509/37 | -1,274/37 | P,B,M,C |
| 1089 | `mfi_5m_n28_into_t0.8_long_fixed12h` | 1,613/28 | 1,363/28 | 86/6 | 84/6 | N,B,M |
| 1090 | `obv_5m_n10_trend_t0_short_fixed12h` | -24,004/799 | -19,254/793 | -9,491/204 | -9,447/203 | P,B,M,C |
| 1091 | `mfi_15m_n28_trend_t0.8_long_fixed12h` | 1,570/5 | 1,524/5 | 1,263/2 | 1,226/2 | N,B,M |
| 1092 | `mfi_5m_n7_trend_t0.2_short_fixed12h` | -24,024/805 | -22,148/799 | -10,057/205 | -10,052/204 | P,B,M,C |
| 1093 | `obv_15m_n10_into_t0.75_long_indicator_or12h` | 1,540/224 | 931/224 | -994/52 | -1,188/52 | P,B,M,C |
| 1094 | `cmf_240m_n10_trend_t0.2_long_fixed12h` | 1,535/98 | 636/95 | 2,882/31 | 2,580/31 | B,M,C |
| 1095 | `obv_60m_n40_trend_t0.25_long_indicator_or12h` | 1,527/96 | 1,414/93 | -50/31 | -293/30 | P,B,M,C |
| 1096 | `mfi_15m_n28_into_t0.8_long_fixed12h` | 1,506/6 | 1,150/6 | 299/1 | 278/1 | N,B,M |
| 1097 | `cmf_5m_n10_into_t0.05_long_fixed12h` | 1,470/796 | 1,806/791 | 3,752/204 | 3,058/202 | B,M,C |
| 1098 | `obv_15m_n40_trend_t0.5_long_fixed12h` | 1,453/26 | 1,316/26 | 1,830/3 | 1,829/3 | N,B,M |
| 1099 | `obv_30m_n40_trend_t0.5_long_fixed12h` | 1,450/12 | 1,516/12 | 1,336/4 | 1,420/4 | N,B,M |
| 1100 | `mfi_60m_n28_trend_t0.2_long_indicator_or12h` | 1,429/192 | 3,558/190 | 1,214/59 | 1,238/58 | B,M,C |
| 1101 | `obv_5m_n40_trend_t0.75_long_fixed12h` | 1,401/3 | 1,248/3 | 147/1 | 7/1 | N,B,M,C |
| 1102 | `obv_60m_n20_trend_t0.75_long_fixed12h` | 1,390/3 | 1,412/3 | 1,103/2 | 1,135/2 | N,B,M |
| 1103 | `obv_60m_n20_trend_t0.75_long_indicator_or12h` | 1,390/3 | 1,412/3 | 1,103/2 | 1,135/2 | N,B,M |
| 1104 | `obv_15m_n20_trend_t0.5_long_indicator_or12h` | 1,381/212 | 2,472/212 | 2,452/52 | 2,811/52 | B,M,C |
| 1105 | `mfi_30m_n14_trend_t0.8_long_fixed12h` | 1,380/48 | 1,438/48 | -130/8 | -114/8 | N,P,B,M,C |
| 1106 | `obv_30m_n40_trend_t0.5_long_indicator_or12h` | 1,377/12 | 1,352/12 | 1,336/4 | 1,420/4 | N,B,M |
| 1107 | `cmf_5m_n10_trend_t0_long_fixed12h` | 1,376/801 | -345/797 | 1,667/205 | 1,342/204 | P,B,M,C |
| 1108 | `mfi_30m_n14_into_t0.9_long_fixed12h` | 1,355/7 | 1,464/7 | 736/3 | 773/3 | N,B,M |
| 1109 | `cmf_240m_n20_into_t0.2_long_fixed12h` | 1,352/39 | 1,385/38 | 1,143/7 | 1,092/7 | N,B,M |
| 1110 | `cmf_240m_n20_into_t0.2_long_indicator_or12h` | 1,352/39 | 1,385/38 | 1,143/7 | 1,092/7 | N,B,M |
| 1111 | `cmf_30m_n10_trend_t0.5_long_fixed12h` | 1,344/68 | 1,323/67 | 378/15 | 317/15 | B,M |
| 1112 | `obv_60m_n40_trend_t0.25_long_fixed12h` | 1,341/96 | 1,425/93 | -75/31 | -394/30 | P,B,M,C |
| 1113 | `cmf_240m_n20_trend_t0_long_fixed12h` | 1,338/125 | 1,758/118 | -1,635/25 | -1,228/24 | P,B,M,C |
| 1114 | `mfi_240m_n7_into_t0.8_long_fixed12h` | 1,333/49 | 1,653/46 | -199/12 | -267/12 | P,B,M,C |
| 1115 | `obv_60m_n20_into_t0.5_long_indicator_or12h` | 1,333/54 | 324/52 | 1,130/13 | 1,053/13 | B,M,C |
| 1116 | `cmf_240m_n10_into_t0.2_long_indicator_or12h` | 1,324/107 | 834/96 | 252/29 | -396/24 | P,B,M,C |
| 1117 | `cmf_240m_n10_trend_t0.2_long_indicator_or12h` | 1,304/98 | 613/95 | 2,578/31 | 2,264/31 | B,M,C |
| 1118 | `mfi_30m_n28_trend_t0.8_long_indicator_or12h` | 1,285/6 | 1,358/6 | 413/1 | 434/1 | N,B,M |
| 1119 | `mfi_15m_n14_recovery_t0.8_long_indicator_or12h` | 1,283/113 | 1,227/113 | 1,682/22 | 1,513/22 | B,M |
| 1120 | `cmf_240m_n20_recovery_t0.05_long_fixed12h` | 1,282/114 | 1,265/107 | 150/26 | -346/24 | P,B,M,C |
| 1121 | `cmf_5m_n40_recovery_t0.5_long_fixed12h` | 1,248/1 | 1,399/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1122 | `mfi_240m_n7_into_t0.8_long_indicator_or12h` | 1,243/49 | 1,599/46 | -199/12 | -249/12 | P,B,M,C |
| 1123 | `mfi_60m_n14_into_t0.9_long_fixed12h` | 1,218/3 | 1,255/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1124 | `obv_60m_n10_recovery_t0.25_long_fixed12h` | 1,218/390 | 1,130/373 | 3,393/88 | 3,150/85 | B,M,C |
| 1125 | `mfi_30m_n14_into_t0.9_long_indicator_or12h` | 1,210/7 | 1,286/7 | 472/3 | 484/3 | N,B,M |
| 1126 | `mfi_30m_n14_recovery_t0.9_long_indicator_or12h` | 1,194/7 | 1,158/7 | 495/3 | 476/3 | N,B,M |
| 1127 | `mfi_15m_n28_trend_t0.8_long_indicator_or12h` | 1,180/5 | 1,193/5 | 1,320/2 | 1,333/2 | N,B,M |
| 1128 | `cmf_30m_n20_into_t0.2_long_indicator_or12h` | 1,179/199 | 547/199 | 1,265/40 | 514/40 | B,M,C |
| 1129 | `mfi_5m_n7_into_t0.6_short_indicator_or12h` | -24,412/3827 | -29,939/3827 | -8,864/958 | -8,506/958 | P,B,M,C |
| 1130 | `mfi_30m_n14_recovery_t0.8_long_fixed12h` | 1,172/50 | 1,076/50 | -830/10 | -863/10 | P,B,M,C |
| 1131 | `obv_30m_n20_into_t0.75_long_indicator_or12h` | 1,162/12 | 928/12 | -618/1 | -647/1 | N,P,B,M,C |
| 1132 | `obv_30m_n10_recovery_t0.25_long_fixed12h` | 1,160/546 | -2,521/527 | 2,663/139 | 3,092/136 | P,B,M,C |
| 1133 | `mfi_30m_n14_recovery_t0.9_long_fixed12h` | 1,143/7 | 1,075/7 | 929/3 | 934/3 | N,B,M |
| 1134 | `obv_15m_n10_trend_t0.5_long_fixed12h` | 1,143/496 | 1,676/491 | 6,338/125 | 7,868/122 | B,M,C |
| 1135 | `mfi_60m_n14_into_t0.9_long_indicator_or12h` | 1,131/3 | 1,116/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1136 | `obv_60m_n10_recovery_t0.75_long_fixed12h` | 1,114/53 | 1,251/53 | 368/9 | 398/9 | N,B,M |
| 1137 | `cmf_240m_n40_into_t0.05_long_fixed12h` | 1,104/78 | 1,846/73 | 543/21 | 1,164/20 | B,M |
| 1138 | `cmf_240m_n20_trend_t0_long_indicator_or12h` | 1,103/135 | 780/135 | -938/27 | -992/27 | P,B,M,C |
| 1139 | `obv_15m_n10_recovery_t0.25_long_fixed12h` | 1,096/664 | 1,961/655 | 1,806/164 | 1,936/163 | B,M,C |
| 1140 | `mfi_30m_n28_trend_t0.8_long_fixed12h` | 1,091/6 | 1,126/6 | 413/1 | 434/1 | N,B,M |
| 1141 | `cmf_15m_n20_trend_t0.05_short_indicator_or12h` | -24,524/1296 | -21,364/1293 | -6,351/323 | -5,161/321 | P,B,M,C |
| 1142 | `obv_5m_n40_trend_t0.75_long_indicator_or12h` | 1,061/3 | 895/3 | 105/1 | -36/1 | N,P,B,M,C |
| 1143 | `mfi_15m_n28_into_t0.8_long_indicator_or12h` | 1,059/6 | 744/6 | 135/1 | 129/1 | N,B,M |
| 1144 | `obv_15m_n20_trend_t0.75_long_fixed12h` | 1,059/13 | 1,170/13 | 1,320/3 | 1,330/3 | N,B,M |
| 1145 | `obv_60m_n10_trend_t0_short_indicator_or12h` | -24,537/841 | -23,965/841 | -6,240/202 | -6,022/202 | P,B,M,C |
| 1146 | `mfi_60m_n14_recovery_t0.9_long_fixed12h` | 1,039/3 | 1,104/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1147 | `mfi_60m_n14_into_t0.6_long_indicator_or12h` | 1,017/112 | 1,401/111 | -726/25 | -508/25 | P,B,M,C |
| 1148 | `obv_5m_n40_trend_t0_long_fixed12h` | 1,007/696 | 1,774/689 | 4,678/175 | 4,822/172 | B,M,C |
| 1149 | `obv_240m_n10_recovery_t0.25_long_fixed12h` | 1,000/157 | 1,045/142 | 158/35 | -2/33 | P,B,M,C |
| 1150 | `mfi_30m_n14_recovery_t0.8_long_indicator_or12h` | 972/50 | 1,170/50 | -195/10 | -139/10 | P,B,M,C |
| 1151 | `obv_15m_n40_recovery_t0.5_long_indicator_or12h` | 936/46 | 688/46 | -372/5 | -438/5 | N,P,B,M,C |
| 1152 | `cmf_15m_n20_trend_t0.5_long_indicator_or12h` | 932/15 | 912/15 | 705/3 | 609/3 | N,B,M |
| 1153 | `cmf_5m_n20_into_t0.2_long_indicator_or12h` | 907/1507 | 238/1507 | -511/372 | -489/372 | P,B,M,C |
| 1154 | `mfi_15m_n14_recovery_t0.9_long_fixed12h` | 891/21 | 1,017/21 | 71/4 | 109/4 | N,B,M |
| 1155 | `cmf_30m_n10_into_t0.5_long_indicator_or12h` | 890/42 | 160/42 | 1,518/8 | 1,270/8 | N,B,M,C |
| 1156 | `mfi_60m_n14_recovery_t0.9_long_indicator_or12h` | 880/3 | 839/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1157 | `mfi_5m_n28_trend_t0.8_long_indicator_or12h` | 865/20 | 873/20 | 657/10 | 538/10 | N,B,M |
| 1158 | `mfi_15m_n7_trend_t0.2_long_fixed12h` | 846/719 | -3,338/711 | 3,765/184 | 3,111/182 | P,B,M,C |
| 1159 | `cmf_240m_n10_trend_t0_long_indicator_or12h` | 845/211 | 1,119/211 | 363/47 | 394/47 | B,M,C |
| 1160 | `obv_30m_n40_into_t0.5_long_fixed12h` | 814/14 | 583/14 | -457/2 | -466/2 | N,P,B,M,C |
| 1161 | `obv_30m_n40_into_t0.5_long_indicator_or12h` | 814/14 | 583/14 | -457/2 | -466/2 | N,P,B,M,C |
| 1162 | `mfi_60m_n7_into_t0.9_long_indicator_or12h` | 798/80 | 648/80 | 1,004/19 | 944/19 | B,M,C |
| 1163 | `cmf_15m_n20_recovery_t0.5_long_fixed12h` | 791/10 | 476/10 | 0/0 | 0/0 | N,P,B,M,C |
| 1164 | `obv_30m_n20_into_t0.75_long_fixed12h` | 774/12 | 493/12 | -618/1 | -647/1 | N,P,B,M,C |
| 1165 | `obv_60m_n20_into_t0.25_long_fixed12h` | 774/219 | -93/208 | -784/50 | -1,047/46 | P,B,M,C |
| 1166 | `mfi_15m_n14_recovery_t0.9_long_indicator_or12h` | 750/21 | 669/21 | 280/4 | 174/4 | N,B,M |
| 1167 | `mfi_60m_n28_trend_t0.8_long_fixed12h` | 741/2 | 797/2 | 250/1 | 292/1 | N,B,M |
| 1168 | `mfi_60m_n28_trend_t0.8_long_indicator_or12h` | 741/2 | 797/2 | 250/1 | 292/1 | N,B,M |
| 1169 | `cmf_5m_n40_recovery_t0.05_short_indicator_or12h` | -24,854/2067 | -22,365/1912 | -8,551/536 | -8,407/503 | P,B,M,C |
| 1170 | `obv_15m_n10_recovery_t0.5_long_fixed12h` | 700/503 | -215/499 | -2,385/119 | -1,842/118 | P,B,M,C |
| 1171 | `cmf_15m_n20_into_t0.05_long_fixed12h` | 681/594 | 1,478/591 | 3,918/148 | 3,485/148 | B,M,C |
| 1172 | `obv_30m_n10_into_t0.75_long_indicator_or12h` | 651/110 | -200/109 | 2,526/24 | 2,009/23 | P,B,M,C |
| 1173 | `cmf_240m_n10_into_t0.2_long_fixed12h` | 638/107 | 220/96 | -66/29 | -688/24 | P,B,M,C |
| 1174 | `obv_240m_n10_into_t0.75_long_fixed12h` | 631/7 | 499/7 | 79/2 | 50/2 | N,B,M |
| 1175 | `obv_240m_n10_into_t0.75_long_indicator_or12h` | 631/7 | 499/7 | 79/2 | 50/2 | N,B,M |
| 1176 | `obv_15m_n20_trend_t0.75_long_indicator_or12h` | 604/13 | 701/13 | 472/3 | 507/3 | N,B,M |
| 1177 | `mfi_15m_n14_into_t0.9_long_indicator_or12h` | 601/21 | 502/21 | 353/4 | 299/4 | N,B,M |
| 1178 | `cmf_5m_n40_recovery_t0.5_long_indicator_or12h` | 601/1 | 695/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1179 | `mfi_60m_n14_trend_t0.8_long_indicator_or12h` | 596/25 | 619/25 | 213/8 | 229/8 | N,B,M |
| 1180 | `obv_15m_n10_recovery_t0.75_long_indicator_or12h` | 590/224 | -67/224 | -1,876/52 | -2,017/52 | P,B,M,C |
| 1181 | `cmf_240m_n40_recovery_t0.2_long_fixed12h` | 585/11 | 708/11 | -583/3 | -569/3 | N,P,B,M,C |
| 1182 | `cmf_240m_n40_recovery_t0.2_long_indicator_or12h` | 585/11 | 708/11 | -583/3 | -569/3 | N,P,B,M,C |
| 1183 | `mfi_30m_n7_into_t0.6_long_indicator_or12h` | 573/595 | -693/595 | 1,832/136 | 1,556/136 | P,B,M,C |
| 1184 | `cmf_60m_n10_into_t0.5_long_indicator_or12h` | 570/12 | 474/12 | 0/0 | 0/0 | N,P,B,M,C |
| 1185 | `cmf_5m_n10_recovery_t0.5_long_fixed12h` | 566/319 | -411/318 | -571/71 | -871/70 | P,B,M,C |
| 1186 | `cmf_5m_n40_recovery_t0.05_short_fixed12h` | -25,023/687 | -28,083/683 | -8,659/176 | -8,440/174 | P,B,M,C |
| 1187 | `cmf_15m_n40_recovery_t0.05_long_fixed12h` | 563/459 | 1,741/453 | 2,406/110 | 3,894/109 | B,M,C |
| 1188 | `cmf_5m_n10_recovery_t0.05_long_fixed12h` | 555/797 | -538/792 | 2,750/203 | 1,113/202 | P,B,M,C |
| 1189 | `mfi_15m_n14_trend_t0.6_long_fixed12h` | 553/324 | 167/319 | 656/81 | 1,185/80 | B,M,C |
| 1190 | `mfi_60m_n7_recovery_t0.6_long_indicator_or12h` | 540/311 | 651/308 | -1,571/76 | -1,487/75 | P,B,M,C |
| 1191 | `obv_5m_n20_trend_t0.75_long_fixed12h` | 536/62 | 620/62 | 1,505/18 | 1,281/18 | B,M,C |
| 1192 | `cmf_15m_n40_trend_t0_long_fixed12h` | 526/530 | -1,000/524 | 4,065/138 | 3,437/134 | P,B,M,C |
| 1193 | `mfi_15m_n28_trend_t0_short_indicator_or12h` | -25,062/1387 | -22,876/1387 | -8,447/366 | -7,621/366 | P,B,M,C |
| 1194 | `mfi_5m_n14_recovery_t0.9_long_fixed12h` | 517/112 | 339/112 | 482/25 | 675/25 | B,M,C |
| 1195 | `mfi_15m_n7_recovery_t0.9_long_indicator_or12h` | 509/353 | 116/353 | -125/79 | -285/79 | P,B,M,C |
| 1196 | `obv_5m_n10_trend_t0.75_short_fixed12h` | -25,081/480 | -25,007/479 | -9,480/121 | -9,667/120 | P,B,M,C |
| 1197 | `cmf_15m_n40_recovery_t0.2_long_fixed12h` | 503/113 | -35/113 | 258/26 | 208/26 | P,B,M,C |
| 1198 | `obv_5m_n20_trend_t0.25_long_fixed12h` | 487/702 | 947/698 | 4,576/176 | 4,167/175 | B,M,C |
| 1199 | `mfi_60m_n14_trend_t0.2_long_fixed12h` | 484/307 | 2,224/296 | 4,855/82 | 5,511/77 | B,M,C |
| 1200 | `cmf_240m_n40_into_t0.05_long_indicator_or12h` | 471/78 | 1,262/73 | 303/21 | 918/20 | B,M,C |
| 1201 | `mfi_5m_n28_into_t0.8_long_indicator_or12h` | 446/29 | 185/29 | 150/7 | 112/7 | N,B,M,C |
| 1202 | `cmf_15m_n40_trend_t0.5_long_fixed12h` | 446/2 | 457/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1203 | `cmf_15m_n40_trend_t0.5_long_indicator_or12h` | 446/2 | 457/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1204 | `cmf_60m_n40_recovery_t0.05_long_indicator_or12h` | 435/215 | 1,408/202 | 1,286/47 | 1,155/42 | B,M,C |
| 1205 | `cmf_30m_n20_into_t0.5_long_indicator_or12h` | 420/5 | 373/5 | 0/0 | 0/0 | N,P,B,M,C |
| 1206 | `mfi_240m_n14_into_t0.9_long_fixed12h` | 416/2 | 434/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1207 | `mfi_240m_n14_into_t0.9_long_indicator_or12h` | 416/2 | 434/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1208 | `obv_30m_n40_trend_t0.75_long_fixed12h` | 413/1 | 434/1 | 413/1 | 434/1 | N,B,M |
| 1209 | `obv_30m_n40_trend_t0.75_long_indicator_or12h` | 413/1 | 434/1 | 413/1 | 434/1 | N,B,M |
| 1210 | `mfi_5m_n7_trend_t0.2_long_fixed12h` | 411/802 | 2,035/797 | 2,429/205 | 2,517/204 | B,M,C |
| 1211 | `mfi_15m_n14_into_t0.9_long_fixed12h` | 402/21 | 327/21 | -59/4 | -51/4 | N,P,B,M,C |
| 1212 | `obv_5m_n40_into_t0.75_long_fixed12h` | 398/6 | 300/6 | 0/0 | 0/0 | N,P,B,M,C |
| 1213 | `mfi_240m_n28_trend_t0.2_long_fixed12h` | 364/66 | 300/64 | 1,389/20 | 1,160/20 | B,M,C |
| 1214 | `mfi_240m_n28_trend_t0.2_long_indicator_or12h` | 364/66 | 295/64 | 1,389/20 | 1,155/20 | B,M,C |
| 1215 | `mfi_60m_n14_recovery_t0.8_long_fixed12h` | 361/22 | 289/22 | -427/5 | -393/5 | N,P,B,M,C |
| 1216 | `mfi_5m_n28_recovery_t0.8_long_fixed12h` | 356/28 | 225/28 | 77/6 | 19/6 | N,B,M,C |
| 1217 | `obv_240m_n10_trend_t0.25_long_fixed12h` | 351/133 | -376/126 | -1,222/36 | -2,115/34 | P,B,M,C |
| 1218 | `mfi_5m_n14_recovery_t0.9_long_indicator_or12h` | 347/126 | 121/126 | 602/27 | 704/27 | B,M,C |
| 1219 | `cmf_15m_n20_trend_t0.5_long_fixed12h` | 334/15 | 287/15 | 755/3 | 605/3 | N,B,M |
| 1220 | `cmf_15m_n40_recovery_t0.2_long_indicator_or12h` | 334/114 | 277/113 | 605/26 | 627/26 | B,M,C |
| 1221 | `mfi_60m_n14_recovery_t0.8_long_indicator_or12h` | 331/22 | 194/22 | -461/5 | -462/5 | N,P,B,M,C |
| 1222 | `mfi_60m_n14_trend_t0.8_long_fixed12h` | 315/25 | 383/25 | 127/8 | 141/8 | N,B,M |
| 1223 | `obv_240m_n10_trend_t0.25_long_indicator_or12h` | 311/133 | -591/126 | -780/36 | -1,714/34 | P,B,M,C |
| 1224 | `obv_15m_n20_into_t0.75_long_indicator_or12h` | 294/23 | 121/23 | 32/2 | 5/2 | N,B,M,C |
| 1225 | `cmf_15m_n20_recovery_t0.5_long_indicator_or12h` | 293/10 | 299/10 | 0/0 | 0/0 | N,P,B,M,C |
| 1226 | `obv_60m_n40_trend_t0.5_long_fixed12h` | 289/6 | 316/6 | 888/5 | 906/5 | N,B,M |
| 1227 | `obv_60m_n40_trend_t0.5_long_indicator_or12h` | 289/6 | 316/6 | 888/5 | 906/5 | N,B,M |
| 1228 | `mfi_240m_n28_trend_t0.6_long_fixed12h` | 288/11 | 125/10 | -110/7 | -319/6 | N,P,B,M,C |
| 1229 | `mfi_240m_n28_trend_t0.6_long_indicator_or12h` | 288/11 | 125/10 | -110/7 | -319/6 | N,P,B,M,C |
| 1230 | `mfi_15m_n28_into_t0.6_long_indicator_or12h` | 265/86 | 475/86 | -177/13 | -185/13 | P,B,M,C |
| 1231 | `mfi_240m_n28_trend_t0_long_indicator_or12h` | 257/74 | 251/74 | 408/18 | 511/18 | B,M,C |
| 1232 | `cmf_60m_n40_into_t0.2_long_indicator_or12h` | 257/19 | -35/18 | 376/5 | 390/5 | N,P,B,M,C |
| 1233 | `mfi_60m_n7_into_t0.8_long_indicator_or12h` | 245/155 | -782/152 | 0/37 | -50/37 | P,B,M,C |
| 1234 | `obv_5m_n20_recovery_t0.75_long_indicator_or12h` | 235/106 | 292/106 | 157/25 | 204/25 | B,M,C |
| 1235 | `obv_30m_n20_recovery_t0.25_long_indicator_or12h` | 234/405 | -928/395 | 1,469/99 | 1,103/95 | P,B,M,C |
| 1236 | `cmf_30m_n20_trend_t0.05_long_fixed12h` | 216/493 | 1,931/483 | 4,300/125 | 5,352/123 | B,M,C |
| 1237 | `obv_60m_n20_recovery_t0.5_long_fixed12h` | 216/56 | -994/55 | -362/15 | -243/15 | P,B,M,C |
| 1238 | `obv_30m_n20_trend_t0.75_long_fixed12h` | 202/5 | 143/5 | 826/2 | 835/2 | N,B,M |
| 1239 | `mfi_240m_n7_into_t0.9_long_fixed12h` | 200/22 | 15/22 | 290/8 | 337/8 | N,B,M,C |
| 1240 | `mfi_240m_n7_into_t0.9_long_indicator_or12h` | 200/22 | 15/22 | 290/8 | 337/8 | N,B,M,C |
| 1241 | `cmf_30m_n20_trend_t0.5_long_fixed12h` | 193/4 | 198/4 | -45/1 | -4/1 | N,P,B,M,C |
| 1242 | `cmf_30m_n20_recovery_t0.2_long_indicator_or12h` | 187/200 | -1,267/198 | 125/41 | 25/40 | P,B,M,C |
| 1243 | `mfi_15m_n28_recovery_t0.8_long_fixed12h` | 178/6 | 53/6 | 202/1 | 203/1 | N,B,M,C |
| 1244 | `mfi_240m_n28_recovery_t0.6_long_fixed12h` | 170/3 | 205/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1245 | `mfi_240m_n28_recovery_t0.6_long_indicator_or12h` | 170/3 | 211/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1246 | `cmf_60m_n10_recovery_t0.5_long_indicator_or12h` | 155/12 | 157/12 | 0/0 | 0/0 | N,P,B,M,C |
| 1247 | `obv_60m_n20_into_t0.75_long_fixed12h` | 138/1 | 110/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1248 | `obv_60m_n20_into_t0.75_long_indicator_or12h` | 138/1 | 110/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1249 | `cmf_30m_n10_recovery_t0.5_long_indicator_or12h` | 123/42 | -63/42 | 1,004/8 | 887/8 | N,P,B,M,C |
| 1250 | `cmf_240m_n10_trend_t0.5_long_fixed12h` | 118/8 | 301/8 | 172/4 | 218/4 | N,B,M |
| 1251 | `cmf_240m_n10_trend_t0.5_long_indicator_or12h` | 118/8 | 301/8 | 172/4 | 218/4 | N,B,M |
| 1252 | `cmf_30m_n20_recovery_t0.5_long_indicator_or12h` | 113/5 | 56/5 | 0/0 | 0/0 | N,P,B,M,C |
| 1253 | `obv_30m_n20_trend_t0.75_long_indicator_or12h` | 110/5 | 103/5 | 882/2 | 896/2 | N,B,M |
| 1254 | `cmf_30m_n10_trend_t0_short_indicator_or12h` | -25,481/1622 | -22,917/1622 | -10,455/421 | -9,513/421 | P,B,M,C |
| 1255 | `cmf_240m_n40_trend_t0.2_long_fixed12h` | 105/27 | 265/25 | -330/13 | -339/12 | N,P,B,M,C |
| 1256 | `cmf_240m_n40_trend_t0.2_long_indicator_or12h` | 105/27 | 265/25 | -330/13 | -339/12 | N,P,B,M,C |
| 1257 | `cmf_30m_n20_trend_t0.5_long_indicator_or12h` | 95/4 | 83/4 | -78/1 | -66/1 | N,P,B,M,C |
| 1258 | `mfi_15m_n14_trend_t0.8_long_fixed12h` | 55/91 | 302/91 | 1,166/19 | 1,078/19 | B,M,C |
| 1259 | `mfi_5m_n14_trend_t0.6_long_fixed12h` | 54/583 | -131/581 | 7,040/146 | 6,555/146 | P,B,M,C |
| 1260 | `mfi_30m_n7_recovery_t0.9_long_indicator_or12h` | 43/162 | 545/162 | 625/36 | 711/36 | B,M,C |
| 1261 | `mfi_240m_n7_into_t0.6_long_indicator_or12h` | 37/92 | 295/89 | -2,043/20 | -2,293/20 | P,B,M,C |
| 1262 | `obv_5m_n40_recovery_t0.75_long_fixed12h` | 36/6 | 69/6 | 0/0 | 0/0 | N,P,B,M,C |
| 1263 | `cmf_240m_n40_into_t0.2_long_fixed12h` | 29/10 | 104/8 | -183/2 | -168/2 | N,P,B,M,C |
| 1264 | `cmf_240m_n40_into_t0.2_long_indicator_or12h` | 29/10 | 104/8 | -183/2 | -168/2 | N,P,B,M,C |
| 1265 | `obv_15m_n20_into_t0.75_long_fixed12h` | 22/23 | -273/23 | -184/2 | -180/2 | N,P,B,M,C |
| 1266 | `obv_15m_n40_trend_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1267 | `obv_15m_n40_trend_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1268 | `obv_15m_n40_into_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1269 | `obv_15m_n40_into_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1270 | `obv_15m_n40_recovery_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1271 | `obv_15m_n40_recovery_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1272 | `mfi_15m_n28_into_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1273 | `mfi_15m_n28_into_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1274 | `mfi_15m_n28_recovery_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1275 | `mfi_15m_n28_recovery_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1276 | `cmf_15m_n40_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1277 | `cmf_15m_n40_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1278 | `cmf_15m_n40_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1279 | `cmf_15m_n40_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1280 | `obv_30m_n40_into_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1281 | `obv_30m_n40_into_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1282 | `obv_30m_n40_recovery_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1283 | `obv_30m_n40_recovery_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1284 | `mfi_30m_n28_into_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1285 | `mfi_30m_n28_into_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1286 | `mfi_30m_n28_recovery_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1287 | `mfi_30m_n28_recovery_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1288 | `cmf_30m_n40_trend_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1289 | `cmf_30m_n40_trend_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1290 | `cmf_30m_n40_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1291 | `cmf_30m_n40_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1292 | `cmf_30m_n40_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1293 | `cmf_30m_n40_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1294 | `obv_60m_n40_trend_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1295 | `obv_60m_n40_trend_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1296 | `obv_60m_n40_into_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1297 | `obv_60m_n40_into_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1298 | `obv_60m_n40_recovery_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1299 | `obv_60m_n40_recovery_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1300 | `mfi_60m_n28_into_t0.8_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1301 | `mfi_60m_n28_into_t0.8_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1302 | `mfi_60m_n28_into_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1303 | `mfi_60m_n28_into_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1304 | `mfi_60m_n28_recovery_t0.8_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1305 | `mfi_60m_n28_recovery_t0.8_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1306 | `mfi_60m_n28_recovery_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1307 | `mfi_60m_n28_recovery_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1308 | `cmf_60m_n20_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1309 | `cmf_60m_n20_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1310 | `cmf_60m_n20_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1311 | `cmf_60m_n20_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1312 | `cmf_60m_n40_trend_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1313 | `cmf_60m_n40_trend_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1314 | `cmf_60m_n40_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1315 | `cmf_60m_n40_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1316 | `cmf_60m_n40_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1317 | `cmf_60m_n40_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1318 | `obv_240m_n20_trend_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1319 | `obv_240m_n20_trend_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1320 | `obv_240m_n20_into_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1321 | `obv_240m_n20_into_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1322 | `obv_240m_n20_recovery_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1323 | `obv_240m_n20_recovery_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1324 | `obv_240m_n40_trend_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1325 | `obv_240m_n40_trend_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1326 | `obv_240m_n40_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1327 | `obv_240m_n40_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1328 | `obv_240m_n40_into_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1329 | `obv_240m_n40_into_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1330 | `obv_240m_n40_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1331 | `obv_240m_n40_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1332 | `obv_240m_n40_recovery_t0.75_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1333 | `obv_240m_n40_recovery_t0.75_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1334 | `mfi_240m_n28_into_t0.8_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1335 | `mfi_240m_n28_into_t0.8_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1336 | `mfi_240m_n28_into_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1337 | `mfi_240m_n28_into_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1338 | `mfi_240m_n28_recovery_t0.8_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1339 | `mfi_240m_n28_recovery_t0.8_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1340 | `mfi_240m_n28_recovery_t0.9_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1341 | `mfi_240m_n28_recovery_t0.9_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1342 | `cmf_240m_n20_trend_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1343 | `cmf_240m_n20_trend_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1344 | `cmf_240m_n20_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1345 | `cmf_240m_n20_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1346 | `cmf_240m_n20_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1347 | `cmf_240m_n20_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1348 | `cmf_240m_n40_trend_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1349 | `cmf_240m_n40_trend_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1350 | `cmf_240m_n40_into_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1351 | `cmf_240m_n40_into_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1352 | `cmf_240m_n40_recovery_t0.5_long_fixed12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1353 | `cmf_240m_n40_recovery_t0.5_long_indicator_or12h` | 0/0 | 0/0 | 0/0 | 0/0 | N,P,B,M,C |
| 1354 | `obv_60m_n20_recovery_t0.75_long_fixed12h` | -4/1 | -31/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1355 | `obv_60m_n20_recovery_t0.75_long_indicator_or12h` | -4/1 | -31/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1356 | `obv_5m_n40_recovery_t0.5_long_fixed12h` | -23/155 | 1,105/154 | -1,488/36 | -1,216/36 | P,B,M,C |
| 1357 | `obv_240m_n40_trend_t0.5_long_fixed12h` | -24/1 | -42/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1358 | `obv_240m_n40_trend_t0.5_long_indicator_or12h` | -24/1 | -42/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1359 | `mfi_240m_n28_trend_t0.8_long_fixed12h` | -24/1 | -42/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1360 | `mfi_240m_n28_trend_t0.8_long_indicator_or12h` | -24/1 | -42/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1361 | `cmf_5m_n10_trend_t0.5_long_fixed12h` | -50/394 | 389/394 | 427/94 | 402/94 | P,B,M,C |
| 1362 | `cmf_15m_n20_into_t0.5_long_fixed12h` | -50/10 | 126/10 | 0/0 | 0/0 | N,P,B,M,C |
| 1363 | `obv_60m_n20_recovery_t0.5_long_indicator_or12h` | -50/56 | -312/55 | 534/15 | 644/15 | P,B,M,C |
| 1364 | `cmf_15m_n20_recovery_t0.05_long_fixed12h` | -52/602 | 2,348/591 | 5,791/156 | 6,410/153 | P,B,M,C |
| 1365 | `cmf_240m_n10_into_t0.5_long_fixed12h` | -81/1 | -91/1 | -81/1 | -91/1 | N,P,B,M,C |
| 1366 | `cmf_240m_n10_into_t0.5_long_indicator_or12h` | -81/1 | -91/1 | -81/1 | -91/1 | N,P,B,M,C |
| 1367 | `mfi_240m_n14_recovery_t0.9_long_fixed12h` | -88/2 | -93/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1368 | `mfi_240m_n14_recovery_t0.9_long_indicator_or12h` | -88/2 | -93/2 | 0/0 | 0/0 | N,P,B,M,C |
| 1369 | `cmf_5m_n20_trend_t0.2_long_fixed12h` | -93/662 | 4,417/657 | 4,754/168 | 5,355/167 | P,B,M,C |
| 1370 | `mfi_30m_n14_trend_t0_short_indicator_or12h` | -25,682/1085 | -24,448/1085 | -11,701/287 | -11,026/287 | P,B,M,C |
| 1371 | `mfi_240m_n14_into_t0.8_long_fixed12h` | -97/4 | -179/4 | 0/0 | 0/0 | N,P,B,M,C |
| 1372 | `mfi_240m_n14_into_t0.8_long_indicator_or12h` | -97/4 | -179/4 | 0/0 | 0/0 | N,P,B,M,C |
| 1373 | `cmf_30m_n20_into_t0.5_long_fixed12h` | -100/5 | -89/5 | 0/0 | 0/0 | N,P,B,M,C |
| 1374 | `obv_30m_n20_recovery_t0.25_long_fixed12h` | -105/376 | -2,222/364 | 1,710/95 | 1,198/92 | P,B,M,C |
| 1375 | `mfi_30m_n28_into_t0.8_long_fixed12h` | -114/1 | -146/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1376 | `mfi_30m_n28_into_t0.8_long_indicator_or12h` | -114/1 | -146/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1377 | `mfi_5m_n28_into_t0.9_long_indicator_or12h` | -116/1 | -105/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1378 | `obv_30m_n10_recovery_t0.5_long_fixed12h` | -117/350 | -552/345 | 2,870/83 | 2,325/81 | P,B,M,C |
| 1379 | `mfi_5m_n28_recovery_t0.9_long_indicator_or12h` | -138/1 | -157/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1380 | `cmf_30m_n20_into_t0.05_long_indicator_or12h` | -142/667 | -1,084/662 | 635/163 | 25/163 | P,B,M,C |
| 1381 | `mfi_5m_n28_into_t0.9_long_fixed12h` | -165/1 | -165/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1382 | `obv_30m_n40_recovery_t0.5_long_fixed12h` | -175/15 | 84/15 | -484/2 | -455/2 | N,P,B,M,C |
| 1383 | `obv_5m_n40_into_t0.25_long_indicator_or12h` | -176/882 | -1,239/882 | 2,198/226 | 1,659/226 | P,B,M,C |
| 1384 | `cmf_60m_n20_trend_t0_long_fixed12h` | -181/340 | -493/326 | -720/84 | -655/81 | P,B,M,C |
| 1385 | `cmf_240m_n10_recovery_t0.5_long_fixed12h` | -199/1 | -193/1 | -199/1 | -193/1 | N,P,B,M,C |
| 1386 | `cmf_240m_n10_recovery_t0.5_long_indicator_or12h` | -199/1 | -193/1 | -199/1 | -193/1 | N,P,B,M,C |
| 1387 | `mfi_60m_n14_trend_t0.2_long_indicator_or12h` | -204/329 | 376/324 | 4,364/85 | 5,068/83 | P,B,M,C |
| 1388 | `mfi_5m_n28_recovery_t0.9_long_fixed12h` | -229/1 | -247/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1389 | `obv_240m_n20_into_t0.25_long_indicator_or12h` | -247/86 | 92/83 | -700/15 | -585/15 | P,B,M,C |
| 1390 | `mfi_240m_n14_trend_t0.6_long_fixed12h` | -248/35 | -74/32 | 789/12 | 748/12 | P,B,M,C |
| 1391 | `mfi_240m_n14_trend_t0.6_long_indicator_or12h` | -248/35 | -74/32 | 789/12 | 748/12 | P,B,M,C |
| 1392 | `obv_240m_n20_trend_t0.5_long_fixed12h` | -257/16 | 1/14 | 35/4 | 80/4 | N,P,B,M,C |
| 1393 | `obv_240m_n20_trend_t0.5_long_indicator_or12h` | -257/16 | 1/14 | 35/4 | 80/4 | N,P,B,M,C |
| 1394 | `mfi_30m_n28_recovery_t0.8_long_fixed12h` | -259/1 | -297/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1395 | `mfi_30m_n28_recovery_t0.8_long_indicator_or12h` | -259/1 | -297/1 | 0/0 | 0/0 | N,P,B,M,C |
| 1396 | `mfi_30m_n14_trend_t0.6_long_indicator_or12h` | -261/183 | -257/183 | 747/45 | 935/45 | P,B,M,C |
| 1397 | `mfi_30m_n7_recovery_t0.8_long_indicator_or12h` | -262/325 | 27/324 | 1,976/68 | 2,168/68 | P,B,M,C |
| 1398 | `cmf_30m_n40_trend_t0.05_long_fixed12h` | -263/355 | 2,564/346 | -679/91 | 801/88 | P,B,M,C |
| 1399 | `obv_15m_n10_into_t0.25_long_fixed12h` | -271/657 | 2,540/645 | 695/166 | 1,488/164 | P,B,M,C |
| 1400 | `cmf_60m_n10_into_t0.5_long_fixed12h` | -273/12 | -465/12 | 0/0 | 0/0 | N,P,B,M,C |
| 1401 | `obv_5m_n40_into_t0.75_long_indicator_or12h` | -275/6 | -344/6 | 0/0 | 0/0 | N,P,B,M,C |
| 1402 | `obv_5m_n20_into_t0.5_long_indicator_or12h` | -283/857 | -1,920/857 | -1,075/206 | -1,324/206 | P,B,M,C |
| 1403 | `mfi_240m_n7_recovery_t0.8_long_fixed12h` | -283/47 | -408/46 | -377/12 | -283/12 | P,B,M,C |
| 1404 | `cmf_15m_n20_into_t0.5_long_indicator_or12h` | -288/10 | 85/10 | 0/0 | 0/0 | N,P,B,M,C |
| 1405 | `mfi_15m_n28_recovery_t0.8_long_indicator_or12h` | -293/6 | -583/6 | 83/1 | 97/1 | N,P,B,M,C |
| 1406 | `cmf_15m_n10_trend_t0.05_long_fixed12h` | -305/709 | 5,143/697 | 4,322/182 | 3,815/179 | P,B,M,C |
| 1407 | `cmf_15m_n10_recovery_t0.2_long_fixed12h` | -346/591 | -2,293/583 | 3,065/150 | 2,200/148 | P,B,M,C |
| 1408 | `mfi_5m_n14_recovery_t0.6_long_fixed12h` | -364/602 | 1,335/600 | -837/151 | -96/150 | P,B,M,C |
| 1409 | `mfi_240m_n7_into_t0.6_long_fixed12h` | -365/92 | -173/89 | -2,043/20 | -2,293/20 | P,B,M,C |
| 1410 | `mfi_240m_n28_into_t0.6_long_fixed12h` | -406/3 | -484/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1411 | `mfi_240m_n28_into_t0.6_long_indicator_or12h` | -406/3 | -484/3 | 0/0 | 0/0 | N,P,B,M,C |
| 1412 | `mfi_240m_n7_recovery_t0.8_long_indicator_or12h` | -417/47 | -619/46 | -283/12 | -174/12 | P,B,M,C |
| 1413 | `obv_240m_n20_into_t0.25_long_fixed12h` | -430/86 | -83/83 | -690/15 | -557/15 | P,B,M,C |
| 1414 | `cmf_60m_n20_trend_t0.5_long_fixed12h` | -431/3 | -381/3 | 270/1 | 336/1 | N,P,B,M,C |
| 1415 | `cmf_60m_n20_into_t0.2_long_indicator_or12h` | -435/104 | -1,157/102 | 32/20 | -40/20 | P,B,M,C |
| 1416 | `cmf_60m_n20_trend_t0.5_long_indicator_or12h` | -449/3 | -394/3 | 270/1 | 336/1 | N,P,B,M,C |
| 1417 | `obv_15m_n20_recovery_t0.75_long_indicator_or12h` | -451/23 | -613/23 | -17/2 | -22/2 | N,P,B,M,C |
| 1418 | `cmf_60m_n40_into_t0.2_long_fixed12h` | -453/19 | -574/18 | 376/5 | 390/5 | N,P,B,M,C |
| 1419 | `obv_60m_n20_trend_t0_long_indicator_or12h` | -454/558 | -797/558 | 3,359/126 | 3,277/126 | P,B,M,C |
| 1420 | `obv_30m_n10_recovery_t0.75_long_indicator_or12h` | -455/110 | -801/109 | 1,418/24 | 1,210/23 | P,B,M,C |
| 1421 | `mfi_5m_n7_into_t0.8_long_fixed12h` | -477/666 | 1,196/665 | 7,273/173 | 7,793/173 | P,B,M,C |
| 1422 | `mfi_60m_n7_recovery_t0.6_long_fixed12h` | -495/301 | -3,438/291 | 324/74 | 60/71 | P,B,M,C |
| 1423 | `obv_30m_n20_into_t0.25_long_indicator_or12h` | -496/395 | -1,086/391 | 4,979/92 | 4,744/91 | P,B,M,C |
| 1424 | `mfi_60m_n14_into_t0.6_long_fixed12h` | -523/112 | -217/111 | -1,702/25 | -1,379/25 | P,B,M,C |
| 1425 | `mfi_240m_n14_trend_t0.8_long_fixed12h` | -578/8 | -478/8 | -1,233/4 | -1,243/4 | N,P,B,M,C |
| 1426 | `mfi_240m_n14_trend_t0.8_long_indicator_or12h` | -578/8 | -478/8 | -1,233/4 | -1,243/4 | N,P,B,M,C |
| 1427 | `mfi_5m_n28_recovery_t0.8_long_indicator_or12h` | -596/29 | -628/29 | 78/7 | 58/7 | N,P,B,M,C |
| 1428 | `obv_5m_n40_recovery_t0.75_long_indicator_or12h` | -599/6 | -486/6 | 0/0 | 0/0 | N,P,B,M,C |
| 1429 | `cmf_30m_n10_into_t0.5_long_fixed12h` | -634/41 | -988/41 | 1,090/8 | 875/8 | N,P,B,M,C |
| 1430 | `obv_240m_n10_trend_t0_long_fixed12h` | -651/178 | -670/167 | 2,576/46 | 2,050/41 | P,B,M,C |
| 1431 | `mfi_240m_n14_recovery_t0.6_long_fixed12h` | -672/30 | 19/26 | 377/5 | 798/4 | N,P,B,M,C |
| 1432 | `obv_240m_n20_into_t0.5_long_fixed12h` | -683/12 | -629/12 | -37/1 | -45/1 | N,P,B,M,C |
| 1433 | `obv_240m_n20_into_t0.5_long_indicator_or12h` | -683/12 | -629/12 | -37/1 | -45/1 | N,P,B,M,C |
| 1434 | `mfi_60m_n7_recovery_t0.9_long_indicator_or12h` | -714/80 | -976/80 | 14/19 | -124/19 | P,B,M,C |
| 1435 | `mfi_240m_n14_recovery_t0.8_long_fixed12h` | -715/4 | -596/4 | 0/0 | 0/0 | N,P,B,M,C |
| 1436 | `mfi_240m_n14_recovery_t0.8_long_indicator_or12h` | -715/4 | -596/4 | 0/0 | 0/0 | N,P,B,M,C |
| 1437 | `cmf_60m_n40_trend_t0.05_long_indicator_or12h` | -728/234 | 499/232 | -1,719/62 | -1,498/61 | P,B,M,C |
| 1438 | `mfi_30m_n7_trend_t0.2_long_fixed12h` | -731/614 | 1,640/593 | 3,705/156 | 5,673/151 | P,B,M,C |
| 1439 | `cmf_60m_n20_into_t0.2_long_fixed12h` | -740/104 | -1,433/102 | -880/20 | -942/20 | P,B,M,C |
| 1440 | `cmf_60m_n20_trend_t0_long_indicator_or12h` | -756/586 | 874/586 | 949/143 | 956/143 | P,B,M,C |
| 1441 | `obv_30m_n20_recovery_t0.75_long_indicator_or12h` | -759/12 | -558/12 | -593/1 | -565/1 | N,P,B,M,C |
| 1442 | `cmf_30m_n20_recovery_t0.5_long_fixed12h` | -779/5 | -827/5 | 0/0 | 0/0 | N,P,B,M,C |
| 1443 | `mfi_240m_n14_into_t0.6_long_fixed12h` | -781/29 | -737/27 | 971/5 | 1,016/5 | N,P,B,M,C |
| 1444 | `mfi_240m_n14_into_t0.6_long_indicator_or12h` | -781/29 | -737/27 | 971/5 | 1,016/5 | N,P,B,M,C |
| 1445 | `cmf_240m_n10_into_t0.05_long_indicator_or12h` | -784/178 | -1,365/174 | -956/45 | -692/43 | P,B,M,C |
| 1446 | `cmf_15m_n20_recovery_t0.2_long_indicator_or12h` | -791/433 | -1,885/433 | 1,630/109 | 1,252/109 | P,B,M,C |
| 1447 | `mfi_240m_n7_recovery_t0.9_long_fixed12h` | -847/22 | -752/22 | -171/8 | -135/8 | N,P,B,M,C |
| 1448 | `mfi_240m_n7_recovery_t0.9_long_indicator_or12h` | -847/22 | -758/22 | -171/8 | -134/8 | N,P,B,M,C |
| 1449 | `obv_60m_n20_trend_t0.25_long_fixed12h` | -852/208 | -1,509/205 | 114/57 | -139/57 | P,B,M,C |
| 1450 | `obv_60m_n40_into_t0.5_long_fixed12h` | -857/6 | -835/6 | 79/2 | 81/2 | N,P,B,M,C |
| 1451 | `obv_60m_n40_into_t0.5_long_indicator_or12h` | -857/6 | -836/6 | 79/2 | 80/2 | N,P,B,M,C |
| 1452 | `mfi_15m_n28_recovery_t0.6_long_indicator_or12h` | -892/86 | -806/86 | -121/13 | -201/13 | P,B,M,C |
| 1453 | `cmf_15m_n40_into_t0.2_long_fixed12h` | -908/115 | -1,440/115 | 2,288/26 | 1,942/26 | P,B,M,C |
| 1454 | `obv_240m_n10_recovery_t0.75_long_fixed12h` | -923/7 | -855/7 | 273/2 | 297/2 | N,P,B,M,C |
| 1455 | `obv_240m_n10_recovery_t0.75_long_indicator_or12h` | -923/7 | -855/7 | 273/2 | 298/2 | N,P,B,M,C |
| 1456 | `mfi_15m_n14_recovery_t0.6_long_indicator_or12h` | -966/428 | -1,477/428 | -1,436/101 | -1,252/101 | P,B,M,C |
| 1457 | `obv_15m_n10_trend_t0.75_long_fixed12h` | -990/183 | -515/181 | -165/43 | -148/43 | P,B,M,C |
| 1458 | `obv_240m_n20_recovery_t0.5_long_fixed12h` | -1,010/12 | -1,048/12 | 46/1 | 26/1 | N,P,B,M,C |
| 1459 | `obv_240m_n20_recovery_t0.5_long_indicator_or12h` | -1,010/12 | -1,048/12 | 46/1 | 26/1 | N,P,B,M,C |
| 1460 | `obv_30m_n40_recovery_t0.5_long_indicator_or12h` | -1,015/15 | -787/15 | -484/2 | -455/2 | N,P,B,M,C |
| 1461 | `cmf_5m_n10_into_t0.5_long_fixed12h` | -1,045/318 | -875/317 | -517/71 | -843/70 | P,B,M,C |
| 1462 | `mfi_30m_n14_into_t0.6_long_fixed12h` | -1,053/183 | -1,523/183 | 1,482/44 | 1,321/44 | P,B,M,C |
| 1463 | `mfi_60m_n14_recovery_t0.6_long_indicator_or12h` | -1,104/111 | -1,396/109 | -359/24 | -400/24 | P,B,M,C |
| 1464 | `obv_15m_n20_recovery_t0.75_long_fixed12h` | -1,109/23 | -1,282/23 | -228/2 | -230/2 | N,P,B,M,C |
| 1465 | `cmf_60m_n20_recovery_t0.05_long_indicator_or12h` | -1,140/384 | 468/351 | 1,044/97 | 971/86 | P,B,M,C |
| 1466 | `mfi_240m_n14_recovery_t0.6_long_indicator_or12h` | -1,142/30 | -465/26 | 377/5 | 798/4 | N,P,B,M,C |
| 1467 | `cmf_60m_n20_recovery_t0.2_long_fixed12h` | -1,187/106 | -640/105 | -1,955/22 | -2,069/22 | P,B,M,C |
| 1468 | `obv_60m_n40_recovery_t0.5_long_fixed12h` | -1,191/6 | -1,198/6 | 8/2 | 29/2 | N,P,B,M,C |
| 1469 | `obv_60m_n40_recovery_t0.5_long_indicator_or12h` | -1,199/6 | -1,208/6 | 0/2 | 19/2 | N,P,B,M,C |
| 1470 | `cmf_240m_n10_trend_t0_long_fixed12h` | -1,233/192 | -1,982/175 | -1,752/42 | -1,372/39 | P,B,M,C |
| 1471 | `obv_30m_n20_recovery_t0.75_long_fixed12h` | -1,236/12 | -1,043/12 | -593/1 | -565/1 | N,P,B,M,C |
| 1472 | `cmf_15m_n20_into_t0.2_long_indicator_or12h` | -1,253/432 | -3,072/432 | 2,479/110 | 1,851/110 | P,B,M,C |
| 1473 | `cmf_60m_n10_recovery_t0.5_long_fixed12h` | -1,265/12 | -1,286/12 | 0/0 | 0/0 | N,P,B,M,C |
| 1474 | `obv_240m_n10_trend_t0_long_indicator_or12h` | -1,267/196 | -1,418/196 | 2,035/49 | 1,997/49 | P,B,M,C |
| 1475 | `mfi_60m_n7_into_t0.9_long_fixed12h` | -1,279/80 | -869/78 | 1,668/19 | 1,703/19 | P,B,M,C |
| 1476 | `obv_15m_n20_into_t0.5_long_indicator_or12h` | -1,333/237 | -1,493/237 | 36/47 | -93/47 | P,B,M,C |
| 1477 | `obv_15m_n40_trend_t0.25_long_indicator_or12h` | -1,334/271 | -835/271 | 1,549/70 | 1,467/70 | P,B,M,C |
| 1478 | `cmf_60m_n40_recovery_t0.2_long_fixed12h` | -1,365/19 | -1,119/19 | 201/5 | 285/5 | N,P,B,M,C |
| 1479 | `mfi_5m_n7_trend_t0_short_fixed12h` | -26,988/810 | -22,030/804 | -9,705/207 | -9,579/205 | P,B,M,C |
| 1480 | `obv_5m_n20_trend_t0.75_long_indicator_or12h` | -1,439/64 | -1,255/64 | -300/19 | -411/19 | P,B,M,C |
| 1481 | `mfi_30m_n14_into_t0.6_long_indicator_or12h` | -1,455/187 | -1,985/187 | 982/44 | 822/44 | P,B,M,C |
| 1482 | `mfi_30m_n7_trend_t0.2_short_indicator_or12h` | -27,047/1132 | -24,724/1131 | -11,510/300 | -10,722/300 | P,B,M,C |
| 1483 | `cmf_240m_n40_trend_t0_long_indicator_or12h` | -1,471/95 | -1,152/95 | -1,048/15 | -964/15 | P,B,M,C |
| 1484 | `cmf_30m_n10_recovery_t0.5_long_fixed12h` | -1,544/41 | -1,606/41 | 102/8 | 61/8 | N,P,B,M,C |
| 1485 | `cmf_240m_n20_into_t0.05_long_indicator_or12h` | -1,604/112 | -3,286/108 | -1,357/28 | -2,224/26 | P,B,M,C |
| 1486 | `obv_240m_n40_trend_t0.25_long_fixed12h` | -1,610/38 | -1,770/36 | -2,376/13 | -2,459/13 | P,B,M,C |
| 1487 | `obv_240m_n40_trend_t0.25_long_indicator_or12h` | -1,610/38 | -1,770/36 | -2,376/13 | -2,459/13 | P,B,M,C |
| 1488 | `obv_240m_n10_trend_t0.5_long_fixed12h` | -1,633/66 | -1,342/62 | 42/22 | 142/22 | P,B,M,C |
| 1489 | `mfi_60m_n28_into_t0.6_long_fixed12h` | -1,660/17 | -1,572/17 | -368/5 | -392/5 | N,P,B,M,C |
| 1490 | `mfi_60m_n28_into_t0.6_long_indicator_or12h` | -1,660/17 | -1,572/17 | -368/5 | -392/5 | N,P,B,M,C |
| 1491 | `obv_240m_n10_trend_t0.5_long_indicator_or12h` | -1,676/66 | -1,393/62 | 42/22 | 150/22 | P,B,M,C |
| 1492 | `cmf_30m_n40_recovery_t0.2_long_fixed12h` | -1,684/41 | -2,265/40 | -1,707/7 | -1,670/7 | N,P,B,M,C |
| 1493 | `cmf_5m_n20_trend_t0.5_long_indicator_or12h` | -1,714/92 | -1,513/92 | 430/18 | 232/18 | P,B,M,C |
| 1494 | `mfi_5m_n14_into_t0.8_long_indicator_or12h` | -1,730/432 | -2,514/432 | -111/101 | -133/101 | P,B,M,C |
| 1495 | `cmf_5m_n20_trend_t0.2_short_fixed12h` | -27,323/629 | -28,177/624 | -10,773/159 | -11,654/157 | P,B,M,C |
| 1496 | `obv_15m_n20_recovery_t0.5_long_indicator_or12h` | -1,800/238 | -1,554/238 | -84/47 | -79/47 | P,B,M,C |
| 1497 | `mfi_60m_n28_trend_t0.2_long_fixed12h` | -1,825/192 | 527/190 | 42/59 | 85/58 | P,B,M,C |
| 1498 | `mfi_15m_n14_trend_t0.2_long_fixed12h` | -1,835/622 | -3,355/609 | 4,862/155 | 3,648/154 | P,B,M,C |
| 1499 | `mfi_60m_n7_into_t0.8_long_fixed12h` | -1,878/152 | -1,942/148 | 493/36 | 557/36 | P,B,M,C |
| 1500 | `mfi_30m_n14_recovery_t0.6_long_fixed12h` | -1,891/184 | -1,768/184 | 124/44 | 105/44 | P,B,M,C |
| 1501 | `cmf_15m_n10_trend_t0.2_long_fixed12h` | -1,913/617 | 62/611 | 2,667/153 | 2,538/150 | P,B,M,C |
| 1502 | `obv_240m_n10_recovery_t0.25_long_indicator_or12h` | -1,925/158 | -1,982/143 | -1,534/35 | -1,682/33 | P,B,M,C |
| 1503 | `cmf_30m_n40_into_t0.2_long_fixed12h` | -1,964/41 | -2,446/41 | -1,171/7 | -1,433/7 | N,P,B,M,C |
| 1504 | `cmf_30m_n20_trend_t0.2_long_indicator_or12h` | -1,994/280 | -2,032/278 | -696/72 | -518/71 | P,B,M,C |
| 1505 | `obv_15m_n20_into_t0.25_long_fixed12h` | -2,009/501 | -1,668/499 | -860/121 | -993/120 | P,B,M,C |
| 1506 | `cmf_240m_n20_recovery_t0.2_long_fixed12h` | -2,010/40 | -1,196/39 | 1,068/7 | 1,089/7 | N,P,B,M,C |
| 1507 | `obv_5m_n20_into_t0.5_long_fixed12h` | -2,048/488 | -1,611/488 | 4,418/120 | 4,652/120 | P,B,M,C |
| 1508 | `cmf_60m_n40_recovery_t0.05_long_fixed12h` | -2,086/206 | -1,744/195 | 742/46 | 1,005/42 | P,B,M,C |
| 1509 | `mfi_30m_n7_recovery_t0.6_long_fixed12h` | -2,088/452 | -192/440 | 1,354/110 | 2,600/108 | P,B,M,C |
| 1510 | `cmf_30m_n10_into_t0.2_long_indicator_or12h` | -2,095/542 | -3,143/542 | 1,927/123 | 1,568/123 | P,B,M,C |
| 1511 | `mfi_60m_n28_recovery_t0.6_long_fixed12h` | -2,097/17 | -2,124/16 | -92/5 | -160/5 | N,P,B,M,C |
| 1512 | `mfi_60m_n28_recovery_t0.6_long_indicator_or12h` | -2,097/17 | -2,124/16 | -92/5 | -160/5 | N,P,B,M,C |
| 1513 | `obv_15m_n40_trend_t0.25_long_fixed12h` | -2,117/263 | -1,628/263 | 836/68 | 763/68 | P,B,M,C |
| 1514 | `obv_5m_n20_recovery_t0.5_long_fixed12h` | -2,135/494 | -2,895/493 | 4,620/124 | 4,848/124 | P,B,M,C |
| 1515 | `cmf_30m_n40_recovery_t0.2_long_indicator_or12h` | -2,138/41 | -3,068/40 | -1,349/7 | -1,325/7 | N,P,B,M,C |
| 1516 | `cmf_15m_n40_recovery_t0.05_long_indicator_or12h` | -2,154/690 | -1,884/643 | 981/162 | 914/150 | P,B,M,C |
| 1517 | `obv_30m_n40_recovery_t0.25_long_indicator_or12h` | -2,159/196 | -4,275/190 | -1,407/41 | -1,409/41 | P,B,M,C |
| 1518 | `cmf_15m_n10_trend_t0.5_long_fixed12h` | -2,163/141 | -1,652/141 | -85/38 | -90/38 | P,B,M,C |
| 1519 | `mfi_15m_n7_recovery_t0.8_long_indicator_or12h` | -2,185/682 | -3,151/680 | -937/162 | -1,110/161 | P,B,M,C |
| 1520 | `cmf_30m_n10_trend_t0.2_long_fixed12h` | -2,228/486 | -1,330/477 | -435/127 | -50/126 | P,B,M,C |
| 1521 | `obv_30m_n10_into_t0.5_long_indicator_or12h` | -2,228/391 | -3,205/390 | 1,810/91 | 1,630/90 | P,B,M,C |
| 1522 | `cmf_30m_n20_recovery_t0.05_long_indicator_or12h` | -2,320/722 | 354/638 | -514/174 | -550/152 | P,B,M,C |
| 1523 | `cmf_240m_n10_recovery_t0.05_long_fixed12h` | -2,330/169 | -174/157 | 485/42 | 841/41 | P,B,M,C |
| 1524 | `cmf_15m_n40_into_t0.2_long_indicator_or12h` | -2,336/115 | -2,404/115 | 1,905/26 | 1,699/26 | P,B,M,C |
| 1525 | `cmf_240m_n20_recovery_t0.05_long_indicator_or12h` | -2,342/119 | -2,059/107 | -371/27 | -890/24 | P,B,M,C |
| 1526 | `cmf_15m_n10_into_t0.5_long_fixed12h` | -2,349/91 | -2,689/90 | 1,403/19 | 1,159/18 | P,B,M,C |
| 1527 | `mfi_60m_n7_recovery_t0.9_long_fixed12h` | -2,390/78 | -2,387/78 | 393/18 | 403/18 | P,B,M,C |
| 1528 | `cmf_60m_n40_recovery_t0.2_long_indicator_or12h` | -2,395/20 | -1,841/19 | 201/5 | 287/5 | N,P,B,M,C |
| 1529 | `mfi_30m_n14_trend_t0.6_long_fixed12h` | -2,409/180 | -2,018/180 | -641/45 | -165/45 | P,B,M,C |
| 1530 | `cmf_240m_n40_trend_t0.05_long_fixed12h` | -2,427/86 | -1,762/84 | 2,199/20 | 2,068/20 | P,B,M,C |
| 1531 | `obv_15m_n20_recovery_t0.25_long_indicator_or12h` | -2,435/688 | -2,852/677 | 96/173 | -161/171 | P,B,M,C |
| 1532 | `cmf_15m_n20_trend_t0_long_fixed12h` | -2,452/624 | -693/615 | 5,705/157 | 7,553/153 | P,B,M,C |
| 1533 | `mfi_15m_n7_trend_t0_long_fixed12h` | -2,461/725 | -3,882/713 | 6,098/182 | 5,545/181 | P,B,M,C |
| 1534 | `cmf_240m_n20_recovery_t0.2_long_indicator_or12h` | -2,481/40 | -1,581/39 | 1,108/7 | 1,181/7 | N,P,B,M,C |
| 1535 | `mfi_15m_n14_trend_t0.2_short_indicator_or12h` | -28,068/1177 | -27,309/1177 | -10,021/305 | -9,677/305 | P,B,M,C |
| 1536 | `obv_5m_n20_trend_t0_short_fixed12h` | -28,078/764 | -27,444/757 | -12,001/193 | -10,848/192 | P,B,M,C |
| 1537 | `obv_60m_n40_trend_t0_long_indicator_or12h` | -2,510/375 | -1,737/375 | -276/91 | 47/91 | P,B,M,C |
| 1538 | `cmf_30m_n10_trend_t0.05_long_fixed12h` | -2,516/610 | -1,813/585 | 345/159 | -360/155 | P,B,M,C |
| 1539 | `mfi_30m_n28_trend_t0.2_long_indicator_or12h` | -2,519/336 | -2,818/336 | 1,991/91 | 1,559/91 | P,B,M,C |
| 1540 | `cmf_5m_n40_recovery_t0.2_long_indicator_or12h` | -2,528/441 | -3,818/437 | -2,101/94 | -2,297/93 | P,B,M,C |
| 1541 | `cmf_5m_n10_recovery_t0.5_long_indicator_or12h` | -2,554/469 | -3,600/468 | 55/97 | -167/97 | P,B,M,C |
| 1542 | `obv_30m_n10_trend_t0.25_long_fixed12h` | -2,572/532 | -3,260/518 | -407/140 | -465/138 | P,B,M,C |
| 1543 | `cmf_240m_n40_trend_t0.05_long_indicator_or12h` | -2,609/86 | -1,917/84 | 2,199/20 | 2,068/20 | P,B,M,C |
| 1544 | `cmf_5m_n40_into_t0.2_long_indicator_or12h` | -2,677/437 | -2,905/437 | -1,681/93 | -1,732/93 | P,B,M,C |
| 1545 | `mfi_5m_n7_trend_t0.6_long_fixed12h` | -2,728/755 | -253/752 | 5,369/190 | 5,817/189 | P,B,M,C |
| 1546 | `mfi_15m_n7_recovery_t0.6_long_indicator_or12h` | -2,748/1222 | -5,043/1216 | -2,636/308 | -3,326/305 | P,B,M,C |
| 1547 | `cmf_240m_n20_into_t0.05_long_fixed12h` | -2,765/111 | -4,438/107 | -1,810/28 | -2,684/26 | P,B,M,C |
| 1548 | `cmf_60m_n10_trend_t0_long_fixed12h` | -2,765/467 | -1,658/447 | 3,146/115 | 2,672/108 | P,B,M,C |
| 1549 | `obv_15m_n40_trend_t0_short_indicator_or12h` | -28,354/1484 | -27,036/1484 | -5,792/366 | -5,349/366 | P,B,M,C |
| 1550 | `cmf_30m_n40_trend_t0.05_long_indicator_or12h` | -2,771/432 | -586/429 | -436/108 | 211/107 | P,B,M,C |
| 1551 | `cmf_240m_n10_into_t0.05_long_fixed12h` | -2,775/172 | -3,381/162 | -954/44 | -914/41 | P,B,M,C |
| 1552 | `obv_15m_n20_recovery_t0.25_long_fixed12h` | -2,779/498 | -4,850/494 | -1,747/119 | -1,604/118 | P,B,M,C |
| 1553 | `mfi_5m_n7_recovery_t0.8_long_fixed12h` | -2,806/664 | -1,907/661 | 5,142/172 | 4,072/171 | P,B,M,C |
| 1554 | `cmf_15m_n10_recovery_t0.5_long_fixed12h` | -2,832/92 | -3,842/90 | 477/19 | -67/18 | P,B,M,C |
| 1555 | `cmf_15m_n20_trend_t0.2_long_indicator_or12h` | -2,850/529 | -1,099/529 | 1,052/138 | 1,547/138 | P,B,M,C |
| 1556 | `obv_240m_n10_recovery_t0.5_long_fixed12h` | -2,863/67 | -4,571/63 | -497/14 | -1,103/12 | P,B,M,C |
| 1557 | `mfi_30m_n14_recovery_t0.6_long_indicator_or12h` | -2,866/187 | -2,775/187 | -198/44 | -334/44 | P,B,M,C |
| 1558 | `cmf_240m_n10_recovery_t0.05_long_indicator_or12h` | -2,973/179 | -1,762/159 | -1,681/46 | -1,173/41 | P,B,M,C |
| 1559 | `mfi_60m_n7_recovery_t0.8_long_indicator_or12h` | -3,027/155 | -3,677/152 | -1,277/37 | -1,441/36 | P,B,M,C |
| 1560 | `cmf_30m_n20_trend_t0_long_fixed12h` | -3,052/510 | -1,598/502 | 1,753/124 | 2,754/122 | P,B,M,C |
| 1561 | `mfi_30m_n7_trend_t0.8_long_indicator_or12h` | -3,064/316 | -2,284/316 | -2,263/84 | -2,448/84 | P,B,M,C |
| 1562 | `obv_30m_n10_into_t0.25_long_fixed12h` | -3,081/539 | -5,143/521 | 3,977/139 | 4,030/132 | P,B,M,C |
| 1563 | `cmf_30m_n10_trend_t0.2_long_indicator_or12h` | -3,083/638 | -1,592/636 | -716/165 | 125/164 | P,B,M,C |
| 1564 | `obv_5m_n10_recovery_t0.5_long_fixed12h` | -3,085/714 | -2,924/712 | 4,658/186 | 3,504/184 | P,B,M,C |
| 1565 | `cmf_30m_n40_into_t0.2_long_indicator_or12h` | -3,087/41 | -3,469/41 | -827/7 | -1,114/7 | N,P,B,M,C |
| 1566 | `cmf_60m_n20_trend_t0.05_long_indicator_or12h` | -3,168/405 | -2,026/401 | 573/92 | 492/91 | P,B,M,C |
| 1567 | `cmf_240m_n10_recovery_t0.2_long_indicator_or12h` | -3,170/112 | -3,088/103 | -548/28 | -1,449/25 | P,B,M,C |
| 1568 | `cmf_15m_n10_trend_t0.5_long_indicator_or12h` | -3,174/166 | -2,561/166 | 1,173/43 | 1,022/43 | P,B,M,C |
| 1569 | `cmf_30m_n10_recovery_t0.2_long_indicator_or12h` | -3,184/560 | -4,338/539 | 2,432/127 | 2,211/123 | P,B,M,C |
| 1570 | `obv_60m_n20_trend_t0.25_long_indicator_or12h` | -3,319/213 | -3,379/210 | 1,452/57 | 1,248/57 | P,B,M,C |
| 1571 | `obv_30m_n10_trend_t0.5_long_fixed12h` | -3,365/332 | -1,875/329 | -2,995/90 | -2,604/90 | P,B,M,C |
| 1572 | `cmf_15m_n10_trend_t0.2_short_indicator_or12h` | -29,047/1175 | -26,161/1175 | -5,128/295 | -4,611/295 | P,B,M,C |
| 1573 | `obv_5m_n20_trend_t0.5_long_fixed12h` | -3,484/455 | -2,882/453 | 1,616/120 | 1,886/119 | P,B,M,C |
| 1574 | `obv_30m_n10_trend_t0_long_fixed12h` | -3,509/595 | -4,479/571 | 4,938/153 | 5,138/148 | P,B,M,C |
| 1575 | `cmf_60m_n20_trend_t0.05_long_fixed12h` | -3,519/339 | -5,527/328 | 883/78 | -114/73 | P,B,M,C |
| 1576 | `obv_240m_n10_recovery_t0.5_long_indicator_or12h` | -3,548/67 | -4,819/63 | -73/14 | -701/12 | P,B,M,C |
| 1577 | `mfi_5m_n14_recovery_t0.8_long_indicator_or12h` | -3,597/433 | -3,744/433 | -336/101 | -215/101 | P,B,M,C |
| 1578 | `obv_30m_n20_trend_t0.25_long_fixed12h` | -3,617/352 | -3,955/345 | 718/93 | 1,050/89 | P,B,M,C |
| 1579 | `cmf_60m_n10_trend_t0.05_long_fixed12h` | -3,751/477 | -2,783/457 | 2,462/121 | 1,399/117 | P,B,M,C |
| 1580 | `obv_15m_n20_into_t0.25_long_indicator_or12h` | -3,807/685 | -3,716/683 | 1,445/174 | 844/174 | P,B,M,C |
| 1581 | `cmf_60m_n20_recovery_t0.2_long_indicator_or12h` | -3,812/107 | -3,206/105 | -741/22 | -704/22 | P,B,M,C |
| 1582 | `obv_30m_n10_recovery_t0.5_long_indicator_or12h` | -3,867/391 | -4,353/388 | -450/91 | -972/90 | P,B,M,C |
| 1583 | `obv_30m_n20_trend_t0_long_fixed12h` | -3,875/498 | -3,378/488 | -2,407/126 | -1,141/124 | P,B,M,C |
| 1584 | `obv_5m_n40_recovery_t0.25_long_indicator_or12h` | -3,901/891 | -3,505/885 | 1,276/228 | 1,261/226 | P,B,M,C |
| 1585 | `cmf_240m_n10_recovery_t0.2_long_fixed12h` | -3,911/112 | -3,297/103 | -1,004/28 | -1,520/25 | P,B,M,C |
| 1586 | `obv_15m_n10_trend_t0.75_long_indicator_or12h` | -3,926/207 | -3,001/207 | 150/48 | 307/48 | P,B,M,C |
| 1587 | `cmf_5m_n20_trend_t0.5_long_fixed12h` | -3,957/84 | -3,999/84 | 89/17 | -163/17 | P,B,M,C |
| 1588 | `obv_5m_n20_into_t0.25_long_indicator_or12h` | -3,965/2155 | -6,427/2155 | -1,512/542 | -951/542 | P,B,M,C |
| 1589 | `mfi_30m_n7_trend_t0_long_fixed12h` | -3,987/622 | -4,859/606 | 2,565/160 | 3,104/154 | P,B,M,C |
| 1590 | `cmf_15m_n20_into_t0.05_long_indicator_or12h` | -3,999/1296 | -7,112/1293 | -758/323 | -1,925/321 | P,B,M,C |
| 1591 | `mfi_30m_n14_trend_t0_long_fixed12h` | -4,040/528 | 455/511 | 6,616/133 | 7,173/129 | P,B,M,C |
| 1592 | `obv_240m_n20_recovery_t0.25_long_fixed12h` | -4,077/90 | -4,062/87 | -994/16 | -861/16 | P,B,M,C |
| 1593 | `obv_15m_n10_recovery_t0.5_long_indicator_or12h` | -4,082/811 | -5,287/807 | -1,015/194 | -1,617/192 | P,B,M,C |
| 1594 | `cmf_30m_n20_trend_t0.2_long_fixed12h` | -4,093/274 | -3,900/271 | -1,107/70 | -708/69 | P,B,M,C |
| 1595 | `cmf_60m_n10_recovery_t0.05_long_indicator_or12h` | -4,100/648 | -2,542/549 | -1,880/155 | -579/130 | P,B,M,C |
| 1596 | `mfi_60m_n7_recovery_t0.8_long_fixed12h` | -4,122/150 | -4,581/147 | -1,451/35 | -1,539/34 | P,B,M,C |
| 1597 | `cmf_60m_n40_trend_t0_long_fixed12h` | -4,207/243 | -4,815/237 | -112/64 | -368/63 | P,B,M,C |
| 1598 | `mfi_240m_n7_recovery_t0.6_long_fixed12h` | -4,294/91 | -3,760/87 | -674/20 | -521/20 | P,B,M,C |
| 1599 | `cmf_5m_n10_trend_t0.2_short_fixed12h` | -29,913/758 | -29,901/755 | -12,299/196 | -11,755/194 | P,B,M,C |
| 1600 | `cmf_5m_n10_into_t0.5_long_indicator_or12h` | -4,332/468 | -4,431/468 | -75/97 | -183/97 | P,B,M,C |
| 1601 | `obv_60m_n10_trend_t0.25_long_fixed12h` | -4,414/386 | -3,552/365 | 2,218/105 | 2,503/98 | P,B,M,C |
| 1602 | `obv_30m_n10_trend_t0.25_long_indicator_or12h` | -4,460/766 | -3,677/765 | -437/201 | -643/201 | P,B,M,C |
| 1603 | `cmf_15m_n40_trend_t0.2_long_indicator_or12h` | -4,480/218 | -4,439/218 | 193/55 | 188/55 | P,B,M,C |
| 1604 | `mfi_240m_n7_recovery_t0.6_long_indicator_or12h` | -4,497/91 | -4,200/87 | -556/20 | -421/20 | P,B,M,C |
| 1605 | `mfi_60m_n14_recovery_t0.6_long_fixed12h` | -4,504/111 | -4,643/109 | -1,777/24 | -1,692/24 | P,B,M,C |
| 1606 | `obv_5m_n40_into_t0.5_long_indicator_or12h` | -4,604/174 | -4,682/174 | -220/39 | -150/39 | P,B,M,C |
| 1607 | `cmf_5m_n40_into_t0.05_long_indicator_or12h` | -4,753/1896 | -8,876/1895 | 249/487 | -719/487 | P,B,M,C |
| 1608 | `cmf_60m_n40_trend_t0.05_long_fixed12h` | -4,763/223 | -3,608/219 | -1,628/59 | -1,764/58 | P,B,M,C |
| 1609 | `obv_30m_n10_into_t0.25_long_indicator_or12h` | -4,824/776 | -6,764/772 | 3,833/204 | 3,052/201 | P,B,M,C |
| 1610 | `mfi_15m_n7_into_t0.6_long_fixed12h` | -4,835/586 | -6,373/578 | 4,054/148 | 3,766/147 | P,B,M,C |
| 1611 | `mfi_5m_n14_trend_t0.8_long_indicator_or12h` | -4,874/366 | -4,253/366 | -1,216/104 | -1,365/104 | P,B,M,C |
| 1612 | `mfi_15m_n14_trend_t0.6_long_indicator_or12h` | -4,890/390 | -3,501/390 | -1,172/97 | -652/97 | P,B,M,C |
| 1613 | `obv_240m_n20_recovery_t0.25_long_indicator_or12h` | -5,023/90 | -5,646/87 | -1,139/16 | -1,027/16 | P,B,M,C |
| 1614 | `cmf_60m_n20_into_t0.05_long_indicator_or12h` | -5,071/371 | -3,527/366 | -75/90 | 180/89 | P,B,M,C |
| 1615 | `cmf_30m_n20_recovery_t0.2_long_fixed12h` | -5,151/193 | -4,674/192 | -442/40 | -445/40 | P,B,M,C |
| 1616 | `obv_15m_n10_trend_t0.25_long_fixed12h` | -5,227/657 | -7,591/645 | 2,440/166 | 1,833/162 | P,B,M,C |
| 1617 | `obv_30m_n40_trend_t0_long_fixed12h` | -5,267/343 | -4,531/334 | -2,568/92 | -2,455/90 | P,B,M,C |
| 1618 | `mfi_60m_n7_trend_t0_long_fixed12h` | -5,302/481 | -2,903/461 | 3,652/115 | 3,444/110 | P,B,M,C |
| 1619 | `mfi_15m_n7_trend_t0.6_short_indicator_or12h` | -30,915/1215 | -29,203/1215 | -8,159/305 | -7,649/305 | P,B,M,C |
| 1620 | `cmf_5m_n40_into_t0.2_long_fixed12h` | -5,328/334 | -4,979/333 | -1,981/76 | -2,084/76 | P,B,M,C |
| 1621 | `mfi_30m_n14_trend_t0.2_long_fixed12h` | -5,393/476 | -5,058/460 | 1,182/124 | 436/121 | P,B,M,C |
| 1622 | `mfi_30m_n7_trend_t0.8_long_fixed12h` | -5,404/280 | -5,388/277 | -3,592/73 | -3,571/72 | P,B,M,C |
| 1623 | `mfi_60m_n14_trend_t0_long_indicator_or12h` | -5,455/546 | -6,150/546 | 1,938/130 | 1,601/130 | P,B,M,C |
| 1624 | `mfi_15m_n28_trend_t0_long_fixed12h` | -5,487/553 | -3,798/544 | 860/138 | 1,159/136 | P,B,M,C |
| 1625 | `obv_5m_n10_trend_t0.5_long_fixed12h` | -5,608/710 | -4,567/705 | 3,110/179 | 1,948/179 | P,B,M,C |
| 1626 | `obv_5m_n40_recovery_t0.5_long_indicator_or12h` | -5,645/175 | -5,252/174 | -89/39 | 57/39 | P,B,M,C |
| 1627 | `obv_5m_n20_recovery_t0.5_long_indicator_or12h` | -5,703/860 | -6,748/857 | -2,927/207 | -3,142/206 | P,B,M,C |
| 1628 | `mfi_5m_n28_trend_t0.6_long_indicator_or12h` | -5,731/297 | -5,744/296 | -1,389/79 | -2,046/78 | P,B,M,C |
| 1629 | `cmf_60m_n10_recovery_t0.05_long_fixed12h` | -5,749/445 | -6,290/420 | 702/112 | 358/102 | P,B,M,C |
| 1630 | `mfi_60m_n7_trend_t0.2_long_fixed12h` | -5,764/473 | -5,866/449 | 1,689/117 | 1,585/109 | P,B,M,C |
| 1631 | `mfi_15m_n7_recovery_t0.6_long_fixed12h` | -5,784/587 | -3,941/581 | 3,548/146 | 4,136/145 | P,B,M,C |
| 1632 | `cmf_30m_n10_recovery_t0.05_long_indicator_or12h` | -5,898/1268 | -4,575/1064 | 811/325 | 453/279 | P,B,M,C |
| 1633 | `cmf_15m_n10_recovery_t0.2_long_indicator_or12h` | -5,937/1203 | -7,431/1167 | -5,165/307 | -5,151/294 | P,B,M,C |
| 1634 | `obv_60m_n10_trend_t0.25_long_indicator_or12h` | -5,957/419 | -5,169/414 | 1,309/115 | 1,571/112 | P,B,M,C |
| 1635 | `obv_5m_n10_trend_t0.75_long_fixed12h` | -5,984/447 | -7,048/443 | 2,851/113 | 1,736/112 | P,B,M,C |
| 1636 | `cmf_5m_n40_trend_t0.2_long_fixed12h` | -6,048/438 | -5,479/435 | -362/109 | 81/109 | P,B,M,C |
| 1637 | `cmf_60m_n40_trend_t0_long_indicator_or12h` | -6,083/411 | -5,774/411 | 969/100 | 1,186/100 | P,B,M,C |
| 1638 | `obv_30m_n10_recovery_t0.25_long_indicator_or12h` | -6,219/811 | -7,408/772 | -867/212 | -1,437/200 | P,B,M,C |
| 1639 | `mfi_30m_n7_trend_t0.6_long_fixed12h` | -6,397/456 | -4,038/444 | -4/116 | 647/112 | P,B,M,C |
| 1640 | `obv_60m_n10_trend_t0.5_long_fixed12h` | -6,569/208 | -6,915/204 | -1,528/64 | -1,457/64 | P,B,M,C |
| 1641 | `cmf_30m_n10_into_t0.05_long_indicator_or12h` | -6,675/1194 | -7,543/1193 | 829/305 | 457/305 | P,B,M,C |
| 1642 | `cmf_15m_n20_trend_t0.2_long_fixed12h` | -6,782/432 | -5,791/430 | 475/111 | 854/111 | P,B,M,C |
| 1643 | `cmf_30m_n40_trend_t0_long_indicator_or12h` | -6,853/799 | -5,347/799 | -2,643/213 | -2,575/213 | P,B,M,C |
| 1644 | `cmf_15m_n40_trend_t0.05_long_indicator_or12h` | -6,864/763 | -5,755/753 | 853/203 | 1,204/203 | P,B,M,C |
| 1645 | `obv_30m_n20_trend_t0.25_long_indicator_or12h` | -6,961/378 | -7,567/375 | 1,251/101 | 839/100 | P,B,M,C |
| 1646 | `cmf_15m_n40_trend_t0.2_long_fixed12h` | -7,042/215 | -7,251/215 | -514/54 | -388/54 | P,B,M,C |
| 1647 | `mfi_30m_n7_recovery_t0.6_long_indicator_or12h` | -7,177/596 | -7,092/596 | -1,324/137 | -1,304/137 | P,B,M,C |
| 1648 | `cmf_60m_n10_trend_t0.2_long_indicator_or12h` | -7,231/376 | -7,115/367 | 2,177/102 | 2,363/101 | P,B,M,C |
| 1649 | `mfi_15m_n7_trend_t0.6_long_fixed12h` | -7,284/593 | -6,242/586 | 2,199/150 | 3,070/149 | P,B,M,C |
| 1650 | `obv_60m_n10_trend_t0.5_long_indicator_or12h` | -7,285/209 | -7,180/207 | -1,011/65 | -994/65 | P,B,M,C |
| 1651 | `mfi_60m_n7_trend_t0.2_long_indicator_or12h` | -7,307/582 | -6,879/577 | 192/148 | 631/145 | P,B,M,C |
| 1652 | `cmf_15m_n10_into_t0.05_long_indicator_or12h` | -7,310/2386 | -12,488/2386 | -3,237/604 | -4,950/604 | P,B,M,C |
| 1653 | `cmf_30m_n20_trend_t0.05_long_indicator_or12h` | -7,392/744 | -5,832/741 | -346/185 | 319/184 | P,B,M,C |
| 1654 | `cmf_15m_n40_into_t0.05_long_indicator_or12h` | -7,409/647 | -7,926/646 | 1,365/154 | 602/153 | P,B,M,C |
| 1655 | `cmf_5m_n20_into_t0.05_short_indicator_or12h` | -33,007/3915 | -37,078/3915 | -9,953/1043 | -10,905/1043 | P,B,M,C,X |
| 1656 | `obv_15m_n40_trend_t0_long_fixed12h` | -7,431/514 | -5,869/507 | 402/125 | -36/124 | P,B,M,C |
| 1657 | `mfi_30m_n7_trend_t0_short_indicator_or12h` | -33,110/1528 | -31,568/1528 | -13,465/406 | -12,956/406 | P,B,M,C,X |
| 1658 | `mfi_30m_n28_trend_t0_long_indicator_or12h` | -7,574/761 | -7,949/761 | 2,272/191 | 1,704/191 | P,B,M,C |
| 1659 | `obv_5m_n40_trend_t0.25_long_fixed12h` | -7,814/531 | -7,307/531 | -17/137 | -385/137 | P,B,M,C |
| 1660 | `mfi_5m_n7_trend_t0.8_short_indicator_or12h` | -33,452/2222 | -32,586/2222 | -11,580/559 | -12,634/559 | P,B,M,C,X |
| 1661 | `mfi_15m_n14_trend_t0_long_fixed12h` | -7,987/654 | -7,958/644 | 2,504/163 | 3,106/161 | P,B,M,C |
| 1662 | `cmf_5m_n20_recovery_t0.2_long_indicator_or12h` | -8,162/1527 | -9,380/1508 | -3,254/375 | -3,391/372 | P,B,M,C |
| 1663 | `mfi_5m_n7_into_t0.9_long_indicator_or12h` | -8,185/1267 | -10,871/1267 | 471/314 | 81/314 | P,B,M,C |
| 1664 | `mfi_30m_n28_trend_t0.2_long_fixed12h` | -8,226/304 | -7,670/303 | 849/82 | 638/82 | P,B,M,C |
| 1665 | `cmf_60m_n10_trend_t0.05_long_indicator_or12h` | -8,315/660 | -7,372/655 | 2,600/163 | 3,024/163 | P,B,M,C |
| 1666 | `obv_30m_n40_trend_t0_long_indicator_or12h` | -8,324/715 | -7,195/715 | -837/203 | -1,296/203 | P,B,M,C |
| 1667 | `cmf_5m_n10_trend_t0.2_long_fixed12h` | -8,328/767 | -9,064/765 | 3,148/196 | 3,094/194 | P,B,M,C |
| 1668 | `mfi_5m_n28_trend_t0_long_fixed12h` | -8,429/719 | -8,692/715 | -163/181 | -622/180 | P,B,M,C |
| 1669 | `cmf_5m_n20_trend_t0.2_short_indicator_or12h` | -34,102/1507 | -33,432/1507 | -7,699/372 | -7,721/372 | P,B,M,C,X |
| 1670 | `cmf_15m_n10_recovery_t0.05_short_indicator_or12h` | -34,144/2639 | -27,908/2176 | -9,989/668 | -10,507/553 | P,B,M,C,X |
| 1671 | `mfi_15m_n28_trend_t0.2_long_fixed12h` | -8,561/474 | -7,845/469 | 1,371/122 | 1,413/122 | P,B,M,C |
| 1672 | `obv_5m_n20_recovery_t0.25_long_indicator_or12h` | -8,660/2191 | -11,054/2155 | -633/551 | -1,094/542 | P,B,M,C |
| 1673 | `obv_5m_n10_into_t0.75_long_indicator_or12h` | -8,828/902 | -8,415/902 | -1,257/217 | -688/217 | P,B,M,C |
| 1674 | `cmf_5m_n40_recovery_t0.2_long_fixed12h` | -8,925/332 | -10,054/331 | -2,499/76 | -3,105/75 | P,B,M,C |
| 1675 | `cmf_15m_n40_trend_t0.05_long_fixed12h` | -8,994/508 | -8,105/501 | -1,362/130 | -184/127 | P,B,M,C |
| 1676 | `obv_15m_n20_trend_t0_long_fixed12h` | -9,022/629 | -10,728/623 | 152/157 | -504/155 | P,B,M,C |
| 1677 | `mfi_5m_n14_into_t0.6_long_indicator_or12h` | -9,345/1399 | -12,088/1399 | -650/343 | -1,222/343 | P,B,M,C |
| 1678 | `mfi_60m_n7_trend_t0_long_indicator_or12h` | -9,759/766 | -8,458/766 | 595/181 | 931/181 | P,B,M,C |
| 1679 | `cmf_60m_n10_trend_t0_long_indicator_or12h` | -9,845/789 | -8,454/789 | 1,097/191 | 1,484/191 | P,B,M,C |
| 1680 | `mfi_15m_n28_trend_t0.2_long_indicator_or12h` | -9,929/599 | -9,739/598 | 161/153 | 311/153 | P,B,M,C |
| 1681 | `cmf_30m_n10_trend_t0.05_long_indicator_or12h` | -10,013/1244 | -8,210/1242 | -3,650/328 | -2,725/327 | P,B,M,C |
| 1682 | `obv_15m_n20_trend_t0.25_long_fixed12h` | -10,138/500 | -10,070/497 | 568/129 | 712/128 | P,B,M,C |
| 1683 | `obv_15m_n10_recovery_t0.25_long_indicator_or12h` | -10,381/1610 | -9,540/1507 | -1,398/395 | -1,779/369 | P,B,M,C |
| 1684 | `obv_60m_n10_trend_t0_long_fixed12h` | -10,421/484 | -9,123/458 | 222/119 | -69/116 | P,B,M,C |
| 1685 | `obv_5m_n10_recovery_t0.75_long_indicator_or12h` | -10,645/903 | -10,309/903 | -1,687/217 | -1,244/217 | P,B,M,C |
| 1686 | `cmf_60m_n10_trend_t0.2_long_fixed12h` | -10,939/358 | -9,709/344 | -1,507/97 | -1,169/95 | P,B,M,C |
| 1687 | `mfi_15m_n7_trend_t0.8_long_indicator_or12h` | -11,038/662 | -9,357/661 | -2,818/176 | -2,670/175 | P,B,M,C |
| 1688 | `obv_15m_n10_trend_t0.25_short_indicator_or12h` | -36,735/1525 | -34,052/1525 | -10,198/373 | -9,884/373 | P,B,M,C,X |
| 1689 | `mfi_30m_n7_trend_t0.6_long_indicator_or12h` | -11,169/595 | -10,066/595 | -4,377/161 | -4,171/161 | P,B,M,C |
| 1690 | `obv_15m_n20_trend_t0_short_indicator_or12h` | -36,793/2112 | -36,839/2112 | -11,499/538 | -11,147/538 | P,B,M,C,X |
| 1691 | `obv_5m_n40_trend_t0.25_long_indicator_or12h` | -11,303/842 | -9,259/842 | -1,212/219 | -817/219 | P,B,M,C |
| 1692 | `cmf_5m_n40_trend_t0.05_short_indicator_or12h` | -36,977/1896 | -32,827/1895 | -10,969/487 | -10,000/487 | P,B,M,C,X |
| 1693 | `cmf_5m_n10_into_t0.2_short_indicator_or12h` | -37,152/3862 | -41,374/3862 | -12,800/982 | -13,318/982 | P,B,M,C,X |
| 1694 | `obv_5m_n20_trend_t0.5_long_indicator_or12h` | -11,610/779 | -11,672/779 | -3,263/214 | -3,300/214 | P,B,M,C |
| 1695 | `obv_5m_n10_into_t0.25_short_indicator_or12h` | -37,200/4651 | -42,301/4651 | -10,803/1183 | -11,815/1183 | P,B,M,C,X |
| 1696 | `obv_15m_n20_trend_t0.25_long_indicator_or12h` | -11,804/683 | -11,623/683 | -1,611/174 | -1,301/174 | P,B,M,C |
| 1697 | `cmf_15m_n20_recovery_t0.05_long_indicator_or12h` | -11,996/1435 | -10,086/1234 | -3,026/367 | -2,130/312 | P,B,M,C |
| 1698 | `mfi_30m_n14_trend_t0.2_long_indicator_or12h` | -12,588/618 | -11,998/614 | -1,446/160 | -1,345/160 | P,B,M,C |
| 1699 | `cmf_15m_n20_trend_t0.05_long_indicator_or12h` | -12,766/1338 | -10,583/1336 | -1,239/358 | -284/357 | P,B,M,C |
| 1700 | `mfi_5m_n7_recovery_t0.9_long_indicator_or12h` | -12,994/1268 | -14,330/1268 | -1,123/314 | -965/314 | P,B,M,C |
| 1701 | `cmf_5m_n40_recovery_t0.05_long_indicator_or12h` | -13,374/2042 | -12,158/1877 | -3,906/520 | -3,933/479 | P,B,M,C |
| 1702 | `obv_15m_n10_trend_t0_long_fixed12h` | -13,375/707 | -8,948/697 | -1,933/178 | 691/177 | P,B,M,C |
| 1703 | `cmf_5m_n10_trend_t0.5_long_indicator_or12h` | -13,525/708 | -11,777/708 | -2,459/158 | -2,540/158 | P,B,M,C |
| 1704 | `cmf_30m_n10_trend_t0_long_indicator_or12h` | -13,594/1622 | -11,241/1622 | -2,369/421 | -1,562/421 | P,B,M,C |
| 1705 | `cmf_15m_n20_trend_t0_short_indicator_or12h` | -39,338/2217 | -35,757/2216 | -11,291/566 | -9,532/565 | P,B,M,C,X |
| 1706 | `cmf_15m_n40_trend_t0_long_indicator_or12h` | -13,996/1506 | -11,732/1506 | -2,540/407 | -1,855/407 | P,B,M,C |
| 1707 | `obv_30m_n20_trend_t0_long_indicator_or12h` | -14,275/1089 | -13,402/1089 | -2,499/270 | -2,359/270 | P,B,M,C |
| 1708 | `mfi_5m_n14_recovery_t0.6_long_indicator_or12h` | -14,331/1401 | -14,853/1399 | -2,470/344 | -2,833/343 | P,B,M,C |
| 1709 | `obv_30m_n10_trend_t0_long_indicator_or12h` | -14,508/1515 | -12,544/1515 | -4,217/397 | -3,759/397 | P,B,M,C |
| 1710 | `obv_5m_n10_trend_t0.75_long_indicator_or12h` | -14,561/812 | -13,777/812 | -4,929/211 | -4,349/211 | P,B,M,C |
| 1711 | `mfi_5m_n7_recovery_t0.6_short_indicator_or12h` | -40,392/3852 | -40,741/3824 | -11,696/964 | -11,112/958 | P,B,M,C,X |
| 1712 | `mfi_30m_n14_trend_t0_long_indicator_or12h` | -15,055/1085 | -13,847/1085 | -1,716/287 | -1,075/287 | P,B,M,C |
| 1713 | `obv_5m_n10_into_t0.5_long_indicator_or12h` | -15,439/2679 | -18,126/2679 | -2,077/664 | -2,322/664 | P,B,M,C |
| 1714 | `mfi_5m_n7_into_t0.8_long_indicator_or12h` | -15,442/2222 | -16,307/2222 | -723/559 | 329/559 | P,B,M,C |
| 1715 | `mfi_15m_n14_trend_t0_short_indicator_or12h` | -41,682/2095 | -37,915/2095 | -14,406/532 | -13,393/532 | P,B,M,C,X |
| 1716 | `cmf_30m_n20_trend_t0_long_indicator_or12h` | -16,386/1150 | -14,778/1149 | -3,185/299 | -2,964/298 | P,B,M,C |
| 1717 | `cmf_5m_n40_trend_t0.2_long_indicator_or12h` | -16,565/613 | -14,564/613 | -1,275/154 | -721/154 | P,B,M,C |
| 1718 | `mfi_5m_n28_trend_t0.2_short_indicator_or12h` | -42,222/1752 | -39,219/1752 | -9,868/441 | -9,157/441 | P,B,M,C,X |
| 1719 | `obv_15m_n10_trend_t0.5_long_indicator_or12h` | -16,664/817 | -15,082/817 | -3,377/212 | -2,992/212 | P,B,M,C |
| 1720 | `mfi_5m_n14_trend_t0.6_long_indicator_or12h` | -16,702/1295 | -14,576/1295 | -4,163/349 | -3,561/349 | P,B,M,C |
| 1721 | `obv_60m_n10_trend_t0_long_indicator_or12h` | -17,237/841 | -16,525/841 | -349/202 | -39/202 | P,B,M,C |
| 1722 | `cmf_5m_n10_recovery_t0.2_short_indicator_or12h` | -42,857/4029 | -43,517/3831 | -14,205/1019 | -13,026/973 | P,B,M,C,X |
| 1723 | `mfi_30m_n7_trend_t0.2_long_indicator_or12h` | -17,801/1138 | -15,848/1137 | -3,927/293 | -3,608/293 | P,B,M,C |
| 1724 | `obv_5m_n20_trend_t0.25_short_indicator_or12h` | -43,466/2155 | -41,002/2155 | -10,417/542 | -10,979/542 | P,B,M,C,X |
| 1725 | `obv_5m_n10_trend_t0.5_short_indicator_or12h` | -43,514/2679 | -40,825/2679 | -12,536/664 | -12,291/664 | P,B,M,C,X |
| 1726 | `mfi_15m_n28_trend_t0_long_indicator_or12h` | -18,423/1387 | -15,452/1387 | -2,102/365 | -1,257/365 | P,B,M,C |
| 1727 | `cmf_15m_n10_trend_t0.2_long_indicator_or12h` | -18,981/1259 | -15,752/1259 | -618/307 | 326/307 | P,B,M,C |
| 1728 | `cmf_15m_n10_trend_t0.05_short_indicator_or12h` | -45,224/2386 | -40,042/2386 | -10,077/604 | -8,362/604 | P,B,M,C,X |
| 1729 | `mfi_15m_n14_trend_t0.2_long_indicator_or12h` | -20,303/1199 | -18,071/1199 | -4,961/312 | -3,964/312 | P,B,M,C |
| 1730 | `mfi_30m_n7_trend_t0_long_indicator_or12h` | -20,908/1528 | -19,233/1528 | -5,807/405 | -5,356/405 | P,B,M,C |
| 1731 | `cmf_5m_n10_into_t0.2_long_indicator_or12h` | -21,837/3734 | -22,204/3734 | -3,740/949 | -3,589/949 | P,B,M,C |
| 1732 | `mfi_5m_n7_recovery_t0.8_long_indicator_or12h` | -21,981/2224 | -22,946/2223 | -3,335/559 | -3,072/559 | P,B,M,C |
| 1733 | `obv_15m_n40_trend_t0_long_indicator_or12h` | -22,465/1485 | -21,074/1485 | -2,083/366 | -1,617/366 | P,B,M,C |
| 1734 | `obv_15m_n10_trend_t0.25_long_indicator_or12h` | -23,630/1513 | -20,929/1513 | -2,281/387 | -1,382/387 | P,B,M,C |
| 1735 | `mfi_15m_n7_trend_t0.6_long_indicator_or12h` | -23,719/1227 | -21,549/1226 | -3,422/314 | -3,354/313 | P,B,M,C |
| 1736 | `mfi_5m_n28_trend_t0.2_long_indicator_or12h` | -23,811/1674 | -21,928/1673 | -1,438/423 | -1,802/422 | P,B,M,C |
| 1737 | `cmf_5m_n20_recovery_t0.05_short_indicator_or12h` | -49,696/4249 | -43,871/3670 | -14,487/1126 | -13,484/982 | P,B,M,C,X |
| 1738 | `mfi_15m_n7_trend_t0.2_short_indicator_or12h` | -50,541/2279 | -48,123/2279 | -13,493/563 | -13,155/563 | P,B,M,C,X |
| 1739 | `cmf_15m_n10_recovery_t0.05_long_indicator_or12h` | -25,677/2572 | -22,752/2120 | -7,212/661 | -7,215/530 | P,B,M,C |
| 1740 | `obv_5m_n10_recovery_t0.5_long_indicator_or12h` | -26,152/2703 | -27,908/2677 | -4,647/673 | -5,306/664 | P,B,M,C |
| 1741 | `cmf_15m_n20_trend_t0_long_indicator_or12h` | -26,565/2217 | -22,897/2217 | -2,810/565 | -1,190/565 | P,B,M,C |
| 1742 | `obv_5m_n10_recovery_t0.25_short_indicator_or12h` | -52,279/4866 | -49,914/4572 | -15,613/1246 | -14,562/1167 | P,B,M,C,X |
| 1743 | `obv_15m_n20_trend_t0_long_indicator_or12h` | -26,740/2113 | -26,471/2113 | -5,006/538 | -4,642/538 | P,B,M,C |
| 1744 | `cmf_5m_n40_trend_t0.05_long_indicator_or12h` | -26,885/1951 | -24,696/1951 | -3,406/510 | -2,842/510 | P,B,M,C |
| 1745 | `mfi_5m_n7_into_t0.6_long_indicator_or12h` | -26,911/3783 | -28,713/3783 | -2,336/965 | -2,468/965 | P,B,M,C |
| 1746 | `cmf_5m_n20_into_t0.05_long_indicator_or12h` | -26,975/3736 | -29,116/3736 | -6,106/960 | -6,727/960 | P,B,M,C |
| 1747 | `cmf_5m_n20_trend_t0.2_long_indicator_or12h` | -28,887/1690 | -25,196/1690 | -6,267/431 | -5,455/431 | P,B,M,C |
| 1748 | `cmf_5m_n20_trend_t0.05_short_indicator_or12h` | -55,254/3736 | -53,111/3736 | -15,041/960 | -14,419/960 | P,B,M,C,X |
| 1749 | `mfi_15m_n14_trend_t0_long_indicator_or12h` | -30,124/2095 | -26,428/2095 | -6,636/531 | -5,602/531 | P,B,M,C |
| 1750 | `cmf_15m_n10_trend_t0_short_indicator_or12h` | -56,019/3231 | -49,721/3231 | -13,133/823 | -11,142/823 | P,B,M,C,X |
| 1751 | `mfi_5m_n14_trend_t0.2_short_indicator_or12h` | -56,192/3530 | -54,009/3530 | -19,742/913 | -18,832/913 | P,B,M,C,X |
| 1752 | `mfi_5m_n7_trend_t0.6_short_indicator_or12h` | -56,331/3783 | -54,527/3783 | -18,903/965 | -18,771/965 | P,B,M,C,X |
| 1753 | `cmf_5m_n10_recovery_t0.2_long_indicator_or12h` | -31,003/3885 | -29,564/3704 | -5,800/989 | -5,449/943 | P,B,M,C |
| 1754 | `mfi_15m_n7_trend_t0_short_indicator_or12h` | -57,981/3016 | -55,469/3016 | -16,617/781 | -16,445/781 | P,B,M,C,X |
| 1755 | `obv_15m_n10_trend_t0_short_indicator_or12h` | -58,926/3125 | -55,137/3125 | -17,114/805 | -16,127/805 | P,B,M,C,X |
| 1756 | `mfi_5m_n7_recovery_t0.6_long_indicator_or12h` | -33,787/3801 | -35,947/3780 | -6,704/969 | -6,785/965 | P,B,M,C,X |
| 1757 | `cmf_15m_n10_trend_t0.05_long_indicator_or12h` | -34,069/2485 | -28,346/2485 | -3,866/634 | -1,819/634 | P,B,M,C,X |
| 1758 | `cmf_5m_n10_trend_t0.2_short_indicator_or12h` | -60,332/3734 | -59,965/3734 | -17,145/949 | -17,296/949 | P,B,M,C,X |
| 1759 | `obv_5m_n10_into_t0.25_long_indicator_or12h` | -35,021/4609 | -36,116/4609 | -6,013/1175 | -5,805/1175 | P,B,M,C,X |
| 1760 | `obv_5m_n40_trend_t0_short_indicator_or12h` | -61,704/4175 | -60,348/4175 | -16,341/1051 | -15,011/1051 | P,B,M,C,X |
| 1761 | `mfi_5m_n7_trend_t0.8_long_indicator_or12h` | -36,164/2190 | -31,818/2190 | -8,485/568 | -7,795/568 | P,B,M,C,X |
| 1762 | `mfi_15m_n7_trend_t0.2_long_indicator_or12h` | -37,715/2256 | -35,307/2255 | -7,991/585 | -7,401/584 | P,B,M,C,X |
| 1763 | `obv_5m_n20_trend_t0.25_long_indicator_or12h` | -38,443/2158 | -36,273/2158 | -9,318/552 | -8,744/552 | P,B,M,C,X |
| 1764 | `cmf_5m_n40_trend_t0_short_indicator_or12h` | -65,437/4217 | -61,607/4217 | -17,473/1089 | -16,549/1089 | P,B,M,C,X |
| 1765 | `obv_5m_n10_trend_t0.25_short_indicator_or12h` | -66,394/4609 | -65,298/4609 | -19,845/1175 | -20,053/1175 | P,B,M,C,X |
| 1766 | `mfi_5m_n28_trend_t0_short_indicator_or12h` | -68,136/4221 | -63,732/4221 | -15,254/1072 | -15,019/1072 | P,B,M,C,X |
| 1767 | `cmf_5m_n20_recovery_t0.05_long_indicator_or12h` | -42,555/4079 | -37,989/3551 | -8,099/1045 | -7,543/920 | P,B,M,C,X |
| 1768 | `cmf_15m_n10_trend_t0_long_indicator_or12h` | -42,983/3232 | -36,772/3232 | -5,713/823 | -3,803/823 | P,B,M,C,X |
| 1769 | `obv_5m_n10_trend_t0.5_long_indicator_or12h` | -43,710/2644 | -40,195/2644 | -8,873/652 | -7,661/652 | P,B,M,C,X |
| 1770 | `obv_5m_n10_recovery_t0.25_long_indicator_or12h` | -43,757/4841 | -40,598/4533 | -11,053/1243 | -10,760/1155 | P,B,M,C,X |
| 1771 | `cmf_5m_n10_into_t0.05_short_indicator_or12h` | -69,373/6885 | -73,482/6885 | -23,204/1788 | -22,998/1788 | P,B,M,C,X |
| 1772 | `mfi_15m_n7_trend_t0_long_indicator_or12h` | -45,396/3017 | -42,906/3016 | -9,451/781 | -9,276/780 | P,B,M,C,X |
| 1773 | `obv_15m_n10_trend_t0_long_indicator_or12h` | -46,316/3125 | -42,516/3125 | -9,947/804 | -9,028/804 | P,B,M,C,X |
| 1774 | `mfi_5m_n14_trend_t0.2_long_indicator_or12h` | -47,180/3531 | -44,154/3531 | -14,375/908 | -13,516/908 | P,B,M,C,X |
| 1775 | `cmf_5m_n10_trend_t0.2_long_indicator_or12h` | -47,806/3862 | -43,589/3862 | -8,806/982 | -8,289/982 | P,B,M,C,X |
| 1776 | `obv_5m_n40_trend_t0_long_indicator_or12h` | -49,693/4175 | -48,207/4175 | -9,064/1050 | -7,823/1050 | P,B,M,C,X |
| 1777 | `cmf_5m_n40_trend_t0_long_indicator_or12h` | -52,600/4218 | -48,704/4217 | -10,184/1089 | -9,379/1088 | P,B,M,C,X |
| 1778 | `cmf_5m_n20_trend_t0.05_long_indicator_or12h` | -53,112/3915 | -49,046/3915 | -12,991/1043 | -12,041/1043 | P,B,M,C,X |
| 1779 | `cmf_5m_n10_recovery_t0.05_short_indicator_or12h` | -79,780/7402 | -67,644/6110 | -21,213/1919 | -17,497/1576 | P,B,M,C,X |
| 1780 | `mfi_5m_n14_trend_t0_short_indicator_or12h` | -80,293/6044 | -78,703/6044 | -27,038/1546 | -26,893/1546 | P,B,M,C,X |
| 1781 | `mfi_5m_n28_trend_t0_long_indicator_or12h` | -55,448/4222 | -51,035/4221 | -8,035/1072 | -7,747/1071 | P,B,M,C,X |
| 1782 | `cmf_5m_n20_trend_t0_short_indicator_or12h` | -83,208/6123 | -80,373/6123 | -25,203/1655 | -24,699/1655 | P,B,M,C,X |
| 1783 | `cmf_5m_n10_into_t0.05_long_indicator_or12h` | -59,006/6826 | -63,226/6826 | -15,221/1781 | -15,622/1781 | P,B,M,C,X |
| 1784 | `mfi_5m_n7_trend_t0.6_long_indicator_or12h` | -59,762/3827 | -54,242/3827 | -12,210/958 | -12,567/958 | P,B,M,C,X |
| 1785 | `obv_5m_n10_trend_t0.25_long_indicator_or12h` | -65,129/4651 | -60,033/4651 | -15,243/1183 | -14,232/1183 | P,B,M,C,X |
| 1786 | `cmf_5m_n10_trend_t0.05_short_indicator_or12h` | -91,184/6826 | -86,959/6826 | -23,966/1781 | -23,565/1781 | P,B,M,C,X |
| 1787 | `mfi_5m_n7_trend_t0.2_short_indicator_or12h` | -91,257/6663 | -89,481/6663 | -29,566/1714 | -29,672/1714 | P,B,M,C,X |
| 1788 | `obv_5m_n20_trend_t0_short_indicator_or12h` | -92,549/6057 | -89,090/6057 | -23,688/1538 | -22,269/1538 | P,B,M,C,X |
| 1789 | `mfi_5m_n14_trend_t0_long_indicator_or12h` | -67,645/6045 | -66,065/6045 | -19,883/1546 | -19,732/1546 | P,B,M,C,X |
| 1790 | `cmf_5m_n10_recovery_t0.05_long_indicator_or12h` | -68,587/7363 | -57,392/6106 | -17,365/1939 | -14,050/1584 | P,B,M,C,X |
| 1791 | `cmf_5m_n20_trend_t0_long_indicator_or12h` | -70,432/6124 | -67,533/6124 | -17,955/1656 | -17,384/1656 | P,B,M,C,X |
| 1792 | `obv_5m_n20_trend_t0_long_indicator_or12h` | -79,666/6058 | -76,210/6058 | -16,461/1538 | -15,093/1538 | P,B,M,C,X |
| 1793 | `cmf_5m_n10_trend_t0.05_long_indicator_or12h` | -82,090/6885 | -77,985/6885 | -16,135/1788 | -16,341/1788 | P,B,M,C,X |
| 1794 | `mfi_5m_n7_trend_t0.2_long_indicator_or12h` | -83,707/6676 | -79,520/6676 | -21,747/1706 | -23,086/1706 | P,B,M,C,X |
| 1795 | `mfi_5m_n7_trend_t0_short_indicator_or12h` | -115,537/8929 | -109,617/8929 | -33,935/2260 | -35,362/2260 | P,B,M,C,X |
| 1796 | `cmf_5m_n10_trend_t0_short_indicator_or12h` | -116,891/8949 | -112,126/8949 | -30,127/2353 | -30,297/2353 | P,B,M,C,X |
| 1797 | `obv_5m_n10_trend_t0_short_indicator_or12h` | -117,048/8744 | -116,011/8744 | -31,848/2247 | -31,670/2247 | P,B,M,C,X |
| 1798 | `mfi_5m_n7_trend_t0_long_indicator_or12h` | -102,753/8930 | -96,878/8930 | -26,679/2261 | -28,111/2261 | P,B,M,C,X |
| 1799 | `cmf_5m_n10_trend_t0_long_indicator_or12h` | -104,025/8949 | -99,234/8949 | -22,973/2353 | -23,060/2353 | P,B,M,C,X |
| 1800 | `obv_5m_n10_trend_t0_long_indicator_or12h` | -104,193/8744 | -103,164/8744 | -24,679/2247 | -24,520/2247 | P,B,M,C,X |

N=sample floor;P=not positive allcases;B=clock delta;M=monthly regression;C=extra-cost net;X=exhausted diagnostic. Codes describe this exact rule only.
