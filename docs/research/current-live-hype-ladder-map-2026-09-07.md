# Current HYPE long ladder: configuration and decision map

Mapped September 7, 2026. Documentation only; no strategy, execution, config,
state, or deployment changes. Read this before transferring standalone indicator
results into the ladder. This is a behavior map, not a new profitability verdict.

## 1. Evidence boundary

- Configuration: [bot-config.json](../../bot-config.json), expanded with
  `loadBotConfig()` from [bot-config.ts](../../src/bot/bot-config.ts).
- Repository HEAD: `db4fda1` (`Pause HYPE short entries after forward replay`).
- Config SHA-256:
  `5b4ce89f5cf3d66b70bd118fab95697f8c6f5b26253d3d7a484555856153dba5`.
- Main caller SHA-256 (`src/bot/index.ts`):
  `de38db24aeeb01af184bbf010b0978bb28f757c0d38b3cab3e030bf1ba61de98`.
- Latest copied runtime snapshot: **2026-09-07 04:30:54.175 UTC**,
  `data/HYPEUSDT_runtime_health.json`; process start August 31 23:14:39.272 UTC.
- Cross-checks: copied `bot-state.json` and the tail/startup records of
  `logs/pm2/hedgeguy-bot-out.log`. No private exchange or VPS queries were made.

The snapshot corroborates LIVE mode, 11 rungs, 673.88 HYPE locally and on exchange,
no pending transaction/recovery, active maker TP, confirmed 0.5% target, and
healthy 14-day S/R coverage. Copied state has daily breaker and damaged latch
inactive; cooldown timestamps have expired. Last status prints `Gates: all clear`,
but this is not a complete per-gate audit: several add gates are only evaluated
when an add is otherwise eligible. At 11/11, the depth cap itself prevents adds.

This is **exact local policy plus dated deployment corroboration**, not proof of
every currently deployed byte. Existing uncommitted work includes quality-aware
HL book/asset observation handling in `src/bot/shadow-logger.ts` and collector
receipt metadata. Its presence locally does not establish deployment. Thresholds
below are distinct from those pending data-interpretation changes. No local
`override.json` exists; absence in a local data pull does not prove absence on VPS.

## 2. Core sizing and add trigger

| Setting | Effective value |
|---|---|
| Instrument / owner | HYPEUSDT linear long, main ladder; long position index 1 |
| Base / multiplier / cap | $800 × 1.35 per next rung; 11 simultaneously retained rungs |
| Leverage | 25× |
| Add polling | 10-second configured sleep, plus work/API latency; not a hard 10-second deadline |
| Ordinary time trigger | At least 30 minutes since `lastAddTime` |
| Alternative price trigger | Current decision price <= latest retained rung's fill price × 0.997 |
| Normal batch TP | Quantity-weighted average entry × 1.014 |
| Taker fee assumption | 0.00055 = 0.055% per side |
| Maker exit fee assumption | 0.0002 = 0.020% per side |
| Account drawdown kill | **Disabled** (`maxDrawdownPct=0`) |
| Synthetic starting capital | $1,000; not the live sizing base or a $1,000 position limit |

Sizing is `800 * 1.35 ** positions.length` before the next add. It is not
equity-proportional compounding. After partial exits, **remaining position count**
determines the next size, not the largest historical `level` label.

| Rung being opened | Requested notional | Cumulative requested notional |
|---|---:|---:|
| 1 | $800.00 | $800.00 |
| 2 | $1,080.00 | $1,880.00 |
| 3 | $1,458.00 | $3,338.00 |
| 4 | $1,968.30 | $5,306.30 |
| 5 | $2,657.21 | $7,963.51 |
| 6 | $3,587.23 | $11,550.73 |
| 7 | $4,842.76 | $16,393.49 |
| 8 | $6,537.72 | $22,931.21 |
| 9 | $8,825.92 | $31,757.13 |
| 10 | $11,915.00 | $43,672.13 |
| 11 | $16,085.24 | **$59,757.37** |

Values are independently rounded for display; execution quantities and fill
prices change actual notionals. Rung 11 is approximately 26.9% of full requested
exposure; rungs 9-11 together approximately 61.6%. Simple notional/25 margin is
$2,390.29 for the full ladder, **not maximum loss or an exchange margin guarantee**.

The local affordability check requires positive `capital` and
`capital - sum(retained entry notional / leverage) >= next notional / leverage`.
Capital is refreshed from the wallet, with `initialCapital + realizedPnl` as
fallback. It is not a complete shared-account margin/liquidation calculation.

The ordinary timing logic is:

```text
depth < effective cap
AND (time trigger OR price-drop trigger OR manual-cap bridging exception)
AND all applicable strategy/operational gates permit
AND sufficient modeled margin
AND transaction owner permits mutation
```

Consequently, **an add does not generally require falling price, support, or a
bullish indicator signal**. A timer add can be above the preceding fill. A
price-triggered add need not wait 30/60 minutes. Trigger prices are decision
quotes, not necessarily the subsequently recorded fill prices.

Sources: `strategy.ts:34,57,68`; `index.ts:1225,2744,3571`.

## 3. Active entry/add blockers

All percentage PnL gates below use price relative to quantity-weighted average
entry, before trading fees, not leveraged account return. Ages use the oldest
**remaining** rung; they do not measure time spent continuously underwater.

| Gate | Exact blocking rule | Scope / release |
|---|---|---|
| Depth cap | Retained count >= 11, absent override | No additional rung; does not close existing inventory |
| Trend break | Last completed HYPE 4h close < EMA200 **AND** EMA50 < previous EMA50 | All entries/adds; either condition clearing removes this particular block |
| Damaged-regime latch | Completed 4h close at least 4% below EMA200 **AND** healthy HL taker15m <= 0.85 **OR** healthy taker1h <= 0.90, with the OR confined to flow | All entries/adds; persists until two consecutive completed 4h closes are **strictly above** -1% EMA200 distance |
| Daily regime breaker | Five consecutive UTC daily close-to-previous-close declines | All entries/adds; two consecutive non-red closes while blocked release it |
| BTC risk-off | Last completed BTC 1h close-to-close return **< -3%** | All entries/adds; blocks for 120 minutes from detection |
| Ladder-local kill | Oldest retained rung >= 12 hours **AND** ladder PnL <= -3% | Adds only; **not a flatten instruction**, despite its name |
| Overextended entry | Completed HYPE 12h return >= 2.55% **AND** context CRSI4h <= 56.9 **AND** context RSI14 1h >= 59.4 | **First rung only**; no equivalent RSI/CRSI veto on rungs 2-11 |
| Deep funding stress | Already >= 5 positions **AND** any available Bybit/Binance/HL funding rate < 0 **AND** no price-drop qualification | Blocks time-only expansion beginning with **rung 6**; narrow support-reopen exception below |
| Deep add throttle | Already >= 5 positions **AND** approximate 6h price change <= -0.5% | Changes time interval 30 -> 60 minutes; **does not block a qualifying price-drop add** |
| Post-forced-exit cooldown | Current time before persisted deadline | All entries/adds; successful emergency/funding/hard flatten sets deadline to `(floor(now/4h)+2)*4h`, approximately 4-8 hours later |
| Post-TP cooldown | At full TP finalization, context RSI14 1h **> 60** | 30 minutes with no new entries/adds; shares the forced-exit cooldown field |

The damaged-latch trigger is unambiguously:

```text
dist4h <= -4% AND ((healthy15m AND taker15m <= 0.85)
                 OR (healthy1h AND taker1h <= 0.90))
```

HL taker ratios are buy/sell notional, not buy share. Required samples are 14/15
distinct minutes or 55/60, respectively, with observation age <= 90 seconds.
The latch is evaluated at most once per minute, including while manually paused
or cooling down. Once active, missing pulse does not clear it; missing 4h structure
also retains it. When inactive, absent qualifying pulse does not create a new
block. Fresh/uninitialized state bootstraps active from `dist4h <= -4%` alone;
this migration rule differs from subsequent pulse-confirmed triggers.

Daily details: current configuration is **5 red / 2 non-red**, not the old
4-red comment. Red means today's close < yesterday's close, not close < open.
An equal close counts as non-red for release. `flatActive` means block adds;
it does not imply the exchange position was flattened.

Deep-guard details: both configured OI block thresholds are `null`, so they are
inactive. Funding zero is not negative. Unknown funding is not affirmative
stress evidence. A qualifying 0.3% drop bypasses this funding guard, **never the
trend, damaged-latch, daily, BTC, or other outer gates**.

Sources: `strategy.ts:97,181,236,284,318,381`;
`damaged-regime-latch.ts:73,109`; `index.ts:724,809,2225,2734,2744,3236,3329`.

## 4. Exact S/R and pulse use

### Level construction

The active memory engine uses 30-minute candles assembled from 5-minute data:

- Strict pivots: 4 bars on each side; an equal neighbouring high/low disqualifies
  that pivot. The right-side confirmation bar must have closed before use.
- Levels cluster confirmed pivot prices within **0.45%**; level price is the
  touch-count-weighted mean. At least two confirmed touches are required.
- Recent memory: **14 days of confirmation timestamps**. High and low pivots can
  belong to the same cluster. A level above current price is resistance; below
  is support. This engine does not impose the disabled legacy engine's separate
  two-bar broken-level rule.
- Ordinary nearest-level lookup reaches 1%; live partial action narrows this to
  0.3%. Shadow-only wider lookups reach 3%, with a separate 0.75% lookup above TP.
- Live S/R actions require continuous coverage through the latest fully closed
  5m candle for the configured 14-day horizon (normally 4,032 bars). Startup
  attempts a bounded best-effort 140-day hydration; that is not the action horizon.
- Rebuild is requested on a new 30m bucket, using only already confirmed pivots.

Source: [sr-memory-zones.ts](../../src/bot/sr-memory-zones.ts), especially lines
57-119 and 161-187; [context-manager.ts](../../src/bot/context-manager.ts).

### Live resistance partial exit

All are required:

1. At least **6 retained rungs**, with the 60-minute S/R-action cooldown expired.
2. Healthy S/R coverage and a confirmed resistance **above** price, at most 0.3% away.
3. Whole-ladder gross price PnL >= **+0.25%**.
4. Plan closes `depth - 3` rungs, ranked by **absolute unrealized dollar PnL**,
   leaving the three lowest-dollar-PnL rungs. It is not a fixed 50% quantity trim.
5. The selected plan's aggregate estimated PnL is **positive after both entry and
   exit taker fees**. Individual selected rungs need not all be profitable.
6. The exact candidate
   `zone30_partial_exit_resistance_deep6_profit_deteriorating_shadow` fires.

Its deteriorating-pulse test is **any** of:

```text
mean available Bybit/Binance/HL USD-OI change over 4h <= -0.25%
OR Binance taker buy/sell volume ratio over 4h <= 0.98
OR BTC movement over the read 4h minute window <= -0.25%
OR (any funding < 0 AND (mean OI change <= 0 OR Binance taker4h <= 1.05))
```

This is **not** an HL-15m-only exit discriminator. USD-OI changes can also reflect
mark-price movement; they are not identical to changes in native OI quantity.
Unavailable fields do not themselves satisfy a predicate. Unlike support-reopen,
this partial predicate does not demand all three pulse streams be healthy under
a common freshness/sample gate.

The transaction closes selected position IDs, accounts for actual observed
fills, refreshes capital and TP, and persists the S/R cooldown. It reanchors
`lastAddTime` to the latest retained entry. The 60-minute cooldown suppresses
**another S/R partial exit**, not all adds for 60 minutes. Rebuilding from the
remaining depth can subsequently increase exposure again under ordinary gates.

Sources: `sr-shadow.ts:150,225,237,255,300,353`; `index.ts:2441,2533`;
`state.ts` partial-transaction commit path.

### Live support-reopen exception

Despite its name, this does not independently start a ladder or re-enter after a
full flatten. It can permit an otherwise **funding-only-blocked time add**:

- Deep guard must actually be blocking, solely on funding, with `priceDropOk=false`.
- `nextDepth >= 5` is configured, but the current deep guard first blocks at
  nextDepth **6**, so rung 5 cannot use this exception in the present stack.
- Confirmed support below price and <= 1% away; healthy S/R coverage and rebuilt map.
- **Buy pressure:** HL taker15m >= 1.20 **OR** taker1h >= 1.20.
- **Bid wall:** HL 0.5% band imbalance >= 0.20 **OR** ask/bid notional <= 0.75.
- **OI expansion:** HL marked-USD asset OI 1h >= +0.25% **OR** 4h >= +0.75%.
- These three groups are combined with **AND**. Book age <= 30s; taker age <= 90s
  and 14/55 samples for the qualifying window; asset age <= 60s, qualifying OI
  anchor lag <= 120s.
- All outer gates retain authority. The exception is rechecked with fresh pulse
  and S/R evidence before submission; a failed recheck blocks the exceptional add.

Source: [sr-support-reopen.ts](../../src/bot/sr-support-reopen.ts):8,89,123;
`index.ts:3236,3519`.

### Not active: universal resistance entry blocking

`bot-config.json` omits `srLevels`. The loader fills in
`DEFAULT_SR_CONFIG.enabled=false`. Therefore the old **4h** resistance skip-add
and old S/R partial-flatten engine are disabled. The active 30m memory engine
does not automatically turn those on. Its many `skip_add` candidates are shadows.

There is no active generic "rung 11 within X% of the daily high -> wait" gate,
nor a blanket "resistance + weak HL -> veto every deep add" gate.

## 5. Exit stack and fee execution

Independent WS TP checks run on executable best bid. Main-loop exit order, when
that branch is reached and no order is in flight, is:

| Order | Active action | Exact trigger |
|---|---|---|
| 1 | Emergency full close | Ladder price PnL <= -14%; no age/depth/trend requirement |
| 2 | Funding-spike full close | >= 8 retained rungs and Bybit WS funding rate >= 0.00012 (0.012% as supplied) |
| 3 | Hard full close | Oldest retained rung >= 12h **AND** price PnL <= -2% **AND** the same 4h trend-break condition is hostile |
| 4 | S/R memory partial exit | Exact profit/resistance/pulse conditions above |
| 5 | Soft-stale target adjustment | Age >= 4h **AND** price PnL < +0.5% -> target becomes average entry +0.5% |

Soft stale is reevaluated, not permanently latched; when its predicate no longer
holds, the main loop restores 1.4%. A position older than 12h is **not** closed
merely for reaching a timeout. A -2% loss in a non-hostile trend is also not by
itself a hard-flatten trigger. Funding-spike comparison uses the raw supplied
rate; the caller does not normalize differing funding intervals.

Maker TP is **enabled**, with a 2,000ms touch/partial-fill grace:

1. Establish the native target, then submit/observe a reduce-only PostOnly sell
   for the current long quantity. Maker sell price is rounded up to the tick;
   native long TP verification uses its down-rounded tick value.
2. Only after the maker is observed active and quantities match, clear/verify
   removal of native TP. **Native TP is not continuously present alongside a
   healthy resting maker order.** `desiredLongTp.syncStatus=confirmed` is an
   intent/protection field, not proof the native conditional TP remains set.
3. On touch/partial-fill close intent, allow the configured grace, then cancel
   and resolve ownership before market-closing the confirmed remainder. Grace
   is not a guaranteed wall-clock completion time under API/loop delays.
4. Before an add/S/R partial, restore and verify native protection, then cancel
   and resolve the standing maker. Ambiguous cancellation/fills block mutation.
5. Forced exits persist close intent and use cancel/reconcile/market fallback;
   they do not wait for a profitable maker fill. Pending/recovery is not success.

Market opens, S/R reductions and emergency/hard/funding exits are not made
maker-only by this setting. Fees in local trade accounting use configured rates;
do not equate every local estimated fee with an exchange-billed fee receipt.

Sources: `strategy.ts:608,633,671,693`; `index.ts:1072,1194,1325,1692,2225,2644`;
[maker-tp-coordinator.ts](../../src/bot/maker-tp-coordinator.ts).

## 6. Decision order, safety holds and manual controls

Simplified main-loop order (WS/REST TP callbacks also run independently):

```text
Resolve existing maker / durable long transactions first
  -> refresh context, S/R coverage and damaged latch
  -> process manual controls / manual pause
  -> periodic reconciliation, equity and exit checks
  -> recovery / stale feed / post-exit cooldown holds
  -> calculate depth and timing eligibility
  -> deep funding guard, potentially support-reopen exception
  -> trend, damaged latch, BTC, ladder-local, first-entry, daily gates
  -> revalidate support exception if used; affordability check
  -> acquire long-side mutation ownership; quiesce maker; transact add
```

- Startup and normal periodic reconciliation (5 minutes) compare quantity using
  `max(lotStep/2, 1e-8)` tolerance. With 0.01 HYPE steps this is 0.005 HYPE,
  not 5% size drift. Mismatch/ambiguous close evidence holds recovery.
- Pending transaction ownership, `orderInFlight`, and `LongSideGuard` prevent
  conflicting long mutations. Existing maker resolution normally polls every
  30s, faster through close/deadline paths. No order-row lookup is a guaranteed fill.
- WS silence > 10s enables REST TP checking through a 5s heartbeat; > 30s blocks
  adds. A fresh WS update clears that stale-feed block.
- `bot-pause`: **broader than strategy gates**. The main loop continues before
  periodic position reconciliation and normal emergency/funding/hard/S/R/soft-stale
  checks. Independent WS/REST TP callbacks and earlier transaction/maker resolution
  remain, as does the resting exchange order. Do not describe manual pause as
  "every exit still runs normally". This is documented behavior, not changed here.
- `bot-flatten`: requests a transactional close and creates pause; does not
  authorize manual state deletion. `bot-resume` consumes/removes manual pause;
  it does not bypass other policy gates.
- `bot-regime-arm`: explicit manual daily-breaker reset only, processed in the
  eligible-add branch; it does not release the damaged latch or EMA gate.
- `override.json`: matching symbol can change max positions. A bridging timing
  exception exists at the normal cap; ordinary outer gates still apply. A
  one-shot override is removed through the full-close finalizer. No local override
  was found for this map.
- Watchdog is alert-only; it does not submit orders, auto-pause or auto-restart.

Sources: `index.ts:126,170,446,1292,1442,1798,1819,2075,2709,2770,3400`.

## 7. Active versus observational/inactive systems

| Surface | Present status / actual effect on ladder |
|---|---|
| EMA, daily breaker, damaged latch, BTC, overextension | Live entry/add gates described above |
| Negative-funding deep guard / falling-price timer throttle | Live, starting with sixth rung |
| 30m S/R partial action / support-reopen action | Live, narrowly scoped |
| Legacy `srLevels` 4h engine | Disabled default; no blanket resistance gate |
| `filters.volExpansion` | False; caller's path is also shadow logging, not an entry veto |
| `scorePartialFlatten` | Enabled evaluation but `shadowOnly=true`, `emitSignals=false`; no 75% live trim |
| `pullbackExitShadow`, `pullbackActionShadow` | Observers enabled; both actual pullback action flags false |
| `hfDeferShadow` | Observer enabled; does **not** defer live hard flattens by 30m |
| `euphoriaStopShadow` | Observer enabled; no live euphoria stop |
| Broad `euphoriaShadow` | Disabled |
| `hedgeShadow` / embedded `hedge` | Observer enabled; actual embedded hedge disabled |
| Pre-kill score >= 4.5 | Warning/telemetry, not an order or add veto |
| Technical confluence grade, most RSI/CRSI/ADX/VWAP output | Descriptive outside explicitly mapped consumers |
| Upside readiness / euphoria cap / grind-mid / tail-stepdown labels | Observational report; do not alter this caller's $800 sizing or 11-rung cap |
| Dedicated HYPE short | Separate owner; `enabled=true`, **`entryEnabled=false`**; dormant $25k setting is not an active ladder hedge |
| C01/C02/T01 indicator combinations and UTC exclusions | Research only; no live MFI/time-of-day/weekend entry veto |

## 8. Timing and data caveats for research transfer

Do not silently turn this map into a claim of perfect replay/live equivalence.

- Direct HYPE trend/latch 4h inputs exclude unfinished bars with a 10s close
  grace. HYPE 4h cache refresh is boundary-aware. BTC/HYPE 1h caches have a
  one-hour fetch TTL and the daily cache is refreshed hourly, so detection can
  lag a candle's exchange close.
- Context RSI/CRSI comes from `LiveContextManager.getContext()` over refreshed
  5m snapshots; `technical-engine.ts:452` aggregates those without excluding
  every unfinished higher-timeframe bucket. These are evolving values genuinely
  available live, **not completed-bar indicator values**. A historical final-bar
  series cannot substitute for them before that bar closes.
- The throttle's "6h" change is literally latest 5m close versus array index
  `length-72` (71 intervals on a continuous series), potentially using the current
  forming 5m snapshot. Preserve that distinction from a closed, exact-6h feature.
- Gates do not share one universal fail-closed data policy. Missing trend/first-
  entry inputs can return unblocked; inactive damaged latch needs qualifying flow;
  active latch holds on missing structure; support-reopen requires healthy inputs;
  deep-pulse/daily fetch exceptions are logged by their callers. Healthy S/R
  coverage is not certification of all pulse fields or all technical indicators.
- Many add filters/daily state updates occur only after timing/deep-stress
  eligibility. A status panel or old daily counter is not a continuously refreshed
  all-gates snapshot. The damaged latch is intentionally refreshed earlier.
- Current minute replay is a **causal research model**, not a simulator of actual
  maker queue fills, cancellation races, exact REST deliveries, or 10s scheduling.
  It uses taker fees on both sides and omits actual funding. Existing live funding
  bookkeeping also has an 8h bucket/fallback-rate path, not a verified exchange
  settlement ledger. Keep accounting-model caveats separate from gate effects.

Read [the current-stack replay contract](current-stack-replay.md),
[closed-bar timing contract](closed-bar-indicator-testing.md), and
[September 4 parity audit](../../research/codex-astra-current-stack-parity-findings-2026-09-04.md)
before claiming a standalone result is an exact live-stack improvement.

## 9. What future candidates must be compared against

This map prevents confusing an already-active rule, a shadow, and a genuinely new
decision. It does not approve a new rule. For each later candidate, state:

- Does it affect the first rung, time-only expansion, genuine price-drop adds,
  residual inventory after a partial, an exit, or full-cycle re-entry?
- Does it add information beyond the active gates, or merely rediscover them?
- What exact source/timeframe was available, and does the feature exist in live
  data under the same definition? Binance taker4h is not HL taker15m.
- Does it suppress a $800 start or a $16,085 eleventh rung? Does it move later
  entries/TP cycles and change the entire inventory path?
- Compare with the unchanged current-stack baseline over the identical period,
  showing wins, losses, their dollar amounts, monthly PnL deltas, drawdown and
  retained inventory. Standalone $10k/12h results are leads, not ladder PnL deltas.

No new simulation cases were run for this mapping task. The three proposed
follow-up research questions remain pending.
