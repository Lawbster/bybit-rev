/** FR01 independent source arithmetic and recorded path audit. No strategy runs. */
import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, sha, fileHash } from "./research-workflow";
import { auditFlowLedger } from "./flow-response-audit";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { exposureDelta } from "./ladder-exposure-metrics";
import { componentAttribution } from "./ladder-combination-accounting";
type R = Record<string, any>;
const M = 60000, PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 + Math.max(Math.abs(a), Math.abs(b)) * 1e-12, `${a} != ${b}`);
function millis(x: any) { const v = typeof x === "number" ? x : /^\d{13}$/.test(x) ? Number(x) : typeof x === "string" && /(?:Z|[+-]\d\d:\d\d)$/.test(x) ? Date.parse(x) : NaN;
  assert(Number.isSafeInteger(v) && v >= 0); return v; }
export class RawFlowReference {
  readonly rows = new Map<number, R[]>();
  readonly cache = new Map<string, R>();
  add(raw: R, line: number) {
    const end = millis(raw.windowEnd ?? raw.timestamp); assert.equal(end % M, 0);
    let available = Infinity, valid = true;
    try {
      const receipts = [raw.receivedAt, raw.observedAt, raw.writtenAt, raw.ingestedAt].filter(x => x != null).map(millis);
      available = Math.ceil(Math.max(millis(raw.timestamp ?? raw.ts), end + (receipts.length ? 0 : M), ...receipts,
        raw.availableAt == null ? 0 : millis(raw.availableAt)) / M) * M;
      if (raw.symbol !== "HYPEUSDT" || raw.venue !== "hyperliquid" || Number(raw.windowStart) !== end - M || Number(raw.intervalMs) !== M) valid = false;
      for (const k of ["buyNotional", "sellNotional", "buyVol", "sellVol", "buyCount", "sellCount"]) {
        if (raw[k] == null || !Number.isFinite(Number(raw[k])) || Number(raw[k]) < 0 || k.endsWith("Count") && !Number.isInteger(Number(raw[k]))) valid = false;
      }
      if (raw.complete === false || raw.partial === true) valid = false;
      for (const k of ["firstTradeTime", "lastTradeTime"]) if (raw[k] != null && !(Number(raw[k]) >= end - M && Number(raw[k]) < end)) valid = false;
      if (raw.firstTradeTime != null && raw.lastTradeTime != null && Number(raw.firstTradeTime) > Number(raw.lastTradeTime)) valid = false;
    } catch { valid = false; }
    const bucket = this.rows.get(end) ?? []; bucket.push({ end, available, valid, line, buy: Number(raw.buyNotional), sell: Number(raw.sellNotional) }); this.rows.set(end, bucket);
  }
  at(decisionAt: number, lag: number, price: (end: number) => number | null): R {
    const key = `${decisionAt}:${lag}`; if (this.cache.has(key)) return this.cache.get(key)!;
    const asOf = decisionAt - lag, end = asOf - M, reasons = new Set<string>();
    const eligible: R[] = [];
    for (let time = end - 59 * M; time <= end; time += M) {
      const seen = (this.rows.get(time) ?? []).filter(r => r.available <= asOf);
      if (!seen.length) reasons.add("missing_or_not_yet_available");
      else if (seen.length > 1) reasons.add("duplicate_window");
      else if (!seen[0].valid) reasons.add("invalid_window");
      else eligible.push(seen[0]);
    }
    const recent = eligible.filter(r => r.end > end - 15 * M), prior = eligible.filter(r => r.end <= end - 15 * M);
    const recentBuy = recent.reduce((n, r) => n + r.buy, 0), recentSell = recent.reduce((n, r) => n + r.sell, 0), priorSell = prior.reduce((n, r) => n + r.sell, 0);
    const close = price(end), earlier = price(end - 15 * M);
    const priceReady = close != null && earlier != null && Number.isFinite(close) && Number.isFinite(earlier) && close > 0 && earlier > 0;
    if (!priceReady) reasons.add("price_coverage");
    if (!(recentBuy + recentSell > 0) || !(priorSell > 0)) reasons.add("zero_flow_denominator");
    const ready = reasons.size === 0, ret15Pct = priceReady ? 100 * (close! / earlier! - 1) : null;
    const sellShare = ready ? recentSell / (recentSell + recentBuy) : null, sellRateRatio = ready ? recentSell * 3 / priorSell : null;
    const acceleration = ready ? sellShare! >= .6 && sellRateRatio! >= 1.5 : null, impact = ready ? ret15Pct! <= -.2 : null;
    const result = { decisionAt, lag, asOf, end, start: end - 60 * M, ready, reasons: [...reasons].sort(), validMinutes: eligible.length,
      latestAvailable: eligible.length ? Math.max(...eligible.map(r => r.available)) : null, ids: eligible.map(r => r.line).reverse(),
      recentBuy, recentSell, priorSell, sellShare, sellRateRatio, close, earlier, ret15Pct, acceleration, impact,
      response: !ready ? "unknown" : !acceleration ? "no_acceleration" : impact ? "selling_with_impact" : ret15Pct! >= 0 ? "absorption_compatible" : "small_decline" };
    this.cache.set(key, result); return result;
  }
}
export function checkFeature(actual: R, expected: R) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
  for (const k of Object.keys(expected)) {
    if (typeof expected[k] === "number") near(actual[k], expected[k]); else assert.deepEqual(actual[k], expected[k], k);
  }
}
async function lines(file: string, action: (r: R, line: number) => void) { let n = 0;
  for await (const text of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) { n++; if (text.trim()) action(JSON.parse(text), n); } }
async function main() {
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")), d = plan.card.definition;
  assert.equal(state.status, "complete"); assert(!fs.existsSync(path.join(dir, "verification.json")), "Never overwrite verification");
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  // Shared canonical loader is explicit: independence here covers NEW signal arithmetic,
  // inventory/fees/DD and inherited TP/high policy, not a second independent OHLC vendor.
  const { buildSeries } = await import("./flow-response-study"); const { s, cfg } = await buildSeries(d), cs = s.candles;
  const source = new RawFlowReference();
  await lines("data/HYPEUSDT_taker_hyperliquid.jsonl", (r, n) => { if (millis(r.windowEnd ?? r.timestamp) <= Date.parse(d.cutoff)) source.add(r, n); });
  const closeAt = (end: number) => { const i = (end - cs[0].endTs) / M; return cs[i]?.endTs === end ? cs[i].close : null; };
  const highs = rawHighs(cs, 2), results: R[] = load("results.json"), comps: R[] = load("comparisons.json"), accepted: R[] = read(`${d.archive}/output/results.json`);
  assert.equal(results.length, 32); assert.equal(results.filter(x => x.control).length, 8);
  let controls = 0, fills = 0, minutes = 0, checks = 0, features = 0, targetChecks = 0, highChecks = 0;
  const proofs: R[] = [];
  for (const x of results) {
    console.log(`[FR01 verify] ${x.name}`);
    const raw = load(`${x.name}-engine.json`); assert.equal(sha(JSON.stringify(raw)), x.digest);
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    assert.deepEqual(events.map(e => e.event), raw.executionAudit.events);
    assert.deepEqual(x.pendingAtEnd, raw.executionAudit.pendingAtEnd);
    const attempts: R[] = load(`${x.name}-attempts.json`), accounting = auditFlowLedger(cs, events, attempts, x.metrics, x.startIdx, x.endIdx);
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    const targets: R[] = load(`${x.name}-targets.json`), arms: R[] = [];
    targetChecks += auditAgeHighTargets(cs, events, targets, load(`${x.name}-tp-observations.json`),
      { ...x, control: !x.spec.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {}, t => arms.push(t)).checks;
    assert.equal(arms.length, targets.length);
    arms.forEach((t, i) => { const a = targets[i]; for (const k of ["episode", "armedIndex", "armedAt", "pct"]) assert.equal(a[k], t[k]); near(a.targetPrice, t.targetPrice); });
    if (x.spec.days) highChecks += auditAgeHighExits(cs, events, { ...x, lag: 0 }, load(`${x.name}-high-reductions.json`), highs);
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, arm = arms.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(arm);
      assert.equal(v.reason, arm.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, arm.armedIndex); near(v.price, arm.targetPrice); assert(arm.armedIndex < v.fillIndex); }
      else { assert(arm.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= arm.targetPrice); }
    }
    let ptr = 0, inv: R[] = [], episode = 0; const reasonCounts: R = {}, changed: R[] = [];
    for (const a of attempts) {
      while (ptr < events.length && events[ptr].event.fillIndex <= a.index) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(a.at, cs[a.index].endTs); assert.equal(a.price, cs[a.index].close); assert.equal(a.nextDepth, inv.length + 1);
      assert.equal(a.episode, inv.length ? episode : episode + 1); near(a.requestedNotional, 800 * 1.35 ** inv.length);
      near(a.qty, inv.reduce((n, p) => n + p.qty, 0)); near(a.entryCostNotional, inv.reduce((n, p) => n + p.notional, 0));
      assert.equal(a.priceDropOk, !!inv.length && cfg.priceTriggerPct > 0 && a.price <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      let f: R | null = null;
      if (a.nextDepth >= 8) {
        f = source.at(a.at, x.lag, closeAt); checkFeature(a.feature, f); features++;
        assert(f.end <= a.at - x.lag - M); if (f.latestAvailable != null) assert(f.latestAvailable <= a.at - x.lag);
        for (const r of f.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
      } else assert.equal(a.feature, null);
      const variant = d.variants.find((v: R) => v.id === x.policy) ?? null; assert.deepEqual(x.variant, variant);
      const fire = !!variant && a.nextDepth >= 8 && f?.ready === true && f.acceleration === true && (!variant.requireImpact || f.impact === true);
      assert.equal(a.fire, fire); near(a.approvedNotional, a.requestedNotional * (fire ? variant.fraction : 1));
      if (fire) changed.push(a); checks++;
    }
    const deep = attempts.filter(a => a.feature);
    assert.deepEqual(x.counts, { attempts: attempts.length, deep: deep.length, ready: deep.filter(a => a.feature.ready).length,
      unknown: deep.filter(a => !a.feature.ready).length, checksChanged: changed.length, episodesChanged: new Set(changed.map(a => a.episode)).size,
      priceDropChecksChanged: changed.filter(a => a.priceDropOk).length, timerChecksChanged: changed.filter(a => !a.priceDropOk).length,
      zeroChecks: attempts.filter(a => !a.approvedNotional).length, reasonCounts });
    assert.equal(x.blocked.researchAddSize ?? 0, x.counts.zeroChecks);
    if (x.control) { const old = accepted.find(a => a.primary && a.model === x.model && a.policy === x.policy); assert(old);
      assert.equal(x.digest, old.digest); assert.deepEqual(x.metrics, old.metrics); controls++; }
    const comp = comps.find(c => c.name === x.name)!;
    for (const peer of ["baseline", "parent"]) { const base = results.find(b => b.control && b.model === x.model && b.policy === (peer === "baseline" ? "baseline" : PARENT))!;
      assert.deepEqual(comp[peer], exposureDelta(x.metrics, base.metrics)); assert.deepEqual(comp[`${peer}Attribution`], componentAttribution(x.metrics, base.metrics)); }
    proofs.push({ name: x.name, fills: events.length, addChecks: attempts.length, deepChecks: deep.length, changedEpisodes: x.counts.episodesChanged });
  }
  assert.equal(controls, 8);
  const ranking = d.variants.map((v: R) => {
    const rows = results.filter(x => x.policy === v.id), failures: R = { baseline: [], parent: [] };
    for (const x of rows) for (const peer of ["baseline", "parent"]) {
      const delta = comps.find(c => c.name === x.name)![peer], recent = x.window === "hl_extended";
      if (x.lag ? delta.pnlDelta <= 0 : delta.pnlDelta < (recent ? 1000 : 0)) failures[peer].push(`${x.name}:net`);
      if (delta.ddReductionPp < -1e-9) failures[peer].push(`${x.name}:drawdown`);
      if (delta.worstMonthDelta < -250) failures[peer].push(`${x.name}:monthly`);
      if (recent && x.counts.episodesChanged < 20) failures[peer].push(`${x.name}:thin_interventions`);
      if (x.accounting.firstNonpositive) failures[peer].push(`${x.name}:nonpositive_equity`);
    }
    return { policy: v.id, failures, baselinePass: !failures.baseline.length, parentPass: !failures.parent.length, deployable: false,
      minimumRecentParentDelta: Math.min(...rows.filter(x => x.window === "hl_extended" && !x.lag).map(x => comps.find(c => c.name === x.name)!.parent.pnlDelta)) };
  }).sort((a: R, b: R) => b.minimumRecentParentDelta - a.minimumRecentParentDelta);
  assert.deepEqual(load("ranking.json"), ranking);
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const receipt = { passed: true, cases: 32, controlsExact: controls, fills, minutes, addChecks: checks, featureChecks: features, targetChecks, highChecks,
    uniqueFeatureWindows: source.cache.size, proofRows: proofs, newDefinitions: 4, liveChanges: 0, checkerSha256: await fileHash("scripts/flow-response-verify.ts") };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
