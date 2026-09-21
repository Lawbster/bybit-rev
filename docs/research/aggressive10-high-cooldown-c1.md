# AG10-C1: cooldown after two-day-high exits only

Frozen September 11, 2026. Research-only; no live deployment or configuration change.

## Exact experiment

[Card](../../research-inputs/aggressive10-cooldown-2026-09-11.json).
Three controls: B17 current replay baseline, guarded10h, unchanged aggressive10h.
Two variants on aggressive10h: **1h** or **2h** cooldown after the actual fill of
the exact full-close reason `research_exit:exit_2d_1pct`.

The inherited deadline is `(floor(fillAt / 4h) + 2) * 4h`: between4h and8h
after fill, not a fixed4h delay. New deadlines are `fillAt + 1h/2h`.
No same-fill-bar reentry; entry decisions at or after expiry retain next-open
execution and every ordinary entry gate. TP/hot-RSI, funding spike, hard
flatten, emergency, partial and other-research cooldown paths stay intact.
Neither failed AG10-E1 selective guard is included. No zero-cooldown variant.

## Periods and execution

- Older: 2025-07-01 00:00 through2026-08-19 21:32 UTC.
- Recent: 2026-05-17 20:43 through2026-09-10 05:08 UTC.
- Independent flat$32,000 starts; $800 x1.35 maximum11.
- Unchanged0.055% each-side fees, no modeled maker savings or funding cashflow.
- Resting-touch and close-confirmed TP paths; overlapping mined windows,
  not independent samples, execution bounds or holdouts.
- Extra60s delays only the rolling-high reference, not current prices, gates,
  cooldown duration or fills. No network/queue simulation claim.

Run12 exact archived L15 controls before8 primary variant cases; then6 recent
source60 cases (parent+two variants x two TP models). **26 runs,2 definitions.**

## Preservation and verification

Original replay engine and high-rule auditor remain byte-unchanged. Study-local
derivatives contain the exact narrow change plus read-only cooldown telemetry.
`aggressive10-cooldown-source.ts` asserts their full source equals the archived
source with only declared unique replacements. No divergence/refactor permitted.
12 controls must reproduce complete archived digests and metrics.

The inherited source proof verifies original byte prefixes and unchanged code;
synced tails must all be beyond cutoff. Current complete files and runtime-state
protection hashes are separately pinned. No runtime state seeds historical runs.

Independent verification reconstructs every full-close cooldown, causal RSI
source prefix, raw target/high opportunity, entry deadline, fill, position,
fee/equity/month, and changed-path accounting. Unit tests cover absent-option
parity,1h/2h boundaries, same-bar prohibition, retained outer gates, partials,
ordinary TP/hard/emergency/other reasons, completed prefixes and invalid options.

## Frozen acceptance and attribution

Original B17 screen: recent net delta >=$1,000 each model, older >=0, no DD
increase, every monthly delta >=-$250, no modeled nonpositive equity, >=20
recent genuinely earlier reopens each model.

Separate incremental screen versus aggressive parent: positive recent net,
nonnegative older net, no DD increase, monthly delta >=-$250, >=20 early
reopens per recent model and no modeled nonpositive equity.

An intervention is a first-rung entry after a high exit whose decision occurs
before that same path's inherited deadline. Merely changing a deadline when
trend/latch still blocks does not count. Record high exits, changed deadlines,
early reopens, W/L dollars of subsequent completed ladders and censored outcomes.
These cohorts are descriptive, not marginal PnL caused by shorter cooldowns.

Report five setups, exact dates, net/DD/WL/winning and losing dollars, all
monthly deltas, TP/other full closes, and matched/removed/replacement/end
inventory contribution. Account for additional winning cycles and extra losses.
No post-result tuning or relaxed screen. Future source60 repetitions are not
extra definitions. Prior count158 ladder overlays becomes160 when completed;
5,261 standalone and separate L09 component profiles unchanged.

```powershell
npx ts-node scripts/aggressive10-cooldown-tests.ts
npx ts-node scripts/hype-aggressive10-cooldown-study.ts plan research-inputs/aggressive10-cooldown-2026-09-11.json
npx ts-node scripts/hype-aggressive10-cooldown-study.ts run KEY
npx ts-node scripts/aggressive10-cooldown-verify.ts KEY
npm run research:workflow -- verify KEY
```

Use this explicit runner, not generic workflow run. Never overwrite accepted
run/verification receipts. No production, config, strategy-threshold, commit
or push action follows from completing a research run.

## Completed checkpoint

[Findings](../../research/codex-astra-aggressive10-cooldown-findings-2026-09-11.md).
Accepted run:
`3d8d666c0ecd318536c39ee9bd3d9547a1f9c12956eff22d6d8077c701b63917`.
All26 runs complete;12 controls exact; independent source, accounting,
cooldown/entry checks and artifact integrity pass. Both shorter waits lose
parent net in all four comparisons. All six source60 results unchanged.
Retain inherited4-8h high-exit cooldown. No live change or new lead definition.
