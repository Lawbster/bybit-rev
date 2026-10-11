# Live HYPE strategies — operator overview

Readable browser edition: [live strategy guide](live-strategy-overview.html).

Updated 2026-10-11 for portfolio preparation. Live-evidence dates below are
unchanged; this is a description, not a configuration change.

**Current operator-confirmed state:** the legacy main and SFP owners were stopped
and PM2-saved during migration; both accounts were reported flat. Capital is now
consolidated on hypehedgeguy (UID 555249668, approximately $19,047). The new shared
owner is built but not deployed or armed. Sections 1-9 document the legacy rules;
the shared-owner section below documents their replacement. Older snapshots are
historical evidence, not a claim that the separate accounts remain active.

Basis: current source/config, the operator-confirmed Sep 25 deployment, and
locally synced health snapshots. The snapshots are dated **Sep 25 11:00 UTC**;
they are not a live connection and precede the later weak-week-stop deployment.
They show Aggressive10/maker TP active on the ladder and SF08 armed on LAWBSTER.
Current positions, balances and process health must still be checked on the VPS.

**Important:** the repository's `sfp-live-config.json` deliberately defaults to
disabled with no pinned UID. The approved VPS copy is armed and pins LAWBSTER.
Do not replace it with the repository defaults when deploying.

## 1. Two independent long strategies

| | Main martingale/DCA ladder | SF08 range-low SFP |
|---|---|---|
| PM2 owner | `hedgeguy-bot` | `hype-sfp-live` |
| Market | Bybit HYPEUSDT perpetual, long | Bybit HYPEUSDT perpetual, long |
| Account | Main ladder account | Separate LAWBSTER account |
| Position side | Hedge-mode long, `positionIdx=1` | Hedge-mode long, `positionIdx=1`, on its own account |
| Size | $800 first rung, each subsequent rung ×1.35, maximum 11 | One approximately $10,000 position |
| Leverage setting | 25× | 3× |
| Entry | Market buys on timer or price-drop eligibility, subject to gates | Market buy after a qualifying closed-4h sweep/reclaim |
| Ordinary TP execution | Resting maker order, with verified market fallback | Exchange-native market TP |
| Stop/timeout | Several independent full-exit rules | Fixed padded structural SL or 24h timeout |
| Averaging / partials | Adds and S/R partial exits | Neither |

Leverage does **not** multiply the configured order notional again. A $10k SFP
position is $10k exposure, not $30k. The strategies can both hold HYPE longs at
once: account separation does not remove their shared market-direction risk.

## 2. Main ladder: sizing and construction

### Step 1 — start a ladder

When flat, unpaused, out of cooldown and all applicable gates permit it, buy
approximately **$800** of HYPE. No SFP, support bounce or other positive setup
is required. This is primarily a gated, repeatedly operating long ladder.

### Step 2 — add exposure

Check roughly every **10 seconds**. Another market buy becomes eligible when:

- **30 minutes** have elapsed since the last add; **OR**
- the current price is at least **0.3% below the last surviving rung's fill**.

Both routes still have to pass the entry gates. The price-drop route bypasses
the waiting interval, not the trend/latch/cooldown/ownership checks.

These are **market orders**, not resting limit buys at each drop level. The
price trigger normally uses the live bid; the actual buy fill can differ.
Timer adds can occur above the previous entry: they do not require a pullback.

When there are already **at least five rungs**, the roughly 6h move from the
rolling 5m context being **≤−0.5%** doubles the timer to **60 minutes**.
The 0.3% price-drop route remains available.

### Step 3 — size the next rung

`next notional = $800 × 1.35^(number of currently open rungs)`.
The base does not automatically compound upward with wallet profits.
Live margin checks use refreshed wallet equity. `initialCapital: 1000` in the
JSON is a synthetic fallback, not the current ladder-account balance.

| Rung | New notional | Cumulative notional |
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
| 11 | $16,085 | **$59,757** |

Rounded display; exchange lot rounding changes actual quantities. After a
partial exit, sizing follows the surviving rung count and the ladder can rebuild.
There is no live half-size-rung-11 rule or special resistance gate for rung 11.
An explicit operator position-cap override is a separate manual exception;
the normal configured cap is 11.

## 3. Main ladder: what blocks new exposure

These generally block first entries and/or adds; **they do not themselves close
existing positions**. Exit rules are listed separately below.

| Gate | Exact condition / effect |
|---|---|
| HYPE trend break | Latest completed **4h close < EMA200 AND EMA50 is falling** versus the previous completed 4h bar. Blocks first rung and adds. Below EMA200 alone is not enough. |
| BTC risk-off | Latest completed BTC **1h close-to-close return <−3%**. Blocks entries/adds for **120 minutes**. |
| Damaged-regime latch | Completed HYPE 4h close **≤4% below EMA200**, together with healthy HL taker **15m buy/sell ratio ≤0.85 OR 1h ratio ≤0.90**. Remains blocked until **two consecutive completed 4h closes are above −1% EMA200 distance**. |
| Ladder-local kill | Oldest surviving rung **≥12h** and average-entry gross price PnL **≤−3%**. **Stops adding; does not flatten.** It uses current age/current loss, not twelve continuous underwater hours. |
| Overextended first entry | **Only while flat:** HYPE 12h close-to-close move **≥2.55% AND 4h CRSI ≤56.9 AND 1h RSI ≥59.4**. All three required. |
| Daily regime breaker | **Five consecutive lower daily closes** block entries/adds; **two consecutive non-lower daily closes** release it. This is close-to-close, not candle-body colour. Despite its `flatActive` name it is an entry block, not an automatic close. |
| Forced-exit cooldown | No fresh exposure before the stored cooldown expires. See section 5. |
| Operational permission | Manual pause, transaction/recovery conflicts, stale price feed, unavailable required finalized candles, incomplete continuous 48h Agg10 minute context, add-retry backoff, insufficient margin or unresolved maker-order handoff prevent adds. |

Latch details: HL evidence uses a maximum 90s age, at least 14 samples for the
15m window and 55 for the 1h window. In normal operation, unavailable HL evidence
does not invent a fresh trigger. An already-active latch persists through missing
data and restart. First-time initialization while already below the −4%
structure threshold can conservatively bootstrap the latch without HL confirmation.
Releasing the latch does not override any other gate.
The context gates also require healthy 14-day 5m coverage for the first-entry
indicator calculation, and healthy 6h 5m coverage for the deep-add throttle.

## 4. Main ladder: take profit and S/R partials

### Ordinary / stale batch TP

- Target is based on the **quantity-weighted average entry of all surviving rungs**.
- Normal target: **+1.4%**.
- Under **Aggressive10**, the old 4h soft-stale reduction is deferred until the
  oldest surviving rung is **10h** old. At/after that age, when current gross
  average-entry PnL is **below +0.5%**, the target becomes **+0.5%**.
- This is a TP target adjustment, **not a forced sale at 10h**. The underlying
  soft-stale condition still applies; age alone is not an unconditional close.
- Adding or partially closing inventory recalculates the average and TP.

Maker TP is enabled: one reduce-only **PostOnly sell limit**, rounded up to the
exchange tick. Fee assumptions are **0.02% maker / 0.055% taker**; actual fills
determine realized fees. At a qualifying TP touch, the maker gets a **2s grace**;
an unfilled remainder goes through cancellation, reconciliation and market fallback.
Unknown cancellation/order status blocks conflicting mutations rather than
blindly sending another close.

The native TP stays during initial handoff, then is cleared only after the maker
order is confirmed. It can be restored for safe handoff/fallback. This is not two
independent full-size TP orders intentionally racing at the same trigger.
Forced exits do not wait indefinitely for a maker fill.

### Resistance partial exit — active

All are required:

1. **At least six rungs** open.
2. Healthy S/R context and confirmed resistance **within 0.3% above price**.
3. Whole-ladder gross PnL **≥+0.25%**.
4. The proposed close basket is profitable **after estimated entry and exit fees**.
5. The pulse is deteriorating, as defined below.
6. The previous S/R partial-action **60-minute cooldown** has expired.

Action: rank rungs by **current dollar PnL**, close the highest-PnL rungs with a
market reduction and **keep the three lowest-PnL rungs**. This is not a fixed
percentage trim and not necessarily keeping three particular rung numbers.
The 60-minute cooldown limits further S/R partials; it is not a blanket add pause.
Surviving positions retain their original entry times, and ordinary adds can
rebuild the ladder if their gates permit.

Live S/R map: **30-minute pivots**, four bars left/right for confirmation,
**14-day memory**, 0.45% clustering, at least two touches. The researched historical
4h/1d maps are **not** the production map for these partials.

Pulse deterioration is **any one** of:

- Average available 4h HYPE OI change across Bybit/Binance/HL **≤−0.25%**.
- Binance HYPE 4h taker buy/sell-volume ratio **≤0.98**.
- BTC 4h move **≤−0.25%**.
- Negative funding on any of those HYPE venues **AND** either OI average **≤0%**
  or Binance 4h taker ratio **≤1.05**.

This partial's pulse gate is not the latch's HL 15m/1h rule.

## 5. Main ladder: full exits and cooldowns

All price-PnL percentages below are **unleveraged price moves from weighted
average entry**, before fees/funding—not exchange margin ROE or account drawdown.

| Full exit | Conditions |
|---|---|
| Emergency kill | Average-entry gross PnL **≤−14%**. No minimum age or hostile-trend requirement. |
| Funding-spike exit | **≥8 rungs** and reported Bybit funding rate **≥0.00012 = 0.012%**. No profit requirement. |
| Hard flatten | Oldest surviving rung **≥21h AND gross PnL ≤−2% AND hostile 4h trend** (the EMA gate above). All three required. |
| Agg10 two-day-high exit | Oldest surviving rung **≥4h** and the completed **1m close is within 1% below the rolling 48h high**. **No profit floor and no hostile-trend requirement.** Full close, not a partial. |
| Weak-week time stop — Sep 25 addition | Agg10 ladder age **≥40h AND completed-minute gross PnL ≤0% AND price ≤the exact minute close seven days earlier**. **No EMA/trend requirement.** |
| Manual flatten | Operator's explicit full-close signal; also pauses new ladder entries. |

Important distinctions:

- **21h alone does not force a close.** A recovering/non-hostile ladder can outlive it.
- **40h alone does not force a close either.** A positive seven-day return, or a
  profitable ladder at the decision close, prevents this particular exit.
- The 48h-high rule **does not prevent the initial buy near a high**. It closes an
  eligible existing ladder from age 4h; it is not a general high-proximity entry block.
- The proposed **12h/−5% emergency branch is not implemented** in this configuration.
- The account-wide drawdown kill is **disabled** (`maxDrawdownPct: 0`). The −14%
  ladder emergency rule remains active and is a different control.

The closed-minute high and weak-week rules require healthy 48h minute context and
a decision within the first **30 seconds after the minute closes**. The weak-week
rule additionally needs the exact seven-day reference candle; missing data does
not authorize its close. Independent exits remain available.

Main-loop priority among enabled forced rules is emergency → funding spike →
hard flatten → S/R partial → Agg10 high → weak-week stop. Ordinary maker/native/
WebSocket TP can complete independently; ownership/reconciliation resolves races.
Pause blocks entries, **not position management**. Bot-side exits need the process,
usable inputs and exchange access; the configured loss threshold is not a guaranteed fill.

After forced rule exits, the normal cooldown ends at:

`(floor(exitTime / 4h) + 2) × 4h` — roughly **4–8 hours**, aligned to UTC 4h boundaries.
For the new high/time-stop transaction paths, the completed execution anchors it;
older forced branches use their loop decision clock. Example: exit at 13:10 UTC
means next eligibility at 20:00 UTC. Ordinary Agg10 TPs have **no hot-RSI cooldown**.

At a full untouched $59,757 ladder, a −14% average-entry price loss is roughly
**−$8,366 before fees/funding/slippage**. It is not a 14% loss limit on the account.

## 6. Main ladder: enabled JSON does not always mean active action

| Setting / research | Effective status |
|---|---|
| `aggressive10.enabled` | Active profile confirmed in the synced ladder; profile survives restart and is assigned to fresh ladders. |
| `deepAddStressGuard.enabled: true` | **Overridden off for Agg10.** The old negative-funding timer-add restriction is not active. |
| `srSupportReopenAction.enabled: true` | Only overrides that old funding-only block; therefore no operative reopening exception under Agg10. |
| `tpCooldown.enabled: true` | **Bypassed for Agg10.** No old RSI>60 post-TP 30m wait. |
| Legacy 4h S/R add-skip engine | Disabled. No current resistance-based rung veto. |
| Main hedge / dedicated HL short | Main hedge disabled; dedicated HL short config disabled/entries disabled. Neither is the LAWBSTER SFP. |
| Score partial, pullback, euphoria-stop, hard-flatten-defer and hedge shadows | Observation only; they do not execute those candidate exits/shorts. |
| Post-flatten SFP observer | Enabled, **read-only**. It cannot reload the ladder or bypass its gates. |
| 40h weak-week stop | **Live**, not shadow-only, in the Sep 25 deployment. |
| NPOC/POC, historical major-level maps, CHR01/CHH01 | Research only; not additional live strategy rules. |

## 7. SF08 / LAWBSTER: step-by-step setup

### Step 1 — identify a confirmed 4h range

- Use completed HYPE **4h candles** and strict pivots with **two candles on each side**.
  A pivot is not usable until its right-side confirmation bars are available.
- Range low must be at least **24h old** at the sweep.
- Choose the highest qualifying **later confirmed pivot high**, known before the
  sweep, at least **2% above the low**. This policy still requires high-after-low.
- The range high must not already have been exceeded after its formation.

### Step 2 — first sweep and closed reclaim

- First eligible sweep trades **at least 0.1% below the known range low**.
- Sweep must occur within the policy's **30-day eligibility window** after low publication.
- A completed 4h candle must then **close back above that low**, on the sweep bar
  or within the **24h reclaim window**. No entry on the wick alone.
- The range high must remain untouched through the reclaim, and above its close.
- Gapped or late source context cannot be treated as a timely confirmed setup.
- No RSI, CRSI, BTC, HL, POC, FVG, three-tap or additional structure-break filter
  is required. No extra confirmed higher-low/retest entry is required either.

### Step 3 — fix the bracket, then buy once

Let `C` be the reclaim close and `E` the lowest price from sweep through reclaim:

```text
Original structural stop S0 = E × 0.999
Original risk R             = C − S0
Take profit                 = C + 2 × R
Actual padded stop          = S0 × 0.95
```

Original risk must be **0.2%–5% of C**. The extra stop padding is applied afterward.
The TP remains the original absolute **2R** price: it is **not** recalculated
against the widened stop and is **not necessarily the range high**.

**“5% SL” is shorthand for 5% below the structural stop, not below entry.** At the
reference close, the allowed original-risk band implies approximately **5.19%–9.75%**
distance to the padded stop. Actual fill and tick rounding change the exact distance.
Example: reference $100, original stop $98 → TP $104, padded stop $93.10.

After the 4h close there is a **60s availability lag**, then a **60s entry window**.
For example, a 12:00 UTC close can schedule an entry at 12:01, expiring at 12:02.
Buy approximately **$10,000 notional at market**, quantity rounded down.
The actual fill does not move the absolute TP or SL. TP rounds up to the price tick;
SL rounds down. There is one position at a time and no averaging.

### Step 4 — entry permission checks

- VPS owner enabled, entries armed, `lawbster-sfp-pause` absent.
- Correct pinned LAWBSTER identity, distinct from the ladder account; hedge mode,
  dedicated cross margin and **3× leverage** as configured.
- No pending transaction, recovery, unowned HYPE position or existing HYPE order.
- Healthy timely signal, still inside its entry window; fresh valid bid/ask inside
  the fixed bracket; valid exchange quantity/tick/minimum notional.
- Available margin at least `notional / leverage + 0.2% of notional`
  (about **$3,353.33** for $10k/3×), plus the separate collateral check:
  equity must cover estimated loss to the SL **plus 5% of notional** reserve.

Signals encountered while paused, occupied or expired are consumed—not queued
for a later buy. Restart does not replay a historical backlog. The same-minute
exit guard prevents recycling an already-used decision minute.

These are account/execution safeguards, **not the main ladder's market gates**.
The ladder can be trend-blocked or on cooldown while SFP remains eligible.

### Step 5 — exits and protection

- Native full-position **market TP/SL**, triggered by Bybit **LastPrice**.
- **24h timeout from the scheduled signal action**, not a new 24h clock on a late fill.
  Remaining inventory is market-closed even if the original structure still holds.
- **No partial TP, maker TP, trailing stop, breakeven move, scaling or 48h/72h
  timeout extension** is live. SF09 remains research.
- Three failed protection-confirmation polls request a fail-closed market exit.
  A missing/invalid liquidation estimate, or one not at least 0.5% below the SL,
  also requests exit. Those checks are conservative safeguards, not a guarantee
  against liquidation or slippage.
- Pause/disarm affects new entries only; existing protection, reconciliation
  and timeout management continue, including when candle scanning is unavailable.
- Realized trade accounting uses execution fees and is **before funding**.

The SFP owner polls about every **5 seconds**. Its equity is separate; the accepted
starting allocation was **$5,269.72**, not a claim about today's balance.

## 8. Alerts, controls and source pointers

SF08 has ordinary trade/close notifications and watchdog health coverage. Its
approach warning is observational: in the final **10 minutes of a 4h candle**, a
valid known range + sweep + provisional reclaim can notify an armed, flat owner.
At most one warning per setup and one setup per 4h close. A warning does not
guarantee a final signal or order. The synced health includes a sent approach alert.

| Control | Ladder | SFP |
|---|---|---|
| Pause entries, continue management | `bot-pause` | `lawbster-sfp-pause` |
| State | `bot-state.json` | `data/HYPEUSDT_lawbster_sfp_state.json` |
| Health | `data/HYPEUSDT_runtime_health.json` | `data/HYPEUSDT_lawbster_sfp_health.json` |
| Config | `bot-config.json` | VPS-local armed `sfp-live-config.json` |

Do not edit state to clear recovery. Do not stop an owner with unresolved inventory
just to pause entries. Watchdog alerts report problems; they do not independently
close positions or change strategy configuration.

Load-bearing code and runbooks:

- [Main config](../../bot-config.json), [loop/ordering](../../src/bot/index.ts),
  [ladder gates/exits](../../src/bot/strategy.ts).
- [Agg10 rules](../../src/bot/aggressive10-policy.ts),
  [weak-week stop and observer](weak-week-and-post-flatten-shadow.md).
- [S/R partial plan and pulse](../../src/bot/sr-shadow.ts),
  [damaged-regime latch](../../src/bot/damaged-regime-latch.ts),
  [maker TP](maker-tp-live.md).
- [Shared SFP detector](../../src/strategies/sfp-detector.ts),
  [SF08 bracket policy](../../src/strategies/sfp-policy.ts),
  [SFP execution checks](../../src/bot/sfp-exchange.ts),
  [SFP lifecycle](../../src/bot/sfp-coordinator.ts), [SFP operations](sf08-live.md).

Older onboarding/runbook status paragraphs can lag deployments. Use this dated
overview for the combined rule map, current code for exact semantics, and fresh
VPS state/health/Bybit evidence for what is actually running now.

## 9. Keeping this guide current

### Shared-account portfolio — built, not armed

**October 11 status:** `src/bot/portfolio-live.ts` now composes the existing
ladder policy, setup signals and MACD policy under one receipt-owned account
writer. The repository defaults to **disabled, observe mode, entries off**.
There has been no portfolio deployment or arming. The operator has stopped the
old main and LAWBSTER SFP owners, consolidated capital into hypehedgeguy
**UID 555249668**, and reported both accounts flat. Recheck that on the VPS.

| Component | Requested size | Rules |
|---|---:|---|
| Main | $800 × 1.35; 11 rungs | Agg10/21h/weak-week/S/R partial rules above, using only main-owned inventory |
| Three fungible setup slots | $20,000 / 3 each | One source per slot; SF08, L2, R5, PA07 and CRSI compete in frozen same-clock order |
| R3 MACD short | $10,000 | Independent slot; 4h MACD(12,26,9) histogram nonnegative → negative; exit on nonnegative histogram or 12h, with original one-minute execution delay |

L2 is the 15m ADX(28) cross above 25 with +DI greater than −DI (long).
R5 is the 30m ADX(14) cross above 40 with −DI greater than +DI (short).
CRSI is the 15m unrounded Connors RSI crossing from ≤5 to >5 (long).
Those three use a 12h-plus-one-minute fill-based deadline, without a price stop
or target. SF08 retains its structural padded stop/2R and signal-based 24h
deadline at the smaller slot size. PA07 is the frozen 1h-trigger/4h-context
short with structural 2R and signal-based 24h deadline. No parameter was tuned.

All positions share cross margin and the account's verified **25x exchange
setting**. Internal capital reservations still charge main at 25x and auxiliaries
at **3x**, with the frozen fee/risk allowances. Requested sizes are not compounded.
The configuration's initial equity is a reference figure; admission uses current
verified USDT cash and owned inventory, not that hardcoded starting figure.
Historical $19k results and their limits remain in the
[builder handoff](../../research/codex-astra-hype-2026-three-slot-macd-builder-handoff-2026-10-10.md).

**Execution and ownership**

- One serial writer holds both HYPE side leases. Bybit aggregates each side;
  the durable lot ledger, not Bybit's blended entry, owns each strategy's cost,
  quantity, closes and receipts.
- Main has one quantity-owned maker TP. A definitively failed PostOnly order can
  fall back to a quantity-owned conditional TP; no full-side TP is allowed.
  Maker-touch cancel/fill races settle before a residual market close.
- SF08/PA07 attach Partial TP/SL to their entry. Parent-linked children must be
  reconciled before cancelling protection, closing a residual or releasing a slot.
- Unknown submissions are never automatically resubmitted. Confirmed zero-fill
  main entry rejection starts a nonblocking five-minute retry backoff.
- Real execution fees feed the ledger. Signed venue funding is separately
  attributed from executions; ambiguous settlements stay explicitly unallocated.
  The automatic funding reader overlaps seven days and is not a lifetime-backfill
  guarantee.
- Old owner startup is refused while takeover is enabled; the portfolio also
  checks PM2 and the legacy pause files before writes. Do not run old deployed
  binaries beside it: those do not contain the new startup guard.
- The cached worker supplies causal setup signals and main RSI/CRSI. Main
  RSI/CRSI preserve the parent's forming-HTF-from-known-minutes convention;
  auxiliary signals use their frozen closed-bar convention. Missing inputs block
  dependent entries; timed exits remain serviced.

**Controls and alerts**

`portfolio-pause` blocks entries, not exits. A persistent
`portfolio-flatten` requests all portfolio owners drained, including late entry
receipts, and leaves entries paused. `portfolio-regime-arm` resets only the
daily regime-breaker memory, not the damaged-regime latch. Legacy Discord
commands still address legacy signal files; use the portfolio runbook's controls
until explicitly migrated. No dynamic rung override is supported.

Startup and filled-order notifications reuse Discord. The existing watchdog
monitors the new owner when takeover is explicitly enabled, suppresses retired
main/SFP/maker-shadow heartbeats, and retains collector monitoring. It reports
missing heartbeat, sustained degradation, recovery and unconfirmed transactions.
A paused/observing owner can be healthy without permission to trade.

**Evidence and remaining release boundary**

Offline checks reproduce 420 archived setup decisions, 61 MACD signals, 803
receipts and 48,156 capital formula comparisons. The cached feed matches 122,146
indicator/MACD feature comparisons; 104 main RSI/CRSI comparisons around a 4h
boundary match the saved parent. This is component parity, **not proof that a
coupled live execution replay reproduces the full funded ladder portfolio**.

The tiny long probe witnessed parent-linked protection but required manual
cleanup after a lookup failure. Exact-ID evidence later confirmed both children
deactivated with zero fills. The separate tiny short probe returned
`metadata_and_cleanup_passed`, two children and `observed_and_flat`.
That proves the reported metadata/cancellation/cleanup path, not native trigger
races, production-size fills or liquidation safety. Preserve both probe reports;
do not repeat them.

Next external check: load this build on the VPS **in observe mode**, verify the
real account adapter, bootstrap catch-up, tick latency and watchdog. Final
coupled strategy/execution acceptance is still required before changing mode
to live and arming entries. See [portfolio cutover runbook](portfolio-live.md).
No observation or commit alone counts as deployment approval.

### Documentation maintenance

This Markdown is the single maintained prose source; the browser edition is
generated, self-contained HTML. The original date in the source filename is
retained so existing links remain valid. Update the as-of and evidence statements
when the rules or deployment status change, rather than making another copy.

Before committing/pushing live strategy changes, update the relevant sections
and strategy runbook, then run:

```bash
node scripts/build-live-strategy-overview.cjs
node scripts/build-live-strategy-overview.cjs --test
node scripts/build-live-strategy-overview.cjs --check
```

Commit the source and generated HTML with the behavior/config change. The check
compares the rendered guide and fingerprints relevant repository config/policy
files. It detects stale output, but cannot prove that the prose correctly describes
the code. Review effective overrides and distinguish approved/pending deployment
from dated production evidence. It reads no credentials or live account state.
