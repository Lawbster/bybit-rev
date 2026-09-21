# Actual HYPE TP events and Hyperliquid context

September 7, 2026. Descriptive sidequest before further indicator/ladder/
combination testing. **Zero strategy variants, zero replay runs, zero live changes.**

## TL;DR

- **327 classified long batch TPs** since local HL collection began, plus
  **28 actual S/R partial exits**, stored separately. Of 327 full TPs, 323
  have a usable trigger/fill-time anchor and **293 have healthy core HL
  context**. Each event has 16 snapshots covering -15 through 0 minutes.
- **Buying strengthens into TPs, while the book often becomes more ask-heavy.**
  At usable long TPs, mean 15m buyer share is **60.86%**, versus **50.63%** in
  the month/hour-standardized market reference. But **217/294 (73.8%)** have
  an ask-heavy 0.5% book. These describe realized recoveries, not a validated
  entry/exit filter. **56/293** still TP with net selling in the flow window.
- Time-of-day and monthly tables, raw evidence, source clocks, missing-data
  flags and reference conditions are preserved for later work. No claim of
  prediction or historical receipt-clock certainty: legacy HL publication is
  modeled, and most long impact times are **TP trigger proxies**, not exact
  exchange executions. Independent raw-row/accounting checks pass.

## 1. Dates, scope and baseline

Study window: **April 25, 2026 23:09:32.643 UTC through September 7, 2026
04:30:54.175 UTC**. April and September are partial months. First cataloged
long TP is April 26 19:48:35; last is September 6 12:26:17 UTC. The cutoff is
the copied runtime-health snapshot, not a newly queried exchange balance.

HL OI/funding/HLP begin April 25. Taker, book, asset context and HL candles
begin May 17 around 20:42–20:43 UTC. This is why “since HL collection began”
does not mean all rich features exist for every April/May event.

**These are actual recorded closes under changing historical configurations.**
They are not today's $800 ladder held constant through history, not a
counterfactual strategy, and not the canonical replay. Old TP settings,
sizing, gates, accounting and later maker behavior differ. Do not equate
the dollars below with a current-stack backtest or funding-inclusive wallet
return. Fees already included in booked PnL are not subtracted again.

Baseline beside the selected TP subset:

| Recorded cohort | Events | Wins | Losses | Winning dollars | Losing dollars | Net booked PnL |
|---|---:|---:|---:|---:|---:|---:|
| **Baseline: all long full closes** | **359** | **337** | **22** | **$74,546.56** | **-$69,337.96** | **+$5,208.60** |
| Classified long TPs, subset of baseline | 327 | 327 | 0 | $71,960.35 | $0.00 | +$71,960.35 |
| Forced full closes, subset of baseline | 22 | 0 | 22 | $0.00 | -$69,337.96 | -$69,337.96 |
| Unclassified full closes, subset of baseline | 10 | 10 | 0 | $2,586.22 | $0.00 | +$2,586.22 |
| S/R partial exits, **separate from full-close rows** | 28 | 28 | 0 | $2,574.12 | $0.00 | +$2,574.12 |
| Retained transactional short closes, separate owner | 20 | 7 | 13 | $2,523.67 | -$6,414.74 | -$3,891.07 |

The $71,960 TP total is a **selected winning-exit subtotal**, not total
system profit. Long full-close rows report $13,340.92 fees, including
$11,228.87 on the TP subset; these fees are already in the net figures.
The short receipt sum exactly matches that owner's state realized PnL.
This does not independently establish exchange-ledger completeness.

All 359 full-close journal rows uniquely match PM2 batch-close lines. Two
exact duplicate trade-journal rows were removed. The 35 other PM2 batch
closes match earlier journal events, April 4 through April 25 09:35 UTC,
before the first HL observation; they are not unexplained in-window gaps.

### Month by month: do not hide losses behind TP counts

| Month | Baseline all full closes W/L | Baseline net | TP n / net | Forced n / net | Other full-close net | Separate S/R n / net |
|---|---:|---:|---:|---:|---:|---:|
| Apr 25–30 | 3 / 2 | -$4,396.88 | 3 / +$2,236.65 | 2 / -$6,633.53 | $0.00 | 0 / $0.00 |
| May | 107 / 2 | +$10,282.10 | 104 / +$23,846.12 | 2 / -$14,175.19 | +$611.17 | 0 / $0.00 |
| June | 133 / 8 | +$3,551.66 | 131 / +$30,096.34 | 8 / -$27,511.75 | +$967.07 | 0 / $0.00 |
| July | 23 / 6 | -$8,839.05 | 22 / +$5,207.42 | 6 / -$14,208.09 | +$161.62 | 8 / +$839.40 |
| August | 57 / 4 | +$2,032.29 | 54 / +$8,248.82 | 4 / -$6,809.41 | +$592.87 | 13 / +$948.25 |
| Sep 1–7 cutoff | 14 / 0 | +$2,578.48 | 13 / +$2,325.00 | 0 / $0.00 | +$253.48 | 7 / +$786.47 |

Each row is an exit-month accounting attribution, not a model predicting that
month's losses. No claim is made here that a new filter would preserve every
TP while avoiding these forced closes.

## 2. TP classification and timing quality

56 long TPs have an explicit reason: 18 native, 17 ordinary and 21 stale.
271 legacy TPs are supported by matched PM2 TP triggers; their exact
historical target subtype is not invented from today's thresholds. All
original reason/target/price information is retained in the event rows.

Four explicit TPs lack a trustworthy fill/trigger timestamp. They remain in
money/count tables but are excluded from primary impact-aligned analysis:

| Journal UTC | Reason | Booked PnL |
|---|---|---:|
| Aug 19 14:57:07 | NATIVE_TP | +$212.72 |
| Sep 2 00:20:48 | STALE TP | +$129.94 |
| Sep 2 05:24:52 | STALE TP | +$30.15 |
| Sep 3 14:16:03 | STALE TP | +$86.65 |

Their proxy-aligned rows are still available, clearly flagged. Do not merge
them into exact-timing analysis merely because the source streams are fresh.

Of the 323 time-aligned long TPs, 29 precede rich HL collection; one more,
**May 20 23:39:25 UTC**, has conflicting taker bucket copies and only 13
unambiguous available minutes. Its flow is masked, not set to zero. Thus:

- Flow/core: **293 valid TPs**.
- Book/asset OI: **294 valid TPs**.
- Funding/REST OI/HLP: **323 valid aligned TPs**.

There are 10 unclassified profitable full closes. They include August 13's
suspected native TP and explicit `EXTERNAL_CLOSE_UNCLASSIFIED` events on
August 23/27 and September 1. Price proximity and profit alone do not turn
these into confirmed TPs. Their identities and evidence remain in the atlas.

### A concrete timing correction and causal trace

The August 20 native TP was journaled at **16:38:38.083**, but the user's
earlier Bybit export records six executions at **15:40:08.797**. Matching
quantity 46.09, order identity, weighted exit $73.38193968 and booked
PnL $41.756707695 validates the match. The atlas uses the execution time,
not the **58m 29.286s later** reconciliation log.

For that event's offset-0 snapshot:

- Last included taker bucket ends 15:39:00; modeled availability 15:40:00,
  before the 15:40:08.797 fill. The bucket ending 15:40 is not included.
- Book source time is 15:40:03.521; sample time 15:40:08.199, also before
  the fill. Source line 545914, not a later same-minute observation.
- Latest usable HL 1m candle starts 15:38 and ends 15:39; modeled
  availability 15:40. No candle closing after the event is used.

That row shows 69.17% buyer share, book imbalance -0.0904 and native OI
change -0.3848%. It is a useful counterexample to demanding OI expansion
at every successful recovery. This remains one example, not a rule test.

## 3. Time of day

All times are **UTC**. During this entire study Oslo is UTC+2; add two hours
for local display, retaining UTC in joins. TP counts are batch events, not
the number of individual rungs closed.

The clock reference uses **38,657 five-minute samples**, of which **32,238**
have healthy core HL context: approximately **2,686.5 healthy market hours**.
It is all-market time, not proven time when the ladder was open/eligible.

| UTC interval | TP count | TP net subtotal | Baseline all-full-close net in interval | Core-valid TP n | TPs per 100 healthy reference hours |
|---|---:|---:|---:|---:|---:|
| 00:00–04:00 | 59 | +$14,736.28 | +$14,818.48 | 49 | 10.88 |
| 04:00–08:00 | 49 | +$11,183.97 | -$8,410.59 | 46 | 10.29 |
| 08:00–12:00 | 53 | +$11,674.02 | +$7,068.93 | 48 | 10.81 |
| 12:00–16:00 | 70 | +$12,932.21 | -$1,828.37 | 65 | 14.52 |
| 16:00–20:00 | 46 | +$10,111.87 | -$1,423.07 | 40 | 8.95 |
| 20:00–24:00 | 50 | +$11,322.00 | -$5,016.79 | 45 | 10.00 |

The densest four-hour TP interval is **12:00–16:00 UTC / 14:00–18:00 Oslo**.
But its all-full-close net is negative, because forced losses also closed
there. This is exactly why exit-hour TP totals are **not** an entry-session
edge or proof that another interval should be blocked.

The busiest individual hour is 14:00–15:00 UTC, 21 TPs. All 24 hours have
TPs; lowest counts are seven each at 06:00 and 16:00. The complete 24-hour
table is in `hourly.csv` and `descriptive-breakdowns.md`, including dollars,
valid counts and reference density rather than just a rank.

| Weekday UTC | TP n | TP net subtotal | Core-valid TP n | TPs /100 healthy reference hours |
|---|---:|---:|---:|---:|
| Monday | 52 | +$12,824.65 | 48 | 12.36 |
| Tuesday | 48 | +$10,182.11 | 43 | 11.22 |
| Wednesday | 59 | +$11,881.26 | 54 | 14.09 |
| Thursday | 43 | +$8,207.46 | 40 | 10.42 |
| Friday | 57 | +$14,942.68 | 50 | 13.06 |
| Saturday | 23 | +$6,395.07 | 21 | 5.55 |
| Sunday | 45 | +$7,527.12 | 37 | 9.57 |

Saturday is descriptively quieter. These n are clustered in market episodes,
not independent day/session trials; there is no weekday-filter profitability
test in this work.

### Depth and holding time

| Rungs at batch close | TP n | TP net subtotal |
|---|---:|---:|
| 1–3 | 73 | +$1,677.31 |
| 4–7 | 86 | +$10,059.36 |
| 8–10 | 50 | +$16,802.09 |
| 11+ | 118 | +$43,421.58 |

Deep closes dominate TP dollars because they carry larger exposure. This is
not a marginal benefit estimate for adding rung 11. The 257 TPs with a
validated entry/holding-time reconstruction have median ladder age **2.51h**,
90th percentile **6.31h**, and maximum **57.71h**. Other holding times stay
unknown; modern add-decision logs are not treated as filled entries.

## 4. HL conditions at long TP impact

The baseline below is **ordinary market context, standardized to the same
month/UTC-hour mix as the usable TP events**, not open-ladder exposure. Each
event uses valid reference observations from its own month/hour cell.
Generated tables also contain the unstandardized all-market mean, median,
10th/90th percentiles and source-quality counts for every feature.

| Feature at TP | Valid TP n | Market reference mean | TP mean | TP median |
|---|---:|---:|---:|---:|
| Buyer-initiated share of known 15m flow | 293 | 50.63% | **60.86%** | 62.05% |
| Buy/sell notional ratio | 293 | 1.270 | **1.817** | 1.635 |
| Net taker notional, known 15m | 293 | +$0.058m | **+$2.186m** | +$1.544m |
| Traded notional, known 15m | 293 | $7.598m | **$10.897m** | $7.378m |
| Large-print notional share | 293 | 6.58% | **8.27%** | 6.83% |
| Last-5m vs prior-10m turnover pace | 293 | 1.293 | **1.776** | 1.098 |
| 0.5% resting-book imbalance | 294 | -0.0269 | **-0.1107** | -0.1443 |
| Change in 0.5% book imbalance over 15m | 294 | +0.0007 | **-0.0592** | -0.0763 |
| Native asset OI change over 15m | 294 | +0.0024% | **+0.0952%** | +0.0719% |
| Price-marked USD OI change over 15m | 294 | +0.0222% | **+0.8733%** | +0.8263% |
| Latest closed 15m HL return | 294 | +0.0200% | **+0.5962%** | +0.5567% |

**Interpretation:** TP exits naturally select upward recoveries. Buyer flow
and short-horizon returns being stronger at TPs is consistent with that
selection; it does not establish an early forecasting edge.

Three useful distinctions for later research:

1. **Executed buying is not the same as a bid-heavy resting book.** 237/293
   TPs have net buying, but 217/294 have an ask-heavy 0.5% book. Among the
   293 with both features, **182 combine net buying with an ask-heavy book**.
   Book bands move with the reference price; these snapshots do not prove
   specific cancellations or absorption. A simplistic “ask-heavy means no
   recovery” interpretation misses many actual recoveries.
2. **Positive confirmations are not universal requirements.** 56/293 TPs
   have net selling, and 91/294 have non-increasing native OI. We cannot turn
   the common pattern into a mandatory gate without pricing those missed
   recoveries in the later replay.
3. **Marked OI exaggerates apparent leverage growth when price rises.**
   +0.8733% marked OI is not +0.8733% additional contracts. Native OI moves
   only +0.0952% on average here. Both are stored, separately named.

REST native OI provides a longer-history cross-check: n=323, mean 15m
change +0.0906%, versus standardized reference +0.0024%. It broadly agrees
with the richer asset stream's description, without making their clocks
interchangeable.

### Funding, premium and HLP

Funding is positive at 297/323 aligned TPs (92.0%); it is also positive in
89.8% of raw market-reference samples. The median is the same **0.00125%
per hour** in both. Mean TP funding is 0.001487%/h versus standardized
reference 0.001233%/h. That looks more like background context than a unique
TP signature. These are HL quoted rates, not our Bybit funding cash flows.

HL premium averages +0.02917% at aligned TPs versus standardized reference
-0.00079%; it is positive in 186/323 events. Again this can accompany price
strength; causality or profitable threshold use is not established.

HLP distributable-capacity 15m changes are highly outlier-sensitive. TP
median is approximately **+0.000019%**, but the mean is **-0.0607%** and the
minimum -6.69%. The raw reference has even larger jumps. It would be wrong
to call this a reliable withdrawal/deposit signal. APR and capacity remain
stored with freshness/provenance for future controlled work.

## 5. What happens during the preceding 15 minutes?

This table uses **the same complete event cohort at every checkpoint for
each feature**, not a changing set of available rows. Each checkpoint's
flow/return is its own trailing window. At -15m, the 15m flow concerns the
period before that checkpoint, not future flow up to the TP.

| Mean feature | Paired n | -15m | -10m | -5m | -1m | At TP |
|---|---:|---:|---:|---:|---:|---:|
| Rolling 15m buyer share | 293 | 53.05% | 54.87% | 57.58% | 60.15% | **60.86%** |
| Rolling 5m buyer share | 293 | 54.69% | 56.89% | 58.70% | 62.01% | **62.88%** |
| Rolling 15m net taker USD | 293 | +$0.524m | +$0.760m | +$1.265m | +$1.964m | **+$2.186m** |
| 0.5% book imbalance | 294 | -0.0515 | -0.0580 | -0.0596 | -0.0996 | **-0.1107** |
| Rolling 15m native OI change | 294 | +0.0176% | +0.0359% | +0.0505% | +0.0731% | **+0.0952%** |
| Latest closed rolling 15m return | 293 | +0.1545% | +0.2152% | +0.3741% | +0.5309% | **+0.5962%** |

The buyer-share increase from -15m to impact averages **7.81 percentage
points**, but occurs in only **192/293 (65.5%)** events. Book imbalance
becomes more ask-heavy in **180/294 (61.2%)**. These are tendencies with
substantial exceptions, not deterministic sequences.

Every intermediate minute, per-event difference and source pointer is
stored; the five columns above are only the readable summary.

### Does this survive the month breakdown?

Means at usable TP times, with month/hour market baseline beside each:

| Month | Valid flow / book n | Buyer share: baseline → TP | Book imbalance: baseline → TP | Native OI 15m: baseline → TP |
|---|---:|---:|---:|---:|
| May, rich-data subset | 77 / 78 | 51.38% → **59.82%** | -0.0375 → **-0.1410** | +0.0089% → **+0.0797%** |
| June | 131 / 131 | 50.01% → **59.75%** | -0.0245 → **-0.0828** | -0.0013% → **+0.1115%** |
| July | 22 / 22 | 50.01% → **62.83%** | +0.0046 → **-0.0518** | -0.0001% → **+0.0918%** |
| August | 53 / 53 | 51.27% → **63.87%** | -0.0268 → **-0.1586** | +0.0041% → **+0.0821%** |
| September, partial | 10 / 10 | 50.97% → **63.15%** | -0.0448 → **-0.1152** | -0.0050% → **+0.0777%** |

The direction repeats across months, including July's poor overall account
performance. Nevertheless, 208/293 usable flow events are in May/June;
September n=10 is small, and these are overlapping market episodes. There
is no out-of-sample predictive validation in this descriptive table.

## 6. S/R partials and shorts: kept separate

All **28 executed S/R partials** match their exact preceding candidate row.
The stored `liveDecisionPulse` is the **actual live decision's pulse**, not
this atlas's reconstructed window mislabeled as the live gate. The two
contexts have separate timestamps, fields and provenance. All 28 recorded
zone confirmation times precede their decisions. Coverage metadata says
healthy for 25; three older candidate rows lack that field, not proof of
healthy historic hydration. This is not a revalidation of S/R construction.

| Cohort | Valid core n | Mean 15m buyer share | Mean book imbalance | Mean native OI 15m change | Mean closed 15m return |
|---|---:|---:|---:|---:|---:|
| Full long TPs | 293 flow / 294 other | 60.86% | -0.1107 | +0.0952% | +0.5962% |
| S/R partials | 28 | 61.45% | -0.0939 | +0.0154% | +0.2292% |
| Forced full closes, commit-time proxies | 18 | 43.44% | -0.0004 | -0.0667% | -0.6088% |
| Favorable native short closes, **untyped** | 5 | 37.21% | +0.0699 | -0.0930% | -0.5634% |

The forced/partial columns are contextual contrasts, not exposure-matched
controls. No “use this HL threshold to save a flatten” claim follows from
observing conditions when a flatten already happened.

The 20 short closes comprise **5 favorable native**, **4 adverse native**
and **11 other** closes. Native receipt type does not persist exact TP vs
SL identity, so favorable native is not promoted to confirmed TP. Other
closes include profitable timeouts and must not inflate the short TP count.
The small native-favorable n=5 cannot establish a robust short rule. Entries
remain paused exactly as before this study.

## 7. Timing sensitivity and validation

Legacy completed HL buckets do not retain their original publication
timestamps. Primary uses end+60s, an established conservative research
assumption; optimistic sensitivity uses end+0s. At the 293 paired TPs:

| Availability model | Mean buyer share |
|---|---:|
| Primary, +60 seconds | 60.86% |
| Optimistic, +0 seconds | 62.24% |

Buyer-/seller-dominance classification flips in **11/293** events, with a
maximum individual buyer-share difference of **28.77 percentage points**.
The aggregate direction persists, but individual-event timing can matter
greatly. **Zero** of 6,512 context rows can prove actual historical
publication from retained receipt clocks. “Healthy” is conditional on the
declared timing model, not a certification of historical live availability.

Completed verification:

- 15 focused tests: publication lag, future same-minute samples, source
  freshness, coarse books, duplicate/conflicting buckets, candle closure and
  gaps, native-vs-marked OI, negative funding, prefix invariance, evidence
  classification, delayed native execution, money/reference arithmetic and
  proper CSV escaping. CSV row/column counts and nested JSON round-trips also pass.
- Both repository TypeScript builds pass without emission; research sources
  also type-check separately.
- Independent checker: **407 events, 6,512 context rows, 436,201 source
  references, 84,655 distinct raw pointers**, exact clock/bound checks and
  **62,198 numeric assertions**. Eight fixed checkpoints independently
  reselect book/asset/flow directly from the complete source files.
- All 359 journal batch closes reaggregate to **+$5,208.596498757118**;
  monthly/hourly totals conserve the same event accounting. Source and
  artifact SHA-256 checks pass before/after verification.

These checks cover recorded data/formulas/joins. They do not establish
missing private execution completeness, funding cash-flow parity or a new
strategy's profitability. Canonical sim parity and a top-five variant gate
are **not applicable: no variant or simulation was run**.

## 8. Stored deliverables and how the next studies should use them

Local dataset:
`backtests/hype/hype-tp-hl-event-atlas-2026-09-07-v2/`.
Use this accepted revision, not the unsuffixed initial export. Revision 2
fixes CSV quoting; definitions and numerical results are unchanged.

- Start with **`events.csv`** for the catalog and **`event-features.csv`**
  for impact conditions. Join `id` to `eventId`.
- **`lead-in-features.csv`** contains every event-relative minute. Use
  **`event-context.jsonl`** for exact file/line/query/availability provenance.
- **`descriptive-breakdowns.md`** has generated tables, including every UTC
  hour and every feature. **`summary.json`** and
  **`descriptive-breakdowns.json`** retain full-precision grouped results,
  baseline comparisons, missing-time events and sensitivity.
- **`market-reference.jsonl`** supplies ordinary-time conditions with the
  same feature math. It is not a profitable strategy or at-risk baseline.
- **`manifest.json`**, **`validation.json`**, **`verification.json`** and
  **`descriptive-validation.json`** retain reproduction/integrity checks.

Method/schema/reproduction: [TP/HL atlas guide](../docs/research/tp-hl-event-atlas.md).
Frozen input definition: [study card](../research-inputs/tp-hl-events-2026-09-07.json).
Runner: [hype-tp-hl-event-atlas.ts](../scripts/hype-tp-hl-event-atlas.ts).

Useful retained questions for the **already planned later tests**, not new
strategy recommendations from this pass: how early buying strengthens,
when an ask-heavy book coexists with continued recovery, and whether native
OI adds information beyond price/flow. The exact counterexamples and their
PnL are now available rather than discarded by a neat-looking narrative.

Any predictive study must rebuild these features at **all eligible decision
times**, not just known future TPs, and include failed recoveries, ordinary
open-position windows and complete risk/exposure costs. Never feed future
TP time, PnL, exit price or event-selected timing into a live predictor.
Hold out full time blocks/episodes; the 16 rows around one TP are not 16
independent samples. No combinations, ladder variants or live policy have
been tested or changed by creating this atlas.
