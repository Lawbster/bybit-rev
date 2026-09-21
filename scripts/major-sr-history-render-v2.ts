import type {MajorMap} from './major-sr-history-map';
export const iso=(n:number|null)=>n===null?'':new Date(n).toISOString();
const timeframe=(m:MajorMap)=>m.spec.minutes===1440?'1D':m.spec.minutes%60===0?`${m.spec.minutes/60}H`:`${m.spec.minutes}m`;
export function levelTable(m:MajorMap){
  const title=`# Historical major S/R levels — ${m.symbol}, ${timeframe(m)}\n\n`;
  const note=`Full canonical source: **${iso(m.sourceStart)} to ${iso(m.sourceEnd)}**. Last complete ${timeframe(m)} bar closes ${iso(m.bars.at(-1)!.endTs)}.\n\n`+
    `**${m.levels.length} qualified level identities**, including expired levels. These are fixed zone centres, NOT individual swing pivots and NOT the live 14-day map.\n\n`+
    `Date/time = when the level first qualified and could be used (second spaced pivot confirmed). Side = its role on qualification; it can subsequently flip. A later zone at the same price has a different identity. Expiry and full-period metadata are for manual review only.\n\n`+
    `[Interactive full-history chart](map.html) · [CSV](levels.csv) · [All role changes](events.csv) · [Zone role intervals](role-intervals.csv) · [Pivot evidence](touches.csv) · [Replay-ready saved map](map.json)\n\n`;
  return title+note+'| Date known | Price point | Side at qualification | Time UTC | Zone bounds | Retired UTC | ID |\n|---|---:|---|---|---|---|---|\n'+m.levels.map(z=>{
    const at=iso(z.qualifiedAt);return `| ${at.slice(0,10)} | ${z.center.toFixed(4)} | ${z.origin} | ${at.slice(11,16)} | ${z.lower.toFixed(4)}–${z.upper.toFixed(4)} | ${z.retiredAt===null?'Active at cutoff':iso(z.retiredAt).slice(0,16).replace('T',' ')} | ${z.id} |`;
  }).join('\n')+'\n';
}

/** Entirely offline, no CDN, credentials, external requests or future-projected level lines. */
export function renderMap(m:MajorMap):string{
  const payload=JSON.stringify({symbol:m.symbol,cutoff:m.cutoff,sourceStart:m.sourceStart,timeframeMs:m.spec.minutes*60000,levels:m.levels,
    frames:m.frames,bars:m.bars,intervals:m.intervals}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${m.symbol} — historical ${timeframe(m)} S/R map</title><style>
body{margin:24px;background:#10151d;color:#e1e7ef;font:14px system-ui}h1{font-size:23px}a{color:#88c8ff}button,input,select{background:#1b2634;color:#e1e7ef;border:1px solid #506276;padding:7px;margin:3px}button,tr[data-id]{cursor:pointer}label{display:inline-block;margin-right:12px}.note{color:#a9bbcf;max-width:1150px;line-height:1.5}canvas{width:100%;height:470px;background:#0d1219;border:1px solid #364454}#time{width:70%}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:7px;border-bottom:1px solid #2b394a}th{position:sticky;top:0;background:#1b2634}tr.selected{background:#23394e}.scroll{max-height:460px;overflow:auto}.support{color:#55d6a0}.resistance{color:#ff8a88}#detail{white-space:pre-wrap;line-height:1.5}.row{margin:14px 0}
</style><h1>${m.symbol} — full-history major S/R, ${timeframe(m)}</h1>
<p class="note">All qualified historical levels, including retired identities. Date/time in the register is <b>first usable qualification</b>, not an earlier pivot date. Click a level to inspect its history. Green = support, red = resistance. Lines start only when known and stop at expiry; role colours change only at confirmed transitions. This is corrected exchange-history research, not original live-arrival evidence or a trading signal.</p>
<div class="row"><label>View start (UTC)<input id="start" type="date"></label><button id="all">Full history</button><button id="recent">Last 90 days</button><label>Level <select id="zone"><option value="">All level histories</option></select></label></div>
<div class="row"><label>As-of (UTC)<input id="asof" type="datetime-local" step="60"></label><input id="time" type="range" min="0" step="1"></div><p id="status"></p>
<canvas id="chart"></canvas><p class="note">White line: closed ${timeframe(m)} price. Selected zone: shaded band. No final-map lines are projected backward. Early/incomplete coverage is marked not ready even where qualified levels are visible.</p><div id="detail"></div>
<div class="row"><label>Register filter <input id="search" placeholder="price, date or ID"></label><label><input id="activeOnly" type="checkbox">Only active at selected time</label><span id="count"></span></div>
<div class="scroll"><table><thead><tr><th>Date known</th><th>Price point</th><th>Side at qualification</th><th>Time UTC</th><th>Bounds</th><th>Role at selected time</th><th>Retired UTC</th></tr></thead><tbody id="rows"></tbody></table></div>
<p><a href="levels.md">Readable full register</a> · <a href="levels.csv">CSV</a> · <a href="events.csv">Events</a> · <a href="touches.csv">Pivot evidence</a></p>
<script id="map-data" type="application/json">${payload}</script><script>
'use strict';
const D=JSON.parse(document.getElementById('map-data').textContent),$=id=>document.getElementById(id),fmt=t=>new Date(t).toISOString(),price=n=>n.toFixed(4),byId=new Map(D.levels.map(z=>[z.id,z]));
let at=D.cutoff,selected='';
for(const z of D.levels){const o=document.createElement('option');o.value=z.id;o.textContent=price(z.center)+' | '+fmt(z.qualifiedAt).slice(0,10)+' | '+z.origin;$('zone').append(o);}
$('time').max=D.frames.length-1;$('time').value=D.frames.length-1;$('asof').value=fmt(at).slice(0,16);$('start').value=fmt(D.sourceStart).slice(0,10);
function frame(){let lo=0,hi=D.frames.length;while(lo<hi){const mid=(lo+hi)>>>1;if(D.frames[mid].at<=at)lo=mid+1;else hi=mid;}return D.frames[lo-1];}
function render(){const f=frame(),active=new Map((f?.levels||[]).map(z=>[z.id,z])),expected=Math.floor(at/D.timeframeMs)*D.timeframeMs;
 $('status').textContent=fmt(at)+' | '+D.levels.length+' historical identities | '+active.size+' active | coverage '+(f?.healthy&&f.at===expected?'READY':'NOT READY')+' | latest closed price '+(f?price(f.close):'unavailable');
 const q=$('search').value.trim().toLowerCase();let list=D.levels.filter(z=>(!$('activeOnly').checked||active.has(z.id))&&(!q||(z.id+' '+price(z.center)+' '+fmt(z.qualifiedAt)+' '+z.origin).toLowerCase().includes(q)));
 $('count').textContent=list.length+' rows';$('rows').replaceChildren();for(const z of list){const tr=document.createElement('tr');tr.dataset.id=z.id;tr.className=selected===z.id?'selected':'';const t=fmt(z.qualifiedAt),role=active.get(z.id)?.role||(at<z.qualifiedAt?'Not yet known':'Expired');
 for(const value of [t.slice(0,10),price(z.center),z.origin,t.slice(11,16),price(z.lower)+' – '+price(z.upper),role,z.retiredAt?fmt(z.retiredAt).slice(0,16).replace('T',' '):'Active at cutoff']){const td=document.createElement('td');td.textContent=value;if(value==='support'||value==='resistance')td.className=value;tr.append(td);}tr.onclick=()=>{selected=z.id;$('zone').value=selected;render();};$('rows').append(tr);}
 const z=byId.get(selected);$('detail').textContent=z?'Selected '+z.id+' | fixed centre '+price(z.center)+' | first usable '+fmt(z.qualifiedAt)+'\\nSeed pivot '+fmt(z.seedPivotAt)+'; first pivot confirmation '+fmt(z.createdAt)+'\\n'+z.touches.filter(t=>t.knownAt<=at).map(t=>fmt(t.pivotAt)+' '+t.side+' '+price(t.price)+' — confirmed '+fmt(t.knownAt)).join('\\n'):'Select a row to view that level’s pivot evidence. The full historical register includes future/expired rows for inspection; only the as-of states are replay inputs.';draw();}
function draw(){const c=$('chart'),ratio=window.devicePixelRatio||1,w=c.clientWidth,h=470;c.width=w*ratio;c.height=h*ratio;const ctx=c.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);
 const start=Date.parse($('start').value+'T00:00:00Z'),end=at;if(!Number.isFinite(start)||start>=end)return;
 const bs=D.bars.filter(b=>b.endTs>=start&&b.endTs<=end);if(!bs.length)return;const ints=D.intervals.filter(i=>(!selected||i.id===selected)&&i.end>start&&i.start<end);
 let low=Math.min(...bs.map(b=>b.low)),high=Math.max(...bs.map(b=>b.high));if(selected&&ints.length){const z=byId.get(selected);low=Math.min(low,z.lower);high=Math.max(high,z.upper);}const pad=Math.max((high-low)*.08,.01);low-=pad;high+=pad;
 const L=65,R=w-15,T=15,B=h-35,X=t=>L+(t-start)/(end-start)*(R-L),Y=p=>B-(p-low)/(high-low)*(B-T);
 ctx.font='12px monospace';ctx.fillStyle='#b0bfd0';for(let i=0;i<=5;i++){const p=low+(high-low)*i/5,y=Y(p);ctx.strokeStyle='#253140';ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.fillText(p.toFixed(2),4,y+4);const t=start+(end-start)*i/5;ctx.fillText(fmt(t).slice(0,10),Math.min(R-75,X(t)),h-10);}
 for(const i of ints){const z=byId.get(i.id);if(z.center<low||z.center>high)continue;const x1=X(Math.max(start,i.start)),x2=X(Math.min(end,i.end));ctx.strokeStyle=i.role==='support'?'#55d6a0':'#ff8a88';ctx.globalAlpha=selected?1:.3;ctx.lineWidth=selected?2:1;ctx.beginPath();ctx.moveTo(x1,Y(z.center));ctx.lineTo(x2,Y(z.center));ctx.stroke();if(selected){ctx.globalAlpha=.12;ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(x1,Y(z.upper),x2-x1,Y(z.lower)-Y(z.upper));}}
 ctx.globalAlpha=1;ctx.strokeStyle='#e9edf4';ctx.lineWidth=1.2;ctx.beginPath();let prev=null;for(const b of bs){if(prev===null||b.ts!==prev)ctx.moveTo(X(b.endTs),Y(b.close));else ctx.lineTo(X(b.endTs),Y(b.close));prev=b.endTs;}ctx.stroke();}
$('zone').onchange=()=>{selected=$('zone').value;render();};$('time').oninput=()=>{at=D.frames[+$('time').value].at;$('asof').value=fmt(at).slice(0,16);render();};$('asof').onchange=()=>{const t=Date.parse($('asof').value+'Z');if(Number.isFinite(t)){at=Math.min(D.cutoff,Math.max(D.sourceStart,t));render();}};
$('start').onchange=render;$('all').onclick=()=>{$('start').value=fmt(D.sourceStart).slice(0,10);render();};$('recent').onclick=()=>{$('start').value=fmt(Math.max(D.sourceStart,at-90*86400000)).slice(0,10);render();};$('search').oninput=render;$('activeOnly').onchange=render;window.addEventListener('resize',draw);render();
</script></html>`;
}
