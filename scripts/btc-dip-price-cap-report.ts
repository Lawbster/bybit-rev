/** BH02 post-run economics/occupancy attribution; no new signals or strategies. */
import fs from "fs";
import assert from "assert/strict";
import {read}from "./btc-hype-threshold-study";
import {near}from "./btc-hype-threshold-verify";
import {verifyPins,atomicJson,fileHash}from "./research-workflow";
type R=Record<string,any>;
const money=(x:number)=>`${x<0?"-":""}$${Math.abs(x).toLocaleString("en-US",{maximumFractionDigits:0})}`;
const pct=(x:number)=>`${x.toFixed(2)}%`;
const table=(h:string[],rows:any[][])=>["| "+h.join(" | ")+" |","|"+h.map(()=>"---").join("|")+"|",...rows.map(r=>"| "+r.join(" | ")+" |")].join("\n");
const sum=(ts:R[])=>ts.reduce((s,t)=>s+t.net,0);
function positions(r:R){return [...r.trades,...(r.open?[{...r.open,exitPrice:r.open.markedPrice,open:true}]:[])];}
export function attribution(r:R,b:R,fee:number){
  const actual=positions(r),baseline=positions(b),bm=new Map(baseline.map(t=>[t.signalAt,t])),rm=new Map(actual.map(t=>[t.signalAt,t]));
  const match=actual.filter(t=>bm.has(t.signalAt)),removed=baseline.filter(t=>!rm.has(t.signalAt)),added=actual.filter(t=>!bm.has(t.signalAt));
  const netAt=(entry:number,exit:number)=>10000*(exit/entry-1)-10000*fee*(1+exit/entry);
  const rows=match.map(t=>{const old=bm.get(t.signalAt)!,sameExit=netAt(t.entryPrice,old.exitPrice);return {
    signalAt:t.signalAt,kind:"matched",baselineNet:old.net,variantNet:t.net,delta:t.net-old.net,
    baselineEntry:old.entryPrice,variantEntry:t.entryPrice,entryPriceContribution:sameExit-old.net,exitTimingContribution:t.net-sameExit};});
  const before=sum(match.map(t=>bm.get(t.signalAt)!)),after=sum(match),matchedDelta=after-before,removedNet=sum(removed),replacementNet=sum(added);
  near(matchedDelta-removedNet+replacementNet,r.stats.net-b.stats.net,"complete matched/removed/replacement attribution");
  near(rows.reduce((s,t)=>s+t.entryPriceContribution+t.exitTimingContribution,0),matchedDelta,"price versus timing attribution");
  const absent=removed.map(t=>{const i=r.intents.find((i:R)=>i.signalAt===t.signalAt);return {...t,why:i?.phase??"occupied"};});
  // Post-hoc PRICE-ONLY sensitivity: same fills/exits, credit the observed opening
  // print. Not a new strategy/replay, and not a quote/queue-supported earnings claim.
  let observedOpenNet=0;
  for(const t of actual){const i=r.intents.find((i:R)=>i.signalAt===t.signalAt);assert(i&&i.observedOpen>0);
    observedOpenNet+=netAt(i.observedOpen,t.exitPrice);}
  return {name:r.name,window:r.window,delayMs:r.delayMs,model:r.model,expiryMinutes:r.expiryMinutes,
    matched:match.length,matchedDelta,entryPriceContribution:rows.reduce((s,t)=>s+t.entryPriceContribution,0),
    exitTimingContribution:rows.reduce((s,t)=>s+t.exitTimingContribution,0),removed:removed.length,
    removedWinningTrades:removed.filter(t=>t.net>0).length,missedWinningDollars:sum(removed.filter(t=>t.net>0)),
    removedLosingTrades:removed.filter(t=>t.net<0).length,avoidedLosingDollars:-sum(removed.filter(t=>t.net<0)),removedNet,
    removedExpired:absent.filter(t=>t.why==="expired").length,removedOccupied:absent.filter(t=>t.why==="occupied").length,
    removedCutoff:absent.filter(t=>t.why==="cutoff").length,replacementTrades:added.length,replacementNet,
    delta:r.stats.net-b.stats.net,observedOpenNet,uncreditedPriceImprovement:observedOpenNet-r.stats.net,
    rows:[...rows,...absent.map(t=>({signalAt:t.signalAt,kind:`removed_${t.why}`,baselineNet:t.net,variantNet:0,delta:-t.net})),
      ...added.map(t=>({signalAt:t.signalAt,kind:"replacement",baselineNet:0,variantNet:t.net,delta:t.net}))]};
}
function csv(file:string,rows:R[]){const keys=[...new Set(rows.flatMap(Object.keys))],quote=(x:any)=>`"${String(x??"").replace(/"/g,'""')}"`;
  fs.writeFileSync(file,keys.map(quote).join(",")+"\n"+rows.map(r=>keys.map(k=>quote(r[k])).join(",")).join("\n")+"\n",{flag:"wx"});}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const job=`backtests/research-workflow/${key}`,out=`${job}/output`;
  const plan=read(`${job}/plan.json`),state=read(`${job}/state.json`),v=read(`${job}/verification.json`),d=plan.card.definition;
  assert.equal(state.status,"complete");assert(v.passed);await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
  const rows:R[]=read(`${out}/results.json`),full=new Map(rows.map(r=>[r.name,read(`${out}/${r.name}.json`)]));
  const base=(r:R)=>rows.find(b=>b.window===r.window&&b.delayMs===r.delayMs&&b.controlRule===d.parentRule)!;
  const clock=(r:R)=>rows.find(b=>b.window===r.window&&b.delayMs===r.delayMs&&b.controlRule===d.clockRule)!;
  const variants=rows.filter(r=>!r.controlRule);
  const attributions=variants.map(r=>attribution(full.get(r.name)!,full.get(base(r).name)!,d.feeRate));
  const monthly=rows.flatMap(r=>r.monthly.map((m:R)=>{const b=base(r).monthly.find((x:R)=>x.month===m.month)!;return {
    name:r.name,window:r.window,delayMs:r.delayMs,model:r.model,expiryMinutes:r.expiryMinutes,month:m.month,...m,
    baselineNet:b.markedNet,delta:m.markedNet-b.markedNet};}));
  const cases=rows.map(r=>{const b=base(r),c=clock(r);return {name:r.name,window:r.window,delayMs:r.delayMs,model:r.model,expiryMinutes:r.expiryMinutes,
    controlRule:r.controlRule,...r.stats,...r.entryStats,meanLoss:r.stats.losses?r.stats.losingDollars/r.stats.losses:0,
    net:r.stats.net,stressNet:r.stressNet,baselineNet:b.stats.net,delta:r.stats.net-b.stats.net,baselineDD:b.stats.maxAdverseDrawdownPct,
    ddDelta:r.stats.maxAdverseDrawdownPct-b.stats.maxAdverseDrawdownPct,clockNet:c.stats.net,
    worstMonthDelta:Math.min(...monthly.filter(x=>x.name===r.name).map(x=>x.delta)),
    netWithoutBest5:r.stats.net-full.get(r.name)!.trades.map((t:R)=>t.net).filter((x:number)=>x>0).sort((a:number,b:number)=>b-a).slice(0,5).reduce((a:number,b:number)=>a+b,0)};});
  const ranking=d.expiryMinutes.map((ttl:number)=>{const rs=cases.filter(r=>r.expiryMinutes===ttl),pass=(r:R)=>
    r.delta>0&&r.ddDelta<=1e-6&&r.worstMonthDelta>=-250-1e-6&&r.net>0&&r.stressNet>0&&!r.bankrupt&&r.trades>=(r.window==="older"?30:10);
    const r=rs.find(r=>r.window==="recent"&&r.delayMs===60000&&r.model==="open_cap")!;
    return {expiryMinutes:ttl,completePass:rs.every(pass),casesPassing:rs.filter(pass).length,strictZeroMonthPass:rs.every(r=>pass(r)&&r.worstMonthDelta>=-1e-6),
      recentDelayedNet:r.net,recentDelayedDelta:r.delta,rows:rs};}).sort((a:R,b:R)=>b.recentDelayedNet-a.recentDelayedNet);
  const dest="backtests/hype/btc-dip-price-cap-bh02-2026-09-14";assert(!fs.existsSync(dest));fs.mkdirSync(dest,{recursive:true});
  csv(`${dest}/cases.csv`,cases);csv(`${dest}/monthly.csv`,monthly);csv(`${dest}/attribution.csv`,attributions.map(({rows,...r})=>r));
  csv(`${dest}/signal-attribution.csv`,attributions.flatMap(a=>a.rows.map(r=>({name:a.name,...r}))));atomicJson(`${dest}/ranking.json`,ranking);
  const get=(w:string,lag:number,ttl:number|null,model="open_cap")=>rows.find(r=>r.window===w&&r.delayMs===lag&&(ttl===null?r.controlRule===d.parentRule:r.expiryMinutes===ttl&&r.model===model))!;
  const financial=(r:R)=>[r.expiryMinutes===null?"Original BTC-dip market entry":`${r.expiryMinutes}m cap`,`${r.stats.wins}/${r.stats.losses}`,
    money(r.stats.winningDollars),money(r.stats.losingDollars),money(r.stats.losses?r.stats.losingDollars/r.stats.losses:0),money(r.stats.net),
    money(r.stats.net-base(r).stats.net),pct(r.stats.maxAdverseDrawdownPct),r.entryStats.expired];
  const headings=["Entry","W/L","Winning amount","Losing amount","Average loss","Net","Delta","DD","Expired signals"];
  const notes:string[]=["# BTC-dip price-cap / expiry study BH02 — September 14, 2026","","## TL;DR","",
    `- **4 expiry definitions, 40 runs, 8 exact archived controls; ${ranking.filter((x:R)=>x.completePass).length}/4 complete passes.** No ladder/live changes.`,
    "- Under the frozen cap-price charge, every delayed or strict capped variant makes less recent net than the same-delay original; lenient zero-delay cases are identical. 15m is the least costly recent expiry across both delayed fill proxies, not a verified sweet spot across regimes.",
    "- Fill pricing matters: charging the cap with no price improvement is deliberately harsh. A separately labelled, post-hoc observed-opening-print valuation changes the economics; it does NOT establish executable prices or overturn the frozen screen.","",
    "## Scope / definitions","",
    "Unchanged BTC signal: trailing1h return crosses from >-0.5% to <=-0.5% on a completed UTC15m boundary. Buy $10k HYPE, hold12h FROM ACTUAL FILL. $32k account, 0.055% per side, no funding/TP/SL/maker-fee credit.","",
    "Older: Jan20,2025-May17,2026 exclusive. Recent: May17-Sep14,2026 15:27 UTC exclusive. Same BH01 corrected data/cutoff and known BTC gaps. Neither period is an untouched holdout.","",
    "Anchor: HYPE close of the1m candle ending at the signal, frozen. Expire after5/15/30/60min measured from the signal, never chase. Pending orders occupy the account. New signals while pending/held are discarded; fresh signals at expiry may qualify independently. Entry and timeout execution both have0/60s delays.","",
    "`open_cap`: require a minute open <=cap, charge cap. `open_through5`: require open <=cap minus5bps, still charge cap. No intrabar wick fills. Full-notional fills are unsupported liquidity assumptions; equal-price opens are opportunities, not queue evidence. Stricter timing is not a guaranteed PnL lower bound because occupancy changes.","",
    "All main tables use frozen cap-price accounting, including open inventory less an estimated exit fee. Average loss and W/L dollars refer to completed trades only. Baseline is ORIGINAL BTC-dip MARKET ENTRY, not the ladder or no-signal clock.","",
    "## Relevant comparison: one-minute execution delay","",
    "This is the sensitivity that weakened BH01. Both baseline and variants incur the same entry/exit delay.","",
    "### Recent — minute-open cap proxy","",table(headings,[null,...d.expiryMinutes].map(ttl=>financial(get("recent",60000,ttl)))),"",
    "### Recent — stricter5bps fill support, still paying the cap","",table(headings,[null,...d.expiryMinutes].map(ttl=>financial(get("recent",60000,ttl,"open_through5")))),"",
    "### Older — minute-open cap proxy","",table(headings,[null,...d.expiryMinutes].map(ttl=>financial(get("older",60000,ttl)))),"",
    "### Older — stricter5bps fill support","",table(headings,[null,...d.expiryMinutes].map(ttl=>financial(get("older",60000,ttl,"open_through5")))),"",
    "## Zero-delay warning and all sensitivities","",
    "All accepted zero-delay parent entries have next open exactly equal to the frozen previous close in this dataset. Consequently the lenient zero-delay caps fill immediately and reproduce the baseline exactly for all four expiries. This is NOT proof a real limit order can get a full fill at that price. The delayed/strict models are essential.","",
    table(["Period","Delay","Model","Expiry","Net / parent","Delta","DD / parent","Stress net","Worst monthly delta"],cases.filter(r=>!r.controlRule).map(r=>[
      r.window,`${r.delayMs/1000}s`,r.model,`${r.expiryMinutes}m`,`${money(r.net)} / ${money(r.baselineNet)}`,money(r.delta),`${pct(r.maxAdverseDrawdownPct)} / ${pct(r.baselineDD)}`,money(r.stressNet),money(r.worstMonthDelta)])),"",
    "## Actual occupancy attribution — recent,60s delay","",
    "Matched by original signal time, NOT trade number. Removed baseline positions include signals expired or blocked by shifted occupancy. Replacement trades are real additional simulated positions that the baseline could not take. These counts are not independent opportunities.","",
    table(["Model","Expiry","Matched n / delta","Removed n","Missed winning dollars","Avoided losing dollars","Replacement n / net","Total delta"],attributions.filter(a=>a.window==="recent"&&a.delayMs===60000).map(a=>[
      a.model,`${a.expiryMinutes}m`,`${a.matched} / ${money(a.matchedDelta)}`,a.removed,money(a.missedWinningDollars),money(a.avoidedLosingDollars),`${a.replacementTrades} / ${money(a.replacementNet)}`,money(a.delta)])),"",
    "Identity checked for every variant: matched delta - removed baseline net + replacement net = total net delta. Full per-signal attribution and matched entry-price-versus-exit-timing contribution are saved; hypothetical attribution is not an independently tradable PnL stream.","",
    "## Monthly parent comparisons","",
    "Each cell is strategy marked net (delta versus same-delay original BTC-dip entry). The baseline column is explicit. Open inventory is included. All cases, including unchanged zero-delay/lenient rows, are in monthly.csv.",""];
  for(const window of ["recent","older"])for(const model of ["open_cap","open_through5"]){
    const baseline=get(window,60000,null);notes.push(`### ${window},60s,${model}`,"",table(["Month","Original",...d.expiryMinutes.map((x:number)=>`${x}m`)],baseline.monthly.map((m:R)=>[
      m.month,money(m.markedNet),...d.expiryMinutes.map((ttl:number)=>{const row=monthly.find(x=>x.name===get(window,60000,ttl,model).name&&x.month===m.month)!;
        return `${money(row.markedNet)} (${money(row.delta)})`;})])),"");}
  notes.push("## Price-only sensitivity — NOT the frozen replay result","",
    "Computed AFTER the run to explain the cap-price penalty. Keep exactly the same accepted fills, sizes specified as$10k at the alternative entry price, exit times and exits; suppose each entry receives its observed minute-opening print instead of paying the cap. This is a more favorable hypothetical price, not a measured ask, order fill or additional strategy. No independent DD/qualification is claimed for this valuation. Real results can lie outside these two valuations if fills differ.","",
    table(["Period","Model","Expiry","Frozen cap-price net","Hypothetical opening-print net","Original market net"],attributions.filter(a=>a.delayMs===60000).map(a=>[
      a.window,a.model,`${a.expiryMinutes}m`,money(get(a.window,60000,a.expiryMinutes,a.model).stats.net),money(a.observedOpenNet),money(get(a.window,60000,null).stats.net)])),"",
    "This sensitivity is not grounds to declare the idea dead, nor to choose its favorable side as earnings. Realistic executable ask/partial-fill support is the unresolved issue; candle-touch or opening-print data cannot certify it. No extra expiry/price-offset/signal family was searched after the frozen run.","",
    "## Screen and interpretation","",
    `${ranking.filter((x:R)=>x.completePass).length}/4 expiry rules pass all period/delay/fill cases: higher net, no worse adverse DD, positive stressed net, minimum30 older/10 recent trades and every monthly delta >=-$250. Stricter zero-month pass count: ${ranking.filter((x:R)=>x.strictZeroMonthPass).length}. Scope of failure is the frozen capped-entry model, not all execution-aware trading or ladder variants.`,"",
    "Zero-delay equality is not a defect, even though the strict-positive-delta screen rejects it mechanically. Allowing equality in those cases still does not rescue any expiry: recent delayed/strict net and monthly costs remain the substantive failures.","",
    "Longer waiting is not monotonically better. It changes which signals expire, how long capital is occupied, and when the12h exit occurs. Even same-signal entries often have little net improvement after exit timing; fewer fills alone is not evidence of better selection. Some improvements versus the weak no-signal clock were already present in the original BTC-dip signal.","",
    table(["Period","Delay","No-signal clock net / DD","Original BTC-dip net / DD"],d.windows.flatMap((w:R)=>d.executionDelaysMs.map((lag:number)=>{
      const b=get(w.id,lag,null),c=clock(b);return [w.id,`${lag/1000}s`,`${money(c.stats.net)} / ${pct(c.stats.maxAdverseDrawdownPct)}`,`${money(b.stats.net)} / ${pct(b.stats.maxAdverseDrawdownPct)}`];}))),"",
    "No inference that the current ladder should adopt or reject this execution idea: no ladder orders, blocks, sizing, fees or config were altered. It remains a separate possible future research question.","",
    "## Verification / reproduction","",
    "Concrete causal trace, strict15m/60s: May17,2026 23:00 UTC signal freezes the22:59 candle close at$46.109; order activates23:01, expires23:15 exclusive. Earlier wick touches do not fill it. First qualifying minute open is23:03 at$46.004, below the frozen strict-support level$46.0859455. The primary ledger charges$46.109 and starts its12h hold at23:03; timeout execution is May18 11:04. An earlier22:30 signal with cap$46.436 expired22:45 without a chase. Neither later lows nor the timeout price selects these entries.","",
    `- Eight parent/clock controls match BH01 stats, every monthly row, open inventory and every completed trade EXACTLY before variants run.`,
    `- ${v.cases} independently verified cases; ${v.fills.toLocaleString("en-US")} fills; ${v.minuteMarks.toLocaleString("en-US")} minute marks; ${v.intents.toLocaleString("en-US")} intents. All frozen anchors matched the actual last closed HYPE minute.`,
    "- 99 fixture accounts: canonical market parity, exclusive expiry, pre-arrival rejection, ignored wicks, fixed cap, no signal queue, fill-relative timeout, month/cutoff handling and future poison. Typecheck passes. No source or protected live-file hash changes.",
    `- Job: \`${job}\`. [Frozen card](../research-inputs/btc-dip-price-cap-2026-09-14.json), [method](../docs/research/btc-dip-price-cap-bh02.md).`,
    `- [All cases](../${dest}/cases.csv), [all months](../${dest}/monthly.csv), [aggregate attribution](../${dest}/attribution.csv), [per-signal attribution](../${dest}/signal-attribution.csv), [ranking](../${dest}/ranking.json).`,"");
  const findings="research/codex-astra-btc-dip-price-cap-findings-2026-09-14.md";assert(!fs.existsSync(findings));fs.writeFileSync(findings,notes.join("\n"),{flag:"wx"});
  atomicJson(`${dest}/receipt.json`,{job:key,completePasses:ranking.filter((x:R)=>x.completePass).length,verificationSha256:await fileHash(`${job}/verification.json`),
    reportSourceSha256:await fileHash("scripts/btc-dip-price-cap-report.ts"),
    artifacts:await Promise.all([findings,...fs.readdirSync(dest).map(f=>`${dest}/${f}`)].map(async file=>({file,sha256:await fileHash(file)})))});
  console.log(JSON.stringify({passes:ranking.filter((x:R)=>x.completePass).length,ranking:ranking.map(({rows,...r}:R)=>r),recent:cases.filter(r=>r.window==="recent"&&r.delayMs===60000)},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
