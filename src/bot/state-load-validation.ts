// Validate critical persisted shapes before migration/defaults can hide damage.
// This does not replace exchange reconciliation or infer any missing receipts.
import { AGGRESSIVE10_ID } from "./aggressive10-policy";
type Row = Record<string, any>;

function object(value: unknown, name: string): asserts value is Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid ${name}: expected object`);
}
function number(value: unknown, name: string, min = -Infinity): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) throw new Error(`invalid ${name}: expected finite number >= ${min}`);
}
function text(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.length) throw new Error(`invalid ${name}: expected nonempty string`);
}
function array(value: unknown, name: string): asserts value is any[] {
  if (!Array.isArray(value)) throw new Error(`invalid ${name}: expected array`);
}
function numericFields(row: Row, fields: string[], name: string, min = 0): void {
  for (const key of fields) number(row[key], `${name}.${key}`, min);
}
function allocation(value: unknown, name: string): void {
  object(value, name);
  if (!["pro_rata", "selected_ids"].includes(value.mode)) throw new Error(`invalid ${name}.mode`);
  array(value.targets, `${name}.targets`);
  const ids = new Set<string>();
  for (const target of value.targets) {
    object(target, name);
    text(target.positionId, `${name}.positionId`);
    if (ids.has(target.positionId)) throw new Error(`duplicate ${name}.positionId`);
    ids.add(target.positionId);
    numericFields(target, ["preQty", "preNotional"], name);
  }
  if (value.mode === "pro_rata") number(value.preTotalQty, `${name}.preTotalQty`, 0);
}

export function validateLoadedState(raw: unknown): asserts raw is Row {
  object(raw, "state");
  array(raw.positions, "positions");
  number(raw.realizedPnl, "realizedPnl");
  if (raw.version !== undefined && (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > 6)) {
    throw new Error("unsupported state version");
  }
  const ids = new Set<string>();
  for (const p of raw.positions) {
    object(p, "position");
    text(p.id, "position.id");
    if (ids.has(p.id)) throw new Error("duplicate position.id");
    ids.add(p.id);
    numericFields(p, ["entryPrice", "entryTime", "qty", "notional", "level"], "position");
    if (p.entryPrice <= 0 || p.qty <= 0 || !Number.isInteger(p.level)) throw new Error("invalid position price/qty/level");
  }
  for (const key of ["lastAddTime", "totalBatchCloses", "totalBlockedAdds", "totalFees", "totalFunding",
    "lastFundingSettlement", "peakEquity", "riskOffUntil", "forcedExitCooldownUntil", "srPartialExitActionUntil",
    "hedgeLastCloseTime", "startedAt", "lastUpdated"]) {
    if (raw[key] !== undefined) number(raw[key], key);
  }
  for (const key of ["recoveryMode", "hedgeLastCloseWasKill"]) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") throw new Error(`invalid ${key}`);
  }
  if (raw.recoveryTpOrderId !== undefined && typeof raw.recoveryTpOrderId !== "string") throw new Error("invalid recoveryTpOrderId");
  if (raw.recoveryOwnerOrderLinkId != null) text(raw.recoveryOwnerOrderLinkId, "recoveryOwnerOrderLinkId");
  if (raw.aggressive10Ladder != null) {
    object(raw.aggressive10Ladder, "aggressive10Ladder");
    if (raw.aggressive10Ladder.policyId !== AGGRESSIVE10_ID || !["unseen", "extending", "released"].includes(raw.aggressive10Ladder.tpPhase)) {
      throw new Error("unrecognized aggressive10Ladder profile");
    }
  }
  if (raw.hedgePosition != null) {
    object(raw.hedgePosition, "hedgePosition");
    numericFields(raw.hedgePosition, ["entryPrice", "entryTime", "qty", "notional", "tpPrice", "killPrice"], "hedgePosition");
  }
  for (const key of ["lastTrendCheck", "regime"]) {
    if (raw[key] !== undefined) object(raw[key], key);
  }
  if (raw.lastTrendCheck) {
    number(raw.lastTrendCheck.timestamp, "lastTrendCheck.timestamp", 0);
    if (typeof raw.lastTrendCheck.blocked !== "boolean" || typeof raw.lastTrendCheck.reason !== "string") throw new Error("invalid lastTrendCheck");
  }
  if (raw.regime) {
    numericFields(raw.regime, ["redStreak", "greenStreak", "lastDayProcessed"], "regime");
    if (typeof raw.regime.flatActive !== "boolean") throw new Error("invalid regime.flatActive");
  }
  if (raw.damagedRegimeLatch != null) {
    object(raw.damagedRegimeLatch, "damagedRegimeLatch");
    const d = raw.damagedRegimeLatch;
    for (const key of ["active", "initialized"]) {
      if (d[key] !== undefined && typeof d[key] !== "boolean") throw new Error(`invalid damagedRegimeLatch.${key}`);
    }
    for (const key of ["triggeredAt", "trigger4hTimestamp", "triggerDistPct", "triggerTaker15m", "triggerTaker1h",
      "recoveryBars", "last4hTimestamp", "lastDistPct"]) {
      if (d[key] != null) number(d[key], `damagedRegimeLatch.${key}`);
    }
  }
  for (const key of ["completedPartialActions", "completedLongTransactions", "completedMakerTpOrders"]) {
    if (raw[key] === undefined) continue; // valid older schemas receive empty lists
    array(raw[key], key);
    for (const receipt of raw[key]) {
      object(receipt, key);
      text(receipt.orderLinkId, `${key}.orderLinkId`);
      number(receipt.filledQty, `${key}.filledQty`, 0);
      number(receipt.completedAt, `${key}.completedAt`, 0);
      if (key !== "completedPartialActions") {
        numericFields(receipt, ["totalPnl", "totalFees"], key, -Infinity);
        array(receipt.executionIds, `${key}.executionIds`);
        if (receipt.executionIds.some((id: unknown) => typeof id !== "string")) throw new Error(`invalid ${key}.executionIds`);
      }
    }
  }
  if (raw.pendingOrder != null) {
    const p = raw.pendingOrder;
    object(p, "pendingOrder");
    text(p.orderLinkId, "pendingOrder.orderLinkId");
    text(p.symbol, "pendingOrder.symbol");
    number(p.createdAt, "pendingOrder.createdAt", 0);
    if (!["open", "close", "hedge_open", "hedge_close"].includes(p.action)) throw new Error("invalid pendingOrder.action");
    if (p.kind === undefined || p.kind === "legacy") {
      number(p.notional, "pendingOrder.notional", 0);
      if (p.partialClose !== undefined) {
        object(p.partialClose, "pendingOrder.partialClose");
        array(p.partialClose.indices, "pendingOrder.partialClose.indices");
        if (p.partialClose.indices.some((i: unknown) => !Number.isInteger(i) || (i as number) < 0)) throw new Error("invalid partialClose index");
      }
    } else {
      if (!["long_open", "full_close", "partial_close"].includes(p.kind)) throw new Error("invalid pendingOrder.kind");
      if (p.action !== (p.kind === "long_open" ? "open" : "close")) throw new Error("pendingOrder kind/action mismatch");
      numericFields(p, ["preLocalQty", "preExchangeQty", "qtyStep", "lastCheckedAt"], "pendingOrder");
      if (p.qtyStep <= 0) throw new Error("invalid pendingOrder.qtyStep");
      if (p.kind === "long_open") numericFields(p, ["requestedNotional", "level"], "pendingOrder");
      else {
        allocation(p.allocation, "pendingOrder.allocation");
        numericFields(p, ["appliedQty", "appliedExecNotional"], "pendingOrder");
        if (p.kind === "full_close") {
          numericFields(p, ["prePositionCount", "preAvgEntry"], "pendingOrder");
          numericFields(p, ["appliedPnl", "appliedFees"], "pendingOrder", -Infinity);
          text(p.reason, "pendingOrder.reason");
        } else {
          numericFields(p, ["requestedQty", "submittedQty"], "pendingOrder");
          text(p.actionKey, "pendingOrder.actionKey");
          object(p.desiredPostCommit, "pendingOrder.desiredPostCommit");
        }
      }
    }
  }
  if (raw.desiredLongTp != null) {
    object(raw.desiredLongTp, "desiredLongTp");
    numericFields(raw.desiredLongTp, ["price", "positionQtyBasis", "activeTpPct", "updatedAt"], "desiredLongTp");
    if (!["pending", "confirmed", "failed"].includes(raw.desiredLongTp.syncStatus)) throw new Error("invalid desiredLongTp.syncStatus");
  }
  if (raw.makerTpOrder != null) {
    const m = raw.makerTpOrder;
    object(m, "makerTpOrder");
    text(m.orderLinkId, "makerTpOrder.orderLinkId");
    text(m.symbol, "makerTpOrder.symbol");
    if (!["intent_persisted", "active", "cancel_requested", "fallback_required", "recovery"].includes(m.phase)) throw new Error("invalid makerTpOrder.phase");
    if (m.version !== 1 && m.version !== 2) throw new Error("unsupported makerTpOrder.version");
    if (typeof m.orderId !== "string") throw new Error("invalid makerTpOrder.orderId");
    allocation(m.allocation, "makerTpOrder.allocation");
    numericFields(m, ["price", "activeTpPct", "requestedQty", "qtyStep", "prePositionCount", "preAvgEntry",
      "preOldestEntryTime", "createdAt", "updatedAt", "lastCheckedAt", "makerCumExecQty", "makerCumExecNotional",
      "appliedQty", "appliedExecNotional"], "makerTpOrder");
    numericFields(m, ["appliedPnl", "appliedFees"], "makerTpOrder", -Infinity);
    for (const key of ["exchangePrice", "submittedQty", "priceTick", "touchedAt", "fallbackDeadlineAt"]) {
      if (m[key] != null) number(m[key], `makerTpOrder.${key}`, 0);
    }
    array(m.executionIds, "makerTpOrder.executionIds");
    if (m.executionIds.some((id: unknown) => typeof id !== "string")) throw new Error("invalid makerTpOrder.executionIds");
    if (m.closeRequest != null) {
      object(m.closeRequest, "makerTpOrder.closeRequest");
      text(m.closeRequest.reason, "makerTpOrder.closeRequest.reason");
      if (!["tp_touch", "maker_partial", "forced", "emergency", "operator"].includes(m.closeRequest.source)) throw new Error("invalid maker close source");
      numericFields(m.closeRequest, ["requestedAt", "fallbackAfterAt"], "makerTpOrder.closeRequest");
    }
  }
}
