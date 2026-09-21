# L13: frozen winning-mechanism combinations

Local research only. No strategy/execution/config changes. September 11, 2026.

## Question

Which recent long-ladder research leads still improve the repaired B17 stack
when combined, and do pairs improve their individual components rather than
merely inherit one component's profit? Standalone indicator or paused-short
returns are not commensurate with these ladder-account dollars.

The [frozen card](../../research-inputs/winning-ladder-combinations-2026-09-11.json)
defines eight pairs: `age8` or `minus_soft_stale`, each crossed separately with
`last11_50`, `minus_deep_stress`, `mfi_weekly_half`, `exit_2d_1pct`.

Seven singles include the unchanged baseline. Half11 is deliberately included
as a defensive comparison, not mislabeled a standalone profit winner. Broad
risk-control removals, conditional structure8, other high horizons and removal
of hot-RSI TP cooldown remain in the evidence inventory, not extra pair runs.
No triple, parameter retuning or same-mechanism TP-policy pairing is allowed.

## Run contract

- Older: July 1, 2025 00:00 through August 19, 2026 21:32 UTC.
- Recent: May 17, 2026 20:43 through September 10, 2026 05:08 UTC.
- Initial $32,000 flat, $800 ×1.35 maximum11, original0.055% fees per side.
- Exact current B17 causal engine, transactional partial clocks, inherited
  quality-aware pulse, BTC risk-off and damaged latch. No maker uplift,
  funding cash-flow, actual liquidation/shared collateral or queue certification.
- Closed-bar decisions, next-minute-open market fills. Resting-touch and
  close-confirmed TP assessed separately. No future highs or same-bar new-target
  retrospective fills. Windows overlap and are previously mined, not holdouts.

28 archived single runs must reproduce full digests and metrics before pairs.
Then14 refreshed recent singles,32 pair runs (eight ×four),12 recent source60
repeats (MFI/high single and each TP pair ×two models). **86 fresh executions**,
60 primary rows, eight new definitions. Older reproduced singles are reused in
the primary tables rather than rerun/count inflated. Current B17, age8,
no-soft-stale and high singles also match accepted refreshed controls.

Source60 delays the new closed30m MFI and hourly weekly-VWAP/ROC, or new
rolling2880-minute high reference. Current observed HYPE decision price and
inherited HL consumers are unchanged. This is not a fill-delay or funding-data
delay test. Every paired strategy has at most one experimental reduction owner;
ordinary full exits and S/R partials retain precedence.

## Interpretation and acceptance

Report baseline-adjacent completed episode W/L, winning and losing dollars,
marked-open and unfinished partial cash, total net, max DD, TP/forced counts,
monthly MTM and losing dollars. Pair deltas must be shown against **both**
singles. Pair uplift minus the sum of individual uplifts measures non-additive
historical interaction, not independent alpha or a significance estimate.

Use the inherited screen unchanged: recent uplift ≥$1,000 both models;
older uplift ≥0; no DD increase; every monthly MTM delta ≥−$250; at least20
recent intervention episodes; no modeled nonpositive equity. Also separately
check whether a pair improves both constituents' net and does not worsen either
constituent's DD in all four cases. An aggregate improvement is not a strict
screen pass or live authorization.

Intervention counts distinguish target, sizing and cut episodes. Guard-removal
counts are not independently reconstructed in this wrapper; that single is
explicitly n-unmeasured, never credited with invented samples. Pair counts
there cover the TP leg only. A large TP count does not validate a sparse MFI
half-exit. Near-high exits retain the existing4–8h non-TP cooldown and can
pre-empt a deferred TP; open-inventory effects are isolated in attribution.

## Implementation and checks

- [Worker](../../scripts/hype-ladder-combination-study.ts): frozen composition
  through existing research hooks and cloned config, full occupancy replay.
- [Policy](../../scripts/ladder-combination-policy.ts): allowed IDs and exact
  two-field config differences / half11 sizing; no executor imports.
- [Accounting](../../scripts/ladder-combination-accounting.ts): separate copy
  of the pinned independent ledger audit, with only the expected open-size
  assertion extended for half11. Original accounting source is untouched.
  Non-half synthetic paths must match it exactly.
- [Tests](../../scripts/ladder-combination-tests.ts): definitions, cloned config
  isolation, same lower-rung size, actual next-open fills, coupled age/high
  behavior, independent fees/equity and future-prefix invariance.
- [Final verifier](../../scripts/ladder-combination-review.ts): raw prefix/suffix high,
  inherited independent raw MFI/weekly audit, all-minute target timing,
  pro-rata/no-rebuild, fill ledger, size permissions, monthly equity and comparison
  identities. It does not accept policy results as proof of their own correctness.
- [Report](../../scripts/ladder-combination-report.ts): read-only stdout; requires
  independent verification before findings are written.

```powershell
npx ts-node scripts/ladder-combination-tests.ts
npx ts-node scripts/hype-ladder-combination-study.ts plan research-inputs/winning-ladder-combinations-2026-09-11.json
# Use the exact key returned above; completed jobs cannot be overwritten.
npx ts-node scripts/hype-ladder-combination-study.ts run KEY
npx ts-node scripts/ladder-combination-target-audit-tests.ts
npx ts-node scripts/ladder-combination-review.ts KEY
npx ts-node scripts/ladder-combination-report.ts KEY
```

Pin all inherited data/current sources, archival evidence, new policies/tests/
verifier, and protected production/config/state files. Never modify a pinned
file while its job is running. Raw outputs remain ignored under
`backtests/research-workflow/KEY/output/`; findings, card and harness are the
small reproducibility artifacts. No implicit VPS run or deployment.

Audit-only refinement: the initial pinned `ladder-combination-verify.ts` reused
the old F06 target verifier, which assumes full-close scheduling precedes
TP recalculation. Research high exits follow that recalculation, so those bars
must still be audited. The final reviewer uses
`ladder-combination-target-audit.ts` with explicit ordinary-vs-research ordering.
The old file remains unchanged as a pinned record. New audit/test source hashes
are recorded separately in the verification receipt; no frozen economic input,
rule, engine or outcome is changed by this correction.

The wrapper compresses target telemetry on price/pct/episode changes, so an
unchanged-price rearm following a pro-rata half-fill is not a new telemetry row.
The final verifier independently reconstructs the complete arm chronology from
every occupied minute's target rule plus quiesce/fill events, and checks TP fills
against that chronology. It does not infer the new arm time from compressed
price changes. A regression specifically covers same-price partial rearming.
