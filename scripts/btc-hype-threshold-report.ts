/** Post-run reporting only. Does not construct signals or rerun/select parameters. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import {atomicJson,verifyPins,fileHash}from "./research-workflow";
type R=Record<string,any>;
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,"utf8"));
const cash=(n:number)=>`${n<0?"-":""}$${Math.abs(n).toLocaleString("en-US",{maximumFractionDigits:0})}`;
const pct=(n:number)=>`${n.toFixed(2)}%`;
const table=(head:string[],rows:any[][])=>["| "+head.join(" | ")+" |","|"+head.map(()=>"---").join("|")+"|",...rows.map(r=>"| "+r.join(" | ")+" |")].join("\n");
function csv(file:string,rows:R[]){const keys=[...new Set(rows.flatMap(Object.keys))];const q=(x:any)=>JSON.stringify(x??"");
  fs.writeFileSync(file,keys.join(",")+"\n"+rows.map(r=>keys.map(k=>q(r[k])).join(",")).join("\n")+"\n",{flag:"wx"});}
function label(s:R){if(s.family==="clock")return `Clock ${s.side}, ${s.lookbackHours}h readiness, ${s.holdHours}h hold`;
  return `${s.side.toUpperCase()} HYPE: ${s.family==="gap"?"gap":"BTC"} ${s.polarity>0?">= +":"<= -"}${s.threshold}${s.family==="gap"?"pp":"%"} / ${s.lookbackHours}h; hold ${s.holdHours}h`;}
async function main(){
  const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const job=`backtests/research-workflow/${key}`;
  const plan=read(`${job}/plan.json`),v=read(`${job}/verification.json`),loader=read(`${job}/loader-parity.json`),state=read(`${job}/state.json`),d=plan.card.definition;
  assert(v.passed&&loader.passed&&state.status==="complete");await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
  const results:R[]=read(`${job}/output/results.json`),audit=read(`${job}/output/data-audit.json`);
  const control=(r:R)=>results.find(b=>b.spec.family==="clock"&&b.spec.side===r.spec.side&&b.spec.lookbackHours===r.spec.lookbackHours
    &&b.spec.holdHours===r.spec.holdHours&&b.window===r.window&&b.delayMs===r.delayMs)!;
  const monthly=results.flatMap(r=>r.monthly.map((m:R)=>{const b=control(r).monthly.find((x:R)=>x.month===m.month)!;
    return {name:r.name,rule:r.spec.id,window:r.window,delayMs:r.delayMs,month:m.month,...m,
      baselineNet:b.markedNet,delta:m.markedNet-b.markedNet};}));
  const cases=results.map(r=>{const b=control(r),c=v.concentration.find((x:R)=>x.name===r.name)!;
    return {name:r.name,rule:r.spec.id,description:label(r.spec),window:r.window,delayMs:r.delayMs,...r.stats,stressNet:r.stressNet,
      baselineNet:b.stats.net,delta:r.stats.net-b.stats.net,baselineDD:b.stats.maxAdverseDrawdownPct,
      ddDelta:r.stats.maxAdverseDrawdownPct-b.stats.maxAdverseDrawdownPct,averageLoss:r.stats.losses?r.stats.losingDollars/r.stats.losses:0,
      worstMonthDelta:Math.min(...monthly.filter(x=>x.name===r.name).map(x=>x.delta)),...c};});
  const ids=[...new Set(results.filter(r=>r.spec.family!=="clock").map(r=>r.spec.id))];
  const ranking=ids.map(id=>{const rows=cases.filter(r=>r.rule===id),r=results.find(r=>r.spec.id===id)!;
    const passes=(c:R)=>c.net>0&&c.delta>0&&c.stressNet>0&&c.ddDelta<=1e-6&&c.worstMonthDelta>=-1e-6
      &&c.trades>=(c.window==="older"?30:10)&&!c.bankrupt;
    return {id,description:label(r.spec),spec:r.spec,completePass:rows.every(passes),
      allPositiveNet:rows.every(x=>x.net>0),allPositiveDelta:rows.every(x=>x.delta>0),allPositiveStress:rows.every(x=>x.stressNet>0),
      noWorseDD:rows.every(x=>x.ddDelta<=1e-6),allMonthsPass:rows.every(x=>x.worstMonthDelta>=-1e-6),
      olderNet:rows.find(x=>x.window==="older"&&!x.delayMs)!.net,recentNet:rows.find(x=>x.window==="recent"&&!x.delayMs)!.net,
      rows};}).sort((a,b)=>b.recentNet-a.recentNet);
  const winners=[...new Set(["gap","btc"].flatMap(f=>["long","short"].map(side=>ranking.find(x=>x.spec.family===f&&x.spec.side===side)!.id)))];
  const top5=ranking.slice(0,5).map(r=>r.id),selected=[...new Set([...winners,...top5])];
  const dest="backtests/hype/btc-hype-threshold-bh01-2026-09-14";assert(!fs.existsSync(dest));fs.mkdirSync(dest,{recursive:true});
  csv(`${dest}/cases.csv`,cases);csv(`${dest}/monthly.csv`,monthly);
  csv(`${dest}/ranking.csv`,ranking.map(({rows,spec,...r})=>r));atomicJson(`${dest}/rankings.json`,ranking);
  const counts={definitions:216,cases:936,complete:ranking.filter(x=>x.completePass).length,
    positiveNetAllCases:ranking.filter(x=>x.allPositiveNet).length,positiveDeltaAllCases:ranking.filter(x=>x.allPositiveDelta).length,
    positiveStressAllCases:ranking.filter(x=>x.allPositiveStress).length};
  const notes:string[]=["# BTC-HYPE threshold study BH01 — September 14, 2026","",
    "## TL;DR","",
    `- Tested **216 distinct rules / 864 signal cases + 72 controls**, not 936 independent strategies. ${counts.complete}/216 pass the complete cross-period/monthly/DD screen.`,
    `- ${counts.positiveNetAllCases}/216 are profitable in both periods under both execution delays; ${counts.positiveDeltaAllCases}/216 beat their matched no-signal control in all four cases. These are retrospective grid results, not independent discoveries.`,
    "- Prior BTC research was descriptive or ladder-conditioned; this is the first located direct gap/BTC-move crossing replay. No live changes, no BTC hedge leg, no ladder-performance claim.","",
    "## What was tested","",
    "Gap = HYPE return minus BTC return over the SAME trailing 1h/4h/24h window. A +3pp gap could mean HYPE +4%, BTC +1%, or HYPE -1%, BTC -4%. It is not their dollar price difference.","",
    "Cross into gap +/-1/2/4pp or BTC +/-0.5/1/2%; independently buy AND short HYPE; hold 4h/12h/24h. Evaluate each completed 15m clock. Existing positions/pending orders consume occupancy; no queued/repeated persistent-extreme entries. No TP/SL or averaging.","",
    "**Older:** Jan20,2025-May17,2026 exclusive (482 days). **Recent:** May17-Sep14,2026 15:27 UTC (120.64 days). Nonoverlapping, but previously researched history; neither is an untouched holdout.","",
    "$10k fixed HYPE notional; $32k equity. 0.055% taker fee each side. Fixed 5bps/side additional stress. No funding. Net includes cutoff inventory less an estimated exit fee; W/L amounts include completed trades only. DD is minute-adverse mark against prior close-equity peaks. All results below are dollars, NOT uplift percentages on the live ladder.","",
    "**Baseline:** same-side, same-lookback data readiness, same holding time and execution delay; enter every eligible 15m clock while flat, with no threshold. Baseline changes with the row. This is not B17/Aggressive10, nor the old unmasked rolling-clock benchmark. Cash baseline is $0.","",
    "## Best recent result in each family/side — selected AFTER the grid","",
    table(["Rule","Recent net","Clock net","Delta","DD / clock","Trades W/L","Older net / clock"],winners.map(id=>{
      const x=ranking.find(x=>x.id===id)!,r=x.rows.find(x=>x.window==="recent"&&!x.delayMs)!,o=x.rows.find(x=>x.window==="older"&&!x.delayMs)!;
      return [x.description,cash(r.net),cash(r.baselineNet),cash(r.delta),`${pct(r.maxAdverseDrawdownPct)} / ${pct(r.baselineDD)}`,`${r.trades} (${r.wins}/${r.losses})`,`${cash(o.net)} / ${cash(o.baselineNet)}`];})),"",
    "## W/L dollars — each leader next to its own recent control","",
    table(["Rule","W/L","Winning amount","Losing amount","Average loss","Open mark","Net","DD"],winners.flatMap(id=>{
      const r=results.find(r=>r.spec.id===id&&r.window==="recent"&&!r.delayMs)!;
      return [control(r),r].map(x=>[label(x.spec),`${x.stats.wins}/${x.stats.losses}`,cash(x.stats.winningDollars),cash(x.stats.losingDollars),
        cash(x.stats.losses?x.stats.losingDollars/x.stats.losses:0),cash(x.stats.openNet),cash(x.stats.net),pct(x.stats.maxAdverseDrawdownPct)]);
    })),"",
    "## Period / delay sensitivity for selected leaders","",
    "60s delay applies to BOTH entry and timeout exit, with holding time measured from the actual entry. It is modeled execution delay, not measured historical receipt latency.","",
    table(["Rule","Window","Delay","Trades","Net / clock","Delta","DD / clock","Stress net","Worst monthly delta"],selected.flatMap(id=>ranking.find(x=>x.id===id)!.rows.map(r=>[
      id,r.window,`${r.delayMs/1000}s`,r.trades,`${cash(r.net)} / ${cash(r.baselineNet)}`,cash(r.delta),`${pct(r.maxAdverseDrawdownPct)} / ${pct(r.baselineDD)}`,cash(r.stressNet),cash(r.worstMonthDelta)]))),"",
    "## Monthly screen: top five recent-net rules","",
    "Each cell is **strategy marked net / matched clock marked net (delta)**; zero execution delay. Includes cutoff/open-inventory changes. Older and recent May are different nonoverlapping partial months. All rules/delays are in monthly.csv.",""];
  for(const window of ["recent","older"]){notes.push(`### ${window}`,"",table(["Month",...top5],
    [...new Set(monthly.filter(x=>x.window===window).map(x=>x.month))].sort().map(month=>[month,...top5.map(id=>{
      const m=monthly.find(x=>x.rule===id&&x.window===window&&!x.delayMs&&x.month===month)!;
      return `${cash(m.markedNet)} / ${cash(m.baselineNet)} (${cash(m.delta)})`;
    })])),"");}
  const broaderLeads=ranking.filter(x=>x.allPositiveNet&&x.allPositiveStress&&x.rows.every(r=>r.trades>=(r.window==="older"?30:10))).slice(0,3);
  notes.push("## Broader-period profitable leads and tested neighbours","",
    "These are the three highest recent-net rules that stay profitable under both delays in both periods, survive fixed cost stress and meet the sample minimum. This weaker label does NOT mean they beat the clock, pass all months or qualify for live use.","",
    table(["Rule","Older net / clock","Recent net / clock","Recent W/L","Recent DD / clock","Older / recent 60s net"],broaderLeads.map(x=>{
      const o=x.rows.find(r=>r.window==="older"&&!r.delayMs)!,r=x.rows.find(r=>r.window==="recent"&&!r.delayMs)!;
      return [x.description,`${cash(o.net)} / ${cash(o.baselineNet)}`,`${cash(r.net)} / ${cash(r.baselineNet)}`,`${r.wins}/${r.losses}`,
        `${pct(r.maxAdverseDrawdownPct)} / ${pct(r.baselineDD)}`,x.rows.filter(r=>r.delayMs).map(r=>cash(r.net)).join(" / ")];})),"");
  for(const lead of broaderLeads){const ns=ranking.filter(x=>x.spec.family===lead.spec.family&&x.spec.lookbackHours===lead.spec.lookbackHours
    &&x.spec.polarity===lead.spec.polarity&&x.spec.side===lead.spec.side).sort((a,b)=>a.spec.threshold-b.spec.threshold||a.spec.holdHours-b.spec.holdHours);
    notes.push(`### Neighbours: ${lead.description}`,"",table(["Threshold","Hold","Older net / clock","Recent net / clock","Recent DD","Recent 60s net"],ns.map(x=>{
      const o=x.rows.find(r=>r.window==="older"&&!r.delayMs)!,r=x.rows.find(r=>r.window==="recent"&&!r.delayMs)!;
      return [x.spec.threshold,`${x.spec.holdHours}h`,`${cash(o.net)} / ${cash(o.baselineNet)}`,`${cash(r.net)} / ${cash(r.baselineNet)}`,
        pct(r.maxAdverseDrawdownPct),cash(x.rows.find(r=>r.window==="recent"&&r.delayMs)!.net)];})),"");
  }
  notes.push("## Concentration and interpretation","",
    table(["Leader","Recent net","Net without best 5 wins","Worst trade","Older net without best 5 wins"],winners.map(id=>{
      const x=ranking.find(x=>x.id===id)!,r=x.rows.find(x=>x.window==="recent"&&!x.delayMs)!,o=x.rows.find(x=>x.window==="older"&&!x.delayMs)!;
      return [id,cash(r.net),cash(r.netWithoutBest5),cash(r.worstTrade),cash(o.netWithoutBest5)];})),"",
    "Removing best wins is a concentration diagnostic, NOT a counterfactual rerun. Rules heavily overlap, so their returns cannot be summed. The clock delta includes changes in exposure, turnover, avoided trades and replacement trades; it is not per-signal causal alpha. Shorting less can beat a losing always-short control without being profitable; absolute net and stressed net are therefore mandatory.","",
    "Some always-short controls breach zero equity (DD above 100%). The canonical engine flags bankruptcy but continues the fixed-notional arithmetic. Their subsequent net is a diagnostic benchmark, NOT a fundable account path; do not interpret the large positive delta against them as executable profits.","",
    "The largest recent net is not automatically the strongest rule. Check older profitability, 60s delay, nearby thresholds/holds, monthly costs and concentration in rankings.json. No statistical multiple-testing correction or out-of-sample validation establishes a live edge here.","",
    "## Data coverage and timing","",
    table(["Period","Lookback","Ready clocks","All clocks","Coverage"],audit.readiness.map((r:R)=>[r.window,`${r.hours}h`,r.ready,r.clocks,pct(100*r.ready/r.clocks)])),"",
    `HYPE has ${audit.closedHypeRows.toLocaleString("en-US")} closed minutes after 12 previously verified repairs. BTC has ${audit.market.rows.toLocaleString("en-US")} rows and ${audit.market.gaps.length} gaps: one 28,197-minute gap (Apr6-Apr25,2026) and ten one-minute gaps. No BTC imputation. Readiness requires every minute in lookback+1 endpoints AND the preceding decision to be ready; eligible crossing/control counts can be slightly smaller than the ready-clock table.`,"",
    "Missing BTC only suppresses new decisions. Held HYPE positions are still marked and exited; no future-return-based censoring. Older-period conclusions exclude entry opportunities in the BTC outage and are not claims of complete historical BTC coverage.","",
    "Only closes ending at/before the decision enter the signal. Threshold is evaluated before the next execution bar; its high/low/close cannot affect entry. Prefix and future-poison fixtures pass. Existing repaired data is corrected OHLC, not proof it was received on time live. Both histories have overlapping collector revisions; precedence is explicit last-row-wins.","",
    "Concrete trace: May17,2026 03:45 UTC gap1h=+1.703125pp. At04:00, HYPE1h=+2.307173%, BTC1h=+0.167749%, gap=+2.139423pp: this crosses +2pp. Inputs end at04:00 (latest minute opened03:59, anchor02:59), not the04:00 candle close. Zero-delay entry is the04:00 open $42.392; timeout May18 04:00 open $45.486. Gross $729.85469 less $11.40142 fees = $718.45327. The future exit price affects PnL only, never the entry signal. The independently verified 60s case shifts execution separately.","",
    "## Research verdict and limits","",
    `${counts.complete}/216 complete passes. The complete frozen gate requires positive net, positive clock delta, positive stressed net, no worse DD, minimum 30 older/10 recent completed trades, and no negative monthly delta in all four period/delay cases. This is a screen for further research, never automatic live permission.`,"",
    "Raw-gap rules contain HYPE's own momentum. A profitable gap rule does not prove BTC is adding information beyond HYPE ROC: that needs a matched HYPE-only control next. Likewise this tested crossing INTO extremes, not waiting for convergence, gap re-entry, beta-adjusted residuals or a two-leg pair trade. Those remain untested, not falsified.","",
    "No leverage/liquidation model, order-book sizing, funding settlement, account overlap, live arrival replay or new TP/SL optimization. In particular, neither a naked short with only a time exit nor a grid-selected winner is ready to deploy from these figures.","",
    "## Verification and artifacts","",
    `- Strict loader exactly matches canonical candles, every field: ${loader.cases.map((c:R)=>`${c.symbol} ${c.candles.toLocaleString("en-US")}`).join("; ")}. See loader-parity.json.`,
    `- ${v.cases} cases independently verified, including ${v.canonicalControlsIndependentlyVerified} unchanged canonical-engine controls; ${v.featureChecks.toLocaleString("en-US")} paired feature clocks; ${v.signalStreams} unique crossing/readiness streams.`,
    `- ${v.fills.toLocaleString("en-US")} fills, ${v.minuteMarks.toLocaleString("en-US")} minute marks, full occupancy, fees, W/L, monthly mark and adverse-DD checks. Source/live protected hashes verified before/after.`,
    "- 32 synthetic account cases plus timing, signed-threshold, interior-gap and future-poison checks. Research source dependency graph type-checks.",
    `- Accepted job: \`${job}\`. Raw signals, features, data audit, results, compact trade ledgers and independent verification are preserved.`,
    `- [All case economics](../${dest}/cases.csv), [all monthly comparisons](../${dest}/monthly.csv), [216-rule ranking](../${dest}/ranking.csv), [full ranking/sensitivity](../${dest}/rankings.json).`,
    "- [Frozen card](../research-inputs/btc-hype-threshold-2026-09-14.json), [method](../docs/research/btc-hype-threshold-bh01.md), [runner](../scripts/btc-hype-threshold-study.ts), [verifier](../scripts/btc-hype-threshold-verify.ts).","");
  const findings="research/codex-astra-btc-hype-threshold-findings-2026-09-14.md";assert(!fs.existsSync(findings));fs.writeFileSync(findings,notes.join("\n"),{flag:"wx"});
  atomicJson(`${dest}/receipt.json`,{job:key,counts,findings,verificationSha256:await fileHash(`${job}/verification.json`),loaderParitySha256:await fileHash(`${job}/loader-parity.json`),reportSourceSha256:await fileHash("scripts/btc-hype-threshold-report.ts"),
    files:await Promise.all([findings,...fs.readdirSync(dest).map(f=>`${dest}/${f}`)].map(async file=>({file,sha256:await fileHash(file)})))});
  console.log(JSON.stringify({counts,winners:winners.map(id=>{const x=ranking.find(r=>r.id===id)!;return {id,description:x.description,olderNet:x.olderNet,recentNet:x.recentNet};}),broaderLeads:broaderLeads.map(x=>x.id),top5},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
