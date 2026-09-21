# I06: MACD standalone study

Research only. No live/config/state/order changes, ladder changes, new indicator
combinations or HL/S/R inputs. Read the [coverage register](../../research/INDICATOR-FINDINGS.md)
before choosing another family or repeating a grid.

## Frozen formula and scope

The conventional MACD line is fast EMA minus slow EMA, signal is an EMA of
that line, histogram is line minus signal. 12/26/9 is the standard reference;
our 6/13/5 and 24/52/18 choices are declared faster/slower sensitivity presets,
not asserted universal standards. Sources: [Fidelity indicator guide](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/macd),
[TradingView MACD documentation](https://www.tradingview.com/support/solutions/43000502344-moving-average-convergence-divergence-macd-indicator/).

Our precise calculation contract is independently specified:

- Fast/slow EMA each use an arithmetic-mean seed of their own first N closes;
  thereafter `previous + 2/(N+1)*(close-previous)`.
- Signal EMA is seeded with the first S valid MACD lines, not zero-padded
  lines from slow-EMA warmup. First histogram at zero-based index slow+S-2.
- Warmup is null, genuine zero is valid. Flat price yields zero MACD/signal/
  histogram. No truthiness fallback or rounding. Raw values have price units,
  not percent, RSI levels, volume or independent order-flow information.
- Fixed June 1, 2025 seed; never silently reseed or bridge a missing candle.
  Closed-bar MACD is a new research contract, not certification of the legacy
  live feature bundle's history or forming-bar timing.

[Frozen card](../../research-inputs/indicators/macd-standalone-2026-09-06.json):
5m/15m/30m/1h/4h, three presets, five entry meanings, two sides, two exits
= **300 new definitions**, no repeated MACD definitions. Eight repeated clock
cases are controls, not new hypotheses. Total: 1,208 window/delay/control cases.

| Entry | Long | Short |
|---|---|---|
| signal_cross | Histogram previous<=0/current>0 | Previous>=0/current<0 |
| signal_trend | Same cross with current MACD line>0 | Same cross with line<0 |
| signal_counter | Same cross with current MACD line<0 | Same cross with line>0 |
| zero_cross | MACD line previous<=0/current>0 | Previous>=0/current<0 |
| hist_turn | Histogram slope turns positive while histogram<0 | Slope turns negative while histogram>0 |

Histogram turns use three already-completed observations: previous slope is
nonpositive/nonnegative and latest slope strictly changes direction. No
centered pivot or future confirmation. Exactly-zero MACD line is excluded from
both conditioned signal variants. Signal-line crosses and histogram-zero
crosses are the **same event**, not two independent confirmations. Intrinsic
MACD sign conditions do not add a second indicator.

Exits are 12h from actual fill, or a subsequent closed condition capped at12h:

| Entry family | Long indicator exit | Short indicator exit |
|---|---|---|
| Signal / trend / counter | Histogram<=0 | Histogram>=0 |
| Zero line | MACD line<=0 | MACD line>=0 |
| Histogram turn | Histogram>=0 | Histogram<=0 |

Histogram-turn exit is normalization; the others are reversal. None is a
price stop, break-even guarantee or assurance of recovering a price drawdown.
Timeout wins ties. Never exit from the entry-time observation; pending exits
are immutable. Fixed12h companion paths are rerun, not frozen trades repriced.

Not tested: other presets, daily, magnitude/percentage/PPO/ATR normalization,
price divergence, multi-timeframe confirmation, persistence, stops/targets/
trailing/partials, other indicators, HL/S/R, ladder or joint-account applications.
No new definitions are added after outcomes. Related/correlated trials are
counted, not portrayed as independent discoveries.

## Comparison and causal timing

- Full: **2025-07-01 00:00 → 2026-09-04 19:01 UTC**.
- Recent: **2026-05-17 20:43 → same cutoff**, overlapping, not a holdout.
- Same I01 repaired minute archive and 11-minute overlay; raw data unchanged.
- Contiguous finalized UTC bars only. Decision at selected bar end; subsequent
  minute-open execution with modeled zero publication lag, plus separate +1m
  to every entry and exit. Execution-minute H/L/C cannot select a trade.
- $10k fixed entry, $32k initial equity, one independent position per rule.
  No averaging/compounding; occupied/pending crossings skipped, never queued.
- 0.055% trading fee each side on actual executed notional. **Before funding**:
  complete settlement archive unavailable. Extra5bps/side same-path stress.
- Baseline: same-side rolling12h clock, near-continuous and not exposure-
  matched. It is **not the ladder**. Cash/buy-hold are contextual controls.
- Cutoff open inventory marked with hypothetical close fee, not a completed
  trade. Monthly marked net and exit-month win/loss accounting stay separate.
- No actual collector arrival history, margin/liquidation, shared collateral,
  queue/liquidity/slippage-path or live-execution guarantee.

Strict inherited screen: >=30 full/10 recent closes in both delays, positive
net and own-side clock delta in allfour, no monthly marked delta<-1e-8,
positive extra-cost net, no equity exhaustion. The descriptive subset requires
sample/net/cost/solvency in allfour, sorted by full immediate absolute net;
retain its top5, or actual smaller count if fewer, or rawtop5 if empty. Never
silently relax the strict screen to promote a selected result.

Report all300 definitions; baseline W/L counts/dollars; both periods/timings,
cost stress, monthly top5 and rawtop5, own-exit baselines, worst adverse paths
and winner concentration. Already-mined history is development evidence.

## Run and independently verify

Local research only, not on the trading VPS:

```bash
npx ts-node scripts/macd-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-macd-standalone-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/macd-standalone-results-check.ts backtests/hype/hype-macd-standalone-2026-09-06
npx ts-node scripts/macd-standalone-path-check.ts backtests/hype/hype-macd-standalone-2026-09-06
```

Runner refuses an existing directory; `--out backtests/NEW_DIRECTORY` is
supported. Do not overwrite prior artifacts or accept silently changed input
hashes. A fresh candle sync is not the same experiment.

Before new outcomes, all eight clock cases must match old I01 engine and saved
verified complete ledgers/months/stats. Test fixtures additionally reproduce
forced-cross minute accounting versus the old engine. Original research
engines and source archive remain byte-for-byte intact.

Formula fixtures check weighted-sum EMA, installed library on varying-price
fixtures, constant/linear/scale invariants, seeds, null/zero, gaps and prefixes.
Runtime paths get all300 boundary tests, delay/timeout/occupancy/pending and
future-exclusion checks. Actual-data checks cover45 feature prefixes and300
strategy prefixes. Independent verifier imports only the canonical input/
repair loader, directly aggregates minute closes and reconstructs its own
EMA arrays, every flat/occupied signal, earliest exit, fees, monthly accounts,
minute equity/drawdown and ranking screens.

Accepted evidence requires both `validation.json` and `verification.json`.
Read-only path supplement rechecks all source/input/artifact hashes, considers
only already selected completed holdings, and excludes exit-minute extremes.
Bulk artifacts stay local; source/card/findings can enter Git after review.
No automatic commit, push, deployment or change to the paused short owner.

## Accepted I06 evidence

[Findings, all300 definitions and baseline comparisons](../../research/codex-astra-macd-standalone-findings-2026-09-06.md):
1,208 cases,606,491 trade records,12,080 monthly records independently verified;
eight old/new/saved clock overlaps exact. Seventeen descriptive sample/net/
delay/extra-cost survivors (10 long,7 short), zero complete strict qualifiers.
Counts overlap across rules/windows; this is not a count of unique opportunities.
The report includes both selected topfive and raw-ranked topfive monthly tables,
and an additional read-only extension of the pinned path calculation to the
already-ranked rawtopfive. No new strategy definitions or outcome-dependent grid.
