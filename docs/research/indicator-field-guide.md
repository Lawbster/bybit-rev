# Indicator field guide: candles, S/R and market pulse

Research date: September 5, 2026. Educational reference for HYPE/USDT and other
pairs; not a proposed live configuration. **Zero new strategy variants or
simulations in this pass.** No runtime, configuration, state or data changes.

## Practical conclusion

- We can calculate most mainstream price/volatility indicators from the candle
  archive already held locally. Volume, turnover and HL flow extend that range
  substantially. Exact order-book absorption and volume-at-price have additional
  data requirements; ordinary OHLCV cannot reconstruct them.
- The useful direction is **different information in combination**: regime,
  location, price response and participation. Five oscillators agreeing is not
  five independent reasons to trade. None of the sources establishes a new
  profitable HYPE configuration.
- Start future investigation with the **long ladder's exposure decisions**, not
  a simultaneous long/short redesign. Candidate questions below focus on failed
  recoveries and genuine support responses, while explicitly measuring the
  recovery/TP cycles a restriction sacrifices. These are a shortlist for user
  selection, not an authorized test grid.

Read this alongside the [tested-setup register](../../research/TESTED-SETUPS.md)
and [current replay contract](current-stack-replay.md). The register governs
what has actually been tested; this guide describes what could be measured.

Quick reading path: [data feasibility](#3-what-our-data-can-actually-support),
[indicator collection](#5-educational-indicator-collection),
[trader stories](#6-what-trader-stories-contributed), then
[possible combinations](#7-how-this-could-fit-our-system).

## 1. A simple vocabulary

| Question | Indicator role | Example |
|---|---|---|
| Which direction has price been moving? | Trend direction | EMA slope, directional movement |
| Is it travelling cleanly or bouncing around? | Trend strength / efficiency | ADX, efficiency ratio |
| Is the move speeding up or slowing? | Momentum | RSI, CRSI, ROC, MACD |
| How large are normal and unusual movements? | Volatility | ATR, Bollinger bandwidth |
| Where are we relative to a known reference? | Location | S/R, prior high/low, VWAP |
| Is there meaningful activity behind the move? | Participation / flow | Relative volume, taker delta, OI |
| What happened when that activity met the level? | Price response | Rejection, reclaim, accepted break |

**Oversold** means recent losses dominate the chosen momentum calculation. It
does not mean cheap, unable to fall further, or that sellers are finished.
**Divergence** means price and a selected indicator disagree across explicitly
defined observations. It is a warning to investigate, not a scheduled reversal.
RSI can stay extreme in strong trends. [Fidelity: RSI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/rsi).

A feature can describe the current state accurately without forecasting useful
returns. Our eventual question is whether it changes the distribution of
*executable, cost-adjusted outcomes* at a particular ladder decision.

## 2. What the repo already does

This is not an EMA-only system, and indicator-plus-pulse research is not entirely
new. The following is a local source/config inspection, not a VPS state check.

| Surface | Actual status | Local reference |
|---|---|---|
| EMA200 / EMA50 slope on 4h | Active trend gate | `src/bot/strategy.ts`, `checkTrendGate` |
| RSI1h + CRSI4h + 12h return | Active **first-rung** overextension gate; all three conditions required | `strategy.ts:319`, `index.ts:3393`; config: return >=2.55%, CRSI <=56.9, RSI >=59.4 |
| RSI after a TP | Active conditional re-entry cooldown: RSI1h >60 gives 30 minutes | `src/bot/index.ts:809`, `bot-config.json:229` |
| ATR volatility block | Implemented, currently disabled by `filters.volExpansion=false` | `src/bot/strategy.ts`, `checkVolExpansion` |
| RSI, CRSI, BB and other confluence scores | Context/observability; score-partial action remains shadow-only | `src/technical-engine.ts`, `bot-config.json:108` |
| S/R + pulse | Already active in support-reopen, resistance partial exits and/or damage gating | `src/bot/sr-support-reopen.ts`, `sr-shadow.ts`, `index.ts:2441`, `damaged-regime-latch.ts` |
| General indicator library | Computes EMA/SMA, RSI, MACD, stochastic, Williams %R, ROC, BB, ATR, OBV slope, relative volume and wick/body metrics | [src/indicators.ts](../../src/indicators.ts), `computeIndicators` |
| Technical-context engine | Computes RSI/CRSI, EMA, BB, ATR, ADX, Williams %R, relative volume, weekly/swing-low VWAP and level context | [src/technical-engine.ts](../../src/technical-engine.ts), `computeTFIndicators`, `computeCrsi`, `getContext` |

An imported indicator is not necessarily computed or used: for example, the
general library imports CCI/StochasticRSI without exposing them in its current
snapshot; the context engine imports `VolumeProfile` without computing a profile.
ADX currently exports strength, not the accompanying +DI/-DI values.

Historical overlap: the **May 1, 2026 Codex 5.15b/5.15c** entries in the
[signal ledger](../../research/codex-short-signal-results.md) crossed taker,
long/short-ratio and Bybit book-withdrawal signals with RSI/BB/EMA/ROC/volume/CRSI.
The ledger identifies a **6.5-day mined sample**, not a comprehensive current
ladder validation. Several combinations failed. Its own carry-forward rule
required fresh observations. Do not reuse its old returns as current evidence.

The gap worth exploring is narrower: conditional price/flow behaviour at
exposure decisions, tested through the corrected current-stack replay. Read the
recent L03-L06 definitions before claiming any candidate is new.

## 3. What our data can actually support

The research cutoff remains **2026-09-04 19:01 UTC**. This pass did not refresh
data or repeat the full continuity audit.

| Data | What it supports | Important boundary |
|---|---|---|
| Bybit HYPE 1m OHLC, volume and turnover | Higher-timeframe candles; almost all price, momentum, volatility and bar-volume indicators | Historical file starts **2024-12-05 12:55 UTC**. Use the merged archive/live stream and explicit repair overlay, not the historical file alone |
| Repaired HYPE minute history | Continuous candle-based research up to the pinned cutoff | Prior recovery verified **919,086 bars, 11 repairs, no internal gaps**. Historical recovery is not proof those bars reached the live collector during outages |
| BTC minute history and live append | HYPE/BTC relative performance, rolling correlation/beta and existing BTC controls | Synchronize closed timestamps; verify BTC joint coverage separately |
| HL taker minutes | Buy/sell quantity and notional, rolling delta/CVD, activity and large-trade shares | Rich flow starts **May 17, 2026 20:43 UTC**; publication latency and coverage matter |
| HL sampled band book + asset context | Band imbalance/persistence, native OI change, mark/oracle context | Rich book/asset streams start May 17. Aggregated snapshots are not exact queues or cancellation histories |
| Separate HL REST OI/funding | Slower positioning/carry context | Files start **April 25, 2026 23:09 UTC**; cannot supply the missing earlier taker/book history |
| Bybit/Binance OI, funding, ratio and liquidation streams | Venue-specific supplementary confirmation | Different cadences, definitions and coverage; do not assume identical full-window availability |
| HLP snapshots | Observational vault context | Not a deposits/withdrawals ledger and not proven directional capital flow |

Sources: [candle-recovery evidence](../../research/codex-astra-candle-gap-recovery-findings-2026-09-05.md),
[HL inventory and data semantics](../../research/codex-astra-hl-sr-research-readiness-findings-2026-09-04.md),
and the input manifest in `backtests/hype/hype-ladder-sizing-2026-09-05/manifest.json`.
The readiness document contains defects subsequently repaired; use it for its
dated inventory, not as the current engine-status report.

### Compute now, approximate, or collect more?

- **Closed OHLC:** EMA/SMA, RSI/CRSI, MACD, ADX/DMI, ATR, Bollinger/Keltner,
  Donchian, efficiency ratio, CHOP, Ichimoku, historical volatility and causal
  pivot/rejection patterns are computationally feasible.
- **OHLC + volume:** OBV, MFI, CMF, relative volume and a bar-price VWMA are
  feasible. These are not aggressor-flow measurements.
- **Volume + turnover:** VWAP across complete, aligned bars can use
  `sum(turnover) / sum(volume)`. Bybit linear USDT candles specify base-coin
  volume and quote-currency turnover. This avoids the usual typical-price
  approximation. An anchor inside a minute still needs finer data for precision.
  [Bybit kline fields](https://bybit-exchange.github.io/docs/v5/market/kline).
- **HL buy/sell aggregates:** rolling cumulative delta is feasible for healthy
  windows. Minute aggregation does not reveal whether the selling came before
  or after a within-minute wick.
- **Volume profile / footprints:** OHLCV provides a *proxy*, not exact executed
  quantity at each price. TradingView itself describes lower-timeframe bar
  allocation and up/down volume, not true buy/sell classification. Our sampled
  book cannot fill this gap. [Volume-profile methodology](https://www.tradingview.com/support/solutions/43000502040-volume-profile-indicators-basic-concepts/).
- **Not established from these inputs:** exact queue position, iceberg identity,
  spoofing intent, full-market CVD, options dealer gamma, equity breadth, macro
  surprise data, or on-chain valuation metrics. A heatmap cannot be reconstructed
  from candles by assuming where liquidations must have been.

### History length is measured in bars, not indicator names

RSI14 on 15m and RSI14 on 4h are different measurements. CRSI's 100-period rank
needs roughly 100 returns at its chosen timeframe. A daily EMA200 needs at least
200 daily observations just to seed, plus a fixed warm-up convention. The live
context's **140-day** window cannot supply that; a 4h EMA200 needs far less history.
The longer local archive does not silently give the VPS a longer daily cache.

HYPE getting older provides more observations and more room for long-horizon
calculations. It does **not** automatically make an indicator more predictive.
Neither 100 days of minute rows nor a growing listing age guarantees many
independent examples of a rare regime transition.

## 4. What transfers from each market

These are documented uses, not a popularity ranking or proof of profitability.

### Crypto: price structure plus derivatives participation

The transferable toolkit includes trend/oscillator/range indicators, but crypto
also offers OI, funding and aggressor flow. Treat volume and CVD as venue-specific.
An HL-perpetual signal is not automatically Bybit demand, and neither is spot
accumulation. OI measures outstanding contracts, with a buyer and seller for each;
rising OI alone cannot establish that informed longs are entering.
[CME: volume and OI definitions](https://www.cmegroup.com/trading/about-volume.html).

Research evidence is mixed. Hudson and Urquhart found technical-rule
predictability in their cryptocurrency sample, but **not for Bitcoin in their
out-of-sample period**, while some other coins retained it. This supports testing
conditional behaviour, not assuming a transferable recipe.
[Original study, 2019](https://hull-repository.worktribe.com/output/2328042/technical-trading-and-cryptocurrencies).

Practical adaptation: define UTC/session anchors explicitly in a 24/7 market;
separate native OI from USD OI inflated by a rising mark; compare funding on a
common interval; use actual flow together with the price response it produced.

### Forex: trend/range distinction, volatility and level behaviour

MA, RSI, ADX, ATR and session/previous-period levels appear in the practitioner
discussions below. The stronger transferable lesson is not their exact settings:
**a level may interrupt a move, while a decisive crossing may accelerate it**.
Osler's FX research used actual dealer orders to investigate this mechanism.
It is a plausible research mechanism for HYPE, not evidence HYPE has identical
order clustering. [New York Fed: currency orders and exchange-rate dynamics](https://www.newyorkfed.org/research/staff_reports/sr125.html).

Volume requires special care: OANDA's candle `volume` is the **number of price
updates**, not global executed currency volume. FX futures volume is a different
dataset. We should not import a forex "volume strategy" without understanding
which one it used. [OANDA candle specification](https://developer.oanda.com/rest-live-v20/instrument-df/).

Qi and Wu found that technical-rule performance weakened in the more recent
part of their historical FX sample. Market maturity can reduce an apparent edge,
not merely improve indicators. [Authors' paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=788013).

### Stocks: relative strength, participation and event anchors

Equity traders in the cited discussions use daily trend context with intraday
VWAP, relative volume and strength versus an index or sector. Brian Shannon's
own educational material emphasizes anchored VWAP around identifiable events.
That is practitioner methodology with commercial interests, not independently
verified return evidence. [Shannon: when and where to anchor VWAP](https://alphatrends.net/when-where-why-to-set-anchored-vwap/),
[equity-trader discussion](https://www.reddit.com/r/RealDayTrading/comments/1anqpyl/indicators_for_an_indicator_skeptic/).

For HYPE, the analogous question is strength versus BTC and a mechanically
identified breakout/damage anchor. There is no equity opening auction or earnings
calendar to copy directly. A future equity dataset would also need explicit
sessions, split/corporate-action handling and point-in-time universe membership.

Lo, Mamaysky and Wang found that some systematically identified stock-chart
patterns carried incremental information. That is not the same as demonstrating
a profitable, fee-adjusted HYPE strategy.
[Original stock-pattern study, 2000](https://www.nber.org/papers/w7613).

## 5. Educational indicator collection

Status codes: **E** = relevant calculation exists somewhere locally, not certified
for every live/replay use; **N** = calculable from held inputs but needs an audited
feature implementation; **P** = only a proxy with current granularity.
Conventional settings below explain an indicator; they are not selected HYPE
parameters. Grouped alternatives are not independent confirmations.

### A. Trend and regime

| Indicator / status | What it tells us | Possible S/R + pulse use; main failure |
|---|---|---|
| **EMA/SMA and slope — E** | Smoothed direction and distance from a trailing average | Keep as the comparison control. Strong downtrend + resistance reclaim failure differs from a pullback above a rising average. Crosses lag and whipsaw |
| **ADX + DMI — E strength / N directional export** | ADX measures directional-movement strength; +DI/-DI supply direction. Conventional ADX 20/25 are reference levels, not universal boundaries | Ask whether sell pressure at failed support is occurring in an *intensifying downtrend*. Rising ADX alone can describe either a rally or a selloff. [Definition](https://www.fidelity.com/viewpoints/active-investor/average-directional-index-ADX) |
| **Efficiency ratio / KAMA — N** | ER compares net displacement with total absolute close-to-close travel. Near 1 is one-way travel; near 0 is little net progress. KAMA uses ER to change smoothing | Could distinguish a smooth decline from recoverable chop at the same EMA distance. ER needs a direction sign and has short-window noise. [Calculation](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-overlays/kaufmans-adaptive-moving-average-kama) |
| **Choppiness Index — N** | Compares accumulated true range with the overall window range; high generally means choppier | Alternative to ER/ADX for conditioning a level encounter. Non-directional, and a previously choppy market can break suddenly. [Definition](https://www.tradingview.com/support/solutions/43000501980-choppiness-index-chop/) |
| **Donchian channel — N reusable feature** | Rolling highest high / lowest low; mechanical range boundaries | Combine an accepted break or failed breakout with HL flow. Use the *prior* window for a breakout test; including the tested bar changes its meaning. [Definition](https://in.tradingview.com/support/solutions/43000502253-donchian-channels-dc/) |
| **Ichimoku — N** | Rolling high/low midpoints and a cloud summarize direction/location across horizons | Possible regime comparator, lower initial priority because it overlaps existing trend information. Plotting a line forward is not forecasting. Misaligning the backward-plotted close creates look-ahead. [Definition](https://www.tradingview.com/support/solutions/43000589152-ichimoku-cloud/) |

Useful ER example: a price that falls $5 through $5 of total absolute travel has
ER=1. A price that ends $1 lower after $10 of back-and-forth travel has ER=0.1.
Both are down; their paths are very different. Neither predicts the next turn.

### B. Momentum and exhaustion

| Indicator / status | What it tells us | Possible S/R + pulse use; main failure |
|---|---|---|
| **RSI — E, partly active** | Balance of smoothed gains versus losses; commonly 14 bars | Compare persistent weakness, recovery and level reclaim, rather than just RSI <30. Strong trends can stay extreme; add only information absent from existing RSI gates |
| **ConnorsRSI — E, partly active** | Mean of short RSI, RSI of the up/down streak, and one-bar-return percentile rank; usual form 3/2/100 | Short-term pullback exhaustion near support, checked against actual price/flow response. Highly sensitive; extreme does not establish a floor. [Definition](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/connorsrsi) |
| **ROC / MACD — E** | ROC is return over a chosen lag; MACD compares fast/slow EMAs and a smoothed signal | Ask whether a rebound is losing momentum at resistance while buying still arrives. MACD overlaps EMA/ROC and does not reveal new order flow |
| **Stochastic / Williams %R — E** | Close's location within a trailing high-low range | Potential range-reentry confirmation after a wick. These two are closely related transformations; persistent extremes occur during breakouts |
| **RSI or flow divergence — N event definition** | Price makes a new extreme while momentum/flow does not, or flow makes an extreme without matching price progress | Useful hypothesis at a known level. Requires a frozen swing/window definition and confirmation delay; handpicked retrospective pivots can manufacture excellent-looking signals |

The relevant local formulas are in `computeIndicators` and `computeCrsi`. Fix
the CRSI percentile convention explicitly: current `computeCrsi` includes the
current return in its rank sample. A new prior-only implementation would not be
identical. Do not silently alter the baseline while standardizing a feature.

### C. Volatility and expansion

| Indicator / status | What it tells us | Possible S/R + pulse use; main failure |
|---|---|---|
| **ATR / ATR% — E** | Smoothed true range, including gaps from the prior close; ATR% normalizes by price | Express distance to resistance or a rejection candle in units of typical movement. Directionless and lagging after shocks. [Definition](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr) |
| **Bollinger %b + bandwidth — E** | %b locates price relative to a rolling mean and standard-deviation bands; width describes compression/expansion | Separate compressed range, expanding breakout and failed upper-band push using flow. A band touch is not a reversal; a squeeze supplies no reliable direction or deadline. [Bollinger's rules](https://www.bollingerbands.com/bollinger-band-rules) |
| **Keltner channels — N** | Usually an EMA with ATR-based bands, instead of standard-deviation bands | An alternative normalization for extension and range breaks. Do not add as another independent vote alongside highly similar BB/ATR features. [Definition](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-overlays/keltner-channels) |
| **Realized volatility / downside range expansion — E components, N selected contract** | Dispersion of closed returns; directional range expansion compares a completed move with an earlier normal range | Distinguish quiet drift from acceleration through support. Use earlier observations for normalization; never normalize against the eventual month's volatility |

For example, a fixed 0.3% resistance buffer has a different meaning when normal
bar ranges are 0.1% versus 1%. Testing an ATR-normalized distance is a different
hypothesis from retuning the same fixed-percent grid. It still needs comparison
against that grid and the unchanged stack.

### D. Location and market structure

| Indicator / status | What it tells us | Possible S/R + pulse use; main failure |
|---|---|---|
| **VWAP / anchored VWAP — E weekly/swing-low, N frozen event anchors** | Volume-weighted transaction-price reference since a declared start | Did price regain the average price since a known breakdown, and hold it with confirming participation? It is not the cost basis of current holders; anchors picked after the outcome create hindsight |
| **Prior-day/week levels, rolling highs/lows and reclaims — E components** | Known boundaries and whether price rejects or remains beyond them | Test flow *response at* the level, not only distance. Today's eventual high/low and a completed-session profile are unavailable earlier that day |
| **Volume profile: POC / value area — P** | POC is the most-active price bin; value area is a chosen fraction of past volume | Could add a traded-activity map to pivot-based S/R. Candle allocation and bin/anchor choices can move levels materially; validate as a proxy, not exact resting liquidity |
| **Confirmed pivots / Fibonacci levels — E components** | Pivots identify confirmed local extrema; Fib marks chosen fractions of a selected swing | Keep as context candidates with fixed anchors. No special ratio is assumed superior. A pivot requiring right-hand bars becomes known only after those bars close |

Our current 30m S/R engine uses four right-side confirmation bars: a pivot is not
available at the timestamp of its extreme. A larger set of attractive lines is
not necessarily a better level model. Keep zone construction unchanged when
testing an indicator's extra information first.

### E. Participation and relative performance

| Indicator / status | What it tells us | Possible S/R + pulse use; main failure |
|---|---|---|
| **Relative volume (RVOL) — E rolling / N time-matched** | Current activity relative to a declared historical reference | Is a reclaim meaningful activity or a thin bounce? Distinguish volume/current rolling mean from volume at the same time on prior days. Neither implies buy direction. [Time-matched definition](https://www.tradingview.com/support/solutions/43000705489-relative-volume-at-time/) |
| **OBV — E** | Adds/subtracts an entire bar's volume according to close direction | Cheap long-history participation proxy to compare against real HL delta during overlap. A tiny positive close assigns all volume positive, even if most trades were aggressive sells |
| **MFI / Chaikin money flow — N** | MFI combines typical-price change with volume; CMF volume-weights where closes sit within bar ranges | Candidate candle-volume controls before claiming HL contributes new information. Neither measures actual cash deposits or identified investor accumulation. [MFI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/mfi), [CMF](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/cmf) |
| **Relative strength versus BTC — E BTC context / N dedicated residual feature** | HYPE's return relative to BTC over matching intervals, optionally adjusted for a past-estimated beta | Is HYPE refusing to recover while the broad market rebounds? Different from RSI. Correlation/beta change; raw outperformance can just reflect higher volatility. [Comparison concept](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/relative-strength-comparison) |
| **CVD / OI / funding / book persistence — E inputs** | Executed aggression, outstanding exposure, carry and displayed liquidity are distinct measurements | Pair these with candle responses. Selling without price progress is an absorption *candidate*; OI and snapshots cannot prove trader identity or an unbreakable passive bid |

Useful definitions for a future specification, not new production code:

```text
trueRange = max(high-low, abs(high-priorClose), abs(low-priorClose))
ER(n) = abs(close-close[n]) / sum(abs(one-bar close changes), n)
VWAP(anchor,T) = sum(turnover over eligible bars) / sum(base volume)
rollingDelta(n) = sum(HL buy quantity - HL sell quantity over eligible minutes)
normalizedDelta = (buy quantity - sell quantity) / (buy quantity + sell quantity)
ATR distance = (price-referencePrice) / previously available ATR
relativeReturn = HYPE log return - BTC log return over the same interval
```

Zero denominators and missing coverage mean invalid/undefined, not evidence of
neutral conditions. Do not average per-minute buy/sell ratios when the intended
feature is the ratio of total buying to total selling.

## 6. What trader stories contributed

The following **nine discussion records** were selected for mechanisms,
disagreement and failure reports. They are not a representative survey, verified
track records or independent trials. Anonymous claims of profit and backtests
without reproducible inputs are not accepted as results for this project.

| Discussion | Practical observation | What we take, and what we do not |
|---|---|---|
| [BitcoinMarkets: choosing indicators, July 2022](https://www.reddit.com/r/BitcoinMarkets/comments/vtj9kw/) | A new BTC trader describes indicators helping and hurting; replies disagree between simple EMA/RSI and price/volume | Start with a specified question and simple controls. Neither the positive nor negative personal claim proves an edge |
| [Forex: RSI50 and price action, July 2021](https://www.reddit.com/r/Forex/comments/ojhozt/using_rsi50_and_price_action_to_signal_trends/) | Some use RSI for trend confirmation; another reports finding no value. A reply requests charts posted before the move | Test context-specific RSI behaviour and retain failures. The reported FX backtest is not reproducible evidence |
| [Forex: ATR explanation, August 2022](https://www.reddit.com/r/Forex/comments/wxgt8s/eli5_average_true_range/) | Traders discuss movement in multiples of usual bar size rather than fixed pips | Borrow normalization. Reject the unsupported leap that a large ATR multiple must retrace; ATR also includes prior-close gaps |
| [Daytrading: volume indicators, October 2022](https://www.reddit.com/r/Daytrading/comments/yby8yq/volume_indicators/) | One ES scalper cannot find useful incremental information; another defines RVOL against cumulative activity at the same time of day | Useful precise denominator, plus an honest negative experience. No claim that volume tools universally work or fail |
| [Daytrading: AVWAP enthusiasm and pushback, January 2024](https://www.reddit.com/r/Daytrading/comments/1984zdp/i_believe_avwap_is_the_most_important_indicator/) | A former enthusiast no longer uses AVWAP but retained the idea of anchoring after a significant event | Event anchors are testable; the indicator is not a money machine. Do not optimize anchors using completed winners |
| [RealDayTrading: indicator skeptic, February 2024](https://www.reddit.com/r/RealDayTrading/comments/1anqpyl/indicators_for_an_indicator_skeptic/) | Daily structure, intraday VWAP, index/sector comparison and RVOL are discussed together | Borrow division of roles and relative-strength comparisons. Claims about institutional intentions or current holders' cost basis are not established by VWAP |
| [Algotrading: ADX backtest, February 2025](https://www.reddit.com/r/algotrading/comments/1irhrcw/backtest_results_for_an_adx_trading_strategy/) | Initial DI-cross strategy disappoints; revised rules look better; RSI hurts, EMA changes drawdown; commenters challenge the bullish sample and absent OOS evidence | Additional confirmation can reduce performance. The claimed improved return is not a transferable finding |
| [OrderFlow Trading: CVD to verify an entry, May 2025](https://www.reddit.com/r/OrderFlow_Trading/comments/1kf89q4/cvd_indicator_to_verify_the_entry/) | Continued aggressive selling while price stalls at demand, followed by possible buying, is described as an absorption setup | This supplies a measurable price-versus-flow question. With our data it remains a proxy, not proof of the passive buyer or guaranteed reversal |
| [Trading: RSI divergence experience, September 2025](https://www.reddit.com/r/Trading/comments/1nosv2p/whats_everyones_experience_with_rsi_divergence/) | Poster describes inconsistency and waits for lower-timeframe structure after higher-timeframe divergence | A warning and an executable confirmation are different events. Later confirmation must not inherit the earlier, better entry price |

The valuable common thread is **sequence and context**, not a consensus winning
indicator. We should be as willing to preserve a trader's failed idea as their
successful-looking example. The threads also contain factual mistakes: for
example, a histogram or weighted mean does not require normally distributed
returns, and VWAP alone does not identify institutional orders.

## 7. How this could fit our system

The following is **my inference from the literature, practitioner accounts and
our data**, not a tested result. Keep the ladder's existing opportunity set,
S/R geometry and all other policies as the comparison baseline.

### Four candidate questions to choose between later

| ID | Question / illustrative combination | Ladder decision it could inform | What could go wrong / existing overlap |
|---|---|---|---|
| **Q1: Is the recovery failing despite buying?** | At known resistance, a rebound's ROC/RSI improves but price fails to hold above the level despite meaningful positive HL delta; examine OI separately | Whether an otherwise eligible deep add is buying a failing rebound | Could block valid absorption before a breakout. Unlike broad buy-confirmation tests, asks about the *response to* flow. Still compare with L03/L04 resistance/pulse definitions |
| **Q2: Is selling being absorbed, or breaking support?** | At known support, significant negative flow produces diminishing downside progress and an observed reclaim, versus continued close-through with expanding ranges | Quality of a genuine-drop add; do not require positive taker flow indiscriminately | Waiting for a reclaim may lose the best recovery entries. Existing support-reopen and L04/L05 already tested related flow/persistence ideas; this is not a fresh family until exact overlap is checked |
| **Q3: Is this chop becoming a directional selloff?** | Falling price with increasing ADX/-DI dominance or signed ER, plus ATR/range expansion and persistent sell flow | Whether to reduce additional exposure in a deteriorating regime | Can trigger after damage or just before the bounce, duplicating the damaged latch. Test one strength measure against EMA/returns first, not all of them stacked |
| **Q4: Has price genuinely reclaimed the damaged area?** | Known damage-event AVWAP or fixed prior-range boundary reclaimed, with RVOL and HYPE/BTC strength; pulse checks participation | Distinguish weak relief rallies from stronger recovery attempts | Anchor sensitivity and re-entry delay can sacrifice many TPs. Existing trend/re-entry studies are controls, not ignored history |

Q1/Q2 are closest to the user's concern about buying local tops or repeatedly
adding into damage. Q3 supplies a regime lens for those encounters; Q4 is more
complex and a later option. These priorities reflect research usefulness and
available inputs, **not an expected-profit ranking**.

Notice the two different meanings of selling:

| Same broad observation | Price response already observed | Candidate interpretation, not a prediction |
|---|---|---|
| Heavy selling at support | Range expands lower, closes remain below support | Selling is achieving downside progress |
| Heavy selling at support | Further lows stop progressing, price reclaims the level | Potential absorption/exhaustion |
| Heavy buying at resistance | Price holds above the boundary on subsequent completed observation | Potential accepted breakout |
| Heavy buying at resistance | Price falls back beneath the boundary with little upward progress | Potential failed breakout / buying absorbed |

This is why blanket "buy flow good / sell flow bad" can be too crude for a
mean-reversion ladder. It is an explanation of a hypothesis, not proof that the
opposite of a failed filter will work.

### Sensible engineering boundary for a later approved study

1. Define a **pair-neutral feature contract**: symbol, venue, bar interval,
   formula/version, lookback/warm-up, bar end, available-at time, coverage and
   validity reason. Store unrounded research values; round only for display.
2. At an existing eligible add or independently defined level encounter, join
   one exact as-of candle snapshot, the existing known S/R zone and fresh pulse.
   Preserve timer/drop/both and depth, surviving notional, unrealized PnL and
   existing blockers. A signal that never occurs when an add is eligible cannot
   save that add.
3. Keep research features out of transaction coordinators. A future accepted
   policy could return allow/hold/size with a reason, but its action and release
   rules must be specified and tested separately. No new trader or PM2 service
   is needed merely to investigate these features.
4. Reuse the [event atlas](event-atlas.md) for causal chart inspection: known
   information left of decision time, future outcomes on the right. Add panels
   later for selected features. Human local-top labels remain discovery examples;
   include mechanically sampled unsuccessful warnings and normal encounters.

## 8. Causality and reuse traps to address before testing

These were scope-relevant observations from the educational pass. The subsequent
[closed-bar timing refinement](closed-bar-indicator-testing.md) adds a separate
research-safe interface and regression tests; legacy/live semantics stay unchanged.

- `src/indicators.ts:221`, `getSnapshotAt`, searches offsets including
  **+one candle interval**. Its snapshots are keyed by source candle timestamp.
  Do not use this generic helper for a historical as-of join; it can select a
  future row or a final close that was unavailable at candle start. This is not
  evidence that the current HYPE trading loop calls that helper.
- `src/bot/context-manager.ts:98` feeds its candle array into the general
  `getContext`; `src/technical-engine.ts:460` filters by candle **start** and then
  aggregates higher timeframes. This is not a general completed-bar contract.
  Actual live partial-bar observations are not inherently look-ahead, but a
  historical final bar cannot stand in for them. Existing RSI/CRSI consumers and
  new closed-bar features need explicit parity treatment; do not silently change
  the live calculation while adding research indicators.
- Reuse the causal availability/quality primitives in
  [replay-causality.ts](../../scripts/replay-causality.ts),
  [replay-market-inputs.ts](../../scripts/replay-market-inputs.ts) and
  [hl-data-quality.ts](../../src/hl-data-quality.ts). Older HL records without
  receipts use a disclosed publication-lag assumption, not invented delivery
  evidence. Book source time, aggregation and truncation remain authoritative.
- Fix pivot/anchor availability. An event's later high/low, later confirmation
  bars, today's final VWAP/profile, and a future-picked divergence must not move
  back onto the decision side of a chart. Test that appending future observations
  leaves earlier feature values and decisions unchanged.
- Freeze normalization history. Do not fit percentiles, beta, regime labels or
  indicator thresholds using the whole evaluation period. Keep volume units and
  the exact RVOL denominator explicit; the existing rolling volume ratio includes
  its current bar, while a new prior-only reference would be a different feature.
- A close-confirmed signal executes subsequently. It cannot claim that candle's
  earlier low, ideal wick, or a newly created TP filled earlier in the same bar.
  Retain both existing execution sensitivities and correct partial-close clocks.

## 9. How to test later without losing control of the search

Before running anything, use the study card in the
[tested-setup register](../../research/TESTED-SETUPS.md). Choose **one question**,
its existing-rule overlaps, exact feature definitions, action, release/expiry,
missing-data handling and a small frozen set of variants. This reference does
not authorize a cartesian product of every indicator, timeframe and threshold.

Separate three claims:

1. **Description:** the feature distinguishes different observed market states.
2. **Prediction:** those states have different subsequent adverse/favourable
   outcomes on chronologically separated observations.
3. **Portfolio value:** acting on the feature improves the full ladder after
   fees, timing, exposure/state changes and missed recovery cycles.

For an indicator-plus-pulse claim, compare unchanged baseline, the selected
indicator rule alone, the pulse rule alone, and their defined combination.
Where S/R is part of the rule, include the corresponding S/R-only control or
otherwise isolate its contribution. A smaller trade sample is not itself an edge.

Report exact UTC windows and baseline alongside every variant: profitable and
losing cycles, gross wins, gross losses, net realised/marked-open PnL, drawdown,
worst losses, TP/flatten counts and month-by-month deltas. Show skipped winners
as well as avoided losers. Keep HL-overlap results separate from longer
candle-only controls; no-flow months do not validate a flow filter.

Use chronological, non-overlapping validation with outcome-window separation;
record all trials and treat the heavily mined past as development data. New
forward observations are the genuine untouched check. No causal feature,
interesting anecdote or higher win rate alone warrants a live change.

**Current disposition: educational collection, separate closed-bar timing foundation,
and the first [independent validation / standalone batch](indicator-standalone-study.md)
are complete. No qualifying standalone upgrade was found among those16definitions;
ladder and combined studies remain next. This guide itself is educational, not
a profitability claim or configuration recommendation.**
