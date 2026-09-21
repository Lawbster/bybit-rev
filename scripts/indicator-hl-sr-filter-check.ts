/** Independent H01 raw-context, schedule, accounting and attribution verifier. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { referenceFeatures, referenceCross } from "./indicator-entry-context-reference";
const ROOT = path.resolve(__dirname, ".."), M = 60000, H = 60 * M;
type R = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), "utf8"));
const key = (r: R) => `${r.arrivalDelayMs}|${r.delayMs}|${r.id}`;
const sum = (xs: R[], f: (x: R) => number) => xs.reduce((s, x) => s + f(x), 0);
const near = (a: any, b: any, label = "numeric", eps = 1e-6) => {
  if (a == null || b == null) assert(a == null && b == null, label);
  else assert(typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
};
const n = (x: any) => x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? null : Number(x);
async function sha(f: string) { const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(path.resolve(ROOT, f))) h.update(b); return h.digest("hex"); }
async function rawLines(f: string) { const rows: R[] = []; for await (const l of readline.createInterface({ input: fs.createReadStream(path.resolve(ROOT, f)), crlfDelay: Infinity })) if (l.trim()) rows.push(JSON.parse(l)); return rows; }
const wl = (ts: R[]) => ({ trades: ts.length, wins: ts.filter(t => t.net > 1e-8).length, losses: ts.filter(t => t.net < -1e-8).length,
  breakeven: ts.filter(t => Math.abs(t.net) <= 1e-8).length, winningDollars: sum(ts, t => Math.max(0, t.net)), losingDollars: sum(ts, t => Math.min(0, t.net)), closedNet: sum(ts, t => t.net) });
async function main() {
  assert.equal(process.argv.length, 3); const dir = path.resolve(ROOT, process.argv[2]), relative = path.relative(path.join(ROOT, "backtests"), dir);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative) && !fs.existsSync(path.join(dir, "verification.json")));
  const man = read(path.join(dir, "manifest.json")), s = man.spec; assert.deepEqual(s, read(man.cardFile));
  assert.equal(s.id, "hype-indicator-hl-sr-filters-h01-2026-09-08"); assert.equal(man.definitions.length, 8);
  assert.deepEqual(s.extraArrivalDelaysMs, [0, 15000, 60000]); assert.deepEqual(s.executionDelaysMs, [0, 60000]);
  const artifacts = await Promise.all(fs.readdirSync(dir).map(async file => ({ file, sha256: await sha(path.join(dir, file)) })));
  for (const p of [...man.sources, ...man.protectedPins]) assert.equal(await sha(p.file), p.sha256, p.file);
  const hm = read(s.h00Directory + "/manifest.json"), joined: R[] = read(s.h00Directory + "/opportunities.json");
  const raw = await rawLines(s.h00Directory + "/evidence/source-rows.jsonl");
  // Derive clocks from the original raw rows, not serialized delayed contexts.
  const source = raw.map<R>(r => {
    const x = r.raw, receipt = [x.receivedAt, x.observedAt, x.writtenAt, x.ingestedAt].filter(v => v != null).map(Number);
    const event = r.kind === "hlTaker" ? Number(x.windowEnd ?? x.timestamp) : Number(x.timestamp ?? x.ts);
    const at = Math.max(event, ...receipt, ...(r.kind === "hlTaker" && !receipt.length ? [event + M] : []));
    near(r.availableAt, at, "raw availability");
    const observed = r.kind === "hlTaker" ? event : r.kind === "book" ? Number(x.exchangeTimestamp) : Math.min(event, n(x.receivedAt) ?? event);
    near(r.sourceAt, observed, "raw source time"); return { ...r, base: at, observed };
  }).sort((a, b) => a.base - b.base || a.line - b.line);
  const eligibility = (r: R, lag: number) => Math.ceil((r.base + lag) / M) * M;
  const q = hm.spec.quality;
  function snapshot(t: number, lag: number): R {
    const latest = (kind: string, at: number) => source.filter(r => r.kind === kind && eligibility(r, lag) <= at).at(-1) ?? null;
    const flowRows = source.filter(r => r.kind === "hlTaker" && eligibility(r, lag) > t - 15 * M && eligibility(r, lag) <= t && r.observed > t - 15 * M && r.observed <= t);
    const usable = flowRows.filter(r => n(r.raw.buyNotional) !== null && n(r.raw.sellNotional) !== null && r.raw.buyNotional >= 0 && r.raw.sellNotional >= 0);
    const ends = new Map<number, number>(); usable.forEach(r => ends.set(r.observed, (ends.get(r.observed) ?? 0) + 1));
    const invalid = flowRows.filter(r => { const x = r.raw, end = r.observed, begin = n(x.windowStart); return begin !== end - M || end % M !== 0 ||
      ![x.buyNotional, x.sellNotional, x.buyVol, x.sellVol, x.buyCount, x.sellCount].every(v => n(v) !== null && Number(v) >= 0) ||
      (x.firstTradeTime != null && !(n(x.firstTradeTime) !== null && Number(x.firstTradeTime) >= begin!)) ||
      (x.lastTradeTime != null && !(n(x.lastTradeTime) !== null && Number(x.lastTradeTime) < end)); }).length;
    const buy = sum(usable, r => Number(r.raw.buyNotional)), sell = sum(usable, r => Number(r.raw.sellNotional)), ratio = sell > 0 ? buy / sell : null;
    const age = usable.length ? (t - Math.max(...usable.map(r => r.observed))) / 1000 : null, duplicates = [...ends.values()].filter(c => c > 1).length;
    const b = latest("book", t), x = b?.raw, written = n(x?.writtenAt ?? x?.timestamp), exchange = n(x?.exchangeTimestamp), received = n(x?.receivedAt);
    const validTime = written !== null && exchange !== null && exchange > 0 && written <= t && exchange <= t && (received === null || received <= t);
    const bage = validTime ? (t - Math.min(written!, exchange!, received ?? t)) / 1000 : null;
    const bid = n(x?.bidBands?.pct_0_5), ask = n(x?.askBands?.pct_0_5);
    const bookReady = validTime && bage !== null && bage >= 0 && bage <= q.maxBookAgeSec && x.bidBandsTruncated?.pct_0_5 === false && x.askBandsTruncated?.pct_0_5 === false && x.bandResolutionTooCoarse?.pct_0_5 === false && bid !== null && ask !== null && bid >= 0 && ask >= 0 && bid + ask > 0;
    const a = latest("asset", t), anchor = latest("asset", t - H), aAge = a ? (t - a.observed) / 1000 : null, anchorAge = anchor ? (t - H - anchor.observed) / 1000 : null;
    const pct = (x: number | null, y: number | null) => x !== null && y !== null && y > 0 ? (x / y - 1) * 100 : null;
    const marked = (r: R | null) => r ? n(r.raw.openInterestValue) ?? (n(r.raw.openInterest) !== null && n(r.raw.markPrice) !== null ? Number(r.raw.openInterest) * Number(r.raw.markPrice) : null) : null;
    const native = pct(n(a?.raw.openInterest), n(anchor?.raw.openInterest)), usd = pct(marked(a), marked(anchor)), mark = pct(n(a?.raw.markPrice), n(anchor?.raw.markPrice));
    const oiReady = aAge !== null && aAge >= 0 && aAge <= q.maxAssetAgeSec && anchorAge !== null && anchorAge >= 0 && anchorAge <= q.maxAssetAnchorLagSec && native !== null && usd !== null && mark !== null;
    return { flow: { buy: ends.size ? buy : null, sell: ends.size ? sell : null, ratio, ageSec: age, samples: ends.size, invalid, duplicates,
      ready: ends.size >= q.minTaker15mSamples && age !== null && age >= 0 && age <= q.maxTakerAgeSec && ratio !== null && !invalid && !duplicates, sources: flowRows },
      book: { ready: bookReady, imbalance: bookReady ? (bid! - ask!) / (bid! + ask!) : null, ageSec: bage, source: b },
      oi: { ready: oiReady, nativeChange: oiReady ? native : null, markedChange: oiReady ? usd : null, currentAgeSec: aAge, anchorLagSec: anchorAge, source: a, anchor } };
  }
  const contexts: R[] = read(path.join(dir, "contexts.json")), refs = new Map<string, R>();
  function checkRef(a: R | null, b: R | null, lag: number) {
    if (!b) { assert.equal(a, null); return; } assert(a);
    for (const f of ["file", "line", "kind", "timingBasis"]) assert.equal(a![f], b[f]);
    near(a!.sourceAt, b.observed); near(a!.baseAvailableAt, b.base); near(a!.modeledAvailableAt, b.base + lag); near(a!.eligibleAt, eligibility(b, lag));
  }
  assert.equal(contexts.length, 84);
  for (const c of contexts) {
    const r = snapshot(c.at, c.arrivalDelayMs); refs.set(`${c.arrivalDelayMs}|${c.at}`, r); assert.equal(c.historicalArrivalProven, false);
    for (const family of ["flow", "book", "oi"]) {
      assert.equal(c[family].ready, r[family].ready); assert.equal(c[family].reasons.length === 0, r[family].ready);
      for (const [f, v] of Object.entries(r[family])) if (!["ready", "sources", "source", "anchor"].includes(f)) near(c[family][f], v, family + "." + f, 1e-8);
    }
    assert.equal(c.flow.sources.length, r.flow.sources.length); c.flow.sources.forEach((x: R, i: number) => checkRef(x, r.flow.sources[i], c.arrivalDelayMs));
    checkRef(c.book.source, r.book.source, c.arrivalDelayMs); checkRef(c.oi.source, r.oi.source, c.arrivalDelayMs); checkRef(c.oi.anchor, r.oi.anchor, c.arrivalDelayMs);
  }
  const seed = Date.parse(s.indicatorSeedBarStart), start = Date.parse(s.start), end = Date.parse(s.end), r01 = hm.spec.r01Directory;
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  const cs = (await loadCandles1m(s.symbol, path.resolve(ROOT, r01, "inputs"), end, path.resolve(ROOT, r01, "inputs/repair.json"))).filter(c => c.ts >= seed);
  assert.equal(cs.length, s.expectedMinuteRows); cs.forEach((c, i) => assert.equal(c.ts, seed + i * M));
  const features = referenceFeatures(cs), rule = read(r01 + "/manifest.json").rules.find((r: R) => r.id === s.baselines[0]), bb = features.get(rule);
  const signals: number[] = []; for (const [t, c] of bb) if (referenceCross(rule, bb.get(t - 4 * H), c) && t + 4 * H >= start && t + 4 * H < end) signals.push(t + 4 * H);
  assert.deepEqual(signals, joined.map(r => r.at)); const cmf = features.get({ family: "cmf", period: 20, timeframeMs: H });
  const results: R[] = read(path.join(dir, "results.json")), trades: R[] = read(path.join(dir, "trades.json")), decisions: R[] = read(path.join(dir, "decisions.json"));
  const monthly: R[] = read(path.join(dir, "monthly.json")), diagnostics: R[] = read(path.join(dir, "diagnostics.json"));
  const rows = new Map(results.map(r => [key(r), r])); assert.equal(results.length, 114); assert.equal(rows.size, 114);
  const candle = (at: number) => { const c = cs[(at - seed) / M]; assert(c && c.ts === at); return c; };
  function metrics(ts: R[], scale = 1) {
    let cursor = 0, closed = 0, peak = s.initialEquity, dd = 0, closeDD = 0, bankrupt = false;
    for (let at = start; at < end; at += M) {
      while (cursor < ts.length && ts[cursor].exitAt <= at) closed += ts[cursor++].net;
      const p = ts[cursor]?.entryAt <= at ? ts[cursor] : null, c = candle(at);
      const equity = (price: number) => s.initialEquity + scale * (closed + (p ? p.qty * (p.entryPrice - price) - p.qty * (p.entryPrice + price) * s.feeRatePerSide : 0));
      const e = equity(c.close), adverse = equity(c.high); dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, e); closeDD = Math.max(closeDD, 100 * (peak - e) / peak); bankrupt ||= adverse <= 0;
    }
    return { dd, closeDD, bankrupt };
  }
  let checkedTrades = 0, checkedDecisions = 0, checkedMonths = 0;
  for (const r of results) {
    assert.equal(r.start, s.start); assert.equal(r.end, s.end); assert.equal(r.side, "short"); assert(s.executionDelaysMs.includes(r.delayMs) && s.extraArrivalDelaysMs.includes(r.arrivalDelayMs));
    const ts = trades.filter(t => key(t) === key(r)), ds = decisions.filter(d => key(d) === key(r));
    const isReady = r.kind === "readiness", def = man.definitions.find((x: R) => x.id === (isReady ? r.id.slice(6) : r.id));
    if (def) for (const f of ["baseId", "family", "role"]) assert.equal(r[f], def[f]); else { assert.equal(r.kind, "baseline"); assert(s.baselines.includes(r.id)); }
    assert.deepEqual(ds.map(d => d.at), signals); let free = start, occupied = 0, missing = 0, blocked = 0; const accepted: number[] = [];
    for (const [i, t] of signals.entries()) {
      const base = def?.baseId ?? r.id, value = cmf.get(t - H)?.vfSigned;
      const cmfReady = base === s.baselines[0] || value != null && Number.isFinite(value);
      const cmfPass = base === s.baselines[0] || cmfReady && value! < (base === "C02-32" ? 0 : -.05);
      let pulseReady = true, pulsePass = true, pulseValue: number | null = null;
      if (def) {
        const now = refs.get(`${r.arrivalDelayMs}|${t}`)!, prev = refs.get(`${r.arrivalDelayMs}|${t - 15 * M}`)!;
        if (def.family === "flow" || def.family === "book") {
          const f = def.family, field = f === "flow" ? "ratio" : "imbalance"; pulseReady = now[f].ready && prev[f].ready;
          pulseValue = pulseReady ? now[f][field] - prev[f][field] : null; pulsePass = pulseValue !== null && pulseValue < 0;
        } else if (def.family === "oi") { pulseReady = now.oi.ready; pulseValue = pulseReady ? now.oi.nativeChange : null; pulsePass = pulseValue !== null && pulseValue >= 0; }
        else {
          assert.equal(def.family, "sr"); const j = joined.find(x => x.at === t)!, level = j.srMinus15.nearestSupport?.zone;
          pulseReady = j.sr.coverage.healthy && j.srMinus15.coverage.healthy;
          if (level) { assert(level.usableAt <= t - 15 * M && level.lastTouchKnownAt <= t - 15 * M); assert(level.touchData.every((x: R) => x.ts <= t - 15 * M)); }
          pulseValue = pulseReady ? Number(!!level && [t - 5 * M, t].every(e => candle(e - M).close < level.price * .999)) : null; pulsePass = pulseValue === 1;
        }
        const g = ds[i].gate; assert.equal(g.evidenceKind, "mixed_context"); assert.equal(g.readinessOnly, isReady);
        assert.equal(g.pulse.ready, pulseReady); assert.equal(g.pulse.pass, pulsePass); near(g.pulse.value, pulseValue); assert.equal(g.pulse.contextKey, `${r.arrivalDelayMs}|${t}`);
        assert.equal(g.ready, cmfReady && pulseReady); assert.equal(g.pass, cmfReady && pulseReady && cmfPass && (isReady || pulsePass));
        assert.equal(g.condition, r.id); if (base === s.baselines[0]) assert.equal(g.cmf, null);
      }
      const cg = def ? ds[i].gate.cmf : ds[i].gate;
      if (base !== s.baselines[0]) { near(cg.value, value, "independent CMF", 1e-8); assert.equal(cg.sourceEnd, t); assert.equal(cg.sourceStart, t - H); assert.equal(cg.availableAt, t); assert.equal(cg.pass, cmfPass); }
      const outcome = t < free ? "occupied" : !cmfReady || !pulseReady ? "missing_context" : !cmfPass || (!isReady && !pulsePass) ? "condition_false" : "accepted";
      if (outcome === "accepted") { accepted.push(t); free = t + s.holdMs + 2 * r.delayMs; } else if (outcome === "occupied") occupied++; else if (outcome === "missing_context") missing++; else blocked++;
      assert.equal(ds[i].outcome, outcome); assert.equal(ds[i].acceptedEntryAt, outcome === "accepted" ? t + r.delayMs : null);
      assert.equal(ds[i].sourceEnd, t); assert.equal(ds[i].availableAt, t); assert.equal(ds[i].sourceStart, t - 4 * H);
      for (const [f, v] of Object.entries(bb.get(t - 4 * H)!)) near(ds[i].feature[f], v, "independent Bollinger", 1e-8);
      checkedDecisions++;
    }
    assert.deepEqual(ts.map(t => t.signalAt), accepted); assert.equal(r.open, null); assert.equal(r.pendingAtEnd, false);
    assert.equal(r.rawSignals, signals.length); assert.equal(r.skippedOccupied, occupied); assert.equal(r.blockedMissing, missing); assert.equal(r.blockedCondition, blocked);
    for (const t of ts) {
      assert.equal(t.entryAt, t.signalAt + r.delayMs); assert.equal(t.exitDecisionAt, t.entryAt + s.holdMs); assert.equal(t.exitAt, t.exitDecisionAt + r.delayMs); assert(t.exitAt < end);
      near(t.entryPrice, candle(t.entryAt).open); near(t.exitPrice, candle(t.exitAt).open); near(t.qty, s.notionalUsdt / t.entryPrice); assert.equal(t.reason, "timeout");
      near(t.pricePnl, t.qty * (t.entryPrice - t.exitPrice)); near(t.fees, t.qty * (t.entryPrice + t.exitPrice) * s.feeRatePerSide); near(t.net, t.pricePnl - t.fees); checkedTrades++;
    }
    for (const [f, v] of Object.entries(wl(ts))) near(r[f], v, f); near(r.net, sum(ts, t => t.net)); near(r.openNet, 0);
    const turnover = sum(ts, t => t.qty * (t.entryPrice + t.exitPrice)); near(r.turnoverIncludingMarkedExit, turnover); near(r.feesPaid, sum(ts, t => t.fees)); near(r.stressNet, r.net - turnover * .0005);
    near(r.exposureHours, sum(ts, t => (t.exitAt - t.entryAt) / H)); const risk = metrics(ts); near(r.maxAdverseDrawdownPct, risk.dd); near(r.maxCloseDrawdownPct, risk.closeDD); assert.equal(r.bankrupt, risk.bankrupt);
    let previous = 0;
    for (let at = start; at < end;) {
      const date = new Date(at), month = date.toISOString().slice(0, 7), boundary = Math.min(end, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      const done = ts.filter(t => t.exitAt < boundary), held = ts.filter(t => t.entryAt < boundary && t.exitAt >= boundary); assert(held.length <= 1);
      const price = candle(boundary - M).close, cumulative = sum(done, t => t.net) + sum(held, t => t.qty * (t.entryPrice - price) - t.qty * (t.entryPrice + price) * s.feeRatePerSide);
      const m = monthly.find(m => key(m) === key(r) && m.month === month)!; assert(m); near(m.markedNet, cumulative - previous);
      const exits = ts.filter(t => t.exitAt >= at && t.exitAt < boundary); for (const [f, v] of Object.entries(wl(exits))) near(m[f], v);
      near(m.feesPaid, sum(exits, t => t.qty * t.exitPrice * s.feeRatePerSide) + sum(ts.filter(t => t.entryAt >= at && t.entryAt < boundary), t => t.qty * t.entryPrice * s.feeRatePerSide));
      at = boundary; previous = cumulative; checkedMonths++;
    }
    if (r.kind === "variant") {
      const own = rows.get(key({ ...r, id: r.baseId }))!, ready = rows.get(key({ ...r, id: "ready_" + r.id }))!;
      for (const [field, id] of [["deltaBase", r.baseId], ["deltaReadiness", "ready_" + r.id], ["deltaUnfiltered", s.baselines[0]], ["deltaOldCmf", "C02-32"]]) near(r[field], r.net - rows.get(key({ ...r, id }))!.net);
      const d = diagnostics.find(d => key(d) === key(r))!; near(d.maxAdverseDrawdownPct, risk.dd); near(d.maxCloseDrawdownPct, risk.closeDD);
      if (ready.exposureHours === 0) assert.equal(d.scaledReadiness, null); else {
        const scale = r.exposureHours / ready.exposureHours, risk = metrics(trades.filter(t => key(t) === key(ready)), scale);
        near(d.scaledReadiness.scale, scale); near(d.scaledReadiness.maxAdverseDrawdownPct, risk.dd); near(d.scaledReadiness.losingDollars, ready.losingDollars * scale);
      }
    }
  }
  assert.equal(checkedMonths, monthly.length);
  for (const m of monthly.filter(m => rows.get(key(m))!.kind === "variant")) {
    const r = rows.get(key(m))!;
    for (const [field, id] of [["deltaBase", r.baseId], ["deltaReadiness", "ready_" + r.id], ["deltaUnfiltered", s.baselines[0]]]) near(m[field], m.markedNet - monthly.find(x => key(x) === key({ ...r, id }) && x.month === m.month)!.markedNet);
  }
  const attrs: R[] = read(path.join(dir, "trade-attribution.json")); assert.equal(attrs.length, 48);
  for (const a of attrs) for (const f of ["base", "readiness"]) {
    const r = rows.get(key(a))!, p = rows.get(key({ ...r, id: f === "base" ? r.baseId : "ready_" + r.id }))!, x = a[f];
    const pt = trades.filter(t => key(t) === key(p)), vt = trades.filter(t => key(t) === key(r)), removed = pt.filter(t => !vt.some(v => v.signalAt === t.signalAt)), added = vt.filter(t => !pt.some(v => v.signalAt === t.signalAt));
    assert.equal(x.removedCount, removed.length); assert.equal(x.newlyEnabledCount, added.length); assert.equal(x.common, pt.length - removed.length);
    assert.deepEqual(x.removedSignalAts, removed.map(t => t.signalAt)); assert.deepEqual(x.newlyEnabledSignalAts, added.map(t => t.signalAt));
    for (const [field, value] of Object.entries({ sacrificedWinningDollars: sum(removed, t => Math.max(0, t.net)), avoidedLosingDollars: -sum(removed, t => Math.min(0, t.net)), removedNet: sum(removed, t => t.net), newlyEnabledNet: sum(added, t => t.net), addedWinningDollars: sum(added, t => Math.max(0, t.net)), addedLosingDollars: sum(added, t => Math.min(0, t.net)) })) near(x[field], value);
    near(r.net - p.net, x.newlyEnabledNet - x.removedNet, "Full occupancy attribution bridge");
    for (const z of x.removedByReason) { const ts = removed.filter(t => decisions.find(d => key(d) === key(r) && d.at === t.signalAt)!.outcome === z.reason); assert.equal(z.count, ts.length); near(z.winningDollars, sum(ts, t => Math.max(0, t.net))); near(z.losingDollars, sum(ts, t => Math.min(0, t.net))); }
  }
  const ranking: R[] = read(path.join(dir, "ranking.json")); assert.equal(ranking.length, 24);
  for (const r of ranking) {
    const rs = results.filter(x => x.id === r.id && x.arrivalDelayMs === r.arrivalDelayMs), mm = monthly.filter(x => x.id === r.id && x.arrivalDelayMs === r.arrivalDelayMs);
    const pass = rs.every(x => x.trades >= 10 && x.net > 0 && x.stressNet > 0 && !x.bankrupt && Math.min(x.deltaBase, x.deltaReadiness) >= 200 - 1e-8 && [x.baseId, "ready_" + x.id].every(id => x.maxAdverseDrawdownPct <= rows.get(key({ ...x, id }))!.maxAdverseDrawdownPct + 1e-8)) && mm.every(x => Math.min(x.deltaBase, x.deltaReadiness, x.deltaUnfiltered) >= -320 - 1e-8);
    assert.equal(r.recentExploratoryProfitPass, pass); assert.equal(!r.failures.length, pass); assert.equal(r.fullHistoryScreenEvaluated, false); assert.equal(r.deploymentCandidate, false);
    near(r.minDeltaBase, Math.min(...rs.map(x => x.deltaBase))); near(r.minDeltaReadiness, Math.min(...rs.map(x => x.deltaReadiness))); near(r.worstMonthlyDelta, Math.min(...mm.flatMap(x => [x.deltaBase, x.deltaReadiness, x.deltaUnfiltered])));
  }
  for (const p of [...man.sources, ...man.protectedPins]) assert.equal(await sha(p.file), p.sha256); for (const p of artifacts) assert.equal(await sha(path.join(dir, p.file)), p.sha256);
  const result = { passed: true, verifiedAt: new Date().toISOString(), logicalCases: results.length, checkedTrades, checkedDecisions, checkedMonths,
    independentSourceContexts: contexts.length, rawEvidenceRows: raw.length, attributionComparisons: 96, independentIndicatorMath: true,
    independentDeliveryAndGates: true, independentOccupancyAndAccounting: true, independentRiskMonthliesAndScreens: true, artifacts,
    verifier: { file: path.relative(ROOT, __filename).replace(/\\/g, "/"), sha256: await sha(__filename) } };
  fs.writeFileSync(path.join(dir, "verification.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify({ ...result, artifacts: undefined }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
