# BH02 — price-capped BTC-dip entries with expiry

Frozen September 14, 2026, before this experiment's results. Research only.

Parent is BH01 `btc_L1_T0.5_P-1_long_H12`: BTC trailing 1h return crosses from
above -0.5% to <=-0.5%, checked at completed UTC 15m boundaries. Buy $10k HYPE,
hold 12h from actual fill, no TP/SL. $32k equity, 0.055% fee each side. Same
older/recent nonoverlapping periods and cutoff September14 15:27 as BH01.

## Only new strategy parameter: expiry

Freeze HYPE's most recent CLOSED 1m close at the signal. Do not re-anchor later.
Allow 5/15/30/60 minutes from that signal to obtain entry at/below the cap.
The deadline is exclusive; an open at the expiry timestamp is too late. No market
chase after expiry. A pending order occupies the account and suppresses subsequent
signals. On expiry, a genuinely fresh signal may be accepted; the expired one is
never replayed. Delay does not extend signal life. Hold time starts at actual fill.

Four new definitions, two periods, 0/60s entry/exit delay, two fill assumptions:
32 variant cases. First reproduce eight exact BH01 controls: original BTC-dip
market entry and same-readiness clock entry, each period/delay. The new local
engine's market mode must match original economics/trades/open inventory before
any capped variant runs. No B17/Aggressive10 replay is changed by this study.

## Cautious OHLC execution proxies, not guaranteed fills

- `open_cap`: while an order is eligible, a minute OPEN at/below the frozen cap
  is a fill opportunity. Charge the cap, even when that open is lower.
- `open_through5`: require that minute OPEN to be at least 5bps below the cap;
  still charge the cap. This tests stricter fill support, not lower pricing.
- No wick/low-only fills; those are counted separately as ignored opportunities.
- Both proxies assume full $10k fills and lack ask/queue/volume evidence. Neither
  proves an executable limit fill. Equal-price opens in the first model are
  explicitly unverified opportunities. No price-improvement or maker-fee benefit.
- Current minute open can determine execution, never the earlier BTC signal or
  frozen anchor. Current minute high/low/close only affect marks/diagnostic counts.
- Exit at entry+12h+0/60s, using the minute open; entry/exit end-cutoff handling is
  identical to BH01. Pending signals at cutoff are censored, not called expired.
- Stricter fill support is not a mathematical worst-case PnL bound: missing a
  trade can change all later occupancy and returns.

## Attribution and screen

Report absolute net, W/L amounts, mean loss, DD, open mark and monthly deltas versus
the ORIGINAL BTC-dip entry with the same delay. Retain the no-signal clock as a
separate benchmark, not an interchangeable baseline. Screening floor is the repo's
-$250 monthly delta convention versus parent; also disclose stricter zero-month
failures. All period/delay/fill cases must improve net, not worsen DD, remain
positive after fixed5bps/side cost stress, and meet 30 older/10 recent trades.
This is only a research screen, never live qualification.

Partition actual trades by original signal ID into matched, removed baseline and
new replacement trades. Include winners missed and losses avoided, not only
successful capped fills. Matched entry quality and later exit timing are separate
attributions (not new replays). Pending/expiry effects and masked BTC data gaps
remain visible. No inference about ladder profitability or sizing from these runs.

## Reproduction

```powershell
node -r ts-node/register scripts/btc-dip-price-cap-tests.ts
node -r ts-node/register scripts/btc-dip-price-cap-study.ts plan
node --max-old-space-size=6144 -r ts-node/register scripts/btc-dip-price-cap-study.ts run JOB_KEY
node --max-old-space-size=6144 -r ts-node/register scripts/btc-dip-price-cap-verify.ts JOB_KEY
```

Runner/verifier/card and existing parent evidence are pinned. Accepted BH01 files
are read-only. No new raw data, exchange request, config/state or service writes.
