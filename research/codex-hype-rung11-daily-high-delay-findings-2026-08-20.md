# HYPE rung-11 daily-high delay findings — 2026-08-20

## TL;DR

- Tested **72 causal rung-11 delay variants** against the current long stack through `2026-08-19 21:32 UTC`: UTC-session high vs rolling 24h high, 0.25%-3% proximity rules, timer-only vs all-add blocking, and exact arm-near-high/wait-for-deeper-drop hysteresis. The one-year baseline reproduced the selected damaged-regime replay exactly: **$82,912.67**, 1,035 closes, 36 hard flattens, 3 emergency kills.
- **Nothing passes the deployment gate.** The best headline result is rolling-24h/within-2%/timer-only at **+$794.32**, below the $1k minimum, with six negative months (worst **-$778.92**) and **no reduction** in hard flattens, emergency kills, or worst close. The exact user-proposed shape—arm very near the high, then wait for a deeper drop—tops out at only **+$358.46** across 19 affected episodes and has six negative months.
- The upside-cost concern is real. Broad 3% rules that block every rung-11 add lose **-$20,177 to -$23,406** and worsen drawdown. The current rung-11 behavior should remain unchanged. At most, `rolling_24h_within_2pct_time_only` is a forward-shadow candidate; it is not live-action evidence.

## Verdict

**NO LIVE CONFIG CHANGE.**

The hypothesis is mechanically reasonable but does not improve the tail outcome it is meant to address. Narrow variants are mostly noise; broad variants tax recoveries and pump continuations heavily.

## Scope and baseline parity

Script: `scripts/hype-rung11-daily-high-delay-audit.ts`

Outputs: `backtests/hype/rung11-daily-high-delay-2026-08-20/`

- `summary.csv`: every variant across one-year, full-HL, recent-60d, and recent-30d windows.
- `monthly.csv`: realized monthly PnL and delta versus the current baseline.
- `events.csv`: first delayed rung-11 decision per affected episode and its eventual outcome.

Current-stack baseline includes:

- $800 base, 1.35 add scale, 11 rungs;
- current 12h/-2% hostile hard flatten, emergency kill, funding guard, trend/risk/regime gates;
- current S/R partial exit and support-reopen execution;
- selected persistent damaged-regime latch, including its causal intervals through the current data end;
- current timer and price-drop add behavior and fees.

| Baseline, one year | Result |
|---|---:|
| Window | 2025-07-01 through 2026-08-19 21:32 UTC |
| Total PnL | **$82,912.67** |
| Closes / TP cycles | 1,035 / 974 |
| Hard flattens / emergency kills | 36 / 3 |
| Rung-11 closes | 429 |
| Worst close | -$8,475.40 |
| Max drawdown | 22.10% |

This matches the refreshed `ladder_lock_deep4_hl_sell_release_2x4h_inside1` row in the current-regime audit exactly: `$82,912.67`, 1,035 closes, 36 hard flattens, 22.10% max drawdown. Baseline divergence is zero.

## Rules tested

### Same-threshold wait

When rung 11 would otherwise be submitted, block while the completed-minute close remains within X% of:

- the high observed so far in the current UTC day; or
- the rolling high over the preceding 24 hours.

Thresholds: `0.25, 0.5, 0.75, 1, 1.5, 2, 3%`.

Modes:

- `all`: timer and true price-drop adds are delayed;
- `time_only`: timer adds are delayed, but the existing true price-drop add passes.

### Exact arm-then-drop wait

This is the closest match to the proposed mechanism:

1. Arm only if rung 11 becomes due within `0.25, 0.5, or 0.75%` of the known high.
2. Keep rung 11 pending until price is `0.75, 1, 1.5, or 2%` below the continually updated known high.
3. Test both `all` and `time_only` behavior.

If the ladder reaches TP before the pullback, rung 11 is never added. State never carries into the next ladder episode.

## No-lookahead audit

- Every decision is made at a completed 1m boundary.
- UTC-day and rolling-24h highs include only the current or earlier completed 1m candles.
- A new high updates the release anchor only after that minute completes.
- Existing engine gates and exits use the same causal series as the parity-validated replay.

Trace: at the `2026-06-25 04:54 UTC` rolling-24h delay, the decision close was `$63.576`. The known high was `$64.294`, printed by the candle completed at `2026-06-24 23:24 UTC`. The lookback contained exactly 1,440 completed bars from the prior 24 hours; no candle after `04:54 UTC` contributed.

## One-year ranking

| Rank | Variant | Delta | Affected episodes | Rung-11 closes | Hard flats | Max DD |
|---:|---|---:|---:|---:|---:|---:|
| 1 | rolling 24h, within 2%, timer-only | **+$794.32** | 86 | 407 | 36 | 21.05% |
| 2 | UTC day, within 0.5%, timer-only | +$411.23 | 28 | 422 | 36 | 21.32% |
| 3 | UTC day, arm 0.25% / drop 0.75%, all adds | +$358.46 | 19 | 422 | 36 | 21.22% |
| 4 | UTC day, within 0.5%, all adds | +$227.68 | 34 | 421 | 36 | 21.32% |
| 5 | rolling 24h, arm 0.25% / drop 1.5%, timer-only | +$210.15 | 9 | 424 | 36 | 21.27% |

No variant reaches +$1,000. None of the top variants reduces the 36 hard flattens, 3 emergency kills, or -$8,475.40 worst close.

The only positive variants with zero negative months are rolling-24h/within-0.25% controls at **+$56.63** and **+$32.40**, affecting only 7 and 6 episodes. Those are economically negligible.

## Exact user-shape result

The best exact arm-near-high/wait-for-deeper-drop rule is:

`r11_utc_day_arm_0p25pct_drop_0p75pct_all`

| Window | Baseline | Variant | Delta | Affected episodes | Hard flats |
|---|---:|---:|---:|---:|---:|
| One year | $82,912.67 | $83,271.13 | **+$358.46** | 19 | 36 -> 36 |
| Full HL era | $25,636.23 | $25,351.97 | **-$284.26** | 1 | 8 -> 8 |
| Recent 60d | -$1,582.85 | -$1,582.85 | $0.00 | 0 | 7 -> 7 |
| Recent 30d | $1,171.63 | $1,171.63 | $0.00 | 0 | 0 -> 0 |

The one HL-era occurrence armed at `2026-06-06 00:04 UTC`, then the 10-rung ladder reached TP one minute later. Delaying rung 11 reduced the profit captured on that recovery; it did not avoid a loss. The positive one-year headline is entirely older path interaction and does not replicate in the latest regime.

## Current-regime read

The weak top row, rolling-24h/within-2%/timer-only, is more permissive than the exact proposal because true price-drop adds bypass it.

| Window | Delta | Affected episodes | Hard flats | Recent read |
|---|---:|---:|---:|---|
| Full HL era | +$622.63 | 8 | 8 -> 8 | Positive but small |
| Recent 60d | +$619.97 | 7 | 7 -> 7 | Same small cluster |
| Recent 30d | $0.00 | 0 | 0 -> 0 | No evidence |

The seven recent-60d delays occurred from June 25 through July 15, before the durable damaged-regime latch dominated entry eligibility. Three affected ladders closed before rung 11, but the July 7 hard-flatten episode still reached rung 11 and still hard-flattened. The candidate changes cycling and basis; it does not solve cascade exposure.

## Monthly stability — top five

Values are delta versus the current baseline.

| Month | Roll24 2% timer | UTC 0.5% timer | UTC arm .25/drop .75 all | UTC 0.5% all | Roll arm .25/drop 1.5 timer |
|---|---:|---:|---:|---:|---:|
| 2025-07 | -$56.87 | +$323.73 | +$396.88 | +$323.73 | +$532.78 |
| 2025-08 | +$56.58 | +$43.03 | $0.00 | +$43.03 | $0.00 |
| 2025-09 | +$1,589.87 | +$609.27 | +$609.27 | +$609.27 | $0.00 |
| 2025-10 | -$488.08 | -$168.82 | -$168.82 | -$168.82 | -$168.82 |
| 2025-11 | +$258.03 | $0.00 | $0.00 | $0.00 | $0.00 |
| 2025-12 | -$149.10 | $0.00 | $0.00 | $0.00 | $0.00 |
| 2026-01 | +$365.00 | +$291.69 | -$38.45 | +$291.69 | $0.00 |
| 2026-02 | $0.00 | $0.00 | -$207.38 | -$207.38 | $0.00 |
| 2026-03 | -$193.16 | $0.00 | -$366.37 | +$24.24 | $0.00 |
| 2026-04 | -$431.65 | +$320.27 | +$770.41 | +$320.27 | $0.00 |
| 2026-05 | -$778.92 | -$723.70 | -$352.83 | -$724.11 | -$153.81 |
| 2026-06 | +$307.43 | -$284.26 | -$284.26 | -$284.26 | $0.00 |
| 2026-07 | +$315.21 | $0.00 | $0.00 | $0.00 | $0.00 |
| 2026-08 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 |

The rank-one result is dominated by September 2025 and gives back meaningful PnL in October, April, and May. This is not cross-regime stability.

## Pump-day and recovery cost

The user’s concern that this may hurt upside is confirmed:

| Broad rule | One-year delta | Max DD | Worst close |
|---|---:|---:|---:|
| Rolling 24h, within 3%, block all | **-$20,177.23** | 24.25% | -$11,696.79 |
| UTC day, within 3%, block all | **-$23,406.32** | 24.50% | -$11,696.79 |

Rung 11 is not only extra crash exposure. On recoveries it materially lowers the average entry and supplies the largest notional rung. Blocking it too broadly can prevent or delay the TP that ends the episode, creating worse later paths. The invisible benefit of the current behavior is therefore substantial even though the added notional is visually uncomfortable near a high.

## Deployment gate

| Criterion | Result |
|---|---|
| Net delta >= $1,000 | **Fail** — best +$794; exact shape +$358 |
| No materially worse month | **Fail** — best row has six negative months, worst -$779 |
| Mechanism explainable | Pass — delays timer creep, but does not prevent tail exits |
| No lookahead | Pass |

No candidate passes the required four-part standard.

## Recommendation

Keep the current rung-11 logic unchanged. Do not add a live daily-high delay.

If this idea is revisited, the only defensible continuation is an alert-only forward shadow of the timer-only rolling-24h 2% row. The exact arm-near-high/deeper-drop proposal is falsified on present history: too little net benefit, negative latest-HL evidence, and no tail-event reduction.

## Reproduction

PowerShell:

```powershell
npx.cmd ts-node scripts/hype-current-regime-60d-audit.ts
npx.cmd ts-node scripts/hype-rung11-daily-high-delay-audit.ts
npx.cmd tsc --noEmit --pretty false
```
