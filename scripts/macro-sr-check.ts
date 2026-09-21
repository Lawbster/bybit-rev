/** Independently verifies recorded pivots/confirmation closes against source minutes. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
async function main(){
  const dir=jobDirectory(process.cwd(),process.argv[2]),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  process.env.SIM_END=d.cutoff;const {loadCandles1m}=await import('./hype-freerun-canonical-replay');const cs=await loadCandles1m('HYPEUSDT',path.resolve('data'),Date.parse(d.cutoff),d.repairFile);
  let eventChecks=0,touchChecks=0;
  for(const spec of d.macroObserver.timeframes){
    const ms=spec.minutes*60000,buckets=new Map<number,R>();
    for(const c of cs){const ts=Math.floor(c.ts/ms)*ms;let b=buckets.get(ts);if(!b){b={ts,n:0,high:-Infinity,low:Infinity,close:0};buckets.set(ts,b);}b.n++;b.high=Math.max(b.high,c.high);b.low=Math.min(b.low,c.low);b.close=c.close;}
    const get=(ts:number)=>{const b=buckets.get(ts);assert(b&&b.n===spec.minutes,`Incomplete source ${ts}`);return b;};
    const events:R[]=read(`${dir}/output/${spec.minutes}m-events.json`);let previous=-Infinity;
    for(const e of events){assert(e.at>=previous);previous=e.at;assert.equal(e.at,e.barEnd);assert(e.at<=Date.parse(d.cutoff));const z=e.zone,b=get(e.barEnd-ms);assert.equal(e.close,b.close);
      const [,seedTs,seedSide]=z.id.split(':'),seed=get(Number(seedTs));assert.equal(z.center,seedSide==='resistance'?seed.high:seed.low);
      assert(Math.abs(z.lower-z.center*(1-spec.halfWidthPct/100))<1e-10);assert(Math.abs(z.upper-z.center*(1+spec.halfWidthPct/100))<1e-10);
      for(let i=0;i<z.touches.length;i++){const t=z.touches[i],p=get(t.pivotAt);assert.equal(t.knownAt,t.pivotAt+(spec.wing+1)*ms);assert(t.knownAt<=e.at&&t.knownAt>=e.at-120*86400000);
        assert.equal(t.price,t.side==='resistance'?p.high:p.low);assert(t.price>=z.lower&&t.price<=z.upper);
        for(let j=-spec.wing;j<=spec.wing;j++)if(j){const n=get(t.pivotAt+j*ms);assert(t.side==='resistance'?n.high<t.price:n.low>t.price);}
        if(i)assert(t.pivotAt-z.touches[i-1].pivotAt>=spec.touchSpacingHours*3600000);touchChecks++;
      }
      if(e.kind==='qualified'){assert.equal(z.firstKnownAt,e.at);assert.equal(z.touches.length,2);}
      if(['breakout_accepted','reclaimed','support_failed'].includes(e.kind))for(let k=1;k<=2;k++){const p=get(e.barEnd-k*ms);assert(p.ts>=z.firstKnownAt);assert(e.kind==='support_failed'?p.close<z.lower:p.close>z.upper);}
      if(e.kind==='support_retest_held'){assert(b.low<=z.upper&&b.high>=z.lower&&b.close>z.upper);assert(e.at>z.lastFlipAt);}
      if(e.kind==='expired')assert(z.touches.length<2);eventChecks++;
    }
  }
  await verifyPins(process.cwd(),pins);const r={passed:true,eventChecks,touchChecks,checkerSha256:sha(fs.readFileSync(__filename)),liveChanges:0,profitTests:0};atomicJson(`${dir}/verification.json`,r);console.log(JSON.stringify(r));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
