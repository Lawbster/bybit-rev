# HL + S/R research readiness — 2026-09-04

Scope: assess prerequisites for a new HL/pulse + S/R study. Read-only code/data inspection and two synthetic engine probes; no strategy sweep, live/config/collector changes, exchange access, commit or push. This is a local findings document, not an approved implementation plan.

## TL;DR

- **Fix execution ordering and live/replay policy parity before ranking new strategies by dollar PnL.** Two synthetic probes reproduce retrospective fills. The preceding repair corrected source timestamps and historical indicator coverage, not these previously disclosed execution gaps.
- **The data is useful, but its quality and meaning need explicit treatment.** Eight HL-related streams are present. In 345,584 book samples from the latest 60-day slice, none flagged truncated 0.5%/2% depth; every sample flagged 0.1% depth too coarse. Fourteen samples contained exchange books over 90 seconds old despite fresh sample timestamps.
- **Exploratory level/flow analysis can start without rewriting the entire bot.** Freeze causal feature definitions, identify independent level encounters, and test incremental value over existing policies. Actual fees/funding and maker/state behavior are required before signing off account-level improvements. No new edge or live policy change is established here.

## Available data, not assumed continuous coverage

First/last embedded rows were read from each copied file. These dates establish file span, not uninterrupted joint coverage or contemporaneous delivery.

| Files under `data/` | First observed | Available information |
|---|---|---|
| `HYPEUSDT_taker_hyperliquid.jsonl` | May 17, 2026 20:43 UTC | Minute buy/sell quantity and notional, net flow, counts, large-trade breakdown, trade/window timestamps |
| `HYPEUSDT_ob_bands_hyperliquid.jsonl` | May 17, 2026 20:42 UTC | Aggregated sampled book bands, imbalances, bid/ask prices, coverage/truncation/resolution flags, exchange timestamp |
| `HYPEUSDT_asset_ctx_hyperliquid.jsonl` | May 17, 2026 20:42 UTC | Native OI, marked OI notional, mark/mid/oracle prices, funding, daily notional volume |
| `HYPEUSDT_oi_live_hyperliquid.jsonl`, `HYPEUSDT_funding_live_hyperliquid.jsonl` | April 25, 2026 23:09 UTC | REST OI/funding, premium and price context; funding interval field |
| `HYPEUSDT_1m_hyperliquid.jsonl`, `HYPEUSDT_5m_hyperliquid.jsonl` | May 17, 2026 20:40–20:42 UTC | HL candles, volume, turnover and trade counts |
| `HYPE_hlp_vault.jsonl` | April 25, 2026 23:09 UTC | APR, maxDistributable/maxWithdrawable and other vault snapshot fields |

Latest copied rows reach approximately September 4 19:00–19:01 UTC. The richer taker/book/asset overlap is approximately 110 calendar days before freshness/coverage exclusions, not the entire candle history. Long candle-only tests provide context but cannot validate HL-dependent rules in periods without HL observations.

HL is not completely unused: support-reopen and the damaged-regime latch already consume HL confirmation. S/R partial-exit deterioration uses multi-venue OI, Binance taker, funding and BTC context. Many other combinations exist as historical research or shadows, not active policies. A new study must measure additional information rather than relabel an existing gate.

## H1 — Decision/fill ordering remains a research blocker

References: `scripts/hype-freerun-canonical-replay.ts:1550`, `:1555`, `:2047` onward and `:2145`.

The engine evaluates current-minute closing context, but uses the same minute's earlier range for drop-add fills and TP touches. A previously resting order may legitimately fill within a candle. An order or amended target decided from the candle close cannot retroactively claim that candle's earlier price.

Two read-only synthetic probes on the current engine:

| Probe | Inputs | Engine output | Why execution is not established |
|---|---|---|---|
| Drop add | Seed at $100; minute low $99.60, close $100; decision at 12:01 | Add booked at $99.70 | End-of-minute gates may permit an add after the lower price has already gone; no standing limit-order evidence is modeled |
| Newly stale TP | Seed at 08:00:30; four-hour threshold 12:00:30; 12:00–12:01 candle high $100.60, close $100.20 | Stale TP booked at $100.50, +$3.1178 modeled PnL on $800 | A compatible path reaches the high before 12:00:30 and never returns after the target changes |

These are demonstrations of unproven fill ordering, not measured historical profit inflation. No aggregate impact was estimated here.

Minimal next repair: separate decision/intent time from executable fill time; distinguish orders active before the bar from newly decided/amended orders. Use subsequent executable quotes/trades when available, otherwise an explicitly conservative subsequent-bar model. Ambiguous intrabar paths need adverse-path/sensitivity treatment. Do not fix this by simply raising a fee or calling all touches maker fills.

## H2 — Match actual S/R/HL decision and state semantics

References: `scripts/hype-dormant-edge-replay.ts:137`, `:201`, `:264`, `:280`; `src/bot/sr-support-reopen.ts:135`; `src/bot/sr-memory-zones.ts:59`; `src/bot/state.ts:555`, `:850`; `scripts/hype-freerun-canonical-replay.ts:1160`.

Confirmed differences:

- Replay OI lookups select the latest eligible point without the live support-reopen current/anchor-age limits. Taker ratios can exist without the live minimum window sample counts. Causal does not automatically mean fresh or sufficiently covered.
- Replay support confirmation is a separate `buyP && bidWall && oiExp` implementation; live applies freshness, coverage, depth, funding-only and time-add conditions through its policy. The local config requires book age <=30s, taker age <=90s and 14/55 distinct minute samples, asset age <=60s and anchor lag <=120s.
- The replay reconstructs S/R separately using fixed 30m/4x4/14d/0.45% parameters. The live engine receives configuration and requires healthy 5m candle coverage. Several replay calls query zones at candle start while evaluating prices/features at candle end. This is not future leakage, but boundary behavior is not identical.
- Current full/maker closes reset `lastAddTime` when flat; the older replay intentionally retains it. Partial closes also need the same remaining-rung/state math. These differences change subsequent opportunities and therefore the measured benefit of an S/R action.

The live zone engine already delays pivot availability until four right-side 30m bars have completed and filters unconfirmed touches. That is good. Its past-decision queries must still be supplied with a historical-prefix build, not a cluster built using later data and merely filtered afterward.

Minimal next repair: replay the existing pure policies using one explicit as-of feature/coverage snapshot, keep zone configuration and refresh cadence explicit, and test identical fixtures through live and research paths. Align close/partial/re-entry state transitions before treating the current long stack as the comparison baseline. No live threshold adjustment is implied.

## M1 — Preserve source freshness and book quality

References: `src/hyperliquid-collector.ts:434`, `:461`, `:465`, `:630`; `src/bot/shadow-logger.ts:213`, `:267`.

The collector periodically writes the latest cached book with a new local `timestamp` while retaining `exchangeTimestamp`. It does not clear the cached book in the WebSocket close handler. The general pulse reader measures book age from the new local timestamp. A recently written row can therefore carry an older underlying book.

Complete streamed book-file check for **July 6 19:02:21.177 through September 4 19:02:21.177 UTC**:

- 345,584 rows; zero missing exchange timestamps or 0.5% truncation flags.
- Zero rows flagged either-side truncation at 0.5% or 2%.
- All 345,584 rows flagged the 0.1% band too coarse.
- 14 rows had exchange-to-sample age >90s; none >180s. Maximum 123.277s at August 23 08:19:14.334, referring to book time 08:17:11.057.
- No malformed JSON rows were found while streaming the file.

This does not show that any stale snapshot caused a live trade. It shows why source freshness must not be inferred from file/sample freshness. Untruncated flags are collector evidence, not proof of exact unaggregated prices, complete network delivery or tradable liquidity.

Minimal next repair: preserve received/source/published timestamps and per-stream health, distinguish collector liveness from market-data freshness, and honor truncation/resolution flags. Historical HL taker publication still needs the explicitly documented latency assumption where receipt time was not stored; do not invent missing receipts. A joint-coverage mask should distinguish unavailable data from genuine zero flow.

## M2 — Feature meaning before feature search

These are research definitions, not proposed changes to current live gates:

- Native OI and USD-marked OI are different. The collector computes `openInterestValue = openInterest * markPrice`; falling USD OI alone does not prove positions were closed. Keep both components for testing.
- Normalize funding magnitude by its recorded interval before cross-venue comparisons; raw per-interval rates are not interchangeable. Sign-only tests have a different interpretation.
- The stored book is sampled and aggregated (`nSigFigs_3`, `bestBidAskAreAggregated=true`). It supports band/persistence studies, not claims about exact queue placement, individual cancellations or guaranteed fills at its reported best price.
- HLP `maxDistributable` snapshots are not a deposit/withdrawal transaction ledger. Do not label their difference as proven investor inflow/outflow.
- Flow ratios need sample coverage and underlying notional/count information. A ratio without its denominator/volume can mistake thin activity for strong pressure.

Existing HLP findings are a useful warning: the August 12 pass found time-confounded/unstable standalone features and only a 44-trade conditional watchlist result. Repaired research needs renewed validation; that prior study is not a license to turn vault movements into an entry gate.

## Before profit sign-off, not a reason to delay all exploration

- Model current maker outcomes, remaining position/state and fallback behavior with realistic costs. Use actual fee/funding settlements to reconcile live attribution. The already-documented funding-cursor defect remains unchanged; do not back-charge estimates into state.
- Preserve durable open/partial/close execution records and config identity. Bounded current receipts and attempted-open logs are not a complete historical fill journal.
- Freeze the repaired baseline/source/data manifest before comparing candidates. Older totals and archived interval files are not automatically re-certified by the source-time repair.
- Treat the repeatedly mined historical period as development data. Use chronological validation without threshold leakage and freeze rules before collecting genuinely new forward observations. Thousands of adjacent minute rows near one zone are not thousands of independent trials.

## Recommended boundary for the next task

First complete H1/H2 and the source-quality contract. In parallel, descriptive research can catalog independent encounters with then-known S/R levels and the accompanying pulse conditions. Compare S/R-only, pulse-only and their interaction before running promising fixed rules through the corrected portfolio baseline. Report missed recoveries/TP cycles and exposure changes as well as avoided losses.

No variant rankings, per-variant month deltas or promotion gate are applicable to this readiness review: **zero strategy variants were tested**. No claim is made that another profitable combination exists. There is enough information to investigate; there is not yet enough replay fidelity to trust a new dollar-profit leaderboard.
