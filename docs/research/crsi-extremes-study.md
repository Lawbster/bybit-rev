# CRSI standalone extremes: I02

September 5, 2026. Research-only return to stage 2 after the user correctly
pointed out that I01's single 1h recross 20/80 pair does not exhaust CRSI.
No live/config, ladder, short-owner or indicator-formula changes.

## Exact frozen scope

[Study card](../../research-inputs/indicators/crsi-extremes-2026-09-05.json):
15m/30m/1h x upper 80/90/95 (lower 20/10/5) x long/short x into/back-out
= **36 rules**. Two repeat I01's 1h80 back-out controls; 34 are new.
Two overlapping windows x zero/+1m delay =144 strategy cases +8 clock cases.
No TP/SL, holding-period, sizing, additional timeframe or indicator sweep.

- Into extreme: long previous>L and current<=L; short previous<U and current>=U.
- Back out: long previous<=L and current>L; short previous>=U and current<U.
- L=100-U. Boundaries are inclusive inside an extreme; moving back outside is
  strict. This is a crossing, not an entry every bar while the level stays hot.
- Complete adjacent UTC bars only; ignore occupied/pending crossings rather
  than queue them. No entry at window start merely because already extreme.
- Fixed $10k notional, $32k equity, one position per independent case; timeout
  12h after actual fill, plus declared exit delay. Both actions use subsequent
  minute opens. No compounding, averaging, wick targeting or indicator exits.
- 0.055% modeled fee per actual entry/exit notional; additionally report +5 bps
  each side on the fixed executed path. Incomplete funding is excluded.

Full window: 2025-07-01 00:00 to 2026-09-04 19:01 UTC.
Recent: 2026-05-17 20:43 to the same cutoff. Seed: June 1, 2025.
All history previously examined; windows overlap and must not be added.

Baseline is the **same-side rolling 12h clock**, not the live ladder. It starts
at the next 00/12 UTC and rolls after each close; the delay does not silently
halve its entry cadence. Cash and long buy-and-hold are separate contextual
controls, not matched-frequency/exposure controls. Improving on a losing short
clock is not the same as positive profit. Report actual net, counts, exposure
and monthly comparisons as well as deltas.

## Engineering and audit trail

- [New engine](../../scripts/crsi-extremes-engine.ts): additive explicit
  timeframe/crossing adapter with I01 minute accounting. Old pinned
  `indicator-standalone-engine.ts` stays byte-for-byte intact. No trick of
  relabeling timestamps or replacing CRSI values to force old triggers.
- [Validated features](../../src/research/indicator-features.ts): unchanged
  research CRSI(3,2,prior 100), unrounded; not legacy live CRSI. Prior independent
  formula tests remain relevant on all selected timeframes.
- [Runner](../../scripts/hype-crsi-extremes-study.ts): pins original I01 inputs,
  verified artifacts and source files; regenerates all 16 overlapping cases
  before new-grid results. Stats, monthly rows and full ledgers must match old
  engine AND accepted saved evidence exactly. Prefix checks on every rule and
  each timeframe detect future-append dependence.
- [Independent tests](../../scripts/crsi-extremes-tests.ts) and
  [artifact verifier](../../scripts/crsi-extremes-results-check.ts) cover boundary
  crossings, clocks, sizing, fees, pending/cutoff handling and regenerated
  signal/accounting evidence. Read generated verification.json for exact scope.

Complete-bar timing models zero historical publication lag; +1m delays are
sensitivity tests, not actual historical arrival records. Repaired candles
cannot certify the bot had those bars during an outage. Funding, liquidation,
queue fills, bid/ask spread paths and actual orders are not reconstructed.
This is a controlled standalone research diagnostic, not deployment approval.

## Reproduction (local only)

Keep sources and data unchanged during a run. Do not add a PM 2 service.

```powershell
npm.cmd run test:closed-indicator-timing
npm.cmd run test:indicator-features
npm.cmd run test:indicator-standalone
npx.cmd ts-node scripts/crsi-extremes-tests.ts
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false

# Use a NEW evidence directory; no overwriting accepted or failed-run artifacts.
node --max-old-space-size=6144 -r ts-node/register scripts/hype-crsi-extremes-study.ts --out backtests/hype/crsi-extremes-review-rerun
node --max-old-space-size=6144 -r ts-node/register scripts/crsi-extremes-results-check.ts backtests/hype/crsi-extremes-review-rerun
```

Default evidence: `backtests/hype/hype-crsi-extremes-2026-09-05/`.
Only a directory with complete validation and passing independent verification
counts as accepted. `summary.csv`/`results.json`, `monthly.csv`/`monthly.json`,
`trades.jsonl`, `ranking.json`, `causal-traces.json`, `context-controls.json`,
`overlap-parity.json` and provenance retain every tested rule, not only winners.

The unchanged I01 strict screen is intentionally demanding: positive net and
side-clock improvement both windows/delays, every monthly delta nonnegative,
minimum 30/10 completed trades, positive extra-cost stress and solvent equity.
Failure of this complete screen is **not proof CRSI is useless**. Findings must
separate insufficient evidence, positive but unstable results, profitable rules
that lag exposure-heavy controls, and genuinely losing tested definitions.
No automatic next parameter sweep or live promotion follows this pass.
