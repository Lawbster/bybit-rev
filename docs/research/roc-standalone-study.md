# I05: ROC standalone study

Research-only individual ROC expansion. No live/config/state/order changes,
MACD, new ladder policies or indicator/HL/SR combinations. Read the
[indicator coverage register](../../research/INDICATOR-FINDINGS.md) before
selecting the next family.

## Frozen questions and grid

[Card](../../research-inputs/indicators/roc-standalone-2026-09-06.json) is fixed
before results. Simple ROC is unrounded percentage return:
`100 * (closed price / price N closed bars ago - 1)`.
N+1 contiguous closed prices are needed. Zero is valid; positive ROC is
unbounded and negative ROC is greater than -100 for positive prices.

| Candle timeframe | ROC1 elapsed lag | ROC5 elapsed lag | ROC12 elapsed lag |
|---|---:|---:|---:|
| 5m | 5m | 25m | 1h |
| 15m | 15m | 75m | 3h |
| 30m | 30m | 2.5h | 6h |
| 1h | 1h | 5h | 12h |
| 4h | 4h | 20h | 48h |

Each of 15 timeframe/lookback pairs tests these exact independent entries:

- **Momentum**, M=0/1/2/4%: long previous <=+M and current >+M; short previous
  >=-M and current <-M. Zero repeats the original ROC5/1h rule.
- **Into**, M=1/2/4%: contrarian long previous >-M and current <=-M; short
  previous <+M and current >=+M.
- **Back-out**, M=1/2/4%: recovery long previous <=-M and current >-M; short
  previous >=+M and current <+M.

Each entry has fixed12h and indicator-or-12h exits: **600 definitions**,596 new
and4 repeated I01. 2 windows x2 delays =2,400 strategy cases plus8 clock cases.
Counts include correlated trials, not independent discoveries. No ROC length,
threshold or clock is added after seeing outcomes. No 0.5%/8% levels, other
lags, daily, acceleration, persistence, divergence, log/ATR-normalized ROC,
TP/SL/trailing/partials, or feature combinations were tested by this card.

A crossing can occur solely because the denominator rolls to another old
close. It must not automatically be described as current buying/selling.
Math fixtures explicitly cover a flat numerator and changing denominator.

## Dates and causal timing

- Full: **2025-07-01 00:00 →2026-09-04 19:01 UTC**.
- Recent: **2026-05-17 20:43 →same end**, contained within full.
- Fixed seed: June1,2025 00:00 UTC; same I01 fingerprinted minute archive and
  explicit11-minute repair overlay. Raw historical files are unchanged.
- Full contiguous completed selected-timeframe candles only, including the
  entire N-bar denominator history and previous observation used for crossing.
- Zero modeled publication lag: signal is known at bar end, entry at subsequent
  minute open. Separate +1m model delays **every** entry/exit.
- No execution-minute high/low/close can influence entry. Repaired final candles
  do not reconstruct actual historical collector receipt latency.
- One independent $10k entry, $32k starting equity; no averaging/compounding.
  Occupied/pending signals skipped, no queued old crossing after exit.
- 12h timeout is from actual entry, not the source candle start or N bars.
  A pending exit cannot be revised; timeout wins a tie.

Indicator exit depends on the **entry interpretation**, not just side:

| Interpretation | Long exit at subsequent closed observation | Short exit |
|---|---|---|
| Momentum | ROC <=0 (momentum lost) | ROC >=0 |
| Into / back-out | ROC >=0 (normalization) | ROC <=0 |

The entry-time observation can never cause its own instantaneous exit.
If recovery jumps straight across zero, wait until the first subsequent
completed observation satisfying the exit, or the12h timeout. Completed
close then new-entry ordering is preserved. Mark open cutoff inventory with
hypothetical exit fee; do not create an artificial completed trade.

## Costs and comparison discipline

All profits are after **0.055% each side** on actual executed notional,
**before funding** because a complete settlement archive is absent. Extra
5bps/side is a same-path turnover stress, not a changed fill/slippage replay.
No margin/liquidation, queue, shared collateral or live readiness claim.

Baseline is the I01 rolling12h long/short clock, not exposure-matched and
**not the ladder**. Each indicator exit also retains its exact entry/fixed12h
companion, with the entire changed occupancy path rerun. Cash and
fixed-initial-quantity buy/hold are contextual, not optimized controls.

Strict inherited screen: >=30 full /10 recent closes in both delays; positive
net and positive own-side clock delta in all four; no monthly marked regression
beyond1e-8; positive extra-cost net; no equity exhaustion.

All600 raw ranks use full immediate delta to own-side clock. Also show
side-specific absolute-net ranks. The predeclared **descriptive subset** keeps
adequately sampled, solvent, net/cost-positive definitions across all four
cases, ranked by full immediate absolute net. Report its top5, or raw top5 if
empty; preserve every strict failure. This is not a relaxed deployment screen.

Reports must show exact dates, baseline W/L dollars, open net, drawdown, both
delays/costs, monthly top-five comparisons, sparse cells, worst path and winner
concentration. Previously mined windows and correlated rules are development
evidence, not fresh holdout proof. Standalone profit cannot be added to ladder
returns without a separate account/execution replay.

## Run, verify and preserve

Run locally only, on the pinned snapshot. The larger ROC ledger is appended
per case and read line-by-line to avoid one giant JSON string. The optional
8GiB Node heap allowance below is for local research, never a VPS recommendation.

```bash
npx ts-node scripts/roc-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-roc-standalone-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/roc-standalone-results-check.ts backtests/hype/hype-roc-standalone-2026-09-06
npx ts-node scripts/roc-standalone-path-check.ts backtests/hype/hype-roc-standalone-2026-09-06
```

Runner refuses an existing output directory. `--out backtests/NEW_DIRECTORY`
is supported; a fresh data sync is not the same experiment. Do not overwrite
previous results or weaken a changed-input assertion.

Before new outcomes,24 cases compare old/new complete ledger, stats, open
inventory and months against the old engine and saved verified I01 evidence.
New `roc`/`rocLookbackBars` entry provenance is explicitly checked against
legacy `roc5` for the overlap, then only those two added fields are projected
out for legacy ledger identity. Original engine/data files remain unchanged.

Each of the 15 timeframe/lookback pairs has three actual-data feature-prefix checks.
All600 definitions get an actual-data strategy-prefix comparison. Independent
verification imports only the minute normalization/repair loader: independently
aggregates closes, indexes denominator prices, enumerates crossings/occupied
skips, derives first allowed exits/pending state and rebuilds minute drawdown,
fees, turnover, monthly closed/marked accounts and ranking screens.

The read-only path supplement checks every source/input/artifact pin and scans
only completed immediate-model trades of the selected5 plus both clocks.
It excludes exit-minute extremes; main net/DD verification includes cutoff
open inventory. No new strategy runs or output writes occur in this supplement.

Accepted artifact folder must contain both `validation.json` and independent
`verification.json`. The verifier refuses to replace an existing verification.
Evidence includes source/input fingerprints, old overlap checks, full results,
CSV/JSON months, trade JSONL, causal denominator traces, rankings and shortlist.
Bulk inputs/artifacts stay local; source/card/findings belong in Git after review.

## Accepted September 6 result

[Findings and all600 ranked definitions](../../research/codex-astra-roc-standalone-findings-2026-09-06.md):
32 long/1 short descriptive sample/net/cost survivors;0 strict qualifiers.
2,408 cases,970,004 trade records and24,080 monthly rows independently
verified;24 prior overlaps exact,45 feature and600 strategy prefixes passed.
Records overlap; they are not independent event counts. Monthly regressions,
51–53% leading-dip adverse price moves and the short's timing/concentration
risk remain explicit. No live/combination changes or commit/push.

The [coverage register](../../research/INDICATOR-FINDINGS.md) now records864
distinct standalone definitions through I05 (596 new here,4 repeated), separate
from45 ladder definitions. Next individual family is MACD, not a further ROC
parameter extension or a combination search.
