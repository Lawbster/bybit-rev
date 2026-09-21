import assert from 'assert/strict';import fs from 'fs';
import {qualifies,ResistanceSkip} from './resistance-add-skip-policy';
import {runCausalLongReplay} from './replay-causal-engine';
import type {Candle,Series,EngineParams} from './hype-freerun-canonical-replay';
import type {BotConfig} from '../src/bot/bot-config';
const f={healthy:true,resistance:100.3,distancePct:.3,spaced:[0,21600000,43200000]},a={nextDepth:6,priceDropOk:false,price:100};
assert(qualifies(a,f));assert(!qualifies({...a,nextDepth:5},f));assert(!qualifies({...a,priceDropOk:true},f));
assert(!qualifies(a,{...f,healthy:false}));assert(!qualifies(a,{...f,distancePct:.30001}));
assert(!qualifies(a,{...f,resistance:100}));assert(!qualifies(a,{...f,resistance:null}));assert(!qualifies(a,{...f,spaced:[0,21600000]}));
const T=Date.UTC(2026,8,1),M=60000,cfg:BotConfig=JSON.parse(fs.readFileSync('bot-config.json','utf8'));
cfg.srPartialExitAction!.enabled=false;cfg.srSupportReopenAction!.enabled=false;cfg.tpCooldown!.enabled=false;cfg.deepAddStressGuard!.enabled=false;
const bar=(i:number,patch:Partial<Candle>={}):Candle=>({ts:T+i*M,endTs:T+(i+1)*M,open:100,close:100,high:100.1,low:99.9,volume:1,turnover:100,...patch});
function series(candles:Candle[]):Series{const n=candles.length,no=()=>Array(n).fill(false),nil=()=>Array(n).fill(null),zero=()=>Array(n).fill(0);
  return{candles,trendBlocked:no(),aboveEma200:no(),ret6h:zero(),bybitFunding:nil(),fundingStress:no(),rsi1H:Array(n).fill(50),crsi4H:Array(n).fill(50),slope12h:zero(),riskOffBlocked:no(),regimeFlat:no(),vwap24h:nil(),priorLow12h:nil(),ret12h:nil(),ret1h:nil(),ret2h:nil(),pbHasEnough:no(),hlScore:nil(),hlSellPressure:no(),high14d:nil()};}
const p:EngineParams={id:'srk01-test',executionModel:'causal_next_open',maxPositions:6,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none',tpExecutionModel:'resting_touch'};
const cs=Array.from({length:180},(_,i)=>bar(i)),s=series(cs),opts={startIdx:0};
const base=runCausalLongReplay(p,s,opts,cfg,32000);assert.deepEqual(base,runCausalLongReplay(p,s,{...opts,researchAddVeto:()=>false},cfg,32000));
let skipped=0;const r=runCausalLongReplay(p,s,{...opts,researchAddVeto:d=>{const skip=d.nextDepth>=6&&!d.priceDropOk&&d.index<160;if(skip)skipped++;return skip;}},cfg,32000);
assert(skipped>0);const opens=r.executionAudit!.events.filter(e=>e.kind==='open');assert.equal(opens.length,6);
assert.equal(opens[5].decisionIndex,160,'veto must not reset add clock');assert.equal(opens[5].fillIndex,161);
for(const tpExecutionModel of ['resting_touch','close_confirmed']as const){
  const bars=cs.map(c=>({...c}));bars[151]=bar(151,{close:99.6,low:99.5});bars[152]=bar(152,{open:99.6,close:99.6,low:99.5,high:99.7});
  const r=runCausalLongReplay({...p,tpExecutionModel},series(bars),{...opts,researchAddVeto:d=>d.nextDepth>=6&&!d.priceDropOk},cfg,32000);
  const last=r.executionAudit!.events.filter(e=>e.kind==='open').at(-1)!;assert.equal(last.reason,'price_drop');assert.equal(last.decisionIndex,151);assert.equal(last.price,99.6);
}
const denied=series(cs);denied.trendBlocked.fill(true);let calls=0;runCausalLongReplay(p,denied,{...opts,researchAddVeto:()=>{calls++;return true;}},cfg,32000);assert.equal(calls,0,'outer gates precede hook');
const empty=new ResistanceSkip([],cfg.srShadow!,0,true);assert.throws(()=>empty.veto({...a,at:T}as any),/advance/);
const future=[...cs,bar(180,{high:200,close:150})];assert.deepEqual(runCausalLongReplay(p,series(future),{...opts,endIdx:180,researchAddVeto:d=>d.nextDepth>=6&&!d.priceDropOk},cfg,32000),runCausalLongReplay(p,s,{...opts,researchAddVeto:d=>d.nextDepth>=6&&!d.priceDropOk},cfg,32000));
console.log('SRK01 tests passed: depth/buffer/coverage/touch predicates, drop exemption, unchanged timer, next-open fill, both TP models, outer gates, no-op parity and future prefix');
