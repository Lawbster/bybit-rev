# HT03: rejection and failed-breakout shorts at the two-day high

September18,2026. Local research only; no live/config changes.

## TL;DR

- **18 candidates +9 diagnostic controls**, across the three existing HT01
  TP/SL brackets. **0/18 candidates qualify.** All36 unchanged controls matched;
  all360 paths independently verified. High references and candle data reused.
- Best rule: original touch minute closes below its frozen high. TP2%/SL3.5%
  makes **$7,622 versus $7,589**, DD10.61% versus10.81%. The actual net delta is
  only **+$32.29**, not a material full-period improvement; win rate slips
  65.15% to64.86%. Loss reductions mostly offset sacrificed winning dollars.
- Recent performance improves more: **$437 -> $1,350**, DD8.36% ->6.45%, and
  positive after extra delay/costs. However, older net falls **$7,321 -> $6,460**,
  with material monthly regressions. Wick and delayed-rejection rules do not
  improve the overall setup. Keep the simple close-back as a measured research
  lead, not a deployment candidate or proof that all rejection strategies fail.

## Fixed setup and period

Full **2024-12-05 12:55 through 2026-09-15 20:20 UTC**, exclusive end.
Older/recent split **2026-06-01 00:00 UTC**. Each strategy has one independent
position, **$10,000 fixed notional**, $32,000 initial equity for DD, no
compounding. Fees0.055% per actual side, before funding. Same12h cap and
actual-fill-anchored brackets as HT01, stop-first with target-first sensitivity.

These are standalone shorts, **not the live ladder**. No POC, NPOC, HL,
indicator or ladder gates. No new target/stop/cost optimization. Recent and
older reset flat; their sums need not equal the continuous full replay.

[Frozen method](../docs/research/high-touch-rejection-ht03.md) /
[card](../research-inputs/high-touch-rejection-ht03-2026-09-18.json).

## All six mechanisms, same TP2% / SL3.5%

Closed W/L and dollars after fees. All these full paths are flat at cutoff.
DD uses adverse minute marks, not only closed trades. Rounded dollars.

| Entry rule | Wins / losses | Winning $ | Losing $ | Avg loss | Net | DD |
|---|---:|---:|---:|---:|---:|---:|
| Unchanged every-touch baseline | 359 /192 | 64,913 | -57,324 | -299 | **7,589** | **10.81%** |
| Touch minute closes below high | 336 /182 | 60,864 | -53,242 | -293 | **7,622** | **10.61%** |
| Close above, recross below within15m | 299 /173 | 53,417 | -49,633 | -287 | 3,785 | 13.84% |
| Close above, recross below within5m | 279 /163 | 49,945 | -46,894 | -288 | 3,051 | 12.29% |
| First subsequent15m close below high | 300 /182 | 53,743 | -50,782 | -279 | 2,961 | 16.79% |
| First subsequent5m close below high | 312 /186 | 56,335 | -53,492 | -288 | 2,843 | 14.95% |
| Below-high close plus >=50% upper wick | 227 /154 | 40,926 | -44,411 | -288 | -3,486 | 19.83% |

The count of losses falls, but so does winning exposure. On the simple
close-back path, winning dollars decline by about$4,049 while losing dollars
improve by about$4,082. That is almost a wash, not elimination of the short's
tail risk. The full-period win rate does **not** improve.

## Simple close-back across all three unchanged brackets

| TP /SL | Own baseline net /DD | Close-back net /DD | Own recent net | Close-back recent net |
|---|---:|---:|---:|---:|
| 2 /3.5% | 7,589 /10.81% | 7,622 /10.61% | 437 | 1,350 |
| 3 /3.5% | 7,548 /14.44% | 6,024 /14.93% | 412 | 1,452 |
| 2 /3% | 6,764 /10.54% | 5,705 /11.22% | 404 | 1,107 |

This improves recent net across these three brackets, not full-period net
robustly across brackets. No further threshold/candle search was added after
seeing that pattern. All18 candidates,9 controls and top-five monthlies are
in the saved report linked below.

## Best bracket: periods, delay and costs

For TP2%/SL3.5%. Extra delay is60s on top of the existing60s bar-publication
allowance; extra cost stress is5bps per side beyond the original fees.

| Window | Baseline net /DD | Close-back net /DD | Baseline delayed net | Close-back delayed net | Close-back stressed net, normal /delayed |
|---|---:|---:|---:|---:|---:|
| Full | 7,589 /10.81% | 7,622 /10.61% | 4,959 | 8,037 | 2,448 /2,854 |
| Older | 7,321 /10.81% | 6,460 /10.61% | 5,582 | 7,012 | 2,006 /2,538 |
| Recent | 437 /8.36% | 1,350 /6.45% | -463 | 1,222 | 631 /513 |

Recent baseline:47W/31L, winning$8,130, losing$7,694, average loss$248.
Close-back:43W/29L, winning$7,856, losing$6,506, average loss$224.
It improves recent loss severity, not recent win rate (60.26% ->59.72%).

## Monthly regressions remain real

Selected rows from the full continuous best-bracket path. All22 months for
each top-five candidate are saved in the report; `monthly.csv` includes all
360 cases and5,280 month rows.

| Month | Own touch baseline | Close-back | Delta |
|---|---:|---:|---:|
| 2024-12 | 3,075 | 1,957 | -1,118 |
| 2025-02 | 2,098 | 1,638 | -460 |
| 2025-05 | -1,411 | -262 | +1,149 |
| 2025-09 | -381 | -759 | -378 |
| 2025-12 | 1,547 | 1,169 | -378 |
| 2026-01 | -2,338 | -2,233 | +105 |
| 2026-03 | 2,344 | 1,647 | -697 |
| 2026-05 | -1,800 | -2,559 | -759 |
| 2026-06 | 175 | 687 | +512 |
| 2026-07 | 499 | 594 | +95 |
| 2026-08 | -397 | -292 | +105 |
| 2026-09 partial | -8 | 173 | +181 |

The best rule fails both the absolute bad-month limit and the relative
monthly screen, and loses older-window net. **No candidate passes the
complete screen.** Thresholds were not relaxed because the baseline also fails.

## Did waiting or the rejection predicate help?

At TP2%/SL3.5%, pure wait to the same first complete5m candle earns$5,114;
requiring that candle to close below R earns$2,843. For15m: wait-only$4,638
versus close-back$2,961. Both price filters lose to their matched-clock controls
and to the original$7,589 baseline. This is not evidence that extra candle
confirmation improves the entry for this bracket.

The above-close cohort control earns$7,005. Requiring a later recross earns
$3,051/$3,785 at5m/15m. This comparison includes selection **and** variable
waiting; it is not an isolated delay effect. All three brackets' full nets
decline when recross is required versus their above-close controls.

Out of7,475 original touch minutes, emitted signals are3,773 close-back,
1,156 wick,2,148 aligned5m,1,462 aligned15m,1,569 failed-break5m and1,987
failed-break15m. Median added receipt latency is9m/26m for aligned5m/15m
and2m for each recross rule. The aligned bars are wholly after initial signal
availability, so a "5m confirmation" is not necessarily a5-minute wait.
Many anchors confirm together; dedup is explicit. Watches are not positions.

For the best close-back full path:236 common closed receipts,315 removed
(199W/116L, net$717),282 replacements (176W/106L, net$749), no cutoff-open
change. The net difference is+$32.29. Excluding the two biggest avoided losses
makes the difference about-$690. This is a full occupancy result, not just
deleting ten losing trades from the original ledger.

## Causality and verification

- 36 archived HT01 controls matched trades, accepted IDs, stats, monthly marks,
  curve and cutoff inventory before variants.
- All 7,475 frozen high references independently checked against original
  minutes; all74,750 emitted/rejected/deduplicated/censored decisions rebuilt
  without calling the producer.
- All 360 journals independently minute-audited:115,974 receipts,
  33,189,250 position-minutes and5,280 monthly rows. Attribution, ranking
  screens and saved CSV arithmetic checked; source/output hashes checked
  before and after verification.
- Synthetic policy tests and24 independent-reference prefix/poison scenarios
  cover all ten groups, expiry/equality, missing minutes, first recross,
  immutable R, same-minute dedup and changed-time trade identity.

Example: June1,2026, frozen high$74.39. Touch minute12:34-12:35 closes$74.487
above R, available12:36. The next minute12:35-12:36 closes$74.228 below R,
available12:37. Failed-break signal is therefore **12:37**, not12:35 or12:36.
The saved2/3.5 execution enters at12:37 open$74.115 and hits its target13:31
for$189.11 net. It never gets an earlier$74.39/$74.487 retrospective entry.

Target-first matters in a few paths: best close-back full net becomes$8,172
instead of$7,622 from one both-hit minute. Stop-first remains primary; neither
ordering gives live fill-order certainty from minute candles.

## Artifacts and limits

Accepted key: `8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5`.

- [Full comparison, all controls, top-five monthlies and sensitivities](../backtests/high-touch-rejection-reports/8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5/review.md)
- [Independent verification](../backtests/high-touch-rejection/8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5/independent-verification.json)
- [All economic rows](../backtests/high-touch-rejection/8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5/results.csv)
- [All monthlies](../backtests/high-touch-rejection/8a25a4e0f82668864740de4c2ae2f38e8a560b29a3a986892ba61ed44b9ad3b5/monthly.csv)

Groups/complete opportunity decisions are stored once in `groups.json.gz`.
No repeated high-map or POC rebuild, no revised accepted parent source.
27 correlated definitions bring inventory to9,274 standalone/205 overlays;
there is no untouched holdout. Before funding, spread, queue, margin and
liquidation; source delays are modeled, not recorded live receipt guarantees.
No production deployment candidate, no live short reactivation or commit.
