/** Separate MA01 raw-bar/outcome/clock validation. No strategy promotion. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {buildFrames} from './macro-support-policy';
import {auditFrames} from './macro-support-audit';
import {responseTape,H,M} from './major-recovery-policy';
import {loadFlowTape,FlowResponseContext} from './flow-response-policy';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));type R=Record<string,any>;
async function main(){
 const dir=jobDirectory(process.cwd(),process.argv[2]),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition,out=`${dir}/output`;
 assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
 const {s}=await buildSeries(d),cs=s.candles,rows:R[]=read(`${out}/rows.json`),events:R[]=read(`${out}/events.json`),records:R[]=read(`${out}/encounters.json`);
 const frames=buildFrames(cs),source=auditFrames(cs,frames,0);let labels=0,eventChecks=0;
 const hourly=new Map<number,R>();for(const c of cs){const end=Math.floor(c.ts/H)*H+H,b=hourly.get(end)??{ts:end-H,end,open:c.open,close:c.close,high:-Infinity,low:Infinity,n:0};b.n++;b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);b.close=c.close;hourly.set(end,b);}
 const atRow=new Map(rows.map(r=>[r.at,r]));assert.equal(rows.length,[...hourly.values()].filter(b=>b.n===60).length);
 for(const r of rows){assert.equal(r.close,hourly.get(r.at)!.close);assert.equal(r.at%H,0);if(r.spell){assert(r.spell.failedAt<=r.at);assert(r.spell.armedAt<r.spell.failedAt);
   assert(r.spell.zone.firstKnownAt<=r.spell.armedAt);assert(r.spell.lows.every((l:R)=>l.knownAt===l.ts+3*H&&l.knownAt<=r.at));}}
 for(const e of events){const b=hourly.get(e.at)!;assert(b.n===60&&e.barEnd===e.at&&e.price===b.close);assert(e.zone.firstKnownAt<=e.at);assert(atRow.get(e.at)!.healthy);
   if(e.kind==='accepted_below'){assert(hourly.get(e.at-H)!.close<e.zone.lower&&b.close<e.zone.lower);assert(e.evidence.armedAt<=b.ts-H);}
   if(e.kind==='touch'||e.kind==='sweep_reclaim'){assert(e.evidence.armedAt<=b.ts);assert(b.low<=e.zone.upper&&b.high>=e.zone.lower);if(e.kind==='sweep_reclaim')assert(b.low<e.zone.lower&&b.close>e.zone.upper);}
   if(e.kind==='failed_retest')assert(e.at>e.evidence.failedAt&&b.high>=e.zone.lower&&b.low<=e.zone.upper&&b.close<e.zone.lower);
   if(e.kind==='old_reclaim')assert(b.close>e.zone.upper&&hourly.get(e.at-H)!.close>e.zone.upper);
   if(e.kind==='lower_base'){
     const [a,z]=e.evidence.lows;assert(z.price>a.price&&z.ts>a.ts&&e.evidence.necklineKnownAt<=e.at);
     for(const l of [a,z]){assert(l.ts-2*H>=e.evidence.failedAt);assert.equal(hourly.get(l.ts+H)!.low,l.price);for(const shift of [-2,-1,1,2])assert(hourly.get(l.ts+H+shift*H)!.low>l.price);}
     let high=-Infinity;for(let t=a.ts+H;t<z.ts;t+=H)high=Math.max(high,hourly.get(t+H)!.high);assert.equal(high,e.evidence.neckline);assert(b.close>high);
   }eventChecks++;
 }
 for(const e of records)for(const target of [e,...(e.control?[e.control]:[])])for(const h of d.horizonsHours){
   const from=target.at,first=(from-cs[0].ts)/M,n=h*60,l=target.labels[h];if(first+n>cs.length){assert.equal(l,null);continue;}
   const slice=cs.slice(first,first+n);assert(slice.length===n&&slice[0].ts===from);const price=slice[0].open;let up=price,down=price,touch='neither';
   for(const c of slice){up=Math.max(up,c.high);down=Math.min(down,c.low);if(touch==='neither'){const a=c.high/price>=1.014,b=c.low/price<=.98;if(a||b)touch=a&&b?'ambiguous':a?'up':'down';}}
   assert(Math.abs(l.returnPct-(slice.at(-1)!.close/price-1)*100)<1e-9);assert(Math.abs(l.maePct-(down/price-1)*100)<1e-9);assert(Math.abs(l.mfePct-(up/price-1)*100)<1e-9);assert.equal(l.first,touch);assert.equal(l.entry,price);labels++;
   if(target===e.control){assert(target.at<=e.at-24*H&&target.at>=e.at-30*24*H);assert(target.away);assert(Math.sign(target.ret4)===Math.sign(e.feature.ret4));}
 }
 let prefixes=0;for(const t of ['2026-06-05T00:00:00Z','2026-07-15T00:00:00Z','2026-08-22T12:00:00Z','2026-09-15T20:00:00Z'].map(Date.parse)){
   const prefix=cs.filter(c=>c.endTs<=t),o=responseTape(prefix,buildFrames(prefix));assert.deepEqual(o.rows,rows.filter(r=>r.at<=t));assert.deepEqual(o.events,events.filter(e=>e.at<=t));prefixes++;
 }
 const flow=await loadFlowTape('data/HYPEUSDT_taker_hyperliquid.jsonl',Date.parse(d.cutoff)),context=new FlowResponseContext(flow,cs);
 for(const e of records){assert.deepEqual(context.at(e.at,0),e.pulse);assert.deepEqual(context.at(e.at-15*M,0),e.pulseBefore15m);assert(e.pulse.latestAvailable===null||e.pulse.latestAvailable<=e.at);}
 await verifyPins(process.cwd(),pins);const receipt={passed:true,source,eventChecks,labels,prefixes,pulseChecks:records.length*2,economicRuns:0,checkerSha:sha(fs.readFileSync(__filename)),liveChanges:0};atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
