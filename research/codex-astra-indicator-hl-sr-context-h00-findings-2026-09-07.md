# H00: frozen indicator opportunities with known-time HL/S/R context

September 7, 2026. **Coverage/descriptive checkpoint complete; no new trading filter tested.**
[Method and reproduction](../docs/research/indicator-hl-sr-context-h00.md) ·
[Frozen card](../research-inputs/indicators/context-h00-2026-09-07.json) ·
[Curated snapshot](../research-inputs/indicators/h00-context-summary-2026-09-07.json).

## TL;DR

- **14/14 original Bollinger opportunities have usable context** under the frozen source-availability/quality rules. All 13 unfiltered, 12 old-CMF and 11 refined-CMF trades retain coverage at both fill delays. Six repeated recent baseline cases match accepted R01 exactly; missing sources explain none of their differences.
- **The data supports investigation, not another proven filter.** Refined baseline is 8 wins / 3 losses, +$1,190.58 immediate (+$1,125.36 delayed). Buy-dominant flow accounts for two losses but also a larger win; nearby support includes three wins and one loss. Preserve those counterexamples instead of selecting only warning signs before losses.
- **Timing is causal under a disclosed historical model, not proven live receipt.** All taker rows use end+1m modeled publication; book/asset rows use sample-time proxies. Zero new economic definitions, zero ladder replays, no live changes. Accepted inventory remains **5,253 standalone / 45 ladder**.

## 1. Exact scope and unchanged baseline

**Enriched period: May 17, 2026 20:43 → September 4, 2026 19:01 UTC.**
The 14 actual opportunities fall between May28 and August8; there are no new
original crossings after August8 through cutoff. This is not a latest-data
trading report and is not a sample of the live HL short owner's fills.

Freeze the accepted R01 rules:

- Original: fresh completed **4h Bollinger20/2 downside crossing**, previous
  percent-B ≥0 and current <0; short.
- C02-32: the same crossing plus last completed **1h CMF20 <0**.
- R01-08: the same crossing plus last completed **1h CMF20 <−0.05**.
- One position, **$10,000 fixed notional**, fixed **12h hold** from fill;
  $32,000 reference equity. Immediate and +1m action sensitivity; 0.055%
  modeled fee per side, separate extra5bps/side stress in saved baseline.
  **Before funding. No TP/SL, maker execution, ladder or shared-account overlay.**

HL/S/R never changes these decisions in H00. The 84 archived decision rows are
14 timestamps ×3 rules ×2 delays. The 72 joined trade rows repeat overlapping
baselines/delays; **they are not 72 independent market trades**. The occupied
July28 08:00 crossing has no invented counterfactual PnL.

### Enriched-period baseline: reproduced before attaching context

| Setup / delay | W / L | Winning dollars | Losing dollars | Net | Closes with full context |
| --- | --- | --- | --- | --- | --- |
| Unfiltered Bollinger / 0m | 8 / 5 | $1,589.94 | −$683.31 | $906.64 | 13 / 13 |
| Unfiltered Bollinger / +1m | 8 / 5 | $1,632.37 | −$785.58 | $846.79 | 13 / 13 |
| Old CMF <0 / 0m | 8 / 4 | $1,589.94 | −$635.81 | $954.13 | 12 / 12 |
| Old CMF <0 / +1m | 8 / 4 | $1,632.37 | −$742.60 | $889.77 | 12 / 12 |
| Refined CMF <−0.05 / 0m | 8 / 3 | $1,589.94 | −$399.36 | $1,190.58 | 11 / 11 |
| Refined CMF <−0.05 / +1m | 8 / 3 | $1,632.37 | −$507.01 | $1,125.36 | 11 / 11 |

The fully covered cohort is identical to its own archived baseline.
That is **coverage attribution**, not a new readiness-filter strategy result.

### Full candle history: background only

**July 1, 2025 00:00 → September 4, 2026 19:01 UTC.** These accepted R01 rows
are copied from its pinned bundle, not rerun as H00 full-history cases.
Corresponding rich HL history does not exist for the full window.

| Full history / delay | W / L | Winning dollars | Losing dollars | Net |
| --- | --- | --- | --- | --- |
| Unfiltered Bollinger / 0m | 35 / 32 | $8,498.70 | −$5,633.87 | $2,864.82 |
| Old CMF <0 / 0m | 32 / 27 | $8,005.12 | −$4,579.58 | $3,425.55 |
| Unfiltered Bollinger / +1m | 29 / 30 | $6,396.83 | −$5,650.41 | $746.42 |
| Old CMF <0 / +1m | 27 / 25 | $6,475.60 | −$4,609.66 | $1,865.94 |
| Refined CMF <−0.05 / 0m | 31 / 23 | $7,972.09 | −$3,884.88 | $4,087.21 |
| Refined CMF <−0.05 / +1m | 27 / 20 | $6,475.60 | −$3,840.74 | $2,634.86 |

R01-08's earlier profit-screen pass remains unchanged; its defensive and strict
screens still fail. H00 adds no evidence that changes those screen outcomes.

### Recent monthly attribution, immediate

By realized close month, not hand-labeled market regime. No open positions at
cutoff. These are the **same three archived baselines**, not H00 variants.
The curated snapshot retains both-delay monthlies; full-history marked monthly
deltas and risk screens remain in [R01 findings](codex-astra-indicator-refinement-r01-findings-2026-09-07.md).

| UTC close month | Unfiltered W/L; net | Old CMF W/L; net | Refined W/L; net | Refined Δ unfiltered / old |
| --- | --- | --- | --- | --- |
| 2026-05 | 1/0; $95.29 | 1/0; $95.29 | 1/0; $95.29 | $0.00 / $0.00 |
| 2026-06 | 3/2; $366.42 | 3/2; $366.42 | 3/1; $602.87 | $236.45 / $236.45 |
| 2026-07 | 3/2; $457.02 | 3/1; $504.51 | 3/1; $504.51 | $47.49 / $0.00 |
| 2026-08 | 1/1; −$12.10 | 1/1; −$12.10 | 1/1; −$12.10 | $0.00 / $0.00 |
| 2026-09 | 0/0; $0.00 | 0/0; $0.00 | 0/0; $0.00 | $0.00 / $0.00 |

One June22 loss removed by the refined CMF threshold explains all its additional
recent gain over the old pair. Attaching more features does not turn that one
event into independent confirmation.

## 2. Source coverage and what the clocks really mean

Sources: HL taker, HL banded order book and HL asset context. Asset context
provides both native OI and USD-marked OI, so a price fall is not mistaken for
native OI liquidation. H00 does not claim to study every collected HL stream:
vault/APR, liquidation feeds and funding economics are outside this card.

| Source | Scanned raw rows | Window rows | Retained raw lines | Minute bins without a new observation / longest gap |
| --- | --- | --- | --- | --- |
| hlTaker | 161,759 | 158,309 | 6,943 | 42 / 3m |
| book | 646,911 | 633,110 | 27,748 | 3 / 1m |
| asset | 632,016 | 618,494 | 27,102 | 21 / 2m |

Window rows use the frozen available-time interval. Whole raw files include
post-cutoff records, which are inventoried but not allowed into historical
decisions. The gaps above mean **minute bins without a newly eligible sample**,
not necessarily an unusable rolling feature. The whole book file also has one
invalid 0.5% band row and 116 stale-at-publication samples within the window;
healthy selected events do not imply universally healthy collectors.

| Month | Original opportunities | Healthy all-context opportunities |
| --- | --- | --- |
| 2026-05 | 1 | 1 |
| 2026-06 | 5 | 5 |
| 2026-07 | 7 | 7 |
| 2026-08 | 1 | 1 |
| 2026-09 (through cutoff) | 0 | 0 |

At each of the14 signal timestamps all frozen checks pass: taker15m/1h,
current0.5% book and valid5m/15m book changes, native/marked OI1h/4h fresh
anchors, continuous14d S/R, and their full intersection.

Exact thresholds: taker15m ≥14 distinct minutes, taker1h ≥55, age≤90s;
book age≤30s, non-coarse/non-truncated and valid band/time data;
asset age≤60s, anchor lag≤120s. Duplicate/invalid flow windows fail coverage.
S/R requires **4,032 consecutive closed5m candles**, not merely a row count.

The exact-entry taker15m snapshots each have14/15 minutes and age60s. That
missing final minute is the deliberate publication lag, not permission to
peek at the just-completed source minute.

**Historical receipt limitation:** every window taker row uses modeled
end+1m publication; all book/asset rows use sample-time proxies. No row gains
proof of actual past receipt from a recovered candle or a file's modification
time. `historicalArrivalProven=false` stays explicit in every snapshot.
A later context replay needs arrival-lag sensitivity; current coverage is
conditional on this disclosed clock model.

## 3. All opportunities, not just winners

All dollars below are original **immediate** baseline trade outcomes.
A dash is no trade under that baseline, not a zero-dollar hypothetical entry.
Negative book change means deterioration in (bid−ask)/(bid+ask).

| Signal UTC, 2026 | R01-08 decision | Parent net | Old net | Refined net | Taker15m, T−15 → T | Book Δ15m | Native OI1h Δ% | Support below % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 05-28 00:00 | accepted | $95.29 | $95.29 | $95.29 | 0.438 → 1.027 | 0.171 | -0.153 | 1.118 |
| 06-04 08:00 | accepted | $183.23 | $183.23 | $183.23 | 0.664 → 0.603 | -0.042 | -0.598 | 0.221 |
| 06-05 00:00 | accepted | $412.12 | $412.12 | $412.12 | 2.400 → 0.837 | 0.136 | 0.066 | 0.136 |
| 06-05 16:00 | accepted | −$191.56 | −$191.56 | −$191.56 | 0.779 → 0.960 | 0.000 | 1.002 | 1.110 |
| 06-22 04:00 | condition_false | −$236.45 | −$236.45 | — | 0.175 → 0.744 | 0.589 | -0.948 | 1.404 |
| 06-23 08:00 | accepted | $199.09 | $199.09 | $199.09 | 0.751 → 0.305 | 0.107 | -0.270 | 4.610 |
| 07-08 16:00 | condition_false | −$47.49 | — | — | 1.582 → 0.426 | -0.166 | -0.721 | 0.757 |
| 07-13 08:00 | accepted | $268.52 | $268.52 | $268.52 | 0.617 → 1.688 | 0.187 | 0.147 | 0.888 |
| 07-17 00:00 | accepted | $58.69 | $58.69 | $58.69 | 1.322 → 0.676 | -0.031 | 0.353 | — |
| 07-22 08:00 | accepted | −$117.82 | −$117.82 | −$117.82 | 0.909 → 2.496 | -0.216 | 0.186 | — |
| 07-28 00:00 | accepted | $295.12 | $295.12 | $295.12 | 0.343 → 0.854 | -0.431 | -0.181 | — |
| 07-28 08:00 | occupied | — | — | — | 0.467 → 1.808 | -0.032 | 0.087 | — |
| 07-31 20:00 | accepted | $77.89 | $77.89 | $77.89 | 0.453 → 0.956 | -0.087 | 0.080 | — |
| 08-08 00:00 | accepted | −$89.98 | −$89.98 | −$89.98 | 1.417 → 3.023 | 0.094 | -0.060 | 0.014 |

Full source references, raw excerpts, T−15/T−5/T flow/book/OI snapshots,
both-delay decisions/trades, all current/prior confirmed zones and exact
configured proximity hits are saved in
[opportunities.json](../backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-v2/opportunities.json).
The [CSV](../backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-v2/opportunities.csv) is the lighter inspection surface.

## 4. What flow does and does not distinguish

Pre-frozen descriptive classes: sell-dominant ratio≤0.85, buy-dominant≥1.2,
neutral strictly between. These are **cohorts of already executed baseline
trades**, not replays that discard some trades and admit replacements.

| Flow at original entry / baseline | W / L | Winning dollars | Losing dollars | Net 0m | Net +1m |
| --- | --- | --- | --- | --- | --- |
| all / Unfiltered Bollinger | 8 / 5 | $1,589.94 | −$683.31 | $906.64 | $846.79 |
| all / Old CMF <0 | 8 / 4 | $1,589.94 | −$635.81 | $954.13 | $889.77 |
| all / Refined CMF <−0.05 | 8 / 3 | $1,589.94 | −$399.36 | $1,190.58 | $1,125.36 |
| sell / Unfiltered Bollinger | 4 / 2 | $853.13 | −$283.94 | $569.19 | $616.82 |
| sell / Old CMF <0 | 4 / 1 | $853.13 | −$236.45 | $616.68 | $659.81 |
| sell / Refined CMF <−0.05 | 4 / 0 | $853.13 | $0.00 | $853.13 | $895.40 |
| neutral / Unfiltered Bollinger | 3 / 1 | $468.29 | −$191.56 | $276.73 | $160.76 |
| neutral / Old CMF <0 | 3 / 1 | $468.29 | −$191.56 | $276.73 | $160.76 |
| neutral / Refined CMF <−0.05 | 3 / 1 | $468.29 | −$191.56 | $276.73 | $160.76 |
| buy / Unfiltered Bollinger | 1 / 2 | $268.52 | −$207.80 | $60.72 | $69.20 |
| buy / Old CMF <0 | 1 / 2 | $268.52 | −$207.80 | $60.72 | $69.20 |
| buy / Refined CMF <−0.05 | 1 / 2 | $268.52 | −$207.80 | $60.72 | $69.20 |

There are6 sell,4 neutral and4 buy-dominant opportunities; one buy-dominant
opportunity was occupied. Key counterexamples:

- July22 and August8 are losing refined trades with buy-dominant taker15m,
  together −$207.80. But July13 has ratio1.688 and **+$268.52**. Thus the
  buy-dominant refined cohort is **net +$60.72**, not a proven losing category.
- Sell-dominant refined trades are4W/0L, +$853.13, but the original
  unfiltered sell-dominant cohort also contains **two losses**. CMF already
  removed those; the apparent4/4 is conditional on that earlier selection.
- Restricting attention to the four strong-selling refined trades would
  retain fewer than the unchanged10-trade recent sample floor and discard
  **four other winners**. A nicer selected win rate is not sufficient.
- The June5 16:00 loss has native OI1h **+1.002%** while USD-marked OI falls
  **−4.583%**. Calling that native OI unwinding would be wrong; price fell
  about5.529%. This is why the two quantities are separate.

These are useful mechanism questions, not a threshold ranking. No new
taker/book/OI condition has passed or failed an economic acceptance screen.

## 5. What S/R does and does not distinguish

The geometry is the current pinned live configuration: 30m bars,4 left/4
right pivot confirmation,0.45% clustering,minimum2 touches,14d memory,
1% configured proximity buffer. Zones are rebuilt from completed prefixes.

“Near” means a known zone below entry price within1%; “far” means the nearest
known zone is farther than1%; “none” means no zone below price in this14d
confirmed map. **None is not missing candle coverage or proof that support
does not exist.** At exact equality, zones are stored separately.

| Support at original entry / baseline | W / L | Winning dollars | Losing dollars | Net 0m | Net +1m |
| --- | --- | --- | --- | --- | --- |
| near / Unfiltered Bollinger | 3 / 2 | $863.87 | −$137.48 | $726.39 | $774.11 |
| near / Old CMF <0 | 3 / 1 | $863.87 | −$89.98 | $773.89 | $817.09 |
| near / Refined CMF <−0.05 | 3 / 1 | $863.87 | −$89.98 | $773.89 | $817.09 |
| far / Unfiltered Bollinger | 2 / 2 | $294.38 | −$428.01 | −$133.63 | −$252.99 |
| far / Old CMF <0 | 2 / 2 | $294.38 | −$428.01 | −$133.63 | −$252.99 |
| far / Refined CMF <−0.05 | 2 / 1 | $294.38 | −$191.56 | $102.82 | −$17.40 |
| none / Unfiltered Bollinger | 3 / 1 | $431.70 | −$117.82 | $313.88 | $325.67 |
| none / Old CMF <0 | 3 / 1 | $431.70 | −$117.82 | $313.88 | $325.67 |
| none / Refined CMF <−0.05 | 3 / 1 | $431.70 | −$117.82 | $313.88 | $325.67 |

Near support includes **three refined winners / one loss, +$773.89**. In
particular June5 00:00 earns +$412.12 with support just0.136% below price;
July13 earns +$268.52 with support0.888% below. August8 loses −$89.98 with
support just0.014% below and buy-dominant flow. A blanket support-proximity
veto would discard important winners as well as that loser in the saved
ledger. This neither proves S/R useless nor establishes a replacement rule.

Recent-level behavior uses the support/resistance frozen at **T−15m**, then
only the two completed5m closes ending T−5m and T, with a0.1% buffer. It never
uses the next bounce or the lowest price reached during the trade.

### Trace: June22 04:00 UTC rejected refinement opportunity

- Trigger4h candle closes at04:00; CMF source is03:00–04:00 and equals
  **−0.04352444**. Old CMF<0 accepts; refined CMF<−0.05 rejects. Both gate
  decisions precede the eventual old-pair **−$236.45** result.
- Taker raw lines50838–50851 in `HYPEUSDT_taker_hyperliquid.jsonl` are the
 14 eligible closed minutes. The last source ends03:59 and becomes eligible
  at04:00 under end+1m. Ratio=.74413, versus .17493 at03:45: selling is
  still dominant but **less** dominant, not more.
- Book physical line203285 has source time03:59:41.002, sample-time proxy
  03:59:46.010 and minute eligibility04:00. Imbalance moves from−.55342 at
  T−15 to+.03587 at T: substantial observed improvement despite the red price.
- Support frozen at03:45 is$65.84367. Last two completed5m closes are
  $65.491/$65.461, both below the frozen level by0.1%. Current nearest
  support is now$64.54167. No later chart level was inserted backward.
- The previous zone's minimum-two-touch usability and latest-touch
  confirmation both predate the freeze. The snapshot retains all touch
  times, rather than treating the engine's earliest `confirmTs` as proof
  that the final multi-touch level was already usable then.

This trace shows conflicting known-time information, **not a retrospectively
chosen “obvious” short or a newly backtested recovery rule**. Accepted and
occupied records are preserved with the same schema; unavailable cases are
covered by synthetic regressions because none of these14 are unavailable.

## 6. Verification and accepted artifact lineage

Accepted bundle: [H00 v2](../backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-v2/manifest.json).

- Six recent parent/old/refined ×delay baseline replays exactly reproduce
  accepted R01 stats, decisions and fills before context attribution.
- Independent raw-file scan checks all61,793 retained raw evidence lines,
  eligible selection, availability clocks and no omitted selected records.
- Independent math checks42 pulse snapshots and3,066 flow-source references;
  these repeated references are not3,066 independent signals.
- Independent closed-prefix S/R reconstruction matches **628 zone snapshots**
  across current/prior contexts, including clustering/touch confirmation.
- Three real signal prefixes match full-run pulse and S/R outputs; fixtures
  cover future/late rows, duplicate/invalid flow, stale/coarse book, missing
  candle continuity, OI units and closed-bar boundaries.
- Independent verification now also checks the14 **flat JSON and CSV exports**,
  not only nested evidence. Research-specific strict typecheck, standard and
  VPS typechecks pass. The six protected live/config/state file hashes match.

Initial `hype-indicator-hl-sr-context-h00-2026-09-07/` is **superseded**:
an export-only naming collision let health flags overwrite numeric book
columns in flat JSON/CSV. Nested raw evidence was intact. The fix prefixes
health fields `healthy_*`; the identical frozen card/data were rerun into
v2 and independently checked including those exports. No threshold or
economic definition changed. Do not mix initial exports with v2 artifacts.

The runner's `validation.json` records its pre-independent-check phase;
`independentVerificationPending:true` there is historical staging, not
the final verdict. Acceptance comes from the separate hashed
[verification.json](../backtests/hype/hype-indicator-hl-sr-context-h00-2026-09-07-v2/verification.json) with `passed:true`.
Do not modify pinned source/artifacts in place after acceptance.

## 7. Decision at this checkpoint

**Coverage checkpoint passes under the stated arrival assumptions.**
No new economic filter, qualified production rule or ladder improvement is
established by H00. A variant ranking, top-five monthly delta table and
falsified-strategy update are inapplicable because **zero variants were run**.
Archived baseline economics and per-month comparison are supplied above.

The next bounded checkpoint can freeze a small **one-condition-at-a-time**
context card with unchanged indicators/exits, own readiness controls and
arrival-lag sensitivity. Full path/occupancy replay is mandatory: a filtered
ledger cannot measure newly enabled entries. Keep all rejected/occupied
opportunities and the sample floor; no cross-product or threshold chosen to
isolate these particular two losses. Only after a credible context result
should one explicit ladder decision be tested against its current repaired
canonical baseline.

No live config/state/source change from H00, trading/API call, new service,
short unpause, commit, push or deployment.

