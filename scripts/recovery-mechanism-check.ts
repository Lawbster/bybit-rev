/** F05 independent ledger, raw evidence and economic-comparison verification. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, prices, fileHash } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { auditRecovery, auditMfiRaw } from "./recovery-mechanism-audit";
import { auditWeekly } from "./mfi-weekly-exit-audit";
import { observationAvailability, firstDecisionAt } from "./replay-causality";
import { assetObservationAt } from "../src/hl-data-quality";
import { supportSource, type R } from "./recovery-mechanism-sources";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
const M = 60000;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
async function referencePulse(spec: R) {
  const flows: R[] = [], assets: R[] = [], start = Date.parse(spec.windows[1].start) - 7200000, end = Date.parse(spec.cutoff);
  await lines("data/HYPEUSDT_taker_hyperliquid.jsonl", (r, line) => {
    const source = Number(r.windowEnd ?? r.timestamp); if (source < start || source > end) return;
    const at = firstDecisionAt(observationAvailability(r, "hl_taker"));
    const valid = Number(r.windowStart) === source - M && source % M === 0 &&
      [r.buyNotional, r.sellNotional, r.buyVol, r.sellVol, r.buyCount, r.sellCount].every(v => v != null && Number.isFinite(Number(v)) && Number(v) >= 0) &&
      (r.firstTradeTime == null || Number.isFinite(Number(r.firstTradeTime)) && Number(r.firstTradeTime) >= source - M) &&
      (r.lastTradeTime == null || Number.isFinite(Number(r.lastTradeTime)) && Number(r.lastTradeTime) < source);
    flows.push({ at, source, line, buy: Number(r.buyNotional), sell: Number(r.sellNotional), valid });
  });
  await lines("data/HYPEUSDT_asset_ctx_hyperliquid.jsonl", (r, line) => {
    const ts = Number(r.timestamp); if (ts < start || ts > end) return;
    assets.push({ at: firstDecisionAt(observationAvailability(r, "point")), source: assetObservationAt(r), line,
      oi: r.openInterest != null && Number.isFinite(Number(r.openInterest)) && Number(r.openInterest) >= 0 ? Number(r.openInterest) : null });
  });
  flows.sort((a, b) => a.source - b.source || a.line - b.line); assets.sort((a, b) => a.at - b.at || a.line - b.line);
  const upper = (xs: R[], key: string, time: number) => { let lo = 0, hi = xs.length; while (lo < hi) { const mid = lo + ((hi - lo) >> 1); if (xs[mid][key] <= time) lo = mid + 1; else hi = mid; } return lo; };
  const cache = new Map<string, boolean>();
  return (p: R) => {
    const key = `${p.at}:${p.lag}`; if (cache.has(key)) return false;
    const rows = flows.slice(upper(flows, "source", p.at - 15 * M), upper(flows, "source", p.at)).filter(r => r.at + p.lag <= p.at);
    assert.deepEqual([...p.flowRows].sort((a, b) => a.line - b.line), [...rows].sort((a, b) => a.line - b.line), "all and only available raw flow rows");
    const samples = new Set(rows.map(r => r.source)).size, buy = rows.reduce((n, r) => n + r.buy, 0), sell = rows.reduce((n, r) => n + r.sell, 0);
    const age = rows.length ? p.at - Math.max(...rows.map(r => r.source)) : null, ratio = sell > 0 ? buy / sell : null;
    assert.equal(p.samples, samples); if (ratio === null) assert.equal(p.ratio, null); else near(p.ratio, ratio);
    const healthy = samples >= spec.quality.min15 && samples === rows.length && rows.every(r => r.valid) && ratio !== null && Number.isFinite(ratio) && age !== null && age >= 0 && age <= spec.quality.maxFlowAgeMs;
    assert.equal(p.flowHealthy, healthy); assert.equal(p.age, age); near(p.buy, buy); near(p.sell, sell);
    const a = assets[upper(assets, "at", p.at - p.lag) - 1] ?? null, b = assets[upper(assets, "at", p.at - p.lag - 60 * M) - 1] ?? null;
    assert.deepEqual(p.current, a); assert.deepEqual(p.anchor, b);
    const change = a?.oi != null && b?.oi != null && b.oi > 0 ? 100 * (a.oi / b.oi - 1) : null;
    const currentAge = a ? p.at - a.source : null, anchorLag = b ? p.at - 60 * M - b.source : null;
    const good = change !== null && currentAge !== null && currentAge >= 0 && currentAge <= spec.quality.maxAssetAgeMs && anchorLag !== null && anchorLag >= 0 && anchorLag <= spec.quality.maxAnchorLagMs;
    assert.equal(p.oiHealthy, good); if (change === null) assert.equal(p.nativeOi1hPct, null); else near(p.nativeOi1hPct, change);
    cache.set(key, true); return true;
  };
}
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-recovery-mechanisms-2026-09-10"), load = (f: string) => read(path.join(out, f));
  assert(!fs.existsSync(path.join(out, "verification.json")), "Fresh verification required");
  const manifest = load("manifest.json"), validation = load("validation.json"), spec = manifest.spec, results: R[] = load("results.json"), comparisons: R[] = load("comparisons.json");
  assert(validation.passed && results.length === spec.runCount);
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  for (const p of validation.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256, p.file);
  const cs = await prices(Date.parse(spec.cutoff), manifest.repairFile), sourceCheck = await referencePulse(spec);
  const old: R[] = read(`${spec.archive}/results.json`), audits: R[] = [], traces: R[] = []; let fills = 0, marks = 0, rawMfi = 0, rawPulse = 0, controls = 0;
  const supportChecks = new Map<number, R | null>();
  for (const x of results) {
    const events: ResearchInventoryEvent[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e as any));
    const obs: R[] = load(`${x.name}-observations.json`);
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, spec.initialEquity, spec.feeRate, { fraction: .5, fillDelayMs: x.sensitivity.fillDelayMs });
    assert.deepEqual(accounting, x.accounting); fills += events.length; marks += accounting.independentMinutes;
    const base = results.find(b => b.policy.id === "baseline" && b.model === x.model)!;
    let audit: R = {};
    if (x.control) {
      const previous = old.find(p => p.name === x.name)!; assert(previous); assert.equal(x.digest, previous.digest); assert.deepEqual(x.metrics, previous.metrics); assert.deepEqual(x.accounting, previous.accounting);
      assert.deepEqual(obs, read(`${spec.archive}/${x.name}-observations.json`)); rawMfi += auditMfiRaw(cs, obs, x.sensitivity.sourceLagMs);
      assert.deepEqual(auditWeekly(cs, obs as any, x.policy, x.sensitivity.sourceLagMs), x.contextAudit); controls++;
    } else {
      const vetoes = load(`${x.name}-vetoes.json`);
      audit = auditRecovery(cs, events, obs, vetoes, x.policy, spec.event, x.sensitivity.sourceLagMs, x.sensitivity.fillDelayMs, x.startIdx, x.endIdx);
      assert.equal(audit.signals, x.audit.signals); assert.equal(audit.cuts, x.audit.executed); assert.equal(audit.vetoes, x.audit.addVetoes);
      if (x.policy.family === "weekly") {
        const weekly = load(`${x.name}-weekly.json`); rawMfi += auditMfiRaw(cs, weekly, x.sensitivity.sourceLagMs);
        auditWeekly(cs, weekly, { id: x.policy.id, fraction: .5, mfiRequired: true, weeklyRequired: true }, x.sensitivity.sourceLagMs);
        assert.deepEqual(obs.filter(o => o.status === "signal").map(o => o.at), weekly.filter((o: R) => o.status === "scheduled").map((o: R) => o.at));
      }
      for (const o of obs) {
        for (const p of [o.pulse, o.previousPulse]) if (p && sourceCheck(p)) rawPulse++;
        if (o.status === "armed" && x.policy.family === "support") {
          const end = o.frame.end;
          if (!supportChecks.has(end)) supportChecks.set(end, supportSource(cs.filter(c => c.endTs <= end), read("bot-config.json").srShadow)(end, o.frame.close));
          assert.deepEqual(o.support, supportChecks.get(end), "closed-prefix S/R, no future pivots");
        }
      }
      const cmp = comparisons.find(c => c.name === x.name)!;
      assert.deepEqual(cmp.delta, exposureDelta(x.metrics, base.metrics)); assert.deepEqual(cmp.attribution, componentAttribution(x.metrics, base.metrics));
      const parent = results.find(p => p.model === x.model && p.policy.id === "mfi_weekly_half" && p.sensitivity.id === x.sensitivity.id)!;
      assert.deepEqual(cmp.versusWeekly, exposureDelta(x.metrics, parent.metrics)); near(cmp.extra5bpsDelta, accounting.fixedPathExtra5bpsNet - base.accounting.fixedPathExtra5bpsNet);
      const entries = new Map<number, string>(); events.filter(e => e.event.kind === "open" && !e.before.length).forEach(e => entries.set(e.episode, new Date(e.event.fillAt!).toISOString()));
      for (const signal of obs.filter(o => o.status === "signal")) {
        const entry = entries.get(signal.episode), actual = events.find(e => e.episode === signal.episode && e.event.reason.startsWith("research_exit:"));
        const before = base.metrics.episodes.find((e: R) => e.entry === entry) ?? null, after = x.metrics.episodes.find((e: R) => e.entry === entry) ?? null;
        traces.push({ name: x.name, policy: x.policy, sensitivity: x.sensitivity, signal, entry, fill: actual?.event ?? null,
          beforeQty: actual?.before.reduce((n, p) => n + p.qty, 0) ?? null, afterQty: actual?.after.reduce((n, p) => n + p.qty, 0) ?? null,
          baselineOutcome: before, outcome: after, matchedEpisodeDelta: before && after ? after.pnl - before.pnl : null });
      }
    }
    audits.push({ name: x.name, ...audit }); console.log(`[F05 checked] ${x.name}`);
  }
  assert.equal(controls, 28);
  const ranking = spec.policies.map((p: R) => {
    const failures: string[] = []; if (p.hl) failures.push("full_history_unavailable_not_qualified");
    for (const x of results.filter(x => !x.control && x.policy.id === p.id && x.sensitivity.id === "primary")) {
      const d = exposureDelta(x.metrics, results.find(b => b.policy.id === "baseline" && b.model === x.model)!.metrics);
      if (d.pnlDelta < (x.window === "hl_extended" ? spec.screen.minimumRecentNetDelta : spec.screen.minimumPublishedNetDelta)) failures.push(`${x.model}:net`);
      if (d.ddReductionPp < -1e-9) failures.push(`${x.model}:drawdown`); if (d.worstMonthDelta < spec.screen.minimumMonthlyDelta) failures.push(`${x.model}:monthly`);
      if (x.accounting.firstNonpositive) failures.push(`${x.model}:insolvency`);
    } return { policy: p.id, passesEconomicScreen: !failures.length, failures, deployable: false };
  }); assert.deepEqual(ranking, load("ranking.json"));
  for (const p of [...manifest.pins, ...manifest.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  const traceFile = path.join(out, "execution-traces.json"); fs.writeFileSync(traceFile, JSON.stringify(traces, null, 2) + "\n", { flag: "wx" });
  const result = { passed: true, at: new Date().toISOString(), cases: results.length, controls, fills, minuteMarks: marks, rawMfi, rawPulse, prefixSrChecks: supportChecks.size,
    traces: traces.length, audits, validationHash: await fileHash(path.join(out, "validation.json")), traceHash: await fileHash(traceFile),
    checkerHash: await fileHash(__filename), auditHash: await fileHash("scripts/recovery-mechanism-audit.ts"), newTradingDefinitions: 10, liveChanges: 0 };
  fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); console.log({ ...result, audits: audits.length });
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
