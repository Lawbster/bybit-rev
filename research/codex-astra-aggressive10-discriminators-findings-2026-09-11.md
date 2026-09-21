# AG10-D1: aggressive 10h lead and selective-permission diagnostics

Date: September 11, 2026. Status: **LEAD_RESEARCH; tuner economics not yet tested.**

## TL;DR

- Aggressive 10h is now the user-selected research lead, with B17 and guarded 10h retained as controls. Reaccounted **12 archived paths**; no new economic replay, live configuration change, or monthly-screen waiver.
- Examined **8 frozen descriptors**, two separate permission scopes and two source cutoffs: **1,511 first-permission observations / 3,022 feature rows / 1,285 model-qualified episode IDs**. Below-session-VWAP plus negative hourly momentum is the clearest deep timer-add discrimination lead. Broad hot-TP reopen restrictions and raw HL-selling vetoes have substantial visible winner costs.
- The two permission scopes cover only **47.8% of recent touch losing dollars and 30.6% of recent confirmed losing dollars**. Several large June pullback losses never use either extra permission. Improving this tuner alone cannot be assumed to solve those losses.

## 1. Exact parent, controls, periods and accounting

[Candidate identity](AGGRESSIVE-10H-CANDIDATE.md) and [frozen diagnostic card](../research-inputs/aggressive10-discriminators-2026-09-11.json).

Lead policy: `age10__minus_deep_stress__minus_tp_cooldown`, from accepted L15 job
`0b999800c49f7cf869e370252e1f95caaa879e396febb8eb06a65506c11781a9`.

It combines the 10h soft-stale deferral and separate age-4h/two-day-high exit with removal of the deep negative-funding timer guard and hot-RSI post-TP cooldown. All other original gates, S/R exceptions/partials and safety exits remain in the parent. This is not a mandatory 10h hold or an automatic 10h close.

- Recent: **May 17, 2026 20:43 UTC through September 10, 2026 05:08 UTC**.
- Older: **July 1, 2025 00:00 UTC through August 19, 2026 21:32 UTC**.
- Each replay starts flat with **$32,000**, $800 x1.35 maximum 11 rungs; fixed **0.055% fees per side**.
- Resting-touch and close-confirmed are separate TP execution assumptions, not two independent datasets or actual maker fill certification.
- Windows overlap. Recent/older/model observations must not be pooled into an independent sample count.
- Total marked net includes terminal open inventory; winning/losing dollars concern completed episodes, including their partial exits. Their sum can differ from marked net. These are research-stack results, not reconstructed live account returns.
- No actual maker-fee overlay, funding-cashflow certification, liquidation certification or shared-account short overlay is added here.

### Whole-policy baselines, unchanged

### Recent / touch

| Setup | Wins / losses | Winning dollars | Losing dollars | Total marked net | Max DD |
|---|---:|---:|---:|---:|---:|
| B17 unchanged baseline | 295/10 | $57,130 | -$33,009 | $20,887 | 24.69% |
| Guarded 10h | 229/13 | $61,971 | -$25,546 | $36,542 | 24.22% |
| Aggressive 10h lead | 242/16 | $68,731 | -$27,948 | $40,783 | 20.39% |

### Recent / confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars | Total marked net | Max DD |
|---|---:|---:|---:|---:|---:|
| B17 unchanged baseline | 243/11 | $59,238 | -$40,192 | $15,812 | 31.11% |
| Guarded 10h | 196/14 | $67,463 | -$32,741 | $34,839 | 27.64% |
| Aggressive 10h lead | 215/13 | $77,533 | -$30,610 | $46,922 | 25.68% |

### Older / touch

| Setup | Wins / losses | Winning dollars | Losing dollars | Total marked net | Max DD |
|---|---:|---:|---:|---:|---:|
| B17 unchanged baseline | 955/57 | $187,738 | -$140,906 | $46,832 | 28.17% |
| Guarded 10h | 756/69 | $198,212 | -$130,431 | $67,781 | 24.67% |
| Aggressive 10h lead | 765/75 | $210,530 | -$148,896 | $61,635 | 25.09% |

### Older / confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars | Total marked net | Max DD |
|---|---:|---:|---:|---:|---:|
| B17 unchanged baseline | 788/60 | $190,819 | -$171,329 | $19,490 | 45.65% |
| Guarded 10h | 644/68 | $195,909 | -$155,527 | $40,382 | 27.32% |
| Aggressive 10h lead | 670/67 | $220,017 | -$155,052 | $64,976 | 30.17% |

The same original net, DD and monthly totals were checked, not replaced by a new baseline. Full monthly MTM deltas remain in [L15 economics](codex-astra-age10-gate-factorial-findings-2026-09-11.md). Aggressive 10h improves B17 aggregate net/DD in all four cases, but **does not dominate guarded 10h in all four**. In particular, older touch net trails guarded by about $6,147 and losing dollars are about $18,465 larger.

The previous complete monthly screen still fails: for example, older touch February 2026 net is approximately -$2,829 versus B17 +$4,940. Research priority is not deployment approval.

## 2. What was actually unexplored

Prior L10-L12 high-proximity work mostly addressed broad ladder-construction permissions near rolling highs. This pass asks a narrower, different question: **which uses of the aggressive parent's two additional permissions are associated with useful versus costly ladders?**

The new high-memory descriptor can remain active after price has moved away from the high. VWAP/ROC and hourly structure are not newly invented indicators; their application to this exact extra-permission population is the new diagnostic. Fast/slow HL pressure is direction-aware: increasing buying and increasing selling are not treated as equivalent momentum.

Two scopes are kept separate:

1. **Hot reopen:** the rung-1 entry is inside the archived original hot-RSI post-TP cooldown.
2. **Deep timer:** the first entry that the original deep funding guard would actually block, **after** its existing S/R support-reopen exception. It is not a genuine price-drop add. Assert next depth >=6, archived deep-block flag true, price-drop permission false, and support exception false.

Each ladder contributes at most one observation **per scope**. A ladder can qualify for both, so the scopes cannot be summed as independent profit buckets. An unfinished ladder remains labelled unfinished, not a zero-profit win.

### Eight frozen descriptors

| ID | Direction | Decision-time definition |
|---|---|---|
| near_high_weak_hour | Restraint hypothesis | Closed minute within 1% of trailing 2-day high; last completed 1h return <0 |
| remembered_high_break | Restraint hypothesis | Most recent completed 1h high test within prior 6h, within 1% of its then-known 2-day high; two subsequent completed 15m closes below that hour's low |
| below_session_vwap_negative_roc | Restraint hypothesis | Last completed 1h close below that hour's UTC-session VWAP through its close; completed 1h return <0 |
| lower_hour_structure | Restraint hypothesis | Last completed hour has lower high than preceding hour and closes below preceding hour's low |
| hot_high_chase | Restraint hypothesis | Prior actual TP RSI >=70; reopen within 10min; closed price >=actual TP fill and within 1% of 2-day high |
| flow_deterioration | Restraint hypothesis | Healthy HL15 ratio <0.9, below HL1h ratio, and no higher than HL15 ratio observed 15min earlier |
| flow_book_sell | Restraint hypothesis | Previous condition plus negative 0.5% book imbalance, below its value 15min earlier |
| buying_recovery | Preserve-permission hypothesis | Healthy HL15 >1 and >HL1h; closed 15min HYPE return >=0 |

The high-test hour must already be closed, and both confirming 15m closes must end **strictly after** its end. A pivot chosen using its future rejection is not allowed. VWAP uses turnover / traded volume, not an unweighted average of prices. At midnight, the latest completed hour belongs to its own prior UTC session.

All eight definitions were frozen before cohort outcomes. There was no post-outcome threshold sweep or adaptive refinement. Existing support metadata is retained from the exact original decision; **no new live S/R-zone calculation or zone-break filter was tested**.

## 3. Cohorts: winners as well as losers

These tables answer: **what happened to the complete ladders that had this context at their first relevant permission?** They do not answer what would happen if that add were blocked.

- The scope baseline is the aggressive parent's unfiltered population for that decision type, not B17.
- A row includes whole-ladder profits/losses, not the marginal rung's PnL.
- Selected rows overlap across descriptors. Do not add their dollars together.
- Positive cohort net is a warning about winner cost, not proof a partial exposure adjustment cannot help.
- W/L excludes unfinished ladders. Recent deep scopes each have one unfinished observation; older confirmed hot has one. Other scope baselines have none. Unknown HL context is reported separately below.
- Dollars rounded; machine-readable selected, complementary, unknown and monthly populations are all preserved in `summaries.json`.

### Recent: first extra deep timer add

| Selected context | Touch W/L | Touch wins $ | Touch losses $ | Confirmed W/L | Confirmed wins $ | Confirmed losses $ |
|---|---:|---:|---:|---:|---:|---:|
| Scope baseline: ALL observations | 64/6 | $30,912 | -$8,057 | 70/6 | $37,122 | -$9,353 |
| Near high + weak hour | 3/1 | $587 | -$89 | 2/1 | $368 | -$89 |
| Remembered high break | 11/2 | $5,542 | -$1,678 | 10/2 | $5,476 | -$2,289 |
| Below session VWAP + negative ROC | 9/2 | $5,687 | -$5,202 | 14/2 | $9,703 | -$5,673 |
| Lower hourly structure | 10/2 | $5,888 | -$4,604 | 14/3 | $8,846 | -$5,762 |
| Hot-RSI high chase | 0/0 | $0 | $0 | 0/0 | $0 | $0 |
| Deteriorating HL selling | 17/0 | $7,729 | $0 | 18/1 | $10,405 | -$1,297 |
| Deteriorating HL selling + book | 6/0 | $1,942 | $0 | 5/0 | $1,550 | $0 |
| Strengthening buying (allowance) | 26/4 | $13,086 | -$3,494 | 24/3 | $13,366 | -$2,836 |

### Recent: hot-TP reopen

| Selected context | Touch W/L | Touch wins $ | Touch losses $ | Confirmed W/L | Confirmed wins $ | Confirmed losses $ |
|---|---:|---:|---:|---:|---:|---:|
| Scope baseline: ALL observations | 141/3 | $35,231 | -$5,289 | 122/0 | $38,036 | $0 |
| Near high + weak hour | 16/1 | $3,191 | -$3,463 | 20/0 | $5,549 | $0 |
| Remembered high break | 1/0 | $24 | $0 | 2/0 | $55 | $0 |
| Below session VWAP + negative ROC | 3/0 | $1,358 | $0 | 4/0 | $2,187 | $0 |
| Lower hourly structure | 4/0 | $1,609 | $0 | 6/0 | $2,798 | $0 |
| Hot-RSI high chase | 27/1 | $7,048 | -$3,463 | 18/0 | $5,804 | $0 |
| Deteriorating HL selling | 2/0 | $1,115 | $0 | 0/0 | $0 | $0 |
| Deteriorating HL selling + book | 0/0 | $0 | $0 | 0/0 | $0 | $0 |
| Strengthening buying (allowance) | 110/2 | $27,149 | -$1,827 | 99/0 | $31,482 | $0 |

### Older: first extra deep timer add

| Selected context | Touch W/L | Touch wins $ | Touch losses $ | Confirmed W/L | Confirmed wins $ | Confirmed losses $ |
|---|---:|---:|---:|---:|---:|---:|
| Scope baseline: ALL observations | 148/16 | $66,151 | -$39,010 | 145/17 | $73,871 | -$39,102 |
| Near high + weak hour | 2/2 | $358 | -$205 | 2/2 | $368 | -$205 |
| Remembered high break | 25/1 | $12,614 | -$686 | 23/1 | $13,429 | -$1,297 |
| Below session VWAP + negative ROC | 37/5 | $20,140 | -$17,645 | 39/5 | $24,258 | -$17,672 |
| Lower hourly structure | 34/4 | $16,384 | -$10,170 | 33/5 | $17,399 | -$11,327 |
| Hot-RSI high chase | 0/0 | $0 | $0 | 0/0 | $0 | $0 |
| Deteriorating HL selling | 15/0 | $7,031 | $0 | 18/1 | $10,828 | -$1,297 |
| Deteriorating HL selling + book | 5/0 | $1,713 | $0 | 6/0 | $2,390 | $0 |
| Strengthening buying (allowance) | 26/3 | $13,086 | -$2,502 | 24/2 | $13,366 | -$1,844 |

### Older: hot-TP reopen

| Selected context | Touch W/L | Touch wins $ | Touch losses $ | Confirmed W/L | Confirmed wins $ | Confirmed losses $ |
|---|---:|---:|---:|---:|---:|---:|
| Scope baseline: ALL observations | 392/20 | $99,069 | -$53,850 | 338/20 | $102,070 | -$58,207 |
| Near high + weak hour | 53/1 | $12,598 | -$3,463 | 44/0 | $13,114 | $0 |
| Remembered high break | 5/1 | $1,228 | -$8,712 | 3/0 | $989 | $0 |
| Below session VWAP + negative ROC | 13/0 | $4,748 | $0 | 13/0 | $5,702 | $0 |
| Lower hourly structure | 16/0 | $3,485 | $0 | 12/0 | $5,116 | $0 |
| Hot-RSI high chase | 59/3 | $14,356 | -$7,067 | 53/2 | $14,758 | -$12,093 |
| Deteriorating HL selling | 2/0 | $1,115 | $0 | 0/0 | $0 | $0 |
| Deteriorating HL selling + book | 0/0 | $0 | $0 | 0/0 | $0 | $0 |
| Strengthening buying (allowance) | 86/0 | $20,056 | $0 | 80/0 | $24,693 | $0 |

### Research priority, not a ranking of simulated profit improvements

1. **Deep timer: below session VWAP + negative hourly ROC.** Recent selected losses are 64.6% of deep-scope losing dollars versus 18.4% of winning dollars in touch; 60.7% versus 26.1% in confirmed. Older selected losses are about 45.2% of deep-scope losing dollars versus 30.4%/32.8% of winning dollars. This is useful separation, but not a measured block benefit.
2. **Deep timer: lower hourly structure.** Recent discrimination is also useful, but older separation is weaker and the rule catches a valuable June 22 recovery described below. Retain as a comparator, not automatically an AND condition.
3. **Remembered high failure.** This genuinely extends high-proximity logic, but standalone deep cohorts are strongly profitable in both periods/models. Older touch hot-reopen net is negative only because one approximately $8,712 February loss dominates six observations; confirmed has three winners and no losers. Too thin/model-sensitive to justify a blanket veto.
4. **Hot-high chase / near-high weak hour.** Recent confirmed hot-reopen baseline is 122 wins and no losses. Several proposed blocks therefore identify only winners in that model. Touch has losses, but concentration and replacement-path effects matter. Do not broadly restore the cooldown on this evidence.
5. **HL selling / selling plus book.** Recent deteriorating-selling deep cohort is 17 wins / 0 losses in touch and 18 / 1 in confirmed. Adding book deterioration selects only winners. These definitions mostly identify dip-buying paths that subsequently recover, not a clean set of bad adds.
6. **Buying recovery.** Worth preserving as context, but not a universal permission: recent selected deep cohorts still contain four touch and three confirmed losing ladders.

No new rule has a tested economic PnL delta or drawdown in this pass. None is designated economically FALSIFIED as an entire indicator family; the frozen cohort definitions simply receive different research priority.

## 4. Trace: preserving the good June 22 add while flagging the later bad one

Recent resting-touch model; two different ladders on June 22, 2026:

| Known at first extra deep timer decision | Earlier recovery ladder | Later damaging ladder |
|---|---:|---:|
| Ladder entry UTC | 13:32 | 18:11 |
| First qualifying decision UTC | 15:26 | 20:49 |
| Last completed hourly close | $67.970 | $67.397 |
| Session VWAP through that hour | $67.537 | $67.628 |
| Hourly return | Negative | Negative |
| Below VWAP + negative ROC flag | **False: preserve permission** | **True: restraint candidate** |
| Lower-hour-structure flag | True | True |
| HL15 / HL1h ratio | 2.631 / 0.916 | 0.782 / 0.920 |
| Strengthening-buying flag | True | False |
| Subsequent whole-ladder result | +$770.41 TP | -$4,515.49 hard flatten |

The earlier same-entry guarded-10h ladder loses $4,506.61, versus aggressive +$770.41: a **$5,277.02 matched-path difference**, not a marginal rung's guaranteed earnings. The hourly-structure veto would interfere with this valuable recovery; the VWAP/ROC condition does not flag its first extra permission.

The later ladder's confirmed-model entry is 18:15, first deep permission also 20:49; its subsequent result is -$4,375.52. Later selling is weaker than buying in absolute terms, but the frozen three-part *deterioration* condition is false. A sell-dominant snapshot and continuously deteriorating selling are different observations.

This is a useful mechanism trace, not a hand-picked rule proof:

- VWAP/ROC-selected deep losses also occur in July 2025, March/April 2026 and July 2026.
- Older matching-entry VWAP/ROC cohorts show aggressive-minus-guarded sums of about **-$5,932 touch** across 20 matched episodes and **-$6,739 confirmed** across 14. Replacement entries remain separate; matching entry does not isolate the effect of a single add.
- Recent VWAP/ROC losing dollars are still concentrated: one ladder accounts for **86.8% touch / 77.1% confirmed**. Excluding that largest loser leaves selected cohort net **+$5,001 / +$8,406**.
- Older largest-loss share is approximately 31.5% in each model: less concentrated, but selected cohorts still contain substantial wins.
- Older February VWAP/ROC deep selections are **five winners / zero losers** in each TP model. This condition has not identified a direct fix for the original February monthly regression.

## 5. The scope limitation: these are not all the loss mechanisms

Coverage below uses the **union** of qualifying episode IDs, so ladders that have both permission types are counted only once.

| Period / TP model | All losing ladders / dollars | Losing ladders in either permission scope / dollars | Loss-dollar coverage |
|---|---:|---:|---:|
| Recent / touch | 16 / -$27,948 | 9 / -$13,346 | 47.8% |
| Recent / confirmed | 13 / -$30,610 | 6 / -$9,353 | 30.6% |
| Older / touch | 75 / -$148,896 | 35 / -$87,760 | 58.9% |
| Older / confirmed | 67 / -$155,052 | 35 / -$92,534 | 59.7% |

Some especially important recent losers take neither extra permission:

| TP model | Ladder entry -> close UTC | Outcome | Whole-ladder PnL |
|---|---|---|---:|
| Touch | Jun 5 01:35 -> Jun 8 00:19 | Two-day-high research exit | -$3,245.21 |
| Confirmed | Jun 4 20:34 -> Jun 6 19:59 | Emergency kill | -$8,224.01 |
| Both | Jun 8 20:00 -> Jun 10 18:41 | Emergency kill | -$8,904.55 |
| Both | Jul 15 16:01 -> Jul 16 16:00 | Hard flatten | -$1,835.66 |

A tuner applied only to the two removed guards cannot **directly** change these ladders' recorded decisions. Upstream occupancy can change which future ladders occur, so this is not a mathematical upper bound on counterfactual savings. It is a warning against claiming that permission tuning addresses the previously identified uptrend-pullback weakness.

**Separate unexplored branch:** distinguish recoverable inventory from failed recovery during the longer TP-patience period, and isolate the two-day-high exit's inherited cooldown. Those mechanisms must be evaluated against both missed recoveries and avoided deep losses, not grafted onto this diagnostic after seeing outcomes.

## 6. Source completeness and delay sensitivity

All selected opportunities have complete closed-minute/hour price context. HL is unavailable for much of the older period, and occasional recent gaps remain unknown.

| Period / model | Hot observations | Hot unknown: flow / book / buying | Deep observations | Deep unknown: flow / book / buying |
|---|---:|---:|---:|---:|
| Recent / touch | 144 | 2 / 3 / 2 | 71 | 3 / 3 / 3 |
| Recent / confirmed | 122 | 2 / 3 / 2 | 77 | 3 / 3 / 3 |
| Older / touch | 412 | 301 / 302 / 301 | 164 | 100 / 100 / 100 |
| Older / confirmed | 359 | 264 / 265 / 264 | 162 | 90 / 90 / 90 |

Requirements remain unchanged: at least 14/15 and 55/60 flow minutes, maximum taker source age 90s, book 30s, asset context 60s, and OI anchor lag 120s. Invalid and duplicate flow windows fail quality. Source age is measured against the actual decision clock, not reset to the delayed source clock.

With **an extra 60s source cutoff lag**, all selected opportunities' HL descriptor states become unknown under those strict freshness rules. This is **not** evidence of profitable abstention or robustness. Publication availability is a historical model/proxy, not a guarantee of live receipt timing.

For comparison, price descriptors remain mostly stable, with some changes near hour/high boundaries. The following are whole-cohort labels under changed feature cutoffs on the **same** opportunities, not rerun trading returns:

| Period / model | VWAP/ROC: 0s n / net | VWAP/ROC: +60s n / net | Lower structure: 0s n / net | Lower structure: +60s n / net |
|---|---:|---:|---:|---:|
| Recent / touch | 11 / $486 | 11 / $674 | 12 / $1,284 | 12 / $1,472 |
| Recent / confirmed | 16 / $4,031 | 17 / $4,420 | 17 / $3,084 | 18 / $3,473 |
| Older / touch | 42 / $2,494 | 42 / $2,682 | 38 / $6,215 | 38 / $6,403 |
| Older / confirmed | 44 / $6,585 | 45 / $6,974 | 38 / $6,072 | 39 / $6,461 |

The +60s check does not delay fills, replay decisions, change liquidity, or create economic source-delay results. A future HL-dependent tuner needs an explicit missing/stale-input policy and real economic arrival sensitivity. It may not silently treat unknown as false or increase freshness thresholds to obtain a favorable result.

## 7. Monthly visibility for the two leading deep-timer descriptors

**Attribution only:** month is the first permission's decision month; dollars are the eventual completed ladder's whole PnL. These are not realized-PnL calendar accounts, monthly MTM or simulated monthly improvements. Winners and losers are both shown. The actual B17/guarded/aggressive monthly MTM comparisons remain in the linked L15 findings and are reverified in `controls.json`.

### Recent / touch: decision-month cohorts

| First permission month | Scope baseline W/L; wins $ / losses $ | VWAP/ROC selected W/L; wins $ / losses $ | Lower structure selected W/L; wins $ / losses $ |
|---|---:|---:|---:|
| 2026-05 | 31/1; $16,286 / -$47 | 5/0; $3,224 / $0 | 4/0; $2,356 / $0 |
| 2026-06 | 25/2; $12,083 / -$6,243 | 4/1; $2,463 / -$4,515 | 6/1; $3,532 / -$4,515 |
| 2026-07 | 4/1; $959 / -$686 | 0/1; $0 / -$686 | 0/0; $0 / $0 |
| 2026-08 | 2/2; $978 / -$1,081 | 0/0; $0 / $0 | 0/1; $0 / -$89 |
| 2026-09 | 2/0; $605 / $0 | 0/0; $0 / $0 | 0/0; $0 / $0 |

### Recent / confirmed: decision-month cohorts

| First permission month | Scope baseline W/L; wins $ / losses $ | VWAP/ROC selected W/L; wins $ / losses $ | Lower structure selected W/L; wins $ / losses $ |
|---|---:|---:|---:|
| 2026-05 | 27/0; $14,391 / $0 | 6/0; $3,724 / $0 | 5/0; $2,510 / $0 |
| 2026-06 | 32/2; $18,004 / -$6,131 | 6/1; $5,315 / -$4,376 | 8/1; $6,064 / -$4,376 |
| 2026-07 | 8/2; $3,198 / -$2,142 | 2/1; $664 / -$1,297 | 1/1; $272 / -$1,297 |
| 2026-08 | 2/2; $1,139 / -$1,081 | 0/0; $0 / $0 | 0/1; $0 / -$89 |
| 2026-09 | 1/0; $391 / $0 | 0/0; $0 / $0 | 0/0; $0 / $0 |

### Older / touch: decision-month cohorts

| First permission month | Scope baseline W/L; wins $ / losses $ | VWAP/ROC selected W/L; wins $ / losses $ | Lower structure selected W/L; wins $ / losses $ |
|---|---:|---:|---:|
| 2025-07 | 2/1; $905 / -$1,464 | 2/1; $905 / -$1,464 | 1/0; $498 / $0 |
| 2025-08 | 4/0; $1,620 / $0 | 1/0; $266 / $0 | 1/0; $266 / $0 |
| 2025-10 | 2/0; $1,830 / $0 | 1/0; $868 / $0 | 1/0; $868 / $0 |
| 2025-11 | 3/1; $1,346 / -$2,062 | 1/0; $770 / $0 | 0/0; $0 / $0 |
| 2025-12 | 2/1; $723 / -$8 | 1/0; $490 / $0 | 0/1; $0 / -$8 |
| 2026-01 | 11/0; $3,680 / $0 | 2/0; $886 / $0 | 2/0; $886 / $0 |
| 2026-02 | 16/2; $9,091 / -$10,556 | 5/0; $2,630 / $0 | 2/0; $772 / $0 |
| 2026-03 | 18/2; $7,047 / -$10,658 | 3/1; $2,115 / -$5,558 | 8/1; $3,194 / -$5,558 |
| 2026-04 | 18/3; $7,397 / -$7,023 | 8/1; $4,700 / -$5,422 | 5/0; $3,092 / $0 |
| 2026-05 | 42/2; $18,961 / -$221 | 9/0; $4,046 / $0 | 8/0; $3,276 / $0 |
| 2026-06 | 25/2; $12,083 / -$6,243 | 4/1; $2,463 / -$4,515 | 6/1; $3,532 / -$4,515 |
| 2026-07 | 4/1; $959 / -$686 | 0/1; $0 / -$686 | 0/0; $0 / $0 |
| 2026-08 | 1/1; $510 / -$89 | 0/0; $0 / $0 | 0/1; $0 / -$89 |

### Older / confirmed: decision-month cohorts

| First permission month | Scope baseline W/L; wins $ / losses $ | VWAP/ROC selected W/L; wins $ / losses $ | Lower structure selected W/L; wins $ / losses $ |
|---|---:|---:|---:|
| 2025-07 | 2/1; $916 / -$1,464 | 2/1; $916 / -$1,464 | 1/0; $496 / $0 |
| 2025-08 | 4/0; $1,720 / $0 | 0/0; $0 / $0 | 0/0; $0 / $0 |
| 2025-10 | 2/0; $2,671 / $0 | 0/0; $0 / $0 | 0/0; $0 / $0 |
| 2025-11 | 3/1; $1,178 / -$2,062 | 1/0; $798 / $0 | 0/0; $0 / $0 |
| 2025-12 | 3/1; $2,155 / -$8 | 2/0; $1,060 / $0 | 0/1; $0 / -$8 |
| 2026-01 | 10/0; $3,118 / $0 | 2/0; $931 / $0 | 2/0; $931 / $0 |
| 2026-02 | 14/2; $9,436 / -$10,122 | 5/0; $3,879 / $0 | 2/0; $1,381 / $0 |
| 2026-03 | 16/2; $7,015 / -$10,327 | 3/1; $2,125 / -$5,558 | 7/1; $3,208 / -$5,558 |
| 2026-04 | 13/4; $5,886 / -$6,583 | 6/1; $3,424 / -$4,978 | 3/0; $1,580 / $0 |
| 2026-05 | 37/1; $17,852 / -$174 | 10/0; $5,146 / $0 | 9/0; $3,467 / $0 |
| 2026-06 | 32/2; $18,004 / -$6,131 | 6/1; $5,315 / -$4,376 | 8/1; $6,064 / -$4,376 |
| 2026-07 | 8/2; $3,198 / -$2,142 | 2/1; $664 / -$1,297 | 1/1; $272 / -$1,297 |
| 2026-08 | 1/1; $722 / -$89 | 0/0; $0 / $0 | 0/1; $0 / -$89 |

All eight descriptors' decision-month partitions are retained in `summaries.json`; the two priority mechanisms are printed here. A block can remove some exposure, change weighted entry and targets, allow a later genuine-drop add, prolong the ladder or create replacement trades. None of those counterfactual effects can be calculated by subtracting the selected loss column.

## 8. Next tests, in order

### A. Small separate economic test of the selective deep guard

Retain **B17, guarded 10h and unchanged aggressive 10h** as exact controls. Freeze just two modifications to aggressive 10h:

1. Restore the original deep negative-funding timer-add guard **only when** completed-hour close is below that hour's UTC-session VWAP and hourly ROC is negative.
2. Same scope, but use the lower-hour-structure condition as a separate comparator.

Keep genuine price-drop adds, initial reopens, the existing support-reopen exception, sizing, safety gates/exits, S/R partials and both parent TP/high-exit rules unchanged. Check the predicate at **every** eligible opportunity in the new replay, not just the first diagnostic observation. A later eligible add may become possible even after the first one was blocked.

Recompute the actual continuous ladder path: quantities, average entry, fees, TP targets, omitted/late adds, missed TPs, subsequent entries, replacements and terminal marks. Same windows, both TP models, and explicit source-delay sensitivity. Show baseline and guarded parent beside results, W/L dollar splits, monthly deltas and concentration. Do not combine the two new predicates before learning their separate cost.

An episode-level feature must not be reused as future knowledge when deciding an earlier add. An episode is classified here only for analysis; a trading implementation must compute its current feature causally.

### B. Separate recovery/exit investigation for losses outside these scopes

The uncovered June episodes are the clearest reason not to spend all subsequent work on extra-entry permissions. Revisit the longer TP-patience path and high-exit-only cooldown attribution, with the unchanged aggressive lead as parent. Previously proposed high-exit-only cooldown 1h/2h versus inherited 4-8h remains **not run**; it should be a separate frozen test, not a hidden third feature in A.

### C. Context expansion after the economic result

Possible later contexts, **not evaluated as new predicates in this pass**:

- Confirmed S/R-zone failure or reclaim, carrying the level known before the event rather than retrospectively selecting a pivot.
- Event/ladder-entry anchored VWAP, tested distinctly from UTC-session VWAP.
- Native OI change versus marked OI change combined with directional volume/price response.
- Whether price stops falling despite continued aggressive selling, rather than assuming sell dominance is automatically hostile.

Native/marked OI, ladder-entry VWAP, archived RSI/CRSI/EMA/BTC/funding/support fields are retained where knowable for later reproducible work. Retaining fields is not claiming that their combinations have been tested.

## 9. Evidence, reproduction and qualification

Research files:

- `scripts/aggressive10-discriminator-context.ts`: closed-price and receipt-aware pulse features; no order or runtime-state mutation.
- `scripts/aggressive10-discriminator-study.ts`: frozen accepted-path loading, exact controls, first-permission selection, separate outcome joining and cohort accounting.
- `scripts/aggressive10-discriminator-tests.ts`: timing, prefix invariance, raw VWAP, stale/duplicate/missing flow, buying distinction and accounting.
- `scripts/aggressive10-discriminator-check.ts`: separate raw-price/high/hour/VWAP/anchor and cohort checker.

Local outputs: `backtests/hype/aggressive10-discriminators-2026-09-11/`.

- `features.json`: 3,022 rows, no future PnL/close-reason labels.
- `outcome-labels.json`: 1,285 model/window-qualified episode IDs, outcome only.
- `summaries.json`: 128 descriptor/scope/model/lag comparisons; selected/complement/unknown and month cohorts.
- `controls.json`: 12 exact prior net/DD/monthly metrics and episodes.
- `manifest.json`, `verification.json`, `independent-check.json`: source pins, accepted prefixes and proof receipts.

Study input/card/source hashes were recorded before outcomes and checked unchanged after execution. Synced JSONL streams may have longer tails than the accepted L15 files; only their **verified original byte prefixes** enter this study. The historical cutoff was not silently extended. Repaired closed-minute history and archived original entry/HL values were checked. Current `bot-state.json` is protected, not an input to historical decisions.

Checks passed:

```text
npx ts-node scripts/aggressive10-discriminator-tests.ts
npx ts-node scripts/aggressive10-discriminator-check.ts
npx tsc --ignoreConfig --noEmit --types node --strict --esModuleInterop --skipLibCheck --target ES2022 --module commonjs scripts/aggressive10-discriminator-context.ts scripts/aggressive10-discriminator-study.ts scripts/aggressive10-discriminator-tests.ts scripts/aggressive10-discriminator-check.ts
```

Independent checker: **3,022 raw high/hour/VWAP/anchor checks; 128 cohort partitions**. Study reaccounting: **12 original net/DD/monthly paths** and exact original zero-extra-lag HL values. Closed-prefix/future-price/future-receipt tests passed. The checker imports the accepted candle loader but independently recalculates these price features and partition totals; it is not an independent live-fill simulator.

The study runner refuses to overwrite an existing output directory. Do not mutate old receipts or remove accepted artifacts to force a repeat. Read-only checker can be rerun; `--write` was used once to preserve its receipt.

**Qualification:** no new strategy economics evaluated; no new net/DD or monthly qualifier claimed. Existing counters remain **5,261 standalone / 156 ladder overlays**, L09 profiles separate. This diagnostic adds **eight descriptive hypotheses, zero trading definitions and zero economic replays**. No live config, coordinator, engine, state, deployment, commit or push changes.

