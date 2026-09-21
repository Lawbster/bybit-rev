# SRF01: support-failure / hard-flatten reach audit

Frozen September16,2026 before new audit outputs. No economic variant or live change.

Read the [card](../../research-inputs/support-flatten-reach-srf01-2026-09-16.json).
The question is not whether support failure predicts every loss, but whether
moving the existing hard-flatten clock from12h to6h can act before that exit.
Current age AND gross PnL<=-2% AND hostile closed4h trend must all pass.

Use SRK01's four accepted unchanged Agg10 controls (two windows/two TP models),
not its resistance-skip variants. Verify their archived raw digests and
reconstruct cash/inventory/monthly/DD. No need to rerun economic paths to join
an observational state. Baseline recent May17-Sep15,2026; longer Jul2025-Aug19,2026;
$32k flat start, $800x1.35/max11,0.055% fees each side, open marks included.

Reuse MA01/MS02's forward-only4h/120d fixed macro map and hourly failure/recovery
state. Rebuild it exactly, including warm-up. Delay only this state by0/60s.
At each closed minute after baseline fills, use actual surviving inventory,
known close, and the same trend flag as the baseline. A failure spell must
still be healthy/active and the current price below its frozen lower bound.
Release, gaps, price reclaims and existing full-close decisions remain explicit.

Record:

- All8 missing-condition masks (age/PnL/trend) and unique ladders, not only losses.
- First inventory encounter per spell; separate entry-during from new warnings.
- First6-12h clock-only intersection per ladder, including baseline winners.
- First>=12h trend-only intersection, diagnostic only; no trend bypass strategy.
- Same-minute existing full exits (no incremental full-exit opportunity).
- Month, outcome, baseline partials, age of surviving inventory, warning-to-exit
  and next-open inventory mark. Already-armed TP closes count by fill time.

The mark closes only the then-existing inventory at the next open and keeps
already booked partials. It does not invent returns from later baseline adds,
simulate subsequent entries, or count an original loss as fully saved. Compare
whole-ladder baseline outcomes to this frozen-inventory mark as an attribution
diagnostic, never alternative portfolio earnings/DD. Unfinished ladders remain
separate. Never price beyond a path's cutoff.

No thresholds, map variants, pulse filters,6h economic replay or live policy
are added. Zero new trading definitions; counts remain5481/194. If direct reach
is thin, say so. If trend—not age—binds, changing it is a different, larger
mechanism requiring a separately frozen card and full replay, not this audit.

Commands (local only):

```powershell
npx ts-node scripts/support-flatten-reach-tests.ts
npx ts-node scripts/support-flatten-reach-study.ts plan
npx ts-node scripts/support-flatten-reach-study.ts run KEY
npx ts-node scripts/support-flatten-reach-verify.ts KEY
```

Independent verifier must not call the new reach selector. Native baseline
predicates and archived source geometry are reused with their independence
limits disclosed. Never overwrite accepted jobs/receipts.

MA01's old replay-engine pin predates subsequent research hooks; this audit
does not use that engine to generate MA01 state. Its macro sources, data and
artifacts must match. The current engine is pinned against accepted SRK01;
all MA01 rows/events are regenerated exactly before joining them. No source
or data mismatch relevant to this diagnostic is waived.
