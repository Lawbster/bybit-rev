# HYPE Short Signal Analysis

_Analysis date: 2026-04-04 | Data: HYPEUSDT 5m candles, ~16 months_

## Executive Summary

**HYPE is extremely hard to short profitably.** Nearly every simple mean-reversion or overbought short setup has negative expectancy. The token trends hard in both directions — 30-60% monthly ranges — which kills shorts during uptrends and makes entries unreliable during downtrends.

The ONE signal that showed real promise is a **multi-confluence bear-regime short** (n=10, 80% WR), but sample size is too small to trade on yet. This document catalogs everything tested.

---

## Signals Tested

### 1. Day-After Reversal (Daily)

Short after a big green day, expecting mean reversion.

| Prior Day | N | Next Day Avg | Reversal Rate |
|---|---|---|---|
| Up >8% | 43 | +0.81% | 51% |
| Up 5-8% | 43 | +1.19% | 51% |
| Up 2-5% | 85 | -0.64% | 58% |
| Down >8% | 28 | +2.27% | 32% |

**Verdict: USELESS.** Big up days do NOT reverse. Big down days bounce hard (shorting dips = death).

### 2. RSI Extremes (Daily)

| RSI Zone | N | Next Day Avg | Down Days |
|---|---|---|---|
| >80 | 4 | -1.19% | 75% |
| 70-80 | 26 | +0.67% | 54% |
| 60-70 | 89 | +0.44% | 53% |

**Verdict: WEAK.** RSI >80 has edge but fires 4 times in 16 months. RSI 70-80 has no edge.

### 3. Consecutive Green Days (Daily)

| Streak | N | Next Day Avg | Red Next |
|---|---|---|---|
| 2 days | 66 | -0.26% | 62% |
| 3 days | 25 | -0.44% | 52% |
| 4 days | 12 | +1.40% | 58% |
| 6 days | 3 | -3.87% | 100% |

**Verdict: MARGINAL.** 2 green days shows 62% reversal but avg is only -0.26%. After fees, breakeven at best.

### 4. Day of Week (Daily)

| Day | Avg Return | Red Days |
|---|---|---|
| Thu | -1.11% | 61% |
| Sun | -0.49% | 52% |
| Wed | +1.53% | 42% |
| Fri | +1.17% | 49% |

**Verdict: INTERESTING.** Thursday is the worst day (61% red). This aligns with the wed-short bot which enters Wed evening and profits Thu. Sunday also slightly bearish.

### 5. EMA Stretch + RSI (4H)

Price stretched >X% above EMA50 on 4H, with RSI >Y.

| Stretch | RSI | N | WR (6 bars) | Avg 6-bar | Max Adverse |
|---|---|---|---|---|---|
| >12% | >65 | 22 | 45% | -2.22% | 8.67% |
| >15% | >70 | 12 | 58% | -3.62% | 9.55% |
| >10% | >70 | 18 | 44% | -4.10% | 9.93% |

**Verdict: NEGATIVE EXPECTANCY.** Avg forward return is negative (price keeps going up). The 8-10% max adverse means your stop gets hit before TP. HYPE stretches further than expected.

### 6. Bearish RSI Divergence (4H)

New price high + lower RSI high.

- Signals: 106
- 6-bar WR: 49%
- Avg 6-bar short profit: -0.77%

**Verdict: USELESS.** Coin noise.

### 7. Failed Breakout (1H)

Price makes new 48h high, then closes below prior 12h high.

| TP/Stop | Wins | Losses | WR | Expectancy |
|---|---|---|---|---|
| 1.5%/2% | 117 | 102 | 53% | -0.130% |
| 1.0%/1.5% | 125 | 94 | 57% | -0.073% |

**Verdict: NEGATIVE.** Even with 57% WR, the asymmetric stop/TP kills it.

### 8. EMA50 Rejection in Bear Regime (1H)

Bear regime (EMA50 < EMA200), price rallies to EMA50 and gets rejected (red candle).

- Signals: 318
- 1%TP/2%stop: 207W / 110L = 65% WR
- Expectancy: **-0.041%** (just barely negative)

**Verdict: ALMOST WORKS.** The WR is high (65%) but TP is too tight relative to stop. The issue is that EMA50 rejections sometimes turn into breakouts, and the 2% stop gets hit.

### 9. Multi-Confluence Bear Short (1H) -- BEST SIGNAL

All of the following must be true:
1. Bear regime (1H EMA50 < EMA200)
2. RSI 55-80 (overbought bounce, not extreme)
3. Price near EMA50 (within 0.5% below to 3% below)
4. Red candle (rejection)
5. Upper wick > 30% of range
6. Volume below 1.3x SMA20 (weak rally)

| TP/Stop | Wins | Losses | WR | Expectancy |
|---|---|---|---|---|
| 0.75%/1.5% | 8 | 2 | 80% | +0.300% |
| 1.0%/1.5% | 8 | 2 | 80% | +0.500% |
| 1.0%/2.0% | 8 | 2 | 80% | +0.400% |
| 1.5%/2.0% | 8 | 2 | 80% | **+0.800%** |

Signal dates: 2025-08-03, 2025-08-22, 2025-10-18(L), 2025-11-12, 2025-12-02, 2025-12-08, 2025-12-10(L), 2026-01-21, 2026-01-22, 2026-02-11

**Verdict: PROMISING but n=10.** This is the only signal with real positive expectancy. The logic is sound: in a confirmed downtrend, weak bounces into resistance (EMA50) with declining volume and wick rejection = high probability continuation down.

**Problem:** Fires ~10 times in 8 months. At $15k notional and 0.8% avg expectancy, that's ~$1,200/year. Needs more data or relaxed filters to increase frequency.

### 10. Distribution Detection (Daily)

New 7d high + 3 days declining volume + price still rising.

- Signals: 6 (too few)
- 3d WR: 50%, 5d WR: 67%

**Verdict: INTERESTING CONCEPT but insufficient data.** The logic (smart money distributing at highs) is sound but the filter is too strict for HYPE's volatility.

### 11. Hour-of-Day Edge

Slight short edge at 11:00-12:00 UTC and 22:00-23:00 UTC. Slight long edge at 00:00-01:00 and 19:00-21:00 UTC. All edges are <0.1% — not actionable standalone but useful as timing filters.

---

## Key Findings

1. **HYPE trends hard.** Mean-reversion shorts are a losing strategy. The token routinely pushes 10-15% beyond "overbought" before reversing.

2. **The only profitable short setup requires bear regime confirmation.** Shorting into strength during a bull trend is suicide. You must wait for EMA50 < EMA200 on 1H before considering any short.

3. **Tight TPs work better than wide TPs.** In bear regimes, bounces are shallow. 1-1.5% TP captures the rejection before the next bounce attempt.

4. **Volume is a strong confirming filter.** Weak-volume rallies in bear trends are the highest-conviction short entries. High-volume rallies, even in bear regimes, often signal trend reversal.

5. **Thursday is statistically the weakest day** (61% red, avg -1.11%). Wednesday is the strongest (+1.53%, 42% red). This supports the existing wed-short bot timing.

6. **Token unlock on 6th of month** creates slight sell pressure (2 of 3 months negative) but sample too small.

---

## Recommended Next Steps

1. **Expand multi-confluence signal** to more coins (need to collect 5m data for BTC, ETH, SOL, etc.) to validate cross-asset
2. **Add OI data to analysis** — falling OI during rally = stronger distribution signal
3. **Test regime detection** with different EMA pairs (20/50, 50/100) to find optimal bear confirmation
4. **Consider hybrid approach**: use the alarm system (OI divergence, funding, structure break) as regime filter, then the multi-confluence signal for entry timing
5. **Accumulate more data** on the n=10 signal — if it maintains 70%+ WR over 20+ signals, it's tradeable
