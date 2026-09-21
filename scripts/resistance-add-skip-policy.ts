/** SRK01 local research only. No production changes and no new replay seams. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
import type {ResearchAddDecision} from './replay-causal-engine';
import type {SRMemoryZoneConfig} from '../src/bot/sr-memory-zones';
import {ReplaySrContext} from './replay-sr-context';
import {spaced} from './resistance-tp-opportunity';
export type R=Record<string,any>;
export function qualifies(a:Pick<ResearchAddDecision,'nextDepth'|'priceDropOk'|'price'>,f:R):boolean {
  return a.nextDepth>=6&&!a.priceDropOk&&f.healthy&&f.resistance!==null&&f.resistance>a.price&&
    f.distancePct!==null&&f.distancePct<=0.3+1e-10&&f.spaced.length>=3;
}
export class ResistanceSkip {
  readonly sr:ReplaySrContext;readonly probes:R[]=[];private atNow=-Infinity;
  private context:ReturnType<ReplaySrContext['at']>|null=null;
  constructor(cs:Candle[],cfg:SRMemoryZoneConfig,readonly lag:number,readonly enabled:boolean){
    assert(lag===0||lag===60000);this.sr=new ReplaySrContext(cs,cfg);
  }
  advance(at:number){this.context=this.sr.at(at-this.lag);this.atNow=at;}
  readonly veto=(a:Readonly<ResearchAddDecision>):boolean=>{
    assert.equal(a.at,this.atNow,'advance at every minute before the gate');
    const at=a.at-this.lag,ct=this.context!,hit=ct.engine.nearestResistance(at,a.price);
    if(!this.lag){assert.equal(ct.coverage.healthy,a.srHealthy);
      if(a.resistanceDistPct!==null&&a.resistanceDistPct<=this.sr.config.bufferPct){assert(hit);assert(Math.abs(hit.lv.price-a.resistancePrice!)<1e-8);}
      else assert.equal(hit,null);
    }
    const f={sourceAt:at,healthy:ct.coverage.healthy,resistance:hit?.lv.price??null,distancePct:hit?hit.dist*100:null,
      touches:hit?.lv.touchData??[],spaced:hit?spaced(hit.lv.touchData):[],coverage:ct.coverage};
    assert(f.touches.every(t=>t.ts<=at));const wouldSkip=qualifies(a,f),blocked=this.enabled&&wouldSkip;
    this.probes.push({...a,feature:f,wouldSkip,blocked});return blocked;
  };
}
export function validate(d:R){assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');
  assert.deepEqual(d.variants,['timer_resistance_skip']);assert.equal(d.runs,12);assert.equal(d.exactControls,4);
  assert.equal(d.minimumExistingDepth,5);assert.equal(d.resistanceDistancePct,.3);assert.equal(d.minimumSpacedTouches,3);
  assert.equal(d.touchSpacingMs,21600000);assert.deepEqual(d.sourceLagsMs,[0,60000]);assert.equal(d.feeRate,.00055);assert.equal(d.initialEquity,32000);}
