/** MA01 immutable descriptive job. Archived portfolio attribution is not saved PnL. */
import fs from 'fs';import path from 'path';import assert from 'assert/strict';
import {createPlan,executePlan,atomicJson,verifyPins,sha,type Plan} from './research-workflow';
import {buildSeries} from './flow-response-study';
import {buildFrames} from './macro-support-policy';
import {completeBars} from './macro-sr-observer';
import {responseTape,rowAt,futureLabel,H,M,type Event,type Row} from './major-recovery-policy';
import {loadFlowTape,FlowResponseContext} from './flow-response-policy';
export const CARD='research-inputs/major-recovery-ma01-2026-09-16.json';
type R=Record<string,any>;export const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
export function summary(rows:R[]){const xs=rows.filter(x=>x!==null);return{n:xs.length,meanReturn:xs.length?xs.reduce((n,x)=>n+x.returnPct,0)/xs.length:null,
  meanMae:xs.length?xs.reduce((n,x)=>n+x.maePct,0)/xs.length:null,meanMfe:xs.length?xs.reduce((n,x)=>n+x.mfePct,0)/xs.length:null,
  up:xs.filter(x=>x.first==='up').length,down:xs.filter(x=>x.first==='down').length,ambiguous:xs.filter(x=>x.first==='ambiguous').length,neither:xs.filter(x=>x.first==='neither').length};}
export function opportunity(rows:Row[],x:R,inventory:R[]){
 const episodes=x.metrics.episodes.map((e:R)=>{const at=Date.parse(e.entry),decision=inventory.find(v=>v.event.kind==='open'&&!v.before.length&&v.event.fillAt===at)?.event.decisionAt;
   assert(decision!==undefined);const q=rowAt(rows,decision);const warning=rows.find(r=>r.at>decision&&r.at<=Date.parse(e.close)&&r.spell&&r.spell.failedAt===r.at);
   return{...e,decisionAt:decision,healthy:q.healthy,spellId:q.row?.spell?.id??null,retestAt:q.row?.spell?.failedRetestAt??null,warningAfterEntry:warning?.at??null};});
 const sum=(es:R[])=>({n:es.length,wins:es.filter(e=>e.pnl>0).length,winDollars:es.filter(e=>e.pnl>0).reduce((n,e)=>n+e.pnl,0),losses:es.filter(e=>e.pnl<0).length,lossDollars:es.filter(e=>e.pnl<0).reduce((n,e)=>n+e.pnl,0)});
 return{name:x.name,all:sum(episodes),duringBreak:sum(episodes.filter((e:R)=>e.spellId)),duringRetest:sum(episodes.filter((e:R)=>e.retestAt)),warningAfterEntry:sum(episodes.filter((e:R)=>e.warningAfterEntry&&!e.spellId)),episodes};
}
async function worker(plan:Plan,out:string){
 const d=plan.card.definition;assert.equal(d.phase,'descriptive_atlas');assert.equal(d.newTradingDefinitions,0);assert(read(`${d.archive}/verification.json`).passed);
 const {s,core}=await buildSeries(d),cs=s.candles,frames=buildFrames(cs),o=responseTape(cs,frames),hours=completeBars(cs,60);
 const json=(f:string,x:unknown)=>atomicJson(path.join(out,f),x);json('rows.json',o.rows);json('events.json',o.events);
 const flow=await loadFlowTape('data/HYPEUSDT_taker_hyperliquid.jsonl',Date.parse(d.cutoff)),fc=new FlowResponseContext(flow,cs);json('flow-audit.json',flow.audit);
 const first=Date.parse(d.start),recent=Date.parse(d.recentStart),features:R[]=[],getClose=(t:number)=>{const c=cs[(t-cs[0].endTs)/M];return c?.endTs===t?c.close:null;};
 let fi=-1;
 for(let i=24;i<hours.length;i++){const b=hours[i];while(fi+1<frames.length&&frames[fi+1].at<=b.endTs)fi++;const f=frames[fi];
   if(!f?.healthy||b.endTs<first||hours[i-24].endTs!==b.endTs-24*H)continue;
   const atr=hours.slice(i-23,i+1).reduce((n,z,j)=>n+Math.max(z.high-z.low,Math.abs(z.high-hours[i-24+j].close),Math.abs(z.low-hours[i-24+j].close)),0)/24/b.close;
   const old=getClose(b.endTs-4*H);if(old===null)continue;
   features.push({at:b.endTs,atr,ret4:(b.close/old-1)*100,away:f.zones.every(z=>Math.min(Math.abs(b.close/z.lower-1),Math.abs(b.close/z.upper-1))>.03&&!(b.close>=z.lower&&b.close<=z.upper))});
 }
 const byAt=new Map(features.map(f=>[f.at,f])),controls=features.filter(f=>f.away),records:R[]=[];
 for(const e of o.events.filter(e=>e.at>=first)){
   const f=byAt.get(e.at),candidates=e.kind==='touch'&&f?controls.filter(c=>c.at<=e.at-24*H&&c.at>=e.at-30*24*H&&Math.sign(c.ret4)===Math.sign(f.ret4)&&Math.abs(c.ret4-f.ret4)<=.5&&c.atr/f.atr>=.8&&c.atr/f.atr<=1.2):[];
   if(f)candidates.sort((a,b)=>Math.abs(Math.log(a.atr/f.atr))+Math.abs(a.ret4-f.ret4)-(Math.abs(Math.log(b.atr/f.atr))+Math.abs(b.ret4-f.ret4))||b.at-a.at);
   const control=candidates[0]??null,labels=Object.fromEntries(d.horizonsHours.map((h:number)=>[h,futureLabel(cs,e.at,h)]));
   const pulse=fc.at(e.at,0),before=fc.at(e.at-15*M,0);
   records.push({...e,month:new Date(e.at).toISOString().slice(0,7),period:e.at>=recent?'recent':'earlier',feature:f??null,labels,
     pulse,pulseBefore15m:before,control:control?{...control,labels:Object.fromEntries(d.horizonsHours.map((h:number)=>[h,futureLabel(cs,control.at,h)]))}:null});
 }
 json('encounters.json',records);
 const groups:R[]=[];
 for(const period of ['all','earlier','recent'])for(const kind of [...new Set(records.map(e=>e.kind))])for(const h of d.horizonsHours){
   const r=records.filter(e=>e.kind===kind&&(period==='all'||e.period===period));groups.push({period,kind,hours:h,events:r.length,uniqueZones:new Set(r.map(e=>e.zone.id)).size,uniqueSpells:new Set(r.map(e=>e.spellId).filter(Boolean)).size,...summary(r.map(e=>e.labels[h]))});
 }
 const monthly=[...new Set(records.map(e=>e.month))].flatMap(month=>[...new Set(records.map(e=>e.kind))].map(kind=>{const xs=records.filter(e=>e.month===month&&e.kind===kind);return{month,kind,...summary(xs.map(e=>e.labels[12]))};}));
 const matched=records.filter(e=>e.kind==='touch'&&e.control&&e.labels[12]&&e.control.labels[12]);
 const matchSummary={touches:records.filter(e=>e.kind==='touch').length,matched:matched.length,uniqueControls:new Set(matched.map(e=>e.control.at)).size,
   touch:summary(matched.map(e=>e.labels[12])),control:summary(matched.map(e=>e.control.labels[12])),meanPairedReturnDelta:matched.length?matched.reduce((n,e)=>n+e.labels[12].returnPct-e.control.labels[12].returnPct,0)/matched.length:null};
 const pulseGroups=['touch','accepted_below','failed_retest','lower_base'].flatMap(kind=>['selling_with_impact','absorption_compatible','small_decline','no_acceleration','unknown'].map(response=>{
   const xs=records.filter(e=>e.kind===kind&&e.period==='recent'&&e.pulse.response===response);return{kind,response,...summary(xs.map(e=>e.labels[12]))};}));
 json('summary.json',{groups,monthly,matchSummary,pulseGroups});core.writeCsv(path.join(out,'event-summary.csv'),groups);core.writeCsv(path.join(out,'monthly.csv'),monthly);
 const controlsOld:R[]=read(`${d.archive}/output/results.json`).filter((x:R)=>x.control),parity=controlsOld.map(x=>{assert.equal(sha(JSON.stringify(read(`${d.archive}/output/${x.name}-engine.json`))),x.digest);return{name:x.name,digest:x.digest,metrics:x.metrics};});
 json('archived-control-integrity.json',{passed:true,rerun:false,controls:parity});
 const opportunities=controlsOld.filter(x=>x.policy===d.parent).map(x=>opportunity(o.rows,x,read(`${d.archive}/output/${x.name}-inventory.json`)));json('opportunities.json',opportunities);
 const archivedGate=read(`${d.archive}/output/gate-any_reclaim-lag0.json`);
 const spells=records.filter(e=>e.kind==='accepted_below').map(e=>{const end=records.find(r=>r.spellId===e.spellId&&['lower_base','old_reclaim','retired'].includes(r.kind));
   const old=archivedGate.events.find((r:R)=>r.kind==='failure'&&r.zone.id===e.zone.id&&r.at>=e.at&&r.at<=e.at+8*H);
   const oldEnd=old?archivedGate.events.find((r:R)=>r.blockId===old.blockId&&r.kind!=='failure'):null;
   return{id:e.spellId,zone:e.zone,start:e.at,end:end?.at??null,release:end?.kind??'censored',hours:((end?.at??Date.parse(d.cutoff))-e.at)/H,oldFailure:old?.at??null,oldRelease:oldEnd?.at??null};});json('spells.json',spells);
 json('validation.json',{passed:true,economicRuns:0,controlsIntegrity:8,records:records.length,independentVerificationRequired:true,liveChanges:0});
 console.log(JSON.stringify({records:records.length,matchSummary,groups:groups.filter(g=>g.period==='recent'&&g.hours===12),opportunities:opportunities.map(({episodes,...o})=>o)}));
}
export async function makePlan(cardPath:string,sources:string[]){
 const card=read(cardPath),old=read(`${card.definition.archive}/plan.json`);await verifyPins(process.cwd(),old.pins.filter((p:R)=>!p.file.startsWith('data/')&&p.file!=='bot-state.json'&&!p.file.startsWith('backtests/')));
 const prior=read(`${card.definition.archive}/state.json`);assert.equal(prior.status,'complete');await verifyPins(process.cwd(),prior.artifacts);
 return createPlan(process.cwd(),card,[...old.pins.filter((p:R)=>!p.file.startsWith('backtests/research-workflow/')).map((p:R)=>p.file),...prior.artifacts.map((p:R)=>p.file),`${card.definition.archive}/verification.json`,cardPath,...sources],old.protectedPins.map((p:R)=>p.file));
}
async function main(){const[cmd,key]=process.argv.slice(2);if(cmd==='plan'){const p=await makePlan(CARD,['scripts/major-recovery-policy.ts','scripts/major-recovery-atlas.ts','scripts/major-recovery-tests.ts','scripts/major-recovery-verify.ts']);console.log(p.key);}else{assert.equal(cmd,'run');await executePlan(process.cwd(),key,worker);}}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
