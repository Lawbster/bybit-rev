# Stage 3: individual indicators at deep ladder adds

September 5, 2026. Local research only. No live configuration or execution changes.

## Scope and rationale

The [stage 1-2 study](indicator-standalone-study.md) validated seven indicator
families and tested simple standalone traders. It did not test whether those
features improve an existing ladder's marginal exposure decision.

This stage freezes **four individual rung-11 vetoes**, each run separately:

| ID | Condition that postpones an otherwise eligible add |
|---|---|
| rsi_hot_d11 | Latest closed 1h RSI14 >= 70 |
| crsi_hot_d11 | Latest closed 1h CRSI >= 80 |
| roc_weak_d11 | Latest closed 1h ROC5 <= 0% |
| below_vwap_d11 | Latest closed hourly price < that bar's UTC-day VWAP |

The first two ask whether withholding the last rung during local extension
helps; the others ask whether weak price context makes adding exposure costly.
These are state conditions, not the stage 2 crossover-entry rules. They are
new, fixed hypotheses, not claims that standalone profitability predicts a
useful ladder veto. All four run irrespective of descriptive cohort rankings.

[Frozen study card](../../research-inputs/indicators/ladder-single-2026-09-05.json).
No ATR/ADX/RVOL gate, indicator combination, HL/S/R combination, alternative
depth, timeframe, threshold, size reduction or exit change is tested. These
other features are logged for subsequent explanation only.

## Timing and state contract

- Every original trend, risk, deep-stress, S/R and affordability check remains
  authoritative. The overlay cannot authorize an otherwise blocked add.
- The current transactional partial-close add clock is preserved. No existing
  RSI/CRSI gate is silently switched to the new formulas or closed-bar timing.
- Complete 1m constituents form closed UTC hours with the same June 1, 2025
  fixed seed as stage 2. The latest exact closed hour is required; no fallback
  to a forming, future, or stale bar. Missing required features leave this
  research overlay inactive and are counted, not imputed.
- The historical zero-publication-lag assumption is explicit. Repaired OHLC
  does not establish actual collector arrival time. At 10:34, the indicator
  still describes the complete 09:00-10:00 bar, not the forming 10:00 bar.
- VWAP compares that closed bar's price with its own UTC-day anchor. It does
  not compare a current minute price with future daily volume or a different
  day's VWAP. The prior day's last closed hour remains the latest completed
  context just after midnight, until the new day's first hour finishes.
- Both timer-only and genuine-drop adds are covered at rung 11. No persistent
  latch: re-evaluate on subsequent eligible closed minutes. No fake pending
  order is created while blocked; the eventual permitted add fills next open.
- Rungs 1-10, original order sizes, exits, partials and cooldowns are unchanged.

## Baselines and accounting

Four corrected-clock baselines from
`backtests/hype/hype-ladder-sizing-2026-09-05-validated/` must reproduce both
their full-result digests (excluding snapshots) and summary metrics before
any variant runs. Existing engine and input hashes are pinned first.

| Window | Exact UTC interval |
|---|---|
| Recent | 2026-05-17 20:43 to 2026-09-04 19:01 |
| Longer | 2025-07-01 00:00 to 2026-08-19 21:32 |

Each window uses both resting-touch and close-confirmed TP assumptions.
Market actions use next-open execution; $32,000 initial equity; unchanged
$800 x 1.35 max-11 ladder; 0.055% each side. Historical windows overlap and
have already been examined, so neither is an untouched holdout. The longer
cutoff intentionally matches the accepted ladder archive, not stage 2's later
standalone cutoff.

Report completed flat-to-flat episodes, including earlier partial PnL, as wins
or losses. Keep the final open mark and unfinished partial proceeds separate.
Monthly losing-episode dollars assign the entire episode to its exit month;
monthly equity changes include marked inventory and partial proceeds when
realized. These are different accounting views, not amounts to subtract twice.

Preserve the canonical `snapshot.ts` month grouping: a minute ending exactly
at a UTC month boundary belongs to the new month. Exact stored boundary marks
allow independent reconstruction without changing the established baseline.

The unchanged profit and defensive screens are inherited from L03-L06,
including distinct affected episodes, gross loss reduction, both TP models,
monthly regression limits and longer-window profit retention. Fixed-path
extra 5bps/side cost stress is not a separately simulated slippage trajectory.
Funding settlement, exact maker/native queue behavior, fragmentation/lot
rounding, 10-second live cadence, outages, liquidation and shared-account
interaction remain outside this model's certified scope.

## Evidence and reproduction

The runner records genuine baseline deep-add decisions at depth >=9 and their
actual filled rungs, with future outcomes stored separately. Rung PnL allocates
each observed position identity through selected-ID partial/full closes and
the final inventory mark. It is **not** the profit of skipping that rung.
Repeated adds and whole-episode outcomes are correlated; never count a repeated
episode several times as independent evidence. Vetoed attempts are not trades.

```powershell
npx.cmd ts-node scripts/ladder-indicator-tests.ts
npx.cmd ts-node scripts/replay-current-stack-tests.ts
npx.cmd ts-node scripts/ladder-sizing-tests.ts

# New directory only; never overwrite accepted evidence.
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-indicator-study.ts --out backtests/hype/ladder-indicator-review-rerun
node --max-old-space-size=8192 -r ts-node/register scripts/ladder-indicator-results-check.ts backtests/hype/ladder-indicator-review-rerun
```

Default output: `backtests/hype/hype-ladder-single-indicator-2026-09-05/`.
Read manifest, validation, independent verification, baseline, results, ranking,
monthly comparisons and baseline-cohorts. Per-case decisions/inventory/month
marks preserve audit evidence; baseline feature/outcome files separate causal
inputs from labels. A failed or incomplete run is not accepted evidence.

Sources:
[policy and feature adapter](../../scripts/ladder-indicator-policy.ts),
[runner](../../scripts/hype-ladder-indicator-study.ts),
[independent tests](../../scripts/ladder-indicator-tests.ts),
[artifact verifier](../../scripts/ladder-indicator-results-check.ts).

Stages 4-5 remain separate future work, not an automatic combinatorial sweep.
