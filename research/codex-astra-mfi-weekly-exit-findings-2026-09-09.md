# F04: full replay of MFI half-exits with weekly-VWAP context

## TL;DR

- **The refinement improves full-period net in both TP models.** Published touch: current B17 **$46,832**, original MFI-half **$44,570**, weekly-filtered **$48,825**. Published confirmed: **$19,490 / $23,832 / $26,590**. Weekly context avoids four costly older cuts per model; actual full replay confirms F03's contribution estimates to floating-point precision.
- **Recent results are unchanged, and the full screen still fails.** May17-Sep8 weekly-half earns **$24,303 touch / $20,893 confirmed**, versus B17 **$20,914 / $15,839**. But published touch DD is **29.85% versus baseline28.17%**, and five older touch months plus one confirmed month are more than$250 worse. **0/1 new variants qualifies; no live change.**
- **28 fresh runs,16 exact controls, one new definition.** Four B17 and12 original-MFI controls reproduce F02 exactly before new variants;432 context-clock checks match F03. Independent verification covers **159,786 fills /10,660,132 minute marks /1,519 raw MFI /150 weekly-VWAP/ROC reconstructions**. Source60s leaves results unchanged; fill60s preserves the broad result and its failures. Fees stay0.055% per side.

## Exact configuration, periods and limitations

This is the user-approved three-case **full-path replay**, not a new parameter search and not an attribution-only estimate. Baseline is the same accepted **current B17 long stack**, not the bare ladder or an older optimistic simulator: flat$32,000 start, $800 x1.35/max11, current modeled entry/gate/SR/damaged-regime/ordinary-exit logic retained. No shared-account shorts.

| Period | Start UTC | End UTC |
|---|---|---|
| Published history | 2025-07-01 00:00 | 2026-08-19 21:32 |
| Recent HL window | 2026-05-17 20:43 | 2026-09-08 17:47 |

Each model/window starts independently flat. They overlap; do not pool outcomes, add gains across models or subtract window totals to create another period. Resting-touch and close-confirmed TP are execution assumptions, not certified maker outcomes or guaranteed bounds. This uses the same frozen data as F02/F03, not a new live-data refresh.

The three setups:

1. **Current B17:** no experimental cut.
2. **Original MFI-half:** first completed minute at depth>=9/gross inventory PnL<=-3% starts a timer. Exactly+60m, same episode still depth>=9 and completed30m MFI14<=20 permits a pro-rata50% cut. No second PnL threshold and no later retry. After an actual cut, no more adds that episode; ordinary exits remain.
3. **Weekly-filtered MFI-half:** identical, plus the exact F03 C3 condition: latest completed1h close **below UTC-week VWAP**, with **five-hour ROC<=0**. VWAP uses actual turnover/base volume from Monday00:00UTC through that closed hour. Strict below-VWAP, inclusive ROC comparison. Missing context rejects only the experimental action. A rejected cut does not lock future adds or change ordinary TP/exits.

ROC was already negative in all F03 selected examples; weekly VWAP is the observed discriminator, not evidence of independent ROC synergy. No extra HL condition, ADX inversion, threshold expansion, timing sweep or strategy reconfiguration was added.

Fees are unchanged **0.055% per entry/exit side**, allocated once pro rata. Funding settlements, maker queue/fill modeling and maintenance-margin liquidation are excluded. Experimental cuts fill at the next minute open, with another 60s order delay tested separately; ordinary exits retain their original execution assumptions and priority.

## Wins, losses and dollars side by side

W/L means **completed episode net including all partials**. Winning and losing dollars are those completed episodes, not just the final close fill. Net also includes final open inventory; all recent paths retain the same **-$3,207 open mark** and no material unfinished partial PnL. Published paths end flat. Values rounded to dollars; tiny rounding differences are not additional trades.

### Published history: July2025-August19,2026

| TP model | Setup | Wins / losses | Winning dollars | Losing dollars | Net | Delta B17 | Max DD |
|---|---|---:|---:|---:|---:|---:|---:|
| Touch | Current B17 | 955 / 57 | $187,738 | -$140,906 | $46,832 | -- | 28.17% |
| Touch | Original MFI-half | 942 / 70 | $184,460 | -$139,890 | $44,570 | -$2,262 | 31.97% |
| Touch | Weekly-filtered half | 946 / 66 | $185,487 | -$136,662 | $48,825 | +$1,993 | 29.85% |
| Confirmed | Current B17 | 788 / 60 | $190,819 | -$171,329 | $19,490 | -- | 45.65% |
| Confirmed | Original MFI-half | 781 / 67 | $188,739 | -$164,907 | $23,832 | +$4,342 | 45.23% |
| Confirmed | Weekly-filtered half | 784 / 64 | $189,789 | -$163,199 | $26,590 | +$7,100 | 40.79% |

Versus original MFI-half, weekly context adds **$4,255 touch / $2,758 confirmed** and improves DD under both assumptions. Versus current B17, it reduces losing-episode dollars **$4,244 touch / $8,130 confirmed**, but sacrifices **$2,251 / $1,030** in winning-episode dollars. Net improvement is their difference; the recovery cost has not disappeared.

Published touch minimum equity remains$30,236 under all three setups despite the DD differences. Confirmed minimum equity is$27,028 B17 /$27,211 original half /$27,920 weekly half. Max DD is a peak-to-trough measure, not loss from starting capital.

### Recent HL window: May17-September8,2026

| TP model | Setup | Wins / losses | Winning dollars | Losing dollars | Net incl.open | Delta B17 | Max DD |
|---|---|---:|---:|---:|---:|---:|---:|
| Touch | Current B17 | 295 / 10 | $57,130 | -$33,009 | $20,914 | -- | 24.69% |
| Touch | Original MFI-half | 292 / 13 | $56,417 | -$28,906 | $24,303 | +$3,389 | 20.06% |
| Touch | Weekly-filtered half | 292 / 13 | $56,417 | -$28,906 | $24,303 | +$3,389 | 20.06% |
| Confirmed | Current B17 | 243 / 11 | $59,238 | -$40,192 | $15,839 | -- | 31.11% |
| Confirmed | Original MFI-half | 243 / 11 | $59,238 | -$35,138 | $20,893 | +$5,054 | 26.08% |
| Confirmed | Weekly-filtered half | 243 / 11 | $59,238 | -$35,138 | $20,893 | +$5,054 | 26.08% |

Weekly context vetoes **none** of the6 touch/4 confirmed recent interventions. It preserves both the recent benefit and the recent mistakes. This is an older cross-period refinement, not a new improvement to the most recent window.

## Actual episode attribution: what is saved and what is sacrificed?

Actual entry identities, ordinary TP counts and forced-close counts remain unchanged across the primary controls and filtered runs. No replacement or removed episodes; no ending-inventory difference explains the gain. All delta is within matched episodes through the selective quantity reduction. These are findings of the full replay, not assumptions borrowed from F03.

| Window / TP | Weekly half helpful / harmful cuts | Benefit from helpful cuts | Cost of harmful cuts | Actual net gain B17 |
|---|---:|---:|---:|---:|
| Published / touch | 9 / 9 | $11,339 | -$9,347 | +$1,993 |
| Published / confirmed | 9 / 5 | $12,288 | -$5,188 | +$7,100 |
| Recent / touch | 3 / 3 | $6,009 | -$2,619 | +$3,389 |
| Recent / confirmed | 3 / 1 | $5,471 | -$417 | +$5,054 |

Primary weekly cuts total42 overlapping model/window observations at26 distinct checkpoint times. They are not42 independent events. The original half makes22/18 cuts in published touch/confirmed; weekly makes18/14. Recent6/4 counts are unchanged. The independent source-lag/fill-lag cases are not new independent trades either.

| Window / TP | B17 TP cycles / forced closes | Weekly half TP cycles / forced closes | Added / removed entry episodes |
|---|---:|---:|---:|
| Published / touch | 953 / 59 | 953 / 59 | 0 / 0 |
| Published / confirmed | 785 / 63 | 785 / 63 | 0 / 0 |
| Recent / touch | 295 / 10 | 295 / 10 | 0 / 0 |
| Recent / confirmed | 242 / 12 | 242 / 12 | 0 / 0 |

**This reduces damage on some flattens; it does not remove those flatten events.** A remainder can still hit the same ordinary forced close. TP-cycle count likewise does not mean all those episodes remain profitable after an earlier loss-cut.

### Causal decision traces

- **Correctly rejected older cut, Sep11,2025 12:27UTC:** MFI30m10.398 from the bar ending12:00. Latest completed1h close$53.59 versus weekly VWAP$52.953945, **+1.201% above**; five-hour ROC-3.360%. Weekly context rejects the cut and never retries that episode's checkpoint. It uses only the week through12:00, not the current developing hour or the eventual weekly close. This preserves the recovery that the old half-cut had sacrificed.
- **Remaining harmful cut, Jun2,2026 10:47UTC touch:** MFI17.835 from10:30; hourly close$70.834 from10:00 versus weekly VWAP$72.892008, -2.823%, ROC-3.880%. It passes even though gross ladder PnL has recovered from-3.249% at first distress to-2.309%. At the **next minute open**, half of816.1818qty is sold at$71.525; fill index is one later than decision index. The subsequent episode nets **-$606 instead of baseline+$233**, a cost of$839. It still sits below weekly VWAP; this slower regime reference does not identify every intra-hour recovery.

The decision timestamp and next-open fill timestamp can be the same UTC epoch: the former is the ending boundary of one bar, the latter the opening boundary of the next. The audited fill index is strictly later; the just-observed close, eventual fill-bar low/high/close and future volume do not select the execution price.

## Every month against its unchanged baseline

All values USD, rounded. **Baseline columns are absolute MTM PnL. Original-half and weekly-half columns are deltas versus that same baseline.** These are actual re-simulated monthly equity changes, unlike F03's descriptive subset contributions. First/last months are partial according to run endpoints.

### Published history

| Month | Touch B17 | Touch original half delta | Touch weekly half delta | Confirmed B17 | Confirmed original half delta | Confirmed weekly half delta |
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

### Recent HL window

| Month | Touch B17 | Original half delta | Weekly half delta | Confirmed B17 | Original half delta | Weekly half delta |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05, partial | $13,483 | $0 | $0 | $17,131 | $0 | $0 |
| 2026-06 | $1,584 | +$2,061 | +$2,061 | -$2,243 | +$5,047 | +$5,047 |
| 2026-07 | -$3,950 | +$1,329 | +$1,329 | -$7,858 | +$7 | +$7 |
| 2026-08 | $9,684 | $0 | $0 | $10,239 | $0 | $0 |
| 2026-09, partial | $112 | $0 | $0 | -$1,429 | $0 | $0 |

No monthly failure is removed from the screen because another month compensates. Full monthly **completed episode W/L and winning/losing dollars for all three setups**, plus every latency case, are saved in [tables](../backtests/hype/hype-mfi-weekly-exit-2026-09-09/tables.md), [primary W/L CSV](../backtests/hype/hype-mfi-weekly-exit-2026-09-09/primary-monthly-wl.csv) and [all-case monthly CSV](../backtests/hype/hype-mfi-weekly-exit-2026-09-09/monthly.csv). Those episode dollars use the final-close month; MTM also includes open exposure.

## Delay, costs and selection stability

Additional60s publication lag on **both** MFI and hourly weekly-VWAP/ROC leaves all filtered results, cuts and vetoes unchanged. This establishes only this clock sensitivity on this sample; it is not proof of real-time arrival or new out-of-sample evidence.

| Window / TP | B17 net / DD | Weekly primary net / DD | Weekly extra60s fill delay net / DD |
|---|---|---|---|
| Published / touch | $46,832 / 28.17% | $48,825 / 29.85% | $48,693 / 29.91% |
| Published / confirmed | $19,490 / 45.65% | $26,590 / 40.79% | $26,653 / 40.71% |
| Recent / touch | $20,914 / 24.69% | $24,303 / 20.06% | $24,356 / 20.10% |
| Recent / confirmed | $15,839 / 31.11% | $20,893 / 26.08% | $20,863 / 26.10% |

Cut counts and weekly veto counts stay fixed in these delayed runs. Monthly results for all sensitivities remain stored, not just final totals. Normal protections can supersede a delayed experimental intent; this priority is regression-tested.

Fixed-path extra5bps per entry/exit side leaves weekly-versus-B17 net improvements at approximately **$1,992/$7,097 published touch/confirmed**, and **$3,388/$5,051 recent**. It does not rescue the old touch DD/monthly failures. No extra cost benefit or maker-fee credit is assumed.

All recent cuts still occur in June/early July, none after July13. No new intervention on the September deep episode: original MFI28.41 misses the frozen<=20 requirement. No MFI threshold expansion was made to fit it. Already-mined P01/F02/F03 history is not an untouched validation set.

## Verdict and retained research result

Frozen screen: recent improvement>=$1,000 in both TP models; published improvement>=0; no DD increase; no month worse than baseline by more than$250; no modeled insolvency. All conditions must pass; no threshold is changed after results.

| Candidate | What passes | What fails | Verdict |
|---|---|---|---|
| Original MFI-half, control | Both recent net/DD/monthly; published confirmed net/DD | Published touch net/DD; older monthly failures in both models | Still not qualified |
| Weekly-filtered MFI-half, only new variant | Net improvement in all four paths; recent DD/monthly; published confirmed DD; source/fill robustness; no modeled zero equity | Published touch DD **+1.68pp**; five touch months worse by>$250; confirmed May2026 worse by$1,147 | **Better research lead, not a live upgrade** |

The exact rejected touch months are Jul2025, Aug2025, Jan2026, Mar2026 and May2026. This is not a claim the new rule is unprofitable: it improves full-period net under both TP assumptions. It fails the agreed robustness conditions for replacing the calibrated baseline.

**Weekly context is now economically verified as an improvement over original MFI-half, not merely an attribution idea.** Keep it as the stronger reference if this research continues. The remaining unresolved mechanism is the recovery that occurs while price is still below weekly VWAP; that is where the remaining harmful cuts sit. No additional rules were searched or implemented in this pass. A later separately frozen experiment and forward observation would be needed before live promotion.

## Verification and files

- 28 fresh full-path runs; 16 exact archived F02 controls, including 4 canonical B17 digests; 432 primary/delayed F03 context comparisons before new economic runs. No replay engine or original F02 policy modifications.
- Independent raw checks: **159,786 fills,10,660,132 minute marks,1,519 MFI reconstructions,150 weekly-context reconstructions,276 experimental fills across overlapping sensitivity cases**. Weekly VWAP and ROC rebuilt from raw minutes; actual next-open price/quantity/fee/last-add clocks and no-rebuild behavior audited.
- The independently recomputed filtered economic deltas match F03's projected selected-episode contribution to<1e-6 in every model. The match is established after replay, not substituted for replay. Source/ledger/artifact hashes and protected live config/state remain unchanged.
- Tests: F04 boundaries, Monday rollover, source delay, zero/incomplete/gapped context, equality, prefix/future mutation, controller identity, one-shot veto, next-open partial and emergency priority; F02 unit/integration; closed-bar timing; VWAP/volume; current-stack and replay-causality suites. Normal, VPS and explicit research typechecks passed; `git diff --check` passed.
- No live/config/state changes, commit, push or VPS action. No exact maker, funding settlement, margin-liquidation or shared-account certification.

[Frozen card](../research-inputs/mfi-weekly-exit-2026-09-09.json) · [method and reproduction](../docs/research/mfi-weekly-exit.md) · [runner](../scripts/hype-mfi-weekly-exit-study.ts) · [independent checker](../scripts/mfi-weekly-exit-check.ts).

Accepted local output: `backtests/hype/hype-mfi-weekly-exit-2026-09-09/`. Includes complete tables,28 case ledgers/observations/summaries, actual execution traces, monthly results, baseline/original-half comparisons, F03 prediction comparison, ranking, immutable manifests and verification hashes.
