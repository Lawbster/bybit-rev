/** Setup ledger tests: cell screens, status overlay, cross-asset overview, lookup, and the generated page on a synthetic artifact tree. */
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SCREENS, buildLedger, collectLedger, lookup, nonDefaultParams, renderLedger, summariseCells } from './setup-ledger';

const t0 = Date.UTC(2025, 0, 1), t1 = Date.UTC(2026, 8, 15);
const row = (cell: string, window: string, over: Record<string, unknown> = {}) => ({ cell, side: cell.split('__')[0], target: cell.split('__')[1], holdHours: 24, window, delay: 0, targetFirst: false, stress: false, n: 40, wins: 22, losses: 18, net: 1000, stressNet: 800, maxCloseDrawdownPct: 4.2, profitFactor: 1.5, avgR: 0.2, top5WinDollars: 600, ...over });

// ── summariseCells: screens computed from primary clock, sensitivities and monthly rows ──
{
  const results = [
    row('long__r2__hold24h', 'full'), row('long__r2__hold24h', 'older', { net: 600 }), row('long__r2__hold24h', 'recent', { net: 400 }),
    row('long__r2__hold24h', 'full', { delay: 60000, net: 900 }), row('long__r2__hold24h', 'full', { targetFirst: true, net: 950 }), row('long__r2__hold24h', 'full', { stress: true, net: 800 }),
    row('short__r2__hold24h', 'full', { n: 12, net: -300, stressNet: -400, profitFactor: 0.8, top5WinDollars: 900 }), row('short__r2__hold24h', 'older', { net: -100 }), row('short__r2__hold24h', 'recent', { net: -200 }),
  ];
  const monthly = [
    ...['2025-01', '2025-02', '2025-03'].map(month => ({ cell: 'long__r2__hold24h', window: 'full', delay: 0, targetFirst: false, stress: false, month, wins: 3, losses: 2, markedNet: 300 })),
    { cell: 'short__r2__hold24h', window: 'full', delay: 0, targetFirst: false, stress: false, month: '2025-01', wins: 1, losses: 3, markedNet: -400 },
    { cell: 'short__r2__hold24h', window: 'full', delay: 60000, targetFirst: false, stress: false, month: '2025-01', wins: 1, losses: 3, markedNet: -9000 }, // other clock: ignored
  ];
  const s = summariseCells(results as any, monthly as any, 3);
  assert.equal(s.cells.length, 2); assert.equal(s.positive, 1); assert.equal(s.clean, 1, 'the long cell passes all nine screens');
  const long = s.cells[0], short = s.cells[1];
  assert.equal(long.passed, SCREENS.length); assert.deepEqual([long.older, long.recent, long.delay60Net, long.targetFirstNet], [600, 400, 900, 950]);
  assert.equal(long.badMonths, 0); assert.equal(long.activeMonths, 3); assert.equal(long.worstMonth, 300);
  assert.equal(long.winRate, 22 / 40, 'win rate is wins over closed trades');
  assert.equal(short.passed, 0); assert.equal(short.badMonths, 1); assert.equal(short.worstMonth, -400, 'other clocks do not leak into the monthly screen');
  assert.equal(s.bestBySide.short?.cell, 'short__r2__hold24h');
}

// ── nonDefaultParams uses the registered detector defaults ──
{
  assert.deepEqual(nonDefaultParams('RS01', { triggerTfMinutes: 60, entryMode: 'msb', pivotWidth: 3 }), { entryMode: 'msb' });
  assert.deepEqual(nonDefaultParams('PA02', { contextTfMinutes: 1440, triggerTfMinutes: 60 }), { contextTfMinutes: 1440 });
  assert.deepEqual(nonDefaultParams('NOPE', { a: 1 }), { a: 1 });
}

// ── synthetic artifact tree: two symbols, one control run, a status overlay ──
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  const mkScan = (key: string, setup: string, symbol: string, params: Record<string, unknown>, confirmed: number) => {
    const d = path.join(root, 'backtests/setup-scans', key); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'plan.json'), JSON.stringify({ key, request: { setup, symbol, from: t0, to: t1, params: { triggerTfMinutes: 60, ...params } }, createdAt: 1 }));
    fs.writeFileSync(path.join(d, 'summary.json'), JSON.stringify({ key, setup, version: 'v1', symbol, from: t0, to: t1, events: confirmed * 10, confirmed, long: Math.ceil(confirmed / 2), short: Math.floor(confirmed / 2) }));
  };
  const mkReplay = (key: string, scanKey: string, setup: string, symbol: string, rows: unknown, results: unknown[], monthly: unknown[]) => {
    const d = path.join(root, 'backtests/setup-replays', key); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'plan.json'), JSON.stringify({ key, cfg: { scanKey, holds: [24], targets: ['r2'], stopBufferPct: 0, ...(rows ? { rows } : {}) }, scan: { key: scanKey, setup, version: 'v1', symbol, from: t0, to: t1 }, createdAt: 2 }));
    fs.writeFileSync(path.join(d, 'results.json'), JSON.stringify(results)); fs.writeFileSync(path.join(d, 'monthly.json'), JSON.stringify(monthly));
  };
  mkScan('s'.repeat(64), 'RS01', 'HYPEUSDT', { entryMode: 'msb' }, 50);
  mkScan('t'.repeat(64), 'RS01', 'SOLUSDT', { entryMode: 'msb' }, 30);
  mkScan('u'.repeat(64), 'PA02', 'HYPEUSDT', {}, 200);
  mkScan('v'.repeat(64), 'PA04', 'BTCUSDT', {}, 400); // scanned, never replayed
  const good = [row('long__r2__hold24h', 'full'), row('long__r2__hold24h', 'older', { net: 600 }), row('long__r2__hold24h', 'recent', { net: 400 }), row('long__r2__hold24h', 'full', { delay: 60000 }), row('long__r2__hold24h', 'full', { targetFirst: true }), row('short__r2__hold24h', 'full', { net: -50 })];
  const months = [{ cell: 'long__r2__hold24h', window: 'full', delay: 0, targetFirst: false, stress: false, month: '2025-01', wins: 3, losses: 2, markedNet: 300 }];
  mkReplay('a'.repeat(64), 's'.repeat(64), 'RS01', 'HYPEUSDT', undefined, good, months);
  mkReplay('b'.repeat(64), 't'.repeat(64), 'RS01', 'SOLUSDT', undefined, [row('long__r2__hold24h', 'full', { net: -700, stressNet: -900, profitFactor: 0.7 })], []);
  mkReplay('c'.repeat(64), 's'.repeat(64), 'RS01', 'HYPEUSDT', { stage: 'rejected', reason: 'no_fvg' }, [row('long__r2__hold24h', 'full', { n: 8, net: 120 })], []);
  mkReplay('d'.repeat(64), 'u'.repeat(64), 'PA02', 'HYPEUSDT', undefined, [row('long__r2__hold24h', 'full', { net: -2000, profitFactor: 0.6 }), row('short__r2__hold24h', 'full', { net: -3000, profitFactor: 0.5 })], []);
  // Resting-limit execution variants of the same scan are separate families, labelled by their execution model.
  mkScan('w'.repeat(64), 'OB01', 'HYPEUSDT', {}, 60);
  mkReplay('e'.repeat(64), 'w'.repeat(64), 'OB01', 'HYPEUSDT', undefined, [row('long__r2__hold24h', 'full', { net: 100 })], []);
  { const d = path.join(root, 'backtests/setup-replays', 'f'.repeat(64)); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'plan.json'), JSON.stringify({ key: 'f'.repeat(64), cfg: { scanKey: 'w'.repeat(64), holds: [24], targets: ['r2'], stopBufferPct: 0, entryLimit: { source: 'proxy', model: 'touch', expiryHours: 72, offsetPct: 0 } }, scan: { key: 'w'.repeat(64), setup: 'OB01', version: 'v1', symbol: 'HYPEUSDT', from: t0, to: t1 }, createdAt: 3 }));
    fs.writeFileSync(path.join(d, 'results.json'), JSON.stringify([row('long__r2__hold24h', 'full', { net: 250 })])); fs.writeFileSync(path.join(d, 'monthly.json'), '[]'); }
  fs.mkdirSync(path.join(root, 'research'), { recursive: true });
  fs.writeFileSync(path.join(root, 'research/setup-ledger-notes.json'), JSON.stringify({ runs: { aaaaaaaa: { status: 'lead', note: 'needs a card', by: 'test', date: '2026-09-19' }, dddddddd: { status: 'falsified', note: 'negative everywhere' } } }));

  const l = collectLedger(root, 3);
  { const ob = l.runs.filter(r => r.setup === 'OB01').sort((x, y) => x.key.localeCompare(y.key));
    assert.deepEqual(ob.map(r => r.entry), ['-', 'limit:proxy/touch/72h'], 'market and resting-limit replays of one scan are labelled apart'); }
  assert.equal(l.runs.length, 6); assert.equal(l.scans.length, 5);
  const hype = l.runs.find(r => r.key.startsWith('aaaa'))!;
  assert.equal(hype.status, 'lead'); assert.equal(hype.note, 'needs a card'); assert.equal(hype.entry, 'msb'); assert.deepEqual(hype.params, { entryMode: 'msb' });
  assert.equal(hype.events, 50); assert.equal(hype.cellsTotal, 2); assert.equal(hype.cellsPositive, 1); assert.equal(hype.cleanCells, 1);
  const ctl = l.runs.find(r => r.key.startsWith('cccc'))!;
  assert.equal(ctl.status, 'control', 'a non-confirmed row set defaults to control'); assert.equal(ctl.rows, 'rejected:no_fvg');
  assert.equal(l.runs.find(r => r.key.startsWith('dddd'))!.status, 'falsified');
  assert.equal(l.runs.find(r => r.key.startsWith('bbbb'))!.status, 'exploratory');
  const pa04 = l.scans.find(s => s.setup === 'PA04')!; assert.deepEqual(pa04.replayed, []); assert.equal(pa04.confirmed, 400);
  assert.deepEqual(l.scans.find(s => s.key.startsWith('ssss'))!.replayed.sort(), ['aaaaaaaa', 'cccccccc']);

  assert.deepEqual(lookup(l, ['rs01', 'sol']).map(r => r.key[0]), ['b']);
  assert.deepEqual(lookup(l, ['lead']).map(r => r.key[0]), ['a']);
  assert.equal(lookup(l, ['nothing-here']).length, 0);

  const md = renderLedger(l);
  assert(md.includes('## Cross-asset overview')); assert(md.includes('| RS01 | entry msb, defaults |'), 'entry mode is shown once, not repeated in the params');
  assert(md.includes('not run'), 'symbols without a run for a variant say so');
  assert(md.includes('**lead** (1)') && md.includes('**falsified** (1)') && md.includes('**control** (1)'));
  assert(md.includes('| long__r2__hold24h | 40 | 22/18 | 55% | +$1,000 |'), 'win % column present'); assert(md.includes('9/9'));
  assert(md.includes('| PA04 | BTCUSDT |') && md.includes('| none |'), 'never-replayed scans are listed');
  const built = buildLedger(root, 3);
  assert(fs.existsSync(built.md) && fs.existsSync(built.json));
  const json = JSON.parse(fs.readFileSync(built.json, 'utf8'));
  assert.equal(json.runs.length, 6); assert.equal(json.screens.length, SCREENS.length);
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('setup-ledger tests passed');
