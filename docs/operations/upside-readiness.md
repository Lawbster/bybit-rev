# Upside Readiness Shadow

The upside-readiness monitor answers one narrow question: if the previously validated GF-900 sizing policy were available, would the current evidence permit a `$900` ladder opening instead of the live `$800` base?

It is shadow telemetry only. It never changes configuration, chooses live notional, submits an order, writes a bot signal, restarts a process, or polls the exchange.

## Policy gates

All gates must pass simultaneously:

| Gate | Requirement |
|---|---:|
| Configured live base | exactly `$800` |
| Account equity | at least `$36,500` |
| Trailing-30-day realized PnL | at least `$3,000` |
| Hyperliquid taker buy/sell notional, 1h | at least `1.20` |
| Hyperliquid asset OI change, 4h | at least `+1.5%` |
| HYPE realized 1m volatility, 30 observations | at most `0.15%` RMS |
| Recent forced exit | none within seven days |
| Euphoria cap | inactive |
| Operational health | no current watchdog incidents |

The euphoria cap is active when the last fully completed 4h close is above its 200-period EMA and the current HYPE price is within 10% of the trailing-14-day high.

An unclassified successful full close within seven days also blocks readiness. The monitor does not assume an unmatched close was harmless.

## Evidence sources

The main bot publishes only cheap, already-available inputs in `data/HYPEUSDT_runtime_health.json`:

- configured base notional;
- local account-equity estimate and cumulative realized PnL;
- current price;
- completed-candle 4h EMA200 / 14-day-high clamp state.

The main process does not scan historical logs or pulse files. Market-clamp calculation is pure, runs at most every five minutes, and is refreshed immediately before a fresh ladder open.

The independent watchdog reads:

- `logs/equity_YYYY-MM-DD.jsonl` for the cumulative realized-PnL anchor at the 30-day cutoff;
- `logs/trades_YYYY-MM-DD.jsonl` for successful full closes;
- `data/HYPEUSDT_decisions.jsonl` to classify successful closes as TP, forced, manual/other, or unclassified;
- `data/HYPEUSDT_sr_partial_exit_actions.jsonl` for successfully executed S/R partials;
- Hyperliquid taker and asset-context streams plus HYPE 1m candles for the exact `grind_mid` discriminator.

Historical or pulse evidence fails closed when incomplete. The 30-day PnL anchor must be no more than 15 minutes before the exact cutoff. Grind data requires at least 55 one-minute taker buckets, fresh current/4h OI observations, and 31 continuous completed 1m candles.

## No-lookahead boundary

- Forming 5m candles are excluded.
- EMA200 uses fully completed 4h buckets only.
- The 14-day high uses candles available at the observation time.
- Taker, OI, and 1m volatility use rows at or before the observation timestamp.
- Flat-to-open telemetry is evaluated from the runtime snapshot immediately surrounding the observed `0 -> positive` rung transition.

## Outputs

Current status, atomically replaced approximately every five minutes:

```text
data/HYPEUSDT_upside_readiness.json
```

Every observed fresh ladder opening:

```text
data/HYPEUSDT_upside_readiness_opens.jsonl
```

Inspect the current status:

```bash
jq '{writtenAt, account, market, forcedExit, grindMid, counts30d, eligibility}' \
  data/HYPEUSDT_upside_readiness.json
```

The decisive fields are:

- `shadowOnly: true`;
- `eligibility.eligible`;
- `eligibility.wouldUseBaseUsdt`;
- `eligibility.blockers`.

Even when `eligible=true` and `wouldUseBaseUsdt=900`, the live bot remains at the configured `$800` base. Promotion to live sizing requires a separate full-window replay update, forward-observation review, explicit approval, and a separately reviewed implementation.

## Close-count interpretation

Successful `BATCH_CLOSE` trade rows are matched one-to-one with nearby TP/flatten decisions using timestamp and rung count. Results are reported as:

- TP cycles;
- forced closes;
- manual/other full closes;
- unclassified successful full closes;
- executed S/R partial exits.

Unclassified closes remain visible rather than being silently counted as TPs.

## Deployment order

The main bot and watchdog changes must be deployed together:

1. Pull and build.
2. Restart `hedgeguy-bot`.
3. Confirm the runtime snapshot updates and contains `upsideInputs`.
4. Run `npm run watchdog -- --once --dry-run` and require zero incidents.
5. Restart `hype-health-watchdog`.
6. Confirm `HYPEUSDT_upside_readiness.json` appears and remains explicitly shadow-only.

No live config change is part of this deployment.
