/** Bounded public candle/clock capture; no credentials or trading imports. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const [root,mode,label='once']=process.argv.slice(2);
assert(root?.startsWith('backtests/tradingview-minute-verification/'));
assert(['history','poll','reference','clock'].includes(mode));
assert(/^[\w-]+$/.test(label));
const plan=JSON.parse(fs.readFileSync(path.join(root,'plan.json'),'utf8'));
const folder=path.join(root,'native',mode,label);
fs.mkdirSync(folder,{recursive:true});
const safe=s=>s.replace(/[^a-zA-Z0-9]/g,'_');
const url=(s,p)=>s+'?'+new URLSearchParams(p);
const sha=b=>createHash('sha256').update(b).digest('hex');
async function capture(symbol,page,address,body) {
  const file=path.join(folder,`${safe(symbol)}_${page}.json`);
  assert(!fs.existsSync(file),'Refusing to overwrite saved response');
  const r={symbol,page,url:address,method:body?'POST':'GET',requestBody:body??null,requestedAtMs:Date.now()};
  const start=performance.now();
  try {
    const res=await fetch(address,{method:r.method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
    r.status=res.status;r.headers={date:res.headers.get('date'),age:res.headers.get('age'),cacheControl:res.headers.get('cache-control')};
    r.rawText=await res.text();
    assert(r.rawText.length<3000000,'Oversized response');
    r.data=JSON.parse(r.rawText);
    if(!res.ok) r.error=`HTTP ${res.status}`;
  }catch(e){r.error=e.message;r.rawText??='';}
  r.observedAtMs=Date.now();r.elapsedMonotonicMs=performance.now()-start;r.rawSha256=sha(r.rawText);
  fs.writeFileSync(file,JSON.stringify(r),{flag:'wx'});
  return {symbol,page,status:r.status,error:r.error??null,requestedAtMs:r.requestedAtMs,observedAtMs:r.observedAtMs};
}
let out;
if(mode==='clock') {
  out=await Promise.all([
    capture('BYBIT',0,'https://api.bybit.com/v5/market/time'),
    capture('BINANCE',0,'https://fapi.binance.com/fapi/v1/time'),
  ]);
}else {
  const now=Date.now(), end=mode==='history'?plan.historyEndExclusiveMs:now+1;
  const start=mode==='history'?end-plan.historyMinutes*60000:Math.floor(now/60000)*60000-39*60000;
  out=await Promise.all(plan.symbols.map(async symbol=>{
    const pages=[];
    // Fixed disjoint ranges; incomplete returned coverage is never silently filled.
    for(let from=start,page=0;from<end;from+=1000*60000,page++) {
      const to=Math.min(end,from+1000*60000)-1;
      if(symbol.startsWith('BYBIT:')) pages.push(await capture(symbol,page,url('https://api.bybit.com/v5/market/kline',{category:'linear',symbol:'HYPEUSDT',interval:'1',start:String(from),end:String(to),limit:'1000'})));
      else if(symbol.startsWith('BINANCE:')) pages.push(await capture(symbol,page,url('https://fapi.binance.com/fapi/v1/klines',{symbol:'HYPEUSDT',interval:'1m',startTime:String(from),endTime:String(to),limit:'1000'})));
      else if(symbol.startsWith('HYPERLIQUID:')) pages.push(await capture(symbol,page,'https://api.hyperliquid.xyz/info',{type:'candleSnapshot',req:{coin:'HYPE',interval:'1m',startTime:from,endTime:to}}));
      else throw Error('Unplanned symbol');
    }
    return pages;
  }));
}
console.log(JSON.stringify({mode,label,responses:out.flat()}));
