# Actual TP / Hyperliquid event atlas

Research-only sidequest, September 7, 2026. No strategies, ladder replay,
combination tests, exchange calls or live changes. This describes actual
recorded closes under the configurations that operated at the time.

Frozen study card: [tp-hl-events-2026-09-07.json](../../research-inputs/tp-hl-events-2026-09-07.json).
Findings: [TP / HL atlas](../../research/codex-astra-tp-hl-event-atlas-findings-2026-09-07.md).

## Scope and event identity

The start is the first local HL OI/funding observation, April 25, 2026,
23:09:32.643 UTC. Richer taker/book/asset/candle collection starts May 17.
The cutoff is the copied runtime snapshot, September 7, 04:30:54.175 UTC.
Missing earlier rich features stay null, not zero or backfilled market guesses.

One long **batch close**, not every rung closed, is one event. Exact duplicate
journal rows are deduplicated. `events.jsonl` retains journal rows and PM2
file/line/text evidence. Full closes, S/R partials and transactional shorts
have separate identities and cohorts. A later batch close following an S/R
partial is not another record of that partial's already-booked PnL.

Classification, strongest evidence first:

1. Exact journal `TP`, `STALE TP` or `NATIVE_TP` reason: explicit TP.
2. Legacy reason absent, uniquely matched PM2 batch close and a compatible
   preceding `BATCH TP HIT`, without conflicting forced-exit context:
   log-supported TP. Match uses count, rounded PnL, fees, weighted entry,
   exit price and time. Context is bounded to 180 seconds and cleared at each
   preceding batch close. Log seconds are not exchange milliseconds.
3. Forced reason or compatible actual flatten trigger: forced full close.
4. Otherwise unclassified. Positive PnL is **not** proof of TP. An explicit
   `EXTERNAL_CLOSE_UNCLASSIFIED` is not silently relabeled from price proximity.

Legacy PM2 lines without a calendar date inherit the journal's nearest UTC
day only after that multi-field unique match. A full PM2 match improves event
attribution, not proof of original private exchange execution completeness.

The bounded short receipt ledger retains native-close evidence but not the
exact TP-versus-SL type. Favorable/adverse native closes are therefore labeled
**untyped**, separately from timeout/other shorts; positive timeouts are not TPs.
No live short is enabled by this work.

## What “impact time” means

`timing`, `timingExact`, `journalAt`, `eventAt`, `journalDelayMs`,
`impactAnalysisEligible` and `impactExclusionReason` travel with each event.

- Verified execution export: use last execution time for the batch, preserving
  the original journal time separately. The card contains one user-provided
  August 20 native TP export; no private API was queried for this atlas.
- Compatible PM2 TP trigger: use the earliest trigger in the matched close
  context. It is a **trigger proxy**, usually seconds before commit, not a
  claimed exact fill. Later maker fills could precede detection.
- An explicit TP with no fill/trigger time remains in TP money/count tables,
  but its journal-aligned context is excluded from the primary impact cohort.
- S/R partials use execution-log time; native short execution receipts may
  retain real last execution time. Other receipt/closed-PnL update times are
  labeled proxies. Their tables remain separate from full long TPs.

Do not choose a historical price touch as a missing fill-time substitute.
“HL at impact” means *HL context as of that timestamp*, not causal impact
of our Bybit order on the HL market.

## Availability and windows

Every event has 16 exact-ms snapshots, at offsets -15 through 0 minutes.
At each checkpoint, each feature uses only its own available past window.
For example, the rolling 15-minute flow at offset -15 looks approximately
30 to 15 minutes before the event; offset 0 looks at the last 15 minutes.
This is a trajectory of rolling conditions, not 16 independent trades.

Source availability is the maximum of source/window end and recorded
receipt/observation/publication clocks when present. For legacy taker and HL
candle rows without arrival clocks, primary availability is **end + 60s**,
consistent with the prior research convention. A separate end+0s sensitivity
is optimistic, not evidence of actual zero-latency access. Candle start is
never treated as closed-bar availability.

The exact clock join never includes a later same-minute book/asset sample.
Book freshness uses the underlying exchange book time, not just its repeated
collector sample time. Historical asset/REST sample clocks are proxies; they
cannot prove when an upstream exchange change really arrived. The generated
`historicalArrivalProven` flag must not be conflated with modeled `coreHealthy`.

The wall-clock flow interval is `(query - 15m, query]`, restricted to available
buckets. With +60s, normally 14 of its 15 minute buckets are known. That last
missing minute is omitted, **not assigned zero volume**. The count and raw
observed totals are retained. Fewer than 14 buckets, conflicting bucket
copies or no traded notional mask the primary 15m features. Five-minute flow
requires four buckets. Exact duplicates are deduplicated; only conflicting
copies already available at a query can invalidate it. A later duplicate
cannot rewrite a prior decision. Missing minutes are not assumed silent.

## Feature dictionary

All changes are calculated independently at each as-of checkpoint. Numeric
null means unavailable/invalid, not a zero observation. Full source pointers,
query times, age, freshness and modeled publication times accompany JSONL.

| Family | Main exported fields | Interpretation / limit |
|---|---|---|
| Taker | `buyShare15`, `takerRatio15`, `netTaker15Usd`, `turnover15Usd`, `tradeCount15` | Ratio of summed buyer-/seller-initiated notional, not average ratios. Buy share stays defined for all-buy flow; buy/sell ratio is null if denominator zero. |
| Pace | `buyShare5`, `buyShareAcceleration`, `turnoverPaceRatio`, `lastMinuteBuyShare` | Last available 5m vs preceding 10m, normalized by observed minute counts for pace. Not forward prediction. |
| Large prints | `largeBuy15Usd`, `largeSell15Usd`, `largeShare15` | Collector threshold lives in the source rows; absent metadata is not a universal definition of “whale.” |
| Book | `bookImbalance025/05/2`, band bid/ask USD, `bookImbalance05Change15`, bid/ask depth change %, mean imbalance and bid-dominant minute share | Aggregated 20-level book snapshots. Truncated/coarse/unknown bands masked. No individual cancel, queue or spoof inference. 0.1% band excluded as coarse. |
| OI | `assetNativeOi`, `assetNativeOiChange15Pct`, corresponding REST `oi*` fields | Native coin OI measures contracts, not direction or long/short identity. |
| Marked OI | `assetMarkedOiUsd`, `assetMarkedOiChange15Pct`, `assetMarkChange15Pct`; REST equivalents | Marked USD OI moves mechanically with price. Never present as pure leverage inflow. |
| Funding | `fundingPerHour`, `fundingHourlyChange15`, `premium` | Decimal rate per documented funding hour, not dollars of account funding. |
| HLP | `vaultApr`, `vaultDistributableUsd`, `vaultDistributableChange15Pct` | Snapshot APR/distributable capacity. Changes are not proven deposits/withdrawals. |
| Price/volume | `hlClosedPrice`, `hlClosedReturn15Pct`, `hlClosedVolume15`, `hlLast5mReturnPct` | Completed HL OHLC and base volume. Continuous 1m windows required. Stored HL `turnover=volume*close` is **not** used as genuine quote turnover or exact VWAP. |

`coreHealthy` means sufficient available taker flow + fresh usable 0.5% book
+ fresh asset sample. It does not require every ancillary series to be healthy.
Each feature has its own valid n. Book persistence uses latest available
samples per UTC minute bin, requires at least 12 bins, and is a sampled
persistence description, not second-by-second queue reconstruction.

## Accounting and reference

`bookedPnl` is the journal/receipt's net number; `bookedFees` is reported
separately and **not subtracted twice**. This is not wallet return or an
independently audited funding-inclusive ledger. Old entry/holding-time
reconstruction is accepted only if all logged filled rungs reproduce count
and weighted entry, with no intervening partial. Modern decision attempts
are never substituted for fills. Unknown size/holding time stays null.

Baseline here means **recorded full-close results** and **ordinary market
conditions**, not canonical `sim-exact.ts`. There are zero strategy variants
and no replay output to compare to the canonical sim.

The all-market reference is a 5m grid through the same date range with the
same availability/health masks. Hourly capture density uses approximate
healthy reference hours (`valid grid samples * 5/60`); it is not a per-trade
win probability. The bot's full historical at-risk exposure is not known.
TP counts by hour cannot tell us the best entry hours.

Feature comparisons include the ordinary raw reference and a month+UTC-hour
standardized mean: each event is compared with valid 5m samples in its own
month/hour cell (minimum 10 observations). This adjusts sampling composition,
not regime, price path, ladder exposure, contemporaneous market structure or
selection bias. Forced closes have their own proxy-timed comparison, not an
interchangeable control group. Sample sizes remain visible.

`pairedLeadIn` restricts each feature to events with all 16 valid snapshots;
`leadIn` instead keeps the available n at each checkpoint. Do not interpret
different missing-data cohorts as a within-event change.

## Files and reuse

Accepted local output: `backtests/hype/hype-tp-hl-event-atlas-2026-09-07-v2/`.
Revision 2 corrects CSV quoting; definitions and numeric results are unchanged.
The original unsuffixed folder is a superseded artifact, not the package to reuse.

| File | Use |
|---|---|
| `events.csv` / `events.jsonl` | Stable event ID, TP class, money, UTC grouping, depth, timing quality; JSONL retains evidence. |
| `event-features.csv` | One feature/quality row per event at offset 0; join by `eventId`. |
| `lead-in-features.csv` | All -15..0 snapshots; safe as-of features but event-selected labels. |
| `event-context.jsonl` | Same snapshots with detailed source file/line/timestamp provenance. |
| `market-reference.jsonl` | Compact all-market 5m context reference, not exposure-matched counterfactual trades. |
| `availability-sensitivity.jsonl` | +60s vs optimistic +0s at event time. |
| `summary.json`, `hourly.csv`, `lead-in-changes.json` | Cohorts, monthly/hour/weekday/depth money, reference comparison, paired lead-in changes. |
| `descriptive-breakdowns.md` / `.json`, `descriptive-validation.json` | Generated readable tables, monthly baseline contrasts, separate cohort profiles and latency sensitivity, with integrity checks. |
| `source-inventory.json`, `catalog-audit.json` | Source spans/quality, actual-close matching and ledger limitations. |
| `manifest.json`, `validation.json`, `verification.json` | Frozen card, SHA-256 inputs/code/artifacts, runner checks and independent raw-row/arithmetic/accounting verification. |

PowerShell, local repo only:

```powershell
npx.cmd ts-node scripts/tp-hl-event-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-tp-hl-event-atlas.ts
node --max-old-space-size=8192 -r ts-node/register scripts/tp-hl-event-results-check.ts
npx.cmd ts-node scripts/tp-hl-event-report.ts
```

The runner refuses an existing output directory. To reproduce on unchanged
inputs use `--out backtests/hype/<new-name>`; pass that path as the checker's
and report script's positional argument. The report also refuses overwrites.
New incoming data requires a new dated card/run and
explicit cutoff, not silently extending this accepted result. Raw and bulky
generated artifacts remain local; code/card/findings are preservable in git.

Before any later predictive/combination test: compute these same features at
**all eligible decision times**, including non-TP and loss episodes. The
future TP label, time-to-TP, exit price, PnL and event-aligned sampling itself
must not be inputs to a live predictor. Split complete episodes/time blocks,
not randomly mixed minute rows. Test delays, costs and held-out regimes.
This atlas supplies reproducible observations and labels, not a trading edge.
