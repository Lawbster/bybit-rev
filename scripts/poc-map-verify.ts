/** Independent artifact arithmetic/lifecycle audit (does not call the builder). */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson, inside } from './research-workflow';
import { decimal, format, DAY, readArchive, sha } from './poc-volume-source';
import { asOf, Profile, ProfileDay } from './poc-profile-engine';
import { ROOT, CARD } from './poc-history-ingest';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
async function main() {
  const dir = inside(ROOT, process.argv[2]), map = read(path.join(dir, 'map.json')), seal = read(path.join(dir, 'complete.json')), plan = read(path.join(dir, 'plan.json'));
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(dir, a.file)), a.sha256, 'Artifact changed ' + a.file);
  for (const p of plan.pins) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, 'Source pin changed');
  const dataPlan = read(path.join(ROOT, plan.data, 'complete.json'));
  assert.equal(await fileHash(path.join(ROOT, plan.data, 'complete.json')), plan.sourceManifestHash);
  const producer = read(path.join(ROOT, plan.data, 'plan.json'));
  assert.equal(sha(JSON.stringify({ card: producer.card, pins: producer.pins, runtime: producer.runtime })), producer.key, 'Producer definition identity');
  // A new profile grid may use the saved tape with a revised map card. The old
  // ingestion definition is retained in producer.card and its identity above.
  for (const p of producer.pins.filter((p: any) => p.file !== CARD)) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, 'Ingestion source/input changed');
  const expectedParts: Record<string, any> = Object.fromEntries(dataPlan.partitions.map((p: any) => [p.venue + ':' + p.date, p]));
  const days: Record<string, ProfileDay[]> = {};
  for (const venue of ['bybit', 'binance']) days[venue] = read(path.join(dir, venue + '-daily-index.json'));
  const repairReceipt = read(path.join(dir, 'comparison-repair.json')), repair = read(path.join(ROOT, repairReceipt.source));
  assert.equal(await fileHash(path.join(ROOT, repairReceipt.source)), repairReceipt.sourceSha256);
  const repairs = new Map<number, string>();
  for (const check of repairReceipt.checks) {
    const evidence = repair.evidence.find((e: any) => e.missingTs === check.ts); assert(evidence);
    const response = JSON.parse(evidence.minute.body), candle = response.result.list.find((r: any) => Number(r[0]) === check.ts); assert(candle);
    const original = read(path.join(ROOT, expectedParts['bybit:' + new Date(check.ts).toISOString().slice(0, 10)].file)).minutes.find((m: any) => m.ts === check.ts);
    assert.equal(original.quality, 'missing_candle'); assert.equal(original.qty, check.tapeBase); assert.equal(original.quote, check.tapeQuote);
    assert.equal(decimal(candle[5]), decimal(check.candleBase)); assert.equal(decimal(candle[6], 16), decimal(check.candleQuote, 16));
    const delta = decimal(candle[6], 16) - decimal(original.quote, 16);
    const baseExact = decimal(candle[5]) === decimal(original.qty), quoteWithin = delta <= 10000000000n && delta >= -10000000000n;
    assert.equal(check.baseExact, baseExact); assert.equal(check.quoteWithinTolerance, quoteWithin);
    const quality = !baseExact ? 'base_mismatch' : !quoteWithin ? 'quote_mismatch' : 'verified'; assert.equal(check.quality, quality); repairs.set(check.ts, quality);
  }
  for (const [venue, index] of Object.entries(days)) for (const d of index) {
    const part = expectedParts[venue + ':' + d.date]; assert.equal(await fileHash(path.join(ROOT, part.file)), part.sha256);
    const original = read(path.join(ROOT, part.file)); const qualities = new Map(original.minutes.map((m: any) => [m.ts, m.quality]));
    for (const m of d.minutes) assert.equal(m.quality, venue === 'bybit' && repairs.has(m.ts) ? repairs.get(m.ts) : qualities.get(m.ts), 'Undocumented quality substitution');
    if (d.start >= map.start && d.start + DAY <= map.end) assert.deepEqual(d.prices, original.prices, 'Daily native distribution changed');
  }
  let checked = 0, queries = 0, touchAudits = 0;
  // Cache independent period distributions so the three grids reuse source selection.
  for (const p of map.profiles as Profile[]) {
    const sources = days[p.venue].filter(d => d.start >= p.start && d.start < p.end); const buckets = new Map<bigint, bigint>(); const w = decimal(p.width);
    let volume = 0n; for (const d of sources) for (const x of d.prices) {
      const row = BigInt(x.p) - BigInt(x.p) % w, q = decimal(x.q); buckets.set(row, (buckets.get(row) ?? 0n) + q); volume += q;
    }
    assert.equal(format(volume), p.volume); let best = -1n, lower = -1n; const ties: bigint[] = [];
    for (const [row, q] of buckets) { if (q > best) { best = q; lower = row; ties.length = 0; ties.push(row); } else if (q === best) { if (row < lower) lower = row; ties.push(row); } }
    assert.equal(p.lower, format(lower)); assert.equal(p.upper, format(lower + w)); assert.equal(p.pocVolume, format(best));
    assert.deepEqual(p.tiedLower, ties.sort((a, b) => a < b ? -1 : 1).map(x => format(x)));
    assert.equal(p.verifiedMinutes, sources.reduce((n, d) => n + d.minutes.filter(m => m.quality === 'verified').length, 0));
    assert.equal(p.eligible, p.start >= map.start && p.end <= map.end && p.verifiedMinutes === p.expectedMinutes);
    assert.equal(p.availableAt, p.end + map.publicationDelayMs);
    if (p.eligible) {
      let first: number | null = null, uncertain: number | null = null;
      for (let t = p.end; t < map.end; t += DAY) {
        const d = days[p.venue].find(d => d.start === t);
        if (!d) { uncertain ??= t + 60000; continue; }
        for (const m of d.minutes) if (m.quality !== 'verified' && m.ts + 60000 <= map.end) { uncertain ??= m.ts + 60000; break; }
        for (const x of d.prices) if (BigInt(x.p) >= lower && BigInt(x.p) < lower + w && x.first < map.end) first = first === null ? x.first : Math.min(first, x.first);
        if (first !== null && Math.floor(first / 60000) * 60000 + 60000 <= map.end) break;
        first = null;
      }
      const known = first === null ? null : Math.floor(first / 60000) * 60000 + 60000;
      if (known !== null && uncertain !== null && uncertain > known) uncertain = null;
      assert.equal(p.firstObservedRetestAt, first); assert.equal(p.retestKnownAt, known); assert.equal(p.uncertainKnownAt, uncertain);
      for (const at of [p.availableAt - 1, p.availableAt, ...(known === null ? [] : [known - 1, known])].filter(t => t <= map.end)) {
        const r = asOf([p], at, map.end); queries++;
        if (at < p.availableAt) assert.equal(r.length, 0); else {
          assert.equal(r[0].observedRetestAt, known !== null && known <= at ? first : null);
          for (const k of ['firstObservedRetestAt', 'retestKnownAt', 'uncertainKnownAt', 'distribution']) assert(!(k in r[0]));
        }
      }
      // Deterministic sample from each venue/timeframe/grid. Verify recorded touch
      // against native minute histogram rather than the daily summary used above.
      if (known !== null && checked % 83 === 0) {
        const date = new Date(first!).toISOString().slice(0, 10), part = expectedParts[p.venue + ':' + date];
        const d = read(path.join(ROOT, part.file)); assert.equal(await fileHash(path.join(ROOT, d.histogram.file)), d.histogram.sha256);
        let hit: number | null = null;
        await readArchive(path.join(ROOT, d.histogram.file), 3221225472, l => { const b = JSON.parse(l), price = decimal(b.price);
          if (b.ts >= p.end && b.ts + 60000 <= map.end && price >= lower && price < lower + w) hit = hit === null ? b.firstTradeAt : Math.min(hit, b.firstTradeAt);
        }); assert.equal(hit, first); touchAudits++;
      }
    }
    checked++;
  }
  const result = { passed: true, mapKey: map.key, mapSha256: await fileHash(path.join(dir, 'map.json')), verifierSha256: await fileHash(__filename),
    profilesChecked: checked, boundaryQueries: queries, nativeHistogramTouchAudits: touchAudits, witnessedComparisonRepairs: repairs.size, protectedStrategyChanges: 0, verifiedAt: Date.now() };
  const output = path.join(dir, 'independent-verification.json'); assert(!fs.existsSync(output), 'Verification receipt already exists'); atomicJson(output, result); console.log(JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
