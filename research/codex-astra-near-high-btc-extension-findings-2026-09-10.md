# L12: 2–6-day highs and BTC leniency — findings

September 10, 2026. Local long-ladder research; no live configuration, strategy, order, state, commit/push or deployment change.

## TL;DR

- **36 new definitions / 222 economic executions / six exact B17 controls. Zero complete-screen qualifiers.** The 20 new raw rules extend rolling highs to 2/3/4/5/6 days at 1%/2% proximity, separately blocking otherwise-approved rung8+ adds or closing an oldest-surviving-age>=4h ladder. The 16 BTC variants can remove only the new add veto. Original 1/7/30-day raw peers are reused from L11, not recounted.
- **There is a recent stale-exit lead, not a verified universal sweet spot.** Two-day/1% and five-to-seven-day/2% exits improve recent net/DD under both TP assumptions. For two-day/1%, recent net is $23,152 confirmed / $24,438 touch versus B17 $15,812 / $20,887 (n=22/21 intervention episodes). But its longer touch result loses $2,674 and raises DD from 28.17% to 36.27%. The five-/six-day 2% rules have larger older-window costs. Much of the recent touch uplift is **unfinished inventory**, not extra completed-trade profit.
- **BTC does not rescue the add-block family under this fixed definition.** BTC strong means within1% of its own matching-horizon high AND nonnegative closed-close4h return; unknown context cannot grant leniency. Some exceptions improve their raw peers, but none qualifies against B17. Recent BTC completeness drops from 89.59% at2d to72.08% at6d and16.98% at30d; monthly BTC never grants an exception. That monthly result is coverage/activation-limited, not a broad rejection of BTC context.

## Practical reading

This does test the user's requested 2/3/4/5/6-day references. It also tests the proposed leniency as an **exception to the near-high deep-add veto**, not permission to bypass trend/risk/latch or to buy every dip. HYPE being far below the chosen high does not itself create a new block in this experiment. No BTC condition is applied to the stale exit. None of the rules requires a confirmed rejection or remembers an earlier top once price moves outside its proximity band.

The apparent five-to-seven-day recent cluster is useful descriptive evidence. It is not an instruction to select one day count by its highest retrospective profit. These are highly overlapping references and episodes; similar results are not independent confirmations. The published window and recent window also overlap and have already been researched.

### Completed profit versus the final unfinished ladder

Recent resting-touch TP model, 2026-05-17 20:43 through 2026-09-10 05:08 UTC:

| Setup | Completed W/L | Win$ | Loss$ | Completed net$ | Unfinished partial$ | Open mark$ | Total net$ | Max DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B17 unchanged | 295/10 | 57,130 | -33,009 | 24,121 | 0 | -3,234 | 20,887 | 24.69% |
| 2d / 1% stale exit | 274/15 | 52,723 | -28,402 | 24,321 | 237 | -121 | 24,438 | 22.96% |
| 5d / 2% stale exit | 265/15 | 48,214 | -24,962 | 23,252 | 0 | -35 | 23,217 | 19.58% |
| 6d / 2% stale exit | 264/15 | 48,833 | -24,962 | 23,871 | 0 | -35 | 23,836 | 19.58% |

Thus two-day/1% adds only **$200 completed-episode net**, plus $3,351 better final open/unfinished accounting. Five-day/2% **loses $869 completed net**, offset by $3,199 better ending accounting. Six-day/2% **loses $250 completed net**, offset by the same $3,199 ending advantage. In the confirmed model, corresponding completed-net improvements are larger; both execution assumptions remain necessary.

An open mark is real economic risk, but the baseline ladder has not finished. Its eventual recovery or further loss can change this attribution. Do not call all incremental dollars “flattens avoided.” These exits also invoke the ordinary 4–8h cooldown and change later entries. Matched-entry and removed/replacement attribution below separates those effects; even matched entries can have different later adds.

### BTC result in context

For the four-day/2% add block, the BTC exception adds about $301 confirmed / $566 touch versus the matching raw rule in the recent window. However the BTC touch result is only $20,032 with26.59% DD, versus unchanged B17 $20,887 with24.69% DD. For five-day/2%, BTC touch reaches $20,959, just $72 above baseline, still with26.59% DD. An improvement to a weaker rule is not automatically an improvement to the current stack.

Coverage matters particularly for longer lookbacks. The BTC snapshot has 28,206 missing minutes: 28,197 from April6 06:16 through April25 20:13 UTC, plus nine individual missing minutes (seven of those in the recent window). Full-window readiness resets at each gap. At30d, only16.98% of recent minutes have complete context, and none of those complete observations qualifies as strong. The monthly exception therefore changes no recent adds relative to its raw peer. Do not read that as proof that a fully observed monthly BTC signal cannot help. No gap repair or synthetic candle fill was performed during this study.

## Causal trace

A concrete `btc_block_4d_2pct` resting-touch recent opportunity:

- Decision: **2026-06-15 05:29:00 UTC**, otherwise-approved price-drop add from rung7 to8.
- Observed completed HYPE minute close **64.758**; four-day high **65.739**, known by04:07; distance **1.4923%**. Raw2% rule would veto.
- BTC completed close **65,792**, matching four-day high **65,983**, known by03:51; distance **0.2895%**.
- BTC four-hours-earlier completed close **65,402**, giving **+0.5963%**. Both BTC conditions pass.
- The exception removes only this experimental veto. Inventory ledger records an open with decisionIndex801633 and fillIndex801634, at the next minute's open64.758. Decision and fill share the05:29 boundary timestamp; they are different candle indices, not a same-candle close decision filled from its future wick.
- Both source windows end at05:29, never later. Availability-lag tests and independent timestamp/maxima checks supplement this trace. Historical corrected OHLC is not a reconstruction of every original API arrival/revision.

## Scope, provenance and limitations

Frozen specification: [L12 method](../docs/research/near-high-btc-extension-l12.md) and [input card](../research-inputs/near-high-btc-extension-2026-09-10.json).

Accepted job: `a6e006cf1e2e2ce12835ae64afcf8f57bbd1fc941723a6a63b3e578a94040bb9`.
Definition: `6a9f47fe318894080e6c73b2f21b282e2e7a7303eb89967a2a1a528c2cc7e820`.
Artifacts: `backtests/research-workflow/<job>/`; `plan.json` pins source/data/config, `state.json` pins outputs, `verification.json` is the independent audit.
Parent: [L11 findings](codex-astra-near-high-ladder-findings-2026-09-10.md), job `b0dcc6239181759af5bfc0d68eb0e00ced29ebabda91a1767d30929b7bf50e31`.

No thresholds were selected or changed after results. No new indicator/HL/SOL condition, live action, fee model, repair, combined block+exit, initial/shallow-entry restriction or different stale age was added. The original BTC risk gate is unchanged; the new strict BTC feature is separate. Six control results match prior digests, full metrics and independent accounting exactly.

The frozen screen requires recent >=$1,000 net uplift under both TP assumptions, nonnegative older-window uplift, no DD increase, no monthly MTM delta below-$250, >=20 recent intervention episodes and no modeled nonpositive equity. Positive recent leads are retained even when those requirements fail; “not qualified” is not “every local-top idea is dead.” Wider thresholds, reversal/rollover evidence, other BTC strength definitions, early-entry rules and regime-conditioned exits remain untested here.

## Exact baseline and economic conventions

B17, unchanged current-stack replay; $32,000 starting equity, $800 x1.35, max11, existing gates/latch/SR/TP/forced exits. Short overlay excluded. Fees 0.055% per side; no maker uplift, long funding settlement or liquidation certification.

W/L counts completed episodes; Win$/Loss$ include episode fees and S/R partial PnL. Net also includes the unfinished episode's realized partial PnL and open mark. MTM drawdown, not realized-only drawdown. All amounts are dollars, not account-return percentages.

| Baseline/window/TP model | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | DD% |
|---|---:|---:|---:|---:|---:|---:|---:|
| published_window-close_confirmed | 788/60 | 190,819 | -171,329 | 0 | 0 | 19,490 | 45.65 |
| published_window-resting_touch | 955/57 | 187,738 | -140,906 | 0 | 0 | 46,832 | 28.17 |
| hl_extended-close_confirmed | 243/11 | 59,238 | -40,192 | -3,234 | 0 | 15,812 | 31.11 |
| hl_extended-resting_touch | 295/10 | 57,130 | -33,009 | -3,234 | 0 | 20,887 | 24.69 |

Published: 2025-07-01 00:00 through 2026-08-19 21:32 UTC. Recent: 2026-05-17 20:43 through 2026-09-10 05:08 UTC. Overlapping researched windows, not independent holdouts. Later September10 copied candles are not included.

## Recent horizon comparisons

Every cell is **net$ / max DD%**. Block=otherwise-approved rung8+ adds vetoed near high. BTC=the same block with the fixed BTC-strength exception. Exit=oldest surviving rung>=4h, full exit near high plus unchanged 4–8h cooldown. Raw 1/7/30d block/exit rows are reused from L11; all BTC rows and raw 2–6d rows are new L12 runs.

### close_confirmed, within 1% of high

Baseline **$15,812 / 31.11% DD**.

| Days | Raw block | BTC exception | Stale exit |
|---:|---:|---:|---:|
| 1 | $18,258 / 24.18% | $18,141 / 25.10% | $20,712 / 24.65% |
| 2 | $18,731 / 23.94% | $18,008 / 25.38% | $23,152 / 21.08% |
| 3 | $17,667 / 25.81% | $17,130 / 27.00% | $16,458 / 30.49% |
| 4 | $17,618 / 25.90% | $17,082 / 27.08% | $22,052 / 22.49% |
| 5 | $17,618 / 25.90% | $17,351 / 26.57% | $20,419 / 22.49% |
| 6 | $17,448 / 26.20% | $17,181 / 26.88% | $20,419 / 22.49% |
| 7 | $17,590 / 26.14% | $17,181 / 26.88% | $21,534 / 21.94% |
| 30 | $15,818 / 31.11% | $15,818 / 31.11% | $16,740 / 31.64% |
### close_confirmed, within 2% of high

Baseline **$15,812 / 31.11% DD**.

| Days | Raw block | BTC exception | Stale exit |
|---:|---:|---:|---:|
| 1 | $18,637 / 25.71% | $18,310 / 25.99% | $16,405 / 28.63% |
| 2 | $18,767 / 25.23% | $17,456 / 25.94% | $25,695 / 26.86% |
| 3 | $17,953 / 26.69% | $17,637 / 27.15% | $18,746 / 25.11% |
| 4 | $18,642 / 25.42% | $18,943 / 25.89% | $23,567 / 23.65% |
| 5 | $18,402 / 27.44% | $18,877 / 27.05% | $23,503 / 23.70% |
| 6 | $17,923 / 28.32% | $17,876 / 28.94% | $23,894 / 23.53% |
| 7 | $18,204 / 27.85% | $18,053 / 28.75% | $25,102 / 23.50% |
| 30 | $16,817 / 31.78% | $16,817 / 31.78% | $22,135 / 30.71% |
### resting_touch, within 1% of high

Baseline **$20,887 / 24.69% DD**.

| Days | Raw block | BTC exception | Stale exit |
|---:|---:|---:|---:|
| 1 | $20,453 / 24.80% | $20,445 / 24.77% | $14,362 / 25.54% |
| 2 | $20,694 / 24.71% | $20,524 / 24.68% | $24,438 / 22.96% |
| 3 | $20,947 / 24.72% | $20,598 / 24.72% | $16,340 / 27.38% |
| 4 | $20,947 / 24.72% | $20,752 / 24.72% | $21,723 / 24.97% |
| 5 | $20,973 / 24.72% | $20,704 / 24.72% | $22,421 / 24.97% |
| 6 | $20,958 / 24.72% | $20,689 / 24.72% | $22,421 / 24.97% |
| 7 | $20,958 / 24.72% | $20,689 / 24.72% | $22,477 / 24.97% |
| 30 | $20,832 / 24.72% | $20,832 / 24.72% | $22,730 / 24.97% |
### resting_touch, within 2% of high

Baseline **$20,887 / 24.69% DD**.

| Days | Raw block | BTC exception | Stale exit |
|---:|---:|---:|---:|
| 1 | $17,918 / 25.05% | $16,904 / 24.83% | $6,440 / 31.29% |
| 2 | $18,157 / 27.06% | $16,105 / 27.01% | $20,684 / 28.33% |
| 3 | $19,031 / 26.40% | $19,043 / 26.40% | $16,811 / 21.23% |
| 4 | $19,466 / 26.59% | $20,032 / 26.59% | $20,295 / 19.58% |
| 5 | $20,410 / 26.59% | $20,959 / 26.59% | $23,217 / 19.58% |
| 6 | $20,453 / 26.59% | $20,541 / 26.59% | $23,836 / 19.58% |
| 7 | $20,512 / 26.59% | $20,758 / 26.59% | $23,054 / 19.58% |
| 30 | $20,605 / 26.59% | $20,605 / 26.59% | $24,259 / 19.58% |

## Complete new primary results, baseline-adjacent

### published_window-close_confirmed

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 788/60 | 190,819 | -171,329 | 0 | 0 | 19,490 | 0 | 45.65 | 0 |
| exit_2d_1pct | 782/80 | 182,002 | -153,350 | 0 | 0 | 28,652 | 9,162 | 45.02 | 102 |
| btc_block_1d_2pct | 831/60 | 190,586 | -165,187 | 0 | 0 | 25,399 | 5,909 | 43.24 | 181 |
| exit_2d_2pct | 731/129 | 164,344 | -139,633 | 0 | 0 | 24,711 | 5,222 | 31.71 | 199 |
| btc_block_2d_2pct | 820/60 | 187,672 | -164,438 | 0 | 0 | 23,234 | 3,745 | 44.05 | 161 |
| btc_block_5d_1pct | 798/60 | 191,039 | -169,057 | 0 | 0 | 21,982 | 2,492 | 42.80 | 43 |
| btc_block_4d_1pct | 800/60 | 190,920 | -169,365 | 0 | 0 | 21,555 | 2,066 | 43.58 | 48 |
| btc_block_3d_2pct | 818/60 | 186,262 | -164,961 | 0 | 0 | 21,301 | 1,812 | 44.30 | 141 |
| exit_4d_1pct | 778/68 | 181,904 | -160,799 | 0 | 0 | 21,104 | 1,615 | 43.65 | 66 |
| btc_block_1d_1pct | 799/60 | 188,995 | -167,912 | 0 | 0 | 21,083 | 1,593 | 47.41 | 63 |
| btc_block_4d_2pct | 811/60 | 185,376 | -165,393 | 0 | 0 | 19,983 | 493 | 46.37 | 132 |
| btc_block_30d_2pct | 793/60 | 191,471 | -171,548 | 0 | 0 | 19,923 | 433 | 43.71 | 31 |
| exit_5d_1pct | 777/66 | 183,131 | -163,622 | 0 | 0 | 19,509 | 20 | 49.37 | 59 |
| exit_3d_1pct | 772/70 | 177,118 | -157,660 | 0 | 0 | 19,458 | -32 | 38.24 | 81 |
| btc_block_2d_1pct | 799/60 | 189,616 | -170,203 | 0 | 0 | 19,413 | -77 | 47.06 | 55 |
| block_5d_1pct | 805/61 | 189,096 | -169,765 | 0 | 0 | 19,331 | -158 | 45.21 | 75 |
| btc_block_30d_1pct | 787/60 | 190,187 | -171,296 | 0 | 0 | 18,890 | -599 | 46.25 | 12 |
| block_2d_2pct | 834/58 | 178,989 | -160,582 | 0 | 0 | 18,407 | -1,083 | 50.02 | 236 |
| btc_block_7d_1pct | 791/60 | 189,466 | -171,221 | 0 | 0 | 18,246 | -1,244 | 45.91 | 36 |
| btc_block_6d_1pct | 791/60 | 188,561 | -171,221 | 0 | 0 | 17,340 | -2,149 | 46.76 | 38 |
| btc_block_3d_1pct | 793/60 | 188,585 | -171,546 | 0 | 0 | 17,039 | -2,451 | 47.71 | 49 |
| btc_block_5d_2pct | 801/60 | 184,259 | -167,588 | 0 | 0 | 16,671 | -2,819 | 49.01 | 119 |
| block_4d_1pct | 800/61 | 186,691 | -170,073 | 0 | 0 | 16,618 | -2,872 | 47.07 | 85 |
| block_4d_2pct | 823/58 | 179,298 | -162,932 | 0 | 0 | 16,365 | -3,124 | 50.75 | 187 |
| btc_block_7d_2pct | 794/60 | 184,340 | -168,098 | 0 | 0 | 16,242 | -3,248 | 48.99 | 99 |
| exit_6d_1pct | 766/64 | 182,046 | -166,771 | 0 | 0 | 15,275 | -4,215 | 53.38 | 49 |
| block_6d_1pct | 798/61 | 186,717 | -171,928 | 0 | 0 | 14,788 | -4,701 | 49.26 | 68 |
| btc_block_6d_2pct | 797/60 | 183,837 | -169,230 | 0 | 0 | 14,607 | -4,882 | 48.78 | 106 |
| block_5d_2pct | 816/58 | 181,718 | -167,311 | 0 | 0 | 14,407 | -5,082 | 51.39 | 168 |
| block_2d_1pct | 800/61 | 184,878 | -170,897 | 0 | 0 | 13,981 | -5,509 | 52.13 | 107 |
| block_6d_2pct | 812/58 | 182,572 | -168,862 | 0 | 0 | 13,710 | -5,779 | 50.01 | 155 |
| block_3d_2pct | 823/58 | 176,627 | -164,085 | 0 | 0 | 12,542 | -6,948 | 53.96 | 205 |
| block_3d_1pct | 793/61 | 184,225 | -172,246 | 0 | 0 | 11,979 | -7,511 | 52.06 | 92 |
| exit_4d_2pct | 727/117 | 166,825 | -156,423 | 0 | 0 | 10,402 | -9,088 | 43.12 | 143 |
| exit_3d_2pct | 724/124 | 161,091 | -155,206 | 0 | 0 | 5,885 | -13,604 | 43.43 | 164 |
| exit_5d_2pct | 713/112 | 164,390 | -161,977 | 0 | 0 | 2,413 | -17,076 | 60.01 | 127 |
| exit_6d_2pct | 717/105 | 166,230 | -165,629 | 0 | 0 | 602 | -18,888 | 64.14 | 110 |
### published_window-resting_touch

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 955/57 | 187,738 | -140,906 | 0 | 0 | 46,832 | 0 | 28.17 | 0 |
| btc_block_30d_1pct | 955/57 | 187,576 | -140,906 | 0 | 0 | 46,670 | -162 | 28.22 | 8 |
| btc_block_1d_1pct | 960/57 | 187,507 | -141,915 | 0 | 0 | 45,591 | -1,241 | 27.27 | 58 |
| btc_block_7d_1pct | 955/57 | 186,765 | -141,243 | 0 | 0 | 45,521 | -1,311 | 28.71 | 27 |
| btc_block_5d_1pct | 955/57 | 186,811 | -141,318 | 0 | 0 | 45,493 | -1,339 | 28.74 | 33 |
| btc_block_4d_1pct | 957/57 | 186,788 | -141,310 | 0 | 0 | 45,478 | -1,355 | 28.66 | 38 |
| btc_block_6d_1pct | 955/57 | 186,702 | -141,243 | 0 | 0 | 45,458 | -1,374 | 28.74 | 28 |
| btc_block_3d_1pct | 957/57 | 186,602 | -141,311 | 0 | 0 | 45,291 | -1,541 | 28.69 | 40 |
| btc_block_30d_2pct | 948/58 | 185,328 | -140,792 | 0 | 0 | 44,537 | -2,296 | 27.91 | 32 |
| exit_2d_1pct | 939/75 | 179,017 | -134,859 | 0 | 0 | 44,159 | -2,674 | 36.27 | 94 |
| btc_block_2d_1pct | 955/57 | 186,133 | -142,649 | 0 | 0 | 43,485 | -3,348 | 28.66 | 46 |
| block_6d_1pct | 959/58 | 184,217 | -141,077 | 0 | 0 | 43,140 | -3,693 | 30.19 | 60 |
| block_5d_1pct | 959/58 | 184,200 | -141,152 | 0 | 0 | 43,048 | -3,784 | 30.55 | 67 |
| exit_3d_1pct | 926/67 | 177,667 | -134,923 | 0 | 0 | 42,744 | -4,088 | 24.63 | 72 |
| block_4d_1pct | 956/58 | 182,984 | -141,144 | 0 | 0 | 41,840 | -4,992 | 30.57 | 76 |
| block_3d_1pct | 956/58 | 182,700 | -141,137 | 0 | 0 | 41,562 | -5,270 | 30.75 | 84 |
| btc_block_1d_2pct | 981/57 | 181,432 | -140,623 | 0 | 0 | 40,809 | -6,024 | 30.09 | 178 |
| exit_6d_2pct | 895/97 | 170,507 | -130,586 | 0 | 0 | 39,921 | -6,911 | 28.39 | 109 |
| exit_2d_2pct | 886/123 | 159,823 | -120,090 | 0 | 0 | 39,733 | -7,100 | 24.49 | 188 |
| block_2d_1pct | 955/58 | 182,028 | -142,587 | 0 | 0 | 39,442 | -7,391 | 30.43 | 97 |
| block_6d_2pct | 966/56 | 179,766 | -141,254 | 0 | 0 | 38,512 | -8,321 | 30.00 | 150 |
| btc_block_7d_2pct | 945/58 | 180,132 | -142,198 | 0 | 0 | 37,935 | -8,898 | 30.01 | 94 |
| btc_block_6d_2pct | 950/58 | 180,007 | -142,190 | 0 | 0 | 37,817 | -9,016 | 30.37 | 101 |
| exit_5d_2pct | 899/102 | 169,036 | -131,592 | 0 | 0 | 37,445 | -9,388 | 33.07 | 123 |
| exit_6d_1pct | 921/61 | 179,898 | -143,033 | 0 | 0 | 36,865 | -9,968 | 31.43 | 44 |
| btc_block_4d_2pct | 952/58 | 177,926 | -141,236 | 0 | 0 | 36,689 | -10,143 | 31.34 | 126 |
| btc_block_5d_2pct | 950/58 | 178,452 | -142,123 | 0 | 0 | 36,328 | -10,504 | 31.71 | 109 |
| exit_4d_1pct | 920/67 | 176,639 | -140,422 | 0 | 0 | 36,217 | -10,616 | 32.75 | 61 |
| block_3d_2pct | 972/56 | 175,506 | -139,415 | 0 | 0 | 36,091 | -10,742 | 30.44 | 195 |
| block_5d_2pct | 966/56 | 177,120 | -141,187 | 0 | 0 | 35,933 | -10,900 | 32.05 | 161 |
| exit_4d_2pct | 892/106 | 166,821 | -131,979 | 0 | 0 | 34,843 | -11,990 | 27.40 | 139 |
| block_4d_2pct | 964/56 | 174,788 | -140,643 | 0 | 0 | 34,145 | -12,688 | 32.07 | 181 |
| btc_block_3d_2pct | 954/58 | 177,013 | -143,286 | 0 | 0 | 33,727 | -13,105 | 32.29 | 134 |
| exit_3d_2pct | 884/115 | 162,548 | -129,137 | 0 | 0 | 33,410 | -13,422 | 26.48 | 158 |
| block_2d_2pct | 971/56 | 172,116 | -139,462 | 0 | 0 | 32,654 | -14,179 | 32.49 | 226 |
| exit_5d_1pct | 921/65 | 176,153 | -143,527 | 0 | 0 | 32,626 | -14,207 | 38.27 | 53 |
| btc_block_2d_2pct | 953/58 | 175,984 | -144,070 | 0 | 0 | 31,915 | -14,918 | 33.59 | 158 |
### hl_extended-close_confirmed

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 243/11 | 59,238 | -40,192 | -3,234 | 0 | 15,812 | 0 | 31.11 | 0 |
| exit_2d_2pct | 234/30 | 54,173 | -28,595 | -121 | 237 | 25,695 | 9,884 | 26.86 | 54 |
| exit_6d_2pct | 220/23 | 54,014 | -30,105 | -15 | 0 | 23,894 | 8,082 | 23.53 | 34 |
| exit_4d_2pct | 224/25 | 54,260 | -30,678 | -15 | 0 | 23,567 | 7,756 | 23.65 | 38 |
| exit_5d_2pct | 220/23 | 53,623 | -30,105 | -15 | 0 | 23,503 | 7,692 | 23.70 | 35 |
| exit_2d_1pct | 232/19 | 55,875 | -32,840 | -121 | 237 | 23,152 | 7,340 | 21.08 | 22 |
| exit_4d_1pct | 251/13 | 61,975 | -36,687 | -3,236 | 0 | 22,052 | 6,240 | 22.49 | 12 |
| exit_5d_1pct | 245/13 | 60,413 | -36,758 | -3,236 | 0 | 20,419 | 4,608 | 22.49 | 12 |
| exit_6d_1pct | 245/13 | 60,413 | -36,758 | -3,236 | 0 | 20,419 | 4,608 | 22.49 | 12 |
| btc_block_4d_2pct | 251/11 | 58,428 | -37,249 | -2,236 | 0 | 18,943 | 3,131 | 25.89 | 33 |
| btc_block_5d_2pct | 253/11 | 59,262 | -38,149 | -2,236 | 0 | 18,877 | 3,065 | 27.05 | 33 |
| block_2d_2pct | 256/11 | 58,006 | -37,002 | -2,236 | 0 | 18,767 | 2,956 | 25.23 | 58 |
| exit_3d_2pct | 225/25 | 51,884 | -33,148 | -15 | 25 | 18,746 | 2,935 | 25.11 | 43 |
| block_2d_1pct | 250/11 | 60,027 | -38,067 | -3,230 | 0 | 18,731 | 2,919 | 23.94 | 23 |
| block_4d_2pct | 254/11 | 57,919 | -37,042 | -2,236 | 0 | 18,642 | 2,830 | 25.42 | 45 |
| block_5d_2pct | 256/11 | 58,579 | -37,942 | -2,236 | 0 | 18,402 | 2,590 | 27.44 | 42 |
| btc_block_1d_2pct | 254/11 | 59,091 | -37,824 | -2,957 | 0 | 18,310 | 2,499 | 25.99 | 48 |
| btc_block_1d_1pct | 247/11 | 58,843 | -37,472 | -3,230 | 0 | 18,141 | 2,329 | 25.10 | 14 |
| btc_block_7d_2pct | 253/11 | 58,972 | -38,684 | -2,236 | 0 | 18,053 | 2,241 | 28.75 | 33 |
| btc_block_2d_1pct | 247/11 | 58,896 | -37,658 | -3,230 | 0 | 18,008 | 2,196 | 25.38 | 13 |
| block_3d_2pct | 256/11 | 57,428 | -37,239 | -2,236 | 0 | 17,953 | 2,142 | 26.69 | 47 |
| block_6d_2pct | 256/11 | 58,635 | -38,476 | -2,236 | 0 | 17,923 | 2,111 | 28.32 | 42 |
| btc_block_6d_2pct | 254/11 | 58,795 | -38,684 | -2,236 | 0 | 17,876 | 2,064 | 28.94 | 32 |
| block_3d_1pct | 248/11 | 59,912 | -39,016 | -3,230 | 0 | 17,667 | 1,855 | 25.81 | 19 |
| btc_block_3d_2pct | 253/11 | 57,319 | -37,446 | -2,236 | 0 | 17,637 | 1,825 | 27.15 | 35 |
| block_4d_1pct | 248/11 | 59,864 | -39,016 | -3,230 | 0 | 17,618 | 1,807 | 25.90 | 18 |
| block_5d_1pct | 248/11 | 59,864 | -39,016 | -3,230 | 0 | 17,618 | 1,807 | 25.90 | 18 |
| btc_block_2d_2pct | 251/11 | 58,040 | -37,628 | -2,957 | 0 | 17,456 | 1,644 | 25.94 | 42 |
| block_6d_1pct | 247/11 | 59,677 | -38,999 | -3,230 | 0 | 17,448 | 1,637 | 26.20 | 18 |
| btc_block_5d_1pct | 243/11 | 59,188 | -38,607 | -3,230 | 0 | 17,351 | 1,540 | 26.57 | 13 |
| btc_block_6d_1pct | 242/11 | 59,002 | -38,590 | -3,230 | 0 | 17,181 | 1,370 | 26.88 | 13 |
| btc_block_7d_1pct | 242/11 | 59,002 | -38,590 | -3,230 | 0 | 17,181 | 1,370 | 26.88 | 13 |
| btc_block_3d_1pct | 245/11 | 58,967 | -38,607 | -3,230 | 0 | 17,130 | 1,319 | 27.00 | 12 |
| btc_block_4d_1pct | 245/11 | 58,919 | -38,607 | -3,230 | 0 | 17,082 | 1,270 | 27.08 | 11 |
| btc_block_30d_2pct | 252/11 | 59,147 | -40,094 | -2,236 | 0 | 16,817 | 1,006 | 31.78 | 23 |
| exit_3d_1pct | 239/15 | 56,118 | -38,506 | -1,312 | 158 | 16,458 | 647 | 30.49 | 16 |
| btc_block_30d_1pct | 243/11 | 59,207 | -40,159 | -3,230 | 0 | 15,818 | 6 | 31.11 | 6 |
### hl_extended-resting_touch

| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 295/10 | 57,130 | -33,009 | -3,234 | 0 | 20,887 | 0 | 24.69 | 0 |
| exit_2d_1pct | 274/15 | 52,723 | -28,402 | -121 | 237 | 24,438 | 3,551 | 22.96 | 21 |
| exit_6d_2pct | 264/15 | 48,833 | -24,962 | -35 | 0 | 23,836 | 2,950 | 19.58 | 33 |
| exit_5d_2pct | 265/15 | 48,214 | -24,962 | -35 | 0 | 23,217 | 2,330 | 19.58 | 34 |
| exit_5d_1pct | 288/11 | 56,506 | -32,944 | -1,320 | 180 | 22,421 | 1,534 | 24.97 | 9 |
| exit_6d_1pct | 288/11 | 56,506 | -32,944 | -1,320 | 180 | 22,421 | 1,534 | 24.97 | 9 |
| exit_4d_1pct | 286/12 | 56,040 | -33,176 | -1,320 | 180 | 21,723 | 836 | 24.97 | 10 |
| block_5d_1pct | 297/10 | 57,625 | -33,423 | -3,230 | 0 | 20,973 | 86 | 24.72 | 9 |
| btc_block_5d_2pct | 294/10 | 55,351 | -33,252 | -1,320 | 180 | 20,959 | 72 | 26.59 | 27 |
| block_6d_1pct | 296/10 | 57,536 | -33,348 | -3,230 | 0 | 20,958 | 71 | 24.72 | 9 |
| block_4d_1pct | 297/10 | 57,600 | -33,423 | -3,230 | 0 | 20,947 | 61 | 24.72 | 9 |
| block_3d_1pct | 297/10 | 57,600 | -33,423 | -3,230 | 0 | 20,947 | 61 | 24.72 | 10 |
| btc_block_30d_1pct | 295/10 | 57,071 | -33,009 | -3,230 | 0 | 20,832 | -55 | 24.72 | 2 |
| btc_block_7d_2pct | 294/10 | 55,217 | -33,319 | -1,320 | 180 | 20,758 | -129 | 26.59 | 27 |
| btc_block_4d_1pct | 297/10 | 57,405 | -33,423 | -3,230 | 0 | 20,752 | -135 | 24.72 | 5 |
| btc_block_5d_1pct | 295/10 | 57,356 | -33,423 | -3,230 | 0 | 20,704 | -183 | 24.72 | 6 |
| block_2d_1pct | 297/10 | 57,346 | -33,423 | -3,230 | 0 | 20,694 | -193 | 24.71 | 15 |
| btc_block_6d_1pct | 294/10 | 57,267 | -33,348 | -3,230 | 0 | 20,689 | -198 | 24.72 | 6 |
| btc_block_7d_1pct | 294/10 | 57,267 | -33,348 | -3,230 | 0 | 20,689 | -198 | 24.72 | 6 |
| exit_2d_2pct | 270/24 | 47,754 | -27,186 | -121 | 237 | 20,684 | -203 | 28.33 | 51 |
| btc_block_30d_2pct | 292/10 | 54,755 | -33,009 | -1,320 | 180 | 20,605 | -282 | 26.59 | 21 |
| btc_block_3d_1pct | 297/10 | 57,251 | -33,423 | -3,230 | 0 | 20,598 | -288 | 24.72 | 6 |
| btc_block_6d_2pct | 294/10 | 55,001 | -33,319 | -1,320 | 180 | 20,541 | -346 | 26.59 | 27 |
| btc_block_2d_1pct | 297/10 | 57,177 | -33,423 | -3,230 | 0 | 20,524 | -362 | 24.68 | 8 |
| block_6d_2pct | 295/10 | 54,772 | -33,178 | -1,320 | 180 | 20,453 | -434 | 26.59 | 37 |
| btc_block_1d_1pct | 297/10 | 57,099 | -33,423 | -3,231 | 0 | 20,445 | -441 | 24.77 | 11 |
| block_5d_2pct | 295/10 | 54,663 | -33,112 | -1,320 | 180 | 20,410 | -476 | 26.59 | 37 |
| exit_4d_2pct | 268/16 | 47,604 | -26,000 | -1,723 | 413 | 20,295 | -592 | 19.58 | 37 |
| btc_block_4d_2pct | 289/10 | 54,425 | -33,252 | -1,320 | 180 | 20,032 | -854 | 26.59 | 28 |
| block_4d_2pct | 291/10 | 53,718 | -33,112 | -1,320 | 180 | 19,466 | -1,421 | 26.59 | 40 |
| btc_block_3d_2pct | 291/10 | 53,611 | -33,427 | -1,320 | 180 | 19,043 | -1,844 | 26.40 | 30 |
| block_3d_2pct | 293/10 | 53,458 | -33,287 | -1,320 | 180 | 19,031 | -1,856 | 26.40 | 42 |
| block_2d_2pct | 293/10 | 52,445 | -33,290 | -1,177 | 180 | 18,157 | -2,730 | 27.06 | 56 |
| btc_block_1d_2pct | 295/10 | 53,418 | -33,557 | -2,957 | 0 | 16,904 | -3,982 | 24.83 | 44 |
| exit_3d_2pct | 262/19 | 46,045 | -29,245 | -15 | 25 | 16,811 | -4,075 | 21.23 | 41 |
| exit_3d_1pct | 278/13 | 53,855 | -34,280 | -3,235 | 0 | 16,340 | -4,547 | 27.38 | 12 |
| btc_block_2d_2pct | 290/10 | 52,492 | -33,430 | -2,957 | 0 | 16,105 | -4,782 | 27.01 | 39 |

## Monthly stability: five strongest new results across BOTH recent TP assumptions

Descriptive ranking by the lower recent net uplift, not a new strategy selection or untouched validation. These same five rules are shown in all four economic windows/models. Baseline column is MTM dollars; other columns are deltas. Complete new-rule monthly values are in `output/monthly.csv`; reused raw 1/7/30-day peers retain their original L11 monthly artifacts.

### published_window-close_confirmed

| Month | Baseline$ | exit_2d_1pct delta$ | exit_6d_2pct delta$ | exit_5d_2pct delta$ | exit_5d_1pct delta$ | exit_6d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | -3,050 | 6,672 | 379 | 782 | 2,181 | -1,831 |
| 2025-08 | 1,420 | 405 | -1,776 | -2,566 | 324 | 402 |
| 2025-09 | 6,247 | -5,501 | -2,185 | -4,324 | -3,028 | -1,826 |
| 2025-10 | 7,167 | -2,077 | -3,078 | -3,078 | -1,630 | -1,630 |
| 2025-11 | -688 | -132 | -522 | -699 | -132 | 0 |
| 2025-12 | 673 | 601 | -2,378 | -2,378 | -607 | -607 |
| 2026-01 | -8,750 | -2,082 | -3,052 | -703 | -2,198 | -632 |
| 2026-02 | -6,255 | 2,747 | 0 | 2,529 | 4,262 | 0 |
| 2026-03 | 12,689 | 4,800 | -3,988 | -3,612 | -843 | -505 |
| 2026-04 | 2,401 | -1,558 | -5,858 | -6,379 | -2,301 | -1,578 |
| 2026-05 | 15,721 | -1,528 | -1,336 | -1,163 | -282 | -282 |
| 2026-06 | -2,243 | 1,024 | 3,033 | 2,643 | -915 | -915 |
| 2026-07 | -7,858 | 5,893 | 1,761 | 1,761 | 5,291 | 5,291 |
| 2026-08 | 2,017 | -102 | 112 | 112 | -102 | -102 |
### published_window-resting_touch

| Month | Baseline$ | exit_2d_1pct delta$ | exit_6d_2pct delta$ | exit_5d_2pct delta$ | exit_5d_1pct delta$ | exit_6d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | 849 | 6,416 | 1,689 | -5,561 | -314 |
| 2025-08 | 561 | 491 | -1,125 | -1,742 | 630 | -384 |
| 2025-09 | 5,608 | -5,508 | 55 | -756 | -3,726 | -2,453 |
| 2025-10 | 7,325 | -906 | -2,566 | -2,566 | -906 | -906 |
| 2025-11 | -1,443 | -35 | -17 | -134 | -35 | 0 |
| 2025-12 | -509 | 43 | -1,324 | -1,324 | 85 | 85 |
| 2026-01 | -246 | -1,603 | 432 | -89 | -1,876 | -581 |
| 2026-02 | 4,940 | 3,417 | 0 | 3,261 | 3,909 | 0 |
| 2026-03 | 11,159 | 5,215 | -2,871 | -707 | -423 | -2 |
| 2026-04 | 2,065 | -3,805 | -4,609 | -5,033 | -3,386 | -2,496 |
| 2026-05 | 15,753 | -2,539 | -3,982 | -4,046 | -2,608 | -2,608 |
| 2026-06 | 1,584 | 1,776 | 2,926 | 2,307 | -761 | -761 |
| 2026-07 | -3,950 | 208 | -93 | -93 | 729 | 729 |
| 2026-08 | 1,317 | -277 | -155 | -155 | -277 | -277 |
### hl_extended-close_confirmed

| Month | Baseline$ | exit_2d_1pct delta$ | exit_6d_2pct delta$ | exit_5d_2pct delta$ | exit_5d_1pct delta$ | exit_6d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | 17,131 | -936 | -1,294 | -1,294 | -936 | -936 |
| 2026-06 | -2,243 | 1,024 | 3,033 | 2,643 | -915 | -915 |
| 2026-07 | -7,858 | 5,893 | 1,761 | 1,761 | 5,291 | 5,291 |
| 2026-08 | 10,239 | 547 | -813 | -813 | -102 | -102 |
| 2026-09 | -1,456 | 812 | 5,394 | 5,394 | 1,269 | 1,269 |
### hl_extended-resting_touch

| Month | Baseline$ | exit_2d_1pct delta$ | exit_6d_2pct delta$ | exit_5d_2pct delta$ | exit_5d_1pct delta$ | exit_6d_1pct delta$ |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | 13,483 | -582 | -1,642 | -1,642 | -582 | -582 |
| 2026-06 | 1,584 | 1,776 | 2,926 | 2,307 | -761 | -761 |
| 2026-07 | -3,950 | 208 | -93 | -93 | 729 | 729 |
| 2026-08 | 9,684 | -655 | -1,756 | -1,756 | -277 | -277 |
| 2026-09 | 85 | 2,804 | 3,514 | 3,514 | 2,425 | 2,425 |

## Attribution and invisible upside: same five new leaders

Matched=episodes with the same initial entry timestamp; removed/replacement are occupied strategy paths lost/gained after intervention. This is path attribution, not paired randomized trades. Final open and unfinished partial changes are separated. Forced counts include research exits, not just hard flattens.

| Model | Rule | Matched delta$ | Removed completed net$ | Replacement completed net$ | Open+unfinished delta$ | Win$ change | Loss$ avoided | TP cycles delta | Forced delta |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| published_window-close_confirmed | exit_2d_1pct | 7,135 | 995 | 3,023 | 0 | -8,817 | 17,979 | -83 | 97 |
| published_window-resting_touch | exit_2d_1pct | 4,811 | 1,457 | -6,029 | 0 | -8,721 | 6,047 | -89 | 91 |
| hl_extended-close_confirmed | exit_2d_1pct | 7,881 | 3,608 | -284 | 3,351 | -3,363 | 7,352 | -23 | 20 |
| hl_extended-resting_touch | exit_2d_1pct | -2,635 | -1,128 | 1,707 | 3,351 | -4,407 | 4,607 | -35 | 19 |
| published_window-close_confirmed | exit_5d_1pct | 3,179 | 8,903 | 5,744 | 0 | -7,688 | 7,708 | -63 | 58 |
| published_window-resting_touch | exit_5d_1pct | 934 | 7,758 | -7,383 | 0 | -11,585 | -2,621 | -79 | 53 |
| hl_extended-close_confirmed | exit_5d_1pct | 1,717 | -225 | 2,668 | -1 | 1,175 | 3,435 | -8 | 12 |
| hl_extended-resting_touch | exit_5d_1pct | -823 | -2,289 | -2,026 | 2,094 | -625 | 65 | -15 | 9 |
| published_window-close_confirmed | exit_5d_2pct | 6,624 | 17,559 | -6,142 | 0 | -26,429 | 9,353 | -146 | 123 |
| published_window-resting_touch | exit_5d_2pct | -6,343 | 21,822 | 18,777 | 0 | -18,702 | 9,314 | -131 | 120 |
| hl_extended-close_confirmed | exit_5d_2pct | 12,533 | 12,467 | 4,406 | 3,220 | -5,615 | 10,088 | -44 | 33 |
| hl_extended-resting_touch | exit_5d_2pct | -2,396 | 12,549 | 14,076 | 3,199 | -8,917 | 8,047 | -58 | 33 |
| published_window-close_confirmed | exit_6d_1pct | -2,358 | 7,297 | 5,440 | 0 | -8,773 | 4,558 | -66 | 48 |
| published_window-resting_touch | exit_6d_1pct | -3,707 | 14,174 | 7,912 | 0 | -7,840 | -2,128 | -74 | 44 |
| hl_extended-close_confirmed | exit_6d_1pct | 1,717 | -225 | 2,668 | -1 | 1,175 | 3,435 | -8 | 12 |
| hl_extended-resting_touch | exit_6d_1pct | -823 | -2,289 | -2,026 | 2,094 | -625 | 65 | -15 | 9 |
| published_window-close_confirmed | exit_6d_2pct | 908 | 10,359 | -9,437 | 0 | -24,588 | 5,701 | -133 | 107 |
| published_window-resting_touch | exit_6d_2pct | -10,842 | 26,744 | 30,675 | 0 | -17,231 | 10,320 | -126 | 106 |
| hl_extended-close_confirmed | exit_6d_2pct | 12,557 | 11,717 | 4,023 | 3,220 | -5,225 | 10,088 | -43 | 32 |
| hl_extended-resting_touch | exit_6d_2pct | -2,670 | 11,581 | 14,002 | 3,199 | -8,297 | 8,047 | -58 | 32 |

## BTC coverage and actual exceptions

Known context requires the complete contiguous lookback. Unknown is not classified as weak. Check counts are repeated decision opportunities, not independent trades. The raw-veto path in these counts is the gated run's own evolving inventory; dollar benefit versus a separate raw replay is shown explicitly.

| Lookback | Published BTC known% | Recent BTC known% | Recent BTC strong% of all minutes |
|---:|---:|---:|---:|
| 1d | 93.88 | 94.80 | 30.87 |
| 2d | 92.68 | 89.59 | 21.52 |
| 3d | 91.47 | 85.08 | 17.16 |
| 4d | 90.27 | 80.75 | 13.71 |
| 5d | 89.06 | 76.41 | 11.48 |
| 6d | 87.86 | 72.08 | 10.50 |
| 7d | 86.77 | 68.17 | 9.53 |
| 30d | 72.03 | 16.98 | 0.00 |

| Model | Rule | Raw checks | BTC unknown checks | Relaxed checks | Relaxed episodes | Raw net$ | BTC net$ | BTC-minus-raw$ | BTC-minus-baseline$ |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| published_window-close_confirmed | btc_block_1d_1pct | 1762 | 803 | 159 | 85 | 15,354 | 21,083 | 5,729 | 1,593 |
| published_window-resting_touch | btc_block_1d_1pct | 1867 | 914 | 165 | 86 | 39,464 | 45,591 | 6,128 | -1,241 |
| hl_extended-close_confirmed | btc_block_1d_1pct | 266 | 77 | 24 | 15 | 18,258 | 18,141 | -117 | 2,329 |
| hl_extended-resting_touch | btc_block_1d_1pct | 232 | 77 | 28 | 16 | 20,453 | 20,445 | -8 | -441 |
| published_window-close_confirmed | btc_block_1d_2pct | 10521 | 3781 | 425 | 159 | 15,863 | 25,399 | 9,536 | 5,909 |
| published_window-resting_touch | btc_block_1d_2pct | 10076 | 3603 | 426 | 171 | 30,347 | 40,809 | 10,462 | -6,024 |
| hl_extended-close_confirmed | btc_block_1d_2pct | 2016 | 135 | 70 | 29 | 18,637 | 18,310 | -327 | 2,499 |
| hl_extended-resting_touch | btc_block_1d_2pct | 1809 | 128 | 77 | 35 | 17,918 | 16,904 | -1,014 | -3,982 |
| published_window-close_confirmed | btc_block_2d_1pct | 1596 | 711 | 113 | 62 | 13,981 | 19,413 | 5,432 | -77 |
| published_window-resting_touch | btc_block_2d_1pct | 1456 | 560 | 108 | 59 | 39,442 | 43,485 | 4,043 | -3,348 |
| hl_extended-close_confirmed | btc_block_2d_1pct | 234 | 77 | 20 | 12 | 18,731 | 18,008 | -723 | 2,196 |
| hl_extended-resting_touch | btc_block_2d_1pct | 162 | 77 | 15 | 8 | 20,694 | 20,524 | -169 | -362 |
| published_window-close_confirmed | btc_block_2d_2pct | 9242 | 3342 | 317 | 119 | 18,407 | 23,234 | 4,827 | 3,745 |
| published_window-resting_touch | btc_block_2d_2pct | 8416 | 3116 | 300 | 122 | 32,654 | 31,915 | -739 | -14,918 |
| hl_extended-close_confirmed | btc_block_2d_2pct | 1854 | 135 | 58 | 22 | 18,767 | 17,456 | -1,311 | 1,644 |
| hl_extended-resting_touch | btc_block_2d_2pct | 1483 | 128 | 46 | 20 | 18,157 | 16,105 | -2,052 | -4,782 |
| published_window-close_confirmed | btc_block_3d_1pct | 1350 | 637 | 96 | 49 | 11,979 | 17,039 | 5,060 | -2,451 |
| published_window-resting_touch | btc_block_3d_1pct | 1228 | 503 | 94 | 50 | 41,562 | 45,291 | 3,729 | -1,541 |
| hl_extended-close_confirmed | btc_block_3d_1pct | 233 | 45 | 15 | 8 | 17,667 | 17,130 | -537 | 1,319 |
| hl_extended-resting_touch | btc_block_3d_1pct | 139 | 48 | 10 | 5 | 20,947 | 20,598 | -349 | -288 |
| published_window-close_confirmed | btc_block_3d_2pct | 8740 | 3130 | 264 | 99 | 12,542 | 21,301 | 8,759 | 1,812 |
| published_window-resting_touch | btc_block_3d_2pct | 7614 | 2833 | 246 | 100 | 36,091 | 33,727 | -2,364 | -13,105 |
| hl_extended-close_confirmed | btc_block_3d_2pct | 1689 | 135 | 46 | 17 | 17,953 | 17,637 | -316 | 1,825 |
| hl_extended-resting_touch | btc_block_3d_2pct | 1352 | 128 | 37 | 14 | 19,031 | 19,043 | 12 | -1,844 |
| published_window-close_confirmed | btc_block_4d_1pct | 1276 | 637 | 87 | 43 | 16,618 | 21,555 | 4,937 | 2,066 |
| published_window-resting_touch | btc_block_4d_1pct | 1088 | 445 | 84 | 42 | 41,840 | 45,478 | 3,637 | -1,355 |
| hl_extended-close_confirmed | btc_block_4d_1pct | 204 | 45 | 15 | 8 | 17,618 | 17,082 | -537 | 1,270 |
| hl_extended-resting_touch | btc_block_4d_1pct | 111 | 48 | 11 | 5 | 20,947 | 20,752 | -195 | -135 |
| published_window-close_confirmed | btc_block_4d_2pct | 7605 | 2913 | 237 | 90 | 16,365 | 19,983 | 3,618 | 493 |
| published_window-resting_touch | btc_block_4d_2pct | 6615 | 2720 | 216 | 86 | 34,145 | 36,689 | 2,544 | -10,143 |
| hl_extended-close_confirmed | btc_block_4d_2pct | 1745 | 135 | 44 | 18 | 18,642 | 18,943 | 301 | 3,131 |
| hl_extended-resting_touch | btc_block_4d_2pct | 1423 | 128 | 35 | 15 | 19,466 | 20,032 | 566 | -854 |
| published_window-close_confirmed | btc_block_5d_1pct | 1118 | 590 | 72 | 35 | 19,331 | 21,982 | 2,650 | 2,492 |
| published_window-resting_touch | btc_block_5d_1pct | 878 | 431 | 73 | 36 | 43,048 | 45,493 | 2,445 | -1,339 |
| hl_extended-close_confirmed | btc_block_5d_1pct | 245 | 45 | 12 | 6 | 17,618 | 17,351 | -267 | 1,540 |
| hl_extended-resting_touch | btc_block_5d_1pct | 133 | 34 | 9 | 4 | 20,973 | 20,704 | -269 | -183 |
| published_window-close_confirmed | btc_block_5d_2pct | 6930 | 2691 | 203 | 77 | 14,407 | 16,671 | 2,263 | -2,819 |
| published_window-resting_touch | btc_block_5d_2pct | 5857 | 2578 | 192 | 76 | 35,933 | 36,328 | 396 | -10,504 |
| hl_extended-close_confirmed | btc_block_5d_2pct | 1447 | 103 | 47 | 17 | 18,402 | 18,877 | 475 | 3,065 |
| hl_extended-resting_touch | btc_block_5d_2pct | 1079 | 99 | 34 | 13 | 20,410 | 20,959 | 548 | 72 |
| published_window-close_confirmed | btc_block_6d_1pct | 1012 | 525 | 67 | 32 | 14,788 | 17,340 | 2,552 | -2,149 |
| published_window-resting_touch | btc_block_6d_1pct | 820 | 414 | 68 | 33 | 43,140 | 45,458 | 2,319 | -1,374 |
| hl_extended-close_confirmed | btc_block_6d_1pct | 216 | 16 | 12 | 6 | 17,448 | 17,181 | -267 | 1,370 |
| hl_extended-resting_touch | btc_block_6d_1pct | 104 | 5 | 9 | 4 | 20,958 | 20,689 | -269 | -198 |
| published_window-close_confirmed | btc_block_6d_2pct | 6157 | 2251 | 186 | 73 | 13,710 | 14,607 | 897 | -4,882 |
| published_window-resting_touch | btc_block_6d_2pct | 5142 | 2077 | 177 | 71 | 38,512 | 37,817 | -695 | -9,016 |
| hl_extended-close_confirmed | btc_block_6d_2pct | 1510 | 53 | 42 | 16 | 17,923 | 17,876 | -47 | 2,064 |
| hl_extended-resting_touch | btc_block_6d_2pct | 1192 | 51 | 31 | 12 | 20,453 | 20,541 | 89 | -346 |
| published_window-close_confirmed | btc_block_7d_1pct | 950 | 525 | 64 | 30 | 15,575 | 18,246 | 2,670 | -1,244 |
| published_window-resting_touch | btc_block_7d_1pct | 811 | 414 | 62 | 30 | 43,599 | 45,521 | 1,922 | -1,311 |
| hl_extended-close_confirmed | btc_block_7d_1pct | 214 | 16 | 10 | 5 | 17,590 | 17,181 | -409 | 1,370 |
| hl_extended-resting_touch | btc_block_7d_1pct | 104 | 5 | 9 | 4 | 20,958 | 20,689 | -269 | -198 |
| published_window-close_confirmed | btc_block_7d_2pct | 5348 | 1578 | 175 | 68 | 15,139 | 16,242 | 1,103 | -3,248 |
| published_window-resting_touch | btc_block_7d_2pct | 4333 | 1317 | 165 | 67 | 38,321 | 37,935 | -387 | -8,898 |
| hl_extended-close_confirmed | btc_block_7d_2pct | 1558 | 53 | 38 | 14 | 18,204 | 18,053 | -151 | 2,241 |
| hl_extended-resting_touch | btc_block_7d_2pct | 1195 | 51 | 28 | 11 | 20,512 | 20,758 | 246 | -129 |
| published_window-close_confirmed | btc_block_30d_1pct | 221 | 46 | 15 | 8 | 18,437 | 18,890 | 454 | -599 |
| published_window-resting_touch | btc_block_30d_1pct | 190 | 21 | 16 | 8 | 46,414 | 46,670 | 256 | -162 |
| hl_extended-close_confirmed | btc_block_30d_1pct | 48 | 41 | 0 | 0 | 15,818 | 15,818 | 0 | 6 |
| hl_extended-resting_touch | btc_block_30d_1pct | 16 | 16 | 0 | 0 | 20,832 | 20,832 | 0 | -55 |
| published_window-close_confirmed | btc_block_30d_2pct | 1886 | 418 | 34 | 16 | 20,049 | 19,923 | -126 | 433 |
| published_window-resting_touch | btc_block_30d_2pct | 1764 | 281 | 31 | 15 | 46,315 | 44,537 | -1,779 | -2,296 |
| hl_extended-close_confirmed | btc_block_30d_2pct | 878 | 755 | 0 | 0 | 16,817 | 16,817 | 0 | 1,006 |
| hl_extended-resting_touch | btc_block_30d_2pct | 655 | 515 | 0 | 0 | 20,605 | 20,605 | 0 | -282 |

## One-minute source delay, all new rules

| Model | Rule | Baseline net$ | Primary net$ | Delayed net$ | Baseline DD% | Primary DD% | Delayed DD% |
|---|---|---:|---:|---:|---:|---:|---:|
| hl_extended-close_confirmed | block_2d_1pct | 15,812 | 18,731 | 18,731 | 31.11 | 23.94 | 23.94 |
| hl_extended-resting_touch | block_2d_1pct | 20,887 | 20,694 | 20,694 | 24.69 | 24.71 | 24.71 |
| hl_extended-close_confirmed | block_2d_2pct | 15,812 | 18,767 | 18,767 | 31.11 | 25.23 | 25.23 |
| hl_extended-resting_touch | block_2d_2pct | 20,887 | 18,157 | 18,157 | 24.69 | 27.06 | 27.06 |
| hl_extended-close_confirmed | block_3d_1pct | 15,812 | 17,667 | 17,667 | 31.11 | 25.81 | 25.81 |
| hl_extended-resting_touch | block_3d_1pct | 20,887 | 20,947 | 20,947 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_3d_2pct | 15,812 | 17,953 | 17,953 | 31.11 | 26.69 | 26.69 |
| hl_extended-resting_touch | block_3d_2pct | 20,887 | 19,031 | 19,031 | 24.69 | 26.40 | 26.40 |
| hl_extended-close_confirmed | block_4d_1pct | 15,812 | 17,618 | 17,618 | 31.11 | 25.90 | 25.90 |
| hl_extended-resting_touch | block_4d_1pct | 20,887 | 20,947 | 20,947 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_4d_2pct | 15,812 | 18,642 | 18,642 | 31.11 | 25.42 | 25.42 |
| hl_extended-resting_touch | block_4d_2pct | 20,887 | 19,466 | 19,466 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | block_5d_1pct | 15,812 | 17,618 | 17,618 | 31.11 | 25.90 | 25.90 |
| hl_extended-resting_touch | block_5d_1pct | 20,887 | 20,973 | 20,973 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_5d_2pct | 15,812 | 18,402 | 18,402 | 31.11 | 27.44 | 27.44 |
| hl_extended-resting_touch | block_5d_2pct | 20,887 | 20,410 | 20,410 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | block_6d_1pct | 15,812 | 17,448 | 17,448 | 31.11 | 26.20 | 26.20 |
| hl_extended-resting_touch | block_6d_1pct | 20,887 | 20,958 | 20,958 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | block_6d_2pct | 15,812 | 17,923 | 17,923 | 31.11 | 28.32 | 28.32 |
| hl_extended-resting_touch | block_6d_2pct | 20,887 | 20,453 | 20,453 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | exit_2d_1pct | 15,812 | 23,152 | 23,152 | 31.11 | 21.08 | 21.08 |
| hl_extended-resting_touch | exit_2d_1pct | 20,887 | 24,438 | 24,438 | 24.69 | 22.96 | 22.96 |
| hl_extended-close_confirmed | exit_2d_2pct | 15,812 | 25,695 | 25,695 | 31.11 | 26.86 | 26.86 |
| hl_extended-resting_touch | exit_2d_2pct | 20,887 | 20,684 | 20,684 | 24.69 | 28.33 | 28.33 |
| hl_extended-close_confirmed | exit_3d_1pct | 15,812 | 16,458 | 16,458 | 31.11 | 30.49 | 30.49 |
| hl_extended-resting_touch | exit_3d_1pct | 20,887 | 16,340 | 16,340 | 24.69 | 27.38 | 27.38 |
| hl_extended-close_confirmed | exit_3d_2pct | 15,812 | 18,746 | 18,849 | 31.11 | 25.11 | 24.91 |
| hl_extended-resting_touch | exit_3d_2pct | 20,887 | 16,811 | 16,811 | 24.69 | 21.23 | 21.23 |
| hl_extended-close_confirmed | exit_4d_1pct | 15,812 | 22,052 | 22,052 | 31.11 | 22.49 | 22.49 |
| hl_extended-resting_touch | exit_4d_1pct | 20,887 | 21,723 | 21,723 | 24.69 | 24.97 | 24.97 |
| hl_extended-close_confirmed | exit_4d_2pct | 15,812 | 23,567 | 23,574 | 31.11 | 23.65 | 23.65 |
| hl_extended-resting_touch | exit_4d_2pct | 20,887 | 20,295 | 20,302 | 24.69 | 19.58 | 19.58 |
| hl_extended-close_confirmed | exit_5d_1pct | 15,812 | 20,419 | 20,419 | 31.11 | 22.49 | 22.49 |
| hl_extended-resting_touch | exit_5d_1pct | 20,887 | 22,421 | 22,421 | 24.69 | 24.97 | 24.97 |
| hl_extended-close_confirmed | exit_5d_2pct | 15,812 | 23,503 | 23,503 | 31.11 | 23.70 | 23.70 |
| hl_extended-resting_touch | exit_5d_2pct | 20,887 | 23,217 | 23,217 | 24.69 | 19.58 | 19.58 |
| hl_extended-close_confirmed | exit_6d_1pct | 15,812 | 20,419 | 20,419 | 31.11 | 22.49 | 22.49 |
| hl_extended-resting_touch | exit_6d_1pct | 20,887 | 22,421 | 22,421 | 24.69 | 24.97 | 24.97 |
| hl_extended-close_confirmed | exit_6d_2pct | 15,812 | 23,894 | 23,894 | 31.11 | 23.53 | 23.53 |
| hl_extended-resting_touch | exit_6d_2pct | 20,887 | 23,836 | 23,836 | 24.69 | 19.58 | 19.58 |
| hl_extended-close_confirmed | btc_block_1d_1pct | 15,812 | 18,141 | 18,356 | 31.11 | 25.10 | 24.88 |
| hl_extended-resting_touch | btc_block_1d_1pct | 20,887 | 20,445 | 20,528 | 24.69 | 24.77 | 24.77 |
| hl_extended-close_confirmed | btc_block_1d_2pct | 15,812 | 18,310 | 18,493 | 31.11 | 25.99 | 25.82 |
| hl_extended-resting_touch | btc_block_1d_2pct | 20,887 | 16,904 | 17,327 | 24.69 | 24.83 | 24.83 |
| hl_extended-close_confirmed | btc_block_2d_1pct | 15,812 | 18,008 | 18,127 | 31.11 | 25.38 | 25.16 |
| hl_extended-resting_touch | btc_block_2d_1pct | 20,887 | 20,524 | 20,524 | 24.69 | 24.68 | 24.68 |
| hl_extended-close_confirmed | btc_block_2d_2pct | 15,812 | 17,456 | 17,637 | 31.11 | 25.94 | 25.65 |
| hl_extended-resting_touch | btc_block_2d_2pct | 20,887 | 16,105 | 16,485 | 24.69 | 27.01 | 27.01 |
| hl_extended-close_confirmed | btc_block_3d_1pct | 15,812 | 17,130 | 17,130 | 31.11 | 27.00 | 27.00 |
| hl_extended-resting_touch | btc_block_3d_1pct | 20,887 | 20,598 | 20,598 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_3d_2pct | 15,812 | 17,637 | 17,881 | 31.11 | 27.15 | 26.70 |
| hl_extended-resting_touch | btc_block_3d_2pct | 20,887 | 19,043 | 19,402 | 24.69 | 26.40 | 26.40 |
| hl_extended-close_confirmed | btc_block_4d_1pct | 15,812 | 17,082 | 17,082 | 31.11 | 27.08 | 27.08 |
| hl_extended-resting_touch | btc_block_4d_1pct | 20,887 | 20,752 | 20,752 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_4d_2pct | 15,812 | 18,943 | 19,183 | 31.11 | 25.89 | 25.44 |
| hl_extended-resting_touch | btc_block_4d_2pct | 20,887 | 20,032 | 20,391 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | btc_block_5d_1pct | 15,812 | 17,351 | 17,351 | 31.11 | 26.57 | 26.57 |
| hl_extended-resting_touch | btc_block_5d_1pct | 20,887 | 20,704 | 20,704 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_5d_2pct | 15,812 | 18,877 | 19,002 | 31.11 | 27.05 | 26.82 |
| hl_extended-resting_touch | btc_block_5d_2pct | 20,887 | 20,959 | 21,048 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | btc_block_6d_1pct | 15,812 | 17,181 | 17,181 | 31.11 | 26.88 | 26.88 |
| hl_extended-resting_touch | btc_block_6d_1pct | 20,887 | 20,689 | 20,689 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_6d_2pct | 15,812 | 17,876 | 18,036 | 31.11 | 28.94 | 28.65 |
| hl_extended-resting_touch | btc_block_6d_2pct | 20,887 | 20,541 | 20,848 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | btc_block_7d_1pct | 15,812 | 17,181 | 17,181 | 31.11 | 26.88 | 26.88 |
| hl_extended-resting_touch | btc_block_7d_1pct | 20,887 | 20,689 | 20,689 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_7d_2pct | 15,812 | 18,053 | 18,179 | 31.11 | 28.75 | 28.52 |
| hl_extended-resting_touch | btc_block_7d_2pct | 20,887 | 20,758 | 20,848 | 24.69 | 26.59 | 26.59 |
| hl_extended-close_confirmed | btc_block_30d_1pct | 15,812 | 15,818 | 15,818 | 31.11 | 31.11 | 31.11 |
| hl_extended-resting_touch | btc_block_30d_1pct | 20,887 | 20,832 | 20,832 | 24.69 | 24.72 | 24.72 |
| hl_extended-close_confirmed | btc_block_30d_2pct | 15,812 | 16,817 | 16,817 | 31.11 | 31.78 | 31.78 |
| hl_extended-resting_touch | btc_block_30d_2pct | 20,887 | 20,605 | 20,605 | 24.69 | 26.59 | 26.59 |

## Frozen-screen outcome

| Rule | Pass | Failed dimensions |
|---|---|---|
| block_2d_1pct | false | net, drawdown, monthly, thin |
| block_2d_2pct | false | net, drawdown, monthly |
| block_3d_1pct | false | net, drawdown, monthly, thin |
| block_3d_2pct | false | net, drawdown, monthly |
| block_4d_1pct | false | net, drawdown, monthly, thin |
| block_4d_2pct | false | net, drawdown, monthly |
| block_5d_1pct | false | net, monthly, drawdown, thin |
| block_5d_2pct | false | net, drawdown, monthly |
| block_6d_1pct | false | net, drawdown, monthly, thin |
| block_6d_2pct | false | net, drawdown, monthly |
| exit_2d_1pct | false | monthly, net, drawdown |
| exit_2d_2pct | false | monthly, net, drawdown |
| exit_3d_1pct | false | net, monthly, thin, drawdown |
| exit_3d_2pct | false | net, monthly |
| exit_4d_1pct | false | monthly, net, drawdown, thin |
| exit_4d_2pct | false | net, monthly |
| exit_5d_1pct | false | drawdown, monthly, net, thin |
| exit_5d_2pct | false | net, drawdown, monthly |
| exit_6d_1pct | false | net, drawdown, monthly, thin |
| exit_6d_2pct | false | net, drawdown, monthly |
| btc_block_1d_1pct | false | drawdown, monthly, net, thin |
| btc_block_1d_2pct | false | monthly, net, drawdown |
| btc_block_2d_1pct | false | net, drawdown, monthly, thin |
| btc_block_2d_2pct | false | monthly, net, drawdown |
| btc_block_3d_1pct | false | net, drawdown, monthly, thin |
| btc_block_3d_2pct | false | monthly, net, drawdown |
| btc_block_4d_1pct | false | monthly, net, drawdown, thin |
| btc_block_4d_2pct | false | drawdown, monthly, net |
| btc_block_5d_1pct | false | monthly, net, drawdown, thin |
| btc_block_5d_2pct | false | net, drawdown, monthly |
| btc_block_6d_1pct | false | net, drawdown, monthly, thin |
| btc_block_6d_2pct | false | net, drawdown, monthly |
| btc_block_7d_1pct | false | net, drawdown, monthly, thin |
| btc_block_7d_2pct | false | net, drawdown, monthly |
| btc_block_30d_1pct | false | net, drawdown, monthly, thin |
| btc_block_30d_2pct | false | monthly, net, drawdown |

## Verification and disposition

All 222 executions completed and source/protected/artifact hashes remained intact. Independent audit passed:

- Six exact B17 controls.
- 7,331,632 HYPE high checks and 6,673,147 BTC high checks, using an independent prefix/suffix implementation with explicit gap resets.
- 174,794 BTC raw-veto context checks; 1,302,671 add permissions; 10,131,788 occupied exit decisions.
- 1,044,436 inventory fills and 68,790,968 independent minute marks, including fees, cooldowns, full monthly accounting and matched/replacement attribution.
- The five ranked recent leaders have identical net/DD under source60. Across all 72 delay cases, 20 net values change, with maximum absolute shift $423.14. No complete-screen qualification changes.
- L11 and L12 unit tests; research-workflow tests; current-stack replay tests; main and VPS TypeScript checks; explicit strict TypeScript checks for the new research files; artifact verification and whitespace checks pass.

Audit totals sum repeated replays of shared history. They are not millions of independent market observations or independent trades; use the per-rule intervention-episode counts when assessing evidence size.

Reproduction from the same pinned source/data snapshot:

```bash
npm run research:workflow -- plan research-inputs/near-high-btc-extension-2026-09-10.json
npm run research:workflow -- run JOB_KEY
npx ts-node scripts/near-high-extension-verify.ts JOB_KEY
npm run research:workflow -- verify JOB_KEY
npx ts-node scripts/near-high-extension-report.ts JOB_KEY
```

Completed jobs are immutable and cannot be silently overwritten/restarted. A changed data/source snapshot generates a different key and must reproduce the controls again. Raw artifacts remain local; the card, method, source/tests and findings are eligible for version control. No commit/push was requested in this pass.

**Disposition:** retain two-day/1% and the five-to-seven-day/2% stale-exit cluster as bounded research evidence, with their realized/open distinction and older/monthly costs attached. Do not promote the new high-only or BTC-qualified add blocks, or any stale exit, from this result. BTC repair/alternative strength definitions, rejection confirmation, and regime-conditioned exit variants would require separately frozen tests, not extra filters selected in this run.

Research register: **5,261 standalone definitions / 121 ladder overlays** (85 prior +36 new); L09 component profiles remain separate. This does not recount earlier reused L11 peers or claim all high/BTC concepts have been exhausted.
