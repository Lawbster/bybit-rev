import assert from 'assert/strict';
import vm from 'vm';
import {compareRegisterRows,registerSortValue,withSortableRegister,type RegisterRow} from './major-sr-register-sort';

const row=(id:string,price:number,date='2026-01-01',time='00:00',side='support',role='support',retired='Active at cutoff'):RegisterRow=>
  ({id,cells:[date,price.toFixed(4),side,time,`${(price*.99).toFixed(4)} – ${(price*1.01).toFixed(4)}`,role,retired]});
const rows=[row('b',10),row('c',100),row('a',2)];
const order=(rows:RegisterRow[],col:number,dir:1|-1)=>[...rows].sort((a,b)=>compareRegisterRows(a,b,col,dir)).map(r=>r.id);
assert.deepEqual(order(rows,1,-1),['c','b','a']);assert.deepEqual(order(rows,1,1),['a','b','c']);
assert.deepEqual(order(rows,4,-1),['c','b','a']);assert.deepEqual(rows.map(r=>r.id),['b','c','a']);
const dates=[row('late',10,'2026-02-01','00:00'),row('noon',10,'2026-01-01','12:00'),row('early',10,'2026-01-01','04:00')];
assert.deepEqual(order(dates,0,1),['early','noon','late']);assert.deepEqual(order(dates,0,-1),['late','noon','early']);
assert.deepEqual(order(dates,3,1),['late','early','noon']);
assert.deepEqual(order([row('s',10,'2026-01-01','00:00','support'),row('r',10,'2026-01-01','00:00','resistance')],2,1),['r','s']);
const roles=['support','Expired','resistance','Not yet known'].map((r,i)=>row(String(i),10,'2026-01-01','00:00','support',r));
assert.deepEqual(order(roles,5,1),['1','3','2','0']);assert.deepEqual(order(roles,5,-1),['0','2','3','1']);
const retired=[row('active',10),row('old',10,'2026-01-01','00:00','support','Expired','2026-02-01 00:00'),row('new',10,'2026-01-01','00:00','support','Expired','2026-09-01 04:00')];
assert.deepEqual(order(retired,6,1),['old','new','active']);assert.deepEqual(order(retired,6,-1),['new','old','active']);
assert.deepEqual(order([row('b',10),row('a',10)],1,-1),['a','b']);
assert.throws(()=>registerSortValue(rows[0],7));
const html=withSortableRegister('<html><script>function render(){}</script></html>');
assert.throws(()=>withSortableRegister(html));
const code=html.match(/<script id="register-sorting">([\s\S]*?)<\/script>/)![1];new vm.Script(code);
// The emitted browser functions must be self-contained (no CommonJS references).
const context=vm.createContext({});new vm.Script(code.slice(0,code.indexOf('(function installRegisterSorting'))).runInContext(context);
assert.equal(vm.runInContext(`compareRegisterRows(${JSON.stringify(rows[0])},${JSON.stringify(rows[1])},1,-1)`,context),1);
console.log('Register sorting tests passed: all seven columns, numeric prices/bounds, UTC dates/times, both directions, stable ties, missing retirement last, original data order preserved and standalone browser script.');
