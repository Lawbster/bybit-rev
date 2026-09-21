# PA07 — first library setup batch

Frozen before economics, 2026-09-18. [Card](../../research-inputs/price-action-pa07-2026-09-18.json).
Research only; existing live ladder, partials, maker TP and paused short untouched.

## Why these first

PA06 sweep/impulse and PA03 origin-zone return can share causal pivots, immutable
levels, displacement observations and event lifecycle. They supply the foundation
for the stricter range reversal and named breaker without pretending a generic
zone breach implements either. No new NPOC map or indicator sweep is needed.
Numerical choices below are operational conventions, not optimal author rules.
The source library remains authoritative about what the PDFs actually specify.

## Shared clocks and levels

- Reuse sealed LV01 minute candles, completed contiguous UTC 1h/4h aggregation,
  structural-bracket `poc-indicator-bias-engine.replay`, CSV and hash helpers.
  Do not modify any accepted engine. Its old pivot helper hardcodes 4h, so add
  one generic timeframe-explicit pivot/event module with focused tests.
- Strict two-left/two-right pivots; ties excluded. Publish only after the second
  right-hand candle closes plus 60s (120s sensitivity). Store occurrence,
  confirmation and availability separately. References must be known **before
  the event candle starts**, not merely by its close.
- Use the latest known opposite 4h extrema, each at most seven days old, with
  high>low. They are a **liquidity bracket**, not the author's post-exhaustion
  anchored range. A target must remain untouched since it became available;
  a post-confirmation intervening wick consumes that pivot. Missing or consumed
  context yields no structural trade, never a fabricated target.
- A first breach consumes a reference even if it fails to reclaim. Every
  attempted setup and its rejection/expiry are retained. No repeated signals
  from the same side/reference. Same-mechanism same-side simultaneous candidates:
  choose oldest formation, then lexical ID, record discarded ties.
- All prices and decisions frozen at event time. Bar confirmation entry is at
  the actual minute open at confirmation end + source lag + action delay.
  A 24h holding cap is measured from actual entry via explicit `expiresAt`;
  avoid the legacy engine's extra-delay default-hold convention.

## Sweep family: PA06 and control

At the start of a 1h candle, freeze the known 4h bracket. For a long, the prior
1h close is above the low, the candle trades at least 0.1% below it and closes
back above it. Mirror for shorts. Both parent and candidate additionally require
the reclaim close in the bottom 40% (long) / top 40% (short) of the frozen
bracket. This is the proposed explicit context confluence, not an inferred stop
cluster. The opposite target must not be touched in the sweep candle.

`sweep_control`: enter after this reclaim closes. Stop 0.1% beyond the sweep
extreme. `sweep_impulse`: wait at most six hours after sweep close for the first
**later** eligible 1h candle pointing in the trade direction, body >=60% of
range, range >= the mean true range of its preceding 14 completed 1h bars.
No future ATR or full-day volume. Keep original stop and target. Stop breach
or target consumption during the wait cancels first, including an ambiguous
same-bar impulse. Confirmation candle must start after sweep publication;
intervening latency-bar invalidations still count. No MSB requirement is invented.

## Origin family: PA03 and control

A 1h close breaks at least 0.1% beyond its previously known confirmed 1h swing;
the preceding close was on the unbroken side. First qualifying crossing only.
Select the most recent opposite-colour candle in the preceding 12 bars and
at/after the reference pivot's occurrence. Full-wick box, immutable. Break close
must be outside the box on the departure side. Freeze the existing unconsumed
forward 4h target; stop 0.1% beyond the box's far edge.

`break_control`: enter at the next executable open after break publication.
`origin_retest`: first subsequent return overlapping that box within 12h must
close back beyond its near edge, with no far-stop breach or target consumption.
The entire confirmation bar must start after publication. If the first return
falls in the publication-overlap bar, reject it as latency ambiguous; never
pretend a later return is fresh. A failed first return is consumed, not retried.
No future trend label, widened zone, OTE filter or order-book confirmation.

This is a **confirmed-return market-entry adaptation**, not the source's
resting near-edge limit. Therefore a failure cannot falsify all origin-zone
limit strategies; a success cannot claim maker execution.

## Targets, risk, comparisons

Four entry mechanisms × two sides × two targets =16 definitions (8 candidates,
8 controls), no parameter search. All use frozen structural stop. Target either
opposite known 4h extreme or signal close ±2 times its distance to stop.
The latter is **reference 2R**, not a guarantee of 2R after gap/delay/fees.
At signal require positive target direction and stop risk 0.2–5% of signal
close. Execution rejects side-invalid gaps through either bracket; no filtering
on future fill quality. Structural target consumption cancels pending setup
even in the 2R comparison, preserving the same thesis opportunity universe.

Separate $10k accounts for each side/mechanism/target, $32k DD equity. No
compounding, averaging or pyramiding. Full/older/recent partitions independently
flat-start, while causal context warms from the full tape. 0.055% each side,
before funding. Additional 5bps/side stress. Both stop-first primary and
target-first ambiguity sensitivity; 60/120s publication and 0/60s action delay.
The actual fill, fees, stop risk/R and still-open cutoff inventory are saved.

Report own-control W/L, winning/losing dollars, average loss, net, DD, average R,
profit factor, monthly MTM/delta, occupancy and top-winner concentration. Cash
is the absolute control. The accepted NPOC replay is an **engine parity fixture**,
not the economic parent of a sweep or origin-zone strategy.

## Acceptance before interpretation

1. Verify cached input/output seals. Reproduce saved LV01 control paths exactly
   with unchanged engine; stop on divergence.
2. Save aggregated bars/pivots and complete event/signals tape once per source
   identity. Reuse across target, partition and execution sensitivity cases.
3. Synthetic event/expiry/equality/direction/latency tests; prefix and future
   poisoning; chronological chart samples selected without PnL. Reuse atlas
   rendering, clip charts to decision time (no future labels).
4. Independently reconstruct reference candles/pivot confirmation, sequences,
   entry/exit receipts, ownership, net, minute DD and monthlies. Check all paths.
5. Apply frozen screen. Preserve outcomes even if nothing qualifies. Attach
   scoped evidence to PA03/PA06 without relabelling concept families as proven.

Later coverage, not secretly added here: PA01 anchored-range fidelity, strict
PA02 failed-zone lineage, PA04 outside-close reclaim, PA05 distinct third visit,
resting limits, HTF/LTF refinement, protected structure and management modifiers.
