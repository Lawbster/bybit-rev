/** Research tape builder tests: local merge priority, kline parsing, gap detection, chunked fetching with a fake fetcher, manifest. */
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildResearchTape, missingRuns, parseKlines, readLocalRows } from './build-research-tape';
import { M } from './setup-scan-core';

const t0 = Date.UTC(2026, 0, 1);

// ── parseKlines: newest-first string rows become sorted numeric rows; bad rows dropped ──
{
  const resp = { retCode: 0, result: { list: [[String(t0 + 2 * M), '10', '11', '9', '10.5', '5', '50'], [String(t0 + M), '9', '10', '8', '10', '4', '40'], [String(t0), '0', '1', '0', '0', '1', '1']] } };
  const rows = parseKlines(resp);
  assert.deepEqual(rows.map(r => r.ts), [t0 + M, t0 + 2 * M], 'sorted ascending, zero-price row dropped');
  assert.equal(rows[0].src, 'bybit-kline');
  assert.throws(() => parseKlines({ retCode: 10001, retMsg: 'bad' }));
}

// ── missingRuns ──
{
  const have = new Set([t0, t0 + M, t0 + 4 * M]);
  assert.deepEqual(missingRuns(have, t0, t0 + 6 * M), [{ start: t0 + 2 * M, end: t0 + 4 * M, minutes: 2 }, { start: t0 + 5 * M, end: t0 + 6 * M, minutes: 1 }]);
  assert.deepEqual(missingRuns(new Set([t0]), t0, t0 + M), []);
}

// ── end to end with a fake fetcher ──
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tape-'));
  fs.mkdirSync(path.join(root, 'data'));
  const mk = (ts: number, p: number) => ({ timestamp: ts, open: p, high: p + 1, low: p - 1, close: p + 0.5, volume: 1, turnover: 1 });
  // history file: minutes 0-9; collector jsonl: minutes 8-11 with a conflicting close at minute 8 and a bad row
  fs.writeFileSync(path.join(root, 'data/TSTUSDT_1_full.json'), JSON.stringify(Array.from({ length: 10 }, (_, i) => mk(t0 + i * M, 100 + i))));
  fs.writeFileSync(path.join(root, 'data/TSTUSDT_1m.jsonl'), [8, 9, 10, 11].map(i => JSON.stringify({ ts: t0 + i * M, o: 200, h: 201, l: 199, c: 200.5, v: 1, t: 1 })).join('\n') + '\n{"ts":' + (t0 + 12 * M) + ',"o":0,"h":0,"l":0,"c":0,"v":0,"t":0}\n');
  assert.equal(readLocalRows(path.join(root, 'data/TSTUSDT_1m.jsonl'), 'x').length, 4, 'invalid row dropped');

  const calls: { start: number; end: number }[] = [];
  const fetcher = async (_s: string, _i: '1' | '5', start: number, end: number) => {
    calls.push({ start, end });
    const list: string[][] = [];
    for (let t = end; t >= start; t -= M) if (t !== t0 + 14 * M) list.push([String(t), '300', '301', '299', '300.5', '1', '1']); // minute 14 never served
    return { retCode: 0, result: { list } };
  };
  const to = t0 + 2200 * M; // 2200 minutes: 12 local, 2188 to fetch in 3 chunks (1000, 1000, 188)
  const res = await buildResearchTape({ root, symbol: 'TSTUSDT', from: t0, to, fetch: true, rps: 1000, fetcher });
  const m = res.manifest as any;
  assert.equal(m.rows, 2200 - 1, 'everything filled except the minute the endpoint never serves');
  assert.equal(m.conflictsBetweenLocalSources, 2, 'minutes 8 and 9 exist in both local sources with different prices');
  assert.deepEqual(m.sources.map((s: any) => [s.file, s.rowsUsed]), [['data/TSTUSDT_1_full.json', 10], ['data/TSTUSDT_1m.jsonl', 2]], 'history wins over collector on overlap');
  assert.equal(calls.length, 3); assert.equal(calls[0].end - calls[0].start, 999 * M, 'chunks of at most 1000 minutes, end inclusive');
  assert.equal(m.fetch.requests, 3); assert.equal(m.fetch.rows, 2188 - 1);
  assert.deepEqual(m.remainingGaps, [{ start: new Date(t0 + 14 * M).toISOString(), end: new Date(t0 + 15 * M).toISOString(), minutes: 1 }]);
  const lines = fs.readFileSync(res.file, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines[8].c, 108.5, 'minute 8 comes from the history file, not the conflicting collector row');
  assert.equal(lines[12].src, 'bybit-kline'); assert.equal(lines[0].src, 'local:data/TSTUSDT_1_full.json');
  for (let i = 1; i < lines.length; i++) assert(lines[i].ts > lines[i - 1].ts, 'sorted');
  assert(fs.existsSync(res.file.replace(/\.jsonl$/, '.manifest.json')));
  // --no-fetch leaves the gaps and says so
  const dry = await buildResearchTape({ root, symbol: 'TSTUSDT', from: t0, to, fetch: false, fetcher, outDir: path.join(root, 'dry') });
  assert.equal((dry.manifest as any).fetch, 'disabled'); assert.equal((dry.manifest as any).rows, 12);
  fs.rmSync(root, { recursive: true, force: true });
  console.log('build-research-tape tests passed');
})().catch(e => { console.error(e); process.exit(1); });
