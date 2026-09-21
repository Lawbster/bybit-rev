# RektProof direct lessons: source extraction

2026-09-18. Extraction only; no implementation, economic test, or validation of author performance. PDF page numbers below are one-based, not printed lesson numbers. Source statements describe the author's framework, not independently established market mechanisms.

## Coverage and identity

Reused `backtests/document-review/corpus-e52862db84636e0521d65a138877fd3b84e30691b05bb52585987f1680a95d7b/manifest.json` and its per-document `pages.json`. Manifest supplies complete filenames, SHA-256 identities and cache paths. All text read across these nine files (76 PDF pages, including blank endings). Selected pages rendered at 1.5x and visually inspected; cached as `review-pN.png` under each document's manifest cache. Rendering is not a claim that every diagram was reviewed.

| PDF filename prefix / lesson | Total pages | Visually inspected pages |
|---|---:|---|
| 616779946 / PA 1 Orderblocks | 10 | 2,3,5,7,9 |
| 616780096 / PA 3 Breaker | 11 | 2,4,6,8 |
| 616780137 / PA 5 LGs (FVG) | 9 | 3,4,7 |
| 761430175 / Lesson 1 | 8 | 2,4,8 |
| 761430261 / Lesson 10 TPO | 9 | 4,5,8 |
| 761430263 / Lesson 9 Monday | 7 | 5,7 |
| 761430265 / Lesson 11 PO3 | 7 | 4,5,7 |
| 761430596 / Lesson 7 Range/MSB | 6 | 2,4,5,6 |
| 761430600 / Lesson 6 Breaker strategy | 9 | 1,4,5,7,8 |

## Source: load-bearing rules

### Orderblocks: qualification precedes entry

An opposite-colour candle alone is insufficient: a proper orderblock requires a market-structure break. Supply is the up candle/move before the down move that broke structure; demand reverses the construction. Lesson 1 explicitly leaves MSB marking to personal preference. Three distinct methods are taught, not one universal entry: common entry at the start of the block; 0.705 retracement of the relevant swing within the block; and personal practice combining a prior liquidity run, MSB and that OTE. The bearish common example places invalidation above supply and targets swing lows. (616779946 pp2–5; 761430175 pp2–4.)

Bullish OTE text puts invalidation below demand. The bullish common example's prose says “above,” while its chart puts the risk area below; the bullish personal prose says target an untapped low, while its chart targets a prior high. Preserve these as source transcription inconsistencies, not literal symmetric rules. The demand zone shown on the daily example is not permission to place a long stop above entry. (616779946 pp6–9, particularly visuals pp7,9; 761430175 pp5–8.)

The inspected diagrams do not establish a universal full-wick zone formula. Their grey rectangles identify the origin of the move, but do not supply an OHLC algorithm. These direct Lesson 1 copies also do not explicitly state a following-candle engagement condition. Do not attribute either condition to these pages without separate source evidence.

### Breaker concept versus the named breaker strategy

The broad Lesson 3 definition is a failed orderblock: it must qualify as an orderblock first, then fail and flip role. The common bearish construction uses demand preceding a move that took a swing high/broke structure; its failure becomes supply. Entry is at the breaker start, stop above, target swing lows; bullish direction reverses this. Personal examples add liquidity engineering and market-structure shift. One explicitly pairs an H4 breaker with an H1 structure shift/test. (616780096 pp2–10, particularly pp4,6–8.)

The named Lesson 6 strategy is more restrictive: first swing low and first subsequent swing high define the bullish range; price sweeps/deviates below the low; the supply responsible for the down move fails; **a higher high above previous swing points must print before entry**; then seek a higher-low retest of flipped supply. Its diagram confirms the new high is beyond the earlier range swing high, not merely beyond the block. Bearish example mirrors this with a high sweep, lower-low shift and failed-demand retest. A zone breach alone is not the completed named setup. (761430600 pp2–5,7–8; visual overview p1.)

No standalone mitigation-block definition or precise breaker-versus-mitigation taxonomy appears in this direct subset. “Mitigating their losses” in Lesson 3 p2 is explanatory language, not a second detector specification.

### Range reversal: ordered events and close-confirmed MSB

Range selection is acknowledged subjective; author usually selects the first two swing points after exhaustion. Sequence: range → sweep/deviation at one edge → MSB → formed S/D retest → untapped opposing range edge. Sweep alone is expressly insufficient. For a high sweep, use the valid swing lows that led into the sweep high and require their break **on a closing basis**. Supply is the last up move before the series of candles leading into that break. The example's supply retest occurs after confirmation, and the target is the original untapped range low. (761430596 pp2–6.)

### Monday, PO3, profiles and inefficiency are contextual

- Monday lesson explicitly disclaims being a trading method. Wait for Monday close; use that week's Monday high/low and untapped levels from the immediately previous week, not unlimited history. Author advises avoiding Monday trading. Its H1 breaker bonus is labelled hindsight: Monday-high raid → new-low MSB → breaker retest → Monday-low target. Session timezone is not supplied. Its examples call stops above highs “sell stops” and below lows “buy stops”; these labels are reversed relative to conventional protective-stop direction, so preserve geometry rather than copying labels into code. (761430263 pp1–5.)
- PO3 means accumulation, manipulation, expansion. Personal requirements include trading/sweeping beyond an old low/high and an old opposite-side high/low available for expansion exits; old Monday extrema are preferred. Require confluence with S/D or a range rather than entering on PO3 appearance alone. Opens are accumulation context. ETH example combines an old-low break with 2D demand; FIL example accumulates around/above EQ before taking range lows. (761430265 pp2–5,7.)
- TPO is described as **time at price**, with daily profiles used to support price action. Naked POCs are untapped POCs left behind by range breakout; return into that range provides the context for revisiting them. Range EQ/fair-value area is an area to avoid initiating range trades; buy lows/sell highs. The source uses 69% for value area but gives no reproducible binning or expansion algorithm. It does not establish equivalence to an existing volume-based POC implementation. (761430261 pp1–5.)
- Lesson 5 FVG describes consolidation/S&D origin → abrupt one-sided expansion through intervening levels → retracement to the origin. Its inspected diagrams show an expansion pole and disregarded support/resistance, **not an explicit three-candle non-overlap formula**. Do not silently replace this lesson with the popular mechanical FVG detector. (616780137 pp2–7.)

## Proposed versus unspecified

**Proposed research conventions, not source rules:** deterministic causal pivot confirmation; UTC session boundaries; bar-close availability and later eligible fills; fixed zone construction and freshness policy; first-retouch handling; stable target ownership. These need separately frozen definitions and visual fidelity review. Keep common OB, personal OB, generic failed-OB breaker and named Lesson 6 breaker distinct rather than pooling them.

**Unspecified in this subset:** pivot width/prominence; wick/body boundaries; engulf/engagement test; exact failure threshold; multiple candidate-block precedence; signal expiry; repeat-touch/re-entry policy; stop buffer; partial exits; minimum R; exact timeframe hierarchy. H4/H1, daily and 2D examples demonstrate variation, not a universal mandate. Narrative claims about institutional intent, typical fills, reliability and illustrated R multiples are not performance evidence or observed orderflow measurements.

## Addendum: duplicate/translation cross-check

Targeted cached-text comparison, not full visual review: 724900163 (85p) is English/Chinese parallel compilation of lessons 1–11; 679274203 (64p) is Chinese lessons 1–11; 696937102 (51p) is Turkish lessons 1–6, explicitly marked automated translation. These are overlapping teaching material, not independent corroboration. Viewed only 724900163 pp8,57; 679274203 pp7,43; 696937102 pp3,46, with renders in the existing caches.

No additional explicit next-candle-engagement or universal OHLC block-boundary rule was found in the inspected Lesson 1 sections (85p version pp5–12; Chinese pp5–12; Turkish pp1–8). The charts retain the same example structure; some compilation charts are redrawn/reformatted. Breaker HH-before-entry confirmation repeats at 85p p48, Chinese pp35–36 and Turkish p46. Monday-close/current-or-prior-week scope repeats at 85p p61 and Chinese p47; neither supplies a timezone. Daily time-at-price TPO repeats at 85p pp66–68 and Chinese pp51–52, including 69% value area. Turkish's six-lesson scope does not cover Monday/TPO.

Lesson 8 is additional coverage relative to the nine direct files above, not evidence of a new translated rule: await LTF sweeps inside a post-MSB S/D level rather than aggressive first touch; place the short stop above the swept high; the thesis expects no second sweep of that same level (85p pp56–57; Chinese pp41–43).

Translation warning: 85p p57 Chinese reverses/distorts the English instruction to await LTF sweeps; Chinese p47 and 85p p61 mangle the “not further than current/prior week” limit. Chinese p52 describes POC with volume-like wording despite its immediately preceding time-at-price definition. Prefer the paired English wording/direct source; do not treat translation artifacts as new strategy conditions.
