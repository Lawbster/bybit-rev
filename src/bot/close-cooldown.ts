/** Durable strategy consequence, independent of the current enable flag. */
interface HighRuleCooldownPolicy {
  kind: "aggressive10_high";
  requestedAt: number;
  decisionAt: number;
  referenceHigh: number;
  decisionPrice: number;
}

export interface TimeStopCooldownPolicy {
  kind: "weak_week_time_stop";
  requestedAt: number;
  decisionAt: number;
  decisionPrice: number;
  referenceAt: number;
  referencePrice: number;
}

/** Historical export name retained for durable transaction compatibility. */
export type HighExitCooldownPolicy = HighRuleCooldownPolicy | TimeStopCooldownPolicy;

export interface AppliedCloseCooldown {
  until: number;
  anchorAt: number;
  anchorSource: "execution" | "observation_fallback";
}

/** Validate before durable intent/submission, not first after a fill. */
export function validateHighExitCooldownPolicy(policy: HighExitCooldownPolicy | undefined): void {
  if (!policy) return;
  const validSource = policy.kind === "aggressive10_high"
    ? Number.isFinite(policy.referenceHigh) && policy.referenceHigh > 0
    : policy.kind === "weak_week_time_stop"
      && Number.isSafeInteger(policy.referenceAt)
      && policy.decisionAt - policy.referenceAt === 7 * 24 * 3_600_000
      && Number.isFinite(policy.referencePrice) && policy.referencePrice > 0;
  if (!validSource
    || !Number.isSafeInteger(policy.requestedAt) || policy.requestedAt <= 0
    || !Number.isSafeInteger(policy.decisionAt) || policy.decisionAt <= 0 || policy.decisionAt % 60_000 !== 0
    || policy.requestedAt < policy.decisionAt || policy.requestedAt - policy.decisionAt > 30_000
    || !Number.isFinite(policy.decisionPrice) || policy.decisionPrice <= 0) {
    throw new Error("invalid high-exit cooldown policy");
  }
}

export function highExitCooldown(
  policy: HighExitCooldownPolicy | undefined,
  lastExecTime: number | undefined,
  observedAt: number,
): AppliedCloseCooldown | undefined {
  if (!policy) return undefined;
  validateHighExitCooldownPolicy(policy);
  const exact = Number.isSafeInteger(lastExecTime) && lastExecTime! > 0 && lastExecTime! <= observedAt;
  // A native TP that completed BEFORE this request was not a high-rule exit.
  if (exact && lastExecTime! < policy.requestedAt) return undefined;
  const anchorAt = exact ? lastExecTime! : Math.max(observedAt, policy.requestedAt);
  const fourH = 4 * 3_600_000;
  return {
    until: (Math.floor(anchorAt / fourH) + 2) * fourH,
    anchorAt,
    anchorSource: exact ? "execution" : "observation_fallback",
  };
}
