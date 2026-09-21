import * as assert from 'assert';
import { loadLibrary, validateLibrary, extractSection, searchRecords, runLibrary, SetupLibrary } from './setup-library';

const root = process.cwd();
const lib = loadLibrary(root);
const clone = (): SetupLibrary => JSON.parse(JSON.stringify(lib));
const checks = validateLibrary(root, lib);
assert.strictEqual(checks.records, 28);
assert.strictEqual(checks.sources, 20);
assert.ok(searchRecords(lib, 'BREAKER').some(r => r.id === 'PA02'));
assert.ok(searchRecords(lib, 'btc short').some(r => r.id === 'CTX01'));
assert.ok(searchRecords(lib, 'invalidation').some(r => r.id === 'EXIT01'));
assert.deepStrictEqual(searchRecords(lib, 'no-such-concept-123'), []);
assert.throws(() => searchRecords(lib, '  '), /at least one/);
const selected = runLibrary(root, ['show', 'pa02']);
assert.ok(selected.startsWith('## PA02 —'));
assert.ok(!selected.includes('## PA03 —'));
assert.ok(selected.includes('source_only'));
assert.throws(() => runLibrary(root, ['show', '../../.env']), /unknown setup/);
assert.throws(() => runLibrary(root, ['execute', 'PA02']), /usage/);
assert.throws(() => runLibrary(root, ['list', 'junk']), /usage/);
assert.strictEqual(extractSection('## PA01 — One\r\na\r\n## PA02 — Two\r\nb', 'PA01'), '## PA01 — One\na');
assert.throws(() => extractSection('## PA01 — A\n## PA01 — B', 'PA01'), /exactly one/);
assert.throws(() => extractSection('none', 'PA01'), /exactly one/);

function rejected(change: (x: SetupLibrary) => void, match: RegExp): void {
  const x = clone(); change(x); assert.throws(() => validateLibrary(root, x), match);
}
rejected(x => { x.records.push(x.records[0]); }, /duplicate\/invalid ID/);
rejected(x => { x.records[0].sourceRefs[0].pages = [9999]; }, /invalid source\/page/);
rejected(x => { x.records[0].sourceRefs[0].id = 'MISSING'; }, /invalid source\/page/);
rejected(x => { x.records[0].dependsOn = ['P-FUTURE']; }, /unknown primitive/);
rejected(x => { x.records[0].related = ['PA99']; }, /unknown\/self/);
rejected(x => { x.records[0].definitionStatus = 'proven'; }, /unsupported definition/);
rejected(x => { x.records[0].researchRefs[0].relation = 'direct'; }, /direct evidence needs exact study scope/);
// Synthetic metadata fixture only: validates references, not a real PA01 study.
const scoped = clone();
scoped.records[0].researchRefs[0].relation = 'direct';
scoped.records[0].researchRefs[0].scope = {
  definitionVersion: 'test-fixture', asset: 'TEST', venue: 'TEST', timeframe: '1h',
  windowStartUtcMs: 1000, windowEndUtcMs: 2000, card: lib.sourceCatalog,
  verification: lib.sourceCatalog, executionModel: 'fixture', baseline: 'fixture', screenVerdict: 'not_economic_evidence',
};
scoped.records[0].evidenceScope = 'scoped_studies';
assert.strictEqual(validateLibrary(root, scoped).records, 28);
scoped.records[0].researchRefs[0].scope!.windowEndUtcMs = 999;
assert.throws(() => validateLibrary(root, scoped), /invalid evidence window/);
rejected(x => { x.records[0].card = '.env'; }, /invalid card/);
rejected(x => { x.records[0].card = 'research/setup-library/../../../outside.md'; }, /path escapes/);
rejected(x => { x.records[0].title = 'Not the heading'; }, /heading\/title/);
rejected(x => { x.records[0].tags = []; }, /invalid tags/);
rejected(x => { x.records[0].evidenceScope = 'source_only'; }, /evidence scope/);
rejected(x => { x.records = x.records.filter(r => r.id !== 'PA06'); }, /unknown\/self|unindexed/);
console.log('setup-library tests passed: retrieval, provenance, page bounds, references, statuses and rejection cases. No economics executed.');
