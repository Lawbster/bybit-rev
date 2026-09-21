/** Independent inventory-cashflow check of the saved case analysis. Read-only by default. */
import fs from 'fs';
import assert from 'assert/strict';
import {sha,atomicJson} from './research-workflow';
const dir='backtests/hype/entry-wait-loss-concentration-2026-09-15';
const read=(p:string):any=>JSON.parse(fs.readFileSync(p,'utf8'));
const plan=read(`${dir}/plan.json`),a=read(`${dir}/analysis.json`),v=read(`${dir}/verification.json`);
assert(v.passed);assert.equal(sha(fs.readFileSync('scripts/entry-wait-loss-concentration.ts')),v.sourceSha256);
for(const f of v.files)assert.equal(sha(fs.readFileSync(`${dir}/${f.file}`)),f.sha256);
const near=(x:number,y:number)=>assert(Math.abs(x-y)<1e-6,`${x} != ${y}`);
const archive=`${plan.card.archive}/output`;let cashflowEpisodes=0;
for(const c of a.cases){
  for(const [tag,side] of [['high_on','baseline'],['high_on_wait','waiting']]){
    const es=read(`${archive}/${c.window}-resting_touch__${tag}__open-events.json`);let chainPnl=0;
    for(const episode of c.chain[side]){
      const start=es.find((e:any)=>e.event.kind==='open'&&e.before.length===0&&e.event.fillAt===Date.parse(episode.entry));assert(start);
      let pnl=0;
      for(const e of es.filter((x:any)=>x.episode===start.episode&&x.event.kind!=='open')){
        for(const p of e.before){
          const remaining=e.after.find((q:any)=>q.id===p.id)?.qty??0,closed=p.qty-remaining;assert(closed>=-1e-8);
          pnl+=closed*(e.event.price-p.entryPrice)-closed*(e.event.price+p.entryPrice)*0.00055;
        }
      }
      near(pnl,episode.pnl);chainPnl+=pnl;cashflowEpisodes++;
    }
    near(chainPnl,c.chain[`${side}Net`]);
  }
  near(c.chain.waitingNet-c.chain.baselineNet,c.chain.delta);
  assert(c.context.features.repaired_0.hype.availableAt<=c.context.decision.at);
  assert(c.context.features.repaired_0.btc.availableAt<=c.context.decision.at);
  const last=c.waitingEvents.at(-1),armed=c.waitingTargets.at(-1);
  assert(armed.armedIndex<last.fillIndex&&armed.armedAt<=c.exitCandle.ts);
  near(armed.targetPrice,last.price);assert(c.exitCandle.high>=last.price);
}
const recent=a.cases.filter((c:any)=>c.window==='hl_extended').sort((x:any,y:any)=>x.entry.localeCompare(y.entry));
assert(recent[0].chain.untilCommonEntry<recent[1].entry,'Recent attribution intervals overlap');
const r=a.pairs.find((p:any)=>p.window==='hl_extended'&&p.tp==='resting_touch');
near(recent.reduce((n:number,c:any)=>n+c.chain.delta,0)+a.concentration.recent.outsideTwoChains,r.waitingNet-r.baselineNet);
const result={passed:true,cashflowEpisodes,disjointRecentChains:2,sourceFeaturesAvailableAtDecision:true,
  verifierSha256:sha(fs.readFileSync(__filename)),analysisSha256:sha(fs.readFileSync(`${dir}/analysis.json`))};
if(process.argv.includes('--record')){
  assert(!fs.existsSync(`${dir}/independent-check.json`),'Preserve prior receipt');atomicJson(`${dir}/independent-check.json`,result);
}
console.log(JSON.stringify(result));
