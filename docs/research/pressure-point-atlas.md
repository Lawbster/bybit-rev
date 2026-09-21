# P01 pressure-point atlas

Research-only mapping of all validated indicator families and recorded HL context around HYPE drops and current B17 modeled forced exits. It does not change trading logic or run alternative exit policies.

Start with [findings](../../research/codex-astra-pressure-point-atlas-findings-2026-09-09.md), then the [frozen specification](../../research-inputs/pressure-point-atlas-2026-09-09.json).

## Inputs and time discipline

Common rich-HL period: May 17 20:43 UTC–September 8 17:47 UTC, 2026. Older OI/funding-only history is not represented as complete multi-stream history. Some pre-event offsets precede common coverage and remain explicitly incomplete.

- Repaired, continuous Bybit minute OHLCV and actual turnover. Indicator seed fixed June 1, 2025. The baseline archive pins raw sources, repair and current configuration.
- All 5m/15m/30m/1h/4h candles require complete constituents. Snapshots choose bar end≤observation; sensitivity requires bar end+60s≤observation.
- Previously validated RSI14; CRSI3/2/prior100; ROC5 bars; MACD12/26/9; Bollinger20/2; ADX/DMI14; ATR14; signed efficiency20; UTC day/week actual-turnover VWAP; RVOL against prior20 bars/same slot prior20 days; OBV20/MFI14/CMF20.
- VWAP fields belong to the last completed candle's UTC session, whose day/week starts are recorded. They do not incorporate the unfinished current hour or reinterpret HL volume×close as actual turnover.
- HL tape reuses the TP-atlas as-of normalizer: taker, bands, asset context, REST OI/funding, vault and 1m/5m candles. Adds 60/240m flow and OI anchors. Native OI is distinct from mark-price-driven USD OI.
- Per-stream freshness and coverage are explicit. Primary legacy completed buckets use end+60s; sensitivity end+120s. Sample-time proxies are not proven delivery timestamps. Book/OI are not delayed by that bucket-only sensitivity.
- Known S/R zones use the same current 30m memory engine, closed-prefix construction and healthy recent14d coverage. No future pivot confirmation enters a snapshot.

## Cohorts and joins

`events.json` contains three distinct cohorts: mechanical market-drop crossings, both B17 models' forced-close decisions, and the original26 human-selected candle-start marks. `id` is unique; `at` is UTC epoch milliseconds. Offset snapshots use `at + offsetMinutes * 60000`.

Mechanical drop: a closed-minute price3% below the trailing12h completed-minute high. Rearm after60 consecutive minutes within1% of the rolling high. The rolling peak can expire; these are reproducible excursions, not a claim to uniquely identify every discretionary crash.

`grid.json` contains every4h boundary with a full future24h. The future low/return labels are **never features**. Overlapping forward windows must not be counted as independent events. Sampling4h boundaries does not enumerate every transient5m oscillator extreme.

`pressure.json` preserves F01's first deep−3% and surviving+60m landmarks, separately per model. `outcome` and `remainingValueChange` are labels. Open outcomes remain null. Recovery dollar costs include future improvement from the checkpoint, not merely eventual profitable closes.

`contexts.jsonl` is keyed by `at`; many events can reference the same snapshot. It contains252 numerical `values`, `indicatorSources`, delayed closed-bar values/sources, full HL quality/reference metadata, delayed HL values/quality, closed-price context and known S/R zones. Raw references point to pinned file/line identities. Large raw artifacts stay ignored in git.

`snapshots.csv` is a quoted, flat event/offset join suitable for spreadsheet review. `event-guide.md` presents every event's five checkpoints. Machine-readable full fields remain authoritative; the readable guide selects a smaller set to fit.

## Reproduce locally

Commands below require the existing repaired data, accepted L09/F01 bundles and their exact pinned sources. Use a **fresh** output directory; the producer never overwrites an existing bundle. The accepted output is `backtests/hype/hype-pressure-point-atlas-2026-09-09-v2`.

```powershell
npx ts-node scripts/pressure-point-tests.ts

node --max-old-space-size=6144 -r ts-node/register scripts/hype-pressure-point-atlas.ts backtests/hype/pressure-point-reproduction
node --max-old-space-size=6144 -r ts-node/register scripts/pressure-point-check.ts backtests/hype/pressure-point-reproduction
npx ts-node scripts/pressure-point-report.ts backtests/hype/pressure-point-reproduction
```

The checker requires fresh `verification.json`; report generation can refresh only its derived named tables/CSVs, never core validated artifacts. These are local research commands, **not VPS instructions**.

Source responsibilities:

- `pressure-point-features.ts`: causal indicator adapters, HL extensions, mechanical labels, fixed109 descriptive bins, CSV serializer.
- `hype-pressure-point-atlas.ts`: input pins, archived baseline identity, cohorts, retained source windows, snapshots and full comparisons.
- `pressure-point-check.ts`: separate market/drop calculations, raw source availability/selection, arithmetic, baseline and group checks.
- `pressure-point-report.ts`: readable full-event map and aggregate/monthly tables, preserving baseline and recovery costs.

## Interpretation boundary

No new trading definitions, economic PnL ranking or live authorization. A selected bin's future loss dollars are not a policy backtest. Any later proposed action needs a separately frozen causal replay with execution delay, fees, replacement entries, occupancy, monthly deltas and both TP assumptions. Do not tune combinations directly on this atlas and call the same episodes independent validation.
