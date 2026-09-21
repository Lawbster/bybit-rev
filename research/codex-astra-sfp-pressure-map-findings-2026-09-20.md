# SF04 — SFP pressure-point map: winning bounces versus stops

## TL;DR

- **23 original trades: 13 wins, 10 stops.** Recorded HL taker/book history starts May17; there are not15 of each. All eligible cases are included without indicator-based selection. These are descriptive associations, not a new strategy.
- Entry RSI/CRSI, book, OI and funding overlap substantially. Winning trades were generally deeper below weekly VWAP, but **entry HL selling was stronger among winners in aggregate** and that relationship flips by month. A blanket selling-at-entry block is not supported.
- The clearer distinction develops after entry: winners recover momentum/VWAP while stopped trades stall. Seven stops later hit their original TP by entry+72h; two do not; one is censored. There are too few non-recoveries to claim a reliable disaster filter.

## Cohort and baseline

Original SF01 **4h range-qualified, 2R, 24h cap**, $10k notional, standard0.055% taker/side, before funding; source lag60s. Not SF02 or SF03. Full accepted window Dec27,2024–Sep15,2026 20:20 UTC: **43W/79L, winning $18,124, losing -$15,449, net +$2,690 including open MTM, DD7.92%**. Exact archived trade file and receipts reused; no new replay.
Selected entries: 2026-05-26T12:01:00.000Z through 2026-09-15T16:01:00.000Z. Wins include 4 profitable timeouts; stops exclude the one losing timeout (-$258) and cutoff open inventory. The selected winners total $3,664, selected stops -$1,857. These subset sums are NOT filtered-strategy earnings or an account DD.
The requested15+15 typical examples cannot be supplied with this exact setup and HL era. Rather than fabricate coverage or select attractive patterns, this map uses the available13+10, presents median/IQR/full ranges, and flags monetary/geometric extremes separately. It is not a handpicked average sample or an untouched holdout. Some trades share the same decline (for example the September8 stops);23 trades are not23 independent market regimes.

## What is stored and when it was knowable

**878 snapshots, 204 columns:** 15m/1h/4h indicators; EMA20/50/200; UTC day/week VWAP; ADX/DMI/ATR/ROC/relative volume/MFI/CMF and existing ancillary features; HL flow, large trades, depth, native OI, funding. Exact price levels, not just distances, are in features.csv.
- Entry: -4h, -1h, each minute from-15m through entry, then+15m/+1h while still open. Exit: -1h, each minute from-15m through exit while owned, then+15m/+1h as diagnostics. Exit anchor is the **start** of the exit minute; no stop/TP-bar final high/low is used as prior information.
- Every candle feature uses a finalized source bar plus60s. 4h readings can remain unchanged for hours. Additional60s source-delay sensitivity is stored. Feature values use the last completed bar close, not an invented current forming close.
- VWAP uses actual Bybit turnover/base volume, day00:00UTC and Monday week reset. Day/week labels refer to the source bar’s session; near a boundary a1h feature can still describe the preceding session. Source anchors are saved. EMA is SMA-seeded once from Jan1,2026; Connors RSI is RSI3/RSI2-streak/prior100 rank.
- HL buy/sell ratios are notional-weighted; <1 means selling dominates. Book imbalance is (bid-ask)/(bid+ask) at0.5%, not trade flow; aggregated/truncated/stale bands are not treated as valid narrow depth. OI means native quantity, not price-driven marked dollar OI.
- All23 entry snapshots have healthy taker15/book0.5/asset context. Some trajectory cells have missing flow; each summary keeps its actual n. Original HL sample-time/receipt clocks are respected, but old sample-time proxies are not proof of exact historical network arrival. Source hashes and compact source references are retained. No HLP/candle-HL stream is loaded; those fields remain null rather than inferred.

## Entry ranges — median [middle50%], plus full observed span

| Feature | Wins median [Q25,Q75] | Wins full range | Stops median [Q25,Q75] | Stops full range |
|---|---:|---|---:|---|
| RSI14 15m | 44.64 [36.82, 52.60] | 27.73 to 62.46 (n=13) | 43.33 [33.78, 45.14] | 30.13 to 57.36 (n=10) |
| RSI14 1h | 40.23 [34.26, 43.05] | 14.62 to 51.88 (n=13) | 36.41 [33.97, 41.28] | 23.12 to 47.25 (n=10) |
| RSI14 4h | 36.51 [32.36, 44.34] | 27.66 to 56.04 (n=13) | 41.00 [36.59, 46.87] | 31.67 to 54.49 (n=10) |
| CRSI 15m | 45.98 [27.76, 66.81] | 14.72 to 88.42 (n=13) | 52.27 [30.38, 69.36] | 8.70 to 79.17 (n=10) |
| CRSI 1h | 44.72 [26.60, 56.75] | 10.50 to 80.84 (n=13) | 57.56 [25.73, 62.48] | 9.03 to 76.54 (n=10) |
| CRSI 4h | 27.65 [17.60, 62.81] | 5.39 to 75.69 (n=13) | 21.89 [16.96, 42.12] | 8.35 to 71.79 (n=10) |
| 1h close vs day VWAP % | -1.44 [-3.23, 0.04] | -4.89 to 2.04 (n=13) | -1.45 [-1.60, -0.09] | -2.06 to 0.43 (n=10) |
| 1h close vs week VWAP % | -5.50 [-6.59, -2.28] | -16.22 to -0.44 (n=13) | -2.89 [-3.89, -2.19] | -7.81 to 0.43 (n=10) |
| 1h close vs EMA50 % | -3.17 [-4.18, -2.07] | -6.82 to 0.37 (n=13) | -1.91 [-3.67, -1.56] | -5.91 to -1.24 (n=10) |
| 1h close vs EMA200 % | -6.14 [-7.68, -0.27] | -12.53 to 8.91 (n=13) | -2.64 [-5.79, 0.51] | -9.35 to 7.12 (n=10) |
| 4h close vs EMA200 % | -0.02 [-6.95, 10.04] | -9.69 to 28.91 (n=13) | 6.95 [-0.73, 11.92] | -12.13 to 30.65 (n=10) |
| 4h EMA50 one-bar slope % | -0.25 [-0.31, -0.01] | -0.50 to 0.36 (n=13) | -0.10 [-0.23, 0.02] | -0.37 to 0.29 (n=10) |
| ADX14 1h | 25.76 [20.76, 41.37] | 16.78 to 56.63 (n=13) | 30.49 [20.41, 37.75] | 17.13 to 49.09 (n=10) |
| DI+ minus DI- 1h | -11.23 [-20.51, -6.59] | -38.67 to 4.66 (n=13) | -18.36 [-26.83, -15.20] | -29.68 to -2.24 (n=10) |
| ATR14 1h % | 1.72 [1.25, 1.92] | 0.89 to 2.23 (n=13) | 1.25 [1.13, 1.43] | 0.89 to 2.31 (n=10) |
| RVOL20 1h | 0.96 [0.69, 1.04] | 0.42 to 2.05 (n=13) | 0.87 [0.65, 1.47] | 0.30 to 2.60 (n=10) |
| MFI14 1h | 30.45 [27.19, 41.03] | 13.31 to 50.76 (n=13) | 28.57 [19.94, 35.96] | 11.11 to 45.32 (n=10) |
| CMF20 1h | -0.11 [-0.14, -0.03] | -0.25 to 0.12 (n=13) | -0.07 [-0.13, -0.04] | -0.24 to 0.07 (n=10) |
| HL buy/sell notional 15m | 0.67 [0.38, 1.20] | 0.23 to 3.22 (n=13) | 1.19 [0.68, 1.43] | 0.35 to 2.54 (n=10) |
| HL buy/sell notional 1h | 1.11 [0.98, 1.51] | 0.32 to 2.80 (n=13) | 1.18 [0.81, 1.50] | 0.44 to 2.55 (n=10) |
| HL buy/sell notional 4h | 0.96 [0.89, 1.09] | 0.49 to 1.29 (n=13) | 0.89 [0.68, 0.96] | 0.59 to 1.16 (n=10) |
| HL buy-share change: last5 vs prior10m | -0.10 [-0.27, 0.27] | -0.51 to 0.42 (n=13) | -0.05 [-0.29, 0.14] | -0.39 to 0.46 (n=10) |
| HL large-trade net / turnover15m | 0.00 [-0.04, 0.00] | -0.30 to 0.09 (n=13) | 0.00 [-0.04, 0.02] | -0.21 to 0.11 (n=10) |
| HL book imbalance 0.5% | -0.04 [-0.11, 0.00] | -0.45 to 0.16 (n=13) | -0.04 [-0.17, 0.12] | -0.22 to 0.40 (n=10) |
| HL book imbalance change15m | 0.07 [-0.26, 0.17] | -0.84 to 0.51 (n=13) | 0.04 [-0.10, 0.23] | -0.29 to 0.56 (n=10) |
| HL bid depth change15m % | -0.64 [-25.87, 9.19] | -83.09 to 29.85 (n=13) | 2.76 [-15.58, 29.82] | -35.25 to 146.70 (n=10) |
| HL native OI change1h % | -0.02 [-0.08, 0.06] | -0.91 to 0.52 (n=13) | -0.04 [-0.22, 0.08] | -0.50 to 0.17 (n=10) |
| HL native OI change4h % | -0.39 [-0.51, 0.36] | -3.90 to 1.19 (n=13) | -0.39 [-0.70, -0.08] | -1.51 to 1.30 (n=10) |
| HL funding/hour (decimal) | 0.0000125 [0.0000011, 0.0000125] | -0.0000256 to 0.0000288 (n=13) | 0.0000125 [0.0000125, 0.0000125] | -0.0000402 to 0.0001494 (n=10) |

**Reading:** no clean RSI/CRSI cutoff. Daily VWAP entry medians are almost identical (~-1.44%). Weekly VWAP differs (-5.50% wins vs-2.89% stops), but ranges overlap. Stops are not simply the trades below EMA200: their4h EMA200-distance median is +6.95%, versus approximately0% for wins. A snapshot of apparently bullish trend/flow is not sufficient protection.

## What changes while the trade develops

Median values; every pair is **wins / stops**, n shown explicitly. After-entry rows are not eligible entry features. Later rows omit trades already closed: survivor composition changes, so do not read the table as one identical paired cohort.

| Point | n W/S | RSI15m | CRSI15m | Day VWAP1h distance % | HL15m buy/sell | HL1h buy/sell |
|---|---:|---:|---:|---:|---:|---:|
| Entry -1h | 13/10 | 42.52 / 38.34 | 64.56 / 62.46 | -2.11 / -1.27 | 1.16 / 0.99 | 0.88 / 0.65 |
| Entry -15m | 13/10 | 44.67 / 43.99 | 65.58 / 45.33 | -2.11 / -1.27 | 1.17 / 1.00 | 1.11 / 1.13 |
| Entry | 13/10 | 44.64 / 43.33 | 45.98 / 52.27 | -1.44 / -1.45 | 0.67 / 1.19 | 1.11 / 1.18 |
| Entry +15m | 12/9 | 48.08 / 43.48 | 46.98 / 41.75 | -1.01 / -1.38 | 1.00 / 0.47 | 1.00 / 1.02 |
| Entry +1h | 12/9 | 53.97 / 40.30 | 68.02 / 40.14 | 0.53 / -0.96 | 1.36 / 0.99 | 1.26 / 1.01 |
| Exit -1h | 12/9 | 54.48 / 43.30 | 39.15 / 42.01 | 0.58 / -1.10 | 0.92 / 0.52 | 1.09 / 0.80 |
| Exit -15m | 12/9 | 56.58 / 38.63 | 76.78 / 31.05 | 0.42 / -1.10 | 1.34 / 0.76 | 1.28 / 0.82 |
| Exit-minute start | 13/10 | 56.30 / 34.74 | 48.07 / 17.94 | 0.37 / -1.46 | 1.24 / 0.53 | 1.16 / 0.75 |

One hour after entry, remaining winners have median15m RSI53.97 and day-VWAP distance+0.53%; remaining stops40.30 and-0.96%. This is a **follow-through hypothesis**, not tested exit profits. The stop that ended in8 minutes and winner that closed in9 minutes are absent by+15m. At exit, sell pressure and low RSI partly describe the losing move itself; an exit-aligned table cannot prove warning lead time.

### Month check: does the entry association persist?

Only months containing both outcomes are compared. May/August have wins but no stops; mixing them can distort an aggregate “edge”.

| Month | n W/S | Weekly-VWAP distance W/S % | HL15 buy/sell W/S | RSI1h W/S |
|---|---:|---:|---:|---:|
| 2026-06 | 4/4 | -6.60 / -2.61 | 2.11 / 0.75 | 41.65 / 39.50 |
| 2026-07 | 3/2 | -6.59 / -3.78 | 0.67 / 1.88 | 32.61 / 33.94 |
| 2026-09 | 2/4 | -5.92 / -2.55 | 0.26 / 1.03 | 34.15 / 34.82 |

Weekly-VWAP discount is deeper among winners in June, July and September, but those comparisons are only4/4,3/2 and2/4. HL15 at entry reverses: June winners have stronger buying; July/September winners stronger selling. That disqualifies a simple universal reading from these examples.

## Stop recovery versus genuine continuation

| Entry UTC | Realized stop loss | Original stop distance | Later TP within72h of entry | MAE through recovery/horizon |
|---|---:|---:|---|---:|
| 2026-06-02 20:01 | -$249 | 2.38% | recovered at25.8h | -3.74% |
| 2026-06-10 04:01 | -$340 | 3.29% | recovered at56.3h | -6.96% |
| 2026-06-21 08:01 | -$45 | 0.34% | recovered at29.5h | -4.61% |
| 2026-06-22 08:01 | -$313 | 3.02% | not_recovered | -12.04% |
| 2026-07-22 08:01 | -$125 | 1.14% | recovered at11.1h | -2.11% |
| 2026-07-30 04:01 | -$201 | 1.90% | not_recovered | -4.76% |
| 2026-09-08 00:01 | -$110 | 0.99% | recovered at30.8h | -4.39% |
| 2026-09-08 08:01 | -$120 | 1.09% | recovered at20.9h | -3.04% |
| 2026-09-10 20:01 | -$219 | 2.08% | recovered at17.9h | -2.73% |
| 2026-09-15 16:01 | -$135 | 1.24% | censored | -2.77% |

Recovery = later touch of the original absolute TP strictly after the stop minute, before entry+72h; it is not proof a limit would fill or that an unstopped trade was profitable. MAE includes the full eventual target minute as a conservative path bound. Seven recoveries needed median3.74% adverse excursion, up to6.96%. September15 has incomplete follow-up and is not classified as a persistent failure.

| Non-recovering case | RSI1h at entry | CRSI1h | Weekly VWAP distance | HL15 / HL1h | OI4h change |
|---|---:|---:|---:|---:|---:|
| 2026-06-22T08:01 | 47.25 | 76.54 | 0.43% | 1.14 / 1.52 | -0.21% |
| 2026-07-30T04:01 | 44.76 | 60.56 | -3.56% | 1.23 / 0.80 | -0.35% |

June22 and July30 are the only fully observed non-recoveries. Both had fairly recovered1h RSI and buy-dominant15m flow at entry, but their broader EMA regimes differ. Two examples cannot define a credible heavy-loss classifier; using them to tune a cutoff would fit the answer.

## Geometry and typicality

| Measurement | Wins median [Q25,Q75] | Stops median [Q25,Q75] |
|---|---:|---:|
| Net dollars | 259.12 [120.64, 339.32] | -168.02 [-241.51, -120.96] |
| Holding hours | 7.43 [5.70, 24.00] | 3.68 [2.66, 7.89] |
| Entry-to-stop % | 1.94 [1.73, 2.17] | 1.57 [1.10, 2.31] |
| Stop distance /1h ATR | 0.95 [0.87, 1.88] | 1.14 [1.02, 1.48] |
| Entry position within range % | 6.11 [4.37, 10.68] | 9.26 [4.48, 11.30] |

At these entries stops are not uniformly tighter relative to volatility: median stop/1h-ATR1.14 for stops versus0.95 for wins. Geometry and outcome overlap; do not infer that all failures are just wick noise. Quartile flags in the case map identify unusually large/small net outcomes, risk or holding time; they are not an exclusion filter.

## Additional60s information delay

| Entry feature | Primary W/S medians | Delayed W/S medians |
|---|---:|---:|
| m60_weekVwapDistancePct | -5.50 / -2.89 | -4.75 / -3.03 |
| m60_rsi | 40.23 / 36.41 | 38.88 / 38.01 |
| m60_crsi | 44.72 / 57.56 | 45.10 / 20.80 |
| m240_ema200DistancePct | -0.02 / 6.95 | -1.67 / 5.87 |
| hl_takerRatio15 | 0.67 / 1.19 | 0.75 / 1.23 |
| hl_takerRatio60 | 1.11 / 1.18 | 1.11 / 1.23 |
| hl_bookImbalance05 | -0.04 / -0.04 | -0.03 / 0.05 |

A one-minute information delay can select the previous1h/4h candle at a confirmation boundary. Values are therefore explicitly re-queried, not assumed unchanged. No optimized threshold or economic robustness claim is made.

## Verdict / scope

The map narrows the question to **depth of discount plus the quality of recovery after the sweep**, rather than assuming bullish HL flow or an EMA trend snapshot identifies the winner. Weekly VWAP deserves a frozen comparison, but is not a proven filter. In-trade momentum/VWAP recovery needs a fixed decision clock and full replay accounting before it can justify an early exit or wider stop. No such rule is implemented here.
RSI/CRSI ranges, OI and book readings do not produce a clean winner/loser separator in this cohort. In particular, do not turn the2 non-recoveries into a fitted catastrophe rule. No live changes, no parameter grid, no new economic variant.

## Files and verification

- Job `0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207`, [case-by-case pressure map](../backtests/sfp-pressure-map-reviews/38a714b8f4eaa91039780b5ea4d005337b757d11d4ad50116485ce1759283224/case-map.md).
- [Flat feature table](../backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207/features.csv) / [trade and recovery ledger](../backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207/trades.csv).
- [Machine-readable source/phase map](../backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207/snapshots.json) / [all feature ranges](../backtests/sfp-pressure-map/0aa039e6bb818eab803e8ceba5b54c8b6f0fe242db24aa70fbcf46124d732207/feature-summary.json).
- [Frozen card](../research-inputs/sfp-pressure-map-sf04-2026-09-20.json). Reuse scripts/sfp-pressure-map.ts; completed inputs/outputs are fingerprinted and reused. No levels/detections or trades were recomputed.
- Verified 32 hashes, sealed pre-feature selection, 19316 stored source-clock bounds, and independently reconstructed all10 recovery labels. Focused tests cover closed-bar/EMA boundaries, future poisoning, prefix invariance, phase ownership and censoring. Validated existing indicator/HL modules reused.
