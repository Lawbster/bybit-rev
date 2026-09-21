/** Load once per replay; this API returns projected historical state, not future lifecycle fields. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { createReader } from './poc-profile-engine';
import { fileHash } from './research-workflow';
export async function openPocMap(file: string) {
  const directory = path.dirname(file), seal = JSON.parse(fs.readFileSync(path.join(directory, 'complete.json'), 'utf8'));
  const entry = seal.artifacts.find((p: any) => p.file === path.basename(file)); assert(entry, 'Map is not in accepted manifest');
  assert.equal(await fileHash(file), entry.sha256, 'Map hash mismatch'); const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(map.version, 1); assert.equal(map.key, seal.key);
  const verification = JSON.parse(fs.readFileSync(path.join(directory, 'independent-verification.json'), 'utf8'));
  assert(verification.passed && verification.mapKey === map.key && verification.mapSha256 === entry.sha256, 'Independent map acceptance required');
  const reader = createReader(map.profiles, map.end);
  return { symbol: map.symbol as string, start: map.start as number, cutoff: map.end as number, identity: map.key as string,
    clock: map.clock as string, at: reader.at, nakedAt: reader.nakedAt };
}
