# L11: trailing-high ladder controls

Frozen September 10, 2026. Local research only; no production/config changes.
Card: [near-high-ladder-2026-09-10.json](../../research-inputs/near-high-ladder-2026-09-10.json).

## Question

Does proximity to a known recent high identify poor places to expand inventory,
or good places to abandon an aging ladder, after counting the recoveries lost?

This is a deliberately simple location test, not proof that a local top exists.
An accelerating breakout is also near a high. A rejection/failed breakout is a
separate, untested response condition; it is not silently attached mid-study.

## Twelve definitions

| Dimension | Values |
|---|---|
| High reference | Rolling 24 hours / 7 days / 30 days |
| Proximity | Within 1% / 2% below that reference, inclusive |
| Action A | Veto otherwise-approved rung 8–11 adds, both timer and price-drop |
| Action B | Full close when oldest surviving rung is at least 4 hours old |

Each run uses one reference, one proximity and one action. The actions are NOT
combined. Initial entries and rungs 2–7 are unchanged by Action A. Action B has
no depth requirement, no PnL floor, and no loss-only selection. The user's
88–90 / −$460 example motivated the question; those absolute levels are not
decision inputs or fitted thresholds.

Highs come from exactly `days * 1440` contiguous, completed one-minute candles,
including the decision minute once closed. No eventual calendar period high.
Reference distance is `max(0, 100 * (1 - price / high))`. Breakouts above a
delayed reference count as near-high. Missing full coverage vetoes deep adds
but does not force exits, and is counted separately.

Age uses the oldest actual surviving fill. Adding another rung does not reset
it; an actual partial can change the oldest remaining fill. TP, hard/emergency
flatten and S/R partial decisions retain their existing priority. No new close
overrides an outstanding intention. Research closes fill at the NEXT minute's
open, never at the observed high or the decision bar's close.

**Action B retains the existing non-TP cooldown:** until the second four-hour
boundary after the fill (4–8 hours). Thus its economic result is the exit plus
that cooldown, not an isolated attribution to the high. Replacement trade and
missed recovery costs must be reported. Ordinary add clocks and target rules
otherwise remain unchanged.

## Comparison and validation

- Six exact B17 controls from the accepted L10 job must reproduce first.
- Published window: July 1, 2025 through August 19, 2026 at 21:32 UTC.
- Recent window: May 17, 2026 at 20:43 through September 10 at 05:08 UTC.
- Both close-confirmed/next-open TP and previously armed resting-touch TP.
- 48 primary variants; 24 recent repeats with rolling-high availability delayed
  one minute. Current observed price is not delayed in this sensitivity.
- 78 executions including controls, but only **12 new trading definitions**.
- $32,000 initial modeled equity, $800 × 1.35 / 11-rung stack. Discovery fees
  remain 0.055% per side. No maker-fee uplift or long-funding settlement.
- Primary screen: recent net delta ≥$1,000 in both models, published delta ≥0,
  no DD increase, each monthly MTM delta ≥−$250, ≥20 recent affected episodes,
  no modeled nonpositive equity. Passing requires subsequent delay review and
  forward observation; a completed job is never deployment permission.

Same previously-mined, overlapping history: not an untouched holdout. The
August 20 daily-high study belongs to the superseded replay era; its $82k
baseline is not comparable with current corrected B17. It did not exhaust
weekly/monthly highs or stale exits on this engine.

`near-high-tests.ts` checks window expiration, exact boundaries, gaps, prefix
invariance, future poisoning, source delay, breakout handling and action
priority. `near-high-verify.ts` independently calculates every rolling maximum
using block-prefix/suffix arrays rather than the worker's monotonic queue. It
checks every add veto, every occupied exit decision, actual fill/cooldown
timing, full inventory accounting, monthly MTM and episode replacement dollars.

## Reproduce

Run only locally, from repository root:

```powershell
npx ts-node scripts/near-high-tests.ts
npm run research:workflow -- plan research-inputs/near-high-ladder-2026-09-10.json
npm run research:workflow -- run KEY
npx ts-node scripts/near-high-verify.ts KEY
npm run research:workflow -- verify KEY
```

The key pins data, repaired candles, canonical sources, this worker and tests.
Outputs live under `backtests/research-workflow/KEY/output/`; findings/indexes
are small source-controlled documents. Large tapes and replay ledgers stay local.
