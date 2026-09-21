# F06: conditional soft-stale TP findings

September 10, 2026. Local research only. Live configuration, execution, state and shorts unchanged.

## TL;DR

- **No policy passes the complete cross-period screen.** Four new definitions, eight exact controls and 48 variant paths; 56 verified runs. No deployment recommendation.
- B17 is the exact unchanged causal current-stack replay. Published July 1, 2025–August 19, 2026 21:32 UTC; recent May 17, 2026 20:43–September 8, 2026 17:47 UTC. Separate flat $32,000 starts; windows overlap and are not independent evidence.
- Test mechanism: retain 1.4% instead of accepting eligible 0.5% soft-stale, conditionally and only until 8h. No new half-exits, construction changes or fee assumptions. Fees remain 0.055% per side.

## What exactly changed

Ordinary eligibility is oldest remaining rung age >=4h **and current gross PnL <0.5%**, not age alone. The experiment grants a one-way permission to defer at first eligibility. Failed/unknown context or age 8h ends permission; it cannot restart in the same episode. After release, the ordinary soft-stale predicate applies. It is not a permanently latched reduced target.

| Setup | Condition permitting extension |
|---|---|
| B17 unchanged | Original4h /0.5% rule |
| No soft-stale reference | Reduction disabled entirely; previously tested, not a new definition |
| Structure /8h | Closed4h close>=EMA200 AND EMA50>=previous EMA50; canonical249-bar seed |
| VWAP + ROC /8h | Closed1h close>UTC-day VWAP AND hourly ROC5>0 |
| Resistance room /8h | Known confirmed resistance>=normal target*1.001, healthy14d coverage |
| Unconditional /8h | Same bounded extension without a context filter |

All S/R trims, entry gates, sizes, hard/emergency exits, actual remaining-rung age and last-add clocks stay in force. Unknown context declines extension, not normal protection. Every changed target becomes usable only after its decision bar.

## Wins and losses beside the baseline

Winning/losing dollars include all realized partials of each completed episode and both-side fees. Net also includes partial cash in any unfinished episode and final open PnL. Win/loss is the whole episode's net outcome, not the exit label: a forced close can belong to a profitable episode after earlier partials. Drawdown includes bar-low stress, not just closes. Rounded display only; CSV/JSON retain precision.

### Published window — prior-armed touch

| Setup | Wins / losses | Winning $ | Losing $ | Realized | Open PnL | Net | Δ B17 | Max DD | Min equity | TP / forced |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B17 unchanged | 955 / 57 | $187,738 | -$140,906 | $46,832 | $0 | $46,832 | +$0 | 28.17% | $30,236 | 953 / 59 |
| No soft-stale (control) | 614 / 61 | $231,206 | -$172,028 | $59,178 | $0 | $59,178 | +$12,346 | 25.48% | $31,082 | 607 / 68 |
| Structure / 8h | 791 / 57 | $197,512 | -$160,380 | $37,132 | $0 | $37,132 | -$9,700 | 33.97% | $25,125 | 787 / 61 |
| VWAP + ROC / 8h | 885 / 56 | $196,131 | -$146,201 | $49,929 | $0 | $49,929 | +$3,097 | 27.60% | $30,182 | 881 / 60 |
| Resistance room / 8h | 924 / 57 | $186,487 | -$143,854 | $42,633 | $0 | $42,633 | -$4,199 | 30.29% | $30,495 | 922 / 59 |
| Unconditional / 8h | 740 / 57 | $210,227 | -$158,873 | $51,354 | $0 | $51,354 | +$4,522 | 36.85% | $24,656 | 735 / 62 |

### Published window — close-confirmed / next open

| Setup | Wins / losses | Winning $ | Losing $ | Realized | Open PnL | Net | Δ B17 | Max DD | Min equity | TP / forced |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B17 unchanged | 788 / 60 | $190,819 | -$171,329 | $19,490 | $0 | $19,490 | +$0 | 45.65% | $27,028 | 785 / 63 |
| No soft-stale (control) | 489 / 61 | $228,599 | -$177,443 | $51,156 | $0 | $51,156 | +$31,666 | 27.91% | $31,082 | 483 / 67 |
| Structure / 8h | 661 / 59 | $203,620 | -$175,006 | $28,615 | $0 | $28,615 | +$9,125 | 35.99% | $29,321 | 656 / 64 |
| VWAP + ROC / 8h | 734 / 58 | $203,830 | -$168,312 | $35,518 | $0 | $35,518 | +$16,028 | 29.73% | $30,594 | 728 / 64 |
| Resistance room / 8h | 769 / 60 | $191,260 | -$175,381 | $15,879 | $0 | $15,879 | -$3,611 | 45.92% | $26,141 | 766 / 63 |
| Unconditional / 8h | 618 / 58 | $209,954 | -$172,372 | $37,582 | $0 | $37,582 | +$18,092 | 34.19% | $28,318 | 611 / 65 |

### Recent HL window — prior-armed touch

| Setup | Wins / losses | Winning $ | Losing $ | Realized | Open PnL | Net | Δ B17 | Max DD | Min equity | TP / forced |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B17 unchanged | 295 / 10 | $57,130 | -$33,009 | $24,121 | -$3,207 | $20,914 | +$0 | 24.69% | $31,410 | 295 / 10 |
| No soft-stale (control) | 188 / 10 | $66,565 | -$35,619 | $30,946 | -$3,208 | $27,738 | +$6,824 | 24.19% | $30,976 | 186 / 12 |
| Structure / 8h | 257 / 10 | $66,764 | -$34,077 | $32,687 | -$3,208 | $29,478 | +$8,565 | 21.23% | $31,410 | 257 / 10 |
| VWAP + ROC / 8h | 278 / 10 | $59,295 | -$35,865 | $23,431 | -$3,348 | $20,083 | -$831 | 22.35% | $31,410 | 278 / 10 |
| Resistance room / 8h | 283 / 10 | $57,126 | -$34,625 | $22,501 | -$3,207 | $19,294 | -$1,620 | 26.49% | $31,410 | 283 / 10 |
| Unconditional / 8h | 242 / 10 | $67,914 | -$34,946 | $32,968 | -$3,208 | $29,759 | +$8,846 | 20.35% | $31,410 | 242 / 10 |

### Recent HL window — close-confirmed / next open

| Setup | Wins / losses | Winning $ | Losing $ | Realized | Open PnL | Net | Δ B17 | Max DD | Min equity | TP / forced |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B17 unchanged | 243 / 11 | $59,238 | -$40,192 | $19,046 | -$3,207 | $15,839 | +$0 | 31.11% | $30,371 | 242 / 12 |
| No soft-stale (control) | 158 / 10 | $71,783 | -$38,490 | $33,294 | -$3,209 | $30,085 | +$14,246 | 28.13% | $30,371 | 157 / 11 |
| Structure / 8h | 202 / 11 | $65,105 | -$40,448 | $24,658 | -$3,207 | $21,450 | +$5,612 | 30.42% | $30,371 | 201 / 12 |
| VWAP + ROC / 8h | 232 / 12 | $63,073 | -$40,287 | $22,786 | -$3,207 | $19,578 | +$3,740 | 30.01% | $30,371 | 231 / 13 |
| Resistance room / 8h | 230 / 11 | $60,438 | -$41,001 | $19,437 | -$3,207 | $16,229 | +$391 | 33.13% | $30,371 | 229 / 12 |
| Unconditional / 8h | 194 / 10 | $65,623 | -$38,008 | $27,615 | -$3,207 | $24,407 | +$8,569 | 25.44% | $30,371 | 192 / 12 |

## What this tells us

The unconditional 8h control improves recent net by **+$8,846 touch / +$8,569 confirmed**. All three context-filtered versions earn less than that simple 8h control in both recent models.

For recent touch, age8 changes winning dollars by **+$10,783** but losing dollars by **+$1,937** (positive means more losses). This is not uniformly smaller losers. It changes cycle occupancy and winner capture as well as exit prices.

The older touch drawdown moves **28.17% -> 36.85%** under age8. Its worst older month delta is **-$7,126**. Recent improvement therefore does not establish cross-regime safety.

Conclusion is restricted to these four 8h definitions. It does not prove B17 globally optimal, reject all conditional TP ideas, or justify switching off soft-stale. The next requested experiment should address exposure while the ladder is being built, without combining changes or rescuing F05 half-exits.

## Ranking and fixed screen

Ranking below uses the smaller of the two recent-model net improvements, not pooled/average PnL. The full screen additionally requires recent+$1,000 in both models, nonnegative published improvement, no worse drawdown and **every month Δ>=-$250**. A single positive headline is insufficient.

| Setup | Recent touch Δ | Recent confirmed Δ | Published touch Δ | Published confirmed Δ | Screen |
|---|---:|---:|---:|---:|---|
| Unconditional / 8h | +$8,846 | +$8,569 | +$4,522 | +$18,092 | FAIL |
| No soft-stale (control) | +$6,824 | +$14,246 | +$12,346 | +$31,666 | FAIL |
| Structure / 8h | +$8,565 | +$5,612 | -$9,700 | +$9,125 | FAIL |
| VWAP + ROC / 8h | -$831 | +$3,740 | +$3,097 | +$16,028 | FAIL |
| Resistance room / 8h | -$1,620 | +$391 | -$4,199 | -$3,611 | FAIL |

**Unconditional / 8h:** published_window-close_confirmed:monthly; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly

**No soft-stale (control):** published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-resting_touch:monthly

**Structure / 8h:** published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:monthly

**VWAP + ROC / 8h:** published_window-close_confirmed:monthly; published_window-resting_touch:monthly; hl_extended-resting_touch:net; hl_extended-resting_touch:monthly

**Resistance room / 8h:** published_window-close_confirmed:net; published_window-close_confirmed:drawdown; published_window-close_confirmed:monthly; published_window-resting_touch:net; published_window-resting_touch:drawdown; published_window-resting_touch:monthly; hl_extended-close_confirmed:net; hl_extended-close_confirmed:drawdown; hl_extended-close_confirmed:monthly; hl_extended-resting_touch:net; hl_extended-resting_touch:drawdown; hl_extended-resting_touch:monthly

## Every month, including adverse trade-offs

Cells show marked-to-market month PnL; variant cells include Δ versus that row's B17. Boundary months are partial. Complete per-month W/L, winning/losing dollars and realized PnL are in `monthly.csv`.

### published_window-resting_touch

| Month | B17 unchanged | No soft-stale (control) | Structure / 8h | VWAP + ROC / 8h | Resistance room / 8h | Unconditional / 8h |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | $2,668 | $1,788 (-$880) | -$4,786 (-$7,454) | $248 (-$2,420) | $2,926 (+$258) | -$3,553 (-$6,221) |
| 2025-08 | $561 | $2,653 (+$2,092) | $1,196 (+$635) | $1,218 (+$658) | $400 (-$161) | -$1,466 (-$2,026) |
| 2025-09 | $5,608 | $8,293 (+$2,685) | $5,694 (+$85) | $6,082 (+$474) | $5,608 (+$0) | $8,266 (+$2,658) |
| 2025-10 | $7,325 | $13,490 (+$6,165) | $11,685 (+$4,360) | $9,016 (+$1,691) | $6,604 (-$721) | $12,962 (+$5,637) |
| 2025-11 | -$1,443 | $819 (+$2,262) | -$1,443 (+$0) | $37 (+$1,480) | -$929 (+$513) | $532 (+$1,975) |
| 2025-12 | -$509 | $1,564 (+$2,073) | -$509 (+$0) | $362 (+$872) | -$509 (+$0) | $905 (+$1,414) |
| 2026-01 | -$246 | -$4,710 (-$4,465) | -$1,414 (-$1,168) | $1,438 (+$1,684) | $355 (+$601) | $1,833 (+$2,079) |
| 2026-02 | $4,940 | $5,985 (+$1,045) | $5,714 (+$774) | $4,802 (-$138) | $3,750 (-$1,190) | $5,968 (+$1,028) |
| 2026-03 | $11,159 | $7,848 (-$3,312) | $4,034 (-$7,126) | $11,158 (-$1) | $12,281 (+$1,121) | $4,034 (-$7,126) |
| 2026-04 | $2,065 | $7,743 (+$5,678) | $1,541 (-$523) | $2,939 (+$875) | $2,248 (+$183) | $6,127 (+$4,062) |
| 2026-05 | $15,753 | $16,456 (+$702) | $13,240 (-$2,513) | $15,507 (-$246) | $13,744 (-$2,009) | $13,287 (-$2,466) |
| 2026-06 | $1,584 | $1,911 (+$328) | $5,664 (+$4,080) | $2,218 (+$635) | -$1,212 (-$2,796) | $7,293 (+$5,709) |
| 2026-07 | -$3,950 | -$6,426 (-$2,477) | -$4,509 (-$559) | -$6,743 (-$2,793) | -$3,950 (+$0) | -$5,857 (-$1,907) |
| 2026-08 | $1,317 | $1,766 (+$449) | $1,025 (-$293) | $1,645 (+$328) | $1,317 (+$0) | $1,025 (-$293) |

### published_window-close_confirmed

| Month | B17 unchanged | No soft-stale (control) | Structure / 8h | VWAP + ROC / 8h | Resistance room / 8h | Unconditional / 8h |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | -$3,050 | $1,263 (+$4,313) | $1,289 (+$4,339) | $3,073 (+$6,122) | -$3,313 (-$263) | $1,230 (+$4,280) |
| 2025-08 | $1,420 | $1,738 (+$318) | $216 (-$1,204) | $55 (-$1,365) | $795 (-$625) | -$1,826 (-$3,246) |
| 2025-09 | $6,247 | $7,301 (+$1,054) | $6,095 (-$152) | $7,827 (+$1,581) | $6,247 (-$0) | $7,116 (+$869) |
| 2025-10 | $7,167 | $11,062 (+$3,896) | $11,187 (+$4,020) | $10,186 (+$3,019) | $6,463 (-$704) | $11,551 (+$4,384) |
| 2025-11 | -$688 | $911 (+$1,600) | -$688 (-$0) | $994 (+$1,682) | -$90 (+$598) | $1,656 (+$2,344) |
| 2025-12 | $673 | $3,202 (+$2,529) | $673 (-$0) | $1,246 (+$573) | $673 (+$0) | $1,192 (+$519) |
| 2026-01 | -$8,750 | -$3,420 (+$5,330) | -$9,209 (-$459) | -$6,766 (+$1,983) | -$9,323 (-$573) | -$6,128 (+$2,622) |
| 2026-02 | -$6,255 | -$7,449 (-$1,194) | -$5,514 (+$741) | -$6,255 (-$0) | -$5,250 (+$1,004) | -$5,703 (+$552) |
| 2026-03 | $12,689 | $13,910 (+$1,221) | $13,956 (+$1,267) | $13,303 (+$615) | $13,050 (+$362) | $13,956 (+$1,267) |
| 2026-04 | $2,401 | $5,797 (+$3,396) | $215 (-$2,186) | $877 (-$1,524) | $2,776 (+$375) | $1,139 (-$1,262) |
| 2026-05 | $15,721 | $22,235 (+$6,515) | $17,099 (+$1,378) | $17,814 (+$2,093) | $12,801 (-$2,920) | $17,145 (+$1,425) |
| 2026-06 | -$2,243 | -$1,502 (+$741) | -$2,522 (-$278) | -$977 (+$1,267) | -$3,108 (-$864) | $594 (+$2,838) |
| 2026-07 | -$7,858 | -$5,985 (+$1,874) | -$6,513 (+$1,346) | -$8,018 (-$159) | -$7,858 (+$0) | -$6,672 (+$1,187) |
| 2026-08 | $2,017 | $2,092 (+$75) | $2,330 (+$314) | $2,159 (+$142) | $2,017 (-$0) | $2,330 (+$314) |

### hl_extended-resting_touch

| Month | B17 unchanged | No soft-stale (control) | Structure / 8h | VWAP + ROC / 8h | Resistance room / 8h | Unconditional / 8h |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | $13,483 | $18,465 (+$4,982) | $16,982 (+$3,499) | $14,089 (+$606) | $13,109 (-$374) | $16,982 (+$3,499) |
| 2026-06 | $1,584 | $1,911 (+$328) | $5,664 (+$4,080) | $2,218 (+$635) | -$1,212 (-$2,796) | $7,293 (+$5,709) |
| 2026-07 | -$3,950 | -$6,426 (-$2,477) | -$4,509 (-$559) | -$6,743 (-$2,793) | -$3,950 (-$0) | -$5,857 (-$1,907) |
| 2026-08 | $9,684 | $14,174 (+$4,490) | $11,481 (+$1,797) | $10,418 (+$734) | $11,234 (+$1,550) | $11,481 (+$1,797) |
| 2026-09 | $112 | -$386 (-$498) | -$140 (-$252) | $100 (-$12) | $112 (+$0) | -$140 (-$252) |

### hl_extended-close_confirmed

| Month | B17 unchanged | No soft-stale (control) | Structure / 8h | VWAP + ROC / 8h | Resistance room / 8h | Unconditional / 8h |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | $17,131 | $21,991 (+$4,860) | $19,308 (+$2,177) | $18,419 (+$1,288) | $17,378 (+$247) | $19,308 (+$2,177) |
| 2026-06 | -$2,243 | -$1,502 (+$741) | -$2,522 (-$278) | -$977 (+$1,267) | -$3,108 (-$864) | $594 (+$2,838) |
| 2026-07 | -$7,858 | -$5,985 (+$1,874) | -$6,513 (+$1,346) | -$8,018 (-$159) | -$7,858 (+$0) | -$6,672 (+$1,187) |
| 2026-08 | $10,239 | $15,832 (+$5,593) | $12,605 (+$2,367) | $11,582 (+$1,344) | $11,246 (+$1,007) | $12,605 (+$2,367) |
| 2026-09 | -$1,429 | -$251 (+$1,178) | -$1,429 (+$0) | -$1,429 (+$0) | -$1,429 (+$0) | -$1,429 (+$0) |

## Invisible upside and occupancy

A changed target changes how long a ladder occupies the account and which later ladders are possible. This table includes all replacement trades; it is not a cherry-picked review of eventual flattens.

| Model / setup | Winning $ Δ | Losing $ Δ (positive = worse) | TP Δ | Forced Δ | Matched contribution | Removed count / net | Replacement count / net | Open + unfinished Δ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| published_window-resting_touch / No soft-stale (control) | +$43,468 | +$31,122 | -346 | 9 | +$17,192 | 579 / $4,046 | 242 / -$800 | -$0 |
| published_window-resting_touch / Structure / 8h | +$9,774 | +$19,474 | -166 | 2 | -$8,365 | 378 / -$14,295 | 214 / -$15,630 | -$0 |
| published_window-resting_touch / VWAP + ROC / 8h | +$8,392 | +$5,296 | -72 | 1 | -$1,472 | 234 / $4,001 | 163 / $8,570 | -$0 |
| published_window-resting_touch / Resistance room / 8h | -$1,251 | +$2,948 | -31 | 0 | -$4,398 | 61 / $5,155 | 30 / $5,355 | -$0 |
| published_window-resting_touch / Unconditional / 8h | +$22,489 | +$17,967 | -218 | 3 | +$9,132 | 494 / -$5,102 | 279 / -$9,712 | -$0 |
| published_window-close_confirmed / No soft-stale (control) | +$37,780 | +$6,114 | -302 | 4 | +$8,628 | 507 / $1,359 | 209 / $24,398 | +$0 |
| published_window-close_confirmed / Structure / 8h | +$12,802 | +$3,677 | -129 | 1 | -$8,142 | 307 / -$10,428 | 179 / $6,840 | +$0 |
| published_window-close_confirmed / VWAP + ROC / 8h | +$13,011 | -$3,017 | -57 | 1 | +$15,508 | 194 / $2,924 | 138 / $3,444 | -$0 |
| published_window-close_confirmed / Resistance room / 8h | +$441 | +$4,052 | -19 | 0 | -$9,018 | 67 / $3,586 | 48 / $8,993 | -$0 |
| published_window-close_confirmed / Unconditional / 8h | +$19,135 | +$1,042 | -174 | 2 | +$4,298 | 409 / -$2,960 | 237 / $10,835 | +$0 |
| hl_extended-resting_touch / No soft-stale (control) | +$9,434 | +$2,609 | -109 | 2 | +$16,566 | 182 / $1,874 | 75 / -$7,868 | -$1 |
| hl_extended-resting_touch / Structure / 8h | +$9,633 | +$1,068 | -38 | 0 | +$1,643 | 125 / -$5,888 | 87 / $1,035 | -$1 |
| hl_extended-resting_touch / VWAP + ROC / 8h | +$2,165 | +$2,855 | -17 | 0 | -$6,492 | 54 / -$8,604 | 37 / -$2,803 | -$140 |
| hl_extended-resting_touch / Resistance room / 8h | -$5 | +$1,615 | -12 | 0 | -$6,347 | 22 / -$1,913 | 10 / $2,814 | +$0 |
| hl_extended-resting_touch / Unconditional / 8h | +$10,783 | +$1,937 | -53 | 0 | +$13,729 | 151 / -$1,228 | 98 / -$6,111 | -$1 |
| hl_extended-close_confirmed / No soft-stale (control) | +$12,545 | -$1,703 | -85 | -1 | +$2,140 | 150 / -$804 | 64 / $11,303 | -$1 |
| hl_extended-close_confirmed / Structure / 8h | +$5,867 | +$255 | -41 | 0 | +$727 | 101 / $4,510 | 60 / $9,394 | -$0 |
| hl_extended-close_confirmed / VWAP + ROC / 8h | +$3,834 | +$95 | -11 | 1 | +$4,410 | 33 / $4,703 | 23 / $4,033 | +$0 |
| hl_extended-close_confirmed / Resistance room / 8h | +$1,200 | +$809 | -13 | 0 | -$5,768 | 35 / $175 | 22 / $6,334 | +$0 |
| hl_extended-close_confirmed / Unconditional / 8h | +$6,384 | -$2,184 | -50 | 0 | +$11,646 | 119 / $5,353 | 69 / $2,276 | +$0 |

Identity: total Δ = matched Δ − removed baseline net + replacement net + open/unfinished Δ. Removed/replacement episodes are whole-path attribution, not a claim that their loss/win was predictable at entry.

## Source/release-delay sensitivity

Extra60s source lag changes only new context availability. Extra60s release delay retains an already active normal target briefly before relinquishing deferral; it does not delay hard exits, initial refusal, or every exchange action. No fee/price improvement is assumed.

| Model / setup | Primary net Δ | Source +60s Δ | Release +60s Δ | Primary extra5bps/side Δ | Extensions / refusals / releases |
|---|---:|---:|---:|---:|---:|
| published_window-resting_touch / Structure / 8h | -$9,700 | -$9,700 | -$9,700 | -$5,796 | 216 / 132 / 140 |
| published_window-resting_touch / VWAP + ROC / 8h | +$3,097 | +$3,332 | +$3,097 | +$4,132 | 162 / 229 / 129 |
| published_window-resting_touch / Resistance room / 8h | -$4,199 | -$4,199 | -$4,199 | -$3,347 | 36 / 388 / 28 |
| published_window-resting_touch / Unconditional / 8h | +$4,522 | +$4,522 | +$4,365 | +$8,841 | 324 / 0 / 210 |
| published_window-close_confirmed / Structure / 8h | +$9,125 | +$9,125 | +$9,035 | +$12,041 | 201 / 131 / 134 |
| published_window-close_confirmed / VWAP + ROC / 8h | +$16,028 | +$14,896 | +$14,760 | +$16,461 | 169 / 202 / 134 |
| published_window-close_confirmed / Resistance room / 8h | -$3,611 | -$3,611 | -$3,611 | -$2,836 | 38 / 352 / 26 |
| published_window-close_confirmed / Unconditional / 8h | +$18,092 | +$18,092 | +$18,090 | +$21,935 | 300 / 0 / 203 |
| hl_extended-resting_touch / Structure / 8h | +$8,565 | +$8,565 | +$8,565 | +$8,899 | 78 / 23 / 55 |
| hl_extended-resting_touch / VWAP + ROC / 8h | -$831 | -$917 | -$831 | -$543 | 44 / 67 / 36 |
| hl_extended-resting_touch / Resistance room / 8h | -$1,620 | -$1,620 | -$1,620 | -$1,210 | 10 / 108 / 6 |
| hl_extended-resting_touch / Unconditional / 8h | +$8,846 | +$8,846 | +$8,846 | +$9,306 | 94 / 0 / 66 |
| hl_extended-close_confirmed / Structure / 8h | +$5,612 | +$5,612 | +$5,612 | +$6,409 | 64 / 20 / 44 |
| hl_extended-close_confirmed / VWAP + ROC / 8h | +$3,740 | +$3,740 | +$3,740 | +$3,605 | 44 / 53 / 37 |
| hl_extended-close_confirmed / Resistance room / 8h | +$391 | +$391 | +$391 | +$860 | 13 / 84 / 6 |
| hl_extended-close_confirmed / Unconditional / 8h | +$8,569 | +$8,569 | +$8,569 | +$9,493 | 79 / 0 / 56 |

## One causal decision trace

Case `hl_extended-resting_touch--vwap_roc8--primary`: at **2026-05-18T13:00:00.000Z**, actual depth4, oldest remaining age4.03h, price45.8770, average45.7008. Ordinary TP was eligible for0.5%; the experiment retained1.4%.

The selected completed source frame ended **2026-05-18T13:00:00.000Z**, no later than the decision. Evidence: `{"endTs":1779109200000,"close":45.877,"dayStart":1779062400000,"healthy":true,"vwap":45.716984530214596,"roc5":1.3318902681450862,"sourceAt":1779109200000,"lag":0}`.

Permission was relinquished at **2026-05-18T15:00:00.000Z**; effective release **2026-05-18T15:00:00.000Z**. Reason/evidence: `{"healthy":true,"allowed":false,"evidence":{"endTs":1779116400000,"close":44.675,"dayStart":1779062400000,"healthy":true,"vwap":45.674505155799054,"roc5":-1.2925320371188653,"sourceAt":1779116400000,"lag":0}}`.

A resulting new target is usable only on subsequent bars. The independent checker matches every TP close to its previously armed target; the fixture explicitly rejects a high that occurred earlier in the target-change candle.

## Integrity and limitations

- 8 exact archived digests/metrics/ledgers reproduced before variants. 56 cases checked independently: 289,354 fills, 21,320,264 minute marks, 269,396 target changes and 16,234 policy transitions.
- Raw recomputation: 3,852 4h EMA frames, 15,412 hourly VWAP/ROC frames; 12 nonempty S/R prefix checks. Target evidence traces stored in causal-traces.json.
- Input/source/protected-file hashes retained. No live config, state, production order behavior, shorts, deployment, commit or push changed.
- The archived historical engine is not silently rehashed: an exact pre-F06 copy and repeated controls establish the research-only hook bridge. Historical runs retain their original pins.
- An initial implementation attempt was stopped after20 completed cases: a1%-bounded proximity helper did not implement the frozen nearest-known-resistance rule. Its source/results are preserved in the sibling invalidated-buffer-lookup directory. Corrected lookup uses all confirmed zones without geometry/threshold changes, a beyond-buffer regression passes, and all56 final paths were rerun fresh. The invalidated paths are not extra accepted strategies or evidence against the intended resistance rule.
- No untouched holdout; already examined overlapping periods. Intrabar fills are a model, not proof of maker queue priority. Fees are unchanged taker assumptions; no funding-settlement, liquidation or joint-account certification.
- Unconditional no-soft-stale remains an informative reference, not a new validated optimum. Positive net and a failed monthly/DD screen can coexist.

## Next separate experiment

Exposure control **during construction**, as requested. Keep unchanged B17 as its reference and avoid combining F06 with sizing/spacing on the first pass. No further filters are attached to F05 half-exits. Freeze a small construction-specific card before economic runs; distinguish losses avoided, TP cycles sacrificed and replacement occupancy.

## Files

- [Frozen F06 design and commands](../docs/research/conditional-soft-stale-f06.md).
- [Frozen card](../research-inputs/conditional-soft-stale-2026-09-10.json).
- Results: `backtests/hype/hype-conditional-soft-stale-2026-09-10`: overview.csv, monthly.csv, results.json, comparisons.json, ranking.json, verification.json and per-case inventories/targets/observations.
- [Earlier component audit](codex-astra-ladder-components-findings-2026-09-08.md); [F05 outcomes](codex-astra-recovery-mechanism-findings-2026-09-10.md).
