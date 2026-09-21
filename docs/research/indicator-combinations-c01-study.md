# C01 combination replay: reproduction and artifact guide

September 7, 2026. Local research only. No trading, live policy change, or VPS sweep.

Accepted run:
[`hype-indicator-combinations-c01-2026-09-07-v2`](../../backtests/hype/hype-indicator-combinations-c01-2026-09-07-v2/verification.json).
[Findings and baseline-first comparisons](../../research/codex-astra-indicator-combinations-c01-findings-2026-09-07.md).
[Original plan](indicator-combinations-c01-plan.md) and
[exact frozen card](../../research-inputs/indicators/combinations-c01-2026-09-07.json).

All 32 approved combinations were run. No profit or defensive candidate passes
the predeclared follow-up criteria. The card's original `not_run`/review fields
are preserved in the run manifest for provenance; `verification.json` records
the accepted execution. Do not edit the historical card to change those fields.

## Reproduction prerequisites

Run from the repository root, locally. Raw artifacts remain intentionally
untracked. A source checkout alone is not a complete research archive.

- Installed project dependencies and the unchanged validated research sources.
- Accepted I01, I02, I06, I08, I09, I10 and I11 artifacts at the directories
  pinned in the card. Their manifests, verification records, ledgers, statistics,
  monthlies and summaries are checked before any new strategy result.
- Original full-minute history, the live-minute JSONL, and the separately
  hash-pinned candle repair file. Their exact original bytes must be recoverable.
- A new output directory under local `backtests/`; never overwrite accepted runs.

The live-minute file had grown after I01. Its first 23,021,958 bytes reproduce
the original SHA-256 exactly. C01 copies that verified prefix and the other
pinned inputs into its own output `inputs/` directory. The current live data
file is not truncated or rewritten. The loaded tape contains 663,541 continuous
minutes from the June 1 initialization seed through the September 4 cutoff.

This is **exact snapshot recovery, not a date-filtered rebaseline**. Changes
inside the original prefix, other pinned data changes, source changes, or
accepted artifact drift stop the run. Do not weaken those checks to obtain
a result; recover the exact source or explicitly version and revalidate a new
baseline first. Subsequent data belongs to a separately defined study window.

## Commands

PowerShell below uses `.cmd` to avoid local execution-policy ambiguity.
On Linux use `npx` instead. Run locally, not on the trading VPS.

```powershell
npx.cmd ts-node scripts/indicator-combination-tests.ts
npx.cmd ts-node scripts/indicator-feature-tests.ts
npx.cmd ts-node scripts/adx-dmi-standalone-tests.ts
npx.cmd ts-node scripts/atr-efficiency-standalone-tests.ts
npx.cmd ts-node scripts/vwap-volume-standalone-tests.ts
npx.cmd ts-node scripts/volume-flow-standalone-tests.ts

npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false

# This destination must not already exist. Use a new suffix for each reproduction.
npx.cmd ts-node scripts/hype-indicator-combinations-study.ts --out backtests/hype/hype-indicator-combinations-c01-reproduction-01
npx.cmd ts-node scripts/indicator-combination-results-check.ts backtests/hype/hype-indicator-combinations-c01-reproduction-01
```

The runner and checker refuse to overwrite their artifacts. The first original
unversioned attempt stopped on saved-JSON negative-zero normalization and is
**not accepted evidence**. The accepted v2 normalized only the JSON archive
comparison; original/new engine in-memory deep equality remains unchanged.

## Timing, scope and accounting

Eight exact previously tested triggers, each with four separate state conditions:
4h DMI direction, 1h signed ER veto, 1h prior-20-bar relative volume, or 1h
close relative to its own UTC-day VWAP. One trigger plus one condition only.

At a fresh trigger, use the latest **expected completed** condition bar. A
missing or unavailable expected bar blocks instead of falling back to stale
data. False conditions discard the crossing; there is no later catch-up.
Occupied/pending crossings are skipped. UTC-day VWAP belongs to its closed
source bar's day, including across midnight. Both decisions and rejected
opportunities are stored.

Conditions are frozen at signal time. Execute at the minute open at the
closed-bar boundary in the immediate model, and test a separate +60s delay
on **both entry and exit**. The 12h hold starts at the actual entry fill.
Execution-minute high/low/close never selects an entry. Future minute prices
are used only for subsequent marking and path-risk evaluation.

Full: July 1, 2025 00:00 to September 4, 2026 19:01 UTC.
Recent: May 17, 2026 20:43 to the same cutoff, starting flat. These overlap;
neither is a new holdout. Each independent rule uses $10,000 entry notional
and $32,000 reference equity. Fees are the inherited 0.055% per actual
executed notional each side; stress adds 5bps per side on the fixed path.
Results are **before funding** and do not certify live latency, liquidity,
liquidation, maker fills or shared-account exposure. They are not incremental
PnL from the Martingale ladder.

The defensive exposure-scaled parent is an **ex-post diagnostic**, not a
causal deployable rule: scale the parent's entire minute PnL path by the
combination/parent exposure-hour ratio and recompute drawdown. Do not multiply
the old drawdown percentage or treat fewer trades alone as selection skill.

## Validation and logical counts

- 32 new definitions x two windows x two delays = 128 combination cases.
- Eight parents, six existing component controls and two clocks = 64 repeated
  cases. All reproduce archived ledgers, statistics and monthlies before variants.
- The 56 non-clock cases also reproduce the new all-true combination engine.
- 128 logical readiness-only cases verify whether missing context selects
  trades. All relevant crossings were ready, so these controls exactly equal
  their parents and are deduplicated in the runner. No missing-data benefit.
- Total: **192 primary plus 128 readiness cases = 320 logical verified cases**,
  not 320 independent strategy hypotheses or independent samples.
- 32 actual-data feature/opportunity/condition prefix checks and 32 complete
  strategy-path prefix checks, plus 14 focused fixture groups.
- Independent formula/opportunity/gate reconstruction, minute accounting and
  research screens verify 37,253 trade rows, 75,062 crossing rows and 3,200
  monthly rows, including overlapping cases and repeated controls.

`validation.json` is written by the runner and retains its generation-time
`independentVerificationPending: true`. The separately added, hash-bound
`verification.json` with `passed: true` is the final acceptance evidence.
Do not rewrite either accepted record to consolidate status.

## Where to find each result

| Artifact | Purpose |
|---|---|
| `manifest.json`, `inputs/` | Exact card, source/artifact hashes, snapshot recovery and data provenance |
| `results.json`, `summary.csv` | Every rule/control/window/delay, net, wins/losses, drawdown, fees and cutoff inventory |
| `trades.jsonl`, `decisions.jsonl` | Complete trade paths and available-time trigger/condition/skip evidence |
| `monthly.json`, `monthly.csv` | Realized and marked-equity monthly comparisons, not just exit-month profit |
| `diagnostics.json` | Avoided losses, missed winners, newly enabled paths, MAE, concentration and scaled-parent comparison |
| `ranking.json`, `shortlist.json` | All 32 frozen screen results, explicit failures and empty profit/defensive selections |
| `availability-controls.json`, `overlap-parity.json` | Readiness-only equivalence and archived baseline parity |
| `causal-traces.json`, `signal-overlaps.json` | Inspectable source timing and overlap/redundancy |
| `validation.json`, `verification.json` | Generation checks and independent final acceptance |

Implementation: `indicator-combination-engine.ts` owns pure state/gating;
`indicator-combination-features.ts` adapts validated features and exact parent
engines; `indicator-combination-analysis.ts` handles risk/attribution/screens.
The `reference` and `results-check` files independently reconstruct evidence.
`hype-indicator-combinations-study.ts` orchestrates the local frozen run.

Do not sum full/recent or different-rule results as portfolio profit. No live
owner, configuration or strategy source was changed. Further thresholds,
objectives, HL/S/R conditions or ladder applications require their own bounded
study card; this pass does not authorize an automatic refinement grid.
