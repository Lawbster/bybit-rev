import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { ROOT } from './level-playbook-study';
import { csv } from './poc-bounce-study';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const n = (x: number | null) => x === null ? '-' : Math.round(x).toLocaleString('en-US');
const f = (x: number | null) => x === null ? '-' : x.toFixed(2);
export function main() {
  const latest = read('backtests/poc-exit-cap/latest.json'); assert(latest.accepted);
  const dir = latest.directory, out = path.join(ROOT, 'backtests/poc-exit-cap-reports', latest.key);
  assert(!fs.existsSync(out), 'Read existing reports'); fs.mkdirSync(out, { recursive: true });
  const rows: Row[] = read(dir + '/results.json'), ranks: Row[] = read(dir + '/ranking.json');
  const row = (id: string, w = 'full', delay = 0) => rows.find(r => r.id === id && r.window === w && r.delay === delay && !r.targetFirst)!;
  const run = (r: Row) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString('utf8'));
  const best = [12, 24, null].map(cap => ranks.filter(r => r.tpPct !== null && r.capHours === cap).sort((a, b) => b.full.net - a.full.net)[0]);
  const selected = [...new Set(['timed12', 'timed24', ...[12, 24, null].map(cap => `cap${cap ?? 'none'}__tp4.5_sl5`), ...best.map(r => r.id)])];
  let md = '# LV03: daily NPOC exit caps\n\nSame saved entries,10k notional,0.055% fees/side,before funding. Full Dec5,2024 to Sep15,2026 20:20 UTC; recent June1 onward. DD32k starting equity. No-time-cap inventory stays marked if open, not called a win or forcibly closed.\n\n';
  md += '|Setup|W/L|Winning $|Losing $|Avg loss|Net|DD|Recent net|Mean/p95/max hold h|Open net/age h|TP/SL/timeout|\n|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|\n';
  for (const id of selected) { const r = row(id); md += `|${id}|${r.wins}/${r.losses}|${n(r.winningDollars)}|${n(r.losingDollars)}|${n(r.avgLoss)}|${n(r.net)}|${f(r.maxAdverseDrawdownPct)}%|${n(row(id, 'recent').net)}|${f(r.meanHoldHours)}/${f(r.p95HoldHours)}/${f(r.maxHoldHours)}|${n(r.openNet)}/${f(r.openAgeHours)}|${r.targets}/${r.stops}/${r.timeouts}|\n`; }
  const newRanks = ranks.filter(r => r.capHours !== 12), top = newRanks.slice(0, 5);
  md += `\n${newRanks.length} new definitions; ${newRanks.filter(r => r.pass).length} complete-screen qualifiers; ${newRanks.filter(r => r.passesRelative).length} relative passes. No holdout.\n`;
  for (const id of [...new Set([...selected, ...top.map(r => r.id)])]) {
    const r = row(id), b = row(r.tpPct === null ? 'timed12' : `cap12__tp${r.tpPct}_sl${r.slPct}`);
    const own = run(r), base = run(b), timed = run(row('timed12'));
    md += `\n## ${id}\n\n|Period|Same-pair12h net/DD|Selected net/DD|W/L|60s net/DD|Stress net|60s stress net|\n|---|---|---|---|---|---:|---:|\n`;
    for (const w of ['full', 'older', 'recent']) { const x = row(id, w), y = row(id, w, 60000), z = row(b.id, w);
      md += `|${w}|${n(z.net)}/${f(z.maxAdverseDrawdownPct)}%|${n(x.net)}/${f(x.maxAdverseDrawdownPct)}%|${x.wins}/${x.losses}|${n(y.net)}/${f(y.maxAdverseDrawdownPct)}%|${n(x.stressNet)}|${n(y.stressNet)}|\n`; }
    md += '\n|Month|Timed12 baseline|Same-pair12h baseline|Selected net|Delta vs timed|Delta vs pair|W/L|Winning $|Losing $|\n|---|---:|---:|---:|---:|---:|---|---:|---:|\n';
    for (const m of own.monthly) { const z = base.monthly.find((x: Row) => x.month === m.month), t = timed.monthly.find((x: Row) => x.month === m.month);
      md += `|${m.month}|${n(t.markedNet)}|${n(z.markedNet)}|${n(m.markedNet)}|${n(m.markedNet - t.markedNet)}|${n(m.markedNet - z.markedNet)}|${m.wins}/${m.losses}|${n(m.winningDollars)}|${n(m.losingDollars)}|\n`; }
    fs.writeFileSync(path.join(out, `trades-${id}.csv`), csv(own.trades.map((t: Row) => ({ ...t, evidence: undefined,
      entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString(), holdHours: (t.exitAt - t.entryAt) / 3600000 }))));
  }
  md += '\n## All 99 new definitions\n\n|Setup|Net|Delta vs same12h|DD|Recent net|Failures|\n|---|---:|---:|---:|---:|---|\n';
  for (const r of newRanks) md += `|${r.id}|${n(r.full.net)}|${n(r.full.delta12)}|${f(r.full.maxAdverseDrawdownPct)}%|${n(r.recent.net)}|${r.failures.join(',')}|\n`;
  fs.writeFileSync(path.join(out, 'review.md'), md);
  let grid = '# LV03 full TP/SL grids\n\nCell: full net / recent net / full DD. Same10k, before funding.12h maps are exact archived controls.\n\n';
  for (const cap of [12, 24, null]) { grid += `## Cap ${cap ?? 'none'}\n\n|TP / SL|2|2.5|3|3.5|4|4.5|5|\n|---|---|---|---|---|---|---|---|\n`;
    for (const tp of [2, 2.5, 3, 3.5, 4, 4.5, 5]) grid += `|${tp}|` + [2, 2.5, 3, 3.5, 4, 4.5, 5].map(sl => {
      const id = `cap${cap ?? 'none'}__tp${tp}_sl${sl}`, r = row(id); return `${n(r.net)} / ${n(row(id, 'recent').net)} / ${f(r.maxAdverseDrawdownPct)}%`; }).join('|') + '|\n'; grid += '\n'; }
  fs.writeFileSync(path.join(out, 'grids.md'), grid);
  fs.writeFileSync(path.join(out, 'selection.json'), JSON.stringify({ bestByCap: best.map(r => r.id), selected, topFiveNew: top.map(r => r.id) }, null, 2));
  console.log(out);
}
if (require.main === module) main();
