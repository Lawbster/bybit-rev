/** F06 independent raw-bar features, target chronology, cash/fees and comparison audit. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, prices, fileHash } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { ReplaySrContext } from "./replay-sr-context";
import { auditSoftStalePath } from "./conditional-soft-stale-path-audit";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
type R = Record<string, any>;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function upper(xs: R[], key: string, at: number) { let a = 0, b = xs.length; while (a < b) { const m = (a + b) >>> 1; if (xs[m][key] <= at) a = m + 1; else b = m; } return a; }
export function inventoryAtDecision(events: ResearchInventoryEvent[], index: number) {
  let a = 0, b = events.length;
  while (a < b) { const m = (a + b) >>> 1; if (events[m].event.fillIndex! <= index) a = m + 1; else b = m; }
  return events[a - 1]?.after ?? [];
}
function referenceBars(cs: Candle[], interval: number) {
  const groups = new Map<number, Candle[]>(); for (const c of cs) { const t = Math.floor(c.ts / interval) * interval; const rows = groups.get(t) ?? []; rows.push(c); groups.set(t, rows); }
  return [...groups].filter(([t, rows]) => rows.length === interval / 60000 && rows.every((c, i) => c.ts === t + i * 60000)).map(([t, r]) => ({ ts: t, endTs: t + interval,
    close: r.at(-1)!.close, volume: r.reduce((n, c) => n + c.volume, 0), turnover: r.reduce((n, c) => n + c.turnover, 0) }));
}
function ema(p: number[], n: number) { if (p.length < n) return [];
  let v = p.slice(0, n).reduce((a, b) => a + b, 0) / n; const out = [v]; for (const x of p.slice(n)) { v += (x - v) * 2 / (n + 1); out.push(v); } return out; }
export function auditSources(cs: Candle[], tape: R) {
  const h4 = referenceBars(cs, 14400000), h1 = referenceBars(cs, 3600000);
  assert.equal(tape.structure.length, h4.length); assert.equal(tape.vwap.length, h1.length);
  for (let i = 0; i < h4.length; i++) {
    const x = tape.structure[i], rows = h4.slice(Math.max(0, i - 248), i + 1), p = rows.map(b => b.close), a = ema(p, 200), b = ema(p, 50);
    assert.equal(x.endTs, h4[i].endTs); near(x.close, h4[i].close);
    assert.equal(x.healthy, rows.length >= 201 && rows.every((v, k) => !k || v.ts === rows[k - 1].endTs));
    for (const [key, expected] of [["ema200", a.at(-1)], ["ema50", b.at(-1)], ["ema50Prev", b.at(-2)]] as const) {
      if (expected === undefined) assert.equal(x[key], null); else near(x[key], expected);
    }
  }
  for (let i = 0; i < h1.length; i++) {
    const x = tape.vwap[i], b = h1[i], day = Math.floor(b.ts / 86400000) * 86400000;
    const rows = h1.slice(Math.max(0, i - 23), i + 1).filter(c => c.ts >= day), validDay = rows[0]?.ts === day && rows.every((c, k) => !k || c.ts === rows[k - 1].endTs);
    const six = h1.slice(Math.max(0, i - 5), i + 1), validRoc = six.length === 6 && six.every((c, k) => !k || c.ts === six[k - 1].endTs);
    const vol = rows.reduce((n, c) => n + c.volume, 0), turn = rows.reduce((n, c) => n + c.turnover, 0);
    assert.equal(x.endTs, b.endTs); assert.equal(x.dayStart, day); near(x.close, b.close);
    assert.equal(x.healthy, validDay && validRoc && vol > 0);
    if (validDay && vol > 0) near(x.vwap, turn / vol); else assert.equal(x.vwap, null);
    if (validRoc) near(x.roc5, (b.close / six[0].close - 1) * 100); else assert.equal(x.roc5, null);
  }
  return { raw4hFrames: h4.length, rawHourlyFrames: h1.length };
}
async function main() {
  const partial = process.argv.includes("--partial");
  const out = path.resolve(process.argv.slice(2).find(a => !a.startsWith("--")) ?? "backtests/hype/hype-conditional-soft-stale-2026-09-10"), load = (f: string) => read(path.join(out, f));
  assert(!fs.existsSync(path.join(out, "verification.json")), "Fresh verification required");
  const manifest = load("manifest.json"), validation = partial ? { passed: true, artifacts: [] } : load("validation.json"), spec = manifest.spec, results: R[] = load("results.json"), tape = load("sources.json"), cfg = read("bot-config.json");
  assert(validation.passed && (partial || results.length === spec.runCount));
  const comparisons: R[] = partial ? results.filter(x => x.policy.id !== "baseline").map(x => {
    const b = results.find(b => b.model === x.model && b.policy.id === "baseline")!;
    return { name: x.name, delta: exposureDelta(x.metrics, b.metrics), attribution: componentAttribution(x.metrics, b.metrics), extra5bpsDelta: x.accounting.fixedPathExtra5bpsNet - b.accounting.fixedPathExtra5bpsNet };
  }) : load("comparisons.json");
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  for (const p of validation.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256, p.file);
  const cs = await prices(Date.parse(spec.cutoff), manifest.repairFile), sources = auditSources(cs, tape);
  const old: R[] = read(`${spec.archive}/results.json`), components: R[] = read(`${spec.componentArchive}/results.json`);
  let fills = 0, minutes = 0, targetCount = 0, observationCount = 0, controls = 0, prefixChecks = 0;
  const audits: R[] = [], traces: R[] = [];
  for (const x of results) {
    const events: ResearchInventoryEvent[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), r => events.push(r as any));
    const targets: R[] = load(`${x.name}-targets.json`), obs: R[] = load(`${x.name}-observations.json`);
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, spec.initialEquity, spec.feeRate); assert.deepEqual(accounting, x.accounting);
    const pathAudit = auditSoftStalePath(cs, events, targets, obs, x, spec, cfg, tape);
    // A next-bar open shares the previous close's epoch timestamp, but is a later
    // execution phase. Index, not timestamp alone, determines decision inventory.
    const stateCheck = (d: R) => {
      assert.equal(d.at, cs[d.index].endTs); near(d.price, cs[d.index].close);
      const inv = inventoryAtDecision(events, d.index); assert(inv.length > 0); assert.equal(d.depth, inv.length);
      const qty = inv.reduce((n, p) => n + p.qty, 0), avg = inv.reduce((n, p) => n + p.entryPrice * p.qty, 0) / qty;
      near(d.qty, qty); near(d.avgEntry, avg); assert.equal(d.oldestEntryTime, Math.min(...inv.map(p => p.entryTime)));
      const base = x.policy.id !== "minus_soft_stale" && (d.at - d.oldestEntryTime) / 3600000 >= 4 && (d.price - avg) / avg * 100 < .5 ? .5 : 1.4;
      near(d.basePct, base); near(d.normalTarget, avg * 1.014);
    };
    for (const t of targets) {
      stateCheck(t); assert.equal(t.armedAt, t.at); assert.equal(t.armedIndex, t.index);
      near(t.targetPrice, t.avgEntry * (1 + t.pct / 100)); assert([t.basePct, 1.4].includes(t.pct));
      if (t.pct !== t.basePct) {
        const rows = obs.filter(o => o.episode === t.episode && o.at <= t.at), last = rows.at(-1);
        assert(last && (last.status === "extended" || last.status === "release_requested" && last.releaseAt > t.at), "unexplained target extension");
      }
    }
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const ev = e.event, ts = targets.filter(t => t.episode === e.episode);
      const target = ts[upper(ts, "armedIndex", ev.decisionIndex) - 1]; assert(target, "TP must refer to a previously armed target");
      assert.equal(ev.reason, target.pct < 1.4 ? "stale_tp" : "tp");
      if (ev.fillAt === cs[ev.fillIndex!].endTs) {
        assert.equal(ev.decisionAt, target.armedAt); assert.equal(ev.decisionIndex, target.armedIndex); near(ev.price!, target.targetPrice);
        assert(target.armedIndex < ev.fillIndex! && target.armedAt <= cs[ev.fillIndex!].ts);
      } else { assert(target.armedIndex < ev.decisionIndex); assert(cs[ev.decisionIndex].close >= target.targetPrice); }
    }
    const sr = x.policy.family === "resistance" ? new ReplaySrContext(cs, cfg.srShadow) : null; let boundary = -Infinity;
    const phase = new Map<number, R>();
    for (const o of obs) {
      stateCheck(o); const prior = phase.get(o.episode);
      if (o.status === "released") { assert(prior?.status === "release_requested"); assert.equal(o.releaseAt, prior.releaseAt); assert(o.at >= o.releaseAt); phase.set(o.episode, o); continue; }
      const age = (o.at - o.oldestEntryTime) / 3600000; near(o.age, age);
      const evidence = o.context.evidence; let healthy: boolean, allowed: boolean;
      if (age >= spec.maxAgeHours) { healthy = true; allowed = false; assert.equal(evidence.reason, "age_limit"); }
      else if (x.policy.family === "age") { healthy = true; allowed = true; }
      else {
        const at = o.at - x.sensitivity.sourceLagMs; assert.equal(evidence.sourceAt, at);
        if (x.policy.family === "structure" || x.policy.family === "vwap") {
          const four = x.policy.family === "structure", rows = four ? tape.structure : tape.vwap, f = rows[upper(rows, "endTs", at) - 1];
          assert(f); for (const k of Object.keys(f)) assert.deepEqual(evidence[k], f[k]);
          healthy = f.healthy && at - f.endTs < (four ? 14400000 : 3600000);
          allowed = healthy && (four ? f.close >= f.ema200 && f.ema50 >= f.ema50Prev : f.close > f.vwap && f.roc5 > 0);
        } else {
          const grid = Math.floor(at / 1800000) * 1800000; if (grid > boundary) { sr!.at(grid); boundary = grid; }
          const c = sr!.at(at), zones = c.engine.getZones(at).filter(z => z.price > o.price);
          const nearest = zones.reduce<typeof zones[number] | null>((best, z) => !best || z.price < best.price ? z : best, null);
          const r = nearest ? { lv: nearest } : null;
          assert.deepEqual(evidence.coverage, c.coverage); assert.deepEqual(evidence.resistance, r?.lv ?? null);
          assert.equal(evidence.knownAt, r ? Math.max(...r.lv.touchData.map(t => t.ts)) : null);
          healthy = c.coverage.healthy && !!r; allowed = healthy && r!.lv.price >= o.normalTarget * 1.001;
          if (r && prefixChecks < 12) {
            const prefix = new ReplaySrContext(cs.filter(c => c.endTs <= grid), cfg.srShadow); prefix.at(grid);
            assert.deepEqual(prefix.engine.getZones(at), c.engine.getZones(at), "later candles must not change earlier resistance"); prefixChecks++;
          }
        }
      }
      assert.equal(o.context.healthy, healthy); assert.equal(o.context.allowed, allowed);
      if (o.status === "extended") { assert(!prior); assert(o.basePct < 1.4 && healthy && allowed && age < 8); }
      else if (o.status === "refused") { assert(!prior); assert(o.basePct < 1.4 && (!healthy || !allowed)); }
      else { assert.equal(o.status, "release_requested"); assert.equal(prior?.status, "extended"); assert(!healthy || !allowed); assert.equal(o.releaseAt, o.at + x.sensitivity.releaseDelayMs); }
      phase.set(o.episode, o);
    }
    if (x.control) {
      const reference = x.policy.id === "baseline" ? old.find(v => v.model === x.model && v.policy.id === "baseline") : components.find(v => v.model === x.model && v.policy === "minus_soft_stale");
      assert(reference); assert.equal(reference.digest, x.digest); assert.deepEqual(reference.metrics, x.metrics); assert.deepEqual(reference.accounting, accounting); controls++;
    }
    const base = results.find(b => b.model === x.model && b.policy.id === "baseline")!;
    if (x.policy.id !== "baseline") {
      const comp = comparisons.find(c => c.name === x.name)!; assert.deepEqual(comp.delta, exposureDelta(x.metrics, base.metrics)); assert.deepEqual(comp.attribution, componentAttribution(x.metrics, base.metrics));
      near(comp.extra5bpsDelta, accounting.fixedPathExtra5bpsNet - base.accounting.fixedPathExtra5bpsNet);
    }
    fills += events.length; minutes += accounting.independentMinutes; targetCount += targets.length; observationCount += obs.length;
    audits.push({ name: x.name, passed: true, fills: events.length, targetChanges: targets.length, observations: obs.length, pathAudit });
    if (!x.control && x.sensitivity.id === "primary") { const extended = obs.find(o => o.status === "extended"); if (extended) traces.push({ name: x.name, extension: extended, resolution: obs.find(o => o.episode === extended.episode && o.status === "release_requested") ?? null }); }
    console.log(`[F06 check] ${x.name}`);
  }
  assert.equal(controls, 8);
  for (const x of results.filter(x => x.policy.id === "age8" && x.sensitivity.id === "source60")) {
    const primary = results.find(p => p.model === x.model && p.policy.id === "age8" && p.sensitivity.id === "primary");
    assert(primary); assert.deepEqual(x.metrics, primary.metrics, "age-only control cannot depend on source lag");
    assert.deepEqual(load(`${x.name}-observations.json`), load(`${primary.name}-observations.json`));
  }
  const ranking = partial ? [] : load("ranking.json");
  for (const p of ranking) {
    const failures: string[] = [];
    for (const x of results.filter(x => x.policy.id === p.policy && x.sensitivity.id === "primary")) {
      const d = comparisons.find(c => c.name === x.name)!.delta;
      if (d.pnlDelta < (x.window === "hl_extended" ? 1000 : 0)) failures.push(`${x.model}:net`);
      if (d.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`);
      if (d.worstMonthDelta < -250) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    } assert.deepEqual(p.failures, failures); assert.equal(p.passesEconomicScreen, failures.length === 0);
  }
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const verification = { passed: true, checkerHash: await fileHash(__filename), pathCheckerHash: await fileHash("scripts/conditional-soft-stale-path-audit.ts"), controls, cases: results.length, fills, independentMinutes: minutes, targetChanges: targetCount, observations: observationCount,
    sources, prefixChecks, audits, liveChanges: 0, limitations: "Target/source/accounting verification, not order queue/maker, funding or liquidation certification." };
  if (!partial) {
    fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(verification, null, 2) + "\n");
    fs.writeFileSync(path.join(out, "causal-traces.json"), JSON.stringify(traces, null, 2) + "\n");
  }
  console.log(JSON.stringify({ ...verification, partialDiagnosticOnly: partial, audits: undefined }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
