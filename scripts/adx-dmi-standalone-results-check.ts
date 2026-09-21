/** Independent ledger/accounting verification. Never invokes the signal engine. */
import assert from "assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import readline from "readline";

const M = 60_000, H = 60 * M, EPS = 1e-6;
const root = path.resolve(__dirname, "..");
const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
const array = (value: any, label: string): any[] => { assert.ok(Array.isArray(value), `${label} must be an array`); return value; };
function number(value: any, label: string): number {
  assert.ok(typeof value === "number" && Number.isFinite(value), `${label} must be finite`); return value;
}
function near(actual: any, expected: number, label: string, tolerance = EPS): void {
  number(actual, label); assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} != ${expected}; difference ${Math.abs(actual - expected)}`);
}
function timestamp(value: any, label: string): number {
  assert.ok(Number.isSafeInteger(value) && value >= 0 && value % M === 0, `${label} must be UTC minute-aligned integer`); return value;
}
function inside(base: string, child: string): string {
  assert.equal(typeof child, "string"); const resolved = path.resolve(base, child), relative = path.relative(base, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `Path escapes expected directory: ${child}`);
  return resolved;
}
async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash("sha256"); for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
const caseKey = (r: any) => `${r.window}|${r.delayMs}|${r.id}`;
const monthOf = (t: number) => new Date(t).toISOString().slice(0, 7);
const total = (rows: any[], fn: (r: any) => number): number => rows.reduce((sum, row) => sum + fn(row), 0);

// Independent OHLC aggregation and array-form Wilder recurrences; no signal/math engine imports.
function referenceAdxDmi(candles:any[],tf:number,n:number):Map<number,any> {
  const step=tf/M, bars:any[]=[];
  for(let i=0;i+step<=candles.length;i+=step){
    let high=-Infinity,low=Infinity;for(let j=i;j<i+step;j++){high=Math.max(high,candles[j].high);low=Math.min(low,candles[j].low);}
    bars.push({ts:candles[i].ts,high,low,close:candles[i+step-1].close});
  }
  const smooth=(xs:Array<number|null>,start:number):Array<number|null>=>{
    const out:Array<number|null>=Array(xs.length).fill(null);let sum=0;
    for(let i=start;i<xs.length;i++){
      if(i<start+n){sum+=xs[i]!;if(i===start+n-1)out[i]=sum/n;}
      else out[i]=(out[i-1]!*(n-1)+xs[i]!)/n;
    }return out;
  };
  const tr:Array<number|null>=Array(bars.length).fill(null),pd=[...tr],md=[...tr];
  for(let i=1;i<bars.length;i++){
    const c=bars[i],p=bars[i-1],u=c.high-p.high,d=p.low-c.low;
    tr[i]=Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close));
    pd[i]=u>Math.max(d,0)?u:0;md[i]=d>Math.max(u,0)?d:0;
  }
  const atr=smooth(tr,1),ps=smooth(pd,1),ms=smooth(md,1),plus=[...tr],minus=[...tr],dx=[...tr];
  for(let i=n;i<bars.length;i++){
    plus[i]=atr[i]===0?0:100*ps[i]!/atr[i]!;minus[i]=atr[i]===0?0:100*ms[i]!/atr[i]!;
    const sum=plus[i]!+minus[i]!;dx[i]=sum===0?0:100*Math.abs(plus[i]!-minus[i]!)/sum;
  }
  const adx=smooth(dx,n);
  return new Map<number,any>(bars.map((c,i):[number,any]=>[c.ts,{dmAtr:atr[i],dmPlus:plus[i],dmMinus:minus[i],dmDx:dx[i],dmAdx:adx[i],
    dmSpread:plus[i]===null?null:plus[i]!-minus[i]!}]));
}
function crossed(r:any,a:any,b:any,z?:any):boolean {
  if(a==null||b?.dmSpread==null)return false;
  const sign=r.side==="long"?1:-1,v=sign*b.dmSpread;
  if(r.mode==="di_cross"||r.mode==="di_strong"){
    const cross=a.dmSpread!=null&&sign*a.dmSpread<=0&&v>0;
    return cross&&(r.mode==="di_cross"||(b.dmAdx!=null&&b.dmAdx>=r.threshold));
  }
  if(a.dmAdx==null||b.dmAdx==null)return false;
  if(r.mode==="adx_cross")return a.dmAdx<=r.threshold&&b.dmAdx>r.threshold&&v>0;
  return z?.dmAdx!=null&&z.dmAdx<=a.dmAdx&&a.dmAdx>=r.threshold&&b.dmAdx<a.dmAdx&&v<0;
}
function zeroExit(r:any,b:any):boolean {
  if(b?.dmSpread==null)return false;const sign=r.side==="long"?1:-1;
  return r.mode==="adx_peak_fade"?sign*b.dmSpread>=0:sign*b.dmSpread<=0;
}

async function main(): Promise<void> {
  assert.equal(process.argv.length, 3, "Usage: npx ts-node scripts/adx-dmi-standalone-results-check.ts ARTIFACT_DIRECTORY");
  const directory = path.resolve(root, process.argv[2]);
  inside(path.join(root, "backtests"), directory);
  assert.ok(fs.statSync(directory).isDirectory(), "Artifact path must be a directory");
  const destination = path.join(directory, "verification.json");
  assert.ok(!fs.existsSync(destination), "Refusing to overwrite an existing verification.json");
  const manifest = readJson(path.join(directory, "manifest.json")), spec = manifest.spec;
  const sources = array(manifest.sources, "manifest sources"), inputs = array(manifest.inputs, "manifest inputs");
  const definition = "research-inputs/indicators/adx-dmi-standalone-2026-09-06.json";
  assert.deepEqual(spec, readJson(path.join(root, definition)), "Embedded specification must equal its pinned source file");
  assert.ok(sources.some(s => s.file === definition), "Missing frozen specification fingerprint");
  assert.equal(spec.symbol, "HYPEUSDT"); assert.deepEqual(spec.timeframesMs, [5 * M, 15 * M, 30 * M, H, 4 * H]);
  assert.deepEqual(spec.periods,[7,14,28]);
  assert.deepEqual(spec.entryDefinitions,[{mode:"di_cross",threshold:0},...[20,25,40].map(threshold=>({mode:"di_strong",threshold})),...[20,25,40].map(threshold=>({mode:"adx_cross",threshold})),...[40,50].map(threshold=>({mode:"adx_peak_fade",threshold}))]);
  assert.deepEqual(spec.entryModes,["di_cross","di_strong","adx_cross","adx_peak_fade"]);
  assert.deepEqual(spec.sides, ["long", "short"]); assert.deepEqual(spec.exits, ["fixed12h", "indicator_or12h"]);
  assert.deepEqual(spec.executionDelaysMs, [0, M]); assert.equal(spec.holdMs, 12 * H);
  assert.ok(number(spec.notionalUsdt, "notional") > 0); assert.ok(number(spec.initialEquity, "initial equity") > 0);
  assert.ok(number(spec.feeRatePerSide, "fee rate") >= 0); assert.ok(number(spec.extraFixedPathCostBpsPerSide, "stress bps") >= 0);
  const pinned = [...sources, ...inputs];
  assert.equal(new Set(pinned.map(p => p.file)).size, pinned.length, "Duplicate provenance file");
  for (const p of pinned) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/); const file = inside(root, p.file);
    assert.equal(await sha256(file), p.sha256, `Source/input fingerprint changed: ${p.file}`);
    if (p.bytes !== undefined) assert.equal(fs.statSync(file).size, p.bytes, `Input size changed: ${p.file}`);
  }
  assert.ok(inputs.some(p => p.file === spec.repairFile), "Repair overlay must be fingerprinted");
  for (const file of [`data/${spec.symbol}_1_full.json`, `data/${spec.symbol}_1m.jsonl`])
    assert.ok(inputs.some(p => p.file === file), `Missing candle fingerprint: ${file}`);

  const artifactNames = ["manifest.json", "results.json", "monthly.json", "trades.jsonl", "context-controls.json", "ranking.json", "validation.json", "overlap-parity.json", "causal-traces.json", "shortlist.json", "summary.csv", "monthly.csv"];
  const artifactHashes = await Promise.all(artifactNames.map(async file => ({ file, sha256: await sha256(path.join(directory, file)) })));
  const summaries = array(readJson(path.join(directory, "results.json")), "results");
  const monthly = array(readJson(path.join(directory, "monthly.json")), "monthly");
  const ledger: any[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(directory, "trades.jsonl")), crlfDelay: Infinity })) {
    if (line.trim()) ledger.push(JSON.parse(line));
  }
  const expectedRules: any[] = [];
  for(const timeframeMs of spec.timeframesMs)for(const period of spec.periods)
    for(const {mode,threshold}of spec.entryDefinitions)for(const side of spec.sides)for(const exit of spec.exits)
      expectedRules.push({family:"adx_dmi",side,exit,timeframeMs,period,threshold,mode,
        id:`adx_${timeframeMs/M}m_n${period}_${mode}_t${threshold}_${side}_${exit}`});
  expectedRules.push(...spec.sides.map((side:string)=>({family:"clock",side,exit:"fixed12h",timeframeMs:H,
    period:14,threshold:0,mode:"di_cross",id:`clock_${side}`})));
  const windows = array(spec.windows, "windows"), expected = new Map<string, any>();
  for (const w of windows) for (const delayMs of spec.executionDelaysMs) for (const rule of expectedRules)
    expected.set(caseKey({ window: w.id, delayMs, id: rule.id }), { ...rule, delayMs, window: w.id, start: w.start, end: w.end });
  assert.equal(expected.size, 2168); assert.equal(summaries.length, expected.size);
  const byCase = new Map<string, any>(), tradesByCase = new Map<string, any[]>();
  for (const summary of summaries) {
    const key = caseKey(summary), shape = expected.get(key); assert.ok(shape, `Unexpected case ${key}`);
    assert.ok(!byCase.has(key), `Duplicate result ${key}`);
    for (const [name, value] of Object.entries(shape)) assert.equal(summary[name], value, `${key} ${name}`);
    byCase.set(key, summary); tradesByCase.set(key, []);
  }
  for (const trade of ledger) { const key = caseKey(trade); assert.ok(byCase.has(key), `Unknown trade case ${key}`); tradesByCase.get(key)!.push(trade); }
  const byMonth = new Map<string, any>();
  for (const row of monthly) {
    assert.ok(byCase.has(caseKey(row)), `Unknown monthly case ${caseKey(row)}`);
    assert.match(row.month, /^\d{4}-\d{2}$/); const key = `${caseKey(row)}|${row.month}`;
    assert.ok(!byMonth.has(key), `Duplicate monthly row ${key}`); byMonth.set(key, row);
  }

  // Reuse normalization/explicit repair only. No indicator or signal engine is imported.
  process.env.SIM_START = spec.indicatorSeedBarStart; process.env.SIM_END = spec.historyEnd;
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  console.log("[verify] loading fingerprinted canonical candles and explicit repair for execution/mark prices");
  const seed = Date.parse(spec.indicatorSeedBarStart), end = Date.parse(spec.historyEnd);
  const candles = (await loadCandles1m(spec.symbol, path.join(root, "data"), end, inside(root, spec.repairFile))).filter(c => c.ts >= seed);
  assert.equal(candles.length, manifest.minuteRows); assert.equal(candles[0].ts, seed);
  assert.equal(candles.at(-1)!.ts + M, end);
  candles.forEach((c, i) => assert.equal(c.ts, seed + i * M, "Repaired candle continuity"));
  const candle = (at: number) => { const index = (at - seed) / M; assert.ok(Number.isInteger(index) && index >= 0 && index < candles.length, `Missing price at ${at}`); return candles[index]; };
  const referenceByTf=new Map<string,Map<number,any>>();
  const referenceKey=(r:any)=>`${r.timeframeMs}:${r.period}`;
  for(const tf of spec.timeframesMs)for(const n of spec.periods){
    const values=referenceAdxDmi(candles,tf,n);referenceByTf.set(`${tf}:${n}`,values);
    assert.equal(values.size,manifest.closedBars.find((b:any)=>b.timeframeMs===tf).count);
  }
  const reconstructed = new Map<string, { net: number; markedByMonth: Map<string, number> }>();
  let checkedMonths = 0, checkedTrades = 0;
  for (const [key, r] of byCase) {
    const start = timestamp(Date.parse(r.start), "case start"), stop = timestamp(Date.parse(r.end), "case end");
    assert.ok(start < stop); const direction = r.side === "long" ? 1 : -1, rows = tradesByCase.get(key)!;
    type Exit = { decisionAt: number; fillAt: number; reason: string };
    const exitCache = new Map<number, Exit | null>();
    const firstExit = (entered: number): Exit | null => {
      if (exitCache.has(entered)) return exitCache.get(entered)!;
      const timeout = entered + spec.holdMs;
      let decisionAt = timeout, reason = "timeout";
      if (r.exit === "indicator_or12h") {
        const ref = referenceByTf.get(referenceKey(r))!;
        // Only subsequent closed boundaries; do not reuse entry's ADX/DMI value.
        for (let at = (Math.floor(entered / r.timeframeMs) + 1) * r.timeframeMs;
          at < Math.min(timeout, stop); at += r.timeframeMs) {
          const value = ref.get(at - r.timeframeMs);
          if (value != null && zeroExit(r, value)) {
            decisionAt = at; reason = "indicator"; break;
          }
        }
      }
      const out = decisionAt < stop ? { decisionAt, fillAt: decisionAt + r.delayMs, reason } : null;
      exitCache.set(entered, out); return out;
    };
    let previousExit: number | null = null;
    const validateEntry = (trade: any, label: string) => {
      const signal = timestamp(trade.signalAt, `${label} signal`), entered = timestamp(trade.entryAt, `${label} entry`);
      assert.ok(signal >= start && entered < stop && signal <= entered, `${label} chronology/window`);
      assert.equal(entered, signal + r.delayMs, `${label} exact entry delay`);
      if (r.family !== "clock") {
        assert.equal(signal % r.timeframeMs, 0, `${label} closed timeframe decision`);
        const references = referenceByTf.get(referenceKey(r))!;
        assert.ok(crossed(r, references.get(signal - 2 * r.timeframeMs), references.get(signal - r.timeframeMs), references.get(signal - 3*r.timeframeMs)), `${label} independently reconstructed ADX/DMI crossing`);
      }
      else if (previousExit === null) assert.equal(signal, Math.ceil(start / (12 * H)) * 12 * H, `${label} initial clock decision`);
      else assert.equal(signal, previousExit, `${label} rolling clock rearm follows exact close fill`);
      if (previousExit !== null) assert.ok(entered >= previousExit, `${label} overlapping position`);
      near(trade.entryPrice, candle(entered).open, `${label} actual minute open`, 1e-10);
      assert.ok(number(trade.qty, `${label} qty`) > 0);
      near(trade.qty * trade.entryPrice, spec.notionalUsdt, `${label} fixed entry notional`);
    };
    for (const [i, t] of rows.entries()) {
      const label = `${key} trade ${i}`; validateEntry(t, label); assert.equal(t.side, r.side, `${label} side`);
      const decided = timestamp(t.exitDecisionAt, `${label} exit decision`), exited = timestamp(t.exitAt, `${label} exit`);
      assert.ok(decided > t.entryAt && decided <= exited && exited < stop, `${label} no same-decision/after-cutoff close`);
      assert.equal(exited, decided + r.delayMs, `${label} exact exit delay`);
      const first = firstExit(t.entryAt); assert(first, `${label} missing eligible exit`);
      assert.equal(t.reason, first.reason); assert.equal(decided, first.decisionAt, `${label} earliest causal exit`);
      assert.equal(exited, first.fillAt);
      near(t.exitPrice, candle(exited).open, `${label} exit minute open`, 1e-10);
      const gross = direction * t.qty * (t.exitPrice - t.entryPrice), fee = t.qty * (t.entryPrice + t.exitPrice) * spec.feeRatePerSide;
      near(t.pricePnl, gross, `${label} independently recomputed gross`); near(t.fees, fee, `${label} actual notional fees`);
      near(t.net, gross - fee, `${label} independently recomputed net`);
      if (t.entryFeature !== null) {
        const featureStart = Math.floor(t.signalAt / r.timeframeMs) * r.timeframeMs - r.timeframeMs;
        assert.equal(t.entryFeature.timestamp, featureStart, `${label} last completed feature identity`);
        if(r.family!=="clock") {
          const expected=referenceByTf.get(referenceKey(r))!.get(featureStart);
          for(const [k,v]of Object.entries(expected)) {
            if(v===null)assert.equal(t.entryFeature[k],null);
            else near(t.entryFeature[k],v as number,`${label} independent ${k}`,1e-8);
          }
          assert.equal(t.entryFeature.dmPeriod,r.period);
        }
        for (const [field, value] of Object.entries(t.entryFeature)) if (value !== null) number(value, `${label} feature ${field}`);
      } else assert.equal(r.family, "clock", `${label} indicator entry requires feature provenance`);
      previousExit = exited; checkedTrades++;
    }
    const open = r.open;
    if (open !== null) {
      assert.equal(typeof open, "object"); validateEntry(open, `${key} open`);
      const first = firstExit(open.entryAt); assert(first === null || first.fillAt >= stop, `${key} missed executable exit`);
      near(open.markedPrice, candle(stop - M).close, `${key} cutoff mark`, 1e-10);
      near(open.net, direction * open.qty * (open.markedPrice - open.entryPrice)
        - open.qty * (open.entryPrice + open.markedPrice) * spec.feeRatePerSide, `${key} open liquidation net`);
    }
    const closedNet = total(rows, t => direction * t.qty * (t.exitPrice - t.entryPrice)
      - t.qty * (t.entryPrice + t.exitPrice) * spec.feeRatePerSide), net = closedNet + (open?.net ?? 0);
    const wins = rows.filter(t => t.net > 1e-8), losses = rows.filter(t => t.net < -1e-8);
    assert.equal(r.trades, rows.length); assert.equal(r.wins, wins.length); assert.equal(r.losses, losses.length);
    assert.equal(r.breakeven, rows.length - wins.length - losses.length);
    near(r.winningDollars, total(wins, t => t.net), `${key} winning dollars`); near(r.losingDollars, total(losses, t => t.net), `${key} losing dollars`);
    near(r.closedNet, closedNet, `${key} closed net`); near(r.openNet, open?.net ?? 0, `${key} open net`); near(r.net, net, `${key} total net`);
    const turnover = total(rows, t => t.qty * (t.entryPrice + t.exitPrice)) + (open ? open.qty * (open.entryPrice + open.markedPrice) : 0);
    near(r.turnoverIncludingMarkedExit, turnover, `${key} turnover including hypothetical close`);
    near(r.feesPaid, total(rows, t => t.fees) + (open ? open.qty * open.entryPrice * spec.feeRatePerSide : 0), `${key} actually paid fees`);
    near(r.stressNet, net - turnover * spec.extraFixedPathCostBpsPerSide / 10000, `${key} fixed-path extra cost stress`);
    near(r.exposureHours, total(rows, t => (t.exitAt - t.entryAt) / H) + (open ? (stop - open.entryAt) / H : 0), `${key} actual holding time`);
    assert.equal(typeof r.pendingAtEnd, "boolean"); assert.equal(typeof r.bankrupt, "boolean");
    assert.ok(Number.isSafeInteger(r.rawSignals) && Number.isSafeInteger(r.skippedOccupied) && r.skippedOccupied >= 0);
    assert.equal(r.rawSignals - r.skippedOccupied, rows.length + (open ? 1 : 0) + (r.pendingAtEnd && !open ? 1 : 0), `${key} accepted entry lifecycle count`);

    // Enumerate every opportunity independently, not only the saved entries.
    // Scan first eligible exits independently, including early neutral exits.
    const opportunities = new Set<number>();
    if (r.family === "clock") {
      for (let at = Math.ceil(start / (12 * H)) * 12 * H; at < stop; at += 12 * H) opportunities.add(at);
      for (let at = Math.ceil(start / (12 * H)) * 12 * H; at < stop; at += spec.holdMs + 2 * r.delayMs) opportunities.add(at);
    } else {
      const reference = referenceByTf.get(referenceKey(r))!;
      for (const [barStart, current] of reference) {
        const at = barStart + r.timeframeMs;
        if (at >= start && at < stop && crossed(r, reference.get(barStart - r.timeframeMs), current, reference.get(barStart - 2*r.timeframeMs))) opportunities.add(at);
      }
    }
    let freeAt = start, skipped = 0, pendingEntry = false;
    const accepted: number[] = [];
    for (const at of [...opportunities].sort((a, b) => a - b)) {
      if (at < freeAt) { skipped++; continue; }
      if (at + r.delayMs >= stop) { pendingEntry = true; freeAt = Infinity; }
      else { accepted.push(at); freeAt = firstExit(at + r.delayMs)?.fillAt ?? Infinity; }
    }
    assert.deepEqual([...rows.map(t => t.signalAt), ...(open ? [open.signalAt] : [])], accepted, `${key} no missing or extra eligible flat signals`);
    assert.equal(r.rawSignals, opportunities.size, `${key} complete crossing count`); assert.equal(r.skippedOccupied, skipped, `${key} complete occupied skips`);
    const terminalExit = open ? firstExit(open.entryAt) : null;
    const pendingExit = terminalExit !== null && terminalExit.fillAt >= stop;
    assert.equal(r.pendingAtEnd, pendingEntry || pendingExit, `${key} independently derived terminal pending`);

    // Full minute equity reconstruction from actual inventory intervals, with
    // no signal/feature engine calls. Adverse drawdown uses the prior close peak.
    const positions = [...rows, ...(open ? [open] : [])];
    let posIndex = 0, closedValue = 0, peak = spec.initialEquity, maxClose = 0, maxAdverse = 0, bankrupt = false;
    for (let index = (start - seed) / M; index < (stop - seed) / M; index++) {
      const c = candles[index], at = c.ts;
      while (posIndex < positions.length && positions[posIndex].exitAt !== undefined && positions[posIndex].exitAt <= at) {
        const p = positions[posIndex++]; closedValue += direction * p.qty * (p.exitPrice - p.entryPrice)
          - p.qty * (p.entryPrice + p.exitPrice) * spec.feeRatePerSide;
      }
      const candidate = positions[posIndex], held = candidate && candidate.entryAt <= at ? candidate : null;
      const equityAt = (price: number) => spec.initialEquity + closedValue + (held
        ? direction * held.qty * (price - held.entryPrice) - held.qty * (held.entryPrice + price) * spec.feeRatePerSide : 0);
      const equity = equityAt(c.close), adverse = equityAt(direction === 1 ? c.low : c.high);
      maxAdverse = Math.max(maxAdverse, (peak - adverse) / peak * 100); peak = Math.max(peak, equity);
      maxClose = Math.max(maxClose, (peak - equity) / peak * 100); bankrupt ||= adverse <= 0;
    }
    near(r.maxCloseDrawdownPct, maxClose, `${key} independent close-equity drawdown`, 1e-8);
    near(r.maxAdverseDrawdownPct, maxAdverse, `${key} independent adverse drawdown`, 1e-8);
    assert.equal(r.bankrupt, bankrupt, `${key} independent equity exhaustion`);

    let previousBoundaryNet = 0; const markedByMonth = new Map<string, number>();
    for (let cursor = start; cursor < stop;) {
      const date = new Date(cursor), month = monthOf(cursor), boundary = Math.min(stop, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
      const mark = candle(boundary - M).close, completed = rows.filter(t => t.exitAt < boundary);
      const held = rows.filter(t => t.entryAt < boundary && t.exitAt >= boundary);
      if (open && open.entryAt < boundary) held.push(open);
      assert.ok(held.length <= 1, `${key} overlapping inventory at ${month} boundary`);
      const cumulative = total(completed, t => t.net) + total(held, t => direction * t.qty * (mark - t.entryPrice)
        - t.qty * (t.entryPrice + mark) * spec.feeRatePerSide);
      const markedNet = cumulative - previousBoundaryNet, m = byMonth.get(`${key}|${month}`);
      assert.ok(m, `Missing monthly row ${key} ${month}`); checkedMonths++;
      const exited = rows.filter(t => monthOf(t.exitAt) === month), entered = [...rows, ...(open ? [open] : [])].filter(t => monthOf(t.entryAt) === month);
      assert.equal(m.trades, exited.length); assert.equal(m.wins, exited.filter(t => t.net > 1e-8).length);
      assert.equal(m.losses, exited.filter(t => t.net < -1e-8).length); assert.equal(m.breakeven, m.trades - m.wins - m.losses);
      near(m.winningDollars, total(exited.filter(t => t.net > 1e-8), t => t.net), `${key} ${month} wins`);
      near(m.losingDollars, total(exited.filter(t => t.net < -1e-8), t => t.net), `${key} ${month} losses`);
      near(m.closedNet, total(exited, t => t.net), `${key} ${month} realized`);
      near(m.feesPaid, spec.feeRatePerSide * (total(entered, t => t.qty * t.entryPrice) + total(exited, t => t.qty * t.exitPrice)), `${key} ${month} paid fees`);
      near(m.markedNet, markedNet, `${key} ${month} independent month-end equity marks`);
      markedByMonth.set(month, markedNet); previousBoundaryNet = cumulative; cursor = boundary;
    }
    near(previousBoundaryNet, net, `${key} monthly accumulation`); reconstructed.set(key, { net, markedByMonth });
    if (reconstructed.size % 100 === 0) console.log(`[verify] ${reconstructed.size}/${byCase.size} cases checked`);
  }
  assert.equal(checkedMonths, monthly.length, "Unexpected monthly rows outside study dates");
  for (const [key, r] of byCase) {
    if (r.family === "clock") { assert.equal(r.baselineId, null); assert.equal(r.deltaVsClock, null); }
    else {
      assert.equal(r.baselineId, `clock_${r.side}`);
      const control = reconstructed.get(caseKey({ ...r, id: r.baselineId }))!;
      near(r.deltaVsClock, reconstructed.get(key)!.net - control.net, `${key} independent clock delta`);
    }
    if (r.exit === "fixed12h") assert.equal(r.deltaVsOwnFixed12h, null);
    else near(r.deltaVsOwnFixed12h, reconstructed.get(key)!.net -
      reconstructed.get(caseKey({ ...r, id: r.id.replace("indicator_or12h", "fixed12h") }))!.net, `${key} own fixed12h delta`);
    if(r.mode==="di_strong"){
      const id=`adx_${r.timeframeMs/M}m_n${r.period}_di_cross_t0_${r.side}_${r.exit}`;
      near(r.deltaVsUnfilteredDiCross,reconstructed.get(key)!.net-reconstructed.get(caseKey({...r,id}))!.net,`${key} unfiltered DI control`);
    }else assert.equal(r.deltaVsUnfilteredDiCross,null);
    for (const [month, value] of reconstructed.get(key)!.markedByMonth) {
      const row = byMonth.get(`${key}|${month}`)!;
      assert.equal(row.baselineId, r.baselineId);
      if (r.family === "clock") { assert.equal(row.baselineMarkedNet, null); assert.equal(row.markedDelta, null); }
      else {
        const baseline = reconstructed.get(caseKey({ ...r, id: r.baselineId }))!.markedByMonth.get(month)!;
        near(row.baselineMarkedNet, baseline, `${key} ${month} baseline marked net`);
        near(row.markedDelta, value - baseline, `${key} ${month} independent marked delta`);
      }
    }
  }
  const contexts = array(readJson(path.join(directory, "context-controls.json")), "context controls");
  assert.equal(contexts.length, windows.length);
  for (const w of windows) {
    const context = contexts.filter(c => c.window === w.id); assert.equal(context.length, 1);
    const c = context[0], entry = candle(Date.parse(w.start)).open, mark = candle(Date.parse(w.end) - M).close;
    const qty = spec.notionalUsdt / entry, gross = qty * (mark - entry), fee = qty * (entry + mark) * spec.feeRatePerSide;
    near(c.cashNet, 0, "cash control"); near(c.entryPrice, entry, "buy/hold entry"); near(c.finalMark, mark, "buy/hold mark");
    near(c.notional, spec.notionalUsdt, "buy/hold notional"); near(c.buyHoldLongPricePnl, gross, "buy/hold gross");
    near(c.buyHoldLongFeesIncludingMarkedExit, fee, "buy/hold fees"); near(c.buyHoldLongNetBeforeFunding, gross - fee, "buy/hold net");
  }
  // The shared clocks retain exact saved I01 trade/monthly/stat paths.
  const priorDir=inside(root,spec.priorArtifactDirectory);
  const priorSummaries=array(readJson(path.join(priorDir,"results.json")),"prior summaries");
  const priorMonths=array(readJson(path.join(priorDir,"monthly.json")),"prior months");
  const priorTrades=fs.readFileSync(path.join(priorDir,"trades.jsonl"),"utf8").split(/\r?\n/).filter(l=>l.trim()).map(l=>JSON.parse(l));
  const withoutId=({id,...rest}:any)=>rest;
  let overlapCases=0;
  for(const r of summaries.filter(r=>r.family==="clock")){
    const matches=(p:any)=>p.window===r.window&&p.delayMs===r.delayMs&&p.id===r.id;
    const old=priorSummaries.filter(matches);assert.equal(old.length,1);
    for(const field of ["trades","wins","losses","breakeven","winningDollars","losingDollars","closedNet","openNet","net","feesPaid",
      "turnoverIncludingMarkedExit","maxCloseDrawdownPct","maxAdverseDrawdownPct","exposureHours","rawSignals","skippedOccupied","pendingAtEnd","bankrupt","open"])
      assert.deepEqual(r[field],old[0][field],`Prior clock ${caseKey(r)} ${field}`);
    assert.deepEqual(tradesByCase.get(caseKey(r))!.map(withoutId),priorTrades.filter(matches).map(withoutId));
    assert.deepEqual(monthly.filter(m=>caseKey(m)===caseKey(r)).map(withoutId),priorMonths.filter(matches).map(withoutId)); overlapCases++;
  }
  assert.equal(overlapCases,8);

  const ranking = array(readJson(path.join(directory, "ranking.json")), "ranking");
  const strategyRules = expectedRules.filter((r: any) => r.family !== "clock");
  assert.equal(ranking.length, 540);
  const expectedRanking = strategyRules.map((rule: any) => {
    const cs = summaries.filter(r => r.id === rule.id), ms = monthly.filter(m => m.id === rule.id);
    const failures: string[] = [];
    if (cs.some(r => r.trades < (r.window === "full" ? 30 : 10))) failures.push("insufficient_trade_count");
    if (!cs.every(r => r.net > 0)) failures.push("not_positive_all_windows_delays");
    if (!cs.every(r => r.deltaVsClock > 0)) failures.push("not_above_clock_all_windows_delays");
    if (ms.some(m => m.markedDelta < -1e-8)) failures.push("monthly_regression_vs_clock");
    if (!cs.every(r => r.stressNet > 0)) failures.push("extra_cost_stress_nonpositive");
    if (cs.some(r => r.bankrupt)) failures.push("account_equity_exhausted_in_diagnostic");
    return { ...rule, passesResearchScreen: !failures.length, failures, minNet: Math.min(...cs.map(r => r.net)),
      minDelta: Math.min(...cs.map(r => r.deltaVsClock)),
      fullZeroDelayDelta: cs.find(r => r.window === "full" && r.delayMs === 0).deltaVsClock,
      worstMonthlyDelta: Math.min(...ms.map(m => m.markedDelta)), deploymentCandidate: false };
  }).sort((a: any, b: any) => b.fullZeroDelayDelta - a.fullZeroDelayDelta);
  assert.deepEqual(ranking, expectedRanking, "Independent ranking and strict screens");
  const shortlist = readJson(path.join(directory, "shortlist.json"));
  const eligible = strategyRules.filter((rule: any) => summaries.filter(r => r.id === rule.id)
    .every(r => r.net > 0 && r.stressNet > 0 && r.trades >= (r.window === "full" ? 30 : 10) && !r.bankrupt))
    .sort((a: any, b: any) => byCase.get(caseKey({ window: "full", delayMs: 0, id: b.id })).net
      - byCase.get(caseKey({ window: "full", delayMs: 0, id: a.id })).net);
  assert.deepEqual(shortlist.eligibleIds, eligible.map((r: any) => r.id));
  assert.deepEqual(shortlist.topFiveIds, (eligible.length ? eligible : expectedRanking).slice(0, 5).map((r: any) => r.id));
  const traces = array(readJson(path.join(directory, "causal-traces.json")), "causal traces");
  assert.equal(traces.length, summaries.filter(r => r.window === "full" && r.delayMs === 0 && r.family !== "clock" && r.trades > 0).length);
  const traceIds = new Set<string>();
  for (const trace of traces) {
    assert(!traceIds.has(trace.rule.id)); traceIds.add(trace.rule.id);
    const r = byCase.get(caseKey({ window: "full", delayMs: 0, id: trace.rule.id })); assert(r);
    const first = tradesByCase.get(caseKey(r))![0]; assert(first);
    const ref = referenceByTf.get(referenceKey(r))!;
    for(const [field,offset]of [["older",3],["previous",2],["current",1]] as const) {
      const expected=ref.get(first.signalAt-offset*r.timeframeMs);
      for(const [k,v]of Object.entries(expected)){
        if(v===null)assert.equal(trace[field][k],null);else near(trace[field][k],v as number,`trace ${field} ${k}`,1e-8);
      }
      assert.equal(trace[field+"BarStart"],first.signalAt-offset*r.timeframeMs);
    }
    assert.equal(trace.availableAt,first.signalAt);
    for (const field of ["signalAt", "entryAt", "entryPrice", "exitAt"]) assert.equal(trace[field], first[field]);
  }

  for (const p of pinned) assert.equal(await sha256(inside(root, p.file)), p.sha256, `Source/input changed during verification: ${p.file}`);
  for (const p of artifactHashes) assert.equal(await sha256(path.join(directory, p.file)), p.sha256, `Artifact changed during verification: ${p.file}`);
  const report = { version: 1, verifiedAt: new Date().toISOString(), passed: true,
    verifier: { file: path.relative(root, __filename).replace(/\\/g, "/"), sha256: await sha256(__filename) },
    checkedCases: byCase.size, checkedTradeRows: checkedTrades, checkedMonthlyRows: checkedMonths, independentlyMatchedPriorCases: overlapCases,
    inputAndSourceHashesMatched: true, artifactsUnchanged: true, artifacts: artifactHashes,
    checks: ["independent ADX/DMI formulas for all five timeframes / three periods; DI crossings, ADX strength and known-peak fades",
      "every eligible flat signal and occupied skip independently enumerated", "terminal pending decisions independently derived",
      "full minute close/adverse equity drawdown independently reconstructed", "8 prior saved ledger/monthly/stat overlap cases",
      "exact entry and exit timing/delay", "execution prices match canonical repaired minute opens",
      "fixed entry sizing and no overlapping inventory", "directional gross/net and actual-notional fees",
      "closed/open counts and fee-adjusted cutoff marks", "turnover and fixed-path cost stress", "exposure duration",
      "monthly realized results and paid fees", "independently reconstructed month-boundary marked equity",
      "same-side clock and own fixed12h deltas; earliest neutral exits and timeouts", "cash and buy-and-hold contextual controls", "independent strict ranking and descriptive shortlist", "causal first-trade traces"],
    limitations: ["No strategy engine is imported; independent OHLC aggregation and array-form ADX/DMI recurrences/crossing enumeration and ledger accounting check this fixed-timeout/neutral-exit study only.",
      "No untouched holdout or ADX/DMI combination tests; shortlist is descriptive, not live approval.",
      "Windows overlap: checked trade rows are artifact records, not a count of unique market trades.",
      "Funding, actual historical publication delay, liquidity, slippage paths and live execution are not certified."],
    writes: ["verification.json only"] };
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(`[verified] ${byCase.size} cases, ${checkedTrades} trade rows, ${checkedMonths} monthly rows; ${destination}`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
