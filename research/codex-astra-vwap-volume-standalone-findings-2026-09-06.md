# I10: VWAP location and relative-volume conditioning — findings

September 6, 2026. Local standalone research only. VWAP and relative volume
are separate branches; this is not VWAP+volume, HL/S/R or ladder work.
No live/config/state changes, short unpause, commit, push or deployment.

## TL;DR

- **640 strategy slots plus60 plain-price controls;2,808 cases verified.**43 strategy definitions survive the descriptive sample/positive-net/delay/extra-cost subset:18 VWAP longs,23 RVOL longs and2 RVOL short exits. **Zero passes the full monthly-consistency screen.** These are correlated definitions, not43 independent edges.
- **VWAP discounts are the strongest full-period long result, not a proven bleeding fix.**5m daily distance crossing below−2%,12h hold:302 full closes, +$13,302 versus long clock+$3,305;64 recent closes,+$3,098 versus+$5,038. Every V1–V5/R1–R5 leader holds October's >50% adverse price move. Fixed$10k exposure and no liquidation model matter.
- **Volume sometimes adds useful selection, but not uniformly.**5m same-time RVOL>3 on a down move, long12h (R1), earns+$10,568 full /+$5,537 recent; own no-volume controls+$1,999 /+$4,592. Two 4h RVOL>2 downside-short exits remain profitable with68 full/13 recent closes; concentration, bad months and small recent sample prevent a live claim. No config or short-pause change.

## Frozen contract and what the baseline means

| Item | Convention |
|---|---|
| Full | 2025-07-01 00:00 → 2026-09-04 19:01 UTC |
| Recent | 2026-05-17 20:43 → same cutoff; contained in full, previously mined |
| Seed / input | June 1, 2025 fixed seed; same 663,541-minute I01 snapshot / explicit 11-minute repair |
| Position / equity | $10,000 fixed entry / $32,000 initial equity; independent serial position, no averaging/compounding |
| Fees / funding | 0.055% each side actual traded notional; after trading fees, BEFORE FUNDING |
| Signal / fill | Completed selected-timeframe bar, next minute-open under modeled zero publication lag; separate +1m to BOTH actions |
| Extra costs | Additional 5bps/side on unchanged turnover, including cutoff closing mark; not a new fill path |
| Exits | 12h from actual fill or first subsequent reference-zero/volume-normalization condition capped12h |
| Clocks | Same-side rolling12h, near-continuous exposure, not exposure matched and NOT the Martingale ladder |
| Own controls | RVOL retains its own unfiltered price-direction rule; optional exits retain own fixed12h |
| Accounting | Open cutoff inventory marked with hypothetical exit fee, not counted as a completed trade; monthlies marked with inventory/fees when incurred |
| DD | Prior close-equity peak to minute adverse price on $32k initial equity; no assumed intraminute order |
| Unknowns | Actual funding/receipt timing, queue/slippage, liquidation/shared collateral and live execution are not certified |

Windows and delays overlap; do not add their PnLs or trade counts. Same
repair/source hashes do not prove historical collector arrival. Clock or
plain-control improvement is not incremental profit for the deployed ladder.
Controls that exhaust equity continue only as fixed-notional diagnostics:
any very large delta against them is NOT an executable account improvement.
Cash earns$0; fixed-initial-quantity buy/hold is context, not matched exposure.

## What exactly was tested

Five clocks:5m/15m/30m/1h/4h. Both sides. Two exits.

- VWAP: daily UTC midnight and weekly Monday00:00 references.
  Trend crossings0/0.5/1/2%; into-opposite-extension and recovery crossings
  0.5/1/2%. 400 definitions including four exact repeated I01 rules.
- Relative volume: current completed-bar volume / PRIOR20 bars' mean, or
  same UTC-slot on PRIOR20 calendar days. Fresh spikes1.5x/2x/3x, follow or
  fade current close-minus-prior-close direction. 240 definitions.
- Plain direction: the same aligned/opposed price-change opportunity
  without volume entry gating.20 unique fixed12h controls and40
  reference-specific volume-exit controls=60. Controls are not discoveries.

**700 definition slots:640 strategy slots +60 price controls;696 new /
4 repeated.**2,560 strategy cases +240 price-control cases +eight clocks
=2,808 window/delay cases. No Cartesian VWAP+RVOL product.

The four original hourly daily-VWAP0% side/exit definitions are repeated,
not counted as new hypotheses. Together with long/short clocks they supply
24 exact saved/old/new parity cases before outcomes. Distinct standalone
definitions through accepted I10:2,664+696=3,360; ladder definitions remain45.

### VWAP math and reset behavior

Actual quote turnover/base volume, complete prefix from the declared UTC
anchor. Not typical-price×volume. Distance=100*(close−VWAP)/VWAP. First
partial anchor remains null; zero cumulative volume remains null. Entry
comparisons must share an anchor: midnight/Monday reset alone cannot fire.
Exits intentionally use the current anchor after a scheduled reset, not a
reference frozen at entry. This reset behavior is part of the strategy.

Bybit linear kline units support this actual-turnover calculation.
[Bybit kline](https://bybit-exchange.github.io/docs/v5/market/kline).
[TradingView VWAP anchors / percentage bands](https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/)
describe related chart conventions; our actual-turnover VWAP is not claimed
identical to its default HLC3 proxy. A VWAP reclaim is a location crossing,
not proof that holders are profitable or institutions are buying.

Let v=position-side sign × signed distance:
trend previous<=k,current>k; into previous>=−k,current<−k;
recovery previous<=−k,current>−k. Zero exits: trend signed<=0;
into/recovery signed>=0, first subsequent observation, capped12h.

### Relative-volume math and the right control

Both denominators exclude current volume. Time-matched is regular,
noncumulative, fixed UTC slot—not local/DST, time-of-week or cumulative.
Every prior slot must exist; no substitution. Zero denominator=null,
positive denominator/current zero volume gives valid0.
[Relative volume at time](https://www.tradingview.com/support/solutions/43000705489-relative-volume-at-time/)
explains the offset idea; our complete-slot rule is stricter than its fallback.

The data-unit audit checks every minute: four genuine zero-volume rows and
no turnover/volume price outside its OHLC range at1e−5 tolerance.
Daily VWAP and rolling20 RVOL match the existing validated shared arrays
exactly on all five clocks.

Direction is one-bar close change, not candle open-to-close color or actual
aggressor flow. A fresh volume crossing and the specified direction must
coincide; a wrong-direction spike expires. No deferred acceptance. A tiny
nonzero price change qualifies—no undisclosed return floor.

The plain control uses every eligible aligned/opposed close change; the RVOL
rule filters those opportunities for fresh volume spikes. The delta therefore
includes threshold AND freshness, not an isolated causal estimate of volume.
Exits are fixed12h or first subsequent selected RVOL<=1, capped12h. A present
low RVOL is not a signal to short. There is no VWAP condition in these rules.

### Frozen screens

Inherited strict screen:>=30 full/10 recent closes in both delays, positive
net and own-clock delta in allfour, every monthly marked delta>=−1e−8,
positive extra-cost net and solvent. Plain controls cannot qualify.
Descriptive sample/net/cost/solvency subset retains monthly/clock failures;
not a relaxed live gate. Overall and per-branch topfive use full immediate
absolute net; raw topfive uses clock delta and excludes plain controls.

Sparse rules are inconclusive, not rejection of a whole indicator. All
attempts remain in the appendices. A useful participation claim additionally
requires examining own unfiltered-price deltas, sample and insolvency flags,
rather than assigning the entire strategy profit to RVOL.

## Ranked reading guide and baseline W/L comparisons

V1–V5 and R1–R5 are each branch's descriptive topfive by full immediate absolute net. Overall topfive are **V1,V2,V3,R1,R2**. S1–S5 are the raw topfive by same-side clock delta (including failed strategies); Q1/Q2 are the only descriptive short survivors. Raw delta can favor a short that still loses. C labels are explicit plain-price/fixed-exit controls, not added candidates.

| Label | Plain-language definition | Exact ID |
|---|---|---|
| V1 | 5m daily VWAP, below −2%, long; 12h | `vwap_5m_day_into_t2_long_fixed12h` |
| V2 | 15m daily VWAP, below −2%, long; 12h | `vwap_15m_day_into_t2_long_fixed12h` |
| V3 | 5m daily VWAP, below −2%, long; VWAP-or12h | `vwap_5m_day_into_t2_long_indicator_or12h` |
| V4 | 30m daily VWAP, below −2%, long; 12h | `vwap_30m_day_into_t2_long_fixed12h` |
| V5 | 1h daily VWAP, below −2%, long; VWAP-or12h | `vwap_60m_day_into_t2_long_indicator_or12h` |
| R1 | 5m down close-change, same-time20 RVOL crosses >3x, long; 12h | `rvol_5m_time20_fade_t3_long_fixed12h` |
| R2 | 1h down close-change, prior20 RVOL crosses >2x, long; 12h | `rvol_60m_rolling20_fade_t2_long_fixed12h` |
| R3 | 5m up close-change, prior20 RVOL crosses >2x, long; 12h | `rvol_5m_rolling20_follow_t2_long_fixed12h` |
| R4 | 5m down close-change, prior20 RVOL crosses >2x, long; 12h | `rvol_5m_rolling20_fade_t2_long_fixed12h` |
| R5 | 30m down close-change, prior20 RVOL crosses >3x, long; 12h | `rvol_30m_rolling20_fade_t3_long_fixed12h` |
| S1 | 1h daily VWAP, above +1%, short; VWAP-or12h | `vwap_60m_day_into_t1_short_indicator_or12h` |
| S2 | 4h daily VWAP, above +1%, short; 12h | `vwap_240m_day_into_t1_short_fixed12h` |
| S3 | 15m daily VWAP, above +1%, short; VWAP-or12h | `vwap_15m_day_into_t1_short_indicator_or12h` |
| S4 | 1h weekly VWAP, below −0.5%, short; 12h | `vwap_60m_week_trend_t0.5_short_fixed12h` |
| S5 | 30m weekly VWAP, below −0.5%, short; 12h | `vwap_30m_week_trend_t0.5_short_fixed12h` |
| Q1 | 4h down close-change, prior20 RVOL crosses >2x, short; RVOL≤1-or12h | `rvol_240m_rolling20_follow_t2_short_indicator_or12h` |
| Q2 | 4h down close-change, prior20 RVOL crosses >2x, short; 12h | `rvol_240m_rolling20_follow_t2_short_fixed12h` |

### Full: July 1,2025–September 4,2026 19:01 UTC — immediate execution

Dollars after trading fees, before funding. W/L counts completed trades; the open mark explains any difference between winning+losing dollars and net. Numbers rounded independently. DD is account adverse-equity drawdown, NOT maximum trade-price excursion. Baselines are standalone clocks, not the ladder.

| Setup | W / L | Winning $ | Losing $ | Open $ | Net $ | Δ vs same-side clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 420 / 441 | 110,950 | -107,401 | -245 | 3,305 | baseline | 33.09% |
| Clock short | 414 / 447 | 98,162 | -120,668 | 223 | -22,283 | baseline | 71.27% |
| V1 | 164 / 138 | 48,025 | -34,798 | 75 | 13,302 | 9,998 | 15.76% |
| V2 | 146 / 129 | 42,204 | -30,688 | 134 | 11,650 | 8,346 | 16.13% |
| V3 | 242 / 129 | 39,420 | -28,745 | 75 | 10,750 | 7,446 | 15.45% |
| V4 | 128 / 122 | 38,302 | -29,194 | 163 | 9,272 | 5,967 | 16.80% |
| V5 | 145 / 93 | 29,718 | -21,020 | 163 | 8,861 | 5,556 | 16.23% |
| R1 | 277 / 254 | 74,964 | -64,325 | -71 | 10,568 | 7,264 | 22.78% |
| R2 | 130 / 124 | 40,714 | -30,918 | -51 | 9,745 | 6,441 | 18.81% |
| R3 | 360 / 365 | 96,591 | -87,023 | 0 | 9,567 | 6,263 | 22.73% |
| R4 | 369 / 371 | 98,172 | -89,074 | -213 | 8,885 | 5,581 | 23.11% |
| R5 | 121 / 111 | 35,378 | -26,650 | -51 | 8,677 | 5,373 | 18.38% |
| S1 | 309 / 177 | 49,140 | -45,012 | 0 | 4,128 | 26,411 | 18.38% |
| S2 | 138 / 131 | 41,066 | -37,071 | 0 | 3,995 | 26,278 | 16.34% |
| S3 | 493 / 223 | 59,309 | -55,398 | 0 | 3,911 | 26,194 | 13.52% |
| S4 | 120 / 112 | 29,025 | -26,186 | 0 | 2,839 | 25,122 | 14.00% |
| S5 | 128 / 120 | 32,118 | -29,608 | 0 | 2,510 | 24,793 | 14.91% |
| Q1 | 39 / 29 | 8,416 | -6,280 | -71 | 2,064 | 24,347 | 16.78% |
| Q2 | 39 / 29 | 10,252 | -8,411 | -71 | 1,770 | 24,053 | 18.89% |

Cash/no trade=$0. Buy/hold context=$11,511; not exposure matched.

### Recent: May 17,2026 20:43–September 4,2026 19:01 UTC — immediate execution

Dollars after trading fees, before funding. W/L counts completed trades; the open mark explains any difference between winning+losing dollars and net. Numbers rounded independently. DD is account adverse-equity drawdown, NOT maximum trade-price excursion. Baselines are standalone clocks, not the ladder.

| Setup | W / L | Winning $ | Losing $ | Open $ | Net $ | Δ vs same-side clock $ | DD |
|---|---|---|---|---|---|---|---|
| Clock long | 114 / 105 | 29,120 | -23,837 | -245 | 5,038 | baseline | 12.94% |
| Clock short | 97 / 122 | 21,666 | -31,775 | 223 | -9,887 | baseline | 32.54% |
| V1 | 40 / 24 | 9,960 | -6,937 | 75 | 3,098 | -1,940 | 8.27% |
| V2 | 37 / 23 | 9,387 | -6,002 | 134 | 3,520 | -1,519 | 5.99% |
| V3 | 48 / 25 | 7,068 | -6,066 | 75 | 1,077 | -3,961 | 6.48% |
| V4 | 36 / 19 | 9,814 | -5,463 | 163 | 4,515 | -524 | 5.99% |
| V5 | 30 / 21 | 7,599 | -4,123 | 163 | 3,639 | -1,400 | 3.95% |
| R1 | 71 / 64 | 20,190 | -14,583 | -71 | 5,537 | 499 | 8.45% |
| R2 | 35 / 27 | 11,744 | -7,512 | -51 | 4,181 | -857 | 5.14% |
| R3 | 98 / 86 | 25,405 | -19,840 | 0 | 5,565 | 527 | 9.78% |
| R4 | 98 / 86 | 24,505 | -20,933 | -213 | 3,358 | -1,680 | 14.10% |
| R5 | 31 / 24 | 8,226 | -6,430 | -51 | 1,745 | -3,293 | 6.71% |
| S1 | 68 / 49 | 8,936 | -12,485 | 0 | -3,549 | 6,338 | 14.88% |
| S2 | 36 / 35 | 9,691 | -10,137 | 0 | -446 | 9,440 | 9.03% |
| S3 | 115 / 58 | 12,846 | -15,627 | 0 | -2,781 | 7,105 | 13.54% |
| S4 | 24 / 32 | 5,606 | -8,236 | 0 | -2,630 | 7,256 | 11.06% |
| S5 | 26 / 34 | 6,122 | -9,285 | 0 | -3,163 | 6,724 | 13.11% |
| Q1 | 8 / 5 | 1,685 | -895 | -71 | 718 | 10,605 | 3.07% |
| Q2 | 8 / 5 | 2,010 | -884 | -71 | 1,056 | 10,942 | 3.04% |

Cash/no trade=$0. Buy/hold context=$8,383; not exposure matched.

## Delay and extra-cost robustness

Each cell: **net / net after extra5bps per side / completed n**. Same fixed-path extra-cost method, not simulated order-book fills. A delayed entry changes later occupancy, so it can change trade count as well as price. Do not add windows or delays.

| Setup | Full0m | Full+1m | Recent0m | Recent+1m |
|---|---|---|---|---|
| Clock long | 3,305 / -5,322 / 861 | 3,792 / -4,815 / 859 | 5,038 / 2,835 / 219 | 5,104 / 2,910 / 218 |
| Clock short | -22,283 / -30,909 / 861 | -22,726 / -31,333 / 859 | -9,887 / -12,090 / 219 | -9,930 / -12,124 / 218 |
| V1 | 13,302 / 10,264 / 302 | 11,799 / 8,772 / 301 | 3,098 / 2,446 / 64 | 3,030 / 2,379 / 64 |
| V2 | 11,650 / 8,883 / 275 | 9,675 / 6,928 / 273 | 3,520 / 2,908 / 60 | 3,448 / 2,846 / 59 |
| V3 | 10,750 / 7,023 / 371 | 10,528 / 6,801 / 371 | 1,077 / 336 / 73 | 859 / 118 / 73 |
| V4 | 9,272 / 6,756 / 250 | 8,831 / 6,335 / 248 | 4,515 / 3,952 / 55 | 3,272 / 2,720 / 54 |
| V5 | 8,861 / 6,465 / 238 | 7,691 / 5,316 / 236 | 3,639 / 3,117 / 51 | 3,250 / 2,728 / 51 |
| R1 | 10,568 / 5,240 / 531 | 10,302 / 4,974 / 531 | 5,537 / 4,173 / 135 | 5,804 / 4,440 / 135 |
| R2 | 9,745 / 7,189 / 254 | 9,100 / 6,595 / 249 | 4,181 / 3,549 / 62 | 3,984 / 3,352 / 62 |
| R3 | 9,567 / 2,308 / 725 | 8,198 / 990 / 720 | 5,565 / 3,722 / 184 | 5,415 / 3,581 / 183 |
| R4 | 8,885 / 1,467 / 740 | 8,132 / 754 / 736 | 3,358 / 1,506 / 184 | 3,470 / 1,617 / 184 |
| R5 | 8,677 / 6,342 / 232 | 8,678 / 6,403 / 226 | 1,745 / 1,184 / 55 | 2,246 / 1,705 / 53 |
| S1 | 4,128 / -727 / 486 | 3,829 / -1,006 / 484 | -3,549 / -4,720 / 117 | -3,482 / -4,653 / 117 |
| S2 | 3,995 / 1,309 / 269 | -186 / -2,614 / 243 | -446 / -1,156 / 71 | -29 / -689 / 66 |
| S3 | 3,911 / -3,243 / 716 | 1,525 / -5,620 / 715 | -2,781 / -4,512 / 173 | -3,039 / -4,769 / 173 |
| S4 | 2,839 / 522 / 232 | 2,528 / 290 / 224 | -2,630 / -3,191 / 56 | -2,675 / -3,226 / 55 |
| S5 | 2,510 / 33 / 248 | 1,639 / -748 / 239 | -3,163 / -3,764 / 60 | -3,181 / -3,773 / 59 |
| Q1 | 2,064 / 1,376 / 68 | 2,773 / 2,105 / 66 | 718 / 579 / 13 | 784 / 645 / 13 |
| Q2 | 1,770 / 1,082 / 68 | 2,861 / 2,212 / 64 | 1,056 / 916 / 13 | 1,194 / 1,065 / 12 |

## Does RVOL add anything beyond price direction?

Own plain controls retain side/timeframe/follow-or-fade and exit, removing only volume-entry gating. Delta includes volume threshold AND fresh-cross timing/opportunity selection. It is not the isolated causal contribution of raw volume amount.

All displayed own controls are solvent in all four cases. Elsewhere **30/60 plain-control definitions** and18/640 strategy slots exhaust account equity in at least one diagnostic; their continuing fixed-size totals are NOT executable account performance. Beating those bankrupt controls is not a discovery.

| Rule / own control | Full0m own → RVOL / Δ $ | Full+1m own → RVOL / Δ $ | Recent0m own → RVOL / Δ $ | Recent+1m own → RVOL / Δ $ |
|---|---|---|---|---|
| R1 / C2 | 1,999 → 10,568 / 8,569 | 4,635 → 10,302 / 5,666 | 4,592 → 5,537 / 945 | 5,217 → 5,804 / 586 |
| R2 / C4 | 7,776 → 9,745 / 1,969 | 9,039 → 9,100 / 61 | 3,212 → 4,181 / 969 | 5,647 → 3,984 / -1,664 |
| R3 / C1 | 1,911 → 9,567 / 7,656 | 422 → 8,198 / 7,776 | 4,845 → 5,565 / 721 | 5,029 → 5,415 / 386 |
| R4 / C2 | 1,999 → 8,885 / 6,886 | 4,635 → 8,132 / 3,496 | 4,592 → 3,358 / -1,234 | 5,217 → 3,470 / -1,747 |
| R5 / C3 | 5,145 → 8,677 / 3,533 | 5,878 → 8,678 / 2,801 | 6,935 → 1,745 / -5,189 | 8,219 → 2,246 / -5,972 |
| Q1 / C9 | -23,971 → 2,064 / 26,035 | -14,232 → 2,773 / 17,005 | -4,490 → 718 / 5,208 | -3,519 → 784 / 4,303 |
| Q2 / C8 | -22,392 → 1,770 / 24,163 | -20,144 → 2,861 / 23,005 | -8,860 → 1,056 / 9,916 | -12,903 → 1,194 / 14,097 |

R1 improves its own control in all four cases (+$8,569 /+$5,666 full;+$945 /+$586 recent). R3 also improves all four (+$7,656 /+$7,776 full;+$721 /+$386 recent). This is qualified positive selection evidence, not monthly-uniform protection. R2's recent own-control edge changes from+$969 to−$1,664 with+1m delay. R4/R5 lose recent profit versus their own controls. Do not generalize “high volume helps.”

### Explicit control definitions and W/L dollars

| Control | Meaning | Exact ID |
|---|---|---|
| C1 | 5m up close-change, no volume entry filter, long; 12h | `bar_direction_5m_rolling20_follow_t0_long_fixed12h` |
| C2 | 5m down close-change, no volume entry filter, long; 12h | `bar_direction_5m_rolling20_fade_t0_long_fixed12h` |
| C3 | 30m down close-change, no volume entry filter, long; 12h | `bar_direction_30m_rolling20_fade_t0_long_fixed12h` |
| C4 | 1h down close-change, no volume entry filter, long; 12h | `bar_direction_60m_rolling20_fade_t0_long_fixed12h` |
| C5 | 15m daily VWAP, above +1%, short; 12h | `vwap_15m_day_into_t1_short_fixed12h` |
| C6 | 1h daily VWAP, above +1%, short; 12h | `vwap_60m_day_into_t1_short_fixed12h` |
| C7 | 1h daily VWAP, below −2%, long; 12h | `vwap_60m_day_into_t2_long_fixed12h` |
| C8 | 4h down close-change, no volume entry filter, short; 12h | `bar_direction_240m_rolling20_follow_t0_short_fixed12h` |
| C9 | 4h down close-change, no volume entry filter, short; RVOL≤1-or12h | `bar_direction_240m_rolling20_follow_t0_short_indicator_or12h` |

#### full own controls,0m

| Control | W / L | Winning $ | Losing $ | Open $ | Net $ | DD |
|---|---|---|---|---|---|---|
| C1 | 418 / 438 | 106,311 | -104,170 | -230 | 1,911 | 33.38% |
| C2 | 420 / 435 | 108,544 | -106,330 | -215 | 1,999 | 34.14% |
| C3 | 407 / 419 | 108,820 | -103,839 | 163 | 5,145 | 32.54% |
| C4 | 393 / 408 | 104,476 | -96,649 | -51 | 7,776 | 24.36% |
| C5 | 229 / 229 | 54,745 | -64,604 | 0 | -9,860 | 39.51% |
| C6 | 192 / 189 | 52,578 | -51,235 | 0 | 1,343 | 19.84% |
| C7 | 117 / 102 | 31,431 | -26,282 | 163 | 5,313 | 17.16% |
| C8 | 305 / 341 | 67,642 | -89,963 | -71 | -22,392 | 72.53% |
| C9 | 448 / 547 | 71,041 | -94,940 | -71 | -23,971 | 77.05% |

#### recent own controls,0m

| Control | W / L | Winning $ | Losing $ | Open $ | Net $ | DD |
|---|---|---|---|---|---|---|
| C1 | 121 / 97 | 29,228 | -24,389 | 5 | 4,845 | 12.85% |
| C2 | 114 / 104 | 27,923 | -23,324 | -7 | 4,592 | 13.88% |
| C3 | 117 / 94 | 29,051 | -22,280 | 163 | 6,935 | 10.57% |
| C4 | 108 / 94 | 23,756 | -20,493 | -51 | 3,212 | 13.38% |
| C5 | 54 / 62 | 10,769 | -17,188 | 0 | -6,419 | 23.16% |
| C6 | 44 / 53 | 10,290 | -15,275 | 0 | -4,985 | 16.80% |
| C7 | 32 / 16 | 8,068 | -4,916 | 163 | 3,315 | 5.73% |
| C8 | 69 / 91 | 13,818 | -22,607 | -71 | -8,860 | 29.72% |
| C9 | 111 / 133 | 16,747 | -21,166 | -71 | -4,490 | 17.50% |

## Exit attribution: the same entry, not the clock

Changing the exit also changes subsequent opportunity availability. This is a whole-rule comparison, not a promise that each original trade can be improved individually.

| Rule / fixed12h companion | Full0m fixed → variant / Δ $ | Full+1m fixed → variant / Δ $ | Recent0m fixed → variant / Δ $ | Recent+1m fixed → variant / Δ $ |
|---|---|---|---|---|
| V3 / V1 | 13,302 → 10,750 / -2,552 | 11,799 → 10,528 / -1,271 | 3,098 → 1,077 / -2,021 | 3,030 → 859 / -2,172 |
| V5 / C7 | 5,313 → 8,861 / 3,548 | 4,986 → 7,691 / 2,706 | 3,315 → 3,639 / 324 | 2,120 → 3,250 / 1,130 |
| S1 / C6 | 1,343 → 4,128 / 2,785 | 5,569 → 3,829 / -1,740 | -4,985 → -3,549 / 1,436 | -3,258 → -3,482 / -224 |
| S3 / C5 | -9,860 → 3,911 / 13,771 | -8,283 → 1,525 / 9,807 | -6,419 → -2,781 / 3,638 | -6,389 → -3,039 / 3,351 |
| Q1 / Q2 | 1,770 → 2,064 / 294 | 2,861 → 2,773 / -88 | 1,056 → 718 / -337 | 1,194 → 784 / -410 |

V3's VWAP exit sacrifices$2,552 full/$2,021 recent relative to V1. V5's hourly exit adds$3,548 full/$324 recent relative to its own12h companion, but still has bad months and crash exposure. Q1's volume-normalization exit adds$294 full but sacrifices$337 recent versus Q2; delayed full also favors fixed12h. Neither exit is a universal upgrade.

## What the winners still get wrong

The leading VWAP rule captures fewer trades with lower account DD, but **misses upside**: in the full path,V1 makes approximately$0 in May2026 versus+$5,789 clock, and+$2,233 in August versus+$4,306. It reduces June/July losses but does not erase the tradeoff. R1 still loses$2,045 in July2026 versus clock−$2,621; it is not a cascade blocker.

All five full-profit leaders AND all five leaders from each branch retain October10,2025's crash exposure. A profitable eventual exit does not mean the position was safe during the trade. The model has no exchange liquidation/margin stop. Standalone entries at fixed$10k cannot certify leveraged ladder adds or a$25k live short.

| Setup | Worst full trade adverse % | Adverse $ on$10k | Entry UTC | Worst minute UTC | That trade closed $ | Top5 wins / closed net |
|---|---|---|---|---|---|---|
| Clock long | -53.52% | -5,352 | 2025-10-10T12:00:00.000Z | 2025-10-10T21:21:00.000Z | -1,601 | 199.91% |
| Clock short | -23.65% | -2,365 | 2026-08-19T12:00:00.000Z | 2026-08-19T21:45:00.000Z | -1,885 | — |
| V1 | -51.97% | -5,197 | 2025-10-10T15:30:00.000Z | 2025-10-10T21:21:00.000Z | -1,079 | 39.63% |
| V2 | -51.97% | -5,197 | 2025-10-10T15:30:00.000Z | 2025-10-10T21:21:00.000Z | -1,079 | 46.74% |
| V3 | -51.97% | -5,197 | 2025-10-10T15:30:00.000Z | 2025-10-10T21:21:00.000Z | -943 | 19.83% |
| V4 | -51.97% | -5,197 | 2025-10-10T15:30:00.000Z | 2025-10-10T21:21:00.000Z | -1,079 | 55.11% |
| V5 | -51.21% | -5,121 | 2025-10-10T16:00:00.000Z | 2025-10-10T21:21:00.000Z | -384 | 36.72% |
| R1 | -50.63% | -5,063 | 2025-10-10T19:30:00.000Z | 2025-10-10T21:21:00.000Z | -574 | 71.77% |
| R2 | -53.09% | -5,309 | 2025-10-10T15:00:00.000Z | 2025-10-10T21:21:00.000Z | -1,163 | 60.66% |
| R3 | -54.11% | -5,411 | 2025-10-10T14:15:00.000Z | 2025-10-10T21:21:00.000Z | -1,759 | 63.92% |
| R4 | -51.15% | -5,115 | 2025-10-10T18:50:00.000Z | 2025-10-10T21:21:00.000Z | -830 | 81.80% |
| R5 | -51.97% | -5,197 | 2025-10-10T15:30:00.000Z | 2025-10-10T21:21:00.000Z | -1,079 | 68.09% |
| S1 | -22.52% | -2,252 | 2026-08-19T13:00:00.000Z | 2026-08-19T21:45:00.000Z | -1,777 | 74.89% |
| S2 | -17.43% | -1,743 | 2026-08-19T16:00:00.000Z | 2026-08-19T21:45:00.000Z | -1,244 | 146.38% |
| S3 | -22.50% | -2,250 | 2026-08-19T12:45:00.000Z | 2026-08-19T21:45:00.000Z | -1,967 | 61.62% |
| S4 | -23.82% | -2,382 | 2026-08-19T14:00:00.000Z | 2026-08-19T21:45:00.000Z | -1,860 | 126.78% |
| S5 | -23.82% | -2,382 | 2026-08-19T14:00:00.000Z | 2026-08-19T21:45:00.000Z | -1,860 | 157.56% |
| Q1 | -10.73% | -1,073 | 2025-08-14T16:00:00.000Z | 2025-08-15T03:59:00.000Z | -1,079 | 167.44% |
| Q2 | -10.73% | -1,073 | 2025-08-14T16:00:00.000Z | 2025-08-15T03:59:00.000Z | -1,079 | 197.56% |

Path supplement covers completed immediate trades only, excludes exit-minute H/L, and does not reinterpret cutoff inventory as completed. Top5-winning dollars divided by closed net may exceed100% because other trades offset the winners. This is concentration, not a conventional portfolio weight.

### Shorts: preserve the positive narrow finding without overclaiming

Q1/Q2 share the exact4h entry: RVOL crosses from≤2 to>2 using the prior20 completed bars, and current close is below previous close; then short. One exits when subsequent RVOL≤1 or12h; the other uses12h only. **68 full/13 recent closes at0m**,64–66 full/12–13 recent with+1m. These are two exits of one mechanism, not two independent samples.

Both survive positive net/sample/delay/extra costs; both fail monthly consistency. Q1/Q2 lose$1,874/$2,066 in November2025 while short clock earns$1,970. Their five biggest winners supply167%/198% of full closed net and191%/149% recent. Both hold a10.73% adverse short-price move (August14–15,2025) and5.85% recently. Q2's recent$1,056 is not enough to justify unpausing the separate live HL short.

By contrast,S1–S5 all lose in the recent window. Of320 short definitions,310 meet sample floors,10 are sparse;275 lose allfour cases. **Do not reject every VWAP/volume short**: the explicit Q finding exists, with the stated limitations.

## Month-by-month marked results: baseline always shown

Each strategy cell is **monthly net / Δ versus its same-side clock**. Baseline columns are monthly net. Full includes15 calendar buckets; recent has5, with partial May and September. September2026 is partial in both. Full/recent month paths can differ because recent starts flat. The overall topfive are contained in the V/R tables; S tables preserve the raw-ranking failures; Q tables retain the two descriptive short exits.

The strict screen requires every monthly delta≥−1e−8; no strategy passes. No cutoff/threshold was relaxed after seeing outcomes. Monthly closed W/L dollars remain in the saved monthly.json/CSV; the tables below use marked equity rather than exit-month-only accounting.

### VWAP topfive: full,0m delay

| Month | Clock long $ | V1 net / Δ $ | V2 net / Δ $ | V3 net / Δ $ | V4 net / Δ $ | V5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -161 | -94 / 67 | -357 / -195 | 82 / 243 | 48 / 209 | 865 / 1,027 |
| 2025-08 | 510 | 2,535 / 2,025 | 680 / 170 | 820 / 310 | -167 / -677 | 355 / -156 |
| 2025-09 | -109 | 2,798 / 2,908 | 3,046 / 3,155 | 1,914 / 2,023 | 1,983 / 2,092 | 1,696 / 1,805 |
| 2025-10 | -470 | -716 / -245 | 267 / 737 | 719 / 1,189 | -821 / -350 | 1,408 / 1,878 |
| 2025-11 | -3,287 | 1,466 / 4,753 | 1,668 / 4,954 | 1,549 / 4,836 | 2,291 / 5,578 | 2,690 / 5,976 |
| 2025-12 | -2,574 | 1,670 / 4,243 | 328 / 2,902 | 718 / 3,291 | -654 / 1,920 | -1,566 / 1,008 |
| 2026-01 | 1,782 | -321 / -2,103 | 159 / -1,623 | -705 / -2,488 | 892 / -890 | -1,913 / -3,695 |
| 2026-02 | -122 | 163 / 285 | -393 / -271 | 1,779 / 1,901 | -853 / -731 | 434 / 556 |
| 2026-03 | 1,155 | 3,006 / 1,851 | 2,867 / 1,713 | 2,346 / 1,191 | 2,292 / 1,138 | 961 / -193 |
| 2026-04 | 307 | -86 / -393 | -115 / -422 | 243 / -65 | -234 / -541 | 202 / -105 |
| 2026-05 | 5,789 | -2 / -5,791 | -301 / -6,091 | -25 / -5,814 | 227 / -5,562 | -160 / -5,950 |
| 2026-06 | -1,256 | 791 / 2,046 | 1,480 / 2,736 | 51 / 1,307 | 1,915 / 3,170 | 2,676 / 3,931 |
| 2026-07 | -2,621 | -562 / 2,059 | -480 / 2,141 | -382 / 2,239 | 133 / 2,754 | -145 / 2,476 |
| 2026-08 | 4,306 | 2,233 / -2,073 | 2,329 / -1,977 | 1,252 / -3,054 | 1,719 / -2,587 | 1,058 / -3,248 |
| 2026-09 | 55 | 421 / 366 | 471 / 416 | 390 / 335 | 500 / 445 | 300 / 245 |

### VWAP topfive: full,1m delay

| Month | Clock long $ | V1 net / Δ $ | V2 net / Δ $ | V3 net / Δ $ | V4 net / Δ $ | V5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -94 | -154 / -60 | -474 / -380 | 13 / 107 | -48 / 46 | 747 / 841 |
| 2025-08 | 754 | 2,448 / 1,694 | 571 / -183 | 601 / -153 | -98 / -852 | 404 / -350 |
| 2025-09 | -265 | 2,703 / 2,967 | 2,949 / 3,214 | 1,978 / 2,242 | 1,796 / 2,061 | 1,632 / 1,897 |
| 2025-10 | -484 | -612 / -128 | 375 / 859 | 895 / 1,379 | -575 / -91 | 1,243 / 1,727 |
| 2025-11 | -3,354 | 1,511 / 4,865 | -24 / 3,330 | 1,449 / 4,803 | 2,443 / 5,797 | 2,065 / 5,420 |
| 2025-12 | -2,606 | 1,477 / 4,084 | 363 / 2,969 | 799 / 3,406 | 70 / 2,676 | -1,628 / 978 |
| 2026-01 | 2,011 | -1,695 / -3,706 | 189 / -1,821 | -783 / -2,794 | 1,025 / -985 | -1,745 / -3,755 |
| 2026-02 | 102 | 413 / 311 | -481 / -584 | 1,576 / 1,473 | -1,014 / -1,116 | 403 / 300 |
| 2026-03 | 1,222 | 2,932 / 1,710 | 2,723 / 1,500 | 2,560 / 1,338 | 1,966 / 743 | 895 / -328 |
| 2026-04 | 243 | -116 / -359 | -76 / -318 | 295 / 52 | -118 / -361 | 209 / -34 |
| 2026-05 | 5,761 | 85 / -5,676 | -141 / -5,903 | 32 / -5,729 | 384 / -5,377 | 14 / -5,747 |
| 2026-06 | -1,159 | 690 / 1,849 | 1,343 / 2,501 | -169 / 990 | 1,269 / 2,428 | 2,306 / 3,465 |
| 2026-07 | -2,614 | -461 / 2,153 | -408 / 2,206 | -282 / 2,333 | 85 / 2,700 | -37 / 2,577 |
| 2026-08 | 4,311 | 2,117 / -2,194 | 2,295 / -2,016 | 1,117 / -3,193 | 1,137 / -3,174 | 876 / -3,435 |
| 2026-09 | -37 | 460 / 497 | 471 / 508 | 445 / 482 | 509 / 546 | 306 / 343 |

### VWAP topfive: recent,0m delay

| Month | Clock long $ | V1 net / Δ $ | V2 net / Δ $ | V3 net / Δ $ | V4 net / Δ $ | V5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | 4,554 | 215 / -4,339 | -281 / -4,835 | -234 / -4,788 | 248 / -4,306 | -250 / -4,804 |
| 2026-06 | -1,256 | 791 / 2,046 | 1,480 / 2,736 | 51 / 1,307 | 1,915 / 3,170 | 2,676 / 3,931 |
| 2026-07 | -2,621 | -562 / 2,059 | -480 / 2,141 | -382 / 2,239 | 133 / 2,754 | -145 / 2,476 |
| 2026-08 | 4,306 | 2,233 / -2,073 | 2,329 / -1,977 | 1,252 / -3,054 | 1,719 / -2,587 | 1,058 / -3,248 |
| 2026-09 | 55 | 421 / 366 | 471 / 416 | 390 / 335 | 500 / 445 | 300 / 245 |

### VWAP topfive: recent,1m delay

| Month | Clock long $ | V1 net / Δ $ | V2 net / Δ $ | V3 net / Δ $ | V4 net / Δ $ | V5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | 4,477 | 224 / -4,253 | -253 / -4,730 | -254 / -4,731 | 273 / -4,205 | -201 / -4,679 |
| 2026-06 | -1,129 | 690 / 1,819 | 1,343 / 2,471 | -169 / 960 | 1,269 / 2,397 | 2,306 / 3,435 |
| 2026-07 | -2,692 | -461 / 2,231 | -408 / 2,284 | -282 / 2,411 | 85 / 2,778 | -37 / 2,655 |
| 2026-08 | 4,384 | 2,117 / -2,266 | 2,295 / -2,088 | 1,117 / -3,266 | 1,137 / -3,247 | 876 / -3,508 |
| 2026-09 | 64 | 460 / 397 | 471 / 408 | 445 / 382 | 509 / 445 | 306 / 243 |

### RVOL topfive: full,0m delay

| Month | Clock long $ | R1 net / Δ $ | R2 net / Δ $ | R3 net / Δ $ | R4 net / Δ $ | R5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -161 | -240 / -78 | -325 / -164 | -443 / -282 | 276 / 437 | 1,733 / 1,894 |
| 2025-08 | 510 | 1,036 / 526 | 1,803 / 1,293 | 857 / 347 | 966 / 456 | 116 / -395 |
| 2025-09 | -109 | -434 / -324 | 1,437 / 1,546 | 1,091 / 1,201 | -963 / -854 | 836 / 945 |
| 2025-10 | -470 | -1,195 / -725 | -1,737 / -1,267 | 497 / 967 | 1,643 / 2,113 | -784 / -313 |
| 2025-11 | -3,287 | -609 / 2,678 | 1,189 / 4,476 | -2,453 / 834 | -3,038 / 249 | 1,360 / 4,647 |
| 2025-12 | -2,574 | -1,474 / 1,100 | -1,435 / 1,139 | -1,595 / 979 | -884 / 1,690 | -827 / 1,747 |
| 2026-01 | 1,782 | 4,556 / 2,774 | 565 / -1,217 | 1,959 / 177 | 3,797 / 2,014 | 392 / -1,390 |
| 2026-02 | -122 | 1,424 / 1,546 | 2,065 / 2,187 | 1,534 / 1,656 | 405 / 527 | 3,298 / 3,420 |
| 2026-03 | 1,155 | 961 / -194 | 1,555 / 400 | 218 / -937 | 3,020 / 1,865 | 406 / -748 |
| 2026-04 | 307 | -97 / -404 | -365 / -672 | 400 / 93 | -950 / -1,257 | -588 / -895 |
| 2026-05 | 5,789 | 4,016 / -1,774 | 1,102 / -4,687 | 5,703 / -87 | 3,182 / -2,608 | 853 / -4,936 |
| 2026-06 | -1,256 | 893 / 2,149 | 1,698 / 2,954 | -849 / 407 | -280 / 976 | 845 / 2,101 |
| 2026-07 | -2,621 | -2,045 / 576 | -727 / 1,894 | -1,307 / 1,314 | -2,014 / 607 | -1,678 / 943 |
| 2026-08 | 4,306 | 4,067 / -239 | 2,886 / -1,420 | 4,092 / -214 | 3,589 / -717 | 2,766 / -1,540 |
| 2026-09 | 55 | -291 / -346 | 34 / -21 | -138 / -193 | 136 / 81 | -51 / -106 |

### RVOL topfive: full,1m delay

| Month | Clock long $ | R1 net / Δ $ | R2 net / Δ $ | R3 net / Δ $ | R4 net / Δ $ | R5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -94 | -160 / -66 | -165 / -71 | -267 / -173 | -236 / -142 | 1,814 / 1,908 |
| 2025-08 | 754 | 600 / -154 | 1,852 / 1,098 | 206 / -548 | 1,632 / 878 | 184 / -570 |
| 2025-09 | -265 | -532 / -267 | 1,280 / 1,545 | 982 / 1,246 | -540 / -275 | 607 / 872 |
| 2025-10 | -484 | -1,149 / -665 | -2,254 / -1,769 | 1,842 / 2,326 | 1,619 / 2,103 | -681 / -197 |
| 2025-11 | -3,354 | -782 / 2,572 | 1,328 / 4,682 | -3,533 / -179 | -2,312 / 1,042 | 1,513 / 4,867 |
| 2025-12 | -2,606 | -1,679 / 927 | -1,578 / 1,029 | -2,003 / 603 | -1,065 / 1,542 | -929 / 1,678 |
| 2026-01 | 2,011 | 4,587 / 2,577 | 247 / -1,764 | 1,657 / -353 | 3,809 / 1,798 | 296 / -1,715 |
| 2026-02 | 102 | 1,684 / 1,582 | 2,367 / 2,265 | 1,546 / 1,444 | -857 / -960 | 2,652 / 2,549 |
| 2026-03 | 1,222 | 937 / -286 | 1,466 / 244 | 49 / -1,173 | 2,415 / 1,193 | 576 / -647 |
| 2026-04 | 243 | -131 / -373 | -388 / -631 | 179 / -64 | -894 / -1,137 | -600 / -843 |
| 2026-05 | 5,761 | 3,899 / -1,863 | 1,274 / -4,487 | 6,019 / 258 | 3,309 / -2,453 | 879 / -4,882 |
| 2026-06 | -1,159 | 1,203 / 2,362 | 1,751 / 2,909 | -1,591 / -432 | -326 / 832 | 898 / 2,057 |
| 2026-07 | -2,614 | -2,072 / 542 | -877 / 1,737 | -1,267 / 1,348 | -1,991 / 624 | -1,287 / 1,327 |
| 2026-08 | 4,311 | 4,166 / -144 | 2,727 / -1,584 | 4,465 / 154 | 3,395 / -916 | 2,766 / -1,544 |
| 2026-09 | -37 | -270 / -233 | 69 / 106 | -86 / -50 | 174 / 211 | -10 / 27 |

### RVOL topfive: recent,0m delay

| Month | Clock long $ | R1 net / Δ $ | R2 net / Δ $ | R3 net / Δ $ | R4 net / Δ $ | R5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | 4,554 | 2,913 / -1,641 | 291 / -4,263 | 3,767 / -787 | 1,927 / -2,627 | -137 / -4,691 |
| 2026-06 | -1,256 | 893 / 2,149 | 1,698 / 2,954 | -849 / 407 | -280 / 976 | 845 / 2,101 |
| 2026-07 | -2,621 | -2,045 / 576 | -727 / 1,894 | -1,307 / 1,314 | -2,014 / 607 | -1,678 / 943 |
| 2026-08 | 4,306 | 4,067 / -239 | 2,886 / -1,420 | 4,092 / -214 | 3,589 / -717 | 2,766 / -1,540 |
| 2026-09 | 55 | -291 / -346 | 34 / -21 | -138 / -193 | 136 / 81 | -51 / -106 |

### RVOL topfive: recent,1m delay

| Month | Clock long $ | R1 net / Δ $ | R2 net / Δ $ | R3 net / Δ $ | R4 net / Δ $ | R5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | 4,477 | 2,776 / -1,701 | 315 / -4,162 | 3,894 / -583 | 2,217 / -2,260 | -121 / -4,599 |
| 2026-06 | -1,129 | 1,203 / 2,332 | 1,751 / 2,879 | -1,591 / -463 | -326 / 802 | 898 / 2,026 |
| 2026-07 | -2,692 | -2,072 / 620 | -877 / 1,815 | -1,267 / 1,426 | -1,991 / 702 | -1,287 / 1,405 |
| 2026-08 | 4,384 | 4,166 / -217 | 2,727 / -1,657 | 4,465 / 81 | 3,395 / -989 | 2,766 / -1,617 |
| 2026-09 | 64 | -270 / -333 | 69 / 6 | -86 / -150 | 174 / 111 | -10 / -73 |

### Raw same-side-delta topfive: full,0m delay

| Month | Clock short $ | S1 net / Δ $ | S2 net / Δ $ | S3 net / Δ $ | S4 net / Δ $ | S5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,203 | 968 / 2,171 | -1,249 / -45 | 2,108 / 3,311 | 1,752 / 2,956 | 1,561 / 2,765 |
| 2025-08 | -1,876 | -730 / 1,146 | 1,034 / 2,910 | -1,134 / 741 | 829 / 2,705 | 537 / 2,413 |
| 2025-09 | -1,211 | -20 / 1,191 | 1,068 / 2,279 | -888 / 323 | 652 / 1,863 | 725 / 1,937 |
| 2025-10 | -894 | 4,472 / 5,366 | 6,871 / 7,765 | 3,359 / 4,253 | 1,884 / 2,778 | 1,758 / 2,652 |
| 2025-11 | 1,970 | 3,058 / 1,088 | 112 / -1,858 | 971 / -998 | 362 / -1,608 | 285 / -1,685 |
| 2025-12 | 1,212 | 1,986 / 774 | 1,533 / 321 | 1,732 / 520 | 1,884 / 672 | 2,110 / 898 |
| 2026-01 | -3,149 | 670 / 3,819 | -356 / 2,793 | -48 / 3,101 | 185 / 3,334 | -156 / 2,993 |
| 2026-02 | -1,111 | -1,525 / -415 | -2,472 / -1,362 | 784 / 1,895 | -1,566 / -455 | -1,977 / -866 |
| 2026-03 | -2,521 | -56 / 2,465 | -925 / 1,596 | 502 / 3,022 | -190 / 2,330 | 670 / 3,191 |
| 2026-04 | -1,628 | 109 / 1,737 | -66 / 1,562 | 97 / 1,725 | -506 / 1,122 | 312 / 1,941 |
| 2026-05 | -7,161 | -3,257 / 3,904 | -2,009 / 5,152 | -2,467 / 4,693 | 462 / 7,622 | 139 / 7,300 |
| 2026-06 | -64 | 951 / 1,015 | 2,231 / 2,294 | 450 / 513 | -1,464 / -1,400 | -1,450 / -1,386 |
| 2026-07 | 1,259 | -552 / -1,811 | 426 / -833 | 258 / -1,001 | 2,073 / 814 | 2,088 / 829 |
| 2026-08 | -5,675 | -1,790 / 3,885 | -1,871 / 3,805 | -1,436 / 4,239 | -3,249 / 2,427 | -3,880 / 1,796 |
| 2026-09 | -231 | -156 / 75 | -332 / -100 | -376 / -144 | -269 / -37 | -214 / 17 |

### Raw same-side-delta topfive: full,1m delay

| Month | Clock short $ | S1 net / Δ $ | S2 net / Δ $ | S3 net / Δ $ | S4 net / Δ $ | S5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2025-07 | -1,271 | 1,118 / 2,389 | -1,545 / -275 | 2,065 / 3,336 | 1,833 / 3,103 | 1,579 / 2,850 |
| 2025-08 | -2,120 | -723 / 1,397 | 674 / 2,793 | -1,276 / 843 | 883 / 3,003 | 619 / 2,738 |
| 2025-09 | -1,056 | -392 / 664 | 585 / 1,640 | -1,280 / -224 | 736 / 1,791 | 1,066 / 2,121 |
| 2025-10 | -880 | 4,577 / 5,457 | 5,960 / 6,840 | 2,505 / 3,385 | 1,706 / 2,586 | 2,158 / 3,038 |
| 2025-11 | 2,037 | 2,854 / 817 | 308 / -1,729 | 910 / -1,127 | 259 / -1,778 | -275 / -2,312 |
| 2025-12 | 1,267 | 2,204 / 938 | 369 / -897 | 1,741 / 474 | 2,372 / 1,105 | 1,794 / 528 |
| 2026-01 | -3,378 | 476 / 3,853 | -1,617 / 1,760 | -171 / 3,207 | 304 / 3,682 | -591 / 2,787 |
| 2026-02 | -1,335 | -1,690 / -355 | -2,546 / -1,210 | 403 / 1,738 | -1,945 / -609 | -2,288 / -953 |
| 2026-03 | -2,588 | -111 / 2,478 | -444 / 2,144 | 551 / 3,140 | -304 / 2,285 | 778 / 3,367 |
| 2026-04 | -1,564 | 184 / 1,747 | -864 / 700 | 3 / 1,566 | -649 / 915 | 179 / 1,742 |
| 2026-05 | -7,132 | -3,057 / 4,075 | -173 / 6,960 | -2,509 / 4,624 | 332 / 7,465 | 40 / 7,173 |
| 2026-06 | -139 | 936 / 1,075 | 983 / 1,122 | 426 / 565 | -1,496 / -1,357 | -1,407 / -1,268 |
| 2026-07 | 1,252 | -551 / -1,803 | 300 / -953 | 129 / -1,124 | 2,110 / 858 | 2,027 / 774 |
| 2026-08 | -5,680 | -1,800 / 3,880 | -1,835 / 3,845 | -1,578 / 4,102 | -3,357 / 2,323 | -3,794 / 1,886 |
| 2026-09 | -139 | -197 / -57 | -340 / -200 | -393 / -254 | -258 / -118 | -245 / -106 |

### Raw same-side-delta topfive: recent,0m delay

| Month | Clock short $ | S1 net / Δ $ | S2 net / Δ $ | S3 net / Δ $ | S4 net / Δ $ | S5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,175 | -2,002 / 3,173 | -900 / 4,276 | -1,677 / 3,498 | 277 / 5,453 | 292 / 5,467 |
| 2026-06 | -64 | 951 / 1,015 | 2,231 / 2,294 | 450 / 513 | -1,464 / -1,400 | -1,450 / -1,386 |
| 2026-07 | 1,259 | -552 / -1,811 | 426 / -833 | 258 / -1,001 | 2,073 / 814 | 2,088 / 829 |
| 2026-08 | -5,675 | -1,790 / 3,885 | -1,871 / 3,805 | -1,436 / 4,239 | -3,249 / 2,427 | -3,880 / 1,796 |
| 2026-09 | -231 | -156 / 75 | -332 / -100 | -376 / -144 | -269 / -37 | -214 / 17 |

### Raw same-side-delta topfive: recent,1m delay

| Month | Clock short $ | S1 net / Δ $ | S2 net / Δ $ | S3 net / Δ $ | S4 net / Δ $ | S5 net / Δ $ |
|---|---|---|---|---|---|---|
| 2026-05 | -5,099 | -1,871 / 3,228 | 863 / 5,962 | -1,622 / 3,477 | 325 / 5,424 | 238 / 5,337 |
| 2026-06 | -191 | 936 / 1,127 | 983 / 1,174 | 426 / 617 | -1,496 / -1,305 | -1,407 / -1,216 |
| 2026-07 | 1,330 | -551 / -1,881 | 300 / -1,031 | 129 / -1,202 | 2,110 / 780 | 2,027 / 696 |
| 2026-08 | -5,753 | -1,800 / 3,953 | -1,835 / 3,918 | -1,578 / 4,175 | -3,357 / 2,396 | -3,794 / 1,959 |
| 2026-09 | -218 | -197 / 21 | -340 / -122 | -393 / -175 | -258 / -40 | -245 / -28 |

### RVOL descriptive short exits: full,0m delay

| Month | Clock short $ | Q1 net / Δ $ | Q2 net / Δ $ |
|---|---|---|---|
| 2025-07 | -1,203 | 207 / 1,411 | -450 / 753 |
| 2025-08 | -1,876 | -599 / 1,277 | -387 / 1,489 |
| 2025-09 | -1,211 | 295 / 1,507 | 103 / 1,315 |
| 2025-10 | -894 | 850 / 1,744 | 495 / 1,389 |
| 2025-11 | 1,970 | -1,874 / -3,844 | -2,066 / -4,035 |
| 2025-12 | 1,212 | 130 / -1,082 | 228 / -984 |
| 2026-01 | -3,149 | 1,059 / 4,208 | 1,165 / 4,314 |
| 2026-02 | -1,111 | 103 / 1,214 | 74 / 1,184 |
| 2026-03 | -2,521 | 256 / 2,777 | 204 / 2,724 |
| 2026-04 | -1,628 | 640 / 2,268 | 587 / 2,215 |
| 2026-05 | -7,161 | 360 / 7,520 | 798 / 7,959 |
| 2026-06 | -64 | -240 / -177 | 70 / 133 |
| 2026-07 | 1,259 | 748 / -511 | 1,087 / -172 |
| 2026-08 | -5,675 | 200 / 5,875 | -66 / 5,610 |
| 2026-09 | -231 | -71 / 160 | -71 / 160 |

### RVOL descriptive short exits: full,1m delay

| Month | Clock short $ | Q1 net / Δ $ | Q2 net / Δ $ |
|---|---|---|---|
| 2025-07 | -1,271 | 287 / 1,558 | -448 / 822 |
| 2025-08 | -2,120 | -604 / 1,516 | -396 / 1,724 |
| 2025-09 | -1,056 | 230 / 1,286 | 98 / 1,153 |
| 2025-10 | -880 | 782 / 1,662 | 393 / 1,273 |
| 2025-11 | 2,037 | -1,160 / -3,197 | -1,356 / -3,393 |
| 2025-12 | 1,267 | 65 / -1,202 | 667 / -599 |
| 2026-01 | -3,378 | 1,140 / 4,518 | 1,191 / 4,569 |
| 2026-02 | -1,335 | 75 / 1,410 | 29 / 1,364 |
| 2026-03 | -2,588 | 274 / 2,862 | 189 / 2,778 |
| 2026-04 | -1,564 | 626 / 2,190 | 567 / 2,131 |
| 2026-05 | -7,132 | 406 / 7,538 | 776 / 7,908 |
| 2026-06 | -139 | -194 / -56 | 132 / 271 |
| 2026-07 | 1,252 | 676 / -576 | 1,126 / -127 |
| 2026-08 | -5,680 | 247 / 5,927 | -30 / 5,650 |
| 2026-09 | -139 | -77 / 62 | -77 / 62 |

### RVOL descriptive short exits: recent,0m delay

| Month | Clock short $ | Q1 net / Δ $ | Q2 net / Δ $ |
|---|---|---|---|
| 2026-05 | -5,175 | 82 / 5,258 | 36 / 5,212 |
| 2026-06 | -64 | -240 / -177 | 70 / 133 |
| 2026-07 | 1,259 | 748 / -511 | 1,087 / -172 |
| 2026-08 | -5,675 | 200 / 5,875 | -66 / 5,610 |
| 2026-09 | -231 | -71 / 160 | -71 / 160 |

### RVOL descriptive short exits: recent,1m delay

| Month | Clock short $ | Q1 net / Δ $ | Q2 net / Δ $ |
|---|---|---|---|
| 2026-05 | -5,099 | 133 / 5,231 | 44 / 5,143 |
| 2026-06 | -191 | -194 / -3 | 132 / 323 |
| 2026-07 | 1,330 | 676 / -654 | 1,126 / -205 |
| 2026-08 | -5,753 | 247 / 6,000 | -30 / 5,723 |
| 2026-09 | -218 | -77 / 140 | -77 / 140 |

### RVOL monthly attribution to own plain-price controls

Each cell: **plain-control monthly net → RVOL monthly net / Δ**. This prevents the same-side clock from standing in for the actual volume-removal comparison.

#### full,0m delay

| Month | R1 own → RVOL / Δ $ | R2 own → RVOL / Δ $ | R3 own → RVOL / Δ $ | R4 own → RVOL / Δ $ | R5 own → RVOL / Δ $ | Q1 own → RVOL / Δ $ | Q2 own → RVOL / Δ $ |
|---|---|---|---|---|---|---|---|
| 2025-07 | -278 → -240 / 39 | -365 → -325 / 40 | -335 → -443 / -108 | -278 → 276 / 554 | -790 → 1,733 / 2,523 | -1,094 → 207 / 1,302 | -1,060 → -450 / 610 |
| 2025-08 | 316 → 1,036 / 720 | 1,199 → 1,803 / 604 | 375 → 857 / 482 | 316 → 966 / 650 | 515 → 116 / -400 | -3,840 → -599 / 3,240 | -2,058 → -387 / 1,671 |
| 2025-09 | -403 → -434 / -31 | 361 → 1,437 / 1,076 | -212 → 1,091 / 1,303 | -403 → -963 / -560 | -63 → 836 / 899 | -4,207 → 295 / 4,502 | -2,707 → 103 / 2,811 |
| 2025-10 | -534 → -1,195 / -661 | 386 → -1,737 / -2,123 | 183 → 497 / 314 | -534 → 1,643 / 2,177 | 231 → -784 / -1,015 | -2,833 → 850 / 3,683 | -4,763 → 495 / 5,258 |
| 2025-11 | -3,133 → -609 / 2,524 | -2,301 → 1,189 / 3,490 | -3,694 → -2,453 / 1,241 | -3,133 → -3,038 / 96 | -3,054 → 1,360 / 4,414 | -739 → -1,874 / -1,135 | -261 → -2,066 / -1,805 |
| 2025-12 | -2,661 → -1,474 / 1,187 | -1,730 → -1,435 / 295 | -2,655 → -1,595 / 1,061 | -2,661 → -884 / 1,777 | -3,458 → -827 / 2,631 | -1,339 → 130 / 1,470 | -326 → 228 / 554 |
| 2026-01 | 1,637 → 4,556 / 2,919 | 775 → 565 / -210 | 1,849 → 1,959 / 110 | 1,637 → 3,797 / 2,160 | 1,178 → 392 / -786 | -1,074 → 1,059 / 2,133 | 880 → 1,165 / 285 |
| 2026-02 | 175 → 1,424 / 1,249 | 1,226 → 2,065 / 839 | -666 → 1,534 / 2,200 | 175 → 405 / 230 | 742 → 3,298 / 2,556 | -2,643 → 103 / 2,746 | -1,682 → 74 / 1,755 |
| 2026-03 | 1,236 → 961 / -274 | 2,372 → 1,555 / -817 | 1,116 → 218 / -898 | 1,236 → 3,020 / 1,784 | 208 → 406 / 198 | -493 → 256 / 749 | -732 → 204 / 936 |
| 2026-04 | 180 → -97 / -277 | 632 → -365 / -997 | 248 → 400 / 152 | 180 → -950 / -1,130 | 1,010 → -588 / -1,599 | -517 → 640 / 1,157 | -107 → 587 / 695 |
| 2026-05 | 5,957 → 4,016 / -1,941 | 5,936 → 1,102 / -4,833 | 5,190 → 5,703 / 513 | 5,957 → 3,182 / -2,776 | 6,061 → 853 / -5,207 | -2,641 → 360 / 3,001 | -4,007 → 798 / 4,805 |
| 2026-06 | -1,748 → 893 / 2,641 | -873 → 1,698 / 2,571 | -1,284 → -849 / 435 | -1,748 → -280 / 1,468 | -683 → 845 / 1,528 | -1,227 → -240 / 987 | -2,229 → 70 / 2,298 |
| 2026-07 | -2,562 → -2,045 / 517 | -2,711 → -727 / 1,984 | -2,529 → -1,307 / 1,222 | -2,562 → -2,014 / 548 | -2,181 → -1,678 / 503 | 1,176 → 748 / -428 | 1,385 → 1,087 / -298 |
| 2026-08 | 3,877 → 4,067 / 189 | 2,752 → 2,886 / 134 | 4,244 → 4,092 / -152 | 3,877 → 3,589 / -288 | 5,341 → 2,766 / -2,575 | -2,465 → 200 / 2,664 | -4,595 → -66 / 4,529 |
| 2026-09 | -59 → -291 / -232 | 118 → 34 / -83 | 81 → -138 / -218 | -59 → 136 / 195 | 87 → -51 / -138 | -35 → -71 / -37 | -131 → -71 / 60 |

#### full,1m delay

| Month | R1 own → RVOL / Δ $ | R2 own → RVOL / Δ $ | R3 own → RVOL / Δ $ | R4 own → RVOL / Δ $ | R5 own → RVOL / Δ $ | Q1 own → RVOL / Δ $ | Q2 own → RVOL / Δ $ |
|---|---|---|---|---|---|---|---|
| 2025-07 | 130 → -160 / -290 | 141 → -165 / -306 | -179 → -267 / -88 | 130 → -236 / -366 | -640 → 1,814 / 2,454 | -1,110 → 287 / 1,397 | -1,815 → -448 / 1,367 |
| 2025-08 | 310 → 600 / 290 | 173 → 1,852 / 1,680 | 232 → 206 / -26 | 310 → 1,632 / 1,322 | -188 → 184 / 372 | -3,096 → -604 / 2,492 | -1,617 → -396 / 1,222 |
| 2025-09 | -206 → -532 / -326 | -290 → 1,280 / 1,570 | -357 → 982 / 1,339 | -206 → -540 / -334 | -69 → 607 / 676 | -2,320 → 230 / 2,550 | -1,483 → 98 / 1,581 |
| 2025-10 | -466 → -1,149 / -683 | 1,922 → -2,254 / -4,176 | -916 → 1,842 / 2,758 | -466 → 1,619 / 2,085 | 17 → -681 / -698 | -1,862 → 782 / 2,644 | -3,244 → 393 / 3,637 |
| 2025-11 | -2,892 → -782 / 2,110 | -3,398 → 1,328 / 4,726 | -2,937 → -3,533 / -596 | -2,892 → -2,312 / 579 | -2,883 → 1,513 / 4,396 | 1,109 → -1,160 / -2,269 | 2,916 → -1,356 / -4,272 |
| 2025-12 | -2,759 → -1,679 / 1,079 | -2,240 → -1,578 / 663 | -2,914 → -2,003 / 911 | -2,759 → -1,065 / 1,694 | -2,508 → -929 / 1,580 | 249 → 65 / -184 | 427 → 667 / 241 |
| 2026-01 | 1,647 → 4,587 / 2,940 | 289 → 247 / -42 | 1,438 → 1,657 / 220 | 1,647 → 3,809 / 2,162 | 1,787 → 296 / -1,491 | -1,252 → 1,140 / 2,393 | -2,146 → 1,191 / 3,337 |
| 2026-02 | 815 → 1,684 / 869 | 1,440 → 2,367 / 927 | -186 → 1,546 / 1,732 | 815 → -857 / -1,672 | 836 → 2,652 / 1,816 | -1,393 → 75 / 1,468 | 887 → 29 / -857 |
| 2026-03 | 910 → 937 / 27 | 2,184 → 1,466 / -718 | 610 → 49 / -561 | 910 → 2,415 / 1,505 | 1,455 → 576 / -880 | -879 → 274 / 1,153 | -577 → 189 / 766 |
| 2026-04 | 361 → -131 / -491 | 1,512 → -388 / -1,900 | 173 → 179 / 6 | 361 → -894 / -1,255 | 1,057 → -600 / -1,657 | -296 → 626 / 922 | -825 → 567 / 1,392 |
| 2026-05 | 6,029 → 3,899 / -2,130 | 5,773 → 1,274 / -4,499 | 6,005 → 6,019 / 14 | 6,029 → 3,309 / -2,720 | 4,983 → 879 / -4,104 | -1,566 → 406 / 1,972 | -5,307 → 776 / 6,082 |
| 2026-06 | -1,130 → 1,203 / 2,334 | 528 → 1,751 / 1,223 | -1,881 → -1,591 / 289 | -1,130 → -326 / 804 | 65 → 898 / 833 | -1,701 → -194 / 1,507 | -2,405 → 132 / 2,537 |
| 2026-07 | -2,413 → -2,072 / 340 | -1,816 → -877 / 938 | -3,034 → -1,267 / 1,768 | -2,413 → -1,991 / 422 | -2,538 → -1,287 / 1,251 | 853 → 676 / -176 | 1,180 → 1,126 / -55 |
| 2026-08 | 4,260 → 4,166 / -94 | 2,745 → 2,727 / -18 | 4,409 → 4,465 / 56 | 4,260 → 3,395 / -866 | 4,270 → 2,766 / -1,504 | -1,098 → 247 / 1,345 | -6,207 → -30 / 6,177 |
| 2026-09 | 39 → -270 / -308 | 76 → 69 / -6 | -43 → -86 / -44 | 39 → 174 / 136 | 234 → -10 / -243 | 130 → -77 / -207 | 73 → -77 / -150 |

#### recent,0m delay

| Month | R1 own → RVOL / Δ $ | R2 own → RVOL / Δ $ | R3 own → RVOL / Δ $ | R4 own → RVOL / Δ $ | R5 own → RVOL / Δ $ | Q1 own → RVOL / Δ $ | Q2 own → RVOL / Δ $ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 4,593 → 2,913 / -1,681 | 3,928 → 291 / -3,637 | 4,205 → 3,767 / -438 | 4,593 → 1,927 / -2,667 | 4,371 → -137 / -4,507 | -1,939 → 82 / 2,022 | -3,291 → 36 / 3,327 |
| 2026-06 | -1,713 → 893 / 2,606 | -873 → 1,698 / 2,571 | -1,106 → -849 / 256 | -1,713 → -280 / 1,433 | -683 → 845 / 1,528 | -1,227 → -240 / 987 | -2,229 → 70 / 2,298 |
| 2026-07 | -2,673 → -2,045 / 628 | -2,711 → -727 / 1,984 | -2,573 → -1,307 / 1,266 | -2,673 → -2,014 / 659 | -2,181 → -1,678 / 503 | 1,176 → 748 / -428 | 1,385 → 1,087 / -298 |
| 2026-08 | 4,375 → 4,067 / -308 | 2,752 → 2,886 / 134 | 4,276 → 4,092 / -184 | 4,375 → 3,589 / -786 | 5,341 → 2,766 / -2,575 | -2,465 → 200 / 2,664 | -4,595 → -66 / 4,529 |
| 2026-09 | 9 → -291 / -300 | 118 → 34 / -83 | 42 → -138 / -180 | 9 → 136 / 127 | 87 → -51 / -138 | -35 → -71 / -37 | -131 → -71 / 60 |

#### recent,1m delay

| Month | R1 own → RVOL / Δ $ | R2 own → RVOL / Δ $ | R3 own → RVOL / Δ $ | R4 own → RVOL / Δ $ | R5 own → RVOL / Δ $ | Q1 own → RVOL / Δ $ | Q2 own → RVOL / Δ $ |
|---|---|---|---|---|---|---|---|
| 2026-05 | 4,270 → 2,776 / -1,494 | 4,115 → 315 / -3,800 | 4,028 → 3,894 / -133 | 4,270 → 2,217 / -2,053 | 4,940 → -121 / -5,061 | -1,702 → 133 / 1,835 | -5,544 → 44 / 5,587 |
| 2026-06 | -939 → 1,203 / 2,143 | 528 → 1,751 / 1,223 | -1,043 → -1,591 / -548 | -939 → -326 / 613 | 1,313 → 898 / -415 | -1,701 → -194 / 1,507 | -2,405 → 132 / 2,537 |
| 2026-07 | -2,413 → -2,072 / 340 | -1,816 → -877 / 938 | -2,175 → -1,267 / 908 | -2,413 → -1,991 / 422 | -2,538 → -1,287 / 1,251 | 853 → 676 / -176 | 1,180 → 1,126 / -55 |
| 2026-08 | 4,260 → 4,166 / -94 | 2,745 → 2,727 / -18 | 4,150 → 4,465 / 315 | 4,260 → 3,395 / -866 | 4,270 → 2,766 / -1,504 | -1,098 → 247 / 1,345 | -6,207 → -30 / 6,177 |
| 2026-09 | 39 → -270 / -308 | 76 → 69 / -6 | 69 → -86 / -155 | 39 → 174 / 136 | 234 → -10 / -243 | 130 → -77 / -207 | 73 → -77 / -150 |

## Causal decision examples

The independent verifier reconstructed all eligible crossings and occupied skips, not only these examples. Values are observed at the END of the listed completed signal bar. No future minute H/L/C enters the signal or fill.

- **V1**: current bar starts2025-07-01T18:15:00.000Z, closes/is available2025-07-01T18:20:00.000Z. Daily distance changes-1.175056% →-2.477505%, crossing below−2% within the SAME UTC-day anchor. Immediate fill is the next minute's OPEN at2025-07-01T18:20:00.000Z,$38.014; exit2025-07-02T06:20:00.000Z. The+1m case waits an additional minute for both actions.

- **R1**: current bar starts2025-07-01T05:10:00.000Z, closes/is available2025-07-01T05:15:00.000Z. Same-time20 RVOL changes0.501248 →4.837283, crossing above3; completed close change-0.097000 is negative. Immediate fill is the next minute's OPEN at2025-07-01T05:15:00.000Z,$38.898; exit2025-07-01T17:15:00.000Z. The+1m case waits an additional minute for both actions.

- **Q1**: current bar starts2025-07-01T16:00:00.000Z, closes/is available2025-07-01T20:00:00.000Z. Prior20 RVOL changes1.493642 →2.497824, crossing above2; completed close change-2.004000 is negative. Immediate fill is the next minute's OPEN at2025-07-01T20:00:00.000Z,$37.028; exit2025-07-02T04:00:00.000Z. The+1m case waits an additional minute for both actions.

## Verification and reproducibility

Source/card hashes freeze all formulas and thresholds before outcomes.
No previous artifact was overwritten; raw candle data was not edited.

- Eight new test groups pass: actual-turnover day/week math and shared day
  VWAP/prior20 RVOL parity across five clocks; hand partial anchors/Monday
  resets/zero volumes; prior exact time-slot denominators; scale/volume-unit
  and aggregation invariants; all700 rule slots' crossings/direction/equality;
  every rule's entry/exit delay, actual fees, timeout/rearm and prefix paths;
  original VWAP/clock ledgers; invalid/gapped inputs and expired spikes.
- Independent feature implementation additionally matches10,626 synthetic
  feature rows across five clocks, without importing the new feature function.
- Seventeen inherited standalone groups and11 closed-bar timing groups pass.
  Both TypeScript configurations and runner/checker/path imports typecheck.
- Before any outcome directory is created,24 repeated daily-VWAP/clock
  window/delay cases match saved I01 stats, trades, monthlies and open marks.
- Independent outcome verification imports only canonical candle normalization
  and the explicit repair, not feature/signal engines. It reaggregates OHLCV,
  derives anchored sums and prior-slot volume ratios, enumerates every
  eligible/occupied signal and earliest exit, reconstructs prices/fees/open
  marks, full-minute DD, monthlies, own controls and ranking/trace identities.
- Path supplement is read-only: completed immediate trades, exit-minute
  high/low excluded, no new strategy or liquidation/queue assumptions.

Artifacts: `backtests/hype/hype-vwap-volume-standalone-2026-09-06/`.
[Method/reproduction](../docs/research/vwap-volume-standalone-study.md),
[frozen card](../research-inputs/indicators/vwap-volume-standalone-2026-09-06.json).

## Explicitly untested and next boundary

Other VWAP distances/anchors, damage/swing/event VWAP, previous-session
reclaims, statistical bands; other RVOL periods/thresholds, cumulative,
time-of-week, low-volume or sustained-state rules; OBV/MFI/CMF; indicator,
VWAP+RVOL, HL/S/R combinations; ladder/shared-account decisions; funding,
actual historical arrival, queue/slippage and liquidation.

Next individual volume work can cover OBV/MFI/CMF under separate validated
formula cards before combinations. “VWAP/RVOL covered” does not mean the
entire volume family or every possible anchor has been tested. No live
change or deployment authority follows from this local study.

### Accepted audit counts

Verified2026-09-06T20:46:55.186Z: **2,808 cases,2,171,455 overlapping trade records,28,080 monthly records**,24 exact saved overlap cases;15 actual feature and700 actual engine prefix checks. All input/source/artifact hashes matched. Pinned path helper:48 cases; additional read-only Q1/Q2 ledger-path inspection:4 cases. None adds a strategy or alters outcomes.

Main run used8GiB Node heap; independent verifier used16GiB because the2.13GB ledger is checked in memory. This is a local research resource requirement, not a VPS job. Only the successful completed replay is accepted; no historical rule was retuned after outputs. Re-running into an existing accepted output directory is refused.

## Complete attempted-definition ledger

All700 slots, including60 controls. Sorted by full immediate same-side clock delta, exactly as ranking.json. Four repeated I01 IDs are the daily1h trend0% long/short, each exit; not new hypotheses. Controls marked**control** and cannot qualify. All other rows are**subset** if in the descriptive shortlist, otherwise**failed/sparse**. No row is a deployment candidate.

Four net columns:full0m/full+1m/recent0m/recent+1m. n likewise. Worst month is Δ versus clock across all four cases. Failure keys:N=insufficient count;P=not positive in every case;B=not above clock in every case;M=monthly regression;C=extra costs nonpositive;E=equity exhausted diagnostic. **Sparse does not mean falsified family.** Exact definitions and failures remain in ranking.json; detailed W/L, fees and DD for every case in results.json/summary.csv.

| Exact ID | Status | F0 $ | F1 $ | R0 $ | R1 $ | n F0/F1/R0/R1 | Full0 Δ $ | Worst month Δ $ | Failures |
|---|---|---|---|---|---|---|---|---|---|
| `vwap_60m_day_into_t1_short_indicator_or12h` | failed/sparse | 4,128 | 3,829 | -3,549 | -3,482 | 486/484/117/117 | 26,411 | -1,881 | P,M,C |
| `vwap_240m_day_into_t1_short_fixed12h` | failed/sparse | 3,995 | -186 | -446 | -29 | 269/243/71/66 | 26,278 | -1,858 | P,M,C |
| `vwap_15m_day_into_t1_short_indicator_or12h` | failed/sparse | 3,911 | 1,525 | -2,781 | -3,039 | 716/715/173/173 | 26,194 | -1,202 | P,M,C |
| `vwap_60m_week_trend_t0.5_short_fixed12h` | failed/sparse | 2,839 | 2,528 | -2,630 | -2,675 | 232/224/56/55 | 25,122 | -1,778 | P,M,C |
| `vwap_30m_week_trend_t0.5_short_fixed12h` | failed/sparse | 2,510 | 1,639 | -3,163 | -3,181 | 248/239/60/59 | 24,793 | -2,312 | P,M,C |
| `vwap_240m_day_into_t0.5_short_indicator_or12h` | failed/sparse | 2,303 | 1,933 | -1,807 | -2,080 | 317/310/87/86 | 24,585 | -1,716 | P,M,C |
| `vwap_30m_day_into_t1_short_indicator_or12h` | failed/sparse | 2,298 | 937 | -2,511 | -2,927 | 597/593/146/145 | 24,581 | -1,607 | P,M,C |
| `rvol_240m_rolling20_follow_t2_short_indicator_or12h` | subset | 2,064 | 2,773 | 718 | 784 | 68/66/13/13 | 24,347 | -3,844 | M |
| `rvol_240m_rolling20_follow_t1.5_short_indicator_or12h` | failed/sparse | 1,900 | 1,944 | 327 | 786 | 127/122/37/36 | 24,182 | -3,282 | M,C |
| `rvol_240m_rolling20_follow_t2_short_fixed12h` | subset | 1,770 | 2,861 | 1,056 | 1,194 | 68/64/13/12 | 24,053 | -4,035 | M |
| `vwap_60m_day_into_t0.5_short_indicator_or12h` | failed/sparse | 1,766 | 611 | -5,623 | -5,980 | 716/710/180/176 | 24,049 | -1,869 | P,M,C |
| `vwap_60m_day_into_t1_short_fixed12h` | failed/sparse | 1,343 | 5,569 | -4,985 | -3,258 | 381/372/97/93 | 23,625 | -1,005 | P,M,C |
| `vwap_15m_week_trend_t1_short_fixed12h` | failed/sparse | 1,330 | 2,583 | -30 | 64 | 269/264/61/60 | 23,612 | -1,963 | P,M,C |
| `vwap_15m_week_into_t1_short_indicator_or12h` | failed/sparse | 1,328 | 802 | 1,189 | 1,147 | 361/361/90/90 | 23,610 | -2,864 | M,C |
| `vwap_60m_day_recovery_t1_short_fixed12h` | failed/sparse | 609 | 364 | -6,565 | -6,413 | 334/323/84/84 | 22,892 | -1,712 | P,M,C |
| `vwap_240m_day_into_t1_short_indicator_or12h` | failed/sparse | 527 | -1,324 | -1,596 | -2,311 | 277/263/71/68 | 22,809 | -1,709 | P,M,C |
| `rvol_240m_rolling20_follow_t1.5_short_fixed12h` | failed/sparse | 402 | 174 | 125 | 575 | 126/117/36/34 | 22,684 | -3,632 | M,C |
| `rvol_240m_time20_follow_t3_short_indicator_or12h` | failed/sparse | 395 | 127 | 280 | 337 | 15/15/4/4 | 22,677 | -2,485 | N,M,C |
| `vwap_240m_week_trend_t0_short_fixed12h` | failed/sparse | 377 | 3,516 | 955 | 910 | 172/156/38/33 | 22,659 | -2,430 | M,C |
| `rvol_60m_rolling20_follow_t3_short_indicator_or12h` | failed/sparse | 291 | 182 | 47 | 46 | 102/102/22/22 | 22,574 | -3,016 | M,C |
| `vwap_240m_day_trend_t0_short_fixed12h` | failed/sparse | 199 | 2,814 | -2,169 | -765 | 313/287/78/71 | 22,481 | -3,835 | P,M,C |
| `vwap_15m_week_trend_t0.5_short_fixed12h` | failed/sparse | 124 | 448 | -3,139 | -3,131 | 273/268/65/65 | 22,406 | -3,566 | P,M,C |
| `rvol_240m_time20_follow_t3_short_fixed12h` | failed/sparse | 123 | -204 | 194 | 243 | 15/15/4/4 | 22,406 | -2,495 | N,P,M,C |
| `vwap_15m_week_into_t0.5_short_indicator_or12h` | failed/sparse | 122 | -2,013 | -6 | -733 | 519/518/131/131 | 22,404 | -2,816 | P,M,C |
| `vwap_240m_day_into_t0.5_short_fixed12h` | failed/sparse | 57 | -1,343 | -2,609 | -1,482 | 304/271/86/79 | 22,340 | -1,479 | P,M,C |
| `rvol_240m_rolling20_follow_t3_short_indicator_or12h` | failed/sparse | 33 | -304 | 839 | 812 | 20/19/4/4 | 22,315 | -2,319 | N,P,M,C |
| `rvol_240m_rolling20_follow_t3_short_fixed12h` | failed/sparse | 22 | -403 | 752 | 715 | 20/19/4/4 | 22,305 | -2,241 | N,P,M,C |
| `vwap_60m_day_recovery_t1_short_indicator_or12h` | failed/sparse | -8 | -1,993 | -5,682 | -5,481 | 423/391/99/94 | 22,275 | -2,076 | P,M,C |
| `vwap_30m_week_into_t0.5_short_indicator_or12h` | failed/sparse | -383 | -1,703 | -717 | -1,060 | 410/408/104/104 | 21,899 | -2,151 | P,M,C |
| `vwap_5m_day_into_t1_short_indicator_or12h` | failed/sparse | -417 | -1,097 | -2,648 | -2,047 | 870/869/212/212 | 21,866 | -853 | P,M,C |
| `vwap_5m_week_trend_t1_short_fixed12h` | failed/sparse | -481 | 685 | -1,949 | -2,023 | 289/288/67/67 | 21,802 | -1,300 | P,M,C |
| `vwap_30m_week_trend_t0_short_fixed12h` | failed/sparse | -485 | 144 | -3,745 | -3,704 | 254/245/64/63 | 21,798 | -1,993 | P,M,C |
| `vwap_30m_day_into_t0.5_short_indicator_or12h` | failed/sparse | -546 | -2,986 | -4,624 | -4,769 | 921/920/226/226 | 21,737 | -1,767 | P,M,C |
| `vwap_5m_week_recovery_t0.5_short_fixed12h` | failed/sparse | -578 | -158 | -4,022 | -4,003 | 303/302/74/74 | 21,705 | -2,501 | P,M,C |
| `vwap_60m_week_into_t0.5_short_indicator_or12h` | failed/sparse | -620 | -1,192 | -1,122 | -1,360 | 325/324/82/81 | 21,663 | -1,936 | P,M,C |
| `vwap_5m_week_into_t1_short_indicator_or12h` | failed/sparse | -720 | -1,796 | 577 | 697 | 443/443/108/108 | 21,562 | -2,422 | P,M,C |
| `vwap_15m_day_into_t0.5_short_indicator_or12h` | failed/sparse | -808 | -3,873 | -4,531 | -5,740 | 1161/1161/277/277 | 21,475 | -1,858 | P,M,C |
| `vwap_15m_week_recovery_t0.5_short_fixed12h` | failed/sparse | -1,289 | -538 | -4,705 | -5,521 | 281/273/72/71 | 20,994 | -2,479 | P,M,C |
| `vwap_240m_week_recovery_t0.5_short_indicator_or12h` | failed/sparse | -1,375 | -104 | -131 | 909 | 172/153/40/36 | 20,908 | -3,037 | P,M,C |
| `rvol_240m_time20_fade_t1.5_short_indicator_or12h` | failed/sparse | -1,388 | -1,944 | -1,475 | -1,318 | 94/91/25/23 | 20,895 | -1,310 | P,M,C |
| `vwap_30m_week_into_t1_short_indicator_or12h` | failed/sparse | -1,477 | -1,964 | -618 | -850 | 298/295/77/75 | 20,806 | -1,760 | P,M,C |
| `vwap_60m_week_trend_t0_short_fixed12h` | failed/sparse | -1,516 | -523 | -3,979 | -4,110 | 238/225/60/56 | 20,766 | -2,392 | P,M,C |
| `vwap_240m_week_into_t0.5_short_indicator_or12h` | failed/sparse | -1,831 | -2,183 | 1,165 | 1,152 | 173/169/41/39 | 20,451 | -1,959 | P,M,C |
| `vwap_60m_week_into_t1_short_indicator_or12h` | failed/sparse | -1,895 | -1,589 | -1,267 | -1,293 | 260/255/67/65 | 20,387 | -1,418 | P,M,C |
| `rvol_60m_rolling20_follow_t3_short_fixed12h` | failed/sparse | -1,915 | -1,976 | -553 | -307 | 97/96/21/20 | 20,368 | -4,308 | P,M,C |
| `vwap_5m_week_into_t0.5_short_indicator_or12h` | failed/sparse | -1,969 | -2,792 | -438 | -583 | 689/688/172/172 | 20,314 | -3,549 | P,M,C |
| `vwap_5m_week_trend_t0.5_short_fixed12h` | failed/sparse | -2,067 | -324 | -3,467 | -3,350 | 302/302/71/71 | 20,216 | -2,284 | P,M,C |
| `vwap_60m_week_recovery_t1_short_fixed12h` | failed/sparse | -2,150 | -1,943 | -2,073 | -1,222 | 204/197/50/47 | 20,133 | -2,502 | P,M,C |
| `vwap_5m_week_trend_t0_short_fixed12h` | failed/sparse | -2,345 | -1,981 | -4,458 | -4,083 | 313/313/73/73 | 19,937 | -1,810 | P,M,C |
| `rvol_60m_time20_fade_t1.5_short_fixed12h` | failed/sparse | -2,377 | -2,418 | -3,626 | -3,830 | 260/254/65/63 | 19,905 | -826 | P,M,C |
| `vwap_60m_week_into_t1_short_fixed12h` | failed/sparse | -2,423 | -1,624 | -1,774 | -1,174 | 217/207/52/51 | 19,860 | -1,754 | P,M,C |
| `vwap_240m_week_recovery_t0.5_short_fixed12h` | failed/sparse | -2,456 | -659 | 623 | 1,492 | 162/148/39/36 | 19,827 | -4,412 | P,M,C |
| `rvol_240m_time20_fade_t1.5_short_fixed12h` | failed/sparse | -2,480 | -4,524 | -1,783 | -1,566 | 94/89/25/23 | 19,803 | -1,247 | P,M,C |
| `vwap_5m_week_into_t1_short_fixed12h` | failed/sparse | -2,483 | -3,979 | -2,704 | -3,033 | 280/280/65/65 | 19,800 | -2,073 | P,M,C |
| `rvol_240m_rolling20_fade_t3_short_fixed12h` | failed/sparse | -2,525 | -2,915 | -717 | -694 | 20/19/5/5 | 19,758 | -2,646 | N,P,M,C |
| `vwap_60m_week_trend_t1_short_fixed12h` | failed/sparse | -2,808 | -2,850 | -371 | -13 | 226/220/55/53 | 19,475 | -2,588 | P,M,C |
| `vwap_15m_week_into_t2_short_indicator_or12h` | failed/sparse | -2,866 | -3,000 | 193 | 73 | 229/228/59/58 | 19,417 | -3,886 | P,M,C |
| `vwap_5m_week_into_t0.5_short_fixed12h` | failed/sparse | -2,924 | -3,160 | -3,276 | -3,423 | 304/303/74/74 | 19,359 | -3,172 | P,M,C |
| `rvol_240m_rolling20_fade_t3_short_indicator_or12h` | failed/sparse | -2,935 | -3,206 | -1,052 | -1,006 | 20/19/5/5 | 19,347 | -2,407 | N,P,M,C |
| `vwap_60m_week_recovery_t1_short_indicator_or12h` | failed/sparse | -2,967 | -2,165 | -2,563 | -1,493 | 253/234/65/59 | 19,316 | -1,723 | P,M,C |
| `rvol_60m_rolling20_follow_t2_short_indicator_or12h` | failed/sparse | -3,038 | -2,737 | -2,108 | -2,228 | 312/311/78/78 | 19,244 | -2,736 | P,M,C |
| `vwap_5m_day_into_t2_short_indicator_or12h` | failed/sparse | -3,080 | -3,994 | -1,691 | -869 | 365/365/90/90 | 19,203 | -1,766 | P,M,C |
| `vwap_5m_week_into_t2_short_indicator_or12h` | failed/sparse | -3,097 | -3,428 | -364 | -212 | 264/264/67/67 | 19,186 | -3,655 | P,M,C |
| `vwap_15m_week_recovery_t1_short_fixed12h` | failed/sparse | -3,149 | -4,495 | -1,545 | -1,864 | 246/244/60/59 | 19,133 | -1,960 | P,M,C |
| `vwap_240m_week_recovery_t1_short_indicator_or12h` | failed/sparse | -3,185 | -2,622 | -2,282 | -1,445 | 143/132/38/34 | 19,098 | -2,764 | P,M,C |
| `vwap_240m_week_trend_t0.5_short_fixed12h` | failed/sparse | -3,203 | -1,526 | -461 | -559 | 169/156/34/33 | 19,080 | -3,437 | P,M,C |
| `vwap_60m_day_trend_t0.5_short_fixed12h` | failed/sparse | -3,288 | -4,702 | -820 | -645 | 458/435/104/98 | 18,995 | -2,438 | P,M,C |
| `vwap_240m_week_trend_t0_short_indicator_or12h` | failed/sparse | -3,336 | -3,555 | 118 | 318 | 192/192/40/40 | 18,946 | -3,745 | P,M,C |
| `vwap_30m_week_trend_t1_short_fixed12h` | failed/sparse | -3,354 | -2,866 | -798 | -877 | 247/242/59/58 | 18,928 | -2,991 | P,M,C |
| `vwap_30m_week_into_t2_short_indicator_or12h` | failed/sparse | -3,380 | -3,816 | 281 | 47 | 210/209/57/56 | 18,902 | -3,981 | P,M,C |
| `vwap_15m_week_into_t1_short_fixed12h` | failed/sparse | -3,412 | -3,917 | -3,220 | -3,125 | 256/256/62/62 | 18,870 | -2,202 | P,M,C |
| `vwap_240m_week_recovery_t2_short_indicator_or12h` | failed/sparse | -3,475 | -3,459 | -3,119 | -3,388 | 116/106/29/27 | 18,808 | -2,354 | P,M,C |
| `vwap_15m_week_trend_t0_short_fixed12h` | failed/sparse | -3,693 | -2,701 | -4,477 | -4,593 | 287/285/69/69 | 18,590 | -1,925 | P,M,C |
| `vwap_240m_day_trend_t0_short_indicator_or12h` | failed/sparse | -3,771 | -2,843 | -2,035 | -1,643 | 345/345/84/84 | 18,512 | -5,975 | P,M,C |
| `vwap_30m_week_recovery_t1_short_indicator_or12h` | failed/sparse | -3,780 | -4,818 | -355 | -304 | 300/283/78/73 | 18,503 | -1,612 | P,M,C |
| `vwap_30m_day_trend_t0.5_short_fixed12h` | failed/sparse | -3,783 | -6,197 | -2,137 | -1,273 | 503/492/113/112 | 18,500 | -2,493 | P,M,C |
| `vwap_15m_day_into_t2_short_indicator_or12h` | failed/sparse | -3,902 | -5,243 | -2,305 | -2,343 | 312/312/77/77 | 18,381 | -1,554 | P,M,C |
| `vwap_15m_day_trend_t1_short_fixed12h` | failed/sparse | -3,945 | -5,310 | -1,437 | -905 | 443/433/98/94 | 18,338 | -2,304 | P,M,C |
| `vwap_30m_day_recovery_t1_short_indicator_or12h` | failed/sparse | -3,974 | -4,472 | -2,878 | -3,201 | 547/519/131/126 | 18,309 | -1,795 | P,M,C |
| `vwap_5m_week_recovery_t1_short_fixed12h` | failed/sparse | -4,008 | -3,774 | -1,820 | -1,912 | 276/275/64/64 | 18,274 | -2,673 | P,M,C |
| `vwap_5m_week_recovery_t0.5_short_indicator_or12h` | failed/sparse | -4,018 | -3,851 | -700 | -818 | 713/666/178/168 | 18,265 | -2,727 | P,M,C |
| `rvol_240m_rolling20_fade_t2_short_fixed12h` | failed/sparse | -4,065 | -4,571 | 477 | 539 | 65/64/18/18 | 18,218 | -1,849 | P,M,C |
| `rvol_240m_time20_follow_t2_short_indicator_or12h` | failed/sparse | -4,079 | -2,599 | -723 | -476 | 49/45/9/8 | 18,203 | -3,368 | N,P,M,C |
| `rvol_240m_rolling20_fade_t2_short_indicator_or12h` | failed/sparse | -4,125 | -4,469 | 107 | 157 | 65/64/18/18 | 18,157 | -1,178 | P,M,C |
| `rvol_240m_time20_fade_t2_short_indicator_or12h` | failed/sparse | -4,249 | -5,026 | -701 | -737 | 46/45/10/10 | 18,033 | -1,985 | P,M,C |
| `vwap_60m_week_trend_t0.5_short_indicator_or12h` | failed/sparse | -4,266 | -3,941 | -369 | -351 | 316/316/71/71 | 18,017 | -2,817 | P,M,C |
| `rvol_240m_time20_follow_t2_short_fixed12h` | failed/sparse | -4,298 | -2,795 | -657 | -399 | 49/45/9/8 | 17,985 | -3,301 | N,P,M,C |
| `vwap_30m_day_into_t1_short_fixed12h` | failed/sparse | -4,322 | -3,343 | -4,970 | -5,035 | 423/415/109/105 | 17,961 | -917 | P,M,C |
| `vwap_240m_week_recovery_t2_short_fixed12h` | failed/sparse | -4,374 | -4,125 | -2,886 | -3,140 | 113/105/29/27 | 17,908 | -2,324 | P,M,C |
| `vwap_240m_week_trend_t0.5_short_indicator_or12h` | failed/sparse | -4,405 | -4,338 | -734 | -555 | 180/174/37/37 | 17,878 | -3,515 | P,M,C |
| `vwap_60m_day_recovery_t0.5_short_fixed12h` | failed/sparse | -4,463 | -3,315 | -8,351 | -7,706 | 442/425/111/109 | 17,820 | -1,573 | P,M,C |
| `vwap_240m_day_trend_t0.5_short_fixed12h` | failed/sparse | -4,493 | -3,319 | -1,505 | -253 | 299/277/69/63 | 17,790 | -5,222 | P,M,C |
| `rvol_60m_rolling20_fade_t3_short_indicator_or12h` | failed/sparse | -4,508 | -4,512 | -645 | -621 | 97/97/31/31 | 17,774 | -2,162 | P,M,C |
| `vwap_15m_week_into_t0.5_short_fixed12h` | failed/sparse | -4,537 | -6,390 | -1,968 | -4,613 | 282/276/71/66 | 17,746 | -2,998 | P,M,C |
| `vwap_60m_day_trend_t0_short_fixed12h` | failed/sparse | -4,683 | -3,002 | -7,154 | -5,507 | 493/470/126/118 | 17,599 | -1,536 | P,M,C |
| `vwap_30m_week_recovery_t2_short_indicator_or12h` | failed/sparse | -4,726 | -4,126 | -1,239 | -848 | 205/202/55/54 | 17,556 | -2,556 | P,M,C |
| `vwap_30m_week_recovery_t0.5_short_fixed12h` | failed/sparse | -4,751 | -2,026 | -4,757 | -5,065 | 257/246/65/63 | 17,531 | -3,326 | P,M,C |
| `vwap_240m_week_into_t0.5_short_fixed12h` | failed/sparse | -4,803 | -6,314 | 239 | -186 | 165/154/40/36 | 17,479 | -3,285 | P,M,C |
| `vwap_30m_week_recovery_t1_short_fixed12h` | failed/sparse | -4,868 | -4,778 | -2,685 | -2,819 | 221/215/53/52 | 17,415 | -1,748 | P,M,C |
| `rvol_240m_rolling20_fade_t1.5_short_indicator_or12h` | failed/sparse | -4,922 | -4,576 | -1,380 | -1,194 | 126/121/36/34 | 17,361 | -1,137 | P,M,C |
| `vwap_30m_week_recovery_t0.5_short_indicator_or12h` | failed/sparse | -5,011 | -4,390 | -1,838 | -1,332 | 429/379/112/96 | 17,272 | -2,194 | P,M,C |
| `vwap_15m_week_into_t2_short_fixed12h` | failed/sparse | -5,016 | -5,180 | -1,205 | -1,385 | 206/204/53/52 | 17,266 | -3,710 | P,M,C |
| `vwap_30m_week_into_t1_short_fixed12h` | failed/sparse | -5,061 | -5,992 | -4,356 | -4,186 | 229/224/56/55 | 17,221 | -1,821 | P,M,C |
| `vwap_240m_day_trend_t0.5_short_indicator_or12h` | failed/sparse | -5,073 | -4,546 | -1,859 | -1,259 | 315/310/73/72 | 17,209 | -5,258 | P,M,C |
| `vwap_15m_week_recovery_t0.5_short_indicator_or12h` | failed/sparse | -5,080 | -5,440 | -1,237 | -1,467 | 553/492/141/124 | 17,202 | -3,472 | P,M,C |
| `rvol_60m_time20_fade_t2_short_fixed12h` | failed/sparse | -5,094 | -4,698 | -2,703 | -2,673 | 187/181/52/49 | 17,189 | -1,393 | P,M,C |
| `vwap_5m_week_trend_t2_short_fixed12h` | failed/sparse | -5,198 | -5,617 | -1,382 | -1,280 | 248/247/55/55 | 17,085 | -2,162 | P,M,C |
| `vwap_60m_week_into_t2_short_indicator_or12h` | failed/sparse | -5,210 | -5,518 | -1,013 | -1,320 | 184/181/49/48 | 17,072 | -2,961 | P,M,C |
| `vwap_30m_day_recovery_t1_short_fixed12h` | failed/sparse | -5,285 | -7,334 | -7,872 | -8,471 | 390/381/98/96 | 16,997 | -2,523 | P,M,C |
| `vwap_240m_week_into_t1_short_indicator_or12h` | failed/sparse | -5,292 | -5,379 | 748 | 408 | 159/151/43/42 | 16,991 | -2,480 | P,M,C |
| `vwap_60m_week_recovery_t0.5_short_indicator_or12h` | failed/sparse | -5,409 | -5,103 | -2,822 | -1,997 | 332/290/84/74 | 16,874 | -2,039 | P,M,C |
| `rvol_240m_time20_follow_t1.5_short_indicator_or12h` | failed/sparse | -5,422 | -4,629 | -357 | -75 | 106/103/23/22 | 16,861 | -3,374 | P,M,C |
| `vwap_240m_week_trend_t2_short_fixed12h` | failed/sparse | -5,562 | -4,529 | -1,096 | -562 | 151/137/32/30 | 16,720 | -2,749 | P,M,C |
| `vwap_30m_day_into_t2_short_indicator_or12h` | failed/sparse | -5,564 | -6,210 | -2,229 | -3,070 | 280/274/72/69 | 16,719 | -1,650 | P,M,C |
| `vwap_15m_week_recovery_t1_short_indicator_or12h` | failed/sparse | -5,577 | -5,345 | -1,091 | -584 | 360/347/91/88 | 16,706 | -1,946 | P,M,C |
| `vwap_240m_week_into_t1_short_fixed12h` | failed/sparse | -5,585 | -7,213 | 911 | 86 | 154/141/42/40 | 16,698 | -3,061 | P,M,C |
| `rvol_240m_time20_fade_t2_short_fixed12h` | failed/sparse | -5,693 | -6,406 | -737 | -772 | 46/45/10/10 | 16,590 | -2,443 | P,M,C |
| `rvol_240m_time20_fade_t3_short_indicator_or12h` | failed/sparse | -5,725 | -5,355 | -1,360 | -1,135 | 20/19/7/6 | 16,557 | -2,407 | N,P,M,C |
| `vwap_30m_day_trend_t0_short_fixed12h` | failed/sparse | -5,747 | -5,403 | -6,219 | -4,386 | 553/534/138/135 | 16,536 | -1,185 | P,M,C |
| `vwap_240m_day_into_t2_short_fixed12h` | failed/sparse | -5,776 | -7,427 | -1,720 | -1,717 | 155/146/43/41 | 16,507 | -2,563 | P,M,C |
| `vwap_240m_day_recovery_t1_short_indicator_or12h` | failed/sparse | -5,784 | -5,617 | -2,464 | -2,681 | 200/190/49/47 | 16,499 | -3,204 | P,M,C |
| `rvol_240m_time20_fade_t3_short_fixed12h` | failed/sparse | -5,802 | -5,431 | -1,360 | -1,138 | 20/19/7/6 | 16,481 | -2,646 | N,P,M,C |
| `vwap_30m_week_into_t0.5_short_fixed12h` | failed/sparse | -5,874 | -5,077 | -2,328 | -3,601 | 257/251/65/62 | 16,409 | -2,317 | P,M,C |
| `vwap_60m_week_recovery_t2_short_indicator_or12h` | failed/sparse | -5,894 | -3,797 | -2,640 | -322 | 175/167/47/44 | 16,389 | -1,481 | P,M,C |
| `vwap_60m_week_into_t2_short_fixed12h` | failed/sparse | -5,927 | -7,197 | -794 | -1,283 | 173/170/45/45 | 16,356 | -3,029 | P,M,C |
| `vwap_240m_week_recovery_t1_short_fixed12h` | failed/sparse | -5,930 | -4,383 | -1,997 | -1,269 | 138/130/38/34 | 16,352 | -3,414 | P,M,C |
| `vwap_60m_week_recovery_t0.5_short_fixed12h` | failed/sparse | -5,932 | -4,169 | -2,791 | -3,087 | 238/225/61/59 | 16,351 | -3,130 | P,M,C |
| `vwap_240m_day_into_t2_short_indicator_or12h` | failed/sparse | -6,006 | -6,343 | -1,947 | -2,397 | 159/152/44/41 | 16,276 | -2,313 | P,M,C |
| `vwap_5m_day_recovery_t2_short_indicator_or12h` | failed/sparse | -6,073 | -6,397 | -478 | -165 | 345/344/83/82 | 16,210 | -1,990 | P,M,C |
| `vwap_15m_week_recovery_t2_short_indicator_or12h` | failed/sparse | -6,097 | -5,995 | -858 | -812 | 229/228/58/58 | 16,186 | -3,563 | P,M,C |
| `vwap_5m_week_into_t2_short_fixed12h` | failed/sparse | -6,117 | -6,940 | -2,210 | -2,157 | 228/227/59/59 | 16,166 | -3,281 | P,M,C |
| `vwap_240m_week_into_t2_short_indicator_or12h` | failed/sparse | -6,124 | -7,563 | -1,126 | -1,516 | 132/125/36/33 | 16,158 | -3,130 | P,M,C |
| `rvol_240m_rolling20_fade_t1.5_short_fixed12h` | failed/sparse | -6,181 | -6,207 | -961 | -221 | 125/117/36/33 | 16,102 | -1,817 | P,M,C |
| `vwap_60m_day_recovery_t2_short_indicator_or12h` | failed/sparse | -6,232 | -4,987 | -2,943 | -1,415 | 196/186/47/43 | 16,050 | -2,135 | P,M,C |
| `vwap_30m_week_into_t2_short_fixed12h` | failed/sparse | -6,257 | -6,164 | -1,160 | -1,152 | 192/192/51/51 | 16,025 | -3,617 | P,M,C |
| `vwap_240m_week_trend_t1_short_indicator_or12h` | failed/sparse | -6,259 | -5,783 | 523 | 447 | 173/164/37/36 | 16,024 | -4,160 | P,M,C |
| `vwap_240m_week_trend_t2_short_indicator_or12h` | failed/sparse | -6,304 | -6,216 | -1,173 | -639 | 152/143/33/31 | 15,979 | -2,009 | P,M,C |
| `rvol_15m_time20_fade_t3_short_fixed12h` | failed/sparse | -6,316 | -6,066 | -4,377 | -4,112 | 263/263/68/68 | 15,967 | -718 | P,M,C |
| `rvol_30m_time20_fade_t3_short_indicator_or12h` | failed/sparse | -6,342 | -6,313 | -730 | -633 | 189/189/54/54 | 15,940 | -3,026 | P,M,C |
| `vwap_5m_week_recovery_t1_short_indicator_or12h` | failed/sparse | -6,349 | -5,482 | -78 | 399 | 441/435/108/108 | 15,934 | -1,617 | P,M,C |
| `vwap_240m_day_recovery_t1_short_fixed12h` | failed/sparse | -6,365 | -4,475 | -4,070 | -3,961 | 194/188/48/47 | 15,918 | -4,584 | P,M,C |
| `vwap_60m_day_into_t2_short_indicator_or12h` | failed/sparse | -6,377 | -6,524 | -3,841 | -4,572 | 245/239/61/57 | 15,905 | -1,958 | P,M,C |
| `vwap_5m_day_into_t2_short_fixed12h` | failed/sparse | -6,434 | -7,077 | -4,145 | -3,837 | 285/285/71/71 | 15,848 | -1,790 | P,M,C |
| `vwap_60m_week_trend_t0_short_indicator_or12h` | failed/sparse | -6,443 | -6,106 | -2,411 | -2,451 | 392/392/95/95 | 15,840 | -3,023 | P,M,C |
| `vwap_30m_day_trend_t1_short_fixed12h` | failed/sparse | -6,470 | -5,915 | -1,405 | -885 | 410/401/89/85 | 15,812 | -3,248 | P,M,C |
| `rvol_30m_rolling20_fade_t2_short_fixed12h` | failed/sparse | -6,532 | -6,915 | -2,931 | -3,789 | 358/354/98/97 | 15,751 | -2,094 | P,M,C |
| `vwap_5m_day_trend_t1_short_fixed12h` | failed/sparse | -6,645 | -6,700 | -2,298 | -2,799 | 480/476/106/105 | 15,637 | -1,801 | P,M,C |
| `vwap_60m_day_recovery_t0.5_short_indicator_or12h` | failed/sparse | -6,689 | -5,111 | -7,374 | -6,580 | 672/598/162/145 | 15,593 | -2,967 | P,M,C |
| `vwap_30m_week_trend_t0.5_short_indicator_or12h` | failed/sparse | -6,754 | -5,247 | -1,064 | -1,189 | 390/389/88/88 | 15,528 | -3,090 | P,M,C |
| `vwap_240m_week_into_t2_short_fixed12h` | failed/sparse | -6,777 | -8,708 | -1,425 | -1,826 | 131/121/36/32 | 15,506 | -3,574 | P,M,C |
| `vwap_240m_day_recovery_t2_short_indicator_or12h` | failed/sparse | -6,839 | -7,097 | -2,723 | -3,177 | 95/90/26/23 | 15,444 | -3,499 | P,M,C |
| `vwap_60m_day_recovery_t2_short_fixed12h` | failed/sparse | -6,844 | -5,600 | -1,218 | -269 | 181/174/45/42 | 15,438 | -2,036 | P,M,C |
| `rvol_60m_time20_fade_t1.5_short_indicator_or12h` | failed/sparse | -7,171 | -7,594 | -1,885 | -1,719 | 352/350/94/94 | 15,112 | -1,911 | P,M,C |
| `rvol_30m_rolling20_follow_t3_short_indicator_or12h` | failed/sparse | -7,214 | -7,295 | -1,951 | -2,165 | 276/276/66/66 | 15,068 | -2,338 | P,M,C |
| `vwap_30m_day_into_t0.5_short_fixed12h` | failed/sparse | -7,281 | -10,653 | -8,300 | -7,462 | 518/502/130/128 | 15,002 | -1,486 | P,M,C |
| `rvol_60m_rolling20_fade_t2_short_indicator_or12h` | failed/sparse | -7,319 | -7,261 | -110 | -272 | 255/255/71/71 | 14,963 | -1,517 | P,M,C |
| `rvol_30m_time20_fade_t3_short_fixed12h` | failed/sparse | -7,340 | -6,373 | -1,741 | -1,517 | 157/157/47/47 | 14,943 | -2,991 | P,M,C |
| `vwap_60m_week_trend_t2_short_fixed12h` | failed/sparse | -7,435 | -5,463 | -1,800 | -1,308 | 198/193/42/41 | 14,847 | -1,220 | P,M,C |
| `vwap_240m_day_recovery_t0.5_short_indicator_or12h` | failed/sparse | -7,461 | -7,369 | -1,382 | -1,325 | 280/254/65/59 | 14,822 | -3,114 | P,M,C |
| `rvol_60m_time20_follow_t2_short_indicator_or12h` | failed/sparse | -7,496 | -7,240 | -1,586 | -1,499 | 245/245/61/61 | 14,787 | -3,510 | P,M,C |
| `rvol_15m_rolling20_fade_t3_short_indicator_or12h` | failed/sparse | -7,545 | -7,276 | -2,401 | -2,147 | 513/513/132/132 | 14,737 | -1,952 | P,M,C |
| `rvol_60m_rolling20_fade_t3_short_fixed12h` | failed/sparse | -7,553 | -7,013 | -1,844 | -1,497 | 95/95/29/29 | 14,730 | -2,469 | P,M,C |
| `vwap_60m_week_into_t0.5_short_fixed12h` | failed/sparse | -7,562 | -3,331 | -3,828 | -3,268 | 234/223/56/54 | 14,721 | -2,108 | P,M,C |
| `vwap_240m_day_trend_t1_short_fixed12h` | failed/sparse | -7,564 | -5,430 | -4,659 | -4,452 | 261/243/57/57 | 14,719 | -4,783 | P,M,C |
| `vwap_15m_day_into_t2_short_fixed12h` | failed/sparse | -7,677 | -7,228 | -3,888 | -3,682 | 260/260/65/65 | 14,605 | -2,042 | P,M,C |
| `vwap_15m_week_trend_t2_short_fixed12h` | failed/sparse | -7,679 | -5,490 | -1,387 | -603 | 236/233/54/53 | 14,603 | -2,598 | P,M,C |
| `vwap_240m_day_trend_t1_short_indicator_or12h` | failed/sparse | -7,749 | -7,614 | -4,072 | -3,789 | 268/261/60/60 | 14,533 | -5,320 | P,M,C |
| `vwap_60m_week_recovery_t2_short_fixed12h` | failed/sparse | -7,765 | -8,441 | -581 | -354 | 161/156/42/41 | 14,517 | -3,140 | P,M,C |
| `rvol_60m_time20_follow_t3_short_indicator_or12h` | failed/sparse | -7,770 | -7,859 | -898 | -827 | 103/103/25/25 | 14,513 | -3,776 | P,M,C |
| `vwap_60m_day_trend_t1_short_fixed12h` | failed/sparse | -7,999 | -11,351 | -2,415 | -3,105 | 377/367/81/77 | 14,284 | -4,210 | P,M,C |
| `vwap_30m_week_trend_t2_short_fixed12h` | failed/sparse | -8,017 | -6,630 | -2,744 | -1,817 | 216/213/47/46 | 14,265 | -2,186 | P,M,C |
| `rvol_30m_time20_fade_t2_short_indicator_or12h` | failed/sparse | -8,044 | -9,009 | -909 | -1,600 | 406/405/108/107 | 14,238 | -1,775 | P,M,C |
| `rvol_30m_rolling20_fade_t3_short_indicator_or12h` | failed/sparse | -8,099 | -8,687 | -2,706 | -3,143 | 226/226/72/72 | 14,183 | -1,724 | P,M,C |
| `rvol_240m_time20_follow_t1.5_short_fixed12h` | failed/sparse | -8,112 | -7,355 | -5 | 394 | 106/98/23/21 | 14,171 | -3,555 | P,M,C |
| `vwap_5m_week_recovery_t2_short_indicator_or12h` | failed/sparse | -8,143 | -8,356 | -804 | -535 | 268/267/65/65 | 14,140 | -4,468 | P,M,C |
| `vwap_240m_week_trend_t1_short_fixed12h` | failed/sparse | -8,163 | -6,094 | 26 | 46 | 169/158/36/35 | 14,120 | -4,981 | P,M,C |
| `vwap_15m_day_trend_t0.5_short_fixed12h` | failed/sparse | -8,191 | -6,090 | -2,397 | -2,736 | 545/536/131/128 | 14,092 | -1,191 | P,M,C |
| `vwap_15m_day_recovery_t0.5_short_indicator_or12h` | failed/sparse | -8,205 | -9,885 | -4,350 | -4,973 | 1183/1050/279/248 | 14,078 | -2,605 | P,M,C |
| `rvol_30m_time20_fade_t2_short_fixed12h` | failed/sparse | -8,247 | -9,850 | -2,791 | -3,329 | 286/283/72/72 | 14,036 | -1,063 | P,M,C |
| `vwap_5m_day_recovery_t1_short_indicator_or12h` | failed/sparse | -8,329 | -7,352 | -3,377 | -2,314 | 849/835/207/204 | 13,953 | -1,616 | P,M,C |
| `vwap_60m_week_trend_t2_short_indicator_or12h` | failed/sparse | -8,337 | -6,951 | -2,472 | -1,947 | 209/205/46/45 | 13,946 | -2,740 | P,M,C |
| `rvol_60m_time20_fade_t3_short_indicator_or12h` | failed/sparse | -8,351 | -8,002 | -1,097 | -926 | 96/96/26/26 | 13,931 | -2,786 | P,M,C |
| `vwap_60m_day_into_t0.5_short_fixed12h` | failed/sparse | -8,373 | -3,042 | -6,860 | -4,932 | 477/455/123/116 | 13,909 | -1,477 | P,M,C |
| `vwap_15m_day_into_t0.5_short_fixed12h` | failed/sparse | -8,411 | -7,674 | -6,574 | -6,363 | 557/550/143/140 | 13,871 | -411 | P,M,C |
| `vwap_60m_week_trend_t1_short_indicator_or12h` | failed/sparse | -8,494 | -8,149 | -1,605 | -1,229 | 271/269/65/64 | 13,788 | -3,191 | P,M,C |
| `vwap_240m_day_recovery_t2_short_fixed12h` | failed/sparse | -8,590 | -8,670 | -4,430 | -4,561 | 94/90/25/23 | 13,693 | -3,493 | P,M,C |
| `rvol_30m_rolling20_fade_t3_short_fixed12h` | failed/sparse | -8,626 | -8,702 | -4,372 | -4,768 | 201/201/62/62 | 13,656 | -2,137 | P,M,C |
| `rvol_60m_time20_fade_t3_short_fixed12h` | failed/sparse | -8,633 | -8,448 | -1,692 | -1,465 | 91/90/23/23 | 13,650 | -1,912 | P,M,C |
| `rvol_60m_time20_fade_t2_short_indicator_or12h` | failed/sparse | -8,755 | -7,611 | -2,061 | -1,202 | 218/216/62/61 | 13,528 | -1,570 | P,M,C |
| `rvol_30m_time20_fade_t1.5_short_fixed12h` | failed/sparse | -8,883 | -11,015 | -6,575 | -7,080 | 386/383/97/96 | 13,400 | -1,644 | P,M,C |
| `vwap_30m_day_recovery_t0.5_short_fixed12h` | failed/sparse | -9,013 | -2,999 | -9,531 | -8,680 | 491/484/121/118 | 13,269 | -1,211 | P,M,C |
| `vwap_15m_day_recovery_t1_short_indicator_or12h` | failed/sparse | -9,039 | -7,959 | -3,894 | -3,882 | 689/663/165/164 | 13,244 | -1,586 | P,M,C |
| `vwap_30m_week_recovery_t2_short_fixed12h` | failed/sparse | -9,122 | -8,259 | -1,764 | -1,528 | 185/183/50/49 | 13,161 | -3,840 | P,M,C |
| `vwap_5m_day_into_t0.5_short_indicator_or12h` | failed/sparse | -9,126 | -10,149 | -5,810 | -5,699 | 1499/1499/365/365 | 13,157 | -1,700 | P,M,C |
| `rvol_30m_rolling20_fade_t2_short_indicator_or12h` | failed/sparse | -9,157 | -10,316 | -1,580 | -2,027 | 547/547/151/151 | 13,125 | -1,482 | P,M,C |
| `vwap_15m_day_recovery_t0.5_short_fixed12h` | failed/sparse | -9,178 | -4,203 | -9,518 | -9,343 | 539/530/136/135 | 13,105 | -1,070 | P,M,C |
| `rvol_60m_rolling20_fade_t1.5_short_indicator_or12h` | failed/sparse | -9,253 | -9,376 | -2,177 | -2,583 | 428/427/124/124 | 13,030 | -1,959 | P,M,C |
| `rvol_30m_time20_follow_t3_short_fixed12h` | failed/sparse | -9,346 | -8,455 | -2,842 | -2,639 | 199/198/47/47 | 12,937 | -2,682 | P,M,C |
| `vwap_5m_day_into_t1_short_fixed12h` | failed/sparse | -9,358 | -8,789 | -5,727 | -6,253 | 494/492/127/127 | 12,924 | -718 | P,M,C |
| `vwap_30m_week_trend_t1_short_indicator_or12h` | failed/sparse | -9,400 | -8,549 | -2,040 | -2,020 | 314/312/72/72 | 12,882 | -3,348 | P,M,C |
| `vwap_30m_day_into_t2_short_fixed12h` | failed/sparse | -9,413 | -8,176 | -3,531 | -2,847 | 241/235/62/60 | 12,869 | -1,705 | P,M,C |
| `rvol_15m_rolling20_follow_t3_short_indicator_or12h` | failed/sparse | -9,418 | -9,473 | -2,873 | -3,347 | 606/606/152/152 | 12,864 | -2,364 | P,M,C |
| `rvol_60m_rolling20_follow_t1.5_short_indicator_or12h` | failed/sparse | -9,427 | -9,138 | -2,009 | -2,055 | 488/487/115/115 | 12,855 | -3,580 | P,M,C |
| `rvol_5m_rolling20_fade_t3_short_fixed12h` | failed/sparse | -9,471 | -6,393 | -4,621 | -2,973 | 614/613/155/154 | 12,811 | -570 | P,M,C |
| `rvol_60m_rolling20_fade_t2_short_fixed12h` | failed/sparse | -9,603 | -8,963 | -623 | -338 | 213/212/60/60 | 12,680 | -2,364 | P,M,C |
| `rvol_15m_rolling20_fade_t3_short_fixed12h` | failed/sparse | -9,680 | -10,409 | -3,204 | -3,525 | 340/336/91/90 | 12,603 | -2,530 | P,M,C |
| `vwap_5m_day_trend_t0.5_short_fixed12h` | failed/sparse | -9,707 | -7,948 | -1,941 | -1,849 | 576/575/136/136 | 12,575 | -1,256 | P,M,C |
| `rvol_60m_rolling20_fade_t1.5_short_fixed12h` | failed/sparse | -9,757 | -8,558 | -5,738 | -5,800 | 316/303/83/79 | 12,526 | -2,442 | P,M,C |
| `vwap_30m_day_recovery_t2_short_indicator_or12h` | failed/sparse | -9,806 | -10,029 | -1,324 | -1,278 | 242/235/59/56 | 12,476 | -2,304 | P,M,C |
| `vwap_30m_day_recovery_t0.5_short_indicator_or12h` | failed/sparse | -9,836 | -8,719 | -6,116 | -6,432 | 919/809/218/197 | 12,446 | -2,823 | P,M,C |
| `vwap_15m_day_into_t1_short_fixed12h` | failed/sparse | -9,860 | -8,283 | -6,419 | -6,389 | 458/455/116/115 | 12,423 | -847 | P,M,C |
| `vwap_15m_day_trend_t0_short_fixed12h` | failed/sparse | -9,972 | -6,610 | -7,125 | -6,547 | 597/583/151/149 | 12,310 | -1,256 | P,M,C |
| `vwap_30m_week_trend_t2_short_indicator_or12h` | failed/sparse | -9,998 | -8,293 | -2,244 | -2,134 | 234/232/51/51 | 12,284 | -3,328 | P,M,C |
| `vwap_240m_day_recovery_t0.5_short_fixed12h` | failed/sparse | -10,131 | -7,293 | -4,008 | -3,128 | 265/248/63/58 | 12,152 | -4,869 | P,M,C |
| `rvol_15m_time20_fade_t1.5_short_fixed12h` | failed/sparse | -10,140 | -12,587 | -7,177 | -7,813 | 521/510/132/129 | 12,143 | -787 | P,M,C |
| `vwap_60m_day_trend_t2_short_fixed12h` | failed/sparse | -10,161 | -9,724 | -4,397 | -3,179 | 219/214/48/47 | 12,121 | -4,346 | P,M,C |
| `vwap_60m_day_into_t2_short_fixed12h` | failed/sparse | -10,164 | -8,498 | -4,250 | -3,139 | 223/213/59/55 | 12,119 | -2,266 | P,M,C |
| `rvol_60m_time20_follow_t3_short_fixed12h` | failed/sparse | -10,199 | -9,208 | -923 | -745 | 96/93/22/20 | 12,083 | -2,750 | P,M,C |
| `vwap_30m_day_recovery_t2_short_fixed12h` | failed/sparse | -10,321 | -9,941 | -1,803 | -945 | 212/205/51/48 | 11,961 | -1,925 | P,M,C |
| `vwap_15m_week_trend_t2_short_indicator_or12h` | failed/sparse | -10,337 | -8,747 | -2,063 | -2,008 | 262/260/59/59 | 11,945 | -3,303 | P,M,C |
| `rvol_60m_rolling20_fade_t1.5_long_fixed12h` | failed/sparse | 15,243 | 14,451 | 112 | 397 | 349/341/77/76 | 11,939 | -4,790 | B,M,C |
| `vwap_15m_week_trend_t1_short_indicator_or12h` | failed/sparse | -10,405 | -8,902 | -2,308 | -1,826 | 370/368/80/80 | 11,878 | -3,003 | P,M,C |
| `vwap_15m_day_recovery_t2_short_indicator_or12h` | failed/sparse | -10,407 | -11,780 | -2,577 | -2,602 | 286/284/71/70 | 11,876 | -2,016 | P,M,C |
| `vwap_5m_week_trend_t1_short_indicator_or12h` | failed/sparse | -10,460 | -8,604 | -1,677 | -1,321 | 442/441/91/91 | 11,823 | -3,312 | P,M,C |
| `vwap_15m_week_trend_t0.5_short_indicator_or12h` | failed/sparse | -10,510 | -8,371 | -1,270 | -549 | 502/501/106/106 | 11,772 | -2,966 | P,M,C |
| `rvol_15m_time20_fade_t3_short_indicator_or12h` | failed/sparse | -10,534 | -10,713 | -3,016 | -2,674 | 402/402/102/102 | 11,748 | -1,941 | P,M,C |
| `vwap_15m_day_recovery_t1_short_fixed12h` | failed/sparse | -10,544 | -11,727 | -7,365 | -8,422 | 444/435/115/113 | 11,739 | -1,642 | P,M,C |
| `vwap_15m_week_recovery_t2_short_fixed12h` | failed/sparse | -10,567 | -10,427 | -2,391 | -2,236 | 207/207/53/53 | 11,715 | -4,849 | P,M,C |
| `rvol_30m_time20_follow_t3_short_indicator_or12h` | failed/sparse | -10,596 | -9,616 | -3,971 | -4,055 | 241/241/64/64 | 11,687 | -3,612 | P,M,C |
| `rvol_15m_time20_follow_t3_short_fixed12h` | failed/sparse | -10,772 | -9,143 | -6,061 | -5,391 | 289/287/76/75 | 11,510 | -2,122 | P,M,C |
| `rvol_30m_rolling20_follow_t2_short_indicator_or12h` | failed/sparse | -10,774 | -11,003 | -3,755 | -4,001 | 662/662/158/158 | 11,509 | -2,924 | P,M,C |
| `vwap_60m_day_trend_t0.5_short_indicator_or12h` | failed/sparse | -10,787 | -9,591 | -2,094 | -2,243 | 666/662/148/147 | 11,495 | -4,087 | P,M,C |
| `vwap_5m_day_recovery_t2_short_fixed12h` | failed/sparse | -10,805 | -11,010 | -3,155 | -3,137 | 271/271/64/64 | 11,478 | -2,359 | P,M,C |
| `vwap_240m_day_trend_t2_short_indicator_or12h` | failed/sparse | -10,835 | -9,724 | -1,959 | -1,396 | 159/155/33/31 | 11,447 | -3,110 | P,M,C |
| `rvol_30m_time20_follow_t2_short_indicator_or12h` | failed/sparse | -11,100 | -9,888 | -2,838 | -2,714 | 505/504/122/122 | 11,183 | -3,270 | P,M,C |
| `vwap_5m_week_trend_t2_short_indicator_or12h` | failed/sparse | -11,150 | -10,873 | -1,737 | -1,609 | 290/289/62/62 | 11,133 | -4,292 | P,M,C |
| `rvol_30m_time20_fade_t1.5_short_indicator_or12h` | failed/sparse | -11,278 | -11,422 | -2,591 | -2,222 | 708/707/188/187 | 11,005 | -2,399 | P,M,C |
| `vwap_240m_day_trend_t2_short_fixed12h` | failed/sparse | -11,377 | -9,270 | -2,720 | -1,542 | 159/150/33/29 | 10,905 | -2,654 | P,M,C |
| `rvol_15m_time20_fade_t2_short_fixed12h` | failed/sparse | -11,392 | -9,278 | -6,282 | -6,668 | 430/426/106/104 | 10,890 | -1,580 | P,M,C |
| `bar_direction_240m_rolling20_fade_t0_short_fixed12h` | control | -11,503 | -1,188 | -6,166 | -4,612 | 649/531/166/137 | 10,779 | -1,227 | P,M,C |
| `rvol_60m_time20_follow_t2_short_fixed12h` | failed/sparse | -11,521 | -10,423 | -2,574 | -2,699 | 206/198/47/45 | 10,762 | -2,756 | P,M,C |
| `vwap_15m_day_recovery_t2_short_fixed12h` | failed/sparse | -11,794 | -11,661 | -3,832 | -3,549 | 238/237/58/57 | 10,489 | -2,180 | P,M,C |
| `bar_direction_240m_time20_fade_t0_short_indicator_or12h` | control | -11,832 | -11,640 | -8,643 | -9,501 | 1035/744/272/193 | 10,451 | -2,301 | P,M,C |
| `vwap_5m_week_recovery_t2_short_fixed12h` | failed/sparse | -12,128 | -11,750 | -3,105 | -2,577 | 231/231/58/58 | 10,154 | -5,094 | P,M,C |
| `vwap_5m_day_into_t2_long_fixed12h` | subset | 13,302 | 11,799 | 3,098 | 3,030 | 302/301/64/64 | 9,998 | -5,791 | B,M |
| `bar_direction_240m_rolling20_fade_t0_short_indicator_or12h` | control | -12,364 | -9,307 | -8,837 | -8,089 | 1031/728/267/188 | 9,919 | -3,286 | P,M,C |
| `rvol_30m_rolling20_follow_t2_short_fixed12h` | failed/sparse | -12,405 | -13,429 | -5,252 | -5,263 | 407/404/95/94 | 9,878 | -1,426 | P,M,C |
| `rvol_60m_time20_follow_t1.5_short_fixed12h` | failed/sparse | -12,466 | -10,315 | -1,901 | -1,904 | 297/285/69/65 | 9,816 | -3,495 | P,M,C |
| `vwap_60m_day_trend_t1_short_indicator_or12h` | failed/sparse | -12,532 | -11,220 | -2,960 | -2,688 | 480/476/102/102 | 9,751 | -4,650 | P,M,C |
| `vwap_30m_day_trend_t2_short_indicator_or12h` | failed/sparse | -12,668 | -11,141 | -4,220 | -3,815 | 274/273/58/58 | 9,614 | -4,952 | P,M,C |
| `vwap_5m_day_recovery_t1_short_fixed12h` | failed/sparse | -13,020 | -12,528 | -6,956 | -7,036 | 486/484/125/124 | 9,262 | -1,603 | P,M,C |
| `vwap_30m_week_trend_t0_short_indicator_or12h` | failed/sparse | -13,043 | -10,996 | -4,026 | -4,163 | 578/578/137/137 | 9,239 | -2,885 | P,M,C |
| `rvol_60m_time20_follow_t1.5_short_indicator_or12h` | failed/sparse | -13,243 | -12,735 | -2,478 | -2,134 | 404/403/94/94 | 9,039 | -4,153 | P,M,C |
| `rvol_15m_rolling20_fade_t2_short_indicator_or12h` | failed/sparse | -13,592 | -13,583 | -4,229 | -4,284 | 1198/1198/315/315 | 8,691 | -2,521 | P,M,C |
| `rvol_30m_rolling20_follow_t3_short_fixed12h` | failed/sparse | -13,816 | -13,685 | -2,980 | -3,437 | 232/226/55/53 | 8,467 | -3,970 | P,M,C |
| `vwap_15m_day_into_t2_long_fixed12h` | subset | 11,650 | 9,675 | 3,520 | 3,448 | 275/273/60/59 | 8,346 | -6,091 | B,M |
| `rvol_15m_time20_fade_t2_short_indicator_or12h` | failed/sparse | -13,986 | -15,131 | -4,091 | -4,234 | 898/898/227/227 | 8,297 | -3,279 | P,M,C |
| `rvol_30m_time20_follow_t1.5_short_indicator_or12h` | failed/sparse | -14,055 | -12,364 | -2,675 | -2,338 | 775/774/173/173 | 8,227 | -3,386 | P,M,C |
| `vwap_60m_day_trend_t2_short_indicator_or12h` | failed/sparse | -14,131 | -12,917 | -4,787 | -4,398 | 238/236/51/51 | 8,151 | -5,411 | P,M,C |
| `rvol_15m_rolling20_fade_t1.5_short_fixed12h` | failed/sparse | -14,445 | -14,466 | -4,434 | -4,419 | 624/617/159/156 | 7,837 | -2,952 | P,M,C |
| `rvol_15m_time20_follow_t3_short_indicator_or12h` | failed/sparse | -14,502 | -14,151 | -4,013 | -3,900 | 491/491/129/129 | 7,781 | -2,641 | P,M,C |
| `rvol_30m_rolling20_fade_t1.5_short_indicator_or12h` | failed/sparse | -14,524 | -15,341 | -2,541 | -3,264 | 900/900/247/247 | 7,758 | -2,563 | P,M,C |
| `vwap_5m_day_into_t0.5_short_fixed12h` | failed/sparse | -14,555 | -14,198 | -6,095 | -6,203 | 594/590/151/151 | 7,728 | -1,374 | P,M,C |
| `vwap_30m_day_trend_t2_short_fixed12h` | failed/sparse | -14,807 | -14,322 | -5,752 | -4,487 | 250/248/55/54 | 7,476 | -5,187 | P,M,C |
| `vwap_5m_day_into_t2_long_indicator_or12h` | subset | 10,750 | 10,528 | 1,077 | 859 | 371/371/73/73 | 7,446 | -5,814 | B,M |
| `vwap_30m_day_trend_t1_short_indicator_or12h` | failed/sparse | -14,869 | -11,287 | -3,376 | -2,681 | 574/570/121/120 | 7,414 | -4,048 | P,M,C |
| `rvol_30m_rolling20_follow_t1.5_short_fixed12h` | failed/sparse | -14,946 | -16,446 | -3,788 | -4,438 | 514/500/129/124 | 7,336 | -1,692 | P,M,C |
| `rvol_5m_time20_fade_t3_long_fixed12h` | subset | 10,568 | 10,302 | 5,537 | 5,804 | 531/531/135/135 | 7,264 | -1,863 | M |
| `rvol_30m_rolling20_follow_t1.5_short_indicator_or12h` | failed/sparse | -15,096 | -14,680 | -5,815 | -5,671 | 1053/1053/268/268 | 7,187 | -3,401 | P,M,C |
| `rvol_5m_time20_follow_t1.5_short_fixed12h` | failed/sparse | -15,238 | -14,649 | -8,441 | -8,159 | 722/718/184/183 | 7,044 | -1,111 | P,M,C |
| `rvol_60m_rolling20_follow_t2_short_fixed12h` | failed/sparse | -15,369 | -14,613 | -5,573 | -5,375 | 254/249/62/62 | 6,914 | -3,763 | P,M,C |
| `rvol_15m_rolling20_follow_t3_short_fixed12h` | failed/sparse | -15,466 | -14,682 | -5,546 | -5,363 | 374/371/89/89 | 6,816 | -2,563 | P,M,C |
| `rvol_5m_time20_fade_t3_short_fixed12h` | failed/sparse | -15,753 | -16,195 | -6,376 | -6,394 | 516/512/132/131 | 6,529 | -1,768 | P,M,C |
| `rvol_60m_rolling20_fade_t2_long_fixed12h` | subset | 9,745 | 9,100 | 4,181 | 3,984 | 254/249/62/62 | 6,441 | -4,687 | B,M |
| `vwap_15m_day_trend_t2_short_indicator_or12h` | failed/sparse | -15,856 | -14,837 | -3,343 | -2,962 | 319/319/66/66 | 6,427 | -4,953 | P,M,C |
| `vwap_5m_week_trend_t0.5_short_indicator_or12h` | failed/sparse | -15,856 | -12,993 | -2,504 | -1,971 | 668/667/144/143 | 6,426 | -3,424 | P,M,C |
| `vwap_60m_day_trend_t0_short_indicator_or12h` | failed/sparse | -15,904 | -14,118 | -4,816 | -4,393 | 940/940/232/232 | 6,378 | -3,385 | P,M,C |
| `rvol_5m_rolling20_follow_t2_long_fixed12h` | subset | 9,567 | 8,198 | 5,565 | 5,415 | 725/720/184/183 | 6,263 | -1,173 | M |
| `vwap_5m_day_trend_t1_short_indicator_or12h` | failed/sparse | -16,060 | -14,503 | -3,276 | -3,569 | 808/808/164/164 | 6,223 | -4,165 | P,M,C |
| `vwap_5m_day_trend_t0_short_fixed12h` | failed/sparse | -16,105 | -15,153 | -9,822 | -9,692 | 646/643/165/164 | 6,177 | -2,307 | P,M,C |
| `rvol_30m_time20_fade_t2_long_fixed12h` | failed/sparse | 9,350 | 6,911 | -785 | -225 | 327/319/76/74 | 6,045 | -4,425 | P,B,M,C |
| `vwap_30m_day_into_t2_long_fixed12h` | subset | 9,272 | 8,831 | 4,515 | 3,272 | 250/248/55/54 | 5,967 | -5,562 | B,M |
| `rvol_5m_time20_follow_t2_short_fixed12h` | failed/sparse | -16,432 | -17,445 | -9,198 | -11,505 | 668/664/168/168 | 5,850 | -1,958 | P,B,M,C |
| `rvol_30m_time20_follow_t2_short_fixed12h` | failed/sparse | -16,580 | -13,962 | -910 | -1,426 | 327/319/76/74 | 5,702 | -3,852 | P,M,C |
| `rvol_15m_rolling20_fade_t2_short_fixed12h` | failed/sparse | -16,589 | -17,438 | -7,694 | -7,448 | 530/523/131/130 | 5,693 | -2,675 | P,M,C |
| `rvol_5m_rolling20_fade_t2_long_fixed12h` | subset | 8,885 | 8,132 | 3,358 | 3,470 | 740/736/184/184 | 5,581 | -2,627 | B,M |
| `vwap_60m_day_into_t2_long_indicator_or12h` | subset | 8,861 | 7,691 | 3,639 | 3,250 | 238/236/51/51 | 5,556 | -5,950 | B,M |
| `vwap_15m_day_into_t2_long_indicator_or12h` | subset | 8,802 | 7,784 | 1,867 | 1,485 | 319/319/66/66 | 5,498 | -6,412 | B,M |
| `vwap_5m_day_recovery_t0.5_short_indicator_or12h` | failed/sparse | -16,791 | -16,392 | -6,993 | -6,942 | 1510/1420/368/344 | 5,491 | -2,243 | P,M,C |
| `rvol_15m_time20_follow_t2_short_fixed12h` | failed/sparse | -16,873 | -17,914 | -5,643 | -5,366 | 447/444/111/110 | 5,410 | -2,258 | P,M,C |
| `rvol_5m_rolling20_follow_t3_short_fixed12h` | failed/sparse | -16,899 | -15,547 | -7,484 | -7,447 | 640/635/162/162 | 5,384 | -935 | P,M,C |
| `vwap_15m_day_trend_t1_short_indicator_or12h` | failed/sparse | -16,909 | -15,434 | -3,199 | -2,187 | 680/679/138/137 | 5,374 | -5,225 | P,M,C |
| `rvol_30m_rolling20_fade_t3_long_fixed12h` | subset | 8,677 | 8,678 | 1,745 | 2,246 | 232/226/55/53 | 5,373 | -4,936 | B,M |
| `rvol_5m_time20_fade_t2_short_fixed12h` | failed/sparse | -16,944 | -19,043 | -9,450 | -9,431 | 636/630/159/157 | 5,339 | -1,315 | P,M,C |
| `bar_direction_30m_rolling20_fade_t0_short_fixed12h` | control | -17,055 | -20,660 | -8,793 | -6,684 | 829/797/211/203 | 5,227 | -1,877 | P,M,C |
| `rvol_30m_rolling20_follow_t1.5_long_fixed12h` | subset | 8,319 | 8,118 | 4,787 | 5,869 | 474/462/123/119 | 5,014 | -2,659 | B,M |
| `rvol_30m_time20_follow_t1.5_short_fixed12h` | failed/sparse | -17,314 | -13,821 | -5,357 | -4,104 | 410/402/96/93 | 4,968 | -1,786 | P,M,C |
| `rvol_30m_time20_fade_t1.5_long_fixed12h` | subset | 8,258 | 4,944 | 3,219 | 2,033 | 410/402/96/93 | 4,954 | -3,154 | B,M |
| `bar_direction_240m_rolling20_fade_t0_long_fixed12h` | control | 8,142 | 8,556 | 5,311 | 9,898 | 646/526/160/136 | 4,837 | -3,673 | M |
| `rvol_60m_time20_fade_t3_long_fixed12h` | subset | 8,055 | 7,131 | 417 | 283 | 96/93/22/20 | 4,751 | -4,778 | B,M |
| `rvol_15m_rolling20_fade_t1.5_short_indicator_or12h` | failed/sparse | -17,568 | -18,992 | -6,877 | -7,285 | 1950/1950/513/513 | 4,715 | -2,952 | P,M,C |
| `vwap_240m_day_into_t2_long_fixed12h` | subset | 7,869 | 5,962 | 1,991 | 903 | 159/150/33/29 | 4,564 | -5,572 | B,M |
| `vwap_15m_day_trend_t2_short_fixed12h` | failed/sparse | -17,739 | -15,717 | -4,866 | -4,772 | 275/273/60/59 | 4,544 | -4,366 | P,M,C |
| `vwap_15m_week_trend_t0_short_indicator_or12h` | failed/sparse | -17,761 | -15,992 | -4,543 | -4,313 | 880/880/195/195 | 4,522 | -3,318 | P,M,C |
| `rvol_15m_rolling20_follow_t2_short_indicator_or12h` | failed/sparse | -17,798 | -17,074 | -3,652 | -3,832 | 1321/1321/334/334 | 4,484 | -2,241 | P,M,C |
| `bar_direction_60m_rolling20_fade_t0_long_fixed12h` | control | 7,776 | 9,039 | 3,212 | 5,647 | 801/743/202/188 | 4,471 | -1,721 | B,M,C |
| `vwap_5m_day_recovery_t0.5_short_fixed12h` | failed/sparse | -18,034 | -15,624 | -9,879 | -9,805 | 581/576/149/148 | 4,248 | -1,928 | P,M,C |
| `rvol_15m_time20_follow_t1.5_short_fixed12h` | failed/sparse | -18,069 | -16,119 | -6,269 | -5,213 | 543/538/132/129 | 4,214 | -3,222 | P,M,C |
| `rvol_15m_rolling20_follow_t1.5_short_fixed12h` | failed/sparse | -18,163 | -17,692 | -5,144 | -4,790 | 631/625/155/153 | 4,119 | -2,327 | P,M,C |
| `vwap_240m_day_into_t2_long_indicator_or12h` | subset | 7,327 | 6,305 | 1,231 | 712 | 159/155/33/31 | 4,023 | -5,427 | B,M |
| `vwap_30m_day_trend_t0.5_short_indicator_or12h` | failed/sparse | -18,311 | -15,699 | -5,529 | -4,806 | 861/860/193/193 | 3,972 | -3,158 | P,M,C |
| `rvol_15m_rolling20_fade_t3_long_fixed12h` | subset | 7,204 | 6,486 | 3,561 | 3,378 | 374/371/89/89 | 3,899 | -6,487 | B,M |
| `rvol_15m_time20_fade_t1.5_short_indicator_or12h` | failed/sparse | -18,413 | -21,197 | -5,593 | -6,129 | 1441/1440/370/370 | 3,869 | -3,902 | P,M,C |
| `rvol_15m_time20_fade_t2_long_fixed12h` | subset | 7,003 | 8,110 | 3,174 | 2,920 | 447/444/111/110 | 3,699 | -5,157 | B,M |
| `rvol_60m_time20_fade_t2_long_fixed12h` | subset | 6,956 | 6,036 | 1,516 | 1,685 | 206/198/47/45 | 3,652 | -4,768 | B,M |
| `rvol_15m_rolling20_follow_t2_short_fixed12h` | failed/sparse | -18,748 | -17,405 | -3,311 | -3,054 | 549/543/137/136 | 3,534 | -1,921 | P,M,C |
| `rvol_30m_rolling20_fade_t1.5_short_fixed12h` | failed/sparse | -18,762 | -18,296 | -7,499 | -8,495 | 474/462/123/119 | 3,521 | -3,211 | P,M,C |
| `vwap_5m_day_trend_t2_short_indicator_or12h` | failed/sparse | -18,951 | -18,728 | -2,707 | -2,489 | 371/371/73/73 | 3,332 | -4,467 | P,M,C |
| `rvol_15m_rolling20_fade_t2_long_fixed12h` | failed/sparse | 6,634 | 5,424 | 273 | 39 | 549/543/137/136 | 3,330 | -4,882 | B,M,C |
| `rvol_60m_time20_follow_t3_long_fixed12h` | subset | 6,622 | 6,459 | 1,184 | 958 | 91/90/23/23 | 3,318 | -3,861 | B,M |
| `vwap_30m_day_into_t2_long_indicator_or12h` | subset | 6,608 | 5,104 | 2,918 | 2,514 | 274/273/58/58 | 3,303 | -6,362 | B,M |
| `rvol_60m_time20_follow_t3_long_indicator_or12h` | subset | 6,231 | 5,882 | 524 | 353 | 96/96/26/26 | 2,927 | -5,581 | B,M |
| `rvol_15m_time20_fade_t1.5_long_fixed12h` | failed/sparse | 6,087 | 4,250 | 3,338 | 2,349 | 543/538/132/129 | 2,783 | -3,841 | B,M,C |
| `rvol_15m_time20_follow_t2_short_indicator_or12h` | failed/sparse | -19,666 | -19,552 | -6,040 | -5,972 | 1017/1017/250/250 | 2,617 | -2,272 | P,M,C |
| `rvol_60m_time20_fade_t1.5_long_fixed12h` | failed/sparse | 5,900 | 4,015 | 360 | 450 | 297/285/69/65 | 2,596 | -3,892 | B,M,C |
| `rvol_240m_time20_fade_t1.5_long_fixed12h` | failed/sparse | 5,772 | 5,192 | -501 | -855 | 106/98/23/21 | 2,467 | -4,306 | P,B,M,C |
| `rvol_5m_time20_follow_t1.5_long_fixed12h` | failed/sparse | 5,681 | 4,094 | 5,430 | 4,894 | 698/695/184/182 | 2,376 | -1,284 | B,M,C |
| `vwap_5m_day_trend_t2_short_fixed12h` | failed/sparse | -19,986 | -18,460 | -4,532 | -4,465 | 302/301/64/64 | 2,296 | -4,276 | P,M,C |
| `vwap_5m_day_recovery_t2_long_indicator_or12h` | failed/sparse | 5,500 | 5,174 | 102 | -94 | 356/356/68/68 | 2,195 | -6,086 | P,B,M,C |
| `rvol_60m_time20_fade_t3_long_indicator_or12h` | subset | 5,497 | 5,586 | 347 | 277 | 103/103/25/25 | 2,192 | -5,804 | B,M |
| `rvol_60m_rolling20_follow_t3_long_fixed12h` | subset | 5,456 | 4,916 | 1,205 | 857 | 95/95/29/29 | 2,151 | -4,217 | B,M |
| `vwap_15m_day_trend_t0.5_short_indicator_or12h` | failed/sparse | -20,161 | -17,708 | -5,526 | -4,002 | 1109/1109/251/251 | 2,121 | -3,924 | P,M,C |
| `rvol_5m_rolling20_follow_t1.5_short_fixed12h` | failed/sparse | -20,230 | -20,056 | -9,059 | -11,562 | 776/773/196/196 | 2,053 | -1,964 | P,B,M,C |
| `rvol_240m_time20_follow_t3_long_fixed12h` | failed/sparse | 5,356 | 5,008 | 1,205 | 1,005 | 20/19/7/6 | 2,051 | -4,239 | N,B,M |
| `vwap_60m_day_into_t2_long_fixed12h` | subset | 5,313 | 4,986 | 3,315 | 2,120 | 219/214/48/47 | 2,008 | -5,196 | B,M |
| `rvol_5m_rolling20_follow_t1.5_long_fixed12h` | failed/sparse | 5,307 | 10,117 | 6,226 | 6,306 | 765/761/194/194 | 2,003 | -1,916 | M,C |
| `rvol_30m_time20_fade_t3_long_indicator_or12h` | subset | 5,285 | 4,306 | 2,560 | 2,643 | 241/241/64/64 | 1,980 | -6,096 | B,M |
| `rvol_240m_time20_follow_t3_long_indicator_or12h` | failed/sparse | 5,279 | 4,931 | 1,205 | 1,001 | 20/19/7/6 | 1,975 | -4,239 | N,B,M |
| `vwap_60m_day_trend_t2_long_fixed12h` | subset | 5,250 | 3,805 | 2,948 | 1,926 | 223/213/59/55 | 1,945 | -4,116 | B,M |
| `bar_direction_60m_rolling20_fade_t0_short_fixed12h` | control | -20,438 | -16,139 | -9,449 | -6,254 | 797/740/203/190 | 1,844 | -1,860 | P,M,C |
| `bar_direction_30m_rolling20_fade_t0_long_fixed12h` | control | 5,145 | 5,878 | 6,935 | 8,219 | 826/796/211/203 | 1,840 | -947 | M,C |
| `rvol_30m_time20_fade_t3_long_fixed12h` | subset | 4,938 | 4,070 | 1,784 | 1,581 | 199/198/47/47 | 1,633 | -5,068 | B,M |
| `rvol_15m_rolling20_follow_t2_long_fixed12h` | failed/sparse | 4,918 | 5,919 | 4,806 | 4,582 | 530/523/131/130 | 1,613 | -2,147 | B,M,C |
| `rvol_60m_rolling20_follow_t2_long_fixed12h` | failed/sparse | 4,909 | 4,292 | -697 | -982 | 213/212/60/60 | 1,604 | -4,528 | P,B,M,C |
| `vwap_30m_week_into_t2_long_indicator_or12h` | subset | 4,842 | 3,182 | 1,120 | 1,010 | 234/232/51/51 | 1,538 | -5,084 | B,M |
| `bar_direction_5m_rolling20_fade_t0_short_fixed12h` | control | -20,778 | -19,155 | -9,671 | -9,811 | 856/850/218/216 | 1,505 | -633 | P,M,C |
| `vwap_5m_week_into_t2_long_indicator_or12h` | failed/sparse | 4,761 | 4,507 | 372 | 244 | 290/289/62/62 | 1,457 | -5,622 | B,M,C |
| `bar_direction_5m_rolling20_follow_t0_short_fixed12h` | control | -20,844 | -23,351 | -9,418 | -9,999 | 855/849/218/216 | 1,439 | -713 | P,B,M,C |
| `rvol_240m_time20_follow_t2_long_fixed12h` | subset | 4,675 | 5,410 | 516 | 551 | 46/45/10/10 | 1,371 | -5,147 | B,M |
| `vwap_15m_week_into_t2_long_indicator_or12h` | subset | 4,565 | 3,021 | 763 | 708 | 262/260/59/59 | 1,260 | -5,478 | B,M |
| `rvol_5m_time20_fade_t1.5_short_fixed12h` | failed/sparse | -21,052 | -19,397 | -9,486 | -8,906 | 698/695/184/182 | 1,231 | -2,007 | P,M,C |
| `vwap_240m_week_into_t1_long_fixed12h` | failed/sparse | 4,438 | 2,614 | -817 | -815 | 169/158/36/35 | 1,133 | -5,305 | P,B,M,C |
| `rvol_5m_time20_follow_t3_long_fixed12h` | failed/sparse | 4,390 | 4,919 | 3,466 | 3,507 | 516/512/132/131 | 1,086 | -1,841 | B,M,C |
| `rvol_15m_time20_fade_t3_long_fixed12h` | failed/sparse | 4,384 | 2,801 | 4,361 | 3,714 | 289/287/76/75 | 1,080 | -3,109 | B,M,C |
| `rvol_60m_time20_fade_t1.5_long_indicator_or12h` | failed/sparse | 4,346 | 3,860 | 408 | 65 | 404/403/94/94 | 1,041 | -5,422 | B,M,C |
| `rvol_15m_rolling20_fade_t1.5_long_fixed12h` | failed/sparse | 4,247 | 3,909 | 1,708 | 1,399 | 631/625/155/153 | 942 | -2,386 | B,M,C |
| `rvol_30m_rolling20_follow_t3_long_fixed12h` | subset | 4,197 | 4,273 | 3,004 | 3,400 | 201/201/62/62 | 893 | -3,875 | B,M |
| `bar_direction_15m_rolling20_fade_t0_short_fixed12h` | control | -21,403 | -19,347 | -10,060 | -8,811 | 843/828/215/211 | 879 | -699 | P,B,M,C |
| `vwap_30m_day_trend_t2_long_fixed12h` | subset | 4,104 | 3,000 | 2,164 | 1,524 | 241/235/62/60 | 799 | -4,247 | B,M |
| `rvol_60m_time20_follow_t2_long_indicator_or12h` | failed/sparse | 3,952 | 2,853 | 696 | -141 | 218/216/62/61 | 647 | -5,507 | P,B,M,C |
| `vwap_240m_week_trend_t2_long_fixed12h` | subset | 3,889 | 6,037 | 632 | 1,121 | 131/121/36/32 | 584 | -3,989 | B,M |
| `rvol_30m_time20_follow_t3_long_fixed12h` | subset | 3,880 | 2,914 | 705 | 482 | 157/157/47/47 | 575 | -4,069 | B,M |
| `bar_direction_15m_rolling20_follow_t0_short_fixed12h` | control | -21,708 | -22,417 | -9,884 | -9,552 | 843/827/215/211 | 574 | -1,145 | P,M,C |
| `vwap_60m_week_into_t2_long_indicator_or12h` | subset | 3,732 | 2,436 | 1,458 | 956 | 209/205/46/45 | 427 | -5,085 | B,M |
| `rvol_15m_time20_fade_t3_long_indicator_or12h` | failed/sparse | 3,690 | 3,339 | 1,173 | 1,060 | 491/491/129/129 | 385 | -5,874 | B,M,C |
| `rvol_30m_rolling20_fade_t1.5_long_fixed12h` | failed/sparse | 3,606 | 5,411 | 925 | 1,685 | 514/500/129/124 | 301 | -3,376 | B,M,C |
| `rvol_5m_rolling20_fade_t3_short_indicator_or12h` | failed/sparse | -22,034 | -22,793 | -8,010 | -7,739 | 2006/2006/509/509 | 249 | -2,898 | P,B,M,C |
| `rvol_240m_rolling20_follow_t1.5_long_fixed12h` | failed/sparse | 3,426 | 3,628 | 168 | -505 | 125/117/36/33 | 121 | -5,493 | P,B,M,C |
| `rvol_30m_rolling20_fade_t2_long_fixed12h` | failed/sparse | 3,420 | 4,509 | 3,135 | 3,168 | 407/404/95/94 | 116 | -4,247 | B,M,C |
| `rvol_5m_rolling20_fade_t1.5_short_fixed12h` | failed/sparse | -22,174 | -26,902 | -10,525 | -10,606 | 765/761/194/194 | 108 | -2,108 | P,B,M,C |
| `rvol_5m_time20_follow_t3_short_fixed12h` | failed/sparse | -22,290 | -22,024 | -8,537 | -8,804 | 531/531/135/135 | -8 | -2,402 | P,B,M,C |
| `vwap_5m_day_recovery_t2_long_fixed12h` | failed/sparse | 3,292 | 3,591 | 143 | 386 | 288/288/59/59 | -12 | -6,601 | B,M,C |
| `rvol_15m_time20_follow_t1.5_short_indicator_or12h` | failed/sparse | -22,319 | -22,196 | -6,908 | -7,083 | 1572/1572/368/368 | -37 | -2,979 | P,B,M,C |
| `vwap_30m_week_into_t2_long_fixed12h` | failed/sparse | 3,259 | 1,939 | 1,708 | 803 | 216/213/47/46 | -45 | -4,790 | B,M,C |
| `bar_direction_240m_time20_follow_t0_short_indicator_or12h` | control | -22,340 | -10,832 | -4,150 | -4,767 | 1017/727/246/182 | -58 | -3,022 | P,B,M,C |
| `vwap_15m_day_recovery_t2_long_indicator_or12h` | failed/sparse | 3,235 | 2,294 | 565 | 287 | 300/296/62/61 | -69 | -6,868 | B,M,C |
| `rvol_240m_time20_follow_t2_long_indicator_or12h` | subset | 3,233 | 4,031 | 480 | 516 | 46/45/10/10 | -71 | -5,242 | B,M |
| `rvol_240m_time20_fade_t2_long_fixed12h` | failed/sparse | 3,216 | 1,803 | 458 | 223 | 49/45/9/8 | -89 | -5,592 | N,B,M |
| `vwap_240m_week_trend_t2_long_indicator_or12h` | failed/sparse | 3,215 | 4,806 | 333 | 788 | 132/125/36/33 | -89 | -4,139 | B,M,C |
| `bar_direction_240m_rolling20_follow_t0_short_fixed12h` | control | -22,392 | -20,144 | -8,860 | -12,903 | 646/526/160/136 | -110 | -3,869 | P,B,M,C |
| `bar_direction_15m_rolling20_fade_t0_long_fixed12h` | control | 3,127 | 4,186 | 5,124 | 4,880 | 843/827/215/211 | -178 | -928 | B,M,C |
| `rvol_5m_rolling20_fade_t1.5_long_fixed12h` | failed/sparse | 3,123 | 3,015 | 4,717 | 7,218 | 776/773/196/196 | -182 | -1,520 | B,M,C |
| `rvol_30m_rolling20_follow_t3_long_indicator_or12h` | subset | 3,121 | 3,708 | 1,120 | 1,557 | 226/226/72/72 | -183 | -4,171 | B,M |
| `rvol_240m_time20_fade_t1.5_long_indicator_or12h` | failed/sparse | 3,085 | 2,359 | -150 | -409 | 106/103/23/22 | -220 | -5,036 | P,B,M,C |
| `vwap_60m_week_into_t2_long_fixed12h` | failed/sparse | 3,074 | 1,213 | 874 | 405 | 198/193/42/41 | -231 | -4,788 | B,M,C |
| `rvol_240m_time20_fade_t2_long_indicator_or12h` | failed/sparse | 2,997 | 1,607 | 525 | 299 | 49/45/9/8 | -307 | -5,700 | N,B,M |
| `vwap_240m_week_into_t2_long_indicator_or12h` | failed/sparse | 2,955 | 3,065 | 446 | -43 | 152/143/33/31 | -350 | -5,208 | P,B,M,C |
| `rvol_5m_time20_follow_t2_long_fixed12h` | failed/sparse | 2,941 | 5,170 | 5,944 | 5,968 | 636/630/159/157 | -364 | -1,078 | B,M,C |
| `vwap_5m_day_trend_t0.5_short_indicator_or12h` | failed/sparse | -22,675 | -19,011 | -5,514 | -5,255 | 1445/1444/320/319 | -392 | -3,573 | P,B,M,C |
| `bar_direction_60m_rolling20_follow_t0_long_fixed12h` | control | 2,870 | -171 | 4,953 | 2,047 | 797/740/203/190 | -435 | -1,796 | P,B,M,C |
| `bar_direction_15m_rolling20_follow_t0_long_fixed12h` | control | 2,822 | 1,098 | 5,299 | 4,140 | 843/828/215/211 | -483 | -818 | B,M,C |
| `rvol_60m_rolling20_follow_t1.5_long_fixed12h` | failed/sparse | 2,798 | 1,886 | 3,906 | 4,057 | 316/303/83/79 | -507 | -4,520 | B,M,C |
| `rvol_5m_rolling20_fade_t3_long_fixed12h` | failed/sparse | 2,786 | 1,546 | 3,892 | 3,855 | 640/635/162/162 | -519 | -2,900 | B,M,C |
| `rvol_240m_rolling20_follow_t2_long_indicator_or12h` | failed/sparse | 2,692 | 3,057 | -503 | -553 | 65/64/18/18 | -613 | -5,665 | P,B,M,C |
| `rvol_240m_rolling20_follow_t2_long_fixed12h` | failed/sparse | 2,631 | 3,159 | -873 | -934 | 65/64/18/18 | -673 | -5,470 | P,B,M,C |
| `rvol_60m_rolling20_follow_t1.5_short_fixed12h` | failed/sparse | -22,964 | -21,995 | -1,829 | -2,092 | 349/341/77/76 | -681 | -2,879 | P,B,M,C |
| `vwap_60m_week_into_t1_long_indicator_or12h` | failed/sparse | 2,526 | 2,225 | 174 | -180 | 271/269/65/64 | -778 | -5,147 | P,B,M,C |
| `vwap_240m_day_trend_t2_long_indicator_or12h` | subset | 2,504 | 2,994 | 978 | 1,493 | 159/152/44/41 | -801 | -4,551 | B,M |
| `rvol_240m_rolling20_follow_t3_long_indicator_or12h` | failed/sparse | 2,492 | 2,784 | 941 | 895 | 20/19/5/5 | -812 | -6,012 | N,B,M |
| `vwap_30m_week_into_t1_long_indicator_or12h` | failed/sparse | 2,486 | 1,679 | 454 | 435 | 314/312/72/72 | -819 | -5,543 | B,M,C |
| `vwap_15m_week_into_t2_long_fixed12h` | failed/sparse | 2,482 | 360 | 198 | -563 | 236/233/54/53 | -823 | -5,545 | P,B,M,C |
| `vwap_240m_week_into_t1_long_indicator_or12h` | failed/sparse | 2,448 | 2,171 | -1,336 | -1,238 | 173/164/37/36 | -856 | -5,499 | P,B,M,C |
| `vwap_60m_week_trend_t0.5_long_fixed12h` | failed/sparse | 2,386 | -1,598 | 2,570 | 2,055 | 234/223/56/54 | -918 | -4,749 | P,B,M,C |
| `rvol_60m_rolling20_follow_t3_long_indicator_or12h` | failed/sparse | 2,371 | 2,374 | -37 | -61 | 97/97/31/31 | -934 | -4,874 | P,B,M,C |
| `vwap_240m_day_trend_t2_long_fixed12h` | subset | 2,361 | 4,209 | 773 | 814 | 155/146/43/41 | -943 | -5,124 | B,M |
| `vwap_15m_week_into_t1_long_indicator_or12h` | failed/sparse | 2,258 | 800 | 546 | 65 | 370/368/80/80 | -1,046 | -5,921 | B,M,C |
| `vwap_240m_week_into_t2_long_fixed12h` | failed/sparse | 2,236 | 1,512 | 391 | -99 | 151/137/32/30 | -1,069 | -5,178 | P,B,M,C |
| `bar_direction_30m_rolling20_follow_t0_short_fixed12h` | control | -23,354 | -23,428 | -11,609 | -12,718 | 826/796/211/203 | -1,072 | -2,357 | P,B,M,C |
| `vwap_30m_day_into_t1_long_indicator_or12h` | failed/sparse | 2,209 | -1,281 | 690 | 18 | 574/570/121/120 | -1,095 | -6,312 | P,B,M,C |
| `rvol_15m_rolling20_follow_t3_long_fixed12h` | failed/sparse | 2,193 | 3,010 | 1,200 | 1,542 | 340/336/91/90 | -1,111 | -2,526 | B,M,C |
| `vwap_240m_week_trend_t1_long_fixed12h` | failed/sparse | 2,192 | 4,105 | -1,834 | -965 | 154/141/42/40 | -1,112 | -5,188 | P,B,M,C |
| `rvol_30m_time20_follow_t3_long_indicator_or12h` | failed/sparse | 2,180 | 2,150 | -458 | -555 | 189/189/54/54 | -1,125 | -5,776 | P,B,M,C |
| `rvol_240m_rolling20_follow_t1.5_long_indicator_or12h` | subset | 2,146 | 1,911 | 587 | 445 | 126/121/36/34 | -1,159 | -5,386 | B,M |
| `rvol_60m_time20_fade_t2_long_indicator_or12h` | failed/sparse | 2,100 | 1,845 | 243 | 156 | 245/245/61/61 | -1,204 | -6,305 | B,M,C |
| `vwap_60m_week_trend_t2_long_fixed12h` | failed/sparse | 2,094 | 3,451 | -218 | 292 | 173/170/45/45 | -1,210 | -4,823 | P,B,M,C |
| `rvol_240m_rolling20_follow_t3_long_fixed12h` | failed/sparse | 2,082 | 2,494 | 607 | 583 | 20/19/5/5 | -1,222 | -6,012 | N,B,M |
| `bar_direction_240m_rolling20_fade_t0_long_indicator_or12h` | control | 2,044 | -1,483 | -902 | -355 | 995/713/244/175 | -1,260 | -5,187 | P,B,M,C |
| `vwap_30m_week_trend_t2_long_fixed12h` | failed/sparse | 2,007 | 1,914 | 15 | 7 | 192/192/51/51 | -1,298 | -4,450 | B,M,C |
| `bar_direction_5m_rolling20_fade_t0_long_fixed12h` | control | 1,999 | 4,635 | 4,592 | 5,217 | 855/849/218/216 | -1,305 | -492 | B,M,C |
| `vwap_15m_day_trend_t2_long_fixed12h` | failed/sparse | 1,952 | 1,503 | 2,455 | 2,249 | 260/260/65/65 | -1,352 | -4,215 | B,M,C |
| `rvol_30m_time20_follow_t2_long_fixed12h` | failed/sparse | 1,949 | 3,617 | 1,205 | 1,742 | 286/283/72/72 | -1,356 | -3,135 | B,M,C |
| `vwap_60m_day_into_t1_long_indicator_or12h` | failed/sparse | 1,942 | 720 | 692 | 420 | 480/476/102/102 | -1,363 | -6,131 | B,M,C |
| `rvol_15m_time20_follow_t2_long_fixed12h` | failed/sparse | 1,925 | -99 | 3,944 | 4,374 | 430/426/106/104 | -1,380 | -3,588 | P,B,M,C |
| `vwap_15m_day_into_t1_long_indicator_or12h` | failed/sparse | 1,916 | 465 | 139 | -849 | 680/679/138/137 | -1,388 | -7,126 | P,B,M,C |
| `bar_direction_5m_rolling20_follow_t0_long_fixed12h` | control | 1,911 | 422 | 4,845 | 5,029 | 856/850/218/216 | -1,393 | -722 | B,M,C |
| `vwap_240m_day_into_t1_long_indicator_or12h` | failed/sparse | 1,826 | 1,845 | 2,726 | 2,444 | 268/261/60/60 | -1,478 | -6,273 | B,M,C |
| `vwap_240m_day_into_t1_long_fixed12h` | failed/sparse | 1,795 | 59 | 3,378 | 3,172 | 261/243/57/57 | -1,510 | -5,635 | B,M,C |
| `vwap_240m_week_trend_t1_long_indicator_or12h` | failed/sparse | 1,790 | 2,053 | -1,692 | -1,331 | 159/151/43/42 | -1,515 | -4,872 | P,B,M,C |
| `rvol_60m_rolling20_follow_t2_long_indicator_or12h` | failed/sparse | 1,704 | 1,646 | -1,451 | -1,289 | 255/255/71/71 | -1,600 | -4,611 | P,B,M,C |
| `rvol_5m_time20_fade_t2_long_fixed12h` | failed/sparse | 1,704 | 2,804 | 5,472 | 7,776 | 668/664/168/168 | -1,600 | -2,476 | B,M,C |
| `rvol_15m_time20_follow_t3_long_indicator_or12h` | failed/sparse | 1,684 | 1,862 | 770 | 428 | 402/402/102/102 | -1,621 | -4,252 | B,M,C |
| `bar_direction_240m_rolling20_follow_t0_short_indicator_or12h` | control | -23,971 | -14,232 | -4,490 | -3,519 | 995/713/244/175 | -1,688 | -2,996 | P,B,M,C |
| `vwap_5m_day_trend_t0.5_long_fixed12h` | failed/sparse | 1,478 | 1,210 | 2,768 | 2,876 | 594/590/151/151 | -1,826 | -1,635 | B,M,C |
| `rvol_5m_time20_fade_t3_short_indicator_or12h` | failed/sparse | -24,262 | -25,723 | -7,545 | -7,560 | 1602/1602/407/407 | -1,979 | -3,166 | P,B,M,C |
| `vwap_240m_week_trend_t0.5_long_fixed12h` | failed/sparse | 1,170 | 2,921 | -1,119 | -606 | 165/154/40/36 | -2,134 | -4,927 | P,B,M,C |
| `vwap_5m_week_into_t0.5_long_indicator_or12h` | failed/sparse | 1,151 | -1,687 | -665 | -1,175 | 668/667/144/143 | -2,153 | -6,093 | P,B,M,C |
| `rvol_30m_rolling20_fade_t3_long_indicator_or12h` | failed/sparse | 1,138 | 1,218 | 498 | 712 | 276/276/66/66 | -2,167 | -6,111 | B,M,C |
| `vwap_60m_week_trend_t2_long_indicator_or12h` | failed/sparse | 1,137 | 1,532 | -88 | 263 | 184/181/49/48 | -2,168 | -4,250 | P,B,M,C |
| `vwap_30m_day_recovery_t2_long_indicator_or12h` | failed/sparse | 1,085 | 1,633 | 643 | 420 | 246/244/52/52 | -2,219 | -6,779 | B,M,C |
| `vwap_5m_week_trend_t2_long_fixed12h` | failed/sparse | 1,075 | 1,919 | 889 | 836 | 228/227/59/59 | -2,230 | -3,845 | B,M,C |
| `vwap_60m_day_trend_t2_long_indicator_or12h` | failed/sparse | 983 | 1,261 | 2,495 | 3,313 | 245/239/61/57 | -2,321 | -3,979 | B,M,C |
| `rvol_60m_time20_follow_t2_long_fixed12h` | failed/sparse | 977 | 713 | 1,557 | 1,593 | 187/181/52/49 | -2,328 | -3,151 | B,M,C |
| `vwap_30m_week_recovery_t2_long_fixed12h` | failed/sparse | 843 | 417 | -179 | -44 | 212/210/48/47 | -2,461 | -4,221 | P,B,M,C |
| `vwap_5m_week_into_t1_long_indicator_or12h` | failed/sparse | 730 | -1,103 | -326 | -682 | 442/441/91/91 | -2,575 | -5,775 | P,B,M,C |
| `rvol_15m_rolling20_follow_t1.5_long_fixed12h` | failed/sparse | 687 | 861 | 911 | 962 | 624/617/159/156 | -2,618 | -2,796 | B,M,C |
| `vwap_5m_week_recovery_t2_long_indicator_or12h` | failed/sparse | 652 | 431 | 389 | 385 | 292/291/62/62 | -2,652 | -5,507 | B,M,C |
| `rvol_15m_time20_follow_t3_long_fixed12h` | failed/sparse | 526 | 277 | 2,877 | 2,613 | 263/263/68/68 | -2,779 | -3,169 | B,M,C |
| `vwap_15m_week_trend_t2_long_fixed12h` | failed/sparse | 459 | 666 | 17 | 218 | 206/204/53/52 | -2,845 | -4,460 | B,M,C |
| `vwap_30m_week_recovery_t2_long_indicator_or12h` | failed/sparse | 449 | -24 | 277 | 239 | 239/233/53/50 | -2,856 | -5,267 | P,B,M,C |
| `vwap_240m_week_into_t0.5_long_indicator_or12h` | failed/sparse | 442 | 507 | -81 | -259 | 180/174/37/37 | -2,862 | -6,326 | P,B,M,C |
| `rvol_240m_time20_follow_t1.5_long_fixed12h` | failed/sparse | 410 | 2,562 | 1,231 | 1,059 | 94/89/25/23 | -2,894 | -5,289 | B,M,C |
| `rvol_30m_time20_follow_t1.5_long_fixed12h` | failed/sparse | 386 | 2,581 | 4,435 | 4,961 | 386/383/97/96 | -2,919 | -2,544 | B,M,C |
| `rvol_5m_rolling20_follow_t2_short_fixed12h` | failed/sparse | -25,206 | -24,364 | -7,434 | -7,546 | 740/736/184/184 | -2,923 | -1,917 | P,B,M,C |
| `vwap_30m_week_trend_t0.5_long_fixed12h` | failed/sparse | 194 | -469 | 874 | 2,212 | 257/251/65/62 | -3,110 | -4,983 | P,B,M,C |
| `vwap_5m_day_trend_t2_long_fixed12h` | failed/sparse | 161 | 803 | 2,579 | 2,272 | 285/285/71/71 | -3,144 | -3,819 | B,M,C |
| `bar_direction_60m_rolling20_follow_t0_short_fixed12h` | control | -25,438 | -25,426 | -7,684 | -9,814 | 801/743/202/188 | -3,156 | -2,233 | P,B,M,C |
| `vwap_5m_week_trend_t0_short_indicator_or12h` | failed/sparse | -25,483 | -23,189 | -5,400 | -5,487 | 1525/1525/350/350 | -3,201 | -4,028 | P,B,M,C |
| `rvol_5m_rolling20_fade_t2_short_fixed12h` | failed/sparse | -25,536 | -24,056 | -9,622 | -9,449 | 725/720/184/183 | -3,254 | -2,064 | P,B,M,C |
| `vwap_30m_week_trend_t1_long_fixed12h` | failed/sparse | -1 | 1,038 | 3,098 | 2,950 | 229/224/56/55 | -3,306 | -5,041 | P,B,M,C |
| `vwap_15m_day_recovery_t1_long_indicator_or12h` | failed/sparse | -6 | -105 | -356 | -980 | 642/614/128/125 | -3,310 | -7,278 | P,B,M,C |
| `rvol_30m_time20_fade_t2_long_indicator_or12h` | failed/sparse | -16 | -1,205 | 152 | 29 | 505/504/122/122 | -3,321 | -6,336 | P,B,M,C |
| `vwap_15m_day_trend_t0_long_fixed12h` | failed/sparse | -28 | 1,418 | 5,870 | 6,033 | 602/587/152/150 | -3,333 | -2,864 | P,B,M,C |
| `vwap_60m_week_recovery_t2_long_indicator_or12h` | failed/sparse | -59 | -321 | 918 | 697 | 204/198/43/43 | -3,364 | -5,286 | P,B,M,C |
| `bar_direction_240m_time20_fade_t0_long_indicator_or12h` | control | -68 | -5,187 | -1,286 | 738 | 1017/727/246/182 | -3,373 | -4,469 | P,B,M,C |
| `vwap_60m_week_trend_t0_long_fixed12h` | failed/sparse | -92 | -1,359 | 1,028 | 1,090 | 230/222/57/54 | -3,397 | -4,720 | P,B,M,C |
| `rvol_60m_rolling20_follow_t1.5_long_indicator_or12h` | failed/sparse | -168 | -23 | -552 | -146 | 428/427/124/124 | -3,473 | -5,181 | P,B,M,C |
| `vwap_15m_day_trend_t1_long_fixed12h` | failed/sparse | -222 | -1,731 | 3,861 | 3,854 | 458/455/116/115 | -3,526 | -2,464 | P,B,M,C |
| `rvol_60m_rolling20_fade_t3_long_fixed12h` | failed/sparse | -242 | -159 | 68 | -155 | 97/96/21/20 | -3,547 | -6,754 | P,B,M,C |
| `vwap_5m_week_into_t2_long_fixed12h` | failed/sparse | -261 | 180 | 171 | 70 | 248/247/55/55 | -3,565 | -5,679 | P,B,M,C |
| `vwap_60m_day_into_t1_long_fixed12h` | failed/sparse | -321 | 3,247 | 609 | 1,386 | 377/367/81/77 | -3,626 | -5,424 | P,B,M,C |
| `vwap_60m_day_recovery_t2_long_indicator_or12h` | failed/sparse | -404 | 340 | 645 | 537 | 197/191/39/38 | -3,709 | -6,714 | P,B,M,C |
| `rvol_240m_time20_fade_t3_long_fixed12h` | failed/sparse | -453 | -126 | -281 | -330 | 15/15/4/4 | -3,757 | -5,876 | N,P,B,M,C |
| `rvol_240m_rolling20_fade_t3_long_fixed12h` | failed/sparse | -462 | -16 | -839 | -803 | 20/19/4/4 | -3,766 | -6,000 | N,P,B,M,C |
| `rvol_240m_rolling20_fade_t3_long_indicator_or12h` | failed/sparse | -472 | -114 | -926 | -900 | 20/19/4/4 | -3,777 | -5,783 | N,P,B,M,C |
| `vwap_240m_week_into_t0.5_long_fixed12h` | failed/sparse | -517 | -1,905 | -287 | -167 | 169/156/34/33 | -3,821 | -6,581 | P,B,M,C |
| `vwap_15m_week_into_t0.5_long_indicator_or12h` | failed/sparse | -539 | -2,654 | -1,062 | -1,782 | 502/501/106/106 | -3,844 | -6,533 | P,B,M,C |
| `rvol_60m_time20_follow_t1.5_long_indicator_or12h` | failed/sparse | -577 | -110 | -184 | -350 | 352/350/94/94 | -3,881 | -5,474 | P,B,M,C |
| `vwap_30m_day_trend_t2_long_indicator_or12h` | failed/sparse | -599 | 178 | 644 | 1,550 | 280/274/72/69 | -3,904 | -4,594 | P,B,M,C |
| `rvol_5m_time20_fade_t1.5_long_fixed12h` | failed/sparse | -654 | -1,154 | 4,386 | 4,126 | 722/718/184/183 | -3,958 | -3,620 | P,B,M,C |
| `vwap_30m_day_into_t0.5_long_indicator_or12h` | failed/sparse | -663 | -3,250 | 1,258 | 535 | 861/860/193/193 | -3,967 | -5,257 | P,B,M,C |
| `rvol_240m_time20_follow_t1.5_long_indicator_or12h` | failed/sparse | -680 | -59 | 924 | 811 | 94/91/25/23 | -3,985 | -5,391 | P,B,M,C |
| `rvol_240m_time20_fade_t3_long_indicator_or12h` | failed/sparse | -724 | -457 | -368 | -425 | 15/15/4/4 | -4,029 | -6,084 | N,P,B,M,C |
| `vwap_30m_day_trend_t0_long_fixed12h` | failed/sparse | -763 | 1,918 | 6,153 | 5,669 | 563/542/142/136 | -4,068 | -2,687 | P,B,M,C |
| `rvol_30m_time20_follow_t2_long_indicator_or12h` | failed/sparse | -892 | 94 | -1,466 | -755 | 406/405/108/107 | -4,196 | -4,765 | P,B,M,C |
| `vwap_15m_week_recovery_t2_long_indicator_or12h` | failed/sparse | -917 | -1,184 | 184 | 341 | 267/260/58/57 | -4,222 | -5,454 | P,B,M,C |
| `vwap_30m_week_trend_t0_long_fixed12h` | failed/sparse | -946 | -331 | 1,058 | 838 | 260/257/65/63 | -4,251 | -5,298 | P,B,M,C |
| `vwap_240m_week_trend_t0_long_fixed12h` | failed/sparse | -969 | 2,097 | -905 | 600 | 171/156/39/35 | -4,273 | -4,927 | P,B,M,C |
| `vwap_60m_week_recovery_t1_long_indicator_or12h` | failed/sparse | -1,127 | -517 | -1,142 | -1,206 | 266/233/60/54 | -4,431 | -5,203 | P,B,M,C |
| `vwap_60m_week_recovery_t2_long_fixed12h` | failed/sparse | -1,160 | -1,491 | -813 | -759 | 186/185/41/41 | -4,465 | -4,403 | P,B,M,C |
| `vwap_240m_day_recovery_t2_long_indicator_or12h` | failed/sparse | -1,166 | -1,349 | -1,658 | -1,614 | 97/94/15/15 | -4,471 | -5,759 | P,B,M,C |
| `bar_direction_30m_rolling20_follow_t0_long_fixed12h` | control | -1,214 | 3,091 | 4,122 | 2,191 | 829/797/211/203 | -4,518 | -1,747 | P,B,M,C |
| `vwap_30m_week_trend_t2_long_indicator_or12h` | failed/sparse | -1,263 | -806 | -1,556 | -1,300 | 210/209/57/56 | -4,567 | -4,398 | P,B,M,C |
| `vwap_60m_day_trend_t0_long_fixed12h` | failed/sparse | -1,308 | -3,273 | 4,968 | 4,418 | 497/472/127/118 | -4,613 | -2,855 | P,B,M,C |
| `rvol_60m_rolling20_fade_t1.5_long_indicator_or12h` | failed/sparse | -1,313 | -1,580 | -522 | -476 | 488/487/115/115 | -4,618 | -5,485 | P,B,M,C |
| `rvol_15m_time20_follow_t1.5_long_fixed12h` | failed/sparse | -1,327 | 1,359 | 4,266 | 4,968 | 521/510/132/129 | -4,631 | -2,907 | P,B,M,C |
| `rvol_30m_rolling20_follow_t2_long_fixed12h` | failed/sparse | -1,347 | -876 | 773 | 1,652 | 358/354/98/97 | -4,652 | -3,539 | P,B,M,C |
| `vwap_30m_day_recovery_t2_long_fixed12h` | failed/sparse | -1,396 | -722 | 957 | 805 | 221/218/47/47 | -4,701 | -6,282 | P,B,M,C |
| `vwap_15m_day_recovery_t2_long_fixed12h` | failed/sparse | -1,436 | 44 | 412 | 721 | 249/248/53/53 | -4,741 | -6,912 | P,B,M,C |
| `vwap_5m_day_trend_t1_long_fixed12h` | failed/sparse | -1,514 | -2,039 | 2,928 | 3,453 | 494/492/127/127 | -4,819 | -2,827 | P,B,M,C |
| `vwap_30m_day_trend_t0_short_indicator_or12h` | failed/sparse | -27,224 | -23,349 | -8,867 | -8,032 | 1443/1443/361/361 | -4,941 | -2,596 | P,B,M,C |
| `vwap_15m_week_trend_t0.5_long_fixed12h` | failed/sparse | -1,691 | 293 | 383 | 3,135 | 282/276/71/66 | -4,995 | -4,688 | P,B,M,C |
| `vwap_5m_day_into_t1_long_indicator_or12h` | failed/sparse | -1,746 | -3,301 | -356 | -63 | 808/808/164/164 | -5,051 | -5,933 | P,B,M,C |
| `vwap_60m_week_recovery_t0.5_long_indicator_or12h` | failed/sparse | -1,799 | -112 | -115 | -439 | 317/275/69/60 | -5,104 | -4,979 | P,B,M,C |
| `vwap_30m_week_into_t0.5_long_indicator_or12h` | failed/sparse | -1,828 | -3,312 | -872 | -747 | 390/389/88/88 | -5,133 | -6,063 | P,B,M,C |
| `vwap_240m_day_into_t0.5_long_indicator_or12h` | failed/sparse | -1,880 | -2,297 | 230 | -348 | 315/310/73/72 | -5,185 | -6,782 | P,B,M,C |
| `vwap_240m_week_trend_t0.5_long_indicator_or12h` | failed/sparse | -1,975 | -1,536 | -2,065 | -2,008 | 173/169/41/39 | -5,279 | -4,670 | P,B,M,C |
| `vwap_15m_week_recovery_t2_long_fixed12h` | failed/sparse | -2,035 | -1,623 | -653 | -478 | 229/227/52/51 | -5,339 | -4,248 | P,B,M,C |
| `vwap_30m_week_into_t1_long_fixed12h` | failed/sparse | -2,080 | -2,458 | -500 | -399 | 247/242/59/58 | -5,385 | -5,165 | P,B,M,C |
| `vwap_240m_day_into_t0.5_long_fixed12h` | failed/sparse | -2,109 | -2,797 | -36 | -1,155 | 299/277/69/63 | -5,413 | -5,507 | P,B,M,C |
| `vwap_60m_day_trend_t0.5_long_fixed12h` | failed/sparse | -2,146 | -6,987 | 4,126 | 2,354 | 477/455/123/116 | -5,450 | -4,211 | P,B,M,C |
| `vwap_60m_week_into_t1_long_fixed12h` | failed/sparse | -2,165 | -1,990 | -838 | -1,153 | 226/220/55/53 | -5,469 | -5,356 | P,B,M,C |
| `vwap_15m_week_trend_t2_long_indicator_or12h` | failed/sparse | -2,194 | -2,039 | -1,512 | -1,370 | 229/228/59/58 | -5,499 | -4,359 | P,B,M,C |
| `vwap_15m_week_trend_t1_long_fixed12h` | failed/sparse | -2,242 | -1,739 | 1,831 | 1,736 | 256/256/62/62 | -5,547 | -4,972 | P,B,M,C |
| `vwap_60m_week_trend_t1_long_fixed12h` | failed/sparse | -2,373 | -2,951 | 607 | 30 | 217/207/52/51 | -5,678 | -4,951 | P,B,M,C |
| `vwap_5m_day_recovery_t1_long_fixed12h` | failed/sparse | -2,377 | -2,110 | 2,153 | 1,757 | 461/457/97/97 | -5,682 | -4,706 | P,B,M,C |
| `rvol_60m_rolling20_fade_t3_long_indicator_or12h` | failed/sparse | -2,533 | -2,424 | -531 | -530 | 102/102/22/22 | -5,838 | -6,250 | P,B,M,C |
| `vwap_30m_day_into_t1_long_fixed12h` | failed/sparse | -2,552 | -2,909 | -554 | -985 | 410/401/89/85 | -5,856 | -6,204 | P,B,M,C |
| `vwap_60m_week_into_t0.5_long_indicator_or12h` | failed/sparse | -2,687 | -3,011 | -1,193 | -1,211 | 316/316/71/71 | -5,992 | -5,978 | P,B,M,C |
| `rvol_15m_time20_fade_t2_long_indicator_or12h` | failed/sparse | -2,717 | -2,832 | 536 | 469 | 1017/1017/250/250 | -6,022 | -6,118 | P,B,M,C |
| `vwap_5m_week_trend_t2_long_indicator_or12h` | failed/sparse | -2,734 | -2,403 | -1,131 | -1,284 | 264/264/67/67 | -6,038 | -4,024 | P,B,M,C |
| `bar_direction_240m_rolling20_follow_t0_long_fixed12h` | control | -2,801 | -10,510 | 2,487 | 1,572 | 649/531/166/137 | -6,106 | -3,912 | P,B,M,C |
| `vwap_30m_day_recovery_t1_long_indicator_or12h` | failed/sparse | -2,860 | -1,454 | -537 | -763 | 516/488/107/102 | -6,164 | -6,999 | P,B,M,C |
| `rvol_30m_rolling20_follow_t2_long_indicator_or12h` | failed/sparse | -2,880 | -1,723 | -1,742 | -1,296 | 547/547/151/151 | -6,185 | -4,809 | P,B,M,C |
| `vwap_15m_day_trend_t2_long_indicator_or12h` | failed/sparse | -2,963 | -1,623 | 609 | 647 | 312/312/77/77 | -6,267 | -5,063 | P,B,M,C |
| `vwap_5m_day_into_t0.5_long_fixed12h` | failed/sparse | -2,991 | -4,725 | -1,073 | -1,165 | 576/575/136/136 | -6,295 | -3,681 | P,B,M,C |
| `vwap_30m_week_recovery_t0.5_long_indicator_or12h` | failed/sparse | -2,995 | 59 | -379 | -284 | 413/358/92/81 | -6,299 | -5,487 | P,B,M,C |
| `rvol_30m_time20_fade_t1.5_long_indicator_or12h` | failed/sparse | -3,001 | -4,669 | -1,132 | -1,468 | 775/774/173/173 | -6,305 | -5,922 | P,B,M,C |
| `rvol_240m_rolling20_fade_t1.5_long_fixed12h` | failed/sparse | -3,194 | -2,769 | -938 | -1,343 | 126/117/36/34 | -6,498 | -5,820 | P,B,M,C |
| `rvol_240m_rolling20_fade_t2_long_fixed12h` | failed/sparse | -3,286 | -4,287 | -1,362 | -1,479 | 68/64/13/12 | -6,590 | -6,696 | P,B,M,C |
| `rvol_60m_time20_follow_t1.5_long_fixed12h` | failed/sparse | -3,342 | -3,169 | 2,192 | 2,440 | 260/254/65/63 | -6,647 | -3,701 | P,B,M,C |
| `vwap_240m_week_recovery_t0.5_long_fixed12h` | failed/sparse | -3,561 | -219 | 783 | 1,610 | 158/146/34/29 | -6,866 | -4,566 | P,B,M,C |
| `rvol_240m_rolling20_fade_t2_long_indicator_or12h` | failed/sparse | -3,579 | -4,243 | -1,025 | -1,091 | 68/66/13/13 | -6,884 | -6,277 | P,B,M,C |
| `vwap_240m_week_recovery_t2_long_indicator_or12h` | failed/sparse | -3,640 | -2,106 | -936 | -1,208 | 139/125/29/27 | -6,945 | -5,137 | P,B,M,C |
| `vwap_240m_week_recovery_t0.5_long_indicator_or12h` | failed/sparse | -3,673 | -3,140 | -122 | -336 | 169/150/35/32 | -6,978 | -4,624 | P,B,M,C |
| `vwap_5m_week_trend_t1_long_fixed12h` | failed/sparse | -3,698 | -2,203 | 1,249 | 1,578 | 280/280/65/65 | -7,003 | -5,120 | P,B,M,C |
| `vwap_240m_day_recovery_t1_long_indicator_or12h` | failed/sparse | -3,714 | -3,097 | -1,481 | -1,771 | 187/174/41/39 | -7,018 | -6,007 | P,B,M,C |
| `rvol_15m_rolling20_follow_t3_long_indicator_or12h` | failed/sparse | -3,743 | -4,012 | -504 | -757 | 513/513/132/132 | -7,047 | -5,213 | P,B,M,C |
| `vwap_5m_week_trend_t0.5_long_fixed12h` | failed/sparse | -3,786 | -3,527 | 1,623 | 1,770 | 304/303/74/74 | -7,090 | -5,673 | P,B,M,C |
| `rvol_30m_rolling20_fade_t2_long_indicator_or12h` | failed/sparse | -3,794 | -3,565 | 277 | 523 | 662/662/158/158 | -7,099 | -6,489 | P,B,M,C |
| `vwap_15m_day_into_t0.5_long_fixed12h` | failed/sparse | -3,802 | -5,702 | -486 | -81 | 545/536/131/128 | -7,106 | -3,440 | P,B,M,C |
| `rvol_60m_rolling20_fade_t2_long_indicator_or12h` | failed/sparse | -3,825 | -4,105 | 391 | 510 | 312/311/78/78 | -7,130 | -6,184 | P,B,M,C |
| `vwap_60m_week_trend_t1_long_indicator_or12h` | failed/sparse | -3,846 | -4,042 | -229 | -160 | 260/255/67/65 | -7,150 | -4,211 | P,B,M,C |
| `vwap_15m_day_trend_t0.5_long_fixed12h` | failed/sparse | -3,867 | -4,450 | 3,401 | 3,256 | 557/550/143/140 | -7,172 | -1,733 | P,B,M,C |
| `vwap_240m_week_trend_t0_long_indicator_or12h` | failed/sparse | -3,873 | -3,460 | -1,774 | -1,494 | 185/185/41/41 | -7,178 | -4,670 | P,B,M,C |
| `vwap_60m_day_into_t0.5_long_indicator_or12h` | failed/sparse | -3,891 | -4,998 | -1,184 | -1,013 | 666/662/148/147 | -7,195 | -5,893 | P,B,M,C |
| `vwap_30m_week_recovery_t1_long_indicator_or12h` | failed/sparse | -3,901 | -4,580 | -1,370 | -1,814 | 312/295/68/67 | -7,206 | -5,063 | P,B,M,C |
| `rvol_15m_rolling20_fade_t3_long_indicator_or12h` | failed/sparse | -3,917 | -3,862 | -472 | 1 | 606/606/152/152 | -7,221 | -6,082 | P,B,M,C |
| `vwap_5m_day_into_t1_long_fixed12h` | failed/sparse | -3,938 | -3,795 | -57 | 466 | 480/476/106/105 | -7,243 | -5,342 | P,B,M,C |
| `rvol_5m_rolling20_follow_t3_long_fixed12h` | failed/sparse | -4,062 | -7,115 | 1,185 | -438 | 614/613/155/154 | -7,366 | -2,592 | P,B,M,C |
| `vwap_15m_week_trend_t0_long_fixed12h` | failed/sparse | -4,066 | -2,401 | 923 | 1,482 | 287/285/67/66 | -7,371 | -5,320 | P,B,M,C |
| `vwap_30m_day_trend_t0.5_long_fixed12h` | failed/sparse | -4,139 | -419 | 5,411 | 4,617 | 518/502/130/128 | -7,444 | -2,741 | P,B,M,C |
| `vwap_15m_day_into_t0.5_long_indicator_or12h` | failed/sparse | -4,267 | -6,718 | -21 | -1,543 | 1109/1109/251/251 | -7,572 | -6,723 | P,B,M,C |
| `rvol_30m_time20_follow_t1.5_long_indicator_or12h` | failed/sparse | -4,302 | -4,136 | -1,546 | -1,892 | 708/707/188/187 | -7,606 | -4,707 | P,B,M,C |
| `vwap_5m_week_recovery_t0.5_long_fixed12h` | failed/sparse | -4,463 | -4,804 | 1,364 | 1,225 | 298/296/71/71 | -7,768 | -5,169 | P,B,M,C |
| `vwap_60m_day_recovery_t1_long_indicator_or12h` | failed/sparse | -4,532 | -3,373 | -1,374 | -1,267 | 413/381/88/81 | -7,837 | -6,150 | P,B,M,C |
| `vwap_5m_week_into_t0.5_long_fixed12h` | failed/sparse | -4,576 | -6,317 | 1,902 | 1,785 | 302/302/71/71 | -7,880 | -5,126 | P,B,M,C |
| `vwap_60m_day_recovery_t2_long_fixed12h` | failed/sparse | -4,643 | -4,596 | -1,364 | -1,364 | 182/176/36/36 | -7,947 | -6,519 | P,B,M,C |
| `rvol_240m_rolling20_fade_t1.5_long_indicator_or12h` | failed/sparse | -4,712 | -4,647 | -1,162 | -1,599 | 127/122/37/36 | -8,017 | -6,151 | P,B,M,C |
| `vwap_5m_week_recovery_t2_long_fixed12h` | failed/sparse | -4,807 | -4,016 | -1,580 | -1,242 | 246/246/54/54 | -8,112 | -4,854 | P,B,M,C |
| `rvol_5m_time20_follow_t3_short_indicator_or12h` | failed/sparse | -30,516 | -27,623 | -8,519 | -7,348 | 1853/1853/458/458 | -8,234 | -3,275 | P,B,M,C |
| `vwap_5m_day_trend_t2_long_indicator_or12h` | failed/sparse | -4,949 | -4,036 | -289 | -1,111 | 365/365/90/90 | -8,254 | -5,478 | P,B,M,C |
| `vwap_30m_day_trend_t1_long_fixed12h` | failed/sparse | -4,984 | -5,786 | 2,568 | 2,721 | 423/415/109/105 | -8,288 | -3,412 | P,B,M,C |
| `vwap_30m_week_trend_t1_long_indicator_or12h` | failed/sparse | -5,099 | -4,546 | -1,098 | -822 | 298/295/77/75 | -8,404 | -4,465 | P,B,M,C |
| `vwap_15m_week_recovery_t1_long_indicator_or12h` | failed/sparse | -5,132 | -5,800 | -593 | -984 | 377/353/79/76 | -8,436 | -5,471 | P,B,M,C |
| `vwap_240m_day_recovery_t0.5_long_indicator_or12h` | failed/sparse | -5,148 | -4,769 | -1,388 | -2,191 | 274/240/61/53 | -8,453 | -5,282 | P,B,M,C |
| `rvol_30m_rolling20_follow_t1.5_long_indicator_or12h` | failed/sparse | -5,281 | -4,465 | -2,893 | -2,170 | 900/900/247/247 | -8,585 | -5,318 | P,B,M,C |
| `vwap_240m_week_recovery_t2_long_fixed12h` | failed/sparse | -5,300 | -4,557 | -2,498 | -2,866 | 135/123/29/27 | -8,604 | -5,158 | P,B,M,C |
| `vwap_5m_week_recovery_t0.5_long_indicator_or12h` | failed/sparse | -5,340 | -5,580 | -1,808 | -1,956 | 687/638/149/138 | -8,645 | -5,307 | P,B,M,C |
| `vwap_5m_week_recovery_t1_long_indicator_or12h` | failed/sparse | -5,612 | -6,307 | -745 | -994 | 447/435/92/89 | -8,916 | -5,073 | P,B,M,C |
| `vwap_240m_day_recovery_t2_long_fixed12h` | failed/sparse | -5,722 | -4,910 | -2,337 | -2,116 | 97/93/15/15 | -9,027 | -5,527 | P,B,M,C |
| `rvol_15m_rolling20_follow_t1.5_short_indicator_or12h` | failed/sparse | -31,312 | -30,288 | -8,472 | -8,470 | 2062/2062/519/519 | -9,029 | -3,319 | P,B,M,C |
| `vwap_60m_week_recovery_t0.5_long_fixed12h` | failed/sparse | -5,747 | -5,565 | 106 | 46 | 213/210/49/47 | -9,052 | -4,633 | P,B,M,C |
| `rvol_15m_time20_follow_t2_long_indicator_or12h` | failed/sparse | -5,775 | -4,630 | -905 | -762 | 898/898/227/227 | -9,079 | -4,303 | P,B,M,C |
| `vwap_15m_day_into_t1_long_fixed12h` | failed/sparse | -5,822 | -4,216 | -741 | -1,163 | 443/433/98/94 | -9,127 | -6,043 | P,B,M,C |
| `vwap_240m_week_recovery_t1_long_indicator_or12h` | failed/sparse | -5,850 | -5,516 | -1,183 | -1,745 | 164/147/36/33 | -9,154 | -5,035 | P,B,M,C |
| `vwap_5m_week_into_t1_long_fixed12h` | failed/sparse | -5,874 | -7,017 | 474 | 548 | 289/288/67/67 | -9,179 | -5,263 | P,B,M,C |
| `vwap_5m_day_trend_t0_long_fixed12h` | failed/sparse | -5,921 | -4,203 | 5,642 | 5,443 | 643/635/164/163 | -9,226 | -2,636 | P,B,M,C |
| `vwap_240m_day_trend_t0_long_indicator_or12h` | failed/sparse | -5,968 | -5,814 | 359 | 516 | 343/343/95/95 | -9,272 | -3,915 | P,B,M,C |
| `vwap_30m_week_recovery_t0.5_long_fixed12h` | failed/sparse | -6,066 | -5,023 | 364 | 249 | 242/241/57/57 | -9,370 | -5,089 | P,B,M,C |
| `vwap_60m_week_trend_t0_long_indicator_or12h` | failed/sparse | -6,106 | -6,149 | -21 | 115 | 385/385/91/91 | -9,411 | -4,232 | P,B,M,C |
| `vwap_15m_week_into_t0.5_long_fixed12h` | failed/sparse | -6,126 | -6,340 | 1,706 | 1,699 | 273/268/65/65 | -9,431 | -6,276 | P,B,M,C |
| `vwap_60m_day_recovery_t0.5_long_indicator_or12h` | failed/sparse | -6,188 | -5,216 | -1,753 | -1,554 | 620/536/138/121 | -9,492 | -5,898 | P,B,M,C |
| `vwap_5m_day_recovery_t1_long_indicator_or12h` | failed/sparse | -6,314 | -6,778 | -757 | -1,217 | 784/763/160/156 | -9,618 | -6,324 | P,B,M,C |
| `vwap_60m_week_trend_t0.5_long_indicator_or12h` | failed/sparse | -6,549 | -5,955 | -704 | -445 | 325/324/82/81 | -9,853 | -4,276 | P,B,M,C |
| `vwap_240m_day_trend_t1_long_indicator_or12h` | failed/sparse | -6,617 | -4,460 | 33 | 813 | 277/263/71/68 | -9,921 | -4,709 | P,B,M,C |
| `vwap_240m_day_trend_t0.5_long_fixed12h` | failed/sparse | -6,763 | -4,639 | 693 | -279 | 304/271/86/79 | -10,068 | -5,080 | P,B,M,C |
| `vwap_60m_day_into_t0.5_long_fixed12h` | failed/sparse | -6,786 | -4,868 | -1,468 | -1,510 | 458/435/104/98 | -10,091 | -4,840 | P,B,M,C |
| `vwap_15m_week_recovery_t0.5_long_indicator_or12h` | failed/sparse | -6,945 | -7,169 | -2,499 | -2,446 | 520/462/110/101 | -10,250 | -6,063 | P,B,M,C |
| `vwap_60m_week_recovery_t1_long_fixed12h` | failed/sparse | -6,970 | -8,402 | -3,249 | -3,893 | 209/204/50/49 | -10,275 | -5,048 | P,B,M,C |
| `vwap_30m_day_recovery_t0.5_long_indicator_or12h` | failed/sparse | -7,102 | -6,277 | -1,345 | -883 | 853/746/197/170 | -10,407 | -5,732 | P,B,M,C |
| `vwap_15m_week_into_t1_long_fixed12h` | failed/sparse | -7,243 | -8,385 | -1,312 | -1,384 | 269/264/61/60 | -10,548 | -5,324 | P,B,M,C |
| `vwap_30m_day_into_t0.5_long_fixed12h` | failed/sparse | -7,303 | -4,628 | -372 | -1,191 | 503/492/113/112 | -10,608 | -4,637 | P,B,M,C |
| `vwap_5m_week_trend_t0_long_fixed12h` | failed/sparse | -7,326 | -5,354 | 2,473 | 2,356 | 309/308/71/71 | -10,631 | -5,677 | P,B,M,C |
| `vwap_60m_day_recovery_t1_long_fixed12h` | failed/sparse | -7,373 | -5,647 | -987 | -1,142 | 319/308/67/67 | -10,678 | -4,951 | P,B,M,C |
| `vwap_240m_day_recovery_t1_long_fixed12h` | failed/sparse | -7,452 | -5,397 | -2,370 | -2,505 | 181/170/40/38 | -10,756 | -4,500 | P,B,M,C |
| `vwap_30m_week_recovery_t1_long_fixed12h` | failed/sparse | -7,499 | -7,696 | -2,094 | -1,717 | 237/233/57/57 | -10,803 | -4,882 | P,B,M,C |
| `vwap_15m_day_recovery_t1_long_fixed12h` | failed/sparse | -7,568 | -7,379 | -905 | -930 | 411/404/86/85 | -10,873 | -5,706 | P,B,M,C |
| `vwap_60m_week_into_t0.5_long_fixed12h` | failed/sparse | -7,937 | -7,450 | 1,396 | 1,462 | 232/224/56/55 | -11,242 | -6,580 | P,B,M,C |
| `vwap_30m_week_into_t0.5_long_fixed12h` | failed/sparse | -7,961 | -6,893 | 1,840 | 1,880 | 248/239/60/59 | -11,265 | -6,258 | P,B,M,C |
| `rvol_30m_rolling20_fade_t1.5_long_indicator_or12h` | failed/sparse | -8,074 | -8,489 | -84 | -228 | 1053/1053/268/268 | -11,378 | -5,935 | P,B,M,C |
| `vwap_30m_day_recovery_t1_long_fixed12h` | failed/sparse | -8,330 | -6,106 | -1,576 | -1,125 | 369/358/78/76 | -11,635 | -5,112 | P,B,M,C |
| `vwap_5m_week_recovery_t1_long_fixed12h` | failed/sparse | -8,337 | -7,724 | -404 | -792 | 278/276/63/63 | -11,641 | -4,422 | P,B,M,C |
| `vwap_240m_week_recovery_t1_long_fixed12h` | failed/sparse | -8,359 | -6,517 | -1,397 | -1,408 | 154/146/35/33 | -11,663 | -4,916 | P,B,M,C |
| `vwap_240m_day_recovery_t0.5_long_fixed12h` | failed/sparse | -8,519 | -4,494 | -4,061 | -3,833 | 251/230/55/50 | -11,824 | -4,726 | P,B,M,C |
| `vwap_30m_week_trend_t0.5_long_indicator_or12h` | failed/sparse | -8,654 | -7,292 | -1,592 | -1,250 | 410/408/104/104 | -11,959 | -4,392 | P,B,M,C |
| `vwap_15m_week_recovery_t0.5_long_fixed12h` | failed/sparse | -8,756 | -8,076 | -663 | -615 | 273/271/64/64 | -12,061 | -5,359 | P,B,M,C |
| `vwap_240m_day_trend_t0_long_fixed12h` | failed/sparse | -8,962 | -7,466 | -2,315 | -3,512 | 311/286/87/80 | -12,267 | -4,023 | P,B,M,C |
| `vwap_5m_week_trend_t1_long_indicator_or12h` | failed/sparse | -9,043 | -7,968 | -2,973 | -3,093 | 443/443/108/108 | -12,348 | -4,878 | P,B,M,C |
| `vwap_5m_day_into_t0.5_long_indicator_or12h` | failed/sparse | -9,145 | -12,783 | -1,550 | -1,787 | 1445/1444/320/319 | -12,449 | -6,093 | P,B,M,C |
| `vwap_240m_day_trend_t0.5_long_indicator_or12h` | failed/sparse | -9,270 | -8,747 | -108 | 186 | 317/310/87/86 | -12,575 | -4,149 | P,B,M,C |
| `vwap_15m_week_trend_t1_long_indicator_or12h` | failed/sparse | -9,286 | -8,761 | -3,188 | -3,147 | 361/361/90/90 | -12,590 | -4,488 | P,B,M,C |
| `vwap_15m_day_recovery_t0.5_long_indicator_or12h` | failed/sparse | -9,532 | -9,831 | -2,784 | -2,449 | 1111/1002/251/228 | -12,836 | -7,572 | P,B,M,C |
| `vwap_60m_day_trend_t1_long_fixed12h` | failed/sparse | -9,719 | -13,742 | 2,847 | 1,209 | 381/372/97/93 | -13,023 | -3,358 | P,B,M,C |
| `rvol_5m_rolling20_follow_t3_short_indicator_or12h` | failed/sparse | -35,426 | -31,700 | -9,751 | -9,682 | 2315/2315/563/563 | -13,143 | -4,027 | P,B,M,C,E |
| `vwap_240m_day_trend_t1_long_fixed12h` | failed/sparse | -9,905 | -5,158 | -1,115 | -1,422 | 269/243/71/66 | -13,210 | -6,987 | P,B,M,C |
| `rvol_5m_time20_fade_t3_long_indicator_or12h` | failed/sparse | -10,261 | -13,151 | -1,561 | -2,731 | 1853/1853/458/458 | -13,565 | -6,930 | P,B,M,C |
| `bar_direction_240m_rolling20_follow_t0_long_indicator_or12h` | control | -10,341 | -6,732 | 2,934 | 3,924 | 1031/728/267/188 | -13,646 | -4,088 | P,B,M,C |
| `vwap_15m_week_recovery_t1_long_fixed12h` | failed/sparse | -10,414 | -10,787 | -2,128 | -1,587 | 259/257/59/59 | -13,718 | -4,614 | P,B,M,C |
| `vwap_5m_day_recovery_t0.5_long_fixed12h` | failed/sparse | -10,655 | -10,900 | -246 | -252 | 567/565/135/134 | -13,959 | -3,710 | P,B,M,C |
| `bar_direction_240m_time20_follow_t0_long_indicator_or12h` | control | -10,961 | -4,754 | 2,631 | 5,225 | 1035/744/272/193 | -14,265 | -3,685 | P,B,M,C |
| `rvol_5m_time20_follow_t3_long_indicator_or12h` | failed/sparse | -10,989 | -9,530 | -1,412 | -1,397 | 1602/1602/407/407 | -14,294 | -5,248 | P,B,M,C |
| `vwap_15m_day_recovery_t0.5_long_fixed12h` | failed/sparse | -11,189 | -10,765 | 1,928 | 1,365 | 526/520/129/129 | -14,494 | -5,238 | P,B,M,C |
| `rvol_15m_rolling20_fade_t2_long_indicator_or12h` | failed/sparse | -11,267 | -11,991 | -3,696 | -3,516 | 1321/1321/334/334 | -14,572 | -7,134 | P,B,M,C |
| `vwap_15m_week_trend_t0.5_long_indicator_or12h` | failed/sparse | -11,555 | -9,401 | -2,896 | -2,170 | 519/518/131/131 | -14,860 | -4,581 | P,B,M,C |
| `vwap_30m_week_trend_t0_long_indicator_or12h` | failed/sparse | -11,581 | -9,912 | -2,091 | -2,091 | 575/575/138/138 | -14,885 | -4,745 | P,B,M,C |
| `vwap_15m_day_trend_t0_short_indicator_or12h` | failed/sparse | -37,800 | -35,267 | -12,216 | -11,089 | 2175/2175/565/565 | -15,518 | -3,846 | P,B,M,C,E |
| `rvol_15m_time20_fade_t1.5_long_indicator_or12h` | failed/sparse | -12,270 | -12,394 | -1,191 | -1,016 | 1572/1572/368/368 | -15,575 | -5,422 | P,B,M,C |
| `bar_direction_60m_rolling20_fade_t0_short_indicator_or12h` | control | -38,153 | -28,040 | -7,812 | -6,112 | 3748/2685/966/691 | -15,871 | -4,807 | P,B,M,C,E |
| `vwap_60m_day_recovery_t0.5_long_fixed12h` | failed/sparse | -12,684 | -10,253 | -407 | -432 | 412/399/89/85 | -15,989 | -4,000 | P,B,M,C |
| `rvol_15m_rolling20_follow_t2_long_indicator_or12h` | failed/sparse | -12,765 | -12,774 | -2,702 | -2,647 | 1198/1198/315/315 | -16,069 | -5,306 | P,B,M,C |
| `vwap_30m_day_recovery_t0.5_long_fixed12h` | failed/sparse | -13,202 | -11,094 | 233 | -24 | 468/462/110/109 | -16,506 | -5,209 | P,B,M,C |
| `vwap_5m_week_trend_t0.5_long_indicator_or12h` | failed/sparse | -13,205 | -12,361 | -3,367 | -3,222 | 689/688/172/172 | -16,510 | -4,580 | P,B,M,C |
| `rvol_5m_time20_fade_t2_short_indicator_or12h` | failed/sparse | -38,813 | -41,529 | -11,163 | -11,967 | 3173/3173/788/788 | -16,531 | -4,171 | P,B,M,C,E |
| `rvol_15m_time20_follow_t1.5_long_indicator_or12h` | failed/sparse | -13,291 | -10,489 | -2,549 | -2,013 | 1441/1440/370/370 | -16,596 | -4,835 | P,B,M,C |
| `vwap_60m_day_trend_t0_long_indicator_or12h` | failed/sparse | -13,541 | -12,145 | 2,140 | 2,678 | 931/931/239/239 | -16,846 | -4,408 | P,B,M,C |
| `vwap_5m_day_recovery_t0.5_long_indicator_or12h` | failed/sparse | -13,632 | -15,556 | -2,423 | -2,671 | 1445/1358/324/303 | -16,936 | -6,746 | P,B,M,C |
| `rvol_15m_rolling20_fade_t1.5_long_indicator_or12h` | failed/sparse | -14,062 | -15,084 | -2,949 | -2,951 | 2062/2062/519/519 | -17,366 | -7,905 | P,B,M,C |
| `vwap_15m_week_trend_t0_long_indicator_or12h` | failed/sparse | -14,380 | -12,538 | -2,350 | -2,011 | 875/875/191/191 | -17,684 | -4,668 | P,B,M,C |
| `vwap_60m_day_trend_t1_long_indicator_or12h` | failed/sparse | -14,810 | -14,467 | 972 | 905 | 486/484/117/117 | -18,114 | -5,187 | P,B,M,C |
| `vwap_30m_day_trend_t1_long_indicator_or12h` | failed/sparse | -15,422 | -13,975 | -702 | -265 | 597/593/146/145 | -18,727 | -4,931 | P,B,M,C |
| `rvol_5m_rolling20_fade_t3_long_indicator_or12h` | failed/sparse | -15,515 | -19,237 | -2,639 | -2,708 | 2315/2315/563/563 | -18,819 | -7,197 | P,B,M,C |
| `vwap_60m_day_trend_t0.5_long_indicator_or12h` | failed/sparse | -17,508 | -16,222 | 1,659 | 2,103 | 716/710/180/176 | -20,812 | -5,471 | P,B,M,C |
| `vwap_5m_day_trend_t1_long_indicator_or12h` | failed/sparse | -18,713 | -18,011 | -2,016 | -2,616 | 870/869/212/212 | -22,018 | -5,257 | P,B,M,C |
| `bar_direction_60m_time20_fade_t0_short_indicator_or12h` | control | -44,376 | -34,820 | -10,760 | -7,412 | 3849/2740/1003/716 | -22,094 | -4,225 | P,B,M,C,E |
| `vwap_15m_day_trend_t1_long_indicator_or12h` | failed/sparse | -19,650 | -17,245 | -1,026 | -769 | 716/715/173/173 | -22,955 | -4,534 | P,B,M,C |
| `vwap_30m_day_trend_t0.5_long_indicator_or12h` | failed/sparse | -19,706 | -17,246 | -350 | -205 | 921/920/226/226 | -23,010 | -4,770 | P,B,M,C |
| `bar_direction_60m_time20_fade_t0_long_indicator_or12h` | control | -20,804 | -20,424 | -756 | -874 | 3735/2722/951/693 | -24,109 | -5,016 | P,B,M,C |
| `vwap_30m_day_trend_t0_long_indicator_or12h` | failed/sparse | -21,694 | -18,691 | -1,291 | -674 | 1437/1437/371/371 | -24,999 | -3,659 | P,B,M,C |
| `bar_direction_60m_rolling20_fade_t0_long_indicator_or12h` | control | -21,800 | -17,768 | -275 | -1,371 | 3609/2663/920/680 | -25,105 | -5,641 | P,B,M,C |
| `rvol_5m_rolling20_follow_t3_long_indicator_or12h` | failed/sparse | -22,098 | -21,340 | -3,191 | -3,462 | 2006/2006/509/509 | -25,403 | -6,959 | P,B,M,C |
| `rvol_5m_rolling20_fade_t2_short_indicator_or12h` | failed/sparse | -48,333 | -49,675 | -13,930 | -13,486 | 4124/4124/1066/1066 | -26,050 | -4,452 | P,B,M,C,E |
| `rvol_5m_time20_follow_t2_short_indicator_or12h` | failed/sparse | -49,067 | -45,328 | -14,991 | -14,390 | 3499/3499/852/852 | -26,785 | -5,216 | P,B,M,C,E |
| `vwap_5m_day_trend_t0.5_long_indicator_or12h` | failed/sparse | -23,844 | -22,822 | -2,222 | -2,333 | 1499/1499/365/365 | -27,148 | -4,561 | P,B,M,C |
| `vwap_5m_week_trend_t0_long_indicator_or12h` | failed/sparse | -23,961 | -21,667 | -3,719 | -3,700 | 1526/1526/350/350 | -27,265 | -5,529 | P,B,M,C |
| `vwap_15m_day_trend_t0.5_long_indicator_or12h` | failed/sparse | -24,721 | -21,659 | -1,565 | -357 | 1161/1161/277/277 | -28,026 | -4,776 | P,B,M,C |
| `rvol_15m_rolling20_follow_t1.5_long_indicator_or12h` | failed/sparse | -25,328 | -23,905 | -4,410 | -4,003 | 1950/1950/513/513 | -28,633 | -6,040 | P,B,M,C |
| `rvol_5m_time20_fade_t1.5_short_indicator_or12h` | failed/sparse | -52,893 | -55,793 | -16,136 | -16,740 | 4746/4746/1187/1187 | -30,610 | -4,118 | P,B,M,C,E |
| `vwap_5m_day_trend_t0_short_indicator_or12h` | failed/sparse | -53,052 | -50,896 | -15,039 | -15,789 | 3872/3872/998/998 | -30,769 | -5,388 | P,B,M,C,E |
| `rvol_5m_time20_fade_t2_long_indicator_or12h` | failed/sparse | -27,922 | -31,658 | -3,759 | -4,360 | 3499/3499/852/852 | -31,227 | -7,086 | P,B,M,C |
| `vwap_15m_day_trend_t0_long_indicator_or12h` | failed/sparse | -30,668 | -28,594 | -3,959 | -2,791 | 2177/2177/558/558 | -33,972 | -4,508 | P,B,M,C |
| `rvol_5m_time20_follow_t2_long_indicator_or12h` | failed/sparse | -30,997 | -28,284 | -6,176 | -5,373 | 3173/3173/788/788 | -34,301 | -6,504 | P,B,M,C |
| `bar_direction_60m_rolling20_follow_t0_short_indicator_or12h` | control | -57,617 | -40,852 | -19,976 | -13,618 | 3609/2663/920/680 | -35,335 | -6,573 | P,B,M,C,E |
| `bar_direction_60m_time20_follow_t0_short_indicator_or12h` | control | -61,388 | -39,493 | -20,177 | -14,402 | 3735/2722/951/693 | -39,105 | -6,364 | P,B,M,C,E |
| `rvol_5m_rolling20_follow_t2_short_indicator_or12h` | failed/sparse | -64,018 | -59,010 | -18,793 | -18,133 | 4670/4670/1149/1149 | -41,735 | -6,376 | P,B,M,C,E |
| `rvol_5m_rolling20_fade_t2_long_indicator_or12h` | failed/sparse | -38,736 | -43,738 | -6,491 | -7,151 | 4670/4670/1149/1149 | -42,040 | -8,012 | P,B,M,C,E |
| `bar_direction_60m_time20_follow_t0_long_indicator_or12h` | control | -40,326 | -25,465 | -11,328 | -8,339 | 3849/2740/1003/716 | -43,630 | -6,306 | P,B,M,C,E |
| `rvol_5m_rolling20_fade_t1.5_short_indicator_or12h` | failed/sparse | -67,328 | -69,195 | -20,718 | -19,749 | 6293/6293/1657/1657 | -45,045 | -5,437 | P,B,M,C,E |
| `rvol_5m_rolling20_follow_t2_long_indicator_or12h` | failed/sparse | -42,399 | -41,057 | -9,525 | -9,968 | 4124/4124/1066/1066 | -45,703 | -8,079 | P,B,M,C,E |
| `rvol_5m_time20_follow_t1.5_short_indicator_or12h` | failed/sparse | -68,936 | -63,786 | -20,048 | -19,442 | 5155/5155/1269/1269 | -46,653 | -6,423 | P,B,M,C,E |
| `bar_direction_60m_rolling20_follow_t0_long_indicator_or12h` | control | -44,321 | -31,028 | -13,459 | -9,088 | 3748/2685/966/691 | -47,626 | -5,597 | P,B,M,C,E |
| `rvol_5m_time20_fade_t1.5_long_indicator_or12h` | failed/sparse | -44,487 | -49,632 | -7,877 | -8,482 | 5155/5155/1269/1269 | -47,792 | -8,296 | P,B,M,C,E |
| `vwap_5m_day_trend_t0_long_indicator_or12h` | failed/sparse | -46,145 | -44,274 | -7,181 | -7,931 | 3877/3877/999/999 | -49,449 | -5,945 | P,B,M,C,E |
| `rvol_5m_time20_follow_t1.5_long_indicator_or12h` | failed/sparse | -51,520 | -48,623 | -9,981 | -9,378 | 4746/4746/1187/1187 | -54,825 | -7,336 | P,B,M,C,E |
| `bar_direction_30m_time20_fade_t0_long_indicator_or12h` | control | -56,635 | -46,849 | -10,685 | -7,961 | 7443/5426/1921/1405 | -59,940 | -5,961 | P,B,M,C,E |
| `bar_direction_30m_rolling20_fade_t0_short_indicator_or12h` | control | -82,855 | -67,194 | -21,328 | -18,492 | 7537/5435/1898/1366 | -60,573 | -6,343 | P,B,M,C,E |
| `bar_direction_30m_rolling20_fade_t0_long_indicator_or12h` | control | -58,950 | -50,608 | -12,488 | -12,451 | 7307/5409/1864/1356 | -62,255 | -8,587 | P,B,M,C,E |
| `bar_direction_30m_time20_fade_t0_short_indicator_or12h` | control | -86,537 | -68,665 | -21,646 | -17,913 | 7643/5478/1943/1389 | -64,254 | -6,956 | P,B,M,C,E |
| `rvol_5m_rolling20_fade_t1.5_long_indicator_or12h` | failed/sparse | -61,497 | -67,800 | -13,316 | -14,111 | 6989/6989/1743/1743 | -64,801 | -9,268 | P,B,M,C,E |
| `rvol_5m_rolling20_follow_t1.5_short_indicator_or12h` | failed/sparse | -92,278 | -85,968 | -25,036 | -24,240 | 6989/6989/1743/1743 | -69,995 | -9,498 | P,B,M,C,E |
| `rvol_5m_rolling20_follow_t1.5_long_indicator_or12h` | failed/sparse | -71,116 | -69,251 | -15,739 | -16,707 | 6293/6293/1657/1657 | -74,420 | -10,159 | P,B,M,C,E |
| `bar_direction_30m_rolling20_follow_t0_short_indicator_or12h` | control | -101,827 | -68,400 | -28,529 | -17,384 | 7307/5409/1864/1356 | -79,545 | -7,444 | P,B,M,C,E |
| `bar_direction_30m_time20_follow_t0_short_indicator_or12h` | control | -107,138 | -72,537 | -31,588 | -22,957 | 7443/5426/1921/1405 | -84,856 | -8,506 | P,B,M,C,E |
| `bar_direction_30m_time20_follow_t0_long_indicator_or12h` | control | -81,634 | -51,882 | -21,123 | -12,670 | 7643/5478/1943/1389 | -84,938 | -8,296 | P,B,M,C,E |
| `bar_direction_30m_rolling20_follow_t0_long_indicator_or12h` | control | -82,981 | -52,406 | -20,451 | -11,586 | 7537/5435/1898/1366 | -86,285 | -7,992 | P,B,M,C,E |
| `bar_direction_15m_rolling20_fade_t0_short_indicator_or12h` | control | -156,124 | -115,444 | -38,865 | -28,921 | 15289/11032/3904/2810 | -133,842 | -11,475 | P,B,M,C,E |
| `bar_direction_15m_rolling20_fade_t0_long_indicator_or12h` | control | -137,045 | -108,065 | -30,813 | -28,097 | 14807/10887/3793/2781 | -140,349 | -12,721 | P,B,M,C,E |
| `bar_direction_15m_time20_fade_t0_long_indicator_or12h` | control | -137,241 | -104,782 | -31,226 | -23,164 | 14973/10807/3837/2783 | -140,545 | -13,445 | P,B,M,C,E |
| `bar_direction_15m_time20_fade_t0_short_indicator_or12h` | control | -163,930 | -126,596 | -41,611 | -33,617 | 15413/10929/3948/2784 | -141,648 | -11,865 | P,B,M,C,E |
| `bar_direction_15m_rolling20_follow_t0_short_indicator_or12h` | control | -188,760 | -131,462 | -52,667 | -33,088 | 14807/10887/3793/2781 | -166,477 | -15,250 | P,B,M,C,E |
| `bar_direction_15m_time20_follow_t0_short_indicator_or12h` | control | -192,217 | -132,987 | -53,222 | -38,070 | 14973/10807/3837/2783 | -169,935 | -15,210 | P,B,M,C,E |
| `bar_direction_15m_time20_follow_t0_long_indicator_or12h` | control | -175,149 | -113,849 | -45,243 | -27,635 | 15413/10929/3948/2784 | -178,454 | -15,489 | P,B,M,C,E |
| `bar_direction_15m_rolling20_follow_t0_long_indicator_or12h` | control | -180,220 | -127,253 | -47,018 | -32,896 | 15289/11032/3904/2810 | -183,525 | -14,792 | P,B,M,C,E |
| `bar_direction_5m_rolling20_fade_t0_long_indicator_or12h` | control | -475,212 | -342,579 | -114,449 | -85,876 | 45447/33352/11714/8602 | -478,517 | -40,339 | P,B,M,C,E |
| `bar_direction_5m_time20_fade_t0_long_indicator_or12h` | control | -479,443 | -336,308 | -117,909 | -84,428 | 45609/32880/11743/8491 | -482,748 | -40,432 | P,B,M,C,E |
| `bar_direction_5m_rolling20_fade_t0_short_indicator_or12h` | control | -506,437 | -366,445 | -127,172 | -95,278 | 46529/33648/11733/8575 | -484,155 | -38,812 | P,B,M,C,E |
| `bar_direction_5m_time20_fade_t0_short_indicator_or12h` | control | -514,750 | -360,752 | -132,170 | -95,955 | 46598/33152/11737/8415 | -492,468 | -39,886 | P,B,M,C,E |
| `bar_direction_5m_time20_follow_t0_short_indicator_or12h` | control | -524,001 | -387,080 | -140,471 | -102,384 | 45609/32880/11743/8491 | -501,719 | -43,042 | P,B,M,C,E |
| `bar_direction_5m_rolling20_follow_t0_short_indicator_or12h` | control | -524,671 | -391,191 | -143,297 | -103,377 | 45447/33352/11714/8602 | -502,388 | -40,147 | P,B,M,C,E |
| `bar_direction_5m_time20_follow_t0_long_indicator_or12h` | control | -510,408 | -368,610 | -126,047 | -89,201 | 46598/33152/11737/8415 | -513,712 | -43,197 | P,B,M,C,E |
| `bar_direction_5m_rolling20_follow_t0_long_indicator_or12h` | control | -517,195 | -373,829 | -130,952 | -93,395 | 46529/33648/11733/8575 | -520,499 | -40,546 | P,B,M,C,E |
