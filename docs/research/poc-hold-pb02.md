# PB02: daily NPOC touch holding-time comparison

Frozen September17,2026. User requested **1,2,3,4,5,6,8,10,12 hours**.
Only the holding deadline changes;12h is the existing PB01 baseline.

## Reused inputs

- Accepted PB01 `naked_day_touch` signal tape:264 full-history events.
- Same Bybit $0.10 daily POC geometry and first-retest lifecycle. Levels
  published at completed period end+60s. Closed touch minute, next-open buy.
- Same corrected canonical minute candles and witnessed repair, ending
  Sep15,2026 20:20 UTC. Source hashes must match the accepted parent.
- Same execution engine; **no map build, trade-tape download or signal rebuild**.

Full window: Dec5,2024 12:55 to cutoff. Older: start to Jun1,2026. Recent:
Jun1 to cutoff. Each resets inventory independently. Full/recent overlap;
do not add them as independent returns or samples.

## Rules

$10,000 long notional; one position per independent duration, no adds or
compounding. Time begins at actual entry. Market close at the fixed deadline;
no TP, SL, partial or indicator exit. All pending/occupied signals skipped,
not queued. Every duration starts from **all raw signals**, not just the
baseline's accepted trades, so occupancy and replacement entries are genuine.

0.055% taker fee each side on actual turnover. No funding, maker discount,
isolated-margin/liquidation or queue simulation. Primary next-open execution
and+1minute extra delay to both actions. Five extra basis points per side
reported as fixed-path cost stress, not a second fill model.

Adverse MTM drawdown on$32,000 equity uses minute lows against prior close
peaks. Cutoff inventory includes estimated closing fee but is not a completed
win/loss. Monthly W/L belongs to exit month; monthly MTM includes carry.

## Controls, attribution and qualification

Six archived12h paths must reproduce **exactly before variants run**: trade
IDs, timing, prices, fees, open marks, statistics, monthly MTM and drawdown.
Eight new horizons across three windows/two delays give48 variant paths;
plus six controls =54. This is not a B17/Agg10 comparison.

For each pair decompose net change into:

`common-entry exit change + variant-only entries - baseline-only entries`.

Open marked positions join that identity when applicable. Per-entry attribution
is descriptive and reconciles net exactly; it is not another policy replay.

Strict relative screen: positive net and positive delta versus12h on all six
paths; no greater adverse DD; >=30full and>=10older/recent closes; positive
extra-cost stress; no exhausted equity; no negative monthly marked delta.
The unqualified parent does not become deployable merely because a variant
beats it. Report failed paths/months; do not add horizons after reading results.

## Reproduction / verification

```powershell
node -r ts-node/register scripts/poc-hold-tests.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-hold-study.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-hold-verify.ts backtests/poc-hold/KEY
```

55 synthetic checks cover all nine holds, both delays, month crossings, pending
ownership, cutoff marks and poisoned future candles. Independent verifier
rechecks264 signal clocks and reruns all54 paths in the existing separate
minute engine, including W/L, fees, occupancy, monthly accounting and DD.
It also checks archived-control parity, attribution and screen classification.

Content-addressed outputs are immutable, with input/source hashes and an
independent receipt. `report.md`, `results.csv`, `monthly.csv`, attribution,
signals and every execution path remain saved. Live configuration is untouched.
