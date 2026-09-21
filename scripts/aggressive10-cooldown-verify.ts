/** Separate cooldown/raw-ledger/permission audit, never a policy input. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, fileHash } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { RSI } from "technicalindicators";
import { verifyStudyDerivatives } from "./aggressive10-cooldown-source";
import { acceptedSourceProof } from "./aggressive10-selective-sources";
import { POLICIES, LEAD, HIGH_REASON, validate, qualification, reopenAttribution } from "./aggressive10-cooldown-policy";
import { auditCombinationAccounting, componentAttribution } from "./ladder-combination-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
import { auditAgeHighTargets, auditAgeHighExits, rawHighs } from "./aggressive10-cooldown-audit";
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
  assert.deepEqual(verifyStudyDerivatives(), load("derivative-proof.json"));
  const d = plan.card.definition; assert.deepEqual(await acceptedSourceProof(plan), load("source-proof.json"));
  const cfg = read("bot-config.json"), cs = await prices(Date.parse(d.cutoff), read(`${d.archive}/manifest.json`).repairFile);
  const rows: R[] = load("results.json"), comps: R[] = load("comparisons.json"), primary = rows.filter(x => x.primary);
  assert.equal(rows.length, 26); assert.equal(primary.length, 20);
  const accepted: R[] = read(`${d.acceptedResults}/output/results.json`).filter((x: R) => x.primary);
  const highs = rawHighs(cs, 2), bytes = fs.readFileSync(path.join(out, "high-2d.i32")); assert.equal(bytes.length, cs.length * 4);
  for (let i = 0; i < cs.length; i++) { const j = bytes.readInt32LE(i * 4); if (!highs[i]) assert.equal(j, -1); else { assert(j <= i && j > i - 2880); near(cs[j].high, highs[i]); } }
  const rsiCache = new Map<number, number>();
  function knownRsi(i: number) {
    if (!rsiCache.has(i)) {
      const bucket = Math.floor(cs[i].ts / H) * H, values: number[] = [];
      for (let k = 199; k >= 1; k--) { const end = bucket - (k - 1) * H, j = (end - cs[0].endTs) / M;
        assert(Number.isInteger(j) && j >= 0 && j < i); values.push(cs[j].close); }
      values.push(cs[i].close); const vals = RSI.calculate({ values, period: 14 }); rsiCache.set(i, vals.at(-1)!);
    }
    return rsiCache.get(i)!;
  }
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
  let controls = 0, fills = 0, minutes = 0, targetChecks = 0, highChecks = 0, attemptsChecked = 0, cooldownChecks = 0, earlyChecks = 0;
  const proofRows: R[] = [];
  for (const x of rows) {
    console.log(`[AG10-C1 verify] ${x.name}`);
    const p = POLICIES.find(p => p.id === x.policy); assert(p); assert.deepEqual(x.spec, p);
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const account = auditCombinationAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, 32000, .00055, { fraction: 1, fillDelayMs: 0 });
    assert.deepEqual(account, x.accounting); fills += events.length; minutes += account.independentMinutes;
    const targets: R[] = load(`${x.name}-targets.json`), obs: R[] = load(`${x.name}-tp-observations.json`), arms: R[] = [];
    targetChecks += auditAgeHighTargets(cs, events, targets, obs, { ...x, control: !p.ageHours, policy: { id: "baseline", family: "age" }, sensitivity: { sourceLagMs: 0, releaseDelayMs: 0 } }, {}, cfg, {}, t => arms.push(t)).checks;
    assert.equal(arms.length, targets.length); arms.forEach((t, i) => { const a = targets[i]; assert.equal(a.episode, t.episode); assert.equal(a.armedIndex, t.armedIndex); assert.equal(a.armedAt, t.armedAt); near(a.targetPrice, t.targetPrice); assert.equal(a.pct, t.pct); });
    const attempts: R[] = load(`${x.name}-attempts.json`), contexts: R[] = load(`${x.name}-entry-contexts.json`); assert.equal(attempts.length, contexts.length);
    let ptr = 0, inv: R[] = [], episode = 0; const permits = new Map<number, R>(), permittedFillIndices = new Set<number>();
    const cooldowns: R[] = load(`${x.name}-cooldowns.json`); let ci = 0, currentCooldown: R | null = null;
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
      near(a.approvedNotional, a.requestedNotional);
      while (ci < cooldowns.length && cooldowns[ci].index <= a.index) currentCooldown = cooldowns[ci++];
      if (currentCooldown) { assert(a.at >= currentCooldown.until); assert(a.index > currentCooldown.index, "No same-close-bar reentry"); }
      if (!p.legs.includes("minus_deep_stress")) assert(!g.deepWouldBlock);
      if (!p.legs.includes("minus_tp_cooldown")) assert(!g.hotWouldBlock);
      assert(!permits.has(a.index)); permits.set(a.index, a); attemptsChecked++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) { const a = permits.get(e.event.decisionIndex); assert(a); near(e.event.qty * e.event.price, a.approvedNotional); permittedFillIndices.add(a.index); }
    for (const a of attempts) if (!permittedFillIndices.has(a.index)) {
      assert.equal(x.pendingAtEnd?.kind, "open"); assert.equal(x.pendingAtEnd?.decisionIndex, a.index);
    }
    assert.equal(x.counts.attempts, attempts.length);
    const fulls = events.filter(e => e.event.kind === "close"); assert.equal(cooldowns.length, fulls.length);
    let until = 0, expectedBlocked = 0;
    fulls.forEach((e, i) => {
      const v = e.event, row = cooldowns[i], isTp = ["tp", "stale_tp"].includes(v.reason);
      assert.equal(row.at, v.fillAt); assert.equal(row.index, v.fillIndex); assert.equal(row.episode, e.episode); assert.equal(row.reason, v.reason);
      const rsiIndex = v.fillAt === cs[v.fillIndex!].endTs ? v.fillIndex! - 1 : v.decisionIndex;
      near(row.rsi, knownRsi(rsiIndex)); assert.equal(row.priorUntil, until);
      let inherited = until;
      if (isTp) { if (!p.legs.includes("minus_tp_cooldown") && row.rsi > cfg.tpCooldown.rsi1hThreshold) inherited = v.fillAt + cfg.tpCooldown.cooldownMin * M; }
      else inherited = (Math.floor(v.fillAt / (4 * H)) + 2) * 4 * H;
      assert.equal(row.inheritedUntil, inherited);
      until = v.reason === HIGH_REASON && p.highExitCooldownHours !== undefined ? v.fillAt + p.highExitCooldownHours * H : inherited;
      assert.equal(row.until, until);
      for (let j = v.fillIndex + 1; j < x.endIdx && cs[j].endTs < until; j++) expectedBlocked++;
      cooldownChecks++;
    });
    assert.equal(x.blocked.cooldown, expectedBlocked, "Every cooldown-blocked minute");
    const outcome = reopenAttribution(events, cooldowns, x.metrics, Date.parse(x.end));
    const { reopens, ...expectedCounts } = outcome;
    assert.deepEqual(load(`${x.name}-reopens.json`), reopens);
    assert.deepEqual(x.counts, { attempts: attempts.length, ...expectedCounts });
    for (const r of reopens) {
      const close = fulls.find(e => e.episode === r.highExitEpisode)!;
      const open = events.find(e => e.episode === r.episode && e.event.kind === "open" && !e.before.length)!;
      assert.equal(close.event.reason, HIGH_REASON); assert.equal(open.event.fillAt, r.entryAt);
      assert.equal(r.early, open.event.decisionAt < (Math.floor(close.event.fillAt / (4 * H)) + 2) * 4 * H);
      if (r.early) { assert(p.highExitCooldownHours); earlyChecks++; }
    }
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
    proofRows.push({ name: x.name, attempts: attempts.length, cooldowns: cooldowns.length, earlyReopens: x.counts.earlyReopens });
  }
  assert.equal(controls, 12); assert.deepEqual(load("ranking.json"), qualification(rows, comps, d));
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const receipt = { passed: true, economicCases: rows.length, controlsExact: controls, fills, minutes, targetChecks, highChecks,
    attemptsChecked, cooldownChecks, earlyChecks, proofRows, newTradingDefinitions: 2, liveChanges: 0, checkerSha256: await fileHash("scripts/aggressive10-cooldown-verify.ts") };
  atomicJson(path.join(dir, "verification.json"), receipt); console.log(JSON.stringify(receipt));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
