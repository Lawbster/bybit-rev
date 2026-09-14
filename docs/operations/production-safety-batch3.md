# Production safety: fatal errors, candle repair capture and health-log rotation

2026-09-14. Locally tested maintenance release; **deployment pending**.
Includes [batch 1](production-safety-batch1.md) and [batch 2](production-safety-batch2.md).

## Assessment

| Item | Importance | Evidence / scope decision |
| --- | --- | --- |
| Partially failed collector startup | High | `data-collector.ts` previously ended with `main().catch(console.error)`. A later symbol's startup failure could leave earlier WebSockets/timers running, with PM2 still showing an online but incomplete collector. Now startup failure exits nonzero. |
| Fatal diagnostics | Medium, worthwhile | Node already normally terminates on uncaught exceptions/rejections. The missing piece was consistent synchronous diagnostics and explicit rejection termination, not that every process previously survived crashes. |
| Missing candle recovery | High for reliable research evidence | Bybit confirmed minutes were append-only, without repair or receipt timestamps. Disconnected minutes stayed missing. Recover into separate, availability-stamped journals; do not rewrite what old decisions saw. |
| Unbounded health logs | Medium preventive maintenance | The local mirror has roughly 409 MiB of collector-health history. Preserve it in archives and keep a bounded active file. This is not evidence of current VPS disk exhaustion. |
| Rotation of raw market/signal/order journals | Deferred | Live tail readers and persisted cursors are not uniformly archive-aware. Blind rotation could invalidate evidence or offsets. No such files are rotated here. |

Trading thresholds, sizing, exit policy, maker/native TP, short entry pause and live config are unchanged. No exchange calls, signal files, state edits, PM2 commands or deployment were performed during implementation. HTTP transport tests use loopback only.

## 1. Fatal handling

`src/runtime-fatal.ts` installs diagnostics before each covered service's `main()`:

- Main HYPE long owner, dedicated HYPE short owner, watchdog, both short shadows, maker-TP shadow, Bybit/Binance collector and Hyperliquid collector.
- Startup failures and unhandled rejections record a diagnostic and exit with code 1. Rejections terminate even under Node's `--unhandled-rejections=warn` setting.
- Uncaught exceptions are observed with `uncaughtExceptionMonitor`; normal fatal termination remains in place. No catch-and-continue handler is installed. Node documents that this monitor does not override its normal crash behavior. [Node process documentation](https://nodejs.org/docs/latest-v24.x/api/process.html#event-uncaughtexceptionmonitor).
- One bounded structured record goes to `logs/fatal-<service>-YYYY-MM-DD.jsonl` and synchronously to stderr. Includes UTC epoch time, service, PID, Node version, origin, error name/code/message and stack frames.
- Structured records redact matching secret environment values, URLs and common credential assignments. They do not dump environment, request/client objects, state or a full process report. **Node's own default stderr output is separate and is not guaranteed redacted.** Treat PM2 logs as sensitive.
- Diagnostic-file failure cannot prevent exit; stderr is attempted independently. Normal caught/retriable poll failures keep their existing behavior.
- No order cancellation, flatten, state save, Discord request or asynchronous cleanup is attempted on a fatal path. Existing transaction persistence/reconciliation handles restart uncertainty.

Limitations: diagnostics are best-effort synchronous writes, not a power-loss durability guarantee. OOM/SIGKILL and errors before handler installation can bypass this record. Existing normal SIGINT/SIGTERM behavior is unchanged. Retired owners and Discord command authorization were not changed. PM2's existing restart policy remains authoritative; no new restart loop or control service was introduced.

## 2. Bounded Bybit candle repair capture

Implementation: `collector-candle-repair.ts`, `collector-repair-fetch.ts`, and the `data-collector.ts` scheduler.

Each configured collector symbol gets native **1m and 5m** coverage scans of the last **48 hours**. One scan runs every 30 seconds globally, round-robin, with one repair request in flight. Six symbols means roughly six minutes between scans of the same interval. Startup starts the scan loop; reconnect gaps are found by these same periodic scans, not a separate reconnect request storm.

- At most one public REST page of 1,000 candles per scan, only if missing rows are found. Native fetch has a 10-second absolute abort covering headers/body and a 2 MiB response limit. No credentials or trading API are used.
- A candle must have closed at least ten seconds **before request start**. Identity, API result, alignment, OHLC bounds, quantities, time range and duplicate timestamps are validated. Bybit's kline endpoint can return an unfinished candle and up to 1,000 rows; a REST response alone is not proof of finality. [Bybit kline API](https://bybit-exchange.github.io/docs/v5/market/kline).
- Recent original/repair files are read through bounded 4 MiB tails, not full-history loads. Explicitly partial `n1m != 5` buckets are not counted as complete 5m evidence. Existing valid observed candles take precedence, including a WebSocket row arriving during the REST request.
- Repair pages progress toward older gaps so a venue-unavailable recent candle does not starve all older repairs. The 48h window and page limit are best-effort bounds, not a promise to fill exchange outages or older history.
- Repair rows append to `data/candle-repairs/<SYMBOL>_1m.jsonl` and `_5m.jsonl`. Native candle opening `timestamp` is preserved. `requestedAt`, `receivedAt`, `writtenAt`, `availableAt`, venue, interval, symbol and source are explicit UTC epoch values. Availability reflects local REST observation/serialization, **not historical candle close**.
- Completed batches are fsynced. On restart, complete validated rows are deduplicated. Torn tails are preserved and separated from the next append, never overwritten. This is single-writer collector operation, not a multi-process journal protocol.
- New original WS minute rows also carry additive receipt/availability metadata; new derived 5m rows carry publication metadata. Their OHLC, timestamps and callback ordering remain unchanged. No timestamp is invented for old rows.

### Important boundary: captured repair versus live adoption

**Recovered rows are not merged into the original `*_1m.jsonl` / `*_5m.jsonl` files and are not automatically consumed by the current live shadows or replay loaders.** Several existing consumers discard availability fields. Appending old repaired rows there would silently make historical decisions appear better informed.

An opt-in consumer must use `availableCandleRepairs(rows, symbol, interval, decisionAt)` and retain only records with a valid clock chain and `availableAt <= decisionAt`, with original observations taking precedence. Further reader integration needs its own parity/arrival-time tests. Do not glob every JSONL file and merge by candle timestamp alone.

Example: a 09:00 minute retrieved at 12:00 is unavailable to a 09:15 decision, even though its OHLC describes 09:00. It may be used by a suitably wired decision after 12:00. Price-only retrospective reconstruction and faithful replay of historical live availability are different datasets.

This patch therefore **captures missing history safely; it does not automatically clear an original-stream coverage incident**. Main bot REST context hydration is separate and unchanged. No HL order-book, taker-flow or asset-context history is synthesized, and no Hyperliquid candle backfill is introduced.

`data/collector_candle_repair_health.json` is an atomic best-effort snapshot after each scan. Per-stream fields include attempt/success time, bounded window, missing count, inserted count, remaining gaps and error. `lastSuccessAt` means the scan/request completed; **check `remainingMissing` and `error` for coverage**. Null means not yet checked/known. Watchdog auto-remediation and new repair-specific Discord incidents are not added.

## 3. Collector-health rotation only

Implementation: `collector-health-journal.ts`, watchdog reader and sync script.

1. Publish `data/collector_health.json` atomically with the original health-row timestamp.
2. If the active `collector_health.jsonl` is already at least **64 MiB**, rename it into a unique directory under `data/archives/collector-health/`.
3. Append the new row to the active journal. If snapshot publication fails, skip rotation and append to the existing journal. Report failures in the collector console.

No archive is overwritten or deleted. Old bytes, including a malformed/torn tail, remain intact. An active file can exceed the threshold by a row until its next publication; rotation failure leaves it larger rather than discarding data. Directory-rename atomicity protects ordinary process-crash windows, not all possible power-loss/filesystem failures.

The watchdog selects the newest valid **embedded timestamp** from snapshot/journal, including during the rename window. Missing, corrupt or future-dated records cannot look healthy from fresh mtime alone. An old deployment with only the journal remains supported. Alert thresholds and alert-only behavior are unchanged.

Historical health readers must use `collectorHealthHistoryFiles(dataDir)` to include archives and the active file. Sort parsed records by their embedded timestamp when building timelines; don't treat directory order as an exchange clock. Full data rsync already includes subdirectories. The small `--ignore-times` pass now includes both collector snapshots, including under `--no-data`.

**Rotation bounds the active health file, not total disk consumption.** Archives remain on disk and still need an eventual explicit retention/off-host policy. Raw pulse/shadow/order/transaction files, application trade records and PM2 logs are untouched. No `pm2-logrotate` installation or cron job was added.

## Verification and handoff

Passed both full and VPS TypeScript no-emit checks and `git diff --check`. **43 suites passed:** the 35 listed in [batch 2](production-safety-batch2.md), the four new suites below, plus `hl-data-quality-tests`, `binance-taker-tests`, `replay-candle-repair-tests` and `replay-causality-tests`.

The copied `bot-state.json` remained unchanged: SHA-256 `ebf12ea902623e40df249945d7ff07a28bf7051dafd3c1dcdb1eb89daa04d745`. Both live JSON config files have no diff. These checks certify the tested boundaries, not live API behavior or all historical strategy timing.

New suites (offline; fixture files only):

```bash
node -r ts-node/register scripts/runtime-fatal-tests.ts
node -r ts-node/register scripts/collector-candle-repair-tests.ts
node -r ts-node/register scripts/collector-health-journal-tests.ts
node -r ts-node/register scripts/collector-wiring-tests.ts
```

Includes ten real fatal/normal child-process cases, process death during a repair append, process death between journal rename and new append, restart deduplication, torn-row preservation, wrong/future identities/times, WebSocket-vs-REST races, permanently unavailable recent candles, partial 5m buckets, and actual loopback HTTP header/body timeouts and response-size limits. The collector callback test executes extracted production code, not the real network service.

The release excludes unrelated research and earlier HL-quality changes, including those sharing edited source files. The initial 43-suite verification above was against the local worktree. Before committing, the exact staged release was exported into an isolated directory (without local data, state, credentials or untracked research): **both full/VPS TypeScript checks and all 39 release suites passed**. Those are batch 2's 35 suites plus the four new suites here. The four additional research/HL-quality suites remain outside this maintenance release.

### Deployment timing with the existing deep carry-in ladder

Commit/push does not change a running VPS process. There is no need to wait for a flat position before publishing this maintenance release. A flat ladder is the simplest main-owner restart window, but waiting indefinitely retains the exit-availability defects fixed by batches 1/2.

An active-ladder restart is conditional on a fresh, supervised transaction preflight: inventory agrees with Bybit, pending/recovery are clear, maker is understood and untouched (no cancel/partial/close request), and protection is verified. Build/test first while the old owner keeps running. Do not leave the old build under `bot-pause` during a long build; its pause still skips some main-loop downside checks.

The existing carry-in ladder must retain its stored baseline profile and 0.5% stale TP where already selected. No forced flatten or manual state/profile edit is part of maintenance. Aggressive10 remains enabled only for the next fresh ladder after complete close/finalization. Verify that profile and TP basis again after restart. If current protection/ownership cannot be established, defer the restart and investigate rather than forcing it through.

For an eventual approved deployment, load the new watchdog reader **before restarting `bybit-collect`**, then verify health continuity, archive preservation and repair telemetry. Load fatal handling on other covered processes during their individually reviewed restarts; do not restart everything together. Any trading-owner restart still requires the existing transaction-state/maker/native-protection preflight. Config stays unchanged; shorts stay entry-paused. No VPS action has been taken here.

Read-only postchecks after that deployment:

```bash
cd /opt/bybit-rev
jq '{timestamp, symbols: [.perSymbol[].symbol]}' data/collector_health.json
jq '{writtenAt, busy, repairOnly, streams}' data/collector_candle_repair_health.json
npm run watchdog -- --once --dry-run
```

Side observation: the HL candle flusher still promotes cached candle snapshots after wall-clock expiry and has a forced shutdown flush. That separate finality contract is not repaired by this Bybit gap-capture patch. Do not interpret these tests as certification of all legacy collector/replay timing paths.
