# I11: individual OBV, MFI and CMF coverage

Frozen September 7, 2026, before historical outcomes. Research only.
[Exact card](../../research-inputs/indicators/volume-flow-standalone-2026-09-07.json).
No combinations, HL/S/R, ladder interventions, live changes, short unpause, commit or push.

## What is being measured

These are Bybit OHLCV proxies, not observed buyer/seller aggression or investor capital flows.

- OBV adds current base volume when close rises, subtracts when close falls, and
  adds zero on ties. Raw OBV starts at zero. Entries use its last N signed-volume
  changes divided by ALL corresponding N volumes, including unchanged-close bars.
  This bounded, seed-independent transform is our research choice, not a
  threshold on the arbitrary cumulative level.
  [Fidelity OBV](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/obv).
- MFI classifies HLC3 times base volume by the change in HLC3, not close direction.
  Equal typical prices contribute neither positive nor negative flow.
  MFI=100P/(P+N); signed metric=(P-N)/(P+N), computed without intermediate rounding.
  All-positive/all-negative flow gives 100/0; both positive and equal gives50;
  no directional flow gives null, an explicit fail-closed convention.
  [Fidelity MFI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/mfi),
  [TradingView MFI](https://www.tradingview.com/support/solutions/43000502348-money-flow-mfi/).
- CMF is the N-bar sum of volume times ((close-low)-(high-close))/(high-low),
  divided by total N-bar volume. Flat-range bars contribute zero numerator but
  retain their volume. A gap down closing at its bar high can still give positive
  CMF: it measures within-bar location, not gap return.
  [Fidelity CMF](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cmf).

OBV/MFI first valid index N; CMF index N-1. Zero denominator=null.
Balanced OBV/CMF with positive denominator=valid0. No rounding, clamps,
bridging, repaint or moving seed. Turnover is deliberately not used in these
standard volume-proxy formulas; MFI HLC3*volume is not actual traded VWAP.

The installed technicalindicators MFI differs: it emits one bar later, assigns
ties to negative flow and rounds to two decimals. Tests compare its rounded
outputs on non-tied data after warmup, and explicitly distinguish the tie
case. We do not silently inherit those library conventions or claim identical
chart/live MFI. External raw OBV matches exactly. Existing live indicators are untouched.

## Frozen entries and exits

Five finalized clocks:5m/15m/30m/1h/4h. Long and short separately.
Let v=position-side sign times the selected centered metric, k>=0.

| Family | Periods | Trend k | Into/recovery k |
|---|---|---|---|
| Normalized OBV change | 10/20/40 | 0/.25/.50/.75 | .25/.50/.75 |
| MFI | 7/14/28 | 0/.20/.60/.80 | .60/.80/.90 |
| CMF | 10/20/40 | 0/.05/.20/.50 | .05/.20/.50 |

Trend:previous v<=k,current v>k.
Into:previous v>=-k,current v<-k.
Recovery:previous v<=-k,current v>-k.
Strict crossings only, not sustained levels; into/recovery zero duplicates excluded.
MFI long extremes are raw20/10/5 (short80/90/95); trend levels raw50/60/80/90
for longs,50/40/20/10 for shorts. Conventional CMF21 is NOT tested (selected20).

Two exits:fixed12h from actual fill, or first subsequent zero condition capped12h:
trend signed<=0; into/recovery signed>=0. MFI zero means raw50, not raw0.
Timeout wins ties; no reuse of entry observation; pending decisions immutable.
Occupied signals expire, not queued. Window rollover can cause metric recovery
without a favorable price reversal. No added price filter, divergence, TP or SL.

Each family:3 periods *5 clocks *10 mode/threshold pairs *2 sides *2 exits=600.
Total **1,800 new definitions**, no repeats. Two windows *two delays:
**7,200 strategy cases +8 repeated clock cases=7,208**.
No unweighted volume-removal control: profitability alone cannot isolate
incremental information from volume versus the associated price pattern.
Own indicator-exit comparisons retain the exact fixed12h entry control.

## Data and accounting

Same I01 fingerprinted snapshot and explicit11-minute repair;663,541 contiguous
minutes from fixed June1,2025 seed. No new data or cutoff selection.

Full: **2025-07-01 00:00 to2026-09-04 19:01 UTC**.
Recent: **2026-05-17 20:43 to the same cutoff**, starts flat, contained in full.
$10,000 fixed entry/$32,000 initial equity, one independent position, no
compounding or averaging.0.055% each side on actual notional, **before funding**.
Extra5bps/side stress on fixed turnover including cutoff closing mark.
Baseline:same-side rolling12h clock, not exposure-matched, NOT the ladder.
Cash and buy/hold are context only.

Only contiguous finalized selected-TF data; next minute open at modeled zero
publication lag, then separate+1m delay to BOTH actions. No execution-minute
H/L/C decisions. Repair does not establish actual historical receipt times.
Monthly marked equity includes held inventory and fees when incurred.
Open cutoff inventory includes a hypothetical closing fee, not a completed trade.
DD:prior close-equity peak to minute adverse price; not an inferred intraminute
path or exchange liquidation model. Bankrupt diagnostics keep running but fail
the screen and are not executable account performance.

## Predeclared reporting and screens

Strict inherited screen:>=30 full/10 recent closes at both delays, positive
net and same-side clock delta in allfour; every monthly marked delta>=-1e-8;
positive extra-cost net, no equity exhaustion. No relaxed deployment gate.

Descriptive subset:sample/net/cost/solvency in allfour, retaining clock/month
failures. Rank by full immediate absolute net:overall top5 and each family top5;
also retain rawtop5 by clock delta and descriptive top5 shorts per family.
Report full/recent W/L counts AND dollar amounts, open/net/DD, baselines beside
variants, both delay/cost cases, full monthly tables, own fixed-exit differences,
crash paths and profit concentration. All1,800 IDs/failures retained.

Pinned read-only path supplement covers those overall/family/raw/short lists
and optional-exit fixed12h companions, completed trades at immediate execution.
It does not add signals, optimize exits or certify liquidation safety.

## Validation and reproduction

Pure math tests:hand formulas, seed/ties/zero volume, gap-down CMF, scaling,
OBV/CMF mirror/translation, MFI translation non-invariance, normalized suffix
seed independence,45 parameter-clock comparisons to independently aggregated
reference, external library conventions, prefixes and malformed/gapped input.
All1,800 entry boundaries plus delay/exit/fee/occupancy/cutoff and old-ledger fixtures.

Runner requires all8 saved/new/old I01 clock ledgers/stat/month/mark cases EXACT
before output creation.135 actual feature prefixes and1,800 engine prefixes.
Independent checker imports neither new feature module nor signal engine;
rebuilds OHLCV/formulas, every eligible/occupied signal, first exits, minute
accounting/DD, monthly marked equity, ranks, shortlist, traces and validation.
Source/input/artifact pins are checked before and after.

Run LOCALLY, not on the production4GB VPS:

```bash
npx ts-node scripts/volume-flow-standalone-tests.ts
node --max-old-space-size=16384 -r ts-node/register scripts/hype-volume-flow-standalone-study.ts
node --max-old-space-size=24576 -r ts-node/register scripts/volume-flow-standalone-results-check.ts backtests/hype/hype-volume-flow-standalone-2026-09-07
npx ts-node scripts/volume-flow-standalone-path-check.ts backtests/hype/hype-volume-flow-standalone-2026-09-07
```

Optional runner --out backtests/NEW_DIRECTORY; refuses overwrite.
Generated outputs local/ignored; reproducible source/card/docs allowlisted.
Outcomes are accepted only after the replay and independent verification complete.

## Accepted run: September 7, 2026

[Findings, all definitions and monthly/path comparisons](../../research/codex-astra-volume-flow-standalone-findings-2026-09-07.md).
The frozen card above was run without outcome-driven additions:

- 1,800 new definitions;7,208 cases;8 exact saved I01 clock controls.
- Independent audit matched2,102,236 trade records and72,080 monthly rows.
- 135 actual feature-prefix checks and1,800 engine-prefix checks;zero missing
  minutes after the pinned11-minute repair. Source/input/artifact pins match.
- 10 new test groups pass, including all1,800 crossing-boundary fixtures;
  both TypeScript builds, prior timing/feature/standalone suites and diff check pass.
- 62 pinned immediate-model path cases plus16 specified read-only delayed-path
  inspections;no new strategies. Results remain on overlapping/mined history.
- 118 descriptive survivors (114 long/4 short),zero complete strict qualifiers.
  The four short definitions represent three entries;two OBV exits have identical
  realized ledgers. Monthly failures, adverse paths and concentration are retained.

Accepted directory:backtests/hype/hype-volume-flow-standalone-2026-09-07/.
Verification completed2026-09-07T00:05:53.576Z. No live/config/state changes,
combination work,short unpause,commit or push. Funding and actual receipt/fill
evidence remain unavailable;the method does not certify live account safety.

## Deliberately untested

Untouched holdout, actual publication latency, funding, slippage/queue/liquidation,
volume-removal controls, OBV MA/breakout/divergence, MFI divergence, CMF21,
other clocks/periods/levels/persistence/price gates, stops/TPs/sizing,
indicator/HL/S/R combinations and ladder/shared-account application.
This bounded pass cannot exhaust these indicator families.
