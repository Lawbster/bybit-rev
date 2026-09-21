/** Stage3 only: unchanged canonical baselines, exact deep encounters, four standalone vetoes. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { Candle } from "../src/fetch-candles";
import type { ResearchAddDecision, ResearchInventoryEvent } from "./replay-causal-engine";
import { LadderIndicatorTape, INDICATOR_VARIANTS, indicatorVeto, type IndicatorVariant, type IndicatorContext } from "./ladder-indicator-policy";
import { exposureMetrics, exposureDelta, qualifyExposure, type ExposureMetrics } from "./ladder-exposure-metrics";
import { auditInventory } from "./ladder-sizing-audit";
const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
type DecisionRow = { decision: Readonly<ResearchAddDecision>; context: IndicatorContext | null; veto: boolean; unknown: boolean; reason: string };

/** Post-run labels only, keyed to actual retained/removed position identities. */
function attribute(inventory: ResearchInventoryEvent[], decisions: DecisionRow[], metrics: ExposureMetrics, mark: { price: number; at: number }, fee: number) {
  const byDecision = new Map(decisions.map(d => [d.decision.index, d]));
  const positions = new Map<string, any>(); const episodeEntries = new Map<number, string>();
  const net = (p: { entryPrice: number; qty: number; notional: number }, price: number) => (price - p.entryPrice) * p.qty - fee * (p.notional + price * p.qty);
  for (const e of inventory) {
    if (e.event.kind === "open") {
      const p = e.after.at(-1)!, d = byDecision.get(e.event.decisionIndex); assert(d && !d.veto);
      if (!episodeEntries.has(e.episode)) episodeEntries.set(e.episode, new Date(e.event.fillAt!).toISOString());
      assert(!positions.has(p.id));
      positions.set(p.id, { positionId: p.id, episode: e.episode, decisionIndex: e.event.decisionIndex,
        nextDepth: e.after.length, priceDropOk: d.decision.priceDropOk, context: d.context, at: d.decision.at,
        fillAt: e.event.fillAt, entryPrice: p.entryPrice, qty: p.qty, notional: p.notional,
        closed: false, exitAt: null, exitPrice: null, exitReason: null, realizedPnl: 0, markedPnl: 0 });
    } else {
      // Current baseline models complete selected-ID partials, not fragmented pro-rata fills.
      for (const p of e.before.filter(p => !e.after.some(a => a.id === p.id))) {
        const x = positions.get(p.id); assert(x && !x.closed);
        Object.assign(x, { closed: true, exitAt: e.event.fillAt, exitPrice: e.event.price, exitReason: e.event.reason, realizedPnl: net(p, e.event.price!) });
      }
    }
  }
  for (const p of inventory.at(-1)?.after ?? []) positions.get(p.id).markedPnl = net(p, mark.price);
  const rows = [...positions.values()];
  assert(Math.abs(rows.reduce((v, p) => v + p.realizedPnl + p.markedPnl, 0) - metrics.totalPnl) < 1e-6);
  const outcomes = new Map(metrics.episodes.map(e => [e.entry, e]));
  const deep = rows.filter(p => p.nextDepth >= 9);
  const features = deep.map(p => ({ positionId: p.positionId, episode: p.episode, decisionIndex: p.decisionIndex,
    at: p.at, nextDepth: p.nextDepth, priceDropOk: p.priceDropOk, context: p.context }));
  const labels = deep.map(p => ({ positionId: p.positionId, episode: p.episode, fillAt: p.fillAt,
    entryPrice: p.entryPrice, qty: p.qty, notional: p.notional, closed: p.closed, exitAt: p.exitAt,
    exitPrice: p.exitPrice, exitReason: p.exitReason, realizedPnl: p.realizedPnl, markedPnl: p.markedPnl,
    episodeOutcome: outcomes.get(episodeEntries.get(p.episode)!) ?? null }));
  const cohorts: any[] = [];
  for (const trigger of ["all", "timer_only", "price_drop"]) {
    const eligible = deep.filter(p => p.nextDepth === 11 && (trigger === "all" || p.priceDropOk === (trigger === "price_drop")));
    for (const rule of [null, ...INDICATOR_VARIANTS]) {
      const xs = eligible.filter(p => !rule || indicatorVeto(rule, { at: p.at, nextDepth: p.nextDepth }, p.context).veto);
      const ep = [...new Set<number>(xs.map(p => p.episode))].map(id => outcomes.get(episodeEntries.get(id)!)).filter(Boolean);
      cohorts.push({ trigger, condition: rule?.id ?? "all_rung11", fills: xs.length, episodes: new Set(xs.map(p => p.episode)).size,
        closedRungs: xs.filter(p => p.closed).length, winningRungs: xs.filter(p => p.closed && p.realizedPnl > 0).length,
        losingRungs: xs.filter(p => p.closed && p.realizedPnl < 0).length,
        rungWinDollars: xs.reduce((v, p) => v + Math.max(0, p.realizedPnl), 0),
        rungLossDollars: xs.reduce((v, p) => v + Math.min(0, p.realizedPnl), 0),
        rungRealized: xs.reduce((v, p) => v + p.realizedPnl, 0), rungMarked: xs.reduce((v, p) => v + p.markedPnl, 0),
        completedEpisodes: ep.length, losingEpisodes: ep.filter(e => e!.pnl < 0).length,
        episodeNet: ep.reduce((v, e) => v + e!.pnl, 0) });
    }
  }
  return { features, labels, cohorts };
}

async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/indicators/ladder-single-2026-09-05.json";
  const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(root, f), "utf8"));
  const spec = read(definition), baseSpec = read(spec.baseSpec), cfg: BotConfig = read("bot-config.json");
  assert.equal(spec.variantCount, 4); assert.deepEqual(spec.variants.map(({ id, family }: any) => ({ id, family })), INDICATOR_VARIANTS);
  assert.equal(cfg.symbol, "HYPEUSDT"); assert.equal(cfg.maxPositions, 11); assert.equal(cfg.feeRate, .00055);
  const args = process.argv.slice(2); assert(args.length === 0 || args.length === 2 && args[0] === "--out");
  const out = path.resolve(root, args[1] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Use NEW output directory inside backtests");
  const previous = read(`${spec.baselineDir}/manifest.json`), priorBases = read(`${spec.baselineDir}/baseline.json`);
  const models = read(`${baseSpec.baselineDir}/summary.json`);
  const standalone = read(`${spec.standaloneDir}/manifest.json`);
  assert(read(`${spec.standaloneDir}/verification.json`).passed);
  console.log("[preflight] pin prior engine/config, raw inputs, standalone formulas and corrected baseline artifacts");
  for (const x of previous.sources) assert.equal(await fileHash(x.file), x.sha256, `Prior source drift: ${x.file}`);
  for (const x of standalone.sources) assert.equal(await fileHash(x.file), x.sha256, `Stage2 source drift: ${x.file}`);
  const inputs = [];
  for (const x of previous.inputs) { assert.equal(await fileHash(x.file), x.sha256, x.file); inputs.push(x); }
  for (const f of [`${spec.baselineDir}/baseline.json`, `${spec.baselineDir}/manifest.json`, `${spec.standaloneDir}/manifest.json`, `${spec.standaloneDir}/verification.json`]) inputs.push({ file: f, sha256: await fileHash(f) });
  const files = [...new Set<string>([...previous.sources.map((s: any) => s.file), ...standalone.sources.map((s: any) => s.file), definition,
    "scripts/hype-ladder-indicator-study.ts", "scripts/ladder-indicator-policy.ts", "scripts/ladder-indicator-tests.ts"] )];
  const sources = files.map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  fs.mkdirSync(out, { recursive: true });
  const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (f: string, x: unknown[]) => fs.writeFileSync(path.join(out, f), x.map(v => JSON.stringify(v)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, baseSpec, inputs, sources, liveChanges: 0 });
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = baseSpec.historyEnd; process.env.SIM_EQUITY = String(baseSpec.initialEquity);
  const core = await import("./hype-freerun-canonical-replay"), { runCausalLongReplay } = await import("./replay-causal-engine");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const s = await core.buildSeries({ candleRepairFile: path.join(root, baseSpec.repairFile) }); assert.equal(missingMinutes(s.candles).length, 0);
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), "HYPEUSDT", Date.parse(baseSpec.historyEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  // Reuse already-verified actual-turnover archive, but independently reconstruct exact same fixed-seed hourly inputs.
  assert.equal(standalone.imputedTurnoverRows, 0); assert.equal(standalone.missingMinutes, 0);
  const minutes: Candle[] = s.candles.filter(c => c.ts >= Date.parse(spec.indicatorSeed)).map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  assert.equal(minutes[0].timestamp, Date.parse(spec.indicatorSeed)); assert.equal(minutes.length, standalone.minuteRows);
  const tape = new LadderIndicatorTape(minutes);
  for (const index of [60 * 800, Math.floor(minutes.length / 2 / 60) * 60, minutes.length - 61]) {
    const at = minutes[index].timestamp + 60000;
    assert.deepEqual(new LadderIndicatorTape(minutes.slice(0, index + 1)).at(at), tape.at(at));
  }
  const baselines: any[] = [], results: any[] = [], allCohorts: any[] = [];
  function run(model: any, variant: IndicatorVariant | null) {
    const label = `${model.id}--${variant?.id ?? "baseline"}`, inventory: ResearchInventoryEvent[] = [], decisions: DecisionRow[] = [];
    const affected = new Set<number>();
    const opts = { startIdx: core.lowerBound(s.candles, Date.parse(model.start), c => c.endTs),
      endIdx: core.lowerBound(s.candles, Date.parse(model.end) + 1, c => c.endTs), recordSnapshots: true, partialClockModel: "transactional" as const,
      researchInventoryObserver: (e: Readonly<ResearchInventoryEvent>) => { inventory.push(e); },
      researchAddVeto: (d: Readonly<ResearchAddDecision>) => {
        const context = d.nextDepth >= 9 ? tape.at(d.at) : null;
        const result = variant ? indicatorVeto(variant, d, context) : { veto: false, unknown: false, reason: "baseline" };
        decisions.push({ decision: d, context, ...result }); if (result.veto) affected.add(d.episode);
        return result.veto;
      } };
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id: model.id, executionModel: "causal_next_open",
      tpExecutionModel: model.id.endsWith("resting_touch") ? "resting_touch" : "close_confirmed", maxPositions: cfg.maxPositions,
      hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    const r = runCausalLongReplay(params, s, opts, cfg, baseSpec.initialEquity);
    const digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    if (!variant) assert.equal(digest, priorBases.find((b: any) => b.model === model.id).digest, `Corrected baseline drift: ${model.id}`);
    const metrics = exposureMetrics(r, baseSpec.initialEquity), audit = auditInventory(inventory, cfg, metrics);
    if (!variant) assert.deepEqual(metrics, priorBases.find((b: any) => b.model === model.id).metrics);
    const permissions = new Map(decisions.map(d => [d.decision.index, d]));
    for (const e of inventory.filter(e => e.event.kind === "open")) {
      const permit = permissions.get(e.event.decisionIndex); assert(permit && !permit.veto);
      assert.equal(e.event.fillIndex, e.event.decisionIndex + 1);
      assert.equal(e.event.price, s.candles[e.event.fillIndex!].open);
      assert(Math.abs(e.after.at(-1)!.notional - cfg.basePositionUsdt * cfg.addScaleFactor ** (e.after.length - 1)) < 1e-6);
    }
    const last = r.snapshots.at(-1)!, turnover = inventory.reduce((v, e) => v + e.event.qty * e.event.price!, 0) + last.longQty * last.price;
    const endMark = { at: last.ts, price: last.price, qty: last.longQty };
    const data = { model: model.id, start: model.start, end: model.end, variant: variant?.id ?? "baseline", digest,
      vetoEpisodes: affected.size, vetoDecisions: decisions.filter(d => d.veto).length, unknownDecisions: decisions.filter(d => d.unknown).length,
      metrics, audit, endMark, pendingAtEnd: r.executionAudit!.pendingAtEnd,
      stress: { executedPlusMarkedExitTurnover: turnover, fixedPathNet: metrics.totalPnl - turnover * .0005 } };
    jsonl(`${label}-decisions.jsonl`, decisions); jsonl(`${label}-inventory.jsonl`, inventory);
    // A small independent verifier can reconstruct monthly MTM from these boundary prices and the inventory ledger.
    const monthEnds = new Map(r.snapshots.map(x => [new Date(x.ts).toISOString().slice(0, 7), x]));
    json(`${label}-month-marks.json`, metrics.monthly.map(m => {
      const snap = monthEnds.get(m.month)!;
      return { month: m.month, at: snap.ts, price: snap.price };
    }));
    if (!variant) {
      const attributed = attribute(inventory, decisions, metrics, endMark, cfg.feeRate);
      jsonl(`${label}-features.jsonl`, attributed.features); jsonl(`${label}-outcomes.jsonl`, attributed.labels);
      allCohorts.push(...attributed.cohorts.map(x => ({ model: model.id, ...x })));
      const trace = decisions.find(d => d.decision.nextDepth === 11)!; assert(trace?.context);
      const prefix = minutes.filter(c => c.timestamp + 60000 <= trace.decision.at);
      assert.deepEqual(new LadderIndicatorTape(prefix).at(trace.decision.at), trace.context);
      json(`${label}-causal-trace.json`, { ...trace, hypotheticallyBlockedBy: INDICATOR_VARIANTS.filter(v => indicatorVeto(v, trace.decision, trace.context).veto).map(v => v.id), sourcePrefixVerified: true });
    }
    json(`${label}-summary.json`, data);
    console.log(`[case] ${label} net=${metrics.totalPnl.toFixed(2)} dd=${metrics.maxDrawdownPct.toFixed(2)} wins=${metrics.profitableEpisodes} losses=${metrics.losingEpisodes} affected=${affected.size}`);
    return data;
  }
  // No intervention runs before all four full-result AND summary baselines reproduce.
  for (const model of models) { baselines.push(run(model, null)); json("baseline.json", baselines); }
  assert.equal(baselines.length, 4); json("baseline-cohorts.json", allCohorts); core.writeCsv(path.join(out, "baseline-cohorts.csv"), allCohorts);
  for (const model of models) for (const variant of INDICATOR_VARIANTS) {
    const r = run(model, variant), base = baselines.find(b => b.model === model.id)!;
    results.push({ ...r, delta: exposureDelta(r.metrics, base.metrics), fixedPathStressDelta: r.stress.fixedPathNet - base.stress.fixedPathNet });
    json("results.json", results);
  }
  const ranking = INDICATOR_VARIANTS.map(v => ({ ...v, ...qualifyExposure(results.filter(r => r.variant === v.id), baseSpec) }));
  json("ranking.json", ranking);
  const summaries = [...baselines, ...results].map(({ metrics, delta, ...r }) => ({ model: r.model, variant: r.variant, start: r.start, end: r.end,
    ...Object.fromEntries(Object.entries(metrics).filter(([k]) => !["monthly", "episodes"].includes(k))),
    vetoEpisodes: r.vetoEpisodes, vetoDecisions: r.vetoDecisions, unknownDecisions: r.unknownDecisions,
    pnlDelta: delta?.pnlDelta ?? 0, ddReductionPp: delta?.ddReductionPp ?? 0, worstMonthDelta: delta?.worstMonthDelta ?? 0 }));
  core.writeCsv(path.join(out, "summary.csv"), summaries);
  const monthly = [...baselines, ...results].flatMap(r => r.metrics.monthly.map((m: any) => {
    const closed = r.metrics.episodes.filter((e: any) => e.close.slice(0, 7) === m.month), base = baselines.find(b => b.model === r.model).metrics.monthly.find((b: any) => b.month === m.month);
    return { model: r.model, variant: r.variant, ...m, baselineMtmPnl: base.mtmPnl, mtmDelta: m.mtmPnl - base.mtmPnl,
      wins: closed.filter((e: any) => e.pnl > 0).length, losses: closed.filter((e: any) => e.pnl < 0).length,
      winningDollars: closed.reduce((n: number, e: any) => n + Math.max(0, e.pnl), 0), losingDollars: closed.reduce((n: number, e: any) => n + Math.min(0, e.pnl), 0) };
  }));
  json("monthly.json", monthly); core.writeCsv(path.join(out, "monthly.csv"), monthly);
  for (const x of [...sources, ...inputs]) assert.equal(await fileHash(x.file), x.sha256, `Mutated source/input: ${x.file}`);
  assert.equal(results.length, spec.caseCount);
  json("validation.json", { correctedBaselineDigestsAndMetricsMatched: 4, variantCases: results.length,
    prefixFeatureChecks: 7, sourceHashesUnchanged: true, inventoryAuditPassed: true, executionPermissionChecks: true,
    qualification: ranking, liveChanges: 0, exactLiveParityCertified: false });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
