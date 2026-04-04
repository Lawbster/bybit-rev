# Codex Short Signal Results

Generated: 2026-04-04T21:08:30.017Z

## Scope

This run covers the Codex shortlist / execution spec only: failed-continuation, spike-rejection, lower-high, composite, BB exhaustion, and VWAP rejection families.

Assumptions:
- Fees: 0.11% round trip taker cost
- Discovery window: 2024-12-05 -> 2025-12-31
- Validation window: 2026-01-01 -> 2026-04-03
- Bear regime: last completed 1H EMA50 < EMA200
- TP/stop simulation uses 5m path data and stop-first ordering for shorts

## HYPE Summary

| ID | Signal | Val N (Bear) | Best Val Exp | Best Val WR | Verdict |
|---|---|---|---|---|---|
| PFLV | Pump Failure 2.5% Low-Volume Pump | 1 | +1.390% | 100% | MARGINAL |
| PFLH | Delayed Pump Failure + Lower High | 2 | +1.390% | 100% | MARGINAL |
| PF1 | Bear-Regime Pump Failure 2.5% | 5 | +0.690% | 80% | MARGINAL |
| PF1A | Pump Failure 2.5% Tight Delay | 5 | +0.690% | 80% | MARGINAL |
| CS2 | Composite Score >=5 | 5 | +0.490% | 80% | MARGINAL |
| PF0 | Bear-Regime Pump Failure 2.0% | 10 | +0.340% | 70% | PROFITABLE |
| LH5 | Lower High + EMA20 + Low Volume | 45 | +0.253% | 76% | PROFITABLE |
| PF2 | Bear-Regime Pump Failure 3.0% | 3 | +0.223% | 67% | MARGINAL |
| PF3 | Pump Failure 3.0% + Vol | 3 | +0.223% | 67% | MARGINAL |
| LH6 | Lower High + EMA20 + Wick | 34 | +0.192% | 65% | PROFITABLE |
| SR2 | 5m Spike Rejection 24-Bar | 8 | +0.077% | 75% | MARGINAL |
| SR4 | 5m Spike Rejection + Bear Regime | 8 | +0.077% | 75% | MARGINAL |
| LH2 | Lower High Failure + EMA20 | 51 | +0.022% | 73% | PROFITABLE |
| PFE20 | Pump Failure 2.5% + Confirm Below EMA20 | 0 | 0.000% | 0% | MARGINAL |
| PV1 | Pump + Blowoff Wick | 0 | 0.000% | 0% | MARGINAL |
| PV2 | Pump + Volume Climax Rejection | 0 | 0.000% | 0% | MARGINAL |
| LH4 | Lower High + EMA20 + RSI55-75 | 0 | 0.000% | 0% | MARGINAL |
| VW3 | VWAP Intrabar Reclaim Failure (All Regimes) | 52 | -0.024% | 69% | MARGINAL |
| LH1 | Lower High Failure | 53 | -0.039% | 70% | MARGINAL |
| VW2 | VWAP Intrabar Reclaim Failure | 53 | -0.054% | 68% | USELESS |
| LH3 | Support Break Retest Failure | 29 | -0.058% | 69% | USELESS |
| CS1 | Composite Score >=4 | 75 | -0.123% | 65% | USELESS |
| VW1 | VWAP Rejection From Below | 48 | -0.136% | 65% | USELESS |
| CS3 | Composite Score >=4 + Red | 48 | -0.317% | 56% | USELESS |
| PV3 | Three-Candle Pump Exhaustion | 2 | -0.360% | 50% | USELESS |
| SR1 | 5m Spike Rejection 12-Bar | 2 | -0.360% | 50% | USELESS |
| SR3 | 5m Spike Rejection + Vol | 2 | -0.360% | 50% | USELESS |
| PF1M | Pump Failure 2.5% Midpoint Confirm | 2 | -0.360% | 50% | USELESS |
| BB1 | BB Walk Exhaustion 2-Bar | 18 | -0.360% | 50% | USELESS |
| BB2 | BB Walk Exhaustion 3-Bar | 11 | -0.474% | 45% | USELESS |
| BB3 | BB Walk Exhaustion 3-Bar + Bear | 11 | -0.474% | 45% | USELESS |
| PF4 | Pump 4.0% Next-Bar Failure | 1 | -1.610% | 0% | USELESS |

## HYPE Detailed Blocks

### Signal: PF1 — Bear-Regime Pump Failure 2.5%
- Timeframe: 1H
- Logic: 1H green body >=2.5%, next 1-3 bars fail to make new high >0.3%, short first red confirmation
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=124
- Forward returns: 1b: +0.01% (52% pos, n=124) | 3b: +0.08% (54% pos, n=124) | 6b: -0.42% (48% pos, n=124) | 12b: -0.48% (45% pos, n=124) | 24b: -1.76% (41% pos, n=124)
- MAE/MFE over default hold: avg MAE -5.33% | p95 MAE -0.48% | avg MFE +5.15% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy -0.019%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 83 | 41 | 0 | 67% | -0.104% |
  | 1.00 | 1.50 | 72 | 52 | 0 | 58% | -0.158% |
  | 1.00 | 2.00 | 84 | 40 | 0 | 68% | -0.078% |
  | 1.50 | 2.00 | 71 | 53 | 0 | 57% | -0.106% |
  | 1.50 | 3.00 | 85 | 38 | 1 | 69% | -0.019% |

#### Discovery / Bear
- Sample size: N=63
- Forward returns: 1b: +0.13% (56% pos, n=63) | 3b: +0.19% (52% pos, n=63) | 6b: -0.07% (52% pos, n=63) | 12b: -0.20% (46% pos, n=63) | 24b: -1.34% (38% pos, n=63)
- MAE/MFE over default hold: avg MAE -4.70% | p95 MAE -0.15% | avg MFE +4.83% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.033%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 44 | 19 | 0 | 70% | -0.039% |
  | 1.00 | 1.50 | 40 | 23 | 0 | 63% | -0.023% |
  | 1.00 | 2.00 | 43 | 20 | 0 | 68% | -0.062% |
  | 1.50 | 2.00 | 36 | 27 | 0 | 57% | -0.110% |
  | 1.50 | 3.00 | 44 | 19 | 0 | 70% | +0.033% |

#### Validation / All
- Sample size: N=15
- Forward returns: 1b: +0.78% (73% pos, n=15) | 3b: +0.79% (53% pos, n=15) | 6b: +0.88% (60% pos, n=15) | 12b: +0.45% (60% pos, n=15) | 24b: +1.39% (60% pos, n=15)
- MAE/MFE over default hold: avg MAE -3.09% | p95 MAE -0.27% | avg MFE +4.15% | p95 MFE +8.47%
- Best combo: TP 1.50 / Stop 2.00 | WR 80% | Expectancy +0.690%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 12 | 3 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 12 | 3 | 0 | 80% | +0.390% |
  | 1.00 | 2.00 | 13 | 2 | 0 | 87% | +0.490% |
  | 1.50 | 2.00 | 12 | 3 | 0 | 80% | +0.690% |
  | 1.50 | 3.00 | 12 | 2 | 1 | 80% | +0.666% |

#### Validation / Bear
- Sample size: N=5
- Forward returns: 1b: +0.29% (60% pos, n=5) | 3b: +0.19% (40% pos, n=5) | 6b: +1.82% (80% pos, n=5) | 12b: +0.23% (40% pos, n=5) | 24b: +1.57% (60% pos, n=5)
- MAE/MFE over default hold: avg MAE -1.97% | p95 MAE -1.44% | avg MFE +2.76% | p95 MFE +5.62%
- Best combo: TP 1.50 / Stop 2.00 | WR 80% | Expectancy +0.690%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 4 | 1 | 0 | 80% | +0.390% |
  | 1.00 | 2.00 | 4 | 1 | 0 | 80% | +0.290% |
  | 1.50 | 2.00 | 4 | 1 | 0 | 80% | +0.690% |
  | 1.50 | 3.00 | 4 | 1 | 0 | 80% | +0.490% |

#### All Regime
- Sample size: N=139
- Forward returns: 1b: +0.09% (55% pos, n=139) | 3b: +0.15% (54% pos, n=139) | 6b: -0.28% (50% pos, n=139) | 12b: -0.38% (47% pos, n=139) | 24b: -1.42% (43% pos, n=139)
- MAE/MFE over default hold: avg MAE -5.09% | p95 MAE -0.36% | avg MFE +5.04% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.055%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 95 | 44 | 0 | 68% | -0.072% |
  | 1.00 | 1.50 | 84 | 55 | 0 | 60% | -0.099% |
  | 1.00 | 2.00 | 97 | 42 | 0 | 70% | -0.016% |
  | 1.50 | 2.00 | 83 | 56 | 0 | 60% | -0.020% |
  | 1.50 | 3.00 | 97 | 40 | 2 | 70% | +0.055% |

#### Bear Regime
- Sample size: N=68
- Forward returns: 1b: +0.14% (56% pos, n=68) | 3b: +0.19% (51% pos, n=68) | 6b: +0.07% (54% pos, n=68) | 12b: -0.17% (46% pos, n=68) | 24b: -1.12% (40% pos, n=68)
- MAE/MFE over default hold: avg MAE -4.50% | p95 MAE -0.15% | avg MFE +4.68% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 71% | Expectancy +0.066%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 48 | 20 | 0 | 71% | -0.022% |
  | 1.00 | 1.50 | 44 | 24 | 0 | 65% | +0.008% |
  | 1.00 | 2.00 | 47 | 21 | 0 | 69% | -0.036% |
  | 1.50 | 2.00 | 40 | 28 | 0 | 59% | -0.051% |
  | 1.50 | 3.00 | 48 | 20 | 0 | 71% | +0.066% |

### Signal: PF2 — Bear-Regime Pump Failure 3.0%
- Timeframe: 1H
- Logic: 1H green body >=3.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=75
- Forward returns: 1b: -0.01% (51% pos, n=75) | 3b: +0.15% (56% pos, n=75) | 6b: -0.53% (44% pos, n=75) | 12b: -0.45% (41% pos, n=75) | 24b: -1.51% (44% pos, n=75)
- MAE/MFE over default hold: avg MAE -5.80% | p95 MAE -0.55% | avg MFE +5.57% | p95 MFE +15.63%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy -0.099%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 47 | 28 | 0 | 63% | -0.200% |
  | 1.00 | 1.50 | 43 | 32 | 0 | 57% | -0.177% |
  | 1.00 | 2.00 | 49 | 26 | 0 | 65% | -0.150% |
  | 1.50 | 2.00 | 41 | 34 | 0 | 55% | -0.197% |
  | 1.50 | 3.00 | 50 | 24 | 1 | 67% | -0.099% |

#### Discovery / Bear
- Sample size: N=37
- Forward returns: 1b: +0.14% (57% pos, n=37) | 3b: -0.02% (51% pos, n=37) | 6b: -0.52% (41% pos, n=37) | 12b: -0.79% (38% pos, n=37) | 24b: -0.86% (43% pos, n=37)
- MAE/MFE over default hold: avg MAE -5.15% | p95 MAE -0.36% | avg MFE +4.43% | p95 MFE +15.63%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.052%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 26 | 11 | 0 | 70% | -0.029% |
  | 1.00 | 1.50 | 24 | 13 | 0 | 65% | +0.012% |
  | 1.00 | 2.00 | 25 | 12 | 0 | 68% | -0.083% |
  | 1.50 | 2.00 | 21 | 16 | 0 | 57% | -0.124% |
  | 1.50 | 3.00 | 26 | 11 | 0 | 70% | +0.052% |

#### Validation / All
- Sample size: N=9
- Forward returns: 1b: +0.74% (78% pos, n=9) | 3b: +0.31% (33% pos, n=9) | 6b: +0.75% (44% pos, n=9) | 12b: +0.35% (56% pos, n=9) | 24b: +0.41% (56% pos, n=9)
- MAE/MFE over default hold: avg MAE -3.03% | p95 MAE -0.87% | avg MFE +3.59% | p95 MFE +8.47%
- Best combo: TP 1.00 / Stop 1.50 | WR 78% | Expectancy +0.334%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 7 | 2 | 0 | 78% | +0.140% |
  | 1.00 | 1.50 | 7 | 2 | 0 | 78% | +0.334% |
  | 1.00 | 2.00 | 7 | 2 | 0 | 78% | +0.223% |
  | 1.50 | 2.00 | 5 | 4 | 0 | 56% | -0.166% |
  | 1.50 | 3.00 | 6 | 2 | 1 | 67% | +0.183% |

#### Validation / Bear
- Sample size: N=3
- Forward returns: 1b: +0.89% (100% pos, n=3) | 3b: -0.12% (0% pos, n=3) | 6b: +1.11% (67% pos, n=3) | 12b: +0.32% (33% pos, n=3) | 24b: +0.45% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -2.22% | p95 MAE -1.71% | avg MFE +2.13% | p95 MFE +3.80%
- Best combo: TP 1.50 / Stop 2.00 | WR 67% | Expectancy +0.223%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 2 | 1 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 2 | 1 | 0 | 67% | +0.223% |
  | 1.50 | 3.00 | 2 | 1 | 0 | 67% | -0.110% |

#### All Regime
- Sample size: N=84
- Forward returns: 1b: +0.07% (54% pos, n=84) | 3b: +0.17% (54% pos, n=84) | 6b: -0.39% (44% pos, n=84) | 12b: -0.37% (43% pos, n=84) | 24b: -1.31% (45% pos, n=84)
- MAE/MFE over default hold: avg MAE -5.51% | p95 MAE -0.67% | avg MFE +5.36% | p95 MFE +14.12%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy -0.069%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 54 | 30 | 0 | 64% | -0.164% |
  | 1.00 | 1.50 | 50 | 34 | 0 | 60% | -0.122% |
  | 1.00 | 2.00 | 56 | 28 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 46 | 38 | 0 | 55% | -0.193% |
  | 1.50 | 3.00 | 56 | 26 | 2 | 67% | -0.069% |

#### Bear Regime
- Sample size: N=40
- Forward returns: 1b: +0.20% (60% pos, n=40) | 3b: -0.03% (48% pos, n=40) | 6b: -0.40% (43% pos, n=40) | 12b: -0.70% (38% pos, n=40) | 24b: -0.77% (43% pos, n=40)
- MAE/MFE over default hold: avg MAE -4.93% | p95 MAE -0.36% | avg MFE +4.26% | p95 MFE +15.63%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.040%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 28 | 12 | 0 | 70% | -0.035% |
  | 1.00 | 1.50 | 26 | 14 | 0 | 65% | +0.015% |
  | 1.00 | 2.00 | 27 | 13 | 0 | 68% | -0.085% |
  | 1.50 | 2.00 | 23 | 17 | 0 | 57% | -0.097% |
  | 1.50 | 3.00 | 28 | 12 | 0 | 70% | +0.040% |

### Signal: PF3 — Pump Failure 3.0% + Vol
- Timeframe: 1H
- Logic: PF2 plus pump volume >=1.5x SMA20
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=43
- Forward returns: 1b: +0.07% (51% pos, n=43) | 3b: +0.48% (56% pos, n=43) | 6b: -0.14% (47% pos, n=43) | 12b: -0.17% (42% pos, n=43) | 24b: -2.46% (35% pos, n=43)
- MAE/MFE over default hold: avg MAE -5.23% | p95 MAE -0.55% | avg MFE +5.16% | p95 MFE +13.87%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.145%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 28 | 15 | 0 | 65% | -0.145% |
  | 1.00 | 1.50 | 24 | 19 | 0 | 56% | -0.215% |
  | 1.00 | 2.00 | 27 | 16 | 0 | 63% | -0.226% |
  | 1.50 | 2.00 | 23 | 20 | 0 | 53% | -0.238% |
  | 1.50 | 3.00 | 28 | 14 | 1 | 65% | -0.161% |

#### Discovery / Bear
- Sample size: N=23
- Forward returns: 1b: +0.25% (61% pos, n=23) | 3b: -0.12% (48% pos, n=23) | 6b: -0.45% (39% pos, n=23) | 12b: -0.85% (30% pos, n=23) | 24b: -2.65% (30% pos, n=23)
- MAE/MFE over default hold: avg MAE -5.11% | p95 MAE -0.39% | avg MFE +4.43% | p95 MFE +15.63%
- Best combo: TP 1.00 / Stop 1.50 | WR 65% | Expectancy +0.020%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 16 | 7 | 0 | 70% | -0.045% |
  | 1.00 | 1.50 | 15 | 8 | 0 | 65% | +0.020% |
  | 1.00 | 2.00 | 16 | 7 | 0 | 70% | -0.023% |
  | 1.50 | 2.00 | 14 | 9 | 0 | 61% | +0.020% |
  | 1.50 | 3.00 | 16 | 7 | 0 | 70% | +0.020% |

#### Validation / All
- Sample size: N=5
- Forward returns: 1b: +0.86% (100% pos, n=5) | 3b: -0.22% (20% pos, n=5) | 6b: +0.31% (40% pos, n=5) | 12b: +0.17% (40% pos, n=5) | 24b: +0.37% (40% pos, n=5)
- MAE/MFE over default hold: avg MAE -2.40% | p95 MAE -1.71% | avg MFE +2.07% | p95 MFE +3.80%
- Best combo: TP 1.00 / Stop 1.50 | WR 80% | Expectancy +0.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 4 | 1 | 0 | 80% | +0.390% |
  | 1.00 | 2.00 | 4 | 1 | 0 | 80% | +0.290% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 3 | 1 | 1 | 60% | +0.118% |

#### Validation / Bear
- Sample size: N=3
- Forward returns: 1b: +0.89% (100% pos, n=3) | 3b: -0.12% (0% pos, n=3) | 6b: +1.11% (67% pos, n=3) | 12b: +0.32% (33% pos, n=3) | 24b: +0.45% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -2.22% | p95 MAE -1.71% | avg MFE +2.13% | p95 MFE +3.80%
- Best combo: TP 1.50 / Stop 2.00 | WR 67% | Expectancy +0.223%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 2 | 1 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 2 | 1 | 0 | 67% | +0.223% |
  | 1.50 | 3.00 | 2 | 1 | 0 | 67% | -0.110% |

#### All Regime
- Sample size: N=48
- Forward returns: 1b: +0.16% (56% pos, n=48) | 3b: +0.41% (52% pos, n=48) | 6b: -0.09% (46% pos, n=48) | 12b: -0.14% (42% pos, n=48) | 24b: -2.17% (35% pos, n=48)
- MAE/MFE over default hold: avg MAE -4.94% | p95 MAE -0.55% | avg MFE +4.84% | p95 MFE +13.87%
- Best combo: TP 0.75 / Stop 1.50 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 32 | 16 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 28 | 20 | 0 | 58% | -0.152% |
  | 1.00 | 2.00 | 31 | 17 | 0 | 65% | -0.172% |
  | 1.50 | 2.00 | 26 | 22 | 0 | 54% | -0.214% |
  | 1.50 | 3.00 | 31 | 15 | 2 | 65% | -0.132% |

#### Bear Regime
- Sample size: N=26
- Forward returns: 1b: +0.32% (65% pos, n=26) | 3b: -0.12% (42% pos, n=26) | 6b: -0.27% (42% pos, n=26) | 12b: -0.71% (31% pos, n=26) | 24b: -2.29% (31% pos, n=26)
- MAE/MFE over default hold: avg MAE -4.77% | p95 MAE -0.39% | avg MFE +4.17% | p95 MFE +15.63%
- Best combo: TP 1.50 / Stop 2.00 | WR 62% | Expectancy +0.044%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 18 | 8 | 0 | 69% | -0.052% |
  | 1.00 | 1.50 | 17 | 9 | 0 | 65% | +0.025% |
  | 1.00 | 2.00 | 18 | 8 | 0 | 69% | -0.033% |
  | 1.50 | 2.00 | 16 | 10 | 0 | 62% | +0.044% |
  | 1.50 | 3.00 | 18 | 8 | 0 | 69% | +0.005% |

### Signal: PF4 — Pump 4.0% Next-Bar Failure
- Timeframe: 1H
- Logic: 1H pump >=4.0%, next bar red, no new high >0.3%, short next-bar close
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=27
- Forward returns: 1b: +0.47% (56% pos, n=27) | 3b: +0.63% (56% pos, n=27) | 6b: +0.85% (52% pos, n=27) | 12b: -0.36% (44% pos, n=27) | 24b: -0.48% (52% pos, n=27)
- MAE/MFE over default hold: avg MAE -5.79% | p95 MAE -0.36% | avg MFE +6.95% | p95 MFE +17.38%
- Best combo: TP 0.75 / Stop 1.50 | WR 59% | Expectancy -0.277%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 16 | 11 | 0 | 59% | -0.277% |
  | 1.00 | 1.50 | 14 | 13 | 0 | 52% | -0.314% |
  | 1.00 | 2.00 | 15 | 12 | 0 | 56% | -0.443% |
  | 1.50 | 2.00 | 13 | 14 | 0 | 48% | -0.425% |
  | 1.50 | 3.00 | 17 | 10 | 0 | 63% | -0.277% |

#### Discovery / Bear
- Sample size: N=16
- Forward returns: 1b: +0.53% (63% pos, n=16) | 3b: +0.36% (56% pos, n=16) | 6b: +0.39% (50% pos, n=16) | 12b: -0.78% (44% pos, n=16) | 24b: +0.11% (56% pos, n=16)
- MAE/MFE over default hold: avg MAE -5.03% | p95 MAE -0.15% | avg MFE +5.31% | p95 MFE +17.38%
- Best combo: TP 1.50 / Stop 2.00 | WR 63% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 11 | 5 | 0 | 69% | -0.063% |
  | 1.00 | 1.50 | 10 | 6 | 0 | 63% | -0.047% |
  | 1.00 | 2.00 | 10 | 6 | 0 | 63% | -0.235% |
  | 1.50 | 2.00 | 10 | 6 | 0 | 63% | +0.077% |
  | 1.50 | 3.00 | 11 | 5 | 0 | 69% | -0.016% |

#### Validation / All
- Sample size: N=2
- Forward returns: 1b: +0.64% (100% pos, n=2) | 3b: +0.02% (50% pos, n=2) | 6b: +3.68% (50% pos, n=2) | 12b: +2.15% (50% pos, n=2) | 24b: +3.65% (50% pos, n=2)
- MAE/MFE over default hold: avg MAE -2.16% | p95 MAE -1.23% | avg MFE +4.51% | p95 MFE +8.47%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### Validation / Bear
- Sample size: N=1
- Forward returns: 1b: +0.17% (100% pos, n=1) | 3b: -0.03% (0% pos, n=1) | 6b: -0.21% (0% pos, n=1) | 12b: -0.27% (0% pos, n=1) | 24b: -0.85% (0% pos, n=1)
- MAE/MFE over default hold: avg MAE -3.08% | p95 MAE -3.08% | avg MFE +0.55% | p95 MFE +0.55%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy -1.610%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 1 | 0 | 0% | -1.610% |
  | 1.00 | 1.50 | 0 | 1 | 0 | 0% | -1.610% |
  | 1.00 | 2.00 | 0 | 1 | 0 | 0% | -2.110% |
  | 1.50 | 2.00 | 0 | 1 | 0 | 0% | -2.110% |
  | 1.50 | 3.00 | 0 | 1 | 0 | 0% | -3.110% |

#### All Regime
- Sample size: N=29
- Forward returns: 1b: +0.48% (59% pos, n=29) | 3b: +0.59% (55% pos, n=29) | 6b: +1.04% (52% pos, n=29) | 12b: -0.19% (45% pos, n=29) | 24b: -0.20% (52% pos, n=29)
- MAE/MFE over default hold: avg MAE -5.54% | p95 MAE -0.36% | avg MFE +6.78% | p95 MFE +17.38%
- Best combo: TP 0.75 / Stop 1.50 | WR 59% | Expectancy -0.291%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 17 | 12 | 0 | 59% | -0.291% |
  | 1.00 | 1.50 | 15 | 14 | 0 | 52% | -0.317% |
  | 1.00 | 2.00 | 16 | 13 | 0 | 55% | -0.455% |
  | 1.50 | 2.00 | 14 | 15 | 0 | 48% | -0.420% |
  | 1.50 | 3.00 | 18 | 11 | 0 | 62% | -0.317% |

#### Bear Regime
- Sample size: N=17
- Forward returns: 1b: +0.51% (65% pos, n=17) | 3b: +0.34% (53% pos, n=17) | 6b: +0.36% (47% pos, n=17) | 12b: -0.75% (41% pos, n=17) | 24b: +0.05% (53% pos, n=17)
- MAE/MFE over default hold: avg MAE -4.92% | p95 MAE -0.15% | avg MFE +5.03% | p95 MFE +17.38%
- Best combo: TP 1.50 / Stop 2.00 | WR 59% | Expectancy -0.051%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 11 | 6 | 0 | 65% | -0.154% |
  | 1.00 | 1.50 | 10 | 7 | 0 | 59% | -0.139% |
  | 1.00 | 2.00 | 10 | 7 | 0 | 59% | -0.345% |
  | 1.50 | 2.00 | 10 | 7 | 0 | 59% | -0.051% |
  | 1.50 | 3.00 | 11 | 6 | 0 | 65% | -0.198% |

### Signal: PF0 — Bear-Regime Pump Failure 2.0%
- Timeframe: 1H
- Logic: 1H green body >=2.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation
- Symbol: HYPEUSDT
- Verdict: PROFITABLE

#### Discovery / All
- Sample size: N=194
- Forward returns: 1b: -0.01% (52% pos, n=194) | 3b: +0.19% (53% pos, n=194) | 6b: -0.53% (47% pos, n=194) | 12b: -0.54% (43% pos, n=194) | 24b: -1.57% (42% pos, n=194)
- MAE/MFE over default hold: avg MAE -5.12% | p95 MAE -0.46% | avg MFE +4.74% | p95 MFE +13.10%
- Best combo: TP 1.50 / Stop 3.00 | WR 71% | Expectancy +0.095%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 141 | 53 | 0 | 73% | +0.025% |
  | 1.00 | 1.50 | 120 | 74 | 0 | 62% | -0.064% |
  | 1.00 | 2.00 | 135 | 59 | 0 | 70% | -0.022% |
  | 1.50 | 2.00 | 120 | 74 | 0 | 62% | +0.055% |
  | 1.50 | 3.00 | 138 | 55 | 1 | 71% | +0.095% |

#### Discovery / Bear
- Sample size: N=103
- Forward returns: 1b: -0.02% (51% pos, n=103) | 3b: +0.17% (51% pos, n=103) | 6b: -0.27% (50% pos, n=103) | 12b: +0.00% (47% pos, n=103) | 24b: -1.14% (40% pos, n=103)
- MAE/MFE over default hold: avg MAE -4.45% | p95 MAE -0.36% | avg MFE +4.51% | p95 MFE +11.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 73% | Expectancy +0.167%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 78 | 25 | 0 | 76% | +0.094% |
  | 1.00 | 1.50 | 69 | 34 | 0 | 67% | +0.065% |
  | 1.00 | 2.00 | 73 | 30 | 0 | 71% | +0.016% |
  | 1.50 | 2.00 | 65 | 38 | 0 | 63% | +0.099% |
  | 1.50 | 3.00 | 75 | 28 | 0 | 73% | +0.167% |

#### Validation / All
- Sample size: N=28
- Forward returns: 1b: +0.29% (57% pos, n=28) | 3b: +0.45% (57% pos, n=28) | 6b: +0.71% (57% pos, n=28) | 12b: +0.80% (64% pos, n=28) | 24b: +0.91% (61% pos, n=28)
- MAE/MFE over default hold: avg MAE -2.84% | p95 MAE -0.31% | avg MFE +3.86% | p95 MFE +8.35%
- Best combo: TP 1.50 / Stop 2.00 | WR 79% | Expectancy +0.640%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 22 | 6 | 0 | 79% | +0.158% |
  | 1.00 | 1.50 | 21 | 7 | 0 | 75% | +0.265% |
  | 1.00 | 2.00 | 25 | 3 | 0 | 89% | +0.569% |
  | 1.50 | 2.00 | 22 | 6 | 0 | 79% | +0.640% |
  | 1.50 | 3.00 | 22 | 5 | 1 | 79% | +0.520% |

#### Validation / Bear
- Sample size: N=10
- Forward returns: 1b: -0.11% (50% pos, n=10) | 3b: -0.08% (50% pos, n=10) | 6b: +0.96% (60% pos, n=10) | 12b: +0.57% (40% pos, n=10) | 24b: +0.28% (50% pos, n=10)
- MAE/MFE over default hold: avg MAE -2.38% | p95 MAE -0.43% | avg MFE +3.35% | p95 MFE +7.46%
- Best combo: TP 1.50 / Stop 2.00 | WR 70% | Expectancy +0.340%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 7 | 3 | 0 | 70% | -0.035% |
  | 1.00 | 1.50 | 7 | 3 | 0 | 70% | +0.140% |
  | 1.00 | 2.00 | 8 | 2 | 0 | 80% | +0.290% |
  | 1.50 | 2.00 | 7 | 3 | 0 | 70% | +0.340% |
  | 1.50 | 3.00 | 7 | 3 | 0 | 70% | +0.040% |

#### All Regime
- Sample size: N=222
- Forward returns: 1b: +0.03% (52% pos, n=222) | 3b: +0.22% (54% pos, n=222) | 6b: -0.38% (49% pos, n=222) | 12b: -0.37% (46% pos, n=222) | 24b: -1.26% (44% pos, n=222)
- MAE/MFE over default hold: avg MAE -4.83% | p95 MAE -0.43% | avg MFE +4.63% | p95 MFE +12.69%
- Best combo: TP 1.50 / Stop 3.00 | WR 72% | Expectancy +0.149%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 163 | 59 | 0 | 73% | +0.042% |
  | 1.00 | 1.50 | 141 | 81 | 0 | 64% | -0.022% |
  | 1.00 | 2.00 | 160 | 62 | 0 | 72% | +0.052% |
  | 1.50 | 2.00 | 142 | 80 | 0 | 64% | +0.129% |
  | 1.50 | 3.00 | 160 | 60 | 2 | 72% | +0.149% |

#### Bear Regime
- Sample size: N=113
- Forward returns: 1b: -0.03% (51% pos, n=113) | 3b: +0.15% (51% pos, n=113) | 6b: -0.16% (50% pos, n=113) | 12b: +0.05% (46% pos, n=113) | 24b: -1.01% (41% pos, n=113)
- MAE/MFE over default hold: avg MAE -4.27% | p95 MAE -0.36% | avg MFE +4.41% | p95 MFE +11.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 73% | Expectancy +0.155%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 85 | 28 | 0 | 75% | +0.082% |
  | 1.00 | 1.50 | 76 | 37 | 0 | 67% | +0.071% |
  | 1.00 | 2.00 | 81 | 32 | 0 | 72% | +0.040% |
  | 1.50 | 2.00 | 72 | 41 | 0 | 64% | +0.120% |
  | 1.50 | 3.00 | 82 | 31 | 0 | 73% | +0.155% |

### Signal: PF1A — Pump Failure 2.5% Tight Delay
- Timeframe: 1H
- Logic: 1H green body >=2.5%, next 1-2 bars fail to make new high >0.2%, short first red confirmation
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=112
- Forward returns: 1b: +0.03% (54% pos, n=112) | 3b: +0.01% (53% pos, n=112) | 6b: -0.46% (47% pos, n=112) | 12b: -0.56% (42% pos, n=112) | 24b: -2.37% (37% pos, n=112)
- MAE/MFE over default hold: avg MAE -5.42% | p95 MAE -0.48% | avg MFE +5.24% | p95 MFE +13.87%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy -0.009%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 76 | 36 | 0 | 68% | -0.083% |
  | 1.00 | 1.50 | 67 | 45 | 0 | 60% | -0.114% |
  | 1.00 | 2.00 | 78 | 34 | 0 | 70% | -0.021% |
  | 1.50 | 2.00 | 65 | 47 | 0 | 58% | -0.079% |
  | 1.50 | 3.00 | 77 | 34 | 1 | 69% | -0.009% |

#### Discovery / Bear
- Sample size: N=58
- Forward returns: 1b: +0.08% (55% pos, n=58) | 3b: +0.11% (50% pos, n=58) | 6b: +0.00% (52% pos, n=58) | 12b: -0.15% (45% pos, n=58) | 24b: -1.79% (34% pos, n=58)
- MAE/MFE over default hold: avg MAE -4.68% | p95 MAE -0.15% | avg MFE +4.91% | p95 MFE +14.25%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy -0.007%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 41 | 17 | 0 | 71% | -0.019% |
  | 1.00 | 1.50 | 37 | 21 | 0 | 64% | -0.015% |
  | 1.00 | 2.00 | 40 | 18 | 0 | 69% | -0.041% |
  | 1.50 | 2.00 | 33 | 25 | 0 | 57% | -0.119% |
  | 1.50 | 3.00 | 40 | 18 | 0 | 69% | -0.007% |

#### Validation / All
- Sample size: N=14
- Forward returns: 1b: +0.89% (79% pos, n=14) | 3b: +1.04% (57% pos, n=14) | 6b: +1.13% (64% pos, n=14) | 12b: +0.45% (57% pos, n=14) | 24b: +1.27% (57% pos, n=14)
- MAE/MFE over default hold: avg MAE -3.02% | p95 MAE -0.27% | avg MFE +4.19% | p95 MFE +8.47%
- Best combo: TP 1.50 / Stop 3.00 | WR 86% | Expectancy +0.936%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 12 | 2 | 0 | 86% | +0.319% |
  | 1.00 | 1.50 | 12 | 2 | 0 | 86% | +0.533% |
  | 1.00 | 2.00 | 13 | 1 | 0 | 93% | +0.676% |
  | 1.50 | 2.00 | 12 | 2 | 0 | 86% | +0.890% |
  | 1.50 | 3.00 | 12 | 1 | 1 | 86% | +0.936% |

#### Validation / Bear
- Sample size: N=5
- Forward returns: 1b: +0.29% (60% pos, n=5) | 3b: +0.19% (40% pos, n=5) | 6b: +1.82% (80% pos, n=5) | 12b: +0.23% (40% pos, n=5) | 24b: +1.57% (60% pos, n=5)
- MAE/MFE over default hold: avg MAE -1.97% | p95 MAE -1.44% | avg MFE +2.76% | p95 MFE +5.62%
- Best combo: TP 1.50 / Stop 2.00 | WR 80% | Expectancy +0.690%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 4 | 1 | 0 | 80% | +0.390% |
  | 1.00 | 2.00 | 4 | 1 | 0 | 80% | +0.290% |
  | 1.50 | 2.00 | 4 | 1 | 0 | 80% | +0.690% |
  | 1.50 | 3.00 | 4 | 1 | 0 | 80% | +0.490% |

#### All Regime
- Sample size: N=126
- Forward returns: 1b: +0.12% (57% pos, n=126) | 3b: +0.13% (53% pos, n=126) | 6b: -0.28% (49% pos, n=126) | 12b: -0.45% (44% pos, n=126) | 24b: -1.97% (39% pos, n=126)
- MAE/MFE over default hold: avg MAE -5.15% | p95 MAE -0.39% | avg MFE +5.13% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 71% | Expectancy +0.096%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 88 | 38 | 0 | 70% | -0.039% |
  | 1.00 | 1.50 | 79 | 47 | 0 | 63% | -0.043% |
  | 1.00 | 2.00 | 91 | 35 | 0 | 72% | +0.057% |
  | 1.50 | 2.00 | 77 | 49 | 0 | 61% | +0.029% |
  | 1.50 | 3.00 | 89 | 35 | 2 | 71% | +0.096% |

#### Bear Regime
- Sample size: N=63
- Forward returns: 1b: +0.09% (56% pos, n=63) | 3b: +0.11% (49% pos, n=63) | 6b: +0.14% (54% pos, n=63) | 12b: -0.12% (44% pos, n=63) | 24b: -1.52% (37% pos, n=63)
- MAE/MFE over default hold: avg MAE -4.46% | p95 MAE -0.15% | avg MFE +4.74% | p95 MFE +13.55%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.033%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 45 | 18 | 0 | 71% | -0.003% |
  | 1.00 | 1.50 | 41 | 22 | 0 | 65% | +0.017% |
  | 1.00 | 2.00 | 44 | 19 | 0 | 70% | -0.015% |
  | 1.50 | 2.00 | 37 | 26 | 0 | 59% | -0.054% |
  | 1.50 | 3.00 | 44 | 19 | 0 | 70% | +0.033% |

### Signal: PF1M — Pump Failure 2.5% Midpoint Confirm
- Timeframe: 1H
- Logic: PF1 plus confirmation bar closes below pump midpoint
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=85
- Forward returns: 1b: -0.26% (53% pos, n=85) | 3b: -0.09% (49% pos, n=85) | 6b: -0.95% (42% pos, n=85) | 12b: -0.93% (38% pos, n=85) | 24b: -2.13% (38% pos, n=85)
- MAE/MFE over default hold: avg MAE -5.79% | p95 MAE -0.36% | avg MFE +5.12% | p95 MFE +13.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 68% | Expectancy -0.063%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 52 | 33 | 0 | 61% | -0.234% |
  | 1.00 | 1.50 | 46 | 39 | 0 | 54% | -0.257% |
  | 1.00 | 2.00 | 58 | 27 | 0 | 68% | -0.063% |
  | 1.50 | 2.00 | 49 | 36 | 0 | 58% | -0.092% |
  | 1.50 | 3.00 | 54 | 31 | 0 | 64% | -0.251% |

#### Discovery / Bear
- Sample size: N=41
- Forward returns: 1b: -0.35% (56% pos, n=41) | 3b: +0.02% (51% pos, n=41) | 6b: -0.42% (44% pos, n=41) | 12b: -0.48% (44% pos, n=41) | 24b: -1.78% (39% pos, n=41)
- MAE/MFE over default hold: avg MAE -5.27% | p95 MAE -0.15% | avg MFE +4.75% | p95 MFE +13.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 68% | Expectancy -0.061%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 28 | 13 | 0 | 68% | -0.073% |
  | 1.00 | 1.50 | 25 | 16 | 0 | 61% | -0.086% |
  | 1.00 | 2.00 | 28 | 13 | 0 | 68% | -0.061% |
  | 1.50 | 2.00 | 22 | 19 | 0 | 54% | -0.232% |
  | 1.50 | 3.00 | 25 | 16 | 0 | 61% | -0.366% |

#### Validation / All
- Sample size: N=10
- Forward returns: 1b: +0.36% (40% pos, n=10) | 3b: +0.76% (60% pos, n=10) | 6b: +1.07% (70% pos, n=10) | 12b: -0.09% (50% pos, n=10) | 24b: +0.50% (70% pos, n=10)
- MAE/MFE over default hold: avg MAE -4.26% | p95 MAE -1.06% | avg MFE +4.50% | p95 MFE +7.44%
- Best combo: TP 1.00 / Stop 2.00 | WR 90% | Expectancy +0.590%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 8 | 2 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 7 | 3 | 0 | 70% | +0.140% |
  | 1.00 | 2.00 | 9 | 1 | 0 | 90% | +0.590% |
  | 1.50 | 2.00 | 7 | 3 | 0 | 70% | +0.340% |
  | 1.50 | 3.00 | 7 | 3 | 0 | 70% | +0.040% |

#### Validation / Bear
- Sample size: N=2
- Forward returns: 1b: -1.18% (0% pos, n=2) | 3b: -1.24% (50% pos, n=2) | 6b: +3.08% (100% pos, n=2) | 12b: +1.33% (100% pos, n=2) | 24b: +1.40% (100% pos, n=2)
- MAE/MFE over default hold: avg MAE -2.67% | p95 MAE -1.74% | avg MFE +3.89% | p95 MFE +5.62%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### All Regime
- Sample size: N=95
- Forward returns: 1b: -0.19% (52% pos, n=95) | 3b: -0.00% (51% pos, n=95) | 6b: -0.74% (45% pos, n=95) | 12b: -0.85% (39% pos, n=95) | 24b: -1.85% (41% pos, n=95)
- MAE/MFE over default hold: avg MAE -5.63% | p95 MAE -0.36% | avg MFE +5.05% | p95 MFE +13.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 71% | Expectancy +0.006%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 60 | 35 | 0 | 63% | -0.189% |
  | 1.00 | 1.50 | 53 | 42 | 0 | 56% | -0.215% |
  | 1.00 | 2.00 | 67 | 28 | 0 | 71% | +0.006% |
  | 1.50 | 2.00 | 56 | 39 | 0 | 59% | -0.047% |
  | 1.50 | 3.00 | 61 | 34 | 0 | 64% | -0.221% |

#### Bear Regime
- Sample size: N=43
- Forward returns: 1b: -0.39% (53% pos, n=43) | 3b: -0.04% (51% pos, n=43) | 6b: -0.25% (47% pos, n=43) | 12b: -0.39% (47% pos, n=43) | 24b: -1.63% (42% pos, n=43)
- MAE/MFE over default hold: avg MAE -5.15% | p95 MAE -0.15% | avg MFE +4.71% | p95 MFE +13.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 67% | Expectancy -0.087%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 29 | 14 | 0 | 67% | -0.093% |
  | 1.00 | 1.50 | 26 | 17 | 0 | 60% | -0.098% |
  | 1.00 | 2.00 | 29 | 14 | 0 | 67% | -0.087% |
  | 1.50 | 2.00 | 23 | 20 | 0 | 53% | -0.238% |
  | 1.50 | 3.00 | 26 | 17 | 0 | 60% | -0.389% |

### Signal: PFLV — Pump Failure 2.5% Low-Volume Pump
- Timeframe: 1H
- Logic: PF1 plus pump volume <=1.3x SMA20
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=55
- Forward returns: 1b: -0.32% (45% pos, n=55) | 3b: -0.86% (51% pos, n=55) | 6b: -1.54% (44% pos, n=55) | 12b: -1.47% (47% pos, n=55) | 24b: -2.20% (45% pos, n=55)
- MAE/MFE over default hold: avg MAE -6.27% | p95 MAE -0.76% | avg MFE +4.66% | p95 MFE +10.35%
- Best combo: TP 1.00 / Stop 2.00 | WR 71% | Expectancy +0.017%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 38 | 17 | 0 | 69% | -0.055% |
  | 1.00 | 1.50 | 33 | 22 | 0 | 60% | -0.110% |
  | 1.00 | 2.00 | 39 | 16 | 0 | 71% | +0.017% |
  | 1.50 | 2.00 | 33 | 22 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 38 | 17 | 0 | 69% | -0.001% |

#### Discovery / Bear
- Sample size: N=29
- Forward returns: 1b: -0.03% (48% pos, n=29) | 3b: -0.17% (52% pos, n=29) | 6b: -0.54% (52% pos, n=29) | 12b: -0.45% (55% pos, n=29) | 24b: -1.33% (41% pos, n=29)
- MAE/MFE over default hold: avg MAE -5.07% | p95 MAE -0.56% | avg MFE +4.51% | p95 MFE +10.03%
- Best combo: TP 0.75 / Stop 1.50 | WR 76% | Expectancy +0.097%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 22 | 7 | 0 | 76% | +0.097% |
  | 1.00 | 1.50 | 19 | 10 | 0 | 66% | +0.028% |
  | 1.00 | 2.00 | 20 | 9 | 0 | 69% | -0.041% |
  | 1.50 | 2.00 | 16 | 13 | 0 | 55% | -0.179% |
  | 1.50 | 3.00 | 20 | 9 | 0 | 69% | -0.007% |

#### Validation / All
- Sample size: N=5
- Forward returns: 1b: +0.70% (40% pos, n=5) | 3b: +1.57% (60% pos, n=5) | 6b: -1.39% (40% pos, n=5) | 12b: -1.36% (40% pos, n=5) | 24b: -0.58% (60% pos, n=5)
- MAE/MFE over default hold: avg MAE -5.04% | p95 MAE -0.87% | avg MFE +4.07% | p95 MFE +8.35%
- Best combo: TP 1.50 / Stop 3.00 | WR 80% | Expectancy +0.490%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 4 | 1 | 0 | 80% | +0.390% |
  | 1.00 | 2.00 | 4 | 1 | 0 | 80% | +0.290% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 4 | 1 | 0 | 80% | +0.490% |

#### Validation / Bear
- Sample size: N=1
- Forward returns: 1b: -0.01% (0% pos, n=1) | 3b: +0.68% (100% pos, n=1) | 6b: +1.18% (100% pos, n=1) | 12b: -1.26% (0% pos, n=1) | 24b: +4.16% (100% pos, n=1)
- MAE/MFE over default hold: avg MAE -1.44% | p95 MAE -1.44% | avg MFE +1.80% | p95 MFE +1.80%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 1 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 1 | 0 | 0 | 100% | +1.390% |

#### All Regime
- Sample size: N=60
- Forward returns: 1b: -0.24% (45% pos, n=60) | 3b: -0.65% (52% pos, n=60) | 6b: -1.53% (43% pos, n=60) | 12b: -1.47% (47% pos, n=60) | 24b: -2.07% (47% pos, n=60)
- MAE/MFE over default hold: avg MAE -6.17% | p95 MAE -0.76% | avg MFE +4.61% | p95 MFE +10.35%
- Best combo: TP 1.00 / Stop 2.00 | WR 72% | Expectancy +0.040%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 42 | 18 | 0 | 70% | -0.035% |
  | 1.00 | 1.50 | 37 | 23 | 0 | 62% | -0.068% |
  | 1.00 | 2.00 | 43 | 17 | 0 | 72% | +0.040% |
  | 1.50 | 2.00 | 36 | 24 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 42 | 18 | 0 | 70% | +0.040% |

#### Bear Regime
- Sample size: N=30
- Forward returns: 1b: -0.03% (47% pos, n=30) | 3b: -0.14% (53% pos, n=30) | 6b: -0.49% (53% pos, n=30) | 12b: -0.48% (53% pos, n=30) | 24b: -1.14% (43% pos, n=30)
- MAE/MFE over default hold: avg MAE -4.95% | p95 MAE -0.56% | avg MFE +4.42% | p95 MFE +10.03%
- Best combo: TP 0.75 / Stop 1.50 | WR 77% | Expectancy +0.115%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 23 | 7 | 0 | 77% | +0.115% |
  | 1.00 | 1.50 | 20 | 10 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 21 | 9 | 0 | 70% | -0.010% |
  | 1.50 | 2.00 | 17 | 13 | 0 | 57% | -0.127% |
  | 1.50 | 3.00 | 21 | 9 | 0 | 70% | +0.040% |

### Signal: PFE20 — Pump Failure 2.5% + Confirm Below EMA20
- Timeframe: 1H
- Logic: PF1 plus confirmation bar closes below EMA20
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=67
- Forward returns: 1b: -0.09% (48% pos, n=67) | 3b: -0.04% (43% pos, n=67) | 6b: -0.51% (45% pos, n=67) | 12b: -0.62% (39% pos, n=67) | 24b: -2.59% (31% pos, n=67)
- MAE/MFE over default hold: avg MAE -5.38% | p95 MAE -1.17% | avg MFE +5.25% | p95 MFE +12.50%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy -0.020%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 43 | 24 | 0 | 64% | -0.166% |
  | 1.00 | 1.50 | 35 | 32 | 0 | 52% | -0.304% |
  | 1.00 | 2.00 | 43 | 24 | 0 | 64% | -0.185% |
  | 1.50 | 2.00 | 36 | 31 | 0 | 54% | -0.229% |
  | 1.50 | 3.00 | 46 | 21 | 0 | 69% | -0.020% |

#### Discovery / Bear
- Sample size: N=36
- Forward returns: 1b: -0.17% (44% pos, n=36) | 3b: -0.14% (39% pos, n=36) | 6b: -0.34% (50% pos, n=36) | 12b: -0.96% (39% pos, n=36) | 24b: -2.19% (33% pos, n=36)
- MAE/MFE over default hold: avg MAE -5.06% | p95 MAE -0.39% | avg MFE +4.65% | p95 MFE +12.50%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 24 | 12 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 20 | 16 | 0 | 56% | -0.221% |
  | 1.00 | 2.00 | 22 | 14 | 0 | 61% | -0.277% |
  | 1.50 | 2.00 | 18 | 18 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 24 | 12 | 0 | 67% | -0.110% |

#### Validation / All
- Sample size: N=3
- Forward returns: 1b: -0.00% (67% pos, n=3) | 3b: +0.32% (67% pos, n=3) | 6b: -3.05% (0% pos, n=3) | 12b: -4.15% (0% pos, n=3) | 24b: -4.21% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -9.70% | p95 MAE -8.04% | avg MFE +3.08% | p95 MFE +4.99%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 2 | 1 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 3 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 3 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 3 | 0 | 0 | 100% | +1.390% |

#### Validation / Bear
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### All Regime
- Sample size: N=70
- Forward returns: 1b: -0.09% (49% pos, n=70) | 3b: -0.03% (44% pos, n=70) | 6b: -0.62% (43% pos, n=70) | 12b: -0.77% (37% pos, n=70) | 24b: -2.66% (31% pos, n=70)
- MAE/MFE over default hold: avg MAE -5.57% | p95 MAE -1.17% | avg MFE +5.16% | p95 MFE +12.50%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.040%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 45 | 25 | 0 | 64% | -0.164% |
  | 1.00 | 1.50 | 37 | 33 | 0 | 53% | -0.289% |
  | 1.00 | 2.00 | 46 | 24 | 0 | 66% | -0.139% |
  | 1.50 | 2.00 | 39 | 31 | 0 | 56% | -0.160% |
  | 1.50 | 3.00 | 49 | 21 | 0 | 70% | +0.040% |

#### Bear Regime
- Sample size: N=36
- Forward returns: 1b: -0.17% (44% pos, n=36) | 3b: -0.14% (39% pos, n=36) | 6b: -0.34% (50% pos, n=36) | 12b: -0.96% (39% pos, n=36) | 24b: -2.19% (33% pos, n=36)
- MAE/MFE over default hold: avg MAE -5.06% | p95 MAE -0.39% | avg MFE +4.65% | p95 MFE +12.50%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 24 | 12 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 20 | 16 | 0 | 56% | -0.221% |
  | 1.00 | 2.00 | 22 | 14 | 0 | 61% | -0.277% |
  | 1.50 | 2.00 | 18 | 18 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 24 | 12 | 0 | 67% | -0.110% |

### Signal: PV1 — Pump + Blowoff Wick
- Timeframe: 1H
- Logic: 1H green pump >=3.0%, volume >=2x SMA20, upper wick >=25%, short at close
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=16
- Forward returns: 1b: -0.67% (31% pos, n=16) | 3b: +0.53% (75% pos, n=16) | 6b: +0.04% (56% pos, n=16) | 12b: +0.23% (44% pos, n=16) | 24b: -2.35% (38% pos, n=16)
- MAE/MFE over default hold: avg MAE -6.41% | p95 MAE -1.22% | avg MFE +6.22% | p95 MFE +14.86%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy -0.016%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 8 | 8 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 7 | 9 | 0 | 44% | -0.516% |
  | 1.00 | 2.00 | 8 | 8 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 7 | 9 | 0 | 44% | -0.579% |
  | 1.50 | 3.00 | 11 | 5 | 0 | 69% | -0.016% |

#### Discovery / Bear
- Sample size: N=8
- Forward returns: 1b: -1.62% (13% pos, n=8) | 3b: -0.69% (63% pos, n=8) | 6b: -1.78% (38% pos, n=8) | 12b: -0.93% (38% pos, n=8) | 24b: -2.18% (38% pos, n=8)
- MAE/MFE over default hold: avg MAE -6.12% | p95 MAE -1.22% | avg MFE +4.34% | p95 MFE +11.19%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.297%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 4 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 3 | 5 | 0 | 38% | -0.672% |
  | 1.00 | 2.00 | 3 | 5 | 0 | 38% | -0.985% |
  | 1.50 | 2.00 | 3 | 5 | 0 | 38% | -0.797% |
  | 1.50 | 3.00 | 5 | 3 | 0 | 63% | -0.297% |

#### Validation / All
- Sample size: N=3
- Forward returns: 1b: -1.94% (33% pos, n=3) | 3b: +0.67% (67% pos, n=3) | 6b: +0.56% (67% pos, n=3) | 12b: -3.49% (67% pos, n=3) | 24b: -3.64% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -6.48% | p95 MAE -0.39% | avg MFE +3.07% | p95 MFE +4.44%
- Best combo: TP 0.75 / Stop 1.50 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 1 | 2 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 1 | 2 | 0 | 33% | -1.110% |
  | 1.50 | 2.00 | 1 | 2 | 0 | 33% | -0.943% |
  | 1.50 | 3.00 | 1 | 2 | 0 | 33% | -1.610% |

#### Validation / Bear
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### All Regime
- Sample size: N=19
- Forward returns: 1b: -0.87% (32% pos, n=19) | 3b: +0.55% (74% pos, n=19) | 6b: +0.13% (58% pos, n=19) | 12b: -0.36% (47% pos, n=19) | 24b: -2.56% (37% pos, n=19)
- MAE/MFE over default hold: avg MAE -6.42% | p95 MAE -0.39% | avg MFE +5.72% | p95 MFE +14.86%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.268%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 9 | 0 | 53% | -0.426% |
  | 1.00 | 1.50 | 8 | 11 | 0 | 42% | -0.557% |
  | 1.00 | 2.00 | 9 | 10 | 0 | 47% | -0.689% |
  | 1.50 | 2.00 | 8 | 11 | 0 | 42% | -0.636% |
  | 1.50 | 3.00 | 12 | 7 | 0 | 63% | -0.268% |

#### Bear Regime
- Sample size: N=8
- Forward returns: 1b: -1.62% (13% pos, n=8) | 3b: -0.69% (63% pos, n=8) | 6b: -1.78% (38% pos, n=8) | 12b: -0.93% (38% pos, n=8) | 24b: -2.18% (38% pos, n=8)
- MAE/MFE over default hold: avg MAE -6.12% | p95 MAE -1.22% | avg MFE +4.34% | p95 MFE +11.19%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.297%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 4 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 3 | 5 | 0 | 38% | -0.672% |
  | 1.00 | 2.00 | 3 | 5 | 0 | 38% | -0.985% |
  | 1.50 | 2.00 | 3 | 5 | 0 | 38% | -0.797% |
  | 1.50 | 3.00 | 5 | 3 | 0 | 63% | -0.297% |

### Signal: PV2 — Pump + Volume Climax Rejection
- Timeframe: 1H
- Logic: 1H green pump >=3.0%, volume >=2.5x SMA20, next bar closes below pump midpoint
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=5
- Forward returns: 1b: -0.91% (40% pos, n=5) | 3b: +0.97% (60% pos, n=5) | 6b: -2.72% (0% pos, n=5) | 12b: -1.01% (20% pos, n=5) | 24b: -4.88% (0% pos, n=5)
- MAE/MFE over default hold: avg MAE -5.28% | p95 MAE -2.25% | avg MFE +4.04% | p95 MFE +10.43%
- Best combo: TP 1.50 / Stop 2.00 | WR 60% | Expectancy -0.010%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 3 | 2 | 0 | 60% | -0.260% |
  | 1.00 | 1.50 | 3 | 2 | 0 | 60% | -0.110% |
  | 1.00 | 2.00 | 3 | 2 | 0 | 60% | -0.310% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 3 | 2 | 0 | 60% | -0.410% |

#### Discovery / Bear
- Sample size: N=2
- Forward returns: 1b: -0.72% (50% pos, n=2) | 3b: -1.25% (50% pos, n=2) | 6b: -0.85% (0% pos, n=2) | 12b: +0.11% (50% pos, n=2) | 24b: -3.62% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -4.31% | p95 MAE -2.25% | avg MFE +2.56% | p95 MFE +3.21%
- Best combo: TP 1.50 / Stop 2.00 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### Validation / All
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### Validation / Bear
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### All Regime
- Sample size: N=5
- Forward returns: 1b: -0.91% (40% pos, n=5) | 3b: +0.97% (60% pos, n=5) | 6b: -2.72% (0% pos, n=5) | 12b: -1.01% (20% pos, n=5) | 24b: -4.88% (0% pos, n=5)
- MAE/MFE over default hold: avg MAE -5.28% | p95 MAE -2.25% | avg MFE +4.04% | p95 MFE +10.43%
- Best combo: TP 1.50 / Stop 2.00 | WR 60% | Expectancy -0.010%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 3 | 2 | 0 | 60% | -0.260% |
  | 1.00 | 1.50 | 3 | 2 | 0 | 60% | -0.110% |
  | 1.00 | 2.00 | 3 | 2 | 0 | 60% | -0.310% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 3 | 2 | 0 | 60% | -0.410% |

#### Bear Regime
- Sample size: N=2
- Forward returns: 1b: -0.72% (50% pos, n=2) | 3b: -1.25% (50% pos, n=2) | 6b: -0.85% (0% pos, n=2) | 12b: +0.11% (50% pos, n=2) | 24b: -3.62% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -4.31% | p95 MAE -2.25% | avg MFE +2.56% | p95 MFE +3.21%
- Best combo: TP 1.50 / Stop 2.00 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

### Signal: PV3 — Three-Candle Pump Exhaustion
- Timeframe: 1H
- Logic: Three consecutive green 1H candles with shrinking bodies and >=4% total move, short first red bar
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=26
- Forward returns: 1b: -0.44% (35% pos, n=26) | 3b: -0.53% (42% pos, n=26) | 6b: -0.97% (38% pos, n=26) | 12b: -2.16% (46% pos, n=26) | 24b: -3.29% (46% pos, n=26)
- MAE/MFE over default hold: avg MAE -6.86% | p95 MAE -0.22% | avg MFE +3.86% | p95 MFE +7.71%
- Best combo: TP 0.75 / Stop 1.50 | WR 54% | Expectancy -0.398%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 14 | 12 | 0 | 54% | -0.398% |
  | 1.00 | 1.50 | 11 | 15 | 0 | 42% | -0.552% |
  | 1.00 | 2.00 | 14 | 12 | 0 | 54% | -0.495% |
  | 1.50 | 2.00 | 12 | 14 | 0 | 46% | -0.495% |
  | 1.50 | 3.00 | 14 | 11 | 1 | 54% | -0.566% |

#### Discovery / Bear
- Sample size: N=13
- Forward returns: 1b: -0.55% (31% pos, n=13) | 3b: -0.89% (38% pos, n=13) | 6b: +0.08% (46% pos, n=13) | 12b: +0.46% (54% pos, n=13) | 24b: -0.46% (54% pos, n=13)
- MAE/MFE over default hold: avg MAE -4.38% | p95 MAE -0.21% | avg MFE +3.88% | p95 MFE +10.81%
- Best combo: TP 1.00 / Stop 2.00 | WR 69% | Expectancy -0.033%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 7 | 6 | 0 | 54% | -0.398% |
  | 1.00 | 1.50 | 7 | 6 | 0 | 54% | -0.264% |
  | 1.00 | 2.00 | 9 | 4 | 0 | 69% | -0.033% |
  | 1.50 | 2.00 | 7 | 6 | 0 | 54% | -0.225% |
  | 1.50 | 3.00 | 8 | 4 | 1 | 62% | -0.099% |

#### Validation / All
- Sample size: N=2
- Forward returns: 1b: +0.47% (100% pos, n=2) | 3b: -1.87% (50% pos, n=2) | 6b: -3.31% (0% pos, n=2) | 12b: -7.25% (0% pos, n=2) | 24b: -10.05% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -9.73% | p95 MAE -4.22% | avg MFE +1.25% | p95 MFE +1.91%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### Validation / Bear
- Sample size: N=2
- Forward returns: 1b: +0.47% (100% pos, n=2) | 3b: -1.87% (50% pos, n=2) | 6b: -3.31% (0% pos, n=2) | 12b: -7.25% (0% pos, n=2) | 24b: -10.05% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -9.73% | p95 MAE -4.22% | avg MFE +1.25% | p95 MFE +1.91%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### All Regime
- Sample size: N=28
- Forward returns: 1b: -0.38% (39% pos, n=28) | 3b: -0.62% (43% pos, n=28) | 6b: -1.14% (36% pos, n=28) | 12b: -2.52% (43% pos, n=28) | 24b: -3.77% (43% pos, n=28)
- MAE/MFE over default hold: avg MAE -7.07% | p95 MAE -0.22% | avg MFE +3.68% | p95 MFE +7.71%
- Best combo: TP 0.75 / Stop 1.50 | WR 54% | Expectancy -0.405%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 15 | 13 | 0 | 54% | -0.405% |
  | 1.00 | 1.50 | 12 | 16 | 0 | 43% | -0.539% |
  | 1.00 | 2.00 | 15 | 13 | 0 | 54% | -0.503% |
  | 1.50 | 2.00 | 13 | 15 | 0 | 46% | -0.485% |
  | 1.50 | 3.00 | 15 | 12 | 1 | 54% | -0.587% |

#### Bear Regime
- Sample size: N=15
- Forward returns: 1b: -0.42% (40% pos, n=15) | 3b: -1.02% (40% pos, n=15) | 6b: -0.37% (40% pos, n=15) | 12b: -0.57% (47% pos, n=15) | 24b: -1.73% (47% pos, n=15)
- MAE/MFE over default hold: avg MAE -5.09% | p95 MAE -0.21% | avg MFE +3.53% | p95 MFE +10.81%
- Best combo: TP 1.00 / Stop 2.00 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 8 | 7 | 0 | 53% | -0.410% |
  | 1.00 | 1.50 | 8 | 7 | 0 | 53% | -0.277% |
  | 1.00 | 2.00 | 10 | 5 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 8 | 7 | 0 | 53% | -0.243% |
  | 1.50 | 3.00 | 9 | 5 | 1 | 60% | -0.200% |

### Signal: SR1 — 5m Spike Rejection 12-Bar
- Timeframe: 5m
- Logic: 5m high >= prior 12-bar high by 0.5%, closes red and back below prior high
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=150
- Forward returns: 1b: -0.09% (43% pos, n=150) | 3b: -0.15% (53% pos, n=150) | 6b: -0.10% (48% pos, n=150) | 12b: +0.18% (51% pos, n=150) | 24b: +0.36% (57% pos, n=150)
- MAE/MFE over default hold: avg MAE -2.69% | p95 MAE -0.22% | avg MFE +3.09% | p95 MFE +8.05%
- Best combo: TP 1.50 / Stop 3.00 | WR 59% | Expectancy -0.078%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 91 | 56 | 3 | 61% | -0.212% |
  | 1.00 | 1.50 | 78 | 66 | 6 | 52% | -0.246% |
  | 1.00 | 2.00 | 91 | 50 | 9 | 61% | -0.184% |
  | 1.50 | 2.00 | 78 | 60 | 12 | 52% | -0.132% |
  | 1.50 | 3.00 | 89 | 39 | 22 | 59% | -0.078% |

#### Discovery / Bear
- Sample size: N=60
- Forward returns: 1b: -0.03% (45% pos, n=60) | 3b: -0.17% (50% pos, n=60) | 6b: -0.05% (50% pos, n=60) | 12b: +0.12% (48% pos, n=60) | 24b: +0.03% (52% pos, n=60)
- MAE/MFE over default hold: avg MAE -2.74% | p95 MAE -0.33% | avg MFE +2.56% | p95 MFE +7.43%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.148%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 39 | 21 | 0 | 65% | -0.148% |
  | 1.00 | 1.50 | 32 | 25 | 3 | 53% | -0.200% |
  | 1.00 | 2.00 | 36 | 19 | 5 | 60% | -0.166% |
  | 1.50 | 2.00 | 30 | 25 | 5 | 50% | -0.216% |
  | 1.50 | 3.00 | 33 | 16 | 11 | 55% | -0.198% |

#### Validation / All
- Sample size: N=13
- Forward returns: 1b: +0.18% (69% pos, n=13) | 3b: -0.08% (46% pos, n=13) | 6b: +0.01% (54% pos, n=13) | 12b: -0.74% (38% pos, n=13) | 24b: -2.45% (15% pos, n=13)
- MAE/MFE over default hold: avg MAE -3.78% | p95 MAE -0.09% | avg MFE +1.50% | p95 MFE +2.97%
- Best combo: TP 0.75 / Stop 1.50 | WR 69% | Expectancy -0.052%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 9 | 4 | 0 | 69% | -0.052% |
  | 1.00 | 1.50 | 7 | 6 | 0 | 54% | -0.264% |
  | 1.00 | 2.00 | 7 | 6 | 0 | 54% | -0.495% |
  | 1.50 | 2.00 | 6 | 7 | 0 | 46% | -0.495% |
  | 1.50 | 3.00 | 7 | 4 | 2 | 54% | -0.422% |

#### Validation / Bear
- Sample size: N=2
- Forward returns: 1b: +0.35% (100% pos, n=2) | 3b: +0.25% (50% pos, n=2) | 6b: +0.31% (50% pos, n=2) | 12b: -0.54% (50% pos, n=2) | 24b: -4.07% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -4.21% | p95 MAE -3.81% | avg MFE +1.05% | p95 MFE +1.72%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### All Regime
- Sample size: N=163
- Forward returns: 1b: -0.06% (45% pos, n=163) | 3b: -0.15% (52% pos, n=163) | 6b: -0.09% (48% pos, n=163) | 12b: +0.10% (50% pos, n=163) | 24b: +0.13% (53% pos, n=163)
- MAE/MFE over default hold: avg MAE -2.77% | p95 MAE -0.22% | avg MFE +2.96% | p95 MFE +7.98%
- Best combo: TP 1.50 / Stop 3.00 | WR 59% | Expectancy -0.105%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 100 | 60 | 3 | 61% | -0.199% |
  | 1.00 | 1.50 | 85 | 72 | 6 | 52% | -0.247% |
  | 1.00 | 2.00 | 98 | 56 | 9 | 60% | -0.209% |
  | 1.50 | 2.00 | 84 | 67 | 12 | 52% | -0.161% |
  | 1.50 | 3.00 | 96 | 43 | 24 | 59% | -0.105% |

#### Bear Regime
- Sample size: N=62
- Forward returns: 1b: -0.02% (47% pos, n=62) | 3b: -0.16% (50% pos, n=62) | 6b: -0.04% (50% pos, n=62) | 12b: +0.10% (48% pos, n=62) | 24b: -0.11% (50% pos, n=62)
- MAE/MFE over default hold: avg MAE -2.79% | p95 MAE -0.36% | avg MFE +2.51% | p95 MFE +5.92%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.158%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 40 | 22 | 0 | 65% | -0.158% |
  | 1.00 | 1.50 | 33 | 26 | 3 | 53% | -0.206% |
  | 1.00 | 2.00 | 37 | 20 | 5 | 60% | -0.180% |
  | 1.50 | 2.00 | 31 | 26 | 5 | 50% | -0.221% |
  | 1.50 | 3.00 | 34 | 17 | 11 | 55% | -0.219% |

### Signal: SR2 — 5m Spike Rejection 24-Bar
- Timeframe: 5m
- Logic: 5m high >= prior 24-bar high by 0.7%, upper wick >=40%, closes in lower half
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=184
- Forward returns: 1b: +0.04% (49% pos, n=184) | 3b: +0.08% (57% pos, n=184) | 6b: +0.03% (53% pos, n=184) | 12b: +0.02% (47% pos, n=184) | 24b: -0.05% (50% pos, n=184)
- MAE/MFE over default hold: avg MAE -2.68% | p95 MAE -0.24% | avg MFE +2.76% | p95 MFE +7.56%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy +0.019%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 115 | 62 | 7 | 63% | -0.169% |
  | 1.00 | 1.50 | 100 | 74 | 10 | 54% | -0.201% |
  | 1.00 | 2.00 | 116 | 53 | 15 | 63% | -0.115% |
  | 1.50 | 2.00 | 95 | 62 | 27 | 52% | -0.053% |
  | 1.50 | 3.00 | 106 | 40 | 38 | 58% | +0.019% |

#### Discovery / Bear
- Sample size: N=79
- Forward returns: 1b: +0.03% (49% pos, n=79) | 3b: +0.12% (56% pos, n=79) | 6b: +0.13% (57% pos, n=79) | 12b: +0.08% (49% pos, n=79) | 24b: +0.28% (52% pos, n=79)
- MAE/MFE over default hold: avg MAE -2.31% | p95 MAE -0.18% | avg MFE +2.52% | p95 MFE +7.69%
- Best combo: TP 1.50 / Stop 3.00 | WR 56% | Expectancy +0.116%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 49 | 24 | 6 | 62% | -0.140% |
  | 1.00 | 1.50 | 45 | 26 | 8 | 57% | -0.087% |
  | 1.00 | 2.00 | 51 | 18 | 10 | 65% | +0.012% |
  | 1.50 | 2.00 | 40 | 23 | 16 | 51% | +0.013% |
  | 1.50 | 3.00 | 44 | 14 | 21 | 56% | +0.116% |

#### Validation / All
- Sample size: N=29
- Forward returns: 1b: -0.07% (76% pos, n=29) | 3b: -0.03% (52% pos, n=29) | 6b: +0.17% (52% pos, n=29) | 12b: +0.04% (48% pos, n=29) | 24b: -0.56% (52% pos, n=29)
- MAE/MFE over default hold: avg MAE -2.40% | p95 MAE -0.07% | avg MFE +2.00% | p95 MFE +4.91%
- Best combo: TP 1.00 / Stop 1.50 | WR 66% | Expectancy +0.028%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 21 | 8 | 0 | 72% | +0.019% |
  | 1.00 | 1.50 | 19 | 10 | 0 | 66% | +0.028% |
  | 1.00 | 2.00 | 20 | 9 | 0 | 69% | -0.041% |
  | 1.50 | 2.00 | 15 | 12 | 2 | 52% | -0.108% |
  | 1.50 | 3.00 | 16 | 8 | 5 | 55% | -0.261% |

#### Validation / Bear
- Sample size: N=8
- Forward returns: 1b: +0.27% (75% pos, n=8) | 3b: +0.02% (50% pos, n=8) | 6b: +0.22% (50% pos, n=8) | 12b: +0.19% (38% pos, n=8) | 24b: -0.02% (63% pos, n=8)
- MAE/MFE over default hold: avg MAE -1.51% | p95 MAE -0.08% | avg MFE +1.75% | p95 MFE +4.91%
- Best combo: TP 0.75 / Stop 1.50 | WR 75% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 2 | 0 | 75% | +0.077% |
  | 1.00 | 1.50 | 5 | 3 | 0 | 63% | -0.047% |
  | 1.00 | 2.00 | 5 | 3 | 0 | 63% | -0.235% |
  | 1.50 | 2.00 | 4 | 3 | 1 | 50% | -0.004% |
  | 1.50 | 3.00 | 4 | 1 | 3 | 50% | -0.072% |

#### All Regime
- Sample size: N=213
- Forward returns: 1b: +0.02% (53% pos, n=213) | 3b: +0.07% (56% pos, n=213) | 6b: +0.05% (53% pos, n=213) | 12b: +0.02% (47% pos, n=213) | 24b: -0.12% (50% pos, n=213)
- MAE/MFE over default hold: avg MAE -2.64% | p95 MAE -0.18% | avg MFE +2.65% | p95 MFE +7.51%
- Best combo: TP 1.50 / Stop 3.00 | WR 57% | Expectancy -0.019%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 136 | 70 | 7 | 64% | -0.143% |
  | 1.00 | 1.50 | 119 | 84 | 10 | 56% | -0.170% |
  | 1.00 | 2.00 | 136 | 62 | 15 | 64% | -0.105% |
  | 1.50 | 2.00 | 110 | 74 | 29 | 52% | -0.061% |
  | 1.50 | 3.00 | 122 | 48 | 43 | 57% | -0.019% |

#### Bear Regime
- Sample size: N=87
- Forward returns: 1b: +0.06% (52% pos, n=87) | 3b: +0.11% (55% pos, n=87) | 6b: +0.14% (56% pos, n=87) | 12b: +0.09% (48% pos, n=87) | 24b: +0.25% (53% pos, n=87)
- MAE/MFE over default hold: avg MAE -2.24% | p95 MAE -0.16% | avg MFE +2.45% | p95 MFE +7.51%
- Best combo: TP 1.50 / Stop 3.00 | WR 55% | Expectancy +0.099%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 55 | 26 | 6 | 63% | -0.120% |
  | 1.00 | 1.50 | 50 | 29 | 8 | 57% | -0.083% |
  | 1.00 | 2.00 | 56 | 21 | 10 | 64% | -0.011% |
  | 1.50 | 2.00 | 44 | 26 | 17 | 51% | +0.012% |
  | 1.50 | 3.00 | 48 | 15 | 24 | 55% | +0.099% |

### Signal: SR3 — 5m Spike Rejection + Vol
- Timeframe: 5m
- Logic: SR1 plus current 5m volume >=1.5x SMA20
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=103
- Forward returns: 1b: -0.17% (40% pos, n=103) | 3b: -0.25% (50% pos, n=103) | 6b: -0.13% (49% pos, n=103) | 12b: +0.17% (50% pos, n=103) | 24b: +0.19% (55% pos, n=103)
- MAE/MFE over default hold: avg MAE -2.70% | p95 MAE -0.33% | avg MFE +2.78% | p95 MFE +7.44%
- Best combo: TP 0.75 / Stop 1.50 | WR 60% | Expectancy -0.207%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 62 | 38 | 3 | 60% | -0.207% |
  | 1.00 | 1.50 | 52 | 45 | 6 | 50% | -0.255% |
  | 1.00 | 2.00 | 58 | 37 | 8 | 56% | -0.274% |
  | 1.50 | 2.00 | 49 | 44 | 10 | 48% | -0.239% |
  | 1.50 | 3.00 | 55 | 29 | 19 | 53% | -0.234% |

#### Discovery / Bear
- Sample size: N=42
- Forward returns: 1b: -0.13% (40% pos, n=42) | 3b: -0.18% (48% pos, n=42) | 6b: +0.10% (57% pos, n=42) | 12b: +0.12% (48% pos, n=42) | 24b: +0.07% (48% pos, n=42)
- MAE/MFE over default hold: avg MAE -2.66% | p95 MAE -0.36% | avg MFE +2.52% | p95 MFE +7.43%
- Best combo: TP 0.75 / Stop 1.50 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 28 | 14 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 22 | 17 | 3 | 52% | -0.191% |
  | 1.00 | 2.00 | 23 | 14 | 5 | 55% | -0.261% |
  | 1.50 | 2.00 | 20 | 17 | 5 | 48% | -0.238% |
  | 1.50 | 3.00 | 21 | 11 | 10 | 50% | -0.262% |

#### Validation / All
- Sample size: N=12
- Forward returns: 1b: +0.26% (75% pos, n=12) | 3b: -0.08% (42% pos, n=12) | 6b: -0.00% (50% pos, n=12) | 12b: -0.36% (42% pos, n=12) | 24b: -2.18% (17% pos, n=12)
- MAE/MFE over default hold: avg MAE -3.50% | p95 MAE -0.09% | avg MFE +1.56% | p95 MFE +2.97%
- Best combo: TP 0.75 / Stop 1.50 | WR 75% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 9 | 3 | 0 | 75% | +0.077% |
  | 1.00 | 1.50 | 7 | 5 | 0 | 58% | -0.152% |
  | 1.00 | 2.00 | 7 | 5 | 0 | 58% | -0.360% |
  | 1.50 | 2.00 | 6 | 6 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 7 | 3 | 2 | 58% | -0.198% |

#### Validation / Bear
- Sample size: N=2
- Forward returns: 1b: +0.35% (100% pos, n=2) | 3b: +0.25% (50% pos, n=2) | 6b: +0.31% (50% pos, n=2) | 12b: -0.54% (50% pos, n=2) | 24b: -4.07% (0% pos, n=2)
- MAE/MFE over default hold: avg MAE -4.21% | p95 MAE -3.81% | avg MFE +1.05% | p95 MFE +1.72%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 1 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 1 | 1 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 1 | 1 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 1 | 1 | 0 | 50% | -0.860% |

#### All Regime
- Sample size: N=115
- Forward returns: 1b: -0.13% (43% pos, n=115) | 3b: -0.23% (50% pos, n=115) | 6b: -0.12% (49% pos, n=115) | 12b: +0.12% (50% pos, n=115) | 24b: -0.06% (51% pos, n=115)
- MAE/MFE over default hold: avg MAE -2.79% | p95 MAE -0.32% | avg MFE +2.65% | p95 MFE +7.44%
- Best combo: TP 0.75 / Stop 1.50 | WR 62% | Expectancy -0.177%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 71 | 41 | 3 | 62% | -0.177% |
  | 1.00 | 1.50 | 59 | 50 | 6 | 51% | -0.244% |
  | 1.00 | 2.00 | 65 | 42 | 8 | 57% | -0.283% |
  | 1.50 | 2.00 | 55 | 50 | 10 | 48% | -0.251% |
  | 1.50 | 3.00 | 62 | 32 | 21 | 54% | -0.230% |

#### Bear Regime
- Sample size: N=44
- Forward returns: 1b: -0.11% (43% pos, n=44) | 3b: -0.16% (48% pos, n=44) | 6b: +0.11% (57% pos, n=44) | 12b: +0.09% (48% pos, n=44) | 24b: -0.12% (45% pos, n=44)
- MAE/MFE over default hold: avg MAE -2.73% | p95 MAE -0.36% | avg MFE +2.45% | p95 MFE +7.43%
- Best combo: TP 0.75 / Stop 1.50 | WR 66% | Expectancy -0.127%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 29 | 15 | 0 | 66% | -0.127% |
  | 1.00 | 1.50 | 23 | 18 | 3 | 52% | -0.199% |
  | 1.00 | 2.00 | 24 | 15 | 5 | 55% | -0.277% |
  | 1.50 | 2.00 | 21 | 18 | 5 | 48% | -0.243% |
  | 1.50 | 3.00 | 22 | 12 | 10 | 50% | -0.289% |

### Signal: SR4 — 5m Spike Rejection + Bear Regime
- Timeframe: 5m
- Logic: SR2 plus last completed 1H bear regime
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=79
- Forward returns: 1b: +0.03% (49% pos, n=79) | 3b: +0.12% (56% pos, n=79) | 6b: +0.13% (57% pos, n=79) | 12b: +0.08% (49% pos, n=79) | 24b: +0.28% (52% pos, n=79)
- MAE/MFE over default hold: avg MAE -2.31% | p95 MAE -0.18% | avg MFE +2.52% | p95 MFE +7.69%
- Best combo: TP 1.50 / Stop 3.00 | WR 56% | Expectancy +0.116%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 49 | 24 | 6 | 62% | -0.140% |
  | 1.00 | 1.50 | 45 | 26 | 8 | 57% | -0.087% |
  | 1.00 | 2.00 | 51 | 18 | 10 | 65% | +0.012% |
  | 1.50 | 2.00 | 40 | 23 | 16 | 51% | +0.013% |
  | 1.50 | 3.00 | 44 | 14 | 21 | 56% | +0.116% |

#### Discovery / Bear
- Sample size: N=79
- Forward returns: 1b: +0.03% (49% pos, n=79) | 3b: +0.12% (56% pos, n=79) | 6b: +0.13% (57% pos, n=79) | 12b: +0.08% (49% pos, n=79) | 24b: +0.28% (52% pos, n=79)
- MAE/MFE over default hold: avg MAE -2.31% | p95 MAE -0.18% | avg MFE +2.52% | p95 MFE +7.69%
- Best combo: TP 1.50 / Stop 3.00 | WR 56% | Expectancy +0.116%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 49 | 24 | 6 | 62% | -0.140% |
  | 1.00 | 1.50 | 45 | 26 | 8 | 57% | -0.087% |
  | 1.00 | 2.00 | 51 | 18 | 10 | 65% | +0.012% |
  | 1.50 | 2.00 | 40 | 23 | 16 | 51% | +0.013% |
  | 1.50 | 3.00 | 44 | 14 | 21 | 56% | +0.116% |

#### Validation / All
- Sample size: N=8
- Forward returns: 1b: +0.27% (75% pos, n=8) | 3b: +0.02% (50% pos, n=8) | 6b: +0.22% (50% pos, n=8) | 12b: +0.19% (38% pos, n=8) | 24b: -0.02% (63% pos, n=8)
- MAE/MFE over default hold: avg MAE -1.51% | p95 MAE -0.08% | avg MFE +1.75% | p95 MFE +4.91%
- Best combo: TP 0.75 / Stop 1.50 | WR 75% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 2 | 0 | 75% | +0.077% |
  | 1.00 | 1.50 | 5 | 3 | 0 | 63% | -0.047% |
  | 1.00 | 2.00 | 5 | 3 | 0 | 63% | -0.235% |
  | 1.50 | 2.00 | 4 | 3 | 1 | 50% | -0.004% |
  | 1.50 | 3.00 | 4 | 1 | 3 | 50% | -0.072% |

#### Validation / Bear
- Sample size: N=8
- Forward returns: 1b: +0.27% (75% pos, n=8) | 3b: +0.02% (50% pos, n=8) | 6b: +0.22% (50% pos, n=8) | 12b: +0.19% (38% pos, n=8) | 24b: -0.02% (63% pos, n=8)
- MAE/MFE over default hold: avg MAE -1.51% | p95 MAE -0.08% | avg MFE +1.75% | p95 MFE +4.91%
- Best combo: TP 0.75 / Stop 1.50 | WR 75% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 2 | 0 | 75% | +0.077% |
  | 1.00 | 1.50 | 5 | 3 | 0 | 63% | -0.047% |
  | 1.00 | 2.00 | 5 | 3 | 0 | 63% | -0.235% |
  | 1.50 | 2.00 | 4 | 3 | 1 | 50% | -0.004% |
  | 1.50 | 3.00 | 4 | 1 | 3 | 50% | -0.072% |

#### All Regime
- Sample size: N=87
- Forward returns: 1b: +0.06% (52% pos, n=87) | 3b: +0.11% (55% pos, n=87) | 6b: +0.14% (56% pos, n=87) | 12b: +0.09% (48% pos, n=87) | 24b: +0.25% (53% pos, n=87)
- MAE/MFE over default hold: avg MAE -2.24% | p95 MAE -0.16% | avg MFE +2.45% | p95 MFE +7.51%
- Best combo: TP 1.50 / Stop 3.00 | WR 55% | Expectancy +0.099%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 55 | 26 | 6 | 63% | -0.120% |
  | 1.00 | 1.50 | 50 | 29 | 8 | 57% | -0.083% |
  | 1.00 | 2.00 | 56 | 21 | 10 | 64% | -0.011% |
  | 1.50 | 2.00 | 44 | 26 | 17 | 51% | +0.012% |
  | 1.50 | 3.00 | 48 | 15 | 24 | 55% | +0.099% |

#### Bear Regime
- Sample size: N=87
- Forward returns: 1b: +0.06% (52% pos, n=87) | 3b: +0.11% (55% pos, n=87) | 6b: +0.14% (56% pos, n=87) | 12b: +0.09% (48% pos, n=87) | 24b: +0.25% (53% pos, n=87)
- MAE/MFE over default hold: avg MAE -2.24% | p95 MAE -0.16% | avg MFE +2.45% | p95 MFE +7.51%
- Best combo: TP 1.50 / Stop 3.00 | WR 55% | Expectancy +0.099%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 55 | 26 | 6 | 63% | -0.120% |
  | 1.00 | 1.50 | 50 | 29 | 8 | 57% | -0.083% |
  | 1.00 | 2.00 | 56 | 21 | 10 | 64% | -0.011% |
  | 1.50 | 2.00 | 44 | 26 | 17 | 51% | +0.012% |
  | 1.50 | 3.00 | 48 | 15 | 24 | 55% | +0.099% |

### Signal: LH1 — Lower High Failure
- Timeframe: 1H
- Logic: Prior 24h support break within 12 bars, >=0.8% bounce, lower-high failure, short first red rejection
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=395
- Forward returns: 1b: -0.04% (47% pos, n=395) | 3b: -0.16% (45% pos, n=395) | 6b: -0.27% (43% pos, n=395) | 12b: -0.39% (45% pos, n=395) | 24b: -0.45% (46% pos, n=395)
- MAE/MFE over default hold: avg MAE -3.78% | p95 MAE -0.40% | avg MFE +3.73% | p95 MFE +10.68%
- Best combo: TP 1.00 / Stop 2.00 | WR 64% | Expectancy -0.169%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 245 | 149 | 1 | 62% | -0.214% |
  | 1.00 | 1.50 | 212 | 182 | 1 | 54% | -0.267% |
  | 1.00 | 2.00 | 253 | 136 | 6 | 64% | -0.169% |
  | 1.50 | 2.00 | 209 | 175 | 11 | 53% | -0.212% |
  | 1.50 | 3.00 | 242 | 129 | 24 | 61% | -0.206% |

#### Discovery / Bear
- Sample size: N=232
- Forward returns: 1b: -0.09% (44% pos, n=232) | 3b: -0.17% (47% pos, n=232) | 6b: -0.30% (45% pos, n=232) | 12b: -0.38% (46% pos, n=232) | 24b: -0.67% (44% pos, n=232)
- MAE/MFE over default hold: avg MAE -3.91% | p95 MAE -0.43% | avg MFE +3.93% | p95 MFE +10.68%
- Best combo: TP 1.50 / Stop 3.00 | WR 66% | Expectancy -0.074%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 144 | 88 | 0 | 62% | -0.213% |
  | 1.00 | 1.50 | 131 | 101 | 0 | 56% | -0.198% |
  | 1.00 | 2.00 | 157 | 75 | 0 | 68% | -0.080% |
  | 1.50 | 2.00 | 133 | 97 | 2 | 57% | -0.088% |
  | 1.50 | 3.00 | 154 | 74 | 4 | 66% | -0.074% |

#### Validation / All
- Sample size: N=99
- Forward returns: 1b: -0.11% (43% pos, n=99) | 3b: -0.10% (48% pos, n=99) | 6b: -0.29% (50% pos, n=98) | 12b: -0.13% (57% pos, n=97) | 24b: -0.23% (57% pos, n=96)
- MAE/MFE over default hold: avg MAE -2.79% | p95 MAE -0.12% | avg MFE +2.49% | p95 MFE +6.71%
- Best combo: TP 1.50 / Stop 2.00 | WR 62% | Expectancy +0.153%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 68 | 31 | 0 | 69% | -0.065% |
  | 1.00 | 1.50 | 61 | 36 | 2 | 62% | -0.056% |
  | 1.00 | 2.00 | 72 | 22 | 5 | 73% | +0.128% |
  | 1.50 | 2.00 | 61 | 31 | 7 | 62% | +0.153% |
  | 1.50 | 3.00 | 62 | 26 | 11 | 63% | -0.025% |

#### Validation / Bear
- Sample size: N=53
- Forward returns: 1b: -0.15% (42% pos, n=53) | 3b: -0.14% (51% pos, n=53) | 6b: -0.03% (46% pos, n=52) | 12b: +0.16% (57% pos, n=51) | 24b: -0.66% (54% pos, n=50)
- MAE/MFE over default hold: avg MAE -2.22% | p95 MAE -0.01% | avg MFE +2.45% | p95 MFE +6.71%
- Best combo: TP 0.75 / Stop 1.50 | WR 70% | Expectancy -0.039%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 37 | 16 | 0 | 70% | -0.039% |
  | 1.00 | 1.50 | 32 | 20 | 1 | 60% | -0.078% |
  | 1.00 | 2.00 | 34 | 15 | 4 | 64% | -0.092% |
  | 1.50 | 2.00 | 28 | 19 | 6 | 53% | -0.075% |
  | 1.50 | 3.00 | 29 | 18 | 6 | 55% | -0.349% |

#### All Regime
- Sample size: N=494
- Forward returns: 1b: -0.06% (46% pos, n=494) | 3b: -0.15% (46% pos, n=494) | 6b: -0.28% (44% pos, n=493) | 12b: -0.34% (47% pos, n=492) | 24b: -0.41% (48% pos, n=491)
- MAE/MFE over default hold: avg MAE -3.58% | p95 MAE -0.36% | avg MFE +3.48% | p95 MFE +9.98%
- Best combo: TP 1.00 / Stop 2.00 | WR 66% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 313 | 180 | 1 | 63% | -0.184% |
  | 1.00 | 1.50 | 273 | 218 | 3 | 55% | -0.225% |
  | 1.00 | 2.00 | 325 | 158 | 11 | 66% | -0.110% |
  | 1.50 | 2.00 | 270 | 206 | 18 | 55% | -0.139% |
  | 1.50 | 3.00 | 304 | 155 | 35 | 62% | -0.170% |

#### Bear Regime
- Sample size: N=285
- Forward returns: 1b: -0.10% (44% pos, n=285) | 3b: -0.17% (47% pos, n=285) | 6b: -0.25% (45% pos, n=284) | 12b: -0.28% (48% pos, n=283) | 24b: -0.66% (46% pos, n=282)
- MAE/MFE over default hold: avg MAE -3.60% | p95 MAE -0.35% | avg MFE +3.65% | p95 MFE +10.05%
- Best combo: TP 1.00 / Stop 2.00 | WR 67% | Expectancy -0.082%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 181 | 104 | 0 | 64% | -0.181% |
  | 1.00 | 1.50 | 163 | 121 | 1 | 57% | -0.176% |
  | 1.00 | 2.00 | 191 | 90 | 4 | 67% | -0.082% |
  | 1.50 | 2.00 | 161 | 116 | 8 | 56% | -0.086% |
  | 1.50 | 3.00 | 183 | 92 | 10 | 64% | -0.125% |

### Signal: LH2 — Lower High Failure + EMA20
- Timeframe: 1H
- Logic: LH1 plus rejection bar closes below EMA20
- Symbol: HYPEUSDT
- Verdict: PROFITABLE

#### Discovery / All
- Sample size: N=369
- Forward returns: 1b: -0.07% (46% pos, n=369) | 3b: -0.29% (42% pos, n=369) | 6b: -0.36% (42% pos, n=369) | 12b: -0.42% (44% pos, n=369) | 24b: -0.52% (46% pos, n=369)
- MAE/MFE over default hold: avg MAE -3.88% | p95 MAE -0.43% | avg MFE +3.69% | p95 MFE +10.68%
- Best combo: TP 1.00 / Stop 2.00 | WR 63% | Expectancy -0.206%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 228 | 140 | 1 | 62% | -0.219% |
  | 1.00 | 1.50 | 192 | 176 | 1 | 52% | -0.308% |
  | 1.00 | 2.00 | 232 | 133 | 4 | 63% | -0.206% |
  | 1.50 | 2.00 | 190 | 170 | 9 | 51% | -0.262% |
  | 1.50 | 3.00 | 223 | 125 | 21 | 60% | -0.252% |

#### Discovery / Bear
- Sample size: N=217
- Forward returns: 1b: -0.16% (43% pos, n=217) | 3b: -0.34% (41% pos, n=217) | 6b: -0.39% (43% pos, n=217) | 12b: -0.43% (45% pos, n=217) | 24b: -0.80% (44% pos, n=217)
- MAE/MFE over default hold: avg MAE -4.06% | p95 MAE -0.43% | avg MFE +3.90% | p95 MFE +10.68%
- Best combo: TP 1.00 / Stop 2.00 | WR 65% | Expectancy -0.161%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 133 | 84 | 0 | 61% | -0.231% |
  | 1.00 | 1.50 | 114 | 103 | 0 | 53% | -0.297% |
  | 1.00 | 2.00 | 141 | 76 | 0 | 65% | -0.161% |
  | 1.50 | 2.00 | 118 | 97 | 2 | 54% | -0.190% |
  | 1.50 | 3.00 | 140 | 74 | 3 | 65% | -0.172% |

#### Validation / All
- Sample size: N=96
- Forward returns: 1b: -0.05% (44% pos, n=96) | 3b: -0.03% (49% pos, n=96) | 6b: -0.23% (51% pos, n=95) | 12b: -0.04% (57% pos, n=94) | 24b: -0.14% (58% pos, n=93)
- MAE/MFE over default hold: avg MAE -2.75% | p95 MAE -0.12% | avg MFE +2.54% | p95 MFE +6.71%
- Best combo: TP 1.50 / Stop 2.00 | WR 63% | Expectancy +0.192%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 66 | 30 | 0 | 69% | -0.063% |
  | 1.00 | 1.50 | 60 | 35 | 1 | 63% | -0.035% |
  | 1.00 | 2.00 | 71 | 20 | 5 | 74% | +0.173% |
  | 1.50 | 2.00 | 60 | 29 | 7 | 63% | +0.192% |
  | 1.50 | 3.00 | 61 | 24 | 11 | 64% | +0.030% |

#### Validation / Bear
- Sample size: N=51
- Forward returns: 1b: -0.05% (43% pos, n=51) | 3b: -0.01% (53% pos, n=51) | 6b: +0.13% (48% pos, n=50) | 12b: +0.35% (59% pos, n=49) | 24b: -0.39% (56% pos, n=48)
- MAE/MFE over default hold: avg MAE -2.09% | p95 MAE -0.01% | avg MFE +2.54% | p95 MFE +6.71%
- Best combo: TP 0.75 / Stop 1.50 | WR 73% | Expectancy +0.022%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 37 | 14 | 0 | 73% | +0.022% |
  | 1.00 | 1.50 | 32 | 18 | 1 | 63% | -0.018% |
  | 1.00 | 2.00 | 34 | 13 | 4 | 67% | -0.013% |
  | 1.50 | 2.00 | 28 | 17 | 6 | 55% | +0.005% |
  | 1.50 | 3.00 | 29 | 16 | 6 | 57% | -0.240% |

#### All Regime
- Sample size: N=465
- Forward returns: 1b: -0.06% (45% pos, n=465) | 3b: -0.24% (44% pos, n=465) | 6b: -0.33% (44% pos, n=464) | 12b: -0.34% (47% pos, n=463) | 24b: -0.44% (48% pos, n=462)
- MAE/MFE over default hold: avg MAE -3.65% | p95 MAE -0.36% | avg MFE +3.45% | p95 MFE +9.96%
- Best combo: TP 1.00 / Stop 2.00 | WR 65% | Expectancy -0.128%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 294 | 170 | 1 | 63% | -0.187% |
  | 1.00 | 1.50 | 252 | 211 | 2 | 54% | -0.252% |
  | 1.00 | 2.00 | 303 | 153 | 9 | 65% | -0.128% |
  | 1.50 | 2.00 | 250 | 199 | 16 | 54% | -0.168% |
  | 1.50 | 3.00 | 284 | 149 | 32 | 61% | -0.193% |

#### Bear Regime
- Sample size: N=268
- Forward returns: 1b: -0.14% (43% pos, n=268) | 3b: -0.27% (44% pos, n=268) | 6b: -0.30% (44% pos, n=267) | 12b: -0.29% (48% pos, n=266) | 24b: -0.73% (46% pos, n=265)
- MAE/MFE over default hold: avg MAE -3.68% | p95 MAE -0.33% | avg MFE +3.64% | p95 MFE +10.41%
- Best combo: TP 1.00 / Stop 2.00 | WR 65% | Expectancy -0.133%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 170 | 98 | 0 | 63% | -0.183% |
  | 1.00 | 1.50 | 146 | 121 | 1 | 54% | -0.244% |
  | 1.00 | 2.00 | 175 | 89 | 4 | 65% | -0.133% |
  | 1.50 | 2.00 | 146 | 114 | 8 | 54% | -0.153% |
  | 1.50 | 3.00 | 169 | 90 | 9 | 63% | -0.185% |

### Signal: LH3 — Support Break Retest Failure
- Timeframe: 1H
- Logic: Close breaks prior 12-bar low, later retests from below within 0.2%, red rejection close
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=189
- Forward returns: 1b: -0.29% (42% pos, n=189) | 3b: -0.52% (39% pos, n=189) | 6b: -0.48% (43% pos, n=189) | 12b: -0.41% (43% pos, n=189) | 24b: -0.38% (48% pos, n=189)
- MAE/MFE over default hold: avg MAE -3.66% | p95 MAE -0.44% | avg MFE +3.24% | p95 MFE +9.57%
- Best combo: TP 0.75 / Stop 1.50 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 126 | 63 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 108 | 81 | 0 | 57% | -0.181% |
  | 1.00 | 2.00 | 118 | 69 | 2 | 62% | -0.216% |
  | 1.50 | 2.00 | 95 | 89 | 5 | 50% | -0.307% |
  | 1.50 | 3.00 | 110 | 65 | 14 | 58% | -0.328% |

#### Discovery / Bear
- Sample size: N=102
- Forward returns: 1b: -0.42% (40% pos, n=102) | 3b: -0.41% (42% pos, n=102) | 6b: -0.31% (48% pos, n=102) | 12b: -0.15% (44% pos, n=102) | 24b: -0.09% (54% pos, n=102)
- MAE/MFE over default hold: avg MAE -3.75% | p95 MAE -0.43% | avg MFE +3.95% | p95 MFE +10.74%
- Best combo: TP 1.00 / Stop 1.50 | WR 62% | Expectancy -0.066%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 70 | 32 | 0 | 69% | -0.066% |
  | 1.00 | 1.50 | 63 | 39 | 0 | 62% | -0.066% |
  | 1.00 | 2.00 | 68 | 34 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 52 | 49 | 1 | 51% | -0.310% |
  | 1.50 | 3.00 | 62 | 36 | 4 | 61% | -0.297% |

#### Validation / All
- Sample size: N=55
- Forward returns: 1b: +0.12% (55% pos, n=55) | 3b: -0.06% (56% pos, n=55) | 6b: -0.06% (53% pos, n=55) | 12b: +0.21% (59% pos, n=54) | 24b: -0.35% (54% pos, n=54)
- MAE/MFE over default hold: avg MAE -2.41% | p95 MAE -0.10% | avg MFE +2.39% | p95 MFE +6.09%
- Best combo: TP 1.50 / Stop 3.00 | WR 62% | Expectancy +0.205%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 41 | 14 | 0 | 75% | +0.067% |
  | 1.00 | 1.50 | 37 | 18 | 0 | 67% | +0.072% |
  | 1.00 | 2.00 | 41 | 14 | 0 | 75% | +0.126% |
  | 1.50 | 2.00 | 30 | 19 | 6 | 55% | +0.047% |
  | 1.50 | 3.00 | 34 | 10 | 11 | 62% | +0.205% |

#### Validation / Bear
- Sample size: N=29
- Forward returns: 1b: -0.07% (41% pos, n=29) | 3b: -0.10% (59% pos, n=29) | 6b: +0.11% (55% pos, n=29) | 12b: +0.33% (57% pos, n=28) | 24b: -0.99% (50% pos, n=28)
- MAE/MFE over default hold: avg MAE -2.36% | p95 MAE -0.10% | avg MFE +2.49% | p95 MFE +6.39%
- Best combo: TP 0.75 / Stop 1.50 | WR 69% | Expectancy -0.058%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 20 | 9 | 0 | 69% | -0.058% |
  | 1.00 | 1.50 | 17 | 12 | 0 | 59% | -0.144% |
  | 1.00 | 2.00 | 19 | 10 | 0 | 66% | -0.144% |
  | 1.50 | 2.00 | 14 | 13 | 2 | 48% | -0.224% |
  | 1.50 | 3.00 | 15 | 7 | 7 | 52% | -0.183% |

#### All Regime
- Sample size: N=244
- Forward returns: 1b: -0.20% (45% pos, n=244) | 3b: -0.42% (43% pos, n=244) | 6b: -0.39% (45% pos, n=244) | 12b: -0.27% (47% pos, n=243) | 24b: -0.37% (49% pos, n=243)
- MAE/MFE over default hold: avg MAE -3.38% | p95 MAE -0.39% | avg MFE +3.05% | p95 MFE +7.74%
- Best combo: TP 0.75 / Stop 1.50 | WR 68% | Expectancy -0.070%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 167 | 77 | 0 | 68% | -0.070% |
  | 1.00 | 1.50 | 145 | 99 | 0 | 59% | -0.124% |
  | 1.00 | 2.00 | 159 | 83 | 2 | 65% | -0.139% |
  | 1.50 | 2.00 | 125 | 108 | 11 | 51% | -0.227% |
  | 1.50 | 3.00 | 144 | 75 | 25 | 59% | -0.208% |

#### Bear Regime
- Sample size: N=131
- Forward returns: 1b: -0.34% (40% pos, n=131) | 3b: -0.34% (46% pos, n=131) | 6b: -0.22% (50% pos, n=131) | 12b: -0.05% (47% pos, n=130) | 24b: -0.29% (53% pos, n=130)
- MAE/MFE over default hold: avg MAE -3.45% | p95 MAE -0.28% | avg MFE +3.62% | p95 MFE +10.68%
- Best combo: TP 0.75 / Stop 1.50 | WR 69% | Expectancy -0.064%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 90 | 41 | 0 | 69% | -0.064% |
  | 1.00 | 1.50 | 80 | 51 | 0 | 61% | -0.083% |
  | 1.00 | 2.00 | 87 | 44 | 0 | 66% | -0.118% |
  | 1.50 | 2.00 | 66 | 62 | 3 | 50% | -0.291% |
  | 1.50 | 3.00 | 77 | 43 | 11 | 59% | -0.271% |

### Signal: LH4 — Lower High + EMA20 + RSI55-75
- Timeframe: 1H
- Logic: LH2 plus 1H RSI in 55-75 range on rejection bar
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### Discovery / Bear
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### Validation / All
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### Validation / Bear
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### All Regime
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

#### Bear Regime
- Sample size: N=0
- Forward returns: 1b: 0.00% (0% pos, n=0) | 3b: 0.00% (0% pos, n=0) | 6b: 0.00% (0% pos, n=0) | 12b: 0.00% (0% pos, n=0) | 24b: 0.00% (0% pos, n=0)
- MAE/MFE over default hold: avg MAE 0.00% | p95 MAE 0.00% | avg MFE 0.00% | p95 MFE 0.00%
- Best combo: TP 0.75 / Stop 1.50 | WR 0% | Expectancy 0.000%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 1.50 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.00 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 2.00 | 0 | 0 | 0 | 0% | 0.000% |
  | 1.50 | 3.00 | 0 | 0 | 0 | 0% | 0.000% |

### Signal: LH5 — Lower High + EMA20 + Low Volume
- Timeframe: 1H
- Logic: LH2 plus rejection bar volume <=1.2x SMA20
- Symbol: HYPEUSDT
- Verdict: PROFITABLE

#### Discovery / All
- Sample size: N=307
- Forward returns: 1b: +0.03% (50% pos, n=307) | 3b: -0.29% (43% pos, n=307) | 6b: -0.36% (42% pos, n=307) | 12b: -0.53% (42% pos, n=307) | 24b: -0.67% (46% pos, n=307)
- MAE/MFE over default hold: avg MAE -3.86% | p95 MAE -0.35% | avg MFE +3.61% | p95 MFE +9.98%
- Best combo: TP 1.00 / Stop 2.00 | WR 67% | Expectancy -0.088%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 205 | 101 | 1 | 67% | -0.106% |
  | 1.00 | 1.50 | 177 | 129 | 1 | 58% | -0.168% |
  | 1.00 | 2.00 | 206 | 99 | 2 | 67% | -0.088% |
  | 1.50 | 2.00 | 174 | 128 | 5 | 57% | -0.101% |
  | 1.50 | 3.00 | 196 | 92 | 19 | 64% | -0.096% |

#### Discovery / Bear
- Sample size: N=182
- Forward returns: 1b: -0.03% (49% pos, n=182) | 3b: -0.42% (40% pos, n=182) | 6b: -0.39% (43% pos, n=182) | 12b: -0.54% (42% pos, n=182) | 24b: -1.01% (43% pos, n=182)
- MAE/MFE over default hold: avg MAE -4.14% | p95 MAE -0.35% | avg MFE +3.81% | p95 MFE +10.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 68% | Expectancy -0.083%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 121 | 61 | 0 | 66% | -0.114% |
  | 1.00 | 1.50 | 107 | 75 | 0 | 59% | -0.140% |
  | 1.00 | 2.00 | 123 | 59 | 0 | 68% | -0.083% |
  | 1.50 | 2.00 | 104 | 76 | 2 | 57% | -0.093% |
  | 1.50 | 3.00 | 119 | 57 | 6 | 65% | -0.092% |

#### Validation / All
- Sample size: N=83
- Forward returns: 1b: +0.02% (46% pos, n=83) | 3b: -0.04% (54% pos, n=83) | 6b: -0.26% (48% pos, n=83) | 12b: -0.17% (48% pos, n=82) | 24b: -0.18% (56% pos, n=82)
- MAE/MFE over default hold: avg MAE -2.65% | p95 MAE -0.17% | avg MFE +2.55% | p95 MFE +5.91%
- Best combo: TP 1.00 / Stop 2.00 | WR 78% | Expectancy +0.306%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 62 | 21 | 0 | 75% | +0.071% |
  | 1.00 | 1.50 | 59 | 23 | 1 | 71% | +0.181% |
  | 1.00 | 2.00 | 65 | 14 | 4 | 78% | +0.306% |
  | 1.50 | 2.00 | 52 | 24 | 7 | 63% | +0.224% |
  | 1.50 | 3.00 | 54 | 17 | 12 | 65% | +0.167% |

#### Validation / Bear
- Sample size: N=45
- Forward returns: 1b: -0.00% (49% pos, n=45) | 3b: +0.13% (60% pos, n=45) | 6b: -0.06% (51% pos, n=45) | 12b: +0.26% (50% pos, n=44) | 24b: -0.70% (50% pos, n=44)
- MAE/MFE over default hold: avg MAE -1.86% | p95 MAE -0.08% | avg MFE +2.48% | p95 MFE +4.55%
- Best combo: TP 1.00 / Stop 2.00 | WR 76% | Expectancy +0.253%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 36 | 9 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 33 | 11 | 1 | 73% | +0.249% |
  | 1.00 | 2.00 | 34 | 8 | 3 | 76% | +0.253% |
  | 1.50 | 2.00 | 26 | 13 | 6 | 58% | +0.147% |
  | 1.50 | 3.00 | 27 | 10 | 8 | 60% | +0.050% |

#### All Regime
- Sample size: N=390
- Forward returns: 1b: +0.02% (49% pos, n=390) | 3b: -0.23% (45% pos, n=390) | 6b: -0.34% (44% pos, n=390) | 12b: -0.46% (43% pos, n=389) | 24b: -0.57% (48% pos, n=389)
- MAE/MFE over default hold: avg MAE -3.60% | p95 MAE -0.34% | avg MFE +3.38% | p95 MFE +8.94%
- Best combo: TP 1.00 / Stop 2.00 | WR 69% | Expectancy -0.004%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 267 | 122 | 1 | 68% | -0.069% |
  | 1.00 | 1.50 | 236 | 152 | 2 | 61% | -0.093% |
  | 1.00 | 2.00 | 271 | 113 | 6 | 69% | -0.004% |
  | 1.50 | 2.00 | 226 | 152 | 12 | 58% | -0.032% |
  | 1.50 | 3.00 | 250 | 109 | 31 | 64% | -0.040% |

#### Bear Regime
- Sample size: N=227
- Forward returns: 1b: -0.03% (49% pos, n=227) | 3b: -0.31% (44% pos, n=227) | 6b: -0.33% (44% pos, n=227) | 12b: -0.38% (43% pos, n=226) | 24b: -0.95% (44% pos, n=226)
- MAE/MFE over default hold: avg MAE -3.69% | p95 MAE -0.26% | avg MFE +3.55% | p95 MFE +9.96%
- Best combo: TP 1.00 / Stop 2.00 | WR 69% | Expectancy -0.016%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 157 | 70 | 0 | 69% | -0.054% |
  | 1.00 | 1.50 | 140 | 86 | 1 | 62% | -0.063% |
  | 1.00 | 2.00 | 157 | 67 | 3 | 69% | -0.016% |
  | 1.50 | 2.00 | 130 | 89 | 8 | 57% | -0.045% |
  | 1.50 | 3.00 | 146 | 67 | 14 | 64% | -0.064% |

### Signal: LH6 — Lower High + EMA20 + Wick
- Timeframe: 1H
- Logic: LH2 plus upper wick >=25% on rejection bar
- Symbol: HYPEUSDT
- Verdict: PROFITABLE

#### Discovery / All
- Sample size: N=262
- Forward returns: 1b: -0.08% (45% pos, n=262) | 3b: -0.25% (43% pos, n=262) | 6b: -0.31% (42% pos, n=262) | 12b: -0.67% (42% pos, n=262) | 24b: -0.74% (47% pos, n=262)
- MAE/MFE over default hold: avg MAE -3.84% | p95 MAE -0.35% | avg MFE +3.55% | p95 MFE +9.96%
- Best combo: TP 1.00 / Stop 2.00 | WR 65% | Expectancy -0.159%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 167 | 94 | 1 | 64% | -0.175% |
  | 1.00 | 1.50 | 142 | 119 | 1 | 54% | -0.254% |
  | 1.00 | 2.00 | 169 | 90 | 3 | 65% | -0.159% |
  | 1.50 | 2.00 | 137 | 120 | 5 | 52% | -0.245% |
  | 1.50 | 3.00 | 164 | 81 | 17 | 63% | -0.161% |

#### Discovery / Bear
- Sample size: N=159
- Forward returns: 1b: -0.02% (44% pos, n=159) | 3b: -0.27% (43% pos, n=159) | 6b: -0.31% (43% pos, n=159) | 12b: -0.58% (44% pos, n=159) | 24b: -0.89% (45% pos, n=159)
- MAE/MFE over default hold: avg MAE -4.03% | p95 MAE -0.26% | avg MFE +3.83% | p95 MFE +10.92%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy -0.027%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 102 | 57 | 0 | 64% | -0.167% |
  | 1.00 | 1.50 | 91 | 68 | 0 | 57% | -0.179% |
  | 1.00 | 2.00 | 106 | 52 | 1 | 67% | -0.100% |
  | 1.50 | 2.00 | 88 | 69 | 2 | 55% | -0.145% |
  | 1.50 | 3.00 | 106 | 47 | 6 | 67% | -0.027% |

#### Validation / All
- Sample size: N=66
- Forward returns: 1b: -0.17% (44% pos, n=66) | 3b: -0.27% (41% pos, n=66) | 6b: -0.44% (44% pos, n=66) | 12b: -0.28% (52% pos, n=66) | 24b: +0.04% (54% pos, n=65)
- MAE/MFE over default hold: avg MAE -3.13% | p95 MAE -0.17% | avg MFE +2.41% | p95 MFE +6.71%
- Best combo: TP 1.50 / Stop 2.00 | WR 61% | Expectancy +0.078%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 42 | 24 | 0 | 64% | -0.178% |
  | 1.00 | 1.50 | 39 | 27 | 0 | 59% | -0.133% |
  | 1.00 | 2.00 | 47 | 16 | 3 | 71% | +0.064% |
  | 1.50 | 2.00 | 40 | 22 | 4 | 61% | +0.078% |
  | 1.50 | 3.00 | 42 | 15 | 9 | 64% | +0.045% |

#### Validation / Bear
- Sample size: N=34
- Forward returns: 1b: -0.10% (38% pos, n=34) | 3b: +0.08% (47% pos, n=34) | 6b: +0.13% (47% pos, n=34) | 12b: +0.31% (59% pos, n=34) | 24b: -0.03% (55% pos, n=33)
- MAE/MFE over default hold: avg MAE -2.10% | p95 MAE -0.13% | avg MFE +2.66% | p95 MFE +7.22%
- Best combo: TP 1.50 / Stop 2.00 | WR 65% | Expectancy +0.192%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 24 | 10 | 0 | 71% | -0.022% |
  | 1.00 | 1.50 | 21 | 13 | 0 | 62% | -0.066% |
  | 1.00 | 2.00 | 25 | 7 | 2 | 74% | +0.133% |
  | 1.50 | 2.00 | 22 | 10 | 2 | 65% | +0.192% |
  | 1.50 | 3.00 | 24 | 8 | 2 | 71% | +0.163% |

#### All Regime
- Sample size: N=328
- Forward returns: 1b: -0.10% (45% pos, n=328) | 3b: -0.26% (43% pos, n=328) | 6b: -0.34% (43% pos, n=328) | 12b: -0.59% (44% pos, n=328) | 24b: -0.59% (48% pos, n=327)
- MAE/MFE over default hold: avg MAE -3.70% | p95 MAE -0.33% | avg MFE +3.32% | p95 MFE +9.27%
- Best combo: TP 1.00 / Stop 2.00 | WR 66% | Expectancy -0.114%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 209 | 118 | 1 | 64% | -0.176% |
  | 1.00 | 1.50 | 181 | 146 | 1 | 55% | -0.230% |
  | 1.00 | 2.00 | 216 | 106 | 6 | 66% | -0.114% |
  | 1.50 | 2.00 | 177 | 142 | 9 | 54% | -0.180% |
  | 1.50 | 3.00 | 206 | 96 | 26 | 63% | -0.120% |

#### Bear Regime
- Sample size: N=193
- Forward returns: 1b: -0.03% (43% pos, n=193) | 3b: -0.21% (44% pos, n=193) | 6b: -0.23% (44% pos, n=193) | 12b: -0.42% (47% pos, n=193) | 24b: -0.74% (47% pos, n=192)
- MAE/MFE over default hold: avg MAE -3.69% | p95 MAE -0.26% | avg MFE +3.63% | p95 MFE +9.96%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy +0.006%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 126 | 67 | 0 | 65% | -0.141% |
  | 1.00 | 1.50 | 112 | 81 | 0 | 58% | -0.159% |
  | 1.00 | 2.00 | 131 | 59 | 3 | 68% | -0.059% |
  | 1.50 | 2.00 | 110 | 79 | 4 | 57% | -0.085% |
  | 1.50 | 3.00 | 130 | 55 | 8 | 67% | +0.006% |

### Signal: PFLH — Delayed Pump Failure + Lower High
- Timeframe: 1H
- Logic: Recent 1H pump >=2.5% in prior 6 bars, no breakout >0.3%, current bar red below EMA20 and still below pump high
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=76
- Forward returns: 1b: -0.43% (41% pos, n=76) | 3b: -0.25% (42% pos, n=76) | 6b: -0.78% (42% pos, n=76) | 12b: -1.09% (39% pos, n=76) | 24b: -3.35% (30% pos, n=76)
- MAE/MFE over default hold: avg MAE -5.86% | p95 MAE -0.39% | avg MFE +5.14% | p95 MFE +12.74%
- Best combo: TP 1.00 / Stop 2.00 | WR 66% | Expectancy -0.136%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 48 | 28 | 0 | 63% | -0.189% |
  | 1.00 | 1.50 | 39 | 37 | 0 | 51% | -0.327% |
  | 1.00 | 2.00 | 50 | 26 | 0 | 66% | -0.136% |
  | 1.50 | 2.00 | 40 | 36 | 0 | 53% | -0.268% |
  | 1.50 | 3.00 | 47 | 29 | 0 | 62% | -0.327% |

#### Discovery / Bear
- Sample size: N=39
- Forward returns: 1b: -0.64% (36% pos, n=39) | 3b: -0.15% (41% pos, n=39) | 6b: -0.68% (49% pos, n=39) | 12b: -0.99% (44% pos, n=39) | 24b: -2.69% (33% pos, n=39)
- MAE/MFE over default hold: avg MAE -5.38% | p95 MAE -0.20% | avg MFE +4.60% | p95 MFE +12.50%
- Best combo: TP 0.75 / Stop 1.50 | WR 67% | Expectancy -0.110%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 26 | 13 | 0 | 67% | -0.110% |
  | 1.00 | 1.50 | 21 | 18 | 0 | 54% | -0.264% |
  | 1.00 | 2.00 | 25 | 14 | 0 | 64% | -0.187% |
  | 1.50 | 2.00 | 19 | 20 | 0 | 49% | -0.405% |
  | 1.50 | 3.00 | 23 | 16 | 0 | 59% | -0.456% |

#### Validation / All
- Sample size: N=8
- Forward returns: 1b: +0.67% (75% pos, n=8) | 3b: +0.26% (75% pos, n=8) | 6b: -1.70% (25% pos, n=8) | 12b: -2.30% (25% pos, n=8) | 24b: -1.36% (50% pos, n=8)
- MAE/MFE over default hold: avg MAE -6.87% | p95 MAE -1.47% | avg MFE +3.01% | p95 MFE +4.99%
- Best combo: TP 1.50 / Stop 2.00 | WR 88% | Expectancy +0.953%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 2 | 0 | 75% | +0.077% |
  | 1.00 | 1.50 | 6 | 2 | 0 | 75% | +0.265% |
  | 1.00 | 2.00 | 8 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 7 | 1 | 0 | 88% | +0.953% |
  | 1.50 | 3.00 | 7 | 1 | 0 | 88% | +0.828% |

#### Validation / Bear
- Sample size: N=2
- Forward returns: 1b: +1.05% (100% pos, n=2) | 3b: +0.78% (100% pos, n=2) | 6b: -0.30% (50% pos, n=2) | 12b: -1.97% (0% pos, n=2) | 24b: -2.28% (50% pos, n=2)
- MAE/MFE over default hold: avg MAE -3.11% | p95 MAE -1.47% | avg MFE +2.29% | p95 MFE +2.45%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 2 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 2 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 2 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 2 | 0 | 0 | 100% | +1.390% |

#### All Regime
- Sample size: N=84
- Forward returns: 1b: -0.33% (44% pos, n=84) | 3b: -0.21% (45% pos, n=84) | 6b: -0.86% (40% pos, n=84) | 12b: -1.20% (38% pos, n=84) | 24b: -3.16% (32% pos, n=84)
- MAE/MFE over default hold: avg MAE -5.95% | p95 MAE -1.02% | avg MFE +4.94% | p95 MFE +12.50%
- Best combo: TP 1.00 / Stop 2.00 | WR 69% | Expectancy -0.039%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 54 | 30 | 0 | 64% | -0.164% |
  | 1.00 | 1.50 | 45 | 39 | 0 | 54% | -0.271% |
  | 1.00 | 2.00 | 58 | 26 | 0 | 69% | -0.039% |
  | 1.50 | 2.00 | 47 | 37 | 0 | 56% | -0.152% |
  | 1.50 | 3.00 | 54 | 30 | 0 | 64% | -0.217% |

#### Bear Regime
- Sample size: N=41
- Forward returns: 1b: -0.56% (39% pos, n=41) | 3b: -0.10% (44% pos, n=41) | 6b: -0.66% (49% pos, n=41) | 12b: -1.04% (41% pos, n=41) | 24b: -2.67% (34% pos, n=41)
- MAE/MFE over default hold: avg MAE -5.27% | p95 MAE -0.39% | avg MFE +4.49% | p95 MFE +12.45%
- Best combo: TP 0.75 / Stop 1.50 | WR 68% | Expectancy -0.073%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 28 | 13 | 0 | 68% | -0.073% |
  | 1.00 | 1.50 | 23 | 18 | 0 | 56% | -0.208% |
  | 1.00 | 2.00 | 27 | 14 | 0 | 66% | -0.134% |
  | 1.50 | 2.00 | 21 | 20 | 0 | 51% | -0.317% |
  | 1.50 | 3.00 | 25 | 16 | 0 | 61% | -0.366% |

### Signal: CS1 — Composite Score >=4
- Timeframe: 1H
- Logic: Composite bear-rally score >=4
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=331
- Forward returns: 1b: -0.01% (50% pos, n=331) | 3b: +0.10% (56% pos, n=331) | 6b: +0.04% (53% pos, n=331) | 12b: -0.02% (51% pos, n=331) | 24b: -0.25% (49% pos, n=331)
- MAE/MFE over default hold: avg MAE -3.48% | p95 MAE -0.27% | avg MFE +3.70% | p95 MFE +10.64%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy +0.203%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 214 | 117 | 0 | 65% | -0.155% |
  | 1.00 | 1.50 | 199 | 132 | 0 | 60% | -0.107% |
  | 1.00 | 2.00 | 226 | 101 | 4 | 68% | -0.036% |
  | 1.50 | 2.00 | 197 | 124 | 10 | 60% | +0.033% |
  | 1.50 | 3.00 | 230 | 74 | 27 | 69% | +0.203% |

#### Discovery / Bear
- Sample size: N=323
- Forward returns: 1b: -0.02% (50% pos, n=323) | 3b: +0.11% (56% pos, n=323) | 6b: +0.03% (53% pos, n=323) | 12b: -0.01% (51% pos, n=323) | 24b: -0.17% (50% pos, n=323)
- MAE/MFE over default hold: avg MAE -3.40% | p95 MAE -0.33% | avg MFE +3.64% | p95 MFE +10.58%
- Best combo: TP 1.50 / Stop 3.00 | WR 69% | Expectancy +0.202%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 209 | 114 | 0 | 65% | -0.154% |
  | 1.00 | 1.50 | 194 | 129 | 0 | 60% | -0.108% |
  | 1.00 | 2.00 | 221 | 98 | 4 | 68% | -0.031% |
  | 1.50 | 2.00 | 192 | 121 | 10 | 59% | +0.032% |
  | 1.50 | 3.00 | 224 | 72 | 27 | 69% | +0.202% |

#### Validation / All
- Sample size: N=75
- Forward returns: 1b: -0.19% (49% pos, n=75) | 3b: -0.17% (45% pos, n=75) | 6b: -0.41% (47% pos, n=75) | 12b: -1.11% (39% pos, n=74) | 24b: -1.52% (42% pos, n=74)
- MAE/MFE over default hold: avg MAE -3.17% | p95 MAE -0.36% | avg MFE +1.99% | p95 MFE +6.13%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.123%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 49 | 25 | 1 | 65% | -0.123% |
  | 1.00 | 1.50 | 41 | 32 | 2 | 55% | -0.222% |
  | 1.00 | 2.00 | 44 | 28 | 3 | 59% | -0.301% |
  | 1.50 | 2.00 | 31 | 34 | 10 | 41% | -0.409% |
  | 1.50 | 3.00 | 34 | 23 | 18 | 45% | -0.462% |

#### Validation / Bear
- Sample size: N=75
- Forward returns: 1b: -0.19% (49% pos, n=75) | 3b: -0.17% (45% pos, n=75) | 6b: -0.41% (47% pos, n=75) | 12b: -1.11% (39% pos, n=74) | 24b: -1.52% (42% pos, n=74)
- MAE/MFE over default hold: avg MAE -3.17% | p95 MAE -0.36% | avg MFE +1.99% | p95 MFE +6.13%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.123%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 49 | 25 | 1 | 65% | -0.123% |
  | 1.00 | 1.50 | 41 | 32 | 2 | 55% | -0.222% |
  | 1.00 | 2.00 | 44 | 28 | 3 | 59% | -0.301% |
  | 1.50 | 2.00 | 31 | 34 | 10 | 41% | -0.409% |
  | 1.50 | 3.00 | 34 | 23 | 18 | 45% | -0.462% |

#### All Regime
- Sample size: N=406
- Forward returns: 1b: -0.04% (50% pos, n=406) | 3b: +0.05% (54% pos, n=406) | 6b: -0.05% (52% pos, n=406) | 12b: -0.22% (49% pos, n=405) | 24b: -0.48% (48% pos, n=405)
- MAE/MFE over default hold: avg MAE -3.42% | p95 MAE -0.33% | avg MFE +3.38% | p95 MFE +10.32%
- Best combo: TP 1.50 / Stop 3.00 | WR 65% | Expectancy +0.080%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 263 | 142 | 1 | 65% | -0.149% |
  | 1.00 | 1.50 | 240 | 164 | 2 | 59% | -0.128% |
  | 1.00 | 2.00 | 270 | 129 | 7 | 67% | -0.085% |
  | 1.50 | 2.00 | 228 | 158 | 20 | 56% | -0.049% |
  | 1.50 | 3.00 | 264 | 97 | 45 | 65% | +0.080% |

#### Bear Regime
- Sample size: N=398
- Forward returns: 1b: -0.05% (50% pos, n=398) | 3b: +0.06% (54% pos, n=398) | 6b: -0.06% (52% pos, n=398) | 12b: -0.21% (49% pos, n=397) | 24b: -0.42% (48% pos, n=397)
- MAE/MFE over default hold: avg MAE -3.35% | p95 MAE -0.33% | avg MFE +3.33% | p95 MFE +10.32%
- Best combo: TP 1.50 / Stop 3.00 | WR 65% | Expectancy +0.077%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 258 | 139 | 1 | 65% | -0.148% |
  | 1.00 | 1.50 | 235 | 161 | 2 | 59% | -0.130% |
  | 1.00 | 2.00 | 265 | 126 | 7 | 67% | -0.082% |
  | 1.50 | 2.00 | 223 | 155 | 20 | 56% | -0.051% |
  | 1.50 | 3.00 | 258 | 95 | 45 | 65% | +0.077% |

### Signal: CS2 — Composite Score >=5
- Timeframe: 1H
- Logic: Composite bear-rally score >=5
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=7
- Forward returns: 1b: +0.70% (71% pos, n=7) | 3b: +0.41% (71% pos, n=7) | 6b: -1.81% (43% pos, n=7) | 12b: -1.68% (43% pos, n=7) | 24b: -4.00% (14% pos, n=7)
- MAE/MFE over default hold: avg MAE -5.57% | p95 MAE -0.02% | avg MFE +4.09% | p95 MFE +10.77%
- Best combo: TP 1.50 / Stop 3.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 1 | 0 | 86% | +0.319% |
  | 1.00 | 1.50 | 5 | 2 | 0 | 71% | +0.176% |
  | 1.00 | 2.00 | 6 | 1 | 0 | 86% | +0.461% |
  | 1.50 | 2.00 | 6 | 1 | 0 | 86% | +0.890% |
  | 1.50 | 3.00 | 7 | 0 | 0 | 100% | +1.390% |

#### Discovery / Bear
- Sample size: N=7
- Forward returns: 1b: +0.70% (71% pos, n=7) | 3b: +0.41% (71% pos, n=7) | 6b: -1.81% (43% pos, n=7) | 12b: -1.68% (43% pos, n=7) | 24b: -4.00% (14% pos, n=7)
- MAE/MFE over default hold: avg MAE -5.57% | p95 MAE -0.02% | avg MFE +4.09% | p95 MFE +10.77%
- Best combo: TP 1.50 / Stop 3.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 1 | 0 | 86% | +0.319% |
  | 1.00 | 1.50 | 5 | 2 | 0 | 71% | +0.176% |
  | 1.00 | 2.00 | 6 | 1 | 0 | 86% | +0.461% |
  | 1.50 | 2.00 | 6 | 1 | 0 | 86% | +0.890% |
  | 1.50 | 3.00 | 7 | 0 | 0 | 100% | +1.390% |

#### Validation / All
- Sample size: N=5
- Forward returns: 1b: +0.64% (100% pos, n=5) | 3b: -0.06% (60% pos, n=5) | 6b: -0.40% (40% pos, n=5) | 12b: -1.01% (20% pos, n=5) | 24b: -0.07% (60% pos, n=5)
- MAE/MFE over default hold: avg MAE -2.53% | p95 MAE -1.66% | avg MFE +1.71% | p95 MFE +2.62%
- Best combo: TP 1.50 / Stop 3.00 | WR 80% | Expectancy +0.490%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 3 | 2 | 0 | 60% | -0.110% |
  | 1.00 | 2.00 | 3 | 2 | 0 | 60% | -0.310% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 4 | 1 | 0 | 80% | +0.490% |

#### Validation / Bear
- Sample size: N=5
- Forward returns: 1b: +0.64% (100% pos, n=5) | 3b: -0.06% (60% pos, n=5) | 6b: -0.40% (40% pos, n=5) | 12b: -1.01% (20% pos, n=5) | 24b: -0.07% (60% pos, n=5)
- MAE/MFE over default hold: avg MAE -2.53% | p95 MAE -1.66% | avg MFE +1.71% | p95 MFE +2.62%
- Best combo: TP 1.50 / Stop 3.00 | WR 80% | Expectancy +0.490%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 1 | 0 | 80% | +0.190% |
  | 1.00 | 1.50 | 3 | 2 | 0 | 60% | -0.110% |
  | 1.00 | 2.00 | 3 | 2 | 0 | 60% | -0.310% |
  | 1.50 | 2.00 | 3 | 2 | 0 | 60% | -0.010% |
  | 1.50 | 3.00 | 4 | 1 | 0 | 80% | +0.490% |

#### All Regime
- Sample size: N=12
- Forward returns: 1b: +0.67% (83% pos, n=12) | 3b: +0.21% (67% pos, n=12) | 6b: -1.22% (42% pos, n=12) | 12b: -1.40% (33% pos, n=12) | 24b: -2.36% (33% pos, n=12)
- MAE/MFE over default hold: avg MAE -4.31% | p95 MAE -0.02% | avg MFE +3.10% | p95 MFE +10.77%
- Best combo: TP 1.50 / Stop 3.00 | WR 92% | Expectancy +1.015%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 2 | 0 | 83% | +0.265% |
  | 1.00 | 1.50 | 8 | 4 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 9 | 3 | 0 | 75% | +0.140% |
  | 1.50 | 2.00 | 9 | 3 | 0 | 75% | +0.515% |
  | 1.50 | 3.00 | 11 | 1 | 0 | 92% | +1.015% |

#### Bear Regime
- Sample size: N=12
- Forward returns: 1b: +0.67% (83% pos, n=12) | 3b: +0.21% (67% pos, n=12) | 6b: -1.22% (42% pos, n=12) | 12b: -1.40% (33% pos, n=12) | 24b: -2.36% (33% pos, n=12)
- MAE/MFE over default hold: avg MAE -4.31% | p95 MAE -0.02% | avg MFE +3.10% | p95 MFE +10.77%
- Best combo: TP 1.50 / Stop 3.00 | WR 92% | Expectancy +1.015%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 2 | 0 | 83% | +0.265% |
  | 1.00 | 1.50 | 8 | 4 | 0 | 67% | +0.057% |
  | 1.00 | 2.00 | 9 | 3 | 0 | 75% | +0.140% |
  | 1.50 | 2.00 | 9 | 3 | 0 | 75% | +0.515% |
  | 1.50 | 3.00 | 11 | 1 | 0 | 92% | +1.015% |

### Signal: CS3 — Composite Score >=4 + Red
- Timeframe: 1H
- Logic: Composite score >=4 and rejection bar closes red
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=222
- Forward returns: 1b: +0.09% (53% pos, n=222) | 3b: +0.08% (55% pos, n=222) | 6b: +0.05% (54% pos, n=222) | 12b: +0.18% (53% pos, n=222) | 24b: +0.06% (52% pos, n=222)
- MAE/MFE over default hold: avg MAE -3.31% | p95 MAE -0.28% | avg MFE +3.46% | p95 MFE +10.41%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.216%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 154 | 68 | 0 | 69% | -0.049% |
  | 1.00 | 1.50 | 136 | 86 | 0 | 61% | -0.078% |
  | 1.00 | 2.00 | 154 | 66 | 2 | 69% | -0.015% |
  | 1.50 | 2.00 | 134 | 84 | 4 | 60% | +0.032% |
  | 1.50 | 3.00 | 156 | 49 | 17 | 70% | +0.216% |

#### Discovery / Bear
- Sample size: N=214
- Forward returns: 1b: +0.07% (53% pos, n=214) | 3b: +0.05% (55% pos, n=214) | 6b: -0.02% (53% pos, n=214) | 12b: +0.26% (53% pos, n=214) | 24b: +0.21% (52% pos, n=214)
- MAE/MFE over default hold: avg MAE -3.19% | p95 MAE -0.28% | avg MFE +3.37% | p95 MFE +10.41%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.193%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 148 | 66 | 0 | 69% | -0.054% |
  | 1.00 | 1.50 | 130 | 84 | 0 | 61% | -0.091% |
  | 1.00 | 2.00 | 148 | 64 | 2 | 69% | -0.021% |
  | 1.50 | 2.00 | 128 | 82 | 4 | 60% | +0.014% |
  | 1.50 | 3.00 | 149 | 48 | 17 | 70% | +0.193% |

#### Validation / All
- Sample size: N=48
- Forward returns: 1b: -0.31% (44% pos, n=48) | 3b: -0.26% (44% pos, n=48) | 6b: -0.78% (42% pos, n=48) | 12b: -1.74% (36% pos, n=47) | 24b: -2.74% (38% pos, n=47)
- MAE/MFE over default hold: avg MAE -3.64% | p95 MAE -0.36% | avg MFE +1.72% | p95 MFE +4.74%
- Best combo: TP 0.75 / Stop 1.50 | WR 56% | Expectancy -0.317%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 27 | 20 | 1 | 56% | -0.317% |
  | 1.00 | 1.50 | 21 | 25 | 2 | 44% | -0.483% |
  | 1.00 | 2.00 | 24 | 20 | 4 | 50% | -0.520% |
  | 1.50 | 2.00 | 18 | 22 | 8 | 38% | -0.503% |
  | 1.50 | 3.00 | 20 | 17 | 11 | 42% | -0.627% |

#### Validation / Bear
- Sample size: N=48
- Forward returns: 1b: -0.31% (44% pos, n=48) | 3b: -0.26% (44% pos, n=48) | 6b: -0.78% (42% pos, n=48) | 12b: -1.74% (36% pos, n=47) | 24b: -2.74% (38% pos, n=47)
- MAE/MFE over default hold: avg MAE -3.64% | p95 MAE -0.36% | avg MFE +1.72% | p95 MFE +4.74%
- Best combo: TP 0.75 / Stop 1.50 | WR 56% | Expectancy -0.317%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 27 | 20 | 1 | 56% | -0.317% |
  | 1.00 | 1.50 | 21 | 25 | 2 | 44% | -0.483% |
  | 1.00 | 2.00 | 24 | 20 | 4 | 50% | -0.520% |
  | 1.50 | 2.00 | 18 | 22 | 8 | 38% | -0.503% |
  | 1.50 | 3.00 | 20 | 17 | 11 | 42% | -0.627% |

#### All Regime
- Sample size: N=270
- Forward returns: 1b: +0.02% (51% pos, n=270) | 3b: +0.02% (53% pos, n=270) | 6b: -0.10% (52% pos, n=270) | 12b: -0.15% (50% pos, n=269) | 24b: -0.43% (49% pos, n=269)
- MAE/MFE over default hold: avg MAE -3.37% | p95 MAE -0.28% | avg MFE +3.15% | p95 MFE +10.35%
- Best combo: TP 1.50 / Stop 3.00 | WR 65% | Expectancy +0.066%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 181 | 88 | 1 | 67% | -0.097% |
  | 1.00 | 1.50 | 157 | 111 | 2 | 58% | -0.150% |
  | 1.00 | 2.00 | 178 | 86 | 6 | 66% | -0.105% |
  | 1.50 | 2.00 | 152 | 106 | 12 | 56% | -0.063% |
  | 1.50 | 3.00 | 176 | 66 | 28 | 65% | +0.066% |

#### Bear Regime
- Sample size: N=262
- Forward returns: 1b: +0.00% (51% pos, n=262) | 3b: -0.01% (53% pos, n=262) | 6b: -0.16% (51% pos, n=262) | 12b: -0.10% (50% pos, n=261) | 24b: -0.32% (50% pos, n=261)
- MAE/MFE over default hold: avg MAE -3.27% | p95 MAE -0.32% | avg MFE +3.07% | p95 MFE +7.67%
- Best combo: TP 1.50 / Stop 3.00 | WR 65% | Expectancy +0.043%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 175 | 86 | 1 | 67% | -0.102% |
  | 1.00 | 1.50 | 151 | 109 | 2 | 58% | -0.163% |
  | 1.00 | 2.00 | 172 | 84 | 6 | 66% | -0.112% |
  | 1.50 | 2.00 | 146 | 104 | 12 | 56% | -0.081% |
  | 1.50 | 3.00 | 169 | 65 | 28 | 65% | +0.043% |

### Signal: BB1 — BB Walk Exhaustion 2-Bar
- Timeframe: 1H
- Logic: Two consecutive closes above upper BB, then close back inside
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=124
- Forward returns: 1b: -0.23% (52% pos, n=124) | 3b: -0.25% (47% pos, n=124) | 6b: +0.03% (48% pos, n=124) | 12b: -0.56% (48% pos, n=124) | 24b: -1.07% (46% pos, n=124)
- MAE/MFE over default hold: avg MAE -4.00% | p95 MAE -0.22% | avg MFE +3.23% | p95 MFE +8.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 65% | Expectancy +0.029%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 75 | 49 | 0 | 60% | -0.249% |
  | 1.00 | 1.50 | 70 | 53 | 1 | 56% | -0.181% |
  | 1.00 | 2.00 | 82 | 40 | 2 | 66% | -0.085% |
  | 1.50 | 2.00 | 69 | 51 | 4 | 56% | -0.094% |
  | 1.50 | 3.00 | 81 | 31 | 12 | 65% | +0.029% |

#### Discovery / Bear
- Sample size: N=53
- Forward returns: 1b: -0.22% (45% pos, n=53) | 3b: -0.43% (42% pos, n=53) | 6b: +0.21% (49% pos, n=53) | 12b: +0.37% (51% pos, n=53) | 24b: +0.08% (49% pos, n=53)
- MAE/MFE over default hold: avg MAE -3.34% | p95 MAE -0.50% | avg MFE +3.49% | p95 MFE +13.45%
- Best combo: TP 1.50 / Stop 3.00 | WR 66% | Expectancy +0.171%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 31 | 22 | 0 | 58% | -0.294% |
  | 1.00 | 1.50 | 31 | 22 | 0 | 58% | -0.148% |
  | 1.00 | 2.00 | 37 | 15 | 1 | 70% | +0.031% |
  | 1.50 | 2.00 | 31 | 20 | 2 | 58% | +0.037% |
  | 1.50 | 3.00 | 35 | 10 | 8 | 66% | +0.171% |

#### Validation / All
- Sample size: N=35
- Forward returns: 1b: -0.50% (34% pos, n=35) | 3b: -0.69% (40% pos, n=35) | 6b: -1.23% (29% pos, n=35) | 12b: -0.77% (46% pos, n=35) | 24b: -0.69% (43% pos, n=35)
- MAE/MFE over default hold: avg MAE -4.23% | p95 MAE -0.31% | avg MFE +2.45% | p95 MFE +7.17%
- Best combo: TP 0.75 / Stop 1.50 | WR 57% | Expectancy -0.324%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 20 | 15 | 0 | 57% | -0.324% |
  | 1.00 | 1.50 | 17 | 18 | 0 | 49% | -0.396% |
  | 1.00 | 2.00 | 20 | 14 | 1 | 57% | -0.366% |
  | 1.50 | 2.00 | 15 | 18 | 2 | 43% | -0.519% |
  | 1.50 | 3.00 | 17 | 10 | 8 | 49% | -0.427% |

#### Validation / Bear
- Sample size: N=18
- Forward returns: 1b: -0.60% (33% pos, n=18) | 3b: -0.62% (33% pos, n=18) | 6b: -1.11% (28% pos, n=18) | 12b: -1.21% (28% pos, n=18) | 24b: -2.72% (22% pos, n=18)
- MAE/MFE over default hold: avg MAE -3.60% | p95 MAE -0.13% | avg MFE +1.83% | p95 MFE +7.17%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.360%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 8 | 0 | 56% | -0.360% |
  | 1.00 | 1.50 | 9 | 9 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 9 | 8 | 1 | 50% | -0.552% |
  | 1.50 | 2.00 | 5 | 12 | 1 | 28% | -1.080% |
  | 1.50 | 3.00 | 6 | 5 | 7 | 33% | -0.818% |

#### All Regime
- Sample size: N=159
- Forward returns: 1b: -0.29% (48% pos, n=159) | 3b: -0.35% (45% pos, n=159) | 6b: -0.25% (43% pos, n=159) | 12b: -0.61% (47% pos, n=159) | 24b: -0.98% (45% pos, n=159)
- MAE/MFE over default hold: avg MAE -4.05% | p95 MAE -0.22% | avg MFE +3.06% | p95 MFE +8.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 62% | Expectancy -0.072%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 95 | 64 | 0 | 60% | -0.266% |
  | 1.00 | 1.50 | 87 | 71 | 1 | 55% | -0.228% |
  | 1.00 | 2.00 | 102 | 54 | 3 | 64% | -0.147% |
  | 1.50 | 2.00 | 84 | 69 | 6 | 53% | -0.188% |
  | 1.50 | 3.00 | 98 | 41 | 20 | 62% | -0.072% |

#### Bear Regime
- Sample size: N=71
- Forward returns: 1b: -0.32% (42% pos, n=71) | 3b: -0.48% (39% pos, n=71) | 6b: -0.12% (44% pos, n=71) | 12b: -0.03% (45% pos, n=71) | 24b: -0.63% (42% pos, n=71)
- MAE/MFE over default hold: avg MAE -3.41% | p95 MAE -0.50% | avg MFE +3.07% | p95 MFE +8.68%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy -0.080%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 41 | 30 | 0 | 58% | -0.311% |
  | 1.00 | 1.50 | 40 | 31 | 0 | 56% | -0.202% |
  | 1.00 | 2.00 | 46 | 23 | 2 | 65% | -0.117% |
  | 1.50 | 2.00 | 36 | 32 | 3 | 51% | -0.246% |
  | 1.50 | 3.00 | 41 | 15 | 15 | 58% | -0.080% |

### Signal: BB2 — BB Walk Exhaustion 3-Bar
- Timeframe: 1H
- Logic: Three consecutive closes above upper BB, then close back inside
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=56
- Forward returns: 1b: -0.54% (45% pos, n=56) | 3b: -0.42% (46% pos, n=56) | 6b: -0.59% (45% pos, n=56) | 12b: -1.41% (45% pos, n=56) | 24b: -1.74% (43% pos, n=56)
- MAE/MFE over default hold: avg MAE -4.79% | p95 MAE -0.22% | avg MFE +2.74% | p95 MFE +6.93%
- Best combo: TP 1.50 / Stop 3.00 | WR 64% | Expectancy -0.095%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 31 | 25 | 0 | 55% | -0.364% |
  | 1.00 | 1.50 | 29 | 27 | 0 | 52% | -0.315% |
  | 1.00 | 2.00 | 35 | 20 | 1 | 63% | -0.191% |
  | 1.50 | 2.00 | 30 | 25 | 1 | 54% | -0.191% |
  | 1.50 | 3.00 | 36 | 17 | 3 | 64% | -0.095% |

#### Discovery / Bear
- Sample size: N=20
- Forward returns: 1b: -0.25% (60% pos, n=20) | 3b: -0.53% (45% pos, n=20) | 6b: -0.63% (45% pos, n=20) | 12b: +0.14% (55% pos, n=20) | 24b: +0.32% (50% pos, n=20)
- MAE/MFE over default hold: avg MAE -3.38% | p95 MAE -0.76% | avg MFE +2.71% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.311%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 11 | 9 | 0 | 55% | -0.372% |
  | 1.00 | 1.50 | 11 | 9 | 0 | 55% | -0.235% |
  | 1.00 | 2.00 | 14 | 5 | 1 | 70% | +0.114% |
  | 1.50 | 2.00 | 12 | 7 | 1 | 60% | +0.114% |
  | 1.50 | 3.00 | 14 | 4 | 2 | 70% | +0.311% |

#### Validation / All
- Sample size: N=19
- Forward returns: 1b: -0.49% (47% pos, n=19) | 3b: -0.78% (37% pos, n=19) | 6b: -1.32% (37% pos, n=19) | 12b: -0.89% (42% pos, n=19) | 24b: -1.83% (26% pos, n=19)
- MAE/MFE over default hold: avg MAE -3.88% | p95 MAE -0.13% | avg MFE +2.34% | p95 MFE +13.24%
- Best combo: TP 1.00 / Stop 2.00 | WR 58% | Expectancy -0.319%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 9 | 0 | 53% | -0.426% |
  | 1.00 | 1.50 | 9 | 10 | 0 | 47% | -0.426% |
  | 1.00 | 2.00 | 11 | 7 | 1 | 58% | -0.319% |
  | 1.50 | 2.00 | 8 | 9 | 2 | 42% | -0.469% |
  | 1.50 | 3.00 | 9 | 6 | 4 | 47% | -0.513% |

#### Validation / Bear
- Sample size: N=11
- Forward returns: 1b: -0.86% (36% pos, n=11) | 3b: -0.97% (27% pos, n=11) | 6b: -1.50% (36% pos, n=11) | 12b: -1.85% (27% pos, n=11) | 24b: -3.48% (18% pos, n=11)
- MAE/MFE over default hold: avg MAE -4.04% | p95 MAE -0.13% | avg MFE +1.66% | p95 MFE +5.85%
- Best combo: TP 1.00 / Stop 1.50 | WR 45% | Expectancy -0.474%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 5 | 6 | 0 | 45% | -0.587% |
  | 1.00 | 1.50 | 5 | 6 | 0 | 45% | -0.474% |
  | 1.00 | 2.00 | 5 | 5 | 1 | 45% | -0.652% |
  | 1.50 | 2.00 | 3 | 7 | 1 | 27% | -1.061% |
  | 1.50 | 3.00 | 4 | 4 | 3 | 36% | -0.956% |

#### All Regime
- Sample size: N=75
- Forward returns: 1b: -0.52% (45% pos, n=75) | 3b: -0.51% (44% pos, n=75) | 6b: -0.78% (43% pos, n=75) | 12b: -1.28% (44% pos, n=75) | 24b: -1.77% (39% pos, n=75)
- MAE/MFE over default hold: avg MAE -4.56% | p95 MAE -0.22% | avg MFE +2.64% | p95 MFE +6.93%
- Best combo: TP 1.50 / Stop 3.00 | WR 60% | Expectancy -0.201%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 41 | 34 | 0 | 55% | -0.380% |
  | 1.00 | 1.50 | 38 | 37 | 0 | 51% | -0.343% |
  | 1.00 | 2.00 | 46 | 27 | 2 | 61% | -0.223% |
  | 1.50 | 2.00 | 38 | 34 | 3 | 51% | -0.261% |
  | 1.50 | 3.00 | 45 | 23 | 7 | 60% | -0.201% |

#### Bear Regime
- Sample size: N=31
- Forward returns: 1b: -0.47% (52% pos, n=31) | 3b: -0.69% (39% pos, n=31) | 6b: -0.94% (42% pos, n=31) | 12b: -0.56% (45% pos, n=31) | 24b: -1.03% (39% pos, n=31)
- MAE/MFE over default hold: avg MAE -3.61% | p95 MAE -0.76% | avg MFE +2.34% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy -0.138%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 16 | 15 | 0 | 52% | -0.449% |
  | 1.00 | 1.50 | 16 | 15 | 0 | 52% | -0.320% |
  | 1.00 | 2.00 | 19 | 10 | 2 | 61% | -0.158% |
  | 1.50 | 2.00 | 15 | 14 | 2 | 48% | -0.303% |
  | 1.50 | 3.00 | 18 | 8 | 5 | 58% | -0.138% |

### Signal: BB3 — BB Walk Exhaustion 3-Bar + Bear
- Timeframe: 1H
- Logic: BB2 plus bear regime
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=20
- Forward returns: 1b: -0.25% (60% pos, n=20) | 3b: -0.53% (45% pos, n=20) | 6b: -0.63% (45% pos, n=20) | 12b: +0.14% (55% pos, n=20) | 24b: +0.32% (50% pos, n=20)
- MAE/MFE over default hold: avg MAE -3.38% | p95 MAE -0.76% | avg MFE +2.71% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.311%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 11 | 9 | 0 | 55% | -0.372% |
  | 1.00 | 1.50 | 11 | 9 | 0 | 55% | -0.235% |
  | 1.00 | 2.00 | 14 | 5 | 1 | 70% | +0.114% |
  | 1.50 | 2.00 | 12 | 7 | 1 | 60% | +0.114% |
  | 1.50 | 3.00 | 14 | 4 | 2 | 70% | +0.311% |

#### Discovery / Bear
- Sample size: N=20
- Forward returns: 1b: -0.25% (60% pos, n=20) | 3b: -0.53% (45% pos, n=20) | 6b: -0.63% (45% pos, n=20) | 12b: +0.14% (55% pos, n=20) | 24b: +0.32% (50% pos, n=20)
- MAE/MFE over default hold: avg MAE -3.38% | p95 MAE -0.76% | avg MFE +2.71% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 70% | Expectancy +0.311%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 11 | 9 | 0 | 55% | -0.372% |
  | 1.00 | 1.50 | 11 | 9 | 0 | 55% | -0.235% |
  | 1.00 | 2.00 | 14 | 5 | 1 | 70% | +0.114% |
  | 1.50 | 2.00 | 12 | 7 | 1 | 60% | +0.114% |
  | 1.50 | 3.00 | 14 | 4 | 2 | 70% | +0.311% |

#### Validation / All
- Sample size: N=11
- Forward returns: 1b: -0.86% (36% pos, n=11) | 3b: -0.97% (27% pos, n=11) | 6b: -1.50% (36% pos, n=11) | 12b: -1.85% (27% pos, n=11) | 24b: -3.48% (18% pos, n=11)
- MAE/MFE over default hold: avg MAE -4.04% | p95 MAE -0.13% | avg MFE +1.66% | p95 MFE +5.85%
- Best combo: TP 1.00 / Stop 1.50 | WR 45% | Expectancy -0.474%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 5 | 6 | 0 | 45% | -0.587% |
  | 1.00 | 1.50 | 5 | 6 | 0 | 45% | -0.474% |
  | 1.00 | 2.00 | 5 | 5 | 1 | 45% | -0.652% |
  | 1.50 | 2.00 | 3 | 7 | 1 | 27% | -1.061% |
  | 1.50 | 3.00 | 4 | 4 | 3 | 36% | -0.956% |

#### Validation / Bear
- Sample size: N=11
- Forward returns: 1b: -0.86% (36% pos, n=11) | 3b: -0.97% (27% pos, n=11) | 6b: -1.50% (36% pos, n=11) | 12b: -1.85% (27% pos, n=11) | 24b: -3.48% (18% pos, n=11)
- MAE/MFE over default hold: avg MAE -4.04% | p95 MAE -0.13% | avg MFE +1.66% | p95 MFE +5.85%
- Best combo: TP 1.00 / Stop 1.50 | WR 45% | Expectancy -0.474%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 5 | 6 | 0 | 45% | -0.587% |
  | 1.00 | 1.50 | 5 | 6 | 0 | 45% | -0.474% |
  | 1.00 | 2.00 | 5 | 5 | 1 | 45% | -0.652% |
  | 1.50 | 2.00 | 3 | 7 | 1 | 27% | -1.061% |
  | 1.50 | 3.00 | 4 | 4 | 3 | 36% | -0.956% |

#### All Regime
- Sample size: N=31
- Forward returns: 1b: -0.47% (52% pos, n=31) | 3b: -0.69% (39% pos, n=31) | 6b: -0.94% (42% pos, n=31) | 12b: -0.56% (45% pos, n=31) | 24b: -1.03% (39% pos, n=31)
- MAE/MFE over default hold: avg MAE -3.61% | p95 MAE -0.76% | avg MFE +2.34% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy -0.138%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 16 | 15 | 0 | 52% | -0.449% |
  | 1.00 | 1.50 | 16 | 15 | 0 | 52% | -0.320% |
  | 1.00 | 2.00 | 19 | 10 | 2 | 61% | -0.158% |
  | 1.50 | 2.00 | 15 | 14 | 2 | 48% | -0.303% |
  | 1.50 | 3.00 | 18 | 8 | 5 | 58% | -0.138% |

#### Bear Regime
- Sample size: N=31
- Forward returns: 1b: -0.47% (52% pos, n=31) | 3b: -0.69% (39% pos, n=31) | 6b: -0.94% (42% pos, n=31) | 12b: -0.56% (45% pos, n=31) | 24b: -1.03% (39% pos, n=31)
- MAE/MFE over default hold: avg MAE -3.61% | p95 MAE -0.76% | avg MFE +2.34% | p95 MFE +5.72%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy -0.138%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 16 | 15 | 0 | 52% | -0.449% |
  | 1.00 | 1.50 | 16 | 15 | 0 | 52% | -0.320% |
  | 1.00 | 2.00 | 19 | 10 | 2 | 61% | -0.158% |
  | 1.50 | 2.00 | 15 | 14 | 2 | 48% | -0.303% |
  | 1.50 | 3.00 | 18 | 8 | 5 | 58% | -0.138% |

### Signal: VW1 — VWAP Rejection From Below
- Timeframe: 1H
- Logic: Bear regime, rally into session VWAP within 0.25%, red close below VWAP
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=173
- Forward returns: 1b: +0.13% (53% pos, n=173) | 3b: -0.07% (50% pos, n=173) | 6b: -0.08% (48% pos, n=173) | 12b: -0.12% (49% pos, n=173) | 24b: -0.48% (47% pos, n=173)
- MAE/MFE over default hold: avg MAE -3.46% | p95 MAE -0.12% | avg MFE +3.50% | p95 MFE +10.03%
- Best combo: TP 1.00 / Stop 1.50 | WR 60% | Expectancy -0.122%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 112 | 61 | 0 | 65% | -0.153% |
  | 1.00 | 1.50 | 103 | 70 | 0 | 60% | -0.122% |
  | 1.00 | 2.00 | 112 | 60 | 1 | 65% | -0.157% |
  | 1.50 | 2.00 | 96 | 75 | 2 | 55% | -0.155% |
  | 1.50 | 3.00 | 104 | 56 | 13 | 60% | -0.241% |

#### Discovery / Bear
- Sample size: N=173
- Forward returns: 1b: +0.13% (53% pos, n=173) | 3b: -0.07% (50% pos, n=173) | 6b: -0.08% (48% pos, n=173) | 12b: -0.12% (49% pos, n=173) | 24b: -0.48% (47% pos, n=173)
- MAE/MFE over default hold: avg MAE -3.46% | p95 MAE -0.12% | avg MFE +3.50% | p95 MFE +10.03%
- Best combo: TP 1.00 / Stop 1.50 | WR 60% | Expectancy -0.122%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 112 | 61 | 0 | 65% | -0.153% |
  | 1.00 | 1.50 | 103 | 70 | 0 | 60% | -0.122% |
  | 1.00 | 2.00 | 112 | 60 | 1 | 65% | -0.157% |
  | 1.50 | 2.00 | 96 | 75 | 2 | 55% | -0.155% |
  | 1.50 | 3.00 | 104 | 56 | 13 | 60% | -0.241% |

#### Validation / All
- Sample size: N=48
- Forward returns: 1b: -0.15% (48% pos, n=48) | 3b: -0.16% (46% pos, n=48) | 6b: +0.02% (49% pos, n=47) | 12b: -0.54% (40% pos, n=47) | 24b: -0.66% (41% pos, n=46)
- MAE/MFE over default hold: avg MAE -2.66% | p95 MAE -0.34% | avg MFE +2.12% | p95 MFE +6.09%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.136%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 31 | 16 | 1 | 65% | -0.136% |
  | 1.00 | 1.50 | 24 | 22 | 2 | 50% | -0.299% |
  | 1.00 | 2.00 | 24 | 21 | 3 | 50% | -0.519% |
  | 1.50 | 2.00 | 18 | 25 | 5 | 38% | -0.612% |
  | 1.50 | 3.00 | 23 | 15 | 10 | 48% | -0.443% |

#### Validation / Bear
- Sample size: N=48
- Forward returns: 1b: -0.15% (48% pos, n=48) | 3b: -0.16% (46% pos, n=48) | 6b: +0.02% (49% pos, n=47) | 12b: -0.54% (40% pos, n=47) | 24b: -0.66% (41% pos, n=46)
- MAE/MFE over default hold: avg MAE -2.66% | p95 MAE -0.34% | avg MFE +2.12% | p95 MFE +6.09%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.136%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 31 | 16 | 1 | 65% | -0.136% |
  | 1.00 | 1.50 | 24 | 22 | 2 | 50% | -0.299% |
  | 1.00 | 2.00 | 24 | 21 | 3 | 50% | -0.519% |
  | 1.50 | 2.00 | 18 | 25 | 5 | 38% | -0.612% |
  | 1.50 | 3.00 | 23 | 15 | 10 | 48% | -0.443% |

#### All Regime
- Sample size: N=221
- Forward returns: 1b: +0.07% (52% pos, n=221) | 3b: -0.09% (49% pos, n=221) | 6b: -0.06% (48% pos, n=220) | 12b: -0.21% (47% pos, n=220) | 24b: -0.52% (46% pos, n=219)
- MAE/MFE over default hold: avg MAE -3.29% | p95 MAE -0.20% | avg MFE +3.20% | p95 MFE +9.54%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.150%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 143 | 77 | 1 | 65% | -0.150% |
  | 1.00 | 1.50 | 127 | 92 | 2 | 57% | -0.160% |
  | 1.00 | 2.00 | 136 | 81 | 4 | 62% | -0.236% |
  | 1.50 | 2.00 | 114 | 100 | 7 | 52% | -0.255% |
  | 1.50 | 3.00 | 127 | 71 | 23 | 57% | -0.285% |

#### Bear Regime
- Sample size: N=221
- Forward returns: 1b: +0.07% (52% pos, n=221) | 3b: -0.09% (49% pos, n=221) | 6b: -0.06% (48% pos, n=220) | 12b: -0.21% (47% pos, n=220) | 24b: -0.52% (46% pos, n=219)
- MAE/MFE over default hold: avg MAE -3.29% | p95 MAE -0.20% | avg MFE +3.20% | p95 MFE +9.54%
- Best combo: TP 0.75 / Stop 1.50 | WR 65% | Expectancy -0.150%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 143 | 77 | 1 | 65% | -0.150% |
  | 1.00 | 1.50 | 127 | 92 | 2 | 57% | -0.160% |
  | 1.00 | 2.00 | 136 | 81 | 4 | 62% | -0.236% |
  | 1.50 | 2.00 | 114 | 100 | 7 | 52% | -0.255% |
  | 1.50 | 3.00 | 127 | 71 | 23 | 57% | -0.285% |

### Signal: VW2 — VWAP Intrabar Reclaim Failure
- Timeframe: 1H
- Logic: Bear regime, bar trades above VWAP intrabar, closes back below, upper wick >=25%
- Symbol: HYPEUSDT
- Verdict: USELESS

#### Discovery / All
- Sample size: N=315
- Forward returns: 1b: -0.09% (47% pos, n=315) | 3b: -0.31% (45% pos, n=315) | 6b: -0.36% (48% pos, n=315) | 12b: -0.56% (44% pos, n=315) | 24b: -0.59% (44% pos, n=315)
- MAE/MFE over default hold: avg MAE -3.91% | p95 MAE -0.36% | avg MFE +3.50% | p95 MFE +9.88%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.157%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 195 | 120 | 0 | 62% | -0.217% |
  | 1.00 | 1.50 | 173 | 142 | 0 | 55% | -0.237% |
  | 1.00 | 2.00 | 195 | 117 | 3 | 62% | -0.239% |
  | 1.50 | 2.00 | 173 | 137 | 5 | 55% | -0.162% |
  | 1.50 | 3.00 | 200 | 100 | 15 | 63% | -0.157% |

#### Discovery / Bear
- Sample size: N=315
- Forward returns: 1b: -0.09% (47% pos, n=315) | 3b: -0.31% (45% pos, n=315) | 6b: -0.36% (48% pos, n=315) | 12b: -0.56% (44% pos, n=315) | 24b: -0.59% (44% pos, n=315)
- MAE/MFE over default hold: avg MAE -3.91% | p95 MAE -0.36% | avg MFE +3.50% | p95 MFE +9.88%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.157%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 195 | 120 | 0 | 62% | -0.217% |
  | 1.00 | 1.50 | 173 | 142 | 0 | 55% | -0.237% |
  | 1.00 | 2.00 | 195 | 117 | 3 | 62% | -0.239% |
  | 1.50 | 2.00 | 173 | 137 | 5 | 55% | -0.162% |
  | 1.50 | 3.00 | 200 | 100 | 15 | 63% | -0.157% |

#### Validation / All
- Sample size: N=53
- Forward returns: 1b: -0.11% (47% pos, n=53) | 3b: -0.29% (45% pos, n=53) | 6b: -0.19% (45% pos, n=53) | 12b: -0.60% (43% pos, n=53) | 24b: -1.45% (35% pos, n=51)
- MAE/MFE over default hold: avg MAE -2.83% | p95 MAE -0.36% | avg MFE +2.15% | p95 MFE +7.14%
- Best combo: TP 0.75 / Stop 1.50 | WR 68% | Expectancy -0.054%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 36 | 16 | 1 | 68% | -0.054% |
  | 1.00 | 1.50 | 32 | 20 | 1 | 60% | -0.073% |
  | 1.00 | 2.00 | 34 | 16 | 3 | 64% | -0.120% |
  | 1.50 | 2.00 | 24 | 24 | 5 | 45% | -0.386% |
  | 1.50 | 3.00 | 26 | 19 | 8 | 49% | -0.602% |

#### Validation / Bear
- Sample size: N=53
- Forward returns: 1b: -0.11% (47% pos, n=53) | 3b: -0.29% (45% pos, n=53) | 6b: -0.19% (45% pos, n=53) | 12b: -0.60% (43% pos, n=53) | 24b: -1.45% (35% pos, n=51)
- MAE/MFE over default hold: avg MAE -2.83% | p95 MAE -0.36% | avg MFE +2.15% | p95 MFE +7.14%
- Best combo: TP 0.75 / Stop 1.50 | WR 68% | Expectancy -0.054%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 36 | 16 | 1 | 68% | -0.054% |
  | 1.00 | 1.50 | 32 | 20 | 1 | 60% | -0.073% |
  | 1.00 | 2.00 | 34 | 16 | 3 | 64% | -0.120% |
  | 1.50 | 2.00 | 24 | 24 | 5 | 45% | -0.386% |
  | 1.50 | 3.00 | 26 | 19 | 8 | 49% | -0.602% |

#### All Regime
- Sample size: N=368
- Forward returns: 1b: -0.09% (47% pos, n=368) | 3b: -0.31% (45% pos, n=368) | 6b: -0.34% (48% pos, n=368) | 12b: -0.57% (44% pos, n=368) | 24b: -0.71% (43% pos, n=366)
- MAE/MFE over default hold: avg MAE -3.75% | p95 MAE -0.36% | avg MFE +3.30% | p95 MFE +9.20%
- Best combo: TP 0.75 / Stop 1.50 | WR 63% | Expectancy -0.194%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 231 | 136 | 1 | 63% | -0.194% |
  | 1.00 | 1.50 | 205 | 162 | 1 | 56% | -0.213% |
  | 1.00 | 2.00 | 229 | 133 | 6 | 62% | -0.221% |
  | 1.50 | 2.00 | 197 | 161 | 10 | 54% | -0.194% |
  | 1.50 | 3.00 | 226 | 119 | 23 | 61% | -0.221% |

#### Bear Regime
- Sample size: N=368
- Forward returns: 1b: -0.09% (47% pos, n=368) | 3b: -0.31% (45% pos, n=368) | 6b: -0.34% (48% pos, n=368) | 12b: -0.57% (44% pos, n=368) | 24b: -0.71% (43% pos, n=366)
- MAE/MFE over default hold: avg MAE -3.75% | p95 MAE -0.36% | avg MFE +3.30% | p95 MFE +9.20%
- Best combo: TP 0.75 / Stop 1.50 | WR 63% | Expectancy -0.194%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 231 | 136 | 1 | 63% | -0.194% |
  | 1.00 | 1.50 | 205 | 162 | 1 | 56% | -0.213% |
  | 1.00 | 2.00 | 229 | 133 | 6 | 62% | -0.221% |
  | 1.50 | 2.00 | 197 | 161 | 10 | 54% | -0.194% |
  | 1.50 | 3.00 | 226 | 119 | 23 | 61% | -0.221% |

### Signal: VW3 — VWAP Intrabar Reclaim Failure (All Regimes)
- Timeframe: 1H
- Logic: Bar trades above VWAP intrabar, closes back below, upper wick >=25%
- Symbol: HYPEUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=607
- Forward returns: 1b: -0.11% (47% pos, n=607) | 3b: -0.30% (47% pos, n=607) | 6b: -0.37% (48% pos, n=607) | 12b: -0.62% (46% pos, n=607) | 24b: -0.73% (48% pos, n=607)
- MAE/MFE over default hold: avg MAE -4.01% | p95 MAE -0.32% | avg MFE +3.52% | p95 MFE +9.71%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.143%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 382 | 224 | 1 | 63% | -0.191% |
  | 1.00 | 1.50 | 344 | 261 | 2 | 57% | -0.188% |
  | 1.00 | 2.00 | 385 | 213 | 9 | 63% | -0.181% |
  | 1.50 | 2.00 | 328 | 266 | 13 | 54% | -0.181% |
  | 1.50 | 3.00 | 383 | 187 | 37 | 63% | -0.143% |

#### Discovery / Bear
- Sample size: N=313
- Forward returns: 1b: -0.09% (46% pos, n=313) | 3b: -0.30% (46% pos, n=313) | 6b: -0.34% (48% pos, n=313) | 12b: -0.53% (44% pos, n=313) | 24b: -0.52% (44% pos, n=313)
- MAE/MFE over default hold: avg MAE -3.88% | p95 MAE -0.36% | avg MFE +3.50% | p95 MFE +9.88%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy -0.173%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 193 | 120 | 0 | 62% | -0.223% |
  | 1.00 | 1.50 | 171 | 142 | 0 | 55% | -0.244% |
  | 1.00 | 2.00 | 192 | 117 | 4 | 61% | -0.250% |
  | 1.50 | 2.00 | 170 | 137 | 6 | 54% | -0.178% |
  | 1.50 | 3.00 | 197 | 100 | 16 | 63% | -0.173% |

#### Validation / All
- Sample size: N=126
- Forward returns: 1b: +0.01% (54% pos, n=126) | 3b: -0.11% (52% pos, n=126) | 6b: -0.28% (48% pos, n=126) | 12b: -0.20% (48% pos, n=126) | 24b: -0.53% (49% pos, n=124)
- MAE/MFE over default hold: avg MAE -2.94% | p95 MAE -0.35% | avg MFE +2.56% | p95 MFE +7.14%
- Best combo: TP 1.00 / Stop 2.00 | WR 74% | Expectancy +0.123%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 93 | 32 | 1 | 74% | +0.062% |
  | 1.00 | 1.50 | 84 | 41 | 1 | 67% | +0.068% |
  | 1.00 | 2.00 | 93 | 31 | 2 | 74% | +0.123% |
  | 1.50 | 2.00 | 75 | 46 | 5 | 60% | +0.039% |
  | 1.50 | 3.00 | 79 | 35 | 12 | 63% | -0.085% |

#### Validation / Bear
- Sample size: N=52
- Forward returns: 1b: -0.12% (46% pos, n=52) | 3b: -0.31% (44% pos, n=52) | 6b: -0.15% (46% pos, n=52) | 12b: -0.62% (44% pos, n=52) | 24b: -1.45% (36% pos, n=50)
- MAE/MFE over default hold: avg MAE -2.87% | p95 MAE -0.36% | avg MFE +2.18% | p95 MFE +7.14%
- Best combo: TP 0.75 / Stop 1.50 | WR 69% | Expectancy -0.024%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 36 | 15 | 1 | 69% | -0.024% |
  | 1.00 | 1.50 | 32 | 19 | 1 | 62% | -0.043% |
  | 1.00 | 2.00 | 34 | 16 | 2 | 65% | -0.102% |
  | 1.50 | 2.00 | 24 | 24 | 4 | 46% | -0.373% |
  | 1.50 | 3.00 | 26 | 20 | 6 | 50% | -0.622% |

#### All Regime
- Sample size: N=733
- Forward returns: 1b: -0.09% (48% pos, n=733) | 3b: -0.27% (48% pos, n=733) | 6b: -0.35% (48% pos, n=733) | 12b: -0.55% (47% pos, n=733) | 24b: -0.69% (48% pos, n=731)
- MAE/MFE over default hold: avg MAE -3.82% | p95 MAE -0.32% | avg MFE +3.36% | p95 MFE +9.26%
- Best combo: TP 1.00 / Stop 2.00 | WR 65% | Expectancy -0.129%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 475 | 256 | 2 | 65% | -0.148% |
  | 1.00 | 1.50 | 428 | 302 | 3 | 58% | -0.144% |
  | 1.00 | 2.00 | 478 | 244 | 11 | 65% | -0.129% |
  | 1.50 | 2.00 | 403 | 312 | 18 | 55% | -0.143% |
  | 1.50 | 3.00 | 462 | 222 | 49 | 63% | -0.133% |

#### Bear Regime
- Sample size: N=365
- Forward returns: 1b: -0.10% (46% pos, n=365) | 3b: -0.30% (45% pos, n=365) | 6b: -0.31% (48% pos, n=365) | 12b: -0.54% (44% pos, n=365) | 24b: -0.65% (43% pos, n=363)
- MAE/MFE over default hold: avg MAE -3.73% | p95 MAE -0.36% | avg MFE +3.31% | p95 MFE +9.20%
- Best combo: TP 0.75 / Stop 1.50 | WR 63% | Expectancy -0.194%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 229 | 135 | 1 | 63% | -0.194% |
  | 1.00 | 1.50 | 203 | 161 | 1 | 56% | -0.216% |
  | 1.00 | 2.00 | 226 | 133 | 6 | 62% | -0.229% |
  | 1.50 | 2.00 | 194 | 161 | 10 | 53% | -0.206% |
  | 1.50 | 3.00 | 223 | 120 | 22 | 61% | -0.237% |


## BTC Falsifier

Top HYPE variants retested on BTC: PF1, PF0, PF1A, LH5, CS2

| ID | Signal | Val N (Bear) | Best Val Exp | Best Val WR | Verdict |
|---|---|---|---|---|---|
| PF1 | Bear-Regime Pump Failure 2.5% | 1 | +1.390% | 100% | MARGINAL |
| PF1A | Pump Failure 2.5% Tight Delay | 1 | +1.390% | 100% | MARGINAL |
| PF0 | Bear-Regime Pump Failure 2.0% | 3 | +0.640% | 100% | MARGINAL |
| LH5 | Lower High + EMA20 + Low Volume | 47 | +0.015% | 51% | PROFITABLE |
| CS2 | Composite Score >=5 | 3 | -0.045% | 33% | MARGINAL |

## BTC Detailed Blocks

### Signal: PF1 — Bear-Regime Pump Failure 2.5%
- Timeframe: 1H
- Logic: 1H green body >=2.5%, next 1-3 bars fail to make new high >0.3%, short first red confirmation
- Symbol: BTCUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=11
- Forward returns: 1b: +0.10% (64% pos, n=11) | 3b: -0.31% (27% pos, n=11) | 6b: -0.27% (18% pos, n=11) | 12b: -0.47% (36% pos, n=11) | 24b: +1.03% (55% pos, n=11)
- MAE/MFE over default hold: avg MAE -2.26% | p95 MAE -0.36% | avg MFE +1.91% | p95 MFE +6.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 55% | Expectancy -0.251%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 3 | 8 | 0 | 27% | -0.996% |
  | 1.00 | 1.50 | 3 | 8 | 0 | 27% | -0.928% |
  | 1.00 | 2.00 | 4 | 7 | 0 | 36% | -1.019% |
  | 1.50 | 2.00 | 4 | 7 | 0 | 36% | -0.837% |
  | 1.50 | 3.00 | 6 | 2 | 3 | 55% | -0.251% |

#### Discovery / Bear
- Sample size: N=3
- Forward returns: 1b: -0.16% (33% pos, n=3) | 3b: -0.14% (33% pos, n=3) | 6b: +0.41% (33% pos, n=3) | 12b: +0.64% (67% pos, n=3) | 24b: +1.05% (67% pos, n=3)
- MAE/MFE over default hold: avg MAE -1.81% | p95 MAE -0.36% | avg MFE +1.65% | p95 MFE +2.96%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy +0.471%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 2 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 1 | 2 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 1 | 2 | 0 | 33% | -1.110% |
  | 1.50 | 2.00 | 1 | 2 | 0 | 33% | -0.943% |
  | 1.50 | 3.00 | 2 | 0 | 1 | 67% | +0.471% |

#### Validation / All
- Sample size: N=1
- Forward returns: 1b: +0.73% (100% pos, n=1) | 3b: +1.50% (100% pos, n=1) | 6b: +0.53% (100% pos, n=1) | 12b: -1.66% (0% pos, n=1) | 24b: -3.61% (0% pos, n=1)
- MAE/MFE over default hold: avg MAE -1.73% | p95 MAE -1.73% | avg MFE +1.70% | p95 MFE +1.70%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 1 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 1 | 0 | 0 | 100% | +1.390% |

#### Validation / Bear
- Sample size: N=1
- Forward returns: 1b: +0.73% (100% pos, n=1) | 3b: +1.50% (100% pos, n=1) | 6b: +0.53% (100% pos, n=1) | 12b: -1.66% (0% pos, n=1) | 24b: -3.61% (0% pos, n=1)
- MAE/MFE over default hold: avg MAE -1.73% | p95 MAE -1.73% | avg MFE +1.70% | p95 MFE +1.70%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 1 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 1 | 0 | 0 | 100% | +1.390% |

#### All Regime
- Sample size: N=12
- Forward returns: 1b: +0.15% (67% pos, n=12) | 3b: -0.16% (33% pos, n=12) | 6b: -0.21% (25% pos, n=12) | 12b: -0.57% (33% pos, n=12) | 24b: +0.65% (50% pos, n=12)
- MAE/MFE over default hold: avg MAE -2.21% | p95 MAE -0.36% | avg MFE +1.89% | p95 MFE +6.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 58% | Expectancy -0.114%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 8 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 4 | 8 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 5 | 7 | 0 | 42% | -0.860% |
  | 1.50 | 2.00 | 5 | 7 | 0 | 42% | -0.652% |
  | 1.50 | 3.00 | 7 | 2 | 3 | 58% | -0.114% |

#### Bear Regime
- Sample size: N=4
- Forward returns: 1b: +0.07% (50% pos, n=4) | 3b: +0.27% (50% pos, n=4) | 6b: +0.44% (50% pos, n=4) | 12b: +0.07% (50% pos, n=4) | 24b: -0.11% (50% pos, n=4)
- MAE/MFE over default hold: avg MAE -1.79% | p95 MAE -0.36% | avg MFE +1.66% | p95 MFE +2.96%
- Best combo: TP 1.50 / Stop 3.00 | WR 75% | Expectancy +0.701%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 2 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 2 | 2 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 2 | 2 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 2 | 2 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 3 | 0 | 1 | 75% | +0.701% |

### Signal: PF0 — Bear-Regime Pump Failure 2.0%
- Timeframe: 1H
- Logic: 1H green body >=2.0%, next 1-3 bars fail to make new high >0.3%, short first red confirmation
- Symbol: BTCUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=26
- Forward returns: 1b: -0.06% (42% pos, n=26) | 3b: -0.08% (35% pos, n=26) | 6b: -0.63% (23% pos, n=26) | 12b: -0.59% (31% pos, n=26) | 24b: -0.24% (46% pos, n=26)
- MAE/MFE over default hold: avg MAE -2.39% | p95 MAE -0.51% | avg MFE +1.66% | p95 MFE +5.91%
- Best combo: TP 1.50 / Stop 3.00 | WR 46% | Expectancy -0.340%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 10 | 15 | 1 | 38% | -0.705% |
  | 1.00 | 1.50 | 10 | 15 | 1 | 38% | -0.609% |
  | 1.00 | 2.00 | 12 | 11 | 3 | 46% | -0.575% |
  | 1.50 | 2.00 | 10 | 12 | 4 | 38% | -0.511% |
  | 1.50 | 3.00 | 12 | 5 | 9 | 46% | -0.340% |

#### Discovery / Bear
- Sample size: N=11
- Forward returns: 1b: -0.03% (36% pos, n=11) | 3b: +0.12% (36% pos, n=11) | 6b: -0.38% (36% pos, n=11) | 12b: -0.07% (55% pos, n=11) | 24b: -0.41% (64% pos, n=11)
- MAE/MFE over default hold: avg MAE -2.23% | p95 MAE -0.36% | avg MFE +2.12% | p95 MFE +5.91%
- Best combo: TP 1.50 / Stop 3.00 | WR 64% | Expectancy +0.246%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 6 | 5 | 0 | 55% | -0.383% |
  | 1.00 | 1.50 | 6 | 5 | 0 | 55% | -0.246% |
  | 1.00 | 2.00 | 7 | 4 | 0 | 64% | -0.201% |
  | 1.50 | 2.00 | 6 | 4 | 1 | 55% | +0.042% |
  | 1.50 | 3.00 | 7 | 2 | 2 | 64% | +0.246% |

#### Validation / All
- Sample size: N=4
- Forward returns: 1b: +0.25% (75% pos, n=4) | 3b: +0.17% (50% pos, n=4) | 6b: -0.20% (75% pos, n=4) | 12b: -2.01% (50% pos, n=4) | 24b: -1.46% (50% pos, n=4)
- MAE/MFE over default hold: avg MAE -3.26% | p95 MAE -0.21% | avg MFE +1.20% | p95 MFE +1.70%
- Best combo: TP 0.75 / Stop 1.50 | WR 100% | Expectancy +0.640%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 4 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 2 | 1 | 1 | 50% | +0.099% |
  | 1.00 | 2.00 | 2 | 1 | 1 | 50% | -0.026% |
  | 1.50 | 2.00 | 1 | 1 | 2 | 25% | +0.009% |
  | 1.50 | 3.00 | 1 | 1 | 2 | 25% | -0.241% |

#### Validation / Bear
- Sample size: N=3
- Forward returns: 1b: +0.30% (67% pos, n=3) | 3b: +0.37% (67% pos, n=3) | 6b: -0.53% (67% pos, n=3) | 12b: -2.90% (33% pos, n=3) | 24b: -2.85% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -3.99% | p95 MAE -0.21% | avg MFE +1.15% | p95 MFE +1.70%
- Best combo: TP 0.75 / Stop 1.50 | WR 100% | Expectancy +0.640%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 3 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 1 | 1 | 33% | -0.165% |
  | 1.00 | 2.00 | 1 | 1 | 1 | 33% | -0.332% |
  | 1.50 | 2.00 | 1 | 1 | 1 | 33% | -0.165% |
  | 1.50 | 3.00 | 1 | 1 | 1 | 33% | -0.498% |

#### All Regime
- Sample size: N=30
- Forward returns: 1b: -0.02% (47% pos, n=30) | 3b: -0.05% (37% pos, n=30) | 6b: -0.57% (30% pos, n=30) | 12b: -0.78% (33% pos, n=30) | 24b: -0.41% (47% pos, n=30)
- MAE/MFE over default hold: avg MAE -2.50% | p95 MAE -0.36% | avg MFE +1.60% | p95 MFE +5.91%
- Best combo: TP 1.50 / Stop 3.00 | WR 43% | Expectancy -0.327%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 14 | 15 | 1 | 47% | -0.526% |
  | 1.00 | 1.50 | 12 | 16 | 2 | 40% | -0.515% |
  | 1.00 | 2.00 | 14 | 12 | 4 | 47% | -0.502% |
  | 1.50 | 2.00 | 11 | 13 | 6 | 37% | -0.441% |
  | 1.50 | 3.00 | 13 | 6 | 11 | 43% | -0.327% |

#### Bear Regime
- Sample size: N=14
- Forward returns: 1b: +0.04% (43% pos, n=14) | 3b: +0.17% (43% pos, n=14) | 6b: -0.41% (43% pos, n=14) | 12b: -0.68% (50% pos, n=14) | 24b: -0.93% (57% pos, n=14)
- MAE/MFE over default hold: avg MAE -2.61% | p95 MAE -0.21% | avg MFE +1.91% | p95 MFE +5.91%
- Best combo: TP 1.50 / Stop 3.00 | WR 57% | Expectancy +0.087%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 9 | 5 | 0 | 64% | -0.164% |
  | 1.00 | 1.50 | 7 | 6 | 1 | 50% | -0.229% |
  | 1.00 | 2.00 | 8 | 5 | 1 | 57% | -0.229% |
  | 1.50 | 2.00 | 7 | 5 | 2 | 50% | -0.002% |
  | 1.50 | 3.00 | 8 | 3 | 3 | 57% | +0.087% |

### Signal: PF1A — Pump Failure 2.5% Tight Delay
- Timeframe: 1H
- Logic: 1H green body >=2.5%, next 1-2 bars fail to make new high >0.2%, short first red confirmation
- Symbol: BTCUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=8
- Forward returns: 1b: -0.13% (50% pos, n=8) | 3b: -0.31% (38% pos, n=8) | 6b: -0.06% (25% pos, n=8) | 12b: -0.07% (50% pos, n=8) | 24b: +1.58% (63% pos, n=8)
- MAE/MFE over default hold: avg MAE -2.22% | p95 MAE -0.36% | avg MFE +2.17% | p95 MFE +6.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 63% | Expectancy +0.082%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 6 | 0 | 25% | -1.047% |
  | 1.00 | 1.50 | 2 | 6 | 0 | 25% | -0.985% |
  | 1.00 | 2.00 | 3 | 5 | 0 | 38% | -0.985% |
  | 1.50 | 2.00 | 3 | 5 | 0 | 38% | -0.798% |
  | 1.50 | 3.00 | 5 | 1 | 2 | 63% | +0.082% |

#### Discovery / Bear
- Sample size: N=3
- Forward returns: 1b: -0.16% (33% pos, n=3) | 3b: -0.14% (33% pos, n=3) | 6b: +0.41% (33% pos, n=3) | 12b: +0.64% (67% pos, n=3) | 24b: +1.05% (67% pos, n=3)
- MAE/MFE over default hold: avg MAE -1.81% | p95 MAE -0.36% | avg MFE +1.65% | p95 MFE +2.96%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy +0.471%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 2 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 1 | 2 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 1 | 2 | 0 | 33% | -1.110% |
  | 1.50 | 2.00 | 1 | 2 | 0 | 33% | -0.943% |
  | 1.50 | 3.00 | 2 | 0 | 1 | 67% | +0.471% |

#### Validation / All
- Sample size: N=1
- Forward returns: 1b: +0.73% (100% pos, n=1) | 3b: +1.50% (100% pos, n=1) | 6b: +0.53% (100% pos, n=1) | 12b: -1.66% (0% pos, n=1) | 24b: -3.61% (0% pos, n=1)
- MAE/MFE over default hold: avg MAE -1.73% | p95 MAE -1.73% | avg MFE +1.70% | p95 MFE +1.70%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 1 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 1 | 0 | 0 | 100% | +1.390% |

#### Validation / Bear
- Sample size: N=1
- Forward returns: 1b: +0.73% (100% pos, n=1) | 3b: +1.50% (100% pos, n=1) | 6b: +0.53% (100% pos, n=1) | 12b: -1.66% (0% pos, n=1) | 24b: -3.61% (0% pos, n=1)
- MAE/MFE over default hold: avg MAE -1.73% | p95 MAE -1.73% | avg MFE +1.70% | p95 MFE +1.70%
- Best combo: TP 1.50 / Stop 2.00 | WR 100% | Expectancy +1.390%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 0 | 0 | 100% | +0.640% |
  | 1.00 | 1.50 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.00 | 2.00 | 1 | 0 | 0 | 100% | +0.890% |
  | 1.50 | 2.00 | 1 | 0 | 0 | 100% | +1.390% |
  | 1.50 | 3.00 | 1 | 0 | 0 | 100% | +1.390% |

#### All Regime
- Sample size: N=9
- Forward returns: 1b: -0.04% (56% pos, n=9) | 3b: -0.11% (44% pos, n=9) | 6b: +0.01% (33% pos, n=9) | 12b: -0.24% (44% pos, n=9) | 24b: +1.00% (56% pos, n=9)
- MAE/MFE over default hold: avg MAE -2.17% | p95 MAE -0.36% | avg MFE +2.12% | p95 MFE +6.21%
- Best combo: TP 1.50 / Stop 3.00 | WR 67% | Expectancy +0.228%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 3 | 6 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 3 | 6 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 4 | 5 | 0 | 44% | -0.777% |
  | 1.50 | 2.00 | 4 | 5 | 0 | 44% | -0.554% |
  | 1.50 | 3.00 | 6 | 1 | 2 | 67% | +0.228% |

#### Bear Regime
- Sample size: N=4
- Forward returns: 1b: +0.07% (50% pos, n=4) | 3b: +0.27% (50% pos, n=4) | 6b: +0.44% (50% pos, n=4) | 12b: +0.07% (50% pos, n=4) | 24b: -0.11% (50% pos, n=4)
- MAE/MFE over default hold: avg MAE -1.79% | p95 MAE -0.36% | avg MFE +1.66% | p95 MFE +2.96%
- Best combo: TP 1.50 / Stop 3.00 | WR 75% | Expectancy +0.701%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 2 | 2 | 0 | 50% | -0.485% |
  | 1.00 | 1.50 | 2 | 2 | 0 | 50% | -0.360% |
  | 1.00 | 2.00 | 2 | 2 | 0 | 50% | -0.610% |
  | 1.50 | 2.00 | 2 | 2 | 0 | 50% | -0.360% |
  | 1.50 | 3.00 | 3 | 0 | 1 | 75% | +0.701% |

### Signal: LH5 — Lower High + EMA20 + Low Volume
- Timeframe: 1H
- Logic: LH2 plus rejection bar volume <=1.2x SMA20
- Symbol: BTCUSDT
- Verdict: PROFITABLE

#### Discovery / All
- Sample size: N=436
- Forward returns: 1b: +0.02% (48% pos, n=436) | 3b: +0.00% (46% pos, n=436) | 6b: -0.12% (38% pos, n=436) | 12b: -0.22% (41% pos, n=436) | 24b: -0.26% (41% pos, n=436)
- MAE/MFE over default hold: avg MAE -1.48% | p95 MAE -0.14% | avg MFE +1.56% | p95 MFE +4.79%
- Best combo: TP 1.00 / Stop 1.50 | WR 50% | Expectancy -0.055%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 247 | 88 | 101 | 57% | -0.083% |
  | 1.00 | 1.50 | 217 | 100 | 119 | 50% | -0.055% |
  | 1.00 | 2.00 | 225 | 70 | 141 | 52% | -0.077% |
  | 1.50 | 2.00 | 147 | 92 | 197 | 34% | -0.185% |
  | 1.50 | 3.00 | 152 | 39 | 245 | 35% | -0.194% |

#### Discovery / Bear
- Sample size: N=253
- Forward returns: 1b: +0.02% (48% pos, n=253) | 3b: +0.04% (48% pos, n=253) | 6b: -0.13% (38% pos, n=253) | 12b: -0.22% (42% pos, n=253) | 24b: -0.30% (40% pos, n=253)
- MAE/MFE over default hold: avg MAE -1.56% | p95 MAE -0.09% | avg MFE +1.73% | p95 MFE +5.06%
- Best combo: TP 1.00 / Stop 1.50 | WR 53% | Expectancy -0.037%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 151 | 51 | 51 | 60% | -0.055% |
  | 1.00 | 1.50 | 133 | 61 | 59 | 53% | -0.037% |
  | 1.00 | 2.00 | 139 | 43 | 71 | 55% | -0.047% |
  | 1.50 | 2.00 | 98 | 57 | 98 | 39% | -0.121% |
  | 1.50 | 3.00 | 102 | 24 | 127 | 40% | -0.123% |

#### Validation / All
- Sample size: N=66
- Forward returns: 1b: +0.08% (47% pos, n=66) | 3b: -0.05% (49% pos, n=65) | 6b: +0.08% (55% pos, n=65) | 12b: +0.30% (53% pos, n=64) | 24b: +0.76% (61% pos, n=64)
- MAE/MFE over default hold: avg MAE -1.42% | p95 MAE -0.14% | avg MFE +1.99% | p95 MFE +5.10%
- Best combo: TP 1.50 / Stop 3.00 | WR 47% | Expectancy +0.136%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 46 | 14 | 6 | 70% | +0.068% |
  | 1.00 | 1.50 | 40 | 16 | 10 | 61% | +0.112% |
  | 1.00 | 2.00 | 40 | 11 | 15 | 61% | +0.092% |
  | 1.50 | 2.00 | 29 | 13 | 24 | 44% | +0.082% |
  | 1.50 | 3.00 | 31 | 6 | 29 | 47% | +0.136% |

#### Validation / Bear
- Sample size: N=47
- Forward returns: 1b: +0.11% (47% pos, n=47) | 3b: -0.08% (48% pos, n=46) | 6b: +0.06% (50% pos, n=46) | 12b: +0.23% (50% pos, n=46) | 24b: +0.58% (54% pos, n=46)
- MAE/MFE over default hold: avg MAE -1.72% | p95 MAE -0.14% | avg MFE +2.25% | p95 MFE +6.37%
- Best combo: TP 1.50 / Stop 3.00 | WR 51% | Expectancy +0.015%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 31 | 14 | 2 | 66% | -0.080% |
  | 1.00 | 1.50 | 28 | 16 | 3 | 60% | -0.029% |
  | 1.00 | 2.00 | 28 | 11 | 8 | 60% | -0.057% |
  | 1.50 | 2.00 | 22 | 13 | 12 | 47% | -0.062% |
  | 1.50 | 3.00 | 24 | 6 | 17 | 51% | +0.015% |

#### All Regime
- Sample size: N=502
- Forward returns: 1b: +0.02% (48% pos, n=502) | 3b: -0.01% (46% pos, n=501) | 6b: -0.09% (40% pos, n=501) | 12b: -0.15% (43% pos, n=500) | 24b: -0.13% (43% pos, n=500)
- MAE/MFE over default hold: avg MAE -1.47% | p95 MAE -0.14% | avg MFE +1.61% | p95 MFE +4.79%
- Best combo: TP 1.00 / Stop 1.50 | WR 51% | Expectancy -0.033%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 293 | 102 | 107 | 58% | -0.063% |
  | 1.00 | 1.50 | 257 | 116 | 129 | 51% | -0.033% |
  | 1.00 | 2.00 | 265 | 81 | 156 | 53% | -0.055% |
  | 1.50 | 2.00 | 176 | 105 | 221 | 35% | -0.150% |
  | 1.50 | 3.00 | 183 | 45 | 274 | 36% | -0.150% |

#### Bear Regime
- Sample size: N=300
- Forward returns: 1b: +0.03% (48% pos, n=300) | 3b: +0.02% (48% pos, n=299) | 6b: -0.10% (40% pos, n=299) | 12b: -0.15% (43% pos, n=299) | 24b: -0.16% (42% pos, n=299)
- MAE/MFE over default hold: avg MAE -1.58% | p95 MAE -0.10% | avg MFE +1.81% | p95 MFE +5.16%
- Best combo: TP 1.00 / Stop 1.50 | WR 54% | Expectancy -0.036%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 182 | 65 | 53 | 61% | -0.059% |
  | 1.00 | 1.50 | 161 | 77 | 62 | 54% | -0.036% |
  | 1.00 | 2.00 | 167 | 54 | 79 | 56% | -0.048% |
  | 1.50 | 2.00 | 120 | 70 | 110 | 40% | -0.112% |
  | 1.50 | 3.00 | 126 | 30 | 144 | 42% | -0.102% |

### Signal: CS2 — Composite Score >=5
- Timeframe: 1H
- Logic: Composite bear-rally score >=5
- Symbol: BTCUSDT
- Verdict: MARGINAL

#### Discovery / All
- Sample size: N=28
- Forward returns: 1b: +0.07% (54% pos, n=28) | 3b: +0.24% (57% pos, n=28) | 6b: +0.09% (54% pos, n=28) | 12b: +0.03% (43% pos, n=28) | 24b: +0.48% (54% pos, n=28)
- MAE/MFE over default hold: avg MAE -1.01% | p95 MAE -0.05% | avg MFE +1.34% | p95 MFE +5.15%
- Best combo: TP 1.00 / Stop 2.00 | WR 46% | Expectancy +0.111%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 14 | 4 | 10 | 50% | -0.008% |
  | 1.00 | 1.50 | 13 | 4 | 11 | 46% | +0.092% |
  | 1.00 | 2.00 | 13 | 2 | 13 | 46% | +0.111% |
  | 1.50 | 2.00 | 8 | 3 | 17 | 29% | -0.028% |
  | 1.50 | 3.00 | 8 | 1 | 19 | 29% | -0.045% |

#### Discovery / Bear
- Sample size: N=28
- Forward returns: 1b: +0.07% (54% pos, n=28) | 3b: +0.24% (57% pos, n=28) | 6b: +0.09% (54% pos, n=28) | 12b: +0.03% (43% pos, n=28) | 24b: +0.48% (54% pos, n=28)
- MAE/MFE over default hold: avg MAE -1.01% | p95 MAE -0.05% | avg MFE +1.34% | p95 MFE +5.15%
- Best combo: TP 1.00 / Stop 2.00 | WR 46% | Expectancy +0.111%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 14 | 4 | 10 | 50% | -0.008% |
  | 1.00 | 1.50 | 13 | 4 | 11 | 46% | +0.092% |
  | 1.00 | 2.00 | 13 | 2 | 13 | 46% | +0.111% |
  | 1.50 | 2.00 | 8 | 3 | 17 | 29% | -0.028% |
  | 1.50 | 3.00 | 8 | 1 | 19 | 29% | -0.045% |

#### Validation / All
- Sample size: N=3
- Forward returns: 1b: -0.45% (67% pos, n=3) | 3b: -0.15% (67% pos, n=3) | 6b: -1.02% (33% pos, n=3) | 12b: -0.58% (67% pos, n=3) | 24b: +1.12% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -2.15% | p95 MAE -0.31% | avg MFE +1.07% | p95 MFE +1.69%
- Best combo: TP 1.50 / Stop 2.00 | WR 33% | Expectancy -0.045%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 2 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 1 | 2 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 1 | 1 | 1 | 33% | -0.045% |
  | 1.50 | 3.00 | 1 | 1 | 1 | 33% | -0.378% |

#### Validation / Bear
- Sample size: N=3
- Forward returns: 1b: -0.45% (67% pos, n=3) | 3b: -0.15% (67% pos, n=3) | 6b: -1.02% (33% pos, n=3) | 12b: -0.58% (67% pos, n=3) | 24b: +1.12% (33% pos, n=3)
- MAE/MFE over default hold: avg MAE -2.15% | p95 MAE -0.31% | avg MFE +1.07% | p95 MFE +1.69%
- Best combo: TP 1.50 / Stop 2.00 | WR 33% | Expectancy -0.045%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 1 | 2 | 0 | 33% | -0.860% |
  | 1.00 | 1.50 | 1 | 2 | 0 | 33% | -0.777% |
  | 1.00 | 2.00 | 2 | 1 | 0 | 67% | -0.110% |
  | 1.50 | 2.00 | 1 | 1 | 1 | 33% | -0.045% |
  | 1.50 | 3.00 | 1 | 1 | 1 | 33% | -0.378% |

#### All Regime
- Sample size: N=31
- Forward returns: 1b: +0.02% (55% pos, n=31) | 3b: +0.20% (58% pos, n=31) | 6b: -0.02% (52% pos, n=31) | 12b: -0.03% (45% pos, n=31) | 24b: +0.54% (52% pos, n=31)
- MAE/MFE over default hold: avg MAE -1.12% | p95 MAE -0.05% | avg MFE +1.31% | p95 MFE +5.15%
- Best combo: TP 1.00 / Stop 2.00 | WR 48% | Expectancy +0.090%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 15 | 6 | 10 | 48% | -0.091% |
  | 1.00 | 1.50 | 14 | 6 | 11 | 45% | +0.008% |
  | 1.00 | 2.00 | 15 | 3 | 13 | 48% | +0.090% |
  | 1.50 | 2.00 | 9 | 4 | 18 | 29% | -0.029% |
  | 1.50 | 3.00 | 9 | 2 | 20 | 29% | -0.077% |

#### Bear Regime
- Sample size: N=31
- Forward returns: 1b: +0.02% (55% pos, n=31) | 3b: +0.20% (58% pos, n=31) | 6b: -0.02% (52% pos, n=31) | 12b: -0.03% (45% pos, n=31) | 24b: +0.54% (52% pos, n=31)
- MAE/MFE over default hold: avg MAE -1.12% | p95 MAE -0.05% | avg MFE +1.31% | p95 MFE +5.15%
- Best combo: TP 1.00 / Stop 2.00 | WR 48% | Expectancy +0.090%
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |---|---|---|---|---|---|---|
  | 0.75 | 1.50 | 15 | 6 | 10 | 48% | -0.091% |
  | 1.00 | 1.50 | 14 | 6 | 11 | 45% | +0.008% |
  | 1.00 | 2.00 | 15 | 3 | 13 | 48% | +0.090% |
  | 1.50 | 2.00 | 9 | 4 | 18 | 29% | -0.029% |
  | 1.50 | 3.00 | 9 | 2 | 20 | 29% | -0.077% |
