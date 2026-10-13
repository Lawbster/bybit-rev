/** Restart regression; no exchange calls, orders, or strategy economics. */
import assert from 'assert/strict';
import fs from 'fs';
import { createHash } from 'crypto';
import { PortfolioCandleFeed } from '../src/bot/portfolio/candle-feed';
import { StructuralSignalMap, STRUCTURAL_SEED as START, type StructuralMinute } from '../src/bot/portfolio/structural-signals';
import { PortfolioSourceCache } from '../src/bot/portfolio/source-cache';
import { loadPortfolioBootstrap } from '../src/bot/portfolio/feed-loader';
import { MINUTE as M } from '../src/bot/portfolio/contract';

const TF = 240 * M, base = Math.ceil(START / TF) * TF;
type Spec = [number, number, number, number];
const flat = (p: number): Spec => [p, p + .2, p - .2, p];
// Same sweep/reclaim geometry as the existing SF01 regression, aligned to the
// fixed structural seed. Its first partial 4h bucket is deliberately discarded.
const specs: Spec[] = [flat(105), flat(104), flat(102), [102, 103, 100, 101], flat(103), flat(105),
  flat(108), [108, 112, 107, 110], flat(109), flat(107), flat(106), flat(105), [105, 106, 99, 101]];
const at = base + specs.length * TF + M, restart = base + 11 * TF + 2000;
const feed = new PortfolioCandleFeed();
for (let ts = START; ts < at - M; ts += M) {
  const n = Math.floor((ts - base) / TF), m = (ts - base) / M % 240;
  const [o, h, l, c] = n < 0 ? flat(106) : specs[n];
  const close = m === 239 ? c : o;
  const candle = { timestamp: ts, open: o, close, high: m === 60 ? h : Math.max(o, close),
    low: m === 120 ? l : Math.min(o, close), volume: 1, turnover: 100 };
  if (ts < START + 5 * M) feed.seed(candle);
  else {
    if (feed.bootstrapAt === null) feed.ready(restart);
    feed.ingest(candle, ts + M + 10, Math.max(restart, ts + M + 20));
  }
}
const minutes = feed.structuralMinutes();
const nominal = new StructuralSignalMap(minutes.map(c => ({ ...c, availableAt: c.publishedAt! })), at);
const fixed = new StructuralSignalMap(minutes, at), decision = fixed.decision('SF08', at);
assert.equal(decision.status, 'signal');
assert.deepEqual(decision, nominal.decision('SF08', at));
assert.equal(new StructuralSignalMap(minutes.map(({ publishedAt, ...c }) => c), at).decision('SF08', at).status,
  'no_signal', 'old single-clock behavior must reproduce the miss');
assert.equal(fixed.decision('SF08', at + M).status, 'outside_entry_window');
assert.equal(fixed.decision('SF08', at + TF).status, 'inputs_unavailable');

const lateWorker = minutes.map((c, i) => i === minutes.length - 1 ? { ...c, availableAt: at + 1 } : c);
assert.equal(new StructuralSignalMap(lateWorker, at).decision('SF08', at).status, 'missing_bar');
assert.equal(new StructuralSignalMap(lateWorker, at + 1).decision('SF08', at + 1).status, 'inputs_unavailable');
const lateRepair = minutes.map(c => c.ts === base + 10 * TF - M
  ? { ...c, publishedAt: base + 10 * TF + M + 1 } : c);
assert.equal(new StructuralSignalMap(lateRepair, at).decision('SF08', at).status, 'no_signal');
assert.throws(() => new StructuralSignalMap(minutes.map((c, i) => i ? c : { ...c, publishedAt: c.availableAt + 1 }), at), /publication clock/);
const afterDeadline = minutes.map(c => ({ ...c, availableAt: Math.max(c.availableAt, at + 1) }));
assert.equal(new StructuralSignalMap(afterDeadline, at + 1).decision('SF08', at + 1).status, 'inputs_unavailable');
assert.equal(new StructuralSignalMap(afterDeadline, at + TF).decision('SF08', at + TF).status, 'missing_bar');
assert.deepEqual(new StructuralSignalMap([...minutes, { ...minutes[0], close: NaN, availableAt: at + 1 }], at).rows, fixed.rows);
assert.deepEqual(new StructuralSignalMap(JSON.parse(JSON.stringify(minutes)), at).rows, fixed.rows);
console.log('Structural restart tests passed: original publication, observation cutoff, genuine late repair, no catch-up entry, future exclusion.');

/** Optional frozen real incident proof. Reuses the saved seed/tail, never downloads
 * candles or alters the old audit. Historical decisions remain unavailable live. */
async function realIncident(dir: string) {
  const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const hash = (f: string) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const seedDir = 'backtests/portfolio-feed-bootstrap/88cd5182ee20dd09';
  const seed = seedDir + '/hype-warmup.jsonl.gz', proof = 'backtests/portfolio-sfp-restart-probe/46c1e7c08681d2f8/report.json';
  const incident = read(proof), tailFile = dir + '/extension-candles.json';
  const f = await loadPortfolioBootstrap(seed, read(seedDir + '/complete.json').sha256, () => incident.restartAt);
  for (const c of read(tailFile).filter((m: StructuralMinute) => m.availableAt <= incident.at))
    f.ingest({ timestamp: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover },
      c.availableAt, Math.max(c.availableAt, incident.restartAt));
  const ms = f.structuralMinutes();
  assert(ms.at(-1)!.endTs <= incident.at, 'no outcome candles');
  const old = new StructuralSignalMap(ms.map(({ publishedAt, ...c }) => c), incident.at).decision('SF08', incident.at);
  assert.equal(old.status, 'no_signal');
  const map = new StructuralSignalMap(ms, incident.at), restored = map.decision('SF08', incident.at);
  assert.deepEqual(restored, incident.cases[0].decision);
  const postBoot = map.rows.filter(r => r.at >= incident.restartAt);
  const nominal = new StructuralSignalMap(ms.map(c => ({ ...c, availableAt: c.publishedAt! })), incident.at);
  assert.deepEqual(postBoot, nominal.rows.filter(r => r.at >= incident.restartAt), 'post-restart SF08/PA07 publications');
  const live = new PortfolioSourceCache(f).read(incident.at);
  assert.equal(live.health.policyError, null);
  assert.deepEqual(live.poll.sources.find(s => s.source === 'SF08')?.signal,
    restored.status === 'signal' ? restored.signal : undefined, 'production cache must expose the restored signal');
  const sourceFiles = ['src/bot/portfolio/candle-feed.ts', 'src/bot/portfolio/structural-signals.ts',
    'src/bot/portfolio/source-cache.ts', 'scripts/portfolio-structural-restart-tests.ts', proof, tailFile, seed];
  const pins = Object.fromEntries(sourceFiles.map(f => [f, hash(f)]));
  const result = { passed: true, exchangeCalls: 0, signalId: incident.signalId, at: incident.at,
    restartAt: incident.restartAt, prefixEnds: ms.at(-1)!.endTs, oldStatus: old.status, restored,
    productionCacheStatus: live.poll.sources.find(s => s.source === 'SF08')?.status,
    postRestartPublications: postBoot.length, pins };
  const key = createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0, 16);
  const out = 'backtests/portfolio-sfp-restart-fix/' + key;
  fs.mkdirSync(out, { recursive: true });
  if (!fs.existsSync(out + '/verification.json')) fs.writeFileSync(out + '/verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ out, passed: true, oldStatus: old.status, restoredStatus: restored.status,
    productionCacheStatus: result.productionCacheStatus, postRestartPublications: postBoot.length, exchangeCalls: 0 }));
}
if (process.argv[2]) void realIncident(process.argv[2]).catch(e => { console.error(e); process.exitCode = 1; });
