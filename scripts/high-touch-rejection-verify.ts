/** HT03 independent signal/clock reconstruction + reused independent execution audit. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { atomicJson, fileHash } from './research-workflow';
import { cachedCandles, ROOT } from './level-playbook-study';
import { auditShort, near } from './high-touch-short-audit';
import { csv } from './poc-bounce-study';
import type { Candle } from './hype-freerun-canonical-replay';
type Row = Record<string, any>;
const M = 60000;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const unzip = (f: string) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, f))).toString('utf8'));

// This deliberately does not import or call the HT03 signal producer.
export function referenceGroups(cs: readonly Candle[], anchors: readonly Row[], definitions: readonly Row[]) {
  const bar = (t: number) => { const b = cs[(t - cs[0].ts) / M]; return b?.ts === t ? b : null; };
  const groups: Row[] = [];
  for (const def of definitions) {
    const decisions: Row[] = [];
    for (const a of anchors) {
      const touch = bar(a.observationStart); assert(touch);
      const d: Row = { anchorId: a.id, anchorAt: a.at, reference: a.high, status: 'not_qualified',
        at: a.at, sourceStart: touch.ts, sourceEnd: touch.endTs, close: touch.close, winnerId: null };
      if (['baseline', 'close_back', 'wick_reject', 'above_close'].includes(def.id)) {
        const pass = def.id === 'baseline' || def.id === 'above_close' && touch.close > a.high ||
          def.id === 'close_back' && touch.close < a.high || def.id === 'wick_reject' && touch.close < a.high &&
          touch.high > touch.low && 2 * (touch.high - Math.max(touch.open, touch.close)) >= touch.high - touch.low;
        if (pass) d.status = 'emitted';
      } else if (def.id.startsWith('confirm_') || def.id.startsWith('wait_')) {
        const tf = (def.id.endsWith('_15m') ? 15 : 5) * M;
        const start = a.at - a.at % tf + (a.at % tf ? tf : 0), end = start + tf;
        d.sourceStart = start; d.sourceEnd = null; d.at = null; d.close = null; d.status = 'censored';
        const minutes: Candle[] = [];
        for (let t = start; t < end; t += M) { const b = bar(t); if (!b) break; minutes.push(b); }
        if (minutes.length === tf / M) {
          d.sourceEnd = end; d.at = end + M; d.close = minutes.at(-1)!.close;
          d.status = def.id.startsWith('wait_') || d.close < a.high ? 'emitted' : 'not_qualified';
        }
      } else {
        assert(['failed_break_5m', 'failed_break_15m'].includes(def.id));
        if (touch.close > a.high) {
          const horizon = def.id.endsWith('_15m') ? 15 : 5;
          d.at = null; d.sourceStart = touch.endTs; d.sourceEnd = null; d.close = null; d.status = 'censored';
          for (let k = 1; k <= horizon; k++) {
            const receipt = a.at + k * M, b = bar(receipt - 2 * M);
            if (!b) break;
            d.sourceEnd = b.endTs; d.close = b.close;
            if (b.close < a.high) { d.at = receipt; d.sourceStart = b.ts; d.status = 'emitted'; break; }
            if (k === horizon) d.status = 'not_qualified';
          }
        }
      }
      decisions.push(d);
    }
    const winners = new Map<number, Row>();
    for (const d of decisions.filter(x => x.status === 'emitted').sort((a, b) => a.at - b.at || a.anchorAt - b.anchorAt ||
      (a.anchorId < b.anchorId ? -1 : a.anchorId > b.anchorId ? 1 : 0))) {
      const first = winners.get(d.at);
      if (first) { d.status = 'deduplicated'; d.winnerId = first.anchorId; } else winners.set(d.at, d);
    }
    groups.push({ id: def.id, candidate: def.candidate, control: def.control, decisions,
      signals: [...winners.values()].map(d => ({ id: d.anchorId, at: d.at, side: -1 })) });
  }
  return groups;
}

function checkAttribution(base: Row, run: Row) {
  const same = (a: Row, b: Row) => a.id === b.id && a.entryAt === b.entryAt;
  const removed = base.trades.filter((a: Row) => !run.trades.some((b: Row) => same(a, b)));
  const added = run.trades.filter((a: Row) => !base.trades.some((b: Row) => same(a, b)));
  const common = run.trades.filter((a: Row) => base.trades.some((b: Row) => same(a, b)));
  for (const a of common) assert.deepEqual(a, base.trades.find((b: Row) => same(a, b)));
  const totals = (ts: Row[]) => ({ count: ts.length, wins: ts.filter(t => t.net > 1e-8).length,
    losses: ts.filter(t => t.net < -1e-8).length, winningDollars: ts.reduce((s, t) => s + Math.max(0, t.net), 0),
    losingDollars: ts.reduce((s, t) => s + Math.min(0, t.net), 0), net: ts.reduce((s, t) => s + t.net, 0) });
  const expected: Row = { shared: common.length, removed: totals(removed), added: totals(added),
    changedTimeSameAnchor: added.filter((t: Row) => removed.some((r: Row) => r.id === t.id)).length,
    openDelta: (run.open?.net ?? 0) - (base.open?.net ?? 0) };
  expected.delta = expected.added.net - expected.removed.net + expected.openDelta;
  expected.deltaWithoutTwoLargestAvoidedLosses = expected.delta + removed.filter((t: Row) => t.net < 0)
    .map((t: Row) => t.net).sort((a: number, b: number) => a - b).slice(0, 2).reduce((s: number, n: number) => s + n, 0);
  near(expected.delta, run.stats.net - base.stats.net, 'attribution conservation');
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'number') near(run.attribution[key], value, 'attribution/' + key);
    else for (const [k, v] of Object.entries(value)) near(run.attribution[key][k], v as number, 'attribution/' + key + '/' + k);
  }
}

function monthlyCsv(file: string): Row[] {
  // These study CSVs contain quoted flat numeric/ID cells, no multiline cells.
  const lines = fs.readFileSync(path.resolve(ROOT, file), 'utf8').trimEnd().split('\n');
  const cells = (line: string) => {
    const matches = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)];
    assert.equal(matches.map(m => m[0]).join(''), line, 'CSV parse coverage');
    return matches.map(m => m[1].replace(/""/g, '"'));
  };
  const headers = cells(lines.shift()!);
  return lines.map(line => { const values = cells(line); assert.equal(values.length, headers.length);
    return Object.fromEntries(headers.map((k, i) => [k, values[i]])); });
}

export async function main() {
  const latest = read('backtests/high-touch-rejection/latest.json'), dir = process.argv[2] ?? latest.directory;
  const plan = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), c = plan.card;
  const verifyHashes = async () => {
    for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
    for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, a.file);
  };
  await verifyHashes(); assert.equal(seal.key, plan.key); assert.equal(seal.paths, 360);
  const parity = read(dir + '/baseline-parity.json'); assert(parity.passed); assert.equal(parity.paths, 36);
  assert.deepEqual(parity.parents, c.parents);
  const cs = cachedCandles(c.cache), parent = read(c.parent + '/groups.json').find((g: Row) => g.id === 'exact_touch');
  assert.equal(parent.evidence.length, 7475);
  for (let i = 0; i < cs.length; i++) {
    assert.equal(cs[i].endTs, cs[i].ts + M); if (i) assert.equal(cs[i].ts, cs[i - 1].endTs);
    assert([cs[i].open, cs[i].high, cs[i].low, cs[i].close].every(v => Number.isFinite(v) && v > 0));
    assert(cs[i].high >= Math.max(cs[i].open, cs[i].close) && cs[i].low <= Math.min(cs[i].open, cs[i].close));
  }
  // Read saved anchors, independently check each reference from original minutes.
  for (let n = 0; n < parent.evidence.length; n++) {
    const a = parent.evidence[n], i = (a.observationStart - cs[0].ts) / M, b = cs[i];
    assert(i >= 2881 && Number.isInteger(i)); let high = -Infinity;
    for (let j = i - 2881; j <= i - 2; j++) high = Math.max(high, cs[j].high);
    assert.equal(a.high, high); assert.equal(a.sourceStart, cs[i - 2881].ts); assert.equal(a.sourceEnd, cs[i - 2].endTs);
    assert.equal(a.referenceAvailableAt, b.ts); assert.equal(a.at, b.endTs + M);
    assert(b.low <= high && high <= b.high); assert.equal(a.observationEnd, b.endTs);
    for (const [key, v] of Object.entries({ open: b.open, observedHigh: b.high, low: b.low, close: b.close })) assert.equal(a[key], v);
    assert.deepEqual(parent.signals[n], { id: a.id, at: a.at, side: -1 });
  }
  const groups = unzip(dir + '/groups.json.gz'), reference = referenceGroups(cs, parent.evidence, c.groups);
  assert.deepEqual(groups, reference, 'All trigger, negative, timing, censor and dedup decisions');
  const rows: Row[] = read(dir + '/results.json'), ranks: Row[] = read(dir + '/ranking.json');
  assert.equal(rows.length, 360); assert.equal(new Set(rows.map(r => [r.parent, r.group, r.window, r.delay, r.targetFirst].join('|'))).size, 360);
  assert.equal(fs.readFileSync(path.resolve(ROOT, dir, 'results.csv'), 'utf8'), csv(rows));
  const monthRows = monthlyCsv(dir + '/monthly.csv'), monthLookup = new Map<string, Row>();
  const monthKey = (r: Row, month: string) => [r.parent, r.group, r.window, r.delay, String(r.targetFirst), month].join('|');
  for (const m of monthRows) { const key = monthKey(m, m.month); assert(!monthLookup.has(key)); monthLookup.set(key, m); }
  const baselines = new Map<string, Row>(); const bk = (r: Row) => [r.parent, r.window, r.delay, r.targetFirst].join('|');
  for (const r of rows.filter(r => r.group === 'baseline')) baselines.set(bk(r), unzip(dir + '/' + r.journal));
  let receipts = 0, minutes = 0, checkedMonths = 0;
  const journals = new Set<string>();
  for (const r of rows) {
    assert(c.parents.includes(r.parent)); assert(c.delays.includes(r.delay)); assert(['full', 'older', 'recent'].includes(r.window));
    assert(typeof r.targetFirst === 'boolean'); const definition = c.groups.find((g: Row) => g.id === r.group); assert(definition);
    assert.equal(r.candidate, definition.candidate); assert.equal(r.control, definition.control);
    const bracket = /__tp([\d.]+)_sl([\d.]+)$/.exec(r.parent)!;
    assert.equal(r.tpPct, +bracket[1]); assert.equal(r.slPct, +bracket[2]); assert.equal(r.capHours, c.capHours);
    assert(!journals.has(r.journal), 'Each case has its own options/ambiguity journal'); journals.add(r.journal);
    const run = unzip(dir + '/' + r.journal), baseline = baselines.get(bk(r))!;
    assert.equal(run.options.start, Date.parse(r.window === 'recent' ? c.split : c.start));
    assert.equal(run.options.end, Date.parse(r.window === 'older' ? c.split : c.end));
    for (const k of ['notional', 'equity', 'fee']) assert.equal(run.options[k], c[k]);
    const signalGroup = groups.find((g: Row) => g.id === r.group); assert(signalGroup);
    const audited = auditShort(cs, signalGroup.signals, r, run, c);
    receipts += audited.receipts; minutes += audited.minutes;
    near(r.baselineNet, baseline.stats.net); near(r.baselineDd, baseline.stats.maxAdverseDrawdownPct);
    near(r.deltaNet, run.stats.net - baseline.stats.net); assert.equal(r.baselineTrades, baseline.stats.trades);
    assert.equal(r.baselineWinRate, baseline.stats.winRate);
    assert.equal(r.deltaWinRate, r.winRate === null || baseline.stats.winRate === null ? null : r.winRate - baseline.stats.winRate);
    near(r.worstMonth, Math.min(...run.monthly.map((m: Row) => m.markedNet)));
    near(r.worstMonthDelta, Math.min(...run.monthly.map((m: Row) => m.markedNet - baseline.monthly.find((b: Row) => b.month === m.month).markedNet)));
    checkAttribution(baseline, run);
    for (const m of run.monthly) {
      const saved = monthLookup.get(monthKey(r, m.month)); assert(saved);
      for (const [k, v] of Object.entries(m)) if (typeof v === 'number') near(Number(saved[k]), v, 'monthly/' + k);
      const b = baseline.monthly.find((x: Row) => x.month === m.month);
      near(Number(saved.baselineNet), b.markedNet); near(Number(saved.delta), m.markedNet - b.markedNet); checkedMonths++;
    }
  }
  assert.equal(checkedMonths, monthRows.length);
  assert.equal(ranks.length, 30); assert.equal(new Set(ranks.map(r => r.parent + '|' + r.group)).size, 30);
  for (const r of ranks) {
    const rs = rows.filter(x => x.parent === r.parent && x.group === r.group && !x.targetFirst); assert.equal(rs.length, 6);
    const absolute = rs.every(x => x.net > 0 && x.stressNet > 0 && x.trades >= (x.window === 'full' ? 30 : 10) && !x.bankrupt && x.worstMonth >= -250);
    const relative = r.candidate && absolute && rs.every(x => x.deltaNet > 0 && x.maxAdverseDrawdownPct <= x.baselineDd + 1e-8 && x.worstMonthDelta >= -250);
    assert.equal(r.pass, absolute); assert.equal(r.relativePass, relative);
    assert.equal(r.candidate, c.groups.find((g: Row) => g.id === r.group).candidate);
    for (const w of ['full', 'older', 'recent']) assert.deepEqual(r[w], rs.find(x => x.window === w && !x.delay));
  }
  await verifyHashes();
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: plan.key, paths: rows.length,
    uniqueJournals: journals.size, receipts, minutes, monthRows: checkedMonths, anchorChecks: parent.evidence.length,
    decisionChecks: parent.evidence.length * groups.length, candidateDefinitions: 18, diagnosticDefinitions: 9,
    note: 'Independent frozen-high/confirmation clocks, every eligibility/dedup/censor row; unchanged independent minute audit; attribution, rankings and CSV monthlies checked.' });
  if (latest.key === plan.key) atomicJson(path.join(ROOT, 'backtests/high-touch-rejection/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, paths: rows.length, receipts, minutes, monthRows: checkedMonths }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
