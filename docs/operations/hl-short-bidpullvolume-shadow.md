# HYPE HL Bid-Pull-Volume Forward Shadow

This runbook covers the read-only forward observer for `hl_bid_pull_volume`,
the second frozen short candidate from the 2026-07-16 short-system study
(refreshed 2026-08-10). The process records theoretical short entries and
exits. It cannot submit orders, write bot control signals, restart PM2, or
alter live configuration.

## Isolation from the live short owner

This observer must never share an identity axis with the traded
`hl_bid_pull_break` signal. The live `hl-short-live` owner tails only its
configured breakdown journal and rejects any event whose candidate is not
`hl_bid_pull_break`, whose signal id does not start with `hlbp-HYPEUSDT-`, or
whose policy version does not match. This observer differs on every one of
those axes **and** writes a different journal file:

| Axis | Live signal | This observer |
|---|---|---|
| Journal file | `HYPEUSDT_hl_short_breakdown_shadow.jsonl` | `HYPEUSDT_hl_short_bidpullvolume_shadow.jsonl` |
| Candidate id | `hl_bid_pull_break` | `hl_bid_pull_volume` |
| Signal id prefix | `hlbp-HYPEUSDT-` | `hlbpv-HYPEUSDT-` |
| Policy version | breakdown v2 | bidpullvolume v1 |

`scripts/hl-short-bidpullvolume-shadow-tests.ts` replays the live owner's
exact validation predicate against every journaled row and asserts rejection.
Do not add this candidate to the breakdown journal, and never point
`hl-short-live-config.json` at this observer's files.

## Frozen observation policy

`policyVersion=1`, signature
`hl_bid_pull_volume|v1|obDelta<-0.15|vol15>1.25|red15|taker<0.9|tp1.5|sl4|hold14400000`.
A decision is evaluated only at a completed 15-minute boundary `T`.

Required inputs (fail closed on any miss):

- 15 continuous completed Bybit one-minute candles with volume in `[T-15m,T)`;
- a complete 24-hour volume baseline: 1,440 continuous one-minute candles with
  volume covering the 96 completed 15-minute bars in `[T-24h15m, T-15m)`;
- at least 12 Hyperliquid taker-minute rows in `[T-15m,T)`;
- at least 12 Hyperliquid order-book minute buckets in `[T-15m,T)`;
- Hyperliquid asset context newer than three minutes at `T`.

The signal fires only when all of these are true:

- the completed 15-minute candle is red;
- its volume exceeds `1.25x` the mean of the prior 96 completed 15-minute bars;
- HL 15-minute taker buy/sell ratio is below `0.90`;
- the latest five-minute mean HL 0.5% book imbalance is more than `0.15` below
  the preceding ten-minute mean.

Unlike the live break signal, it does **not** require a break of the previous
15-minute low, a minimum 15-minute return, or an absolutely ask-heavy book.
Rows timestamped exactly `T` are excluded, matching the break shadow's
availability convention. Raw signals are separated by a 60-minute cooldown.

Theoretical execution is frozen at TP `1.5%`, stop `4%`, maximum hold `4h`,
stop-first within an ambiguous one-minute candle, with `decision_open` and
`delay_1m_open` tracks at `0.11%` and `0.20%` round-trip costs — the study's
train-selected `S_tp1.5_sl4_h4` exit. Do not tune thresholds or exits during
the observation cohort.

## Research and parity anchor

Study evidence (84.10-day strict window, 2026-05-17 20:45 → 2026-08-09 23:15
UTC, `research/codex-hl-short-system-refresh-2026-08-10.md`): train `n=25`
`+0.748%`, test `n=27` `+0.348%`, test at 0.20% fees `+0.258%`, one-minute
delay at 0.20% fees `+0.190%`, 10/13 active weeks positive. August was
negative (`n=5`, `-0.453%`) — that regime sensitivity is part of what this
forward cohort must resolve.

Implementation parity (`scripts/hl-short-bidpullvolume-parity-check.ts`, run
2026-08-12 against `backtests/hype/hl-short-study-2026-08-10/decision-features.csv`):
8,075 decisions compared, zero fire mismatches, maximum volume-ratio relative
difference `4.2e-15`. Five decisions diverge only because this implementation
fails closed on one-minute gaps inside the 24h volume baseline where the study
tolerated them; 53 of the study's 57 cooldowned fires reproduce exactly and no
extra fires appear. Fail-closed is intentional; do not relax it to chase the
missing four historical fires.

## Durable files

| File | Purpose |
|---|---|
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow.jsonl` | Append-only decisions, signals, theoretical opens and closes |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow_state.json` | Atomic restart/replay state and cumulative counters |
| `data/HYPEUSDT_hl_short_bidpullvolume_shadow_health.json` | Atomic heartbeat |

Do not delete or edit the state file during the observation cohort. The
process refuses to load state created under a different policy signature.
Journal delivery is at-least-once across a crash; de-duplicate by `eventId`.
The health file is not yet consumed by the operational watchdog; add coverage
there only as a separate reviewed change.

## Verification before starting PM2

From `/opt/bybit-rev`:

```bash
git pull --ff-only
npm run build
npx tsc -p tsconfig.vps.json --noEmit --pretty false
npm run test:hl-short-bpv
npm run hl-short-bpv-shadow -- --once --dry-run
```

The dry run must show `shadowOnly: true`, `candidate: "hl_bid_pull_volume"`,
`status: "healthy"` (or `warming_up`), all four sources present and fresh, and
a completed decision. Immediately after a cold start the volume baseline needs
the bootstrap tail of `HYPEUSDT_1m.jsonl`; a `volume_baseline_incomplete`
blocker that persists beyond a few minutes indicates a collector gap, not a
process fault.

## Add the PM2 process

This is a new read-only process and therefore an intentional topology change:

```bash
pm2 start dist/bot/hl-short-bidpullvolume-shadow.js \
  --name hype-hl-short-bpv-shadow \
  -- --symbol=HYPEUSDT

sleep 20
pm2 logs hype-hl-short-bpv-shadow --lines 100 --nostream
jq '{shadowOnly, candidate, policyVersion, status, statusReasons, decision, active, counters}' \
  data/HYPEUSDT_hl_short_bidpullvolume_shadow_health.json
pm2 ls --no-color
```

Only after the health snapshot is clean and the intended online/stopped set is
verified:

```bash
pm2 save
```

Starting this process does not require restarting `hedgeguy-bot`,
`hype-hl-short-shadow`, `hype-hl-short-live`, or the collectors.

## Promotion boundary

This cohort follows the standard pipeline: 30–60 days of forward observation,
then evaluation against the study's expectancy bands (n, delay, and stress
included). Even a passing forward cohort does not create an order path: any
live use must route through the single transactional `positionIdx=2` owner
design and its own reviewed arming procedure. Overlap behavior with the live
break signal (both firing in the same window) must be part of that review —
serial capital is shared and the shared-account second-slot gate (`n>=15`
overlap trades) still applies.
