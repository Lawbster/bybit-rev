# I10: VWAP location and relative-volume conditioning

Frozen September 6, 2026, before strategy outcomes. Research only.
[Card](../../research-inputs/indicators/vwap-volume-standalone-2026-09-06.json).
No live changes, ladder intervention, short unpause, combination, commit or push.

## Scope and formula contracts

Two separate questions, not VWAP+RVOL combinations:

1. Does location relative to scheduled daily/weekly VWAP favor continuation,
   fading an extension, or waiting for a reclaim?
2. Does unusually high volume improve following/fading a one-bar price change,
   versus the same price-direction rule WITHOUT a volume entry condition?

VWAP uses actual quote turnover/base volume for the UTC-day or Monday00:00
week prefix. Incomplete initial anchor gives null until a complete new anchor.
Distance is100*(close−VWAP)/VWAP. Entry crossings require the SAME anchor on
both bars; resetting the reference alone cannot generate an entry. Exits use
the current anchored VWAP even after a scheduled reset, not an entry-frozen
reference. An apparent reclaim is a metric crossing, not proof of support.

Bybit linear USDT candles supply base volume and quote turnover, allowing
actual traded-average calculations rather than HLC3×volume approximations.
[Bybit kline units](https://bybit-exchange.github.io/docs/v5/market/kline).
[TradingView VWAP anchors and percentage bands](https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/).
Our actual-turnover source differs from TradingView's default typical-price
proxy; this is not a claim of identical chart-platform VWAP.

Relative volume uses one completed bar's base volume divided by:
- mean of PRIOR20 completed bars; or
- mean of the same UTC-start slot on the PRIOR20 calendar days.

The latter is regular/noncumulative RVOL-at-time. No current sample in either
denominator; no missing-slot substitution or forming-bar estimate. Zero
denominator=null; genuine zero current volume with positive denominator=0.
[Relative volume at time](https://www.tradingview.com/support/solutions/43000705489-relative-volume-at-time/)
describes the time-offset approach; our complete-slot requirement is stricter
than its missing-slot fallback. Not time-of-week or cumulative RVOL.

Volume itself is unsigned. Direction here is current close minus prior close,
not candle open-to-close color, actual buy/sell pressure, investor flows or HL
taker classification. A tiny close change still counts; no hidden return floor.

## Frozen rules and exact counts

Five closed clocks:5m,15m,30m,1h,4h. Both sides.
Let v=position-side sign × signed VWAP distance and k>=0:

| Branch | Modes / levels | Definition slots |
|---|---|---:|
| Daily/weekly VWAP | trend:previous v<=k,current v>k; k0/0.5/1/2% | 160 |
| Daily/weekly VWAP | into:previous v>=−k,current v<−k; recovery:previous v<=−k,current v>−k; k0.5/1/2% | 240 |
| Rolling20/time20 RVOL | fresh prior<=k,current>k; k1.5/2/3, current close change aligned(follow) or opposed(fade) to position side | 240 |
| Plain price-direction controls | every aligned/opposed nonzero close change, no volume entry condition | 60 |

Two exits:
- fixed12h from actual fill; or
- first subsequent VWAP zero condition (trend signed<=0; into/recovery
  signed>=0), or selected RVOL<=1 for RVOL/plain controls; capped12h.

The fixed12h plain price control does not depend on RVOL reference, so it is
deduplicated:20 fixed controls +40 reference-specific RVOL-exit controls=60.
VWAP0% into/recovery duplicates are excluded. Four hourly daily VWAP
trend0% side/exit definitions repeat I01; retained for exact ledger parity.

**640 strategy slots +60 price controls =700 slots,696 new /4 repeated**.
Two windows ×two delays =2,560 strategy cases +240 price-control cases +
eight repeated clock cases =**2,808 cases**. Exact saved parity before
outcomes:4 repeated VWAP +2 clock definitions ×four cases=**24 cases**.
Accepted distinct standalone definitions through I10:2,664+696=3,360;
not3,360 independent hypotheses or live configurations.

Fresh volume crossing and price direction must coincide. A wrong-direction
spike expires; no later catch-up. Occupied/pending signals are skipped, never
queued. Plain controls are deliberately recurring price opportunities,
whereas RVOL rules filter them for fresh volume spikes. Their difference
includes both volume threshold and freshness, not an isolated causal effect
of raw volume size. Every RVOL case/month retains its own plain control.
Optional exits retain their own fixed12h control. Controls are not discoveries.

## Data, timing and comparison

Same fingerprinted I01 snapshot/explicit11-minute repair; fixed June1,2025
seed;663,541 minutes, no gaps. Read-only volume audit found4 genuine
zero-volume minutes and no out-of-range turnover/volume prices at1e−5 tolerance.

Full: **2025-07-01 00:00 →2026-09-04 19:01 UTC**.
Recent: **2026-05-17 20:43 →same cutoff**, overlapping, previously mined.
$10k fixed entry/$32k initial equity, one independent position; no compounding
or averaging. Fees0.055% each side actual notional; **before funding**.
Extra5bps/side on unchanged turnover including cutoff closing mark.
Baseline same-side rolling12h clock, not exposure matched and NOT the ladder.

Only completed contiguous timeframe bars; signal at bar end, minute-open
execution under modeled zero publication lag. Separate+1m delays BOTH entry
and exit. No execution-minute H/L/C decisions. Pending decisions immutable;
timeout wins ties, no reuse of the entry observation for an indicator exit.
Monthlies marked with inventory/fees when incurred; cutoff open inventory is
not a completed trade. DD uses prior close-equity peak versus minute adverse
price; no intraminute path ordering, liquidation/shared-margin certification.

Strict inherited screen:>=30 full/10 recent closes both delays; positive net
and own-clock delta allfour; every monthly marked delta>=−1e−8; positive
extra-cost net; solvent. Plain controls cannot qualify as new strategies.
Descriptive sample/net/cost/solvency subset is NOT a relaxed deployment gate.
Report overall/per-branch topfive by full immediate net, raw topfive by clock
delta, own unfiltered-price deltas and own-exit deltas. A profitable RVOL rule
is not evidence volume adds value unless its own price control is considered.

## Verification and reproduction

New pure feature module; tests compare independent anchored slices/weighted
turnover and prior exact-slot means. Daily VWAP/prior20 RVOL match the shared
math exactly. Hand seeds, partial anchors, Monday/midnight resets, zero
volume, scale/volume-unit invariants, price-range unit checks, all700 entry
boundaries, exits/fees/delay/occupancy, original VWAP/clock ledgers and causal
prefixes must pass before outcomes.

Runner checks24 saved/new/old ledgers, stats, marks and monthlies BEFORE
writing outcomes;15 actual feature prefixes and700 strategy/control prefixes.
Independent checker imports no feature/signal engine: it independently
aggregates OHLCV, computes anchored slices/prior-slot ratios, enumerates all
eligible and occupied entries/first exits, reconstructs full-minute DD and
monthly accounting, checks own controls/rankings/trace provenance and hashes.
Require completed validation AND independent verification, not just results.

```bash
npx ts-node scripts/vwap-volume-standalone-tests.ts
node --max-old-space-size=8192 -r ts-node/register scripts/hype-vwap-volume-standalone-study.ts
node --max-old-space-size=16384 -r ts-node/register scripts/vwap-volume-standalone-results-check.ts backtests/hype/hype-vwap-volume-standalone-2026-09-06
npx ts-node scripts/vwap-volume-standalone-path-check.ts backtests/hype/hype-vwap-volume-standalone-2026-09-06
```

Optional runner `--out backtests/NEW_DIRECTORY`; refuses overwrite.
Pinned read-only path supplement covers topfive overall/per-branch/raw and
their plain/fixed controls. No additional strategy simulation or exits.
Generated artifacts remain local/ignored; source/card/docs allowlisted,
not committed automatically.

## Deliberately pending

OBV, MFI, CMF; cumulative or time-of-week RVOL; other lookbacks/levels,
low-volume/persistent-state conditions; causal damage/swing/event anchors,
previous-session VWAP reclaims, statistical VWAP bands; indicator/HL/S/R
combinations; ladder/shared-account applications; funding, actual historical
receipt timing, queue/slippage/liquidation. This is a bounded VWAP/RVOL pass,
not completion of the entire volume-indicator family.



## Accepted result: September6,2026

[Findings / all700 slots,baseline W/L,own-control attribution and monthly tables](../../research/codex-astra-vwap-volume-standalone-findings-2026-09-06.md).

- All2,808 cases,2,171,455 overlapping trade records and28,080 monthly rows independently verified.
- 24 exact prior saved cases,15 feature/700 strategy prefixes;all input/source/artifact pins unchanged.
- 43 descriptive survivors:18 VWAP longs,23 RVOL longs,2 RVOL short exits;zero strict.
- 620 strategy slots adequately sampled,20 sparse;18 equity-exhausted diagnostics.
  Plain controls separate:30 of60 exhaust equity in at least one diagnostic.
- Pinned read-only path supplement48 cases;additional Q1/Q2 short ledger-path inspections4 cases.
- No rule retuned after outcomes,no prior outputs overwritten,no live/config/state changes.

The2.13GB trade ledger is audited in memory;the actual verifier command uses16GiB
heap (runner8GiB). This is local research,not a job for the production VPS.
OBV/MFI/CMF and combinations remain pending.
