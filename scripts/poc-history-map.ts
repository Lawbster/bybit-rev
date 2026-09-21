import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT, CARD, fixed } from './poc-history-ingest';
import { ProfileDay, Profile, buildProfiles, asOf } from './poc-profile-engine';
import { renderPocViewer } from './poc-map-viewer';
import { decimal, format, readArchive, csv, DAY, sha } from './poc-volume-source';
import { fileHash, atomicJson, inside } from './research-workflow';
import { REPAIR_FILE, verifiedComparisonRepairs } from './poc-map-repair';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
export async function clippedDay(d: any, start: number, end: number): Promise<ProfileDay> {
  if (d.start >= start && d.start + DAY <= end) return { venue: d.venue, date: d.date, start: d.start, prices: d.prices, minutes: d.minutes.map((m: any) => ({ ts: m.ts, quality: m.quality })) };
  const prices = new Map<number, any>();
  assert.equal(await fileHash(path.join(ROOT, d.histogram.file)), d.histogram.sha256);
  await readArchive(path.join(ROOT, d.histogram.file), 3221225472, line => {
    const b = JSON.parse(line); if (b.ts < start || b.ts + 60000 > end) return; const p = fixed(b.price);
    let r = prices.get(p); if (!r) { r = { p, q: 0n, buy: 0n, n: 0, first: b.firstTradeAt, last: b.lastTradeAt }; prices.set(p, r); }
    r.q += decimal(b.baseQty); r.buy += decimal(b.buyQty); r.n += b.records; r.first = Math.min(r.first, b.firstTradeAt); r.last = Math.max(r.last, b.lastTradeAt);
  });
  return { venue: d.venue, date: d.date, start: d.start, prices: [...prices.values()].map(p => ({ ...p, q: format(p.q), buy: format(p.buy) })),
    minutes: d.minutes.filter((m: any) => m.ts >= start && m.ts + 60000 <= end).map((m: any) => ({ ts: m.ts, quality: m.quality })) };
}
function hourly(candles: Map<number, any>, start: number, end: number) {
  const bars = []; for (let t = Math.ceil(start / 3600000) * 3600000; t + 3600000 <= end; t += 3600000) {
    const rows = Array.from({ length: 60 }, (_, i) => candles.get(t + i * 60000)); if (rows.some(r => !r)) continue;
    bars.push({ t, end: t + 3600000, o: rows[0].o, h: Math.max(...rows.map(r => r.h)), l: Math.min(...rows.map(r => r.l)), c: rows[59].c });
  } return bars;
}
export async function main() {
  const jobArg = process.argv[2]; assert(jobArg, 'Pass backtests/poc-history-data/<key>'); const job = inside(ROOT, jobArg.replace(/\\/g, '/'));
  const plan = read(path.join(job, 'plan.json')), complete = read(path.join(job, 'complete.json')), card = read(path.join(ROOT, CARD));
  assert.equal(plan.key, complete.key); assert.equal(complete.partitions.length, plan.archives.length);
  assert.equal(card.symbol, plan.card.symbol, 'Map symbol must match source tape');
  assert(Date.parse(card.start) >= Date.parse(plan.card.start) && Date.parse(card.end) <= Date.parse(plan.card.end), 'Map window must be contained in saved dataset');
  assert(card.venues.every((v: string) => plan.card.venues.includes(v)), 'Venue must have audited partitions');
  const pins = [];
  for (const f of [CARD, 'scripts/poc-history-map.ts', 'scripts/poc-profile-engine.ts', 'scripts/poc-map-viewer.ts', 'scripts/poc-history-ingest.ts', 'scripts/poc-volume-source.ts', 'scripts/research-workflow.ts', 'scripts/poc-map-repair.ts', 'scripts/replay-candle-repair.ts', REPAIR_FILE]) pins.push({ file: f, sha256: await fileHash(path.join(ROOT, f)) });
  for (const p of plan.pins.filter((p: any) => p.file.startsWith('data/'))) assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, 'Candle source changed');
  const key = sha(JSON.stringify({ pins, source: await fileHash(path.join(job, 'complete.json')) })), out = path.join(ROOT, 'backtests/poc-history-map', key);
  assert(!fs.existsSync(out), 'Immutable map exists; use saved artifact instead'); fs.mkdirSync(out, { recursive: true });
  atomicJson(path.join(out, 'plan.json'), { key, data: jobArg, pins, sourceManifestHash: await fileHash(path.join(job, 'complete.json')), card, createdAt: Date.now() });
  const start = Date.parse(card.start), end = Date.parse(card.end), profiles: Profile[] = [], coverage: any[] = [], chart: Record<string, any[]> = {}, qualityIssues: any[] = [];
  const bybitCandles = new Map<number, any>();
  for (const f of ['data/HYPEUSDT_1_full.json', 'data/HYPEUSDT_1m.jsonl']) {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const r of f.endsWith('jsonl') ? raw.trim().split('\n').map(l => JSON.parse(l)) : JSON.parse(raw)) bybitCandles.set(r.timestamp ?? r.ts, { o: r.open ?? r.o, h: r.high ?? r.h, l: r.low ?? r.l, c: r.close ?? r.c, volume: r.volume ?? r.v, turnover: r.turnover ?? r.t });
  }
  const repair = verifiedComparisonRepairs(ROOT, bybitCandles, end), repaired = new Set(repair.inserts.map(r => r.ts));
  for (const r of repair.inserts) bybitCandles.set(r.ts, { o: r.open, h: r.high, l: r.low, c: r.close, volume: r.volume, turnover: r.turnover });
  const repairChecks: any[] = [];
  chart.bybit = hourly(bybitCandles, start, end);
  for (const venue of card.venues) {
    const days: ProfileDay[] = [], minuteChart = new Map<number, any>(); let rows = 0, bytes = 0, bins = 0;
    for (const part of complete.partitions.filter((p: any) => p.venue === venue)) {
      const f = path.join(ROOT, part.file); assert.equal(await fileHash(f), part.sha256, 'Partition hash changed'); const d = read(f);
      if (venue === 'bybit') for (const m of d.minutes) if (m.quality === 'missing_candle' && repaired.has(m.ts)) {
        const c = bybitCandles.get(m.ts), baseExact = decimal(m.qty) === decimal(String(c.volume)), delta = decimal(m.quote, 16) - decimal(String(c.turnover), 16);
        const quoteWithinTolerance = delta <= 10000000000n && delta >= -10000000000n;
        m.quality = !baseExact ? 'base_mismatch' : !quoteWithinTolerance ? 'quote_mismatch' : 'verified';
        repairChecks.push({ ts: m.ts, utc: new Date(m.ts).toISOString(), baseExact, quoteWithinTolerance, quality: m.quality, tapeBase: m.qty, tapeQuote: m.quote, candleBase: String(c.volume), candleQuote: String(c.turnover) });
      }
      days.push(await clippedDay(d, start, end)); rows += d.rows; bytes += d.raw.bytes; bins += d.histogramRows;
      const issues = new Map<number, any>();
      for (const m of d.minutes.filter((m: any) => m.quality !== 'verified' && m.ts >= start && m.ts + 60000 <= end)) {
        const c = venue === 'bybit' ? bybitCandles.get(m.ts) : null;
        const issue = { venue, date: d.date, at: m.ts, utc: new Date(m.ts).toISOString(), reason: m.quality, tapeBase: m.qty, tapeQuote: m.quote,
          candleBase: c?.volume === undefined ? null : String(c.volume), candleQuote: c?.turnover === undefined ? null : String(c.turnover), partition: part.file };
        qualityIssues.push(issue); issues.set(m.ts, issue);
      }
      if (venue === 'binance') {
        assert.equal(await fileHash(path.join(ROOT, d.candleSource.file)), d.candleSource.sha256); let header: string[] = [];
        await readArchive(path.join(ROOT, d.candleSource.file), 10000000, line => {
          const f = csv(line); if (!header.length) { header = f; return; } const r = Object.fromEntries(header.map((k, i) => [k, f[i]]));
          minuteChart.set(Number(r.open_time), { o: Number(r.open), h: Number(r.high), l: Number(r.low), c: Number(r.close) });
          const issue = issues.get(Number(r.open_time)); if (issue) { issue.candleBase = r.volume; issue.candleQuote = r.quote_volume; }
        });
      }
    }
    const ps = buildProfiles(days, { symbol: card.symbol, start, end, widths: [card.primaryRowWidth, ...card.diagnosticRowWidths], publicationDelayMs: card.publicationDelayMs }); profiles.push(...ps);
    const quality: Record<string, number> = {}; for (const d of days) for (const m of d.minutes) quality[m.quality] = (quality[m.quality] ?? 0) + 1;
    coverage.push({ venue, days: days.length, sourceTradeRows: rows, rawBytes: bytes, nativePriceMinuteBins: bins, quality,
      firstPartitionStart: days[0]?.start, lastPartitionStart: days.at(-1)?.start,
      firstObservedTradeAt: days.reduce((v, d) => d.prices.reduce((v, p) => Math.min(v, p.first), v), Infinity),
      lastObservedTradeAt: days.reduce((v, d) => d.prices.reduce((v, p) => Math.max(v, p.last), v), -Infinity) });
    atomicJson(path.join(out, venue + '-daily-index.json'), days); // compact reusable map input, without tape duplication
    if (venue === 'bybit') bybitCandles.clear();
    if (venue === 'binance') chart[venue] = hourly(minuteChart, start, end);
    console.log(`[PVM01 map] ${venue}: ${days.length} days, ${ps.filter(p => p.eligible).length} eligible profiles across 3 widths`);
  }
  const data = { version: 1, key, symbol: card.symbol, start, end, clock: card.clock, publicationDelayMs: card.publicationDelayMs, primaryRowWidth: format(decimal(card.primaryRowWidth)), coverage, profiles, candles: chart };
  atomicJson(path.join(out, 'map.json'), data);
  atomicJson(path.join(out, 'comparison-repair.json'), { source: REPAIR_FILE, sourceSha256: await fileHash(path.join(ROOT, REPAIR_FILE)), neighboursChecked: repair.neighboursChecked, native5mChecks: repair.native5mChecks, checks: repairChecks });
  atomicJson(path.join(out, 'quality-issues.json'), qualityIssues);
  fs.writeFileSync(path.join(out, 'map.html'), renderPocViewer(data), { flag: 'wx' });
  const now = asOf(profiles, end, end), fmt = (t: number | null) => t === null ? '' : new Date(t).toISOString();
  const events: any[] = [];
  for (const p of profiles.filter(p => p.eligible && p.availableAt <= end)) {
    events.push({ at: p.availableAt, type: 'publish', id: p.id, profile: asOf([p], p.availableAt, end)[0] });
    if (p.uncertainKnownAt !== null && p.uncertainKnownAt > p.availableAt && p.uncertainKnownAt <= end) events.push({ at: p.uncertainKnownAt, type: 'uncertain', id: p.id });
    if (p.retestKnownAt !== null && p.retestKnownAt > p.availableAt && p.retestKnownAt <= end) events.push({ at: p.retestKnownAt, type: 'observed_retest', id: p.id, tradeAt: p.firstObservedRetestAt,
      firstExact: !(p.uncertainKnownAt !== null && p.uncertainKnownAt <= p.retestKnownAt) });
  }
  events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id) || a.type.localeCompare(b.type));
  fs.writeFileSync(path.join(out, 'lifecycle.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n', { flag: 'wx' });
  const header = 'profile_date_utc,poc_price,row_lower,row_upper,venue,period,row_width,known_at_utc,status_at_cutoff,observed_retest_utc,first_retest_exact,base_volume,poc_volume,poc_share_pct';
  const csvRows = now.sort((a, b) => Number(b.center) - Number(a.center)).map(p => [fmt(p.start).slice(0, 10), p.center, p.lower, p.upper, p.venue, p.period, p.width, fmt(p.availableAt), p.status, fmt(p.observedRetestAt), p.firstRetestExact ?? '', p.volume, p.pocVolume, p.sharePct.toFixed(6)].join(','));
  fs.writeFileSync(path.join(out, 'register.csv'), header + '\n' + csvRows.join('\n') + '\n', { flag: 'wx' });
  atomicJson(path.join(out, 'excluded-profiles.json'), profiles.filter(p => !p.eligible).map(({ distribution, ...p }) => p));
  const counts = [];
  for (const venue of card.venues) for (const period of card.periods) for (const width of [card.primaryRowWidth, ...card.diagnosticRowWidths].map((w: string) => format(decimal(w)))) {
    const p = profiles.filter(p => p.venue === venue && p.period === period && p.width === width), n = now.filter(p => p.venue === venue && p.period === period && p.width === width);
    counts.push({ venue, period, width, total: p.length, eligible: p.filter(p => p.eligible).length, tested: n.filter(p => p.status === 'tested').length, untested: n.filter(p => p.status === 'untested').length, uncertain: n.filter(p => p.status === 'uncertain').length });
  }
  atomicJson(path.join(out, 'summary.json'), { key, coverage, counts, lifecycleEvents: events.length, hl: card.hl, strategyReplays: 0, liveChanges: 0 });
  const artifacts = []; for (const file of fs.readdirSync(out).sort()) artifacts.push({ file, sha256: await fileHash(path.join(out, file)), bytes: fs.statSync(path.join(out, file)).size });
  atomicJson(path.join(out, 'complete.json'), { key, completedAt: Date.now(), artifacts });
  const pointer = path.join(ROOT, 'backtests/poc-viewers'); fs.mkdirSync(pointer, { recursive: true });
  fs.copyFileSync(path.join(out, 'map.html'), path.join(pointer, 'hype-poc.html'));
  fs.copyFileSync(path.join(out, 'register.csv'), path.join(pointer, 'register.csv'));
  atomicJson(path.join(pointer, 'latest.json'), { key, directory: path.relative(ROOT, out).split(path.sep).join('/') });
  console.log(`[PVM01 map] COMPLETE ${out}`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
