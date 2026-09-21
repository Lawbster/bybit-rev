# Setup ledger: every scanner replay and scan, all symbols

Generated 2026-09-21T02:01 UTC by `npx ts-node scripts/setup-ledger.ts build`. **Do not edit by hand**; edit `research/setup-ledger-notes.json` for statuses and notes, then rebuild. Every number is read from `backtests/setup-replays/<key>/` and `backtests/setup-scans/<key>/`.

Purpose: know what has already been tried, on which symbol, with which conventions, and where the promising cells are, so nothing is re-run by accident and leads can be found again. It is a lookup of exploratory results, not a register of qualified setups: no run here has a frozen card unless its status says `card`. `TESTED-SETUPS.md` remains the curated register; a run is promoted there only when a card exists.

Primary clock everywhere: delay 0, stop-first, no stress, full window; $10k notional per trade, one position per cell, taker 0.055% per side, before funding. Cells are side × target × hold and the best cell is always selected after the fact. Screens are descriptive flags, not qualification:

1. full-window net > 0
2. net > 0 with +5 bps/side
3. older and recent windows both > 0
4. no month below -$250
5. net exceeds the top-5 winners
6. at least 30 trades
7. profit factor >= 1.10
8. net > 0 with 60s action delay
9. net > 0 under target-first ambiguity

## Cross-asset overview (confirmed rows only)

| Setup | Variant | BTCUSDT: events · cells +ve · best cell · clean | HYPEUSDT: events · cells +ve · best cell · clean | SOLUSDT: events · cells +ve · best cell · clean |
|---|---|---|---|---|
| MR01 | entry msb, defaults | 52 · 3/24 · short__r2__hold24h +$119 PF 1.17 win 45% n20 · 0 | 55 · 3/24 · long__r3__hold72h +$1,413 PF 1.44 win 68% n19 · 0 | 61 · 18/24 · short__r3__hold72h +$1,492 PF 1.36 win 50% n26 · 0 |
| MR01 | entry retest, defaults | 21 · 1/24 · long__r1.5__hold72h +$250 PF 1.24 win 45% n11 · 0 | 23 · 11/24 · long__structural__hold72h +$1,169 PF 2.03 win 43% n7 · 0 | 25 · 24/24 · long__r3__hold72h +$1,703 PF 2.63 win 44% n9 · 0 |
| MR01 | entry retest, rangeDay=3 | 12 · 14/24 · short__r3__hold72h +$1,454 PF 6.40 win 50% n6 · 0 | 25 · 7/24 · short__structural__hold168h +$803 PF 1.45 win 33% n9 · 0 | 14 · 12/24 · short__r3__hold72h +$2,117 PF 13.87 win 80% n5 · 0 |
| OB01 | defaults | 306 · 6/24 · long__r3__hold168h +$358 PF 1.09 win 63% n48 · 0 | 291 · 3/24 · long__structural__hold168h +$3,113 PF 1.41 win 78% n68 · 0 | 304 · 8/24 · short__r3__hold168h +$2,736 PF 1.45 win 67% n51 · 1 |
| OB01 | entryLevel=edge | 1051 · 4/24 · long__r1.5__hold168h +$999 PF 1.85 win 73% n41 · 0 | 1091 · 3/56 · long__tp2.5sl4.5__hold72h +$1,188 PF 1.03 win 66% n244 · 0 | 1050 · 9/24 · short__r3__hold168h +$4,007 PF 1.40 win 67% n93 · 0 |
| OB01 | entry limit:proxy/open/72h, entryLevel=edge | 1051 · 9/12 · long__r3__hold168h +$1,761 PF 2.34 win 35% n23 · 0 | 1091 · 11/12 · long__r2__hold72h +$3,327 PF 4.14 win 45% n11 · 0 | 1050 · 11/12 · long__structural__hold168h +$824 PF 1.57 win 24% n17 · 0 |
| OB01 | entry limit:proxy/open/72h, defaults | 306 · 5/12 · long__r1.5__hold24h +$267 PF 1.93 win 43% n7 · 0 | 291 · 0/12 · long__r1.5__hold24h -$508 PF 0.00 win 0% n4 · 0 | 304 · 11/12 · long__r2__hold72h +$1,028 PF 2.07 win 25% n12 · 0 |
| OB01 | entry limit:proxy/touch/72h, defaults | 306 · 9/12 · long__r1.5__hold24h +$400 PF 2.40 win 50% n8 · 0 | 291 · 0/12 · long__r1.5__hold24h -$508 PF 0.00 win 0% n4 · 0 | 304 · 11/12 · long__r2__hold72h +$1,017 PF 2.05 win 25% n12 · 0 |
| OB01 | entry limit:proxy/touch/72h, entryLevel=edge | 1051 · 10/12 · long__r3__hold168h +$1,768 PF 2.34 win 35% n23 · 0 | 1091 · 12/12 · long__r2__hold72h +$3,168 PF 3.60 win 42% n12 · 0 | 1050 · 12/12 · long__r2__hold168h +$1,063 PF 1.71 win 29% n14 · 0 |
| PA02 | defaults | 201 · 0/24 · short__structural__hold24h -$391 PF 0.92 win 44% n78 · 0 | 218 · 0/16 · long__r1.5__hold24h -$534 PF 0.95 win 44% n75 · 0 | 164 · 7/24 · short__r2__hold72h +$1,111 PF 1.14 win 38% n65 · 0 |
| PA02 | defaults, stop buffer 0.5% | not run | 218 · 0/3 · long__r1.5__hold24h -$219 PF 0.98 win 45% n75 · 0 | not run |
| PA04 | defaults | 493 · 3/24 · long__r3__hold72h +$1,671 PF 1.11 win 35% n161 · 0 | 159 · 12/24 · long__r3__hold24h +$1,847 PF 1.31 win 41% n51 · 0 | 507 · 15/24 · long__r1.5__hold72h +$2,759 PF 1.14 win 46% n177 · 0 |
| PA05 | entry reaction, defaults | 140 · 12/24 · short__r3__hold24h +$2,338 PF 2.07 win 67% n42 · 0 | 308 · 9/24 · long__r2__hold168h +$3,458 PF 1.26 win 63% n104 · 0 | 242 · 8/24 · long__r2__hold168h +$2,641 PF 1.28 win 62% n82 · 0 |
| PA05 | entry reaction, triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 45 · 1/24 · long__r1.5__hold336h +$65 PF 1.04 win 57% n14 · 0 | 86 · 13/24 · long__r3__hold336h +$4,318 PF 2.06 win 72% n25 · 0 | 82 · 5/24 · long__structural__hold336h +$1,346 PF 1.36 win 68% n25 · 0 |
| PA05 | entry reaction, triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 5 · 9/24 · long__structural__hold336h +$422 PF 1.41 win 75% n4 · 0 | 10 · 18/24 · short__r3__hold720h +$2,652 PF 0.00 win 100% n3 · 0 | 11 · 0/24 · long__r3__hold336h -$818 PF 0.52 win 33% n3 · 0 |
| PA05 | entry touch, defaults | 260 · 5/24 · short__r1.5__hold168h +$325 PF 1.06 win 42% n72 · 0 | 508 · 11/24 · long__structural__hold24h +$5,251 PF 1.20 win 38% n212 · 0 | 412 · 13/24 · long__structural__hold24h +$3,738 PF 1.25 win 46% n164 · 0 |
| PA05 | entry touch, triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 84 · 0/24 · long__r1.5__hold336h -$125 PF 0.97 win 42% n33 · 0 | 153 · 9/24 · long__r2__hold168h +$3,863 PF 1.49 win 47% n51 · 0 | 137 · 3/24 · long__r1.5__hold72h +$1,500 PF 1.32 win 44% n39 · 0 |
| PA05 | entry touch, triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 12 · 10/24 · long__structural__hold168h +$983 PF 2.06 win 50% n6 · 0 | 22 · 22/24 · short__r3__hold720h +$4,871 PF 3.51 win 57% n7 · 0 | 23 · 3/24 · long__r1.5__hold168h +$146 PF 1.19 win 50% n4 · 0 |
| RS01 | entry msb, defaults | 68 · 17/24 · short__r1.5__hold168h +$1,948 PF 4.67 win 89% n18 · 0 | 162 · 17/24 · long__r2__hold24h +$2,659 PF 1.40 win 61% n54 · 0 | 118 · 15/24 · long__r3__hold24h +$2,698 PF 1.42 win 57% n53 · 0 |
| RS01 | entry retest, defaults | 17 · 19/24 · long__r2__hold168h +$1,662 PF 2.82 win 60% n10 · 0 | 63 · 20/24 · long__r3__hold168h +$4,018 PF 2.23 win 35% n20 · 0 | 40 · 9/24 · long__r3__hold24h +$1,971 PF 1.87 win 57% n21 · 0 |
| SF01 | requireRange=0 | 325 · 0/2 · long__r2__hold72h -$3,401 PF 0.84 win 36% n222 · 0 | 321 · 2/2 · long__r2__hold24h +$2,385 PF 1.09 win 35% n207 · 0 | 284 · 0/2 · long__r2__hold24h -$2,118 PF 0.90 win 38% n193 · 0 |
| SF01 | defaults | 176 · 0/4 · long__r2__hold72h -$417 PF 0.97 win 38% n126 · 0 | 192 · 1/1 · long__r2__hold24h +$22,664 PF 1.95 win 64% n101 · 0 | 167 · 0/4 · long__r2__hold24h -$6,888 PF 0.54 win 31% n119 · 0 |
| SF01 | triggerTfMinutes=15 | not run | 239 · 0/2 · long__r2__hold24h -$1,671 PF 0.90 win 37% n189 · 0 | not run |
| SF01 | entry limit:sweep/open/4h, defaults | not run | 192 · 2/2 · long__r2__hold24h +$219 PF 1.12 win 4% n45 · 0 | not run |
| SF01 | entry limit:sweep/open/4h/0.1%, defaults | not run | 192 · 0/2 · long__r2__hold24h -$767 PF 0.64 win 6% n48 · 0 | not run |
| SF01 | entry limit:sweep/touch/4h, defaults | not run | 192 · 0/2 · long__r2__hold24h -$254 PF 0.84 win 4% n48 · 0 | not run |
| SF01 | entry limit:sweep/touch/4h/0.1%, defaults | not run | 192 · 0/2 · long__r2__hold24h -$62 PF 0.97 win 9% n53 · 0 | not run |

## Status board

**exploratory** (66)

- OB01 HYPEUSDT `4e1be155`: best long__structural__hold168h +$3,113 on 68 trades, 7/9 screens — OB01 HYPE market-at-MSB, OTE-inside-block gate keeps 291 of 1,091 events; long structural/168h 53/15 +$3.1k PF 1.41 on 68 but 7 bad months; the gate does not raise per-trade quality vs the edge scan; shorts negative in every cell (Fable, 2026-09-21)
- OB01 SOLUSDT `2ab19685`: best short__r3__hold168h +$4,007 on 93 trades, 7/9 screens — OB01 SOL market-at-MSB, edge scan: short r3/168h 62/31 +$4.0k PF 1.40 on 93 with recent -$597 and 6 bad months; long structural/24h 99/53 +$1.8k on 152 with 7 bad months (Fable, 2026-09-21)
- SF01 BTCUSDT `ef2f86ec`: best long__r2__hold72h -$3,339 on 223 trades, 1/9 screens
- SF01 BTCUSDT `1193de66`: best long__r2__hold72h -$374 on 127 trades, 1/9 screens
- SF01 BTCUSDT `5d00d4f7`: best long__r2__hold72h -$3,401 on 222 trades, 1/9 screens
- SF01 BTCUSDT `e65570fa`: best long__r2__hold72h -$417 on 126 trades, 1/9 screens
- SF01 HYPEUSDT `a9b7895e`: best long__r2__hold24h +$2,530 on 207 trades, 6/9 screens
- SF01 HYPEUSDT `8aa5c08a`: best long__r2__hold24h +$2,690 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `61590c1f`: best long__r2__hold24h +$2,385 on 207 trades, 6/9 screens
- SF01 HYPEUSDT `d8a1650c`: best long__r2__hold24h +$2,632 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `7db6a2c5`: best long__r2__hold24h +$2,530 on 207 trades, 6/9 screens
- SF01 HYPEUSDT `04ac719c`: best long__r2__hold24h +$2,690 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `4469cd1c`: best long__r2__hold24h +$2,385 on 207 trades, 6/9 screens
- SF01 HYPEUSDT `79d7cba9`: best long__r2__hold24h +$2,632 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `032fdf6d`: best long__r2__hold24h -$2,259 on 190 trades, 1/9 screens
- SF01 HYPEUSDT `511dd948`: best long__r2__hold24h -$1,671 on 189 trades, 1/9 screens
- SF01 HYPEUSDT `34806f0f`: best long__r2__hold24h +$2,690 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `95b72f40`: best long__r2__hold24h +$2,632 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `bad2e7e2`: best long__r2__hold24h +$2,690 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `b01cf7b4`: best long__r2__hold24h +$3,429 on 118 trades, 7/9 screens
- SF01 HYPEUSDT `3586c022`: best long__r2__hold24h +$4,552 on 115 trades, 8/9 screens
- SF01 HYPEUSDT `61e89e33`: best long__r2__hold24h +$5,883 on 109 trades, 8/9 screens
- SF01 HYPEUSDT `05daa351`: best long__r2__hold24h +$7,497 on 104 trades, 8/9 screens
- SF01 HYPEUSDT `7c1c6272`: best long__r2__hold24h +$2,632 on 122 trades, 7/9 screens
- SF01 HYPEUSDT `e819a475`: best long__r2__hold24h +$3,383 on 118 trades, 7/9 screens
- SF01 HYPEUSDT `6236c231`: best long__r2__hold24h +$4,534 on 115 trades, 8/9 screens
- SF01 HYPEUSDT `a7c66119`: best long__r2__hold24h +$5,779 on 109 trades, 8/9 screens
- SF01 HYPEUSDT `240ada45`: best long__r2__hold24h +$7,335 on 104 trades, 8/9 screens
- SF01 HYPEUSDT `6498a27c`: best long__r2__hold24h +$7,836 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `eb923e32`: best long__r2__hold24h +$7,837 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `04b4f094`: best long__r2__hold24h +$7,422 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `255da386`: best long__r2__hold24h +$8,624 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `553b9360`: best long__r2__hold24h +$8,971 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `5ea46155`: best long__r2__hold24h +$9,012 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `1563a11d`: best long__r2__hold24h +$9,026 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `fb891655`: best long__r2__hold24h +$11,495 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `091541af`: best long__r2__hold24h +$11,323 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `e9f462dd`: best long__r2__hold24h +$11,152 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `39e28a7d`: best long__r2__hold24h +$10,980 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `4fb5870e`: best long__r2__hold24h +$11,758 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `a664d68d`: best long__r2__hold24h +$7,725 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `2e90fd7e`: best long__r2__hold24h +$7,730 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `65035405`: best long__r2__hold24h +$7,314 on 103 trades, 8/9 screens
- SF01 HYPEUSDT `e9abf4d2`: best long__r2__hold24h +$8,453 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `a72f4d65`: best long__r2__hold24h +$8,816 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `0fcc62e0`: best long__r2__hold24h +$8,872 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `bc1e7a2f`: best long__r2__hold24h +$8,866 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `5bfbbb34`: best long__r2__hold24h +$11,332 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `ef8040a8`: best long__r2__hold24h +$11,161 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `5e77e7ed`: best long__r2__hold24h +$10,989 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `9fd71258`: best long__r2__hold24h +$10,818 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `5f2f2766`: best long__r2__hold24h +$11,589 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `b05199b1`: best long__r2__hold24h +$22,989 on 101 trades, 8/9 screens
- SF01 HYPEUSDT `ea7325c4`: best long__r2__hold24h +$22,664 on 101 trades, 8/9 screens
- SF01 HYPEUSDT entry limit:sweep/open/4h `f545ef14`: best long__r2__hold24h +$219 on 45 trades, 5/9 screens
- SF01 HYPEUSDT entry limit:sweep/open/4h `8d283ff0`: best long__r2__hold24h +$219 on 45 trades, 5/9 screens
- SF01 HYPEUSDT entry limit:sweep/open/4h/0.1% `6be4ab01`: best long__r2__hold24h -$767 on 48 trades, 1/9 screens
- SF01 HYPEUSDT entry limit:sweep/open/4h/0.1% `81c8c391`: best long__r2__hold24h -$767 on 48 trades, 1/9 screens
- SF01 HYPEUSDT entry limit:sweep/touch/4h `afd57aea`: best long__r2__hold24h -$254 on 48 trades, 1/9 screens
- SF01 HYPEUSDT entry limit:sweep/touch/4h `5f0c8d53`: best long__r2__hold24h -$254 on 48 trades, 1/9 screens
- SF01 HYPEUSDT entry limit:sweep/touch/4h/0.1% `df7cebb3`: best long__r2__hold24h -$62 on 53 trades, 1/9 screens
- SF01 HYPEUSDT entry limit:sweep/touch/4h/0.1% `a87012d1`: best long__r2__hold24h -$62 on 53 trades, 1/9 screens
- SF01 SOLUSDT `8971abf6`: best long__r2__hold24h -$1,914 on 193 trades, 1/9 screens
- SF01 SOLUSDT `c7925699`: best long__r2__hold24h -$6,818 on 119 trades, 1/9 screens
- SF01 SOLUSDT `e7c5d00a`: best long__r2__hold24h -$2,118 on 193 trades, 1/9 screens
- SF01 SOLUSDT `b03d70c0`: best long__r2__hold24h -$6,888 on 119 trades, 1/9 screens

**lead** (8)

- OB01 HYPEUSDT `4bc955cf`: best long__structural__hold72h +$3,955 on 131 trades, 8/9 screens — OB01 HYPE market-at-MSB, edge scan: long structural/72h 96/35 +$3,955 PF 1.26 on 131, fails only the monthly screen (5/22); same HYPE-long profile as RS01/PA05, random-timing control owed before a card (Fable, 2026-09-21)
- OB01 SOLUSDT `1799b2f1`: best short__r3__hold168h +$2,736 on 51 trades, 6/9 screens — OB01 SOL market-at-MSB, OTE gate: long r2/24h 29/9 +$983 PF 1.86 on 38, the only 9/9 cell in the OB01 study (small); shorts r3/168h 34/17 +$2.7k but recent -$235 and 5 bad months (Fable, 2026-09-21)
- PA05 BTCUSDT entry reaction `d18eb8e6`: best short__r3__hold24h +$2,338 on 42 trades, 8/9 screens — PA05 reaction BTC: short r3/24h 28/14 +$2.3k PF 2.07 DD 2%, both windows positive, net above top-5, positive at 60s delay, 2 bad months, 42 trades. Needs random-timing control before a card (Fable, 2026-09-20)
- PA05 SOLUSDT entry touch `8232b437`: best long__structural__hold24h +$3,738 on 164 trades, 8/9 screens — PA05 touch SOL: long structural/24h 76/88 +$3.7k PF 1.25 on 164, both windows positive, net above top-5, 3 bad months. Same drift caveat as HYPE (Fable, 2026-09-20)
- RS01 BTCUSDT entry msb `d35591f1`: best short__r1.5__hold168h +$1,948 on 18 trades, 8/9 screens — RS01 MSB BTC: shorts r1.5 16/2 +$1.9k PF 4.7, both windows positive, no bad month, on 18 trades; cleanest cell in the study and still tiny (Fable, 2026-09-19)
- RS01 HYPEUSDT entry msb `bc1a9da1`: best long__r2__hold24h +$2,659 on 54 trades, 7/9 screens — RS01 MSB HYPE: 17 of 24 positive on ~55 trades/side; long r3 flips negative versus retest mode; read this grid before the retest one (Fable, 2026-09-19)
- RS01 HYPEUSDT entry retest `90618dc7`: best long__r3__hold168h +$4,018 on 20 trades, 5/9 screens — RS01 retest HYPE: 20 of 24 cells positive on ~20 trades/side; recent window negative; monthly screen fails; top-5 wins exceed net. Card first, 30m trigger as a new version (Fable, 2026-09-19)
- RS01 SOLUSDT entry msb `8dc060d2`: best long__r3__hold24h +$2,698 on 53 trades, 7/9 screens — RS01 MSB SOL: longs carry it (15 of 24 positive), shorts lose everywhere; mirror of BTC (Fable, 2026-09-19)

**parked** (42)

- MR01 BTCUSDT entry msb `24dde460`: best short__r2__hold24h +$119 on 20 trades, 5/9 screens — MR01 Monday MSB BTC: 3 of 24 positive, best +$119 on 20 (Fable, 2026-09-20)
- MR01 BTCUSDT entry retest `7458a459`: best long__r1.5__hold72h +$250 on 11 trades, 5/9 screens — MR01 Monday retest BTC: 1 of 24 positive on 11 trades (Fable, 2026-09-20)
- MR01 HYPEUSDT entry msb `f31fabd0`: best long__r3__hold72h +$1,413 on 19 trades, 5/9 screens — MR01 Monday MSB HYPE: 3 of 24 positive on ~19 trades; best long r3/72h +$1.4k, recent -$1.2k (Fable, 2026-09-20)
- MR01 HYPEUSDT entry retest `355e7685`: best long__structural__hold72h +$1,169 on 7 trades, 6/9 screens — MR01 Monday retest HYPE: 23 events, 7 trades per cell; not a sample (Fable, 2026-09-20)
- MR01 SOLUSDT entry msb `d3cc2ebf`: best short__r3__hold72h +$1,492 on 26 trades, 5/9 screens — MR01 Monday MSB SOL: 18 of 24 positive on ~26 trades, 6 bad months, recent negative (Fable, 2026-09-20)
- MR01 SOLUSDT entry retest `6cae1566`: best long__r3__hold72h +$1,703 on 9 trades, 5/9 screens — MR01 Monday retest SOL: 24 of 24 cells positive on 9 trades; nine trades through 24 brackets (Fable, 2026-09-20)
- OB01 BTCUSDT `27ab4689`: best long__r3__hold168h +$358 on 48 trades, 4/9 screens — OB01 BTC market-at-MSB, OTE gate: best long r3/168h 30/18 +$358 PF 1.09 on 48, 4/9 screens (Fable, 2026-09-21)
- OB01 BTCUSDT `31308137`: best long__r1.5__hold168h +$999 on 41 trades, 6/9 screens — OB01 BTC market-at-MSB, edge scan: long r1.5/72h 31/12 +$953 PF 1.75 on 43, 7/9 (recent +$11); shorts flat to negative (Fable, 2026-09-21)
- OB01 BTCUSDT entry limit:proxy/open/72h `88a84d63`: best long__r3__hold168h +$1,761 on 23 trades, 5/9 screens — OB01 BTC edge resting order (open model): same as touch within one fill, +$1.8k on 23 (Fable, 2026-09-21)
- OB01 BTCUSDT entry limit:proxy/open/72h `229d5e76`: best long__r1.5__hold24h +$267 on 7 trades, 6/9 screens — OB01 BTC 0.705 resting order (open model): 7 fills of 54, 3/4 +$267 (Fable, 2026-09-21)
- OB01 BTCUSDT entry limit:proxy/touch/72h `a6ce92ae`: best long__r1.5__hold24h +$400 on 8 trades, 6/9 screens — OB01 BTC 0.705 resting order (touch): 8 fills of 54, 4/4 +$400 at r1.5; too few fills (Fable, 2026-09-21)
- OB01 BTCUSDT entry limit:proxy/touch/72h `da7f657f`: best long__r3__hold168h +$1,768 on 23 trades, 5/9 screens — OB01 BTC edge resting order (touch): 23 fills of 48; r3/168h 8/15 +$1.8k PF 2.34 but recent -$331; market on the same filled events -$1.4k, so the order improves a losing subset (Fable, 2026-09-21)
- OB01 HYPEUSDT `2eed412a`: best long__tp2.5__hold72h +$3,005 on 234 trades, 8/9 screens — OB01 HYPE longs TP/SL grid chunk A (ref msb, 72h): scan-stop rows tp1.8-2.5 +$2.6-3.0k PF 1.11 on 234-255 (8/9, monthly fails); fixed stops 2-3% negative in every cell. Worse than the structural bracket; see fable-5.1-ob01-hype-tp-sl-grid-2026-09-21.md (Fable, 2026-09-21)
- OB01 HYPEUSDT `c831c37f`: best long__tp2.5sl3.5__hold72h +$1,621 on 252 trades, 6/9 screens — OB01 HYPE longs TP/SL grid chunk B (stops 3.5-4.25%): only tp2.25-2.5 positive, max +$1.6k PF 1.05, stress negative (Fable, 2026-09-21)
- OB01 HYPEUSDT `0ebe769e`: best long__tp2.5sl5.75__hold72h +$107 on 237 trades, 4/9 screens — OB01 HYPE longs TP/SL grid chunk D (stops 5.5-6%): 1 of 42 cells positive (+$107); win rate up to 77% with negative net (Fable, 2026-09-21)
- OB01 HYPEUSDT `d6afa9ca`: best long__tp2.5sl4.5__hold72h +$1,188 on 244 trades, 5/9 screens — OB01 HYPE longs TP/SL grid chunk C (stops 4.5-5.25%): 3 of 56 cells positive, max +$1.2k PF 1.04, stress negative (Fable, 2026-09-21)
- OB01 HYPEUSDT entry limit:proxy/open/72h `4ad7b74a`: best long__r2__hold72h +$3,327 on 11 trades, 5/9 screens — OB01 HYPE edge resting order (open model): same 11-12 fills as touch, +$3.3k on 11 (Fable, 2026-09-21)
- OB01 HYPEUSDT entry limit:proxy/touch/72h `d2e58167`: best long__r2__hold72h +$3,168 on 12 trades, 5/9 screens — OB01 HYPE edge resting order (touch): 12 fills of 45, r2/72h 5/7 +$3.2k on 12 trades; the unfilled events won 15/1 at market, the fill is a failure tell; concentration and sample screens fail (Fable, 2026-09-21)
- OB01 SOLUSDT entry limit:proxy/open/72h `82b3ab82`: best long__structural__hold168h +$824 on 17 trades, 6/9 screens — OB01 SOL edge resting order (open model): 17 fills, 4/13 +$824 structural/168h (Fable, 2026-09-21)
- OB01 SOLUSDT entry limit:proxy/open/72h `5afd84fc`: best long__r2__hold72h +$1,028 on 12 trades, 6/9 screens — OB01 SOL 0.705 resting order (open model): same 12 fills, +$1.0k (Fable, 2026-09-21)
- OB01 SOLUSDT entry limit:proxy/touch/72h `cb5b1984`: best long__r2__hold72h +$1,017 on 12 trades, 6/9 screens — OB01 SOL 0.705 resting order (touch): 12 fills of 57, r2/72h 3/9 +$1.0k; the unfilled events won 23/2 at market (Fable, 2026-09-21)
- OB01 SOLUSDT entry limit:proxy/touch/72h `fb2a3ec2`: best long__r2__hold168h +$1,063 on 14 trades, 6/9 screens — OB01 SOL edge resting order (touch): 23 fills of 42, 4-5 wins per cell, +$0.6-1.1k; unfilled events 11/3 at market (Fable, 2026-09-21)
- PA02 HYPEUSDT rows rejected:no_sweep_before_fail `2cb21b19`: best long__r3__hold72h +$3,333 on 136 trades, 7/9 screens — PA02 generic no-sweep control HYPE: long r3/72h +$3.3k PF 1.15 on 136 trades but 9 of 22 months below -250; a control, not a candidate (Fable, 2026-09-19)
- PA02 SOLUSDT `ac6a6a62`: best short__r2__hold72h +$1,111 on 65 trades, 7/9 screens — PA02 named breaker SOL: 7 of 24 positive, all short and thin (best +$1.1k PF 1.14); longs negative as on HYPE and BTC (Fable, 2026-09-19)
- PA04 BTCUSDT `07162e9a`: best long__r3__hold72h +$1,671 on 161 trades, 6/9 screens — PA04 BTC: 3 of 24 positive on ~160 trades per cell (Fable, 2026-09-19)
- PA04 HYPEUSDT `7c92988d`: best long__r3__hold24h +$1,847 on 51 trades, 7/9 screens — PA04 HYPE on the short scan window (2026-03-15 to 09-15 only): 12 of 24 positive on ~50-65 trades; not comparable to the full-tape BTC/SOL runs until rescanned from 2024-12-27 (Fable, 2026-09-19)
- PA04 SOLUSDT `e72cd82e`: best long__r1.5__hold72h +$2,759 on 177 trades, 6/9 screens — PA04 SOL: 15 of 24 positive on ~175 trades, longs, recent window reversed; coin toss with a lean (Fable, 2026-09-19)
- PA05 BTCUSDT entry reaction `61254693`: best long__structural__hold336h +$422 on 4 trades, 5/9 screens — PA05 daily reaction BTC: 5 events (Fable, 2026-09-20)
- PA05 BTCUSDT entry touch `6866b9a5`: best long__structural__hold168h +$983 on 6 trades, 5/9 screens — PA05 daily touch BTC: 12 events, at most 6 trades per cell (Fable, 2026-09-20)
- PA05 HYPEUSDT entry reaction `50a68a26`: best long__r2__hold168h +$3,458 on 104 trades, 7/9 screens — PA05 reaction HYPE: 9 of 24 positive, longs; long r2/168h +$3.5k PF 1.26 on 104, recent negative (Fable, 2026-09-20)
- PA05 HYPEUSDT entry reaction `c09cb527`: best long__r3__hold336h +$4,318 on 25 trades, 7/9 screens — PA05 4h reaction HYPE: 13 of 24 positive, longs; long r3/336h 18/7 +$4.3k PF 2.06 on 25 trades, top-5 equals net, recent +$35 (Fable, 2026-09-20)
- PA05 HYPEUSDT entry reaction `77b22040`: best short__r3__hold720h +$2,652 on 3 trades, 6/9 screens — PA05 daily reaction HYPE: 10 events, at most 3 trades per cell (Fable, 2026-09-20)
- PA05 HYPEUSDT entry touch `e453043a`: best long__structural__hold24h +$5,251 on 212 trades, 6/9 screens — PA05 touch HYPE: 11 of 24 positive, all long; long structural/24h +$5.3k on 212 trades but 9 bad months, recent negative, top-5 wins exceed net. Drift suspect (Fable, 2026-09-20)
- PA05 HYPEUSDT entry touch `d4276065`: best long__r2__hold168h +$3,863 on 51 trades, 7/9 screens — PA05 4h touch HYPE (depart 3%, clocks x4): 9 of 24 positive, longs only; long r2/168h +$3.9k PF 1.49 on 51, 5 bad months, top-5 above net, recent +$158 (Fable, 2026-09-20)
- PA05 HYPEUSDT entry touch `aad7b4d2`: best short__r3__hold720h +$4,871 on 7 trades, 6/9 screens — PA05 daily touch HYPE (depart 6%): 22 events, at most 8 trades per cell; not a sample (Fable, 2026-09-20)
- PA05 SOLUSDT entry reaction `ea94cab3`: best long__r2__hold168h +$2,641 on 82 trades, 7/9 screens — PA05 reaction SOL: 8 of 24 positive; long r2/168h +$2.6k PF 1.28 on 82 (Fable, 2026-09-20)
- PA05 SOLUSDT entry reaction `28f11806`: best long__structural__hold336h +$1,346 on 25 trades, 6/9 screens — PA05 4h reaction SOL: 5 of 24 positive; long r1.5 14/5 +$1.2k on 19 trades (Fable, 2026-09-20)
- PA05 SOLUSDT entry reaction `0c7cf4d4`: best long__r3__hold336h -$818 on 3 trades, 0/9 screens — PA05 daily reaction SOL: 11 events, 0 of 24 positive (Fable, 2026-09-20)
- PA05 SOLUSDT entry touch `0d58f3f7`: best long__r1.5__hold72h +$1,500 on 39 trades, 7/9 screens — PA05 4h touch SOL: 3 of 24 positive; long r1.5/72h +$1.5k PF 1.32 on 39, top-5 double the net (Fable, 2026-09-20)
- PA05 SOLUSDT entry touch `5493b502`: best long__r1.5__hold168h +$146 on 4 trades, 5/9 screens — PA05 daily touch SOL: 23 events, at most 9 trades per cell, 3 of 24 positive (Fable, 2026-09-20)
- RS01 BTCUSDT entry retest `c2ff6ea2`: best long__r2__hold168h +$1,662 on 10 trades, 6/9 screens — RS01 retest BTC: 10 long / 7 short trades; a list of trades, not a sample (Fable, 2026-09-19)
- RS01 SOLUSDT entry retest `fdce67ef`: best long__r3__hold24h +$1,971 on 21 trades, 6/9 screens — RS01 retest SOL: only longs positive (9 of 24), every short cell negative (Fable, 2026-09-19)

**falsified** (8)

- OB01 HYPEUSDT entry limit:proxy/open/72h `eda4783f`: best long__r1.5__hold24h -$508 on 4 trades, 1/9 screens — OB01 HYPE 0.705 resting order (open model): identical to touch, 0/12 cells (Fable, 2026-09-21)
- OB01 HYPEUSDT entry limit:proxy/touch/72h `b8a79b47`: best long__r1.5__hold24h -$508 on 4 trades, 1/9 screens — OB01 HYPE 0.705 resting order (touch): 4-16 fills of 47-49 submissions, 0/12 cells positive; 40 of 49 invalidated because price ran to target before touching the order (Fable, 2026-09-21)
- PA02 BTCUSDT `e4d11d9d`: best short__structural__hold24h -$391 on 78 trades, 1/9 screens — PA02 named breaker BTC: 0 of 24 cells positive on 201 events (Fable, 2026-09-19)
- PA02 HYPEUSDT `c3afd93b`: best long__r1.5__hold24h -$534 on 75 trades, 1/9 screens — PA02 named breaker HYPE: 0 of 16 cells positive; sweep requirement removed trades without improving them (Fable, 2026-09-19)
- PA02 HYPEUSDT `6ebb1016`: best long__r1.5__hold24h -$219 on 75 trades, 2/9 screens — PA02 HYPE longs with stop widened 0.5%: worse in every cell (Fable, 2026-09-19)
- PA05 BTCUSDT entry reaction `d5a75356`: best long__r1.5__hold336h +$65 on 14 trades, 3/9 screens — PA05 4h reaction BTC: 1 of 24 positive (+$65 on 14) (Fable, 2026-09-20)
- PA05 BTCUSDT entry touch `fd3ccb0e`: best short__r1.5__hold168h +$325 on 72 trades, 5/9 screens — PA05 touch BTC: 5 of 24 positive, none above +$325 (Fable, 2026-09-20)
- PA05 BTCUSDT entry touch `d3e3e130`: best long__r1.5__hold336h -$125 on 33 trades, 1/9 screens — PA05 4h touch BTC: 0 of 24 positive; the 1h BTC shorts do not survive the zoom out (Fable, 2026-09-20)

**control** (8)

- MR01 BTCUSDT entry retest `229bc1d0`: best short__r3__hold72h +$1,454 on 6 trades, 6/9 screens — MR01 Wednesday-range control BTC: 14 of 24 positive on 6 trades (PF 6.4 on 6 is noise); the control beats Monday (Fable, 2026-09-20)
- MR01 HYPEUSDT entry retest `07d21113`: best short__structural__hold168h +$803 on 9 trades, 5/9 screens — MR01 Wednesday-range control HYPE: 7 of 24 positive on 9 trades; no better or worse than Monday (Fable, 2026-09-20)
- MR01 SOLUSDT entry retest `484c4620`: best short__r3__hold72h +$2,117 on 5 trades, 7/9 screens — MR01 Wednesday-range control SOL: 12 of 24 positive on 5 trades (PF 13.9 on 5); the control beats Monday (Fable, 2026-09-20)
- PA05 BTCUSDT entry touch rows rejected:two_tap_no_sweep `0d1c95fb`: best short__structural__hold24h -$573 on 403 trades, 1/9 screens — PA05 two-tap control BTC: 0/24 positive; same geometry caveat (Fable, 2026-09-20)
- PA05 HYPEUSDT entry touch rows rejected:two_tap_no_sweep `0292aa68`: best short__r1.5__hold24h -$1,337 on 149 trades, 1/9 screens — PA05 two-tap control HYPE: 0/24 positive; stop under the level makes the bracket far tighter than the candidate's, so not a matched comparison (Fable, 2026-09-20)
- PA05 SOLUSDT entry touch rows rejected:two_tap_no_sweep `70c728a6`: best short__r3__hold24h -$2,302 on 347 trades, 1/9 screens — PA05 two-tap control SOL: 0/24 positive; same geometry caveat (Fable, 2026-09-20)
- RS01 HYPEUSDT entry msb rows rejected:no_fvg `98aecd4f`: best long__r3__hold72h +$1,653 on 20 trades, 6/9 screens — RS01 MSB HYPE no-FVG rows: per trade in the same range as the candidate; FVG rule not shown to matter (Fable, 2026-09-19)
- RS01 HYPEUSDT entry retest rows rejected:no_fvg `36ba8fe7`: best short__r3__hold24h -$592 on 6 trades, 0/9 screens — RS01 retest HYPE no-FVG rows: 6 rows, all short, all negative (Fable, 2026-09-19)

## Runs

### MR01 (mr01-scan-v1)

#### BTCUSDT · entry msb · `24dde460`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `21a4baee`; 52 events; 3 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday MSB BTC: 3 of 24 positive, best +$119 on 20 (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r2__hold24h | 20 | 9/11 | 45% | +$119 | -$81 | 1.2% | 1.17 | +$32 / +$86 | 1 of 12 (-$296) | +$721 | 5/9 |
| short__r2__hold168h | 20 | 11/9 | 55% | +$49 | -$151 | 1.8% | 1.03 | -$13 / +$62 | 3 of 12 (-$296) | +$1,350 | 3/9 |
| short__r3__hold168h | 21 | 9/12 | 43% | +$35 | -$175 | 2.9% | 1.02 | +$232 / -$197 | 3 of 13 (-$567) | +$1,892 | 3/9 |
| long__r3__hold24h | 29 | 14/15 | 48% | -$288 | -$578 | 5.7% | 0.90 | -$832 / +$543 | 4 of 15 (-$392) | +$1,911 | 0/9 |

Artifacts: `backtests/setup-replays/24dde4603261a60179ac9344c6ab13adc02de8eda5a0146481644ecef52d52cf/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry retest · `7458a459`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `91653613`; 21 events; 1 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday retest BTC: 1 of 24 positive on 11 trades (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold72h | 11 | 5/6 | 45% | +$250 | +$140 | 3.6% | 1.24 | -$100 / +$350 | 1 of 10 (-$372) | +$1,291 | 5/9 |
| long__r1.5__hold168h | 11 | 4/7 | 36% | -$101 | -$211 | 5.2% | 0.92 | -$451 / +$350 | 2 of 10 (-$372) | +$1,221 | 0/9 |
| long__structural__hold72h | 11 | 4/7 | 36% | -$171 | -$281 | 3.4% | 0.86 | -$6 / -$165 | 1 of 10 (-$372) | +$1,025 | 0/9 |
| short__structural__hold168h | 10 | 2/8 | 20% | -$691 | -$792 | 3.6% | 0.46 | -$586 / -$105 | 2 of 8 (-$448) | +$600 | 0/9 |

Artifacts: `backtests/setup-replays/7458a4593da0a0827e3121e936537cc0ed6371a56a779c21755a35bf22b1436e/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry retest · `229bc1d0`

Window 2024-12-27 to 2026-09-15; params rangeDay=3; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `d8e3bc12`; 12 events; 14 of 24 cells positive; 0 pass all screens. Status **control**: MR01 Wednesday-range control BTC: 14 of 24 positive on 6 trades (PF 6.4 on 6 is noise); the control beats Monday (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold72h | 6 | 3/3 | 50% | +$1,454 | +$1,395 | 2.0% | 6.40 | +$1,543 / -$89 | 0 of 5 (-$89) | +$1,723 | 6/9 |
| short__r3__hold168h | 6 | 3/3 | 50% | +$1,183 | +$1,123 | 2.0% | 3.49 | +$1,272 / -$89 | 0 of 5 (-$89) | +$1,659 | 6/9 |
| short__r1.5__hold72h | 6 | 4/2 | 67% | +$1,043 | +$983 | 1.6% | 5.22 | +$1,132 / -$89 | 0 of 5 (-$89) | +$1,290 | 6/9 |
| long__r3__hold72h | 6 | 2/4 | 33% | +$76 | +$16 | 1.7% | 1.11 | +$156 / -$80 | 1 of 5 (-$330) | +$793 | 5/9 |

Artifacts: `backtests/setup-replays/229bc1d09ad525d6b7ad7910b93239b355635c1bd6eb8a9450fdf9fd727466cd/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry msb · `f31fabd0`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `a6cba61f`; 55 events; 3 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday MSB HYPE: 3 of 24 positive on ~19 trades; best long r3/72h +$1.4k, recent -$1.2k (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold72h | 19 | 13/6 | 68% | +$1,413 | +$1,222 | 6.1% | 1.44 | +$2,583 / -$1,171 | 4 of 12 (-$670) | +$3,216 | 5/9 |
| long__r3__hold168h | 19 | 13/6 | 68% | +$1,258 | +$1,067 | 6.1% | 1.39 | +$2,429 / -$1,171 | 4 of 12 (-$670) | +$3,061 | 5/9 |
| long__r3__hold24h | 19 | 14/5 | 74% | +$279 | +$88 | 3.5% | 1.13 | +$540 / -$261 | 3 of 12 (-$354) | +$1,451 | 5/9 |
| short__r1.5__hold24h | 15 | 8/7 | 53% | -$1,830 | -$1,981 | 7.7% | 0.36 | -$1,776 / -$55 | 4 of 13 (-$828) | +$912 | 0/9 |

Artifacts: `backtests/setup-replays/f31fabd098e60c66ca830408498ef63002e1aeb2ea67803e9da9f9cba0f2a1bf/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry retest · `355e7685`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `204c6374`; 23 events; 11 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday retest HYPE: 23 events, 7 trades per cell; not a sample (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold72h | 7 | 3/4 | 43% | +$1,169 | +$1,098 | 2.3% | 2.03 | +$906 / +$263 | 3 of 6 (-$444) | +$2,301 | 6/9 |
| long__structural__hold168h | 7 | 3/4 | 43% | +$1,169 | +$1,098 | 2.3% | 2.03 | +$906 / +$263 | 3 of 6 (-$444) | +$2,301 | 6/9 |
| long__r3__hold72h | 7 | 3/4 | 43% | +$971 | +$901 | 2.3% | 1.86 | +$443 / +$529 | 3 of 6 (-$444) | +$2,103 | 6/9 |
| short__r3__hold72h | 7 | 1/6 | 14% | -$1,129 | -$1,199 | 4.2% | 0.39 | -$581 / -$548 | 4 of 7 (-$515) | +$732 | 0/9 |

Artifacts: `backtests/setup-replays/355e768591d451b40845c6747b3502f6e3104063eebf5a71ce1aecf240775293/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry retest · `07d21113`

Window 2024-12-27 to 2026-09-15; params rangeDay=3; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `f3d954bc`; 25 events; 7 of 24 cells positive; 0 pass all screens. Status **control**: MR01 Wednesday-range control HYPE: 7 of 24 positive on 9 trades; no better or worse than Monday (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__structural__hold168h | 9 | 3/6 | 33% | +$803 | +$714 | 4.4% | 1.45 | +$803 / +$0 | 4 of 7 (-$359) | +$2,584 | 5/9 |
| short__structural__hold24h | 9 | 4/5 | 44% | +$755 | +$665 | 3.4% | 1.61 | +$755 / +$0 | 3 of 7 (-$359) | +$1,984 | 5/9 |
| short__r3__hold24h | 9 | 4/5 | 44% | +$450 | +$360 | 3.4% | 1.37 | +$450 / +$0 | 3 of 7 (-$359) | +$1,679 | 5/9 |
| long__r2__hold24h | 9 | 3/6 | 33% | -$1,062 | -$1,152 | 6.8% | 0.49 | -$1,602 / +$540 | 5 of 7 (-$473) | +$1,013 | 0/9 |

Artifacts: `backtests/setup-replays/07d2111328389cd33d141bda496432ef2f90b0eaacaa48ace330b89e17fbb527/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry msb · `d3cc2ebf`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `ac8b3809`; 61 events; 18 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday MSB SOL: 18 of 24 positive on ~26 trades, 6 bad months, recent negative (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold72h | 26 | 13/13 | 50% | +$1,492 | +$1,232 | 4.4% | 1.36 | +$2,209 / -$718 | 6 of 16 (-$788) | +$3,736 | 5/9 |
| long__structural__hold168h | 28 | 14/14 | 50% | +$1,453 | +$1,172 | 2.9% | 1.43 | +$1,897 / -$444 | 5 of 16 (-$606) | +$2,975 | 5/9 |
| short__r3__hold168h | 25 | 12/13 | 48% | +$1,087 | +$838 | 5.1% | 1.26 | +$1,805 / -$718 | 6 of 16 (-$788) | +$3,736 | 5/9 |

Artifacts: `backtests/setup-replays/d3cc2ebff952dfcbf9f7f4556cb653ab97b139c8711c3a8865420e2f0a1ced9a/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry retest · `6cae1566`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `28ab7aad`; 25 events; 24 of 24 cells positive; 0 pass all screens. Status **parked**: MR01 Monday retest SOL: 24 of 24 cells positive on 9 trades; nine trades through 24 brackets (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold72h | 9 | 4/5 | 44% | +$1,703 | +$1,612 | 3.0% | 2.63 | +$1,783 / -$80 | 2 of 7 (-$534) | +$2,748 | 5/9 |
| long__r3__hold168h | 9 | 4/5 | 44% | +$1,703 | +$1,612 | 3.0% | 2.63 | +$1,783 / -$80 | 2 of 7 (-$534) | +$2,748 | 5/9 |
| long__r3__hold24h | 9 | 4/5 | 44% | +$1,301 | +$1,210 | 3.0% | 2.24 | +$1,381 / -$80 | 2 of 7 (-$534) | +$2,346 | 5/9 |
| short__r2__hold72h | 12 | 6/6 | 50% | +$1,294 | +$1,175 | 2.1% | 1.83 | +$1,472 / -$177 | 2 of 12 (-$437) | +$2,561 | 5/9 |

Artifacts: `backtests/setup-replays/6cae15667ff23b206a91211da4a65cf4524fd29b4ed671f8429a20395c09382d/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry retest · `484c4620`

Window 2024-12-27 to 2026-09-15; params rangeDay=3; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `9b01d073`; 14 events; 12 of 24 cells positive; 0 pass all screens. Status **control**: MR01 Wednesday-range control SOL: 12 of 24 positive on 5 trades (PF 13.9 on 5); the control beats Monday (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold72h | 5 | 4/1 | 80% | +$2,117 | +$2,068 | 1.4% | 13.87 | +$1,932 / +$185 | 0 of 4 (+$0) | +$2,281 | 7/9 |
| short__r2__hold72h | 5 | 4/1 | 80% | +$1,654 | +$1,605 | 1.0% | 11.06 | +$1,328 / +$326 | 0 of 4 (+$0) | +$1,818 | 7/9 |
| short__structural__hold72h | 5 | 4/1 | 80% | +$1,375 | +$1,325 | 1.0% | 9.36 | +$1,137 / +$238 | 0 of 4 (+$0) | +$1,539 | 7/9 |
| long__r3__hold24h | 6 | 3/3 | 50% | -$237 | -$297 | 2.6% | 0.76 | -$237 / +$0 | 3 of 5 (-$391) | +$754 | 0/9 |

Artifacts: `backtests/setup-replays/484c46208de4aa7fa86ba97a5270318acc6cdb1bd2c4bd1709150b0e4df508b5/report.md`, `chart.html` beside it if generated.

### OB01 (ob01-scan-v1)

#### BTCUSDT · `27ab4689`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7b9b8a77`; 306 events; 6 of 24 cells positive; 0 pass all screens. Status **parked**: OB01 BTC market-at-MSB, OTE gate: best long r3/168h 30/18 +$358 PF 1.09 on 48, 4/9 screens (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold168h | 48 | 30/18 | 63% | +$358 | -$133 | 2.4% | 1.09 | +$593 / -$65 | 3 of 19 (-$394) | +$1,513 | 4/9 |
| long__r1.5__hold72h | 24 | 18/6 | 75% | +$332 | +$92 | 1.0% | 1.45 | +$405 / -$73 | 1 of 16 (-$253) | +$742 | 5/9 |
| long__r1.5__hold168h | 24 | 18/6 | 75% | +$297 | +$57 | 1.1% | 1.41 | +$370 / -$73 | 1 of 16 (-$253) | +$707 | 5/9 |
| short__r3__hold168h | 46 | 28/18 | 61% | +$46 | -$414 | 3.3% | 1.01 | +$198 / -$153 | 4 of 18 (-$486) | +$2,009 | 4/9 |

Artifacts: `backtests/setup-replays/27ab46891486b238b7f6a7b13831ec7ef385346aa3c38ea099692a37459cefe8/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · `31308137`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b313a4b0`; 1051 events; 4 of 24 cells positive; 0 pass all screens. Status **parked**: OB01 BTC market-at-MSB, edge scan: long r1.5/72h 31/12 +$953 PF 1.75 on 43, 7/9 (recent +$11); shorts flat to negative (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold168h | 41 | 30/11 | 73% | +$999 | +$588 | 1.7% | 1.85 | +$1,092 / -$93 | 1 of 21 (-$365) | +$1,165 | 6/9 |
| long__r1.5__hold72h | 43 | 31/12 | 72% | +$953 | +$522 | 1.7% | 1.75 | +$941 / +$11 | 1 of 21 (-$365) | +$1,181 | 7/9 |
| long__r2__hold168h | 61 | 42/19 | 69% | +$139 | -$471 | 3.4% | 1.04 | +$494 / -$184 | 3 of 22 (-$541) | +$1,704 | 4/9 |
| short__r1.5__hold168h | 54 | 34/20 | 63% | -$359 | -$899 | 4.2% | 0.89 | -$188 / -$171 | 4 of 22 (-$567) | +$1,464 | 1/9 |

Artifacts: `backtests/setup-replays/3130813753e64d6935971e609198660bacd6bc21449f4dd47d1cde9dcedaf176/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry limit:proxy/open/72h · `88a84d63`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b313a4b0`; 1051 events; 9 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 BTC edge resting order (open model): same as touch within one fill, +$1.8k on 23 (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold168h | 23 | 8/15 | 35% | +$1,761 | +$1,530 | 2.3% | 2.34 | +$2,211 / -$331 | 1 of 12 (-$365) | +$2,494 | 5/9 |
| long__r2__hold168h | 16 | 7/9 | 44% | +$1,309 | +$1,148 | 1.8% | 2.50 | +$1,613 / -$186 | 1 of 10 (-$256) | +$1,863 | 5/9 |
| long__r3__hold72h | 24 | 8/16 | 33% | +$1,107 | +$866 | 2.3% | 1.81 | +$1,557 / -$331 | 1 of 12 (-$365) | +$2,095 | 5/9 |

Artifacts: `backtests/setup-replays/88a84d6399caa98f09ab3d57d9440aa26a85cd8f85f5e4d370251ec230090ef2/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry limit:proxy/open/72h · `229d5e76`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7b9b8a77`; 306 events; 5 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 BTC 0.705 resting order (open model): 7 fills of 54, 3/4 +$267 (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 7 | 3/4 | 43% | +$267 | +$197 | 0.6% | 1.93 | +$357 / -$90 | 0 of 7 (-$111) | +$553 | 6/9 |
| long__r1.5__hold72h | 7 | 3/4 | 43% | +$267 | +$197 | 0.6% | 1.93 | +$357 / -$90 | 0 of 7 (-$111) | +$553 | 6/9 |
| long__r1.5__hold168h | 7 | 3/4 | 43% | +$267 | +$197 | 0.6% | 1.93 | +$357 / -$90 | 0 of 7 (-$111) | +$553 | 6/9 |

Artifacts: `backtests/setup-replays/229d5e7682cb4f7ff507341f8366501a76c01f39473ffcd097de346eaa13a4d7/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry limit:proxy/touch/72h · `a6ce92ae`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7b9b8a77`; 306 events; 9 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 BTC 0.705 resting order (touch): 8 fills of 54, 4/4 +$400 at r1.5; too few fills (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 8 | 4/4 | 50% | +$400 | +$320 | 0.5% | 2.40 | +$490 / -$90 | 0 of 8 (-$111) | +$686 | 6/9 |
| long__r1.5__hold72h | 8 | 4/4 | 50% | +$400 | +$320 | 0.5% | 2.40 | +$490 / -$90 | 0 of 8 (-$111) | +$686 | 6/9 |
| long__r1.5__hold168h | 8 | 4/4 | 50% | +$400 | +$320 | 0.5% | 2.40 | +$490 / -$90 | 0 of 8 (-$111) | +$686 | 6/9 |

Artifacts: `backtests/setup-replays/a6ce92ae12bd3a78db46b691f8bf4295fd75b4c309d7d6e6533b1012b579dddd/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry limit:proxy/touch/72h · `da7f657f`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b313a4b0`; 1051 events; 10 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 BTC edge resting order (touch): 23 fills of 48; r3/168h 8/15 +$1.8k PF 2.34 but recent -$331; market on the same filled events -$1.4k, so the order improves a losing subset (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold168h | 23 | 8/15 | 35% | +$1,768 | +$1,537 | 2.3% | 2.34 | +$2,272 / -$331 | 1 of 12 (-$418) | +$2,501 | 5/9 |
| long__r2__hold168h | 16 | 7/9 | 44% | +$1,316 | +$1,155 | 1.8% | 2.51 | +$1,674 / -$186 | 1 of 10 (-$310) | +$1,871 | 5/9 |
| long__r3__hold72h | 24 | 8/16 | 33% | +$1,109 | +$869 | 2.3% | 1.81 | +$1,613 / -$331 | 1 of 12 (-$418) | +$2,101 | 5/9 |

Artifacts: `backtests/setup-replays/da7f657f02f0732759908b2795fe4350583fb6979eb779cd1167d82d3c3829da/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `4e1be155`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `ce1ae21c`; 291 events; 3 of 24 cells positive; 0 pass all screens. Status **exploratory**: OB01 HYPE market-at-MSB, OTE-inside-block gate keeps 291 of 1,091 events; long structural/168h 53/15 +$3.1k PF 1.41 on 68 but 7 bad months; the gate does not raise per-trade quality vs the edge scan; shorts negative in every cell (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold168h | 68 | 53/15 | 78% | +$3,113 | +$2,431 | 7.6% | 1.41 | +$2,257 / +$856 | 7 of 21 (-$914) | +$3,903 | 7/9 |
| long__structural__hold72h | 68 | 52/16 | 76% | +$2,276 | +$1,595 | 8.9% | 1.31 | +$1,420 / +$856 | 7 of 21 (-$914) | +$3,202 | 7/9 |
| long__structural__hold24h | 70 | 53/17 | 76% | +$492 | -$209 | 8.6% | 1.06 | -$365 / +$856 | 8 of 21 (-$914) | +$2,386 | 4/9 |
| short__r2__hold24h | 27 | 17/10 | 63% | -$312 | -$582 | 6.7% | 0.88 | -$383 / +$71 | 2 of 15 (-$999) | +$1,412 | 0/9 |

Artifacts: `backtests/setup-replays/4e1be1550ffccd6cc9f94cea7bf0093197f159a186c32ccc0b22e1ab871bcd56/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `4bc955cf`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `757b08f7`; 1091 events; 9 of 24 cells positive; 0 pass all screens. Status **lead**: OB01 HYPE market-at-MSB, edge scan: long structural/72h 96/35 +$3,955 PF 1.26 on 131, fails only the monthly screen (5/22); same HYPE-long profile as RS01/PA05, random-timing control owed before a card (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold72h | 131 | 96/35 | 73% | +$3,955 | +$2,642 | 10.4% | 1.26 | +$3,004 / +$951 | 5 of 22 (-$2,692) | +$3,448 | 8/9 |
| long__structural__hold168h | 128 | 94/34 | 73% | +$2,531 | +$1,249 | 11.3% | 1.15 | +$1,580 / +$951 | 6 of 22 (-$2,692) | +$4,004 | 7/9 |
| long__r2__hold72h | 45 | 35/10 | 78% | +$2,333 | +$1,881 | 4.8% | 1.69 | +$2,809 / -$477 | 4 of 18 (-$898) | +$2,394 | 6/9 |
| short__r2__hold72h | 41 | 28/13 | 68% | -$566 | -$976 | 8.8% | 0.88 | -$1,326 / +$760 | 6 of 18 (-$928) | +$1,936 | 1/9 |

Artifacts: `backtests/setup-replays/4bc955cf78e73aef52aca340f8a96b2918288550652b0009685a0dfadd467604/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `2eed412a`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets tp1.8/tp2/tp2.25/tp2.5/tp2.75/tp3/tp3.25/tp3.5/tp3.75/tp4/tp4.25/tp4.5/tp4.75/tp5/tp1.8sl2/tp2sl2/tp2.25sl2/tp2.5sl2/tp2.75sl2/tp3sl2/tp3.25sl2/tp3.5sl2/tp3.75sl2/tp4sl2/tp4.25sl2/tp4.5sl2/tp4.75sl2/tp5sl2/tp1.8sl2.5/tp2sl2.5/tp2.25sl2.5/tp2.5sl2.5/tp2.75sl2.5/tp3sl2.5/tp3.25sl2.5/tp3.5sl2.5/tp3.75sl2.5/tp4sl2.5/tp4.25sl2.5/tp4.5sl2.5/tp4.75sl2.5/tp5sl2.5/tp1.8sl3/tp2sl3/tp2.25sl3/tp2.5sl3/tp2.75sl3/tp3sl3/tp3.25sl3/tp3.5sl3/tp3.75sl3/tp4sl3/tp4.25sl3/tp4.5sl3/tp4.75sl3/tp5sl3; holds 72h; scan `757b08f7`; 1091 events; 11 of 56 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE longs TP/SL grid chunk A (ref msb, 72h): scan-stop rows tp1.8-2.5 +$2.6-3.0k PF 1.11 on 234-255 (8/9, monthly fails); fixed stops 2-3% negative in every cell. Worse than the structural bracket; see fable-5.1-ob01-hype-tp-sl-grid-2026-09-21.md (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__tp2.5__hold72h | 234 | 135/99 | 58% | +$3,005 | +$653 | 8.4% | 1.11 | +$2,890 / +$115 | 8 of 22 (-$1,366) | +$1,530 | 8/9 |
| long__tp1.8__hold72h | 255 | 166/89 | 65% | +$2,785 | +$222 | 7.9% | 1.11 | +$2,297 / +$488 | 8 of 22 (-$859) | +$1,178 | 8/9 |
| long__tp2.25__hold72h | 242 | 145/97 | 60% | +$2,572 | +$139 | 8.2% | 1.09 | +$2,979 / -$407 | 8 of 22 (-$1,257) | +$1,405 | 6/9 |

Artifacts: `backtests/setup-replays/2eed412a765dc89844aaea0e108711080136e727e34f668249ece5f7d027819d/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `c831c37f`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets tp1.8sl3.5/tp2sl3.5/tp2.25sl3.5/tp2.5sl3.5/tp2.75sl3.5/tp3sl3.5/tp3.25sl3.5/tp3.5sl3.5/tp3.75sl3.5/tp4sl3.5/tp4.25sl3.5/tp4.5sl3.5/tp4.75sl3.5/tp5sl3.5/tp1.8sl4/tp2sl4/tp2.25sl4/tp2.5sl4/tp2.75sl4/tp3sl4/tp3.25sl4/tp3.5sl4/tp3.75sl4/tp4sl4/tp4.25sl4/tp4.5sl4/tp4.75sl4/tp5sl4/tp1.8sl4.25/tp2sl4.25/tp2.25sl4.25/tp2.5sl4.25/tp2.75sl4.25/tp3sl4.25/tp3.25sl4.25/tp3.5sl4.25/tp3.75sl4.25/tp4sl4.25/tp4.25sl4.25/tp4.5sl4.25/tp4.75sl4.25/tp5sl4.25; holds 72h; scan `757b08f7`; 1091 events; 5 of 42 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE longs TP/SL grid chunk B (stops 3.5-4.25%): only tp2.25-2.5 positive, max +$1.6k PF 1.05, stress negative (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__tp2.5sl3.5__hold72h | 252 | 153/99 | 61% | +$1,621 | -$911 | 16.0% | 1.05 | +$1,184 / +$438 | 7 of 22 (-$1,946) | +$1,494 | 6/9 |
| long__tp2.5sl4.25__hold72h | 247 | 160/87 | 65% | +$1,245 | -$1,237 | 15.8% | 1.04 | +$733 / +$512 | 9 of 22 (-$1,661) | +$1,530 | 5/9 |
| long__tp2.25sl4.25__hold72h | 253 | 170/83 | 67% | +$795 | -$1,746 | 13.1% | 1.03 | +$660 / +$135 | 9 of 22 (-$1,617) | +$1,405 | 5/9 |

Artifacts: `backtests/setup-replays/c831c37f4348c19b0f1a531d98e6d09b3c712ad24a8d40bd129c81d1e7ce5fcf/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `0ebe769e`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets tp1.8sl5.5/tp2sl5.5/tp2.25sl5.5/tp2.5sl5.5/tp2.75sl5.5/tp3sl5.5/tp3.25sl5.5/tp3.5sl5.5/tp3.75sl5.5/tp4sl5.5/tp4.25sl5.5/tp4.5sl5.5/tp4.75sl5.5/tp5sl5.5/tp1.8sl5.75/tp2sl5.75/tp2.25sl5.75/tp2.5sl5.75/tp2.75sl5.75/tp3sl5.75/tp3.25sl5.75/tp3.5sl5.75/tp3.75sl5.75/tp4sl5.75/tp4.25sl5.75/tp4.5sl5.75/tp4.75sl5.75/tp5sl5.75/tp1.8sl6/tp2sl6/tp2.25sl6/tp2.5sl6/tp2.75sl6/tp3sl6/tp3.25sl6/tp3.5sl6/tp3.75sl6/tp4sl6/tp4.25sl6/tp4.5sl6/tp4.75sl6/tp5sl6; holds 72h; scan `757b08f7`; 1091 events; 1 of 42 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE longs TP/SL grid chunk D (stops 5.5-6%): 1 of 42 cells positive (+$107); win rate up to 77% with negative net (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__tp2.5sl5.75__hold72h | 237 | 166/71 | 70% | +$107 | -$2,274 | 15.8% | 1.01 | +$863 / -$755 | 10 of 22 (-$2,074) | +$1,530 | 4/9 |
| long__tp2.5sl6__hold72h | 237 | 167/70 | 70% | -$678 | -$3,059 | 17.2% | 0.99 | +$327 / -$1,005 | 10 of 22 (-$2,224) | +$1,530 | 1/9 |
| long__tp2.25sl5.75__hold72h | 245 | 177/68 | 72% | -$839 | -$3,300 | 15.2% | 0.98 | +$244 / -$1,082 | 10 of 22 (-$2,224) | +$1,405 | 1/9 |

Artifacts: `backtests/setup-replays/0ebe769e193fc0a7c26f486cc92b99f8a8f64cd5c155f1268945509eda009dfa/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `d6afa9ca`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets tp1.8sl4.5/tp2sl4.5/tp2.25sl4.5/tp2.5sl4.5/tp2.75sl4.5/tp3sl4.5/tp3.25sl4.5/tp3.5sl4.5/tp3.75sl4.5/tp4sl4.5/tp4.25sl4.5/tp4.5sl4.5/tp4.75sl4.5/tp5sl4.5/tp1.8sl4.75/tp2sl4.75/tp2.25sl4.75/tp2.5sl4.75/tp2.75sl4.75/tp3sl4.75/tp3.25sl4.75/tp3.5sl4.75/tp3.75sl4.75/tp4sl4.75/tp4.25sl4.75/tp4.5sl4.75/tp4.75sl4.75/tp5sl4.75/tp1.8sl5/tp2sl5/tp2.25sl5/tp2.5sl5/tp2.75sl5/tp3sl5/tp3.25sl5/tp3.5sl5/tp3.75sl5/tp4sl5/tp4.25sl5/tp4.5sl5/tp4.75sl5/tp5sl5/tp1.8sl5.25/tp2sl5.25/tp2.25sl5.25/tp2.5sl5.25/tp2.75sl5.25/tp3sl5.25/tp3.25sl5.25/tp3.5sl5.25/tp3.75sl5.25/tp4sl5.25/tp4.25sl5.25/tp4.5sl5.25/tp4.75sl5.25/tp5sl5.25; holds 72h; scan `757b08f7`; 1091 events; 3 of 56 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE longs TP/SL grid chunk C (stops 4.5-5.25%): 3 of 56 cells positive, max +$1.2k PF 1.04, stress negative (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__tp2.5sl4.5__hold72h | 244 | 161/83 | 66% | +$1,188 | -$1,264 | 13.4% | 1.03 | +$976 / +$212 | 10 of 22 (-$1,811) | +$1,530 | 5/9 |
| long__tp2.25sl4.5__hold72h | 250 | 171/79 | 68% | +$787 | -$1,724 | 11.4% | 1.02 | +$952 / -$165 | 11 of 22 (-$1,474) | +$1,405 | 4/9 |
| long__tp2.25sl5__hold72h | 249 | 175/74 | 70% | +$305 | -$2,196 | 13.4% | 1.01 | +$1,070 / -$765 | 9 of 22 (-$1,774) | +$1,405 | 4/9 |

Artifacts: `backtests/setup-replays/d6afa9ca33aa9ddd89d6d8b2f9652359feec6800019ea747e1dcd6f63fe613e4/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:proxy/open/72h · `eda4783f`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `ce1ae21c`; 291 events; 0 of 12 cells positive; 0 pass all screens. Status **falsified**: OB01 HYPE 0.705 resting order (open model): identical to touch, 0/12 cells (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |
| long__r1.5__hold72h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |
| long__r1.5__hold168h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |

Artifacts: `backtests/setup-replays/eda4783f7fd535faa42a2a3f794350b33e1a6e4e25debc625b9d65faf15afcab/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:proxy/open/72h · `4ad7b74a`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `757b08f7`; 1091 events; 11 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE edge resting order (open model): same 11-12 fills as touch, +$3.3k on 11 (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 11 | 5/6 | 45% | +$3,327 | +$3,215 | 2.1% | 4.14 | +$3,422 / -$95 | 1 of 7 (-$289) | +$4,385 | 5/9 |
| long__r2__hold168h | 11 | 5/6 | 45% | +$3,327 | +$3,215 | 2.1% | 4.14 | +$3,422 / -$95 | 1 of 7 (-$289) | +$4,385 | 5/9 |
| long__r2__hold24h | 11 | 5/6 | 45% | +$1,856 | +$1,745 | 2.1% | 2.75 | +$1,951 / -$95 | 1 of 7 (-$289) | +$2,915 | 5/9 |

Artifacts: `backtests/setup-replays/4ad7b74a4e750ca32fd1acef66fd3fdacc6c1c9e4df290af8dba1b98e5daebdf/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:proxy/touch/72h · `b8a79b47`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `ce1ae21c`; 291 events; 0 of 12 cells positive; 0 pass all screens. Status **falsified**: OB01 HYPE 0.705 resting order (touch): 4-16 fills of 47-49 submissions, 0/12 cells positive; 40 of 49 invalidated because price ran to target before touching the order (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |
| long__r1.5__hold72h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |
| long__r1.5__hold168h | 4 | 0/4 | 0% | -$508 | -$548 | 2.1% | 0.00 | -$416 / -$93 | 0 of 4 (-$153) | +$0 | 1/9 |

Artifacts: `backtests/setup-replays/b8a79b476165d1a20a69e21696d9c9f25e788ded40322797558286e8f71fa030/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:proxy/touch/72h · `d2e58167`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `757b08f7`; 1091 events; 12 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 HYPE edge resting order (touch): 12 fills of 45, r2/72h 5/7 +$3.2k on 12 trades; the unfilled events won 15/1 at market, the fill is a failure tell; concentration and sample screens fail (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 12 | 5/7 | 42% | +$3,168 | +$3,046 | 2.9% | 3.60 | +$3,263 / -$95 | 1 of 7 (-$289) | +$4,385 | 5/9 |
| long__r2__hold168h | 12 | 5/7 | 42% | +$3,168 | +$3,046 | 2.9% | 3.60 | +$3,263 / -$95 | 1 of 7 (-$289) | +$4,385 | 5/9 |
| long__r2__hold24h | 12 | 6/6 | 50% | +$1,854 | +$1,733 | 2.1% | 2.75 | +$1,948 / -$95 | 1 of 7 (-$289) | +$2,667 | 5/9 |

Artifacts: `backtests/setup-replays/d2e5816795991a40670ae098f97584eff9ff931ea0cdbf3d292f4bf7276d3d21/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `1799b2f1`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7a80e894`; 304 events; 8 of 24 cells positive; 1 pass all screens. Status **lead**: OB01 SOL market-at-MSB, OTE gate: long r2/24h 29/9 +$983 PF 1.86 on 38, the only 9/9 cell in the OB01 study (small); shorts r3/168h 34/17 +$2.7k but recent -$235 and 5 bad months (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold168h | 51 | 34/17 | 67% | +$2,736 | +$2,228 | 7.0% | 1.45 | +$2,972 / -$235 | 5 of 21 (-$981) | +$3,426 | 6/9 |
| long__r2__hold24h | 38 | 29/9 | 76% | +$983 | +$602 | 2.5% | 1.86 | +$766 / +$217 | 0 of 19 (-$195) | +$917 | 9/9 |
| short__r3__hold72h | 53 | 32/21 | 60% | +$967 | +$437 | 8.0% | 1.15 | +$1,202 / -$235 | 5 of 21 (-$950) | +$3,212 | 6/9 |

Artifacts: `backtests/setup-replays/1799b2f10fbd62b3491e75e2069e9de29f38e4c1e287da667704efb5cdcd0d27/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `2ab19685`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b218d990`; 1050 events; 9 of 24 cells positive; 0 pass all screens. Status **exploratory**: OB01 SOL market-at-MSB, edge scan: short r3/168h 62/31 +$4.0k PF 1.40 on 93 with recent -$597 and 6 bad months; long structural/24h 99/53 +$1.8k on 152 with 7 bad months (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold168h | 93 | 62/31 | 67% | +$4,007 | +$3,079 | 7.3% | 1.40 | +$4,604 / -$597 | 6 of 22 (-$1,200) | +$3,681 | 7/9 |
| long__structural__hold24h | 152 | 99/53 | 65% | +$1,770 | +$248 | 10.3% | 1.15 | +$1,249 / +$521 | 7 of 22 (-$934) | +$2,979 | 7/9 |
| short__r3__hold72h | 96 | 59/37 | 61% | +$1,142 | +$184 | 9.6% | 1.11 | +$2,128 / -$985 | 7 of 22 (-$1,170) | +$3,212 | 6/9 |

Artifacts: `backtests/setup-replays/2ab19685bcd9b0e5145a5f9bf8de5427f83a62b4c127396c39443ef4490f4c98/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry limit:proxy/open/72h · `82b3ab82`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b218d990`; 1050 events; 11 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 SOL edge resting order (open model): 17 fills, 4/13 +$824 structural/168h (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold168h | 17 | 4/13 | 24% | +$824 | +$654 | 2.9% | 1.57 | +$76 / +$748 | 2 of 10 (-$468) | +$2,274 | 6/9 |
| long__structural__hold72h | 17 | 4/13 | 24% | +$593 | +$423 | 2.9% | 1.41 | +$76 / +$517 | 2 of 10 (-$468) | +$2,043 | 6/9 |
| long__r1.5__hold24h | 12 | 4/8 | 33% | +$467 | +$347 | 2.3% | 1.53 | +$567 / -$100 | 0 of 10 (-$189) | +$1,352 | 6/9 |

Artifacts: `backtests/setup-replays/82b3ab82a94af93ce57a322b21a4e0710ca04b7686832a2fd03ecc2b872c7097/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry limit:proxy/open/72h · `5afd84fc`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7a80e894`; 304 events; 11 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 SOL 0.705 resting order (open model): same 12 fills, +$1.0k (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 12 | 3/9 | 25% | +$1,028 | +$907 | 2.0% | 2.07 | +$1,151 / -$1 | 0 of 11 (-$172) | +$1,985 | 6/9 |
| long__r1.5__hold72h | 8 | 3/5 | 38% | +$974 | +$893 | 2.0% | 2.77 | +$695 / +$279 | 0 of 8 (-$158) | +$1,525 | 7/9 |
| long__r1.5__hold168h | 8 | 3/5 | 38% | +$974 | +$893 | 2.0% | 2.77 | +$695 / +$279 | 0 of 8 (-$158) | +$1,525 | 7/9 |

Artifacts: `backtests/setup-replays/5afd84fcef2c2b0024424c8dd8a27887f8ba6f35e55cb520a5691d42fdecca36/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry limit:proxy/touch/72h · `cb5b1984`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7a80e894`; 304 events; 11 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 SOL 0.705 resting order (touch): 12 fills of 57, r2/72h 3/9 +$1.0k; the unfilled events won 23/2 at market (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 12 | 3/9 | 25% | +$1,017 | +$896 | 2.0% | 2.05 | +$1,151 / -$12 | 0 of 11 (-$172) | +$1,985 | 6/9 |
| long__r1.5__hold72h | 8 | 3/5 | 38% | +$974 | +$893 | 2.3% | 2.77 | +$695 / +$279 | 0 of 8 (-$192) | +$1,525 | 7/9 |
| long__r1.5__hold168h | 8 | 3/5 | 38% | +$974 | +$893 | 2.3% | 2.77 | +$695 / +$279 | 0 of 8 (-$192) | +$1,525 | 7/9 |

Artifacts: `backtests/setup-replays/cb5b19840d061ab3751a00a63873e1adda5954ee09b79105c9c7d799e5c3fcc0/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry limit:proxy/touch/72h · `fb2a3ec2`

Window 2024-12-27 to 2026-09-15; params entryLevel=edge; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b218d990`; 1050 events; 12 of 12 cells positive; 0 pass all screens. Status **parked**: OB01 SOL edge resting order (touch): 23 fills of 42, 4-5 wins per cell, +$0.6-1.1k; unfilled events 11/3 at market (Fable, 2026-09-21).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold168h | 14 | 4/10 | 29% | +$1,063 | +$922 | 3.9% | 1.71 | +$479 / +$584 | 2 of 10 (-$383) | +$2,552 | 6/9 |
| long__structural__hold168h | 17 | 4/13 | 24% | +$824 | +$654 | 2.9% | 1.57 | +$76 / +$748 | 2 of 10 (-$468) | +$2,274 | 6/9 |
| long__r1.5__hold168h | 13 | 4/9 | 31% | +$669 | +$539 | 3.4% | 1.51 | +$235 / +$434 | 1 of 10 (-$341) | +$1,985 | 6/9 |

Artifacts: `backtests/setup-replays/fb2a3ec24506355b1bc8d75b73f5782d928248fe867d50ea52b8a42d07dcf378/report.md`, `chart.html` beside it if generated.

### PA02 (pa02-scan-v1)

#### BTCUSDT · `e4d11d9d`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `9b905b56`; 201 events; 0 of 24 cells positive; 0 pass all screens. Status **falsified**: PA02 named breaker BTC: 0 of 24 cells positive on 201 events (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__structural__hold24h | 78 | 34/44 | 44% | -$391 | -$1,170 | 4.8% | 0.92 | -$672 / +$282 | 3 of 20 (-$289) | +$1,528 | 1/9 |
| short__r3__hold168h | 72 | 20/52 | 28% | -$421 | -$1,141 | 7.7% | 0.94 | -$1,059 / +$389 | 4 of 20 (-$590) | +$2,665 | 1/9 |
| short__r3__hold72h | 74 | 22/52 | 30% | -$620 | -$1,360 | 8.8% | 0.91 | -$1,533 / +$664 | 4 of 20 (-$590) | +$2,599 | 1/9 |
| long__r1.5__hold72h | 79 | 26/53 | 33% | -$2,871 | -$3,660 | 10.1% | 0.55 | -$2,082 / -$789 | 8 of 20 (-$497) | +$1,229 | 1/9 |

Artifacts: `backtests/setup-replays/e4d11d9d72184109ea74581c2775b692bafbbc5895fe9f5d7506a0237a805d63/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `c3afd93b`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72h; scan `c215c180`; 218 events; 0 of 16 cells positive; 0 pass all screens. Status **falsified**: PA02 named breaker HYPE: 0 of 16 cells positive; sweep requirement removed trades without improving them (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 75 | 33/42 | 44% | -$534 | -$1,284 | 9.3% | 0.95 | -$206 / -$328 | 9 of 22 (-$966) | +$2,570 | 1/9 |
| long__r3__hold72h | 71 | 19/52 | 27% | -$757 | -$1,467 | 17.1% | 0.94 | -$1,230 / +$473 | 11 of 22 (-$1,297) | +$5,669 | 1/9 |
| long__r2__hold24h | 74 | 29/45 | 39% | -$931 | -$1,671 | 10.3% | 0.92 | -$250 / -$681 | 10 of 22 (-$869) | +$3,229 | 1/9 |
| short__structural__hold72h | 80 | 26/54 | 33% | -$2,300 | -$3,101 | 17.0% | 0.84 | -$1,428 / -$872 | 9 of 21 (-$1,664) | +$4,621 | 1/9 |

Artifacts: `backtests/setup-replays/c3afd93badd33b60097a85e1179b4f90f521ae69993df23851b64beb541edbfd/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `6ebb1016`

Window 2024-12-27 to 2026-09-15; params defaults; stop buffer 0.5%; targets r1.5/r2/r3; holds 24h; scan `c215c180`; 218 events; 0 of 3 cells positive; 0 pass all screens. Status **falsified**: PA02 HYPE longs with stop widened 0.5%: worse in every cell (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold24h | 75 | 34/41 | 45% | -$219 | -$970 | 11.6% | 0.98 | +$305 / -$524 | 9 of 22 (-$1,036) | +$2,821 | 2/9 |
| long__r2__hold24h | 73 | 28/45 | 38% | -$1,924 | -$2,654 | 12.6% | 0.85 | -$763 / -$1,161 | 11 of 22 (-$915) | +$3,712 | 1/9 |
| long__r3__hold24h | 70 | 24/46 | 34% | -$3,790 | -$4,488 | 16.5% | 0.72 | -$2,585 / -$1,204 | 12 of 22 (-$1,230) | +$4,389 | 1/9 |

Artifacts: `backtests/setup-replays/6ebb10161e56bd9d3469b3244c98c13e65a07fc6d88fab1643d009d66d652ac6/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · rows rejected:no_sweep_before_fail · `2cb21b19`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72h; scan `c215c180`; 136 events; 2 of 16 cells positive; 0 pass all screens. Status **parked**: PA02 generic no-sweep control HYPE: long r3/72h +$3.3k PF 1.15 on 136 trades but 9 of 22 months below -250; a control, not a candidate (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold72h | 136 | 40/96 | 29% | +$3,333 | +$1,970 | 11.0% | 1.15 | +$1,585 / +$1,748 | 9 of 22 (-$1,396) | +$6,028 | 7/9 |
| long__r3__hold24h | 143 | 49/94 | 34% | +$2,584 | +$1,152 | 11.2% | 1.13 | +$2,219 / +$365 | 10 of 22 (-$1,994) | +$5,201 | 7/9 |
| long__r2__hold24h | 148 | 56/92 | 38% | -$522 | -$2,003 | 13.3% | 0.97 | -$1,302 / +$779 | 8 of 22 (-$1,994) | +$4,001 | 1/9 |
| short__r3__hold72h | 126 | 31/95 | 25% | -$4,139 | -$5,401 | 21.4% | 0.81 | -$1,149 / -$2,990 | 14 of 21 (-$1,547) | +$5,316 | 1/9 |

Artifacts: `backtests/setup-replays/2cb21b19eb1b48fd6cf6ff2dbec6e4634b0a0f984635655672c1344aa3dbe5f8/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `ac6a6a62`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `a8a979cf`; 164 events; 7 of 24 cells positive; 0 pass all screens. Status **parked**: PA02 named breaker SOL: 7 of 24 positive, all short and thin (best +$1.1k PF 1.14); longs negative as on HYPE and BTC (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r2__hold72h | 65 | 25/40 | 38% | +$1,111 | +$462 | 5.0% | 1.14 | +$933 / +$178 | 3 of 19 (-$684) | +$3,736 | 7/9 |
| short__r1.5__hold168h | 68 | 29/39 | 43% | +$681 | +$2 | 5.3% | 1.09 | +$405 / +$276 | 3 of 19 (-$766) | +$2,786 | 6/9 |
| short__r2__hold168h | 64 | 22/42 | 34% | +$627 | -$13 | 6.0% | 1.07 | +$275 / +$351 | 4 of 19 (-$996) | +$3,736 | 5/9 |
| long__r3__hold168h | 56 | 14/42 | 25% | -$398 | -$958 | 9.0% | 0.95 | -$351 / -$47 | 10 of 21 (-$1,114) | +$4,245 | 1/9 |

Artifacts: `backtests/setup-replays/ac6a6a628b026de70514690cbe5f6d0006f4e12ccfec9e9e16e5e816c448b015/report.md`, `chart.html` beside it if generated.

### PA04 (pa04-scan-v1)

#### BTCUSDT · `07162e9a`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `47fe577b`; 493 events; 3 of 24 cells positive; 0 pass all screens. Status **parked**: PA04 BTC: 3 of 24 positive on ~160 trades per cell (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold72h | 161 | 56/105 | 35% | +$1,671 | +$60 | 9.8% | 1.11 | +$1,809 / -$138 | 6 of 22 (-$996) | +$3,549 | 6/9 |
| long__structural__hold24h | 170 | 70/100 | 41% | +$299 | -$1,402 | 7.2% | 1.02 | +$819 / -$520 | 5 of 22 (-$1,124) | +$2,861 | 4/9 |
| long__r3__hold168h | 145 | 45/100 | 31% | +$239 | -$1,222 | 12.8% | 1.01 | +$111 / +$128 | 6 of 22 (-$1,315) | +$3,912 | 5/9 |
| short__r2__hold72h | 181 | 71/110 | 39% | -$1,470 | -$3,280 | 8.8% | 0.90 | -$857 / -$940 | 7 of 21 (-$1,328) | +$2,245 | 1/9 |

Artifacts: `backtests/setup-replays/07162e9a05f16b2fb2b2aeb183b6c4cd37d1c6a2f65a644427061494c2f927f3/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `7c92988d`

Window 2026-03-15 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `2bc30293`; 159 events; 12 of 24 cells positive; 0 pass all screens. Status **parked**: PA04 HYPE on the short scan window (2026-03-15 to 09-15 only): 12 of 24 positive on ~50-65 trades; not comparable to the full-tape BTC/SOL runs until rescanned from 2024-12-27 (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold24h | 51 | 21/30 | 41% | +$1,847 | +$1,336 | 4.3% | 1.31 | +$1,123 / +$724 | 1 of 7 (-$1,125) | +$3,553 | 7/9 |
| long__structural__hold24h | 51 | 21/30 | 41% | +$1,824 | +$1,312 | 4.3% | 1.31 | +$790 / +$1,034 | 1 of 7 (-$1,125) | +$3,361 | 7/9 |
| short__structural__hold24h | 65 | 33/32 | 51% | +$1,731 | +$1,072 | 7.3% | 1.24 | -$511 / +$2,241 | 1 of 7 (-$1,388) | +$2,810 | 6/9 |

Artifacts: `backtests/setup-replays/7c92988dadba0950a3c8259b7ab4a895dd8fc1b01c15cd0c92f3a22c59dcf0a0/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `e72cd82e`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `a0347117`; 507 events; 15 of 24 cells positive; 0 pass all screens. Status **parked**: PA04 SOL: 15 of 24 positive on ~175 trades, longs, recent window reversed; coin toss with a lean (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold72h | 177 | 81/96 | 46% | +$2,759 | +$987 | 5.8% | 1.14 | +$3,611 / -$852 | 6 of 21 (-$922) | +$3,227 | 6/9 |
| long__r2__hold72h | 174 | 69/105 | 40% | +$2,740 | +$998 | 8.5% | 1.13 | +$3,123 / -$382 | 6 of 21 (-$870) | +$3,877 | 6/9 |
| long__r3__hold24h | 180 | 71/109 | 39% | +$2,383 | +$581 | 9.2% | 1.12 | +$2,251 / +$132 | 4 of 22 (-$924) | +$4,538 | 7/9 |
| short__r2__hold24h | 177 | 76/101 | 43% | +$1,085 | -$684 | 8.5% | 1.06 | +$1,650 / -$565 | 5 of 22 (-$1,050) | +$2,792 | 4/9 |

Artifacts: `backtests/setup-replays/e72cd82e61ae010d524066902c8ff5256d72d9ad05ed06d2aff01f60f90753ec/report.md`, `chart.html` beside it if generated.

### PA05 (pa05-scan-v1)

#### BTCUSDT · entry reaction · `d18eb8e6`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `138cb27f`; 140 events; 12 of 24 cells positive; 0 pass all screens. Status **lead**: PA05 reaction BTC: short r3/24h 28/14 +$2.3k PF 2.07 DD 2%, both windows positive, net above top-5, positive at 60s delay, 2 bad months, 42 trades. Needs random-timing control before a card (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold24h | 42 | 28/14 | 67% | +$2,338 | +$1,909 | 2.0% | 2.07 | +$1,876 / +$462 | 2 of 19 (-$415) | +$2,040 | 8/9 |
| short__r2__hold24h | 40 | 26/14 | 65% | +$1,834 | +$1,425 | 2.2% | 1.93 | +$1,356 / +$478 | 3 of 19 (-$448) | +$1,621 | 8/9 |
| short__r3__hold72h | 39 | 24/15 | 62% | +$1,372 | +$973 | 4.0% | 1.42 | +$1,496 / -$124 | 3 of 19 (-$634) | +$2,112 | 6/9 |
| long__r3__hold24h | 56 | 31/25 | 55% | -$1 | -$562 | 5.5% | 1.00 | -$362 / +$360 | 4 of 21 (-$394) | +$1,452 | 1/9 |

Artifacts: `backtests/setup-replays/d18eb8e64d1825211bf1076d4683b2bb73ec6448009c7efd826772bff11b1f5f/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry reaction · `d5a75356`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `c9dc1397`; 45 events; 1 of 24 cells positive; 0 pass all screens. Status **falsified**: PA05 4h reaction BTC: 1 of 24 positive (+$65 on 14) (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold336h | 14 | 8/6 | 57% | +$65 | -$75 | 2.6% | 1.04 | -$120 / +$186 | 2 of 10 (-$320) | +$1,449 | 3/9 |
| long__r1.5__hold72h | 14 | 7/7 | 50% | -$209 | -$349 | 2.6% | 0.86 | -$120 / -$89 | 1 of 11 (-$256) | +$1,104 | 0/9 |
| long__r1.5__hold168h | 14 | 8/6 | 57% | -$286 | -$426 | 2.6% | 0.83 | -$120 / -$166 | 2 of 10 (-$320) | +$1,161 | 0/9 |
| short__structural__hold72h | 13 | 6/7 | 46% | -$1,441 | -$1,572 | 5.9% | 0.39 | -$1,687 / +$246 | 3 of 9 (-$1,237) | +$916 | 0/9 |

Artifacts: `backtests/setup-replays/d5a753567cd381ae1fdb80524877c02ff66a67cfd40653cd58b6c91529d7a04e/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry reaction · `61254693`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `4ff67ce9`; 5 events; 9 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily reaction BTC: 5 events (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold336h | 4 | 3/1 | 75% | +$422 | +$382 | 4.6% | 1.41 | +$422 / +$0 | 1 of 3 (-$1,028) | +$1,450 | 5/9 |
| long__structural__hold720h | 4 | 3/1 | 75% | +$422 | +$382 | 4.6% | 1.41 | +$422 / +$0 | 1 of 3 (-$1,028) | +$1,450 | 5/9 |
| short__r2__hold168h | 1 | 1/0 | 100% | +$301 | +$291 | 0.2% | 0.00 | +$301 / +$0 | 0 of 1 (+$0) | +$301 | 5/9 |

Artifacts: `backtests/setup-replays/61254693c5f134c847b60bc5027bb133b0e0a55079396e3cf4b4a9168aa2c7a5/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry touch · `fd3ccb0e`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `40e9e881`; 260 events; 5 of 24 cells positive; 0 pass all screens. Status **falsified**: PA05 touch BTC: 5 of 24 positive, none above +$325 (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r1.5__hold168h | 72 | 30/42 | 42% | +$325 | -$405 | 4.8% | 1.06 | +$297 / +$28 | 3 of 21 (-$860) | +$2,084 | 5/9 |
| short__r1.5__hold72h | 74 | 31/43 | 42% | +$152 | -$597 | 4.4% | 1.03 | -$523 / +$675 | 4 of 21 (-$893) | +$2,019 | 3/9 |
| short__r2__hold168h | 74 | 28/46 | 38% | +$95 | -$654 | 6.6% | 1.02 | -$115 / +$210 | 4 of 21 (-$701) | +$2,451 | 3/9 |
| long__r3__hold168h | 86 | 25/61 | 29% | -$951 | -$1,811 | 10.6% | 0.89 | -$209 / -$742 | 8 of 22 (-$1,358) | +$3,539 | 1/9 |

Artifacts: `backtests/setup-replays/fd3ccb0e2ebdff5fd973993f9c3d34002db0eb289aeda75f8160b2fef7bc2528/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry touch · `d3e3e130`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `989e1c87`; 84 events; 0 of 24 cells positive; 0 pass all screens. Status **falsified**: PA05 4h touch BTC: 0 of 24 positive; the 1h BTC shorts do not survive the zoom out (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold336h | 33 | 14/19 | 42% | -$125 | -$456 | 6.1% | 0.97 | -$590 / +$464 | 3 of 16 (-$673) | +$2,316 | 1/9 |
| long__r1.5__hold168h | 33 | 14/19 | 42% | -$444 | -$774 | 6.1% | 0.89 | -$590 / +$145 | 3 of 16 (-$673) | +$2,109 | 1/9 |
| long__r1.5__hold72h | 33 | 14/19 | 42% | -$510 | -$840 | 5.0% | 0.86 | -$558 / +$48 | 2 of 17 (-$673) | +$1,969 | 1/9 |
| short__structural__hold72h | 21 | 6/15 | 29% | -$1,451 | -$1,662 | 6.4% | 0.47 | -$873 / -$578 | 4 of 14 (-$898) | +$1,243 | 0/9 |

Artifacts: `backtests/setup-replays/d3e3e130b849ac5b1687d826a98fc246b518bb525b71e700ff7b4fdeb7a7dc73/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry touch · `6866b9a5`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `43457caf`; 12 events; 10 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily touch BTC: 12 events, at most 6 trades per cell (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold168h | 6 | 3/3 | 50% | +$983 | +$922 | 4.8% | 2.06 | +$983 / +$0 | 2 of 5 (-$406) | +$1,909 | 5/9 |
| short__r2__hold720h | 4 | 2/2 | 50% | +$728 | +$688 | 2.2% | 1.86 | +$728 / +$0 | 1 of 4 (-$627) | +$1,572 | 5/9 |
| long__r2__hold168h | 5 | 4/1 | 80% | +$687 | +$637 | 4.1% | 3.32 | +$687 / +$0 | 1 of 4 (-$296) | +$984 | 5/9 |

Artifacts: `backtests/setup-replays/6866b9a58c564f4456351d0b33536b2c3e240e0609e5c60059ca913815d4668a/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry touch · rows rejected:two_tap_no_sweep · `0d1c95fb`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `40e9e881`; 403 events; 0 of 24 cells positive; 0 pass all screens. Status **control**: PA05 two-tap control BTC: 0/24 positive; same geometry caveat (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__structural__hold24h | 403 | 127/276 | 32% | -$573 | -$4,601 | 8.8% | 0.97 | +$828 / -$1,401 | 10 of 22 (-$1,115) | +$2,465 | 1/9 |
| short__r3__hold24h | 413 | 211/202 | 51% | -$1,839 | -$5,968 | 6.3% | 0.85 | -$848 / -$991 | 7 of 22 (-$461) | +$510 | 1/9 |
| short__structural__hold168h | 377 | 103/274 | 27% | -$1,905 | -$5,684 | 14.6% | 0.90 | -$158 / -$1,813 | 9 of 22 (-$1,242) | +$2,934 | 1/9 |
| long__r1.5__hold24h | 274 | 132/142 | 48% | -$3,697 | -$6,437 | 11.8% | 0.40 | -$3,279 / -$418 | 4 of 21 (-$425) | +$213 | 1/9 |

Artifacts: `backtests/setup-replays/0d1c95fb1699ae064b16a3b9fca56fb592fae7bac5764e0392396e34b73b9827/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry reaction · `50a68a26`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `fc09f0b2`; 308 events; 9 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 reaction HYPE: 9 of 24 positive, longs; long r2/168h +$3.5k PF 1.26 on 104, recent negative (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold168h | 104 | 66/38 | 63% | +$3,458 | +$2,406 | 5.1% | 1.26 | +$4,421 / -$963 | 6 of 21 (-$810) | +$3,372 | 7/9 |
| long__structural__hold72h | 130 | 80/50 | 62% | +$2,572 | +$1,260 | 6.8% | 1.15 | +$3,575 / -$1,003 | 9 of 21 (-$961) | +$4,693 | 6/9 |
| long__r2__hold24h | 108 | 66/42 | 61% | +$2,076 | +$985 | 7.0% | 1.17 | +$3,756 / -$1,680 | 5 of 21 (-$1,214) | +$3,080 | 6/9 |
| short__structural__hold168h | 99 | 57/42 | 58% | -$900 | -$1,890 | 14.7% | 0.95 | +$254 / -$1,154 | 7 of 21 (-$1,422) | +$4,582 | 1/9 |

Artifacts: `backtests/setup-replays/50a68a264bb6d892529a733cd221f6f72c08e5ff8d96c4af40b2baa51520748c/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry reaction · `c09cb527`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `5d388837`; 86 events; 13 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 4h reaction HYPE: 13 of 24 positive, longs; long r3/336h 18/7 +$4.3k PF 2.06 on 25 trades, top-5 equals net, recent +$35 (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold336h | 25 | 18/7 | 72% | +$4,318 | +$4,065 | 5.4% | 2.06 | +$4,283 / +$35 | 4 of 15 (-$806) | +$4,241 | 7/9 |
| long__r3__hold168h | 25 | 18/7 | 72% | +$3,741 | +$3,489 | 5.4% | 1.92 | +$3,706 / +$35 | 4 of 15 (-$806) | +$3,936 | 6/9 |
| long__r3__hold72h | 25 | 16/9 | 64% | +$2,805 | +$2,554 | 5.4% | 1.73 | +$2,770 / +$35 | 4 of 15 (-$806) | +$3,860 | 6/9 |
| short__structural__hold72h | 23 | 15/8 | 65% | +$860 | +$631 | 9.1% | 1.18 | +$1,571 / -$711 | 5 of 16 (-$988) | +$3,555 | 5/9 |

Artifacts: `backtests/setup-replays/c09cb52785141f14ded5ae06cfde1aba27b6072474dcabab0c638e13bc9bf722/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry reaction · `77b22040`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `8513106c`; 10 events; 18 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily reaction HYPE: 10 events, at most 3 trades per cell (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold720h | 3 | 3/0 | 100% | +$2,652 | +$2,613 | 2.6% | 0.00 | +$577 / +$2,075 | 0 of 3 (-$221) | +$2,873 | 6/9 |
| short__r3__hold336h | 3 | 3/0 | 100% | +$1,885 | +$1,846 | 3.3% | 0.00 | +$577 / +$1,308 | 0 of 3 (-$221) | +$2,106 | 6/9 |
| long__r3__hold168h | 1 | 1/0 | 100% | +$1,707 | +$1,696 | 1.6% | 0.00 | +$1,707 / +$0 | 0 of 1 (+$0) | +$1,707 | 6/9 |

Artifacts: `backtests/setup-replays/77b22040797c6099ae97c89344ff8d2a7c7f259fc6535900aa8c1f02f2141b72/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry touch · `e453043a`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `578da928`; 508 events; 11 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 touch HYPE: 11 of 24 positive, all long; long structural/24h +$5.3k on 212 trades but 9 bad months, recent negative, top-5 wins exceed net. Drift suspect (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold24h | 212 | 80/132 | 38% | +$5,251 | +$3,117 | 11.9% | 1.20 | +$5,789 / -$538 | 9 of 22 (-$1,446) | +$5,944 | 6/9 |
| long__r2__hold168h | 202 | 85/117 | 42% | +$4,378 | +$2,345 | 11.3% | 1.17 | +$5,250 / -$871 | 9 of 22 (-$2,336) | +$4,528 | 6/9 |
| long__r2__hold24h | 208 | 92/116 | 44% | +$4,252 | +$2,158 | 10.9% | 1.18 | +$5,276 / -$1,025 | 9 of 22 (-$1,478) | +$4,110 | 7/9 |
| short__r3__hold24h | 185 | 61/124 | 33% | -$5,402 | -$7,254 | 19.6% | 0.80 | -$3,684 / -$1,719 | 11 of 22 (-$1,691) | +$4,604 | 1/9 |

Artifacts: `backtests/setup-replays/e453043a9f1534aaff37299048ddcca642892a34a3296c28726e3f03ffb943e1/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry touch · `d4276065`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `d8bd3f48`; 153 events; 9 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 4h touch HYPE (depart 3%, clocks x4): 9 of 24 positive, longs only; long r2/168h +$3.9k PF 1.49 on 51, 5 bad months, top-5 above net, recent +$158 (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold168h | 51 | 24/27 | 47% | +$3,863 | +$3,350 | 4.3% | 1.49 | +$3,704 / +$158 | 5 of 20 (-$1,393) | +$4,097 | 7/9 |
| long__r2__hold336h | 51 | 24/27 | 47% | +$3,863 | +$3,350 | 4.3% | 1.49 | +$3,704 / +$158 | 5 of 20 (-$1,393) | +$4,097 | 7/9 |
| long__r2__hold72h | 51 | 25/26 | 49% | +$3,518 | +$3,006 | 4.4% | 1.48 | +$3,359 / +$158 | 5 of 20 (-$1,393) | +$3,898 | 7/9 |
| short__r2__hold168h | 38 | 11/27 | 29% | -$1,824 | -$2,205 | 13.0% | 0.72 | -$1,069 / -$755 | 7 of 19 (-$1,910) | +$3,637 | 1/9 |

Artifacts: `backtests/setup-replays/d4276065a26de55b49ec7c9585f4a3f5815c44cc5f82f3d25f55ef729277cab3/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry touch · `aad7b4d2`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `2f4999ae`; 22 events; 22 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily touch HYPE (depart 6%): 22 events, at most 8 trades per cell; not a sample (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold720h | 7 | 4/3 | 57% | +$4,871 | +$4,793 | 7.0% | 3.51 | +$1,026 / +$3,845 | 3 of 6 (-$942) | +$6,276 | 6/9 |
| short__r3__hold168h | 7 | 5/2 | 71% | +$4,824 | +$4,746 | 5.5% | 4.15 | +$2,199 / +$2,624 | 2 of 6 (-$942) | +$5,851 | 6/9 |
| short__r3__hold336h | 7 | 4/3 | 57% | +$4,460 | +$4,382 | 7.0% | 3.28 | +$1,026 / +$3,434 | 3 of 6 (-$942) | +$5,865 | 6/9 |
| long__r2__hold168h | 2 | 1/1 | 50% | +$1,712 | +$1,691 | 2.0% | 4.60 | +$1,712 / +$0 | 1 of 2 (-$475) | +$2,187 | 5/9 |

Artifacts: `backtests/setup-replays/aad7b4d28903e591b819b726df3e1929a26f6582d4463a3dc45403d08dc97829/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry touch · rows rejected:two_tap_no_sweep · `0292aa68`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `578da928`; 149 events; 0 of 24 cells positive; 0 pass all screens. Status **control**: PA05 two-tap control HYPE: 0/24 positive; stop under the level makes the bracket far tighter than the candidate's, so not a matched comparison (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r1.5__hold24h | 149 | 74/75 | 50% | -$1,337 | -$2,827 | 4.3% | 0.51 | -$1,121 / -$216 | 1 of 21 (-$312) | +$207 | 1/9 |
| short__r1.5__hold72h | 149 | 74/75 | 50% | -$1,337 | -$2,827 | 4.3% | 0.51 | -$1,121 / -$216 | 1 of 21 (-$312) | +$207 | 1/9 |
| short__r1.5__hold168h | 149 | 74/75 | 50% | -$1,337 | -$2,827 | 4.3% | 0.51 | -$1,121 / -$216 | 1 of 21 (-$312) | +$207 | 1/9 |
| long__r1.5__hold24h | 143 | 73/70 | 51% | -$1,741 | -$3,171 | 5.6% | 0.42 | -$1,046 / -$696 | 1 of 22 (-$339) | +$220 | 1/9 |

Artifacts: `backtests/setup-replays/0292aa68218f47546cdccf996a03abc1235370acc909c743e1c0f15117542db8/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry reaction · `ea94cab3`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `637cb080`; 242 events; 8 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 reaction SOL: 8 of 24 positive; long r2/168h +$2.6k PF 1.28 on 82 (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold168h | 82 | 51/31 | 62% | +$2,641 | +$1,820 | 6.0% | 1.28 | +$2,614 / +$346 | 6 of 21 (-$1,110) | +$3,638 | 7/9 |
| long__r2__hold24h | 87 | 53/34 | 61% | +$1,529 | +$657 | 4.6% | 1.21 | +$1,436 / +$93 | 7 of 21 (-$698) | +$2,815 | 7/9 |
| long__r2__hold72h | 83 | 51/32 | 61% | +$1,240 | +$409 | 7.0% | 1.13 | +$1,059 / +$346 | 7 of 21 (-$1,110) | +$3,279 | 7/9 |
| short__r3__hold168h | 90 | 48/42 | 53% | +$1,112 | +$203 | 12.0% | 1.10 | +$1,448 / -$336 | 7 of 22 (-$1,681) | +$3,675 | 6/9 |

Artifacts: `backtests/setup-replays/ea94cab38ce1073158dc56e8ca3876c22c19d4885ac804c160bdb81fd0d69dce/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry reaction · `28f11806`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `bd015cc1`; 82 events; 5 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 4h reaction SOL: 5 of 24 positive; long r1.5 14/5 +$1.2k on 19 trades (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold336h | 25 | 17/8 | 68% | +$1,346 | +$1,095 | 7.8% | 1.36 | +$838 / +$508 | 5 of 16 (-$725) | +$3,254 | 6/9 |
| long__r1.5__hold72h | 19 | 14/5 | 74% | +$1,190 | +$1,000 | 3.7% | 1.78 | +$178 / +$1,012 | 2 of 14 (-$870) | +$1,878 | 6/9 |
| long__r1.5__hold168h | 19 | 14/5 | 74% | +$1,190 | +$1,000 | 3.7% | 1.78 | +$178 / +$1,012 | 2 of 14 (-$870) | +$1,878 | 6/9 |
| short__r1.5__hold72h | 18 | 8/10 | 44% | -$2,095 | -$2,276 | 7.6% | 0.31 | -$1,896 / -$199 | 4 of 13 (-$841) | +$875 | 0/9 |

Artifacts: `backtests/setup-replays/28f11806e4ec47e99e2dafcbabcd55cf2f7a153778585bf429d8dfe9443ee51e/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry reaction · `0c7cf4d4`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `f8ce1ae7`; 11 events; 0 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily reaction SOL: 11 events, 0 of 24 positive (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold336h | 3 | 1/2 | 33% | -$818 | -$847 | 7.5% | 0.52 | -$818 / +$0 | 2 of 3 (-$886) | +$879 | 0/9 |
| long__r3__hold720h | 3 | 1/2 | 33% | -$818 | -$847 | 7.5% | 0.52 | -$818 / +$0 | 2 of 3 (-$886) | +$879 | 0/9 |
| long__structural__hold168h | 3 | 1/2 | 33% | -$1,165 | -$1,195 | 7.5% | 0.31 | -$1,165 / +$0 | 2 of 3 (-$886) | +$532 | 0/9 |
| short__r3__hold168h | 4 | 2/2 | 50% | -$1,840 | -$1,880 | 10.6% | 0.34 | -$1,840 / +$0 | 1 of 3 (-$2,800) | +$960 | 0/9 |

Artifacts: `backtests/setup-replays/0c7cf4d49b3d0caddeaf19d6299dcb649667053f2915cc34bdf37c645be0a8d2/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry touch · `8232b437`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b8043a7b`; 412 events; 13 of 24 cells positive; 0 pass all screens. Status **lead**: PA05 touch SOL: long structural/24h 76/88 +$3.7k PF 1.25 on 164, both windows positive, net above top-5, 3 bad months. Same drift caveat as HYPE (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__structural__hold24h | 164 | 76/88 | 46% | +$3,738 | +$2,095 | 7.1% | 1.25 | +$3,337 / +$401 | 3 of 21 (-$832) | +$3,070 | 8/9 |
| long__r2__hold24h | 157 | 76/81 | 48% | +$2,962 | +$1,389 | 5.5% | 1.22 | +$1,891 / +$1,071 | 5 of 21 (-$660) | +$3,944 | 7/9 |
| long__r1.5__hold24h | 156 | 79/77 | 51% | +$2,873 | +$1,311 | 5.8% | 1.23 | +$1,923 / +$950 | 5 of 21 (-$747) | +$3,143 | 7/9 |
| short__r3__hold168h | 151 | 53/98 | 35% | +$2,759 | +$1,241 | 12.3% | 1.15 | +$3,370 / -$611 | 7 of 22 (-$1,998) | +$4,499 | 6/9 |

Artifacts: `backtests/setup-replays/8232b43781d00bac3e6b2b2757da1b5cd424387e6c3f92878f9e211d9d63bc10/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry touch · `0d58f3f7`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48; targets structural/r1.5/r2/r3; holds 72/168/336h; scan `39114cbc`; 137 events; 3 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 4h touch SOL: 3 of 24 positive; long r1.5/72h +$1.5k PF 1.32 on 39, top-5 double the net (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold72h | 39 | 17/22 | 44% | +$1,500 | +$1,109 | 5.7% | 1.32 | +$999 / +$501 | 5 of 19 (-$798) | +$3,024 | 7/9 |
| long__r1.5__hold168h | 39 | 16/23 | 41% | +$814 | +$424 | 6.2% | 1.16 | +$313 / +$501 | 6 of 19 (-$798) | +$3,024 | 7/9 |
| long__r1.5__hold336h | 39 | 16/23 | 41% | +$814 | +$424 | 6.2% | 1.16 | +$313 / +$501 | 6 of 19 (-$798) | +$3,024 | 7/9 |
| short__r1.5__hold72h | 41 | 12/29 | 29% | -$4,493 | -$4,905 | 14.7% | 0.36 | -$4,075 / -$418 | 10 of 19 (-$803) | +$1,827 | 1/9 |

Artifacts: `backtests/setup-replays/0d58f3f7ef240af13197de3369af7e4f9472c5aa290b6795cec9e089b69d1298/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry touch · `5493b502`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72; targets structural/r1.5/r2/r3; holds 168/336/720h; scan `14bdd4fd`; 23 events; 3 of 24 cells positive; 0 pass all screens. Status **parked**: PA05 daily touch SOL: 23 events, at most 9 trades per cell, 3 of 24 positive (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r1.5__hold168h | 4 | 2/2 | 50% | +$146 | +$106 | 4.8% | 1.19 | +$146 / +$0 | 2 of 3 (-$494) | +$930 | 5/9 |
| long__r1.5__hold336h | 4 | 2/2 | 50% | +$146 | +$106 | 4.8% | 1.19 | +$146 / +$0 | 2 of 3 (-$494) | +$930 | 5/9 |
| long__r1.5__hold720h | 4 | 2/2 | 50% | +$146 | +$106 | 4.8% | 1.19 | +$146 / +$0 | 2 of 3 (-$494) | +$930 | 5/9 |
| short__structural__hold168h | 9 | 3/6 | 33% | -$1,965 | -$2,056 | 8.1% | 0.47 | -$1,965 / +$0 | 4 of 7 (-$1,485) | +$1,773 | 0/9 |

Artifacts: `backtests/setup-replays/5493b5029d819913683c334931e8845f3cf508451f871d309afcca92ed358c46/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry touch · rows rejected:two_tap_no_sweep · `70c728a6`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `b8043a7b`; 347 events; 0 of 24 cells positive; 0 pass all screens. Status **control**: PA05 two-tap control SOL: 0/24 positive; same geometry caveat (Fable, 2026-09-20).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold24h | 347 | 180/167 | 52% | -$2,302 | -$5,771 | 9.0% | 0.78 | -$2,329 / +$27 | 2 of 22 (-$494) | +$496 | 1/9 |
| short__r3__hold72h | 347 | 180/167 | 52% | -$2,302 | -$5,771 | 9.0% | 0.78 | -$2,329 / +$27 | 2 of 22 (-$494) | +$496 | 1/9 |
| short__r3__hold168h | 347 | 180/167 | 52% | -$2,302 | -$5,771 | 9.0% | 0.78 | -$2,329 / +$27 | 2 of 22 (-$494) | +$496 | 1/9 |
| long__r1.5__hold24h | 230 | 105/125 | 46% | -$2,722 | -$5,022 | 8.8% | 0.33 | -$1,984 / -$738 | 3 of 22 (-$532) | +$184 | 1/9 |

Artifacts: `backtests/setup-replays/70c728a611412edb0c361ae5321a2e87de1ef936495153d363bbd839dbb4cde6/report.md`, `chart.html` beside it if generated.

### RS01 (rs01-scan-v1)

#### BTCUSDT · entry msb · `d35591f1`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7abb4859`; 68 events; 17 of 24 cells positive; 0 pass all screens. Status **lead**: RS01 MSB BTC: shorts r1.5 16/2 +$1.9k PF 4.7, both windows positive, no bad month, on 18 trades; cleanest cell in the study and still tiny (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r1.5__hold168h | 18 | 16/2 | 89% | +$1,948 | +$1,770 | 1.4% | 4.67 | +$1,248 / +$700 | 0 of 13 (-$81) | +$1,364 | 8/9 |
| short__r1.5__hold72h | 18 | 15/3 | 83% | +$1,834 | +$1,655 | 1.4% | 5.39 | +$1,134 / +$700 | 0 of 13 (-$81) | +$1,318 | 8/9 |
| short__r2__hold72h | 21 | 15/6 | 71% | +$1,813 | +$1,604 | 2.2% | 3.16 | +$762 / +$1,051 | 0 of 15 (-$219) | +$1,736 | 8/9 |
| long__r3__hold24h | 37 | 26/11 | 70% | +$1,558 | +$1,187 | 3.8% | 1.60 | +$1,125 / +$434 | 0 of 17 (-$231) | +$1,988 | 8/9 |

Artifacts: `backtests/setup-replays/d35591f13b3b3faea94776404f8462721ac8c5d09683f8116c8a631ad75a187e/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · entry retest · `c2ff6ea2`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `c89feb58`; 17 events; 19 of 24 cells positive; 0 pass all screens. Status **parked**: RS01 retest BTC: 10 long / 7 short trades; a list of trades, not a sample (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold168h | 10 | 6/4 | 60% | +$1,662 | +$1,561 | 2.7% | 2.82 | +$739 / +$923 | 3 of 8 (-$351) | +$2,394 | 6/9 |
| long__r2__hold72h | 10 | 6/4 | 60% | +$1,472 | +$1,371 | 2.7% | 2.61 | +$739 / +$733 | 3 of 8 (-$351) | +$2,204 | 6/9 |
| long__r3__hold168h | 10 | 5/5 | 50% | +$1,347 | +$1,247 | 2.5% | 2.31 | +$508 / +$839 | 3 of 8 (-$351) | +$2,374 | 6/9 |
| short__r1.5__hold72h | 7 | 5/2 | 71% | +$1,064 | +$995 | 0.7% | 6.45 | +$879 / +$185 | 0 of 7 (-$95) | +$1,260 | 7/9 |

Artifacts: `backtests/setup-replays/c2ff6ea240b2bba8b8ccf8f6c900a653a59f73cc4264606ae5266b1f7c9ca64d/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry msb · `bc1a9da1`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `f2ea97e0`; 162 events; 17 of 24 cells positive; 0 pass all screens. Status **lead**: RS01 MSB HYPE: 17 of 24 positive on ~55 trades/side; long r3 flips negative versus retest mode; read this grid before the retest one (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 54 | 33/21 | 61% | +$2,659 | +$2,117 | 5.7% | 1.40 | +$2,224 / +$435 | 5 of 18 (-$812) | +$2,714 | 7/9 |
| short__r2__hold168h | 59 | 34/25 | 58% | +$2,228 | +$1,640 | 7.8% | 1.20 | +$2,899 / -$671 | 5 of 20 (-$1,085) | +$3,542 | 6/9 |
| short__r2__hold72h | 59 | 34/25 | 58% | +$1,978 | +$1,389 | 7.8% | 1.19 | +$2,168 / -$190 | 5 of 20 (-$1,085) | +$3,362 | 6/9 |

Artifacts: `backtests/setup-replays/bc1a9da150c6c07260388dfb6ab8d500adaca0484f286a9242c4d5e54877e65a/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry retest · `90618dc7`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `9c112800`; 63 events; 20 of 24 cells positive; 0 pass all screens. Status **lead**: RS01 retest HYPE: 20 of 24 cells positive on ~20 trades/side; recent window negative; monthly screen fails; top-5 wins exceed net. Card first, 30m trigger as a new version (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold168h | 20 | 7/13 | 35% | +$4,018 | +$3,815 | 5.0% | 2.23 | +$4,276 / -$258 | 4 of 12 (-$486) | +$5,835 | 5/9 |
| short__r3__hold72h | 24 | 11/13 | 46% | +$3,483 | +$3,245 | 5.1% | 1.91 | +$4,834 / -$1,351 | 5 of 15 (-$1,351) | +$4,719 | 5/9 |
| long__r3__hold24h | 20 | 9/11 | 45% | +$3,102 | +$2,900 | 3.2% | 2.42 | +$2,852 / +$250 | 0 of 12 (-$243) | +$4,432 | 7/9 |

Artifacts: `backtests/setup-replays/90618dc7dfff4d8d9a91bc2611cccf28905e48d4fd9325c15cbda538483e55bb/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry msb · rows rejected:no_fvg · `98aecd4f`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `f2ea97e0`; 20 events; 10 of 24 cells positive; 0 pass all screens. Status **control**: RS01 MSB HYPE no-FVG rows: per trade in the same range as the candidate; FVG rule not shown to matter (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold72h | 20 | 8/12 | 40% | +$1,653 | +$1,452 | 6.3% | 1.42 | +$1,538 / +$114 | 5 of 13 (-$835) | +$4,937 | 6/9 |
| long__r3__hold168h | 20 | 8/12 | 40% | +$1,653 | +$1,452 | 6.3% | 1.42 | +$1,538 / +$114 | 5 of 13 (-$835) | +$4,937 | 6/9 |
| short__r2__hold72h | 27 | 15/12 | 56% | +$933 | +$663 | 8.5% | 1.19 | -$38 / +$970 | 4 of 16 (-$1,892) | +$3,311 | 5/9 |

Artifacts: `backtests/setup-replays/98aecd4f8a9c85ae5a2154e5a31cb8c41d9ea61a1f365a6ab0b1884fe188270a/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry retest · rows rejected:no_fvg · `36ba8fe7`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `9c112800`; 6 events; 0 of 24 cells positive; 0 pass all screens. Status **control**: RS01 retest HYPE no-FVG rows: 6 rows, all short, all negative (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| short__r3__hold24h | 6 | 1/5 | 17% | -$592 | -$652 | 5.3% | 0.65 | -$592 / +$0 | 3 of 5 (-$621) | +$1,121 | 0/9 |
| short__r3__hold72h | 6 | 1/5 | 17% | -$592 | -$652 | 5.3% | 0.65 | -$592 / +$0 | 3 of 5 (-$621) | +$1,121 | 0/9 |
| short__r3__hold168h | 6 | 1/5 | 17% | -$592 | -$652 | 5.3% | 0.65 | -$592 / +$0 | 3 of 5 (-$621) | +$1,121 | 0/9 |
| long__structural__hold24h | 4 | 0/4 | 0% | -$930 | -$969 | 2.9% | 0.00 | -$930 / +$0 | 2 of 3 (-$309) | +$0 | 0/9 |

Artifacts: `backtests/setup-replays/36ba8fe76231071929aed272ced84560cc831d5c300a2063189dc3e69b9fd180/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry msb · `8dc060d2`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `a687da17`; 118 events; 15 of 24 cells positive; 0 pass all screens. Status **lead**: RS01 MSB SOL: longs carry it (15 of 24 positive), shorts lose everywhere; mirror of BTC (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold24h | 53 | 30/23 | 57% | +$2,698 | +$2,166 | 5.3% | 1.42 | +$1,492 / +$1,205 | 6 of 21 (-$959) | +$3,228 | 7/9 |
| long__r2__hold24h | 53 | 32/21 | 60% | +$2,527 | +$1,996 | 5.6% | 1.47 | +$758 / +$1,769 | 5 of 21 (-$959) | +$2,678 | 7/9 |
| long__r2__hold168h | 50 | 28/22 | 56% | +$2,366 | +$1,864 | 6.6% | 1.28 | +$916 / +$1,769 | 6 of 21 (-$1,217) | +$3,553 | 7/9 |
| short__r3__hold24h | 45 | 22/23 | 49% | +$982 | +$532 | 3.4% | 1.19 | +$1,496 / -$515 | 3 of 18 (-$445) | +$2,940 | 6/9 |

Artifacts: `backtests/setup-replays/8dc060d21dbe5e51886a9f4f3b8794f78ed75f1d3798ca8ccbbdcca82b6d6cc8/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · entry retest · `fdce67ef`

Window 2024-12-27 to 2026-09-15; params defaults; targets structural/r1.5/r2/r3; holds 24/72/168h; scan `7f97cc89`; 40 events; 9 of 24 cells positive; 0 pass all screens. Status **parked**: RS01 retest SOL: only longs positive (9 of 24), every short cell negative (Fable, 2026-09-19).

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r3__hold24h | 21 | 12/9 | 57% | +$1,971 | +$1,760 | 3.3% | 1.87 | +$1,954 / +$18 | 2 of 14 (-$832) | +$3,106 | 6/9 |
| long__r2__hold24h | 21 | 12/9 | 57% | +$1,213 | +$1,002 | 3.3% | 1.54 | +$1,195 / +$18 | 2 of 14 (-$832) | +$2,226 | 6/9 |
| long__r3__hold72h | 20 | 8/12 | 40% | +$1,133 | +$922 | 5.2% | 1.26 | +$1,112 / +$76 | 3 of 13 (-$1,088) | +$3,384 | 6/9 |
| short__r1.5__hold72h | 12 | 4/8 | 33% | -$441 | -$561 | 4.1% | 0.77 | +$10 / -$451 | 4 of 11 (-$463) | +$1,441 | 0/9 |

Artifacts: `backtests/setup-replays/fdce67ef2fe3909bc3915bb0d660cb5148a9fd9fcc538cfeb45f37466d8849af/report.md`, `chart.html` beside it if generated.

### SF01 (sf01-v1)

#### BTCUSDT · `ef2f86ec`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `c00f093d`; 325 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 223 | 80/143 | 36% | -$3,339 | -$5,578 | 18.1% | 0.84 | -$2,996 / -$172 | 10 of 22 (-$1,703) | +$2,890 | 1/9 |
| long__r2__hold24h | 233 | 87/146 | 37% | -$3,888 | -$6,228 | 15.6% | 0.78 | -$3,439 / -$449 | 10 of 22 (-$1,700) | +$2,511 | 1/9 |

Artifacts: `backtests/setup-replays/ef2f86ec200ed07f1024b30440e54c4761e50cd5bea452cc89e4009c9d72033e/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · `1193de66`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `a6326fac`; 176 events; 0 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 127 | 48/79 | 38% | -$374 | -$1,655 | 8.7% | 0.97 | -$191 / -$183 | 7 of 22 (-$1,092) | +$2,689 | 1/9 |
| long__r2__hold24h | 128 | 47/81 | 37% | -$1,044 | -$2,334 | 9.7% | 0.90 | -$1,118 / +$75 | 6 of 22 (-$1,092) | +$2,427 | 1/9 |
| long__structural__hold72h | 124 | 39/85 | 31% | -$1,759 | -$3,009 | 12.8% | 0.85 | -$937 / -$822 | 8 of 22 (-$1,092) | +$2,983 | 1/9 |

Artifacts: `backtests/setup-replays/1193de66ff43b887eedb103ec898dbc3742479b6a7bf279984a39dc0ffbd7860/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · `5d00d4f7`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `f76108f3`; 325 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 222 | 80/142 | 36% | -$3,401 | -$5,631 | 18.2% | 0.84 | -$2,992 / -$238 | 10 of 22 (-$1,714) | +$2,898 | 1/9 |
| long__r2__hold24h | 232 | 85/147 | 37% | -$4,061 | -$6,390 | 15.7% | 0.77 | -$3,491 / -$570 | 10 of 22 (-$1,690) | +$2,507 | 1/9 |

Artifacts: `backtests/setup-replays/5d00d4f78eb5487073eea03aff910f2ce58d7e500fb6fab15bb7b080332d1cdf/report.md`, `chart.html` beside it if generated.

#### BTCUSDT · `e65570fa`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `1781e1e2`; 176 events; 0 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold72h | 126 | 48/78 | 38% | -$417 | -$1,688 | 8.8% | 0.97 | -$130 / -$288 | 7 of 22 (-$1,063) | +$2,716 | 1/9 |
| long__r2__hold24h | 127 | 47/80 | 37% | -$1,168 | -$2,448 | 9.9% | 0.88 | -$1,097 / -$71 | 6 of 22 (-$1,063) | +$2,449 | 1/9 |
| long__structural__hold72h | 123 | 39/84 | 32% | -$1,768 | -$3,008 | 12.8% | 0.85 | -$865 / -$903 | 9 of 22 (-$1,063) | +$2,980 | 1/9 |

Artifacts: `backtests/setup-replays/e65570faf414f5e13593705e27b9f63f24773e820e30115260cb0a32c7e0cf8a/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `a9b7895e`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `699a09fb`; 321 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 207 | 72/135 | 35% | +$2,530 | +$448 | 12.0% | 1.10 | +$1,174 / +$1,356 | 7 of 22 (-$1,431) | +$4,470 | 6/9 |
| long__r2__hold72h | 206 | 68/138 | 33% | +$1,483 | -$589 | 15.5% | 1.05 | -$870 / +$2,354 | 10 of 22 (-$1,700) | +$4,590 | 4/9 |

Artifacts: `backtests/setup-replays/a9b7895eea0a305483e15c09235da8be94afe0cdc529334cdd01e794084478f3/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `8aa5c08a`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `48f2ef4a`; 192 events; 3 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,690 | +$1,458 | 7.9% | 1.17 | +$1,293 / +$1,397 | 8 of 22 (-$815) | +$4,334 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,223 | -$9 | 11.8% | 1.07 | -$467 / +$1,690 | 9 of 22 (-$845) | +$4,493 | 4/9 |
| long__structural__hold24h | 121 | 31/90 | 26% | +$299 | -$922 | 16.5% | 1.02 | -$661 / +$960 | 10 of 22 (-$1,330) | +$5,953 | 4/9 |

Artifacts: `backtests/setup-replays/8aa5c08a70a5446b9a711a44b5df2449293fb7da75d3ce1050890332b510693a/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `61590c1f`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `f2e9e765`; 321 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 207 | 73/134 | 35% | +$2,385 | +$303 | 11.8% | 1.09 | +$1,112 / +$1,273 | 7 of 22 (-$1,483) | +$4,476 | 6/9 |
| long__r2__hold72h | 206 | 68/138 | 33% | +$1,290 | -$782 | 15.8% | 1.04 | -$960 / +$2,250 | 10 of 22 (-$1,647) | +$4,597 | 4/9 |

Artifacts: `backtests/setup-replays/61590c1f94731088e04aa56be112d362e68cb954c657f9bc191c6187c80a09cf/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `d8a1650c`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `30c8eadf`; 192 events; 3 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,632 | +$1,400 | 7.8% | 1.17 | +$1,311 / +$1,321 | 8 of 22 (-$838) | +$4,322 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,111 | -$120 | 11.7% | 1.06 | -$481 / +$1,592 | 9 of 22 (-$838) | +$4,490 | 4/9 |
| long__structural__hold24h | 121 | 32/89 | 26% | +$213 | -$1,007 | 16.2% | 1.01 | -$685 / +$899 | 9 of 22 (-$1,313) | +$6,014 | 4/9 |

Artifacts: `backtests/setup-replays/d8a1650c563ed9c4d3baaa3b66f3315f842a3ca740de8ee4a73af78a7035f823/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `7db6a2c5`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `6451646d`; 321 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 207 | 72/135 | 35% | +$2,530 | +$448 | 12.0% | 1.10 | +$1,174 / +$1,356 | 7 of 22 (-$1,431) | +$4,470 | 6/9 |
| long__r2__hold72h | 206 | 68/138 | 33% | +$1,483 | -$589 | 15.5% | 1.05 | -$870 / +$2,354 | 10 of 22 (-$1,700) | +$4,590 | 4/9 |

Artifacts: `backtests/setup-replays/7db6a2c56ad4f9a7ab4d3a31a2f27c7e53368411bc4eef8ddb39d5af84fe7963/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `04ac719c`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `8fb2aed3`; 192 events; 3 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,690 | +$1,458 | 7.9% | 1.17 | +$1,293 / +$1,397 | 8 of 22 (-$815) | +$4,334 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,223 | -$9 | 11.8% | 1.07 | -$467 / +$1,690 | 9 of 22 (-$845) | +$4,493 | 4/9 |
| long__structural__hold24h | 121 | 31/90 | 26% | +$299 | -$922 | 16.5% | 1.02 | -$661 / +$960 | 10 of 22 (-$1,330) | +$5,953 | 4/9 |

Artifacts: `backtests/setup-replays/04ac719c45c99849b51c7ef0c47194535e833079f060ffa209c382c8c29ef4ae/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `4469cd1c`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `51166b5b`; 321 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 207 | 73/134 | 35% | +$2,385 | +$303 | 11.8% | 1.09 | +$1,112 / +$1,273 | 7 of 22 (-$1,483) | +$4,476 | 6/9 |
| long__r2__hold72h | 206 | 68/138 | 33% | +$1,290 | -$782 | 15.8% | 1.04 | -$960 / +$2,250 | 10 of 22 (-$1,647) | +$4,597 | 4/9 |

Artifacts: `backtests/setup-replays/4469cd1c5f753f539921e18e07335fa710d4b629724f3ebf43699fcd9bf5f374/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `79d7cba9`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `1e5d40dd`; 192 events; 3 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,632 | +$1,400 | 7.8% | 1.17 | +$1,311 / +$1,321 | 8 of 22 (-$838) | +$4,322 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,111 | -$120 | 11.7% | 1.06 | -$481 / +$1,592 | 9 of 22 (-$838) | +$4,490 | 4/9 |
| long__structural__hold24h | 121 | 32/89 | 26% | +$213 | -$1,007 | 16.2% | 1.01 | -$685 / +$899 | 9 of 22 (-$1,313) | +$6,014 | 4/9 |

Artifacts: `backtests/setup-replays/79d7cba93b01db4f740d8c5ced79fb45dd12694a10aa220d53a82cde9bd8a9dd/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `032fdf6d`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=15; targets r2; holds 24/72h; scan `14fb113c`; 239 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 190 | 70/120 | 37% | -$2,259 | -$4,168 | 14.3% | 0.88 | -$1,726 / -$533 | 9 of 22 (-$946) | +$3,425 | 1/9 |
| long__r2__hold72h | 189 | 68/121 | 36% | -$2,614 | -$4,513 | 15.4% | 0.87 | -$2,070 / -$544 | 8 of 22 (-$1,386) | +$3,880 | 1/9 |

Artifacts: `backtests/setup-replays/032fdf6db7eb4b3ba8d1b113305de77c44461cef8af104dd343ba01542155e6e/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `511dd948`

Window 2024-12-27 to 2026-09-15; params triggerTfMinutes=15; targets r2; holds 24/72h; scan `056817ae`; 239 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 189 | 69/120 | 37% | -$1,671 | -$3,571 | 13.3% | 0.90 | -$1,162 / -$509 | 10 of 22 (-$902) | +$3,437 | 1/9 |
| long__r2__hold72h | 188 | 68/120 | 36% | -$2,019 | -$3,909 | 14.4% | 0.89 | -$1,491 / -$527 | 10 of 22 (-$1,275) | +$3,914 | 1/9 |

Artifacts: `backtests/setup-replays/511dd9482230bfb2ec59a9dd04360eb2ba689fd47bc1d825c7b76d5cf430fc26/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `34806f0f`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `8fb2aed3`; 192 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,690 | +$1,458 | 7.9% | 1.17 | +$1,293 / +$1,397 | 8 of 22 (-$815) | +$4,334 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,223 | -$9 | 11.8% | 1.07 | -$467 / +$1,690 | 9 of 22 (-$845) | +$4,493 | 4/9 |

Artifacts: `backtests/setup-replays/34806f0f58714ba70ad8298b64b8ecff0b741ca40e600aa3478467f7037e08d9/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `95b72f40`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `1e5d40dd`; 192 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,632 | +$1,400 | 7.8% | 1.17 | +$1,311 / +$1,321 | 8 of 22 (-$838) | +$4,322 | 7/9 |
| long__r2__hold72h | 122 | 41/81 | 34% | +$1,111 | -$120 | 11.7% | 1.06 | -$481 / +$1,592 | 9 of 22 (-$838) | +$4,490 | 4/9 |

Artifacts: `backtests/setup-replays/95b72f4035febed4fb4a428cb903c937698bc1223363a4162d81ff9ceb6f31f4/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `bad2e7e2`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,690 | +$1,458 | 7.9% | 1.17 | +$1,293 / +$1,397 | 8 of 22 (-$815) | +$4,334 | 7/9 |

Artifacts: `backtests/setup-replays/bad2e7e22ee34ac23a30a7769e48f0c767ffea4bd7c0fe39d860736e867fb5ed/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `b01cf7b4`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 118 | 50/68 | 42% | +$3,429 | +$2,237 | 9.7% | 1.21 | +$2,120 / +$1,309 | 7 of 22 (-$961) | +$4,334 | 7/9 |

Artifacts: `backtests/setup-replays/b01cf7b4fcbef5bd30106824484c4b4fd154e204ac0d38f45a771803e685b2ee/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `3586c022`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 115 | 56/59 | 49% | +$4,552 | +$3,389 | 10.7% | 1.28 | +$2,714 / +$1,838 | 6 of 22 (-$1,107) | +$4,334 | 8/9 |

Artifacts: `backtests/setup-replays/3586c02231b34db5211680d0bba2e57c9e12f59745f88675a83cbcb41cf3a6ab/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `61e89e33`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 109 | 62/47 | 57% | +$5,883 | +$4,779 | 10.1% | 1.35 | +$3,262 / +$2,620 | 5 of 22 (-$1,229) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/61e89e33a9ca46a8c342f98c6894a0a44287d27ddbad0a1d91e7f4eab55be517/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `05daa351`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 104 | 63/41 | 61% | +$7,497 | +$6,442 | 8.5% | 1.49 | +$5,190 / +$2,307 | 3 of 22 (-$1,422) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/05daa3514685d750b47d19d56a817b2013de15618b2a1ddd577c6f5376e465e6/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `7c1c6272`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 122 | 43/79 | 35% | +$2,632 | +$1,400 | 7.8% | 1.17 | +$1,311 / +$1,321 | 8 of 22 (-$838) | +$4,322 | 7/9 |

Artifacts: `backtests/setup-replays/7c1c6272dc39f07a5143eb291da14d9c417d496a0fbbb95184b4dad873f22e60/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `e819a475`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 118 | 50/68 | 42% | +$3,383 | +$2,190 | 9.6% | 1.21 | +$2,149 / +$1,234 | 7 of 22 (-$984) | +$4,322 | 7/9 |

Artifacts: `backtests/setup-replays/e819a475eff4e61ce9f0914a224d984f5d2b3bac6948e0a5cbfdd29b8c2619a9/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `6236c231`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 115 | 56/59 | 49% | +$4,534 | +$3,371 | 10.6% | 1.28 | +$2,781 / +$1,753 | 6 of 22 (-$1,130) | +$4,322 | 8/9 |

Artifacts: `backtests/setup-replays/6236c231155ca2e47bfa1ead84727cc4ddb3374ef2ffe251d48636892d99277e/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `a7c66119`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 109 | 62/47 | 57% | +$5,779 | +$4,676 | 9.9% | 1.35 | +$3,274 / +$2,506 | 4 of 22 (-$1,215) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/a7c661199605c48a28c8494b7fadeecd4ccba6d1e90525a7d1413e667c06eba3/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `240ada45`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 104 | 63/41 | 61% | +$7,335 | +$6,281 | 8.3% | 1.48 | +$5,167 / +$2,168 | 3 of 22 (-$1,409) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/240ada454f84b5d4bea7bcab7edcdf779126ba76185b3a1e34219cd2c5972eb5/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `6498a27c`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,836 | +$6,791 | 7.5% | 1.53 | +$5,603 / +$2,233 | 3 of 22 (-$1,471) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/6498a27cb9347d7f65dd38ff38d6106f10855cb3f23bdf651c0ff5b6ffbd6016/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `eb923e32`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,837 | +$6,793 | 7.8% | 1.53 | +$5,236 / +$2,601 | 4 of 22 (-$1,519) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/eb923e3289e9b83343ca86056700457df9419e07f1f31e193d5dafe1dcc3a082/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `04b4f094`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,422 | +$6,377 | 8.1% | 1.49 | +$4,870 / +$2,552 | 5 of 22 (-$1,568) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/04b4f0947545b44f5755ef5dbffd4f95ce795682be6ea05eed6c68190bf49667/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `255da386`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,624 | +$7,599 | 7.8% | 1.63 | +$5,652 / +$2,972 | 3 of 22 (-$1,616) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/255da3864d9fa4ee2bf96ae5a6fc60f3f4f0a2a8ae3fcd656abcf52f83bdf96f/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `553b9360`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,971 | +$7,946 | 8.1% | 1.67 | +$6,024 / +$2,947 | 3 of 22 (-$1,269) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/553b93608d54ea36e557825238ce301a383935f783e123f3d647125b9bce19da/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `5ea46155`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$9,012 | +$7,987 | 8.3% | 1.67 | +$5,780 / +$3,232 | 3 of 22 (-$1,293) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/5ea4615593e2d4b34e34c631b739ff1582d0cb6098bcbce6f067a475c8e889f9/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `1563a11d`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$9,026 | +$8,001 | 8.5% | 1.68 | +$5,794 / +$3,232 | 3 of 22 (-$1,317) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/1563a11d9da66d8a924577ef7be007d9888a250c6b035dda227fc1dff4a2d290/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `fb891655`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,495 | +$10,468 | 5.2% | 1.96 | +$8,263 / +$3,232 | 2 of 22 (-$1,341) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/fb891655c07aa5db532fc3ddb4615835a2a45b1e81855a77f56adc56fc6844a6/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `091541af`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,323 | +$10,297 | 5.4% | 1.94 | +$8,091 / +$3,232 | 2 of 22 (-$1,364) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/091541afefdce8dfe83c2b0cc73429b6981d7eccb6023abc00bb4f33dcf1477d/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `e9f462dd`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,152 | +$10,126 | 5.5% | 1.91 | +$7,920 / +$3,232 | 2 of 22 (-$1,388) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/e9f462ddb5645f153b51ab3bab65293146394b7cf312f2d6b0a22e5628955d49/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `39e28a7d`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$10,980 | +$9,954 | 5.7% | 1.88 | +$7,748 / +$3,232 | 3 of 22 (-$1,412) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/39e28a7d187281c57fc148dc46b53318a271dfcf83fe2eb7275a9eaccdbdf824/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `4fb5870e`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,758 | +$10,732 | 5.7% | 2.01 | +$8,527 / +$3,232 | 3 of 22 (-$770) | +$4,282 | 8/9 |

Artifacts: `backtests/setup-replays/4fb5870edc63235bf758d09a7cb0996987eaabf804db06f797122b137e8aee13/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `a664d68d`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,725 | +$6,681 | 7.3% | 1.52 | +$5,631 / +$2,094 | 3 of 22 (-$1,457) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/a664d68dcdb94bf9ad3997c9c975b377e4e62622ae08a22d239040434c4620b2/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `2e90fd7e`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,730 | +$6,686 | 7.6% | 1.52 | +$5,264 / +$2,466 | 3 of 22 (-$1,506) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/2e90fd7ea9bd965b962823d6615a2e4817c5b657580b55b5f7f9be15a8a8b96d/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `65035405`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 103 | 63/40 | 61% | +$7,314 | +$6,270 | 7.9% | 1.48 | +$4,897 / +$2,417 | 4 of 22 (-$1,554) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/65035405208da5a5633c4eec252eee8c68cff097ca81fc3a664317253a7d3118/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `e9abf4d2`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,453 | +$7,429 | 7.8% | 1.61 | +$5,619 / +$2,835 | 3 of 22 (-$1,603) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/e9abf4d2907e35eb5a94b3c64ce63377f5d33a43e1c968193048dccf16a47066/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `a72f4d65`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,816 | +$7,791 | 8.0% | 1.66 | +$6,006 / +$2,810 | 3 of 22 (-$1,244) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/a72f4d65a5e7142b284c2a5490b65f5515b5a7bd5d6218e9c08a4f2aa2f9c2c6/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `0fcc62e0`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,872 | +$7,847 | 8.2% | 1.66 | +$5,762 / +$3,110 | 3 of 22 (-$1,267) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/0fcc62e0251ffc0b2c4e1c47965ea017734dadb0c06239252680d0833013c609/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `bc1e7a2f`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 63/38 | 62% | +$8,866 | +$7,841 | 8.4% | 1.66 | +$5,756 / +$3,110 | 3 of 22 (-$1,291) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/bc1e7a2f34bd47e060de5285d1f4d5da1ec6f500fda4528adf47e0383b7cd9a7/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `5bfbbb34`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,332 | +$10,306 | 5.2% | 1.95 | +$8,222 / +$3,110 | 2 of 22 (-$1,315) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/5bfbbb349d92aef47f2982e46e16f6b52927714d523090c683778a2c0c66f13d/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `ef8040a8`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,161 | +$10,135 | 5.4% | 1.92 | +$8,051 / +$3,110 | 2 of 22 (-$1,339) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/ef8040a832c9b7e13712f3279d4d72eca79dbb453ff46346ead257df248d636f/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `5e77e7ed`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$10,989 | +$9,963 | 5.5% | 1.89 | +$7,879 / +$3,110 | 2 of 22 (-$1,362) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/5e77e7edb333c483d2eae95bb7c8f92dbde9293fd453a5f3413ff66b8c82ddb2/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `9fd71258`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$10,818 | +$9,792 | 5.6% | 1.87 | +$7,708 / +$3,110 | 2 of 22 (-$1,386) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/9fd71258cb3b2e371bc527790eb5e0bc41be1c977179bd2d3746385a2a5684b8/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `5f2f2766`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$11,589 | +$10,563 | 5.7% | 1.99 | +$8,479 / +$3,110 | 3 of 22 (-$806) | +$4,267 | 8/9 |

Artifacts: `backtests/setup-replays/5f2f276602c5c70009ec90f26fab81d6a6ce6bde54f463d98d71f876af852d22/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `b05199b1`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `8fb2aed3`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$22,989 | +$20,936 | 8.9% | 1.96 | +$16,525 / +$6,464 | 4 of 22 (-$2,681) | +$8,564 | 8/9 |

Artifacts: `backtests/setup-replays/b05199b12851c6e11114a3c6782692168f3de3f15e03ec0ba31bc7ac80df9d78/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · `ea7325c4`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24h; scan `1e5d40dd`; 192 events; 1 of 1 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 101 | 65/36 | 64% | +$22,664 | +$20,612 | 8.9% | 1.95 | +$16,444 / +$6,220 | 3 of 22 (-$2,630) | +$8,534 | 8/9 |

Artifacts: `backtests/setup-replays/ea7325c4695455fb9c2a4b0b73586829b174950277fab928132f9663a005e6e1/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/open/4h · `f545ef14`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `8fb2aed3`; 192 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 45 | 2/43 | 4% | +$219 | -$231 | 4.1% | 1.12 | +$367 / -$147 | 2 of 19 (-$394) | +$2,009 | 5/9 |
| long__r2__hold72h | 45 | 2/43 | 4% | +$219 | -$231 | 4.1% | 1.12 | +$367 / -$147 | 2 of 19 (-$394) | +$2,009 | 5/9 |

Artifacts: `backtests/setup-replays/f545ef14ca472cbeb13fcb4f7eded4b5c997d5cbc977e6f337968b32378eef86/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/open/4h · `8d283ff0`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `1e5d40dd`; 192 events; 2 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 45 | 2/43 | 4% | +$219 | -$231 | 4.1% | 1.12 | +$367 / -$147 | 2 of 19 (-$394) | +$2,009 | 5/9 |
| long__r2__hold72h | 45 | 2/43 | 4% | +$219 | -$231 | 4.1% | 1.12 | +$367 / -$147 | 2 of 19 (-$394) | +$2,009 | 5/9 |

Artifacts: `backtests/setup-replays/8d283ff0fe4869b6b0576b7c65fae681183f811e661c098394335dded943fabf/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/open/4h/0.1% · `6be4ab01`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `8fb2aed3`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 48 | 3/45 | 6% | -$767 | -$1,247 | 5.9% | 0.64 | -$559 / -$207 | 2 of 19 (-$422) | +$1,340 | 1/9 |
| long__r2__hold72h | 48 | 2/46 | 4% | -$987 | -$1,467 | 6.6% | 0.56 | -$780 / -$207 | 2 of 19 (-$422) | +$1,270 | 1/9 |

Artifacts: `backtests/setup-replays/6be4ab01ed329db4f3cbfc20410ec41543084c0730e380d7d873537943bfd5f6/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/open/4h/0.1% · `81c8c391`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `1e5d40dd`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 48 | 3/45 | 6% | -$767 | -$1,247 | 5.9% | 0.64 | -$559 / -$207 | 2 of 19 (-$422) | +$1,340 | 1/9 |
| long__r2__hold72h | 48 | 2/46 | 4% | -$987 | -$1,467 | 6.6% | 0.56 | -$780 / -$207 | 2 of 19 (-$422) | +$1,270 | 1/9 |

Artifacts: `backtests/setup-replays/81c8c3918bb2152063ced28c8f98639493f37cfcd60b8f0de758d28bddc925bc/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/touch/4h · `afd57aea`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `8fb2aed3`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 48 | 2/46 | 4% | -$254 | -$735 | 4.2% | 0.84 | -$128 / -$126 | 2 of 19 (-$383) | +$1,291 | 1/9 |
| long__r2__hold72h | 48 | 2/46 | 4% | -$254 | -$735 | 4.2% | 0.84 | -$128 / -$126 | 2 of 19 (-$383) | +$1,291 | 1/9 |

Artifacts: `backtests/setup-replays/afd57aea41d0ba747164c266bf8fab470b4d7f2138e54157eb9987b9e2328825/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/touch/4h · `5f0c8d53`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `1e5d40dd`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 48 | 2/46 | 4% | -$254 | -$735 | 4.2% | 0.84 | -$128 / -$126 | 2 of 19 (-$383) | +$1,291 | 1/9 |
| long__r2__hold72h | 48 | 2/46 | 4% | -$254 | -$735 | 4.2% | 0.84 | -$128 / -$126 | 2 of 19 (-$383) | +$1,291 | 1/9 |

Artifacts: `backtests/setup-replays/5f0c8d5377ef2b72bd9004d894e1c1e344642433cd1f79cbcea10d41fcfaa99a/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/touch/4h/0.1% · `df7cebb3`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `8fb2aed3`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 53 | 5/48 | 9% | -$62 | -$593 | 4.1% | 0.97 | -$50 / -$12 | 2 of 20 (-$422) | +$2,003 | 1/9 |
| long__r2__hold72h | 53 | 4/49 | 8% | -$241 | -$771 | 4.6% | 0.89 | -$228 / -$12 | 2 of 20 (-$422) | +$1,974 | 1/9 |

Artifacts: `backtests/setup-replays/df7cebb3ea7c0aeb1ec5f8144eef3018210c89c7b5d5d95de4f4cc3bea3d5dc7/report.md`, `chart.html` beside it if generated.

#### HYPEUSDT · entry limit:sweep/touch/4h/0.1% · `a87012d1`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2; holds 24/72h; scan `1e5d40dd`; 192 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 53 | 5/48 | 9% | -$62 | -$593 | 4.1% | 0.97 | -$50 / -$12 | 2 of 20 (-$422) | +$2,003 | 1/9 |
| long__r2__hold72h | 53 | 4/49 | 8% | -$241 | -$771 | 4.6% | 0.89 | -$228 / -$12 | 2 of 20 (-$422) | +$1,974 | 1/9 |

Artifacts: `backtests/setup-replays/a87012d16e8174a73f42912e5a6dd68ad560980a1acedc4f268a3d574647151b/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `8971abf6`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `1308de86`; 284 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 193 | 74/119 | 38% | -$1,914 | -$3,854 | 13.7% | 0.91 | -$1,602 / -$312 | 8 of 21 (-$1,175) | +$3,159 | 1/9 |
| long__r2__hold72h | 185 | 62/123 | 34% | -$3,314 | -$5,173 | 13.0% | 0.87 | -$2,490 / -$824 | 11 of 21 (-$1,582) | +$3,537 | 1/9 |

Artifacts: `backtests/setup-replays/8971abf676403c3c1836fd86ccc3c65dc5859c4d2a93adaf849a4bdd850de084/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `c7925699`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `9475f751`; 167 events; 0 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 119 | 37/82 | 31% | -$6,818 | -$8,015 | 21.4% | 0.55 | -$5,540 / -$1,277 | 10 of 21 (-$1,651) | +$2,151 | 1/9 |
| long__r2__hold72h | 117 | 35/82 | 30% | -$7,448 | -$8,625 | 23.5% | 0.57 | -$6,311 / -$1,137 | 11 of 21 (-$1,987) | +$2,802 | 1/9 |
| long__structural__hold24h | 118 | 28/90 | 24% | -$8,470 | -$9,656 | 26.6% | 0.47 | -$6,573 / -$1,896 | 13 of 21 (-$1,651) | +$3,100 | 1/9 |

Artifacts: `backtests/setup-replays/c792569950d21c43c455e8f3dab00c68dcda9b0297bcabcc76e25c9ced3fa1e7/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `e7c5d00a`

Window 2024-12-27 to 2026-09-15; params requireRange=0; targets r2; holds 24/72h; scan `9afba8ad`; 284 events; 0 of 2 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 193 | 74/119 | 38% | -$2,118 | -$4,058 | 13.3% | 0.90 | -$1,686 / -$432 | 7 of 21 (-$1,197) | +$3,191 | 1/9 |
| long__r2__hold72h | 185 | 62/123 | 34% | -$3,270 | -$5,130 | 12.4% | 0.87 | -$2,344 / -$926 | 11 of 21 (-$1,604) | +$3,551 | 1/9 |

Artifacts: `backtests/setup-replays/e7c5d00a7d3bb6555be8fed6b663194f02f31b4e1ed5518015614f93b1bde202/report.md`, `chart.html` beside it if generated.

#### SOLUSDT · `b03d70c0`

Window 2024-12-27 to 2026-09-15; params defaults; targets r2/structural; holds 24/72h; scan `d5657937`; 167 events; 0 of 4 cells positive; 0 pass all screens. Status **exploratory**.

| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |
|---|---|---|---|---|---|---|---|---|---|---|---|
| long__r2__hold24h | 119 | 37/82 | 31% | -$6,888 | -$8,086 | 21.6% | 0.54 | -$5,433 / -$1,455 | 11 of 21 (-$1,488) | +$2,065 | 1/9 |
| long__r2__hold72h | 117 | 35/82 | 30% | -$7,397 | -$8,574 | 23.4% | 0.57 | -$6,097 / -$1,300 | 11 of 21 (-$1,807) | +$2,796 | 1/9 |
| long__structural__hold24h | 118 | 28/90 | 24% | -$8,493 | -$9,679 | 26.6% | 0.47 | -$6,422 / -$2,071 | 13 of 21 (-$1,488) | +$3,108 | 1/9 |

Artifacts: `backtests/setup-replays/b03d70c0708567f263686bff4661216654bdd40bf3992a66a643de4a996cb8bc/report.md`, `chart.html` beside it if generated.

## Scans (occurrence ledgers, replayed or not)

| Setup | Symbol | Window | Params | Attempts | Confirmed (long/short) | Replays | Key |
|---|---|---|---|---|---|---|---|
| MR01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 21 (11/10) | `7458a459` | `91653613` |
| MR01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 52 (29/23) | `24dde460` | `21a4baee` |
| MR01 | BTCUSDT | 2024-12-27 to 2026-09-15 | rangeDay=3 | 178 | 12 (6/6) | `229bc1d0` | `d8e3bc12` |
| MR01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 23 (11/12) | `355e7685` | `204c6374` |
| MR01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 55 (29/26) | `f31fabd0` | `a6cba61f` |
| MR01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | rangeDay=3 | 179 | 25 (16/9) | `07d21113` | `f3d954bc` |
| MR01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 25 (10/15) | `6cae1566` | `28ab7aad` |
| MR01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 178 | 61 (30/31) | `d3cc2ebf` | `ac8b3809` |
| MR01 | SOLUSDT | 2024-12-27 to 2026-09-15 | rangeDay=3 | 178 | 14 (8/6) | `484c4620` | `9b01d073` |
| OB01 | BTCUSDT | 2024-12-27 to 2026-09-15 | entryLevel=edge | 3037 | 1051 (507/544) | `31308137` `88a84d63` `da7f657f` | `b313a4b0` |
| OB01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 3037 | 306 (145/161) | `229d5e76` `27ab4689` `a6ce92ae` | `7b9b8a77` |
| OB01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | entryLevel=edge | 2884 | 1091 (564/527) | `0ebe769e` `2eed412a` `4ad7b74a` `4bc955cf` `c831c37f` `d2e58167` `d6afa9ca` | `757b08f7` |
| OB01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 2884 | 291 (130/161) | `4e1be155` `b8a79b47` `eda4783f` | `ce1ae21c` |
| OB01 | SOLUSDT | 2024-12-27 to 2026-09-15 | entryLevel=edge | 2941 | 1050 (506/544) | `2ab19685` `82b3ab82` `fb2a3ec2` | `b218d990` |
| OB01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 2941 | 304 (140/164) | `1799b2f1` `5afd84fc` `cb5b1984` | `7a80e894` |
| PA02 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 1062 | 201 (97/104) | `e4d11d9d` | `9b905b56` |
| PA02 | HYPEUSDT | 2026-03-15 to 2026-09-15 | defaults | 295 | 90 (47/43) | none | `90f20a5e` |
| PA02 | HYPEUSDT | 2026-03-15 to 2026-09-15 | defaults | 295 | 90 (47/43) | none | `06cc2781` |
| PA02 | HYPEUSDT | 2026-08-15 to 2026-09-15 | defaults | 55 | 14 (7/7) | none | `fb2005d8` |
| PA02 | HYPEUSDT | 2026-03-15 to 2026-09-15 | defaults | 295 | 59 (32/27) | none | `d583c927` |
| PA02 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 1030 | 218 (108/110) | `2cb21b19` `6ebb1016` `c3afd93b` | `c215c180` |
| PA02 | HYPEUSDT | 2024-12-27 to 2026-09-15 | contextTfMinutes=1440, triggerTfMinutes=240, sweepExpiryHours=1008, failExpiryHours=1008, retestExpiryHours=432 | 159 | 27 (9/18) | none | `c4647fb6` |
| PA02 | HYPEUSDT | 2024-12-27 to 2026-09-15 | contextTfMinutes=1440, sweepExpiryHours=1008, failExpiryHours=1008, retestExpiryHours=432 | 160 | 14 (5/9) | none | `9c86e432` |
| PA02 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 1034 | 164 (81/83) | `ac6a6a62` | `a8a979cf` |
| PA04 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 711 | 493 (241/252) | `07162e9a` | `47fe577b` |
| PA04 | HYPEUSDT | 2026-03-15 to 2026-09-15 | defaults | 212 | 159 (72/87) | `7c92988d` | `2bc30293` |
| PA04 | HYPEUSDT | 2024-12-27 to 2026-09-15 | contextTfMinutes=1440, triggerTfMinutes=240, breakMaxAgeHours=1008, reclaimExpiryHours=144 | 115 | 92 (46/46) | none | `fdcf45bb` |
| PA04 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 702 | 507 (252/255) | `e72cd82e` | `a0347117` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 3040 | 260 (150/110) | `0d1c95fb` `fd3ccb0e` | `40e9e881` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 3039 | 140 (80/60) | `d18eb8e6` | `138cb27f` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 768 | 84 (52/32) | `d3e3e130` | `989e1c87` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 131 | 12 (8/4) | `6866b9a5` | `43457caf` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 768 | 45 (29/16) | `d5a75356` | `c9dc1397` |
| PA05 | BTCUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 131 | 5 (4/1) | `61254693` | `4ff67ce9` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 2883 | 508 (277/231) | `0292aa68` `e453043a` | `578da928` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 2883 | 308 (178/130) | `50a68a26` | `fc09f0b2` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 714 | 153 (86/67) | `d4276065` | `d8bd3f48` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 127 | 22 (12/10) | `aad7b4d2` | `2f4999ae` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 714 | 86 (48/38) | `c09cb527` | `5d388837` |
| PA05 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 127 | 10 (4/6) | `77b22040` | `8513106c` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 2941 | 412 (199/213) | `70c728a6` `8232b437` | `b8043a7b` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 2941 | 242 (122/120) | `ea94cab3` | `637cb080` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 736 | 137 (74/63) | `0d58f3f7` | `39114cbc` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 138 | 23 (10/13) | `5493b502` | `14bdd4fd` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, departPct=3, reclaimHours=96, visit2ExpiryHours=672, visit3ExpiryHours=672, reactionHours=48 | 736 | 82 (46/36) | `28f11806` | `bd015cc1` |
| PA05 | SOLUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=1440, departPct=6, reclaimHours=120, visit2ExpiryHours=2160, visit3ExpiryHours=2160, reactionHours=72 | 138 | 11 (6/5) | `0c7cf4d4` | `f8ce1ae7` |
| PA06 | HYPEUSDT | 2026-06-01 to 2026-09-15 | defaults | 112 | 26 (14/12) | none | `3ad5eb7f` |
| PA06 | HYPEUSDT | 2026-06-01 to 2026-09-15 | defaults | 112 | 26 (14/12) | none | `d2a3643b` |
| RS01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 3032 | 17 (10/7) | `c2ff6ea2` | `c89feb58` |
| RS01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 3032 | 68 (39/29) | `d35591f1` | `7abb4859` |
| RS01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 2881 | 63 (30/33) | `36ba8fe7` `90618dc7` | `9c112800` |
| RS01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 2881 | 162 (81/81) | `98aecd4f` `bc1a9da1` | `f2ea97e0` |
| RS01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, exhaustionLookbackHours=192, sweepExpiryHours=672, msbExpiryHours=288, retestExpiryHours=288 | 712 | 8 (4/4) | none | `c600749f` |
| RS01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=240, exhaustionLookbackHours=192, sweepExpiryHours=672, msbExpiryHours=288, retestExpiryHours=288 | 712 | 30 (15/15) | none | `c9de7c3b` |
| RS01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 2938 | 40 (27/13) | `fdce67ef` | `7f97cc89` |
| RS01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 2938 | 118 (64/54) | `8dc060d2` | `a687da17` |
| SF01 | BTCUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 531 | 325 (325/0) | `ef2f86ec` | `c00f093d` |
| SF01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 531 | 176 (176/0) | `1193de66` | `a6326fac` |
| SF01 | BTCUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 531 | 325 (325/0) | `5d00d4f7` | `f76108f3` |
| SF01 | BTCUSDT | 2024-12-27 to 2026-09-15 | defaults | 531 | 176 (176/0) | `e65570fa` | `1781e1e2` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | none | `7b35a374` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | none | `42c411e5` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | none | `a082d6d0` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | none | `1cac05ff` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | `a9b7895e` | `699a09fb` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | `8aa5c08a` | `48f2ef4a` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | `61590c1f` | `f2e9e765` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | `d8a1650c` | `30c8eadf` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | `7db6a2c5` | `6451646d` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | `04ac719c` `04b4f094` `05daa351` `091541af` `1563a11d` `255da386` `34806f0f` `3586c022` `39e28a7d` `4fb5870e` `553b9360` `5ea46155` `61e89e33` `6498a27c` `6be4ab01` `afd57aea` `b01cf7b4` `b05199b1` `bad2e7e2` `df7cebb3` `e9f462dd` `eb923e32` `f545ef14` `fb891655` | `8fb2aed3` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 524 | 321 (321/0) | `4469cd1c` | `51166b5b` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | defaults | 524 | 192 (192/0) | `0fcc62e0` `240ada45` `2e90fd7e` `5bfbbb34` `5e77e7ed` `5f0c8d53` `5f2f2766` `6236c231` `65035405` `79d7cba9` `7c1c6272` `81c8c391` `8d283ff0` `95b72f40` `9fd71258` `a664d68d` `a72f4d65` `a7c66119` `a87012d1` `bc1e7a2f` `e819a475` `e9abf4d2` `ea7325c4` `ef8040a8` | `1e5d40dd` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=15 | 524 | 239 (239/0) | `032fdf6d` | `14fb113c` |
| SF01 | HYPEUSDT | 2024-12-27 to 2026-09-15 | triggerTfMinutes=15 | 524 | 239 (239/0) | `511dd948` | `056817ae` |
| SF01 | SOLUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 514 | 284 (284/0) | `8971abf6` | `1308de86` |
| SF01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 514 | 167 (167/0) | `c7925699` | `9475f751` |
| SF01 | SOLUSDT | 2024-12-27 to 2026-09-15 | requireRange=0 | 514 | 284 (284/0) | `e7c5d00a` | `9afba8ad` |
| SF01 | SOLUSDT | 2024-12-27 to 2026-09-15 | defaults | 514 | 167 (167/0) | `b03d70c0` | `d5657937` |

## Before running anything

- Search this page for the setup and symbol. If the variant exists, read its run instead of re-running it; identical requests reuse the artifact folder anyway.
- A cell that passes all screens is still development data with the best cell chosen after the fact. The next step for a lead is a frozen card in `research-inputs/`, both windows, both clocks, its control rows, fixed-risk sizing beside fixed notional, and the monthly screen; then promotion to `TESTED-SETUPS.md`.
- Dollar figures across symbols share the notional and not the stop distance; compare R and screens across symbols, not dollars.
