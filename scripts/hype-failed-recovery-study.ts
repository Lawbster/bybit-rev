/** F01: archived-path diagnostic, not an economic exit replay. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import { firstDeepObservations, episodeMarkAt } from "./hype-ladder-regroup-audit";
import { auditComponentAccounting } from "./ladder-component-accounting";
import { auditInventory } from "./ladder-sizing-audit";
import { evidence, IndicatorContextTape, attachSr, type Kind } from "./indicator-hl-sr-context";
import { ReplaySrContext } from "./replay-sr-context";
import { M, H, sum, candleAt, priceFeatures, supportResponse, descriptors, inventoryAt, summarize, classify, type Row } from "./failed-recovery-analysis";
import type { Candle } from "./hype-freerun-canonical-replay";
export const hash = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");
export async function fileHash(file: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex"); }
export async function lines(file: string, cb: (r: Row, line: number) => void) {
  let n = 0; for await (const line of readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })) { n++; if (line.trim()) cb(JSON.parse(line), n); }
}
export function read(file: string): any { return JSON.parse(fs.readFileSync(file, "utf8")); }
export async function prices(cutoff: number, repair: string) {
  const map = new Map<number, Candle>();
  const add = (r: Row) => { const ts = Number(r.ts ?? r.timestamp); if (ts + M > cutoff) return;
    const c = { ts, endTs: ts + M, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high), low: Number(r.l ?? r.low),
      close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) };
    assert(Object.values(c).every(Number.isFinite)); map.set(ts, c); };
  read("data/HYPEUSDT_1_full.json").forEach(add); await lines("data/HYPEUSDT_1m.jsonl", add);
  const cs = applyCandleRepair([...map.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(repair), "HYPEUSDT", cutoff);
  cs.forEach((c, i) => assert.equal(c.ts, cs[0].ts + i * M)); assert.equal(cs.at(-1)!.endTs, cutoff); return cs;
}
export function csv(rows: Row[]) {
  const keys = [...new Set(rows.flatMap(Object.keys))], cell = (x: any) => JSON.stringify(x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x));
  return [keys.join(","), ...rows.map(r => keys.map(k => cell(r[k])).join(","))].join("\n") + "\n";
}
async function main() {
  const root = path.resolve(__dirname, ".."), card = "research-inputs/failed-recovery-2026-09-08.json", spec = read(card);
  assert.equal(process.cwd(), root); const out = path.resolve(process.argv[2] ?? `backtests/hype/${spec.id}`), rel = path.relative(path.join(root, "backtests"), out);
  assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out), "Fresh backtests directory required");
  const pins = new Map<string, string>();
  const pin = async (file: string, expected?: string) => { const h = await fileHash(file); if (expected) assert.equal(h, expected, file); pins.set(file, h); };
  for (const [f, h] of Object.entries(spec.archivePins)) await pin(`${spec.archive}/${f}`, h as string);
  const old = read(`${spec.archive}/manifest.json`), accepted = read(`${spec.archive}/verification.json`); assert(accepted.passed);
  console.log("[F01] pinning accepted L09 inputs and unchanged replay sources");
  for (const p of [...old.inputs, ...old.sources]) await pin(p.file, p.sha256);
  for (const f of [card, "scripts/failed-recovery-analysis.ts", "scripts/hype-failed-recovery-study.ts", "scripts/failed-recovery-tests.ts",
    "scripts/failed-recovery-check.ts", "scripts/hype-ladder-regroup-audit.ts", "scripts/indicator-hl-sr-context.ts", "scripts/replay-sr-context.ts"]) await pin(f);
  const protectedFiles = await Promise.all(["bot-config.json", "bot-state.json", "hl-short-live-config.json", "src/bot/index.ts", "src/bot/state.ts", "src/bot/strategy.ts"].map(async file => ({ file, sha256: await fileHash(file) })));
  const cfg = read("bot-config.json"); for (const [k, v] of Object.entries(spec.srConfig)) assert.deepEqual(cfg.srShadow[k], v);
  const all = read(`${spec.archive}/results.json`), bases: Row[] = all.filter((r: Row) => r.policy === "B17" && r.window !== "hl_window_latest"); assert.equal(bases.length, 4);
  const previous = read(`${old.spec.archiveDir}/results.json`);
  const candles = await prices(Date.parse(spec.cutoff), old.spec.repairFile), observations: Row[] = [], attrition: Row[] = [], baselineChecks: Row[] = [];
  for (const b of bases) {
    assert.equal(b.digest, previous.find((r: Row) => r.model === b.model && r.variant === "baseline").digest);
    const file = `${spec.archive}/${b.model}--B17-inventory.jsonl`; await pin(file); const events: Row[] = []; await lines(file, r => events.push(r));
    const startIdx = (Date.parse(b.start) - candles[0].endTs) / M, endIdx = (Date.parse(b.end) - candles[0].endTs) / M + 1;
    const accounting = auditComponentAccounting(candles, events as any, b.metrics, startIdx, endIdx, spec.initialEquity, spec.feeRate);
    assert.deepEqual(accounting, b.accounting); const allocation = auditInventory(events as any, b.config, b.metrics);
    const outcomes = new Map<number, Row>(allocation.episodes.map(e => [e.episode, e]));
    for (const threshold of spec.firstLossPct) {
      const first = firstDeepObservations(candles, events, Date.parse(b.end), spec.minimumDepth, threshold);
      for (const landmarkMinutes of spec.landmarkMinutes) {
        const excluded: Row[] = [];
        for (const x of first) {
          const at = x.at + landmarkMinutes * M, ep = outcomes.get(x.episode)!; assert(ep);
          let reason: string | null = null;
          if (at > Date.parse(b.end)) reason = "cutoff_before_landmark";
          const i = (at - candles[0].endTs) / M, e = reason ? null : inventoryAt(events, i);
          if (!reason && (!e || e.episode !== x.episode || !e.after.length)) reason = "episode_closed_before_landmark";
          if (!reason && e!.after.length < spec.minimumDepth) reason = "no_longer_deep";
          if (reason) { excluded.push({ episode: x.episode, firstAt: x.at, landmarkAt: at, reason, outcome: ep.outcome }); continue; }
          const held = e!.after, qty = sum(held, "qty"), cost = sum(held, "notional"), price = candleAt(candles, at).close;
          const mark = { episode: x.episode, index: i, grossPnl: qty * price - cost, cost, qty, price };
          const netEpisodeMark = episodeMarkAt(mark, events, spec.feeRate), outcome = ep.outcome;
          assert(!outcome || Date.parse(outcome.close) >= at);
          observations.push({ key: `${b.model}|${threshold}|${landmarkMinutes}|${x.episode}`, model: b.model, threshold, landmarkMinutes,
            episode: x.episode, entry: ep.entry, firstAt: x.at, firstIso: x.iso, at, iso: new Date(at).toISOString(), index: i,
            depth: held.length, qty, cost, price, grossPct: (price * qty / cost - 1) * 100, netEpisodeMark,
            oldestAgeHours: (at - Math.min(...held.map((p: Row) => p.entryTime))) / H,
            outcome, remainingValueChange: outcome ? outcome.pnl - netEpisodeMark : null,
            hoursToClose: outcome ? (Date.parse(outcome.close) - at) / H : null,
            chronology: at < Date.parse(spec.chronologyBoundary) ? "early" : "late" });
        }
        attrition.push({ model: b.model, threshold, landmarkMinutes, initial: first.length, retained: first.length - excluded.length, excluded });
      }
    }
    baselineChecks.push({ model: b.model, digest: b.digest, archivedDigestExact: true, rawAccountingExact: true, fills: events.length, marks: accounting.independentMinutes });
    console.log(`[F01] ${b.model}: exact archived control and raw accounting; ${observations.filter(x => x.model === b.model).length} landmarks`);
  }
  fs.mkdirSync(out, { recursive: true }); const json = (f: string, x: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(x, null, 2) + "\n", { flag: "wx" });
  json("baseline.json", bases); json("baseline-checks.json", baselineChecks); json("attrition.json", attrition);
  const times = [...new Set<number>(observations.flatMap(x => [x.at - 15 * M, x.at]))].sort((a, b) => a - b);
  const keep = (at: number) => { let lo = 0, hi = times.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (times[m] < at - M) lo = m + 1; else hi = m; }
    return lo < times.length && at >= times[lo] - 8 * H - 2 * M; };
  const tape = new IndicatorContextTape(spec), evidenceFile = path.join(out, "source-evidence.jsonl"), fd = fs.openSync(evidenceFile, "wx");
  const sourceInventory: Row[] = [];
  for (const src of spec.sources) {
    let raw = 0, retained = 0; await pin(src.file, old.inputs.find((p: Row) => p.file === src.file).sha256);
    await lines(src.file, (row, line) => { raw++; const r = evidence(src.kind as Kind, row, src.file, line);
      if (keep(r.eligibleAt)) { tape.add(r); retained++; fs.writeSync(fd, JSON.stringify(r) + "\n"); } });
    sourceInventory.push({ ...src, raw, retained }); console.log(`[F01] ${src.kind}: ${retained}/${raw} source rows retained`);
  }
  fs.closeSync(fd); tape.seal();
  const price = new Map<number, Row>(), sr = new Map<number, Row>(), contexts = new Map<number, Row>();
  const zones = new ReplaySrContext(candles, spec.srConfig);
  for (const [n, t] of times.entries()) {
    price.set(t, priceFeatures(candles, t)); sr.set(t, attachSr(candles, t, zones)); contexts.set(t, tape.snapshot(t));
    if (n % 100 === 0) console.log(`[F01] closed price/SR and pulse context ${n}/${times.length}`);
  }
  const prefixChecks: Row[] = [];
  const checkTimes = [...new Set([times[0], ...observations.filter(x => x.model === "hl_extended-resting_touch" && x.threshold === -3 && x.landmarkMinutes === 60).slice(0, 2).map(x => x.at), times.at(-1)!])];
  for (const t of checkTimes) {
    const prefix = new IndicatorContextTape(spec); tape.records.filter(r => r.eligibleAt <= t).forEach(r => prefix.add(r)); prefix.seal();
    assert.deepEqual(prefix.snapshot(t), contexts.get(t));
    const cs = candles.filter(c => c.endTs <= t); assert.deepEqual(priceFeatures(cs, t), price.get(t));
    assert.deepEqual(attachSr(cs, t, new ReplaySrContext(cs, spec.srConfig)), sr.get(t));
    prefixChecks.push({ at: t, pulse: true, closedPrices: true, sr: true });
  }
  for (const x of observations) {
    x.priceContext = price.get(x.at); x.previousPriceContext = price.get(x.at - 15 * M);
    x.support = supportResponse(candles, x.at, sr.get(x.at - 15 * M)!, sr.get(x.at)!);
    x.sr = { coverage: sr.get(x.at)!.coverage, nearestSupport: sr.get(x.at)!.nearestSupport, nearestResistance: sr.get(x.at)!.nearestResistance };
    x.context = contexts.get(x.at); x.previousContext = contexts.get(x.at - 15 * M); x.warnings = {};
    x.warnings["0"] = descriptors(x.priceContext, x.previousPriceContext, x.context, x.previousContext, x.support, candles);
    x.delayedHealth = {};
  }
  for (const delay of spec.additionalArrivalDelayMs.filter((n: number) => n > 0)) {
    const delayed = new IndicatorContextTape(spec);
    for (const r of tape.records) delayed.add(evidence(r.kind, { ...r.raw, writtenAt: r.availableAt + delay }, r.file, r.line));
    delayed.seal(); const snaps = new Map<number, Row>();
    for (const [n, t] of times.entries()) { snaps.set(t, delayed.snapshot(t)); if (n % 200 === 0) console.log(`[F01] +${delay}ms context ${n}/${times.length}`); }
    for (const x of observations) {
      const p = snaps.get(x.at)!, prev = snaps.get(x.at - 15 * M)!;
      x.warnings[String(delay)] = descriptors(x.priceContext, x.previousPriceContext, p, prev, x.support, candles);
      x.delayedHealth[String(delay)] = { flow15: p.flow15, flow60: p.flow60, nativeOi1h: p.asset.changes[0], previousFlow15: prev.flow15, previousFlow60: prev.flow60 };
    }
  }
  const groups: Row[] = [], monthly: Row[] = [];
  for (const b of bases) for (const threshold of spec.firstLossPct) for (const landmarkMinutes of spec.landmarkMinutes) {
    const rows = observations.filter(x => x.model === b.model && x.threshold === threshold && x.landmarkMinutes === landmarkMinutes);
    for (const [id, label] of spec.descriptors) for (const delay of spec.additionalArrivalDelayMs) {
      const g = { model: b.model, threshold, landmarkMinutes, id, label, delay, ...classify(rows, id, delay),
        chronology: ["early", "late"].map(part => ({ part, ...classify(rows.filter(x => x.chronology === part), id, delay) })) };
      groups.push(g);
      if (delay === 0) for (const month of [...new Set<string>(rows.map(x => x.iso.slice(0, 7)))]) {
        monthly.push({ model: b.model, threshold, landmarkMinutes, id, month,
          fullBaselineMonthMtm: b.metrics.monthly.find((r: Row) => r.month === month)?.mtmPnl ?? null,
          ...classify(rows.filter(x => x.iso.startsWith(month)), id, delay) });
      }
    }
  }
  const retention = spec.descriptors.map(([id, label]: string[]) => {
    const failures: string[] = [];
    for (const model of bases.filter(b => b.window === "hl_extended").map(b => b.model)) {
      const g = groups.find(g => g.model === model && g.threshold === -3 && g.landmarkMinutes === 60 && g.id === id && g.delay === 0)!;
      if (g.flagged.completed < 10 || g.flagged.furtherDeclines < 3) failures.push(`${model}:thin_flagged_cohort`);
      if (g.flagged.declineFraction === null || g.unflagged.declineFraction === null || g.flagged.declineFraction <= g.unflagged.declineFraction) failures.push(`${model}:no_decline_enrichment`);
      if (g.flagged.diagnosticBalance <= 0) failures.push(`${model}:sacrificed_recovery_exceeds_remaining_declines`);
      for (const part of g.chronology) if (part.flagged.completed < 3 || part.flagged.diagnosticBalance < 0) failures.push(`${model}:${part.part}:chronology`);
      for (const delay of [15000, 60000]) {
        const d = groups.find(d => d.model === model && d.threshold === -3 && d.landmarkMinutes === 60 && d.id === id && d.delay === delay)!;
        const known = g.flagged.observations + g.unflagged.observations, dk = d.flagged.observations + d.unflagged.observations;
        if (!known || dk < .8 * known || d.flagged.diagnosticBalance <= 0) failures.push(`${model}:${delay}:arrival_sensitivity`);
      }
    }
    return { id, label, retainedDescriptiveHypothesis: failures.length === 0, failures, economicScreenRun: false, deployable: false };
  });
  json("observations.json", observations); json("groups.json", groups); json("monthly.json", monthly); json("retention.json", retention);
  json("prefix-checks.json", prefixChecks); json("source-inventory.json", sourceInventory);
  fs.writeFileSync(path.join(out, "observations.csv"), csv(observations.map(x => ({ key: x.key, model: x.model, threshold: x.threshold, landmarkMinutes: x.landmarkMinutes,
    episode: x.episode, firstIso: x.firstIso, iso: x.iso, depth: x.depth, grossPct: x.grossPct, netEpisodeMark: x.netEpisodeMark,
    outcomePnl: x.outcome?.pnl ?? null, outcomeReason: x.outcome?.reason ?? null, outcomeClose: x.outcome?.close ?? null,
    remainingValueChange: x.remainingValueChange, roc60: x.priceContext.roc60, vwapDistancePct: x.priceContext.vwapDistancePct,
    ema200DistancePct: x.priceContext.trend.distancePct, taker15: x.context.flow15.healthy ? x.context.flow15.ratio : null,
    taker1h: x.context.flow60.healthy ? x.context.flow60.ratio : null, nativeOi1hPct: x.context.asset.changes[0].nativeOiChangePct,
    markedOi1hPct: x.context.asset.changes[0].markedOiChangePct, ...x.warnings["0"] }))), { flag: "wx" });
  for (const [file, sha] of pins) assert.equal(await fileHash(file), sha, `Concurrent mutation: ${file}`);
  for (const p of protectedFiles) assert.equal(await fileHash(p.file), p.sha256, p.file);
  json("manifest.json", { at: new Date().toISOString(), spec, pins: [...pins].map(([file, sha256]) => ({ file, sha256 })), protectedFiles,
    evidenceSha256: await fileHash(evidenceFile), newTradingDefinitions: 0, liveChanges: 0 });
  json("validation.json", { passed: true, baselineControls: 4, landmarks: observations.length, uniqueContextTimes: times.length,
    independentAccountingMarks: baselineChecks.reduce((s, r) => s + r.marks, 0), retained: retention.filter((r: Row) => r.retainedDescriptiveHypothesis).length,
    independentVerificationPending: true, economicReplayPerformed: false });
  console.log(`[F01 complete] ${out}; ${observations.length} landmarks; ${retention.filter((r: Row) => r.retainedDescriptiveHypothesis).length} diagnostic hypotheses retained`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
