# SF06 — wider stops on the most profitable earlier SFP setup

## Result

- Extra3% stop padding increases full net **$2,690 → $7,497**, wins43→63, losses79→41. DD7.92%→8.47%. This is a real historical improvement in this replay, not a sum of rescued stops.
- Trade-off: average loss$196→$375; worst loss$487→$773. Several bearish months worsen. Extra2% is stronger in June–September than extra3%.
- **0/4 complete screen passes.** Extra3% is a research lead, not a live candidate; no threshold beyond the declared set was searched. No live changes.

## Exact comparison

HYPE Bybit perpetual, **2024-12-27 00:00 through2026-09-15 20:20 UTC**. Original SF01 range-qualified4h SFP long, fixed$10,000 notional, separate$32,000 account for drawdown. Standard0.055% taker fee/side, before funding. Parent selected as the highest full-period primary net among the earlier SF01 cells; historical selection is not out-of-sample validation.

Only the execution stop changes: `newStop = originalStop × (1 − extraPadding/100)`. Four candidates:0.5%,1%,2%,3%; unchanged0% baseline. Entry100/old stop98/extra2% gives new stop96.04. **Extra3% is not a total3% stop.**

Original signal/reference-risk eligibility0.2–5%, market entries, absolute original2R target and24h cap remain unchanged. Wider risk is not used to move TP farther away or discard original signals. Actual R falls because target is fixed. No RSI/EMA/HL filter, earlier confirmation, sweep-low limit, additional leverage,72h extension or ladder integration.

Saved signals are replayed through full one-position ownership: longer holds can prevent later trades. Only information known at signal is used to widen the stop; no trade-specific padding chosen from its later low.

## Full-period results — baseline adjacent

Primary60s source publication lag, zero extra action delay, stop-first if a minute touches both brackets. Wins/losses are closed net outcomes after fees, not TP/SL labels. Net also includes cutoff open MTM: +$14.86 for baseline/0.5%/1%, +$25.24 for2%/3%.

| Setup | W / L | Winning $ | Losing $ | Average loss | Worst loss | Net | Delta | DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Unchanged baseline | 43 / 79 | $18,124 | -$15,449 | -$196 | -$487 | $2,690 | $0 | 7.92% |
| Extra 0.5% below old stop | 50 / 68 | $19,729 | -$16,314 | -$240 | -$535 | $3,429 | $740 | 9.74% |
| Extra 1% below old stop | 56 / 59 | $21,030 | -$16,493 | -$280 | -$582 | $4,552 | $1,862 | 10.71% |
| Extra 2% below old stop | 62 / 47 | $22,528 | -$16,670 | -$355 | -$678 | $5,883 | $3,193 | 10.11% |
| Extra 3% below old stop | 63 / 41 | $22,864 | -$15,393 | -$375 | -$773 | $7,497 | $4,807 | 8.47% |

Net-delta ranking: extra3% +$4,807; extra2% +$3,193; extra1% +$1,862; extra0.5% +$740. Best is at the widest tested boundary; this does not identify an optimum.

## Split windows

| Window / setup | W / L | Winning $ | Losing $ | Average loss | Net | Delta | DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dec27,2024–May31,2026 / Unchanged baseline | 31 / 68 | $14,627 | -$13,334 | -$196 | $1,293 | $0 | 7.92% |
| Dec27,2024–May31,2026 / Extra 0.5% below old stop | 37 / 58 | $16,079 | -$13,958 | -$241 | $2,120 | $828 | 9.74% |
| Dec27,2024–May31,2026 / Extra 1% below old stop | 42 / 51 | $16,950 | -$14,235 | -$279 | $2,714 | $1,422 | 10.71% |
| Dec27,2024–May31,2026 / Extra 2% below old stop | 47 / 42 | $18,082 | -$14,819 | -$353 | $3,262 | $1,970 | 10.11% |
| Dec27,2024–May31,2026 / Extra 3% below old stop | 48 / 36 | $18,418 | -$13,228 | -$367 | $5,190 | $3,897 | 8.47% |
| Jun1–Sep15,2026 / Unchanged baseline | 12 / 11 | $3,497 | -$2,115 | -$192 | $1,397 | $0 | 2.47% |
| Jun1–Sep15,2026 / Extra 0.5% below old stop | 13 / 10 | $3,650 | -$2,356 | -$236 | $1,309 | -$88 | 2.87% |
| Jun1–Sep15,2026 / Extra 1% below old stop | 14 / 8 | $4,080 | -$2,257 | -$282 | $1,838 | $441 | 2.78% |
| Jun1–Sep15,2026 / Extra 2% below old stop | 15 / 5 | $4,446 | -$1,851 | -$370 | $2,620 | $1,223 | 3.01% |
| Jun1–Sep15,2026 / Extra 3% below old stop | 15 / 5 | $4,446 | -$2,165 | -$433 | $2,307 | $910 | 3.30% |

Recent extra2%: +$2,620/DD3.01%, versus extra3% +$2,307/DD3.30%. Both beat unchanged +$1,397 net, but neither improves its2.47% DD. The3% full-period lead comes from older history, not consistent dominance over2%.

## Monthly marked net (delta versus unchanged)

| Month | Baseline | Extra0.5% (delta) | Extra1% (delta) | Extra2% (delta) | Extra3% (delta) |
|---|---:|---:|---:|---:|---:|
| 2024-12 | $361 | $361 ($0) | $361 ($0) | $361 ($0) | $361 ($0) |
| 2025-01 | $764 | $618 (-$146) | $473 (-$292) | $181 (-$583) | -$111 (-$875) |
| 2025-02 | $716 | $618 (-$99) | $519 (-$197) | $530 (-$186) | $431 (-$286) |
| 2025-03 | -$613 | -$306 ($307) | $76 ($689) | -$119 ($494) | $905 ($1,518) |
| 2025-04 | $1,709 | $1,612 (-$98) | $1,907 ($197) | $1,918 ($209) | $1,918 ($209) |
| 2025-05 | -$554 | -$651 (-$97) | -$194 ($360) | -$292 ($262) | $380 ($934) |
| 2025-06 | -$815 | -$961 (-$146) | -$1,107 (-$292) | -$1,229 (-$414) | -$1,422 (-$607) |
| 2025-07 | -$330 | -$624 (-$295) | -$919 (-$589) | -$797 (-$467) | -$919 (-$589) |
| 2025-08 | $222 | $329 ($107) | $183 (-$39) | $541 ($318) | $631 ($409) |
| 2025-09 | $236 | -$10 (-$246) | $485 ($249) | $292 ($56) | $367 ($131) |
| 2025-10 | -$419 | $88 ($506) | $813 ($1,232) | $813 ($1,232) | $813 ($1,232) |
| 2025-11 | -$219 | -$415 (-$196) | -$612 (-$393) | -$587 (-$368) | -$581 (-$362) |
| 2025-12 | $189 | $355 ($166) | $257 ($68) | $61 (-$128) | -$136 (-$324) |
| 2026-01 | -$443 | -$115 ($328) | -$313 ($130) | -$100 ($343) | $88 ($531) |
| 2026-02 | $822 | $1,444 ($621) | $1,247 ($425) | $2,534 ($1,712) | $2,438 ($1,615) |
| 2026-03 | -$592 | -$739 (-$147) | -$886 (-$294) | -$1,180 (-$588) | -$234 ($357) |
| 2026-04 | -$136 | $142 ($278) | $43 ($179) | $151 ($287) | $52 ($188) |
| 2026-05 | $392 | $375 (-$16) | $380 (-$12) | $182 (-$210) | $208 (-$184) |
| 2026-06 | $1,042 | $847 (-$195) | $652 (-$391) | $1,071 ($29) | $856 (-$186) |
| 2026-07 | $209 | $513 ($304) | $871 ($662) | $871 ($662) | $871 ($662) |
| 2026-08 | $632 | $632 ($0) | $632 ($0) | $632 ($0) | $632 ($0) |
| 2026-09 | -$486 | -$683 (-$197) | -$317 ($169) | $47 ($532) | -$52 ($434) |

September is partial; monthly values include open MTM, not just exits assigned to an exit month. Extra3% makes January2025 $875 worse, June2025 $607 worse, July2025 $589 worse, among other regressions. More profitable overall does not mean better tail behavior in every period.

## Does it really rescue the stop-outs?

| Padding | Old loser→winner | Old winner→loser | Old winners skipped / their profit | Old losses made worse / extra loss | Common-trade delta | Removed baseline net | Cutoff delta | Total delta |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.5% | 7 | 0 | 0 / $0 | 62 / -$3,040 | -$242 | -$982 | $0 | $740 |
| 1% | 14 | 0 | 1 / $121 | 53 / -$5,199 | $638 | -$1,224 | $0 | $1,862 |
| 2% | 22 | 0 | 3 / $1,008 | 39 / -$7,284 | $2,330 | -$853 | $10 | $3,193 |
| 3% | 24 | 0 | 4 / $1,402 | 30 / -$7,354 | $3,910 | -$887 | $10 | $4,807 |

For extra3%:

-24 original losing trades become winners: their old net was-$4,748; their new net is+$6,142. This is not merely skipping losing signals.
-30 original losers get worse by a combined$7,354. The largest realized loss grows from-$487 to-$773 (June21,2025). Larger losses offset much of the benefit.
-Longer ownership prevents18 original trades, including4 winners worth$1,402 and14 losers. Skipped trades had a net loss of$887. No new closed trade IDs appear on the primary paths.
-Accounting: common-trade change+$3,910, avoided net loss+$887, cutoff difference+$10 = total+$4,807. Full trade-pair attribution is saved.
-TP/SL/timeout counts:35/73/14 baseline →47/22/35. Some recovery benefit comes from less-bad or profitable time exits, not all from reaching the target.
-Exposure grows from1,023 to1,555 hours. Funding remains excluded; extra cost stress is not a substitute for exact funding attribution.

## Actual stop risk

| Extra padding | Median stop distance from fill | Maximum | Trades with actual risk >5% | Mean initial dollar risk |
|---|---:|---:|---:|---:|
| 0% | 2.04% | 5.19% | 2/122 | $224 |
| 0.5% | 2.53% | 5.66% | 8/118 | $273 |
| 1% | 3.02% | 6.14% | 14/115 | $324 |
| 2% | 4.02% | 7.09% | 25/109 | $425 |
| 3% | 5.01% | 8.03% | 52/104 | $525 |

The original0.2–5% filter is measured from the completed signal reference, not the later fill; even baseline has two fills slightly above5% actual risk. At extra3%, median room is5.01% and the maximum8.03%. Fixed$10k notional is **not fixed dollar risk**. Realized worst loss and maximum initial risk differ because not all positions reach SL.

## Timing, costs and verification

-180 paths:5 stop settings ×2 source clocks ×3 windows ×6 action-delay/ambiguity/cost cases. Every path independently audited. Baseline result/monthly objects and primary trade CSV bytes exactly match archived SF01 for both source lags.
-Padding changes only the stop field after original signal eligibility, target calculation and tie-breaking. Tests cover long/short arithmetic, zero parity, invalid padding, prefix stability, ownership, gap-through-stop, delayed deadlines, cutoff inventory and audit tampering.
-No detector/map rebuilding and no use of the final4h candle before confirmation. Saved level/range clocks are checked against sweep/reclaim availability.
-Concrete causal rescue: March7,2025 00:01 UTC, signal known after finalized4h+60s, entry15.409. Original stop15.014970 triggers00:23 for-$267. Extra3% sets14.5645209 immediately at entry; the same target16.191060 fills01:18 for+$496. Stop padding and target were known before either future event.
-Extra3% net stays+$7,170 to+$7,497 across source/action delay combinations, versus baseline+$2,457 to+$2,690. With extra5bps/side it stays+$6,116 to+$6,442. Costs and small delays do not erase the full-period gain.
-Inherited screen: each full/split net and DD versus its identical-clock baseline; month delta no worse than-$250; counts; full PF/top5 concentration; positive stress/delay windows; both source clocks.0/4 pass. Extra3% fails DD and monthly stability, not full profitability or a single two-trade dependence.
-The generic per-run report describes exploratory controls; this frozen card and comparison define the qualifying screen. Historical development data and selection among4 candidates are not forward validation.

## Saved outputs

[Study card](../research-inputs/sfp-wide-stop-sf06-2026-09-20.json) / [comparison, monthly paths, screens and attribution](../backtests/sfp-wide-stop/79c0083b0e60e61864f2eaeb452c88009087ec0144b1fb0ac1f219a4468cf340/comparison.json) / [best3% interactive replay](../backtests/sfp-wide-stop-reviews/210faaadb82d1a5b2fed7fe64aec1879a5f35e6ee871ba7d91943b9d5ec99015/best-replay.html).

Study key: `79c0083b0e60e61864f2eaeb452c88009087ec0144b1fb0ac1f219a4468cf340`. Per-run results.csv, monthly.csv and trades-long__r2__hold24h.csv are under the replay keys in comparison.json. Best3% replay key: `05daa3514685d750b47d19d56a817b2013de15618b2a1ddd577c6f5376e465e6`.

Commands: `npx ts-node scripts/sfp-wide-stop-study.ts`; `npx ts-node scripts/sfp-wide-stop-report.ts`. Study outputs are hash-verified and reused. Stop-only execution override is reusable through ReplayConfig.exitStopPaddingPct; it is separate from the older stopBufferPct option, which recalculates original brackets.

No live config/order behavior changed. No commit or push performed.
