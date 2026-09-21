/** SRF01 descriptive predicates. No engine, order, config write or future labels. */
import assert from 'assert/strict';
export type R=Record<string,any>;
export const H=3600000,M=60000,FEE=.00055;
export function facts(inv:readonly R[],price:number,at:number,hostile:boolean){
  assert(inv.length>0&&price>0);const qty=inv.reduce((n,p)=>n+p.qty,0);
  const oldest=Math.min(...inv.map(p=>p.entryTime)),avg=inv.reduce((n,p)=>n+p.qty*p.entryPrice,0)/qty;
  assert(qty>0&&oldest<=at);const age=(at-oldest)/H,pnl=(price-avg)/avg*100;
  const ageOk=age>=12,pnlOk=pnl<=-2,trendOk=hostile;
  const missing=[...(!ageOk?['age']:[]),...(!pnlOk?['pnl']:[]),...(!trendOk?['trend']:[])];
  return{depth:inv.length,qty,oldest,avg,age,pnl,ageOk,pnlOk,trendOk,missing:missing.join('+')||'none',
    clockOnly:age>=6&&!ageOk&&pnlOk&&trendOk,trendOnly:ageOk&&pnlOk&&!trendOk};
}
export function classify(f:ReturnType<typeof facts>,healthy:boolean,spell:R|null,price:number,fullExit:boolean){
  const context=healthy&&!!spell&&price<spell.zone.lower;
  return{context,clockRaw:context&&f.clockOnly,trendRaw:context&&f.trendOnly,
    clockReach:context&&f.clockOnly&&!fullExit,trendReach:context&&f.trendOnly&&!fullExit};
}
export function inventoryNet(inv:readonly R[],price:number){return inv.reduce((n,p)=>n+p.qty*(price-p.entryPrice)-FEE*p.qty*(price+p.entryPrice),0);}
export function partialNet(before:readonly R[],after:readonly R[],price:number){
  return before.reduce((n,p)=>{const qty=p.qty-(after.find(q=>q.id===p.id)?.qty??0);assert(qty>=-1e-9);return n+qty*(price-p.entryPrice)-FEE*qty*(price+p.entryPrice);},0);
}
export function tally(rows:R[]){const complete=rows.filter(x=>x.outcome!==null),valid=rows.filter(x=>x.mark!==null&&x.outcome!==null);
  const winners=complete.filter(x=>x.outcome.pnl>0),losers=complete.filter(x=>x.outcome.pnl<0);
  return{n:rows.length,complete:complete.length,open:rows.length-complete.length,wins:winners.length,
    winning:winners.reduce((n,x)=>n+x.outcome.pnl,0),losses:losers.length,losing:losers.reduce((n,x)=>n+x.outcome.pnl,0),
    avgLoss:losers.length?losers.reduce((n,x)=>n+x.outcome.pnl,0)/losers.length:null,
    markedComplete:valid.length,baseline:valid.reduce((n,x)=>n+x.outcome.pnl,0),marks:valid.reduce((n,x)=>n+x.mark.net,0),
    delta:valid.reduce((n,x)=>n+x.mark.net-x.outcome.pnl,0),winnerDelta:valid.filter(x=>x.outcome.pnl>0).reduce((n,x)=>n+x.mark.net-x.outcome.pnl,0),
    loserDelta:valid.filter(x=>x.outcome.pnl<0).reduce((n,x)=>n+x.mark.net-x.outcome.pnl,0)};
}
