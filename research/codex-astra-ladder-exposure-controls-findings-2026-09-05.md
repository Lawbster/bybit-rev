# Ladder exposure controls: full-path replay findings

September 5 follow-up: [the sizing audit](codex-astra-ladder-sizing-findings-2026-09-05.md)
found that this replay reanchored the post-partial add timer, unlike the live
transactional path. Results below remain preserved for that recorded model;
their exact current-stack rankings are not recertified. The follow-up reproduces
the old baseline digests explicitly, then uses corrected baselines for sizing.

September 5, 2026. Local research only. No live config, trading execution, short
enablement, deployment, commit or push changed.

## TL;DR

- Tested **17 fixed variants across four cases: 68 full-path variant replays plus
  four baselines**. Every archived baseline digest reproduced exactly. Unlike the
  preceding attribution pass, these runs actually change add decisions and replay
  subsequent sizing, TPs, partial exits, forced closes and inventory.
- **Less maximum exposure does reduce the bleeding.** A ten-rung cap cuts HL-window
  gross losing-episode PnL by **27.2% / 24.0%** and maximum drawdown by
  **7.76 / 6.13 percentage points**, costing **$1,241.61 / $1,144.71** net profit.
  But the longer resting-touch control loses **$13,323.08** of profit. That is
  a real defensive trade-off, not a free improvement.
- **0/17 pass either complete predeclared research screen.** The refined S/R/pulse
  timer rules are small, sparse or unstable across models/history. This does not
  prove the current configuration optimal, nor prove that all pulse-based exposure
  control is ineffective. It does rule out promoting these tested combinations as
  a robust cure for the ladder's large losses.

## Scope and interpretation

The user explicitly requested actual counterfactuals focused on reducing ladder
losses, rather than maximizing the win rate or extrapolating from attributable
rung PnL. The prior failure to find cheaper fixed-delay entries was **not** treated
as a reason to refuse this test: avoiding exposure and getting a cheaper later
entry are different questions.

The [frozen definition](../research-inputs/sr-pulse-encounters/ladder-exposure-controls-2026-09-05.json)
contains eight families at next depth 11 or >=9, plus a ten-rung control.
The [method](../docs/research/ladder-exposure-controls.md) gives exact predicates,
missing-data behavior, engine integration, acceptance thresholds and reproduction.

Families: drop-only; S/R timer-only; S/R all-add; weak-context timer-only;
S/R + weak context; S/R + selling; S/R + weak + selling; S/R requiring positive
flow/price confirmation. Existing 0.3% drop trigger, 0.3% resistance proximity,
15m selling <=0.85, confirmation 15m >=1.2 / 1h >=1 / ret15m >0 were fixed.
Weak context is the completed-4h close not above EMA200 OR ret12h <=-2%.

No threshold was retuned after results. These tests do **not** search every
possible configuration. They do not test new partial-exit rules, tighter stops,
rung sizing, persistent exposure latches, broader S/R distances, order-book/OI
combinations, or shorts. In particular, the pulse-conditioned families here
apply to **timer-only** adds; a general pulse veto on genuine price-drop adds
is not evaluated. Do not interpret this result as falsifying that untested idea.

Current configuration and exit behavior are otherwise unchanged. The cap controls
remaining position count, not a fixed-dollar notional ceiling: partial exits can
leave larger old rungs, so remaining count is not identical to total exposure.

## Baseline and model contract

Primary HL window: May 17, 2026 20:43 through September 4 19:01 UTC. Published
control: July 1, 2025 through August 19, 2026 21:32 UTC. Both start flat with
$32,000 modeled equity, $800 base, 1.35 scaling and unchanged exits. Both HL
baselines finish with 11 open positions, which are marked rather than excluded.

The two TP assumptions are `close_confirmed` and `resting_touch`. Neither is
exact live maker/native-TP reconstruction. Market actions use next-minute-open
fills; only a target already armed before a later bar may use that bar's high.
Taker fees are 0.055% per side. Actual funding, maker queues/fees, lot rounding,
ten-second live timing, outages and liquidation remain outside this model.

The older 72-variant daily-high study used the previous historical engine;
its $82,912.67 control is not a recertified current causal baseline. This pass
instead matches the repaired $17,071.51 / $43,005.85 published controls and
$17,413.84 / $21,983.77 HL controls in full, not merely approximately.

The windows overlap and the history has been repeatedly examined. This is
development evidence, not a new untouched holdout or a prediction of account PnL.
Gross losses in the tables below are positive **cost magnitudes**, not income.

## Complete variant ranking

Dollars are total net-PnL deltas, including marked-open inventory. Ranked by the
lower of the two primary HL-model profit deltas, not by a selected favorable model.
DD reduction is in percentage points; negative means worse. Episode counts are
close/touch within the HL window, not independent observations to pool.

| Variant | HL close $ | HL touch $ | Published close $ | Published touch $ | Minimum HL DD reduction | Minimum HL gross-loss reduction | HL veto episodes |
|---|---:|---:|---:|---:|---:|---:|---:|
| sr_confirm_timer_d9 | +581.11 | +649.37 | +472.02 | +509.95 | +0.225 | +0.031% | 7 / 14 |
| drop_only_d11 | +5195.16 | +356.41 | -2221.57 | -4855.74 | -0.430 | +0.359% | 22 / 24 |
| sr_timer_d9 | +1877.84 | +320.45 | +1443.76 | -2458.61 | +0.775 | +0.226% | 8 / 14 |
| sr_all_d9 | +2100.76 | +311.02 | +13205.81 | -2568.54 | -2.451 | +4.852% | 44 / 58 |
| sr_weak_timer_d9 | +513.51 | +244.90 | +252.59 | +490.01 | +0.287 | 0.000% | 1 / 2 |
| sr_weak_timer_d11 | 0.00 | 0.00 | +13.13 | +214.56 | 0.000 | 0.000% | 0 / 0 |
| sr_sell_timer_d11 | 0.00 | +66.87 | 0.00 | +66.87 | 0.000 | 0.000% | 0 / 1 |
| sr_weak_sell_timer_d11 | 0.00 | 0.00 | 0.00 | 0.00 | 0.000 | 0.000% | 0 / 0 |
| sr_weak_sell_timer_d9 | 0.00 | 0.00 | 0.00 | 0.00 | 0.000 | 0.000% | 0 / 0 |
| sr_sell_timer_d9 | -19.22 | +45.32 | -19.22 | +45.32 | -0.035 | +0.009% | 3 / 6 |
| sr_timer_d11 | -29.45 | +128.39 | +2958.02 | -705.73 | -0.053 | +0.014% | 2 / 5 |
| sr_confirm_timer_d11 | -29.45 | +106.68 | -29.45 | +61.76 | -0.053 | +0.014% | 2 / 5 |
| drop_only_d9 | +3778.65 | -122.54 | -6408.93 | -12754.39 | -1.992 | +1.041% | 79 / 85 |
| weak_timer_d11 | -125.79 | -62.69 | -184.98 | -2366.36 | -0.071 | 0.000% | 2 / 1 |
| weak_timer_d9 | -412.32 | -608.81 | -7463.25 | -3190.34 | -0.198 | 0.000% | 7 / 7 |
| cap10 | -1241.61 | -1144.71 | +11072.27 | -13323.08 | +6.134 | +24.018% | 91 / 103 |
| sr_all_d11 | -1382.96 | -640.13 | +11517.89 | -200.90 | -1.956 | +0.029% | 15 / 23 |

## Baseline accounting

| Case | Net total $ | Gross losing-episode $ | Gross winning-episode $ | Profit factor | TP cycles | Forced closes | Worst episode $ |
|---|---:|---:|---:|---:|---:|---:|---:|
| HL close | +17413.84 | +40599.75 | +59311.35 | +1.461 | 239 | 12 | -8510.80 |
| HL touch | +21983.77 | +33389.99 | +55676.08 | +1.667 | 288 | 11 | -8475.40 |
| Published close | +17071.51 | +173075.60 | +190147.11 | +1.099 | 784 | 63 | -8658.99 |
| Published touch | +43005.85 | +143467.92 | +186473.77 | +1.300 | 950 | 60 | -8475.40 |

## Ten-rung cap: actual cost of protection

| Case | Baseline DD -> cap DD | Total-PnL delta $ | Gross-loss reduction | Gross-win delta $ | TP-cycle delta | Forced-close delta | Worst episode: baseline -> cap $ |
|---|---:|---:|---:|---:|---:|---:|---:|
| HL close | 31.10% -> 23.34% | -1241.61 | +27.20% | -12638.44 | -27 | -1 | -8510.80 -> -6211.36 |
| HL touch | 23.36% -> 17.23% | -1144.71 | +24.02% | -9077.41 | -6 | -1 | -8475.40 -> -6266.14 |
| Published close | 47.74% -> 29.95% | +11072.27 | +29.30% | -39645.56 | -47 | -2 | -8658.99 -> -6211.36 |
| Published touch | 33.00% -> 25.82% | -13323.08 | +19.80% | -41729.30 | -77 | 0 | -8475.40 -> -6266.14 |

## Top-five monthly stability

All figures below are monthly mark-to-market PnL deltas in dollars, not entry-cohort
attribution. All five top-ranked variants above are included, plus cap10 as the
defensive control. May and September in HL runs, and August in published runs,
are partial months. Realization-date deltas are also in `monthly.csv`.

### HL close

| UTC month | sr_confirm_timer_d9 | drop_only_d11 | sr_timer_d9 | sr_all_d9 | sr_weak_timer_d9 | cap10 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | -10 | -236 | -10 | -343 | 0 | -4945 |
| 2026-06 | +514 | +167 | +514 | -415 | +514 | +1030 |
| 2026-07 | -32 | +1999 | +1265 | +2312 | 0 | +3376 |
| 2026-08 | +109 | +1269 | +109 | +547 | 0 | -697 |
| 2026-09 | 0 | +1996 | 0 | 0 | 0 | -6 |

### HL touch

| UTC month | sr_confirm_timer_d9 | drop_only_d11 | sr_timer_d9 | sr_all_d9 | sr_weak_timer_d9 | cap10 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | 0 | -342 | 0 | -339 | 0 | -2086 |
| 2026-06 | +482 | -244 | +319 | +863 | +245 | +1488 |
| 2026-07 | +28 | +597 | -160 | -467 | 0 | +1902 |
| 2026-08 | +92 | +346 | +92 | +362 | 0 | -1923 |
| 2026-09 | +48 | -1 | +70 | -108 | 0 | -524 |

### Published close

| UTC month | sr_confirm_timer_d9 | drop_only_d11 | sr_timer_d9 | sr_all_d9 | sr_weak_timer_d9 | cap10 |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | 0 | -881 | +985 | +5194 | 0 | +1207 |
| 2025-08 | 0 | -1634 | +55 | -788 | 0 | -304 |
| 2025-09 | 0 | +301 | -411 | -1653 | -519 | -3738 |
| 2025-10 | 0 | -145 | -908 | +1403 | -88 | +1689 |
| 2025-11 | 0 | -125 | +126 | -290 | +126 | -85 |
| 2025-12 | 0 | +455 | +65 | +69 | +65 | -265 |
| 2026-01 | 0 | -169 | +277 | +9406 | +145 | +4629 |
| 2026-02 | 0 | -425 | -228 | -3531 | 0 | +11113 |
| 2026-03 | 0 | -522 | -88 | -143 | +10 | -2188 |
| 2026-04 | 0 | -928 | -155 | -363 | 0 | -749 |
| 2026-05 | -10 | -388 | -53 | +2002 | 0 | -4082 |
| 2026-06 | +514 | +167 | +514 | -415 | +514 | +1030 |
| 2026-07 | -32 | +1999 | +1265 | +2312 | 0 | +3376 |
| 2026-08 | 0 | +72 | 0 | 0 | 0 | -560 |

### Published touch

| UTC month | sr_confirm_timer_d9 | drop_only_d11 | sr_timer_d9 | sr_all_d9 | sr_weak_timer_d9 | cap10 |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | 0 | -835 | +1280 | -1183 | 0 | +77 |
| 2025-08 | 0 | -1787 | -1407 | -190 | 0 | -560 |
| 2025-09 | 0 | -363 | +192 | +399 | -538 | -838 |
| 2025-10 | 0 | -1385 | +449 | -336 | +387 | -1893 |
| 2025-11 | 0 | -402 | +81 | +601 | +81 | +539 |
| 2025-12 | 0 | +337 | +377 | +645 | +377 | +708 |
| 2026-01 | 0 | -327 | +77 | +553 | -63 | +616 |
| 2026-02 | 0 | +10 | -94 | -81 | 0 | -189 |
| 2026-03 | 0 | -951 | -255 | -4020 | 0 | -6318 |
| 2026-04 | 0 | +729 | -395 | +1107 | 0 | -856 |
| 2026-05 | 0 | -236 | -2924 | -459 | 0 | -7493 |
| 2026-06 | +482 | -244 | +319 | +863 | +245 | +1488 |
| 2026-07 | +28 | +597 | -160 | -467 | 0 | +1902 |
| 2026-08 | 0 | 0 | 0 | 0 | 0 | -505 |

## What the results actually establish

### 1. The strongest defensive mechanism is reduced maximum size

The ten-rung control consistently cuts losing-episode costs and worst-ladder
losses under both models and both windows. In the recent HL window it retains
92.9% / 94.8% of baseline total profit. Worst episode loss falls from about
$8.5k to $6.2k.

But the larger sample exposes a substantial opportunity cost. Published
resting-touch profit falls from $43,005.85 to **$29,682.77**, a 31.0% reduction.
Its worst monthly delta is **-$7,493.30**. This is not a statistical technicality:
the control misses meaningful profitable exposure and TP cycles.

The low cap does not remove forced closes: their count changes by only -1 / -1
in HL and -2 / 0 in published controls. It mainly makes loss-bearing inventory
smaller. That is useful evidence about risk, but it does not identify bad trades
before they occur.

### 2. Requiring a drop for rung 11 is not a robust upgrade

It initially looks attractive under HL close-confirmed: +$5,195 and 4.51pp less
drawdown. Under HL resting-touch the lift shrinks to $356 and DD worsens by 0.43pp.
The published controls lose $2,222 / $4,856 and both worsen DD. The initial result
cannot be generalized into a stable rule.

Some of the apparent improvement comes from changed recovery/cycle timing,
rather than avoided big losses. HL TP cycles increase by 11 / 6, while gross
losing-episode costs shrink by only 2.78% / 0.36%; forced-close counts do not
change. This is why neither win rate nor one favorable TP model settles it.

### 3. Positive S/R + pulse confirmation is small, not a bleeding fix

`sr_confirm_timer_d9` is positive across all four cases, +$472 to +$649,
with a worst monthly MTM delta of about -$32. That consistency is worth recording
honestly instead of discarding it because it misses the screen.

However, it vetoes only **7 / 14 HL episodes**. Gross losing-episode costs fall
by only **0.031% / 0.228%**, and maximum DD by **0.23 / 0.84pp**. It does not
address the scale of losses the user asked to reduce, and the sample is too small
to call it validated. No live addition is justified from this result.

The weaker-context-only S/R rule at depth >=9 is +$245 to +$514 in HL, but that is
only 1 / 2 intervened episodes. The strict S/R + weak + selling conjunction never
vetoes an add in any case. An inactive conjunction is uninformative about the
profitability of hypothetical trades; it is clearly ineffective as protection
against the actual historical losses in this test.

### 4. Why waiting for a visibly bearish context misses much of the risk

A descriptive cross-check against the preceding exact-baseline feature/outcome
ledgers examined the **first rung-11 add** in ladders eventually forced closed:

| HL baseline diagnostic | Close-confirmed | Resting-touch |
|---|---:|---:|
| Forced-close episodes | 12 | 11 |
| Those reaching rung 11 | 10 | 9 |
| First rung 11 while completed-4h close above EMA200 | 10 / 10 | 9 / 9 |
| First rung 11 was a true price-drop add | 8 / 10 | 8 / 9 |
| First rung 11 within 0.3% below known resistance | 3 / 10 | 4 / 9 |
| First rung 11 with healthy taker15m <=0.85 | 5 / 10 | 6 / 9 |

This is an outcome-conditioned diagnostic, **not a newly selected rule or
evidence of specificity versus winning ladders**. It explains why the tested
bearish-context timer conjunctions have so little reach: much of the inventory
is built while slower trend context is still above EMA200, and genuine price
drops bypass timer-only interventions.

Known 30m S/R zones are not identical to local tops visible afterward on a chart.
The test uses the unchanged live zone construction; it does not select future
swing highs and then pretend those levels were known when the add occurred.

## Acceptance decisions and loss-versus-profit trade-offs

Two screens were declared before simulation:

- Profit upgrade: at least +$1,000 HL net PnL and 10% gross-loss reduction in
  **both** TP models; DD cannot worsen, published net PnL cannot fall, and no
  monthly MTM delta below -$250 in any case.
- Defensive trade-off: at least 20% HL gross-loss reduction and 3pp DD reduction
  in **both** models, retain at least 90% of baseline total profit in every case,
  no published DD deterioration beyond 0.5pp, and no monthly delta below -$500.

Both also require at least 20 vetoed episodes in each HL model. **No rule passes.**
The complete failure lists are in `ranking.json`; its primary ordering emphasizes
the minimum HL drawdown improvement, whereas the report's full table ranks
minimum HL PnL improvement. No inactive rule is a recommended candidate.

The cap passes the substantive HL loss/DD tests but fails profit retention in
published resting-touch and monthly opportunity-cost limits. It is a **real,
expensive risk trade-off**, not a falsified ability to reduce losses. A different
explicit risk preference could accept such a trade-off; this report does not
silently make that decision for the user or label it profit-optimal.

Conversely, relaxing the gross-loss or sample thresholds after seeing the small
confirmation result would not turn it into strong evidence. Screening thresholds
are not mathematical laws, but they must not be rewritten to manufacture a pass.
No result overrides the repo's separate fresh forward-validation requirement.

## Causal decision trace

`hl_window_latest-close_confirmed--sr_timer_d9-first-vetoes.jsonl`, first row:

1. May 29 **04:44 UTC**: an otherwise-approved rung 9 timer add is due at $61.344.
   The price-drop trigger is false. Confirmed resistance is $61.488333, **0.2353%**
   above price; its latest confirmation was May 25 00:00 UTC, already known.
2. The experimental veto suppresses the add. It creates no pending order,
   does not reset the timer and does not remove existing protection or exits.
3. At the next decision, 04:45 UTC, the predicate no longer vetoes. The next
   modeled open fills at **$61.223**, decision index 777109, fill index 777110.
   No purchase is backdated to the earlier blocked candle.
4. The same rule can resume at a worse price: June 5 10:49 blocks a rung 9
   timer add at $61.281; the subsequent 10:50 modeled open is $61.497.
   Both favorable and adverse outcomes are retained.

The rule uses the engine's actual S/R context, not a separately rebuilt chart
context. Inputs are immutable scalar values available at that closed-minute
decision. Only the later outcome ledger contains fill and PnL information.

## Verification, artifacts and reproducibility

Runner: `scripts/hype-ladder-exposure-study.ts`.
Rules/metrics: `scripts/ladder-exposure-policy.ts`,
`scripts/ladder-exposure-metrics.ts`.
Tests: `scripts/ladder-exposure-tests.ts`.

Output: `backtests/hype/hype-ladder-exposure-controls-2026-09-05/`.

- `manifest.json`: frozen spec, input/config/source/dependency hashes, original
  engine hash and explicitly described optional research-veto seam.
- `baseline.json`, `results.json`, `summary.csv`, `monthly.csv`,
  `ranking.json/csv`, `validation.json`.
- Every baseline/variant retains close, partial, execution, summary and first-veto
  ledgers. First veto is deduplicated per episode/depth; veto-minute counts are
  not independent trade counts.
- `original-engine-evidence.json` preserves the exact pre-hook source text, whose
  SHA-256 matches the archived baseline source. The file stores source bytes in
  a JSON string; it is private/local provenance, not a second execution engine.

Verification passed:

- All four complete archived baseline digests with an inactive hook.
- Main and VPS TypeScript builds; new exposure tests; existing current-stack,
  attribution and replay-causality regression suites; `git diff --check`.
- No-hook versus inactive-hook identity, immutable inputs, future-prefix
  invariance, cap equivalence, causal release, continuing TP/emergency exits,
  authoritative outer gates, missing-data behavior and scoring rejection tests.
- Every simulated fill follows its decision index and no resistance confirmation
  is from the future. Inputs/sources hash unchanged across the run.
- Independent post-run re-evaluation of **3,800 first-veto records**, all monthly
  MTM/realized and episode accounting, and all ranking/qualification results.

Accepted fingerprints:

```text
manifest.json   6c2188cd9d5c67811d94bfc4d3425d9d047015af86ecdec30f49098aa1dc2e70
results.json    784c0982b7384ac3b16dfc08478f43698a6e9d6d314a32f825e0c40017e83f95
summary.csv     1ac7af1fe8d58591a8e7a3efbb0e530638841c5cd3fb47e6962f5450b1f85190
monthly.csv     fe4c8747624f1b17f26aa220b07324227f8b0619b911359b43f9a555066179dd
ranking.json    6f5bc042a9cdd499d142f93c5ad3cfae66d5316c03ec8cf973214e88d8997c92
validation.json 45bc39ee7a7e5b3d9764581efd877fe2283d03207eda3c23526b23c1dc525ce7
```

No exact live/maker parity or optimum is certified. The current configuration is
the comparator, not presumed best because it is deployed. No live changes follow
from this pass.
