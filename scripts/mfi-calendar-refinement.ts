/** T02 research-only policy and descriptive ledger attribution. No trading imports. */
import assert from "assert/strict";
import type { ContextGate } from "./indicator-entry-context-policy";
const H=3_600_000,D=24*H;
export function exclusionGate(t:number,start:number,end:number):ContextGate {
  assert(Number.isSafeInteger(t)&&t>=0);
  assert([[15,19],[16,20],[17,21]].some(([a,b])=>a===start&&b===end),"Outside approved clock boundaries");
  const hour=(t%D)/H;
  return {condition:`UTC_${start}_${end}`,expectedEnd:t,sourceStart:t,sourceEnd:t,availableAt:t,
    dayStart:Math.floor(t/D)*D,value:hour,ready:true,pass:hour<start||hour>=end,reason:null,
    previousEnd:null,inputs:{excludeStartHour:start,excludeEndHour:end},evidenceKind:"calendar"};
}
export function cohortStats(xs:any[]){
  const sorted=xs.map(x=>x.net).sort((a,b)=>b-a),wins=sorted.filter(x=>x>1e-8),losses=sorted.filter(x=>x < -1e-8);
  const sum=(vs:number[])=>vs.reduce((a,b)=>a+b,0),net=sum(sorted);
  return {trades:xs.length,wins:wins.length,losses:losses.length,breakeven:xs.length-wins.length-losses.length,
    winningDollars:sum(wins),losingDollars:sum(losses),net,meanNet:xs.length?net/xs.length:null,
    top1WinningDollars:sum(wins.slice(0,1)),top3WinningDollars:sum(wins.slice(0,3)),top5WinningDollars:sum(wins.slice(0,5)),
    withoutTop1WinnerNet:net-sum(wins.slice(0,1)),withoutTop3WinnersNet:net-sum(wins.slice(0,3)),
    worstTradeNet:sorted.length?sorted.at(-1):null};
}
/** Same signal + same hold/delay must have exactly the same trade; no arbitrary nearest-time pairing. */
export function replacementAttribution(parent:any,variant:any,describe:(t:any)=>any=()=>({})){
  const p=new Map<number,any>(parent.trades.map((t:any)=>[t.signalAt,t]));
  const v=new Map<number,any>(variant.trades.map((t:any)=>[t.signalAt,t]));
  const pd=new Map<number,any>(parent.decisions.map((d:any)=>[d.at,d]));
  const vd=new Map<number,any>(variant.decisions.map((d:any)=>[d.at,d]));
  const common=parent.trades.filter((t:any)=>v.has(t.signalAt));
  common.forEach((t:any)=>{for(const f of ["entryAt","exitAt","qty","net"])assert.equal(t[f],v.get(t.signalAt)[f]);});
  const removed=parent.trades.filter((t:any)=>!v.has(t.signalAt)),added=variant.trades.filter((t:any)=>!p.has(t.signalAt));
  const rows=[...removed.map((t:any)=>({t,change:"removed",opposite:variant,dec:vd.get(t.signalAt)})),
    ...added.map((t:any)=>({t,change:"new",opposite:parent,dec:pd.get(t.signalAt)}))]
    .map(({t,change,opposite,dec}:any)=>{
      assert(dec,"Each changed trade needs its opposite-path decision");
      const blocker=[...opposite.trades,...(opposite.open?[opposite.open]:[])].find((x:any)=>x.signalAt<t.signalAt&&(x.exitAt??Infinity)>t.signalAt);
      if(dec.outcome==="occupied")assert(blocker,"Occupied changed trade needs exact inventory/pending blocker");
      return {...t,change,cohort:change==="new"?"newly_enabled":dec.outcome==="condition_false"?"removed_calendar":"removed_displaced",
        oppositeOutcome:dec.outcome,oppositeBlockingSignalAt:blocker?.signalAt??null,contribution:change==="new"?t.net:-t.net,
        entryContext:describe(t)};
    }).sort((a,b)=>a.signalAt-b.signalAt);
  const episodes:any[]=[];
  for(const row of rows){let e=episodes.at(-1);
    if(!e||row.signalAt>=e.end){e={id:episodes.length+1,start:row.signalAt,end:row.exitAt,rows:[]};episodes.push(e);}
    e.end=Math.max(e.end,row.exitAt);e.rows.push(row);row.episodeId=e.id;
  }
  const episodeRows=episodes.map(e=>({id:e.id,start:e.start,end:e.end,
    removed:cohortStats(e.rows.filter((x:any)=>x.change==="removed")),added:cohortStats(e.rows.filter((x:any)=>x.change==="new")),
    contribution:e.rows.reduce((s:number,x:any)=>s+x.contribution,0),signalAts:e.rows.map((x:any)=>x.signalAt),
    directExclusionSignals:e.rows.filter((x:any)=>x.cohort==="removed_calendar").map((x:any)=>x.signalAt)}));
  const monthly=[...new Set(rows.map(r=>new Date(r.signalAt).toISOString().slice(0,7)))].sort().map(month=>{
    const xs=rows.filter(r=>new Date(r.signalAt).toISOString().slice(0,7)===month);
    return {month,removed:cohortStats(xs.filter(r=>r.change==="removed")),added:cohortStats(xs.filter(r=>r.change==="new")),
      contribution:xs.reduce((s,r)=>s+r.contribution,0)};
  });
  const groups:any={parent:parent.trades,common,removed_calendar:rows.filter(r=>r.cohort==="removed_calendar"),
    removed_displaced:rows.filter(r=>r.cohort==="removed_displaced"),removed_all:removed,newly_enabled:added,
    new_winners:added.filter((t:any)=>t.net>1e-8),new_losers:added.filter((t:any)=>t.net < -1e-8)};
  const cohorts=Object.fromEntries(Object.entries(groups).map(([name,xs]:[string,any])=>[name,cohortStats(xs)]));
  const descriptors=Object.fromEntries(Object.entries(groups).map(([name,xs]:[string,any])=>{
    const contexts=xs.map(describe),fields=[...new Set<string>(contexts.flatMap((c:any)=>Object.keys(c)))];
    return [name,Object.fromEntries(fields.map(f=>{const vs=contexts.map((c:any)=>c[f]).filter((v:any)=>typeof v==="number"&&Number.isFinite(v)).sort((a:number,b:number)=>a-b);
      const q=(p:number)=>{if(!vs.length)return null;const i=(vs.length-1)*p,j=Math.floor(i);return vs[j]+(vs[Math.ceil(i)]-vs[j])*(i-j);};
      return [f,{n:vs.length,missing:xs.length-vs.length,p25:q(.25),median:q(.5),p75:q(.75)}];}))];
  }));
  const completedDelta=cohorts.newly_enabled.net-cohorts.removed_all.net,openDelta=(variant.open?.net??0)-(parent.open?.net??0);
  assert(Math.abs(completedDelta+openDelta-(variant.stats.net-parent.stats.net))<1e-6);
  const best=[...episodeRows].sort((a,b)=>b.contribution-a.contribution);
  return {cohorts,descriptors,rows,episodes:episodeRows,signalMonthContributions:monthly,completedDelta,openDelta,
    totalDelta:completedDelta+openDelta,withoutBestEpisodeDelta:completedDelta-(best[0]?.contribution??0)+openDelta,
    withoutBestThreeEpisodesDelta:completedDelta-best.slice(0,3).reduce((s,e)=>s+e.contribution,0)+openDelta,
    withoutTopThreeNewWinnersDelta:completedDelta-cohorts.newly_enabled.top3WinningDollars+openDelta,
    warning:"Ex-post concentration sensitivities, not alternate replays. Signal-month outcome allocation is not marked monthly PnL. Open-mark differences separate."};
}
