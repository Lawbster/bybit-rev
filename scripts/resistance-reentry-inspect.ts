/** Post-verification descriptive report only; never consumed by the trading rules. */
import fs from 'fs';import assert from 'assert/strict';import {jobDirectory} from './research-workflow';
type R=Record<string,any>;const dir=jobDirectory(process.cwd(),process.argv[2]),read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
assert(read(`${dir}/verification.json`).passed);const rows:R[]=read(`${dir}/output/results.json`),review=read(`${dir}/review.json`);
const intervals=[['July2025','2025-07-01','2025-08-01'],['Jun29-Jul1','2026-06-29T12:14:00Z','2026-07-01T14:47:00Z'],['Sep9','2026-09-09T20:00:00Z','2026-09-14T08:00:00Z']];
const summary=(es:R[])=>({n:es.length,wins:es.filter(e=>e.pnl>0).length,winning:es.reduce((n,e)=>n+Math.max(0,e.pnl),0),losses:es.filter(e=>e.pnl<0).length,losing:es.reduce((n,e)=>n+Math.min(0,e.pnl),0),net:es.reduce((n,e)=>n+e.pnl,0)});
const report:R[]=[];
for(const x of rows){
 const load=(k:string)=>read(`${dir}/output/${x.name}-${k}.json`),events:R[]=load('inventory'),activations:R[]=load('activations'),probes:R[]=load('probes');
 let opened:number|null=null,occupied=0;
 for(const z of events){if(z.event.kind==='open'&&!z.before.length)opened=z.event.fillAt;if(z.event.kind==='close'&&opened!==null){occupied+=z.event.fillAt-opened;opened=null;}}
 if(opened!==null)occupied+=Date.parse(x.end)-opened;
 const firstPrices=activations.filter(a=>a.blockedChecks&&a.entryAt!==null).map(a=>{const p=probes.find(p=>p.waitEpisode===a.episode&&p.blocked)!;
  const delta=100*(a.entryPrice/p.price-1);return{episode:a.episode,firstEligibleAt:p.at,firstEligibleDecisionClose:p.price,entryAt:a.entryAt,entryPrice:a.entryPrice,deltaPct:delta};});
 const named=intervals.map(([label,start,end])=>{const lo=Date.parse(start),hi=Date.parse(end);
  const es=x.metrics.episodes.filter((e:R)=>Date.parse(e.entry)<hi&&Date.parse(e.close)>lo);
  return{label,...summary(es),boundaryNote:'Whole completed episodes overlapping interval, not calendar MTM; monthly.csv holds calendar totals.',
   episodes:es,waits:activations.filter(a=>a.fillAt>=lo&&a.fillAt<hi)};});
 const peers=review.peerReviews.find((v:R)=>v.name===x.name)?.peers??[];
 report.push({name:x.name,flatHours:(Date.parse(x.end)-Date.parse(x.start)-occupied)/3600000,
  entryPrices:{n:firstPrices.length,lower:firstPrices.filter(p=>p.deltaPct<0).length,higher:firstPrices.filter(p=>p.deltaPct>0).length,meanPct:firstPrices.reduce((n,p)=>n+p.deltaPct,0)/(firstPrices.length||1),
   note:'Versus first blocked decision close, not an executable quote or causal PnL estimate.',observations:firstPrices},named,
  peers:peers.map((p:R)=>({cell:p.cell,delta:p.delta.pnlDelta,ddReduction:p.delta.ddReductionPp,attribution:p.attribution,removed:p.concentration.removed,replacement:p.concentration.replacement,
   exLargest:p.concentration.netDeltaExcludingLargest,exTwo:p.concentration.netDeltaExcludingTwoLargest,largest:p.concentration.largestPositive.slice(0,2),
   worst:p.concentration.components.slice().sort((a:R,b:R)=>a.delta-b.delta).slice(0,2)}))});
}
const output=process.argv[3];
if(output){
 assert(!fs.existsSync(output),'Refusing to overwrite an existing descriptive report');
 fs.writeFileSync(output,JSON.stringify({job:process.argv[2],kind:'post_verification_descriptive_only',paths:report},null,2),'utf8');
 console.log(JSON.stringify({output,paths:report.length}));
}else for(const row of report)console.log(JSON.stringify(row));
