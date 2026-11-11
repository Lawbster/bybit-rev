import assert from 'assert/strict';
import { createRuntimeDiagnostics, diagnosticErrorFields, reportDiagnostic, sanitizeDiagnosticValue } from '../src/runtime-diagnostics';

let cases = 0;
function test(name: string, fn: () => void) {
  try { fn(); cases++; } catch (e) { throw new Error(name, { cause: e }); }
}
test('redacts known secrets before truncating, URLs, quoted fields and authorization', () => {
  const key = 'FIXTURE_DIAGNOSTIC_SECRET', previous = process.env[key], secret = 'fake-diagnostic-secret-987654';
  process.env[key] = secret;
  try {
    const text = sanitizeDiagnosticValue(`${'x'.repeat(4080)} ${secret}`);
    assert(!text.includes('fake-diagnostic')); assert(text.length <= 4096);
    const quoted = sanitizeDiagnosticValue(`{"token":"quoted value","password":'two words',"X-BAPI-SIGN":"signed-value","Cookie":"session=private-value"} Bearer abc123 https://example.invalid/secret api_key=abc456`);
    for (const value of ['quoted value', 'two words', 'abc123', 'example.invalid', 'abc456', 'signed-value', 'private-value']) assert(!quoted.includes(value));
    const e = Object.assign(new Error(`failed ${secret}`), { code: 'ETIMEDOUT', request: { arbitraryPrivateField: secret } });
    const fields = diagnosticErrorFields(e);
    assert.equal(fields.code, 'ETIMEDOUT'); assert(fields.stack.includes('at '));
    assert(!JSON.stringify(fields).includes(secret)); assert(!('request' in fields));
  } finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
});
test('hostile error getters and arbitrary objects cannot crash or dump request bodies', () => {
  const hostile = Object.defineProperty({}, 'message', { get() { throw Error('getter'); } });
  assert.equal(diagnosticErrorFields(hostile).message, 'uninspectable error');
  assert.equal(diagnosticErrorFields({ request: { secret: 'never serialize me' } }).message, '');
  assert.equal(diagnosticErrorFields('plain failure').message, 'plain failure');
});
test('numeric noise in one failure remains sampled once per minute and counted', () => {
  let at = 100_000; const lines: string[] = [];
  const log = createRuntimeDiagnostics('fixture', { clock: () => at, write: line => lines.push(line) });
  log('tick', Error('request timed out after 123ms'));
  for (let i = 0; i < 100; i++) { at++; log('tick', Error('request timed out after ' + i + 'ms')); }
  assert.equal(lines.length, 1); log('funding', Error('separate')); assert.equal(lines.length, 2);
  at = 159_999; log('tick', Error('request timed out after 999ms')); assert.equal(lines.length, 2);
  at = 160_000; log('tick', Error('request timed out after 777ms'));
  const row = JSON.parse(lines[2]); assert.equal(row.message, 'request timed out after 777ms'); assert.equal(row.suppressed, 101);
  assert.equal(row.origin, 'tick'); assert.equal(row.severity, 'error'); assert(lines.every(l => l.endsWith('\n')));
});
test('different message, name and code at the same origin are logged immediately', () => {
  const rows: any[] = [];
  const log = createRuntimeDiagnostics('fixture', { clock: () => 100_000, write: line => rows.push(JSON.parse(line)) });
  log('tick', Error('recurring account timeout 123'));
  log('tick', Error('recurring account timeout 456'));
  log('tick', TypeError('cannot read position'));
  log('tick', Error('cannot read position'));
  log('tick', Object.assign(Error('cannot read position'), { code: 'ETIMEDOUT' }));
  log('tick', Object.assign(Error('cannot read position'), { code: 'ECONNRESET' }));
  assert.equal(rows.length, 5); assert.equal(rows[1].name, 'TypeError');
  assert.equal(rows[4].code, 'ECONNRESET'); assert(rows.every(r => r.origin === 'tick' && !r.throttleOverflow));
});
test('redaction and bounded normalized prefixes prevent noisy signature growth', () => {
  const rows: any[] = [];
  const log = createRuntimeDiagnostics('fixture', { clock: () => 100_000, write: s => rows.push(JSON.parse(s)) });
  log('tick', Error('token=secret-one request 123 failed'));
  log('tick', Error('token=secret-two request 456 failed'));
  log('tick', Error('x'.repeat(160) + ' unique suffix one'));
  log('tick', Error('x'.repeat(160) + ' unique suffix two'));
  assert.equal(rows.length, 2); assert(!JSON.stringify(rows).includes('secret-'));
});
test('unbounded signatures share one overflow bucket within 32 keys; expired keys recycle', () => {
  let at = 100_000;
  const rows: any[] = [];
  const log = createRuntimeDiagnostics('fixture', { clock: () => at, write: s => rows.push(JSON.parse(s)) });
  for (let i = 0; i < 1000; i++) log('origin-' + i, Error('failed'));
  assert.equal(rows.length, 32); assert.equal(rows.at(-1).origin, 'origin-31'); assert(rows.at(-1).throttleOverflow);
  at += 60_000; log('tick', TypeError('new failure after expiry'));
  assert.equal(rows.length, 33); assert(!rows.at(-1).throttleOverflow);
  log('tick', TypeError('new failure after expiry')); assert.equal(rows.length, 33);
});
test('failed logging and invalid clock never escape into trading', () => {
  const log = createRuntimeDiagnostics('fixture', { write() { throw Error('disk down'); } });
  assert.doesNotThrow(() => log('tick', Error('original')));
  assert.doesNotThrow(() => reportDiagnostic(() => { throw Error('sink down'); }, 'tick', Error('original')));
  assert.doesNotThrow(() => createRuntimeDiagnostics('fixture', { clock: () => NaN, write() { assert.fail('invalid clock'); } })('tick', Error('bad')));
});
console.log(`runtime diagnostics tests passed (${cases} cases; no exchange calls)`);
