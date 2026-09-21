/** Offline, price-only major structure observer. No orders, gates or runtime imports. */
import assert from 'assert/strict';
export interface Minute {ts:number;endTs:number;open:number;high:number;low:number;close:number;volume:number;turnover:number}
export interface MacroBar {ts:number;endTs:number;open:number;high:number;low:number;close:number;minutes:number}
export interface MacroSpec {minutes:number;wing:number;halfWidthPct:number;touchSpacingHours:number}
export interface Touch {pivotAt:number;knownAt:number;price:number;side:'support'|'resistance'}
export interface MacroZone {id:string;center:number;lower:number;upper:number;origin:'support'|'resistance';role:'support'|'resistance';createdAt:number;firstKnownAt:number|null;touches:Touch[];qualified:boolean;above:number;below:number;lastFlipAt:number|null;retestSinceFlip:boolean}
export interface MacroEvent {kind:string;at:number;barEnd:number;healthy:boolean;zone:MacroZone;close:number}
export function completeBars(cs:readonly Minute[],minutes:number):MacroBar[]{
  const ms=minutes*60000,out:MacroBar[]=[];for(let i=0;i<cs.length;){const ts=Math.floor(cs[i].ts/ms)*ms,rows:Minute[]=[];
    while(i<cs.length&&cs[i].ts<ts+ms)rows.push(cs[i++]);
    if(rows.length!==minutes||rows.some((c,k)=>c.ts!==ts+k*60000||c.endTs!==c.ts+60000))continue;
    out.push({ts,endTs:ts+ms,open:rows[0].open,close:rows.at(-1)!.close,high:Math.max(...rows.map(c=>c.high)),low:Math.min(...rows.map(c=>c.low)),minutes});}
  return out;
}
export class MacroObserver {
  private history:MacroBar[]=[];private zones:MacroZone[]=[];private previousEnd:number|null=null;private run=0;
  readonly events:MacroEvent[]=[];
  constructor(readonly spec:MacroSpec,readonly memoryDays=120,readonly confirmations=2,readonly minimumTouches=2,readonly lagMs=0){
    assert(spec.minutes>0&&spec.wing>=1&&spec.halfWidthPct>0&&spec.touchSpacingHours>0);assert(memoryDays>0&&confirmations>=1&&minimumTouches>=2&&lagMs>=0);
  }
  snapshot(){return{healthy:this.run>=Math.ceil(this.memoryDays*1440/this.spec.minutes),lastAvailableAt:this.previousEnd===null?null:this.previousEnd+this.lagMs,
    zones:structuredClone(this.zones.filter(z=>z.qualified))};}
  step(b:MacroBar){
    const ms=this.spec.minutes*60000,at=b.endTs+this.lagMs;
    assert.equal(b.endTs-b.ts,ms);assert.equal(b.minutes,this.spec.minutes);assert([b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0));
    assert(b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close));assert(this.previousEnd===null||b.endTs>this.previousEnd);
    const gap=this.previousEnd!==null&&b.ts!==this.previousEnd;this.run=gap?1:this.run+1;
    this.previousEnd=b.endTs;if(gap){this.history=[];for(const z of this.zones){z.above=0;z.below=0;}}
    this.history.push(b);if(this.history.length>2*this.spec.wing+1)this.history.shift();
    const healthy=this.snapshot().healthy;
    const emit=(kind:string,z:MacroZone)=>this.events.push({kind,at,barEnd:b.endTs,healthy,zone:structuredClone(z),close:b.close});
    const horizon=at-this.memoryDays*86400000;
    for(const z of this.zones){z.touches=z.touches.filter(t=>t.knownAt>=horizon);if(!z.touches.length||(z.qualified&&z.touches.length<this.minimumTouches)){emit('expired',z);z.touches=[];}}
    this.zones=this.zones.filter(z=>z.touches.length>0);
    // Confirming bar is present; tied pivots do not count. Missing right/left bars cannot be skipped.
    if(this.history.length===2*this.spec.wing+1){
      const pivot=this.history[this.spec.wing];
      for(const side of ['resistance','support'] as const){const isHigh=side==='resistance',value=isHigh?pivot.high:pivot.low;
        const valid=this.history.every((x,i)=>i===this.spec.wing||(isHigh?x.high<value:x.low>value));if(!valid)continue;
        const touch={pivotAt:pivot.ts,knownAt:at,price:value,side};
        const matches=this.zones.filter(z=>value>=z.lower&&value<=z.upper).sort((a,b)=>Math.abs(a.center-value)-Math.abs(b.center-value)||a.createdAt-b.createdAt);
        let z=matches[0];
        if(!z){z={id:`${this.spec.minutes}:${pivot.ts}:${side}`,center:value,lower:value*(1-this.spec.halfWidthPct/100),upper:value*(1+this.spec.halfWidthPct/100),origin:side,role:side,
          createdAt:at,firstKnownAt:null,touches:[],qualified:false,above:0,below:0,lastFlipAt:null,retestSinceFlip:false};this.zones.push(z);}
        const last=z.touches.at(-1);if(last&&pivot.ts-last.pivotAt<this.spec.touchSpacingHours*3600000)continue;
        z.touches.push(touch);if(!z.qualified&&z.touches.length>=this.minimumTouches){z.qualified=true;z.firstKnownAt=at;emit('qualified',z);}
      }
    }
    for(const z of this.zones.filter(z=>z.qualified)){
      // Only bars starting AFTER the level first became known can confirm a flip.
      if(b.ts+this.lagMs<z.firstKnownAt!)continue;
      z.above=b.close>z.upper?z.above+1:0;z.below=b.close<z.lower?z.below+1:0;
      if(z.role==='resistance'&&z.above>=this.confirmations){const kind=z.lastFlipAt===null?'breakout_accepted':'reclaimed';z.role='support';z.lastFlipAt=at;z.retestSinceFlip=false;z.above=z.below=0;emit(kind,z);}
      else if(z.role==='support'&&z.below>=this.confirmations){z.role='resistance';z.lastFlipAt=at;z.retestSinceFlip=false;z.above=z.below=0;emit('support_failed',z);}
      else if(z.role==='support'&&z.lastFlipAt!==null&&at>z.lastFlipAt&&!z.retestSinceFlip&&b.low<=z.upper&&b.high>=z.lower&&b.close>z.upper){z.retestSinceFlip=true;emit('support_retest_held',z);}
    }
  }
}
export function observe(bars:readonly MacroBar[],spec:MacroSpec,days=120,lagMs=0,asOf=Infinity){
  const o=new MacroObserver(spec,days,2,2,lagMs);for(const b of bars){if(b.endTs+lagMs>asOf)break;o.step(b);}return o;
}
