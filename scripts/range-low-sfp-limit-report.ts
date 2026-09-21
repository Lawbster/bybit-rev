/** Read sealed SF03 artifacts only; no detector or economic rerun. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT } from './setup-scan-core';
import { parseCsv } from './setup-chart';
import { atomicJson, fileHash, sha } from './research-workflow';
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const primary = (x: any) => x.delay === 0 && !x.targetFirst && !x.stress;
const cash = (x: number) => `${x < 0 ? '-$' : '$'}${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
const pct = (x: number) => `${x.toFixed(2)}%`;
const name = (r: any) => r.name === 'market' ? 'Market baseline' : `Sweep +${r.offsetPct}% (${r.model})`;
async function main() {
  const dir = read(path.join(ROOT, 'backtests/range-low-sfp-limit/latest.json')).dir, j = read(path.join(dir, 'comparison.json'));
  const card = read(path.join(ROOT, j.card)), c = j.resolvedCard;
  const checks: any = { artifactHashes: 0, pins: 0, baselineParity: j.baselineParity, stageClocks: j.clockChecks, screens: [] };
  for (const d of new Set<string>([dir, ...j.runs.flatMap((r: any) => [path.join(ROOT, 'backtests/setup-scans', r.scan), path.join(ROOT, 'backtests/setup-replays', r.replay)])]))
    for (const a of read(path.join(d, 'complete.json')).artifacts) { assert.equal(await fileHash(path.join(d, a.file)), a.sha256); checks.artifactHashes++; }
  for (const p of [...j.hashes, ...j.input]) { assert.equal(await fileHash(path.join(ROOT, p.file)), p.sha256, p.file); checks.pins++; }
  const base = (lag = 60000) => j.runs.find((r: any) => r.name === 'market' && r.lag === lag);
  const row = (r: any, h: number, w = 'full') => r.results.find((x: any) => primary(x) && x.holdHours === h && x.window === w);
  const months = (r: any, h: number) => r.monthly.filter((x: any) => primary(x) && x.window === 'full' && x.cell === `long__r2__hold${h}h`);
  for (const offset of card.offsetsPct) for (const hold of card.holds) {
    const failures: string[] = [];
    for (const r of j.runs.filter((r: any) => r.offsetPct === offset)) {
      const a = base(r.lag), f = row(r, hold), tag = `${r.model}/lag${r.lag}`;
      for (const w of ['full', 'older', 'recent']) { const x = row(a, hold, w), y = row(r, hold, w);
        if (y.net - x.net < c.screen.netDeltaEachWindowMin - 1e-8) failures.push(`${tag}/${w}: net below baseline`);
        if (y.maxAdverseDrawdownPct - x.maxAdverseDrawdownPct > c.screen.ddDeltaEachWindowMax + 1e-8) failures.push(`${tag}/${w}: DD above baseline`);
        if (y.n < (w === 'full' ? c.screen.tradesMin : c.screen.tradesPerSplitMin)) failures.push(`${tag}/${w}: sample`);
      }
      for (const m of months(r, hold)) { const b = months(a, hold).find((x: any) => x.month === m.month);
        if (m.markedNet - b.markedNet < c.screen.monthlyDeltaMin - 1e-8) failures.push(`${tag}/${m.month}: monthly delta ${cash(m.markedNet - b.markedNet)}`); }
      if (f.profitFactor === null || f.profitFactor < c.screen.profitFactorMin) failures.push(`${tag}: PF`);
      if (f.net - f.top5WinDollars <= c.screen.netExTop5Min) failures.push(`${tag}: winner concentration`);
      if (r.results.some((x: any) => x.holdHours === hold && !x.targetFirst && (x.net <= 0 || x.bankrupt))) failures.push(`${tag}: nonpositive window/stress/delay or equity exhaustion`);
    }
    checks.screens.push({ offset, hold, passed: failures.length === 0, failures });
  }
  const runs = j.runs.filter((r: any) => r.lag === 60000), touch = runs.filter((r: any) => r.name === 'market' || r.model === 'touch');
  const lines = ['# SF03: confirmed SFP, then buy a return to its sweep low', '',
    '## TL;DR', '',
    `- **${checks.screens.filter((s: any) => s.passed).length}/4 complete screen passes.** Two entry offsets x two holding caps; fill models, source lag, action delay and costs are sensitivities, not independent strategies. No live change.`,
    '- The cheaper fills reduce loss dollars, but miss almost all original winners. With the original stop unchanged, exact sweep entry normally leaves only 0.1% price room; returning to that low often immediately stops out.',
    '- This rejects the exact entry-only change, not the SFP family or wider-stop/HL alternatives. Those remain untested here. Hindsight entry during the original sweep was never allowed.', '',
    '## Frozen comparison', '',
    `${c.from} through ${c.to}, UTC; split ${c.split}. HYPE Bybit perpetual, fixed $10,000 notional, $32,000 DD account. 0.055% taker/side; +5bps/side stress; before funding. Source lag60/120s, action delay0/60s. Saved original **4h range-qualified SF01**, not the losing SF02 15m signal. Original signal-risk0.2-5% eligibility, absolute SL and reference-derived2R TP retained.`, '',
    'At confirmation submit at the first sweep candle low, or 0.1% higher. Exclusive expiry four hours later. One pending/open owner; no retries/replacements. Holding cap starts at actual fill, adding waiting time to total signal age. Charge the limit without favorable gap improvement. This is not a new 2R target measured from the cheaper fill.', '',
    'Touch assumes a full resting fill; it does not prove queue execution. Open requires minute-open at/below limit and ignores wick-only touches; it is an execution sensitivity, not a lower PnL bound. Initial already-invalid brackets are not submitted; once resting, a gap through SL fills and loses. An unfilled order cancels at a later minute-open above TP. Fill-minute pre-entry highs cannot credit a primary TP; close>=TP is required, with target-first as a separate optimistic bound.', '',
    'The generic setup-replay reports retain a descriptive screen. This frozen SF03 report/card supersedes it.', '',
    '## Full-period results: baseline beside each variant', '',
    'Primary source lag60s, action delay0, stop-first. W/L and dollars are closed trades; net also includes cutoff inventory. Baseline has +$14.86 open MTM; candidates have none.', '',
    '| Hold | Entry | Wins / losses | Winning $ | Losing $ | Avg loss | Net | Delta vs baseline | DD |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const h of card.holds) for (const r of touch) { const x = row(r, h); lines.push(`| ${h}h | ${name(r)} | ${x.wins} / ${x.losses} | ${cash(x.winningDollars)} | ${cash(x.losingDollars)} | ${cash(x.avgLoss)} | ${cash(x.net)} | ${cash(x.net-row(base(),h).net)} | ${pct(x.maxAdverseDrawdownPct)} |`); }
  lines.push('', '## Where the improvement disappears (24h touch model)', '',
    '| Entry | Fills | Expired / invalidated | Original winners missed | Their original profit | Common-trade improvement | Net removed trades | Open delta | Total delta |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of touch.filter((r: any) => r.name !== 'market')) { const x = row(r,24), a = j.attribution.find((a: any) => a.name === r.name && a.lag===60000 && a.cell==='long__r2__hold24h');
    lines.push(`| ${name(r)} | ${x.entryFilled} | ${x.entryExpired} / ${x.entryInvalidated} | ${a.removedWinners} / ${row(base(),24).wins} | ${cash(a.removedWinningDollars)} | ${cash(a.commonDelta)} | ${cash(a.removedNet)} | ${cash(a.openDelta)} | ${cash(a.totalDelta)} |`); }
  lines.push('', 'All candidate closed trades in the primary path share baseline IDs; no added closed trades. Delta = common improvement - removed net + open delta. Removed counts include expiry/invalidation/occupancy, not assumed poor signals. Full ID-level attribution is saved.', '',
    '| Entry | TP / stop / timeout | Stops on fill minute | Median stop distance | Mean filled wait | Fees paid |', '|---|---:|---:|---:|---:|---:|');
  for (const r of touch.filter((r: any) => r.name !== 'market')) { const d=path.join(ROOT,'backtests/setup-replays',r.replay), x=row(r,24);
    const ts=parseCsv(fs.readFileSync(path.join(d,'trades-long__r2__hold24h.csv'),'utf8')), ds=ts.map(t=>100*(Number(t.entryPrice)-Number(t.stop))/Number(t.entryPrice)).sort((a,b)=>a-b);
    const filled=read(path.join(d,'intents-long__r2__hold24h.json')).filter((i:any)=>i.phase==='filled');
    lines.push(`| ${name(r)} | ${x.targets} / ${x.stops} / ${x.timeouts} | ${ts.filter(t=>t.reason==='stop'&&t.entryAt===t.exitAt).length} | ${pct(ds[Math.floor(ds.length/2)])} | ${(filled.reduce((s:number,i:any)=>s+(i.entryAt-i.activeAt)/60000,0)/filled.length).toFixed(1)} min | ${cash(x.feesPaid)} |`); }
  lines.push('', 'The exact-sweep entry saves money on trades that were already losses, but does not convert any baseline24h losers to winners in the touch model. The +0.1% variant converts one. A usual exact-sweep stop is about $10 price loss plus $11 fees; the small average loss does not mean reliable bounces. Longer holding cannot rescue a trade already stopped. This is conditional on the original tight stop, not evidence against all retest entries.', '',
    '## Older/recent windows', '', '| Hold | Entry | Older baseline net / DD | Older candidate net / DD | Recent baseline net / DD | Recent candidate net / DD |', '|---|---|---:|---:|---:|---:|');
  for(const h of card.holds) for(const r of touch.filter((r:any)=>r.name!=='market')) { const a=row(base(),h,'older'),b=row(r,h,'older'),x=row(base(),h,'recent'),y=row(r,h,'recent'); lines.push(`| ${h}h | ${name(r)} | ${cash(a.net)} / ${pct(a.maxAdverseDrawdownPct)} | ${cash(b.net)} / ${pct(b.maxAdverseDrawdownPct)} | ${cash(x.net)} / ${pct(x.maxAdverseDrawdownPct)} | ${cash(y.net)} / ${pct(y.maxAdverseDrawdownPct)} |`); }
  lines.push('', '## Monthly marked net and delta versus same-hold baseline', '');
  for (const h of card.holds) { lines.push(`### ${h}h`, '', '| Month | Baseline | Exact sweep | Delta | Sweep +0.1% | Delta |', '|---|---:|---:|---:|---:|---:|');
    for (const b of months(base(),h)) { const [x,y]=touch.filter((r:any)=>r.name!=='market').map((r:any)=>months(r,h).find((m:any)=>m.month===b.month)); lines.push(`| ${b.month} | ${cash(b.markedNet)} | ${cash(x.markedNet)} | ${cash(x.markedNet-b.markedNet)} | ${cash(y.markedNet)} | ${cash(y.markedNet-b.markedNet)} |`); } lines.push(''); }
  lines.push('## Execution, delay and cost sensitivity', '', 'Net dollars. Each baseline uses the same hold and clock. All model/lag monthly rows remain in saved JSON/CSV.', '',
    '| Hold | Entry | Lag60 net / DD | +60s delay net | Stressed net | Lag120 net / DD | Optimistic target-first net |', '|---|---|---:|---:|---:|---:|---:|');
  for(const h of card.holds) for(const r of runs){ const x=row(r,h), other=j.runs.find((a:any)=>a.name===r.name&&a.lag===120000), y=row(other,h),
    d=r.results.find((a:any)=>a.holdHours===h&&a.window==='full'&&a.delay===60000&&!a.targetFirst&&!a.stress), t=r.results.find((a:any)=>a.holdHours===h&&a.window==='full'&&a.delay===0&&a.targetFirst&&!a.stress);
    lines.push(`| ${h}h | ${name(r)} | ${cash(x.net)} / ${pct(x.maxAdverseDrawdownPct)} | ${cash(d.net)} | ${cash(x.stressNet)} | ${cash(y.net)} / ${pct(y.maxAdverseDrawdownPct)} | ${cash(t.net)} |`); }
  lines.push('', '## Qualification and verification', '', 'Screen inherited from SF01: net>=matched baseline and DD<=baseline in full/older/recent, no month worse by more than $250, >=30 full/10 per split trades, PF>=1.1, net excluding top-five winners positive, all cost/delay cases positive; both publication lags and both entry-fill models required.', '');
  for(const s of checks.screens) lines.push(`- Sweep +${s.offset}%, ${s.hold}h: **${s.passed?'PASS':'FAIL'}**. ${[...new Set(s.failures.map((f:string)=>f.split(': ').slice(1).join(': ').startsWith('monthly')?'monthly opportunity cost':f.split(': ').slice(1).join(': ')))].join('; ')}.`);
  lines.push('', `Original archived baseline: ${j.baselineParity.map((b:any)=>`${b.results} result rows and byte-identical closed-trade CSVs at lag${b.lag}`).join('; ')}. Non-entry action fields, rejections, ties, windows and full monthly outputs match. All 360 replay cells independently audited; saved source/artifact hashes verified. Synthetic tests cover pending occupancy, exclusive expiry, delayed activation, gap-through-stop, entry-bar sequencing, hold clock, cutoff, prefix invariance and audit tampering.`, '',
    'Causal trace: Jan8,2025 sweep low $21.207 becomes known at04:01 UTC after the4h close+60s. Order fills only on the later05:54 return, then stops at05:55 at$21.185793 for-$20.99 after fees. The original sweep itself is never counted as a fill. Full event, intent and trade are in comparison.json.', '',
    'Development sample, informed by the user\'s manual review, not untouched out-of-sample proof. Funding and live queue/tick effects are not modeled. These costs/results do not justify deployment.', '',
    '## Stored artifacts / resume', '',
    `- Job: \`${j.key}\` under \`backtests/range-low-sfp-limit/\`; comparison contains all results, monthly paths, attribution, provenance and causal traces.`,
    '- Each linked setup-replay directory has trade CSVs, intent lifecycles, receipts and results. Re-run the study to verify/reuse; it does not reconstruct the S/R map or rerun detection.',
    `- [Exact-sweep interactive replay](../backtests/range-low-sfp-limit/${j.key}/sweep-0-replay.html).`,
    `- [Sweep +0.1% interactive replay](../backtests/range-low-sfp-limit/${j.key}/sweep-0.1-replay.html).`,
    '- [Frozen card](../research-inputs/range-low-sfp-limit-sf03-2026-09-20.json) / [method](../docs/research/range-low-sfp-limit-sf03.md).',
    '- Next already-requested branch: HL availability-aware context on original4h stops, distinguishing72h recovery/non-recovery with censoring. Only then a separately declared wider-SL replay. No new filters or stops were selected from SF03.', '');
  const out=path.join(ROOT,'research/codex-astra-sfp-sweep-limit-findings-2026-09-20.md'); fs.writeFileSync(out,lines.join('\n'));
  const key=sha(JSON.stringify({job:j.key,reporter:await fileHash(__filename)})), review=path.join(ROOT,'backtests/range-low-sfp-limit-reviews',key);
  fs.mkdirSync(review,{recursive:true}); atomicJson(path.join(review,'verification.json'),checks);
  atomicJson(path.join(review,'complete.json'),{key,job:j.key,reportSha256:await fileHash(out),artifacts:[{file:'verification.json',sha256:await fileHash(path.join(review,'verification.json'))}]});
  console.log(JSON.stringify({findings:out,verification:review,passed:checks.screens.filter((s:any)=>s.passed).length,comparisons:checks.screens.length,hashes:checks.artifactHashes},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
