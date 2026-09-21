/** Re-read raw prices and saved event ledgers independently of strategy execution. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import type { Candle } from "./hype-freerun-canonical-replay";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const root = path.resolve(__dirname, ".."), dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-ladder-components-2026-09-08"), rel = path.relative(path.join(root, "backtests"), dir);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
  const manifest = read(path.join(dir, "manifest.json")), results = read(path.join(dir, "results.json")), validation = read(path.join(dir, "validation.json"));
  assert(validation.passed); assert.equal(results.length, 138); const dest = path.join(dir, "verification.json"); assert(!fs.existsSync(dest));
  for (const x of [...manifest.inputs, ...manifest.sources, ...manifest.protectedFiles]) {
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(x.file)) h.update(b); assert.equal(h.digest("hex"), x.sha256, x.file);
  }
  const archive = read(`${manifest.spec.archiveDir}/results.json`);
  const full = results.filter((x: any) => x.policy === "B17"); assert.equal(full.length, 6);
  for (const r of full) assert.equal(r.digest, archive.find((x: any) => x.variant === "baseline" && x.model === r.model).digest);
  const cutoff = Date.parse(manifest.spec.latestEnd), prices = new Map<number, Candle>(), M = 60000;
  function add(r: any) {
    const ts = Number(r.ts ?? r.timestamp); if (ts + M > cutoff) return;
    const c = { ts, endTs: ts + M, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high), low: Number(r.l ?? r.low), close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) };
    assert(Object.values(c).every(Number.isFinite)); prices.set(ts, c);
  }
  read("data/HYPEUSDT_1_full.json").forEach(add);
  for await (const line of readline.createInterface({ input: fs.createReadStream("data/HYPEUSDT_1m.jsonl"), crlfDelay: Infinity })) if (line.trim()) add(JSON.parse(line));
  const candles = applyCandleRepair([...prices.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(manifest.spec.repairFile), "HYPEUSDT", cutoff); prices.clear();
  candles.forEach((c, i) => assert.equal(c.ts, candles[0].ts + i * M));
  const index = (at: number) => { const i = (at - candles[0].endTs) / M; assert(Number.isInteger(i)); return i; };
  let minutes = 0, fills = 0, monthly = 0, failedSurvival = 0;
  for (const r of results) {
    const file = path.join(dir, `${r.model}--${r.policy}-inventory.jsonl`), events = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x));
    const a = auditComponentAccounting(candles, events, r.metrics, index(Date.parse(r.start)), index(Date.parse(r.end)) + 1, manifest.spec.initialEquity, .00055);
    assert.deepEqual(a, r.accounting); minutes += a.independentMinutes; fills += events.length; monthly += a.monthly.length;
    if (a.firstNonpositive) failedSurvival++;
    assert.equal(r.config.basePositionUsdt, 800); assert.equal(r.config.addScaleFactor, 1.35); assert.equal(r.config.maxPositions, 11);
    assert.equal(r.config.feeRate, .00055); assert.equal(r.config.tpPct, 1.4);
    if (r.policy === "B00") {
      assert.equal(r.config.priceTriggerPct, 0); assert.equal(r.config.exits.hardFlatten, false); assert.equal(r.config.exits.emergencyKill, false);
      assert.equal(r.metrics.forcedCloses, 0); assert.equal(r.metrics.partials, 0); assert(!a.reasonCounts.price_drop); assert(!a.reasonCounts.stale_tp);
      assert(Object.entries(r.blocked).every(([k, v]) => ["srContext", "margin"].includes(k) || v === 0), "Bare no strategy blocks");
    }
    if (!r.enabled.includes("sr_partial")) assert.equal(r.metrics.partials, 0);
    for (const [component, reason] of [["emergency", "emergency_kill"], ["hard_flatten", "hard_flatten"], ["funding_spike", "funding_spike"], ["price_drop", "price_drop"], ["soft_stale", "stale_tp"]]) {
      if (!r.enabled.includes(component)) assert(!a.reasonCounts[reason]);
    }
    if (!r.enabled.includes("trend")) { assert.equal(r.blocked.trend, 0); assert(!a.reasonCounts.hard_flatten); }
    console.log(`[verified] ${r.model}/${r.policy}: ${a.independentMinutes} marks;${events.length} fills`);
  }
  const comparisons = read(path.join(dir, "comparisons.json"));
  for (const c of comparisons) {
    const r = results.find((r: any) => r.model === c.model && r.policy === c.policy), b = results.find((r: any) => r.model === c.model && r.policy === c.parent);
    assert.deepEqual(componentAttribution(r.metrics, b.metrics), c.attribution); near(r.metrics.totalPnl - b.metrics.totalPnl, c.delta.pnlDelta);
    near(b.metrics.maxDrawdownPct - r.metrics.maxDrawdownPct, c.delta.ddReductionPp);
    for (const m of c.delta.monthly) { const bm = b.metrics.monthly.find((x: any) => x.month === m.month); near(m.mtmDelta, m.mtmPnl - bm.mtmPnl); }
  }
  const rankings = read(path.join(dir, "ranking.json")); assert.equal(rankings.length, 17);
  for (const r of rankings) {
    const xs = results.filter((x: any) => x.policy === r.policy && x.window !== "hl_window_latest"); assert.equal(xs.length, 4);
    const passed = xs.every((x: any) => {
      const b = results.find((y: any) => y.model === x.model && y.policy === "B17");
      return !x.accounting.firstNonpositive && x.metrics.totalPnl - b.metrics.totalPnl >= (x.window === "hl_extended" ? 1000 : 0)
        && x.metrics.maxDrawdownPct <= b.metrics.maxDrawdownPct + 1e-9
        && x.metrics.monthly.every((m: any) => m.mtmPnl - b.metrics.monthly.find((bm: any) => bm.month === m.month).mtmPnl >= -250);
    });
    assert.equal(r.passesResearchScreen, passed); assert.equal(r.deployable, false);
  }
  // First divergence, not a cherry-picked profitable episode: independently trace
  // the soft-stale switch from already-known inventory and raw source candles.
  const traceRows: any[] = [];
  const inventory = (model: string, policy: string) => fs.readFileSync(path.join(dir, `${model}--${policy}-inventory.jsonl`), "utf8").trim().split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x));
  for (const model of ["published_window-resting_touch", "published_window-close_confirmed"]) {
    const base = inventory(model, "B17"), variant = inventory(model, "minus_soft_stale"); let at = 0;
    while (at < Math.min(base.length, variant.length) && JSON.stringify(base[at]) === JSON.stringify(variant[at])) at++;
    const x = base[at], e = x.event, totalQty = x.before.reduce((n: number, p: any) => n + p.qty, 0), cost = x.before.reduce((n: number, p: any) => n + p.notional, 0);
    const oldest = Math.min(...x.before.map((p: any) => p.entryTime)), target = cost / totalQty * 1.005;
    assert.equal(e.kind, "close"); assert.equal(e.reason, "stale_tp"); assert(e.decisionAt - oldest >= 4 * 3600000);
    assert(x.before.every((p: any) => p.entryTime <= e.decisionAt)); assert.equal(candles[e.decisionIndex].endTs, e.decisionAt);
    if (model.endsWith("resting_touch")) { near(e.price, target); assert(candles[e.fillIndex].high >= target); assert(e.decisionIndex < e.fillIndex); }
    else { assert(candles[e.decisionIndex].close >= target); assert.equal(e.fillIndex, e.decisionIndex + 1); near(e.price, candles[e.fillIndex].open); }
    traceRows.push({ model, identicalInventoryEventsBefore: at, firstDivergence: { current: e, noSoftStale: variant[at].event },
      oldestEntry: new Date(oldest).toISOString(), decisionIso: new Date(e.decisionAt).toISOString(), fillIso: new Date(e.fillAt).toISOString(),
      knownQty: totalQty, knownCost: cost, staleTarget: target, normalTarget: cost / totalQty * 1.014,
      decisionCandle: candles[e.decisionIndex], fillCandle: candles[e.fillIndex] });
  }
  fs.writeFileSync(path.join(dir, "causal-traces.json"), JSON.stringify(traceRows, null, 2) + "\n");
  const report = { passed: true, at: new Date().toISOString(), cases: results.length, coreCases: 136, controlsExact: 6,
    fills, independentRawMinuteMarks: minutes, monthlyRows: monthly, casesWithModeledInsolvency: failedSurvival,
    attributionComparisons: comparisons.length, firstDivergenceRawTraces: traceRows.length, hashesMatch: true, liveChanges: 0,
    boundary: "Independent accounting implementation shared by runner/checker, replayed again from separately loaded raw prices and saved fills; not an independent strategy engine or liquidation model.",
    checkerSha256: hash(fs.readFileSync(__filename)) };
  fs.writeFileSync(dest, JSON.stringify(report, null, 2) + "\n"); console.log(report);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
