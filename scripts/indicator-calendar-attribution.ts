/** T01 descriptive calendar denominators. No entry selection or strategy calls. */
import assert from "assert/strict";
const M=60_000,H=60*M;
export function calendarBuckets(t:number):string[]{
  const d=new Date(t),day=d.getUTCDay();
  return ["utc4h_"+Math.floor(d.getUTCHours()/4),day===0||day===6?"weekend":"weekday"];
}
export function calendarAttribution(row:any,run:any){
  const out=new Map<string,any>(),start=Date.parse(row.start),end=Date.parse(row.end),month=(t:number)=>new Date(t).toISOString().slice(0,7);
  function get(scope:string,bucket:string){
    const k=scope+"|"+bucket;
    if(!out.has(k))out.set(k,{id:row.id,window:row.window,delayMs:row.delayMs,scope,bucket,
      marketHours:0,decisionSlots:0,opportunities:0,acceptedSignals:0,filledEntries:0,pendingEntries:0,occupiedSignals:0,
      completedTrades:0,wins:0,losses:0,winningDollars:0,losingDollars:0,closedNet:0,openNet:0,
      exitTrades:0,exitNet:0,exposureClockHours:0,exposureOriginHours:0});
    return out.get(k)!;
  }
  function add(t:number,f:(b:any)=>void){for(const scope of ["all",month(t)])for(const bucket of calendarBuckets(t))f(get(scope,bucket));}
  const ps=[...run.trades,...(run.open?[run.open]:[])],bySignal=new Map(ps.map(p=>[p.signalAt,p]));let cursor=0;
  for(let t=start;t<end;t+=M){
    while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=t)cursor++;
    const held=ps[cursor]?.entryAt<=t?ps[cursor]:null;
    add(t,b=>{b.marketHours+=1/60;if(t%row.timeframeMs===0)b.decisionSlots++;if(held)b.exposureClockHours+=1/60;});
  }
  for(const d of run.decisions){
    add(d.at,b=>{b.opportunities++;if(d.outcome==="occupied")b.occupiedSignals++;
      else if(d.outcome==="accepted"){b.acceptedSignals++;if(bySignal.has(d.at))b.filledEntries++;else b.pendingEntries++;}
      else assert.fail("Descriptive baseline must be unfiltered");
    });
  }
  for(const p of ps){
    const open=p.exitAt===undefined;
    add(p.signalAt,b=>{b.exposureOriginHours+=((open?end:p.exitAt)-p.entryAt)/H;
      if(open)b.openNet+=p.net;else{b.completedTrades++;b.closedNet+=p.net;if(p.net>1e-8){b.wins++;b.winningDollars+=p.net;}
        else if(p.net < -1e-8){b.losses++;b.losingDollars+=p.net;}}});
    if(!open)add(p.exitAt,b=>{b.exitTrades++;b.exitNet+=p.net;});
  }
  return [...out.values()].map(b=>({...b,signalOriginNet:b.closedNet+b.openNet,
    entryAcceptanceRate:b.opportunities?b.acceptedSignals/b.opportunities:null,
    occupiedRate:b.opportunities?b.occupiedSignals/b.opportunities:null}));
}
