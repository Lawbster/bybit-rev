# RR03: recovery trajectories before construction control

September10,2026. Diagnostic only, not an exit-policy replay. L10's separate
construction experiment uses no result-selected RR03 filter.

## TL;DR

- The fixed four-hour failed-reclaim pattern **does not consistently separate
  future damage from recovery**, in HYPE alone or relative to BTC/SOL. Same55
  primary pressure observations across two TP paths, one censored per path.
- SOL-relative failed reclaim selects **0 later deteriorations /9 improvements**
  in resting-touch versus **3 /8** in close-confirmed. This particular pattern
  is not a dependable instruction to cut the ladder.
- No live changes or new trading definitions from RR03. Negative findings apply
  to these exact categories, not every chart-reading, flow-response or recovery
  mechanism. L10 independently tests six construction policies.

## Scope and the user's discretionary example

The user described HYPE hovering88-90 and an exit around-$460 earlier that day.
No exact decision time was supplied at study freeze. This motivates the question;
neither price88-90 nor loss-$460 is fitted. There is no claim that we reproduced
their actual reading or verified that this particular exit would outperform
holding. Eventual highs/lows or a retrospectively selected exit are not inputs.

Window: **May17,2026 20:43 through September10,2026 05:08 UTC**. Pressure labels
remain the original F01 observations through September8; censored cases are not
silently resolved with later prices. Grid horizons end at the fixed September10
cutoff, with right-edge outcomes censored.

Reuse692 fixed4h clocks and55 primary pressure observations, each under0/60s
modeled source availability. HYPE/BTC/SOL have identical complete-hour masks and
training samples. Overlapping windows/models and timing repetitions are not
independent evidence or untouched holdouts.

## Definition, fixed before outcomes

Use four latest observable completed hourly increments. Fit168 preceding common
hourly returns, at least160 valid, ending BEFORE this four-hour sequence. Keep
that ONE beta/intercept fixed throughout the sequence. HYPE uses raw log returns;
BTC/SOL subtract the fitted reference contribution from HYPE's return.

Cumulative return starts at zero at the known four-hour origin. Categories:

1. Failed reclaim: an earlier cumulative close is positive, final value is
   nonpositive, final increment is negative.
2. Recovering: final two hourly increments strictly positive.
3. Persistent weakness: all four cumulative closes nonpositive, final two
   increments nonpositive.
4. Mixed otherwise; unknown coverage is separate.

Categories are mutually exclusive in this priority. Reclaim means the fixed
four-hour origin, **not a confirmed S/R retest**, ex-post trough, or an exact
model of discretionary chart reading. No new HL/level conjunction is fitted.
[Method](../docs/research/recovery-construction-rr03-l10.md) /
[frozen card](../research-inputs/recovery-construction-2026-09-10.json).

## Pressure points: all observations beside the failed-reclaim subsets

Improvement/deterioration measures subsequent episode-value change from an
already-underwater checkpoint. It is NOT the final episode W/L label. A recovery
can still end with an overall loss. Dollars are existing-path attribution,
**not simulated savings from selling**: actual exits change later inventory.

| TP path / group | Completed n | Later deteriorations | Later improvements | Further loss$ | Subsequent recovery$ |
|---|---:|---:|---:|---:|---:|
| Touch all-pressure baseline |26|4|22|19,266|43,463|
| Touch HYPE failed reclaim |8|2|6|9,360|15,136|
| Touch BTC-relative failed reclaim |6|1|5|4,246|11,450|
| Touch SOL-relative failed reclaim |9|0|9|0|18,109|
| Confirmed all-pressure baseline |27|7|20|24,435|45,726|
| Confirmed HYPE failed reclaim |9|1|8|2,008|20,635|
| Confirmed BTC-relative failed reclaim |7|2|5|983|12,687|
| Confirmed SOL-relative failed reclaim |11|3|8|10,941|19,271|

One censored case is excluded from each all-pressure baseline and each HYPE/BTC
failed-reclaim subset. SOL failed-reclaim subsets have no censored case.

Persistent weakness also reverses its apparent usefulness by model:

| TP path / group | Later deteriorations / improvements | Further loss$ | Subsequent recovery$ |
|---|---:|---:|---:|
| Touch all-pressure baseline |4 /22|19,266|43,463|
| Touch HYPE persistent weakness |1 /10|7,249|17,532|
| Touch SOL-relative persistent weakness |2 /5|12,362|10,181|
| Confirmed all-pressure baseline |7 /20|24,435|45,726|
| Confirmed HYPE persistent weakness |6 /5|22,427|12,268|
| Confirmed SOL-relative persistent weakness |2 /6|4,008|13,229|

Raw HYPE looks more useful in confirmed, while SOL has the more favorable
damage/recovery balance in touch. Neither is consistent. The touch SOL positive
balance is about$2,181 of attribution with seven completed cases, not exit profit.

## Whole-market grid, not selected distressed episodes

Primary0s availability. Subsequent12h horizons overlap; these are not independent
trades, gross portfolio profits or net earnings.

| Group | Completed horizons | Mean next12h return | Mean adverse excursion |
|---|---:|---:|---:|
| All-clock baseline |689|+0.320%|-2.319%|
| HYPE failed reclaim |123|+0.523%|-2.327%|
| BTC-relative failed reclaim |106|+0.319%|-2.279%|
| SOL-relative failed reclaim |114|+0.638%|-2.243%|
| HYPE persistent weakness |54|+0.315%|-1.987%|
| BTC-relative persistent weakness |67|+0.449%|-2.277%|
| SOL-relative persistent weakness |60|+0.052%|-2.164%|

Failed-reclaim groups are not generally followed by negative average returns.
This does not prove buying them is profitable: entry/exit, costs and occupancy
have not been simulated for these categories.

Raw-conditioned cells, own-day VWAP/ROC controls, all months and60s availability
are retained in `trajectory-summary.json`. These descriptive cells are not a
license to choose the best tiny subgroup after seeing outcomes.

## Reproducibility and boundary

The local registry stores separate features/labels, fixed parameters and hashes.
Final run identity and independent verification accompany the L10 economic
findings. No live code/config or canonical engine changes.

This completes the bounded diagnostic, not an exhaustive test of known-level
rejection, faster price/flow response or event-anchored VWAP. Those require a
separate frozen definition rather than rebranding this negative result.
