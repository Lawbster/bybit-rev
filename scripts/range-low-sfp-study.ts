/** Thin frozen SF01 driver. Reuses scanning, execution, audit and rendering. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { ROOT, runScan, type SetupEvent } from './setup-scan-core';
import { sf01RangeLow } from './setup-detectors/sf01-range-low';
import { runReplay, type ReplayConfig } from './setup-replay';
import { parseTimeframes, writeChart, parseCsv } from './setup-chart';

const CARD = 'research-inputs/range-low-sfp-sf01-2026-09-20.json';
const TRANSFER = 'research-inputs/range-low-sfp-sf01-transfer-2026-09-20.json';
const CACHE = 'backtests/level-atlas/9b0da93e74fd42af858d38c1f859bfd8ae21e9963eda0b1a0d05135e8fe6cc8a';
const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pins = ['scripts/range-low-sfp-study.ts', 'scripts/setup-detectors/sf01-range-low.ts',
  'scripts/setup-scan-core.ts', 'scripts/setup-replay.ts', 'scripts/poc-indicator-bias-engine.ts',
  'scripts/structural-replay-audit.ts', 'scripts/setup-chart.ts', CARD];
async function verify(dir: string) {
  const receipt = read(path.join(dir, 'complete.json'));
  for (const x of receipt.artifacts) assert.equal(await fileHash(path.join(dir, x.file)), x.sha256, `hash changed: ${dir}/${x.file}`);
}
async function main() {
  const parent = read(path.join(ROOT, CARD));
  const symbolAt = process.argv.indexOf('--symbol');
  const symbol = symbolAt < 0 ? parent.symbol : process.argv[symbolAt + 1];
  const c = { ...parent, symbol };
  const tape = symbol === parent.symbol ? 'sealed' : 'research';
  const input: { file: string; sha256: string }[] = [];
  const sourcePins = [...pins];
  if (tape === 'research') {
    const transfer = read(path.join(ROOT, TRANSFER));
    assert(transfer.symbols.includes(symbol), `unsupported SF01 transfer symbol: ${symbol}`);
    assert.equal(transfer.parentCard, CARD);
    assert.equal(await fileHash(path.join(ROOT, CARD)), transfer.parentSha256, 'frozen transfer parent changed');
    sourcePins.push(TRANSFER);
    const file = `backtests/tapes/${symbol}_1m.jsonl`;
    const manifestFile = file.replace(/\.jsonl$/, '.manifest.json');
    const saved = read(path.join(ROOT, manifestFile));
    const hash = await fileHash(path.join(ROOT, file));
    assert.equal(hash, saved.sha256, `research tape differs from manifest: ${symbol}`);
    input.push({ file, sha256: hash }, { file: manifestFile, sha256: await fileHash(path.join(ROOT, manifestFile)) });
  } else {
    const seal = read(path.join(ROOT, CACHE, 'complete.json'));
    for (const f of ['candles.f64', 'schema.json']) {
      const x = seal.artifacts.find((a: any) => a.file === f); assert(x, `missing seal ${f}`);
      assert.equal(await fileHash(path.join(ROOT, CACHE, f)), x.sha256, `sealed tape changed ${f}`);
      input.push({ file: `${CACHE}/${f}`, sha256: x.sha256 });
    }
  }
  assert.equal(await fileHash(path.join(ROOT, c.source)), c.sourceSha256, 'source image changed');
  const hashes = await Promise.all(sourcePins.map(async file => ({ file, sha256: await fileHash(path.join(ROOT, file)) })));
  const key = sha(JSON.stringify({ card: c, hashes, input }));
  const dir = path.join(ROOT, 'backtests/range-low-sfp', key); fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(dir, 'complete.json'))) {
    await verify(dir);
    const saved = read(path.join(dir, 'comparison.json'));
    for (const run of saved.runs) {
      await verify(path.join(ROOT, 'backtests/setup-scans', run.scan));
      await verify(path.join(ROOT, 'backtests/setup-replays', run.replay));
    }
    console.log(`[SF01] verified existing complete run; no rewrite or replay: ${dir}`); return;
  }
  const manifest: any = { key, card: CARD, resolvedCard: c, input, tape, hashes, runs: [], subsetChecks: [], generatedAt: Date.now(), notes: c.limitations };
  const scans: any[] = [];
  for (const lag of c.sourceLagsMs) {
    const pair: any[] = [];
    for (const cell of c.cells) {
      const scan = await runScan(ROOT, sf01RangeLow, { setup: 'SF01', symbol: c.symbol, from: Date.parse(c.from), to: Date.parse(c.to),
        lagMs: lag, tape, params: { ...c.detector, requireRange: cell.requireRange }, charts: false, maxChartEvents: 12 },
        ['scripts/setup-scan-core.ts', 'scripts/setup-detectors/sf01-range-low.ts', CARD]);
      await verify(scan.dir);
      const identity = read(path.join(scan.dir, 'plan.json')).tape;
      assert.equal(identity.sha256, input[0].sha256, 'scan used a different input tape');
      assert(identity.start <= Date.parse(c.from) && identity.end >= Date.parse(c.to), 'tape does not cover study window');
      assert.equal(identity.gaps.length, 0, 'SF01 transfer requires the saved contiguous tape');
      assert.equal(identity.conflicts, 0, 'conflicting minute rows');
      const events: SetupEvent[] = fs.readFileSync(path.join(scan.dir, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      pair.push({ cell, scan, events, lag }); scans.push(pair.at(-1));
      console.log(`[SF01] ${lag}ms ${cell.name}: ${scan.confirmed}/${scan.events} confirmed; ${scan.reused ? 'reused' : 'scanned'} ${scan.key.slice(0, 12)}`);
      if (lag === c.sourceLagsMs[0]) await writeChart({ root: ROOT, scanDir: scan.dir, timeframes: parseTimeframes('4h,1h'), rows: 'all', out: path.join(dir, `${cell.name}-scan.html`) });
    }
    const a = new Map<string, SetupEvent>(pair[0].events.map((e: SetupEvent) => [e.id, e]));
    for (const b of pair[1].events.filter((e: SetupEvent) => e.stage === 'confirmed')) assert.deepEqual(b, a.get(b.id), `candidate not identical baseline event ${b.id}`);
    manifest.subsetChecks.push({ lag, passed: true, baseline: pair[0].scan.confirmed, candidate: pair[1].scan.confirmed });
  }
  atomicJson(path.join(dir, 'scans.json'), { ...manifest, scans: scans.map(s => ({ name: s.cell.name, lag: s.lag, key: s.scan.key })) });
  if (process.argv.includes('--scan-only')) { console.log(`[SF01] charts before economics: ${dir}`); return; }
  for (const { cell, scan, events, lag } of scans) {
    const cfg: ReplayConfig = { scanKey: scan.key, sides: [1], targets: cell.targets, holds: cell.holds, delaysMs: c.delaysMs,
      notional: c.notional, equity: c.equity, fee: c.feePerSide, stressBpsPerSide: c.stressBpsPerSide,
      riskMinPct: c.riskMinPct, riskMaxPct: c.riskMaxPct, stopBufferPct: 0, includeControls: false, split: Date.parse(c.split), rows: { stage: 'confirmed' } };
    const replay = await runReplay(ROOT, cfg); await verify(replay.dir);
    if (lag === c.sourceLagsMs[0]) await writeChart({ root: ROOT, scanDir: scan.dir, replayDir: replay.dir,
      timeframes: parseTimeframes('4h,1h'), rows: 'all', out: path.join(dir, `${cell.name}-replay.html`) });
    const trades = parseCsv(fs.readFileSync(path.join(replay.dir, 'trades-long__r2__hold24h.csv'), 'utf8'));
    const first = trades[0];
    manifest.runs.push({ name: cell.name, lag, scan: scan.key, replay: replay.key, results: read(path.join(replay.dir, 'results.json')),
      monthly: read(path.join(replay.dir, 'monthly.json')), actions: read(path.join(replay.dir, 'actions.json')),
      eventReasons: events.reduce((o: any, e: SetupEvent) => { const k = `${e.stage}:${e.reason ?? 'confirmed'}`; o[k] = (o[k] ?? 0) + 1; return o; }, {}),
      firstTradeTrace: first ? { event: events.find((e: SetupEvent) => e.id === first.id), trade: first } : null });
    console.log(`[SF01] replay ${cell.name} lag${lag}: ${replay.key.slice(0, 12)} audit+hashes passed`);
  }
  atomicJson(path.join(dir, 'comparison.json'), manifest);
  const primary = (r: any) => r.delay === 0 && !r.targetFirst && !r.stress;
  const comparisons: any[] = [], monthlies: any[] = [];
  for (const lag of c.sourceLagsMs) {
    const a = manifest.runs.find((r: any) => r.lag === lag && r.name === 'swing_control');
    const b = manifest.runs.find((r: any) => r.lag === lag && r.name === 'range_sfp');
    for (const r of b.results.filter((r: any) => primary(r) && r.target === 'r2')) {
      const base = a.results.find((x: any) => primary(x) && x.cell === r.cell && x.window === r.window);
      comparisons.push({ lag, cell: r.cell, window: r.window, baseline: base, candidate: r, netDelta: r.net - base.net, ddDelta: r.maxAdverseDrawdownPct - base.maxAdverseDrawdownPct });
    }
    for (const r of b.monthly.filter((r: any) => primary(r) && r.window === 'full' && r.cell.includes('__r2__'))) {
      const base = a.monthly.find((x: any) => primary(x) && x.cell === r.cell && x.window === 'full' && x.month === r.month);
      assert(base, `missing baseline month ${r.month}`);
      monthlies.push({ lag, cell: r.cell, month: r.month, baseline: base, candidate: r, netDelta: r.markedNet - base.markedNet });
    }
  }
  atomicJson(path.join(dir, 'primary-comparisons.json'), { comparisons, monthlies });
  const artifacts = await Promise.all(fs.readdirSync(dir).filter(f => f !== 'complete.json').map(async file => ({ file, sha256: await fileHash(path.join(dir, file)) })));
  atomicJson(path.join(dir, 'complete.json'), { key, artifacts });
  atomicJson(path.join(ROOT, `backtests/range-low-sfp/latest-${symbol}.json`), { key, dir });
  if (symbol === parent.symbol) atomicJson(path.join(ROOT, 'backtests/range-low-sfp/latest.json'), { key, dir });
  console.log(`[SF01] complete: ${dir}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
