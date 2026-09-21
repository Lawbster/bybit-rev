# PVM01: historical POC / NPOC maps

Research-only. No orders, policy changes, live collector, PnL sweep or new trading
trial. These maps supplement, not replace, the local14d and major S/R maps.

## Open the map

The stable viewer path is `backtests/poc-viewers/hype-poc.html`. Open it directly
in a browser; no server, CDN or internet connection is needed. The adjacent
`latest.json` points to the immutable map directory.

- Select Bybit or Binance independently. Prices/retests use that venue's tape.
- Select daily, Monday-start weekly, monthly, or all three.
- Default rows are $0.10 wide; $0.05/$0.20 are numerical diagnostics, not tuned
  strategy parameters. A displayed centre represents the entire `[lower, upper)` row.
- The UTC cursor hides unfinished/unpublished profiles and future retests.
- Uncheck **Untested only** to inspect previously tested POCs. Sort any register
  column; default is price high to low. Click a row for its saved distribution.
- The chart uses completed hourly candles; individual trade touches, including
  wicks, determine retests. A candle need not close at the POC.

POC is descriptive maximum executed **base volume**, not guaranteed support or a
magnet. Ties choose the lowest row and preserve all tied rows. Weekly/monthly
profiles sum distributions; they never average daily POCs. No venue substitution
or combined-volume profile is present. HL remains explicitly unavailable.

## Time and quality contract

Canonical scope: 2024-12-05 12:55 UTC through 2026-09-15 20:20 UTC. First/last
partial calendar periods are not eligible. Binance begins May30,2025, so its
earlier history is absent, not borrowed from Bybit. A day without trades is not
automatically a missing day: zero-volume candle minutes can reconcile exactly.

Trade archives reconstruct **corrected exchange history**, not historical network
receipt. Profiles become available at UTC period end + 60 seconds, a modeled
delay, not an assertion about archive publication or live delivery. Native-price
minute histograms reveal a touch only after that minute closes. A touch between
period close and publication can make a profile already tested at publication.

Every eligible period must reconcile every minute's base volume exactly and quote
turnover within 0.000001 quote units against the same venue's candles. A missing
or mismatching minute excludes the period. An unverified minute after publication
makes an untouched POC **uncertain**, never confidently naked. A later observed
trade proves it has been tested, but does not prove the first retest time if
earlier coverage was uncertain. The full catalogue retains exclusions.

The existing canonical candle-repair bundle is revalidated (response hashes,
neighbours and native five-minute witnesses). Recovered comparison candles are
then checked against the actual trade histogram. This is a separate derived
quality overlay; it does not overwrite source candles, raw tape or saved ingestion
partitions. `comparison-repair.json` records each exact/tolerance check.

This first version is deliberately conservative: an unresolved minute makes all
still-untested profiles uncertain, including distant prices. It does not use
candle high/low bounds to waive tape-quality failures. **Uncertain is not tested**;
it means the exact-tape dataset cannot certify uninterrupted no-touch coverage.

All code consumes UTC epoch milliseconds. Retests start after the originating
period ends, on the same venue, and have no 14-day expiry. A Binance raw trade-ID
gap alone is not a data gap; the source audit established exact volume despite
nonconsecutive IDs. Duplicate/out-of-order IDs fail ingestion. Bybit duplicate
IDs likewise fail instead of silently doubling volume.

## Stored layers — reuse these, do not rebuild per strategy

| Artifact | Purpose |
|---|---|
| `poc-history-data/<key>/plan.json` | Frozen card, archive list, code and input hashes |
| `raw/*` | Compressed originals, SHA256, publisher checksums where supplied |
| `days/<venue>-<date>.vap.jsonl.gz` | Exact native-price/minute executed volume, buy volume, trade counts and first/last observed times |
| `days/<venue>-<date>.json` | Native daily distribution, minute quality, provenance and histogram checksum |
| `poc-history-map/<key>/map.json` | Final profiles/distributions and lifecycle metadata; catalogue contains future history, not a decision API |
| `<venue>-daily-index.json` | Compact, cutoff-clipped reusable map inputs |
| `lifecycle.jsonl` | Publication, uncertainty and observed-retest events ordered by knowledge time |
| `register.csv` | Readable full-history eligible register, price descending, state **at dataset cutoff** |
| `excluded-profiles.json` | Incomplete/unverified periods and reasons |
| `quality-issues.json` | Every unresolved minute with observed tape/candle quantity and turnover |
| `summary.json` | Coverage and counts by venue/period/grid |
| `independent-verification.json` | Independent arithmetic/lifecycle and native-histogram spot checks |

Raw archives and normalized partitions are local large research artifacts; code,
cards and findings should be versioned. The build never mutates accepted prior
PVA01/PVA01B audit artifacts. Existing seven audited archives are reused by hash.

## Replay access

Use the reader rather than reading cutoff-state CSVs or future lifecycle fields:

```ts
import { openPocMap } from './poc-map-reader';
const map = await openPocMap('backtests/poc-history-map/KEY/map.json');
const levels = map.nakedAt(decisionAt, {
  venue: 'bybit', period: 'week', width: '0.10',
});
// map.at(...) includes tested/uncertain levels, with future evidence removed.
// Queries beyond map.cutoff throw. Load once, then reuse the indexed reader.
```

The reader requires a passed independent-verification receipt matching the map's
identity and SHA256; a merely generated, unverified map is not replay-ready.

The pure profile engine is symbol-generic. This dataset's source inventories,
comparison files and frozen card are HYPE-specific; another pair requires its
own source audit/card, not relabeling HYPE or guessing unavailable history.

## Commands and resumability

```powershell
# No downloads; validate math/clock and the previously audited sample parser.
node -r ts-node/register scripts/poc-profile-tests.ts
node -r ts-node/register scripts/poc-reader-tests.ts
node -r ts-node/register scripts/poc-history-parser-tests.ts

# Expensive once-per-history ingestion. Reuses completed, hash-checked partitions.
# Do not sync/modify source candles during this job.
node -r ts-node/register scripts/poc-history-ingest.ts

# Use the printed data path, not a new download per strategy.
node -r ts-node/register scripts/poc-history-map.ts backtests/poc-history-data/KEY
node -r ts-node/register scripts/poc-map-verify.ts backtests/poc-history-map/MAP_KEY
node -r ts-node/register scripts/poc-viewer-browser-tests.ts
```

Four local workers, no VPS workload; 15GiB disk reserve, 30GiB new-download budget,
512MiB per archive, 3GiB expanded cap. Downloads have finite retries/timeouts.
Accepted map directories refuse replacement. Interrupted ingestion can resume
the same identity; a changed input/parser creates a different identity rather
than mixing source definitions. Never delete accepted evidence to force a rerun.

To study a different row grid, change/review the map card and call the **map**
builder with the existing data key. It reuses the saved native-price distributions,
not the raw-trade parser/download stage. A map window cannot exceed its saved
dataset. Automatic forward collection/incremental extension is not installed;
an extended source job must explicitly preserve/reuse prior partition references.
