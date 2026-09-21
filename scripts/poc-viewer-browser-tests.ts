import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
const script = String.raw`<script>
(()=>{let checks=0;const check=(ok,msg)=>{if(!ok)throw Error(msg);checks++;};let result;
try {
 const table=()=>Array.from(document.querySelectorAll('#rows tr'));check(table().length>0,'No initial naked rows');
 const ordered=()=>{const values=rows.map(p=>p[sortKey]);for(let i=1;i<values.length;i++){if(values[i]===null)continue;check(values[i-1]!==null,'Null ordering');const cmp=['period','status'].includes(sortKey)?String(values[i-1]).localeCompare(String(values[i])):Number(values[i-1])-Number(values[i]);check(cmp*direction<=0,'Sort '+sortKey);}};
 check(sortKey==='center'&&direction===-1,'Default price descending');ordered();
 $('naked').checked=false;$('naked').dispatchEvent(new Event('change'));check(rows.length>100,'Full historical register');
 for(const b of document.querySelectorAll('[data-sort]')){b.click();ordered();b.click();ordered();}
 table()[0].click();check($('details').textContent.includes('row ['),'Selection inspector');
 $('search').value='nothing-matches';$('search').dispatchEvent(new Event('input'));check(table().length===0,'Empty search');$('search').value='';$('search').dispatchEvent(new Event('input'));
 for(const venue of ['bybit','binance'])for(const period of ['day','week','month'])for(const width of ['0.1','0.05','0.2']){
  $('venue').value=venue;$('period').value=period;$('width').value=width;update();check(rows.length>0,'Venue/timeframe/grid empty: '+venue+'/'+period+'/'+width+' selections '+[$('venue').value,$('period').value,$('width').value,$('search').value,at,D.profiles.filter(p=>p.venue===venue&&p.period===period&&p.width===width&&p.eligible).length]);check(rows.every(p=>p.venue===venue&&p.period===period&&p.width===width),'Filter mismatch');ordered();
 }
 $('period').value='all';$('venue').value='bybit';$('width').value='0.1';at=D.start;update();check(rows.length===0,'Future profiles leaked at history start');
 at=Math.floor((D.start+D.end)/2/60000)*60000;update();check(rows.every(p=>p.availableAt<=at),'Future profile leaked');check(rows.every(p=>p.observedRetestAt===null||p.retestKnownAt<=at),'Future retest leaked');
 at=D.end;$('naked').checked=true;sortKey='center';direction=-1;update();table()[0].click();ordered();result={passed:true,checks};
}catch(e){result={passed:false,checks,error:String(e.stack||e)};}
const out=document.createElement('pre');out.id='poc-test-result';out.textContent=encodeURIComponent(JSON.stringify(result));document.body.append(out);})();
</script>`;
const file = process.argv[2] ?? 'backtests/poc-viewers/hype-poc.html';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-browser-')), html = path.join(temp, 'map.html');
fs.writeFileSync(html, fs.readFileSync(file, 'utf8').replace('</html>', script + '</html>'));
const screenshot = path.join(temp, 'map.png');
const p = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--disable-extensions',
  '--user-data-dir=' + path.join(temp, 'profile'), '--window-size=1500,1400', '--screenshot=' + screenshot, '--dump-dom', pathToFileURL(html).href],
  { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 60000, windowsHide: true });
assert.equal(p.status, 0, p.error?.message ?? p.stderr);
const result = p.stdout.match(/<pre id="poc-test-result">([^<]+)<\/pre>/)?.[1]; assert(result, 'Browser test did not complete');
const parsed = JSON.parse(decodeURIComponent(result)); assert(parsed.passed, parsed.error); console.log(JSON.stringify({ ...parsed, screenshot }));
