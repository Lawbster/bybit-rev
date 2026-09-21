import fs from "fs";
import os from "os";
import path from "path";
import assert from "assert/strict";
import { canonical, createPlan, executePlan, inside, jobDirectory, type StudyCard } from "./research-workflow";
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "research-workflow-"));
  fs.mkdirSync(path.join(root, "data")); fs.mkdirSync(path.join(root, "scripts"));
  fs.writeFileSync(path.join(root, "data/input.json"), "[1]");
  fs.writeFileSync(path.join(root, "scripts/worker.ts"), "fixture");
  fs.writeFileSync(path.join(root, "state.json"), "protected");
  const card: StudyCard = { version: 1, id: "test-study", kind: "relative-reversion-v1", inputs: ["data/input.json"], definition: { fixture: 1 } };
  const make = () => createPlan(root, card, ["scripts/worker.ts"], ["state.json"]);
  assert.equal(canonical({ a: 1, b: [2, 3] }), canonical({ b: [2, 3], a: 1 }));
  assert.throws(() => canonical({ invalid: NaN })); assert.throws(() => inside(root, "../outside"));
  assert.throws(() => inside(root, "data/../../outside"));
  await assert.rejects(createPlan(root, { ...card, inputs: [".env"] }, [], []));
  await assert.rejects(createPlan(root, { ...card, kind: "shell" as any }, [], []));
  const p = await make(), duplicate = await make(); assert.equal(p.key, duplicate.key);
  const renamed = await createPlan(root, { ...card, id: "renamed-same-study" }, ["scripts/worker.ts"], ["state.json"]);
  assert.equal(p.key, renamed.key);
  const anotherWindow = await createPlan(root, { ...card, definition: { ...card.definition, cutoff: "2030-01-01T00:00:00Z" } }, ["scripts/worker.ts"], ["state.json"]);
  assert.equal(p.definitionId, anotherWindow.definitionId); assert.notEqual(p.key, anotherWindow.key);
  let calls = 0;
  await executePlan(root, p.key, async (_, out) => { calls++; fs.writeFileSync(path.join(out, "result.json"), "{}"); });
  const status = (key: string) => JSON.parse(fs.readFileSync(path.join(jobDirectory(root, key), "state.json"), "utf8"));
  assert.equal(status(p.key).status, "complete"); assert.equal(status(p.key).economicQualification, "not_evaluated");
  await assert.rejects(executePlan(root, p.key, async () => { calls++; })); assert.equal(calls, 1);
  card.definition = { fixture: 2 };
  const p2 = await make(); assert.notEqual(p2.key, p.key); assert.notEqual(p2.definitionId, p.definitionId);
  await assert.rejects(executePlan(root, p2.key, async (_, out) => {
    fs.writeFileSync(path.join(out, "partial.json"), "{}"); throw Error("simulated crash");
  }), /simulated crash/);
  assert.equal(status(p2.key).status, "failed"); assert(fs.existsSync(path.join(jobDirectory(root, p2.key), "output/partial.json")));
  await assert.rejects(executePlan(root, p2.key, async () => {}));
  card.definition = { fixture: 3 }; const p3 = await make();
  fs.writeFileSync(path.join(root, "data/input.json"), "[2]");
  await assert.rejects(executePlan(root, p3.key, async () => { calls++; }), /Pinned file changed/); assert.equal(calls, 1);
  const changedInput = await make(); assert.notEqual(changedInput.key, p3.key); assert.equal(changedInput.definitionId, p3.definitionId);
  await assert.rejects(executePlan(root, changedInput.key, async (_, out) => {
    fs.writeFileSync(path.join(out, "result.json"), "{}"); fs.writeFileSync(path.join(root, "state.json"), "changed");
  }), /Pinned file changed/); assert.equal(status(changedInput.key).status, "failed");
  card.definition = { fixture: 4 }; const p4 = await make();
  let release!: () => void; const held = new Promise<void>(r => { release = r; });
  const first = executePlan(root, p4.key, async (_, out) => { await held; fs.writeFileSync(path.join(out, "result.json"), "{}"); });
  await assert.rejects(executePlan(root, p4.key, async () => { calls++; })); release(); await first;
  assert.equal(calls, 1); assert.equal(status(p4.key).status, "complete");
  card.definition = { fixture: 5 }; const p5 = await make();
  fs.mkdirSync(path.join(jobDirectory(root, p5.key), "run-claimed")); // hard-kill residue
  await assert.rejects(executePlan(root, p5.key, async () => { calls++; })); assert.equal(calls, 1);
  console.log("research workflow tests passed: dedup, pinning, mutation, failure, incomplete kill, concurrent claim; no job auto-promotes");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
