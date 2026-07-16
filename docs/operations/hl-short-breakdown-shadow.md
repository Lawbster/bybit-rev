# HYPE HL Short-Breakdown Forward Shadow

This runbook covers the read-only forward observer for `hl_bid_pull_break`. The process records theoretical short entries and exits. It cannot submit orders, write bot control signals, restart PM2, or alter live configuration.

## Frozen observation policy

The observation cohort is identified by `policyVersion=1` and a durable policy signature. A decision is evaluated only at a completed 15-minute boundary `T`.

Required inputs:

- 30 continuous completed Bybit one-minute candles through `T`;
- at least 12 Hyperliquid taker-minute rows with collector timestamps in `[T-15m,T)`;
- at least 12 Hyperliquid order-book minute buckets in `[T-15m,T)`;
- Hyperliquid asset context newer than three minutes at `T`.

The signal fires only when all of these are true:

- the completed 15-minute candle is red;
- it closes below the preceding completed 15-minute low;
- its exact 15-minute return is at most `-0.20%`;
- HL 15-minute taker buy/sell ratio is below `0.90`;
- the latest five-minute mean HL 0.5% book imbalance is below `-0.05`;
- that five-minute imbalance is more than `0.15` below the preceding ten-minute mean.

Rows timestamped exactly `T` are excluded. This deliberately gives the taker stream one extra minute of latency and avoids a boundary-ordering assumption.

Theoretical execution is frozen at TP `2%`, stop `4%`, maximum hold `12h`, stop-first within an ambiguous one-minute candle. Each signal tracks two entries:

- `decision_open`: the one-minute open stamped `T`;
- `delay_1m_open`: the next one-minute open stamped `T+1m`.

Both report PnL at `0.11%` and `0.20%` round-trip cost. No short ladder is modeled or authorized.

## Research and parity anchor

The frozen policy was selected from the strict common pulse window 2026-05-17 20:45 UTC through 2026-07-16 00:45 UTC. After the historical harness was changed to call this same policy module, it reproduced:

- 42 raw fires and 36 non-overlapping TP2% / SL4% / 12h trades;
- first half `n=16`, `+0.916%` expectancy after 0.11% costs;
- second half `n=20`, `+1.153%` expectancy;
- second half `+1.063%` at 0.20% costs;
- second half `+0.810%` with both a one-minute entry delay and 0.20% costs.

These figures are a parity anchor, not a promise of forward performance. Do not tune thresholds or exits during the observation cohort.

## Durable files

| File | Purpose |
|---|---|
| `data/HYPEUSDT_hl_short_breakdown_shadow.jsonl` | Append-only decisions, signals, theoretical opens and closes |
| `data/HYPEUSDT_hl_short_breakdown_shadow_state.json` | Atomic restart/replay state and cumulative counters |
| `data/HYPEUSDT_hl_short_breakdown_shadow_health.json` | Atomic heartbeat consumed optionally by the operational watchdog |

Do not delete or edit the state file during the observation cohort. The process refuses to load state created under a different policy signature. Archive all three files before intentionally starting a new cohort.

Journal delivery is at-least-once across a crash. Every logical decision, signal, open and close has a deterministic `eventId`; downstream summaries must de-duplicate by that field. Atomic state remains the authority for cumulative counters and restart progress.

## Verification before starting PM2

From `/opt/bybit-rev`:

```bash
git pull --ff-only
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run hl-short-shadow -- --once --dry-run
```

The dry run must show:

- `shadowOnly: true`;
- `candidate: "hl_bid_pull_break"`;
- `status: "healthy"`;
- all four sources present and fresh;
- a completed decision with `ready: true`.

Dry-run mode writes no shadow state, event log, or health file.

## Add the PM2 process

This is a new read-only process and therefore an intentional topology change:

```bash
pm2 start dist/bot/hl-short-breakdown-shadow.js \
  --name hype-hl-short-shadow \
  -- --symbol=HYPEUSDT

sleep 20
pm2 logs hype-hl-short-shadow --lines 100 --nostream
jq '{shadowOnly, candidate, policyVersion, status, statusReasons, decision, active, integrity, counters}' \
  data/HYPEUSDT_hl_short_breakdown_shadow_health.json
npm run watchdog -- --once --dry-run
pm2 restart hype-health-watchdog
sleep 15
npm run watchdog -- --once --dry-run
pm2 ls --no-color
```

The first watchdog dry run verifies the newly built evaluator before its managed process is restarted. The second verifies the restarted service against the fresh shadow heartbeat. Only after the health snapshot and both watchdog dry runs are clean:

```bash
pm2 save
systemctl is-enabled pm2-deploy.service
```

Starting this process does not require restarting `hedgeguy-bot`, `bybit-collect`, or `hl-collect` if their source files are already fresh.

## Normal operation

The process polls appended JSONL bytes every five seconds and retains a bounded 48-hour in-memory window. Expected steady state:

- health file updates every approximately five seconds;
- one `decision` event per completed 15-minute boundary;
- most decisions have `fired=false`;
- `signal` is followed by both theoretical `open` modes when their completed one-minute candles become available;
- exits are recorded independently for immediate and one-minute-delayed tracks.

Useful checks:

```bash
stat -c '%y %s bytes' data/HYPEUSDT_hl_short_breakdown_shadow_health.json
tail -n 20 data/HYPEUSDT_hl_short_breakdown_shadow.jsonl | jq -c .
jq '{status, statusReasons, decision, active, counters}' \
  data/HYPEUSDT_hl_short_breakdown_shadow_health.json
pm2 describe hype-hl-short-shadow
```

Once the health file has been created, the existing alert-only watchdog reports a stale heartbeat or degraded shadow. Before the first start, an absent health file is intentionally ignored so a code pull alone does not create an incident.

## Incident handling

For `hl_short_shadow_heartbeat_stale`:

```bash
pm2 describe hype-hl-short-shadow
pm2 logs hype-hl-short-shadow --lines 200 --nostream
stat -c '%y %n' data/HYPEUSDT_hl_short_breakdown_shadow_health.json
```

For `hl_short_shadow_degraded`, inspect `statusReasons`, the latest decision blockers, and the four source timestamps. Then inspect only the demonstrated unhealthy producer:

```bash
pm2 logs bybit-collect --lines 200 --nostream
pm2 logs hl-collect --lines 200 --nostream
```

Do not delete state or repeatedly restart the process to clear an incident. A long catch-up gap is fail-closed and explicitly recorded.

## Promotion boundary

The shadow must remain frozen for at least 30 days and 15 closed immediate-entry trades; extend to 60 days if the sample is smaller. A later deployment review requires:

- positive PnL after `0.20%` costs for both entry modes;
- exact decision/evidence audit with no duplicate or missed decisions;
- stable performance across the observation weeks;
- a portfolio replay against the live HYPE long ladder;
- one transactional owner for Bybit's HYPE hedge-side position.

Passing this forward observation does not authorize turning this process into an executor. Any trading implementation is a separate architecture and review task.
