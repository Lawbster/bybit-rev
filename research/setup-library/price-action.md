# Price-action entries

Source-derived concepts, not frozen executable policies. Common clocks,
risk terms and evidence requirements: [PRIMITIVES](PRIMITIVES.md).
Source IDs resolve through the index and source catalogue.

## PA01 — Range sweep, structure break, origin-zone retest

**Source:** D7 pp2–6; E43 pp26–28. A known range edge is swept, the internal
swing feeding that excursion breaks on a closing basis, then price returns
to the origin supply/demand. Source target is the opposite untouched edge.

**Sequence / validation:** known frozen range → extreme sweep/reclaim → later
close through the relevant pre-known internal reference → origin zone published
→ separate return. A reversal after the sweep does not backdate confirmation.

**Entry:** declare common zone-edge limit or confirmed retest variant. A touch
before zone publication is ineligible. Long and short mirror with direction labels.

**Invalidation:** cancel on original thesis failure, target consumed, expired
confirmation/retest or missing context. Freeze whether the protective stop is
beyond the zone or sweep; those are different risk definitions, not interchangeable.
**Target:** frozen opposite range extreme; fixed 2R is a comparison, not source law.

**Unresolved:** exhaustion/range anchor, pivot width, reference ancestry, zone
bounds, expiry, stop buffer, ambiguity and entry model. HT03 simple high rejection
and DB01 daily range bias are adjacent controls, not tests of this full sequence.

**Adjacent screenshot study (2026-09-20):** [SF01 range-low SFP](../../docs/research/range-low-sfp-sf01.md)
uses a known 4h low, first sweep and closed reclaim, with versus without a
pre-known range high. It deliberately omits MSB and origin retest: a component
test, not validation of PA01 or RS01. Detector `SF01`, card
`research-inputs/range-low-sfp-sf01-2026-09-20.json`; H&S remains separate.

## PA02 — Confirmed failed-zone breaker

**Source:** D6 pp2–8; D3 pp2–10. Named strategy is stricter than “any failed OB”.

**Sequence / validation:** previously valid origin zone → sweep on its original
range side → zone fails → opposite structural HH/LL beyond the required earlier
swings → later retest of the flipped zone. Preserve both original and failure
lineage. A zone breach alone is only the generic-breaker control.

**Entry:** flipped-zone near-edge limit after all prerequisites, or separately
declared LTF confirmation. Source requires new HH/LL; a closing-basis requirement
for that new extreme is our proposed conservative convention.

**Invalidation:** failed flip before fill cancels; protective stop beyond the
opposite side of the flipped zone/declared structural extreme. Never expand
the box using later price to keep a losing breaker valid.
**Target:** known forward liquidity or confirmed new extreme; the old range
edge may already have been consumed by confirmation and cannot be reused blindly.

**Unresolved:** target precedence, failure threshold, impulse definition, first
retest policy, expiry and stop choice. No directly equivalent economic test is
claimed. Remove only the additional structure condition for a separately
specified generic failed-zone control; PA03 alone is not that control.

## PA03 — Origin-zone return: continuation or reversal

**Source:** D1a pp2–9; SD52 pp6–20; STC18 pp11–15. These disagree on which
qualifiers are mandatory. STC specifies the entire last opposite-colour candle;
RektProof requires structural qualification, not merely candle colour.

**Sequence / validation:** declared impulse/structure break → publish its
identified origin candle/base → price departs → later return. Label continuation
versus reversal at formation, not using the eventual trade outcome.

**Entry:** common near-edge resting order, or MOD01 confirmation. Model full-wick
single candle and any base-box alternatives as distinct definitions. Record
first return even if it occurred before order submission; don't reset freshness.

**Invalidation:** loss of far boundary/thesis cancels pending entry; protective
stop at/beyond declared far boundary. Exact wick versus close invalidation and
tick buffer must be frozen. Existing stop stays active during any discretionary
reaction-time analogue.
**Target:** opposing known swing/liquidity or TGT02 opposing-zone constraint.

**Unresolved:** impulse/structure requirement by source variant, leg origin,
multi-candle precedence, untouched status, expiry and target. Pivot-cluster S/R
tests are not direct evidence for origin-defined zones.

**Scoped implementation:** [PA07](../codex-astra-price-action-setups-findings-2026-09-18.md)
tested a1h confirmed-first-return market-entry adaptation on HYPE with known4h
targets. It did not test resting origin-edge limits or all source qualifiers.
No complete-screen upgrade; exact version, clocks and receipt in the index.

## PA04 — Closed-break reclaim / trapped-breakout hypothesis

**Source:** S29 pp10–12. Distinct from a wick sweep: price closes outside a
known swing, subsequently reclaims and develops opposite structure/entry.

**Sequence / validation:** known external level → qualifying outside close →
later reclaim → declared structural/breaker confirmation → eligible entry.
“Trapped traders” describes a hypothesis, not observed positioning.

**Entry:** next executable price after confirmation, or a newly formed breaker
retest. Keep immediate reclaim and confirmed-breaker versions separate.
**Invalidation:** reclaim fails before fill; later loss of the frozen reclaimed
structure triggers declared thesis exit/stop. Do not call every breakdown a buy.
**Target:** pre-existing opposing extreme not yet consumed after target selection.

**Unresolved:** outside duration, reclaim/confirmation definition, stop extreme,
expiry and retest. Baseline must include breaks that never reclaim, not only
the attractive completed examples. HT03's simpler sequences are adjacent.

## PA05 — Three distinct visits / three-tap

**Source:** S29 pp16–21. Initial swing → separate sweep/deviation → later
retest of original area. The three listed source steps do not mandate MSB.

**Sequence / validation:** confirmed swing, excursion and subsequent return
must be distinct visits with a departure between them; consecutive overlapping
candles are not three independent taps.
**Entry:** predeclared third-visit touch or reaction confirmation. Adding MSB
creates a stricter variant, not a faithful extraction of every example.
**Invalidation:** continuation beyond the failed extreme before entry cancels;
hard stop beyond the declared swept/zone extreme after entry.
**Target:** opposing range/swing known before submission, with valid after-cost R.

**Unresolved:** visit tolerance, departure requirement, reaction, expiry,
reset and stop. No universal rule that a third touch is stronger; this must
not inherit results from a touch-count filter on an unrelated S/R map.

## PA06 — Sweep plus first opposite impulse

**Source:** STC18 pp8–9. Sweep sell-side geometry then first impulsive up candle
with other confluence; short mirror is an explicit proposed symmetry. This is
less restrictive than PA01's internal MSB and origin-zone retest.

**Sequence / validation:** pre-known extrema/liquidity proxy → breach → observed
opposite impulse plus a specified already-known zone/context. Do not require
the later opposing sweep to select a signal: that is the proposed outcome.
**Entry:** next executable price after the chosen impulse confirmation, not its
earlier low/high. If a resting retest is desired, it is a new waiting variant.
**Invalidation:** the guide does not give a complete sweep-trade stop rule;
proposed stop beyond the swept extreme must be explicitly tested. Pending
signals expire or cancel on thesis failure/target consumption.
**Target:** opposing known liquidity proxy; source discusses staged targets.

**Unresolved:** impulse strength, mandatory confluence, stop, expiry, time exit,
side symmetry and target offset. Source certainty about the next sweep is
unsupported. Compare directly against sweep-only and PA01 when implemented.

**Scoped implementation:** [PA07](../codex-astra-price-action-setups-findings-2026-09-18.md)
tested1h confirmation with a declared4h bracket/discount-premium confluence,
6h wait and24h holding cap on HYPE. Only5long/7short primary fills; insufficient
evidence. This does not validate or falsify all sweep/impulse variants.
