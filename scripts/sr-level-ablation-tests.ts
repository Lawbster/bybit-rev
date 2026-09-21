import assert from 'assert/strict';import fs from 'fs';
import {choose,predicates,type Pulse} from './sr-partial-audit-policy';
import {runCausalLongReplay,type ResearchSrPartialDecision} from './replay-causal-engine';
import {ReplayMarketInputs,emptyReplayPulse} from './replay-market-inputs';
import type {Series,Candle,EngineParams} from './hype-freerun-canonical-replay';
import type {BotConfig} from '../src/bot/bot-config';
import {validate,levelAdapter,type LevelMode} from './sr-level-ablation-policy';
import {canExecuteSRPartialAction} from '../src/bot/sr-shadow';
validate(JSON.parse(fs.readFileSync('research-inputs/sr-level-ablation-srl01-2026-09-16.json','utf8')).definition);
const blank:Pulse={oiBy4hPct:null,oiBn4hPct:null,oiHl4hPct:null,taker4h:null,fdByNow:null,fdBnNow:null,fdHlNow:null,btc4hMovePct:null};
assert(!predicates(blank).hostile&&!predicates(blank).deteriorating);
assert(predicates({...blank,btc4hMovePct:-.25}).deteriorating&&!predicates({...blank,btc4hMovePct:-.25}).hostile);
assert(predicates({...blank,fdByNow:-.00001,oiBy4hPct:1,taker4h:1.2}).hostile&&!predicates({...blank,fdByNow:-.00001,oiBy4hPct:1,taker4h:1.2}).deteriorating);
const q={baseCandidate:true} as ResearchSrPartialDecision;
assert(choose('pulse_free',q,predicates(blank)));assert(!choose('disabled',q,predicates(blank)));assert(!choose('hostile',q,predicates(blank)));
assert(!choose('pulse_free',{...q,baseCandidate:false},predicates(blank)));
const M=60000,T=Date.UTC(2026,7,20,12),cfg:BotConfig=JSON.parse(fs.readFileSync('bot-config.json','utf8'));
cfg.srSupportReopenAction!.enabled=false;cfg.srShadow!.recentDays=.5;cfg.srPartialExitAction!.enabled=true;
function bar(i:number,p:Partial<Candle>={}):Candle{return{ts:T+i*M,endTs:T+(i+1)*M,open:100,high:100.1,low:99.9,close:100,volume:1,turnover:100,...p};}
const cs=[...Array.from({length:1480},(_,i)=>{const p=100+Math.sin(i/60);return bar(i,{open:p,close:p,high:p+.1,low:p-.1});}),
 ...Array.from({length:9},(_,j)=>bar(1480+j,j===7?{close:100.85,high:100.9}:j===8?{open:100.7,close:100.7,low:100.6,high:100.8}:{}))];
function series():Series{const n=cs.length,no=()=>Array(n).fill(false),nil=()=>Array(n).fill(null),zero=()=>Array(n).fill(0);
 return{candles:cs,trendBlocked:no(),aboveEma200:no(),ret6h:zero(),bybitFunding:nil(),fundingStress:no(),rsi1H:Array(n).fill(50),crsi4H:Array(n).fill(50),slope12h:zero(),
 riskOffBlocked:no(),regimeFlat:no(),vwap24h:nil(),priorLow12h:nil(),ret12h:nil(),ret1h:nil(),ret2h:nil(),pbHasEnough:no(),hlScore:nil(),hlSellPressure:no(),high14d:nil()};}
const params:EngineParams={id:'srp-test',maxPositions:6,addIntervalMin:1,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none',tpExecutionModel:'resting_touch'};
const s=series(),tape=new ReplayMarketInputs();tape.add('bnTaker',{timestamp:T+1480*M,buyVol:1,sellVol:2});tape.seal();s.marketInputs=tape;
const run=(hook?: (d:Readonly<ResearchSrPartialDecision>)=>boolean,c=cfg)=>runCausalLongReplay(params,s,{startIdx:1480,recordSnapshots:true,researchSrPartialGate:hook},c,32000);
const reference=run();assert.equal(reference.trims.length,1);
assert.deepEqual(run(d=>d.requiredCandidate),reference,'identity hook must preserve all engine fields');
assert.equal(run(()=>false).trims.length,0);
const choices:ResearchSrPartialDecision[]=[];const free=run(d=>{choices.push(d);return d.baseCandidate;});assert.equal(free.trims.length,1);
assert.equal(free.openDepth,3);assert.equal(free.executionAudit!.lastAddTime,T+1486*M);
assert(choices.some(d=>d.depth===6&&d.nonPulseEligible));assert(choices.every(d=>Object.isFrozen(d)&&Object.isFrozen(d.closeIds)));
const fill=free.executionAudit!.events.find(e=>e.kind==='partial')!;assert.equal(fill.decisionIndex,1487);assert.equal(fill.fillIndex,1488);assert.equal(fill.price,100.7);
const disabled=structuredClone(cfg);disabled.srPartialExitAction!.enabled=false;assert.equal(run(()=>{throw Error('disabled hook invoked');},disabled).trims.length,0);
const guarded=structuredClone(cfg);guarded.srPartialExitAction!.minDepth=7;assert.equal(run(()=>true,guarded).trims.length,0,'hook cannot bypass minDepth');
const gap={...s,candles:cs.map(c=>({...c}))};gap.candles=gap.candles.filter((_,i)=>i!==1470);
// Test unchanged source-prefix property separately without aligning synthetic Series arrays after a removal.
const before=tape.snapshot(T+1488*M);tape.add('bnTaker',{timestamp:T+1488*M,buyVol:1e9,sellVol:1,writtenAt:T+1490*M});tape.seal();assert.deepEqual(tape.snapshot(T+1488*M),before);
assert.throws(()=>run(()=>null as any),/must return boolean/);
const empty=series();empty.marketInputs=new ReplayMarketInputs();empty.marketInputs.seal();
assert.equal(runCausalLongReplay(params,empty,{startIdx:1480,researchSrPartialGate:d=>d.baseCandidate},cfg,32000).trims.length,1,'pulse-free remains eligible without any pulse');
assert.equal(runCausalLongReplay(params,empty,{startIdx:1480},cfg,32000).trims.length,0,'unknown is not deteriorating');
assert.equal(emptyReplayPulse().taker4h,null);
console.log('SRP01 policy/hook tests passed: identity, safety, timing, missing inputs and future poisoning');


const runLevel=(mode:LevelMode,c=cfg,input=s,observe: (q:any)=>void=()=>{},pulseGate: (q:any)=>boolean=q=>q.deteriorating)=>
 runCausalLongReplay(params,input,{startIdx:1480,recordSnapshots:true,partialClockModel:'transactional',
 researchSrPartialLevelStudy:{mode,pulseGate,observe}},c,32000);
const controlTx=runCausalLongReplay(params,s,{startIdx:1480,recordSnapshots:true,partialClockModel:'transactional'},cfg,32000);
assert.deepEqual(runLevel('current'),controlTx);
const mapless=structuredClone(cfg);mapless.srShadow!.minTouches=100000;
assert.equal(runLevel('current',mapless).trims.length,0);
const checks:any[]=[];const B=runLevel('without_resistance',mapless,s,q=>checks.push(q));
assert.equal(B.trims.length,1);assert(checks.some(q=>q.fire&&q.resistancePrice===null&&!q.levelEligible));
assert(checks.every(q=>Object.isFrozen(q)&&Object.isFrozen(q.closeIds)));
assert.equal(B.openDepth,3);assert.equal(B.executionAudit!.lastAddTime,controlTx.executionAudit!.lastAddTime);
const bfill=B.executionAudit!.events.find(e=>e.kind==='partial')!;
assert.equal(bfill.decisionIndex,1487);assert.equal(bfill.fillIndex,1488);assert.equal(bfill.price,100.7);
assert.equal(runLevel('without_resistance',mapless,empty).trims.length,0);
const min7=structuredClone(mapless);min7.srPartialExitAction!.minDepth=7;
assert.equal(runLevel('without_resistance',min7,s,()=>{},()=>true).trims.length,0);
const pnlGuard=structuredClone(mapless);pnlGuard.srPartialExitAction!.minLadderPnlPct=2;
assert.equal(runLevel('without_resistance',pnlGuard,s,()=>{},()=>true).trims.length,0);
const badCoverage=structuredClone(mapless);badCoverage.srShadow!.recentDays=14;
assert.equal(runLevel('without_resistance',badCoverage,s,()=>{},()=>true).trims.length,0);
assert.throws(()=>runLevel('without_resistance',mapless,s,()=>{},()=>null as any),/must return boolean/);
assert.equal(runLevel('without_resistance',disabled).trims.length,0);
const later={...s,candles:[...cs,...Array.from({length:10},(_,j)=>bar(1489+j,{open:1e4,high:1e4,low:1e4,close:1e4}))]};
const prefix=runCausalLongReplay(params,later,{startIdx:1480,endIdx:cs.length,recordSnapshots:true,partialClockModel:'transactional',
 researchSrPartialLevelStudy:{mode:'without_resistance',pulseGate:q=>q.deteriorating,observe:()=>{}}},mapless,32000);
assert.deepEqual(prefix,B,'future candles cannot change prefix trades');
console.log('SRL01 passed: identity, genuine no-level action, unchanged safety gates/next-open/clocks, no-data and future-prefix checks');
