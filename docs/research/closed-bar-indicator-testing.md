# Closed-bar indicators: timing contract and staged test path

September 5, 2026. Local research only. **Timing foundation implemented; no new
strategy simulations, profit claims, live configuration changes or deployment.**

Subsequent work: [stages 1-2](indicator-standalone-study.md) now implement the
independent formula validation and first frozen standalone study. This document
records the original timing refinement; the later study has its own findings
and does not alter the legacy/live timing boundary below.

## 1. What changed, and what did not

- [closed-bars.ts](../../src/research/closed-bars.ts) builds complete UTC bars and
  provides exact as-of windows with explicit availability and missing-data results.
- [closed-indicators.ts](../../src/research/closed-indicators.ts) applies the
  existing `computeIndicators` formula bundle through that contract. It is a
  research entry point and timing reference, not a newly validated indicator library.
- [timing tests](../../scripts/closed-indicator-timing-tests.ts) cover boundaries,
  coverage, delayed dependencies, warmup and future-data invariance.
- The old `getSnapshotAt` is marked deprecated for causal research. Its runtime
  behaviour is intentionally unchanged, including its unsafe-for-as-of nearest
  and future fallback. Do not use it in new studies.

The live ladder, `LiveContextManager`, `getContext`, S/R engine, transaction
coordinators and canonical replay calculations are **not switched** to this new
interface. Existing live RSI/CRSI can include a forming higher-timeframe bar.
The repaired replay reconstructs that context from the historical prefix; this
is different from reading a higher-timeframe candle's eventual final OHLC.
Making those existing gates closed-bar-only would be a separately measured
strategy change, not an invisible baseline repair.

## 2. Explicit timing contract

Bars describe `[barStart, barEnd)`. Source `Candle.timestamp` remains the start;
it is never implicitly the time at which its final close became usable. All
times are integer UTC epoch milliseconds.

| Question | Enforced rule |
|---|---|
| Which hourly bar at 10:00 UTC? | `[09:00,10:00)`, subject to final-data availability. Never the final OHLC of `[10:00,11:00)`. |
| Which hourly bar at 10:34 UTC? | Still `[09:00,10:00)`. A partial 10:00 bar is not this feature. |
| What if the 09:00 bar arrives at 10:00:02? | Unavailable at 10:00:01; eligible at 10:00:02. No fallback to an older bar. |
| Can 11 five-minute candles make an hour? | No. Every expected source timestamp must exist exactly once after identical-duplicate resolution. |
| What if an earlier dependency arrives late? | The indicator waits for it too; a timely latest candle does not make its missing EMA history available. |
| What if a bar is missing? | Window fails. The indicator adapter stays unavailable beyond a gap in its required seed history; it never stitches or silently reseeds. |
| What does future append do? | It must not change an earlier eligible value or decision. Tested with extreme future prices and partially formed higher-timeframe buckets. |

Availability is mandatory and labeled:

- `fromHistorical(..., { publicationLagMs })` uses bar end plus an explicitly
  chosen nonnegative lag. Zero is a model assumption, **not collector receipt
  evidence**. Adding a recovered historical candle establishes its OHLC, not
  that it was delivered live at bar close.
- `fromObservations(...)` requires a final candle, a receipt time and `final:true`.
  The receipt must not precede bar end. A collector receipt on a forming update
  does not prove the final candle was available. The caller must supply genuine
  final observations, not label reconstructed history as observed.
- Aggregation takes the latest availability of its constituents. The recursive
  indicator bundle additionally takes the latest availability of its entire
  contiguous seed-to-current prefix.

Identical final duplicates retain the earliest known receipt. Conflicting final
revisions throw; a future versioned revision tape would be needed to model them.
Invalid OHLCV, unaligned timestamps, invalid intervals and non-finite feature
outputs also fail explicitly. Unavailable values are not zero, neutral, or a
signal to buy/sell.

This module is pair-neutral but deliberately only supports fixed UTC intervals
that divide a day, with the target a multiple of the source. It is suitable for
our continuous crypto candle studies. Exchange sessions, stock splits, weekend
closures, Monday-anchored weeks and calendar months need separate handling; a
forex/equity daily candle must not silently inherit these UTC conventions.
Keep symbol, venue, units and input hashes on the study manifest; do not mix
different venues/pairs into one series.

## 3. Research usage and limitations

```typescript
import { ClosedBarSeries } from "../../src/research/closed-bars";
import { ClosedIndicatorSeries } from "../../src/research/closed-indicators";

// `candles` is a normalized, single-venue/pair final 5m archive.
const bars = ClosedBarSeries.fromHistorical(candles, {
  sourceIntervalMs: 300_000,
  targetIntervalMs: 3_600_000,
  publicationLagMs: 0, // explicitly idealized; test delayed availability later
});
const indicators = new ClosedIndicatorSeries(bars, {
  seedBarStart: studyManifest.indicatorSeedBarStart, // fixed UTC hourly boundary
});
const result = indicators.at(decisionAt);
if (result.ready) {
  const { barStart, barEnd, availableAt, seedBarStart, values } = result.snapshot;
  // Record provenance; evaluate a predeclared signal, not an order here.
}
```

For an individual formula, `bars.windowAt(decisionAt, lookbackBars)` returns
only a complete, available window. Inspect `ready` before using it. `bars.bars`
is the **whole archive**, including future bars; never join it directly into a
decision. It is exposed for causal batch feature construction, whose prefix
invariance must be tested independently for every new formula.

The compatibility bundle uses the existing formulas and rounding, and requires
at least 200 contiguous target bars because it includes SMA200. It is not an
appropriate universal warmup rule for RSI alone. A single non-finite member
makes this bundle unavailable; later independent indicators need per-feature
validity. Seed policy is `explicit-fixed-start-no-gap-reseed`, recorded with the
seed time. Changing how much history precedes a test can change recursive
indicators; freeze the seed history, even when trade evaluation starts later.
Choosing a new post-gap seed is an explicit new initialization, not an automatic
fallback. This also prevents a future-delivered old candle from bridging a gap
and retroactively changing the seed or eligibility of past signals. Regression
tests compare a full observed archive with receipt-filtered prefixes for that case.

This adapter does not add CRSI/ADX or validate any formula's mathematical
accuracy. Nor does it certify S/R pivots, pulse publication, trading fills or
collector outages. Existing [causal replay](current-stack-replay.md) and
[indicator guide](indicator-field-guide.md) describe those separate boundaries.

## 4. The next stages: both standalone trades and ladder tests

The user's requested order is useful: understand each indicator before hiding
it inside the ladder or a complicated conjunction. **These stages are a plan,
not tests already run or permission for an unrestricted parameter sweep.**

### A. Validate each formula before asking whether it makes money

Start with a small batch: RSI/CRSI and ROC (momentum), ATR (volatility), ADX with
+DI/-DI (trend strength/direction), then VWAP and relative volume. This is a
suggested implementation order, not a profitability ranking. Other families
remain in the field guide; do not build all 24 at once.

For each, freeze formula/version, timeframe, parameters, units, smoothing,
initialization, lookback, rounding, validity and earliest availability. Match
hand-calculated fixtures and an independently implemented/reference calculation
with identical conventions. Cover flat prices, gaps, zero volume, monotonic
trends and insufficient warmup. A second call to the same library is not an
independent accuracy check. Keep new research values unrounded where possible;
do not silently alter a rounded legacy gate. Test prefix and timeframe-boundary
invariance again for the feature itself, not only the shared bar layer.

### B. One indicator at a time: simple long and short studies

Use two complementary views, kept separate:

1. **Signal response:** subsequent returns and maximum favourable/adverse
   excursion after an objectively defined signal. This describes what happened
   after the observation; it is not executable trading PnL. Avoid counting an
   unchanged hourly signal as 60 new independent minute signals.
2. **Simple trades:** fixed notional, one position at a time, no ladder or
   averaging down. Test the long and short rules separately with an explicit
   entry, exit, max hold and rearm condition. Repeated qualifying bars must not
   create unlimited overlapping trades.

An illustrative RSI card could compare a long on a completed-bar recovery
through 30 versus a short on a completed-bar fall back through 70, exiting on
a declared return to 50 or a fixed maximum holding time. Those numbers describe
a familiar hypothesis, not a selected HYPE strategy or a test launched here.
Entering while oversold and entering on recovery from oversold are **different
rules**; record them separately. ATR or ADX alone has no long/short direction,
so use it first to stratify a fixed directional rule rather than inventing a
standalone directional trigger merely to give every indicator a trade count.

Before execution, freeze the precise card and a small number of exit rules.
Start with fixed-horizon/indicator-cross exits to isolate the signal. Add a
small predeclared TP/SL sensitivity later, not an optimized exit for each
indicator. Orders follow the decision and availability time. In a zero-delay
minute model, this may be the next minute's open at the close boundary; with
positive publication/processing delay, that open has already passed. Use the
next executable observation and include a one-bar-later sensitivity. Never use
the signal candle's earlier wick. If both a pre-existing stop and target are
touched in one OHLC bar, report ambiguity and adverse-first sensitivity.

Compare every setup with explicit controls on the **same dates and eligible
data**: cash/no trade, buy-and-hold as directional context, and a same-side,
same-horizon control matched using only known regime/time information. For a
filter, the relevant control is the identical entry/exit rule without that
filter. Match cost assumptions and disclose funding omissions. Do not label
standalone PnL as improvement over the ladder.

### C. Measure ladder usefulness separately

Only after the indicator readout, choose one decision: e.g. allow/hold a genuine
deep drop add, scale rung 11, or exit. Keep all other ladder behaviour fixed.
Specify hold expiry/release, missing-data behaviour and which existing gate
remains authoritative. Reproduce the four same-window canonical baselines with
the current partial-close clock before running variants.

A standalone winner can hurt a mean-reversion ladder by blocking recovery adds.
Conversely, an indicator that cannot profitably trade alone may still identify
when an existing add is dangerous. That is a separate, predeclared conditional
question, not a license to keep searching until an indicator wins somewhere.
Count skipped profitable cycles and missed recoveries alongside avoided losses.

### D. Combinations, then HL and S/R

Test a small complementary indicator pair first, retaining each component alone
as a control. Only then add pulse and known S/R context. Compare indicator-only,
pulse-only, S/R-only and the relevant combined rules to isolate contributions.
Indicators without a meaningful standalone directional rule can still be
predeclared conditioning features. Do not run a cartesian product of thresholds.

Use longer candle-only controls and the shorter **quality-verified overlapping
HL window** separately; missing-flow history does not validate a flow strategy.
Split chronologically, separate overlapping outcome windows across splits, and
reserve future observations. Already-mined history is development evidence,
not newly untouched validation. A profitable combination is not a live release.

## 5. Reporting and experiment control

Use the [tested-setup register](../../research/TESTED-SETUPS.md) before each study.
Declare dates/cutoff, data hashes/repair overlay, signal and rearm definition,
seed history, timeframes, availability/latency assumptions, sizing, fees,
funding, exits, end-of-window inventory treatment and all attempted variants.

Show **baseline beside every variant**, exact UTC dates and dollar notional:

| Setup | Trades | Wins / losses / breakeven | Winning-trade dollars | Losing-trade dollars | Fees / funding treatment | Net PnL | Max DD |
|---|---:|---|---:|---:|---|---:|---:|
| Declared control | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Indicator rule | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

State whether win/loss sums already include fees so they are not deducted twice.
Also show monthly baseline/variant wins, losses, amounts, net PnL and delta;
report final open inventory separately. Include trade frequency, exposure time,
worst trades and stability across periods, not merely win rate. No fabricated
baseline or variant statistics belong in this timing-only implementation.

## 6. Verification of this refinement

```powershell
npm.cmd run test:closed-indicator-timing
# Optional bounded, read-only normalized 5m archive check:
npm.cmd run test:closed-indicator-timing -- --history-file data/HYPEUSDT_5_full.json
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false
npx.cmd ts-node scripts/replay-causality-tests.ts
npx.cmd ts-node scripts/replay-current-stack-tests.ts
npx.cmd ts-node scripts/ladder-sizing-tests.ts
npx.cmd ts-node scripts/context-manager-tests.ts
npx.cmd ts-node scripts/sr-context-safety-tests.ts
```

The local archive smoke check at **2026-03-29 14:00 UTC** selected the completed
13:00 hourly bar and produced identical full-archive/prefix values (RSI14 40.37,
EMA50 39.378687621838885). This is an archived timing fixture, **not a current
market read or an independent math check**. No replay performance totals were
recomputed: executable canonical/live logic is unchanged. The next deliverable
is the independent formula-validation batch, followed by the first small
standalone signal study.

Verification passed: **11 synthetic timing groups plus the local archive check**,
both TypeScript configurations, and the replay causality/current-stack,
ladder-sizing, context-manager and S/R context-safety regression suites.
