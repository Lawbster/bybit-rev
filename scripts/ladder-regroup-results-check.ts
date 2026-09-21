/** Independent interval-based first-observation and cash/PnL check. No trading imports. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import type { Candle } from "./hype-freerun-canonical-replay";
const root = path.resolve(__dirname, ".."), sha = (x: Buffer | string) => crypto.createHash("sha256").update(x).digest("hex");
const out = path.resolve(root, process.env.REGROUP_OUT ?? "backtests/hype/hype-regroup-2026-09-08/diagnostic-v2");
const rel = path.relative(path.join(root, "backtests"), out); assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const manifest = read(path.join(out, "manifest.json")), spec = manifest.spec;
for (const p of manifest.pins) assert.equal(sha(fs.readFileSync(path.join(root, p.file))), p.sha256, p.file);
const prices = new Map<number, Candle>();
for (const p of manifest.prefixEvidence) {
  const bytes = fs.readFileSync(path.join(root, p.file)).subarray(0, p.bytes); assert.equal(sha(bytes), p.sha256);
  const rows = p.file.endsWith("jsonl") ? bytes.toString("utf8").trim().split(/\r?\n/).map(x => JSON.parse(x)) : JSON.parse(bytes.toString("utf8"));
  for (const r of rows) {
    const ts = Number(r.ts ?? r.timestamp); if (ts + 60000 > Date.parse(spec.historicalCutoff)) continue;
    prices.set(ts, { ts, endTs: ts + 60000, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high),
      low: Number(r.l ?? r.low), close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) });
  }
}
const candles = applyCandleRepair([...prices.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(path.join(root, spec.repairFile)), "HYPEUSDT", Date.parse(spec.historicalCutoff));
const histories = read(path.join(out, "historical-cohorts.json")), baselines = read(path.join(root, spec.historicalArchive, "baseline.json"));
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
let observations = 0, closedEpisodes = 0;
for (const b of baselines) {
  const events = fs.readFileSync(path.join(root, spec.historicalArchive, `${b.model}--baseline-inventory.jsonl`), "utf8").trim().split(/\r?\n/).map(x => JSON.parse(x));
  const firstByThreshold = new Map<number, Map<number, any>>(spec.descriptiveGrossPnlThresholdsPct.map((t: number) => [t, new Map()]));
  let realizedEpisode = 0, episodeId = 0;
  for (let j = 0; j < events.length; j++) {
    const ev = events[j], e = ev.event;
    if (ev.episode !== episodeId) { episodeId = ev.episode; realizedEpisode = 0; }
    if (e.kind !== "open") {
      // Independently settle each position's reduced quantity, rather than a
      // single aggregate cost-difference expression in the producer.
      for (const before of ev.before) {
        const after = ev.after.find((p: any) => p.id === before.id), q = before.qty - (after?.qty ?? 0);
        realizedEpisode += q * (e.price - before.entryPrice) - q * (e.price + before.entryPrice) * .00055;
      }
    }
    if (e.kind === "close") {
      const saved = b.audit.episodes.find((x: any) => x.episode === episodeId); assert(saved?.outcome);
      near(realizedEpisode, saved.outcome.pnl); closedEpisodes++;
    }
    if (ev.after.length < spec.descriptiveMinimumDepth) continue;
    const nextIndex = events[j + 1]?.event.fillIndex ?? candles.length;
    const cost = ev.after.reduce((n: number, p: any) => n + p.notional, 0), qty = ev.after.reduce((n: number, p: any) => n + p.qty, 0);
    for (let k = e.fillIndex; k < nextIndex && candles[k].endTs <= b.endMark.at; k++) {
      const c = candles[k], pct = (c.close * qty / cost - 1) * 100;
      for (const t of spec.descriptiveGrossPnlThresholdsPct) {
        const found = firstByThreshold.get(t)!;
        if (pct <= t && !found.has(episodeId)) found.set(episodeId, { at: c.endTs,
          mark: realizedEpisode + qty * c.close - cost - (cost + qty * c.close) * .00055 });
      }
    }
  }
  for (const h of histories.filter((x: any) => x.model === b.model)) {
    const rebuilt = firstByThreshold.get(h.threshold)!; assert.equal(rebuilt.size, h.observations.length);
    for (const x of h.observations) { const r = rebuilt.get(x.episode); assert(r); assert.equal(r.at, x.at); near(r.mark, x.netEpisodeMark); observations++; }
    near(h.completedEpisodeMarksAtObservation + h.subsequentEpisodeValueChange, h.selected.netCompleted);
    assert.equal(h.months.reduce((n: number, x: any) => n + x.observations, 0), h.observations.length);
    near(h.months.reduce((n: number, x: any) => n + x.netCompleted, 0), h.selected.netCompleted);
  }
}
const live = read(path.join(out, "live.json"));
near(live.rungs.reduce((n: number, r: any) => n + r.cost, 0), live.cost);
near(live.rungs.reduce((n: number, r: any) => n + r.grossPnlAtCutoff, 0), live.grossPnl);
near(live.qty, live.reconciliation.exchangeLongQty);
for (const r of live.rungs) assert(!r.precedingSrObservation || r.precedingSrObservation.at <= r.at);
for (const p of live.periods) near(p.winningBatchDollars + p.losingBatchDollars + p.srPnl, p.longRealizedJournal);
const result = { verified: true, distinctBaselineModels: baselines.length, closedEpisodeRecords: closedEpisodes,
  overlappingThresholdObservationRecords: observations, independentIntervalSelection: true,
  independentPerPositionPnl: true, inputHashes: true, liveRungs: live.rungs.length,
  checkerSha256: sha(fs.readFileSync(__filename)), checkedAt: new Date().toISOString() };
const dest = path.join(out, "verification.json"); assert(!fs.existsSync(dest), "Do not overwrite prior verification");
fs.writeFileSync(dest, JSON.stringify(result, null, 2) + "\n");
console.log(result);
