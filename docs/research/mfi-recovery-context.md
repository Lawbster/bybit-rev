# F03: selective half-exit recovery context

Research-only diagnostic following [F02](mfi-distress-exit.md). Fees remain
0.055% per entry/exit side; no maker-fee or live strategy change.

## Question and scope

What as-of context distinguishes an archived MFI-half exit that improved the
episode's net from one that sacrificed a subsequent recovery? A future losing
episode is **not automatically a useful cut**.

[Frozen card](../../research-inputs/mfi-recovery-context-2026-09-09.json):
216 eligible baseline first-deep-minus3%/+60m checkpoints across four separately
reported F02 paths. Of these, 50 model/window cases actually execute the MFI-half
intervention, representing 32 distinct UTC checkpoint times. These are correlated,
overlapping observations, not 50 independent trades. The two run windows start
independently flat and must not be pooled.

- Published: July1,2025 through August19,2026 21:32UTC.
- Recent: May17,2026 20:43 through September8,2026 17:47UTC.
- Resting-touch and close-confirmed TP assumptions in each window.
- Archived B17 baseline and archived MFI-half only; no new trading definitions.
- Half exit remains pro rata, once per episode, with no subsequent adds. Normal
  protections/exits retained. No new selection based on hindsight outcomes.

Eight archived paths are independently re-accounted from their raw minute price
and inventory ledgers. Four baseline digests match accepted canonical B17. All
episode entry identities match between baseline and MFI-half; unselected episodes
are checked unchanged. Actual selected episode deltas sum to each entire F02
half-versus-baseline net difference. **This does not certify a filtered subset's
new exposure, drawdown, or cash path without replaying that subset.**

## Context and timing

At checkpoint minus4h, minus1h (first distress), minus15m, and checkpoint:

- All previously validated indicator families at standard parameters on
  5m/15m/30m/1h/4h: RSI, CRSI, ROC, ADX/DMI, MACD, Bollinger, ATR/efficiency,
  UTC day/week VWAP, relative volume, OBV/MFI/CMF.
- Closed minute returns, 60m turnover/volume VWAP, canonical 249 completed-4h-close
  EMA trend context, causal 14d S/R zones.
- All eight HL streams: taker, order-book bands, asset context, REST OI, REST
  funding, HLP vault, 1m candles, 5m candles. Every feature keeps source references.

Indicators include only completed bars; primary publication lag0, sensitivity
lag60s. Legacy HL completed buckets use60s availability lag, then120s sensitivity.
Receive/write metadata supersedes modeled publication when recorded. Sample-only
timestamps remain proxies, not proof of historical local arrival.

Price/SR source60 sensitivity moves the entire query back60s, preserving coherent
zone and price timestamps. The SR engine rebuilds on exact30m boundaries before
queries, so sparse query timing cannot change its rebuild schedule. Support-break
check freezes the support known15m earlier and tests the last **two actual closed
5m bars**, not two consecutive minute closes. Both coverage checks must pass.

Unknown/stale/conflicting sources remain unknown. In particular, with another60s
HL publication lag, a latest15m window can have13/15 rather than the required14/15
buckets. This is a coverage failure, not evidence that selling disappeared. No
backfill of unavailable HL into older candle-only history.

## Twelve frozen contrasts, not an unrestricted search

See card for exact definitions. Broad families: 4h EMA regime; ADX/DMI; weekly
VWAP/ROC; failed price/MFI rebound; frozen support break; two-window HL selling;
the same selling at two observations; book deterioration; extreme RSI/CRSI;
MACD improvement; CMF; ATR/relative-volume downside shock.

Every contrast retains flagged, unflagged **and unknown** counts, benefit/harm
dollars and monthly contribution for both availability assumptions. All feature
distributions are descriptive; their medians are not fitted trading thresholds.
No inverse-condition search, new combinations, economic screen pass, or untouched
holdout claim. Prior P01/F02 selection already inspected these histories.

## Reproduce locally

From repository root; never run this on the VPS:

```powershell
npx ts-node scripts/mfi-recovery-context-tests.ts
npx tsc --ignoreConfig --noEmit --pretty false --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-mfi-recovery-context-study.ts scripts/mfi-recovery-context-check.ts scripts/mfi-recovery-context-report.ts scripts/mfi-recovery-context-tests.ts
node --max-old-space-size=6144 -r ts-node/register scripts/hype-mfi-recovery-context-study.ts backtests/hype/hype-mfi-recovery-context-recheck
node --max-old-space-size=6144 -r ts-node/register scripts/mfi-recovery-context-check.ts backtests/hype/hype-mfi-recovery-context-recheck
npx ts-node scripts/mfi-recovery-context-report.ts backtests/hype/hype-mfi-recovery-context-recheck
```

Fresh output directory required; do not overwrite accepted artifacts. Input
hash mismatch after a data pull requires a separately documented new study, not
editing the accepted card to disguise changed inputs.

## Artifacts and interpretation

Accepted directory: `backtests/hype/hype-mfi-recovery-context-2026-09-09/`.

- `baseline-and-half.json`, `baseline-checks.json`, `accounting-checks.json`:
  unchanged economic controls and independent accounting.
- `rows.json`, `selected-cases.csv`: exact checkpoint, entry identity, actual
  fill, both episode outcomes, delta, primary/delayed contrast flags.
- `exclusions.json`: original checkpoint attrition and censoring, not quietly
  omitted episodes. Two eligible recent controls remain unclosed at cutoff;
  neither was selected for MFI-half, so no invented cut label.
- `contexts.jsonl`: all1,046 unique as-of snapshots and raw-source references.
- `trajectories.csv`: all251 numeric/context fields at each of four offsets,
  including unselected baseline controls; no outcome data enters those features.
- `feature-distributions.json`: helpful/harmful/unselected descriptive summaries
  by model and offset, with missingness.
- `contrasts.json`, `contrast-monthly.csv`: all12 contrasts and every observed
  checkpoint month, both timing assumptions;3840 group rows. Months without
  checkpoints have no contrast observations, not a suppressed loss.
- `tables.md`, `baseline-monthly.csv`: readable baseline W/L/win dollars/loss
  dollars/net/DD, all contrast totals, every actual intervention, and all38
  economic model-month pairs including months without checkpoints.
- `prefix-checks.json`, `validation.json`, `verification.json`,
  `report-validation.json`, `manifest.json`: causal-prefix tests, independent
  raw source/indicator clocks, full-file selection probes, artifact hashes,
  protected-file hashes and exact lineage.

Independent checker verifies raw weekly VWAP and five-bar ROC on both clocks,
all HL references and healthy-flow arithmetic, book-band quality/arithmetic,
fixed-support real5m constituents, selected-label arithmetic and every contrast
partition. Existing validated indicator suites and new label/unknown/timing
tests cover the reusable functions. No strategy engine or fee logic was changed.

Results: [F03 findings](../../research/codex-astra-mfi-recovery-context-findings-2026-09-09.md).
