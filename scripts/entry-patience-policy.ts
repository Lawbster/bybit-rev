/** A waiting opportunity, not a resting exchange order. */
import assert from "assert/strict";
import type {ResearchAddDecision,ResearchInventoryEvent} from "./replay-causal-engine";
export type R=Record<string,any>;
export type Spec={id:string;minDepth:number;offsetPct:number};
export const SPECS:Spec[]=[2,8].flatMap(minDepth=>[0,.1,.3].map(offsetPct=>({id:`timer${minDepth}_cap${offsetPct}`,minDepth,offsetPct})));
export class EntryPatience {
  pending:R|null=null;retryAt=0;lastApprovedAt=-1;
  events:R[]=[];intents:R[]=[];checks:R[]=[];
  constructor(readonly spec:Spec,readonly model:"open"|"cap"|"activation60"="open"){}
  private cancel(at:number,reason:string){if(this.pending){this.pending.phase=reason;this.pending.endedAt=at;this.pending=null;}}
  readonly decide=(d:Readonly<ResearchAddDecision>&{intervalMinutes?:number})=>{
    this.lastApprovedAt=d.at;
    if(this.pending&&d.at>=this.pending.expiresAt)this.cancel(d.at,"expired");
    let veto=false;
    if(d.priceDropOk){this.cancel(d.at,"price_drop_priority");}
    else if(d.nextDepth>=this.spec.minDepth){
      if(!this.pending&&d.at>=this.retryAt){
        assert([30,60].includes(d.intervalMinutes!));
        this.pending={signalAt:d.at,index:d.index,episode:d.episode,nextDepth:d.nextDepth,reference:d.price,
          cap:d.price*(1-this.spec.offsetPct/100),expiresAt:d.at+900000,activeAt:d.at+(this.model==="activation60"?60000:0),
          retryAt:d.at+d.intervalMinutes!*60000,phase:"waiting",endedAt:null,fillAt:null,fillPrice:null};
        this.retryAt=this.pending.retryAt;this.intents.push(this.pending);
      }
      veto=!this.pending||d.at<this.pending.activeAt||d.price>this.pending.cap;
    }
    const x={...d,veto};this.checks.push(x);this.events.push({type:"decision",...x});return veto;
  };
  readonly fill=(x:{at:number;index:number;decisionIndex:number;reason:string;open:number})=>{
    let price:number|null=x.open;
    // A time proposal in-scope always has an active frozen opportunity.
    const proposal=this.checks.at(-1);
    if(x.reason==="time_add"&&proposal?.index===x.decisionIndex&&proposal.nextDepth>=this.spec.minDepth){
      price=this.pending&&x.at<this.pending.expiresAt&&x.at>=this.pending.activeAt&&x.open<=this.pending.cap
        ?this.model==="cap"?this.pending.cap:x.open:null;
      if(price!==null){this.pending!.fillAt=x.at;this.pending!.fillPrice=price;}
    }
    this.events.push({type:"fill",...x,price});return price;
  };
  readonly observe=(e:Readonly<ResearchInventoryEvent>)=>{
    this.events.push({type:"inventory",at:e.event.fillAt,kind:e.event.kind});
    this.cancel(e.event.fillAt!,e.event.kind==="open"?"filled_or_other_open":"inventory_changed");
    // Any fill changes the construction state; subsequent permission comes from normal gates/clock.
    this.retryAt=0;
  };
  readonly end=(x:{at:number;index:number;pending:string|null;gap:boolean})=>{
    if(this.pending&&(x.gap||this.lastApprovedAt!==x.at)){
      this.events.push({type:"cancel",...x});this.cancel(x.at,x.gap?"gap":"gate_or_exit");
    }
  };
  finish(at:number){if(this.pending)this.cancel(at,"cutoff");return {intents:this.intents,checks:this.checks,events:this.events};}
}
