/** Separate H00 verifier: raw evidence selection/math and independent prefix-zone rebuild. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { loadCandles1m } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const ROOT = path.resolve(__dirname, ".."), M = 60_000, H = 60 * M;
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
const num = (x: any): number | null => x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x);
const near = (a: any, b: any) => a == null || b == null ? assert(a == null && b == null) : assert(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const ref = ({ raw, ...r }: R) => r;
async function sha(f: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(f)) h.update(b); return h.digest("hex"); }
async function scan(f: string, cb: (r: R, line: number) => void) { let i = 0; for await (const s of readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity })) { i++; if (s.trim()) cb(JSON.parse(s), i); } }
const sum = (xs: R[], f: (r: R) => number) => xs.reduce((s, r) => s + f(r), 0);
const wl = (xs: R[]) => ({ trades: xs.length, wins: xs.filter(t => t.net > 1e-8).length, losses: xs.filter(t => t.net < -1e-8).length,
  winningDollars: sum(xs, t => Math.max(0, t.net)), losingDollars: sum(xs, t => Math.min(0, t.net)), net: sum(xs, t => t.net) });
async function main() {
  assert.equal(process.argv.length, 3); const dir = path.resolve(ROOT, process.argv[2]), relative = path.relative(path.join(ROOT, "backtests"), dir);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && !fs.existsSync(path.join(dir, "verification.json")));
  const man = read(path.join(dir, "manifest.json")), spec = man.spec, joined: R[] = read(path.join(dir, "opportunities.json")), coverage = read(path.join(dir, "coverage.json"));
  assert.equal(spec.id, "hype-indicator-hl-sr-context-h00-2026-09-07"); assert.equal(joined.length, 14);
  assert.deepEqual(spec, read(path.join(ROOT, "research-inputs/indicators/context-h00-2026-09-07.json")));
  const artifacts = await Promise.all(fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile()).map(async file => ({ file, sha256: await sha(path.join(dir, file)) })));
  artifacts.push({ file: man.excerpt.file, sha256: await sha(path.join(dir, man.excerpt.file)) });
  assert.equal(artifacts.at(-1)!.sha256, man.excerpt.sha256);
  for (const p of [...man.sources, ...man.priceInputs, ...man.sourceInputs, ...man.protectedPins]) assert.equal(await sha(path.join(ROOT, p.file)), p.sha256, p.file);
  const records: R[] = []; await scan(path.join(dir, man.excerpt.file), r => records.push(r));
  const keys = new Map(records.map(r => [r.file + ":" + r.line, r])); assert.equal(keys.size, records.length);
  const times = joined.map(r => r.at), inventory: R[] = read(path.join(dir, "source-inventory.json")); let checkedRaw = 0;
  for (const src of spec.sources) {
    let retained = 0, rawRows = 0; const bins = new Set<number>(), basis: R = {}; let windowRows = 0;
    await scan(path.join(ROOT, src.file), (raw, line) => {
      rawRows++; const sample = Number(raw.timestamp ?? Date.parse(raw.ts)); assert(Number.isSafeInteger(sample));
      const receipts = [raw.receivedAt, raw.observedAt, raw.writtenAt, raw.ingestedAt].filter(x => x != null).map(x => typeof x === "number" || /^\d+$/.test(x) ? Number(x) : Date.parse(x));
      const end = src.kind === "hlTaker" ? Number(raw.windowEnd ?? sample) : raw.windowEnd == null ? sample : Number(raw.windowEnd);
      const availableAt = Math.max(sample, ...receipts, end + (src.kind === "hlTaker" && !receipts.length ? M : 0));
      const eligibleAt = Math.ceil(availableAt / M) * M, sourceAt = src.kind === "hlTaker" ? end : src.kind === "book" ? Number(raw.exchangeTimestamp) : Math.min(sample, raw.receivedAt == null ? sample : Number(raw.receivedAt));
      const timingBasis = receipts.length ? "recorded_receipt_or_write" : src.kind === "hlTaker" ? "modeled_end_plus_1m" : "sample_time_proxy";
      if (eligibleAt >= Date.parse(spec.start) && eligibleAt < Date.parse(spec.end)) { windowRows++; bins.add(eligibleAt); basis[timingBasis] = (basis[timingBasis] ?? 0) + 1; }
      const expected = times.some(t => eligibleAt >= t - 8 * H - 15 * M && eligibleAt <= t + M), r = keys.get(src.file + ":" + line);
      assert.equal(!!r, expected, "Raw excerpt completeness");
      if (r) { assert.deepEqual(r, { kind: src.kind, file: src.file, line, availableAt, eligibleAt, sourceAt, timingBasis, raw }); retained++; checkedRaw++; }
    });
    const info = inventory.find(i => i.kind === src.kind)!; assert.equal(info.rawRows, rawRows); assert.equal(info.retainedRows, retained); assert.equal(info.windowRows, windowRows); assert.deepEqual(info.windowTimingBasis, basis);
    let missing = 0; const monthly = new Map<string, R>();
    for (let t = Date.parse(spec.start); t < Date.parse(spec.end); t += M) { const month = new Date(t).toISOString().slice(0, 7), row = monthly.get(month) ?? { month, expectedDecisionMinutes: 0, minutesWithNewObservation: 0 };
      row.expectedDecisionMinutes++; row.minutesWithNewObservation += Number(bins.has(t)); missing += Number(!bins.has(t)); monthly.set(month, row); }
    assert.equal(info.missingDecisionMinutes, missing); assert.deepEqual(info.monthly, [...monthly.values()]);
  }
  records.sort((a, b) => a.availableAt - b.availableAt || a.line - b.line);
  const latest = (kind: string, t: number) => records.filter(r => r.kind === kind && r.eligibleAt <= t).at(-1) ?? null;
  let checkedSnapshots = 0, checkedFlowSources = 0;
  for (const row of joined) for (const field of ["context", "contextMinus5", "contextMinus15"]) {
    const s: R = row[field], at: number = s.at, q: R = spec.quality;
    assert.equal(at, row.at - (field === "context" ? 0 : field === "contextMinus5" ? 5 : 15) * M);
    for (const [field, minutes, required] of [["flow15", 15, 14], ["flow60", 60, 55]] as const) {
      const f: R = s[field], rs: R[] = records.filter(r => r.kind === "hlTaker" && r.eligibleAt <= at && r.eligibleAt > at - minutes * M && r.sourceAt > at - minutes * M && r.sourceAt <= at);
      assert.deepEqual(f.sources, rs.map(ref)); checkedFlowSources += rs.length;
      const es = rs.filter(r => num(r.raw.buyNotional) !== null && num(r.raw.sellNotional) !== null && Number(r.raw.buyNotional) >= 0 && Number(r.raw.sellNotional) >= 0);
      const buy = sum(es, r => Number(r.raw.buyNotional)), sell = sum(es, r => Number(r.raw.sellNotional)), n = new Set(es.map(r => Math.floor(r.sourceAt / M))).size;
      const ends = new Map<number, number>(); es.forEach(r => ends.set(r.sourceAt, (ends.get(r.sourceAt) ?? 0) + 1));
      const duplicates = [...ends.values()].filter(n => n > 1).length;
      const invalid = rs.filter(r => { const x = r.raw, end = r.sourceAt; return Number(x.windowStart) !== end - M || end % M !== 0 ||
        ![x.buyNotional, x.sellNotional, x.buyVol, x.sellVol, x.buyCount, x.sellCount].every(v => num(v) !== null && Number(v) >= 0) ||
        (x.firstTradeTime != null && !(Number(x.firstTradeTime) >= end - M)) || (x.lastTradeTime != null && !(Number(x.lastTradeTime) < end)); }).length;
      const age: number | null = es.length ? (at - Math.max(...es.map(r => r.sourceAt))) / 1000 : null;
      assert.equal(f.samples, n); assert.equal(f.required, required); assert.equal(f.expected, minutes); assert.equal(f.start, at - minutes * M); assert.equal(f.end, at);
      assert.equal(f.invalid, invalid); assert.equal(f.duplicates, duplicates); near(f.ageSec, age); near(f.buy, n ? buy : null); near(f.sell, n ? sell : null); near(f.net, n ? buy - sell : null); near(f.ratio, sell > 0 ? buy / sell : null);
      const reasons: Array<string | null> = [!n ? "missing" : null, n < required ? "incomplete_minutes" : null, age === null || age < 0 || age > q.maxTakerAgeSec ? "stale_or_unknown_age" : null,
        sell <= 0 ? "ratio_unavailable" : null, invalid ? "invalid_window" : null, duplicates ? "duplicate_window" : null].filter(Boolean);
      assert.deepEqual(f.reasons, reasons); assert.equal(f.healthy, reasons.length === 0);
    }
    const br = latest("book", at), ar = latest("asset", at); assert.deepEqual(s.book.source, br && ref(br)); assert.deepEqual(s.asset.source, ar && ref(ar));
    const b = br?.raw, written = num(b?.writtenAt ?? b?.timestamp), src = num(b?.exchangeTimestamp), received = num(b?.receivedAt);
    const validTime = written !== null && src !== null && src > 0 && written <= at && src <= at && (received === null || received <= at);
    const bookAge = validTime ? (at - Math.min(written!, src!, received ?? at)) / 1000 : null, fresh = bookAge !== null && bookAge >= 0 && bookAge <= q.maxBookAgeSec;
    const band = (key: string) => { const bid = num(b?.bidBands?.[key]), ask = num(b?.askBands?.[key]); const healthy = validTime && b?.bidBandsTruncated?.[key] === false && b?.askBandsTruncated?.[key] === false && b?.bandResolutionTooCoarse?.[key] === false && bid !== null && ask !== null && bid >= 0 && ask >= 0 && bid + ask > 0;
      return { healthy, bid: healthy ? bid : null, ask: healthy ? ask : null, imbalance: healthy ? (bid! - ask!) / (bid! + ask!) : null, askBidRatio: healthy && bid! > 0 ? ask! / bid! : null }; };
    for (const [field, key, metric] of [["observedBand05", "pct_0_5", "imbalance05"], ["observedBand2", "pct_2_0", "imbalance2"]]) {
      const bd = band(key); assert.deepEqual(s.book[field], br ? bd : null); near(s.book[metric], fresh && bd.healthy ? bd.imbalance : null);
    }
    near(s.book.ageSec, bookAge); const bookReasons = [!br ? "missing" : null, !fresh ? "stale_or_unknown_age" : null, !band("pct_0_5").healthy ? "invalid_05_band" : null].filter(Boolean);
    assert.deepEqual(s.book.reasons, bookReasons); assert.equal(s.book.healthy, bookReasons.length === 0);
    const assetAge = ar ? (at - ar.sourceAt) / 1000 : null, assetFresh = assetAge !== null && assetAge >= 0 && assetAge <= q.maxAssetAgeSec;
    near(s.asset.ageSec, assetAge); assert.equal(s.asset.currentFresh, assetFresh);
    const marked = (r: R | null) => r ? num(r.raw.openInterestValue) ?? (num(r.raw.openInterest) !== null && num(r.raw.markPrice) !== null ? Number(r.raw.openInterest) * Number(r.raw.markPrice) : null) : null;
    const change = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? (a / b - 1) * 100 : null;
    for (const c of s.asset.changes) { const t: number = at - c.minutes * M, a: R | null = latest("asset", t), lag: number | null = a ? (t - a.sourceAt) / 1000 : null;
      assert.deepEqual(c.source, a && ref(a)); assert.equal(c.anchorAt, t); near(c.anchorLagSec, lag);
      const native = change(ar ? num(ar.raw.openInterest) : null, a ? num(a.raw.openInterest) : null), usd = change(marked(ar), marked(a)), price = change(ar ? num(ar.raw.markPrice) : null, a ? num(a.raw.markPrice) : null);
      const reasons = [!ar || !a ? "missing_current_or_anchor" : null, !assetFresh ? "stale_current" : null, lag === null || lag < 0 || lag > q.maxAssetAnchorLagSec ? "stale_anchor" : null,
        native === null || usd === null || price === null ? "value_unavailable" : null].filter(Boolean);
      assert.deepEqual(c.reasons, reasons); assert.equal(c.healthy, reasons.length === 0); near(c.nativeOiChangePct, reasons.length ? null : native); near(c.markedOiChangePct, reasons.length ? null : usd); near(c.markChangePct, reasons.length ? null : price);
    }
    checkedSnapshots++;
  }
  const prior = path.join(ROOT, spec.r01Directory), old = read(path.join(prior, "manifest.json")), seed = Date.parse(old.spec.indicatorSeedBarStart);
  const candles = (await loadCandles1m(spec.symbol, path.join(prior, "inputs"), Date.parse(spec.end), path.join(prior, "inputs/repair.json"))).filter(c => c.ts >= seed);
  const five: R[] = []; for (let i = 0; i + 4 < candles.length; i += 5) { const xs = candles.slice(i, i + 5); assert(xs.every((c, k) => c.ts === xs[0].ts + k * M));
    five.push({ timestamp: xs[0].ts, open: xs[0].open, high: Math.max(...xs.map(c => c.high)), low: Math.min(...xs.map(c => c.low)), close: xs[4].close }); }
  const cfg = spec.srConfig, tf = cfg.tfMin * M;
  function zones(at: number): R[] {
    const end = Math.floor(at / (5 * M)) * 5 * M, lo = (end - seed) / (5 * M), count = Math.ceil(cfg.recentDays * 86400000 / (5 * M));
    const warm = Math.ceil((cfg.pivotLeft + cfg.pivotRight + 2) * cfg.tfMin / 5), input = five.slice(Math.max(0, lo - count - warm), lo), map = new Map<number, R>();
    for (const c of input) { const ts = Math.floor(c.timestamp / tf) * tf, b = map.get(ts); if (!b) map.set(ts, { ...c, timestamp: ts }); else { b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close; } }
    const bs = [...map.values()], touches: R[] = [];
    for (let i = cfg.pivotLeft; i + cfg.pivotRight < bs.length; i++) {
      const atConfirm = bs[i + cfg.pivotRight].timestamp + tf; if (atConfirm > at || atConfirm < at - cfg.recentDays * 86400000) continue;
      const neighbors = bs.slice(i - cfg.pivotLeft, i + cfg.pivotRight + 1).filter((_, k) => k !== cfg.pivotLeft);
      if (neighbors.every(b => b.high < bs[i].high)) touches.push({ ts: atConfirm, price: bs[i].high, side: "resistance" });
      if (neighbors.every(b => b.low > bs[i].low)) touches.push({ ts: atConfirm, price: bs[i].low, side: "support" });
    }
    const levels: R[] = [];
    for (const t of touches.sort((a, b) => a.ts - b.ts)) {
      let level = levels.find(l => Math.abs(l.price - t.price) / l.price <= cfg.clusterPct);
      if (!level) { level = { price: t.price, confirmTs: t.ts, touches: 0, highTouches: 0, lowTouches: 0, touchData: [] }; levels.push(level); }
      level.price = (level.price * level.touches + t.price) / (level.touches + 1); level.touches++; level.touchData.push(t); if (t.side === "resistance") level.highTouches++; else level.lowTouches++;
    }
    return levels.filter(l => l.touches >= cfg.minTouches).sort((a, b) => a.price - b.price).map(l => ({ ...l,
      price: sum(l.touchData, t => t.price) / l.touches, snapshotId: crypto.createHash("sha256").update(JSON.stringify(l.touchData)).digest("hex").slice(0, 24), usableAt: l.touchData[1].ts, lastTouchKnownAt: l.touchData.at(-1).ts }));
  }
  let checkedZones = 0;
  for (const r of joined) {
    for (const field of ["sr", "srMinus15"]) { const s = r[field], at = s.at, expected = zones(at); assert.deepEqual(s.zones, expected, `Independent SR prefix ${at}`); checkedZones += expected.length;
      const c = candles[(at - seed) / M - 1]; assert.equal(s.price, c.close); assert.deepEqual(s.priceSource, { start: c.ts, end: c.endTs, availableAt: c.endTs });
      assert(s.coverage.healthy); assert.equal(s.coverage.actualContinuousBars, 4032); assert.equal(s.coverage.latestClosedTs, at - 5 * M);
      for (const side of ["Support", "Resistance"]) { const candidates = expected.filter(z => side === "Support" ? z.price < c.close : z.price > c.close).sort((a, b) => Math.abs(a.price - c.close) - Math.abs(b.price - c.close));
        const match = candidates[0] ? { zone: candidates[0], distancePct: Math.abs(candidates[0].price / c.close - 1) * 100 } : null; assert.deepEqual(s["nearest" + side], match);
        const hit = s["configured" + side + "Hit"]; assert.equal(!!hit, !!match && match.distancePct <= cfg.bufferPct);
        if (hit) { near(hit.lv.price, match!.zone.price); near(hit.dist * 100, match!.distancePct); }
      }
    }
    const n = r.context, p5 = r.contextMinus5, p15 = r.contextMinus15, delta = (p: R) => n.book.healthy && p.book.healthy ? n.book.imbalance05 - p.book.imbalance05 : null;
    near(r.bookChange5, delta(p5)); near(r.bookChange15, delta(p15));
    const healthy = { flow15: n.flow15.healthy, flow60: n.flow60.healthy, book05: n.book.healthy, bookChange5: delta(p5) !== null, bookChange15: delta(p15) !== null,
      asset1h: n.asset.changes[0].healthy, asset4h: n.asset.changes[1].healthy, sr: r.sr.coverage.healthy };
    assert.deepEqual(r.healthy, healthy); assert.deepEqual(r.intersections, { flowSr: healthy.flow15 && healthy.sr, core: healthy.flow15 && healthy.book05 && healthy.asset1h && healthy.sr, fullContext: Object.values(healthy).every(Boolean) });
    for (const side of ["support", "resistance"]) { const response = r[side + "Response"], priorLevel = r.srMinus15[side === "support" ? "nearestSupport" : "nearestResistance"];
      assert.equal(response.knownAt, r.at - 15 * M); assert.deepEqual(response.frozenLevel, priorLevel);
      const closes = [r.at - 5 * M, r.at].map(end => ({ end, price: candles[(end - seed) / M - 1].close })); assert.deepEqual(response.closed5mPrices, closes);
      assert.equal(response.twoClosesBelow, priorLevel ? closes.every(c => c.price < priorLevel.zone.price * .999) : null);
      assert.equal(response.twoClosesAbove, priorLevel ? closes.every(c => c.price > priorLevel.zone.price * 1.001) : null);
    }
  }
  const oldDs: R[] = [], oldTs: R[] = []; await scan(path.join(prior, "decisions.jsonl"), r => { if (r.window === "recent" && spec.ids.includes(r.id)) oldDs.push(r); });
  await scan(path.join(prior, "trades.jsonl"), r => { if (r.window === "recent" && spec.ids.includes(r.id)) oldTs.push(r); });
  assert.deepEqual(joined.map(r => r.at), oldDs.filter(r => r.id === spec.ids[0] && r.delayMs === 0).map(r => r.at));
  for (const r of joined) { assert.deepEqual(r.baselineDecisions, oldDs.filter(d => d.at === r.at)); assert.deepEqual(r.baselineTrades, oldTs.filter(t => t.signalAt === r.at)); }
  const covered = (xs: R[]) => ({ opportunities: xs.length, ...Object.fromEntries(Object.keys(joined[0].healthy).map(k => [k, xs.filter(r => r.healthy[k]).length])),
    ...Object.fromEntries(Object.keys(joined[0].intersections).map(k => [k, xs.filter(r => r.intersections[k]).length])) });
  assert.deepEqual(coverage.overall, covered(joined));
  for (const c of coverage.monthly) assert.deepEqual(c, { month: c.month, ...covered(joined.filter(r => r.iso.startsWith(c.month))) });
  for (const c of coverage.cohortCoverage) { const ts = oldTs.filter(t => t.id === c.id && t.delayMs === c.delayMs); assert.deepEqual(c.baseline, wl(ts));
    assert.deepEqual(c.coverage, covered(joined.filter(r => ts.some(t => t.signalAt === r.at))));
    for (const x of c.descriptiveCoveredCohortsOnly) assert.deepEqual(x, { name: x.name, ...wl(ts.filter(t => joined.find(r => r.at === t.signalAt)!.intersections[x.name])) }); }
  // Flat exports must not overwrite numerical metrics with identically named health flags.
  const flat: R[] = read(path.join(dir, "opportunity-table.json")); assert.equal(flat.length, joined.length);
  for (const [i, f] of flat.entries()) { const r = joined[i]; assert.equal(f.at, r.at); assert.equal(f.iso, r.iso);
    near(f.book05, r.context.book.imbalance05); near(f.bookChange5, r.bookChange5); near(f.bookChange15, r.bookChange15);
    for (const k of Object.keys(r.healthy)) assert.equal(f[`healthy_${k}`], r.healthy[k]);
    for (const k of Object.keys(r.intersections)) assert.equal(f[k], r.intersections[k]);
    for (const k of Object.keys(r.descriptors)) assert.equal(f[k], r.descriptors[k]);
    near(f.taker15, r.context.flow15.healthy ? r.context.flow15.ratio : null); near(f.taker1h, r.context.flow60.healthy ? r.context.flow60.ratio : null);
    near(f.taker15Minus15, r.contextMinus15.flow15.healthy ? r.contextMinus15.flow15.ratio : null);
    near(f.nativeOi1hPct, r.context.asset.changes[0].nativeOiChangePct); near(f.markedOi1hPct, r.context.asset.changes[0].markedOiChangePct); near(f.nativeOi4hPct, r.context.asset.changes[1].nativeOiChangePct);
    near(f.price, r.sr.price); near(f.nearestSupport, r.sr.nearestSupport?.zone.price); near(f.supportDistancePct, r.sr.nearestSupport?.distancePct);
    near(f.nearestResistance, r.sr.nearestResistance?.zone.price); near(f.resistanceDistancePct, r.sr.nearestResistance?.distancePct);
    near(f.priorSupport, r.supportResponse.frozenLevel?.zone.price); assert.equal(f.priorSupportBroken, r.supportResponse.twoClosesBelow);
    for (const [name, id] of [["parentNet0", spec.ids[0]], ["oldNet0", "C02-32"], ["refinedNet0", "R01-08"]]) near(f[name], r.baselineTrades.find((t: R) => t.id === id && t.delayMs === 0)?.net);
    const d = r.baselineDecisions.find((d: R) => d.id === "R01-08" && d.delayMs === 0); assert.equal(f.refinedDecision, d.outcome); near(f.cmf20, d.gate.value);
  }
  const csv = fs.readFileSync(path.join(dir, "opportunities.csv"), "utf8").trim().split("\n"), header = csv.shift()!.split(",");
  assert.equal(new Set(header).size, header.length); assert.equal(csv.length, flat.length);
  csv.forEach((line, i) => assert.deepEqual(JSON.parse("[" + line + "]"), header.map(k => flat[i][k] == null ? "" : String(flat[i][k]))));
  for (const p of artifacts) assert.equal(await sha(path.join(dir, p.file)), p.sha256);
  for (const p of [...man.sources, ...man.sourceInputs, ...man.protectedPins]) assert.equal(await sha(path.join(ROOT, p.file)), p.sha256);
  const result = { passed: true, verifiedAt: new Date().toISOString(), opportunities: joined.length, archivedDecisionRows: oldDs.length, archivedTradeRows: oldTs.length,
    checkedRawEvidenceRows: checkedRaw, checkedSnapshots, checkedFlowSourceReferences: checkedFlowSources, independentlyRebuiltZones: checkedZones,
    independentRawSelectionAndMath: true, independentSrGeometry: true, checkedFlatExports: flat.length, strategyDefinitionsAdded: 0, artifacts,
    verifier: { file: path.relative(ROOT, __filename).replace(/\\/g, "/"), sha256: await sha(__filename) } };
  fs.writeFileSync(path.join(dir, "verification.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ ...result, artifacts: undefined }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
