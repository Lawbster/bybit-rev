# RP01: large rallies, subsequent pullbacks and prospective cooldowns

Frozen September 15, 2026, before new outcomes. Local descriptive analysis.

## Question and prior evidence

Does a large HYPE rally create a reproducible elevated pullback-risk interval
that might justify blocking fresh entries/adds? This is not AG10-C1, which
shortened waits after an actual high exit and lost money across both periods.
P01 found that hindsight tops often still had buying pressure; weak HL selling
was not a universal advance warning. L17 retained the high exit after testing
its removal. Do not conflate these with a new rally-triggered cooldown.

## Universe and point-in-time triggers

Use the same corrected minute candles, July 1, 2025 to September 14, 2026
15:27 UTC, seeded from the archive's first complete four-hour candle.
Report full, pre-HL, HL-recent and previous published-window views. Full and
published/recent views overlap; pre-HL/recent partition the full sample.
Periods are previously examined, not untouched holdouts.

Every completed UTC 4h boundary is a reference. Ten impulse definitions:
first crossing of +6% or +10% close-to-close return over 4/12/24/48/72h,
observed on that grid. Minimum 72h between accepted signals within a rule,
initialized before study start. Crossings during the reserved interval are
discarded, not deferred. Rules overlap each other and are not independent.
These are rolling returns, not a claim that 12/48/72h forming bars are known.
Repeat observation at bar-end+60s using the same completed source bar.

Reference contexts: closed4h RSI14, CRSI, ADX14, relative volume versus prior20,
prior ATR14, EMA200/EMA50 slope regime, current body/upper wick/close location,
momentum change, distance to trailing48h high. Fixed features, no optimization.
Nine prespecified flags: RSI>=70, CRSI>=90, ADX>=25, rvol>=2,
upper wick>=35% of range, close in lower half of range, slowing4h return,
within1% of48h high, and below previous4h low. These are descriptive cuts,
not nine approved filters. Nulls excluded with known-denominator controls.

## Labels, controls and avoided-upside accounting

Minute paths AFTER decision only; anchor next-minute open at the decision
time. Compute closes, minima/maxima and 2/5/10% downside at4/8/12/24/48/72h.
Track first +2% versus -2%, retaining same-minute ambiguity. Also measure
peak-to-subsequent-low pullback using only a prior minute's high; do not invent
same-minute high/low ordering. A 5% retracement AFTER another20% rise is not
a 5% loss below the original decision price.

Report broad4h references and month/ATR-bucket standardized references
(prior4h ATR/price: <1%,1-2%,>=2%). This partially controls for volatility and
calendar; not causal identification or a guarantee against confounding.
Show counts, risk rates, Wilson intervals for descriptive uncertainty, medians,
monthly counts/rates and early/recent stability. Intervals are not adjusted
for overlapping grid outcomes or repeated testing. No significance promotion.

For4/8/12/24h fixed waits, compare later opening price, missed interim upside
and risk during the NEXT24h from that later decision. Count cheaper/dearer
entries on identical complete pairs. These are price diagnostics, NOT trades,
portfolio PnL or a rule to buy automatically when the timer expires.

On the predeclared +6%/24h anchor only, separately inspect first subsequent
red4h and first2% closed-bar giveback from the running post-signal high,
within12h. Reset outcome clock at confirmation; never claim the decline
before confirmation was predicted. Compare with all anchor episodes observed
at the same4/8/12h offset, weighted by flagged timing. Subsequent24h risk only.

Overlay cooldown intervals descriptively on archived unchanged Agg10 add
decisions. Show touched winning/losing episodes and adds blocked versus
already-gated/no-add intervals, without adding whole-episode PnL as savings.
Read and verify exact archived metrics/digests. No changed portfolio replay;
no new net/DD improvement is calculated. Baseline dollars remain reference.

## Outputs and limits

Frozen inputs, all trigger/context rows and future labels in separate files,
family/reference summaries, monthly tables, delay and confirmation diagnostics,
archived-add intersections, and visual charts of selected drops AND continued
rallies. Chart selections may use outcomes and are labelled hindsight examples.
No future-labelled variable enters the trigger/confirmation functions.

Independent source-prefix fixtures and brute-force minute-label verification;
hash inputs, protected live/canonical files and accepted artifacts before/after.
No new data fetching, trading, state/config edits, commits or deployment.
No exact optimal timeframe or consistent loss-prevention claim from this atlas;
those require a later frozen portfolio replay including missed winning cycles.
