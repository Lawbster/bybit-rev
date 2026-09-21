/** HT03 presentation only.  Acceptance is deliberately a hard precondition. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { ROOT } from './level-playbook-study';
import { csv } from './poc-bounce-study';
type Row = Record<string, any>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const n = (x: number | null | undefined) => x == null ? '-' : Math.round(x).toLocaleString('en-US');
const p = (x: number | null | undefined) => x == null ? '-' : x.toFixed(2);
export function main() {
  const latest = read('backtests/high-touch-rejection/latest.json'); assert.equal(latest.accepted, true, 'Run independent verification and accept before reporting');
  const dir = latest.directory, out = path.join(ROOT, 'backtests/high-touch-rejection-reports', latest.key); assert(!fs.existsSync(out), 'Report is immutable'); fs.mkdirSync(out, { recursive: true });
  const plan = read(dir + '/plan.json'), c = plan.card, rows: Row[] = read(dir + '/results.json'), ranks: Row[] = read(dir + '/ranking.json');
  const row = (parent: string, group: string, window = 'full', delay = 0, targetFirst = false) => rows.find(x => x.parent === parent && x.group === group && x.window === window && x.delay === delay && x.targetFirst === targetFirst)!;
  const run = (x: Row) => JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, dir, x.journal))).toString());
  const candidates = ranks.filter(x => x.candidate), controls = ranks.filter(x => !x.candidate && x.group !== 'baseline'), parentBaselines = ranks.filter(x => x.group === 'baseline');
  const top = candidates.slice(0, 5), selected = [...new Set([...top, ...candidates.filter(x => x.relativePass)])];
  let md = '# HT03: rejection / failed-breakout entries at frozen two-day highs\n\nResearch-only, frozen before outcomes. Full Dec5,2024 12:55 to Sep15,2026 20:20 UTC; recent begins Jun1. Fixed $10k, 0.055%/side, $32k DD convention, 12h cap. Parent exact-touch baselines are separate from rejection candidates.\n\n';
  md += `18 candidate definitions and 9 diagnostic definitions (${c.newDefinitions} bracket definitions), plus three own-touch parents. Candidate qualifiers: ${candidates.filter(x => x.relativePass).length}; zero is a valid outcome. All comparisons are correlated mined-history paths, not holdout evidence.\n\n`;
  md += '|Rule / bracket|Kind|Own touch W/L|Own touch profit/loss/avg loss|Own net/DD|Rule W/L|Rule profit/loss/avg loss|Rule net/DD|Recent net|TP/SL/timeout|Screen|\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const r of [...parentBaselines, ...candidates, ...controls]) { const x = r.full, b = row(r.parent, 'baseline'); md += `|${r.id}|${r.group === 'baseline' ? 'own touch parent' : r.candidate ? 'candidate' : `control (${r.control})`}|${b.wins}/${b.losses}|${n(b.winningDollars)}/${n(b.losingDollars)}/${n(b.avgLoss)}|${n(b.net)}/${p(b.maxAdverseDrawdownPct)}%|${x.wins}/${x.losses}|${n(x.winningDollars)}/${n(x.losingDollars)}/${n(x.avgLoss)}|${n(x.net)}/${p(x.maxAdverseDrawdownPct)}%|${n(r.recent.net)}|${x.targets}/${x.stops}/${x.timeouts}|${r.relativePass ? 'qualified' : [...r.failures, ...r.relativeFailures].join(',')}|\n`; }
  md += '\n|Rule / bracket|Closed net|Cutoff-open net|Exposure hours|\n|---|---:|---:|---:|\n';
  for (const r of [...parentBaselines, ...candidates, ...controls]) { const x = r.full; md += `|${r.id}|${n(x.closedNet)}|${n(x.openNet)}|${p(x.exposureHours)}|\n`; }
  for (const r of selected) {
    const x = row(r.parent, r.group), own = run(x), parentRun = run(row(r.parent, 'baseline')), controlGroup = r.control, control = row(r.parent, controlGroup), controlRun = run(control);
    md += `\n## ${r.id}\n\nDesignated control: ${controlGroup}; it is diagnostic, not independent confirmation.\n\n|Window|Own-touch net/DD|Rule net/DD|Control net/DD|Delay0 → delay60 rule net|Stress delay0/delay60|\n|---|---|---|---|---|\n`;
    for (const w of ['full', 'older', 'recent']) { const a = row(r.parent, r.group, w), b = row(r.parent, 'baseline', w), q = row(r.parent, controlGroup, w), d = row(r.parent, r.group, w, 60000);
      md += `|${w}|${n(b.net)}/${p(b.maxAdverseDrawdownPct)}%|${n(a.net)}/${p(a.maxAdverseDrawdownPct)}%|${n(q.net)}/${p(q.maxAdverseDrawdownPct)}%|${n(a.net)} → ${n(d.net)}|${n(a.stressNet)}/${n(d.stressNet)}|\n`; }
    md += '\n|Month|Own touch|Rule|Delta versus own touch|Designated control delta|\n|---|---:|---:|---:|---:|\n';
    for (const m of own.monthly) { const b = parentRun.monthly.find((z: Row) => z.month === m.month), q = controlRun.monthly.find((z: Row) => z.month === m.month); md += `|${m.month}|${n(b.markedNet)}|${n(m.markedNet)}|${n(m.markedNet - b.markedNet)}|${n(m.markedNet - q.markedNet)}|\n`; }
    const a = own.attribution;
    md += `\nAttribution: ${a.shared} common closed receipts; removed ${a.removed.count} (${a.removed.wins}W/${a.removed.losses}L, ${n(a.removed.net)}), added ${a.added.count} (${a.added.wins}W/${a.added.losses}L, ${n(a.added.net)}), ${a.changedTimeSameAnchor} changed-time same-anchor entries, cutoff-open delta ${n(a.openDelta)}. Delta ${n(a.delta)}; excluding the two largest avoided losses ${n(a.deltaWithoutTwoLargestAvoidedLosses)}.\n`;
    fs.writeFileSync(path.join(out, `trades-${r.id}.csv`), csv(own.trades.map((t: Row) => ({ ...t, evidence: undefined, signalUtc: new Date(t.signalAt).toISOString(), entryUtc: new Date(t.entryAt).toISOString(), exitUtc: new Date(t.exitAt).toISOString() }))));
  }
  md += '\n## Confirmation reach and latency\n\n|Rule|Bracket|Raw decisions|Emitted|Deduplicated|Not qualified|Censored|Latency (minutes, emitted median)|\n|---|---|---:|---:|---:|---:|---:|---:|\n';
  const groups: Row[] = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, dir, 'groups.json.gz'))).toString());
  for (const g of groups) { const ds = g.decisions, emitted = ds.filter((d: Row) => d.status === 'emitted'), ls = emitted.map((d: Row) => (d.at - d.anchorAt) / 60000).sort((a: number, b: number) => a - b); md += `|${g.id}|all brackets|${ds.length}|${emitted.length}|${ds.filter((d: Row) => d.status === 'deduplicated').length}|${ds.filter((d: Row) => d.status === 'not_qualified').length}|${ds.filter((d: Row) => d.status === 'censored').length}|${ls.length ? p(ls[Math.floor((ls.length - 1) / 2)]) : '-'}|\n`; }
  md += '\n## Target-first sensitivity\n\n|Rule / bracket|Stop-first full net|Target-first full net|Difference|Stop-first ambiguity|\n|---|---:|---:|---:|---:|\n';
  for (const r of candidates) { const s = row(r.parent, r.group), t = row(r.parent, r.group, 'full', 0, true); md += `|${r.id}|${n(s.net)}|${n(t.net)}|${n(t.net - s.net)}|${s.ambiguous}|\n`; }
  fs.writeFileSync(path.join(out, 'review.md'), md);
  fs.writeFileSync(path.join(out, 'selection.json'), JSON.stringify({ topFive: top.map(x => x.id), qualifyingCandidates: candidates.filter(x => x.relativePass).map(x => x.id), candidateCount: candidates.length, diagnosticCount: controls.length }, null, 2));
  console.log(out);
}
if (require.main === module) main();
