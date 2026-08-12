# Maker-TP Fill Shadow (fee-optimization stage 1)

Read-only observer measuring whether the long ladder's TP and stale-TP exits
could have executed as resting post-only maker limits instead of market closes,
and what fee/price delta that would have produced. It submits no orders, holds
no API keys, and changes no live behavior. This is the evidence stage for the
maker-TP execution change; the change itself is a separate, gated project.

## Method

- Tracks the bot's TP intent timeline from the atomic
  `data/HYPEUSDT_runtime_health.json` snapshot (`desiredLongTp`), anchoring
  each intent price change with whether the market was below the level at that
  moment (postability for a post-only sell limit).
- Detects real exits from `logs/trades_<date>.jsonl` `BATCH_CLOSE` rows. A
  close counts as a TP-path exit only when it filled at or above the resting
  intent price minus 0.1%; forced flattens drop out automatically.
- On each TP close it fetches Bybit **public** recent trades (no auth) and
  measures printed volume strictly above the intent price in the touch window —
  the volume a resting sell limit at that price was guaranteed to receive.
  Prints exactly at the level are recorded separately (queue-position
  dependent) and never counted as fills.
- Journals one `maker_tp_counterfactual` row per close with postability, lead
  time, touch margin, strict fill ratio, and the counterfactual fee saving
  (maker 0.02% on the fillable fraction, taker 0.055% fallback on the rest)
  plus the price delta of filling at the limit versus the actual exit price.
  Fee rates were exchange-verified 2026-08-12.
- Historical closes from before process start are never evaluated: a fresh
  cohort begins at process birth because old closes have no trustworthy
  intent anchor.

## Files

| File | Purpose |
|---|---|
| `data/HYPEUSDT_maker_tp_shadow.jsonl` | Append-only intent and counterfactual journal |
| `data/HYPEUSDT_maker_tp_shadow_state.json` | Atomic restart state, dedupe watermark, cumulative counters |
| `data/HYPEUSDT_maker_tp_shadow_health.json` | Atomic heartbeat |

## Deploy

```bash
cd /opt/bybit-rev
git pull --ff-only
npm run build
npm run test:maker-tp-shadow
pm2 start dist/bot/maker-tp-fill-shadow.js --name hype-maker-tp-shadow
sleep 15
jq '{status, statusReasons, anchor, counters}' data/HYPEUSDT_maker_tp_shadow_health.json
pm2 ls --no-color
pm2 save   # only after the topology is verified
```

No other process needs a restart. The watchdog does not consume this health
file; add coverage only as a separate reviewed change.

## Decision gate

Accumulate at least 15-20 TP/stale closes (roughly 2-4 weeks at recent cycle
rates), then read the counters: if the postable share and strict full-fill
share are high (calibration study predicts ~90%+) and `estTotalDeltaUsd`
tracks the projected ~$700/month at recent churn, stage 2 (the actual maker-TP
execution path with partial-fill-safe transactional handling and a permanent
market fallback) is justified. If fills are frequently partial or postability
is poor, stage 2 is falsified cheaply — record the result either way.
