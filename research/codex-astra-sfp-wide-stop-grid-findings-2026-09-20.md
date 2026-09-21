# SF07: SFP stop padding 3% to 6%, every 0.25%

## Result

- Highest full-period net: extra 6%, +$11,758, 65 wins / 36 losses, DD 5.73%. Extra 5% earns +$11,495 with lower DD 5.29%; only $264 less net.
- Unchanged baseline: +$2,690, 43 wins / 79 losses, DD 7.92%. Previous 3%: +$7,497, 63 wins / 41 losses, DD 8.47%.
- All 5-6% settings have identical recent outcomes: +$3,232, 15 wins / 5 losses. Zero SL hits there; TP and the 24h timeout determine exits. None of the 13 candidates passes the complete inherited screen: recent DD and several older months worsen. No live changes.

## Frozen comparison

HYPE Bybit perpetual, **2024-12-27 00:00 to 2026-09-15 20:20 UTC**. Original SF01 range-qualified 4h SFP long, fixed $10,000 notional, separate $32,000 DD account. Fees 0.055% per side, before funding. No indicator filters or ladder integration.

**Padding means extra below the old stop**, not total entry-to-stop distance: `stop = originalStop * (1 - padding/100)`. Grid 3.00-6.00 inclusive in 0.25-point steps; unchanged 0% and archived 3% controls. Original signal eligibility, entries, absolute original 2R targets and 24h cap stay fixed. A wider SL does not move TP to a new 2R. Full one-position ownership is replayed, so longer holds can skip later entries.

Signal filters still use original reference risk 0.2-5%; this is not a cap on the padded stop. Decisions use completed bars and the same archived availability clocks. Padding is fixed at entry, not selected from a trade's future low. Windows are development data, not untouched holdouts.

## Top earners with controls

Primary: source lag 60s, no extra action delay, stop-first on ambiguous minutes. W/L means closed net outcomes after fees; net includes cutoff MTM (+$14.86 baseline, +$25.24 candidates).

| Extra stop padding | Wins / losses | Winning $ | Losing $ | Average loss | Worst loss | Net | Delta vs baseline | DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0% | 43 / 79 | $18,124 | -$15,449 | -$196 | -$487 | $2,690 | $0 | 7.92% |
| 3% | 63 / 41 | $22,864 | -$15,393 | -$375 | -$773 | $7,497 | $4,807 | 8.47% |
| 6% | 65 / 36 | $23,376 | -$11,643 | -$323 | -$882 | $11,758 | $9,069 | 5.73% |
| 5% | 65 / 36 | $23,376 | -$11,906 | -$331 | -$963 | $11,495 | $8,805 | 5.29% |
| 5.25% | 65 / 36 | $23,376 | -$12,078 | -$335 | -$987 | $11,323 | $8,633 | 5.44% |
| 5.5% | 65 / 36 | $23,376 | -$12,249 | -$340 | -$1,011 | $11,152 | $8,462 | 5.58% |
| 5.75% | 65 / 36 | $23,376 | -$12,421 | -$345 | -$1,034 | $10,980 | $8,291 | 5.73% |

## Every tested setting

| Extra padding | Wins / losses | Net | Delta vs baseline | DD |
|---|---:|---:|---:|---:|
| 0% | 43 / 79 | $2,690 | $0 | 7.92% |
| 6% | 65 / 36 | $11,758 | $9,069 | 5.73% |
| 5% | 65 / 36 | $11,495 | $8,805 | 5.29% |
| 5.25% | 65 / 36 | $11,323 | $8,633 | 5.44% |
| 5.5% | 65 / 36 | $11,152 | $8,462 | 5.58% |
| 5.75% | 65 / 36 | $10,980 | $8,291 | 5.73% |
| 4.75% | 63 / 38 | $9,026 | $6,336 | 8.56% |
| 4.5% | 63 / 38 | $9,012 | $6,322 | 8.34% |
| 4.25% | 63 / 38 | $8,971 | $6,281 | 8.12% |
| 4% | 63 / 38 | $8,624 | $5,934 | 7.90% |
| 3.5% | 63 / 40 | $7,837 | $5,147 | 7.83% |
| 3.25% | 63 / 40 | $7,836 | $5,146 | 7.54% |
| 3% | 63 / 41 | $7,497 | $4,807 | 8.47% |
| 3.75% | 63 / 40 | $7,422 | $4,732 | 8.13% |

## Older versus recent

| Period / extra padding | Wins / losses | Winning $ | Losing $ | Average loss | Net | Delta vs baseline | DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| older / 0% | 31 / 68 | $14,627 | -$13,334 | -$196 | $1,293 | $0 | 7.92% |
| older / 3% | 48 / 36 | $18,418 | -$13,228 | -$367 | $5,190 | $3,897 | 8.47% |
| older / 6% | 50 / 31 | $18,930 | -$10,403 | -$336 | $8,527 | $7,234 | 5.73% |
| older / 5% | 50 / 31 | $18,930 | -$10,667 | -$344 | $8,263 | $6,970 | 5.29% |
| older / 5.25% | 50 / 31 | $18,930 | -$10,839 | -$350 | $8,091 | $6,799 | 5.44% |
| older / 5.5% | 50 / 31 | $18,930 | -$11,010 | -$355 | $7,920 | $6,627 | 5.58% |
| older / 5.75% | 50 / 31 | $18,930 | -$11,181 | -$361 | $7,748 | $6,456 | 5.73% |
| recent / 0% | 12 / 11 | $3,497 | -$2,115 | -$192 | $1,397 | $0 | 2.47% |
| recent / 3% | 15 / 5 | $4,446 | -$2,165 | -$433 | $2,307 | $910 | 3.30% |
| recent / 6% | 15 / 5 | $4,446 | -$1,239 | -$248 | $3,232 | $1,835 | 3.06% |
| recent / 5% | 15 / 5 | $4,446 | -$1,239 | -$248 | $3,232 | $1,835 | 3.06% |
| recent / 5.25% | 15 / 5 | $4,446 | -$1,239 | -$248 | $3,232 | $1,835 | 3.06% |
| recent / 5.5% | 15 / 5 | $4,446 | -$1,239 | -$248 | $3,232 | $1,835 | 3.06% |
| recent / 5.75% | 15 / 5 | $4,446 | -$1,239 | -$248 | $3,232 | $1,835 | 3.06% |

Older ends May 31, 2026; recent starts June 1 and ends at the common September 15 cutoff. Recent DD rises from 2.47% to 3.06% for the top five despite better net. The incremental 6%-over-5% gain comes entirely from older history. Best net is at the widest tested boundary, not an established optimum.

## Monthly marked net and delta vs baseline

| Month | 0% | 3% (delta) | 6% (delta) | 5% (delta) | 5.25% (delta) | 5.5% (delta) | 5.75% (delta) |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2024-12 | $361 | $361 ($0) | $361 ($0) | $361 ($0) | $361 ($0) | $361 ($0) | $361 ($0) |
| 2025-01 | $764 | -$111 (-$875) | $1,896 ($1,132) | $1,994 ($1,230) | $1,970 ($1,205) | $1,945 ($1,181) | $1,921 ($1,156) |
| 2025-02 | $716 | $431 (-$286) | $133 (-$584) | $232 (-$485) | $207 (-$509) | $182 (-$534) | $157 (-$559) |
| 2025-03 | -$613 | $905 ($1,518) | $905 ($1,518) | $905 ($1,518) | $905 ($1,518) | $905 ($1,518) | $905 ($1,518) |
| 2025-04 | $1,709 | $1,918 ($209) | $1,918 ($209) | $1,918 ($209) | $1,918 ($209) | $1,918 ($209) | $1,918 ($209) |
| 2025-05 | -$554 | $380 ($934) | $380 ($934) | $380 ($934) | $380 ($934) | $380 ($934) | $380 ($934) |
| 2025-06 | -$815 | -$1,422 (-$607) | -$770 ($45) | -$1,341 (-$526) | -$1,364 (-$550) | -$1,388 (-$573) | -$1,412 (-$597) |
| 2025-07 | -$330 | -$919 (-$589) | $285 ($614) | $285 ($614) | $285 ($614) | $285 ($614) | $285 ($614) |
| 2025-08 | $222 | $631 ($409) | $814 ($592) | $814 ($592) | $814 ($592) | $814 ($592) | $814 ($592) |
| 2025-09 | $236 | $367 ($131) | $62 (-$174) | -$25 (-$261) | -$74 (-$310) | -$123 (-$359) | -$172 (-$408) |
| 2025-10 | -$419 | $813 ($1,232) | $813 ($1,232) | $813 ($1,232) | $813 ($1,232) | $813 ($1,232) | $813 ($1,232) |
| 2025-11 | -$219 | -$581 (-$362) | -$767 (-$548) | -$767 (-$548) | -$767 (-$548) | -$767 (-$548) | -$767 (-$548) |
| 2025-12 | $189 | -$136 (-$324) | -$333 (-$522) | -$137 (-$325) | -$186 (-$374) | -$235 (-$424) | -$284 (-$473) |
| 2026-01 | -$443 | $88 ($531) | $88 ($531) | $88 ($531) | $88 ($531) | $88 ($531) | $88 ($531) |
| 2026-02 | $822 | $2,438 ($1,615) | $2,527 ($1,705) | $2,527 ($1,705) | $2,527 ($1,705) | $2,527 ($1,705) | $2,527 ($1,705) |
| 2026-03 | -$592 | -$234 ($357) | -$234 ($357) | -$234 ($357) | -$234 ($357) | -$234 ($357) | -$234 ($357) |
| 2026-04 | -$136 | $52 ($188) | $241 ($377) | $241 ($377) | $241 ($377) | $241 ($377) | $241 ($377) |
| 2026-05 | $392 | $208 (-$184) | $208 (-$184) | $208 (-$184) | $208 (-$184) | $208 (-$184) | $208 (-$184) |
| 2026-06 | $1,042 | $856 (-$186) | $1,389 ($347) | $1,389 ($347) | $1,389 ($347) | $1,389 ($347) | $1,389 ($347) |
| 2026-07 | $209 | $871 ($662) | $871 ($662) | $871 ($662) | $871 ($662) | $871 ($662) | $871 ($662) |
| 2026-08 | $632 | $632 ($0) | $632 ($0) | $632 ($0) | $632 ($0) | $632 ($0) | $632 ($0) |
| 2026-09 | -$486 | -$52 ($434) | $340 ($826) | $340 ($826) | $340 ($826) | $340 ($826) | $340 ($826) |

Months include open MTM, not just exit-month realized PnL; September is partial. Extra 6% loses $584 versus baseline in February 2025, $548 in November and $522 in December, breaching the predeclared -$250 monthly-delta bound.

## Recovery, occupancy and risk

| Extra padding | Old losers becoming wins | Old losers worse | Added loss on worsened losers | Old winners skipped / profit | Common-trade delta | Avoided baseline net | Cutoff delta | Total delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 5% | 28 | 23 | -$5,442 | 6 / $2,202 | $8,522 | $273 | $10 | $8,805 |
| 6% | 28 | 22 | -$5,273 | 6 / $2,202 | $8,786 | $273 | $10 | $9,069 |

Neither 5% nor 6% introduces new closed trade IDs: both omit 21 original trades, including 6 winners. Rescued losers, worse remaining losses and missed opportunities all count. Full TP/SL/timeout counts: baseline 35/73/14; 5% 48/7/46; 6% 48/5/48. Exposure grows from 1,023h to 1,675h at 6%, so funding remains an important unmodeled cost.

| Extra padding | Median actual SL distance | Maximum distance | Trades above 5% risk | Mean initial dollar risk |
|---|---:|---:|---:|---:|
| 0% | 2.04% | 5.19% | 2/122 | $224 |
| 3% | 5.01% | 8.03% | 52/104 | $525 |
| 6% | 7.93% | 10.88% | 101/101 | $817 |
| 5% | 6.95% | 9.93% | 101/101 | $719 |
| 5.25% | 7.20% | 10.17% | 101/101 | $743 |
| 5.5% | 7.44% | 10.40% | 101/101 | $768 |
| 5.75% | 7.69% | 10.64% | 101/101 | $792 |

A 6% padding means **7.93% median actual SL distance**, up to 10.88%, not a 6% total stop. Fixed notional is not fixed risk; 5% has a lower observed DD but roughly 6.95% median stop room. Few historical SL hits do not prove future crash safety. No leverage/liquidation model or live execution validation is added here.

## Verification and qualification

- 504 audited paths: 14 settings including baseline x 2 source clocks x 18 window/delay/cost/ambiguity paths. 72 control paths reused, 432 new. Source clocks 60/120s; additional action delays 0/60s; normal and +5bps/side stress; stop-first and target-first sensitivities.
- Original baseline result/monthly objects and primary trade CSV bytes match SF01. Both 0% and 3% reuse the exact SF06 replay identities, results, monthly totals and trade hashes. No detector, map or execution-kernel rewrite.
- Each changed action has the same eligibility, ordering, timestamps, entry reference and target as its parent; only stop differs by the declared formula. Trade-to-baseline attribution reconciles including cutoff inventory.
- Ranking remains 6%, 5%, 5.25%, 5.5%, 5.75% at 120s source lag. The 6% primary stress net is +$10,732, versus +$11,758 normal; the 5% stress net is +$10,468.
- Concrete saved 6% trace: January 3, 2025 00:01 UTC entry at $23.21 uses a finalized 4h signal plus 60s availability. The original stop $22.578399 loses $283 at 07:32; the widened stop $21.22369506 is fixed at entry, retains target $24.542202, and exits at that target at 13:05 for $563. No later low chooses the stop. Source clocks and both trade records are saved.
- Complete screen: **0/13 pass**. Top-five failures are recent DD and individual month regressions, not full net. Historical profitability leads remain distinct from qualified live candidates.

## Artifacts

[Frozen card](../research-inputs/sfp-wide-stop-grid-sf07-2026-09-20.json) / [all results, months, screens and trade attribution](../backtests/sfp-wide-stop-grid/41f04d2507dfd14c5d3535b0dc5ea280040cadf41888f0ae1a558533245e10a8/comparison.json) / [best 6% interactive trade map](../backtests/sfp-wide-stop-grid-reviews/da22789d542967ac7e43c8d998c106abaf9f3f40545c75effb1bdd23dcc7d80a/best-replay.html).

Study: `41f04d2507dfd14c5d3535b0dc5ea280040cadf41888f0ae1a558533245e10a8`. Best replay: `4fb5870edc63235bf758d09a7cb0996987eaabf804db06f797122b137e8aee13`. Each replay directory contains results.csv, monthly.csv, trades-long__r2__hold24h.csv and independent audit.json.

`npx ts-node scripts/sfp-wide-stop-study.ts --card research-inputs/sfp-wide-stop-grid-sf07-2026-09-20.json` reuses verified results. `npx ts-node scripts/sfp-wide-stop-grid-report.ts` reads them and renders the existing chart.

No live changes; no commit or push. No new HL/indicator filters, 72h hold or stop settings outside the requested grid.
