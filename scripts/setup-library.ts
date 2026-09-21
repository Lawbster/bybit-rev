import * as fs from 'fs';
import * as path from 'path';

// Local, read-only knowledge retrieval. No trading, network or replay imports.
export const INDEX = 'research/setup-library/index.json';
const KINDS = ['entry', 'context', 'modifier', 'target', 'exit', 'research_route'];
const RELATIONS = ['adjacent', 'family_route', 'direct'];
const LIMIT = 512 * 1024;
export interface SetupRecord {
  id: string; title: string; kind: string; definitionStatus: string; evidenceScope: string;
  directions: string[]; tags: string[]; dependsOn: string[]; related: string[];
  card: string; section: string;
  sourceRefs: { id: string; pages: number[] }[];
  researchRefs: { study: string; path: string; relation: string; scope?: {
    definitionVersion: string; asset: string; venue: string; timeframe: string;
    windowStartUtcMs: number; windowEndUtcMs: number; card: string; verification: string;
    executionModel: string; baseline: string; screenVerdict: string;
  } }[];
}
export interface SetupLibrary {
  version: number; sourceCatalog: string; master: string; primitives: string;
  template: string; evidenceRegister: string; records: SetupRecord[];
}

function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function inside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function read(root: string, relative: string): string {
  requireValue(typeof relative === 'string' && !path.isAbsolute(relative), 'expected repo-relative document path');
  requireValue(/^(research|research-inputs|backtests)\//.test(relative) && /\.(md|json)$/.test(relative), `unsupported document: ${relative}`);
  const base = fs.realpathSync(root), resolved = path.resolve(base, relative);
  requireValue(inside(resolved, base), `path escapes repository: ${relative}`);
  const real = fs.realpathSync(resolved);
  requireValue(inside(real, base), `document redirects outside repository: ${relative}`);
  const stat = fs.statSync(real);
  requireValue(stat.isFile() && stat.size <= LIMIT, `document exceeds read limit: ${relative}`);
  return fs.readFileSync(real, 'utf8').replace(/^\uFEFF/, '');
}
export function loadLibrary(root: string): SetupLibrary {
  return JSON.parse(read(root, INDEX));
}
export function extractSection(text: string, id: string): string {
  requireValue(/^[A-Z]+[0-9]{2}$/.test(id), `invalid setup ID: ${id}`);
  const lines = text.split(/\r?\n/);
  const starts = lines.map((line, i) => line.startsWith(`## ${id} — `) ? i : -1).filter(i => i >= 0);
  requireValue(starts.length === 1, `expected exactly one section for ${id}`);
  const start = starts[0];
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ')) end++;
  return lines.slice(start, end).join('\n').trim();
}

/** Reference/schema checks only. Does not validate source claims or economics. */
export function validateLibrary(root: string, lib: SetupLibrary): { records: number; sources: number; note: string } {
  requireValue(lib?.version === 1 && Array.isArray(lib.records) && lib.records.length > 0, 'invalid library version/records');
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0);
  const catalog = JSON.parse(read(root, lib.sourceCatalog));
  requireValue(Array.isArray(catalog.documents), 'invalid source catalogue');
  const sources = new Map<string, number>();
  for (const s of catalog.documents) {
    requireValue(typeof s.id === 'string' && !sources.has(s.id), 'duplicate/invalid source ID');
    requireValue(Number.isInteger(s.pages) && s.pages > 0 && /^[0-9a-f]{64}$/.test(s.sha256), `invalid source metadata: ${s.id}`);
    sources.set(s.id, s.pages);
  }
  requireValue(catalog.documentCount === sources.size && catalog.physicalPageCount === [...sources.values()].reduce((a, b) => a + b, 0), 'source totals mismatch');
  for (const ref of [lib.master, lib.template, lib.evidenceRegister]) read(root, ref);
  const primitiveText = read(root, lib.primitives);
  const primitives = new Set([...primitiveText.matchAll(/^\| (P-[A-Z]+) \|/gm)].map(m => m[1]));
  requireValue(primitives.size > 0, 'no primitive definitions');
  const ids = new Set<string>(), bodies = new Map<string, string>();
  for (const r of lib.records) {
    requireValue(r && /^[A-Z]+[0-9]{2}$/.test(r.id) && !ids.has(r.id), `duplicate/invalid ID: ${r?.id}`);
    ids.add(r.id);
    requireValue(typeof r.title === 'string' && r.title.length > 0 && KINDS.includes(r.kind), `invalid title/kind: ${r.id}`);
    const family = r.kind === 'research_route';
    requireValue(r.definitionStatus === (family ? 'family_index' : 'concept'), `unsupported definition status: ${r.id}`);
    requireValue(strings(r.directions) && r.directions.length > 0 && r.directions.every(x => ['long', 'short'].includes(x)), `invalid directions: ${r.id}`);
    requireValue(strings(r.tags) && r.tags.length > 0 && new Set(r.tags).size === r.tags.length, `invalid tags: ${r.id}`);
    requireValue(strings(r.dependsOn) && r.dependsOn.every(x => primitives.has(x)), `unknown primitive: ${r.id}`);
    requireValue(strings(r.related), `invalid related IDs: ${r.id}`);
    requireValue(r.section === r.id && typeof r.card === 'string' && r.card.startsWith('research/setup-library/') && r.card.endsWith('.md'), `invalid card: ${r.id}`);
    if (!bodies.has(r.card)) bodies.set(r.card, read(root, r.card));
    const section = extractSection(bodies.get(r.card)!, r.section);
    requireValue(section.split('\n')[0] === `## ${r.id} — ${r.title}`, `heading/title mismatch: ${r.id}`);
    requireValue(Array.isArray(r.sourceRefs) && Array.isArray(r.researchRefs), `missing provenance: ${r.id}`);
    requireValue(family ? r.researchRefs.length > 0 : r.sourceRefs.length > 0, `no source/evidence: ${r.id}`);
    for (const ref of r.sourceRefs) {
      const pages = sources.get(ref.id);
      requireValue(pages && Array.isArray(ref.pages) && ref.pages.length > 0 && ref.pages.every(p => Number.isInteger(p) && p >= 1 && p <= pages), `invalid source/page: ${r.id}/${ref.id}`);
    }
    for (const ref of r.researchRefs) {
      requireValue(typeof ref.study === 'string' && ref.study.length > 0 && RELATIONS.includes(ref.relation), `invalid evidence relation: ${r.id}`);
      requireValue(family ? ref.relation === 'family_route' : ref.relation !== 'family_route', `wrong evidence relation: ${r.id}`);
      if (ref.relation === 'direct') {
        const s = ref.scope;
        requireValue(s && [s.definitionVersion, s.asset, s.venue, s.timeframe, s.executionModel, s.baseline, s.screenVerdict].every(x => typeof x === 'string' && x.trim().length > 0), `direct evidence needs exact study scope: ${r.id}`);
        requireValue(Number.isSafeInteger(s.windowStartUtcMs) && Number.isSafeInteger(s.windowEndUtcMs) && s.windowStartUtcMs > 0 && s.windowEndUtcMs > s.windowStartUtcMs, `invalid evidence window: ${r.id}`);
        read(root, s.card); read(root, s.verification);
      }
      read(root, ref.path);
    }
    requireValue(r.evidenceScope === (family ? 'linked_research' : r.researchRefs.some(x => x.relation === 'direct') ? 'scoped_studies' : r.researchRefs.length ? 'adjacent_studies' : 'source_only'), `evidence scope mismatch: ${r.id}`);
  }
  for (const r of lib.records) requireValue(r.related.every(id => id !== r.id && ids.has(id)), `unknown/self related ID: ${r.id}`);
  for (const text of bodies.values()) {
    for (const m of text.matchAll(/^## ([A-Z]+[0-9]{2}) — /gm)) requireValue(ids.has(m[1]), `unindexed definition: ${m[1]}`);
  }
  return { records: ids.size, sources: sources.size, note: 'Reference/schema checks only; no source hash, causality, implementation or economic verification.' };
}
export function searchRecords(lib: SetupLibrary, query: string): SetupRecord[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  requireValue(terms.length > 0, 'search needs at least one term');
  return lib.records.filter(r => {
    const hay = [r.id, r.title, r.kind, ...r.tags, ...r.directions, ...r.dependsOn].join(' ').toLowerCase();
    return terms.every(term => hay.includes(term));
  });
}
function summary(records: SetupRecord[]): string {
  return records.map(r => `${r.id} | ${r.kind} | ${r.title} | ${r.evidenceScope}`).join('\n');
}
export function runLibrary(root: string, args: string[]): string {
  const lib = loadLibrary(root);
  const checks = validateLibrary(root, lib);
  const [command = 'list', ...rest] = args;
  if (command === 'validate' && !rest.length) return JSON.stringify(checks, null, 2);
  if (command === 'list' && !rest.length) return summary(lib.records);
  if (command === 'search' && rest.length) {
    const found = searchRecords(lib, rest.join(' '));
    return found.length ? summary(found) : 'No matches. Search is metadata-only; try a mechanism/tag or inspect the tested register.';
  }
  if (command === 'show' && rest.length === 1) {
    const r = lib.records.find(r => r.id === rest[0].toUpperCase());
    requireValue(r, `unknown setup ID: ${rest[0]}`);
    const body = extractSection(read(root, r.card), r.section);
    return `${body}\n\nMetadata / references (not proof of efficacy):\n${JSON.stringify(r, null, 2)}`;
  }
  throw new Error('usage: ts-node scripts/setup-library.ts list | search <terms> | show <ID> | validate');
}
if (require.main === module) {
  try {
    const output = runLibrary(process.cwd(), process.argv.slice(2)) + '\n';
    requireValue(Buffer.byteLength(output, 'utf8') <= 24 * 1024, 'output too large; narrow the query');
    process.stdout.write(output);
  } catch (error) {
    process.stderr.write(`setup-library: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
