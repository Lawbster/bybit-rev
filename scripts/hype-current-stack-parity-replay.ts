/** Read-only research: reproduce the published August 20 control before any new comparisons.
 * npx ts-node scripts/hype-current-stack-parity-replay.ts
 * Output is local/ignored. Existing output directories are never overwritten.
 * This is NOT an exchange/maker simulator and does not authorize trading changes.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(__dirname, "..");
const CONTROL_END = Date.parse("2026-08-19T21:32:00Z");
const START = Date.parse("2025-07-01T00:00:00Z");
const DAY = 86_400_000;
const MIN = 60_000;

async function main(): Promise<void> {
  const out = path.resolve(ROOT, process.env.PARITY_OUT || "backtests/hype/current-stack-parity-2026-09-04/replay");
  const relative = path.relative(path.join(ROOT, "backtests"), out);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside backtests/");
  if (fs.existsSync(out)) throw new Error(`Refusing to overwrite ${out}; choose PARITY_OUT`);
  const health = JSON.parse(fs.readFileSync(path.join(ROOT, "data/HYPEUSDT_runtime_health.json"), "utf8"));
  const end = Math.floor(health.writtenAt / MIN) * MIN;
  if (!Number.isFinite(end) || end <= CONTROL_END) throw new Error("Invalid/stale snapshot cutoff");
  // Imports read environment at module initialization. Freeze it before loading them.
  const contextStart = process.env.PARITY_CONTEXT_START || new Date(START).toISOString();
  if (!Number.isFinite(Date.parse(contextStart))) throw new Error("Invalid PARITY_CONTEXT_START");
  process.env.SIM_START = contextStart;
  process.env.SIM_END = new Date(end - 1).toISOString();
  process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay");
  const dormant = await import("./hype-dormant-edge-replay");
  const { EMA } = await import("technicalindicators");
  fs.mkdirSync(out, { recursive: true });
  const write = (name: string, value: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
  const sourcePaths = ["bot-config.json", "hl-short-live-config.json", "scripts/hype-current-stack-parity-replay.ts", "scripts/hype-freerun-canonical-replay.ts", "scripts/hype-dormant-edge-replay.ts", "backtests/hype/current-regime-60d-2026-08-14/pause-intervals.csv", "backtests/hype/rung11-daily-high-delay-2026-08-20/summary.csv"];
  write("manifest.json", { capturedAt: new Date().toISOString(), sourceCutoff: new Date(end).toISOString(), contextStart, tradingStart: new Date(START).toISOString(), equityDenominator: 32000, sources: sourcePaths.map(file => ({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex") })), limitations: ["Taker-priced minute replay, no maker lifecycle or long funding", "Historical receipt/arrival-time availability not established by present files", "Control reproduction is not independent sim-exact or live parity certification"] });
  const series = await core.buildSeries();
  const gaps = series.candles.flatMap((c, i) => i && c.ts - series.candles[i - 1].ts !== MIN ? [{ previous: core.iso(series.candles[i - 1].ts), next: core.iso(c.ts), missingMinutes: (c.ts - series.candles[i - 1].ts) / MIN - 1 }] : []);
  write("candle-coverage.json", { rows: series.candles.length, lastClosedEnd: core.iso(series.candles.at(-1)!.endTs), gaps });
  const tradingStartIdx = core.lowerBound(series.candles, START, c => c.endTs);
  const nullContext = series.candles.reduce((a, c, i) => {
    if (i >= tradingStartIdx && c.endTs <= CONTROL_END && (series.rsi1H[i] == null || series.crsi4H[i] == null || series.slope12h[i] == null)) a++;
    return a;
  }, 0);
  write("context-coverage.json", { contextStart, missingContextTradingMinutes: nullContext });
  write("decision-trace.json", ["2025-07-02T16:12:00Z", "2025-07-02T16:34:00Z", "2025-07-02T16:42:00Z"].map(at => {
    const i = core.lowerBound(series.candles, Date.parse(at), c => c.endTs);
    return { at, sourceMinuteStart: core.iso(series.candles[i].ts), decisionAt: core.iso(series.candles[i].endTs), rsi1H: series.rsi1H[i], crsi4H: series.crsi4H[i], slope12h: series.slope12h[i], trendBlocked: series.trendBlocked[i], rsiWouldArm30mCooldown: series.rsi1H[i] !== null && series.rsi1H[i]! > 60 };
  }));
  await dormant.attachDormantSeries(series, Math.max(0, core.lowerBound(series.candles, Date.parse("2026-05-17T20:43:00Z") - 14 * DAY, c => c.endTs)));
  const lines = fs.readFileSync(path.join(ROOT, sourcePaths[5]), "utf8").trim().split(/\r?\n/);
  const head = lines.shift()!.split(",");
  const intervals = lines.map(line => line.split(",")).filter(c => c[head.indexOf("variant")] === "ladder_lock_deep4_hl_sell_release_2x4h_inside1").map(c => ({ start: Date.parse(c[head.indexOf("startIso")]), end: c[head.indexOf("endIso")] ? Date.parse(c[head.indexOf("endIso")]) : Infinity }));
  if (!intervals.length || intervals.some(x => !Number.isFinite(x.start) || Number.isNaN(x.end))) throw new Error("Invalid archived latch intervals");
  series.regimeFlat = series.regimeFlat.map((blocked, i) => blocked || intervals.some(x => series.candles[i].endTs >= x.start && series.candles[i].endTs < x.end));
  const params: import("./hype-freerun-canonical-replay").EngineParams = {
    id: "published_current_with_damaged_latch", maxPositions: 11, hardFlattenHours: 12, hardFlattenPct: -2, cooldownMode: "live4h", pullbackMode: "none",
    srExec: { partialExit: { minDepth: 6, keepRungs: 3, bufferPct: .3, minLadderPnlPct: .25, requirePlanProfit: true, pulse: "deteriorating", cooldownMin: 60 }, supportReopen: { minNextDepth: 5, bufferPct: 1, mode: "buy_pressure" } },
  };
  const summarize = (r: import("./hype-freerun-canonical-replay").EngineResult) => ({ totalPnl: r.realized + r.openPnl, realizedPnl: r.realized, openPnl: r.openPnl, closes: r.closes.length, closeReasons: r.closes.reduce((a: Record<string, number>, x) => { a[x.reason] = (a[x.reason] || 0) + 1; return a; }, {}), maxDrawdownPct: r.maxDrawdownPct, minEquity: r.minEquity, trims: r.trims.length });
  console.log("[parity] reproducing published one-year control (no variants)");
  const control = core.runEngine(params, series, { startIdx: core.lowerBound(series.candles, START, c => c.endTs), endIdx: core.lowerBound(series.candles, CONTROL_END + 1, c => c.endTs) });
  const observed = summarize(control);
  const passed = Math.abs(observed.totalPnl - 82912.67) < .011 && observed.closes === 1035 && observed.closeReasons.hard_flatten === 36 && observed.closeReasons.emergency_kill === 3;
  write("control.json", { expected: { totalPnl: 82912.67, closes: 1035, hardFlattens: 36, emergencyKills: 3 }, observed, deltaUsd: observed.totalPnl - 82912.67, passed });
  core.writeCsv(path.join(out, "control-closes.csv"), control.closes);
  core.writeCsv(path.join(out, "control-trims.csv"), control.trims);
  const monthly: Record<string, { month: string; batchPnl: number; trimPnl: number; closes: number }> = {};
  for (const c of control.closes) { const k = c.closeIso.slice(0, 7); const r = monthly[k] ||= { month: k, batchPnl: 0, trimPnl: 0, closes: 0 }; r.batchPnl += c.pnl; r.closes++; }
  for (const t of control.trims) { const k = t.iso.slice(0, 7); const r = monthly[k] ||= { month: k, batchPnl: 0, trimPnl: 0, closes: 0 }; r.trimPnl += t.pnl; }
  core.writeCsv(path.join(out, "control-monthly.csv"), Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).map(r => ({ ...r, realizedPnl: r.batchPnl + r.trimPnl })));
  console.log(JSON.stringify({ control: observed, passed }));
  // Check that extending archived latch intervals does not silently omit a fresh trigger.
  const bars = new Map<number, { ts: number; close: number; count: number; lastTs: number }>();
  for (const c of series.candles) { const ts = Math.floor(c.ts / (4 * 60 * MIN)) * (4 * 60 * MIN); const prior = bars.get(ts); bars.set(ts, { ts, close: c.close, count: (prior?.count || 0) + 1, lastTs: c.ts }); }
  const ordered = [...bars.values()].sort((a, b) => a.ts - b.ts);
  const extension: { at: string; distPct: number; complete: boolean; fullOhlcCoverage: boolean }[] = [];
  for (let i = 248; i < ordered.length; i++) {
    const b = ordered[i]; const availableAt = b.ts + 4 * 60 * MIN + 10_000;
    if (availableAt <= CONTROL_END || availableAt > end) continue;
    const window = ordered.slice(i - 248, i + 1);
    const ema = EMA.calculate({ period: 200, values: window.map(x => x.close) }).at(-1)!;
    extension.push({ at: new Date(availableAt).toISOString(), distPct: (b.close / ema - 1) * 100,
      // This latch consumes ONLY completed 4h closes. An interior 1m gap does not
      // invalidate a known final-minute close, but does invalidate full OHLC parity.
      complete: window.every((x, n) => x.lastTs === x.ts + 4 * 60 * MIN - MIN && (!n || x.ts - window[n - 1].ts === 4 * 60 * MIN)),
      fullOhlcCoverage: window.every(x => x.count === 240) });
  }
  const extensionSafe = extension.length > 0 && extension.every(x => x.complete && x.distPct > -4) && intervals.every(x => Number.isFinite(x.end) && x.end < CONTROL_END);
  write("latch-extension-check.json", { extensionSafe, intervals, extension });
  if (!passed || !extensionSafe) {
    write("verdict.json", { exactLiveParity: false, controlPassed: passed, extensionSafe, reason: "Stop at control/data boundary; no variants or current-period profitability claims." });
    return;
  }
  // Same unchanged policy, hypothetical flat reset at the documented flat deployment window.
  // This is a comparator, NOT a maker-vs-live causal profit delta.
  const recentStart = Date.parse("2026-08-14T18:40:00Z");
  const recent = core.runEngine(params, series, { startIdx: core.lowerBound(series.candles, recentStart, c => c.endTs), recordSnapshots: true });
  write("recent-comparator.json", { start: new Date(recentStart).toISOString(), end: new Date(end).toISOString(), hypotheticalFlatReset: true, ...summarize(recent) });
  core.writeCsv(path.join(out, "recent-closes.csv"), recent.closes);
  core.writeCsv(path.join(out, "recent-trims.csv"), recent.trims);
  core.writeCsv(path.join(out, "recent-snapshots.csv"), recent.snapshots);
  write("verdict.json", { exactLiveParity: false, controlPassed: true, extensionSafe, reason: "Historical control replicated; current maker execution, arrival-time availability and funding remain unmodeled." });
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
