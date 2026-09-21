# SF05 — RSI15 below52 with 4h price >6% above EMA200

## Conclusion

- Entry blocking removes **14 losers ($2,046)** but also **5 winners ($2,295)** from122 closed baseline trades. Net falls $249; drawdown improves7.92%→6.02%. A measured risk/profit trade-off, not a free improvement.
- Adding the same condition as an in-trade exit improves June–September by **$307 versus baseline**, from just two changed exits. Older history loses $1,000; full-history net falls $693 and DD rises to9.97%.
- **0/2 candidates pass the inherited cross-period screen.** This exact entry/exit rule is not a deployment candidate. The EMA observation remains descriptive evidence, not proof that an RSI/EMA combination can distinguish all bad recoveries. No live changes.

## Frozen interpretation and controls

[Card](../research-inputs/sfp-rsi-ema-sf05-2026-09-20.json).
Original SF01 range-qualified4h SFP longs, $10,000 notional, structural sweep stop,
2R target and24h maximum hold. Not the live Martingale/Agg10 ladder.
Full window **2024-12-27 00:00 through2026-09-15 20:20 UTC**; split2026-06-01.
DD uses a separate $32,000 account per variant. Fees0.055% per side, before funding;
extra5bps per side and publication/action delays tested separately.

Condition is **last completed15m RSI14 <52 AND last completed4h close more than6% above its4h EMA200**.
This is not live-price distance, an EMA slope, or the raw EMA value.
Both comparisons are strict. The200-period EMA on4h is a ~33-day period,
not a200-day EMA. Source publication lag60s primary/120s sensitivity.

- **A baseline:** unchanged market entry, original stop/target/time exit.
- **B entry block:** skip the original signal when condition holds. No waiting/retry.
- **C block + exit:** B plus market exit on the first subsequent published15m check satisfying it. Original protective stop/TP remains effective until then.

Signals, risk eligibility, brackets, notional and one-position ownership remain
unchanged. Fresh signals are replayed after earlier exits, including any changed
occupancy. Exit-only without the entry veto was **not** tested. No threshold search,
wider stop,72h hold, HL overlay or ladder variant.

## Baseline-adjacent results

Net includes the same +$14.86 cutoff open mark in full/recent; W/L and winning/losing
dollars include closed trades only. This explains the difference from their sum.
Wins/losses mean positive/negative net after fees, not target/stop labels.

| Window / setup | Wins / losses | Winning $ | Losing $ | Avg loss $ | Net $ | DD % |
|---|---:|---:|---:|---:|---:|---:|
| Full — A baseline |43 /79|18,124|-15,449|-196|2,690|7.92|
| Full — B entry block |38 /65|15,829|-13,403|-206|2,441|6.02|
| Full — C block + exit |39 /64|14,348|-12,366|-193|1,997|9.97|
| Older — A baseline |31 /68|14,627|-13,334|-196|1,293|7.92|
| Older — B entry block |29 /58|13,142|-11,812|-204|1,330|6.02|
| Older — C block + exit |29 /58|11,540|-11,247|-194|293|9.97|
| Jun1–Sep15,2026 — A baseline |12 /11|3,497|-2,115|-192|1,397|2.47|
| Jun1–Sep15,2026 — B entry block |9 /7|2,687|-1,591|-227|1,110|2.45|
| Jun1–Sep15,2026 — C block + exit |10 /6|2,807|-1,119|-186|1,704|2.45|

Ranking by full-period net delta: A $0; B **−$249**; C **−$693**.
The blocker removes17.7% of losses but11.6% of winners by count; the sacrificed
winners are much larger on average. Surviving average loss actually gets worse
under B. Fewer stops alone is not enough.

## What changes, precisely

B removes19 original trades, without producing any replacement trades on the
primary path. C removes those same19 and changes9 additional exits; again no
replacement trades occur. The replay allows them, rather than assuming this.
All deltas reconcile as removed + replacement + changed common trades + open mark.

The nine early exits contribute **−$444 relative to B**:

| Entry UTC | Baseline net $ | C net $ | Difference $ |
|---|---:|---:|---:|
|2025-04-16 12:01|825|125|-700|
|2025-04-28 04:01|773|345|-428|
|2025-05-19 08:01|-349|-102|247|
|2025-07-02 08:01|634|145|-489|
|2026-03-30 04:01|-228|-23|205|
|2026-04-19 12:01|-170|-57|113|
|2026-05-26 12:01|167|180|14|
|2026-06-22 08:01|-313|121|434|
|2026-09-11 16:01|-258|-99|159|

The recent benefit is real within this replay: June22 turns a stop into a small
profit, and September11 reduces a losing timeout. Together +$593 relative to B,
minus B's $287 lost net = +$307 versus A. In older history three large winners
are cut prematurely. This is why stronger recent performance does not survive
the full window. Only two recent early exits: not evidence of reliable disaster
prediction.

**Original SF04 pressure-map cohort:** all23 entry predicates agree using the
longer EMA seed. Seven signals would be blocked: four stops totaling$524 and
three winners totaling$811. Neither of its two72h non-recoveries is blocked at
entry. The June22 non-recovery is later caught by C; July30 is not (price is below
EMA200). SF04 excludes losing timeouts, hence September11 was absent from that
descriptive map but correctly included here. Its13-win/10-stop May–September
cohort is not the same population as the23 June–September replay closes.

## Monthly marked net and delta versus A

Primary lag60s, action delay0, stop-first. September is partial through Sep15.

| Month | A baseline $ | B block $ | C block + exit $ | B−A $ | C−A $ |
|---|---:|---:|---:|---:|---:|
|2024-12|361|361|361|0|0|
|2025-01|764|764|764|0|0|
|2025-02|716|716|716|0|0|
|2025-03|-613|-613|-613|0|0|
|2025-04|1,709|1,340|213|-369|-1,496|
|2025-05|-554|-349|-102|205|452|
|2025-06|-815|-667|-667|148|148|
|2025-07|-330|106|-382|436|-52|
|2025-08|222|222|222|0|0|
|2025-09|236|482|482|245|245|
|2025-10|-419|-419|-419|0|0|
|2025-11|-219|-219|-219|0|0|
|2025-12|189|189|189|0|0|
|2026-01|-443|-443|-443|0|0|
|2026-02|822|60|60|-762|-762|
|2026-03|-592|-533|-328|58|264|
|2026-04|-136|-61|52|75|188|
|2026-05|392|392|405|0|14|
|2026-06|1,042|1,070|1,504|27|461|
|2026-07|209|209|209|0|0|
|2026-08|632|88|88|-544|-544|
|2026-09|-486|-256|-97|230|389|

## Sensitivity, causality and verification

- Both source lags60/120s, action delay0/60s, stop-first/target-first and cost
  stress were run: **108 independently audited paths**. Archived baseline result
  objects, monthly objects and primary trade CSV bytes match exactly for both lags.
- Delays do not reverse the conclusion. Across the four source/action clocks,
  full net ranges: A $2,457–2,690; B $2,178–2,441; C $1,782–1,997.
  B DD5.86–6.02%; C9.97–10.04%. Every comparison uses its identical-clock A.
- Primary extra-cost full nets: A $1,458; B $1,399; C $955. C's older stress net
  is **−$577**. Both fail the −$250 monthly-delta gate and top-five concentration
  check; C also fails older PF, stress and DD. Baseline itself is exploratory,
  not a validated standalone strategy.
- Example causal exit: June22 15:01 UTC uses15m bar ending15:00 and4h bar ending
  12:00, plus60s publication lag. RSI47.86, EMA distance9.86%. It cannot see the
  unfinished12:00–16:00 4h candle. The exit executes at15:01 minute open; the
  additional action-delay sensitivity executes at15:02. Original stop/TP can
  terminate ownership before the indicator check.
- EMA warmup uses the accepted continuous tape beginning Dec5,2024. Three of128
  original signals lack200 complete4h bars; condition unknown leaves baseline
  intact. No unknown signals in the recent window. B vetoes19; C schedules17
  potential checks but only9 actually close owned trades (others already exited
  or never owned). Predicates use closed bars, never final-form candles early.
- Policy prefix/future-poisoning, boundary/warmup, delayed exits, protection
  priority, new ownership and independent-audit tamper tests pass. Existing
  setup-replay, structural-replay-audit and structural-limit-entry tests pass.
- Thresholds came after viewing SF04, so this is **development**, not an untouched
  holdout. Findings do not establish that RSI or EMA are useless, nor validate
  another threshold, exit-only rule, wider stop or regime filter.

## Saved artifacts / reuse

Job: `backtests/sfp-rsi-ema/42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9`.
[Results CSV](../backtests/sfp-rsi-ema/42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9/results.csv) /
[monthly CSV](../backtests/sfp-rsi-ema/42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9/monthly.csv) /
[trade attribution](../backtests/sfp-rsi-ema/42e7c3a0ba432f2eb1abd9da7be2ec87e8a141a8c753369b0d45357c282ad4d9/attribution.json).
Also saved: per-variant trade CSV/JSON, per-signal entry/exit source provenance,
warmup/trigger coverage, original23-case predicates, audit receipts and manifest.

Reused original scan events and sealed minute tape; no map or detector rebuilt.
The replay kernel is unchanged. Its existing scheduled-market-exit hook is now
supported by the independent structural audit; journal reason `poc_failure`
means **indicator exit** in this card, not a POC condition.

Reproduce/cache verify: `npx ts-node scripts/sfp-rsi-ema-study.ts`.
No live code/config changes and no commit/push performed.
