/** Independent ledger/accounting verification. Never invokes the signal engine. */
import assert from "assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const M = 60_000, H = 60 * M, TF = 15 * M, EPS = 1e-6;
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

// Deliberately separate from computeResearchFeatures: batch close differences,
// independently calculated signed streaks, and explicit prior-return rank.
function referenceCrsi(candles: any[], tf: number): Map<number, number | null> {
  const closes: number[] = [], starts: number[] = [], step = tf / M;
  for (let i = 0; i + step <= candles.length; i += step) { starts.push(candles[i].ts); closes.push(candles[i + step - 1].close); }
  const calcRsi = (values: number[], period: number): Array<number | null> => {
    const result: Array<number | null> = Array(values.length).fill(null);
    const diffs = values.slice(1).map((v, i) => v - values[i]);
    let gains = total(diffs.slice(0, period), x => Math.max(0, x)) / period;
    let losses = total(diffs.slice(0, period), x => Math.max(0, -x)) / period;
    for (let i = period; i < values.length; i++) {
      if (i > period) { gains = gains * (period - 1) / period + Math.max(0, diffs[i - 1]) / period;
        losses = losses * (period - 1) / period + Math.max(0, -diffs[i - 1]) / period; }
      result[i] = gains + losses === 0 ? 50 : 100 * gains / (gains + losses);
    }
    return result;
  };
  const streak = closes.map((v, i) => {
    if (!i || v === closes[i - 1]) return 0;
    const sign = Math.sign(v - closes[i - 1]); let n = 0;
    for (let j = i; j > 0 && Math.sign(closes[j] - closes[j - 1]) === sign; j--) n++;
    return sign * n;
  });
  const priceRsi = calcRsi(closes, 3), streakRsi = calcRsi(streak, 2);
  const returns = closes.slice(1).map((c, i) => c / closes[i] - 1);
  return new Map(starts.map((at, i) => [at, i < 101 ? null : (priceRsi[i]! + streakRsi[i]!
    + returns.slice(i - 101, i - 1).filter(v => v < returns[i - 1]).length) / 3]));
}
function crossed(r: any, previous: number | null | undefined, current: number | null | undefined): boolean {
  if (previous == null || current == null) return false;
  return r.entryMode === "into" ? previous > 5 && current <= 5 : previous <= 5 && current > 5;
}

async function main(): Promise<void> {
  assert.equal(process.argv.length, 3, "Usage: npx ts-node scripts/crsi-risk-exit-results-check.ts ARTIFACT_DIRECTORY");
  const directory = path.resolve(root, process.argv[2]);
  inside(path.join(root, "backtests"), directory);
  assert.ok(fs.statSync(directory).isDirectory(), "Artifact path must be a directory");
  const destination = path.join(directory, "verification.json");
  assert.ok(!fs.existsSync(destination), "Refusing to overwrite an existing verification.json");
  const manifest = readJson(path.join(directory, "manifest.json")), spec = manifest.spec;
  const sources = array(manifest.sources, "manifest sources"), inputs = array(manifest.inputs, "manifest inputs");
  const definition = "research-inputs/indicators/crsi-risk-exit-2026-09-06.json";
  assert.deepEqual(spec, readJson(path.join(root, definition)), "Embedded specification must equal its pinned source file");
  assert.ok(sources.some(s => s.file === definition), "Missing frozen specification fingerprint");
  assert.equal(spec.symbol, "HYPEUSDT"); assert.equal(spec.timeframeMs, TF);
  assert.equal(spec.upper, 95); assert.deepEqual(spec.entryModes, ["into", "back_out"]);
  assert.equal(spec.side, "long");
  assert.deepEqual(spec.exitPolicies, ["baseline12h", "stop3", "stop5", "stop8", "timeout6h", "crsi50", "crsi80"]);
  assert.equal(spec.strategyDefinitionCount, 14); assert.equal(spec.variantWindowDelayCases, 48);
  assert.equal(spec.baselineWindowDelayCases, 8);
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

  const artifactNames = ["manifest.json", "results.json", "monthly.json", "trades.jsonl", "context-controls.json", "ranking.json", "validation.json", "overlap-parity.json", "causal-traces.json", "summary.csv", "monthly.csv"];
  const artifactHashes = await Promise.all(artifactNames.map(async file => ({ file, sha256: await sha256(path.join(directory, file)) })));
  const summaries = array(readJson(path.join(directory, "results.json")), "results");
  const monthly = array(readJson(path.join(directory, "monthly.json")), "monthly");
  const ledger: any[] = fs.readFileSync(path.join(directory, "trades.jsonl"), "utf8").split(/\r?\n/)
    .filter(line => line.trim()).map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`Invalid trade JSON line ${i + 1}`); } });
  const expectedRules = spec.entryModes.flatMap((entryMode: string) => spec.exitPolicies.map((exitPolicy: string) => ({
    family: "crsi_risk_exit", side: "long", entryMode, exitPolicy,
    id: `crsi_15m_95_${entryMode}_long__${exitPolicy}`,
  })));
  const windows = array(spec.windows, "windows"), expected = new Map<string, any>();
  for (const w of windows) for (const delayMs of spec.executionDelaysMs) for (const rule of expectedRules)
    expected.set(caseKey({ window: w.id, delayMs, id: rule.id }), { ...rule, delayMs, window: w.id, start: w.start, end: w.end });
  assert.equal(expected.size, 56); assert.equal(summaries.length, expected.size);
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
  const references = referenceCrsi(candles, TF);
  // Runner schema is one fixed 15m feature tape; verify the exact complete count.
  assert.deepEqual(manifest.closedBars, [{ timeframeMs: TF, count: references.size }], "Complete 15m bar count");
  assert.deepEqual(manifest.availability, { mode: "modeled_bar_end", publicationLagMs: 0 });
  assert.equal(manifest.seed, seed); assert.equal(manifest.missingMinutes, 0);
  const reconstructed = new Map<string, { net: number; markedByMonth: Map<string, number> }>();
  let checkedMonths = 0, checkedTrades = 0;
  for (const [key, r] of byCase) {
    const start = timestamp(Date.parse(r.start), "case start"), stop = timestamp(Date.parse(r.end), "case end");
    assert.ok(start < stop); const direction = 1, rows = tradesByCase.get(key)!;
    const holdMs = r.exitPolicy === "timeout6h" ? 6 * H : 12 * H;
    const stopPct = ({ stop3: 3, stop5: 5, stop8: 8 } as Record<string, number>)[r.exitPolicy] ?? null;
    const exitCrsi = ({ crsi50: 50, crsi80: 80 } as Record<string, number>)[r.exitPolicy] ?? null;
    type Exit = { decisionAt: number; fillAt: number; reason: string };
    const exitCache = new Map<number, Exit | null>();
    // Independent per-position forward scan. A decision at t can inspect only
    // the previously HELD minute ending at t; fills always use open[t+delay].
    // This checks the earliest possible trigger, not merely a saved exit's validity.
    const firstExit = (entryAt: number): Exit | null => {
      if (exitCache.has(entryAt)) return exitCache.get(entryAt)!;
      const entryPrice = candle(entryAt).open;
      let result: Exit | null = null;
      for (let at = entryAt + M; at < stop; at += M) {
        const observedStop = stopPct !== null && candle(at - M).low <= entryPrice * (1 - stopPct / 100);
        const timeout = at >= entryAt + holdMs;
        const value = at % TF === 0 ? references.get(at - TF) : null;
        const normalized = exitCrsi !== null && value != null && value >= exitCrsi;
        if (observedStop || timeout || normalized) {
          result = { decisionAt: at, fillAt: at + r.delayMs,
            reason: observedStop ? "observed_stop" : timeout ? "timeout" : "crsi_exit" };
          break;
        }
      }
      exitCache.set(entryAt, result); return result;
    };
    let previousExit: number | null = null;
    const validateEntry = (trade: any, label: string) => {
      const signal = timestamp(trade.signalAt, `${label} signal`), entered = timestamp(trade.entryAt, `${label} entry`);
      assert.ok(signal >= start && entered < stop && signal <= entered, `${label} chronology/window`);
      assert.equal(entered, signal + r.delayMs, `${label} exact entry delay`);
      assert.equal(signal % TF, 0, `${label} closed 15m decision`);
      assert.ok(crossed(r, references.get(signal - 2 * TF), references.get(signal - TF)), `${label} independently reconstructed CRSI crossing`);
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
      const expectedExit = firstExit(t.entryAt); assert.ok(expectedExit, `${label} no eligible exit before cutoff`);
      assert.equal(decided, expectedExit.decisionAt, `${label} earliest causal stop/timeout/CRSI exit`);
      assert.equal(exited, expectedExit.fillAt, `${label} first eligible exit plus execution delay`);
      assert.equal(t.reason, expectedExit.reason, `${label} independent exit priority/reason`);
      near(t.exitPrice, candle(exited).open, `${label} exit minute open`, 1e-10);
      const gross = direction * t.qty * (t.exitPrice - t.entryPrice), fee = t.qty * (t.entryPrice + t.exitPrice) * spec.feeRatePerSide;
      near(t.pricePnl, gross, `${label} independently recomputed gross`); near(t.fees, fee, `${label} actual notional fees`);
      near(t.net, gross - fee, `${label} independently recomputed net`);
      if (t.entryFeature !== null) {
        const featureStart = t.signalAt - TF;
        assert.equal(t.entryFeature.timestamp, featureStart, `${label} last completed feature identity`);
        const expectedCrsi = references.get(featureStart);
        if (expectedCrsi == null) assert.equal(t.entryFeature.crsi, null);
        else near(t.entryFeature.crsi, expectedCrsi, `${label} independently calculated CRSI`, 1e-8);
        for (const [field, value] of Object.entries(t.entryFeature)) if (value !== null) number(value, `${label} feature ${field}`);
      } else assert.fail(`${label} indicator entry requires feature provenance`);
      previousExit = exited; checkedTrades++;
    }
    const open = r.open;
    if (open !== null) {
      assert.equal(typeof open, "object"); validateEntry(open, `${key} open`);
      const exit = firstExit(open.entryAt);
      assert.ok(exit === null || exit.fillAt >= stop, `${key} terminal position missed an executable exit`);
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
    // Earlier exits free the owner for the next GENUINE fresh crossing, not for
    // a replay of a signal that happened while another position was active.
    const opportunities = new Set<number>();
    for (const [barStart, current] of references) {
      const at = barStart + TF;
      if (at >= start && at < stop && crossed(r, references.get(barStart - TF), current)) opportunities.add(at);
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
  }
  assert.equal(checkedMonths, monthly.length, "Unexpected monthly rows outside study dates");
  const priorDir = inside(root, spec.priorArtifactDirectory);
  const priorManifest = readJson(path.join(priorDir, "manifest.json"));
  assert.equal(readJson(path.join(priorDir, "verification.json")).passed, true, "I02 must be independently verified");
  for (const name of ["historyEnd", "indicatorSeedBarStart", "repairFile", "notionalUsdt", "initialEquity", "feeRatePerSide",
    "holdMs", "windows", "executionDelaysMs", "extraFixedPathCostBpsPerSide"])
    assert.deepEqual(spec[name], priorManifest.spec[name], `Preserve I02 ${name}`);
  for (const name of ["manifest.json", "verification.json", "results.json", "monthly.json", "trades.jsonl", "context-controls.json"])
    assert.ok(inputs.some(p => p.file === `${spec.priorArtifactDirectory}/${name}`), `Missing prior artifact fingerprint: ${name}`);
  const priorSummaries = array(readJson(path.join(priorDir, "results.json")), "prior summaries");
  const priorMonths = array(readJson(path.join(priorDir, "monthly.json")), "prior months");
  const priorTrades = fs.readFileSync(path.join(priorDir, "trades.jsonl"), "utf8").split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
  const savedClocks = priorSummaries.filter(r => r.id === "clock_long"); assert.equal(savedClocks.length, 4);
  for (const [key, r] of byCase) {
    const baselineId = r.exitPolicy === "baseline12h" ? null : `crsi_15m_95_${r.entryMode}_long__baseline12h`;
    assert.equal(r.ownBaselineId, baselineId);
    if (baselineId === null) assert.equal(r.deltaVsOwnBaseline, null);
    else {
      const baseline = reconstructed.get(caseKey({ ...r, id: baselineId })); assert.ok(baseline);
      near(r.deltaVsOwnBaseline, reconstructed.get(key)!.net - baseline.net, `${key} independent own-baseline delta`);
    }
    const clocks = savedClocks.filter(c => c.window === r.window && c.delayMs === r.delayMs); assert.equal(clocks.length, 1);
    near(r.clockBaselineNet, clocks[0].net, `${key} pinned I02 long clock net`);
    near(r.deltaVsClock, reconstructed.get(key)!.net - clocks[0].net, `${key} independent saved-clock delta`);
    for (const [month, value] of reconstructed.get(key)!.markedByMonth) {
      const row = byMonth.get(`${key}|${month}`)!;
      assert.equal(row.ownBaselineId, baselineId);
      if (baselineId === null) { assert.equal(row.baselineMarkedNet, null); assert.equal(row.markedDelta, null); }
      else {
        const baseline = reconstructed.get(caseKey({ ...r, id: baselineId }))!.markedByMonth.get(month)!;
        near(row.baselineMarkedNet, baseline, `${key} ${month} baseline marked net`);
        near(row.markedDelta, value - baseline, `${key} ${month} independent marked delta`);
      }
    }
  }
  const controlObject = readJson(path.join(directory, "context-controls.json"));
  assert.deepEqual(controlObject.clock, savedClocks, "Clock controls are reused exactly, not rerun or rescaled");
  const contexts = array(controlObject.buyHold, "buy/hold controls");
  assert.deepEqual(contexts, readJson(path.join(priorDir, "context-controls.json")), "Buy/hold context matches pinned I02");
  assert.equal(contexts.length, windows.length);
  for (const w of windows) {
    const context = contexts.filter(c => c.window === w.id); assert.equal(context.length, 1);
    const c = context[0], entry = candle(Date.parse(w.start)).open, mark = candle(Date.parse(w.end) - M).close;
    const qty = spec.notionalUsdt / entry, gross = qty * (mark - entry), fee = qty * (entry + mark) * spec.feeRatePerSide;
    near(c.cashNet, 0, "cash control"); near(c.entryPrice, entry, "buy/hold entry"); near(c.finalMark, mark, "buy/hold mark");
    near(c.notional, spec.notionalUsdt, "buy/hold notional"); near(c.buyHoldLongPricePnl, gross, "buy/hold gross");
    near(c.buyHoldLongFeesIncludingMarkedExit, fee, "buy/hold fees"); near(c.buyHoldLongNetBeforeFunding, gross - fee, "buy/hold net");
  }
  // The unchanged two entry policies with fixed12h must retain their complete
  // independently verified I02 ledgers, stats and monthly accounting paths.
  const withoutId = ({ id, ...rest }: any) => rest;
  const monthlyCore = (r: any) => Object.fromEntries(["window", "delayMs", "month", "trades", "wins", "losses", "breakeven",
    "winningDollars", "losingDollars", "closedNet", "feesPaid", "markedNet"].map(field => [field, r[field]]));
  const parity = array(readJson(path.join(directory, "overlap-parity.json")), "saved overlap parity");
  assert.equal(parity.length, 8);
  let overlapCases = 0;
  for (const r of summaries.filter(r => r.exitPolicy === "baseline12h")) {
    const oldId = `crsi_15m_95_${r.entryMode}_long`;
    const matches = (p: any) => p.window === r.window && p.delayMs === r.delayMs && p.id === oldId;
    const previous = priorSummaries.filter(matches); assert.equal(previous.length, 1);
    for (const field of ["trades", "wins", "losses", "breakeven", "winningDollars", "losingDollars", "closedNet", "openNet", "net", "feesPaid",
      "turnoverIncludingMarkedExit", "maxCloseDrawdownPct", "maxAdverseDrawdownPct", "exposureHours", "rawSignals", "skippedOccupied", "pendingAtEnd", "bankrupt", "open"])
      assert.deepEqual(r[field], previous[0][field], `Prior verified overlap ${caseKey(r)} ${field}`);
    assert.deepEqual(tradesByCase.get(caseKey(r))!.map(withoutId), priorTrades.filter(matches).map(withoutId), "Prior verified complete ledger overlap");
    assert.deepEqual(monthly.filter(m => caseKey(m) === caseKey(r)).map(monthlyCore), priorMonths.filter(matches).map(monthlyCore), "Prior verified monthly overlap");
    const records = parity.filter(p => caseKey(p) === caseKey(r)); assert.equal(records.length, 1);
    assert.deepEqual(records[0], { window: r.window, delayMs: r.delayMs, id: r.id, priorId: oldId,
      trades: r.trades, net: r.net, exactLedgerStatsMonths: true }, "Saved overlap assertion matches independent result");
    overlapCases++;
  }
  assert.equal(overlapCases, 8);
  const traces = array(readJson(path.join(directory, "causal-traces.json")), "causal traces");
  assert.equal(traces.length, expectedRules.length);
  for (const r of expectedRules) {
    const found = traces.filter(t => t.rule?.id === r.id); assert.equal(found.length, 1);
    const trace = found[0], first = tradesByCase.get(caseKey({ window: "full", delayMs: 0, id: r.id }))![0];
    assert.ok(first, `${r.id} first-trade trace requires an actual closed trade`);
    assert.deepEqual(trace.rule, { id: r.id, entryMode: r.entryMode, exitPolicy: r.exitPolicy });
    assert.equal(trace.previousBarStart, first.signalAt - 2 * TF); assert.equal(trace.currentBarStart, first.signalAt - TF);
    near(trace.previousCrsi, references.get(trace.previousBarStart)!, `${r.id} trace previous CRSI`, 1e-8);
    near(trace.currentCrsi, references.get(trace.currentBarStart)!, `${r.id} trace current CRSI`, 1e-8);
    assert.equal(trace.availableAt, first.signalAt);
    for (const field of ["signalAt", "entryAt", "entryPrice", "exitDecisionAt", "exitAt", "exitPrice", "reason"])
      assert.equal(trace[field], first[field], `${r.id} trace ${field}`);
  }
  for (const p of pinned) assert.equal(await sha256(inside(root, p.file)), p.sha256, `Source/input changed during verification: ${p.file}`);
  for (const p of artifactHashes) assert.equal(await sha256(path.join(directory, p.file)), p.sha256, `Artifact changed during verification: ${p.file}`);
  const report = { version: 1, verifiedAt: new Date().toISOString(), passed: true,
    verifier: { file: path.relative(root, __filename).replace(/\\/g, "/"), sha256: await sha256(__filename) },
    checkedCases: byCase.size, checkedTradeRows: checkedTrades, checkedMonthlyRows: checkedMonths, independentlyMatchedPriorCases: overlapCases,
    inputAndSourceHashesMatched: true, artifactsUnchanged: true, artifacts: artifactHashes,
    checks: ["independent 15m CRSI formulas and exact lower5 into/back-out crossings",
      "every eligible flat signal and occupied skip independently enumerated", "terminal pending decisions independently derived",
      "first eligible exit independently found from held prior-minute lows, elapsed hold and closed CRSI",
      "stop then timeout then CRSI exit priority; pending decisions remain immutable",
      "full minute close/adverse equity drawdown independently reconstructed", "8 prior I02 saved ledger/monthly/stat overlap cases",
      "exact entry and exit timing/delay", "execution prices match canonical repaired minute opens",
      "fixed entry sizing and no overlapping inventory", "directional gross/net and actual-notional fees",
      "closed/open counts and liquidation marks", "turnover and fixed-path cost stress", "exposure duration",
      "monthly realized results and paid fees", "independently reconstructed month-boundary marked equity",
      "own-baseline aggregate and monthly deltas; exact reused I02 long clock context",
      "cash and buy-and-hold contextual controls", "14 first-trade causal traces checked against independent CRSI and ledger"],
    limitations: ["No strategy engine is imported; independent scalar CRSI, opportunity enumeration, first-exit scans and ledger accounting check only these frozen 14 long policies.",
      "Rankings are not independently recomputed by this verifier.",
      "Windows overlap: checked trade rows are artifact records, not a count of unique market trades.",
      "Funding, actual historical publication delay, liquidity, slippage paths and live execution are not certified."],
    writes: ["verification.json only"] };
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(`[verified] ${byCase.size} cases, ${checkedTrades} trade rows, ${checkedMonths} monthly rows; ${destination}`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
