/** Independent minute aggregation, closed-source arithmetic, future labels and ledger audit. */
import fs from 'fs';
import assert from 'assert/strict';
import {verifyPins,atomicJson,sha} from './research-workflow';
import {loadMinutes} from './relative-reversion-study';
import {auditWindow} from './entry-patience-review';
import {auditFlowLedger} from './entry-patience-ladder-audit';
import {auditAgeHighTargets,auditAgeHighExits,rawHighs} from './entry-patience-target-audit';
import type {R} from './entry-quality-features';
const read=(f:string):any=>JSON.parse(fs.readFileSync(f,'utf8')),M=60000,H=3600000;
function near(a:number,b:number){assert(Number.isFinite(a)&&Number.isFinite(b));assert(Math.abs(a-b)<1e-7+1e-10*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);}
function equal(a:any,b:any):void{if(typeof a==='number'&&typeof b==='number'){near(a,b);return;}
  if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))equal(a[k],b[k]);}else assert.deepEqual(a,b);}
function independentHours(cs:R[]):R[]{const groups=new Map<number,R[]>();for(const c of cs){const start=Math.floor(c.ts/H)*H;if(!groups.has(start))groups.set(start,[]);groups.get(start)!.push(c);}
  const rows:R[]=[];for(const [start,x] of groups){if(x.length!==60||x.some((c,i)=>c.ts!==start+i*M))continue;
    rows.push({at:start+H,open:x[0].open,high:Math.max(...x.map(c=>c.high)),low:Math.min(...x.map(c=>c.low)),close:x[59].close,
      volume:x.reduce((n,c)=>n+c.volume,0),turnover:x.reduce((n,c)=>n+c.turnover,0),atr:null,run:0});}
  let trs:number[]=[];for(let i=1;i<rows.length;i++){const x=rows[i],p=rows[i-1];if(x.at-p.at!==H){trs=[];continue;}
    trs.push(Math.max(x.high-x.low,Math.abs(x.high-p.close),Math.abs(x.low-p.close)));x.run=trs.length;
    if(trs.length===14)x.atr=trs.reduce((a,b)=>a+b,0)/14;else if(trs.length>14)x.atr=(p.atr*13+trs.at(-1)!)/14;}
  return rows;}
function asset(map:Map<number,R>,end:number,lag:number){const now=map.get(end),prev=map.get(end-H),origin=map.get(end-48*H),returns:R={};
  for(const hours of [1,4,24,48]){let valid=true;for(let k=0;k<=hours;k++)if(!map.has(end-k*H))valid=false;
    returns[hours]=valid?100*(now!.close-map.get(end-hours*H)!.close)/map.get(end-hours*H)!.close:null;}
  const highs=[];for(let k=0;k<48;k++)highs.push(map.get(end-k*H)?.high);const high=highs.some(x=>x===undefined)?null:Math.max(...highs);
  const atr=origin?.atr==null?null:100*origin.atr/origin.close;
  return {end,availableAt:end+lag,price:now?.close??null,returns,priorAtrAt:end-48*H,priorAtrPct:atr,
    normalized48:returns[48]===null||atr===null||atr<=0?null:returns[48]/atr/Math.sqrt(48),high48:high,
    distance48:now&&high!==null?100*(high-now.close)/high:null,
    structure:!now||!prev?'unknown':now.close>prev.high?'up_break':now.close<prev.low?'down_break':'inside'};}
function auditFeature(x:R,hm:Map<number,R>,bm:Map<number,R>){const end=Math.floor((x.at-x.lag)/H)*H;assert(end+x.lag<=x.at);
  const h=asset(hm,end,x.lag),b=asset(bm,end,x.lag),gap=h.returns[4]===null||b.returns[4]===null?null:h.returns[4]-b.returns[4];
  equal(x.hype,h);equal(x.btc,b);equal(x.gap4,gap);
  const cat={fixedExtension:h.returns[48]===null?'unknown':h.returns[48]>=10?'extended':'not_extended',
    scaledExtension:h.normalized48===null?'unknown':h.normalized48>=1?'extended':'not_extended',nearHigh:h.distance48===null?'unknown':h.distance48<=1?'near':'away',
    structure:h.structure,btcDirection:b.returns[4]===null?'unknown':b.returns[4]<0?'negative':'nonnegative',
    relative:gap===null?'unknown':gap<0?'underperform':'outperform_or_equal',btcDip1h:b.returns[1]===null?'unknown':b.returns[1]<=-.5?'dip':'no_dip',
    btcRise1h:b.returns[1]===null?'unknown':b.returns[1]>=.5?'rise':'no_rise'};
  assert.deepEqual(x.categories,cat);assert.equal(x.joint,[cat.scaledExtension,cat.structure,cat.btcDirection].join('/'));}
function auditLabels(p:R,cs:R[],index:number,end:number){const at=cs[index].endTs,cap=cs[index].close*.999;assert.equal(p.at,at);near(p.cap,cap);
  const future=cs.slice(index+1,index+241).filter(c=>c.endTs<=end);if(!future.length){assert.equal(p.ready,false);return;}
  assert.equal(p.ready,true);near(p.immediatePrice,future[0].open);let f:R|null=null;
  for(let k=0;k<Math.min(14,future.length-1);k++)if(future[k].close<=cap&&future[k+1].open<=cap){f={c:future[k+1],index:index+k+2};break;}
  assert.equal(p.fillAt,f?.c.ts??null);assert.equal(p.fillIndex,f?.index??null);equal(p.fillPrice,f?.c.open??null);
  equal(p.latencyMinutes,f?(f.c.ts-at)/M:null);equal(p.entryChangeBps,f?10000*(f.c.open/future[0].open-1):null);
  near(p.preEntryHighPct,100*(Math.max(future[0].open,...future.filter(c=>c.ts<(f?.c.ts??Math.min(at+15*M,end))).map(c=>c.high))/future[0].open-1));
  assert.equal(p.complete15,at+15*M<=end);
  for(const n of [15,60,240]){if(future.length<n){assert.equal(p.windows[n],null);continue;}
    const w=future.slice(0,n),ref=w[0].open,actual=p.windows[n];near(actual.lowPct,100*(Math.min(ref,...w.map(c=>c.low))/ref-1));
    near(actual.highPct,100*(Math.max(ref,...w.map(c=>c.high))/ref-1));near(actual.closePct,100*(w.at(-1)!.close/ref-1));
    for(const [name,mult,up] of [['up05',1.005,true],['up14',1.014,true],['down03',.997,false],['down1',.99,false],['down2',.98,false]]as const)
      assert.equal(actual.hits[name],w.find(c=>up?c.high>=ref*mult:c.low<=ref*mult)?.ts??null);
  }}
async function checkRepair(bundle:R,raw:R[]){await verifyPins(process.cwd(),bundle.originalInputs);const minutes=new Map<number,R>(),native=new Map<number,R>();
  for(const p of bundle.pages){assert.equal(sha(p.body),p.sha256);const url=new URL(p.url);assert.equal(url.hostname,'api.bybit.com');assert.equal(url.pathname,'/v5/market/kline');
    for(const [k,v] of Object.entries({symbol:'BTCUSDT',category:'linear',interval:p.interval,start:p.start,end:p.end,limit:1000}))assert.equal(url.searchParams.get(k),String(v));
    const body=JSON.parse(p.body);assert.equal(body.retCode,0);assert(p.requestedAt<=p.receivedAt&&p.receivedAt<=bundle.retrievedAt);const map=p.interval===1?minutes:native;
    assert.equal(body.result.list.length,Math.ceil((p.end-p.start+1)/(p.interval*M)));
    for(const row of body.result.list){const [ts,open,high,low,close,volume,turnover]=row.map(Number),c={ts,endTs:ts+p.interval*M,open,high,low,close,volume,turnover};
      assert(ts>=p.start&&ts<=p.end&&ts%(p.interval*M)===0&&c.endTs<=p.receivedAt);assert(low<=Math.min(open,close)&&high>=Math.max(open,close));
      if(map.has(ts))equal(c,map.get(ts));map.set(ts,c);}}
  for(const [ts,b] of native){const w=Array.from({length:5},(_,k)=>minutes.get(ts+k*M));assert(w.every(Boolean));const x=w as R[];
    equal([b.open,b.high,b.low,b.close,b.volume,b.turnover],[x[0].open,Math.max(...x.map(c=>c.high)),Math.min(...x.map(c=>c.low)),x[4].close,x.reduce((n,c)=>n+c.volume,0),x.reduce((n,c)=>n+c.turnover,0)]);}
  const map=new Map(raw.map(c=>[c.ts,c]));let neighbors=0;for(const [t,c] of minutes)if(map.has(t)){equal(c,map.get(t));neighbors++;}
  for(const t of bundle.missing){assert(!map.has(t));assert(native.has(Math.floor(t/(5*M))*5*M));assert(minutes.has(t));map.set(t,minutes.get(t)!);}
  const merged=[...map.values()].sort((a,b)=>a.ts-b.ts);for(let i=1;i<merged.length;i++)assert.equal(merged[i].ts-merged[i-1].ts,M);
  assert.equal(bundle.missing.length,28207);assert.equal(native.size,5650);assert.equal(neighbors,43);return merged;}
async function main(){const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`,out=`${dir}/output`,plan=read(`${dir}/plan.json`),state=read(`${dir}/state.json`),d=plan.card.definition;
  assert.equal(state.status,'complete');const pins=[...plan.pins,...plan.protectedPins,...state.artifacts];await verifyPins(process.cwd(),pins);
  const cs=(await loadMinutes(process.cwd(),'HYPEUSDT',Date.parse(d.cutoff),d.repairFile)).candles;
  const rawBtc=(await loadMinutes(process.cwd(),'BTCUSDT',Date.parse(d.cutoff))).candles,btc=await checkRepair(read(d.btcRepair),rawBtc),hours=read(`${out}/hourly-context.json`);
  const ih=independentHours(cs),ib=independentHours(btc),ir=independentHours(rawBtc);equal(hours,{hype:ih,btc:ib,rawBtc:ir});
  const hm=new Map(ih.map(x=>[x.at,x])),bm=new Map(ib.map(x=>[x.at,x])),rm=new Map(ir.map(x=>[x.at,x]));
  const cfg=read('bot-config.json');delete cfg.aggressive10;const highs=rawHighs(cs,2),rows:R[]=read(`${out}/results.json`),verified:R[]=[];assert.equal(rows.length,8);
  let sourceChecks=0,outcomeChecks=0,minutes=0,fills=0,windowChecks=0,targets=0,highChecks=0;
  for(const x of rows){const get=(s:string)=>read(`${out}/${x.name}-${s}.json`),raw=get('engine'),events:R[]=get('events');assert.equal(sha(JSON.stringify(raw)),x.digest);
    const old=read(`${d.archive}/output/results.json`).find((a:R)=>a.name===x.name);assert(old);assert.equal(x.digest,old.digest);assert.deepEqual(x.metrics,old.metrics);
    assert.deepEqual(events.map(e=>e.event),raw.executionAudit.events);const w=get('window'),prices=x.waiting?auditWindow(x,w,cs,events):new Map<number,number|null>();
    if(!x.waiting)assert.deepEqual(w,{events:[],intents:[],checks:[]});windowChecks+=w.checks.length;
    const accounting=auditFlowLedger(cs,events as any,get('attempts'),x.metrics,x.startIdx,x.endIdx,prices);
    targets+=auditAgeHighTargets(cs,events as any,get('targets'),get('tp-observations'),{...x,control:false,policy:{id:'baseline',family:'age'},sensitivity:{sourceLagMs:0,releaseDelayMs:0}}, {},cfg,{}).checks;
    highChecks+=auditAgeHighExits(cs,events as any,{...x,lag:0},get('high-reductions'),highs);
    const sources:R[]=get('features'),labels:R[]=get('labels'),decisions:R[]=get('decisions');assert.equal(sources.length,labels.length);
    assert.equal(sources.length,x.waiting?w.intents.length:decisions.filter(a=>a.nextDepth===1||a.nextDepth>=8).length);
    const seen=new Set<number>();for(let i=0;i<sources.length;i++){const s=sources[i],l=labels[i],a=s.decision;assert.equal(s.id,l.id);assert.equal(a.at,cs[a.index].endTs);near(a.price,cs[a.index].close);
      assert(!('intent' in a),'Future intent lifecycle cannot be in source decision');
      const intent=w.intents.find((t:R)=>t.signalAt===a.at&&t.episode===a.episode)??null;
      assert.deepEqual(l.intentOutcome,x.waiting?intent:null);
      const knownKeys=['signalAt','index','episode','nextDepth','reference','cap','expiresAt','activeAt','retryAt'];
      assert.deepEqual(s.intentAtDecision,intent&&x.waiting?Object.fromEntries(knownKeys.map(k=>[k,intent[k]])):null);
      assert.deepEqual(Object.keys(s).sort(),['id','scope','firstDeep','entryAt','decision','intentAtDecision','features'].sort());
      assert(decisions.some(q=>q.at===a.at&&q.episode===a.episode&&q.nextDepth===a.nextDepth));
      assert.equal(s.scope,x.waiting?'waiting_intent':a.nextDepth===1?'first_entry':a.priceDropOk?'deep_drop':'deep_timer');
      assert.equal(s.firstDeep,s.scope==='deep_timer'&&!seen.has(a.episode));if(s.firstDeep)seen.add(a.episode);
      const first=events.find(e=>e.episode===a.episode&&e.event.kind==='open'&&!e.before.length);assert(first);assert.equal(s.entryAt,first.event.fillAt);
      for(const [quality,f] of Object.entries(s.features)){auditFeature(f as R,hm,quality.startsWith('raw')?rm:bm);sourceChecks++;}
      auditLabels(l.prices,cs,a.index,Date.parse(x.end));outcomeChecks++;
      assert.deepEqual(l.episode,x.metrics.episodes.find((e:R)=>Date.parse(e.entry)===s.entryAt)??null);
      const close=events.find(e=>e.episode===a.episode&&e.event.kind==='close')?.event;
      assert.deepEqual(l.baselineCloseWithin15m,close&&close.fillAt>=a.at&&close.fillAt<a.at+15*M?{at:close.fillAt,reason:close.reason}:null);
    }
    verified.push({name:x.name,accounting});fills+=events.length;minutes+=x.endIdx-x.startIdx;console.log(`[EQ01 verified] ${x.name}`);
  }
  const analysis=read(`${out}/analysis.json`);for(const c of analysis.cases)for(const clock of ['raw_0','raw_60000','repaired_0','repaired_60000']){
    const g=c.groups.filter((g:R)=>g.population==='first_deep_timer'&&g.clock===clock),all=g.find((g:R)=>g.key==='all');if(!all)continue;
    assert.equal(all.n,all.episodes);for(const category of ['fixedExtension','scaledExtension','nearHigh','structure','btcDirection','relative','btcDip1h','btcRise1h','joint']){
      const gs=g.filter((g:R)=>g.key===category);for(const field of ['n','wins','losses','winDollars','lossDollars','matchedDelta','removedBaselineNet','capAvailable','noCapButUp05'])near(gs.reduce((n:number,x:R)=>n+x[field],0),all[field]);}}
  assert.equal(read(`${out}/control-parity.json`).cases.length,8);await verifyPins(process.cwd(),pins);assert(!fs.existsSync(`${dir}/verification.json`));
  const result={passed:true,cases:8,exactControls:8,sourceChecks,outcomeChecks,fills,minutes,windowChecks,targets,highChecks,btcRepairIndependent:true,
    accounting:verified,checkerSha256:sha(fs.readFileSync(__filename)),liveChanges:0};atomicJson(`${dir}/verification.json`,result);
  console.log(JSON.stringify({...result,accounting:undefined}));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
