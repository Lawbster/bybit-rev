import { EMA } from 'technicalindicators';
import { aggregate, type Action, type Row } from './poc-indicator-bias-engine';
import { computeResearchFeatures } from '../src/research/indicator-features';
import type { Candle } from './hype-freerun-canonical-replay';
import { upper } from './pressure-point-features';
export const M=60000,H=60*M;
export function warning(rsi:number|null,distance:number|null):boolean|null {
  return rsi===null||distance===null?null:rsi<52&&distance>6;
}
export function buildPolicyTape(cs:readonly Candle[],lag:number){
  const fast=aggregate(cs,15*M),slow=aggregate(cs,4*H),rsi=computeResearchFeatures(fast,15*M),ema=EMA.calculate({period:200,values:slow.map(b=>b.close)});
  const skip=slow.length-ema.length,ends=slow.map(b=>b.timestamp+4*H);
  const rows=fast.map((b,i)=>{const at=b.timestamp+15*M+lag,j=upper(ends,at-lag)-1,e=j>=skip?ema[j-skip]:null,close=j>=0?slow[j].close:null;
    const distance=e!==null&&close!==null?100*(close/e-1):null;
    return {at,rsi:rsi[i].rsi14,ema:e,close4h:close,distance,warning:warning(rsi[i].rsi14,distance),
      rsiEnd:b.timestamp+15*M,emaEnd:j>=0?ends[j]:null,lag};});
  const times=rows.map(r=>r.at);
  return {rows,at:(at:number)=>rows[upper(times,at)-1]??null};
}
export function adaptActions(actions:Action[],tape:ReturnType<typeof buildPolicyTape>,mode:string){
  const kept:Action[]=[],decisions:Row[]=[],times=tape.rows.map(r=>r.at);
  for(const s of actions){const entry=tape.at(s.at),veto=mode!=='A_baseline'&&entry?.warning===true;let exit:Row|null=null;
    if(mode==='C_entry_block_and_exit'&&!veto)for(let i=upper(times,s.at);i<tape.rows.length&&times[i]<s.expiresAt!;i++)if(tape.rows[i].warning){exit=tape.rows[i];break;}
    decisions.push({id:s.id,signalAt:s.at,entry,veto,exit});
    if(!veto)kept.push(exit?{...s,failureAt:exit.at}:s);
  }
  return {actions:kept,decisions};
}
