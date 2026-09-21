/** H01: bounded research on pinned H00 evidence. Never changes live code/state. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { loadCandles1m } from "./hype-freerun-canonical-replay";
import { prepareFeatures } from "./indicator-entry-context-features";
import { refinementGate } from "./indicator-refinement-policy";
import { DelayedContext, pulseGate, combinedGate, replay, key } from "./indicator-hl-sr-filter-policy";
import { pathDiagnostics, attribution } from "./indicator-combination-analysis";
import { evidence, type Evidence, type Row, M, H } from "./indicator-hl-sr-context";
const ROOT = path.resolve(__dirname, ".."), CARD = "research-inputs/indicators/context-filters-h01-2026-09-08.json";
const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), "utf8"));
async function sha(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(path.resolve(ROOT, file))) h.update(b); return h.digest("hex"); }
async function rawLines(file: string) { const out: Row[] = []; for await (const s of readline.createInterface({ input: fs.createReadStream(path.resolve(ROOT, file)), crlfDelay: Infinity })) if (s.trim()) out.push(JSON.parse(s)); return out; }
const near = (a: any, b: any) => a == null || b == null ? assert(a == null && b == null) : assert(Math.abs(a - b) < 1e-8);

async function main() {
  assert(process.argv.length === 4 && process.argv[2] === "--out"); const out = path.resolve(ROOT, process.argv[3]);
  const relative = path.relative(path.join(ROOT, "backtests"), out); assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && !fs.existsSync(out));
  const spec = read(CARD), hd = spec.h00Directory, hm = read(hd + "/manifest.json"), hv = read(hd + "/verification.json");
  assert.equal(await sha(hd + "/manifest.json"), spec.h00ManifestSha256); assert.equal(await sha(hd + "/verification.json"), spec.h00VerificationSha256); assert(hv.passed);
  const pins = new Map<string, string>();
  for (const p of [...hm.sources, ...hm.priceInputs, ...hm.sourceInputs]) { assert.equal(await sha(p.file), p.sha256, p.file); pins.set(p.file, p.sha256); }
  for (const p of hv.artifacts) { const f = hd + "/" + p.file; assert.equal(await sha(f), p.sha256, f); pins.set(f, p.sha256); }
  pins.set(hd + "/verification.json", await sha(hd + "/verification.json"));
  for (const f of [CARD, "scripts/indicator-hl-sr-filter-policy.ts", "scripts/indicator-hl-sr-filter-tests.ts", "scripts/hype-indicator-hl-sr-filter-study.ts", "scripts/indicator-hl-sr-filter-check.ts"])
    pins.set(f, await sha(f));
  const protectedPins = await Promise.all(hm.protectedPins.map(async (p: Row) => ({ file: p.file, sha256: await sha(p.file) })));
  const old: Row[] = read(hd + "/opportunities.json"), baselines: Row[] = read(hd + "/baseline.json");
  const records = await rawLines(hd + "/evidence/source-rows.jsonl") as Evidence[];
  records.forEach(r => assert.deepEqual(evidence(r.kind, r.raw, r.file, r.line), r));
  const seed = Date.parse(spec.indicatorSeedBarStart), start = Date.parse(spec.start), end = Date.parse(spec.end), r01 = hm.spec.r01Directory;
  const cs = (await loadCandles1m(spec.symbol, path.resolve(ROOT, r01, "inputs"), end, path.resolve(ROOT, r01, "inputs/repair.json"))).filter(c => c.ts >= seed);
  assert.equal(cs.length, spec.expectedMinuteRows); cs.forEach((c, i) => assert.equal(c.ts, seed + i * M));
  const minutes = cs.map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  const f = prepareFeatures(minutes), rm = read(r01 + "/manifest.json"), rule = rm.rules.find((r: Row) => r.id === spec.baselines[0]);
  const opportunities = f.opportunities(rule); assert.deepEqual(opportunities.filter(s => s.at >= start && s.at < end).map(s => s.at), old.map(r => r.at));
  const cmf = new Map(f.rows({ family: "cmf", period: 20, timeframeMs: H }).map(b => [b.barEnd, b]));
  const baseGate = (id: string, t: number) => id === spec.baselines[0] ? null : refinementGate({ id, family: "cmf", timeframeMs: H, threshold: id === "C02-32" ? 0 : -.05 }, t, cmf);
  const options = (delayMs: number) => ({ start, end, delayMs, holdMs: spec.holdMs, notional: spec.notionalUsdt, equity: spec.initialEquity, feeRate: spec.feeRatePerSide });
  const parity: Row[] = [], baselineRuns = new Map<string, any>();
  for (const id of spec.baselines) for (const delayMs of spec.executionDelaysMs) {
    const run = replay(minutes, opportunities, options(delayMs), id === spec.baselines[0] ? undefined : t => baseGate(id, t)!);
    const archived = baselines.find(r => r.id === id && r.window === "recent" && r.delayMs === delayMs)!;
    for (const [k, v] of Object.entries(run.stats)) assert.deepEqual(v, archived[k], `${id} ${k}`);
    assert.deepEqual(run.decisions.map(d => [d.at, d.outcome, d.acceptedEntryAt]), old.flatMap(r => r.baselineDecisions).filter(r => r.id === id && r.delayMs === delayMs).map(d => [d.at, d.outcome, d.acceptedEntryAt]));
    assert.deepEqual(JSON.parse(JSON.stringify(run.trades)), old.flatMap(r => r.baselineTrades).filter(r => r.id === id && r.delayMs === delayMs).map(({ id, window, delayMs, ...t }) => t));
    parity.push({ id, delayMs, exact: true, net: run.stats.net }); baselineRuns.set(`${id}|${delayMs}`, run);
  }
  console.log("[H01] Six baseline paths exactly match accepted R01/H00");
  const tape = new DelayedContext(records, hm.spec.quality), contexts = new Map<string, Row>(), prefixChecks: Row[] = [];
  for (const lag of spec.extraArrivalDelaysMs) for (const r of old) for (const at of [r.at - 15 * M, r.at]) {
    const snap = tape.snapshot(at, lag); contexts.set(`${lag}|${at}`, snap);
    if (lag === 0) { const x = at === r.at ? r.context : r.contextMinus15;
      for (const [a, b] of [[snap.flow.ratio, x.flow15.ratio], [snap.flow.samples, x.flow15.samples], [snap.flow.ageSec, x.flow15.ageSec], [snap.book.imbalance, x.book.imbalance05], [snap.oi.nativeChange, x.asset.changes[0].nativeOiChangePct]]) near(a, b);
      assert.equal(snap.flow.ready, x.flow15.healthy); assert.equal(snap.book.ready, x.book.healthy); assert.equal(snap.oi.ready, x.asset.changes[0].healthy);
    }
    if ([old[0].at, old[6].at, old.at(-1)!.at].includes(at)) {
      assert.deepEqual(new DelayedContext(records.filter(x => x.availableAt + lag <= at), hm.spec.quality).snapshot(at, lag), snap);
      prefixChecks.push({ at, arrivalDelayMs: lag, exact: true });
    }
  }
  const definitions: Row[] = spec.conditions.flatMap((c: Row) => [
    { ...c, baseId: "R01-08", role: "primary" }, { ...c, id: c.id + spec.controlSuffix, baseId: spec.baselines[0], role: "interaction_control" }]);
  const gateAt = (def: Row, t: number, lag: number, readyOnly: boolean) => {
    const row = old.find(r => r.at === t); assert(row);
    const pulse = pulseGate(def.family, contexts.get(`${lag}|${t}`)!, contexts.get(`${lag}|${t - 15 * M}`)!, row);
    return combinedGate((readyOnly ? "ready_" : "") + def.id, t, baseGate(def.baseId, t), pulse, readyOnly);
  };
  fs.mkdirSync(out, { recursive: true }); const json = (name: string, obj: any) => fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(obj, null, 2) + "\n", { flag: "wx" });
  const results: Row[] = [], monthly: Row[] = [], trades: Row[] = [], decisions: Row[] = [], cache = new Map<string, any>();
  const save = (meta: Row, run: any) => {
    const row = { ...meta, window: "recent", start: spec.start, end: spec.end, side: "short", ...run.stats, open: run.open,
      blockedMissing: run.blockedMissing, blockedCondition: run.blockedCondition, stressNet: run.stats.net - run.stats.turnoverIncludingMarkedExit * spec.extraFixedPathCostBpsPerSide / 10000 };
    results.push(row); cache.set(key(row), run); monthly.push(...run.monthly.map((m: Row) => ({ id: row.id, delayMs: row.delayMs, arrivalDelayMs: row.arrivalDelayMs, ...m })));
    for (const [target, rows] of [[trades, run.trades], [decisions, run.decisions]] as [Row[], Row[]][]) target.push(...rows.map(r => ({ id: row.id, delayMs: row.delayMs, arrivalDelayMs: row.arrivalDelayMs, ...r })));
    return row;
  };
  for (const arrivalDelayMs of spec.extraArrivalDelaysMs) for (const delayMs of spec.executionDelaysMs) {
    for (const id of spec.baselines) save({ id, kind: "baseline", arrivalDelayMs, delayMs }, baselineRuns.get(`${id}|${delayMs}`));
    for (const def of definitions) for (const readyOnly of [false, true]) save({ ...def, id: (readyOnly ? "ready_" : "") + def.id,
      kind: readyOnly ? "readiness" : "variant", arrivalDelayMs, delayMs }, replay(minutes, opportunities, options(delayMs), t => gateAt(def, t, arrivalDelayMs, readyOnly)));
    console.log(`[H01] Completed arrival +${arrivalDelayMs / 1000}s / fill +${delayMs / M}m`);
  }
  assert.equal(results.length, spec.counts.totalLogicalCases);
  const rows = new Map(results.map(r => [key(r), r])), ms = new Map(monthly.map(m => [key(m) + "|" + m.month, m]));
  const attrs: Row[] = [], diagnostics: Row[] = [];
  for (const r of results.filter(r => r.kind === "variant")) {
    const base = rows.get(key({ ...r, id: r.baseId }))!, ready = rows.get(key({ ...r, id: "ready_" + r.id }))!;
    r.deltaBase = r.net - base.net; r.deltaReadiness = r.net - ready.net;
    r.deltaUnfiltered = r.net - rows.get(key({ ...r, id: spec.baselines[0] }))!.net;
    r.deltaOldCmf = r.net - rows.get(key({ ...r, id: "C02-32" }))!.net;
    const run = cache.get(key(r));
    attrs.push({ id: r.id, delayMs: r.delayMs, arrivalDelayMs: r.arrivalDelayMs,
      base: attribution(cache.get(key(base)).trades, run.trades, run.decisions), readiness: attribution(cache.get(key(ready)).trades, run.trades, run.decisions) });
    diagnostics.push({ id: r.id, delayMs: r.delayMs, arrivalDelayMs: r.arrivalDelayMs, ...pathDiagnostics(minutes, r, run.trades, spec),
      scaledReadiness: ready.exposureHours > 0 ? pathDiagnostics(minutes, ready, cache.get(key(ready)).trades, spec, r.exposureHours / ready.exposureHours) : null });
    for (const m of monthly.filter(m => key(m) === key(r))) for (const [label, id] of [["deltaBase", r.baseId], ["deltaReadiness", "ready_" + r.id], ["deltaUnfiltered", spec.baselines[0]]])
      m[label] = m.markedNet - ms.get(key({ ...m, id }) + "|" + m.month)!.markedNet;
  }
  const ranking: Row[] = [];
  for (const def of definitions) for (const arrivalDelayMs of spec.extraArrivalDelaysMs) {
    const rs = results.filter(r => r.id === def.id && r.arrivalDelayMs === arrivalDelayMs), mm = monthly.filter(m => m.id === def.id && m.arrivalDelayMs === arrivalDelayMs);
    const failures: string[] = []; const fail = (name: string, test: boolean) => { if (test) failures.push(name); };
    fail("insufficient_recent_trades", rs.some(r => r.trades < 10)); fail("nonpositive_net_or_cost_stress", rs.some(r => r.net <= 0 || r.stressNet <= 0));
    fail("equity_exhausted", rs.some(r => r.bankrupt)); fail("monthly_regression_over_320", mm.some(m => Math.min(m.deltaBase, m.deltaReadiness, m.deltaUnfiltered) < -320 - 1e-8));
    fail("increment_below_200", rs.some(r => Math.min(r.deltaBase, r.deltaReadiness) < 200 - 1e-8));
    fail("drawdown_worse_than_base_or_readiness", rs.some(r => [r.baseId, "ready_" + r.id].some(id => r.maxAdverseDrawdownPct > rows.get(key({ ...r, id }))!.maxAdverseDrawdownPct + 1e-8)));
    ranking.push({ ...def, arrivalDelayMs, minDeltaBase: Math.min(...rs.map(r => r.deltaBase)), minDeltaReadiness: Math.min(...rs.map(r => r.deltaReadiness)),
      worstMonthlyDelta: Math.min(...mm.flatMap(m => [m.deltaBase, m.deltaReadiness, m.deltaUnfiltered])), failures,
      recentExploratoryProfitPass: !failures.length, fullHistoryScreenEvaluated: false, deploymentCandidate: false });
  }
  for (const f of ["H01-04", "H01-04_no_cmf", "ready_H01-04", "ready_H01-04_no_cmf"]) for (const delayMs of spec.executionDelaysMs)
    for (const arrivalDelayMs of spec.extraArrivalDelaysMs) assert.deepEqual(cache.get(key({ id: f, delayMs, arrivalDelayMs })).trades, cache.get(key({ id: f, delayMs, arrivalDelayMs: 0 })).trades);
  for (const [name, obj] of Object.entries({ results, monthly, trades, decisions, contexts: [...contexts.values()], diagnostics,
    "trade-attribution": attrs, ranking, "baseline-parity": parity, "prefix-checks": prefixChecks })) json(name, obj);
  for (const [file, h] of pins) assert.equal(await sha(file), h, file); for (const p of protectedPins) assert.equal(await sha(p.file), p.sha256);
  json("manifest", { spec, cardFile: CARD, definitions, sources: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedPins, createdAt: new Date().toISOString(), node: process.version });
  json("validation", { passed: true, parityCases: 6, logicalCases: results.length, contextSnapshots: contexts.size, prefixChecks: prefixChecks.length, independentVerificationPending: true });
  console.log(JSON.stringify({ logicalCases: results.length, contextSnapshots: contexts.size, independentVerificationPending: true }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
