/** Local baseline attribution; never imports an order executor or writes live files. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import type { DeepAddSpec } from "./ladder-deep-add-attribution";
import type { BotConfig } from "../src/bot/bot-config";

const hash = (x: string | Buffer) => crypto.createHash("sha256").update(x).digest("hex");
async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
async function main() {
  const root = path.resolve(__dirname, ".."), definition = "research-inputs/sr-pulse-encounters/ladder-deep-adds-2026-09-05.json";
  const spec: DeepAddSpec = JSON.parse(fs.readFileSync(path.join(root, definition), "utf8"));
  // Must precede imports of the legacy module holding frozen canonical constants.
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = spec.historyEnd; process.env.SIM_EQUITY = "32000";
  assert(process.argv.length === 2, "Use the documented environment override, not legacy CLI switches");
  const cfg: BotConfig = JSON.parse(fs.readFileSync(path.join(root, "bot-config.json"), "utf8")); assert.equal(cfg.symbol, spec.symbol);
  const oldDir = path.join(root, spec.baselineDir), old = JSON.parse(fs.readFileSync(path.join(oldDir, "manifest.json"), "utf8"));
  const expected = JSON.parse(fs.readFileSync(path.join(oldDir, "summary.json"), "utf8")); assert.equal(expected.length, 4);
  const oldValidation = JSON.parse(fs.readFileSync(path.join(oldDir, "validation.json"), "utf8"));
  assert(oldValidation.repeatedResultsEqual && oldValidation.noRetrospectiveFills && oldValidation.remainingCandleGaps === 0);
  for (const s of old.sources) assert.equal(await fileHash(path.join(root, s.file)), s.sha256, `Changed baseline source: ${s.file}`);
  for (const f of old.inputs) { const st = fs.statSync(path.join(root, "data", f.file)); assert.equal(st.size, f.bytes, f.file); assert.equal(st.mtimeMs, f.mtimeMs, f.file); }
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, spec.sourceManifest), "utf8"));
  const consumed = [...new Set([...sourceManifest.inputs.map((x: any) => String(x.file)), "data/BTCUSDT_1_full.json", "data/BTCUSDT_1m.jsonl", "data/HYPEUSDT_funding.json"])];
  console.log("[manifest] verify prior input hashes; fingerprint exact baseline, definition and attribution source");
  const inputs = [];
  for (const file of consumed) {
    const st = fs.statSync(path.join(root, file)), digest = await fileHash(path.join(root, file));
    const prior = sourceManifest.inputs.find((x: any) => x.file === file); if (prior) assert.equal(digest, prior.sha256, `Changed input: ${file}`);
    inputs.push({ file, bytes: st.size, sha256: digest });
  }
  const files = [...new Set([...old.sources.map((x: any) => String(x.file)), "scripts/hype-ladder-deep-add-study.ts", "scripts/ladder-deep-add-attribution.ts", "scripts/ladder-deep-add-tests.ts", definition, "package-lock.json", "tsconfig.json"])];
  const sources = files.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
  const out = path.resolve(root, process.env.DEEP_ADD_OUT ?? `backtests/hype/${spec.id}`), relative = path.relative(path.join(root, "backtests"), out);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && !fs.existsSync(out), "Choose a NEW output directory under backtests/");
  fs.mkdirSync(out, { recursive: true });
  const json = (name: string, value: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
  const jsonl = (name: string, values: unknown[]) => fs.writeFileSync(path.join(out, name), values.map(v => JSON.stringify(v)).join("\n") + "\n");
  json("manifest.json", { at: new Date().toISOString(), node: process.version, spec, inputs, sources, initialEquity: 32000,
    baselineSummarySha256: hash(fs.readFileSync(path.join(oldDir, "summary.json"))), policyChanges: 0,
    caveats: ["Simulated baseline fills, not verified historical live opens", "Rung attribution is not skip/delay counterfactual PnL", "Previously mined development history", "No shorts or actual maker/funding model"] });
  const core = await import("./hype-freerun-canonical-replay"), { attributeAdds, summarizeAdds } = await import("./ladder-deep-add-attribution");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs"), { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const s = await core.buildSeries({ candleRepairFile: path.join(root, spec.repairFile) }); assert.equal(missingMinutes(s.candles).length, 0);
  s.marketInputs = await loadReplayMarketInputs(path.join(root, "data"), spec.symbol, Date.parse(spec.historyEnd));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000 ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch!, new Map(), now => s.marketInputs!.latchPulse(now));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const summaries: any[] = [], monthly: any[] = [], cohortRows: any[] = [], baseline: any[] = [];
  for (const prior of expected) {
    const tpExecutionModel = prior.id.endsWith("resting_touch") ? "resting_touch" : "close_confirmed";
    const opts = { startIdx: core.lowerBound(s.candles, Date.parse(prior.start), c => c.endTs), endIdx: core.lowerBound(s.candles, Date.parse(prior.end) + 1, c => c.endTs), recordSnapshots: true };
    const params: import("./hype-freerun-canonical-replay").EngineParams = { id: prior.id, executionModel: "causal_next_open", tpExecutionModel,
      maxPositions: cfg.maxPositions, hardFlattenHours: cfg.exits.hardFlattenHours, hardFlattenPct: cfg.exits.hardFlattenPct, cooldownMode: "live4h", pullbackMode: "none" };
    console.log(`[baseline] ${prior.id}: reproduce exact full-result digest with snapshots excluded`);
    const r = core.runEngine(params, s, opts), digest = hash(JSON.stringify({ ...r, snapshots: [] }));
    assert.equal(digest, prior.digest, `Baseline diverged: ${prior.id}`);
    console.log(`[attribute] ${prior.id}: exact state, partial allocations and known-at-decision S/R clock`);
    const attributed = attributeAdds(r, s, cfg, spec, opts.startIdx, opts.endIdx, prior.id), summary = summarizeAdds(attributed.rows, spec);
    jsonl(`${prior.id}-features.jsonl`, attributed.rows.map(x => x.feature));
    jsonl(`${prior.id}-outcomes.jsonl`, attributed.rows.map(x => x.outcome));
    core.writeCsv(path.join(out, `${prior.id}-adds.csv`), attributed.rows.map(({ feature: f, outcome: o }) => ({ ...f, resistance: f.resistance?.price ?? null, resistanceDistPct: f.resistance?.distPct ?? null,
      resistanceTouches: f.resistance?.touches ?? null, resistanceKnownAt: f.resistance?.latestConfirmationAt ?? null, support: f.support?.price ?? null,
      ...o, waits: undefined, wait15SavingPct: o.waits.find(w => w.minutes === 15)?.buyPriceSavingPct, wait60SavingPct: o.waits.find(w => w.minutes === 60)?.buyPriceSavingPct })));
    summaries.push({ id: prior.id, ...summary, validation: attributed.validation });
    cohortRows.push(...summary.cohorts.map(c => ({ model: prior.id, ...c })));
    monthly.push(...summary.monthly.map(c => ({ model: prior.id, ...c })));
    const months = new Map<string, number>();
    for (const c of r.closes) months.set(c.closeIso.slice(0, 7), (months.get(c.closeIso.slice(0, 7)) ?? 0) + c.pnl);
    for (const p of r.trims) months.set(p.iso.slice(0, 7), (months.get(p.iso.slice(0, 7)) ?? 0) + p.pnl);
    core.writeCsv(path.join(out, `${prior.id}-baseline-monthly.csv`), [...months].sort().map(([month, realizedPnl]) => ({ month, realizedPnl })));
    baseline.push({ id: prior.id, digest, baselineDigestMatched: true, totalPnl: r.realized + r.openPnl, realized: r.realized, openPnl: r.openPnl,
      maxDrawdownPct: r.maxDrawdownPct, closes: r.closes.length, partials: r.trims.length, openDepth: r.openDepth, attribution: attributed.validation });
    json("summary.json", summaries); json("baseline.json", baseline);
    console.log(JSON.stringify({ id: prior.id, deepAdds: summary.pulseEraDeepAdds, hypotheses: summary.hypotheses.map(h => ({ id: h.id, adds: h.adds, episodes: h.episodes, pnl: h.realizedContribution, wait15MeanSavingPct: h.wait15MeanSavingPct, failures: h.failures })) }));
  }
  core.writeCsv(path.join(out, "cohorts.csv"), cohortRows); core.writeCsv(path.join(out, "entry-cohort-monthly.csv"), monthly);
  for (const source of sources) assert.equal(await fileHash(path.join(root, source.file)), source.sha256, source.file);
  for (const input of inputs) assert.equal(await fileHash(path.join(root, input.file)), input.sha256, input.file);
  json("validation.json", { allFourBaselineDigestsMatched: true, everyRungAllocationReconciled: true, inputsAndSourcesUnchanged: true,
    noEngineChanges: true, strategyVariantsTested: 0, shortsTested: 0, exactLiveParityCertified: false,
    timingResearchPrerequisites: summaries.map(s => ({ model: s.id, qualifying: s.hypotheses.filter((h: any) => h.meritsSeparateTimingExperiment).map((h: any) => h.id) })) });
  console.log(`[done] ${out}`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
