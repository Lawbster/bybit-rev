/** SRL01 research adapter: reconstruct the private live inventory plan, not a new allocation. */
import assert from 'assert/strict';
import type { BotConfig } from '../src/bot/bot-config';
import type { LadderPosition } from '../src/bot/state';
import { canExecuteSRPartialAction, type SRShadowDecision, type SRPartialActionGateInput } from '../src/bot/sr-shadow';

export type LevelMode = 'current' | 'without_resistance';
export type LevelDecision = { at:number; index:number; episode:number; depth:number; price:number;
  pnlPct:number; planNet:number; closeIds:readonly string[]; levelEligible:boolean;
  resistancePrice:number|null; resistanceDistPct:number|null; deteriorating:boolean; hostile:boolean };
export type LevelStudy = { mode:LevelMode; pulseGate:(d:Readonly<LevelDecision>)=>boolean;
  observe:(d:Readonly<LevelDecision & {pulseChoice:boolean;fire:boolean}>)=>void };

export function rebuildPartial(positions:readonly LadderPosition[], price:number, keepRungs:number, feeRate:number):SRShadowDecision['partialExitPlan'] {
  if(positions.length<=keepRungs)return null;
  const close=positions.map((p,i)=>({i,position:p,pnl:(price-p.entryPrice)*p.qty}))
    .sort((a,b)=>b.pnl-a.pnl).slice(0,positions.length-keepRungs);
  return {keepRungs,closeCount:close.length,closeQty:close.reduce((s,x)=>s+x.position.qty,0),
    closeNotional:close.reduce((s,x)=>s+x.position.notional,0),estimatedPnl:close.reduce((s,x)=>s+x.pnl,0),
    estimatedNetPnl:close.reduce((s,x)=>s+x.pnl-x.position.notional*feeRate-x.position.qty*price*feeRate,0),
    closeIndices:close.map(x=>x.i),closeLevels:close.map(x=>x.position.level)};
}
export function levelAdapter(positions:readonly LadderPosition[],price:number,c:BotConfig,d:SRShadowDecision|null,healthy:boolean,mode:LevelMode){
  assert(['current','without_resistance'].includes(mode));
  const action=c.srPartialExitAction!,sc=c.srShadow!;
  assert.equal(action.requiredCandidate,'zone30_partial_exit_resistance_deep6_profit_deteriorating_shadow');
  const plan=rebuildPartial(positions,price,sc.keepRungs??3,c.feeRate),r=d?.levels.nearestResistance;
  // Verify the independent reconstruction whenever the original shadow has a plan.
  if(d?.partialExitPlan)assert.deepEqual(plan,d.partialExitPlan);
  const baseCandidate=!!plan&&plan.closeCount>0&&plan.estimatedNetPnl>0&&positions.length>=6&&d?.ladder.pnlPct!==null&&d?.ladder.pnlPct!==undefined&&d.ladder.pnlPct>=.25;
  const levelEligible=!!r&&!!d?.partialExitPlan&&r.distPct<=action.resistanceBufferPct;
  const gates:SRPartialActionGateInput={contextHealthy:healthy,hasDecision:!!d,hasRequiredCandidate:baseCandidate&&(d?.pulse.pulseDeteriorating===true),
    hasPlan:!!plan,hasResistance:mode==='without_resistance'||!!r,depthOk:positions.length>=action.minDepth,
    remainingDepthOk:positions.length>action.keepRungs,ladderPnlOk:!!d&&d.ladder.pnlPct!==null&&d.ladder.pnlPct>=action.minLadderPnlPct,
    planProfitOk:!!plan&&(!action.requirePlanProfit||plan.estimatedNetPnl>0),resistanceOk:mode==='without_resistance'||levelEligible,
    keepOk:!!plan&&plan.keepRungs===action.keepRungs};
  const nonLevelEligible=baseCandidate&&canExecuteSRPartialAction({...gates,hasRequiredCandidate:true,hasResistance:true,resistanceOk:true});
  if(mode==='current'&&d&&levelEligible)assert.equal(gates.hasRequiredCandidate,d.firedCandidates.includes(action.requiredCandidate));
  return {plan,gates,baseCandidate,nonLevelEligible,levelEligible};
}
export function validate(d:Record<string,any>){
  assert.deepEqual(d.variants,['without_resistance']);assert.equal(d.runs,16);assert.equal(d.exactControls,10);assert.equal(d.newTradingDefinitions,1);
  assert.equal(d.parent,'age10__minus_deep_stress__minus_tp_cooldown');assert.equal(d.initialEquity,32000);assert.equal(d.feeRate,.00055);
  assert.equal(d.cutoff,'2026-09-15T20:20:00Z');assert.deepEqual(d.tpModels,['resting_touch','close_confirmed']);
}
