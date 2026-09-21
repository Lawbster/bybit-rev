import fs from "fs";
import path from "path";
import readline from "readline";
import { SRMemoryZoneEngine, DEFAULT_SR_MEMORY_ZONE_CONFIG } from "../bot/sr-memory-zones";
import { renderAtlasEventSvg, renderAtlasIndexHtml, renderNeighbourSvg } from "./event-atlas-render";
import type {
  AtlasCandle,
  AtlasEventFeatures,
  AtlasFileFormat,
  AtlasIntegrity,
  AtlasMarker,
  AtlasNeighbour,
  AtlasPanelData,
  AtlasZoneSnapshot,
  EventAtlasManifest,
  ResolvedAtlasEvent,
} from "./event-atlas-types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type JsonRow = Record<string, unknown>;

export interface CandleLoadResult {
  candles: AtlasCandle[];
  invalidRows: number;
  duplicateRows: number;
  conflictingRows: number;
  largestGapMinutes: number;
  resolvedPath: string;
}

export interface GeneratedEventAtlas {
  outputDir: string;
  manifest: EventAtlasManifest;
  events: ResolvedAtlasEvent[];
  features: Map<string, AtlasEventFeatures>;
  neighbours: AtlasNeighbour[];
  integrity: AtlasIntegrity;
}

function isRecord(value: unknown): value is JsonRow {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function getPathValue(row: unknown, field: string): unknown {
  let value: unknown = row;
  for (const key of field.split(".")) {
    if (!isRecord(value)) return undefined;
    value = value[key];
  }
  return value;
}

export function timestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function expandSourcePath(root: string, sourcePath: string, symbol: string): string {
  return path.resolve(root, sourcePath.replace(/\{symbol\}/gi, symbol));
}

function inferFormat(filePath: string, configured: AtlasFileFormat = "auto"): Exclude<AtlasFileFormat, "auto"> {
  if (configured !== "auto") return configured;
  return filePath.toLowerCase().endsWith(".jsonl") ? "jsonl" : "json";
}

async function forEachRow(
  filePath: string,
  format: AtlasFileFormat,
  callback: (row: JsonRow) => void,
): Promise<void> {
  const resolvedFormat = inferFormat(filePath, format);
  if (resolvedFormat === "json") {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.rows) ? parsed.rows : [];
    for (const row of rows) if (isRecord(row)) callback(row);
    return;
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) continue;
    const parsed: unknown = JSON.parse(line);
    if (isRecord(parsed)) callback(parsed);
  }
}

function firstDefined(row: JsonRow, fields: string[]): unknown {
  for (const field of fields) {
    const value = getPathValue(row, field);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export async function loadAtlasCandles(
  manifest: EventAtlasManifest,
  root = process.cwd(),
): Promise<CandleLoadResult> {
  const source = manifest.candleSource;
  const filePath = expandSourcePath(root, source.path, manifest.symbol);
  if (!fs.existsSync(filePath)) throw new Error(`Candle source not found: ${filePath}`);
  const fields = {
    timestamp: source.fields?.timestamp,
    open: source.fields?.open,
    high: source.fields?.high,
    low: source.fields?.low,
    close: source.fields?.close,
    volume: source.fields?.volume,
  };
  const byTimestamp = new Map<number, AtlasCandle>();
  let invalidRows = 0;
  let duplicateRows = 0;
  let conflictingRows = 0;

  await forEachRow(filePath, source.format ?? "auto", row => {
    const ts = timestampMs(fields.timestamp ? getPathValue(row, fields.timestamp) : firstDefined(row, ["timestamp", "ts", "startTime", "time"]));
    const open = numberValue(fields.open ? getPathValue(row, fields.open) : firstDefined(row, ["open", "o"]));
    const high = numberValue(fields.high ? getPathValue(row, fields.high) : firstDefined(row, ["high", "h"]));
    const low = numberValue(fields.low ? getPathValue(row, fields.low) : firstDefined(row, ["low", "l"]));
    const close = numberValue(fields.close ? getPathValue(row, fields.close) : firstDefined(row, ["close", "c"]));
    const volume = numberValue(fields.volume ? getPathValue(row, fields.volume) : firstDefined(row, ["volume", "v"])) ?? 0;
    if (ts === null || open === null || high === null || low === null || close === null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || high < low) {
      invalidRows++;
      return;
    }
    const candidate = { timestamp: ts, open, high, low, close, volume };
    const prior = byTimestamp.get(ts);
    if (prior) {
      duplicateRows++;
      if (prior.open !== open || prior.high !== high || prior.low !== low || prior.close !== close || prior.volume !== volume) conflictingRows++;
      if (volume >= prior.volume) byTimestamp.set(ts, candidate);
    } else {
      byTimestamp.set(ts, candidate);
    }
  });

  const candles = [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (!candles.length) throw new Error(`No valid candles found in ${filePath}`);
  let largestGapMinutes = 0;
  for (let i = 1; i < candles.length; i++) {
    largestGapMinutes = Math.max(largestGapMinutes, (candles[i].timestamp - candles[i - 1].timestamp) / MINUTE);
  }
  return { candles, invalidRows, duplicateRows, conflictingRows, largestGapMinutes, resolvedPath: filePath };
}

export function aggregateAtlasCandles(candles: AtlasCandle[], intervalMinutes: number): AtlasCandle[] {
  const intervalMs = intervalMinutes * MINUTE;
  const result: AtlasCandle[] = [];
  let current: AtlasCandle | null = null;
  for (const candle of candles) {
    const bucket = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    if (!current || current.timestamp !== bucket) {
      current = { timestamp: bucket, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume };
      result.push(current);
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume;
    }
  }
  return result;
}

function hasExplicitOffset(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

export function parseAtlasEventTime(value: string | number, fallbackOffsetMinutes?: number): number {
  if (typeof value === "number") {
    const parsed = timestampMs(value);
    if (parsed === null) throw new Error(`Invalid numeric event timestamp: ${value}`);
    return parsed;
  }
  if (hasExplicitOffset(value)) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error(`Invalid event timestamp: ${value}`);
    return parsed;
  }
  if (fallbackOffsetMinutes === undefined) {
    throw new Error(`Event timestamp has no UTC offset: ${value}. Set eventTimeZoneOffsetMinutes or include Z/+HH:MM.`);
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match) throw new Error(`Unsupported offset-free event timestamp: ${value}`);
  const [, year, month, day, hour, minute, second = "0", millis = "0"] = match;
  const utcLike = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +(millis.padEnd(3, "0")));
  return utcLike - fallbackOffsetMinutes * MINUTE;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "event";
}

export function resolveAtlasEvents(manifest: EventAtlasManifest): ResolvedAtlasEvent[] {
  const seen = new Set<string>();
  return manifest.events.map((input, index) => {
    const timestamp = parseAtlasEventTime(input.at, manifest.eventTimeZoneOffsetMinutes);
    const baseId = input.id ? slug(input.id) : slug(`${new Date(timestamp).toISOString()}-${index + 1}`);
    let id = baseId;
    let suffix = 2;
    while (seen.has(id)) id = `${baseId}-${suffix++}`;
    seen.add(id);
    return {
      id,
      timestamp,
      inputAt: input.at,
      label: input.label ?? `Event ${index + 1}`,
      tags: input.tags ?? [],
      ...(input.note ? { note: input.note } : {}),
    };
  }).sort((a, b) => a.timestamp - b.timestamp);
}

function upperBound(candles: AtlasCandle[], timestamp: number): number {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (candles[mid].timestamp <= timestamp) low = mid + 1;
    else high = mid;
  }
  return low;
}

function lastCompletedIndex(candles: AtlasCandle[], decisionTs: number, intervalMinutes: number): number {
  return upperBound(candles, decisionTs - intervalMinutes * MINUTE) - 1;
}

function closeAsOf(candles: AtlasCandle[], timestamp: number, intervalMinutes: number): number | null {
  const index = lastCompletedIndex(candles, timestamp, intervalMinutes);
  return index >= 0 ? candles[index].close : null;
}

function pct(current: number | null, previous: number | null): number | null {
  return current === null || previous === null || previous === 0 ? null : (current / previous - 1) * 100;
}

function emaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) current = alpha * values[i] + (1 - alpha) * current;
  return current;
}

function std(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function forwardOutcome(
  candles: AtlasCandle[],
  decisionTs: number,
  hours: number,
  basePrice: number,
): { low: number | null; high: number | null; close: number | null } {
  const end = decisionTs + hours * HOUR;
  const window = candles.filter(candle => candle.timestamp >= decisionTs && candle.timestamp < end);
  if (!window.length) return { low: null, high: null, close: null };
  return {
    low: (Math.min(...window.map(candle => candle.low)) / basePrice - 1) * 100,
    high: (Math.max(...window.map(candle => candle.high)) / basePrice - 1) * 100,
    close: (window[window.length - 1].close / basePrice - 1) * 100,
  };
}

function buildZoneSnapshot(
  candles: AtlasCandle[],
  decisionTs: number,
  price: number,
  sourceIntervalMinutes: number,
  manifest: EventAtlasManifest,
): { zones: AtlasZoneSnapshot[]; resistance: number | null; support: number | null; resistanceDist: number | null; supportDist: number | null } {
  if (!manifest.srMemory?.enabled) return { zones: [], resistance: null, support: null, resistanceDist: null, supportDist: null };
  const config = { ...DEFAULT_SR_MEMORY_ZONE_CONFIG, ...manifest.srMemory, enabled: true };
  const engine = new SRMemoryZoneEngine(config);
  const completed = candles
    .filter(candle => candle.timestamp + sourceIntervalMinutes * MINUTE <= decisionTs)
    .map(candle => ({ ...candle, turnover: 0 }));
  engine.rebuild(completed, decisionTs);
  const zones: AtlasZoneSnapshot[] = engine.getZones(decisionTs).map(zone => ({
    price: zone.price,
    touches: zone.touches,
    highTouches: zone.highTouches,
    lowTouches: zone.lowTouches,
    confirmTs: Math.max(...zone.touchData.map(touch => touch.ts)),
    side: zone.price > price ? "resistance" : zone.price < price ? "support" : "mixed",
  }));
  const resistance = engine.nearestResistance(decisionTs, price);
  const support = engine.nearestSupport(decisionTs, price);
  return {
    zones,
    resistance: resistance?.lv.price ?? null,
    support: support?.lv.price ?? null,
    resistanceDist: resistance ? resistance.dist * 100 : null,
    supportDist: support ? support.dist * 100 : null,
  };
}

export function buildAtlasFeatures(
  candles: AtlasCandle[],
  decisionTs: number,
  sourceIntervalMinutes: number,
  manifest: EventAtlasManifest,
): { features: AtlasEventFeatures; zones: AtlasZoneSnapshot[] } {
  const price = closeAsOf(candles, decisionTs, sourceIntervalMinutes);
  if (price === null) throw new Error(`No completed candle before ${new Date(decisionTs).toISOString()}`);
  const closeAt = (hours: number) => closeAsOf(candles, decisionTs - hours * HOUR, sourceIntervalMinutes);
  const fourHour = aggregateAtlasCandles(candles, 240).filter(candle => candle.timestamp + 240 * MINUTE <= decisionTs);
  const ema50 = emaLast(fourHour.map(candle => candle.close), 50);
  const ema200 = emaLast(fourHour.map(candle => candle.close), 200);
  const recent24 = candles.filter(candle => candle.timestamp + sourceIntervalMinutes * MINUTE <= decisionTs && candle.timestamp >= decisionTs - 24 * HOUR);
  const logReturns = recent24.slice(1).map((candle, index) => Math.log(candle.close / recent24[index].close));
  const realizedVol = std(logReturns);
  const range24 = recent24.length ? (Math.max(...recent24.map(candle => candle.high)) / Math.min(...recent24.map(candle => candle.low)) - 1) * 100 : null;
  const outcome12 = forwardOutcome(candles, decisionTs, 12, price);
  const outcome24 = forwardOutcome(candles, decisionTs, 24, price);
  const zone = buildZoneSnapshot(candles, decisionTs, price, sourceIntervalMinutes, manifest);
  return {
    zones: zone.zones,
    features: {
      timestamp: decisionTs,
      price,
      return4hPct: pct(price, closeAt(4)),
      return12hPct: pct(price, closeAt(12)),
      return24hPct: pct(price, closeAt(24)),
      return72hPct: pct(price, closeAt(72)),
      ema50_4h: ema50,
      ema200_4h: ema200,
      ema200DistPct: pct(price, ema200),
      realizedVol24hPct: realizedVol === null ? null : realizedVol * Math.sqrt(Math.max(1, recent24.length)) * 100,
      range24hPct: range24,
      nearestResistance: zone.resistance,
      resistanceDistPct: zone.resistanceDist,
      nearestSupport: zone.support,
      supportDistPct: zone.supportDist,
      forwardLow12hPct: outcome12.low,
      forwardHigh12hPct: outcome12.high,
      forwardClose12hPct: outcome12.close,
      forwardLow24hPct: outcome24.low,
      forwardHigh24hPct: outcome24.high,
      forwardClose24hPct: outcome24.close,
    },
  };
}

export function buildShapeVector(
  candles: AtlasCandle[],
  decisionTs: number,
  intervalMinutes: number,
  lookbackHours: number,
  points: number,
): number[] | null {
  const aggregated = aggregateAtlasCandles(candles, intervalMinutes);
  const completed = aggregated.filter(candle => candle.timestamp + intervalMinutes * MINUTE <= decisionTs && candle.timestamp >= decisionTs - lookbackHours * HOUR);
  if (completed.length < Math.max(8, points / 2)) return null;
  const sampled: number[] = [];
  for (let i = 0; i < points; i++) {
    const index = Math.round((i / Math.max(1, points - 1)) * (completed.length - 1));
    sampled.push(completed[index].close);
  }
  const anchor = sampled[sampled.length - 1];
  if (!(anchor > 0)) return null;
  return sampled.map(value => Math.log(value / anchor));
}

export function shapeDistance(left: number[], right: number[]): number {
  if (left.length !== right.length || !left.length) return Infinity;
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length);
}

function findNeighbours(
  candles: AtlasCandle[],
  manifest: EventAtlasManifest,
  events: ResolvedAtlasEvent[],
): AtlasNeighbour[] {
  const config = manifest.similarity;
  if (!config?.enabled) return [];
  const vectorPoints = config.vectorPoints ?? 32;
  const eventVectors = new Map<string, number[]>();
  for (const event of events) {
    const vector = buildShapeVector(candles, event.timestamp, manifest.chart.primaryIntervalMinutes, config.lookbackHours, vectorPoints);
    if (vector) eventVectors.set(event.id, vector);
  }
  const candidates = aggregateAtlasCandles(candles, config.candidateIntervalMinutes)
    .map(candle => candle.timestamp)
    .filter(timestamp => timestamp >= candles[0].timestamp + config.lookbackHours * HOUR)
    .filter(timestamp => timestamp + manifest.chart.afterHours * HOUR <= candles[candles.length - 1].timestamp)
    .filter(timestamp => events.every(event => Math.abs(timestamp - event.timestamp) > config.exclusionHours * HOUR));
  const candidateVectors = candidates.map(timestamp => ({
    timestamp,
    vector: buildShapeVector(candles, timestamp, manifest.chart.primaryIntervalMinutes, config.lookbackHours, vectorPoints),
  })).filter((candidate): candidate is { timestamp: number; vector: number[] } => candidate.vector !== null);

  const neighbours: AtlasNeighbour[] = [];
  for (const event of events) {
    const vector = eventVectors.get(event.id);
    if (!vector) continue;
    const ranked = candidateVectors
      .map(candidate => ({ ...candidate, distance: shapeDistance(vector, candidate.vector) }))
      .sort((a, b) => a.distance - b.distance);
    const selected: typeof ranked = [];
    const separationMs = (config.neighbourSeparationHours ?? config.candidateIntervalMinutes / 60) * HOUR;
    for (const candidate of ranked) {
      if (selected.some(prior => Math.abs(prior.timestamp - candidate.timestamp) < separationMs)) continue;
      selected.push(candidate);
      if (selected.length >= config.neighboursPerEvent) break;
    }
    selected.forEach((candidate, index) => {
      neighbours.push({
        eventId: event.id,
        rank: index + 1,
        timestamp: candidate.timestamp,
        distance: candidate.distance,
        features: buildAtlasFeatures(candles, candidate.timestamp, manifest.candleSource.intervalMinutes, manifest).features,
      });
    });
  }
  return neighbours;
}

async function loadPanels(
  manifest: EventAtlasManifest,
  root: string,
  minTs: number,
  maxTs: number,
): Promise<AtlasPanelData[]> {
  const panels: AtlasPanelData[] = [];
  for (const config of manifest.panels ?? []) {
    const filePath = expandSourcePath(root, config.path, manifest.symbol);
    if (!fs.existsSync(filePath)) {
      panels.push({ config, points: [] });
      continue;
    }
    const buckets = new Map<number, { sourceTs: number; values: Array<number | null> }>();
    const bucketMs = (config.bucketMinutes ?? manifest.chart.primaryIntervalMinutes) * MINUTE;
    await forEachRow(filePath, config.format ?? "auto", row => {
      const timestamp = timestampMs(getPathValue(row, config.timestampField ?? "timestamp"));
      if (timestamp === null || timestamp < minTs || timestamp > maxTs) return;
      const values = config.series.map(series => numberValue(getPathValue(row, series.valueField)));
      if (values.every(value => value === null)) return;
      const bucket = Math.floor(timestamp / bucketMs) * bucketMs;
      const prior = buckets.get(bucket);
      if (!prior || timestamp >= prior.sourceTs) buckets.set(bucket, { sourceTs: timestamp, values });
    });
    panels.push({
      config,
      points: [...buckets.entries()].map(([timestamp, value]) => ({ timestamp, values: value.values })).sort((a, b) => a.timestamp - b.timestamp),
    });
  }
  return panels;
}

async function loadMarkers(
  manifest: EventAtlasManifest,
  root: string,
  minTs: number,
  maxTs: number,
): Promise<AtlasMarker[]> {
  const markers: AtlasMarker[] = [];
  for (const config of manifest.markers ?? []) {
    const filePath = expandSourcePath(root, config.path, manifest.symbol);
    if (!fs.existsSync(filePath)) continue;
    await forEachRow(filePath, config.format ?? "auto", row => {
      const timestamp = timestampMs(getPathValue(row, config.timestampField ?? "timestamp"));
      if (timestamp === null || timestamp < minTs || timestamp > maxTs) return;
      const kindValue = config.kindField ? getPathValue(row, config.kindField) : config.label;
      if (config.includeValues && !config.includeValues.some(value => value === kindValue)) return;
      const labelValue = config.labelField ? getPathValue(row, config.labelField) : kindValue;
      markers.push({
        timestamp,
        sourceId: config.id,
        sourceLabel: config.label,
        kind: String(kindValue ?? config.label),
        label: String(labelValue ?? kindValue ?? config.label),
        color: config.color ?? "#ffd166",
      });
    });
  }
  return markers.sort((a, b) => a.timestamp - b.timestamp);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath: string, rows: JsonRow[]): void {
  if (!rows.length) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  fs.writeFileSync(filePath, `${headers.join(",")}\n${rows.map(row => headers.map(header => csvCell(row[header])).join(",")).join("\n")}\n`, "utf8");
}

function validateManifest(manifest: EventAtlasManifest): void {
  if (manifest.version !== 1) throw new Error(`Unsupported event-atlas manifest version: ${manifest.version}`);
  if (!manifest.id || !manifest.symbol) throw new Error("Manifest id and symbol are required");
  if (!manifest.events.length) throw new Error("Manifest must contain at least one event");
  if (!(manifest.candleSource.intervalMinutes > 0)) throw new Error("candleSource.intervalMinutes must be positive");
  if (!(manifest.chart.beforeHours > 0) || !(manifest.chart.afterHours > 0)) throw new Error("Chart beforeHours/afterHours must be positive");
  if (!(manifest.chart.primaryIntervalMinutes > 0)) throw new Error("chart.primaryIntervalMinutes must be positive");
}

export function loadEventAtlasManifest(manifestPath: string, root = process.cwd()): EventAtlasManifest {
  const resolved = path.resolve(root, manifestPath);
  const manifest = JSON.parse(fs.readFileSync(resolved, "utf8")) as EventAtlasManifest;
  validateManifest(manifest);
  return manifest;
}

export async function generateEventAtlas(
  manifestPath: string,
  root = process.cwd(),
  outputOverride?: string,
): Promise<GeneratedEventAtlas> {
  const manifest = loadEventAtlasManifest(manifestPath, root);
  const events = resolveAtlasEvents(manifest);
  const loaded = await loadAtlasCandles(manifest, root);
  const candles = loaded.candles;
  const features = new Map<string, AtlasEventFeatures>();
  const zones = new Map<string, AtlasZoneSnapshot[]>();
  for (const event of events) {
    const built = buildAtlasFeatures(candles, event.timestamp, manifest.candleSource.intervalMinutes, manifest);
    features.set(event.id, built.features);
    zones.set(event.id, built.zones);
  }
  const neighbours = findNeighbours(candles, manifest, events);
  const allTimes = [...events.map(event => event.timestamp), ...neighbours.map(neighbour => neighbour.timestamp)];
  const minWindowTs = Math.min(...allTimes) - manifest.chart.beforeHours * HOUR;
  const maxWindowTs = Math.max(...allTimes) + manifest.chart.afterHours * HOUR;
  const panels = await loadPanels(manifest, root, minWindowTs, maxWindowTs);
  const markers = await loadMarkers(manifest, root, minWindowTs, maxWindowTs);
  const outputDir = path.resolve(root, outputOverride ?? manifest.outputDir ?? path.join("backtests", "event-atlas", manifest.id));
  const eventDir = path.join(outputDir, "events");
  const controlDir = path.join(outputDir, "controls");
  fs.mkdirSync(eventDir, { recursive: true });
  fs.mkdirSync(controlDir, { recursive: true });
  const primaryAll = aggregateAtlasCandles(candles, manifest.chart.primaryIntervalMinutes);
  const secondaryInterval = manifest.chart.secondaryIntervalMinutes ?? 240;
  const secondaryAll = aggregateAtlasCandles(candles, secondaryInterval);

  for (const event of events) {
    const startTs = event.timestamp - manifest.chart.beforeHours * HOUR;
    const endTs = event.timestamp + manifest.chart.afterHours * HOUR;
    const primary = primaryAll.filter(candle => candle.timestamp >= startTs && candle.timestamp <= endTs);
    const secondary = secondaryAll.filter(candle => candle.timestamp >= startTs && candle.timestamp <= endTs);
    const svg = renderAtlasEventSvg({
      manifest,
      event,
      features: features.get(event.id)!,
      primaryCandles: primary,
      secondaryCandles: secondary,
      primaryEmaCandles: primaryAll.filter(candle => candle.timestamp <= endTs),
      secondaryEmaCandles: secondaryAll.filter(candle => candle.timestamp <= endTs),
      zones: zones.get(event.id) ?? [],
      panels,
      markers,
    });
    fs.writeFileSync(path.join(eventDir, `${event.id}.svg`), svg, "utf8");
  }

  for (const neighbour of neighbours) {
    const startTs = neighbour.timestamp - manifest.chart.beforeHours * HOUR;
    const endTs = neighbour.timestamp + manifest.chart.afterHours * HOUR;
    const chartCandles = primaryAll.filter(candle => candle.timestamp >= startTs && candle.timestamp <= endTs);
    const event = events.find(item => item.id === neighbour.eventId)!;
    fs.writeFileSync(
      path.join(controlDir, `${event.id}-${neighbour.rank}.svg`),
      renderNeighbourSvg({ manifest, event, neighbour, candles: chartCandles, emaCandles: primaryAll.filter(candle => candle.timestamp <= endTs) }),
      "utf8",
    );
  }

  fs.writeFileSync(path.join(outputDir, "index.html"), renderAtlasIndexHtml({ manifest, events, features, neighbours }), "utf8");
  writeCsv(path.join(outputDir, "event-ledger.csv"), events.map(event => ({
    ...features.get(event.id)!,
    eventId: event.id,
    inputAt: event.inputAt,
    timestamp: event.timestamp,
    iso: new Date(event.timestamp).toISOString(),
    label: event.label,
    tags: event.tags,
    note: event.note,
  })));
  writeCsv(path.join(outputDir, "nearest-neighbours.csv"), neighbours.map(neighbour => ({
    ...neighbour.features,
    eventId: neighbour.eventId,
    rank: neighbour.rank,
    timestamp: neighbour.timestamp,
    iso: new Date(neighbour.timestamp).toISOString(),
    distance: neighbour.distance,
  })));

  const first = candles[0].timestamp;
  const last = candles[candles.length - 1].timestamp;
  const integrity: AtlasIntegrity = {
    generatedAt: new Date().toISOString(),
    manifestId: manifest.id,
    symbol: manifest.symbol,
    candlePath: path.relative(root, loaded.resolvedPath).replace(/\\/g, "/"),
    candleCount: candles.length,
    firstCandleAt: new Date(first).toISOString(),
    lastCandleAt: new Date(last).toISOString(),
    sourceIntervalMinutes: manifest.candleSource.intervalMinutes,
    invalidCandleRows: loaded.invalidRows,
    duplicateCandleRows: loaded.duplicateRows,
    conflictingCandleRows: loaded.conflictingRows,
    largestGapMinutes: loaded.largestGapMinutes,
    eventCount: events.length,
    eventsWithFullPreWindow: events.filter(event => event.timestamp - manifest.chart.beforeHours * HOUR >= first).length,
    eventsWithFullPostWindow: events.filter(event => event.timestamp + manifest.chart.afterHours * HOUR <= last + manifest.candleSource.intervalMinutes * MINUTE).length,
    causalRule: "All event features, similarity vectors, S/R zones, and metric values on the left side of T use only observations completed at or before T. Candles at/after T are outcome-only.",
  };
  fs.writeFileSync(path.join(outputDir, "integrity.json"), `${JSON.stringify(integrity, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "manifest.resolved.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { outputDir, manifest, events, features, neighbours, integrity };
}
