import assert from "assert/strict";
import fs from "fs";
import { CARD, validate, researchConfig } from "./aggressive10-early-window-study";
import { POLICIES } from "./age10-gate-policy";
import { rawHighs } from "./age-high-refinement-audit";
import { trailingHighIndices } from "./near-high-policy";
const d = JSON.parse(fs.readFileSync(CARD, "utf8")); validate(d);
for (const patch of [{ initialEquity: 21700 }, { newTradingDefinitions: 1 }, { start: "2025-03-01T00:00:00Z" }, { feeRate: .0002 }, { tpModels: ["resting_touch"] }]) assert.throws(() => validate({ ...d, ...patch }));
const current = JSON.parse(fs.readFileSync("bot-config.json", "utf8")), before = JSON.stringify(current);
for (const id of d.policies) {
  const p = POLICIES.find(x => x.id === id)!; const c = researchConfig(current, p);
  assert.equal(c.aggressive10, undefined); assert.equal(c.basePositionUsdt, 800); assert.equal(c.maxPositions, 11);
  assert.equal(c.deepAddStressGuard!.enabled, id !== "age10__minus_deep_stress__minus_tp_cooldown");
  assert.equal(c.tpCooldown!.enabled, id !== "age10__minus_deep_stress__minus_tp_cooldown");
  assert.equal(c.srPartialExitAction!.enabled, true); assert.equal(c.filters.trendBreak, true);
}
assert.equal(JSON.stringify(current), before);
const cs = Array.from({ length: 6000 }, (_, i) => ({ ts: i * 60000, endTs: (i + 1) * 60000, open: 10, close: 10, high: 11 + i % 17, low: 9, volume: 1, turnover: 10 }));
const h = rawHighs(cs, 2), j = trailingHighIndices(cs, 2880);
cs.forEach((_, i) => assert.equal(h[i], j[i] < 0 ? 0 : cs[j[i]].high));
const poisoned = cs.map((c, i) => i >= 4000 ? { ...c, high: 1e9 } : c), p = rawHighs(poisoned, 2);
for (let i = 0; i < 4000; i++) assert.equal(p[i], h[i]);
console.log("R1 frozen-card/config isolation/high-prefix tests passed");
