/** Separate raw-feature/ledger/permission audit, never a policy input. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, fileHash } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { acceptedSourceProof } from "./aggressive10-selective-sources";
import { POLICIES, LEAD, validate, qualification } from "./aggressive10-selective-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./age-high-refinement-audit";
import { ReplaySrContext } from "./replay-sr-context";
import { loadReplayMarketInputs } from "./replay-market-inputs";
import { loadFundingRows } from "./hype-freerun-canonical-replay";
import { evaluateSRSupportReopen } from "../src/bot/sr-support-reopen";
type R = Record<string, any>;
const M = 60000, H = 60 * M, DAY = 24 * H;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json")); assert.equal(state.status, "complete");
  assert(!fs.existsSync(path.join(dir, "verification.json")), "Never overwrite accepted verification");
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]); validate(plan.card.definition);
  const d = plan.card.definition; assert.deepEqual(await acceptedSourceProof(plan), load("source-proof.json"));
  const cfg = read("bot-config.json"), cs = await prices(Date.parse(d.cutoff), read(`${d.archive}/manifest.json`).repairFile);
  const rows: R[] = load("results.json"), comps: R[] = load("comparisons.json"), primary = rows.filter(x => x.primary);
  assert.equal(rows.length, 26); assert.equal(primary.length, 20);
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.primary);
  const highs = rawHighs(cs, 2), bytes = fs.readFileSync(path.join(out, "high-2d.i32")); assert.equal(bytes.length, cs.length * 4);
  for (let i = 0; i < cs.length; i++) { const j = bytes.readInt32LE(i * 4); if (!highs[i]) assert.equal(j, -1); else { assert(j <= i && j > i - 2880); near(cs[j].high, highs[i]); } }
  const index = (end: number) => (end - cs[0].endTs) / M;
  const window = (start: number, end: number) => cs.slice(index(start + M), index(end) + 1);
  const featureCache = new Map<number, R>();
  const rawFeature = (asOf: number): R => {
    const end = Math.floor(asOf / H) * H;
    if (!featureCache.has(end)) {
      const hour = (e: number) => { const xs = window(e - H, e); assert.equal(xs.length, 60);
        return { ts: e - H, endTs: e, open: xs[0].open, close: xs[59].close, high: Math.max(...xs.map(c => c.high)), low: Math.min(...xs.map(c => c.low)),
          volume: xs.reduce((n, c) => n + c.volume, 0), turnover: xs.reduce((n, c) => n + c.turnover, 0) }; };
      const a = hour(end), b = hour(end - H), session = window(Math.floor(a.ts / DAY) * DAY, end);
      const vwap = session.reduce((n, c) => n + c.turnover, 0) / session.reduce((n, c) => n + c.volume, 0);
      featureCache.set(end, { hour: a, previousHour: b, roc1h: 100 * (a.close / b.close - 1), sessionVwap: vwap });
    }
    return { asOf, ...featureCache.get(end)! };
  };
  const tape = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(d.cutoff));
  const fd = (await loadFundingRows("HYPEUSDT_funding.json")).concat(await loadFundingRows("HYPEUSDT_funding_live.jsonl")).sort((a, b) => a.ts - b.ts);
  const historicalRate = (at: number) => { let l = 0, h = fd.length; while (l < h) { const m = (l + h) >>> 1; if (fd[m].ts <= at) l = m + 1; else h = m; } return l ? fd[l - 1].rate : null; };
  const supportMaps = new Map<string, Map<number, R>>();
  for (const w of [...new Set(rows.map(x => x.window))]) {
    const xs = rows.filter(x => x.window === w), needed = new Set<number>();
    for (const x of xs) for (const a of load(`${x.name}-attempts.json`)) needed.add(a.index);
    const sr = new ReplaySrContext(cs, cfg.srShadow), map = new Map<number, R>();
    for (let i = xs[0].startIdx; i < xs[0].endIdx; i++) {
      const c = sr.at(cs[i].endTs);
      if (needed.has(i)) map.set(i, { healthy: c.coverage.healthy, support: structuredClone(c.engine.nearestSupport(cs[i].endTs, cs[i].close)) });
    }
    supportMaps.set(w, map);
  }
  let controls = 0, fills = 0, minutes = 0, targetChecks = 0, highChecks = 0, attemptsChecked = 0, featureChecks = 0, blocks = 0;
  const proofRows: R[] = [];
  for (const x of rows) {
    console.log(`[AG10-E1 verify] ${x.name}`);
    const p = POLICIES.find(p => p.id === x.policy); assert(p); assert.deepEqual(x.spec, p);
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const account = auditCombinationAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, 32000, .00055, { fraction: 1, fillDelayMs: 0 });
    assert.deepEqual(account, x.accounting); fills += events.length; minutes += account.independentMinutes;
    const targets: R[] = load(`${x.name}-targets.json`), obs: R[] = load(`${x.name}-tp-observations.json`), arms: R[] = [];
    targetChecks += auditAgeHighTargets(cs, events, targets, obs, { ...x, control: !p.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {}, t => arms.push(t)).checks;
    assert.equal(arms.length, targets.length); arms.forEach((t, i) => { const a = targets[i]; assert.equal(a.episode, t.episode); assert.equal(a.armedIndex, t.armedIndex); assert.equal(a.armedAt, t.armedAt); near(a.targetPrice, t.targetPrice); assert.equal(a.pct, t.pct); });
    const attempts: R[] = load(`${x.name}-attempts.json`), contexts: R[] = load(`${x.name}-entry-contexts.json`); assert.equal(attempts.length, contexts.length);
    let ptr = 0, inv: R[] = [], episode = 0; const permits = new Map<number, R>(), blockedEpisodes = new Set<number>(), permittedFillIndices = new Set<number>();
    for (let k = 0; k < attempts.length; k++) {
      const a = attempts[k], g = contexts[k], at = cs[a.index].endTs;
      while (ptr < events.length && events[ptr].event.fillIndex <= a.index) { const e = events[ptr++]; inv = e.after; episode = e.episode; }
      assert.equal(a.at, at); assert.equal(a.price, cs[a.index].close); assert.equal(a.nextDepth, inv.length + 1); assert.equal(a.episode, inv.length ? episode : episode + 1);
      assert.equal(a.priceDropOk, !!inv.length && cfg.priceTriggerPct > 0 && a.price <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      near(a.requestedNotional, 800 * 1.35 ** inv.length); near(a.qty, inv.reduce((n, p) => n + p.qty, 0)); near(a.entryCostNotional, inv.reduce((n, p) => n + p.notional, 0));
      for (const field of ["at", "index", "episode", "nextDepth", "priceDropOk"]) assert.equal(a[field], g[field]);
      const snap = tape.snapshot(at), pulse = snap.pulse;
      pulse.fdByNow = pulse.fdByNow ?? historicalRate(at);
      for (const field of ["fdByNow", "fdBnNow", "fdHlNow"]) assert.equal(g[field], (pulse as any)[field]);
      assert.equal(g.hl15, pulse.hlTaker15m); assert.equal(g.hl1h, pulse.hlTaker1h);
      for (const source of Object.values(g.sources) as R[]) if (source) assert(source.availableAt <= at && source.sourceAt <= at);
      const rawBlocked = inv.length >= cfg.deepAddStressGuard.minDepth && !a.priceDropOk && [g.fdByNow, g.fdBnNow, g.fdHlNow].some(v => v !== null && v < cfg.deepAddStressGuard.fundingRateMax);
      assert.equal(g.deepRawBlocked, rawBlocked);
      const support = supportMaps.get(x.window)!.get(a.index)!; assert.equal(g.srHealthy, support.healthy); assert.equal(g.supportPrice, support.support?.lv.price ?? null);
      const reopen = rawBlocked && evaluateSRSupportReopen({ contextHealthy: support.healthy, liveGuardBlocked: rawBlocked,
        liveGuardReasons: g.guardReasons, fundingStressOnly: true, priceDropOk: a.priceDropOk, nextDepth: a.nextDepth,
        support: support.support, pulse, config: cfg.srSupportReopenAction }).eligible;
      assert.equal(g.supportReopen, reopen); assert.equal(g.deepWouldBlock, rawBlocked && !reopen);
      let weak: boolean | null = false;
      if (p.restraint && g.deepWouldBlock) {
        const f = rawFeature(at - x.lag); assert.equal(a.feature.asOf, f.asOf); assert.deepEqual(a.feature.hour, f.hour); assert.deepEqual(a.feature.previousHour, f.previousHour);
        near(a.feature.roc1h, f.roc1h); near(a.feature.sessionVwap, f.sessionVwap);
        assert(f.hour.endTs <= at - x.lag);
        weak = p.restraint === "vwap_roc" ? f.hour.close < f.sessionVwap && f.roc1h < 0 : f.hour.high < f.previousHour.high && f.hour.close < f.previousHour.low;
        featureChecks++;
      } else assert.equal(a.feature, null);
      assert.equal(a.weak, weak); const blocked: boolean = !!p.restraint && !!g.deepWouldBlock && weak !== false;
      assert.equal(a.blocked, blocked); near(a.approvedNotional, blocked ? 0 : a.requestedNotional);
      if (blocked) { blocks++; blockedEpisodes.add(a.episode); assert(!a.priceDropOk && a.nextDepth >= 6 && !reopen); }
      if (!p.legs.includes("minus_deep_stress")) assert(!g.deepWouldBlock);
      if (!p.legs.includes("minus_tp_cooldown")) assert(!g.hotWouldBlock);
      assert(!permits.has(a.index)); permits.set(a.index, a); attemptsChecked++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) { const a = permits.get(e.event.decisionIndex); assert(a && !a.blocked); near(e.event.qty * e.event.price, a.approvedNotional); permittedFillIndices.add(a.index); }
    for (const a of attempts) if (!a.blocked && !permittedFillIndices.has(a.index)) {
      assert.equal(x.pendingAtEnd?.kind, "open"); assert.equal(x.pendingAtEnd?.decisionIndex, a.index);
    }
    assert.equal(x.counts.blockEpisodes, blockedEpisodes.size); assert.equal(x.counts.blockChecks, attempts.filter(a => a.blocked).length);
    assert.equal(x.counts.unknownChecks, 0); assert.equal(x.counts.attempts, attempts.length);
    assert.equal(x.counts.scopeAttempts, contexts.filter(c => c.deepWouldBlock).length);
    assert.equal(x.blocked.researchAddSize ?? 0, x.counts.blockChecks);
    if (p.days) highChecks += auditAgeHighExits(cs, events, x, load(`${x.name}-high-reductions.json`), highs);
    for (const e of events.filter(e => e.event.kind === "close" && ["tp", "stale_tp"].includes(e.event.reason))) {
      const v = e.event, arm = arms.filter(t => t.episode === e.episode && t.armedIndex <= v.decisionIndex).at(-1); assert(arm);
      assert.equal(v.reason, arm.pct < 1.4 ? "stale_tp" : "tp");
      if (v.fillAt === cs[v.fillIndex].endTs) { assert.equal(v.decisionIndex, arm.armedIndex); near(v.price, arm.targetPrice); assert(arm.armedIndex < v.fillIndex); }
      else { assert(arm.armedIndex < v.decisionIndex); assert(cs[v.decisionIndex].close >= arm.targetPrice); }
    }
    if (x.phase === "exact_control") { const old = accepted.find(a => a.model === x.model && a.policy === x.policy)!; assert.equal(x.digest, old.digest); assert.deepEqual(x.metrics, old.metrics); controls++; }
    const comp = comps.find(c => c.name === x.name)!;
    ["baseline", "tp_age10", LEAD].forEach((id, i) => { const b = primary.find(b => b.model === x.model && b.policy === id)!;
      assert.deepEqual(comp[["baseline", "guarded", "parent"][i]], exposureDelta(x.metrics, b.metrics));
      assert.deepEqual(comp.attribution[i], { peer: id, ...componentAttribution(x.metrics, b.metrics) }); });
    proofRows.push({ name: x.name, attempts: attempts.length, blocks: x.counts.blockChecks, blockEpisodes: blockedEpisodes.size });
  }
  assert.equal(controls, 12); assert.deepEqual(load("ranking.json"), qualification(rows, comps, d));
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const receipt = { passed: true, economicCases: rows.length, controlsExact: controls, fills, minutes, targetChecks, highChecks,
    attemptsChecked, featureChecks, blocks, proofRows, newTradingDefinitions: 2, liveChanges: 0, checkerSha256: await fileHash("scripts/aggressive10-selective-verify.ts") };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
