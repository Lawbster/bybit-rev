# Stage 3: individual indicators at the ladder's last rung

September 5, 2026. Local research only. No live config, state, strategy,
exchange actions, deployment, commit or push changed.

## TL;DR

- **Four corrected baselines reproduced exactly; four new veto definitions /
  16 variant cases were completed.** Independent verification checked all 20
  cases: 261,109 decisions, 112,406 inventory events, 2,615 partials, 190 monthly
  rows and 3,328 deep-rung outcome labels. These overlapping/model-repeat counts
  are audit rows, not independent market observations.
- **ROC <=0 produced the strongest recent profit lift, but not robust protection.**
  Recent PnL improves $3,526-$3,603 across both TP models; recent resting-touch
  DD worsens 24.69% ->26.94%. Longer resting-touch loses $8,832 and 36 TP cycles.
  Fewer dollars lost in bad episodes does not guarantee a safer equity path.
- **0/4 pass either inherited profit or defensive screen.** Hot RSI/CRSI are
  sparse and unhelpful recently; below-VWAP has a real risk/profit trade-off but
  expensive missed recoveries. This rules out these exact standalone vetoes as
  robust upgrades, not all indicator combinations or all possible ladder logic.

## Scope and comparison contract

[Exact frozen card](../research-inputs/indicators/ladder-single-2026-09-05.json) /
[engineering and reproduction](../docs/research/ladder-single-indicator-study.md) /
[previous standalone work](codex-astra-indicator-standalone-findings-2026-09-05.md).

| Case | Exact UTC period |
|---|---|
| Recent | 2026-05-17 20:43 to 2026-09-04 19:01 |
| Longer | 2025-07-01 00:00 to 2026-08-19 21:32 |

Both periods were already examined and overlap. They are not independent
holdouts and their PnLs must not be added. The longer cutoff deliberately
matches the accepted ladder baseline, not stage 2's September 4 cutoff.

Unchanged baseline: $32,000 starting long-only modeled equity; $800 base,
1.35 scale, max 11 positions; normal 1.4% TP / existing 0.5% soft-stale TP;
all existing trend, damaged-regime, stress, S/R partial/support-reopen and exit
logic preserved. Transactional partial closes preserve the last actual add time.
No old live/legacy RSI or CRSI gate was replaced with a new definition.

Each comparison uses **0.055% trading fees each side, before funding**.
Resting-touch means a previously armed TP can fill on a later minute's touch;
close-confirmed waits for a completed close and executes next open. All other
market actions also execute next open. Neither certifies exact live maker/native
fills, actual receipt timing, slippage paths, lot fragmentation, liquidation,
outages, ten-second polling or shared-account performance.

### Four hypotheses only

| ID | Additional condition that blocks an otherwise approved rung-11 add |
|---|---|
| rsi_hot_d11 | Latest fully closed 1h RSI14 >=70 |
| crsi_hot_d11 | Latest fully closed 1h CRSI(3,2,prior100) >=80 |
| roc_weak_d11 | Latest fully closed 1h five-bar return <=0% |
| below_vwap_d11 | Latest fully closed hourly price below that bar's own UTC-day VWAP |

Each runs alone, after **all original gates and affordability**, and covers
both timer-only and genuine-drop adds. Re-evaluate on later eligible minutes;
no sticky hold, no new pending order while blocked, no forced sale and no
lower-rung/size/exit change. All four were declared before outcomes; descriptive
cohorts did not decide which policies ran.

These are state vetoes, not the previous standalone crossover entries.
ATR/ADX/DI/RVOL are logged but not order conditions. Rung >=9 attribution is
descriptive, **not extra rung-9 policy testing**. Stages 4-5 remain unrun.

The adapter uses June 1, 2025 as its fixed seed, complete minute constituents,
and the latest exact closed hour. Historical zero publication lag is explicitly
modeled. Required unknown data makes the experimental overlay inactive and is
counted; **zero unknown decisions** occurred in these four variants. This is
not a selected live missing-data policy.

## Whole ladder results: wins and losses beside baseline

A win/loss is a completed flat-to-flat ladder episode, including its earlier
partials and modeled trading fees. Unfinished episode = final inventory mark
plus any partial proceeds belonging to that still-open episode. It is not a
completed loss. Net = winning dollars + losing dollars + unfinished episode.
Values are independently rounded; small rounding differences can occur.

Forced closes include funding exits, some profitable; they are not identical
to losing-episode counts. Full-path variants alter later entries and episode
identity, so aggregate changes are not a one-for-one list of saved flattens.


### Recent / resting-touch

| Setup | W / L | Winning $ | Losing $ | Unfinished episode $ | Net $ | DD | Forced closes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 289 / 10 | 56,072 | -33,009 | -302 | 22,760 | 24.69% | 10 |
| RSI >=70 veto | 290 / 10 | 55,513 | -33,172 | -302 | 22,039 | 24.59% | 10 |
| CRSI >=80 veto | 289 / 10 | 56,072 | -32,998 | -488 | 22,586 | 24.69% | 10 |
| ROC <=0 veto | 295 / 10 | 54,768 | -28,103 | -302 | 26,363 | 26.94% | 10 |
| Below-VWAP veto | 291 / 10 | 53,573 | -30,037 | -302 | 23,234 | 21.87% | 11 |

### Recent / close-confirmed

| Setup | W / L | Winning $ | Losing $ | Unfinished episode $ | Net $ | DD | Forced closes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 241 / 11 | 58,958 | -40,192 | -1,298 | 17,468 | 31.11% | 12 |
| RSI >=70 veto | 240 / 11 | 58,369 | -40,281 | -1,298 | 16,790 | 31.09% | 12 |
| CRSI >=80 veto | 241 / 11 | 58,836 | -40,202 | -1,298 | 17,336 | 31.20% | 12 |
| ROC <=0 veto | 243 / 11 | 60,769 | -38,477 | -1,298 | 20,994 | 30.55% | 12 |
| Below-VWAP veto | 231 / 11 | 55,575 | -37,372 | -1,343 | 16,861 | 29.75% | 12 |

### Longer / resting-touch

| Setup | W / L | Winning $ | Losing $ | Unfinished episode $ | Net $ | DD | Forced closes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 955 / 57 | 187,738 | -140,906 | 0 | 46,832 | 28.17% | 59 |
| RSI >=70 veto | 957 / 57 | 186,717 | -140,758 | 0 | 45,959 | 28.44% | 59 |
| CRSI >=80 veto | 960 / 57 | 187,960 | -140,317 | 0 | 47,643 | 27.29% | 59 |
| ROC <=0 veto | 919 / 58 | 172,341 | -134,341 | 0 | 38,000 | 28.90% | 60 |
| Below-VWAP veto | 913 / 57 | 170,623 | -135,405 | 0 | 35,219 | 33.43% | 60 |

### Longer / close-confirmed

| Setup | W / L | Winning $ | Losing $ | Unfinished episode $ | Net $ | DD | Forced closes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 788 / 60 | 190,819 | -171,329 | 0 | 19,490 | 45.65% | 63 |
| RSI >=70 veto | 795 / 59 | 189,779 | -163,798 | 0 | 25,981 | 42.01% | 62 |
| CRSI >=80 veto | 786 / 60 | 189,637 | -170,747 | 0 | 18,889 | 45.30% | 63 |
| ROC <=0 veto | 785 / 60 | 187,577 | -161,274 | 0 | 26,303 | 32.48% | 64 |
| Below-VWAP veto | 783 / 61 | 184,658 | -164,610 | 0 | 20,048 | 35.94% | 65 |

### Variant-minus-baseline decomposition

| Model | Veto | Winner income change $ | Loss savings $ | Unfinished mark change $ | Net change $ | TP cycle change | Forced-close change | Affected episodes |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Longer / close-confirmed | rsi_hot_d11 | -1,040 | +7,531 | 0 | +6,491 | +7 | -1 | 35 |
| Longer / close-confirmed | crsi_hot_d11 | -1,182 | +582 | 0 | -600 | -2 | 0 | 14 |
| Longer / close-confirmed | roc_weak_d11 | -3,242 | +10,055 | 0 | +6,813 | -4 | +1 | 148 |
| Longer / close-confirmed | below_vwap_d11 | -6,161 | +6,719 | 0 | +558 | -6 | +2 | 150 |
| Longer / resting-touch | rsi_hot_d11 | -1,021 | +147 | 0 | -873 | +2 | 0 | 28 |
| Longer / resting-touch | crsi_hot_d11 | +222 | +589 | 0 | +811 | +5 | 0 | 17 |
| Longer / resting-touch | roc_weak_d11 | -15,397 | +6,565 | 0 | -8,832 | -36 | +1 | 170 |
| Longer / resting-touch | below_vwap_d11 | -17,115 | +5,501 | 0 | -11,614 | -43 | +1 | 159 |
| Recent / close-confirmed | rsi_hot_d11 | -589 | -88 | 0 | -678 | -1 | 0 | 11 |
| Recent / close-confirmed | crsi_hot_d11 | -122 | -10 | 0 | -132 | 0 | 0 | 2 |
| Recent / close-confirmed | roc_weak_d11 | +1,811 | +1,715 | 0 | +3,526 | +2 | 0 | 39 |
| Recent / close-confirmed | below_vwap_d11 | -3,383 | +2,821 | -45 | -607 | -10 | 0 | 35 |
| Recent / resting-touch | rsi_hot_d11 | -558 | -162 | 0 | -721 | +1 | 0 | 6 |
| Recent / resting-touch | crsi_hot_d11 | 0 | +11 | -185 | -174 | 0 | 0 | 2 |
| Recent / resting-touch | roc_weak_d11 | -1,303 | +4,906 | 0 | +3,603 | +6 | 0 | 49 |
| Recent / resting-touch | below_vwap_d11 | -2,498 | +2,972 | 0 | +474 | +1 | +1 | 43 |


### The practical interpretation

- **Recent ROC / resting-touch:** winners rise 289 ->295, losses stay 10.
  The losing bill falls $33,009 ->$28,103 (14.86%), while winning income falls
  $56,072 ->$54,768. Net improves $3,603, but DD grows 2.25 percentage points.
  The remaining losses' timing relative to equity peaks still matters.
- **Recent ROC / close-confirmed:** winners rise 241 ->243, losses stay 11.
  Loss savings are only $1,715 (4.27%), with another $1,811 of winning income.
  DD falls only 0.56pp. This does not meet the stated bleeding-reduction bar.
- **Longer ROC / resting-touch:** $15,397 less winning income versus $6,565
  saved losses = $8,832 less net. There are 36 fewer TP cycles and one more
  forced close. This is the invisible recovery cost that a recent-only total
  would hide.
- **Below VWAP:** recent DD improves in both models, but recent close-confirmed
  profit falls $607. Longer resting-touch loses $11,614, sacrifices 43 TP cycles
  and worsens DD from 28.17% to 33.43%.
- **Hot RSI:** loses $678-$721 recently. Its longer close-confirmed gain is
  concentrated in February 2026 (+$10,638 monthly delta), while that whole
  longer run improves only $6,491. It is not uniform protection or replicated
  across TP assumptions.
- **Hot CRSI:** just two affected recent episodes per TP model. This is too
  sparse to establish a risk signal, and both recent net deltas are negative.

## Ranking and unchanged qualification screens

Ranked below by the **worse of the two recent profit deltas**, not by summing
overlapping histories or choosing the favorable TP model.

| Rank / rule | Recent resting delta $ | Recent close delta $ | Longer resting delta $ | Longer close delta $ | Worst monthly delta $ | Result |
|---|---:|---:|---:|---:|---:|---|
| 1. ROC <=0 | +3,603 | +3,526 | -8,832 | +6,813 | -5,283 | Fails risk, longer-window and month screens |
| 2. CRSI >=80 | -174 | -132 | +811 | -600 | -443 | Sparse; no meaningful loss reduction or profit lift |
| 3. Below VWAP | +474 | -607 | -11,614 | +558 | -6,304 | Inconsistent profit; recovery cost and DD regressions |
| 4. RSI >=70 | -721 | -678 | -873 | +6,491 | -1,910 | Sparse recently; model-dependent, recent losses slightly worse |

Profit screen inherited without retuning: at least 20 affected episodes in
each recent TP model; recent net improvement >=$1,000 and gross loss reduction
>=10% in both; no DD increase in any case; no longer-window net decline; no
monthly marked regression worse than $250.

Defensive screen: same sample minimum; recent gross loss reduction >=20%
and DD reduction >=3pp; retain >=90% of baseline profit in all four cases;
longer DD worsening <=0.5pp; no monthly marked regression worse than $500.

**No profit qualifier and no defensive qualifier.** Sample counts in the
decomposition are full-path variant episodes, not the number of baseline fills
that satisfy a condition. Both are reported and must not be interchanged.

## What actual deep adds tell us

The following is **unchanged-baseline attribution**, not counterfactual profit.
Each original rung's actual fill is followed through selected-ID partial/full
exits; final inventory is marked separately. Whole-ladder episode outcomes
remain separate labels because a profitable last rung can coexist with a
losing ladder. Skipping a profitable rung can also alter future episode paths.

| Period / TP model | All rung-11 fills | Timer-only fills / rung net $ | Price-drop fills / rung net $ |
|---|---:|---:|---:|
| Recent / resting-touch | 107 | 25 / 1,452 | 82 / 6,018 |
| Recent / close-confirmed | 100 | 23 / -3,180 | 77 / 8,223 |
| Longer / resting-touch | 377 | 113 / 4,728 | 264 / 10,620 |
| Longer / close-confirmed | 363 | 127 / 2,206 | 236 / 4,297 |

Recent baseline only: condition true at actual rung-11 fill decision. These conditions overlap.

| TP model | Condition | Rung fills | Rung W/L | Closed winning $ | Closed losing $ | Final mark $ | Distinct episodes |
|---|---|---:|---:|---:|---:|---:|---:|
| Close-confirmed | all_rung11 | 100 | 89/10 | 15,872 | -10,475 | -354 | 93 |
| Close-confirmed | rsi_hot_d11 | 12 | 11/1 | 1,964 | -718 | 0 | 12 |
| Close-confirmed | crsi_hot_d11 | 2 | 1/1 | 122 | -718 | 0 | 2 |
| Close-confirmed | roc_weak_d11 | 34 | 30/4 | 5,897 | -3,605 | 0 | 33 |
| Close-confirmed | below_vwap_d11 | 37 | 31/5 | 5,865 | -4,701 | -354 | 36 |
| Resting-touch | all_rung11 | 107 | 96/10 | 15,382 | -7,999 | 87 | 99 |
| Resting-touch | rsi_hot_d11 | 6 | 6/0 | 1,384 | 0 | 0 | 6 |
| Resting-touch | crsi_hot_d11 | 2 | 0/1 | 0 | -312 | 87 | 2 |
| Resting-touch | roc_weak_d11 | 52 | 43/9 | 7,099 | -7,687 | 0 | 48 |
| Resting-touch | below_vwap_d11 | 47 | 40/7 | 6,575 | -4,517 | 0 | 43 |

## Fixed-path cost sensitivity

| Model | Baseline net with extra 5bps/side $ | ROC-veto net with extra 5bps/side $ | ROC delta $ |
|---|---:|---:|---:|
| Longer / close-confirmed | -11,182 | -3,429 | 7,753 |
| Longer / resting-touch | 13,393 | 6,912 | -6,482 |
| Recent / close-confirmed | 8,650 | 11,914 | 3,265 |
| Recent / resting-touch | 12,998 | 16,769 | 3,771 |


Extra 5bps on every executed side and the final marked exit is a fixed-path
stress, not another execution replay. The baseline is shown too: some longer
close-confirmed totals become negative under that additional cost. ROC's recent
lift survives this particular stress; its longer resting-touch regression also
survives. This does not remove the core model/regime sensitivity.

### Attribution conclusions and limits

Recent genuine-drop rung-11 allocations were positive in both TP models.
Timer-only attribution is positive under resting-touch but negative under
close-confirmed. That is a model-sensitive distinction, not proof that every
timer add should be removed.

Hot-RSI baseline fills were mostly winners: recent resting-touch has 6/6
winning rungs; close-confirmed has 11 wins and one loss. In the longer controls,
hot-RSI allocated rung net is also positive: $3,532 resting / $3,983 close.
The simple "RSI overbought means the last add is bad" explanation is not
supported as a general rule here.

CRSI's recent baseline condition appears in only two fills per model, one
unfinished in resting-touch. Do not turn that into a strong conditional claim.
The richer ADX/ATR/RVOL fields are preserved for later work but were not fitted
into extra gates after seeing these outcomes.

A 1h indicator is deliberately slower than current price: it cannot identify
every minute-scale local top. This study did not test live intrahour features,
shorter indicator timeframes, resistance interactions or combinations. Those
remain separate hypotheses, not implicit explanations of this result.

## Month-by-month net and losing-cycle cost

All four variants are shown, not only the most favorable. Recent May/September
and longer August 2026 are partial months. Net tables are marked-equity changes;
loss tables allocate whole negative episodes to their final-close month.
Neither the loss column nor its delta should be subtracted from net again.
Monthly UTC grouping preserves the accepted canonical end-timestamp convention.


### Recent / resting-touch

Monthly marked-equity PnL; variant cells show net (delta versus baseline).

| UTC month | Baseline $ | RSI $ (delta) | CRSI $ (delta) | ROC $ (delta) | VWAP $ (delta) |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | 13,695 (+211) | 13,483 (0) | 12,793 (-690) | 12,395 (-1,089) |
| 2026-06 | 1,584 | 984 (-600) | 1,584 (0) | 3,622 (+2,038) | 2,478 (+894) |
| 2026-07 | -3,950 | -3,950 (0) | -3,939 (+11) | -2,625 (+1,325) | -3,106 (+844) |
| 2026-08 | 9,684 | 9,352 (-332) | 9,684 (0) | 10,701 (+1,017) | 9,666 (-19) |
| 2026-09 | 1,959 | 1,959 (0) | 1,773 (-185) | 1,871 (-88) | 1,802 (-157) |

Monthly losing-episode dollars (number of losing episodes); not net equity change.

| UTC month | Baseline loss $ (n) | RSI loss $ (n) | CRSI loss $ (n) | ROC loss $ (n) | VWAP loss $ (n) |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| 2026-06 | -24,396 (5) | -24,396 (5) | -24,396 (5) | -20,941 (5) | -21,956 (5) |
| 2026-07 | -8,542 (4) | -8,542 (4) | -8,531 (4) | -7,091 (4) | -8,009 (4) |
| 2026-08 | -71 (1) | -234 (1) | -71 (1) | -71 (1) | -71 (1) |
| 2026-09 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |

### Recent / close-confirmed

Monthly marked-equity PnL; variant cells show net (delta versus baseline).

| UTC month | Baseline $ | RSI $ (delta) | CRSI $ (delta) | ROC $ (delta) | VWAP $ (delta) |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | 17,035 (-95) | 17,008 (-122) | 17,466 (+335) | 15,908 (-1,223) |
| 2026-06 | -2,243 | -2,398 (-155) | -2,243 (0) | -3,738 (-1,494) | -1,756 (+487) |
| 2026-07 | -7,858 | -7,771 (+87) | -7,868 (-10) | -6,629 (+1,229) | -7,378 (+480) |
| 2026-08 | 10,239 | 9,723 (-515) | 10,239 (0) | 14,192 (+3,954) | 9,932 (-307) |
| 2026-09 | 201 | 201 (0) | 201 (0) | -297 (-498) | 156 (-45) |

Monthly losing-episode dollars (number of losing episodes); not net equity change.

| UTC month | Baseline loss $ (n) | RSI loss $ (n) | CRSI loss $ (n) | ROC loss $ (n) | VWAP loss $ (n) |
|---|---:|---:|---:|---:|---:|
| 2026-05 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |
| 2026-06 | -26,870 (6) | -26,870 (6) | -26,870 (6) | -26,385 (6) | -24,057 (6) |
| 2026-07 | -13,167 (4) | -13,177 (4) | -13,177 (4) | -11,937 (4) | -13,160 (4) |
| 2026-08 | -155 (1) | -234 (1) | -155 (1) | -155 (1) | -155 (1) |
| 2026-09 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |

### Longer / resting-touch

Monthly marked-equity PnL; variant cells show net (delta versus baseline).

| UTC month | Baseline $ | RSI $ (delta) | CRSI $ (delta) | ROC $ (delta) | VWAP $ (delta) |
|---|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | 2,563 (-105) | 2,856 (+188) | 807 (-1,861) | -3,636 (-6,304) |
| 2025-08 | 561 | 228 (-333) | 498 (-63) | -591 (-1,152) | -715 (-1,276) |
| 2025-09 | 5,608 | 5,528 (-81) | 5,608 (0) | 4,811 (-797) | 5,392 (-216) |
| 2025-10 | 7,325 | 7,325 (0) | 7,325 (0) | 4,835 (-2,490) | 5,677 (-1,648) |
| 2025-11 | -1,443 | -1,443 (0) | -1,443 (0) | -530 (+913) | -1,416 (+27) |
| 2025-12 | -509 | -509 (0) | -523 (-14) | 338 (+848) | 406 (+915) |
| 2026-01 | -246 | -246 (0) | 207 (+453) | 414 (+660) | 561 (+807) |
| 2026-02 | 4,940 | 4,733 (-207) | 4,957 (+17) | 5,245 (+305) | 3,748 (-1,192) |
| 2026-03 | 11,159 | 11,159 (0) | 11,159 (0) | 5,877 (-5,283) | 9,212 (-1,948) |
| 2026-04 | 2,065 | 2,283 (+219) | 2,283 (+218) | 1,608 (-457) | 2,605 (+540) |
| 2026-05 | 15,753 | 15,987 (+234) | 15,753 (0) | 12,970 (-2,783) | 12,634 (-3,119) |
| 2026-06 | 1,584 | 984 (-600) | 1,584 (0) | 3,622 (+2,038) | 2,478 (+894) |
| 2026-07 | -3,950 | -3,950 (0) | -3,939 (+11) | -2,625 (+1,325) | -3,106 (+844) |
| 2026-08 | 1,317 | 1,317 (0) | 1,317 (0) | 1,220 (-98) | 1,379 (+61) |

Monthly losing-episode dollars (number of losing episodes); not net equity change.

| UTC month | Baseline loss $ (n) | RSI loss $ (n) | CRSI loss $ (n) | ROC loss $ (n) | VWAP loss $ (n) |
|---|---:|---:|---:|---:|---:|
| 2025-07 | -13,473 (15) | -13,327 (15) | -13,328 (15) | -13,093 (15) | -17,575 (16) |
| 2025-08 | -15,251 (4) | -15,251 (4) | -15,251 (4) | -15,088 (4) | -12,317 (3) |
| 2025-09 | -7,001 (4) | -7,000 (4) | -7,001 (4) | -6,826 (4) | -6,691 (4) |
| 2025-10 | -11,114 (5) | -11,114 (5) | -11,114 (5) | -10,482 (5) | -10,482 (5) |
| 2025-11 | -5,521 (3) | -5,521 (3) | -5,521 (3) | -4,288 (3) | -5,196 (3) |
| 2025-12 | -5,660 (2) | -5,660 (2) | -5,674 (2) | -4,850 (2) | -4,850 (2) |
| 2026-01 | -12,219 (5) | -12,219 (5) | -11,773 (5) | -10,918 (5) | -10,921 (5) |
| 2026-02 | -13,900 (3) | -13,900 (3) | -13,900 (3) | -12,892 (3) | -12,848 (3) |
| 2026-03 | -1,725 (1) | -1,725 (1) | -1,725 (1) | -10,267 (2) | -1,795 (1) |
| 2026-04 | -17,385 (4) | -17,385 (4) | -17,385 (4) | -11,599 (4) | -16,821 (4) |
| 2026-05 | -4,718 (2) | -4,718 (2) | -4,718 (2) | -6,006 (2) | -5,943 (2) |
| 2026-06 | -24,396 (5) | -24,396 (5) | -24,396 (5) | -20,941 (5) | -21,956 (5) |
| 2026-07 | -8,542 (4) | -8,542 (4) | -8,531 (4) | -7,091 (4) | -8,009 (4) |
| 2026-08 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |

### Longer / close-confirmed

Monthly marked-equity PnL; variant cells show net (delta versus baseline).

| UTC month | Baseline $ | RSI $ (delta) | CRSI $ (delta) | ROC $ (delta) | VWAP $ (delta) |
|---|---:|---:|---:|---:|---:|
| 2025-07 | -3,050 | -3,137 (-87) | -3,474 (-424) | -3,400 (-350) | -3,095 (-46) |
| 2025-08 | 1,420 | -266 (-1,686) | 978 (-443) | 1,724 (+303) | 1,957 (+537) |
| 2025-09 | 6,247 | 6,102 (-145) | 6,325 (+78) | 5,168 (-1,079) | 5,164 (-1,083) |
| 2025-10 | 7,167 | 7,259 (+92) | 7,167 (0) | 8,143 (+976) | 6,521 (-645) |
| 2025-11 | -688 | -688 (0) | -688 (0) | -846 (-157) | -1,018 (-329) |
| 2025-12 | 673 | 673 (0) | 673 (0) | 942 (+269) | 759 (+86) |
| 2026-01 | -8,750 | -8,730 (+19) | -8,220 (+530) | -4,046 (+4,703) | -2,765 (+5,985) |
| 2026-02 | -6,255 | 4,383 (+10,638) | -6,255 (0) | -2,787 (+3,468) | -5,129 (+1,126) |
| 2026-03 | 12,689 | 12,865 (+177) | 12,689 (0) | 9,030 (-3,658) | 8,057 (-4,632) |
| 2026-04 | 2,401 | 2,159 (-242) | 2,192 (-210) | 2,446 (+44) | 2,850 (+448) |
| 2026-05 | 15,721 | 13,811 (-1,910) | 15,598 (-122) | 18,237 (+2,516) | 13,833 (-1,888) |
| 2026-06 | -2,243 | -2,398 (-155) | -2,243 (0) | -3,738 (-1,494) | -1,756 (+487) |
| 2026-07 | -7,858 | -7,771 (+87) | -7,868 (-10) | -6,629 (+1,229) | -7,378 (+480) |
| 2026-08 | 2,017 | 1,719 (-298) | 2,017 (0) | 2,058 (+41) | 2,050 (+33) |

Monthly losing-episode dollars (number of losing episodes); not net equity change.

| UTC month | Baseline loss $ (n) | RSI loss $ (n) | CRSI loss $ (n) | ROC loss $ (n) | VWAP loss $ (n) |
|---|---:|---:|---:|---:|---:|
| 2025-07 | -19,614 (16) | -19,468 (16) | -19,468 (16) | -18,857 (16) | -19,024 (16) |
| 2025-08 | -12,589 (3) | -12,589 (3) | -12,589 (3) | -12,709 (3) | -12,710 (3) |
| 2025-09 | -6,719 (4) | -7,076 (4) | -6,719 (4) | -6,704 (4) | -6,377 (4) |
| 2025-10 | -11,049 (5) | -11,049 (5) | -11,049 (5) | -8,455 (5) | -11,895 (5) |
| 2025-11 | -5,428 (3) | -5,428 (3) | -5,428 (3) | -4,959 (3) | -5,104 (3) |
| 2025-12 | -5,331 (2) | -5,331 (2) | -5,331 (2) | -5,224 (2) | -4,771 (2) |
| 2026-01 | -21,883 (6) | -21,883 (6) | -21,437 (6) | -18,105 (6) | -17,240 (6) |
| 2026-02 | -22,238 (4) | -13,585 (3) | -22,238 (4) | -21,329 (4) | -21,373 (4) |
| 2026-03 | -1,340 (1) | -1,340 (1) | -1,340 (1) | -3,199 (1) | -4,488 (2) |
| 2026-04 | -17,882 (4) | -17,882 (4) | -17,882 (4) | -17,871 (4) | -16,888 (4) |
| 2026-05 | -7,219 (2) | -8,119 (2) | -7,219 (2) | -5,540 (2) | -7,525 (2) |
| 2026-06 | -26,870 (6) | -26,870 (6) | -26,870 (6) | -26,385 (6) | -24,057 (6) |
| 2026-07 | -13,167 (4) | -13,177 (4) | -13,177 (4) | -11,937 (4) | -13,160 (4) |
| 2026-08 | 0 (0) | 0 (0) | 0 (0) | 0 (0) | 0 (0) |


The recent ROC story is not simply "June/July rescued." Under close-confirmed,
June net actually deteriorates by $1,494 even while its losing-episode bill
improves slightly; August contributes +$3,954 of the +$3,526 total improvement.
In the longer resting model, March 2026 costs another $5,283. Concentration and
missed winning income matter as much as gross loss savings.

## Causality trace and verification

Example: **July 1, 2025, 14:27 UTC**, otherwise-eligible genuine-drop rung 11,
decision price $38.949. The adapter selects the completed **13:00-14:00** bar,
close **$39.011**, day VWAP **$39.0569233765**. The below-VWAP condition is true.
The forming 14:00-15:00 candle does not contribute to this decision. The prior
RSI/CRSI/ROC readings at that point are 43.9400 / 23.3367 / +0.7568%, so those
other three vetoes are false. The full source tape and a prefix ending at the
decision produce the same context.

In the below-VWAP variant this add is vetoed: no exchange-like pending order
or retrospective fill is created. A later add would need fresh baseline
eligibility plus a clear condition, and would fill the subsequent minute open.
The example is a timing trace, not a hindsight profitable-trade claim.

Validation passed:

- Four corrected transactional-clock full-result digests and all summary metrics
  match the accepted sizing baselines before any variants.
- Eleven new independent policy/timing groups, including null-versus-zero,
  boundary inclusivity, family isolation, future/stale/corrupt contexts and
  fixed-seed prefix invariance.
- Seven real-data feature-prefix checks, including actual deep-add decisions.
- Independent artifact verification rebuilt hourly RSI/CRSI/ROC/VWAP directly
  from repaired minutes, without importing the new indicator implementation or
  veto evaluator. It checked 261,109 decisions against literal frozen rules.
- Inventory-only replay independently reconstructed fees, whole-episode and
  rung PnL, actual permissions, unchanged geometric sizes, selected-ID partial
  allocations, preserved add clock, drawdown and monthly equity.
- Source/input/artifact hashes stayed unchanged; existing replay causality,
  current-stack and sizing regressions and both TypeScript builds pass.

Independent accounting does not independently re-run every outer-gate/exit
decision or certify exchange fills; those remain canonical-engine/model
boundaries. Baseline cohort grouping/rankings are not separately regenerated
by the verifier. Exact rung labels and individual decisions are verified.
Audit counts include overlapping windows/model repeats, not independent trials.

## Disposition and evidence pointers

**Stage 3 complete; retain current live config.** Record these exact four
definitions as failed robust-upgrade screens, without saying all indicators
are useless or every conceivable rung-11 rule has been tested. No automatic
stage 4/5 combination sweep, deployment, commit or push.

Accepted local evidence:
`backtests/hype/hype-ladder-single-indicator-2026-09-05/`.
Read `manifest.json`, `validation.json`, `verification.json`,
`baseline.json`, `results.json`, `ranking.json`, `summary.csv`,
`monthly.json`/`monthly.csv`, and `baseline-cohorts.json`.
Per-case `*-decisions.jsonl`, `*-inventory.jsonl` and `*-month-marks.json`
support reconstruction. Baseline `*-features.jsonl` and `*-outcomes.jsonl`
separate inputs from future labels; `*-causal-trace.json` records real examples.

Source, tests, frozen definitions and findings are allowlisted for Git.
Generated evidence and raw inputs remain local. Register this as **L07** in
[the tested-setup inventory](TESTED-SETUPS.md), not another I01 standalone trade
or a rerun of the 34 older-clock ladder definitions.
