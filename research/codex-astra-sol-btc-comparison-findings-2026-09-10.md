# RR02: does SOL relate to HYPE better than BTC?

September 10, 2026. Local diagnostic research, no live configuration or execution
changes. No new entry/exit strategy replay, commit, push or deployment.

## TL;DR

- **SOL tracks HYPE modestly better overall, especially on four-hour moves.**
  Identical samples: 2,749 hourly returns, correlation BTC **0.579** versus SOL
  **0.600**; 682 four-hour returns, BTC **0.521** versus SOL **0.593**. SOL wins
  the four-hour comparison in every monthly slice, not just the latest bounce.
- **Closer tracking does not establish advance warning.** The fixed, past-fitted
  next-hour models have 2,749 scored forecasts: BTC and SOL both slightly
  underperform the rolling historical-mean baseline. No profitable strategy is
  inferred from correlation, beta or directional accuracy.
- **SOL does not consistently improve the deep-ladder warning.** Same 55 existing
  pressure landmarks across two TP paths, one censored episode per path. SOL
  catches more subsequent damage in the confirmed path but less in the touch
  path, while still flagging substantial recoveries. **Zero new trading definitions;
  no qualified live gate or exit.**

## 1. Scope, reproducibility and baseline

Window: **2026-05-17 20:43 to 2026-09-10 05:08 UTC**, approximately 115 days.
This matches RR01. May and September are partial months. The minute source
cutoff is not the later 05:10 sync-completion time.

- Frozen [study card](../research-inputs/market-proxy-comparison-2026-09-10.json).
- Runner: `npm run research:workflow -- plan research-inputs/market-proxy-comparison-2026-09-10.json`.
- Accepted job: `a5ffcd8d4f9a2a6e1c6460e6f9ed93b16b0512e8f03564b1f992a528fdcd7a97`.
- Results: `backtests/research-workflow/<key>/output/summary.json`.
- Independent check: `npx ts-node scripts/market-proxy-verify.ts <key>`.

The first run was repeated only to label the reference return correctly for SOL
and strengthen independent verification. Parameters and numerical conclusions
were unchanged. One intermediate plan was not executed. These are not additional
independent hypotheses or trading trials.

Before introducing SOL, **all 1,494 saved BTC-only RR01 feature objects reproduced
exactly**. For the comparison, BTC and SOL then use the intersection of complete
HYPE/BTC/SOL hourly bars, including identical regression training samples. The
matched BTC cohort can differ slightly from unrestricted RR01; that attrition
is not credited as a SOL effect.

Existing economic reference, **imported from the immediately preceding frozen
refresh, not rerun here**: B17 starts flat with $32,000, $800 x 1.35, max 11,
current modeled gates/partials/exits, and 0.055% fees per side. Same May17-Sep10
window. Net includes final open mark; completed W/L includes episode partials.

| B17 model | W / L | Winning dollars | Losing dollars | Open mark | Net | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Resting touch | 295 / 10 | $57,130 | -$33,009 | -$3,234 | $20,887 | 24.69% |
| Close confirmed | 243 / 11 | $59,238 | -$40,192 | -$3,234 | $15,812 | 31.11% |

No SOL-filtered PnL or DD exists in this study. Net-PnL improvement ranking and
deployment qualification are **not evaluated**, rather than assumed from a
descriptive relationship. Source: [RR01 findings](codex-astra-relative-reversion-findings-2026-09-10.md).

## 2. Coverage and timing

SOL has no local `SOLUSDT_1_full.json`; it does have a collector minute archive
starting March29 16:13 UTC, sufficient for this window and training seed. An
explicit collector-only mode was added to the research loader. Default missing
historical files still fail; no fake full archive or 5m substitution was created.

Through the common cutoff, SOL has 208,754 unique minutes, 22,232 duplicate
rows and two OHLCV revisions. Six individual minutes are missing in the study
window; two are in the same hour. BTC has seven missing minutes. Large April
gaps are outside the study/seed. The existing verified 11-minute HYPE repair
is reused without editing raw files.

All hourly bars require their complete 60-minute constituents. Missing hours
invalidate adjacent returns; there is no interpolation or bridging of gaps.
Matched relative features are ready on 683/692 primary grid clocks and 682/692
under 60s modeled publication delay. Both references have the same input mask.

Historical last-row-wins collector precedence is unchanged. Source archives
are corrected history, not proof of historical arrival. The frozen 0/60s
publication sensitivities are explicitly modeled, not measured latency.

## 3. Which tracks HYPE more closely?

Pearson correlation uses **log returns**, never price levels. Four-hour returns
are non-overlapping, UTC-aligned complete intervals. The below values are
descriptive same-period relationships, not predictions of later HYPE prices.

| Return interval | Identical observations | HYPE / BTC | HYPE / SOL |
|---|---:|---:|---:|
| 1 hour | 2,749 | 0.579 | **0.600** |
| 4 hours | 682 | 0.521 | **0.593** |

On the full four-hour sample, the simple same-time linear R-squared is about
27.2% for BTC and 35.2% for SOL. That is stronger association, not an 8% profit
improvement. BTC and SOL themselves correlate about 0.82 at both horizons;
the two references contain substantial common information.

### Monthly comparison, BTC always beside SOL

| Month | Hourly n | BTC 1h | SOL 1h | Four-hour n | BTC 4h | SOL 4h |
|---|---:|---:|---:|---:|---:|---:|
| May, partial | 338 | 0.472 | **0.511** | 83 | 0.431 | **0.497** |
| June | 716 | 0.661 | **0.699** | 178 | 0.647 | **0.693** |
| July | 738 | 0.584 | **0.587** | 183 | 0.516 | **0.553** |
| August | 737 | **0.507** | 0.486 | 183 | 0.404 | **0.532** |
| September, partial | 220 | 0.646 | **0.679** | 55 | 0.630 | **0.680** |

SOL's hourly advantage is small and reverses in August. The four-hour advantage
is more consistent across these five monthly slices. These are observations,
not a formal significance/causality test or five independent holdouts.

### Does the past-only rolling relationship agree?

RR01's unchanged fit uses 168 preceding hourly return pairs, at least 160 valid,
ending **four hours before** the evaluated interval. Neither the current one-hour
nor four-hour return participates in its own coefficient fit.

Mean rolling hourly R-squared across the matched primary grid: **BTC 34.13%,
SOL 35.68%**. This advantage is much smaller than the full-period four-hour
correlation difference; the quantities answer different questions.

| Month | BTC mean past-fit R-squared | SOL mean past-fit R-squared |
|---|---:|---:|
| May | 19.65% | 24.79% |
| June | 42.92% | 46.41% |
| July | 36.30% | 38.38% |
| August | 27.44% | 27.31% |
| September | 42.86% | 36.48% |

Thus SOL is not uniformly the better reference at every rolling decision.

## 4. Does either asset predict HYPE's next hour?

A separate frozen diagnostic fits HYPE's next-hour return from a single latest
known return: BTC, SOL, or HYPE itself. Coefficients use the last 168 already
closed target-hour labels, at least 160 common observations. The comparator
is the mean of those same past HYPE labels. No future label enters a fit.

At an hourly boundary, the 60s sensitivity has an older available predictor.
Training uses the corresponding two-hour predictor-to-target lag but still
forecasts the **next wall-clock hour**, not an already elapsed hour. No lag
sweep, nonlinear model, multi-factor blend or return threshold was searched.

Primary availability, **2,749 identical scored forecasts**:

| Forecast input | RMSE, return percentage points | MSE improvement vs mean baseline |
|---|---:|---:|
| Past HYPE mean baseline | **0.9849** | **0%** |
| HYPE own latest return | 0.9873 | -0.49% |
| BTC latest return | 0.9905 | -1.14% |
| SOL latest return | 0.9904 | -1.11% |

Negative improvement means **more squared prediction error**, not lost trading
PnL. Neither market reference wins this simple forecast test. Primary BTC/SOL
models also underperform their monthly mean baseline in every monthly slice:

| Month | Mean-baseline MSE improvement | BTC | SOL |
|---|---:|---:|---:|
| May | 0% | -1.35% | -1.15% |
| June | 0% | -0.61% | -0.02% |
| July | 0% | -1.23% | -1.78% |
| August | 0% | -2.09% | -2.85% |
| September | 0% | -0.42% | -1.19% |

Under 60s availability, 2,632 forecasts are scored: BTC -0.96%, SOL -1.00%
versus that sensitivity's own mean baseline. There are more unavailable cases,
particularly in August: the longer predictor-label span invalidates additional
training pairs near gaps. We retain the fixed 160-pair minimum, not relax it
after seeing results. Do not treat changes in coverage as improved alpha.

This does not rule out faster lead/lag, nonlinear conditions, pulse confirmation
or an event-driven mechanism. It rejects neither SOL nor BTC as useful context;
it fails to establish advance warning in these specific hourly linear models.

## 5. Does SOL improve the deep-ladder warning?

Same F01 cohort as RR01: depth at least9, first -3% gross drawdown, observed60m
later if still open. The flag requires both 1h and 4h HYPE residual returns to
be negative relative to the chosen asset. Both references use identical valid
training samples. Existing September8 labels, including censored outcomes,
remain unchanged even though newer prices exist.

These are **selected distressed episodes**, not the whole strategy population
in section1. Final episode W/L differs from whether an already-underwater
episode improves or worsens after the observation.

| Model / cohort | Completed W/L | Winning dollars | Losing dollars | Later recovery / deterioration |
|---|---:|---:|---:|---:|
| Touch all pressure points | 21 / 5 | $5,472 | -$28,389 | 22 / 4 |
| Touch BTC-weak | 15 / 5 | $4,091 | -$28,389 | 16 / 4 |
| Touch SOL-weak | 17 / 4 | $4,540 | -$22,278 | 18 / 3 |
| Confirmed all pressure points | 19 / 8 | $6,397 | -$38,541 | 20 / 7 |
| Confirmed BTC-weak | 15 / 4 | $5,382 | -$16,479 | 15 / 4 |
| Confirmed SOL-weak | 15 / 6 | $4,641 | -$26,424 | 16 / 5 |

Each all-pressure cohort and each flagged cohort also contains one censored
episode, excluded from W/L/dollar totals. Models and timing repetitions overlap.
These primary pressure classifications are unchanged under 60s availability.

| Model / cohort | Further losses after observation | Recovery after observation |
|---|---:|---:|
| Touch all pressure points | $19,266 | $43,463 |
| Touch BTC-weak | $19,266 | $34,208 |
| Touch SOL-weak | $15,020 | $37,667 |
| Confirmed all pressure points | $24,435 | $45,726 |
| Confirmed BTC-weak | $8,786 | $37,054 |
| Confirmed SOL-weak | $14,949 | $37,690 |

Touch: SOL misses about $4,246 of later damage that BTC flagged, while including
about $3,459 more recovery. Confirmed: SOL flags about $6,164 more damage but
also about $635 more recovery. Its improvement is **not consistent across paths**.
None of these is a simulated loss saving: actually exiting changes the ladder,
fees, later adds and replacement opportunities.

Disagreements are sparse: three touch and four confirmed landmarks. For example,
the confirmed June9 15:10 observation is SOL-weak but not BTC-weak and later
deteriorates by $6,164; the touch June21 23:10 observation is BTC-weak but not
SOL-weak and deteriorates by $4,246. Those examples explain the model contrast;
they are not enough to override aggregate evidence.

The full monthly all-cohort/BTC/SOL tables and complementary/unknown/disagreement
groups are retained in `summary.json`. The damage is concentrated in June/July,
while many May/August flagged observations subsequently recover.

## 6. Persistence and latest context

The same descriptive AR(1) persistence method was mapped with SOL. With matched
inputs, unknown estimates fall from **281/692 for BTC to 248/692 for SOL** on the
primary grid. More computable estimates do not establish calibrated half-lives,
cointegration or a superior exit. The single SOL below-trend <=4h case is much
too small to evaluate; no threshold refinement was performed.

Whole-grid mean forward12h return +0.320%, mean adverse excursion -2.319%.
BTC-weak clocks: +0.388% / -2.320%; SOL-weak: +0.476% / -2.310%. Both weak flags
still include ordinary recoveries. These overlapping market outcomes are not
independent trades or net portfolio earnings.

At September10 05:08, using the completed paired hour ending05:00:

| Context | BTC reference | SOL reference |
|---|---:|---:|
| Reference asset four-hour return | +0.304% | +0.971% |
| HYPE four-hour return | +1.850% | +1.850% |
| HYPE residual four-hour return | +1.495% | +1.077% |
| Past-fit R-squared | 40.16% | 44.28% |
| Both-window relative weakness | false | false |

Both describe HYPE outperforming recently. That can coexist with an older
underwater ladder. Neither is a recommendation to add, hold or override a gate.

## 7. Verification and conclusion

Passed tests cover a known synthetic SOL leader, correct 0/60s forecast horizons,
prefix identity/future poisoning, identical sample masks, gaps, censoring and
explicit collector-only loading. Existing research-workflow/relative tests,
root/VPS/explicit-script TypeScript checks and diff whitespace checks also pass.

Independent verifier: 2,940 SOL hourly aggregates reconstructed from raw minutes;
16,149 forecast coefficient/prediction checks, 155 expected unavailable cases,
5,538 forecast labels, 24 correlation checks, 110 unchanged pressure joins,
and 2,950 matched relative-feature checks. Repeated markets/models/delays are
not independent evidence. Protected bot/config fingerprints and result hashes
remain intact.

**Answer: SOL is a somewhat better co-movement reference, particularly at4h;
it is not yet a better actionable warning indicator.** BTC still supplies useful
information, and the strong BTC/SOL correlation argues against treating them
as independent confirmations. No BTC blocker replacement or new SOL exit is
supported by this pass. No additional strategy or parameter search was performed.
