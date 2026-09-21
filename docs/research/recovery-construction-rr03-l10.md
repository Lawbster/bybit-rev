# RR03 / L10: recovery trajectories and exposure construction

Frozen September 10, 2026. Research only. No live changes or deployment authority.

## Question and scope

Can observed recovery failure add information beyond HYPE's own price action?
Separately, can we reduce expensive inventory construction without sacrificing
too many recoveries? These are different questions from choosing a new exit.

The user's example was reluctance to open around HYPE88-90 and a discretionary
exit at roughly-$460 earlier that day. This is an illustrative hypothesis,
not a calibrated rule or a verified live decision timestamp. No dollar/price
threshold from that example is used in either experiment. A label of what the
user would have done is not proof that doing it was profitable; record both
later failures and later recoveries if collecting more such examples.

## RR03: fixed sequence diagnostic

Use the accepted RR02 common hourly HYPE/BTC/SOL tape, the same692 fixed4h
clocks and55 existing F01 pressure landmarks across two different TP paths.
Repeat0/60s source availability, without pooling repetitions as new samples.
The pressure cohort's original outcome cutoff/censoring is unchanged.

For each decision, estimate beta/intercept from168 preceding common hourly
returns, at least160 valid pairs. The fit ends four hours before the latest
available closed hour. Apply that ONE fit across the subsequent four already
observed increments. This prevents beta movement itself from producing a
false change in the residual trajectory. HYPE-only uses raw log returns.

Anchor cumulative return to zero at the start of that known4h sequence:

1. `failed_reclaim`: positive at any first-three hourly closes, nonpositive
   at the last, and final increment negative.
2. `recovering`: final two hourly increments strictly positive.
3. `persistent_weak`: all four cumulative closes nonpositive and final two
   increments nonpositive.
4. `mixed`: remaining cases. Invalid common coverage is separate `unknown`.

These are mutually exclusive in that priority. A reclaim here is a return to
the fixed4h anchor, NOT an inferred S/R pivot, an ex-post bottom, or an exact
model of discretionary chart reading. No extra HL/level conjunction is fitted.
Keep raw-HYPE-conditioned cells, own-day VWAP/ROC5, months and both TP paths.
Subsequent recovery/damage is attribution, not a simulated exit saving.

## L10: exactly six construction policies

| Policy | Restriction on an otherwise-approved add |
|---|---|
| Half-ATR spacing | From next rung8, price must drop from last surviving rung entry by at least max(ordinary0.3% distance,0.5x closed1h ATR14) |
| One-ATR spacing | Same,1.0x ATR14 |
| Underwater cap8 | From next rung8, while pre-add gross ladder PnL<=-1%, reject an add taking entry-cost inventory above the fresh eight-rung cost |
| Underwater cap9 | Same, fresh nine-rung cost |
| Post-trim wait60 | After an actual S/R partial, wait60m before the first subsequent add at any depth |
| Post-trim pullback | First post-trim add waits for price0.3% below actual trim fill, or4h since that fill, whichever first |

All allowed clips retain the original800x1.35 count-based size; no size clipping
or top-ups. Budget caps are observed entry-cost restrictions, not guarantees of
maximum dollar loss. Budget restrictions release when the gross mark is>-1%.
The ATR rules apply to timer and genuine price-drop opportunities. Unknown ATR
blocks these deep adds and is counted, not silently carried across a missing hour.

Post-trim permission is cleared by the first actual subsequent open or full
close, not by a signal that fails to execute. Another partial replaces its
anchor. The transactional last actual add clock is never reset by a trim.

No TP deferral, new partial sell, forced exit, leverage change, exchange poll,
signal-file write or source update. Existing guards, affordability, S/R geometry,
TP/hard/emergency/funding exits and partial allocation remain authoritative.
BTC/SOL diagnostic outcomes do not automatically alter these six definitions.

## Comparators and verification

- Four original F06 B17 controls must match digests, metrics and independent
  accounting. Two September10 extensions must match the RR01 refreshed baseline.
- Current B17 is $32,000 initial equity, $800x1.35/max11, actual modeled current
  stack, fixed0.055% fee per side. There is no new eight-hour target policy.
- Economic windows: July1,2025-Aug19,2026 and May17-Sep10,2026, same independent
  flat starts as their accepted baselines. They overlap and are already studied.
- Two TP execution models separately: prior resting target touched in a later
  minute versus completed-minute confirmation followed by next-open execution.
  These are neither identical to nor guaranteed bounds for actual maker fills.
-24 primary variant paths; eight additional60s source-lag ATR paths; six exact
  control paths:38 executions, six new definitions, not38 new strategies.
- Independent raw-hour ATR/VWAP/ROC calculations, independent regression
  equations, every recorded add-veto decision, inventory/fees/mark-to-market,
  original control hashes, label identity and protected-file checks.
- Full outcome summaries include W/L, winning/losing dollars, final open mark,
  total net, DD, monthly deltas, forced exits, missed TP cycles, matched versus
  removed/replacement episodes and fixed-path additional5bps costs.

Primary screen is frozen: recent net improvement at least$1,000 in both models,
published net not lower, no drawdown increase, no monthly delta below-$250,
at least20 intervened recent episodes per model, no modeled nonpositive equity.
Source sensitivity must not be represented as an independent holdout. Passing
the primary screen alone is not deployment approval.

Funding settlement, exact maker queues/fragmentation, instrument rounding,
exchange liquidation and shared-account short collateral remain unmodeled.
No retrospective fee uplift is used to rescue a failed rule.

## Reproduce

```powershell
npx ts-node scripts/recovery-construction-tests.ts
npm run research:workflow -- plan research-inputs/recovery-construction-2026-09-10.json
npm run research:workflow -- run KEY
npx ts-node scripts/recovery-construction-verify.ts KEY
npm run research:workflow -- verify KEY
```

Outputs are local immutable jobs under `backtests/research-workflow/KEY/`.
An input-prefix check initially detected appended minute files. The retry only
accepts identical old byte prefixes plus new rows strictly after the fixed
cutoff. Historical revisions or late in-window rows still fail. No raw file is
rewritten, and archived outputs are not overwritten.
