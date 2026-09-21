/** Saved research data, never a production gate. No candle/observer imports at runtime. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import crypto from 'crypto';
import type {MacroBar, MacroEvent, MacroSpec, MacroZone, Touch} from './macro-sr-observer';

export type Role = 'support'|'resistance';
export interface LevelState {
  id:string; role:Role; touches:number; lastTouchKnownAt:number;
  lastFlipAt:number|null; retestSinceFlip:boolean;
}
export interface HistoricalLevel {
  id:string; center:number; lower:number; upper:number; origin:Role;
  seedPivotAt:number; createdAt:number; qualifiedAt:number; retiredAt:number|null;
  touches:Touch[];
}
export interface Frame {at:number; healthy:boolean; close:number; levels:LevelState[]}
export interface RoleInterval {id:string; start:number; end:number; role:Role}
export interface MajorMap {
  version:1; key:string; symbol:string; cutoff:number; sourceStart:number; sourceEnd:number;
  clock:'corrected_exchange_history_bar_close'; spec:MacroSpec; memoryDays:number;
  frames:Frame[]; levels:HistoricalLevel[]; intervals:RoleInterval[]; bars:MacroBar[];
}
export const projectZone=(z:MacroZone):LevelState=>({id:z.id,role:z.role,touches:z.touches.length,
  lastTouchKnownAt:z.touches.at(-1)!.knownAt,lastFlipAt:z.lastFlipAt,retestSinceFlip:z.retestSinceFlip});

export function roleIntervals(events:readonly MacroEvent[],cutoff:number):RoleInterval[]{
  const open=new Map<string,{start:number;role:Role}>(),out:RoleInterval[]=[];
  for(const e of events){
    if(e.kind==='qualified') {assert(!open.has(e.zone.id));open.set(e.zone.id,{start:e.at,role:e.zone.role});}
    else if(['breakout_accepted','reclaimed','support_failed','expired'].includes(e.kind)){
      const p=open.get(e.zone.id);if(!p)continue;
      if(e.at>p.start)out.push({id:e.zone.id,start:p.start,end:e.at,role:p.role});
      open.delete(e.zone.id);if(e.kind!=='expired')open.set(e.zone.id,{start:e.at,role:e.zone.role});
    }
  }
  for(const [id,p] of open)if(cutoff>p.start)out.push({id,start:p.start,end:cutoff,role:p.role});
  return out.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
}

export class HistoricalMajorMap {
  private readonly byId:Map<string,HistoricalLevel>;
  constructor(private readonly tape:MajorMap){
    assert.equal(tape.version,1);assert.equal(tape.clock,'corrected_exchange_history_bar_close');
    assert(Number.isSafeInteger(tape.cutoff));assert(tape.spec.minutes>0);
    this.byId=new Map(tape.levels.map(z=>[z.id,z]));assert.equal(this.byId.size,tape.levels.length);
    let prev=-Infinity;
    for(const f of tape.frames){assert(f.at>prev&&f.at<=tape.cutoff);prev=f.at;
      assert.equal(new Set(f.levels.map(z=>z.id)).size,f.levels.length);
      for(const z of f.levels){const d=this.byId.get(z.id);assert(d&&d.qualifiedAt<=f.at);assert(d.retiredAt===null||f.at<d.retiredAt);
        assert(z.lastTouchKnownAt<=f.at);assert(z.lastFlipAt===null||z.lastFlipAt<=f.at);}}
  }
  at(now:number,lagMs=0){
    assert(Number.isSafeInteger(now)&&Number.isSafeInteger(lagMs)&&lagMs>=0);
    assert(now<=this.tape.cutoff,'Query exceeds the saved cutoff; build a separately identified extension');
    const effective=now-lagMs,frames=this.tape.frames;
    let lo=0,hi=frames.length;while(lo<hi){const mid=(lo+hi)>>>1;if(frames[mid].at<=effective)lo=mid+1;else hi=mid;}
    const f=frames[lo-1],expected=Math.floor(effective/(this.tape.spec.minutes*60000))*this.tape.spec.minutes*60000;
    const healthy=!!f&&f.healthy&&f.at===expected;
    return{key:this.tape.key,symbol:this.tape.symbol,at:now,sourceAt:f?.at??null,availableAt:f?f.at+lagMs:null,
      healthy,reason:!f?'no_closed_bar':f.at!==expected?'missing_latest_closed_bar':!f.healthy?'insufficient_continuous_history':'healthy',
      close:f?.close??null,
      // Never expose future retirement, future touches or end-of-period role from the catalog.
      levels:(f?.levels??[]).map(z=>{const d=this.byId.get(z.id)!;return {...z,center:d.center,lower:d.lower,upper:d.upper,
        origin:d.origin,qualifiedAt:d.qualifiedAt};})};
  }
}

/** Load once per study and share the reader across variants. No map recomputation. */
export function loadHistoricalMajorMap(jobDir:string,expectedKey:string){
  assert(/^[a-f0-9]{64}$/.test(expectedKey));
  const state=JSON.parse(fs.readFileSync(path.join(jobDir,'state.json'),'utf8'));
  const verified=JSON.parse(fs.readFileSync(path.join(jobDir,'verification.json'),'utf8'));
  assert.equal(state.status,'complete');assert.equal(state.key,expectedKey);
  assert.equal(verified.passed,true);assert.equal(verified.key,expectedKey);
  const pin=state.artifacts.find((p:{file:string})=>p.file.endsWith('/output/map.json'));assert(pin);
  const data=fs.readFileSync(path.join(jobDir,'output/map.json'));
  assert.equal(data.length,pin.bytes);const digest=crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(digest,pin.sha256,'Saved map hash mismatch');assert.equal(digest,verified.mapSha256);
  const tape=JSON.parse(data.toString('utf8')) as MajorMap;assert.equal(tape.key,expectedKey);
  return new HistoricalMajorMap(tape);
}
