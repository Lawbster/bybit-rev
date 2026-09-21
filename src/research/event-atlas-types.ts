import type { SRMemoryZoneConfig } from "../bot/sr-memory-zones";

export type AtlasFileFormat = "auto" | "json" | "jsonl";

export interface AtlasFieldMap {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

export interface AtlasCandleSource {
  path: string;
  format?: AtlasFileFormat;
  intervalMinutes: number;
  fields?: Partial<AtlasFieldMap>;
}

export interface AtlasEventInput {
  id?: string;
  at: string | number;
  label?: string;
  tags?: string[];
  note?: string;
}

export interface AtlasPanelSeriesConfig {
  label: string;
  valueField: string;
  color?: string;
}

export interface AtlasReferenceLine {
  value: number;
  label?: string;
  color?: string;
}

export interface AtlasPanelConfig {
  id: string;
  label: string;
  path: string;
  format?: AtlasFileFormat;
  timestampField?: string;
  bucketMinutes?: number;
  series: AtlasPanelSeriesConfig[];
  referenceLines?: AtlasReferenceLine[];
}

export interface AtlasMarkerConfig {
  id: string;
  label: string;
  path: string;
  format?: AtlasFileFormat;
  timestampField?: string;
  kindField?: string;
  labelField?: string;
  includeValues?: Array<string | number | boolean>;
  color?: string;
}

export interface AtlasChartConfig {
  beforeHours: number;
  afterHours: number;
  primaryIntervalMinutes: number;
  secondaryIntervalMinutes?: number;
}

export interface AtlasSimilarityConfig {
  enabled: boolean;
  candidateIntervalMinutes: number;
  lookbackHours: number;
  vectorPoints?: number;
  neighboursPerEvent: number;
  exclusionHours: number;
  neighbourSeparationHours?: number;
}

export interface EventAtlasManifest {
  version: 1;
  id: string;
  symbol: string;
  title?: string;
  eventTimeZoneOffsetMinutes?: number;
  candleSource: AtlasCandleSource;
  events: AtlasEventInput[];
  chart: AtlasChartConfig;
  similarity?: AtlasSimilarityConfig;
  srMemory?: Partial<SRMemoryZoneConfig> & { enabled: boolean };
  panels?: AtlasPanelConfig[];
  markers?: AtlasMarkerConfig[];
  outputDir?: string;
}

export interface AtlasCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ResolvedAtlasEvent {
  id: string;
  timestamp: number;
  inputAt: string | number;
  label: string;
  tags: string[];
  note?: string;
}

export interface AtlasMetricPoint {
  timestamp: number;
  values: Array<number | null>;
}

export interface AtlasPanelData {
  config: AtlasPanelConfig;
  points: AtlasMetricPoint[];
}

export interface AtlasMarker {
  timestamp: number;
  sourceId: string;
  sourceLabel: string;
  kind: string;
  label: string;
  color: string;
}

export interface AtlasZoneSnapshot {
  price: number;
  touches: number;
  highTouches: number;
  lowTouches: number;
  confirmTs: number;
  side: "support" | "resistance" | "mixed";
}

export interface AtlasEventFeatures {
  timestamp: number;
  price: number;
  return4hPct: number | null;
  return12hPct: number | null;
  return24hPct: number | null;
  return72hPct: number | null;
  ema50_4h: number | null;
  ema200_4h: number | null;
  ema200DistPct: number | null;
  realizedVol24hPct: number | null;
  range24hPct: number | null;
  nearestResistance: number | null;
  resistanceDistPct: number | null;
  nearestSupport: number | null;
  supportDistPct: number | null;
  forwardLow12hPct: number | null;
  forwardHigh12hPct: number | null;
  forwardClose12hPct: number | null;
  forwardLow24hPct: number | null;
  forwardHigh24hPct: number | null;
  forwardClose24hPct: number | null;
}

export interface AtlasNeighbour {
  eventId: string;
  rank: number;
  timestamp: number;
  distance: number;
  features: AtlasEventFeatures;
}

export interface AtlasIntegrity {
  generatedAt: string;
  manifestId: string;
  symbol: string;
  candlePath: string;
  candleCount: number;
  firstCandleAt: string;
  lastCandleAt: string;
  sourceIntervalMinutes: number;
  invalidCandleRows: number;
  duplicateCandleRows: number;
  conflictingCandleRows: number;
  largestGapMinutes: number;
  eventCount: number;
  eventsWithFullPreWindow: number;
  eventsWithFullPostWindow: number;
  causalRule: string;
}
