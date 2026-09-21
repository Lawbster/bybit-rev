/** Human-readable P01 map. Derived only from the verified artifact bundle. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read,lines,fileHash } from "./hype-failed-recovery-study";
import { stats,type Row } from "./tp-hl-event-features";
import { flagged,bins,csv,M } from "./pressure-point-features";
const out=path.resolve(process.argv[2]??"backtests/hype/hype-pressure-point-atlas-2026-09-09-v2");
const r=(f:string)=>read(path.join(out,f)),n=(x:any,d=2)=>x==null?"unknown":Number(x).toFixed(d),usd=(x:number)=>(x===0?0:x).toLocaleString("en-US",{maximumFractionDigits:0}),
  table=(head:string[],rows:any[][])=>["| "+head.join(" | ")+" |","| "+head.map(()=>"---").join(" | ")+" |",...rows.map(a=>"| "+a.join(" | ")+" |")].join("\n"),
  rate=(x:Row)=>`${x.positive}/${x.n} (${x.rate===null?"not estimable":n(100*x.rate,1)+"%"})`;
async function main(){
  const rel=path.relative(path.resolve("backtests"),out);assert(rel&&!rel.startsWith("..")&&!path.isAbsolute(rel));
  assert(r("verification.json").passed);const ev:Row[]=r("events.json"),grid:Row[]=r("grid.json"),ps:Row[]=r("pressure.json"),ctx=new Map<number,Row>();
  await lines(path.join(out,"contexts.jsonl"),x=>ctx.set(x.at,x));
  const b:Row[]=r("baseline.json"),mb:Row[]=r("market-bin-comparisons.json"),pb:Row[]=r("pressure-bin-comparisons.json"),spec=r("manifest.json").spec;
  const text:string[]=["# P01 pressure-point tables","",`Window ${spec.from} through ${spec.cutoff}. Current B17 held constant; archived paths, not newly optimized strategies. No actual-live PnL claim.`,"",
    "## Unchanged current-config baseline","",
    table(["Model","W / L","Winning $","Losing $","Realized $","Open mark $","Net incl open $","Max DD"],b.map(x=>[x.model.replace("hl_extended-",""),`${x.metrics.profitableEpisodes} / ${x.metrics.losingEpisodes}`,usd(x.metrics.grossWin),usd(x.metrics.grossLoss),usd(x.metrics.realized),usd(x.metrics.openPnl),usd(x.metrics.totalPnl),n(x.metrics.maxDrawdownPct)+"%"])),"",
    "Fees at0.055% per side in these replay controls, $32k starting equity. Not a full maker-fill/funding/liquidation simulation. Short overlay excluded.","",
    "## Baseline market risk and fixed feature bins","",
    "Risk means a future wick low relative to the price at the sampled completed4h boundary, not a realized trade loss. Windows overlap. Unknown features have their own denominator.",""];
  const selected=["hl_takerRatio15_le_0.85","hl_takerRatio60_le_0.9","hl_assetNativeOiChange240Pct_gt_0","hl_bookMeanImbalance15_lt_-0.05",
    "m240_rsi_ge_70","m15_crsi_ge_95","m240_adx_ge_25","m60_rvolSameTime20d_ge_1.5","m15_mfi14_ge_80","sr_resistanceDistancePct_le_1"];
  for(const label of ["drop2in12","drop5in12"]){text.push(`### ${label}`,"",table(["Bin","Known baseline risk","Flagged risk","Unflagged risk","Unknown N"],selected.map(id=>{const x=mb.find(x=>x.bin===id&&x.group==="all"&&x.label===label)!;return[id,rate(x.known),rate(x.flagged),rate(x.unflagged),x.unknown.n];})),"");}
  text.push("## Early/late and monthly checks for top-five severe-drop associations","","Top5 ranked by flagged5%/12h risk with>=25 flagged windows and>=400 known windows. Exploratory selection among109 bins, not significance or promotion. Each cell compares flagged risk with same-period baseline.","");
  const top=mb.filter(x=>x.group==="all"&&x.label==="drop5in12"&&x.flagged.n>=25&&x.known.n>=400).sort((a,b)=>b.flagged.rate-a.flagged.rate).slice(0,5);
  for(const x of top){text.push(`### ${x.bin}`,"",table(["Period","Known baseline","Flagged","Unflagged"],mb.filter(y=>y.bin===x.bin&&y.label===x.label&&y.group!=="all").map(y=>[y.group,rate(y.known),rate(y.flagged),rate(y.unflagged)])),"");}
  text.push("## Market-drop trajectory:64 mechanically separated rolling12h -3% crossings","","Medians across events, not an executable entry/exit rule. A timestamp15m before a threshold crossing can already be inside a substantial decline. Higher-timeframe readings are last completed bars and can be hours old; see indicatorSources.","");
  const features=["m15_rsi","m60_rsi","m15_crsi","m60_adx","m60_diSpread","m60_dayVwapDistancePct","m60_rvolSameTime20d","hl_takerRatio15","hl_takerRatio60","hl_assetNativeOiChange240Pct"];
  const drops=ev.filter(x=>x.cohort==="market_drop");
  text.push(table(["Feature","Ordinary4h baseline median",...spec.relativeMinutes.map((m:number)=>`${m}m`)],features.map(f=>[f,n(stats(grid.map(x=>ctx.get(x.at)!.values[f])).median),...spec.relativeMinutes.map((m:number)=>{const s=stats(drops.map(e=>ctx.get(e.at+m*M)!.values[f]));return`${n(s.median)} (n=${s.n})`;})])),"");
  text.push("## Underwater ladder controls: lifetime outcome vs remaining downside/recovery","","Checkpoint: same surviving depth>=9 episode,60m after first gross inventory loss<=-3%. A previously losing episode may recover from this checkpoint. Lifetime loss is NOT avoidable loss. Neither remaining downside minus recovery nor this fixed-path comparison is a new policy PnL.","");
  const ids=["m30_mfi14_le_20","hl_bookImbalance05Change15_lt_-0.15","hl_takerRatio15_le_0.85","m60_diSpread_lt_0","m60_dayVwapDistancePct_lt_0"];
  for(const model of b.map(x=>x.model)){
    const base=pb.find(x=>x.model===model&&x.landmarkMinutes===60)!.baseline;
    const rows=[{label:"BASELINE",v:base},...ids.map(id=>({label:id,v:pb.find(x=>x.model===model&&x.landmarkMinutes===60&&x.bin===id)!.flagged}))];
    text.push(`### ${model}`,"",table(["Subset","Closed / open","W / L","Winning $","Losing $","Further downside $","Subsequent recovery $"],rows.map(({label,v})=>[label,`${v.closed} / ${v.censored}`,`${v.wins} / ${v.losses}`,usd(v.winningDollars),usd(v.losingDollars),usd(v.remainingDownside),usd(v.remainingRecovery)])),"");
  }
  const details:Row[]=[],monthly:Row[]=[];
  for(const id of ids)for(const model of b.map(x=>x.model))for(const lag of [0,60000]){
    const bin=bins().find(x=>x.id===id)!;const xs=ps.filter(x=>x.model===model&&x.landmarkMinutes===60);
    const values=(x:Row)=>{const c=ctx.get(x.at)!;return lag?{...c.delayedIndicatorValues,...Object.fromEntries(Object.entries(c.hlDelayed.features).map(([k,v])=>[`hl_${k}`,v]))}:c.values;};
    for(const x of xs){const flag=flagged(values(x),bin);details.push({bin:id,model,lagMs:lag,id:x.id,at:x.at,iso:new Date(x.at).toISOString(),flag,value:values(x)[bin.feature]??null,
      episodePnl:x.outcome?.pnl??null,close:x.outcome?.close??null,remainingValueChange:x.remainingValueChange});}
    for(const month of [...new Set(xs.map(x=>new Date(x.at).toISOString().slice(0,7)))]){
      const group=xs.filter(x=>new Date(x.at).toISOString().startsWith(month)),flaggedRows=group.filter(x=>flagged(values(x),bin)===true),done=flaggedRows.filter(x=>x.outcome);
      monthly.push({bin:id,model,lagMs:lag,month,baselineN:group.length,flaggedN:flaggedRows.length,knownN:group.filter(x=>flagged(values(x),bin)!==null).length,
        wins:done.filter(x=>x.outcome.pnl>0).length,losses:done.filter(x=>x.outcome.pnl<0).length,
        remainingDownside:-done.reduce((s,x)=>s+Math.min(0,x.remainingValueChange),0),remainingRecovery:done.reduce((s,x)=>s+Math.max(0,x.remainingValueChange),0)});
    }
  }
  text.push("## MFI30m<=20 pressure-point identities and delay checks","",table(["Model","Observation UTC","MFI","Final episode $","Remaining change $"],details.filter(x=>x.bin==="m30_mfi14_le_20"&&x.lagMs===0&&x.flag).map(x=>[x.model.replace("hl_extended-",""),x.iso,n(x.value),n(x.episodePnl),n(x.remainingValueChange)])),"",
    table(["Model","Additional lag","Month","Baseline N","Known N","Flagged W/L","Downside $","Recovery $"],monthly.filter(x=>x.bin==="m30_mfi14_le_20").map(x=>[x.model.replace("hl_extended-",""),x.lagMs,x.month,x.baselineN,x.knownN,`${x.wins}/${x.losses}`,usd(x.remainingDownside),usd(x.remainingRecovery)])),"");
  const guide:string[]=["# P01 event-by-event pressure map","","These are modeled current-config decisions, mechanical market drawdown crossings, or the user's hindsight top labels—not one pooled trade set. At0 means the event's decision/threshold time. Negative offsets use only then-closed sources. Full252-field snapshots are in snapshots.csv; references in contexts.jsonl. All UTC.",""];
  const cols=["m15_rsi","m15_crsi","m60_rsi","m60_adx","m60_diSpread","m60_dayVwapDistancePct","m60_rvol20","m30_mfi14","hl_takerRatio15","hl_takerRatio60","hl_assetNativeOiChange240Pct"];
  for(const cohort of ["modeled_forced","human_top","market_drop"]){guide.push(`## ${cohort}`,"");
    for(const e of ev.filter(x=>x.cohort===cohort).sort((a,b)=>a.at-b.at)){
      guide.push(`### ${new Date(e.at).toISOString()} — ${e.id}`,"",e.outcome?`Reason ${e.outcome.reason}; completed episode PnL $${n(e.outcome.pnl)}; depth ${e.depth}. This is a modeled episode, not an actual account close.`:
        e.label??`First rolling12h drawdown crossing ${n(e.drawdownPct)}%; future12h low ${n(e.low12hPct)}% (label only).`,"",
        table(["Offset min",...cols],spec.relativeMinutes.map((m:number)=>[m,...cols.map(k=>n(ctx.get(e.at+m*M)!.values[k]))])),"");
    }
  }
  const outputs:Record<string,string>={"tables.md":text.join("\n"),"event-guide.md":guide.join("\n"),"selected-pressure-details.csv":csv(details),
    "selected-pressure-monthly.csv":csv(monthly),"selected-pressure-details.json":JSON.stringify(details,null,2)+"\n","selected-pressure-monthly.json":JSON.stringify(monthly,null,2)+"\n"};
  // Only these derived report files are regenerated; validated source artifacts are immutable.
  for(const [f,s]of Object.entries(outputs))fs.writeFileSync(path.join(out,f),s);
  fs.writeFileSync(path.join(out,"report-manifest.json"),JSON.stringify({sourceSha256:await fileHash("scripts/pressure-point-report.ts"),outputs:await Promise.all(Object.keys(outputs).map(async file=>({file,sha256:await fileHash(path.join(out,file))})))},null,2)+"\n");
  console.log("P01 readable tables, all112 event timelines and selected pressure details written.");
}main().catch(e=>{console.error(e);process.exitCode=1;});
