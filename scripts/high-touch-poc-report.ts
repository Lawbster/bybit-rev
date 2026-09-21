import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { ROOT } from './level-playbook-study';
import { csv } from './poc-bounce-study';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const n = (v: number) => Math.round(v).toLocaleString('en-US'), pct = (v: number) => v.toFixed(2);
export function main() {
  const latest = read('backtests/high-touch-poc/latest.json'); assert(latest.accepted);
  const dir = latest.directory, out = path.join(ROOT, 'backtests/high-touch-poc-reports', latest.key); assert(!fs.existsSync(out), 'Read saved report');
  fs.mkdirSync(out, { recursive: true }); const plan = read(dir + '/plan.json'), c = plan.card, rows: Row[] = read(dir + '/results.json'), ranks: Row[] = read(dir + '/ranking.json');
  const row = (id: string, w = 'full', d = 0) => rows.find(r => r.id === id && r.window === w && r.delay === d && !r.targetFirst)!;
  const run = (r: Row) => JSON.parse(gunzipSync(fs.readFileSync(path.resolve(ROOT, dir, r.journal))).toString());
  const variants = ranks.filter(r => r.filter !== 'baseline'), bestNet = c.parents.map((p: string) => variants.find(r => r.parent === p)!.id);
  const highWr = c.parents.map((p: string) => variants.filter(r => r.parent === p && r.full.trades >= 30 && r.older.trades >= 10 && r.recent.trades >= 10)
    .sort((a, b) => b.full.winRate - a.full.winRate || b.full.net - a.full.net)[0].id);
  const selected = [...new Set([...c.parents.map((p: string) => p + '__baseline'), ...bestNet, ...highWr, ...variants.slice(0, 5).map(r => r.id)])] as string[];
  let md = '# HT02: POC / NPOC vetoes on two-day-high shorts\n\nDec5,2024 12:55 to Sep15,2026 20:20 UTC. Recent fromJune1. $10k/trade;0.055% each side,before funding. DD on32k. Same12h cap and actual-ownership replay.\n\n';
  md += '|Setup|W/L|WR|Winning $|Losing $|Avg loss|Net|DD|Recent net|Raw vetoes / blocked parent fills|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
  for (const id of selected) { const r = row(id); md += `|${id}|${r.wins}/${r.losses}|${pct(r.winRate * 100)}%|${n(r.winningDollars)}|${n(r.losingDollars)}|${n(r.avgLoss)}|${n(r.net)}|${pct(r.maxAdverseDrawdownPct)}%|${n(row(id, 'recent').net)}|${r.vetoedRawSignals}/${r.blockedBaselineFills}|\n`; }
  md += `\n192 variants: ${variants.filter(r => r.pass).length} absolute passes; ${variants.filter(r => r.relativePass).length} relative passes; ${variants.filter(r => r.winRateImprovesAllSix).length} improve WR all6 paths; ${variants.filter(r => r.netImprovesAllSix).length} improve net all6. These are correlated in-sample cells, not independent successes.\n`;
  for (const id of selected.filter(id => !id.endsWith('__baseline'))) {
    const r = row(id), bId = r.parent + '__baseline', own = run(r), base = run(row(bId));
    md += `\n## ${id}\n\n|Window|Baseline W/L, WR|Filtered W/L, WR|Baseline net/DD|Filtered net/DD|Extra60s baseline -> filtered net|Stressed filtered, normal/delayed|\n|---|---|---|---|---|---|---|\n`;
    for (const w of ['full', 'older', 'recent']) { const x = row(id, w), b = row(bId, w), d = row(id, w, 60000), bd = row(bId, w, 60000);
      md += `|${w}|${b.wins}/${b.losses},${pct(b.winRate * 100)}%|${x.wins}/${x.losses},${pct(x.winRate * 100)}%|${n(b.net)}/${pct(b.maxAdverseDrawdownPct)}%|${n(x.net)}/${pct(x.maxAdverseDrawdownPct)}%|${n(bd.net)} -> ${n(d.net)}|${n(x.stressNet)}/${n(d.stressNet)}|\n`; }
    md += '\n|Month|Baseline net|Filtered net|Delta|Filtered W/L|Winning $|Losing $|\n|---|---:|---:|---:|---|---:|---:|\n';
    for (const m of own.monthly) { const b = base.monthly.find((m2: Row) => m2.month === m.month); md += `|${m.month}|${n(b.markedNet)}|${n(m.markedNet)}|${n(m.markedNet - b.markedNet)}|${m.wins}/${m.losses}|${n(m.winningDollars)}|${n(m.losingDollars)}|\n`; }
    const a = own.attribution;
    md += '\n|Attribution cohort|W/L|Winning $|Losing $|Net contribution before removal sign|\n|---|---|---:|---:|---:|\n';
    for (const k of ['removed', 'direct', 'displaced', 'added']) { const x = a[k]; md += `|${k}|${x.wins}/${x.losses}|${n(x.winningDollars)}|${n(x.losingDollars)}|${n(x.net)}|\n`; }
    md += `\nDelta ${n(a.delta)} = added - removed + open delta ${n(a.openDelta)}. Delta without two largest avoided losses: ${n(a.deltaWithoutTwoLargestAvoidedLosses)}. Direct/displaced partition removed; do not double count.\n`;
    fs.writeFileSync(path.join(out, `trades-${id}.csv`), csv(own.trades.map((t: Row) => ({ ...t, evidence: undefined,
      signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
  }
  let grid = '# HT02 complete filter matrix\n\n64 filters per bracket. Distances to $0.10 price row using observed close, not later fill. No live changes.\n';
  for (const parent of c.parents) {
    const b = row(parent + '__baseline'); grid += `\n## ${parent}\n\nBaseline: ${b.wins}/${b.losses}, WR${pct(b.winRate * 100)}%, net${n(b.net)}, DD${pct(b.maxAdverseDrawdownPct)}%.\n\n|Filter|W/L|WR|WR delta pp|Net|Net delta|DD|Recent net|Recent WR delta pp|WR / net better all6|Failures|\n|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|\n`;
    for (const rank of variants.filter(r => r.parent === parent)) { const x = rank.full; grid += `|${rank.filter}|${x.wins}/${x.losses}|${pct(x.winRate * 100)}%|${pct(x.deltaWinRate * 100)}|${n(x.net)}|${n(x.deltaNet)}|${pct(x.maxAdverseDrawdownPct)}%|${n(rank.recent.net)}|${pct(rank.recent.deltaWinRate * 100)}|${rank.winRateImprovesAllSix}/${rank.netImprovesAllSix}|${rank.failures.join(',')};relative:${rank.relativeFailures.join(',')}|\n`; }
  }
  fs.writeFileSync(path.join(out, 'review.md'), md); fs.writeFileSync(path.join(out, 'filters.md'), grid);
  fs.writeFileSync(path.join(out, 'selection.json'), JSON.stringify({ bestNet, highWr, topFive: variants.slice(0, 5).map(r => r.id), selected }, null, 2));
  console.log(out);
}
if (require.main === module) main();
