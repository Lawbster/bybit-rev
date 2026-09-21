# Indicator stages 1-2: verified math, simple HYPE longs and shorts

## TL;DR

- **Math foundation passed:** seven indicator families / ten numeric fields,
  12 independent formula-test groups, 17 independent execution-test groups.
  Actual-data causal-prefix checks passed; a separate ledger verifier checked
  all **72 cases, 26,347 artifact trade rows and 720 monthly rows**. These are
  overlapping/model-repeat records, not 26,347 independent market trades.
- **0/16 standalone strategy definitions passed the predeclared screen.** All
  eight short definitions lost money in both windows and both execution models.
  RSI-recovery longs were modestly positive; VWAP-cross longs improved recently
  but lost over the full window. This rejects the tested rules as robust
  standalone candidates, not the indicators' possible usefulness inside a ladder.
- **No live changes.** Do not add these traders or resume short entries from
  this study. The next stage is a bounded test of selected indicator context at
  genuine ladder decisions, not an automatic indicator/HL/S/R combination sweep.

## 1. Exact scope, dates and baselines

Full window: **2025-07-01 00:00 to 2026-09-04 19:01 UTC**.
Recent window: **2026-05-17 20:43 to 2026-09-04 19:01 UTC**.
The recent window is contained in the full window. Do not add them together or
call the latter untouched out-of-sample validation; this history was already mined.

Each case starts flat with **$32,000 equity and $10,000 fixed entry notional**,
one position at a time, no averaging down or compounding. Signals use completed
**1h** bars. Primary exits are after **12 hours from actual entry**; secondary
exits use the indicator or that same timeout. No TP/SL/threshold/timeframe sweep.
Trading fee is **0.055% each side**. No maker fee assumption.

**All reported PnL is after trading fees but before funding.** The settled
funding archive ends April 19, 2026; later rate observations are not a complete
settlement ledger. Actual arrival times, spread/liquidity, liquidation and live
order behaviour are not certified. Extra 5bps/side is a labeled fixed-path
stress, not a new full slippage/liquidation simulation.

The baseline here is a **same-direction, no-signal rolling 12h trader** at the
same notional/costs, not the existing Martingale stack. It enters first at a
00:00/12:00 boundary, then reopens after each close. The delay model applies to
both entry and exit. This is not a matched-trade-count or matched-exposure
benchmark for sparse signals. Cash/no trade is $0; long buy-and-hold is separately
reported as context, also not matched-risk/exposure.

The four canonical ladder baselines were **not rerun**: no ladder logic changed
and none of these numbers is a ladder improvement percentage. Reproducing those
baselines remains a prerequisite for a later ladder intervention study.

[Frozen definitions](../research-inputs/indicators/standalone-2026-09-05.json) /
[implementation and reproduction](../docs/research/indicator-standalone-study.md) /
[existing-study inventory](TESTED-SETUPS.md).

### What was validated and traded

| Family | Definition validated | Trading use in this batch |
|---|---|---|
| RSI | Wilder RSI14; unrounded; flat series = 50 | Long recross up through 30; short recross down through 70 |
| CRSI | Mean RSI3(price), RSI2(streak), strict-less rank versus **prior 100** returns | Long recross 20; short recross 80 |
| ROC | Five-bar percentage return | Long cross above 0; short cross below 0 |
| ATR | Wilder ATR14 and ATR/current close | Descriptive volatility strata only; no order filter |
| ADX/DI | Wilder14 strength and +DI/-DI | Descriptive ADX strata only; no order filter |
| VWAP | Actual quote turnover/base volume from UTC midnight | Price crossing same-day VWAP; no artificial midnight entry cross |
| Relative volume | Current volume / mean **prior 20** volumes | Descriptive strata only; no order filter |

New CRSI and RVOL definitions intentionally differ from the legacy live ones.
They are versioned research definitions, not silent live fixes. New RSI handles
flat series as 50; flat CRSI is 33 1/3 because the strict-less return rank is zero.
All calculations reject invalid/gapped inputs, preserve a fixed seed and return
per-feature nulls until warmed up. Indicator seed: **2025-06-01 00:00 UTC**.
Actual study input after that seed: **663,541 repaired minutes / 11,059 complete
hours**, with no internal gaps and no imputed-turnover VWAP inputs.

Four directional families x two sides x two exits = **16 definitions**. Two
clock controls x two windows x two delays add 8 cases; strategies add 64 cases.
No policy used ATR/ADX/RVOL to alter trading in this pass. Their conditional
response tables are descriptions, not extra secretly optimized strategies.

## 2. Simple trades: wins and losses beside baseline

Immediate-next-open model, fixed 12h exit, $10,000 notional. W/L counts completed
trades; winning and losing dollars **already include trading fees**. Open mark
includes both entry fee and estimated closing fee; total net equals closed
winning+losing dollars plus open mark. Numbers rounded to dollars.
DD is prior close-equity peak to a minute's adverse price, on the $32,000 account;
it does not reconstruct unknown within-minute tick ordering.

### Full window: July 1, 2025 to September 4, 2026 19:01 UTC

| Setup | Trades | W/L | Winning $ | Losing $ | Open mark $ | Net $ | DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Clock LONG baseline** | 861 | 420/441 | 110,950 | -107,401 | -245 | **3,305** | 33.09% |
| RSI recovery LONG | 81 | 38/43 | 11,810 | -9,666 | 0 | 2,144 | 8.24% |
| CRSI recovery LONG | 448 | 218/230 | 56,442 | -55,913 | 49 | 578 | 23.01% |
| ROC cross LONG | 562 | 265/297 | 66,872 | -69,661 | -212 | -3,002 | 33.16% |
| VWAP cross LONG | 497 | 235/262 | 61,529 | -62,837 | 0 | -1,308 | 32.56% |
| **Clock SHORT baseline** | 861 | 414/447 | 98,162 | -120,668 | 223 | **-22,283** | 71.27% |
| RSI recovery SHORT | 91 | 41/50 | 8,890 | -15,206 | 0 | -6,317 | 21.27% |
| CRSI recovery SHORT | 462 | 225/237 | 57,952 | -66,798 | 29 | -8,816 | 32.55% |
| ROC cross SHORT | 567 | 276/291 | 64,836 | -78,353 | 0 | -13,517 | 45.81% |
| VWAP cross SHORT | 493 | 240/253 | 59,757 | -64,441 | 0 | -4,683 | 28.22% |

### Recent window: May 17, 2026 20:43 to September 4, 2026 19:01 UTC

| Setup | Trades | W/L | Winning $ | Losing $ | Open mark $ | Net $ | DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Clock LONG baseline** | 219 | 114/105 | 29,120 | -23,837 | -245 | **5,038** | 12.94% |
| RSI recovery LONG | 16 | 7/9 | 1,734 | -1,593 | 0 | 141 | 3.62% |
| CRSI recovery LONG | 111 | 53/58 | 13,376 | -13,497 | 49 | -71 | 15.37% |
| ROC cross LONG | 142 | 75/67 | 17,082 | -16,251 | -212 | 619 | 16.00% |
| VWAP cross LONG | 127 | 67/60 | 18,215 | -13,247 | 0 | 4,968 | 10.78% |
| **Clock SHORT baseline** | 219 | 97/122 | 21,666 | -31,775 | 223 | **-9,887** | 32.54% |
| RSI recovery SHORT | 26 | 9/17 | 2,011 | -4,123 | 0 | -2,113 | 8.92% |
| CRSI recovery SHORT | 121 | 55/66 | 13,463 | -16,532 | 29 | -3,041 | 14.77% |
| ROC cross SHORT | 142 | 72/70 | 14,332 | -16,772 | 0 | -2,440 | 11.30% |
| VWAP cross SHORT | 126 | 57/69 | 12,395 | -19,549 | 0 | -7,154 | 24.34% |

Cash/no trade: **$0** in each window. A one-time $10,000 long buy-and-hold, with
both-side trading fees and a hypothetical final close, returned **$11,511 full /
$8,383 recent**, before funding. Its rising marked notional differs from the
fixed-entry-notional rolling strategies; this is directional context, not a
claim of a superior risk-adjusted deployable bot.

RSI's lower drawdown is partly the result of being exposed for only **972 hours**
full / **192 hours** recent, versus the long clock's **10,339 / 2,635 hours**.
It is not proof that adding an RSI gate to an existing ladder reduces loss by
the same fraction. Invisible costs matter: fewer trades also miss trend gains
and potentially miss ladder recovery adds.

## 3. Does an indicator-based exit help?

Same zero-delay windows/notional as above. Here the explicit baseline is each
rule's own fixed 12h exit. RSI/CRSI exit at the first subsequent hourly observation
at/through 50 in the recovery direction; ROC exits on direction reversal; VWAP
exits on the opposite side of the current daily VWAP. Timeout remains 12h.
These exits change which later trades are possible, not just the last price.

| Setup | Full fixed12h $ | Full indicator exit $ | Delta $ | Recent fixed12h $ | Recent indicator exit $ | Delta $ |
|---|---:|---:|---:|---:|---:|---:|
| RSI LONG | 2,144 | 531 | -1,613 | 141 | -395 | -536 |
| RSI SHORT | -6,317 | -7,232 | -916 | -2,113 | -2,555 | -443 |
| CRSI LONG | 578 | -6,017 | -6,595 | -71 | -4,096 | -4,025 |
| CRSI SHORT | -8,816 | -9,224 | -407 | -3,041 | -2,816 | 225 |
| ROC LONG | -3,002 | -8,706 | -5,704 | 619 | 690 | 71 |
| ROC SHORT | -13,517 | -17,746 | -4,229 | -2,440 | -6,123 | -3,683 |
| VWAP LONG | -1,308 | -13,541 | -12,233 | 4,968 | 2,140 | -2,827 |
| VWAP SHORT | -4,683 | -15,904 | -11,221 | -7,154 | -4,816 | 2,337 |

All eight added indicator exits hurt full-window PnL under immediate execution.
Some helped recent subperiods, but none repaired cross-window robustness. This
tests these exact exits, not every possible ATR stop, partial TP or trailing exit.

## 4. Execution-delay sensitivity is material

Same fixed 12h definitions; net dollars include end marks. Baselines stay visible.

| Setup | Full immediate $ | Full +1m $ | Recent immediate $ | Recent +1m $ |
|---|---:|---:|---:|---:|
| **Clock LONG** | 3,305 | 3,792 | 5,038 | 5,104 |
| RSI LONG | 2,144 | 861 | 141 | 162 |
| CRSI LONG | 578 | 321 | -71 | 374 |
| ROC LONG | -3,002 | 2,034 | 619 | 3,813 |
| VWAP LONG | -1,308 | -3,273 | 4,968 | 4,418 |
| **Clock SHORT** | -22,283 | -22,726 | -9,887 | -9,930 |
| RSI SHORT | -6,317 | -6,435 | -2,113 | -2,574 |
| CRSI SHORT | -8,816 | -7,583 | -3,041 | -2,763 |
| ROC SHORT | -13,517 | -10,344 | -2,440 | -1,974 |
| VWAP SHORT | -4,683 | -3,002 | -7,154 | -5,507 |

Do not describe this solely as slippage: expiry starts at actual fill, and a
position that closes just after an hourly cross misses that signal. Full RSI
longs lose two eligible trades worth **$1,440.76** under the delay; common-trade
fill changes add back **$157.73**, explaining the **-$1,283.03** difference.
ROC longs have 74 immediate-only and 46 delayed-only completed entries; the large
sign reversal is substantially a changed trade cohort. No delay result is
chosen as the winner after inspection.

Extra 5bps/side fixed-path stress reduces RSI-long immediate net to **$1,333 full /
-$19 recent**, before funding. VWAP-long recent survives at **$3,694**, but its
full-window result becomes **-$6,280**. These are not robust standalone upgrades.

## 5. Month-by-month: net equity, not just flattering totals

Full-window runs, immediate execution, fixed 12h. Each cell is
**net dollars (delta versus same-direction clock)**. September 2026 is partial.
These are marked-equity changes, including open inventory; trade-count and
winning/losing-dollar monthly details for **every case** are retained in
`monthly.json` and `monthly.csv`. Closed-trade amounts belong to exit month and
can differ from marked monthly PnL; fees are not subtracted twice.

### Longs

| Month | Clock LONG $ | RSI LONG $ (delta) | CRSI LONG $ (delta) | ROC LONG $ (delta) | VWAP LONG $ (delta) |
|---|---:|---:|---:|---:|---:|
| 2025-07 | -161 | 467 (628) | 1,843 (2,004) | -366 (-204) | 813 (974) |
| 2025-08 | 510 | 240 (-270) | 1,121 (610) | 1,292 (781) | 56 (-455) |
| 2025-09 | -109 | -843 (-734) | 1,116 (1,226) | -804 (-695) | 349 (459) |
| 2025-10 | -470 | 929 (1,400) | 382 (852) | -1,265 (-794) | -1,457 (-987) |
| 2025-11 | -3,287 | -53 (3,234) | -421 (2,866) | -4,086 (-799) | -2,600 (687) |
| 2025-12 | -2,574 | 71 (2,645) | -771 (1,803) | -2,616 (-42) | -1,562 (1,012) |
| 2026-01 | 1,782 | 121 (-1,661) | -2,278 (-4,060) | 3,298 (1,515) | -664 (-2,446) |
| 2026-02 | -122 | 156 (278) | -663 (-541) | -1,143 (-1,021) | -1,152 (-1,031) |
| 2026-03 | 1,155 | -65 (-1,220) | 1,603 (448) | 1,732 (577) | -577 (-1,731) |
| 2026-04 | 307 | 218 (-89) | -354 (-661) | -210 (-517) | 258 (-49) |
| 2026-05 | 5,789 | 763 (-5,027) | 287 (-5,503) | 3,685 (-2,104) | 5,533 (-256) |
| 2026-06 | -1,256 | 827 (2,083) | -1,559 (-304) | -2,902 (-1,646) | -376 (880) |
| 2026-07 | -2,621 | -949 (1,671) | -2,795 (-174) | -2,031 (590) | -1,890 (731) |
| 2026-08 | 4,306 | 263 (-4,043) | 3,394 (-912) | 2,381 (-1,924) | 2,109 (-2,197) |
| 2026-09 | 55 | 0 (-55) | -326 (-381) | 33 (-22) | -149 (-205) |

This shows the trade-off clearly: sparse RSI avoided much of some bad months,
but missed large profitable directional months. Recent VWAP strength is not
uniform: June/July were still negative. Neither replaces the ladder on this evidence.

### Top five by full-window delta: all are still losing short setups

Ranking by delta against a poor short baseline is **not ranking profitable
strategies**. Full immediate short baseline is -$22,283. The top five deltas are
VWAP 12h **+$17,599** (net -$4,683), RSI 12h **+$15,966** (net -$6,317), RSI indicator
**+$15,050** (net -$7,232), CRSI 12h **+$13,466** (net -$8,816), CRSI indicator
**+$13,059** (net -$9,224). Complete 16-rule ranking is in `ranking.json`.

| Month | Clock SHORT $ | VWAP12h $ (delta) | RSI12h $ (delta) | RSIindicator $ (delta) | CRSI12h $ (delta) | CRSIindicator $ (delta) |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | -1,203 | -1,553 (-350) | -1,849 (-646) | -1,849 (-646) | -2,579 (-1,376) | -207 (996) |
| 2025-08 | -1,876 | -1,017 (859) | 205 (2,081) | 46 (1,922) | -1,992 (-116) | -934 (942) |
| 2025-09 | -1,211 | -2,015 (-804) | -359 (853) | -284 (927) | 373 (1,584) | -45 (1,167) |
| 2025-10 | -894 | 372 (1,265) | -1,219 (-325) | -1,506 (-613) | 3,323 (4,216) | -109 (785) |
| 2025-11 | 1,970 | 1,826 (-144) | 831 (-1,138) | 681 (-1,289) | 819 (-1,151) | 214 (-1,756) |
| 2025-12 | 1,212 | 2,273 (1,061) | -76 (-1,288) | -46 (-1,258) | 305 (-907) | -530 (-1,742) |
| 2026-01 | -3,149 | 1,581 (4,730) | -1,594 (1,555) | -2,068 (1,081) | -2,506 (642) | -1,550 (1,599) |
| 2026-02 | -1,111 | 3,314 (4,425) | 1,119 (2,229) | 1,248 (2,358) | 1,111 (2,222) | -1,174 (-63) |
| 2026-03 | -2,521 | -2,426 (95) | -1,587 (934) | -1,530 (991) | -1,048 (1,472) | -468 (2,053) |
| 2026-04 | -1,628 | 409 (2,037) | 252 (1,880) | 302 (1,930) | -926 (702) | -1,830 (-202) |
| 2026-05 | -7,161 | -3,724 (3,437) | -974 (6,186) | -1,144 (6,016) | -4,525 (2,636) | -2 (7,158) |
| 2026-06 | -64 | -1,599 (-1,536) | -1,082 (-1,019) | -1,082 (-1,019) | 1,642 (1,706) | -332 (-269) |
| 2026-07 | 1,259 | 2,118 (859) | 197 (-1,063) | -1 (-1,260) | 1,838 (579) | -551 (-1,810) |
| 2026-08 | -5,675 | -4,301 (1,375) | 109 (5,785) | 293 (5,969) | -4,366 (1,310) | -1,455 (4,220) |
| 2026-09 | -231 | 59 (290) | -291 (-59) | -291 (-59) | -286 (-54) | -251 (-20) |

## 6. What the indicators tell us, separate from tradable PnL

The response study observes every hourly crossing, including signals skipped
by an occupied serial trader. It measures next-open to 12h-open return and
minute maximum favourable/adverse excursion. Outcomes overlap and are correlated;
these means are **not additive portfolio returns or independent sample counts**.

Long direction, after modeled trading fees/before funding. The matched control
is all eligible hours with the signal's known calendar month and ROC5 sign.
This is a descriptive historical comparison, not a fitted trading predictor or
proof of statistical significance. The all-hour mean is **+0.0388% full (n=10,328) /
+0.2288% recent (n=2,627)**.

| Signal | Full signals | Full mean % | Matched control % | Recent signals | Recent mean % | Matched control % |
|---|---:|---:|---:|---:|---:|---:|
| RSI recovery LONG | 127 | +0.1560 | -0.0015 | 28 | -0.1744 | -0.2303 |
| CRSI recovery LONG | 803 | +0.0293 | +0.0765 | 195 | +0.0245 | +0.1392 |
| ROC cross LONG | 1,094 | -0.0430 | -0.0570 | 268 | +0.1702 | +0.1902 |
| VWAP cross LONG | 930 | -0.0531 | +0.0077 | 238 | +0.3125 | +0.2804 |

RSI has some descriptive recovery information relative to its contemporaneous
weak-return contexts, but the recent mean is still negative and n=28 is small.
That is not evidence that it should generate a standalone order. VWAP recent
looks positive, but much of that movement also occurs in matched baseline hours.

The predeclared ATR/ADX/RVOL strata illustrate why context may matter, but are
not deployable rules. For example, recent VWAP-long crossing outcomes split as:

| Known relative-volume bucket | Signals | Mean 12h after-fee % | Month/ROC-matched control % |
|---|---:|---:|---:|
| RVOL < 1 | 165 | +0.3783 | +0.2910 |
| 1 <= RVOL < 2 | 54 | +0.6368 | +0.2929 |
| RVOL >= 2 | 19 | -1.1807 | +0.1519 |

The high-volume cell is only 19 overlapping signals on mined history. Do not turn
it into a new veto now. It says a blanket "more volume confirms a good breakout"
story is not sufficient. `strata.csv` includes **all** declared cells, including
tiny/null-eligibility cases; there was no post-result threshold refinement.

## 7. Causality, provenance and independent verification

One real decision traced through a closed prefix: on **2025-07-01 21:00 UTC**,
the 20:00-21:00 bar finished. RSI moved **25.0531 -> 32.3717**, triggering the
predeclared recross of 30. The zero-lag model entered at the 21:00 minute open
**$37.454**, not an earlier low; the 12h timeout filled at the July 2 09:00 open,
**$38.513**. Gross price PnL **$282.7468**, fees **$11.1555**, net **$271.5913**.
The full archive and a source prefix ending at that decision give the same
indicator. Equality of close/next-open wall-clock timestamp is a zero-latency
model assumption; the +1 minute cases test later execution rather than backdating it.

The canonical price loader and verified 11-minute repair were reused. Recovered
OHLC is not presented as historical receipt evidence. Raw turnover audit mirrors
the loader's duplicate acceptance before certifying VWAP volume provenance.
No indicator values came from a start-keyed future/nearest snapshot lookup.

Verification passed:

- Twelve independently written math groups, with independent weighted-decay
  calculations and hand fixtures, plus library cross-checks where definitions agree.
- Seventeen independently written standalone execution/accounting groups.
- Three real-data feature-prefix checks and one real-data execution-prefix check.
- Independent artifact accounting: 72 cases, 26,347 trade rows, 720 monthly rows.
  Trade prices checked against repaired minute opens; month-end marked equity
  rebuilt from trades and prices, not copied from engine monthly totals.
- Source/input hashes unchanged throughout; both TypeScript configurations pass.

The independent accounting verifier does **not** independently recompute every
signal, drawdown trajectory or response stratum. Those have separate unit/prefix
checks and explicit model limitations; the verification report states its scope.

## 8. Verdict and next stage

Screen: minimum 30 full / 10 recent closed trades; positive net and improvement over
same-direction clock in both windows/delays; no negative monthly marked delta;
positive extra-cost-stress net; no exhausted account. **0/16 pass.** None would
be deployable just for passing this historical screen: funding, untouched
forward observations and live execution would still need validation.

The important result is not "indicators don't work." It is:

1. We now have reliable, versioned calculations and controlled standalone evidence.
2. Naive level/cross rules are not a robust HYPE long/short trading system here.
3. Faster indicator exits are often costly; higher trade count is not better.
4. Timing, regime and price response matter enough that isolated aggregate means
   cannot justify a ladder gate or a live order.

For stage 3, use the validated features to explain **otherwise eligible deep
adds**, then freeze a small conditional ladder test if the encounter evidence
supports it. Keep the current ladder as the baseline and count missed winning
recoveries as carefully as avoided losses. Stage 4 indicator combinations and
stage 5 HL/S/R combinations remain unrun; do not leapfrog to a broad cross-product.

## Evidence pointers

Local accepted output:
`backtests/hype/hype-indicator-standalone-2026-09-05/`.
Read `manifest.json`, `validation.json`, `verification.json`, `results.json`,
`summary.csv`, `monthly.csv`/`monthly.json`, `trades.jsonl`, `responses.csv`,
`response-events.jsonl`, `strata.csv`, `ranking.json`, `context-controls.json`.
Raw inputs/generated outputs remain local; source, tests, this report and the
frozen study card are allowlisted for version control. No commit/push requested.
