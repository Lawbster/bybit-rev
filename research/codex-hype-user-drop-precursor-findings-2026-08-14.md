# HYPE User-Marked Drop-Precursor Findings — 2026-08-14

## TL;DR

- The 26 supplied UTC+2 candle starts are useful labels, but they do **not** support a new immediate ladder-exit rule. Eighteen preceded a -2% low within 12 hours and 22 preceded a -3% low within 24 hours; however, -2%/12h occurred after 209/443 (47.2%) of all comparable 4h boundaries. Production memory resistance alone had no predictive lift and lost money as a short rule.
- The strongest causal read is a two-stage **top watch**: price within 0.3% of confirmed memory resistance while the last completed 4h close is at least 2% above EMA200, followed later by the already-frozen `hl_bid_pull_break`. The frozen short subset was n=20 at +1.456% fee-stressed expectancy, versus n=47 at +0.712% overall. This is a good forward-shadow confidence feature, not a live filter/sizing change: the selector was derived from this same history and the excluded shorts still made money.
- Long-side S/R warning actions failed monthly stability. The previously isolated persistent damaged-regime latch remains the only live patch candidate: completed 4h close <=-4% below EMA200 plus causal HL taker stress, blocking first entries/adds until two completed 4h closes recover inside -1% of EMA200. Its prior result remains +$7,799 versus current over the HL window, five fewer hard flattens, and no negative monthly delta.

## Question And Data Discipline

The user supplied 26 TradingView timestamps from June 2 through August 13 and confirmed the chart timezone was UTC+2. Each mark was interpreted as the **start** of a 4h candle and converted to UTC by subtracting two hours. For example, `06.04.2026 02:00` became `2026-06-04T00:00:00Z`.

At decision time T:

- price features use only candles completed before T;
- HL taker, order-book, OI, funding, liquidation, and Binance/BTC inputs use rows strictly before T;
- 4h EMA values use the 4h candle ending at T, never the candle starting at T;
- S/R uses production parity: 30m pivots, left/right 4, 0.45% clustering, minimum two touches, and a rolling 14-day window of pivots whose confirmation time is <=T;
- forward candles are used only for outcome labels and simulated exits.

The control set contains every comparable 4h boundary, not only the supplied positives: 443 decisions from `2026-06-01T00:00:00Z` through `2026-08-13T16:00:00Z`. The 26 marks form 24 clusters when marks separated by no more than 24 hours are treated as one cluster.

## Label Audit

| Outcome | Supplied marks |
|---|---:|
| Forward low <=-2% within 12h | 18/26 |
| Forward low <=-3% within 24h | 22/26 |
| Did not reach -2% within 12h | 8/26 |

The eight marks that did not meet the primary -2%/12h label were June 8, June 22, July 4, July 10, August 5, August 9 (the user-marked “iffy” row), August 10, and August 13. Several still reached -3% within 24h, so the marks are directionally meaningful, but they are not a uniform objective label.

The background rate matters: 209/443, or 47.2%, of all 4h boundaries reached a -2% forward low within 12 hours. HYPE's volatility makes a visually compelling set of declines much less selective than it first appears.

## What The Marked Candles Actually Look Like

Median decision-time context, event marks versus all non-marked controls:

| Feature | Event median | Control median | Read |
|---|---:|---:|---|
| Prior 4h return | +0.731% | +0.001% | marks generally followed a rise |
| Distance above 4h EMA200 | +4.541% | +1.374% | marks were more extended |
| HL OI change, 4h | +0.533% | -0.066% | positions were being added into the rise |
| HL taker ratio, 15m | 1.179 | 1.035 | not generally sell-dominant yet |
| HL book deterioration | +0.010 | -0.007 | not generally withdrawing yet |
| Resistance distance | 0.348% | 0.570% | resistance was closer |

This falsifies the initial framing that 15-minute HL sell flow should usually warn before these marked candles. The common mechanism is closer to **rising/crowded price approaching resistance**. Bearish taker/book confirmation often arrives after T, which is exactly why the frozen short's completed-break requirement is valuable.

### Audited causal trace

At the June 4 02:00 UTC+2 mark (`2026-06-04T00:00Z`):

- the prior completed 4h close was $74.522, +34.41% above its 4h EMA200;
- a two-high-touch memory resistance was already confirmed at $74.6945, 0.231% above price;
- 4h OI had risen 3.756%;
- the preceding 15m bar was not red and had not broken its prior low;
- the next 4h low was -6.05%, the 12h low -13.05%, and the 24h low -15.44%.

Nothing from the candle beginning at T participates in the predictor. This trace is internally consistent with the intended live boundary.

## S/R Findings

| Rule at each 4h boundary | Signals | Event hits | -2%/12h precision | Lift | Fee-stress short train/test expectancy |
|---|---:|---:|---:|---:|---:|
| Resistance <=0.3% | 125 | 13/26 | 46.4% | 0.98x | +0.618% / +0.273% |
| Resistance <=1.0% | 338 | 23/26 | 44.7% | 0.95x | -0.119% / -0.026% |
| Resistance <=1% + HL book withdrawal | 19 | 4/26 | 57.9% | 1.23x | +1.750% / +0.359% (train n=2) |
| Resistance <=0.3% + >=2% above EMA200 | 61 | 7/26 | 62.3% | 1.32x | +0.685% / +0.474% |

Conclusions:

1. The production S/R engine is mapping the visible levels correctly and causally. Twenty-three of 26 marks were within 1% of an already-confirmed resistance.
2. Resistance is extremely common: 338/443 boundaries were within 1%. It is context, not a standalone bearish signal.
3. Exact book withdrawal near resistance is promising but too sparse before July (two serial trades) and temporally fragile: it hit 4/26 at T, 0/26 at T-4h, and 2/26 at T+4h.
4. Elevated price near tight resistance is the more stable location feature, but it must be followed by independent breakdown confirmation.

## Short Confidence Read

The frozen `hl_bid_pull_break` replay has 47 serial trades at 0.20% fee stress:

| Cohort | n | Stress expectancy | Total stress return | $ PnL at fixed $25k |
|---|---:|---:|---:|---:|
| All frozen shorts | 47 | +0.712% | +33.444% | +$8,360.96 |
| Prior top-watch within 12h | 20 | +1.456% | +29.114% | +$7,278.39 |
| No prior top-watch within 12h | 27 | +0.160% | +4.330% | +$1,082.57 |

The top watch is:

> At a completed 4h boundary, price is within 0.3% below an already-confirmed production memory resistance and the completed 4h close is at least 2% above EMA200. Keep the watch for 12 hours. It never opens a short; only a later exact `hl_bid_pull_break` may enter.

Chronological read for the selected subset:

- pre-July: n=13, +1.668% stress expectancy;
- July/August: n=7, +1.062% stress expectancy;
- nearby resistance thresholds 0.2–1.0%, EMA-extension thresholds 0–2%, and 8–12h watch windows broadly retain positive two-half expectancy; 30 neighboring settings had n>=6 and expectancy >=+0.15% in both halves.

This is materially stronger confidence context, but it is **not true out-of-sample validation**. The marked dates used to discover the mechanism span both chronological halves. Also, filtering to these 20 trades would reduce total PnL because the remaining 27 trades are still net positive. The rational next use is read-only telemetry for 30–60 forward days, potentially followed by a shared-account dynamic-sizing replay—not blocking the existing short.

## Long Ladder Replay

All long variants retain the current partial-exit and support-reopen stack. Current HL-window baseline is +$16,665.44, 13 hard flattens, and 23.19% simulated max drawdown.

| Variant | HL-window delta | Hard flattens | Max DD | Monthly stability |
|---|---:|---:|---:|---|
| Tight-resistance/elevated top-watch, pause all opens/adds 4h | +$2,844.41 | 12 | 17.12% | FAIL: June -$1,646.26; July +$4,490.68; August $0 |
| Same, pause depth-5+ only | -$3,939.03 | 13 | 24.07% | FAIL |
| Same, 25% trim at depth 6+ | +$460.60 | 13 | 22.46% | FAIL: July -$576.31 |
| Same, 50% trim at depth 6+ | +$3,077.97 | 13 | 20.96% | FAIL: July -$293.50 and discovery-sample dependence |
| Same, 75% trim at depth 6+ | -$2,965.87 | 12 | 22.74% | FAIL |
| Book-withdrawal/resistance, pause all 4h | +$1,536.11 | 13 | 19.59% | FAIL: June -$915.95 |
| Book-withdrawal/resistance, 50% trim depth 6+ | +$3,936.13 | 13 | 21.53% | FAIL: July -$267.01; train trigger n too small |

These apparent gains are path-dependent, discovered on the same short HL window, and fail the per-month stability requirement. They also fail to materially solve hard-flatten frequency. No S/R exit or add-block change should be made live from this pass.

## Invisible Upside Accounted For

- Blocking every non-top-watch short would discard +$1,082.57 of fee-stressed PnL at fixed $25k, even though its expectancy is lower.
- Broad resistance add blocks alter ladder paths and can avoid one visible flatten while losing profitable cycles in another month. June's -$1,646 delta is the clearest example.
- The current S/R partial system remains intact in every baseline comparison; candidate gains are incremental to it, not a comparison against a weaker no-partial system.

## Recommendation

1. **No live S/R exit/add-block change.** The current S/R calculations are causal and behaving as intended; the missing ingredient is not a more aggressive resistance reaction.
2. **No live short filter.** Preserve all frozen `hl_bid_pull_break` entries.
3. Add the elevated-resistance top-watch only as read-only short confidence telemetry if operational scope permits. Collect 30–60 days before considering dynamic sizing.
4. Proceed with the separately proven persistent damaged-regime latch. It addresses the actual recent failure mode—repeated long ladder deployment after structural damage—while leaving exits, S/R logic, and the short owner unchanged.

## Reproducibility

- Event/control audit: `scripts/hype-user-drop-precursor-audit.ts`
- Long replay integration: `scripts/hype-current-regime-60d-audit.ts`
- Event ledger: `backtests/hype/user-drop-precursor-2026-08-14/event-ledger.csv`
- Full controls: `backtests/hype/user-drop-precursor-2026-08-14/all-4h-controls.csv`
- Rule ranking: `backtests/hype/user-drop-precursor-2026-08-14/precursor-rule-ranking.csv`
- Frozen-short S/R strata: `backtests/hype/user-drop-precursor-2026-08-14/live-short-sr-strata.csv`
- Neighbor grid: `backtests/hype/user-drop-precursor-2026-08-14/live-short-topwatch-neighbor-grid.csv`
- Long summaries/months: `backtests/hype/current-regime-60d-2026-08-14/summary.csv` and `monthly.csv`
