import assert from 'assert/strict';
import {ReplaySrContext} from './replay-sr-context';
import {spaced} from './resistance-tp-opportunity';
import type {ResearchTpTarget} from './replay-causal-engine';
import type {Candle} from './hype-freerun-canonical-replay';
import type {SRMemoryZoneConfig} from '../src/bot/sr-memory-zones';
export type R=Record<string,any>;
export const VARIANTS=['exact','buffer03','sr_fixed1','all_fixed1'] as const;
export type Mode=typeof VARIANTS[number];
export function priceFor(mode:Mode,avg:number,resistance:number|null){
  if(mode==='all_fixed1'||mode==='sr_fixed1')return avg*1.01;
  assert(resistance!==null);return mode==='exact'?resistance:Math.max(avg*1.01,resistance*.997);
}
export class ShadeController{
  readonly selected:R[]=[];readonly counts:R={checks:0,unhealthy:0,noResistance:0,outOfBand:0,tooFewTouches:0,selected:0,immediate:0};
  private sr:ReplaySrContext|null;
  constructor(readonly mode:Mode,cs:Candle[],cfg:SRMemoryZoneConfig,readonly lag:number){this.sr=mode==='all_fixed1'?null:new ReplaySrContext(cs,cfg);}
  // Advance on every closed minute, matching the unchanged map's rebuild cadence.
  advance(at:number){this.sr?.at(at-this.lag);}
  readonly decide=(d:Readonly<ResearchTpTarget>):number|null=>{
    assert.equal(d.pct,1.4);this.counts.checks++;let evidence:R={sourceAt:null,resistance:null,touches:[],spaced:[]};
    if(this.sr){const sourceAt=d.at-this.lag,ctx=this.sr.at(sourceAt);
      if(!ctx.coverage.healthy){this.counts.unhealthy++;return null;}
      const r=ctx.engine.nearestResistance(sourceAt,d.price);
      if(!r){this.counts.noResistance++;return null;}
      if(r.lv.price<d.avgEntry*1.01||r.lv.price>=d.normalTarget){this.counts.outOfBand++;return null;}
      const ts=spaced(r.lv.touchData);if(ts.length<3){this.counts.tooFewTouches++;return null;}
      evidence={sourceAt,resistance:r.lv.price,touches:r.lv.touchData,spaced:ts};
    }
    const target=priceFor(this.mode,d.avgEntry,evidence.resistance),immediate=target<=d.price;
    this.counts.selected++;if(immediate)this.counts.immediate++;
    this.selected.push({...d,...evidence,selectedPrice:target,immediate});return target;
  };
}
export function validate(d:R){assert.deepEqual(d.variants,[...VARIANTS]);assert.equal(d.runs,36);assert.equal(d.exactControls,8);
  assert.equal(d.newTradingDefinitions,4);assert.equal(d.feeRate,.00055);assert.equal(d.initialEquity,32000);assert.deepEqual(d.sourceLagsMs,[0,60000]);}
