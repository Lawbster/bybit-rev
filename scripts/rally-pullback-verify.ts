/** Independent source/label/crossing audit. No strategy policy imports. */
import fs from 'fs';
import assert from 'assert/strict';
import {loadMinutes} from './relative-reversion-study';
import {verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const H=3600000,M=60000,read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,
  p=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=p.card.definition;assert.equal(state.status,'complete');
  const pins=[...p.pins,...p.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const at=(t:number)=>{const i=(t-cs[0].ts)/M;assert(Number.isInteger(i));return cs[i];};
  const grid:R[]=read(`${out}/contexts.json`),signals:R[]=read(`${out}/signals.json`),labels:R[]=read(`${out}/outcomes.json`),byAt=new Map(grid.map(x=>[x.at,x]));
  for(const x of grid){assert.equal(x.at,x.sourceEnd);assert.equal(x.sourceAvailableAt,x.sourceEnd);assert.equal(x.at%(4*H),0);
    assert.equal(x.sourceStart,x.at-4*H);const b=cs.slice((x.at-4*H-cs[0].ts)/M,(x.at-cs[0].ts)/M);assert.equal(b.length,240);
    assert.equal(x.price,b.at(-1)!.close);assert.equal(x.open,b[0].open);assert.equal(x.high,Math.max(...b.map(x=>x.high)));assert.equal(x.low,Math.min(...b.map(x=>x.low)));
    for(const h of d.lookbackHours)near(x.returns[h],100*(x.price/at(x.at-h*H-M).close-1));
    near(x.upperWick,x.high===x.low?0:(x.high-Math.max(x.open,x.price))/(x.high-x.low));
    near(x.closeLocation,x.high===x.low?.5:(x.price-x.low)/(x.high-x.low));
    const h48=cs.slice((x.at-48*H-cs[0].ts)/M,(x.at-cs[0].ts)/M).reduce((n,c)=>Math.max(n,c.high),0);near(x.high48,h48);
  }
  const expected:R[]=[];const first=(Math.ceil(cs[0].ts/(4*H))+201)*4*H;
  for(const h of d.lookbackHours)for(const threshold of d.risePct){let prev:number|null=null,last=-Infinity;
    for(let t=first;t<=Date.parse(d.cutoff);t+=4*H){const r=100*(at(t-M).close/at(t-h*H-M).close-1);
      if(prev!==null&&prev<threshold&&r>=threshold&&t-last>=72*H){last=t;if(t>=Date.parse(d.start))expected.push({id:`rise${h}h_${threshold}pct_${t}`,family:`rise${h}h_${threshold}pct`,hours:h,threshold,at:t,sourceAt:t});}prev=r;}
  }
  expected.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));assert.deepEqual(signals,expected);
  let minutes=0,checks=0;
  for(const y of labels){const first=at(y.at);if(!first){assert.equal(y.ready,false);assert.deepEqual(y.horizons,{});continue;}
    assert(y.ready);assert.equal(y.entry,first.open);
    for(const h of d.outcomeHours){const end=y.at+h*H,b=y.horizons[h];
      if(end>Date.parse(d.cutoff)){assert(!b);continue;}assert(b);
      let low=first.open,high=first.open,peak=first.open,dd=0,peakAt=y.at,pAt=y.at,lAt=y.at;
      const hit:R={up2:null,down2:null,down5:null,down10:null};
      for(let t=y.at;t<end;t+=M){const c=at(t);assert(c);low=Math.min(low,c.low);high=Math.max(high,c.high);
        if(c.low/peak-1<dd){dd=c.low/peak-1;pAt=peakAt;lAt=t;}if(c.high>peak){peak=c.high;peakAt=c.endTs;}
        for(const [key,level,up] of [['up2',1.02,true],['down2',.98,false],['down5',.95,false],['down10',.9,false]]as const)
          if(hit[key]===null&&(up?c.high>=first.open*level:c.low<=first.open*level))hit[key]=t;
        minutes++;
      }
      near(b.lowPct,100*(low/first.open-1));near(b.highPct,100*(high/first.open-1));near(b.closePct,100*(at(end-M).close/first.open-1));near(b.pullbackPct,100*dd);
      assert.equal(b.end,end);assert.equal(b.pullbackPeakAt,pAt);assert.equal(b.pullbackLowAt,lAt);
      for(const k of Object.keys(hit))assert.equal(b[k+'Hours'],hit[k]===null?null:(hit[k]-y.at)/H);
      const {up2,down2}=hit;assert.equal(b.firstBarrier,up2!==null&&down2!==null&&up2===down2?'ambiguous':up2!==null&&(down2===null||up2<down2)?'up2':down2!==null?'down2':'neither');checks++;
    }
  }
  const conf:R[]=read(`${out}/confirmations.json`);let cCount=0;
  for(const e of signals.filter(e=>e.family===d.referenceTrigger))for(const kind of d.confirmations){let peak=byAt.get(e.at)!.price,found:R|null=null;
    for(const h of [4,8,12]){const x=byAt.get(e.at+h*H);if(!x)break;peak=Math.max(peak,x.high);
      if(kind==='first_red_4h'?x.price<x.open:x.price<=peak*.98){found={event:e.id,kind,at:x.at,sourceAt:x.at,delayHours:h,peak,alreadyMovedPct:100*(x.price/byAt.get(e.at)!.price-1)};break;}}
    const actual=conf.find(c=>c.event===e.id&&c.kind===kind)??null;assert.deepEqual(actual,found);if(found)cCount++;
  }assert.equal(cCount,conf.length);
  const map=new Map(labels.map(y=>[y.at,y])),analysis=read(`${out}/analysis.json`);
  const views:R={full:[d.start,d.cutoff],pre_hl:[d.start,d.recentStart],hl_recent:[d.recentStart,d.cutoff],published:[d.start,d.publishedEnd]};
  for(const row of analysis.summaries){const [start,end]=views[row.view].map(Date.parse),xs=(row.family==='all_4h'?grid:signals.filter(e=>e.family===row.family)).filter((e:R)=>e.at+row.lag>=start&&e.at+row.lag<end);
    const ys=xs.map((e:R)=>map.get(e.at+row.lag)?.horizons[row.h]).filter((y:R)=>y&&y.end<=end);
    assert.equal(row.n,xs.length);assert.equal(row.complete,ys.length);
    for(const n of [2,5,10])assert.equal(row['drop'+n],ys.filter((y:R)=>y.lowPct<=-n).length);
    assert.equal(row.pullback5,ys.filter((y:R)=>y.pullbackPct<=-5).length);
    assert.equal(row.upFirst+row.downFirst+row.ambiguous+row.neither,row.complete);
  }
  const original:R[]=read(`${d.archive}/output/results.json`),baselines:R[]=read(`${out}/baselines.json`);assert.equal(baselines.length,4);
  for(const b of baselines){const old=original.find(x=>x.name===b.name);assert(old);assert.deepEqual(b.metrics,old.metrics);assert.equal(b.digest,old.digest);}
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${dir}/verification.json`));
  atomicJson(`${dir}/verification.json`,{passed:true,contexts:grid.length,signals:signals.length,outcomeChecks:checks,minuteChecks:minutes,
    confirmations:cCount,summaryChecks:analysis.summaries.length,baselineLedgers:4,checkerSha256:sha(fs.readFileSync(__filename)),newTradingDefinitions:0,liveChanges:0});
  console.log(JSON.stringify({passed:true,contexts:grid.length,signals:signals.length,outcomeChecks:checks,minuteChecks:minutes}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
