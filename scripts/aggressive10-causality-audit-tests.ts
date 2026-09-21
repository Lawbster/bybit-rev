/** Local audit only. No order/config/state mutations or exchange requests.
 * Tests the real feature builders; also records unsafe legacy API contracts.
 * A passing limitation test means the limitation was reproduced, NOT fixed.
 */
import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd(), M = 60000, H = 60 * M;
const START = Date.UTC(2026, 6, 1);
const N = 60253; // Deliberately inside a 4h/1h/day bucket; >249 completed 4h bars.
const AT = START + N * M;
const hash = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const protectedFiles = ["bot-config.json", "bot-state.json", "hl-short-live-config.json", "src/bot/index.ts",
  "src/bot/shadow-logger.ts", "src/hyperliquid-collector.ts", "scripts/replay-causal-engine.ts"];
const before = protectedFiles.map(file => hash(path.join(ROOT, file)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aggressive10-causality-audit-"));
const data = path.join(dir, "data"); fs.mkdirSync(data);
const json = (name: string, value: unknown) => fs.writeFileSync(path.join(data, name), JSON.stringify(value));
const jsonl = (name: string, rows: unknown[]) => fs.writeFileSync(path.join(data, name), rows.map(r => JSON.stringify(r)).join("\n") + "\n");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "bot-config.json"), "utf8"));
fs.writeFileSync(path.join(dir, "bot-config.json"), JSON.stringify(cfg));

async function main() {
  const oldStart = process.env.SIM_START, oldEnd = process.env.SIM_END;
  try {
    // Actual builders capture ROOT on import. Redirect only this test process to
    // an owned temporary fixture, never the live data/config directories.
    process.chdir(dir);
    process.env.SIM_START = new Date(START).toISOString();
    delete process.env.SIM_END;
    const core = await import("./hype-freerun-canonical-replay");
    const { ReplayMarketInputs } = await import("./replay-market-inputs");
    const { rebuildDamagedLatch } = await import("./replay-damaged-latch");
    const { ReplaySrContext } = await import("./replay-sr-context");
    const { aggressive10HighSnapshot } = await import("../src/bot/aggressive10-policy");
    const { trailingHighIndices } = await import("./near-high-policy");

    const rows = Array.from({ length: N + 700 }, (_, i) => {
      const p = 100 + 8 * Math.sin(i / 1300) + Math.sin(i / 83);
      return { timestamp: START + i * M, open: p, high: p + .2, low: p - .2,
        close: p, volume: 3, turnover: 3 * p };
    });
    const streams = ["funding_live", "funding_live_binance", "funding_live_hyperliquid",
      "taker_hyperliquid", "asset_ctx_hyperliquid", "ob_bands_hyperliquid"];
    json("HYPEUSDT_funding.json", []);
    for (const stream of streams) jsonl(`HYPEUSDT_${stream}.jsonl`, []);
    for (const symbol of ["HYPEUSDT", "BTCUSDT"]) json(`${symbol}_1_full.json`, rows.slice(0, N));
    const prefix = await core.buildSeries();
    assert.equal(prefix.candles.length, N);
    assert.notEqual(prefix.rsi1H.at(-1), null); assert.notEqual(prefix.crsi4H.at(-1), null);

    // Poison the not-yet-closed part of the current higher-timeframe bucket and
    // every later minute. No earlier trend/ROC/RSI/CRSI/daily/HL/high value may move.
    const poisoned = rows.map((c, i) => i < N ? c : { ...c, open: 10000, high: 20000, low: 1, close: 10000 });
    for (const symbol of ["HYPEUSDT", "BTCUSDT"]) json(`${symbol}_1_full.json`, poisoned);
    jsonl("HYPEUSDT_asset_ctx_hyperliquid.jsonl", [{ timestamp: AT - M, writtenAt: AT + 1000, openInterestValue: 1e9, fundingRate: -.1 }]);
    jsonl("HYPEUSDT_ob_bands_hyperliquid.jsonl", [{ timestamp: AT + 1000, imbalance_0_5: -1, bidBands: { pct_0_5: 1 }, askBands: { pct_0_5: 1e9 } }]);
    jsonl("HYPEUSDT_taker_hyperliquid.jsonl", [{ timestamp: AT, windowEnd: AT, buyNotional: 1, sellNotional: 1e9 }]);
    for (const stream of streams.filter(s => s.startsWith("funding"))) jsonl(`HYPEUSDT_${stream}.jsonl`, [{ timestamp: AT - M, receivedAt: AT + 1000, fundingRate: -.1 }]);
    const full = await core.buildSeries();
    let arrays = 0;
    for (const [key, value] of Object.entries(prefix)) if (Array.isArray(value)) {
      assert.deepEqual((full as any)[key].slice(0, N), value, `${key}: future suffix changed past`); arrays++;
    }
    assert(full.fundingStress.slice(N).some(Boolean), "poison must eventually become eligible");
    assert.notEqual(full.crsi4H[N], prefix.crsi4H[N - 1], "future candle poison is non-vacuous");
    console.log(`PASS actual canonical buildSeries: ${arrays} arrays x ${N} prefix decisions, extreme future HYPE/BTC and delayed pulse`);

    const tape = new ReplayMarketInputs();
    const kinds = ["byOi", "bnOi", "hlOi", "asset", "book", "byFunding", "bnFunding", "hlFunding", "vault", "hlTaker", "bnTaker"] as const;
    const observation = (timestamp: number, patch: Record<string, unknown> = {}) => ({ timestamp,
      windowEnd: timestamp, receivedAt: timestamp, writtenAt: timestamp, exchangeTimestamp: timestamp,
      openInterest: 100, openInterestValue: 10000, markPrice: 100, fundingRate: .0001, fundingIntervalHours: 1,
      premium: .01, oraclePrice: 100, apr: .1, maxDistributable: 100,
      buyNotional: 2, sellNotional: 1, buyVol: 2, sellVol: 1,
      bidBands: { pct_0_25: 200, pct_0_5: 200, pct_2_0: 200 },
      askBands: { pct_0_25: 100, pct_0_5: 100, pct_2_0: 100 },
      bidBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: false },
      askBandsTruncated: { pct_0_25: false, pct_0_5: false, pct_2_0: false },
      bandResolutionTooCoarse: { pct_0_25: false, pct_0_5: false, pct_2_0: false }, ...patch });
    for (const kind of kinds) for (const ago of [240, 60, 1]) tape.add(kind, observation(AT - ago * M));
    tape.seal(); const base = tape.snapshot(AT), latchBase = tape.latchPulse(AT);
    for (const kind of kinds) for (const field of ["timestamp", "receivedAt", "writtenAt", "observedAt", "ingestedAt"] as const) {
      const other = new ReplayMarketInputs();
      for (const k of kinds) for (const ago of [240, 60, 1]) other.add(k, observation(AT - ago * M));
      other.add(kind, observation(AT - M / 2, { [field]: AT + 1,
        buyNotional: 1e9, buyVol: 1e9, openInterestValue: 1e12, fundingRate: -.1 }));
      other.seal(); assert.deepEqual(other.snapshot(AT), base, `${kind}/${field}`);
      assert.deepEqual(other.latchPulse(AT), latchBase, `${kind}/${field} latch`);
    }
    const late = new ReplayMarketInputs();
    late.add("hlTaker", observation(AT - 61 * M, { writtenAt: AT })); late.seal();
    assert.equal(late.latchPulse(AT).taker1hSamples, 0, "late flow must retain its OLD event window");
    console.log("PASS all 11 replay pulse kinds x 5 future-availability fields; late-flow event window");

    const a = rebuildDamagedLatch(prefix.candles, cfg.filters.damagedRegimeLatch, new Map(), at => tape.latchPulse(at));
    const b = rebuildDamagedLatch(full.candles, cfg.filters.damagedRegimeLatch, new Map(), at => tape.latchPulse(at));
    assert.deepEqual(a.blocked, b.blocked.slice(0, N));
    assert.deepEqual(a.transitions, b.transitions.filter(t => t.at <= AT));
    assert.deepEqual(trailingHighIndices(prefix.candles, 2880), trailingHighIndices(full.candles, 2880).slice(0, N));
    const native = (cs: typeof prefix.candles) => cs.map(c => ({ ...c, timestamp: c.ts }));
    assert.deepEqual(aggressive10HighSnapshot(native(prefix.candles), AT + 5000), aggressive10HighSnapshot(native(full.candles), AT + 5000));
    const zcfg = { ...cfg.srShadow, enabled: true };
    const za = new ReplaySrContext(prefix.candles, zcfg).at(AT), zb = new ReplaySrContext(full.candles, zcfg).at(AT);
    assert(za.coverage.healthy); assert(za.engine.getZones(AT).length > 0);
    assert.deepEqual(za.engine.getZones(AT), zb.engine.getZones(AT));
    console.log("PASS rebuilt damaged latch, rolling two-day highs, production high snapshot and nonempty 14d S/R zones");

    // Same explicit, previously verified repair overlay as the release runner;
    // never fetch or rewrite copied data. This is corrected history, not proof
    // of historical receipt. Omitting it leaves the known Aug28 minute gap.
    const card = JSON.parse(fs.readFileSync(path.join(ROOT, "research-inputs/aggressive10-release-parity-2026-09-11.json"), "utf8"));
    const recent = (await core.loadCandles1m("HYPEUSDT", path.join(ROOT, "data"), Infinity,
      path.join(ROOT, card.repairFile))).slice(-24000);
    const realAt = recent.at(-60)!.endTs;
    const realPrefix = recent.filter(c => c.endTs <= realAt);
    const realHigh = aggressive10HighSnapshot(native(recent), realAt + 5000);
    assert(realHigh.healthy);
    assert.deepEqual(realHigh, aggressive10HighSnapshot(native(realPrefix), realAt + 5000));
    const realZones = new ReplaySrContext(recent, zcfg).at(realAt);
    const prefixZones = new ReplaySrContext(realPrefix, zcfg).at(realAt);
    assert(realZones.coverage.healthy); assert(realZones.engine.getZones(realAt).length > 0);
    assert.deepEqual(realZones.engine.getZones(realAt), prefixZones.engine.getZones(realAt));
    const { ClosedBarSeries } = await import("../src/research/closed-bars");
    const { ClosedIndicatorSeries } = await import("../src/research/closed-indicators");
    const closed = (cs: typeof recent) => ClosedBarSeries.fromHistorical(native(cs),
      { sourceIntervalMs: M, targetIntervalMs: H, publicationLagMs: 0 });
    const closedFull = closed(recent), seedBarStart = closedFull.bars[0].candle.timestamp;
    const realIndicator = new ClosedIndicatorSeries(closedFull, { seedBarStart }).at(realAt);
    assert(realIndicator.ready, JSON.stringify(realIndicator));
    assert.deepEqual(realIndicator, new ClosedIndicatorSeries(closed(realPrefix), { seedBarStart }).at(realAt));
    console.log(JSON.stringify({ realData: "HYPEUSDT_1_full.json + HYPEUSDT_1m.jsonl", repairOverlay: card.repairFile,
      copiedThrough: new Date(recent.at(-1)!.endTs).toISOString(), decisionAt: new Date(realAt).toISOString(),
      high48h: realHigh.high, close: realHigh.close, zones: realZones.engine.getZones(realAt).length,
      rsi1hClosed: realIndicator.snapshot.values.rsi14, prefixEqual: true, arrival: "modeled_bar_end" }));

    // Reproduce excluded historical-API hazards. These are expected limitations,
    // not assertions that the live bot can physically receive future prices.
    const { computeOnChainFeatures } = await import("../src/bot/shadow-logger");
    jsonl("AUDITUSDT_taker_hyperliquid.jsonl", [observation(AT - M, { receivedAt: AT + M, writtenAt: AT + M, buyNotional: 999, sellNotional: 1 })]);
    jsonl("AUDITUSDT_liquidations.jsonl", [{ timestamp: AT + M, liquidatedSide: "long", notionalUsd: 12345 }]);
    const legacy = await computeOnChainFeatures("AUDITUSDT", AT);
    assert.equal(legacy.hlTaker15m, 999, "live-tail historical query ignores later publication");
    assert.equal(legacy.liq4hLongUsd, 12345, "live-tail liquidation sum lacks upper as-of bound");
    const { getContext } = await import("../src/technical-engine");
    const five = rows.slice(0, 1000).filter((_, i) => i % 5 === 0);
    const time = five.at(-1)!.timestamp + M;
    const original = getContext("HYPEUSDT", five, time);
    const changed = five.map((c, i) => i < five.length - 1 ? c : { ...c, high: 999, close: 999 });
    assert.notEqual(getContext("HYPEUSDT", changed, time).price, original.price,
      "historical asOf inside 5m includes that bar's final OHLC");
    console.log("CONFIRMED LIMITATIONS (not fixes): live-tail historical receipt/upper-bound leak; legacy getContext forming-final-bar leak");
  } finally {
    process.chdir(ROOT);
    if (oldStart === undefined) delete process.env.SIM_START; else process.env.SIM_START = oldStart;
    if (oldEnd === undefined) delete process.env.SIM_END; else process.env.SIM_END = oldEnd;
    assert.deepEqual(protectedFiles.map(file => hash(path.join(ROOT, file))), before, "protected files unchanged");
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.equal(path.dirname(path.resolve(data)), path.resolve(dir));
    // Only flat files created by this fixture; no recursive traversal/deletion.
    for (const file of fs.readdirSync(data)) fs.unlinkSync(path.join(data, file));
    fs.rmdirSync(data); fs.unlinkSync(path.join(dir, "bot-config.json")); fs.rmdirSync(dir);
  }
  console.log("aggressive10 causality audit tests passed; no live changes; historical arrival remains modeled");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
