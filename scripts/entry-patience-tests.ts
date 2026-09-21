import assert from 'assert/strict';
import {EntryPatience,SPECS,type R}from './entry-patience-policy';
import {verifySources}from './entry-patience-source';
import {runCappedEntry}from './entry-patience-standalone-engine';
import {runCappedEntry as original}from './btc-dip-price-cap-engine';
import fs from 'fs';
import {runCausalLongReplay}from './entry-patience-ladder-engine';
import {runCausalLongReplay as canonical}from './replay-causal-engine';
const M=60000;
const d=(at:number,price=100,extra:R={})=>({at,index:at/M,episode:1,nextDepth:8,price,priceDropOk:false,intervalMinutes:30,...extra}as any);
const fill=(at:number,open:number,reason='time_add')=>({at,index:at/M+1,decisionIndex:at/M,reason,open});
let assertions=0;function test(fn:()=>void){fn();assertions++;}
test(()=>{const p=new EntryPatience(SPECS[4]);assert(p.decide(d(0)));assert.equal(p.pending!.cap,99.9);
  assert.equal(p.decide(d(M,99.9)),false);assert.equal(p.fill(fill(M,99.91)),null);assert.equal(p.fill(fill(M,99.89)),99.89);});
test(()=>{const p=new EntryPatience(SPECS[4],'cap');p.decide(d(0));p.decide(d(M,99.8));assert.equal(p.fill(fill(M,99.8)),99.9);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0));assert(p.decide(d(15*M,99)));assert.equal(p.intents[0].phase,'expired');
  assert(p.decide(d(29*M,90)));assert.equal(p.intents.length,1);p.decide(d(30*M,90));assert.equal(p.intents.length,2);assert.equal(p.pending!.reference,90);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0));p.end({at:M,index:1,pending:null,gap:false});assert.equal(p.intents[0].phase,'gate_or_exit');assert(p.decide(d(2*M,90)));});
test(()=>{const p=new EntryPatience(SPECS[3]);assert.equal(p.decide(d(0)),false);p.end({at:0,index:0,pending:'open',gap:true});assert.equal(p.fill(fill(0,99)),null);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0));assert.equal(p.decide(d(M,99,{priceDropOk:true})),false);assert.equal(p.intents[0].phase,'price_drop_priority');assert.equal(p.fill(fill(M,101,'price_drop')),101);});
test(()=>{const p=new EntryPatience(SPECS[3],'activation60');assert(p.decide(d(0)));assert.equal(p.decide(d(M)),false);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0));p.observe({event:{fillAt:M,kind:'partial'}}as any);assert.equal(p.pending,null);assert.equal(p.retryAt,0);});
test(()=>{const p=new EntryPatience(SPECS[4]);assert.equal(p.decide(d(0,100,{nextDepth:2})),false);assert.equal(p.intents.length,0);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0,100,{intervalMinutes:60}));assert(p.decide(d(31*M,90)));assert.equal(p.intents.length,1);});
const candles=Array.from({length:180},(_,i)=>({ts:i*M,endTs:(i+1)*M,open:100-i*.01,high:101,low:97,close:100-i*.01,volume:1,turnover:100}));
const options={start:0,end:180*M,delayMs:0,holdMs:60*M,notional:10000,equity:32000,feeRate:.00055,expiryMinutes:15,penetrationBps:0};
for(const delayMs of [0,M])for(const expiryMinutes of [null,15])for(const penetrationBps of [0,5])test(()=>{
  const signals=[{at:0,cap:100},{at:90*M,cap:99.1}];const o={...options,delayMs,expiryMinutes,penetrationBps};assert.deepEqual(runCappedEntry(candles,signals,o),original(candles,signals,o));});
test(()=>{const r=runCappedEntry(candles,[{at:0,cap:100}],{...options,executionBps:5});assert.equal(r.intents[0].entryAt,5*M);
  assert(r.trades[0].entryPrice<=100);assert.equal(r.trades[0].exitPrice,candles[65].open*.9995);});
test(()=>{const a=runCappedEntry(candles,[{at:0,cap:100}],{...options,executionBps:5});const poisoned=candles.map((c,i)=>i<70?c:{...c,high:500,low:1,open:300,close:300});
  const b=runCappedEntry(poisoned,[{at:0,cap:100}],{...options,executionBps:5});assert.deepEqual(a.trades,b.trades);});
test(()=>{const p=new EntryPatience(SPECS[4]);p.decide(d(0));p.decide(d(M,101));assert.equal(p.pending!.reference,100);assert.equal(p.pending!.cap,99.9);});
const T=Date.UTC(2026,5,1),bars=Array.from({length:50},(_,i)=>({ts:T+i*M,endTs:T+(i+1)*M,open:100,high:100.1,low:99.8,close:100,volume:1,turnover:100}));
function ladder(cs:typeof bars,wait:EntryPatience|null,base=false){const n=cs.length,arr=(v:any)=>Array(n).fill(v);
  const s:any={candles:cs,trendBlocked:arr(false),riskOffBlocked:arr(false),regimeFlat:arr(false),aboveEma200:arr(false),
    ret6h:arr(0),rsi1H:arr(50),crsi4H:arr(50),slope12h:arr(0),ret12h:arr(null),bybitFunding:arr(null)};
  const cfg=JSON.parse(fs.readFileSync('bot-config.json','utf8'));cfg.srShadow=undefined;cfg.srPartialExitAction.enabled=false;cfg.srSupportReopenAction.enabled=false;
  const opts={startIdx:0,recordSnapshots:true,seed:{ts:T-31*M,price:100},researchAddVeto:wait?.decide,researchOpenFill:wait?.fill,
    researchMinuteEnd:wait?.end,researchInventoryObserver:wait?.observe};
  return (base?canonical:runCausalLongReplay)({id:'fixture',maxPositions:11,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none',tpExecutionModel:'resting_touch'},s,opts,cfg,32000);
}
test(()=>assert.deepEqual(ladder(bars,null),ladder(bars,null,true)));
test(()=>{const cs=bars.map((c,i)=>i===1?{...c,open:101,high:101,close:99.85}:i===2?{...c,open:99.85,close:99.85}:c);
  const p=new EntryPatience(SPECS[1]),r=ladder(cs,p);const first=r.executionAudit!.events.find(e=>e.kind==='open')!;
  assert.equal(first.fillIndex,2);assert.equal(first.price,99.85);assert.equal(p.intents[0].reference,100);});
test(()=>{const cs=bars.map((c,i)=>i===1?{...c,high:102}:c);const p=new EntryPatience(SPECS[1]),r=ladder(cs,p);
  assert.equal(r.executionAudit!.events[0].kind,'close');assert.equal(p.intents[0].phase,'inventory_changed');});
test(()=>{const short=bars.slice(0,20),poisoned=bars.map((c,i)=>i<20?c:{...c,open:180,high:200,low:170,close:190});
  const a=ladder(short,new EntryPatience(SPECS[1])),b=ladder(poisoned,new EntryPatience(SPECS[1]));
  assert.deepEqual(a.executionAudit!.events,b.executionAudit!.events.filter(e=>e.fillIndex!<20));});
verifySources();console.log(`entry patience fixtures passed (${assertions} cases)`);
