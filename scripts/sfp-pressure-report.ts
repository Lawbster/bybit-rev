/** SF04 saved-evidence report and source/accounting checks. No economic rerun. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { ROOT,loadTape } from './setup-scan-core';
import { fileHash,atomicJson,sha } from './research-workflow';
import { distribution,M,H } from './sfp-pressure-features';
import { type Row } from './tp-hl-event-features';
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'));
const fmt=(x:any,n=2)=>x==null?'NA':Number(x).toFixed(n);
const usd=(x:number)=>`${x<0?'-':''}$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
const label=(g:string)=>g==='win'?'Wins':'Stops';
const primaryFields:Array<[string,string]>=[['m15_rsi','RSI14 15m'],['m60_rsi','RSI14 1h'],['m240_rsi','RSI14 4h'],
  ['m15_crsi','CRSI 15m'],['m60_crsi','CRSI 1h'],['m240_crsi','CRSI 4h'],['m60_dayVwapDistancePct','1h close vs day VWAP %'],
  ['m60_weekVwapDistancePct','1h close vs week VWAP %'],['m60_ema50DistancePct','1h close vs EMA50 %'],['m60_ema200DistancePct','1h close vs EMA200 %'],
  ['m240_ema200DistancePct','4h close vs EMA200 %'],['m240_ema50SlopePct','4h EMA50 one-bar slope %'],['m60_adx','ADX14 1h'],['m60_diSpread','DI+ minus DI- 1h'],
  ['m60_atrPct','ATR14 1h %'],['m60_rvol20','RVOL20 1h'],['m60_mfi14','MFI14 1h'],['m60_cmf20','CMF20 1h'],
  ['hl_takerRatio15','HL buy/sell notional 15m'],['hl_takerRatio60','HL buy/sell notional 1h'],['hl_takerRatio240','HL buy/sell notional 4h'],
  ['hl_buyShareAcceleration','HL buy-share change: last5 vs prior10m'],['hl_largeNetShare15','HL large-trade net / turnover15m'],
  ['hl_bookImbalance05','HL book imbalance 0.5%'],['hl_bookImbalance05Change15','HL book imbalance change15m'],
  ['hl_bookBid05Change15Pct','HL bid depth change15m %'],['hl_assetNativeOiChange60Pct','HL native OI change1h %'],
  ['hl_assetNativeOiChange240Pct','HL native OI change4h %'],['hl_fundingPerHour','HL funding/hour (decimal)']];
async function main(){
  const dir=read(path.join(ROOT,'backtests/sfp-pressure-map/latest.json')).dir,plan=read(path.join(dir,'plan.json')),card=plan.card;
  const ts:Row[]=read(path.join(dir,'trades.json')),rs:Row[]=read(path.join(dir,'snapshots.json')),sum=read(path.join(dir,'summary.json'));
  const verification:Row={hashes:0,rows:rs.length,clockChecks:0,selectionUnchanged:false,recoveryChecks:0};
  for(const a of read(path.join(dir,'complete.json')).artifacts){assert.equal(await fileHash(path.join(dir,a.file)),a.sha256);verification.hashes++;}
  for(const p of [...plan.pins,...plan.candlePins]){assert.equal(await fileHash(path.join(ROOT,p.file)),p.sha256,p.file);verification.hashes++;}
  assert.equal(await fileHash(path.join(dir,'selection.json')),plan.selectionHash);
  const selection=read(path.join(dir,'selection.json'));
  assert.deepEqual(ts.map(({recovery,...t})=>t),selection.cohortAtSelection);verification.selectionUnchanged=true;
  for(const r of rs){
    const t=ts.find(t=>t.id===r.id)!;assert.equal(r.at,(r.anchor==='entry'?t.entryAt:t.exitAt)+r.offset*M);
    assert(r.delayed.at===r.at-M);if(r.phase==='pre_entry')assert(r.at<=t.entryAt);
    if(r.phase==='in_trade')assert(r.at>t.entryAt&&r.at<t.exitAt);if(r.phase==='pre_exit')assert(r.at>=t.entryAt&&r.at<=t.exitAt);
    for(const s of Object.values(r.sources.candles) as Row[]){assert(s.availableAt===s.sourceEnd+M&&s.availableAt<=r.at);verification.clockChecks++;}
    for(const s of Object.values(r.sources.hl) as any[]){if(!s)continue;const at=s.queryAt??r.at;
      if(s.availableAt!=null){assert(s.availableAt<=at&&s.sourceAt<=at);verification.clockChecks++;}
      if(s.availableMax!=null){assert(s.availableMax<=r.at&&s.sourceMax<=r.at);verification.clockChecks++;}}
  }
  const schemaPin=plan.candlePins.find((p:Row)=>p.file.endsWith('schema.json')),schema=read(path.join(ROOT,schemaPin.file));
  const end=Date.parse(card.end),{minutes}=await loadTape(ROOT,'HYPEUSDT',schema.start,end,M,'sealed');
  for(const t of ts.filter(t=>t.group==='stop')){
    const limit=Math.min(end,t.entryAt+72*H);let first:number|null=null;
    for(let at=t.exitAt+M;at<limit;at+=M){const b=minutes[(at-minutes[0].ts)/M];if(b.high>=t.target){first=at;break;}}
    assert.equal(t.recovery.targetTouchAt,first);assert.equal(t.recovery.label,first!==null?'recovered':t.entryAt+72*H<=end?'not_recovered':'censored');verification.recoveryChecks++;
  }
  const at=(t:Row,anchor='entry',offset=0)=>rs.find(r=>r.id===t.id&&r.anchor===anchor&&r.offset===offset);
  const vals=(g:string,f:string,anchor='entry',offset=0,delay=false)=>rs.filter(r=>r.group===g&&r.anchor===anchor&&r.offset===offset).map(r=>(delay?r.delayed.values:r.values)[f]);
  const df=(xs:any[])=>distribution(xs),band=(d:Row,n=2)=>`${fmt(d.median,n)} [${fmt(d.q25,n)}, ${fmt(d.q75,n)}]`,span=(d:Row,n=2)=>`${fmt(d.min,n)} to ${fmt(d.max,n)} (n=${d.n})`;
  const lines=['# SF04 — SFP pressure-point map: winning bounces versus stops','',
    '## TL;DR','',
    '- **23 original trades: 13 wins, 10 stops.** Recorded HL taker/book history starts May17; there are not15 of each. All eligible cases are included without indicator-based selection. These are descriptive associations, not a new strategy.',
    '- Entry RSI/CRSI, book, OI and funding overlap substantially. Winning trades were generally deeper below weekly VWAP, but **entry HL selling was stronger among winners in aggregate** and that relationship flips by month. A blanket selling-at-entry block is not supported.',
    '- The clearer distinction develops after entry: winners recover momentum/VWAP while stopped trades stall. Seven stops later hit their original TP by entry+72h; two do not; one is censored. There are too few non-recoveries to claim a reliable disaster filter.','',
    '## Cohort and baseline','',
    'Original SF01 **4h range-qualified, 2R, 24h cap**, $10k notional, standard0.055% taker/side, before funding; source lag60s. Not SF02 or SF03. Full accepted window Dec27,2024–Sep15,2026 20:20 UTC: **43W/79L, winning $18,124, losing -$15,449, net +$2,690 including open MTM, DD7.92%**. Exact archived trade file and receipts reused; no new replay.',
    `Selected entries: ${ts[0].entryIso} through ${ts.at(-1)!.entryIso}. Wins include ${ts.filter(t=>t.group==='win'&&t.reason==='timeout').length} profitable timeouts; stops exclude the one losing timeout (${usd(selection.excluded[0].net)}) and cutoff open inventory. The selected winners total ${usd(sum.cohort.wins.net)}, selected stops ${usd(sum.cohort.stops.net)}. These subset sums are NOT filtered-strategy earnings or an account DD.`,
    'The requested15+15 typical examples cannot be supplied with this exact setup and HL era. Rather than fabricate coverage or select attractive patterns, this map uses the available13+10, presents median/IQR/full ranges, and flags monetary/geometric extremes separately. It is not a handpicked average sample or an untouched holdout. Some trades share the same decline (for example the September8 stops);23 trades are not23 independent market regimes.','',
    '## What is stored and when it was knowable','',
    `**${sum.snapshotRows} snapshots, ${sum.features} columns:** 15m/1h/4h indicators; EMA20/50/200; UTC day/week VWAP; ADX/DMI/ATR/ROC/relative volume/MFI/CMF and existing ancillary features; HL flow, large trades, depth, native OI, funding. Exact price levels, not just distances, are in features.csv.`,
    '- Entry: -4h, -1h, each minute from-15m through entry, then+15m/+1h while still open. Exit: -1h, each minute from-15m through exit while owned, then+15m/+1h as diagnostics. Exit anchor is the **start** of the exit minute; no stop/TP-bar final high/low is used as prior information.',
    '- Every candle feature uses a finalized source bar plus60s. 4h readings can remain unchanged for hours. Additional60s source-delay sensitivity is stored. Feature values use the last completed bar close, not an invented current forming close.',
    '- VWAP uses actual Bybit turnover/base volume, day00:00UTC and Monday week reset. Day/week labels refer to the source bar’s session; near a boundary a1h feature can still describe the preceding session. Source anchors are saved. EMA is SMA-seeded once from Jan1,2026; Connors RSI is RSI3/RSI2-streak/prior100 rank.',
    '- HL buy/sell ratios are notional-weighted; <1 means selling dominates. Book imbalance is (bid-ask)/(bid+ask) at0.5%, not trade flow; aggregated/truncated/stale bands are not treated as valid narrow depth. OI means native quantity, not price-driven marked dollar OI.',
    `- All23 entry snapshots have healthy taker15/book0.5/asset context. Some trajectory cells have missing flow; each summary keeps its actual n. Original HL sample-time/receipt clocks are respected, but old sample-time proxies are not proof of exact historical network arrival. Source hashes and compact source references are retained. No HLP/candle-HL stream is loaded; those fields remain null rather than inferred.`,'',
    '## Entry ranges — median [middle50%], plus full observed span','',
    '| Feature | Wins median [Q25,Q75] | Wins full range | Stops median [Q25,Q75] | Stops full range |','|---|---:|---|---:|---|'];
  for(const [f,title] of primaryFields){const w=df(vals('win',f)),l=df(vals('stop',f)),n=f==='hl_fundingPerHour'?7:2;lines.push(`| ${title} | ${band(w,n)} | ${span(w,n)} | ${band(l,n)} | ${span(l,n)} |`);}
  lines.push('','**Reading:** no clean RSI/CRSI cutoff. Daily VWAP entry medians are almost identical (~-1.44%). Weekly VWAP differs (-5.50% wins vs-2.89% stops), but ranges overlap. Stops are not simply the trades below EMA200: their4h EMA200-distance median is +6.95%, versus approximately0% for wins. A snapshot of apparently bullish trend/flow is not sufficient protection.','',
    '## What changes while the trade develops','',
    'Median values; every pair is **wins / stops**, n shown explicitly. After-entry rows are not eligible entry features. Later rows omit trades already closed: survivor composition changes, so do not read the table as one identical paired cohort.','',
    '| Point | n W/S | RSI15m | CRSI15m | Day VWAP1h distance % | HL15m buy/sell | HL1h buy/sell |','|---|---:|---:|---:|---:|---:|---:|');
  for(const [a,o,title] of [['entry',-60,'Entry -1h'],['entry',-15,'Entry -15m'],['entry',0,'Entry'],['entry',15,'Entry +15m'],['entry',60,'Entry +1h'],['exit',-60,'Exit -1h'],['exit',-15,'Exit -15m'],['exit',0,'Exit-minute start']] as const){
    const pair=(f:string)=>['win','stop'].map(g=>fmt(df(vals(g,f,a,o)).median)).join(' / '),counts=['win','stop'].map(g=>rs.filter(r=>r.group===g&&r.anchor===a&&r.offset===o).length).join('/');
    lines.push(`| ${title} | ${counts} | ${pair('m15_rsi')} | ${pair('m15_crsi')} | ${pair('m60_dayVwapDistancePct')} | ${pair('hl_takerRatio15')} | ${pair('hl_takerRatio60')} |`); }
  lines.push('','One hour after entry, remaining winners have median15m RSI53.97 and day-VWAP distance+0.53%; remaining stops40.30 and-0.96%. This is a **follow-through hypothesis**, not tested exit profits. The stop that ended in8 minutes and winner that closed in9 minutes are absent by+15m. At exit, sell pressure and low RSI partly describe the losing move itself; an exit-aligned table cannot prove warning lead time.','',
    '### Month check: does the entry association persist?','',
    'Only months containing both outcomes are compared. May/August have wins but no stops; mixing them can distort an aggregate “edge”.','',
    '| Month | n W/S | Weekly-VWAP distance W/S % | HL15 buy/sell W/S | RSI1h W/S |','|---|---:|---:|---:|---:|');
  const monthRows:Row[]=[];
  for(const m of [...new Set(ts.map(t=>t.month))]){const w=ts.filter(t=>t.month===m&&t.group==='win'),l=ts.filter(t=>t.month===m&&t.group==='stop');if(!w.length||!l.length)continue;
    const pair=(f:string)=>[w,l].map(xs=>fmt(df(xs.map(t=>at(t)!.values[f])).median)).join(' / ');
    lines.push(`| ${m} | ${w.length}/${l.length} | ${pair('m60_weekVwapDistancePct')} | ${pair('hl_takerRatio15')} | ${pair('m60_rsi')} |`);
    monthRows.push({month:m,wins:w.length,stops:l.length,weeklyVwap:[w,l].map(xs=>df(xs.map(t=>at(t)!.values.m60_weekVwapDistancePct)))}); }
  lines.push('','Weekly-VWAP discount is deeper among winners in June, July and September, but those comparisons are only4/4,3/2 and2/4. HL15 at entry reverses: June winners have stronger buying; July/September winners stronger selling. That disqualifies a simple universal reading from these examples.','',
    '## Stop recovery versus genuine continuation','',
    '| Entry UTC | Realized stop loss | Original stop distance | Later TP within72h of entry | MAE through recovery/horizon |','|---|---:|---:|---|---:|');
  for(const t of ts.filter(t=>t.group==='stop'))lines.push(`| ${t.entryIso.slice(0,16).replace('T',' ')} | ${usd(t.net)} | ${fmt(t.riskPct)}% | ${t.recovery.label}${t.recovery.targetTouchAt!==null?` at${fmt((t.recovery.targetTouchAt-t.entryAt)/H,1)}h`:''} | ${fmt(t.recovery.maeToTouchOrHorizonPct)}% |`);
  lines.push('','Recovery = later touch of the original absolute TP strictly after the stop minute, before entry+72h; it is not proof a limit would fill or that an unstopped trade was profitable. MAE includes the full eventual target minute as a conservative path bound. Seven recoveries needed median3.74% adverse excursion, up to6.96%. September15 has incomplete follow-up and is not classified as a persistent failure.','',
    '| Non-recovering case | RSI1h at entry | CRSI1h | Weekly VWAP distance | HL15 / HL1h | OI4h change |','|---|---:|---:|---:|---:|---:|');
  for(const t of ts.filter(t=>t.recovery.label==='not_recovered')){const v=at(t)!.values;lines.push(`| ${t.entryIso.slice(0,16)} | ${fmt(v.m60_rsi)} | ${fmt(v.m60_crsi)} | ${fmt(v.m60_weekVwapDistancePct)}% | ${fmt(v.hl_takerRatio15)} / ${fmt(v.hl_takerRatio60)} | ${fmt(v.hl_assetNativeOiChange240Pct)}% |`);}
  lines.push('','June22 and July30 are the only fully observed non-recoveries. Both had fairly recovered1h RSI and buy-dominant15m flow at entry, but their broader EMA regimes differ. Two examples cannot define a credible heavy-loss classifier; using them to tune a cutoff would fit the answer.','',
    '## Geometry and typicality','', '| Measurement | Wins median [Q25,Q75] | Stops median [Q25,Q75] |','|---|---:|---:|');
  const geometry:Array<[string,(t:Row)=>number]>=[['Net dollars',t=>t.net],['Holding hours',t=>t.holdHours],['Entry-to-stop %',t=>t.riskPct],
    ['Stop distance /1h ATR',t=>t.riskPct/at(t)!.values.m60_atrPct],['Entry position within range %',t=>100*(t.entryPrice-t.range.low)/(t.range.high-t.range.low)]];
  for(const [title,fn] of geometry)lines.push(`| ${title} | ${band(df(ts.filter(t=>t.group==='win').map(fn)))} | ${band(df(ts.filter(t=>t.group==='stop').map(fn)))} |`);
  lines.push('','At these entries stops are not uniformly tighter relative to volatility: median stop/1h-ATR1.14 for stops versus0.95 for wins. Geometry and outcome overlap; do not infer that all failures are just wick noise. Quartile flags in the case map identify unusually large/small net outcomes, risk or holding time; they are not an exclusion filter.','',
    '## Additional60s information delay','', '| Entry feature | Primary W/S medians | Delayed W/S medians |','|---|---:|---:|');
  for(const f of ['m60_weekVwapDistancePct','m60_rsi','m60_crsi','m240_ema200DistancePct','hl_takerRatio15','hl_takerRatio60','hl_bookImbalance05'])lines.push(`| ${f} | ${['win','stop'].map(g=>fmt(df(vals(g,f)).median)).join(' / ')} | ${['win','stop'].map(g=>fmt(df(vals(g,f,'entry',0,true)).median)).join(' / ')} |`);
  lines.push('','A one-minute information delay can select the previous1h/4h candle at a confirmation boundary. Values are therefore explicitly re-queried, not assumed unchanged. No optimized threshold or economic robustness claim is made.','',
    '## Verdict / scope','',
    'The map narrows the question to **depth of discount plus the quality of recovery after the sweep**, rather than assuming bullish HL flow or an EMA trend snapshot identifies the winner. Weekly VWAP deserves a frozen comparison, but is not a proven filter. In-trade momentum/VWAP recovery needs a fixed decision clock and full replay accounting before it can justify an early exit or wider stop. No such rule is implemented here.',
    'RSI/CRSI ranges, OI and book readings do not produce a clean winner/loser separator in this cohort. In particular, do not turn the2 non-recoveries into a fitted catastrophe rule. No live changes, no parameter grid, no new economic variant.','',
    '## Files and verification','',
    `- Job \`${plan.key}\`, [case-by-case pressure map](../backtests/sfp-pressure-map-reviews/REVIEWKEY/case-map.md).`,
    `- [Flat feature table](../backtests/sfp-pressure-map/${plan.key}/features.csv) / [trade and recovery ledger](../backtests/sfp-pressure-map/${plan.key}/trades.csv).`,
    `- [Machine-readable source/phase map](../backtests/sfp-pressure-map/${plan.key}/snapshots.json) / [all feature ranges](../backtests/sfp-pressure-map/${plan.key}/feature-summary.json).`,
    '- [Frozen card](../research-inputs/sfp-pressure-map-sf04-2026-09-20.json). Reuse scripts/sfp-pressure-map.ts; completed inputs/outputs are fingerprinted and reused. No levels/detections or trades were recomputed.',
    `- Verified ${verification.hashes} hashes, sealed pre-feature selection, ${verification.clockChecks} stored source-clock bounds, and independently reconstructed all10 recovery labels. Focused tests cover closed-bar/EMA boundaries, future poisoning, prefix invariance, phase ownership and censoring. Validated existing indicator/HL modules reused.`, '');
  const reviewKey=sha(JSON.stringify({job:plan.key,reporter:await fileHash(__filename)})),review=path.join(ROOT,'backtests/sfp-pressure-map-reviews',reviewKey);fs.mkdirSync(review,{recursive:true});
  const dossier=['# SF04 case map','', 'UTC throughout. Each row uses only source data available at that row’s time. E=entry, X=exit-minute start. Positive X offsets are post-outcome diagnostics. No retrospective feature is an entry predictor.', ''];
  const flags=(t:Row)=>geometry.slice(0,3).filter(([,f])=>{const d=df(ts.filter(x=>x.group===t.group).map(f));return f(t)<d.q25||f(t)>d.q75;}).map(([title])=>title).join(', ')||'central on net/risk/hold';
  for(const t of ts){dossier.push(`## ${t.entryIso.slice(0,16)} — ${label(t.group)} — ${usd(t.net)}`, '',
    `ID: \`${t.id}\`. Entry ${fmt(t.entryPrice,4)}, SL ${fmt(t.stop,4)}, TP ${fmt(t.target,4)}, sweep ${fmt(t.sweep,4)}, frozen range ${fmt(t.range.low,4)}–${fmt(t.range.high,4)}. Hold ${fmt(t.holdHours)}h. Recovery: ${t.recovery.label}. Outside middle50% within outcome group: ${flags(t)}.`, '',
    '| Point | Time UTC | RSI15 /1h /4h | CRSI15 /1h /4h | Day/week VWAP distance1h % | EMA50/200 distance4h % | HL15 /1h | Book0.5 | OI4h % |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
    for(const r of rs.filter(r=>r.id===t.id&&[-60,-15,0,15,60].includes(r.offset))){const v=r.values;dossier.push(`| ${r.anchor==='entry'?'E':'X'}${r.offset>=0?'+':''}${r.offset}m | ${r.iso.slice(0,16).replace('T',' ')} | ${[15,60,240].map(tf=>fmt(v[`m${tf}_rsi`],1)).join(' / ')} | ${[15,60,240].map(tf=>fmt(v[`m${tf}_crsi`],1)).join(' / ')} | ${fmt(v.m60_dayVwapDistancePct)} / ${fmt(v.m60_weekVwapDistancePct)} | ${fmt(v.m240_ema50DistancePct)} / ${fmt(v.m240_ema200DistancePct)} | ${fmt(v.hl_takerRatio15)} / ${fmt(v.hl_takerRatio60)} | ${fmt(v.hl_bookImbalance05)} | ${fmt(v.hl_assetNativeOiChange240Pct)} |`);}dossier.push('');}
  fs.writeFileSync(path.join(review,'case-map.md'),dossier.join('\n'));atomicJson(path.join(review,'verification.json'),verification);
  const findings=path.join(ROOT,'research/codex-astra-sfp-pressure-map-findings-2026-09-20.md');fs.writeFileSync(findings,lines.join('\n').replace('REVIEWKEY',reviewKey));
  atomicJson(path.join(review,'complete.json'),{key:reviewKey,job:plan.key,findingsSha256:await fileHash(findings),artifacts:await Promise.all(['case-map.md','verification.json'].map(async file=>({file,sha256:await fileHash(path.join(review,file))})))});
  console.log(JSON.stringify({findings,review,verification},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
