# F06: conditional soft-stale TP

Research only. Frozen September 10, 2026, before economic runs. No live configuration,
positions, short settings or deployment changes. This is separate from failed F05
half-exit refinements and from the subsequent exposure-construction experiment.

## Question and exact baseline

Can selectively retaining the ordinary 1.4% target improve the current ladder's
trade-off versus reducing it to 0.5%? B17 is the unchanged, current-stack causal
minute replay, including repaired candles, transactional S/R partial clocks,
damaged-regime latch and ordinary add/exit gates. It is not the old biased $60k
baseline, a bare martingale, or an exact maker/exchange simulator.

Actual soft-stale eligibility requires both oldest remaining rung age >=4 hours
and current gross inventory PnL <0.5%. It is not merely a four-hour timer. Ordinary
TP re-arming can restore the normal percentage when that predicate no longer
holds. F06 does not covertly replace this with a permanently reduced target.

## Four frozen new definitions

All variants may defer the ordinary reduction until at most eight hours of actual
oldest remaining rung age. No thresholds were chosen after viewing these runs.

| Variant | Permission to retain the normal target |
|---|---|
| `structure8` | Completed 4h close >=EMA200 and EMA50 >=previous EMA50. Exact canonical rolling249-bar EMA convention. |
| `vwap_roc8` | Completed hourly close >UTC-day VWAP and hourly ROC5 >0. Complete source/day prefix required. |
| `resistance_room8` | Healthy14d current30m S/R coverage and a known nearest resistance at least0.1% above the normal batch target. |
| `age8` | Unconditional later-age control, without any context requirement. |

First actual soft-stale eligibility either grants permission or permanently refuses
it for that episode. During an extension, the first failed/unknown context or
eight-hour age limit relinquishes it permanently. After release, the **ordinary**
soft-stale predicate resumes; no additional filters or forced half-sale are added.
An S/R trim preserves the ordinary remaining inventory, average, oldest rung and
last-add clock. It cannot reset an already released permission.

Unknown resistance does not mean unlimited room. No present quote, future pivot,
forming indicator bar or eventual recovery label supplies a historical decision.

## Comparisons and clocks

- Exact archived B17 and `minus_soft_stale` controls: four cases each.
- Four new policies x two windows x two TP models x three sensitivities:48 cases.
- Total56 cases, four new definitions; controls/repeated sensitivities are not
  counted as new strategies.
- Published window: July1,2025 through August19,2026 21:32 UTC.
- Recent HL window: May17,2026 20:43 through September8,2026 17:47 UTC.
- Each starts flat at $32,000. Fees unchanged at0.055% each side. Include final
  open inventory and all replacement/re-entry occupancy.
- Models: prior-armed `resting_touch`, and `close_confirmed` then next-open fills.
- Sensitivities: primary; source availability +60s; release of an **already
  active** extension +60s. The latter is not a claim to model all API delays.
  Initial refusal and hard/emergency exits are not delayed.
- Target decisions happen after the minute closes. A new lower target cannot
  consume that same minute's earlier high.

## Reproducibility and checks

Frozen card: [conditional-soft-stale-2026-09-10.json](../../research-inputs/conditional-soft-stale-2026-09-10.json).
Pre-F06 source is byte-preserved under `research-inputs/reproducibility/`; the
engine addition is opt-in target deferral/observation only. The runner verifies
all eight archived economic digests before testing variants and hashes inputs,
sources and protected live files before/after. Previous archive pins are not
rewritten to hide the new engine bytes.

```powershell
npx ts-node scripts/conditional-soft-stale-tests.ts
npx ts-node scripts/conditional-soft-stale-audit-tests.ts
npx ts-node scripts/hype-conditional-soft-stale-study.ts
npx ts-node scripts/conditional-soft-stale-check.ts
```

Runner and checker require fresh output/verification; they do not overwrite an
accepted archive. Default output: `backtests/hype/hype-conditional-soft-stale-2026-09-10/`.
The checker independently recomputes hourly VWAP/ROC and4h EMA from raw repaired
candles, checks recorded context and S/R prefix invariance, target/fill chronology,
inventory, fees, monthly PnL, drawdown and matched/replacement attribution.
An additional independent state machine reconstructs every minute's opportunity,
first eligibility and first release without importing the F06 controller. The
verifier uses execution-bar index for inventory: next-open fills share the
previous close's epoch timestamp but are a later execution phase. Regression
fixtures reject that ordering mistake and incorrect target percentages/prices.
`--partial` runs a read-only diagnostic of finished cases while a batch runs; it
never writes an accepted verification artifact.

One incomplete implementation attempt is preserved at
`backtests/hype/hype-conditional-soft-stale-2026-09-10-invalidated-buffer-lookup/`.
Its20 completed paths are not accepted F06 evidence: the resistance branch used
the live proximity helper's1% cutoff instead of the nearest zone from all
confirmed levels. The fix restores the frozen card's definition, without changing
thresholds or zone geometry; a beyond-buffer regression was added. The entire
final run, including eight controls, restarts fresh. Preliminary non-S/R outcomes
had been viewed; no holdout claim is made.

Screen remains recent +$1,000 in **both** models, nonnegative published delta,
no drawdown increase, and no month worse than baseline by more than$250, with no
modeled zero-equity episode. Report failures without redefining the bar.

These overlapping, previously examined windows are not an independent holdout.
There is no funding settlement, maker queue, liquidation, or shared-account short
certificate. Any eventual candidate still requires forward observation and a
separate implementation/operational review.

## Next separate checkpoint

After F06, return to the roadmap's exposure-construction branch: avoid creating
unwanted deep exposure instead of adding more conditions to losing half-exits.
Freeze that branch and compare against unchanged B17; do not combine an F06
target rule with exposure changes in its first attribution pass.
