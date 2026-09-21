/** SF03: reuse saved SF01 detections; vary only post-confirmation execution. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { ROOT, type SetupEvent } from './setup-scan-core';
import { buildActions, runReplay, type ReplayConfig } from './setup-replay';
import { parseCsv, parseTimeframes, writeChart } from './setup-chart';
const CARD = 'research-inputs/range-low-sfp-limit-sf03-2026-09-20.json';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const clean = (x: unknown) => JSON.parse(JSON.stringify(x));
const primary = (x: any) => x.window === 'full' && x.delay === 0 && !x.stress && !x.targetFirst;
async function verify(dir: string) { for (const a of read(path.join(dir, 'complete.json')).artifacts)
  assert.equal(await fileHash(path.join(dir, a.file)), a.sha256, `${dir}/${a.file}`); }
async function main() {
  const card = read(path.join(ROOT, CARD));
  assert.equal(await fileHash(path.join(ROOT, card.parentCard)), card.parentSha256);
  const c = read(path.join(ROOT, card.parentCard)), parentDir = path.join(ROOT, card.parentStudy);
  await verify(parentDir); const parent = read(path.join(parentDir, 'comparison.json'));
  const baseRuns = parent.runs.filter((r: any) => r.name === card.parentRun);
  const plan = read(path.join(ROOT, 'backtests/setup-scans', baseRuns[0].scan, 'plan.json'));
  const cache = path.dirname(plan.tape.file), seal = read(path.join(ROOT, cache, 'complete.json'));
  const input = seal.artifacts.filter((a: any) => ['candles.f64', 'schema.json'].includes(a.file)).map((a: any) => ({ ...a, file: `${cache}/${a.file}` }));
  for (const p of input) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256);
  const files = [CARD, card.parentCard, 'scripts/range-low-sfp-limit-study.ts', 'scripts/setup-scan-core.ts', 'scripts/setup-replay.ts',
    'scripts/poc-indicator-bias-engine.ts', 'scripts/structural-limit-entry.ts', 'scripts/structural-replay-audit.ts', 'scripts/setup-chart.ts'];
  const hashes = await Promise.all(files.map(async file => ({ file, sha256: await fileHash(path.join(ROOT, file)) })));
  const key = sha(JSON.stringify({ card, hashes, input, parent: parent.key })), dir = path.join(ROOT, 'backtests/range-low-sfp-limit', key);
  if (fs.existsSync(path.join(dir, 'complete.json'))) {
    await verify(dir); for (const r of read(path.join(dir, 'comparison.json')).runs) {
      await verify(path.join(ROOT, 'backtests/setup-scans', r.scan)); await verify(path.join(ROOT, 'backtests/setup-replays', r.replay));
    }
    console.log(`[SF03] verified existing run; no replay/rewrite: ${dir}`); return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const j: any = { key, kind: 'sf03', card: CARD, resolvedCard: c, input, hashes, parent: parent.key,
    runs: [], baselineParity: [], clockChecks: [], attribution: [], traces: [] };
  for (const lag of c.sourceLagsMs) {
    const old = baseRuns.find((r: any) => r.lag === lag), sd = path.join(ROOT, 'backtests/setup-scans', old.scan);
    const oldRd = path.join(ROOT, 'backtests/setup-replays', old.replay); await verify(sd); await verify(oldRd);
    const events: SetupEvent[] = fs.readFileSync(path.join(sd, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    for (const e of events.filter(e => e.stage === 'confirmed')) {
      assert(e.stages.level.knownAt <= e.stages.sweep.at && e.stages.range.knownAt <= e.stages.sweep.at);
      assert(e.stages.sweep.knownAt <= e.knownAt && e.stages.reclaim.knownAt === e.knownAt);
    }
    j.clockChecks.push({ lag, confirmed: events.filter(e => e.stage === 'confirmed').length, savedStageAvailability: true });
    const cfg: ReplayConfig = { scanKey: old.scan, sides: [1], targets: card.targets, holds: card.holds, delaysMs: c.delaysMs,
      notional: c.notional, equity: c.equity, fee: c.feePerSide, stressBpsPerSide: c.stressBpsPerSide,
      split: Date.parse(c.split), rows: { stage: 'confirmed' }, riskMinPct: c.riskMinPct, riskMaxPct: c.riskMaxPct,
      stopBufferPct: 0, includeControls: false };
    const base = await runReplay(ROOT, cfg); await verify(base.dir);
    const pack = (name: string, r: typeof base, extra = {}) => ({ name, lag, scan: old.scan, replay: r.key, ...extra,
      results: read(path.join(r.dir, 'results.json')), monthly: read(path.join(r.dir, 'monthly.json')), actions: read(path.join(r.dir, 'actions.json')) });
    const b = pack('market', base);
    assert.deepEqual(b.results, old.results.filter((x: any) => x.target === 'r2'), 'baseline results changed');
    assert.deepEqual(b.monthly, old.monthly.filter((x: any) => x.cell.includes('__r2__')), 'baseline monthly changed');
    for (const hold of card.holds) { const f = `trades-long__r2__hold${hold}h.csv`;
      assert.equal(await fileHash(path.join(base.dir, f)), await fileHash(path.join(oldRd, f)), 'baseline trade bytes changed'); }
    j.baselineParity.push({ lag, results: b.results.length, months: b.monthly.length, tradesByteIdentical: true }); j.runs.push(b);
    console.log(`[SF03] baseline lag${lag}: exact archived results/monthly/trade parity`);
    for (const offsetPct of card.offsetsPct) for (const model of card.fillModels) {
      const cc: ReplayConfig = { ...cfg, entryLimit: { offsetPct, expiryHours: card.entryExpiryHours, model } };
      for (const holdHours of card.holds) {
        const v = { side: 1 as const, target: 'r2', holdHours }, original = buildActions(events, v, cfg), limit = buildActions(events, v, cc);
        assert.deepEqual(clean(limit.actions.map(({ entry, ...a }) => a)), clean(original.actions), 'non-entry action changed');
        assert.deepEqual(limit.rejected, original.rejected); assert.deepEqual(limit.discarded, original.discarded);
      }
      const r = await runReplay(ROOT, cc); await verify(r.dir);
      const run = pack(`sweep_${offsetPct}_${model}`, r, { offsetPct, model }); j.runs.push(run);
      for (const hold of card.holds) {
        const cell = `long__r2__hold${hold}h`, load = (d: string) => parseCsv(fs.readFileSync(path.join(d, `trades-${cell}.csv`), 'utf8'));
        const a = load(base.dir), z = load(r.dir), am = new Map(a.map(t => [t.id, t])), zm = new Map(z.map(t => [t.id, t]));
        const common = z.filter(t => am.has(t.id)), removed = a.filter(t => !zm.has(t.id)), added = z.filter(t => !am.has(t.id));
        const sum = (xs: any[]) => xs.reduce((s, t) => s + Number(t.net), 0);
        const ar = b.results.find((x: any) => x.cell === cell && primary(x)), br = run.results.find((x: any) => x.cell === cell && primary(x));
        const commonDelta = common.reduce((s, t) => s + Number(t.net) - Number(am.get(t.id)!.net), 0), openDelta = br.openNet - ar.openNet;
        assert(Math.abs(commonDelta + sum(added) - sum(removed) + openDelta - br.net + ar.net) < 1e-7);
        const intents = read(path.join(r.dir, `intents-${cell}.json`)), im = new Map<string, any>(intents.map((i: any) => [i.id, i]));
        j.attribution.push({ lag, name: run.name, cell, common: common.length, commonDelta, added: added.length, addedNet: sum(added),
          removed: removed.length, removedNet: sum(removed), openDelta, totalDelta: br.net - ar.net,
          oldLoserToWin: common.filter(t => Number(am.get(t.id)!.net) < 0 && Number(t.net) > 0).length,
          oldWinnerToLoss: common.filter(t => Number(am.get(t.id)!.net) > 0 && Number(t.net) < 0).length,
          removedWinners: removed.filter(t => Number(t.net) > 0).length, removedWinningDollars: sum(removed.filter(t => Number(t.net) > 0)),
          removedLosingDollars: sum(removed.filter(t => Number(t.net) < 0)),
          removedByReason: removed.map(t => ({ id: t.id, baselineNet: Number(t.net), reason: im.get(String(t.id))?.phase ?? 'occupied', intent: im.get(String(t.id)) ?? null })),
          tradePairs: common.map(t => ({ id: t.id, baselineNet: Number(am.get(t.id)!.net), candidateNet: Number(t.net),
            baselineEntry: Number(am.get(t.id)!.entryPrice), candidateEntry: Number(t.entryPrice), candidateReason: t.reason })) });
        if (lag === 60000 && hold === 24) j.traces.push({ name: run.name, event: events.find(e => e.id === z[0]?.id),
          intent: intents.find((i: any) => i.id === z[0]?.id), trade: z[0] ?? null });
      }
      if (lag === 60000 && model === 'touch') await writeChart({ root: ROOT, scanDir: sd, replayDir: r.dir,
        timeframes: parseTimeframes('4h,1h'), rows: 'all', out: path.join(dir, `sweep-${offsetPct}-replay.html`) });
      console.log(`[SF03] offset${offsetPct}/${model}/lag${lag}: complete ${r.key.slice(0, 12)}`);
    }
  }
  atomicJson(path.join(dir, 'comparison.json'), j);
  const artifacts = await Promise.all(fs.readdirSync(dir).filter(f => f !== 'complete.json').map(async file => ({ file, sha256: await fileHash(path.join(dir, file)) })));
  atomicJson(path.join(dir, 'complete.json'), { key, artifacts }); atomicJson(path.join(ROOT, 'backtests/range-low-sfp-limit/latest.json'), { key, dir });
  console.log(`[SF03] complete ${dir}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
