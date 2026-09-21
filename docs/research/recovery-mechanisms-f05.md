# F05: recovery-event loss control

September 10, 2026. Local research only. This executes Step 1 of the
[September 9 roadmap](hype-research-next-phase-2026-09-09.md), not its later
soft-stale, sizing, standalone or deployment branches.

## Frozen comparison

[Card](../../research-inputs/recovery-mechanisms-2026-09-10.json): ten new
definitions, 124 cases. Reproduce all 28 F04 cases first; then 96 new cases.
Original MFI-half and weekly-MFI half-plus-freeze remain comparators, not new
definitions. No parameter or threshold search follows the results in this card.

Every case uses the current modeled B17 long stack: independent flat $32,000
start, $800 x 1.35/max11, existing gates, S/R actions, damaged latch and exits.
Fees remain 0.055% per entry/exit side; no maker uplift. Published window:
2025-07-01 00:00 to 2026-08-19 21:32 UTC. Recent window: 2026-05-17 20:43 to
2026-09-08 17:47 UTC. Both resting-touch and close-confirmed TP assumptions.
The windows overlap and have been mined already: neither is an untouched holdout.

Three clocks per new policy: primary, an extra 60 seconds of experimental
source availability delay, and an extra 60 seconds of experimental action
delay. They do not change B17's ordinary gates or exits. Six price/weekly
definitions run on all four window/model pairs; four HL definitions run only
on the recent pair. Missing older HL history is not silently backfilled and
does not qualify an HL policy across the full history.

## What each action does

| Action | Experimental sale | Subsequent ordinary adds |
|---|---|---|
| Freeze only | None | Veto otherwise-approved new add decisions from the effective time until flat |
| Half + freeze | 50% pro rata at causal next open, plus any action delay | Original research add lock starts only after an actual fill |
| Half + ordinary | Same sale | Existing gates and rung rules remain authoritative; no extra re-entry signal |

Pro-rata reduction retains rung identity, relative cost basis and last actual
add time. Selling half does not itself free rung slots. Later ordinary S/R
trims can remove slots; the ordinary-add control can then rebuild only if
the existing strategy permits. Costs, realized partial PnL, remaining open
inventory and all later entry opportunities are re-simulated.

Freeze-only action delay is measured from signal to *add-decision* veto, not
from signal to a fictional fill. Orders decided before the freeze may still
fill. Ordinary TP, S/R and emergency/forced-exit priority is unchanged.

## Exact policies

The two weekly controls wrap F04 unchanged: first depth >= 9 and gross
inventory loss <= -3%; exactly 60 minutes later, same episode still deep,
completed 30m MFI14 <= 20, latest closed hourly price below UTC-week VWAP and
hourly ROC5 <= 0. Compare freeze-only and half-with-ordinary-adds to the repeated
weekly half-plus-freeze parent. No second loss check at the weekly checkpoint.

The four broader mechanisms each receive freeze-only and half-plus-freeze:

| Family | Frozen reference and observed sequence |
|---|---|
| Support failure | At arm, nearest confirmed support below the closed price within 3%, with healthy 14d S/R coverage. Later closed 5m price below support by >0.1%; a strictly later bar retests that boundary from below and closes below it; a still later close breaks the retest-bar low by >0.1%. Reclaim above support by >=0.1% invalidates after the break. |
| Rebound failure | Freeze the last completed 15m high at arm. Track the lowest closed 5m price since arm. First later close rebounds >=0.5% but remains below that high; freeze the rebound-bar low. A still later close breaks that low by >0.1%. Closing at/above the original high invalidates. |
| Ineffective buying | After arm, healthy HL 15m buy/sell notional ratio >=1.2 while closed price ROC15 <=0. Freeze that observed bar's high/low. A strictly later close below its low by >0.1% signals; reclaim >=0.1% above its high invalidates. |
| Selling with OI | After arm, healthy HL 15m ratio <=0.85 and below the snapshot five minutes earlier, with native asset OI change over one hour >=0. Freeze that bar's high/low; require the same later low failure/reclaim rule. Marked USD OI is not substituted for native quantity. |

Broad arming is once per flat-to-flat episode, at the first newly available
completed 5m observation when *actual current* depth >=6 and gross inventory
PnL <=-1.5%. No MFI filter or fixed one-hour wait. Six-hour lifetime, invalidated
before action on depth <6, gross PnL >=0, episode closure/change, missing source
bar, explicit reclaim, or elapsed time strictly beyond six hours. No rearm
after cancellation or a consumed signal. These are fixed first-pass rules,
not estimates of optimal thresholds.

The actual inventory/gross-loss check uses the current completed minute.
Price-sequence features use only the latest available closed 5m bar. Different
sequence stages must occur on different bars: OHLC does not establish whether
a high or low occurred first inside one bar.

## Availability and causality

Price bars require consecutive raw minutes. The selected bar must end no later
than decision time minus the experimental lag. Support identity is frozen when
observed, with no retrospective choice of the best pivot; the verifier rebuilds
the context on the closed prefix without future candles.

HL sources are the collected taker-minute and asset-context streams. The flow
window ends at the actual observation time, not a retrospectively shifted
source time. Require at least 14 distinct valid minutes out of 15, no duplicate
minutes, finite ratio and maximum source age 90s. Current asset age <=60s and
one-hour anchor lag <=120s. Native OI can be zero; a zero denominator cannot
produce a valid change. Unknown input invalidates only the experimental pending
sequence, never disables the existing protective exits.

Source60 can make an otherwise complete flow window unavailable. A policy
returning toward baseline because it stopped receiving valid input is **not**
delay robustness or evidence of an improved veto. Preserve those cases and
the monthly opportunity/unknown-input counts separately from economics.

## Minimal research-engine bridge

F04's engine always locked adds after an experimental partial. F05 adds only
the opt-in `researchPartialAddPolicy: "ordinary"`; omission or explicit
`"freeze"` retains the original behavior. No live engine/call site changes.

The runner checks the entire current engine equals the archived old source
with exactly those two literal additions, then requires all 28 F04 result
digests, metrics, raw accounting and original observations to match.

- Old SHA-256: `df6e7ebdf10c9edb14c9f49043f3ab7f709f51e81e8a3c160952c62dc60a9d9b`.
- Exact saved bytes: [pre-F05 source](../../research-inputs/reproducibility/replay-causal-engine-pre-f05-2026-09-10.txt).
- New engine SHA-256: `2fa035f6f29de8bfa58bef600cf914f2ff70a196436b3a36c30cda98a4625f54`.

The old F04 runner's source pin intentionally does not accept this new engine.
Use its saved source in an isolated reproduction workspace, or F05's explicit
bridge/control proof. Do not weaken old pins or overwrite accepted archives.
The saved reference has a narrow Git `-text` attribute so `core.autocrlf` cannot
alter its byte hash. Other source/input pins must still match the run manifest;
this does not migrate or relax earlier studies' platform-specific byte pins.

## Run and check

From the repository root in PowerShell, with an unused output directory:

```powershell
npx ts-node scripts/recovery-mechanism-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-recovery-mechanism-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/recovery-mechanism-check.ts
npx ts-node scripts/recovery-mechanism-report.ts
```

All three artifact commands also accept a common alternate output path under
`backtests/` as their first argument. Do not overwrite a completed run. Inputs,
source files, protected live/config/state bytes and output artifacts are hashed.
The checker independently reconstructs inventory/fees/minute equity, raw
MFI/weekly features, all available HL rows, closed 5m features, first eligible
distress arms and event transitions. It verifies full occupancy attribution
and the frozen economic screen, and emits raw-source-to-fill traces.

Fixtures cover distinct-bar sequencing, invalidation and unknown sources,
one-shot behavior, freeze/action clocks, next-open delayed reductions, priority
of ordinary exits, future-price mutation, support prefixes and the opt-in add
lock with an intervening ordinary S/R trim.

Output directory: `backtests/hype/hype-recovery-mechanisms-2026-09-10/`.
`tables.md`/`primary-monthly-wl.csv` contain baseline-adjacent wins/losses,
winning/losing dollars and monthly MTM. `opportunity-monthly.csv` records
sampling/coverage; `comparisons.json` includes matched, removed, replacement
and unfinished inventory contributions. `execution-traces.json` links actual
signals to raw references, fills and episode outcomes. Check `verification.json`
and `report-validation.json` before using the summaries.

## Acceptance boundary

Frozen screen: recent net increment >=$1,000 under both TP models; published
increment >=0 under both; no maximum-DD increase; no monthly MTM delta below
-$250; no modeled nonpositive equity. All requirements apply together. Lack
of full-history HL coverage is not a pass. A rank is not a qualification.

Report costs to recovered winners as well as benefits on eventual losers,
replacement trade paths, minimum equity, final open mark, event concentration
and every month. Two modeled TP paths or repeated delays do not multiply the
number of independent market events. These replays do not certify maker queues,
funding settlements, exchange liquidation or shared-account margin. No policy
survival automatically authorizes a live change; forward observation remains
required.
