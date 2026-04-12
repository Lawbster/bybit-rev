# HYPE DCA Ladder — S/R Levels & Gate Theory Research Findings

**Date:** 2026-04-12
**Asset:** HYPEUSDT (Bybit perpetual)
**Sim period:** 2025-07-01 → 2026-04-12 (~10 months)
**Baseline config:** $10k capital, $800 base, ×1.2 martingale, 11 max rungs, 1.4% TP, 45× leverage, 30min add interval

---

## 1. Ladder Close-Depth Distribution (U-Shaped)

487 total ladder episodes across the sim period:

| Rungs at close | Episodes | TP rate | Kill/Flat |
|---|---|---|---|
| 1–8 | 255 (52%) | **100%** | 0 |
| 9 | 20 (4%) | 90% | 1 |
| 10 | 16 (3%) | 94% | 0 |
| **11 (max)** | **196 (40%)** | **52%** | **28** |

**Key finding:** The outcome distribution is heavily bimodal. Rungs 1–10 close at TP almost always (94–100%). All 28 kills and 12 of 13 flats concentrate at rung 11. The ladder either resolves quickly (rungs 1–8) or goes to max depth, where outcomes are a coin flip.

**Implication:** Any intervention that improves max-depth outcomes has outsized impact on total PnL.

---

## 2. Max-Depth (Rung 11) Episode Profile

196 episodes hit max rungs. Hold-time distribution:

| Bucket | N | % | TP | Kill | Flat | Stale |
|---|---|---|---|---|---|---|
| < 24h | 149 | 76% | 95 | 5 | 0 | 49 |
| 24–48h | 29 | 15% | 5 | 5 | 8 | 11 |
| 48–72h | 9 | 5% | 0 | 3 | 3 | 3 |
| 3–7 days | 9 | 5% | 2 | 3 | 1 | 3 |
| > 7 days | 0 | 0% | — | — | — | — |

- Median hold: 0.4 days (9.6 hours)
- p95 hold: 2.9 days
- Zero episodes stuck > 7 days (hardFlatten/emergencyKill are aggressive)

**Key finding:** Max-depth ladders resolve FAST. 76% close within 24h. The 24–48h band is the danger zone: TP rate drops from 64% (<24h) to 17% (24–48h). Kills and flats cluster at 1–3 day hold times.

---

## 3. Indicator Snapshot Analysis at Rung 11

At the moment rung 11 is added, we captured market state across 11 indicators. Below are the indicators that showed any separation between TP outcomes and kill/flat outcomes.

### 3A. Traditional Indicators (weak separation)

| Indicator | TP med | K/F med | Stale med | Assessment |
|---|---|---|---|---|
| CRSI 4H | 62.6 | 63.5 | 67.3 | Overlapping, no signal |
| RSI 1H | 59.2 | 57.3 | 57.9 | Overlapping, no signal |
| Dist EMA200 4H | +7.7% | +6.2% | +8.2% | Overlapping |
| BTC 1H return | −0.0% | 0.0% | −0.0% | No signal |

**Verdict:** No traditional indicator reliably separates TP from kill/flat at the moment of rung 11 entry. The kill/flat population is uniformly distributed across indicator space.

### 3B. Price/Volatility Features (some separation)

| Feature | TP med | K/F med | Stale med | Notes |
|---|---|---|---|---|
| Dist from avg entry | −0.1% | −0.4% | −0.3% | Small diff, low variance overall |
| Hold hours to rung 11 | 4.1h | 3.9h | 4.3h | All ~4h — no variance to exploit |
| Range 6h | 3.4% | 4.1% | 3.6% | **K/F tends wider range** |
| Slope 6h | +0.5% | −0.1% | +0.2% | **K/F slightly negative slope** |
| Bounce from 6h low | 1.6% | 1.4% | 1.2% | Minor |
| DD vs 6h close-max | −1.6% | −2.5% | −2.0% | K/F deeper in drawdown |

### 3C. Best Threshold Gates (single-indicator)

Percentile sweep testing every indicator for the threshold that maximizes TP rate with N ≥ 10 fires:

| Gate | Fires | TP / K-F / Stale | TP% | Lift vs 52% base |
|---|---|---|---|---|
| Range 6h ≤ 3.2% | 69 | 42 / **4** / 23 | 61% | +9p, K/F drops to 5.8% |
| Slope 6h ≥ +2.4% | 30 | 21 / 3 / 6 | 70% | +18p |
| DD vs 6h max ≥ −1.5% | 79 | 49 / 9 / 21 | 62% | +10p |
| Range 12h ≥ 8.8% | 20 | 15 / 2 / 3 | 75% | +23p (small N) |
| CRSI 4H ≥ 85.9 | 20 | 14 / 1 / 5 | 70% | +18p (small N) |

**Key finding:** Price-volatility features outperform traditional indicators for max-depth episode prediction. Range 6h ≤ 3.2% is the standout: fires 69 times (35% of max-depth events) and cuts the kill/flat rate from 14.3% → 5.8%.

---

## 4. Dynamic Expansion Gate — Sim Results

**Gate tested:** At rung 11 add, if 6h range ≤ 3.2% AND 6h slope ≥ 0%, expand max rungs from 11 → 13 for this episode only.

### 4A. Sweep Results (8 variants vs baseline)

| Variant | Range | Slope | Max | Final | Return | MaxDD | Fires | TP/KF/S | TP% |
|---|---|---|---|---|---|---|---|---|---|
| Baseline | — | — | 11 | $12,732 | +27.3% | 79.2% | — | — | — |
| **r3.2_s0_m13** | 3.2% | 0% | 13 | **$13,828** | **+38.3%** | **72.6%** | 39 | 25/3/10 | 66% |
| r3.2_s0.5_m13 | 3.2% | 0.5% | 13 | $12,657 | +26.6% | 77.1% | 30 | 18/3/9 | 60% |
| r3.2_s1.0_m13 | 3.2% | 1.0% | 13 | $11,755 | +17.6% | 80.3% | 25 | 14/3/8 | 56% |
| r3.2_s0_m12 | 3.2% | 0% | 12 | $12,282 | +22.8% | 78.2% | 41 | 24/3/13 | 60% |
| r2.5_s0_m13 | 2.5% | 0% | 13 | $13,119 | +31.2% | 74.4% | 15 | 10/1/3 | 71% |
| r2.5_s0.5_m13 | 2.5% | 0.5% | 13 | $13,141 | +31.4% | 74.9% | 10 | 6/1/3 | 60% |
| r4.0_s0_m13 ⚠️ | 4.0% | 0% | 13 | $14,494 | +44.9% | 73.9% | 80 | 45/**9**/25 | 57% |

### 4B. Freefall Safety Check (month-by-month, best variant r3.2_s0_m13)

| Month | Base Ladder | Expanded | Δ | Gate fires | Notes |
|---|---|---|---|---|---|
| 2025-07 | +$2,250 | +$2,770 | +$520 | 13 | 9 TP, 1 K/F |
| 2025-08 | −$1,068 | −$137 | +$931 | 8 | 6 TP, 0 K/F |
| 2025-09 | +$3,353 | +$3,945 | +$592 | 4 | 4 TP, clean |
| 2025-10 | +$2,265 | +$2,514 | +$249 | 2 | minor |
| **2025-11** ⚠️ | −$5,765 | −$5,765 | **$0** | **0** | freefall — gate silent |
| **2025-12** ⚠️ | −$1,944 | −$1,944 | **$0** | 1 | gate barely fires |
| 2026-01 | −$2,792 | −$3,169 | −$377 | 3 | 1 K/F |
| **2026-02** | +$406 | −$404 | −$810 | 1 | lone bad fire |
| 2026-03 | +$4,795 | +$4,852 | +$57 | 5 | neutral |
| 2026-04 | +$1,231 | +$1,165 | −$66 | 2 | flat |

**Freefall safety:** The 3.2% range gate cannot fire during fast crashes (6h range >> 3.2% when market is in freefall). Nov/Dec are completely safe. The only damage is Feb (−$810 worse), from a single expansion K/F.

### 4C. Critical Warning: r4.0 fires in freefall

Loosening range to 4.0% causes the gate to fire in Nov 2025 (−$5,285 expansion loss) and Feb 2026 (−$4,187). The 3.2% threshold is the hard boundary between "stalled drawdown" and "active crash."

### 4D. Assessment

**Net verdict: marginal.** The best variant (r3.2_s0_m13) adds +$1,096 over 10 months (+11% relative) and lowers MaxDD by 6.6 points. But:
- Only 39 fires in 10 months (low sample)
- The operator already manages worst-month drawdowns manually (pause/flatten via Discord)
- With manual intervention removing freefall months, the expansion adds ~$2,283 on ~$16k base in good months — 14% lift
- Complexity cost: new state tracking, bigger position sizes at max depth, another config knob

**Decision: shelved.** The gate logic is validated and implemented in sim (`SIM_EXPAND=1`), available if needed. Not promoted to live.

---

## 5. S/R Level Engine — Mode Comparison

6 SR modes tested (ladder-only, same period):

| Mode | Equity | Return | MaxDD | ΔEq vs off | ΔDD |
|---|---|---|---|---|---|
| off (baseline) | $12,732 | +27.3% | 79.2% | — | — |
| skip | $14,517 | +45.2% | 72.6% | +$1,785 | −6.6p |
| scale | $13,060 | +30.6% | 77.7% | +$328 | −1.4p |
| boost | $12,230 | +22.3% | 81.3% | −$502 | +2.2p |
| both | $12,558 | +25.6% | 79.8% | −$174 | +0.7p |
| **skip-flatten** | **$14,801** | **+48.0%** | **70.4%** | **+$2,069** | **−8.7p** |

**Best mode: skip-flatten** (+$2,069, −8.7p DD). Combines:
- Skip rungs near resistance (149 blocks) — avoids entering at supply zones
- Close most-profitable rungs when price touches R (78 partial flattens) — banks gains at natural sell pressure

**Monthly breakdown (skip-flatten vs baseline):**

| Month | Base | Skip-Flatten | Δ |
|---|---|---|---|
| 2025-07 | +$2,250 | +$1,792 | −$459 (fewer adds) |
| 2025-08 | −$1,068 | +$2,207 | **+$3,274** (big save) |
| 2025-09 | +$3,353 | +$2,979 | −$374 |
| 2025-10 | +$2,265 | +$2,265 | $0 |
| 2025-11 | −$5,765 | −$5,765 | $0 (freefall, no R levels) |
| 2025-12 | −$1,944 | −$1,944 | $0 |
| 2026-01 | −$2,792 | −$2,807 | −$15 |
| 2026-02 | +$406 | +$47 | −$359 |
| 2026-03 | +$4,795 | +$4,795 | $0 |

**Key finding:** SR skip-flatten's main win is Aug 2025 (+$3,274 improvement) — resistance blocks and partial flattens prevented deep ladder builds into supply. Same pattern as expansion: useless in freefall (no R levels to trigger), helpful in choppy/trending months.

### 5A. Current Live Status

SR engine deployed to VPS (2026-04-11) with `enabled: true` in bot-config.json. On startup, engine loaded 0 active resistance levels (all recently broken in uptrend). The engine is dormant in bullish regimes and activates when new R levels form during consolidation or reversal — this is the expected behavior.

---

## 6. Open Questions for Further Research

### 6A. Unexplored Angles

1. **Regime-conditional TP%**: TP is fixed at 1.4%. Could a dynamic TP (wider in low-vol, tighter in high-vol) reduce stale count? 68 stale exits suggest the TP target is too ambitious for certain regimes.

2. **Rung-weighted TP**: Current TP uses arithmetic weighted average. The later rungs (largest) dominate. Would a TP formula that gives MORE weight to early rungs (wider target) improve outcomes when deep?

3. **Add-interval as a regime signal**: All max-depth episodes hit rung 11 in ~4 hours (median 4.1h at the 30min interval). This means 7–8 adds fire in rapid succession. Could a dynamic add interval (slow down adds when price is accelerating down) reduce kill exposure?

4. **Cross-asset SR calibration**: Current SR params (4H pivots, 1.2% cluster, 2-touch minimum) are tuned for HYPE volatility. Do these generalize to SUI, BTC, or other assets, or do they need per-asset tuning?

5. **Hedge interaction with SR**: The CRSI hedge (short when CRSI 4H < 15) currently ignores SR levels. If price approaches strong support, the hedge might be counter-productive (shorting into a floor). Could an SR-aware hedge gate improve hedge performance?

6. **Partial flatten aggressiveness**: Current skip-flatten keeps 3 rungs (the most underwater). Would keeping 1–2 improve PnL? Would keeping 4–5? The keepRungs param wasn't swept in the SR comparison.

7. **Time-of-day gating**: The HYPE short signal research found Thursday is the worst day for short entries. Is there a day-of-week or time-of-day pattern in ladder kill rates? If kills cluster at specific times, a simple calendar gate might help.

8. **Funding rate as add-gate**: The bot already has fundingSpikeGuard for exits. Could the funding rate also gate new adds? High funding = crowded longs = higher risk of cascade liquidation.

9. **Volume profile at rung 11**: None of the snapshot indicators included volume. Are kills associated with thin order books (low volume bars) vs TPs with healthy volume? Volume data is available in the 5m candles.

10. **Combining SR skip-flatten WITH dynamic expansion**: These address different problems — SR reduces exposure at supply zones, expansion adds exposure in stalled drawdowns. Could they coexist, and does the combination outperform either alone?

---

## 7. Data Availability

All findings above are reproducible via:

```bash
# Baseline
SIM_START=2025-07-01 npx ts-node src/sim-exact.ts

# SR mode comparison
SIM_SR_COMPARE=1 SIM_START=2025-07-01 npx ts-node src/sim-exact.ts

# Dynamic expansion
SIM_EXPAND=1 SIM_EXPAND_RANGE6=3.2 SIM_EXPAND_SLOPE6=0 SIM_EXPAND_MAX=13 SIM_START=2025-07-01 npx ts-node src/sim-exact.ts
```

CSV trade logs for all runs are persisted in `backtests/hype/`.
