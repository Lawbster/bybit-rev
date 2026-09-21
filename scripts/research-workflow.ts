/** Local, explicit one-shot research jobs. No scheduler, subprocesses or trading imports. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";

export const sha = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
export function canonical(x: any): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(",")}]`;
  if (x && typeof x === "object") return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(",")}}`;
  assert(x !== undefined && (typeof x !== "number" || Number.isFinite(x)), "Non-JSON value");
  return JSON.stringify(x);
}
export async function fileHash(file: string): Promise<string> {
  const h = crypto.createHash("sha256");
  for await (const b of fs.createReadStream(file)) h.update(b);
  return h.digest("hex");
}
export function inside(root: string, relative: string): string {
  assert(relative && !path.isAbsolute(relative) && !relative.includes("\\"), "Use relative forward-slash paths");
  const resolved = path.resolve(root, relative), rel = path.relative(path.resolve(root), resolved);
  assert(rel && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel), "Path outside root");
  // Inspect existing ancestors too: an in-tree junction must not escape the workspace.
  let existing = resolved;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const realRoot = fs.realpathSync(root), real = fs.realpathSync(existing), realRel = path.relative(realRoot, real);
  assert(!realRel.startsWith(`..${path.sep}`) && realRel !== ".." && !path.isAbsolute(realRel), "Symlink outside root");
  return resolved;
}
export function atomicJson(file: string, x: unknown): void {
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const fd = fs.openSync(temp, "wx");
  try { fs.writeFileSync(fd, JSON.stringify(x, null, 2) + "\n"); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
export interface StudyCard {
  version: 1; id: string; kind: "relative-reversion-v1" | "frozen-soft-stale-scorecard-v1" | "market-proxy-comparison-v1" | "recovery-construction-v1" | "near-high-ladder-v1" | "near-high-extension-v1" | "ladder-combination-v1";
  inputs: string[]; definition: Record<string, any>;
}
export interface Pin { file: string; bytes: number; sha256: string }
export interface Plan {
  version: 1; id: string; key: string; definitionId: string; createdAt: string;
  card: StudyCard; pins: Pin[]; protectedPins: Pin[]; runtime: { node: string; platform: string; arch: string };
}
export function definitionIdentity(card: StudyCard): string {
  // Dataset/period/archive changes create new runs of the SAME feature definitions.
  const { start: _start, cutoff: _cutoff, repair: _repair, landmarks: _landmarks,
    acceptedResults: _accepted, archive: _archive, ...parameters } = card.definition;
  return sha(canonical({ kind: card.kind, parameters }));
}
function planIdentity(card: StudyCard, definitionId: string, pins: Pin[], runtime: Plan["runtime"]): string {
  return sha(canonical({ version: 1, definitionId, definition: card.definition, pins, runtime }));
}
export function validateCard(card: StudyCard): void {
  assert.equal(card.version, 1); assert(["relative-reversion-v1", "frozen-soft-stale-scorecard-v1", "market-proxy-comparison-v1", "recovery-construction-v1", "near-high-ladder-v1", "near-high-extension-v1", "ladder-combination-v1"].includes(card.kind));
  assert(/^[a-z0-9][a-z0-9-]{2,90}$/.test(card.id));
  assert(card.definition && typeof card.definition === "object" && !Array.isArray(card.definition));
  assert(Array.isArray(card.inputs) && card.inputs.length > 0 && new Set(card.inputs).size === card.inputs.length);
  for (const p of card.inputs) assert(/^(data\/|backtests\/|research-inputs\/|bot-config\.json$)/.test(p)
    && !p.split("/").some(s => s.startsWith(".")), "Unapproved input path");
}
async function pin(root: string, file: string): Promise<Pin> {
  const p = inside(root, file), a = fs.statSync(p); assert(a.isFile(), file);
  const hash = await fileHash(p), b = fs.statSync(p);
  assert(a.size === b.size && a.mtimeMs === b.mtimeMs, `Input changed while hashing: ${file}`);
  return { file, bytes: b.size, sha256: hash };
}
export async function verifyPins(root: string, pins: Pin[]): Promise<void> {
  for (const p of pins) assert.deepEqual(await pin(root, p.file), p, `Pinned file changed: ${p.file}`);
}
export function jobDirectory(root: string, key: string): string {
  assert(/^[a-f0-9]{64}$/.test(key), "Full 64-character job key required");
  return inside(root, `backtests/research-workflow/${key}`);
}
export async function createPlan(root: string, card: StudyCard, sources: string[], protectedFiles: string[]): Promise<Plan> {
  validateCard(card);
  const pins: Pin[] = [], protectedPins: Pin[] = [];
  for (const f of [...new Set([...card.inputs, ...sources])].sort()) pins.push(await pin(root, f));
  for (const f of [...new Set(protectedFiles)].sort()) protectedPins.push(await pin(root, f));
  const definitionId = definitionIdentity(card);
  // Titles and creation times do not turn the same specification into another experiment.
  const runtime = { node: process.version, platform: process.platform, arch: process.arch };
  const key = planIdentity(card, definitionId, pins, runtime);
  const plan: Plan = { version: 1, id: card.id, key, definitionId, createdAt: new Date().toISOString(), card, pins, protectedPins, runtime };
  const dir = jobDirectory(root, key); fs.mkdirSync(path.dirname(dir), { recursive: true });
  try { fs.mkdirSync(dir); }
  catch (e: any) {
    if (e.code !== "EEXIST") throw e;
    assert(fs.existsSync(path.join(dir, "plan.json")), "Incomplete plan directory; inspect, do not overwrite");
    const previous = JSON.parse(fs.readFileSync(path.join(dir, "plan.json"), "utf8"));
    assert.equal(previous.key, key); return previous;
  }
  atomicJson(path.join(dir, "plan.json"), plan);
  atomicJson(path.join(dir, "state.json"), { status: "planned", key, definitionId, economicQualification: "not_evaluated" });
  return plan;
}
export async function executePlan(root: string, key: string,
  worker: (plan: Plan, output: string) => Promise<void>): Promise<void> {
  const dir = jobDirectory(root, key), plan: Plan = JSON.parse(fs.readFileSync(path.join(dir, "plan.json"), "utf8"));
  validateCard(plan.card);
  assert.equal(plan.key, key);
  assert.equal(plan.definitionId, definitionIdentity(plan.card));
  assert.equal(key, planIdentity(plan.card, plan.definitionId, plan.pins, plan.runtime));
  assert.deepEqual(plan.runtime, { node: process.version, platform: process.platform, arch: process.arch }, "Runtime changed since plan");
  // An exclusive directory also survives a hard kill. Never automatically steal it.
  fs.mkdirSync(path.join(dir, "run-claimed"));
  const set = (status: string, extra = {}) => atomicJson(path.join(dir, "state.json"), {
    status, key, definitionId: plan.definitionId, pid: process.pid, at: new Date().toISOString(),
    economicQualification: "not_evaluated", liveChanges: 0, ...extra });
  try {
    const state = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
    assert.equal(state.status, "planned"); set("running");
    await verifyPins(root, [...plan.pins, ...plan.protectedPins]);
    const output = path.join(dir, "output"); fs.mkdirSync(output);
    await worker(plan, output);
    await verifyPins(root, [...plan.pins, ...plan.protectedPins]);
    const artifacts: Pin[] = [];
    for (const file of fs.readdirSync(output).sort()) {
      assert(fs.statSync(path.join(output, file)).isFile(), "Only flat output artifacts supported");
      artifacts.push(await pin(root, path.relative(root, path.join(output, file)).split(path.sep).join("/")));
    }
    assert(artifacts.length > 0, "Empty output cannot complete");
    set("complete", { artifacts });
  } catch (e: any) { set("failed", { error: String(e?.message ?? e) }); throw e; }
}
