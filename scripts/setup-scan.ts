/**
 * Setup scanner CLI. Research-only; no orders, no live state, no config edits.
 *
 *   npx ts-node scripts/setup-scan.ts list
 *   npx ts-node scripts/setup-scan.ts resolve "RF breaker"
 *   npx ts-node scripts/setup-scan.ts run --setup PA02 --symbol HYPEUSDT --from 2026-03-19 --to 2026-09-15 [--lag 60] [--tape auto|sealed|live|research] [--charts] [--param bufferPct=0.15]
 *   npx ts-node scripts/setup-scan.ts show PA02|<key>
 */
import fs from 'fs';
import path from 'path';
import { DETECTORS, detectorSources, resolveSetup } from './setup-detectors';
import { loadLibrary } from './setup-library';
import { H, ROOT, runScan, type ScanRequest } from './setup-scan-core';

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find(a => a.startsWith(`--${name}=`)); if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`); return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
}
const flag = (name: string) => process.argv.slice(2).includes(`--${name}`);
function parseWhen(v: string | undefined, fallback: number): number {
  if (!v || v === 'now') return fallback;
  const t = Date.parse(/T|Z|\+/.test(v) ? v : `${v}T00:00:00Z`);
  if (!Number.isFinite(t)) throw new Error(`invalid date: ${v}`);
  return t;
}
function latestLiveMinuteEnd(symbol: string): number {
  const file = path.join(ROOT, 'data', `${symbol}_1m.jsonl`);
  if (!fs.existsSync(file)) return Date.now();
  const fd = fs.openSync(file, 'r'); const size = fs.fstatSync(fd).size; const len = Math.min(size, 65536); const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len); fs.closeSync(fd);
  const lines = buf.toString('utf8').trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) { try { const r = JSON.parse(lines[i]); const ts = Number(r.ts ?? r.timestamp); if (Number.isFinite(ts)) return ts + 60_000; } catch { /* partial line */ } }
  return Date.now();
}

async function main() {
  const [command = 'list', ...rest] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (command === 'list') {
    for (const d of DETECTORS) console.log(`${d.id.padEnd(5)} ${d.version.padEnd(12)} ${d.title}\n      aliases: ${d.aliases.join(', ')}\n      card: ${d.libraryCard}`);
    console.log('\nLibrary IDs without a scanner: ' + loadLibrary(ROOT).records.filter(r => r.kind === 'entry' && !DETECTORS.some(d => d.id === r.id)).map(r => `${r.id} (${r.title})`).join('; '));
    return;
  }
  if (command === 'resolve') { console.log(JSON.stringify(resolveSetup(rest.join(' '), loadLibrary(ROOT)), (k, v) => k === 'detect' ? undefined : v, 2)); return; }
  if (command === 'show') {
    const what = rest[0] ?? '';
    const latest = fs.existsSync(path.join(ROOT, 'backtests/setup-scans/latest.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'backtests/setup-scans/latest.json'), 'utf8')) : {};
    const dir = latest[what.toUpperCase()]?.dir ?? `backtests/setup-scans/${what}`;
    const file = path.join(ROOT, dir, 'summary.md');
    if (!fs.existsSync(file)) throw new Error(`no scan summary at ${dir}; known: ${Object.keys(latest).join(', ') || 'none'}`);
    process.stdout.write(fs.readFileSync(file, 'utf8')); return;
  }
  if (command !== 'run') throw new Error('usage: setup-scan.ts list | resolve <query> | run --setup <id|alias> --symbol HYPEUSDT --from <date> [--to <date|now>] [--lag 60] [--tape auto|sealed|live|research] [--charts] [--max-charts 40] [--param k=v ...] | show <id|key>');
  const query = arg('setup'); if (!query) throw new Error('--setup is required');
  const res = resolveSetup(query, loadLibrary(ROOT));
  if (res.status === 'library_only') throw new Error(`${res.id} (${res.title}) is in the library but has no scanner yet. Implement scripts/setup-detectors/<id>.ts (see docs/research/setup-scan.md).`);
  if (res.status === 'unknown') throw new Error(`cannot resolve "${query}". Known: ${res.suggestions.join('; ')}`);
  const symbol = (arg('symbol') ?? 'HYPEUSDT').toUpperCase();
  const to = parseWhen(arg('to'), latestLiveMinuteEnd(symbol));
  const from = parseWhen(arg('from'), to - 182 * 24 * H);
  if (from >= to) throw new Error('from must precede to');
  const params: Record<string, number | string> = {};
  for (const a of process.argv.slice(2)) { const m = a.match(/^--param=?(.+?)=(.+)$/) ?? (a === '--param' ? null : null); if (m) { const n = Number(m[2]); params[m[1]] = Number.isFinite(n) ? n : m[2]; } }
  const args = process.argv.slice(2); for (let i = 0; i < args.length; i++) if (args[i] === '--param' && args[i + 1]) { const [k, v] = args[i + 1].split('='); if (k && v !== undefined) { const n = Number(v); params[k] = Number.isFinite(n) ? n : v; } }
  const req: ScanRequest = { setup: res.detector.id, symbol, from, to, lagMs: Number(arg('lag') ?? 60) * 1000, tape: (arg('tape') as ScanRequest['tape']) ?? 'auto', params: { ...res.detector.defaults, ...params }, charts: flag('charts'), maxChartEvents: Number(arg('max-charts') ?? 40) };
  const sources = detectorSources(res.detector);
  const t0 = Date.now();
  const result = await runScan(ROOT, res.detector, req, sources);
  console.log(JSON.stringify({ setup: res.detector.id, matchedBy: res.matchedBy, key: result.key, dir: path.relative(ROOT, result.dir).replace(/\\/g, '/'), reused: result.reused, events: result.events, confirmed: result.confirmed, seconds: +((Date.now() - t0) / 1000).toFixed(1), summary: path.relative(ROOT, path.join(result.dir, 'summary.md')).replace(/\\/g, '/') }, null, 2));
  if (!flag('quiet')) process.stdout.write('\n' + result.summary);
}

if (require.main === module) main().catch(e => { console.error(`[setup-scan] ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
