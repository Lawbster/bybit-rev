import type {
  AtlasCandle,
  AtlasEventFeatures,
  AtlasMarker,
  AtlasNeighbour,
  AtlasPanelData,
  AtlasZoneSnapshot,
  EventAtlasManifest,
  ResolvedAtlasEvent,
} from "./event-atlas-types";

const COLORS = {
  background: "#0b1020",
  panel: "#11182b",
  grid: "#26314d",
  text: "#d7deed",
  muted: "#8290ad",
  green: "#2dd4a3",
  red: "#ff6577",
  event: "#ffd166",
  future: "#291d35",
  ema50: "#5ba7ff",
  ema200: "#c084fc",
  support: "#34d399",
  resistance: "#fb7185",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => Number.isFinite(value));
}

function bounds(values: number[], padding = 0.05): [number, number] {
  if (!values.length) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min || 1) * 0.05;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * padding;
  min -= pad;
  max += pad;
  return [min, max];
}

function fmt(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "NA" : value.toFixed(digits);
}

function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return out;
  let current = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = current;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    current = alpha * values[i] + (1 - alpha) * current;
    out[i] = current;
  }
  return out;
}

function linePath(
  values: Array<number | null>,
  xAt: (index: number) => number,
  yAt: (value: number) => number,
): string {
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)} `;
    drawing = true;
  });
  return path.trim();
}

function metricLinePath(
  points: AtlasPanelData["points"],
  seriesIndex: number,
  maxGapMs: number,
  xAt: (timestamp: number) => number,
  yAt: (value: number) => number,
): string {
  let path = "";
  let drawing = false;
  let lastTimestamp: number | null = null;
  for (const point of points) {
    const value = point.values[seriesIndex];
    if (value === null || !Number.isFinite(value)) {
      drawing = false;
      lastTimestamp = null;
      continue;
    }
    if (lastTimestamp === null || point.timestamp - lastTimestamp > maxGapMs) drawing = false;
    path += `${drawing ? "L" : "M"}${xAt(point.timestamp).toFixed(2)},${yAt(value).toFixed(2)} `;
    drawing = true;
    lastTimestamp = point.timestamp;
  }
  return path.trim();
}

function renderPricePanel(args: {
  candles: AtlasCandle[];
  emaCandles?: AtlasCandle[];
  eventTs: number;
  zones: AtlasZoneSnapshot[];
  markers: AtlasMarker[];
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}): string {
  const { candles, emaCandles = candles, eventTs, zones, markers, x, y, width, height, title } = args;
  if (!candles.length) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${COLORS.panel}"/><text x="${x + 12}" y="${y + 24}" fill="${COLORS.muted}">${esc(title)}: no data</text>`;
  }

  const left = x + 58;
  const right = x + width - 14;
  const top = y + 30;
  const bottom = y + height - 34;
  const volumeTop = bottom - Math.max(35, height * 0.14);
  const priceBottom = volumeTop - 6;
  const startTs = candles[0].timestamp;
  const lastTs = candles[candles.length - 1].timestamp;
  const span = Math.max(1, lastTs - startTs);
  const xTs = (ts: number) => left + ((ts - startTs) / span) * (right - left);
  const priceValues = candles.flatMap(candle => [candle.low, candle.high]);
  for (const zone of zones) priceValues.push(zone.price);
  const [minPrice, maxPrice] = bounds(priceValues, 0.04);
  const yPrice = (price: number) => priceBottom - ((price - minPrice) / (maxPrice - minPrice)) * (priceBottom - top);
  const maxVolume = Math.max(1, ...candles.map(candle => candle.volume));
  const candleWidth = Math.max(1, Math.min(7, (right - left) / candles.length * 0.68));
  const eventX = Math.max(left, Math.min(right, xTs(eventTs)));

  let svg = `<g>`;
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${COLORS.panel}"/>`;
  svg += `<rect x="${eventX}" y="${top}" width="${Math.max(0, right - eventX)}" height="${bottom - top}" fill="${COLORS.future}" opacity="0.75"/>`;
  svg += `<text x="${x + 12}" y="${y + 20}" fill="${COLORS.text}" font-size="13" font-weight="600">${esc(title)}</text>`;
  svg += `<text x="${eventX + 5}" y="${top + 14}" fill="${COLORS.muted}" font-size="10">future outcome</text>`;

  for (let i = 0; i <= 4; i++) {
    const gy = top + (i / 4) * (priceBottom - top);
    const price = maxPrice - (i / 4) * (maxPrice - minPrice);
    svg += `<line x1="${left}" y1="${gy}" x2="${right}" y2="${gy}" stroke="${COLORS.grid}" stroke-width="1"/>`;
    svg += `<text x="${left - 6}" y="${gy + 4}" text-anchor="end" fill="${COLORS.muted}" font-size="10">${price.toFixed(price < 1 ? 5 : 2)}</text>`;
  }

  for (const zone of zones) {
    if (zone.price < minPrice || zone.price > maxPrice) continue;
    const zy = yPrice(zone.price);
    const color = zone.side === "support" ? COLORS.support : zone.side === "resistance" ? COLORS.resistance : COLORS.event;
    svg += `<line x1="${left}" y1="${zy}" x2="${right}" y2="${zy}" stroke="${color}" stroke-width="1" stroke-dasharray="5 4" opacity="0.68"><title>${esc(`${zone.side} ${zone.price.toFixed(4)} (${zone.touches} touches), known by ${new Date(zone.confirmTs).toISOString()}`)}</title></line>`;
  }

  const ema50All = ema(emaCandles.map(candle => candle.close), 50);
  const ema200All = ema(emaCandles.map(candle => candle.close), 200);
  const ema50ByTs = new Map(emaCandles.map((candle, index) => [candle.timestamp, ema50All[index]]));
  const ema200ByTs = new Map(emaCandles.map((candle, index) => [candle.timestamp, ema200All[index]]));
  const ema50 = candles.map(candle => ema50ByTs.get(candle.timestamp) ?? null);
  const ema200 = candles.map(candle => ema200ByTs.get(candle.timestamp) ?? null);
  const xAt = (index: number) => xTs(candles[index].timestamp);
  const ema50Path = linePath(ema50, xAt, yPrice);
  const ema200Path = linePath(ema200, xAt, yPrice);
  if (ema50Path) svg += `<path d="${ema50Path}" fill="none" stroke="${COLORS.ema50}" stroke-width="1.3" opacity="0.9"/>`;
  if (ema200Path) svg += `<path d="${ema200Path}" fill="none" stroke="${COLORS.ema200}" stroke-width="1.5" opacity="0.95"/>`;

  candles.forEach(candle => {
    const cx = xTs(candle.timestamp);
    const color = candle.close >= candle.open ? COLORS.green : COLORS.red;
    const openY = yPrice(candle.open);
    const closeY = yPrice(candle.close);
    const highY = yPrice(candle.high);
    const lowY = yPrice(candle.low);
    svg += `<line x1="${cx}" y1="${highY}" x2="${cx}" y2="${lowY}" stroke="${color}" stroke-width="1"/>`;
    svg += `<rect x="${cx - candleWidth / 2}" y="${Math.min(openY, closeY)}" width="${candleWidth}" height="${Math.max(1, Math.abs(closeY - openY))}" fill="${color}"><title>${esc(`${new Date(candle.timestamp).toISOString()} O ${candle.open} H ${candle.high} L ${candle.low} C ${candle.close}`)}</title></rect>`;
    const volumeHeight = (candle.volume / maxVolume) * (bottom - volumeTop);
    svg += `<rect x="${cx - candleWidth / 2}" y="${bottom - volumeHeight}" width="${candleWidth}" height="${volumeHeight}" fill="${color}" opacity="0.28"/>`;
  });

  svg += `<line x1="${eventX}" y1="${top}" x2="${eventX}" y2="${bottom}" stroke="${COLORS.event}" stroke-width="2"/>`;
  svg += `<text x="${eventX - 5}" y="${bottom + 15}" text-anchor="end" fill="${COLORS.event}" font-size="10">T</text>`;

  for (const marker of markers) {
    if (marker.timestamp < startTs || marker.timestamp > lastTs) continue;
    const mx = xTs(marker.timestamp);
    svg += `<path d="M${mx - 5},${top + 4} L${mx + 5},${top + 4} L${mx},${top + 13} Z" fill="${marker.color}"><title>${esc(`${marker.sourceLabel}: ${marker.kind} — ${marker.label}`)}</title></path>`;
  }

  svg += `<text x="${right}" y="${y + 20}" text-anchor="end" fill="${COLORS.muted}" font-size="10">EMA50 <tspan fill="${COLORS.ema50}">●</tspan> EMA200 <tspan fill="${COLORS.ema200}">●</tspan></text>`;
  svg += `</g>`;
  return svg;
}

function renderMetricPanel(args: {
  panel: AtlasPanelData;
  eventTs: number;
  startTs: number;
  endTs: number;
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  const { panel, eventTs, startTs, endTs, x, y, width, height } = args;
  const points = panel.points.filter(point => point.timestamp >= startTs && point.timestamp <= endTs);
  const left = x + 58;
  const right = x + width - 14;
  const top = y + 25;
  const bottom = y + height - 20;
  const span = Math.max(1, endTs - startTs);
  const xTs = (ts: number) => left + ((ts - startTs) / span) * (right - left);
  const values = finite(points.flatMap(point => point.values));
  const refs = panel.config.referenceLines ?? [];
  const [minValue, maxValue] = bounds([...values, ...refs.map(ref => ref.value)], 0.08);
  const yValue = (value: number) => bottom - ((value - minValue) / (maxValue - minValue)) * (bottom - top);
  const eventX = xTs(eventTs);

  let svg = `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${COLORS.panel}"/>`;
  svg += `<rect x="${eventX}" y="${top}" width="${Math.max(0, right - eventX)}" height="${bottom - top}" fill="${COLORS.future}" opacity="0.75"/>`;
  svg += `<text x="${x + 12}" y="${y + 18}" fill="${COLORS.text}" font-size="12" font-weight="600">${esc(panel.config.label)}</text>`;
  svg += `<text x="${left - 6}" y="${top + 4}" text-anchor="end" fill="${COLORS.muted}" font-size="9">${maxValue.toFixed(2)}</text>`;
  svg += `<text x="${left - 6}" y="${bottom}" text-anchor="end" fill="${COLORS.muted}" font-size="9">${minValue.toFixed(2)}</text>`;
  svg += `<line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="${COLORS.grid}"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${COLORS.grid}"/>`;

  for (const reference of refs) {
    const ry = yValue(reference.value);
    svg += `<line x1="${left}" y1="${ry}" x2="${right}" y2="${ry}" stroke="${reference.color ?? COLORS.muted}" stroke-dasharray="4 4" opacity="0.7"/>`;
    if (reference.label) svg += `<text x="${right - 2}" y="${ry - 3}" text-anchor="end" fill="${reference.color ?? COLORS.muted}" font-size="9">${esc(reference.label)}</text>`;
  }

  panel.config.series.forEach((series, seriesIndex) => {
    const color = series.color ?? [COLORS.ema50, COLORS.event, COLORS.green, COLORS.red][seriesIndex % 4];
    const path = metricLinePath(
      points,
      seriesIndex,
      (panel.config.bucketMinutes ?? 30) * 60000 * 2.5,
      xTs,
      yValue,
    );
    if (path) svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.4"/>`;
    svg += `<text x="${right - seriesIndex * 95}" y="${y + 18}" text-anchor="end" fill="${color}" font-size="9">${esc(series.label)}</text>`;
  });
  svg += `<line x1="${eventX}" y1="${top}" x2="${eventX}" y2="${bottom}" stroke="${COLORS.event}" stroke-width="1.5"/>`;
  svg += `</g>`;
  return svg;
}

export function renderAtlasEventSvg(args: {
  manifest: EventAtlasManifest;
  event: ResolvedAtlasEvent;
  features: AtlasEventFeatures;
  primaryCandles: AtlasCandle[];
  secondaryCandles: AtlasCandle[];
  primaryEmaCandles?: AtlasCandle[];
  secondaryEmaCandles?: AtlasCandle[];
  zones: AtlasZoneSnapshot[];
  panels: AtlasPanelData[];
  markers: AtlasMarker[];
}): string {
  const { manifest, event, features, primaryCandles, secondaryCandles, primaryEmaCandles, secondaryEmaCandles, zones, panels, markers } = args;
  const width = 1240;
  const headerHeight = 92;
  const primaryHeight = 360;
  const secondaryHeight = 240;
  const metricHeight = 130;
  const gap = 12;
  const height = headerHeight + primaryHeight + secondaryHeight + panels.length * metricHeight + (panels.length + 3) * gap;
  const startTs = event.timestamp - manifest.chart.beforeHours * 3600000;
  const endTs = event.timestamp + manifest.chart.afterHours * 3600000;
  const renderedZones = [
    ...zones.filter(zone => zone.price >= features.price).sort((a, b) => a.price - b.price).slice(0, 6),
    ...zones.filter(zone => zone.price < features.price).sort((a, b) => b.price - a.price).slice(0, 6),
  ];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="${COLORS.background}"/>`;
  svg += `<style>text{font-family:Inter,Segoe UI,Arial,sans-serif}</style>`;
  svg += `<text x="18" y="28" fill="${COLORS.text}" font-size="18" font-weight="700">${esc(manifest.symbol)} · ${esc(event.label)}</text>`;
  svg += `<text x="18" y="50" fill="${COLORS.muted}" font-size="12">T=${esc(new Date(event.timestamp).toISOString())} · ${esc(event.tags.join(", ") || "unclassified")}</text>`;
  svg += `<text x="18" y="72" fill="${COLORS.text}" font-size="11">price ${fmt(features.price, 4)} · ret24h ${fmt(features.return24hPct)}% · EMA200 dist ${fmt(features.ema200DistPct)}% · R ${fmt(features.resistanceDistPct)}% · S ${fmt(features.supportDistPct)}% · fwd low12h ${fmt(features.forwardLow12hPct)}%</text>`;
  if (event.note) svg += `<text x="1222" y="28" text-anchor="end" fill="${COLORS.muted}" font-size="11">${esc(event.note)}</text>`;

  let y = headerHeight;
  svg += renderPricePanel({ candles: primaryCandles, emaCandles: primaryEmaCandles, eventTs: event.timestamp, zones: renderedZones, markers, x: 8, y, width: width - 16, height: primaryHeight, title: `${manifest.chart.primaryIntervalMinutes}m causal + outcome chart · nearest confirmed zones` });
  y += primaryHeight + gap;
  svg += renderPricePanel({ candles: secondaryCandles, emaCandles: secondaryEmaCandles, eventTs: event.timestamp, zones: renderedZones, markers, x: 8, y, width: width - 16, height: secondaryHeight, title: `${manifest.chart.secondaryIntervalMinutes ?? 240}m regime chart · nearest confirmed zones` });
  y += secondaryHeight + gap;
  for (const panel of panels) {
    svg += renderMetricPanel({ panel, eventTs: event.timestamp, startTs, endTs, x: 8, y, width: width - 16, height: metricHeight });
    y += metricHeight + gap;
  }
  svg += `</svg>`;
  return svg;
}

export function renderNeighbourSvg(args: {
  manifest: EventAtlasManifest;
  event: ResolvedAtlasEvent;
  neighbour: AtlasNeighbour;
  candles: AtlasCandle[];
  emaCandles?: AtlasCandle[];
}): string {
  const width = 760;
  const height = 280;
  const fakeEventTs = args.neighbour.timestamp;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="${COLORS.background}"/><style>text{font-family:Inter,Segoe UI,Arial,sans-serif}</style>`;
  svg += renderPricePanel({
    candles: args.candles,
    emaCandles: args.emaCandles,
    eventTs: fakeEventTs,
    zones: [],
    markers: [],
    x: 4,
    y: 4,
    width: width - 8,
    height: height - 8,
    title: `Matched control #${args.neighbour.rank} · ${new Date(fakeEventTs).toISOString()} · distance ${args.neighbour.distance.toFixed(4)} · fwd low12h ${fmt(args.neighbour.features.forwardLow12hPct)}%`,
  });
  svg += `</svg>`;
  return svg;
}

export function renderAtlasIndexHtml(args: {
  manifest: EventAtlasManifest;
  events: ResolvedAtlasEvent[];
  features: Map<string, AtlasEventFeatures>;
  neighbours: AtlasNeighbour[];
}): string {
  const { manifest, events, features, neighbours } = args;
  const cards = events.map(event => {
    const eventNeighbours = neighbours.filter(neighbour => neighbour.eventId === event.id);
    const neighboursHtml = eventNeighbours.length
      ? `<details><summary>Matched controls (${eventNeighbours.length})</summary>${eventNeighbours.map(neighbour => `<figure><img loading="lazy" src="controls/${esc(event.id)}-${neighbour.rank}.svg"/><figcaption>${esc(new Date(neighbour.timestamp).toISOString())} · distance ${neighbour.distance.toFixed(4)}</figcaption></figure>`).join("")}</details>`
      : "";
    const feature = features.get(event.id)!;
    return `<article><h2>${esc(event.label)}</h2><p>${esc(new Date(event.timestamp).toISOString())} · forward low 12h ${fmt(feature.forwardLow12hPct)}% · forward low 24h ${fmt(feature.forwardLow24hPct)}%</p><img loading="lazy" src="events/${esc(event.id)}.svg"/>${neighboursHtml}</article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(manifest.title ?? manifest.id)}</title>
<style>
body{margin:0;background:#070b15;color:#d7deed;font:14px Inter,Segoe UI,Arial,sans-serif}header{position:sticky;top:0;z-index:2;padding:18px 24px;background:#0b1020;border-bottom:1px solid #26314d}main{max-width:1320px;margin:auto;padding:20px}article{margin:0 0 28px;padding:16px;background:#0b1020;border:1px solid #26314d;border-radius:12px}h1,h2{margin:0 0 8px}p{color:#9aa8c4}img{display:block;width:100%;height:auto;background:#0b1020}details{margin-top:12px}summary{cursor:pointer;color:#ffd166;font-weight:600}figure{margin:14px 0;padding:8px;background:#11182b}figcaption{color:#8290ad;margin-top:6px}code{color:#ffd166}
</style></head><body><header><h1>${esc(manifest.title ?? manifest.id)}</h1><p>${esc(manifest.symbol)} · ${events.length} labelled events · charts explicitly separate information available at T from future outcomes.</p></header><main>${cards}</main></body></html>`;
}
