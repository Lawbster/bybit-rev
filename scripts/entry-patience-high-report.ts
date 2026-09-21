/** Derived outputs only. Accepted replay artifacts are immutable. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
import {exposureDelta} from './ladder-exposure-metrics';
import {componentAttribution} from './ladder-combination-accounting';
type R=Record<string,any>;const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const money=(n:number)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`;
const pct=(n:number)=>`${n.toFixed(2)}%`;
const LABEL:R={high_on:'Aggressive10 baseline',high_on_wait:'Aggressive10 + wait',high_off:'No high exit',high_off_wait:'No high exit + wait'};
const ARMS=Object.keys(LABEL);
function csv(file:string,rows:R[]){assert(rows.length);const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  fs.writeFileSync(file,[keys,...rows.map(r=>keys.map(k=>r[k]??''))].map(a=>a.map(x=>JSON.stringify(String(x))).join(',')).join('\n')+'\n');}
export async function report(key:string){assert(/^[a-f0-9]{64}$/.test(key));
  const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,p=read(`${dir}/plan.json`),d=p.card.definition,
    state=read(`${dir}/state.json`),v=read(`${dir}/verification.json`);assert(v.passed);
  await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...state.artifacts]);
  const rows:R[]=read(`${out}/results.json`),dest='backtests/hype/entry-patience-high-interaction-2026-09-15';
  fs.mkdirSync(dest,{recursive:true});
  const get=(w:string,tp:string,arm:string,model='open'):R=>{const x=rows.find(x=>x.window===w&&x.tp===tp&&x.arm===arm&&x.model===model);assert(x);return x;};
  const baseline=(x:R)=>get(x.window,x.tp,'high_on');
  const accounting=(x:R)=>v.accounting.find((a:R)=>a.name===x.name).accounting;
  const cases=rows.map(x=>{const m=x.metrics,dx=exposureDelta(m,baseline(x).metrics);return {name:x.name,window:x.window,tp:x.tp,arm:x.arm,model:x.model,
    wins:m.profitableEpisodes,losses:m.losingEpisodes,winningDollars:m.grossWin,losingDollars:-m.grossLoss,
    averageLoss:m.losingEpisodes?-m.grossLoss/m.losingEpisodes:0,net:m.totalPnl,realized:m.realized,open:m.openPnl,
    unfinishedPartials:m.unfinishedPartialPnl,openRungs:m.openDepth,dd:m.maxDrawdownPct,tpCycles:m.tpCycles,forcedCloses:m.forcedCloses,
    hardFlattens:m.episodes.filter((e:R)=>e.reason==='hard_flatten').length,highExits:x.highExits,
    delta:dx.pnlDelta,ddReductionPp:dx.ddReductionPp,worstMonthDelta:dx.worstMonthDelta,
    fees:accounting(x).modeledFees,extra5bpsNet:accounting(x).fixedPathExtra5bpsNet,...x.counts};});
  const monthly=rows.flatMap(x=>accounting(x).monthly.map((m:R)=>({name:x.name,window:x.window,tp:x.tp,arm:x.arm,model:x.model,...m,
    averageLoss:m.losses?m.lossDollars/m.losses:0,baselineNet:baseline(x).metrics.monthly.find((b:R)=>b.month===m.month).mtmPnl,
    delta:m.mtmPnl-baseline(x).metrics.monthly.find((b:R)=>b.month===m.month).mtmPnl})));
  const interactions:R[]=[],attrs:R[]=[],comparisons:R[]=[];
  for(const w of d.windows)for(const tp of d.tpModels){const [a,b,c,e]=ARMS.map(arm=>get(w.id,tp,arm));
    const net=(x:R)=>x.metrics.totalPnl;
    interactions.push({window:w.id,tp,baselineNet:net(a),waitHighOn:net(b)-net(a),waitHighOff:net(e)-net(c),
      interaction:(net(e)-net(c))-(net(b)-net(a)),removingHighNoWait:net(c)-net(a),removingHighWithWait:net(e)-net(b),combinedDelta:net(e)-net(a)});
    for(const [x,base] of [[b,a],[c,a],[e,a],[e,c],[e,b]]){
      const bm=new Map<string,R>(base.metrics.episodes.map((e:R)=>[e.entry,e])),vm=new Map<string,R>(x.metrics.episodes.map((e:R)=>[e.entry,e]));
      const removed=base.metrics.episodes.filter((e:R)=>!vm.has(e.entry)),fresh=x.metrics.episodes.filter((e:R)=>!bm.has(e.entry));
      const attr=componentAttribution(x.metrics,base.metrics);
      attrs.push({window:w.id,tp,arm:x.arm,baseline:base.arm,...attr,
        removedWinningDollars:removed.reduce((n:number,e:R)=>n+Math.max(0,e.pnl),0),removedLosingDollars:removed.reduce((n:number,e:R)=>n+Math.min(0,e.pnl),0),
        replacementWinningDollars:fresh.reduce((n:number,e:R)=>n+Math.max(0,e.pnl),0),replacementLosingDollars:fresh.reduce((n:number,e:R)=>n+Math.min(0,e.pnl),0),
        tpCycleDelta:x.metrics.tpCycles-base.metrics.tpCycles,hardFlattenDelta:x.metrics.episodes.filter((e:R)=>e.reason==='hard_flatten').length-base.metrics.episodes.filter((e:R)=>e.reason==='hard_flatten').length});
      comparisons.push({name:x.name,base:base.name,delta:exposureDelta(x.metrics,base.metrics),attribution:attr});
    }
  }
  const ranking=ARMS.slice(1).map(arm=>{const failures:string[]=[];
    for(const x of rows.filter(x=>x.arm===arm)){const dx=exposureDelta(x.metrics,baseline(x).metrics),recent=x.window==='hl_extended';
      if(dx.pnlDelta<(recent&&x.model==='open'?d.screen.minimumRecentDelta:1e-8))failures.push(`${x.name}:net`);
      if(dx.ddReductionPp< -1e-8)failures.push(`${x.name}:DD`);
      if(dx.worstMonthDelta<d.screen.monthlyDeltaFloor)failures.push(`${x.name}:month`);
      if(accounting(x).firstNonpositive)failures.push(`${x.name}:nonpositive_equity`);
    }
    return {arm,passed:!failures.length,failures,minRecentPrimaryDelta:Math.min(...rows.filter(x=>x.arm===arm&&x.window==='hl_extended'&&x.model==='open').map(x=>x.metrics.totalPnl-baseline(x).metrics.totalPnl))};
  }).sort((a,b)=>b.minRecentPrimaryDelta-a.minRecentPrimaryDelta);
  csv(path.join(dest,'cases.csv'),cases);csv(path.join(dest,'monthly.csv'),monthly);csv(path.join(dest,'interaction.csv'),interactions);csv(path.join(dest,'attribution.csv'),attrs);
  atomicJson(path.join(dest,'comparisons.json'),comparisons);atomicJson(path.join(dest,'ranking.json'),ranking);
  const lines=['# Waiting entries without the two-day-high exit (L17)','','## TL;DR','',
    '- 20 cases: four-arm factorial across two overlapping windows and two TP assumptions, plus recent cap-charge sensitivity; ten exact archived controls.',
    `- ${ranking.filter(x=>x.passed).length}/3 modifications pass the full screen against unchanged Aggressive10. The interaction table separates waiting benefit from removing the exit.`,
    '- Research only. No live config, code, state, exchange, short or deployment changes.','',
    '## What is changed','',
    'The removed feature is a full exit when ladder age is at least 4h and price is within 1% of its trailing 48h high, not an entry blocker. Its consequent cooldowns disappear too; cooldowns after other forced exits remain. Everything else stays Aggressive10, including the 10h soft-stale TP and its two disabled legacy guards.',
    'Waiting = otherwise-approved timed adds at rungs 8-11 require a closed minute and next open at least 0.1% below the frozen last-closed-minute reference; expiry is 15m, exclusive. First rung and genuine drop adds unchanged. Existing gates, TP/exits, inventory invalidation and 30/60m rearm reservation remain authoritative.',
    'Each run starts flat with $32,000 equity, $800 x1.35 and max11. Both entry and exit fees are 0.055%; no maker savings, funding settlement or precise liquidation model. Open inventory is marked into net/DD. W/L dollars and averages are completed episodes, so they need not sum to total marked net.',
    'Recent: May17 20:43 through September14 15:27 UTC, 2026. Published: July1,2025 through August19 21:32 UTC,2026. Same accepted L16 candles/cutoffs; overlapping windows are not independent holdouts. This does not reseed the current live B17 carry-in ladder.',
    'Resting touch = an already-armed TP touched on a subsequent bar. Confirmed close is an execution sensitivity, not a change to live exchange TP. Minute-price cap qualification is a proxy, not proof of available ask liquidity or a PostOnly fill.','',
    '## Direct interaction','',
    '| Window | TP model | Agg10 net | Wait benefit, high on | Wait benefit, high off | Interaction | Remove high, no wait | Remove high, with wait | Combined delta vs Agg10 |',
    '|---|---|---|---|---|---|---|---|---|'];
  for(const x of interactions)lines.push(`| ${x.window} | ${x.tp} | ${[x.baselineNet,x.waitHighOn,x.waitHighOff,x.interaction,x.removingHighNoWait,x.removingHighWithWait,x.combinedDelta].map(money).join(' | ')} |`);
  lines.push('','Interaction = waiting benefit without high exit minus waiting benefit with it. A positive interaction can still accompany much worse absolute profit and DD. Compare the combined result with the unchanged baseline before drawing a practical conclusion.');
  for(const w of d.windows)for(const tp of d.tpModels){const xs=ARMS.map(arm=>cases.find(x=>x.window===w.id&&x.tp===tp&&x.arm===arm&&x.model==='open')!);
    lines.push('',`## ${w.id}: ${tp}`,'','| Setup | Wins | Winning $ | Losses | Losing $ | Avg loss | Net | Delta vs Agg10 | DD | TP / forced | Hard flattens | Open $ (rungs) |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for(const x of xs)lines.push(`| ${LABEL[x.arm]} | ${x.wins} | ${money(x.winningDollars)} | ${x.losses} | ${money(x.losingDollars)} | ${money(x.averageLoss)} | ${money(x.net)} | ${money(x.delta)} | ${pct(x.dd)} | ${x.tpCycles}/${x.forcedCloses} | ${x.hardFlattens} | ${money(x.open)} (${x.openRungs}) |`);
    lines.push('','Monthly marked net. Parentheses show difference versus unchanged Aggressive10. Full W/L count/dollars by month are in monthly.csv.','',
      '| Month | Agg10 | Agg10 + wait | No high exit | No high exit + wait |','|---|---|---|---|---|');
    for(const m of monthly.filter(x=>x.name===xs[0].name))lines.push(`| ${m.month} | ${money(m.mtmPnl)} | ${xs.slice(1).map(x=>{const y=monthly.find(y=>y.name===x.name&&y.month===m.month)!;return `${money(y.mtmPnl)} (${money(y.delta)})`;}).join(' | ')} |`);
  }
  lines.push('','## Recent cap-charge sensitivity','',
    'Same qualifying prints; charge the cap instead of a lower open. Changed fill costs can change later ladder occupancy. It is not a limit-fill guarantee.',
    '','| TP model | High exit | No-wait net / DD | Waiting, open net / DD | Waiting, cap-charge net / DD |','|---|---|---|---|---|');
  for(const tp of d.tpModels)for(const enabled of [true,false]){const arm=enabled?'high_on':'high_off';
    const xs=[get('hl_extended',tp,arm),get('hl_extended',tp,arm+'_wait'),get('hl_extended',tp,arm+'_wait','cap')];
    lines.push(`| ${tp} | ${enabled?'on':'off'} | ${xs.map(x=>`${money(x.metrics.totalPnl)} / ${pct(x.metrics.maxDrawdownPct)}`).join(' | ')} |`);}
  lines.push('','## Path attribution and invisible costs','',
    'Removing the exit changes full ladder occupancy, partials, subsequent entries and cooldowns. Removed/replacement episode attribution is descriptive; different timestamps are not individually identifiable counterfactual trades. Full values for all primary comparisons are in attribution.csv.',
    '','| Recent resting comparison | Matched episode delta | Removed episode net (n) | Replacement net (n) | Open/unfinished delta | TP cycle delta |',
    '|---|---|---|---|---|---|');
  for(const x of attrs.filter(x=>x.window==='hl_extended'&&x.tp==='resting_touch'))lines.push(`| ${LABEL[x.arm]} vs ${LABEL[x.baseline]} | ${money(x.matchedDelta)} | ${money(x.removedNet)} (${x.removed}) | ${money(x.replacementNet)} (${x.replacement}) | ${money(x.openAndUnfinishedDelta)} | ${x.tpCycleDelta} |`);
  lines.push('','## Qualification','',
    'Predeclared: recent primary net delta >=$1,000; published delta >0; no worse DD; no month below -$250 relative to unchanged Agg10; positive cap sensitivity; no modeled nonpositive equity. Both TP assumptions required. No threshold changes after outcomes.');
  for(const x of ranking)lines.push('',`- ${LABEL[x.arm]}: ${x.passed?'PASS':'FAIL'}. Minimum recent primary delta ${money(x.minRecentPrimaryDelta)}. ${x.failures.join('; ')}`);
  const noHighWait=get('hl_extended','resting_touch','high_off_wait'),intents:R[]=read(`${out}/${noHighWait.name}-window.json`).intents;
  const example=intents.find(x=>x.fillAt!==null),expired=intents.find(x=>x.phase==='expired');
  lines.push('','## Timing trace','');
  if(example)lines.push(`No-high waiting example: signal ${new Date(example.signalAt).toISOString()}, reference ${example.reference}, cap ${example.cap}; fill ${new Date(example.fillAt).toISOString()} at ${example.fillPrice}; exclusive expiry ${new Date(example.expiresAt).toISOString()}. Reference existed at the signal; qualification uses a completed minute and next open, never the next close/high/low.`);
  if(expired)lines.push(`Expired example: signal ${new Date(expired.signalAt).toISOString()}, cap ${expired.cap}, expiry ${new Date(expired.expiresAt).toISOString()}; no fill and no chase.`);
  lines.push('','## Verification and reproduction','',
    `Ten high-on controls reproduce accepted engine digests, metrics and detailed events/wait/TP traces. Independent audit: ${v.fills.toLocaleString()} fills, ${v.minutes.toLocaleString()} minute marks, ${v.windowChecks.toLocaleString()} waiting checks, ${v.targets.toLocaleString()} TP checks and ${v.highChecks.toLocaleString()} high checks. All high-off arms have zero high-exit events. Config hash is identical across all arms.`,
    `Immutable job: backtests/research-workflow/${key}. Derived cases/monthly/interaction/attribution/qualification: ${dest}.`,
    'Frozen card: research-inputs/entry-patience-high-interaction-2026-09-15.json. Method: docs/research/entry-patience-high-interaction.md.',
    'Run local tests: node -r ts-node/register scripts/entry-patience-tests.ts and scripts/entry-patience-high-tests.ts. Plan/run through scripts/entry-patience-high-study.ts; verify through scripts/entry-patience-high-verify.ts KEY; report through scripts/entry-patience-high-report.ts KEY. Do not rerun or overwrite completed jobs.',
    'No global optimum or live-readiness claim. Existing fee and execution limitations apply equally to the matched controls.');
  const markdown=lines.join('\n')+'\n';
  atomicJson(path.join(dest,'receipt.json'),{key,reportSha256:sha(markdown),sourceSha256:sha(fs.readFileSync(__filename)),cases:20});
  return {markdown,interactions,cases,ranking,dest};
}
if(require.main===module)report(process.argv[2]).then(r=>process.stdout.write('*** Begin Patch\n*** Add File: research/codex-astra-entry-patience-high-interaction-findings-2026-09-15.md\n'+r.markdown.trimEnd().split('\n').map(x=>'+'+x).join('\n')+'\n*** End Patch\n')).catch(e=>{console.error(e);process.exitCode=1;});
