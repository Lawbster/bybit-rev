/** Study-only mechanical delta. Canonical/live execution code is never edited. */
import fs from "fs";
import assert from "assert/strict";
import crypto from "crypto";
export const derivedFile = "scripts/aggressive10-release-maker-engine.ts";
const edits: Array<[string, string]> = [
  ["/** Current long policy, causal minute execution. Not an exchange/maker simulator. */",
    "/** Generated study-only maker SCENARIOS. Verify with aggressive10-release-maker-source.ts. Not queue-certified. */"],
  ["export interface CausalRunOptions {", `export interface CausalRunOptions {
  makerExecution?: { share: number; makerFee: number; marketFee: number; tick: number };`],
  ["export type ExecutionEvent = { kind: string;", "export type ExecutionEvent = { exitFeeRate?: number; executionMode?: string; kind: string;"],
  ["  const config: BotConfig = structuredClone(liveConfig);", `  const config: BotConfig = structuredClone(liveConfig);
  const maker = opts.makerExecution;
  if (maker && (!Number.isFinite(maker.share) || maker.share < 0 || maker.share > 1 || !(maker.tick > 0)
    || ![maker.tick, maker.makerFee, maker.marketFee].every(Number.isFinite)
    || maker.makerFee < 0 || maker.marketFee < 0 || maker.marketFee !== config.feeRate
    || params.tpExecutionModel !== "resting_touch")) throw new Error("Invalid frozen maker scenario");`],
  ["target: { price: number; pct: number; at: number; index: number }", "target: { price: number; rawPrice?: number; postable?: boolean; pct: number; at: number; index: number }"],
  ["const pnl = (xs: LadderPosition[], price: number) => xs.reduce((v, p) => v + (price - p.entryPrice) * p.qty - config.feeRate * (p.notional + price * p.qty), 0);",
    "const pnl = (xs: LadderPosition[], price: number, exitFee = config.feeRate) => xs.reduce((v, p) => v + (price - p.entryPrice) * p.qty - (maker ? config.feeRate * p.notional + exitFee * price * p.qty : config.feeRate * (p.notional + price * p.qty)), 0);"],
  ["    if (!txn.target || txn.target.price !== tpPrice || txn.target.pct !== pct) txn.target = { price: tpPrice, pct, at, index };", `    if (maker) {
      const limit = Number((Math.ceil(tpPrice / maker.tick - 1e-9) * maker.tick).toFixed(12));
      // Closed-price postability is only an explicit proxy for the unavailable exact bid.
      if (!txn.target || txn.target.rawPrice !== tpPrice || txn.target.pct !== pct)
        txn.target = { price: limit, rawPrice: tpPrice, postable: price < limit, pct, at, index };
    } else if (!txn.target || txn.target.price !== tpPrice || txn.target.pct !== pct) txn.target = { price: tpPrice, pct, at, index };`],
  ["function close(price: number, at: number, index: number, intent: Pending) {", "function close(price: number, at: number, index: number, intent: Pending, exitFee = config.feeRate) {"],
  ["net = pnl(before, price), entry = avg();", "net = pnl(before, price, exitFee), entry = avg();"],
  ["executions.push({ kind: \"close\", decisionAt: intent.decisionAt", "executions.push({ ...(maker ? { exitFeeRate: exitFee, executionMode: exitFee === maker.makerFee ? \"maker\" : \"market\" } : {}), kind: \"close\", decisionAt: intent.decisionAt"],
  ["if (positions.length && txn.target && txn.target.at <= c.ts", "if (positions.length && txn.target && (!maker || !txn.pending && txn.target.postable) && txn.target.at <= c.ts"],
  [`      close(txn.target.price, now, i, { kind: "close", decisionAt: txn.target.at, decisionIndex: txn.target.index, reason: txn.target.pct < config.tpPct ? "stale_tp" : "tp", rsi: i > 0 ? s.rsi1H[i - 1] : null });
      closedThisBar = true;`, `      const target = txn.target;
      const intent: Pending = { kind: "close", decisionAt: target.at, decisionIndex: target.index,
        reason: target.pct < config.tpPct ? "stale_tp" : "tp", rsi: i > 0 ? s.rsi1H[i - 1] : null };
      if (!maker || maker.share === 1) {
        close(target.price, now, i, intent, maker?.makerFee ?? config.feeRate); closedThisBar = true;
      } else {
        if (maker.share > 0) {
          const before = copyInventory(), preQty = positions.reduce((n, p) => n + p.qty, 0);
          const selected = positions.map(p => ({ ...p, qty: p.qty * maker.share, notional: p.notional * maker.share }));
          const qty = selected.reduce((n, p) => n + p.qty, 0), net = pnl(selected, target.price, maker.makerFee);
          realized += net; trimPnl += net; trimCount++;
          trims.push({ variant: params.id, episode, ts: now, iso: new Date(now).toISOString(), price: target.price,
            closedShare: qty / preQty, pnl: net, depth: positions.length });
          executions.push({ kind: "partial", decisionAt: target.at, fillAt: now, decisionIndex: target.index,
            fillIndex: i, price: target.price, qty, reason: "maker_tp_prefix", exitFeeRate: maker.makerFee, executionMode: "maker" });
          positions = positions.map(p => ({ ...p, qty: p.qty * (1 - maker.share), notional: p.notional * (1 - maker.share) }));
          // Prefix reduction keeps inventory identity and the actual add clock; never a strategy trim.
          observeInventory(before);
        }
        // We cannot recover touch+2s. Fixed next-minute open, including adverse reversals.
        txn.pending = { ...intent, decisionAt: now, decisionIndex: i }; txn.target = null;
      }`],
  ["    if (positions.length) {\n      minPnlPct", "    if (positions.length && (!maker || !txn.pending)) {\n      minPnlPct"],
  ["if (txn.target && c.close >= txn.target.price) schedule", "if (txn.target && c.close >= (txn.target.rawPrice ?? txn.target.price)) schedule"],
];
export function expectedMakerSource() {
  return edits.reduce((s, [from, to]) => {
    assert.equal(s.split(from).length, 2, `Nonunique source boundary: ${from.slice(0, 90)}`); return s.replace(from, to);
  }, fs.readFileSync("scripts/replay-causal-engine.ts", "utf8").replace(/\r\n/g, "\n"));
}
export function verifyMakerSource() {
  const expected = expectedMakerSource(), actual = fs.readFileSync(derivedFile, "utf8").replace(/\r\n/g, "\n");
  assert.equal(actual, expected, "Unapproved maker study source delta");
  return { exactDelta: true, sha256: crypto.createHash("sha256").update(expected).digest("hex"), modifications: edits.length };
}
if (require.main === module) process.stdout.write(`*** Begin Patch\n*** Add File: ${derivedFile}\n${expectedMakerSource().trimEnd().split("\n").map(s => `+${s}`).join("\n")}\n*** End Patch`);
