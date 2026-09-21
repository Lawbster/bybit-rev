/** Independent cash/equity reconstruction; no strategy imports or future decisions. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
type R=Record<string,any>;
const near=(a:number,b:number)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6,`${a} != ${b}`);
class Dd{
  peak:number;min:number;pct=0;
  constructor(seed:number){this.peak=this.min=seed;}
  mark(x:number){this.peak=Math.max(this.peak,x);this.min=Math.min(this.min,x);this.pct=Math.max(this.pct,100*(this.peak-x)/this.peak);}
}
export function checkDropAccountingFixtures(){
  const d=new Dd(100);[120,90,95,85].forEach(x=>d.mark(x));near(d.pct,100*35/120);
  const month=new Dd(90);[95,85].forEach(x=>month.mark(x));near(month.pct,100*10/95);
}
export function reconstructDrop(cs:Candle[],events:R[],row:R,boundary:number){
  let inv:R[]=[],ptr=0,realized=0,previousEquity=32000;
  const overall=new Dd(32000),months=new Map<string,R>(),moments:R[]=[];
  let old:R|null=null,tail:Dd|null=null,worstOpen=0;
  const afterPrices={low:Infinity,lowAt:0,high:-Infinity,highAt:0};
  const mark=(price:number)=>inv.reduce((n,p)=>n+p.qty*(price-p.entryPrice)-.00055*p.qty*(price+p.entryPrice),0);
  function fill(x:R){
    assert.deepEqual(inv,x.before);
    if(x.event.kind!=='open')for(const p of inv){const q=p.qty-(x.after.find((v:R)=>v.id===p.id)?.qty??0);assert(q>=-1e-10);
      realized+=q*(x.event.price-p.entryPrice)-.00055*q*(x.event.price+p.entryPrice);}
    inv=x.after;
  }
  function snapshot(c:Candle){const qty=inv.reduce((n,p)=>n+p.qty,0);return{at:c.endTs,price:c.close,equity:32000+realized+mark(c.close),realized,
    open:mark(c.close),depth:inv.length,qty,avgEntry:qty?inv.reduce((n,p)=>n+p.notional,0)/qty:null,inventory:inv};}
  let final:R|null=null;
  for(let i=row.startIdx;i<row.endIdx;i++){
    const c=cs[i],key=new Date(c.endTs).toISOString().slice(0,7);
    if(!months.has(key))months.set(key,{month:key,startEquity:previousEquity,startRealized:realized,tracker:new Dd(previousEquity)});
    const m=months.get(key)!;
    const observe=(price:number)=>{const open=mark(price),equity=32000+realized+open;overall.mark(equity);m.tracker.mark(equity);
      if(c.endTs>boundary){assert(tail);tail.mark(equity);worstOpen=Math.min(worstOpen,open);}return equity;};
    while(events[ptr]?.event.fillIndex===i&&events[ptr].event.fillAt===c.ts)fill(events[ptr++]);
    observe(c.low);
    while(events[ptr]?.event.fillIndex===i)fill(events[ptr++]);
    previousEquity=observe(c.close);m.endEquity=previousEquity;m.endRealized=realized;final=snapshot(c);
    if(c.endTs===boundary){old=final;tail=new Dd(previousEquity);moments.push(final);}
    if(c.endTs>boundary){if(c.low<afterPrices.low){afterPrices.low=c.low;afterPrices.lowAt=c.ts;}
      if(c.high>afterPrices.high){afterPrices.high=c.high;afterPrices.highAt=c.ts;}}
    if(c.endTs===Date.parse('2026-09-15T00:00:00Z')||c.endTs===Date.parse('2026-09-15T18:37:00Z'))moments.push(final);
  }
  assert(old&&tail&&final);assert.equal(ptr,events.length);near(final.equity-32000,row.metrics.totalPnl);
  near(final.realized,row.metrics.realized);near(final.open,row.metrics.openPnl);near(overall.pct,row.metrics.maxDrawdownPct);near(overall.min,row.metrics.minEquity);
  near(old.equity,row.extension.cutoffSnapshot.equity);near(final.equity,row.extension.finalSnapshot.equity);
  const monthly=row.accounting.monthly.map((m:R)=>{const x=months.get(m.month);assert(x);near(x.endEquity,m.endEquity);
    near(x.endEquity-x.startEquity,m.mtmPnl);near(x.endRealized-x.startRealized,m.realizedPnl);
    return{...m,monthlyDrawdownPct:x.tracker.pct,averageLoss:m.losses?m.lossDollars/m.losses:null};});
  const es=row.metrics.episodes.filter((e:R)=>Date.parse(e.close)>boundary);
  return{name:row.name,tp:row.tp,policy:row.policy,start:old,end:final,monthly,moments,afterPrices,
    addedPeriodEquityChange:final.equity-old.equity,addedPeriodMaxDrawdownPct:tail.pct,addedPeriodMinEquity:tail.min,
    addedPeriodWorstOpenPnl:worstOpen,completed:es,completedWins:es.filter((e:R)=>e.pnl>0).length,completedLosses:es.filter((e:R)=>e.pnl<0).length,
    warning:'Closed episode dollars include pre-boundary accrual. Period equity change is separate; neither is live account PnL.'};
}
