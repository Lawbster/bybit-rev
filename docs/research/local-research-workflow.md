# Local research workflow and RR01

September 10, 2026. Local research only. This is not a VPS service, an autonomous
optimizer or a trading deployment tool. Nothing here changes the live ladder,
short owner, maker TP, signal files, PM2, sizing or risk gates.

## Workflow

1. Write a study card under `research-inputs/` before looking at its outcomes.
2. Run its focused tests.
3. `plan` fingerprints the card's inputs, worker sources, runtime and dependencies.
4. `run` explicitly executes a single allowlisted worker. Repeated identical work
   is rejected. Source/data changes require a new plan.
5. Check artifact integrity, independent validation and the baseline-adjacent
   findings. Infrastructure completion never promotes a strategy.

```powershell
npm run test:research-workflow
npm run research:workflow -- plan research-inputs/relative-reversion-2026-09-10.json
# Copy the full key printed by plan:
npm run research:workflow -- run KEY
npx ts-node scripts/relative-reversion-verify.ts KEY
npm run research:workflow -- verify KEY
npm run research:workflow -- status

# Separately, the frozen F06 economics refresh:
npm run research:workflow -- plan research-inputs/frozen-scorecard-2026-09-10.json
npm run research:workflow -- run KEY
npm run research:workflow -- verify KEY
```

Use the same commands on a local WSL/Linux research checkout. Do not run them on
the trading VPS. Large data and output files remain ignored by git; source,
cards and findings belong in version control. Do not sync new data while a job
is running: pre/post hashes intentionally invalidate a run if an input changes.

## What is recorded

`backtests/research-workflow/<full-key>/` contains:

- `plan.json`: frozen definition, input/source SHA-256 and sizes, Node/platform,
  protected live-file fingerprints, creation time and identity.
- `state.json`: planned/running/failed/complete, PID, errors and output hashes.
- `run-claimed/`: exclusive claim, retained after completion/failure/hard kill.
- `output/`: immutable worker outputs. Partial failed output remains evidence,
  never an accepted result.
- `verification.json`: where applicable, independent RR01 arithmetic/join check.

The **definition ID** describes the fixed measurement/policy family; changing
the date window or data snapshot does not create another trading definition.
The **job key** additionally includes exact window, data, sources and runtime.
Renaming a card cannot rerun the same job. Node/runtime changes create a distinct
reproducibility job, not independent trading evidence. Existing studies have
their own correlated trial histories; this tool does not retroactively claim
that they were clean holdouts or reset their trial count.

This first version deliberately has no automatic retry, scheduler or stale-lock
takeover. An interrupted job remains claimed. Inspect its state, PID and partial
artifacts before preparing a reviewed revision/new snapshot. Do not delete a
claim to bypass an active worker. `status` is a saved lifecycle view, not proof
that a stored PID remains alive. `verify` checks recorded output hashes, not
statistical validity or live deployability.

Atomic state files use a same-directory temporary file, fsync and rename. This
protects against half-written JSON/process interruption; it is not a database
or a guarantee against all filesystem/power-loss failures. Existing ancestor
junctions/symlinks are checked for workspace escape. The runner executes trusted
local code, not arbitrary commands from a JSON card; it is not an OS sandbox.

## Allowlisted workers

L15 uses its own explicit `scripts/hype-age10-gate-study.ts plan/run` runner
with the existing `ladder-combination-v1` immutable kind. Three new10h/high
gate compositions,24 exact L14 controls and46 total runs; no engine/live edits.
[Method](age10-gate-factorial-l15.md) and
[findings](../../research/codex-astra-age10-gate-factorial-findings-2026-09-11.md).
Use `scripts/age10-gate-verify.ts KEY` for independent economic/source timing
verification. Generic workflow `verify` checks artifact integrity only;
generic `run` is not this worker's dispatcher. Extra-entry cohort outcomes
are attribution, not marginal causal profits or automatically selected rules.

Fourth worker: `recovery-construction-v1` runs the frozen RR03 trajectory
diagnostic and L10's six construction policies. It requires six exact current
baseline controls before variants and uses existing observation/veto hooks;
no canonical-engine or live-policy edit. See the
[RR03/L10 method](recovery-construction-rr03-l10.md) and
[economic findings](../../research/codex-astra-ladder-construction-findings-2026-09-10.md).
Use `scripts/recovery-construction-verify.ts KEY` for independent validation;
the registry's `verify` alone still means artifact integrity, not qualification.

September10 addition: a third allowlisted worker, `market-proxy-comparison-v1`,
compares SOL and BTC on matched source/training samples. It uses the same RR01
relative/persistence implementation and a fixed next-hour forecast diagnostic;
it never runs orders or a new strategy. See the
[RR02 findings](../../research/codex-astra-sol-btc-comparison-findings-2026-09-10.md).

```powershell
npx ts-node scripts/market-proxy-tests.ts
npm run research:workflow -- plan research-inputs/market-proxy-comparison-2026-09-10.json
npm run research:workflow -- run KEY
npx ts-node scripts/market-proxy-verify.ts KEY
npm run research:workflow -- verify KEY
```

| Worker | New definitions | Output meaning |
|---|---:|---|
| `relative-reversion-v1` | 0 trading definitions; 2 diagnostic families | Fixed BTC-relative strength and descriptive persistence; market outcomes and existing F01 ladder landmarks |
| `frozen-soft-stale-scorecard-v1` | 0 | Six exact archived controls, then six extended current-stack paths: B17, age8, no-soft-stale, each under two TP assumptions |
| `market-proxy-comparison-v1` | 0 | Matched BTC/SOL co-movement, causal next-hour prediction checks and unchanged pressure landmarks; no economic strategy replay |

The F06 worker reuses the current causal engine and the previously tested age8
controller. It must reproduce archived digests **and** metrics **and** independent
inventory accounting before running any extension. It retains the same $32,000
flat start and accumulated inventory; it does not restart flat on the tail.
Baseline and candidates use unchanged 0.055% fees each side. No modeled maker
fee bonus, actual funding settlement, exchange margin/liquidation or joint
short-account claims. Original older-window/monthly failures remain binding.

The refresh inherits original dependencies, requiring unchanged algorithm and
config hashes. Synced `data/` and copied `bot-state.json` get fresh fingerprints;
the latter is protected but not used to seed simulated inventory. A code change
requires an explicit parity review/bridge, not silently accepting a new baseline.

## RR01 timing and missing data

- Asset/market input is symbol-parameterized; the initial card is HYPE/BTC. The
  F01 pressure adapter and the F06 economics worker are HYPE-specific, not a
  claim that another pair has a certified ladder baseline.
- Aggregate a 1h bar only when **all 60 closed minutes** exist. Historical
  archive then collector last-row-wins matches canonical precedence; conflicts
  and revisions are counted. Raw files are never overwritten.
- Apply the existing verified HYPE repair bundle. BTC gaps remain explicit;
  neither interpolation nor multi-hour returns across missing hours are allowed.
- Regress 168 past hourly log-return pairs, at least160 valid pairs. Each pair
  needs both adjacent complete hours for both assets. One missing training hour
  excludes both adjacent returns, not only one. Latest evaluation needs five
  complete paired closes for the1h/4h returns.
- Fit ends **four hours before** the latest available completed hour. No part
  of the evaluated return is included in its own regression.
- 0/60s modeled publication delays use the same decision clock. At an exact
  hour boundary,60s uses the preceding available hour. This is availability
  sensitivity, not proof of original collector receipt.
- Corrected exchange history and retrospective collector revisions are not
  contemporaneous evidence. No untouched holdout is claimed.

Persistence uses the same past-fitted beta, detrends the past log spread, then
fits AR(1) on consecutive hourly residuals. It reports a descriptive half-life
only for positive phi inside(0,1), with its conventional OLS interval inside the
same range. The interval is a fragility screen, **not calibrated confidence**:
estimated beta, fitted trend, overlapping rolling samples and repeated research
all matter. This is **not a cointegration or stationarity test**. In particular,
detrending can manufacture apparent reversion; never interpret a10h estimate
as a promise that the current trade will recover in10h.

## Output and validation boundaries

Sixth worker: `near-high-extension-v1` extends L11 to 2/3/4/5/6-day highs
and tests one fixed BTC-strength exception to experimental deep-add vetoes.
36 new definitions, 222 fresh economic executions including six exact controls;
existing raw 1/7/30-day peers are reused, not recounted. Closed-minute BTC
coverage is strict, gaps prohibit leniency, and existing BTC risk gates stay
unchanged. [Frozen method](near-high-btc-extension-l12.md).
`near-high-extension-verify.ts` independently checks HYPE/BTC maxima, all
raw/effective permissions, missingness, exact source/ROC timing, occupied
exit decisions, cooldowns and economic accounting. It does not authorize live
changes; full/monthly screening and source-delay sensitivity remain mandatory.

Fifth worker: `near-high-ladder-v1` evaluates L11's12 frozen location-only
deep-add blocks/stale full exits. Six exact L10 B17 controls,48 primary runs
and24 recent source60 repetitions; no strategy combinations or production
changes. It pins the same data/cutoff instead of silently incorporating later
intraday prices. [Method](near-high-ladder-l11.md) and
[findings](../../research/codex-astra-near-high-ladder-findings-2026-09-10.md).
`near-high-verify.ts` independently recomputes every high via block-prefix/suffix
maxima and validates all add/occupied-exit decisions, cooldowns and ledgers.

RR01 writes features separately from forward labels. Its fixed4h market grid
uses next-minute-open-to12h-close returns and post-decision high/low only; those
overlapping12h observations are not independent trades or portfolio returns.
The last incomplete horizons stay censored.

Primary ladder landmarks are the existing F01 depth>=9, first-3% drawdown +60m
cohort, with both TP paths kept separate. Losing **and** recovering episodes are
retained. Existing censored outcome labels are not silently resolved from newer
prices. Dollar columns describe continuation on an unchanged path; exiting
would alter inventory, later adds and replacement episodes, so these are not
earnings of a filtered strategy.

`relative-reversion-verify.ts` independently aggregates hourly closes and uses
normal-equation arithmetic for beta/AR, checks every feature clock, recomputes
forward labels and joins original landmark outcomes. It shares the validated
minute loader/repair rather than pretending two implementations are entirely
independent. Synthetic tests additionally poison future bars, change evaluated
returns, check incomplete minutes/constant prices, and compare prefix results.

Next economic overlays require a separate frozen card, exact B17 controls, full
occupancy replay, monthly W/L dollars and DD, both TP assumptions and appropriate
delay/cost sensitivity. The human register remains [TESTED-SETUPS](../../research/TESTED-SETUPS.md);
this MVP does not replace every legacy study or calculate a deflated Sharpe.

### L13 combination worker

L13 uses the same pinned one-shot job lifecycle through its explicit entrypoint:
`npx ts-node scripts/hype-ladder-combination-study.ts plan research-inputs/winning-ladder-combinations-2026-09-11.json`,
then `... run KEY`. Use this entrypoint, not the generic older worker dispatcher.
Eight pairs,28 exact archived controls,86 fresh runs; no engine/live changes.
The final independent checker is `ladder-combination-review.ts KEY`, with
separately hashed audit-only refinements for post-arm research closes and
same-price pro-rata rearming. The initial pinned verifier is retained as the
original record, not the final acceptance checker. See the
[L13 method](winning-ladder-combinations-l13.md) and
[findings](../../research/codex-astra-winning-ladder-combinations-findings-2026-09-11.md).

### L14 age/high refinement worker

L14 reuses the immutable `ladder-combination-v1` workflow kind with its own
validated definition and explicit runner; it does not modify L13 or production.
`npx ts-node scripts/hype-age-high-refinement-study.ts plan research-inputs/age-high-refinement-2026-09-11.json`,
then `... run KEY`; independent checker:
`npx ts-node scripts/age-high-refinement-verify.ts KEY`.
Read-only tables: `npx ts-node scripts/age-high-refinement-report.ts KEY`.
The frozen plan has24 new variants,20 exact controls,4 refreshed singles,
96 primary variant cases and50 delayed-high-source cases:170 executions.
Use this runner rather than the generic workflow dispatcher. See the
[L14 method](age-high-refinement-l14.md) for parameters, controls and limits.
