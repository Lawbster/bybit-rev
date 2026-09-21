/** Supplemental, read-only data parity against the canonical candle loader. */
import fs from "fs";
import assert from "assert/strict";
import {loadMinutes}from "./relative-reversion-study";
import {loadCandles1m}from "./hype-freerun-canonical-replay";
import {atomicJson,verifyPins,sha,fileHash}from "./research-workflow";
async function main(){
  const key=process.argv[2];assert(/^[a-f0-9]{64}$/.test(key));const dir=`backtests/research-workflow/${key}`;
  const plan=JSON.parse(fs.readFileSync(`${dir}/plan.json`,"utf8")),d=plan.card.definition;
  await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins]);const cases=[];
  for(const symbol of ["HYPEUSDT","BTCUSDT"]){
    const repair=symbol==="HYPEUSDT"?d.repair:undefined;
    const strict=(await loadMinutes(process.cwd(),symbol,Date.parse(d.cutoff),repair)).candles;
    const canonical=await loadCandles1m(symbol,"data",Date.parse(d.cutoff),repair);
    assert.equal(strict.length,canonical.length);
    strict.forEach((c,i)=>assert.deepEqual(c,canonical[i],`canonical candle ${symbol} ${c.ts}`));
    const row={symbol,candles:strict.length,sha256:sha(JSON.stringify(strict))};cases.push(row);console.log(row);
  }
  await verifyPins(process.cwd(),[...plan.pins,...plan.protectedPins]);assert(!fs.existsSync(`${dir}/loader-parity.json`));
  atomicJson(`${dir}/loader-parity.json`,{passed:true,cases,checkerSha256:await fileHash("scripts/btc-hype-threshold-loader-check.ts")});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
