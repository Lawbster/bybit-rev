# C02/T01 entry-context research: reproduction and artifacts

September 7, 2026. Research-only code, not an operational bot service.
Run locally; never start these sweeps under PM2 or on the live VPS.

## Accepted studies

| Study | New definitions | Primary cases | Logical readiness cases | Total verified |
|---|---:|---:|---:|---:|
| C02: eight parents x four hourly conditions | 32 | 168 | 128 | 296 |
| T01: two parents x six UTC exclusions | 12 | 64 | 48 | 112 |

C02 reproduced 40 archived cases and 32 all-true engine cases; T01 reproduced
16 archived cases and eight all-true engine cases before variants. Readiness
controls exactly matched their own parents and were deduplicated only after
checking equality. These counts are engineering cases, not independent samples.

- [C02 card](../../research-inputs/indicators/combinations-c02-2026-09-07.json)
  and [findings](../../research/codex-astra-indicator-combinations-c02-findings-2026-09-07.md).
- [T01 card](../../research-inputs/indicators/time-gating-t01-2026-09-07.json)
  and [findings](../../research/codex-astra-indicator-time-gating-t01-findings-2026-09-07.md).
- [Tested inventory](../../research/TESTED-SETUPS.md) and
  [retained leads](../../research/COMBINATION-CANDIDATES.md).

Both finish with zero complete profit/defensive/strict-clock qualifiers.
Retained research leads and their failures are not deployment instructions.

## Source ownership and timing

- `scripts/indicator-entry-context-features.ts`: new research adapter for the
  selected old parent engines plus hourly Q1-Q4 features. Adds required 5m
  RSI and ROC/ATR/Bollinger parent coverage without editing archived engines.
- `scripts/indicator-entry-context-policy.ts`: Q1 improving MACD histogram,
  Q2 fixed-role ADX, Q3 movement over preceding ATR, Q4 side-aligned CMF,
  and UTC0..5 fixed calendar exclusions. Explicit expected bar/previous bar,
  null/zero and source availability checks.
- `scripts/indicator-calendar-attribution.ts`: descriptive opportunity,
  occupancy, calendar coverage, signal/exit-clock PnL and exposure denominators.
- `scripts/hype-indicator-entry-context-study.ts`: frozen card selection,
  hash checks, original-input recovery, parent parity, complete replays,
  prefix tests and immutable outputs.
- `scripts/indicator-entry-context-reference.ts`: independent reference math;
  does not use the production gate/feature adapters for its calculations.
- `scripts/indicator-entry-context-results-check.ts`: independent features,
  opportunities, ledger/fees, minute DD, attribution, monthly/strict/research
  screens and T01 calendar reconstruction.
- `scripts/indicator-entry-context-tests.ts`: ten fixture groups for formulas,
  mixed clocks, prior ATR, zero/null, calendar boundaries, frozen +1m decisions,
  readiness controls, exposure conservation and future-prefix independence.

The execution/accounting engine and screen definitions remain the frozen C01
implementations. A narrow documented type adapter widens C01's condition-label
union without changing the old engine or mislabeling Q/UTC evidence as B1-B4.
Archived source files and original cards were not edited.

A decision at UTC epoch-ms t uses only the fresh closed parent crossing and
latest expected closed hourly context at t. Q1/Q3 also require the immediately
previous hour; Q3 excludes the current shock from its ATR denominator. Calendar
conditions use original signal time, not eventual fill or exit time. False
means discard, never deferred confirmation. Entries while occupied are skipped.
Both entry/exit delays are fixed per case; hold starts at actual entry.
The execution-minute H/L/C is not available at the decision.

Historical zero publication lag plus a separate +60s execution delay are
models, not evidence of the exchange's original publication timestamps.
Do not use these historical candles to claim tick-exact live parity.

## Inputs and acceptance

Full: July 1, 2025 00:00 to September 4, 2026 19:01 UTC.
Recent: May 17, 2026 20:43 to the same end, independent flat start.
Indicator seed starts June 1, 2025. Both windows are previously mined and overlap.

Exact input copies live inside each artifact directory. The original JSONL
snapshot is recovered from its hash-proven byte prefix: 23,021,958 bytes out
of the later 23,321,778-byte pull. The runner never overwrites current data to
achieve parity. Full JSON candles and the original 11-minute repair are also
hash-checked and copied. Result: 663,541 contiguous minute bars.

Prior accepted studies and their pinned source/input/artifact bundles must be
present locally. C02 depends on I01/C01/I04/I05/I07/I09 plus their inherited
dependencies; T01 depends on I01/C01 and inherited dependencies. Merely cloning
tracked source is insufficient to recreate raw tapes that intentionally remain
local. Missing or changed baselines are a hard stop, not permission to rebaseline.

The runner writes `validation.json` before the independent checker exists,
so its `independentVerificationPending: true` is historical. **Acceptance is
`verification.json.passed: true` plus matching source/input/artifact hashes.**
Do not rewrite the old validation file, which is itself hash-pinned.

## Commands, PowerShell

New output directories must not exist. These example reruns add no new rule
definitions; they reproduce the frozen cards. Do not run them casually when
the purpose is only reading existing findings.

```powershell
npx.cmd ts-node scripts/indicator-entry-context-tests.ts
npx.cmd ts-node scripts/indicator-combination-tests.ts
npx.cmd ts-node scripts/indicator-feature-tests.ts

npx.cmd ts-node scripts/hype-indicator-entry-context-study.ts --study c02 --out backtests/hype/hype-indicator-combinations-c02-local-rerun
npx.cmd ts-node scripts/indicator-entry-context-results-check.ts backtests/hype/hype-indicator-combinations-c02-local-rerun

npx.cmd ts-node scripts/hype-indicator-entry-context-study.ts --study t01 --out backtests/hype/hype-indicator-time-gating-t01-local-rerun
npx.cmd ts-node scripts/indicator-entry-context-results-check.ts backtests/hype/hype-indicator-time-gating-t01-local-rerun

npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
npx.cmd tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-indicator-entry-context-study.ts scripts/indicator-entry-context-tests.ts scripts/indicator-entry-context-results-check.ts
git diff --check
```

The checker intentionally refuses to overwrite an existing verification file.
Preserve accepted directories; a source change requires a newly labeled run,
not mutation of evidence already used to select candidates.

## Artifact map

Accepted folders under `backtests/hype/`:

- `hype-indicator-combinations-c02-2026-09-07/`
- `hype-indicator-time-gating-t01-2026-09-07/`

| File | Purpose |
|---|---|
| `manifest.json`, `inputs/` | Frozen card, source/input hashes, exact snapshot provenance and counts |
| `overlap-parity.json` | Old-engine, saved baseline and all-true engine equality |
| `results.json`, `summary.csv` | Parent, clock, variant and logical readiness cases |
| `trades.jsonl`, `decisions.jsonl` | Full ledger and every original crossing with frozen gate evidence/outcome |
| `monthly.json`, `monthly.csv` | Marked monthly PnL and exact per-case parent/readiness/clock deltas |
| `ranking.json`, `shortlist.json` | All attempted definitions and unchanged screen failures/passes |
| `diagnostics.json` | Adverse paths, concentration, ex-post scaled parent, missed winners/avoided losses/new trades |
| `signal-overlaps.json` | Shared selected entries; similar predicates are not independent confirmation |
| `availability-controls.json` | Exact readiness-only deduplication proof |
| `causal-traces.json` | One accepted and rejected example per definition where present |
| `calendar-descriptive.json/csv` | T01 only: all/month, UTC-block and separate weekday/weekend denominators |
| `validation.json`, `verification.json` | Runner assertions followed by independent final validation |

Calendar monthly signal-origin outcomes assign the whole trade to its signal
month; this is **not** the marked monthly risk ledger. Exit-clock PnL is a
separate view. Those tables answer different questions and cannot be mixed.

## Interpretation boundary

Fixed $10k notional, one position, $32k reference equity, modeled fees, before
funding. No live owners, state mutation, exchange orders or signal files.
No S01 pending confirmation, R01 refinement, HL/SR mixture or actual ladder
transfer was added. That work requires its own bounded card and approval.
Track small cards/source/findings/retained snapshots; keep large tapes and
simulation outputs local. No commit/push or deployment is part of this pass.
