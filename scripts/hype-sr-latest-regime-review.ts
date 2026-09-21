/**
 * Causal S/R geometry review for the live HYPE partial-exit policy.
 *
 * This is a research-only runner. It reuses the parity-validated ladder engine,
 * replaces only the memory-zone series, and writes results to stdout.
 *
 * Usage:
 *   npx ts-node scripts/hype-sr-latest-regime-review.ts \
 *     --start=2026-05-17T20:43:00Z --end=2026-08-04T20:06:00Z
 */

import {
  buildSeries,
  iso,
  lowerBound,
  r,
  runEngine,
  START_TS,
  Candle,
  EngineParams,
  EngineResult,
  Series,
} from "./hype-freerun-canonical-replay";
import { attachDormantSeries } from "./hype-dormant-edge-replay";

const ONE_MIN = 60_000;
const DAY_MS = 86_400_000;

type ZoneGeometry = {
  id: string;
  tfMin: number;
  pivotLeft: number;
  pivotRight: number;
  clusterPct: number;
  minTouches: number;
  recentDays: number;
  side: "both" | "resistance";
  actionBufferPct: number;
};

type Pivot = {
  confirmTs: number;
  price: number;
  side: "resistance" | "support";
};

function aggregate(candles: Candle[], tfMs: number): Candle[] {
  const out: Candle[] = [];
  let current: Candle | null = null;
  for (const candle of candles) {
    const ts = Math.floor(candle.ts / tfMs) * tfMs;
    if (!current || current.ts !== ts) {
      current = { ...candle, ts, endTs: ts + tfMs };
      out.push(current);
      continue;
    }
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    current.close = candle.close;
  }
  return out;
}

function buildZoneSeries(candles: Candle[], cfg: ZoneGeometry): Array<{ ts: number; prices: number[] }> {
  const tfMs = cfg.tfMin * ONE_MIN;
  const tf = aggregate(candles, tfMs);
  const pivots: Pivot[] = [];

  for (let i = cfg.pivotLeft; i < tf.length - cfg.pivotRight; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - cfg.pivotLeft; j <= i + cfg.pivotRight; j++) {
      if (j === i) continue;
      if (tf[j].high >= tf[i].high) isHigh = false;
      if (tf[j].low <= tf[i].low) isLow = false;
    }
    const confirmTs = tf[i + cfg.pivotRight].ts + tfMs;
    if (isHigh) pivots.push({ confirmTs, price: tf[i].high, side: "resistance" });
    if (isLow && cfg.side === "both") pivots.push({ confirmTs, price: tf[i].low, side: "support" });
  }
  pivots.sort((a, b) => a.confirmTs - b.confirmTs);

  const zones: Array<{ ts: number; prices: number[] }> = [];
  let lo = 0;
  let hi = 0;
  for (const bar of tf) {
    while (hi < pivots.length && pivots[hi].confirmTs <= bar.ts) hi++;
    while (lo < hi && pivots[lo].confirmTs < bar.ts - cfg.recentDays * DAY_MS) lo++;

    const levels: Array<{ sum: number; count: number }> = [];
    for (let i = lo; i < hi; i++) {
      const pivot = pivots[i];
      let target: { sum: number; count: number } | null = null;
      for (const level of levels) {
        const mean = level.sum / level.count;
        if (Math.abs(mean - pivot.price) / mean <= cfg.clusterPct) {
          target = level;
          break;
        }
      }
      if (!target) {
        target = { sum: 0, count: 0 };
        levels.push(target);
      }
      target.sum += pivot.price;
      target.count++;
    }

    zones.push({
      ts: bar.ts,
      prices: levels
        .filter(level => level.count >= cfg.minTouches)
        .map(level => level.sum / level.count)
        .sort((a, b) => a - b),
    });
  }
  return zones;
}

function baseParams(id: string, bufferPct?: number): EngineParams {
  return {
    id,
    maxPositions: 11,
    hardFlattenHours: 12,
    hardFlattenPct: -2,
    cooldownMode: "live4h",
    pullbackMode: "none",
    ...(bufferPct === undefined ? {} : {
      srExec: {
        partialExit: {
          minDepth: 6,
          keepRungs: 3,
          bufferPct,
          minLadderPnlPct: 0.25,
          requirePlanProfit: true,
          pulse: "deteriorating",
          cooldownMin: 60,
        },
      },
    }),
  };
}

function totalPnl(result: EngineResult): number {
  return result.realized + result.openPnl;
}

function monthTotals(result: EngineResult): Map<string, number> {
  const totals = new Map<string, number>();
  let allocated = 0;
  for (const close of result.closes) {
    const month = close.closeIso.slice(0, 7);
    const pnl = close.pnl + close.trimPnlInEpisode + close.hedgePnlInEpisode;
    totals.set(month, (totals.get(month) ?? 0) + pnl);
    allocated += pnl;
  }
  const residual = totalPnl(result) - allocated;
  if (Math.abs(residual) > 1e-8 && result.snapshots.length) {
    const month = iso(result.snapshots[result.snapshots.length - 1].ts).slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + residual);
  }
  return totals;
}

function summarize(id: string, result: EngineResult, baseline: EngineResult) {
  const baselineMonths = monthTotals(baseline);
  const months = monthTotals(result);
  const monthKeys = [...new Set([...baselineMonths.keys(), ...months.keys()])].sort();
  return {
    id,
    totalPnl: r(totalPnl(result), 2),
    deltaVsBaseline: r(totalPnl(result) - totalPnl(baseline), 2),
    partials: result.actions.filter(action => action.kind === "sr_partial_exit").length,
    partialPnl: r(result.trims.reduce((sum, trim) => sum + trim.pnl, 0), 2),
    closes: result.closes.length,
    hardFlatten: result.closes.filter(close => close.reason === "hard_flatten").length,
    emergencyKill: result.closes.filter(close => close.reason === "emergency_kill").length,
    worstClose: r(result.worstClose, 2),
    maxDrawdownPct: r(result.maxDrawdownPct, 2),
    monthlyDelta: Object.fromEntries(monthKeys.map(month => [
      month,
      r((months.get(month) ?? 0) - (baselineMonths.get(month) ?? 0), 2),
    ])),
  };
}

async function main(): Promise<void> {
  const series = await buildSeries();
  const startIdx = lowerBound(series.candles, START_TS, candle => candle.endTs);
  const endArg = process.argv.find(arg => arg.startsWith("--end="))?.slice("--end=".length);
  const endTs = endArg ? Date.parse(endArg) : Number.POSITIVE_INFINITY;
  const endIdx = Number.isFinite(endTs)
    ? lowerBound(series.candles, endTs, candle => candle.endTs)
    : series.candles.length;

  await attachDormantSeries(series, Math.max(0, startIdx - 2880));
  const defaultZones = series.srZones;
  const baseline = runEngine(baseParams("baseline"), series, {
    startIdx,
    endIdx,
    recordSnapshots: true,
  });

  const geometries: ZoneGeometry[] = [
    { id: "current", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "buffer_0.20", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.20 },
    { id: "buffer_0.25", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.25 },
    { id: "buffer_0.40", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.40 },
    { id: "tf_15m", tfMin: 15, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "tf_60m", tfMin: 60, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "pivot_3x3", tfMin: 30, pivotLeft: 3, pivotRight: 3, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "pivot_5x5", tfMin: 30, pivotLeft: 5, pivotRight: 5, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "cluster_0.30", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0030, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "cluster_0.60", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0060, minTouches: 2, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "min_touches_3", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 3, recentDays: 14, side: "both", actionBufferPct: 0.30 },
    { id: "recent_7d", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 7, side: "both", actionBufferPct: 0.30 },
    { id: "recent_21d", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 21, side: "both", actionBufferPct: 0.30 },
    { id: "resistance_only", tfMin: 30, pivotLeft: 4, pivotRight: 4, clusterPct: 0.0045, minTouches: 2, recentDays: 14, side: "resistance", actionBufferPct: 0.30 },
  ];

  const rows: ReturnType<typeof summarize>[] = [];
  for (const geometry of geometries) {
    series.srZones = buildZoneSeries(series.candles, geometry);
    const result = runEngine(baseParams(geometry.id, geometry.actionBufferPct), series, {
      startIdx,
      endIdx,
      recordSnapshots: true,
    });
    rows.push(summarize(geometry.id, result, baseline));
  }

  series.srZones = defaultZones;
  const attachedCurrent = runEngine(baseParams("attached_current", 0.30), series, {
    startIdx,
    endIdx,
    recordSnapshots: true,
  });
  const rebuiltCurrent = rows.find(row => row.id === "current")!;

  console.log(JSON.stringify({
    window: {
      start: iso(series.candles[startIdx].endTs),
      end: iso(series.candles[Math.max(startIdx, endIdx - 1)].endTs),
    },
    baseline: summarize("baseline", baseline, baseline),
    currentParity: {
      attachedTotalPnl: r(totalPnl(attachedCurrent), 2),
      rebuiltTotalPnl: rebuiltCurrent.totalPnl,
      delta: r(totalPnl(attachedCurrent) - rebuiltCurrent.totalPnl, 6),
      attachedPartials: attachedCurrent.actions.filter(action => action.kind === "sr_partial_exit").length,
      rebuiltPartials: rebuiltCurrent.partials,
    },
    variants: rows.sort((a, b) => b.deltaVsBaseline - a.deltaVsBaseline),
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
