# HYPE Hyperliquid Short-System Findings — 2026-07-16

## TL;DR

- Common strict pulse window: 2026-05-17T20:45:00.000Z to 2026-07-16T00:45:00.000Z (59.17 days), 5681 15m decisions. Chronological split: 2026-06-16T10:45:00.000Z.
- 1 pre-defined strategy/exit selection passed the minimum two-half + fee-stress gate. It remains a forward-shadow candidate, not a live deployment candidate.
- Existing session-dailyred-wick baseline in this window: n=8, all +1.051%, first half +0.890%, second half +1.321%.

## Bias And Execution Discipline

- All price inputs are completed 1m/15m/1H/4H candles. A decision at `T` uses source candles ending no later than `T` and enters at the 1m open stamped `T`.
- All pulse observations have source timestamp `< T`. HL taker/book/asset health is checked per decision; pulse-dependent strategies fail closed on incomplete 15m coverage.
- Rolling z-scores use only the preceding seven days of decision rows. No full-window quantiles or future regime labels are used.
- Stops are checked before TPs inside each 1m candle. A ladder add candle cannot also claim a TP. Fees are 0.11% round trip and 0.20% in stress.
- Exit parameters are ranked on first-half expectancy (minimum n=6), then frozen for second-half evaluation. Signal variants are still a research multiple-testing surface; any pass requires forward shadow.

## Audited Decision-Time Trace

- Example: `hl_bid_pull_break` at 2026-05-21T01:45:00Z. The simulated short enters the Bybit 1m candle stamped 01:45 at its open, $56.443.
- The completed 15m bar was red, closed below the prior 15m low, and returned -0.840% over the exact preceding 15 minutes.
- HL inputs available strictly before 01:45 were: 15m taker buy/sell ratio 0.676, last-5m 0.5% book imbalance -0.231, prior-10m imbalance -0.044, deterioration -0.186. Coverage was 15/15 taker minutes and 15/15 book minutes.
- The HL taker record stamped exactly 01:45 (covering 01:44–01:45) is excluded. This deliberately gives flow one extra minute of latency and proves the fire does not depend on a boundary-race row.

## Strategy Results (Train-Selected Exit)

| Rank | Strategy | Family | Raw fires | Exit | Train n/exp | Test n/exp | Stress test | +1m delay test | All n/exp | Weeks +/active | Neighbor test median | Gate |
|---:|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | sdw_baseline | session_rejection | 8 | S_tp2_sl3_h8 | 5/+0.890% | 3/+1.321% | +1.231% | 3/+0.375% | 8/+1.051% | 3/3 | n/a | NO |
| 2 | hl_bid_pull_break | bid_pull | 42 | S_tp2_sl4_h12 | 16/+0.916% | 20/+1.153% | +1.063% | 20/+0.810% | 36/+1.048% | 7/8 | +0.708% | FORWARD SHADOW |
| 3 | macro_break_sell | trend_continuation | 105 | S_tp2_sl4_h8 | 24/+0.140% | 31/+0.477% | +0.387% | 32/+0.292% | 55/+0.330% | 4/7 | +0.261% | NO |
| 4 | hl_bid_pull_volume | bid_pull | 46 | S_tp1.5_sl4_h4 | 16/+1.052% | 26/+0.286% | +0.196% | 26/+0.001% | 42/+0.578% | 7/9 | +0.295% | NO |
| 5 | bear_bounce_cross_sell | bear_bounce | 27 | S_tp1.5_sl4_h8 | 9/+0.168% | 14/+0.212% | +0.122% | 14/+0.250% | 23/+0.195% | 3/5 | +0.188% | NO |
| 6 | bear_bounce_reject_hl | bear_bounce | 38 | S_tp0.5_sl4_h8 | 13/+0.044% | 22/+0.197% | +0.107% | 22/-0.064% | 35/+0.140% | 4/5 | +0.171% | NO |
| 7 | crowded_breakdown_down | crowded_long | 8 | S_tp0.5_sl1.5_h4 | 0/+0.000% | 7/+0.104% | +0.014% | 7/+0.014% | 7/+0.104% | 2/3 | n/a | NO |
| 8 | legacy_bidpull_vol_down | bid_pull | 60 | S_tp0.75_sl1.5_h4 | 18/+0.515% | 41/+0.060% | -0.030% | 40/-0.031% | 59/+0.199% | 5/7 | +0.041% | NO |
| 9 | short_liq_blowoff_fail | blowoff_failure | 0 | S_tp0.5_sl1.5_h4 | 0/+0.000% | 0/+0.000% | +0.000% | 0/+0.000% | 0/+0.000% | 0/0 | n/a | NO |
| 10 | short_liq_blowoff_cross | blowoff_failure | 0 | S_tp0.5_sl1.5_h4 | 0/+0.000% | 0/+0.000% | +0.000% | 0/+0.000% | 0/+0.000% | 0/0 | n/a | NO |
| 11 | legacy_bidpull_vol | bid_pull | 191 | S_tp0.5_sl4_h4 | 94/+0.078% | 86/-0.036% | -0.126% | 86/-0.101% | 180/+0.024% | 4/9 | +0.015% | NO |
| 12 | crowded_breakdown | crowded_long | 209 | S_tp2_sl2_h4 | 79/-0.050% | 61/-0.055% | -0.145% | 59/-0.157% | 140/-0.052% | 4/9 | -0.077% | NO |
| 13 | control_break_hl_sell | control | 628 | S_tp0.5_sl1.5_h4 | 310/-0.136% | 249/-0.062% | -0.152% | 246/-0.137% | 559/-0.103% | 1/10 | -0.068% | NO |
| 14 | control_plain_break | control | 704 | S_tp0.5_sl1.5_h4 | 337/-0.115% | 275/-0.068% | -0.158% | 273/-0.137% | 612/-0.094% | 1/10 | -0.060% | NO |
| 15 | oi_price_div_cross | oi_divergence | 39 | S_tp0.75_sl1.5_h4 | 19/-0.189% | 19/-0.071% | -0.161% | 19/-0.161% | 38/-0.130% | 3/9 | -0.071% | NO |
| 16 | control_hl_book_pull | control | 220 | L_075_150_tp050_sl300_h8 | 124/-0.051% | 72/-0.077% | -0.137% | 70/-0.154% | 196/-0.061% | 4/9 | -0.040% | NO |
| 17 | crowded_breakdown_strict | crowded_long | 74 | S_tp0.75_sl1.5_h4 | 44/+0.026% | 29/-0.187% | -0.277% | 29/-0.264% | 73/-0.058% | 4/8 | -0.213% | NO |
| 18 | trend_break_sell | trend_continuation | 70 | S_tp2_sl2_h8 | 24/-0.110% | 31/-0.244% | -0.334% | 29/-0.194% | 55/-0.185% | 2/7 | -0.271% | NO |
| 19 | oi_price_div_break | oi_divergence | 44 | L_100_200_tp075_sl400_h12 | 25/-0.041% | 16/-0.300% | -0.364% | 16/-0.505% | 41/-0.142% | 4/9 | -0.106% | NO |
| 20 | bear_bounce_reject | bear_bounce | 66 | S_tp1.5_sl4_h8 | 18/+0.229% | 27/-0.476% | -0.566% | 28/-0.540% | 45/-0.194% | 1/7 | -0.310% | NO |
| 21 | btc_led_break | btc_lead | 44 | S_tp2_sl4_h12 | 18/+0.223% | 15/-0.542% | -0.632% | 15/-0.375% | 33/-0.125% | 3/6 | -0.399% | NO |
| 22 | cross_book_pull_break | bid_pull | 3 | S_tp1.5_sl1.5_h4 | 2/+1.390% | 1/-1.610% | -1.700% | 1/-1.700% | 3/+0.390% | 2/3 | n/a | NO |

Conservative gate: train n>=8 and test n>=8; >=+0.15% expectancy in both halves at 0.20% fees; >=+0.15% second-half expectancy with both a one-minute entry delay and 0.20% fees; >=+0.15% median second-half expectancy for the five nearest exit settings; and at least half of active weeks positive. The margin is deliberate protection against this study's signal/exit multiple-testing surface.

## Controls / Ablation

- control_plain_break: S_tp0.5_sl1.5_h4, n=612, train -0.115%, test -0.068%, all -0.094%.
- control_break_hl_sell: S_tp0.5_sl1.5_h4, n=559, train -0.136%, test -0.062%, all -0.103%.
- control_hl_book_pull: L_075_150_tp050_sl300_h8, n=196, train -0.051%, test -0.077%, all -0.061%.
- hl_bid_pull_break: S_tp2_sl4_h12, n=36, train +0.916%, test +1.153%, all +1.048%.

The combined book-withdrawal + taker-selling + completed-break signal must outperform these components; otherwise the apparent mechanism is just generic downside momentum.

## Interpretation / De-duplication

- One setup clears the conservative gate: `hl_bid_pull_break`. The other positive rows are weaker correlated expressions, not four independent edges.
- The old 5.15b Bybit bid-pull + volume candidate is now falsified on the expanded window: its train-selected exit is negative in the second half and under fee stress.
- OI/funding crowding, OI-price divergence, liquidation blow-off, and the tested adverse-add short ladders do not survive the chronological split.
- The established session-dailyred-wick remains directionally positive but has only eight trades in this 59-day window, below the minimum sample gate.

## Passing Candidates

### hl_bid_pull_break

- Mechanism: HL 0.5% book imbalance sharply deteriorates before a downside break.
- Frozen exit: S_tp2_sl4_h12.
- First half: n=16, WR=81.3%, expectancy +0.916%, max drawdown -5.801%.
- Second half: n=20, WR=80.0%, expectancy +1.153%, fee-stress +1.063%.
- One-minute delayed entry, second half: n=20, fee-stress expectancy +0.810%.
- Known-at-entry trend split: down-regime n=12, +1.117%; other local regimes n=24, +1.013%.
- Required next step: exact live-decision shadow for 30–60 days. No live order path from this study.

| Month | n | Expectancy | Total |
|---|---:|---:|---:|
| 2026-05 | 7 | +0.521% | +3.649% |
| 2026-06 | 22 | +1.182% | +26.001% |
| 2026-07 | 7 | +1.152% | +8.062% |

## Short-Ladder Read

- control_hl_book_pull: L_075_150_tp050_sl300_h8, train -0.051%, test -0.077%, all max-capital expectancy -0.061%. Did not clear robustness gate.
- oi_price_div_break: L_100_200_tp075_sl400_h12, train -0.041%, test -0.300%, all max-capital expectancy -0.142%. Did not clear robustness gate.

Ladder PnL is measured on total reserved ladder capital, with unused add allocation earning zero. This prevents adverse adds from looking artificially strong through filled-capital-only accounting.

## Mechanism Inventory

- **sdw_baseline** (session_rejection): Existing closed-1H session/daily-red upper-wick baseline.
- **control_plain_break** (control): Control: completed 15m downside break without pulse confirmation.
- **control_break_hl_sell** (control): Control: completed 15m downside break plus HL taker selling, without book withdrawal.
- **control_hl_book_pull** (control): Control: HL book withdrawal without a completed downside break or taker confirmation.
- **legacy_bidpull_vol** (bid_pull): Exact 5.15b-style Bybit 0.1% bid-depth pull plus 5m/15m volume expansion retest.
- **legacy_bidpull_vol_down** (bid_pull): Legacy bid pull/volume expansion restricted to a live-known down regime.
- **bear_bounce_reject** (bear_bounce): Bounce in a down regime followed by a closed 15m rejection.
- **bear_bounce_reject_hl** (bear_bounce): Bear-bounce rejection with HL taker sell confirmation.
- **bear_bounce_cross_sell** (bear_bounce): Bear-bounce rejection with HL and Binance sell confirmation.
- **crowded_breakdown** (crowded_long): Elevated OI/positive funding, then confirmed price breakdown and HL selling.
- **crowded_breakdown_strict** (crowded_long): Crowded-long breakdown with OI rising over 4h and cross-venue sell flow.
- **crowded_breakdown_down** (crowded_long): Crowded-long breakdown restricted to a down regime.
- **oi_price_div_break** (oi_divergence): OI rises while 4h price stalls, then a closed 15m downside break confirms.
- **oi_price_div_cross** (oi_divergence): OI/price divergence plus cross-venue taker selling.
- **hl_bid_pull_break** (bid_pull): HL 0.5% book imbalance sharply deteriorates before a downside break.
- **cross_book_pull_break** (bid_pull): HL and Bybit books both weaken before a confirmed downside break.
- **hl_bid_pull_volume** (bid_pull): HL bid-side deterioration with expanding 15m volume and sell flow.
- **short_liq_blowoff_fail** (blowoff_failure): Short-liquidation/pump burst followed by a closed rejection and HL seller takeover.
- **short_liq_blowoff_cross** (blowoff_failure): Liquidation blow-off failure with cross-venue selling and downside break.
- **trend_break_sell** (trend_continuation): Local 1H downtrend, confirmed 15m break, volume and cross-venue sell flow.
- **macro_break_sell** (trend_continuation): 4H down regime and confirmed 15m breakdown with HL book/taker agreement.
- **btc_led_break** (btc_lead): BTC already weak while HYPE enters a confirmed local-down breakdown.

## Operational Boundary

- This pass changes no bot code or config and makes no strategy recommendation for the live long ladder.
- A future HYPE short executor would share Bybit hedge-side position ownership with the existing HYPE short process. It must not be deployed as an independent order owner; transactional ownership/reconciliation must be designed first.
- Generated tables and trades are under `backtests/hype/hl-short-study-2026-07-16/`.
