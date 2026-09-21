# RektProof setups: extraction and automatic-replication plan

**Expanded-library update:** use the [19-PDF replication plan](codex-astra-rektproof-expanded-plan-2026-09-18.md)
for the current direction. It refines the provisional range, breaker, entry
and zone definitions below. This first source review is preserved for lineage;
its proposed conventions are not a frozen or implemented strategy.

Status: **source reviewed; research plan only. No new strategy implemented or backtested.**
September 18, 2026. No live changes or new economic trial-count increment.

## Main conclusions

- The PDF's distinctive ingredient is **an ordered sequence of events**, not another indicator threshold: a known extreme is breached, structure changes, and price returns to a specific origin/failed zone before entry. Our recent high-touch tests did not reproduce that full sequence.
- The strongest candidate for BTC/HYPE higher-timeframe context is the distinction between **an internal pullback and failure of the swing supporting the trend**. A temporary sweep, a close beyond a level, and a failed reclaim must remain separate states.
- It is possible to build testable versions, but not honestly claim an exact replica yet. The PDF omits mechanical definitions for several judgments. First validate detected setups visually; then test standalone trades, and only afterward BTC-conditioned HYPE entries or ladder controls.

## 1. Source and review boundary

Source: [538000244-RektProof-Setups.pdf](filedump/538000244-RektProof-Setups.pdf),
title **RektProof Setups / Notes**,29 pages.
SHA256: `407b5b7a9be1f35ee8ed80be3d10226a8a9ffd844b41e41b6e7466297c317587`.

All29 pages were reviewed as text and rendered charts. Diagram-heavy pages
cannot be understood from text extraction alone. Cached text, page renders
and contact sheets are saved once under:
`backtests/document-review/407b5b7a9be1f35ee8ed80be3d10226a8a9ffd844b41e41b6e7466297c317587/`.

This is a supplied notes/illustration document, not a verified trading ledger.
Page28 shows self-reported hit-rate labels: breakers76%, ranges+MSB61%,
supply/demand59%, pre-confirmation29%. Sample sizes, complete trade records,
costs and selection rules are absent. These are reasons to investigate the
mechanisms, not performance assumptions for our BTC or HYPE tests.

Language below distinguishes:

- **Source:** directly stated or illustrated in the PDF.
- **Interpretation:** our reading of an incompletely specified chart sequence.
- **Proposal:** an explicit definition we would test, not a rule attributed to the author.

## 2. What the strategies actually are

These are related families, not seven independent edges. Several chapters
illustrate the same sequence from different directions or timeframes.

| ID | Family and pages | Source sequence | Automatic representation / limitation |
|---|---|---|---|
| RPF-A | Range reversal, pp4–7; bullish reversal, pp13–16 | Establish opposite swing extremes; sweep/deviate beyond one end; return inside; break opposing internal structure; retest formed supply/demand or breaker; target the other end | Frozen range + sweep event + confirmed MSB + later retest. Bullish and bearish versions of a shared detector |
| RPF-B | Failed-zone breaker, pp2–3 | An apparent bullish shift creates demand; demand fails with downside MSB; retest the former demand as a bearish breaker; target equal lows | Preserve a zone's origin and earlier role, then its failure and retest. Cannot label any resistance touch a breaker. Mirrored failed-supply long is a separately declared symmetry assumption |
| RPF-C | Broken swing / reclaim, pp10–12 | Price closes beyond a swing, unlike a wick-only failure; subsequently shifts back; breaker/reclaim entry toward an opposing unvisited extreme | Separate closed-beyond and reclaimed states. A broken low alone is not a buy signal; the favorable outcome is not known at the initial break |
| RPF-D | Three-tap, pp16–21 | Initial swing, later sweep/deviation, then a separate return to the original area before reversal | Three distinct visits separated by departures, not three adjacent bars touching the same price. MSB is not an explicit prerequisite in this chapter |
| RPF-E | Power of Three, pp8–10 | Consolidation/accumulation, excursion/manipulation, expansion toward the other side; day open features in an example | A context wrapper around range/reclaim, not an independently defined entry. Do not classify accumulation from the later rally or equate a particular UTC session with the author's unspecified timezone |
| RPF-F | Higher-timeframe demand pullback in alts, pp26–28 | Initial rise, selloff into previously formed HTF demand, reclaim/structure shift and a new breaker; continuation | Multi-timeframe parent zone + lower-timeframe confirmed setup. HYPE application is a new asset test; sentiment/trapped funds are not observable directly from candles |
| RPF-G | Trend structure versus internal noise, pp21–23; level context, pp23–25 | Internal lower highs/lows can occur while the key trend-supporting low survives. Breaking that key low changes the structural interpretation | Stateful external/internal structure classifier. Useful potential blocker/release context, not a complete standalone trade |

### Important source nuances

1. **Page2 mixes a bullish reversal schematic with a bearish-breaker walkthrough.**
   The narrative continues on page3 with failure of the demand zone. We should
   preserve that failed-zone sequence, not treat all page2 illustrations as one
   simultaneous short signal.
2. **Wick sweep and closed-beyond swing are different.** Page11 explicitly
   contrasts them. A same-bar reclaim and a later reclaim after a breakdown
   need different IDs and denominators.
3. **Three-tap is not automatically sweep+MSB.** Adding an MSB prerequisite
   is a variant, not faithful extraction of the three listed steps.
4. **Supply/demand at the extremes, not every intervening zone.** Pages24–25
   show why intermediate zones may fail on a move between larger extremes.
   This argues for testing zone location/context, not merely increasing map density.
5. **No claim of actual stop inventory.** Equal highs/lows and untouched extremes
   are price-based liquidity proxies. Candles do not prove manipulation,
   hidden stops, positions accumulated, or who is trapped.

## 3. The main new question for our system

Our latest studies ask whether an entry near a level improves with indicator
values. The PDF instead asks:

> After a known level is breached, does price confirm a directional change,
> and can we enter the subsequent retest with a defined invalidation and target?

For example, a bearish range trade would be:

`known range -> sweep its high -> reclaim inside -> break a known internal low -> retest origin supply -> short toward frozen range low`

If the internal low never breaks, there is no confirmed trade. If the retest
never happens, there is no fill. If the range-low target is already consumed
before entry, the original setup expires. Those missed moves are part of the
result, not permission to retroactively enter at the sweep.

For BTC context, the question is narrower than “BTC down X%”: did BTC breach
an internal level while its external trend remains intact, or actually break
the protected external swing and fail to reclaim it? Whether that improves
HYPE decisions must be tested separately; BTC pattern success is not proof
of a profitable cross-asset filter.

## 4. Deterministic definitions required before economic tests

The following are **proposed first-pass conventions**, to validate against
charts before freezing an economic card. They are not numbers supplied by
the PDF and are not already optimized.

### A. Confirmed structure and ranges

- Use closed OHLCV bars. Start with strict two-left/two-right pivots; ties do
  not create a new pivot. Publish a pivot only after its second right-hand
  bar closes and the source lag has elapsed. Record both pivot occurrence
  and first-known time; never backdate a trade to the pivot candle.
- Maintain an immutable confirmed-pivot ledger. For an initial range, take
  the latest available opposite-type swing pair with low < high and price
  inside; freeze their identities when the setup arms. This is a simple
  proxy for a discretionary range, not evidence that every such pair is valid.
- Separate external pivots on the context timeframe from internal pivots on
  the trigger timeframe. Do not replace external structure with whichever
  tiny internal swing happens to break first.
- Proposed bullish protected low: the latest already-confirmed higher low
  that preceded a closed break above the preceding known external high.
  Freeze it when that break becomes available. Bearish protected high mirrors
  it. Update only on subsequent qualifying structural events; insufficient
  history means unknown, not bullish.
- If no unambiguous, ordered range or internal reference exists, emit a
  rejected/unknown event. Do not search backward after the outcome for a
  prettier range.

### B. Sweeps, breaks and reclaims

- Proposed range-high sweep: high > frozen high, then a closed trigger bar
  back below it. The low-side case mirrors this. Record whether reclamation
  occurred on the sweep bar or after one or more closes outside.
- Proposed MSB: a later closed trigger bar breaks the opposing internal
  pivot that was already known and frozen at the sweep. The default refuses
  to infer the ordering of a sweep and MSB inside one OHLC bar.
- Prices are tick-normalized. Start with strict crossings; a volatility-scaled
  buffer is a separately declared sensitivity, not an unrecorded optimization.
- For a closed-beyond swing, require subsequent reclaim and the declared
  structure/zone confirmation. Do not infer that every breakdown is a trap.

### C. Supply/demand and breakers

- **Critical unresolved interpretation:** the PDF shades origin areas, but
  does not specify a unique body/wick/base-candle algorithm.
- Initial proposed zone: full high–low of the last opposite-colour trigger
  candle on the identified displacement leg, within at most12 trigger bars
  before its confirming MSB. Demand uses a down candle before bullish MSB;
  supply uses an up candle before bearish MSB. No qualifying candle: no zone.
- For the initial range-reversal detector, define that leg as the sweep bar
  through the MSB bar; search no earlier than the later of the sweep and the
 12-bar boundary. For a standalone trend-origin zone, use the most recent
  already-confirmed opposite swing as the leg start instead. Flat dojis are
  excluded; selection never uses an after-MSB candle. These conventions make
  the proposal reproducible while leaving its visual fidelity to be checked.
- Freeze the zone at MSB availability. Its earlier candle timestamp is an
  origin, not an earlier availability time. Later bars cannot improve or
  shrink its historical boundaries.
- A breaker requires a **previously published** opposite-role zone, a closed
  failure through its far edge, and a subsequent retest from the new side.
  Preserve parent zone ID, formation, failure and retest timestamps.
- Full-wick versus body/base-box geometry must be reviewed visually. If the
  proposed single-candle box does not match the source concept, revise the
  definition before looking at PnL; do not tune it on winning trades.

### D. Retests, entries, invalidation and targets

- A retest must occur on a bar after MSB publication, intersect the frozen
  zone and close back on the intended side. Proposed initial execution is
  a market order at the next available minute open, not a hindsight limit
  fill at the zone's best price.
- Alternative resting-limit entry is a separate execution experiment: order
  cannot exist before the signal, and a touch alone is not guaranteed fill.
- Proposed stop: beyond the setup's sweep/failed-zone invalidation extreme,
  by one valid price tick. It is fixed before submission and never widened
  using later structure. The precise choice is a model convention, not a
  universal stop instruction extracted from the author.
- Proposed primary target: frozen opposite range extreme, or the preselected
  known equal-high/low pool for the breaker. Start with range extrema; defer
  an equal-level tolerance search. If no causal target exists, skip.
- Do not enter if stop/target are on the wrong sides of the actual fill.
  Save expected and actual reward/risk, spread/cost impact and gap exclusions.
  Test a2R exit as a control, rather than silently replacing the source's
  liquidity target with whichever exit earns most.
- Proposed setup expiry: no MSB within12 trigger bars after sweep, or no
  qualifying retest within12 bars after MSB. Structural invalidation or a
  target hit before entry cancels it sooner. One trade per frozen setup ID;
  expiry and resets must be logged, including all failed attempts.
- No fixed holding cap comes from the PDF. A24-trigger-bar research timeout
  is a transparent starting convention; review timeouts separately. Do not
  force a daily/4h structure trade into an inherited12h exit without a control.

### E. Higher-timeframe context

Start with **4h context /1h trigger on BTC and HYPE**. A separate **1h /15m
HYPE** lens can follow for intraday entries. Build daily structure as slow
context, but do not initially multiply every pattern by every timeframe.

“Trend intact”, “protected swing broken”, “reclaim pending” and “confirmed
opposite structure” must be distinct. An initial break warning may precede
a confirmed lower-high retest; requiring the latter might react too late.
Compare those event times before choosing a blocker. Missing data is unknown.

## 5. Proposed test sequence

### Checkpoint1 — pattern fidelity and data readiness, no profit optimization

1. Verify current BTC/HYPE source coverage and freeze a common complete
   analysis window. Hash inputs; preserve availability metadata on repairs.
2. Build one reusable causal event stream: pivots, frozen ranges, protected
   swings, sweeps, MSBs, origin zones, failures, retests, expiry and reasons.
3. Generate charts with each step and its first-known time. Review a fixed
   chronological sample of completed **and rejected** setups, across both
   directions and several periods. Initially hide post-entry outcomes so
   visual labeling cannot select only attractive winners.
4. Save the complete event ledger and chart atlas once. User review should
   answer “is this the setup?” before we ask “did it make money?”

The source's illustrative trades are not a complete denominator and may not
fall inside our archives. Synthetic source-shaped examples plus our fixed
historical sample validate implementation; neither proves trading edge.

### Checkpoint2 — standalone economics, core patterns first

Begin with **RPF-A range/reversal** and **RPF-B failed-zone breaker**. Test
long and short independently on BTC and HYPE, fixed$10k notional. This gives
eight core asset/direction/family cells before controls; do not label all
wrappers as independent extra strategies.

Required comparisons, with identical range/target/stop definitions where applicable:

- Known-level reaction without MSB/retest: does sequence confirmation add value?
- MSB entry at next available price versus confirmed retest entry: does waiting
  improve quality or simply miss profitable moves?
- Retest entry versus an appropriately same-delay control: do not award the
  pattern a gain caused only by waiting while price moves.
- Source-style opposite-extreme target versus fixed2R control. Report target
  distance/risk, not only win rate. Keep no-trade and expired setups visible.

Use full/earlier/recent and monthly baseline-adjacent W/L, win/loss dollars,
average loss, expectancy in dollars and R, adverse DD, PF, exposure time,
missed trades and worst-loss concentration. Costs and delays stay explicit.
Treat the months as development history, not an untouched holdout.

Only then extend to broken-swing reclaim and three-tap. Power-of-Three session
definitions and HTF-demand wrappers follow if the underlying detector is
faithful and the basic sequences have enough evidence. No initial CRSI/ROC/HL
grid: adding all past filters would hide what this PDF actually contributes.

### Checkpoint3 — BTC as context for HYPE

At each original HYPE opportunity, join only the last available BTC structural
state. Compare independently:

1. HYPE setup alone.
2. Same setup with BTC structural-damage veto.
3. Same setup with positive BTC reclaim/continuation required.

Use the same coverage-qualified controls, and measure missed recoveries as
well as avoided losses. Do not count HYPE movement during BTC confirmation
as post-signal profit. BTC and HYPE clocks must not leak across one another.

For the live ladder, a later separate replay would distinguish **new-ladder
blocking**, **timed-add restriction**, and **earlier recovery participation**.
They change different risks. Start with fixed existing sizes and independent
exit behavior. “Accelerator” first means better entry timing/permission—not
larger leverage, more rungs or bypassing all existing safety gates.

## 6. Existing work to reuse, and what is genuinely new

| Existing surface | Reuse | Boundary |
|---|---|---|
| `scripts/poc-indicator-bias-engine.ts` | Closed-bar aggregation, pivot metadata, structural `Action.stop/target`, standalone `replay()` | Its `pivots()` publication calculation is hardcoded to4h. Generalize through a tested separate helper, not misuse it on1h/15m or change pinned parents |
| `scripts/level-playbook-signals.ts` | Frozen level, rejection/retest, expiry and invalidation patterns | LV01 does not implement supply/demand origin lineage or the full breaker sequence |
| `scripts/major-sr-history-map.ts`, `macro-sr-observer.ts` | Historical levels, first-known times, role/lifecycle representation | Pivot clusters are not automatically supply/demand origin boxes; do not rename the current map and claim replication |
| `src/research/event-atlas-render.ts` | `renderAtlasEventSvg()`, `renderAtlasIndexHtml()` and existing chart views | Add sequence annotations to the saved event layer; no new chart framework |
| `scripts/level-playbook-verify.ts` | Independent structural-stop/target receipt logic | Adapt to the new action schema and independently check DD/occupancy; don't rely only on runner summaries |
| `scripts/poc-exit-cap-audit.ts`, `high-touch-short-audit.ts` | Existing minute-accounting checks | Fixed-percentage audits are not automatically an audit of arbitrary structural brackets |
| Existing fee, ownership, monthly, hash and immutable-job tooling | Execution and artifact lifecycle | Preserve archived controls; a changed kernel needs an explicit parity bridge |

Adjacent studies remain counted:

- **HT03:** rolling48h-high close-back/wick/later-confirmation shorts, not
  swing-specific sweep -> opposing MSB -> zone retest. Its negative results
  do not settle this sequence; retain relevant simpler controls.
- **DB01:** confirmed4h range location, session bias and structural targets,
  not breaker/three-tap confirmation. Reuse features and accounting, not its
  performance as evidence for the new patterns.
- **RP02:** BTC percentage moves followed by HYPE outcomes. It did not classify
  protected-swing failure, reclaim or multi-timeframe demand.
- **LC01:** indicator states at saved level events. No profitability claim from
  LC01 carries over; NPOC/CMF may be later context, not required initial logic.

## 7. Dataset limits to resolve before running

- Accepted HYPE LV01/LV02/LC01 candle atlas spans Dec5,2024 12:55 to
  Sep15,2026 20:20 UTC. Reuse its validated tape for an unchanged-period study.
  A newer sync requires a new audited input identity, not overwriting it.
- BTC minute and5m files exist locally (`data/BTCUSDT_1_full.json`, `_1m.jsonl`,
  `_5_full.json`, `_5m.jsonl`). Existence does not certify continuous coverage.
- The **last RP02 audit**, Jul1,2025–Sep14,2026 15:27 UTC, reported11 BTC gaps
  and28,207 missing minutes. That is prior audit evidence, not a fresh claim
  that today's files still have precisely those gaps. Verify current inputs.
- No BTC240m source artifact was identified in this inspection. Aggregate
  higher bars only from complete constituent windows, or separately acquire
  and validate historical exchange bars. Do not bridge gaps with interpolation.
- HTF structure spanning unknown intervals cannot be labeled intact. Rebuild
  required causal context or mark it unknown. Backfilled candles do not prove
  they were available to the live collector at the historical decision.
- These setups initially need OHLCV, not HL orderflow. HL and NPOC overlays
  would add shorter coverage and another hypothesis; keep them separate.

## 8. Acceptance requirements for an automatic detector

- Every object records symbol, venue, timeframe, origin/observation time,
  confirmation time, modeled/actual availability, source IDs and parent IDs.
- Every attempted setup records state transitions, even if invalidated,
  occupied, expired, target-already-hit, gap-unknown or never retested.
- Future-bar poisoning and prefix replay leave all earlier emitted states
  unchanged. Test pivot delay, frozen range/zone identity and HTF/LTF joins.
- Test simultaneous outside bars, equal pivots, repeated taps without a
  departure, gap-through zones, duplicate overlapping ranges, target consumed
  before entry, no opposing candle, failed reclaim and mirrored short/long.
- Source readiness and60/120s modeled source lag;0/60s extra action delay.
  Finalize timeout anchoring explicitly under delays before replay. The first
  execution cannot precede the bar or pivot that confirms its signal.
- Minute-level stop/target ambiguity is stop-first primary with opposite-order
  sensitivity. This is a bound, not proof of actual tick ordering or limit fills.
- No silent reuse of the same capital by simultaneous pattern IDs. First test
  each family separately, then declare ownership rules before any portfolio.
- Preserve baseline parity, cost stress, source seals and full monthly screens.
  Do not rank a strategy as proven on a handful of chosen PDF examples.

## Recommended immediate next deliverable

**A reusable, inspectable RektProof-style structure/setup atlas**, starting
with range reversal and failed-zone breaker on4h/1h BTC and HYPE. It should
show why each setup exists at the time, where the stop/target would be, and
why rejected cases did not qualify. Freeze economic rules only after this
visual fidelity check. No live blocker or accelerator follows directly from
the PDF or this extraction.

References: [LC01](codex-astra-level-indicator-findings-2026-09-18.md),
[HT03](codex-astra-high-touch-rejection-findings-2026-09-18.md),
[PI01/DB01](codex-astra-poc-indicator-daily-bias-findings-2026-09-17.md),
[RP02](codex-astra-btc-movement-atlas-findings-2026-09-15.md).
