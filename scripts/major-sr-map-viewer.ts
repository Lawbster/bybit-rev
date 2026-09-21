/** Re-render verified cached maps only. Never load candles/rebuild S/R or edit accepted jobs. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import {loadHistoricalMajorMap,type MajorMap} from './major-sr-history-map';
import {renderMap} from './major-sr-history-render-v2';
import {withSortableRegister} from './major-sr-register-sort';
import {sha,atomicJson} from './research-workflow';

const sources=[
  {name:'map-4h',key:'403332547f4914c756b5332177035536f309c0d12b38d838d956d986c972042a'},
  {name:'map-1d',key:'500517407e413dfc0761b232e93bcc01ac6f3b64dc856fba098947a370216ef7'}
];
function main(){
  const out=path.resolve('backtests/major-sr-viewers');fs.mkdirSync(out,{recursive:true});
  const views=[];
  for(const source of sources){
    const dir=`backtests/research-workflow/${source.key}`,file=`${dir}/output/map.json`;
    loadHistoricalMajorMap(dir,source.key); // Refuse unverified or changed cache.
    const raw=fs.readFileSync(file),map=JSON.parse(raw.toString('utf8')) as MajorMap;
    const html=withSortableRegister(renderMap(map)).replace(/href="(levels\.md|levels\.csv|events\.csv|touches\.csv)"/g,
      (_,name)=>`href="../research-workflow/${source.key}/output/${name}"`);
    const embedded=JSON.parse(html.match(/<script id="map-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
    for(const field of ['levels','frames','bars','intervals'] as const)assert.deepEqual(embedded[field],map[field]);
    const output=path.join(out,source.name+'.html');fs.writeFileSync(output,html);
    views.push({...source,source:file,sourceSha256:sha(raw),htmlSha256:sha(html),file:path.relative(process.cwd(),output).split(path.sep).join('/'),levels:map.levels.length});
  }
  atomicJson(path.join(out,'manifest.json'),{
    purpose:'Mutable presentation-only exports from immutable verified maps; no new research run',
    defaultSort:'price_descending',views,
    rendererSha256:sha(fs.readFileSync('scripts/major-sr-history-render-v2.ts')),
    sortingSha256:sha(fs.readFileSync('scripts/major-sr-register-sort.ts'))
  });
  console.log(JSON.stringify({views,rebuiltMaps:0,liveChanges:0},null,2));
}
if(require.main===module)main();
