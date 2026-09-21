/** Derived report; never modifies accepted outputs or selects extra variants. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {atomicJson,sha,verifyPins}from './research-workflow';
import {exposureDelta}from './ladder-exposure-metrics';
type R=Record<string,any>;
const P='age10__minus_deep_stress__minus_tp_cooldown',read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const usd=(n:number)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`,pct=(n:number)=>`${n.toFixed(2)}%`;
function csv(file:string,rows:R[]){const keys=Object.keys(rows[0]);fs.writeFileSync(file,[keys,...rows.map(r=>keys.map(k=>r[k]??''))].map(xs=>xs.map(x=>JSON.stringify(String(x))).join(',')).join('\n')+'\n');}
async function main(){const key=process.argv[2],dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,v=read(`${dir}/verification.json`);
  assert(v.passed);const plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
  const standalone:R[]=read(`${out}/standalone-results.json`),ladder:R[]=read(`${out}/ladder-results.json`),comps:R[]=read(`${out}/ladder-comparisons.json`);
  const dest=`backtests/hype/entry-patience-bh03-l16-2026-09-14`;fs.mkdirSync(dest,{recursive:true});
  const peer=(x:R)=>ladder.find(b=>b.control&&b.policy===P&&b.window===x.window&&b.tp===x.tp)!;
  const rows=ladder.map(x=>{const m=x.metrics,b=peer(x),delta=exposureDelta(m,b.metrics),a=v.ladderAccounting.find((r:R)=>r.name===x.name).accounting;
    return {name:x.name,policy:x.policy,window:x.window,tp:x.tp,model:x.model,control:x.control,wins:m.profitableEpisodes,losses:m.losingEpisodes,
      winningDollars:m.grossWin,losingDollars:-m.grossLoss,averageLoss:m.losingEpisodes?-m.grossLoss/m.losingEpisodes:0,
      net:m.totalPnl,realized:m.realized,open:m.openPnl,unfinishedPartials:m.unfinishedPartialPnl,openRungs:m.openDepth,dd:m.maxDrawdownPct,
      tpCycles:m.tpCycles,forcedCloses:m.forcedCloses,hardFlattens:m.episodes.filter((e:R)=>e.reason==='hard_flatten').length,
      highExits:x.highExits,delta:delta.pnlDelta,ddReduction:delta.ddReductionPp,worstMonthDelta:delta.worstMonthDelta,
      ...x.counts,extra5bpsNet:a.fixedPathExtra5bpsNet};});
  const ranking=[...new Set(ladder.filter(x=>!x.control).map(x=>x.policy))].map(policy=>{
    const cases=ladder.filter(x=>x.policy===policy),failures:string[]=[];
    for(const x of cases){const dx=exposureDelta(x.metrics,peer(x).metrics),recent=x.window==='hl_extended';
      if(dx.pnlDelta<(x.model==='open'&&recent?1000:1e-8))failures.push(`${x.name}:net`);
      if(dx.ddReductionPp< -1e-8)failures.push(`${x.name}:DD`);if(dx.worstMonthDelta< -250)failures.push(`${x.name}:month`);
      if(recent&&x.counts.affectedEpisodes<20)failures.push(`${x.name}:thin`);
      if(v.ladderAccounting.find((r:R)=>r.name===x.name).accounting.firstNonpositive)failures.push(`${x.name}:equity`);
    }
    return{policy,passed:!failures.length,failures,minimumRecentPrimaryDelta:Math.min(...cases.filter(x=>x.window==='hl_extended'&&x.model==='open').map(x=>exposureDelta(x.metrics,peer(x).metrics).pnlDelta))};
  }).sort((a,b)=>b.minimumRecentPrimaryDelta-a.minimumRecentPrimaryDelta);
  const standaloneRows=standalone.map(x=>{const b=standalone.find(a=>a.window===x.window&&a.delayMs===x.delayMs&&a.model==='market'&&a.executionBps===x.executionBps&&a.control===x.control)!;
    const s=x.stats;return {name:x.name,window:x.window,delay:x.delayMs,cost:x.executionBps??'control',model:x.model,
      wins:s.wins,losses:s.losses,winningDollars:s.winningDollars,losingDollars:s.losingDollars,averageLoss:s.losses?s.losingDollars/s.losses:0,
      net:s.net,dd:s.maxAdverseDrawdownPct,delta:s.net-b.stats.net,baselineNet:b.stats.net,baselineDD:b.stats.maxAdverseDrawdownPct,
      expired:x.entryStats.expired,worstMonthDelta:Math.min(...x.monthly.map((m:R)=>m.markedNet-b.monthly.find((a:R)=>a.month===m.month).markedNet))};});
  const monthly=ladder.flatMap(x=>v.ladderAccounting.find((r:R)=>r.name===x.name).accounting.monthly.map((m:R)=>({name:x.name,policy:x.policy,
    window:x.window,tp:x.tp,model:x.model,...m,averageLoss:m.losses?m.lossDollars/m.losses:0,
    baselineNet:peer(x).metrics.monthly.find((b:R)=>b.month===m.month).mtmPnl,delta:m.mtmPnl-peer(x).metrics.monthly.find((b:R)=>b.month===m.month).mtmPnl})));
  csv(path.join(dest,'ladder-cases.csv'),rows);csv(path.join(dest,'standalone-cases.csv'),standaloneRows);csv(path.join(dest,'ladder-monthly.csv'),monthly);
  const attr=ladder.filter(x=>!x.control).map(x=>{const b=peer(x),bm=new Map<string,R>(b.metrics.episodes.map((e:R)=>[e.entry,e])),vm=new Map<string,R>(x.metrics.episodes.map((e:R)=>[e.entry,e]));
    const gone=b.metrics.episodes.filter((e:R)=>!vm.has(e.entry)),fresh=x.metrics.episodes.filter((e:R)=>!bm.has(e.entry));
    const a=comps.find(c=>c.name===x.name)![P].attribution;
    return {name:x.name,...a,missedWinningDollars:gone.reduce((n:number,e:R)=>n+Math.max(0,e.pnl),0),avoidedLosingDollars:gone.reduce((n:number,e:R)=>n-Math.min(0,e.pnl),0),
      replacementWins:fresh.filter((e:R)=>e.pnl>0).length,replacementLosses:fresh.filter((e:R)=>e.pnl<0).length,
      replacementWinningDollars:fresh.reduce((n:number,e:R)=>n+Math.max(0,e.pnl),0),replacementLosingDollars:fresh.reduce((n:number,e:R)=>n+Math.min(0,e.pnl),0)};});
  csv(path.join(dest,'ladder-attribution.csv'),attr);
  csv(path.join(dest,'standalone-monthly.csv'),standalone.flatMap(x=>{const b=standalone.find(a=>a.window===x.window&&a.delayMs===x.delayMs&&a.model==='market'&&a.executionBps===x.executionBps&&a.control===x.control)!;
    return x.monthly.map((m:R)=>({name:x.name,window:x.window,delay:x.delayMs,cost:x.executionBps??'control',...m,baselineNet:b.monthly.find((a:R)=>a.month===m.month).markedNet,delta:m.markedNet-b.monthly.find((a:R)=>a.month===m.month).markedNet}));}));
  atomicJson(path.join(dest,'ranking.json'),ranking);
  const lines=['# Fifteen-minute entry patience — BH03 / L16 — September 14, 2026','','## TL;DR','',
    `- 60 standalone pricing cases and 56 ladder cases; 20 exact archived controls. Six new ladder definitions; no new BTC signal.`,
    `- ${ranking.filter(x=>x.passed).length}/6 ladder rules pass the full incremental screen. Baselines below are unchanged Aggressive10; B17 is a separate reference.`,
    '- Research only. No live changes, exact limit-fill certification, new expiry search or maker-fee credit.','','## Practical finding','',
    'Entry patience has not transferred into a robust ladder upgrade. The strongest recent resting-TP result is timer8_cap0.1: net$43,368 versus Aggressive10$38,080,15 extra TP cycles and$2,706 less losing dollars, but DD20.95% versus20.39%. It loses$3,481 versus the recent confirmed-exit parent and$572 in the published resting-TP window. The latter DD rises25.09% to26.18%.',
    'A0% extra-drop cap reproduces the zero-delay parent because eligible entries fill immediately. Its delayed-activation sensitivity changes the trade path; that does not make15m expiry alone a proven edge. Broadly delaying every timed add often removes winning dollars alongside losing dollars.',
    'The BTC-specific standalone15m rule remains a separate execution-sensitive lead: with5bps/side modeled execution cost plus fees and60s delay, recent net$5,149/DD7.14% versus original$3,529/DD9.63%; older$22,022/DD16.95% versus$10,844/DD22.95%. However recent May costs$1,725 and September costs$829 against that baseline. No full monthly-screen pass or executable-fill claim.',
    '', '## Scope and interpretation','',
    'Ladder: $32k flat start, $800 x1.35, 11 rungs, existing gates and Aggressive10 exits, 0.055% fees each side. No funding settlement or exact liquidation model. The actual carried-in live B17 ladder is NOT reseeded or changed by these runs.',
    'Recent ladder window: May17 20:43–September14 15:27 UTC, 2026. Published window: July1,2025–August19 21:32 UTC,2026. These overlap; do not add their PnLs or treat them as independent holdouts.',
    'Standalone: original BTC1h -0.5% threshold-cross buy, $10k,12h hold. Older January20,2025–May17,2026; recent May17–September14 15:27. Both use prior corrected candles; BTC historical gaps still exclude signals.',
    'The timer-only cap is frozen on first gate-approved opportunity; after15m it expires, with no re-arm until its reserved30/60m interval ends. Drop adds retain priority; partials/exits/gate failures invalidate waiting opportunities. First rung unchanged.',
    '“open” requires a closed minute at/below cap and the next open still at/below cap; charges that open. “cap” charges the target even when the print is lower. “activation60” adds a minimum60s delay only to the new window before it can propose entry. These are historical fill proxies, not measured bid/ask liquidity.',
    '“resting_touch” uses an already-armed TP touched on a later minute; “close_confirmed” is an execution sensitivity, not a proposal to wait for candle-close TP live. Average losses and W/L dollars use completed episodes; net and DD include unfinished inventory.',
    '', '## BH03: execution cost and standalone selection','',
    'Adverse execution cost is applied to BOTH original market entries and capped entries, and to exits, in addition to fees. Estimated buy prices above the cap are rejected, not clipped down. Costs change fills/occupancy, so higher modeled cost need not lower the capped strategy’s net monotonically. Open marks retain the original fee-adjusted candle valuation; slippage is charged on actual simulated exits.',
    '', '| Window | Delay | Cost/side | Market net / DD | 15m cap net / DD | Stricter support net / DD |','|---|---|---|---|---|---|'];
  for(const window of ['older','recent'])for(const delay of [0,60000])for(const cost of [0,2,5,10]){
    const a=['market','open_cap','open_through5'].map(model=>standaloneRows.find(x=>x.window===window&&x.delay===delay&&x.cost===cost&&x.model===model)!);
    lines.push(`| ${window} | ${delay/1000}s | ${cost}bps | ${a.map(x=>`${usd(x.net)} / ${pct(x.dd)}`).join(' | ')} |`);
  }
  lines.push('','The5bps scenario below is predeclared, not fitted to live slippage. All cases and months are in the CSVs. A positive total does not waive monthly costs.','',
    '| Window | Delay | Market W/L, win $, loss $ | 15m W/L, win $, loss $ | Mean loss: market /15m | Worst monthly Δ |','|---|---|---|---|---|---|');
  for(const window of ['older','recent'])for(const delay of [0,60000]){const a=standaloneRows.find(x=>x.window===window&&x.delay===delay&&x.cost===5&&x.model==='market')!,b=standaloneRows.find(x=>x.window===window&&x.delay===delay&&x.cost===5&&x.model==='open_through5')!;
    lines.push(`| ${window} | ${delay/1000}s | ${a.wins}/${a.losses}, ${usd(a.winningDollars)}, ${usd(a.losingDollars)} | ${b.wins}/${b.losses}, ${usd(b.winningDollars)}, ${usd(b.losingDollars)} | ${usd(a.averageLoss)} / ${usd(b.averageLoss)} | ${usd(b.worstMonthDelta)} |`);}
  lines.push('','In the ladder tables, forced closes include deliberate two-day-high exits; they are not all losing hard flattens. Hard-flatten counts are separated in ladder-cases.csv.');
  for(const window of ['hl_extended','published_window'])for(const tp of ['resting_touch','close_confirmed']){
    lines.push('',`## Ladder — ${window}, ${tp}`,'','| Setup | W/L | Winning $ | Losing $ | Avg loss | Net | Δ Agg10 | DD | TP / forced | Open $ (rungs) |', '|---|---|---|---|---|---|---|---|---|---|');
    const selected=rows.filter(x=>x.window===window&&x.tp===tp&&x.model==='open');
    for(const x of selected)lines.push(`| ${x.policy===P?'Aggressive10 baseline':x.policy==='baseline'?'B17 reference':x.policy} | ${x.wins}/${x.losses} | ${usd(x.winningDollars)} | ${usd(x.losingDollars)} | ${usd(x.averageLoss)} | ${usd(x.net)} | ${usd(x.delta)} | ${pct(x.dd)} | ${x.tpCycles}/${x.forcedCloses} | ${usd(x.open)} (${x.openRungs}) |`);
    lines.push('','Monthly marked net; variant cells show absolute net (Δ versus Aggressive10). B17 reference kept separately in CSV.','',
      '| Month | Aggressive10 | '+selected.filter(x=>!x.control).map(x=>x.policy).join(' | ')+' |', '|---|---|'+selected.filter(x=>!x.control).map(()=>'---').join('|')+'|');
    const p=selected.find(x=>x.policy===P)!;
    for(const m of monthly.filter(x=>x.name===p.name))lines.push(`| ${m.month} | ${usd(m.mtmPnl)} | ${selected.filter(x=>!x.control).map(x=>{const a=monthly.find(v=>v.name===x.name&&v.month===m.month)!;return `${usd(a.mtmPnl)} (${usd(a.delta)})`;}).join(' | ')} |`);
  }
  lines.push('','## Recent execution sensitivities','','| Rule | TP model | Primary net / DD | Cap-charge net / DD | 60s activation net / DD |','|---|---|---|---|---|');
  for(const r of ranking)for(const tp of ['resting_touch','close_confirmed']){
    const a=['open','cap','activation60'].map(model=>rows.find(x=>x.window==='hl_extended'&&x.tp===tp&&x.policy===r.policy&&x.model===model)!);
    lines.push(`| ${r.policy} | ${tp} | ${a.map(x=>`${usd(x.net)} / ${pct(x.dd)}`).join(' | ')} |`);
  }
  lines.push('','## Qualification and invisible costs','','Require recent primary +$1000, positive published delta, no worse DD, no month below parent by more than$250, at least20 affected recent episodes, and positive incremental sensitivity results. This is a research screen, not deployment approval.');
  for(const r of ranking)lines.push(`\n- ${r.policy}: ${r.passed?'PASS':'FAIL'}; minimum recent primary Δ ${usd(r.minimumRecentPrimaryDelta)}. Failures: ${r.failures.join('; ')||'none'}.`);
  lines.push('','Full episode-entry matched/removed/replacement attribution is retained in accepted ladder-comparisons.json. Differences in open/unfinished partial PnL are separated from closed episode changes; counting fewer losers alone is not an improvement certificate.',
    '', '## Causal decision example','',
    'May18,2026 17:20 UTC: an otherwise-approved rung8 timed add observes the just-closed minute at$45.212 and freezes a0.1%-lower cap$45.166788. It is blocked at that close. At17:21 the completed minute is$45.162; only the following minute open at17:21, also$45.162, fills. No earlier wick or future close is used. A separate rung11 opportunity froze$47.295, cap$47.247705, and expired without filling; its reference never drifted.',
    '', '## Verification and artifacts','',
    `Independent ${v.fills.toLocaleString()} fills, ${v.minutes.toLocaleString()} minute marks, ${v.windowChecks.toLocaleString()} waiting-rule checks, ${v.targets.toLocaleString()} TP policy checks and ${v.highChecks.toLocaleString()} high-exit checks. Twenty archived controls reproduced exactly before variants.25 fixtures and focused typecheck pass.`,
    'The post-run review adapter supplies lag=0 explicitly and skips comparison with unpersisted summary counters. Every TP target, minute-level policy and observation remains independently checked. Worker/accepted sources and all outcomes remain unchanged; these are checker metadata corrections, not strategy changes.',
    `Job: backtests/research-workflow/${key}. Frozen method: docs/research/entry-patience-bh03-l16.md. Derived CSVs and ranking: ${dest}.`,
    'Reproduction: node -r ts-node/register scripts/entry-patience-tests.ts; study.ts plan/run KEY through the same prefix. Use scripts/entry-patience-review.ts KEY for the complete independent check (the initial verify.ts is preserved, not the final adapter). scripts/entry-patience-report.ts KEY generates CSVs and emits the findings as an apply_patch payload. Completed jobs are immutable; do not bypass the one-run claim.',
    'No exchange requests, source-data repairs, config/state writes, commit, push or deployment. No globally optimal claim.');
  const text=lines.join('\n')+'\n';atomicJson(path.join(dest,'receipt.json'),{key,sourceSha256:sha(fs.readFileSync(__filename,'utf8')),reportSha256:sha(text),cases:116});
  process.stdout.write('*** Begin Patch\n*** Add File: research/codex-astra-entry-patience-findings-2026-09-14.md\n'+text.trimEnd().split('\n').map(x=>'+'+x).join('\n')+'\n*** End Patch\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
