/** Reuse the canonical, witnessed gap repair; never edit raw source partitions. */
import path from 'path';
import { readCandleRepair, validateCandleRepair } from './replay-candle-repair';
export const REPAIR_FILE = 'backtests/hype/flow-response-extension-data-2026-09-14/repair.json';
export function verifiedComparisonRepairs(root: string, base: Map<number, any>, cutoff: number) {
  const candles = [...base].map(([ts, r]) => ({ ts, endTs: ts + 60000, open: Number(r.o), high: Number(r.h), low: Number(r.l), close: Number(r.c), volume: Number(r.volume), turnover: Number(r.turnover) }))
    .filter(r => r.endTs <= cutoff).sort((a, b) => a.ts - b.ts);
  return validateCandleRepair(readCandleRepair(path.join(root, REPAIR_FILE)), candles, 'HYPEUSDT', cutoff);
}
