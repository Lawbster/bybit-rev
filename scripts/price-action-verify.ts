/** Independent PA07 source/sequence checks. Prefix reruns supplement, not replace these checks. */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import assert from 'assert/strict';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles } from './level-playbook-study';
import { aggregate, type Action, type Row, M, H } from './poc-indicator-bias-engine';
import { buildPriceActionSignals } from './price-action-signals';
import { renderAtlasEventSvg } from '../src/research/event-atlas-render';
import type { AtlasEventFeatures, EventAtlasManifest } from '../src/research/event-atlas-types';
import type { Candle } from './hype-freerun-canonical-replay';
const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, p), 'utf8'));
const gz = (p: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(ROOT, p))).toString());
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-9 + Math.abs(b) * 1e-10, `${a} != ${b}`);
const normalize = (x: any) => JSON.parse(JSON.stringify(x));
async function checkSeal(dir: string) {
  const seal = read(dir + '/complete.json');
  for (const item of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, item.file)), item.sha256, item.file);
  return seal;
}
export function auditPriceActionSources(cs: readonly Candle[], c: Row, lag: number, built: Row) {
  const base = cs[0].ts, end = cs.at(-1)!.endTs;
  const minute = (at: number) => { const b = cs[(at - base) / M]; assert(b && b.ts === at); return b; };
  const bar = (at: number, tf = H) => {
    const rows = cs.slice((at - base) / M, (at + tf - base) / M); assert.equal(rows.length, tf / M);
    assert(rows[0].ts === at && rows.at(-1)!.endTs === at + tf);
    return { timestamp: at, open: rows[0].open, close: rows.at(-1)!.close,
      high: Math.max(...rows.map(x => x.high)), low: Math.min(...rows.map(x => x.low)),
      volume: rows.reduce((v, x) => v + x.volume, 0), turnover: rows.reduce((v, x) => v + x.turnover, 0) };
  };
  const checkBar = (b: Row, tf = H) => { const actual = bar(b.timestamp, tf);
    for (const k of ['open', 'high', 'low', 'close', 'volume', 'turnover']) near(b[k], (actual as Row)[k]); return actual; };
  const touched = (price: number, direction: number, from: number, until: number) => {
    for (let at = Math.max(base, Math.ceil(from / M) * M); at < Math.min(until, end); at += M)
      if (direction === 1 ? minute(at).high >= price : minute(at).low <= price) return true;
    return false;
  };
  const checkedPivots = new Set<string>();
  const checkPivot = (p: Row, tf: number) => {
    assert.equal(p.confirmationEnd, p.pivotAt + (c.pivotWidth + 1) * tf);
    assert.equal(p.availableAt, p.confirmationEnd + lag);
    if (checkedPivots.has(p.id)) return;
    const b = bar(p.pivotAt, tf); near(p.price, p.kind === 'high' ? b.high : b.low);
    for (let d = -c.pivotWidth; d <= c.pivotWidth; d++) if (d) {
      const n = bar(p.pivotAt + d * tf, tf); assert(p.kind === 'high' ? p.price > n.high : p.price < n.low);
    }
    checkedPivots.add(p.id);
  };
  // Independent full pivot inventory: validates missing as well as extra pivots.
  const pivotTape: Row[] = [];
  for (const tf of [H, 4 * H]) {
    const bars = aggregate(cs, tf);
    for (let i = c.pivotWidth; i + c.pivotWidth < bars.length; i++) for (const kind of ['high', 'low']) {
      const price = (bars[i] as Row)[kind]; let qualifies = true;
      for (let j = i - c.pivotWidth; j <= i + c.pivotWidth; j++) if (j !== i)
        qualifies &&= kind === 'high' ? price > bars[j].high : price < bars[j].low;
      if (qualifies) pivotTape.push({ timeframe: tf, kind, price, pivotAt: bars[i].timestamp,
        confirmationEnd: bars[i + c.pivotWidth].timestamp + tf, availableAt: bars[i + c.pivotWidth].timestamp + tf + lag });
    }
  }
  const pivotKey = (p: Row) => `${p.timeframe}:${p.kind}:${p.pivotAt}:${p.price}:${p.availableAt}`;
  assert.deepEqual(pivotTape.map(pivotKey).sort(), built.pivots.map(pivotKey).sort(), 'Complete pivot inventory');
  const latest = (tf: number, kind: string, at: number, age = Infinity) => pivotTape.filter(p => p.timeframe === tf && p.kind === kind
    && p.availableAt <= at && p.pivotAt >= at - age).sort((a, b) => b.availableAt - a.availableAt)[0];
  let checked = 0, waitHours = 0;
  const all = Object.entries(built.signals) as [string, Action[]][];
  for (const [mechanism, actions] of all) {
    const seen = new Set<string>();
    for (const s of actions) {
      const e = s.evidence!, side = s.side, b = checkBar(e.sweepBar ?? e.breakBar), prior = checkBar(e.priorBar);
      const ref = e.reference, target = e.targetPivot, sweep = mechanism.startsWith('sweep');
      assert.equal(prior.timestamp, b.timestamp - H);
      assert.equal(s.at, e.confirmationEnd + lag); assert.equal(e.availableAt, s.at);
      assert.equal(e.formationAt, b.timestamp); assert(ref.availableAt <= b.timestamp && target.availableAt <= b.timestamp);
      checkPivot(ref, sweep ? 4 * H : H); checkPivot(target, 4 * H);
      assert.equal(pivotKey(ref), pivotKey(latest(sweep ? 4 * H : H, ref.kind, b.timestamp, sweep ? c.levelMaxAgeHours * H : Infinity)));
      assert.equal(pivotKey(target), pivotKey(latest(4 * H, target.kind, b.timestamp, c.levelMaxAgeHours * H)));
      assert(target.pivotAt >= b.timestamp - c.levelMaxAgeHours * H);
      assert.equal(target.kind, side === 1 ? 'high' : 'low'); near(s.target!, target.price);
      assert(!touched(target.price, side, target.availableAt, e.confirmationEnd), 'Consumed target');
      const uniqueness = `${side}:${s.at}`; assert(!seen.has(uniqueness)); seen.add(uniqueness);
      let initialStop: number;
      if (sweep) {
        assert(ref.pivotAt >= b.timestamp - c.levelMaxAgeHours * H);
        assert(!touched(ref.price, -side, ref.availableAt, b.timestamp), 'Swept reference was already touched');
        assert(side * (prior.close - ref.price) > 0 && side * (b.close - ref.price) > 0);
        assert(side === 1 ? b.low <= ref.price * (1 - c.breakBufferPct / 100) : b.high >= ref.price * (1 + c.breakBufferPct / 100));
        const lo = side === 1 ? ref.price : target.price, hi = side === 1 ? target.price : ref.price;
        const location = (b.close - lo) / (hi - lo); near(e.rangeLocation, location);
        assert(side === 1 ? location <= c.discountMax : location >= c.premiumMin);
        initialStop = side === 1 ? b.low * (1 - c.stopBufferPct / 100) : b.high * (1 + c.stopBufferPct / 100);
      } else {
        assert(side * (prior.close - ref.price) <= 0);
        assert(side * (b.close / ref.price - 1) >= c.breakBufferPct / 100 - 1e-12);
        const origin = checkBar(e.originZone.source); near(e.originZone.low, origin.low); near(e.originZone.high, origin.high);
        assert(origin.timestamp >= Math.max(ref.pivotAt, b.timestamp - c.originLookbackBars * H) && origin.timestamp < b.timestamp);
        assert(side * (origin.close - origin.open) < 0);
        for (let at = origin.timestamp + H; at < b.timestamp; at += H) {
          const later = bar(at); assert(side * (later.close - later.open) >= 0, 'Origin not last opposite candle');
        }
        assert(side === 1 ? b.close > origin.high : b.close < origin.low);
        initialStop = side === 1 ? origin.low * (1 - c.stopBufferPct / 100) : origin.high * (1 + c.stopBufferPct / 100);
      }
      near(s.stop!, initialStop);
      const final = e.impulseBar ?? e.retestBar ?? b;
      checkBar(final); near(e.signalClose, final.close); assert.equal(e.confirmationEnd, final.timestamp + H);
      if (mechanism === 'sweep_impulse' || mechanism === 'origin_retest') {
        assert(final.timestamp >= b.timestamp + H + lag);
        const expiry = b.timestamp + H + (mechanism === 'sweep_impulse' ? c.impulseExpiryHours : c.retestExpiryHours) * H;
        assert(e.confirmationEnd <= expiry);
        assert(!touched(initialStop, -side, b.timestamp + H, e.confirmationEnd), 'Waiting thesis stop touched');
        for (let at = b.timestamp + H; at <= final.timestamp; at += H) {
          waitHours++; const x = bar(at);
          if (mechanism === 'origin_retest') {
            const z = e.originZone, overlap = x.high >= z.low && x.low <= z.high;
            if (at < final.timestamp) assert(!overlap, 'Retest not first return');
            else assert(overlap && (side === 1 ? x.close > z.high : x.close < z.low));
          } else {
            let total = 0;
            for (let j = c.impulseAtrBars; j >= 1; j--) { const y = bar(at - j * H), previous = bar(at - (j + 1) * H);
              total += Math.max(y.high - y.low, Math.abs(y.high - previous.close), Math.abs(y.low - previous.close)); }
            const atr = total / c.impulseAtrBars;
            const eligible = at >= b.timestamp + H + lag && side * (x.close - x.open) > 0 && x.high > x.low
              && Math.abs(x.close - x.open) / (x.high - x.low) >= c.impulseBodyFraction && x.high - x.low >= atr * c.impulseAtrMultiple;
            if (at < final.timestamp) assert(!eligible, 'Skipped earlier impulse'); else { assert(eligible); near(e.impulseAtr, atr); }
          }
        }
      }
      checked++;
    }
  }
  return { checkedSignals: checked, checkedPivots: checkedPivots.size, waitHours };
}
function writeAtlas(dir: string, c: Row, built: Row) {
  const chartDir = path.resolve(ROOT, dir, 'predecision-atlas'); fs.mkdirSync(chartDir, { recursive: true });
  const manifest: EventAtlasManifest = { version: 1, id: 'PA07', symbol: c.asset, title: 'PA07 chronological predecision examples',
    candleSource: { path: c.cache, intervalMinutes: 1 }, events: [], chart: { beforeHours: 96, afterHours: 0, primaryIntervalMinutes: 60, secondaryIntervalMinutes: 240 } };
  const samples: Row[] = [];
  for (const [mechanism, actions] of Object.entries(built.signals) as [string, Action[]][])
    for (const side of [1, -1]) for (const s of actions.filter(s => s.side === side).slice(0, 2)) samples.push({ mechanism, s });
  let html = '<!doctype html><meta charset="utf-8"><title>PA07 predecision atlas</title><style>body{background:#10141e;color:#ddd;font:15px system-ui;max-width:1260px;margin:auto}img{width:100%}pre{white-space:pre-wrap}</style><h1>PA07 predecision atlas</h1><p>First two chronological signals per mechanism/side. No future candles or PnL selected. Dashed levels: reference, target, stop and origin boundaries.</p>';
  for (let i = 0; i < samples.length; i++) {
    const { mechanism, s } = samples[i], e = s.evidence, time = s.at, id = `example-${i}`;
    const features: AtlasEventFeatures = Object.fromEntries(['return4hPct', 'return12hPct', 'return24hPct', 'return72hPct', 'ema50_4h', 'ema200_4h', 'ema200DistPct', 'realizedVol24hPct', 'range24hPct', 'nearestResistance', 'resistanceDistPct', 'nearestSupport', 'supportDistPct', 'forwardLow12hPct', 'forwardHigh12hPct', 'forwardClose12hPct', 'forwardLow24hPct', 'forwardHigh24hPct', 'forwardClose24hPct'].map(k => [k, null])) as unknown as AtlasEventFeatures;
    features.timestamp = time; features.price = e.signalClose;
    const prices = [e.reference.price, s.stop, s.target, ...(e.originZone ? [e.originZone.low, e.originZone.high] : [])];
    const zones = [...new Set<number>(prices)].map(price => ({ price, touches: 1, highTouches: 0, lowTouches: 0,
      confirmTs: e.reference.availableAt, side: (price > e.signalClose ? 'resistance' : 'support') as 'resistance' | 'support' }));
    const svg = renderAtlasEventSvg({ manifest, event: { id, timestamp: time, inputAt: time,
      label: `${mechanism} ${s.side === 1 ? 'long' : 'short'}`, tags: ['predecision-only'], note: 'No forward outcome' }, features,
      primaryCandles: built.bars1h.filter((b: Row) => b.timestamp >= time - 96 * H && b.timestamp + H + c.sourceLagsMs[0] <= time),
      secondaryCandles: built.bars4h.filter((b: Row) => b.timestamp >= time - 96 * H && b.timestamp + 4 * H + c.sourceLagsMs[0] <= time),
      zones, panels: [], markers: [{ timestamp: e.formationAt, sourceId: 'formation', sourceLabel: 'Formation', kind: 'formation', label: 'Formation', color: '#ffcc66' }] });
    fs.writeFileSync(path.join(chartDir, `${id}.svg`), svg);
    html += `<h2>${mechanism} / ${s.side === 1 ? 'long' : 'short'} / ${new Date(time).toISOString()}</h2><p>Reference ${e.reference.price}; stop ${s.stop}; structural target ${s.target}; signal close ${e.signalClose}</p><img src="${id}.svg">`;
  }
  fs.writeFileSync(path.join(chartDir, 'index.html'), html); return samples.length;
}
async function main() {
  const mapArg = process.argv.indexOf('--map'), jobArg = process.argv.indexOf('--job');
  const locator = mapArg < 0 ? read('backtests/price-action/latest.json') : null;
  const job = jobArg >= 0 ? process.argv[jobArg + 1] : locator?.directory;
  const dir = mapArg >= 0 ? process.argv[mapArg + 1] : read(job + '/plan.json').map;
  const plan = read(dir + '/plan.json'), c = plan.card; await checkSeal(dir);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  const cs = cachedCandles(c.cache), checks: Row[] = [];
  for (const lag of c.sourceLagsMs) {
    const built = gz(dir + `/events-${lag}.json.gz`); checks.push({ lag, ...auditPriceActionSources(cs, c, lag, built) });
    // Non-empty historical prefixes at fixed calendar cutoffs, selected before economics.
    for (const date of ['2025-01-01T00:00:00Z', '2026-06-01T00:00:00Z', '2026-08-01T00:00:00Z']) {
      const cutoff = Date.parse(date), prefix = cs.filter(x => x.endTs <= cutoff), rebuilt = buildPriceActionSignals(prefix, c, lag);
      let count = 0;
      for (const key of c.mechanisms) {
        const a = built.signals[key].filter((s: Action) => s.at <= cutoff), b = (rebuilt.signals as Record<string, Action[]>)[key].filter((s: Action) => s.at <= cutoff);
        assert.deepEqual(normalize(a), normalize(b), `prefix ${date}/${lag}/${key}`); count += a.length;
      }
      assert(count > 0); checks.push({ lag, prefix: date, prefixSignals: count });
    }
  }
  const examples = writeAtlas(dir, c, gz(dir + `/events-${c.sourceLagsMs[0]}.json.gz`));
  const receipt = { passed: true, key: plan.key, checkedAt: Date.now(), checks, examples,
    scope: 'Independent emitted-signal source/sequence reconstruction, non-empty prefix invariance. Synthetic future-poison tests separate. No economics in atlas.' };
  atomicJson(path.resolve(ROOT, dir, 'source-verification.json'), receipt);
  if (job) {
    const seal = await checkSeal(job), p = read(job + '/plan.json');
    for (const pin of [...p.pins, ...p.protectedPins]) assert.equal(await fileHash(path.resolve(ROOT, pin.file)), pin.sha256, pin.file);
    const executions = read(job + '/receipt-verification.json'); assert(executions.passed);
    atomicJson(path.resolve(ROOT, job, 'independent-verification.json'), { ...receipt, key: p.key, mapKey: plan.key,
      paths: executions.paths, outputSealSha256: await fileHash(path.resolve(ROOT, job, 'complete.json')),
      receipts: executions.audits.reduce((n: number, a: Row) => n + a.receipts, 0), artifacts: seal.artifacts.length });
    atomicJson(path.resolve(ROOT, 'backtests/price-action/latest.json'), { key: p.key, directory: job, map: dir, accepted: true });
  }
  console.log(JSON.stringify({ passed: true, map: dir, job: job ?? null, checks, examples }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
