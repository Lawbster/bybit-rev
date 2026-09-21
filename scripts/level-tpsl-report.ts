/** Derived presentation only: reads accepted LV02 journals, never replays prices. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { ROOT } from './level-playbook-study';
import { csv } from './poc-bounce-study';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export function journal(dir: string, row: any) {
  const fd = fs.openSync(path.resolve(ROOT, dir, row.journal), 'r'), bytes = Buffer.alloc(row.journalBytes);
  try { let got = 0; while (got < bytes.length) { const n = fs.readSync(fd, bytes, got, bytes.length - got, row.journalOffset + got); assert(n > 0); got += n; } }
  finally { fs.closeSync(fd); }
  return JSON.parse(gunzipSync(bytes).toString('utf8'));
}
function main() {
  const p = read('backtests/level-tpsl/latest.json'), dir = p.directory; assert(p.accepted);
  const audit = read(dir + '/independent-verification.json'); assert(audit.passed && audit.key === p.key);
  const rs = read(dir + '/results.json'), ranks = read(dir + '/ranking.json'), groups = read(dir + '/groups.json');
  const out = path.join(ROOT, 'backtests/level-tpsl-reports', p.key); assert(!fs.existsSync(out), 'Derived report already exists'); fs.mkdirSync(out, { recursive: true });
  const n = (x: number) => Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : 'NA';
  const rate = (x: number | null) => x === null ? 'NA' : (100 * x).toFixed(2) + '%';
  const rowFor = (id: string, window: string) => rs.find((r: any) => r.id === id && r.window === window && !r.delay && !r.targetFirst);
  const grid = ranks.filter((r: any) => r.tpPct !== null), distinct: any[] = [];
  for (const r of grid) if (!distinct.some(x => x.group === r.group)) distinct.push(r);
  let report = '# LV02: baseline-adjacent results\n\nFull:2024-12-05 12:55 to2026-09-15 20:20 UTC. Recent:2026-06-01 onward. Fixed10k, fees0.055%/side, before funding. DD32k initial equity. Each strategy independent.\n\n';
  report += `3,185 percentage-exit definitions; ${grid.filter((r: any) => r.pass).length} complete-screen passes. Controls64 new directional timed+existing PB02. No holdout or live qualification.\n\n`;
  report += '|Best full-net cell per entry/direction|TP/SL %|W/L|Win rate|Full net|DD|Recent net|Failures|\n|---|---|---:|---:|---:|---:|---:|---|\n';
  for (const r of distinct) report += `|${r.group}|${r.tpPct}/${r.slPct}|${r.full.wins}/${r.full.losses}|${rate(r.full.winRate)}|${n(r.full.net)}|${r.full.maxAdverseDrawdownPct.toFixed(2)}%|${n(r.recent.net)}|${r.failures.join(',')}|\n`;
  const fullTop5 = grid.slice(0, 5), selected = distinct.slice(0, 5);
  const rateEligible = grid.filter((r: any) => r.full.trades >= 30 && r.older.trades >= 10 && r.recent.trades >= 10).sort((a: any, b: any) => b.full.winRate - a.full.winRate || b.full.trades - a.full.trades);
  const highestLong = rateEligible.find((r: any) => r.side === 1), highestShort = rateEligible.find((r: any) => r.side === -1);
  for (const r of [highestLong, highestShort]) if (r && !selected.some(x => x.id === r.id)) selected.push(r);
  for (const r of selected) {
    report += `\n## ${r.id}\n\n`;
    const ids = [r.group + '__timed', r.group + '__tp2_sl2', r.id];
    report += '|Window/setup|Wins/losses|Winning $|Losing $|Avg loss $|Marked net|DD|TP/SL/timeout|\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
    for (const w of ['full', 'older', 'recent']) for (const id of ids) {
      const x = rowFor(id, w); report += `|${w}: ${id.split('__').at(-1)}|${x.wins}/${x.losses}|${n(x.winningDollars)}|${n(x.losingDollars)}|${n(x.avgLoss)}|${n(x.net)}|${x.maxAdverseDrawdownPct.toFixed(2)}%|${x.targets}/${x.stops}/${x.timeouts}|\n`;
    }
    const run = journal(dir, r.full), ref = journal(dir, rowFor(r.group + '__tp2_sl2', 'full'));
    report += '\n|Month|2/2 baseline|Selected net|Delta|Wins/losses|Winning $|Losing $|\n|---|---:|---:|---:|---:|---:|---:|\n';
    for (const m of run.monthly) { const b = ref.monthly.find((x: any) => x.month === m.month);
      report += `|${m.month}|${n(b.markedNet)}|${n(m.markedNet)}|${n(m.markedNet - b.markedNet)}|${m.wins}/${m.losses}|${n(m.winningDollars)}|${n(m.losingDollars)}|\n`; }
    fs.writeFileSync(path.join(out, 'trades-' + r.id + '.csv'), csv(run.trades.map((t: any) => ({ id: t.id,
      signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString(),
      side: t.side === 1 ? 'long' : 'short', entry: t.entryPrice, target: t.target, stop: t.stop, exit: t.exitPrice,
      reason: t.reason, qty: t.qty, fees: t.fees, net: t.net, r: t.r }))));
  }
  report += '\n## Exact top-five full-net cells: monthly deltas versus their own2/2\n\n';
  report += '|Month|' + fullTop5.map((r: any) => r.id).join('|') + '|\n|---|' + fullTop5.map(() => '---:').join('|') + '|\n';
  const topRuns = fullTop5.map((r: any) => ({ run: journal(dir, r.full), base: journal(dir, rowFor(r.group + '__tp2_sl2', 'full')) }));
  for (const m of topRuns[0].run.monthly) report += '|' + m.month + '|' + topRuns.map((x: any) => n(x.run.monthly.find((a: any) => a.month === m.month).markedNet - x.base.monthly.find((a: any) => a.month === m.month).markedNet)).join('|') + '|\n';
  report += '\n## Win-rate leaders with30 full/10 each partition minimum\n\n|Setup|Win rate|W/L|Net|Recent net|Target-hit rate|Timeout rate|\n|---|---:|---:|---:|---:|---:|---:|\n';
  for (const r of rateEligible.slice(0, 20)) report += `|${r.id}|${rate(r.full.winRate)}|${r.full.wins}/${r.full.losses}|${n(r.full.net)}|${n(r.recent.net)}|${rate(r.full.targetRate)}|${rate(r.full.timeoutRate)}|\n`;
  report += '\nCutoff marked inventory is excluded from win/loss counts; net includes it. Low samples and economic qualification are separate from this display floor. All cells remain in original results.\n';
  fs.writeFileSync(path.join(out, 'review.md'), report);
  let matrices = '# LV02 complete grids\n\nEach cell = full-period marked net dollars / after-fee win rate. RowsTP, columnsSL.12h maximum hold, fixed10k. Do not add cells. Best-cell selection is in-sample.\n\n';
  for (const g of groups) {
    const base = rowFor(g.id + '__tp2_sl2', 'full'), timed = rowFor(g.id + '__timed', 'full');
    matrices += `## ${g.id}\n\n12h control: ${n(timed.net)}, ${rate(timed.winRate)}, ${timed.trades} closes. 2/2 reference: ${n(base.net)}, ${rate(base.winRate)}, ${base.trades} closes.\n\n`;
    matrices += '|TP / SL|2|2.5|3|3.5|4|4.5|5|\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
    for (const tp of [2, 2.5, 3, 3.5, 4, 4.5, 5]) matrices += '|' + tp + '|' + [2, 2.5, 3, 3.5, 4, 4.5, 5].map(sl => {
      const r = rowFor(g.id + `__tp${tp}_sl${sl}`, 'full'); return n(r.net) + ' / ' + rate(r.winRate); }).join('|') + '|\n';
    matrices += '\n';
  }
  fs.writeFileSync(path.join(out, 'grids.md'), matrices);
  fs.writeFileSync(path.join(out, 'selection.json'), JSON.stringify({ job: p.key, fullTop5: fullTop5.map((r: any) => r.id), distinctTop5: distinct.slice(0, 5).map((r: any) => r.id), highestLong: highestLong.id, highestShort: highestShort.id }, null, 2));
  console.log(out);
}
if (require.main === module) main();
