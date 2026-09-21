# I04: RSI standalone coverage

Research-only extension of I01. No live strategy/config/state changes, no
ladder changes, no other indicators, HL or S/R combinations. The
[indicator register](../../research/INDICATOR-FINDINGS.md) tracks which
families still need individual work before combinations.

## Frozen grid

The [card](../../research-inputs/indicators/rsi-standalone-2026-09-06.json)
is fixed before outcomes, not a post-result selection of favorable levels.

| Axis | Values |
|---|---|
| Formula | Unrounded Wilder RSI14; same independently tested formula as I01 |
| Completed timeframe | 5m, 15m, 30m, 1h, 4h |
| Lower / upper extremes | 40/60, 30/70, 20/80, 10/90, 5/95 |
| Extreme entry | Into the extreme, or recovery back out |
| Side | Long from lower extreme; short from upper extreme |
| Exit | Fixed 12h from fill, or subsequent RSI50 normalization capped at 12h |
| Separate trend interpretation | Long crosses above50 / short below50, fixed12h only, each timeframe |

Extreme grid: 5 x 5 x 2 x 2 x 2 =200 definitions. Center-cross panel adds10.
**210 definitions =206 new +four I01 repetitions.** Two windows and two
action delays give840 strategy cases; two side clocks give eight additional
controls, **848 cases total**. Validation repetitions are not new hypotheses.

This is extensive *within this card*, not exhaustive RSI testing. Periods
other than14, daily candles, intermediate levels, divergence, persistence,
RSI velocity, higher-extreme momentum following, TP/SL/trailing/partial exits
and combinations remain untested. Do not infer failure of these from I04.

## Data, decisions and fills

- Full: July1,2025 00:00 to September4,2026 19:01 UTC.
- Recent: May17,2026 20:43 to the same end; overlapping, previously mined.
- Fixed seed June1,2025 00:00; explicit repair overlay, original raw files intact.
- $10k fixed entry notional, $32k initial equity, one position per rule.
- 0.055% fees each side on actual notional; no complete funding ledger.
- Extra5bps/side turnover stress, including marked closing turnover; fixed-path,
  not a liquidity rerun. No margin/liquidation or live execution certification.

Wilder14 uses the first14 close differences for mean gain/loss and thereafter
1/14 recursion. Fifteen closes are required; flat=50, gains-only=100 and
losses-only=0. Zero is valid, not missing. Preserve the seed, formula and
unrounded values when interpreting a historical threshold.

Long into: previous RSI>L and current<=L. Long recovery: previous<=L and
current>L. Shorts mirror these around U. Center-cross is a separate trend
rule, not an overbought fade: long previous<=50/current>50, short the reverse.
Only consecutive completed same-timeframe observations may cross.

Signal becomes available at bar end under the historical zero-publication-lag
assumption; fill uses the subsequent minute open or +1m action delay. The
execution minute's high/low/close cannot influence its entry. Actual historical
collector receipt times are unavailable; final-bar causality is not proof of
zero real-world latency. Five-minute and four-hour bars share the same minute
execution clock and12h elapsed hold; the hold is not12 bars.

The optional neutral exit needs a subsequent closed RSI>=50 long / <=50 short,
strictly after actual entry. Timeout takes precedence when tied. Pending exits
cannot be replaced; an early exit does not rearm an old occupied crossing.
Require a fresh crossing while flat. Recompute the whole entry/exit path for
each exit policy and execution delay. Mark end inventory, with estimated
closing fee, without inventing a completed trade.

## Baselines, ranking and future combination use

Primary controls are unchanged I01 long/short rolling12h clocks, one each per
window/delay; these are not exposure-matched. Compare every neutral exit also
with its own exact fixed12h entry companion. Cash and fixed-initial-quantity
buy/hold are contextual controls, not incremental ladder profit.

Strict inherited screen: at least30 full/10 recent completed trades in each
delay, positive net and side-clock delta in allfour cases, no monthly marked
regression, positive extra-cost stress and no equity exhaustion. Every failure
remains reported. A weak short clock can make a losing short rank highly.
Baseline improvement is not necessarily profitability.

All210 are ranked by full zero-delay delta to their side clock. A separately
predeclared **descriptive subset** requires sample/positive net/positive stress
in allfour cases, ranked by full zero-delay *absolute net*. It retains all
clock/monthly failures and does not replace the strict screen. Report its best
five if nonempty; otherwise report the raw topfive with limitations explicit.

Carry exact cases and behavioral distinctions into the shared register:
profitable, fragile, sparse, failed or still untested. A poor standalone trader
may later be a useful conditioning feature, but I04 does not prove that use.
No additional features or threshold search is justified merely by a profitable
cell in210 correlated, previously mined definitions. Finish the individual
program before selecting a small, justified combination with both components
alone retained as controls.

## Run and verify

```bash
npx ts-node scripts/rsi-standalone-tests.ts
npx ts-node scripts/hype-rsi-standalone-study.ts
npx ts-node scripts/rsi-standalone-results-check.ts backtests/hype/hype-rsi-standalone-2026-09-06
npx ts-node scripts/rsi-standalone-path-check.ts backtests/hype/hype-rsi-standalone-2026-09-06
```

The runner refuses an existing output directory; `--out backtests/NEW_NAME`
is supported. Pinned I01 source/input/artifact hashes must match. An updated
data sync is not an identical rerun; retain immutable private research inputs.
Never weaken parity assertions to fit changed history.

Before variants,24 overlap cases (four hourly RSI70/recovery rules and two
clocks, two windows/two delays) must match old engine and saved I01 complete
ledgers/months/stats. Old pinned engines remain untouched. Each timeframe has
three actual-data feature-prefix checks, each strategy a prefix check.

The independent verifier calculates its own scalar RSI from minute closes,
enumerates every eligible crossing and first neutral/timeout exit, and checks
actual open fills, counts, dollar PnL, fees, inventory, minute adverse/close DD,
monthly marked/closed results, side-clock/own-exit deltas, overlap parity,
ranking screens, descriptive subset and first-trade traces. It does not call
the strategy engine. All JSON/JSONL/CSV artifacts are fingerprinted. Only
`verification.json` is written, and existing verification is never overwritten.

Saved evidence: manifest, results/summary, monthly JSON/CSV, full trade ledger,
context controls, overlap parity, causal traces, full ranking, descriptive
shortlist and validation/verification. Generated files stay local, not in Git.

The final read-only path supplement validates pinned inputs/sources and all
verified artifact hashes, then scans completed trades for the selected five,
the separate4h RSI50 long observation and both clocks. It reports worst gross
adverse excursion, worst completed loss and top-five-winner concentration in
the immediate cases. Exit-minute high/low are excluded; open cutoff inventory
is excluded from this supplement but included in the main net/DD verifier.
The supplement writes nothing and adds no signal/strategy definitions; it was
added for report reproduction after the frozen strategy run, not inserted
retroactively into that run's source manifest.

Accepted [findings and all210 definitions](../../research/codex-astra-rsi-standalone-findings-2026-09-06.md):
14 adequately sampled long definitions remain net/cost-positive in allfour
cases,0 strict qualifiers. Worst paths, month failures, sparse shorts and
untested RSI lengths remain explicit. The full840 strategy cases plus8
controls are independently verified; no live/config/state changes.
