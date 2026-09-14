import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import ts from "typescript";
import { createRequire } from "module";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-parity-"));
const dataDir = path.join(dir, "data"); fs.mkdirSync(dataDir);
const files: string[] = [];
let clock = 1_800_000_060_000;
// Same ACTUAL consumer, once retaining original full rows and once projecting.
// Neither consumer is imported with the production working directory.
function consumer(name: string, reference: boolean): any {
  const file = path.resolve(`src/bot/${name}.ts`), requireHere = createRequire(file);
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, __dirname: path.dirname(file),
    process: { cwd: () => dir, env: {} }, console,
    Date: class extends Date { static now() { return clock; } },
    require: (name: string) => name === "./pulse-row-projection" && reference
      ? { projectPulseRow: (_file: string, row: any, ts: number) => ({ ...row, ts }) } : requireHere(name) });
  vm.runInContext(compiled, context);
  return module.exports;
}

async function main() {
  try {
    const streams = ["taker_binance", "taker_hyperliquid", "ob_bands_hyperliquid", "asset_ctx_hyperliquid",
      "liquidations", "oi_live", "oi_live_binance", "oi_live_hyperliquid", "funding_live", "funding_live_binance", "funding_live_hyperliquid"];
    const bands = { pct_0_25: 10, pct_0_5: 20, pct_2_0: 30, unused_band: 999 };
    const flags = { pct_0_25: false, pct_0_5: false, pct_2_0: false };
    const baseRows = Array.from({ length: 500 }, (_, i) => {
      const timestamp = clock - (499 - i) * 60_000;
      return { timestamp, receivedAt: timestamp - 50, exchangeTimestamp: timestamp - 100,
        buyVol: i % 7, sellVol: i % 9, buyNotional: i * 2, sellNotional: i * 3,
        openInterestValue: 10000 + i, openInterest: 100, markPrice: 100 + i,
        fundingRate: i / 1e7, liquidatedSide: i % 2 ? "long" : "short", notionalUsd: i,
        bidBands: bands, askBands: bands, bidBandsTruncated: flags, askBandsTruncated: flags,
        bandResolutionTooCoarse: flags, imbalance_0_5: .2, imbalance_2_0: -.3,
        o: 100 + i, c: 101 + i, unused: "discard me" };
    });
    for (const name of [...streams.map(s => `TESTUSDT_${s}.jsonl`), "BTCUSDT_1m.jsonl"]) {
      const file = path.join(dataDir, name); files.push(file);
      // Out-of-order and equal-time rows, numeric/ISO aliases, bad/unfinished tails.
      const rows: any[] = [...baseRows.slice().reverse(), { ...baseRows[499], buyVol: 333 },
        { ts: new Date(clock - 60_000).toISOString(), fundingRate: .1 }, { time: String(clock - 120_000), fundingRate: .2 }];
      fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join("\n") + '\ninvalid\n{"unfinished":');
    }
    const pulseRef = consumer("shadow-logger", true), pulse = consumer("shadow-logger", false);
    const scoreRef = consumer("score-partial-flatten", true), score = consumer("score-partial-flatten", false);
    const positions = [{ id: "p", entryTime: clock - 14_400_000, qty: 10, notional: 1000, entryPrice: 100, level: 0 }];
    const boundary = Math.floor(clock / 300_000) * 300_000;
    const candles = Array.from({ length: 10_100 }, (_, i) => ({ timestamp: boundary - (10100 - i) * 300_000,
      open: 100, high: 101, low: 99, close: 100 + .1 * Math.sin(i), volume: 1, turnover: 100 }));
    let comparisons = 0;
    const compare = async () => {
      for (const at of [clock, clock - 900_000, clock + 1]) {
        assert.equal(JSON.stringify(await pulse.computeOnChainFeatures("TESTUSDT", at)), JSON.stringify(await pulseRef.computeOnChainFeatures("TESTUSDT", at)));
        assert.equal(JSON.stringify(await score.buildScoreFeatures("TESTUSDT", at, 99, positions, candles)),
          JSON.stringify(await scoreRef.buildScoreFeatures("TESTUSDT", at, 99, positions, candles)));
        comparisons += 2;
      }
    };
    await compare(); // cold + warm + backwards query windows
    fs.appendFileSync(files[0], '\n' + JSON.stringify({ timestamp: clock, buyVol: 900, sellVol: 1 }) + '\n');
    await compare(); // retained TTL, not premature incremental freshness
    clock += 30_001; await compare(); // expiry
    fs.unlinkSync(files[1]); await compare(); // consumers intentionally differ on warm missing file
    fs.writeFileSync(files[1], "");
    fs.writeFileSync(files[2], JSON.stringify({ timestamp: clock, bidBands: {}, askBands: {}, receivedAt: null }));
    clock += 30_001; await compare(); // truncate/replacement/missing book evidence
    const large = Array.from({ length: 950 }, (_, i) => JSON.stringify({ timestamp: clock - i * 60000, o: 10, c: 11, unused: "x".repeat(10000) })).join("\n");
    fs.writeFileSync(files.at(-1)!, large); clock += 30_001; await compare(); // independent 4/6 MiB cutoffs
    console.log(`pulse projection parity passed (${comparisons} full feature-vector comparisons)`);
  } finally {
    for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dataDir); fs.rmdirSync(dir);
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
