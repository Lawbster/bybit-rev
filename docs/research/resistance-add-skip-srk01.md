# SRK01: timer-only resistance add skip

Frozen September 16, 2026 before new outcomes. Local research only.
[Card](../../research-inputs/resistance-add-skip-srk01-2026-09-16.json).

Baseline is unchanged Agg10, not the SRT03 shaded TP or SRR01 wait. One overlay:
with at least **five existing rungs** (next rung six or higher), veto a timer-only
add if the nearest existing resistance is strictly above the closed-minute price,
within 0.3%, and has three confirmed touches at least six hours apart. Touches
are pooled as in the existing map. Qualify the nearest level; do not search for
a more convenient farther one. Same 14d/30m/4L4R/0.45% map; no new indicator.

A 0.3% price-drop add is always exempt even if its timer is also due. All earlier
gates and affordability must pass first. Never reset lastAddTime on a veto, never
create a pending order, never defer an exit or modify partials/TP/sizing. Missing
S/R coverage creates no additional veto, not an invented resistance or blanket pause.
The rule may delay rather than permanently remove exposure; report both.

## Stages

1. Verify accepted SRR01 archive and its unchanged Agg10 controls. Read every
   gate-approved probe and match attempts, executed fills and cutoff pending intent.
   Reconstruct previous inventory and price-drop/timer class. Build S/R forward
   at the same closed-minute cadence. Seal all eligible rows before economics.
   Unique affected ladders' eventual outcomes are descriptive, not savings.
2. Freeze source/card/audit hashes. Reproduce four Agg10 raw digests and metrics
   before alternatives. Run four primary paths and four new-gate +60s paths.
   Existing partials/gates retain their original clocks and context.
3. Independently rebuild approved-add denominator, exact veto predicate and
   confirmation/availability timestamps, exits, target lifecycle, execution
   ledger, fees and marked DD. Inspect source prefixes and at least one trace.
4. Report full W/L and monthly comparisons, exposure delays/rebuilds, opportunity
   cost, replacement-cycle concentration and qualification. No extra condition
   or second variant based on these outcomes.

Twelve paths, one new definition. Windows and screen unchanged from SRR01;
resting-touch primary and close-confirmed sensitivity, $32k flat starts, 0.055%
fees each side. No maker credits or funding cash. These are overlapping mined
windows, not holdouts or actual wallet returns. B17 is context, not the parent.

Any candidate would still need forward observation and separate implementation
approval. No production, exchange, PM2, state or live-config changes.

```powershell
npx ts-node scripts/resistance-add-skip-tests.ts
npx ts-node scripts/resistance-add-skip-study.ts audit
# Read the sealed eligible-fill report first.
npx ts-node scripts/resistance-add-skip-study.ts plan
npx ts-node scripts/resistance-add-skip-study.ts run KEY
npx ts-node scripts/resistance-add-skip-verify.ts KEY
npx ts-node scripts/resistance-add-skip-report.ts KEY
npm run research:workflow -- verify KEY
```

Never overwrite a completed/partial audit or claimed replay. A different source
or definition requires a new reviewed card.
