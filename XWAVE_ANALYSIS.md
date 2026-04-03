# xwave Strategy Analysis — Codex Deep Dive Brief

**Data source**: `bybit-exports/gui-pull-xwave.xlsx`  
**Period**: 2026-02-16 → 2026-03-31 (44 days)  
**Total trades**: 5,121 (193 HYPEUSDT + **4,928 RIVERUSDT**)  
**Win rate**: 100% (zero loss trades in dataset)  

---

## Key Finding: This is NOT a HYPE strategy

xwave's **primary instrument is RIVERUSDT** — 96% of trades. The HYPE trades (193) are secondary/incidental. All prior xwave replication attempts on HYPEUSDT were targeting the wrong instrument.

---

## Strategy Parameters (derived from trade data)

### Instrument
- **Symbol**: RIVERUSDT perpetual
- **Side**: Long only (0 shorts in dataset)
- **Margin mode**: Cross margin
- **Leverage**: Started 25x (Feb 16 – ~Feb 25), shifted to **20x** from late Feb onward

### Position Sizing
- **Base notional**: ~$12–15 USDT per rung (avg $17.66, p50 $15.12)
- **Scale factor**: **1.6x notional** per add (p50 = 1.632)
  - Rung 1: ~$12, Rung 2: ~$20, Rung 3: ~$32, Rung 4: ~$52, Rung 5: ~$84, Rung 6: ~$135...
  - Confirmed from repeated episode patterns

### Take-Profit
- **TP%**: **0.7% unlevered** (4,064 / 4,928 = 83% of trades)
  - Secondary cluster: 0.6% (829 trades, 17%)
  - No losses — exit price always > entry price
- **Mechanism**: Batch TP — all positions at same entry price close simultaneously at same exit price
- **At 20x leverage**: 0.7% unlevered = **14% return on margin** per batch

### Add Logic
- **Poll frequency**: **Every 1 minute** — 93% of first entries open in seconds :00–:09 of the minute (2,433 vs 101 across remaining 50 seconds). This is definitive evidence of a 1-minute cron/poll bot.
- **Add interval within mini-ladders**: p50 = 4 min, avg = 7.6 min
  - 452 adds occur within the same minute (rapid cascade on fast drops)
  - Adds cluster heavily at 0–5 min intervals, tailing off exponentially
- **Add trigger**: Price-based, not time-based:
  - 69% of inter-batch transitions happen on down moves (avg -1.12%)
  - 31% happen on flat/up (new mini-ladder starts as previous TP'd)

### No Stop Loss
- **Zero loss trades across 4,928 RIVER positions**
- Pure Martingale: bot holds and adds indefinitely until recovery
- Cross margin allows full account buffer to absorb drawdown

---

## Structure: Nested Mini-Ladders (Grid-Martingale Hybrid)

xwave's strategy is **NOT a single DCA ladder** (like our 2Moon setup). It is a **continuous stream of independent mini-ladders**, each one:

1. Opens at the current price
2. Adds 1.6x if price drops before TP hits
3. All positions in the batch share one TP target (entry + 0.7%)
4. When TP hits → entire batch closes, new mini-ladder starts immediately

Multiple mini-ladders can be **open simultaneously** at different price levels during crashes.

**Evidence from Episode 5 (Feb 17, 17:40–23:44)**:
- 131 individual positions across many sequential mini-ladders
- At crash bottom (21:20), positions opened in 29-second window: $130 → $81 → $212 → $343 → $556 → $900 → **$1,458** notional — all at entry 9.945, all close at 10.003
- This is automated rapid Martingale cascade triggered by price hitting a level

**Episode sizing distribution**:
- Mini-ladder batch size: avg 3.3 rungs, p50 = 2, p90 = 6, max = 21
- Episode (6h grouping) size: min 3, p50 = 35, max = 131 trades

---

## Capital Exposure

- **Max concurrent notional observed**: $15,593 (at 20x = $780 margin)
- **Median max concurrent notional per episode**: $6,061 (at 20x = $303 margin)
- These figures imply capital of at least **$2,000–5,000** to sustain worst-case Martingale depth

At 10+ rungs deep at 1.6x scale from $12 base:
- Rung 10: $12 × 1.6^9 = $859 notional
- Rung 11: $12 × 1.6^10 = $1,375 notional
- Total 11-rung stack: ~$3,900 notional → $195 margin at 20x

---

## Why 100% WR Works on RIVER

1. **TP is only 0.7%** — extremely tight. RIVER as a mid-cap alt has enough intraday volatility to recover 0.7% quickly even after -5% drops.
2. **Cross margin + large capital buffer** — no forced liquidation from undercapitalized positions
3. **No stop loss** — the bot NEVER closes at a loss. Holds until recovery regardless of time.
4. **1.6x scale** — aggressive enough Martingale to average entry down rapidly, so TP distance collapses after each add

**Key risk**: A sustained trend down without recovery would accumulate exponentially. This has not occurred in the 44-day window. The strategy has significant **tail risk** in a prolonged RIVER bear market.

---

## Comparison to Our Live Bot (2Moon)

| Parameter | xwave (RIVER) | Our Bot (HYPE) |
|-----------|--------------|----------------|
| Symbol | RIVERUSDT | HYPEUSDT |
| Leverage | 20–25x | 50x |
| Base notional | ~$12–15 | $200 |
| Scale factor | 1.6x | 1.2x |
| TP% | 0.7% | 1.4% |
| Add interval | ~1 min (price-trigger) | 30 min + 0.5% price trigger |
| Stop / kill | None | Emergency kill -10%, hard flatten |
| Margin mode | Cross | Cross |
| WR mechanism | Martingale + tight TP | DCA + generous TP + safety exits |

---

## Codex: Questions to Investigate Further

### 1. Entry condition for first rung
The first open of each mini-ladder happens at :00–:09s of a minute. But **what triggers it?** Is it:
- **Time-only**: Open every minute unconditionally
- **Price drop**: Open only when close < previous close
- **Level-based**: Open only when price is X% below some reference (EMA, prior high)

To verify: cross-reference first-open timestamps with 1-minute RIVER OHLCV data. Check if RSI, EMA, or momentum filters are applied at open time, or if it's unconditional.

### 2. How does it decide to ADD vs not add?
Within a mini-ladder, the bot adds when the previous position hasn't TP'd. But is there a **minimum drop threshold** before adding? Or does it add on any new candle close?

To verify: check the price delta between consecutive adds in the same batch. If there's a consistent minimum drop (e.g., 0.3% or 0.5%), that's the add trigger.

### 3. Max rungs / capital protection
In the data, we see up to 21 rungs in a single batch and massive positions ($1,457). Is there a **max rung limit** or does it run until capital runs out?

To verify: find the deepest episodes and check if there's a consistent max depth. Also check if `leverage × notional > account_balance` ever occurs.

### 4. Multiple simultaneous mini-ladders
Do mini-ladders at different price levels run concurrently, or is it strictly sequential?

To verify: for any given timestamp, count how many open positions exist (openedAt ≤ ts ≤ closedAt). If > 1 batch is open simultaneously at different entry prices, it's a true grid.

### 5. The 0.6% vs 0.7% TP split
17% of trades close at 0.6%, 83% at 0.7%. Is this:
- A second TP tier (soft stale equivalent)?
- Rounding artifact from different price levels?
- A deliberate reduced TP for older positions?

To verify: check if 0.6% trades are older (longer hold time) or smaller size.

### 6. Leverage reduction (25x → 20x)
The leverage shifted from 25x to 20x around Feb 25. Was this:
- Manual config change
- Automated risk reduction after a bad episode
- Capital growth allowing smaller leverage for same exposure

To verify: check if there was a deep drawdown episode around Feb 20–25 that triggered the change.

### 7. Replication feasibility on RIVER
To replicate xwave on RIVER we need:
- RIVERUSDT 5m/1m candle data going back to Feb 2026
- Run a sim with: base=$12, scale=1.6x, TP=0.7%, addInterval=1min, leverage=20x, noStop=true
- Verify the capital required to survive worst-case episodes (~$2k–5k)

---

## Proposed Sim Parameters for RIVER replication

```typescript
const XWAVE_RIVER: SimConfig = {
  symbol:           "RIVERUSDT",
  leverage:         20,
  basePositionUsdt: 12,
  addScaleFactor:   1.6,
  tpPct:            0.7,
  addIntervalMin:   1,      // 1-minute poll
  priceTriggerPct:  0,      // price-trigger TBD from further analysis
  maxPositions:     15,     // TBD — set conservatively
  stopLossPct:      0,      // no stop
  emergencyKillPct: 0,      // no kill
  initialCapital:   2000,   // minimum to survive observed worst case
  feeRate:          0.00055,
};
```

**Priority before building sim**: Fetch RIVERUSDT 5m data for Feb–Mar 2026, then answer Questions 1–4 above to nail down the exact add trigger before running the backtest.
