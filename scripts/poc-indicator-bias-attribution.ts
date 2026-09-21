/** Post-run attribution only: no new rules, entries or parameter selection. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
import { attribute } from './poc-hold-study';
import { amounts, M } from './poc-indicator-bias-engine';
import { csv } from './poc-bounce-study';
async function main() {
  const dir = path.resolve(process.argv[2]), read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const plan = read('plan.json'), c = plan.card, root = path.resolve(__dirname, '..');
  assert(read('independent-verification.json').passed && read('drawdown-verification.json').passed);
  for (const a of read('complete.json').artifacts) assert.equal(await fileHash(path.join(dir, a.file)), a.sha256);
  const results = read('results.json'), monthly = read('monthly.json'), cuts = [];
  for (const id of ['poc_exit1', 'poc_exit2']) for (const window of ['full', 'older', 'recent']) for (const delay of [0, M]) {
    const b = read(`poc12_baseline-${window}-${delay}-primary.json`), v = read(`${id}-${window}-${delay}-primary.json`);
    const a = attribute(b, v), bm = new Map(b.trades.map((t: any) => [t.id, t])) as Map<string, any>, vm = new Map(v.trades.map((t: any) => [t.id, t])) as Map<string, any>;
    const changed = b.trades.filter((t: any) => vm.has(t.id) && vm.get(t.id).exitAt !== t.exitAt);
    cuts.push({ id, window, delay, ...a.summary, changed: changed.length,
      heavyAvoidedOnCommon: changed.filter((t: any) => t.net <= -300 && vm.get(t.id).net > -300).length,
      winsToLosses: changed.filter((t: any) => t.net > 0 && vm.get(t.id).net < 0).length,
      changedBaseline: amounts(changed), changedVariant: amounts(changed.map((t: any) => vm.get(t.id))),
      contributions: a.rows.map(row => ({ ...row, entryUtc: new Date(row.entryAt).toISOString(),
        baselineExit: bm.get(row.id)?.exitAt ?? null, variantExit: vm.get(row.id)?.exitAt ?? null })).sort((a, b) => b.delta - a.delta) });
  }
  atomicJson(path.join(dir, 'exit-attribution.json'), cuts);
  const { candles } = await loadMinutes(root, 'HYPEUSDT', Date.parse(c.end), c.repair), base = candles[0].ts;
  const byBias = [];
  for (const r of results.filter((r: any) => r.family === 'daily_bias' && !r.targetFirst)) {
    const run = read(r.file);
    for (const side of [1, -1]) {
      const trades = run.trades.filter((t: any) => t.side === side), open = run.open?.side === side ? run.open : null;
      let cash = c.equity, peak = cash, dd = 0;
      for (const t of [...trades, ...(open ? [open] : [])]) {
        const mark = (price: number) => cash + side * t.qty * (price - t.entryPrice) - c.notional * c.fee - t.qty * price * c.fee;
        for (let at = t.entryAt; at < (t.exitAt ?? run.options.end); at += M) {
          const b = candles[(at - base) / M]; assert.equal(b.ts, at);
          dd = Math.max(dd, 100 * (peak - mark(side === 1 ? b.low : b.high)) / peak); peak = Math.max(peak, mark(b.close));
        }
        if (t.exitAt === undefined) continue;
        const b = candles[(t.exitAt - base) / M];
        let adverse = cash + t.net;
        if (['target', 'stop'].includes(t.reason)) {
          const gap = side * (b.open - t.stop) <= 0 || side * (b.open - t.target) >= 0;
          const p = gap ? b.open : t.reason === 'stop' || t.touchedBoth ? t.stop : side === 1 ? b.low : b.high;
          adverse = Math.min(adverse, mark(p));
        }
        cash += t.net; dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, cash);
      }
      byBias.push({ id: r.id, window: r.window, delay: r.delay, bias: side === 1 ? 'bull' : 'bear', ...amounts(trades),
        openNet: open?.net ?? 0, markedNet: amounts(trades).net + (open?.net ?? 0), contributionDdPct: dd,
        definition: 'Direction-only MTM contribution of original combined-path entries on32k; NOT a long-only/short-only rescheduled strategy' });
    }
  }
  atomicJson(path.join(dir, 'by-bias-attribution.json'), byBias);
  fs.writeFileSync(path.join(dir, 'by-bias.csv'), csv(byBias));
  const f = (n: number) => Math.round(n).toString(), ps = read('partitions-60000.json');
  let doc = '# Additional attribution (no strategy reruns)\n\n';
  doc += '## Exit intervention accounting, immediate path\n\n| Rule/window | Changed | Original changed net$ | New changed net$ | Added n/net$ | Heavy losses avoided (common) | Winners turned into losses |\n|---|---:|---:|---:|---:|---:|---:|\n';
  for (const x of cuts.filter(x => !x.delay)) doc += `|${x.id}/${x.window}|${x.changed}|${f(x.changedBaseline.net)}|${f(x.changedVariant.net)}|${x.added.count}/${f(x.added.net)}|${x.heavyAvoidedOnCommon}|${x.winsToLosses}|\n`;
  doc += '\n## Daily-bias primary and best in-sample cell, by direction\n\nDD below is contribution attribution on unchanged combined trades, not another strategy.\n\n| Setup/window/bias | W/L | Win$ | Loss$ | Closed net$ | Win% | Average R | PF | Expectancy$ | Contribution DD% |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
  for (const r of byBias.filter(x => !x.delay && [c.dailyBias.primary, 'w1_s8_opposing_swing'].includes(x.id)))
    doc += `|${r.id}/${r.window}/${r.bias}|${r.wins}/${r.losses}|${f(r.winningDollars)}|${f(r.losingDollars)}|${f(r.net)}|${(100 * r.winRate!).toFixed(1)}|${r.avgR?.toFixed(3)}|${r.profitFactor?.toFixed(2)}|${r.average?.toFixed(2)}|${r.contributionDdPct.toFixed(2)}|\n`;
  const ids = ['poc12_baseline', ...read('ranking.json').slice(0, 5).map((r: any) => r.id)];
  doc += '\n## All months: top five by full net, baseline adjacent\n\nEach cell net/delta versus POC baseline. Cross-strategy dollar comparisons are NOT overlay earnings; daily/short screen is against cash.\n\n|Month|' + ids.join('|') + '|\n|---|' + ids.map(() => '---:|').join('') + '\n';
  for (const b of monthly.filter((m: any) => m.id === 'poc12_baseline' && m.window === 'full' && !m.delay)) {
    doc += `|${b.month}|` + ids.map(id => { const r = monthly.find((m: any) => m.id === id && m.window === 'full' && !m.delay && !m.targetFirst && m.month === b.month);
      return `${f(r.markedNet)}/${f(r.delta)}`; }).join('|') + '|\n';
  }
  doc += '\n## Heavy-loss warning costs\n\nHeavy = realized loss of at least$300 on$10k. These are fixed-cohort partitions, not filtered PnL.\n\n';
  for (const p of ps.filter((p: any) => ['hl_accelerates_below_weekly', 'rsi_4h_weak', 'crsi_15m_low'].includes(p.id)))
    doc += `- ${p.id}: ${p.condition.heavy}/${p.baseline.heavy} heavy losses captured; ${p.condition.n} flagged; ${p.sacrificedWinners.wins} winning trades/$${f(p.sacrificedWinners.net)} would also be excluded.\n`;
  fs.writeFileSync(path.join(dir, 'review-tables.md'), doc);
  const files = ['exit-attribution.json', 'by-bias-attribution.json', 'by-bias.csv', 'review-tables.md'], artifacts = [];
  for (const file of files) artifacts.push({ file, sha256: await fileHash(path.join(dir, file)) });
  atomicJson(path.join(dir, 'attribution-verification.json'), { key: plan.key, passed: true, newDefinitions: 0, artifacts,
    scriptSha256: await fileHash(__filename), parentSha256: await fileHash(path.join(dir, 'complete.json')) });
  console.log('Post-run attribution saved; economics unchanged.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
