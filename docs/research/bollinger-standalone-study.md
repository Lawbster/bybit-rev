# I07: Bollinger standalone study

Research only. The user delegated the next step after MACD. We chose the
next documented complementary family before combinations or a new ladder
application: distinguish **relative price location / dispersion** from the
momentum families already studied. I01–I06 and L07 were checked for duplicates.
No standalone Bollinger definitions in that inventory; legacy band calculations
and old mixed-signal research are not validation of this new contract.

This does not authorize a live change, new ladder veto, indicator combination,
HL/S/R mixture, portfolio overlay, commit or push.

## Frozen card and meanings

[Card](../../research-inputs/indicators/bollinger-standalone-2026-09-06.json):
5m/15m/30m/1h/4h ×20/50 closes ×2/3 SD ×3 entry meanings ×2 sides ×2 exits
= **240 new definitions**, plus8 prior clock-control cases, **968 cases** total.
No rule is added after outcomes.

[John Bollinger's primary rules](https://www.bollingerbands.com/bollinger-band-rules)
describe20/2 as a starting reference and explicitly distinguish a band tag
from an automatic reversal signal. Our50/2,20/3,50/3 are sensitivity choices,
not a claim they are his recommended equal-containment settings or that
financial prices obey normal-distribution confidence intervals.

### Exact math

- On each **completed** bar, current-inclusive arithmetic mean of the lastN
  closes, population SD `sqrt(sum((close-mean)^2)/N)`, not sampleN-1.
- Upper/lower=mean±K×SD; percentB=(close-lower)/(upper-lower), a fraction
  with0 at lower/1 at upper, not a0..100 oscillator.
- BandwidthPct=100×(upper-lower)/mean; closeMinusMiddle=close-mean.
  Width is recorded/validated, **not used as a squeeze filter** in this card.
- FirstN-1 values missing; contiguous UTC bars required, no gap interpolation
  or changing seed. Exact zeroSD means zero width and missing percentB, hence
  no crossing; a valid zero closeMinusMiddle can still trigger a midpoint exit.
- Two-pass centered variance, no sum-of-squares cancellation, no rounding.
  Negative lower bands are mathematically allowed; actual prices remain positive.
- Independent fixtures compare pairwise variance and the installed indicator
  library, population denominator, constant/linear/affine cases and prefixes.
  New contract does not certify the live legacy forming-bar feature bundle.

| Mode | Long entry | Short entry |
|---|---|---|
| breakout | Previous percentB<=1, current>1 | Previous>=0, current<0 |
| into | Previous>0, current<=0 | Previous<1, current>=1 |
| reclaim | Previous<=0, current>0 | Previous>=1, current<1 |

Both observations use their own completed, current-inclusive bands. Reclaim
does not mean price necessarily rose/fell: the boundary can move. A regression
explicitly constructs a long reclaim while closes continue falling. No
unstated price confirmation or future pivot. No intrabar touch entry.

Exits: fixed12h from actual fill, or earliest **subsequent** closed midpoint
condition capped at12h. Breakout long exits close<=middle, short>=middle;
into/reclaim long exits close>=middle, short<=middle. The midpoint moves, so
normalization is not a price TP or break-even guarantee. Timeout wins ties.
Entry-time observations cannot exit; pending exits are immutable.

Not tested: other lengths/widths, EMA bands, squeezes/width percentiles,
expansion/persistence, intrabar/native-limit fills, price stops/targets/trailing,
Donchian/Keltner, other indicators, HL/S/R, new ladder/portfolio behavior.
A negative result will not reject those untested uses by association.

## Dates, costs and controls

- Full: **2025-07-01 00:00 →2026-09-04 19:01 UTC**.
- Recent: **2026-05-17 20:43 →same cutoff**, overlapping, not a holdout.
- Initialization: fixed2025-06-01. Same I01 fingerprinted minute archive and
  explicit11-minute repair overlay; raw archive unchanged.
- $10k fixed entry notional, $32k initial equity, one independent position
  per rule. No averaging/compounding.
- 0.055% fee each side on actual executed notional. **Before funding**:
  complete settlement archive unavailable.
- Closed timeframe decision; next-minute-open execution under modeled zero
  publication lag, plus separate+1m to every entry AND exit.
- Occupied/pending crossings skipped, not queued. End inventory marked with
  hypothetical closing fee, not counted as a completed trade.
- Same-side rolling12h clocks, not exposure-matched; own-entry/fixed12h
  companions for midpoint exits; cash and fixed-initial-quantity buy/hold context.
  **These are not incremental ladder dollars.**
- Extra5bps/side same-path stress. Not funding, real queue/slippage paths,
  historical data-arrival proof, liquidation, margin or shared-collateral safety.

Already-mined development history and correlated definitions must remain
explicit. Eight clock cases must reproduce old I01 engine and accepted saved
complete ledgers/stats/months/open before new outcomes.

## Screens, reporting and verification

Unchanged strict screen:>=30full/10recent closes bothdelays, positive absolute
net and own-clock delta allfour, every monthly marked delta>=-1e-8, positive
extra-cost net, no equity exhaustion. Separate descriptive sample/net/cost/
solvency subset ranked by full immediate absolute net; topfive (or actual
smaller count) if any, rawtopfive otherwise. Not a relaxed deployment gate.

Report baselines beside W/L counts, winning/losing dollars, open mark, net/DD;
full and recent separately; bothdelays/cost stress, own-exit baselines,
monthly topfive and rawtopfive comparisons, paths/concentration and all240 IDs.
Retain sparse/inconclusive and failed definitions. Post-equity-exhaustion
fixed-notional ledgers are diagnostic only, not an executable account path.

Primary checks60 actual-data feature prefixes and240 strategy prefixes.
Independent verifier imports only the canonical candle/repair loader, not
feature/strategy/closed-bar code. It directly aggregates closes and reconstructs
window statistics, every eligible/occupied signal, earliest exit, exact prices,
fees, open marks, minute drawdowns and monthly boundaries, rankings and traces.
Read-only path supplement checks both selected topfive and rawtopfive plus
clocks, excluding exit-minute extremes. All source/input/artifact pins rechecked.

## Reproduce locally, not on the VPS

```bash
npx ts-node scripts/bollinger-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-bollinger-standalone-study.ts
node --max-old-space-size=8192 -r ts-node/register scripts/bollinger-standalone-results-check.ts backtests/hype/hype-bollinger-standalone-2026-09-06
npx ts-node scripts/bollinger-standalone-path-check.ts backtests/hype/hype-bollinger-standalone-2026-09-06
```

Runner supports `--out backtests/NEW_DIRECTORY`, refuses overwrite. Require
completed validation.json AND independent verification.json. Source/card/
findings may be reviewed for Git; generated artifacts remain local. Do not
repeat a sweep just to improve its result after new inputs or source changes.

## Accepted result and next boundary

[Findings / all240 ranked IDs and monthly baselines](../../research/codex-astra-bollinger-standalone-findings-2026-09-06.md):
**968 cases,174,379 overlapping trade records,9,680 monthly records** passed
independent verification. Eight prior clock cases are exact; source/input/
artifact pins and read-only path checks pass. Descriptive subset25 long/2
short, zero complete strict-screen qualifiers. Dip/reclaim profits retain
crash exposure; the narrow short is materially delay-sensitive.

Only `backtests/hype/hype-bollinger-standalone-2026-09-06/` is accepted.
The separate `-aborted-checker-typecheck/` directory is incomplete development
output, preserved but excluded. A compile-only mixed-null/numeric Map type
annotation was fixed in the checker before the fresh accepted run; no grid
or threshold changes followed the initial output.

B1's extra read-only path breakdown selected another existing verified ID
(`bollinger_30m_n20_k3_breakout_long_indicator_or12h`) without changing
accepted source files or adding a strategy. Its metrics are in the findings;
the standard path command selects topfive/rawtopfive/clocks.

Next complementary individual card: ADX/DMI. Donchian/Keltner and Bollinger
squeezes remain untested; no combinations or new ladder study in this pass.
