/**
 * Build a research minute tape for a symbol: merge the local Bybit linear 1m sources under data/ and fill
 * whatever is still missing from Bybit's public kline endpoint (read-only, no keys, bounded by the same
 * fetcher the collector uses for repairs). Output goes to backtests/tapes/<SYMBOL>_1m.jsonl with a manifest;
 * nothing under data/ is touched and nothing runs on the VPS.
 *
 *   npx ts-node scripts/build-research-tape.ts --symbol SOLUSDT --from 2024-12-05 --to 2026-09-17 [--no-fetch] [--rps 4]
 *
 * Row format matches the collector stream ({ts,o,h,l,c,v,t}) plus `src` for provenance, so the scanner's
 * live-tape reader parses it unchanged. Local sources win over fetched rows; earlier sources win over later ones.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fetchCollectorRepair } from '../src/collector-repair-fetch';
import { M, ROOT, type Row } from './setup-scan-core';

export interface TapeRow { ts: number; o: number; h: number; l: number; c: number; v: number; t: number; src: string }
export type KlineFetcher = (symbol: string, interval: '1' | '5', start: number, end: number) => Promise<unknown>;

const valid = (r: TapeRow) => [r.o, r.h, r.l, r.c].every(x => Number.isFinite(x) && x > 0) && r.l <= Math.min(r.o, r.c) && r.h >= Math.max(r.o, r.c) && Number.isFinite(r.ts) && r.ts % M === 0;

export function localSources(root: string, symbol: string): string[] {
  return [`data/${symbol}_1_full.json`, `data/${symbol}_1.json`, `data/${symbol}_1m.jsonl`].filter(f => fs.existsSync(path.join(root, f)));
}

export function readLocalRows(file: string, src: string): TapeRow[] {
  const text = fs.readFileSync(file, 'utf8');
  const out: TapeRow[] = [];
  const push = (r: Row) => {
    const row: TapeRow = { ts: Number(r.ts ?? r.timestamp), o: Number(r.o ?? r.open), h: Number(r.h ?? r.high), l: Number(r.l ?? r.low), c: Number(r.c ?? r.close), v: Number(r.v ?? r.volume ?? 0), t: Number(r.t ?? r.turnover ?? 0), src };
    if (valid(row)) out.push(row);
  };
  if (file.endsWith('.jsonl')) { for (const line of text.split('\n')) { if (!line.trim()) continue; try { push(JSON.parse(line)); } catch { /* skip bad line */ } } }
  else { const j = JSON.parse(text); const arr = Array.isArray(j) ? j : (Object.values(j).find(v => Array.isArray(v)) as Row[] | undefined) ?? []; for (const r of arr) push(r as Row); }
  return out;
}

/** Parse a Bybit v5 kline response (newest first, string fields) into rows. */
export function parseKlines(resp: unknown, src = 'bybit-kline'): TapeRow[] {
  const r = resp as Row;
  if (!r || Number(r.retCode) !== 0) throw new Error(`kline response retCode ${r?.retCode} ${r?.retMsg ?? ''}`);
  const list = ((r.result as Row)?.list ?? []) as unknown[];
  const out: TapeRow[] = [];
  for (const item of list) {
    const a = item as string[];
    const row: TapeRow = { ts: Number(a[0]), o: Number(a[1]), h: Number(a[2]), l: Number(a[3]), c: Number(a[4]), v: Number(a[5] ?? 0), t: Number(a[6] ?? 0), src };
    if (valid(row)) out.push(row);
  }
  return out.sort((x, y) => x.ts - y.ts);
}

/** Contiguous missing minute runs inside [from, to). */
export function missingRuns(have: ReadonlySet<number>, from: number, to: number): { start: number; end: number; minutes: number }[] {
  const runs: { start: number; end: number; minutes: number }[] = [];
  let runStart: number | null = null;
  for (let t = from; t < to; t += M) {
    if (!have.has(t)) { if (runStart === null) runStart = t; }
    else if (runStart !== null) { runs.push({ start: runStart, end: t, minutes: (t - runStart) / M }); runStart = null; }
  }
  if (runStart !== null) runs.push({ start: runStart, end: to, minutes: (to - runStart) / M });
  return runs;
}

export async function buildResearchTape(args: {
  root: string; symbol: string; from: number; to: number; fetch: boolean; rps?: number; fetcher?: KlineFetcher; log?: (s: string) => void; outDir?: string;
}): Promise<{ file: string; manifest: Row }> {
  const { root, symbol, from, to } = args;
  if (!/^[A-Z0-9]{2,30}$/.test(symbol)) throw new Error(`bad symbol ${symbol}`);
  if (!(to > from) || from % M !== 0 || to % M !== 0) throw new Error('from/to must be minute-aligned with to > from');
  const log = args.log ?? (() => undefined);
  const fetcher: KlineFetcher = args.fetcher ?? ((s, i, a, b) => fetchCollectorRepair(s, i, a, b));
  const rps = args.rps ?? 4;
  const rows = new Map<number, TapeRow>();
  const sources: Row[] = [];
  let conflicts = 0;
  for (const rel of localSources(root, symbol)) {
    const file = path.join(root, rel);
    const local = readLocalRows(file, `local:${rel}`);
    let used = 0;
    for (const r of local) {
      if (r.ts < from || r.ts >= to) continue;
      const prior = rows.get(r.ts);
      if (prior) { if (prior.c !== r.c || prior.h !== r.h || prior.l !== r.l) conflicts++; continue; }
      rows.set(r.ts, r); used++;
    }
    sources.push({ file: rel, rowsRead: local.length, rowsUsed: used });
    log(`${rel}: ${local.length.toLocaleString()} rows, ${used.toLocaleString()} used`);
  }
  const before = missingRuns(new Set(rows.keys()), from, to);
  const fetched = { requests: 0, rows: 0, ranges: [] as Row[], errors: [] as string[] };
  if (args.fetch && before.length) {
    const wait = Math.ceil(1000 / rps);
    for (const run of before) {
      let cursor = run.start;
      while (cursor < run.end) {
        const chunkEnd = Math.min(run.end, cursor + 1000 * M);
        let got: TapeRow[] = []; let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          try { got = parseKlines(await fetcher(symbol, '1', cursor, chunkEnd - M)); ok = true; }
          catch (e) { fetched.errors.push(`${new Date(cursor).toISOString()}: ${(e as Error).message}`); await new Promise(r => setTimeout(r, wait * (attempt + 2))); }
        }
        fetched.requests++;
        let added = 0;
        for (const r of got) { if (r.ts >= cursor && r.ts < chunkEnd && !rows.has(r.ts)) { rows.set(r.ts, r); added++; } }
        fetched.rows += added;
        fetched.ranges.push({ start: cursor, end: chunkEnd, rows: added });
        cursor = chunkEnd;
        await new Promise(r => setTimeout(r, wait));
      }
      log(`fetched run ${new Date(run.start).toISOString().slice(0, 16)} to ${new Date(run.end).toISOString().slice(0, 16)} (${run.minutes.toLocaleString()} minutes)`);
    }
  }
  const after = missingRuns(new Set(rows.keys()), from, to);
  const sorted = [...rows.values()].sort((a, b) => a.ts - b.ts);
  const outDir = args.outDir ?? path.join(root, 'backtests/tapes');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${symbol}_1m.jsonl`);
  const body = sorted.map(r => JSON.stringify(r)).join('\n') + (sorted.length ? '\n' : '');
  fs.writeFileSync(file, body);
  const manifest: Row = {
    symbol, venue: 'Bybit linear perpetual, 1m klines (local collector/history files first, public v5 kline endpoint for the rest)',
    from, to, rows: sorted.length, expectedMinutes: (to - from) / M, coveragePct: Math.round(sorted.length / ((to - from) / M) * 10000) / 100,
    sources, conflictsBetweenLocalSources: conflicts, fetch: args.fetch ? fetched : 'disabled',
    gapsBeforeFetch: before.length, missingMinutesBeforeFetch: before.reduce((n, g) => n + g.minutes, 0),
    remainingGaps: after.slice(0, 50).map(g => ({ start: new Date(g.start).toISOString(), end: new Date(g.end).toISOString(), minutes: g.minutes })), remainingGapCount: after.length,
    remainingMissingMinutes: after.reduce((n, g) => n + g.minutes, 0),
    sha256: crypto.createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body), createdAt: Date.now(),
  };
  fs.writeFileSync(file.replace(/\.jsonl$/, '.manifest.json'), JSON.stringify(manifest, null, 2));
  return { file, manifest };
}

if (require.main === module) (async () => {
  const argv = process.argv.slice(2);
  const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const symbol = arg('symbol'); const from = Date.parse(arg('from') ?? ''); const to = Date.parse(arg('to') ?? '');
  if (!symbol || !Number.isFinite(from) || !Number.isFinite(to)) { console.error('usage: build-research-tape --symbol SOLUSDT --from YYYY-MM-DD --to YYYY-MM-DD [--no-fetch] [--rps 4]'); process.exit(1); }
  const t0 = Date.now();
  const res = await buildResearchTape({ root: ROOT, symbol, from, to, fetch: !argv.includes('--no-fetch'), rps: Number(arg('rps') ?? 4), log: s => console.error(`[tape] ${s}`) });
  const m = res.manifest;
  console.log(JSON.stringify({ file: path.relative(ROOT, res.file), rows: m.rows, coveragePct: m.coveragePct, fetch: typeof m.fetch === 'object' ? { requests: (m.fetch as Row).requests, rows: (m.fetch as Row).rows, errors: ((m.fetch as Row).errors as string[]).length } : m.fetch, remainingGaps: m.remainingGapCount, remainingMissingMinutes: m.remainingMissingMinutes, seconds: Math.round((Date.now() - t0) / 100) / 10 }, null, 2));
})().catch(e => { console.error((e as Error).message); process.exit(1); });
