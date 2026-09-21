/** Future labels only. This file is never imported by a trading policy. */
import assert from 'assert/strict';
import type {Candle} from './hype-freerun-canonical-replay';
import {M,H,type R} from './entry-quality-features';
export function priceLabels(cs:Candle[],index:number,end:number):R{
  const d=cs[index],at=d.endTs,cap=d.close*.999,first=cs[index+1];
  if(!first||first.ts!==at||first.endTs>end)return {at,ready:false,cap};
  let fillAt:number|null=null,fillPrice:number|null=null,fillIndex:number|null=null;
  for(let j=index+1;j<cs.length&&cs[j].endTs<at+15*M&&cs[j+1]?.ts<end;j++){
    assert.equal(cs[j].ts,at+(j-index-1)*M);if(cs[j].close<=cap&&cs[j+1].open<=cap){fillAt=cs[j+1].ts;fillPrice=cs[j+1].open;fillIndex=j+1;break;}}
  const windows:R={};for(const minutes of [15,60,240]){if(at+minutes*M>end){windows[minutes]=null;continue;}
    let low=first.open,high=first.open;const hits:R={up05:null,up14:null,down03:null,down1:null,down2:null};
    for(let j=index+1;j<=index+minutes;j++){const c=cs[j];assert.equal(c.ts,at+(j-index-1)*M);low=Math.min(low,c.low);high=Math.max(high,c.high);
      for(const [k,mult,up] of [['up05',1.005,true],['up14',1.014,true],['down03',.997,false],['down1',.99,false],['down2',.98,false]]as const)
        if(hits[k]===null&&(up?c.high>=first.open*mult:c.low<=first.open*mult))hits[k]=c.ts;}
    windows[minutes]={minutes,end:at+minutes*M,lowPct:100*(low/first.open-1),highPct:100*(high/first.open-1),closePct:100*(cs[index+minutes].close/first.open-1),hits};
  }
  const before=fillAt??Math.min(at+15*M,end);let preHigh=first.open;
  for(let j=index+1;j<cs.length&&cs[j].ts<before&&cs[j].endTs<=end;j++)preHigh=Math.max(preHigh,cs[j].high);
  return {at,ready:true,reference:d.close,immediatePrice:first.open,cap,complete15:windows[15]!==null,
    fillAt,fillIndex,fillPrice,latencyMinutes:fillAt===null?null:(fillAt-at)/M,
    entryChangeBps:fillPrice===null?null:10000*(fillPrice/first.open-1),preEntryHighPct:100*(preHigh/first.open-1),windows};
}
