/** MS01 research-only fresh-ladder veto. No exchange, runtime state or live imports. */
import assert from 'assert/strict';
import {MacroObserver,completeBars,type Minute,type MacroBar,type MacroZone,type MacroEvent} from './macro-sr-observer';

export const H=3_600_000, PERIOD=4*H;
export type Variant={id:string;scope:'any_support'|'resistance_flip';maxBlockHours:number|null};
export const VARIANTS:Variant[]=[
  {id:'any_reclaim',scope:'any_support',maxBlockHours:null},
  {id:'flip_reclaim',scope:'resistance_flip',maxBlockHours:null},
  {id:'any_24h',scope:'any_support',maxBlockHours:24},
  {id:'flip_24h',scope:'resistance_flip',maxBlockHours:24},
];
export type Frame={bar:MacroBar;at:number;healthy:boolean;zones:MacroZone[];events:MacroEvent[]};
export type Level=Pick<MacroZone,'id'|'lower'|'upper'|'origin'|'firstKnownAt'>;
export type Watch={zone:Level;armedAt:number;below:number};
export type Block={id:string;zone:Level;watchArmedAt:number;failedAt:number;expiresAt:number|null;above:number};
export type GateRow={at:number;barEnd:number;close:number;healthy:boolean;watch:Watch|null;block:Block|null};
export type Transition={kind:'watch'|'failure'|'reclaim'|'timeout'|'retired';at:number;barEnd:number;zone:Level;blockId:string|null;close:number};
const level=(z:MacroZone):Level=>({id:z.id,lower:z.lower,upper:z.upper,origin:z.origin,firstKnownAt:z.firstKnownAt});
export function buildFrames(cs:readonly Minute[],lag=0):Frame[]{
  assert(lag===0||lag===60000);
  const o=new MacroObserver({minutes:240,wing:3,halfWidthPct:.75,touchSpacingHours:24},120,2,2,lag),frames:Frame[]=[];
  for(const bar of completeBars(cs,240)){
    const n=o.events.length;o.step(bar);const s=o.snapshot();
    frames.push({bar,at:bar.endTs+lag,healthy:s.healthy,zones:s.zones,events:o.events.slice(n)});
  }
  return frames;
}
/** Returns a level known now, never the level selected after seeing a future break. */
export function nearestSupport(frame:Frame,v:Variant):MacroZone|null{
  return frame.zones.filter(z=>z.qualified&&z.role==='support'&&z.firstKnownAt!==null&&z.firstKnownAt<=frame.at
    &&(v.scope==='any_support'||z.origin==='resistance'&&z.lastFlipAt!==null)
    &&frame.bar.close>=z.upper&&(frame.bar.close/z.upper-1)*100<=3+1e-10)
    .sort((a,b)=>b.upper-a.upper||b.touches.length-a.touches.length||a.firstKnownAt!-b.firstKnownAt!||a.id.localeCompare(b.id))[0]??null;
}
export class MajorSupportGate {
  watch:Watch|null=null;block:Block|null=null;private previousEnd:number|null=null;
  readonly rows:GateRow[]=[];readonly events:Transition[]=[];
  constructor(readonly variant:Variant){}
  step(f:Frame):GateRow{
    assert(f.at>=f.bar.endTs&&(!this.rows.length||f.at>this.rows.at(-1)!.at));
    const contiguous=this.previousEnd===null||f.bar.ts===this.previousEnd;this.previousEnd=f.bar.endTs;
    const emit=(kind:Transition['kind'],z:Level,id:string|null)=>this.events.push({kind,at:f.at,barEnd:f.bar.endTs,zone:{...z},blockId:id,close:f.bar.close});
    if(!contiguous){if(this.watch)this.watch.below=0;if(this.block)this.block.above=0;}
    if(f.healthy){
      if(this.block){
        const b=this.block,exists=f.zones.some(z=>z.id===b.zone.id);
        b.above=f.bar.close>b.zone.upper?b.above+1:0;
        const why=!exists?'retired':b.above>=2?'reclaim':b.expiresAt!==null&&f.at>=b.expiresAt?'timeout':null;
        if(why){emit(why,b.zone,b.id);this.block=null;this.watch=null;}
      }
      if(!this.block){
        if(this.watch&&!f.zones.some(z=>z.id===this.watch!.zone.id))this.watch=null;
        if(this.watch){
          const w=this.watch;assert(w.armedAt<f.at);
          w.below=f.bar.close<w.zone.lower?w.below+1:0;
          if(w.below>=2){
            assert(f.events.some(e=>e.kind==='support_failed'&&e.zone.id===w.zone.id),'selected support failure must agree with source observer');
            const id=`${w.zone.id}@${f.at}`;
            this.block={id,zone:{...w.zone},watchArmedAt:w.armedAt,failedAt:f.at,
              expiresAt:this.variant.maxBlockHours===null?null:f.at+this.variant.maxBlockHours*H,above:0};
            emit('failure',w.zone,id);this.watch=null;
          }
        }
        if(!this.block&&(!this.watch||f.bar.close>this.watch.zone.upper)){
          const z=nearestSupport(f,this.variant);
          if(z?.id!==this.watch?.zone.id){this.watch=z?{zone:level(z),armedAt:f.at,below:0}:null;if(this.watch)emit('watch',this.watch.zone,null);}
        }
      }
    }else{if(this.watch)this.watch.below=0;if(this.block)this.block.above=0;}
    const row:GateRow={at:f.at,barEnd:f.bar.endTs,close:f.bar.close,healthy:f.healthy,watch:structuredClone(this.watch),block:structuredClone(this.block)};
    this.rows.push(row);return row;
  }
}
export function gateTape(frames:readonly Frame[],v:Variant){const g=new MajorSupportGate(v);frames.forEach(f=>g.step(f));return g;}
export function gateAt(rows:readonly GateRow[],at:number,lag:number){
  let lo=0,hi=rows.length;while(lo<hi){const m=(lo+hi)>>>1;if(rows[m].at<=at)lo=m+1;else hi=m;}
  const row=rows[lo-1]??null,healthy=!!row?.healthy&&row.barEnd===Math.floor((at-lag)/PERIOD)*PERIOD;
  return{healthy,blocked:!healthy||!!row?.block,reason:!healthy?'macro_context_unknown':row?.block?'major_support_failed':'clear',
    frameAt:row?.at??null,barEnd:row?.barEnd??null,blockId:row?.block?.id??null,zoneId:row?.block?.zone.id??null};
}
export function vetoEntry(nextDepth:number,q:ReturnType<typeof gateAt>){return nextDepth===1&&q.blocked;}
