# BH03 / L16: fifteen-minute entry patience

Frozen before outcomes, September 14, 2026. Local research only; no production
or canonical-engine changes. Six new ladder definitions; no new BTC signal.

## BH03: execution-pricing sensitivity, not a new signal search

Keep BH02's BTC 1h crossing <=-0.5%, $10k HYPE buy, 12h fill-relative hold,
15m exclusive expiry, frozen last-closed-minute close, 0/60s placement/exit
delay, occupied-account rules, and 0/5bps raw-open penetration proxies.
First reproduce twelve archived cases: original market and both 15m cap-price
models, two periods and two delays. Then test 0/2/5/10bps adverse execution cost
each side, INCLUDING the original market benchmark at the same cost.
Buy proxy = minute open * (1+cost); sell proxy = open * (1-cost).
Capped orders require BOTH raw-open penetration and modeled buy <= frozen cap;
they receive that modeled buy, never a favorable price clipped down to the cap.
60 runs = 12 exact controls + 48 economic sensitivities. Fees 0.055% per side.
No quote/queue/partial-fill certification; corrected candles are not live receipts.
The zero-cost case is optimistic, and stricter fills are not PnL lower bounds.

## L16: six ladder rules, fifteen-minute window held fixed

Unchanged Aggressive10 is the incremental parent; B17 remains a reference.
Two scopes: timer-only adds at next depth >=2, or >=8. Three offsets below the
closed-minute reference: 0%, 0.1%, 0.3%. First rung is unchanged. No BTC rule.
At the first otherwise gate-approved affordable timed opportunity, freeze its
close, target, episode, next depth and effective 30/60m interval. Window expires
at signal+15m exclusively. Never refresh its reference. Earliest re-arm after
expiry/cancellation is signal+effective interval; actual fills reset the normal
last-add clock. This reservation does not block ordinary price-drop adds.

On each minute, ordinary exits and gates run first. A qualifying price-drop add
cancels the waiting timer and retains its original execution. Any inventory
mutation, missing minute, or lack of gate approval cancels a timer opportunity.
No duplicate add, no queued expired order, no waiting order allowed to block TP,
partial or flatten. Canceling a waiting research opportunity is not an exchange
cancel simulation. Scope excludes real order deployment.

A timed entry is proposed only after a CLOSED minute meets the frozen target;
it fills at the following minute OPEN only if that open remains <= target.
If not, retry the same frozen opportunity while valid. No wick-only fills, no
unclosed indicator/source values, no synthetic candle interpolation. All normal
sizing, fees, TP/exit policies and entry gates remain unchanged.

Primary: next-open price; 24 variants = six x two periods x two TP assumptions.
Sensitivities on the recent window only: charge target instead of better open
(12 cases), or require 60s minimum elapsed since opportunity activation before
proposal (12 cases). This delay applies to the new waiting mechanism, not an
assertion of actual API latency or a uniformly delayed baseline. Eight exact
archived B17/Aggressive10 controls precede variants: total 56 ladder runs.

Periods/cutoff match existing archives, including the overlapping published
July 2025-August 2026 and recent May 17-September 14, 2026 15:27 UTC windows.
BH03's older window is January 20, 2025-May 17, 2026. Neither is untouched data.
Do not combine their PnLs. L16 preserves the existing 0.055% taker fee baseline;
no maker rebate/queue, funding cashflow or exact liquidation claim.

## Verification and report

Freeze input/source/protected-file hashes. Generate separate engine derivatives
with asserted exact source edits; zero-option engines must reproduce parent
digests before new variants run. Independently reconstruct executions, fees,
open inventory, monthly equity, DD and window transitions. Fixtures cover cap
boundary, expiry, gated cancellation, no immediate re-arm, price-drop priority,
inventory invalidation, delay and future-poison/prefix invariance.

Report baseline-adjacent W/L counts and dollars, average loss, net realized/marked,
DD, TP/flatten counts, terminal inventory, monthly deltas, intervention counts,
missed/replacement episodes and fixed-path cost sensitivity. Full ladder screen:
recent incremental net >=$1000, published net >0, no worse DD, every month delta
>=-$250, at least20 affected recent episodes, no nonpositive equity. Sensitivities
must retain positive incremental net. None of these is live qualification.
