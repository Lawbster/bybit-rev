import assert from 'assert/strict';import fs from 'fs';
import {ReentryController,fiveMinuteBars,validate} from './resistance-reentry-policy';
import {auditWait,releaseFor} from './resistance-reentry-audit';
import {runCausalLongReplay} from './replay-causal-engine';
import type {Candle,Series} from './hype-freerun-canonical-replay';
import type {BotConfig} from '../src/bot/bot-config';
const T=Date.UTC(2026,8,1),M=60000,cfg:BotConfig=JSON.parse(fs.readFileSync('bot-config.json','utf8'));
cfg.srPartialExitAction!.enabled=false;cfg.srSupportReopenAction!.enabled=false;cfg.tpCooldown!.enabled=false;
validate(JSON.parse(fs.readFileSync('research-inputs/resistance-reentry-srr01-2026-09-16.json','utf8')).definition);
const bars=(n:number)=>Array.from({length:n},(_,i):Candle=>({ts:T+i*M,endTs:T+(i+1)*M,open:100,close:100,high:100.1,low:99.9,volume:1,turnover:100}));
function series(candles:Candle[]):Series{const n=candles.length,no=()=>Array(n).fill(false),nil=()=>Array(n).fill(null),zero=()=>Array(n).fill(0);
 return{candles,trendBlocked:no(),aboveEma200:no(),ret6h:zero(),bybitFunding:nil(),fundingStress:no(),rsi1H:Array(n).fill(50),crsi4H:Array(n).fill(50),slope12h:zero(),riskOffBlocked:no(),regimeFlat:no(),vwap24h:nil(),priorLow12h:nil(),ret12h:nil(),ret1h:nil(),ret2h:nil(),pbHasEnough:no(),hlScore:nil(),hlSellPressure:no(),high14d:nil()};}
function run(cs:Candle[],mode:'off'|'wait4h'|'breakout4h',lag=0,tp:'resting_touch'|'close_confirmed'='resting_touch',seedAge=M,blockedUntil=0){
 const controller=new ReentryController(mode,cs,cfg.srShadow!,lag),events:any[]=[],targets:any[]=[],attempts:any[]=[],s=series(cs);
 // Deterministic qualified-zone fixture; no synthetic test is counted as market evidence.
 (controller.shade as any).decide=(d:any)=>{const z={...d,resistance:d.avgEntry*1.012,selectedPrice:d.avgEntry*1.01,sourceAt:d.at-lag,touches:[],spaced:[]};controller.shade.selected.push(z);return z.selectedPrice;};
 s.trendBlocked=cs.map(c=>c.endTs<blockedUntil);
 const result=runCausalLongReplay({id:'SRR01-test',maxPositions:1,hardFlattenHours:12,hardFlattenPct:-2,cooldownMode:'live4h',pullbackMode:'none',tpExecutionModel:tp},s,
  {startIdx:0,seed:{ts:T-seedAge,price:100,notional:800},recordSnapshots:true,researchTpShade:controller.decide,
   researchTpObserver:t=>{controller.target(t);const p=targets.at(-1);if(!p||p.armedIndex!==t.armedIndex||p.targetPrice!==t.targetPrice||p.episode!==t.episode||p.pct!==t.pct)targets.push(t);},
   researchReduction:d=>{controller.advance(d.at);return null;},researchInventoryObserver:e=>{controller.observe(e);events.push(e);},researchAddVeto:controller.veto,
   researchAddSize:d=>{attempts.push({...d,approvedNotional:d.requestedNotional});return d.requestedNotional;}},cfg,32000);
 const row={name:mode,waitMode:mode,lag,endIdx:cs.length};auditWait(cs,row,events,targets,controller.shade.selected,controller.probes,controller.activations);
 return{controller,result,events,targets};
}
const cs=bars(245);cs[0].high=101.3;cs[1].high=101.1;
const off=run(cs,'off'),w=run(cs,'wait4h');assert.equal(w.controller.activations[0].fillAt,T+2*M);
assert.equal(w.controller.activations[0].releasedAt,T+242*M);assert.equal(w.controller.activations[0].entryAt,T+242*M);
assert.equal(off.controller.activations[0].entryAt,T+3*M);assert(w.controller.probes.some(p=>p.blocked));
const breakout=bars(14);breakout[1].high=101.1;for(const i of [4,9]){breakout[i].close=103;breakout[i].high=103;}
const r=run(breakout,'breakout4h');assert.equal(r.controller.activations[0].releasedAt,T+10*M,'exclude pre-fill part of containing5m');
assert.equal(run(breakout,'breakout4h',M).controller.activations[0].releasedAt,T+11*M,'arrival delay');
const held=run(breakout,'breakout4h',0,'resting_touch',M,T+12*M);assert.equal(held.controller.activations[0].releasedAt,T+10*M);assert.equal(held.controller.activations[0].entryAt,T+12*M,'outer gate retained');
const sub=run(breakout.slice(0,9),'breakout4h');assert.equal(sub.controller.activations[0].releasedAt,null,'no future candle');
const altered=structuredClone(breakout);altered[9].close=80;altered[9].low=80;assert.equal(run(altered,'breakout4h').controller.activations[0].releasedAt,null,'needs strict breakout');
const eq=structuredClone(breakout);eq[9].close=101.2*1.001;eq[9].high=102;assert.equal(run(eq,'breakout4h').controller.activations[0].releasedAt,null,'strict greater than');
const gap=breakout.filter((_,i)=>i!==7);assert(!fiveMinuteBars(gap).has(T+10*M));assert.equal(releaseFor(gap,new Map(gap.map((c,i)=>[c.ts,i])),{fillAt:T+2*M,resistance:101.2,expiresAt:T+242*M},'breakout4h',0,T+14*M).releasedAt,null);
const stale=bars(5);stale[1].high=100.6;assert.equal(run(stale,'wait4h',0,'resting_touch',5*3600000).controller.activations.length,0,'no stale wait');
const kill=bars(5);kill[1].close=85;kill[1].low=85;kill[2].open=85;kill[2].close=85;kill[2].low=85;assert.equal(run(kill,'wait4h').controller.activations.length,0,'no forced wait');
const alt=bars(12);alt[1].close=101.1;alt[1].high=101.2;const a=run(alt,'wait4h',0,'close_confirmed');assert.equal(a.controller.activations[0].fillAt,T+2*M);assert.equal(a.controller.activations[0].releasedAt,null);
// An invalidated target cannot retain provenance even if a later ordinary TP occurs.
const c=new ReentryController('wait4h',bars(5),cfg.srShadow!,0);(c as any).selection={episode:1,selectedPrice:101};c.target({episode:1,pct:.5,targetPrice:100.5} as any);assert.equal((c as any).selection,null);
console.log('SRR01 tests passed: qualified TP scope, fixed cap, post-fill5m, strict breakout, arrival lag, latched release, outer gate, missing/future bars, stale/forced exclusions, both fill models and independent activation audit');
