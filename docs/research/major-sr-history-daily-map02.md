# MAP02 — full-history daily major S/R map

Separate 1D companion to the accepted MAP01 4H map. No live changes, trading
rules, parameter search or strategy executions. The 4H map and its pinned code
remain untouched. This is not an extension of the live 14-day intraday map.

## Frozen definition and source

Use the existing SRM01 daily observer, unchanged:

- UTC daily bars from complete, contiguous canonical minute candles.
- Three strict left/right bars per pivot. Confirmation is three daily closes
  after the pivot candle closes, or four days after its opening timestamp.
- Fixed first-pivot centre, +/-1% zone bounds; no running-mean movement.
- Two accepted pivots at least seven days apart to qualify a level.
- Two subsequent closed daily bars outside the bounds to confirm a role flip.
- 120-day active touch retention. Expired identities stay in the saved full
  historical register; this is **not** a 120-day output truncation.
- Missing minutes invalidate a daily candle. Gaps reset pivot/flip counters.
  Readiness requires 120 consecutive complete daily bars. Warm-up levels remain
  visible for inspection but cannot bypass the readiness flag.

Same canonical source and corrected-history repair as MAP01: first available
minute through **2026-09-15 20:20 UTC**. The final complete daily candle ends
**2026-09-15 00:00 UTC** (the September 14 candle). The partial first source day
and the unfinished September 15 day are excluded; no future daily high is used.

The source/availability distinction stays explicit: repaired exchange-history
bar closes, **not recorded historical network arrival**. Delay sensitivity is
supported by the cached reader; it does not reconstruct original receipt times.
Verify the archived collector byte-prefix and exclude every later appended
minute beyond the frozen cutoff. In-window edits or additions must fail.

Daily parameters are inherited, not selected from the number or appearance of
the levels. A sparse daily map is an output, not grounds to relax qualification.
Its widths and touch spacing differ from 4H, so this is a companion definition,
not a one-factor timeframe experiment or a claim that 1D is more profitable.

## Outputs and use

Same inspection contract as MAP01: offline `map.html`, readable `levels.md`,
`levels.csv`, `touches.csv`, `events.json`/`events.csv`, `role-intervals.csv`,
`summary.json` and the reusable full-history `map.json`.

Date/time in the register means **first usable qualification**, not an earlier
pivot date. Side is the qualification role; consult events, chart or as-of query
for subsequent flips. Full-register expiry and future touches are inspection
metadata, never historical decision inputs.

The versioned builder/renderer/verifier generalize the archived 4H reporting
code without modifying its source pins. They share the unchanged macro observer
and cached reader. The HTML readiness clock uses the map's timeframe, including
between midnight updates, rather than a hardcoded four-hour clock.

Load `loadHistoricalMajorMap(jobDir, key)` once from
`scripts/major-sr-history-map.ts`; share `.at(utcEpochMs[, lagMs])` across future
variants. The reader checks saved artifact hashes and returns only known state,
without loading candles or recomputing levels. Require `.healthy`. Queries past
the cutoff throw. A future extension receives a new immutable identity.

## Verification and commands

```powershell
npx ts-node scripts/major-sr-daily-history-tests.ts
npx ts-node scripts/major-sr-history-tests.ts
npx ts-node scripts/macro-sr-tests.ts
npx ts-node scripts/major-sr-history-study-v2.ts plan
npx ts-node scripts/major-sr-history-study-v2.ts run KEY
npx ts-node scripts/major-sr-history-verify-v2.ts KEY
npx ts-node scripts/major-sr-history-study-v2.ts query KEY 2026-09-15T20:20:00Z
```

Require exact equality to archived `1440m-events.json` and `1440m-final.json`.
Independently aggregate all minute-to-daily OHLC, check every frame, source pivot,
qualification/expiry/flip timing, five prefix/future-poison cuts, delay handling,
role intervals, register counts and offline HTML data/syntax. Synthetic daily
tests cover midpoint readiness, missing and unfinished days, seven-day touch
spacing, confirmation delays and return-state safety via the shared reader.

The archived 4H output must still verify unchanged. W/L, monthly PnL and profit
qualification are N/A: this is a saved data map, not an economic replay.
