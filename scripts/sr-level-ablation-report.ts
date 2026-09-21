/** Render tables from immutable SRL01 results; no economic engine. */
import fs from 'fs';import {jobDirectory} from './research-workflow';
type R=Record<string,any>;const dir=jobDirectory(process.cwd(),process.argv[2]),read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const rows:R[]=read(`${dir}/output/results.json`),d=read(`${dir}/plan.json`).card.definition;
const money=(n:number)=>Math.round(n).toLocaleString('en-US'),label=(x:R)=>x.policy==='baseline'?'B17':x.mode==='current'?'Agg10 baseline':x.mode;
function table(headers:string[],data:any[][]){console.log('| '+headers.join(' | ')+' |\n|'+headers.map(()=>'---').join('|')+'|');for(const r of data)console.log('| '+r.join(' | ')+' |');}
for(const window of ['recent','published'])for(const tp of d.tpModels){const rs=rows.filter(x=>x.window===window&&x.tp===tp&&!x.lag);
 console.log(`\n## ${window} / ${tp}\n`);table(['Setup','Wins','Win $','Losses','Loss $','Avg loss','Net','DD','TPs','Partials','Open'],rs.map(x=>{const m=x.metrics;return[label(x),m.profitableEpisodes,money(m.grossWin),m.losingEpisodes,money(-m.grossLoss),money(-m.grossLoss/m.losingEpisodes),money(m.totalPnl),m.maxDrawdownPct.toFixed(2)+'%',m.tpCycles,m.partials,money(m.openPnl)];}));
 const b=rs.find(x=>x.control&&x.policy===d.parent)!,vs=rs.filter(x=>!x.control);
 console.log('\nMonthly MTM; variant columns are delta versus Agg10.\n');table(['Month','Baseline',...vs.map(label)],b.accounting.monthly.map((m:R)=>[m.month,money(m.mtmPnl),...vs.map(x=>money(x.accounting.monthly.find((a:R)=>a.month===m.month).mtmPnl-m.mtmPnl))]));
 console.log('\nMonthly winning / losing dollars (completed episodes, closing month).\n');table(['Month','Baseline',...vs.map(label)],b.accounting.monthly.map((m:R)=>[m.month,...[b,...vs].map(x=>{const z=x.accounting.monthly.find((a:R)=>a.month===m.month);return`${z.wins} / ${money(z.winDollars)}; ${z.losses} / ${money(z.lossDollars)}`;})]));
}
console.log('\nPulse-delay sensitivity\n');table(['TP','Mode','Pulse lag','Net','DD'],rows.filter(x=>x.lag).map(x=>[x.tp,x.mode,x.lag,money(x.metrics.totalPnl),x.metrics.maxDrawdownPct.toFixed(2)]));
if(fs.existsSync(`${dir}/review.json`)){const r=read(`${dir}/review.json`);console.log(JSON.stringify({qualification:r.qualification,concentration:r.reviews.filter((x:R)=>!x.name.includes('lag60000')).map((x:R)=>({name:x.name,changedEpisodes:x.changedEpisodes,removed:x.removed,replacement:x.replacement,exLargest:x.netDeltaExcludingLargest,exTwo:x.netDeltaExcludingTwoLargest,largest:x.largestPositive[0]}))},null,2));}
