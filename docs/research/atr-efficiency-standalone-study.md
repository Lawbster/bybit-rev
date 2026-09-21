# I09: ATR-normalized movement and efficiency — separate standalone branches

Research only, September6,2026. [Frozen card](../../research-inputs/indicators/atr-efficiency-standalone-2026-09-06.json).
No live/config/state changes, ladder application, indicator combinations,
commit, push, VPS action or new data download.

## Questions and boundary

Does a large closed one-bar move relative to preceding ATR favor continuation,
fading it immediately, or waiting for the normalized reading to retreat?
Separately, does clean directional close-to-close travel favor continuation
or mean reversion? These are **not ATR+ER conjunctions**, and not ATR-only
direction predictions. Direction is explicit in the observed price change.

ATR is unsigned volatility; ER is unsigned net displacement divided by total
close-to-close travel. Signed versions supply direction transparently.
[Fidelity ATR](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/atr),
[TradingView ER calculation within KAMA](https://www.tradingview.com/support/solutions/43000773012-kaufman-s-adaptive-moving-average-kama/).
ER math is tested; KAMA smoothing is not implemented or certified.

## Frozen grid: 720 new definitions, 2,888 cases

Both branches use completed 5m/15m/30m/1h/4h bars, long and short, and two
exits. Three entry interpretations are separate full-path simulations.

| Branch | Metric | Parameters / levels | Definitions |
|---|---|---|---:|
| ATR movement | (close[t]−close[t−1]) / ATR14[t−1] | ATR14 only; 0.5/1/2 prior-ATR units | 180 |
| Efficiency | (close[t]−close[t−N]) / sum of absolute N close changes | N10/20/40; 0.25/0.50/0.75 | 540 |

Let v=entry-side sign × signed metric and k=positive threshold:

- trend: previous v<=k, current v>k;
- into: previous v>=−k, current v<−k;
- recovery: previous v<=−k, current v>−k.

Only fresh crossings, not persistent levels or queued entry opportunities.
Strict boundary behavior is tested for every rule. A recovering metric is
**not necessarily a price rebound**: the prior shock may leave the numerator,
the ATR denominator may rise, or ER's rolling endpoints may change. No rule
quietly adds a bullish candle confirmation to make the result look better.

Exits are fixed12h from actual fill or the first subsequent metric zero
condition capped12h: trend signed<=0, into/recovery signed>=0. The latter is
normalization, not guaranteed profit. Timeout wins ties. No entry-observation
exit; immutable pending decisions; occupied crossings skipped; fresh crossing
required after exit. No inferred intrabar threshold fill.

5 clocks ×3 levels ×3 modes ×2 sides ×2 exits ×4 parameter sets=720.
Two overlapping windows ×two action delays=2,880 strategy cases, plus eight
repeated long/short clock controls=2,888. No prior ATR/ER entry repeats; existing
ATR14 math is revalidation, not a new indicator family.

## Formula and timing

`atr14-prior-scale-er-signed-v1`:

- TR starts bar1 against previous close, max(range,abs(high−prevClose),
  abs(low−prevClose)). ATR seeds the first14 changes' arithmetic mean and
  recurses (previous×13+TR)/14. Same shared ATR14 values exactly.
- Signed ATR move uses the PRECEDING ATR; the current shock cannot normalize
  itself. First valid index15. Zero or unavailable preceding ATR => null,
  not a huge artificial signal and not zero.
- ER uses N close changes, requiring N+1 closes; first valid indexN.
  Signed numerator is close[t]−close[t−N]; denominator sums absolute changes
  j=t−N+1..t. Ordinary ER is abs(signed ER). Flat zero travel gives0; real
  zero is distinct from null warmup. No rounding, clamping or gap bridge.
- UTC epoch-ms source starts and exact bar-end availability; fixed June1 seed,
  no moving reseed. Only completed, contiguous selected-timeframe bars.
  Next minute-open under modeled zero publication lag; separate+1m delay to
  BOTH entry and exit. No claim of actual historical collector receipt time.

Independent checks cover external-library ATR on five clocks, shared-array
parity, direct ER gain/loss travel on15 clock/period sets, hand fixtures,
flat/monotone/chop, scale/translation/mirror invariants, zero denominators,
720 boundaries, immutable pending/fees/exits, old accounting and future prefixes.

## Dates, costs, baseline and screen

Full **2025-07-01 00:00 →2026-09-04 19:01 UTC**.
Recent **2026-05-17 20:43 →same cutoff**, inside full, previously mined.
Same I01 fingerprinted minute snapshot and explicit11-minute repair.
$10,000 fixed entry, $32,000 initial equity, one independent position/rule.
0.055% fee each side actual notional; **before funding**, because the complete
settlement archive is missing. Extra5bps/side stress on unchanged turnover,
including hypothetical closing mark. No compounding/averaging/risk-sizing.

Baseline is the exact saved same-side rolling12h clock, not the ladder and
not exposure-matched. Optional exits retain own fixed12h companions. Cash
and fixed-initial-quantity buy/hold are contextual, not matched portfolios.
End inventory is marked with hypothetical exit fee, not a completed trade.

Same strict screen: >=30full/10recent closes both delays; positive absolute
net and own-clock delta allfour cases; every monthly marked delta>=−1e−8;
positive extra-cost net and no modeled equity exhaustion. Descriptive
sample/net/cost/solvency subset retains failed clock/monthly comparisons.
Rank overall and separately per branch by full immediate net; retain raw
full-clock-delta topfive too. Not a relaxed deployment screen.

Report W/L counts AND winning/losing dollars with baselines, open/net/DD,
full/recent separately, monthly topfive overall/per-branch/raw, action delays,
costs, all720 definitions, paths and winner concentration. Counts and windows
overlap. Sparse rules are inconclusive, not rejection of the whole indicator.
Post-exhaustion fixed-notional output is diagnostic, not executable equity.

## Verification and reproduction

Eight old/new/saved I01 clock ledger/stat/month/open cases must match BEFORE
strategy outcomes. Actual60 feature-prefix checks and720 strategy-prefix
checks. Independent checker separately aggregates OHLC, builds array ATR
and direct-window ER, enumerates all eligible/occupied entries and first
exits, then prices, fees, cutoff, full minute DD, monthly marks and ranks.
It imports only canonical candle normalization/repair, not the new math or
strategy engine. Source/input/artifact hashes remain unchanged.

Require BOTH completed `validation.json` and `verification.json` before
treating results as accepted evidence. No previous artifacts are overwritten.
The pinned read-only path helper covers topfive overall, per branch and raw;
it adds no strategy, exits or historical PnL simulation.

Run locally:

```bash
npx ts-node scripts/atr-efficiency-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-atr-efficiency-standalone-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/atr-efficiency-standalone-results-check.ts backtests/hype/hype-atr-efficiency-standalone-2026-09-06
npx ts-node scripts/atr-efficiency-standalone-path-check.ts backtests/hype/hype-atr-efficiency-standalone-2026-09-06
```

Runner accepts optional `--out backtests/NEW_DIRECTORY` and refuses overwrite.
Normal TypeScript builds exclude scripts; typecheck runner/checker/path with
ts-node as well. Generated ledgers remain local/ignored; source/card/docs
allowlisted for later review, not automatically committed.

## Explicitly untested

ATR smoothing lengths other than14, multi-bar normalized displacement,
ATR stops/targets/trailing, position sizing, fixed-entry volatility filters,
ER other periods/levels, unsigned-only/persistent efficiency conditioning,
KAMA, other-indicator/ATR/ER/HL/S/R mixtures, ladder interventions, live funding,
publication/queue/slippage, shared collateral and liquidation. A positive
standalone rule is not an incremental ladder result or live short approval.

## Accepted result — September 6, 2026

[Findings, all720 definitions, W/L and monthly baseline tables](../../research/codex-astra-atr-efficiency-standalone-findings-2026-09-06.md).
Accepted directory: `backtests/hype/hype-atr-efficiency-standalone-2026-09-06/`.

- 2,888 cases complete; independent audit passed2026-09-06T14:50:42.219Z.
  It checked1,128,453 overlapping trade records and28,880 monthly records.
- Eight saved clock cases reproduce exactly;60 actual feature prefixes and
  720 strategy prefixes pass; all input/source/artifact hashes match.
- 39 descriptive survivors:8 ATR long,31 ER long;zero strict-screen qualifiers
  and zero descriptive shorts.504 definitions adequately sampled,216 sparse.
  The31 equity-exhausted definitions are diagnostics, not executable accounts.
- Eight new test groups, inherited17 standalone/11 timing groups, both
  TypeScript configurations and runner/checker/path typechecks passed.
  Read-only path supplement covers34 rule/window cases.
- No abandoned historical I09 run, threshold revision or replacement outcome
  run. No live/config/ladder/short state edits, commit, push or deployment.
  The next individual area is VWAP/volume; no combination study started.
