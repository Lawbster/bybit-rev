# Manual Intervention Watchlist

Things the bot **doesn't** see but a human can. When you spot one of these in a sketchy area, the right move is usually `-pause` (block new adds) or `-closeladder` (flatten now).

The bot already handles: trend filter, BTC risk-off, ATR vol expansion, hard flatten @ 40h, emergency kill @ -10%, stale exits @ 8h/0.9%, ladder-local kill. Don't waste attention on those — focus on the gaps below.

---

## 1. Calendar / Macro (highest ROI, easiest to monitor)

The bot has zero calendar awareness. These are the events that have historically caused the worst clusters:

- **FOMC days** — 2pm ET. Vol explodes both sides. If we're mid-ladder going in, pause until close.
- **CPI / PCE / NFP** — 8:30am ET. Same thing.
- **Token unlocks** — HYPE has scheduled unlocks. Check unlocks.app weekly. Pause 4h before, resume 12h after.
- **Major exchange listings/delistings** — moves the whole sector.
- **Bybit maintenance windows** — bot can't trade through them, position risk is unmanaged. Pause beforehand.

**Action:** Set Google Calendar alerts for FOMC/CPI/PCE/NFP and HYPE unlock dates. 1h before → `-pause`.

---

## 2. Funding rate extremes (overrides bot's regime view)

Bot reacts to price/EMA. It doesn't see crowded positioning.

- **Funding spike >0.05%/8h while we're long** = crowded longs, top signal. If we're at 8+ rungs, this is where the rug usually comes from. Consider `-closeladder` to bank or scratch.
- **Funding flip negative + price still grinding up** = shorts getting paid to short, retail capitulating. *Good* for our long, hold.
- **Funding negative + price flat for 12+ hours** = distribution. The grind lower is coming. Pause new adds.

**Action:** Discord funding alarm already exists (`alarm-HYPE`). When it fires AND we're 8+ rungs deep, that's the "do something" trigger.

---

## 3. Multi-day slow bleeds (the silent killer)

This is what cost us the most in Nov 2025 and Feb 2026. The bot's hard-flatten is at 40h + -6%, and the kill is at -10%. There's a wide zone where the ladder is bleeding 3-4% over 3-5 days with no individual trigger firing — the trend filter sees range, ATR sees normal vol, BTC isn't risk-off.

**Pattern to watch:**
- 5+ consecutive daily lower highs
- Each day's range <3% (no expansion to trip ATR)
- Total drift -8% to -15% over a week
- Bot keeps adding rungs into it because each daily candle looks "fine"

**Action:** Once a day (morning coffee), pull up HYPE 1D chart. If you see 4+ red days in a row with shrinking ranges, `-pause` and let the existing ladder either TP or stale out. Resume once you see a real bounce candle.

---

## 4. Recovery rally fades (entry-side risk)

After a flush, the first 5-10% bounce is often a dead cat. Bot doesn't know this — it sees EMA reclaim and starts a fresh ladder right at the top of the bounce.

**Pattern:**
- We just flattened or killed
- Price rallies 5-8% in <12h
- Volume on the rally is *lower* than the dump volume
- Bot starts a new ladder at the top of the bounce → fresh DD immediately

**Action:** After a kill/flatten event, manually `-pause` for 24h. Let the bounce prove itself before re-engaging. The cooldown handles short cases but a manual hold during recoveries has more value.

---

## 5. BTC dominance shifts (alt-specific risk)

When BTC pumps and alts don't follow (or get sold), the alt-specific bleed can be brutal even with BTC risk-off filter passing.

**Pattern:**
- BTC up 3%+ in 24h
- HYPE flat or down vs BTC
- Funding turning negative

This is rotation *out* of alts. Ladder will bleed regardless of regime filters.

**Action:** Eyeball BTC.D on TradingView once a day. If BTC is ripping and HYPE isn't, pause until they re-correlate.

---

## 6. Liquidation cascades / wick events

Bybit-specific risk. A cascade through our SL zone can fill at terrible prices, or worse, leave a position un-stoppable for 30+ seconds while the matching engine is overloaded.

**Pattern:**
- Coinglass shows >$50M liqs in last hour on the pair
- Funding suddenly normalizes from extreme
- Our PnL shows a sharper drop than the price would suggest (slippage)

**Action:** If you see a cascade live, check our position immediately. If we ate slippage hard, consider closing the rest manually rather than waiting for stale/flatten.

---

## Suggested alarm setup

Discord webhook alarms to add (manual triggers, not bot actions):

| Alarm                              | Condition                                          | Why                            |
|------------------------------------|----------------------------------------------------|--------------------------------|
| **HYPE 5-day red streak**          | 5 consecutive daily closes lower                   | Slow bleed pattern             |
| **HYPE funding extreme**           | Already exists — make sure it pings phone          | Crowded positioning            |
| **BTC 24h move + HYPE divergence** | BTC ±3% while HYPE moves <1% same direction        | Rotation risk                  |
| **Bybit liq cascade**              | >$30M HYPE liqs in 1h (Coinglass API)              | Slippage / fill risk           |
| **FOMC/CPI day-of**                | Calendar reminder, 1h before release               | Macro vol                      |
| **Ladder depth + funding**         | We're at 8+ rungs AND funding >0.04%               | Top zone, consider banking     |

The first three are high-leverage, low-noise. The funding+depth combo is the single most actionable composite signal.

---

## Quick reference: when in doubt

| Situation                          | Action          |
|------------------------------------|-----------------|
| Macro event in <2h                 | `-pause`        |
| 5+ red daily candles, shrinking    | `-pause`        |
| Just killed/flattened              | `-pause` 24h    |
| Funding >0.05% AND 8+ rungs        | `-closeladder`  |
| BTC ripping, HYPE flat, negative funding | `-pause`  |
| Ladder up small, you're going to sleep | leave it    |

`-pause` is cheap (just blocks adds, exits still active). Use it liberally in sketchy zones. `-closeladder` is the nuke — only use when you have a clear thesis.
