# HT02: POC / NPOC blocks on the top three two-day-high shorts

September 17, 2026. Research only; live unchanged.

## TL;DR

- **192 filters tested on the three frozen HT01 parents.** The clearest shared improvement is: do not short when the **previous completed week's POC row is below/containing price and within 2%**. For TP 2% / SL 3.5%, net rises **$7,589 -> $9,372**, DD **10.81% -> 9.97%**, win rate **65.15% -> 65.99%**, on 551 -> 544 completed trades.
- This same filter improves **net in all six window/delay paths for all three parents**, with nonworse DD. Win-rate changes are small, not a step-change in predictability. The leading pair's recent net rises **$437 -> $910**, but its extra-minute recent path remains **-$53**, or **-$782** with added costs. **0/192 complete or relative qualifiers.**
- NPOC variants are weaker as repeatable filters. Their best per-parent full gains are **$382 / $1,340 / $927**, but two make no change at all to recent executions. Their strongest third-parent recent gain replaces one winning trade with another; it does not remove a loser.

## What was tested

Exact-touch short parents only: TP/SL **2/3.5, 3/3.5, 2/3**, selected by the prior run's full net. No new TP/SL search. Same **$10,000 notional**, one position, **12h maximum hold**, **0.055% fee each actual side**, before funding. DD uses **$32,000 initial equity** with adverse minute marks.

Same history: **December 5, 2024 12:55 to September 15, 2026 20:20 UTC**, exclusive end. Older/recent split June 1, 2026, plus an extra 60-second execution-delay sensitivity. Subperiods restart flat; the full path carries inventory, so the subperiods need not sum to the full result.

Each parent receives 64 filters:

| Variable | Values |
|---|---|
| Completed POC | Previous day, previous week, previous month, any of the three |
| Historical NPOC | Untested daily, weekly, monthly, any of the three |
| Proximity | 0.25%, 0.5%, 1%, 2% |
| Location | Either side of price; below/containing price only |

POC is a native executed-volume **$0.10 price row**, not an exact guaranteed support price. Distance uses the shortest gap from the observed close to that row, divided by price. A containing row has zero gap. The union is any qualifying level, not multiple-level confluence.

All existing maps are reused. NPOCs are projected as they were known then, with no arbitrary expiry and no final-history naked-status leakage. A missing previous POC or uncertain historical NPOC does not invent a level: it supplies no positive veto evidence. Coverage is saved, not treated as proof that trading is safe.

The filter uses the already-observed signal-minute close, never the later fill. The map snapshot is lagged one further minute; new profiles become usable no earlier than period end +120 seconds in HT02. No HT01 entry, bracket, timeout, sizing or cooldown changes. [Full timing/method](../docs/research/high-touch-poc-ht02.md), [frozen card](../research-inputs/high-touch-poc-ht02-2026-09-17.json).

## One common filter across all three parents

Filter: **previous-week POC within 2% below or containing price**.

| TP / SL | Configuration | W / L | Win rate | Winning $ | Losing $ | Net | DD |
|---|---|---:|---:|---:|---:|---:|---:|
| 2 / 3.5 | Unchanged baseline | 359 / 192 | 65.15% | $64,913 | -$57,324 | **$7,589** | 10.81% |
| 2 / 3.5 | Weekly POC filter | 359 / 185 | **65.99%** | $65,178 | -$55,806 | **$9,372** | **9.97%** |
| 3 / 3.5 | Unchanged baseline | 277 / 218 | 55.96% | $70,923 | -$63,375 | **$7,548** | 14.44% |
| 3 / 3.5 | Weekly POC filter | 274 / 214 | **56.15%** | $70,378 | -$61,938 | **$8,440** | **13.47%** |
| 2 / 3 | Unchanged baseline | 375 / 225 | 62.50% | $68,166 | -$61,402 | **$6,764** | 10.54% |
| 2 / 3 | Weekly POC filter | 370 / 218 | **62.93%** | $67,441 | -$59,186 | **$8,255** | **9.90%** |

This is a modest improvement in entry selection, not proof of a tail-loss detector. Average losing trade at 2/3.5 actually changes **-$299 -> -$302**: it has fewer losses, not smaller average losses. The same filter improves win rate across all six paths for the first two parents; the third loses 0.22 percentage points in the older delayed path despite a small net improvement there.

## Best net is not always best win rate

| Parent | Unchanged net / WR / DD | Highest-net filter | Filtered net / WR / DD | Recent baseline -> filtered net |
|---|---|---|---|---|
| 2 / 3.5 | $7,589 / 65.15% / 10.81% | Previous-week POC below, 2% | **$9,372 / 65.99% / 9.97%** | $437 -> $910 |
| 3 / 3.5 | $7,548 / 55.96% / 14.44% | Any preceding POC, either side, 2% | **$8,915 / 55.58% / 11.43%** | $412 -> $1,668 |
| 2 / 3 | $6,764 / 62.50% / 10.54% | Any preceding POC below, 2% | **$8,548 / 62.84% / 10.22%** | $404 -> $1,346 |

The middle row earns more with a slightly **lower** win rate. Its full W/L is 244/195 instead of 277/218. It is not the best consistent filter: different occupancy costs it net in at least one window/delay comparison.

Highest full win rate among all tested extensions is **66.10%**, at 2/3.5 with the previous-week POC within 2% **on either side**. That is +0.94 percentage points versus its baseline, but net is **$8,868**, below the downside-only filter's $9,372. Its W/L is 349/179. Highest win rates for the other parents are 56.33% and 63.07%, only +0.37 and +0.57 points.

## Does the distance sweep support an optimum?

Same 2/3.5 parent, previous-week POC below/containing price:

| Distance | W / L | Win rate | Net | DD | Blocked baseline fills |
|---|---:|---:|---:|---:|---:|
| No filter | 359 / 192 | 65.15% | $7,589 | 10.81% | 0 |
| 0.25% | 359 / 192 | 65.15% | $7,635 | 10.81% | 2 |
| 0.5% | 357 / 192 | 65.03% | $7,415 | 11.27% | 6 |
| 1% | 357 / 191 | 65.15% | $7,368 | 11.20% | 11 |
| 2% | 359 / 185 | 65.99% | $9,372 | 9.97% | 19 |

**2% is the boundary of this tested range, not an established sweet spot.** The narrower values are not a smooth confirmation of an edge. Do not infer an optimal distance or that ever-wider exclusions must help.

## Where the leading filter's extra $1,783 comes from

It rejects 389 of 7,475 raw signals, but only **19 previously executed parent entries**. Replaying the changed account occupancy then displaces five more baseline trades and admits 17 new trades.

| Cohort | W / L | Winning $ | Losing $ | Net before removal sign |
|---|---:|---:|---:|---:|
| Directly vetoed parent trades | 8 / 11 | $991 | -$2,369 | -$1,378 |
| Other displaced parent trades | 3 / 2 | $567 | -$151 | +$417 |
| Total removed | 11 / 13 | $1,559 | -$2,520 | **-$961** |
| New replacement trades | 11 / 6 | $1,824 | -$1,002 | **+$821** |

**+$821 - (-$961) = +$1,783** after rounding. Do not describe it as simply deleting seven losing trades: it removes winners and introduces new losses too. Full-path uplift excluding the two largest avoided losses remains **+$1,060**, but falls to **-$249** in the older delayed sensitivity. Concentration and execution timing still matter.

Recent-primary uplift is only **four removed trades** (1W/3L, net -$313) and **three replacements** (2W/1L, net +$160), yielding **+$473**. That is a small recent intervention sample.

## Timing, costs and monthly damage

Leading 2/3.5 parent versus previous-week POC below 2%:

| Window / delay | Baseline net | Filtered net | Baseline DD -> filtered DD | Filtered net after extra 5bps/side |
|---|---:|---:|---|---:|
| Full, normal | $7,589 | **$9,372** | 10.81% -> 9.97% | $3,940 |
| Full, extra 60s | $4,959 | **$5,842** | 13.86% -> 13.18% | $508 |
| Older, normal | $7,321 | **$8,630** | 10.81% -> 9.97% | $3,967 |
| Older, extra 60s | $5,582 | **$6,056** | 13.86% -> 13.18% | $1,452 |
| Recent, normal | $437 | **$910** | 8.36% -> 7.09% | $141 |
| Recent, extra 60s | -$463 | **-$53** | 8.54% -> 7.31% | **-$782** |

Improvement relative to a weak baseline does not establish positive earnings under every scenario.

Full continuous-path monthly highlights:

| Month | Unfiltered 2/3.5 | Weekly below 2% | Delta |
|---|---:|---:|---:|
| May 2025 | -$1,411 | -$996 | +$415 |
| January 2026 | -$2,338 | -$2,241 | +$96 |
| March 2026 | +$2,344 | +$1,796 | **-$547** |
| May 2026 | -$1,800 | -$1,493 | +$306 |
| June 2026 | +$175 | +$175 | $0 |
| July 2026 | +$499 | +$608 | +$109 |
| August 2026 | -$397 | -$81 | +$316 |
| September 2026, partial | -$8 | +$40 | +$48 |

Monthly net is marked equity change, not the sum of close-month winning/losing dollars. All months and the top-five variant deltas are in the saved review, not just these favorable/unfavorable examples.

## NPOC comparison

| Parent | Baseline net / WR | Best NPOC filter | Filtered net / WR | Blocked baseline fills | Recent net delta |
|---|---|---|---|---:|---:|
| 2 / 3.5 | $7,589 / 65.15% | Weekly NPOC either side, 1% | $7,972 / 65.22% | 7 | **$0** |
| 3 / 3.5 | $7,548 / 55.96% | Weekly NPOC either side, 2% | $8,889 / 56.19% | 12 | **$0** |
| 2 / 3 | $6,764 / 62.50% | Weekly NPOC either side, 2% | $7,691 / 62.65% | 16 | **+$138** |

The final +$138 replaces one +$51 winner with a +$189 winner. No recent losing trade was removed. In the first two rows, recent raw vetoes occur while already occupied, so actual recent execution is unchanged.

Of the 32 NPOC filters per parent, **21 / 21 / 15** produce exactly unchanged full net/trade counts. This is primarily a reach limitation at these two-day-high signals and distances, not evidence that NPOCs carry no information elsewhere.

Coverage among all 7,475 raw signals: preceding daily/weekly/monthly POC available **7,434 / 7,230 / 6,297** times. At least one confidently naked level exists **7,181 / 6,933 / 4,538** times, often far away. Each timeframe has some uncertain historical profiles at 4,617 snapshots; those profiles are excluded from NPOC veto evidence. Existing tested POCs remain usable as completed volume levels.

## Ranking and verdict

Top five by full net, each compared with its own parent:

| Parent | Filter | Net | Delta | DD |
|---|---|---:|---:|---:|
| 2 / 3.5 | Weekly POC below 2% | $9,372 | +$1,783 | 9.97% |
| 3 / 3.5 | Any POC either side 2% | $8,915 | +$1,367 | 11.43% |
| 3 / 3.5 | Weekly NPOC either side 2% | $8,889 | +$1,340 | 12.74% |
| 2 / 3.5 | Weekly POC either side 2% | $8,868 | +$1,279 | 9.97% |
| 2 / 3.5 | Any POC either side 2% | $8,840 | +$1,251 | 9.83% |

**0/192 absolute qualifiers; 0/192 relative qualifiers.** Seven variants improve win rate across all six paths; fifteen improve net across all six. These are correlated variants, and do not imply seven or fifteen independent discoveries. Sixty-nine of the 192 have unchanged full net/trade count. Rankings were not used to expand the frozen grid.

Keep the previous-week downside POC veto as a **modest research lead**, not a live short candidate or a major win-rate improvement. Its possible mechanism is avoiding a short when there is little room before a high-volume price area, but the intervention counts do not establish that this interpretation causes the result.

Potential separate avenues, not run here: (1) distinguish a failed breakout from a continuing breakout at the high; (2) compare a POC-aware profit target with vetoing the entry entirely. Both change a different part of the strategy and need their own controls. No new indicator/HL stack or wider-distance sweep was added after reading outcomes.

## Causal trace and verification

At **July 20, 2026 15:45 UTC**, the parent would short $61.573. HT02 already knows the observation close **$61.548** and uses the map snapshot at **15:44**. The preceding week ended July 20 00:00; its published POC row **[$60.70, $60.80)** is **1.2153% below** that observed close. The 2% below filter vetoes; a 1% filter does not. The POC is already tested at that time, so this is **POC, not NPOC** evidence.

The unfiltered trade later times out for -$178.86; that outcome is not used in the decision. The filtered path later enters at 15:54 and still loses -$69.83. This illustrates why a correctly blocked loser is not an automatic full loss saving.

Verification passed:

- **36 exact unchanged HT01 controls**, including full receipt/curve/monthly/ownership parity.
- Independent raw-catalog as-of projection: **119,600 nearest-level checks**, **478,400 proximity predicates**; all original signals and veto lists reconciled.
- **2,340 paths**, **808,479 receipts**, **211,759,514 position-minutes**, with independent short first-hit/gap/fees/DD/ownership and attribution reconstruction. Independent verification JSON records unique journals and monthly-row counts.
- Prefix/future-lifecycle poison, profile-publication, retest/uncertainty and prior-period availability tests passed; sources typechecked; full project TypeScript check passed. All 195 ranking rows were also independently re-screened.

This is corrected archive history with modeled availability, not recorded live feed receipts. No funding, spread, queue, liquidation, leverage or shared-account certification. No maps were rebuilt and no live files or older accepted outputs were changed.

## Artifacts

- [Plan and pins](../backtests/high-touch-poc/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/plan.json)
- [Independent verification](../backtests/high-touch-poc/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/independent-verification.json)
- [Saved context for every raw signal](../backtests/high-touch-poc/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/contexts.json)
- [All results](../backtests/high-touch-poc/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/results.csv), [all monthly paths](../backtests/high-touch-poc/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/monthly.csv)
- [Baseline-adjacent review and top-five monthlies](../backtests/high-touch-poc-reports/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/review.md)
- [Complete 192-filter table](../backtests/high-touch-poc-reports/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/filters.md); selected trade CSVs alongside it, all journals in accepted job.

Trial inventory: **192 new standalone definitions; 9,247 cumulative standalone / 205 ladder overlays**. Existing short pause and live ladder unchanged.
