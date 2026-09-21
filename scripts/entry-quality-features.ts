/** EQ01 source-only context. No future prices or episode outcomes here. */
import {ClosedBarSeries} from '../src/research/closed-bars';
import type {Candle} from './hype-freerun-canonical-replay';
export type R=Record<string,any>;export const M=60000,H=3600000;
export function hourly(cs:Candle[]):R[]{const bs=ClosedBarSeries.fromHistorical(cs.map(c=>({timestamp:c.ts,...c})),
  {sourceIntervalMs:M,targetIntervalMs:H,publicationLagMs:0}).bars;let atr:number|null=null,sum=0,run=0;
  return bs.map((b,i)=>{const c=b.candle,p=bs[i-1];if(!p||p.barEnd!==b.barEnd-H){atr=null;sum=0;run=0;}
    else{const tr=Math.max(c.high-c.low,Math.abs(c.high-p.candle.close),Math.abs(c.low-p.candle.close));run++;
      if(run<=14){sum+=tr;if(run===14)atr=sum/14;}else atr=(atr!*13+tr)/14;}
    return {at:b.barEnd,open:c.open,high:c.high,low:c.low,close:c.close,volume:c.volume,turnover:c.turnover,atr,run};});}
export class EntryContext {
  readonly hype:Map<number,R>;readonly btc:Map<number,R>;
  constructor(h:R[],b:R[]){this.hype=new Map(h.map(x=>[x.at,x]));this.btc=new Map(b.map(x=>[x.at,x]));}
  at(decisionAt:number,lag:number):R{const end=Math.floor((decisionAt-lag)/H)*H;
    const one=(map:Map<number,R>)=>{const x=map.get(end),p=map.get(end-H),old=map.get(end-48*H);
      const returns=Object.fromEntries([1,4,24,48].map(h=>{const w=Array.from({length:h+1},(_,k)=>map.get(end-k*H));
        return [h,w.every(Boolean)?100*(x!.close/w.at(-1)!.close-1):null];}));
      const window=Array.from({length:48},(_,k)=>map.get(end-k*H)),high48=window.every(Boolean)?Math.max(...window.map(b=>b!.high)):null;
      const priorAtrPct=old?.atr!=null?100*old.atr/old.close:null;
      return {end,availableAt:end+lag,price:x?.close??null,returns,priorAtrAt:end-48*H,priorAtrPct,
        normalized48:returns[48]!==null&&priorAtrPct!==null&&priorAtrPct>0?returns[48]/(priorAtrPct*Math.sqrt(48)):null,
        high48,distance48:high48!==null&&x?100*(1-x.close/high48):null,
        structure:x&&p?x.close>p.high?'up_break':x.close<p.low?'down_break':'inside':'unknown'};};
    const h=one(this.hype),b=one(this.btc);return {at:decisionAt,lag,hype:h,btc:b,
      gap4:h.returns[4]!==null&&b.returns[4]!==null?h.returns[4]-b.returns[4]:null};
  }
}
export function categories(f:R):R{const h=f.hype,b=f.btc;return {
  fixedExtension:h.returns[48]===null?'unknown':h.returns[48]>=10?'extended':'not_extended',
  scaledExtension:h.normalized48===null?'unknown':h.normalized48>=1?'extended':'not_extended',
  nearHigh:h.distance48===null?'unknown':h.distance48<=1?'near':'away',
  structure:h.structure,btcDirection:b.returns[4]===null?'unknown':b.returns[4]<0?'negative':'nonnegative',
  relative:f.gap4===null?'unknown':f.gap4<0?'underperform':'outperform_or_equal',
  btcDip1h:b.returns[1]===null?'unknown':b.returns[1]<=-.5?'dip':'no_dip',
  btcRise1h:b.returns[1]===null?'unknown':b.returns[1]>=.5?'rise':'no_rise'};}
export function joint(f:R):string{const c=categories(f);return [c.scaledExtension,c.structure,c.btcDirection].join('/');}
