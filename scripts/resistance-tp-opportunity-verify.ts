/** Independent SRT01 eligibility and forward-label reconstruction; no alternative replay. */
import fs from 'fs';import assert from 'assert/strict';
import {jobDirectory,verifyPins,atomicJson,sha} from './research-workflow';
import {candles,read,validate} from './resistance-tp-opportunity-study';
import {ReplaySrContext} from './replay-sr-context';
import {auditFlowLedger} from './flow-response-audit';
import {POLICIES,config} from './age10-gate-policy';
type R=Record<string,any>;
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
async function main(){
  const dir=jobDirectory(process.cwd(),process.argv[2]),plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;validate(d);
  assert.equal(state.status,'complete');assert(!fs.existsSync(`${dir}/verification.json`));const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=await candles(d),rows:R[]=read(`${dir}/output/results.json`),old:R[]=read(`${d.archive}/output/results.json`),cfg=read('bot-config.json');delete cfg.aggressive10;
  const load=(name:string,s:string)=>read(`${d.archive}/output/${name}-${s}.json`),out=(name:string,s:string)=>read(`${dir}/output/${name}-${s}.json`);
  let controls=0,fills=0,opportunityChecks=0,featuresChecked=0,anchorsChecked=0,prefixChecks=0;
  for(const x of old.filter(x=>x.control)){
    const raw=load(x.name,'engine'),ev=load(x.name,'inventory');assert.equal(sha(JSON.stringify(raw)),x.digest);
    assert.deepEqual(auditFlowLedger(cs,ev,load(x.name,'attempts'),x.metrics,x.startIdx,x.endIdx),x.accounting);controls++;fills+=ev.length;
  }
  const traces:R[]=[];
  for(const row of rows){
    console.log(`[SRT01 verify] ${row.name}`);const x=old.find(x=>x.name===row.baseline)!,ev:R[]=load(x.name,'inventory'),ts:R[]=load(x.name,'targets');
    assert(x.control&&x.policy===d.parent);assert.deepEqual(row.baselineMetrics,x.metrics);
    const c=config(cfg,POLICIES.find(p=>p.id===x.policy)!);assert.equal(sha(JSON.stringify(c)),x.configSha);
    const features:R[]=out(row.name,'features'),anchors:R[]=out(row.name,'anchors'),labels:R[]=out(row.name,'labels'),fm=new Map(features.map(f=>[f.index,f]));
    assert.equal(fm.size,features.length);const expectedAnchors:number[]=[],seen=new Set<number>(),sr=new ReplaySrContext(cs,c.srShadow!);
    const planned=new Map<number,string>();for(const e of ev){const v=e.event;if(v.fillAt===cs[v.fillIndex].ts)planned.set(v.decisionIndex,`${v.kind}:${v.reason}`);}
    if(x.pendingAtEnd)planned.set(x.pendingAtEnd.decisionIndex,`${x.pendingAtEnd.kind}:${x.pendingAtEnd.reason}`);
    const counts:R={occupied:0,free:0,ordinary:0,healthy:0,nearest:0,betweenAvgAndNormal:0,priceBand:0,qualified:0,staleExcluded:0,mutationExcluded:0};
    const months=new Map<string,R>();let ep=0,ptr=0,ti=0,inv:R[]=[];
    for(let i=x.startIdx;i<x.endIdx;i++){
      const now=cs[i].endTs,sourceAt=now-row.lag,ctx=sr.at(sourceAt);opportunityChecks++;
      while(ptr<ev.length&&ev[ptr].event.fillIndex<=i){inv=ev[ptr].after;ep=ev[ptr].episode;ptr++;}while(ti+1<ts.length&&ts[ti+1].index<=i)ti++;
      let expected=false;
      if(inv.length){
        const month=new Date(now).toISOString().slice(0,7);if(!months.has(month))months.set(month,{month,occupied:0,ordinary:0,qualified:0});const mo=months.get(month)!;
        counts.occupied++;mo.occupied++;
        if(planned.has(i))counts.mutationExcluded++;
        else{counts.free++;const target=ts[ti];assert(target&&target.index<=i&&target.episode===ep);
          if(target.pct!==1.4)counts.staleExcluded++;
          else{counts.ordinary++;mo.ordinary++;
            if(ctx.coverage.healthy){counts.healthy++;
              const zones=ctx.engine.getZones(sourceAt).filter(z=>z.price>cs[i].close&&(z.price-cs[i].close)/cs[i].close<=c.srShadow!.bufferPct/100).sort((a,b)=>a.price-b.price),lv=zones[0];
              if(lv){counts.nearest++;const cost=inv.reduce((n,p)=>n+p.notional,0),qty=inv.reduce((n,p)=>n+p.qty,0),avg=cost/qty;
                if(lv.price>avg&&lv.price<target.targetPrice)counts.betweenAvgAndNormal++;
                if(lv.price>=avg*1.01&&lv.price<target.targetPrice){counts.priceBand++;
                  // Independent longest-chain count, not worker greedy spacing.
                  const touch=lv.touchData.slice().sort((a,b)=>a.ts-b.ts),dp:number[]=[];
                  for(let a=0;a<touch.length;a++){dp[a]=1;for(let b=0;b<a;b++)if(touch[a].ts-touch[b].ts>=21600000)dp[a]=Math.max(dp[a],dp[b]+1);}
                  if(Math.max(...dp)>=3){expected=true;counts.qualified++;mo.qualified++;const f=fm.get(i);assert(f,`missing eligible ${row.name}/${i}`);
                    assert.equal(f.at,now);assert.equal(f.sourceAt,sourceAt);assert.equal(f.episode,ep);assert.equal(f.armIndex,target.armedIndex);
                    assert.equal(f.depth,inv.length);near(f.qty,qty);near(f.cost,cost);near(f.avg,avg);near(f.price,cs[i].close);near(f.shade,lv.price);near(f.normalTarget,target.targetPrice);
                    near(f.shadePct,100*(lv.price/avg-1));assert.equal(f.targetPct,1.4);assert.equal(f.oldestEntry,Math.min(...inv.map(p=>p.entryTime)));
                    assert.deepEqual(f.touches,lv.touchData);assert.equal(f.highTouches,lv.highTouches);assert.equal(f.lowTouches,lv.lowTouches);
                    assert.deepEqual(f.inventoryIds,inv.map(p=>p.id));assert.equal(f.spaced.length,Math.max(...dp));
                    for(let k=0;k<f.spaced.length;k++){assert(touch.some(t=>t.ts===f.spaced[k]));assert(f.spaced[k]<=sourceAt);if(k)assert(f.spaced[k]-f.spaced[k-1]>=21600000);}
                    for(const t of touch)assert(t.ts<=sourceAt&&t.ts>=Math.floor(sourceAt/1800000)*1800000-14*86400000);
                    if(!seen.has(f.armIndex)){expectedAnchors.push(i);seen.add(f.armIndex);}featuresChecked++;
                  }
                }
              }
            }
          }
        }
      }
      assert.equal(fm.has(i),expected,`unexpected feature ${row.name}/${i}`);
    }
    assert.deepEqual(counts,row.counts);assert.deepEqual(anchors.map(a=>a.index),expectedAnchors);assert.equal(labels.length,anchors.length);
    const raw=load(x.name,'engine'),closes=new Map(raw.closes.map((c:R)=>[c.episode,c]));
    for(let a=0;a<anchors.length;a++){
      const f=anchors[a],l=labels[a];assert.deepEqual(f,fm.get(f.index));assert.equal(l.anchorIndex,f.index);assert.equal(l.episode,f.episode);
      const updates=ts.filter(t=>t.index>f.index).map(t=>t.index),fillsAfter=ev.filter(e=>e.event.fillIndex>f.index),nextFill=fillsAfter[0]?.event;
      const last=Math.min(x.endIdx-1,updates[0]??Infinity,nextFill?nextFill.fillIndex-(nextFill.fillAt===cs[nextFill.fillIndex].ts?1:0):Infinity,
        ...[...planned.keys()].filter(i=>i>f.index));assert.equal(l.last,last);
      let hit:number|null=null,normal:number|null=null;
      for(let j=f.index+1;j<=last;j++){const p=row.tp==='resting_touch'?cs[j].high:cs[j].close;
        if(p>=f.shade&&hit===null)hit=j;if(p>=f.normalTarget&&normal===null)normal=j;}
      assert.equal(l.hit,hit);assert.equal(l.normal,normal);assert.equal(l.hitAt,hit===null?null:cs[hit].endTs);assert.equal(l.sameBar,hit!==null&&hit===normal);
      const fi=hit===null?null:hit+Number(row.tp!=='resting_touch'),fill=fi===null||fi>=x.endIdx?null:row.tp==='resting_touch'?f.shade:cs[fi].open;
      assert.equal(l.fillIndex,fi);assert.equal(l.fill,fill);assert.equal(l.competing,hit!==null&&row.tp!=='resting_touch'&&planned.has(hit));
      assert.equal(l.hitBeforeNormal,hit!==null&&(normal===null||hit<normal));assert.equal(l.shadeOnly,hit!==null&&normal===null);
      if(fill!==null)near(l.remainingNetAtProxy,f.qty*(fill-f.avg)-.00055*f.qty*(fill+f.avg));else assert.equal(l.remainingNetAtProxy,null);
      near(l.targetGiveUp,f.qty*(f.normalTarget-f.shade)*.99945);const close=closes.get(f.episode) as R|undefined;
      assert.deepEqual(l.baselineOutcome,close?{entry:close.entryIso,close:close.closeIso,pnl:close.pnl+close.trimPnlInEpisode,reason:close.reason}:null);
      if(a===0){const boundary=Math.floor(f.sourceAt/1800000)*1800000,pre=new ReplaySrContext(cs.filter(z=>z.endTs<=boundary),c.srShadow!).at(boundary);
        const full=new ReplaySrContext(cs,c.srShadow!).at(boundary);assert.deepEqual(pre.engine.getZones(boundary),full.engine.getZones(boundary));
        const level=pre.engine.nearestResistance(f.sourceAt,f.price);assert(level);near(level.lv.price,f.shade);prefixChecks++;
        traces.push({name:row.name,feature:f,label:l});}
      anchorsChecked++;
    }
    const unique=(rs:R[])=>[...new Map(rs.map(l=>[l.episode,l])).values()];
    const cohort=(rs:R[])=>{const uniqueRows=unique(rs),closed=uniqueRows.filter(r=>r.baselineOutcome);return{n:closed.length,
      wins:closed.filter(r=>r.baselineOutcome.pnl>0).length,winDollars:closed.reduce((n,r)=>n+Math.max(0,r.baselineOutcome.pnl),0),
      losses:closed.filter(r=>r.baselineOutcome.pnl<0).length,lossDollars:closed.reduce((n,r)=>n+Math.min(0,r.baselineOutcome.pnl),0),open:uniqueRows.length-closed.length};};
    function checkSummary(s:R,fs:R[],as:R[],ls:R[]){const hits=ls.filter(l=>l.hit!==null&&l.fill!==null&&!l.competing),only=hits.filter(l=>l.shadeOnly);
      assert.equal(s.eligibleLadders,unique(fs).length);assert.equal(s.anchors,as.length);assert.equal(s.hitAnchors,hits.length);assert.equal(s.shadeOnlyAnchors,only.length);
      assert.equal(s.hitLadders,unique(hits).length);assert.equal(s.shadeOnlyLadders,unique(only).length);assert.deepEqual(s.baselineEligible,cohort(ls));assert.deepEqual(s.baselineHit,cohort(hits));assert.deepEqual(s.baselineShadeOnly,cohort(only));
      assert.equal(s.sameBar,hits.filter(l=>l.sameBar).length);assert.equal(s.beforeNormal,hits.filter(l=>l.hitBeforeNormal).length);assert.equal(s.noHit,ls.filter(l=>l.hit===null).length);
      assert.equal(s.competing,ls.filter(l=>l.competing).length);assert.equal(s.censoredFill,ls.filter(l=>l.hit!==null&&l.fill===null).length);
      const q=(v:number[],p:number)=>v.length?v.sort((a,b)=>a-b)[Math.floor((v.length-1)*p)]:null;
      assert.equal(s.medianGiveUp,q(hits.map(l=>l.targetGiveUp),.5));assert.equal(s.p90GiveUp,q(hits.map(l=>l.targetGiveUp),.9));assert.equal(s.medianShadePct,q(as.map(a=>a.shadePct),.5));assert.equal(s.medianDepth,q(as.map(a=>a.depth),.5));}
    checkSummary(row.summary,features,anchors,labels);
    assert.equal(row.monthly.length,months.size);for(const m of row.monthly){const expected=months.get(m.month)!;assert(expected);
      for(const k of ['occupied','ordinary','qualified'])assert.equal(m[k],expected[k]);const fs=features.filter(f=>new Date(f.at).toISOString().startsWith(m.month)),as=anchors.filter(f=>new Date(f.at).toISOString().startsWith(m.month)),ids=new Set(as.map(a=>a.index));
      checkSummary(m,fs,as,labels.filter(l=>ids.has(l.anchorIndex)));}
  }
  assert.equal(controls,8);assert.equal(rows.length,8);await verifyPins(process.cwd(),pins);
  atomicJson(`${dir}/review.json`,{traces,qualification:'not_evaluated_opportunity_only',newTradingDefinitions:0});
  const receipt={passed:true,controls,fills,opportunityChecks,featuresChecked,anchorsChecked,prefixChecks,checkerSha:sha(fs.readFileSync(__filename)),reviewSha:sha(fs.readFileSync(`${dir}/review.json`)),liveChanges:0};
  atomicJson(`${dir}/verification.json`,receipt);console.log(JSON.stringify(receipt));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
