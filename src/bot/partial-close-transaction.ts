import type { LadderPosition } from "./state";

export type PartialCloseStrategy = "sr_memory" | "pullback_trim" | "score_partial" | "sr_legacy";

export type PartialCloseTargetSnapshot = {
  positionId: string;
  preQty: number;
  preNotional: number;
};

export type SelectedIdsAllocation = {
  mode: "selected_ids";
  targets: PartialCloseTargetSnapshot[];
};

export type ProRataAllocation = {
  mode: "pro_rata";
  targets: PartialCloseTargetSnapshot[];
  preTotalQty: number;
};

export type PartialCloseAllocation = SelectedIdsAllocation | ProRataAllocation;

export type PartialCloseDesiredPostCommit = {
  srCooldownUntil?: number;
  scoreLatch?: {
    ladderId: string;
    firedAt: number;
    score: number;
    action: "shadow" | "partial_flatten";
  };
  pullbackActionKey?: string;
};

export type PartialCloseReceipt = {
  actionKey: string;
  orderLinkId: string;
  strategy: PartialCloseStrategy;
  filledQty: number;
  completedAt: number;
};

export type PartialCloseIntent = {
  kind: "partial_close";
  action: "close";
  partialClose?: never;
  orderLinkId: string;
  symbol: string;
  strategy: PartialCloseStrategy;
  actionKey: string;
  createdAt: number;
  preLocalQty: number;
  preExchangeQty: number;
  requestedQty: number;
  submittedQty: number;
  qtyStep: number;
  allocation: PartialCloseAllocation;
  appliedQty: number;
  appliedExecNotional: number;
  lastObservedStatus: string;
  lastCheckedAt: number;
  desiredPostCommit: PartialCloseDesiredPostCommit;
};

export type AllocationSlice = {
  positionId: string;
  closeQty: number;
};

const EPS = 1e-9;

function clampQty(qty: number, max: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.max(0, Math.min(qty, max));
}

function roundTiny(value: number): number {
  return Math.abs(value) <= EPS ? 0 : value;
}

export function totalPositionQty(positions: LadderPosition[]): number {
  return positions.reduce((sum, pos) => sum + pos.qty, 0);
}

export function buildSelectedIdsAllocation(
  positions: LadderPosition[],
  positionIds: string[],
): SelectedIdsAllocation {
  const byId = new Map(positions.map(pos => [pos.id, pos]));
  const targets = positionIds.map(positionId => {
    const pos = byId.get(positionId);
    if (!pos) throw new Error(`selected_ids allocation target not found: ${positionId}`);
    return {
      positionId,
      preQty: pos.qty,
      preNotional: pos.notional,
    };
  });
  return { mode: "selected_ids", targets };
}

export function buildProRataAllocation(positions: LadderPosition[]): ProRataAllocation {
  const targets = positions.map(pos => ({
    positionId: pos.id,
    preQty: pos.qty,
    preNotional: pos.notional,
  }));
  return {
    mode: "pro_rata",
    targets,
    preTotalQty: targets.reduce((sum, target) => sum + target.preQty, 0),
  };
}

export function allocatedForCumulative(
  allocation: PartialCloseAllocation,
  cumulativeQty: number,
): AllocationSlice[] {
  const totalAvailable = allocation.targets.reduce((sum, target) => sum + target.preQty, 0);
  const targetQty = clampQty(cumulativeQty, totalAvailable);

  if (allocation.mode === "selected_ids") {
    let remaining = targetQty;
    return allocation.targets.map(target => {
      const closeQty = clampQty(remaining, target.preQty);
      remaining -= closeQty;
      return { positionId: target.positionId, closeQty: roundTiny(closeQty) };
    }).filter(slice => slice.closeQty > 0);
  }

  if (allocation.preTotalQty <= 0 || targetQty <= 0) return [];
  const slices: AllocationSlice[] = [];
  let allocated = 0;
  let lastPositiveIdx = -1;

  for (let i = 0; i < allocation.targets.length; i++) {
    const target = allocation.targets[i];
    if (target.preQty > 0) lastPositiveIdx = i;
    const proportional = clampQty(targetQty * target.preQty / allocation.preTotalQty, target.preQty);
    allocated += proportional;
    slices.push({ positionId: target.positionId, closeQty: proportional });
  }

  const residual = targetQty - allocated;
  if (lastPositiveIdx >= 0 && Math.abs(residual) > EPS) {
    const target = allocation.targets[lastPositiveIdx];
    const next = clampQty(slices[lastPositiveIdx].closeQty + residual, target.preQty);
    slices[lastPositiveIdx] = { ...slices[lastPositiveIdx], closeQty: next };
  }

  return slices
    .map(slice => ({ ...slice, closeQty: roundTiny(slice.closeQty) }))
    .filter(slice => slice.closeQty > 0);
}

export function allocationDeltaForCumulative(
  allocation: PartialCloseAllocation,
  previousCumulativeQty: number,
  nextCumulativeQty: number,
): AllocationSlice[] {
  const previous = new Map(
    allocatedForCumulative(allocation, previousCumulativeQty)
      .map(slice => [slice.positionId, slice.closeQty]),
  );
  return allocatedForCumulative(allocation, nextCumulativeQty)
    .map(slice => ({
      positionId: slice.positionId,
      closeQty: roundTiny(slice.closeQty - (previous.get(slice.positionId) ?? 0)),
    }))
    .filter(slice => slice.closeQty > 0);
}

export function intentPreLocalQty(allocation: PartialCloseAllocation): number {
  return allocation.targets.reduce((sum, target) => sum + target.preQty, 0);
}
