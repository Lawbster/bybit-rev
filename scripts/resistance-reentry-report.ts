/** Render only verified SRR01 evidence. No economic execution. */
import fs from 'fs';import assert from 'assert/strict';import {jobDirectory} from './research-workflow';
type R=Record<string,any>;const dir=jobDirectory(process.cwd(),process.argv[2]),read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const results:R[]=read(`${dir}/output/results.json`),review=read(`${dir}/review.json`),d=read(`${dir}/plan.json`).card.definition;
assert(read(`${dir}/verification.json`).passed);
const money=(n:number)=>Math.round(n).toLocaleString('en-US');
function table(h:string[],rs:any[][]){console.log('| '+h.join(' | ')+' |\n|'+h.map(()=>'---').join('|')+'|');for(const r of rs)console.log('| '+r.join(' | ')+' |');}
for(const window of ['recent','published'])for(const tp of ['resting_touch','close_confirmed']){const rs=results.filter(x=>x.window===window&&x.tp===tp&&!x.lag),a=rs.find(x=>x.cell==='A')!;
 console.log(`\n## ${window} / ${tp}\n`);table(['Setup','Wins','Win $','Losses','Loss $','Avg loss','Net','DD','TPs','Partials','Open'],rs.map(x=>{const m=x.metrics;return[x.cell,m.profitableEpisodes,money(m.grossWin),m.losingEpisodes,money(-m.grossLoss),money(-m.grossLoss/m.losingEpisodes),money(m.totalPnl),m.maxDrawdownPct.toFixed(2)+'%',m.tpCycles,m.partials,money(m.openPnl)];}));
 console.log('\nMonthly MTM, deltas vs A\n');table(['Month','A',...rs.filter(x=>x.cell!=='A').map(x=>x.cell)],a.accounting.monthly.map((m:R)=>[m.month,money(m.mtmPnl),...rs.filter(x=>x.cell!=='A').map(x=>money(x.accounting.monthly.find((p:R)=>p.month===m.month).mtmPnl-m.mtmPnl))]));
 console.log('\nMonthly completed-ladder wins/count dollars; losses/count dollars\n');table(['Month',...rs.map(x=>x.cell)],a.accounting.monthly.map((m:R)=>[m.month,...rs.map(x=>{const p=x.accounting.monthly.find((p:R)=>p.month===m.month);return`${p.wins} / ${money(p.winDollars)}; ${p.losses} / ${money(p.lossDollars)}`;})]));
}
console.log('\nWait/lag counts\n');table(['Name','Net','DD','Qualified','Blocked episodes','Blocked checks','Breakout releases','Wait hours'],results.filter(x=>x.mode).map(x=>[x.name,money(x.metrics.totalPnl),x.metrics.maxDrawdownPct.toFixed(2),x.waitAudit.qualified,x.waitAudit.blockedEpisodes,x.waitAudit.blockedChecks,x.waitAudit.breakoutReleases,x.waitAudit.waitHours.toFixed(2)]));
console.log(JSON.stringify({qualification:review.qualification,levelRelease:review.levelRelease,ddTraces:review.ddTraces.filter((x:R)=>!x.name.includes('lag60000'))},null,2));
console.log('B17 reference (not SRR01 parent):');table(['Window','TP','Net','DD'],read(`${d.archive}/output/results.json`).filter((x:R)=>x.control&&x.policy==='baseline').map((x:R)=>[x.window,x.tp,money(x.metrics.totalPnl),x.metrics.maxDrawdownPct.toFixed(2)]));
