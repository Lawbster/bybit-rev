# Builder handoff: HYPE main + three setup slots + MACD shorts, $19,000 equity

Date: 2026-10-10. Candidate: `HS01-P2-THREE-SLOT-MACD-R3`, with the separately recorded operator-requested $19,000 equity scenario.

## Decision and assignment

### October 11 executable-build update

Supersedes the earlier pending-adapter/no-short-result implementation notes.
Operator's short probe completed (`metadata_and_cleanup_passed`, flat, two
children); do not repeat either probe. Real account/evidence/write adapters and
the one-owner daemon are implemented, with main/setup orchestration, funding,
health alerts and legacy startup fencing. Repository config remains disabled,
observe-only, entries false. Current procedure and remaining release boundary:
`docs/operations/portfolio-live.md`. No live arming or deployment has occurred.
The old owner API and production-size/native-trigger behavior are not certified
by the tiny probe. Full coupled economic acceptance remains distinct from the
passing source/ledger/component comparisons. Next external step is read-only
VPS observation of the actual assembled process, not further test trades.

### Operator confirmation — October 10, after the foundation checkpoint

- Consolidated target: existing ladder account **hypehedgeguy**, UID **555249668**.
  Use its existing unsuffixed credentials; do not repoint the separate LAWBSTER
  owner to this account or relax its isolation checks.
- Operator reports transfers completed and **$19,047.16** currently in that
  account. This is an operator-reported current balance, not a fresh API snapshot
  or a new historical replay seed. Preserve the $19,000 research scenario and
  frozen dollar sizing; use observed account equity for eventual live admissions.
- Operator subsequently confirms **both owners paused, both accounts flat, no
  pending orders** after `touch bot-pause` and `touch lawbster-sfp-pause`.
  This is operator confirmation, not a fresh API/health snapshot and not proof
  either process is stopped. Keep the pauses. A fresh exchange/owner preflight is
  still required at cutover. Do not reset the damaged-regime latch to arm.
- Account selection is approved and implementation may continue locally. The new
  portfolio is **not deployed or ready to arm**. No additional transfer or secrets
  are needed to continue building. Recheck both legacy owners' inventory and
  entry-pause state before giving cutover commands; retain exits while non-flat.

The original planning brief below is retained as research provenance; the later
implementation authorization and account confirmation above supersede its scope
and migration-status statements, not its frozen strategy or validation requirements.

**October 11 operator-pasted read-only API evidence:** UID `555249668`, margin
mode `REGULAR_MARGIN`, equity and available balance both `19047.43317261`, HYPE
hedge sides 1/2 both size zero, leverage 25, TP/SL empty. The pasted query returned
no observation timestamp and did not query orders, other symbols, fee rates or risk
tiers. This supersedes the balance estimate only, not the $19k research seed or
deployment status. It is not liquidation, process-retirement or bracket evidence.

Prepare an implementation and configuration plan for the exact researched portfolio below. The operator is willing to park the separate SFP allocation and use **$19,000 total equity**. This handoff authorizes planning; it does not change account state, stop an owner, transfer capital, or arm trading.

- The portfolio adds **$21,482.49 after fees and funding** over the complete main strategy in the standard historical replay. All ten scored monthly periods improve, including partial October; the smallest improvement is March, **+$91.82**.
- With actual extra **5bps adverse market execution per side**, the improvement remains **$18,596.49**. March **-$217.78** and August **-$72.20** are worse than main, both within the unchanged **-$250 monthly delta floor**. Do not describe every stressed month as better.
- At the requested $19,000 seed, all eight standard/cost/delay/precision and TP-model comparisons pass their raw/funded relative net, drawdown, monthly, and capital checks. **95,636 admission predicates pass.** The sample contains **401 changed closed trades plus one open setup** in the native portfolio. Exposure-matched monthly diagnostics still fail, historical selection is adaptive, and this is not a fully qualified live strategy.

Read the [monthly findings](codex-astra-hype-2026-three-slot-macd-19k-findings-2026-10-10.md) for the complete monthly table and [original research findings](codex-astra-hype-2026-search-hs01-findings-2026-10-10.md) for lineage, controls and failures. These remain the evidence records; this document translates them into a builder assignment.

## Exact portfolio to plan

All positions trade the researched HYPE market. Sizing is fixed dollar **notional**, without compounding. Leverage below is the research margin assumption, not an instruction to multiply notional again.

| Component | Logical ownership | Tested sizing and margin assumption | Behavior |
|---|---|---|---|
| Complete current main ladder | `main` | $800 first rung, 1.35 size multiplier, maximum 11 surviving rungs; 25x modeled main margin | Retain the complete pinned parent: entry gates, Aggressive10 behavior, partials/rebuilds, maker/TP semantics, cooldowns and forced exits. |
| Shared setup book | `setup0`, `setup1`, `setup2` | Three slots, each **$20,000 / 3 = $6,666.6666667 requested notional**; 3x modeled margin | Five original sources compete for any free slot; each source can occupy at most one slot. |
| Independent MACD R3 short | `R3` | **$10,000 requested notional**, one position; 3x modeled margin | Runs alongside main and the setup book; does not consume or preempt a setup slot. |
| Shared account capital | One cash/equity pool | **$19,000 initial equity** | Shared funding, collateral, pending-request reservations and entry/fill affordability. No separately replenished virtual accounts. |

The three slots have a **$20,000 planned gross entry budget**; MACD adds $10,000, for **$30,000 of auxiliary planned entry notional plus main**. This is not a $19,000 gross-exposure cap or a $30,000 marked-exposure cap. Position values move with price. Up to three setup positions, one MACD short and the main ladder can coexist, including concurrent longs and shorts.

Parking the **separate live SFP account/owner** does not remove **SF08 from the five-source setup book**. The tested book still includes that signal at the slot size above. Separate-SFP foregone PnL is absent from both candidate and comparator: the profit improvement is against **main alone**, not the currently funded main-plus-separate-SFP combination.

### Setup signals and management

Use the pinned source implementations and action receipts, not a new interpretation of the names. Source-control cards often say $10,000 because that was their standalone test unit; the accepted combined setup book scales those sources to $20,000/3 per slot.

| Source | Direction and exact signal | Retained management and timing | Source authority |
|---|---|---|---|
| SF08 | Long; original SF01-v1 confirmed 4h range-low sweep/reclaim | Original padded structural stop, signal-derived 2R target and 24h signal deadline; modeled 60s publication; native 0.01 quantity/tick normalization; stop-first ambiguous bar | [SF source manifest](../backtests/hype-2026-search-hs01/batch8-information-d6e17eaccab19293/manifest.json), using its detector/actions only |
| L2 | Long; completed 15m ADX(28) crosses from <=25 to >25, +DI > -DI | No price stop/target; source close +60s entry; exit at entry +12h +60s | [L2 source manifest](../backtests/hype-2026-search-hs01/phase2-adx-long-0bcb4c8d267acc29/manifest.json) |
| R5 | Short; completed 30m ADX(14) crosses from <=40 to >40, -DI > +DI | No price stop/target; source close +60s entry; exit at entry +12h +60s | [R5 source manifest](../backtests/hype-2026-search-hs01/phase2-adx-0a7158d51f79d01f/manifest.json) |
| PA07 | Short; `break_control__short__reference_2r`, original closed 1h trigger and causally published 4h pivots | Original structural stop, signal-close reference 2R target and 24h expiry; 60s source lag, no further native action delay; stop-first ambiguous bar | [PA07 source manifest](../backtests/hype-2026-search-hs01/phase2-pa07-daee8d36691060f9/manifest.json) |
| CRSI | Long; completed 15m unrounded CRSI crosses from <=5 to >5, exact `crsi_15m_95_back_out_long` | Original RSI3/RSI2-streak/prior-100-return-rank construction; no price stop/target; source close +60s entry; exit at entry +12h +60s | [CRSI source card](../research-inputs/hype-2026-search-hs01-phase2-crsi-2026-10-10.json) |

The SF manifest also contains an older flat-only/main-priority experiment. **Do not import that older ownership rule.** Likewise, older four-source and single-side merged controls have different tie rules. The final allocator below overrides those earlier portfolio wrappers while preserving their source signals/exits.

### Three-slot allocator

Authority: [three-slot card](../research-inputs/hype-2026-search-phase2-fungible-crsi-three-slots-2026-10-10.json), [source runner](../scripts/hype-2026-search-phase2-fungible-crsi-three-slots.ts), and [`fungibleBroker` / `observableRelease`](../scripts/hype-2026-search-phase2-fungible-core.ts).

1. Consume the five **unmerged raw action streams**, ordered by eligible publication time and stable lexical action ID for equal timestamps. Assign the lowest free slot. Simultaneous opposite-side actions may occupy different slots; do not import `mergeSignals` cross-side cancellation from an older single-slot control.
2. Allow at most one occupied/reserved slot per source. If that source is occupied or all three slots are occupied, the new signal expires. No queue, missed-signal catch-up, rank-based preference, preemption, reversal or calendar switching.
3. Evaluate the whole same-clock group using the last completed minute and the known owner state. Reserve each approved request before observing the current open. A request later rejected at fill does not retrospectively free its same-clock reservation for another decision.
4. Release SF08 after observing its exit minute, including timeout: `exitAt + 60s`. PA07 stop/target exits also release at `exitAt + 60s`; its known scheduled timeout permits same-open reuse. L2/R5/CRSI scheduled timeout can precede a new fill at that same open. Actual close receipts must be processed before the new fill.
5. Retain original bracket validity and stop/target management. Native exact controls preserve fractional quantities except the inherited SF08 normalization. The separate precision sensitivity establishes a comparison, not permission to silently rewrite primary results.

### MACD R3 owner

Authority: [MACD R3 card](../research-inputs/hype-2026-search-hs01-phase2-macd-r3-2026-10-10.json), [source adapter](../scripts/hype-2026-search-phase2-macd-r3.ts), [MACD engine](../scripts/macd-standalone-engine.ts), and [shared indicator calculation](../src/research/macd-features.ts).

- Completed **4h MACD(12,26,9)**, exact SMA-seeded EMA implementation; historical warmup begins June 1, 2025. Enter short when previous histogram >=0 and current histogram <0. There is no magnitude, trend, month or regime filter.
- Publish the decision at the 4h bar close; native market entry occurs **60s later**. One independent fixed $10,000 position; occupied signals expire.
- Exit on the first subsequent completed 4h histogram >=0, or when **12h from actual entry** has elapsed, whichever decision occurs first. Timeout wins ties. Execute the exit **60s after its decision**. Native timeout holding duration is consequently **12h 1m**, not exactly 12h.
- No price stop/target or ladder averaging was tested for this owner. Adding either changes the strategy and needs separate evidence.

## Shared capital and execution contract

Authority: [combined frozen card](../research-inputs/hype-2026-search-hs01-phase2-three-slot-macd-r3-2026-10-10.json), [combined runner](../scripts/hype-2026-search-phase2-three-slot-macd-r3.ts), [reserve helpers](../scripts/hype-2026-search-phase2-fungible-portfolio-core.ts), and [joint cash ledger](../scripts/hype-2026-search-joint-cash.ts).

- Preserve all current and pending requests, including delayed MACD entry requests and setup decisions later rejected at fill. Decision equity uses only the prior completed price; retain outgoing collateral conservatively until the applicable execution phase. Recheck with actual fills, quantities, fees and equity at the fill phase.
- Reuse exact `decisionReserves` and `fillReserves`, including main surviving-lot cost/25, auxiliary position cost/3, 0.2% requested-notional reserves for every non-main request (including MACD), structural stop-distance plus 5% buffers where applicable, and fee allowances. At fill, use actual filled notional as the helper specifies. Do not replace the shared test with a per-process balance check or a single gross/3 formula.
- Fees are **0.00055 = 0.055% per side** in these results. Retain all 848 signed eight-hour funding settlements and their established candle-open mark proxy. Consume prior-minute observed resting/intrabar closes first, then settle funding on remaining inventory, then process current-open fills. Current-open entries are excluded from that settlement; current-open exits are included. A prior-minute close observable at the same boundary is already removed and is excluded. Do not copy older source-card prose calling these hourly settlements.
- The native, actual 5bps market-execution, extra-arrival-delay and precision modes are separate diagnostics. They are not a jointly compounded worst-case scenario. Resting-limit execution retains its original contract in the cost replay.
- The researched fixed-path combination is justified because every joint admission passes. If the proposed implementation changes a refusal, occupancy, ordering or exit, it needs a coupled causal replay; summing archived independent profits is insufficient.

## Evidence the plan must preserve

Scored window: **January 1, 2026 00:00 UTC through October 10, 2026 12:51 UTC**; fresh-flat start, fixed quantities, 406,851 scored minutes. All dollars below include fees and funding, and month-end/cutoff open inventory is marked. TP assumptions are alternative full-main execution models, not two strategies to run together.

| Execution / TP model | Main net | Candidate net | Improvement | Main max DD | Candidate max DD | Worst monthly improvement |
|---|---:|---:|---:|---:|---:|---:|
| Standard / touch | $58,031.80 | $79,514.29 | $21,482.49 | 35.11% | 34.65% | +$91.82 |
| Standard / confirmed | $65,458.36 | $86,940.85 | $21,482.49 | 53.88% | 42.63% | +$91.82 |
| Extra 5bps / touch | $22,859.81 | $41,456.30 | $18,596.49 | 67.27% | 54.31% | -$217.78 |
| Extra 5bps / confirmed | $11,718.35 | $30,314.83 | $18,596.49 | 74.67% | 56.54% | -$217.78 |

At $19k the delay case retains +$21,150.71 funded improvement and the precision case +$21,470.67; both TP comparisons improve DD and satisfy every monthly delta floor. The tightest decision headroom across these eight paths is **$4,652.19**, in the cost-stressed confirmed model. This is modeled admission headroom, not a certified liquidation buffer.

The $19k scenario adds $4,390.38 to the sealed $14,609.62 fixed-position equity/admission curves and recomputes running-peak drawdown. Dollar PnL is unchanged. The original summaries reproduce, and the same translation to $32k matches separately archived $32k summaries within 0.000001. The original $14,609.62 touch-DD failure remains a failure; $19k is an explicit operator input, not a capital threshold optimized by the researcher.

Remaining limits are material to the plan:

- Standard absolute profits depend strongly on execution. Even at $19k, cost-stressed candidate DD is **54.31% / 56.54%**. Neither monthly profit nor positive future returns are guaranteed.
- Post-hoc equal peak/average exposure controls retain $6,341.86-$8,068.77 extra raw net but fail monthly comparisons. These were tested at the original $32k/$14,609.62 seeds, not freshly at $19k; do not claim equal-exposure all-month superiority or turn their hindsight scaling into live sizing.
- Removing the three strongest overlapping changed-trade groups still leaves +$16,670.05 raw / +$16,671.95 funded improvement. This is contribution removal, not a replay with those signals disabled.
- Selection reused this historical period and prior mined source searches. There is no untouched out-of-sample result, actual historical order-book fill certificate, or exchange liquidation simulation. Source timing is modeled and funding marks are proxies.
- Preserve the repo's **30-60 day forward observation** step before any live deployment proposal. Planning can proceed now; historical review does not substitute for that observation.

### Pinned evidence locations

All paths below are under `backtests/hype-2026-search-hs01/`. Each accepted run has a completion seal; use its manifest, source snapshots and output hashes. `backtests/` is git-ignored, so a builder working elsewhere needs these artifacts or a verified archive, not just this Markdown file.

| Evidence | Exact location |
|---|---|
| Accepted native combined candidate | `phase2-three-slot-macd-r3-20353c1cfb96d6d5/` |
| Accepted three-slot book | `phase2-fungible-crsi-three-slots-9cef77d4cc002770/` |
| Accepted MACD source | `phase2-macd-r3-f3e7bde7e61f82e4/` |
| Actual 5bps combined execution | `phase2-three-slot-macd-validation-market5-421e2581edff5cc5/` |
| Additional arrival delay | `phase2-three-slot-macd-validation-arrival60-9d4cb63ff55e815d/` |
| Precision sensitivity | `phase2-three-slot-macd-validation-precision-2cc7e1054216d5bd/` |
| Exposure/concentration diagnostics | `phase2-three-slot-macd-r3-fixed-path-diagnostics-9caef20d59427fc7/` |
| Consolidated independent validation | `phase2-three-slot-macd-validation-review-cdda36ad1a123d43/` |
| $19k derived results and input hashes | `phase2-three-slot-macd-19k/results.json` |
| $19k independent Astra review | `phase2-three-slot-macd-19k-astra-review/verification.json` |
| Original full-main baseline | `batch1-8ba35b11707731ad/`; complete main source/config pins are in its manifest |

The [scenario card](../research-inputs/hype-2026-search-three-slot-macd-19k-2026-10-10.json) and [equity-translation script](../scripts/hype-2026-search-three-slot-macd-19k.cjs) reproduce the new account scenario without rerunning signals. Reuse saved controls; do not start another search to prepare the configuration plan.

## Builder deliverable

### Implementation checkpoint on October 10

The operator subsequently authorized starting implementation. The first foundation
checkpoint is built locally; this is **not a deployable portfolio owner** and no
existing process, account, strategy config or exchange order was changed.

- `src/bot/portfolio/contract.ts`: frozen source sizes/sides and receipt-based slot
  release rules. Internal 25x/3x collateral budgets are not exchange leverage settings.
- `allocation.ts`: deterministic three-slot assignment, source exclusivity,
  independent R3 reservation and whole-group decision ordering before fills.
- `capital.ts`: validated equivalents of the sealed decision/fill reserve formulas.
- `ledger.ts`: durable reservations/intents, execution-ID deduplication, partial-fill
  accounting, explicit per-lot reductions, per-owner cost basis, aggregate long/short
  reconciliation and checksum/account-validated restart state. Unresolved submissions
  cannot be freed locally. Failed persistence prevents subsequent writes. Strategy
  code must use these within the future exclusive account owner, not open another
  writer against the same store. Exchange/process ownership locking is still pending.

Tests: `npm run test:portfolio-foundation` passes 22 cases, including two real
child-process exits at durable-intent/receipt boundaries. `npm run
verify:portfolio-foundation` matches all 420 saved setup allocation decisions,
61 saved MACD signals, 803 execution receipts, 401 closed trades and one open lot.
Closed auxiliary PnL before funding and execution fees reproduce. All 48,156
native archived reserve-formula comparisons pass across two TP models/two seeds.
Report: `backtests/portfolio-live-foundation/f21fd744207bbc64/verification.json`.

These are **component checks against sealed input signals/receipts**, not a fresh
economic replay or verification of live signal production. The reserve checker
reconstructs the retained-margin scalar from archived totals; it checks the new
formula port and nonlinear reserve, not independent exchange margin/liquidation.
Existing research helpers and accepted artifacts were not edited.

The entry-intent layer refuses unsent entries after their scheduled minute; it
does not queue catch-up trades. Live arrival/precision effects still need the
separate sensitivity comparison specified above. Inputs with late actual receipts
must not be represented as timely historical bar-end observations.

### Timed-indicator source checkpoint on October 10

`src/bot/portfolio/timed-indicator-signals.ts` now binds the exact L2, R5 and CRSI
formulas to the existing closed-bar timing helper. It uses the fixed June 1, 2025
seed, preserves every recursive dependency's receipt clock, rejects gaps/reseeding,
and only emits during the original scheduled entry minute. Inputs arriving after
that decision cannot trigger catch-up entries. The actual-fill timeout helper
preserves 12h plus the archived one-minute exit delay. These policies have no
exchange clients, network calls, orders or live process wiring.

- 14 new tests pass: thresholds/directions, warmup, formula identity, allocation
  compatibility, stale/late inputs, dependency receipts, gaps, prefix/restart/future
  poisoning, immutable features and actual-fill timeout seconds.
- Saved-source parity is exact for **225 raw signals**: L2 58, R5 46, CRSI 121.
  IDs, sides, entry clocks, planned deadlines and indicator values match both the
  source controls and final three-slot input. Nine real-data prefix probes pass.
- Evidence: `backtests/portfolio-indicator-parity/a6ef2918f8e52d99/verification.json`
  and adjacent `decisions.json`. Uses the sealed existing tape; no new economic
  replay, candle download or overwrite of research evidence.
- Foundation's 22 tests still pass; both project typechecks pass. This is source
  parity only, **not complete live/portfolio parity**. Live feed hydration and
  scheduling, MACD receipt/decision timing, SF08/PA07 binding, shared execution,
  protection and operational checks remain. Do not route the old standalone
  owners to the shared account or arm anything from this checkpoint.

### All-source policy checkpoint on October 10

The six source policies are now bound locally, still without a live feed loader,
account writer or new runtime process:

- `src/bot/portfolio/macd-signals.ts` reuses the exact SMA-seeded MACD helper.
  Entry sign, original +60s fill boundary, first subsequent neutral/positive
  histogram exit, actual-fill 12h timeout and timeout tie priority are preserved.
  Overdue exits remain due; a missing indicator feed does not disable timeout.
- `src/bot/portfolio/structural-signals.ts` reuses SF01/SF08 unchanged and the
  extracted PA07 detector/action eligibility. Raw structural brackets/deadlines
  remain frozen; exchange tick/lot normalization still belongs to execution.
- PA07's pure detector and economic-action eligibility moved into
  `src/strategies/price-action-signals.ts`. The original research files re-export
  these functions. **The replay engine is unchanged.** The extracted no-receipt
  API reproduces the entire sealed original event object exactly, including all
  four families (159/20/680/109 actions), not just the selected short.
  Optional receipt clocks include every pivot neighbour; the portfolio wrapper
  rejects late/missing context instead of inventing timely publication.
- Source parity: **481 raw signals** match the final researched inputs: SF08 70,
  L2 58, R5 46, PA07 125, CRSI 121 and MACD 61. All **797 MACD exit publications**
  and **61 archived trade exit times/reasons** match. Eighteen real-prefix checks
  and four real structural late-receipt probes pass.
- Evidence: `backtests/portfolio-indicator-parity/e62ef1c6a4ddf6e1/verification.json`
  and adjacent decisions; all earlier source-checkpoint artifacts remain.
- **48 portfolio tests** pass (22 foundation, 14 timed-source, 12 remaining-source),
  plus the existing PA07 tests, research-driver import/typecheck and both project
  typechecks. Refreshed foundation parity still matches all 420 slot decisions,
  61 MACD signals, 803 receipts and 48,156 reserve-formula comparisons:
  `backtests/portfolio-live-foundation/f4ced469a1e1b6d4/verification.json`.

**Explicit arrival difference, not hidden parity:** historical MACD can reserve at
the exact 4h close; a real final receipt normally arrives milliseconds later.
The source records the actual observation/decision time, retains the original
close+60s entry boundary and drops an entry if that decision minute is missed.
The allocator now accepts that sub-minute R3 decision only inside its original
pre-entry minute. No bar or receipt is backdated. Its interactions with actual
main/slot executions still require integration replay and shadow measurement.
Native historical source and allocator parity do not establish those live results.

No account preflight, exchange calls, orders, PM2 changes, commits or live enable
changes occurred. The existing main and separate SF08 implementations are unchanged.
Old PA07 source signatures necessarily change on extraction; accepted research
artifacts are retained and exact reproduced records, not edited pins, prove parity.

### Durable scheduling checkpoint on October 10

`src/bot/portfolio/lifecycle.ts` now seals the entire scheduled source group inside
the existing atomic portfolio ledger. Missing/late slot-source input, paused or
occupied signals cannot be retried later in the same minute or replayed after a
restart. R3 may await its final receipt only in its original pre-entry minute.
The decision mark must cover the prior completed minute and cannot use a later
equity/price observation. The live mark/feed adapter is still outstanding.

Owned exit deadlines are stored from the first execution receipt. Timed sources
use actual first-fill time; structural sources keep their original signal expiry.
Out-of-order earlier fills can shorten, never lengthen, a deadline. An overdue
exit remains due across restart; bad/missing MACD input cannot cancel its timeout.
Unsubmitted entry reservations expire, but ambiguous submitted orders retain
their ownership and capital until exact terminal evidence. Due exits are only
candidates: the future coordinator must still quiesce scoped protection and
resolve outstanding orders before submitting anything.

- **66 portfolio tests pass**: 22 foundation, 14 timed-source, 12 remaining-source,
  18 lifecycle. Foundation includes two actual child-process crashes; lifecycle
  adds persistence/restart, paused signals, partial/out-of-order fills, late
  structural execution and independent-timeout checks.
- The updated component audit routes all 481 signals through the scheduler and
  still matches 420 slot decisions, 61 MACD signals, 803 receipts, 401 closed/one
  open lot and 48,156 reserve-formula comparisons. **All 306 archived timed or
  indicator exit deadlines/reasons match exactly.** Fees and before-funding
  accounting are unchanged. Evidence:
  `backtests/portfolio-live-foundation/41887c600ee0201e/verification.json`.
- This consumes sealed historical signals/receipts. It is not a full live-feed,
  exchange-protection, funding or common-leverage certification. No orders,
  deployment, configuration changes or economic strategy search occurred.

### Cached feed checkpoint on October 10

The read-only feed now has a hash-pinned, streamed bootstrap loader, compact
append-only minute storage, incremental complete-bucket aggregation, bounded
collector/repair tail reads and cached source-policy evaluation. The persistent
worker isolates heavy source computation from the future trading owner's event
loop. No worker or trading service has been started on the VPS.

- Bootstrap is **historical warmup only**, explicitly labelled separately from
  observed tail receipts. It cannot issue pre-bootstrap/catch-up entries.
  New data uses the later of collector and consumer receipt. Gaps remain gaps;
  a later repair does not rewrite availability. Conflicting final prices fault
  the cache. No REST backfill, account request or file mutation is hidden in the
  runtime reader.
- Retains at most 2,000,000 minutes in compact numeric chunks and 2,880 pending
  gap rows; capacity failure blocks inputs rather than silently rolling the seed.
  Existing PA07/SF08 logic is reused for hourly structural builds in the worker.
  It still temporarily materializes the structural prefix, but not every poll.
  Worker old-generation heap is limited to 768 MiB; this is not total process RSS.
- The offline feed check matches **970,556 bootstrap minutes, 86,395 closed
  aggregate candles and 122,146 indicator feature rows**. All five slot sources
  were polled together, and a repeated poll performed zero history rebuilds.
  Local measurements: ~0.95s initial source refresh, ~0.18ms cached poll, ~1.44s
  streamed bootstrap load/verification. Minute storage alone uses 62,390,272 bytes;
  feature caches and temporary structural objects are additional memory.
- Evidence: `backtests/portfolio-feed-parity/5707bbdc9dbab71d/verification.json`.
  Reusable seed (24,505,646 compressed bytes; never commit this as bot config):
  `backtests/portfolio-feed-bootstrap/88cd5182ee20dd09/hype-warmup.jsonl.gz`.
  SHA256 `b57af6877889cb63e148ff6f92e78f6cfd06a475e6bc1825b215d0c2f5f8fdd8`.
  Its adjacent manifest pins canonical input and cutoff; later code checks reuse
  this seed rather than generating a new copy per study.
- **80 portfolio tests pass**, including 14 new feed/parser/worker cases. Both
  typechecks, full compilation, the actual npm test command and a compiled-worker
  smoke check pass. Refreshed source parity remains 481 signals:
  `backtests/portfolio-indicator-parity/e24356ac27f05171/verification.json`.
  Allocation, 306 scheduled exits, receipts and accounting remain unchanged:
  `backtests/portfolio-live-foundation/04b38605d33353f9/verification.json`.

**Live decision clock refinement:** the final minute used for the shared capital
mark normally arrives after the nominal boundary. The five slot sources now seal
their whole group at the actual consumer decision time within the original entry
minute. Their signal dependencies must still be available by the original
boundary; the entry deadline is not extended, and an order cannot precede the
recorded decision. R3 retains its original pre-entry minute. Actual receipt
timestamps remain in durable reservations. Historical zero-delay parity is still
exact, but non-zero scheduling/mark/fill delay needs full account-integration
measurement; do not call it economically identical merely from this check.

Worker transport readiness is not entry permission. The future coordinator must
check source/loader health, a current closed-minute price mark, independently
timestamped account equity, ownership and admission. Existing exit scheduling
does not depend on this worker being healthy. No live config, API credentials,
account state, PM2 service, commit or deployment was changed.

### Simulated account-execution checkpoint on October 10

`src/bot/portfolio/execution-coordinator.ts` now coordinates durable orders against
an explicit **simulation-only** port. No Bybit implementation, credentials,
account calls, background service or deployment has been added.

- Acquires both UID/symbol side locks **before** loading state. Side 1 shares
  the existing SF08 lock name. Stale locks are never automatically stolen; replaced
  lock files are not deleted by the old holder. This is a cooperative, single-host
  lock, not a fence against the unchanged main/HL owners or another host. Those
  services still need verified retirement at cutover.
- A normalized, side-specific market command is durable before submission. Opens
  round quantity down; closes must match their explicit owned-lot allocation.
  No leverage setter or full-position protection field is accepted. In-flight
  account calls are serialized without a sleep or a delayed entry queue.
- Missing acknowledgements, not-found orders and incomplete execution histories
  preserve the pending command and its reserved capital. There is **no blind
  resubmission**, including after a crash before the first send. That intentionally
  ambiguous case requires additional proof/operator recovery, not guessed rejection.
  Cancellation acknowledgement alone changes neither inventory nor occupancy.
- Receipts are applied once, with strategy-owned cost/fee attribution, only after
  matching account, link, order ID, side, position index and cumulative quantity.
  Aggregate mismatch remains latched. A valid owned close can still execute while
  entry-paused or in recovery, but never while inventory/order evidence is unresolved.
- The current coordinator opens **timed sources only**. Main/SF08/PA07 entries
  explicitly fail closed until the main bridge and quantity-owned protective orders
  exist. It currently permits no resting orders before a new command; future
  protection integration must cancel, settle and reallocate them without races.
- Fresh identity/mode/leverage, quote, equity and reserve checks are simulated.
  Actual fills use actual prices and fees; a breached filled-capital limit latches
  recovery instead of editing the fill. No automatic unwind policy or real Bybit
  maintenance-margin/liquidation certification is implied. The test fixture's
  3x exchange leverage is **not** a chosen production leverage setting.

Verification: **23 new cases pass**, including two actual child-process exits
before submission and after a simulated venue fill, disk failure before/after
acknowledgement, partial/cancel races, missing receipts, ownership corruption,
cross-owner closes, concurrent calls, pause/window races and stale account inputs.
The five earlier suites also pass: **103 portfolio cases total**. Both source/VPS
typechecks pass. Evidence:
`backtests/portfolio-execution-verification/43845d98b65d15fb/verification.json`.

The sealed component audit still matches 420 setup decisions, 61 MACD signals,
803 execution receipts, 401 closed/one open lot, 48,156 reserve checks and all 306
scheduled exits, with identical fees/accounting. Updated dependency fingerprint:
`backtests/portfolio-live-foundation/91f9c01300f773b3/verification.json`.
This is not a replay through the new simulated transport or complete economic
execution parity. There was no new strategy search or live change.

### Owned protection/main-inventory boundary on October 11

Built and checked locally; **no production owner, setting or order changed**.
The execution port is still explicitly simulation-only.

- `main-bridge.ts` supplies the existing ladder with only its owned rungs. Main
  age uses open-intent creation, matching `StateManager`'s `pending.createdAt`;
  auxiliary timeouts still use actual first fill. Non-inventory legacy fields are
  preserved, not reset. Approved add requests must retain $800 x 1.35, surviving
  rung count, maximum 11, current inventory identity and shared capital admission.
  `gatesApproved` must come from the existing complete gate stack; the bridge
  neither evaluates it nor selects same-clock main/setup priority.
- Main selected closes and full/maker partial receipts reuse
  `partial-close-transaction.ts`. Pro-rata maker fills no longer reduce rungs
  sequentially. Only the aggregate exchange order is rounded to the lot grid;
  virtual rung slices may be fractional. Selected partials can retain sub-step
  virtual residue, as the existing allocation does. Auxiliary quantities/costs
  do not enter the main average, TP, rung count, age or close allocation.
- The coordinator now supports **one** owned resting protection per owner:
  post-only maker TP, conditional market TP, or conditional market SL. It checks
  the exact price, type, trigger direction, side, quantity and identity from
  fresh order evidence. Other owners may trade alongside confirmed resting orders.
  Crossed prices require an explicit exit, not an automatic target reprice.
- `owned-exit.ts` persists a close request before cancellation. Maker touch grace
  cannot be extended by repeated calls/restart. A full passive fill completes
  immediately, even during grace. After grace, cancellation acknowledgement is
  insufficient: exact terminal receipts must settle before any residual market
  command is saved/submitted. Terminal partial market closes can retry only their
  proven residual. Unknown orders cannot. Entry pause does not stop these exits.
- If a protection fills between order lookup and position lookup, mutations wait
  for receipts rather than fabricating a fill or immediately latching a false
  inventory mismatch. Unchanged protective observations still require fresh
  evidence but do **not** rewrite the entire ledger on every poll.

**Paired-bracket limitation:** SF08/PA07 entry remains explicitly disabled in this
coordinator. Two independent reduce-only TP/SL orders are not implemented as a
substitute for venue-enforced pairing: their combined fills could consume another
owner's inventory. Bybit documents equal-sized partial TP/SL and warns that
one-sided modifications can break pair binding; the set-trading-stop response
does not return child order identities. These identities, binding, partial-fill
behaviour and cancellation races need verification in the real adapter. A mocked
pair would not prove them. [Bybit trading-stop specification](https://bybit-exchange.github.io/docs/v5/position/trading-stop).

Verification: **18 new cases pass**, including an actual child-process crash after
a cancellation-racing venue fill. Coverage includes main-only TP quantities,
pro-rata costs/fees/ages, setup isolation, residual fallback, touch grace, no-double
close after full maker fill, missing acknowledgements, stale/changed protection,
restart continuation, selected fractional rungs and unchanged-poll durability.
The earlier 103 portfolio cases also pass (**121 total**), as do both source/VPS
typechecks and the existing partial-close transaction tests.

- Protection/main boundary evidence:
  `backtests/portfolio-protection-verification/cc2d8600ebbbeb3e/verification.json`.
- Execution regression evidence:
  `backtests/portfolio-execution-verification/53e6f5e48ff66886/verification.json`.
- Accounting/scheduling component parity remains exact: 420 setup decisions,
  61 MACD signals, 803 receipts, 401 closed/one open, 48,156 reserve checks and
  306 scheduled exits, with unchanged fees and before-funding PnL.
  `backtests/portfolio-live-foundation/9a40e7569bf7338d/verification.json`.

This is an inventory/execution boundary, **not full main-loop integration**. The
existing `index.ts` still runs its original owner; its gate outputs, Agg10/stale
phases, cooldowns, damaged latch, close finalizer, monitoring and funding still
need connecting to the new journal. No real adapter, OCO certification, economic
transport replay or migration is implied by these tests. Test fixture 3x exchange
leverage remains a fixture, not approved production leverage.

### October 11 follow-up — attached setup brackets, simulation only

This supersedes the preceding paired-bracket implementation limitation, **not**
the real-exchange verification requirement. SF08/PA07 entries now work through an
explicitly capable simulated port; other ports still reject them. No live owner,
credentials, configuration or trading process changed.

- `attached-bracket.ts` builds an entry-attached **Partial** TP/SL payload and
  reuses existing tick normalization. No Full-position bracket, standalone
  trading-stop attachment, one-sided amendment or independent pseudo-OCO orders.
- Bybit now documents futures `parentOrderLinkId` in order responses. The entry
  request's parent ID, actual filled quantity and exact TP/SL terms identify its
  children; neither price matching nor an aggregate position delta proves ownership.
  [Entry parameters](https://bybit-exchange.github.io/docs/v5/order/create-order),
  [child linkage](https://bybit-exchange.github.io/docs/v5/order/open-order),
  [pair-binding warning](https://bybit-exchange.github.io/docs/v5/position/trading-stop).
- Parent and bracket intent are saved before submission. Child fills keep real
  order/execution IDs and reuse the lot/fee allocator through terminal receipt-only
  intents, never a second submitted order. Both siblings share one inventory budget.
- Timeouts and partial protective fills use cancel/verify/residual exit handling.
  Cancel acknowledgements and missing children cannot release a slot. An unexpected
  verified protection cancellation or out-of-bracket entry fill requests an owned
  safety exit; it blocks additional exposure until resolved.
- Exactly one TP and one SL child are supported. Multiple child pairs, revised
  identities, excess quantities or conflicting receipts fail closed. Partial entry
  fills are covered when the venue reports this supported layout. A real adapter
  must paginate discovery/execution history, look up known terminal child IDs, and
  include every conditional order in account reconciliation.

**Verification:** 26 new cases, including two actual child exits after venue-side
entry creation and a cancellation-racing fill. All preceding 121 tests and both
source/VPS typechecks pass. Evidence:
`backtests/portfolio-bracket-verification/5092d192e9a61011/verification.json`.
Archived accounting/scheduling still matches 420 setup decisions, 61 MACD signals,
803 receipts, 401 closed/one open, 48,156 reserve checks and 306 deadlines:
`backtests/portfolio-live-foundation/61a5b0096a750fdc/verification.json`.

**Still unproven:** live API child fields/layout, venue-enforced pairing during
partial fills and unrelated-owner position changes, cancellation races at Bybit,
common leverage/maintenance margin, full main runtime/finalizers and transport
economics. The simulator deliberately permits a double-child overfill to verify
that accounting rejects it; detecting that after execution is **not** prevention.
Real pairing must be witnessed before arming. No testnet or real-money orders ran.

### October 11 follow-up — main execution controller, simulation only

`main-runtime.ts` now consumes approved main adds and partials, reuses the original
ordinary/soft-stale/Agg10 target functions, and drives owned maker replacement and
full-close requests. It does **not** yet call the complete candle/pulse gate stack
in `index.ts`. That production entrypoint is unchanged.

- `main-inventory.ts` preserves rung identity, intent age and actual cost using
  only main-owned receipts. Auxiliary fills cannot alter main strategy memory.
- `main-control-state.ts` installs legacy non-inventory memory only from a flat,
  resolved cutover. The damaged latch, regime state, funding history, peak equity
  and existing cooldowns survive. Installation neither retires an old process nor
  proves exchange flatness.
- Actual main fees/net and inventory update inside the receipt transaction.
  Full-close consequences and the exit request are saved together before I/O.
  Flat/terminal evidence completes each episode once, including after a real
  child-process crash after the market close filled. Forced closes retain the
  decision-anchored cooldown; high/weak-week closes reuse the existing execution-
  anchored helper. A TP filled before the high request does not acquire its cooldown.
- S/R actions receive the existing gate's selected IDs, not a replacement signal.
  Positive terminal partial fills commit the frozen cooldown once and preserve
  the rung timer; unknown submissions are never retried. Cancellation-racing
  maker fills invalidate an obsolete partial/add approval rather than reusing it.
- Target decisions recheck quote freshness after reconciliation. Expired add
  approvals or persistent main restrictions do not cancel existing maker protection.
  The close journal reports **whole-episode net before funding, including partials**;
  it must not be labelled the final close-only PnL in a future alert adapter.

**Verification:** 20 new cases, one actual child crash; all **167 portfolio cases**
pass. Source and VPS typechecks pass. Current evidence:

- Main controller: `backtests/portfolio-main-runtime-verification/7d8f26a1b4246470/verification.json`.
- Execution: `backtests/portfolio-execution-verification/930c0f5fc7c98e70/verification.json`.
- Protection: `backtests/portfolio-protection-verification/b2d6005a866305b1/verification.json`.
- Attached brackets: `backtests/portfolio-bracket-verification/a3fa1edea105bd76/verification.json`.
- Unchanged archived accounting/scheduling:
  `backtests/portfolio-live-foundation/b62e8c0c13b2e022/verification.json` —
  420 setup decisions, 61 MACD signals, 803 receipts, 401 closed/one open,
  48,156 reserve checks, 306 deadlines; net before funding $21,496.26488620458,
  fees $3,169.3592312827473.

**Still missing:** full main gate/feed/exit-priority wiring; shared worker scheduling;
maker-to-native scoped fallback and safe protection handoff around adds; live
funding attribution and close alerts; real exchange adapter, pairing/margin checks,
watchdog and full transport/economic parity. No account calls, live orders,
deployment settings, commits or pushes in this checkpoint. A read-only VPS account
snapshot is requested separately to establish actual mode/leverage/capital; it is
not a trading or margin-safety certification.

### October 11 follow-up — common-leverage and read-only account verification

No production strategy source or configuration changed in this checkpoint.
`portfolio-shared-account-tests.ts` adds 12 simulation cases at the operator's
observed **25x exchange leverage and $19,047.43317261 equity**. The full 11 main
rungs, three setup slots and independent MACD coexist; the main maker exit leaves
auxiliary longs alone, and MACD's close leaves the other short alone. Restart,
unknown submissions, insufficient available balance, equity below reserves,
foreign orders and leverage drift are covered. Timed exits remain actionable
with entries paused and no fresh indicator publications.

Internal budgets still charge main cost/25 and auxiliary cost/3. Full planned
entry notional is $89,757.37 ($59,757.37 main plus $30k auxiliaries), with a
$12,390.29 filled-cost budget **before fees, structural stop-risk reserves or
pending-order charges**. This is not a maintenance-margin or liquidation model,
nor a ceiling on later marked exposure. Tests do not exercise all real signal
interactions or structural pair executions at Bybit.

- Evidence: `backtests/portfolio-shared-account-verification/e3450b2180838331/verification.json`.
- Read-only collector: `scripts/portfolio-vps-preflight.cjs`; 16 mock API cases,
  evidence `backtests/portfolio-account-verification/7977a29de0dc0668/verification.json`.
- Combined: 195 tests (167 prior + 12 common-account + 16 read-only checks).
  Both production typechecks pass. No new economic replays or real API requests.

The standalone collector runs from the old VPS working tree with its existing
SDK; no build/pull is needed. It checks UID first, brackets HYPE positions with
before/after reads, pages open orders (including conditional orders), positions
across linear USDT/USDC, inverse and options plus spot orders, and collects wallet,
fees, instrument and risk tiers. API failures and incomplete/looping pages remain
unknown/blocking rather than being treated as empty. SDK exceptions and credentials
are never printed. Raw risk-tier rate units are retained for review, not silently
converted into a liquidation estimate. `readyToArm` is always false.

Official API references: [open orders](https://bybit-exchange.github.io/docs/v5/order/open-order),
[positions](https://bybit-exchange.github.io/docs/v5/position),
[wallet](https://bybit-exchange.github.io/docs/v5/account/wallet-balance),
[risk tiers](https://bybit-exchange.github.io/docs/v5/market/risk-limit).
This is a bounded, non-atomic account check; it does not prove old processes are
retired or that paired TP/SL survives live cancellation/fill races. Full main/feed
integration, native fallback, funding/alerts, venue adapter and integrated parity
remain unfinished. Keep both old owners paused pending a separate cutover.

**October 11 operator preflight and pagination correction:** the full VPS report
(`startedAt=1791673387030`) showed $19,047.56662381 equity/available, no positions
or open orders in the queried account scopes, no used margin/borrowing, regular
cross margin and maker/taker rates 0.0002/0.00055. Its two blockers came from a
third HYPE row. The operator's subsequent default/200-limit page probes both
returned idx=1/2 at 25x on page one, then only idx=0, size=0, leverage=10,
seq=-1, updatedTime="" on the terminal page. This is evidence of a synthetic
empty pagination row, not a reason to switch mode or change leverage.

The collector now preserves all rows plus page identities and narrowly excludes
that terminal placeholder from mode/leverage checks only if both before/after
snapshots agree, the real hedge pair has established sequence/update evidence,
and the placeholder has no side, quantity or TP/SL/trailing protection. Missing
metadata, real one-way rows, hedge leverage drift, inventory, orders and failures
still block. This is not a runtime adapter normalization or an arming decision.
The operator subsequently returned corrected VPS output with preparation checks
passed, no blockers/errors, and only the placeholder warning. `readyToArm=false`
remains intentional; fresh identity/ownership checks are still required at cutover.
26 read-only checker tests pass, including 10 new regression cases with adverse
vectors. Evidence: `backtests/portfolio-account-verification/24a6d89e90b48355/verification.json`.
The prior 179 other portfolio cases were not rerun for this CJS-only correction;
their archived evidence remains separate. No production code/config or API writes.

### October 11 setup-to-owner orchestration checkpoint

`src/bot/portfolio/setup-runtime.ts` connects the existing persistent worker's
snapshot contract, scheduler and exclusive coordinator. All six source types are
exercised through real ledger writes and simulated exchange receipts. This is
not a production entrypoint, new detector or replacement of the main strategy.

- Whole lexical signal groups are committed before the first submission. An
  execution rejection cannot reallocate the sealed group retrospectively.
- R3 reserves in its publication minute, enters only in its next-minute window,
  survives restart, and cannot replay after expiry. Existing valid reservations
  do not require rebuilding a signal if the worker temporarily disappears.
- Exits are serviced before new decisions and between entry submissions. Missing
  indicators, paused entries or missing decision cash do not disable timeouts.
  PA07 same-window timeout reuse requires actual closing receipts and completed
  exit state; SF08 retains its next-minute release. Bounded receipt passes do not
  infer fills from price, cancellation acknowledgements or an elapsed deadline.
- Decision equity is explicit USDT-only booked cash plus owned long/short lots at
  the prior completed-minute close. Venue equity/current bid/ask are not a valid
  substitute. Actual execution still rechecks venue equity and available funds.
  The future Bybit adapter must prove cash scope/coherence; this is not completed
  funding attribution or a venue margin model.
- A slow preflight now returns `entry_window_expired` without submitting, rather
  than throwing the ledger's entry-clock assertion; the older regression retains
  its zero-submission assertion. Timed partial entries can cancel the outstanding
  remainder and then close only the verified filled quantity; a cancel ack alone
  cannot release a reservation or authorize the residual close.
- The main execution controller can process receipts/consequences in this loop.
  Main entry gates, full exit priority, fresh market/pulse inputs and joint
  main-versus-setup scheduling remain unconnected. No new main gate is assumed.

**Verification:** all **233 portfolio tests** rerun and pass (205 previous plus
28 new). The new suite includes one actual child-process crash after a venue
mutation; restart respects the lock and requires simulated operator cleanup of
the confirmed-dead child's test locks before receipt recovery. Both production
typechecks pass. No-op polls do not rewrite state. Test fixtures are reused from
the earlier bracket suite (now importable without auto-running its tests).

- New evidence: `backtests/portfolio-setup-runtime-verification/be7dc562835978f4/verification.json`.
- Execution/protection: `backtests/portfolio-execution-verification/34b8c3f6087b84dd/verification.json`,
  `backtests/portfolio-protection-verification/02adb633bbc835ac/verification.json`.
- Brackets/main/common account: `backtests/portfolio-bracket-verification/9fc8223c33097e0c/verification.json`,
  `backtests/portfolio-main-runtime-verification/524b322a778f2ef5/verification.json`,
  `backtests/portfolio-shared-account-verification/c9098888212f0744/verification.json`.
- Archived component accounting rerun still matches 420 setup decisions, 61 MACD
  signals, 803 receipts, 306 timed exits and 48,156 capital checks, with net before
  funding $21,496.26488620458 and fees $3,169.3592312827473:
  `backtests/portfolio-live-foundation/b62e8c0c13b2e022/verification.json`.

Those are component controls, NOT a new complete-main economic replay or proof of
the real venue execution. No credentials, production orders, PM2 changes,
commits/pushes, strategy thresholds or enable flags changed.

### October 11 continuation — owned main policy and bounded venue probe

The operator requested continuous implementation until a real VPS action is
needed, and approved preparing the isolated ~$20 total-entry venue test.
No live probe, deployment, config enablement, commit or push has happened here.

- `main-policy.ts`, `main-driver.ts`, `main-feed.ts` now evaluate the existing
  main gates/exit priority on owned rungs and reuse the candle, context, pulse,
  S/R and exact-week readers. Missing candles or paused entries do not prevent
  quote-based emergency exits. A firing high-exit minute is not consumed before
  its durable close request, preventing a crash from losing that exit.
- Twenty-five main-policy/feed/driver tests pass; both source/VPS typechecks and
  the three affected candle-reader regression suites pass. The previous 233
  portfolio/preparation cases were rerun successfully this turn.
  Evidence: `backtests/portfolio-main-policy-verification/641b7e4a471bd5a5/verification.json`.
- Main feature/economic parity is **not established**: explicitly reconcile
  legacy partially aggregated HTF context versus the new closed-5m prefix and
  stricter missing-indicator entry checks. Joint pre-boundary capital reservation,
  main/setup ordering, rejection backoff/manual controls and real transport are
  also unfinished. Do not describe this as a deployment-ready full-main replay.
- The standalone `portfolio-bracket-probe.cjs` defaults to read-only; explicit
  execution tests two sequential ~$10 entries on the approved main UID only,
  with legacy writers stopped and both pause files intact. It saves requests
  before I/O, requires parent-linked TP/SL identities, cancels known siblings,
  closes actual residual fills and verifies flat/no-orders between sides.
  Uncertain evidence can leave the tiny position for operator inspection. It
  does not force native stops to trigger or certify OCO/full-size behavior.
  Seventeen fake-venue cases pass (275 total portfolio/preparation cases).
  Evidence: `backtests/portfolio-bracket-probe-verification/fe14bcfcbe290e60/verification.json`.
  VPS procedure is in `docs/operations/aggressive10-live.md`; no pull/build is
  needed because both CJS helpers can be copied to `/tmp/` on the old build.
- Refreshed component parity still matches 420 setup decisions, 61 MACD signals,
  803 execution receipts, 306 exit clocks and 48,156 reserve checks:
  `backtests/portfolio-live-foundation/64b6808483cc14ae/verification.json`.
  This is not complete-main economic parity. Source thresholds/sizes unchanged.

### October 11 venue evidence and cleanup correction

Operator-pasted report (attachment `d721a0bb-a3ec-4e80-9041-9c13baac4929`):
entry `pfprobe_1791676485761_l` filled 0.11 HYPE at 85.42, notional 9.3962,
entry fee 0.00516791. Both Partial TP/SL children were witnessed with exact
parent linkage, qty 0.11, LastPrice and expected trigger direction/price. After
two cancellation attempts the script stopped at `known_child_missing`; it did
not submit a residual close or open the short. The later preflight showed the
long still open and no active orders. Operator then manually closed the long;
the fresh preflight passed with no blockers/errors. This establishes account
cleanup, **not** automatic probe cleanup or full venue parity. Both old writers
stopped/PM2 saved in the pasted output; no portfolio daemon started.

Confirmed code defect: a known child's absence from the broad open/history
response caused only one exact historical query and then an immediate exception,
skipping the outer polling allowance. It did not query realtime by that child ID.
History latency is documented by Bybit, but the actual missing/filtered response
was not preserved, so latency versus absent lineage is not yet proven on VPS.

Correction: query exact child IDs through realtime plus history, keep missing
observations pending across bounded polls without erasing saved identities, and
reject contradictory IDs/parentage/terminal states. Empty results and cancellation
acks never count as terminal. Parent linkage requirements remain strict. A new
`--inspect-orders` mode reads both endpoints using the saved IDs; it neither
modifies the report nor places/cancels orders. After the manual close, do NOT
rerun execute/recovery or overwrite the original evidence to force success.

Probe tests pass 27 cases (10 new, including delayed history, both endpoints
missing, recovery with no resubmission, stale/conflicting snapshots, manual-close
refusal and read-only diagnostics):
`backtests/portfolio-bracket-probe-verification/4a5746f20049aebc/verification.json`.
No broader portfolio code/config changed for this correction. Next operator
action is the read-only diagnostic, not another live trade.

### October 11 exact-ID response and remaining short

Operator inspection attachment `492998f7-0ff4-4b1e-8479-93f7b718a651` returns both
original children in realtime AND history as `Deactivated`, `CancelByUser`, qty
0.11, zero cumulative fills, preserved parent links. Both update at 1791676487708.
The first cancel attempt was recorded at 1791676487499; the second at
1791676487791. This is compatible with paired deactivation; client/server clock
differences and the absent original response prohibit claiming the exact race
or universal sibling behavior. `Deactivated` was already terminal in the code;
the defect was missing exact realtime lookup and aborting before bounded retry.

The witness shape is now regression-tested with paired deactivation, redundant
sibling-cancel rejection and lagged historical responses. The only remaining
originally approved probe entry has a separate `--execute-short-10-usd` mode,
version-2 short-only report and immutable predecessor hash. It requires the
original failed-long receipts within the combined ~$20 budget, exact zero-fill
terminal child evidence, current account flat/no-orders preflight, stopped
writers, pause files and both account locks. It never retries the long, changes
its report or treats its manual cleanup as an automatic pass. Repeated short
execution is blocked by the separate report. Short recovery is drain-only and
cannot send another entry. Both sources' leverage/config remain untouched.

34 local probe tests pass, covering strict one-side scope, invalid predecessors,
receipt/budget failures, actual terminal shape, identity conflicts, retirement
checks and no-entry recovery. No short VPS result or portfolio arming claim.
Evidence: `backtests/portfolio-bracket-probe-verification/afb6de94e63814e2/verification.json`;
the unchanged 26-case account preflight suite also passes.
Next operator action: copy updated helper, run the remaining-short mode once.

Continue implementation in this order, without changing the frozen strategy:

1. Verify the new main gate/feed/exit-priority driver against the archived parent,
   resolve the feature/missing-input differences above, and compose joint ordering
   with conservative pre-boundary collateral. Coupled historical/real venue
   execution parity remains unverified.
2. Extend the simulation-tested exclusive coordinator with real exchange preflight
   and an adapter only after scoped protection/main integration is safe. Resolve
   one actual leverage setting, real collateral/maintenance-margin requirements,
   order lookup/cancellation and unknown fills. Preserve virtual 3x auxiliary budgets.
3. Integrate the main driver and live feed into the final single-owner loop,
   retaining manual controls and rejection backoff. The legacy entrypoint still assumes it owns the whole long side and
   sets both exchange leverages. No portfolio daemon may place orders alongside it.
4. Replace full-side TP/SL assumptions with quantity-owned protection, including
   ladder maker TP, its native fallback, setup brackets and timed exits. Preserve
   existing ladder partial allocations and age clocks; independently attribute
   actual fees/funding without using exchange aggregate average entry as strategy cost.
5. Run full signal-to-order parity, account-owner races, partial/cancel/protection
   crashes, startup reconciliation, stale-feed checks and portfolio watchdog tests.
   Complete observation and the eventual flat/reconciled migration handoff. Do not
   stop the existing SFP owner or move its capital while inventory is unresolved.

No API keys, deployment toggles, PM2 entrypoint or real exchange submission adapter
were introduced in these checkpoints. Existing main/SFP behavior remains unchanged.

Return one concrete plan that maps this research contract onto the current live architecture:

1. **Rule-to-code/config map.** Identify existing reusable detectors, indicator helpers, execution, state and transaction components. List each intended setting, units, source authority and missing implementation. Keep source periods/thresholds, slots, sizing, clocks and management fixed. Reconcile the sealed complete-main configuration with current effective profile overrides; report drift explicitly rather than silently calling a different main baseline equivalent.
2. **Account and owner design.** Explain how the real account will preserve pooled $19k capital and independently attributed main/setup/MACD lots, pending requests, exits, fees and funding. Existing main/SF08 ownership is exclusive by account/side; launching several unchanged owners on the same side is not established as compatible. Resolve exchange position aggregation, partial/reduce-only close attribution, leverage/margin compatibility, and restart/reconciliation before proposing a config. If account separation is necessary, its capital constraints differ from the tested pool and must be modeled explicitly.
3. **Separate-SFP transition proposal.** Use the [SF08 runbook](../docs/operations/sf08-live.md) to plan an entry pause and continued management of any existing position/pending order before parking the owner or moving capital. Do not disable or kill a process with unresolved inventory. Retain the SF08 source in the new book and avoid duplicate independent entries during transition. No account migration has been performed by this research.
4. **Parity and operational verification.** Reproduce the accepted source/slot decisions, receipts, native parent totals, raw/funded months and capital admissions in both TP models before claiming implementation parity. Cover closed-bar availability, pending reservations, simultaneous signals, source-specific slot release, out-of-bracket fill rejection, lot/tick rounding, independent exits, restart recovery and unknown-fill reconciliation. Preserve the positive-net/no-worse-DD/monthly >=-$250/sample >=20 checks; quantify every implementation-induced deviation rather than editing expected outcomes to pass.
5. **Observation and eventual release plan.** Specify shadow/forward-observation telemetry for signals, skips, slot occupancy, fills, slippage, per-owner attribution, shared margin and reconciliation. Any later live behavior/config commit must update the existing [live overview prose](../docs/operations/live-strategy-overview-2026-09-25.md), relevant runbooks and generated HTML, with the required build/test/check commands in `AGENTS.md`. Keep planned config, operator-approved deployment and dated live evidence distinct.

Do not treat this as a ready-to-load configuration file. The requested output is a builder plan with a reviewable configuration specification and explicit implementation gaps; the researched strategy definition stays fixed.

## Prompt to give the builder

> Read `research/codex-astra-hype-2026-three-slot-macd-builder-handoff-2026-10-10.md` and the linked $19k monthly findings. Plan the exact main + three fungible setup slots + independent MACD R3 portfolio using $19,000 total equity, with the separate SFP allocation parked but the tested SF08 source retained inside the setup book. Map rules to existing code/config, identify account/owner and pooled-capital gaps, and return a concrete configuration and implementation plan with parity tests and forward observation. Reuse the sealed evidence; do not retune signals/sizing, weaken checks, or change live settings as part of planning.
