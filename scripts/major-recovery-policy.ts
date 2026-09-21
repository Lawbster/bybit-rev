/** MA01 forward-only major support response. Research only. */
import assert from 'assert/strict';
import {completeBars,type MacroBar,type Minute,type MacroZone} from './macro-sr-observer';
import {type Frame,type Level,nearestSupport} from './macro-support-policy';
export const H=3600000, M=60000;
export type EventKind='touch'|'sweep_reclaim'|'accepted_below'|'failed_retest'|'old_reclaim'|'lower_base'|'retired';
export type Watch={zone:Level;armedAt:number;below:number};
export type Low={ts:number;knownAt:number;price:number};
export type Spell={id:string;zone:Level;armedAt:number;failedAt:number;failedRetestAt:number|null;above:number;lows:Low[];neckline:number|null;necklineKnownAt:number|null};
export type Row={at:number;barEnd:number;healthy:boolean;close:number;watch:Watch|null;spell:Spell|null};
export type Event={id:string;kind:EventKind;at:number;barEnd:number;zone:Level;spellId:string|null;price:number;evidence:Record<string,any>};
const ref=(z:MacroZone):Level=>({id:z.id,lower:z.lower,upper:z.upper,origin:z.origin,firstKnownAt:z.firstKnownAt});
export class RecoveryObserver {
  watch:Watch|null=null;spell:Spell|null=null;
  readonly rows:Row[]=[];readonly events:Event[]=[];
  private lastEnd:number|null=null;private postFailure:MacroBar[]=[];private lastTouch=new Map<string,number>();
  step(b:MacroBar,f:Frame|null):Row{
    assert(b.minutes===60&&b.endTs-b.ts===H);assert(this.lastEnd===null||b.endTs>this.lastEnd);
    const contiguous=this.lastEnd===null||this.lastEnd===b.ts;this.lastEnd=b.endTs;
    const healthy=contiguous&&!!f?.healthy&&f.at<=b.endTs&&f.bar.endTs===Math.floor(b.endTs/(4*H))*4*H;
    if(!healthy||!contiguous){if(this.watch)this.watch.below=0;if(this.spell){this.spell.above=0;this.spell.lows=[];this.spell.neckline=null;this.spell.necklineKnownAt=null;}this.postFailure=[];}
    const emit=(kind:EventKind,z:Level,spellId:string|null,evidence:Record<string,any>={})=>this.events.push({id:`${kind}:${z.id}:${b.endTs}`,kind,at:b.endTs,barEnd:b.endTs,zone:{...z},spellId,price:b.close,evidence});
    let released=false;
    if(healthy){
      if(this.spell){
        const s=this.spell;assert(s.failedAt<b.endTs);this.postFailure.push(b);
        s.above=b.close>s.zone.upper?s.above+1:0;
        const xs=this.postFailure;
        if(xs.length>=5){const p=xs[xs.length-3],wing=xs.slice(-5);
          if(wing.every((x,i)=>i===2||x.low>p.low)){
            const prior=s.lows.at(-1);const low={ts:p.ts,knownAt:b.endTs,price:p.low};
            if(prior&&low.price>prior.price){const between=xs.filter(x=>x.ts>prior.ts&&x.ts<low.ts);
              s.neckline=between.length?Math.max(...between.map(x=>x.high)):null;s.necklineKnownAt=s.neckline===null?null:b.endTs;
            }else{s.neckline=null;s.necklineKnownAt=null;}
            s.lows=[...(prior?[prior]:[]),low];
          }
        }
        if(s.lows.length&&b.low<s.lows.at(-1)!.price){s.neckline=null;s.necklineKnownAt=null;}
        const why=!f!.zones.some(z=>z.id===s.zone.id)?'retired':s.above>=2?'old_reclaim':s.neckline!==null&&b.close>s.neckline?'lower_base':null;
        if(why){emit(why,s.zone,s.id,{lows:s.lows,neckline:s.neckline,necklineKnownAt:s.necklineKnownAt,failedAt:s.failedAt});this.spell=null;this.watch=null;this.postFailure=[];released=true;}
        else if(s.failedRetestAt===null&&b.high>=s.zone.lower&&b.low<=s.zone.upper&&b.close<s.zone.lower){s.failedRetestAt=b.endTs;emit('failed_retest',s.zone,s.id,{failedAt:s.failedAt});}
      }
      if(!this.spell&&!released){
        if(this.watch&&!f!.zones.some(z=>z.id===this.watch!.zone.id))this.watch=null;
        if(this.watch){const w=this.watch;assert(w.armedAt<=b.ts,'entire response bar follows selection');
          if((this.rows.at(-1)?.close??Infinity)>=w.zone.upper&&b.low<=w.zone.upper&&b.high>=w.zone.lower&&b.endTs>=(this.lastTouch.get(w.zone.id)??-Infinity)+24*H){
            emit('touch',w.zone,null,{armedAt:w.armedAt,low:b.low,high:b.high});this.lastTouch.set(w.zone.id,b.endTs);
            if(b.low<w.zone.lower&&b.close>w.zone.upper)emit('sweep_reclaim',w.zone,null,{armedAt:w.armedAt,low:b.low});
          }
          w.below=b.close<w.zone.lower?w.below+1:0;
          if(w.below>=2){const id=`${w.zone.id}@${b.endTs}`;
            this.spell={id,zone:{...w.zone},armedAt:w.armedAt,failedAt:b.endTs,failedRetestAt:null,above:0,lows:[],neckline:null,necklineKnownAt:null};
            emit('accepted_below',w.zone,id,{armedAt:w.armedAt,consecutiveCloses:2});this.watch=null;this.postFailure=[];
          }
        }
        if(!this.spell&&(!this.watch||b.close>this.watch.zone.upper)){
          const z=nearestSupport({...f!,bar:{...f!.bar,close:b.close}},{id:'atlas',scope:'any_support',maxBlockHours:null});
          if(z?.id!==this.watch?.zone.id)this.watch=z?{zone:ref(z),armedAt:b.endTs,below:0}:null;
        }
      }
    }
    const row={at:b.endTs,barEnd:b.endTs,healthy,close:b.close,watch:structuredClone(this.watch),spell:structuredClone(this.spell)};this.rows.push(row);return row;
  }
}
export function responseTape(cs:readonly Minute[],frames:readonly Frame[]){
  const o=new RecoveryObserver();let k=-1;
  for(const b of completeBars(cs,60)){while(k+1<frames.length&&frames[k+1].at<=b.endTs)k++;o.step(b,frames[k]??null);}return o;
}
export function rowAt(rows:readonly Row[],at:number,lag=0){
  let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>>1;if(rows[m].at+lag<=at)lo=m+1;else hi=m;}
  const row=rows[lo-1]??null,healthy=!!row?.healthy&&row.barEnd===Math.floor((at-lag)/H)*H;return{row,healthy};
}
/** For descriptive labels only. Never import into a decision function. */
export function futureLabel(cs:readonly Minute[],at:number,hours:number){
  const i=(at-cs[0].ts)/M,n=hours*60,rows=cs.slice(i,i+n);
  if(!Number.isInteger(i)||i<0||rows.length!==n||rows.some((c,j)=>c.ts!==at+j*M))return null;
  const entry=rows[0].open;let high=entry,low=entry,first:string|null=null;
  for(const c of rows){high=Math.max(high,c.high);low=Math.min(low,c.low);if(first===null){const u=c.high>=entry*1.014,d=c.low<=entry*.98;if(u||d)first=u&&d?'ambiguous':u?'up':'down';}}
  return{entry,returnPct:(rows.at(-1)!.close/entry-1)*100,mfePct:(high/entry-1)*100,maePct:(low/entry-1)*100,first:first??'neither',endAt:at+hours*H};
}
