/** RP02 report/CSV/paired charts. Labels may select illustrations, never signals. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
type R=Record<string,any>;const H=3600000,read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
const pc=(n:any)=>typeof n==='number'?n.toFixed(1)+'%':'n/a',num=(n:any)=>typeof n==='number'?n.toFixed(2):'n/a';
const usd=(n:number)=>`${n<0?'-':''}$${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`;
function csv(f:string,rs:R[]){if(!rs.length)return;const ks=[...new Set(rs.flatMap(Object.keys))],cell=(x:any)=>`"${(x==null?'':typeof x==='object'?JSON.stringify(x):String(x)).replace(/"/g,'""')}"`;
  fs.writeFileSync(f,[ks.map(cell).join(','),...rs.map(r=>ks.map(k=>cell(r[k])).join(','))].join('\n')+'\n');}
function table(ls:string[],headers:string[],rows:any[][]){ls.push('| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',...rows.map(r=>'| '+r.join(' | ')+' |'),'');}
function chart(e:R,grid:R[],outcome:R){const base=grid.find(x=>x.at===e.at)!,bars=grid.filter(x=>x.at>e.at-72*H&&x.at<=e.at+72*H);
  const points=bars.flatMap(b=>[100*(b.high/base.price-1),100*(b.low/base.price-1),...(b.btc.price===null?[]:[100*(b.btc.price/base.btc.price-1)])]),lo=Math.min(...points)-1,hi=Math.max(...points)+1;
  const x=(t:number)=>60+(t-e.at+72*H)/(144*H)*840,y=(p:number)=>255-(p-lo)/(hi-lo)*220;
  const line=(asset:string,color:string)=>{let s='',pen=false;for(const b of bars){const v=asset==='BTC'?b.btc.price:b.price;
    if(v===null){pen=false;continue;}s+=`${pen?' L':' M'}${x(b.at)},${y(100*(v/(asset==='BTC'?base.btc.price:base.price)-1))}`;pen=true;}
    return `<path d="${s}" stroke="${color}" fill="none" stroke-width="2"/>`;};
  const candles=bars.map(b=>`<line x1="${x(b.at-2*H)}" x2="${x(b.at-2*H)}" y1="${y(100*(b.high/base.price-1))}" y2="${y(100*(b.low/base.price-1))}" stroke="#9bb3ca"/>`).join('');
  return `<section><h3>${e.family}: ${new Date(e.at).toISOString()}</h3><p>Known BTC move ${pc(e.btcReturn)}; HYPE already moved ${pc(e.hypeReturn)}. AFTER signal, HYPE 24h low ${pc(outcome?.lowPct)}, high ${pc(outcome?.highPct)}, close ${pc(outcome?.closePct)}.</p><svg viewBox="0 0 960 290"><rect x="480" y="25" width="420" height="240" fill="#f1f3f7"/>${[0,1,2,3,4].map(i=>{const v=lo+i*(hi-lo)/4;return `<text x="1" y="${y(v)}" font-size="12">${v.toFixed(1)}%</text><line x1="60" x2="900" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/>`;}).join('')}${candles}${line('HYPE','#145b9b')}${line('BTC','#d57b16')}<line x1="480" x2="480" y1="25" y2="265" stroke="#222" stroke-dasharray="5 4"/><text x="60" y="285">-72h</text><text x="460" y="285">signal</text><text x="860" y="285">+72h</text></svg></section>`;
}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,p=read(`${dir}/plan.json`),d=p.card.definition,
  st=read(`${dir}/state.json`),v=read(`${dir}/verification.json`),iv=read(`${dir}/intersections-verification.json`);assert(v.passed&&iv.passed);
  await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...st.artifacts]);
  const a=read(`${out}/analysis.json`),es:R[]=read(`${out}/signals.json`),grid:R[]=read(`${out}/contexts.json`),ys:R[]=read(`${out}/outcomes.json`),byAt=new Map(ys.map(y=>[y.at,y])),
    baselines:R[]=read(`${out}/baselines.json`),intersections:R[]=read(`${out}/add-intersections.json`),data:R[]=read(`${out}/data-audit.json`);
  const dest='backtests/hype/btc-movement-atlas-rp02-2026-09-15';fs.mkdirSync(dest,{recursive:true});
  for(const name of Object.keys(a))csv(`${dest}/${name}.csv`,a[name]);csv(`${dest}/add-intersections.csv`,intersections);
  const catalogue=es.map(e=>({...e,iso:new Date(e.at).toISOString(),hypeContext:grid.find(x=>x.at===e.at),hypeOutcome:byAt.get(e.at)}));csv(`${dest}/event-catalogue.csv`,catalogue);
  const specs=a.summaries.filter((x:R)=>x.view==='full'&&x.lag===0&&x.h===24&&!x.family.startsWith('reference_'));
  const screen:R[]=specs.map((s:R)=>{const rows=a.summaries.filter((x:R)=>x.family===s.family&&['pre_hl','hl_recent'].includes(x.view)&&x.h===24),failures:string[]=[];
    for(const x of rows){if(x.complete<20)failures.push(`${x.view}/${x.lag}:n<20`);if(x.drop5Rate===null||x.matchedDrop5===null||x.drop5Rate<=x.matchedDrop5)failures.push(`${x.view}/${x.lag}:no_positive_matched_downside_lift`);}
    return {family:s.family,descriptiveConsistency:!failures.length,failures,economicQualification:'not_tested',liveEligible:false};});atomicJson(`${dest}/risk-screen.json`,screen);
  const focus=['btc_rise48h_10pct','btc_fall48h_10pct'];const chosen=es.filter(e=>focus.includes(e.family));
  const more=es.filter(e=>!chosen.some(c=>Math.abs(c.at-e.at)<72*H)&&byAt.get(e.at)?.horizons[24]);
  for(const reverse of [false,true])for(const e of [...more].sort((a,b)=>(reverse?-1:1)*(byAt.get(a.at)!.horizons[24].closePct-byAt.get(b.at)!.horizons[24].closePct)).slice(0,4))
    if(!chosen.some(x=>x.id===e.id))chosen.push(e);
  const html=`<!doctype html><meta charset="utf-8"><title>BTC triggers / HYPE responses RP02</title><style>body{font:15px system-ui;max-width:1000px;margin:25px auto;color:#222}section{border-top:1px solid #bbb;margin-top:30px}svg{width:100%}</style><h1>BTC moves; HYPE response</h1><p>Orange BTC / blue HYPE, normalized to each asset's known signal close (0%). Pale bars are HYPE four-hour high/low. All +/-10%/48h events plus outcome-selected contrasts; not representative weighting. Shaded right half is future labels, never trigger data. Outcome statistics anchor the next HYPE minute open, not this chart's last close. Blank BTC observations are not interpolated.</p>${chosen.map(e=>chart(e,grid,byAt.get(e.at)?.horizons[24])).join('')}`;
  assert(!html.includes('NaN'));fs.writeFileSync(`${dest}/charts.html`,html);csv(`${dest}/chart-events.csv`,chosen);
  const ls=['# RP02: BTC movements and HYPE responses','','## TL;DR','',
    `- ${es.length} rule-events at ${new Set(es.map(e=>e.at)).size} distinct times across 20 definitions: BTC +/-6/10% over 4/12/24/48/72h. HYPE is the outcome, unlike RP01.`,
    `- ${screen.filter(x=>x.descriptiveConsistency).length}/20 pass the prespecified descriptive severe-downside consistency screen (early/recent n>=20 and matched risk increase at both lags). This is not an economic qualification.`,
    '- Pause, price-drop-only adds and full-exit variants remain parked. No new portfolio PnL, fees, strategy or live changes.','',
    '## Scope and denominators','',`July 1, 2025 to ${d.cutoff}; pre-HL/recent split ${d.recentStart}. Published view ends ${d.publishedEnd}. These views overlap; periods were previously explored, not untouched holdouts.`,
    'Completed four-hour BTC threshold crossings only, 72h spacing per rule. Both signs are included because the requested example was BTC falling 10% in 48h. Forming bars, future extrema and HYPE outcomes cannot trigger an event.',
    'HYPE prior-return/gap/indicator columns describe what was already known. All following price outcomes begin AFTER the BTC signal, from the next HYPE minute open. High/low counts are not trades; a signal may hit both upside and downside.',
    'BTC gaps invalidate the full lookback and the preceding crossing observation. References use those same valid times, matched by calendar month and HYPE prior ATR bucket. Zero events means not observed at these sampling/coverage rules, not a zero-risk market.',''];
  table(ls,['View','BTC lookback','All grid times','Eligible','Unknown'],a.coverage.filter((x:R)=>x.lag===0).map((x:R)=>[x.view,x.hours+'h',x.total,x.eligible,x.unknown]));
  ls.push(`Raw BTC gaps: ${data[1].gaps.length}; missing minutes between archived observations: ${data[1].gaps.reduce((n:number,g:R)=>n+g.minutes,0)}. Full coverage/revision audit is in the accepted job. Repaired/corrected history is not proof of original live arrival.`, '');
  for(const view of ['full','pre_hl','hl_recent','published']){ls.push(`## ${view}: HYPE in the NEXT 24 hours`,'',
    '0s modeled source lag. Reference rows are ordinary BTC-eligible times. Matched -5/+5 rates are ordinary-reference risks standardized to the event months and HYPE ATR buckets.','');
    const rows=a.summaries.filter((x:R)=>x.view===view&&x.lag===0&&x.h===24);
    table(ls,['BTC signal / reference','n','HYPE -2%','HYPE -5%','Ref matched -5%','HYPE +5%','Ref matched +5%','Median HYPE close','+2 first / -2 first'],rows.map((x:R)=>
      [x.family,x.complete,`${x.drop2} (${pc(x.drop2Rate)})`,`${x.drop5} (${pc(x.drop5Rate)})`,pc(x.matchedDrop5),`${x.rise5} (${pc(x.rise5Rate)})`,pc(x.matchedRise5),pc(x.medianClose),`${x.upFirst}/${x.downFirst}`]));
  }
  ls.push('## Specific +/-10% in 48h: horizon and delay sensitivity','','A move during signal formation is already over by entry. These are subsequent HYPE outcomes only.','');
  table(ls,['View','Signal','Lag','Future hours','n','-5%','+5%','Median close'],a.summaries.filter((x:R)=>focus.includes(x.family)&&['full','hl_recent'].includes(x.view)).map((x:R)=>
    [x.view,x.family,x.lag/1000+'s',x.h,x.complete,`${x.drop5}/${x.complete}`,`${x.rise5}/${x.complete}`,pc(x.medianClose)]));
  ls.push('## Waiting-price diagnostics','','No automatic buy on timer expiry and no claim of saved trading losses. Later risks use a later price AND a later outcome window; missed upside matters.','');
  table(ls,['View','Signal','Wait','n','Cheaper/dearer','Mean HYPE entry change','Median','Saw +2% while waiting'],a.delays.filter((x:R)=>focus.includes(x.family)&&x.lag===0).map((x:R)=>
    [x.view,x.family,x.waitHours+'h',x.n,`${x.cheaper}/${x.dearer}`,pc(x.meanEntryChange),pc(x.medianEntryChange),x.earlyUpside2]));
  ls.push('## Individual +/-10%/48h events','','Each is a closed-bar, timestamp-reproducible BTC event, not a hindsight top. Full-window 24h outcomes shown; all other event families are in event-catalogue.csv.','');
  table(ls,['UTC signal','BTC known 48h','HYPE already moved 48h','Next24h low','Next24h high','Next24h close','First barrier'],es.filter(e=>focus.includes(e.family)).map(e=>{const y=byAt.get(e.at)?.horizons[24];return [new Date(e.at).toISOString(),pc(e.btcReturn),pc(e.hypeReturn),pc(y?.lowPct),pc(y?.highPct),pc(y?.closePct),y?.firstBarrier??'censored'];}));
  ls.push('## Monthly check: +/-10%/48h','','Risk observations, NOT monthly strategy PnL. Zero-event months appear only in reference CSVs; no outcomes to attribute.','');
  table(ls,['Signal','Month','n','-5% count','+5% count','Reference -5% rate','Median close'],a.monthly.filter((x:R)=>x.view==='full'&&x.lag===0&&focus.includes(x.family)).map((x:R)=>
    [x.family,x.month,x.complete,x.drop5,x.rise5,pc(x.reference.drop5Rate),pc(x.medianClose)]));
  ls.push('## HYPE indicator cuts and subsequent confirmation','','The nine HYPE flags and all context descriptors are in flags.csv/descriptors.csv, including null/censored denominators. No newly optimized combinations. These are conditioned historical samples, not filter earnings.','');
  table(ls,['Signal','Group','n','HYPE RSI','CRSI','ADX','Relative volume','Known HYPE return','Known BTC return'],a.descriptors.filter((x:R)=>x.view==='full'&&x.lag===0&&focus.includes(x.family)).map((x:R)=>
    [x.family,x.group,x.n,num(x.rsi),num(x.crsi),num(x.adx),num(x.rvol),pc(x.hypeReturn),pc(x.btcReturn)]));
  table(ls,['View','BTC anchor','Later HYPE confirmation','n','Next24h -5%','Same-offset reference','Already moved median'],a.confirmations.filter((x:R)=>x.lag===0&&['pre_hl','hl_recent'].includes(x.view)).map((x:R)=>
    [x.view,x.family,x.kind,x.complete,pc(x.drop5Rate),pc(x.matchedDrop5),pc(x.medianAlreadyMoved)]));
  ls.push('## Unchanged Agg10 reference (imported, not rerun variants)','','$32k independent flat start, $800 x1.35/11 rungs. 0.055% each-side replay fees, no maker bonus/funding settlement/liquidation model. Recent May17-Sep14 and published Jul2025-Aug19 overlap.','');
  table(ls,['Window','TP model','Net','Wins / losses','Win dollars','Loss dollars','Avg loss','Open mark','DD'],baselines.map(b=>{const m=b.metrics;return [b.window,b.tp,usd(m.totalPnl),`${m.profitableEpisodes}/${m.losingEpisodes}`,usd(m.grossWin),usd(m.grossLoss),usd(Math.abs(m.grossLoss)/m.losingEpisodes),usd(m.openPnl),pc(m.maxDrawdownPct)];}));
  ls.push('## Add-window overlap, not counterfactual savings','','Existing gates/exits already alter what is exposed. Count affected winning as well as losing episodes; do not assign whole episode PnL as the effect of preventing one add. No saved cascades or extra TP counts have been simulated.','');
  table(ls,['Window','Signal','Wait','Signals','Opens','First / deep8+','Winning / losing episodes touched','Empty intervals'],intersections.filter(x=>focus.includes(x.family)&&x.tp==='resting_touch').map(x=>
    [x.window,x.family,x.waitHours+'h',x.signals,x.adds,`${x.firstRungs}/${x.deepAdds}`,`${x.winsTouched}/${x.lossesTouched}`,x.emptyIntervals]));
  ls.push('## Reproducibility and limitations','',`Job: ${key}. HYPE contexts and overlapping outcome labels reproduce RP01 exactly; four unchanged baseline digests match accepted ledgers. Independent ${v.sourceMinutes.toLocaleString('en-US')} BTC source-minute checks, ${v.minuteChecks.toLocaleString('en-US')} HYPE future-minute checks, ${v.horizonChecks} horizon checks and ${iv.cases} add intersections pass.`,
    'Synthetic tests cover prefix invariance, missing source windows, gap-to-known reset, both crossing signs, spacing and cutoff. Separate checker validates counts, matches, waiting pairs, confirmations and flag cohorts. Inputs/protected files hashed before and after.',
    'Event families overlap; 72h separation does not make every horizon/sample independent. Wilson intervals and descriptive screens are not multiple-testing-adjusted significance. Small recent samples cannot support a new live rule. No condition in this atlas implies profitable entry/exit timing.',
    'RP01 was HYPE-driven, RP02 is BTC-driven. Never relabel RP01 results as BTC. No new economic rule passes or fails a net/monthly/DD test here because those portfolios were not run. The requested pause/drop-only/full-exit variants are parked.',
    '',`[Paired BTC/HYPE charts](../${dest}/charts.html) | [All events](../${dest}/event-catalogue.csv) | [All summaries](../${dest}/summaries.csv) | [Monthly](../${dest}/monthly.csv) | [Method](../docs/research/btc-movement-atlas-rp02.md)`,'');
  const report='research/codex-astra-btc-movement-atlas-findings-2026-09-15.md';fs.writeFileSync(report,ls.join('\n'));
  atomicJson(`${dest}/receipt.json`,{job:key,report,reportSha256:sha(fs.readFileSync(report)),chartsSha256:sha(fs.readFileSync(`${dest}/charts.html`)),
    chartCount:chosen.length,ruleEvents:es.length,checkerSha256:v.checkerSha256,reporterSha256:sha(fs.readFileSync(__filename)),newTradingDefinitions:0,liveChanges:0});
  console.log(JSON.stringify({report,dest,events:es.length,charts:chosen.length,screenPasses:screen.filter(x=>x.descriptiveConsistency).length}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
