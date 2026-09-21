/** Independent saved-policy and inventory/accounting audit. Never runs a strategy engine. */
import assert from "assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const M = 60_000, H = 60 * M, D = 24 * H, root = path.resolve(__dirname, "..");
const read = (file: string): any => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = (file: string): any[] => fs.readFileSync(file, "utf8").split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
const sum = (rows: any[], f: (r: any) => number): number => rows.reduce((n, r) => n + f(r), 0);
const monthOf = (at: number) => new Date(at).toISOString().slice(0, 7);
function near(a: any, b: number, label: string, tolerance = 1e-6): void {
  assert.ok(typeof a === "number" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance,
    `${label}: ${a} != ${b} (difference ${Math.abs(a - b)})`);
}
function local(file: string, base = root): string {
  const resolved = path.resolve(base, file), rel = path.relative(base, resolved);
  assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel), `Invalid local path: ${file}`); return resolved;
}
async function hash(file: string): Promise<string> {
  const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(file)) h.update(b); return h.digest("hex");
}

// Independent scalar formulas: no research feature implementation or policy import.
// RSI uses gain/(gain+loss), with explicit seed arrays and batch recurrence.
function rsi(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return output;
  const differences = values.slice(1).map((v, i) => v - values[i]);
  let gain = sum(differences.slice(0, period), v => Math.max(v, 0)) / period;
  let loss = sum(differences.slice(0, period), v => Math.max(-v, 0)) / period;
  for (let i = period; i < values.length; i++) {
    if (i > period) { gain = gain * ((period - 1) / period) + Math.max(differences[i - 1], 0) / period;
      loss = loss * ((period - 1) / period) + Math.max(-differences[i - 1], 0) / period; }
    output[i] = gain + loss === 0 ? 50 : 100 * gain / (gain + loss);
  }
  return output;
}
function independentHours(candles: any[], seed: number): Map<number, any> {
  const minutes = candles.filter(c => c.ts >= seed), hours: any[] = [];
  assert.equal(minutes[0].ts, seed); assert.equal(seed % H, 0);
  minutes.forEach((c, i) => assert.equal(c.ts, seed + i * M, "Independent feature input continuity"));
  for (let i = 0; i + 60 <= minutes.length; i += 60) {
    const source = minutes.slice(i, i + 60);
    hours.push({ start: source[0].ts, close: source[59].close, volume: sum(source, c => c.volume), turnover: sum(source, c => c.turnover) });
  }
  const closes = hours.map(h => h.close), returns = closes.slice(1).map((v, i) => v / closes[i] - 1);
  const streaks = closes.map((_, i) => {
    if (!i || closes[i] === closes[i - 1]) return 0;
    const sign = Math.sign(closes[i] - closes[i - 1]); let count = 0;
    for (let j = i; j > 0 && Math.sign(closes[j] - closes[j - 1]) === sign; j--) count++;
    return sign * count;
  });
  const r14 = rsi(closes, 14), r3 = rsi(closes, 3), r2 = rsi(streaks, 2), output = new Map<number, any>();
  let day = -1, volume = 0, turnover = 0;
  hours.forEach((h, i) => {
    const currentDay = Math.floor(h.start / D) * D;
    if (currentDay !== day) { day = currentDay; volume = 0; turnover = 0; }
    volume += h.volume; turnover += h.turnover;
    const rank = i < 101 ? null : returns.slice(i - 101, i - 1).filter(v => v < returns[i - 1]).length;
    output.set(h.start, { close: h.close, rsi14: r14[i], crsi: rank === null ? null : (r3[i]! + r2[i]! + rank) / 3,
      roc5: i < 5 ? null : 100 * (h.close / closes[i - 5] - 1), vwapUtcDay: volume > 0 ? turnover / volume : null });
  });
  return output;
}
function directVeto(id: string, depth: number, context: any): boolean {
  if (depth < 11 || id === "baseline") return false;
  if (!context) return false;
  if (id === "rsi_hot_d11") return context.rsi14 !== null && context.rsi14 >= 70;
  if (id === "crsi_hot_d11") return context.crsi !== null && context.crsi >= 80;
  if (id === "roc_weak_d11") return context.roc5 !== null && context.roc5 <= 0;
  assert.equal(id, "below_vwap_d11"); return context.vwapUtcDay !== null && context.close < context.vwapUtcDay;
}

async function main(): Promise<void> {
  assert.equal(process.argv.length, 3, "Usage: npx ts-node scripts/ladder-indicator-results-check.ts ARTIFACT_DIRECTORY");
  const dir = path.resolve(root, process.argv[2]); local(dir, path.join(root, "backtests"));
  const target = path.join(dir, "verification.json"); assert.ok(!fs.existsSync(target), "Refusing to overwrite verification.json");
  const manifest = read(path.join(dir, "manifest.json")), { spec, baseSpec } = manifest;
  assert.deepEqual(spec, read(local("research-inputs/indicators/ladder-single-2026-09-05.json")));
  assert.deepEqual(baseSpec, read(local(spec.baseSpec))); assert.equal(spec.variantCount, 4); assert.equal(spec.caseCount, 16);
  const cfg = read(local("bot-config.json")); assert.equal(cfg.symbol, "HYPEUSDT"); assert.equal(cfg.maxPositions, 11);
  const fingerprints = [...manifest.sources, ...manifest.inputs];
  for (const p of fingerprints) {
    assert.match(p.sha256, /^[a-f0-9]{64}$/); assert.equal(await hash(local(p.file)), p.sha256, `Pinned file changed: ${p.file}`);
    if (p.bytes !== undefined) assert.equal(fs.statSync(local(p.file)).size, p.bytes);
  }
  for (const needed of ["bot-config.json", "scripts/replay-causal-engine.ts", "scripts/ladder-indicator-policy.ts"])
    assert.ok(manifest.sources.some((p: any) => p.file === needed), `Missing source fingerprint ${needed}`);
  const bases = read(path.join(dir, "baseline.json")), results = read(path.join(dir, "results.json")), all = [...bases, ...results];
  assert.equal(bases.length, 4); assert.equal(results.length, 16);
  const expectedBases = read(local(`${spec.baselineDir}/baseline.json`));
  const models = new Set(bases.map((b: any) => b.model)), keys = new Set<string>();
  assert.equal(models.size, 4);
  for (const r of all) {
    assert.ok(models.has(r.model)); const key = `${r.model}--${r.variant}`; assert.ok(!keys.has(key), `Duplicate case ${key}`); keys.add(key);
    assert.ok(r.variant === "baseline" || spec.variants.some((v: any) => v.id === r.variant));
  }
  for (const model of models) for (const variant of ["baseline", ...spec.variants.map((v: any) => v.id)]) assert.ok(keys.has(`${model}--${variant}`));
  for (const b of bases) {
    const expected = expectedBases.find((r: any) => r.model === b.model); assert.ok(expected);
    assert.equal(b.digest, expected.digest, `Corrected baseline digest ${b.model}`);
    assert.deepEqual(b.metrics, expected.metrics, `Corrected baseline metrics ${b.model}`);
  }
  const artifactNames = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
  assert.ok(artifactNames.includes("validation.json"), "Require completed study before verification");
  const artifacts = await Promise.all(artifactNames.map(async file => ({ file, sha256: await hash(path.join(dir, file)) })));
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = baseSpec.historyEnd;
  process.env.SIM_EQUITY = String(baseSpec.initialEquity);
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  console.log("[verify] independent hourly formulas, literal vetoes and inventory-only accounting");
  const cs = await loadCandles1m("HYPEUSDT", local("data"), Date.parse(baseSpec.historyEnd), local(baseSpec.repairFile));
  const hourly = independentHours(cs, Date.parse(spec.indicatorSeed));
  const fee = cfg.feeRate, equity0 = baseSpec.initialEquity;
  const net = (positions: any[], price: number): number => sum(positions, p => (price - p.entryPrice) * p.qty - fee * (p.notional + price * p.qty));
  const indexAtEnd = new Map(cs.map((c, i) => [c.endTs, i]));
  const monthlyRows = read(path.join(dir, "monthly.json"));
  let decisionsChecked = 0, fillsChecked = 0, partialsChecked = 0, monthsChecked = 0, rungLabelsChecked = 0;
  for (const r of all) {
    const label = `${r.model}--${r.variant}`, ds = lines(path.join(dir, `${label}-decisions.jsonl`));
    const inv = lines(path.join(dir, `${label}-inventory.jsonl`));
    const permits = new Map<number, any>(), affected = new Set<number>(); let previousDecision = -1, vetoes = 0, unknowns = 0;
    for (const x of ds) {
      const d = x.decision; assert.ok(Number.isSafeInteger(d.index) && d.index > previousDecision); previousDecision = d.index;
      assert.equal(d.at, cs[d.index].endTs); near(d.price, cs[d.index].close, `${label} decision price`, 1e-10);
      assert.ok(Number.isSafeInteger(d.nextDepth) && d.nextDepth >= 1 && d.nextDepth <= 11);
      const start = Math.floor(d.at / H) * H - H, expected = d.nextDepth >= 9 ? hourly.get(start) ?? null : null;
      if (expected) {
        const c = x.context; assert.ok(c); assert.equal(c.barStart, start); assert.equal(c.barEnd, start + H);
        assert.equal(c.availableAt, start + H); assert.ok(c.availableAt <= d.at); assert.equal(c.features.timestamp, start);
        near(c.close, expected.close, `${label} independent closed price`, 1e-10);
        for (const field of ["rsi14", "crsi", "roc5", "vwapUtcDay"]) {
          if (expected[field] === null) assert.equal(c.features[field], null);
          else near(c.features[field], expected[field], `${label} independent ${field}`, 1e-8);
        }
      } else assert.equal(x.context, null, `${label} unavailable/below-depth context`);
      const required = r.variant === "rsi_hot_d11" ? "rsi14" : r.variant === "crsi_hot_d11" ? "crsi" : r.variant === "roc_weak_d11" ? "roc5" : "vwapUtcDay";
      const unknown = r.variant !== "baseline" && d.nextDepth >= 11 && (!expected || expected[required] === null);
      const veto = directVeto(r.variant, d.nextDepth, expected);
      assert.equal(x.veto, veto, `${label} literal policy decision`); assert.equal(x.unknown, unknown);
      if (veto) { vetoes++; affected.add(d.episode); } if (unknown) unknowns++;
      permits.set(d.index, x); decisionsChecked++;
    }
    assert.equal(r.vetoDecisions, vetoes); assert.equal(r.vetoEpisodes, affected.size); assert.equal(r.unknownDecisions, unknowns);
    let state: any[] = [], lastAdd = 0, realized = 0, episodePnl = 0, episodeStart = "", episodeDepth = 0;
    const completed: any[] = [], closeNet = new Map<any, number>(), used = new Set<number>();
    const positionLabels = new Map<string, any>(), episodeEntries = new Map<number, string>(); let lastIndex = -1;
    for (const x of inv) {
      const e = x.event; assert.deepEqual(x.before, state, `${label} inventory continuity`);
      assert.ok(Number.isSafeInteger(e.fillIndex) && e.fillIndex >= lastIndex && e.fillIndex > e.decisionIndex); lastIndex = e.fillIndex;
      assert.equal(e.decisionAt, cs[e.decisionIndex].endTs); near(x.decisionPrice, cs[e.decisionIndex].close, `${label} decision quote`, 1e-10);
      const bar = cs[e.fillIndex], native = e.kind === "close" && e.fillAt === bar.endTs;
      if (native) {
        assert.ok(r.model.endsWith("resting_touch")); assert.ok(["tp", "stale_tp"].includes(e.reason));
        assert.ok(e.decisionAt <= bar.ts && e.price <= bar.high);
        const pct = e.reason === "tp" ? cfg.tpPct : cfg.exits.reducedTpPct;
        near(e.price, sum(x.before, p => p.notional) / sum(x.before, p => p.qty) * (1 + pct / 100), `${label} prior native target`);
      } else {
        assert.equal(e.fillIndex, e.decisionIndex + 1); assert.equal(e.fillAt, bar.ts); assert.equal(e.fillAt, e.decisionAt);
        near(e.price, bar.open, `${label} next-open fill`, 1e-10);
      }
      assert.ok(e.qty > 0 && e.price > 0);
      if (e.kind === "open") {
        const p = permits.get(e.decisionIndex); assert.ok(p && !p.veto, `${label} filled without permission`);
        assert.ok(!used.has(e.decisionIndex), `${label} duplicated permitted fill`); used.add(e.decisionIndex);
        assert.equal(p.decision.episode, x.episode); assert.equal(x.after.length, x.before.length + 1);
        assert.equal(p.decision.nextDepth, x.after.length); assert.deepEqual(x.after.slice(0, -1), x.before);
        const rung = x.after.at(-1); assert.equal(rung.level, x.before.length); assert.equal(rung.entryTime, e.fillAt);
        near(rung.entryPrice, e.price, `${label} rung entry`); near(rung.qty, e.qty, `${label} rung quantity`);
        near(rung.notional, cfg.basePositionUsdt * cfg.addScaleFactor ** x.before.length, `${label} unchanged geometric sizing`);
        near(rung.qty * rung.entryPrice, rung.notional, `${label} executed notional`);
        if (!state.length) { episodeStart = new Date(e.fillAt).toISOString(); episodeEntries.set(x.episode, episodeStart); episodePnl = 0; episodeDepth = 0; }
        episodeDepth = Math.max(episodeDepth, x.after.length); lastAdd = e.fillAt;
        assert.ok(!positionLabels.has(rung.id)); positionLabels.set(rung.id, { rung, episode: x.episode, decision: p,
          closed: false, exitAt: null, exitPrice: null, exitReason: null, realizedPnl: 0, markedPnl: 0 });
      } else {
        assert.ok(["partial", "close"].includes(e.kind));
        const remaining = new Set(x.after.map((p: any) => p.id)), removed = x.before.filter((p: any) => !remaining.has(p.id));
        assert.deepEqual(x.after, x.before.filter((p: any) => remaining.has(p.id)), `${label} survivors unchanged`);
        near(e.qty, sum(removed, p => p.qty), `${label} removed quantity`);
        const cash = net(removed, e.price); realized += cash; episodePnl += cash; closeNet.set(x, cash);
        for (const p of removed) {
          const label = positionLabels.get(p.id); assert.ok(label && !label.closed);
          Object.assign(label, { closed: true, exitAt: e.fillAt, exitPrice: e.price, exitReason: e.reason, realizedPnl: net([p], e.price) });
        }
        if (e.kind === "partial") {
          const keep = cfg.srPartialExitAction.keepRungs; assert.equal(x.after.length, keep);
          const selected = [...x.before].sort((a, b) => (x.decisionPrice - b.entryPrice) * b.qty - (x.decisionPrice - a.entryPrice) * a.qty)
            .slice(0, x.before.length - keep).map(p => p.id).sort();
          assert.deepEqual(removed.map((p: any) => p.id).sort(), selected, `${label} independently ranked partial allocation`); partialsChecked++;
        } else {
          assert.equal(x.after.length, 0); completed.push({ entry: episodeStart, close: new Date(e.fillAt).toISOString(), reason: e.reason, pnl: episodePnl, depth: episodeDepth });
          episodePnl = 0; lastAdd = 0;
        }
      }
      assert.equal(x.lastAddTime, lastAdd, `${label} transactional clock remains unchanged after partial`);
      state = x.after; fillsChecked++;
    }
    for (const [index, permission] of permits) if (!permission.veto && !used.has(index)) {
      assert.ok(r.pendingAtEnd && r.pendingAtEnd.kind === "open", `${label} permitted open vanished`);
      assert.equal(r.pendingAtEnd.decisionIndex, index); assert.equal(r.pendingAtEnd.decisionAt, permission.decision.at);
    }
    near(r.metrics.realized, realized, `${label} all realized exits`);
    assert.equal(r.metrics.episodes.length, completed.length);
    completed.forEach((e, i) => { const saved = r.metrics.episodes[i]; for (const key of ["entry", "close", "reason", "depth"]) assert.equal(saved[key], e[key]); near(saved.pnl, e.pnl, `${label} whole-episode net`); });
    near(r.metrics.unfinishedPartialPnl, episodePnl, `${label} incomplete episode realized partials`);
    const wins = completed.filter(e => e.pnl > 0), losses = completed.filter(e => e.pnl < 0);
    assert.equal(r.metrics.profitableEpisodes, wins.length); assert.equal(r.metrics.losingEpisodes, losses.length);
    near(r.metrics.grossWin, sum(wins, e => e.pnl), `${label} winning dollars after fees`);
    near(r.metrics.grossLoss, -sum(losses, e => e.pnl), `${label} losing-dollar magnitude after fees`);
    assert.equal(r.metrics.fullCloses, completed.length); assert.equal(r.metrics.partials, inv.filter(x => x.event.kind === "partial").length);
    assert.equal(r.metrics.tpCycles, completed.filter(e => ["tp", "stale_tp"].includes(e.reason)).length);
    assert.equal(r.metrics.forcedCloses, completed.filter(e => !["tp", "stale_tp"].includes(e.reason)).length);
    assert.equal(r.metrics.openDepth, state.length); near(r.endMark.qty, sum(state, p => p.qty), `${label} final quantity`);
    assert.equal(r.endMark.at, Date.parse(r.end)); const finalIndex = indexAtEnd.get(r.endMark.at); assert.ok(finalIndex !== undefined);
    near(r.endMark.price, cs[finalIndex].close, `${label} end price`, 1e-10);
    const openNet = net(state, r.endMark.price); near(r.metrics.openPnl, openNet, `${label} open liquidation mark`);
    near(r.metrics.totalPnl, realized + openNet, `${label} total PnL`);
    if (r.variant === "baseline") {
      for (const p of state) positionLabels.get(p.id).markedPnl = net([p], r.endMark.price);
      const expected = [...positionLabels.values()].filter(x => x.rung.level + 1 >= 9);
      const features = lines(path.join(dir, `${label}-features.jsonl`)), outcomes = lines(path.join(dir, `${label}-outcomes.jsonl`));
      assert.equal(features.length, expected.length); assert.equal(outcomes.length, expected.length);
      expected.forEach((x, i) => {
        const f = features[i], o = outcomes[i], p = x.rung, d = x.decision;
        assert.deepEqual(Object.keys(f).sort(), ["positionId", "episode", "decisionIndex", "at", "nextDepth", "priceDropOk", "context"].sort(), "Features must not carry future outcome labels");
        assert.equal(f.positionId, p.id); assert.equal(f.episode, x.episode); assert.equal(f.decisionIndex, d.decision.index);
        assert.equal(f.at, d.decision.at); assert.equal(f.nextDepth, p.level + 1); assert.equal(f.priceDropOk, d.decision.priceDropOk);
        assert.deepEqual(f.context, d.context, "Attribution uses exact independently verified decision context");
        assert.equal(o.positionId, p.id); assert.equal(o.episode, x.episode); assert.equal(o.fillAt, p.entryTime);
        for (const field of ["entryPrice", "qty", "notional"]) near(o[field], p[field], `${label} rung label ${field}`);
        for (const field of ["closed", "exitAt", "exitPrice", "exitReason"]) assert.equal(o[field], x[field]);
        near(o.realizedPnl, x.realizedPnl, `${label} rung allocation realized`); near(o.markedPnl, x.markedPnl, `${label} rung allocation marked`);
        const episode = completed.find(e => e.entry === episodeEntries.get(x.episode));
        if (!episode) assert.equal(o.episodeOutcome, null);
        else { for (const key of ["entry", "close", "reason", "depth"]) assert.equal(o.episodeOutcome[key], episode[key]);
          near(o.episodeOutcome.pnl, episode.pnl, `${label} eventual whole episode is a separate label`); }
        rungLabelsChecked++;
      });
    }
    const turnover = sum(inv, x => x.event.qty * x.event.price) + r.endMark.qty * r.endMark.price;
    near(r.stress.executedPlusMarkedExitTurnover, turnover, `${label} actual and marked turnover`);
    near(r.stress.fixedPathNet, realized + openNet - turnover * 0.0005, `${label} fixed-path five-bps stress`);

    // Independently replay INVENTORY events only, never entry/exit policy. Native
    // targets close at the modeled candle end; next-open mutations occur first.
    const startIndex = indexAtEnd.get(Date.parse(r.start)); assert.ok(startIndex !== undefined);
    let cursor = 0, live: any[] = [], cash = 0, peak = equity0, minimum = equity0, dd = 0, maxCost = 0;
    const months = new Map<string, any>();
    const apply = (x: any) => { cash += closeNet.get(x) ?? 0; live = x.after; };
    const observe = (value: number) => { peak = Math.max(peak, value); minimum = Math.min(minimum, value); dd = Math.max(dd, (peak - value) / peak * 100); };
    for (let i = startIndex; i <= finalIndex; i++) {
      const c = cs[i];
      while (cursor < inv.length && inv[cursor].event.fillIndex === i && inv[cursor].event.fillAt === c.ts) apply(inv[cursor++]);
      maxCost = Math.max(maxCost, sum(live, p => p.notional)); observe(equity0 + cash + net(live, c.low));
      while (cursor < inv.length && inv[cursor].event.fillIndex === i) { assert.equal(inv[cursor].event.fillAt, c.endTs); apply(inv[cursor++]); }
      const equity = equity0 + cash + net(live, c.close); observe(equity);
      const month = monthOf(c.endTs), previous = months.get(month);
      months.set(month, { at: c.endTs, price: c.close, equity, realized: cash,
        maxNotional: Math.max(previous?.maxNotional ?? 0, sum(live, p => p.notional)), deepMinutes: (previous?.deepMinutes ?? 0) + Number(live.length >= 9) });
    }
    assert.equal(cursor, inv.length); near(r.metrics.maxNotional, maxCost, `${label} peak executed entry-cost exposure`);
    near(r.metrics.maxDrawdownPct, dd, `${label} independent adverse/close equity drawdown`, 1e-8);
    near(r.metrics.minEquity, minimum, `${label} independent minimum equity`);
    const marks = read(path.join(dir, `${label}-month-marks.json`)); assert.equal(marks.length, months.size);
    assert.equal(r.metrics.monthly.length, months.size);
    let priorEquity = equity0, priorRealized = 0;
    for (const [month, actual] of months) {
      const recorded = r.metrics.monthly.find((m: any) => m.month === month), mark = marks.find((m: any) => m.month === month); assert.ok(recorded && mark);
      assert.equal(mark.at, actual.at); near(mark.price, actual.price, `${label} ${month} exact snapshot convention`, 1e-10);
      near(recorded.mtmPnl, actual.equity - priorEquity, `${label} ${month} independent marked change`);
      near(recorded.realizedPnl, actual.realized - priorRealized, `${label} ${month} independently realized`);
      near(recorded.endEquity, actual.equity, `${label} ${month} closing equity`); near(recorded.maxNotional, actual.maxNotional, `${label} monthly exposure`);
      assert.equal(recorded.deepMinutes, actual.deepMinutes);
      const row = monthlyRows.filter((m: any) => m.model === r.model && m.variant === r.variant && m.month === month); assert.equal(row.length, 1);
      for (const field of ["mtmPnl", "realizedPnl", "endEquity", "maxNotional", "deepMinutes"]) near(row[0][field], recorded[field], `${label} monthly export ${field}`);
      const exited = completed.filter(e => e.close.slice(0, 7) === month);
      assert.equal(row[0].wins, exited.filter(e => e.pnl > 0).length); assert.equal(row[0].losses, exited.filter(e => e.pnl < 0).length);
      near(row[0].winningDollars, sum(exited, e => Math.max(0, e.pnl)), `${label} ${month} episode wins`);
      near(row[0].losingDollars, sum(exited, e => Math.min(0, e.pnl)), `${label} ${month} episode losses`);
      priorEquity = actual.equity; priorRealized = actual.realized; monthsChecked++;
    }
    console.log(`[case verified] ${label}: ${ds.length} decisions, ${inv.length} inventory events`);
  }
  assert.equal(monthsChecked, monthlyRows.length);
  for (const r of results) {
    const b = bases.find((x: any) => x.model === r.model); assert.ok(b);
    near(r.delta.pnlDelta, r.metrics.totalPnl - b.metrics.totalPnl, "baseline PnL delta");
    near(r.delta.ddReductionPp, b.metrics.maxDrawdownPct - r.metrics.maxDrawdownPct, "baseline DD delta");
    near(r.delta.grossWinDelta, r.metrics.grossWin - b.metrics.grossWin, "baseline win-dollar delta");
    near(r.delta.grossLossDelta, r.metrics.grossLoss - b.metrics.grossLoss, "baseline loss-dollar delta");
    near(r.fixedPathStressDelta, r.stress.fixedPathNet - b.stress.fixedPathNet, "baseline stress delta");
  }
  for (const row of monthlyRows) {
    const baseline = bases.find((b: any) => b.model === row.model).metrics.monthly.find((m: any) => m.month === row.month);
    near(row.baselineMtmPnl, baseline.mtmPnl, "monthly baseline"); near(row.mtmDelta, row.mtmPnl - baseline.mtmPnl, "monthly baseline delta");
  }
  for (const p of fingerprints) assert.equal(await hash(local(p.file)), p.sha256, `Source/input changed during verification: ${p.file}`);
  for (const p of artifacts) assert.equal(await hash(path.join(dir, p.file)), p.sha256, `Artifact changed during verification: ${p.file}`);
  fs.writeFileSync(target, JSON.stringify({ version: 1, verifiedAt: new Date().toISOString(), passed: true,
    verifier: { file: path.relative(root, __filename).replace(/\\/g, "/"), sha256: await hash(__filename) },
    baselineDigestsAndMetricsMatched: 4, variantCases: results.length, decisionsChecked, fillsChecked, partialsChecked, monthsChecked, rungLabelsChecked,
    independentFormulasAndLiteralPolicies: true, inventoryPermissionsAndAllocations: true, transactionalClock: true,
    independentlyReconstructedEquityDrawdownAndMonthlyAccounting: true, hashesUnchanged: true, artifacts,
    limitations: ["No rerun of canonical entry/exit engine or outer-gate eligibility; unchanged corrected baselines and saved actual permissions audited.",
      "Resting-target fills remain an OHLC model, not proof of live queue execution or funding settlement.",
      "Descriptive cohort selection/rankings are not independently regenerated by this verifier.",
      "Overlapping windows repeat observations; audit counts are artifact rows, not independent events."],
    writes: ["verification.json only"] }, null, 2) + "\n", { flag: "wx" });
  console.log(`[verified] 4 baselines + ${results.length} variants, ${decisionsChecked} decisions, ${fillsChecked} fills, ${monthsChecked} monthly rows`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
