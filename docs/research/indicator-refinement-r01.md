# Indicator refinement R01: reproduction and evidence

September 7, 2026. Local research only. First bounded checkpoint of refinement
→ HL/S/R → actual ladder; the latter two stages are not part of this run.

## Accepted result and pins

[Findings](../../research/codex-astra-indicator-refinement-r01-findings-2026-09-07.md)
contain all nine variants, parent and old-pair baselines, W/L dollar comparisons,
both delay models, monthlies and changed-trade attribution.
[Frozen card](../../research-inputs/indicators/refinement-r01-2026-09-07.json);
[retained snapshot](../../research-inputs/indicators/r01-retained-candidates-2026-09-07.json).

Accepted directory: `backtests/hype/hype-indicator-refinement-r01-2026-09-07/`

Manifest SHA256: `4f334952b4a5280de81dc2ed1f1d2cce853c60e925ba348ad53dfa095b02d079`

Independent verification SHA256: `8b8e9c3a9066cea62643d8ec0ebb0750bef92d43139f15cbaf45239e9670919d`

One unchanged-profit-screen survivor, R01-08; zero defensive or strict survivors.
Accepted means the historical experiment was verified, not approved for live use.
Never overwrite or edit accepted artifacts or their hash-pinned source files.

## Exact design

Three unchanged 4h entry anchors, three changes each:

- MACD12/26/9 bullish histogram crossing; old 1h UTC-day VWAP distance >0%.
  Change to >−0.25%, >+0.25%, or 30m >0%.
- MACD12/26/9 bearish histogram crossing; old 1h absolute close change divided
  by preceding ATR14 ≤1. Change to ≤0.75, ≤1.25, or 30m ≤1.
- Bollinger20/2 downside crossing, previous %B≥0/current %B<0; old 1h CMF20<0.
  Change to <+0.05, <−0.05, or 30m CMF20<0.

Only one context axis changes per rule. No hold change, calendar filter,
indicator-period grid, HL/SR condition, ladder action or sizing experiment.

Use the copied T02 repaired tape, not a new data pull. Seed June 1, 2025;
full July 1, 2025 and recent May 17, 2026 20:43 UTC, both through September 4,
2026 19:01 UTC. There are 663,541 continuous seed-plus-window minute bars.
One $10k fixed-notional position /$32k reference equity, 12h timeout, 0.055%
fees per side and extra 5bps per side same-path cost stress, before funding.

## Causality and control rules

The original A crossing is known at its completed source end. Context expected
end is `floor(signalAt / contextTf) * contextTf`. Missing expected rows fail
closed; no stale-bar substitution. Source interval, feature timestamp and
availability must match and availability must be no later than the decision.
For the shock veto, both adjacent completed bars are required and ATR comes
from the preceding bar. A zero denominator is unavailable, not a passing shock.
VWAP's day anchor is the source bar's day, including at midnight.

Rejected crossings are discarded, never held until the context improves.
Pending/open inventory skips later crossings. With +1m delay, entry and exit
each receive one minute; the 12h timeout starts at actual fill. Evidence remains
frozen from the original signal. At cutoff, any open exposure would be marked
with the final close and hypothetical exit fee; no selected R01 path is open.

Every case is re-simulated with occupancy from scratch. The old C01-20 /
C02-27 /C02-32 pairs and unfiltered parents must match their archived ledgers
before new variants run. Original independent same-side clocks remain present.
All 48 pair-readiness controls are actually run; their trades and statistics
equal the unfiltered parents. They are duplicated verification paths, not
additional independent economic evidence.

## Source responsibilities

| File | Responsibility |
|---|---|
| `scripts/indicator-refinement-policy.ts` | Pure exact-source context gate and explicit comparisons |
| `scripts/indicator-refinement-tests.ts` | Threshold, mixed-clock, missing/late source, null/zero, midnight, discard and timing fixtures |
| `scripts/hype-indicator-refinement-study.ts` | Card/source/artifact pins, archive parity, bounded replay, prefix comparisons, publication |
| `scripts/indicator-refinement-results-check.ts` | Independent reference formulas, crossings, context, occupancy, fills, fees, DD, monthlies, attribution and screens |
| `scripts/indicator-entry-context-features.ts` | Unchanged validated feature/opportunity adapter |
| `scripts/indicator-entry-context-reference.ts` | Separate established batch reference implementation used by checker |
| `scripts/indicator-entry-context-policy.ts` | Unchanged entry-context replay wrapper |
| `scripts/indicator-combination-engine.ts` | Unchanged standalone scheduling/account marking |
| `scripts/indicator-combination-analysis.ts` | Unchanged diagnostics, trade attribution and acceptance screens |

The checker does not import the new gate, runner or economic engine. It imports
the independent reference implementation and the shared raw candle loader.
This is independent implementation checking, not independent market evidence.

## Reproduction, local PowerShell only

```powershell
npx.cmd ts-node scripts/indicator-refinement-tests.ts
npx.cmd ts-node scripts/indicator-entry-context-tests.ts
npx.cmd ts-node scripts/indicator-combination-tests.ts

# A new directory is required. Accepted artifacts are immutable.
npx.cmd ts-node scripts/hype-indicator-refinement-study.ts --out backtests/hype/hype-indicator-refinement-r01-2026-09-07-rerun
npx.cmd ts-node scripts/indicator-refinement-results-check.ts backtests/hype/hype-indicator-refinement-r01-2026-09-07-rerun

# Explicitly type-check these research files, beyond application tsconfig coverage.
npx.cmd tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-indicator-refinement-study.ts scripts/indicator-refinement-results-check.ts scripts/indicator-refinement-tests.ts
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
git diff --check
```

These commands do not submit orders, call PM2, edit live config/state, use API
credentials, or write signal files. Run on the research machine, not the VPS.
A changed source or input hash is an intentional preflight failure; create a
new documented snapshot/card instead of bypassing it.

The original accepted run and verifier passed on their first economic attempt.
The publication-time `validation.json` deliberately says independent
verification is pending; the subsequently written `verification.json`
with `passed:true` is the authoritative acceptance record. A missing record
means do not accept the experiment.

## Artifacts and keys

| Artifact | Meaning |
|---|---|
| `manifest.json` | Frozen definition, source/input pins, protected live-file hashes, runtime and prefix counts |
| `inputs/` | Copied accepted T02 price/history/repair inputs; not HL/SR enrichment |
| `results.json`, `summary.csv` | Parent/pair/refinement/clock/readiness metrics including W/L, net, fees, stress and DD |
| `trades.jsonl` | Exact fills and completed-trade PnL, keyed by id/window/delay |
| `decisions.jsonl` | Every original crossing, source features, context gate and occupied/missing/rejected/accepted outcome |
| `monthly.json/csv` | Marked net, completed-trade W/L, fees and deltas versus unfiltered/readiness/original/clock |
| `trade-attribution.json` | Common, removed and newly enabled trade bridges versus both parent and original pair |
| `diagnostics.json` | Adverse paths, worst exposure, winning concentration and ex-post scaled-parent controls |
| `overlap-parity.json` | 32 exact archived comparisons |
| `availability-controls.json` | 48 readiness-path equality records |
| `ranking.json`, `shortlist.json` | All 12 pair versions and unchanged failure flags; nine are new |
| `verification.json` | Independent audit counts and artifact hashes |

All event times are UTC epoch milliseconds. `signalAt` defines exact common
trade identity within one window and delay. Common trades must have the same
fills and PnL; removed/new PnL plus any open-mark difference reconciles to the
net difference. Attribution is descriptive and never feeds back into selection.

68 primary cases = (9 new +3 old pairs +3 parents +2 clocks) ×4.
Adding 48 readiness logical cases makes116. Twelve real-data prefix comparisons,
32 archived comparisons, 9,558 completed ledger rows, 5,688 decisions, 1,160
monthly rows and96 attribution comparisons passed. These repeated overlapping
rows do not increase the underlying trade sample.

Nine new definitions raise the inventory to **5,253 standalone /45 ladder**.
The complete unchanged screen is in the frozen card and findings. R01-08 passes
profit only, remains concentrated and fails the full defensive/clock screens.
[Next-stage handoff](indicator-hl-sr-ladder-path-2026-09-07.md) preserves that boundary.
