/** Independent numerical/path checker: no construction controller or trajectory calculator imports. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson } from "./research-workflow";
import { prices, lines } from "./hype-failed-recovery-study";
import { auditComponentAccounting, componentAttribution } from "./ladder-component-accounting";
import { exposureDelta } from "./ladder-exposure-metrics";
type R = Record<string, any>;
const H = 3600000, M = 60000;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function stateOf(increments: number[]) {
  const total = increments.map((_, k) => sum(increments.slice(0, k + 1)));
  if (Math.max(...total.slice(0, 3)) > 0 && total[3] <= 0 && increments[3] < 0) return "failed_reclaim";
  if (increments[2] > 0 && increments[3] > 0) return "recovering";
  if (Math.max(...total) <= 0 && increments[2] <= 0 && increments[3] <= 0) return "persistent_weak";
  return "mixed";
}
async function main() {
  const root = path.resolve(__dirname, ".."), key = process.argv[2], dir = jobDirectory(root, key), out = path.join(dir, "output");
  const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")), load = (f: string) => read(path.join(out, f));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json"));
  assert.equal(state.status, "complete"); await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const d = plan.card.definition, cfg = read("bot-config.json"), raw = load("trajectory-hourly-inputs.json");
  const symbols = ["HYPEUSDT", "BTCUSDT", "SOLUSDT"], maps = Object.fromEntries(symbols.map(s => [s, new Map<number, number>(raw[s].map((x: R) => [x.end, x.close]))]));
  const paired = (t: number) => symbols.every(s => maps[s].has(t));
  const ret = (s: string, t: number) => paired(t) && paired(t - H) ? Math.log(maps[s].get(t)! / maps[s].get(t - H)!) : null;
  const features: R[] = []; await lines(path.join(out, "trajectory-features.jsonl"), x => features.push(x));
  const featureMap = new Map(features.map(x => [`${x.at}/${x.lag}`, x])); let trajectoryChecks = 0;
  for (const f of features) {
    const end = Math.floor((f.at - f.lag) / H) * H, trainEnd = end - 4 * H;
    assert.equal(f.sourceEnd, end); assert.equal(f.trainingEnd, trainEnd); assert.equal(f.availableAt, end + f.lag); assert(f.availableAt <= f.at);
    const rows: number[][] = [];
    for (let t = trainEnd - 167 * H; t <= trainEnd; t += H) {
      const row = symbols.map(s => ret(s, t)); if (row.every(x => x !== null)) rows.push(row as number[]);
    }
    const steps = [3, 2, 1, 0].map(k => symbols.map(s => ret(s, end - k * H)));
    assert.equal(rows.length, f.trainingPairs);
    if (rows.length < 160 || steps.some(r => r.some(x => x === null))) { assert(!f.ready); continue; }
    assert(f.ready);
    symbols.forEach((s, j) => {
      const x = rows.map(r => r[j]), y = rows.map(r => r[0]), n = x.length;
      const beta = j ? (n * sum(x.map((v, k) => v * y[k])) - sum(x) * sum(y)) / (n * sum(x.map(v => v * v)) - sum(x) ** 2) : 0;
      const intercept = j ? (sum(y) - beta * sum(x)) / n : 0;
      const increments = steps.map(r => r[0]! - (j ? intercept + beta * r[j]! : 0));
      near(f.paths[s].beta, beta); near(f.paths[s].intercept, intercept);
      increments.forEach((v, k) => { near(f.paths[s].increments[k], v); near(f.paths[s].cumulative[k], sum(increments.slice(0, k + 1))); });
      assert.equal(f.paths[s].state, stateOf(increments)); trajectoryChecks++;
    });
  }
  const pressure: R[] = load("trajectory-pressure-labels.json"), old: R[] = read(`${d.proxyArchive}/output/landmarks.json`);
  assert.deepEqual(pressure, old.map(({ features: _, ...x }) => x));
  const labels: R[] = load("trajectory-grid-labels.json"), archivedGrid: R[] = [];
  await lines(`${d.proxyArchive}/output/grid-labels.jsonl`, x => archivedGrid.push(x)); assert.deepEqual(labels, archivedGrid);
  const diagnostic = load("trajectory-summary.json");
  // Independently verify aggregate pressure counts and dollar totals for each state.
  let pressureGroups = 0;
  for (const [key, table] of Object.entries(diagnostic.pressure) as [string, R][]) {
    const xs = pressure.filter(x => `${x.model}/lag${x.lag}` === key);
    const check = (subset: R[], reported: R) => {
      const done = subset.filter(x => x.outcome !== null);
      assert.equal(reported.observations, subset.length); assert.equal(reported.completed, done.length);
      near(reported.subsequentDownside, -sum(done.map(x => Math.min(0, x.remainingValueChange))));
      near(reported.subsequentRecovery, sum(done.map(x => Math.max(0, x.remainingValueChange)))); pressureGroups++;
    };
    check(xs, table.baseline);
    for (const s of symbols) for (const [name, reported] of Object.entries(table.states[s])) check(xs.filter(x => {
      const f = featureMap.get(`${x.at}/${x.lag}`)!; return (f.ready ? f.paths[s].state : "unknown") === name;
    }), reported as R);
  }
  const manifest = read(`${d.archive}/manifest.json`), cs = await prices(Date.parse(d.cutoff), manifest.repairFile);
  const source: R[] = load("construction-hourly-sources.json"), groups = new Map<number, R[]>();
  for (const c of cs) { const t = Math.floor(c.ts / H) * H; const arr = groups.get(t) ?? []; arr.push(c); groups.set(t, arr); }
  const bars = [...groups].filter(([t, arr]) => arr.length === 60 && arr.every((c, k) => c.ts === t + k * M)).map(([t, a]) => ({ endTs: t + H, ts: t,
    high: Math.max(...a.map(c => c.high)), low: Math.min(...a.map(c => c.low)), close: a.at(-1)!.close,
    volume: sum(a.map(c => c.volume)), turnover: sum(a.map(c => c.turnover)) }));
  assert.equal(source.length, bars.length); let atr: number | null = null; const tr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], f = source[i]; assert.equal(f.endTs, b.endTs); near(f.close, b.close);
    if (i) { tr.push(Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)));
      if (i === 14) atr = sum(tr) / 14; else if (i > 14) atr = (atr! * 13 + tr.at(-1)!) / 14; }
    if (atr === null) assert.equal(f.atr14, null); else near(f.atr14, atr);
    const day = Math.floor(b.ts / (24 * H)) * 24 * H, prefix = bars.slice(Math.max(0, i - 23), i + 1).filter(x => x.ts >= day);
    const valid = prefix[0]?.ts === day && prefix.every((x, k) => !k || x.ts === prefix[k - 1].endTs);
    if (valid && sum(prefix.map(x => x.volume)) > 0) near(f.vwapUtcDay, sum(prefix.map(x => x.turnover)) / sum(prefix.map(x => x.volume)));
    else assert.equal(f.vwapUtcDay, null);
    if (i >= 5) near(f.roc5, (b.close / bars[i - 5].close - 1) * 100);
  }
  const byEnd = new Map(source.map(x => [x.endTs, x]));
  const results: R[] = load("results.json"), comps: R[] = load("comparisons.json"); assert.equal(results.length, 38);
  let fills = 0, minutes = 0, decisionsChecked = 0, controlChecks = 0;
  const accepted: R[] = read(`${d.archive}/results.json`), extended: R[] = read(`${d.scoreArchive}/output/results.json`);
  for (const x of results) {
    const events: any[] = []; await lines(path.join(out, `${x.name}-inventory.jsonl`), e => events.push(e));
    const accounting = auditComponentAccounting(cs, events, x.metrics, x.startIdx, x.endIdx, d.initialEquity, d.feeRate);
    assert.deepEqual(accounting, x.accounting); fills += events.length; minutes += accounting.independentMinutes;
    const p = d.policies.find((p: R) => p.id === x.policy), decisions: any[] = load(`${x.name}-decisions.json`);
    let ep = 0, inv: R[] = [], trim: R | null = null, pointer = 0, vetoCount = 0, unknownCount = 0;
    const intervened = new Set<number>(), byIndex = new Map<number, boolean>();
    for (const [i, episode, drop, veto, unknown] of decisions) {
      while (pointer < events.length && events[pointer].event.fillIndex <= i) {
        const e = events[pointer++]; inv = e.after; ep = e.episode;
        if (e.event.kind === "partial") trim = { at: e.event.fillAt, price: e.event.price };
        if (e.event.kind === "open" || !inv.length) trim = null;
      }
      assert.equal(episode, inv.length ? ep : ep + 1);
      const c = cs[i], at = c.endTs, cost = sum(inv.map(z => z.notional)), qty = sum(inv.map(z => z.qty));
      let expected = false, missing = false;
      if (p && inv.length) {
        if (p.family === "spacing" && inv.length >= 7) {
          const end = Math.floor((at - x.lag) / H) * H, f = byEnd.get(end);
          missing = !f?.healthy || f.atr14 === null || f.atr14 <= 0;
          expected = missing || c.close > inv.at(-1)!.entryPrice - Math.max(inv.at(-1)!.entryPrice * cfg.priceTriggerPct / 100, p.multiple * f!.atr14);
        } else if (p.family === "budget" && inv.length >= 7) {
          const cap = sum(Array.from({ length: p.capDepth }, (_, k) => cfg.basePositionUsdt * cfg.addScaleFactor ** k));
          expected = (c.close * qty / cost - 1) * 100 <= -1 && cost + cfg.basePositionUsdt * cfg.addScaleFactor ** inv.length > cap + 1e-8;
        } else if (p.family === "recycle" && trim) expected = p.mode === "wait60" ? at - trim.at < H
          : at - trim.at < 4 * H && c.close > trim.price * (1 - cfg.priceTriggerPct / 100);
      }
      assert.equal(veto, expected, `${x.name}/${i}`); assert.equal(unknown, missing);
      assert.equal(drop, inv.length > 0 && cfg.priceTriggerPct > 0 && c.close <= inv.at(-1)!.entryPrice * (1 - cfg.priceTriggerPct / 100));
      vetoCount += Number(veto); unknownCount += Number(unknown); if (veto) intervened.add(episode);
      byIndex.set(i, veto); decisionsChecked++;
    }
    for (const e of events.filter(e => e.event.kind === "open")) assert.equal(byIndex.get(e.event.decisionIndex), false, "Open must have prior non-vetoed permission");
    assert.equal(vetoCount, x.counts.vetoes); assert.equal(unknownCount, x.counts.unknown); assert.equal(decisions.length, x.counts.checks); assert.equal(intervened.size, x.interventions);
    if (x.policy === "baseline") {
      const base = x.phase === "archived_control" ? accepted.find(y => y.model === x.model && y.policy.id === "baseline")
        : extended.find(y => y.model === x.model && y.phase === "extended" && y.policy === "baseline");
      assert(base); assert.equal(x.digest, base.digest); assert.deepEqual(x.metrics, base.metrics); assert.deepEqual(x.accounting, base.accounting); controlChecks++;
    } else {
      const base = results.find(y => y.model === x.model && y.end === x.end && y.policy === "baseline")!, comp = comps.find(y => y.name === x.name)!;
      assert.deepEqual(comp.delta, exposureDelta(x.metrics, base.metrics)); assert.deepEqual(comp.attribution, componentAttribution(x.metrics, base.metrics));
    }
    console.log(`[verified] ${x.name} decisions=${decisions.length}`);
  }
  assert.equal(controlChecks, 6);
  await verifyPins(root, [...plan.pins, ...plan.protectedPins, ...state.artifacts]);
  const report = { passed: true, trajectoryChecks, pressureGroups, unchangedPressureJoins: pressure.length, unchangedGridJoins: labels.length,
    hourlyAggregatesAndAtr: source.length, controlsExact: controlChecks, economicCases: results.length, fills, minutes, decisionsChecked,
    liveChanges: 0, newTradingDefinitions: 6, note: "Independent equations, raw OHLCV, ledger and every add-veto decision. No exchange liquidation/maker/funding certification." };
  atomicJson(path.join(dir, "verification.json"), report); console.log(JSON.stringify(report));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
