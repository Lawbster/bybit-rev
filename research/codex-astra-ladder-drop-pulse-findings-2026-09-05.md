# Genuine deep price-drop pulse confirmation: findings

September 5 follow-up: [the sizing audit](codex-astra-ladder-sizing-findings-2026-09-05.md)
found that this replay reanchored the post-partial add timer, unlike the live
transactional path. Results below remain preserved for that recorded model;
their exact current-stack rankings are not recertified. The follow-up reproduces
the old baseline digests explicitly, then uses corrected baselines for sizing.

September 5, 2026. Local long-only research. No live config, exchange state,
orders, short enablement, PM2, deployment, commit or push changed.

## TL;DR

- **12 frozen variants, 48 full-path variant cases and four exact baseline
  digests.** The existing repaired engine was unchanged. These rules target
  genuine price-drop adds at rung 11 or rungs 9-11, including when the timer
  is also due; they do not veto timer-only adds.
- **Broad positive-flow confirmation makes the ladder worse on this history.**
  Requiring taker15m >=1 at depth >=9 loses **$13,158.75 / $12,292.03** in the HL
  window and worsens DD by **17.89 / 11.72pp**, with **93 / 92** vetoed episodes.
  This is not a failure to obtain enough interventions.
- **0/12 pass either complete predeclared screen.** The rung-11-only selling
  veto is positive in all four cases, but worsens both HL drawdowns and does not
  consistently cut gross losses. Keep that qualified positive result in the
  record; do not promote it as the requested bleeding fix.

## What was tested

This follows the [timer/add exposure-control pass](codex-astra-ladder-exposure-controls-findings-2026-09-05.md).
Its pulse-conditioned rules did not cover genuine drop adds. This pass does,
without rewriting S/R geometry or the original timer/drop trigger.

The [frozen specification](../research-inputs/sr-pulse-encounters/ladder-drop-pulse-2026-09-05.json)
and [method](../docs/research/ladder-drop-pulse.md) were written before simulation.
Six families at next depth 11 and >=9:

- Veto taker15m <=0.85.
- Veto taker15m <=0.85 OR taker1h <=0.9.
- Require taker15m >=1.0.
- Require taker15m >=1.2 AND taker1h >=1.0.
- Near known resistance only: veto taker15m <=0.85.
- Near known resistance only: require taker15m >=1.2 AND taker1h >=1.0 AND
  closed-minute ret15m >0.

Near resistance remains 0-0.3% below the actual replay zone. There is no added
EMA condition. Required windows need 14/55 observed minute samples, source age
0-90 seconds. Unknown required inputs leave the experimental overlay inactive
and are counted; this is not a production missing-data policy.

No additional families or thresholds were selected after observing results.
Order-book/OI/liquidation combinations, alternative zone construction, persistent
gates, timer-plus-drop combinations, smaller rung sizing and exit changes are
**not** tested here. This is specifically an HL taker-flow confirmation test,
not a rejection of every use of pulse data.

## Baselines and limitations

Primary HL window: May 17, 2026 20:43 to September 4 19:01 UTC.
Published control: July 1, 2025 to August 19, 2026 21:32 UTC.

| Case | Baseline total net PnL $ | Baseline DD |
|---|---:|---:|
| HL close-confirmed | 17413.84 | 31.10% |
| HL resting-touch | 21983.77 | 23.36% |
| Published close-confirmed | 17071.51 | 47.74% |
| Published resting-touch | 43005.85 | 33.00% |

All start flat with $32,000 model equity and unchanged $800x1.35 sizing/exits.
Final open inventory is marked and included; both HL baselines end with 11
positions. Fees are 0.055% each side. Gross winning/losing episode aggregates
below already include modeled fees and the episode's earlier partials; “gross”
means summing wins and losses separately, not pre-fee trading PnL.

The published window is a full-path/policy regression control, **not a year of
additional pulse validation**. Before the HL stream exists, flow overlays are
inactive. The zero pre-May monthly deltas must not be sold as successful
out-of-sample protection. All published maximum-DD values remain unchanged;
that unchanged full-window maximum must not be mistaken for unchanged risk
during the later HL window.

These are overlapping, previously examined development windows. Closed-bar/as-of
causality is checked, but exact maker/native fills, actual funding, lot rounding,
ten-second live timing, outages and liquidation are not modeled. Missing
historical taker receipt times use an explicit one-minute publication lag; real
collector arrival parity is not certified. No optimum or live dollar forecast
is established.

## Complete ranking

Ranked by the lower HL-model net-PnL delta. All PnL columns are dollars versus
the unchanged baseline, not returns on the account. Positive DD/loss reduction
means improvement; negative means deterioration. HL episode counts are shown
close/touch and must not be pooled as independent observations.

| Variant | HL close $ | HL touch $ | Published close $ | Published touch $ | Min HL DD reduction pp | Min HL gross-loss reduction % | HL veto episodes |
|---|---:|---:|---:|---:|---:|---:|---:|
| drop_sell15_d11 | +366.45 | +3074.02 | +406.02 | +2867.87 | -1.106 | -0.750 | 47 / 53 |
| drop_sr_sell15_d11 | -354.13 | -514.84 | -354.13 | -576.72 | -0.734 | -0.028 | 6 / 11 |
| drop_sr_confirm_d11 | -1266.16 | -589.36 | -1283.24 | -712.99 | -1.785 | +0.015 | 13 / 19 |
| drop_sr_sell15_d9 | +395.20 | -2110.70 | -56.61 | -1992.59 | -1.762 | -0.772 | 28 / 37 |
| drop_sell_either_d11 | -2361.51 | -65.11 | -2226.47 | +77.74 | -4.646 | -0.108 | 60 / 62 |
| drop_sr_confirm_d9 | +880.46 | -2927.65 | +411.57 | -2825.10 | -2.854 | +0.612 | 36 / 45 |
| drop_confirm15_d11 | -3769.20 | +731.14 | -3817.87 | +714.17 | -5.972 | -7.305 | 58 / 63 |
| drop_confirm_both_d11 | -6778.32 | +1864.34 | -6669.81 | +569.35 | -9.872 | -7.752 | 69 / 73 |
| drop_sell15_d9 | -9529.30 | -8659.81 | -7650.77 | -8773.35 | -10.634 | -9.913 | 87 / 96 |
| drop_confirm_both_d9 | -8710.98 | -12912.51 | -6214.87 | -10398.37 | -11.596 | +0.548 | 99 / 97 |
| drop_confirm15_d9 | -13158.75 | -12292.03 | -11314.60 | -9221.71 | -17.891 | -11.717 | 93 / 92 |
| drop_sell_either_d9 | -5328.55 | -15796.41 | -3119.86 | -13356.29 | -17.930 | -11.241 | 101 / 94 |

The machine ranking orders by minimum HL drawdown improvement first, as in the
previous study; the table above instead orders minimum HL PnL improvement.
Both use the same results and acceptance decisions.

## What the results mean

### Broad confirmation blocks too much useful averaging

| HL metric: require15m >=1 at depth >=9 | Close-confirmed | Resting-touch |
|---|---:|---:|
| Vetoed episodes | 93 | 92 |
| Total-PnL delta $ | -13158.75 | -12292.03 |
| DD reduction pp | -17.89 | -11.72 |
| Gross winning-episode delta $ | -8286.89 | -8305.12 |
| Gross losing-episode cost delta $ | +4756.94 | +2900.71 |
| TP-cycle delta | -29.00 | -28.00 |
| Forced-close delta | 0.00 | 0.00 |
| Baseline DD -> variant DD | 31.10% -> 48.99% | 23.36% -> 35.08% |

The rule intervenes frequently with known flow: 93 / 92 episodes, **zero unknown
required-input opportunities** in these two cases. Its failure cannot be
explained away as the sparse coverage seen in some earlier timer/S/R conjunctions.

It captures 29 / 28 fewer TP cycles, loses roughly $8.3k of gross winning-episode
PnL, and adds $4.8k / $2.9k to gross losing-episode costs. Remaining differences
reconcile through unfinished-episode partials and marked-open inventory.

The stricter two-window rule at depth >=9 also fails: -$8,711 / -$12,913,
with 32 / 20 fewer TP cycles. It reduces gross losses modestly, but sacrifices
much more winning-episode PnL. More confirmation is not monotonically safer.

**No variant case reduces its baseline forced-close count.** The strict
two-window depth >=9 rule adds one in both resting-touch windows; others leave
the count unchanged. The gates mainly change averaging, price basis, TP paths
and subsequent episodes rather than eliminate the historical forced closures.

Inference from these full paths: selling pressure is not sufficient to
distinguish a failed dip from a dip that the ladder profitably averages through.
Rejecting exposure during that pressure can leave the ladder with less useful
averaging and miss profitable cycles. This is an explanation consistent with
the results, not proof that a different causal predictor cannot distinguish them.

### The positive exception is real, but not consistent loss protection

Rung 11 only, veto taker15m <=0.85:

- HL net lift: **+$366.45 / +$3,074.02**, n=47 / 53 vetoed episodes.
- Published net lift: **+$406.02 / +$2,867.87**.
- Worst monthly MTM delta across all cases: **-$191.28**.
- HL DD: **31.10% -> 31.30%**, and **23.36% -> 24.47%**.
- HL gross loss cost: **+$304.43 worse** in close-confirmed,
  **-$2,526.88 better** in resting-touch.
- Two fewer HL TP cycles in each model; no reduction in forced closes.

The sign of profit improvement is consistent, and the monthly cost is modest.
It is **not falsified as a possible small profit/timing effect**. But almost all
of its resting-touch lift comes from June (+$2,905), while close-confirmed gets
its lift from May (+$510) and gives some back in later months. That weakens the
claim of a model-independent protective mechanism.

It fails both the declared drawdown/loss-reduction screens. The objective here
was reducing large losses, not accepting a drawdown increase for an unconfirmed
execution-sensitive gain. No live promotion follows from this result.

### S/R restriction does not rescue the confirmation rule

The near-resistance strong confirmation at depth >=9 yields **+$880 / -$2,928**
in HL and **+$412 / -$2,825** in the published controls. Its DD improves only in
HL close-confirmed. Neither the selling-only nor strong-confirmation S/R
families establish a robust bleeding reduction across both models.

There is also a scope issue: most near-resistance holds end because price leaves
the narrow zone, not because buying pressure confirms. That is measured below,
not silently treated as a permanent pulse gate.

## Release-path diagnostics

Counts below are **first veto per episode/depth**, not all repeated veto minutes
or unique ladder episodes. Median waits include only cases whose next execution
is an add at that same episode/depth. Inventory changes first means a close or
partial intervened; those cases are retained, not discarded as unhelpful.

| Variant / HL model | First vetoes | Pulse permits | Timer permits | S/R scope ends | Missing-data permits | Inventory changes first | Median wait, min |
|---|---:|---:|---:|---:|---:|---:|---:|
| drop_confirm15_d9 / HL close | 142 | 92 | 39 | 0 | 0 | 11 | 21 |
| drop_confirm15_d9 / HL touch | 144 | 91 | 43 | 0 | 0 | 10 | 20 |
| drop_confirm_both_d9 / HL close | 155 | 61 | 69 | 0 | 1 | 24 | 39 |
| drop_confirm_both_d9 / HL touch | 159 | 61 | 77 | 0 | 1 | 20 | 38 |
| drop_sr_confirm_d9 / HL close | 42 | 0 | 4 | 34 | 0 | 4 | 2 |
| drop_sr_confirm_d9 / HL touch | 59 | 1 | 10 | 44 | 0 | 4 | 3 |

For strict two-window confirmation at depth >=9, timer-only adds account for
69/131 and 77/139 of recorded add releases. The original timer is deliberately
untouched. This experiment therefore tests a conditional delay, **not a durable
ban on exposure until flow becomes positive**.

For strong S/R confirmation, the close-confirmed ledger has 34 releases from
leaving the zone, four via timer, and zero via pulse confirmation. Resting-touch
has 44 zone exits, ten timer releases and one pulse release. Median recorded
wait is only 2 / 3 minutes. Neither record proves a persistent gate would work;
that is a different, untested intervention.

The two-window depth >=9 rule has two unknown-input opportunities per HL model,
including one recorded first-veto release through the declared unknown-data
fallback. Other broad HL rules have zero unknown opportunities. Missingness is
explicit in every summary and does not explain the widespread losses.

## Top-five monthly stability

Monthly **mark-to-market** PnL deltas, rounded to dollars. Rows include every
month for each of the five top-ranked variants. May/September in HL and August
in published windows are partial months. Exact realized and MTM deltas for
all twelve variants are in the generated monthly CSV.

### HL close

| UTC month | drop_sell15_d11 | drop_sr_sell15_d11 | drop_sr_confirm_d11 | drop_sr_sell15_d9 | drop_sell_either_d11 |
|---|---:|---:|---:|---:|---:|
| 2026-05 | +510 | -249 | -295 | -183 | +147 |
| 2026-06 | -29 | -71 | -814 | +87 | -2500 |
| 2026-07 | -60 | -34 | -174 | +40 | -186 |
| 2026-08 | -55 | 0 | +17 | +452 | +177 |
| 2026-09 | 0 | 0 | 0 | 0 | 0 |

### HL touch

| UTC month | drop_sell15_d11 | drop_sr_sell15_d11 | drop_sr_confirm_d11 | drop_sr_sell15_d9 | drop_sell_either_d11 |
|---|---:|---:|---:|---:|---:|
| 2026-05 | +97 | -249 | -249 | -131 | -1218 |
| 2026-06 | +2905 | -327 | -327 | -1933 | +1283 |
| 2026-07 | -62 | 0 | -136 | +71 | -50 |
| 2026-08 | +325 | 0 | +16 | -18 | +15 |
| 2026-09 | -191 | +62 | +108 | -100 | -95 |

### Published close

| UTC month | drop_sell15_d11 | drop_sr_sell15_d11 | drop_sr_confirm_d11 | drop_sr_sell15_d9 | drop_sell_either_d11 |
|---|---:|---:|---:|---:|---:|
| 2025-07 | 0 | 0 | 0 | 0 | 0 |
| 2025-08 | 0 | 0 | 0 | 0 | 0 |
| 2025-09 | 0 | 0 | 0 | 0 | 0 |
| 2025-10 | 0 | 0 | 0 | 0 | 0 |
| 2025-11 | 0 | 0 | 0 | 0 | 0 |
| 2025-12 | 0 | 0 | 0 | 0 | 0 |
| 2026-01 | 0 | 0 | 0 | 0 | 0 |
| 2026-02 | 0 | 0 | 0 | 0 | 0 |
| 2026-03 | 0 | 0 | 0 | 0 | 0 |
| 2026-04 | 0 | 0 | 0 | 0 | 0 |
| 2026-05 | +510 | -249 | -295 | -183 | +323 |
| 2026-06 | -29 | -71 | -814 | +87 | -2500 |
| 2026-07 | -60 | -34 | -174 | +40 | -186 |
| 2026-08 | -16 | 0 | 0 | 0 | +136 |

### Published touch

| UTC month | drop_sell15_d11 | drop_sr_sell15_d11 | drop_sr_confirm_d11 | drop_sr_sell15_d9 | drop_sell_either_d11 |
|---|---:|---:|---:|---:|---:|
| 2025-07 | 0 | 0 | 0 | 0 | 0 |
| 2025-08 | 0 | 0 | 0 | 0 | 0 |
| 2025-09 | 0 | 0 | 0 | 0 | 0 |
| 2025-10 | 0 | 0 | 0 | 0 | 0 |
| 2025-11 | 0 | 0 | 0 | 0 | 0 |
| 2025-12 | 0 | 0 | 0 | 0 | 0 |
| 2026-01 | 0 | 0 | 0 | 0 | 0 |
| 2026-02 | 0 | 0 | 0 | 0 | 0 |
| 2026-03 | 0 | 0 | 0 | 0 | 0 |
| 2026-04 | 0 | 0 | 0 | 0 | 0 |
| 2026-05 | +97 | -249 | -249 | -131 | -1218 |
| 2026-06 | +2905 | -327 | -327 | -1933 | +1283 |
| 2026-07 | -62 | 0 | -136 | +71 | -50 |
| 2026-08 | -72 | 0 | 0 | 0 | +63 |

## Causal trace and balanced episode examples

First close-confirmed depth >=9 neutral-confirmation veto:

1. **May 17 23:19 UTC**, rung 10 price-drop add at **$45.568**.
   Known taker15m is **0.3606617230**; the predicate vetoes it.
2. Independently re-reading the raw HL stream reproduces 14 eligible minute rows:
   buy notional **$4,776,328.69637**, sell **$13,243,237.05880**.
   Latest source is **23:18 UTC**, first eligible decision **23:19 UTC**.
   All 14 rows lack explicit receipt timestamps, so the stated one-minute
   publication model applies. This is causal under that model, not invented
   evidence of exact historical network receipt.
3. **23:36 UTC**, known ratio reaches **1.0147942057** while a genuine drop
   still qualifies. The add executes at the next modeled open, **$45.456**:
   decision index 760960, fill index 760961, a 17-minute delay.
4. The analogous first resting-touch veto is **23:42 UTC**, rung 9 at $44.780.
   It releases through the timer at **May 18 00:11**, filling **$45.430**.
   A favorable delay and an adverse rebound re-entry are both retained.
   The illustrative price comparison is not a portfolio-PnL attribution.

Invisible upside and visible costs both matter. Exact-entry episode comparisons
for this same rule show:

- Close-confirmed, ladder entered June 3 22:00 UTC: baseline emergency loss
  **-$8,510.80** on June 4 22:33; variant **-$11,073.29** on June 5 03:12.
- Resting-touch, ladder entered June 3 22:22 UTC: baseline emergency loss
  **-$8,475.40** becomes a **+$232.89** stale TP on June 4 04:05 under the variant,
  a **+$8,708.28** matched-episode improvement.

These are different modeled paths, not contradictory observations of one live
trade. Even retaining that avoided-kill benefit, aggregate resting-touch delta
is **-$12,292**. One saved disaster is not enough to validate the whole rule.
Matched-entry examples are descriptive and do not sum to the total counterfactual:
later cycles can have different entry times.

## Acceptance and disposition

Unchanged screens from the prior pass:

- Profit upgrade: both HL models >=$1,000 net lift and >=10% gross-loss reduction;
  DD cannot worsen in any case; published net delta >=0; every monthly MTM
  delta >=-$250.
- Defensive trade-off: both HL models >=20% gross-loss reduction and >=3pp DD
  reduction; retain >=90% of baseline total profit in every case; published
  DD deterioration <=0.5pp; every monthly MTM delta >=-$500.
- Both require >=20 vetoed episodes per HL model. Screens are research triage,
  not mathematical truths or a license to retune thresholds after results.

**No variant qualifies.** Broad depth >=9 taker gates are rejected as tested
bleeding-reduction upgrades. S/R restrictions do not consistently rescue them.
The mild rung-11 veto is recorded as a qualified positive profit result, not
relabelled as a robust risk improvement.

No config change or forward promotion from this pass. No conclusion that the
current config is globally optimal, that a persistent gate would fail, or that
all HL/S/R data is useless. The prior cap10 protection/cost result remains a
separate size-control finding; it was not rerun or altered here.

## Verification and artifacts

- Runner: `scripts/hype-ladder-drop-pulse-study.ts`.
- Policy and tests: `scripts/ladder-drop-pulse-policy.ts`,
  `scripts/ladder-drop-pulse-tests.ts`.
- Read-only artifact verifier: `scripts/ladder-drop-pulse-results-check.ts`.
- Reused, unchanged engine and metrics:
  `scripts/replay-causal-engine.ts`, `scripts/ladder-exposure-metrics.ts`.
- Output: `backtests/hype/hype-ladder-drop-pulse-2026-09-05/`.

All four archived result digests and previous baseline metrics matched. Prior
exposure-study source hashes, current runner/spec and raw input hashes remained
unchanged across the run. No mutable positions or future arrays are exposed
to the predicate.

Main/VPS typechecks, new pulse tests, exposure tests, current-stack, deep-add and
causality regressions passed. Tests include true-drop/depth boundaries, two-window
missingness, source freshness, immutable decisions, future-prefix invariance,
next-open release, timer escape and continuing protection.

The separate post-run verifier passed **48 cases, 3,398 first-veto records,
267,248 execution records and 3,015 add-release records**, plus monthly and
episode accounting and ranking recomputation. Those record counts span
overlapping variants/windows; they are not independent market samples.

Accepted SHA-256 fingerprints:

```text
manifest.json cd84f51c4aa2044c66c383feefd5df03eadde9a57ceb8a228d5f3195abb77636
results.json c7ad7c1adfb24efa5a7af5a45d306f47de64e6ce30b528c428edf528b4c10bb9
summary.csv 5ab98a07a1a1321ab9920d7ae0bbbb28fa3111ef0ee0db4588c19c8e695745b0
monthly.csv b70956d33ef1153b596ecbcfba8a4ff3f17f1fca670bf604399a19e3d077fe00
ranking.json a89addbf7dacba918e38c5fd655b0135d857f6d3e547a1fcaf8c6737096aba1e
validation.json 94ab6894a262ee55393b21649e1769a469c82792e26d86eb59f5fe71e6480ad4
```

Generated artifacts/raw histories remain local and ignored. The new
source/spec/findings additions preserve a reproducible research path without
changing the deployed strategy.
