import fs from "fs";
import path from "path";

/** Retirement suppresses only the old short trio, never collectors or other owners.
 * Saved flat evidence is intentionally allowed to age after shutdown. This is not
 * an exchange query: retirement requires an operator's fresh exchange preflight.
 */
export function readHlShortRetirement(root: string, symbol: string): { retired: boolean; error?: string } {
  const configFile = path.join(root, "hl-short-live-config.json");
  if (symbol !== "HYPEUSDT" || !fs.existsSync(configFile)) return { retired: false };
  try {
    const c = JSON.parse(fs.readFileSync(configFile, "utf8"));
    if (c.retired === undefined || c.retired === false) return { retired: false };
    if (c.retired !== true || c.symbol !== symbol || c.enabled !== false || c.entryEnabled !== false) {
      throw new Error("retirement requires both execution and entries disabled");
    }
    if (typeof c.stateFile !== "string" || typeof c.healthFile !== "string") throw new Error("retirement evidence paths missing");
    const s = JSON.parse(fs.readFileSync(path.resolve(root, c.stateFile), "utf8"));
    if (s.version !== 1 || s.symbol !== symbol || s.position !== null || s.pending !== null
      || s.recoveryMode !== false || s.recoveryReason !== null || s.lastExchangeQty !== 0
      || !Number.isFinite(s.lastReconcileAt) || s.lastReconcileAt <= 0) {
      throw new Error("retired short state is not confirmed flat and clear");
    }
    const h = JSON.parse(fs.readFileSync(path.resolve(root, c.healthFile), "utf8"));
    if (h.version !== 1 || h.symbol !== symbol || h.executionOwner !== true
      || h.position?.active !== false || h.position?.qty !== 0 || h.pending?.active !== false
      || h.recovery?.active !== false || h.reconciliation?.exchangeQty !== 0
      || !Number.isFinite(h.reconciliation?.lastAt) || h.reconciliation.lastAt <= 0) {
      throw new Error("retired short health is not confirmed flat and clear");
    }
    return { retired: true };
  } catch {
    // Fail visible and keep normal monitoring; never swallow a malformed opt-out.
    return { retired: false, error: "Retirement config/evidence invalid: require disabled flags and preserved flat, clear state and health." };
  }
}
