/** Actual offline-browser interactions, on temporary copies of the generated viewers. */
import fs from 'fs';import os from 'os';import path from 'path';import {spawnSync} from 'child_process';
import {pathToFileURL} from 'url';import assert from 'assert/strict';
const chrome=process.argv[2]??'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert(fs.existsSync(chrome),'Pass a Chrome/Chromium executable as the first argument');
const script=String.raw`<script>
(()=>{
 const result={passed:false,checks:0,error:null};
 const check=(ok,msg)=>{if(!ok)throw Error(msg);result.checks++;};
 const rows=()=>Array.from(document.querySelectorAll('#rows tr'));
 const headers=()=>Array.from(document.querySelectorAll('thead th'));
 const button=i=>document.querySelector('button.register-sort[data-column="'+i+'"]');
 const value=(r,col)=>{
   const c=Array.from(r.cells).map(c=>c.textContent.trim());
   if(col===0)return c[0]+' '+c[3];
   if(col===1||col===4)return parseFloat(c[col]);
   if(col===6)return c[6]==='Active at cutoff'?null:c[6];
   return c[col];
 };
 const ordered=col=>{
   const dir=headers()[col].getAttribute('aria-sort');
   check(dir==='ascending'||dir==='descending','Active column direction');
   const data=rows().map(r=>value(r,col));
   for(let i=1;i<data.length;i++){
     const a=data[i-1],b=data[i];
     check(b===null||(a!==null&&(dir==='ascending'?a<=b:a>=b)),'Incorrect order column '+col);
   }
 };
 try{
   const originalIds=JSON.stringify(D.levels.map(z=>z.id));
   check(rows().length===D.levels.length,'All historical rows rendered');
   check(headers()[1].getAttribute('aria-sort')==='descending','Default price high to low');ordered(1);
   check(document.querySelectorAll('button.register-sort').length===7,'Seven keyboard-accessible sort buttons');
   for(let i=0;i<7;i++){
     button(i).click();ordered(i);const direction=headers()[i].getAttribute('aria-sort');
     button(i).click();ordered(i);check(headers()[i].getAttribute('aria-sort')!==direction,'Direction toggled');
     check(rows().length===D.levels.length,'Sorting retains all rows');
   }
   button(1).click();ordered(1);
   const filter=document.getElementById('search');filter.value=rows()[0].cells[1].textContent.slice(0,2);filter.dispatchEvent(new Event('input'));
   check(rows().length>0,'Price filter retains matching rows');ordered(1);
   filter.value='no-such-level';filter.dispatchEvent(new Event('input'));check(rows().length===0,'Empty results safe');
   button(0).click();button(1).click();filter.value='';filter.dispatchEvent(new Event('input'));ordered(1);
   const id=rows()[0].dataset.id;rows()[0].click();
   check(document.querySelector('#rows tr.selected').dataset.id===id,'Row selection still works');ordered(1);
   const active=document.getElementById('activeOnly');active.checked=true;active.dispatchEvent(new Event('change'));
   check(rows().length===D.frames[D.frames.length-1].levels.length,'Active-only filter correct');ordered(1);
   active.checked=false;active.dispatchEvent(new Event('change'));
   button(5).click();ordered(5);
   const time=document.getElementById('time');time.value=Math.floor(D.frames.length/2);time.dispatchEvent(new Event('input'));ordered(5);
   const f=D.frames[+time.value],known=new Map(f.levels.map(z=>[z.id,z]));
   for(const r of rows()){
     const z=D.levels.find(z=>z.id===r.dataset.id),role=known.get(z.id)?.role||(f.at<z.qualifiedAt?'Not yet known':'Expired');
     check(r.cells[5].textContent===role,'Role updates at selected time');
   }
   check(JSON.stringify(D.levels.map(z=>z.id))===originalIds,'Original map order unmodified');
   // Restore the normal default for screenshot inspection.
   document.getElementById('asof').value=new Date(D.cutoff).toISOString().slice(0,16);
   document.getElementById('asof').dispatchEvent(new Event('change'));
   document.getElementById('zone').value='';document.getElementById('zone').dispatchEvent(new Event('change'));
   button(1).click();ordered(1);result.passed=true;
 }catch(e){result.error=String(e.stack||e);}
 const out=document.createElement('pre');out.id='register-test-result';out.textContent=encodeURIComponent(JSON.stringify(result));document.body.append(out);
})();
</script>`;
for(const name of ['map-4h','map-1d']){
  const original=fs.readFileSync(`backtests/major-sr-viewers/${name}.html`,'utf8');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sr-register-browser-')),file=path.join(dir,name+'.html'),png=path.join(dir,name+'.png');
  fs.writeFileSync(file,original.replace('</html>',script+'</html>'));
  const child=spawnSync(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--disable-extensions',
    '--user-data-dir='+path.join(dir,'profile'),'--window-size=1440,1400','--screenshot='+png,'--dump-dom',pathToFileURL(file).href],
    {encoding:'utf8',maxBuffer:70*1024*1024,timeout:25000,windowsHide:true});
  assert.equal(child.status,0,child.error?.message??child.stderr);
  const encoded=child.stdout.match(/<pre id="register-test-result">([^<]+)<\/pre>/)?.[1];assert(encoded,'Browser test did not finish');
  const result=JSON.parse(decodeURIComponent(encoded));assert(result.passed,result.error);
  console.log(JSON.stringify({name,...result,screenshot:png}));
}
