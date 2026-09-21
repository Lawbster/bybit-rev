/** Export an accepted map, never rebuild tape/profiles. No live imports or network. */
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import type { Period, Profile } from './poc-profile-engine';

export interface PineLevel {
  period: Period; start: number; availableAt: number; center: string;
  retestKnownAt: number | null; uncertainKnownAt: number | null;
}
interface SavedMap {
  version: number; key: string; symbol: string; start: number; end: number;
  clock: string; publicationDelayMs: number; profiles: Profile[];
}
const PERIODS: Period[] = ['day', 'week', 'month'];
export const ROW_WIDTH = '0.1';
export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function readAcceptedMap(file: string): { map: SavedMap; mapSha: string } {
  const directory = path.dirname(file);
  const seal = JSON.parse(fs.readFileSync(path.join(directory, 'complete.json'), 'utf8'));
  const entry = seal.artifacts.find((p: { file: string }) => p.file === path.basename(file));
  assert(entry, 'Map must be in accepted manifest');
  const raw = fs.readFileSync(file);
  const mapSha = sha256(raw);
  assert.equal(mapSha, entry.sha256, 'Map hash mismatch');
  const map: SavedMap = JSON.parse(raw.toString('utf8'));
  assert.equal(map.version, 1); assert.equal(map.key, seal.key);
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'independent-verification.json'), 'utf8'));
  assert(receipt.passed && receipt.mapKey === map.key && receipt.mapSha256 === mapSha, 'Independent acceptance required');
  assert.equal(map.symbol, 'HYPEUSDT', 'This Pine template is HYPE-specific');
  return { map, mapSha };
}

export function selectLevels(map: SavedMap): PineLevel[] {
  const levels = map.profiles.filter(p => p.eligible && p.venue === 'bybit' && Number(p.width) === Number(ROW_WIDTH))
    .map(p => {
      assert.equal(p.symbol, map.symbol);
      assert(PERIODS.includes(p.period));
      assert(p.availableAt === p.end + map.publicationDelayMs);
      for (const ts of [p.start, p.end, p.availableAt, p.retestKnownAt, p.uncertainKnownAt])
        assert(ts === null || (Number.isSafeInteger(ts) && ts > 0 && ts <= map.end));
      assert(Number(p.center) > 0 && Math.abs(Number(p.upper) - Number(p.lower) - Number(ROW_WIDTH)) < 1e-8);
      assert(Math.abs((Number(p.upper) + Number(p.lower)) / 2 - Number(p.center)) < 1e-8);
      return { period: p.period, start: p.start, availableAt: p.availableAt, center: p.center,
        retestKnownAt: p.retestKnownAt, uncertainKnownAt: p.uncertainKnownAt };
    });
  levels.sort((a, b) => b.availableAt - a.availableAt || PERIODS.indexOf(b.period) - PERIODS.indexOf(a.period));
  assert(levels.length > 0, 'No eligible Bybit profiles');
  assert.equal(new Set(levels.map(p => `${p.period}:${p.start}`)).size, levels.length);
  return levels;
}

export function encodeLevels(levels: PineLevel[]): string[] {
  // Small chunks avoid large Pine loop bodies / single-string parser limits.
  const rows = levels.map(p => [PERIODS.indexOf(p.period), p.start, p.availableAt, p.center,
    p.retestKnownAt ?? 0, p.uncertainKnownAt ?? 0].join(','));
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += 40) chunks.push(rows.slice(i, i + 40).join(';'));
  return chunks;
}

export function decodeLevels(chunks: string[]): PineLevel[] {
  return chunks.flatMap(chunk => chunk.split(';').map(row => {
    const cells = row.split(','); assert.equal(cells.length, 6);
    const [period, start, availableAt, center, retest, uncertain] = cells;
    assert(PERIODS[Number(period)]);
    return { period: PERIODS[Number(period)], start: Number(start), availableAt: Number(availableAt), center,
      retestKnownAt: Number(retest) || null, uncertainKnownAt: Number(uncertain) || null };
  }));
}

/** Mirrors the overlay's time projection; tests compare to the canonical reader. */
export function projectedStatus(level: PineLevel, asOf: number): 'hidden' | 'tested' | 'uncertain' | 'untested' {
  if (level.availableAt > asOf) return 'hidden';
  if (level.retestKnownAt !== null && level.retestKnownAt <= asOf) return 'tested';
  if (level.uncertainKnownAt !== null && level.uncertainKnownAt <= asOf) return 'uncertain';
  return 'untested';
}

export function renderPine(map: SavedMap, mapSha: string, template: string): string {
  const levels = selectLevels(map);
  const fields: Record<string, string> = {
    MAP_KEY: map.key, MAP_SHA: mapSha, START_ISO: new Date(map.start).toISOString(),
    CUTOFF_ISO: new Date(map.end).toISOString(), CUTOFF: String(map.end), WIDTH: ROW_WIDTH,
    CUTOFF_LABEL: new Date(map.end).toISOString().slice(0, 16).replace('T', ' '),
    DELAY_MS: String(map.publicationDelayMs), LEVEL_COUNT: String(levels.length),
    // Pine CE10205 applies to the compiled local block, including these calls.
    // Keep each data-loading call in its own small first-bar block rather than
    // accumulating the entire payload and all parser calls inside one `if`.
    DATA_CHUNKS: encodeLevels(levels).map(chunk => `if barstate.isfirst\n    loadChunk("${chunk}")`).join('\n\n'),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, name: string) => {
    assert(name in fields, `Unknown template field ${name}`); return fields[name];
  });
}

export function exportPine(root = process.cwd()): void {
  const pointer = JSON.parse(fs.readFileSync(path.join(root, 'backtests/poc-viewers/latest.json'), 'utf8'));
  const mapFile = path.resolve(root, pointer.directory, 'map.json');
  const { map, mapSha } = readAcceptedMap(mapFile); assert.equal(pointer.key, map.key);
  const template = fs.readFileSync(path.join(root, 'scripts/templates/poc-map-overlay.pine'), 'utf8');
  const pine = renderPine(map, mapSha, template);
  const directory = path.join(root, 'tradingview'); fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, 'HYPE-Bybit-POC-map.pine');
  fs.writeFileSync(output, pine);
  const levels = selectLevels(map);
  const receipt = { mapKey: map.key, mapSha256: mapSha, templateSha256: sha256(template), pineSha256: sha256(pine),
    source: path.relative(root, mapFile).replace(/\\/g, '/'), start: map.start, cutoff: map.end, clock: map.clock,
    venue: 'bybit', symbol: map.symbol, width: ROW_WIDTH, levels: levels.length,
    periods: Object.fromEntries(PERIODS.map(period => [period, levels.filter(p => p.period === period).length])),
    snapshotOnly: true, tradingViewCompilationVerified: false };
  fs.writeFileSync(path.join(directory, 'HYPE-Bybit-POC-map.manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...receipt }, null, 2));
}

if (require.main === module) exportPine();
