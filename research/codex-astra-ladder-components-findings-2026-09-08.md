# L09: reconstructing the HYPE ladder, component by component

September 8, 2026. Local research only. **No live configuration, state, strategy,
executor, deployment, commit or push changes.**

## TL;DR

- **138 executions verified: 34 distinct configurations x four comparisons,
  plus two extra historical-cutoff checks. Six full-current result digests
  match the accepted L08 archive exactly.** This is a controlled policy audit,
  not a claim of exact historical live fills or a globally optimal configuration.
- **The bare ladder does not reach zero modeled equity in these two start-date
  scenarios, but its long-history drawdown is 75-77% and its longest cycle is
  approximately 245 days.** The recent window alone looks much better: about
  $44k-$47k net with 26% DD. Do not hide that favorable recent result; equally,
  do not erase the much worse historical tail and capital lock-up.
- **The current stack is not shown to be profit-optimal.** Removing soft-stale
  TP or the deep negative-funding guard improves aggregate net and DD in all
  four cases. Removing S/R partials also raises net in all four, but the recent
  touch gain is just $150 and losing-dollar costs increase in both recent models.
  **0/17 removals passes the complete frozen monthly screen.** Retain specific
  refinement leads rather than declaring every current feature optimal or
  switching off the exit protections wholesale.

## 1. What happened to the old approximately $60k baseline?

The remembered scale is real. These are different model generations, not a
measurement of gates gradually destroying $40k of live profit.

Same long window throughout this table: **July 1, 2025 00:00 to August 19, 2026
21:32 UTC**, $32,000 initial simulated equity, $800 x1.35 /11 sizing.

| Model generation | Modeled net PnL | What the comparison means |
| --- | ---: | --- |
| Old default feature coverage | $82,912.67 | Earlier RSI/CRSI/slope context was missing over 459,159 trading minutes |
| Same old execution, full indicator coverage | $65,177.46 | Restoring configured filters changed paths, not thresholds |
| Input-time repair and rebuilt latch, still old execution | $64,976.97 | Additional timing/publication/latch repair package: -$200.49 versus the preceding row |
| Current corrected execution/state/history: close-confirmed TP | $19,489.63 | Later decisions and fills; current shared policy/state behavior |
| Current corrected execution/state/history: prior-resting-target touch | $46,832.49 | Different explicit intraminute TP assumption, not a different live config |

The large remaining difference combines execution and policy/state/coverage
repairs. Old price-drop adds could claim earlier candle lows after deciding at
its close; new stale targets could benefit from that candle's earlier high.
State clocks, S/R policy matching and reconstructed candle coverage also changed.
**Do not attribute the entire difference to one look-ahead bug.**

Sources: [original parity audit](codex-astra-current-stack-parity-findings-2026-09-04.md),
[input repair](codex-astra-replay-causality-repair-2026-09-04.md),
[execution foundation](codex-astra-current-stack-foundation-findings-2026-09-04.md),
[candle recovery](codex-astra-candle-gap-recovery-findings-2026-09-05.md),
[transactional partial-clock correction](codex-astra-ladder-sizing-findings-2026-09-05.md).

The latest **$20,913.64 touch /$15,838.56 confirmed** control is instead the
separately initialized **May 17-September 8** window. Comparing that $20k
directly with the old $65k long-window number mixes both dates and models.

## 2. Exact scope and baseline

| Constant | Value |
| --- | --- |
| Bare baseline | B00: time-only ladder, normal batch TP retained |
| Current-stack control | B17: current local policy, all 17 tested components enabled |
| Starting equity | $32,000 flat in each window, matching earlier studies; not silently changed to $30k |
| Ladder | $800 first rung, multiplier1.35, 11 retained rungs, 25x modeled affordability |
| Fresh full-ladder entry cost | $59,757.37; rung11 $16,085.24 |
| Bare timing /TP | 30-minute adds; normal1.4% batch TP; no protective exits or strategy gates |
| B01 | Adds the current **0.3% drop OR 30-minute timer**; not a drop-only ladder |
| Long period | 2025-07-01 00:00 to 2026-08-19 21:32 UTC |
| Recent period | 2026-05-17 20:43 to 2026-09-08 17:47 UTC |
| Fees | 0.055% entry and exit, already deducted; final open mark includes hypothetical exit fees |
| TP execution | Both close-confirmed/next-open and subsequent touch of an already active target |
| Not simulated | Actual funding cashflows, maker queue/cancel/fallback, exact lot rounding, manual pauses, short/shared-account inventory, exchange liquidation |

These windows overlap and are already mined development data, not independent
holdouts. Every row uses its policy throughout the window, not the sequence of
actual deployments. Current local config hash:
`5b4ce89f5cf3d66b70bd118fab95697f8c6f5b26253d3d7a484555856153dba5`.

The build-up order is explanatory, not deployment chronology. Full-minus-one
tests separately remove each component from B17; they are not a second cumulative
removal sequence. **There are 18 build-up states and 17 removal references,
but only 34 unique configurations:** full-minus-latch is exactly B16.

Actual dependencies are preserved:

- Turning off the current trend switch also removes the hostile-trend result
  used by hard flatten. That row is not an invented independent entry-only gate.
- Removing deep funding stress makes support-reopen redundant; the exception
  does not become a standalone entry signal.
- Daily breaker and damaged latch are independently masked.
- Forced-exit cooldown removal means zero additional hours; TP cooldown stays
  separate. Transactional timing/ownership assumptions remain unchanged.
- S/R selected-rung partials preserve the last actual add clock. They do not
  reanchor to the newest retained rung as the legacy helper did.

The cumulative B04 long/touch run is an artificial incomplete stack and becomes
non-survivable: first low-mark equity <=0 at **2026-01-19 00:03 UTC**. Its later
-$32,849 total is diagnostic, not a tradeable return. This does not establish
that adding a trend gate to an otherwise different complete stack causes ruin.

Method, exact switches and local rerun commands:
[component-audit contract](../docs/research/ladder-component-audit.md).
Frozen [experiment card](../research-inputs/ladder-components-2026-09-08.json).

## 3. What this says about the current components

### Strong aggregate downside-protection evidence

- **Trend and hard flatten:** removing either permits 77-93% long-window DD,
  versus current28.17%/45.65%. Recent close-confirmed results can improve without
  them, but that does not cancel the longer-history tail.
- **Damaged latch:** removing it costs $6,525/$5,668 in both respective long and
  recent paths. Recent DD rises from24.69% to32.44% and31.11% to43.51%.
- **Daily breaker:** no marginal recent trade changes, but removing it loses
  about $5.8k and adds about12pp DD in both long models.
- **Deep time-add throttle:** removing it loses $19.7k/$14.2k over the long
  period and worsens DD. Its recent benefit is less uniform.
- **Percentage-triggered adds:** removing them lowers net in all four cases.
  They also carry risk: the confirmed models have lower DD without them.
- **Positive-funding spike exit:** helps long-period net and DD; removing it
  gains only about $660 recently but loses $8.1k-$11.4k over the longer period.
- **Support-reopen:** retaining the narrow exception is net-positive in all
  four comparisons, approximately $1.5k-$2.0k.

These statements concern the tested marginal effects, not proofs that existing
thresholds are uniquely optimal or that every month benefits.

### First refinement lead: soft-stale TP

This removes only the age-based reduction from 1.4% to 0.5%. S/R partials, ordinary
TP, hard/emergency/funding exits, entry gates and sizing remain enabled.

| Period /model | Current net | No soft-stale net | Net change | Current DD -> no soft-stale DD |
| --- | ---: | ---: | ---: | --- |
| Long /touch | $46,832 | $59,178 | +$12,346 | 28.17% ->25.48% |
| Long /confirmed | $19,490 | $51,156 | +$31,666 | 45.65% ->27.91% |
| Recent /touch | $20,914 | $27,738 | +$6,824 | 24.69% ->24.19% |
| Recent /confirmed | $15,839 | $30,085 | +$14,246 | 31.11% ->28.13% |

Here is the user-requested winner/loser view, not just net improvement:

| Recent touch model | Current | No soft-stale |
| --- | ---: | ---: |
| Winning /losing episodes | 295 /10 | 188 /10 |
| Winning-episode dollars | +$57,130 | +$66,565 |
| Losing-episode dollars | -$33,009 | -$35,619 |
| Realized net | +$24,121 | +$30,946 |
| Remaining open mark | -$3,207 | -$3,208 |
| Net including open | +$20,914 | +$27,738 |
| Forced closes | 10 | 12 |

| Recent confirmed model | Current | No soft-stale |
| --- | ---: | ---: |
| Winning /losing episodes | 243 /11 | 158 /10 |
| Winning-episode dollars | +$59,238 | +$71,783 |
| Losing-episode dollars | -$40,192 | -$38,490 |
| Realized net | +$19,046 | +$33,294 |
| Remaining open mark | -$3,207 | -$3,209 |
| Net including open | +$15,839 | +$30,085 |
| Forced closes | 12 | 11 |

In the long touch model, winner income rises **$43,468** but losing-cycle costs
also rise **$31,122**. In recent touch, those figures are **+$9,434 winner income
and +$2,609 loss cost**. This is not a uniform bleeding-reduction mechanism.

Monthly failures matter: long touch January2026 changes from **-$246 to-$4,710**;
recent touch July changes from **-$3,950 to-$6,426**. Long confirmed February
worsens by **$1,194**. The overall improvement is substantial, but a wholesale
switch-off fails the frozen no-materially-worse-month condition.

### Second refinement lead: deep negative-funding guard

Removing the requirement that deep time-only adds wait for a qualifying price
drop during negative funding improves net/DD in all four cases:

| Period /model | Current net | No deep guard net | Net change | Current DD -> no guard DD |
| --- | ---: | ---: | ---: | --- |
| Long /touch | $46,832 | $51,066 | +$4,234 | 28.17% ->26.71% |
| Long /confirmed | $19,490 | $23,138 | +$3,649 | 45.65% ->36.22% |
| Recent /touch | $20,914 | $22,613 | +$1,700 | 24.69% ->23.56% |
| Recent /confirmed | $15,839 | $19,215 | +$3,377 | 31.11% ->29.72% |

Again, not a uniformly smaller losing bill. Recent touch losing dollars rise
**$1,457**, while winner income rises **$3,157**. Recent confirmed losses fall
**$1,247**, while winner income rises **$2,130**. Monthly costs include **-$457**
in recent touch July, **-$1,935** in recent confirmed May, and **-$3,045** in
long confirmed May. Investigate where the guard blocks useful expansion;
do not equate negative funding alone with reliably harmful price action.

### S/R partials: positive booked trims are not proof of incremental benefit

Removing partials raises net by **$5,392/$16,243 long** and **$150/$8,192 recent**
(touch/confirmed). No partials means retained-count recycling disappears too;
its effect is not just subtracting the profitable trim journal.

But the recent touch gain is small, and both recent losing-dollar totals become
worse without partials: **+$1,956 /+$590** loss cost. Recent touch W/L changes
295/10 ->303/9; confirmed243/11 ->251/11. Long touch DD increases slightly,
and historical monthly costs reach **-$4,039** (July2025 touch) and **-$4,803**
(March2026 confirmed). Not a robust immediate removal.

### Mixed or marginal components

Post-TP cooldown, first-entry overextension, emergency exit and post-forced-exit
cooldown have material model/period differences. For example, removing forced
cooldown gains **$1,993** recently under touch but loses **$5,513** under confirmed,
with confirmed DD worsening9.59pp.

Removing ladder-local kill produces identical economic outcomes in all four
cases. Its blocked-minute counter is not evidence that an otherwise possible
add was prevented: many blocked minutes are already at the rung cap. BTC
risk-off removal changes only **$7.67** in the touch paths and zero in confirmed.
These are observations of marginal redundancy/thin intervention on this tape,
not recommendations to delete safety checks.

## 4. Bare ladder: the visible profits and the hidden inventory cost

Completed wins are flat-to-flat ladder episodes, including any earlier partial
PnL. Remaining open inventory is never disguised as a completed zero-loss trade.
Bare ladders have no forced loss-taking rule, so their 100% completed win rates
say little about tail safety.

In the recent touch run, the bare ladder remains in one cycle from
**July7 15:31 to August19 19:20 UTC**, over43days. In the longer run its longest
cycle is approximately245days, including a roughly65% drop from that ladder's
average entry. Earlier booked profits fund some of that drawdown; different
starting dates/capital could fail. No maintenance-margin/funding certification
is supplied here.

The current long/touch stack captures **953 TP cycles versus120 bare**, but pays
for that turnover and realizes losses to recycle inventory. Winning dollars
rise from$45,425 to$187,738; losing dollars rise from$0 realized to$140,906.
Its long DD falls76.57% ->28.17%. Conversely, recent bare net is far higher
and its DD is only modestly higher under touch, or lower under confirmed.
Both sides belong in the comparison.

The cumulative and removal tables below are rounded for readability. Full
precision, every policy's W/L dollars/counts, all monthly realized/MTM rows, and
inventory are in the local artifacts. **Dollar PnL is already net of modeled
fees; do not subtract fee rows again.**

## Cumulative build-up: long period

| ID | Added component | Touch net | Touch DD | Confirmed net | Confirmed DD |
| --- | --- | --- | --- | --- | --- |
| B00 | BARE time-only ladder + normal TP | +$45,437 | 76.57% | +$47,721 | 75.43% |
| B01 | + 0.3% alternative price-drop adds | +$45,899 | 75.60% | +$46,860 | 73.93% |
| B02 | + 4h soft-stale TP adjustment | +$45,271 | 77.45% | +$49,466 | 73.13% |
| B03 | + -14% emergency exit | +$29,931 | 92.15% | +$40,773 | 80.37% |
| B04 | + 4h EMA trend gate (also hard-flatten dependency) | -$32,849 *FAILED* | 102.15% | +$25,643 | 93.06% |
| B05 | + 12h/-2% hostile-trend flatten | +$14,809 | 49.54% | +$33,239 | 31.21% |
| B06 | + 4h-boundary forced-exit cooldown | +$16,585 | 59.91% | +$31,514 | 43.23% |
| B07 | + 12h/-3% adds-only kill | +$16,585 | 59.91% | +$31,514 | 43.23% |
| B08 | + BTC hourly drop gate | +$16,585 | 59.91% | +$31,514 | 43.23% |
| B09 | + 5 red /2 non-red daily gate | +$21,253 | 44.13% | +$35,880 | 32.07% |
| B10 | + First-rung slope/CRSI/RSI gate | +$21,375 | 46.18% | +$33,084 | 34.22% |
| B11 | + Deep falling-price time-add throttle | +$33,211 | 33.23% | +$32,009 | 33.04% |
| B12 | + Deep negative-funding price-drop requirement | +$26,906 | 33.71% | +$23,087 | 31.65% |
| B13 | + Hot-RSI post-TP cooldown | +$31,550 | 36.09% | +$14,871 | 38.48% |
| B14 | + Deep positive-funding spike exit | +$44,118 | 28.23% | +$26,072 | 30.74% |
| B15 | + Resistance/pulse profitable selected-rung partial | +$36,845 | 28.17% | +$10,904 | 45.65% |
| B16 | + Support/pulse funding-only reopen exception | +$40,308 | 28.17% | +$13,821 | 45.65% |
| B17 | + Persistent EMA/HL damaged-regime gate | +$46,832 | 28.17% | +$19,490 | 45.65% |

## Cumulative build-up: recent period

| ID | Added component | Touch net | Touch DD | Confirmed net | Confirmed DD |
| --- | --- | --- | --- | --- | --- |
| B00 | BARE time-only ladder + normal TP | +$43,929 | 26.40% | +$46,864 | 25.69% |
| B01 | + 0.3% alternative price-drop adds | +$48,875 | 29.80% | +$49,504 | 29.32% |
| B02 | + 4h soft-stale TP adjustment | +$45,936 | 31.32% | +$47,613 | 29.98% |
| B03 | + -14% emergency exit | +$29,564 | 30.13% | +$31,670 | 29.08% |
| B04 | + 4h EMA trend gate (also hard-flatten dependency) | +$22,779 | 37.89% | +$27,941 | 32.12% |
| B05 | + 12h/-2% hostile-trend flatten | +$18,002 | 40.75% | +$21,281 | 37.89% |
| B06 | + 4h-boundary forced-exit cooldown | +$26,856 | 30.73% | +$28,042 | 31.75% |
| B07 | + 12h/-3% adds-only kill | +$26,856 | 30.73% | +$28,042 | 31.75% |
| B08 | + BTC hourly drop gate | +$26,856 | 30.73% | +$28,042 | 31.75% |
| B09 | + 5 red /2 non-red daily gate | +$26,856 | 30.73% | +$28,042 | 31.75% |
| B10 | + First-rung slope/CRSI/RSI gate | +$27,223 | 30.48% | +$27,316 | 31.69% |
| B11 | + Deep falling-price time-add throttle | +$27,996 | 28.89% | +$25,787 | 33.77% |
| B12 | + Deep negative-funding price-drop requirement | +$19,866 | 31.13% | +$19,748 | 33.82% |
| B13 | + Hot-RSI post-TP cooldown | +$14,876 | 36.16% | +$15,787 | 39.45% |
| B14 | + Deep positive-funding spike exit | +$12,956 | 36.16% | +$14,369 | 39.45% |
| B15 | + Resistance/pulse profitable selected-rung partial | +$10,926 | 36.37% | +$7,253 | 47.02% |
| B16 | + Support/pulse funding-only reopen exception | +$14,389 | 32.44% | +$10,170 | 43.51% |
| B17 | + Persistent EMA/HL damaged-regime gate | +$20,914 | 24.69% | +$15,839 | 31.11% |

## Full-minus-one net deltas vs B17

B17 reference net, same column order: **$46,832 / $19,490 / $20,914 / $15,839**.
Positive dollar deltas below favor removing the named component; negative deltas favor keeping it.

| Removed | Long / touch | Long / confirmed | Recent / touch | Recent / confirmed |
| --- | --- | --- | --- | --- |
| price_drop | -$35,991 | -$6,140 | -$10,246 | -$973 |
| soft_stale | +$12,346 | +$31,666 | +$6,824 | +$14,246 |
| emergency | -$4,541 | +$6,557 | -$4,541 | -$7,623 |
| trend | -$13,468 | +$4,224 | -$453 | +$6,662 |
| hard_flatten | -$19,782 | +$3,112 | -$2,118 | +$5,902 |
| forced_cooldown | +$5,262 | +$131 | +$1,993 | -$5,513 |
| local_kill | +$0 | +$0 | +$0 | +$0 |
| btc_riskoff | +$8 | +$0 | +$8 | +$0 |
| daily_regime | -$5,802 | -$5,857 | +$0 | +$0 |
| overextended | -$1,101 | +$2,055 | -$1,291 | +$3,791 |
| add_throttle | -$19,721 | -$14,176 | +$1,419 | -$1,821 |
| deep_stress | +$4,234 | +$3,649 | +$1,700 | +$3,377 |
| tp_cooldown | -$8,440 | +$17,639 | +$2,253 | +$10,311 |
| funding_spike | -$11,386 | -$8,080 | +$659 | +$663 |
| sr_partial | +$5,392 | +$16,243 | +$150 | +$8,192 |
| sr_support | -$1,986 | -$1,525 | -$1,986 | -$1,525 |
| damaged_latch | -$6,525 | -$5,668 | -$6,525 | -$5,668 |

## Full-minus-one drawdown changes vs B17 (positive = WORSE)

B17 reference DD, same column order: **28.17% / 45.65% / 24.69% / 31.11%**.
Changes below are percentage points, not percent changes. Display rounding can hide tiny differences.

| Removed | Long / touch | Long / confirmed | Recent / touch | Recent / confirmed |
| --- | --- | --- | --- | --- |
| price_drop | 5.12 | -10.57 | -2.42 | -10.62 |
| soft_stale | -2.69 | -17.74 | -0.50 | -2.98 |
| emergency | 0.00 | -13.75 | 8.80 | 13.11 |
| trend | 53.62 | 47.55 | -0.62 | -6.83 |
| hard_flatten | 48.91 | 47.13 | 0.34 | -6.77 |
| forced_cooldown | -2.15 | -9.93 | -2.24 | 9.59 |
| local_kill | 0.00 | 0.00 | 0.00 | 0.00 |
| btc_riskoff | 0.00 | 0.00 | 0.00 | 0.00 |
| daily_regime | 12.21 | 12.63 | 0.00 | 0.00 |
| overextended | -0.58 | 0.00 | 0.47 | -5.71 |
| add_throttle | 26.02 | 6.47 | -0.64 | 6.06 |
| deep_stress | -1.46 | -9.43 | -1.13 | -1.39 |
| tp_cooldown | -0.23 | -22.01 | -2.49 | -10.46 |
| funding_spike | 7.47 | 8.69 | 0.00 | 0.07 |
| sr_partial | 0.06 | -14.91 | -0.89 | -6.16 |
| sr_support | 0.00 | 0.00 | 1.97 | 0.64 |
| damaged_latch | 0.00 | 0.00 | 7.75 | 12.40 |

## W/L Long / touch

| Metric | Bare B00 | Bare+drop B01 | Current B17 |
| --- | --- | --- | --- |
| Wins /losses | 120 /0 | 95 /0 | 955 /57 |
| Winning dollars | +$45,425 | +$45,654 | +$187,738 |
| Losing dollars | +$0 | +$0 | -$140,906 |
| Realized | +$45,425 | +$45,654 | +$46,832 |
| Open | +$12 | +$245 | +$0 |
| Total | +$45,437 | +$45,899 | +$46,832 |
| Max DD | 76.57% | 75.60% | 28.17% |
| Min equity | +$12,049 | +$12,671 | +$30,236 |
| Longest episode days | 245.52 | 245.54 | 10.32 |
| TP /forced /partial | 120 /0 /0 | 95 /0 /0 | 953 /59 /192 |
| Fees incl open mark | -$3,905 | -$3,989 | -$36,783 |

## W/L Long / confirmed

| Metric | Bare B00 | Bare+drop B01 | Current B17 |
| --- | --- | --- | --- |
| Wins /losses | 99 /0 | 80 /0 | 788 /60 |
| Winning dollars | +$47,721 | +$46,605 | +$190,819 |
| Losing dollars | +$0 | +$0 | -$171,329 |
| Realized | +$47,721 | +$46,605 | +$19,490 |
| Open | +$0 | +$255 | +$0 |
| Total | +$47,721 | +$46,860 | +$19,490 |
| Max DD | 75.43% | 73.93% | 45.65% |
| Min equity | +$12,870 | +$13,842 | +$27,028 |
| Longest episode days | 245.51 | 245.52 | 10.32 |
| TP /forced /partial | 99 /0 /0 | 80 /0 /0 | 785 /63 /183 |
| Fees incl open mark | -$3,782 | -$3,695 | -$33,739 |

## W/L Recent / touch

| Metric | Bare B00 | Bare+drop B01 | Current B17 |
| --- | --- | --- | --- |
| Wins /losses | 152 /0 | 136 /0 | 295 /10 |
| Winning dollars | +$47,232 | +$52,237 | +$57,130 |
| Losing dollars | +$0 | +$0 | -$33,009 |
| Realized | +$47,232 | +$52,237 | +$24,121 |
| Open | -$3,303 | -$3,362 | -$3,207 |
| Total | +$43,929 | +$48,875 | +$20,914 |
| Max DD | 26.40% | 29.80% | 24.69% |
| Min equity | +$30,153 | +$30,508 | +$31,410 |
| Longest episode days | 43.16 | 43.70 | 4.09 |
| TP /forced /partial | 152 /0 /0 | 136 /0 /0 | 295 /10 /87 |
| Fees incl open mark | -$4,122 | -$4,552 | -$10,957 |

## W/L Recent / confirmed

| Metric | Bare B00 | Bare+drop B01 | Current B17 |
| --- | --- | --- | --- |
| Wins /losses | 117 /0 | 110 /0 | 243 /11 |
| Winning dollars | +$50,150 | +$52,859 | +$59,238 |
| Losing dollars | +$0 | +$0 | -$40,192 |
| Realized | +$50,150 | +$52,859 | +$19,046 |
| Open | -$3,286 | -$3,355 | -$3,207 |
| Total | +$46,864 | +$49,504 | +$15,839 |
| Max DD | 25.69% | 29.32% | 31.11% |
| Min equity | +$30,294 | +$30,171 | +$30,371 |
| Longest episode days | 43.16 | 43.73 | 7.00 |
| TP /forced /partial | 117 /0 /0 | 110 /0 /0 | 242 /12 /72 |
| Fees incl open mark | -$4,013 | -$4,186 | -$9,779 |

## Top five by smaller recent net delta across TP models (not qualification)

Soft stale: +$6,824; TP cooldown: +$2,253; deep stress: +$1,700;
funding spike: +$659; S/R partial: +$150. These are the smaller of the two
recent net improvements, not proof that removing the rule is advisable.

Monthly tables below include carried inventory at each month-end. First/last
months are partial at the exact window boundaries above. Bare and current columns
are absolute MTM PnL; every removal column is its change versus current B17.
Monthly realized cash and exit-cohort W/L are separately available in monthly.csv.

## Monthly MTM Long / touch

| Month | Bare absolute | Current absolute | minus_soft_stale delta | minus_tp_cooldown delta | minus_deep_stress delta | minus_funding_spike delta | minus_sr_partial delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | +$583 | +$2,668 | -$880 | -$352 | +$557 | -$4,929 | -$4,039 |
| 2025-08 | +$5,549 | +$561 | +$2,092 | +$2,724 | +$217 | +$602 | +$483 |
| 2025-09 | -$831 | +$5,608 | +$2,685 | +$37 | -$0 | -$4,058 | -$1,465 |
| 2025-10 | -$1,606 | +$7,325 | +$6,165 | -$3,964 | +$170 | -$3,001 | +$4,738 |
| 2025-11 | -$11,998 | -$1,443 | +$2,262 | -$839 | -$44 | +$0 | +$2,674 |
| 2025-12 | -$6,549 | -$509 | +$2,073 | +$752 | +$1,013 | +$0 | -$740 |
| 2026-01 | +$5,663 | -$246 | -$4,465 | +$1,065 | -$57 | -$0 | +$4,268 |
| 2026-02 | +$216 | +$4,940 | +$1,045 | -$10,332 | -$756 | +$0 | +$541 |
| 2026-03 | +$5,520 | +$11,159 | -$3,312 | +$3,000 | +$4,320 | +$0 | -$1,226 |
| 2026-04 | +$3,086 | +$2,065 | +$5,678 | +$760 | -$924 | +$0 | +$779 |
| 2026-05 | +$32,575 | +$15,753 | +$702 | -$498 | -$267 | +$0 | +$840 |
| 2026-06 | +$5,375 | +$1,584 | +$328 | +$32 | -$412 | +$0 | -$889 |
| 2026-07 | -$8,317 | -$3,950 | -$2,477 | -$1,089 | -$457 | +$0 | -$428 |
| 2026-08 | +$16,171 | +$1,317 | +$449 | +$263 | +$876 | +$0 | -$145 |

## Monthly MTM Long / confirmed

| Month | Bare absolute | Current absolute | minus_soft_stale delta | minus_tp_cooldown delta | minus_deep_stress delta | minus_funding_spike delta | minus_sr_partial delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | +$1,045 | -$3,050 | +$4,313 | +$4,781 | +$494 | -$1,788 | +$3,981 |
| 2025-08 | +$6,068 | +$1,420 | +$318 | +$2,788 | +$1,077 | +$1,367 | -$37 |
| 2025-09 | -$902 | +$6,247 | +$1,054 | -$480 | +$0 | -$4,400 | -$806 |
| 2025-10 | -$1,612 | +$7,167 | +$3,896 | -$2,935 | +$2,656 | -$3,130 | +$4,546 |
| 2025-11 | -$12,041 | -$688 | +$1,600 | -$1,822 | -$66 | +$0 | +$696 |
| 2025-12 | -$6,573 | +$673 | +$2,529 | +$300 | -$202 | -$0 | -$517 |
| 2026-01 | +$5,683 | -$8,750 | +$5,330 | +$12,695 | +$923 | +$0 | +$1,486 |
| 2026-02 | +$217 | -$6,255 | -$1,194 | +$1,936 | +$982 | -$0 | +$1,896 |
| 2026-03 | +$5,540 | +$12,689 | +$1,221 | -$4,638 | -$2,174 | +$0 | -$4,803 |
| 2026-04 | +$3,097 | +$2,401 | +$3,396 | -$2,421 | -$493 | +$0 | +$1,613 |
| 2026-05 | +$33,418 | +$15,721 | +$6,515 | -$1,343 | -$3,045 | +$0 | +$3,226 |
| 2026-06 | +$6,137 | -$2,243 | +$741 | +$5,104 | +$2,407 | -$128 | +$1,712 |
| 2026-07 | -$8,787 | -$7,858 | +$1,874 | +$3,220 | +$1,007 | +$0 | +$3,191 |
| 2026-08 | +$16,430 | +$2,017 | +$75 | +$455 | +$85 | +$0 | +$59 |

## Monthly MTM Recent / touch

| Month | Bare absolute | Current absolute | minus_soft_stale delta | minus_tp_cooldown delta | minus_deep_stress delta | minus_funding_spike delta | minus_sr_partial delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | +$18,206 | +$13,483 | +$4,982 | +$2,977 | +$1,600 | +$0 | +$965 |
| 2026-06 | +$5,375 | +$1,584 | +$328 | +$32 | -$412 | +$0 | -$889 |
| 2026-07 | -$8,317 | -$3,950 | -$2,477 | -$1,089 | -$457 | +$0 | -$428 |
| 2026-08 | +$29,449 | +$9,684 | +$4,490 | +$403 | +$942 | +$659 | +$9 |
| 2026-09 | -$786 | +$112 | -$498 | -$70 | +$26 | +$0 | +$492 |

## Monthly MTM Recent / confirmed

| Month | Bare absolute | Current absolute | minus_soft_stale delta | minus_tp_cooldown delta | minus_deep_stress delta | minus_funding_spike delta | minus_sr_partial delta |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05 | +$19,628 | +$17,131 | +$4,860 | -$460 | -$1,935 | +$0 | +$2,424 |
| 2026-06 | +$6,137 | -$2,243 | +$741 | +$5,104 | +$2,407 | -$128 | +$1,712 |
| 2026-07 | -$8,787 | -$7,858 | +$1,874 | +$3,220 | +$1,007 | +$0 | +$3,191 |
| 2026-08 | +$30,343 | +$10,239 | +$5,593 | +$1,747 | +$1,019 | +$792 | +$723 |
| 2026-09 | -$458 | -$1,429 | +$1,178 | +$700 | +$879 | +$0 | +$142 |

## Qualification and conclusions

The predeclared removal screen requires at least+$1,000 in each recent model,
nonnegative net change in each long model, no greater DD in any case, and no
month more than$250 worse than current B17. Insolvency fails. **0/17 passes.**
This is a conservative advancement screen, not a statistical significance test;
it does not turn the sizeable soft-stale aggregate result into "nothing."

The strongest next research question is the **soft-stale exit mechanism**,
followed by **deep funding stress**. The current stack's tail protection is
valuable, but it is not justified to say every feature is profit-optimal. The
evidence favors refining the income-versus-loss trade-off of particular layers,
not returning to an unprotected ladder or combining removals without testing.
No such refinement, additional threshold search, or combination was run here.

### Fee-execution sensitivity, not a maker simulation

All primary rows deliberately retain 0.055% exits. As a fixed-ledger arithmetic
sensitivity only, crediting every full TP exit the 0.035 percentage-point maker
discount would reduce the no-soft-stale advantage to approximately **+$8,576 /
+$28,270 long** and **+$5,729 /+$13,475 recent** (touch/confirmed). The advantage
remains positive in this hypothetical calculation, but **these are not attainable
maker results or rerun strategy paths**: every TP filling entirely as maker is
assumed, and there is no queue, cancellation, partial-fill, protection-delay,
funding or margin-path reconstruction.

Credit formula: sum of full TP/stale-TP exit quantity x exit price x0.00035.
No credit is applied to S/R partials, forced exits or final open inventory.
This distinguishes a trading-policy ablation from the separate live fee patch.

### What was not tested as a profitable "component"

Maker transaction ownership, durable pending receipts, reconciliation, fail-closed
coverage, monitoring, collector freshness, and other execution protections were
not removed. Their failure modes are not measurable as a fair fee/price ablation
in this minute engine. Disabled short/hedge entries, legacy S/R resistance veto,
pullback/euphoria actions, and enabled shadow-only observers are not active
strategy layers to remove. They were not silently included as trading rules.

Historical delivery/cache cadence, active-minute quotes, actual exchange
fees/funding, liquidations, manual intervention and shared-account inventory
remain outside exact parity. A causal, reproducible model can still have these
execution uncertainties. This study does not certify the old strategy rankings
or the current live account's expected dollar return.

## Causal trace and acceptance

The first soft-stale event divergence is not cherry-picked by profit. Both
long models have **22 identical inventory events** before the difference:

- Oldest retained entry: **July1,2025 08:00 UTC**.
- Touch control arms the0.5% target at**12:00**, from already-owned inventory;
  later fills at**12:04** at**$39.45440164**, qty**320.95172571**.
- Confirmed control waits for the closed minute at**12:04**, then executes at
  the following open at**$39.459**. Same wall-clock boundary, different bar index.
- Without soft stale there is no earlier close at that target; the next
  recorded inventory event is an add at**12:22**. The1.4% target is retained.
- Raw source-candle and inventory-age checks pass. Prior bar high is never used
  to fill a newly created target.

Accepted verification at**2026-09-08 20:03:32 UTC**:

- 138 cases /136 core cases /34 distinct configurations.
- Six archived complete current result digests exact before new policy outcomes.
- **713,740 inventory events**, **52,094,382 raw-minute accounting marks**,
  **1,302 monthly rows**, **328 attribution comparisons**, two first-divergence
  raw traces checked.
- One non-survivable artificial intermediate case explicitly flagged; bare
  cases do not reach modeled zero. No claim of actual exchange liquidation.
- Independent per-position cash/fees, monthly MTM, DD, allocation, and preserved
  transactional partial clock agree. The independent accounting implementation
  is shared by runner/checker; raw prices are reloaded separately. This is not
  a second independent strategy implementation.
- Current config/state/runtime hashes unchanged. The only shared harness edit
  is the TypeScript0h cooldown alternative; original source bytes reconstruct
  exactly after undoing that one type change in memory.

Tests passed: component fixtures; cooldown/insolvency edge fixtures; current-stack
causal replay tests; ladder-sizing/partial-state tests; normal and VPS TypeScript
checks; explicit strict compilation of new research scripts; result checker.
Final whitespace checks are part of hand-back.

## Files and reproducibility

- [Method and commands](../docs/research/ladder-component-audit.md)
- [Frozen card](../research-inputs/ladder-components-2026-09-08.json)
- [Exact component wiring](../scripts/ladder-component-policy.ts)
- [Study runner](../scripts/hype-ladder-component-study.ts)
- [Independent result checks](../scripts/ladder-component-results-check.ts)

Local output folder: `backtests/hype/hype-ladder-components-2026-09-08/`.

- `overview.csv`: all136 core rows, absolute net/open/realized,W/Lcounts/dollars,
  DD/min-equity/holding duration and TP/forced/partial counts.
- `monthly.csv`: every setup/month, cash and MTM, winner/loser exit cohorts.
- `comparisons.json`: versus bare, current, and preceding cumulative stage;
  matched-entry changes plus removed/replacement episode PnL.
- `results.json`, per-case summaries and inventory/close/partial ledgers:
  exact configurations and full precision.
- `manifest.json`, `control-parity.json`, `validation.json`,
  `verification.json`, `causal-traces.json`: provenance and acceptance.
- `tables.md`: mechanically generated accepted tables.

Counts: L09 has33 non-current reconstruction/removal profiles plus current B17,
not33 invented indicators and not138 independent strategies. Keep it separate
from the prior48 ladder-overlay definitions when discussing research breadth.
The same full-minus-latch profile is referenced twice but executed once per model.

**Verdict: audit complete; configuration unchanged. The blanket "current is
already optimal" claim is not supported. There are specific refinement leads,
but no unconditional removal passed the full monthly robustness requirement.**
