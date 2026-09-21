/** Local event-file diagnostic. No API, live-state writes or inferred fills. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { freshLadderCost } from "./ladder-sizing-policy";
const hash = (x: Buffer) => crypto.createHash("sha256").update(x).digest("hex");
const input = "data/HYPEUSDT_sr_partial_exit_actions.jsonl", configFile = "bot-config.json";
const before = fs.readFileSync(input), configBytes = fs.readFileSync(configFile), cfg = JSON.parse(configBytes.toString("utf8"));
const rows = before.toString("utf8").trim().split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x));
const ids = new Set<string>();
const events = rows.filter(x => x.event === "executed" && x.live === true && x.symbol === "HYPEUSDT").map(x => {
  assert(x.orderId && !ids.has(x.orderId), "duplicate/missing executed order ID"); ids.add(x.orderId);
  const candidates = rows.filter(c => c.event === "candidate" && c.live === true && c.symbol === x.symbol && c.reason === x.reason
    && c.timestamp <= x.timestamp && x.timestamp - c.timestamp <= 300000 && JSON.stringify(c.closeIndices) === JSON.stringify(x.closeIndices));
  const c = candidates.length === 1 ? candidates[0] : null;
  const complete = c && [x.filledQty, x.requestedQty, c.closeQty].every(Number.isFinite)
    && Math.abs(x.filledQty - x.requestedQty) < 1e-7 && Math.abs(x.filledQty - c.closeQty) < 1e-7
    && x.remainingRungs === c.ladder.depth - c.closeIndices.length && x.positionsClosed === c.closeIndices.length;
  const remainingCost = complete && Number.isFinite(c.ladder.totalNotional) && Number.isFinite(x.closeNotional)
    ? c.ladder.totalNotional - x.closeNotional : null;
  const fresh = remainingCost !== null ? freshLadderCost(x.remainingRungs, cfg.basePositionUsdt, cfg.addScaleFactor) : null;
  return { at: x.timestamp, iso: x.ts, orderId: x.orderId, completeSelectedFill: !!complete,
    uncertainReason: complete ? null : !c ? "candidate_not_unique" : "planned_filled_quantity_or_count_differs",
    preDepth: c?.ladder.depth ?? null, remainingRungs: x.remainingRungs, remainingEntryCostFromLog: remainingCost,
    freshSameCountCostAtCurrentConfig: fresh, excessVsFresh: fresh === null ? null : remainingCost! - fresh,
    realizedPartialPnl: x.realizedPnl, requestedQty: x.requestedQty, filledQty: x.filledQty };
});
const comparable = events.filter(x => x.remainingEntryCostFromLog !== null);
const result = { input, inputSha256: hash(before), configSha256: hash(configBytes),
  sourceSha256: hash(fs.readFileSync(__filename)), policySourceSha256: hash(fs.readFileSync("scripts/ladder-sizing-policy.ts")),
  window: { first: events[0]?.iso, last: events.at(-1)?.iso }, executed: events.length,
  completeComparable: comparable.length, incompleteOrUnmatched: events.length - comparable.length,
  inflatedVsFreshCount: comparable.filter(x => x.excessVsFresh! > 1).length,
  maximumRemainingCost: Math.max(...comparable.map(x => x.remainingEntryCostFromLog!)),
  events, caveat: "Reported event arithmetic, not independently queried exchange inventory. Incomplete fills excluded. Fresh-count comparator uses current 800/1.35, not a claim that every older config was identical. Partial profit is not full-episode profit; subsequent adds/outcomes are not reconstructed from this file." };
const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-ladder-live-exposure-audit-2026-09-05.json");
const rel = path.relative(path.resolve("backtests"), out);
assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out));
assert.equal(hash(fs.readFileSync(input)), result.inputSha256); assert.equal(hash(fs.readFileSync(configFile)), result.configSha256);
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result, events: undefined }));
