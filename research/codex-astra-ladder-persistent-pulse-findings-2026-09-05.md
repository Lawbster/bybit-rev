# Persistent pulse holds on deep adds: findings

September 5 follow-up: [the sizing audit](codex-astra-ladder-sizing-findings-2026-09-05.md)
found that this replay reanchored the post-partial add timer, unlike the live
transactional path. Results below remain preserved for that recorded model;
their exact current-stack rankings are not recertified. The follow-up reproduces
the old baseline digests explicitly, then uses corrected baselines for sizing.

September 5, 2026. Local research only; no live config/state, execution,
deployment, commit or push changed.

## TL;DR

- **Six frozen persistent variants, 24 full-path cases, four exact new baseline
  replays.** Each variant is also compared against its exact archived
  nonpersistent control. Those controls are reused, hashed results, not 24
  additional new runs. No engine or strategy-config change.
- **Preventing timer/S/R release does not rescue this family of controls.**
  Persistent two-window confirmation at depth >=9 gives **-$17,824 / -$6,098**
  versus baseline in HL; persistence itself is **-$9,113 / +$6,815** versus
  the same earlier rule. A better version of a losing rule is not a baseline win.
- **0/6 qualify as robust risk improvements.** The mild rung-11 selling hold
  remains profit-positive, but persistence adds only **$92 / $10** to its HL
  result and both HL drawdowns still worsen. No live promotion.

## Frozen hypothesis and actual implementation

The [previous genuine-drop study](codex-astra-ladder-drop-pulse-findings-2026-09-05.md)
showed many holds ended through timer eligibility or leaving resistance. This
was an explicitly limited research predicate, **not a live execution defect**.
The natural follow-up tests whether requiring the flow condition itself to clear
improves the result.

[Specification](../research-inputs/sr-pulse-encounters/ladder-persistent-pulse-2026-09-05.json)
and [method](../docs/research/ladder-persistent-pulse.md) were frozen before runs.
Selected rules: sell15, confirm_both, sr_confirm at next depth 11 and >=9.
No new thresholds, duration sweeps, hysteresis or exit changes.

A known genuine-drop veto arms one episode/next-depth slot. While that same slot
exists, the original timer and moving away from resistance cannot independently
permit the add. Sell15 clears at taker15m >0.85; confirm_both requires 15m >=1.2
AND 1h >=1; sr_confirm additionally requires closed-minute ret15m >0.
After arming, the old zone is no longer needed to clear the restriction.

Only otherwise-approved add opportunities are evaluated. Outer gates, sizing,
partial exits, TP and forced exits remain authoritative and unchanged. Episode
or next-depth changes reset the hold before another eligible add is evaluated.
A partial/full exit can occur without any callback; therefore the stored
`lastObservedHold` is a lazy research observation, not a claimed live state.
No hold can leak into a new episode's first add.

Missing inputs cannot arm, and cannot clear an already armed hold. The latter
differs from the previous stateless overlay's inactive-on-unknown behavior;
it is counted separately rather than hidden inside a claim of perfect
single-variable isolation. This is not a deployed missing-data policy.

## Baseline, accounting and limits

Same archived controls as the preceding pass:

| Case | Window UTC | Baseline net PnL $ | Baseline DD |
|---|---|---:|---:|
| HL close-confirmed | May 17 2026 20:43 -> Sep 4 19:01 | 17413.84 | 31.10% |
| HL resting-touch | Same HL window | 21983.77 | 23.36% |
| Published close-confirmed | Jul 1 2025 -> Aug 19 2026 21:32 | 17071.51 | 47.74% |
| Published resting-touch | Same published window | 43005.85 | 33.00% |

$32k modeled starting equity, $800x1.35 sizing, unchanged exits and 0.055% fees
each side. Final open inventory is marked, not excluded. Episode aggregates
include earlier partials and modeled fees; gross wins/losses mean separate
positive/negative episode sums, not pre-fee figures.

No actual maker/native queue, actual funding, lot rounding, ten-second timing,
network outages, shared-account or liquidation parity is certified. Historical
HL rows without receipt timestamps retain the one-minute publication assumption.
Input as-of and closed-candle causality are tested; exact live receipt is not.

The windows overlap and have been repeatedly examined. Pulse is unknown before
collection began, so pre-HL zero deltas are **inactivity**, not a year of successful
flow-gate validation. Published full-window DD stays unchanged in these runs;
that does not contradict deterioration in the primary HL-window risk path.

## Complete baseline-delta ranking

Short names below omit the artifact ID prefix `hold_`; every row is persistent.
Sorted by the lower HL net-PnL delta. Negative DD/loss reduction means worse.
HL counts are close/touch, not independent observations to pool.

| Persistent rule | HL close $ | HL touch $ | Published close $ | Published touch $ | Min HL DD reduction pp | Min HL loss reduction % | HL veto episodes |
|---|---:|---:|---:|---:|---:|---:|---:|
| drop_sell15_d11 | +458.60 | +3083.80 | +483.41 | +2888.86 | -1.046 | -0.750 | 47 / 53 |
| drop_sr_confirm_d11 | -1094.42 | -2988.88 | -1107.52 | -2958.96 | -5.815 | -7.545 | 12 / 18 |
| drop_confirm_both_d11 | -5788.93 | +1796.45 | -4727.48 | +415.09 | -6.550 | -1.747 | 71 / 75 |
| drop_sr_confirm_d9 | -3184.22 | -8647.23 | -3224.79 | -8395.04 | -12.115 | -7.668 | 38 / 43 |
| drop_sell15_d9 | -7996.80 | -9030.35 | -6597.42 | -9058.92 | -10.249 | -9.747 | 87 / 95 |
| drop_confirm_both_d9 | -17824.26 | -6097.68 | -14398.66 | -3751.99 | -23.770 | -4.124 | 93 / 108 |

## Direct persistence comparison

Dollars below are **persistent minus the exact same nonpersistent rule**, not
improvement versus the deployed-policy baseline.

| Persistent minus same nonpersistent rule | HL close $ | HL touch $ | Published close $ | Published touch $ |
|---|---:|---:|---:|---:|
| drop_sell15_d11 | +92.14 | +9.78 | +77.39 | +20.99 |
| drop_sr_confirm_d11 | +171.75 | -2399.52 | +175.72 | -2245.98 |
| drop_confirm_both_d11 | +989.39 | -67.89 | +1942.33 | -154.26 |
| drop_sr_confirm_d9 | -4064.69 | -5719.58 | -3636.35 | -5569.94 |
| drop_sell15_d9 | +1532.50 | -370.53 | +1053.35 | -285.58 |
| drop_confirm_both_d9 | -9113.28 | +6814.83 | -8183.80 | +6646.38 |

The main ranking and pair table answer different questions. All original
control sources/inputs and the reused control result artifacts are hashed.
Improvement relative to a bad prior variant cannot be presented as new alpha.

## Main findings

### 1. The mild rung-11 positive result barely depends on persistence

The sell15 hold produces HL **+$458.60 / +$3,083.80** versus baseline, and
published **+$483.41 / +$2,888.86**. Persistence adds just **+$92.14 / +$9.78**
in HL and **+$77.39 / +$20.99** in the published controls.

HL DD remains worse: **31.10% -> 31.16%**, **23.36% -> 24.41%**.
Gross losing-episode cost is **+$304.43 worse** in close-confirmed and
**-$2,526.88 better** in resting-touch; no consistent protective effect.
Two fewer HL TP cycles occur in each model, with unchanged forced-close counts.

This remains a real positive model-PnL observation, not a falsified profit sign.
It is a small persistence gain on a model-dependent effect, not the substantial
bleeding reduction requested. Worst monthly delta across cases is -$202.48.

### 2. Strict buying confirmation still sacrifices recovery/cycling

At depth >=9, persistent two-window confirmation:

| HL metric | Close-confirmed | Resting-touch |
|---|---:|---:|
| PnL delta vs baseline | -17824.26 | -6097.68 |
| PnL delta vs nonpersistent | -9113.28 | +6814.83 |
| Baseline DD -> persistent DD | 31.10% -> 54.87% | 23.36% -> 23.72% |
| Gross winning-episode delta $ | -16034.93 | -9740.66 |
| Gross losing-episode cost delta $ | +1674.41 | -4753.35 |
| TP-cycle delta | -38 | -8 |
| Forced-close delta | 0 | +1 |
| Vetoed episodes | 93 | 108 |

The resting-touch benefit from adding persistence is retained in full. It is
still a losing overall intervention, not screened away merely for being
slightly suboptimal. In close-confirmed the tighter hold erases essentially all
baseline net profit: variant total is **-$410.42**.

No variant case reduces its baseline forced-close count. Strict two-window
depth >=9 and S/R-confirmation depth >=9 each add one forced close in both
resting-touch windows. This is timing/exposure redistribution, not demonstrated
avoidance of the historical forced-close pattern.

### 3. Holding after leaving resistance worsens the S/R variant

Depth >=9 S/R confirmation with persistence is **-$3,184 / -$8,647** versus HL
baseline. Compared with the old scope-limited rule, it is **-$4,065 / -$5,720**.
The published comparisons also deteriorate.

Thus the earlier zone-release path was not hiding an otherwise reliable
protective rule. Preventing it does not produce better aggregate results.
This does not falsify new zone geometry, different pulse features or position
sizing; those are different hypotheses and were not added to this pass.

## State-machine evidence

Counts are event/eligible-opportunity counts on each changed replay path, not
independent signals. Repeated held minutes are not new ladder samples. Inventory
resets include a slot change observed at the next eligible add; they are not
automated cancellations or exchange operations.

| HL rule/model | Arms | Flow releases | Inventory resets | Held opportunities | Timer releases prevented | Zone releases prevented | Unknown releases prevented |
|---|---:|---:|---:|---:|---:|---:|---:|
| drop_sell15_d11 / close | 49 | 43 | 6 | 532 | 16 | 0 | 0 |
| drop_sell15_d9 / close | 124 | 113 | 11 | 1435 | 72 | 0 | 0 |
| drop_confirm_both_d11 / close | 74 | 54 | 20 | 4436 | 541 | 0 | 0 |
| drop_confirm_both_d9 / close | 140 | 113 | 27 | 7803 | 751 | 0 | 13 |
| drop_sr_confirm_d11 / close | 13 | 10 | 3 | 749 | 167 | 347 | 0 |
| drop_sr_confirm_d9 / close | 44 | 34 | 10 | 2441 | 179 | 1574 | 0 |
| drop_sell15_d11 / touch | 54 | 48 | 6 | 654 | 33 | 0 | 0 |
| drop_sell15_d9 / touch | 145 | 134 | 11 | 1685 | 58 | 0 | 0 |
| drop_confirm_both_d11 / touch | 76 | 58 | 18 | 4554 | 460 | 0 | 0 |
| drop_confirm_both_d9 / touch | 179 | 147 | 32 | 9219 | 945 | 0 | 13 |
| drop_sr_confirm_d11 / touch | 18 | 14 | 4 | 976 | 176 | 580 | 0 |
| drop_sr_confirm_d9 / touch | 51 | 39 | 12 | 2928 | 205 | 1848 | 0 |

For strong depth >=9 confirmation, the hold prevents 751 / 945 timer-only
permissions and 13 unknown-flow permissions per HL model. For S/R depth >=9
it prevents 1,574 / 1,848 away-from-zone permissions plus 179 / 205 timer
permissions. Persistence really operated; the negative result is not caused by
accidentally leaving the old releases in place.

A timer opportunity may still execute when flow simultaneously clears. That
is a pulse release on a timer-eligible decision, not an independent timer release.

The verifier replays **every** saved decision and gate state in order and checks
all actual opens against those permissions. No open was submitted from a vetoed
decision; all opens fill at the next modeled bar.

## Monthly stability: all six variants

Monthly MTM PnL deltas in dollars versus baseline, rounded. Includes all six,
not only the required top five. Exact realized/MTM and paired monthly deltas
are preserved in the output CSV. May/September HL and August published rows
are partial months. Prefix `hold_` omitted for table width.

### HL close

| UTC month | drop_sell15_d11 | drop_sr_confirm_d11 | drop_confirm_both_d11 | drop_sr_confirm_d9 | drop_sell15_d9 | drop_confirm_both_d9 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | +510 | -314 | -3022 | +13 | -2771 | -5253 |
| 2026-06 | -29 | -837 | -2640 | -3047 | -3949 | -11125 |
| 2026-07 | +18 | +44 | +5 | -191 | -109 | +360 |
| 2026-08 | -40 | +13 | -132 | +41 | -1052 | -1691 |
| 2026-09 | 0 | 0 | 0 | 0 | -115 | -115 |

### HL touch

| UTC month | drop_sell15_d11 | drop_sr_confirm_d11 | drop_confirm_both_d11 | drop_sr_confirm_d9 | drop_sell15_d9 | drop_confirm_both_d9 |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05 | +97 | -249 | -708 | -1108 | -1030 | -2026 |
| 2026-06 | +2967 | -2618 | +1250 | -7393 | -7994 | -2537 |
| 2026-07 | -103 | -91 | -190 | +105 | +63 | +1055 |
| 2026-08 | +325 | -45 | +1396 | -45 | +1039 | -109 |
| 2026-09 | -202 | +15 | +48 | -207 | -1109 | -2482 |

### Published close

| UTC month | drop_sell15_d11 | drop_sr_confirm_d11 | drop_confirm_both_d11 | drop_sr_confirm_d9 | drop_sell15_d9 | drop_confirm_both_d9 |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-08 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-09 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-10 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-11 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-12 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-03 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-04 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-05 | +510 | -314 | -2209 | +13 | -2681 | -3582 |
| 2026-06 | -29 | -837 | -2640 | -3047 | -3949 | -11125 |
| 2026-07 | +18 | +44 | +5 | -191 | -109 | +360 |
| 2026-08 | -16 | 0 | +116 | 0 | +142 | -52 |

### Published touch

| UTC month | drop_sell15_d11 | drop_sr_confirm_d11 | drop_confirm_both_d11 | drop_sr_confirm_d9 | drop_sell15_d9 | drop_confirm_both_d9 |
|---|---:|---:|---:|---:|---:|---:|
| 2025-07 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-08 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-09 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-10 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-11 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2025-12 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-03 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-04 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-05 | +97 | -249 | -708 | -1108 | -1030 | -2026 |
| 2026-06 | +2967 | -2618 | +1250 | -7393 | -7994 | -2537 |
| 2026-07 | -103 | -91 | -190 | +105 | +63 | +1055 |
| 2026-08 | -72 | 0 | +63 | 0 | -98 | -245 |

## Causal hold trace

HL close-confirmed, `hold_drop_confirm_both_d9`, one continuously identified
hold (same episode, next depth **and armedAt**, not a later re-armed slot):

1. **May 18 01:46 UTC**: a genuine rung-10 drop add at $45.745 is vetoed.
   Known 15m ratio **0.85716**, 1h **1.01567**. The hold arms.
2. **02:48 UTC**: the original timer would allow $46.038. Price-drop is false,
   but 15m **1.37167** / 1h **0.78863** does not clear both thresholds.
   The same hold remains; no add is queued.
3. **02:50 UTC**: 15m **1.49962** and 1h **1.03364** clear the hold.
   The next-open add fills at **$45.841**, decision index 761154,
   fill index 761155. It is not backdated to the original trigger.

The release can be cheaper than an intervening timer opportunity while still
more expensive than the initial trigger. None of those isolated prices is the
full portfolio benefit; the entire subsequent path is included in PnL.

## Side observation: add permission is not a dollar exposure cap

The S/R persistent variants in HL resting-touch reach peak surviving **entry-cost
notional** of **$80,747.52**, compared with **$69,768.15** in baseline.
This metric is the sum of surviving positions' entry notionals, not current
mark-price notional or exchange margin usage.

The relevant unchanged engine behavior is:
[partial removal](../scripts/replay-causal-engine.ts) retains unselected positions
(line 121); new rung sizing uses `base * scale ** positions.length` (line 192);
peak notional sums the surviving positions (line 125).
After partials, position count need not represent a fresh ladder's dollar size.
Changing add timing changes that retained-inventory path.

This demonstrates that selectively delaying adds does **not** guarantee lower
peak dollar exposure. It does not establish a production bug or prove that a
new notional cap would improve PnL. No cap/sizing variant was silently added.

## Acceptance and handoff

Same predeclared screens as the prior passes:

- Profit upgrade: both HL models >=$1,000 lift and >=10% gross-loss reduction;
  no case DD worsening; nonnegative published PnL delta; every month >=-$250.
- Defensive trade-off: both HL models >=20% gross-loss reduction and >=3pp DD
  reduction; >=90% baseline total-profit retention in every case; published
  DD worsening <=0.5pp; every month >=-$500.
- Both need >=20 vetoed episodes per HL model. These are research screens, not
  immutable truths, and are not revised after results to manufacture a winner.

**0/6 qualify.** No live or forward promotion from this pass. Persistence is not
a robust rescue for these taker gates. The mild positive result is retained with
its risk limitations rather than relabelled as disproven.

This closes the specific timer/S/R-release explanation for the tested rules.
It does not establish the current config as globally optimal or reject every
possible risk/exposure policy. Dollar exposure after partials is a distinct
unanswered question noted above, not a tested solution.

## Artifacts and verification

- `scripts/hype-ladder-persistent-pulse-study.ts`
- `scripts/ladder-persistent-pulse-policy.ts`
- `scripts/ladder-persistent-pulse-tests.ts`
- `scripts/ladder-persistent-pulse-results-check.ts`
- `backtests/hype/hype-ladder-persistent-pulse-2026-09-05/`

All four baseline digests and metrics exactly match earlier accepted artifacts.
All prior/new input/source/control hashes remain unchanged. The engine and live
config were not modified.

Main/VPS typechecks and persistent, stateless pulse, exposure, current-stack and
causality regression tests passed. Tests cover arming equivalence, boundaries,
timer/zone/unknown hold, pulse release, inventory resets, separate run state,
future-prefix invariance, next-open fills, outer gates and continuing exits.

Read-only post-run verification passed **24 cases, 187,698 decision records,
1,751 arms, 69,710 held opportunities, 1,670 first-veto records, 133,538 execution
records and 1,382 first-veto add releases**, plus all baseline/paired/monthly/
episode accounting and rankings. These totals span overlapping variants/windows,
not independent market observations. First-veto outcomes are deduplicated by
episode/depth; full gate journals preserve repeated re-arming separately.

Accepted SHA-256:

```text
manifest.json 6df74f2e368e06f4dd8654e79b012fc1b6c1f462ccdd68261bad2dc827bd7e0b
results.json 4b11332d2840e6f8395bbe051fe81755e4f754696cb11d5c5de4b0279f056d58
summary.csv 4257e14fd898dda5d6246850948d53839cec7cfa7b58ce33d0ab8d0ff779c349
monthly.csv b47f92c8102fb29926be308edc584bc098120f02e1b26f147795732709bdfa51
ranking.json b49d948771babe475f7bdc728469f1a4a482c1a76e9eb1362ec61c10c81e2434
validation.json 1339aefc26650029334013b7088f93daf8b8c86271bb6d8c0954ee3742e4e7ae
```

Raw histories and generated outputs remain private/local and ignored.
