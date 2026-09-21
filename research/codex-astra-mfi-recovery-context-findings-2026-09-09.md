# F03: distinguishing useful half-exits from lost recoveries

## TL;DR

- **A useful refinement lead: weekly VWAP context.** Within the original MFI-half cases, four older harmful cuts per TP model occurred above weekly VWAP. Their costs were **$4,255 touch / $2,758 confirmed**. Every helpful cut was below weekly VWAP. This separates some counterexamples without discarding the recent beneficial cases, but it is attribution, not yet a newly filtered economic replay.
- **Still not a safe universal exit rule.** Below-VWAP cases retain nine harmful cuts in published touch / five in published confirmed, including several damaging months. Recent cases are all already below VWAP, so this adds no recent discrimination. HL selling/book pressure, support breaks and extreme oversold confirmation do not provide a consistently useful extra discriminator under the twelve fixed definitions.
- **Eight accepted paths re-accounted, no economic/config/fee changes.** Four canonical B17 digests match;216 eligible checkpoints,50 overlapping selected cases,32 distinct checkpoint times. All previously validated indicator families plus eight HL streams/SR at four offsets;1,046 contexts,24,771 raw source rows independently checked. No deployment candidate or untouched validation claim.

## Baseline first: exactly which setup and period?

Current modeled **B17 long ladder**, flat$32,000 start, $800 x1.35/max11; all current modeled gates, S/R actions, damaged latch and ordinary exits retained. No shared-account shorts. Fees remain **0.055% per entry and exit side**, as requested. No maker-fee uplift or funding settlements added.

Original F02 MFI-half: first depth>=9/gross inventory PnL<=-3% starts timer; exactly+60m, same episode still depth>=9 and completed30m MFI14<=20 triggers a pro-rata50% cut. No second loss threshold; no later adds within that episode. Ordinary exits take priority. This pass does not change that definition.

| Window, UTC | Start | End |
|---|---|---|
| Published history | 2025-07-01 00:00 | 2026-08-19 21:32 |
| Recent HL period | 2026-05-17 20:43 | 2026-09-08 17:47 |

The windows overlap and start independently flat. TP models are different execution assumptions, not independent samples or certified bounds for maker execution. Do not pool or subtract their totals as if they were disjoint periods.

### Unchanged economic results, including both wins and losses

W/L is completed episode net including all partials. Net includes final open mark; all recent baseline/half cases have the same **-$3,207 open mark**. Published cases end flat. Winning and losing dollars below refer only to completed episodes.

| Period / TP | Setup | Wins / losses | Winning dollars | Losing dollars | Net incl. open | Max DD |
|---|---|---:|---:|---:|---:|---:|
| Published / touch | Current B17 | 955 / 57 | $187,738 | -$140,906 | $46,832 | 28.17% |
| Published / touch | Original MFI half | 942 / 70 | $184,460 | -$139,890 | $44,570 | 31.97% |
| Published / confirmed | Current B17 | 788 / 60 | $190,819 | -$171,329 | $19,490 | 45.65% |
| Published / confirmed | Original MFI half | 781 / 67 | $188,739 | -$164,907 | $23,832 | 45.23% |
| Recent / touch | Current B17 | 295 / 10 | $57,130 | -$33,009 | $20,914 | 24.69% |
| Recent / touch | Original MFI half | 292 / 13 | $56,417 | -$28,906 | $24,303 | 20.06% |
| Recent / confirmed | Current B17 | 243 / 11 | $59,238 | -$40,192 | $15,839 | 31.11% |
| Recent / confirmed | Original MFI half | 243 / 11 | $59,238 | -$35,138 | $20,893 | 26.08% |

These are accepted F02 results, independently re-accounted here, **not eight freshly optimized strategies**. Every baseline entry is preserved in each original MFI-half path; unselected episode outcomes are checked unchanged. Thus actual selected episode deltas explain each original half-exit net change. This does not certify a newly filtered subset's minute equity, quantity or DD path.

## What does a helpful versus harmful cut mean?

Label = actual MFI-half episode net minus that same baseline episode net. Both include fees and all trims. A later flatten alone does not prove cutting earlier was better: some losing episodes recovered partway before closing.

| Period / TP | Helpful / harmful cuts | Dollars saved by helpful cuts | Dollars lost by harmful cuts | Net contribution vs B17 |
|---|---:|---:|---:|---:|
| Published / touch | 9 / 13 | $11,339 | -$13,601 | -$2,262 |
| Published / confirmed | 9 / 9 | $12,288 | -$7,946 | +$4,342 |
| Recent / touch | 3 / 3 | $6,009 | -$2,619 | +$3,389 |
| Recent / confirmed | 3 / 1 | $5,471 | -$417 | +$5,054 |

This is the invisible-upside accounting: the sacrificed recoveries are charged against the avoided losses. Removing them from the evaluation would manufacture an attractive result.

## Strongest distinction: oversold while still above weekly VWAP

Frozen C3 requires the last completed1h close below its **UTC-week, actual-turnover VWAP**, and ROC over five completed1h bars<=0. No developing hourly candle or future weekly total is used. It is **five-hour ROC**, not one-hour ROC.

All50 selected model/window cases already have negative five-hour ROC. Therefore **weekly VWAP alone explains the observed separation here**; this is not evidence that combining two indicators adds independent predictive value.

| Period / TP | All original half contribution | C3-present helpful / harmful | C3-present contribution | C3-absent helpful / harmful | C3-absent contribution |
|---|---:|---:|---:|---:|---:|
| Published / touch | -$2,262 | 9 / 9 | +$1,993 | 0 / 4 | -$4,255 |
| Published / confirmed | +$4,342 | 9 / 5 | +$7,100 | 0 / 4 | -$2,758 |
| Recent / touch | +$3,389 | 3 / 3 | +$3,389 | 0 / 0 | $0 |
| Recent / confirmed | +$5,054 | 3 / 1 | +$5,054 | 0 / 0 | $0 |

These are **subsets of archived episode contributions**, not filtered-strategy net earnings. There is no new C3-filtered DD or monthly portfolio return yet. Mechanistic interpretation: an oversold pullback that remains above the week's average traded price may differ from weakness beneath that reference. This is an exploratory association, not established causation.

### Exact above-VWAP counterexamples

| Checkpoint UTC | Hourly close above weekly VWAP | Touch cut delta | Confirmed cut delta |
|---|---:|---:|---:|
| 2025-09-11 12:27 | 1.20% | -$817 | -$936 |
| 2025-11-28 03:19 | 2.08% | No selected case | -$911 |
| 2025-11-28 19:25 | 2.40% | -$869 | -$880 |
| 2026-01-25 09:57 | 0.86% | No selected case | -$31 |
| 2026-02-03 16:37 | 1.55% | -$1,553 | No selected case |
| 2026-04-12 02:58 | 5.00% | -$1,016 | No selected case |

Six unique times across two overlapping models. The confirmed Jan25 baseline already loses money, yet the half cut still makes it$31 worse. Other listed selected cases turn recovered baseline wins into losses.

## Month-by-month: the refinement does not erase the remaining damage

Baseline columns are actual monthly MTM PnL. The C3 columns below are **archived selected-episode contribution**, grouped by checkpoint month, not re-simulated monthly earnings. All selected cases happen to close within their checkpoint month, but this is still not a minute-by-minute filtered portfolio calculation. Every baseline/half monthly total is retained in [full tables](../backtests/hype/hype-mfi-recovery-context-2026-09-09/tables.md).

### Published history

| Month | Touch B17 MTM | Touch original half delta | Touch C3-present contribution | Confirmed B17 MTM | Confirmed original half delta | Confirmed C3-present contribution |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | $2,668 | -$1,009 | -$1,009 | -$3,050 | +$524 | +$524 |
| 2025-08 | $561 | -$452 | -$452 | $1,420 | -$88 | -$88 |
| 2025-09 | $5,608 | -$337 | +$480 | $6,247 | -$481 | +$455 |
| 2025-10 | $7,325 | $0 | $0 | $7,167 | $0 | $0 |
| 2025-11 | -$1,443 | -$869 | $0 | -$688 | -$1,791 | $0 |
| 2025-12 | -$509 | $0 | $0 | $673 | $0 | $0 |
| 2026-01 | -$246 | -$622 | -$622 | -$8,750 | +$330 | +$361 |
| 2026-02 | $4,940 | +$473 | +$2,025 | -$6,255 | +$1,689 | +$1,689 |
| 2026-03 | $11,159 | -$932 | -$932 | $12,689 | $0 | $0 |
| 2026-04 | $2,065 | -$764 | +$252 | $2,401 | +$253 | +$253 |
| 2026-05 | $15,753 | -$1,140 | -$1,140 | $15,721 | -$1,147 | -$1,147 |
| 2026-06 | $1,584 | +$2,061 | +$2,061 | -$2,243 | +$5,047 | +$5,047 |
| 2026-07 | -$3,950 | +$1,329 | +$1,329 | -$7,858 | +$7 | +$7 |
| 2026-08, partial | $1,317 | $0 | $0 | $2,017 | $0 | $0 |

The below-VWAP subset still sacrifices about **$1,009 in Jul2025 and$1,140 in May2026 touch**, among other costs. Confirmed May2026 still sacrifices$1,147. It cannot be described as clearing the prior no-materially-worse-month hurdle. There is no newly calculated DD to claim that hurdle passes either.

### Recent HL period

C3 is present for every recent intervention, so its contribution is identical to the original half-exit delta.

| Month | Touch B17 MTM | Original half delta / C3 contribution | Confirmed B17 MTM | Original half delta / C3 contribution |
|---|---:|---:|---:|---:|
| 2026-05, partial | $13,483 | $0 | $17,131 | $0 |
| 2026-06 | $1,584 | +$2,061 | -$2,243 | +$5,047 |
| 2026-07 | -$3,950 | +$1,329 | -$7,858 | +$7 |
| 2026-08 | $9,684 | $0 | $10,239 | $0 |
| 2026-09, partial | $112 | $0 | -$1,429 | $0 |

Still no MFI intervention after July13 in these recent paths. No evidence of protection for the latest September episode; its MFI28.41 remains outside the frozen rule.

## What the other fixed conditions actually say

All12 conditions, both clocks and every observed checkpoint month are in [contrast tables](../backtests/hype/hype-mfi-recovery-context-2026-09-09/tables.md) and `contrast-monthly.csv`. None is promoted from descriptive contribution alone.

| Frozen condition | Key result on actual selected cuts | Interpretation |
|---|---|---|
| C1: current4h EMA trend block | Only1 touch/2 confirmed published cases; zero recent cases | Too few relevant checkpoints; cannot simply require the existing trend gate |
| C2: ADX>=25 and negative DI spread | Only June25 in each model; cut costs$520 touch/$417 confirmed | This exact directional-strength confirmation selects a recovery cost, not useful protection |
| C3: below weekly VWAP + negative five-hour ROC | Removes four harmful older cases per model; retains all helpful cases | Best follow-up lead; still many harmful below-VWAP cuts |
| C4: no price/MFI rebound from first distress | Published flagged balance-$1,251 touch/-$70 confirmed; recent+$1,297/+$1,972 | Misses useful cuts after small rebounds and retains older recovery costs |
| C5: two5m closes below support frozen15m earlier | Zero recent cases; zero published touch/one helpful confirmed | Too sparse under this exact definition; does not falsify S/R generally |
| C6: HL15<=0.85 AND HL60<=0.9 | Recent touch: one helpful$2,557 and one harmful$839; confirmed flags none | Requires selling that is often absent at useful exit checkpoints |
| C7: C6 now and15m earlier | No selected cases in either model | Additional persistence removes the sample rather than proving selectivity |
| C8: HL book imbalance change<-0.15 | Touch selects helpful Jun4 +$2,557; confirmed selects harmful Jun25 -$417 | One-event/model and conflicting evidence; not robust |
| C9: RSI1h<=30 AND CRSI1h<=5 | Zero recent cases; one helpful older cut/model | Extreme oversold confirmation does not distinguish recent cases |
| C10: hourly MACD histogram improves versus1h earlier | No selected cases anywhere | This exact recovery descriptor is absent here; no broad MACD conclusion |
| C11:30m CMF20<0 | Present in21/22 touch and17/18 confirmed older cases | Mostly redundant; removes a useful cut and none of the harmful cuts |
| C12: downside ATR shock plus RVOL>=1.5 | No recent cases; one harmful touch/one helpful confirmed older case | Thin, execution-model-dependent sample |

### HL example: apparent buying can still be followed by a damaging decline

On **Jun9 15:10 confirmed**, the useful half cut saves$3,082, yet HL15m buy/sell is**1.57**, HL1h**0.92**, and the0.5% book imbalance has **improved0.56** over15m. A requirement for current sell-dominant flow or a deteriorating book would reject it.

On **Jun21 09:10 confirmed**, the useful cut saves$2,381 despite HL15m buy/sell**5.55**, HL1h**0.86**, and book improvement**0.39**. Conversely, Jun2 touch has HL15m**0.53** and HL1h**0.76**, yet cutting costs$839 because the ladder subsequently recovers.

All ten recent model/window selected cases show decreasing native HL OI over4h, including helpful and harmful cuts. OI decline alone cannot separate these examples. HLP/funding/HL candle context is retained, but no extra threshold search is manufactured from those fields.

## Side observations from all-family trajectories

These are descriptive medians, not newly tested rules. Full distributions include missingness, 10th/90th percentiles and the unselected checkpoint reference cohort. The distributions overlap substantially.

- Published4h ADX median: helpful/harmful **17.21/38.77 touch**, **14.19/29.26 confirmed**. Recent medians **18.31/41.03** and **19.96/26.43**. High ADX measures strength, not direction; simply asking for a stronger trend is not supported here. Do not fit an inverse ADX threshold from these medians.
- Recent30m signed ATR shock median: helpful/harmful **-0.23/+0.79 touch**, **+0.14/+1.51 confirmed**. An already-bouncing candle may matter, but older ranges overlap and the frozen downside-shock condition did not discriminate robustly. A rebound-aware rule is a separate future hypothesis, not tested profit here.
- RSI, CRSI, Bollinger position, efficiency and closing-flow measures describe a generally weak/oversold population. Their standard snapshots do not provide an obviously clean separation. This is not a global rejection of those indicators or their untested thresholds/timeframes.

## Delay and coverage findings

Weekly-VWAP/ROC classifications are unchanged by the extra60s indicator lag in all selected cases. Price/MFI rebound classification changes on8 published and2 recent overlapping cases. The frozen support-break flags also change on individual minute-boundary cases. Do not interpret perfect source stability from only the most stable feature.

All10 recent C6/C7 selected-case classifications become **unknown** under the extra60s legacy HL delay: the latest15m window falls short of its14/15 bucket requirement. This is explicit loss of data readiness, not evidence of reduced selling or a working trade veto. A subsequent arrival-robust design would need a separately specified completed-window clock, not hindsight-filled gaps or relaxed coverage chosen after results.

HL history is absent for16/22 published touch cases and14/18 confirmed cases. Hence the old above-VWAP counterexamples cannot be retrospectively certified with HL. Candle-only context provides the cross-period check; no synthetic HL is supplied.

## Next useful step and verdict

**Retain selective half exits, now with a narrower weekly-VWAP hypothesis. No live change.**

The next economic checkpoint should compare exactly:

1. Unchanged current B17.
2. Original MFI-half control.
3. The same MFI-half rule additionally requiring the frozen completed1h weekly-VWAP/ROC condition.

Run both existing windows/TP models, the same fees, source/fill delays, actual no-readd/quantity/occupancy accounting and monthly/DD screen. Do not add another threshold just because one remaining losing month is visible. ROC currently adds no separation, so report that redundancy rather than selling this as proven two-indicator synergy. UTC-week rollover and source freshness need explicit tests in that economic follow-up.

Even if that replay confirms the attribution, the remaining harmful months already show that **weekly VWAP is a refinement, not the finished solution**. A later rebound discriminator would need its own frozen scope and counterexamples, followed by forward observation before live promotion. The other11 contrasts are not deployment candidates under the evidence above; no global claims about their entire indicator families.

## Verification and preserved work

- Re-accounted8 accepted paths: **45,624 fills,3,045,752 minute marks,434 raw MFI reconstructions**. Four B17 digests exactly match the canonical archived controls. No new fee logic, engine hooks, or trading definitions.
-216 eligible baseline checkpoints;50 actual MFI-half model/window observations at32 distinct UTC times. Unselected controls have no invented hypothetical-cut label. Exclusions and unfinished controls remain explicit.
-1,046 as-of contexts at checkpoint minus4h/minus1h/minus15m/now plus delayed queries;251 saved numeric/context fields. Prefix checks cover indicators, price, SR and both HL lags.
- Independent checker: **255,936 raw-source references,24,771 unique raw rows,64 full-file latest-source selection checks,1,699 flow recomputations,686 book-band arithmetic checks,10,460 indicator clock checks,2,092 raw weekly-VWAP reconstructions,864 real5m support-bar checks,960 contrast partitions**.
- Normal/VPS/research TypeScript checks; F03 tests, F02 unit/integration, P01, failed-recovery, HL-event, closed-bar timing, VWAP/volume and OBV/MFI/CMF suites. Protected configs/state/live sources unchanged. No commit, push or VPS action.

[Frozen scope](../research-inputs/mfi-recovery-context-2026-09-09.json) · [method/reproduction](../docs/research/mfi-recovery-context.md) · [runner](../scripts/hype-mfi-recovery-context-study.ts) · [independent checker](../scripts/mfi-recovery-context-check.ts).

Local accepted outputs: `backtests/hype/hype-mfi-recovery-context-2026-09-09/`, including [readable full tables](../backtests/hype/hype-mfi-recovery-context-2026-09-09/tables.md), [monthly baseline pairs](../backtests/hype/hype-mfi-recovery-context-2026-09-09/baseline-monthly.csv), [all contrasts/months](../backtests/hype/hype-mfi-recovery-context-2026-09-09/contrast-monthly.csv), `rows.json`, `trajectories.csv`, `contexts.jsonl`, source/manifest/verification files.
