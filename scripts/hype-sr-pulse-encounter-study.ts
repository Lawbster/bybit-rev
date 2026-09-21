/** Frozen, local, descriptive S/R study. No exchange calls or live-state mutation. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { loadCandles1m, writeCsv, type Candle } from "./hype-freerun-canonical-replay";
import { loadReplayMarketInputs } from "./replay-market-inputs";
import { missingMinutes } from "./replay-candle-repair";
import { M, aggregateComplete, chartWindow, buildFrames, discoverEncounters, attachOutcomes, selectControls, matchControls, outcome, direction, type StudySpec, type Encounter, type Frame } from "./sr-pulse-encounters";
import { summarizeStudy } from "./sr-pulse-encounter-analysis";
import { renderAtlasEventSvg, renderNeighbourSvg } from "../src/research/event-atlas-render";
import type { AtlasEventFeatures, AtlasCandle, EventAtlasManifest } from "../src/research/event-atlas-types";

const hash = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
async function hashFile(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
function frameData(f: Frame | null) {
  if (!f) return null;
  const { zones, bar, ...rest } = f;
  return { ...rest, price: bar.close, zoneCount: zones.length };
}
function features(e: Encounter) {
  return { id: e.id, side: e.side, encounterAt: e.at, decisionAt: e.decisionAt, levelKnownAt: e.levelKnownAt,
    level: e.level, approach: frameData(e.approach), decision: frameData(e.decision),
    response: e.response, pressure: e.pressure, primaryHealthy: e.primaryHealthy,
    bookPersistence: e.bookPersistence, nextUp: e.nextUp, nextDown: e.nextDown };
}
function atlasFeatures(f: Frame): AtlasEventFeatures {
  return { timestamp: f.at, price: f.bar.close, ema200DistPct: f.ema200DistPct, return4hPct: null, return12hPct: null,
    return24hPct: null, return72hPct: null, ema50_4h: null, ema200_4h: null, realizedVol24hPct: null, range24hPct: null,
    nearestResistance: null, resistanceDistPct: null, nearestSupport: null, supportDistPct: null,
    forwardLow12hPct: null, forwardHigh12hPct: null, forwardClose12hPct: null, forwardLow24hPct: null, forwardHigh24hPct: null, forwardClose24hPct: null };
}
function gallery(out: string, rows: Encounter[], frames: Frame[], candles: Candle[], spec: StudySpec, summary: ReturnType<typeof summarizeStudy>) {
  const folder = path.join(out, "gallery"); fs.mkdirSync(folder);
  const five = aggregateComplete(candles, 5), hour = aggregateComplete(candles, 60), byAt = new Map(frames.map(f => [f.at, f]));
  const asAtlas = (xs: Candle[]): AtlasCandle[] => xs.map(c => ({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  const window = (xs: Candle[], at: number) => asAtlas(chartWindow(xs, at));
  const manifest: EventAtlasManifest = { version: 1, id: spec.id, symbol: spec.symbol, title: "S/R pulse encounters", candleSource: { path: "corrected-history", intervalMinutes: 1 }, events: [],
    chart: { beforeHours: 6, afterHours: 4, primaryIntervalMinutes: 5, secondaryIntervalMinutes: 60 } };
  const cards: string[] = [], selected: unknown[] = [];
  for (const c of summary.candidates) for (const profitable of [true, false]) {
    // Explicit outcome-stratified illustration, never a discovery sample selector.
    const e = rows.find(e => e.primaryHealthy && e.future4h && e.side === c.side && e.response === c.response && e.pressure === c.pulse &&
      (c.sign * e.future4h.retPct - spec.stressRoundTripCostPct > 0) === profitable);
    if (!e?.decision || !e.future4h) continue;
    const name = `${c.id}-${profitable ? "positive" : "negative"}`, title = `${c.id}: first ${profitable ? "positive" : "nonpositive"} stress markout`;
    const event = { id: name, timestamp: e.decisionAt, inputAt: e.decisionAt, label: title, tags: ["descriptive", "not a trade"], note: "Level frozen at approach. 12h fields unused." };
    const past = frames.filter(f => f.at >= e.decisionAt - 6 * 3600000 && f.at <= e.decisionAt);
    const svg = renderAtlasEventSvg({ manifest, event, features: atlasFeatures(e.decision),
      primaryCandles: window(five, e.decisionAt), secondaryCandles: window(hour, e.decisionAt),
      zones: [{ ...e.level, side: e.side }], markers: [{ timestamp: e.at, sourceId: "encounter", sourceLabel: "Encounter start", kind: "encounter", label: "approach", color: "#60a5fa" }],
      panels: [{ config: { id: "flow", label: "As-of HL taker 15m (unknown coverage omitted)", path: "derived", bucketMinutes: 5, series: [{ label: "buy/sell", valueField: "ratio" }] },
        points: past.map(f => ({ timestamp: f.at, values: [f.flowHealthy ? f.taker15 : null] })) },
      { config: { id: "book", label: "As-of 0.5% depth imbalance (stale/unknown omitted)", path: "derived", bucketMinutes: 5, series: [{ label: "imbalance", valueField: "imb" }] },
        points: past.map(f => ({ timestamp: f.at, values: [f.bookHealthy ? f.bookImbalance : null] })) }] });
    fs.writeFileSync(path.join(folder, name + ".svg"), svg);
    let control = "";
    if (e.controlAt !== null && byAt.has(e.controlAt)) {
      const f = byAt.get(e.controlAt)!;
      const rendered = renderNeighbourSvg({ manifest, event, neighbour: { eventId: name, rank: 1, timestamp: f.at, distance: e.controlDistance!, features: atlasFeatures(f) }, candles: window(five, f.at) });
      fs.writeFileSync(path.join(folder, name + "-control.svg"), rendered);
      control = `<details><summary>Feature-matched prior away-from-S/R control</summary><img src="${name}-control.svg"></details>`;
    }
    cards.push(`<article><h2>${title}</h2><p>${new Date(e.decisionAt).toISOString()} | frozen level ${e.level.price.toFixed(4)} | directional 4h stress markout ${(c.sign * e.future4h.retPct - spec.stressRoundTripCostPct).toFixed(3)}%</p><img src="${name}.svg">${control}</article>`);
    selected.push({ name, encounterId: e.id, decisionAt: e.decisionAt, controlAt: e.controlAt, sign: c.sign, illustrationSelectionUsesOutcome: true });
  }
  fs.writeFileSync(path.join(folder, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><title>${spec.id}</title><style>body{background:#080d19;color:#dde4f3;font:15px system-ui;margin:24px}article{margin:32px 0}img{max-width:1240px;width:100%}p{color:#b4c0d4}</style></head><body><h1>Frozen S/R + pulse encounter gallery</h1><p>First positive and nonpositive example per predefined cell, selected AFTER analysis for illustration. Not a representative performance sample. Vertical T on the charts is decision D, after the 15-minute observation. Future prices are shaded; pulse panels stop at D. Any hourly bar straddling D is omitted. Frozen levels were known at encounter start, not necessarily throughout the entire earlier chart. Plot-window EMA curves are visual guides, not the completed-4h regime inputs. Generic atlas 12h labels are intentionally NA: this study measures 1h/4h outcomes.</p>${cards.join("\n")}</body></html>`);
  fs.writeFileSync(path.join(folder, "selection.json"), JSON.stringify(selected, null, 2));
}

async function main() {
  const root = path.resolve(__dirname, ".."), specPath = "research-inputs/sr-pulse-encounters/hype-2026-09-05.json";
  const spec: StudySpec = JSON.parse(fs.readFileSync(path.join(root, specPath), "utf8"));
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "bot-config.json"), "utf8"));
  assert.equal(spec.symbol, cfg.symbol); assert.equal(cfg.srShadow.tfMin, 30); assert.equal(cfg.srShadow.recentDays, 14);
  assert(spec.encounterSeparationMinutes >= spec.responseMinutes + spec.primaryHorizonMinutes + 1);
  const out = path.resolve(root, process.env.SR_PULSE_OUT ?? `backtests/hype/${spec.id}`), relative = path.relative(path.join(root, "backtests"), out);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || fs.existsSync(out)) throw new Error("Use a NEW output directory inside backtests/");
  const baseline = path.join(root, spec.baselineDir), oldManifest = JSON.parse(fs.readFileSync(path.join(baseline, "manifest.json"), "utf8"));
  const validation = JSON.parse(fs.readFileSync(path.join(baseline, "validation.json"), "utf8"));
  assert(validation.legacyControlMatched && validation.repeatedResultsEqual && validation.noRetrospectiveFills && validation.originalCandleContentHashesUnchanged && validation.remainingCandleGaps === 0);
  for (const s of oldManifest.sources) assert.equal(hash(fs.readFileSync(path.join(root, s.file))), s.sha256, `Baseline source changed: ${s.file}`);
  for (const x of oldManifest.inputs) { const s = fs.statSync(path.join(root, "data", x.file)); assert.equal(s.size, x.bytes, `Baseline input changed: ${x.file}`); assert.equal(s.mtimeMs, x.mtimeMs, `Baseline input changed: ${x.file}`); }
  const prior = JSON.parse(fs.readFileSync(path.join(baseline, "summary.json"), "utf8"));
  assert.equal(prior.length, 4); assert(prior.every((r: any) => r.srContextHealthyPct === 100 && r.identicalRepeat));
  const expected = [17071.509682666387, 43005.84535847749, 17413.83623523271, 21983.76646630998];
  prior.forEach((r: any, i: number) => assert(Math.abs(r.totalPnl - expected[i]) < 1e-7));
  const sources = [...new Set([...oldManifest.sources.map((s: any) => s.file), "scripts/hype-sr-pulse-encounter-study.ts", "scripts/sr-pulse-encounters.ts", "scripts/sr-pulse-encounter-analysis.ts", "scripts/sr-pulse-encounter-tests.ts", "src/research/event-atlas-render.ts", "src/research/event-atlas-types.ts", specPath, "package-lock.json", "tsconfig.json"])].map(file => ({ file: String(file), sha256: hash(fs.readFileSync(path.join(root, String(file)))) }));
  const dataNames = ["HYPEUSDT_1_full.json", "HYPEUSDT_1m.jsonl", "HYPEUSDT_taker_hyperliquid.jsonl", "HYPEUSDT_taker_binance.jsonl", "HYPEUSDT_asset_ctx_hyperliquid.jsonl", "HYPEUSDT_ob_bands_hyperliquid.jsonl", "HYPEUSDT_oi_live.jsonl", "HYPEUSDT_oi_live_binance.jsonl", "HYPEUSDT_oi_live_hyperliquid.jsonl", "HYPEUSDT_funding_live.jsonl", "HYPEUSDT_funding_live_binance.jsonl", "HYPEUSDT_funding_live_hyperliquid.jsonl", "HYPE_hlp_vault.jsonl"];
  console.log("[manifest] content-hashing consumed inputs and verifying frozen baseline identity");
  const inputs = [];
  for (const name of [...dataNames.map(f => `data/${f}`), spec.repairFile]) {
    const file = path.join(root, name), st = fs.statSync(file); inputs.push({ file: name, bytes: st.size, mtimeMs: st.mtimeMs, sha256: await hashFile(file) });
  }
  assert.equal(inputs.find(x => x.file === spec.repairFile)!.sha256, oldManifest.candleRepair.sha256);
  fs.mkdirSync(out, { recursive: true });
  const json = (name: string, value: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
  const jsonl = (name: string, rows: unknown[]) => fs.writeFileSync(path.join(out, name), rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  json("manifest.json", { generatedAt: new Date().toISOString(), node: process.version, spec, sources, inputs, baselineIdentityVerified: true,
    baselineSummarySha256: hash(fs.readFileSync(path.join(baseline, "summary.json"))), baselineRerunThisPass: false,
    qualifications: ["Previously mined development data", "No strategy or portfolio PnL", "Historical pulse arrival assumptions remain", "Eight related cells; nominal cluster intervals"] });
  console.log("[load] repaired closed candles and as-of pulse tape");
  const candles = await loadCandles1m(spec.symbol, path.join(root, "data"), Date.parse(spec.end), path.join(root, spec.repairFile));
  assert.equal(missingMinutes(candles).length, 0);
  const tape = await loadReplayMarketInputs(path.join(root, "data"), spec.symbol, Date.parse(spec.end));
  console.log("[frames] confirmed zones, pulse coverage and completed-4h research strata");
  const frames = buildFrames(candles, cfg.srShadow, tape, spec);
  const { rows, audit } = discoverEncounters(frames, spec);
  const before = hash(JSON.stringify(rows.map(features)));
  assert.equal(before, hash(JSON.stringify(discoverEncounters(frames, spec).rows.map(features))));
  const split = Date.parse(spec.split);
  assert.deepEqual(discoverEncounters(frames.filter(f => f.at <= split), spec).rows.filter(e => e.decisionAt <= split).map(features), rows.filter(e => e.decisionAt <= split).map(features));
  for (const e of rows) { assert(e.levelKnownAt < e.at && e.at < e.decisionAt); assert(e.level.touchData.every(t => t.ts <= e.levelKnownAt)); }
  jsonl("encounter-features.jsonl", rows.map(features));
  const controls = selectControls(frames, spec); matchControls(rows, controls, spec);
  json("pre-outcome-audit.json", { frames: frames.length, ...audit, encounters: rows.length, primaryHealthy: rows.filter(e => e.primaryHealthy).length,
    controls: controls.length, matched: rows.filter(e => e.controlAt !== null).length, featuresSha256: before, repeatedFeaturesEqual: true, actualPrefixEqual: true, inputTape: tape.audit });
  console.log(`[encounters] ${rows.length} spaced encounters, ${controls.length} away controls; feature definitions locked before labels`);
  attachOutcomes(rows, candles, spec);
  const index = new Map(candles.map((c, i) => [c.ts, i]));
  for (const c of controls) c.future4h = outcome(candles, index, c.frame.at, spec.primaryHorizonMinutes);
  assert.equal(before, hash(JSON.stringify(rows.map(features))), "Attaching outcome labels changed features");
  const summary = summarizeStudy(rows, controls, spec);
  json("summary.json", summary); writeCsv(path.join(out, "cohorts.csv"), summary.cohorts); writeCsv(path.join(out, "monthly.csv"), summary.monthly);
  writeCsv(path.join(out, "coverage.csv"), summary.coverage); writeCsv(path.join(out, "context-modifiers.csv"), summary.modifiers);
  jsonl("encounter-outcomes.jsonl", rows.map(e => ({ id: e.id, decisionAt: e.decisionAt, future1h: e.future1h, future4h: e.future4h, futureHitNextUp: e.futureHitNextUp, futureHitNextDown: e.futureHitNextDown })));
  jsonl("controls.jsonl", controls.map(c => ({ features: frameData(c.frame), future4h: c.future4h })));
  writeCsv(path.join(out, "encounters.csv"), rows.map(e => ({ id: e.id, side: e.side, encounterIso: new Date(e.at).toISOString(), decisionIso: new Date(e.decisionAt).toISOString(),
    level: e.level.price, touches: e.level.touches, levelFirstConfirmationAt: e.level.confirmTs,
    levelActionableAt: e.level.touchData[cfg.srShadow.minTouches - 1]?.ts ?? null, levelLatestTouchAt: e.level.touchData.at(-1)?.ts ?? null,
    response: e.response, pressure: e.pressure, primaryHealthy: e.primaryHealthy, regime: e.decision?.regime,
    approachTaker: e.approach.taker15, responseTaker: e.decision?.taker15, approachNet: e.approach.net15, responseNet: e.decision?.net15,
    approachNotional: e.approach.buy15 !== null && e.approach.sell15 !== null ? e.approach.buy15 + e.approach.sell15 : null,
    responseNotional: e.decision?.buy15 !== null && e.decision?.sell15 !== null && e.decision ? e.decision.buy15! + e.decision.sell15! : null,
    responseRet15m: e.decision?.ret15m, rv1hPct: e.decision?.rv1hPct, tr14Pct: e.decision?.tr14Pct, relativeVolume15: e.decision?.relativeVolume15,
    approachDistanceTrUnits: e.approach.tr14Pct > 0 ? Math.abs((e.approach.bar.close / e.level.price - 1) * 100) / e.approach.tr14Pct : null,
    bookPersistence: e.bookPersistence, nativeOi1hPct: e.decision?.nativeOi1hPct, markedOi1hPct: e.decision?.markedOi1hPct,
    futureReturn1h: e.future1h?.retPct ?? null, futureReturn4h: e.future4h?.retPct ?? null, futureDelayedReturn4h: e.future4h?.delayedRetPct ?? null,
    futureHigh4h: e.future4h?.highPct ?? null, futureLow4h: e.future4h?.lowPct ?? null,
    nextUp: e.nextUp, nextDown: e.nextDown, futureHitNextUp: e.futureHitNextUp, futureHitNextDown: e.futureHitNextDown,
    matchedControlIso: e.controlAt === null ? null : new Date(e.controlAt).toISOString(), controlDistance: e.controlDistance })));
  console.log("[gallery] outcome-stratified illustrations using the existing atlas renderer");
  gallery(out, rows, frames, candles, spec, summary);
  for (const s of sources) assert.equal(hash(fs.readFileSync(path.join(root, s.file))), s.sha256, `Source changed: ${s.file}`);
  for (const x of inputs) assert.equal(await hashFile(path.join(root, x.file)), x.sha256, `Input changed: ${x.file}`);
  json("validation.json", { baselineIdentityVerified: true, repairedInternalGaps: 0, featuresRepeatEqual: true, actualPrefixEqual: true,
    outcomesDidNotChangeFeatures: true, inputsAndSourcesContentUnchanged: true, candidatesTested: 8,
    portfolioVariantsTested: 0, exactLiveParityCertified: false, passing: summary.passing });
  console.log(JSON.stringify({ output: out, encounters: rows.length, commonN: summary.commonN, controls: controls.length, passing: summary.passing,
    candidates: summary.candidates.map(c => ({ id: c.id, n: c.n, stressMeanPct: c.stressMeanPct, priceOnlyDeltaPct: c.priceOnlyDeltaPct, matchedN: c.matchedN, matchedDeltaPct: c.matchedDeltaPct, failures: c.failures })) }, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
