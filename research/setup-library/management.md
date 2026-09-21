# Targets and position management

Not standalone entries. Target changes, partials and early exits alter future
occupancy; compare full strategies, not only the dollars on modified exits.

## TGT01 — Directional old-range POC objective

**Source:** D10 pp1–5; P4 p1. A breakout can leave a daily TPO POC untouched;
subsequent old-range re-entry supplies context for travelling toward it.
**Sequence:** historical range/profile known → breakout → POC remains naked
as-of → later confirmed range re-entry and independent directional entry →
target the eligible POC ahead. This is not “buy each POC touch”.

**Validation:** label TPO time-at-price versus volume-at-price explicitly;
require completed, coverage-qualified profiles. **Invalidation:** POC consumed
before order, profile unknown, target behind entry, or parent fails.
**Risk:** parent stop; target acceptance includes after-cost distance/R.

**Unresolved:** range/profile association, entry, target precedence and bins.
Compare same entry with EQ/opposite-edge target; test volume substitution
separately. Existing PB/LC volume-NPOC work is adjacent, not this exact model.
Included as general library knowledge, not a directive to resume POC research.

## TGT02 — Target before opposing origin zone

**Source:** STC18 p15. Do not place a target through a known opposing OB;
source suggests taking profit just before it.
**Sequence:** parent entry validated → identify causally known opposing zone
ahead → choose an executable target at a declared offset before its near edge.
No valid reward/risk after costs means no qualifying trade, if that veto was
part of the frozen design. Dynamic retargeting is a separate variant.

**Invalidation:** parent stop remains authoritative. Do not silently lift an
already tightened target, extend risk, or replace an unavailable zone with a
future one. **Unresolved:** offset, nearest/strongest precedence, zone quality,
minimum R, target updates and expiry. Source gives no optimal percentage.

Existing resistance-priced ladder TP work (SRT03/SRR01) is adjacent and contains
negative controls; origin-zone standalone targeting is not identical. Evaluate
fill capture, smaller wins, missed runs and changed re-entries, not win rate alone.

## EXIT01 — Expected reaction fails / conditional early exit

**Source:** STC18 p15; SD52 p9. If price lingers instead of reacting away from
an orderblock, reassess; source does **not** specify a mandatory timed exit.
**Sequence:** valid parent filled → start declared reaction clock → at each
eligible check use only elapsed excursion/dwell and current structure → exit
if the frozen reaction-failure condition is met.

**Validation:** absence of minimum progress is measured only after its deadline;
don't call every later loser an early failure. **Invalidation:** hard stop remains
live throughout. Protective stop, conditional exit and maximum holding cap
are separate events with declared priority. Market exit uses executable price.

**Unresolved:** deadline, minimum favorable excursion, normalized distance,
whether a close back inside suffices, parent age and exit priority. Compare
unchanged parent and unconditional same-time exit. Earlier soft-stale/timeout
research is adjacent; no generic “exit quickly” profitability is established.

## EXIT02 — Staged exits at known liquidity objectives

**Source:** STC18 pp4,9 recommends multiple partial profit targets at liquidity
levels. Allocation and post-partial stop behavior are unspecified.
**Sequence:** predeclare ordered targets ahead of entry and quantities summing
to the position → executable fills reduce inventory → remaining stops/targets
apply to the reconciled residual. Distinct target lineage and fill timestamps.

**Validation:** levels known before they become orders; fees/slippage on every
fill. **Invalidation:** hard stop and thesis failure close the appropriate
remainder. Breakeven stop after TP1 is a new policy, not implied by the source.
**Unresolved:** percentages, offsets, minimum separation, time cap, residual
target updates, same-bar ordering, maker/taker and partial-fill handling.

Compare single exit against staged exits on identical entries and total initial
risk. Banked proceeds are not incremental PnL. Existing SRP01 partial evidence
applies to its exact Agg10/pulse/map action; it does not validate this standalone
liquidity ladder or every partial-exit schedule.
