import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  buildAtlasFeatures,
  buildShapeVector,
  generateEventAtlas,
  loadAtlasCandles,
  parseAtlasEventTime,
  shapeDistance,
} from "../src/research/event-atlas";
import type { AtlasCandle, EventAtlasManifest } from "../src/research/event-atlas-types";

const MINUTE = 60_000;

function candles(count = 1600, start = Date.parse("2026-01-01T00:00:00Z")): AtlasCandle[] {
  const rows: AtlasCandle[] = [];
  let last = 100;
  for (let i = 0; i < count; i++) {
    const drift = Math.sin(i / 31) * 0.08 + Math.cos(i / 79) * 0.04 + 0.006;
    const open = last;
    const close = open + drift;
    rows.push({
      timestamp: start + i * 5 * MINUTE,
      open,
      high: Math.max(open, close) + 0.05,
      low: Math.min(open, close) - 0.05,
      close,
      volume: 1000 + (i % 17) * 10,
    });
    last = close;
  }
  return rows;
}

function manifest(eventTs: number): EventAtlasManifest {
  return {
    version: 1,
    id: "generic-test",
    symbol: "TESTUSD",
    candleSource: {
      path: "candles.jsonl",
      intervalMinutes: 5,
      fields: { timestamp: "time", open: "openPrice", high: "highPrice", low: "lowPrice", close: "closePrice", volume: "size" },
    },
    events: [{ at: new Date(eventTs).toISOString(), label: "Test event" }],
    chart: { beforeHours: 24, afterHours: 12, primaryIntervalMinutes: 30, secondaryIntervalMinutes: 240 },
    similarity: { enabled: true, candidateIntervalMinutes: 60, lookbackHours: 12, vectorPoints: 16, neighboursPerEvent: 2, exclusionHours: 12, neighbourSeparationHours: 12 },
    srMemory: { enabled: false },
  };
}

async function main(): Promise<void> {
  assert.equal(
    parseAtlasEventTime("2026-06-02 02:00", 120),
    Date.parse("2026-06-02T00:00:00.000Z"),
    "offset-free timestamps must use the declared fixed offset",
  );
  assert.equal(
    parseAtlasEventTime("2026-06-02T02:00:00+02:00"),
    Date.parse("2026-06-02T00:00:00.000Z"),
    "explicit offsets must be respected",
  );
  assert.throws(() => parseAtlasEventTime("2026-06-02 02:00"), /no UTC offset/);

  const source = candles();
  const decisionTs = source[1000].timestamp;
  const config = manifest(decisionTs);
  const baseline = buildAtlasFeatures(source, decisionTs, 5, config).features;
  const mutated = source.map(candle => ({ ...candle }));
  const firstFuture = mutated.findIndex(candle => candle.timestamp >= decisionTs);
  mutated[firstFuture] = { ...mutated[firstFuture], open: 1000, high: 1200, low: 1, close: 1100 };
  const changed = buildAtlasFeatures(mutated, decisionTs, 5, config).features;
  for (const key of ["price", "return4hPct", "return12hPct", "return24hPct", "return72hPct", "ema50_4h", "ema200_4h", "ema200DistPct", "realizedVol24hPct", "range24hPct"] as const) {
    assert.equal(changed[key], baseline[key], `${key} must not change when data at/after T changes`);
  }
  assert.notEqual(changed.forwardLow12hPct, baseline.forwardLow12hPct, "future outcomes should reflect post-T mutations");

  const beforeVector = buildShapeVector(source, decisionTs, 30, 12, 16)!;
  const afterVector = buildShapeVector(mutated, decisionTs, 30, 12, 16)!;
  assert.equal(shapeDistance(beforeVector, afterVector), 0, "similarity vectors must not use candles at/after T");

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "event-atlas-"));
  try {
    const candlePath = path.join(temp, "candles.jsonl");
    const rows = source.map(candle => JSON.stringify({
      time: candle.timestamp,
      openPrice: candle.open,
      highPrice: candle.high,
      lowPrice: candle.low,
      closePrice: candle.close,
      size: candle.volume,
    }));
    rows.push(rows[rows.length - 1]);
    fs.writeFileSync(candlePath, `${rows.join("\n")}\n`, "utf8");
    const manifestPath = path.join(temp, "manifest.json");
    fs.writeFileSync(manifestPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    const loaded = await loadAtlasCandles(config, temp);
    assert.equal(loaded.candles.length, source.length);
    assert.equal(loaded.duplicateRows, 1);
    assert.equal(loaded.conflictingRows, 0);
    assert.equal(loaded.invalidRows, 0);

    fs.writeFileSync(path.join(temp, "candles.json"), JSON.stringify(source), "utf8");
    const jsonConfig: EventAtlasManifest = {
      ...config,
      candleSource: { path: "candles.json", format: "json", intervalMinutes: 5 },
    };
    const jsonLoaded = await loadAtlasCandles(jsonConfig, temp);
    assert.equal(jsonLoaded.candles.length, source.length, "JSON candle arrays with common field names must remain pair-agnostic");

    const result = await generateEventAtlas("manifest.json", temp);
    assert.equal(result.events.length, 1);
    assert.equal(result.neighbours.length, 2);
    assert(Math.abs(result.neighbours[0].timestamp - result.neighbours[1].timestamp) >= 12 * 60 * MINUTE, "matched controls must come from separated episodes");
    assert(fs.existsSync(path.join(result.outputDir, "index.html")));
    assert(fs.existsSync(path.join(result.outputDir, "event-ledger.csv")));
    assert(fs.existsSync(path.join(result.outputDir, "nearest-neighbours.csv")));
    assert(fs.existsSync(path.join(result.outputDir, "integrity.json")));
    const svgPath = path.join(result.outputDir, "events", `${result.events[0].id}.svg`);
    const svg = fs.readFileSync(svgPath, "utf8");
    assert(svg.includes("future outcome"));
    assert(svg.includes("Test event"));
    assert(svg.includes("EMA200"));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  console.log("event atlas tests passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
