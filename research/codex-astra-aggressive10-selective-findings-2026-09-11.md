# AG10-E1: selective deep timer-add guards — findings

September 11, 2026. **Research only. Neither new guard qualifies; aggressive 10h remains the unchanged research lead, not a live recommendation.**

## TL;DR

- **2 frozen definitions, 26 economic runs, 12 exact archived controls.** Both selective guards improve recent resting-touch net by about $700 versus aggressive 10h, but lose $873–$1,341 in recent close-confirmed replay. Structure loses in both older models; VWAP/ROC gains in older touch but loses in older confirmed. **0/2 complete marginal passes; 0/2 complete B17 passes.**
- The prior diagnostic was not fictitious: VWAP/ROC preserves the June 22 recovery and reduces the subsequent hard-flatten loss. But actual savings are $395 touch / $591 confirmed, not the whole losing ladder's $4k-plus outcome. Changed average entry, missed recoveries and replacement ladders offset the benefit elsewhere. Structure's recent touch losing dollars fall by **only $0.74**, despite its $720 total improvement.
- **17–25 distinct recently blocked ladders per primary case**, not thousands of independent observations. Extra-60s source checks retain the mixed-model result. Independent inventory, closed-bar features, original funding/S/R permission and accounting verification passed. No threshold retuning, combined filter, live config, exchange action, commit or push.

## 1. Exact question and controls

[Prior AG10-D1 diagnostic](codex-astra-aggressive10-discriminators-findings-2026-09-11.md) identified correlations at newly permitted deep timer adds. This checkpoint tests the actual ensuing inventory paths, not removal of attributed losing dollars.

| Setup | Definition |
|---|---|
| B17 | Frozen current-config canonical replay control used in L15; unchanged gates, TP, partials and sizing. “Current” means this pinned strategy baseline, not exact realized live maker-fee accounting. |
| Guarded 10h | Defer ordinary soft-stale TP permission up to 10h; separate full exit from age 4h within 1% of trailing two-day high. Original deep funding guard and hot-RSI post-TP cooldown retained. |
| Aggressive 10h | Same 10h/high pair, but deep negative-funding timer guard and hot-RSI post-TP cooldown disabled. All other inherited gates/exits retained. |
| + VWAP/ROC | Restore the original eligible deep timer guard only when the last completed hourly close is below its session VWAP **and** hourly close-to-close ROC <0. |
| + hourly structure | Restore it only when the last completed hourly high is below the previous hourly high **and** its close is below the previous hourly low. |

These are two separate variants on aggressive 10h. No combined AND/OR variant.

Scope is the original funding-only guard **after** the existing S/R support-reopen exception: at least five held rungs (next depth >=6), otherwise eligible timer add, negative funding under the inherited rule, and no genuine price-drop permission. A block does not alter the add clock, inventory or TP. Reconsider every later eligible opportunity.

Genuine price-drop adds, shallow adds, nonnegative-funding permissions, qualified S/R support exceptions and initial entries remain untouched. Unknown required hourly context restores only that eligible original guard; all observed feature checks had known context. Blocking timer adds is **not** a permanent rung cap.

## 2. Dates, capital and execution assumptions

| Window | Start UTC, independently flat | End UTC |
|---|---|---|
| Recent HL-extended | 2026-05-17 20:43 | 2026-09-10 05:08 |
| Older published | 2025-07-01 00:00 | 2026-08-19 21:32 |

Each starts with $32,000 and $800 x1.35, maximum 11 rungs. Same **0.055% each-side fee** model as the controls. No maker-fee saving added. Funding signal inputs are retained; funding cashflows, actual maker queue/fills, Bybit liquidation and shared-account risk are not certified by these results.

The periods overlap and have been repeatedly examined. They are not holdouts; the two TP models are not independent samples or guaranteed optimistic/pessimistic bounds.

Resting-touch models a previously armed TP resting through a later bar's range. Close-confirmed requires the completed minute's confirmation and the inherited next-open fill. Ordinary added exposure and discretionary exits keep causal next-open execution. Different occupancy can make the close-confirmed portfolio earn more; model differences cannot be treated as a flat execution haircut.

Total net is completed episode net plus unfinished partial proceeds and marked open inventory. W/L dollars below already include modeled trading fees and completed ladders' partial proceeds. They are not gross pre-fee returns.

## 3. Side-by-side net and drawdown

### Recent: May 17–September 10, 2026

| Setup | Touch net | Touch max DD | Confirmed net | Confirmed max DD |
| --- | ---: | ---: | ---: | ---: |
| B17 current replay baseline | $20,887 | 24.69% | $15,812 | 31.11% |
| Guarded 10h | $36,542 | 24.22% | $34,839 | 27.64% |
| Aggressive 10h unchanged | $40,783 | 20.39% | $46,922 | 25.68% |
| Aggressive + VWAP/ROC guard | $41,456 | 20.59% | $45,581 | 25.62% |
| Aggressive + hourly-structure guard | $41,503 | 20.00% | $46,049 | 25.06% |

### Older: July 1, 2025–August 19, 2026

| Setup | Touch net | Touch max DD | Confirmed net | Confirmed max DD |
| --- | ---: | ---: | ---: | ---: |
| B17 current replay baseline | $46,832 | 28.17% | $19,490 | 45.65% |
| Guarded 10h | $67,781 | 24.67% | $40,382 | 27.32% |
| Aggressive 10h unchanged | $61,635 | 25.09% | $64,976 | 30.17% |
| Aggressive + VWAP/ROC guard | $65,111 | 25.33% | $62,662 | 29.77% |
| Aggressive + hourly-structure guard | $58,921 | 25.21% | $62,405 | 30.97% |

Both filters retain the parent's aggregate improvement over B17. That does **not** establish a benefit from the added filter. The incremental comparison is:

| Variant / window / TP | Net Δ vs aggressive | Max-DD Δ (+ worse) | Winning dollars Δ | Losing dollars Δ (+ worse) |
| --- | ---: | ---: | ---: | ---: |
| VWAP/ROC / Recent / resting-touch | +$674 | +0.199pp | +$288 | -$386 |
| Structure / Recent / resting-touch | +$720 | -0.393pp | +$719 | -$1 |
| VWAP/ROC / Recent / close-confirmed | -$1,341 | -0.060pp | -$637 | +$704 |
| Structure / Recent / close-confirmed | -$873 | -0.626pp | +$408 | +$1,281 |
| VWAP/ROC / Older / resting-touch | +$3,476 | +0.242pp | +$1,322 | -$2,154 |
| Structure / Older / resting-touch | -$2,713 | +0.116pp | -$2,033 | +$680 |
| VWAP/ROC / Older / close-confirmed | -$2,313 | -0.396pp | -$2,659 | -$345 |
| Structure / Older / close-confirmed | -$2,571 | +0.801pp | -$2,058 | +$513 |

### Completed winners and losers, with end inventory separated

“Other full closes” includes profitable two-day-high exits as well as funding, hard-flatten and emergency exits. It is **not** a count of losing flattens. “End contribution” is marked open PnL plus any unfinished partial proceeds. Net = winning dollars - losing dollars + end contribution, subject to displayed rounding.

#### Recent / resting-touch

| Setup | Wins / losses | Winning dollars | Losing dollars (absolute) | End contribution | Total net | TP / other full closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 295 / 10 | $57,130 | $33,009 | -$3,234.44 | $20,887 | 295 / 10 |
| Guarded 10h | 229 / 13 | $61,971 | $25,546 | $116.69 | $36,542 | 203 / 39 |
| Aggressive 10h unchanged | 242 / 16 | $68,731 | $27,948 | -$0.87 | $40,783 | 216 / 42 |
| Aggressive + VWAP/ROC guard | 246 / 16 | $69,019 | $27,562 | -$0.87 | $41,456 | 220 / 42 |
| Aggressive + hourly-structure guard | 237 / 16 | $69,450 | $27,947 | -$0.87 | $41,503 | 211 / 42 |

#### Recent / close-confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars (absolute) | End contribution | Total net | TP / other full closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 243 / 11 | $59,238 | $40,192 | -$3,234.44 | $15,812 | 242 / 12 |
| Guarded 10h | 196 / 14 | $67,463 | $32,741 | $116.69 | $34,839 | 168 / 42 |
| Aggressive 10h unchanged | 215 / 13 | $77,533 | $30,610 | -$0.87 | $46,922 | 184 / 44 |
| Aggressive + VWAP/ROC guard | 215 / 13 | $76,895 | $31,313 | -$0.87 | $45,581 | 184 / 44 |
| Aggressive + hourly-structure guard | 211 / 13 | $77,940 | $31,891 | -$0.87 | $46,049 | 180 / 44 |

#### Older / resting-touch

| Setup | Wins / losses | Winning dollars | Losing dollars (absolute) | End contribution | Total net | TP / other full closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 955 / 57 | $187,738 | $140,906 | $0.00 | $46,832 | 953 / 59 |
| Guarded 10h | 756 / 69 | $198,212 | $130,431 | $0.00 | $67,781 | 642 / 183 |
| Aggressive 10h unchanged | 765 / 75 | $210,530 | $148,896 | $0.00 | $61,635 | 642 / 198 |
| Aggressive + VWAP/ROC guard | 772 / 76 | $211,852 | $146,741 | $0.00 | $65,111 | 651 / 197 |
| Aggressive + hourly-structure guard | 761 / 75 | $208,497 | $149,576 | $0.00 | $58,921 | 638 / 198 |

#### Older / close-confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars (absolute) | End contribution | Total net | TP / other full closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 788 / 60 | $190,819 | $171,329 | $0.00 | $19,490 | 785 / 63 |
| Guarded 10h | 644 / 68 | $195,909 | $155,527 | $0.00 | $40,382 | 515 / 197 |
| Aggressive 10h unchanged | 670 / 67 | $220,017 | $155,052 | $10.61 | $64,976 | 532 / 205 |
| Aggressive + VWAP/ROC guard | 664 / 68 | $217,359 | $154,707 | $10.61 | $62,662 | 526 / 206 |
| Aggressive + hourly-structure guard | 665 / 67 | $217,959 | $155,565 | $10.61 | $62,405 | 526 / 206 |

## 4. Monthly stability — full continuous replay, not monthly restarts

All values are dollars, rounded. B17 is absolute monthly marked net. G = guarded 10h, A = aggressive 10h, V = VWAP/ROC selective, S = structure selective. Columns explicitly distinguish delta versus B17 from delta versus aggressive. Partial first/last months follow the exact window above. Older and recent overlapping months can differ because their starting inventory paths differ.

### Recent / resting-touch

| Month | B17 net | G Δ B17 | A Δ B17 | V Δ B17 | S Δ B17 | V Δ A | S Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | $13,483 | +$2,458 | +$6,758 | +$6,169 | +$8,521 | -$589 | +$1,763 |
| 2026-06 | $1,584 | +$6,243 | +$7,410 | +$8,490 | +$6,450 | +$1,080 | -$960 |
| 2026-07 | -$3,950 | +$5,016 | +$2,638 | +$2,594 | +$2,638 | -$44 | $0 |
| 2026-08 | $9,684 | +$1,253 | +$3,209 | +$3,435 | +$3,125 | +$226 | -$83 |
| 2026-09 | $85 | +$686 | -$118 | -$118 | -$118 | $0 | $0 |

### Recent / close-confirmed

| Month | B17 net | G Δ B17 | A Δ B17 | V Δ B17 | S Δ B17 | V Δ A | S Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | $17,131 | +$745 | +$1,793 | +$1,644 | +$3,921 | -$149 | +$2,128 |
| 2026-06 | -$2,243 | +$6,313 | +$12,975 | +$13,103 | +$11,684 | +$128 | -$1,291 |
| 2026-07 | -$7,858 | +$7,726 | +$11,233 | +$9,892 | +$9,726 | -$1,340 | -$1,507 |
| 2026-08 | $10,239 | +$3,722 | +$4,674 | +$4,695 | +$4,471 | +$21 | -$203 |
| 2026-09 | -$1,456 | +$521 | +$435 | +$435 | +$435 | $0 | $0 |

### Older / resting-touch

| Month | B17 net | G Δ B17 | A Δ B17 | V Δ B17 | S Δ B17 | V Δ A | S Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | $2,668 | +$5,431 | +$3,613 | +$3,238 | +$3,477 | -$375 | -$136 |
| 2025-08 | $561 | -$658 | +$115 | +$31 | +$31 | -$84 | -$84 |
| 2025-09 | $5,608 | -$4,864 | -$4,222 | -$4,222 | -$4,222 | $0 | $0 |
| 2025-10 | $7,325 | +$3,337 | -$317 | -$2,210 | -$2,210 | -$1,893 | -$1,893 |
| 2025-11 | -$1,443 | +$3,642 | +$4,003 | +$4,733 | +$4,733 | +$730 | +$730 |
| 2025-12 | -$509 | +$803 | +$1,649 | +$1,392 | +$1,719 | -$257 | +$70 |
| 2026-01 | -$246 | +$1,899 | +$3,593 | +$3,457 | +$3,373 | -$135 | -$220 |
| 2026-02 | $4,940 | +$4,218 | -$7,769 | -$2,975 | -$7,886 | +$4,795 | -$117 |
| 2026-03 | $11,159 | +$2,028 | +$1,803 | +$2,881 | +$1,196 | +$1,079 | -$607 |
| 2026-04 | $2,065 | -$1,849 | +$1,855 | +$1,533 | +$1,273 | -$323 | -$582 |
| 2026-05 | $15,753 | -$4,020 | +$463 | -$859 | +$1,631 | -$1,322 | +$1,168 |
| 2026-06 | $1,584 | +$6,243 | +$7,410 | +$8,490 | +$6,450 | +$1,080 | -$960 |
| 2026-07 | -$3,950 | +$5,016 | +$2,638 | +$2,594 | +$2,638 | -$44 | $0 |
| 2026-08 | $1,317 | -$277 | -$32 | +$194 | -$115 | +$226 | -$83 |

### Older / close-confirmed

| Month | B17 net | G Δ B17 | A Δ B17 | V Δ B17 | S Δ B17 | V Δ A | S Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | -$3,050 | +$12,039 | +$9,454 | +$9,115 | +$9,375 | -$339 | -$80 |
| 2025-08 | $1,420 | -$289 | +$1,999 | +$2,028 | +$2,028 | +$29 | +$29 |
| 2025-09 | $6,247 | -$6,301 | -$6,717 | -$6,717 | -$6,717 | $0 | $0 |
| 2025-10 | $7,167 | +$2,239 | +$392 | +$392 | +$392 | $0 | $0 |
| 2025-11 | -$688 | +$3,334 | +$3,204 | +$3,623 | +$3,934 | +$420 | +$730 |
| 2025-12 | $673 | +$99 | +$2,448 | +$2,096 | +$2,519 | -$353 | +$70 |
| 2026-01 | -$8,750 | +$2,715 | +$13,135 | +$12,812 | +$13,017 | -$322 | -$118 |
| 2026-02 | -$6,255 | +$55 | -$3,521 | -$3,081 | -$4,267 | +$440 | -$746 |
| 2026-03 | $12,689 | +$1,454 | +$909 | +$471 | +$199 | -$438 | -$711 |
| 2026-04 | $2,401 | -$5,541 | +$538 | +$787 | +$128 | +$250 | -$409 |
| 2026-05 | $15,721 | -$2,848 | -$1,035 | -$1,842 | +$629 | -$808 | +$1,664 |
| 2026-06 | -$2,243 | +$6,313 | +$12,975 | +$13,103 | +$11,684 | +$128 | -$1,291 |
| 2026-07 | -$7,858 | +$7,726 | +$11,233 | +$9,892 | +$9,726 | -$1,340 | -$1,507 |
| 2026-08 | $2,017 | -$102 | +$471 | +$492 | +$268 | +$21 | -$203 |

### Frozen screens: no criteria changed after seeing outcomes

The B17 screen requires recent net improvement >=$1,000 in each TP model, nonnegative older improvement, no worse DD, every monthly delta >=-$250, no modeled nonpositive equity and >=20 recently blocked episodes per model. The new intervention count excludes the parent's already-existing TP/high actions.

The separate incremental screen requires positive recent and nonnegative older net delta versus aggressive, no worse DD, every monthly delta >=-$250 and >=20 recent newly blocked episodes in each model.

| Variant | Aggregate B17 net/DD, all four | Complete B17 screen | Complete incremental screen |
|---|---|---|---|
| VWAP/ROC | Pass | Fail: older monthly sacrifices; recent touch n=17 | Fail: recent/older confirmed profit, touch DD, monthly costs and touch n |
| Hourly structure | Pass | Fail: older monthly sacrifices; recent touch n=19 | Fail: recent confirmed profit, both older profits/DD, monthly costs and touch n |

No case reaches nonpositive modeled equity. That is not a liquidation-safety certification. Neither rejection depends only on narrowly missing the 20-episode count: both fail substantive profit/model/monthly checks.

Ranked by the smaller of the two recent incremental net results, structure is first at -$873 and VWAP/ROC second at -$1,341. This is a ranking of **two nonqualifiers**, not a winning tuner. The aggressive parent retains its documented monthly weaknesses and remains research-only.

## 5. What actually changed — visible costs and invisible replacement trades

Whole-ladder entry identities are matched only when entry timestamps match. A later entry is a replacement, not assumed to be the same causal ladder. Attribution reconciles:

`matched change - removed baseline net + replacement net + end-inventory change = portfolio net change`.

It does not assign an entire losing ladder's PnL to a blocked rung.

| Variant / window / TP | Matched n / Δ | Removed n / net | Replacement n / net | End Δ | Portfolio Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| VWAP/ROC / Recent / resting-touch | 256 / -$305 | 2 / $357 | 6 / $1,335 | $0 | +$674 |
| Structure / Recent / resting-touch | 246 / -$893 | 12 / -$2,084 | 7 / -$471 | $0 | +$720 |
| VWAP/ROC / Recent / close-confirmed | 213 / +$134 | 15 / $3,699 | 15 / $2,224 | $0 | -$1,341 |
| Structure / Recent / close-confirmed | 208 / -$388 | 20 / $4,104 | 16 / $3,619 | $0 | -$873 |
| VWAP/ROC / Older / resting-touch | 801 / -$809 | 39 / -$11,184 | 47 / -$6,898 | $0 | +$3,476 |
| Structure / Older / resting-touch | 813 / -$1,558 | 27 / -$2,070 | 23 / -$3,225 | $0 | -$2,713 |
| VWAP/ROC / Older / close-confirmed | 681 / -$6,116 | 56 / $1,242 | 51 / $5,044 | $0 | -$2,313 |
| Structure / Older / close-confirmed | 700 / -$1,066 | 37 / $4,126 | 32 / $2,621 | $0 | -$2,571 |

Two important recent examples:

- VWAP/ROC touch gains $674 despite **-$305 on matched entries**. It removes two winning ladders worth $357 and introduces six winning replacements worth $1,335. The improvement is not just cutting bad adds.
- VWAP/ROC confirmed replaces 15 completed entries worth $3,699 with 15 worth $2,224, offset by $134 improvement on matched entries. Removed losses total $2,599, replacement losses $3,896. Structure confirmed has the same replacement losing-dollar total, so lower exposure at selected minutes does not mean fewer downstream losing dollars.

### June 22: the original diagnostic lead partly works

Recent window, UTC. First recovery and subsequent hard-flatten ladder:

| TP model / ladder | Aggressive 10h | VWAP/ROC | Hourly structure |
|---|---:|---:|---:|
| Touch recovery, entry June 22 13:32 | +$770.41 | +$770.41 | +$421.39 |
| Touch later hard-flatten ladder | -$4,515.49 | -$4,120.61 | -$4,500.98 |
| Confirmed recovery, entry June 22 13:33 | +$584.08 | +$584.08 | +$395.12 |
| Confirmed later hard-flatten ladder | -$4,375.52 | -$3,784.27 | -$4,347.68 |

The touch later parent/VWAP entry is 18:11, structure entry 18:14; confirmed later entries are 18:15. All later ladders close June 23 20:00 and still reach depth 11.

VWAP saves $394.88 touch / $591.25 confirmed on the subsequent loser while preserving the earlier recovery. Structure sacrifices $349.02 / $188.95 on that recovery and barely reduces the later loser. This reproduces the diagnostic's concern about indiscriminate lower-structure vetoes.

### April 18–21: a blocked add can make a recovery harder to exit

Older close-confirmed case, common entry **April 18 03:11 UTC**:

1. At **06:05**, VWAP/ROC blocks the next-depth-8 timer add. The latest completed hour is 05:00–06:00: close **44.783**, session VWAP **44.948731**, hourly ROC **-0.422476%**. The source hour ended five minutes before the decision; no future candle or eventual full-session VWAP is used.
2. Before the parent's exit decision at 15:50, its 11-rung average is **44.296688**, reduced TP **44.518171**. The variant has 10 rungs, average **44.403574**, reduced TP **44.625592**.
3. Parent takes a stale TP at 15:51 for **+$399.51**. Variant misses that exit, eventually reaches 11 and hard-flattens April 21 16:00 for **-$5,802.07**.

The matched-entry difference is -$6,201.58, but that is **not** the portfolio cost of this segment. Parent reopens April 18 15:53 and loses $4,977.70 at the same April 21 hard flatten. Full segment completed net:

| Path, April 18 03:11–April 21 16:00 | Net |
|---|---:|
| Aggressive: first TP plus next losing ladder | -$4,578.19 |
| VWAP/ROC: retained original losing ladder | -$5,802.07 |
| Variant incremental segment cost | **-$1,223.88** |

There are offsets elsewhere even within April; see the monthly table. This example explains a real mechanism, not the entire month's result or an argument to approve every deep add.

### Largest same-entry gains/costs: attribution, not marginal rung profits

| Variant / case | Largest matched gain: entry UTC / parent → variant / Δ | Largest matched cost: entry UTC / parent → variant / Δ |
| --- | --- | --- |
| VWAP/ROC / older / confirmed | 2026-04-07 09:35 / $257 → $1,071 / +$814 | 2026-04-18 03:11 / $400 → -$5,802 / -$6,202 |
| VWAP/ROC / older / touch | 2025-11-20 04:00 / -$2,062 → -$1,332 / +$730 | 2025-10-30 04:00 / $868 → $589 / -$278 |
| VWAP/ROC / recent / confirmed | 2026-06-22 18:15 / -$4,376 → -$3,784 / +$591 | 2026-08-18 08:00 / $722 → $446 / -$276 |
| VWAP/ROC / recent / touch | 2026-06-22 18:11 / -$4,515 → -$4,121 / +$395 | 2026-06-20 14:48 / $456 → $178 / -$277 |
| Structure / older / confirmed | 2025-11-20 04:00 / -$2,062 → -$1,332 / +$730 | 2026-04-17 08:58 / $942 → $465 / -$477 |
| Structure / older / touch | 2025-11-20 04:00 / -$2,062 → -$1,332 / +$730 | 2026-06-22 13:32 / $770 → $421 / -$349 |
| Structure / recent / confirmed | 2026-05-27 09:41 / $178 → $549 / +$371 | 2026-06-17 16:28 / $879 → $685 / -$194 |
| Structure / recent / touch | 2026-05-27 09:45 / $177 → $503 / +$326 | 2026-06-22 13:32 / $770 → $421 / -$349 |

## 6. Intervention sample and source-delay sensitivity

Counts below are repeated blocked decision checks / distinct affected episodes. Models and windows overlap; do not sum episode counts into an independent sample. Unknown checks were zero.

| Variant | Recent touch | Recent confirmed | Older touch | Older confirmed |
| --- | ---: | ---: | ---: | ---: |
| VWAP/ROC | 581 / 17 | 592 / 21 | 3152 / 57 | 2852 / 58 |
| Hourly structure | 400 / 19 | 580 / 25 | 1564 / 52 | 1611 / 54 |

Extra 60 seconds applies only to the **new hourly/VWAP context and rolling-high reference**. It does not shift original funding/pulse gates, current prices or execution fills. The matched aggressive-parent source60 repeats are economically unchanged. This is source-age sensitivity, not a real network-delay or maker-fill simulation.

| Recent source60 case | Net | Max DD | Δ own zero-lag | Δ matched aggressive | Blocked episodes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Aggressive 10h unchanged / touch | $40,783 | 20.39% | $0 | $0 | 0 |
| Aggressive + VWAP/ROC guard / touch | $41,310 | 20.65% | -$146 | +$527 | 19 |
| Aggressive + hourly-structure guard / touch | $41,764 | 19.95% | +$261 | +$981 | 21 |
| Aggressive 10h unchanged / confirmed | $46,922 | 25.68% | $0 | $0 | 0 |
| Aggressive + VWAP/ROC guard / confirmed | $45,540 | 25.64% | -$41 | -$1,383 | 22 |
| Aggressive + hourly-structure guard / confirmed | $46,247 | 25.04% | +$198 | -$675 | 26 |

The modest numerical changes do not repair the model disagreement: both delayed filters still lose versus aggressive in the recent confirmed case.

## 7. Validation and provenance

Accepted run:
`4dfaeac55380c408f26c15845fa710fee4725c62355ec7c35d422df6cf6d96ca`.

Definition ID:
`b9415058eec4ea1792227d0c686e67f0c7c7903de801d32316c3bba25dcc946b`.

- All **12 B17/guarded/aggressive controls** reproduce archived L15 full digests and metrics exactly before the variants run. No engine or strategy-baseline changes.
- Source proof validates **14 original stream prefixes**. Appended data starts after the frozen September 10 05:08 cutoff; no historical rows are added to this economic comparison. The loaded series ends exactly at the cutoff.
- Independent checker: **119,204 fills; 8,632,226 minute marks; 3,845,166 TP target checks; 3,849,094 high-rule checks; 117,265 add attempts; 15,869 raw hourly/VWAP feature checks; 13,462 blocked checks** across all 26 runs.
- Each original funding and S/R permission is reconstructed against actual evolving inventory. Blocked decisions cannot produce fills; permitted fills retain next-open timing. Genuine price-drop, shallow, nonnegative-funding and qualified-support bypasses tested.
- Closed-prefix/future-candle mutation, midnight-session, strict threshold, unknown fallback and +60s hour-boundary tests pass. April 18 example above traces a real completed-bar block.
- Fee, monthly equity, completed/end inventory, target/high exit and matched/removed/replacement partitions independently reconcile. Full project and VPS typechecks pass, plus focused test suites and import-isolation check.
- Artifact integrity verification passes. Its generic `economicQualification: not_evaluated` field is not a strategy approval; study-specific screens are in `ranking.json`, both false.

Two **pre-economic** setup failures are preserved, not silently overwritten:
first `9efe5cb0...bd8b6e` compared a prior runtime-state protection hash to a fresh VPS sync; second `be803f51...8b6acb` eagerly imported a loader before its frozen end-date environment was set. The second was stopped during series construction, before any case. The accepted run separates current state protection from historical inputs and defers loader imports. Exact-control gates remained mandatory. Neither failed attempt contributes an economic result or new strategy definition.

### Files and reproduction

- [Frozen card](../research-inputs/aggressive10-selective-2026-09-11.json), [method/run commands](../docs/research/aggressive10-selective-e1.md).
- [Runner](../scripts/hype-aggressive10-selective-study.ts), [policy](../scripts/aggressive10-selective-policy.ts), [source proof](../scripts/aggressive10-selective-sources.ts), [tests](../scripts/aggressive10-selective-tests.ts), [independent verifier](../scripts/aggressive10-selective-verify.ts).
- Local raw outputs: `backtests/research-workflow/4dfaeac55380c408f26c15845fa710fee4725c62355ec7c35d422df6cf6d96ca/`.
- `output/results.json`, `comparisons.json`, `ranking.json`, `overview.csv`, `monthly.csv`, `control-parity.json`, `source-proof.json`, per-case inventory/attempt/target/high traces, and independent `verification.json`.
- Never overwrite the accepted output or verification receipt. Research code/card/findings are eligible for version control under the existing preservation rules; large raw outputs remain local. This turn does not commit or push them.

## 8. Conclusion and bounded next direction

**Keep aggressive 10h unchanged as the lead research candidate. Do not add either guard on this evidence.** The exact claim “either of these selective guards is a robust incremental upgrade” fails this screen. This does not falsify every VWAP, price-structure or selective-exposure idea.

The useful lesson is more specific than “blocks do not work”: an add changes both exposure and the price required to escape. Cohorts can select losers while an actual block misses recoveries or creates worse replacement trades. We now have causal examples and full-path numbers rather than assuming selected loss dollars are savings.

### Side observations / not run here

- No new hot-reopen filter, combined VWAP/structure condition, HL threshold, sustained-cascade rule or broader tuning grid was added.
- Earlier diagnostics leave several major June uptrend-pullback losses outside the newly permitted timer/reopen scopes. These two rules do not close that gap.
- **High-exit-only cooldown** remains a separate, already-outlined experiment: aggressive parent with inherited cooldown versus narrowly scoped 1h/2h cooldown after the two-day-high exit only. It could change recovery participation; it has not been tested here.
- Recovery/TP patience remains a separate backlog, not a reason to fit more conditions to this pass's losing episodes. No new rules selected from the April example.
- No live recommendation or new forward-observation claim. User-promoted lead status does not waive the existing monthly screen.

Research inventory increases by **2 ladder definitions**, not 26 strategies: **5,261 standalone / 158 ladder overlays**, L09 component profiles separate. Controls and delay repetitions are not recounted.
