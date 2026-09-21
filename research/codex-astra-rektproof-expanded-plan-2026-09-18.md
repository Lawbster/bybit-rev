# Expanded price-action library: BTC/HYPE replication plan

September 18, 2026. **Extraction and research design only. No new backtests,
detectors, live rules or performance claims.** Supersedes the proposed choices
in the [single-PDF plan](codex-astra-rektproof-replication-plan-2026-09-18.md)
where this document explicitly corrects them. That earlier source review is
preserved, not erased.

## Decision in brief

- The 19-PDF / 474-page library adds useful definitions, but much is duplicated.
  Its strongest research contribution is **event order and level ancestry**:
  which swing mattered, what broke it, which zone produced the break, and what
  price did on its return. These sequences have not been replicated by our
  simple touch/rejection or indicator-filter tests.
- Prioritize **range sweep → structure break → origin-zone retest**, and the
  stricter **failed-zone breaker**. Build the protected-swing state alongside
  them for BTC/HYPE trend context. Do not combine every lesson into one entry.
- A genuinely different POC lead emerges: **return into an old range, then
  trade toward its untouched POC**. The lessons primarily discuss TPO
  (time-at-price), not our existing volume POC. Preserve both identities.

All source IDs/page references resolve through the [source index](rektproof-source-index-2026-09-18.md).
That index and the [catalogue](../research-inputs/rektproof-corpus-catalog-2026-09-18.json)
record hashes, overlap, reading coverage and inspected diagrams. The
[direct-lesson extraction](rektproof-direct-lessons-review-2026-09-18.md)
contains detailed quotations-in-context paraphrases and translation cautions.
Illustrated winning trades and self-reported hit rates are not an audited
denominator. No profitability is established by this pass.

## 1. What changes from the first plan

| Earlier proposal | Expanded evidence | Consequence |
|---|---|---|
| Latest opposite swing pair as a range proxy | E43 pp16–20 / D7 p2 / P4 p2 emphasize the first two swings after exhaustion/impulse | Freeze an impulse-anchored range; do not silently replace it whenever a newer small swing appears. Exact exhaustion detection still needs a declared proxy |
| Any failed valid zone plus retest as RPF-B | D6 pp4–5 requires a new high beyond preceding swing points before bullish entry; bearish mirror | Separate generic failed-OB control from the stricter named breaker; primary cannot trigger on zone penetration alone |
| Close-rejection retest as universal entry | D1 common method enters at zone edge; E43 pp28–30 adds a distinct LTF sweep inside the zone | Keep first-retest limit and confirmed LTF-entry models separate. A generic close-rejection is our control, not an exact source replica |
| Single opposite candle, full wick, was entirely our convention | P4 p2 explicitly permits wick-to-wick; PA29 p12 also defines single-, two- and 2–4-candle base variants | A full-wick single-origin v1 is defensible, not universally prescribed. Do not mix zone algorithms after seeing returns |
| BTC trend structure was broadly described | MS21 pp8–17 and PA29 pp15–20 distinguish protected external swings, internal pullbacks and unconfirmed reversals | Emit distinct states and their first-known times, not a new EMA-like boolean |
| POC was only a later optional level overlay | P4 p1 selects the first untouched POC in bias direction; D10 pp1–5 describes old-range re-entry toward naked TPO POC | Add a separate target-selection experiment after core structure is validated |

**Unchanged:** closed-bar causality, immutable source objects, independent
long/short tests, fixed $10k research notional, no live changes, and no extra
HL/indicator grid until the underlying mechanism is understood.

## 2. Extracted setup catalogue

These are families and modifiers, not 12 independent edges. Source claims are
descriptive; the proposed detector is explicitly our testable interpretation.

| Family | Source setup / target / invalidation | Reproducible interpretation and priority |
|---|---|---|
| **A. Range reversal** | Known range → extreme sweep → closing-basis break of the swing feeding that extreme → retest formed S/D → opposite untouched extreme. D7 pp2–6; E43 pp26–28 | First priority, both sides. Freeze range and relevant internal reference before the sweep. No MSB or no later retest means no trade |
| **B. Named breaker** | Previously valid zone fails after a range-side sweep; new HH/LL confirms the opposite structure; retest flipped zone; target known opposing liquidity. D6 pp2–8 | First priority. Preserve original zone formation and the second break. Generic failed-zone-only is a simpler control, not the same setup |
| **C. Trend continuation at fresh demand/supply** | Structure break creates origin zone; return toward that zone in the established trend; stop outside zone/swing, target known opposing extreme. SD52 pp8–18; PA29 pp8–20 | Next standalone family. Distinguish reversal OBs from continuation OBs. Record first return, dwell and return shape before adding quality filters |
| **D. Broken swing / reclaim** | Close beyond a major swing, then reclaim/shift and breaker entry toward an unvisited opposing swing. S29 pp10–12 | Separate from wick-only sweep. No retrospective declaration that a breakdown was a trap |
| **E. Three-tap** | Original swing, separate sweep, separate retest. S29 pp16–21 | Later, retaining the original three stages; MSB is not a universal source requirement here |
| **F. HTF-zone / LTF-confirmation** | Enter lower-timeframe sweep/structure inside an already valid higher-timeframe zone. E43 pp28–30; MS21 p11; D3 pp6–8 | Entry modifier, not a separate independent signal population. Compare against first touch on the same parent opportunities |
| **G. OTE entry** | 0.705 retracement inside the orderblock; personal variant also requires sweep + MSB. D1a pp2–9 | Source-specified ratio, not proven optimality. Freeze causal impulse endpoints; compare later against common edge entry, not an initial Fibonacci sweep |
| **H. Monday-range raid** | After Monday closes, use this/prior week's relevant Monday extremes; reversal setup toward opposing end. D9 pp1–5 | Context wrapper after A/B. UTC is a proposed convention; do not know Monday's final range on Monday morning |
| **I. PO3** | Accumulation/open context → old-extreme raid → expansion toward an already existing opposite extreme; requires other confluence. D11 pp2–7 | Context labels around A/B/D, not an independent “three boxes” trade |
| **J. Imbalance + origin zone** | Impulse leaving inefficiency, structural change, return to nearby origin/failed zone. SD52 pp34–43 | Separate wick-gap geometry from D5's broader expansion/retrace narrative. FVG-only entry explicitly discouraged in SD52 p38 |
| **K. Old-range return → naked POC** | Breakout leaves an untouched daily TPO POC; later return into the old range favors POC revisit. D10 pp1–5; P4 p1 | New target hypothesis, not another buy-at-NPOC-touch test. Price bias/entry must qualify independently; POC must lie ahead and remain unvisited as-of entry |
| **L. Protected external swing** | Internal reversal can be a pullback while the swing responsible for external continuation still holds. MS21 pp8–17; PA29 pp15–20 | Shared context, especially BTC blocker/release research. Never interpret all LTF bearish structure as HTF collapse |

### Quality features worth recording, not yet mandatory filters

- **Freshness:** touches before entry, elapsed time away, bars spent inside,
  penetration depth and whether a prior visit already invalidated the zone
  (SD52 p9). Source claims first return is better; we have not verified it.
- **Corrective versus fast V-shaped return:** bars from impulse to retest,
  return speed relative to departure, overlaps and counter-swings (PA29 p13).
  These can be computed up to entry. The later bounce cannot define quality.
- **Intermediate swing / “inducement” intact:** a known intervening swing or
  equal-extreme proxy remains unrun before the zone is reached (PA29 pp24–27).
  Label the geometry, not purported institutional intent or actual stop volume.
- **Confluence:** known HTF zone, gap, range edge, Monday extreme, directional
  POC target. Save individual fields; avoid requiring every feature from day one.

## 3. Source disagreements we must not automate away

The corpus is not one consistent executable system:

- P4 sometimes calls a sweep an MSB; D7 expressly separates sweep from a
  **closing-basis** internal break. Use D7 for A; preserve the simpler reclaim
  as a labelled control.
- D6 requires the structural HH/LL for its named breaker. SD52 treats further
  change of structure as strengthening confluence for the broader concept.
- PA29's premium/discount contrarian preference and E43's EQ direction context
  are not interchangeable. A trend-continuation target above EQ does not
  automatically conflict with a different range-fade model.
- Direct OB lessons do not mandate a universal body/wick boundary, immediate
  next-candle engagement, engulfing ratio, ATR displacement or expiry. Their
  absence is not permission to present invented thresholds as source rules.
- The source index records stop/target direction errors and misleading
  translations. Enforce valid side/stop/target geometry, not literal copy errors.

Use direct English plus its diagram for each named model. Any unresolved
choice is a research convention in the future card, not silently pooled
across authors. “The author says gaps eventually fill” is not a reason to
remove stops or retain a losing trade indefinitely.

## 4. Automatic representation: one saved causal ledger

Build this once per input/definition hash and reuse it for charts and tests.
Do not reconstruct the map for every entry variant.

| Object | Required fields / chronology |
|---|---|
| Structure | Venue, symbol, timeframe, pivot ID/time, confirmation close, availability, parent external swing, protected/targeted status **at that time** |
| Range | Anchor impulse/structure event; original endpoint IDs; bounds/EQ; activation; break/re-entry events. Retired ranges remain historically queryable |
| Zone | Original candle IDs/bounds; role; displacement/MSB ID; first-known time; touches; invalidation; parent zone for any breaker |
| Setup | Family; frozen range/zone/target; sweep/reclaim/MSB/retest sequence; state transitions; rejected/expired/unfilled reason |
| Profile / calendar | Type (`tpo` versus `volume`), venue, period/UTC convention, bins, complete inputs, first-known time, as-of naked status |
| Decision | Exact source IDs; eligible order time/price; invalidation/target; ownership or skipped reason. Future exit belongs in a separate outcome record |

The first plan's strict two-left/two-right pivot convention remains a
**provisional visual-test choice**, not a proven source equivalent. A pivot
at t is not usable until both later confirming bars close and the data is
available. A protected low becomes protected only when its causal advance
breaks the relevant prior high; don't project that status backward.

Range construction is the main unresolved judgment. Proposed atlas v1:
anchor a completed directional structure/displacement event, identify the
first subsequently confirmed opposite swings, then freeze the pair. This
is an operational proxy for post-impulse exhaustion, not a claim that every
pair is a tradable range. Visual review must resolve which leg/first swing
belongs to the range **before** economic outcomes are read. Emit ambiguous
or insufficient-history cases instead of searching for a winning range.

For A, the break reference is the swing whose advance led into the swept
extreme, not simply the latest tiny pivot. For B, retain the valid original
zone and the later opposing structural break. Requiring that new extreme
on a close is a conservative proposed convention; D6 says a new high/low
must print, whereas D7 is explicit about a closing-basis break.

### Entries and risk must reflect the chosen model

1. **Common edge entry:** after confirmation, place a limit at the frozen near
   zone edge; never grant a fill on an earlier touch. Test touch and stricter
   trade-through/delay assumptions. OHLC touch cannot prove queue execution.
2. **Confirmed entry:** wait for the declared lower-timeframe sweep/shift inside
   the parent zone, then use the next executable price. A generic close-back
   retest is a separate simpler control. Keep missed and never-returned moves.
3. Stops match the model: beyond the parent zone for the common model; beyond
   the specified LTF sweep for that confirmation model. Stop buffer, gap-fill
   handling and target validity must be frozen before replay, never widened.
4. Freeze A's opposite range extreme before the sweep. B has already broken
   an earlier range edge: do not reuse that consumed edge as its profit target
   if it lies behind entry. B needs a separately declared, already-known target
   ahead of entry (a confirmed new structural extreme or further pre-existing
   liquidity level). Its selection must be fixed before submission, not chosen
   from the eventual move. Retouch/consumption after target selection and before
   entry cancels that target. Resolve B's target precedence during atlas review;
   structural target versus fixed 2R is a later controlled comparison.
5. A 12-bar setup expiry / 24-trigger-bar holding cap from the first plan remains
   an **unvalidated proposal**, not a PDF rule. Freeze expiry and holding clocks
   separately, including source/action delays, before any economics.

No same-bar sweep/MSB/retest ordering inferred from OHLC. Resolve with an
available lower-timeframe path or flag ambiguity. Cross-timeframe joins use
max(required input availability), not the earliest candle's timestamp.

## 5. POC, FVG and calendar details

### Do not relabel our volume map as TPO

Our PVM01 map is volume-at-price. D10 describes daily **time-at-price** profiles;
its naked-POC rule therefore does not validate the existing volume map, nor
does existing volume-NPOC performance validate its TPO rule.

A future TPO adapter can share profile lifecycle and as-of query plumbing,
but not volume weights. Proposed starting convention: UTC completed day,
30-minute time brackets, one count per occupied price row per bracket,
predeclared row width and tie/value-area rules. The lesson's stated value
area is 69%; bracket length, row width and tie rules are not supplied.
High–low bar occupancy is an explicit approximation to traded-price visits,
not exact tick-level TPO. Save that source-quality flag. No volume weighting.
Never use a later day's range to adapt an earlier profile's bin width.

Test K only after the range engine works: identify old range → completed
profile → breakout leaving POC naked → **later confirmed re-entry** → causal
directional entry toward that POC. Compare against the identical entry with
range-EQ / opposite-edge target and against volume-POC substitution, one
question at a time. Never require the future POC touch to select entries.

### Two different meanings of imbalance

SD52 pp35–36 illustrates wick-separated gaps. A conventional three-bar
non-overlap detector is a reasonable **formalization**, published only after
the third bar closes. D5/E43 instead describes a multi-bar expansion pole and
retrace to origin. Save different types; don't pretend one measures both.
Unfilled/partial/filled status is as-of time. Neither definition guarantees
a later retracement, and neither should be the first standalone strategy.

### Monday / opens

Proposed Monday interval is [Monday 00:00, Tuesday 00:00) UTC; its final extremes
become usable only after completion plus source delay. Keep the eligible
current/prior-week identity, not all historical Mondays. Daily/weekly/monthly
opens are available at their own actual opening observation, not their eventual
close. “Avoid Monday” and open proximity are later separate modifiers, not
mandatory filters quietly attached to A/B.

## 6. BTC blockers and accelerators: testable direction

Build daily and 4h structural states for BTC and HYPE, with 1h trigger detail.
Start economic A/B tests at 4h/1h; defer adding every timeframe combination.
MS21's 4h/15m/1–3m illustration is an example, not a mandate to trade minute noise.

| State | Potential later application, not a live instruction |
|---|---|
| External uptrend intact; internal pullback | Distinguish normal correction from collapse; may avoid an overbroad BTC-red veto |
| Protected external low breached on a close | New-entry warning/block candidate; inspect lead time to HYPE damage and false warnings |
| Breach reclaimed, trend not yet re-established | Separate recovery state; don't equate every reclaim with bullish continuation |
| Opposing structural sequence confirmed | Stronger directional state, potentially later and less useful for early protection |
| Healthy demand/reclaim aligned on BTC and HYPE | Candidate permission/timing improvement for the same existing size |
| Missing/stale structure context | Unknown, never silently bullish or a successful veto |

For every original HYPE opportunity, compare HYPE-only, a BTC-damage veto,
and positive BTC-alignment requirement on the **same coverage-qualified tape**.
Report avoided losses, sacrificed winners, entry delays, exposure and recovery
participation. BTC success on its own does not establish BTC→HYPE predictive value.

Only later test ladder new-start blocks, timer-add restrictions and releases
separately against unchanged Agg10. At that stage include actual ownership,
replacement ladders, live exits and frozen maker execution assumptions.
“Accelerator” initially means timing/permission, **not increased leverage,
extra rungs or bypassing independent safety gates**.

## 7. Work sequence and reuse

| Checkpoint | Deliverable / acceptance | Not included |
|---|---|---|
| **1. Data + visual atlas** | Current BTC/HYPE coverage manifest; saved causal structure, A/B setup and rejection ledger; source-linked charts with first-known timestamps; chronological outcome-blind review | No PnL-driven geometry selection, new production module or indicator grid |
| **2. Core standalone replay** | Freeze A/B with long/short on BTC/HYPE: eight primary asset/side/family cells before explicit controls. $10k fixed notional; existing cost/accounting machinery | No pooled claims from different entry models; no assumption that fewer losses means better net |
| **3. Quality and additional families** | One-factor first-return/return-shape or HTF alignment tests; continuation C, then reclaim D / three-tap E if faithful and adequately sampled | No indiscriminate Cartesian product of all modifiers |
| **4. Targets/context** | Old-range→TPO-POC K; Monday and imbalance separately; preserve their own controls | No reuse of future naked status or winning PDF examples as training labels |
| **5. BTC→HYPE / ladder** | Reach and timing audit, then independent gate/release replays with unchanged own baseline and full occupancy | No automatic deployment from this literature pass |

For checkpoint 1, sample chronologically across both directions and regimes,
including failed sweeps, missing MSB, target consumed, expired and unfilled
setups. Hide bars after the decision initially; show them only after the
pattern labels/definitions are saved. A prettier winning chart must not
change an earlier source definition. Save all opportunities, not just the atlas sample.

Reuse these boundaries:

- `poc-indicator-bias-engine.ts`: closed-bar features and structural stop/target
  `Action` / `replay()`. Its `pivots()` hardcodes **4h + 60s** publication;
  don't apply it to other timeframes. Add a separate tested generic helper
  without mutating pinned historical parents.
- `level-playbook-signals.ts`: causal event/expiry patterns, not an existing
  orderblock-ancestry detector. HT03/DB01 provide simpler comparison mechanisms.
- `event-atlas-render.ts`: existing SVG/HTML renderer. Extend annotations,
  not the chart framework. Save the full event layer once.
- `poc-history-map.ts` / `poc-map-reader.ts`: immutable profiles and as-of
  lifecycle conventions; TPO needs its own weighting/type/source identity.
- `level-playbook-verify.ts`: structural-bracket receipt checks. Percentage-only
  POC auditors are not automatically valid for arbitrary structural stops.
- Existing seals, fees, monthly/accounting/ownership helpers and accepted
  candle maps: reuse; do not regenerate unchanged parents to read their results.

Data prerequisite: accepted HYPE tape in the previous pass ends Sep15, 2026
20:20 UTC and starts Dec5, 2024 12:55. The last RP02 BTC audit reported gaps;
that is **not** a refreshed coverage certificate. Audit current BTC constituents,
freeze full HYPE and common BTC/HYPE windows, and exclude incomplete HTF bars.
No interpolation through missing candles. Historical repairs retain actual
availability metadata; modelled bar-close availability is a research assumption,
not evidence that the live collector received the bar on time.

## 8. Verification and reporting contract

- Source and action delays explicit (reuse 60/120s source, 0/60s action
  sensitivities unless the frozen card justifies others). Confirmed decisions
  cannot fill at their own earlier close or the best point of a completed bar.
- Prefix replay and future-bar poisoning must leave earlier states, zone
  bounds, availability and decisions unchanged. Include mirrored directions,
  equal pivots, simultaneous outside bars, missing inputs and overlapping ranges.
- Fixed $10k notional, declared DD account and costs; structural stop width
  means dollar risk varies. Show initial risk and realized R separately.
  Funding is either causally included for both controls and variants or
  explicitly excluded and stress-tested before viability claims.
- One position per independent strategy/asset for initial tests; record occupied
  signals and cutoff inventory. Portfolio overlap requires a separate account replay.
- Preserve own-baseline parity and independently verify fills, fees, adverse
  marked DD and monthly totals. Limit-fill bounds and stop/target same-minute
  ambiguity must remain visible, not optimistically resolved.
- Report **baseline beside variant**: winning/losing counts and dollars, average
  loss, realized plus cutoff MTM net, PF, expectancy/R, DD, monthly deltas,
  missed trades and concentration. Show both gains captured and winners sacrificed.
- Keep the existing monthly/regime screen. All already-inspected history is
  development data, not an untouched holdout. Any promising result needs new
  forward evidence before a live proposal.

No economic card is frozen yet. LC01 remains the last completed economic
checkpoint; inventory remains **9,322 standalone / 205 overlays**.

**Recommended next task:** checkpoint 1, a reusable causal structure/setup
atlas for A/B and protected external swings on BTC/HYPE, followed by visual
fidelity review. The added material improves what we can specify; it does
not justify skipping that step or asserting these strategies will outperform.
