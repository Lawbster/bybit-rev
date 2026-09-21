# H01 context filters: method, controls and reproduction

September 8, 2026. [Findings](../../research/codex-astra-indicator-hl-sr-filters-h01-findings-2026-09-08.md),
[frozen card](../../research-inputs/indicators/context-filters-h01-2026-09-08.json),
[retained results](../../research-inputs/indicators/h01-retained-results-2026-09-08.json).

## Scope and code

Four conditions on the existing Bollinger4h + hourly CMF<−0.05 short, plus
four Bollinger+condition controls without CMF. Same $10k notional,12h hold,
fees, repaired candle inputs and May17 20:43–September4 19:01 UTC window as
H00/R01. No latest-pull refresh, live trading, ladder simulation or new exits.

| File | Responsibility |
|---|---|
| `scripts/indicator-hl-sr-filter-policy.ts` | Additional delivery lag, as-of source quality, four predicates, mixed evidence and replay adapter |
| `scripts/indicator-hl-sr-filter-tests.ts` | Future/late/duplicate/coarse data, exact equality and delay boundaries, readiness preserves CMF, replacement occupancy/cutoff |
| `scripts/hype-indicator-hl-sr-filter-study.ts` | Pin/verify H00 and code; reproduce six baseline cases; build114-case immutable study |
| `scripts/indicator-hl-sr-filter-check.ts` | Independent raw-source/context/indicator calculations, schedules, fills, fees, DD, monthly attribution and screens |

The existing combination engine, indicator formulas, H00 builder and S/R
geometry are reused **without modification**. The narrow adapter widens only
the legacy serialized gate type; mixed pulse/CMF evidence is not falsely
labeled as one completed candle.

## Frozen predicates

- H01-01: taker15m ratio at T **<** ratio at T−15m; both snapshots healthy.
- H01-02: 0.5% book imbalance at T **<** imbalance at T−15m; both healthy.
- H01-03: native OI1h change **≥0**; current/anchor healthy.
- H01-04: both completed5m closes at T−5m/T below the support frozen at T−15m
  by **more than0.1%**. No known prior support means false, not unhealthy OHLC.

No absolute flow threshold, new OI direction sweep, price trigger, stop, time
gate or condition cross-product. The `_no_cmf` suffix identifies each explicit
interaction control; it still requires the original Bollinger crossing.
The `ready_` prefix removes only the new condition's predicate and **retains
the original indicator/CMF condition**. Never use a general readiness option
that inadvertently removes CMF too.

H00 already exposed the historical context/outcomes. H01 is a prospectively
frozen **next historical test**, not a fresh holdout.

## Timing and occupancy

For each HL source, compute base availability from the old source model,
add0/15/60 seconds, then round up to the next UTC minute eligibility. Retain
event times, current T-anchored windows and original freshness/sample limits.
Evaluate the same model at T, T−15m and past OI anchors.

A record whose original end+1m falls exactly at T becomes eligible T+1m after
even a small additional delay. This can make the flow window incomplete.
Do not “fix” stress results by sliding the window, using late-arriving rows
backward, relaxing freshness, or waiting for data and entering later:
those are different policies. Candle/SR publication is unchanged, making
SR the negative control for **HL-only** arrival delay.

H00 has42 pulse snapshots. **H01 has84**:
14 opportunities ×2 observation times ×3 arrival lags. The original raw
H00 excerpts retain sufficient history for all14 crossing opportunities,
including those previously occupied. New accepted entries can only arise
from those original crossings; no outcome-filtered signal list is used.

The independent original indicator math re-derives all14 signals. At every
replay minute, resolve due exit, due entry, timeout, then the new crossing.
Only one open/pending position is allowed. Decisions freeze at T; action
delay0/+1m applies separately to entry and exit, and the12h hold begins at
actual entry. Newly free opportunities are re-simulated, not attached after
subtracting filtered baseline losses.

## Acceptance and reporting

Four primary +four interaction definitions. Each has six arrival/action
cases and six readiness cases; three repeated baselines add18 logical cases.
Total **114**, of which18 baseline duplicates represent six unique baseline
paths. Incremental tested-definition count is8, not114.

Report baseline-first W/L, winning/losing dollars, net/open mark, cost stress,
DD and exposure. Own-readiness comparisons separate source absence from
predicate effects. Marked monthly deltas include positions crossing month
boundaries; don't compare them directly with H00 close-month sums.

Recent exploratory screen: ≥10 trades, net/stress>0, solvent, monthly
regression≥−$320 against original/own/readiness, incremental net≥$200 against
own/readiness and DD no worse than either, at both action delays. Report each
arrival lag separately. The full-history profit/defensive/strict screens
remain **unevaluated** for these HL filters; unavailable history is not a pass.
Diagnostic exposure-scaled DD is ex-post attribution, not deployable sizing.

Results: zero recent qualifiers at any lag. No automatic transfer to a ladder
gate or short unpause. Failed exact rules are registered without rejecting
the entire indicator/HL/SR families.

## Artifacts and reproduction

Accepted directory:
`backtests/hype/hype-indicator-hl-sr-filters-h01-2026-09-08/`.

- `manifest.json`: card,8 definitions, code/H00/raw/price pins and protected live-file hashes.
- `results.json`:114 rows, own/readiness/unfiltered/old-CMF deltas.
- `trades.json`, `decisions.json`: complete accepted schedules and all original crossings, including occupied/rejected/missing.
- `contexts.json`:84 evidence snapshots with physical source references, original/model clocks, health and native versus marked OI.
- `monthly.json`:570 marked/W-L/fee rows, including every lag/control.
- `trade-attribution.json`:48 variants ×two comparisons, lost winners/avoided losers/new trade identities and rejection reasons.
- `diagnostics.json`:48 actual paths plus exposure-scaled readiness comparisons.
- `ranking.json`:8 definitions ×3 arrival assumptions; explicit failures and no full-history/deployment qualification.
- `baseline-parity.json`, `prefix-checks.json`, `validation.json`: runner-stage checks; pending-independent flag is historical staging.
- `verification.json`: final independent acceptance, source/artifact hashes.

Manifest SHA256:
`96770ba72a474024fa1ab956996fa6e7108a2adc540e7cac943a87b531e04a81`

Independent verification SHA256:
`62487022fe77ef38eeafa93a71433a1fb2bfd4fbb0ed927c901fb9be4f1c5850`

Run locally, not on the production VPS. Preserve exact H00/R01 sources and
raw hashes; a changed pull is a new input lineage, not silent rebaselining.

```powershell
npx.cmd ts-node scripts/indicator-hl-sr-filter-tests.ts
npx.cmd tsc --ignoreConfig --noEmit --target ES2022 --module commonjs --esModuleInterop --skipLibCheck --strict --types node scripts/hype-indicator-hl-sr-filter-study.ts scripts/indicator-hl-sr-filter-check.ts scripts/indicator-hl-sr-filter-tests.ts
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
```

Reproduction requires a **new nonexistent directory**, for example:

```powershell
npx.cmd ts-node scripts/hype-indicator-hl-sr-filter-study.ts --out backtests/hype/hype-indicator-hl-sr-filters-h01-2026-09-08-recheck
npx.cmd ts-node scripts/indicator-hl-sr-filter-check.ts backtests/hype/hype-indicator-hl-sr-filters-h01-2026-09-08-recheck
```

Do not overwrite accepted verification or rewrite pins to accommodate changed
inputs. Creation timestamps vary in a fresh reproduction. The checker is
independent of the new policy/runner calculations: it recomputes raw clocks,
selected rows, feature math, gating, trade schedules, execution economics,
minute DD and month-end equity. Prior S/R geometry is taken from immutable,
independently verified H00; current H01 support response is rechecked against
raw completed candle closes and known touch times.

No live code/config/state changes, exchange calls, new PM2 service, commit,
push or deployment belong to this checkpoint.

