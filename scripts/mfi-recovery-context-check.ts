/** F03 independent raw-source, causal-time and contribution verification. No rule-engine imports. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, fileHash, prices } from "./hype-failed-recovery-study";
type R = Record<string, any>;
const M = 60000, near = (a: number, b: number) => assert(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const epoch = (x: any) => typeof x === "number" ? x : /^\d+$/.test(x) ? Number(x) : Date.parse(x);
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-recovery-context-2026-09-09"), r = (f: string) => read(path.join(out, f));
  assert(!fs.existsSync(path.join(out, "verification.json")), "Do not overwrite accepted verification");
  const man = r("manifest.json"), val = r("validation.json"), spec = man.spec; assert(val.complete);
  for (const x of val.artifacts) assert.equal(await fileHash(path.join(out, x.file)), x.sha256, x.file);
  for (const x of [...man.pins, ...man.protectedFiles]) assert.equal(await fileHash(x.file), x.sha256, x.file);
  const cs = await prices(Date.parse(spec.cutoff), "backtests/hype/candle-repair-2026-09-05/repair.json");
  const contexts = new Map<number, R>(), needs = new Map<string, Map<number, R[]>>(); let sourceReferences = 0, indicatorClocks = 0, rawVwaps = 0;
  function walk(x: any, at: number) {
    if (!x || typeof x !== "object") return;
    const query = x.queryAt ?? at; assert(query <= at);
    if (x.file && x.line) {
      assert(x.sourceAt <= query && x.availableAt <= query);
      const f = needs.get(x.file) ?? new Map(), refs = f.get(x.line) ?? [];
      if (!refs.some((a: R) => a.availableAt === x.availableAt && a.availabilityBasis === x.availabilityBasis)) refs.push(x);
      f.set(x.line, refs); needs.set(x.file, f); sourceReferences++;
    }
    Object.values(x).forEach(y => walk(y, query));
  }
  await lines(path.join(out, "contexts.jsonl"), c => {
    assert(!contexts.has(c.at)); contexts.set(c.at, c); walk(c.hl.sources, c.at); walk(c.hlDelayed.sources, c.at);
    for (const [name, lag, values] of [["indicatorSources", 0, "values"], ["delayedIndicatorSources", M, "delayedValues"]] as const) {
      for (const [tf, s] of Object.entries(c[name]) as [string, R][]) {
        const interval = Number(tf.slice(1)) * M; assert.equal(s.sourceEnd, Math.floor((c.at - lag) / interval) * interval);
        assert.equal(s.sourceStart, s.sourceEnd - interval); assert.equal(s.availableAt, s.sourceEnd + lag); assert(s.availableAt <= c.at);
        const i = (s.sourceEnd - cs[0].endTs) / M; near(c[values][`${tf}_close`], cs[i].close);
        near(c[values][`${tf}_roc5`], 100 * (cs[i].close / cs[i - 5 * interval / M].close - 1)); indicatorClocks++;
        if (tf === "m60") {
          // Exact UTC-week VWAP from underlying minute turnover, not HLC3 or a future complete week.
          const d = new Date(s.sourceEnd - M), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          const week = day - ((d.getUTCDay() + 6) % 7) * 86400000;
          assert.equal(s.vwapWeekStart, week);
          let turn = 0, volume = 0; for (let j = (week - cs[0].ts) / M; j <= i; j++) { turn += cs[j].turnover; volume += cs[j].volume; }
          near(c[values].m60_weekVwap, turn / volume); near(c[values].m60_weekVwapDistancePct, 100 * (cs[i].close / (turn / volume) - 1)); rawVwaps++;
        }
      }
    }
    const i = (c.at - cs[0].endTs) / M; assert.equal(cs[i].close, c.price.price); assert.equal(cs[i - 1].close, c.delayedPrice.price);
    for (const n of [15, 60, 240, 720]) near(c.values[`roc${n}`], 100 * (cs[i].close / cs[i - n].close - 1));
    for (const z of [c.sr.nearestSupport, c.sr.nearestResistance].filter(Boolean)) {
      assert(z.zone.touchData.every((t: R) => t.ts <= c.at)); assert(z.zone.usableAt <= c.at); assert(z.zone.lastTouchKnownAt <= c.at);
      near(z.distancePct, Math.abs(z.zone.price / cs[i].close - 1) * 100);
    }
  }); assert.equal(contexts.size, val.contexts);
  const rows: R[] = r("rows.json"), selectedTimes = [...new Set<number>(rows.filter(x => x.selected).flatMap(x => [x.at, x.at - 15 * M]))];
  const probes = selectedTimes.map(at => ({ at, best: {} as R }));
  const raw = new Map<string, Map<number, R>>(); let uniqueRawRows = 0;
  for (const src of r("source-inventory.json")) {
    const required = needs.get(src.file) ?? new Map(), found = new Map<number, R>();
    await lines(src.file, (x, n) => {
      const refs = required.get(n); if (!refs && !["book", "asset", "oi"].includes(src.kind)) return;
      const sample = epoch(x.timestamp ?? x.ts), clocks = [x.receivedAt, x.observedAt, x.writtenAt, x.ingestedAt].filter(v => v != null).map(epoch);
      const bucket = src.kind === "taker" || src.kind.startsWith("candle");
      const end = src.kind === "taker" ? epoch(x.windowEnd ?? sample) : src.kind === "candle1m" ? sample + M : src.kind === "candle5m" ? sample + 5 * M : sample;
      const source = src.kind === "book" ? epoch(x.exchangeTimestamp) : src.kind === "asset" ? Math.min(sample, x.receivedAt == null ? sample : Number(x.receivedAt)) : end;
      const base = Math.max(sample, end, ...clocks, src.kind === "book" ? source : 0);
      if (["book", "asset", "oi"].includes(src.kind)) for (const p of probes) {
        const old = p.best[src.kind]; if (source <= p.at && base <= p.at && (!old || source > old.source || source === old.source && base >= old.base)) p.best[src.kind] = { source, base, line: n };
      }
      if (!refs) return;
      for (const ref of refs) {
        const lag = ref.availabilityBasis === "modeled_end_plus_120000ms" ? 2 * M : M;
        assert.equal(ref.sampleAt, sample); assert.equal(ref.sourceAt, source); assert.equal(ref.availableAt, Math.max(base, bucket && !clocks.length ? source + lag : 0));
      }
      found.set(n, x); uniqueRawRows++;
    }); assert.equal(found.size, required.size, `Every reference recovered ${src.kind}`); raw.set(src.file, found);
    console.log(`[F03 check] ${src.kind}: ${found.size} distinct raw rows`);
  }
  const hs = read(spec.hlSpec); let fullSelections = 0, flowChecks = 0, bookChecks = 0;
  for (const p of probes) for (const kind of ["book", "asset", "oi"]) {
    const best = p.best[kind]; if (best && p.at - best.source <= hs.freshnessMs[kind]) {
      assert.equal(contexts.get(p.at)!.hl.sources[kind].line, best.line); fullSelections++;
    }
  }
  for (const c of contexts.values()) for (const h of [c.hl, c.hlDelayed]) {
    for (const n of [15, 60, 240]) {
      const f = h.sources[`taker${n}`], ratio = h.features[`takerRatio${n}`]; if (ratio === null) continue;
      let buy = 0, sell = 0; const buckets = new Set();
      for (const s of f.sources) {
        const x = raw.get(s.file)!.get(s.line)!; assert(s.sourceAt > f.start && s.sourceAt <= f.end); assert(s.availableAt <= c.at);
        assert(!buckets.has(s.sourceAt)); buckets.add(s.sourceAt); assert.equal(epoch(x.windowEnd ?? x.timestamp) - epoch(x.windowStart ?? epoch(x.timestamp) - M), M);
        buy += Number(x.buyNotional); sell += Number(x.sellNotional);
      }
      assert(buckets.size >= (n === 15 ? 14 : n === 60 ? 55 : 220)); near(ratio, buy / sell); flowChecks++;
    }
    const delta = h.features.bookImbalance05Change15; if (delta !== null) {
      const imbalance = (ref: R) => {
        const x = raw.get(ref.file)!.get(ref.line)!; assert.equal(x.bandResolutionTooCoarse.pct_0_5, false);
        assert.equal(x.bidBandsTruncated.pct_0_5, false); assert.equal(x.askBandsTruncated.pct_0_5, false);
        const b = Number(x.bidBands.pct_0_5), a = Number(x.askBands.pct_0_5); return (b - a) / (b + a);
      };
      const a = h.sources.book, b = h.sources.book_15m_anchor;
      assert(c.at - a.sourceAt <= hs.freshnessMs.book && c.at - 15 * M - b.sourceAt <= hs.freshnessMs.book);
      near(delta, imbalance(a) - imbalance(b)); bookChecks++;
    }
  }
  const expected = new Set<number>(); let rawSupportBars = 0;
  for (const x of rows) {
    for (const offset of spec.relativeMinutes) { expected.add(x.at + offset * M); expected.add(x.at + offset * M - M); }
    assert.equal(x.firstAt + 60 * M, x.at); const c = contexts.get(x.at)!;
    assert.equal(x.flags.primary.C3, c.values.m60_weekVwapDistancePct < 0 && c.values.m60_roc5 <= 0);
    assert.equal(x.flags.source60.C3, c.delayedValues.m60_weekVwapDistancePct < 0 && c.delayedValues.m60_roc5 <= 0);
    near(x.mfi.value, c.values.m30_mfi14);
    for (const [s, at] of [[x.supportResponse, x.at], [x.delayedSupportResponse, x.at - M]] as [R, number][]) {
      assert.equal(s.knownAt, at - 15 * M); const support = contexts.get(at - 15 * M)!.sr.nearestSupport?.zone ?? null;
      assert.deepEqual(s.frozenLevel, support);
      const end = Math.floor(at / (5 * M)) * 5 * M;
      for (let k = 0; k < 2; k++) { const e = end - (1 - k) * 5 * M, i = (e - cs[0].endTs) / M;
        assert.equal(s.bars[k].start, e - 5 * M); assert.equal(s.bars[k].end, e); near(s.bars[k].close, cs[i].close);
        near(s.bars[k].high, Math.max(...cs.slice(i - 4, i + 1).map(c => c.high))); rawSupportBars++;
      }
      if (s.healthy) assert.equal(s.broken, s.bars.every((b: R) => b.close < support.price * .999)); else assert.equal(s.broken, null);
    }
    if (x.selected) { assert(x.fill.decisionAt === x.at && x.fill.fillIndex > x.fill.decisionIndex); near(x.delta, x.halfOutcome.pnl - x.baselineOutcome.pnl); }
    else assert.equal(x.delta, null, "No invented counterfactual control label");
  }
  assert.deepEqual([...expected].sort(), [...contexts.keys()].sort());
  const splits: R[] = r("contrasts.json");
  for (const x of splits) {
    const all = rows.filter(a => a.model === x.model && (x.month === "all" || a.iso.startsWith(x.month)));
    for (const [name, flag] of [["all", undefined], ["flagged", true], ["unflagged", false], ["unknown", null]] as const) {
      const xs = all.filter(a => name === "all" || a.flags[x.sensitivity][x.id] === flag), sel = xs.filter(a => a.selected), done = sel.filter(a => a.delta !== null);
      assert.equal(x[name].observations, xs.length); assert.equal(x[name].selected, sel.length);
      assert.equal(x[name].helpful, done.filter(a => a.delta > 1e-7).length); assert.equal(x[name].harmful, done.filter(a => a.delta < -1e-7).length);
      near(x[name].saved, done.reduce((s, a) => s + Math.max(0, a.delta), 0)); near(x[name].cost, -done.reduce((s, a) => s + Math.min(0, a.delta), 0));
      near(x[name].balance, done.reduce((s, a) => s + a.delta, 0));
    }
  }
  const artifact = { passed: true, at: new Date().toISOString(), contexts: contexts.size, checkpoints: rows.length, selectedOverlappingCases: rows.filter(x => x.selected).length,
    sourceReferences, uniqueRawRows, fullSelections, flowChecks, bookChecks, indicatorClocks, rawVwaps, rawSupportBars,
    contrastChecks: splits.length, checkerSha256: await fileHash(__filename), validationSha256: await fileHash(path.join(out, "validation.json")), newEconomicStrategies: 0, liveChanges: 0 };
  fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(artifact, null, 2) + "\n", { flag: "wx" }); console.log(artifact);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
