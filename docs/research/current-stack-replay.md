# Current-stack causal replay contract

Updated September 5, 2026. Local research only. This does not authorize live tuning,
collector deployment, private exchange access, or a strategy sweep. The optional
candle recovery command below makes bounded, public, read-only Bybit requests.

## Entry points and compatibility

- `scripts/hype-replay-current-stack-validation.ts`: frozen unchanged-policy
  acceptance run, including historical-control reproduction and two execution
  assumptions. Refuses an existing output directory.
- `scripts/replay-causal-engine.ts`: current long-policy minute execution engine.
- `scripts/replay-sr-context.ts`: historical-prefix wrapper over the live zone engine.
- `scripts/replay-market-inputs.ts`: availability-aware input tape and source metadata.
- `scripts/replay-causality.ts`: source availability and minute-boundary helpers.
- `src/hl-data-quality.ts`: pure data interpretation shared with the live pulse reader.
- `scripts/recover-candle-gaps.ts`: public candle evidence retrieval into a new
  local artifact directory; never rewrites synced archives.
- `scripts/replay-candle-repair.ts`: pure evidence validation and explicit repair
  overlay, shared with the canonical candle loader.

`hype-freerun-canonical-replay.ts::runEngine` now defaults to `causal_next_open`.
Unsupported older experimental parameters and missing current S/R input tapes
throw instead of silently producing a new-looking result with legacy assumptions.
The old built-in sweep CLI is disabled; it is not the new baseline entry point.

The [September 5 exposure-control experiment](ladder-exposure-controls.md) adds
an optional `CausalRunOptions.researchAddVeto` to the research engine only. It
receives immutable decision-time scalars after existing gates/affordability and
can only suppress an add. Default and inert-hook behavior must retain the full
archived baseline result, not merely its total PnL. This changes the engine's
source hash; older source-pinned experiment wrappers intentionally reject a new
hash. The exposure runner records the original/revised hashes and verifies
the original four result digests instead of silently updating their totals.

Archived callers must explicitly choose `executionModel: "legacy_ohlc"` or
`runLegacyEngine`. That is reproduction-only, not a way to certify an old winner.
`hype-replay-causality-validation.ts` deliberately uses that archived mode to
preserve the previous input-time diagnostic. `sim-exact.ts` is likewise historical,
not an independent implementation of today's maker/S/R/latch stack.

## Execution ordering

| Phase | Allowed information and action |
|---|---|
| Minute open | Execute a decision queued by the previous closed minute at this open; no earlier-low fill. Cancel a stale entry if the next observed candle is not contiguous. |
| Prior target | Only a target already armed before this minute may use its high. Never use the minute's earlier high for a target calculated at its close. |
| Minute close | Evaluate current exits, partials and entry gates from the closed minute and eligible source observations. Queue market mutations for the following open. |

Two explicitly different TP assumptions:

- `close_confirmed` (default): require a close at/above an existing target, then
  close at the next open. This can miss a genuine intraminute TP and is **not a
  mathematical lower bound** on PnL: it also changes inventory and later episodes.
- `resting_touch`: a previously active target may fill at its price on a later
  candle's high. It assumes executable target liquidity, not maker queue position,
  native Mark Price triggering, or a guaranteed full fill.

Both modes use configured taker fees on entry and exit, including hypothetical
closing fees on open inventory. Maker fee savings and actual funding are absent.
Targets are rearmed at the close after an open/partial: the unprotected modeled
interval can be almost a minute, unlike live order protection timing. A TP touch's
exact intrabar time is unknown and recorded at bar end. Its cooldown uses context
known before that bar, not its final RSI or the old target-intent RSI.

Adverse-path equity marking considers the bar low before a hypothetical TP. It
does not claim the actual market visited that low first. Gaps are counted; a missing
minute does not invent an entry or a TP touch. A pending order at the final cutoff
is reported, never silently filled. No liquidation model is supplied.

## Shared policy and state

The current engine calls the same pure live full-exit, ladder-kill, deep-stress,
support-reopen and S/R-partial evaluators. It does not import an executor. Current
strategy thresholds come from `bot-config.json`; no file is rewritten by replay.
Trend/risk-off/indicator arrays remain the canonical as-of implementations, not
claims of exact historical REST-cache delivery or 10-second decision timing.

S/R uses the configured timeframe, pivots, clustering and memory horizon. Each
5-minute candle requires five contiguous source minutes. Coverage must extend
through the latest closed 5-minute candle. Zone rebuilds receive only a closed
historical prefix, including pivot warm-up. Backward queries require a new context;
building zones on the whole future history then filtering is prohibited.

Full closes reset `lastAddTime`. Partials execute the exact selected position IDs,
retain other rungs, update remaining-entry timing, and preserve the configured S/R
cooldown. Sizing uses remaining depth, matching current callers. The live affordability
predicate is reused against modeled long-only equity, **not** the shared wallet.
Account-level drawdown kills are rejected if enabled; they need a portfolio model.

Actual pending-order recovery, terminal exchange partial fills, lot/tick rounding,
maker cancellation/repost/fallback and external/native-close receipt import remain
covered by their operational tests, not simulated by this minute-market engine.

## HL feature contract

Keep three clocks distinct: event/source time, local receipt, and publication.
`timestamp` is retained for existing consumers; new collector rows add
`observationVersion`, `receivedAt` and `writtenAt`. Candle receipt can be unknown
(`null`) while publication is recorded. Legacy REST `exchangeTimestamp` and some
asset timestamps were local sampling proxies, not independent exchange clocks.

Historical taker rows without receipt/publication evidence use an explicit one-minute
publication assumption. A flow remains in its original event window; delayed
delivery never moves old flow into a newer window. Known disjoint fragments in a
minute are summed, but coverage counts distinct event minutes. Genuine zero net
flow is different from an absent window. A zero sell denominator yields an unknown
ratio, not infinity. Large-trade/count fields are descriptive collector fields,
not a reconstructed trade-ID ledger; old omitted optional counters are not certified.

Point observations are compressed to their first eligible minute and selected
as-of; the tape is only valid for minute-aligned queries. Missing OI anchors stay
unknown. Source metadata reports availability and source age separately from
metric values. Support-reopen uses the actual configured freshness/sample gates;
there is no universal data-ready flag that permits every future strategy.

For books, require explicit non-truncation and acceptable resolution for each band.
Use exchange/receipt age, not repeated local sample writes, for freshness. Aggregated
book prices do not establish exact tradable best bid/ask, cancellation flow, or queue
priority. New asset receipts also preserve current and anchor age; old asset rows
without receipts remain weaker sampling-time proxies.

Native OI, marked-USD OI and mark-price returns are separate research outputs.
Funding magnitude is normalized only with an explicit interval; current live raw
sign/threshold policies are not silently redefined. HLP max-distributable snapshots
expire from the descriptive view after 30 minutes; they are not cash-flow records.
HL candles remain available raw, but this long execution replay uses Bybit candles.

## Local verification

Run from the repo in PowerShell:

```powershell
npx.cmd ts-node scripts/replay-causality-tests.ts
npx.cmd ts-node scripts/replay-current-stack-tests.ts
npx.cmd ts-node scripts/hl-data-quality-tests.ts
npx.cmd ts-node scripts/sr-support-reopen-tests.ts
npx.cmd ts-node scripts/sr-context-safety-tests.ts
npx.cmd tsc --noEmit --pretty false
npx.cmd tsc -p tsconfig.vps.json --noEmit --pretty false

$env:REPLAY_OUT = 'backtests/hype/current-stack-foundation-rerun'
node --max-old-space-size=6144 -r ts-node/register scripts/hype-replay-current-stack-validation.ts
Remove-Item Env:REPLAY_OUT
```

The acceptance runner is deliberately HYPE/current-config specific. Default cutoff
is September 4 19:01 UTC; the published-window control ends August 19 21:32 UTC.
It requires copied data, takes minutes and substantial RAM, and must not run on the
trading VPS. Do not sync/replace raw inputs during a run. A changed historical
control is an investigation failure, not permission to update expected totals.

Artifacts include source/config hashes, raw-file size/mtime, control verification,
input-quality diagnostics, decisions/fills, partials, monthly PnL, full-result
repeat hashes and a final acceptance record. Size/mtime is not a content hash of
all raw files; archive the actual inputs separately for durable reproducibility.

## Optional verified candle repair

The September 5 repair is for HYPE's eleven internal missing minutes through the
frozen September 4 19:01 UTC cutoff. It is **corrected exchange history**, not proof
of the original collector's receipt times. No interpolation or carry-forward is
allowed, and the 14-day S/R continuity requirement is unchanged.

The generator obtains each exact 1-minute candle, surrounding minutes, and its
native 5-minute exchange candle. Every complete five-minute OHLC/volume/turnover
aggregate and every available local neighbour must agree. Raw response bodies,
request URLs, retrieval timestamps, SHA-256 hashes and original archive content
hashes are retained. It is bounded to twenty missing minutes, uses request
timeouts, and refuses an existing output directory. Run locally, not on the VPS.

The saved bundle is already at
`backtests/hype/candle-repair-2026-09-05/repair.json`. Preserve it with the original
input snapshot in private backups; both remain excluded from Git. To obtain a
fresh evidence bundle for the same cutoff, select a new directory:

```powershell
$env:CANDLE_REPAIR_OUT = 'backtests/hype/candle-repair-fresh-evidence'
npx.cmd ts-node scripts/recover-candle-gaps.ts
Remove-Item Env:CANDLE_REPAIR_OUT
```

To replay the saved corrected history explicitly:

```powershell
npx.cmd ts-node scripts/replay-candle-repair-tests.ts
$env:REPLAY_CANDLE_REPAIR = 'backtests/hype/candle-repair-2026-09-05/repair.json'
$env:REPLAY_OUT = 'backtests/hype/current-stack-repaired-candles-rerun'
node --max-old-space-size=6144 -r ts-node/register scripts/hype-replay-current-stack-validation.ts
Remove-Item Env:REPLAY_CANDLE_REPAIR
Remove-Item Env:REPLAY_OUT
```

No repair is applied when the override is absent. Existing candles cannot be
overwritten, even with identical values. Repaired candles enter the requested
historical prefix only after their close. Exchange witness data outside that
prefix is used for validation, never passed to decision features. The runner
first reproduces the old control from the original archives, then rebuilds all
indicators from the corrected candles; it does not splice rows into existing
indicator arrays. It rechecks repair and original-candle content hashes and
requires zero remaining internal candle gaps before accepting a repaired run.

The saved bundle pins the exact raw archive bytes. After another data sync,
preserve/use the old snapshot for exact reproduction or create a newly verified
bundle for the new inputs; do not alter expected hashes to make a run pass.
Other raw pulse inputs retain the existing size/mtime checks, not full SHA-256
validation. Replay still does not reconstruct historical network outages,
exchange revisions or actual maker fills.

The [September 5 completed comparison](../../research/codex-astra-candle-gap-recovery-findings-2026-09-05.md)
records all four acceptance cases, 100% S/R candle coverage, and monthly changes
versus the original gapped causal baseline. Repair acceptance is not a profit
improvement requirement: verified history replaces missing data even where it
reduces modeled PnL.

## What remains before profit sign-off

Exact maker/account parity, actual fee/funding settlements, complete durable open
journals, 10-second decision/quote reconstruction and shared-account exposure are
not solved by these tests. Current historical data was already repeatedly mined:
it is development data, not a pristine holdout. Start HL/S/R work descriptively,
measure independent level encounters, freeze candidate definitions, and require
chronological plus forward validation before live promotion.
