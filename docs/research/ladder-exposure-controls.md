# Ladder exposure-control replay

Completed [findings and monthly comparisons](../../research/codex-astra-ladder-exposure-controls-findings-2026-09-05.md).

September 5, 2026. Local research only. The user explicitly requested full-path
deep-add/rung-11 counterfactuals after attribution alone could not answer whether
less exposure improves the ladder. The prior wait-price screen is not treated as
proof that skipping exposure cannot help.

## Frozen intervention

Definition: `research-inputs/sr-pulse-encounters/ladder-exposure-controls-2026-09-05.json`.
Seventeen variants: cap at ten as a control, plus eight families at next depth
11 or >=9. No threshold search or after-results combination selection.

| Family | Veto an otherwise permitted add when... |
|---|---|
| `cap10` | Next depth is 11; applies to timer and drop adds |
| `drop_only` | Timer-only add at the selected depth; retain original drop trigger |
| `sr_timer` | Timer-only, within 0.3% below confirmed resistance |
| `sr_all` | Within 0.3% below resistance, including genuine drop adds |
| `weak_timer` | Timer-only in weak context |
| `sr_weak_timer` | Timer-only, near resistance and weak context |
| `sr_sell_timer` | Timer-only, near resistance and taker15m <=0.85 |
| `sr_weak_sell_timer` | Timer-only, near resistance, weak context and taker15m <=0.85 |
| `sr_confirm_timer` | Timer-only, near resistance without all three: taker15m >=1.2, taker1h >=1, ret15m >0 |

Weak context means the canonical completed-4h close is not above EMA200 OR
closed-minute trailing 12h return <=-2%. It is not the existing AND trend-break
filter and not a month retrospectively classified as bearish. Resistance is the
nearest existing zone above decision price from the engine's exact context.

Required pulse samples/freshness: 15m >=14 observed minutes, 1h >=55, age <=90s.
Unknown required inputs make the experimental overlay inactive and are counted.
No fabricated pre-HL signals, neutral imputation or universal data-ready flag.
Price-only rules run throughout the longer history; pulse rules cannot be
validated in portions without that stream. This does not select a production
fail-open/fail-closed missing-data policy.

## Engine seam and invariants

Only `scripts/replay-causal-engine.ts` changes, through optional
`researchAddVeto`. The callback runs after every existing entry gate, support
reopen and affordability check, before queuing the next-open order. It receives
an immutable scalar record of already-available data, not mutable inventory or
future candles. It can only veto. There is no production call site/config change.

Blocked adds create no pending order and do not reset the timer. Existing
inventory, exits, partial selection, support reopens, cooldowns and sizing remain
unchanged. At a later closed-minute decision, the original gates and experimental
predicate run again. A released add fills only at the following open. The
resistance map may legitimately evolve as newly closed data arrives; no historical
zone is chosen from future price action.

All four archived repaired-baseline digests must reproduce exactly with the hook
returning false. Original source hashes must match except for the documented
engine seam, whose original and current hashes are recorded. Unit tests compare
no hook versus inactive hook, ten-rung cap versus veto, causal release, active
TP/emergency exits, immutable/prefix inputs and authoritative outer gates.

## Full-path evaluation

Run all 17 variants under both TP assumptions in both accepted windows. Primary
comparison is May 17-September 4 HL history; longer control starts July 1, 2025
and ends August 19, 2026. These overlapping cases are not independent holdouts.

Preserve the current $800 / 1.35 / 11-rung sizing, $32,000 modeled initial equity,
and 0.055% entry/exit fees. Exact maker fills, funding cash settlements, lot
rounding, live ten-second timing and liquidation remain outside this model.

Measure total net PnL including marked-open inventory, adverse-path maximum DD,
minimum equity, losing-episode gross losses, profitable-episode gross wins,
profit factor, worst/worst-five episodes, forced closes, TP cycles and partials.
Episode PnL includes its earlier partials; an unfinished episode's partial cash
PnL is reported separately rather than called a completed win.

Monthly tables report both realized and mark-to-market PnL/deltas. MTM monthly
changes sum exactly to the final total, avoiding an apparent gain from pushing a
loss across month end. Intervention counts are minutes and distinct episodes,
not independent signal counts. First veto per episode/depth is retained with
decision context. Exact-entry episode comparisons illustrate outcome changes;
unmatched episodes reflect changed paths, not necessarily lost or extra TPs.

Two predeclared research screens:

- Profit upgrade: in both HL TP models, >=$1,000 net lift, >=10% gross-loss
  reduction, no DD deterioration; no net loss versus published controls and no
  month worse by more than $250 MTM in any case.
- Defensive trade-off: in both HL models, >=20% gross-loss reduction and >=3pp
  DD reduction; retain >=90% of baseline total profit in every case, no published
  DD deterioration beyond 0.5pp, no month worse by more than $500 MTM.

Both need >=20 vetoed episodes in each HL model. These are report thresholds,
not permission to accept a 10% live profit sacrifice. Report all results and
trade-offs, including near misses; do not hide a strong risk reduction because
it fails the profit-upgrade screen. Neither screen establishes an optimum or
replaces 30-60 days of fresh forward validation. Existing history is development
data, and multiple-tested apparent improvements can still be noise.

## Run locally

```powershell
npx.cmd ts-node scripts/ladder-exposure-tests.ts
$env:EXPOSURE_OUT = 'backtests/hype/exposure-controls-rerun'
node --max-old-space-size=8192 -r ts-node/register scripts/hype-ladder-exposure-study.ts
Remove-Item Env:EXPOSURE_OUT
```

Requires the preserved private raw snapshot and repaired candle bundle. Do not
sync inputs during the run. Uses a new output directory, hashes inputs/sources
before and after, and does not overwrite older results. Building indicators and
72 full replays can take substantial time/RAM: never run on the trading VPS.

Outputs: `manifest.json`, `baseline.json`, `results.json`, `summary.csv`,
`monthly.csv`, `ranking.json/csv`, `validation.json`, and each case's close,
partial, execution and first-veto ledgers. Generated artifacts remain ignored.
