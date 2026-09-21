/**
 * Setup ledger: a generated lookup of every setup-scanner replay and scan on disk, across symbols, with each run's
 * top cells scored against descriptive screens and a hand-kept status overlay. It exists so nobody re-runs a
 * definition that was already tried and so promising cells can be found again. Numbers are read from the
 * artifacts every time; they are never typed by hand. TESTED-SETUPS.md stays the curated register for frozen
 * cards; this ledger feeds it, it does not compete with it.
 *
 *   npx ts-node scripts/setup-ledger.ts build                 # writes research/setup-ledger.md and .json
 *   npx ts-node scripts/setup-ledger.ts lookup RS01 SOL       # print matching runs and their top cells
 *   npx ts-node scripts/setup-ledger.ts lookup lead           # by status
 *   options: --top 3   --root <dir>
 *
 * Status overlay: research/setup-ledger-notes.json  { runs: { "<replay key or prefix>": { status, note, by, date } } }
 * Statuses: exploratory (default) | lead | parked | falsified | control | card
 */
import fs from 'fs';
import path from 'path';
import { DETECTORS } from './setup-detectors';
import { ROOT, type Row } from './setup-scan-core';

export const SCREENS: { id: string; label: string }[] = [
  { id: 'fullPositive', label: 'full-window net > 0' },
  { id: 'stressPositive', label: 'net > 0 with +5 bps/side' },
  { id: 'bothWindows', label: 'older and recent windows both > 0' },
  { id: 'noBadMonths', label: 'no month below -$250' },
  { id: 'notConcentrated', label: 'net exceeds the top-5 winners' },
  { id: 'sample30', label: 'at least 30 trades' },
  { id: 'pf110', label: 'profit factor >= 1.10' },
  { id: 'delay60', label: 'net > 0 with 60s action delay' },
  { id: 'targetFirst', label: 'net > 0 under target-first ambiguity' },
];
export const STATUSES = ['exploratory', 'lead', 'parked', 'falsified', 'control', 'card'] as const;
export type Status = typeof STATUSES[number];

export interface CellSummary {
  cell: string; side: string; target: string; holdHours: number; n: number; wins: number; losses: number; winRate: number | null; net: number; stressNet: number;
  dd: number; pf: number; avgR: number; older: number | null; recent: number | null; worstMonth: number | null; badMonths: number; activeMonths: number;
  top5: number; delay60Net: number | null; targetFirstNet: number | null; screens: Record<string, boolean>; passed: number;
}
export interface RunSummary {
  key: string; dir: string; setup: string; version: string; symbol: string; from: number; to: number; createdAt: number;
  rows: string; entry: string; params: Record<string, number | string>; holds: number[]; targets: string[]; stopBufferPct: number; scanKey: string;
  events: number | null; cellsTotal: number; cellsPositive: number; cleanCells: number; best: CellSummary | null; bestBySide: Record<string, CellSummary | null>;
  top: CellSummary[]; status: Status; note: string; statusBy: string | null; statusDate: string | null;
}
export interface ScanSummary { key: string; setup: string; version: string; symbol: string; from: number; to: number; params: Record<string, number | string>; events: number; confirmed: number; long: number; short: number; replayed: string[]; createdAt: number }
export interface Ledger { generatedAt: number; screens: typeof SCREENS; runs: RunSummary[]; scans: ScanSummary[] }

const readJson = (f: string): Row => JSON.parse(fs.readFileSync(f, 'utf8')) as Row;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const money = (x: number | null) => x === null ? '-' : (x < 0 ? '-' : '+') + '$' + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (x: number) => x.toFixed(1) + '%';

/** Parameters that differ from the detector defaults, so a run's identity is readable. */
export function nonDefaultParams(setup: string, params: Record<string, number | string>): Record<string, number | string> {
  const d = DETECTORS.find(x => x.id === setup)?.defaults ?? {};
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(params)) if (String(d[k]) !== String(v)) out[k] = v;
  return out;
}

export function summariseCells(results: Row[], monthly: Row[], top = 3): { cells: CellSummary[]; positive: number; clean: number; best: CellSummary | null; bestBySide: Record<string, CellSummary | null> } {
  const prim = (x: Row) => Number(x.delay) === 0 && String(x.targetFirst) === 'false' && String(x.stress) === 'false';
  const full = results.filter(x => x.window === 'full' && prim(x));
  const find = (cell: string, f: (x: Row) => boolean) => results.find(x => x.cell === cell && f(x)) ?? null;
  const cells: CellSummary[] = full.map(x => {
    const cell = String(x.cell);
    const older = find(cell, y => y.window === 'older' && prim(y)), recent = find(cell, y => y.window === 'recent' && prim(y));
    const d60 = find(cell, y => y.window === 'full' && Number(y.delay) === 60000 && String(y.targetFirst) === 'false' && String(y.stress) === 'false');
    const tf = find(cell, y => y.window === 'full' && Number(y.delay) === 0 && String(y.targetFirst) === 'true' && String(y.stress) === 'false');
    const ms = monthly.filter(m => m.cell === cell && m.window === 'full' && Number(m.delay) === 0 && String(m.targetFirst) === 'false' && String(m.stress) === 'false');
    const active = ms.filter(m => Number(m.wins) + Number(m.losses) > 0);
    const bad = ms.filter(m => Number(m.markedNet) < -250).length;
    const worst = ms.length ? Math.min(...ms.map(m => Number(m.markedNet))) : null;
    const net = Number(x.net), stress = Number(x.stressNet), n = Number(x.n), pf = Number(x.profitFactor), top5 = Number(x.top5WinDollars ?? 0);
    const screens: Record<string, boolean> = {
      fullPositive: net > 0, stressPositive: stress > 0, bothWindows: !!older && !!recent && Number(older.net) > 0 && Number(recent.net) > 0,
      noBadMonths: bad === 0 && active.length > 0, notConcentrated: net > top5, sample30: n >= 30, pf110: pf >= 1.1,
      delay60: !!d60 && Number(d60.net) > 0, targetFirst: !!tf && Number(tf.net) > 0,
    };
    return {
      cell, side: String(x.side), target: String(x.target), holdHours: Number(x.holdHours), n, wins: Number(x.wins), losses: Number(x.losses),
      winRate: Number(x.wins) + Number(x.losses) > 0 ? Number(x.wins) / (Number(x.wins) + Number(x.losses)) : null, net, stressNet: stress,
      dd: Number(x.maxCloseDrawdownPct), pf, avgR: Number(x.avgR), older: older ? Number(older.net) : null, recent: recent ? Number(recent.net) : null,
      worstMonth: worst, badMonths: bad, activeMonths: active.length, top5, delay60Net: d60 ? Number(d60.net) : null, targetFirstNet: tf ? Number(tf.net) : null,
      screens, passed: Object.values(screens).filter(Boolean).length,
    };
  }).sort((a, b) => b.net - a.net);
  const bestBySide: Record<string, CellSummary | null> = {};
  for (const side of ['long', 'short']) bestBySide[side] = cells.find(c => c.side === side) ?? null;
  return { cells: cells.slice(0, top), positive: cells.filter(c => c.net > 0).length, clean: cells.filter(c => c.passed === SCREENS.length).length, best: cells[0] ?? null, bestBySide };
}

export function loadNotes(root: string): Row {
  const f = path.join(root, 'research/setup-ledger-notes.json');
  return fs.existsSync(f) ? readJson(f) : { runs: {} };
}

function noteFor(notes: Row, key: string): { status: Status; note: string; by: string | null; date: string | null } {
  const runs = (notes.runs ?? {}) as Record<string, Row>;
  const hit = Object.keys(runs).find(k => key.startsWith(k));
  const r = hit ? runs[hit] : null;
  const status = r && (STATUSES as readonly string[]).includes(String(r.status)) ? (String(r.status) as Status) : 'exploratory';
  return { status, note: r ? String(r.note ?? '') : '', by: r ? String(r.by ?? '') || null : null, date: r ? String(r.date ?? '') || null : null };
}

export function collectLedger(root: string, top = 3): Ledger {
  const notes = loadNotes(root);
  const replaysDir = path.join(root, 'backtests/setup-replays'), scansDir = path.join(root, 'backtests/setup-scans');
  const runs: RunSummary[] = [];
  const replayedBy = new Map<string, string[]>();
  if (fs.existsSync(replaysDir)) for (const d of fs.readdirSync(replaysDir)) {
    const dir = path.join(replaysDir, d); const planFile = path.join(dir, 'plan.json');
    if (!fs.existsSync(planFile) || !fs.existsSync(path.join(dir, 'results.json'))) continue;
    const plan = readJson(planFile); const cfg = (plan.cfg ?? {}) as Row; const scan = (plan.scan ?? {}) as Row;
    const scanKey = String(cfg.scanKey ?? ''); const scanPlanFile = path.join(scansDir, scanKey, 'plan.json');
    const scanPlan = fs.existsSync(scanPlanFile) ? readJson(scanPlanFile) : {};
    const params = (((scanPlan.request ?? {}) as Row).params ?? {}) as Record<string, number | string>;
    const scanSummaryFile = path.join(scansDir, scanKey, 'summary.json');
    const scanSummary = fs.existsSync(scanSummaryFile) ? readJson(scanSummaryFile) : {};
    const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')) as Row[];
    const monthlyFile = path.join(dir, 'monthly.json');
    const monthlyRaw = fs.existsSync(monthlyFile) ? JSON.parse(fs.readFileSync(monthlyFile, 'utf8')) : [];
    const monthly = (Array.isArray(monthlyRaw) ? monthlyRaw : Object.values(monthlyRaw)) as Row[];
    const s = summariseCells(results, monthly, top);
    const rowsFilter = cfg.rows as Row | undefined;
    const rows = rowsFilter && rowsFilter.stage && rowsFilter.stage !== 'confirmed' ? `${rowsFilter.stage}:${rowsFilter.reason ?? ''}` : 'confirmed';
    const setup = String(scan.setup ?? '?');
    const nd = nonDefaultParams(setup, params);
    const lim = cfg.entryLimit as { source?: string; model?: string; expiryHours?: number; offsetPct?: number } | undefined;
    const execution = lim ? `limit:${lim.source ?? 'sweep'}/${lim.model}/${lim.expiryHours}h${lim.offsetPct ? `/${lim.offsetPct}%` : ''}` : null;
    const scanEntry = String(params.entryMode ?? nd.entryMode ?? '-');
    const entry = execution ? (scanEntry === '-' ? execution : `${scanEntry} ${execution}`) : scanEntry;
    const n = noteFor(notes, String(plan.key ?? d));
    const status: Status = n.status === 'exploratory' && rows !== 'confirmed' ? 'control' : n.status;
    const createdAt = Number(plan.createdAt ?? plan.at ?? fs.statSync(planFile).mtimeMs);
    const events = scanSummary.confirmed !== undefined ? Number(rows === 'confirmed' ? scanSummary.confirmed : (s.best?.n ?? 0)) : null;
    runs.push({
      key: String(plan.key ?? d), dir: `backtests/setup-replays/${d}`, setup, version: String(scan.version ?? '?'), symbol: String(scan.symbol ?? '?'), from: Number(scan.from), to: Number(scan.to), createdAt,
      rows, entry, params: nd, holds: (cfg.holds ?? []) as number[], targets: (cfg.targets ?? []) as string[], stopBufferPct: Number(cfg.stopBufferPct ?? 0), scanKey,
      events, cellsTotal: results.filter(x => x.window === 'full' && Number(x.delay) === 0 && String(x.targetFirst) === 'false' && String(x.stress) === 'false').length,
      cellsPositive: s.positive, cleanCells: s.clean, best: s.best, bestBySide: s.bestBySide, top: s.cells, status, note: n.note, statusBy: n.by, statusDate: n.date,
    });
    replayedBy.set(scanKey, [...(replayedBy.get(scanKey) ?? []), String(plan.key ?? d).slice(0, 8)]);
  }
  const scans: ScanSummary[] = [];
  if (fs.existsSync(scansDir)) for (const d of fs.readdirSync(scansDir)) {
    const planFile = path.join(scansDir, d, 'plan.json'), sumFile = path.join(scansDir, d, 'summary.json');
    if (!fs.existsSync(planFile) || !fs.existsSync(sumFile)) continue;
    const plan = readJson(planFile), sum = readJson(sumFile); const req = (plan.request ?? {}) as Row;
    const setup = String(sum.setup ?? '?');
    scans.push({ key: d, setup, version: String(sum.version ?? '?'), symbol: String(sum.symbol ?? req.symbol ?? '?'), from: Number(sum.from ?? req.from), to: Number(sum.to ?? req.to), params: nonDefaultParams(setup, (req.params ?? {}) as Record<string, number | string>), events: Number(sum.events ?? 0), confirmed: Number(sum.confirmed ?? 0), long: Number(sum.long ?? 0), short: Number(sum.short ?? 0), replayed: replayedBy.get(d) ?? [], createdAt: Number(plan.createdAt ?? fs.statSync(planFile).mtimeMs) });
  }
  runs.sort((a, b) => a.setup.localeCompare(b.setup) || a.symbol.localeCompare(b.symbol) || a.rows.localeCompare(b.rows) || a.entry.localeCompare(b.entry) || a.createdAt - b.createdAt);
  scans.sort((a, b) => a.setup.localeCompare(b.setup) || a.symbol.localeCompare(b.symbol) || a.createdAt - b.createdAt);
  return { generatedAt: Date.now(), screens: SCREENS, runs, scans };
}

const paramStr = (p: Record<string, number | string>) => Object.entries(p).filter(([k]) => k !== 'entryMode').map(([k, v]) => `${k}=${v}`).join(', ') || 'defaults';
const winPct = (c: CellSummary) => c.winRate === null ? '-' : (c.winRate * 100).toFixed(0) + '%';
const cellRow = (c: CellSummary) => `| ${c.cell} | ${c.n} | ${c.wins}/${c.losses} | ${winPct(c)} | ${money(c.net)} | ${money(c.stressNet)} | ${pct(c.dd)} | ${c.pf.toFixed(2)} | ${money(c.older)} / ${money(c.recent)} | ${c.badMonths} of ${c.activeMonths} (${money(c.worstMonth)}) | ${money(c.top5)} | ${c.passed}/${SCREENS.length} |`;
const cellHead = `| Cell | Trades | W/L | Win % | Net | Stress | DD | PF | Older / recent | Months < −250 (worst) | Top-5 wins | Screens |\n|---|---|---|---|---|---|---|---|---|---|---|---|`;

export function renderLedger(l: Ledger): string {
  const out: string[] = [];
  out.push(`# Setup ledger: every scanner replay and scan, all symbols`, '',
    `Generated ${new Date(l.generatedAt).toISOString().slice(0, 16)} UTC by \`npx ts-node scripts/setup-ledger.ts build\`. **Do not edit by hand**; edit \`research/setup-ledger-notes.json\` for statuses and notes, then rebuild. Every number is read from \`backtests/setup-replays/<key>/\` and \`backtests/setup-scans/<key>/\`.`, '',
    `Purpose: know what has already been tried, on which symbol, with which conventions, and where the promising cells are, so nothing is re-run by accident and leads can be found again. It is a lookup of exploratory results, not a register of qualified setups: no run here has a frozen card unless its status says \`card\`. \`TESTED-SETUPS.md\` remains the curated register; a run is promoted there only when a card exists.`, '',
    `Primary clock everywhere: delay 0, stop-first, no stress, full window; $10k notional per trade, one position per cell, taker 0.055% per side, before funding. Cells are side × target × hold and the best cell is always selected after the fact. Screens are descriptive flags, not qualification:`, '',
    ...SCREENS.map((s, i) => `${i + 1}. ${s.label}`), '');

  // Cross-asset overview
  const symbols = [...new Set(l.runs.map(r => r.symbol))].sort();
  const families = [...new Set(l.runs.filter(r => r.rows === 'confirmed').map(r => `${r.setup}|${r.entry}|${paramStr(r.params)}|${r.stopBufferPct}`))];
  out.push(`## Cross-asset overview (confirmed rows only)`, '', `| Setup | Variant | ${symbols.map(s => `${s}: events · cells +ve · best cell · clean`).join(' | ')} |`, `|---|---|${symbols.map(() => '---').join('|')}|`);
  for (const f of families) {
    const [setup, entry, params, buf] = f.split('|');
    const cols = symbols.map(sym => {
      const r = l.runs.filter(x => x.rows === 'confirmed' && x.symbol === sym && x.setup === setup && x.entry === entry && paramStr(x.params) === params && String(x.stopBufferPct) === buf).sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!r) return 'not run';
      return `${r.events ?? '?'} · ${r.cellsPositive}/${r.cellsTotal} · ${r.best ? `${r.best.cell} ${money(r.best.net)} PF ${r.best.pf.toFixed(2)} win ${winPct(r.best)} n${r.best.n}` : '-'} · ${r.cleanCells}`;
    });
    out.push(`| ${setup} | ${entry === '-' ? '' : `entry ${entry}, `}${params}${buf !== '0' ? `, stop buffer ${buf}%` : ''} | ${cols.join(' | ')} |`);
  }
  out.push('');

  // Status board
  const byStatus = (st: Status) => l.runs.filter(r => r.status === st);
  out.push(`## Status board`, '');
  for (const st of STATUSES) {
    const rs = byStatus(st); if (!rs.length) continue;
    out.push(`**${st}** (${rs.length})`, '', ...rs.map(r => `- ${r.setup} ${r.symbol}${r.entry !== '-' ? ` entry ${r.entry}` : ''}${r.rows !== 'confirmed' ? ` rows ${r.rows}` : ''} \`${r.key.slice(0, 8)}\`${r.best ? `: best ${r.best.cell} ${money(r.best.net)} on ${r.best.n} trades, ${r.best.passed}/${SCREENS.length} screens` : ''}${r.note ? ` — ${r.note}` : ''}${r.statusBy ? ` (${r.statusBy}${r.statusDate ? ', ' + r.statusDate : ''})` : ''}`), '');
  }

  // Runs
  out.push(`## Runs`, '');
  let lastSetup = '';
  for (const r of l.runs) {
    if (r.setup !== lastSetup) { out.push(`### ${r.setup} (${r.version})`, ''); lastSetup = r.setup; }
    out.push(`#### ${r.symbol}${r.entry !== '-' ? ` · entry ${r.entry}` : ''}${r.rows !== 'confirmed' ? ` · rows ${r.rows}` : ''} · \`${r.key.slice(0, 8)}\``, '',
      `Window ${iso(r.from)} to ${iso(r.to)}; params ${paramStr(r.params)}${r.stopBufferPct ? `; stop buffer ${r.stopBufferPct}%` : ''}; targets ${r.targets.join('/')}; holds ${r.holds.join('/')}h; scan \`${r.scanKey.slice(0, 8)}\`; ${r.events ?? '?'} events; ${r.cellsPositive} of ${r.cellsTotal} cells positive; ${r.cleanCells} pass all screens. Status **${r.status}**${r.note ? `: ${r.note}` : ''}${r.statusBy ? ` (${r.statusBy}${r.statusDate ? ', ' + r.statusDate : ''})` : ''}.`, '');
    if (r.top.length) {
      out.push(cellHead, ...r.top.map(cellRow));
      for (const side of ['long', 'short']) { const b = r.bestBySide[side]; if (b && !r.top.some(c => c.cell === b.cell)) out.push(cellRow(b)); }
      out.push('');
    }
    out.push(`Artifacts: \`${r.dir}/report.md\`, \`chart.html\` beside it if generated.`, '');
  }

  // Scans
  out.push(`## Scans (occurrence ledgers, replayed or not)`, '', `| Setup | Symbol | Window | Params | Attempts | Confirmed (long/short) | Replays | Key |`, `|---|---|---|---|---|---|---|---|`);
  for (const s of l.scans) out.push(`| ${s.setup} | ${s.symbol} | ${iso(s.from)} to ${iso(s.to)} | ${paramStr(s.params)} | ${s.events} | ${s.confirmed} (${s.long}/${s.short}) | ${s.replayed.length ? s.replayed.map(k => `\`${k}\``).join(' ') : 'none'} | \`${s.key.slice(0, 8)}\` |`);
  out.push('', `## Before running anything`, '', `- Search this page for the setup and symbol. If the variant exists, read its run instead of re-running it; identical requests reuse the artifact folder anyway.`, `- A cell that passes all screens is still development data with the best cell chosen after the fact. The next step for a lead is a frozen card in \`research-inputs/\`, both windows, both clocks, its control rows, fixed-risk sizing beside fixed notional, and the monthly screen; then promotion to \`TESTED-SETUPS.md\`.`, `- Dollar figures across symbols share the notional and not the stop distance; compare R and screens across symbols, not dollars.`, '');
  return out.join('\n');
}

export function lookup(l: Ledger, terms: string[]): RunSummary[] {
  const t = terms.map(x => x.toLowerCase());
  return l.runs.filter(r => t.every(q => [r.setup, r.symbol, r.entry, r.rows, r.status, r.key, paramStr(r.params), r.note].join(' ').toLowerCase().includes(q)));
}

export function buildLedger(root: string, top = 3): { md: string; json: string; ledger: Ledger } {
  const ledger = collectLedger(root, top);
  const md = path.join(root, 'research/setup-ledger.md'), json = path.join(root, 'research/setup-ledger.json');
  fs.mkdirSync(path.dirname(md), { recursive: true });
  fs.writeFileSync(md, renderLedger(ledger));
  fs.writeFileSync(json, JSON.stringify(ledger, null, 1));
  return { md, json, ledger };
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const root = arg('root') ?? ROOT; const top = Number(arg('top') ?? 3);
  const cmd = argv.find(a => !a.startsWith('--') && a !== arg('root') && a !== arg('top')) ?? 'build';
  if (cmd === 'build') {
    const { md, json, ledger } = buildLedger(root, top);
    console.log(JSON.stringify({ md: path.relative(root, md), json: path.relative(root, json), runs: ledger.runs.length, scans: ledger.scans.length, symbols: [...new Set(ledger.runs.map(r => r.symbol))], byStatus: Object.fromEntries(STATUSES.map(s => [s, ledger.runs.filter(r => r.status === s).length])) }, null, 2));
  } else if (cmd === 'lookup') {
    const terms = argv.filter(a => !a.startsWith('--') && a !== 'lookup' && a !== arg('root') && a !== arg('top'));
    const ledger = collectLedger(root, top);
    const hits = lookup(ledger, terms);
    if (!hits.length) { console.log(`no runs match ${terms.join(' ')}; setups on file: ${[...new Set(ledger.runs.map(r => r.setup + ' ' + r.symbol))].join(', ')}`); process.exit(0); }
    for (const r of hits) {
      console.log(`${r.setup} ${r.symbol}${r.entry !== '-' ? ` entry ${r.entry}` : ''}${r.rows !== 'confirmed' ? ` rows ${r.rows}` : ''} ${r.key.slice(0, 8)} [${r.status}] ${iso(r.from)}..${iso(r.to)} params ${paramStr(r.params)} · ${r.cellsPositive}/${r.cellsTotal} cells +ve, ${r.cleanCells} clean${r.note ? ' · ' + r.note : ''}`);
      for (const c of r.top) console.log(`   ${c.cell.padEnd(28)} n ${String(c.n).padStart(3)} W/L ${(c.wins + '/' + c.losses).padEnd(7)} win ${winPct(c).padStart(4)} net ${money(c.net).padStart(8)} PF ${c.pf.toFixed(2)} DD ${pct(c.dd).padStart(6)} older/recent ${money(c.older)}/${money(c.recent)} bad months ${c.badMonths}/${c.activeMonths} screens ${c.passed}/${SCREENS.length}`);
    }
  } else { console.error('usage: setup-ledger.ts build | lookup <terms...> [--top N] [--root dir]'); process.exit(1); }
}
