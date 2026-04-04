# Codex Task: Automated Short Signal Discovery

## Required Reading (START HERE)

Before doing any work, read these files in order:

1. **`research/hype-short-signal-analysis.md`** — Full results from prior analysis. Contains 11 tested signals with exact WR%, expectancy, sample sizes, and verdicts. DO NOT re-test these signals — build on top of them.
2. **`research/hype-tokenomics.md`** — HYPE token supply, unlock schedule (6th of each month), burn rate, deflationary mechanics. Relevant for calendar-based signals and understanding supply-side price pressure.
3. **This file** — Your task specification, test matrix, and output format.

## Objective

Find a statistically profitable automated short entry system for crypto perpetuals (starting with HYPE, designed to generalize across altcoins). Must have **positive expectancy after fees** with tight TP targets (0.5-2%) and reasonable stop losses.

## Context

We run a DCA ladder long bot (hedgeguy-bot) on HYPEUSDT that prints during bull months but bleeds during bear/chop. The bot has no effective short hedge — our CRSI-based hedge fires 2x per year and loses money. We need a short signal that:
- Works as a standalone short bot OR as a hedge layer inside the main bot
- Uses tight TPs (1-2%) for fast in/out, not swing trades
- Can generalize across mid-cap altcoins (not HYPE-specific curve fitting)
- Operates on 5m/1H/4H timeframes (we have 5m data, aggregate up as needed)

## Data Available

- `data/HYPEUSDT_5_full.json` — 5m candles, Dec 2024 to Apr 2026 (~16 months)
- `data/BTCUSDT_5_full.json` — 5m candles, same period
- Candle format: `{ timestamp, open, high, low, close, volume, turnover }`
- No OI or funding data in files (available via Bybit API at runtime but not in historical data)

## What Has Already Been Tested (DO NOT REPEAT)

### Signals with NEGATIVE expectancy (proven losers on HYPE):

| Signal | Timeframe | Result | Why It Fails |
|---|---|---|---|
| Day-after reversal (short big green days) | Daily | Negative | HYPE doesn't mean-revert after pumps — trends continue |
| RSI14 overbought (>70, >80) | Daily | Negative | RSI >80 fires 4 times in 16 months; RSI 70-80 has no edge |
| EMA stretch + RSI (price >10-15% above EMA50) | 4H | Negative | HYPE stretches 15-20% beyond "overbought" before pulling back |
| Bearish RSI divergence (new high, lower RSI) | 4H | Negative | 49% WR, -0.77% avg — pure noise |
| Failed breakout (new 48h high, fails to hold) | 1H | Negative | 57% WR but TP/stop ratio kills expectancy (-0.073%) |
| Simple EMA50 rejection in bear regime | 1H | Marginal | 65% WR but -0.041% expectancy. Almost works — see below |

### Signals with POSITIVE or MARGINAL results:

| Signal | Timeframe | WR | Expectancy | Sample | Notes |
|---|---|---|---|---|---|
| Multi-confluence bear short | 1H | 80% | +0.80% | n=10 | BEST SIGNAL. Bear regime + RSI 55-80 + EMA50 rejection + wick + low vol |
| Thursday day-of-week | Daily | 61% red | -1.11% avg | n=69 | Structural edge, validates wed-short timing |
| Consecutive 2 green days reversal | Daily | 62% | -0.26% avg | n=66 | Too small after fees |
| Hour-of-day (11-12 UTC) | 1H | 54% short | +0.079% avg | n=481 | Not standalone but useful as timing filter |

### Key findings from prior analysis:

1. **Regime is everything.** Shorting in a bull trend (EMA50 > EMA200) is always negative expectancy on HYPE. All profitable short setups require confirmed bear regime.
2. **Volume is the strongest confirming filter.** Low-volume rallies in bear regimes = highest conviction shorts. High-volume rallies, even in bear, signal reversals.
3. **Tight TPs (1-1.5%) work better than wide.** Bear-regime bounces are shallow.
4. **Max adverse excursion is typically 5-10%.** Any short needs to tolerate 3-5% drawdown before TP hits.
5. **The EMA50 rejection setup (signal #8) is the closest to working.** 65% WR, just barely negative expectancy. With one more confirming filter, this could flip positive.

---

## Your Task

### Phase 1: Indicator Testing (NEW signals not yet tested)

Test each of the following on HYPEUSDT 5m/1H/4H data. For every signal, measure:
- Forward returns at 1, 3, 6, 12, 24 bars
- Win rate with TP/stop combos: [0.75/1.5, 1.0/1.5, 1.0/2.0, 1.5/2.0, 1.5/3.0]
- Max adverse excursion (how far price goes against you before TP)
- Sample size (must be >20 to be meaningful)

#### A. ADX-Based Setups
- **ADX trend exhaustion**: ADX(14) was >30 (strong trend) and drops below 25 (trend weakening) while price is still elevated. Short the loss of momentum.
- **ADX + DI crossover**: -DI crosses above +DI while ADX >20. Classic bearish crossover.
- **ADX collapse from extreme**: ADX drops from >40 to <30 in <12 bars. Exhaustion of a parabolic move.

#### B. Bollinger Band Setups
- **BB upper band rejection**: Price touches or exceeds upper BB(20,2) then closes inside. Short on the re-entry candle.
- **BB squeeze breakout failure**: BBW (bandwidth) contracts to <3% then expands; if first expansion candle is green but next is red, short.
- **BB walk exhaustion**: Price has been walking the upper band (close > upper BB) for 3+ bars then closes below upper BB.

#### C. Pump Fade Setups (CRITICAL — test thoroughly)
- **Immediate pump fade**: After a candle with >3% body on 1H (or >1.5% on 5m), short X minutes/bars later. Test delays of 1, 2, 3, 6, 12 bars after the pump candle.
- **Pump + volume climax**: Green candle >3% body AND volume >3x SMA20. Short after close.
- **Pump exhaustion**: 3+ consecutive green 1H candles with each having smaller body than the prior (momentum fading).
- **Spike rejection**: 5m candle spikes >1% above prior high then closes red (wick). Short at close. This is the "doji after spike" pattern.

#### D. VWAP / Anchored VWAP
- **VWAP deviation short**: Price >2 standard deviations above session VWAP. Short expecting reversion.
- **VWAP rejection**: Price touches VWAP from below in a downtrend and fails. Short the failure.

#### E. Stochastic Setups
- **Stoch(14,3,3) overbought cross**: %K crosses below %D above 80. Short.
- **Stoch divergence**: New price high, lower stochastic high. Short.
- **Double stoch rejection**: Stoch enters >80, dips below, re-enters >80, then crosses down. Short on the second cross.

#### F. Market Structure
- **Lower high confirmation**: Price makes a high, pulls back, rallies but fails to exceed prior high by >0.3%. Short the confirmed lower high.
- **Support break retest**: Price breaks below a support level (prior swing low), bounces back to retest from below, gets rejected. Short the rejection.
- **Range high rejection**: Price has been in a range (ATR compressed <50% of 20-bar avg) for 12+ bars, touches the top of range, reverses. Short.

#### G. Multi-Timeframe
- **4H bearish + 1H entry**: 4H close below EMA20 while 1H shows a bounce into EMA20 rejection. Short the 1H rejection with 4H directional bias.
- **Daily red + 1H overbought**: Daily candle is currently red (open > current price), 1H RSI > 65. Short.
- **1H bearish engulfing after 4H overbought**: 4H RSI > 65, then 1H prints a bearish engulfing candle. Short.

#### H. Time-Based / Calendar
- **Pre-unlock short (day 4-5 of month)**: Short 1-2 days before HYPE monthly unlock (6th). Test with and without regime filter.
- **Weekend fade**: Short Friday 20:00-23:00 UTC, close Monday 00:00 UTC. Crypto tends to dump weekends.
- **Funding settlement short**: Short 30-60 min before 8H funding settlement (00:00, 08:00, 16:00 UTC) if funding is positive (longs paying).

#### I. Composite / Ensemble Scoring
- Build a **confluence score** (0-5) from: regime (EMA bear), RSI overbought, volume declining, wick rejection, ADX weakening. Test shorting at score >= 3, >= 4.
- Compare to the existing multi-confluence signal (n=10 at 80% WR) — does the scoring approach match or improve?

### Phase 2: Cross-Asset Validation

Take the top 3 signals from Phase 1 and test on BTCUSDT 5m data (same file). If a signal works on both HYPE and BTC, it's more likely generalizable.

### Phase 3: Combination & Optimization

- Take the top 2-3 signals and combine them into a single strategy
- Test with realistic fees: 0.055% per side (taker) = 0.11% round trip
- Include funding costs for holds >8h
- Determine optimal: TP%, stop%, max hold time, position sizing

---

## Output Format

For each signal tested, produce a block like:

```
### Signal: [Name]
- Timeframe: [5m/1H/4H]
- Logic: [exact entry conditions]
- Regime filter: [yes/no, which]
- Sample size: N=XX
- TP/Stop results:
  | TP | Stop | Wins | Losses | Flat | WR | Expectancy |
  |...|...|...|...|...|...|...|
- Max adverse excursion: avg X%, p95 Y%
- Verdict: [PROFITABLE / MARGINAL / USELESS]
- Notes: [anything interesting]
```

At the end, produce a **ranked summary table** of ALL signals tested (including the ones from prior analysis listed above) sorted by expectancy.

## Important Notes

- Use UTC timestamps throughout (never local time methods — `new Date().toISOString()`, not `toLocaleString()`)
- Aggregate 5m data into 1H/4H using the `aggregate()` pattern (group by floored timestamp, track OHLCV)
- RSI calculation: standard Wilder smoothing
- EMA calculation: `k = 2/(p+1)`, recursive
- De-cluster signals: skip if same signal fired within last N bars (prevents double-counting)
- When testing TP/stop: simulate bar-by-bar, check if low hit TP before high hit stop (for shorts: if HIGH exceeds stop first, that's a loss even if LOW also hit TP in same bar)
- HYPE has 30-60% monthly ranges — this is NOT a low-vol asset. Calibrate thresholds accordingly.
- All results should be written to `research/codex-short-signal-results.md`

## File Structure

```
reverse-copy/
  data/
    HYPEUSDT_5_full.json    # 5m candle data (~16 months, Dec 2024 - Apr 2026)
    BTCUSDT_5_full.json     # 5m candle data (same period)
  research/
    hype-tokenomics.md           # READ: HYPE supply, unlocks, burns, HAF
    hype-short-signal-analysis.md # READ: 11 signals already tested with full results
    codex-short-signal-task.md    # READ: This file — your task spec
    codex-short-signal-results.md # WRITE: Your output goes here
```

**Workflow:** Read the three input files above, then write all results to `codex-short-signal-results.md`.
