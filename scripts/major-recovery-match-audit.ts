/** Supplemental raw-candle matching and preselected-level audit, no economic tuning. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {loadCandles1m} from './hype-freerun-canonical-replay';
import {buildFrames} from './macro-support-policy';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8')),H=3600000;
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
 assert(read(`${dir}/verification.json`).passed);assert(!fs.existsSync(`${dir}/match-audit.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 const cs=await loadCandles1m('HYPEUSDT',path.resolve('data'),Date.parse(d.cutoff),d.repairFile),frames=buildFrames(cs),rows:R[]=read(`${dir}/output/rows.json`),es:R[]=read(`${dir}/output/encounters.json`);
 const buckets=new Map<number,R>();for(const c of cs){const end=Math.floor(c.ts/H)*H+H,b=buckets.get(end)??{ts:end-H,end,first:c.ts,n:0,high:-Infinity,low:Infinity,close:c.close};b.n++;b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);b.close=c.close;buckets.set(end,b);}
 const hours=[...buckets.values()].filter(b=>b.n===60&&b.first===b.ts),features=new Map<number,R>();let fi=-1,watches=0;
 for(let i=0;i<hours.length;i++){const b=hours[i];while(fi+1<frames.length&&frames[fi+1].at<=b.end)fi++;const f=frames[fi];const row=rows[i];assert(row&&row.at===b.end);
  if(row.watch?.armedAt===row.at){assert(f?.healthy);const candidates=f.zones.filter(z=>z.role==='support'&&z.qualified&&z.firstKnownAt!==null&&z.firstKnownAt<=b.end&&z.upper<=b.close&&(b.close/z.upper-1)*100<=3+1e-10)
    .sort((a,z)=>z.upper-a.upper||z.touches.length-a.touches.length||a.firstKnownAt!-z.firstKnownAt!||a.id.localeCompare(z.id));assert.equal(row.watch.zone.id,candidates[0]?.id);watches++;}
  if(i<24||!f?.healthy||b.end<Date.parse(d.start)||hours[i-24].end!==b.end-24*H)continue;
  let tr=0;for(let j=i-23;j<=i;j++)tr+=Math.max(hours[j].high-hours[j].low,Math.abs(hours[j].high-hours[j-1].close),Math.abs(hours[j].low-hours[j-1].close));
  const atr=tr/24/b.close,ret4=(b.close/hours[i-4].close-1)*100,away=f.zones.every(z=>b.close<z.lower||b.close>z.upper)&&f.zones.every(z=>Math.abs(b.close/z.lower-1)>.03&&Math.abs(b.close/z.upper-1)>.03);
  features.set(b.end,{at:b.end,atr,ret4,away});
 }
 let matched=0;for(const e of es){const f=features.get(e.at);assert.deepEqual(e.feature,f??null);if(e.kind!=='touch'){assert.equal(e.control,null);continue;}
  const candidates=f?[...features.values()].filter(c=>c.away&&c.at>=e.at-30*24*H&&c.at<=e.at-24*H&&Math.sign(c.ret4)===Math.sign(f.ret4)&&Math.abs(c.ret4-f.ret4)<=.5&&c.atr/f.atr>=.8&&c.atr/f.atr<=1.2):[];
  if(f)candidates.sort((a,b)=>(Math.abs(Math.log(a.atr/f.atr))+Math.abs(a.ret4-f.ret4))-(Math.abs(Math.log(b.atr/f.atr))+Math.abs(b.ret4-f.ret4))||b.at-a.at);
  assert.equal(e.control?.at??null,candidates[0]?.at??null);if(e.control){const {labels,...actual}=e.control;assert.deepEqual(actual,candidates[0]);matched++;}
 }
 await verifyPins(process.cwd(),pins);const receipt={passed:true,hours:hours.length,watches,records:es.length,matched,checkerSha:sha(fs.readFileSync(__filename)),noOutcomesUsedInMatching:true};atomicJson(`${dir}/match-audit.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
