/** Read verified L15 paths; attribution only, no engine run or trading change. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import crypto from "crypto";
import readline from "readline";
import { read, lines, fileHash } from "./hype-failed-recovery-study";
import { verifyPins, atomicJson } from "./research-workflow";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const D = 86400000, M = 60000, near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export function regime(r28: number, r7: number) {
  assert(Number.isFinite(r28) && Number.isFinite(r7));
  return r28 < -5 ? "down" : r28 <= 5 ? "sideways" : r7 <= -5 ? "uptrend_pullback" : "other_uptrend";
}
async function verifyArchivedPrefixes(pins: R[]) {
  for (const p of pins) {
    assert(fs.statSync(p.file).size >= p.bytes, `Archive truncated: ${p.file}`);
    const h = crypto.createHash("sha256");
    for await (const b of fs.createReadStream(p.file, { end: p.bytes - 1 })) h.update(b);
    assert.equal(h.digest("hex"), p.sha256, `Archived prefix changed: ${p.file}`);
  }
}
async function archivedPrices(cutoff: number, repair: string, streamPin: R) {
  // Consume exactly the accepted bytes, not the later synced tail (including any late duplicate).
  const map = new Map<number, Candle>();
  const add = (r: R) => { const ts = Number(r.ts ?? r.timestamp); if (ts + M > cutoff) return;
    const c = { ts, endTs: ts + M, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high), low: Number(r.l ?? r.low),
      close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) };
    assert(Object.values(c).every(Number.isFinite)); map.set(ts, c); };
  read("data/HYPEUSDT_1_full.json").forEach(add);
  for await (const line of readline.createInterface({ input: fs.createReadStream(streamPin.file, { end: streamPin.bytes - 1 }), crlfDelay: Infinity })) {
    if (line.trim()) add(JSON.parse(line));
  }
  const cs = applyCandleRepair([...map.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(repair), "HYPEUSDT", cutoff);
  cs.forEach((c, i) => assert.equal(c.ts, cs[0].ts + i * M)); assert.equal(cs.at(-1)!.endTs, cutoff); return cs;
}
export async function main() {
  const root = path.resolve(__dirname, ".."), cardFile = "research-inputs/age10-regime-attribution-2026-09-11.json", card = read(cardFile);
  const accepted = card.accepted, plan = read(`${accepted}/plan.json`), state = read(`${accepted}/state.json`), verification = read(`${accepted}/verification.json`);
  assert.equal(state.status, "complete"); assert(verification.passed);
  const prefixes = plan.pins.filter((p: R) => p.file.startsWith("data/") && p.file.endsWith(".jsonl"));
  const prefixFiles = new Set(prefixes.map((p: R) => p.file));
  // Synced runtime state is neither a price nor a saved-ledger input to this attribution.
  // Preserve it at its current hash; never rewrite the accepted job's old fingerprint.
  const pins = [...plan.pins, ...plan.protectedPins, ...state.artifacts].filter((p: R) => p.file !== "bot-state.json" && !prefixFiles.has(p.file));
  const runtimeStateAtStart = { file: "bot-state.json", bytes: fs.statSync("bot-state.json").size, sha256: await fileHash("bot-state.json") };
  await verifyPins(root, pins); await verifyArchivedPrefixes(prefixes);
  const out = `backtests/hype/${card.id}`; assert(!fs.existsSync(out), "Fresh diagnostic output required");
  const cs = await archivedPrices(Date.parse(plan.card.definition.cutoff), read(`${plan.card.definition.archive}/manifest.json`).repairFile,
    prefixes.find((p: R) => p.file === "data/HYPEUSDT_1m.jsonl"));
  const byEnd = new Map(cs.map(c => [c.endTs, c]));
  function stateAt(day: number) {
    const c = byEnd.get(day), old28 = byEnd.get(day - 28 * D), old7 = byEnd.get(day - 7 * D); assert(c && old28 && old7);
    const r28 = (c.close / old28.close - 1) * 100, r7 = (c.close / old7.close - 1) * 100;
    return { day, iso: new Date(day).toISOString(), price: c.close, r28, r7, regime: regime(r28, r7) };
  }
  const regimes = new Map<number, R>();
  const rows: R[] = read(`${accepted}/output/results.json`).filter((x: R) => x.primary && card.policies.includes(x.policy)), results: R[] = [];
  const fee = plan.card.definition.feeRate, capital = plan.card.definition.initialEquity;
  for (const x of rows) {
    const events: R[] = []; await lines(`${accepted}/output/${x.name}-inventory.jsonl`, e => events.push(e));
    assert.deepEqual(auditCombinationAccounting(cs, events as any, x.metrics, x.startIdx, x.endIdx, capital, fee, { fraction: 1, fillDelayMs: 0 }), x.accounting);
    let inv: R[] = [], pointer = 0, realized = 0, previousEquity = capital, peak = capital, dd = 0;
    let activeRegime = "", stintPeak = capital, stintDd = 0, stintStart = 0, stintStartEquity = capital;
    const daily = new Map<number, R>(), stints: R[] = [], monthEnd = new Map<string, number>();
    function settle(e: R) {
      assert.deepEqual(inv, e.before);
      if (e.event.kind !== "open") for (const p of inv) {
        const q = p.qty - (e.after.find((a: R) => a.id === p.id)?.qty ?? 0);
        realized += q * (e.event.price - p.entryPrice) - q * (e.event.price + p.entryPrice) * fee;
      }
      inv = e.after;
    }
    const equity = (price: number) => capital + realized + inv.reduce((n, p) => n + p.qty * (price - p.entryPrice) - p.qty * (price + p.entryPrice) * fee, 0);
    for (let i = x.startIdx; i < x.endIdx; i++) {
      const c = cs[i], day = Math.floor(c.ts / D) * D;
      if (!regimes.has(day)) regimes.set(day, stateAt(day)); const label = regimes.get(day)!;
      if (label.regime !== activeRegime) {
        if (activeRegime) stints.push({ regime: activeRegime, start: stintStart, end: c.ts, net: previousEquity - stintStartEquity, dd: stintDd });
        activeRegime = label.regime; stintStart = c.ts; stintStartEquity = previousEquity; stintPeak = previousEquity; stintDd = 0;
      }
      while (events[pointer]?.event.fillIndex === i && events[pointer].event.fillAt === c.ts) settle(events[pointer++]);
      const low = equity(c.low);
      while (events[pointer]?.event.fillIndex === i) settle(events[pointer++]);
      const close = equity(c.close);
      for (const value of [low, close]) { peak = Math.max(peak, value); dd = Math.max(dd, (peak - value) / peak * 100);
        stintPeak = Math.max(stintPeak, value); stintDd = Math.max(stintDd, (stintPeak - value) / stintPeak * 100); }
      let d = daily.get(day); if (!d) { d = { ...label, startEquity: previousEquity, net: 0, minutes: 0 }; daily.set(day, d); }
      d.net += close - previousEquity; d.minutes++; d.endEquity = close; previousEquity = close;
      // L15 attributes the exactly-midnight close to the new month by endTs. Preserve that audit boundary separately.
      monthEnd.set(new Date(c.endTs).toISOString().slice(0, 7), close);
    }
    stints.push({ regime: activeRegime, start: stintStart, end: cs[x.endIdx - 1].endTs, net: previousEquity - stintStartEquity, dd: stintDd });
    assert.equal(pointer, events.length); near(previousEquity - capital, x.metrics.totalPnl); near(dd, x.metrics.maxDrawdownPct);
    let prior = capital;
    for (const m of x.metrics.monthly) { const end = monthEnd.get(m.month)!; near(end - prior, m.mtmPnl); prior = end; }
    const ds = [...daily.values()], summary = ["down", "sideways", "uptrend_pullback", "other_uptrend"].map(r => {
      const xs = ds.filter(d => d.regime === r), ss = stints.filter(s => s.regime === r);
      const es = x.metrics.episodes.filter((e: R) => {
        const day = Math.floor(Date.parse(e.entry) / D) * D;
        if (!regimes.has(day)) regimes.set(day, stateAt(day)); return regimes.get(day)!.regime === r;
      });
      return { regime: r, days: xs.length, equivalentFullDays: xs.reduce((n, d) => n + d.minutes / 1440, 0),
        mtmNet: xs.reduce((n, d) => n + d.net, 0), stints: ss.length,
        worstContinuousStintDd: ss.length ? Math.max(...ss.map(s => s.dd)) : null,
        entryCohortWins: es.filter((e: R) => e.pnl > 0).length, entryCohortLosses: es.filter((e: R) => e.pnl < 0).length,
        entryCohortWinningDollars: es.reduce((n: number, e: R) => n + Math.max(0, e.pnl), 0),
        entryCohortLosingDollars: es.reduce((n: number, e: R) => n + Math.min(0, e.pnl), 0) };
    });
    near(summary.reduce((n, s) => n + s.mtmNet, 0), x.metrics.totalPnl);
    const months = x.metrics.monthly.map((m: R) => {
      const start = Date.parse(`${m.month}-01T00:00:00Z`), dt = new Date(start), end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
      const a = byEnd.get(start), b = byEnd.get(end), complete = start >= Date.parse(x.start) && end <= Date.parse(x.end);
      const ret = complete && a && b ? (b.close / a.close - 1) * 100 : null;
      return { ...m, complete, priceReturn: ret, label: ret === null ? "partial" : ret < -5 ? "down" : ret <= 5 ? "sideways" : "up" };
    });
    results.push({ policy: x.policy, model: x.model, start: x.start, end: x.end, verifiedNet: x.metrics.totalPnl, verifiedDd: dd, daily: ds, stints, summary, months });
    console.log(`[regime attribution] ${x.model} / ${x.policy}: original net/DD and all months reproduced`);
  }
  const sources = [cardFile, "scripts/age10-regime-attribution.ts", "scripts/age10-regime-attribution-tests.ts"];
  const sourcePins = await Promise.all(sources.map(async file => ({ file, sha256: await fileHash(file) })));
  await verifyPins(root, [...pins, runtimeStateAtStart]); await verifyArchivedPrefixes(prefixes); fs.mkdirSync(out, { recursive: true });
  atomicJson(`${out}/results.json`, results); atomicJson(`${out}/regimes.json`, [...regimes.values()].sort((a, b) => a.day - b.day));
  atomicJson(`${out}/manifest.json`, { card, sourcePins, acceptedKey: plan.key, pins, archivedPrefixes: prefixes,
    runtimeStateAtStart, archivedRuntimeState: plan.protectedPins.find((p: R) => p.file === "bot-state.json"),
    syncedTailsExcluded: true, runtimeStateNotAnAnalysisInput: true, newTradingDefinitions: 0, newEconomicReplays: 0, liveChanges: 0 });
  atomicJson(`${out}/verification.json`, { passed: true, cases: results.length, reconciledOriginalNetDdAndMonthly: true,
    regimesUseOnlyClosedPricesAtDayStart: true, newTradingDefinitions: 0, newEconomicReplays: 0, liveChanges: 0 });
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
