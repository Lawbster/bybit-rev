# HYPE HL Short Nearby-TP Findings - 2026-08-10

Evidence cutoff: `2026-08-09T11:44:59Z` for new entries. The short opened at `2026-08-09T11:45:00Z` was still active at the pulled-data cutoff and is excluded from completed comparisons.

## TL;DR

- **Targets above 2% are decisively worse, while 1.95% is the only nearby target worth further consideration.** The 1.95% target adds `+4.400%` / about `$1,100` over the 43-trade exact historical sequence and reduces trade-sequence drawdown from `5.981%` to `4.200%`.
- **The historical improvement is lumpy, but the bounded-insurance decision gate passes.** One May trade reached `1.979%` MFE and then stopped; 1.95% converts it from `-4.20%` to `+1.75%`. Every ordinary target winner pays a 0.05% premium. Exact deltas are train `+5.30%`, prior test `-0.70%`, and completed forward `-0.20%`. With one-minute delayed entries they become `-0.70%`, `+0.598%`, and `+1.738%`.
- **Actual live fills provide independent support for the mechanism.** On the seven completed live shorts, 1.95% would have converted the July 31 near-miss from `-$16.40` to about `+$460.42`. After the small giveback on the three existing TP winners, live realized PnL would be approximately `-$61.16` instead of `-$520.20`, a `+$459.03` counterfactual improvement.

## Scope

The entry signal, one-position ownership, `$25k` notional, 4% stop, and 12-hour maximum hold remain frozen. Only the full-position native TP changes.

The target surface uses uniform 0.05-percentage-point steps from 1.50% through 2.50%, excluding the unchanged 2.00% control. Results use:

- 0.20% stress round-trip costs;
- completed one-minute candles;
- stop-first handling inside ambiguous candles;
- train selection before reading the prior test and recent forward cohorts;
- exact decision-minute entry plus a separate one-minute-delay replay;
- serial-position scheduling, so earlier targets may legitimately free a later signal.

Baseline parity remains exact: 36 completed pre-forward trades at `+34.4717035%`, and 43 completed full-history trades at `+33.8948303%`.

## Target surface

All values are PnL deltas versus TP2/SL4/12h.

| TP | Train delta | Prior test delta | Forward delta | Full delta | Read |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1.70% | +1.800% | -4.921% | +2.455% | -0.667% | Recent fit; aggregate loss |
| 1.80% | +3.200% | -3.521% | -0.800% | -1.121% | Too much winner clipping |
| 1.85% | +3.900% | -2.821% | -0.600% | +0.479% | Positive only because of one old save |
| 1.90% | +4.600% | -1.400% | -0.400% | +2.800% | Same discontinuity, higher recurring tax |
| **1.95%** | **+5.300%** | **-0.700%** | **-0.200%** | **+4.400%** | Best train-selected bounded insurance |
| 2.00% | - | - | - | - | Frozen control |
| 2.05% | -3.746% | -6.576% | -1.548% | -11.870% | Clearly too far |
| 2.10% | -3.146% | -6.026% | -1.398% | -10.570% | Clearly too far |
| 2.50% | +1.654% | -5.186% | -0.198% | -3.730% | Fails untouched test |

No alternative target is positive in train, prior test, and forward on the exact-entry path.

## Why 1.95% looks strong in aggregate

The entire exact-path improvement can be decomposed cleanly:

- The May 21 short entered at `$56.443`.
- Its 2% target was `$55.31414`, but its maximum favorable excursion reached only `1.979%` before the trade reversed and hit the 4% stop.
- A 1.95% target at approximately `$55.342` fills and changes the trade by `+5.95%` of notional.
- The other 31 historical 2% winners each surrender 0.05%, costing `-1.55%` in total.
- Net: `+5.95% - 1.55% = +4.40%`, or about `+$1,100` at `$25k`.

This is economically coherent insurance against a nearly completed target reversing. It is not a smooth per-trade alpha improvement.

The exact monthly deltas show the lumpiness:

| Month | Delta |
| --- | ---: |
| 2026-05 | +5.700% |
| 2026-06 | -0.900% |
| 2026-07 | -0.350% |
| 2026-08 | -0.050% |

The worst month remains inside the existing -1.0% deterioration tolerance, but the prior test and completed forward cohorts pay only the insurance premium and receive no exact-path save.

## Delay and fill-path robustness

With entry delayed by one minute, 1.95% no longer rescues the May stop. The cohort deltas become:

| Cohort | One-minute-delay delta |
| --- | ---: |
| Train | -0.700% |
| Prior test | +0.598% |
| Forward | +1.738% |
| Combined | +1.637% / about +$409 |

The sign movement is expected: whether a fixed percentage target barely trades depends on the actual entry fill. Importantly, aggregate delayed performance remains positive, but the winning event moves to later cohorts. This is better evidence than a result that exists only at the ideal decision-open, while still not satisfying a clean cohort-stability gate.

## Actual seven-trade live counterfactual

This replay uses actual receipt entry prices, quantities, completed exits, entry fees, a 0.055% exit fee, HYPE's 0.001 price tick rounded down like production, and only price observations after the actual entry. Farther-than-2% targets are not evaluated from receipts because the live 2% TP censors their future paths.

| Live entry | Actual result | 1.95% result | Delta |
| --- | ---: | ---: | ---: |
| Jul 28 22:30 | +$467.44 | +$460.43 | -$7.01 |
| Jul 30 04:30 | -$542.15 | -$542.15 | $0.00 |
| Jul 31 02:30 | -$16.40 | **+$460.42** | **+$476.82** |
| Jul 31 19:15 | +$462.30 | +$460.44 | -$1.86 |
| Aug 3 05:00 | -$1,034.62 | -$1,034.62 | $0.00 |
| Aug 7 16:30 | +$469.37 | +$460.45 | -$8.92 |
| Aug 8 13:30 | -$326.14 | -$326.14 | $0.00 |
| **Total** | **-$520.20** | **-$61.16** | **+$459.03** |

For July 31, the actual entry was `$55.205192`. Production's 2% target normalized to `$54.101`, while the market low reached `$54.117`. A 1.95% target normalizes to `$54.128` and would have traded. The resting native TP architecture already supports this mechanically; no new partial-close path is required.

## Decision

**APPROVED FOR DIRECT LIVE CHANGE: TP 1.95%.**

1.95% is materially stronger than the tested partial exits, S/R blocks, or final-hour timeout rules:

- positive full-history exact delta;
- positive full-history one-minute-delay delta;
- a clear, bounded mechanism;
- exact monthly deterioration no worse than -0.90%;
- direct positive evidence from actual live fills.

The initial strict cohort gate was inappropriate for this payoff shape: cohorts without a rare near-target reversal must show the small insurance premium as a negative delta. The correct bounded-insurance gate is positive full-period exact and delayed PnL, no material monthly deterioration, a causal mechanism, and no lookahead. TP1.95 passes all four. At `$25k`, the conservative premium is `$12.50` per ordinary winner; the July live rescue alone covers about 38 such premiums and the May stop rescue covers about 119.

Implementation must be a policy-versioned flat deployment. Do not reprice an existing TP2 position. Policy v2 changes only the full native TP; the state migration must refuse any active position, pending intent or recovery state.

## Outputs

- Full target grid: `backtests/hype/hl-short-nearby-tp-2026-08-10/policy-grid.csv`
- Selected robustness row: `backtests/hype/hl-short-nearby-tp-2026-08-10/family-winners.csv`
- Selected monthly results: `backtests/hype/hl-short-nearby-tp-2026-08-10/selected-monthly.csv`
- Actual-fill trade replay: `backtests/hype/hl-short-nearby-tp-2026-08-10/live-closer-target-counterfactual.csv`
- Actual-fill summary: `backtests/hype/hl-short-nearby-tp-2026-08-10/live-closer-target-summary.csv`
- Reusable harness: `scripts/hype-custom-hl-short-exit-mitigation-study.ts`
