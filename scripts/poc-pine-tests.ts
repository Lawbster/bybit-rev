import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { asOf, createReader } from './poc-profile-engine';
import { decodeLevels, encodeLevels, projectedStatus, readAcceptedMap, renderPine, ROW_WIDTH, selectLevels, sha256 } from './poc-pine-export';

const pointer = JSON.parse(fs.readFileSync('backtests/poc-viewers/latest.json', 'utf8'));
const { map, mapSha } = readAcceptedMap(path.join(pointer.directory, 'map.json'));
const levels = selectLevels(map);
const chunks = encodeLevels(levels);
assert.deepEqual(decodeLevels(chunks), levels, 'Lossless compact payload');
assert(chunks.every(c => c.length < 4096 && c.split(';').length <= 40));
const profiles = map.profiles.filter(p => p.eligible && p.venue === 'bybit' && Number(p.width) === Number(ROW_WIDTH));
assert.equal(profiles.length, levels.length, 'Every eligible profile included');
const originals = new Map(profiles.map(p => [`${p.period}:${p.start}`, p]));

let boundaryChecks = 0;
for (const p of levels) {
  const original = originals.get(`${p.period}:${p.start}`)!;
  const boundaries = new Set([map.start, map.end, p.availableAt - 1, p.availableAt]);
  for (const clock of [p.retestKnownAt, p.uncertainKnownAt]) if (clock !== null) {
    boundaries.add(clock - 1); boundaries.add(clock);
  }
  for (const at of boundaries) {
    if (at > map.end) continue;
    const row = asOf([original], at, map.end)[0];
    assert.equal(projectedStatus(p, at), row?.status ?? 'hidden', `${original.id} at ${at}`);
    boundaryChecks++;
  }
}

const reader = createReader(map.profiles, map.end);
for (const at of [map.start, Date.UTC(2025, 0, 1), Date.UTC(2025, 6, 1), Date.UTC(2026, 5, 1), Date.UTC(2026, 8, 1), map.end]) {
  const expected = reader.at(at, { venue: 'bybit', width: ROW_WIDTH })
    .map(p => `${p.period}:${p.start}:${p.center}:${p.status}`).sort();
  const actual = levels.filter(p => projectedStatus(p, at) !== 'hidden')
    .map(p => `${p.period}:${p.start}:${p.center}:${projectedStatus(p, at)}`).sort();
  assert.deepEqual(actual, expected, `Canonical whole-map projection at ${at}`);
}

// Explicitly exercise states that can be missed by a final-cutoff comparison.
const synthetic = { ...levels[0], availableAt: 100, retestKnownAt: 200, uncertainKnownAt: 150 };
assert.equal(projectedStatus(synthetic, 99), 'hidden');
assert.equal(projectedStatus(synthetic, 100), 'untested');
assert.equal(projectedStatus(synthetic, 149), 'untested');
assert.equal(projectedStatus(synthetic, 150), 'uncertain');
assert.equal(projectedStatus(synthetic, 199), 'uncertain');
assert.equal(projectedStatus(synthetic, 200), 'tested');
assert.equal(projectedStatus({ ...synthetic, retestKnownAt: 90 }, 100), 'tested', 'Retest before modeled publication');
assert.equal(projectedStatus({ ...synthetic, retestKnownAt: null, uncertainKnownAt: null }, 200), 'untested');

const template = fs.readFileSync('scripts/templates/poc-map-overlay.pine', 'utf8');
const pine = fs.readFileSync('tradingview/HYPE-Bybit-POC-map.pine', 'utf8');
const manifest = JSON.parse(fs.readFileSync('tradingview/HYPE-Bybit-POC-map.manifest.json', 'utf8'));
assert.equal(pine, renderPine(map, mapSha, template), 'Generated Pine matches template and accepted map');
assert.equal(sha256(pine), manifest.pineSha256);
assert.equal(sha256(template), manifest.templateSha256);
assert.equal(mapSha, manifest.mapSha256);
assert.equal(map.key, manifest.mapKey);
assert.equal(map.end, manifest.cutoff);
assert.equal(levels.length, manifest.levels);
assert.equal(manifest.tradingViewCompilationVerified, false, 'Do not claim compiler access');
const embedded = [...pine.matchAll(/^    loadChunk\("([^"]+)"\)$/gm)].map(m => m[1]);
assert.deepEqual(decodeLevels(embedded), levels, 'Actual Pine embeds every row without rounding');
// Regression for TradingView CE10205: no initialization block may grow with the
// entire dataset. All chunks execute on the first bar, in the original order.
const initBlocks = [...pine.matchAll(/^if barstate\.isfirst\n((?:[ \t]+[^\n]*\n)+)/gm)].map(m => m[1]);
const loaderBlocks = initBlocks.filter(block => block.includes('loadChunk('));
assert.equal(loaderBlocks.length, chunks.length, 'One first-bar block per payload chunk');
for (const block of loaderBlocks) {
  assert.equal((block.match(/loadChunk\(/g) ?? []).length, 1, 'Never combine payload chunks inside one if');
  assert(block.length < 4200, 'Keep generated loader blocks small');
}
assert.equal(initBlocks.length, chunks.length + 1, 'Separate symbol guard and loader blocks');
assert(pine.startsWith('//@version=6\n'));
assert(!pine.includes('{{'));
assert(!/request\.|strategy\.|alert\(/.test(pine), 'Drawing-only script');
assert(pine.includes('level.availableAt <= asOf'));
assert(pine.includes('level.retestKnownAt <= asOf'));
assert(pine.includes('level.uncertainKnownAt <= asOf'));
assert(pine.includes('math.min(DATA_CUTOFF, customAsOf ? math.min(requestedAsOf, chartClock) : chartClock)'));
assert(pine.includes('if barstate.islast'));
assert(pine.includes('drawn < maxLevels'));
assert(pine.includes('maxval = 400'));
assert(pine.includes('SNAPSHOT ONLY'));
for (const p of levels) assert(Number.isSafeInteger(p.availableAt));

// The export must reject unaccepted or tampered maps, not just filter bad rows.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-pine-'));
const file = path.join(fixture, 'map.json');
const body = JSON.stringify({ version: 1, key: 'fixture', symbol: 'HYPEUSDT', profiles: [] });
fs.writeFileSync(file, body);
fs.writeFileSync(path.join(fixture, 'complete.json'), JSON.stringify({ key: 'fixture', artifacts: [{ file: 'map.json', sha256: sha256(body) }] }));
assert.throws(() => readAcceptedMap(file), 'Missing independent receipt');
const acceptance = path.join(fixture, 'independent-verification.json');
fs.writeFileSync(acceptance, JSON.stringify({ passed: false, mapKey: 'fixture', mapSha256: sha256(body) }));
assert.throws(() => readAcceptedMap(file), /Independent acceptance required/);
fs.writeFileSync(acceptance, JSON.stringify({ passed: true, mapKey: 'wrong', mapSha256: sha256(body) }));
assert.throws(() => readAcceptedMap(file), /Independent acceptance required/);
fs.writeFileSync(acceptance, JSON.stringify({ passed: true, mapKey: 'fixture', mapSha256: sha256(body) }));
readAcceptedMap(file);
fs.appendFileSync(file, ' ');
assert.throws(() => readAcceptedMap(file), /Map hash mismatch/);
// Delete only the three explicit test files in our own fresh temporary directory.
for (const name of ['map.json', 'complete.json', 'independent-verification.json']) fs.unlinkSync(path.join(fixture, name));
fs.rmdirSync(fixture);

const statusCounts: Record<string, number> = {};
for (const level of levels) {
  const key = `${level.period}:${projectedStatus(level, map.end)}`;
  statusCounts[key] = (statusCounts[key] ?? 0) + 1;
}
console.log(JSON.stringify({ passed: true, profiles: levels.length, boundaryChecks, wholeMapQueries: 6,
  cutoff: new Date(map.end).toISOString(), statusCounts, pineBytes: Buffer.byteLength(pine),
  note: 'Data/timing/export checks only; compile and chart rendering require TradingView Pine Editor.' }, null, 2));
