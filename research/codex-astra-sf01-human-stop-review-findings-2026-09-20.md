# SF01 HYPE: human stop review and entry/invalidation hypotheses

2026-09-20. Descriptive audit only. No new strategy replay or live changes.

## TL;DR

- The user's 72 unique annotations match 72 of the **73 stop exits** in the accepted range-SFP/2R/24h path. Categories: 46 recovery/weak-entry, 24 useful stops, two better-entry-then-downtrend. They are valuable research labels, not entry-time information.
- Recovery exists: **21/73** stopped trades later touch their original TP within 24h of entry; **43/73** within 72h; **55/73** within seven days. This is target-touch reach, not executable profits with a revised stop or occupancy model.
- Entry and invalidation merit separate tests. Simply demanding a cheaper range-low entry also discards winners: only **16/43 existing winning trades** revisit the known range low before their original exit. Wider stops expose material extra downside, not just negligible wick noise.

## Provenance and exact baseline

[Accepted HYPE study](codex-astra-range-low-sfp-findings-2026-09-20.md) /
[preserved human annotations](../research-inputs/range-low-sfp-human-stop-review-2026-09-20.json).
Study `e7d639d6a63f0678a3cf016f274d9ca98cbccb8853b8c10de8b87c82b5bfbc6b`.
Range-qualified longs, original 2R target, 24h cap, 60s modeled source publication,
zero extra action delay, stop-first, standard fees. Dec27 2024 to Sep15 2026
20:20 UTC, $10k notional. **43 wins / 79 losses**, +$18,124 winning dollars,
-$15,449 losing dollars, **+$2,690 including open MTM / 7.92% DD**.
Losses include timeout losses; stop exits number 73, not 79. 35 target exits
and 14 timeouts complete the 122 closed trades.

The missing annotated stop is
`SF01:long:pivot:14400000:low:1749772800000:37.262`, entry Jun19 2025
12:01 UTC, net -$147.60. All 72 supplied IDs also match stops in the generic
24h control, so the alignment is not inferred merely from a screenshot.

## Recovery audit

Use each saved executed trade's **original absolute target**, not a newly reduced
target. Scan the sealed minute tape starting in the minute after its actual stop
minute. Horizons are from original entry, not from the stop. Exclude the stop
minute because the order of its high/low is unknown. No data beyond the accepted
Sep15 cutoff. A target touch is not a limit-fill guarantee.

| Entry-based horizon | Observed later target touches / all 73 stops | Complete follow-up cases | Hits among complete cases |
|---|---:|---:|---:|
| 24 hours | 21 / 73 | 72 | 21 / 72 |
| 72 hours | 43 / 73 | 72 | 43 / 72 |
| Seven days | 55 / 73 | 71 | 54 / 71 |

At seven days one incomplete-follow-up case already hit its target; the other is
unresolved. Do not classify right-censored cases as permanent non-recoveries.
For the user's 46 recovery/weak-entry labels: 18 hit within24h, 35 within72h,
40 within7d. Different visual horizons or a hypothetical lower entry/target can
explain label differences; the human labels did not specify an exact target clock.

Among the 43 observed recoveries by72h, median adverse excursion from original
entry is about **3.50%**, or **2.11 times original entry-to-stop distance**;
90th-percentile excursion about7.39%. Excursions include full OHLC of the first
target-touch minute, so they are conservative bounds, not exact tick sequences.
One user-labeled recovery entered Nov30 2025 08:01 UTC, fell about14.17% below
entry before later reaching target at69.1h. Its original stop risk was about1.82%.
That is a genuine recovery, but not an inexpensive one to hold through.

## Entry and stop observations

| Measurement | Winners (43) | Losers (79) |
|---|---:|---:|
| Median entry above known range low | 0.843% | 0.935% |
| Median entry position within frozen range | 6.657% | 6.434% |
| Median entry-to-stop risk | 2.193% | 1.865% |
| Range-low retest by original exit | 16 | 77 |

The 16 winner retests all occur in strictly earlier minutes than the original
exit. These are path observations, not fills for a new limit-order strategy.
An unconditional retest requirement would tend to lose many clean bounces while
retaining falling trades. A lower buy price is not automatically a better selection.
Median range position is similar across wins/losses; a simple 'upper part of range'
filter is not established by this sample. Conditional timing may still help.

42/73 stop-containing 4h candles subsequently close above the original stop;
23/73 close above the known range low. Neither number is 'stops saved': further
bars can fail, delayed exits can be worse, and a candle-close policy changes
occupancy. The existing stop is already 0.1% below the full sweep-to-reclaim
extreme, **not** a 0.1%-from-entry stop.

## Proposed next tests, not implemented

Keep the exact accepted control visible and separate mechanisms before combining.

1. **Finer entry confirmation:** retain range anchors published on4h, but detect
   the sweep/reclaim on completed15m bars and enter at the next available minute.
   This can avoid waiting until the4h bounce has already advanced. Never use the
   eventual4h reclaim to authorize an earlier15m entry. It will also admit false
   starts the4h version rejects; those belong in its full replay.
2. **Retest-and-hold entry:** after the current4h signal, require a later retest
   of its frozen low and a completed15m reclaim before entering. Set a finite
   expiry (one4h bar is a proposed starting convention), invalidate on the old
   stop, one attempt per parent. No retrospective wick fills. Retest alone is
   insufficient; count skipped winners, expired signals and occupied periods.
3. **Confirmed invalidation versus wick stop:** unchanged entry, test a closed1h
   structural break instead of the first stop touch, with a predeclared deeper
   hard emergency stop. Execute after publication, not at the historical close.
   Do not remove the protective cap or choose it from these future troughs.

For first entry comparisons, keep the already-known absolute target/structural
stop where defined, rather than quietly lowering TP to manufacture a win-rate
gain. Treat recalculated2R as a separate target variant. Finer confirmation uses
its own causally known sweep extreme; document that bracket difference explicitly.
Report fixed-$10k results and risk per trade, monthly deltas, missed winners,
larger failures, time occupied and stress; repeated stop/re-entry cycles must
not be treated as independent free retries. Do not combine variants until their
individual effect is measured. No strategy is approved by this reach audit.

## Verification and limitations

Read saved study/scan/replay artifacts and verified SHA receipts; verified sealed
`candles.f64` and schema. Reused `loadTape` and `parseCsv`, no map rebuild or new
signals/trades. Future candles appear only as explicitly retrospective labels.
No parameter fitting or new economic PnL claimed. These reviewed histories are
development data; subsequent tuning on the annotations is not out-of-sample.
