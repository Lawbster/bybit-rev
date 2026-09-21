# Ladder-only deep-add attribution: S/R and HL pulse

September 5, 2026. Local research; no strategy/config/execution changes.

## TL;DR

- Reproduced all four repaired-baseline result digests exactly. The primary HL
  window contains **899 / 987 deep adds across 175 / 185 ladder episodes**, under
  close-confirmed / resting-touch TP assumptions respectively. These are two
  views of overlapping history, not independent samples to pool.
- The concern is specific: **timer-only adds within 0.3% below resistance** have
  realized rung contributions of **-$2,158.60 / -$498.49**, whereas drop-qualified
  adds in the same resistance band contribute **+$2,375.70 / +$1,820.17**.
  Neither number is the profit improvement from blocking those adds.
- **0/3 frozen hypotheses qualify for the conditional timing experiment in any
  of the four replay cases.** Waiting 15 minutes is not consistently cheaper
  across chronological halves; pulse-conditioned samples are small. No delay
  strategy, short strategy or portfolio overlay was tested or promoted.

## What this pass actually does

This follows the [first encounter study](codex-astra-sr-pulse-encounter-findings-2026-09-05.md),
which found 0/8 qualifying descriptive cells. Instead of searching all market
encounters again, inspect the unchanged long ladder's actual **modeled fills**:
which deep adds it chose, which known resistance they approached, the exact
decision-time pulse/guard context, and how each rung ultimately settled.

The [definition](../research-inputs/sr-pulse-encounters/ladder-deep-adds-2026-09-05.json)
was written before extracting these results. The [method and reproduction guide](../docs/research/ladder-deep-add-attribution.md)
describes the attribution and advancement rules. This is not an audit of every
historical live fill, nor a minute-by-minute study of all blocked opportunities.

Deep = next depth 6-11. Near = nearest confirmed resistance above the decision
price, no more than 0.3% away. A timer-only add does **not** meet the existing
0.3% drop-from-last-entry trigger. An add meeting that price-drop trigger is in
the drop cohort even if its timer is also due. No S/R geometry was retuned.

## Baseline acceptance and aggregate context

All runs use $32,000 initial modeled equity and the unchanged $800 x 1.35,
11-rung policy. The reference is the repaired causal replay, not the older
retrospective-fill engine. Both entry and exit fees are modeled at 0.055%; actual
funding, maker fills, exchange lot rounding and live downtime are not modeled.
These totals are **not a forecast or the user's historical account return**.

| Window / TP model | Realized PnL | Marked open PnL | Total PnL | Max DD | Full closes / partials |
|---|---:|---:|---:|---:|---:|
| Published / close-confirmed | $17,071.51 | $0.00 | $17,071.51 | 47.74% | 847 / 177 |
| Published / resting-touch | $43,005.85 | $0.00 | $43,005.85 | 33.00% | 1,010 / 186 |
| Full HL / close-confirmed | $18,711.60 | -$1,297.77 | $17,413.84 | 31.10% | 251 / 72 |
| Full HL / resting-touch | $22,286.09 | -$302.32 | $21,983.77 | 23.36% | 299 / 79 |

Published window: July 1, 2025 through August 19, 2026 21:32 UTC. Full HL:
May 17, 2026 20:43 through September 4, 2026 19:01 UTC. Both HL cases end with
an open 11-rung ladder. Different starting inventories/TP paths matter; the
overlapping windows are robustness checks, not extra independent observations.

Every complete engine-result digest matched its archived baseline, including
execution events, exits, blocks, drawdown and residual position accounting.
Optional snapshots were excluded from the digest, then checked against the
reconstructed inventory. No production or canonical-engine changes were needed.

| Case | All filled adds | Deep adds, all history | Deep adds in HL era | Healthy S/R + 15m taker at those decisions |
|---|---:|---:|---:|---:|
| Published / close-confirmed | 7,183 | 3,152 | 743 | 743 |
| Published / resting-touch | 8,012 | 3,410 | 785 | 785 |
| Full HL / close-confirmed | 2,117 | 899 | 899 | 899 |
| Full HL / resting-touch | 2,379 | 987 | 987 | 987 |

Healthy here requires continuous configured S/R context and >=14 observed HL
taker minutes with source age <=90 seconds. It does not certify every market
stream at every minute or prove historical collector delivery latency. Missing
pre-HL pulse is unknown, never silently treated as neutral.

## Where the contribution comes from

Primary full-HL window. PnL columns are realized **individual-rung contributions**,
including both modeled fees. Each rung is counted once within these mutually
exclusive timing/distance bands. Episode counts can overlap between bands.

| Add type / resistance distance | Close-confirmed n | Rung PnL | Resting-touch n | Rung PnL |
|---|---:|---:|---:|---:|
| Timer-only / <=0.3% | 36 | -$2,158.60 | 45 | -$498.49 |
| Timer-only / >0.3-1% | 80 | -$1,803.94 | 99 | +$336.61 |
| Timer-only / >1% | 59 | -$2,132.86 | 63 | +$387.08 |
| Timer-only / no known level above | 77 | +$3,610.73 | 64 | +$1,807.17 |
| Price-drop / <=0.3% | 108 | +$2,375.70 | 155 | +$1,820.17 |
| Price-drop / >0.3-1% | 213 | +$2,010.75 | 257 | +$1,175.13 |
| Price-drop / >1% | 195 | +$4,933.23 | 184 | +$8,320.96 |
| Price-drop / no known level above | 131 | +$8,493.49 | 120 | +$6,205.52 |
| All deep | 899 | +$15,328.50 | 987 | +$19,554.16 |

Marked-open deep-rung contributions are separately -$1,117.70 / -$133.29. Of the
155 resting-touch near-resistance price-drop adds, 153 are closed and two remain
open with +$49.23 marked PnL. All near-resistance timer adds are closed.

Interpretation: proximity to resistance is **not sufficient** to identify a bad
add. Timer-only near-resistance adds are weaker here, but so are some more distant
timer adds, and the TP assumption changes their totals materially. This is an
association along the existing inventory path, not evidence that resistance
caused the loss or that removing these rungs leaves the rest of the path intact.

Near-resistance timer adds are only 36/899 (4.0%) and 45/987 (4.6%) of all deep
adds. Only **2 / 6** of them are rung 11. This is not predominantly a last-rung
phenomenon in these replays.

## Three frozen hypotheses and the advancement decision

Selling = healthy HL taker15m <=0.85. Buying without price progress = taker15m
>=1.2 and trailing closed-minute 15m return <=0. All require timer-only, deep,
near-resistance adds.

| Cohort | Close-confirmed adds / episodes | Rung PnL | Resting-touch adds / episodes | Rung PnL |
|---|---:|---:|---:|---:|
| All near timer adds | 36 / 26 | -$2,158.60 | 45 / 29 | -$498.49 |
| Near timer + selling | 10 / 9 | -$1,068.30 | 13 / 11 | -$1,074.32 |
| Near timer + buying without progress | 7 / 7 | -$903.91 | 9 / 8 | -$88.73 |

These overlap; do not sum them. The loss-contribution ranking is all/selling/
buying-without-progress under close-confirmed, but selling/all/buying-without-
progress under resting-touch. **Incremental strategy-PnL rankings are unavailable**:
there were zero intervention variants, not three strategies returning these sums.

The predeclared screen requires >=30 adds in >=20 distinct episodes, >=8 episodes
in each chronological half, worse returns than same-depth/timer/EMA peers in both
halves, and positive mean 15m buy-price savings in both halves. Each peer stratum
needs >=5 closed rungs; each half needs >=10 comparable candidate adds. Distinct
episodes are not guaranteed statistically independent; the definition's word
"independent" should not be read as a claim of IID observations.

Split is July 12, 2026 00:00 UTC. The table below shows all-near-timer diagnostics.
Peer delta is candidate minus mean peer **rung return**, in percentage points;
it is not account PnL improvement. Positive wait saving means a cheaper later buy.

| Model / half | Adds / episodes | Within-stratum return delta | Mean 15m wait saving | Mean 60m wait saving |
|---|---:|---:|---:|---:|
| Close-confirmed / earlier | 24 / 19 | -0.262 pp | -0.156% | -0.160% |
| Close-confirmed / later | 12 / 7 | -0.898 pp | +0.072% | -0.032% |
| Resting-touch / earlier | 23 / 17 | -0.281 pp | +0.028% | -0.120% |
| Resting-touch / later | 22 / 12 | -0.069 pp | -0.067% | -0.080% |

- All-near-timer: underperformance survives this coarse peer comparison in the
  full HL cases, but 15m waiting changes sign across halves. Close-confirmed also
  has only seven later-half episodes. Sixty-minute waiting is worse in all four
  model/half combinations.
- Selling: only 9 / 11 distinct episodes; adequate peer comparisons are missing
  or do not consistently show underperformance. Aggregate 60m price savings are
  +0.310% / +0.012%, but the latter reverses sign in the later half. This isolated
  diagnostic does not rescue the failed predeclared screen.
- Buying-without-progress: only 7 / 8 episodes, no adequately supported peer
  comparisons, and 15m wait savings do not stay positive across halves.

The published-window controls also return zero qualifying hypotheses. Their
all-near-timer cohorts contain 32 / 34 adds in 23 / 23 episodes, contributing
-$2,126.03 / -$879.46. Exact half/cell results are in `summary.json`.

**Conclusion: do not advance a simple timed-wait intervention on this evidence.**
This screen is a research-priority rule, not a mathematical proof that every
possible skip, conditional wait, re-entry or pulse strategy is unprofitable.
No threshold was relaxed or extra filter family added after seeing the results.

## Monthly stability: attributed entry cohorts, not strategy deltas

Cells are `realized rung PnL (number of adds)`, assigned to the **entry decision's
month**, including later exits. They are not monthly account PnL and not the
monthly savings from a blocker. May/September are partial observation months.

| Model / cohort | May | June | July | August | September |
|---|---:|---:|---:|---:|---:|
| Close-confirmed / all near timer | +$154.64 (3) | +$144.08 (13) | -$2,424.75 (16) | -$32.57 (4) | $0 (0) |
| Close-confirmed / selling | $0 (0) | -$220.23 (4) | -$839.15 (5) | -$8.92 (1) | $0 (0) |
| Close-confirmed / buying without progress | +$119.34 (2) | $0 (0) | -$1,010.26 (4) | -$12.98 (1) | $0 (0) |
| Resting-touch / all near timer | +$1.05 (1) | +$524.96 (13) | -$1,405.47 (20) | +$126.59 (6) | +$254.38 (5) |
| Resting-touch / selling | $0 (0) | +$41.89 (2) | -$1,167.41 (8) | +$38.77 (2) | +$12.43 (1) |
| Resting-touch / buying without progress | $0 (0) | +$182.05 (2) | -$388.74 (3) | +$23.96 (2) | +$93.99 (2) |

Published-window monthly tables and all other cohorts are retained in
`entry-cohort-monthly.csv` for HL-era months. Separate `*-baseline-monthly.csv`
files cover each full replay window using actual modeled realization dates.
There is no per-month variant-versus-baseline delta
table because no strategy was changed. The net-delta/monthly-stability deployment
gate is **not satisfied**, not inferred from negative rung contributions.

## The favorable outcomes a blocker might disturb

Within all-near-timer cohorts, 24/36 and 34/45 rungs are profitable. Those winning
rungs contribute +$954.47 / +$1,438.21, against losses of -$3,113.07 / -$1,936.70.
Their ladders include 20 / 26 TP episodes and 6 / 3 forced-close episodes.

At the 15m wait timestamp, 6 / 3 baseline rungs have already exited; at 60m,
18 / 16 have already exited. Their baseline ladder has already closed in
4 / 1 add observations at 15m and 12 / 11 at 60m. These are per-add observations,
not counts of independent TP cycles that a new policy necessarily loses.

Across all deep adds, profitable rungs contribute +$52,413.48 / +$51,038.30 while
losing rungs contribute -$37,084.98 / -$31,484.15. The deeper inventory is not
uniformly harmful. This pass does not measure additional TP cycles, cascades
avoided or margin relief versus an alternative: those require a full-path
counterfactual. A lower later price alone cannot establish that comparison.

## Decision trace: allowed add, known resistance, later loss

In both full-HL TP models, July 7 at **17:08 UTC** opens modeled rung 10:

- Decision price $71.89; known resistance $72.0675, 0.2469% above. Its latest
  touch confirmation was July 7 03:00 UTC, already available before this decision.
- The 30m timer is due; the original price-drop trigger is **false**.
- HL taker15m is **0.8445**, with 14 source minutes and age 60s. HL taker1h is
  **1.2911**. Shorter- and longer-horizon flow disagree.
- The deep-stress guard reports a funding-only block. Known support at $71.731
  is 0.2212% below price; the existing support-reopen policy allows the add.
  Trend, risk-off and regime entry flags are clear. This is not a bypass of an
  outer trend block, and there is no universal resistance veto in that policy.
- Modeled next-open fill is $71.89 for $11,915 notional. Eventual hard-flatten
  exit is July 11 08:00 UTC at $66.444. That rung contributes **-$915.23** after
  modeled fees; its entire ladder loss is not assigned to this one rung.

The same ladder's rung 8 at July 7 16:32 UTC also opens near resistance, but with
**buy-dominant** taker15m of 2.3629 and negative trailing price progress. It later
contributes -$510.15. Together these two rungs lose $1,425.38. A warning attached
to the later sell-dominant signal cannot be assumed to remove both positions or
retroactively prevent the whole flatten.

A favorable counterexample: close-confirmed July 15 08:03 UTC rung 11 opens at
$66.71, 0.1734% below resistance, with taker15m 2.0049 despite negative 15m price
progress. It exits through an S/R partial at 08:43 for **+$98.70**; the ladder
subsequently stale-TPs. Waiting 15m would face a 0.3897% higher price; at 60m the
price is 1.0298% higher and this baseline rung has already settled. This does not
prove adding was optimal, but shows why adverse examples alone are insufficient.

## Side observations, not additional hypotheses

Near-resistance timer refills after an earlier S/R partial in the **same episode**
number only 7 adds across 4 episodes / 11 across 6. Their rung contributions are
-$1,237.50 / -$1,144.97. In both models, the same July 7 episode accounts for
-$1,425.38; all the other refill episodes in this cohort contribute positively.

Thus a superficially attractive "do not refill after partial" narrative is
mostly one shared event here. No refill blocker was designed or tested. The
broader all-near-timer cohort excluding those two July 7 rungs is -$733.22 /
+$926.88; exclusion is a concentration diagnostic, not a tradable rule.

## Verification and preserved evidence

Runner: `scripts/hype-ladder-deep-add-study.ts`.
Pure attribution/statistics: `scripts/ladder-deep-add-attribution.ts`.
Regressions: `scripts/ladder-deep-add-tests.ts`.

Accepted output directory:
`backtests/hype/hype-ladder-deep-add-attribution-2026-09-05-validated/`.
Baseline source:
`backtests/hype/current-stack-repaired-candles-2026-09-05-validated/`.

The final output retains four independent feature/outcome ledgers, add CSVs,
cohort/monthly summaries, complete baseline digests and a manifest with input,
source, config, spec and dependency-lock hashes. These generated artifacts stay
local/ignored; method, small definition and findings are allowlisted for Git.

Checks include exact rung quantity/cost and partial selection, PnL reconciliation,
unknown-data exclusion, censored outcomes, already-closed baseline rungs, unchanged
baseline objects, future-prefix invariance, and S/R query-cadence identity.
Sparse independent zone queries can drift from the engine's rebuild schedule;
the attribution clock explicitly advances every intervening closed minute.

A review found a duplicated `near_time_selling` cohort label in the initial
summary export. Pulse-only descriptive labels now have a separate prefix and
duplicate IDs are rejected/tested. The original run is preserved; the final run
reproduces the engine and ledgers rather than editing old output in place.

Final rerun: all four baseline results, feature/outcome ledgers, add CSVs and
baseline-monthly CSVs match the original run byte-for-byte. All hypothesis
statistics are unchanged. Cohort IDs and `(cohort, month)` keys are unique; the
disjoint timing/distance bands and hypothesis-month totals reconcile.

Passed locally:

```text
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
npx.cmd ts-node scripts/ladder-deep-add-tests.ts
npx.cmd ts-node scripts/replay-current-stack-tests.ts
npx.cmd ts-node scripts/sr-pulse-encounter-tests.ts
git diff --check
```

An additional read-only synthetic scoring check confirmed that adequate counts,
underperformance and favorable waits can pass the prerequisite; changing only
the wait-price evidence to adverse blocks it. No production process was started.

Accepted-output SHA-256 fingerprints:

```text
manifest.json   66f9ae01ae2c9e8d98311bacda5418132c440c40b68394725d515df626d63505
summary.json    75c15f631b80c416a137016524d7f0caef6553050f4f881596b59aec7a72aa3e
baseline.json   eaf586aa5652b85a9e1ff2f51930b402288b759b9f4c65e40cbfa7b038dee3e1
validation.json 82b3540cbcd529b795db7afa25160ade4c99b235ce7cd7e9be35dfc93f7cae6d
```

This remains previously examined development history, not an untouched holdout.
Canonical replay equality certifies reproducibility under its stated model;
it does not certify exact live maker-TP/accounting parity. No profitable live
change is established, and no deployment, config change, short enablement,
commit or push is part of this pass.
