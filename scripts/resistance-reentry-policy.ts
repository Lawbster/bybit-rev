/** SRR01 research adapter. No production mutations or new engine seams. */
import assert from 'assert/strict';
import {ShadeController,type R} from './resistance-tp-replay-policy';
import type {Candle} from './hype-freerun-canonical-replay';
import type {SRMemoryZoneConfig} from '../src/bot/sr-memory-zones';
import type {ResearchTpTarget,ResearchInventoryEvent,ResearchAddDecision} from './replay-causal-engine';
export type WaitMode='off'|'wait4h'|'breakout4h';
export const M=60000,FIVE=5*M,WAIT=240*M;
export function fiveMinuteBars(cs:Candle[]):Map<number,Candle>{
  const bars=new Map<number,Candle>();
  for(let i=4;i<cs.length;i++)if(cs[i].endTs%FIVE===0){const tail=cs.slice(i-4,i+1);
    if(tail[0].ts!==cs[i].endTs-FIVE||tail.some((b,j)=>b.endTs!==b.ts+M||j>0&&b.ts!==tail[j-1].endTs))continue;
    bars.set(cs[i].endTs,{...tail[0],endTs:cs[i].endTs,close:cs[i].close,high:Math.max(...tail.map(b=>b.high)),low:Math.min(...tail.map(b=>b.low)),
      volume:tail.reduce((s,b)=>s+b.volume,0),turnover:tail.reduce((s,b)=>s+b.turnover,0)});
  }return bars;
}
export class ReentryController {
  readonly shade:ShadeController;readonly activations:R[]=[];readonly probes:R[]=[];
  private selection:R|null=null;private wait:R|null=null;
  constructor(readonly mode:WaitMode,cs:Candle[],cfg:SRMemoryZoneConfig,readonly lag:number,readonly bars=fiveMinuteBars(cs)){
    this.shade=new ShadeController('sr_fixed1',cs,cfg,lag);
  }
  readonly decide=(d:Readonly<ResearchTpTarget>):number|null=>{
    const price=this.shade.decide(d);if(price!==null)this.selection=this.shade.selected.at(-1)!;return price;
  };
  readonly target=(t:Readonly<ResearchTpTarget>)=>{
    if(this.selection&&(t.episode!==this.selection.episode||t.pct!==1.4||Math.abs(t.targetPrice-this.selection.selectedPrice)>1e-8))this.selection=null;
  };
  readonly observe=(e:Readonly<ResearchInventoryEvent>)=>{
    const v=e.event;
    if(v.kind==='close'&&v.reason==='tp'&&e.before.length&&e.after.length===0&&this.selection){
      const s=this.selection;assert.equal(e.episode,s.episode);assert(v.fillIndex!>s.index&&v.fillAt!>=s.at);
      this.wait={episode:e.episode,selectionIndex:s.index,selectionAt:s.at,resistance:s.resistance,target:s.selectedPrice,
        fillAt:v.fillAt,fillIndex:v.fillIndex,expiresAt:v.fillAt!+WAIT,releasedAt:this.mode==='off'?v.fillAt:null,
        releaseReason:this.mode==='off'?'off':null,releaseBar:null,firstEligibleAt:null,blockedChecks:0,lastBlockedAt:null,
        entryDecisionAt:null,entryAt:null,entryPrice:null,nextEpisode:null};this.activations.push(this.wait);
    }
    if(v.kind==='open'&&!e.before.length&&this.wait){assert(this.wait.releasedAt!==null&&this.wait.releasedAt<=v.decisionAt);
      Object.assign(this.wait,{entryDecisionAt:v.decisionAt,entryAt:v.fillAt,entryPrice:v.price,nextEpisode:e.episode});this.wait=null;
    }
    this.selection=null; // every executed inventory mutation invalidates the old target provenance
  };
  advance(at:number){
    this.shade.advance(at);const w=this.wait;if(!w||w.releasedAt!==null)return;
    if(at>=w.expiresAt){w.releasedAt=at;w.releaseReason='cap';return;}
    if(this.mode==='breakout4h'){const b=this.bars.get(Math.floor((at-this.lag)/FIVE)*FIVE);
      if(b&&b.ts>=w.fillAt&&b.endTs+this.lag<=at&&b.close>w.resistance*1.001){w.releasedAt=at;w.releaseReason='breakout';w.releaseBar={start:b.ts,end:b.endTs,close:b.close,availableAt:b.endTs+this.lag};}
    }
  }
  readonly veto=(d:Readonly<ResearchAddDecision>):boolean=>{
    const w=d.nextDepth===1?this.wait:null;if(w&&w.firstEligibleAt===null)w.firstEligibleAt=d.at;
    const blocked=!!w&&w.releasedAt===null;if(blocked){w!.blockedChecks++;w!.lastBlockedAt=d.at;}
    this.probes.push({...d,blocked,waitEpisode:w?.episode??null});return blocked;
  };
}
export function validate(d:R){assert.deepEqual(d.variants,['wait4h','breakout4h']);assert.equal(d.runs,24);assert.equal(d.exactControls,8);
  assert.equal(d.newTradingDefinitions,2);assert.equal(d.waitMs,WAIT);assert.equal(d.breakoutMultiplier,1.001);assert.equal(d.feeRate,.00055);assert.equal(d.initialEquity,32000);assert.deepEqual(d.sourceLagsMs,[0,60000]);}
