/** H00: attach as-of HL/SR evidence to every frozen R01 Bollinger opportunity. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { evidence, IndicatorContextTape, attachSr, joinSignal, M, H, type Row, type Kind, validFlow } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
import { loadCandles1m } from "./hype-freerun-canonical-replay";
import { prepareFeatures } from "./indicator-entry-context-features";
import { runEntryContext } from "./indicator-entry-context-policy";
import { refinementGate } from "./indicator-refinement-policy";
import { bookEvidence } from "../src/hl-data-quality";
const ROOT = path.resolve(__dirname, ".."), CARD = "research-inputs/indicators/context-h00-2026-09-07.json";
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), "utf8"));
async function sha(f: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(path.resolve(ROOT, f))) h.update(b); return h.digest("hex"); }
async function lines(f: string, cb: (r: Row, line: number) => void) {
  const name = path.resolve(ROOT, f), before = fs.statSync(name), stream = fs.createReadStream(name), hash = crypto.createHash("sha256");
  stream.on("data", b => hash.update(b)); let line = 0;
  for await (const text of readline.createInterface({ input: stream, crlfDelay: Infinity })) { line++; if (text.trim()) cb(JSON.parse(text), line); }
  const after = fs.statSync(name); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  return { file: f, sha256: hash.digest("hex"), bytes: after.size, physicalLines: line };
}
function wl(trades: Row[]) { return { trades: trades.length, wins: trades.filter(t => t.net > 1e-8).length, losses: trades.filter(t => t.net < -1e-8).length,
  winningDollars: trades.reduce((s, t) => s + Math.max(0, t.net), 0), losingDollars: trades.reduce((s, t) => s + Math.min(0, t.net), 0), net: trades.reduce((s, t) => s + t.net, 0) }; }
function csv(rows: Row[]) { const keys = [...new Set(rows.flatMap(Object.keys))], cell = (x: any) => JSON.stringify(x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x));
  return [keys.join(","), ...rows.map(r => keys.map(k => cell(r[k])).join(","))].join("\n") + "\n"; }
async function main() {
  assert(process.argv.length === 4 && process.argv[2] === "--out", "Usage: --out NEW_BACKTEST_DIRECTORY");
  const out = path.resolve(ROOT, process.argv[3]), rel = path.relative(path.join(ROOT, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out));
  const spec = read(CARD), prior = spec.r01Directory, man = read(prior + "/manifest.json"), verification = read(prior + "/verification.json");
  assert.equal(await sha(prior + "/manifest.json"), spec.r01ManifestSha256); assert.equal(await sha(prior + "/verification.json"), spec.r01VerificationSha256); assert(verification.passed);
  const pins = new Map<string, string>();
  for (const p of man.sources) { assert.equal(await sha(p.file), p.sha256, p.file); pins.set(p.file, p.sha256); }
  for (const p of man.inputs) assert.equal(await sha(p.file), p.sha256, p.file);
  for (const p of verification.artifacts) { const f = prior + "/" + p.file; assert.equal(await sha(f), p.sha256); pins.set(f, p.sha256); }
  pins.set(prior + "/verification.json", await sha(prior + "/verification.json"));
  const ownSources = [CARD, "scripts/indicator-hl-sr-context.ts", "scripts/indicator-hl-sr-context-tests.ts", "scripts/hype-indicator-hl-sr-context-study.ts", "scripts/indicator-hl-sr-context-check.ts",
    "scripts/replay-market-inputs.ts", "scripts/replay-sr-context.ts", "src/hl-data-quality.ts", "src/bot/sr-memory-zones.ts", "src/bot/sr-levels.ts"];
  for (const f of ownSources) pins.set(f, await sha(f));
  const protect = ["bot-config.json", "bot-state.json", "hl-short-live-config.json", "src/bot/index.ts", "src/bot/strategy.ts", "src/bot/shadow-logger.ts"];
  const protectedPins = await Promise.all(protect.map(async file => ({ file, sha256: await sha(file) })));
  const cfg = read("bot-config.json").srShadow; Object.keys(spec.srConfig).forEach(k => assert.deepEqual(spec.srConfig[k], cfg[k]));
  const start = Date.parse(spec.start), end = Date.parse(spec.end), seed = Date.parse(man.spec.indicatorSeedBarStart);
  const candles = (await loadCandles1m(spec.symbol, path.join(ROOT, prior, "inputs"), end, path.join(ROOT, prior, "inputs/repair.json"))).filter(c => c.ts >= seed);
  assert.equal(candles.length, man.spec.expectedMinuteRows); candles.forEach((c, i) => assert.equal(c.ts, seed + i * M));
  const allDecisions: Row[] = [], allTrades: Row[] = [];
  await lines(prior + "/decisions.jsonl", r => { if (r.window === "recent" && spec.ids.includes(r.id)) allDecisions.push(r); });
  await lines(prior + "/trades.jsonl", r => { if (r.window === "recent" && spec.ids.includes(r.id)) allTrades.push(r); });
  const baseline = read(prior + "/results.json").filter((r: Row) => spec.ids.includes(r.id));
  const times = [...new Set<number>(allDecisions.filter(r => r.id === spec.ids[0] && r.delayMs === 0).map(r => r.at))].sort((a, b) => a - b);
  assert.equal(times.length, spec.expectedSignals);
  const mins = candles.map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover }));
  const features = prepareFeatures(mins), rule = man.rules.find((r: Row) => r.id === spec.ids[0]), opps = features.opportunities(rule);
  const context = new Map(features.rows({ family: "cmf", period: 20, timeframeMs: H }).map(r => [r.barEnd, r]));
  const parity: Row[] = [];
  for (const id of spec.ids) for (const delayMs of spec.executionDelaysMs) {
    const c = { id, family: "cmf" as const, timeframeMs: H, threshold: id === "R01-08" ? -.05 : 0 };
    const run = runEntryContext(mins, opps, "short", { start, end, delayMs, holdMs: 12 * H, notional: 10000, equity: 32000, feeRate: .00055 }, id === spec.ids[0] ? undefined : t => refinementGate(c, t, context));
    const old = baseline.find((r: Row) => r.id === id && r.window === "recent" && r.delayMs === delayMs);
    for (const [f, v] of Object.entries(run.stats)) assert.deepEqual(v, old[f], `${id} ${f}`);
    assert.deepEqual(JSON.parse(JSON.stringify(run.trades)), allTrades.filter(r => r.id === id && r.delayMs === delayMs).map(({ id, window, delayMs, ...r }) => r));
    assert.deepEqual(run.decisions.map(d => [d.at, d.outcome, d.acceptedEntryAt]), allDecisions.filter(r => r.id === id && r.delayMs === delayMs).map(r => [r.at, r.outcome, r.acceptedEntryAt]));
    assert.deepEqual(run.decisions.map(d => d.at), times); parity.push({ id, delayMs, exact: true, trades: run.trades.length, net: run.stats.net });
  }
  console.log("[H00] six recent baseline paths exact; 14 original opportunities, no new strategy rule");
  fs.mkdirSync(path.join(out, "evidence"), { recursive: true });
  const tape = new IndicatorContextTape(spec), sourceInputs: Row[] = [], inventory: Row[] = [];
  const fd = fs.openSync(path.join(out, "evidence/source-rows.jsonl"), "wx");
  for (const src of spec.sources as Array<{ kind: Kind; file: string }>) {
    const info: Row = { ...src, rawRows: 0, windowRows: 0, retainedRows: 0, afterCutoffRows: 0, firstSourceAt: null, lastSourceAt: null, firstAvailableAt: null, lastAvailableAt: null,
      windowTimingBasis: {}, invalidWindowRows: 0, invalid05BandRows: 0, stale05AtPublicationRows: 0 };
    const bins = new Set<number>();
    const pin = await lines(src.file, (raw, line) => {
      const r = evidence(src.kind, raw, src.file, line); info.rawRows++;
      info.firstSourceAt = Math.min(info.firstSourceAt ?? Infinity, r.sourceAt); info.lastSourceAt = Math.max(info.lastSourceAt ?? 0, r.sourceAt);
      info.firstAvailableAt = Math.min(info.firstAvailableAt ?? Infinity, r.eligibleAt); info.lastAvailableAt = Math.max(info.lastAvailableAt ?? 0, r.eligibleAt);
      if (r.eligibleAt >= end) info.afterCutoffRows++;
      if (r.eligibleAt >= start && r.eligibleAt < end) {
        info.windowRows++; bins.add(r.eligibleAt); info.windowTimingBasis[r.timingBasis] = (info.windowTimingBasis[r.timingBasis] ?? 0) + 1;
        if (r.kind === "hlTaker" && !validFlow(r)) info.invalidWindowRows++;
        if (r.kind === "book") { const b = bookEvidence(raw, r.availableAt); if (!b.band("pct_0_5").healthy) info.invalid05BandRows++;
          if (b.ageSec === null || b.ageSec > spec.quality.maxBookAgeSec) info.stale05AtPublicationRows++; }
      }
      if (times.some(t => r.eligibleAt >= t - 8 * H - 15 * M && r.eligibleAt <= t + M)) {
        tape.add(r); info.retainedRows++; fs.writeSync(fd, JSON.stringify(r) + "\n");
      }
    });
    const monthly: Row[] = [], gaps: Row[] = []; let open: number | null = null;
    for (let t = Math.ceil(start / M) * M; t < end; t += M) {
      const month = new Date(t).toISOString().slice(0, 7); let row = monthly.at(-1);
      if (!row || row.month !== month) { row = { month, expectedDecisionMinutes: 0, minutesWithNewObservation: 0 }; monthly.push(row); }
      row.expectedDecisionMinutes++; if (bins.has(t)) row.minutesWithNewObservation++;
      if (!bins.has(t) && open === null) open = t;
      if (bins.has(t) && open !== null) { gaps.push({ start: open, end: t, missingMinutes: (t - open) / M }); open = null; }
    }
    if (open !== null) gaps.push({ start: open, end, missingMinutes: (end - open) / M });
    Object.assign(info, { monthly, gapCount: gaps.length, missingDecisionMinutes: gaps.reduce((s, g) => s + g.missingMinutes, 0),
      longestGapMinutes: Math.max(0, ...gaps.map(g => g.missingMinutes)), gapsOver5m: gaps.filter(g => g.missingMinutes > 5),
      note: "Grid is presence of a newly available observation, not proven freshness/completeness of the derived features." });
    sourceInputs.push(pin); inventory.push(info); console.log(`[H00] ${src.kind}: scanned ${info.rawRows}, retained ${info.retainedRows} evidence lines`);
  }
  fs.closeSync(fd); tape.seal();
  const queryTimes = [...new Set<number>(times.flatMap(t => spec.contextOffsetsMinutes.map((m: number) => t + m * M)))].sort((a, b) => a - b);
  const srContext = new ReplaySrContext(candles, spec.srConfig), snapshots = new Map<number, Row>(), sr = new Map<number, Row>();
  for (const t of queryTimes) { snapshots.set(t, tape.snapshot(t)); sr.set(t, attachSr(candles, t, srContext)); }
  const joined: Row[] = times.map(at => ({ ...joinSignal(at, snapshots, sr, candles, spec),
    baselineDecisions: allDecisions.filter(d => d.at === at), baselineTrades: allTrades.filter(t => t.signalAt === at) }));
  const prefixChecks: Row[] = [];
  for (const t of [times[0], 1782100800000, times.at(-1)!]) {
    const prefix = new IndicatorContextTape(spec); tape.records.filter(r => r.eligibleAt <= t).forEach(r => prefix.add(r)); prefix.seal();
    assert.deepEqual(prefix.snapshot(t), snapshots.get(t));
    const cs = candles.filter(c => c.endTs <= t); assert.deepEqual(attachSr(cs, t, new ReplaySrContext(cs, spec.srConfig)), sr.get(t));
    prefixChecks.push({ at: t, pulseExact: true, srExact: true });
  }
  const coverage = (xs: Row[]) => ({ opportunities: xs.length,
    ...Object.fromEntries(Object.keys(joined[0].healthy).map(k => [k, xs.filter(r => r.healthy[k]).length])),
    ...Object.fromEntries(Object.keys(joined[0].intersections).map(k => [k, xs.filter(r => r.intersections[k]).length])) });
  const monthly = Array.from(new Set(joined.map(r => r.iso.slice(0, 7)))).map(month => ({ month, ...coverage(joined.filter(r => r.iso.startsWith(month))) }));
  const cohortCoverage = spec.ids.flatMap((id: string) => spec.executionDelaysMs.map((delayMs: number) => {
    const ts = allTrades.filter(t => t.id === id && t.delayMs === delayMs), own = joined.filter(r => ts.some(t => t.signalAt === r.at));
    return { id, delayMs, baseline: wl(ts), coverage: coverage(own), descriptiveCoveredCohortsOnly: ["flowSr", "core", "fullContext"].map(k => ({ name: k,
      ...wl(ts.filter(t => joined.find(r => r.at === t.signalAt)!.intersections[k])) })) };
  }));
  const flatRows = joined.map(r => ({ at: r.at, iso: r.iso, cmf20: r.baselineDecisions.find((d: Row) => d.id === "R01-08" && d.delayMs === 0).gate.value,
    refinedDecision: r.baselineDecisions.find((d: Row) => d.id === "R01-08" && d.delayMs === 0).outcome,
    parentNet0: r.baselineTrades.find((t: Row) => t.id === spec.ids[0] && t.delayMs === 0)?.net ?? null,
    oldNet0: r.baselineTrades.find((t: Row) => t.id === "C02-32" && t.delayMs === 0)?.net ?? null,
    refinedNet0: r.baselineTrades.find((t: Row) => t.id === "R01-08" && t.delayMs === 0)?.net ?? null,
    taker15: r.context.flow15.healthy ? r.context.flow15.ratio : null, taker1h: r.context.flow60.healthy ? r.context.flow60.ratio : null,
    taker15Minus15: r.contextMinus15.flow15.healthy ? r.contextMinus15.flow15.ratio : null,
    book05: r.context.book.imbalance05, bookChange5: r.bookChange5, bookChange15: r.bookChange15,
    nativeOi1hPct: r.context.asset.changes[0].nativeOiChangePct, markedOi1hPct: r.context.asset.changes[0].markedOiChangePct,
    nativeOi4hPct: r.context.asset.changes[1].nativeOiChangePct,
    price: r.sr.price, nearestSupport: r.sr.nearestSupport?.zone.price ?? null, supportDistancePct: r.sr.nearestSupport?.distancePct ?? null,
    nearestResistance: r.sr.nearestResistance?.zone.price ?? null, resistanceDistancePct: r.sr.nearestResistance?.distancePct ?? null,
    priorSupport: r.supportResponse.frozenLevel?.zone.price ?? null, priorSupportBroken: r.supportResponse.twoClosesBelow,
    ...r.descriptors, ...Object.fromEntries(Object.entries(r.healthy).map(([k, v]) => [`healthy_${k}`, v])), ...r.intersections }));
  const json = (f: string, x: any) => fs.writeFileSync(path.join(out, f + ".json"), JSON.stringify(x, null, 2) + "\n", { flag: "wx" });
  json("baseline", baseline); json("baseline-parity", parity); json("source-inventory", inventory); json("opportunities", joined);
  json("coverage", { overall: coverage(joined), monthly, cohortCoverage }); json("prefix-checks", prefixChecks);
  fs.writeFileSync(path.join(out, "opportunities.csv"), csv(flatRows), { flag: "wx" }); json("opportunity-table", flatRows);
  for (const [file, hash] of pins) assert.equal(await sha(file), hash, file);
  for (const p of [...sourceInputs, ...protectedPins, ...man.inputs]) assert.equal(await sha(p.file), p.sha256, p.file);
  json("manifest", { version: 1, spec, createdAt: new Date().toISOString(), sources: [...pins].map(([file, sha256]) => ({ file, sha256 })),
    priceInputs: man.inputs, sourceInputs, protectedPins, excerpt: { file: "evidence/source-rows.jsonl", sha256: await sha(path.relative(ROOT, path.join(out, "evidence/source-rows.jsonl"))) },
    strategyDefinitionsAdded: 0, ladderVariantsAdded: 0, standaloneInventory: 5253, ladderInventory: 45 });
  json("validation", { passed: true, originalOpportunities: times.length, baselineParityCases: parity.length, contextSnapshots: queryTimes.length,
    prefixChecks, independentVerificationPending: true, liveChanged: false });
  console.log(JSON.stringify({ coverage: coverage(joined), strategyDefinitionsAdded: 0, independentVerificationPending: true }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
