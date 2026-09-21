# L08: conditional half-size rung 11

## TL;DR

- **None of the three conditional rules qualifies.** Exactly 34 cases, three new definitions, eight archived controls reproduced exactly. All three improve the recent resting-touch model but reduce net profit and worsen drawdown under close-confirmed TP. Unconditional half11 also remains unqualified.
- **Recent refreshed period: May17 2026 20:43 through September8 2026 17:47 UTC.** Baseline net is $20,913.64 resting-touch / $15,838.56 close-confirmed. Structure-conditioned half11 produces $22,438.77 / $14,622.80; VWAP/ROC $22,035.61 / $14,079.03; two-window HL $21,567.09 / $13,319.46. These are simulated long-only totals, not actual account returns.
- **No live change.** The latest simulated deep position remains full-size under all three conditions. Historical HL delivery assumptions are fragile: another15s or60s delay makes every tested HL sizing intervention unavailable, returning that overlay to baseline. This is missingness, not a successful economic result.

## Exact scope and timing

Frozen before conditional outcomes: [study card](../research-inputs/sr-pulse-encounters/conditional-half11-2026-09-08.json).

| Name | At an otherwise-approved next-depth11 add |
|---|---|
| Baseline | Full original requested notional |
| Always half11 | Half original requested notional every time |
| Structure | Half only when completed4h close **<** its canonical EMA200 **OR** trailing closed-minute12h return **<=−2%** |
| VWAP/ROC | Half only when last fully closed hourly close **<** that bar's own UTC-day VWAP **AND** hourly ROC5 **<=0%** |
| HL selling | Half only when HL15m taker **<=0.85 AND** HL1h **<=0.90**, with healthy14/55 minute samples and source age0–90s |

The structure equality convention deliberately matches the inherited canonical
`aboveEma200` flag: a close exactly at EMA200 is not weak. EMA uses the same
rolling249 completed4h bars as the baseline. VWAP uses actual turnover/volume
from midnight through the selected closed hour, not the full future day.
ROC5 compares that hourly close with the close five hourly bars earlier.

Both timer-only and genuine price-drop adds are eligible. All existing outer
gates and **full-size affordability must pass first**. Only this one requested
clip is multiplied by0.5. No repeated halving, top-up, veto, lower-rung change,
new partial allocation, last-add-time change, or exit change. Following an
existing partial, a later approved next-depth11 add is assessed afresh.
Unknown required context leaves the research sizing overlay inactive; it is
counted, not converted into bearish data. This does not choose live missing-data behavior.

### Windows and models

| Window | Exact UTC boundaries | Purpose |
|---|---|---|
| Original recent | 2026-05-17 20:43 → 2026-09-04 19:01 | Archived control parity and frozen qualification |
| Published long | 2025-07-01 00:00 → 2026-08-19 21:32 | Original long-history/monthly qualification |
| Refreshed recent | Same May17 start → 2026-09-08 17:47 | Latest data, original inventory carried across Sep4 |

Each has five policies and two TP assumptions:30 cases. Four additional cases
delay **only the new HL sizing overlay's receipts** by15s/60s on the refreshed
window. Existing baseline pulse consumers are unchanged. These are repetitions,
not four additional strategy definitions. Previously viewed history, including
the extension, is development data rather than untouched holdout.

- `resting_touch`: a previously armed target can fill at its target if a later minute trades through it. No target computed at this close sees the preceding intrabar high. This is not queue/full-fill certification.
- `close_confirmed`: a closed-minute TP decision fills at the next minute's open. This stresses a different exit path; it is not a claim that native TP normally waits for a minute close.
- All other market decisions fill next-minute-open. No extra market-action-delay model was introduced in this pass.

Every run starts long-only with $32,000, original800×1.35 sizing and maximum11
rungs. Original0.055% fees per side remain. Funding settlement, exact lot/tick
rounding, maker rebates/queue/fragmentation and shared-account collateral are
**not certified**. This is the repaired transactional replay, not the obsolete
partial-clock reanchor. The two TP models are sensitivity cases, not guaranteed
upper/lower profit bounds.

## Refreshed recent results: baseline always beside alternatives

May17 20:43 → September8 17:47 UTC. Dollars rounded to cents.
W/L counts are **completed ladder episodes**, incorporating that episode's
S/R partial profits and fees. Win$ and Loss$ are their contributions, not
individual order wins or gross-before-fee PnL. The final open ladder is separate.
Net = Win$ + Loss$ + final marked-open PnL + unfinished-episode partial cash.
Unfinished partial cash is zero here, apart from floating-point noise.

### Resting-touch TP

| Setup | Wins / losses | Win$ | Loss$ | Open mark | Net | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 295 /10 | 57,130.44 | −33,009.35 | −3,207.45 | 20,913.64 | 0 | 24.69% |
| Always half11 | 295 /10 | 51,924.98 | −29,094.95 | −2,808.21 | 20,021.83 | −891.80 | 21.35% |
| Structure | 294 /10 | 57,262.90 | −31,616.68 | −3,207.45 | 22,438.77 | +1,525.13 | 22.26% |
| VWAP/ROC | 290 /10 | 55,701.39 | −30,458.32 | −3,207.45 | 22,035.61 | +1,121.98 | 23.19% |
| HL selling | 297 /10 | 54,364.09 | −29,589.55 | −3,207.45 | 21,567.09 | +653.45 | 21.52% |

### Close-confirmed TP

| Setup | Wins / losses | Win$ | Loss$ | Open mark | Net | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 243 /11 | 59,238.41 | −40,192.40 | −3,207.45 | 15,838.56 | 0 | 31.11% |
| Always half11 | 240 /11 | 54,841.58 | −34,377.15 | −2,807.41 | 17,657.02 | +1,818.46 | 26.98% |
| Structure | 236 /11 | 56,943.15 | −39,112.90 | −3,207.45 | 14,622.80 | −1,215.76 | 31.97% |
| VWAP/ROC | 233 /11 | 56,236.75 | −38,950.26 | −3,207.45 | 14,079.03 | −1,759.53 | 32.46% |
| HL selling | 235 /11 | 54,809.78 | −38,282.86 | −3,207.45 | 13,319.46 | −2,519.10 | 32.81% |

These are **not fewer bad exits**: refreshed baseline and all alternatives retain
10 forced closes under resting-touch and12 under close-confirmed. A forced
close can finish episode-positive after partials, so forced count need not equal
losing-episode count. Conditional sizing chiefly changes dollars exposed and
subsequent TP/cycling paths, rather than removing the cascade events.

### Original recent cutoff, for exact comparison with the earlier sizing study

May17 20:43 → **September4 19:01**, not the refreshed September8 totals:

| Setup | Confirmed net /Δ baseline | Resting net /Δ baseline |
|---|---:|---:|
| Baseline | 17,468.13 /0 | 22,759.92 /0 |
| Always half11 | 19,066.09 /+1,597.96 | 21,441.69 /−1,318.23 |
| Structure | 16,252.37 /−1,215.76 | 24,471.80 /+1,711.88 |
| VWAP/ROC | 15,708.60 /−1,759.53 | 23,881.90 /+1,121.98 |
| HL selling | 14,949.03 /−2,519.10 | 23,600.12 /+840.20 |

### What is saved versus sacrificed?

The comparison below includes the invisible side: changed profitable recoveries
and replacement episodes, not just smaller negative exits.

| Model / condition | Winning-dollar change | Losing dollars avoided | Net change |
|---|---:|---:|---:|
| Resting /structure | +132.46 | 1,392.67 | +1,525.13 |
| Resting /VWAP-ROC | −1,429.05 | 2,551.03 | +1,121.98 |
| Resting /HL | −2,766.35 | 3,419.80 | +653.45 |
| Close-confirmed /structure | −2,295.26 | 1,079.50 | −1,215.76 |
| Close-confirmed /VWAP-ROC | −3,001.66 | 1,242.14 | −1,759.53 |
| Close-confirmed /HL | −4,428.64 | 1,909.54 | −2,519.10 |

Conditional rows share the baseline's final open mark, so there is no hidden
mark contribution in this table. Under close-confirmed exits, loss reductions
are only2.69%,3.09%,4.75%; sacrificed winning dollars exceed each saving.

Relative to **always half11**, conditional net differences are:

| Condition | Resting-touch | Close-confirmed |
|---|---:|---:|
| Structure | +2,416.93 | −3,034.22 |
| VWAP/ROC | +2,013.78 | −3,577.99 |
| HL selling | +1,545.25 | −4,337.56 |

All three improve the risk/reward compromise relative to unconditional halving
in the resting model, but none is a robust replacement for both controls.

## Month-by-month: refreshed period

MTM includes changes in the open ladder; it is not just closed-trade income.
Each alternative cell is **its monthly MTM / difference from baseline**.
May and September are partial months. Monthly snapshots retain the canonical
closed-minute boundary convention. The complete `monthly.csv` also contains
monthly cash-realized PnL, W/L counts, winning/losing episode dollars and exposure.

### Resting-touch, dollars rounded to whole dollars

| Month | Baseline MTM | Always half /Δ | Structure /Δ | VWAP-ROC /Δ | HL /Δ |
|---|---:|---:|---:|---:|---:|
| May2026 | 13,483 | 11,911 /−1,573 | 13,296 /−187 | 12,492 /−992 | 12,805 /−678 |
| June | 1,584 | 1,918 /+334 | 3,331 /+1,747 | 3,219 /+1,635 | 3,353 /+1,769 |
| July | −3,950 | −2,380 /+1,570 | −3,723 /+227 | −3,542 /+408 | −3,508 /+442 |
| August | 9,684 | 8,326 /−1,358 | 9,653 /−31 | 9,941 /+257 | 9,154 /−530 |
| September to8th | 112 | 247 /+135 | −118 /−230 | −73 /−186 | −236 /−348 |

### Close-confirmed, dollars rounded to whole dollars

| Month | Baseline MTM | Always half /Δ | Structure /Δ | VWAP-ROC /Δ | HL /Δ |
|---|---:|---:|---:|---:|---:|
| May2026 | 17,131 | 16,332 /−798 | 16,840 /−291 | 16,558 /−572 | 16,420 /−711 |
| June | −2,243 | −3,832 /−1,588 | −3,143 /−899 | −3,290 /−1,046 | −4,092 /−1,849 |
| July | −7,858 | −4,908 /+2,951 | −7,858 /0 | −7,858 /0 | −7,556 /+302 |
| August | 10,239 | 10,483 /+244 | 10,213 /−25 | 10,097 /−141 | 9,977 /−261 |
| September to8th | −1,429 | −419 /+1,010 | −1,429 /0 | −1,429 /0 | −1,429 /0 |

The important difference is June: the apparent saving in the resting model
becomes a net deterioration under close-confirmed exits. July structure and
VWAP/ROC make **no net improvement at all** in the latter path.

### Losing episodes and losing-dollar contributions by month

Cells are **losing episodes / total losing dollars**, not month net.

| Model /month | Baseline | Always half | Structure | VWAP-ROC | HL |
|---|---:|---:|---:|---:|---:|
| Resting May | 0 /0 | 0 /0 | 0 /0 | 0 /0 | 0 /0 |
| Resting June | 5 /−24,396 | 5 /−21,447 | 5 /−23,262 | 5 /−22,316 | 5 /−21,447 |
| Resting July | 4 /−8,542 | 4 /−7,427 | 4 /−8,283 | 4 /−8,071 | 4 /−8,071 |
| Resting August | 1 /−71 | 1 /−221 | 1 /−71 | 1 /−71 | 1 /−71 |
| Resting September | 0 /0 | 0 /0 | 0 /0 | 0 /0 | 0 /0 |
| Confirmed May | 0 /0 | 0 /0 | 0 /0 | 0 /0 | 0 /0 |
| Confirmed June | 6 /−26,870 | 6 /−23,967 | 6 /−25,790 | 6 /−25,628 | 6 /−25,403 |
| Confirmed July | 4 /−13,167 | 4 /−10,189 | 4 /−13,167 | 4 /−13,167 | 4 /−12,724 |
| Confirmed August | 1 /−155 | 1 /−221 | 1 /−155 | 1 /−155 | 1 /−155 |
| Confirmed September | 0 /0 | 0 /0 | 0 /0 | 0 /0 | 0 /0 |

September's zero completed losing episodes does **not** erase the still-open
roughly−$3.2k baseline/conditional position. Month MTM includes it.

For the **original qualification window**, May–August monthly values and
deltas are identical to those above. Replace only September with these rows
through September4 19:01; cells remain monthly MTM /Δ baseline:

| Model | Baseline | Always half /Δ | Structure /Δ | VWAP-ROC /Δ | HL /Δ |
|---|---:|---:|---:|---:|---:|
| Confirmed Sep1–4 | 200.90 | 990.42 /+789.52 | 200.90 /0 | 200.90 /0 | 200.90 /0 |
| Resting Sep1–4 | 1,958.71 | 1,666.83 /−291.87 | 1,915.30 /−43.41 | 1,772.93 /−185.77 | 1,797.13 /−161.58 |

## Long-history check

July1 2025 00:00 → August19 2026 21:32 UTC. All paths end flat.
This is the inherited published window, not the September8 extension. Overlap
with the recent window is not independent evidence.

### Resting-touch

| Setup | W/L | Win$ | Loss$ | Net | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 955 /57 | 187,738.05 | −140,905.55 | 46,832.49 | 0 | 28.17% |
| Always half11 | 926 /55 | 166,260.28 | −126,948.14 | 39,312.14 | −7,520.36 | 25.45% |
| Structure | 951 /56 | 182,241.64 | −134,814.88 | 47,426.76 | +594.26 | 28.63% |
| VWAP/ROC | 927 /56 | 177,430.73 | −135,512.46 | 41,918.27 | −4,914.23 | 30.43% |
| HL selling | 958 /57 | 185,408.09 | −137,485.75 | 47,922.34 | +1,089.84 | 28.17% |

### Close-confirmed

| Setup | W/L | Win$ | Loss$ | Net | Δ baseline | Max DD |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 788 /60 | 190,818.85 | −171,329.22 | 19,489.63 | 0 | 45.65% |
| Always half11 | 774 /58 | 173,903.59 | −150,548.70 | 23,354.89 | +3,865.26 | 31.35% |
| Structure | 779 /59 | 184,304.20 | −167,963.45 | 16,340.76 | −3,148.87 | 43.84% |
| VWAP/ROC | 774 /59 | 185,597.88 | −165,662.05 | 19,935.82 | +446.20 | 36.56% |
| HL selling | 780 /60 | 186,808.84 | −169,419.69 | 17,389.15 | −2,100.48 | 45.65% |

HL has283/295 unknown deep-decision contexts in these confirmed/resting long
runs. Pre-HL months equal baseline because the overlay is inactive, **not**
because that signal passed those regimes. Those long windows cannot certify
pre-HL signal behavior.

### Every long-history month: baseline and MTM deltas

Each alternative below is **Δ vs baseline**, dollars rounded. The full absolute
monthlies, winning/losing amounts and cash-realized differences are in the CSV.

| Month | Confirmed baseline | Half Δ | Structure Δ | VWAP-ROC Δ | HL Δ |
|---|---:|---:|---:|---:|---:|
| 2025-07 | −3,050 | +5,101 | +312 | −706 | 0 |
| 2025-08 | 1,420 | +920 | −167 | −216 | 0 |
| 2025-09 | 6,247 | −437 | +45 | −112 | 0 |
| 2025-10 | 7,167 | −1,706 | −1,214 | +7 | 0 |
| 2025-11 | −688 | −17 | −17 | −240 | 0 |
| 2025-12 | 673 | +674 | +674 | +743 | 0 |
| 2026-01 | −8,750 | +3,112 | +714 | +2,608 | 0 |
| 2026-02 | −6,255 | +1,213 | −500 | +1,853 | 0 |
| 2026-03 | 12,689 | −3,239 | −3,433 | −3,260 | 0 |
| 2026-04 | 2,401 | −783 | +1,242 | +605 | 0 |
| 2026-05 | 15,721 | −2,139 | +94 | +191 | −506 |
| 2026-06 | −2,243 | −1,588 | −899 | −1,046 | −1,849 |
| 2026-07 | −7,858 | +2,951 | 0 | 0 | +302 |
| 2026-08 to19th | 2,017 | −196 | 0 | +22 | −47 |

| Month | Resting baseline | Half Δ | Structure Δ | VWAP-ROC Δ | HL Δ |
|---|---:|---:|---:|---:|---:|
| 2025-07 | 2,668 | −796 | −2,077 | −1,932 | 0 |
| 2025-08 | 561 | −613 | −146 | −1,654 | 0 |
| 2025-09 | 5,608 | −1,257 | −359 | −116 | 0 |
| 2025-10 | 7,325 | −1,896 | +37 | −1,754 | 0 |
| 2025-11 | −1,443 | +617 | +645 | +1 | 0 |
| 2025-12 | −509 | +1,222 | +1,222 | +738 | 0 |
| 2026-01 | −246 | +451 | +164 | +616 | 0 |
| 2026-02 | 4,940 | −300 | −1,104 | +1,226 | 0 |
| 2026-03 | 11,159 | −2,585 | −273 | −862 | 0 |
| 2026-04 | 2,065 | +195 | +220 | +45 | 0 |
| 2026-05 | 15,753 | −4,021 | +291 | −3,131 | −678 |
| 2026-06 | 1,584 | +334 | +1,747 | +1,635 | +1,769 |
| 2026-07 | −3,950 | +1,570 | +227 | +408 | +442 |
| 2026-08 to19th | 1,317 | −442 | 0 | −135 | −442 |

Even ignoring the close-confirmed sensitivity would not establish a clean
resting-model winner: structure worsens long-history DD and has a−$2,077
month; VWAP/ROC loses−$4,914 total; HL has a−$678 month and uncertain prehistory.

## Why the exit path matters

Halving the last add does more than remove half of one rung's profit/loss.
It changes weighted average entry, TP level, selected profitable rungs for S/R
partials, time spent holding inventory and subsequent episode starts.
A smaller below-average add can require a higher recovery price to hit TP.
This is a mechanical explanation, not a claim that every affected add is below average.

Actual replay counterexamples, same entry identity rather than a retrospective
price label:

| Entry UTC /model | Baseline completed episode | Conditional episode | Difference |
|---|---|---|---:|
| 2025-10-20 13:49 /confirmed /structure | TP Oct20 17:04, +$781.28 | Hard flatten Oct21 01:56, −$1,110.81 | −$1,892.10 |
| 2026-05-09 07:01 /resting /VWAP-ROC | Stale TP May9 12:06, +$232.89 | Hard flatten May12 04:00, −$3,381.31 | −$3,614.20 |
| 2026-06-16 12:51 /resting /HL | TP16:02, +$770.41 | Stale TP18:03, +$201.55 | −$568.86 |

These illustrate why reduced size does not guarantee fewer flattens or a better
recovery path. They are explanations alongside the aggregate evidence, not
three selected anecdotes used to override it.

Occupancy is fully replayed. For example, refreshed resting VWAP/ROC improves
same-entry episode PnL by$1,940.42 but loses another$818.44 in the net effect of
35 baseline-only versus30 replacement episodes: total+$1,121.98. Refreshed
confirmed VWAP/ROC improves matched entries by$656.37 but loses$2,415.90 in
the22 baseline-only versus12 replacement episodes: total−$1,759.53. No removed
trades are merely deleted while retaining unavailable replacement opportunities.

## Latest extension and still-open position

September4 19:01 → September8 17:47, **carrying prior inventory and equity**:

| Setup | Confirmed incremental MTM | Resting incremental MTM |
|---|---:|---:|
| Baseline | −1,629.57 | −1,846.28 |
| Always half11 | −1,409.07 | −1,419.86 |
| Structure | −1,629.57 | −2,033.04 |
| VWAP/ROC | −1,629.57 | −1,846.28 |
| HL selling | −1,629.57 | −2,033.04 |

The resting baseline realizes+$1,058.85 while its open mark deteriorates by
−$2,905.13: incremental MTM−$1,846.28. Reporting only the realized cash would
misrepresent this extension. Final full-size baseline mark is−$3,207.45;
unconditional halving reduces it by about$399–400, with no claim that the
position has closed or that this saving is final.

All three conditional overlays retain full-size exposure on the latest
simulated rung11. At its September6 16:07 decision:

- Closed4h context remains above EMA200; trailing12h return is+2.775%.
- Closed15:00–16:00 hourly close88.42 is above own-day VWAP87.4764; ROC5+0.637%.
- Modeled available HL15m/1h ratios are1.3824/1.1675,14/59 samples,60s source age.

None is weak under the frozen definitions. These are **that replay's own
decision inputs**, not substitutes for the actual live15:35 rung11 fill/context
documented in the preceding regroup. Do not retroactively apply later bearish
readings to either entry. A rule evaluated only when adding cannot de-risk a
ladder after the entry has already happened.

## Intervention counts, delivery and cost stress

Original recent window, distinct affected episodes confirmed/resting:
always-half94/100; structure15/19; VWAP/ROC22/35; HL34/47. Structure fails the
minimum20 per model sample criterion before economic screens.

Refreshed resting changed add decisions, **timer-only /price-drop**:
always-half28/81; structure1/18; VWAP-ROC11/27; HL4/44. These are decision
counts, not independent trades. Most interventions are genuine price-drop
adds, not simply timer adds near a local high. None of the primary conditional
HL-window runs has unknown required context at its eligible deep decisions.

### Additional HL delivery lag

| Model | Baseline net | HL normal net | HL+15s | HL+60s |
|---|---:|---:|---:|---:|
| Confirmed refreshed | 15,838.56 | 13,319.46 | 15,838.56 | 15,838.56 |
| Resting refreshed | 20,913.64 | 21,567.09 | 20,913.64 | 20,913.64 |

Each delayed path has **zero interventions** and101/109 unknown deep contexts
for confirmed/resting. Historical HL rows largely omit explicit receipt times.
The baseline already models a one-minute publication delay. At closed-minute
decisions another15s crosses the next decision boundary, leaving the newest
usable event120s old and reducing15m coverage below14 minutes. The unchanged
quality test therefore fails. Adding60s produces the same boundary behavior.
Event timestamps/windows themselves are never shifted forward.

This does not prove live HL cannot be used. It shows this result cannot be
called receipt-robust from these archives. Full sizing on unknown data is the
frozen research behavior, not a newly recommended production safety policy.

### Extra5bps per side, fixed executed paths

Refreshed incremental PnL versus the **equally stressed** baseline:

| Setup | Confirmed stress Δ | Resting stress Δ |
|---|---:|---:|
| Always half11 | +2,548.78 | +104.55 |
| Structure | −706.75 | +1,692.73 |
| VWAP/ROC | −1,181.96 | +1,512.68 |
| HL selling | −1,680.69 | +1,224.43 |

Smaller turnover saves costs, but does not rescue the conditional rules under
close-confirmed exits. This is post-run cost sensitivity on actual turnover
plus final hypothetical exit, not a fresh affordability/TP rerun at a new fee.

## Qualification and ranked verdict

Frozen original-window screens inherited unchanged from L06:

- Profit upgrade: recent gain≥$1,000 and losing-dollar reduction≥10% in **both** TP models; no DD worsening; nonnegative long-window gain; every monthly MTMΔ≥−$250;≥20 affected recent episodes in each model.
- Defensive trade-off: recent losing-dollar reduction≥20% and DD improvement≥3pp in both models; retain≥90% of baseline profit in every case; long-window DD worsening≤0.5pp; every monthly MTMΔ≥−$500; same episode minimum.
- Neither screen grants live deployment. Forward validation remains required.

Ranking by **worst of the two original recent net deltas**; this is not a
new optimization criterion used to retune parameters:

| Conditional rank | Setup | Worst recent Δ | Worst month Δ, all four cases | Profit screen | Defensive screen |
|---|---|---:|---:|---|---|
| 1 | Structure | −1,215.76 | −3,432.74 | Fail | Fail |
| 2 | VWAP/ROC | −1,759.53 | −3,260.28 | Fail | Fail |
| 3 | HL selling | −2,519.10 | −1,849.00 | Fail | Fail |
| Control | Always half11 | −1,318.23 | −4,021.26 | Fail | Fail |

Exact failure arrays are retained in `ranking.json`. All three configurations
are **FALSIFIED for this frozen acceptance screen**, not proof that every
conditional sizing, indicator, HL or S/R idea is useless. The structure result
is sample-limited as well as economically inconsistent. No additional
threshold/depth/AND-OR search was added after inspecting outcomes.

## Verification, reproduction and artifact map

Accepted output: `backtests/hype/hype-conditional-half11-2026-09-08/`.

- `manifest.json`: frozen card, raw input/full-file hashes,16 exact archived raw-prefix matches, original source pins and protected live files.
- `control-parity.json`: **8 exact archived digests**—four baseline and four unconditional-half controls—before conditional runs.
- `results.json` and per-case `*-summary.json`: all34 cases, metrics, deltas against both controls, monthly cash/MTM and W/L, coverage, intervention and inventory audits.
- `*-decisions.jsonl`: exact same baseline decision context plus closed-hour/flow evidence and requested/final sizing. `*-inventory.jsonl`, `*-closes.csv`, `*-partials.csv`: actual resulting fill paths.
- `monthly.csv`: all windows/policies/delivery repeats, including month-by-month winning/losing episode dollars.
- `independent-attribution.json`: matched, removed and replacement episode contribution accounting; selected raw-formula timing witnesses.
- `validation.json`:34 cases,10 preserved extended input-prefix paths, all source/input/state pins unchanged.
- `verification.json`: independent raw4h EMA,12h returns,hourly VWAP/ROC,HL arrival/window math and per-position cash; **6,144 deep checks,128,998 decisions,148,365 fills,15,796 overlapping completed episode records and9,853,310 minute equity checks**. These repeats are not independent sample sizes. Rebuilt DD, every monthly total and extension carry accounting agree.

Source: [runner](../scripts/hype-conditional-half11-study.ts),
[pure sizing rules](../scripts/conditional-half11-policy.ts),
[boundary fixtures](../scripts/conditional-half11-tests.ts),
[independent checker](../scripts/conditional-half11-results-check.ts).
Eight fixture groups passed, as did existing sizing/transactional replay tests,
standard/VPS TypeScript checks and explicit research-script type checking.

Run locally only, with the pinned raw files unchanged and no concurrent sync:

```powershell
npx ts-node scripts/conditional-half11-tests.ts
node --max-old-space-size=12288 -r ts-node/register scripts/hype-conditional-half11-study.ts --out backtests/hype/hype-conditional-half11-recheck
node --max-old-space-size=8192 -r ts-node/register scripts/conditional-half11-results-check.ts backtests/hype/hype-conditional-half11-recheck
```

Runner refuses an existing output directory. Checker refuses to overwrite an
accepted verification. To reproduce the exact latest-data result, restore the
manifest's captured raw-file versions in a separate local worktree; later
appended files change the manifest even if the old prefix remains valid.

No production source, live config, state, order API, PM2 or signal file was
changed by this task. No commit/push or deployment. Coverage inventory:
**5,261 standalone unchanged;45→48 ladder definitions**, with three new
conditional rules and the unconditional control repeated rather than recounted.
