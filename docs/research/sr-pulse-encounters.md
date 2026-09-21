# S/R encounter and pulse-response study

September 5, 2026. Local descriptive research, no orders or live changes.

The frozen definition is
`research-inputs/sr-pulse-encounters/hype-2026-09-05.json`. Do not adjust it after
inspecting outcomes. The two families are resistance rejection/acceptance and
support holding/failing. Short entry design and geometry optimization are outside
this pass. Corrected price history is explicit, and historical HL receipt times
retain the existing disclosed latency assumptions.

## Sampling and the decision clock

1. Use unchanged current S/R geometry through `ReplaySrContext`. At each completed
   5m boundary T, look at levels already known at T-5m. A resistance approach starts
   below its 0.3% band and the next completed bar reaches that band; support is the
   mirror. If several qualify, select the closest to the pre-bar close. Freeze
   that level's price and confirmed touch list; never move it to fit the response.
2. Observe exactly 15 more minutes. The last two completed 5m closes beyond 0.1%
   across the frozen level mean acceptance/support failure; two closes 0.1% back
   on the approach side mean rejection/support holding. Other responses remain
   unresolved. These are observed states, not future-outcome labels.
3. The decision time D is T+15m for **all** encounter comparisons, including
   S/R-only baselines. Do not backdate a confirmed rejection's entry to T.
4. Admit one encounter per 256 minutes globally, regardless of side or pulse
   health. With a 15m observation window and a 240m primary outcome plus 1m entry
   delay, accepted outcome windows do not overlap. Count suppressed encounters
   and missing input rows explicitly. These spaced samples still share regimes;
   do not call them statistically independent market experiments.

## Predictors and controls

At T and D, record the existing as-of HL 15m/1h ratios, traded notional, net flow,
book/source ages, native vs USD-marked OI, and Binance 1h ratio when available.
Primary pulse classes are strong buying >=1.2, strong selling <=0.85, or neutral,
using the existing 14/15-minute coverage and 90s freshness criteria at T and D.
Unknown input never becomes neutral. Record approach and response volume and
flow changes, not just a ratio. Relative volume divides the current 15m total by
the mean of three preceding, non-overlapping, healthy 15m windows. Above/below
that prior mean is a descriptive modifier, not another optimized candidate or
proof that directional imbalance represents unusually large trades.
Book persistence uses three fresh observations at
D-10m, D-5m and D, all with the same sign beyond 0.2; it is descriptive sampled
depth, not identified cancellations/icebergs. Book/asset availability is separate
from primary taker availability; sparse secondary fields must not silently change
the primary denominator.

Compare S/R-only, observed price-response-only, pulse-only conditional on encounters,
and the four fixed hold/break x pressure-with/against combinations, separately by
support/resistance. Neutral and unresolved rows remain visible in the full ledger.

For an actual away-from-S/R pulse control, sample a fixed 2h grid and require
the start, middle and decision snapshots to stay over 1% from any then-known zone.
Match an event to a prior control within 14 days, with its 4h outcome complete
before the event's observation starts. Match completed-4h regime, response pulse
class, 15m return within 0.25pp, and 1h volatility within a factor of two. Select by
feature distance only, without replacement. Never match on future outcomes. Match
availability and candidate counts are reported; a sparse matched sample is not
evidence of no effect. Controls approximate conditioning, not randomization.

## Outcomes, uncertainty and advancement gate

Primary labels are raw next-open-to-4h return, favorable/adverse excursions, and
the same return after a one-minute entry delay. Secondary horizon is 1h. All start
after D; unknown/censored outcomes remain missing. Fixed-horizon cost-adjusted
markouts subtract 0.11% and 0.20%. They are **not realized strategy PnL**: no TP,
stop, funding, position ownership, liquidation or portfolio path is simulated.

Hold/rejection hypotheses use the direction away from the level (support long,
resistance short); acceptance/failure hypotheses use the opposite. Test eight
fixed cells, no threshold search. Comparison against the price-only complement
asks whether flow adds information; matched-control differences ask whether the
S/R location adds information beyond measured price/pulse context.

A cell merits a later full-stack replay only if it has >=30 events, >=10 per
chronological half, >=3 months with >=5 events, >=20 matched controls with >=8 per
half, positive primary and delayed mean at 0.20% costs, positive price-complement
and matched-control improvement in both halves, and no populated month with a
delta worse than -0.10pp. Also require positive 5th-percentile bounds from fixed
7-day-cluster resampling for both deltas. Intervals are nominal, not corrected for
the eight related tests. Passing means a research lead, never permission to trade.
An empty passing set is a valid result. Since all history was previously explored,
the two halves test stability, not true out-of-sample performance.

Only after a cell passes should its action be specified and tested in the corrected
long/shared-account stack, including missed TPs/recoveries, fees/funding, exposure
and both TP models. Live promotion still requires frozen forward observation.

## Reproduction

```powershell
npx.cmd ts-node scripts/sr-pulse-encounter-tests.ts
$env:SR_PULSE_OUT = 'backtests/hype/sr-pulse-encounters-rerun'
node --max-old-space-size=6144 -r ts-node/register scripts/hype-sr-pulse-encounter-study.ts
Remove-Item Env:SR_PULSE_OUT
```

Use a new output directory. Do not sync raw files during the run. The runner checks
the preceding baseline's source/input identity, fingerprints its own source and
all consumed inputs, and keeps original data/config/state untouched. It reuses
the existing event-atlas renderer for a stratified gallery of successes and
failures, with encounter-start markers, frozen levels and D/future separation.
Hourly candles straddling D are omitted so their later closes cannot appear in
the known-at-D portion of the chart. Plot-window EMAs are illustrative, not the
completed-4h matching features. An approach-band encounter need not trade the
exact level; the response classifications do not prove passive absorption.

The [September 5 findings](../../research/codex-astra-sr-pulse-encounter-findings-2026-09-05.md)
use `backtests/hype/hype-sr-pulse-encounters-2026-09-05-final/`: 509 encounters,
507 primary observations, zero qualifying cells. The fixed definition was not
retuned after seeing those outcomes.
