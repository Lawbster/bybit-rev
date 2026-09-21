/** Independent labels/partition audit; never runs or changes a trading policy. */
import fs from "fs";
import assert from "assert/strict";
import readline from "readline";
import crypto from "crypto";
import { read, fileHash } from "./hype-failed-recovery-study";
import { atomicJson, verifyPins } from "./research-workflow";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;
const D = 86400000, M = 60000;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const dir = "backtests/hype/age10-regime-attribution-2026-09-11", manifest = read(`${dir}/manifest.json`);
  await verifyPins(process.cwd(), manifest.pins);
  for (const p of manifest.sourcePins) assert.equal(await fileHash(p.file), p.sha256);
  const accepted = manifest.card.accepted, plan = read(`${accepted}/plan.json`), cutoff = Date.parse(plan.card.definition.cutoff);
  const pin = manifest.archivedPrefixes.find((p: R) => p.file === "data/HYPEUSDT_1m.jsonl"), h = crypto.createHash("sha256");
  for await (const b of fs.createReadStream(pin.file, { end: pin.bytes - 1 })) h.update(b);
  assert.equal(h.digest("hex"), pin.sha256);
  const byStart = new Map<number, Candle>();
  const add = (r: R) => { const ts = Number(r.ts ?? r.timestamp); if (ts + M <= cutoff) byStart.set(ts,
    { ts, endTs: ts + M, open: +(r.o ?? r.open), high: +(r.h ?? r.high), low: +(r.l ?? r.low), close: +(r.c ?? r.close),
      volume: +(r.v ?? r.volume), turnover: +(r.t ?? r.turnover) }); };
  read("data/HYPEUSDT_1_full.json").forEach(add);
  for await (const line of readline.createInterface({ input: fs.createReadStream(pin.file, { end: pin.bytes - 1 }), crlfDelay: Infinity })) if (line.trim()) add(JSON.parse(line));
  const cs = applyCandleRepair([...byStart.values()].sort((a, b) => a.ts - b.ts),
    readCandleRepair(read(`${plan.card.definition.archive}/manifest.json`).repairFile), "HYPEUSDT", cutoff);
  const close = new Map(cs.map(c => [c.endTs, c.close]));
  const original: R[] = read(`${accepted}/output/results.json`), rows: R[] = read(`${dir}/results.json`);
  assert.equal(rows.length, 24); assert.equal(new Set(rows.map(r => `${r.model}/${r.policy}`)).size, 24);
  let dailyChecks = 0, monthlyChecks = 0;
  for (const r of rows) {
    const source = original.find(o => o.primary && o.model === r.model && o.policy === r.policy)!; assert(source);
    near(r.verifiedNet, source.metrics.totalPnl); near(r.verifiedDd, source.metrics.maxDrawdownPct);
    let eq = plan.card.definition.initialEquity;
    for (const [i, d] of r.daily.entries()) {
      assert.equal(d.day % D, 0); if (i) assert.equal(d.day, r.daily[i - 1].day + D);
      const p = close.get(d.day)!, p7 = close.get(d.day - 7 * D)!, p28 = close.get(d.day - 28 * D)!;
      assert(p && p7 && p28); near(d.price, p);
      const a = 100 * (p / p28 - 1), b = 100 * (p / p7 - 1); near(d.r28, a); near(d.r7, b);
      const label = a < -5 ? "down" : a > 5 ? (b <= -5 ? "uptrend_pullback" : "other_uptrend") : "sideways";
      assert.equal(d.regime, label); near(d.startEquity, eq); near(d.endEquity - d.startEquity, d.net); eq = d.endEquity; dailyChecks++;
    }
    near(eq - plan.card.definition.initialEquity, r.verifiedNet);
    assert.equal(r.daily.reduce((n: number, d: R) => n + d.minutes, 0), source.endIdx - source.startIdx);
    for (const s of r.summary) {
      const ds = r.daily.filter((d: R) => d.regime === s.regime), stints = r.stints.filter((t: R) => t.regime === s.regime);
      assert.equal(s.days, ds.length); assert.equal(s.stints, stints.length);
      near(s.mtmNet, ds.reduce((n: number, d: R) => n + d.net, 0));
      near(s.mtmNet, stints.reduce((n: number, d: R) => n + d.net, 0));
      if (stints.length) near(s.worstContinuousStintDd, Math.max(...stints.map((t: R) => t.dd)));
    }
    assert.equal(r.stints[0].start, cs[source.startIdx].ts);
    assert.equal(r.stints.at(-1).end, cs[source.endIdx - 1].endTs);
    for (let i = 1; i < r.stints.length; i++) assert.equal(r.stints[i].start, r.stints[i - 1].end);
    for (const m of r.months) {
      const old = source.metrics.monthly.find((a: R) => a.month === m.month); near(m.mtmPnl, old.mtmPnl);
      const start = Date.parse(`${m.month}-01T00:00:00Z`), dt = new Date(start), end = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1);
      const full = start >= Date.parse(source.start) && end <= Date.parse(source.end); assert.equal(m.complete, full);
      if (full) { const ret = 100 * (close.get(end)! / close.get(start)! - 1); near(m.priceReturn, ret);
        assert.equal(m.label, ret < -5 ? "down" : ret > 5 ? "up" : "sideways"); }
      else { assert.equal(m.label, "partial"); assert.equal(m.priceReturn, null); }
      monthlyChecks++;
    }
  }
  const receipt = { passed: true, cases: rows.length, dailyChecks, monthlyChecks,
    sourceHashesMatch: true, acceptedCandlePrefixExact: true, labelsIndependentOfTradingOutcomes: true,
    dailyAndContiguousStintPartitionsReconcile: true, newEconomicReplays: 0,
    checkerSha256: await fileHash("scripts/age10-regime-attribution-check.ts"),
    outputs: await Promise.all(["results.json", "regimes.json", "manifest.json", "verification.json"].map(async f => ({ file: `${dir}/${f}`, sha256: await fileHash(`${dir}/${f}`) }))) };
  if (process.argv.includes("--write")) { assert(!fs.existsSync(`${dir}/independent-check.json`)); atomicJson(`${dir}/independent-check.json`, receipt); }
  console.log(JSON.stringify(receipt, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
