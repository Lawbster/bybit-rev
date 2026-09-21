import assert from 'assert/strict';
import {RecoveryObserver,H,M,futureLabel,rowAt,responseTape} from './major-recovery-policy';
import type {Frame} from './macro-support-policy';
import type {MacroBar,MacroZone,Minute} from './macro-sr-observer';
const zone:MacroZone={id:'test',center:100,lower:99,upper:101,origin:'resistance',role:'support',createdAt:0,firstKnownAt:0,touches:[{pivotAt:0,knownAt:0,price:100,side:'resistance'},{pivotAt:0,knownAt:0,price:100,side:'support'}],qualified:true,above:0,below:0,lastFlipAt:0,retestSinceFlip:false};
const frame=(end:number,healthy=true,zones=[zone]):Frame=>({at:Math.floor(end/(4*H))*4*H,bar:{ts:Math.floor(end/(4*H))*4*H-4*H,endTs:Math.floor(end/(4*H))*4*H,open:102,close:102,high:103,low:101,minutes:240},healthy,zones,events:[]});
const bar=(n:number,close:number,low=close-.1,high=close+.1):MacroBar=>({ts:(n-1)*H,endTs:n*H,open:close,close,low,high,minutes:60});
let cases=0;
{
 const o=new RecoveryObserver();o.step(bar(1,102),frame(H));assert(o.watch);assert.equal(o.events.length,0);
 o.step(bar(2,98),frame(2*H));assert.equal(o.spell,null);o.step(bar(3,98),frame(3*H));assert(o.rows.at(-1)!.spell);assert.equal(o.rows.at(-1)!.spell!.failedAt,3*H);
 assert(!rowAt(o.rows,3*H-1).row?.spell);assert(!rowAt(o.rows,3*H+M-1,M).row?.spell);assert(rowAt(o.rows,3*H+M,M).row?.spell);cases+=4;
 o.step(bar(4,98,97,99.2),frame(4*H));assert.equal(o.rows.at(-1)!.spell!.failedRetestAt,4*H);o.step(bar(5,102),frame(5*H));assert(o.spell);o.step(bar(6,102),frame(6*H));assert(!o.spell);assert.equal(o.events.at(-1)!.kind,'old_reclaim');cases+=2;
}
{
 const o=new RecoveryObserver();o.step(bar(1,102),frame(H));o.step(bar(2,98),frame(2*H));o.step(bar(4,98),frame(4*H));assert(!o.spell);assert(!rowAt(o.rows,4*H).healthy);o.step(bar(5,98),frame(5*H));assert(!o.spell);o.step(bar(6,98),frame(6*H));assert(o.spell);cases++;
 o.step(bar(7,98),frame(7*H,false));assert(!rowAt(o.rows,7*H).healthy);assert(!rowAt(o.rows,8*H).healthy);o.step(bar(8,98),frame(8*H,true,[]));assert(!o.spell);assert.equal(o.events.at(-1)!.kind,'retired');cases+=2;
}
{
 const o=new RecoveryObserver();o.step(bar(1,102),frame(H));o.step(bar(2,102,98,103),frame(2*H));assert.deepEqual(o.events.map(e=>e.kind),['touch','sweep_reclaim']);assert(!o.spell);cases++;
}
{
 const o=new RecoveryObserver();o.step(bar(1,102),frame(H));o.step(bar(2,98),frame(2*H));o.step(bar(3,98),frame(3*H));
 const lows=[96,95,90,94,95,93,92,94,95,94,94];
 lows.forEach((lo,i)=>o.step(bar(i+4,lo+1,lo,lo+2),frame((i+4)*H)));
 assert.equal(o.spell!.lows.length,2);assert.equal(o.spell!.lows[0].price,90);assert.equal(o.spell!.lows[1].price,92);assert.equal(o.spell!.neckline,97);
 assert.equal(o.spell!.necklineKnownAt,12*H);o.step(bar(15,98,97.5,98.5),frame(15*H));assert(!o.spell);assert.equal(o.events.at(-1)!.kind,'lower_base');assert(o.events.at(-1)!.evidence.lows.every((l:any)=>l.knownAt<=15*H));cases+=3;
}
{
 const cs:Minute[]=Array.from({length:120},(_,i)=>({ts:i*M,endTs:(i+1)*M,open:100,high:i===0?103:100,low:i===0?97:100,close:100,volume:1,turnover:100}));
 assert.equal(futureLabel(cs,0,1)!.first,'ambiguous');assert.equal(futureLabel(cs,H,2),null);
 const frames=[frame(0),frame(4*H)];assert.deepEqual(responseTape(cs,frames).rows,responseTape([...cs,...cs.map(c=>({...c,ts:c.ts+2*H,endTs:c.endTs+2*H,low:1,high:999}))],frames).rows.filter(r=>r.at<=2*H));cases+=3;
}
console.log(`major recovery tests passed (${cases} checks)`);
