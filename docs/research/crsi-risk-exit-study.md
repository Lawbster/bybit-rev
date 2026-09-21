# I03: bounded CRSI risk/exit follow-up

Research only. No live bot, ladder, shorts, config, exchange polling, HL or S/R
changes. This follows [I02](crsi-extremes-study.md), not a new broad entry sweep.
The [individual indicator register](../../research/INDICATOR-FINDINGS.md)
tracks what remains before indicator combinations.

## Frozen scope

The [study card](../../research-inputs/indicators/crsi-risk-exit-2026-09-06.json)
keeps two 15m CRSI long entries: crossing into <=5 and recovery back above 5.
Each is tested with seven separate exit policies:

| Policy | Exit; unchanged entry |
|---|---|
| baseline12h | Original 12h from actual fill; matched own-entry baseline |
| stop3 / stop5 / stop8 | Original timeout or a completed held 1m bar's low reaching 3% / 5% / 8% below entry |
| timeout6h | 6h from actual fill instead of 12h; no other exit |
| crsi50 / crsi80 | First subsequent completed 15m CRSI >=50 / >=80, or 12h timeout |

These are **14 definitions, 12 new**. Two windows and two execution delays
produce **56 cases: 48 variants and eight unchanged baselines**. No stop-plus-
indicator combination, TP, trailing exit, other entry threshold or post-result
parameter expansion is included. Earlier selected entries are mined evidence,
not an untouched holdout.

## Execution and accounting

The full window is July 1, 2025 00:00 to September 4, 2026 19:01 UTC. The
contained recent window begins May 17, 2026 20:43 UTC. Both retain the June 1,
2025 fixed indicator seed and explicit repaired minute overlay from I02.

Fixed $10k entry notional, $32k initial equity, one position per independent
rule, 0.055% fees each side on executed notional; no compounding. Funding is
excluded because the settlement archive is incomplete. The +5bps/side cost
stress is additional fixed-path turnover cost, not a liquidity simulation.

At minute start, execute due exits, then due entries. A new stop decision may
inspect only the **previous fully completed minute**, and only if the position
was already held at that minute's start. Execute at the current minute's open
for zero modeled delay, or next minute's open for +1m delay. Include adverse
exposure through the actual fill. **No perfect threshold fill is assumed.**
A wick can cause a later losing or profitable close after rebound; the loss can
exceed the threshold. This does not simulate standing exchange stop-market
orders, tick-by-tick software stops or certify liquidation survival.

If an exit is pending, later data cannot cancel or replace it. When eligible at
the same instant, observed stop takes priority over timeout, then completed
CRSI threshold. CRSI normalization must be observed strictly after actual entry,
even if the entry signal itself was already above the exit threshold. Timeout
is measured from fill, and its exit also receives the declared delay.

Entry crossings while occupied are ignored, not queued. A fresh crossing can
enter after an early close: the full strategy path is rerun, not just the old
trade cohort truncated. This allows both extra wins and extra losses.

## Comparisons and predeclared screens

Primary comparator is the **same CRSI entry with unchanged 12h exit**, not the
long ladder or the broad clock. Preserve pinned I02 rolling-long-clock and
buy-and-hold numbers as context. Rank by full/zero-delay own-baseline net delta.
Always report both windows/delays, W/L counts and dollars, open mark, fees,
adverse DD and month-by-month marked deltas alongside each baseline.

Profit screen: positive own-baseline delta in all four cases, no monthly
regression, positive net and cost stress, >=30 full/10 recent completed trades,
no equity exhaustion. Defensive screen: positive/sample/stress/solvency checks,
retain >=90% of each baseline net, no monthly regression worse than $500,
adverse DD no worse in all cases and at least 20% relative full-window DD
reduction in both delays. These descriptive screens were fixed before outcomes;
neither grants live approval or substitutes for new evidence.

## Reproduce safely

Prior I01/I02 sources, inputs and evidence hashes must still match. If a sync
changed the data, restore the private research snapshot or start a separately
defined refresh; never weaken pinned assertions to make new data pass.

```bash
npx ts-node scripts/crsi-risk-exit-tests.ts
npx ts-node scripts/hype-crsi-risk-exit-study.ts
npx ts-node scripts/crsi-risk-exit-results-check.ts backtests/hype/hype-crsi-risk-exit-2026-09-06
```

The runner refuses an existing output directory. Use `--out backtests/...`
with a fresh path for an explicitly justified rerun. It asserts all eight
unchanged baselines against the old engine and saved I02 ledgers, months and
stats **before** variants. Prior scripts remain unedited so old provenance
continues to verify.

Artifacts: pinned manifest/card, results/summary, monthly JSON/CSV, complete
trade ledger, I02 overlap parity, first-trade causal traces, clock/buy-hold
context, ranked screens and validation. The independent verifier recomputes
CRSI, checks every eligible entry and exit from the minute tape, and rebuilds
accounting/drawdowns rather than accepting the engine's assertions alone.
Its `verification.json` is required before accepting findings. Generated
evidence stays local; retain a private immutable copy with the raw inputs.

After this bounded pass, record CRSI's strengths and limitations, then move
to RSI's individual study. Do not keep tuning CRSI or jump to HL/S/R mixes
while the other families' agreed individual coverage remains incomplete.
