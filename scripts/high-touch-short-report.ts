import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { ROOT } from './level-playbook-study';
import { csv } from './poc-bounce-study';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const n = (x: number | null) => x === null ? '-' : Math.round(x).toLocaleString('en-US'), f = (x: number | null) => x === null ? '-' : x.toFixed(2);
export function main() {
  const latest = read('backtests/high-touch-short/latest.json'); assert(latest.accepted);
  const dir = latest.directory, out = path.join(ROOT, 'backtests/high-touch-short-reports', latest.key);
  assert(!fs.existsSync(out), 'Read saved report'); fs.mkdirSync(out, { recursive: true });
  const rows: Row[] = read(dir + '/results.json'), ranks: Row[] = read(dir + '/ranking.json'), groups = read(dir + '/signal-summary.json');
  const row = (id: string, window = 'full', delay = 0) => rows.find(r => r.id === id && r.window === window && r.delay === delay && !r.targetFirst)!;
  const run = (r: Row) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString('utf8'));
  const grid = ranks.filter(r => r.tpPct !== null), best = groups.map((g: Row) => grid.find(r => r.group === g.id));
  const highestRate = grid.filter(r => r.full.trades >= 30 && r.older.trades >= 10 && r.recent.trades >= 10).sort((a, b) => b.full.winRate - a.full.winRate)[0];
  const selected = [...new Set([...groups.flatMap((g: Row) => [g.id + '__timed', g.id + '__tp2_sl2']), ...best.map((r: Row) => r.id), highestRate.id, ...grid.slice(0, 5).map(r => r.id)])] as string[];
  let md = '# HT01: two-day-high standalone short\n\nFull Dec5,2024 12:55 to Sep15,2026 20:20 UTC. Recent June1 onward. Fixed10k,fees0.055%/side,before funding,DD32k initial equity. All variants12h maxhold. No POC/HL/ladder inputs.\n\n';
  md += '|Entry|Raw qualifying minutes|Contiguous qualifying episodes|\n|---|---:|---:|\n';
  for (const g of groups) md += `|${g.id}|${n(g.rawSignals)}|${n(g.episodes)}|\n`;
  md += '\n|Setup|W/L|Win rate|Winning $|Losing $|Avg loss|Net|DD|Recent net|TP/SL/timeout|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|\n';
  for (const id of selected) { const r = row(id); md += `|${id}|${r.wins}/${r.losses}|${f(r.winRate * 100)}%|${n(r.winningDollars)}|${n(r.losingDollars)}|${n(r.avgLoss)}|${n(r.net)}|${f(r.maxAdverseDrawdownPct)}%|${n(row(id, 'recent').net)}|${r.targets}/${r.stops}/${r.timeouts}|\n`; }
  md += `\n100 new definitions; ${ranks.filter(r => r.pass).length} complete-screen passes; ${ranks.filter(r => r.passesRelative).length} relative passes. Best rows selected in-sample; no holdout or live qualification.\n`;
  for (const id of selected) {
    const r = row(id), own = run(r), baseline = run(row(r.group + '__timed'));
    md += `\n## ${id}\n\n|Window|Timed baseline net/DD|Own2/2 net|Selected net/DD|W/L|Extra60s net/DD|Stressed net/extra60s|\n|---|---|---:|---|---|---|---|\n`;
    for (const w of ['full', 'older', 'recent']) { const x = row(id, w), d = row(id, w, 60000), b = row(r.group + '__timed', w), two = row(r.group + '__tp2_sl2', w);
      md += `|${w}|${n(b.net)}/${f(b.maxAdverseDrawdownPct)}%|${n(two.net)}|${n(x.net)}/${f(x.maxAdverseDrawdownPct)}%|${x.wins}/${x.losses}|${n(d.net)}/${f(d.maxAdverseDrawdownPct)}%|${n(x.stressNet)}/${n(d.stressNet)}|\n`; }
    md += '\n|Month|Timed baseline|Selected net|Delta|W/L|Winning $|Losing $|\n|---|---:|---:|---:|---|---:|---:|\n';
    for (const m of own.monthly) { const b = baseline.monthly.find((x: Row) => x.month === m.month); md += `|${m.month}|${n(b.markedNet)}|${n(m.markedNet)}|${n(m.markedNet - b.markedNet)}|${m.wins}/${m.losses}|${n(m.winningDollars)}|${n(m.losingDollars)}|\n`; }
    fs.writeFileSync(path.join(out, `trades-${id}.csv`), csv(own.trades.map((t: Row) => ({ ...t, evidence: undefined,
      signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
  }
  md += '\n## Complete ranking\n\n|Setup|Net|DD|Recent net|Failures|\n|---|---:|---:|---:|---|\n';
  for (const r of ranks) md += `|${r.id}|${n(r.full.net)}|${f(r.full.maxAdverseDrawdownPct)}%|${n(r.recent.net)}|${r.failures.join(',')}|\n`;
  fs.writeFileSync(path.join(out, 'review.md'), md);
  let matrices = '# HT01 TP/SL grids\n\nFull net / recent net / full win rate.12h cap on every cell. No POC or shared-account simulation.\n';
  for (const g of groups) { matrices += `\n## ${g.id}\n\n|TP / SL|2|2.5|3|3.5|4|4.5|5|\n|---|---|---|---|---|---|---|---|\n`;
    for (const tp of [2, 2.5, 3, 3.5, 4, 4.5, 5]) matrices += `|${tp}|` + [2, 2.5, 3, 3.5, 4, 4.5, 5].map(sl => {
      const id = `${g.id}__tp${tp}_sl${sl}`, r = row(id); return `${n(r.net)} / ${n(row(id, 'recent').net)} / ${f(r.winRate * 100)}%`; }).join('|') + '|\n'; }
  fs.writeFileSync(path.join(out, 'grids.md'), matrices);
  fs.writeFileSync(path.join(out, 'selection.json'), JSON.stringify({ bestByGroup: best.map((r: Row) => r.id), highestRate: highestRate.id, topFiveGrid: grid.slice(0, 5).map(r => r.id), selected }, null, 2));
  console.log(out);
}
if (require.main === module) main();
