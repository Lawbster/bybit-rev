/** Independent ledger/accounting verification. Never invokes the signal engine. */
import assert from "assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";

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

async function main(): Promise<void> {
  assert.equal(process.argv.length, 3, "Usage: npx ts-node scripts/indicator-standalone-results-check.ts ARTIFACT_DIRECTORY");
  const directory = path.resolve(root, process.argv[2]);
  inside(path.join(root, "backtests"), directory);
  assert.ok(fs.statSync(directory).isDirectory(), "Artifact path must be a directory");
  const destination = path.join(directory, "verification.json");
  assert.ok(!fs.existsSync(destination), "Refusing to overwrite an existing verification.json");
  const manifest = readJson(path.join(directory, "manifest.json")), spec = manifest.spec;
  const sources = array(manifest.sources, "manifest sources"), inputs = array(manifest.inputs, "manifest inputs");
  const definition = "research-inputs/indicators/standalone-2026-09-05.json";
  assert.deepEqual(spec, readJson(path.join(root, definition)), "Embedded specification must equal its pinned source file");
  assert.ok(sources.some(s => s.file === definition), "Missing frozen specification fingerprint");
  assert.equal(spec.symbol, "HYPEUSDT"); assert.equal(spec.timeframeMs, H);
  assert.deepEqual(spec.families, ["rsi_recovery", "crsi_recovery", "roc_cross", "vwap_cross"]);
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

  const artifactNames = ["manifest.json", "results.json", "monthly.json", "trades.jsonl", "context-controls.json", "ranking.json", "validation.json"];
  const artifactHashes = await Promise.all(artifactNames.map(async file => ({ file, sha256: await sha256(path.join(directory, file)) })));
  const summaries = array(readJson(path.join(directory, "results.json")), "results");
  const monthly = array(readJson(path.join(directory, "monthly.json")), "monthly");
  const ledger: any[] = fs.readFileSync(path.join(directory, "trades.jsonl"), "utf8").split(/\r?\n/)
    .filter(line => line.trim()).map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`Invalid trade JSON line ${i + 1}`); } });
  const expectedRules = spec.families.flatMap((family: string) => spec.sides.flatMap((side: string) =>
    spec.exits.map((exit: string) => ({ family, side, exit, id: `${family}_${side}_${exit}` }))));
  expectedRules.push(...spec.sides.map((side: string) => ({ family: "clock", side, exit: "fixed12h", id: `clock_${side}` })));
  const windows = array(spec.windows, "windows"), expected = new Map<string, any>();
  for (const w of windows) for (const delayMs of spec.executionDelaysMs) for (const rule of expectedRules)
    expected.set(caseKey({ window: w.id, delayMs, id: rule.id }), { ...rule, delayMs, window: w.id, start: w.start, end: w.end });
  assert.equal(expected.size, 72); assert.equal(summaries.length, expected.size);
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
  const reconstructed = new Map<string, { net: number; markedByMonth: Map<string, number> }>();
  let checkedMonths = 0, checkedTrades = 0;
  for (const [key, r] of byCase) {
    const start = timestamp(Date.parse(r.start), "case start"), stop = timestamp(Date.parse(r.end), "case end");
    assert.ok(start < stop); const direction = r.side === "long" ? 1 : -1, rows = tradesByCase.get(key)!;
    let previousExit: number | null = null;
    const validateEntry = (trade: any, label: string) => {
      const signal = timestamp(trade.signalAt, `${label} signal`), entered = timestamp(trade.entryAt, `${label} entry`);
      assert.ok(signal >= start && entered < stop && signal <= entered, `${label} chronology/window`);
      assert.equal(entered, signal + r.delayMs, `${label} exact entry delay`);
      if (r.family !== "clock") assert.equal(signal % H, 0, `${label} closed hourly decision`);
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
      assert.ok(["timeout", "indicator"].includes(t.reason), `${label} unknown close reason`);
      if (t.reason === "timeout") assert.equal(decided, t.entryAt + spec.holdMs, `${label} timeout from actual fill`);
      else { assert.equal(r.exit, "indicator_or12h"); assert.equal(decided % H, 0); assert.ok(decided < t.entryAt + spec.holdMs); }
      near(t.exitPrice, candle(exited).open, `${label} exit minute open`, 1e-10);
      const gross = direction * t.qty * (t.exitPrice - t.entryPrice), fee = t.qty * (t.entryPrice + t.exitPrice) * spec.feeRatePerSide;
      near(t.pricePnl, gross, `${label} independently recomputed gross`); near(t.fees, fee, `${label} actual notional fees`);
      near(t.net, gross - fee, `${label} independently recomputed net`);
      if (t.entryFeature !== null) {
        assert.equal(t.entryFeature.timestamp, Math.floor(t.signalAt / H) * H - H, `${label} last completed feature identity`);
        for (const [field, value] of Object.entries(t.entryFeature)) if (value !== null) number(value, `${label} feature ${field}`);
      } else assert.equal(r.family, "clock", `${label} indicator entry requires feature provenance`);
      previousExit = exited; checkedTrades++;
    }
    const open = r.open;
    if (open !== null) {
      assert.equal(typeof open, "object"); validateEntry(open, `${key} open`);
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
  }
  assert.equal(checkedMonths, monthly.length, "Unexpected monthly rows outside study dates");
  for (const [key, r] of byCase) {
    if (r.family === "clock") { assert.equal(r.baselineId, null); assert.equal(r.deltaVsClock, null); }
    else {
      assert.equal(r.baselineId, `clock_${r.side}`);
      const control = reconstructed.get(caseKey({ ...r, id: r.baselineId }))!;
      near(r.deltaVsClock, reconstructed.get(key)!.net - control.net, `${key} independent clock delta`);
    }
    if (r.exit === "indicator_or12h") near(r.deltaVsOwnFixed12h,
      reconstructed.get(key)!.net - reconstructed.get(caseKey({ ...r, id: `${r.family}_${r.side}_fixed12h` }))!.net, `${key} own fixed-horizon delta`);
    else assert.equal(r.deltaVsOwnFixed12h, null);
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
  for (const p of pinned) assert.equal(await sha256(inside(root, p.file)), p.sha256, `Source/input changed during verification: ${p.file}`);
  for (const p of artifactHashes) assert.equal(await sha256(path.join(directory, p.file)), p.sha256, `Artifact changed during verification: ${p.file}`);
  const report = { version: 1, verifiedAt: new Date().toISOString(), passed: true,
    verifier: { file: path.relative(root, __filename).replace(/\\/g, "/"), sha256: await sha256(__filename) },
    checkedCases: byCase.size, checkedTradeRows: checkedTrades, checkedMonthlyRows: checkedMonths,
    inputAndSourceHashesMatched: true, artifactsUnchanged: true, artifacts: artifactHashes,
    checks: ["exact entry and exit timing/delay", "execution prices match canonical repaired minute opens",
      "fixed entry sizing and no overlapping inventory", "directional gross/net and actual-notional fees",
      "closed/open counts and liquidation marks", "turnover and fixed-path cost stress", "exposure duration",
      "monthly realized results and paid fees", "independently reconstructed month-boundary marked equity",
      "same-side clock and own fixed-horizon deltas", "cash and buy-and-hold contextual controls"],
    limitations: ["Not a second signal-generation replay; threshold correctness and feature formulas have separate independent unit tests.",
      "Drawdown trajectories, raw signal opportunities and pending decision reasons are not reconstructed; raw/occupied/accepted counts are checked for consistency.",
      "Response-event/stratification statistics and rankings are not independently recomputed by this accounting verifier.",
      "Windows overlap: checked trade rows are artifact records, not a count of unique market trades.",
      "Funding, actual historical publication delay, liquidity, slippage paths and live execution are not certified."],
    writes: ["verification.json only"] };
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(`[verified] ${byCase.size} cases, ${checkedTrades} trade rows, ${checkedMonths} monthly rows; ${destination}`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
