# Shared definitions and causal contract

These are research meanings, not a new production engine. Numerical choices
belong to a versioned study card. Source-specific exceptions stay explicit.

| Primitive ID | Meaning and required decision |
|---|---|
| P-SWING | Confirmed pivot with occurrence, confirmation and availability timestamps. Width/prominence/ties are declared. A protected swing acquires that label only after the relevant continuation break, never retrospectively |
| P-RANGE | Causally anchored opposite extremes with frozen IDs/bounds/EQ and lifecycle. Post-impulse first-swings, calendar range and rolling high/low are different types |
| P-SWEEP | Trade beyond a previously known extreme plus declared reclaim/reaction. A wick, an outside close followed by reclaim, and a breakout that stays outside are different states |
| P-STRUCTURE | Break of a known reference with explicit wick-versus-close rule; external/context and internal/trigger references separate. BOS continuation and initial reversal/CHoCH do not imply identical maturity |
| P-ZONE | Immutable origin candle/base and bounds, linked to the displacement/structure event that qualifies it. Not an arbitrary pivot cluster; origin time precedes eligibility. Breaker inherits the original zone and its failure event |
| P-RETEST | A distinct return after formation/departure, with event time and touch count. First touch after source birth is not necessarily first touch after the bot eventually notices the zone |
| P-LIQUIDITY | Known extrema/equal-level clusters are **price proxies for possible resting orders**, not observed stop quantities. Observed L2 depth, aggressor trades and liquidation prints are separate measured inputs |
| P-IMPULSE | A price/volume displacement up to the decision; body/range/return/ATR/RVOL thresholds must be declared. A large candle does not prove future continuation or institutional participation |
| P-PROFILE | Distinguish volume-at-price POC from time-at-price TPO. Venue, bins, session, coverage, weighting and completion define identity. Naked status is queried as-of, not copied from the final map |
| P-CALENDAR | Declared timezone/session boundaries. Completed day/week extrema unavailable until completion; current open available only once observed. Holiday/DST conventions matter outside UTC crypto |
| P-BRACKET | Side-valid entry/stop/target with frozen prices/IDs, initial cash risk and R. Structural thesis invalidation, submitted protective stop and cancellation before fill are different mechanisms |
| P-CLOCK | All persisted times UTC epoch ms. Available-at is the latest required input arrival/publication; action and fill cannot precede it. Missing/late data is unknown, not false or favorable |

## Three different meanings of validation

1. **Setup validation:** the observable sequence needed before taking risk.
2. **Implementation validation:** prefix invariance, source timing and execution
   accounting are correct, including non-events and failed attempts.
3. **Economic validation:** after-cost incremental results survive controls,
   regimes/months, fill assumptions, concentration and forward evidence.

A chart can satisfy the first and still lose money. A library link check proves
none of these. A causal verified replay is not automatically a profitable rule.

## Shared event lifecycle

`context known → armed → swept/broken → confirmed → order eligible → filled`

Branches before fill: unknown input, invalidated, expired, target consumed,
occupied, no retest, cancelled, rejected or never filled. After fill: protective
stop, target, thesis failure, declared time exit or still open at cutoff.
Not every family requires every stage: record its own ordered prerequisites.

Never infer within-bar ordering that OHLC cannot provide. Use an available
lower-timeframe path, conservative priority and ambiguity sensitivity, or skip
the ambiguous case. A resting limit touched in a candle is not guaranteed
to have filled. An impulse-closing confirmation cannot fill at its earlier low.

For stop/target ambiguity use declared conservative handling and report the
alternative bound; gap-through stops need worse executable-price handling.
One trade per declared setup identity by default, with all overlapping/occupied
signals retained for audit. Multiple strategies need explicit capital ownership.

## Shared risk and transfer cautions

Fixed $10k notional comparisons do not have fixed dollar risk when structural
stops differ. Report both notional and initial stop-risk. Fixed-risk sizing is
a different experiment and needs notional/leverage/liquidity caps. Source
advice such as 2% account risk or minimum 1.5R is not our default live policy.

Test outcomes after fees, spread, slippage and declared funding treatment.
An apparently precise invalidation can still slip. Partial exits alter residual
exposure, target allocation and later trades, not just fees. More confluence
does not mathematically imply higher probability; correlated filters can merely
reduce sample size. Include false signals and no-trades in the denominator.
