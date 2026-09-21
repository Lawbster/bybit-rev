/** Setup chart tests: readers, event views, tape selection, and an end-to-end page build from a synthetic scan + replay folder. */
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { barsFor, buildChartModel, extractPivots, extractZone, parseCellId, parseCsv, parseTimeframes, renderChartHtml, resolveDir, toEventView, writeChart } from './setup-chart';
import { H, M, type Minute, type SetupEvent } from './setup-scan-core';

// ── parseCsv ──
{
  const rows = parseCsv('"id","note","n"\r\n"a","has, comma",1\n"b","says ""hi""",2\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { id: 'a', note: 'has, comma', n: '1' });
  assert.deepEqual(rows[1], { id: 'b', note: 'says "hi"', n: '2' });
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('"only","header"\n'), []);
}

// ── timeframes and cells ──
{
  assert.deepEqual(parseTimeframes(undefined).map(t => t.ms), [H, 15 * M]);
  assert.deepEqual(parseTimeframes('30m,120').map(t => t.ms), [30 * M, 120 * M]);
  assert.throws(() => parseTimeframes('7x'));
  assert.deepEqual(parseCellId('long__r1.5__hold24h'), { side: 'long', target: 'r1.5', holdHours: 24 });
  assert.deepEqual(parseCellId('short__structural__hold72h'), { side: 'short', target: 'structural', holdHours: 72 });
  assert.throws(() => parseCellId('bogus'));
}

// ── bars: same aggregation as the detectors, compact rows, gap bucket dropped ──
const t0 = Date.UTC(2026, 0, 5);
const mk = (i: number, p: number): Minute => ({ ts: t0 + i * M, endTs: t0 + (i + 1) * M, open: p, high: p + 0.5, low: p - 0.5, close: p + 0.1, volume: 1, turnover: 0, availableAt: t0 + (i + 2) * M });
{
  const minutes: Minute[] = [];
  for (let i = 0; i < 180; i++) if (i < 120 || i >= 130) minutes.push(mk(i, 100 + i * 0.01)); // third hour misses 10 minutes
  const bars = barsFor(minutes, H);
  assert.equal(bars.length, 2, 'incomplete hour excluded');
  assert.equal(bars[0][0], t0 / 1000); assert.equal(bars[0][1], 100); assert.equal(bars[0][2], 100.59 + 0.5); assert.equal(bars[0][5], 60);
  assert.equal(barsFor(minutes, 15 * M).length, 12 - 1, 'one 15m bucket lost to the gap');
}

// ── event views: zone from reference, from note, pivots nested ──
const baseEvent = (over: Partial<SetupEvent>): SetupEvent => ({
  id: 'PA02:1:pivot:x', setup: 'PA02', version: 'v', side: 1, stage: 'confirmed', formationAt: t0 + 20 * H, knownAt: t0 + 21 * H + M,
  stages: {
    context: { at: t0, knownAt: t0 + 12 * H + M, price: 110 },
    zone: { at: t0 + 3 * H, knownAt: t0 + 12 * H + M, price: 104, note: '[102, 104]' },
    retest: { at: t0 + 20 * H, knownAt: t0 + 21 * H + M, price: 103 },
  },
  reference: {
    contextPivot: { id: 'pivot:h', kind: 'high', price: 110, pivotAt: t0, confirmationEnd: t0 + 12 * H, availableAt: t0 + 12 * H + M, timeframe: 4 * H, width: 2 },
    nested: { targetPivot: { id: 'pivot:t', kind: 'high', price: 115, pivotAt: t0 + 8 * H, confirmationEnd: t0 + 20 * H, availableAt: t0 + 20 * H + M, timeframe: 4 * H, width: 2 } },
    zone: { low: 102, high: 104, originAt: t0 + 3 * H },
  },
  proxies: { entry: null, stop: 101.9, target: 115 }, notes: [],
  ...over,
} as SetupEvent);
{
  const ev = toEventView(baseEvent({}));
  assert.deepEqual(ev.zone, { low: 102, high: 104, from: t0 + 12 * H + M });
  assert.equal(toEventView(baseEvent({ stages: {} })).zone?.from, baseEvent({}).knownAt,
    'origin-only legacy metadata falls back to event availability, never candle origin');
  assert.equal(toEventView(baseEvent({ reference: { zone: { low: 102, high: 104, originAt: t0, availableAt: t0 + 15 * H } } })).zone?.from,
    t0 + 15 * H, 'latest explicit or stage publication wins');
  assert.deepEqual(ev.pivots.map(p => p.id).sort(), ['pivot:h', 'pivot:t']);
  assert.deepEqual(ev.stages.map(s => s.name), ['context', 'zone', 'retest'], 'stages ordered by at');
  const noRef = baseEvent({ reference: {} as any });
  assert.deepEqual(extractZone(noRef), { low: 102, high: 104, from: t0 + 12 * H + M }, 'zone parsed from the stage note when the reference has none');
  assert.deepEqual(extractPivots(undefined), []);
  const swapped = baseEvent({ reference: {} as any, stages: { z: { at: t0, knownAt: t0 + M, note: '[9.5, 8.25]' } } as any });
  assert.deepEqual(extractZone(swapped), { low: 8.25, high: 9.5, from: t0 + M });
}

// ── end-to-end: synthetic scan + replay folders -> page ──
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-chart-'));
  const scanKey = 'a'.repeat(64), replayKey = 'b'.repeat(64);
  const scanDir = path.join(root, 'backtests/setup-scans', scanKey); const replayDir = path.join(root, 'backtests/setup-replays', replayKey);
  fs.mkdirSync(scanDir, { recursive: true }); fs.mkdirSync(replayDir, { recursive: true });
  const days = 3; const minutes: Minute[] = []; for (let i = 0; i < days * 24 * 60; i++) minutes.push(mk(i, 100 + Math.sin(i / 200) * 5));
  const row = (m: Minute) => JSON.stringify({ ts: m.ts, o: m.open, h: m.high, l: m.low, c: m.close, v: m.volume });
  // The scan's own candle file is only a slice (the last day), as runScan writes it around the charted events.
  fs.writeFileSync(path.join(scanDir, 'candles-1m.jsonl'), minutes.slice(2 * 24 * 60).map(row).join('\n') + '\n');
  const confirmed = baseEvent({});
  const rejected = baseEvent({ id: 'PA02:1:pivot:y', stage: 'rejected', reason: 'no_sweep_before_fail', knownAt: t0 + 30 * H, formationAt: t0 + 29 * H, notes: ['generic_failed_zone_control'] });
  const traded = baseEvent({ id: 'PA02:1:pivot:z', stage: 'rejected', reason: 'no_sweep_before_fail', knownAt: t0 + 40 * H, formationAt: t0 + 39 * H });
  fs.writeFileSync(path.join(scanDir, 'events.jsonl'), [confirmed, rejected, traded].map(e => JSON.stringify(e)).join('\n') + '\n');
  const request = { symbol: 'TESTUSDT', from: t0, to: t0 + days * 24 * H, lagMs: 60000, tape: 'auto' };
  fs.writeFileSync(path.join(scanDir, 'plan.json'), JSON.stringify({ key: scanKey, request, detector: { id: 'PA02', version: 'v', conventions: ['convention one </script> escaped', 'convention two'] }, tape: { source: 'live_jsonl', start: t0, end: t0 + days * 24 * H, sha256: 'not-the-real-hash' } }));
  fs.writeFileSync(path.join(scanDir, 'summary.json'), JSON.stringify({ key: scanKey, setup: 'PA02', version: 'v', symbol: 'TESTUSDT', from: t0, to: t0 + days * 24 * H, tape: 'live_jsonl' }));
  fs.writeFileSync(path.join(scanDir, 'complete.json'), '{}');
  const cell = 'long__structural__hold24h';
  fs.writeFileSync(path.join(replayDir, 'plan.json'), JSON.stringify({ key: replayKey, cfg: { scanKey } }));
  fs.writeFileSync(path.join(replayDir, 'results.json'), JSON.stringify([
    { cell, window: 'full', delay: 0, targetFirst: false, stress: false, n: 2, wins: 1, losses: 1, net: 12.5, stressNet: 10, maxCloseDrawdownPct: 1.2, profitFactor: 1.1, avgR: 0.1, targets: 1, stops: 1, timeouts: 0, skippedOccupied: 0 },
    { cell, window: 'full', delay: 60000, targetFirst: false, stress: false, n: 2, net: 0 },
  ]));
  fs.writeFileSync(path.join(replayDir, 'actions.json'), JSON.stringify({ [cell]: { actions: 2, rejected: [{ id: rejected.id, at: rejected.knownAt, reason: 'risk_out_of_range', riskPct: 7.1 }], discarded: [] } }));
  const head = '"id","signalAt","entryAt","exitAt","entryPrice","exitPrice","side","qty","pricePnl","fees","net","reason","target","stop","r","touchedBoth","evidence","signalUtc","entryUtc","exitUtc"';
  const trade = (id: string, at: number, net: number, reason: string) => `"${id}","${at}","${at}","${at + 5 * H}","103","104","1","97","${net}","1.1","${net}","${reason}","115","101.9","0.5","false","{""context"":${t0}}","x","y","z"`;
  fs.writeFileSync(path.join(replayDir, `trades-${cell}.csv`), [head, trade(confirmed.id, confirmed.knownAt, 20, 'target'), trade(traded.id, traded.knownAt, -7.5, 'stop')].join('\n') + '\n');

  assert.equal(resolveDir(root, 'scan', scanKey), path.resolve(scanDir));
  assert.equal(resolveDir(root, 'replay', 'bbbbbbbbbbbb'), path.resolve(replayDir), 'key prefix resolves');
  assert.throws(() => resolveDir(root, 'scan', 'zzz'));

  // No sealed cache and no live file in this root: the loader falls back to the scan slice and says so.
  const fallback = await buildChartModel({ root, scanDir, replayDir, timeframes: parseTimeframes('1h'), rows: 'confirmed' });
  assert.equal(fallback.tape, 'scan_slice'); assert.match(fallback.tapeNote, /fallback/); assert.equal(fallback.timeframes[0].bars.length, 24, 'only the sliced day has bars');
  assert.match(renderChartHtml(fallback), /class="sub warn"/, 'header flags the partial tape');

  // With the live tape present, the whole scan span is loaded through the scanner's own loader; the hash mismatch is flagged.
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'TESTUSDT_1m.jsonl'), minutes.map(row).join('\n') + '\n');
  const model = await buildChartModel({ root, scanDir, replayDir, timeframes: parseTimeframes('1h,15m'), rows: 'confirmed' });
  assert.equal(model.tape, 'live_jsonl'); assert.match(model.tapeNote, /WARNING: tape hash differs/);
  assert.deepEqual(model.timeframes.map(t => t.bars.length), [72, 288], 'full span, not the slice');
  assert.deepEqual([model.tapeSpan.start, model.tapeSpan.end, model.tapeSpan.gaps], [t0, t0 + days * 24 * H, 0]);
  assert.equal(model.mode, 'replay'); assert.equal(model.symbol, 'TESTUSDT'); assert.equal(model.keys.replay, replayKey);
  assert.deepEqual(model.events.map(e => e.id), [confirmed.id, traded.id], 'confirmed rows plus rows a trade references; other rejected rows excluded');
  assert.equal(model.cells.length, 1); assert.equal(model.cells[0].trades.length, 2); assert.equal(model.cells[0].summary?.n, 2, 'primary-clock full-window summary picked');
  assert.deepEqual(model.cells[0].rejected, [{ id: rejected.id, reason: 'risk_out_of_range', riskPct: 7.1 }]);
  assert.equal(model.cells[0].trades[0].touchedBoth, false); assert.equal(model.cells[0].trades[1].net, -7.5);
  const forced = await buildChartModel({ root, scanDir, replayDir, timeframes: parseTimeframes('1h'), rows: 'confirmed', tape: 'scan-file' });
  assert.equal(forced.tape, 'scan_slice'); assert.doesNotMatch(forced.tapeNote, /fallback/);

  const all = await buildChartModel({ root, scanDir, replayDir: null, timeframes: parseTimeframes('1h'), rows: 'all' });
  assert.equal(all.mode, 'scan'); assert.equal(all.events.length, 3); assert.equal(all.cells.length, 0);

  const html = renderChartHtml(model);
  assert(html.includes('<script id="chart-data" type="application/json">'));
  const dataStart = html.indexOf('<script id="chart-data"'); const dataEnd = html.indexOf('</script>', dataStart);
  const embedded = html.slice(html.indexOf('>', dataStart) + 1, dataEnd);
  assert(!embedded.includes('</script'), 'closing tag sequences inside the JSON are escaped');
  const parsed = JSON.parse(embedded);
  assert.equal(parsed.conventions[0], 'convention one </script> escaped', 'escaping round-trips through JSON.parse');
  assert.equal(parsed.cells[0].trades.length, 2);
  // The inline client script must at least parse as JavaScript.
  const jsStart = html.lastIndexOf('<script>'); const js = html.slice(jsStart + '<script>'.length, html.indexOf('</script>', jsStart));
  assert.doesNotThrow(() => new Function(js), 'client script parses');
  assert(html.includes('lightweight-charts@4'));

  const written = await writeChart({ root, scanDir, replayDir, timeframes: parseTimeframes('1h'), rows: 'confirmed' });
  assert.equal(written.out, path.join(replayDir, 'chart.html')); assert(fs.existsSync(written.out)); assert(written.bytes > 10000);
  const scanOnly = await writeChart({ root, scanDir, timeframes: parseTimeframes('1h'), rows: 'all', out: path.join(root, 'custom.html') });
  assert.equal(scanOnly.out, path.join(root, 'custom.html')); assert.equal(scanOnly.model.mode, 'scan');
  fs.rmSync(root, { recursive: true, force: true });
  console.log('setup-chart tests passed');
})().catch(e => { console.error(e); process.exit(1); });
