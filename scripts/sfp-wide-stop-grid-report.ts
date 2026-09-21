/** SF07 reporting only: sealed replay outputs and the existing chart renderer. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT } from './setup-scan-core';
import { atomicJson,fileHash,sha } from './research-workflow';
import { writeChart,parseTimeframes } from './setup-chart';
import type { Row } from './tp-hl-event-features';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const primary=(r:Row)=>r.delay===0&&!r.targetFirst&&!r.stress;
const cash=(n:number)=>`${n<0?'-':''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const pct=(n:number)=>`${n.toFixed(2)}%`;
const row=(r:Row,w='full')=>r.results.find((x:Row)=>primary(x)&&x.window===w);
async function main(){
  const dir=read(path.join(ROOT,'backtests/sfp-wide-stop-grid/latest.json')).dir,j=read(path.join(dir,'comparison.json'));
  assert.equal(j.card.id,'SF07');let hashes=0;
  for(const d of [dir,...j.runs.map((r:Row)=>path.join(ROOT,'backtests/setup-replays',r.replay))])for(const a of read(path.join(d,'complete.json')).artifacts){assert.equal(await fileHash(path.join(d,a.file)),a.sha256);hashes++;}
  for(const p of [...j.pins,...j.input])assert.equal(await fileHash(path.join(ROOT,p.file)),p.sha256);
  for(const a of j.attribution)assert(Math.abs(a.delta-a.commonDelta-a.addedNet+a.removedNet-a.openDelta)<1e-6);
  const runs:Row[]=j.runs.filter((r:Row)=>r.lag===60000),base=runs.find(r=>r.padding===0)!,old=runs.find(r=>r.padding===3)!;
  const ranked=runs.filter(r=>r.padding>0).sort((a,b)=>row(b).net-row(a).net),best=ranked[0],selected=[base,old,...ranked.slice(0,5)];
  const reportHash=await fileHash(path.join(ROOT,'scripts/sfp-wide-stop-grid-report.ts')),key=sha(JSON.stringify({study:j.key,reportHash}));
  const out=path.join(ROOT,'backtests/sfp-wide-stop-grid-reviews',key);fs.mkdirSync(out,{recursive:true});
  const chart=path.join(out,'best-replay.html');
  if(!fs.existsSync(chart))await writeChart({root:ROOT,scanDir:path.join(ROOT,'backtests/setup-scans',best.scan),replayDir:path.join(ROOT,'backtests/setup-replays',best.replay),timeframes:parseTimeframes('4h,1h'),rows:'all',out:chart});
  const rel=(f:string)=>path.relative(ROOT,f).replace(/\\/g,'/');
  const lines=['# SF07: SFP stop padding 3% to 6%, every 0.25%','',
    '## Result','',
    '- Highest full-period net: extra 6%, +$11,758, 65 wins / 36 losses, DD 5.73%. Extra 5% earns +$11,495 with lower DD 5.29%; only $264 less net.',
    '- Unchanged baseline: +$2,690, 43 wins / 79 losses, DD 7.92%. Previous 3%: +$7,497, 63 wins / 41 losses, DD 8.47%.',
    '- All 5-6% settings have identical recent outcomes: +$3,232, 15 wins / 5 losses. Zero SL hits there; TP and the 24h timeout determine exits. None of the 13 candidates passes the complete inherited screen: recent DD and several older months worsen. No live changes.','',
    '## Frozen comparison','',
    'HYPE Bybit perpetual, **2024-12-27 00:00 to 2026-09-15 20:20 UTC**. Original SF01 range-qualified 4h SFP long, fixed $10,000 notional, separate $32,000 DD account. Fees 0.055% per side, before funding. No indicator filters or ladder integration.', '',
    '**Padding means extra below the old stop**, not total entry-to-stop distance: `stop = originalStop * (1 - padding/100)`. Grid 3.00-6.00 inclusive in 0.25-point steps; unchanged 0% and archived 3% controls. Original signal eligibility, entries, absolute original 2R targets and 24h cap stay fixed. A wider SL does not move TP to a new 2R. Full one-position ownership is replayed, so longer holds can skip later entries.', '',
    'Signal filters still use original reference risk 0.2-5%; this is not a cap on the padded stop. Decisions use completed bars and the same archived availability clocks. Padding is fixed at entry, not selected from a trade\'s future low. Windows are development data, not untouched holdouts.', '',
    '## Top earners with controls','',
    'Primary: source lag 60s, no extra action delay, stop-first on ambiguous minutes. W/L means closed net outcomes after fees; net includes cutoff MTM (+$14.86 baseline, +$25.24 candidates).','',
    '| Extra stop padding | Wins / losses | Winning $ | Losing $ | Average loss | Worst loss | Net | Delta vs baseline | DD |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for(const r of selected){const x=row(r);lines.push(`| ${r.padding}% | ${x.wins} / ${x.losses} | ${cash(x.winningDollars)} | ${cash(x.losingDollars)} | ${cash(x.avgLoss)} | ${cash(x.worst)} | ${cash(x.net)} | ${cash(x.net-row(base).net)} | ${pct(x.maxAdverseDrawdownPct)} |`);}
  lines.push('','## Every tested setting','', '| Extra padding | Wins / losses | Net | Delta vs baseline | DD |','|---|---:|---:|---:|---:|');
  for(const r of [base,...ranked]){const x=row(r);lines.push(`| ${r.padding}% | ${x.wins} / ${x.losses} | ${cash(x.net)} | ${cash(x.net-row(base).net)} | ${pct(x.maxAdverseDrawdownPct)} |`);}
  lines.push('','## Older versus recent','', '| Period / extra padding | Wins / losses | Winning $ | Losing $ | Average loss | Net | Delta vs baseline | DD |','|---|---:|---:|---:|---:|---:|---:|---:|');
  for(const w of ['older','recent'])for(const r of selected){const x=row(r,w),b=row(base,w);lines.push(`| ${w} / ${r.padding}% | ${x.wins} / ${x.losses} | ${cash(x.winningDollars)} | ${cash(x.losingDollars)} | ${cash(x.avgLoss)} | ${cash(x.net)} | ${cash(x.net-b.net)} | ${pct(x.maxAdverseDrawdownPct)} |`);}
  lines.push('','Older ends May 31, 2026; recent starts June 1 and ends at the common September 15 cutoff. Recent DD rises from 2.47% to 3.06% for the top five despite better net. The incremental 6%-over-5% gain comes entirely from older history. Best net is at the widest tested boundary, not an established optimum.','',
    '## Monthly marked net and delta vs baseline','', `| Month | ${selected.map(r=>`${r.padding}%${r.padding?' (delta)':''}`).join(' | ')} |`, `|---|${selected.map(()=>'---:|').join('')}`);
  for(const m of base.monthly.filter((x:Row)=>primary(x)&&x.window==='full'))lines.push(`| ${m.month} | ${selected.map(r=>{const v=r.monthly.find((x:Row)=>primary(x)&&x.window==='full'&&x.month===m.month).markedNet;return `${cash(v)}${r.padding?` (${cash(v-m.markedNet)})`:''}`;}).join(' | ')} |`);
  lines.push('','Months include open MTM, not just exit-month realized PnL; September is partial. Extra 6% loses $584 versus baseline in February 2025, $548 in November and $522 in December, breaching the predeclared -$250 monthly-delta bound.','',
    '## Recovery, occupancy and risk','', '| Extra padding | Old losers becoming wins | Old losers worse | Added loss on worsened losers | Old winners skipped / profit | Common-trade delta | Avoided baseline net | Cutoff delta | Total delta |','|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for(const p of [5,6]){const a=j.attribution.find((x:Row)=>x.lag===60000&&x.padding===p);lines.push(`| ${p}% | ${a.loserToWinner} | ${a.worsenedLosers} | ${cash(a.worsenedLoserDelta)} | ${a.missedWinners} / ${cash(a.missedWinningDollars)} | ${cash(a.commonDelta)} | ${cash(-a.removedNet)} | ${cash(a.openDelta)} | ${cash(a.delta)} |`);}
  lines.push('','Neither 5% nor 6% introduces new closed trade IDs: both omit 21 original trades, including 6 winners. Rescued losers, worse remaining losses and missed opportunities all count. Full TP/SL/timeout counts: baseline 35/73/14; 5% 48/7/46; 6% 48/5/48. Exposure grows from 1,023h to 1,675h at 6%, so funding remains an important unmodeled cost.','',
    '| Extra padding | Median actual SL distance | Maximum distance | Trades above 5% risk | Mean initial dollar risk |','|---|---:|---:|---:|---:|');
  for(const r of selected){const a=j.risk.find((x:Row)=>x.lag===60000&&x.padding===r.padding);lines.push(`| ${r.padding}% | ${pct(a.median)} | ${pct(a.max)} | ${a.exceedsOriginal5Pct}/${a.n} | ${cash(a.avgDollarRisk)} |`);}
  lines.push('','A 6% padding means **7.93% median actual SL distance**, up to 10.88%, not a 6% total stop. Fixed notional is not fixed risk; 5% has a lower observed DD but roughly 6.95% median stop room. Few historical SL hits do not prove future crash safety. No leverage/liquidation model or live execution validation is added here.','',
    '## Verification and qualification','',
    '- 504 audited paths: 14 settings including baseline x 2 source clocks x 18 window/delay/cost/ambiguity paths. 72 control paths reused, 432 new. Source clocks 60/120s; additional action delays 0/60s; normal and +5bps/side stress; stop-first and target-first sensitivities.',
    '- Original baseline result/monthly objects and primary trade CSV bytes match SF01. Both 0% and 3% reuse the exact SF06 replay identities, results, monthly totals and trade hashes. No detector, map or execution-kernel rewrite.',
    '- Each changed action has the same eligibility, ordering, timestamps, entry reference and target as its parent; only stop differs by the declared formula. Trade-to-baseline attribution reconciles including cutoff inventory.',
    '- Ranking remains 6%, 5%, 5.25%, 5.5%, 5.75% at 120s source lag. The 6% primary stress net is +$10,732, versus +$11,758 normal; the 5% stress net is +$10,468.',
    '- Concrete saved 6% trace: January 3, 2025 00:01 UTC entry at $23.21 uses a finalized 4h signal plus 60s availability. The original stop $22.578399 loses $283 at 07:32; the widened stop $21.22369506 is fixed at entry, retains target $24.542202, and exits at that target at 13:05 for $563. No later low chooses the stop. Source clocks and both trade records are saved.',
    `- Complete screen: **${j.screens.filter((x:Row)=>x.passed).length}/13 pass**. Top-five failures are recent DD and individual month regressions, not full net. Historical profitability leads remain distinct from qualified live candidates.`, '',
    '## Artifacts','',
    `[Frozen card](../research-inputs/sfp-wide-stop-grid-sf07-2026-09-20.json) / [all results, months, screens and trade attribution](../${rel(path.join(dir,'comparison.json'))}) / [best 6% interactive trade map](../${rel(chart)}).`, '',
    `Study: \`${j.key}\`. Best replay: \`${best.replay}\`. Each replay directory contains results.csv, monthly.csv, trades-long__r2__hold24h.csv and independent audit.json.`, '',
    '`npx ts-node scripts/sfp-wide-stop-study.ts --card research-inputs/sfp-wide-stop-grid-sf07-2026-09-20.json` reuses verified results. `npx ts-node scripts/sfp-wide-stop-grid-report.ts` reads them and renders the existing chart.', '',
    'No live changes; no commit or push. No new HL/indicator filters, 72h hold or stop settings outside the requested grid.');
  const report=lines.join('\n')+'\n';fs.writeFileSync(path.join(out,'report.md'),report);
  fs.writeFileSync(path.join(ROOT,'research/codex-astra-sfp-wide-stop-grid-findings-2026-09-20.md'),report);
  atomicJson(path.join(out,'verification.json'),{study:j.key,reportHash,hashes,parity:j.parity,paths:j.runs.reduce((n:number,r:Row)=>n+r.results.length,0),screens:j.screens});
  const artifacts=await Promise.all(['report.md','best-replay.html','verification.json'].map(async file=>({file,sha256:await fileHash(path.join(out,file))})));
  atomicJson(path.join(out,'complete.json'),{key,artifacts});console.log(`[SF07] report and map: ${out}`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
