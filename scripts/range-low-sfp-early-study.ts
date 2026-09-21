/** SF02: mixed-timeframe confirmation; reuse SF01 map/execution/report infrastructure. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { ROOT, buildContext, loadTape, runScan, type SetupEvent } from './setup-scan-core';
import { detectRangeLowSfp, sf01RangeLow } from './setup-detectors/sf01-range-low';
import { buildActions, runReplay, type ReplayConfig } from './setup-replay';
import { parseCsv, parseTimeframes, writeChart } from './setup-chart';

const CARD = 'research-inputs/range-low-sfp-early-sf02-2026-09-20.json';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const eventsAt = (d: string): SetupEvent[] => fs.readFileSync(path.join(d, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
async function verify(d: string) {
  for (const a of read(path.join(d, 'complete.json')).artifacts) assert.equal(await fileHash(path.join(d, a.file)), a.sha256, `${d}/${a.file}`);
}
const clean = (o: unknown) => JSON.parse(JSON.stringify(o));
const median = (xs: number[]) => { xs.sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : null; };
async function main() {
  const card = read(path.join(ROOT, CARD));
  assert.equal(await fileHash(path.join(ROOT, card.parentCard)), card.parentSha256);
  const c = read(path.join(ROOT, card.parentCard)), parentDir = path.join(ROOT, card.parentStudy);
  await verify(parentDir); const parent = read(path.join(parentDir, 'comparison.json'));
  const fixed = ['scripts/setup-scan-core.ts', 'scripts/setup-replay.ts', 'scripts/poc-indicator-bias-engine.ts', 'scripts/structural-replay-audit.ts'];
  for (const file of fixed) assert.equal(await fileHash(path.join(ROOT, file)), parent.hashes.find((p: any) => p.file === file).sha256, `parent infrastructure changed: ${file}`);
  const baseRuns = parent.runs.filter((r: any) => r.name === 'range_sfp');
  const basePlan = read(path.join(ROOT, 'backtests/setup-scans', baseRuns[0].scan, 'plan.json'));
  const cache = path.dirname(basePlan.tape.file), seal = read(path.join(ROOT, cache, 'complete.json'));
  const input = seal.artifacts.filter((a: any) => ['candles.f64', 'schema.json'].includes(a.file)).map((a: any) => ({ ...a, file: `${cache}/${a.file}` }));
  for (const p of input) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256);
  const files = [CARD, card.parentCard, 'scripts/range-low-sfp-early-study.ts', 'scripts/setup-detectors/sf01-range-low.ts', 'scripts/setup-chart.ts', ...fixed];
  const hashes = await Promise.all(files.map(async file => ({ file, sha256: await fileHash(path.join(ROOT, file)) })));
  const key = sha(JSON.stringify({ card, hashes, input, parent: parent.key })), dir = path.join(ROOT, 'backtests/range-low-sfp-early', key);
  if (fs.existsSync(path.join(dir, 'complete.json'))) {
    await verify(dir);
    for (const r of read(path.join(dir, 'comparison.json')).runs) {
      await verify(path.join(ROOT, 'backtests/setup-scans', r.scan)); await verify(path.join(ROOT, 'backtests/setup-replays', r.replay));
    }
    console.log(`[SF02] verified existing run; no replay or rewrite: ${dir}`); return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const manifest: any = { key, kind: 'sf02', card: CARD, resolvedCard: c, input, hashes, parent: parent.key, runs: [], baselineParity: [], subsetChecks: [], attribution: [] };
  for (const lag of c.sourceLagsMs) {
    const base = baseRuns.find((r: any) => r.lag === lag);
    const sd = path.join(ROOT, 'backtests/setup-scans', base.scan), rd = path.join(ROOT, 'backtests/setup-replays', base.replay);
    await verify(sd); await verify(rd);
    const plan = read(path.join(sd, 'plan.json')), events = eventsAt(sd);
    const { minutes } = await loadTape(ROOT, c.symbol, plan.tape.start, Date.parse(c.to), lag, 'sealed');
    const regenerated = detectRangeLowSfp(buildContext({ symbol: c.symbol, minutes, lagMs: lag,
      window: { start: Date.parse(c.from), end: Date.parse(c.to) }, params: plan.request.params }))
      .filter(e => e.knownAt >= Date.parse(c.from) && e.knownAt < Date.parse(c.to));
    assert.deepEqual(clean(regenerated), events, '4h default no longer matches archived events');
    const cfgBase = { riskMinPct: c.riskMinPct, riskMaxPct: c.riskMaxPct, stopBufferPct: 0, includeControls: false };
    for (const holdHours of card.holds) {
      const v = { side: 1 as const, target: 'r2', holdHours }, built = buildActions(regenerated, v, cfgBase);
      assert.deepEqual(clean(built), clean(buildActions(events, v, cfgBase)), 'archived baseline action parity');
      const archived = base.actions[`long__r2__hold${holdHours}h`];
      assert.equal(built.actions.length, archived.actions); assert.deepEqual(clean(built.rejected), archived.rejected); assert.deepEqual(clean(built.discarded), archived.discarded);
    }
    assert.deepEqual(base.results, read(path.join(rd, 'results.json')), 'archived totals differ');
    manifest.baselineParity.push({ lag, events: events.length, actionParity: true, enginePinsUnchanged: true, resultsIdentical: true });
    manifest.runs.push({ ...base, name: 'baseline_4h' });
    const scan = await runScan(ROOT, sf01RangeLow, { ...plan.request, params: { ...plan.request.params, ...card.candidate }, charts: false },
      ['scripts/setup-scan-core.ts', 'scripts/setup-detectors/sf01-range-low.ts', CARD, card.parentCard]);
    await verify(scan.dir); const earlyEvents = eventsAt(scan.dir);
    if (lag === 60000) await writeChart({ root: ROOT, scanDir: scan.dir, timeframes: parseTimeframes('4h,1h,15m'), rows: 'all', out: path.join(dir, 'range_sfp-scan.html') });
    const cfg: ReplayConfig = { scanKey: scan.key, sides: [1], targets: card.targets, holds: card.holds, delaysMs: c.delaysMs,
      notional: c.notional, equity: c.equity, fee: c.feePerSide, stressBpsPerSide: c.stressBpsPerSide, split: Date.parse(c.split), rows: { stage: 'confirmed' }, ...cfgBase };
    const replay = await runReplay(ROOT, cfg); await verify(replay.dir);
    const trades = parseCsv(fs.readFileSync(path.join(replay.dir, 'trades-long__r2__hold24h.csv'), 'utf8'));
    const candidate = { name: 'early_15m', lag, scan: scan.key, replay: replay.key, results: read(path.join(replay.dir, 'results.json')),
      monthly: read(path.join(replay.dir, 'monthly.json')), actions: read(path.join(replay.dir, 'actions.json')),
      eventReasons: earlyEvents.reduce((o: any, e) => { const k = `${e.stage}:${e.reason ?? 'confirmed'}`; o[k] = (o[k] ?? 0) + 1; return o; }, {}),
      firstTradeTrace: trades.length ? { event: earlyEvents.find(e => e.id === trades[0].id), trade: trades[0] } : null };
    manifest.runs.push(candidate);
    const a = new Map(events.filter(e => e.stage === 'confirmed').map(e => [e.id, e]));
    const b = new Map(earlyEvents.filter(e => e.stage === 'confirmed').map(e => [e.id, e]));
    const matched = [...b.values()].filter(e => a.has(e.id));
    manifest.attribution.push({ lag, type: 'signals', baseline: a.size, candidate: b.size, matched: matched.length,
      newSignals: [...b.keys()].filter(id => !a.has(id)).length, lostSignals: [...a.keys()].filter(id => !b.has(id)).length,
      earlier: matched.filter(e => e.knownAt < a.get(e.id)!.knownAt).length,
      later: matched.filter(e => e.knownAt > a.get(e.id)!.knownAt).length,
      medianAdvanceHours: median(matched.map(e => (a.get(e.id)!.knownAt - e.knownAt) / 3600000)),
      medianReferencePriceDeltaPct: median(matched.map(e => (e.proxies.entry! / a.get(e.id)!.proxies.entry! - 1) * 100)),
      sameHigh: matched.filter(e => e.stages.range.at === a.get(e.id)!.stages.range.at).length });
    for (const hold of card.holds) {
      const cell = `long__r2__hold${hold}h`, load = (d: string) => parseCsv(fs.readFileSync(path.join(d, `trades-${cell}.csv`), 'utf8'));
      const old = load(rd), next = load(replay.dir), am = new Map(old.map(t => [t.id, t])), bm = new Map(next.map(t => [t.id, t]));
      const common = next.filter(t => am.has(t.id)), removed = old.filter(t => !bm.has(t.id)), added = next.filter(t => !am.has(t.id));
      const sum = (xs: any[]) => xs.reduce((s, t) => s + Number(t.net), 0);
      const row = (r: any) => r.results.find((x: any) => x.cell === cell && x.window === 'full' && x.delay === 0 && !x.stress && !x.targetFirst);
      const ar = row(base), br = row(candidate), commonDelta = common.reduce((s, t) => s + Number(t.net) - Number(am.get(t.id)!.net), 0);
      const openDelta = br.openNet - ar.openNet;
      assert(Math.abs(commonDelta + sum(added) - sum(removed) + openDelta - (br.net - ar.net)) < 1e-7);
      manifest.attribution.push({ lag, cell, type: 'closed_trade_paths', common: common.length, commonDelta, added: added.length, addedNet: sum(added),
        removed: removed.length, removedNet: sum(removed), openDelta, totalDelta: br.net - ar.net,
        oldWinnerToLoss: common.filter(t => Number(am.get(t.id)!.net) > 0 && Number(t.net) < 0).length,
        oldLoserToWin: common.filter(t => Number(am.get(t.id)!.net) < 0 && Number(t.net) > 0).length,
        removedWinners: removed.filter(t => Number(t.net) > 0).length, removedWinningDollars: sum(removed.filter(t => Number(t.net) > 0)) });
    }
    if (lag === 60000) {
      await writeChart({ root: ROOT, scanDir: scan.dir, replayDir: replay.dir, timeframes: parseTimeframes('4h,1h,15m'), rows: 'all', out: path.join(dir, 'range_sfp-replay.html') });
      await writeChart({ root: ROOT, scanDir: sd, replayDir: rd, timeframes: parseTimeframes('4h,1h,15m'), rows: 'all', out: path.join(dir, 'swing_control-replay.html') });
    }
    console.log(`[SF02] lag${lag}: baseline parity passed; ${scan.confirmed} early signals; replay ${replay.key.slice(0, 12)}`);
  }
  atomicJson(path.join(dir, 'comparison.json'), manifest);
  const artifacts = await Promise.all(fs.readdirSync(dir).filter(f => f !== 'complete.json').map(async file => ({ file, sha256: await fileHash(path.join(dir, file)) })));
  atomicJson(path.join(dir, 'complete.json'), { key, artifacts });
  atomicJson(path.join(ROOT, 'backtests/range-low-sfp-early/latest.json'), { key, dir });
  console.log(`[SF02] complete ${dir}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
