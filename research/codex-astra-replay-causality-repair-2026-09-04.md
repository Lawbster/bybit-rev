# Replay causality repair — 2026-09-04

Scope: repair the identified research input-alignment and indicator-coverage defects. No live trading code, configuration, account state or collector changes. No strategy variants, deployment, commit or push.

## TL;DR

- The two demonstrated research defects are repaired and regression-tested: future-in-the-minute pulse observations and missing earlier indicator context. Both validation windows repeat identically: **990 full closes / 106 trims** in the longer window, **248 full closes / 96 trims** in the HL window.
- The same longer-window policy now returns **$64,976.97 simulated PnL**, versus the legacy **$82,912.67**. Most of the change is the previously isolated indicator-coverage defect, not a measured live loss. This is still a minute-candle approximation, not certified current live-stack performance.
- Funding is a separate local-accounting defect: the zero funding cursor never initializes. Bybit wallet balances and the bot's local realized-PnL ledger are different records. No live accounting change or guessed historical funding charge was made.

## What changed

- Both the canonical HL score reader and the dormant/S/R feature reader now key samples by the **first minute decision at or after their availability**, rather than flooring them into the beginning of their observation minute. The selected raw availability timestamp survives in `CausalMinuteLatest.availableAt`. Out-of-order older snapshots cannot overwrite newer ones; conflicting point snapshots at the identical timestamp cause an error.
- Point samples, completed flow aggregates and funding records have explicit timing rules. Window-end time is not interchangeable with receipt time; `nextFundingTime` is never treated as availability. Flow fragments are summed, not mistaken for conflicting snapshots.
- RSI/CRSI/slope features are populated across all loaded history, independently of a wrapper's `SIM_START`. `runEngine` refuses a trading window containing missing/non-finite context. Historical warm-up is still required; missing indicators no longer silently disable filters.
- The candle loader includes only minutes **closed by the requested cutoff**. Missing primary candles, missing required streams, malformed JSON and callback exceptions fail loudly. A supplemental 1m JSONL file may be absent if the full candle file supplies the data.
- The validation entry point reconstructs the selected damaged-regime latch from corrected taker inputs and the production **pure** latch evaluator, including its 4H close grace. It does not reuse old interval CSVs.

At a decision of `07:40:00`, a snapshot timestamped `07:40:46` is now first eligible at `07:41:00`; it cannot replace the snapshot actually available at `07:40:00`. Exact-boundary receipt timestamps remain eligible at that boundary. This minute compression is valid for minute-grid decisions/lookback anchors, **not arbitrary sub-minute queries**.

Files:

- `scripts/replay-causality.ts` — shared timestamp/availability/alignment rules.
- `scripts/hype-freerun-canonical-replay.ts` — full-history indicators, coverage guard, strict input reading, HL score alignment and closed-minute cutoff.
- `scripts/hype-dormant-edge-replay.ts` — S/R/pulse point and aggregate alignment.
- `scripts/replay-damaged-latch.ts` — current-policy latch reconstruction without legacy cached intervals.
- `scripts/replay-causality-tests.ts` — regression suite.
- `scripts/hype-replay-causality-validation.ts` — unchanged-policy validation runner with fresh output paths, source hashes, input size/mtime checks and deterministic repeat checks.

## Tests and acceptance boundary

The regression suite checks:

1. Samples after a decision, including later in the same minute, cannot affect it.
2. Exact boundaries, lookback-grid alignment and explicit receipt timestamps.
3. Order-independent selection of the latest point sample; conflicts reject.
4. Flow publication timing and aggregation of multiple fragments in one minute.
5. Appending future book/OI/liquidation/taker observations leaves earlier dormant features, HL scores and fixture engine results unchanged.
6. Future taker records do not rewrite an earlier damaged-latch transition; known completed structure plus eligible sell flow can arm it.
7. Indicator arrays computed on a full series match arrays computed only on its historical prefix; populated pre-May-2026 context is available despite the old default feature start.
8. Missing context, malformed input and callback failures reject; forming 1m candles are excluded.

These tests pass. Both production no-emit TypeScript builds also pass. No executor is imported or invoked by the validation runner; its only `src/bot` runtime import is the pure latch policy module.

## Important timing qualifications

This repair removes the demonstrated **source-time look-ahead**. It cannot recover timestamps the collector never stored.

- Historical HL taker rows are timestamped at `windowEnd`, while collector flush occurs later. Without an explicit receipt timestamp the replay applies a **one-minute modeled publication lag**. This is conservative relative to normal flush timing, but is not proof of delivery during a disconnect or backlog. If a receipt timestamp exists, that is used instead.
- Binance backfill rows lack a contemporaneous local receipt timestamp. Their 5m aggregates are unavailable until at least period end in this model; their exact historical receipt time remains unproven.
- Historical candles/point streams can lack archival revision/receipt history. The current copied file is not an immutable record of everything the bot knew then.
- The live-convention RSI/CRSI calculation uses the higher-timeframe forming value built from the **known prefix**, never that higher-timeframe candle's future final close. Its indicator values are not interchangeable with a closed-bars-only strategy.
- The engine is still a **minute-candle execution approximation**: maker order lifecycle, intra-minute fill ordering, native races, transactional re-entry timing, live interruptions, actual fees and long funding remain separate parity work. This patch does not certify those mechanisms.
- The reconstructed historical latch starts initialized/inactive, representing an established policy. Actual code-deployment bootstrap behavior is not inferred for historical dates. No thresholds were changed.

Do not label this patch “all historical results validated” or “exact current-stack parity.” In particular, the old $82,912.67 headline remains a **legacy artifact**, not a target the corrected engine should be tuned to match. Earlier research wrappers with their own readers or cached intervals are not automatically certified by repairing these shared readers. Use the validation runner below for this repaired baseline; no variant sweeps were run.

## Funding bookkeeping: what the audit meant

There are separate records:

| Record | Meaning |
|---|---|
| Exchange wallet balance | Retrieved from Bybit's wallet response (`executor.ts`, `getWalletEquity`, which actually returns `totalWalletBalance`) |
| `bot-state.json.realizedPnl` | Bot-maintained realized trade accounting, with booked close-path trading fees |
| `bot-state.json.totalFunding` | Intended bot-maintained cumulative funding accounting |

The copied state has `totalFunding=0` and `lastFundingSettlement=0`. In `src/bot/index.ts`'s funding loop, a zero settlement cursor makes `lastBucket=currentBucket`. The `currentBucket > lastBucket` condition can therefore never initialize the cursor. The only cursor writer is inside `state.deductFunding`, behind that condition.

That means funding debits/credits are not incorporated by this path into the bot's local PnL ledger. **It does not mean Bybit failed to charge funding, or that the exchange balance is fabricated.** Live capital normally comes from the exchange wallet response; if that request fails, the code can fall back to synthetic local PnL, making accurate reconciliation important beyond display alone.

Illustration only: +$100 realized trading PnL after trading fees and $4 net funding paid would be +$96 exchange-net, while the incomplete local trade ledger could still show +$100. If net funding was received, the direction reverses. This audit has not obtained the actual missing settlement total.

The replay also omits long funding. It has not been added here and no historical charges have been guessed or written into production state. A separate accounting fix needs actual settlement identities and careful wallet/PnL reconciliation to avoid double charging.

## Running locally

```powershell
npx.cmd ts-node scripts/replay-causality-tests.ts
$env:REPAIR_OUT = 'backtests/hype/replay-causality-repair-rerun'
npx.cmd ts-node scripts/hype-replay-causality-validation.ts
Remove-Item Env:REPAIR_OUT
```

The runner refuses existing output directories. Raw copied data remains local and ignored. Source snapshots from before this repair were preserved under the local `backtests/hype/replay-causality-repair-2026-09-04/legacy-source/`; original audit results remain untouched. The research-preservation manifest from the earlier handover is a dated pre-repair capture, not a claim that these subsequently repaired source hashes remain unchanged.

## Completed validation

Successful artifacts: `backtests/hype/replay-causality-repair-2026-09-04/validated/`.
The two earlier integration attempts (`repaired/`, `repaired-v2/`) failed before producing replay totals and are not successful validation runs.

Initial simulated equity is $32,000. Strategy thresholds and sizing remain $800 / 1.35 / 11 rungs, with the selected S/R policies and reconstructed damaged latch. Fees use the existing configured taker model; funding and maker execution are omitted. The August 19 cutoff deliberately matches the prior published control rather than extending the period to the latest copied September data.

| Same longer window: July 1, 2025 through August 19, 2026 21:32 UTC | Simulated PnL | Full closes | S/R trims | Max DD |
|---|---:|---:|---:|---:|
| Legacy default, missing earlier indicators | $82,912.67 | 1,035 | 105 | 22.10% |
| Earlier diagnostic: full indicator context, old pulse timing | $65,177.46 | 987 | 101 | 25.57% |
| This repair: full context, corrected input timing, rebuilt latch | **$64,976.97** | **990** | **106** | **25.57%** |

The earlier indicator-only diagnostic accounts for **-$17,735.21**. The additional package of timing/publication/latch-reconstruction changes accounts for **-$200.49** versus that diagnostic. These are infrastructure comparisons, not competing strategy variants or a standalone estimate of look-ahead's impact on every prior study. No policy was tuned to recover the old total.

Monthly diagnostic against the already-populated-context control:

| Month | Prior full-context control | Repaired model | Delta |
|---|---:|---:|---:|
| 2025-07 through 2026-04 | Unchanged in every month | Unchanged in every month | $0.00 each |
| 2026-05 | $18,470.57 | $17,864.18 | -$606.39 |
| 2026-06 | $9,806.24 | $9,583.24 | -$223.00 |
| 2026-07 | -$4,185.62 | -$3,556.15 | +$629.47 |
| 2026-08 through cutoff | $1,171.63 | $1,171.07 | -$0.56 |

The separately initialized **May 17, 2026 20:43 through August 19 21:32 UTC** HL-window run returns **$25,439.23**, 248 full closes, 96 trims and 16.54% max drawdown. It is not an exit-date subtotal of the longer run because starting inventory/cooldowns differ. Both runs finish flat. Full per-month realized PnL and individual close/trim records are saved with the artifacts.

Four engine executions (two per window) produced matching complete-result SHA-256 digests within each pair:

- Longer window: `6d76385e399a3657a243eedb279e6ed2aea14bf507ed6abbff6be690d0fdefaa`.
- HL window: `60729318ad09038494f9c081900854657ef2bfa18351c5b824e3812c57729e17`.

The validation manifest fingerprints sources/config and records raw input size/mtime; the latter were unchanged across the run. This is a repeat check on independently executed engines sharing one built input series, complemented by separate future-append and historical-prefix tests. It is not a claim of bit-identical historical network delivery or a second independent implementation.

Checks passed:

- `npx.cmd ts-node scripts/replay-causality-tests.ts`
- `npx.cmd ts-node scripts/current-stack-attribution-tests.ts`
- `npx.cmd tsc --noEmit --pretty false`
- `npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false`
- `git diff --check`

**Acceptance: the identified input/context repairs pass. Exact replay-to-live parity remains open.** Historical performance claims still require the execution-model and accounting work listed above; none of these results justifies a live config change or certifies the old variant rankings.
