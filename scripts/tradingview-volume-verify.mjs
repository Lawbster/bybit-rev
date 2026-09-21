/** Offline source audit. Does not import trading code, read credentials or call APIs. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const HOUR = 3600000, DAY = 86400000;
const id = s => s.replace(/[^a-zA-Z0-9]/g, '_');
const iso = ms => ms == null ? null : new Date(ms).toISOString();
const sha = b => createHash('sha256').update(b).digest('hex');
const number = v => { assert(v !== null && v !== undefined && v !== '', 'Missing numeric field'); const n=Number(v); assert(Number.isFinite(n), 'Invalid number'); return n; };
const bar = (t,o,h,l,c,base,quote,contracts) => ({tMs:number(t),o:number(o),h:number(h),l:number(l),c:number(c),base:number(base),quote:quote==null?null:number(quote),contracts:contracts==null?null:number(contracts)});

export function nativeBars(symbol, d, meta) {
  const perp = /\.P(?:M)?$/.test(symbol);
  if (symbol.startsWith('BYBIT:')) { assert.equal(d.retCode,0); return d.result.list.map(r=>bar(...r)); }
  if (symbol.startsWith('BINANCE:') || symbol === 'MEXC:HYPEUSDT') return d.map(r=>bar(r[0],r[1],r[2],r[3],r[4],r[5],r[7]));
  if (symbol.startsWith('HYPERLIQUID:')) return d.map(r=>bar(r.t,r.o,r.h,r.l,r.c,r.v));
  if (symbol.startsWith('OKX:')) { assert.equal(d.code,'0'); return d.data.map(r=>{assert.equal(r[8],'1','Unconfirmed native OKX candle'); return bar(r[0],r[1],r[2],r[3],r[4],perp?r[6]:r[5],r[7],perp?r[5]:null);}); }
  if (symbol.startsWith('BITGET:')) { assert.equal(d.code,'00000'); return d.data.map(r=>bar(r[0],r[1],r[2],r[3],r[4],r[5],r[6])); }
  if (symbol === 'MEXC:HYPEUSDT.P') { assert.equal(d.success,true); const a=d.data; return a.time.map((t,i)=>bar(t*1000,a.open[i],a.high[i],a.low[i],a.close[i],number(a.vol[i])*number(meta.data.contractSize),a.amount[i],a.vol[i])); }
  if (symbol.startsWith('GATE:')) return d.map(r=>{assert.equal(r[7],'true');return bar(r[0]*1000,r[5],r[3],r[4],r[2],r[6],r[1]);});
  if (symbol.startsWith('KUCOIN:')) { assert.equal(d.code,'200000'); return d.data.map(r=>bar(r[0]*1000,r[1],r[3],r[4],r[2],r[5],r[6])); }
  if (symbol.startsWith('COINBASE:')) return d.map(r=>bar(r[0]*1000,r[3],r[2],r[1],r[4],r[5]));
  if (symbol.startsWith('KRAKEN:')) {
    const m=meta.instruments.find(x=>x.symbol==='PF_HYPEUSD'); assert.equal(m.contractSize,1);
    return d.candles.map(r=>bar(r.time,r.open,r.high,r.low,r.close,number(r.volume)*m.contractSize,null,r.volume));
  }
  throw Error('Unknown symbol');
}

export function instrument(symbol, d) {
  let m,base,quote,multiplier=null;
  const market=/\.P(?:M)?$/.test(symbol)?'perpetual':'spot';
  if(symbol.startsWith('BYBIT:')) { assert.equal(d.retCode,0); m=d.result.list.find(x=>x.symbol==='HYPEUSDT'); base=m.baseCoin;quote=m.quoteCoin;assert.equal(d.result.category,market==='spot'?'spot':'linear'); }
  else if(symbol.startsWith('BINANCE:') || symbol==='MEXC:HYPEUSDT') {m=d.symbols.find(x=>x.symbol==='HYPEUSDT');base=m.baseAsset;quote=m.quoteAsset;}
  else if(symbol.startsWith('HYPERLIQUID:')) {
    if(market==='perpetual') {m=d.universe.find(x=>x.name==='HYPE');assert(m);base=m.name;quote='USDC';}
    else {const tokens=new Map(d.tokens.map(x=>[x.index,x]));m=d.universe.find(x=>tokens.get(x.tokens[0])?.name==='HYPE'&&tokens.get(x.tokens[1])?.name==='USDC');assert(m);base=tokens.get(m.tokens[0]).name;quote=tokens.get(m.tokens[1]).name;}
  }
  else if(symbol.startsWith('OKX:')) {assert.equal(d.code,'0');m=d.data.find(x=>x.instId===(market==='spot'?'HYPE-USDT':'HYPE-USDT-SWAP'));assert(m);base=market==='spot'?m.baseCcy:m.ctValCcy;quote=market==='spot'?m.quoteCcy:m.settleCcy;if(market==='perpetual'){assert.equal(m.ctType,'linear');multiplier=number(m.ctVal)*number(m.ctMult);} }
  else if(symbol.startsWith('BITGET:')) {assert.equal(d.code,'00000');m=d.data.find(x=>x.symbol==='HYPEUSDT');base=m.baseCoin;quote=m.quoteCoin;}
  else if(symbol==='MEXC:HYPEUSDT.P') {assert.equal(d.success,true);m=d.data;assert.equal(m.symbol,'HYPE_USDT');base=m.baseCoin;quote=m.quoteCoin;multiplier=number(m.contractSize);}
  else if(symbol.startsWith('GATE:')) {m=d;assert.equal(m.id,'HYPE_USDT');base=m.base;quote=m.quote;}
  else if(symbol.startsWith('KUCOIN:')) {m=d.data;assert.equal(m.symbol,'HYPE-USDT');base=m.baseCurrency;quote=m.quoteCurrency;}
  else if(symbol.startsWith('COINBASE:')) {m=d;assert.equal(m.id,'HYPE-USD');base=m.base_currency;quote=m.quote_currency;}
  else if(symbol.startsWith('KRAKEN:')) {m=d.instruments.find(x=>x.symbol==='PF_HYPEUSD');base=m.base;quote=m.quote;multiplier=number(m.contractSize);}
  assert.equal(base,'HYPE');assert(['USD','USDC','USDT'].includes(quote));
  return {symbol,market,base,quote,contractBaseMultiplier:multiplier,nativeMetadata:m};
}

export function tvBars(record) {
  assert.equal(record.result.success,true);assert(Array.isArray(record.result.bars));
  assert.equal(record.result.symbol,record.request.symbol);
  assert.equal(record.result.count,record.result.bars.length);
  return record.result.bars.map(r=>{
    const tMs=number(r.t)*1000;
    assert(Number.isSafeInteger(tMs) && tMs>=Date.UTC(2020,0,1)&&tMs<Date.UTC(2100,0,1),'Timestamp unit/range');
    return {tMs,o:number(r.o),h:number(r.h),l:number(r.l),c:number(r.c),v:number(r.v)};
  });
}

export function coverage(rows, intervalMs, observedAtMs) {
  const times=rows.map(r=>r.tMs), unique=[...new Set(times)].sort((a,b)=>a-b);
  let missingIntervals=0;const gaps=[];
  for(let i=1;i<unique.length;i++) if(unique[i]-unique[i-1]>intervalMs) { const missing=(unique[i]-unique[i-1])/intervalMs-1;missingIntervals+=missing;gaps.push({afterMs:unique[i-1],beforeMs:unique[i],missing}); }
  return {bars:rows.length,firstMs:unique[0]??null,lastMs:unique.at(-1)??null,firstUtc:iso(unique[0]),lastUtc:iso(unique.at(-1)),duplicates:times.length-unique.length,outOfOrder:times.filter((t,i)=>i>0&&t<times[i-1]).length,misaligned:times.filter(t=>t%intervalMs!==0).length,invalidBars:rows.filter(r=>r.h<Math.max(r.o,r.c,r.l)||r.l>Math.min(r.o,r.c,r.h)||(r.v??r.base)<0||[r.o,r.h,r.l,r.c].some(p=>!(p>0))).length,unfinishedBars:rows.filter(r=>r.tMs+intervalMs>observedAtMs).length,missingIntervals,gaps};
}

export function compare(tv, native, plan) {
  const end=plan.comparisonEndExclusiveMs,start=end-plan.comparisonHours*HOUR;
  const within=r=>r.tMs>=start&&r.tMs<end;
  const a=tv.filter(within), b=native.filter(within);
  assert.equal(new Set(a.map(x=>x.tMs)).size,a.length,'Duplicate TV candle');assert.equal(new Set(b.map(x=>x.tMs)).size,b.length,'Duplicate native candle');
  const bm=new Map(b.map(r=>[r.tMs,r]));
  const keys=['base','quote','contracts'];
  const metrics=Object.fromEntries(keys.map(k=>[k,{compared:0,matched:0,maxRelativeError:0}]));
  let ohlcMatched=0;const detail=[];
  for(const t of a){const n=bm.get(t.tMs);if(!n)continue;
    const priceError=Math.max(...['o','h','l','c'].map(k=>Math.abs(t[k]-n[k])));
    const ohlcOk=priceError<=plan.ohlcAbsoluteTolerance;if(ohlcOk)ohlcMatched++;
    const volumeMatches=[];
    for(const k of keys){if(n[k]==null)continue; const error=Math.abs(t.v-n[k])/Math.max(Math.abs(n[k]),1e-12);metrics[k].compared++;metrics[k].maxRelativeError=Math.max(metrics[k].maxRelativeError,error);if(error<=plan.volumeRelativeTolerance){metrics[k].matched++;volumeMatches.push(k);}}
    detail.push({tMs:t.tMs,tv:t,native:n,ohlcOk,maxPriceError:priceError,volumeMatches});
  }
  const matchedUnits=keys.filter(k=>metrics[k].compared===plan.comparisonHours && metrics[k].matched===plan.comparisonHours);
  return {expected:plan.comparisonHours,tvBars:a.length,nativeBars:b.length,overlap:detail.length,ohlcMatched,metrics,matchedUnits,samplePassed:detail.length===plan.comparisonHours&&ohlcMatched===plan.comparisonHours&&matchedUnits.length>0,detail};
}

export function run(root) {
  assert(root.startsWith('backtests/tradingview-volume-verification/'));
  const plan=JSON.parse(fs.readFileSync(path.join(root,'plan.json'),'utf8'));
  const read=(folder,name)=>{const r=JSON.parse(fs.readFileSync(path.join(root,folder,name+'.json'),'utf8'));if(folder==='native'){assert.equal(r.status,200);assert.equal(sha(r.rawText),r.rawSha256);assert.deepEqual(JSON.parse(r.rawText),r.data);}return r;};
  const results=[];
  for(const symbol of plan.symbols){
    const tv=read('tradingview',id(symbol)+'_1h'),daily=read('tradingview',id(symbol)+'_1D');
    const n=read('native',id(symbol)+'_1h'),meta=read('native',id(symbol)+'_meta');
    const identity=instrument(symbol,meta.data);
    const bars=tvBars(tv),native=nativeBars(symbol,n.data,meta.data);
    const hourly=coverage(bars,HOUR,tv.observedAtMs),day=coverage(tvBars(daily),DAY,daily.observedAtMs);
    const comp=compare(bars,native,plan);
    const shapeOk=[hourly,day].every(x=>!x.duplicates&&!x.outOfOrder&&!x.misaligned&&!x.invalidBars);
    const result={symbol,identity,hourly,daily:day,comparison:comp,shapeOk,samplePassed:shapeOk&&comp.samplePassed,observedAtMs:tv.observedAtMs,notice:tv.result.notice};
    results.push(result);
    console.log(JSON.stringify({symbol,pass:result.samplePassed,units:comp.matchedUnits,overlap:comp.overlap,ohlcMatched:comp.ohlcMatched,volumeMatches:Object.fromEntries(Object.entries(comp.metrics).map(([k,v])=>[k,v.matched])),dailyFirst:day.firstUtc,dailyBars:day.bars,dailyGaps:day.missingIntervals}));
  }
  const payload={version:1,plan,verifiedAtMs:Date.now(),results,qualification:'Recent sample verification only; no historical receipt-time, whole-history units or live latency certification. No strategy results.'};
  const file=path.join(root,'verification.json');fs.writeFileSync(file,JSON.stringify(payload,null,2),{flag:'wx'});
  const files=[];for(const folder of ['tradingview','native']) for(const file of fs.readdirSync(path.join(root,folder)).sort()){const p=path.join(folder,file);const bytes=fs.readFileSync(path.join(root,p));files.push({path:p,bytes:bytes.length,sha256:sha(bytes)});}
  for(const p of ['plan.json','verification.json']){const bytes=fs.readFileSync(path.join(root,p));files.push({path:p,bytes:bytes.length,sha256:sha(bytes)});}
  fs.writeFileSync(path.join(root,'receipt.json'),JSON.stringify({files,codeSha256:sha(fs.readFileSync(new URL(import.meta.url)))},null,2),{flag:'wx'});
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) run(process.argv[2]);
