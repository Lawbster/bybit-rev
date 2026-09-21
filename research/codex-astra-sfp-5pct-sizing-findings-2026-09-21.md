# SF07 sizing follow-up: 5% stop padding, $10k versus $20k notional

## Result

- Same 5% candidate on the same $32,000 starting account: full adverse drawdown
  rises from **5.29% to 9.01%**, net from **+$11,495 to +$22,989**.
- Closed outcomes remain **65 wins / 36 losses**. Average loss doubles from
  $331 to $661; worst realized loss doubles from $963 to $1,926.
- This is a fixed-size sensitivity, not a new entry/exit strategy or live
  qualification. Funding, size-dependent execution and shared-ladder risk are
  not modeled. No live changes.

## Method and results

Reused [SF07](codex-astra-sfp-wide-stop-grid-findings-2026-09-20.md)'s exact saved
5% configs, scans and replay engine. Only `notional` changes from 10000 to 20000;
`equity` stays 32000. No new detector, stop grid, candle data or indicators.
Original absolute 2R target, 24h cap, one-position ownership and 0.055% taker fee
per side retained. 5% means extra below the original structural stop, **not a
fixed 5% entry-to-stop distance**; median actual stop distance is about 6.95%.

Full period: December 27, 2024 00:00 to September 15, 2026 20:20 UTC.
Primary clock: 60s source availability, no extra action delay, stop-first ambiguity.

| Window / metric | $10k notional | $20k notional |
|---|---:|---:|
| Full net | +$11,495 | +$22,989 |
| Full wins / losses | 65 / 36 | 65 / 36 |
| Full adverse DD | 5.29% | 9.01% |
| Full average loss | -$331 | -$661 |
| Full worst realized loss | -$963 | -$1,926 |
| Mean initial stop-price dollar risk | $719 | $1,438 |
| Older net (through May 31, 2026) | +$8,263 | +$16,525 |
| Older adverse DD | 5.29% | 9.01% |
| Recent net (June 1 through cutoff) | +$3,232 | +$6,464 |
| Recent adverse DD | 3.06% | 5.92% |

Net includes cutoff open MTM; fees included, funding excluded. Dollar gains,
losses and peak-to-trough dollar moves scale with size under this model. DD
percentage is recomputed against the evolving account peak, not starting capital:
`(previous peak equity - adverse equity) / previous peak equity`. Larger accumulated
profits also increase the denominator, so 5.29% does not simply become 10.58%.

The earlier approximately 5.7% DD belonged to **6% padding**, not the 5% candidate.
The $10k figure is position notional, not the DD-account balance. These percentages
must not be transplanted to a smaller account or added to live ladder DD.

## Verification and sensitivity

- Archived 5% parent output hashes, engine/event pins and candle-tape hash checked.
  Both $10k replay identities match the archived parents exactly.
- 36 new paths: 2 source lags (60/120s), 3 windows and 6 cost/delay/ambiguity
  cases. Every path passed the existing independent structural accounting audit.
- Every path preserves W/L, TP/SL/timeout counts and signal/occupancy counts;
  net, winning dollars, losing dollars, average loss and worst loss equal twice
  the corresponding $10k result within tolerance. No equity exhaustion.
- At 120s availability, $20k full net is +$22,664 and DD 8.97%.
- Primary extra-5bps-per-side stress: +$20,936 net, DD 9.70% at $20k.
- Monthlies and trade ledger remain in each replay directory. Monthly dollar
  deltas also scale with notional; sizing does not fix the parent's failed
  monthly/recent-DD screen. No forward/live execution claim.

## Saved outputs

- 60s source: `backtests/setup-replays/b05199b12851c6e11114a3c6782692168f3de3f15e03ec0ba31bc7ac80df9d78/`
- 120s source: `backtests/setup-replays/ea7325c4695455fb9c2a4b0b73586829b174950277fab928132f9663a005e6e1/`

Each contains pinned `plan.json`, `results.json/csv`, `monthly.json/csv`, primary
trade CSV, `audit.json` and hashed `complete.json`. Reproduce through existing
`runReplay` using the saved `plan.cfg`; no separate sizing engine was introduced.
No commit or push.
