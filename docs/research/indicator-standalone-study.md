# Indicator stages 1-2: validated math and standalone trades

September 5, 2026. Completed locally. **No live changes, no ladder policy change,
no combined indicator/pulse/S/R strategy test, no deployment approval.**

Read the [findings](../../research/codex-astra-indicator-standalone-findings-2026-09-05.md)
for baseline/variant dollar results and monthly comparisons. The
[frozen study card](../../research-inputs/indicators/standalone-2026-09-05.json)
is the exact parameter and experiment inventory; do not infer rules from names.

Subsequent user-approved [I02 CRSI expansion](crsi-extremes-study.md) returns to
standalone stage2 with15m/30m/1h and mirrored80/90/95 extremes. I01's single
1h recross20/80 test is not a rejection of the entire CRSI family. The old I01
engine, formula and study-card source remain pinned unchanged; I02 reproduces
the overlap before adding34 new definitions.

## Math and engineering boundaries

- [indicator-features.ts](../../src/research/indicator-features.ts): seven
  families/ten numeric fields, unrounded, pair-neutral fixed UTC bars. RSI14,
  CRSI(3,2,prior100), ROC5, ATR14/ATR%, ADX14/+DI/-DI, actual-turnover UTC daily
  VWAP, current volume/prior20 mean volume. No trading or filesystem imports.
- [indicator-feature-tests.ts](../../scripts/indicator-feature-tests.ts): 12
  independent test groups. Hand fixtures, explicit weighted-decay references,
  installed library cross-checks for RSI/ATR/ADX, gaps/invalid data and prefix
  invariance on five timeframes. A separate agent wrote these tests without
  reusing the implementation's internal helpers.
- [closed-bars.ts](../../src/research/closed-bars.ts): complete source coverage
  and availability. Study uses repaired 1m candles, aggregated into complete
  hours, fixed seed June 1 2025 and explicitly modeled zero publication lag.
  Real final-receipt timing is not reconstructed from repaired history.
- [standalone engine](../../scripts/indicator-standalone-engine.ts): one
  fixed-notional long OR short per independent case; next-open market execution,
  delayed execution sensitivity, fees, timeout/indicator exits and marked equity.
  It is not the Martingale replay, short live owner, or shared-account simulator.
- [engine tests](../../scripts/indicator-standalone-tests.ts): 17 independent
  groups covering timing, trigger identity, fixed sizing, pending/cutoff handling,
  long/short fees and cross-month accounting.
- [runner](../../scripts/hype-indicator-standalone-study.ts): refuses an existing
  output directory, pins source/input hashes, reuses the canonical candle loader
  and repair, verifies actual volume/turnover before VWAP, and checks actual-data
  feature/execution prefixes. No executor or signal-file path is called.
- [independent artifact verifier](../../scripts/indicator-standalone-results-check.ts):
  does not call the signal engine. Rebuilds trade costs, execution prices and
  month-end equity from ledgers and repaired candles; rechecks source/input hashes.

The new formulas are not silent fixes to existing gates. In particular, live
CRSI uses a different return-rank window and rounding, while existing volume
ratio includes the current bar in its average. Research flat RSI is 50;
flat CRSI is 33 1/3 because strict-less return rank is zero. Formula choices and
zero/warmup behaviour are explicit in `RESEARCH_FEATURE_METADATA`. Passing these
checks validates these definitions, not every implementation called "CRSI".

## Exact experiment size

Four entry families x two sides x two exit policies = **16 strategy definitions**.
Two same-direction rolling-clock controls are additional. Two overlapping
windows x two execution delays yield **64 strategy + 8 control cases**.
Cash and long buy-and-hold are separately labeled context, not matched-risk
controls. Descriptive response and ATR/ADX/RVOL strata are not extra trade rules.

The clock baseline starts at the next 00:00/12:00 UTC boundary and thereafter
rolls into another trade after closing, with the same execution delay. Before
results, independent review caught that a strictly twice-daily entry schedule
would skip alternate trades under a one-minute delay. The frozen card records
the pre-run amendment. Signal thresholds were not changed after results.

These cases are **new research hypotheses**, not a re-run of the older short
owner or L01-L06 ladder variants. The May 1 indicator/pulse study is acknowledged
in the [inventory](../../research/TESTED-SETUPS.md), but used a different mined
6.5-day sample, formulas, signals and execution model. No past result is called
current-stack validation merely because an indicator name overlaps.

## Reproduction

Run locally from the repo root, with the pinned synced archives and verified
repair artifact. Do not sync inputs or edit study sources during a run.

```powershell
npm.cmd run test:closed-indicator-timing
npm.cmd run test:indicator-features
npm.cmd run test:indicator-standalone
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false

# Explicit fresh output; refuses overwriting existing evidence.
node --max-old-space-size=6144 -r ts-node/register scripts/hype-indicator-standalone-study.ts --out backtests/hype/indicator-standalone-review-rerun
node --max-old-space-size=6144 -r ts-node/register scripts/indicator-standalone-results-check.ts backtests/hype/indicator-standalone-review-rerun
```

Accepted evidence directory:
`backtests/hype/hype-indicator-standalone-2026-09-05/`.
`manifest.json`, `validation.json` and independent `verification.json` must
agree. Partial files after a failed run are not certified results.
`summary.csv`, `results.json`, `monthly.csv`/`monthly.json`, `trades.jsonl`,
`responses.csv`, `response-events.jsonl`, `strata.csv`, `ranking.json` and
`context-controls.json` preserve the full breakdown locally. Re-running the
independent verifier refuses to overwrite its prior verification artifact.

Winning/losing dollar totals already include entry/exit trading fees. Monthly
closed totals attribute a whole trade to its exit month, while monthly marked
equity includes floating inventory and entry fees when incurred. They are
different views; never subtract reported fees again. Open-end inventory reserves
a hypothetical close fee; `feesPaid` does not pretend that fee was paid.
Adverse drawdown is prior close-equity peak to minute adverse price, not an
inferred within-minute high-to-low trajectory. Funding, liquidation, actual
maker/native fills and collector outages are not certified by this model.

## How to progress through stages 3-5

1. **Stages 1-2 completed:** verified definitions and simple individual-signal
   evidence. None passed the predeclared standalone screen; keep failed rule IDs
   in the ledger so a future agent does not re-discover the same naive triggers.
2. **Stage 3 completed subsequently:** [individual rung-11 indicators](ladder-single-indicator-study.md)
   join exact baseline deep-add encounters and test four separate vetoes across
   the four reproduced corrected-clock canonical baselines. None passed the
   complete screens. [Findings](../../research/codex-astra-ladder-single-indicator-findings-2026-09-05.md)
   separate loss savings from missed recovery income. Standalone PnL is not the
   gatekeeper for every risk-management use, but a failed standalone rule is
   not justification for unlimited conditional mining.
3. **Stage 4, not run:** only a small complementary indicator combination after
   individual effects are understood. Retain each component alone and count all
   attempted rules, including failures. Do not optimize thresholds on recent
   winners and present the same period as validation.
4. **Stage 5, not run:** add HL and known S/R context last, on quality-verified
   overlapping availability windows. Use indicator-only, pulse-only, S/R-only
   and the specified combinations as controls. Preserve longer candle controls
   separately and require new forward observations before any live proposal.

Agent use should preserve independent checks, not multiply the parameter search:
one bounded implementation owner, one independent math/execution reviewer, and
one owner for study definition/results synthesis. No agent may launch extra
families or change thresholds after seeing results. Research remains local.
