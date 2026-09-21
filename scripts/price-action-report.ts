import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson } from './research-workflow';
import { type Row, M } from './poc-indicator-bias-engine';
const cash = (n: number | null) => n === null ? 'NA' : Math.round(n).toLocaleString('en-US');
export function writePriceActionReport(out: string, c: Row, rs: Row[], ms: Row[]) {
  const candidates = ['sweep_impulse', 'origin_retest'];
  const parent = (r: Row) => r.id.replace('sweep_impulse', 'sweep_control').replace('origin_retest', 'break_control');
  const match = (a: Row, b: Row) => a.window === b.window && a.lag === b.lag && a.delay === b.delay && a.targetFirst === b.targetFirst;
  for (const r of rs) {
    const b = rs.find(x => x.id === parent(r) && match(x, r))!; assert(b);
    Object.assign(r, { baselineId: b.id, baselineNet: b.net, baselineDd: b.maxAdverseDrawdownPct,
      delta: r.net - b.net, ddDelta: r.maxAdverseDrawdownPct - b.maxAdverseDrawdownPct });
  }
  for (const r of ms) { const b = ms.find(x => x.id === parent(r) && match(x, r) && x.month === r.month)!;
    assert(b); r.baselineId = b.id; r.baselineMarkedNet = b.markedNet; r.delta = r.markedNet - b.markedNet; }
  const ranking = [...new Set(rs.map(r => r.id))].map(id => {
    const rows = rs.filter(r => r.id === id && !r.targetFirst), months = ms.filter(m => m.id === id && !m.targetFirst);
    const full = rows.find(r => r.window === 'full' && r.lag === M && r.delay === 0)!;
    const failures: string[] = [], upgradeFailures: string[] = [];
    if (rows.some(r => r.net <= 0)) failures.push('nonpositive_partition');
    if (rows.some(r => r.stressNet <= 0)) failures.push('cost_stress');
    if (rows.some(r => r.trades < (r.window === 'full' ? 30 : 10))) failures.push('sample');
    if (rows.some(r => r.bankrupt)) failures.push('equity');
    if (months.some(m => m.markedNet < -250)) failures.push('monthly_vs_cash');
    const candidate = candidates.includes(full.mechanism);
    if (candidate) {
      if (rows.some(r => r.delta <= 0)) upgradeFailures.push('own_net_regression');
      if (rows.some(r => r.ddDelta > 1e-8)) upgradeFailures.push('own_dd_regression');
      if (months.some(m => m.delta < -250)) upgradeFailures.push('own_monthly_regression');
    }
    return { id, candidate, standalonePass: !failures.length, upgradePass: candidate && !failures.length && !upgradeFailures.length,
      failures, upgradeFailures, full, recent: rows.find(r => r.window === 'recent' && r.lag === M && !r.delay),
      worstMonth: Math.min(...months.map(m => m.markedNet)), worstMonthlyDelta: Math.min(...months.map(m => m.delta)) };
  }).sort((a, b) => b.full.net - a.full.net);
  atomicJson(path.join(out, 'ranking.json'), ranking);
  atomicJson(path.join(out, 'comparison-results.json'), rs); atomicJson(path.join(out, 'comparison-monthly.json'), ms);
  const line = (r: Row) => `|${r.id}|${r.wins}/${r.losses}|${cash(r.winningDollars)}|${cash(r.losingDollars)}|${cash(r.avgLoss)}|${cash(r.net)}|${r.maxAdverseDrawdownPct.toFixed(2)}|${r.avgR?.toFixed(2) ?? 'NA'}|${r.profitFactor?.toFixed(2) ?? 'NA'}|`;
  let report = `# PA07 — HYPE source-derived setups\n\n${c.start}–${c.end}; recent begins ${c.split}. Fixed $10k/strategy, $32k DD equity, 0.055% each side, BEFORE FUNDING. Closed 1h triggers / known 4h pivots; 24h cap. Reference2R is based on signal close, not guaranteed fill R.\n\n`;
  for (const window of ['full', 'older', 'recent']) {
    report += `## ${window} — own controls immediately above candidates\n\n|Setup|W/L|Winning $|Losing $|Avg loss $|Marked net $|DD %|Avg R|PF|\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n|Cash|0/0|0|0|NA|0|0|NA|NA|\n`;
    for (const mechanism of ['sweep_impulse', 'origin_retest']) for (const side of ['long', 'short']) for (const target of c.targets) {
      const id = `${mechanism}__${side}__${target}`, row = rs.find(r => r.id === id && r.window === window && r.lag === M && !r.delay && !r.targetFirst)!;
      report += line(rs.find(r => r.id === parent(row) && match(r, row))!) + '\n' + line(row) + '\n';
    }
    report += '\n';
  }
  report += '## Frozen screens\n\n' + ranking.map(r => `- ${r.id}: ${r.standalonePass ? 'standalone pass' : r.failures.join(', ')}; ${r.candidate ? 'upgrade: ' + (r.upgradePass ? 'pass' : r.upgradeFailures.join(', ') || 'absolute screen failed') : 'control'}; worst month $${cash(r.worstMonth)}.`).join('\n');
  report += '\n\n## Monthly MTM, primary clock (every cell)\n';
  for (const mechanism of ['sweep_impulse', 'origin_retest']) for (const side of ['long', 'short']) for (const target of c.targets) {
    const id = `${mechanism}__${side}__${target}`;
    report += `\n### ${id}\n\n|Month|Own control $|Candidate $|Delta $|Wins|Losses|Winning $|Losing $|\n|---|---:|---:|---:|---:|---:|---:|---:|\n`;
    for (const m of ms.filter(m => m.id === id && m.window === 'full' && m.lag === M && !m.delay && !m.targetFirst))
      report += `|${m.month}|${cash(m.baselineMarkedNet)}|${cash(m.markedNet)}|${cash(m.delta)}|${m.wins}|${m.losses}|${cash(m.winningDollars)}|${cash(m.losingDollars)}|\n`;
  }
  report += '\n## Interpretation limits\n\nThese are precise adaptations, not all strategies in the PDF library. No optimized parameters or untouched holdout. Later entry changes price, R, exposure and replacement trades, not merely win rate. Cash and same-family controls only; do not sum separate accounts. Raw events/expiry and both clocks/orders remain in sealed artifacts. A passed implementation audit is not a passed economic screen.\n';
  fs.writeFileSync(path.join(out, 'report.md'), report);
}
