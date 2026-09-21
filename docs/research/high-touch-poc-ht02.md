# HT02: POC proximity blocks on two-day-high shorts

Frozen September 17, 2026. Local research only; no live changes.
[Card](../../research-inputs/high-touch-poc-ht02-2026-09-17.json).

## Fixed parent strategies

HT01's three highest full-period net brackets, all **exact-touch shorts**:

| Parent TP / SL | Net | W / L | Win rate | DD |
|---|---:|---:|---:|---:|
| 2% / 3.5% | $7,589 | 359 / 192 | 65.15% | 10.81% |
| 3% / 3.5% | $7,548 | 277 / 218 | 55.96% | 14.44% |
| 2% / 3% | $6,764 | 375 / 225 | 62.50% | 10.54% |

Same December 5, 2024 12:55 to September 15, 2026 20:20 UTC cutoff, split June 1,
2026. $10,000 fixed notional, one position per strategy, 12h maximum hold, fees
0.055% each actual side, before funding. DD uses $32,000 initial equity. Same
stop-first primary, target-first ambiguity sensitivity, extra 60-second entry
and timeout delay, and extra 5bps per-side cost stress. No TP/SL tuning here.

## Frozen filters: 64 per parent, 192 new definitions

- Sources: preceding completed daily, weekly or monthly **POC**, and their union;
  confidently untested historical daily, weekly or monthly **NPOCs**, and their union.
- Distances: **0.25%, 0.5%, 1%, 2%**.
- Direction: **either side**, or **below/containing price only**. The latter tests
  potential bounce obstruction along the short's path; it does not assume POC
  support has already been proven.

Distance is the shortest percentage gap from the last observed close to the
original $0.10 volume-profile row, divided by that observed close. Inside a row
is zero gap; its upper boundary also has zero geometric gap. Below requires
row.lower <= price. A qualifying known level vetoes this signal; no new queue,
expiry or timer is introduced. Re-entry requires another original raw signal.

POC means the immediately preceding completed calendar period, not every old
POC and not a developing profile. It may be tested or untested. An excluded
previous period is not replaced by an older valid one. NPOCs have no arbitrary
age cutoff; they disappear on known retest or become unusable on uncertainty.
The union takes any matching level across its three timeframes, not confluence.

No new HL, RSI, trend, clock, POC-width, venue or unrelated entry search. This
answers proximity and downside-obstruction questions while holding the parent
strategy fixed. 192 correlated extensions bring the inventory to **9,247
standalone definitions / 205 ladder overlays**, not independent evidence.

## Causal map access and reuse

Reuse the accepted Bybit native-executed-base-volume PVM01 profiles. Do not
rebuild distributions or maps per strategy. Read the accepted as-of reader,
not the cutoff register's final naked status.

At each HT01 raw signal, freeze the filter using its observed touch-minute
close. Query the map at **signalAt minus 60 seconds**. This is an additional
conservative map-snapshot allowance: profile publication already uses period
end plus 60 seconds, so a newly completed profile enters HT02 no earlier than
period end plus 120 seconds. Retest/uncertainty evidence is projected at that
snapshot, never taken from later history. Delayed execution does not refresh
the frozen filter or use a later fill price to decide whether to enter.

Missing/excluded previous POC, or no confidently naked profile, means **no
positive evidence to veto**: the original signal remains. This is not a safety
assertion about unknown levels. Save previous-profile coverage, historical
tested/untested/uncertain counts and selected level IDs at every raw signal.

One context cache covers all 7,475 raw exact-touch signals. The study saves
all 64 veto lists and replays each allowed raw stream with full independent
occupancy. Previously unexecuted signals can become trades after a veto.

## Controls, attribution and checks

Before variants, reproduce **36 exact HT01 parent paths**, including both
ambiguity orders, three windows and two delays. Compare receipts, accepted
signal IDs, stats, monthly marks, equity curve and cutoff inventory.

For each result, report the identical unfiltered parent alongside it. Separate
removed winners/losses, directly vetoed parent fills, occupancy-displaced fills,
and added replacement trades. Shared receipts must match exactly. Reconcile:

`net delta = added closed PnL - removed closed PnL + cutoff open-PnL delta`.

Marked monthly PnL includes carry; win/loss counts and winning/losing dollars
belong to the closing month. Flat-reset older/recent runs are not necessarily
additive to the continuous full run. Sensitivity excluding the two largest
avoided losses measures concentration, not a new strategy.

Independent verification projects the raw catalogue without the production
context helper, checks nearest levels and every veto, then independently audits
every unique execution journal minute-by-minute. Tests cover future-data poison,
publication/retest boundaries, uncertainty, unavailable preceding periods,
direction and distance thresholds. Sources, accepted inputs and local live
files are hash-pinned before/after. Existing accepted artifacts stay immutable.

## Screen

Inherited absolute screen: positive net and stressed net in all six window/delay
paths; >=30 full and >=10 each subperiod trades; no exhausted equity; every
marked month >=-$250 versus cash. Relative also requires improved net, nonworse
DD and no month more than $250 below the matching parent in every path.

**Win-rate lift is reported separately**, including its consistency and sample
size. A narrower, higher-win-rate sample can still earn less or lose more in
bad months. The top-five variants get full monthly deltas; all 192 results are
saved. No untouched holdout, live receipt, funding, spread, queue, liquidation
or shared-account margin claim.

```powershell
npx ts-node scripts/high-touch-poc-tests.ts
npx ts-node scripts/high-touch-poc-study.ts
npx ts-node scripts/high-touch-poc-verify.ts
npx ts-node scripts/high-touch-poc-report.ts
```

Once accepted, read saved outputs instead of rerunning. No VPS or exchange work.

## Accepted checkpoint

[Findings](../../research/codex-astra-high-touch-poc-findings-2026-09-17.md),
[full review/monthlies](../../backtests/high-touch-poc-reports/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/review.md),
[all192 filter results](../../backtests/high-touch-poc-reports/cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704/filters.md).
Accepted job cad94969a5bd2ecb86f3cf7e9a994567607bef132a6e5e4cc868dafebf599704;
independent verification passed all2,340 paths. **0/192 qualifiers.** The weekly
POC below2% filter modestly improves all3 parents; NPOC reach is limited.
