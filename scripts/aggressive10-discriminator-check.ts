/** Independent raw-price/cohort checks; no policy replay or live access. */
import fs from "fs";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
import { verifyPins, atomicJson } from "./research-workflow";
import { candles, verifyPrefixes } from "./aggressive10-discriminator-study";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const M = 60000, H = 60 * M, D = 24 * H;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const out = "backtests/hype/aggressive10-discriminators-2026-09-11", manifest = read(`${out}/manifest.json`), spec = manifest.spec;
  for (const p of manifest.sourcePins) assert.equal(await fileHash(p.file), p.sha256);
  await verifyPins(process.cwd(), manifest.pins); await verifyPrefixes(manifest.archivedPrefixes);
  const plan = read(`${manifest.accepted}/plan.json`), cs = await candles(plan, manifest.archivedPrefixes);
  const features: R[] = read(`${out}/features.json`), labels: R[] = read(`${out}/outcome-labels.json`), summaries: R[] = read(`${out}/summaries.json`);
  const original: R[] = read(`${manifest.accepted}/output/results.json`), lm = new Map(labels.map(x => [x.id, x]));
  const index = (end: number) => (end - cs[0].endTs) / M, cAt = (end: number) => cs[index(end)];
  const window = (start: number, end: number) => cs.slice(index(start + M), index(end) + 1);
  const hAt = (end: number) => { const xs = window(end - H, end); assert.equal(xs.length, 60);
    return { ts: end - H, endTs: end, open: xs[0].open, close: xs[59].close,
      high: Math.max(...xs.map(c => c.high)), low: Math.min(...xs.map(c => c.low)),
      volume: xs.reduce((n, c) => n + c.volume, 0), turnover: xs.reduce((n, c) => n + c.turnover, 0) }; };
  const maxCache = new Map<number, { high: number; known: number }>();
  const highAt = (end: number) => { if (!maxCache.has(end)) { const xs = window(end - 2 * D, end); assert.equal(xs.length, 2880);
    let best: Candle = xs[0]; for (const c of xs) if (c.high >= best.high) best = c;
    maxCache.set(end, { high: best.high, known: best.endTs }); } return maxCache.get(end)!; };
  const vwap = (start: number, end: number) => { const xs = window(start, end), vol = xs.reduce((n, c) => n + c.volume, 0);
    return vol > 0 ? xs.reduce((n, c) => n + c.turnover, 0) / vol : null; };
  for (const l of labels) {
    const r = original.find(x => x.primary && x.model === l.model && x.policy === spec.lead)!;
    const e = r.metrics.episodes.find((e: R) => e.entry === l.entry);
    assert.equal(l.pnl, e?.pnl ?? null); assert.equal(l.reason, e?.reason ?? "unfinished"); assert.equal(l.close, e?.close ?? null);
  }
  const unique = new Set<string>();
  for (const f of features) {
    assert(!unique.has(f.id)); unique.add(f.id); assert(lm.has(f.labelId));
    assert.equal(f.price.asOf, f.at - f.lag); assert.equal(f.pulse.asOf, f.at - f.lag);
    assert.equal(f.priorPulse.asOf, f.at - f.lag - 15 * M);
    assert.equal(f.at, f.archived.at); assert.equal(f.nextDepth, f.archived.nextDepth);
    if (f.scope === "hot_reopen") { assert.equal(f.nextDepth, 1); assert(f.archived.hotWouldBlock); }
    else { assert(f.archived.deepWouldBlock); assert(!f.priceDropOk); assert(f.nextDepth >= 6); }
    const p = f.price, end = p.asOf, c = cAt(end), high = highAt(end), hourEnd = Math.floor(end / H) * H;
    near(p.closedMinute.close, c.close); near(p.high.price, high.high); assert.equal(p.high.highKnownAt, high.known);
    near(p.distance2dPct, 100 * (1 - c.close / high.high));
    const hour = hAt(hourEnd), previous = hAt(hourEnd - H); assert.deepEqual(p.hour, hour); assert.deepEqual(p.previousHour, previous);
    near(p.roc1h, 100 * (hour.close / previous.close - 1)); near(p.sessionVwap, vwap(Math.floor(hour.ts / D) * D, hourEnd)!);
    near(p.ret15m, 100 * (c.close / cAt(end - 15 * M).close - 1));
    if (p.ladderVwap !== null) near(p.ladderVwap, vwap(f.entryAt, end)!);
    let anchor: R | null = null;
    for (let a = hourEnd; a > end - 6 * H; a -= H) { const h = hAt(a); if (h.high >= .99 * highAt(a).high) { anchor = h; break; } }
    assert.equal(p.anchor?.endTs ?? null, anchor?.endTs ?? null);
    if (anchor) { near(p.anchor.low, anchor.low); near(p.anchor.reference.price, highAt(anchor.endTs).high); }
    for (const z of p.closes15) { assert(z.end <= end); near(z.close, cAt(z.end).close); }
    const last15 = Math.floor(end / (15 * M)) * 15 * M;
    const remembered = !!anchor && [last15 - 15 * M, last15].every(t => t > anchor!.endTs && cAt(t).close < anchor!.low);
    assert.equal(f.flags.remembered_high_break, remembered);
    assert.equal(f.flags.near_high_weak_hour, p.distance2dPct <= 1 + 1e-10 && p.roc1h < 0);
    assert.equal(f.flags.lower_hour_structure, hour.high < previous.high && hour.close < previous.low);
    assert.equal(f.flags.below_session_vwap_negative_roc, hour.close < p.sessionVwap && p.roc1h < 0);
    for (const snap of [f.pulse, f.priorPulse]) {
      for (const x of [snap.flow15, snap.flow60]) {
        if (x.latestEligibleAt !== null) assert(x.latestEligibleAt <= snap.asOf);
        if (x.lastSourceAt !== null) { assert(x.lastSourceAt <= snap.asOf); near(x.ageSec, (snap.decisionAt - x.lastSourceAt) / 1000); }
        if (x.healthy) { assert(x.samples >= x.required && x.invalid === 0 && x.duplicates === 0 && x.ageSec <= spec.quality.maxTakerAgeSec && x.ratio !== null); }
      }
      for (const x of [snap.book, snap.asset]) if (x.source) { assert(x.source.availableAt <= snap.asOf); assert(x.source.sourceAt <= snap.asOf); }
    }
    assert(!("pnl" in f) && !("reason" in f), "Future outcome stays in separate labels");
  }
  for (const s of summaries) {
    const rows = features.filter(f => f.model === s.model && f.scope === s.scope && f.lag === s.lag);
    for (const [key, value] of [["selected", true], ["complement", false], ["unknown", null]] as const) {
      const xs = rows.filter(f => f.flags[s.descriptor] === value).map(f => lm.get(f.labelId)!);
      const complete = xs.filter(x => x.pnl !== null), wins = complete.filter(x => x.pnl > 0), losses = complete.filter(x => x.pnl < 0);
      assert.equal(s[key].observations, xs.length); assert.equal(s[key].wins, wins.length); assert.equal(s[key].losses, losses.length);
      near(s[key].winDollars, wins.reduce((n, x) => n + x.pnl, 0)); near(s[key].lossDollars, losses.reduce((n, x) => n + x.pnl, 0));
      near(s[key].net, complete.reduce((n, x) => n + x.pnl, 0));
    }
    near(s.baseline.net, s.selected.net + s.complement.net + s.unknown.net);
    near(s.selected.net, s.decisionMonths.reduce((n: number, m: R) => n + m.selected.net, 0));
  }
  const receipt = { passed: true, featureRows: features.length, labelRows: labels.length, cohortPartitions: summaries.length,
    rawHighHourlyVwapAnchorChecks: features.length, archivedOriginalNetDdMonthlyChecked: 12,
    featureFutureInputsAbsent: true, thresholdAndReceiptPrefixTests: "scripts/aggressive10-discriminator-tests.ts",
    newEconomicReplays: 0, checkerSha256: await fileHash("scripts/aggressive10-discriminator-check.ts"),
    artifacts: await Promise.all(["manifest.json", "verification.json", "features.json", "outcome-labels.json", "summaries.json", "controls.json"].map(async f => ({ file: `${out}/${f}`, sha256: await fileHash(`${out}/${f}`) }))) };
  if (process.argv.includes("--write")) { assert(!fs.existsSync(`${out}/independent-check.json`)); atomicJson(`${out}/independent-check.json`, receipt); }
  console.log(JSON.stringify(receipt, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
