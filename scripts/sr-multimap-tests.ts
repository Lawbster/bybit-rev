import assert from 'assert/strict';import fs from 'fs';import os from 'os';import path from 'path';
import {LocalTape,MultiContext,MultiShade,nearest,type Level} from './sr-multimap-policy';
import {ReplaySrContext} from './replay-sr-context';
import type {Candle} from './hype-freerun-canonical-replay';
const T=Date.parse('2026-01-01T00:00:00Z'),cfg={enabled:true,tfMin:30,pivotLeft:4,pivotRight:4,clusterPct:.0045,minTouches:2,bufferPct:1,recentDays:14};
const cs:Candle[]=Array.from({length:21*1440},(_,i)=>{const close=100+Math.sin(i/70)*2+Math.sin(i/300)*.5;return{ts:T+i*60000,endTs:T+(i+1)*60000,open:close,close,high:close+.1,low:close-.1,volume:1,turnover:1};});
async function main(){
 const start=T+20*86400000+43*60000,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sm01-cache-')),file=path.join(tmp,'local.jsonl');
 const local=new LocalTape(cs,cfg,[start,start-60000],file),loaded=await LocalTape.load(file);
 assert.deepEqual(loaded.frames,local.frames);assert.deepEqual(loaded.seeds,local.seeds);
 for(const lag of [0,60000]){const direct=new ReplaySrContext(cs,cfg),mixed=new MultiContext('local14d',lag,start,cfg,loaded,{} as any);
   for(let at=start;at<start+3*3600000;at+=60000){const d=direct.at(at-lag),q=mixed.at(at);
     assert.deepEqual(q.coverage,d.coverage);assert.deepEqual(q.engine.getZones(at).map(({source,zoneId,role,sourceAt,...z}:any)=>z),d.engine.getZones(at-lag));
     for(const price of [98.5,99,100,101])for(const side of ['nearestSupport','nearestResistance'] as const){const a=q.engine[side](at,price),b=d.engine[side](at-lag,price);assert.equal(a?.lv.price,b?.lv.price);assert.equal(a?.dist,b?.dist);}
   }
 }
 const lv=(source:'local14d'|'major4h'|'major1d',p:number,role:Level['role']='resistance',touches=3):Level=>({source,zoneId:source,sourceAt:T,role,price:p,confirmTs:T,touches,highTouches:touches,lowTouches:0,touchData:Array.from({length:touches},(_,i)=>({ts:T-(touches-i)*86400000,price:p,side:'resistance'}))});
 assert.equal(nearest([lv('major4h',100.2,'support')],100,'resistance',1),null,'No intraday role invention');
 assert.equal(nearest([lv('local14d',100.5,'relative'),lv('major4h',100.5)],100,'resistance',1)!.lv.source,'local14d');
 const hits=[{lv:lv('local14d',101.05,'relative',2),dist:.0005},{lv:lv('major4h',101.1),dist:.001}];
 const shade=new MultiShade({lag:0,hits:()=>hits} as any),decision={at:T,index:0,episode:1,depth:6,price:101,qty:1,avgEntry:100,oldestEntryTime:T-3600000,basePct:1.4,normalPct:1.4,normalTarget:101.4,pct:1.4,targetPrice:101.4,armedAt:T,armedIndex:0};
 assert.equal(shade.decide(decision),101);assert.equal(shade.selected[0].source,'major4h','Nonqualifying local hit must not mask qualified macro hit');
 const absent=new MultiShade({lag:0,hits:()=>[]} as any);assert.equal(absent.decide(decision),null);
 assert.throws(()=>shade.decide({...decision,pct:.5}));
 const original=fs.readFileSync('scripts/replay-causal-engine.ts','utf8').replace(/\r\n/g,'\n');
 const copy=fs.readFileSync('scripts/replay-causal-engine-sm01.ts','utf8').replace(/\r\n/g,'\n')
 .replace('/** SM01 research copy. Only addition: injectable saved S/R context; canonical/live engine unchanged. */','/** Current long policy, causal minute execution. Not an exchange/maker simulator. */')
 .replace('  researchSrContextFactory?: () => Pick<ReplaySrContext, "at">;\n','')
 .replace('const sr = opts.researchSrContextFactory ? opts.researchSrContextFactory() : config.srShadow','const sr = config.srShadow');
 assert.equal(copy.trimEnd(),original.trimEnd(),'Engine bridge must contain only declared context injection');
 console.log('SM01 tests passed: saved local prefix/cadence/lag/first-query parity, immutable macro roles, single-action OR source selection, no stale TP raise and exact two-site engine bridge.');
 fs.unlinkSync(file);fs.rmdirSync(tmp);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
