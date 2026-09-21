import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { commonMaps, forecast, logReturn, correlation, forecastSummary, SYMBOLS } from "./market-proxy-comparison";
import { HOUR as H, type Hour } from "./relative-reversion-features";
import { loadMinutes } from "./relative-reversion-study";
const near = (a: number, b: number, eps = 1e-10) => assert(Math.abs(a - b) < eps, `${a} != ${b}`);
async function main() {
  near(correlation([1, 2, 3, 4], [3, 5, 7, 9])!, 1);
  near(correlation([1, 2, 3, 4], [9, 7, 5, 3])!, -1); assert.equal(correlation([1, 1, 1], [2, 3, 4]), null);
  const input = { HYPEUSDT: [] as Hour[], BTCUSDT: [] as Hour[], SOLUSDT: [] as Hour[] };
  let hp = 50, bp = 10000, sp = 100, previousSol = .001;
  for (let i = 0; i < 400; i++) {
    const b = Math.sin(i * .9) * .006, s = Math.cos(i * 1.9) * .01;
    hp *= Math.exp(.0002 + .7 * previousSol); bp *= Math.exp(b); sp *= Math.exp(s); previousSol = s;
    for (const [symbol, close] of [["HYPEUSDT", hp], ["BTCUSDT", bp], ["SOLUSDT", sp]] as const) input[symbol].push({ end: (1000 + i) * H, close });
  }
  const maps = commonMaps(input), at = input.HYPEUSDT[300].end;
  const f = forecast(maps, at, 0); assert(f.ready && f.trainingPairs === 168);
  near(f.predicted.SOLUSDT!, .0002 + .7 * logReturn(maps.SOLUSDT, at)!);
  const lag = forecast(maps, at, 60000); assert(lag.ready); assert.equal(lag.sourceEnd, at - H); assert.equal(lag.horizonHours, 2);
  assert.equal(lag.targetEnd, at + H); assert(lag.trainingEnd + 60000 <= at);
  const poisoned = Object.fromEntries(SYMBOLS.map(s => [s, input[s].map(x => x.end > at ? { ...x, close: x.close * 9 } : x)])) as typeof input;
  assert.deepEqual(forecast(commonMaps(poisoned), at, 0), f);
  const prefix = Object.fromEntries(SYMBOLS.map(s => [s, input[s].filter(x => x.end <= at)])) as typeof input;
  assert.deepEqual(forecast(commonMaps(prefix), at, 0), f);
  const withGap = commonMaps({ ...input, SOLUSDT: input.SOLUSDT.filter((_, i) => i !== 200) });
  assert(!withGap.BTCUSDT.has(input.SOLUSDT[200].end) && !withGap.HYPEUSDT.has(input.SOLUSDT[200].end));
  assert.equal(logReturn(withGap.SOLUSDT, input.SOLUSDT[201].end), null);
  assert(forecast(withGap, at, 0).trainingPairs < 168);
  const unavailable = commonMaps({ ...input, SOLUSDT: input.SOLUSDT.filter(x => x.end !== at) });
  assert.equal(forecast(unavailable, at, 0).ready, false);
  const scored = forecastSummary([{ ...f, actual: f.predicted.SOLUSDT }]); near(scored.models.SOLUSDT.mseSkillVsMeanPct!, 100);
  assert.equal(forecastSummary([{ ...f, actual: null }]).scored, 0);
  // Explicit collector-only loading; no missing archive fallback, no interpolation.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "market-proxy-test-")); fs.mkdirSync(path.join(root, "data"));
  const rows = [0, 1, 3, 3].map((n, i) => ({ ts: (1000 * H) + n * 60000, o: 100, h: 110, l: 99, c: 100 + i, v: 1, t: 100 }));
  fs.writeFileSync(path.join(root, "data/SOLUSDT_1m.jsonl"), rows.map(x => JSON.stringify(x)).join("\n"));
  await assert.rejects(loadMinutes(root, "SOLUSDT", 1001 * H));
  const loaded = await loadMinutes(root, "SOLUSDT", 1001 * H, undefined, null);
  assert.equal(loaded.candles.length, 3); assert.equal(loaded.audit.duplicates, 1); assert.equal(loaded.audit.revisions, 1);
  assert.equal(loaded.audit.gaps.length, 1); assert.equal(loaded.candles.at(-1)!.close, 103);
  console.log("market proxy tests passed: known causal leader, availability horizon, identical masks, future poison, gap and collector-only loader");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
