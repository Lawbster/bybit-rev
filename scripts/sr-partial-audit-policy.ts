import assert from 'assert/strict';
import type { ResearchSrPartialDecision } from './replay-causal-engine';
export const VARIANTS = ['disabled', 'pulse_free', 'hostile'] as const;
export type Mode = 'current' | typeof VARIANTS[number];
export type Pulse = { oiBy4hPct:number|null; oiBn4hPct:number|null; oiHl4hPct:number|null;
  taker4h:number|null; fdByNow:number|null; fdBnNow:number|null; fdHlNow:number|null; btc4hMovePct:number|null };
export function predicates(p:Pulse) {
  const oi=[p.oiBy4hPct,p.oiBn4hPct,p.oiHl4hPct].filter((x):x is number=>typeof x==='number'&&Number.isFinite(x));
  const breadth=oi.length?oi.reduce((a,b)=>a+b,0)/oi.length:null;
  const negative=[p.fdByNow,p.fdBnNow,p.fdHlNow].some(x=>typeof x==='number'&&x<0);
  const hostile=(breadth!==null&&breadth<0)||(p.taker4h!==null&&p.taker4h<1)||negative;
  const deteriorating=(breadth!==null&&breadth<=-.25)||(p.taker4h!==null&&p.taker4h<=.98)||
    (p.btc4hMovePct!==null&&p.btc4hMovePct<=-.25)||negative&&((breadth!==null&&breadth<=0)||(p.taker4h!==null&&p.taker4h<=1.05));
  return {breadth,negative,hostile,deteriorating,available:Object.values(p).filter(x=>x!==null).length,
    hlAvailable:p.oiHl4hPct!==null||p.fdHlNow!==null};
}
export function choose(mode:Mode,d:Readonly<ResearchSrPartialDecision>,p:{hostile:boolean;deteriorating:boolean}) {
  if(mode==='disabled')return false;
  return d.baseCandidate&&(mode==='pulse_free'||(mode==='current'?p.deteriorating:p.hostile));
}
export function validate(d:Record<string,any>) {
  assert.deepEqual(d.variants,VARIANTS);assert.equal(d.runs,24);assert.equal(d.exactControls,8);assert.equal(d.newTradingDefinitions,3);
  assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);
  assert.equal(d.cutoff,'2026-09-15T20:20:00Z');assert.deepEqual(d.tpModels,['resting_touch','close_confirmed']);
}
