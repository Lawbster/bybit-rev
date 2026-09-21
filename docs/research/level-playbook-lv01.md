# LV01: calendar levels, VWAP and POC playbook

Frozen September 17, 2026, before this batch's results. Local research only.
Card: `research-inputs/level-playbook-lv01-2026-09-17.json`.

## Research basis, not claims of edge

- CME describes prior highs/lows as potential support/resistance and the role reversal
  after a break. This motivates rejection and **break-then-retest**, not assuming every
  touch must bounce. Levels are zones, not guaranteed prices.
  [CME](https://www.cmegroup.com/education/courses/technical-analysis/support-and-resistance)
- StockCharts explains intraday typical-price VWAP, its lag, and price location relative
  to VWAP. This supports testing VWAP holds/reclaims and stretched-price returns as
  distinct hypotheses; neither is evidence of positive HYPE expectancy.
  [VWAP](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-overlays/volume-weighted-average-price-vwap)
- TradingView defines POC as the highest-volume price row and profiles as historical
  activity. A POC is not necessarily support, and its name does not imply a future
  magnet. We test direction-specific rejection, retaining failures.
  [Volume profile](https://www.tradingview.com/support/solutions/43000502040-volume-profile-indicators-basic-concepts/)
- Schwab describes range and breakout trades, with invalidation around broken levels.
  It also warns reversals/false breaks can happen quickly. We use this as a rationale
  for a separate level-risk bracket, not as a profitability guarantee.
  [Swing trades](https://www.schwab.com/learn/story/ins-and-outs-swing-trade)

The numerical 0.1% buffers, 15m confirmation, four-bar retest expiry, 2% stretch,
2R bracket and12h cap are **our frozen operational definitions**, not thresholds
certified by those sources. This is a common-pattern first pass, not an exhaustive
parameter search. Crypto sessions are UTC conventions, not a stock-exchange open.

## Map versus pasted indicator

Map all calculated families: prior D/W/M highs/lows, prior D/W midpoints, seven open
references, developing daily highs/lows, six VWAP variants, exact D/W/M POC/NPOC.
Exclude nine arbitrary manual numbers. Store both Pine-family1m typical-price VWAP
and actual-turnover VWAP. The monthly Pine family uses HL2; others HLC3.

This is not bit-for-bit reproduction of arbitrary TradingView timeframes. We fix1m
input for reproducibility, require full UTC anchor coverage, model60s availability,
and define2D as prior midnight through now. No `timenow`/today-only visibility gating.
POCs retain the existing audited executed-volume map rather than the pasted script's
uniform-volume approximation and gap indexing defect. Source corrections and missing
original receipt times remain explicit.

## First batch: 32 entry definitions, 64 economic definitions

| Families | Pattern | Entry definitions |
|---|---|---:|
| Prior daily/weekly/monthly ranges | Rejection; breakout then retest |6|
| Prior daily/weekly midpoint | Breakout then retest |2|
| Current/previous D/W/M and day-before-yesterday opens | Breakout then retest |7|
| Developing daily high/low | Rejection; breakout then retest |2|
| Six VWAP references | Breakout then retest |6|
| Daily/weekly/monthly VWAP | Return inside a2% stretch |3|
| Latest POC / naked POC, D/W/M | Confirmed rejection from either side |6|

Every definition has a fixed12h control and a frozen2R/stop/12h variant, at $10k
entry notional. Each can trade either direction but never overlap its own position.
No simultaneous portfolio of64 systems is implied. Freeze reference before reaction;
enter at the next available open after15m close+60s. No limit fill at a previously
touched level. Stop-first primary and target-first same-minute sensitivity. Repeated
daily triggers are limited **before** seeing outcomes; occupancy is rebuilt for
every path. Card specifies all tie, expiry, publication and bracket rules.

PB01/PB02 already tested plain POC touches and holding times; I10 already tested plain
VWAP distance/crosses. DB01 tested session-start swing-range bias. Those results stay
in the library. LV01's event confirmation/frozen reference/two-sided path is different,
not independent market evidence. Half the new cells are exit variants of the same
32 correlated entry definitions.

## Deliverables and interpretation

One saved full-minute binary map with schema and hashes; a calendar period register;
readable15m snapshots; exact POC catalog pointer; raw signals including evidence;
accepted trade logs; monthly W/L and MTM; full/older/recent tables; long/short splits;
delay/cost/exit-order sensitivities; concentration and qualification failures.

Baseline=flat cash and matched independent clocks, with accepted daily NPOC12h shown
as a familiar reference. These are **not ladder uplift dollars**. Fees remain0.055%
per actual side, before funding. DD denominator starts at$32k. No native maker or
liquidation fidelity claim. Screens retain each bad month even when full net is large.

First verify the six accepted PB02 controls. Independently check source clocks,
minute aggregation, frozen references, trade arithmetic, occupancy and monthly/DD
accounting. No live changes or optimization after looking at this batch's outcomes.

## Completed study and reuse

[Findings and artifact links](../../research/codex-astra-level-playbook-findings-2026-09-17.md).
Accepted job `e84ae39a0e87b46ec3082ef407b8463dd8769beeddad5177b01357598b2b4a43`.
Atlas `backtests/level-atlas/9b0da93e74fd42af858d38c1f859bfd8ae21e9963eda0b1a0d05135e8fe6cc8a`:
935,005 rows, 32 fields, little-endian float64, unavailable=NaN. Read schema first.
Row i describes source end `start+(i+1)*60000`; available at source end +60000.
Use `valueAt(atlas, decisionAt, field)` to enforce availability. POC lifecycle
catalog is separate from the three latest-period POC columns: reconstruct naked
status using `availableAt`, `retestKnownAt` and `uncertainKnownAt` as-of decision,
never the final naked list. `levels-15m.csv` is the readable sample, not the full map.

`cachedAtlas` and `cachedCandles` in `scripts/level-playbook-study.ts` load saved
data for local research; they are not production dependencies. Immutable identical
jobs are reused rather than regenerated. No old study is overwritten.
