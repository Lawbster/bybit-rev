# MAP01 — full canonical-history major S/R map

Research data infrastructure, not a strategy or the live local 14-day map.

## Scope and source

Use the complete canonical HYPE minute archive from its first available candle
through the existing replay cutoff **2026-09-15 20:20 UTC**. This includes all
warm-up before the July 2025 published economic window. No 14-day truncation.
The final complete 4H candle ends at 20:00 UTC. The next incomplete 4H candle
does not enter level construction.

Reuse the unchanged SRM01 macro observer and require exact event/final-state
parity to its saved, independently verified artifacts. Existing support-failure
strategy studies remain separate; their rejection is not a reason to discard
the underlying historical map. No new profit test is part of MAP01.

The source is **corrected exchange history**, using the same validated repair
bundle and archive/collector precedence as canonical replays. Availability is
modeled at closed-bar end. This is not proof of original live receipt latency;
querying with 60s lag is a sensitivity, not reconstructed transport evidence.

Latest sync appended collector minutes after the archived cutoff. The builder
requires the archived byte-prefix hash to match exactly and every appended
candle to end after the unchanged cutoff. It records this append-only proof;
historical edits or in-window additions fail rather than changing the map.

## Frozen major-level definition

- 4H completed candles; three strict left and three right bars per swing.
- Pivot known at the end of the third right bar: 16h after pivot-bar start.
- Fixed first-pivot centre and +/-0.75% bounds; never move a zone to future means.
- At least two accepted pivot touches, spaced at least 24h, before qualification.
- Merge to nearest eligible fixed zone, with older-origin tie break.
- Two subsequent completed closes beyond the bounds confirm a role flip.
- A later zone intersection closing above its upper bound logs a held support
  retest. This event is descriptive, not a guarantee that support will hold.
- Active evidence retention is 120d. A qualified zone retires when fewer than
  two retained touches remain. **Retirement never removes it from the archive.**
- Missing source minutes invalidate an entire 4H bar. Gaps reset pivot and
  breakout counters. Replay readiness requires 120d of continuous closed bars;
  warm-up levels are visible for inspection but must not bypass this flag.

4H reuses a validated, substantially less dense major-structure definition.
It is a sensible fixed starting point, not a profit-optimized timeframe.
Daily, alternate widths, new gates, partials and strategy tuning are out of scope.

## Persistent outputs

- `map.json`: full time-indexed map; complete OHLC, per-4H as-of states, fixed
  zone catalogue, role intervals and all accepted touches of qualified zones.
- `levels.md` / `levels.csv`: **one row per qualified level identity**, including
  retired levels. Date/time is first usable qualification, not seed pivot time.
- `events.json` / `events.csv`: qualification, role flips, held retests, expiry.
- `touches.csv`: constituent pivot evidence, kept separate from the level list.
- `role-intervals.csv`: known role intervals; never extend a final role backward.
- `map.html`: self-contained full-history chart, time cursor and clickable register.
- `summary.json`: coverage, monthly counts and archived-map parity, not PnL.

The immutable job key fingerprints sources, parameters, code and runtime.
Repeated identical builds are refused by the existing workflow. A new source
cutoff or definition receives a new identity; accepted artifacts stay untouched.

## Reader for subsequent replays

```ts
import { loadHistoricalMajorMap } from './major-sr-history-map';
const levels = loadHistoricalMajorMap(`backtests/research-workflow/${key}`, key);
// Load ONCE, share across variants. This does not load candles or rebuild maps.
const known = levels.at(decisionUtcEpochMs); // or at(decisionUtcEpochMs, 60_000)
// Any future strategy must require known.healthy, in addition to its own gates.
```

The reader returns only geometry and state known at the requested time. It
does not expose future retirement dates, future touch lists or final roles.
Queries beyond the frozen cutoff throw. Missing latest closed bars fail readiness;
they are not silently filled forward as healthy. Catalogue/CSV future metadata
is for manual investigation only, never strategy predicates.

No existing replay or live engine is modified to consume these levels yet.
Future experiments should import this cached reader instead of rebuilding the map.

## Commands and checks

```powershell
npx ts-node scripts/major-sr-history-tests.ts
npx ts-node scripts/macro-sr-tests.ts
npx ts-node scripts/major-sr-history-study.ts plan
npx ts-node scripts/major-sr-history-study.ts run KEY
npx ts-node scripts/major-sr-history-verify.ts KEY
npx ts-node scripts/major-sr-history-study.ts query KEY 2026-09-15T20:00:00Z
```

The verifier checks every cached frame against forward observer state, exact
archived event/final parity, independent minute-to-4H OHLC and strict pivot
evidence, qualification/flip/expiry clocks, source-prefix/future-poison checks,
reader lag, role intervals, table row counts and offline chart syntax/data.
Synthetic tests cover corruption rejection and returned-state mutation isolation.
Economic baseline/W-L/monthly screens are N/A: zero strategy executions.
