import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { openPocMap } from './poc-map-reader';
import { sha } from './poc-volume-source';
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-reader-')), file = path.join(dir, 'map.json');
  const body = JSON.stringify({ version: 1, key: 'fixture', symbol: 'TEST', start: 0, end: 100, clock: 'fixture', profiles: [] });
  fs.writeFileSync(file, body); fs.writeFileSync(path.join(dir, 'complete.json'), JSON.stringify({ key: 'fixture', artifacts: [{ file: 'map.json', sha256: sha(body) }] }));
  await assert.rejects(() => openPocMap(file));
  const receipt = path.join(dir, 'independent-verification.json');
  fs.writeFileSync(receipt, JSON.stringify({ passed: false, mapKey: 'fixture', mapSha256: sha(body) })); await assert.rejects(() => openPocMap(file));
  fs.writeFileSync(receipt, JSON.stringify({ passed: true, mapKey: 'other', mapSha256: sha(body) })); await assert.rejects(() => openPocMap(file));
  fs.writeFileSync(receipt, JSON.stringify({ passed: true, mapKey: 'fixture', mapSha256: 'wrong' })); await assert.rejects(() => openPocMap(file));
  fs.writeFileSync(receipt, JSON.stringify({ passed: true, mapKey: 'fixture', mapSha256: sha(body) }));
  const r = await openPocMap(file); assert.deepEqual(r.at(100), []); assert.deepEqual(r.nakedAt(100), []); assert.throws(() => r.at(101));
  fs.appendFileSync(file, ' '); await assert.rejects(() => openPocMap(file));
  console.log('POC reader acceptance tests passed: missing/failed/mismatched receipts, hash mutation, accepted queries and cutoff rejection');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
