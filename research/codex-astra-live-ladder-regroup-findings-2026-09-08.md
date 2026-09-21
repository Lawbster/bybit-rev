# HYPE regroup: live exposure, tested coverage, and next research

September 8, 2026. Local analysis only. No live config, strategy, state, orders,
processes, deployment, commit or push changed.

## TL;DR

- **The current 11-rung ladder is operationally consistent but carries material
  open risk.** At September 8 17:48 UTC: 673.88 HYPE, $59,756 entry cost, average
  $88.6746, bid $83.86, gross unrealized **−$3,244 /−5.43%**. Recorded prices
  previously reached approximately **−8.14%**. The trend-qualified hard flatten
  is not eligible. Copied snapshots are not a fresh exchange audit.
- **Distinguish old losses from the current policy period.** Last 60 days:
  long journal **−$4,223**, short receipts **−$3,891**. Since August 14 latch
  deployment: long journal **+$10,776**, shorts **−$3,770**, before the current
  open long loss. Since short entries paused: six positive batch closes and
  three partials booked **+$1,084**. Before/after is not causal patch uplift.
- **45 ladder /5,261 standalone definitions have been tested, not every possible
  configuration.** Only 11 ladder definitions have corrected partial-clock
  results. No complete ladder qualifier. This pass adds **zero strategies**,
  independently checking 349 overlapping deep-drawdown observations from four
  archived baselines. Prioritize conditional sizing and failed-recovery
  discrimination, not another broad indicator grid.

## 1. Latest live evidence

Primary sources: `bot-state.json`, `bot-config.json`, runtime health, decisions,
S/R shadows, copied PM2 logs, and long/partial/short journals. All times UTC.

| Observation | Value |
|---|---:|
| Runtime snapshot | September 8 17:48:05.592 |
| State update | September 8 17:47:54.917 |
| Ladder start | September 6 12:56:24.402 |
| Rung 11 decision | September 6 15:35:28.368 |
| Time to full depth /current age | 2h 39m /52.86h |
| Entry cost /quantity | $59,756.06 /673.88 HYPE |
| Average entry /bid | $88.674626 /$83.86 |
| Gross unrealized | −$3,244.48 /−5.43% |
| Maker limit /quantity | $89.12 /673.88 |
| Rebound needed to maker limit | Approximately 6.27% |
| Post-full-depth recorded high | $88.95, September 6 15:39 minute; +0.31% versus average |
| Post-full-depth recorded low | $81.46, September 8 13:42 minute; −8.14% versus average |

No pending transaction/recovery. Maker owner active/`New`, zero applied quantity,
no recorded touch. Reconciliation matches 673.88, with ~1.14e−13 arithmetic noise.
S/R coverage is healthy: 4,032/4,032 closed 5m bars. The copied watchdog lifecycle
has no active incidents. Short owner is healthy, flat, **entryEnabled=false**;
it is not hedging this ladder.

The $89.12 target was armed September 6 16:56. The earlier $88.95 high did not
reach that target or the then-higher target. Minute highs/lows are price-path
evidence, not exact bid/mark execution evidence.

Two limitations worth retaining:

- `getKline` rate-limit errors occurred September 7 12:00:11 and September 8
  04:00:18. Normal loop output resumes by 12:01:04 and 04:00:50. Those attempts
  were interrupted; no persistent crash/recovery is evident. This does not
  establish that every intraminute exit opportunity was evaluated.
- The inactive damaged-latch `last4hTimestamp` is old by design: outside its
  trigger region the evaluator returns persisted state unchanged. It is not
  the current trend quote. `lastTrendCheck` is fresh and says trend OK.

See [exact gate map](../docs/research/current-live-hype-ladder-map-2026-09-07.md)
and [main caller](../src/bot/index.ts). No remediation was performed.

## 2. Why it accumulated and why it remains open

This is a local reversal after a strong rise while the slow trend remains
positive. Completed 4h close **$83.94 is 16.45% above EMA200 $72.0801**; the
recent high was $89.61. Above EMA200 does not mean healthy short-term price action.

| Rung | September 6 decision | Fill | Cost | Existing trigger | HL15 /HL1h |
|---|---|---:|---:|---|---:|
| 9 | 15:02:27 | $88.57 | $8,826.89 | Timer-only | 1.594 /1.024 |
| 10 | 15:32:38 | $88.87 | $11,914.80 | Timer-only | 0.956 /1.455 |
| 11 | 15:35:28 | $88.62 | $16,084.53 | Price drop | 0.406 /1.532 |

These three orders represent **61.6% of entry cost** and approximately **$2,005
of current gross loss**. This is static attribution, not profit from removing them.

Rung 11 used decision quote $88.59, below $88.87×0.997=$88.60339. Its later
$88.62 execution does not retroactively invalidate the price-drop trigger.
The retained positions match successful transaction receipts/decision times;
there is no evidence here of duplicate rungs.

HL15 had 15 samples, HL1h 60, source age 28.4 seconds. Selling15 was real,
but one-hour flow remained buy-dominant, narrow-book imbalance was +0.189 and
marked asset OI1h +0.118%. All three funding inputs were nonnegative. The
funding-stress time-add restriction did not apply; price-drop adds are also
exempt from that restriction. Support-reopen was not used.

**Exact S/R at those last three decisions is not certified by this audit.**
Decision echoes omit zones, and no preceding S/R shadow within five minutes
exists for rungs 9–11. The surviving 14:32:20 shadow before rung 8 has no
resistance above its price and no qualifying partial. A level displayed later
must not be treated as available earlier. Known-time reconstruction remains
a separate check rather than an invented assertion that these were resistance buys.

The configured exit behavior explains the hold:

- Hard flatten needs age≥12h AND gross PnL≤−2% **AND hostile 4h trend**. The
  trend term is false. Age alone is not a timeout exit.
- Emergency needs gross PnL≤−14%; neither current nor recorded worst price met it.
  Unchanged inventory would reach that arithmetic threshold around **$76.26 /
  −$8,366 gross loss**. This is an observed-loop trigger, not a guaranteed fill
  or liquidation calculation. Other exits or changed indicators may act earlier.
- Live S/R partial needs whole-ladder profit≥+0.25%, proximity, deteriorating
  context and profitable reductions. It is not a loss-trimming rule.
- Soft-stale changes TP to +0.5%; it does not trail below entry or close a loser.
- Max depth already prevents adds. `Gates: all clear` is not a full per-add-gate
  audit while 11/11 makes an add ineligible.

Entry cost is approximately **2.43× current marked account equity**. Fixed-dollar
sizing consumes a larger equity fraction after losses. The −5.43% inventory-price
loss must not be multiplied by 25 and called an account return.

## 3. Actual accounting, with open risk kept separate

All periods end September 8 17:48 UTC and overlap: **do not add their totals**.
W/L counts `BATCH_CLOSE` rows, not partials or reconstructed flat-to-flat cycles.
Partials are separate cash realizations. Carry-in ladders make these exit-time
cohorts, not controlled before/after config comparisons. Fees are already in PnL.

| Period start /context | Batch W/L | Winning batch $ | Losing batch $ | S/R partial n /$ | Long realized $ | Short realized $ |
|---|---:|---:|---:|---:|---:|---:|
| July 10 17:48 /last60d, mixed policies | 77/9 | +12,219.54 | −18,787.90 | 26 /+2,345.02 | **−4,223.34** | −3,891.07 |
| August 14 18:40 /latch onward | 59/1 | +9,890.75 | −171.28 | 11 /+1,056.63 | **+10,776.10** | −3,770.05 |
| August 31 23:15 /stable maker onward | 14/0 | +2,578.48 | 0 | 7 /+786.47 | **+3,364.95** | −1,664.45 |
| September 4 00:24 /short entries paused | 6/0 | +761.72 | 0 | 3 /+322.37 | **+1,084.09** | 0 |

The **−$3,244 open mark is excluded** from realized columns. Since maker activation,
+$3,365 realized long PnL is almost offset by the current gross mark. That is an
illustration, not exact period return: opening inventory marks, funding and fee
timing matter. Available equity-log endpoints since short pause change **−$2,272.13**.

| UTC month within last60d | Batch net | Partial net | Combined long journal | Short net |
|---|---:|---:|---:|---:|
| July 10 onward, partial | −11,179.13 | +610.30 | **−10,568.83** | +371.19 |
| August | +2,032.29 | +948.25 | **+2,980.54** | −2,597.81 |
| September through cutoff, partial | +2,578.48 | +786.47 | **+3,364.95** | −1,664.45 |

The latest long-policy phase has not simply continued the earlier realized
bleeding. But this short positive phase does not establish safety: unfinished
inventory can reverse several days of income.

Remaining accounting boundaries:

- Older **$36.09 journal gap** is localized to the August 19 native-close
  incidents ($25.69+$10.40). It is not a new September discrepancy. Since maker
  activation, realized journal versus equity-log realized values reconciles to
  rounding; since short pause the residual is approximately $0.0024.
- `totalFunding=0`, `lastFundingSettlement=0` do not prove zero exchange funding.
  We still lack authenticated account funding/cash-flow reconciliation.
- The bounded maker ring retains **three complete filled orders**, all matching
  fee/PnL arithmetic; same-fill modeled fee saving $28.67. This is neither the
  total from 14 batches nor independent proof of exchange-charged fees.
- All 20 historical short closes sum to −$3,891.07. Short entries remain paused.

## 4. Tested coverage: substantial, not exhaustive

Canonical register: [TESTED-SETUPS.md](TESTED-SETUPS.md).
Definitions are exact settings, not independent discoveries. Repeated windows,
timing stresses and verification runs do not increase independent sample size.

| Workstream | Coverage | Conclusion |
|---|---|---|
| Deep timer/S/R/weak-context blocks | 17 ladder rules | Some trade-offs; zero complete qualifiers |
| Genuine-drop HL confirmation | 12 ladder rules | Broad confirmation lost recoveries; mild sell15 veto positive but not reliably safer |
| Persistent pulse holds | 6 ladder rules | No robust protective qualifier |
| Deep size /cost caps | 6 new ladder rules plus repeated cap10 | Lower loss size/DD with missed winning dollars |
| Individual ladder indicators | 4 hourly rung11 vetoes | RSI≥70, CRSI≥80, ROC5≤0, below VWAP; none complete qualifier |
| Individual standalone studies | 5,160 cumulative definitions | CRSI/RSI/ROC/MACD/Bollinger/ADX-DMI/ATR-efficiency/VWAP-RVOL/OBV-MFI-CMF; positive subsets, no complete strict qualifier |
| Pairs/calendar/refinement | 64 pairs,12 exclusions,8 timing/hold/control additions,9 refinements | R01-08 profit-screen-only lead; monthly/risk/concentration failures retained |
| H01 indicator+HL/S/R | 4 predicates plus4 interaction controls | Zero recent qualifiers; all primary filters below refined baseline |
| Descriptive atlases and this pass | Context and outcome annotations | Zero additional strategies |

**34 of 45 ladder definitions still have only the earlier partial-clock model**;
11 have corrected transactional results. Old negatives remain informative,
but all45 cannot be described as recertified against today's stack. Retest
selected controls as needed; do not blindly repeat the whole grid.

Most standalone work ends **September 4 19:01 UTC**, not the new September8
cutoff; it is $10k fixed-notional research, not ladder/account profit. Repaired
ladder replay also does not certify maker queues, receipt latency, funding,
liquidation or ten-second live execution. Current config is not proven globally
optimal just because specific alternatives failed.

### Existing sizing trade-off, baseline always beside alternative

Recent repaired window: **May17 2026 20:43→September4 19:01 UTC**, flat start,
$32k reference equity,0.055% fees each side, before funding. An episode includes
its earlier partials; the unfinished final episode is marked, not a completed loss.

| TP model /policy | Episode W/L | Winning $ | Losing $ | Net incl. final mark | Max DD |
|---|---:|---:|---:|---:|---:|
| Resting-touch baseline | 289/10 | +56,071.59 | −33,009.35 | **+22,759.92** | 24.69% |
| Resting-touch half-size rung11 | 290/10 | +50,882.37 | −29,094.95 | **+21,441.69** | 21.35% |
| Close-confirmed baseline | 241/11 | +58,958.29 | −40,192.40 | **+17,468.13** | 31.11% |
| Close-confirmed half-size rung11 | 238/11 | +54,563.94 | −34,377.15 | **+19,066.09** | 26.98% |

Longer July1 2025→August19 2026 baseline versus half11:
**+$46,832→+$39,312** resting-touch; **+$19,490→+$23,355** close-confirmed.
Profit direction depends on execution path. Forced-close counts do not fall.
[All four monthly W/L comparisons](codex-astra-ladder-sizing-findings-2026-09-05.md).
This motivates investigating **when** to resize, not calling unconditional
half-sizing a free improvement.

## 5. New analysis: first deep loss and subsequent outcome

[Frozen diagnostic card](../research-inputs/ladder-regroup-2026-09-08.json): select
the first end-of-minute state per episode with surviving depth≥9 and gross
inventory PnL≤−3%, separately≤−5%. Original captured price prefixes plus original
verified candle repair; no new strategy. Resting TPs filled in a minute leave
no inventory to label. Future fills cannot alter earlier observations.

These cohorts overlap. W/L means whole-episode profit including partials,
not necessarily a TP. Current live trade is outside this historical window.

### Recent May17→September4 baseline versus selected cohorts

| TP model /cohort | Completed W/L | Winning $ | Losing $ | Completed net |
|---|---:|---:|---:|---:|
| Resting-touch all baseline | 289/10 | +56,071.59 | −33,009.35 | +23,062.24 |
| Resting-touch first deep≤−3% | 22/5 | +6,035.00 | −28,388.87 | −22,353.87 |
| Resting-touch first deep≤−5% | 13/4 | +3,955.29 | −27,024.89 | −23,069.60 |
| Close-confirmed all baseline | 241/11 | +58,958.29 | −40,192.40 | +18,765.89 |
| Close-confirmed first deep≤−3% | 19/8 | +7,049.28 | −38,541.14 | −31,491.86 |
| Close-confirmed first deep≤−5% | 11/6 | +4,042.29 | −33,496.02 | −29,453.73 |

Each baseline has one unresolved final episode; only the close-confirmed−3%
cohort includes it (28 observations,27 completed), excluded from W/L.
Both recent−5% models have17 completed episodes, not34 independent events.
Average winner $304/$367 versus average loser −$6,756/−$5,583 shows the asymmetry.

**Those losing dollars are not the benefit from a stop.** Much loss existed
already at the first observation:

| Recent−5% cohort | Episode marks at first observation | Completed net | Subsequent value change on unchanged path |
|---|---:|---:|---:|
| Resting-touch | −$53,029.30 | −$23,069.60 | **+$29,959.70** |
| Close-confirmed | −$53,443.31 | −$29,453.73 | **+$23,989.58** |

Marks include prior partial cash and the same modeled closing-fee reserve.
Subsequent change includes later adds/partials/exits. It is **not** an executable
same-close liquidation comparison or an early-stop replay. Changing an exit
changes future occupancy/cooldowns; this decomposition avoids labeling all bad
episode dollars as still preventable. It also preserves invisible recovery value.

### Longer July1 2025→August19 2026 check

| Model /cohort | W/L | Winning $ | Losing $ | Completed net |
|---|---:|---:|---:|---:|
| Resting baseline | 955/57 | +187,738.05 | −140,905.55 | +46,832.49 |
| Resting deep≤−3% | 51/32 | +13,376.34 | −129,173.44 | −115,797.11 |
| Resting deep≤−5% | 26/21 | +6,793.20 | −106,283.34 | −99,490.14 |
| Close-confirmed baseline | 788/60 | +190,818.85 | −171,329.22 | +19,489.63 |
| Close-confirmed deep≤−3% | 46/38 | +14,995.90 | −162,954.30 | −147,958.40 |
| Close-confirmed deep≤−5% | 19/27 | +6,102.00 | −139,999.41 | −133,897.41 |

The longer sample is less recovery-friendly. Recent65–76% profitable outcomes
must not be presented as live-trade odds. Even the longer cohorts have positive
aggregate subsequent value change from their first observed mark. Neither
observation certifies a blanket hold or exit policy.

Recent−5% outcomes by **first-observation month**, not strategy monthly returns:

| Month | Resting W/L; winning /losing $ | Close-confirmed W/L; winning /losing $ |
|---|---|---|
| May, partial | 5/0; +1,164 /0 | 4/0; +1,214 /0 |
| June | 6/3; +1,995 /−22,917 | 5/4; +1,704 /−25,374 |
| July | 0/1; 0 /−4,108 | 0/2; 0 /−8,122 |
| August | 2/0; +796 /0 | 2/0; +1,125 /0 |

All eight cohort/monthly exports and first-observation records are retained for
known-time context enrichment. Month is an outcome grouping, not a hindsight gate.

## 6. Next direction: ladder first; retain independent leads separately

### Next economic checkpoint: conditional last-rung size

Suggested bounded comparison, **not yet run**:

1. Unchanged current ladder baseline.
2. Repeated control: unconditional half-size rung11.
3. Half-size rung11 only under existing weak structure: completed4h close≤EMA200
   OR closed12h return≤−2%.
4. Half-size rung11 only when completed hourly close is below its own daily VWAP
   AND hourly five-bar ROC≤0.
5. Half-size rung11 only when healthy HL15≤0.85 AND HL1h≤0.90.

**Three new rules, not a cross-product.** Each changes only the size of an
otherwise-approved, baseline-affordable final add. Preserve thresholds/fraction
before outcomes. No lower-rung, TP, exit, S/R geometry or partial-allocation changes.
Publish readiness/null counts and same-window controls; full-history missing HL
is not a full-history signal test. Finalize a dedicated execution card first.

This targets losing dollars while measuring sacrificed winning dollars; not
a retrofit to save this trade. For example the two-window HL condition would
**not** have halved this rung11 because HL1h was1.532.

Certify the old accepted cutoff baselines first, then separately extend controls
and candidates to the newly synced closed-minute cutoff. Carry existing replay
inventory across September4; do not reset flat and call it equivalent. The short,
already viewed extension is not an untouched holdout. Report both TP models,
monthly W/L dollars, DD, open marks, costs and arrival/action timing sensitivity.

### Separate next question: failed recovery after reaching deep inventory

Enrich this diagnostic's first-loss observations, **including profitable
recoveries**, with then-known local momentum/VWAP recovery, HL15 versusHL1h,
native versus marked OI, and confirmed support breaks/retests. No repeated-minute
pseudo-samples or final-loss-only selection. This is a different decision moment
from approving the last add.

If separation survives chronology and models, freeze one bounded action: a trim
or a persistent exposure hold, not several new exits together. No−3/−5 stop
or loss-making S/R partial follows from the descriptive tables alone.

### Independent strategies remain a separate risk budget

Retain R01-08 Bollinger/CMF as a sparse bearish candidate; MACD/VWAP and MFI
calendar leads retain their failure labels. H01 did **not** strengthen the
bearish lead: recent refined baseline +$1,190.58 versus flow +$853.13, book
+$497.11, OI +$484.54, support-break +$183.23 on$10k. Do not transfer failed
context filters automatically or restart the old short.

Any independent candidate needs a shared-account overlay: incremental dollars,
performance during long losses, margin/size budget, costs and missed opportunities.
Equity-adaptive exposure caps are also a distinct untested risk-budget dimension;
L06's dollar caps were not equity-adaptive. Reducing exposure is not itself
predictive alpha and must be compared with simple matched-size controls.

**Priority:** selective sizing → failed-recovery discrimination → complementary
strategy. No live change is justified by the current unfinished episode or this
diagnostic. We have not established that the current configuration is optimal.

## 7. Reproduction and verification

Live ledger reused without modifying its source:

```powershell
$env:ATTRIBUTION_OUT='backtests/hype/hype-regroup-2026-09-08/ledger'
npx ts-node scripts/hype-current-stack-attribution.ts
```

Accepted diagnostic is **`diagnostic-v2`**, not initial `diagnostic`:

```powershell
npx ts-node scripts/ladder-regroup-audit-tests.ts
$env:REGROUP_OUT='backtests/hype/hype-regroup-2026-09-08/diagnostic-v2'
npx ts-node scripts/hype-ladder-regroup-audit.ts
npx ts-node scripts/ladder-regroup-results-check.ts
```

Paths must be new: use fresh suffixes to reproduce. Stop syncing during runs.
Inputs, state/config and historical byte prefixes are hashed; mismatch fails.
Live prices use new rows, historical labels use original hash-identical prefixes
plus the original repair. V2 separates already-incurred marked losses from
subsequent changes; thresholds/cohorts/paths unchanged. Initial output preserved.

Passed:

- Ten fixture checks: depth, first occurrence, repeats, same-minute TP/next-open
  ordering, inventory continuity, unresolved outcome, fees, past/future partials.
- Independent interval selection and per-position PnL: four baseline models,
  **2,411 closed-episode records /349 overlapping threshold observations**;
  full baseline totals, first times, marks and monthly sums reconcile.
- Eleven live rung/decision matches and quantity/cost/PnL sums; no missing
  decision-time S/R match fabricated.
- Standard/VPS no-emit TypeScript checks; `git diff --check`.

Artifacts: `backtests/hype/hype-regroup-2026-09-08/` (local bulk outputs).
Source/card/findings/index pointers preserved for review. **No economic variant
ranking or promotion screen applies: zero variants ran.** Proposed conditional
sizing remains unrun and is not counted in the inventory.

Accepted diagnostic-v2 SHA-256:

```text
manifest.json     e428aa1fad1379c4ec5236898dca6a0c6533dccafc16802be57a82a900a5131d
verification.json 5e2527b63eee0041dae267e5ef0ad14a08d86eeb5ca1e61dc01e968dfb84dc60
```
