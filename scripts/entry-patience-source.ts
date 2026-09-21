/** Explicit research-only source derivatives. No accepted/production edits. */
import fs from "fs";
import assert from "assert/strict";
import {sha} from "./research-workflow";
export function replaceOnce(s:string,a:string,b:string){assert.equal(s.split(a).length,2,`Nonunique boundary: ${a.slice(0,80)}`);return s.replace(a,b);}
export function standaloneSource(){let s=fs.readFileSync("scripts/btc-dip-price-cap-engine.ts","utf8").replace(/\r\n/g,"\n");
  s=replaceOnce(s,'expiryMinutes:number|null;penetrationBps:number}', 'expiryMinutes:number|null;penetrationBps:number; executionBps?:number}');
  s=replaceOnce(s,'const byAt=new Map<number,EntrySignal>();','const cost=(o.executionBps??0)/10000; assert(cost>=0&&cost<0.1);\n  const byAt=new Map<number,EntrySignal>();');
  s=replaceOnce(s,'const p=position,pricePnl=p.qty*(c.open-p.entryPrice),fee=p.qty*c.open*o.feeRate;', 'const p=position,exitPrice=c.open*(1-cost),pricePnl=p.qty*(exitPrice-p.entryPrice),fee=p.qty*exitPrice*o.feeRate;');
  s=replaceOnce(s,'entryPrice:p.entryPrice,exitPrice:c.open,qty:p.qty','entryPrice:p.entryPrice,exitPrice,qty:p.qty');
  s=replaceOnce(s,'turnover+=p.qty*c.open','turnover+=p.qty*exitPrice');
  s=replaceOnce(s,'if(o.expiryMinutes===null||c.open<=level){','if(o.expiryMinutes===null||(c.open<=level&&(o.executionBps===undefined||c.open*(1+cost)<=pending.cap))){');
  s=replaceOnce(s,'const price=o.expiryMinutes===null?c.open:pending.cap,fee=o.notional*o.feeRate;','const price=o.executionBps===undefined?(o.expiryMinutes===null?c.open:pending.cap):c.open*(1+cost),fee=o.notional*o.feeRate;');
  return s;
}
export function ladderSource(){let s=fs.readFileSync("scripts/replay-causal-engine.ts","utf8").replace(/\r\n/g,"\n");
  s=replaceOnce(s,'export interface CausalRunOptions {',`export interface CausalRunOptions {
  researchOpenFill?: (x: {at:number; index:number; decisionIndex:number; reason:string; open:number}) => number|null;
  researchMinuteEnd?: (x: {at:number; index:number; pending:string|null; gap:boolean}) => void;`);
  s=replaceOnce(s,'if (c.ts !== intent.decisionAt) blocked.staleEntryCancelled++;\n        else {',`if (c.ts !== intent.decisionAt) blocked.staleEntryCancelled++;
        else {
          const fillPrice = opts.researchOpenFill ? opts.researchOpenFill({at:c.ts,index:i,decisionIndex:intent.decisionIndex,reason:intent.reason,open:c.open}) : c.open;
          if (fillPrice === null) { blocked.researchEntryCap = (blocked.researchEntryCap ?? 0) + 1; }
          else {
          if (!(fillPrice > 0) || !Number.isFinite(fillPrice)) throw Error("Invalid research entry fill");`);
  s=replaceOnce(s,'entryTime: c.ts, entryPrice: c.open, notional, qty: notional / c.open','entryTime: c.ts, entryPrice: fillPrice, notional, qty: notional / fillPrice');
  s=replaceOnce(s,'fillIndex: i, price: c.open, qty: notional / c.open, reason: intent.reason','fillIndex: i, price: fillPrice, qty: notional / fillPrice, reason: intent.reason');
  s=replaceOnce(s,'txn.target = null;\n        }\n      } else if (intent.kind === "close")','txn.target = null;\n          }\n        }\n      } else if (intent.kind === "close")');
  s=replaceOnce(s,'takerAgeSec: pulse.hlTakerAgeSec ?? null }));','takerAgeSec: pulse.hlTakerAgeSec ?? null, intervalMinutes: interval }));');
  s=replaceOnce(s,'at: number; index: number; episode: number; nextDepth: number; price: number; priceDropOk: boolean;\n  aboveEma200', 'at: number; index: number; episode: number; nextDepth: number; price: number; priceDropOk: boolean; intervalMinutes?: number;\n  aboveEma200');
  s=replaceOnce(s,'    if (opts.recordSnapshots) snapshots.push','    opts.researchMinuteEnd?.({at:now,index:i,pending:txn.pending?.kind??null,gap});\n    if (opts.recordSnapshots) snapshots.push');
  return s;
}
export function standaloneAuditSource(){let s=fs.readFileSync('scripts/btc-dip-price-cap-verify.ts','utf8').replace(/\r\n/g,'\n');
  s=s.slice(0,s.indexOf('async function main()'));
  s=replaceOnce(s,'let free=start;', 'const cost=(o.executionBps??0)/10000;\n  let free=start;');
  s=replaceOnce(s,'if(o.expiryMinutes===null||c.open<=level)', 'if(o.expiryMinutes===null||(c.open<=level&&(o.executionBps===undefined||c.open*(1+cost)<=s.cap)))');
  s=replaceOnce(s,'const price=entry===null?null:o.expiryMinutes===null?at(entry).open:s.cap;', 'const price=entry===null?null:o.executionBps===undefined?(o.expiryMinutes===null?at(entry).open:s.cap):at(entry).open*(1+cost);');
  s=replaceOnce(s,'assert.equal(t.exitPrice,at(t.exitAt).open)', 'assert.equal(t.exitPrice,at(t.exitAt).open*(1-cost))');
  return s;
}
export function ladderAuditSource(){let s=fs.readFileSync('scripts/flow-response-audit.ts','utf8').replace(/\r\n/g,'\n');
  s=replaceOnce(s,'start: number, end: number)', 'start: number, end: number, fillPrices=new Map<number,number|null>())');
  s=replaceOnce(s,'near(e.price!, c.open);', 'near(e.price!, e.kind === "open" && fillPrices.has(e.decisionIndex) ? fillPrices.get(e.decisionIndex)! : c.open);');
  s=replaceOnce(s,'if (a.approvedNotional === 0) assert(!opens.has(a.index));', 'if (a.approvedNotional === 0 || fillPrices.has(a.index) && fillPrices.get(a.index) === null) assert(!opens.has(a.index));');
  return s;
}
export const derivatives=[['scripts/entry-patience-standalone-engine.ts',standaloneSource],['scripts/entry-patience-ladder-engine.ts',ladderSource],
  ['scripts/entry-patience-standalone-audit.ts',standaloneAuditSource],['scripts/entry-patience-ladder-audit.ts',ladderAuditSource]] as const;
export function verifySources(){return derivatives.map(([file,fn])=>{const expected=fn();assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),expected);return {file,sha256:sha(expected)};});}
if(require.main===module)for(const [file,fn]of derivatives)process.stdout.write(`*** Begin Patch\n*** Add File: ${file}\n${fn().trimEnd().split('\n').map(l=>'+'+l).join('\n')}\n*** End Patch\n`);
