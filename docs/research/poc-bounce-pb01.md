# PB01: standalone POC bounce entry study

Research-only, fixed before economics on 2026-09-17. No ladder, live/config
change, new downloads, full tape reparsing or profile reconstruction.

## Scope

30 long entry rules: three profile periods (UTC day, Monday week, calendar
month), two universes, five trigger clocks. The frozen $0.10 Bybit map from
PVM01 supplies every level. Binance and HL are not used in this first pass.

- **Latest:** immediately previous completed period's eligible POC. An excluded
  period does not silently roll back to an older eligible profile. Repeated
  downward encounters require both 60 minutes since the last encounter and a
  later completed minute close at least 0.5% above the row's upper edge.
- **Naked:** any published, eligible, untouched and non-uncertain historical POC.
  First retest must be independently certified by the saved same-venue trade
  lifecycle. A first touch from below consumes naked status but creates no buy.
  Tested and uncertain profiles are never treated as naked again.

Every buy requires approach from above: previous minute close strictly above
the POC row, then range intersection with `[lower, upper)`. The level must
already exist at the touch minute's start. Latest-period encounters use an OHLC
range proxy; this alone does not prove an individual trade at the price.
Naked encounters additionally require exact first-touch evidence at that minute.

## Touch versus confirmation

| Mode | Decision | Execution |
|---|---|---|
| Touch observation | Completed 1m candle encountered row | Next 1m open |
| 1m confirmation | First completed 1m close above row after encounter | Next 1m open |
| 5m confirmation | First completed UTC 5m close above row | Next 1m open |
| 15m confirmation | First completed UTC 15m close above row | Next 1m open |
| 1h confirmation | First completed UTC hour close above row | Next 1m open |

Confirmation expires 60 minutes after the touch becomes known. The confirming
bar must start after/as the profile was published; it can contain the touch.
It need not be green. The encountered level is frozen during that wait, even
if a newer period publishes. Identical-time signals select newest originating
profile, then ID, never best subsequent return. Each mode emits once per
encounter; full signal streams are saved, including signals skipped while held.

This does **not** claim a resting limit filled at the POC. Touch entries can buy
below the row after a failed bounce. Confirmation entries may pay more. All fills
use future executable opens, not signal-candle closes, lows, or a retrospectively
selected row centre. The extra-delay test adds one full minute to both actions.

## Execution and controls

- Fixed $10,000 long notional, one independent position per rule, no adds,
  compounding or shorts. Pending/occupied signals skipped, not queued.
- Exit 12h after the actual entry, with the same declared action delay. No TP/SL:
  deliberately hold exits constant while measuring entry quality.
- 0.055% taker fee each side, actual exit turnover. Extra five basis points per
  side reported as a fixed-path cost stress. No live maker discount.
- $32,000 starting equity for drawdown; minute-low adverse MTM versus prior
  closed-minute equity peaks. Cutoff inventory marked less estimated exit fee,
  not counted in closed-trade W/L. Monthly MTM differs from exit-month W/L dollars.
- Funding excluded: these are after-trading-fee, before-funding research returns.
  No margin, liquidation, spread, queue or shared-account simulation.

Full: Dec5,2024 12:55 to Sep15,2026 20:20 UTC. Older: same start to Jun1,2026.
Recent: Jun1 to same Sep15 cutoff. Inventory resets in each run; full and recent
are overlapping views, not additive independent observations. 0/60s delays.

Controls:

1. Existing rolling 12h long clock, independently reproduced before economics.
   Same notional, fee, exit and action delays, but much greater market exposure.
2. Cash: $0 return, zero drawdown.
3. Each rule's fixed signal schedule shifted +1, +3 and +7 calendar days. These
   controls recompute occupancy and censor unavailable tail signals; all three
   must be shown, never select the weakest. Signals outside a reset window do
   not seed its shifted control. They are **not** placebo price maps or
   proof the POC outperforms a generic pullback signal.

30 strategies + 90 calendar controls + one clock, each over six paths =726
executions. Controls are explicitly separate from strategy-definition counts.
1h/4h/12h/24h response returns and MAE/MFE include all raw signals; those overlap
and cannot be added as portfolio profits.

## Qualification and limits

Inherited standalone screen stays visible: at least 30 full/10 older/10 recent
closed trades in both delays, positive net and clock delta in every path,
no negative monthly marked delta versus clock, positive cost-stress net and no
equity exhaustion. Sparse strategies can be interesting without beating a
near-continuous long every month; failure does not establish the family is noise.

All history has been previously examined, not an untouched holdout. Real original
receipt times are unknown; PVM01 models publication at period end +60s. No
developing profile, retrospective naked-status selection, geometry tuning,
alternate hold/exit optimization or post-result rule expansion is present.

## Reproduce / inspect

```powershell
node -r ts-node/register scripts/poc-bounce-tests.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-bounce-study.ts
node --max-old-space-size=4096 -r ts-node/register scripts/poc-bounce-verify.ts backtests/poc-bounce/KEY
```

The content-addressed directory is immutable. Unchanged reruns refuse to
overwrite it. `plan.json` pins card, code, map and candles; `complete.json`
hashes results. A separate verifier checks every encounter/decision against
the causal map, reconstructs every trade schedule/fill, and replays all 180
strategy paths plus six clock paths using the existing independent minute engine.
`report.md`, `results.csv`, `monthly.csv`, `responses.csv`, raw signals,
encounters, every trade path and verification receipt are retained.
