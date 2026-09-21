# Genuine price-drop add confirmation

Completed [findings and monthly comparisons](../../research/codex-astra-ladder-drop-pulse-findings-2026-09-05.md).

September 5, 2026. Local full-path research; no live changes. Follow-up to the
[exposure-control pass](ladder-exposure-controls.md), whose pulse rules only
filtered timer adds. This pass explicitly targets genuine price-drop adds.

## Frozen scope

[Definition](../../research-inputs/sr-pulse-encounters/ladder-drop-pulse-2026-09-05.json):
six families at next depth 11 and >=9, twelve variants. No EMA condition:
the preceding outcome-conditioned diagnostic found forced ladders often first
reached rung 11 while still above EMA200. It did not establish predictive skill.

| Family | Required pulse / veto |
|---|---|
| `drop_sell15` | Veto taker15m <=0.85 |
| `drop_sell_either` | Veto taker15m <=0.85 OR taker1h <=0.9 |
| `drop_confirm15` | Require taker15m >=1.0 |
| `drop_confirm_both` | Require taker15m >=1.2 AND taker1h >=1.0 |
| `drop_sr_sell15` | Near resistance only: veto taker15m <=0.85 |
| `drop_sr_confirm` | Near resistance only: require taker15m >=1.2 AND taker1h >=1.0 AND ret15m >0 |

Near resistance means 0-0.3% below the replay engine's actual confirmed zone,
with healthy S/R coverage. The fixed neutral ratio 1.0 and existing 0.85/0.9/1.2
levels are declared before results, not selected by testing nearby thresholds.
Required windows need >=14/55 minute samples and latest source age 0-90 seconds.
Both windows must be known for a two-window predicate. Unknown data leaves this
research overlay inactive, with counts; it does not select live missing-data policy.

The predicate is evaluated after all original gates/affordability, before an
order is queued. It affects genuine price-drop adds even if their timer is also
due. A later timer-only opportunity is unchanged. There is **no persistent
latch**: first-veto/release diagnostics expose this escape path rather than
assuming pulse remains authoritative after price rebounds. No exit, sizing,
partial, funding, short or production-code change.

## Evidence contract

Same two overlapping windows, two TP assumptions, four archived baseline digests,
$32k starting equity, $800x1.35 sizing and 0.055% per-side fees as the prior pass.
The engine and all prior exposure-study sources are pinned unchanged. Reuse the
existing optional veto callback and episode/monthly metrics. The old original
engine hash and newer pinned hook hash are both recorded; no new seam is added.

Match all four complete baseline digests before accepting variants. Count actual
full-path net PnL including final open inventory, gross losses/wins, DD, worst
episodes, forced closes, TP cycles and monthly deltas. Report the same predeclared
profit-upgrade and defensive-trade-off screens as the prior study, including
>=20 vetoed episodes per HL TP model. Those screens are research triage, not
mathematical proof of optimum or permission to deploy. Show strong risk reduction
even when its profit opportunity cost fails a screen. All top-five monthly
comparisons are required; no post-result tuning or extra families.

The historical pulse tape uses explicit receipt times where available and a
modeled one-minute publication lag otherwise. It cannot reconstruct unrecorded
collector delays. Pre-HL time cannot validate flow rules. These are previously
examined development windows, not independent or untouched holdouts. Exact maker
fills/queues/fees, actual funding, lot rounding, ten-second live timing and
liquidation remain outside the model. Fresh forward validation remains required.

## Reproduce locally

```powershell
npx.cmd ts-node scripts/ladder-drop-pulse-tests.ts
$env:DROP_PULSE_OUT = 'backtests/hype/ladder-drop-pulse-rerun'
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-drop-pulse-study.ts
Remove-Item Env:DROP_PULSE_OUT
```

Requires preserved private inputs/repair and previous manifests. Use a new output
directory; do not sync inputs while running. No VPS execution. Outputs retain
input/source fingerprints, all four baselines, 48 variant cases, monthly/ranking
tables, executions, close/partial ledgers and deduplicated first-veto/releases.

After completion, run the read-only artifact verifier:

```powershell
npx.cmd ts-node scripts/ladder-drop-pulse-results-check.ts backtests/hype/ladder-drop-pulse-rerun
```

It compares baseline metrics/digests to the prior accepted run, reconciles all
monthly/episode PnL, re-evaluates every saved first veto and release, checks their
actual following execution, recomputes rankings and rehashes inputs/sources.
