# L13 — winning ladder singles and eight combination replays

## TL;DR

- **86 fresh economic executions, 28 exact archived controls, 8 frozen two-leg combinations.** All 60 primary comparison rows use identical windows, capital and execution assumptions. Seven singles include unchanged B17; no live settings changed.
- **Highest recent minimum-model combination uplift:** Soft-stale extension to 8h + No deep funding guard. Its recent totals are $32,573 / 19.90% resting-touch and $29,345 / 21.07% close-confirmed, versus baseline $20,887 / 24.69% / $15,812 / 31.11%. These are simulated net / max DD, not account returns.
- **0/8 pairs pass the full frozen screen; 0/8 improve both constituent singles' net without worsening either constituent's DD in all four primary cases.** Aggregate baseline improvement and useful combination synergy are different questions. Monthly failures and sacrificed recovery cycles remain visible below.

## Practical reading of the results

**There is meaningful combined improvement versus B17.** Three pairs improve total net and maximum drawdown in both windows and both TP models: age8 + two-day-high exit; no-soft-stale + half11; no-soft-stale + removal of the deep funding guard. None meets the unchanged monthly screen. That is not the same as saying the combinations do nothing.

**Most relevant loss-reduction lead: age8 + two-day-high exit.** Recent resting-touch winning dollars rise from $57,130 to $62,655 while losing dollars fall from $33,009 to $25,546. Completed net improves about $12,988; end-inventory/unfinished cash explains another $3,351 of its $16,340 total uplift. Under close-confirmed TP it also improves net and DD versus B17, but June is $2,108 worse. Older totals improve $14,499 touch / $15,705 confirmed, with lower DD in both, yet some older months sacrifice about $5k. Its recent touch drawdown24.35% is worse than age8 alone20.35%, although slightly better than B17's24.69%.

**Strongest recent balanced profit/DD pair: age8 + no deep funding guard.** It beats both singles on recent net and DD in both TP models, but older touch DD rises to35.33% versus B17's28.17%. Recent touch losing dollars also rise by$2,503: its gain comes from larger winning dollars, not less bleeding. The no-soft-stale + no-guard version passes aggregate baseline net/DD in all four cases, but loses older profit versus no-soft-stale alone and worsens recent July touch by$2,410.

**Defensive alternative: no-soft-stale + half11.** Lower DD and higher net than B17 in all four cases, but it gives up net profit versus no-soft-stale alone in all four. This is a profit/risk exchange, not free added alpha. Adding MFI weekly half-exits to either TP leg reduces recent net versus the TP leg alone in both execution models; retain that negative interaction rather than stacking individually attractive rules automatically.

Raw `forcedCloses` includes discretionary research high exits, even profitable ones. For age8 + high, recent touch has31 new high exits but original hard/emergency/funding exits fall from10 to8; confirmed has34 high exits and original forced exits fall from12 to7. These are not39/41 catastrophic flattens. The full occupancy and cooldown costs remain in the earnings.

## Scope and selection

This is a long-ladder comparison, not a pool of standalone $10k indicator trades, paused short strategies or shared-account returns. The two TP legs are alternative designs: they are never combined with each other. Each is paired separately with four existing mechanisms. No threshold optimization, three-leg portfolio, extra time filter or change to strategy code was introduced.

Selection was frozen before any pair outcomes: eight-hour/no-soft-stale profit-taking leads; half11 as an explicitly defensive (not standalone profit-winning) control; removal of the deep funding guard for its four-case aggregate net/DD record; MFI/weekly half-exit for positive net across four cases; two-day-high 1% stale exit as the strongest new L12 recent minimum-model lead. Structure8, other high horizons, hot-RSI TP cooldown removal and broad risk-control removals remain documented, not silently declared dead or added after seeing pair results.

### Do not confuse raw recent leaders with safe winners

The following preserved component figures end **September 8, 17:47 UTC**, not the September 10 refreshed combination cutoff. Values are net / DD. These controls are diagnostics, not recommendations to dismantle risk gates.

| Setup | Recent touch | Recent confirmed | Older touch | Older confirmed |
|---|---|---|---|---|
| Current B17 | $20,914 / 24.69% | $15,839 / 31.11% | $46,832 / 28.17% | $19,490 / 45.65% |
| Bare timer ladder, TP1.4%, no forced exits/gates | $43,929 / 26.40% | $46,864 / 25.69% | $45,437 / 76.57% | $47,721 / 75.43% |
| Bare ladder + 0.3% alternative adds | $48,875 / 29.80% | $49,504 / 29.32% | $45,899 / 75.60% | $46,860 / 73.93% |
| B01 + 4h soft-stale | $45,936 / 31.32% | $47,613 / 29.98% | $45,271 / 77.45% | $49,466 / 73.13% |
| B02 + emergency exit only | $29,564 / 30.13% | $31,670 / 29.08% | $29,931 / 92.15% | $40,773 / 80.37% |
| Current minus hot-RSI TP cooldown | $23,166 / 22.21% | $26,150 / 20.65% | $38,392 / 27.94% | $37,128 / 23.64% |
| Current minus S/R partials | $21,063 / 23.80% | $24,030 / 24.95% | $52,225 / 28.23% | $35,733 / 30.74% |

These are not the obsolete $65k/$82k pre-repair models. They use the causal B17 component study. Bare setups' high recent totals conceal severe older-period tail exposure. The older touch TP-cooldown-removal loss is about $8.4k versus B17; keeping it outside this small pair set is not a claim its entire family is disproven.

## Aligned replay contract

Recent: **2026-05-17 20:43 → 2026-09-10 05:08 UTC**. Older: **2025-07-01 00:00 → 2026-08-19 21:32 UTC**. Each starts flat at $32,000; $800 × 1.35, maximum 11 rungs, current 0.3%-OR-timer adds, current guards/SR/forced exits except named legs. Periods overlap and have already been researched repeatedly: they are not independent holdouts.

Closed source bars only; market decisions fill at the next minute's open. Resting-touch uses only a previously armed target, not a target invented after observing that minute's high. Close-confirmed is an alternate exit-path sensitivity, not guaranteed worst-case performance. Original **0.055% fees per side** remain; no estimated maker savings are added. Actual funding cash flows, live tick/lot/queue/partial-fill behavior, shared collateral, liquidation and manual pauses are not certified.

W/L are completed ladder episodes, including their partial PnL and fees. Losing dollars are shown negative. **Net = winning dollars + losing dollars + final open mark + unfinished-episode partial cash.** The open ladder is never omitted. Max DD includes bar-low marking. Rounded tables can differ by a dollar; raw CSV retains precision.

## 1. Singles side by side — refreshed recent window

### resting_touch

| Setup | W / L | Winning $ | Losing $ | Open | Unfinished partial | Net | Δ B17 | Max DD |
|---|---|---|---|---|---|---|---|---|
| B17 current baseline | 295 / 10 | $57,130 | −$33,009 | −$3,234 | $0 | $20,887 | $0 | 24.69% |
| Soft-stale extension to 8h | 242 / 10 | $67,914 | −$34,946 | −$3,235 | $0 | $29,732 | +$8,846 | 20.35% |
| No soft-stale reduction | 188 / 10 | $66,565 | −$35,619 | −$3,235 | $0 | $27,711 | +$6,824 | 24.19% |
| 4h stale exit near 2-day high (1%) | 274 / 15 | $52,723 | −$28,402 | −$121 | $237 | $24,438 | +$3,551 | 22.96% |
| MFI + weekly-VWAP half-exit | 292 / 13 | $56,417 | −$28,906 | −$3,234 | $0 | $24,276 | +$3,389 | 20.06% |
| No deep funding guard | 290 / 10 | $60,287 | −$34,467 | −$3,234 | $0 | $22,586 | +$1,700 | 23.56% |
| Half-size rung 11 | 295 / 10 | $51,925 | −$29,095 | −$2,832 | $0 | $19,998 | −$888 | 21.35% |

### close_confirmed

| Setup | W / L | Winning $ | Losing $ | Open | Unfinished partial | Net | Δ B17 | Max DD |
|---|---|---|---|---|---|---|---|---|
| B17 current baseline | 243 / 11 | $59,238 | −$40,192 | −$3,234 | $0 | $15,812 | $0 | 31.11% |
| Soft-stale extension to 8h | 194 / 10 | $65,623 | −$38,008 | −$3,234 | $0 | $24,380 | +$8,569 | 25.44% |
| No soft-stale reduction | 158 / 10 | $71,783 | −$38,490 | −$3,236 | $0 | $30,058 | +$14,246 | 28.13% |
| 4h stale exit near 2-day high (1%) | 232 / 19 | $55,875 | −$32,840 | −$121 | $237 | $23,152 | +$7,340 | 21.08% |
| MFI + weekly-VWAP half-exit | 243 / 11 | $59,238 | −$35,138 | −$3,234 | $0 | $20,866 | +$5,054 | 26.08% |
| No deep funding guard | 234 / 11 | $61,368 | −$38,945 | −$3,234 | $0 | $19,188 | +$3,377 | 29.72% |
| Half-size rung 11 | 240 / 11 | $54,842 | −$34,377 | −$2,831 | $0 | $17,634 | +$1,822 | 26.98% |

## 2. Eight combinations — versus baseline AND each individual leg

Sorted by the smaller recent net uplift across the two TP models, not the single best-looking run. A positive baseline delta alone does not establish a useful combination: it can simply inherit one strong leg while the second leg subtracts money.

### resting_touch

Baseline: $20,887 / 24.69%.

| Pair | W / L | Winning $ | Losing $ | Net | Max DD | Δ baseline | Δ TP leg alone | Δ other leg alone |
|---|---|---|---|---|---|---|---|---|
| Soft-stale extension to 8h + No deep funding guard | 244 / 10 | $71,320 | −$35,512 | $32,573 | 19.90% | +$11,686 | +$2,840 | +$9,987 |
| No soft-stale reduction + No deep funding guard | 183 / 10 | $69,969 | −$36,327 | $30,406 | 21.15% | +$9,520 | +$2,696 | +$7,820 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | 235 / 13 | $62,655 | −$25,546 | $37,226 | 24.35% | +$16,340 | +$7,494 | +$12,788 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit | 240 / 12 | $67,448 | −$34,558 | $29,655 | 20.35% | +$8,768 | −$78 | +$5,379 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit | 187 / 11 | $66,348 | −$36,807 | $26,306 | 24.80% | +$5,419 | −$1,405 | +$2,030 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) | 185 / 18 | $54,080 | −$28,144 | $26,053 | 28.73% | +$5,166 | −$1,658 | +$1,615 |
| No soft-stale reduction + Half-size rung 11 | 179 / 10 | $59,412 | −$30,858 | $25,722 | 22.20% | +$4,835 | −$1,989 | +$5,723 |
| Soft-stale extension to 8h + Half-size rung 11 | 231 / 10 | $59,879 | −$31,887 | $25,161 | 19.65% | +$4,274 | −$4,572 | +$5,162 |

### close_confirmed

Baseline: $15,812 / 31.11%.

| Pair | W / L | Winning $ | Losing $ | Net | Max DD | Δ baseline | Δ TP leg alone | Δ other leg alone |
|---|---|---|---|---|---|---|---|---|
| Soft-stale extension to 8h + No deep funding guard | 190 / 10 | $70,526 | −$37,947 | $29,345 | 21.07% | +$13,534 | +$4,965 | +$10,157 |
| No soft-stale reduction + No deep funding guard | 146 / 10 | $74,782 | −$37,831 | $33,714 | 22.21% | +$17,903 | +$3,656 | +$14,526 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | 193 / 15 | $60,636 | −$35,613 | $25,140 | 28.29% | +$9,328 | +$759 | +$1,988 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit | 192 / 12 | $65,232 | −$39,649 | $22,349 | 28.03% | +$6,537 | −$2,032 | +$1,483 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit | 156 / 12 | $70,956 | −$39,920 | $27,801 | 30.73% | +$11,989 | −$2,257 | +$6,935 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) | 167 / 16 | $65,843 | −$35,728 | $30,231 | 27.90% | +$14,420 | +$173 | +$7,079 |
| No soft-stale reduction + Half-size rung 11 | 154 / 10 | $65,318 | −$32,768 | $29,719 | 22.45% | +$13,907 | −$339 | +$12,085 |
| Soft-stale extension to 8h + Half-size rung 11 | 187 / 10 | $58,036 | −$32,942 | $22,263 | 23.20% | +$6,452 | −$2,117 | +$4,630 |

### Recent interaction and unfinished inventory

Interaction = pair uplift − (first single uplift + second single uplift). This is occupancy/price-path interaction, not an independent alpha estimate or a significance test.

| Pair / model | Interaction $ | Open mark | Unfinished partial | TP-affected episodes | Size episodes | Actual cut episodes | TP/other overlap |
|---|---|---|---|---|---|---|---|
| Soft-stale extension to 8h + No deep funding guard / resting_touch | +$1,141 | −$3,235 | $0 | 97 | 0 | 0 | 0 |
| Soft-stale extension to 8h + No deep funding guard / close_confirmed | +$1,588 | −$3,234 | $0 | 81 | 0 | 0 | 0 |
| No soft-stale reduction + No deep funding guard / resting_touch | +$996 | −$3,235 | $0 | 63 | 0 | 0 | 0 |
| No soft-stale reduction + No deep funding guard / close_confirmed | +$280 | −$3,236 | $0 | 61 | 0 | 0 | 0 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / resting_touch | +$3,943 | −$121 | $237 | 103 | 0 | 31 | 25 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / close_confirmed | −$6,581 | −$121 | $237 | 88 | 0 | 34 | 31 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / resting_touch | −$3,467 | −$3,235 | $0 | 94 | 0 | 4 | 4 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / close_confirmed | −$7,086 | −$3,234 | $0 | 79 | 0 | 3 | 3 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / resting_touch | −$4,794 | −$3,235 | $0 | 63 | 0 | 1 | 1 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / close_confirmed | −$7,311 | −$3,236 | $0 | 62 | 0 | 2 | 2 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / resting_touch | −$5,209 | −$121 | $237 | 74 | 0 | 35 | 31 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / close_confirmed | −$7,167 | −$121 | $237 | 76 | 0 | 35 | 34 |
| No soft-stale reduction + Half-size rung 11 / resting_touch | −$1,101 | −$2,832 | $0 | 63 | 62 | 0 | 55 |
| No soft-stale reduction + Half-size rung 11 / close_confirmed | −$2,161 | −$2,832 | $0 | 58 | 66 | 0 | 53 |
| Soft-stale extension to 8h + Half-size rung 11 / resting_touch | −$3,683 | −$2,832 | $0 | 91 | 89 | 0 | 82 |
| Soft-stale extension to 8h + Half-size rung 11 / close_confirmed | −$3,939 | −$2,831 | $0 | 78 | 83 | 0 | 71 |

The guard-removal leg has no separate exact intervention counter in this wrapper. It is not assigned invented counts: its single is marked n-unmeasured, and pair counts cover the TP leg only. MFI/high cut counts are reported separately; numerous TP deferrals cannot manufacture a large sample for a rare half-exit. Source-delay repetitions are not extra independent trades.

## 3. Older-window risk and profit — every single and pair

| Setup | Touch net / DD | Touch Δ baseline | Confirmed net / DD | Confirmed Δ baseline |
|---|---|---|---|---|
| B17 current baseline | $46,832 / 28.17% | $0 | $19,490 / 45.65% | $0 |
| Soft-stale extension to 8h | $51,354 / 36.85% | +$4,522 | $37,582 / 34.19% | +$18,092 |
| No soft-stale reduction | $59,178 / 25.48% | +$12,346 | $51,156 / 27.91% | +$31,666 |
| 4h stale exit near 2-day high (1%) | $44,159 / 36.27% | −$2,674 | $28,652 / 45.02% | +$9,162 |
| MFI + weekly-VWAP half-exit | $48,825 / 29.85% | +$1,993 | $26,590 / 40.79% | +$7,100 |
| No deep funding guard | $51,066 / 26.71% | +$4,234 | $23,138 / 36.22% | +$3,649 |
| Half-size rung 11 | $39,312 / 25.45% | −$7,520 | $23,355 / 31.35% | +$3,865 |
| Soft-stale extension to 8h + No deep funding guard | $57,515 / 35.33% | +$10,682 | $38,000 / 33.51% | +$18,510 |
| No soft-stale reduction + No deep funding guard | $50,965 / 27.33% | +$4,133 | $44,634 / 29.48% | +$25,144 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | $61,332 / 27.55% | +$14,499 | $35,194 / 25.17% | +$15,705 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit | $53,130 / 34.99% | +$6,297 | $36,113 / 33.78% | +$16,624 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit | $62,174 / 25.32% | +$15,341 | $52,516 / 28.60% | +$33,026 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) | $37,619 / 31.19% | −$9,214 | $30,860 / 32.41% | +$11,370 |
| No soft-stale reduction + Half-size rung 11 | $47,465 / 23.93% | +$633 | $43,843 / 27.04% | +$24,354 |
| Soft-stale extension to 8h + Half-size rung 11 | $42,776 / 37.20% | −$4,056 | $32,504 / 30.78% | +$13,015 |

## 4. All months for the five highest-ranked recent results

Each cell is monthly MTM **/ delta versus the baseline in that same row**. Includes the change in open inventory, not just close-date PnL. Boundary months are partial. Complete monthly W/L, winning/losing dollars and realized cash for every setup/model/phase are in `output/monthly.csv`.

### hl_extended / resting_touch

| UTC month | Baseline MTM | Soft-stale extension to 8h + No deep funding guard | No soft-stale reduction + No deep funding guard | Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | Soft-stale extension to 8h | No soft-stale reduction |
|---|---|---|---|---|---|---|
| 2026-05 | $13,483 | $18,228 / +$4,745 | $19,964 / +$6,481 | $15,490 / +$2,007 | $16,982 / +$3,499 | $18,465 / +$4,982 |
| 2026-06 | $1,584 | $6,664 / +$5,080 | $3,349 / +$1,766 | $8,313 / +$6,729 | $7,293 / +$5,709 | $1,911 / +$328 |
| 2026-07 | −$3,950 | −$3,895 / +$55 | −$6,360 / −$2,410 | $1,439 / +$5,389 | −$5,857 / −$1,907 | −$6,426 / −$2,477 |
| 2026-08 | $9,684 | $11,822 / +$2,137 | $13,933 / +$4,248 | $11,205 / +$1,521 | $11,481 / +$1,797 | $14,174 / +$4,490 |
| 2026-09 | $85 | −$246 / −$331 | −$480 / −$565 | $779 / +$693 | −$167 / −$252 | −$413 / −$498 |

### hl_extended / close_confirmed

| UTC month | Baseline MTM | Soft-stale extension to 8h + No deep funding guard | No soft-stale reduction + No deep funding guard | Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | Soft-stale extension to 8h | No soft-stale reduction |
|---|---|---|---|---|---|---|
| 2026-05 | $17,131 | $19,743 / +$2,613 | $19,842 / +$2,711 | $17,475 / +$345 | $19,308 / +$2,177 | $21,991 / +$4,860 |
| 2026-06 | −$2,243 | $3,243 / +$5,487 | $2,400 / +$4,644 | −$4,351 / −$2,108 | $594 / +$2,838 | −$1,502 / +$741 |
| 2026-07 | −$7,858 | −$5,236 / +$2,622 | −$5,057 / +$2,801 | $30 / +$7,888 | −$6,672 / +$1,187 | −$5,985 / +$1,874 |
| 2026-08 | $10,239 | $13,025 / +$2,786 | $16,807 / +$6,568 | $12,920 / +$2,682 | $12,605 / +$2,367 | $15,832 / +$5,593 |
| 2026-09 | −$1,456 | −$1,430 / +$25 | −$277 / +$1,178 | −$934 / +$521 | −$1,456 / $0 | −$278 / +$1,178 |

### published_window / resting_touch

| UTC month | Baseline MTM | Soft-stale extension to 8h + No deep funding guard | No soft-stale reduction + No deep funding guard | Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | Soft-stale extension to 8h | No soft-stale reduction |
|---|---|---|---|---|---|---|
| 2025-07 | $2,668 | −$2,913 / −$5,581 | $2,679 / +$11 | $7,549 / +$4,881 | −$3,553 / −$6,221 | $1,788 / −$880 |
| 2025-08 | $561 | −$1,098 / −$1,659 | $2,860 / +$2,299 | −$1,746 / −$2,307 | −$1,466 / −$2,026 | $2,653 / +$2,092 |
| 2025-09 | $5,608 | $8,266 / +$2,658 | $8,293 / +$2,685 | $744 / −$4,864 | $8,266 / +$2,658 | $8,293 / +$2,685 |
| 2025-10 | $7,325 | $10,798 / +$3,473 | $11,594 / +$4,269 | $10,116 / +$2,791 | $12,962 / +$5,637 | $13,490 / +$6,165 |
| 2025-11 | −$1,443 | $1,451 / +$2,894 | −$921 / +$522 | $1,148 / +$2,591 | $532 / +$1,975 | $819 / +$2,262 |
| 2025-12 | −$509 | $1,345 / +$1,855 | $30 / +$540 | −$282 / +$227 | $905 / +$1,414 | $1,564 / +$2,073 |
| 2026-01 | −$246 | $3,768 / +$4,014 | −$3,778 / −$3,532 | $1,697 / +$1,943 | $1,833 / +$2,079 | −$4,710 / −$4,465 |
| 2026-02 | $4,940 | $4,956 / +$16 | $2,112 / −$2,828 | $8,996 / +$4,056 | $5,968 / +$1,028 | $5,985 / +$1,045 |
| 2026-03 | $11,159 | $3,672 / −$7,487 | $7,193 / −$3,967 | $13,495 / +$2,336 | $4,034 / −$7,126 | $7,848 / −$3,312 |
| 2026-04 | $2,065 | $7,156 / +$5,091 | $4,180 / +$2,115 | −$1,828 / −$3,893 | $6,127 / +$4,062 | $7,743 / +$5,678 |
| 2026-05 | $15,753 | $16,594 / +$841 | $18,352 / +$2,598 | $10,650 / −$5,103 | $13,287 / −$2,466 | $16,456 / +$702 |
| 2026-06 | $1,584 | $6,664 / +$5,080 | $3,349 / +$1,766 | $8,313 / +$6,729 | $7,293 / +$5,709 | $1,911 / +$328 |
| 2026-07 | −$3,950 | −$3,895 / +$55 | −$6,360 / −$2,410 | $1,439 / +$5,389 | −$5,857 / −$1,907 | −$6,426 / −$2,477 |
| 2026-08 | $1,317 | $751 / −$566 | $1,381 / +$63 | $1,041 / −$277 | $1,025 / −$293 | $1,766 / +$449 |

### published_window / close_confirmed

| UTC month | Baseline MTM | Soft-stale extension to 8h + No deep funding guard | No soft-stale reduction + No deep funding guard | Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | Soft-stale extension to 8h | No soft-stale reduction |
|---|---|---|---|---|---|---|
| 2025-07 | −$3,050 | $1,951 / +$5,000 | $1,972 / +$5,022 | $8,780 / +$11,830 | $1,230 / +$4,280 | $1,263 / +$4,313 |
| 2025-08 | $1,420 | −$1,708 / −$3,128 | $1,991 / +$571 | $15 / −$1,405 | −$1,826 / −$3,246 | $1,738 / +$318 |
| 2025-09 | $6,247 | $7,116 / +$869 | $7,301 / +$1,054 | $736 / −$5,511 | $7,116 / +$869 | $7,301 / +$1,054 |
| 2025-10 | $7,167 | $11,775 / +$4,608 | $11,286 / +$4,119 | $10,442 / +$3,275 | $11,551 / +$4,384 | $11,062 / +$3,896 |
| 2025-11 | −$688 | $2,411 / +$3,099 | −$885 / −$197 | $1,246 / +$1,934 | $1,656 / +$2,344 | $911 / +$1,600 |
| 2025-12 | $673 | $1,167 / +$494 | $1,184 / +$511 | $691 / +$18 | $1,192 / +$519 | $3,202 / +$2,529 |
| 2026-01 | −$8,750 | −$5,015 / +$3,734 | −$3,680 / +$5,070 | −$5,990 / +$2,760 | −$6,128 / +$2,622 | −$3,420 / +$5,330 |
| 2026-02 | −$6,255 | −$4,882 / +$1,373 | −$7,226 / −$971 | −$2,044 / +$4,211 | −$5,703 / +$552 | −$7,449 / −$1,194 |
| 2026-03 | $12,689 | $11,063 / −$1,626 | $12,168 / −$520 | $13,105 / +$416 | $13,956 / +$1,267 | $13,910 / +$1,221 |
| 2026-04 | $2,401 | −$936 / −$3,337 | $3,213 / +$812 | −$1,515 / −$3,916 | $1,139 / −$1,262 | $5,797 / +$3,396 |
| 2026-05 | $15,721 | $15,366 / −$355 | $17,202 / +$1,482 | $12,136 / −$3,585 | $17,145 / +$1,425 | $22,235 / +$6,515 |
| 2026-06 | −$2,243 | $3,243 / +$5,487 | $2,400 / +$4,644 | −$4,351 / −$2,108 | $594 / +$2,838 | −$1,502 / +$741 |
| 2026-07 | −$7,858 | −$5,236 / +$2,622 | −$5,057 / +$2,801 | $30 / +$7,888 | −$6,672 / +$1,187 | −$5,985 / +$1,874 |
| 2026-08 | $2,017 | $1,687 / −$330 | $2,763 / +$746 | $1,915 / −$102 | $2,330 / +$314 | $2,092 / +$75 |

## 5. Invisible upside and loss contribution

Same-entry episodes are matched; removed baseline entries and replacement entries are reported separately. Matching is a historical contribution identity, not proof that intervening at a particular point would preserve the rest of the old path.

| Pair / model | Matched Δ | Removed baseline net | Replacement net | End/unfinished Δ | Δ total | Δ TP cycles | Δ forced closes |
|---|---|---|---|---|---|---|---|
| Soft-stale extension to 8h + No deep funding guard / resting_touch | +$13,569 | $5,118 | $3,236 | −$1 | +$11,686 | -51 | 0 |
| Soft-stale extension to 8h + No deep funding guard / close_confirmed | +$12,412 | $10,956 | $12,078 | $0 | +$13,534 | -53 | -1 |
| No soft-stale reduction + No deep funding guard / resting_touch | +$17,457 | $2,372 | −$5,564 | −$1 | +$9,520 | -113 | 1 |
| No soft-stale reduction + No deep funding guard / close_confirmed | −$4,643 | $5,122 | $27,669 | −$1 | +$17,903 | -96 | -2 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / resting_touch | +$8,385 | $4,956 | $9,560 | +$3,351 | +$16,340 | -86 | 29 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / close_confirmed | +$15,684 | $7,457 | −$2,250 | +$3,351 | +$9,328 | -75 | 29 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / resting_touch | +$12,317 | −$1,228 | −$4,776 | −$1 | +$8,768 | -53 | 0 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / close_confirmed | +$11,646 | $5,353 | $244 | $0 | +$6,537 | -50 | 0 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / resting_touch | +$15,162 | $1,874 | −$7,868 | −$1 | +$5,419 | -109 | 2 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / close_confirmed | +$2,140 | −$804 | $9,046 | −$1 | +$11,989 | -85 | -1 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / resting_touch | +$9,668 | $7,301 | −$552 | +$3,351 | +$5,166 | -136 | 34 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / close_confirmed | +$9,050 | $3,373 | $5,391 | +$3,351 | +$14,420 | -102 | 31 |
| No soft-stale reduction + Half-size rung 11 / resting_touch | +$7,288 | −$132 | −$2,988 | +$403 | +$4,835 | -118 | 2 |
| No soft-stale reduction + Half-size rung 11 / close_confirmed | +$2,666 | −$2,806 | $8,032 | +$403 | +$13,907 | -89 | -1 |
| Soft-stale extension to 8h + Half-size rung 11 / resting_touch | +$8,108 | −$677 | −$4,914 | +$403 | +$4,274 | -65 | 1 |
| Soft-stale extension to 8h + Half-size rung 11 / close_confirmed | +$7,500 | $4,800 | $3,348 | +$404 | +$6,452 | -55 | -2 |

Identity: matched Δ − removed net + replacement net + end/unfinished Δ = total net Δ. A loss closed earlier is not assumed to save the old flatten amount; subsequent entries and the surviving inventory are replayed.

## 6. Source-arrival sensitivity

Only new MFI+weekly inputs and the new high reference are delayed by 60 seconds. Existing HL consumers retain canonical timing. The current observed HYPE decision price is not artificially delayed. No new funding-delay experiment or fill-delay parameter was introduced.

| Setup / model | Primary net / DD | +60s source net / DD | Net change |
|---|---|---|---|
| MFI + weekly-VWAP half-exit / close_confirmed | $20,866 / 26.08% | $20,866 / 26.08% | $0 |
| MFI + weekly-VWAP half-exit / resting_touch | $24,276 / 20.06% | $24,276 / 20.06% | $0 |
| 4h stale exit near 2-day high (1%) / close_confirmed | $23,152 / 21.08% | $23,152 / 21.08% | $0 |
| 4h stale exit near 2-day high (1%) / resting_touch | $24,438 / 22.96% | $24,438 / 22.96% | $0 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / close_confirmed | $22,349 / 28.03% | $22,349 / 28.03% | $0 |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit / resting_touch | $29,655 / 20.35% | $29,655 / 20.35% | $0 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / close_confirmed | $25,140 / 28.29% | $25,140 / 28.29% | $0 |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) / resting_touch | $37,226 / 24.35% | $37,226 / 24.35% | $0 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / close_confirmed | $27,801 / 30.73% | $27,801 / 30.73% | $0 |
| No soft-stale reduction + MFI + weekly-VWAP half-exit / resting_touch | $26,306 / 24.80% | $26,306 / 24.80% | $0 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / close_confirmed | $30,231 / 27.90% | $30,231 / 27.90% | $0 |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) / resting_touch | $26,053 / 28.73% | $26,053 / 28.73% | $0 |

## 7. Qualification — thresholds not changed after results

Full screen: recent net uplift ≥$1,000 in both models; older uplift ≥0; no DD increase; every monthly MTM delta ≥−$250; ≥20 recent intervention episodes; no modeled nonpositive equity. Any pass is research-only and still needs forward observation. The half-exit interventions remain a small, conditional sample even when the paired TP leg has many observations.

| Setup | Full screen | Beats both constituent net/DD in all four cases | Failure reasons |
|---|---|---|---|
| Soft-stale extension to 8h | FAIL | n/a | published_window-close_confirmed:monthly; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| No soft-stale reduction | FAIL | n/a | published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| 4h stale exit near 2-day high (1%) | FAIL | n/a | published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:monthly |
| MFI + weekly-VWAP half-exit | FAIL | n/a | published_window-close_confirmed:monthly; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:thin; hl_extended-resting_touch:thin |
| No deep funding guard | FAIL | n/a | published_window-resting_touch:monthly; published_window-close_confirmed:monthly; hl_extended-resting_touch:monthly; hl_extended-resting_touch:intervention_n_unmeasured; hl_extended-close_confirmed:monthly; hl_extended-close_confirmed:intervention_n_unmeasured |
| Half-size rung 11 | FAIL | n/a | published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:net; hl_extended-resting_touch:monthly |
| Soft-stale extension to 8h + No deep funding guard | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| No soft-stale reduction + No deep funding guard | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| Soft-stale extension to 8h + 4h stale exit near 2-day high (1%) | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly |
| Soft-stale extension to 8h + MFI + weekly-VWAP half-exit | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| No soft-stale reduction + MFI + weekly-VWAP half-exit | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:drawdown; hl_extended-resting_touch:monthly |
| No soft-stale reduction + 4h stale exit near 2-day high (1%) | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:drawdown; hl_extended-resting_touch:monthly |
| No soft-stale reduction + Half-size rung 11 | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly |
| Soft-stale extension to 8h + Half-size rung 11 | FAIL | NO | published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:monthly |

## Exact mechanism and interaction notes

- **Eight-hour leg:** F06 one-way permission to keep 1.4% when ordinary 4h soft-stale would first reduce TP to0.5%, released by8h oldest surviving rung. Partial exits do not reset original entry timestamps. Once released, permission cannot restart within that episode; ordinary soft-stale predicate resumes. Not the same as unconditionally holding every trade8h.
- **No-soft-stale:** keeps normal target; hard flatten, emergency, S/R partials, funding-spike exit and all existing entry gates remain active. It does not mean 'never close a loss'.
- **Half11:** reduce the requested next-depth11 clip by50% after the original full-size affordability and outer gates pass. Both timer and real price-drop entries are covered; lower rungs, clocks, IDs and post-S/R behavior are unchanged.
- **No deep funding guard:** only that negative-funding/deep time-add restriction is disabled. Existing support-reopen exception becomes redundant; this is not a second added buy signal. No short, portfolio leverage or other regime gate is changed.
- **MFI weekly half-exit:** first deep>=9, gross−3% crossing; assess exactly60minutes later in the same episode while depth>=9. Closed30m MFI14<=20 plus completed1h price below actual UTC-week VWAP and ROC5<=0. Unknown context rejects only experimental action. Pro-rata50% next-open cut; no further episode adds. No second PnL requirement was invented. Original exits/SR partials take priority.
- **Near-high exit:** any depth, oldest surviving rung>=4h, current closed-minute price within1% of the past2880 fully closed minutes' high. Full next-open exit, no PnL floor, normal4–8h forced cooldown. It can pre-empt the 8h target extension; it is not a same-wick exit or a hindsight peak sale.

## Reproduction and validation

Job: `c849de9b2538591a9e7f4ae248c166566a43a0bc55ca1acfd58d1157c37ea2cc`. Frozen card: [winning-ladder-combinations-2026-09-11.json](../research-inputs/winning-ladder-combinations-2026-09-11.json).

```powershell
npx ts-node scripts/ladder-combination-tests.ts
npx ts-node scripts/hype-ladder-combination-study.ts plan research-inputs/winning-ladder-combinations-2026-09-11.json
npx ts-node scripts/hype-ladder-combination-study.ts run c849de9b2538591a9e7f4ae248c166566a43a0bc55ca1acfd58d1157c37ea2cc
npx ts-node scripts/ladder-combination-target-audit-tests.ts
npx ts-node scripts/ladder-combination-review.ts c849de9b2538591a9e7f4ae248c166566a43a0bc55ca1acfd58d1157c37ea2cc
```

The run command intentionally refuses to overwrite an already-claimed/completed job. The verifier independently reconstructs raw high, MFI/weekly context, target clocks, sizes/fills, pro-rata cuts/no-rebuild, minute equity/DD, fees, monthly accounting and comparison identities. Canonical engine, production code, live configs and state remain pinned. Raw large outputs stay local under the job directory.

```json
{
  "passed": true,
  "auditSources": [
    {
      "file": "scripts/ladder-combination-review.ts",
      "sha256": "c2c156fe17e57a7b873804893c3fc8e00db3ff29613070be64ffee7d04ff7385"
    },
    {
      "file": "scripts/ladder-combination-target-audit.ts",
      "sha256": "944aa8095e1d1d2607d06c5dfbb5edfe96ed7ed33b2704c7351904bd411fe744"
    },
    {
      "file": "scripts/ladder-combination-target-audit-tests.ts",
      "sha256": "174f8f081c94d1fa4a481922ddbbd717f7d104c4fa4824b82735ee8e4e75efa7"
    }
  ],
  "auditRefinement": "Independent checker now distinguishes ordinary pre-arm close scheduling from research post-arm close scheduling. Original pinned economic sources/results remain unchanged.",
  "economicCases": 86,
  "controlsExact": 28,
  "fills": 356888,
  "minutes": 27200074,
  "sizeChecks": 310276,
  "targetChecks": 5096207,
  "highChecks": 3216150,
  "mfiChecks": 876,
  "newTradingDefinitions": 8,
  "liveChanges": 0
}
```

Audit corrections: the original pinned verifier reused an F06 assumption that every market full-close decision precedes TP arm(). L13 near-high research closes are scheduled after arm(), so it incorrectly omitted those bars' legitimate target observations. Also, this wrapper's compressed target-price telemetry omits same-price rearming after pro-rata cuts. The final reviewer reconstructs every arm independently from all-minute target rules and quiesce/fill events, rather than pretending the compressed price changes are a complete arm ledger. Regressions cover ordinary/research closes, pending-cutoff cases and unchanged-price post-partial rearming. These are verification/telemetry limitations, not changes to trading decisions. Audit source hashes are in the verification receipt; original job pins, economic results, policies and engine were not edited or rerun to change outcomes. Do not use the superseded initial verifier for this composite exit path.

Side observations: none of this proves global optimality, makes source streams interchangeable, or exhausts other entry/exit combinations. Only the eight named pairs were tested. No live deployment, commit or push is part of this research pass.
