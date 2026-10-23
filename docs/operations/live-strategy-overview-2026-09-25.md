# HYPE portfolio

One account. One trading service. Seven rule sets.

## Operational live config explained

**All trading runs through `hype-portfolio-live` on hypehedgeguy, UID 555249668.** The old ladder and LAWBSTER SFP services are stopped. Bybit combines positions by long/short side; the portfolio tracks which quantity belongs to each strategy.

**Latest synced evidence: October 23, 2026, 19:28:43 UTC.** Live, armed and healthy; all owners flat, no pending orders or recovery, equity/free balance **$18,667.09**. This is a dated local snapshot, not a fresh exchange query.

**Selected sizing update — prepared, deployment unconfirmed.** `PAL02-PA07-3x-others-1.3x-v1` changes new entry tickets only. The last confirmed deployment uses the baseline (`HS01-base-v1`, also the default when the config field is absent). Check **New-entry sizing** in `-status` after cutover. Existing positions, submitted orders and brackets retain their original quantities. [Verification and limits](portfolio-selective-sizing-2026-10-23.md); [cutover/rollback](portfolio-live.md#october-23-selective-sizing--prepared-deployment-unconfirmed).

| Allocation | Baseline | Selected new-entry ticket |
|---|---:|---:|
| Ladder | $800 first buy → $59,757 at 11 rungs | Unchanged |
| PA07 short, shared slot | $6,666.67 | $20,000 |
| SFP / ADX long / ADX short / CRSI, shared slots | $6,666.67 each | $8,666.67 each |
| MACD short, separate R3 allocation | $10,000 | $13,000 |

Notional means position value, **not collateral**. Sizes do not compound. Three slots still compete; PA07 does not gain a fourth slot. Gross exposure at every maximum is about **$110,091** selected versus **$89,757** baseline, before market moves. **The selected maximum book does not fit the latest balance:** even before extra stop-risk reserves it needs about $19,324 including new auxiliary fees. The capital guard refuses additional exposure; it does not shrink a ticket or force an existing trade closed.

### Shared permission and capital

- Bybit is in **hedge mode, cross margin, 25× on both HYPE sides**. Internal capital budgeting is more conservative: ladder at 25×, every other setup at 3×. This does not change exchange leverage.
- Selected ticket budgets: **PA07 $6,706.67**, other shared setups **$2,906.22 each**, MACD **$4,359.33**, before separate round-trip fees. Bracketed trades also face a stop-risk plus 5%-of-notional reserve. Existing exposure and unresolved reservations consume the same cash; old obligations keep their old amounts.
- All entries require enabled live config, no portfolio pause/drain, usable price/account/signal data, resolved ownership and enough shared capital. Missing inputs block dependent decisions; independent exits continue where possible.
- Each setup source can hold **one trade at a time**. Five sources share three slots; no averaging or replacing an occupied slot. Simultaneous signals use frozen signal-ID ordering. Setup allocation runs before the next ladder add. Rejected/expired signals are not queued for later.
- **Ladder trend, BTC, damaged-regime and cooldown gates belong to the ladder only.** Other setup sources do not inherit them. A blocked ladder does not mean the portfolio cannot trade.

The VPS overrides `portfolio-live-config.json` to enabled/live/entries-on; repository defaults remain disabled/observe/entries-off. Preserve that local config on updates. `bot-config.json` supplies the pinned ladder rules, not a second running bot. Legacy `sfp-live-config.json` no longer configures the active SFP.

**No portfolio-wide equity stop is configured.** The ladder's −14% emergency rule is a price loss on ladder inventory, not a 14% account-loss ceiling. Timed setups without a price stop can lose more than their margin budget.

## Live trade setups

Choose a setup. Sizes below show **selected / baseline** until deployment is confirmed; rules and gates are unchanged. All use the same account and service. Times are UTC; decisions use published, completed candles.

### Ladder

**Long · $800 base × 1.35 · up to 11 rungs · Aggressive10 profile.** Buy repeatedly when the gates permit; no positive SFP or support-bounce signal is needed.

#### Enter and add

1. When flat and eligible, market-buy about **$800**.
2. Add when **30 minutes since the last add OR price is 0.3% below the last surviving rung's fill**. Both routes still pass the gates below. These are market buys, not resting buy limits; timer adds can buy higher.
3. At five or more open rungs, a roughly 6h move of **−0.5% or worse** doubles the timer to **60 minutes**. The price-drop route stays available.
4. Next buy = **$800 × 1.35^(open rung count)**. Partial closes reduce the count, allowing rebuilding. No compounding or manual rung-cap override is active.

| Rung | New buy | Total if untouched |
|---:|---:|---:|
| 1 | $800 | $800 |
| 2 | $1,080 | $1,880 |
| 3 | $1,458 | $3,338 |
| 4 | $1,968 | $5,306 |
| 5 | $2,657 | $7,964 |
| 6 | $3,587 | $11,551 |
| 7 | $4,843 | $16,393 |
| 8 | $6,538 | $22,931 |
| 9 | $8,826 | $31,757 |
| 10 | $11,915 | $43,672 |
| 11 | $16,085 | $59,757 |

#### What blocks a buy

These block exposure; they are not themselves sell signals. AND means all conditions are required.

| Gate | Condition and release |
|---|---|
| HYPE trend | Closed 4h price below EMA200 **AND** EMA50 falling. Applies to first rung and adds. |
| BTC risk-off | Closed BTC 1h return below −3%; blocks for 120 minutes. |
| Damaged regime | HYPE 4h close at least 4% below EMA200 **AND either** healthy HL buy/sell ratio ≤0.85 over 15m **or** ≤0.90 over 1h. Releases after two consecutive closed 4h bars above −1% EMA200 distance. |
| Local ladder loss | Oldest surviving rung ≥12h **AND** ladder price PnL ≤−3%. Stops adds, not exits. |
| Overextended entry | **Flat only:** HYPE 12h rise ≥2.55% **AND** 4h CRSI ≤56.9 **AND** 1h RSI ≥59.4. |
| Daily regime | Five successive lower daily closes block; two successive non-lower daily closes release. Not candle-body colour. |
| Cooldown and operations | Forced-exit cooldown, maximum depth, pause, incomplete inputs, insufficient shared capital or unsettled orders. Confirmed zero-fill entry rejection waits five minutes before retry. |

The damaged latch survives restarts and missing HL data. First initialization already below −4% may conservatively latch without HL confirmation. Normal HL confirmation needs ≤90s-old data and at least 14/55 samples for the 15m/1h windows. Releasing one gate never bypasses another.

First-entry checks need continuous **14-day / 4,032-bar 5m history**, HYPE hourly candles and RSI/CRSI. Agg10 needs 2,880 continuous closed minutes for its 48h high. Ladder RSI/CRSI preserve the parent calculation from known minutes, which can include a forming higher-timeframe bar; auxiliary signals use closed bars.

#### Take profit and partial exits

| Exit | Rule |
|---|---|
| Normal batch TP | **+1.4%** above the ladder's quantity-weighted average entry. Only ladder quantity is closed. |
| Stale batch TP | From oldest-rung age **10h**, if current price PnL is below +0.5%, use **+0.5% TP**. This adjusts a target; it does not sell immediately because ten hours passed. |
| Resistance partial | At least six rungs, resistance within **0.3% above price**, ladder PnL ≥+0.25%, a fee-profitable close basket, deteriorating pulse and no partial in the last 60m. Close the highest-dollar-PnL rungs and **keep the three lowest-PnL rungs**. |

Average entry and TP update with inventory. TP is a quantity-owned post-only maker sell; a definitive maker rejection can use a quantity-owned conditional TP. A touched but unfilled maker has a 2s grace before cancel/reconcile/market fallback. **No full-side TP may close other strategies' longs.**

**October 12 execution repair, deployed; next eligible add not yet verified:** after cancelling a TP for an add, fetch fresh price/capital evidence and recheck exits and all buy gates. Keep the five-second freshness limit through submission. A failed add still runs exit/TP servicing in the same loop; unknown cancellations or fills remain owned, never guessed away. Sizes, signals and targets are unchanged. The TP appears under Bybit **Open Orders**, not necessarily the position's TP/SL column.

The partial uses 30m pivots, four bars each side, 14-day memory, 0.45% clustering and at least two touches. Deteriorating pulse means any of: average available HYPE 4h OI change ≤−0.25%; Binance 4h buy/sell volume ratio ≤0.98; BTC 4h return ≤−0.25%; or negative HYPE funding together with OI average ≤0% or Binance ratio ≤1.05. Its 60m cooldown limits partials, not ordinary adds.

#### Forced exits and cooldown

Percentages below are **unleveraged price PnL versus average entry**, before costs—not account drawdown or margin ROE.

| Full ladder exit | All required conditions |
|---|---|
| Emergency | PnL ≤**−14%**; no age/trend condition |
| Funding spike | At least eight rungs and Bybit funding ≥**0.012%** |
| Hard flatten | Oldest surviving rung ≥**21h**, PnL ≤**−2%**, hostile 4h EMA trend |
| Two-day high | Oldest surviving rung ≥**4h**, closed minute within **1% below rolling 48h high**; no profit/trend condition |
| Weak week | Age ≥**40h**, closed-minute PnL ≤**0%**, price no higher than the exact minute close seven days earlier; no EMA condition |

Priority: emergency → funding → hard flatten → resistance partial → two-day high → weak week. Resting TP can fill independently. High/weak-week decisions require current closed-minute evidence within its first 30s; missing data does not authorize a sale.

Forced exits impose roughly **4–8h** of ladder cooldown, ending at the second upcoming UTC 4h boundary: 13:10 normally releases at 20:00. High/weak-week paths anchor to execution; other forced paths use the decision clock. Ordinary Agg10 TPs have **no post-TP RSI cooldown**. A full ladder's −14% loss is about **−$8,366 before costs**, not an account-loss cap.

Inactive: old deep-funding restriction/support-reopen exception, resistance add veto, two-step 12h/−5% flatten, post-flatten full reload and research-only exit overlays.

### SFP

**Long · $8,666.67 / $6,666.67 · shared slot · SF08.** Buy a confirmed reclaim after a sweep of a known range low. No longer a separate $10k LAWBSTER position.

#### Entry sequence

1. Find a **4h range** using confirmed pivots with two candles each side. Low at least 24h old; a later, already-confirmed high ≥2% above it and not previously exceeded.
2. Take the **first sweep ≥0.1% below the low**, within 30 days of low publication. Require a 4h close back above the low on that candle or within 24h. Range high must stay untouched and above the reclaim close.
3. Original structural risk must be **0.2%–5%** of the reclaim close. At **close +60s**, market-buy during the following one-minute window. Expired, occupied or paused signals are skipped, not postponed.

#### Fixed prices and exits

Let C be reclaim close and E the lowest sweep-to-reclaim price:

| Price or clock | Calculation |
|---|---|
| Original structural stop S | E × 0.999 |
| Original risk R | C − S |
| Take profit | C + 2R |
| Actual stop | S × 0.95 |
| Timeout | 24h from scheduled signal entry; not restarted by a late fill |

**“5% stop” means 5% below the structural stop—not entry.** The allowed original risk implies roughly 5.19%–9.75% distance from C. Example: C=$100 and S=$98 → TP=$104, stop=$93.10. Widening the stop does not widen TP.

Bybit parent-linked, quantity-specific **Partial TP/SL**, triggered by LastPrice, closes this trade only. Prices stay fixed after fill apart from outward tick rounding. Remaining quantity closes at timeout. No averaging, partial profit-taking, trailing/breakeven stop or 72h extension.

#### What can block it

An existing SF08 trade, all three slots occupied, shared-capital limits, crossed bracket, late/missing data, pause or execution/recovery restrictions. **No ladder EMA/BTC/latch gate, HL pulse, RSI filter or extra higher-low confirmation.**

**October 13 restart correction — deployment unconfirmed:** reconstruct historical structure with the collector's original publication times, while still requiring the worker to have received all inputs before the entry boundary. Late repairs stay blocked; missed historical signals are not entered after restart. No trading thresholds change.

### MACD

**Short · $13,000 / $10,000 fixed · dedicated R3 allocation.** Trade a fresh downward momentum change, not every negative MACD candle.

#### Entry sequence

1. On completed **4h HYPE candles**, calculate MACD **12/26/9**: EMA12 minus EMA26, its 9-period signal, then the histogram difference.
2. Previous histogram **≥0** and newest histogram **<0** creates a short signal. Negative on both bars is not a new entry.
3. Observe during the 4h-close minute; schedule a **market short one minute after close**. Example: 12:00 confirmation → 12:01 eligible entry. No historical catch-up.

#### Hold and exit

| Situation | Action |
|---|---|
| Fresh downward cross; R3 free | Short the configured R3 ticket, subject to shared permission/capital |
| Another cross while occupied | Skip; never add to or double the short |
| Later closed 4h histogram returns to **≥0** | Market-close one minute after valid publication |
| No earlier indicator exit | Close at **12h +1 minute from first fill** |
| Ladder blocked or on cooldown | MACD can still enter; ladder gates do not apply |

**No price TP or SL.** No extra EMA trend, RSI, BTC, S/R or funding-direction filter. Pause blocks entries, not indicator/timeout management. Missing indicators do not cancel the independently scheduled timeout. A stopped owner cannot service these exits; outages can delay fills past the deadline.

### ADX long

**Long · $8,666.67 / $6,666.67 · shared slot · L2.** Buy strengthening upward directional movement.

1. Completed **15m candles**, ADX period **28**.
2. ADX crosses **from ≤25 to >25**, with **+DI > −DI**. ADX measures strength; DI supplies direction.
3. Market-buy at close +60s, within that one-minute window. One L2 position maximum.
4. Market-close at **12h +1 minute from first fill**. **No price TP/SL, trailing stop, ADX-reversal exit or averaging.**

Blocks: L2 occupied, no slot/capital, pause or invalid/late data/execution evidence. Ladder trend, latch and cooldown rules do not apply.

### ADX short

**Short · $8,666.67 / $6,666.67 · shared slot · R5.** Sell strengthening downward directional movement.

1. Completed **30m candles**, ADX period **14**.
2. ADX crosses **from ≤40 to >40**, with **−DI > +DI**. This is not a MACD signal.
3. Market-short at close +60s, within that one-minute window. One R5 position maximum.
4. Market-close at **12h +1 minute from first fill**. **No price TP/SL, trailing stop, ADX-reversal exit or averaging.**

Blocks: R5 occupied, no slot/capital, pause or invalid/late data/execution evidence. It may coexist with the separate MACD short; ladder gates do not apply.

### CRSI

**Long · $8,666.67 / $6,666.67 · shared slot.** Buy the first recovery out of an extreme Connors RSI reading.

1. Completed **15m candles**. Unrounded Connors RSI averages price RSI(3), streak RSI(2) and the current return's rank against the prior 100 returns.
2. Cross **from ≤5 to >5**. Remaining below 5 or already above 5 is not a new signal.
3. Market-buy at close +60s, within that one-minute window. One CRSI position maximum.
4. Market-close at **12h +1 minute from first fill**. **No price TP/SL, high-RSI exit or averaging.**

Blocks: CRSI occupied, no slot/capital, pause or invalid/late data/execution evidence. No extra EMA/BTC/HL confirmation or ladder cooldown.

### PA07

**Short · $20,000 / $6,666.67 · shared slot.** Sell a 1h support break with a known supply candle and unconsumed 4h downside reference. This is the break entry—not the separate origin-retest research variant.

1. Identify the latest confirmed **1h pivot low**, using two bars each side. Previous 1h close at/above it; new close **at least 0.1% below it**. One attempt per broken reference.
2. Require confirmed **4h high/low context**, each pivot no more than seven days old. The downside low must stay untouched since publication through the break.
3. Find the latest **up-closing 1h candle** within the previous 12 candles, no earlier than the broken pivot. Break close must also be below that candle's low.
4. SL = **0.1% above that origin candle's high**. Risk from signal close must be **0.2%–5%**. TP = **2R below signal close**. The 4h low qualifies the setup; it is not necessarily TP.
5. Market-short at close +60s, within the one-minute window. Quantity-specific, parent-linked LastPrice market TP/SL; close any remainder **24h after scheduled entry**.

Blocks: PA07 occupied, no slot/capital, crossed bracket, pause or invalid/late data/execution evidence. **No required pullback, FVG, impulse candle, premium filter or ladder EMA/BTC/latch gate** on this variant. No scaling, partials or trailing stop.

## Historical replay

**Baseline sizing only — not the selected PA07 allocation. January 1 → October 10, 2026 at 12:51 UTC.** The archived ladder + three setup slots + MACD reference starts flat with **$19,047.16**. Simulated trades, not actual account returns. October is incomplete. Sizes stay fixed; profits do not increase the next order. The separate October 23 sizing verification reproduced the newer baseline and selected controls, but this chart has not been relabelled or replaced.

`PORTFOLIO_REPLAY_REFERENCE`

### Reading the results

- **Monthly net** includes fees, funding and changes in open-position value. Wins/losses count completed episodes by their final exit month, so they do not sum to monthly marked PnL. Click a month to inspect its closed trades.
- **Monthly DD** measures the fall from the month's starting equity or a later closing-equity peak, whichever is higher, to adverse intraminute equity. Full-period DD retains earlier months' peaks. Dollar and percentage maximum drawdowns can occur at different times. The equity line is sampled hourly for display; drawdown uses every archived minute, including adverse within-minute prices.
- **One ladder row means one complete episode**, from rung 1 through the final flat. Adds and partials do not restart it. Partial detail rows show their allocated trading result before funding and are already included in the parent; do not add them again. Parent results include all funding. Peak size is the largest surviving entry-cost exposure, not cumulative buys or collateral.
- **Touch / confirmed** are alternative ladder TP-fill assumptions. Touch allows the saved resting-order touch fills; confirmed waits for the closed-minute confirmation and next-open execution. The other strategies retain their archived execution rules. Neither guarantees a live fill. Fees are the study's 0.055% per fill; funding uses the archived settlement/mark proxy.
- **Chart markers cover every saved fill.** Initial entries, partials and final exits are shown by default; enable ladder adds to see every rung fill. Candles are aggregated to 15m, 1h or 4h for readability. Exact receipt times/prices are in the selected trade's fill list. The final display candle may be incomplete at the cutoff. No TradingView account is needed; the chart library and data are local files.

### Evidence and limits

The shared-book receipt audit reproduces both archived paths and all 406,851 minute marks. Capital admissions were checked at $19,047.16. This verifies the combined accounting on saved strategy decisions; it is **not a fresh end-to-end replay of the asynchronous live service**, an exchange-fill guarantee, or untouched out-of-sample evidence. Real funding, quantity rounding, latency and slippage can differ; the separate cost-stress result remains visible above.

Bundled sources: [export provenance and checks](assets/portfolio-replay-manifest.json), [exporter](../../scripts/build-portfolio-replay-reference.cjs). Local research evidence (not shipped to the VPS): `research/codex-astra-hype-2026-three-slot-macd-19k-findings-2026-10-10.md` and `backtests/portfolio-joint-receipt-parity/ef58d80524e4f355/verification.json`. Both tables and charts reuse sealed artifacts; opening this guide runs no replay and connects to no exchange.

When live rules change, keep this history labelled with its original rules until a matching replay exists. Re-export with `node scripts/build-portfolio-replay-reference.cjs`, then regenerate this guide. The exporter checks input seals, episode/partial allocation, monthly setup attribution, fees, funding, totals and drawdown. It does not silently retest a changed strategy.

## Alerts, controls and source pointers

### What Discord tells you

| Message | Meaning |
|---|---|
| Portfolio started | Owner produced its first status; not proof entries are armed |
| Filled-order notification | Current deployment: filled quantity. Local update awaiting deployment: average fill, fees and net realized close PnL before funding; entries explicitly show no realized PnL |
| Watchdog incident | Alert only; does not flatten, pause or restart anything |
| Short feed delay | Visible in status; timing-only warnings after 60s plus debounce, critical at five minutes |
| Slow execution — October 20 local patch, not deployed | One deduplicated warning for sustained slow loops or an exit ≥30s late; critical for an exit ≥60s late or sustained severe loop delay. Does not change trading gates |
| Worker, clock, recovery or sustained input/account fault | Real operational issue, not dismissed as a slow tick |

`-status` and `node dist/bot/portfolio-status.js` show saved health plus current control files, not a new Bybit query. PM2 prints about once a minute and on important changes. Check snapshot/account age; protection is only **last verified**, not guaranteed.

**October 20 latency correction — local, not deployed:** remove duplicate checks inside a pass, read independent TP/SL evidence in parallel and prioritize due exits. Trades still require fresh validation; strategy rules are unchanged. Discord delivery no longer holds up trading and backs off on failure. Status adds service-read timings and exit lateness. Delay alerts require persistence and stable recovery, rather than firing on every slow request. Restart the owner and watchdog when deploying; details and verification: [latency runbook](portfolio-live.md#october-20-execution-latency-correction--local-not-deployed). Live speed still needs measurement after deployment.

**October 15 high-input correction — local, not deployed:** refresh the ladder's 48h-high candles independently of the trading loop. A proven newest-candle-only rollover under 10s is a timing delay, not a generic fault; dependent trading still waits for complete data. Persistent gaps/errors remain faults. Status shows all missing main inputs and a separate **Ladder 48h high** line. This does not change SF08, sizing, thresholds or the high-exit decision window. Details: [rollover runbook](portfolio-live.md#october-15-high-input-rollover-correction--local-not-deployed).

**Candle catch-up fix, deployed and observed:** on restart, read the local history needed to connect the pinned bootstrap to today, then read only newly appended rows. This replaces the fixed 1 MB tail that could lose the connection. No extra exchange requests; genuine missing or conflicting candles still block dependent decisions. Startup catch-up progress is in `feed.loader.unreadBytes`. The separate SFP restart-history correction keeps publication and observation clocks distinct; it is tested but **deployment is unconfirmed**. Details: [portfolio runbook](portfolio-live.md#october-13-sf08-restart-history-correction--deployment-unconfirmed).

**The standalone SFP approach warning is not wired into the portfolio.** Do not expect the old ten-minutes-before-close alert merely because SF08 is active. Stopped maker/HL-short observers are not needed for portfolio orders.

### Where the truth lives

| Need | Source |
|---|---|
| Permissions | VPS `portfolio-live-config.json`, `portfolio-pause` / `portfolio-flatten` |
| Inventory and receipts | `data/HYPEUSDT_portfolio_state.json`; never edit to force recovery clear |
| Saved runtime status | `data/HYPEUSDT_portfolio_health.json` |
| Deployment details | [Portfolio runbook](portfolio-live.md) |
| Ladder decisions | [Main policy](../../src/bot/portfolio/main-policy.ts), [pinned config](../../bot-config.json) |
| SFP / PA07 | [Structural signals](../../src/bot/portfolio/structural-signals.ts), [SFP policy](../../src/strategies/sfp-policy.ts), [PA07 detector](../../src/strategies/price-action-signals.ts) |
| MACD / ADX / CRSI | [MACD rules](../../src/bot/portfolio/macd-signals.ts), [timed indicators](../../src/bot/portfolio/timed-indicator-signals.ts) |
| Sizing / slots | [Contract](../../src/bot/portfolio/contract.ts), [allocation](../../src/bot/portfolio/allocation.ts), [capital checks](../../src/bot/portfolio/capital.ts) |
| Commands | [Commander controls](../../src/bot/portfolio/commander.ts) |
| Host / data operations | [Data pull](vps-data-sync.md), [PM2 runbook](pm2-vps.md) |

Realized portfolio PnL is since activation, net trading fees and before separately reported funding—not the old ladder's lifetime PnL. Maker/taker assumptions are 0.02%/0.055%; accounting uses actual fees. Ambiguous funding remains explicitly unallocated.

### Keeping this page accurate

The [Markdown source](live-strategy-overview-2026-09-25.md) is maintained in place; HTML is generated. Live changes require updates to affected setup tabs and runbooks, then generator `--test` and `--check`. Deployment dates require operator/runtime evidence, not a commit. Historical acceptance/probe details remain in the portfolio runbook.

## Commands, incidents and manual intervention

**Pause stops new entries/adds. Flatten requests all positions closed. Stopping PM2 does neither safely.** Keep the owner running to manage exits; in-flight orders can fill after a pause request.

### Quick commands

VPS commands run from `cd /opt/bybit-rev`. These affect ladder, all three slots and MACD together.

| Intent | Discord | VPS |
|---|---|---|
| Read status | `-status` | `node dist/bot/portfolio-status.js` |
| Stop new risk; keep exits | `-pause` | `touch portfolio-pause` |
| Close everything; stay paused | `-flatten` | `touch portfolio-pause && touch portfolio-flatten` |
| Resume after checks | `-resume` | Guarded command below |
| Help / recent activity | `-help` | `pm2 logs hype-portfolio-live --lines 40 --nostream` |

**Dangerous alias:** `-close hype` and `-closeladder` also flatten **every portfolio owner**, not just ladder rungs. Replies are not fill confirmations. Flatten needs a running owner and reachable exchange. The owner removes `portfolio-flatten` after cleanup; `portfolio-pause` remains.

### Resume safely from SSH

This uses Discord's checks: enabled live config, fresh healthy owner/account evidence, no recovery, drain, active exit or pending mutation/reservation. Verified resting protection is allowed.

```bash
cd /opt/bybit-rev
node -e "const c=require('./dist/bot/portfolio/commander'); console.log(c.handlePortfolioCommand('-resume',Date.now()));"
node dist/bot/portfolio-status.js
```

Raw `rm -- portfolio-pause` **bypasses those checks**; prefer the guarded command. There is no `portfolio-resume` signal. Resume never clears market gates, recovery or disabled config. Never remove a flatten request to force resumption.

### Check after intervention

```bash
cd /opt/bybit-rev
node dist/bot/portfolio-status.js
npm run watchdog -- --once --dry-run
```

1. Fresh status, no recovery or unexplained pending work. After pause: **ENTRIES PAUSED/OFF**, pause=true. After resume: **ENTRIES ARMED**; market gates can remain.
2. After flatten: ladder/slots/MACD flat, exchange long/short zero, no orders/reservations/active exits, flatten=false and pause=true. **Verify positions and remaining orders in Bybit too.**
3. If stale, recovering or unconfirmed, leave paused and inspect. Do not repeatedly resume/restart, edit state, remove locks or restart old owners.

### If the bot is unreachable

**Use Bybit to assess immediate account risk.** Exchange-held orders may remain, but software exits need the running owner. Discord cannot revive a dead service. After manually changing positions/orders, keep entries paused and reconcile before resuming; do not assume automatic adoption.

Use the [portfolio runbook](portfolio-live.md) for maintenance. Never `pm2 restart all`. `portfolio-regime-arm` is an explicit daily-breaker override only; it does not clear the damaged latch and is **not an incident-recovery command**. Commander refuses HYPE rung overrides/regime resets.

## Current PM2 services and cleanup

Operator-confirmed October 11: **six online, three retained stopped**. No live memory counters are embedded here.

| Service | Status | Purpose |
|---|---|---|
| `hype-portfolio-live` | Online | **Only trading owner**: ladder and all six auxiliary sources |
| `commander` | Online | Discord status and intervention |
| `hype-health-watchdog` | Online | Alert-only health monitoring |
| `alarm-HYPEUSDT` | Online | HYPE alarm monitor; not an order owner |
| `bybit-collect` | Online | Market inputs and historical collection |
| `hl-collect` | Online | Hyperliquid inputs, including ladder pulse/latch data |
| `hedgeguy-bot` | Stopped | Legacy ladder; do not restart alongside portfolio |
| `hype-sfp-live` | Stopped | Legacy LAWBSTER SFP; preserve config/history, do not restart |
| `stable-corridor-c…` | Stopped | Separate project retained; name truncated in pasted PM2 list |

Removed from PM2: seven non-HYPE alarms, the three `hype-hl-short-*` processes and `hype-maker-tp-shadow`. Their code/history remains; they are not portfolio strategies. Maker TP is managed inside the portfolio.

`pm2 save` records the intended lineup for reboot. Use after deliberate service changes—not temporary diagnostic stops. Legacy `bot-pause` and `lawbster-sfp-pause` stay present; they do not control the portfolio.
