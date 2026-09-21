# F04: weekly-VWAP context for MFI half exits

Local research only. User authorized the three-case full-path replay after
[F03's diagnostic](mfi-recovery-context.md). No live code/config/state changes,
new HL filter, exit-threshold sweep or maker-fee adjustment.

## Frozen definition

[Study card](../../research-inputs/mfi-weekly-exit-2026-09-09.json) is frozen
before economic runs. Current B17 baseline, original F02 MFI-half, and one new
variant: original MFI-half additionally requiring exact F03 C3 context.

- First closed minute with depth>=9 and gross inventory PnL<=-3% starts the timer.
- Exactly+60m: same episode remains depth>=9. No repeat search and no second PnL
  threshold. Original completed30m MFI14<=20 gate is unchanged.
- Additional context: latest available **completed1h close below UTC-week VWAP**
  and ROC over **five completed hourly bars<=0**. Strict VWAP comparison; inclusive
  ROC comparison. Actual turnover/base volume from Monday00:00UTC through that
  closed hourly candle, not typical-price approximation or eventual weekly data.
- ROC was redundant in F03's selected examples; it is retained to test the exact
  previously frozen condition, not credited with unproven extra predictive value.
- Unknown/stale/incomplete weekly context blocks only the experimental reduction.
  Original exits/gates remain authoritative. Rejected context does not set an
  episode no-add latch, create an order, or keep retrying until it passes.
- Accepted action: existing research next-open pro-rata50% reduction with original
  entry IDs/levels/times, average entry, cost basis and last-add clock preserved.
  No later adds in that episode, even after a subsequent ordinary S/R trim.
  Existing TP, stale, hard flatten, emergency and S/R logic manage the remainder.

The original F02 controller is wrapped, not edited. No replay engine changes.

## Periods and controls

| Window | Start UTC | End UTC |
|---|---|---|
| Published | 2025-07-01 00:00 | 2026-08-19 21:32 |
| Recent HL | 2026-05-17 20:43 | 2026-09-08 17:47 |

Both resting-touch and close-confirmed TP assumptions. Each path starts flat
with$32,000; unchanged current$800 x1.35/max11 B17 configuration. The windows
overlap and have different starting exposure histories; never pool them as
independent samples. Neither TP model certifies actual maker fills.

Exactly28 full runs:

- Four unchanged B17 controls, primary.
- Twelve original MFI-half controls: four paths x primary/source60/fill60.
- Twelve weekly-filtered variants on those same paths/clocks.

All16 controls must exactly reproduce archived F02 result digests, metrics,
accounting and observations **before** the new variants run. Four baseline
digests also match the earlier canonical B17 archive. All216 F03 checkpoint
contexts are checked on both source clocks before economic variants.

## Fees, timing and limits

Fees stay0.055% per side, charged pro rata exactly once on the removed inventory.
Residual inventory keeps its own fee reserve. Funding settlements and actual
maker/taker mix are not introduced. Extra5bps each side is separately labeled
fixed-path cost sensitivity, not re-simulated affordability/liquidation.

Primary source timing uses only completed bars. Source60 adds60s publication
lag to **both** MFI and weekly/ROC inputs. At Monday01:00, for example, the first
Monday hour is not usable until01:01 under that sensitivity; Sunday context
remains the latest available. No future Monday volume repairs that boundary.

Fill60 delays only the new experimental exit by another minute. Original exit
priority can supersede the pending research cut; the original intent does not
retroactively use revised future MFI/VWAP. Pending end-of-history actions are not
invented fills. These are sensitivities, not guarantees of live source latency.

Full entry, quantity, affordability, normal-exit and replacement-trade paths are
re-simulated. F03 contribution sums are compared to actual results, not forced
to match. Same screen as F02: recent gain>=$1,000 in both models; published gain
nonnegative; no DD increase; no month worse by more than$250; no modeled zero
equity. No bar is relaxed after results. Already-examined history is not a fresh
holdout; forward observation is still required before any live proposal.

## Reproduce and verify

From repo root, locally, with a fresh output directory:

```powershell
npx ts-node scripts/mfi-weekly-exit-tests.ts
npx tsc --ignoreConfig --noEmit --pretty false --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-mfi-weekly-exit-study.ts scripts/mfi-weekly-exit-check.ts scripts/mfi-weekly-exit-report.ts scripts/mfi-weekly-exit-tests.ts
node --max-old-space-size=6144 -r ts-node/register scripts/hype-mfi-weekly-exit-study.ts backtests/hype/hype-mfi-weekly-exit-recheck
node --max-old-space-size=6144 -r ts-node/register scripts/mfi-weekly-exit-check.ts backtests/hype/hype-mfi-weekly-exit-recheck
npx ts-node scripts/mfi-weekly-exit-report.ts backtests/hype/hype-mfi-weekly-exit-recheck
```

Archived inputs are hash-pinned; a later data refresh is a different study.
Do not overwrite accepted outputs or silently replace archive hashes.

## Artifacts

Output root: `backtests/hype/hype-mfi-weekly-exit-2026-09-09/`.

- `results.json`, `overview.csv`, per-case summaries: all28 economic results.
- `*-inventory.jsonl`, `*-closes.csv`, `*-partials.csv`: actual path ledgers.
- `*-observations.json`: first distress, checkpoint, MFI/context source evidence,
  vetoes, exclusions, priority and censoring.
- `comparisons.json`: baseline and original-half deltas, matched/removed/
  replacement entry contribution, extra-cost stress.
- `monthly.csv`: every model/policy/sensitivity month, actual MTM and completed
  W/L/winning/losing dollars. `primary-monthly-wl.csv` is the primary subset.
- `diagnostic-versus-replay.json`: F03 contribution versus actual filtered run.
- `ranking.json`: exact frozen screen failures, never automatic deployment.
- `control-parity.json`, `validation.json`, `verification.json`: all controls,
  raw accounting/MFI/weekly-VWAP/ROC reconstruction, source/artifact integrity.
- `execution-traces.json`: actual experimental fills with decision context,
  next-open bar, allocation, clock and baseline/variant episode outcome.
- `tables.md`: baseline-adjacent total/monthly/latency/attribution tables.
- `manifest.json`, `report-validation.json`: lineage, immutable scope, source,
  config, protected-state and generated artifact hashes.

Independent audit uses raw constituent-minute turnover and volume through the
selected hour, reconstructs UTC week start independently, and checks five-hour
ROC, original MFI, actual fills, fees, minute equity/DD and all monthly ledgers.
Tests cover closed/prefix/future bars, Monday reset, exact equality, missing
sources, zero volume, one-shot veto, control identity, partial/no-rebuild and
ordinary emergency supersession. No exact live funding/maker/liquidation claim.

Accepted results: [F04 findings, baseline-adjacent W/L and monthly comparisons](../../research/codex-astra-mfi-weekly-exit-findings-2026-09-09.md).
The new filter improves net under both TP assumptions but fails the published
touch drawdown and older monthly screens. No live change is qualified.
