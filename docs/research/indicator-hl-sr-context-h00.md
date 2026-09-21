# H00 HL/S/R context checkpoint: method and reproduction

September 7, 2026. Research-only, coverage-first attachment around frozen
R01-08 and its original Bollinger/old-CMF baselines. No new strategy predicates
or live changes. [Findings](../../research/codex-astra-indicator-hl-sr-context-h00-findings-2026-09-07.md)
and [curated evidence](../../research-inputs/indicators/h00-context-summary-2026-09-07.json).

## Entry points

| File | Responsibility |
|---|---|
| `research-inputs/indicators/context-h00-2026-09-07.json` | Frozen rule IDs, R01 hashes, cutoff, source list, coverage thresholds and descriptive bins |
| `scripts/indicator-hl-sr-context.ts` | Pure as-of context/quality calculations, S/R annotations, descriptive join |
| `scripts/hype-indicator-hl-sr-context-study.ts` | Verify R01, reproduce six recent baselines, scan/pin sources, build immutable bundle |
| `scripts/indicator-hl-sr-context-check.ts` | Separate raw-source selection/math, S/R geometry and artifact checker |
| `scripts/indicator-hl-sr-context-tests.ts` | Synthetic causality/quality/unit regressions |
| `scripts/replay-market-inputs.ts`, `scripts/replay-sr-context.ts` | Existing availability semantics and current confirmed-prefix S/R builder, reused without modification |

Local accepted directory:
`backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-v2/`.

Accepted manifest SHA256:
`49e331b3ef94843a3cdf576c4a5e8f92be1374dc2e4a589e2a32d07f2cb57def`

Accepted independent verification SHA256:
`d9b80d906fd24ae5bb870db76d7c1955e6b26a29593d396208822e5de38fad40`

Both pins are also in the curated JSON. Large raw evidence/backtest files stay
local and ignored; selected card, summary, findings and code are eligible for
version control. No commit/push is included in this research request.

## Contract

**May 17, 2026 20:43 → September 4, 2026 19:01 UTC**, using the exact repaired
R01 candle snapshot. All14 original4h Bollinger opportunities are included,
even if CMF rejected them or a position was occupied. Three rules ×two delays
yield84 archived decisions and72 overlapping archived trade rows. There are
only13/12/11 completed trades per rule per delay, not72 independent trades.

Each opportunity has three pulse observations: T−15m, T−5m and T. Evidence
selection is always as-of the respective observation, not as-of final cutoff.
No context condition is used to alter entries, sizing, holds or exits.
The full-history background in `baseline.json` comes from accepted R01;
only its six rich-window baseline cases are reproduced in this checkpoint.

### Source/time model

All timing fields are UTC epoch milliseconds:

- `sourceAt`: end of the source interval or source sample clock.
- `availableAt`: receipt-aware maximum where metadata exists; otherwise the
  existing replay model (legacy taker end+1m, snapshot sample-time proxy).
- `eligibleAt`: next eligible UTC minute boundary.
- Raw source identity is filename plus physical line; selected excerpts keep
  that identity and original row rather than only a derived feature value.

All historical taker rows used here lack receipt metadata and use modeled
publication. Book/asset observations also lack proven receipt and use their
sample-time proxy. `historicalArrivalProven=false` is deliberate.
Closed-bar correctness does **not** repair missing old collector receipt times.
A later economic card needs source-lag sensitivity; +1m order-fill sensitivity
alone does not test delayed delivery of pulse messages.

The runner scans and hashes all three files, inventories the complete frozen
window, and retains rows whose eligibility falls within signal−8h−15m through
signal+1m. Extra +1m rows are future guards, never visible at T. Full-file
hashes and before/after source size/mtime guards prevent silently changing
source contents during a run.

Global gap counts describe minutes with a **newly eligible** sample. They are
not interchangeable with rolling-feature readiness. The latter is separately
computed at each actual opportunity, including age, duplicate/window integrity
and source-quality checks.

### Features and S/R

Taker windows retain sums, ratio, net, source rows, distinct-minute coverage
and age. Invalid or duplicate windows are unhealthy rather than silently
counted as extra minutes. Book0.5% and2% evidence includes validity, timestamp,
truncation/coarseness and directional imbalance. Book changes compare valid
as-of snapshots, not an interpolated future book.

Asset changes use a fresh current sample and fresh1h/4h anchors. Native OI,
mark-price change and USD-marked OI are distinct. Dropping USD notional caused
by falling price is not called native OI unwinding. Funding economics are not
modeled by this checkpoint.

S/R uses the exact pinned live geometry:14d memory of continuous closed5m
candles,30m pivots with4 left/4 right confirmation,0.45% clustering,
minimum2 touches and1% configured proximity.

Store all known zones, analytic nearest distances without a1% cutoff,
configured live proximity hits and exact equal-price zones separately.
Pivot touch lists retain confirmation times. `confirmTs` is the engine's
earliest touch; `usableAt` is when minimum touches are reached and
`lastTouchKnownAt` is when the latest included touch becomes known.
`snapshotId` hashes the snapshot's touch list; it is **not** a durable
identity guaranteed across later cluster rebuilds.

S/R response is descriptive: freeze nearest support/resistance at T−15m,
then compare only the two completed5m closes ending T−5m and T against that
fixed level ±0.1%. Future touches/bounces cannot manufacture past support.
“No known support below price” is a valid geometry result, not missing data.

## Bundle schema

| Artifact | Contents / use |
|---|---|
| `manifest.json` | Frozen card, source/code/R01/candle pins, raw source hashes and protected live-file hashes |
| `baseline-parity.json` | Six exact recent baseline replay checks |
| `baseline.json` | Full/recent original, old-CMF and R01-08 statistics at both delays |
| `source-inventory.json` | Full-file and window counts, per-month availability bins, gaps, timing bases and quality totals |
| `evidence/source-rows.jsonl` | 61,793 selected original raw rows with file/physical-line identity |
| `opportunities.json` | Full14-row nested evidence: pulse snapshots, zones, responses, baseline decisions/trades |
| `opportunity-table.json`, `opportunities.csv` | Lightweight14-row view; metrics numeric, per-source health fields prefixed `healthy_*` |
| `coverage.json` | Overall/monthly opportunity coverage and coverage-only attribution for all six baseline cases |
| `prefix-checks.json` | First, June22 and last real-event prefix equality for pulse and S/R |
| `validation.json` | Runner-stage checks; its pending-independent-check flag is historical staging |
| `verification.json` | Final independent pass, verified artifact hashes and verifier hash |

The curated JSON adds descriptive flow/S/R cohorts and realized-close month
attribution, generated from the accepted archived trades. These are **not
filtered strategy PnL**: replacements/new occupancy paths have not been run.
No new threshold ranking or economic screen is recorded.

## Reproduction

Run locally, not on the live4GB VPS. Requires accepted R01 bundle and its
original pinned sources, repaired candle inputs, the three HL files, and
unchanged matching source/code pins. A later data pull may invalidate the raw
hash comparison; do not rewrite old pins to make a changed input appear equal.
Archive originals or explicitly version a new input lineage/card.

Fixture and typecheck commands from repo root, PowerShell:

```powershell
npx.cmd ts-node scripts/indicator-hl-sr-context-tests.ts
npx.cmd tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-indicator-hl-sr-context-study.ts scripts/indicator-hl-sr-context-check.ts scripts/indicator-hl-sr-context-tests.ts
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
```

To reproduce with matching inputs, use a **new, nonexistent directory**:

```powershell
npx.cmd ts-node scripts/hype-indicator-hl-sr-context-study.ts --out backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-recheck
npx.cmd ts-node scripts/indicator-hl-sr-context-check.ts backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-recheck
```

The builder refuses an existing output directory; the checker writes
`verification.json` exclusively and refuses to overwrite prior verification.
Do not delete/rewrite accepted artifacts just to rerun a command. Manifest and
verification creation timestamps will differ in a fresh reproduction; compare
economic paths, evidence content and underlying pins, not timestamped manifest
bytes to the accepted file.

The independent checker re-scans full raw sources and checks retained rows and
no missing selections, timing/quality calculations, all42 snapshots, raw-flow
sums, book selection/changes, OI units and628 independently rebuilt current/prior
zones. It also checks baseline joins, coverage, numeric flat exports/CSV and
protected/source/artifact hashes. Real-prefix tests and synthetic future/gap/
duplicate/stale cases complement those raw-data checks.

### Superseded initial attempt

The initial directory without `-v2` is not accepted. It exposed a flat-export
column-name collision: book numbers were overwritten by identically named
health booleans. Nested evidence was intact. Export keys were separated, the
checker was extended to validate flat JSON/CSV, and the unchanged economic
card/data were rerun into accepted v2. Do not mix bundles. Its old code pins
differ by design; preserve it as superseded, not as another economic trial.

## Boundary after H00

Coverage is sufficient to design a **small, separately frozen context card**;
14 opportunities/11 refined trades still make it sample-limited. Test one
condition at a time and explicitly separate unavailable-source abstention
from the condition itself. Re-simulate full occupancy with parent/old/refined
and readiness controls, both delays and source-lag sensitivity. Do not
substitute cohort sums for those replays or tune a threshold around two losses.

Only after context results justify it does one explicitly defined ladder
decision get a full current repaired canonical replay. No live short unpause,
ladder gate change, new PM2 service or production recommendation follows H00.

