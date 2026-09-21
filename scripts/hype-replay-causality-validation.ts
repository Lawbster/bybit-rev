/** Unchanged-policy replay validation after the September 4 infrastructure repairs.
 * Local only. Refuses output overwrite. No variant sweep, trading or live state mutation.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { BotConfig } from "../src/bot/bot-config";
import { REPLAY_CAUSALITY_VERSION } from "./replay-causality";
import { rebuildDamagedLatch, addReplayTaker, type ReplayTaker } from "./replay-damaged-latch";

async function main() {
  const root = path.resolve(__dirname, "..");
  const out = path.resolve(root, process.env.REPAIR_OUT || "backtests/hype/replay-causality-repair-2026-09-04/repaired");
  const relative = path.relative(path.join(root, "backtests"), out);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside backtests/");
  if (fs.existsSync(out)) throw new Error(`Refusing overwrite: ${out}`);
  process.env.SIM_START = "2025-07-01T00:00:00Z";
  process.env.SIM_END = "2026-08-19T21:32:00Z";
  process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay");
  const dormant = await import("./hype-dormant-edge-replay");
  const config: BotConfig = JSON.parse(fs.readFileSync(path.join(root, "bot-config.json"), "utf8"));
  const latchConfig = config.filters.damagedRegimeLatch;
  if (!latchConfig || typeof latchConfig.enabled !== "boolean") throw new Error("Missing filters.damagedRegimeLatch configuration");
  fs.mkdirSync(out, { recursive: true });
  const write = (name: string, data: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + "\n");
  const inputs = fs.readdirSync(path.join(root, "data")).filter(f => /^(HYPEUSDT|BTCUSDT)_(1_full\.json|1m\.jsonl|funding.*\.(json|jsonl)|.*(hyperliquid|binance).*\.jsonl|oi_live\.jsonl|liquidations\.jsonl)$/.test(f)).map(f => {
    const file = path.join("data", f), s = fs.statSync(path.join(root, file)); return { file, bytes: s.size, mtimeMs: s.mtimeMs };
  });
  const sources = ["scripts/replay-causality.ts", "scripts/replay-damaged-latch.ts", "scripts/hype-freerun-canonical-replay.ts", "scripts/hype-dormant-edge-replay.ts", "scripts/hype-replay-causality-validation.ts", "src/bot/damaged-regime-latch.ts", "bot-config.json"].map(file => ({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") }));
  const manifest = { capturedAt: new Date().toISOString(), causalityVersion: REPLAY_CAUSALITY_VERSION, sources, inputs,
    settings: { start: process.env.SIM_START, end: process.env.SIM_END, equity: 32000, entryAndExitPolicy: "unchanged", hlTakerWithoutReceiptLagMs: 60_000 },
    qualifications: ["Event/source-time causal alignment, not certified network-arrival parity", "Historical HL taker receipt time absent: explicit one-minute publication assumption", "Minute candle execution, no maker lifecycle/long funding; no deployable profit claim", "Archived sim-exact is not current-stack parity certified"] };
  write("manifest.json", manifest);
  const s = await core.buildSeries();
  await dormant.attachDormantSeries(s, Math.max(0, core.lowerBound(s.candles, Date.parse("2026-05-03T20:43:00Z"), c => c.endTs)));
  const taker: ReplayTaker = new Map();
  await core.streamJsonl(path.join(root, "data/HYPEUSDT_taker_hyperliquid.jsonl"), r => {
    addReplayTaker(taker, r);
  });
  const latch = rebuildDamagedLatch(s.candles, latchConfig, taker);
  s.regimeFlat = s.regimeFlat.map((x, i) => x || latch.blocked[i]);
  write("rebuilt-latch.json", { initialState: latch.initialState, transitions: latch.transitions.map(x => ({ ...x, iso: new Date(x.at).toISOString() })) });
  // Archived source-time-only diagnostic, not the current execution-certified runner.
  const params: import("./hype-freerun-canonical-replay").EngineParams = { id: "unchanged_policy_causal_v2", executionModel: "legacy_ohlc", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none",
    srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: .3, minLadderPnlPct: .25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 }, supportReopen: { minNextDepth: 5, bufferPct: 1, mode: "buy_pressure" } } };
  const windows = [{ id: "published_window", start: Date.parse(process.env.SIM_START) }, { id: "hl_window", start: Date.parse("2026-05-17T20:43:00Z") }];
  const summary = [];
  for (const w of windows) {
    const opts = { startIdx: core.lowerBound(s.candles, w.start, c => c.endTs) };
    const a = core.runEngine(params, s, opts), b = core.runEngine(params, s, opts);
    const digest = (x: typeof a) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
    if (digest(a) !== digest(b)) throw new Error(`Nondeterministic engine result: ${w.id}`);
    core.writeCsv(path.join(out, `${w.id}-closes.csv`), a.closes);
    core.writeCsv(path.join(out, `${w.id}-trims.csv`), a.trims);
    const monthly = new Map<string, number>();
    for (const c of a.closes) monthly.set(c.closeIso.slice(0, 7), (monthly.get(c.closeIso.slice(0, 7)) || 0) + c.pnl);
    for (const t of a.trims) monthly.set(t.iso.slice(0, 7), (monthly.get(t.iso.slice(0, 7)) || 0) + t.pnl);
    core.writeCsv(path.join(out, `${w.id}-monthly.csv`), [...monthly].map(([month, realizedPnl]) => ({ month, realizedPnl })));
    summary.push({ window: w.id, totalPnl: a.realized + a.openPnl, realized: a.realized, openPnl: a.openPnl, closes: a.closes.length, trims: a.trims.length, maxDrawdownPct: a.maxDrawdownPct, repeatDigest: digest(a), identicalRepeat: true,
      reasons: a.closes.reduce((acc: Record<string, number>, c) => { acc[c.reason] = (acc[c.reason] || 0) + 1; return acc; }, {}) });
  }
  for (const x of inputs) { const stat = fs.statSync(path.join(root, x.file)); if (stat.size !== x.bytes || stat.mtimeMs !== x.mtimeMs) throw new Error(`Input changed during run: ${x.file}`); }
  write("summary.json", summary);
  write("validation.json", { unitRegressionRequired: "scripts/replay-causality-tests.ts", repeatedEngineEquality: true, rawInputsUnchangedDuringRun: true, exactLiveParityCertified: false, oldHeadlineIsLegacyOnly: true });
  console.log(JSON.stringify(summary, null, 2));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
