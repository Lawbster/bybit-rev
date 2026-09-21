/** Supplemental check of PH01 price-path labels against accepted minute inputs. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { loadMinutes } from './relative-reversion-study';
import { fileHash, atomicJson } from './research-workflow';
const ROOT = path.resolve(__dirname, '..'), read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
async function main() {
  const out = path.resolve(ROOT, process.argv[2]), plan = read(path.join(out, 'plan.json')), c = plan.card;
  assert(read(path.join(out, 'independent-verification.json')).passed);
  const pb02 = read(path.resolve(ROOT, c.parent, 'plan.json')), pb01 = read(path.resolve(ROOT, pb02.card.parent, 'plan.json'));
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', Date.parse(c.end), pb01.card.repair), cs = loaded.candles;
  const byAt = new Map(cs.map(x => [x.ts, x])), es = read(path.join(out, 'events.json')), snapshots = read(path.join(out, 'pre-entry-trajectories.json'));
  let checkedMinutes = 0;
  for (const e of es) {
    let highest = -Infinity, lowest = Infinity;
    for (let at = e.entryAt; at < e.exitAt; at += 60000) {
      const x = byAt.get(at); assert(x); highest = Math.max(highest, x.high); lowest = Math.min(lowest, x.low); checkedMinutes++;
    }
    const expected = (p: number) => (p - e.entryPrice) / e.entryPrice * 100;
    assert(Math.abs(e.outcomePath.mfePct - expected(highest)) < 1e-8);
    assert(Math.abs(e.outcomePath.maePct - expected(lowest)) < 1e-8);
    for (const h of [1, 3]) assert(Math.abs(e.outcomePath[`return${h}hPct`] - expected(byAt.get(e.entryAt + h * 3600000)!.open)) < 1e-8);
    assert.equal(e.outcomePath.ralliedOnePct, highest >= e.entryPrice * 1.01);
  }
  for (const s of snapshots) {
    const close = byAt.get(s.asOf - 60000)!, old = byAt.get(s.asOf - 16 * 60000)!;
    assert(Math.abs(s.features.bybitReturn15Pct - (close.close - old.close) / old.close * 100) < 1e-8);
  }
  for (const pin of plan.pins.filter((p: any) => p.file.startsWith('data/') || p.file.endsWith('/repair.json'))) assert.equal(await fileHash(path.resolve(ROOT, pin.file)), pin.sha256);
  const receipt = { passed: true, key: plan.key, events: es.length, checkedMinutes, preEntryReturns: snapshots.length,
    note: 'Future paths are labels only, not entry features or a simulated TP policy.',
    scriptSha256: await fileHash(__filename), verifiedAt: Date.now() };
  assert(!fs.existsSync(path.join(out, 'path-verification.json')), 'Receipt already exists');
  atomicJson(path.join(out, 'path-verification.json'), receipt); console.log(JSON.stringify(receipt, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
