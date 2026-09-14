# Production review: verified findings and proposed implementation plan

Date: 2026-09-14. Status: **review only; implementation requires approval**.

Companion: [Fable's production review](fable-5.1-production-code-review-2026-09-14.md).
Source baseline: `bc06851`, plus the existing local working-tree changes. No production source, config, state, or research output was changed by this review. Existing edits to `shadow-logger.ts`, the HL collector, indicators and documentation are not this patch and must not be swept into it.

## Bottom line

- **Fix exit availability first.** The five-minute guarded sleep and corrupt-state fallback are real defects. Candle-fetch failures can interrupt risk checks. An additional defect: manual `bot-pause` skips the main-loop risk exits and periodic reconciliation, contrary to its documented adds-only meaning.
- **Keep the safeguards.** Transaction ownership, exact fill accounting, recovery restrictions, Aggressive10 carry-in behavior and continuous-candle requirements are intentional. Do not weaken them to make errors disappear.
- **Optimize the readers after measurement and parity tests.** A local reproduction confirms roughly 110 MiB retained by the two caches. It does not establish a growing leak or prove they caused historical API timestamp failures. Latest VPS measurements show no active memory pressure.

This is an operational review, not a strategy comparison. There are no new PnL claims, strategy thresholds, fee changes, or short-entry changes.

## Findings: accepted, corrected, or deferred

Line references below refer to the inspected working tree.

| Fable item | Verdict | Evidence and correction |
| --- | --- | --- |
| P1-1: rejection sleep | **Confirmed, high priority** | `src/bot/index.ts:3693,3727-3732`, guard wrapper at `1338`. The awaited five-minute sleep holds both the callback's guard and `orderInFlight`, blocking subsequent loop work and bot-side TP handling. Backoff is legitimate; implementing it by holding the execution owner is not. |
| P1-2: config re-parse | **Confirmed, narrower impact** | `index.ts:455,2861-2865`; `bot-config.ts:602`. There are two reload sites in the add path. They execute **after** emergency/funding/hard-flatten/partials/high-exit checks. Failure reaches the outer catch at `3817`, sleeps 30 seconds, prevents later work and repeats. It does not switch off every exit continuously; WS/REST TP remains independent. |
| P1-3: corrupt state becomes empty | **Confirmed, high priority** | `state.ts:201-240`. Both malformed JSON and some wrong field types fall through to `emptyState()`. Existing receipts, inventory identity and cooldowns are lost. Current startup import filters `side === "Buy"` (`index.ts:4084`); the historical May short-import incident is not proof that the same side-selection bug remains today. |
| P1-4: kline refresh/rate errors | **Confirmed availability weakness; cause attribution incomplete** | Five-minute refresh calls REST every eligible loop at `context-manager.ts:91` / `index.ts:2073`, but its errors are caught there. The unguarded `getHype4h()` at `index.ts:2224` is before emergency checks and can abort them. The other timeframe callers need separate classification. 8,640/day is the nominal ten-second ceiling before work/retry delays, not a measured rate or proof of which limit was exceeded. |
| P2-1: duplicate caches | **Confirmed efficiency target, not proven leak** | `shadow-logger.ts:29-64` and `score-partial-flatten.ts:129-166` retain overlapping parsed tails. Byte limits and fixed filenames bound the caches; they are not inherently unbounded arrays. The score feature is enabled but **shadow-only** in `bot-config.json:109-111`, not a live score-triggered partial exit. Its CPU/RAM cost still affects the live process. |
| P2-2: telemetry growth | **Confirmed maintenance need, not current disk incident** | Three mirrored files measure 536.8 / 695.1 / 409.2 MiB (gate shadow / HL book / collector health). VPS disk is 29% used, with 52 GiB available in the latest capture. Rotation alone does not bound total storage; retention/archive policy is also required. |
| P2-3: fatal handlers | **Partly valid; proposed fix must change** | The main bot already has a fatal startup catch and nonzero exit (`index.ts:4243`); PM2/watchdog already detect restarts. Absence of global handlers is not itself unsafe. `data-collector.ts:1364` catches startup failure with only `console.error`, potentially leaving initialized timers/feeds alive: that is a concrete defect. Global fatal logging must preserve termination, not attempt trading or asynchronous recovery. |
| P2-4: recovery TP normalization | **Confirmed; larger than rounding alone** | `index.ts:4146` submits a GTC recovery limit outside the normal executor path, with decimal formatting, **no explicit `positionIdx:1`**, and only stores the exchange ID after submission. There is an unknown-submit/crash ownership gap as well. Both instrument caches (`executor.ts:663-664,693-725`) lack expiry; refreshing only one would leave the other stale. |
| P2-5: commander authorization | **Confirmed trust-boundary weakness** | `discord-commander.ts:134,395-403` relies on access to the configured channel, excludes bot authors, and uses username for attribution only. Anyone allowed to post can request mutations. Actual exposure depends on channel permissions, which this review cannot inspect. User-ID authorization is worthwhile; mandatory two-message close confirmation is a separate operator workflow choice. |
| P2-6: missing collector candles | **Confirmed, recovery needs causal metadata** | `data-collector.ts:180-184` appends confirmed WS candles; `1071` warms from local historical files, not the REST startup fetch described in the review. There is no minute-gap recovery in this path. REST-backed Aggressive10 context is independent; local-file consumers can remain degraded. A `source: backfill` tag alone is insufficient to preserve when repaired data actually became available. |
| P3-1: extra symbols | **Deliberate research collection; no removal authorized** | BTC/SOL relative-strength work and cross-pair research make “no bot on this pair” insufficient grounds to delete its collection. Per-symbol depth reduction also changes the meaning of recorded book metrics. Inventory consumers first, ask before reducing scope. |
| P3-2: duplicate helpers | **Real maintenance cost; defer broad refactor** | Sharing ingestion is useful. Merging complete shadow runtimes at the same time would unnecessarily widen the safety patch and risk changing timestamps, cursors and active shadow runs. |
| P3-3: runtime performance metrics | **Useful addition** | Existing health reports freshness and stale-loop incidents (`operational-health.ts:170`), but not memory composition, tick execution duration or tail-read work. Add measurements before reader optimization; no automatic restart/flatten and no universal “700 MB is bad” threshold. |
| P3-4: retired branches | **Mostly dormant maintenance debt** | HYPE startup guards reject retired hedge execution/state. Preserve them. Removing legacy wrappers/registries is a separate compatibility exercise, not prerequisite to the safety fixes. |
| P3-5: Aggressive10 missing coverage | **By design; the suggested alert already exists** | `operational-health.ts:164-168` raises `aggressive10_context_unavailable` after 180 seconds using last healthy time or process start, only while the profile is active. `operational-health-tests.ts:75-89` covers it. The inactive carry-in's zero bars correctly produce no incident. Do not add a duplicate 15-minute alert. |
| P3-6: two execution guards | **Keep for this patch** | Redundancy alone is not a demonstrated defect. Fix long waits and exceptional cleanup first; do not collapse two ownership mechanisms alongside trading-loop repairs. |
| P4: style/context/state formatting | **Leave alone** | No demonstrated need to rewrite the technical engine or synchronous durable state saves. “Zero direct-import test scripts” is a useful integration-coverage warning, not proof that all underlying behavior has zero coverage. |

### Additional high-priority finding: manual pause skips risk management

`src/bot/index.ts:2143-2152` handles `signals.paused` by sleeping and continuing **before** periodic reconciliation (`2155`), trend refresh (`2224`), emergency/funding/hard-flatten/partials (`2282` onward), soft-stale and Aggressive10 high exit (`2729`).

Reproduction: with an open ladder and `bot-pause` present, an adverse price can satisfy emergency/hard-flatten conditions, but the loop never reaches those evaluations. This is not the damaged-regime/trend block: it is specifically the operator's manual pause signal.

What remains operational: pre-pause maker/pending resolution, manual flatten handling, independent WS/REST TP and whatever exchange protection is actually resting. A manual pause is therefore **not currently equivalent to “all exits continue, no adds.”** That conflicts with `docs/operations/aggressive10-live.md:106` and the command help.

Proposed repair: retain pause detection/logging but enforce its prohibition at the entry boundary, after risk checks/reconciliation. Test the real paused control flow, not just the pure exit functions. No automatic resume and no migration of an existing ladder's profile.

### Important qualification to the guard-sleep finding

Before an open, `quiesceMakerTpForMutation()` (`index.ts:1371-1424`) restores and verifies native TP, then cancels/resolves the maker. On the ordinary successful-quiesce/rejected-open path, the resting maker is already cancelled. **Do not assume both maker and native TP remain present throughout the five-minute sleep.** Native protection is the expected remaining exchange safety net on that path. Neither native nor maker TP substitutes for a downside emergency exit.

## Evidence reproduced in this review

### Logs and current runtime

- Position-limit signature: **56,560 error rows across three April dates**, not 56,560 distinct orders; multiple log lines may describe one rejection. Sleep introduction traced to `6f25c76` (2026-04-10).
- Config syntax signature: **55 rows**, April 12 08:27:15–08:54:31 UTC. Current source determines today's impact; April messages alone cannot establish today's exit ordering.
- Rate-limit signature: **21 rows across 16 dates**, latest September 13 20:00:16 UTC. Recent events cluster at four-hour boundaries. Current logs lack endpoint-budget/header/latency detail sufficient to attribute all failures to the 5m reader.
- September 13 22:59:30 UTC mirrored health: 11 rungs, 673.88 long quantity, no pending/recovery, maker active, Aggressive10 configured but inactive. This is copied evidence, not a live exchange poll.
- In-memory filesystem stubs against the actual `StateManager` reproduced two cases: malformed JSON and a string-valued realized PnL. Both returned zero positions, null pending, zero PnL and recovery false. No real state file was written.

Bybit documents separate IP and API/UID limits. A low daily average does not identify a burst/endpoint failure; record sanitized endpoint, interval, response code, latency and available rate-limit headers before asserting its source. Never log authentication headers. [Bybit rate-limit rules](https://bybit-exchange.github.io/docs/v5/rate-limit).

### Memory reproduction and corrected VPS interpretation

Isolated local Windows process, Node v24.13.0, `ts-node/register/transpile-only`, explicit diagnostic GC; data cutoff `1789340000000` (September 13 22:53:20 UTC). Read-only calls to the actual feature builders with the mirrored positions and last 40,320 seed candles:

| Measurement | Wall time | Heap after diagnostic GC |
| --- | ---: | ---: |
| Before builders | — | 35.56 MiB |
| Pulse cold | 259.7 ms | 83.73 MiB |
| Score cold | 345.7 ms | 145.59 MiB |
| Pulse warm | 7.9 ms | 145.82 MiB |
| Score warm | 56.2 ms | 145.62 MiB |
| Technical context | 26.5 ms | 145.77 MiB |

Approximately **110 MiB retained** is independently supported. Cold wall time is not identical to a continuous 605 ms event-loop stall: asynchronous file reading yields, and GC/CPU behavior differs across hosts. This run does not justify promising 100 MiB savings from a future rewrite.

Latest operator VPS capture, September 13 23:02:58 UTC: **1.2 GiB available, 15.5 MiB swap used, no swap-in/out during sampling, main RSS ~715 MiB, heap used ~169 MiB, event-loop p95 1.4 ms**. The review's 804 MiB swap number belongs to August, not this capture. The supplied process tree also identifies ~1,055 MiB in four workers under the collector/commander/alarm npm launchers; PM2's launcher RSS does not describe their whole footprint. Kernel OOM output was not supplied beyond the sudo prompt.

No current emergency RAM upgrade follows from these measurements. No proof that swap caused either `recv_window` incident; one incident also has DNS errors. Keep attribution open.

Existing offline suites rerun successfully: `long-side-guard-tests.ts`, `operational-health-tests.ts`, `context-manager-tests.ts`. These are not full-loop integration tests, and no new fix has been validated or deployed.

## Proposed sequence for approval

Each behavioral boundary below should be independently reviewable. Build a minimal fake-executor/fake-clock loop harness before changing loop control flow; never import the production entry point in a way that boots real clients or consumes real signal files.

### 1. Restore exit availability — first implementation tranche

**1A. Non-blocking rejected-add backoff.** Replace guarded sleep with an entry-only retry deadline. Check it after exits and before maker quiescence/open submission, so cooldown polling cannot repeatedly cancel/re-arm protection. Preserve five minutes and the established rejection classification initially; broader substring/retCode policy is a separate change. Pending/unknown submissions remain owned by the resolver regardless of the deadline. Backoff is operational retry state, not a new strategy cooldown; never change `lastAddTime`, fill receipts or forced-exit cooldown to implement it. A restart must not bypass an unresolved intent.

**1B. Safe cap reload.** Keep the last successfully validated base cap separate from an override. Isolate/coalesce the two config reads; invalid or missing runtime files must retain the last valid cap and emit a deduplicated warning, never import defaults or throw into the main-loop catch. Continue supporting the existing valid cap reload/override behavior. Capturing the cap only once at startup would silently remove existing hot reload, so it is not the default proposal. No other fields become hot-reloadable. Invalid/foreign-symbol override data must not grant a bridge add.

**1C. Adds-only manual pause.** Move the pause's early return below risk management to the entry boundary. Preserve signal consumption, manual-flatten priority and operator pause persistence. A paused process continues maker/pending resolution, periodic reconciliation and eligible exits. Do not refactor the two guards in this tranche.

**1D. Isolate market-data failures.** A failed/hung observational or trend refresh must not prevent price-based emergency/manual/TP work. Use bounded, single-flight refresh and explicit source readiness; do not create overlapping uncancelled requests on timeout. A previous cache is usable only if it contains the required finalized source window. In particular, a formerly forming candle does not become a valid final close just because time passed. Missing required trend data blocks adds and makes a trend-dependent exit unavailable/alerted; it does not invent hostile trend, relax a gate, or suppress independent risk exits. Preserve exit precedence when all inputs are healthy.

Acceptance tests: rejected open -> immediately free guard -> emergency and TP can run; no resubmit before deadline; unknown submit retained; malformed/missing config with valid inventory -> exits still reachable; override apply/bridge/reset; paused baseline and Aggressive10 ladders at emergency/funding/hard-flat/high/partial thresholds; paused reconciliation; candle rejection and never-resolving refresh; one market close under simultaneous WS, manual and loop triggers; unchanged healthy-path decisions.

### 2. Fail closed on unreadable durable state

Throw before exchange mutation for existing corrupt/unreadable state and invalid critical field shapes; preserve valid legacy migrations. Treat genuine absent-file initialization separately from parse failure. Do **not** add a casual `--accept-empty-state` escape hatch or automatically fall back to an old backup: receipts may be missing even when inventory is now flat.

A last-known-good backup can assist forensic recovery, but must not become a second automatic authority. Preserve corrupt bytes, never overwrite them on failed startup, and reconcile any manually selected backup against later exchange executions before resuming. Test malformed JSON, permissions/read failure, invalid positions/pending/maker fields, valid legacy state and pending-close restart. Verify no order submission or state rewrite on load failure. Missing live state requires explicit initialization/recovery procedure, not silent approval.

### 3. Add bounded performance/error telemetry before memory optimization

Publish optional RSS, heap-used/total, external/buffer memory, cycle work duration (excluding intentional poll sleep), guard owner/age and event-loop delay/max over an explicit reset window. Instrument the expensive feature calls and candle refreshes. Best-effort atomic health writes remain non-blocking for trading; metrics never control orders or PM2. Existing consumers must tolerate absent new fields. Use sustained warnings after baseline measurement, not one instantaneous RSS threshold.

Keep fatal-error work separate: use sanitized synchronous fatal breadcrumbs and preserve process termination. Prefer `uncaughtExceptionMonitor` where appropriate rather than installing listeners that accidentally suppress Node's fatal behavior; do not await Discord delivery or save possibly inconsistent trading state during a fatal exception. Correct the collector's startup catch to terminate nonzero after failed initialization. Child-process tests must prove rejection/exception exit, failed logger behavior and partial startup failure. [Node's fatal-error guidance](https://nodejs.org/docs/latest-v24.x/api/process.html#event-uncaughtexceptionmonitor).

This tranche may be prepared alongside the first fixes, but measurement work must not delay a reviewed exit-availability repair.

### 4. Harden recovery protection and commander authorization independently

**Recovery:** route through an executor-owned, explicitly long-side, normalized and verified protection path. Decide whether to use the existing verified position-TP helper instead of creating a separate GTC order; do not merely substitute one call while leaving `recoveryTpOrderId` cleanup inconsistent. If an independent limit remains, it needs durable identity before submit and exact resolution of timeout/crash/cancel cases. An existing recovery limit must be identified before replacement; never cancel unrelated orders. Remain in recovery until evidence agrees. Bybit requires `positionIdx` in hedge mode. [Place-order requirements](https://bybit-exchange.github.io/docs/v5/order/create-order).

Refresh lot and tick metadata coherently for new submissions, with bounded retries. Persisted intents retain their original submitted quantity/tick evidence for replay; a metadata refresh must not rewrite an old order or widen reconciliation tolerance. Test non-cent ticks, invalid quantity, metadata change, exchange-flat/native races, submit timeout and restart. A one-hour TTL is a proposed operational setting, not a proven optimal constant.

**Commander:** explicit immutable user-ID allowlist; unauthorized users cannot write any mutation signal, including override/resume/regime-arm. Missing/malformed allowlist must disable mutations, not permit everyone. Read-only status/help may remain available. Denied attempts need bounded logging. Review confirmation requirements with the operator before delaying urgent closes; IDs and allowed behavior are needed before this stage deploys. Restart only `commander` for its change.

### 5. Reader efficiency and refresh scheduling — preserve input semantics

First establish golden feature vectors and gate decisions from the existing readers across cold/warm cache states, boundary times and missing streams. Then reduce retained fields/share ingestion, before broader shadow refactoring. Keep each consumer's window, timestamp normalization, duplicate ordering, missingness and availability behavior explicit.

Do not apply “keep four hours plus margin” universally: `computeOnChainFeatures` requests **eight hours** for OI/asset streams (`shadow-logger.ts:166,168-170`) to locate historical anchors. Low-cadence funding needs last-before evidence plus a freshness rule. The two readers also have different byte limits and independent 30-second cache clocks. New windows or immediate incremental freshness can change live gates and cannot be passed off as memory-only cleanup.

An incremental reader needs bounded bootstrapping, byte/row as well as time limits, partial UTF-8/JSON line handling, append/truncate/rotation/replacement detection, single-flight loads, stable snapshots for concurrent callers and correct out-of-order arrivals. On incomplete evidence, return explicit unavailability rather than a silent partial window. Keep stream ingestion time separate from source event time. Compare consumer outputs before and after; any difference requires an explained policy/coverage decision, not a changed golden baseline.

Likewise, 5m boundary scheduling needs a consumer audit: `index.ts:2842-2847` currently reads the newest 5m close for add throttle, which can be forming. Simply dropping intrabar refresh changes that input. First isolate failures; only reduce cadence after proving closed-bar consumers still get corrected final OHLC and intentionally preserving/reviewing forming-price consumers. Retry a delayed boundary with bounded backoff, retain the 14d coverage gate and bounded startup hydration. No strategy-threshold changes.

### 6. Collector continuity, then archive-aware rotation

Repair real REST-recoverable closed candles after disconnect/startup and by bounded periodic gap detection, since a missed minute need not coincide with reconnect. Record source timestamp, receipt/repair timestamp, venue and provenance. Deduplicate append/restart races without firing historical signals retroactively. No synthetic candles and no fabricated HL book/taker history. Research must distinguish repaired history from what the live decision actually knew; a source tag alone cannot enforce that.

Coordinate rotation with all tailers, watchdog freshness checks, sync tooling, active shadow cursors and research loaders. Preserve raw data in validated archives; a current health JSON can complement historical health logs, not silently replace research provenance. Two-day readers are insufficient for longer outages or multi-day lookbacks. Retention/deletion requires a separate explicit decision; current disk headroom allows a careful migration.

## Deployment and review gates

- First approval requested: the plan and first exit-availability/state-safety tranche, not a global cleanup or strategy change.
- Run both typechecks, focused new loop/state tests, existing long/maker/partial/finalizer/guard suites, S/R/context/Aggressive10 tests and runtime/watchdog tests before a main-owner patch ships.
- Review each diff separately. No whole-worktree commit, wholesale research staging, automatic VPS actions, `pm2 restart all`, short re-arming, or collector removal.
- Follow the transaction preflight: snapshot current state; fresh runtime; local/exchange quantities agree; pending/recovery clear; known maker/native protection; no maker touch/cancel/partial/close request unresolved. Recheck immediately before restarting **only the changed owner**.
- **Runbook caveat until the pause fix lands:** `touch bot-pause` preserves TP processing but currently skips the main-loop downside exits. Do not leave an open ladder paused through a lengthy unattended build while assuming all risk checks continue. Build first while ordinary risk management runs, then use a brief monitored preflight/restart window with verified exchange protection and operator direction. Do not resume an already-existing operator pause automatically.
- After deployment, verify retained inventory/profile/receipts, maker ownership, reconciliation and watchdog; compare memory/timing on the same PID over time. Do not restore old state after newer fills or downgrade a binary below the persisted transaction/profile schema.

The first implementation review should settle two boundaries explicitly: adds-only pause semantics, and what an unavailable trend input may authorize. The proposal above preserves independent risk exits and refuses new exposure on unknown required data; it does not add a speculative flatten rule.
