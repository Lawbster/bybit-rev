# Pair-agnostic visual event atlas

The event atlas converts manually labelled chart events into reproducible visual and quantitative research. It is research-only: it imports no executor, places no orders, and changes no live configuration.

The first manifest contains the 26 HYPE local tops labelled in UTC+2:

```bash
npm run event-atlas -- \
  --manifest research-inputs/event-atlas/hype-local-tops-2026-08-14.json
```

Open:

```text
backtests/event-atlas/hype-local-tops-2026-08-14/index.html
```

Run the deterministic regression suite with:

```bash
npm run test:event-atlas
```

## What it produces

- One self-contained SVG per labelled event.
- A 30m chart, a 4h regime chart, volume, EMA50/EMA200, and causal S/R zones.
- A hard visual boundary at decision time `T`; the right side is shaded and labelled as future outcome.
- Optional metric panels populated from recorded telemetry.
- Optional trade/action markers.
- Shape-matched unlabelled controls, separated in time to avoid four copies of the same episode.
- `event-ledger.csv` containing causal features and separately named future outcomes.
- `nearest-neighbours.csv` for true-positive/false-positive comparison.
- `integrity.json` recording coverage, identical/conflicting duplicates, invalid rows, gaps, and the causal contract. Conflicting duplicates retain the highest-volume version of a candle.

The HYPE panels deliberately use exact metrics already written by the live S/R shadow. They do not rebuild a parallel HL taker or order-book window that might disagree with the live decision context.

## Causal boundary

For an event at `T`:

- Price, returns, EMA values, volatility, S/R zones, metric panels and similarity vectors on the left side use only observations completed at or before `T`.
- A source candle stamped at `T` belongs to the future/outcome side.
- S/R pivots retain production confirmation delay through `SRMemoryZoneEngine`.
- Forward lows, highs and closes are output labels only. They never participate in similarity distance.
- Offset-free event timestamps are rejected unless the manifest declares `eventTimeZoneOffsetMinutes`.

## Reusing it for another pair or dataset

Copy the HYPE manifest and change `id`, `symbol`, `candleSource`, and `events`. Paths may use `{symbol}`. JSON arrays and JSONL streams are supported; field names are mapped explicitly or inferred from common OHLC aliases.

Minimal example:

```json
{
  "version": 1,
  "id": "btc-failed-breakouts",
  "symbol": "BTCUSDT",
  "eventTimeZoneOffsetMinutes": 120,
  "candleSource": {
    "path": "data/{symbol}_1m.jsonl",
    "intervalMinutes": 1,
    "fields": {
      "timestamp": "ts",
      "open": "o",
      "high": "h",
      "low": "l",
      "close": "c",
      "volume": "v"
    }
  },
  "events": [
    { "at": "2026-08-01 14:00", "label": "Failed breakout", "tags": ["local-top"] }
  ],
  "chart": {
    "beforeHours": 168,
    "afterHours": 24,
    "primaryIntervalMinutes": 30,
    "secondaryIntervalMinutes": 240
  },
  "similarity": {
    "enabled": true,
    "candidateIntervalMinutes": 240,
    "lookbackHours": 72,
    "vectorPoints": 32,
    "neighboursPerEvent": 4,
    "exclusionHours": 48,
    "neighbourSeparationHours": 48
  },
  "srMemory": {
    "enabled": true,
    "tfMin": 30,
    "pivotLeft": 4,
    "pivotRight": 4,
    "clusterPct": 0.0045,
    "minTouches": 2,
    "bufferPct": 1,
    "recentDays": 14
  }
}
```

For a JSON candle array using long field names, point `candleSource.path` at the file and either omit `fields` or map `timestamp/open/high/low/close/volume` explicitly.

## Optional panels

Panels accept any JSON/JSONL stream with a timestamp and one or more numeric dot-paths:

```json
{
  "id": "open-interest",
  "label": "Open interest",
  "path": "data/{symbol}_telemetry.jsonl",
  "timestampField": "timestamp",
  "bucketMinutes": 30,
  "series": [
    { "label": "OI 4h %", "valueField": "pulse.oi4hPct" }
  ],
  "referenceLines": [{ "value": 0, "label": "flat" }]
}
```

Optional sources fail soft and render as empty panels. The primary candle source is mandatory.

## Recommended research workflow

1. Add human-identified events with a short label and uncertainty tag where appropriate.
2. Generate the atlas and visually compare labelled events with matched controls.
3. Write the visual mechanism in plain language before converting it into numbers.
4. Add the proposed numeric feature to a causal ledger or replay.
5. Validate against every eligible timestamp, per-month stability, and an untouched forward period.
6. Use the atlas for hypothesis generation—not as permission to change live configuration.
