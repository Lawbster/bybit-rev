# Failed-recovery discrimination (F01)

September 8, 2026. Local descriptive research only. No new exit rule, reduction,
execution change, config change, or live deployment.

## Purpose and evidence boundary

Distinguish deep ladders that subsequently recover from those that deteriorate
further, using information available at the observation time. This is the
failed-recovery checkpoint proposed in the September 8 live regroup, not a rerun
of last-rung entry vetoes or L09's component removal sweep.

Use the four **unchanged current B17** controls from L09:

- July 1, 2025 00:00 through August 19, 2026 21:32 UTC.
- May 17, 2026 20:43 through September 8, 2026 17:47 UTC.
- Each under `resting_touch` and `close_confirmed`, initialized flat with $32,000.
- $800 base, 1.35 scaling, maximum 11 retained rungs, all current policy gates
  and exits. Short entries remain outside this long-only model.
- Fees 0.055% per side, including the hypothetical closing-fee reserve in open
  marks. Actual maker fills, funding settlements, liquidation and shared-account
  effects are not modeled.

This pass **reuses** the accepted strategy paths. It verifies their pinned
digests against the prior controls and reconstructs cash, inventory, fees,
drawdown and monthly equity from raw prices and archived fills again. It does
not claim four freshly rerun strategy simulations or exact live parity. Inputs
must still match the original hashes; changed files require a new frozen refresh.

## Sampling and labels

The [frozen card](../../research-inputs/failed-recovery-2026-09-08.json) fixes:

1. First completed minute per episode when surviving inventory has at least
   nine retained rungs and gross inventory PnL is at most -3%; repeat separately
   at -5% as a sensitivity check. Apply only fills whose **bar index** has arrived.
2. Observe immediately and, separately, exactly 60 minutes later if the same
   episode is still deep. Earlier closes, lower depth and data-cutoff exclusions
   are explicit attrition, not silently missing cases. No repeated-minute samples.
3. Primary view: first -3%, plus 60 minutes. The later mark need not still be
   below -3%; excluding rebounds would remove the very recovery paths in question.
4. Attach final episode PnL, including all its partial exits, as a future label.
   Final open episodes remain censored. Features never consume these labels.
5. Also calculate final episode PnL minus its **known marked value at the
   landmark**, including already-realized partials. This remaining value change
   distinguishes further deterioration from recovery even when both finish red.

`subsequentDownside` sums negative remaining changes by magnitude;
`subsequentRecovery` sums positive ones. `diagnosticBalance = downside - recovery`.
Neither is a new strategy return. A positive balance does not model exit delay,
trim size, changed later entries, cooldown, released capital or replacement trades.
Lifetime losing dollars are not dollars that could all be saved at the landmark.

Threshold cohorts, landmarks, overlapping windows and TP models are correlated.
695 stored landmarks are **not 695 independent ladders**. Do not pool them into
a confidence interval or market-wide win probability.

## Frozen features and timing

- Completed-minute ROC15/60/240/720 and rolling 60-minute VWAP from actual summed
  turnover / base volume. This is not a forming-hour close or the prior study's
  hourly own-day VWAP. The exact source end is stored.
- Last 249 completed four-hour closes, EMA200 and EMA50 slope, following the
  canonical fetch-window convention. Independent math agrees with the library.
- HL15 and HL1h flow now and 15 minutes earlier; samples, ages, duplicate/invalid
  windows and original physical source lines retained.
- Native asset OI and marked-dollar OI changes over one/four hours, with current
  and anchor freshness. Falling marked OI alone may reflect a lower mark price.
- Book imbalance retained as descriptive context; no extra book warning was
  invented after inspecting outcomes.
- Shared S/R geometry from closed candle prefixes. Freeze nearest support at
  T-15 with its numeric price and confirmation touches. Test it against the last
  two **actual completed UTC five-minute bars**, not arbitrary minute closes.
  Break buffer is 0.1%; a retest reaches that boundary but closes below it.

Ten warning bins D1-D10 are specified in the card and implemented in
[failed-recovery-analysis.ts](../../scripts/failed-recovery-analysis.ts).
These are descriptive predicates, not 10 newly backtested trading strategies.
For conjunctions, any unknown required input makes the diagnostic unknown even
if another term is false; this conservative coverage accounting is intentional.

Historical receipt is not proven. Existing modeled taker publication is one
minute after the window end. Additional 15/60-second receipt delays are tested
without changing source-window endpoints or lowering sample floors. Missing
delayed inputs are unknown, never successful interventions.

The frozen retention screen asks for sample size, decline enrichment, positive
diagnostic balance in both recent models, chronological coverage, and arrival
robustness. It is **not** the economic net-PnL/DD/monthly promotion screen.
No economic candidate is qualified in a descriptive study.

## Reproduction

Use a fresh output folder; scripts refuse overwrite. Do not run on the VPS.

```powershell
npx ts-node scripts/failed-recovery-tests.ts
npx ts-node scripts/hype-failed-recovery-study.ts backtests/hype/failed-recovery-refresh
npx ts-node scripts/failed-recovery-check.ts backtests/hype/failed-recovery-refresh
npx ts-node scripts/failed-recovery-source-check.ts backtests/hype/failed-recovery-refresh
npx ts-node scripts/failed-recovery-report.ts backtests/hype/failed-recovery-refresh
```

Accepted output: `backtests/hype/hype-failed-recovery-2026-09-08/` (local/ignored).

| File | Use |
|---|---|
| `baseline.json`, `baseline-checks.json` | Full current metrics and archive/accounting checks |
| `observations.csv` | Small, one-row-per-landmark research join and future labels |
| `observations.json` | Full contexts, quality, zone evidence and delayed diagnostics |
| `source-evidence.jsonl` | Original raw source rows with file/line/timing identity |
| `attrition.json` | Every first-loss case removed from the later landmark and why |
| `groups.json`, `monthly.json` | All ten bins, both thresholds/checkpoints/models; unknown separate |
| `retention.json` | Exact frozen descriptive-screen failures, not deployment decisions |
| `manifest.json`, `validation.json` | Frozen inputs, source/protected hashes and study completion |
| `verification.json`, `source-verification.json`, `prefix-checks.json` | Selection/accounting/source-math/prefix checks |
| `tables.md` | Derived tables included in the authored findings |

The source checker independently recomputes availability, flow membership and
sums, plus native/marked OI arithmetic. The main checker re-derives first-loss
selection, inventory at the landmark, future-label values and grouped amounts.
Existing context/coverage/allocator tests remain important; these checks are not
a second independent full strategy implementation.

## Next boundary

If a mechanism earns a new action study, freeze one trim or hold rule and run
full occupancy, replacement-trade, fee/slippage, monthly and DD accounting.
Do not read this diagnostic's dollar balance as that replay. The completed F01
does not authorize such an action or broaden an unsupported signal family into
a live change.

[Findings](../../research/codex-astra-failed-recovery-findings-2026-09-08.md)
