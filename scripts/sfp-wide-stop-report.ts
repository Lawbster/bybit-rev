/** Read sealed SF06 outputs, reconcile attribution, reuse the existing chart renderer. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT } from './setup-scan-core';
import { fileHash,atomicJson,sha } from './research-workflow';
import { writeChart,parseTimeframes } from './setup-chart';
import type { Row } from './tp-hl-event-features';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const pri=(r:Row)=>r.delay===0&&!r.targetFirst&&!r.stress;
const cash=(x:number)=>`${x<0?'-':''}$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
const pct=(x:number)=>`${x.toFixed(2)}%`;
const name=(p:number)=>p===0?'Unchanged baseline':`Extra ${p}% below old stop`;
async function main(){
  const dir=read(path.join(ROOT,'backtests/sfp-wide-stop/latest.json')).dir,j=read(path.join(dir,'comparison.json'));
  let hashes=0;
  for(const d of [dir,...j.runs.map((r:Row)=>path.join(ROOT,'backtests/setup-replays',r.replay))])for(const a of read(path.join(d,'complete.json')).artifacts){assert.equal(await fileHash(path.join(d,a.file)),a.sha256);hashes++;}
  for(const p of [...j.pins,...j.input])assert.equal(await fileHash(path.join(ROOT,p.file)),p.sha256);
  for(const a of j.attribution){assert(Math.abs(a.delta-a.commonDelta-a.addedNet+a.removedNet-a.openDelta)<1e-6);}
  const rs=j.runs.filter((r:Row)=>r.lag===60000),row=(r:Row,w='full')=>r.results.find((x:Row)=>pri(x)&&x.window===w),base=rs.find((r:Row)=>r.padding===0);
  const best=[...rs].sort((a,b)=>row(b).net-row(a).net)[0],top=row(best),a=j.attribution.find((x:Row)=>x.padding===best.padding&&x.lag===60000);
  const reportHash=await fileHash(path.join(ROOT,'scripts/sfp-wide-stop-report.ts')),key=sha(JSON.stringify({study:j.key,reportHash}));
  const rd=path.join(ROOT,'backtests/sfp-wide-stop-reviews',key);fs.mkdirSync(rd,{recursive:true});
  const chart=path.join(rd,'best-replay.html');
  if(!fs.existsSync(chart))await writeChart({root:ROOT,scanDir:path.join(ROOT,'backtests/setup-scans',best.scan),replayDir:path.join(ROOT,'backtests/setup-replays',best.replay),
    timeframes:parseTimeframes('4h,1h'),rows:'all',out:chart});
  const rel=(f:string)=>path.relative(ROOT,f).replace(/\\/g,'/');
  const lines=['# SF06 — wider stops on the most profitable earlier SFP setup','',
    '## Result','',
    `- Extra3% stop padding increases full net **${cash(row(base).net)} → ${cash(top.net)}**, wins43→63, losses79→41. DD7.92%→8.47%. This is a real historical improvement in this replay, not a sum of rescued stops.`,
    '- Trade-off: average loss$196→$375; worst loss$487→$773. Several bearish months worsen. Extra2% is stronger in June–September than extra3%.',
    `- **${j.screens.filter((x:Row)=>x.passed).length}/4 complete screen passes.** Extra3% is a research lead, not a live candidate; no threshold beyond the declared set was searched. No live changes.`, '',
    '## Exact comparison','',
    'HYPE Bybit perpetual, **2024-12-27 00:00 through2026-09-15 20:20 UTC**. Original SF01 range-qualified4h SFP long, fixed$10,000 notional, separate$32,000 account for drawdown. Standard0.055% taker fee/side, before funding. Parent selected as the highest full-period primary net among the earlier SF01 cells; historical selection is not out-of-sample validation.',
    '',
    'Only the execution stop changes: `newStop = originalStop × (1 − extraPadding/100)`. Four candidates:0.5%,1%,2%,3%; unchanged0% baseline. Entry100/old stop98/extra2% gives new stop96.04. **Extra3% is not a total3% stop.**',
    '',
    'Original signal/reference-risk eligibility0.2–5%, market entries, absolute original2R target and24h cap remain unchanged. Wider risk is not used to move TP farther away or discard original signals. Actual R falls because target is fixed. No RSI/EMA/HL filter, earlier confirmation, sweep-low limit, additional leverage,72h extension or ladder integration.',
    '',
    'Saved signals are replayed through full one-position ownership: longer holds can prevent later trades. Only information known at signal is used to widen the stop; no trade-specific padding chosen from its later low.', '',
    '## Full-period results — baseline adjacent','',
    'Primary60s source publication lag, zero extra action delay, stop-first if a minute touches both brackets. Wins/losses are closed net outcomes after fees, not TP/SL labels. Net also includes cutoff open MTM: +$14.86 for baseline/0.5%/1%, +$25.24 for2%/3%.','',
    '| Setup | W / L | Winning $ | Losing $ | Average loss | Worst loss | Net | Delta | DD |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for(const r of rs){const x=row(r);lines.push(`| ${name(r.padding)} | ${x.wins} / ${x.losses} | ${cash(x.winningDollars)} | ${cash(x.losingDollars)} | ${cash(x.avgLoss)} | ${cash(x.worst)} | ${cash(x.net)} | ${cash(x.net-row(base).net)} | ${pct(x.maxAdverseDrawdownPct)} |`);}
  lines.push('','Net-delta ranking: extra3% +$4,807; extra2% +$3,193; extra1% +$1,862; extra0.5% +$740. Best is at the widest tested boundary; this does not identify an optimum.','',
    '## Split windows','', '| Window / setup | W / L | Winning $ | Losing $ | Average loss | Net | Delta | DD |','|---|---:|---:|---:|---:|---:|---:|---:|');
  for(const w of ['older','recent'])for(const r of rs){const x=row(r,w),b=row(base,w);lines.push(`| ${w==='older'?'Dec27,2024–May31,2026':'Jun1–Sep15,2026'} / ${name(r.padding)} | ${x.wins} / ${x.losses} | ${cash(x.winningDollars)} | ${cash(x.losingDollars)} | ${cash(x.avgLoss)} | ${cash(x.net)} | ${cash(x.net-b.net)} | ${pct(x.maxAdverseDrawdownPct)} |`);}
  lines.push('','Recent extra2%: +$2,620/DD3.01%, versus extra3% +$2,307/DD3.30%. Both beat unchanged +$1,397 net, but neither improves its2.47% DD. The3% full-period lead comes from older history, not consistent dominance over2%.','',
    '## Monthly marked net (delta versus unchanged)','', '| Month | Baseline | Extra0.5% (delta) | Extra1% (delta) | Extra2% (delta) | Extra3% (delta) |','|---|---:|---:|---:|---:|---:|');
  for(const m of base.monthly.filter((m:Row)=>pri(m)&&m.window==='full')){const vals=rs.map((r:Row)=>r.monthly.find((x:Row)=>pri(x)&&x.window==='full'&&x.month===m.month).markedNet);
    lines.push(`| ${m.month} | ${cash(vals[0])} | ${vals.slice(1).map((v:number)=>`${cash(v)} (${cash(v-vals[0])})`).join(' | ')} |`);}
  lines.push('','September is partial; monthly values include open MTM, not just exits assigned to an exit month. Extra3% makes January2025 $875 worse, June2025 $607 worse, July2025 $589 worse, among other regressions. More profitable overall does not mean better tail behavior in every period.','',
    '## Does it really rescue the stop-outs?','', '| Padding | Old loser→winner | Old winner→loser | Old winners skipped / their profit | Old losses made worse / extra loss | Common-trade delta | Removed baseline net | Cutoff delta | Total delta |','|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for(const x of j.attribution.filter((x:Row)=>x.lag===60000))lines.push(`| ${x.padding}% | ${x.loserToWinner} | ${x.winnerToLoser} | ${x.missedWinners} / ${cash(x.missedWinningDollars)} | ${x.worsenedLosers} / ${cash(x.worsenedLoserDelta)} | ${cash(x.commonDelta)} | ${cash(x.removedNet)} | ${cash(x.openDelta)} | ${cash(x.delta)} |`);
  lines.push('','For extra3%:', '',
    '-24 original losing trades become winners: their old net was-$4,748; their new net is+$6,142. This is not merely skipping losing signals.',
    '-30 original losers get worse by a combined$7,354. The largest realized loss grows from-$487 to-$773 (June21,2025). Larger losses offset much of the benefit.',
    '-Longer ownership prevents18 original trades, including4 winners worth$1,402 and14 losers. Skipped trades had a net loss of$887. No new closed trade IDs appear on the primary paths.',
    '-Accounting: common-trade change+$3,910, avoided net loss+$887, cutoff difference+$10 = total+$4,807. Full trade-pair attribution is saved.',
    '-TP/SL/timeout counts:35/73/14 baseline →47/22/35. Some recovery benefit comes from less-bad or profitable time exits, not all from reaching the target.',
    '-Exposure grows from1,023 to1,555 hours. Funding remains excluded; extra cost stress is not a substitute for exact funding attribution.', '',
    '## Actual stop risk','', '| Extra padding | Median stop distance from fill | Maximum | Trades with actual risk >5% | Mean initial dollar risk |','|---|---:|---:|---:|---:|');
  for(const r of j.risk.filter((r:Row)=>r.lag===60000))lines.push(`| ${r.padding}% | ${pct(r.median)} | ${pct(r.max)} | ${r.exceedsOriginal5Pct}/${r.n} | ${cash(r.avgDollarRisk)} |`);
  lines.push('','The original0.2–5% filter is measured from the completed signal reference, not the later fill; even baseline has two fills slightly above5% actual risk. At extra3%, median room is5.01% and the maximum8.03%. Fixed$10k notional is **not fixed dollar risk**. Realized worst loss and maximum initial risk differ because not all positions reach SL.','',
    '## Timing, costs and verification','',
    '-180 paths:5 stop settings ×2 source clocks ×3 windows ×6 action-delay/ambiguity/cost cases. Every path independently audited. Baseline result/monthly objects and primary trade CSV bytes exactly match archived SF01 for both source lags.',
    '-Padding changes only the stop field after original signal eligibility, target calculation and tie-breaking. Tests cover long/short arithmetic, zero parity, invalid padding, prefix stability, ownership, gap-through-stop, delayed deadlines, cutoff inventory and audit tampering.',
    '-No detector/map rebuilding and no use of the final4h candle before confirmation. Saved level/range clocks are checked against sweep/reclaim availability.',
    '-Concrete causal rescue: March7,2025 00:01 UTC, signal known after finalized4h+60s, entry15.409. Original stop15.014970 triggers00:23 for-$267. Extra3% sets14.5645209 immediately at entry; the same target16.191060 fills01:18 for+$496. Stop padding and target were known before either future event.',
    '-Extra3% net stays+$7,170 to+$7,497 across source/action delay combinations, versus baseline+$2,457 to+$2,690. With extra5bps/side it stays+$6,116 to+$6,442. Costs and small delays do not erase the full-period gain.',
    '-Inherited screen: each full/split net and DD versus its identical-clock baseline; month delta no worse than-$250; counts; full PF/top5 concentration; positive stress/delay windows; both source clocks.0/4 pass. Extra3% fails DD and monthly stability, not full profitability or a single two-trade dependence.',
    '-The generic per-run report describes exploratory controls; this frozen card and comparison define the qualifying screen. Historical development data and selection among4 candidates are not forward validation.', '',
    '## Saved outputs','',
    `[Study card](../research-inputs/sfp-wide-stop-sf06-2026-09-20.json) / [comparison, monthly paths, screens and attribution](../${rel(path.join(dir,'comparison.json'))}) / [best3% interactive replay](../${rel(chart)}).`, '',
    `Study key: \`${j.key}\`. Per-run results.csv, monthly.csv and trades-long__r2__hold24h.csv are under the replay keys in comparison.json. Best3% replay key: \`${best.replay}\`.`, '',
    'Commands: `npx ts-node scripts/sfp-wide-stop-study.ts`; `npx ts-node scripts/sfp-wide-stop-report.ts`. Study outputs are hash-verified and reused. Stop-only execution override is reusable through ReplayConfig.exitStopPaddingPct; it is separate from the older stopBufferPct option, which recalculates original brackets.', '',
    'No live config/order behavior changed. No commit or push performed.');
  const report=lines.join('\n')+'\n';fs.writeFileSync(path.join(rd,'report.md'),report);
  fs.writeFileSync(path.join(ROOT,'research/codex-astra-sfp-wide-stop-findings-2026-09-20.md'),report);
  atomicJson(path.join(rd,'verification.json'),{study:j.key,reportHash,hashes,baseline:j.parity,paths:180,attributionChecks:j.attribution.length,screens:j.screens});
  const artifacts=await Promise.all(['report.md','best-replay.html','verification.json'].map(async file=>({file,sha256:await fileHash(path.join(rd,file))})));
  atomicJson(path.join(rd,'complete.json'),{key,artifacts});console.log(`[SF06] report + chart ${rd}`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
