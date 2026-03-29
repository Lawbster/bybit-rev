# Claude Path Forward

## Goal
Build a Bybit API bot around automation-friendly edges. Use copied trader exports for inspiration and regime discovery, not for blind replication.

## Current Read
- The repo now has usable foundations:
  - multi-format trader export parsing
  - historical candle fetch
  - live WS collection
  - indicator generation
  - candle and WS replay backtests
- Recent progress is real:
  - orderbook handling was upgraded toward proper snapshot+delta local-book logic
  - raw `1m` candle persistence was added
  - multi-trader ingest is now possible

## Important Context
- `caleon` data came from a full copying window, so it is the cleanest current inspiration dataset.
- `aristo` was imported as a historical / restricted-output tool, so its trade output is not directly comparable to a full-copy export.
- Going forward, the goal is to gather traders under the same output standard so cross-trader analysis is consistent.

## What The Current Data Suggests
- Best immediate bot candidate is still:
  - low-cap, high-volatility exhaustion-reversal longs
  - 5m / 15m logic
  - strict risk controls
- `SIRENUSDT` and `PIPPINUSDT` remain the strongest current research symbols.
- Shorts should stay secondary for now.
  - They can work, but squeeze risk and regime dependence are too high.

## Condensed Concerns
1. Old WS JSONL data is contaminated by pre-fix orderbook handling.
   - Any OB-driven conclusions from older files should be treated as provisional.
2. WS replay is still weaker than candle replay.
   - It replays coarse periodic snapshots, not true intrabar microstructure evolution.
3. Backtest metrics are still ranking tools, not production-trustworthy risk stats.
   - Good for idea selection, not for trusting absolute Sharpe / Sortino values.
4. Research should not overfit to one trader or one short date range.
   - Group trades into ideas / clusters, not just raw row counts.

## Recommended Architecture
- Keep one unified core engine around a common bar shape.
- Keep separate adapters / runners:
  - candle adapter for long-history discovery
  - WS adapter for short-history enrichment
- Use WS features first as a confirmation layer on top of candle signals.
- Do not make WS-only strategy search the primary research loop yet.

## Practical Path Forward

### Phase 1: Clean Data Base
- Treat pre-fix OB data as legacy.
- Start a clean collection window for WS-based research.
- Keep saving raw `1m` candles.
- Keep collecting richer market snapshots.
- Unify all analysis scripts around the shared parsed trade dataset.

### Phase 2: Canonical Research Dataset
Build one aligned table per symbol / timestamp with:
- OHLCV
- indicators
- funding / OI
- orderbook / flow features
- future returns over `1m`, `5m`, `15m`, `30m`, `60m`

This should become the base layer for:
- trader pattern analysis
- event studies
- backtests
- feature selection

### Phase 3: Strategy Research Order
1. Discover setups on long candle history.
2. Shortlist only the strongest candle strategies.
3. Re-test those on the clean WS window with OB / flow gates.
4. Promote only stable filters into the live candidate.

## First Real Bot Direction
- Long-only first
- Low-cap exhaustion reversal
- High ATR / disorder / post-dump context
- Medium-trend reference and momentum stabilization
- Optional OB / flow confirmation only after enough clean WS history exists

## What Emil Should Gather
For each trader:
- consistent export format
- date range
- trade count
- symbol concentration
- hold-time style
- leverage style
- both good and bad periods

Best targets:
- traders with 60-90+ days visible
- enough trades to show repeatable behavior
- not only hot streaks

If possible, keep both:
- GUI export
- fill-level CSV / API export

## Near-Term Build Order
1. Continue collecting clean WS data after the OB fix.
2. Build the canonical research dataset.
3. Re-run `SIRENUSDT` and `PIPPINUSDT` studies on the clean base.
4. Build one long-only prototype.
5. Paper trade it.
6. Only then expand to shorting or broader multi-symbol execution.

## Short Version
- The repo is moving in the right direction.
- Candle history is still the primary discovery layer.
- WS should currently be a confirmation layer, not the main source of truth.
- The first serious live candidate should be a long-only low-cap reversal bot.
