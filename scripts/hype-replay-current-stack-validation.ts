/** Local-only acceptance run. No strategy variants, exchange access, or output overwrite. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { BotConfig } from "../src/bot/bot-config";

async function main() {
  const root = path.resolve(__dirname, ".."), endAt = Date.parse(process.env.REPLAY_END ?? "2026-09-04T19:01:00Z");
  if (!Number.isFinite(endAt)) throw new Error("Invalid REPLAY_END");
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = new Date(endAt).toISOString(); process.env.SIM_EQUITY = "32000";
  const out = path.resolve(root, process.env.REPLAY_OUT ?? "backtests/hype/current-stack-foundation-2026-09-04");
  const rel = path.relative(path.join(root, "backtests"), out);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || fs.existsSync(out)) throw new Error("Use a NEW output directory within backtests/");
  const core = await import("./hype-freerun-canonical-replay");
  const repairFile = process.env.REPLAY_CANDLE_REPAIR ? path.resolve(root, process.env.REPLAY_CANDLE_REPAIR) : undefined;
  const repairModule = await import("./replay-candle-repair");
  const repair = repairFile ? { file: path.relative(root, repairFile), sha256: repairModule.sha256(fs.readFileSync(repairFile)), bundle: repairModule.readCandleRepair(repairFile) } : null;
  const { loadReplayMarketInputs } = await import("./replay-market-inputs");
  const { rebuildDamagedLatch, addReplayTaker } = await import("./replay-damaged-latch");
  const dormant = await import("./hype-dormant-edge-replay");
  const config: BotConfig = JSON.parse(fs.readFileSync(path.join(root, "bot-config.json"), "utf8"));
  const sources = ["scripts/replay-causal-engine.ts", "scripts/replay-market-inputs.ts", "scripts/replay-sr-context.ts", "scripts/replay-causality.ts", "scripts/replay-damaged-latch.ts", "scripts/hype-freerun-canonical-replay.ts", "scripts/hype-dormant-edge-replay.ts", "scripts/hype-replay-current-stack-validation.ts", "src/hl-data-quality.ts", "src/bot/sr-support-reopen.ts", "src/bot/sr-shadow.ts", "src/bot/sr-memory-zones.ts", "src/bot/sr-levels.ts", "src/bot/strategy.ts", "src/bot/damaged-regime-latch.ts", "bot-config.json"];
  sources.push("scripts/replay-candle-repair.ts");
  const hashes = sources.map(file => ({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") }));
  const inputs = fs.readdirSync(path.join(root, "data")).filter(f => /^(HYPE|BTCUSDT).*(\.json|\.jsonl)$/.test(f)).map(file => {
    const st = fs.statSync(path.join(root, "data", file)); return { file, bytes: st.size, mtimeMs: st.mtimeMs };
  });
  fs.mkdirSync(out, { recursive: true });
  const write = (file: string, obj: unknown) => fs.writeFileSync(path.join(out, file), JSON.stringify(obj, null, 2) + "\n");
  write("manifest.json", { createdAt: new Date().toISOString(), initialEquity: 32000, endAt, sources: hashes, inputs,
    candleRepair: repair ? { file: repair.file, sha256: repair.sha256, purpose: repair.bundle.purpose, retrievedAt: repair.bundle.retrievedAt } : null,
    qualifications: ["Causal minute-market execution, not maker fill certification", "Old missing receipt times remain explicit assumptions", "No actual funding settlement accounting", "Model comparison is not a live profit forecast"] });
  // Scope the large unrepaired arrays so they can be collected before rebuilding
  // indicators with inserted minutes. Never insert rows into already-built arrays.
  const preservedSeries = await (async () => {
    const s = await core.buildSeries();
    // Reproduce the last repaired-but-retrospective control before changing the
    // execution/policy path. A new baseline is not supposed to equal biased fills.
    console.log("[control] reproducing source-time-only legacy baseline");
    await dormant.attachDormantSeries(s, Math.max(0, core.lowerBound(s.candles, Date.parse("2026-05-03T20:43:00Z"), c => c.endTs)));
    const legacyTaker: import("./replay-damaged-latch").ReplayTaker = new Map();
    await core.streamJsonl(path.join(root, "data/HYPEUSDT_taker_hyperliquid.jsonl"), row => addReplayTaker(legacyTaker, row));
    const legacyLatch = rebuildDamagedLatch(s.candles, config.filters.damagedRegimeLatch!, legacyTaker);
    const legacy = core.runEngine({ id: "legacy_control", executionModel: "legacy_ohlc", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none",
      srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: .3, minLadderPnlPct: .25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 }, supportReopen: { minNextDepth: 5, bufferPct: 1, mode: "buy_pressure" } } },
      { ...s, regimeFlat: s.regimeFlat.map((v, i) => v || legacyLatch.blocked[i]) },
      { startIdx: core.lowerBound(s.candles, Date.parse("2025-07-01T00:00:00Z"), c => c.endTs), endIdx: core.lowerBound(s.candles, Date.parse("2026-08-19T21:32:00Z") + 1, c => c.endTs) });
    const legacyControl = { realized: legacy.realized, closes: legacy.closes.length, partials: legacy.trims.length,
      expectedRealized: 64976.97226041745, expectedCloses: 990, expectedPartials: 106,
      matched: Math.abs(legacy.realized - 64976.97226041745) < 1e-6 && legacy.closes.length === 990 && legacy.trims.length === 106 };
    write("legacy-control.json", legacyControl);
    if (!legacyControl.matched) throw new Error(`Legacy control changed: ${JSON.stringify(legacyControl)}`);
    legacyTaker.clear();
    return repairFile ? null : s;
  })();
  if (repairFile) console.log("[repair] rebuilding all indicators from the opt-in corrected candle history");
  const s = preservedSeries ?? await core.buildSeries({ candleRepairFile: repairFile });
  const remainingGaps = repairModule.missingMinutes(s.candles);
  write("candle-coverage.json", { repairedHistory: !!repair, remainingMissingMinutes: remainingGaps.map(ts => new Date(ts).toISOString()),
    evidenceTargets: repair?.bundle.evidence.length ?? 0, originalLiveArrivalProven: false });
  if (repair && remainingGaps.length) throw new Error("Corrected-history acceptance requires all internal candle gaps to be resolved");
  console.log("[quality] loading point/flow input tape");
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), config.symbol, endAt);
  const btc = await core.loadCandles1m("BTCUSDT");
  let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  console.log("[quality] rebuilding latch using the same event-window pulse tape");
  const latch = rebuildDamagedLatch(s.candles, config.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((x, i) => x || latch.blocked[i]);
  write("input-quality.json", { ...s.marketInputs.audit, lastSnapshot: s.marketInputs.snapshot(s.candles.at(-1)!.endTs), latch: latch.transitions });
  const windows = [{ id: "published_window", start: Date.parse("2025-07-01T00:00:00Z"), end: Math.min(endAt, Date.parse("2026-08-19T21:32:00Z")) },
    { id: "hl_window_latest", start: Date.parse("2026-05-17T20:43:00Z"), end: endAt }];
  const summary: unknown[] = [];
  for (const w of windows) for (const tpExecutionModel of ["close_confirmed", "resting_touch"] as const) {
    const id = `${w.id}-${tpExecutionModel}`, opts = { startIdx: core.lowerBound(s.candles, w.start, c => c.endTs), endIdx: core.lowerBound(s.candles, w.end + 1, c => c.endTs) };
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id, executionModel: "causal_next_open", tpExecutionModel,
      maxPositions: config.maxPositions, hardFlattenHours: config.exits.hardFlattenHours, hardFlattenPct: config.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    console.log(`[run] ${id}`);
    const r = core.runEngine(params, s, opts), repeat = core.runEngine(params, s, opts);
    const digest = (x: typeof r) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
    if (digest(r) !== digest(repeat)) throw new Error(`Non-deterministic run: ${id}`);
    const bad = r.executionAudit!.events.filter(e => e.fillAt! < e.decisionAt || e.fillIndex! <= e.decisionIndex);
    if (bad.length) throw new Error(`Retrospective fill in ${id}`);
    core.writeCsv(path.join(out, `${id}-closes.csv`), r.closes); core.writeCsv(path.join(out, `${id}-partials.csv`), r.trims);
    core.writeCsv(path.join(out, `${id}-executions.csv`), r.executionAudit!.events);
    const months = new Map<string, number>();
    for (const x of r.closes) months.set(x.closeIso.slice(0, 7), (months.get(x.closeIso.slice(0, 7)) ?? 0) + x.pnl);
    for (const x of r.trims) months.set(x.iso.slice(0, 7), (months.get(x.iso.slice(0, 7)) ?? 0) + x.pnl);
    core.writeCsv(path.join(out, `${id}-monthly.csv`), [...months].sort().map(([month, realizedPnl]) => ({ month, realizedPnl })));
    const row = { id, start: new Date(w.start).toISOString(), end: new Date(w.end).toISOString(), realized: r.realized, openPnl: r.openPnl, totalPnl: r.realized + r.openPnl,
      evaluatedMinutes: opts.endIdx - opts.startIdx, srContextUnhealthyMinutes: r.blocked.srContext,
      srContextHealthyPct: 100 * (1 - r.blocked.srContext / (opts.endIdx - opts.startIdx)),
      closes: r.closes.length, partials: r.trims.length, openDepth: r.openDepth, maxDrawdownPct: r.maxDrawdownPct, blocks: r.blocked,
      pendingAtEnd: r.executionAudit!.pendingAtEnd, identicalRepeat: true, digest: digest(r), retrospectiveFills: bad.length };
    summary.push(row); write("summary.json", summary); console.log(JSON.stringify(row));
  }
  for (const x of inputs) { const st = fs.statSync(path.join(root, "data", x.file)); if (st.size !== x.bytes || st.mtimeMs !== x.mtimeMs) throw new Error(`Raw data changed during validation: ${x.file}`); }
  for (const x of hashes) if (crypto.createHash("sha256").update(fs.readFileSync(path.join(root, x.file))).digest("hex") !== x.sha256) throw new Error(`Source changed during validation: ${x.file}`);
  if (repair && repairFile) {
    if (repairModule.sha256(fs.readFileSync(repairFile)) !== repair.sha256) throw new Error("Candle repair changed during the run");
    for (const input of repair.bundle.originalInputs) {
      const hash = crypto.createHash("sha256");
      for await (const chunk of fs.createReadStream(path.join(root, input.file))) hash.update(chunk);
      if (hash.digest("hex") !== input.sha256) throw new Error(`Original candle archive changed since recovery: ${input.file}`);
    }
  }
  write("validation.json", { legacyControlMatched: true, repeatedResultsEqual: true, noRetrospectiveFills: true, sourceAndInputMetadataUnchanged: true,
    repairedHistory: !!repair, originalCandleContentHashesUnchanged: repair ? true : null, remainingCandleGaps: remainingGaps.length, strategyVariantsTested: 0, exactLiveParityCertified: false });
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
