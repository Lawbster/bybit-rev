/** Secondary independent audit, persisted after the atlas run. */
import fs from 'fs';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));
  const root=`backtests/research-workflow/${key}`,plan=read(`${root}/plan.json`),state=read(`${root}/state.json`);
  assert.equal(state.status,'complete');assert(read(`${root}/verification.json`).passed);
  const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const events:R[]=read(`${root}/output/signals.json`),rows:R[]=read(`${root}/output/add-intersections.json`),baselines:R[]=read(`${root}/output/baselines.json`);
  for(const b of baselines){const inv:R[]=read(`${plan.card.definition.archive}/output/${b.name}-events.json`);
    const closed=new Map<number,R>(b.metrics.episodes.map((x:R)=>[Date.parse(x.close),x]));
    const outcomes=new Map<number,R|undefined>(inv.filter(x=>x.event.kind==='close').map(x=>[x.episode,closed.get(x.event.fillAt)]));
    for(const x of rows.filter(x=>x.baseline===b.name)){const duration=x.waitHours*3600000;
      const signals=events.filter(e=>e.family===x.family&&e.at+duration>Date.parse(b.start)&&e.at<Date.parse(b.end));
      const opens=inv.filter(e=>e.event.kind==='open'),hit=new Map<number,R>();let empty=0;
      for(const s of signals){const matches=opens.filter(e=>e.event.decisionAt>=s.at&&e.event.decisionAt<s.at+duration);
        if(!matches.length)empty++;for(const y of matches)hit.set(y.event.fillAt,y);}
      const hs=[...hit.values()],eps=[...new Set(hs.map(e=>e.episode))],out=eps.map(ep=>outcomes.get(ep));
      assert.equal(x.signals,signals.length);assert.equal(x.adds,hs.length);
      assert.equal(x.firstRungs,hs.filter(e=>e.after.length===1).length);assert.equal(x.deepAdds,hs.filter(e=>e.after.length>=8).length);
      assert.equal(x.winsTouched,out.filter(e=>e&&e.pnl>0).length);assert.equal(x.lossesTouched,out.filter(e=>e&&e.pnl<0).length);
      assert.equal(x.unfinishedTouched,out.filter(e=>!e).length);assert.equal(x.emptyIntervals,empty);
    }
  }
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${root}/intersections-verification.json`));
  atomicJson(`${root}/intersections-verification.json`,{passed:true,cases:rows.length,checkerSha256:sha(fs.readFileSync(__filename)),liveChanges:0});
  console.log(`All ${rows.length} cooldown/add intersections independently verified against closing episodes`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
