/** SF04 small-cohort as-of map; reuse established indicator and HL definitions. */
import assert from 'assert/strict';
import { EMA } from 'technicalindicators';
import { ClosedBarSeries } from '../src/research/closed-bars';
import type { Candle } from './hype-freerun-canonical-replay';
import { indicatorSnapshots, upper, M, H } from './pressure-point-features';
import { type Row } from './tp-hl-event-features';
export { M, H };
export function checkpoints(t: Row, end: number, card: Row): Row[] {
  const rows: Row[] = [];
  for (const offset of card.entryOffsetsMinutes) {
    const at=t.entryAt+offset*M; if(at>=end || (offset>0&&at>=t.exitAt)) continue;
    rows.push({id:t.id, anchor:'entry',offset,at,phase:offset<=0?'pre_entry':'in_trade'});
  }
  for (const offset of card.exitOffsetsMinutes) {
    const at=t.exitAt+offset*M; if(at>=end || (offset<0&&at<t.entryAt)) continue;
    rows.push({id:t.id,anchor:'exit',offset,at,phase:offset<=0?'pre_exit':'post_exit_diagnostic'});
  }
  return rows;
}
export function contextIndicators(cs:Candle[], times:number[], card:Row): Map<number,Row> {
  const raw=indicatorSnapshots(cs,times,card), out=new Map<number,Row>();
  for(const [at,x] of raw) out.set(at,{at,values:{...x.delayedValues},sources:{...x.delayedSources}});
  const minutes=cs.filter(c=>c.ts>=Date.parse(card.indicatorSeed)).map(c=>({timestamp:c.ts,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover}));
  for(const tf of card.timeframesMinutes) {
    const bars=ClosedBarSeries.fromHistorical(minutes,{sourceIntervalMs:M,targetIntervalMs:tf*M,publicationLagMs:M}).bars;
    const closes=bars.map(b=>b.candle.close), ends=bars.map(b=>b.barEnd);
    for(const period of card.emaPeriods) {
      const ema=EMA.calculate({period,values:closes}), skip=closes.length-ema.length;
      for(const at of times) {
        const i=upper(ends,at-M)-1, v=i>=skip?ema[i-skip]:null, prev=i>skip?ema[i-skip-1]:null;
        assert(i>=0&&bars[i].availableAt<=at); const p=`m${tf}_ema${period}`, values=out.get(at)!.values;
        values[p]=v; values[p+'DistancePct']=v===null?null:100*(closes[i]/v-1);
        values[p+'SlopePct']=v===null||prev===null?null:100*(v/prev-1);
      }
    }
  }
  return out;
}
export function distribution(xs:any[]):Row {
  const a=xs.filter((x:any)=>typeof x==='number'&&Number.isFinite(x)).sort((a:number,b:number)=>a-b);
  const q=(p:number)=>{const n=(a.length-1)*p,i=Math.floor(n);return a.length?a[i]+(a[Math.ceil(n)]-a[i])*(n-i):null;};
  return {n:a.length,missing:xs.length-a.length,min:a[0]??null,q25:q(.25),median:q(.5),q75:q(.75),max:a.at(-1)??null};
}
export function recoveryLabel(cs:readonly Candle[],t:Row,end:number):Row {
  if(t.reason!=='stop') return {label:'not_a_stop'};
  const until=t.entryAt+72*H, limit=Math.min(until,end), index=(t.entryAt-cs[0].ts)/M;
  let hit:number|null=null, low=Infinity;
  for(let i=index;i<cs.length&&cs[i].ts<limit;i++) {
    low=Math.min(low,cs[i].low);
    if(cs[i].ts>t.exitAt&&cs[i].high>=t.target) {hit=cs[i].ts;break;}
  }
  return {label:hit!==null?'recovered':until<=end?'not_recovered':'censored',targetTouchAt:hit,
    fullFollowup:until<=end,horizonEnd:until,observedThrough:limit,maeToTouchOrHorizonPct:100*(low/t.entryPrice-1),
    diagnosticOnly:true,includesFullTouchMinute:true};
}
export function compactSources(snapshot:Row):Row {
  const sources:Row={};
  for(const [key,s] of Object.entries(snapshot.sources) as [string,any][]) {
    if(!s){sources[key]=null;continue;}
    if(s.sources) {
      const rs=s.sources.filter(Boolean);
      for(const r of rs) assert(r.availableAt<=snapshot.asOf&&r.sourceAt<=snapshot.asOf);
      const {sources:discard,...rest}=s;
      sources[key]={...rest,count:rs.length,sourceMin:rs.length?Math.min(...rs.map((r:Row)=>r.sourceAt)):null,
        sourceMax:rs.length?Math.max(...rs.map((r:Row)=>r.sourceAt)):null,availableMax:rs.length?Math.max(...rs.map((r:Row)=>r.availableAt)):null,
        first:rs[0]??null,last:rs.at(-1)??null};
    } else {
      if(s.availableAt!=null) assert(s.availableAt<=(s.queryAt??snapshot.asOf)&&s.sourceAt<=(s.queryAt??snapshot.asOf));
      sources[key]=s;
    }
  }
  return sources;
}
