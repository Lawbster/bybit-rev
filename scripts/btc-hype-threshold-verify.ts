/** Independent BH01 signal/schedule/ledger verification; no worker signal calls. */
import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import { loadMinutes } from "./relative-reversion-study";
import { atomicJson, verifyPins, fileHash } from "./research-workflow";
type R=Record<string,any>;
const M=60000,H=60*M,G=15*M;
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,"utf8"));
export function near(a:number,b:number,label:string,tol=1e-6){assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<tol,`${label}: ${a} != ${b}`);}
export function checkLedger(r:R,trades:R[],minutes:R[],signals:number[],d:R){
  const start=Date.parse(r.start),end=Date.parse(r.end),lag=r.delayMs,hold=r.spec.holdHours*H,side=r.spec.side==="long"?1:-1;
  assert.equal(minutes[0].ts,start);assert.equal(minutes.at(-1)!.endTs,end);
  const candle=(at:number)=>{const c=minutes[(at-start)/M];assert(c&&c.ts===at);return c;};
  const expected:R[]=[];let free=start,skipped=0,pendingEntry=false;
  const raw=signals.filter(t=>t>=start&&t<end);
  for(const t of raw){if(t<free){skipped++;continue;}const entry=t+lag;
    if(entry>=end){pendingEntry=true;free=entry;continue;}
    expected.push({signalAt:t,entryAt:entry,exitAt:entry+hold+lag});free=entry+hold+lag;
  }
  const closed=expected.filter(x=>x.exitAt<end),held=expected.find(x=>x.exitAt>=end);
  assert.equal(closed.length,trades.length);assert.equal(!!held,!!r.open);
  let gross=0,fees=0,turnover=0,exposure=0;const entryFees=new Map<number,number>();
  trades.forEach((t,i)=>{
    const e=closed[i];for(const k of ["signalAt","entryAt","exitAt"])assert.equal(t[k],e[k]);
    assert.equal(t.exitDecisionAt,t.entryAt+hold);assert.equal(t.side,r.spec.side);assert.equal(t.reason,"timeout");
    near(t.entryPrice,candle(t.entryAt).open,"entry open");near(t.exitPrice,candle(t.exitAt).open,"exit open");
    near(t.qty,d.notional/t.entryPrice,"qty");const pricePnl=side*t.qty*(t.exitPrice-t.entryPrice);
    const fee=t.qty*(t.entryPrice+t.exitPrice)*d.feeRate;
    near(t.pricePnl,pricePnl,"gross");near(t.fees,fee,"fees");near(t.net,pricePnl-fee,"net");
    gross+=pricePnl;fees+=fee;turnover+=t.qty*(t.entryPrice+t.exitPrice);exposure+=(t.exitAt-t.entryAt)/H;
    entryFees.set(t.entryAt,d.notional*d.feeRate);
  });
  let openNet=0;
  if(held){const p=r.open;assert.equal(p.signalAt,held.signalAt);assert.equal(p.entryAt,held.entryAt);
    near(p.entryPrice,candle(p.entryAt).open,"open entry");near(p.qty,d.notional/p.entryPrice,"open qty");
    near(p.markedPrice,minutes.at(-1)!.close,"cutoff mark");
    openNet=side*p.qty*(p.markedPrice-p.entryPrice)-p.qty*(p.entryPrice+p.markedPrice)*d.feeRate;
    near(p.net,openNet,"open net");fees+=d.notional*d.feeRate;
    turnover+=d.notional+p.qty*p.markedPrice;exposure+=(end-p.entryAt)/H;
  }
  const net=trades.reduce((s,t)=>s+t.net,0)+openNet,s=r.stats;
  near(s.net,net,"total net");near(s.closedNet,net-openNet,"closed net");near(s.openNet,openNet,"open net statistic");
  near(s.feesPaid,fees,"paid fees");near(s.turnoverIncludingMarkedExit,turnover,"turnover");near(s.exposureHours,exposure,"exposure");
  near(r.stressNet,net-turnover*d.extraStressRatePerSide,"stress");assert.equal(s.trades,trades.length);
  assert.equal(s.wins,trades.filter(t=>t.net>1e-8).length);assert.equal(s.losses,trades.filter(t=>t.net< -1e-8).length);
  assert.equal(s.breakeven,trades.filter(t=>Math.abs(t.net)<=1e-8).length);
  near(s.winningDollars,trades.reduce((s,t)=>s+Math.max(0,t.net),0),"winning dollars");
  near(s.losingDollars,trades.reduce((s,t)=>s+Math.min(0,t.net),0),"losing dollars");
  assert.equal(s.rawSignals,raw.length);assert.equal(s.skippedOccupied,skipped);
  assert.equal(s.pendingAtEnd,pendingEntry||!!(held&&held.entryAt+hold<end&&held.exitAt>=end));
  // Independent equity from cumulative CLOSED trade net plus marked whole-trade PnL.
  const positions=[...trades,...(r.open?[{...r.open,exitAt:Infinity}]:[])];
  let j=0,closedNet=0,peak=d.equity,dd=0,closeDD=0,bankrupt=false,previousEquity=d.equity;
  const monthMarks=new Map<string,number>();let month="",monthEnd=0;
  for(const c of minutes){
    while(j<positions.length&&positions[j].exitAt<=c.ts){closedNet+=positions[j].net;j++;}
    const p=j<positions.length&&positions[j].entryAt<=c.ts?positions[j]:null;
    const mark=(price:number)=>d.equity+closedNet+(p?side*p.qty*(price-p.entryPrice)-p.qty*(p.entryPrice+price)*d.feeRate:0);
    const equity=mark(c.close),adverse=mark(side===1?c.low:c.high);
    dd=Math.max(dd,100*(peak-adverse)/peak);peak=Math.max(peak,equity);closeDD=Math.max(closeDD,100*(peak-equity)/peak);bankrupt ||=adverse<=0;
    if(c.ts>=monthEnd){const dt=new Date(c.ts);month=dt.toISOString().slice(0,7);monthEnd=Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,1);}
    monthMarks.set(month,(monthMarks.get(month)??0)+equity-previousEquity);previousEquity=equity;
  }
  near(s.maxAdverseDrawdownPct,dd,"adverse DD");near(s.maxCloseDrawdownPct,closeDD,"close DD");assert.equal(s.bankrupt,bankrupt);
  assert.equal(r.monthly.length,monthMarks.size);
  for(const m of r.monthly){near(m.markedNet,monthMarks.get(m.month)!,"monthly mark");
    const exits=trades.filter(t=>new Date(t.exitAt).toISOString().startsWith(m.month));
    const entries=positions.filter(t=>new Date(t.entryAt).toISOString().startsWith(m.month));
    assert.equal(m.trades,exits.length);assert.equal(m.wins,exits.filter(t=>t.net>1e-8).length);assert.equal(m.losses,exits.filter(t=>t.net< -1e-8).length);
    assert.equal(m.breakeven,exits.filter(t=>Math.abs(t.net)<=1e-8).length);
    near(m.closedNet,exits.reduce((s,t)=>s+t.net,0),"monthly closed");
    near(m.winningDollars,exits.reduce((s,t)=>s+Math.max(0,t.net),0),"monthly wins");
    near(m.losingDollars,exits.reduce((s,t)=>s+Math.min(0,t.net),0),"monthly losses");
    near(m.feesPaid,entries.length*d.notional*d.feeRate+exits.reduce((s,t)=>s+t.qty*t.exitPrice*d.feeRate,0),"monthly fees");
  }
  return {fills:trades.length*2+(r.open?1:0),marks:minutes.length,signals:raw.length};
}
async function main(){
  const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));
  const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,plan=read(`${dir}/plan.json`),d=plan.card.definition,state=read(`${dir}/state.json`);
  assert.equal(state.status,"complete");await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
  const asset=(await loadMinutes(process.cwd(),"HYPEUSDT",Date.parse(d.cutoff),d.repair)).candles;
  const btc=(await loadMinutes(process.cwd(),"BTCUSDT",Date.parse(d.cutoff))).candles;
  const base=asset[0].ts,n=asset.length;const ac=Float64Array.from(asset,c=>c.close),bc=new Float64Array(n).fill(NaN),missing=new Int32Array(n+1);
  for(const c of btc){const i=(c.ts-base)/M;if(i>=0&&i<n)bc[i]=c.close;}
  for(let i=0;i<n;i++){assert.equal(asset[i].ts,base+i*M);missing[i+1]=missing[i]+(Number.isNaN(bc[i])?1:0);}
  const saved=read(`${out}/features.json`),savedSignals=read(`${out}/signals.json`),reference=new Map<number,R[]>();let featureChecks=0;
  for(const hours of d.lookbackHours){const rows:R[]=[];const width=hours*60;
    for(let at=Math.ceil(Date.parse(d.windows[0].start)/G)*G-G;at<Date.parse(d.cutoff);at+=G){
      const b=(at-base)/M-1,a=b-width,valid=a>=0&&b<n;
      const hype=valid?100*(ac[b]/ac[a]-1):null;
      const bt=valid&&missing[b+1]===missing[a]?100*(bc[b]/bc[a]-1):null;
      rows.push({at,lookbackHours:hours,ready:hype!==null&&bt!==null,hype,btc:bt,gap:hype===null||bt===null?null:hype-bt});
    }
    assert.deepEqual(rows,saved[String(hours)]);featureChecks+=rows.length;reference.set(hours,rows);
  }
  // Reconstruct each unique signed crossing without the worker's signalTimes().
  for(const [key,list]of Object.entries(savedSignals)){
    const m=key.match(/^(clock|gap|btc)_L(\d+)_T([\d.]+)_P(-?\d+)$/)!;assert(m);
    const [,family,lb,th,pol]=m,expected:number[]=[],rows=reference.get(Number(lb))!;
    for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(!a.ready||!b.ready)continue;
      const hit=family==="clock"||(Number(pol)===1?a[family]<Number(th)&&b[family]>=Number(th):a[family]>-Number(th)&&b[family]<=-Number(th));
      if(hit)expected.push(b.at);
    }
    assert.deepEqual(list,expected,key);
  }
  const results:R[]=read(`${out}/results.json`),byName=new Map(results.map(r=>[r.name,r]));assert.equal(byName.size,936);
  const periods=new Map(d.windows.map((w:R)=>[w.id,asset.filter(c=>c.ts>=Date.parse(w.start)&&c.endTs<=Date.parse(w.end))]));
  let cases=0,fills=0,marks=0,signals=0;const seen=new Set<string>(),concentration:R[]=[];
  const lines=readline.createInterface({input:fs.createReadStream(`${out}/trades.jsonl`),crlfDelay:Infinity});
  for await(const line of lines){if(!line.trim())continue;const x=JSON.parse(line),r=byName.get(x.name)!;assert(r&&!seen.has(x.name));seen.add(x.name);
    const s=r.spec,key=`${s.family}_L${s.lookbackHours}_T${s.threshold}_P${s.polarity}`;
    const c=checkLedger(r,x.trades,periods.get(r.window) as R[],savedSignals[key],d);cases++;fills+=c.fills;marks+=c.marks;signals+=c.signals;
    const wins=x.trades.map((t:R)=>t.net).filter((v:number)=>v>0).sort((a:number,b:number)=>b-a);
    concentration.push({name:r.name,largestWin:wins[0]??0,top5WinDollars:wins.slice(0,5).reduce((a:number,b:number)=>a+b,0),
      netWithoutBest5:r.stats.net-wins.slice(0,5).reduce((a:number,b:number)=>a+b,0),
      worstTrade:x.trades.reduce((v:number,t:R)=>Math.min(v,t.net),0)});
    if(cases%48===0)console.log(`[BH01 verification ${cases}/936] ${r.name}`);
  }
  assert.equal(cases,936);assert.equal(results.filter(r=>r.spec.family==="clock").length,72);
  await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins,...state.artifacts]);
  const dest=path.join(dir,"verification.json");assert(!fs.existsSync(dest));
  atomicJson(dest,{passed:true,cases,canonicalControlsIndependentlyVerified:72,featureChecks,signalStreams:Object.keys(savedSignals).length,
    fills,minuteMarks:marks,rawSignals:signals,concentration,artifacts:await Promise.all(state.artifacts.map(async(p:R)=>({file:path.basename(p.file),sha256:await fileHash(p.file)}))),
    limitations:d.limitations,liveChanges:0});
  console.log(JSON.stringify({passed:true,cases,featureChecks,fills,minuteMarks:marks}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
