# H01: four HL/S/R conditions on the frozen Bollinger/CMF short

September 8, 2026. Research-only. [Method/reproduction](../docs/research/indicator-hl-sr-filters-h01.md),
[frozen card](../research-inputs/indicators/context-filters-h01-2026-09-08.json),
[retained machine summary](../research-inputs/indicators/h01-retained-results-2026-09-08.json).

## TL;DR

- **None of the four primary filters improves the refined baseline.** Over May17–September4, the 11-trade refined baseline earns +$1,190.58 immediate. Strengthening flow earns +$853.13, deteriorating book +$497.11, non-declining native OI +$484.54 and confirmed support break +$183.23. All four also trail the refined baseline with +1m actions. No recent exploratory qualifier; no full-history qualification can be awarded on this HL-only overlap.
- **Higher selected win rate hides lost winners.** Flow produces 4W/0L, but removes four winners worth $736.81 to avoid three losses worth $399.36. Native OI also enables a replacement trade absent from the baseline: July28 08:00, −$23.29. Full occupancy replay matters.
- **Delivery timing is a real sensitivity of these exact rules.** An extra15s makes every flow decision unavailable under the unchanged closed-minute freshness rules; extra60s makes all three HL filters unavailable. This is modeled abstention, not observed live outages or profitable loss avoidance. All114 logical cases independently verified; **8 new definitions →5,261 standalone /45 ladder**. No live changes.

## 1. Exact window, controls and definitions

**2026-05-17 20:43 →2026-09-04 19:01 UTC.** Reuse the accepted H00/R01
sources and repaired candle cutoff, not a later pull. There are **14 original
4h Bollinger opportunities**, 13/12/11 completed baseline trades, and no new
original signals after August8 through cutoff.

This is a **standalone short experiment, not the deployed short owner or the
long ladder**. One position, $10,000 notional, $32,000 reference equity,
fixed12h hold, 0.055% fee per side, separate extra5bps/side cost stress.
Before funding, no maker-fill model, leverage/account overlay, TP/SL change
or live risk claim. All114 cases are flat at cutoff.

Original entry: fresh completed4h Bollinger20/2 downside crossing (previous
percent-B≥0, current<0). Old pair adds completed1h CMF20<0; refined **R01-08**
adds completed1h CMF20<−0.05. H01 primary rules add exactly one condition:

| Primary ID | Additional condition on R01-08 | Meaning / limitation |
| --- | --- | --- |
| H01-01 | taker15(T) < taker15(T-15m); both healthy. Strict ratio decline, no absolute sell threshold. | Selling is strengthening relative to buying; may still be buy-dominant, not proof of net selling. |
| H01-02 | imbalance0.5(T) - imbalance0.5(T-15m) < 0; both healthy. | Bid/ask balance deteriorating, not necessarily already ask-heavy. |
| H01-03 | native OI1h percentage change >= 0; current/anchor healthy. | Participation not shrinking during the price breakdown; OI alone does not identify long versus short build. |
| H01-04 | Both completed5m closes ending T-5m and T < support frozen at T-15m * (1-0.001). No known prior support => false, not missing OHLC. | Price is below a previously known support with two closed observations, not merely approaching support. |

Each has one explicit `_no_cmf` interaction control: original Bollinger
crossing + that condition, **without CMF**. This does not create a pure
continuous HL entry trigger or silently search both OI directions.

Each rule has an own `ready_` control that preserves its indicator baseline
and removes **only** the extra condition's economic predicate. Missing data
still blocks. SR absent-level is a valid negative predicate, not unhealthy
candles, so readiness does not covertly require a level to exist.

**Budget:** 4 primary +4 interaction definitions; 48 rule cases +48 own
readiness cases +18 repeated baseline cases =114 logical cases. Those are
8 definitions, not114 independent configurations/market samples. Three arrival
assumptions ×two action delays reuse the same history. Accepted tested inventory
increases from5,253 to**5,261 standalone**, with**45 ladder** unchanged.

H00 outcomes were already inspected. This card was frozen before H01 economic
runs, **not before seeing this historical sample**. It is not out-of-sample,
and no extra thresholds were introduced after these results.

## 2. Baseline-first W/L and dollars

Extra HL delivery delay is0 in this section: the **existing** publication
model still includes legacy taker end+1m and snapshot-time proxies. It does
not mean instant proven exchange-message receipt.

### Immediate actions

| Setup | W / L | Winning $ | Losing $ | Net | Δ refined baseline | DD |
| --- | --- | --- | --- | --- | --- | --- |
| Bollinger alone | 8 / 5 | $1,589.94 | −$683.31 | $906.64 | −$283.94 | 3.76% |
| Old BB+CMF | 8 / 4 | $1,589.94 | −$635.81 | $954.13 | −$236.45 | 3.76% |
| Refined BB+CMF | 8 / 3 | $1,589.94 | −$399.36 | $1,190.58 | $0.00 | 3.05% |
| H01-01 | 4 / 0 | $853.13 | $0.00 | $853.13 | −$337.45 | 1.86% |
| H01-02 | 4 / 1 | $614.93 | −$117.82 | $497.11 | −$693.47 | 1.86% |
| H01-03 | 4 / 3 | $817.22 | −$332.68 | $484.54 | −$706.04 | 3.07% |
| H01-04 | 1 / 0 | $183.23 | $0.00 | $183.23 | −$1,007.35 | 1.86% |

### +1m entry and exit actions, same original decision

| Setup | W / L | Winning $ | Losing $ | Net | Δ refined baseline | DD |
| --- | --- | --- | --- | --- | --- | --- |
| Bollinger alone | 8 / 5 | $1,632.37 | −$785.58 | $846.79 | −$278.57 | 4.01% |
| Old BB+CMF | 8 / 4 | $1,632.37 | −$742.60 | $889.77 | −$235.59 | 4.01% |
| Refined BB+CMF | 8 / 3 | $1,632.37 | −$507.01 | $1,125.36 | $0.00 | 3.14% |
| H01-01 | 4 / 0 | $895.40 | $0.00 | $895.40 | −$229.96 | 1.85% |
| H01-02 | 4 / 1 | $644.69 | −$111.56 | $533.14 | −$592.23 | 1.85% |
| H01-03 | 4 / 3 | $841.28 | −$436.99 | $404.29 | −$721.07 | 3.17% |
| H01-04 | 1 / 0 | $207.46 | $0.00 | $207.46 | −$917.90 | 1.85% |

The hold starts at actual entry. With +1m actions, an accepted signal at T
enters T+1m, reaches timeout T+12h+1m and exits T+12h+2m. Eligibility is never
re-evaluated using later data at the delayed fill.

### All eight rules, ranked by worse of the two own-baseline increments

| Rule / own baseline | Closes 0m / +1m | Net 0m / +1m | Δ own baseline 0m / +1m | Worst monthly Δ across both fills | Recent screen |
| --- | --- | --- | --- | --- | --- |
| H01-01_no_cmf / Bollinger alone | 5 / 5 | $805.64 / $852.42 | −$101.00 / $5.63 | −$405.29 | FAIL |
| H01-01 / Refined BB+CMF | 4 / 4 | $853.13 / $895.40 | −$337.45 / −$229.96 | −$405.29 | FAIL |
| H01-03_no_cmf / Bollinger alone | 7 / 7 | $484.54 / $404.29 | −$422.10 / −$442.50 | −$275.58 | FAIL |
| H01-02_no_cmf / Bollinger alone | 6 / 6 | $449.62 / $490.15 | −$457.02 / −$356.63 | −$272.26 | FAIL |
| H01-02 / Refined BB+CMF | 5 / 5 | $497.11 / $533.14 | −$693.47 / −$592.23 | −$419.64 | FAIL |
| H01-03 / Refined BB+CMF | 7 / 7 | $484.54 / $404.29 | −$706.04 / −$721.07 | −$397.81 | FAIL |
| H01-04_no_cmf / Bollinger alone | 2 / 2 | −$53.22 / −$28.13 | −$959.85 / −$874.92 | −$431.04 | FAIL |
| H01-04 / Refined BB+CMF | 1 / 1 | $183.23 / $207.46 | −$1,007.35 / −$917.90 | −$474.02 | FAIL |

Own readiness equals its indicator baseline at the base publication model
for every condition, so all zero-extra-lag improvements/regressions here are
economic selection effects, not missing-source abstention.

The without-CMF flow control is −$101.00 immediate but only +$5.63 delayed
versus unfiltered Bollinger. That is neither a robust increment nor near
the+$200 floor. The no-CMF OI path is identical to its refined counterpart
on this window; requiring CMF adds no further selection among those accepted
OI opportunities. This is a sample-specific path observation, not proof of
general redundancy.

## 3. Visible loss savings versus invisible missed winners

Immediate, base publication model, relative to the unchanged refined baseline:

| Rule | Removed wins / losses | Winning $ sacrificed | Losing $ avoided | New trades / net | Net Δ baseline |
| --- | --- | --- | --- | --- | --- |
| H01-01 | 4 / 3 | $736.81 | $399.36 | 0 / $0.00 | −$337.45 |
| H01-02 | 4 / 2 | $975.01 | $281.54 | 0 / $0.00 | −$693.47 |
| H01-03 | 4 / 1 | $772.73 | $89.98 | 1 / −$23.29 | −$706.04 |
| H01-04 | 7 / 3 | $1,406.71 | $399.36 | 0 / $0.00 | −$1,007.35 |

The dollar bridge is exact:
**variant Δ = losing dollars avoided − winning dollars sacrificed + new-trade net.**
It reconciles to total replay PnL, including any newly occupied crossings.
No trade has been erased merely because its later outcome is unpleasant.

Flow's4/4 wins are therefore not enough: retaining **71.66%** of baseline
profit falls below90% retention, its recent sample is below10, and July
loses too much profit. The book filter preserves only41.75% of baseline net;
the OI filter40.70%; the strict support break15.39%.

### Why full occupancy changed the OI result

July28 00:00 UTC:
closed1h CMF=−0.182243, native OI1h=−0.181400%.
R01-08 accepts; H01-03 rejects because OI is declining. That baseline trade
eventually earns **+$295.12**.

July28 08:00 UTC:
closed1h CMF=−0.071557, native OI1h=+0.086740%.
The baseline is still occupied. H01-03 is free and accepts this crossing:
$55.341 entry, $55.409 exit at20:00, **−$23.29 net**.
With +1m actions the replacement is **−$21.49**, also retained in attribution.

Causal trace:

- First current/anchor native-OI evidence: asset-context physical
  lines399610/399375, source times T−5.138s and (T−1h)−4.995s.
- Second current/anchor evidence: lines401493/401257, source times
  T−4.914s and (T−1h)−10.839s.
- All are eligible by their respective observation/anchor boundaries under
  the frozen proxy model. The complete4h trigger and1h CMF sources end at T.
- The eventual trade profit/loss does not participate in either decision.
  The rejected winner is not reassigned to the later entry.
- At each minute, due exits resolve before a same-time new crossing;
  pending/open positions block other opportunities.

Dropping removed baseline trades from a CSV would miss that additional$23.29
loss and misstate the OI variant's exact net.

## 4. Month-by-month: marked PnL, not just close-date PnL

All tables below use0 extra HL delay. Each cell after baseline is **variant
minus own baseline**; add that delta to the baseline to obtain variant net.
The full JSON retains raw winning/losing dollars and readiness/unfiltered
comparisons for every month and lag. The monthly budget is no regression
below−$320 versus own indicator, own readiness **or** original Bollinger.

A July31 trade crosses into August, so marked-month values differ from
realized-close cohorts in H00. In the refined immediate baseline, July marked
+$456.05 differs from July closed+$504.51; August marked+$36.37 differs from
August closed−$12.10. No accounting discrepancy: unrealized month-end value
moves between the two months.

### Primary filters, immediate

| Month | Refined BB+CMF marked net | H01-01 Δ | H01-02 Δ | H01-03 Δ | H01-04 Δ |
| --- | --- | --- | --- | --- | --- |
| 2026-05 | $95.29 | −$95.29 | −$95.29 | −$95.29 | −$95.29 |
| 2026-06 | $602.87 | $191.56 | −$419.64 | −$382.32 | −$419.64 |
| 2026-07 | $456.05 | −$397.35 | −$268.52 | −$318.41 | −$456.05 |
| 2026-08 | $36.37 | −$36.37 | $89.98 | $89.98 | −$36.37 |
| 2026-09 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

### Primary filters, +1m actions

| Month | Refined BB+CMF marked net | H01-01 Δ | H01-02 Δ | H01-03 Δ | H01-04 Δ |
| --- | --- | --- | --- | --- | --- |
| 2026-05 | $96.21 | −$96.21 | −$96.21 | −$96.21 | −$96.21 |
| 2026-06 | $522.72 | $303.95 | −$315.26 | −$397.81 | −$315.26 |
| 2026-07 | $474.02 | −$405.29 | −$272.26 | −$318.56 | −$474.02 |
| 2026-08 | $32.41 | −$32.41 | $91.50 | $91.50 | −$32.41 |
| 2026-09 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

### Without-CMF interaction controls, immediate

| Month | Bollinger alone marked net | H01-01_no_cmf Δ | H01-02_no_cmf Δ | H01-03_no_cmf Δ | H01-04_no_cmf Δ |
| --- | --- | --- | --- | --- | --- |
| 2026-05 | $95.29 | −$95.29 | −$95.29 | −$95.29 | −$95.29 |
| 2026-06 | $366.42 | $428.01 | −$183.19 | −$145.87 | −$419.64 |
| 2026-07 | $408.55 | −$397.35 | −$268.52 | −$270.92 | −$408.55 |
| 2026-08 | $36.37 | −$36.37 | $89.98 | $89.98 | −$36.37 |
| 2026-09 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

### Without-CMF interaction controls, +1m actions

| Month | Bollinger alone marked net | H01-01_no_cmf Δ | H01-02_no_cmf Δ | H01-03_no_cmf Δ | H01-04_no_cmf Δ |
| --- | --- | --- | --- | --- | --- |
| 2026-05 | $96.21 | −$96.21 | −$96.21 | −$96.21 | −$96.21 |
| 2026-06 | $287.13 | $539.54 | −$79.67 | −$162.21 | −$315.26 |
| 2026-07 | $431.04 | −$405.29 | −$272.26 | −$275.58 | −$431.04 |
| 2026-08 | $32.41 | −$32.41 | $91.50 | $91.50 | −$32.41 |
| 2026-09 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

May/September are partial calendar windows. September has zero crossings,
not evidence of a protected profitable regime. The full2025 candle-only
baseline and its existing screens remain in
[R01 findings](codex-astra-indicator-refinement-r01-findings-2026-09-07.md).
Do not invent unavailable2025 HL inputs or claim H01 tested that full window.

## 5. Risk versus simply using less exposure

Immediate, base publication model:

| Setup | Exposure hours | Profit retained | DD | Exposure-scaled baseline DD | Extra-cost net |
| --- | --- | --- | --- | --- | --- |
| Refined BB+CMF | 132 | 100.00% | 3.05% | — | $1,081.23 |
| H01-01 | 48 | 71.66% | 1.86% | 1.13% | $813.58 |
| H01-02 | 60 | 41.75% | 1.86% | 1.41% | $447.39 |
| H01-03 | 84 | 40.70% | 3.07% | 1.96% | $414.82 |
| H01-04 | 12 | 15.39% | 1.86% | 0.29% | $173.33 |

The exposure-scaled baseline is **ex-post diagnostic sizing**, not a proposed
live configuration. It multiplies baseline inventory by variant exposure
hours / baseline exposure hours. None of these primary filters beats that
scaled baseline's drawdown. The four winning flow trades can still have
adverse movement before closing profitably;4/4 does not mean zero risk.

All surviving primary paths remain net-positive under the extra-cost stress,
but being profitable in isolation is not the question: they lose too much
baseline profit, have too few observations and do not satisfy the inherited
defensive evidence requirements.

## 6. Arrival-delay sensitivity and own-readiness controls

Add0/15/60 seconds to **each HL record's available time**, then round up to
the next eligible UTC minute. Leave original event times, T-anchored windows,
quality thresholds, candle/SR clocks and order delays unchanged. Apply the
same model at T, T−15m and the historical OI anchor T−1h.

Immediate actions below; both action delays/all controls are in the summary:

| Primary rule | Extra HL delay | Source-ready signals / 14 | Indicator baseline net | Own readiness net | Filtered W/L; net | Δ vs readiness |
| --- | --- | --- | --- | --- | --- | --- |
| H01-01 | 0s | 14 / 14 | $1,190.58 | $1,190.58 | 4/0; $853.13 | −$337.45 |
| H01-01 | 15s | 0 / 14 | $1,190.58 | $0.00 | 0/0; $0.00 | $0.00 |
| H01-01 | 60s | 0 / 14 | $1,190.58 | $0.00 | 0/0; $0.00 | $0.00 |
| H01-02 | 0s | 14 / 14 | $1,190.58 | $1,190.58 | 4/1; $497.11 | −$693.47 |
| H01-02 | 15s | 10 / 14 | $1,190.58 | $984.68 | 1/0; $199.09 | −$785.59 |
| H01-02 | 60s | 0 / 14 | $1,190.58 | $0.00 | 0/0; $0.00 | $0.00 |
| H01-03 | 0s | 14 / 14 | $1,190.58 | $1,190.58 | 4/3; $484.54 | −$706.04 |
| H01-03 | 15s | 14 / 14 | $1,190.58 | $1,190.58 | 4/3; $484.54 | −$706.04 |
| H01-03 | 60s | 0 / 14 | $1,190.58 | $0.00 | 0/0; $0.00 | $0.00 |
| H01-04 | 0s | 14 / 14 | $1,190.58 | $1,190.58 | 1/0; $183.23 | −$1,007.35 |
| H01-04 | 15s | 14 / 14 | $1,190.58 | $1,190.58 | 1/0; $183.23 | −$1,007.35 |
| H01-04 | 60s | 14 / 14 | $1,190.58 | $1,190.58 | 1/0; $183.23 | −$1,007.35 |

Important distinction:

- At zero extra lag, the latest taker source ends T−1m and becomes eligible
  exactly at T. Fourteen minutes fit the current15m window.
- Add15s and that final record becomes eligible at T+1m. The current window
  has13 minutes and age120s, failing both the14-minute minimum and90s age cap.
  **The filter and its readiness control both stop trading.**
- We did not slide the window backward, lower the minimum, extend the age cap
  or queue the crossing until the data arrived. Any such policy would be a
  different frozen card, not an unnoticed robustness fix.
- Book readiness falls to10/14 at+15s and0/14 at+60s. At+15s, changing which
  snapshot is available also changes the directional condition; its filtered
  refined path has one +$199.09 trade versus own readiness +$984.68.
- Native OI remains ready14/14 at+15s and its selected trade path is unchanged;
  at+60s the unchanged60s current-age cap rejects all observations.
- SR is a negative control for **HL** delivery delays and is identical at all
  three lag settings. This is not a test of delayed candle publication.

These are simulated availability assumptions, **not measured live collector
outages**. Every historical context retains
`historicalArrivalProven=false`. Fail-closed abstention is not credited as
new alpha or a robust zero-drawdown system.

## 7. Screens, verification and decision

The predeclared recent exploratory screen requires, in both action delays
at a given arrival lag: ≥10 trades, positive net and extra-cost net, solvent,
monthly regression≥−$320 against the three stated baselines, at least+$200
increment versus own indicator **and** own readiness, and DD no worse than
either. **All8 definitions fail at all3 lag settings.**

All8 fail the recent sample/increment requirements at zero extra lag.
Primary flow/book/OI/SR also breach a monthly budget; OI slightly worsens
baseline DD. The without-CMF book/OI controls stay within the monthly budget
but still fail sample/increment. Without-CMF support break is net-negative.

There is no new full-history profit, defensive or strict-clock qualifier.
Those screens cannot be satisfied by assigning “pass” to missing full-history
data. Exact settings are recorded as **FALSIFIED for this frozen recent
qualification screen**, with low sample size making population-level claims
inconclusive. This does **not** reject all HL/SR methods or other entry triggers.

Verification passed:

- Six recent unfiltered/old/refined ×action-delay paths exactly reproduce
  accepted H00/R01 stats, decisions and fill ledgers.
- Independent raw clocks, source selection, quality and math for84 source
  contexts from61,793 pinned evidence rows.
- Independent batch Bollinger/CMF math and1,596 decision records.
- Independent occupancy,710 repeated trade records, fees, risk and570 monthly
  rows, plus96 baseline/readiness attribution comparisons and screen checks.
- Synthetic delayed/future/duplicate/coarse evidence, same-time exit, pending
  cutoff and “readiness must retain CMF” regressions.
- Strict research, whole-project and VPS typechecks pass; protected live-file
  hashes remain unchanged.

The114 logical cases and710 trade records repeat the same14 opportunities
across definitions/delays; they are not independent observations.

Accepted [manifest](../backtests/hype/hype-indicator-hl-sr-filters-h01-2026-09-08/manifest.json)
SHA256: `96770ba72a474024fa1ab956996fa6e7108a2adc540e7cac943a87b531e04a81`.

Accepted [independent verification](../backtests/hype/hype-indicator-hl-sr-filters-h01-2026-09-08/verification.json)
SHA256: `62487022fe77ef38eeafa93a71433a1fb2bfd4fbb0ed927c901fb9be4f1c5850`.

**Decision: retain the unchanged research baseline; no H01 rule earns
automatic ladder transfer or live promotion.** Stop at this evidence
checkpoint. No threshold rescue sweep, new combination, execution changes,
short unpause, config/state mutation, commit, push or deployment.

### Side observation

This exact4h-trigger / fixed-minute publication model leaves no taker-quality
headroom at the boundary. That deserves explicit treatment in any future
research timing contract, not a silent loosening now. It is not evidence that
an operationally different existing live gate is broken.

