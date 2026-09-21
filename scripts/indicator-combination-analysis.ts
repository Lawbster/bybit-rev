/** C01 descriptive attribution and frozen research screens; no signal generation. */
import type { Candle } from "../src/fetch-candles";
import { MINUTE } from "./indicator-standalone-engine";
const total=(xs:any[],fn:(x:any)=>number)=>xs.reduce((s,x)=>s+fn(x),0);

/** Reconstruct equity from inventory intervals, including hypothetical close fees.
 * scale is an EX-POST exposure diagnostic, not a tradeable sizing rule.
 */
export function pathDiagnostics(minutes:readonly Candle[],row:any,trades:any[],spec:any,scale=1){
  const start=Date.parse(row.start),end=Date.parse(row.end),seed=minutes[0].timestamp,sign=row.side==="long"?1:-1;
  const ps=[...trades,...(row.open?[row.open]:[])];let cursor=0,closed=0,peak=spec.initialEquity,maxAdverse=0,maxClose=0;
  let worst:any=null,ddAt:number|null=null,peakAt=start,worstPeakAt=start,exhausted=false;
  for(let i=(start-seed)/MINUTE;i<(end-seed)/MINUTE;i++){
    const c=minutes[i];
    while(cursor<ps.length&&ps[cursor].exitAt!==undefined&&ps[cursor].exitAt<=c.timestamp){closed+=ps[cursor++].net;}
    const p=ps[cursor]?.entryAt<=c.timestamp?ps[cursor]:null;
    const equity=(price:number)=>spec.initialEquity+scale*(closed+(p?sign*p.qty*(price-p.entryPrice)-p.qty*(p.entryPrice+price)*spec.feeRatePerSide:0));
    const adversePrice=sign===1?c.low:c.high,adverse=equity(adversePrice),marked=equity(c.close),dd=(peak-adverse)/peak*100;
    if(dd>maxAdverse){maxAdverse=dd;ddAt=c.timestamp;worstPeakAt=peakAt;}
    if(marked>peak){peak=marked;peakAt=c.timestamp;}maxClose=Math.max(maxClose,(peak-marked)/peak*100);exhausted ||= adverse<=0;
    if(p){const move=sign*(adversePrice/p.entryPrice-1)*100;if(!worst||move<worst.grossMovePct)worst={signalAt:p.signalAt,entryAt:p.entryAt,at:c.timestamp,
      entryPrice:p.entryPrice,adversePrice,grossMovePct:move,grossDollars:scale*sign*p.qty*(adversePrice-p.entryPrice),closedNet:p.exitAt===undefined?null:p.net*scale};}
  }
  const wins=trades.filter(t=>t.net>0).sort((a,b)=>b.net-a.net),top5=total(wins.slice(0,5),t=>t.net)*scale,closedNet=total(trades,t=>t.net)*scale;
  return {scale,maxAdverseDrawdownPct:maxAdverse,maxCloseDrawdownPct:maxClose,ddAt,ddPeakAt:worstPeakAt,bankrupt:exhausted,
    net:row.net*scale,losingDollars:row.losingDollars*scale,winningDollars:row.winningDollars*scale,worst,
    top5WinningDollars:top5,top5PctClosedNet:closedNet>0?100*top5/closedNet:null};
}

export function attribution(parent:any[],variant:any[],decisions:any[]){
  const v=new Map(variant.map(t=>[t.signalAt,t])),p=new Map(parent.map(t=>[t.signalAt,t])),ds=new Map(decisions.map(d=>[d.at,d]));
  const removed=parent.filter(t=>!v.has(t.signalAt)),added=variant.filter(t=>!p.has(t.signalAt));
  const byReason=["condition_false","missing_context","occupied"].map(reason=>{
    const xs=removed.filter(t=>ds.get(t.signalAt)?.outcome===reason);
    return {reason,count:xs.length,winningDollars:total(xs,t=>Math.max(0,t.net)),losingDollars:total(xs,t=>Math.min(0,t.net)),signalAts:xs.map(t=>t.signalAt)};
  });
  return {completedTradesOnly:true,common:parent.length-removed.length,removedCount:removed.length,
    sacrificedWinningDollars:total(removed,t=>Math.max(0,t.net)),avoidedLosingDollars:-total(removed,t=>Math.min(0,t.net)),
    removedNet:total(removed,t=>t.net),newlyEnabledCount:added.length,newlyEnabledNet:total(added,t=>t.net),
    addedWinningDollars:total(added,t=>Math.max(0,t.net)),addedLosingDollars:total(added,t=>Math.min(0,t.net)),
    removedSignalAts:removed.map(t=>t.signalAt),newlyEnabledSignalAts:added.map(t=>t.signalAt),removedByReason:byReason};
}

export function screenCombinations(spec:any,results:any[],monthly:any[],diagnostics:any[]){
  const key=(r:any)=>`${r.window}|${r.delayMs}|${r.id}`;
  const rows=new Map(results.map(r=>[key(r),r])),ds=new Map(diagnostics.map(r=>[key(r),r]));
  const ranked=spec.combinations.map((definition:any)=>{
    const cases=results.filter(r=>r.id===definition.id),months=monthly.filter(m=>m.id===definition.id);
    const common:string[]=[],profit:string[]=[],defense:string[]=[],strict:string[]=[];
    const fail=(to:string[],name:string,yes:boolean)=>{if(yes&&!to.includes(name))to.push(name);};
    for(const r of cases){
      const p=rows.get(key({...r,id:r.parentId}))!,a=rows.get(key({...r,id:r.availabilityId}))!,d=ds.get(key(r))!;
      fail(common,"insufficient_trade_count",r.trades<(r.window==="full"?30:10));
      fail(common,"nonpositive_net",!(r.net>0));fail(common,"extra_cost_stress_nonpositive",!(r.stressNet>0));fail(common,"equity_exhausted",r.bankrupt);
      fail(common,"monthly_parent_regression_over_320",months.some(m=>m.markedDeltaParent < -320-1e-8 || m.markedDeltaAvailability < -320-1e-8));
      fail(profit,"increment_below_500_full_or_200_recent",Math.min(r.net-p.net,r.net-a.net)<(r.window==="full"?500:200)-1e-8);
      fail(profit,"drawdown_worse_than_parent",r.maxAdverseDrawdownPct>a.maxAdverseDrawdownPct+1e-8);
      fail(defense,"parent_nonpositive_retention_undefined",!(p.net>0&&a.net>0));
      fail(defense,"profit_retention_below_90pct",r.net<.9*p.net-1e-8||r.net<.9*a.net-1e-8);
      fail(defense,"losing_dollars_not_reduced",!(Math.abs(r.losingDollars)<Math.abs(p.losingDollars)-1e-8 && Math.abs(r.losingDollars)<Math.abs(a.losingDollars)-1e-8));
      fail(defense,"full_drawdown_reduction_insufficient",r.window==="full"&&(!(r.maxAdverseDrawdownPct<=.8*a.maxAdverseDrawdownPct+1e-8)||a.maxAdverseDrawdownPct-r.maxAdverseDrawdownPct<1-1e-8));
      fail(defense,"recent_drawdown_worse",r.window==="recent"&&r.maxAdverseDrawdownPct>a.maxAdverseDrawdownPct+1e-8);
      fail(defense,"selection_not_better_than_exposure_scaling",!d.scaledParent||!(r.maxAdverseDrawdownPct<d.scaledParent.maxAdverseDrawdownPct-1e-8 && Math.abs(r.losingDollars)<Math.abs(d.scaledParent.losingDollars)-1e-8));
      fail(strict,"insufficient_trade_count",r.trades<(r.window==="full"?30:10));fail(strict,"nonpositive_net",!(r.net>0));
      fail(strict,"not_above_clock",!(r.deltaVsClock>0));fail(strict,"extra_cost_stress_nonpositive",!(r.stressNet>0));fail(strict,"equity_exhausted",r.bankrupt);
    }
    fail(strict,"monthly_regression_vs_clock",months.some(m=>m.markedDeltaClock < -1e-8));
    const full=cases.filter(r=>r.window==="full"),recent=cases.filter(r=>r.window==="recent");
    return {...definition,commonFailures:common,profitFailures:[...common,...profit],defensiveFailures:[...common,...defense],strictFailures:strict,
      profitPass:!common.length&&!profit.length,defensivePass:!common.length&&!defense.length,strictPass:!strict.length,
      profitRank:Math.min(...full.flatMap(r=>[r.deltaVsParent,r.deltaVsAvailability])),defensiveRank:Math.min(...full.map(r=>r.ddReductionPp)),
      minRecentNet:Math.min(...recent.map(r=>r.net)),worstMonthlyParentDelta:Math.min(...months.map(m=>m.markedDeltaParent)),
      minRetention:Math.min(...cases.map(r=>r.retention)),deploymentCandidate:false};
  });
  const profitSort=(a:any,b:any)=>b.profitRank-a.profitRank||b.minRecentNet-a.minRecentNet||a.id.localeCompare(b.id);
  const defenseSort=(a:any,b:any)=>b.defensiveRank-a.defensiveRank||b.minRecentNet-a.minRecentNet||a.id.localeCompare(b.id);
  return {ranking:ranked.sort(profitSort),profitIds:ranked.filter((r:any)=>r.profitPass).sort(profitSort).map((r:any)=>r.id),
    defensiveIds:ranked.filter((r:any)=>r.defensivePass).sort(defenseSort).map((r:any)=>r.id),strictIds:ranked.filter((r:any)=>r.strictPass).map((r:any)=>r.id)};
}
