/** F03: full indicator/HL/SR context on verified F02 half exits and pressure controls. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, prices, fileHash } from "./hype-failed-recovery-study";
import { auditComponentAccounting } from "./ladder-component-accounting";
import { auditDistress } from "./mfi-distress-exit-audit";
import { priceFeatures, supportResponse } from "./failed-recovery-analysis";
import { attachSr } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
import { SOURCES } from "./hype-tp-hl-event-atlas";
import { TpHlTape, normalize, type Row } from "./tp-hl-event-features";
import { M, H, upper, csv, indicatorSnapshots, hlSnapshot } from "./pressure-point-features";
import { contrasts, attribution, splitRows, distributions, assertAsOf } from "./mfi-recovery-context";

async function main() {
  const card = "research-inputs/mfi-recovery-context-2026-09-09.json", spec = read(card), archive = spec.archive;
  const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.resolve("backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh backtests output required");
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const h = await fileHash(file); if (expected) assert.equal(h, expected, file); pins.set(file, h); };
  for (const [file, h] of Object.entries(spec.archivePins)) await pin(`${archive}/${file}`, h as string);
  const old = read(`${archive}/manifest.json`), verified = read(`${archive}/verification.json`); assert(verified.passed);
  console.log("[F03] verifying accepted F02 lineage and archived baseline/half paths");
  for (const p of old.pins) await pin(p.file, p.sha256);
  for (const file of [card, spec.hlSpec, "scripts/hype-mfi-recovery-context-study.ts", "scripts/mfi-recovery-context.ts", "scripts/mfi-recovery-context-tests.ts",
    "scripts/pressure-point-features.ts", "scripts/tp-hl-event-features.ts", "scripts/hype-failed-recovery-study.ts", "scripts/failed-recovery-analysis.ts",
    "scripts/indicator-hl-sr-context.ts", "src/research/macd-features.ts", "src/research/bollinger-features.ts", "src/research/atr-efficiency-features.ts",
    "src/research/vwap-volume-features.ts"]) await pin(file);
  const protectedFiles = await Promise.all(["bot-config.json", "bot-state.json", "hl-short-live-config.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"]
    .map(async file => ({ file, sha256: await fileHash(file) })));
  const results: Row[] = read(`${archive}/results.json`).filter((r: Row) => r.sensitivity.id === "primary" && ["baseline", "mfi_half"].includes(r.policy.id));
  assert.equal(results.length, 8);
  const lm = read(`${old.spec.archive}/manifest.json`), cutoff = Date.parse(spec.cutoff), cs = await prices(cutoff, lm.spec.repairFile);
  const paths = new Map<string, { result: Row; obs: Row[]; events: Row[]; entries: Map<number, string> }>(), audits: Row[] = [];
  for (const r of results) {
    const loaded: Row = {};
    for (const suffix of ["observations.json", "inventory.jsonl"]) {
      const f = `${r.name}-${suffix}`, evidence = verified.artifacts.find((a: Row) => a.file === f); assert(evidence); await pin(`${archive}/${f}`, evidence.sha256);
      if (suffix.endsWith("jsonl")) { const xs: Row[] = []; await lines(`${archive}/${f}`, x => xs.push(x)); loaded.events = xs; }
      else loaded.obs = read(`${archive}/${f}`);
    }
    const accounting = auditComponentAccounting(cs, loaded.events, r.metrics, r.startIdx, r.endIdx, spec.initialEquity, spec.feeRate,
      { fraction: r.policy.fraction, fillDelayMs: 0 }); assert.deepEqual(accounting, r.accounting);
    const check = auditDistress(cs, loaded.events, loaded.obs, r.policy, Date.parse(r.end), 0, 0); assert.deepEqual(check, r.audit);
    const entries = new Map<number, string>();
    loaded.events.filter((e: Row) => e.event.kind === "open" && e.before.length === 0).forEach((e: Row) => entries.set(e.episode, new Date(e.event.fillAt).toISOString()));
    paths.set(r.name, { result: r, obs: loaded.obs, events: loaded.events, entries });
    audits.push({ name: r.name, digest: r.digest, accountingExact: true, ...check, fills: loaded.events.length, minuteMarks: accounting.independentMinutes });
    console.log(`[F03] re-accounted ${r.name}`);
  }
  const rows: Row[] = [], exclusions: Row[] = [], baselineChecks: Row[] = [];
  const earlier: Row[] = read(`${old.spec.archive}/results.json`);
  for (const b of results.filter(r => r.policy.id === "baseline")) {
    const original = earlier.find(x => x.model === b.model && x.policy === "B17"); assert(original);
    assert.equal(b.digest, original.digest);
    baselineChecks.push({ model: b.model, digest: b.digest, canonicalB17Exact: true });
    const bp = paths.get(b.name)!, hp = paths.get(`${b.model}--mfi_half--primary`)!;
    assert.deepEqual([...bp.entries.values()], [...hp.entries.values()], "No borrowed replacement entries");
    const bm = new Map<string, Row>(b.metrics.episodes.map((x: Row) => [x.entry, x]));
    const hm = new Map<string, Row>(hp.result.metrics.episodes.map((x: Row) => [x.entry, x]));
    const valid = bp.obs.filter(o => o.status === "baseline_observed");
    exclusions.push({ model: b.model, initial: bp.obs.length, retained: valid.length, excluded: bp.obs.filter(o => o.status !== "baseline_observed") });
    for (const o of valid) {
      const entry = bp.entries.get(o.episode)!; assert(entry); const h = hp.obs.find(x => hp.entries.get(x.episode) === entry)!; assert(h);
      assert.equal(h.firstAt, o.firstAt); assert.equal(h.at, o.at); assert.equal(h.mfi?.value, o.mfi?.value);
      const fill = hp.events.find(e => e.episode === h.episode && e.event.reason.startsWith("research_exit:"));
      const baselineOutcome = bm.get(entry) ?? null, halfOutcome = hm.get(entry) ?? null;
      rows.push({ id: `${b.model}|${o.episode}`, model: b.model, episode: o.episode, entry, at: o.at, iso: new Date(o.at).toISOString(),
        firstAt: o.firstAt, depth: o.depth, grossPct: o.grossPct, mfi: o.mfi, selected: !!fill,
        fill: fill?.event ?? null, baselineOutcome, halfOutcome,
        delta: fill && baselineOutcome && halfOutcome ? halfOutcome.pnl - baselineOutcome.pnl : null });
    }
    const xs = rows.filter(x => x.model === b.model), a = attribution(xs);
    assert.equal(a.selected, hp.result.audit.executed);
    assert(Math.abs(a.balance - (hp.result.metrics.totalPnl - b.metrics.totalPnl)) < 1e-6, "Selected episode deltas explain entire archived net change");
    for (const [entry, ep] of bm) if (!xs.some(x => x.entry === entry && x.selected)) assert.deepEqual(hm.get(entry), ep, "Unselected episode unchanged");
  }
  const queryTimes = [...new Set<number>(rows.flatMap(x => spec.relativeMinutes.map((m: number) => x.at + m * M)))].sort((a, b) => a - b);
  // Include whole-query delayed S/R/price snapshots, not future zones evaluated at an old price.
  const times = [...new Set(queryTimes.flatMap(t => [t - M, t]))].sort((a, b) => a - b);
  console.log(`[F03] ${rows.length} valid checkpoints, ${rows.filter(x => x.selected).length} overlapping selected cases, ${times.length} context times`);
  const ind = indicatorSnapshots(cs, times, spec); console.log("[F03] validated indicators ready");
  const hs = read(spec.hlSpec); hs.windowCoverage = { ...hs.windowCoverage, ...spec.additionalFlowCoverage };
  const tape = new TpHlTape(hs), sourceCounts: Row[] = [], anchors = [...new Set(times.flatMap(t => [t, t - 15 * M, t - H, t - 4 * H]))].sort((a, b) => a - b);
  for (const [kind, file] of SOURCES) {
    if (!pins.has(file)) await pin(file); let raw = 0, retained = 0;
    await lines(file, (r, line) => { raw++; const o = normalize(kind, r, file, line), ts = o.sourceAt; if (ts > cutoff) return;
      const targets = kind === "asset" || kind === "oi" ? anchors : times;
      const lookback = kind === "taker" ? 4 * H + 3 * M : kind === "asset" ? 3 * M : kind === "oi" ? 4 * M : kind === "vault" ? 31 * M : 20 * M;
      const i = upper(targets, ts - 1); if (i < targets.length && ts >= targets[i] - lookback) { tape.add(o); retained++; }
    }); sourceCounts.push({ kind, file, raw, retained }); console.log(`[F03] ${kind}: ${retained}/${raw} rows retained`);
  } tape.seal();
  fs.mkdirSync(out, { recursive: true }); const json = (f: string, v: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(v, null, 2) + "\n", { flag: "wx" });
  const contexts = new Map<number, Row>(), sr = new ReplaySrContext(cs, spec.srConfig); let boundary = -Infinity, asOfChecks = 0;
  const fd = fs.openSync(path.join(out, "contexts.jsonl"), "wx");
  for (const [n, at] of times.entries()) {
    const b = Math.floor(at / (30 * M)) * 30 * M; if (b > boundary) { sr.at(b); boundary = b; }
    const z = attachSr(cs, at, sr), p = priceFeatures(cs, at), i = ind.get(at)!;
    const hl = hlSnapshot(tape, at, hs.legacyPublicationLagMs), hd = hlSnapshot(tape, at, hs.legacyPublicationLagMs + M);
    const values = { ...i.values, ...Object.fromEntries(Object.entries(hl.features).map(([k, v]) => [`hl_${k}`, v])),
      price: p.price, roc15: p.roc15, roc60: p.roc60, roc240: p.roc240, roc720: p.roc720, vwap60DistancePct: p.vwapDistancePct,
      ema200Distance4hPct: p.trend.distancePct, sr_supportDistancePct: z.nearestSupport?.distancePct ?? null, sr_resistanceDistancePct: z.nearestResistance?.distancePct ?? null };
    const c = { at, iso: new Date(at).toISOString(), values, indicatorSources: i.sources, delayedValues: i.delayedValues,
      delayedIndicatorSources: i.delayedSources, price: p, delayedPrice: priceFeatures(cs, at - M), hl, hlDelayed: hd,
      sr: { coverage: z.coverage, nearestSupport: z.nearestSupport, nearestResistance: z.nearestResistance } };
    asOfChecks += assertAsOf(c, at); fs.writeSync(fd, JSON.stringify(c) + "\n"); contexts.set(at, c);
    if (n % 250 === 0) console.log(`[F03] point-in-time context ${n}/${times.length}`);
  } fs.closeSync(fd);
  for (const r of rows) {
    const now = contexts.get(r.at)!, first = contexts.get(r.firstAt)!, prior = contexts.get(r.at - 15 * M)!;
    assert(Math.abs(now.values.m30_mfi14 - r.mfi.value) < 1e-7, "F02/P01 indicator identity");
    const sr0 = supportResponse(cs, r.at, prior.sr, now.sr), sr1 = supportResponse(cs, r.at - M, contexts.get(r.at - 16 * M)!.sr, contexts.get(r.at - M)!.sr);
    r.supportResponse = sr0; r.delayedSupportResponse = sr1;
    r.flags = { primary: contrasts(now, first, prior, sr0), source60: contrasts(now, first, prior, sr1, true) };
    r.trajectory = spec.relativeMinutes.map((offset: number) => ({ offset, at: r.at + offset * M, ...contexts.get(r.at + offset * M)!.values }));
  }
  const prefixChecks: Row[] = [];
  for (const at of [times[0], times[Math.floor(times.length / 2)], times.at(-1)!]) {
    const prefix = cs.filter(c => c.endTs <= at); assert.deepEqual(indicatorSnapshots(prefix, [at], spec).get(at), ind.get(at));
    const sp = new ReplaySrContext(prefix, spec.srConfig); sp.at(Math.floor(at / (30 * M)) * 30 * M);
    const zs = attachSr(prefix, at, sp); assert.deepEqual({ coverage: zs.coverage, nearestSupport: zs.nearestSupport, nearestResistance: zs.nearestResistance }, contexts.get(at)!.sr);
    const t = new TpHlTape(hs); for (const rs of Object.values(tape.rows)) for (const r of rs) if (r.baseAvailableAt <= at && r.sourceAt <= at) t.add(r); t.seal();
    for (const lag of [M, 2 * M]) assert.deepEqual(hlSnapshot(t, at, lag), hlSnapshot(tape, at, lag));
    assert.deepEqual(priceFeatures(prefix, at), contexts.get(at)!.price);
    prefixChecks.push({ at, indicators: true, sr: true, hlPrimaryAndDelayed: true, price: true });
  }
  json("rows.json", rows); json("exclusions.json", exclusions); json("baseline-and-half.json", results); json("baseline-checks.json", baselineChecks);
  json("accounting-checks.json", audits); json("prefix-checks.json", prefixChecks); json("source-inventory.json", sourceCounts);
  json("contrasts.json", splitRows(rows, spec.contrasts)); json("feature-distributions.json", distributions(rows, contexts, spec.relativeMinutes));
  const summaries = results.filter(r => r.policy.id === "baseline").map(b => ({ model: b.model, ...attribution(rows.filter(x => x.model === b.model)) }));
  json("summary.json", { models: summaries, uniqueSelectedTimes: new Set(rows.filter(x => x.selected).map(x => x.at)).size,
    delay: summaries.flatMap(g => spec.contrasts.map((c: Row) => { const xs = rows.filter(x => x.model === g.model && x.selected);
      return { model: g.model, id: c.id, changed: xs.filter(x => x.flags.primary[c.id] !== x.flags.source60[c.id]).map(x => x.id) }; })) });
  fs.writeFileSync(path.join(out, "selected-cases.csv"), csv(rows.filter(x => x.selected).map(x => ({ ...x, trajectory: undefined }))), { flag: "wx" });
  fs.writeFileSync(path.join(out, "trajectories.csv"), csv(rows.flatMap(x => x.trajectory.map((t: Row) => ({ id: x.id, model: x.model, selected: x.selected, delta: x.delta, ...t })))), { flag: "wx" });
  for (const [file, sha256] of pins) assert.equal(await fileHash(file), sha256, `Changed input ${file}`);
  for (const p of protectedFiles) assert.equal(await fileHash(p.file), p.sha256, `Protected file changed ${p.file}`);
  json("manifest.json", { at: new Date().toISOString(), spec, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedFiles, newTradingDefinitions: 0, liveChanges: 0 });
  const artifacts = []; for (const file of fs.readdirSync(out)) artifacts.push({ file, sha256: await fileHash(path.join(out, file)) });
  json("validation.json", { complete: true, asOfChecks, contexts: times.length, queries: queryTimes.length, checkpoints: rows.length,
    sourceIndependentBaselines: baselineChecks.length, independentlyReaccountedCases: audits.length, artifacts });
  console.log(JSON.stringify(summaries, null, 2)); console.log(`[F03] complete ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
