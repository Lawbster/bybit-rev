# S/R encounters and HL pulse: first causal descriptive pass

September 5, 2026. Local research only. No live config, trading code, state,
orders, deployment, commit or push changed by this study.

## TL;DR

- **509 spaced encounters, 507 usable observations, 0/8 fixed combinations
  qualify for advancement.** Window: May 17 20:45 through September 4 19:01 UTC.
  This is a descriptive encounter study, not a portfolio replay or proof of
  incremental dollar PnL for the current ladder.
- **Support holding with sell-dominant flow looks positive in aggregate but
  fails temporal stability:** 50 observations average +0.173% after the 0.20%
  cost scenario; the later half averages -0.299%. Resistance acceptance with
  buy-dominant flow is +0.443%, but only 20 observations and five in the later
  half. Neither is a validated new entry/add rule.
- **Location-specific evidence remains weak.** Only 125/509 encounters could
  be matched to prior away-from-S/R controls; candidate cells have 0-22 matches.
  The study does not establish that S/R adds an exploitable advantage beyond
  price/flow context. Preserve the negative results and collect new evidence;
  do not change the live ladder or re-enable shorts from these results.

## What was frozen and tested

[Experiment definition](../research-inputs/sr-pulse-encounters/hype-2026-09-05.json)
and [method](../docs/research/sr-pulse-encounters.md).

Current geometry was held fixed: 30m zones, four left/four right pivot bars,
0.45% clustering, at least two confirmed touches, 14-day memory. At completed
5m time T, an encounter approaches within 0.3% of a level already known at
T-5m. Its price and touch list are frozen before observing the response.
This is an **approach-band encounter**, not proof the exact level was traded.

All comparisons wait until D=T+15m. The final two completed 5m closes must be
0.1% beyond the frozen level to classify a break, or 0.1% back on the approach
side to classify a hold. Other responses remain unresolved. A "hold" is this
specific price condition, not proof of order-book absorption or a durable floor.

At D, HL taker buy/sell >=1.2 is buying, <=0.85 is selling, otherwise neutral.
Primary coverage must be healthy at both T and D. The class does not require
the same directional imbalance throughout the approach/response window.
Eight cells are support/resistance x hold/break x buying/selling. No threshold
sweep or retrospective event selection was used. Global 256-minute spacing
prevents primary event outcome windows from overlapping.

Outcomes start at the first subsequent 1m bar open at D, not the earlier
encounter bar. Labels cover 1h/4h returns and excursions; the main comparison
uses directional 4h return less 0.11% or 0.20% round-trip costs. A +1m delayed
entry uses the same fixed exit timestamp. **These are fixed-horizon markouts,
not filled trades.** No sizing, TP/SL, funding, liquidation, portfolio drawdown,
or interaction with active ladder gates is simulated.

## Coverage and denominators

The scanner saw 9,440 level-approach candidates and suppressed 8,931 through
closest-level selection and global episode spacing. These are not 9,440
independent opportunities. There were no unhealthy S/R response windows.
One August encounter had incomplete primary pulse coverage; one September
encounter lacked a complete 4h outcome. Both remain in the ledger, not the
507-observation primary comparison.

| Month | Encounters | Healthy pulse | Complete 4h label | Primary comparison | Prior matches |
|---|---:|---:|---:|---:|---:|
| May, partial | 53 | 53 | 53 | 53 | 33 |
| June | 149 | 149 | 149 | 149 | 27 |
| July | 146 | 146 | 146 | 146 | 18 |
| August | 141 | 140 | 141 | 140 | 45 |
| September, partial | 20 | 20 | 19 | 19 | 2 |
| Total | 509 | 508 | 508 | 507 | 125 |

The common sample has 245 support and 262 resistance encounters. There are
119 unresolved responses, retained in S/R-only and pulse-only comparisons.
The control pool has 164 fixed-grid observations away from every known level;
125 were matched without replacement using prior, already-complete windows,
completed-4h regime, 15m return, volatility and directional pulse class.

## Ranking: all eight predefined combinations

Percentages below are mean directional 4h markouts. Positive means the stated
hypothetical direction benefited, **not an improvement percentage over the
Martingale stack**. Abbreviations in later tables use the IDs shown here.

| ID | Observed condition at support/resistance | Direction | n | After 0.11% costs | After 0.20% costs | +1m entry, 0.20% costs |
|---|---|---|---:|---:|---:|---:|
| RB-buy | Resistance breaks, buying | Long | 20 | +0.533% | +0.443% | +0.523% |
| SH-sell | Support holds, selling | Long | 50 | +0.263% | +0.173% | +0.178% |
| RH-buy | Resistance holds, buying | Short | 46 | +0.028% | -0.062% | -0.048% |
| SB-sell | Support breaks, selling | Short | 22 | -0.124% | -0.214% | -0.196% |
| SH-buy | Support holds, buying | Long | 70 | -0.237% | -0.327% | -0.325% |
| RH-sell | Resistance holds, selling | Short | 84 | -0.518% | -0.608% | -0.620% |
| SB-buy | Support breaks, buying | Short | 1 | -2.297% | -2.387% | -2.400% |
| RB-sell | Resistance breaks, selling | Long | 0 | NA | NA | NA |

The one-observation SB-buy cell is uninformative, not evidence that this entire
mechanism is falsified. No RB-sell observations were found under these definitions.

### What each component contributes

S/R proximity alone averages -0.203% for support longs (n=245) and -0.373% for
resistance shorts (n=262) after 0.20% costs. Price-confirmed support holds average
-0.122% (n=159); price-confirmed resistance holds average -0.404% (n=172).
The complete price-only, pulse-only-at-S/R and unresolved tables are in
`cohorts.csv`.

The price-complement delta below compares a cell against **other pulse classes
with the same observed price response**, in the same direction. This avoids
comparing a subset against itself. Matched deltas compare the matched subset
against prior away-from-level controls; they do not represent all cell events.
Costs cancel in these equal-cost differences. Units are percentage points.

| ID | Price-complement delta | Matched n | Matched-control delta | Main reasons not advanced |
|---|---:|---:|---:|---|
| RB-buy | +1.741 | 6 | +2.117 | Thin cell/complement/halves/months; later-half price lift negative |
| SH-sell | +0.430 | 6 | +0.363 | Sparse controls; August price lift fails; both uncertainty bounds include zero |
| RH-buy | +0.466 | 14 | +0.548 | Negative cost-stressed mean; later-half matched lift negative; sparse controls |
| SB-sell | +0.163 | 4 | -0.924 | Thin sample; negative stressed mean; unstable price and matched lift |
| SH-buy | -0.367 | 18 | -1.198 | Negative mean/lifts; insufficient matched n; temporal instability |
| RH-sell | -0.399 | 22 | +0.414 | Negative mean/price lift; uncertainty bounds do not establish both effects |
| SB-buy | -2.217 | 0 | NA | n=1; no reliable inference |
| RB-sell | NA | 0 | NA | No observations |

RH-buy is the useful distinction between a relative signal and a trade: its
price-complement interval is nominally positive (+0.069 to +0.824pp), but its
own stressed markout is negative. Its matched interval is -0.623 to +1.714pp.
It cannot be called a profitable short or a validated ladder-exit improvement.

## Temporal stability

Split: July 12 00:00 UTC. All these dates have been explored previously; these
are development-data stability checks, **not untouched out-of-sample results**.

| ID | Earlier n | Earlier stressed mean | Later n | Later stressed mean |
|---|---:|---:|---:|---:|
| RB-buy | 15 | +0.602% | 5 | -0.033% |
| SH-sell | 19 | +0.944% | 31 | -0.299% |
| RH-buy | 20 | -0.028% | 26 | -0.089% |
| SB-sell | 17 | -0.175% | 5 | -0.346% |
| SH-buy | 28 | -0.119% | 42 | -0.466% |
| RH-sell | 45 | -0.650% | 39 | -0.559% |
| SB-buy | 1 | -2.387% | 0 | NA |
| RB-sell | 0 | NA | 0 | NA |

All eight per-month comparisons are below. Each cell is **price-complement
delta in pp (candidate n / complement n)**. The predeclared monthly gate only
evaluates populated comparisons with >=5 observations in both groups. NA means
no comparison, not zero effect. Full monthly markouts and matched deltas remain
in `monthly.csv`.

| ID | May | June | July | August | September |
|---|---|---|---|---|---|
| RB-buy | +3.308 (3/1) | +2.403 (9/6) | -0.054 (5/1) | NA (1/0) | -0.131 (2/1) |
| SH-sell | +1.146 (6/10) | +0.850 (12/26) | +0.112 (18/23) | -0.126 (13/44) | +2.237 (1/6) |
| RH-buy | +0.298 (4/12) | +0.593 (10/38) | +0.627 (16/39) | +0.008 (14/34) | +1.862 (2/3) |
| SB-sell | NA (5/0) | +1.099 (10/3) | +1.714 (4/1) | -2.577 (3/2) | NA (0/0) |
| SH-buy | -2.391 (5/11) | +0.139 (15/23) | -0.196 (14/27) | +0.019 (32/25) | -1.515 (4/3) |
| RH-sell | +0.208 (9/7) | -0.512 (26/22) | -0.607 (28/27) | -0.083 (19/29) | -2.095 (2/3) |
| SB-buy | NA (0/5) | -2.340 (1/12) | NA (0/5) | NA (0/5) | NA (0/0) |
| RB-sell | NA (0/4) | NA (0/15) | NA (0/6) | NA (0/1) | NA (0/3) |

The fixed advancement gate also requires sample/half/month counts, positive
cost-and-delay markouts, positive half-by-half price and matched lifts, and
positive lower bounds from 1,000 fixed seven-day-cluster resamples. No cell
passes. Intervals are nominal, not multiple-testing corrected; small-group
intervals do not rescue cells failing sample requirements. Matched controls
can have overlapping outcomes and residual cross-week dependence; matching is
not randomization or causal identification.

## Side observations, not additional selected strategies

- A post-run leave-one-seven-day-block-out diagnostic shows SH-sell's mean
  falls from +0.173% to -0.005% when the two encounters in the May 21-28 block
  are omitted. This reinforces concentration risk; those rows were not removed
  from the reported results.
- For RH-buy, response volume above the preceding 45m average yields +0.180%
  stressed markout, n=17, versus -0.204%, n=29, below that average. This is a
  descriptive modifier, not a ninth candidate or a validated volume threshold.
  SH-sell does not show the same volume ordering. Do not generalize this into
  "high-volume absorption works."
- Book observations are healthy, but three-snapshot persistent bid/ask subsets
  are mostly tiny. A healthy data stream does not guarantee enough qualifying
  setups. Observed depth is not evidence of identified cancellations or passive
  fill/queue behavior.
- Native versus USD-marked OI, source ages, net flow, absolute flow and Binance
  context are retained for audit. No extra OI/funding/Binance/HLP filter family
  was searched in this pass. This study has not exhausted every pulse avenue.

## Causality and baseline verification

The preceding [corrected baseline](codex-astra-candle-gap-recovery-findings-2026-09-05.md)
had already reproduced all four unchanged-policy cases twice, with 100% S/R
coverage and no retrospective fills. This runner verified its source/input
identity, repair hash and exact summary totals before labeling encounters:

| Previous baseline case | Verified total PnL |
|---|---:|
| Longer window, close-confirmed | $17,071.509682666387 |
| Longer window, resting-touch | $43,005.84535847749 |
| HL window, close-confirmed | $17,413.836235232710 |
| HL window, resting-touch | $21,983.766466309980 |

These are previously generated model totals, not fresh strategy variants or
exact live account returns. The full portfolio baseline was **not rerun this
pass** because no portfolio rule was introduced. Exact maker/live/funding parity
remains uncertified; candle repairs do not establish historical live receipt
times. The existing historical pulse latency model remains explicit.

Example traced through actual data, `support-1779128400000`:

1. At May 18 18:15 UTC, support $45.084333 was already confirmed with three
   touches; all touch confirmation timestamps precede that time. Close $45.35
   was outside the approach band.
2. The bar ending 18:20 reached the band: low $45.125, close $45.149. This starts
   the encounter; no action or favorable entry is backdated to it.
3. Closes at 18:30 ($45.154) and 18:35 ($45.221) both exceed the frozen support
   by 0.1%. Only at 18:35 is `hold` known. The as-of taker ratio is 0.406, with
   14 samples and latest source age 60s; flow is sell-dominant under the model.
4. Outcome accounting starts at the 18:35 one-minute open. Later prices do not
   select the level, response, flow class or matched control.

Checks passed:

- Encounter regression tests: frozen/previously known zones, delayed response,
  missingness, non-overlap, future-price mutation, full frame prefix invariance,
  one-minute-delay outcomes and outcome-blind historical matching.
- Real-data repeated encounter discovery and prefix comparison; labeling does
  not mutate features. Original inputs and source contents hash unchanged across
  the run; repaired archive has zero internal minute gaps.
- Self-review added failing-then-passing tests for inclusive floating-point
  boundaries and even-count median calculation. A visual check found the generic
  hourly plot could show a bar straddling D; the study adapter now omits that bar.
  No policy thresholds changed. Final feature, outcome, encounter CSV and control
  ledgers are byte-identical to the initial run; medians were corrected and the
  charts clarified. Rankings, means, matches and verdict did not change.
- Main and VPS TypeScript checks; candle-repair, current-stack and event-atlas
  regression suites passed. Research scripts also execute under ts-node's type
  checking; a production build alone would not verify these standalone scripts.

## Outputs, charts and reproduction

Accepted local output directory:
`backtests/hype/hype-sr-pulse-encounters-2026-09-05-final/`.

- [Chart gallery](../backtests/hype/hype-sr-pulse-encounters-2026-09-05-final/gallery/index.html):
  13 illustrations, first positive/nonpositive markout per populated cell, chosen
  **after** analysis. Not a representative sample or performance proof. Vertical
  T is decision D; pulse panels end at D. Plot EMAs are visual guides, not the
  completed-4h matching regime. Frozen levels need not have existed throughout
  the entire earlier chart window.
- `manifest.json`, `pre-outcome-audit.json`, `validation.json`: definitions,
  baseline identity, source/input hashes, coverage and causality checks.
- `encounter-features.jsonl`: predictor-only ledger written before outcomes;
  `encounter-outcomes.jsonl`: separate future labels.
- `encounters.csv`, `controls.jsonl`, `cohorts.csv`, `monthly.csv`,
  `context-modifiers.csv`, `summary.json`: complete observations and comparisons.

Final fingerprints:

| Artifact | SHA-256 |
|---|---|
| `manifest.json` | `1e62a7e08278f03387af8becccaccde02b05aa88a88eb08e14df47a8269d685c` |
| `summary.json` | `9e6b3a5111c45da46e5d177d7fda9be5da935ab043af0ee056359c4ef8e63c69` |
| `encounter-features.jsonl` | `115dd9b51d4852ce45f1fa1ceddda74a633d1908df85ba3d66d97ed345c3f6cd` |
| `encounter-outcomes.jsonl` | `319caa1dd1b90b04ea1d4d4bc402268ffcac4001970221a79ed3c491dfc86afe` |

Run instructions are in the method doc. Use a fresh output directory and the
same private input snapshot; the runner refuses existing output paths and
baseline identity drift. Prior initial/validated runs are retained locally,
not overwritten. Source, definition and findings are eligible for review in
Git; generated datasets/charts and market archives stay ignored.

**Conclusion:** no new live rule established. We now have a testable way to ask
whether observed price response to a frozen level adds information beyond
flow alone, with the weak and unstable cases visible rather than hidden in
pooled totals. The existing ladder's avoided losses, missed recoveries and
extra TP cycles cannot be quantified from these markouts, so this study neither
revalidates nor overturns its existing S/R actions.
