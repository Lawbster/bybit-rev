/** Public, research-only source evidence. Never loads .env or production modules. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = process.argv[2];
assert(root && root.startsWith('backtests/tradingview-volume-verification/'));
const plan = JSON.parse(fs.readFileSync(path.join(root, 'plan.json'), 'utf8'));
const end = plan.comparisonEndExclusiveMs;
const start = end - plan.comparisonHours * 3600000;
const iso = t => new Date(t).toISOString();
const dest = path.join(root, 'native');
fs.mkdirSync(dest, { recursive: true });
const id = s => s.replace(/[^a-zA-Z0-9]/g, '_');
const sha = s => createHash('sha256').update(s).digest('hex');
const url = (base, params) => base + '?' + new URLSearchParams(Object.entries(params).map(([k,v]) => [k,String(v)]));

async function get(label, address, body) {
  const file = path.join(dest, id(label) + '.json');
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.url, address, 'Cannot reuse another request');
    assert.deepEqual(saved.requestBody, body ?? null);
    assert.equal(sha(saved.rawText), saved.rawSha256);
    return saved;
  }
  const record = { url: address, method: body ? 'POST' : 'GET', requestBody: body ?? null, requestedAtMs: Date.now() };
  try {
    const res = await fetch(address, {
      method: record.method, headers: { 'Content-Type': 'application/json', 'User-Agent': 'HYPE-research-source-audit/1.0' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    record.status = res.status;
    record.rawText = await res.text();
    assert(record.rawText.length <= 12000000, 'Unexpectedly large public response');
    try { record.data = JSON.parse(record.rawText); } catch { record.error = 'Response is not JSON'; }
    if (!res.ok) record.error = `HTTP ${res.status}`;
  } catch (e) { record.error = e.message; record.rawText ??= ''; }
  record.observedAtMs = Date.now();
  record.rawSha256 = sha(record.rawText);
  fs.writeFileSync(file, JSON.stringify(record), { flag: 'wx' });
  console.log(JSON.stringify({ label, status: record.status, error: record.error ?? null, bytes: record.rawText.length }));
  return record;
}

const jobs = [];
function job(label, address, body) { jobs.push(() => get(label, address, body)); }
for (const category of ['linear','spot']) {
  const s = category === 'linear' ? 'BYBIT:HYPEUSDT.P' : 'BYBIT:HYPEUSDT';
  job(s + '_meta', url('https://api.bybit.com/v5/market/instruments-info',{category,symbol:'HYPEUSDT'}));
  job(s + '_1h', url('https://api.bybit.com/v5/market/kline',{category,symbol:'HYPEUSDT',interval:'60',start,end:end-1,limit:100}));
}
job('BINANCE:HYPEUSDT.P_meta','https://fapi.binance.com/fapi/v1/exchangeInfo');
job('BINANCE:HYPEUSDT.P_1h',url('https://fapi.binance.com/fapi/v1/klines',{symbol:'HYPEUSDT',interval:'1h',startTime:start,endTime:end-1,limit:100}));
job('HYPERLIQUID:HYPEUSDC.P_meta','https://api.hyperliquid.xyz/info',{type:'meta'});
job('HYPERLIQUID:HYPEUSDC.P_1h','https://api.hyperliquid.xyz/info',{type:'candleSnapshot',req:{coin:'HYPE',interval:'1h',startTime:start,endTime:end-1}});
jobs.push(async () => {
  const meta = await get('HYPERLIQUID:HYPEUSDC_meta','https://api.hyperliquid.xyz/info',{type:'spotMeta'});
  const tokens = new Map(meta.data?.tokens?.map(t => [t.index, t]));
  const u = meta.data?.universe?.find(p => tokens.get(p.tokens[0])?.name === 'HYPE' && tokens.get(p.tokens[1])?.name === 'USDC');
  if (!u) { console.log('HL spot identity unresolved'); return; }
  await get('HYPERLIQUID:HYPEUSDC_1h','https://api.hyperliquid.xyz/info',{type:'candleSnapshot',req:{coin:'@'+u.index,interval:'1h',startTime:start,endTime:end-1}});
});
for (const kind of ['SWAP','SPOT']) {
  const instId = kind === 'SWAP' ? 'HYPE-USDT-SWAP' : 'HYPE-USDT';
  const s = kind === 'SWAP' ? 'OKX:HYPEUSDT.P' : 'OKX:HYPEUSDT';
  job(s + '_meta',url('https://www.okx.com/api/v5/public/instruments',{instType:kind,instId}));
  job(s + '_1h',url('https://www.okx.com/api/v5/market/candles',{instId,bar:'1H',limit:100,after:end}));
}
job('BITGET:HYPEUSDT.P_meta',url('https://api.bitget.com/api/v2/mix/market/contracts',{productType:'USDT-FUTURES',symbol:'HYPEUSDT'}));
job('BITGET:HYPEUSDT.P_1h',url('https://api.bitget.com/api/v2/mix/market/candles',{symbol:'HYPEUSDT',productType:'USDT-FUTURES',granularity:'1H',startTime:start,endTime:end-1,limit:100}));
job('BITGET:HYPEUSDT_meta',url('https://api.bitget.com/api/v2/spot/public/symbols',{symbol:'HYPEUSDT'}));
job('BITGET:HYPEUSDT_1h',url('https://api.bitget.com/api/v2/spot/market/candles',{symbol:'HYPEUSDT',granularity:'1h',startTime:start,endTime:end-1,limit:100}));
job('MEXC:HYPEUSDT.P_meta',url('https://contract.mexc.com/api/v1/contract/detail',{symbol:'HYPE_USDT'}));
job('MEXC:HYPEUSDT.P_1h',url('https://contract.mexc.com/api/v1/contract/kline/HYPE_USDT',{interval:'Min60',start:start/1000,end:end/1000-1}));
job('MEXC:HYPEUSDT_meta',url('https://api.mexc.com/api/v3/exchangeInfo',{symbol:'HYPEUSDT'}));
job('MEXC:HYPEUSDT_1h',url('https://api.mexc.com/api/v3/klines',{symbol:'HYPEUSDT',interval:'60m',startTime:start,endTime:end-1,limit:100}));
job('GATE:HYPEUSDT_meta','https://api.gateio.ws/api/v4/spot/currency_pairs/HYPE_USDT');
job('GATE:HYPEUSDT_1h',url('https://api.gateio.ws/api/v4/spot/candlesticks',{currency_pair:'HYPE_USDT',interval:'1h',from:start/1000,to:end/1000-1}));
job('KUCOIN:HYPEUSDT_meta','https://api.kucoin.com/api/v2/symbols/HYPE-USDT');
job('KUCOIN:HYPEUSDT_1h',url('https://api.kucoin.com/api/v1/market/candles',{symbol:'HYPE-USDT',type:'1hour',startAt:start/1000,endAt:end/1000-1}));
job('COINBASE:HYPEUSD_meta','https://api.exchange.coinbase.com/products/HYPE-USD');
job('COINBASE:HYPEUSD_1h',url('https://api.exchange.coinbase.com/products/HYPE-USD/candles',{granularity:3600,start:iso(start),end:iso(end)}));
job('KRAKEN:HYPEUSD.PM_meta','https://futures.kraken.com/derivatives/api/v3/instruments');
job('KRAKEN:HYPEUSD.PM_1h',url('https://futures.kraken.com/api/charts/v1/trade/PF_HYPEUSD/1h',{from:start/1000,to:end/1000-1}));
let next = 0;
await Promise.all(Array.from({length:3},async()=>{while(next < jobs.length) await jobs[next++]();}));
console.log(`Public source capture complete: ${dest}. Saved responses are reused, never overwritten.`);
