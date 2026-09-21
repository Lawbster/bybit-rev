/** Independent RP02 arithmetic, timing and cohort audit; no trigger-policy imports. */
import fs from 'fs';
import assert from 'assert/strict';
import {loadMinutes} from './relative-reversion-study';
import {verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const M=60000,H=3600000,read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const near=(a:number,b:number)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function median(xs:number[]):number|null{xs.sort((a,b)=>a-b);const n=xs.length;return n?(xs[Math.floor((n-1)/2)]+xs[Math.floor(n/2)])/2:null;}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));
  const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,p=read(`${dir}/plan.json`),st=read(`${dir}/state.json`),d=p.card.definition;
  assert.equal(st.status,'complete');const pins=[...p.pins,...p.protectedPins,...st.artifacts];await verifyPins(process.cwd(),pins);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles,
    btc=(await loadMinutes(process.cwd(),'BTCUSDT',Date.parse(d.cutoff))).candles,bmap=new Map(btc.map(c=>[c.ts,c]));
  const at=(t:number)=>cs[(t-cs[0].ts)/M],grid:R[]=read(`${out}/contexts.json`),signals:R[]=read(`${out}/signals.json`),byAt=new Map(grid.map(x=>[x.at,x]));
  let sourceMinutes=0;for(const x of grid){assert.equal(x.at%(4*H),0);assert.equal(x.sourceAvailableAt,x.at);assert.equal(x.btc.availableAt,x.at);
    assert.equal(x.price,at(x.at-M).close);assert.equal(x.btc.price,bmap.get(x.at-M)?.close??null);
    for(const h of d.lookbackHours){let complete=true;for(let t=x.at-h*H-M;t<x.at;t+=M){sourceMinutes++;if(!bmap.has(t)){complete=false;break;}}
      if(!complete){assert.equal(x.btc.returns[h],null);assert.equal(x.gapPct[h],null);continue;}
      const r=100*(bmap.get(x.at-M)!.close/bmap.get(x.at-h*H-M)!.close-1);near(x.btc.returns[h],r);
      near(x.returns[h],100*(at(x.at-M).close/at(x.at-h*H-M).close-1));near(x.gapPct[h],x.returns[h]-r);
    }
  }
  const expected:R[]=[];for(const h of d.lookbackHours)for(const threshold of d.movePct)for(const direction of d.directions){
    let previous:R|undefined,last=-Infinity;const sign=direction==='rise'?1:-1,family=`btc_${direction}${h}h_${threshold}pct`;
    for(const x of grid){const v=x.btc.returns[h],pv=previous?.btc.returns[h],contiguous=previous&&previous.at===x.at-4*H;
      if(contiguous&&v!==null&&pv!==null&&pv!==undefined&&pv*sign<threshold&&v*sign>=threshold&&x.at-last>=72*H){last=x.at;
        if(x.at>=Date.parse(d.start)&&x.at<Date.parse(d.cutoff))expected.push({id:`${family}_${x.at}`,family,at:x.at,sourceAt:x.at,hours:h,threshold,direction,
          btcReturn:v,hypeReturn:x.returns[h],gapPct:x.returns[h]-v});}previous=x;
    }
  }expected.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));assert.deepEqual(signals,expected);
  const labels:R[]=read(`${out}/outcomes.json`),lm=new Map(labels.map(y=>[y.at,y]));let minuteChecks=0,horizonChecks=0;
  for(const y of labels){const first=at(y.at);if(!first){assert(!y.ready);assert.deepEqual(y.horizons,{});continue;}
    assert(y.ready);assert.equal(y.entry,first.open);
    for(const h of d.outcomeHours){const end=y.at+h*H,b=y.horizons[h];if(end>Date.parse(d.cutoff)){assert(!b);continue;}assert(b);
      let low=first.open,high=first.open,peak=first.open,dd=0,peakAt=y.at,pAt=y.at,lAt=y.at;
      const hit:R={up2:null,down2:null,down5:null,down10:null};
      for(let t=y.at;t<end;t+=M){const c=at(t);assert.equal(c.ts,t);low=Math.min(low,c.low);high=Math.max(high,c.high);
        if(c.low/peak-1<dd){dd=c.low/peak-1;pAt=peakAt;lAt=t;}if(c.high>peak){peak=c.high;peakAt=c.endTs;}
        for(const [k,level,up] of [['up2',1.02,true],['down2',.98,false],['down5',.95,false],['down10',.9,false]]as const)
          if(hit[k]===null&&(up?c.high>=first.open*level:c.low<=first.open*level))hit[k]=t;minuteChecks++;
      }
      near(b.lowPct,100*(low/first.open-1));near(b.highPct,100*(high/first.open-1));near(b.closePct,100*(at(end-M).close/first.open-1));near(b.pullbackPct,100*dd);
      assert.equal(b.end,end);assert.equal(b.pullbackPeakAt,pAt);assert.equal(b.pullbackLowAt,lAt);
      for(const k of Object.keys(hit))assert.equal(b[k+'Hours'],hit[k]===null?null:(hit[k]-y.at)/H);
      const {up2,down2}=hit;assert.equal(b.firstBarrier,up2!==null&&down2!==null&&up2===down2?'ambiguous':up2!==null&&(down2===null||up2<down2)?'up2':down2!==null?'down2':'neither');horizonChecks++;
    }
  }
  const views:R={full:[d.start,d.cutoff],pre_hl:[d.start,d.recentStart],hl_recent:[d.recentStart,d.cutoff],published:[d.start,d.publishedEnd]},a=read(`${out}/analysis.json`);
  function sources(row:R){const [start,end]=views[row.view].map(Date.parse),hours=row.hours??signals.find(e=>e.family===row.family)?.hours??Number(row.family.match(/(\d+)h/)?.[1]);
    const xs=(row.family?.startsWith('reference_')||!row.family?grid.filter(x=>x.btc.returns[hours]!==null&&byAt.get(x.at-4*H)?.btc.returns[hours]!=null):signals.filter(e=>e.family===row.family))
      .filter((x:R)=>x.at+row.lag>=start&&x.at+row.lag<end&&(!row.month||new Date(x.at).toISOString().startsWith(row.month)));
    return {xs,end};}
  function check(row:R,times:number[],end:number,h:number){const ys=times.map(t=>lm.get(t)?.horizons[h]).filter(y=>y&&y.end<=end);
    assert.equal(row.n,times.length);assert.equal(row.complete,ys.length);assert.equal(row.censored,times.length-ys.length);
    for(const n of [2,5,10]){assert.equal(row['drop'+n],ys.filter(y=>y.lowPct<=-n).length);assert.equal(row['rise'+n],ys.filter(y=>y.highPct>=n).length);}
    for(const k of ['drop2','drop5','rise2','rise5','rise10'])if(ys.length)near(row[k+'Rate'],100*row[k]/ys.length);else assert.equal(row[k+'Rate'],null);
    assert.equal(row.pullback5,ys.filter(y=>y.pullbackPct<=-5).length);near(row.meanClose??0,ys.length?ys.reduce((n,y)=>n+y.closePct,0)/ys.length:0);
    for(const [field,key] of [['medianClose','closePct'],['medianLow','lowPct'],['medianHigh','highPct']])near(row[field]??0,median(ys.map(y=>y[key]))??0);
    for(const [field,kind] of [['upFirst','up2'],['downFirst','down2'],['ambiguous','ambiguous'],['neither','neither']])assert.equal(row[field],ys.filter(y=>y.firstBarrier===kind).length);
  }
  for(const row of a.coverage){const {xs}=sources(row),[start,end]=views[row.view].map(Date.parse);assert.equal(row.eligible,xs.length);
    assert.equal(row.total,grid.filter(x=>x.at+row.lag>=start&&x.at+row.lag<end).length);assert.equal(row.unknown,row.total-row.eligible);}
  for(const row of [...a.summaries,...a.monthly]){const {xs,end}=sources(row);check(row,xs.map(x=>x.at+row.lag),end,row.h??24);
    if(row.matchedN!==undefined){const ref=sources({...row,family:`reference_${row.hours}h`}).xs;let n=0,down=0,up=0;
      for(const e of xs){if(!lm.get(e.at+row.lag)?.horizons[row.h]||lm.get(e.at+row.lag)!.horizons[row.h].end>end)continue;
        const c=byAt.get(e.at)!,ys=ref.filter(x=>new Date(x.at).toISOString().slice(0,7)===new Date(e.at).toISOString().slice(0,7)&&x.atrBucket===c.atrBucket)
          .map(x=>lm.get(x.at+row.lag)?.horizons[row.h]).filter(y=>y&&y.end<=end);assert(ys.length);n++;
        down+=100*ys.filter(y=>y.lowPct<=-5).length/ys.length;up+=100*ys.filter(y=>y.highPct>=5).length/ys.length;}
      assert.equal(row.matchedN,n);near(row.matchedDrop5??0,n?down/n:0);near(row.matchedRise5??0,n?up/n:0);
    }
  }
  for(const row of a.delays){const {xs,end}=sources(row),pairs=xs.map(x=>[lm.get(x.at+row.lag),lm.get(x.at+row.lag+row.waitHours*H)])
      .filter(([b,l])=>b?.horizons[24]?.end<=end&&l?.horizons[24]?.end<=end) as [R,R][];
    const changes=pairs.map(([b,l])=>100*(l.entry/b.entry-1));assert.equal(row.n,pairs.length);assert.equal(row.cheaper,changes.filter(x=>x<0).length);
    assert.equal(row.dearer,changes.filter(x=>x>0).length);near(row.medianEntryChange??0,median(changes)??0);
    near(row.meanEntryChange??0,changes.length?changes.reduce((a,b)=>a+b,0)/changes.length:0);
    assert.equal(row.earlyUpside2,pairs.filter(([b])=>b.horizons[row.waitHours].highPct>=2).length);
    check(row.baseline,pairs.map(([b])=>b.at),end,24);check(row.delayed,pairs.map(([,l])=>l.at),end,24);
  }
  const actualConf:R[]=read(`${out}/confirmations.json`),expectedConf:R[]=[];
  for(const e of signals.filter(e=>d.confirmationFamilies.includes(e.family)))for(const kind of d.confirmations){let peak=byAt.get(e.at)!.price;
    for(const hours of [4,8,12]){const x=byAt.get(e.at+hours*H);if(!x)break;peak=Math.max(peak,x.high);
      if(kind==='first_red_4h'?x.price<x.open:x.price<=peak*.98){expectedConf.push({event:e.id,kind,at:x.at,sourceAt:x.at,delayHours:hours,peak,alreadyMovedPct:100*(x.price/byAt.get(e.at)!.price-1)});break;}}
  }assert.deepEqual(actualConf,expectedConf);
  for(const row of a.confirmations){const {xs,end}=sources(row),ids=new Set(xs.map(x=>x.id)),picked=actualConf.filter(c=>ids.has(c.event)&&c.kind===row.kind&&lm.get(c.at+row.lag)?.horizons[24]?.end<=end);
    assert.equal(row.anchors,xs.length);check(row,picked.map(x=>x.at+row.lag),end,24);let matched=0;
    for(const c of row.controls){check(c,xs.map(x=>x.at+row.lag+c.hours*H),end,24);assert.equal(c.weight,picked.filter(x=>x.delayHours===c.hours).length);if(c.weight)matched+=c.weight*c.drop5Rate;}
    near(row.matchedDrop5??0,picked.length?matched/picked.length:0);
  }
  // Independently reconstruct the nine fixed HYPE flags rather than importing their policy function.
  const flags=(x:R):R=>({rsi70:x.rsi===null?null:x.rsi>=70,crsi90:x.crsi===null?null:x.crsi>=90,adx25:x.adx===null?null:x.adx>=25,rvol2:x.rvol===null?null:x.rvol>=2,
    upperWick35:x.upperWick>=.35,lowerHalf:x.closeLocation<=.5,decelerating:x.returns[4]<x.prior4hReturn,near48hHigh:x.distance48hPct<=1,belowPreviousLow:x.belowPreviousLow});
  for(const row of a.flags){const {xs,end}=sources(row),known=xs.filter(x=>flags(byAt.get(x.at)!)[row.flag]!==null),picked=known.filter(x=>flags(byAt.get(x.at)!)[row.flag]);
    check(row,picked.map(x=>x.at+row.lag),end,24);check(row.baseline,known.map(x=>x.at+row.lag),end,24);}
  const b=read(`${out}/baselines.json`);assert.deepEqual(b,read(`${d.parent}/output/baselines.json`));
  await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${dir}/verification.json`));
  atomicJson(`${dir}/verification.json`,{passed:true,sourceMinutes,minuteChecks,horizonChecks,signals:signals.length,summaryChecks:a.summaries.length,
    delayChecks:a.delays.length,flagChecks:a.flags.length,confirmationChecks:actualConf.length,baselineDigests:b.length,checkerSha256:sha(fs.readFileSync(__filename)),newTradingDefinitions:0,liveChanges:0});
  console.log(JSON.stringify({passed:true,sourceMinutes,minuteChecks,horizonChecks,signals:signals.length}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
