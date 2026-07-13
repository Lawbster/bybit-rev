import fs from "fs";
import path from "path";
import type { UpsideMarketClamp } from "./upside-readiness";

export interface RuntimeReconciliationHealth {
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  status: string;
  synced: boolean | null;
  exchangeFlat: boolean | null;
  reason?: string;
  localLongQty?: number;
  exchangeLongQty?: number;
  absDiff?: number;
  tolerance?: number;
  deferredBy?: string;
}

export interface RuntimeHealthSnapshotV1 {
  version: 1;
  symbol: string;
  processStartedAt: number;
  writtenAt: number;
  mode: string;
  mainLoop: {
    lastCycleAt: number;
    cycleCount: number;
  };
  websocket: {
    connected: boolean;
    lastPriceAt: number | null;
    ageMs: number | null;
    stale: boolean;
  };
  context: {
    healthy: boolean;
    horizonDays: number;
    expectedBars: number;
    actualContinuousBars: number;
    earliestContinuousTs: number | null;
    latestClosedTs: number;
    firstMissingTs?: number;
    reason?: string;
  };
  reconciliation: RuntimeReconciliationHealth;
  transaction: {
    pending: boolean;
    kind?: string;
    orderLinkId?: string;
    createdAt?: number;
    lastCheckedAt?: number;
    lastObservedStatus?: string;
    ageMs?: number;
  };
  recovery: {
    active: boolean;
    ownerOrderLinkId: string | null;
  };
  desiredLongTp: {
    present: boolean;
    missingSince?: number;
    price?: number;
    positionQtyBasis?: number;
    activeTpPct?: number;
    syncStatus?: "pending" | "confirmed" | "failed";
    updatedAt?: number;
    ageMs?: number;
    lastError?: string;
  };
  positions: {
    rungs: number;
    localLongQty: number;
  };
  upsideInputs?: {
    configuredBaseUsdt: number;
    equity: number;
    realizedPnl: number;
    market: UpsideMarketClamp;
  };
}

export function writeRuntimeHealthSnapshot(
  filePath: string,
  snapshot: RuntimeHealthSnapshotV1,
): { success: true } | { success: false; error: string } {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  const tempPath = path.join(dir, `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`);

  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(snapshot));
    fs.renameSync(tempPath, resolved);
    return { success: true };
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch { /* best-effort temp cleanup */ }
    return { success: false, error: err?.message ?? String(err) };
  }
}

export function readRuntimeHealthSnapshot(filePath: string): RuntimeHealthSnapshotV1 {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (parsed?.version !== 1) throw new Error(`unsupported runtime health version: ${parsed?.version ?? "missing"}`);
  return parsed as RuntimeHealthSnapshotV1;
}
