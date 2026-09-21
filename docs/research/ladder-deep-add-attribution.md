# Ladder-only deep-add attribution

September 5, 2026. Local research, no trading-policy changes.

See the [completed findings](../../research/codex-astra-ladder-deep-add-attribution-findings-2026-09-05.md)
for the four accepted baseline cases, per-cohort attribution and limitations.

## Question and boundary

At the unchanged ladder's actual **simulated** add decisions, do deep timer adds
near resistance look consistently worse than comparable adds elsewhere? Is
there enough evidence to justify specifying a separate timing experiment?

This is not a reconstruction of every historical live order. It is not a short
test, and attributed rung PnL is not the amount saved by deleting that rung.
Removing/delaying an add changes average entry, TP, partial allocations, margin,
later adds and episode timing. Only a subsequent full-path replay can measure
that counterfactual, including missed recovery/TP cycles.

## Frozen definition

`research-inputs/sr-pulse-encounters/ladder-deep-adds-2026-09-05.json`:

- Deep means next depth 6-11. A timer-only add has passed the existing timer and
  does not satisfy the original 0.3% price-drop trigger. Drop-qualified adds are
  reported separately, even when the timer is also due.
- Near resistance means the nearest confirmed zone above the decision price is
  <=0.3% away. Other bands are 0.3-1%, >1%, no known level above, and unhealthy
  S/R context. Geometry is unchanged. A missing level is not fabricated.
- Healthy HL 15m requires at least 14 observed event minutes and source age
  <=90s. Buying >=1.2, selling <=0.85; unknown is not neutral.
- Three fixed descriptive questions: all near-resistance timer adds; those with
  selling; those with buying but nonpositive trailing 15m price return. These
  are attribution cohorts, not selected trading variants.
- Record wait-price labels at 15m and 60m, including occasions when the original
  rung or ladder already exited before the wait. Never drop those missed exits
  to make waiting appear favorable. No future prices affect cohort membership.

## Exact baseline and state attribution

Run both accepted windows under both TP assumptions, starting with the same
$32,000 simulated equity. All four complete result digests must match the
September 5 repaired baseline after excluding optional snapshots. Compare
closes, partials, block counts, drawdown, residual positions and execution timing,
not just headline PnL. Existing engine/source/config remain unchanged.

Replay the engine's ordered execution ledger to recover individual rung IDs.
At every add, verify the reconstructed pre-add quantity/cost/depth against the
engine's actual decision snapshot. Confirm the same timer/drop, deep-stress and
support-reopen decisions using the shared pure policies and exact series values.
Each S/R partial uses the shared selected-rung plan at the decision price, then
settles those same IDs at the recorded next-open price. Quantity and net PnL
must match every partial/full-close record. All rung contributions must sum to
the engine's realized and marked-open totals.

S/R timing needs care: merely querying a new zone engine at occasional add times
can rebuild with more candles than the continuously running engine had used at
its last scheduled rebuild. `DecisionSrClock` advances through every intervening
closed minute, preserving the original 30m rebuild cadence. It never uses a
full-history zone map retrospectively filtered by time. The engine's own trend,
risk-off, regime and indicator arrays are used directly.

The feature ledger contains only information known at the decision. Fill price,
eventual rung disposition/PnL, episode outcome and wait prices live in a separate
outcome ledger. IDs identify observations but are not predictor inputs. Earlier
closed inventory may be used to reconstruct state, never future outcomes to
choose a signal.

## Interpretation and advancement

Report the entire baseline, deep-add coverage, timer/drop bands, rung depths and
three fixed questions. Include favorable rung contributions and TP episodes,
not only flattens. Episode outcomes are deduplicated **within** each cohort;
cohorts overlap, so their episode PnL must not be added together. Rung lifetime
PnL contributions, in contrast, sum exactly when each rung is counted once.

Monthly attribution is grouped by add-decision month and includes later exits.
The monthly cohort export covers HL-era months; the all-history summary count
can therefore exceed its monthly-row total in the published window. It is not
monthly account PnL. Separate baseline monthly files cover each full replay
window using actual modeled realization timestamps. Still-open rungs are marked
separately, not classified as completed wins or losses.

The July 12 split checks temporal stability, not holdout performance. For a
bounded follow-up timing experiment, require >=30 adds in >=20 distinct episodes,
>=8 episodes per half, worse rung returns than within-half peers in both halves,
and positive mean 15m buy-price savings in both halves. Peer comparisons use the
same next depth, timer-only classification and completed-4h above/below-EMA flag;
each peer stratum needs >=5 closed rungs and each half >=10 comparable candidate
adds. These are coarse descriptive standardizations, not outcome-blind causal
matches or independent randomized samples. Other differences can confound them.

Even a passing prerequisite is not deployable evidence. Any follow-up must freeze
its own intervention, rerun full paths under both TP assumptions, quantify dollar
PnL/drawdown and monthly opportunity costs, and satisfy forward-validation rules.
An empty qualifying set does not authorize a broader threshold sweep.

## Reproduction

```powershell
npx.cmd ts-node scripts/ladder-deep-add-tests.ts
$env:DEEP_ADD_OUT = 'backtests/hype/deep-add-attribution-rerun'
node --max-old-space-size=6144 -r ts-node/register scripts/hype-ladder-deep-add-study.ts
Remove-Item Env:DEEP_ADD_OUT
```

Use a new output directory. Requires the preserved raw inputs, repaired candle
bundle, previous baseline summary/manifest and encounter-run input manifest.
Do not sync raw files while it runs. The runner pins source/config hashes and
content-hashes consumed market inputs, including BTC candles and historical
funding. Original data, state, config and prior outputs are not rewritten.

Artifacts: `baseline.json`, `validation.json`, `summary.json`, `cohorts.csv`,
`entry-cohort-monthly.csv`; per-model features/outcomes/add CSVs and baseline
realization-month PnL. Large generated evidence remains local and ignored.
