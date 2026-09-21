# SF08: 5% SFP candidate through the latest synced candles

## Result

- **Yes: the September 15 SFP survives with 5% extra stop padding and hits TP**
  on September 16 at 11:27 UTC, before the original 24h timeout. Net +$240.41
  at $10k notional or +$480.82 at $20k, after modeled fees and before funding.
- Full candidate totals become **66 wins / 36 losses, +$11,709.71, DD 5.29%**
  at $10k, or **+$23,419.41, DD 9.01%** at $20k on the same $32k account.
  No open trade remains at the new cutoff. No new confirmed SFP signal after
  the previous cutoff; this is completion of its existing position.
- Cutoff extended from September 15 20:20 to **September 21, 2026 00:22 UTC**.
  Old-prefix results and closed trades preserved exactly; 72 extended paths
  independently audited. No strategy tuning, live changes, commit or push.

## The trade, side by side

All times UTC; primary source lag 60s and zero additional action delay.
Original completed 4h range-SFP signal and absolute original 2R target unchanged.

| Item | Original stop | 5% extra padding |
|---|---:|---:|
| Entry | Sep 15 16:01, $77.23 | Same |
| Stop | $76.27365 | $72.4599675 |
| Target | $79.1727 | Same |
| Exit | Sep 15 18:37, stop | Sep 16 11:27, TP |
| Net at $10k | -$134.76 | +$240.41 |
| Net at $20k | -$269.53 (scaled same trade) | +$480.82 |

Lowest price while the padded position remained open: **$75.09**, approximately
2.77% below entry, above its padded stop. Hold time **19h26m**; the TP occurs
4h34m before timeout. This is not an eventual target reached after the allowed hold.
Five percent is padding below the old stop; this trade's actual entry-to-stop
distance is about 6.18%. Target fills here are modeled touch fills, not proof of
a real exchange fill at the unrounded price.

Occupancy still matters: after the original stop-out, the unchanged strategy
enters another SFP at September 15 20:01, $77.31. That trade times out September
16 20:01 at $78.69 for +$167.40. The 5%-padded position occupies that entry time
and does not take both trades. Its profitable rescue is therefore not an extra
$375 on top of an otherwise identical subsequent path. The unchanged replacement
trade's $81.57018 target is only touched September 17 13:01, after its timeout;
that later touch is not counted as a TP.

## Updated strategy totals

Same fixed notional, separate $32,000 starting account, original 24h cap and
0.055% taker fee each side. Full start December 27, 2024; recent start June 1, 2026.
All rows end September 21, 2026 00:22 UTC. No funding or live portfolio overlay.

| Window / setup | Wins / losses | Net | Adverse DD |
|---|---:|---:|---:|
| Full / original stop, $10k | 44 / 79 | +$2,842.23 | 7.92% |
| Full / 5% padding, $10k | 66 / 36 | +$11,709.71 | 5.29% |
| Full / 5% padding, $20k | 66 / 36 | +$23,419.41 | 9.01% |
| Recent / original stop, $10k | 13 / 11 | +$1,549.55 | 2.47% |
| Recent / 5% padding, $10k | 16 / 5 | +$3,447.03 | 3.06% |
| Recent / 5% padding, $20k | 16 / 5 | +$6,894.05 | 5.92% |

The previous $10k candidate net already included +$25.24 of open-position MTM.
The new net increases by **$215.17**, not the full $240.41 close again. This one
close does not resolve the earlier monthly/recent-DD qualification failures.

## Data, causality and verification

- Sealed historical prefix reused unchanged; only **7,442 minutes** added.
  The full old tape was not copied into another JSONL file. The small extension
  is stored separately, with input and source-code hashes.
- One missing minute was recovered using public Bybit 1m and native 5m
  responses: six local neighbors matched and the complete native5m aggregate
  matched. Raw collector files were not edited. The repair's actual retrieval
  times remain recorded, never passed off as original live receipt.
- Primary comparison retains inherited historical modeled availability. A
  separate detector pass uses recorded extension receipts and the repair's late
  retrieval. Confirmed events are identical at both 60s and 120s source clocks;
  the gap does not affect this trade, which already exited September 16.
- Old confirmed event serialization, original action prefix, old-cutoff stats
  and closed trade entry/exit/stop/target/fee/net records match the archive.
  Old open positions retain their original entry time and deadline.
- 72 audited extended paths: 3 size/stop cells x 2 source clocks x 2 windows x
  6 execution-delay/ambiguity/cost cases. Original stop and 5% controls retained.
- At 120s source lag the padded trade enters at $77.37 and exits at the same TP
  time/target: +$221.87 at $10k, +$443.74 at $20k. The favorable outcome survives
  that entry-delay sensitivity, but the exact dollar result is not guaranteed.
- Focused stop-padding and setup-replay tests passed. A separate direct scan of
  synced candles confirmed original-stop crossing, first TP touch, minimum held
  price and absence of a padded-stop crossing before TP.

## Saved artifacts

[Frozen extension card](../research-inputs/sfp-latest-candles-sf08-2026-09-21.json).
[Interactive replay: original stop and both 5% sizes](../backtests/sfp-latest-candles/54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e/replay.html).
[Comparison, monthly results, parity and arrival checks](../backtests/sfp-latest-candles/54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e/comparison.json).

The same directory contains source pins, extension candles, repair witnesses,
event ledgers and primary trade/action records. Hashes in `complete.json` seal
the outputs. Runner: `npx ts-node scripts/sfp-latest-candles.ts`; unchanged inputs
reuse and verify the saved job. A later sync requires a new cutoff/input identity.
