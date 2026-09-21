# RR01: BTC-relative strength, persistence and frozen research workflow

September 10, 2026. Local implementation and research. No live config, state,
orders, signals, deployment, commit or push changed.

## TL;DR

- Built the **local-only registry/runner first**, then two allowlisted workers:
  frozen F06 scorecard refresh and RR01 feature diagnostics. Exact inputs,
  runtime, source hashes, exclusive job ownership, durable status and output
  hashes are recorded. Completion never implies economic qualification.
- RR01 covers **692 fixed4h clocks** and **55 archived pressure landmarks across
  two model paths**, each under0/60s publication assumptions. **Zero new trading
  definitions.** Relative weakness alone does not reliably distinguish damaging
  continuation from oversold recovery. The persistence estimate is often fragile.
- **Six archived economic controls matched exactly; six extensions completed.**
  The35h21m extension has no additional completed episodes and approximately
  -$26.99 MTM movement per path. Existing aggregate advantages and cross-period
  failures remain. No new exit/add/TP rule is qualified by this pass.

## 1. What was actually built and run

This implements the prior article-review priorities in order **3 ->1 ->2**,
not an autonomous strategy finder. See the
[workflow and methodology](../docs/research/local-research-workflow.md).

- [RR01 frozen card](../research-inputs/relative-reversion-2026-09-10.json)
- [F06 frozen refresh card](../research-inputs/frozen-scorecard-2026-09-10.json)
- RR01 final job: `63b277ce30d4e954f495b113c4498952e6a90dd76c32506771190e7cd0edb3fe`
- F06 refresh job: `3dba8bd7cde72f23cb4165e595983a34464db825ddea6310906fd8e791d66fd3`
- Local job root: `backtests/research-workflow/`

The three RR01 execution snapshots during infrastructure/checker integration
use the same frozen feature definitions and produce the same feature/outcome
results. They are reproducibility iterations, not three independent experiments.
One earlier plan was not executed. These remain visible rather than deleted.
There was no parameter tuning after outcomes. Historical register counts remain
**5,261 standalone /67 ladder overlays**, with L09 components separate.

## 2. Data and snapshot scope

The requested sync completed05:10:01 UTC. Both datasets support a common closed
minute **end cutoff2026-09-10 05:08 UTC**. RR01 startsMay17 20:43 UTC, with an
additional training seed. This is approximately115 days, not a fresh60-day
search. The pressure cohort retains its original labels throughSeptember8
17:47 UTC; newer prices do not silently resolve its censored episodes.

Coverage audit:

- HYPE:926,882 merged raw minutes through cutoff, plus11 existing verified
  repairs. No remaining HYPE minute gaps. Collector overlaps:31,178 duplicates,
  one changed OHLCV row. No raw candle file edited.
- BTC:899,462 merged minutes,31,178 duplicates, two changed OHLCV rows. Seven
  missing minutes inside the recent study window; two are in the same hour.
- BTC's largeApril6-April25 gap is outside this study and its seed. It was not
  interpolated, repaired or silently admitted into a return.
- Both sources use historical archive then collector last-row-wins, matching
  canonical precedence. This is corrected history, **not evidence of actual
  receipt times**.0/60s are modeled publication assumptions.
- Missing BTC constituents invalidate the entire affected hourly bar and both
  adjacent hourly returns. Training allows at least160/168 valid return pairs;
  the evaluated1h/4h intervals require five complete paired closes.

The copied runtime snapshot showed11 rungs, no pending transaction/recovery
flag and an active maker TP. That is a local snapshot, not an authenticated
exchange check or proof of the current live position.

## 3. Updated economic baseline, not a new strategy

**Window:2026-05-17 20:43 ->2026-09-10 05:08 UTC.** Each path starts flat with
$32,000. B17 is the unchanged current modeled long stack:800 x1.35,max11,
current gates/partials/damaged latch and ordinary exits. Short entries remain
outside this replay.0.055% fee each side, unchanged by user agreement.

W/L and winning/losing dollars are completed episodes, including their partial
realizations. Net also includes the final open mark shown. TP models are
different execution assumptions, not guaranteed bounds for live maker fills.

| TP model / setting | W / L | Winning dollars | Losing dollars | Open mark | Net | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Touch **B17 baseline** |295 /10|$57,130|-$33,009|-$3,234|**$20,887**|**24.69%**|
| Touch age8 |242 /10|$67,914|-$34,946|-$3,235|$29,732|20.35%|
| Touch no soft-stale |188 /10|$66,565|-$35,619|-$3,235|$27,711|24.19%|
| Confirmed **B17 baseline** |243 /11|$59,238|-$40,192|-$3,234|**$15,812**|**31.11%**|
| Confirmed age8 |194 /10|$65,623|-$38,008|-$3,234|$24,380|25.44%|
| Confirmed no soft-stale |158 /10|$71,783|-$38,490|-$3,236|$30,058|28.13%|

Ranking by recent net improvement: touch age8+$8,846, no-soft+$6,824;
confirmed no-soft+$14,246, age8+$8,569. These gains were already present in F06.
The new tail does not increase confidence by supplying additional closed trades.
It extends the same inventory; it is not a flat-start forward portfolio.

### Monthly net MTM, baseline beside each candidate

PartialMay/September; same exact window as above. Rounded dollars.

| Month | Touch B17 | Touch age8 | Delta | Touch no-soft | Delta |
|---|---:|---:|---:|---:|---:|
|May|$13,483|$16,982|+$3,499|$18,465|+$4,982|
|June|$1,584|$7,293|+$5,709|$1,911|+$328|
|July|-$3,950|-$5,857|**-$1,907**|-$6,426|**-$2,477**|
|August|$9,684|$11,481|+$1,797|$14,174|+$4,490|
|September|$85|-$167|-$252|-$413|-$498|

| Month | Confirmed B17 | Confirmed age8 | Delta | Confirmed no-soft | Delta |
|---|---:|---:|---:|---:|---:|
|May|$17,131|$19,308|+$2,177|$21,991|+$4,860|
|June|-$2,243|$594|+$2,838|-$1,502|+$741|
|July|-$7,858|-$6,672|+$1,187|-$5,985|+$1,874|
|August|$10,239|$12,605|+$2,367|$15,832|+$5,593|
|September|-$1,456|-$1,456|$0|-$278|+$1,178|

**Qualification unchanged.** Both alternatives still fail the original
cross-period/monthly screen. In particular age8's older touch DD worsens28.17%
to36.85%, and its olderMarch delta is approximately-$7,126. This refresh does
not rerun or waive those older findings. Touch winning dollars improve while
losing dollars also increase: it is not uniformly reduced flatten damage.

All sixSeptember8 controls reproduced exact saved result digests, metrics and
independent ledger accounting before extension. All12 paths passed independent
inventory/fee/minute-mark accounting. No replay engine or policy code changed.
Funding settlement, true maker fills, exchange margin/liquidation and joint
short-account effects remain outside the result.

## 4. Relative weakness at the actual pressure points

Frozen measurement: regress past168h HYPE hourly log returns on BTC, excluding
the entire evaluated4h interval. A weak flag requires negative residuals over
both1h and4h. No RSI/HL/S/R conjunction or optimized residual threshold added.

Primary cohort: depth>=9, first-3% gross ladder drawdown, observed60m later while
still open. These are **selected distressed episodes**, not the full baseline
trade population above. Touch27 observations/26 completed, confirmed28/27;
one censored episode per model. Both models overlap and are not independent.

| Model / cohort | Completed W/L | Winning dollars | Losing dollars | Further losses after observation | Recovery after observation |
|---|---:|---:|---:|---:|---:|
|Touch all pressure points|21 /5|$5,472|-$28,389|$19,266|$43,463|
|Touch relative-weak subset|15 /5|$4,091|-$28,389|$19,266|$34,208|
|Confirmed all pressure points|19 /8|$6,397|-$38,541|$24,435|$45,726|
|Confirmed relative-weak subset|15 /4|$5,382|-$16,479|$8,786|$37,054|

For touch,20 completed weak observations subsequently have16 recoveries versus
four further declines. Confirmed:19 completed,15 recoveries versus four further
declines. An episode can recover from its underwater observation yet still
close at an overall loss; continuation outcomes and final W/L are different.

This does **not** support exiting simply because HYPE underperforms BTC. The
weak subset contains approximately$34k/$37k of subsequent recovery versus
$19k/$9k of additional loss. These are existing-path attributions, **not** the
earnings or saved loss of a hypothetical exit: a real exit changes fees,
inventory, new entries and later opportunities.

The unflagged confirmed subset actually contains three further declines out
of eight completed observations, versus four of19 flagged. Touch's unflagged
six all recover. Direction is not robust across execution paths. Raw HYPE
weakness and existing VWAP/ROC cross-cells are retained in `summary.json`;
the apparent improvements do not establish consistent incremental separation.
0/60s produces the same primary-landmark classification here, because these
specific decision clocks do not cross a relevant availability boundary.

### Concentration: weak subset's continuation, by month

| Month | Touch completed | Further loss | Recovery | Confirmed completed | Further loss | Recovery |
|---|---:|---:|---:|---:|---:|---:|
|May|5|$0|$11,724|4|$0|$11,256|
|June|11|$16,609|$17,962|9|$4,763|$19,009|
|July|3|$2,657|$2,464|4|$4,023|$2,676|
|August|1|$0|$2,058|1|$0|$2,086|
|September|0|$0|$0|1|$0|$2,027|

The monthly all-pressure baselines and every complementary/unknown group are
stored alongside these subsets. Tiny month cells and model-sensitive selection
are a reason to retain the feature for analysis, not claim it is an exit edge.

## 5. Persistence: useful description, not a recovery deadline

Same past beta,168h detrended log spread, AR(1) fit. No gap bridging. Report
descriptive half-life only if positive phi and its conventional OLS interval
are inside(0,1). This is **not cointegration/stationarity testing**. Fitting a
trend and beta can itself induce apparent reversion.

On the primary grid:

-692 decision clocks,689 completed12h horizons, three right-censored.
-686 relative-feature-ready clocks; six unavailable due to BTC gaps.
-423 usable persistence estimates;269 unknown, including263 fragile fits and
  the six unavailable input windows. About39% cannot support a half-life label.
-The <=4h below-trend bucket has **zero observations**. Do not conclude that
  fast reversion is profitable/unprofitable from an empty group.

| Grid cohort,0s source lag | Completed12h outcomes | Mean forward return | Mean adverse excursion |
|---|---:|---:|---:|
|All-clock baseline|689|+0.320%|-2.319%|
|Both relative returns negative|225|+0.388%|-2.320%|
|Below fitted trend, half-life4-8h|65|+0.494%|-2.302%|
|Below fitted trend, half-life>8h|157|+0.930%|-1.906%|
|Usable fit, not below trend|198|+0.048%|-2.501%|
|Persistence unknown|269|+0.123%|-2.430%|

These are overlapping12h outcomes sampled every4h, **not independent trades,
a fixed-notional strategy, net earnings or portfolio DD**. Timing sensitivity:
the >8h below-trend cohort's mean becomes+1.214% under60s availability, while
the whole-grid baseline remains+0.320%. That is a descriptive lead, not a
validated rule; categories and membership change when the preceding hour is used.

| Month | All-clock mean12h return | >8h/below mean | Subset n |
|---|---:|---:|---:|
|May|+1.772%|+1.903%|21|
|June|-0.112%|+1.283%|24|
|July|-0.324%|-0.310%|45|
|August|+0.810%|+1.614%|57|
|September|+0.029%|-0.281%|10|

It would be wrong to interpret "slow reversion" as "exit now": that cohort
often recovers in these data. It is also wrong to say it reliably recovers:
July/September remain weak and deep-ladder cohort sizes are only4-6 per usable
below-trend category. Approximately half of the pressure landmarks have an
uncertain persistence estimate.

## 6. Latest snapshot, not a trade recommendation

At the05:08 cutoff, the last completed paired hour ends05:00 UTC. Past-fit
beta1.124,R-squared0.402,166/168 training return pairs; HYPE4h return+1.850%,
BTC+0.304%, residual1h+0.147%, residual4h+1.495%. Thus relative weakness is
**not** flagged at this snapshot, despite the ladder still being underwater.

The detrended spread remains approximately1.15 standard deviations below its
extrapolated trend. Descriptive half-life is approximately10h. This does not
forecast a10h TP or override any live gate. A recent bounce and an underwater
older position can coexist without contradiction.

## 7. Verification and next boundary

Passed:

- Root and VPS TypeScript no-emit checks.
- Registry tests: duplicate titles/runs, changed inputs, protected-file mutation,
  interrupted-run residue, concurrent exclusive ownership and failed artifacts.
- Feature tests: independent regression fixture, synthetic persistence,
  future-poison/prefix identity, evaluated-window exclusion,0/60s boundaries,
  missing constituents/adjacent returns, degenerate data and right censoring.
- Independent RR01 verifier:1,482 usable beta/AR feature rows,12 expected missing
  rows,1,378 complete grid outcome checks,110 exact archived landmark joins.
  Counts include timing/model repetitions, not independent observations.
- Exact six economic controls,12 independently accounted paths (27,830 fills
  and1,980,546 minute marks), output hash
  verification, protected live-file hashes and `git diff --check`.

The current strongest economic leads remain the pre-existing TP-duration
alternatives, with their full costs/monthly failures retained. RR01 supplies
reproducible relative/persistence features but **no qualified trading action**.
Do not invert a failed weak-sell flag and call the opposite side validated.

Next appropriate boundary: specify a small, separately frozen **recovery
trajectory** diagnostic (change/reclaim of the same past-known residual, versus
raw HYPE/VWAP/ROC controls) before tying this context to TP deferral or an exit.
Any proposed action must then use the real occupancy replay. No new condition
was silently attached to the losing half-exit rules during this pass.
