# Production safety follow-up: candles, memory and recovery TP

Date: 2026-09-14. Status: locally tested maintenance release; **deployment pending**.

Scope: the operator's approved follow-up items 1–3. Discord authorization was explicitly excluded: the command channel is private and single-user. This does not change Discord permissions.

This builds on [batch 1](production-safety-batch1.md); both are included in the maintenance release. The original review response is [here](../../research/codex-astra-production-review-response-and-plan-2026-09-14.md). Live config, synced trading state, strategy thresholds, sizing and the short entry pause were not edited.

## 1. Candle failure isolation

Implementation: `bounded-refresh.ts`, `live-candle-source.ts`, `context-manager.ts`, and the candle/exit/entry call sites in `index.ts`.

- Each source has one outstanding request and a two-second caller wait. A timeout releases the waiter, not request ownership. No duplicate request is started while the original remains outstanding. Late responses can update the cache; errors have a ten-second retry backoff.
- HYPE 4h, HYPE 1h, BTC 1h and HYPE daily sources retain only rows that were already finalized when the request **started**. Grace is ten seconds except daily, which retains its existing UTC-rollover convention. A formerly forming row cannot become final solely because time advanced.
- Readiness requires the latest required finalized timestamp, sufficient bars and continuity in the returned window. Missing required sources block adds. A missing 4h trend input makes the trend-dependent hard flatten unavailable; it does **not** invent a hostile trend or use a stale hostile flag. Independent emergency/funding/manual/TP paths remain reachable after bounded candle waits.
- Entry readiness is rechecked before and after maker quiescence. Throttle-enabled deep adds require their six-hour 5m window; first-entry overextension checks also require the configured recent context-coverage horizon. Existing S/R coverage gating remains in force. These are failure-path changes, not new alpha thresholds. This is not a new proof of every technical indicator's full warm-up history.
- The 5m manager preserves current forming-price consumers, but excludes an old partial snapshot once its bar closes until REST refresh confirms it. Context cache invalidates on 5m boundaries too.
- Startup backfill has a 30-second overall budget checked between pages, plus bounded per-page waits and existing page limits. A last page can overrun that budget by its bounded wait. Partial hydration does not authorize S/R on unhealthy coverage.
- Runtime exposes `candles` readiness and `contextRefresh`. Watchdog warning `candle_inputs_unavailable` starts after an attempted source has remained unhealthy for over three minutes. It clears on recovery and does not trade or restart anything.

**Deliberately not done:** reducing the 5m fetch cadence to once per bar. The add throttle currently consumes a forming-price snapshot. Changing cadence would change its inputs. The 200-row refresh remains at the existing poll cadence; this patch isolates its failures rather than claiming the API-call-volume issue is solved. It also does not make all exchange/filesystem operations in the main loop non-blocking.

## 2. Telemetry and conservative memory reduction

Implementation: `runtime-performance.ts`, `pulse-row-projection.ts`, pulse/score reader call sites, `long-side-guard.ts`, and optional runtime-health fields.

Telemetry is observational only:

- RSS, heap used/total, external and array-buffer bytes.
- Main-loop work time excluding intentional polling/backoff sleep; includes awaited I/O.
- Current long-side guard label and age.
- Event-loop delay p95/max for explicitly timestamped completed windows of at least 60 seconds. First window is initially null; 20ms sampling has its own floor and should not be compared directly with differently sampled historic monitors.
- Feature/candle call counts, errors and elapsed times, plus tail bytes requested and parsed-row counts. These are process-lifetime aggregates with bounded label counts, not one-minute rates.

Sampling failure returns no performance object. Optional fields remain compatible with version-1 runtime snapshots. The existing atomic, best-effort snapshot writer is unchanged and still uses synchronous filesystem calls; this patch does not promise zero filesystem latency. No memory-based restart or trading gate was added.

### What changed in the readers

Both readers still use their own existing 30-second caches, 4MiB/6MiB byte limits, sorting, timestamp conversion and missing-file behavior. They retain only fields used by their feature builders, including required observation timestamps and order-book quality flags. No raw data is deleted. Unknown filenames retain their full row.

This is **field projection**, not shared caching or incremental ingestion. Full JSON parsing still happens, so the main CPU/parse-volume optimization remains deferred.

### Before/after measurement

One isolated local Windows Node diagnostic run per implementation, explicit GC, same mirrored input files. Three complete pulse+score evaluations at `1789340000000`, 15 seconds earlier, and 15 seconds later; price 88; copied positions; last 40,320 seed candles. Retained heap is measured relative to heap after loading these fixtures, not total process memory.

| Metric | Before projection | After projection |
| --- | ---: | ---: |
| Retained heap | 115,485,672 bytes / 110.14 MiB | 59,274,120 bytes / 56.53 MiB |
| Evaluation sequence + diagnostic GC | 735.34 ms | 743.07 ms |
| Full feature-vector SHA-256 | Same | Same |

Measured saving: **53.61 MiB (48.7%)** in this diagnostic. No demonstrated CPU improvement and no guarantee of an equal VPS RSS reduction.

Matching digest: `ad164cfb0aeed196dc890a8ee051ced3c2e1161c0ee8e34c748ffd7172902c76`.

The comparison baseline is the working reader immediately before projection, **including already-existing uncommitted HL-quality changes**, not an assertion that the entire worktree matches HEAD. `pulse-projection-parity-tests.ts` independently compares actual consumers against the identity-projection reference across 36 full-vector comparisons, including cold/warm caches, appends, cache expiry, missing files, truncation/replacement, byte boundaries, out-of-order/duplicate timestamps and malformed final lines. Future consumers of a new field must extend the projection and parity tests together.

Read-only benchmark reproduction from the repo root (PowerShell: pipe a here-string to the same Node command instead of the Bash heredoc):

```bash
node --expose-gc -r ts-node/register/transpile-only <<'NODE'
const fs = require('fs'), { performance } = require('perf_hooks'), crypto = require('crypto');
const { computeOnChainFeatures } = require('./src/bot/shadow-logger');
const { buildScoreFeatures } = require('./src/bot/score-partial-flatten');
(async () => {
  const now = 1789340000000;
  const candles = JSON.parse(fs.readFileSync('data/HYPEUSDT_5_full.json', 'utf8')).slice(-40320);
  const positions = JSON.parse(fs.readFileSync('bot-state.json', 'utf8')).positions;
  global.gc(); const initial = process.memoryUsage().heapUsed, start = performance.now(), results = [];
  for (const at of [now, now - 15000, now + 15000]) results.push({ at,
    pulse: await computeOnChainFeatures('HYPEUSDT', at),
    score: await buildScoreFeatures('HYPEUSDT', at, 88, positions, candles) });
  global.gc();
  console.log({ elapsedMs: performance.now() - start,
    retainedHeapBytes: process.memoryUsage().heapUsed - initial,
    hash: crypto.createHash('sha256').update(JSON.stringify(results)).digest('hex') });
})().catch(err => { console.error(err); process.exitCode = 1; });
NODE
```

Run diagnostics locally, not beside the live owner on the small VPS. Later synced tails/state will change the digest and may no longer contain this historical cutoff; use the fixture parity suite for repeatable regression checks. This is a reader-parity/memory test, not a historical strategy replay or an arrival-time causality audit.

## 3. Recovery-order safety

Implementation: `recovery-protection.ts`, executor recovery helpers, `StateManager.importRecoveryLong`, startup/finalizer/maintenance wiring in `index.ts`.

1. Import an orphan exchange long and its recovery lock in **one durable save**. A failed save rolls back memory and raises a fatal startup error; it cannot leave a locally imported but unlocked ladder.
2. Persist desired recovery TP before asking the executor to set it. Recovery remains active; this does not turn orphan inventory into an ordinary maker-managed ladder.
3. Use native full-position **Market TP**, explicitly long `positionIdx=1`, Mark Price trigger. Validate local/exchange quantity first, normalize TP down to the instrument tick, then read back both quantity and TP. An acknowledgement alone is insufficient. An unknown acknowledgement can be resolved by matching readback. SL is not changed.
4. Only after native TP is verified, retire a recorded legacy `recovery_tp_*` limit. Require exact symbol/order identity, long-side reduce-only ownership and terminal status. Not-found, empty fill quantity, cancel acknowledgement or ambiguous evidence cannot clear its ID.
5. A terminal legacy order with any fills remains recorded until matching accounting receipts exist. This can intentionally require manual accounting review. There is no zero-PnL clear or invented fill.
6. Retry recovery TP maintenance at most once per minute, under the existing long-side guard, **after** current-cycle risk-exit checks and before entry-only pause gates. Pending or maker ownership takes precedence. Unknown legacy IDs also block new adds.

This changes the **orphan-recovery safety net** from a standalone GTC limit to native Market TP; ordinary ladder/maker TP policy is unchanged. A TP is not downside stop-loss protection. Imported entry basis still comes from the exchange's position snapshot; this patch does not reconstruct lost historical funding, fees or entry timestamps.

Bybit documents full-position TP as Market-only, with system conditional orders adjusted for position quantity. [Trading-stop API](https://bybit-exchange.github.io/docs/v5/position/trading-stop). Cancellation acknowledgements are asynchronous, so terminal status must be observed. [Cancel-order API](https://bybit-exchange.github.io/docs/v5/order/cancel-order).

Instrument metadata now refreshes coherently on a one-hour TTL, with bounded single-flight retry. New submissions use refreshed lot/tick data; persisted intents keep their original reconciliation step. Pending long fill import no longer depends on an unrelated metadata refresh. An unavailable metadata endpoint blocks a new normalized submission, not accounting for an already-owned order. [Instrument metadata](https://bybit-exchange.github.io/docs/v5/market/instrument).

## Verification

Passed both full and VPS TypeScript no-emit checks and `git diff --check`, plus 35 suites:

```text
entry-availability-tests             main-loop-availability-tests
state-load-safety-tests              live-candle-source-tests
runtime-performance-tests           pulse-projection-parity-tests
recovery-protection-tests            context-manager-tests
candle-cache-policy-tests            sr-context-safety-tests
sr-support-reopen-tests              damaged-regime-latch-tests
long-state-transaction-tests         long-transaction-coordinator-tests
long-executor-transaction-tests      executor-normalization-tests
partial-close-transaction-tests      long-side-guard-tests
long-close-finalizer-tests           maker-tp-transaction-tests
maker-tp-coordinator-tests            maker-tp-fill-shadow-tests
aggressive10-policy-tests            aggressive10-crash-tests
operational-health-tests             operational-watchdog-tests
operational-watchdog-state-tests     runtime-health-tests
upside-readiness-tests               hl-short-transaction-coordinator-tests
hl-short-live-tests                  hl-short-breakdown-policy-tests
hl-short-breakdown-shadow-tests      hl-short-bidpullvolume-policy-tests
hl-short-bidpullvolume-shadow-tests
```

Run each as `node -r ts-node/register scripts/<name>.ts`. New main-loop tests execute extracted **production AST** with fakes, not a second implementation or a booted real bot. Recovery tests include three actual child-process exits, lost acknowledgement/readback, quantity/flat races, non-cent ticks, metadata changes, legacy cancellation ambiguity, atomic import failure and the actual startup catch propagating a failed import. Existing Aggressive10 tests add their existing crash/race coverage. These are offline tests, not live API certification.

Copied `bot-state.json` was unchanged: SHA-256 `ebf12ea902623e40df249945d7ff07a28bf7051dafd3c1dcdb1eb89daa04d745`. No exchange requests, signal-file writes, PM2 changes or deployment were performed.

## Review and deployment handoff

- The maintenance release includes this batch and batches 1/3. Unrelated research, documentation and earlier HL-quality work remain outside it. The overlapping pulse-reader and HL-collector files were staged selectively; no new HL-quality filter is being deployed by this release.
- Build/test before a brief monitored transaction-state preflight. Preserve any operator pause. On an older deployed build, do not leave an open ladder paused through a lengthy build assuming all downside exits continue; that behavior is only repaired in batch 1.
- Snapshot current VPS state; require fresh runtime, local/exchange quantity agreement, no unknown pending/recovery, and understood maker/native protection. If a maker is touched, cancelling, partially filled or has a close request, resolve that first. Do not erase a recovery ID to satisfy preflight.
- Deploy the reviewed patch with config unchanged. Restart only `hedgeguy-bot`; after its postchecks, restart `hype-health-watchdog` to load the new candle warning. No `restart all`, commander restart or short re-arming is required.
- Verify inventory/profile/receipts, TP intent, maker ownership and reconciliation. An occasional candle boundary wait is expected; a persistent missing-input warning requires investigation, not loosening the gate.

Read-only postchecks:

```bash
cd /opt/bybit-rev
jq '{writtenAt, performance, guard, candles, contextRefresh,
     reconciliation, transaction, recovery, makerTp, desiredLongTp, positions}' \
  data/HYPEUSDT_runtime_health.json
npm run watchdog -- --once --dry-run
```

Compare same-PID memory and timing after warm-up and again later; a single RSS sample cannot establish a leak or a successful reduction. Never restore an old state snapshot over newer fills.

Still outside this batch: lower-cadence/incremental refresh, shared incremental pulse ingestion, process-fatal diagnostics, collector gap repair and archive-aware log rotation. No additional strategy research or config tuning was performed.

Follow-up: [batch 3](production-safety-batch3.md) adds fatal diagnostics, availability-stamped Bybit candle repair capture, and collector-health-only rotation. See its explicit limits on live repair consumption and raw-stream rotation.
