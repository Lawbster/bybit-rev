# FR01: selling acceleration versus price response

Frozen September 14, 2026. Local research only; no trading or configuration change.

## Question and exclusions

Does reducing an otherwise-approved deep add when HL selling accelerates help
Aggressive10, and does requiring concurrent price weakness preserve recoveries?
This uses recorded minute aggregates, **not a fitted event-level Hawkes model**.
Nonnegative Bybit returns during heavy HL selling are called
*absorption-compatible*, not evidence proving passive absorption.

Do not repeat the already-tested L08 conditional rung-11 half sizes, L10 ATR
spacing/recycle budgets, AG10-D1 ratio/book descriptors, AG10-E1 timer guards or
RR01/RR02 relative-return comparisons. Whole-ladder dollar-risk sizing and
formal equilibrium stability remain separate questions. No agent framework,
dependency, collector, live shadow or execution owner is added here.

## Frozen rules

[Study card](../../research-inputs/flow-response-fr01-2026-09-14.json).
Same $800 x1.35 maximum11 parent; only approved, affordable next depths8-11.

Selling acceleration requires BOTH:

- Recent15m sell notional / total traded notional >=60%.
- Recent15m mean sell notional/minute >=1.5x preceding45m mean.

Prior sell notional must be positive. Price impact means Bybit close-to-close
return <=-0.20% over the same15m window.

| Variant | Additional evidence | Action on the requested add |
|---|---|---|
| acceleration_half | Acceleration | Half size |
| impact_half | Acceleration AND price impact | Half size |
| acceleration_block | Acceleration | Temporarily veto |
| impact_block | Acceleration AND price impact | Temporarily veto |

Both timer and genuine price-drop adds are in scope. Half size consumes the
rung; no deferred remainder or automatic doubling later. A veto leaves the
add clock unchanged and is reconsidered normally. Other entry gates and all
exits remain authoritative. Unknown evidence imposes no **new** restraint; it
does not bypass the parent gates or count as absorption. No new entries are
made eligible merely by lowering their cost.

## Timing and evidence

At decision D, feature lag L=0 or60s, asOf=D-L, endpoint T=asOf-60s.
Require exactly one valid eligible bucket for each of60 consecutive minute
endings through T. Price references end at T and T-15m, never after asOf.

Retain receipt/observed/written/ingested/explicit-available times and the
existing minute decision ceiling. Receiptless HL data has modeled end+60s
publication, not historically proven arrival. An additional60s feature delay
tests this assumption, not the full distribution of exchange/network latency.
Future duplicate corrections cannot poison earlier decisions. Duplicate
eligible windows, gaps, invalid counts/notionals/trade times and explicit
partial markers produce unknown. Unparseable JSON aborts the run.

## Comparators and accounting

- Older: July1,2025 00:00-Aug19,2026 21:32 UTC.
- Recent: May17,2026 20:43-Sep10,2026 05:08 UTC.
- Flat $32,000 start per window; not a replay of the live carry-in ladder.
- Unchanged B17 and Aggressive10 controls in each window and TP model.
- Resting-touch and close-confirmed TP; model sensitivities, not independent
  samples or guaranteed execution bounds. New add decisions fill next open.
- Fees0.055% each side. Actual maker fills/queues, funding cashflows and
  maintenance-margin/liquidation certification are excluded. Extra5bps cost
  figures are fixed-path arithmetic, not a new fee-sensitive replay.
- Windows overlap and have been researched before. They are **not holdouts**.
  Sep10+ is excluded, including the known Sep12 data gap.

Run8 exact archived control digests/metrics before16 primary variant cases,
then8 recent additional60s feature-delay cases: **32 runs, four definitions**.
The feature delay does not change the parent's48h-high, TP or outer-gate clocks.

## Gates and validation

Apply separately versus B17 and Aggressive10: recent net delta >=$1,000,
older >=0, no worse DD, each monthly MTM delta >=-$250, at least20 recent
intervened episodes, no modeled nonpositive equity. Additional60s cases must
keep positive net and meet the same DD/monthly/evidence checks. These are
research screens, not permission to deploy. Forward evidence remains necessary.

Pin current data and sources; protect live config/state files before and after.
Archive-to-current peripheral differences are recorded separately. Exact
controls bridge the updated data tails/runtime configuration; core replay,
market/SR, target-policy and research-indicator sources must retain archived
hashes. No accepted run is overwritten.

Tests cover source arithmetic, missing/duplicate/invalid/late data, future
poisoning and prefix invariance, actual engine no-op parity, half/block sizing,
reconsideration, retained emergency/TP/outer gates and a separate fee ledger.
The checker independently reads raw HL rows and reconstructs signal windows,
checks every add against pre-decision inventory and its fill, checks every
TP/high-exit opportunity, and reconstructs fee/PnL/DD/months. It shares the
canonical historical price loader; it is not a second vendor's price record.

Report every variant with adjacent baselines, W/L and win/loss dollars,
average loss, net/realized/open PnL, DD, intervention/unknown counts, every
month, and common/removed/replacement ladder attribution. First-acceleration
cohorts on the unchanged parent are descriptive, not estimated money saved.

```powershell
npx ts-node scripts/flow-response-tests.ts
npx ts-node scripts/flow-response-study.ts plan
npx ts-node scripts/flow-response-study.ts run KEY
npx ts-node scripts/flow-response-verify.ts KEY
npx ts-node scripts/flow-response-report.ts KEY
```

Keep input files unchanged throughout a run. Each immutable job stores engine
results, inventories, all add decisions/source line IDs, target arms, high
decisions, monthly results, comparisons and hashes. The separate verification
receipt is required before the post-verification analysis is generated.
