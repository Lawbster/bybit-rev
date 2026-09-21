# Major-level encounters and recovery: MA01 / MS02

September 16, 2026. Offline research only. No live changes.

## Question and bounded scope

Does a major support failure justify blocking **new ladders**, and can a
causal recovery below the old support avoid MS01's prolonged lockouts?

Keep the tested 14-day local S/R partial-exit engine unchanged. Keep MS01's
separate 120-day major-level geometry unchanged. Do not rebrand earlier
unsuccessful local support/HL combinations as new tests. No manual $75.401
anchor, deeper-add restriction, early exit or HL threshold sweep in this study.

## Map, event and release clocks

The major map uses complete 4h candles, strict 3-left/3-right pivots, fixed
zones of +/-0.75% around their original seed, and at least two touches spaced
24h apart. A pivot is known only after its third right candle closes. Map
health requires 120 continuous days. Zone roles and expiration retain MS01's
rules. Zones are not redrawn around subsequent winning outcomes.

At a complete 1h close, watch the nearest qualified support whose upper edge
is below/equal price and within 3%. Freeze its ID and bounds before response
bars. Choose again only above the watched upper edge; no switching levels
inside an unresolved failure. The last complete 4h map is the source.

- **Touch:** a later complete hourly bar intersects the frozen zone after
  approaching from at/above its upper edge. Same-zone touches are at least
  24h apart. Strict sweep/reclaim traverses below the lower edge and closes
  above the upper edge; this narrow definition need not produce many samples.
- **Acceptance below:** two consecutive complete hourly closes below lower.
- **Failed retest:** a later complete hourly bar overlaps the failed zone
  and closes below lower; first retest per failure only.
- **Old-level recovery:** two complete hourly closes above upper.
- **New-base recovery:** two successive strict hourly pivot lows, each with
  two left and two right candles entirely after failure, the second higher;
  then a complete close above the highest high strictly between them. The
  neckline is usable only after the second pivot confirms. It may release
  immediately on that confirming close, or later. A lower low invalidates
  the pending neckline. This is a concrete test definition, not a claim that
  a higher low always ends a downtrend.

Old-level recovery, new-base recovery or zone retirement ends the spell.
There is no clock-based expiry. Gaps reset streaks and pivot history; unknown
data is not a clear signal. The release bar cannot immediately rearm.

## Descriptive atlas

Coverage: July 1, 2025 through September 15, 2026 20:20 UTC, with prehistory
for causal warm-up. Recent split begins May 17, 2026 20:43 UTC.

For each event, future labels start at the **next minute open**. Store
1/4/12/24h close return, maximum favorable/adverse movement, and which of
+1.4% or -2% is reached first. Both in one minute is ambiguous; missing
future is censored. Labels are never imported by the gate or replay worker.

Touch controls are earlier away-from-zone hours, matched on past 4h return
sign and proximity plus 24h volatility, within a prior 30-day window and
at least 24h earlier. Return difference tolerance 0.5 percentage points;
ATR24/close ratio 0.8-1.2; distance from every then-known zone exceeds 3%.
Matching minimizes absolute log volatility ratio plus return difference,
with most-recent tie-break. Outcomes do not participate in matching.
Unmatched cases and reused controls are disclosed. These are descriptive
controls, not randomized experiments; overlapping events are correlated.

Existing HL sell-acceleration/price-impact context is stored at the event
and 15m earlier, requiring all 60 minute windows and their availability.
It is descriptive only. Earlier data without receipt timestamps retains
the existing modeled-availability caveat. Unknown is separately recorded.

Join archived Agg10 entries and completed episodes to state **at their
entry decisions**. Report warnings that arrive only after an entry as a
separate category. Avoided historical losses are not assumed saved profit.

## Small economic experiment

Two definitions, frozen before economic outcomes:

| Variant | Fresh-entry veto starts | Release |
|---|---|---|
| accepted_base | Two hourly closes below frozen support | Common recovery above |
| retest_base | Later failed retest of that broken support | Common recovery above |

Both apply only at otherwise eligible, affordable `nextDepth === 1`.
Deeper adds, sizing, TP, cooldowns, high exits and 14d partials are unchanged.
The two variants share source state; a failed retest does not start a new
independent failure or reset the recovery clock.

Twenty paths: eight exact archived B17/Agg10 controls; eight alternatives
(two rules x two windows x two TP assumptions); four recent +60s delayed
gate-availability sensitivities. Each comparison uses its identical Agg10
baseline. Delay changes only the new gate, not the existing strategy.

Recent window: May 17, 2026 20:43 to September 15, 2026 20:20 UTC.
Longer published window: July 1, 2025 to August 19, 2026 21:32 UTC.
These overlap and are not independent holdouts. Flat start $32,000,
$800 x 1.35, max 11, standard 0.055% per side. No maker fee/queue benefit,
funding cash, liquidation certification or actual $19,450-account claim.

Screen unchanged from MS01: recent net delta >=$1,000; longer >=$0;
every monthly delta >=-$250; no DD increase; at least 20 affected recent
failure spells; delayed recent net delta >=$0. Passing would remain research,
not deployment approval; require 30-60 days forward observation.

## Artifacts and commands

Cards:

- `research-inputs/major-recovery-ma01-2026-09-16.json`
- `research-inputs/major-recovery-ms02-2026-09-16.json`

```powershell
node -r ts-node/register scripts/major-recovery-tests.ts
node -r ts-node/register scripts/major-recovery-replay-tests.ts
node -r ts-node/register scripts/major-recovery-atlas.ts plan
node --max-old-space-size=8192 -r ts-node/register scripts/major-recovery-atlas.ts run ATLAS_KEY
node --max-old-space-size=8192 -r ts-node/register scripts/major-recovery-verify.ts ATLAS_KEY
node --max-old-space-size=4096 -r ts-node/register scripts/major-recovery-match-audit.ts ATLAS_KEY
node -r ts-node/register scripts/major-recovery-replay.ts plan
node --max-old-space-size=8192 -r ts-node/register scripts/major-recovery-replay.ts run REPLAY_KEY
node --max-old-space-size=8192 -r ts-node/register scripts/major-recovery-replay-verify.ts REPLAY_KEY
```

Replace keys with newly planned immutable job IDs. Never rerun or overwrite
a claimed job. Plan fingerprints include inputs, code and protected files.
Eight control digests and metrics must match before the first alternative.
Separate checkers validate raw source bars/pivots, future-label exclusion,
past-only prefixes, entries/vetoes, full ledgers, fee/mark/DD/monthly totals,
and unchanged TP/high-exit/partial decisions. Full artifacts stay local
under `backtests/research-workflow`; findings and source remain reviewable.
