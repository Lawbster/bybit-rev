# AG10-C1: high-exit-only cooldown — findings

September 11, 2026. **Keep the aggressive10h parent's inherited high-exit cooldown. Neither fixed shorter wait is an upgrade. Research only; no live changes.**

## TL;DR

- **2 frozen definitions, 26 economic runs, 12 exact archived controls.** Shorten the cooldown only after the two-day-high full exit to1h or2h. Both lose profit versus aggressive10h in **all four period/TP comparisons**. Recent net costs are $5,719/$6,831 for1h and $7,235/$8,971 for2h (touch/confirmed). Older costs are $15k–$18k. **0/2 complete B17 or incremental passes.**
- **38–50 actual earlier first-rung reopens per recent primary case**, well above the frozen20-intervention minimum. Earlier entries capture many wins, but losing dollars rise in every case. Recent touch1h has **270 wins/16 losses** versus parent's **242/16**, yet loses $5,719 of net: $4,057 more winning dollars is outweighed by $9,761 more losing dollars and $15 less end contribution.
- Independent audit passes **124,040 fills, 8,632,226 minute marks, 12,516 close-cooldown transitions and108,130 add attempts**. All six +60s source repeats preserve their zero-lag economics. The negative result is not solely an end-inventory mark, small n, fee assumption or strict monthly gate. Both strategies already fail aggregate parent profit.

## 1. Frozen definitions and what did not change

[Card](../research-inputs/aggressive10-cooldown-2026-09-11.json) / [method](../docs/research/aggressive10-high-cooldown-c1.md).

| Setup | Definition |
|---|---|
| B17 | Current-config pinned canonical replay baseline from L15. Not exact realized live maker-fee accounting. |
| Guarded10h | Ordinary soft-stale TP deferral up to10h; full exit from age4h within1% of trailing two-day high; original deep funding guard and hot-RSI post-TP cooldown retained. |
| Aggressive10h | Same TP/high pair, but deep negative-funding timer guard and hot-RSI post-TP cooldown disabled. Everything else inherited. |
| +high cooldown1h | Aggressive10h with exactly1h from actual high-exit fill to entry eligibility. |
| +high cooldown2h | Same, with exactly2h. |

The parent's high-exit deadline is `(floor(fillAt / 4h) + 2) * 4h`: **4–8h**, not a fixed4h wait. The new deadline is `fillAt + 1h/2h`, only after a realized **full** close with exact reason `research_exit:exit_2d_1pct`.

No shortening after ordinary/stale TP, hard flatten, emergency, funding spike, a partial exit or another research reason. No same-fill-bar reopen. At/after expiry, entry still has to pass the ordinary trend/risk-off/latch/overextension/affordability gates. No larger orders, altered entry clocks, thresholds, partials, TP prices or exit priority. Neither AG10-E1 selective guard is included.

## 2. Time windows, capital and economics

| Window | Independently flat start UTC | End UTC |
|---|---|---|
| Recent HL-extended | 2026-05-17 20:43 | 2026-09-10 05:08 |
| Older published | 2025-07-01 00:00 | 2026-08-19 21:32 |

Each uses **$32,000**, $800 x1.35, maximum11 rungs and unchanged **0.055% each-side fees**. Funding signals are inputs, but funding cashflow, actual maker savings/queue/fills, Bybit liquidation and shared-account margin are not certified.

Resting-touch uses a previously armed target touched by a later bar. Close-confirmed requires completed-minute confirmation and the inherited next-open execution. Ordinary entries and discretionary exits use next-open fills. These are different evolving inventory paths, not independent datasets or guaranteed bounds.

Periods overlap and have been repeatedly examined; no holdout claim. Subsequent synced rows beyond September10 05:08 are excluded from economics by source-prefix and cutoff proof.

Total net includes completed episode net plus marked open inventory and unfinished partial proceeds. Completed W/L dollars include trading fees and each closed ladder's partial proceeds.

## 3. Five-setup comparisons

### Recent: May17–September10,2026

| Setup | Touch net | Touch max DD | Confirmed net | Confirmed max DD |
| --- | ---: | ---: | ---: | ---: |
| B17 current replay baseline | $20,887 | 24.69% | $15,812 | 31.11% |
| Guarded 10h | $36,542 | 24.22% | $34,839 | 27.64% |
| Aggressive 10h unchanged | $40,783 | 20.39% | $46,922 | 25.68% |
| Aggressive + high-exit cooldown 1h | $35,064 | 23.47% | $40,092 | 22.72% |
| Aggressive + high-exit cooldown 2h | $33,548 | 24.47% | $37,951 | 24.02% |

### Older: July1,2025–August19,2026

| Setup | Touch net | Touch max DD | Confirmed net | Confirmed max DD |
| --- | ---: | ---: | ---: | ---: |
| B17 current replay baseline | $46,832 | 28.17% | $19,490 | 45.65% |
| Guarded 10h | $67,781 | 24.67% | $40,382 | 27.32% |
| Aggressive 10h unchanged | $61,635 | 25.09% | $64,976 | 30.17% |
| Aggressive + high-exit cooldown 1h | $43,730 | 34.13% | $49,721 | 31.22% |
| Aggressive + high-exit cooldown 2h | $44,897 | 28.86% | $46,606 | 31.99% |

### Incremental effect versus unchanged aggressive10h

| Variant / case | Net Δ | Max-DD Δ (+ worse) | Winning dollars Δ | Losing dollars Δ (+ worse) | TP-cycle Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1h / Recent / resting-touch | -$5,719 | +3.07pp | +$4,057 | +$9,761 | +18 |
| 2h / Recent / resting-touch | -$7,235 | +4.08pp | +$2,638 | +$9,858 | +13 |
| 1h / Recent / close-confirmed | -$6,831 | -2.97pp | -$1,935 | +$4,882 | -6 |
| 2h / Recent / close-confirmed | -$8,971 | -1.66pp | -$2,724 | +$5,124 | -12 |
| 1h / Older / resting-touch | -$17,904 | +9.04pp | +$12,239 | +$30,143 | +39 |
| 2h / Older / resting-touch | -$16,737 | +3.76pp | +$8,589 | +$25,326 | +30 |
| 1h / Older / close-confirmed | -$15,255 | +1.06pp | +$4,730 | +$19,984 | +20 |
| 2h / Older / close-confirmed | -$18,370 | +1.82pp | +$391 | +$18,761 | +5 |

Both shorter waits reduce maximum DD in the recent confirmed model, but lose profit there and worsen DD in the other three cases. More wins and more completed cycles are not enough when loss size increases. Older resting-touch net/DD is also worse than **B17 itself**, not just worse than the aggressive parent.

### Winners, losers and end inventory

Losing dollars are shown as positive absolute amounts. “Other full closes” includes profitable high exits; it is not a count of losing flattens. Net = winning dollars - losing dollars + end contribution, subject to rounding.

#### Recent / resting-touch

| Setup | Wins / losses | Winning dollars | Losing dollars | End contribution | Total net | TP / other closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 295 / 10 | $57,130 | $33,009 | -$3,234.44 | $20,887 | 295 / 10 |
| Guarded 10h | 229 / 13 | $61,971 | $25,546 | $116.69 | $36,542 | 203 / 39 |
| Aggressive 10h unchanged | 242 / 16 | $68,731 | $27,948 | -$0.87 | $40,783 | 216 / 42 |
| Aggressive + high-exit cooldown 1h | 270 / 16 | $72,789 | $37,709 | -$15.73 | $35,064 | 234 / 52 |
| Aggressive + high-exit cooldown 2h | 262 / 15 | $71,369 | $37,806 | -$15.42 | $33,548 | 229 / 48 |

#### Recent / close-confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars | End contribution | Total net | TP / other closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 243 / 11 | $59,238 | $40,192 | -$3,234.44 | $15,812 | 242 / 12 |
| Guarded 10h | 196 / 14 | $67,463 | $32,741 | $116.69 | $34,839 | 168 / 42 |
| Aggressive 10h unchanged | 215 / 13 | $77,533 | $30,610 | -$0.87 | $46,922 | 184 / 44 |
| Aggressive + high-exit cooldown 1h | 221 / 18 | $75,598 | $35,491 | -$14.91 | $40,092 | 178 / 61 |
| Aggressive + high-exit cooldown 2h | 214 / 15 | $74,808 | $35,734 | -$1,123.36 | $37,951 | 172 / 57 |

#### Older / resting-touch

| Setup | Wins / losses | Winning dollars | Losing dollars | End contribution | Total net | TP / other closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 955 / 57 | $187,738 | $140,906 | $0.00 | $46,832 | 953 / 59 |
| Guarded 10h | 756 / 69 | $198,212 | $130,431 | $0.00 | $67,781 | 642 / 183 |
| Aggressive 10h unchanged | 765 / 75 | $210,530 | $148,896 | $0.00 | $61,635 | 642 / 198 |
| Aggressive + high-exit cooldown 1h | 847 / 98 | $222,770 | $179,039 | $0.00 | $43,730 | 681 / 264 |
| Aggressive + high-exit cooldown 2h | 825 / 94 | $219,119 | $174,222 | $0.00 | $44,897 | 672 / 247 |

#### Older / close-confirmed

| Setup | Wins / losses | Winning dollars | Losing dollars | End contribution | Total net | TP / other closes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B17 current replay baseline | 788 / 60 | $190,819 | $171,329 | $0.00 | $19,490 | 785 / 63 |
| Guarded 10h | 644 / 68 | $195,909 | $155,527 | $0.00 | $40,382 | 515 / 197 |
| Aggressive 10h unchanged | 670 / 67 | $220,017 | $155,052 | $10.61 | $64,976 | 532 / 205 |
| Aggressive + high-exit cooldown 1h | 736 / 99 | $224,747 | $175,036 | $10.61 | $49,721 | 552 / 283 |
| Aggressive + high-exit cooldown 2h | 708 / 90 | $220,408 | $173,813 | $10.61 | $46,606 | 537 / 261 |

The recent2h confirmed path ends with one unfinished early-reopen ladder, marked -$1,123.36; unchanged aggressive ends around -$0.87. Even excluding this end-inventory difference, the2h completed net is approximately **$7,849 worse**. The1h recent end contribution differs by only about$14–$15. The direction is not caused by terminal inventory accounting.

## 4. Every month's marked PnL

Continuous runs, not monthly restarts. B17 is absolute monthly marked net. G = guarded10h; A = aggressive10h; C1/C2 =1h/2h high-exit cooldown. Delta columns identify their comparator. Partial first/last months follow the precise windows above; overlapping periods can differ because earlier inventory paths differ.

### Recent / resting-touch

| Month | B17 net | G Δ B17 | A Δ B17 | C1 Δ B17 | C2 Δ B17 | C1 Δ A | C2 Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | $13,483 | +$2,458 | +$6,758 | +$7,414 | +$7,826 | +$656 | +$1,068 |
| 2026-06 | $1,584 | +$6,243 | +$7,410 | +$1,766 | +$661 | -$5,644 | -$6,749 |
| 2026-07 | -$3,950 | +$5,016 | +$2,638 | +$1,163 | +$611 | -$1,475 | -$2,027 |
| 2026-08 | $9,684 | +$1,253 | +$3,209 | +$2,998 | +$3,084 | -$211 | -$124 |
| 2026-09 | $85 | +$686 | -$118 | +$837 | +$478 | +$955 | +$596 |

### Recent / close-confirmed

| Month | B17 net | G Δ B17 | A Δ B17 | C1 Δ B17 | C2 Δ B17 | C1 Δ A | C2 Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | $17,131 | +$745 | +$1,793 | +$3,107 | +$3,158 | +$1,314 | +$1,365 |
| 2026-06 | -$2,243 | +$6,313 | +$12,975 | +$8,505 | +$6,485 | -$4,470 | -$6,490 |
| 2026-07 | -$7,858 | +$7,726 | +$11,233 | +$7,494 | +$7,626 | -$3,738 | -$3,606 |
| 2026-08 | $10,239 | +$3,722 | +$4,674 | +$4,524 | +$5,602 | -$150 | +$928 |
| 2026-09 | -$1,456 | +$521 | +$435 | +$649 | -$733 | +$214 | -$1,168 |

### Older / resting-touch

| Month | B17 net | G Δ B17 | A Δ B17 | C1 Δ B17 | C2 Δ B17 | C1 Δ A | C2 Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | $2,668 | +$5,431 | +$3,613 | -$745 | -$1,285 | -$4,358 | -$4,897 |
| 2025-08 | $561 | -$658 | +$115 | -$4,356 | -$729 | -$4,471 | -$844 |
| 2025-09 | $5,608 | -$4,864 | -$4,222 | +$2,715 | +$229 | +$6,937 | +$4,451 |
| 2025-10 | $7,325 | +$3,337 | -$317 | -$1,244 | -$709 | -$927 | -$393 |
| 2025-11 | -$1,443 | +$3,642 | +$4,003 | +$1,639 | +$4,646 | -$2,364 | +$642 |
| 2025-12 | -$509 | +$803 | +$1,649 | +$441 | +$702 | -$1,208 | -$947 |
| 2026-01 | -$246 | +$1,899 | +$3,593 | -$756 | -$2,009 | -$4,349 | -$5,601 |
| 2026-02 | $4,940 | +$4,218 | -$7,769 | -$5,233 | -$5,904 | +$2,536 | +$1,865 |
| 2026-03 | $11,159 | +$2,028 | +$1,803 | +$1,262 | -$1,133 | -$541 | -$2,935 |
| 2026-04 | $2,065 | -$1,849 | +$1,855 | +$1,108 | -$375 | -$747 | -$2,231 |
| 2026-05 | $15,753 | -$4,020 | +$463 | -$1,201 | +$2,951 | -$1,664 | +$2,488 |
| 2026-06 | $1,584 | +$6,243 | +$7,410 | +$1,766 | +$661 | -$5,644 | -$6,749 |
| 2026-07 | -$3,950 | +$5,016 | +$2,638 | +$1,163 | +$611 | -$1,475 | -$2,027 |
| 2026-08 | $1,317 | -$277 | -$32 | +$339 | +$409 | +$371 | +$441 |

### Older / close-confirmed

| Month | B17 net | G Δ B17 | A Δ B17 | C1 Δ B17 | C2 Δ B17 | C1 Δ A | C2 Δ A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2025-07 | -$3,050 | +$12,039 | +$9,454 | +$5,935 | +$5,664 | -$3,519 | -$3,790 |
| 2025-08 | $1,420 | -$289 | +$1,999 | -$4,513 | -$962 | -$6,513 | -$2,961 |
| 2025-09 | $6,247 | -$6,301 | -$6,717 | +$561 | -$1,658 | +$7,278 | +$5,058 |
| 2025-10 | $7,167 | +$2,239 | +$392 | +$2,332 | +$3,199 | +$1,940 | +$2,806 |
| 2025-11 | -$688 | +$3,334 | +$3,204 | +$2,163 | +$4,062 | -$1,041 | +$858 |
| 2025-12 | $673 | +$99 | +$2,448 | +$2,223 | +$2,510 | -$226 | +$62 |
| 2026-01 | -$8,750 | +$2,715 | +$13,135 | +$10,497 | +$7,051 | -$2,637 | -$6,084 |
| 2026-02 | -$6,255 | +$55 | -$3,521 | -$2,774 | -$3,479 | +$747 | +$43 |
| 2026-03 | $12,689 | +$1,454 | +$909 | -$1,022 | -$2,060 | -$1,931 | -$2,970 |
| 2026-04 | $2,401 | -$5,541 | +$538 | +$753 | -$2,656 | +$215 | -$3,193 |
| 2026-05 | $15,721 | -$2,848 | -$1,035 | -$2,336 | +$529 | -$1,302 | +$1,563 |
| 2026-06 | -$2,243 | +$6,313 | +$12,975 | +$8,505 | +$6,485 | -$4,470 | -$6,490 |
| 2026-07 | -$7,858 | +$7,726 | +$11,233 | +$7,494 | +$7,626 | -$3,738 | -$3,606 |
| 2026-08 | $2,017 | -$102 | +$471 | +$413 | +$805 | -$58 | +$334 |

## 5. Actual early reopens and their outcomes

An “early reopen” is the first rung after a high exit whose **decision** precedes that same path's inherited4–8h deadline. A deadline changing while another gate keeps the bot flat does not count. This is own-path attribution, **not** an estimate of marginal profits caused by that reopen.

| Variant / case | High exits | Earlier reopens | Completed W / L | Winning dollars | Losing dollars | Completed cohort net |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1h / Recent / resting-touch | 42 | 42 | 36 / 6 | $8,924 | $18,342 | -$9,418 |
| 2h / Recent / resting-touch | 38 | 38 | 32 / 6 | $7,305 | $20,335 | -$13,030 |
| 1h / Recent / close-confirmed | 50 | 50 | 41 / 9 | $12,188 | $19,069 | -$6,881 |
| 2h / Recent / close-confirmed | 46 | 46 | 38 / 7 | $10,570 | $20,792 | -$10,222 |
| 1h / Older / resting-touch | 203 | 202 | 167 / 35 | $42,768 | $52,417 | -$9,650 |
| 2h / Older / resting-touch | 187 | 186 | 157 / 29 | $39,749 | $51,055 | -$11,306 |
| 1h / Older / close-confirmed | 220 | 219 | 180 / 39 | $50,600 | $49,077 | $1,522 |
| 2h / Older / close-confirmed | 199 | 198 | 166 / 32 | $49,055 | $56,206 | -$7,151 |

All recent cohorts lose completed dollars despite approximately82–86% winning completed ladders. Older confirmed1h's early cohort is positive, yet its overall portfolio loses $15,255 versus parent. Cohort net is not the incremental strategy result: replaced baseline trades and changed later paths also matter.

One recent2h confirmed early reopen is unfinished; do not count it as a win or loss. None of the high-exit inherited deadlines itself extends beyond the study cutoff. Models/windows overlap; do not aggregate these n values into independent evidence.

### Full-path attribution

`matched-entry change - removed parent net + replacement net + end-inventory change = total net change`.

Entry timestamps identify matches; a later entry is a replacement rather than assumed to be the same causal ladder. This accounting includes invisible extra TP cycles as well as conspicuous losses.

| Variant / case | Matched n / Δ | Removed n / net | Replacement n / net | End Δ | Portfolio Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1h / Recent / resting-touch | 193 / $0 | 65 / -$6,458 | 93 / -$12,162 | -$14.86 | -$5,719 |
| 2h / Recent / resting-touch | 193 / $0 | 65 / -$6,512 | 84 / -$13,733 | -$14.55 | -$7,235 |
| 1h / Recent / close-confirmed | 142 / $0 | 86 / -$2,272 | 97 / -$9,089 | -$14.04 | -$6,831 |
| 2h / Recent / close-confirmed | 141 / $0 | 87 / $50 | 88 / -$7,799 | -$1,122.49 | -$8,971 |
| 1h / Older / resting-touch | 559 / $0 | 281 / $11,337 | 386 / -$6,567 | $0 | -$17,904 |
| 2h / Older / resting-touch | 550 / $0 | 290 / $9,038 | 369 / -$7,700 | $0 | -$16,737 |
| 1h / Older / close-confirmed | 448 / $0 | 289 / $20,545 | 387 / $5,291 | $0 | -$15,255 |
| 2h / Older / close-confirmed | 446 / $0 | 291 / $19,241 | 352 / $871 | $0 | -$18,370 |

## 6. Mechanism traces: recovery gains exist, but entry timing also worsens damage

### First changed clock: May19,2026,16:30 UTC

All paths fill the high exit at16:30. Parent waits to **May20 00:00**;1h permits17:30 and2h18:30. Actual variant entries occur exactly at those deadlines, at **$48.593** and **$48.288** respectively. The preceding minute closes authorize the next bar's open; the entry bar's future close is not used.

Both shortenings help this first segment. Through the next shared entry on May20 (17:17 touch /17:18 confirmed), completed subsequent-ladder net is:

| Model | Parent net / ladders | 1h net / ladders | 2h net / ladders |
| --- | ---: | ---: | ---: |
| Touch | $766 / 3 | $1,097 / 7 | $1,658 / 6 |
| Confirmed | $889 / 3 | $1,479 / 5 | $2,125 / 5 |

That is genuine recovery participation, not something to dismiss because the whole study loses.

### June4: returning early gets trapped before the later recovery

After the shared **June4 04:18** high exit, parent waits to **12:00**.1h enters05:18;2h enters06:18. Both early ladders reach11 and emergency-close June5: **-$8,456.52** and **-$8,823.12**.

Do not credit their entire loss as parent savings. Parent also suffers substantial later losses. Compare all completed subsequent ladders through the next shared entry, with both paths flat at each boundary:

| Case / endpoint UTC | Parent net / ladders | 1h net / ladders | 2h net / ladders | 1h Δ | 2h Δ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Touch / 2026-06-11 04:00 | -$8,541 / 11 | -$13,036 / 15 | -$13,509 / 15 | -$4,496 | -$4,969 |
| Confirmed / 2026-06-08 00:39 | -$4,285 / 12 | -$6,241 / 8 | -$6,608 / 8 | -$1,956 | -$2,323 |

The first early loss is conspicuous; the additional recoveries it permits later are less visible. Both are included above. These are segment-level path differences, not causal dollars for one rung.

### June20–24: earlier entry misses the later recoveries

Resting-touch only, using a shared **June20 22:49** high-exit boundary. Parent waits to **June21 04:00**, later earns **+$232.89** and **+$770.41**, then loses **$4,515.49** on June23's hard flatten. Its segment net is **-$3,512.20**.

The1h/2h paths reopen June20 23:49 /June21 00:49, remain in that ladder through the intervening recovery moves, and hard-flatten for **-$6,775.61 /-$6,477.34**. Through the next common entry June24 12:00, incremental costs are **$3,263.42 /$2,965.15**.

This is the opposite of “a shorter cooldown must improve recovery capture.” It can leave the ladder with an entry basis that cannot exit those same recoveries. The confirmed parent's boundary here is different, so the touch segment comparison is not silently reused for that model.

These examples explain observed paths, not a rule fitted to their dates. Full-period and monthly results above establish the rejection.

## 7. Source-delay and qualification

All six recent +60s runs reproduce their own zero-lag economics exactly: aggressive parent and both variants in both TP models. Only the rolling-high reference is delayed; current prices, funding/pulse gates, cooldown duration and fills are unchanged. This does not certify actual network latency, exchange postability or maker fills.

Frozen B17 screen: recent net delta >=$1,000 per model, older >=0, no worse DD, every monthly delta >=-$250, >=20 recent actual early reopens and no modeled nonpositive equity.

Frozen incremental screen versus aggressive: positive recent and nonnegative older net, no worse DD, monthly delta >=-$250, >=20 recent early reopens and no modeled nonpositive equity.

| Variant | Aggregate B17 net/DD across all four | Full B17 screen | Full incremental screen |
|---|---|---|---|
|1h|Fail older touch|Fail|Fail: lower net all four, DD worse in three, monthly costs|
|2h|Fail older touch|Fail|Fail: lower net all four, DD worse in three, monthly costs|

Sample minima are met, and no case reaches modeled nonpositive equity. Those are not deployment qualifications or liquidation-safety guarantees. The failures do not depend on the monthly screen alone: both variants already lose aggregate parent profit in every comparison.

Ranked by the smaller recent incremental net result,1h ranks first at **-$6,831**,2h second at **-$8,971**. Both are nonqualifiers; neither displaces the research lead.

## 8. Verification, preservation and files

Accepted run:
`3d8d666c0ecd318536c39ee9bd3d9547a1f9c12956eff22d6d8077c701b63917`.

Definition identity:
`c150ca2bf47f6a3520f3892206c78d6c2668de57c2af6bc2c89d7b8c870a7459`.

- **12/12 archived controls exactly match full digest and metrics** before any variant runs.
- Both original replay engine and high-rule auditor are unchanged. Study-local derivatives match only declared unique source replacements, verified before the run and by the independent checker. No general cooldown refactor or production hook.
- Original14 stream prefixes and immutable source pins verify. Synced tails all start beyond the frozen cutoff. The loaded926,893-candle series ends exactly at2026-09-10 05:08 UTC. Current runtime state is protected, never used as a historical seed.
- Independent **124,040 fills;8,632,226 minute marks;4,076,695 target checks;4,080,672 high-rule checks;108,130 add attempts;12,516 cooldown transitions;1,157 early-entry checks**, including controls and sensitivity runs. These are audit counts, not independent economic samples.
- Every cooldown's actual fill time, reason, previous deadline, inherited deadline and selected deadline is verified. All cooldown-blocked minutes and entry deadlines reconcile. Ordinary TP RSI is rebuilt from its known minute prefix using the existing rolling-hour convention; resting TP uses the prior fill-bar minute, not its future close. No indicator definition changed.
- Independent fee/equity/DD/month and matched/removed/replacement/end partitions reconcile. All source60 results are unchanged.
- Unit tests pass for absent-option parity,1h/2h expiry, no same-bar reopen, preserved trend/risk/latch gates, partial/TP/other/hard/emergency paths, completed prefixes and invalid durations. Import-isolation, broader replay-causality/workflow tests and both project typechecks pass.
- Generic artifact verification reports `artifactsIntact: true`; its generic qualification field is not an approval. The study-specific `ranking.json` records both failed screens.

Implementation and reproduction:

- [Method and commands](../docs/research/aggressive10-high-cooldown-c1.md), [frozen card](../research-inputs/aggressive10-cooldown-2026-09-11.json).
- [Runner](../scripts/hype-aggressive10-cooldown-study.ts), [policy](../scripts/aggressive10-cooldown-policy.ts), [source-delta proof](../scripts/aggressive10-cooldown-source.ts).
- [Study-local engine](../scripts/aggressive10-cooldown-engine.ts), [study-local high audit](../scripts/aggressive10-cooldown-audit.ts), [tests](../scripts/aggressive10-cooldown-tests.ts), [independent checker](../scripts/aggressive10-cooldown-verify.ts).
- Local accepted directory: `backtests/research-workflow/3d8d666c0ecd318536c39ee9bd3d9547a1f9c12956eff22d6d8077c701b63917/`.
- Outputs: `results.json`, `comparisons.json`, `ranking.json`, `overview.csv`, `monthly.csv`, `control-parity.json`, `source-proof.json`, `derivative-proof.json`, per-case inventory/targets/high traces, `*-cooldowns.json`, `*-reopens.json`, and separate `verification.json`.
- Do not overwrite accepted outputs or receipts. Code/card/findings are eligible for version control; raw outputs remain local. Nothing committed or pushed in this turn.

## 9. Conclusion and scope boundary

**Retain the parent's inherited4–8h cooldown after the two-day-high exit.** The exact fixed1h and2h shortenings fail as incremental upgrades. This does not prove every possible conditional reentry policy fails, nor that waiting longer is always profitable.

The lesson is supported by full histories: earlier access captures some wins but also rebuilds exposure before recoveries become sufficient. Repeatedly reopening after a near-high exit can undermine the reason for taking that exit.

### Side observations / not tested here

- No zero wait,3h setting, adaptive cooldown, price-reclaim condition, new HL/S/R filter or source-specific regime tuner.
- No hard/emergency/funding cooldown removal and no E1 selective-guard combination.
- Recovery/TP management remains a separate backlog; no new rule is fitted from the June examples.
- Aggressive10h remains the unchanged research lead with its existing monthly caveats. No live recommendation, config change, deployment or forward-observation result.

Research inventory: **5,261 standalone /160 ladder overlays**, L09 component profiles separate. This adds exactly2 definitions;26 executions include controls and delay repeats.
