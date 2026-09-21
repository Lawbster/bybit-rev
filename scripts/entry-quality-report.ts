/** Export verified EQ01 evidence; never modifies the immutable job or live files. */
import fs from 'fs';
import assert from 'assert/strict';
import {sha,verifyPins,atomicJson} from './research-workflow';
import type {R} from './entry-quality-features';
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8'));
function csv(file:string,rows:R[]){if(!rows.length)return;const keys=[...new Set(rows.flatMap(x=>Object.keys(x)))];
  const cell=(v:any)=>v==null?'':JSON.stringify(typeof v==='object'?JSON.stringify(v):String(v));
  fs.writeFileSync(file,[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')+'\n');}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const job=`backtests/research-workflow/${key}`,out=`${job}/output`,p=read(`${job}/plan.json`),s=read(`${job}/state.json`),v=read(`${job}/verification.json`);
  assert(v.passed&&s.status==='complete');await verifyPins(process.cwd(),[...p.pins,...p.protectedPins,...s.artifacts]);
  const target='backtests/hype/entry-quality-eq01-2026-09-15-v2';assert(!fs.existsSync(target),'No report overwrite');fs.mkdirSync(target);
  const a=read(`${out}/analysis.json`),rows:R[]=read(`${out}/results.json`),cohorts:R[]=[],prices:R[]=[],economics:R[]=[],monthly:R[]=[],features:R[]=[],labels:R[]=[],sensitivity:R[]=[];
  for(const r of rows){const c=a.cases.find((c:R)=>c.name===r.name),account=v.accounting.find((c:R)=>c.name===r.name).accounting;
    const m=r.metrics;economics.push({name:r.name,window:r.window,tp:r.tp,waiting:r.waiting,net:m.totalPnl,DD:m.maxDrawdownPct,
      wins:m.profitableEpisodes,losses:m.losingEpisodes,winningAmount:m.grossWin,losingAmount:-m.grossLoss,averageLoss:m.grossLoss/m.losingEpisodes,
      tpCycles:m.tpCycles,forcedCloses:m.forcedCloses,openPnl:m.openPnl,openDepth:m.openDepth});
    for(const x of account.monthly)monthly.push({name:r.name,window:r.window,tp:r.tp,waiting:r.waiting,...x});
    for(const g of c.groups){const x={name:r.name,window:r.window,tp:r.tp,waiting:r.waiting,...g};if(g.population==='first_deep_timer')cohorts.push(x);else prices.push(x);}
    sensitivity.push({name:r.name,...c.sensitivity});
    const ss:R[]=read(`${out}/${r.name}-features.json`),ll:R[]=read(`${out}/${r.name}-labels.json`);
    for(const x of ss)for(const [clock,f0] of Object.entries(x.features)){const f=f0 as R;features.push({name:r.name,id:x.id,scope:x.scope,firstDeep:x.firstDeep,
      entryAt:x.entryAt,decisionAt:x.decision.at,decisionIso:new Date(x.decision.at).toISOString(),nextDepth:x.decision.nextDepth,priceDropOk:x.decision.priceDropOk,
      clock,sourceEnd:f.hype.end,availableAt:f.hype.availableAt,hype1h:f.hype.returns[1],hype4h:f.hype.returns[4],hype24h:f.hype.returns[24],hype48h:f.hype.returns[48],
      priorAtrAt:f.hype.priorAtrAt,priorAtrPct:f.hype.priorAtrPct,normalized48:f.hype.normalized48,distance48:f.hype.distance48,
      btc1h:f.btc.returns[1],btc4h:f.btc.returns[4],btc24h:f.btc.returns[24],btc48h:f.btc.returns[48],gap4:f.gap4,...f.categories,joint:f.joint});}
    for(const l of ll){const q=l.prices;labels.push({name:r.name,id:l.id,at:q.at,cap:q.cap,complete15:q.complete15,fillAt:q.fillAt,
      immediatePrice:q.immediatePrice,fillPrice:q.fillPrice,latencyMinutes:q.latencyMinutes,entryChangeBps:q.entryChangeBps,preEntryHighPct:q.preEntryHighPct,
      episodeEntry:l.episode?.entry,episodeClose:l.episode?.close,episodePnl:l.episode?.pnl,episodeReason:l.episode?.reason,
      closeWithin15m:l.baselineCloseWithin15m,nextMutation:l.nextMutation,intentOutcome:l.intentOutcome,windows:q.windows});}
  }
  for(const [f,x] of [['economics',economics],['monthly',monthly],['first-deep-timer-cohorts',cohorts],['other-repeated-price-groups',prices],
    ['source-features',features],['future-labels',labels],['sensitivity',sensitivity]]as const)csv(`${target}/${f}.csv`,x);
  atomicJson(`${target}/occupancy-attribution.json`,a.pairs.map((p:R)=>({window:p.window,tp:p.tp,delta:p.delta,attribution:p.attribution})));
  fs.writeFileSync(`${target}/README.md`,`# EQ01 verified research exports\n\nJob: ${key}\n\nEight exact controls, zero conditional trading definitions. See research/codex-astra-entry-quality-findings-2026-09-15.md.\n\n- economics.csv: baseline beside unconditional waiting, full-period W/L, net and DD.\n- monthly.csv: actual realized-close month and marked equity, not decision-cohort months.\n- first-deep-timer-cohorts.csv: one first decision per episode; matched whole-episode dollar changes are attribution, not conditional-strategy profits.\n- other-repeated-price-groups.csv: repeated decisions/intents; dollar fields overlap and MUST NOT be summed across rungs.\n- source-features.csv and future-labels.csv: separate source/outcome tables joined by id. Source clock is explicit.\n- occupancy-attribution.json: matched, removed, replacement and unfinished contributions reconcile to total waiting delta.\n- sensitivity.csv: 60-second availability and raw/repaired BTC category changes.\n\nPrice-only caps ignore gates/inventory; upside touches are not batch TP. Frozen method/card and immutable job carry complete ledgers and proof files. Windows overlap; this is mined history, not a holdout.\n`);
  const files=fs.readdirSync(target).map(file=>({file,sha256:sha(fs.readFileSync(`${target}/${file}`))}));
  atomicJson(`${target}/receipt.json`,{job:key,verificationSha256:sha(fs.readFileSync(`${job}/verification.json`)),reporterSha256:sha(fs.readFileSync(__filename)),files});
  console.log(JSON.stringify({target,economics,firstDeepGroups:cohorts.length}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
