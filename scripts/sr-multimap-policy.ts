import fs from 'fs';import assert from 'assert/strict';
import {ReplaySrContext} from './replay-sr-context';
import {SRMemoryZoneEngine,type SRMemoryZoneConfig,type SRMemoryZoneLevel,type SRMemoryZoneHit} from '../src/bot/sr-memory-zones';
import type {Candle} from './hype-freerun-canonical-replay';
import type {CandleCoverageStatus} from '../src/bot/context-manager';
import {loadHistoricalMajorMap,type MajorMap,type HistoricalMajorMap} from './major-sr-history-map';
import type {ResearchTpTarget} from './replay-causal-engine';
import {spaced} from './resistance-tp-opportunity';
import readline from 'readline';

export type R=Record<string,any>;
export const MAPS=['local14d','major4h','major1d','local14d_major4h','local14d_major1d','all3'] as const;
export type MapSet=typeof MAPS[number];
export type Source='local14d'|'major4h'|'major1d';
export type Strategy='partial'|'partial_buffer'|'none';
export const MEMBERS:Record<MapSet,Source[]>={local14d:['local14d'],major4h:['major4h'],major1d:['major1d'],local14d_major4h:['local14d','major4h'],local14d_major1d:['local14d','major1d'],all3:['local14d','major4h','major1d']};
export type Level=SRMemoryZoneLevel&{source:Source;zoneId:string;role:'relative'|'support'|'resistance';sourceAt:number};
export type Hit=SRMemoryZoneHit&{lv:Level};
type LocalFrame={at:number;levels:SRMemoryZoneLevel[]};
const last=<T>(xs:T[],at:number,key:(x:T)=>number)=>{let l=0,h=xs.length;while(l<h){const m=(l+h)>>>1;if(key(xs[m])<=at)l=m+1;else h=m;}return xs[l-1];};

/** Build once, persist once, then reuse in every strategy. Extra seeds preserve
 * the exact initial off-boundary rebuild of the canonical replay. */
export class LocalTape {
  readonly frames:LocalFrame[]=[];readonly seeds=new Map<number,LocalFrame>();
  readonly first5m:number;readonly end:number;
  static async load(file:string):Promise<LocalTape>{
    const o=Object.create(LocalTape.prototype) as LocalTape;
    Object.assign(o,{frames:[],seeds:new Map()});
    for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})){
      if(!line)continue;const r=JSON.parse(line);
      if(r.kind==='header')Object.assign(o,{cfg:r.cfg,first5m:r.first5m,end:r.end});
      else if(r.kind==='frame')o.frames.push({at:r.at,levels:r.levels});
      else if(r.kind==='seed')o.seeds.set(r.at,{at:r.at,levels:r.levels});else throw Error('Bad cache row');
    }
    assert(o.cfg&&o.frames.length);return o;
  }
  constructor(cs:Candle[],readonly cfg:SRMemoryZoneConfig,starts:number[],file?:string){
    this.first5m=Math.ceil(cs[0].ts/300000)*300000;this.end=cs.at(-1)!.endTs;
    const ctx=new ReplaySrContext(cs,cfg),tf=cfg.tfMin*60000;
    const fd=file?fs.openSync(file,'wx'):null;
    const write=(x:unknown)=>{if(fd!==null)fs.writeSync(fd,JSON.stringify(x)+'\n');};
    try{
      write({kind:'header',cfg,first5m:this.first5m,end:this.end});
      for(let at=Math.ceil(cs[0].endTs/tf)*tf;at<=this.end;at+=tf){
        const f={at,levels:ctx.at(at).engine.getZones(at)};this.frames.push(f);write({kind:'frame',...f});
      }
      for(const at of [...new Set(starts)].sort((a,b)=>a-b))if(at%tf){
        const seeded=new ReplaySrContext(cs,cfg),f={at,levels:seeded.at(at).engine.getZones(at)};
        this.seeds.set(at,f);write({kind:'seed',...f});
      }
    }finally{if(fd!==null)fs.closeSync(fd);}
  }
  at(now:number,start:number){
    assert(now>=start&&now<=this.end);const tf=this.cfg.tfMin*60000;
    const f=Math.floor(now/tf)===Math.floor(start/tf)&&this.seeds.has(start)?this.seeds.get(start)!:last(this.frames,now,x=>x.at);
    const latestClosedTs=Math.floor(now/300000)*300000-300000,expectedBars=Math.ceil(this.cfg.recentDays*86400000/300000);
    const actualContinuousBars=Math.max(0,Math.min(expectedBars,Math.floor((latestClosedTs-this.first5m)/300000)+1));
    const coverage:CandleCoverageStatus={healthy:actualContinuousBars>=expectedBars,horizonStart:latestClosedTs-(expectedBars-1)*300000,
      latestClosedTs,earliestContinuousTs:actualContinuousBars?latestClosedTs-(actualContinuousBars-1)*300000:null,expectedBars,actualContinuousBars};
    return {levels:f?.levels??[],at:f?.at??null,coverage};
  }
}

export class MacroTape {
  readonly reader:HistoricalMajorMap;readonly map:MajorMap;private lastAt=-Infinity;private saved:{healthy:boolean;levels:Level[]}|null=null;
  private catalog:Map<string,MajorMap['levels'][number]>;
  constructor(readonly source:'major4h'|'major1d',key:string){
    const dir=`backtests/research-workflow/${key}`;this.reader=loadHistoricalMajorMap(dir,key);
    this.map=JSON.parse(fs.readFileSync(`${dir}/output/map.json`,'utf8'));this.catalog=new Map(this.map.levels.map(z=>[z.id,z]));
  }
  at(now:number){
    const boundary=Math.floor(now/(this.map.spec.minutes*60000))*this.map.spec.minutes*60000;
    if(boundary===this.lastAt)return this.saved!;
    const q=this.reader.at(now);this.lastAt=boundary;
    const levels:Level[]=q.levels.map(z=>{
      const known=this.catalog.get(z.id)!.touches.filter(t=>t.knownAt<=q.sourceAt!&&t.knownAt>=q.sourceAt!-this.map.memoryDays*86400000);
      assert.equal(known.length,z.touches);assert(known.every(t=>t.knownAt<=now));
      const touchData=known.map(t=>({ts:t.knownAt,price:t.price,side:t.side}));
      return{source:this.source,zoneId:z.id,role:z.role,sourceAt:q.sourceAt!,price:z.center,confirmTs:z.qualifiedAt,touches:known.length,
        highTouches:known.filter(t=>t.side==='resistance').length,lowTouches:known.filter(t=>t.side==='support').length,touchData};
    });
    return this.saved={healthy:q.healthy,levels};
  }
}

export function nearest(levels:readonly Level[],price:number,side:'support'|'resistance',bufferPct:number):Hit|null {
  let best:Hit|null=null;
  for(const lv of levels){
    if(lv.role!=='relative'&&lv.role!==side)continue;
    if(side==='resistance'?lv.price<=price:lv.price>=price)continue;
    const dist=(side==='resistance'?lv.price-price:price-lv.price)/price;
    if(dist<=bufferPct/100&&(!best||dist<best.dist))best={lv,dist};
  }
  return best;
}
class SavedEngine extends SRMemoryZoneEngine {
  constructor(cfg:SRMemoryZoneConfig,readonly owner:MultiContext){super(cfg);}
  override getZones(_at:number){return this.owner.levels;}
  override countZones(_at:number){return this.owner.levels.length;}
  override nearestResistance(_at:number,price:number){return nearest(this.owner.levels,price,'resistance',this.owner.cfg.bufferPct);}
  override nearestSupport(_at:number,price:number){return nearest(this.owner.levels,price,'support',this.owner.cfg.bufferPct);}
}
export class MultiContext {
  readonly engine:SRMemoryZoneEngine;levels:Level[]=[];private atTime=-Infinity;private coverage!:CandleCoverageStatus;
  readonly sources:Source[];readonly stats:R={minutes:0,healthy:{},unhealthy:{}};
  constructor(readonly set:MapSet,readonly lag:number,readonly start:number,readonly cfg:SRMemoryZoneConfig,readonly local:LocalTape,readonly macro:Record<'major4h'|'major1d',MacroTape>){this.sources=MEMBERS[set];this.engine=new SavedEngine(cfg,this);}
  at(now:number){
    if(now===this.atTime)return {engine:this.engine,coverage:this.coverage};
    assert(now>this.atTime);this.atTime=now;this.stats.minutes++;const sourceAt=now-this.lag;this.levels=[];
    let coverage:CandleCoverageStatus|null=null,healthy=false;
    for(const source of this.sources){
      if(source==='local14d'){
        const q=this.local.at(sourceAt,this.start-this.lag);coverage=q.coverage;healthy ||=q.coverage.healthy;
        this.stats[q.coverage.healthy?'healthy':'unhealthy'][source]=(this.stats[q.coverage.healthy?'healthy':'unhealthy'][source]??0)+1;
        if(q.coverage.healthy)for(const z of q.levels)this.levels.push({...z,source,zoneId:`local:${q.at}:${z.price}`,role:'relative',sourceAt:q.at!});
      }else{
        const q=this.macro[source].at(sourceAt);healthy ||=q.healthy;
        this.stats[q.healthy?'healthy':'unhealthy'][source]=(this.stats[q.healthy?'healthy':'unhealthy'][source]??0)+1;
        if(q.healthy)this.levels.push(...q.levels);
      }
    }
    this.coverage=coverage?{...coverage,healthy}:{healthy,horizonStart:sourceAt-120*86400000,latestClosedTs:sourceAt,earliestContinuousTs:null,expectedBars:1,actualContinuousBars:healthy?1:0};
    return{engine:this.engine,coverage:this.coverage};
  }
  hits(now:number,price:number){this.at(now);return this.sources.map(source=>nearest(this.levels.filter(z=>z.source===source),price,'resistance',this.cfg.bufferPct)).filter((h):h is Hit=>!!h);}
}
export class MultiShade {
  readonly selected:R[]=[];readonly counts:R={checks:0,selected:0,immediate:0};
  constructor(readonly context:MultiContext){}
  readonly decide=(d:Readonly<ResearchTpTarget>)=>{
    assert.equal(d.pct,1.4);this.counts.checks++;
    const hits=this.context.hits(d.at,d.price),eligible=hits.filter(h=>h.lv.price>=d.avgEntry*1.01&&h.lv.price<d.normalTarget&&spaced(h.lv.touchData).length>=3);
    eligible.sort((a,b)=>a.dist-b.dist);const hit=eligible[0];if(!hit)return null;
    const target=Math.max(d.avgEntry*1.01,hit.lv.price*.997);this.counts.selected++;if(target<=d.price)this.counts.immediate++;
    this.selected.push({...d,sourceAt:d.at-this.context.lag,source:hit.lv.source,zoneId:hit.lv.zoneId,levelSourceAt:hit.lv.sourceAt,
      resistance:hit.lv.price,touches:hit.lv.touchData,spaced:spaced(hit.lv.touchData),selectedPrice:target,immediate:target<=d.price,qualifyingSources:eligible.map(h=>h.lv.source)});
    return target;
  };
}
