# Current-stack execution, S/R parity and HL quality foundation

September 5 follow-up: [verified candle recovery and corrected-history rerun](codex-astra-candle-gap-recovery-findings-2026-09-05.md)
repairs all eleven archive gaps and restores 100% S/R candle coverage in both
windows. The September 4 results and limitations below remain the dated record;
use the follow-up for the corrected baseline, not as an exact-live-parity sign-off.

Snapshot date: September 4, 2026; validation completed across midnight Oslo time.
Scope: the three approved infrastructure directions. No strategy variants, live
threshold/config changes, exchange requests, deployment, commit or push.

## TL;DR

- **The three code foundations are implemented and their focused regressions pass.**
  The historical control reproduces exactly: $64,976.97 modeled PnL, 990 closes,
  106 partials. Four new baseline/model cases, each independently executed twice
  on one frozen input build, pass result equality and decision-before-fill checks.
- **Old profit claims are not re-certified.** On the same July 2025–August 19,
  2026 window, the new model returns $19,687.36 with close-confirmed TPs or
  $41,670.88 with touches of previously active targets. These combine execution,
  policy/state and coverage repairs; neither delta isolates look-ahead alone.
- **Do not start a dollar-profit leaderboard yet.** Eleven missing historical
  1-minute candles cause substantial S/R exclusions under the correct 14-day
  continuity requirement: 94,058 evaluated minutes, approximately 59.4% of the
  richer HL-window replay. Local 5-minute fallbacks cannot repair those gaps.
  Exact maker/fee/funding/account parity also remains outside this minute model.

## What changed

### 1. Causal decision and execution phases

[`scripts/replay-causal-engine.ts`](../scripts/replay-causal-engine.ts) separates
previous decisions, current fills and newly closed-minute decisions. Price-drop
adds cannot claim an earlier candle low after deciding at the close. A newly
lowered stale TP cannot use that candle's earlier high. Stale pending entries
across missing bars are cancelled; end-of-data intents stay pending in the result.

The conservative/default TP assumption is close-confirmed then next-open market
execution. A separate `resting_touch` assumption allows only previously active
targets to fill from a subsequent high. Touch timing, queue availability and
native Mark Price triggering are not known from these OHLC candles. Neither
assumption is a guaranteed bound on realized account PnL.

The canonical `runEngine` now defaults to this engine. Archived experimental
options fail explicitly unless callers select `legacy_ohlc`; the old standalone
sweep entry point no longer runs accidentally. Legacy source and prior artifacts
are retained rather than rewriting the historical results.

### 2. Shared current S/R policy and state

[`scripts/replay-sr-context.ts`](../scripts/replay-sr-context.ts) builds the actual
live `SRMemoryZoneEngine` from a closed historical prefix and current configuration.
It checks timestamp continuity, not just candle count, and prohibits backward
queries into a future-built context. It never promotes a four-minute aggregate
to a complete five-minute candle.

Replay calls the actual live support-reopen, partial candidate/action gate,
deep-stress and full-exit evaluators. It retains funding-only/time-add restrictions,
sample counts, current/anchor ages, context health and outer entry gates. There is
no new S/R rule, short signal, threshold or live strategy change.

Partials preserve selected position identity, remaining-rung timing and S/R cooldown.
Full closes reset `lastAddTime`. Resting-target post-TP cooldown uses pre-fill-bar
context rather than stale intent-time RSI or the future final RSI of the fill bar.
The live affordability predicate is applied to modeled long-only capital; enabled
account drawdown-kill configuration is rejected rather than incompletely simulated.

### 3. Explicit HL source quality

[`scripts/replay-market-inputs.ts`](../scripts/replay-market-inputs.ts) separates
arrival eligibility, original flow windows, distinct-minute coverage, source age,
anchors and missing values. Replayed support confirmation uses live health rules.
Native OI, USD-marked OI and mark-price movement are reported separately. Funding
normalization requires an explicit interval; HLP snapshots are not labelled cash flows.

[`src/hl-data-quality.ts`](../src/hl-data-quality.ts) is shared with the production
pulse reader. Book bands require explicit acceptable truncation/resolution evidence,
and source/receipt time determines age. Newly recorded asset receipts also preserve
current and historical-anchor age instead of treating every sample write as fresh.

[`src/hyperliquid-collector.ts`](../src/hyperliquid-collector.ts) adds publication
and available receipt timestamps to future rows, including REST samples. It clears
cached book/asset observations on WebSocket disconnection. Existing event/sample
timestamps remain compatible. Where receipt time was never recorded, it remains
unknown; old taker publication uses the disclosed one-minute model assumption.

Production data interpretation can therefore fail closed on evidence previously
treated as fresh. This is **not entirely observability-only**, although no sizing,
threshold, executor, coordinator, protection or live config was changed. These
collector/pulse-reader edits have not been deployed.

## Reproduction and acceptance

Successful artifacts:
`backtests/hype/current-stack-foundation-2026-09-04/`.

See [the model contract and local commands](../docs/research/current-stack-replay.md).
The runner fingerprints sources/config, records raw-file sizes/mtimes, checks the
previous legacy control, saves individual executions/partials/closes/months, repeats
each case and checks that inputs/source did not change during the run. Generated
outputs and copied raw data remain ignored. No existing results were overwritten.

Acceptance record:

- `legacyControlMatched=true` (PnL within $0.000001; exact close/partial counts).
- `repeatedResultsEqual=true` for all four cases.
- `noRetrospectiveFills=true` for every recorded execution.
- `sourceAndInputMetadataUnchanged=true`.
- `strategyVariantsTested=0`, `exactLiveParityCertified=false`.

This is deterministic repeat testing with one constructed input series, not two
independent simulators. Synthetic future-append/prefix tests and control reproduction
complement it. Raw size/mtime checks are not a full content hash of every dataset.

## Aggregate model comparison

Each window starts separately, flat, at $32,000 modeled equity. Sizing is the
unchanged $800 / 1.35 / 11-rung policy. Fees use 0.055% on entry and exit; no actual
funding settlements or maker fee saving are booked. Open PnL includes modeled exit
fees and is shown explicitly. These are not predictions or live-account returns.

| Window / assumption | Realized PnL | Open PnL | Total PnL | Full closes | Partials | Max modeled DD |
|---|---:|---:|---:|---:|---:|---:|
| July 1, 2025–August 19, 2026 21:32 UTC: previous legacy execution control | $64,976.97 | $0 | $64,976.97 | 990 | 106 | 25.57% |
| Same window: close-confirmed TP | $19,687.36 | $0 | $19,687.36 | 860 | 121 | 47.74% |
| Same window: prior-active-target touch | $41,670.88 | $0 | $41,670.88 | 1,025 | 128 | 33.00% |
| May 17, 2026 20:43–September 4 19:01 UTC: close-confirmed TP | $20,840.60 | -$1,297.77 | $19,542.83 | 263 | 27 | 28.51% |
| Same HL window: prior-active-target touch | $22,679.15 | -$0.99 | $22,678.15 | 319 | 27 | 23.79% |

The final two cases finish with 11 and 6 open rungs, respectively; neither has an
unexecuted market intent at cutoff. They are independently initialized windows,
not exit-date subtotals of the longer runs. Hypothetical instantaneous fills,
unrounded sizes and minute sampling still differ from the live transactional stack.

The longer-window touch case produces 966 normal/stale TP cycles, 35 hard flattens
and 2 emergency kills; close-confirmed produces 797, 37 and 4, respectively. The old
control had 928 TP cycles, 37 hard flattens and 3 emergency kills. Thus the difference
is not simply fewer profitable exits: inventory, entry prices, partial allocations,
cooldowns and subsequent opportunities all change. No one mechanism is credited
with the entire PnL difference.

### Monthly realized PnL, same longer window

August is partial through August 19 21:32 UTC. Delta columns are infrastructure/model
comparisons versus the source-time-repaired legacy control, not strategy rankings.

| Month | Legacy control | Close-confirmed | Prior-target touch | Close-confirmed delta | Touch delta |
|---|---:|---:|---:|---:|---:|
| 2025-07 | $330.17 | -$3,154.83 | -$2,359.42 | -$3,485.00 | -$2,689.59 |
| 2025-08 | $2,062.95 | $1,793.58 | $657.90 | -$269.37 | -$1,405.06 |
| 2025-09 | $4,458.48 | $6,077.60 | $5,451.23 | $1,619.11 | $992.74 |
| 2025-10 | $9,608.59 | $5,378.92 | $7,111.96 | -$4,229.67 | -$2,496.64 |
| 2025-11 | $2,817.00 | -$864.50 | -$1,624.46 | -$3,681.49 | -$4,441.45 |
| 2025-12 | -$137.64 | $728.63 | -$378.97 | $866.27 | -$241.33 |
| 2026-01 | $7,040.13 | -$8,995.47 | $224.49 | -$16,035.60 | -$6,815.64 |
| 2026-02 | -$157.52 | -$6,078.75 | $6,371.40 | -$5,921.23 | $6,528.92 |
| 2026-03 | $8,532.47 | $18,863.36 | $17,331.87 | $10,330.89 | $8,799.40 |
| 2026-04 | $5,359.99 | -$3,703.07 | -$4,616.35 | -$9,063.06 | -$9,976.33 |
| 2026-05 | $17,864.18 | $15,751.31 | $15,314.29 | -$2,112.87 | -$2,549.89 |
| 2026-06 | $9,583.24 | -$1,725.44 | $1,475.59 | -$11,308.68 | -$8,107.65 |
| 2026-07 | -$3,556.15 | -$6,402.35 | -$4,606.13 | -$2,846.20 | -$1,049.98 |
| 2026-08 partial | $1,171.07 | $2,018.38 | $1,317.48 | $847.31 | $146.41 |

The HL-window monthly files include September and its open inventory. Its realized
May/June/July/August/September totals are $17,158.08 / -$1,725.44 / -$6,402.35 /
$10,947.92 / $862.39 for close-confirmed, versus $13,271.60 / $1,475.59 /
-$4,606.13 / $9,753.46 / $2,784.63 for prior-target touch.

## Newly exposed archive limitation

The merged 1-minute history contains these eleven missing minutes (UTC):

| Missing minute | Local five-minute fallback |
|---|---|
| April 20 16:20 | Absent |
| April 25 09:38 | Absent |
| April 25 20:12 | Absent |
| April 26 15:25 | Absent |
| June 4 17:35 | Absent |
| June 4 17:40 | `n1m=4` |
| June 23 18:31 | `n1m=4` |
| July 15 06:29 | `n1m=4` |
| July 17 00:52 | `n1m=4` |
| August 4 00:20 | `n1m=4` |
| August 28 05:49 | `n1m=4` |

`HYPEUSDT_5_full.json` ends March 29; `HYPEUSDT_5m.jsonl` contains the incomplete
aggregates above, not independent complete exchange bars. No missing candles were
fabricated, downloaded or silently patched in this pass.

There are seven gap transitions in the HL window; June 4 has two missing minutes
but one transition. The S/R health diagnostic reports 94,058 unhealthy evaluated
minutes. That is not 94,058 otherwise-eligible partials or opens: it records context
availability even while other gates block. Repeated 14-day exclusions explain why
very few missing minutes materially limit this replay's S/R policy coverage.

This does **not** establish that live S/R was disabled for those periods. The live
context manager can hydrate native five-minute exchange candles independently.
Verified replacement candle evidence, kept with provenance rather than overwriting
original pulls, is needed before ranking full-window HL/S/R profit variants. Then
rerun the same frozen policy; do not relax the continuity rule to restore old PnL.

Input tape diagnostics: 2,720,928 accepted parsed observations, zero rejected
buy/sell-flow rows, one book row with unavailable 0.5% band evidence, and 158,311
historical taker rows requiring modeled publication time. "Accepted" does not mean
all fields are trade-ready. The latest snapshot has 14/59 distinct HL minute samples,
60-second taker age and 16.207-second book source age; those are historical modeled
as-of values, not a current VPS health report.

## Tests and boundaries

Passed locally:

- `replay-current-stack-tests.ts`: retrospective add/stale-target fixtures, next-open
  fills, final pending state, gaps, repeats, future prefixes, current RSI cooldown,
  nonempty confirmed-zone prefixes, support health, actual partial candidate → fill
  → remaining state/fees/cooldown, and the identical candidate blocked by coverage.
- `replay-causality-tests.ts`: input eligibility, publication, context warm-up,
  future append, historical prefix and legacy-control input tests.
- `hl-data-quality-tests.ts`: actual production pulse reader against disposable
  book/asset fixtures; stale sample, stale anchors, truncation, coarse resolution,
  future timestamps and unknown evidence.
- `sr-support-reopen-tests.ts`, `sr-context-safety-tests.ts`.
- `operational-health-tests.ts`, both HL breakdown/BPV shadow suites.
- `long-state-transaction-tests.ts`, `partial-close-transaction-tests.ts`.
- Both TypeScript no-emit builds and `git diff --check`.

No production order path was executed. Tests use temporary fixtures, not copied
trading state. New replay modules contain no exchange client, executor, signal-file
write or process-control calls. Collector changes are source-reviewed/typechecked;
there was no real WebSocket reconnect/deployment test in this local research pass.

Remaining: verified candle-gap evidence; historical source-delivery uncertainty;
exact maker/tick/partial/fallback execution modeling; actual funding/fee settlement
ledger; durable historical open records; and shared-account attribution. The known
live funding-cursor defect remains unchanged—no guessed historical deductions.

**Verdict:** accept the tested code foundation for continued local work, not a
live-profit or strategy-promotion certificate. Preserve the old control as a
diagnostic, repair the verified archive gaps next, and keep live configuration
unchanged. No candidate rankings or falsification-ledger edits apply: zero strategy
variants were tested.
