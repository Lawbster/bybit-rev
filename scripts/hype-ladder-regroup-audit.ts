/** Read-only live evidence plus descriptive labels on accepted historical paths.
 * No executor, network, config mutation or new economic strategy.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import type { Candle } from "./hype-freerun-canonical-replay";
type Row = Record<string, any>;
const hash = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");
const sum = (xs: Row[], key: string) => xs.reduce((n, r) => n + Number(r[key]), 0);
const iso = (t: number) => new Date(t).toISOString();

export function firstDeepObservations(candles: Candle[], events: Row[], endAt: number, minDepth: number, threshold: number) {
  let cursor = 0, held: Row[] = [], episode = 0;
  const seen = new Set<number>(), observations: Row[] = [];
  for (let i = 0; i < candles.length && candles[i].endTs <= endAt; i++) {
    while (cursor < events.length && events[cursor].event.fillIndex <= i) {
      const e = events[cursor++];
      assert.equal(e.event.fillIndex, i, "events must have a corresponding archived candle");
      assert(e.event.fillAt >= candles[i].ts && e.event.fillAt <= candles[i].endTs);
      assert.deepEqual(e.before, held, "inventory continuity");
      held = e.after; episode = e.episode;
    }
    if (held.length < minDepth || seen.has(episode)) continue;
    const qty = sum(held, "qty"), cost = sum(held, "notional"), avg = cost / qty;
    const grossPct = (candles[i].close / avg - 1) * 100;
    if (grossPct > threshold) continue;
    seen.add(episode);
    observations.push({ episode, index: i, at: candles[i].endTs, iso: iso(candles[i].endTs), depth: held.length,
      price: candles[i].close, avg, qty, cost, grossPct, grossPnl: qty * candles[i].close - cost,
      oldestAgeHours: (candles[i].endTs - Math.min(...held.map(p => p.entryTime))) / 3600000 });
  }
  assert.equal(cursor, events.length, "all inventory events included");
  return observations;
}

export function cohort(xs: Row[]) {
  const closed = xs.filter(x => x.outcome), wins = closed.filter(x => x.outcome.pnl > 0), losses = closed.filter(x => x.outcome.pnl < 0);
  return { observations: xs.length, completed: closed.length, wins: wins.length, losses: losses.length,
    flat: closed.length - wins.length - losses.length, unresolved: xs.length - closed.length,
    winningDollars: wins.reduce((n, x) => n + x.outcome.pnl, 0), losingDollars: losses.reduce((n, x) => n + x.outcome.pnl, 0),
    netCompleted: closed.reduce((n, x) => n + x.outcome.pnl, 0),
    positiveEpisodeFraction: closed.length ? wins.length / closed.length : null };
}

export function episodeMarkAt(x: Row, events: Row[], fee: number) {
  let priorPartials = 0;
  for (const e of events) {
    if (e.episode !== x.episode || e.event.kind !== "partial" || e.event.fillIndex > x.index) continue;
    const costClosed = sum(e.before, "notional") - sum(e.after, "notional"), proceeds = e.event.qty * e.event.price;
    priorPartials += proceeds - costClosed - (proceeds + costClosed) * fee;
  }
  // Episode value at the observed close, including the SAME modeled inventory
  // closing-fee reserve as the archived equity curve. This is not an executable
  // same-close exit, a counterfactual replay, or profit available from a new stop.
  return priorPartials + x.grossPnl - (x.cost + x.qty * x.price) * fee;
}

async function main() {
  const root = path.resolve(__dirname, ".."), pins: Row[] = [];
  const read = (file: string) => {
    const abs = path.join(root, file), before = fs.statSync(abs), bytes = fs.readFileSync(abs), after = fs.statSync(abs);
    assert(before.size === after.size && before.mtimeMs === after.mtimeMs, `Changed input: ${file}`);
    pins.push({ file, bytes: bytes.length, sha256: hash(bytes) }); return bytes;
  };
  const json = (f: string) => JSON.parse(read(f).toString("utf8"));
  async function rows(file: string, visit: (r: Row, line: number) => void) {
    const abs = path.join(root, file), before = fs.statSync(abs), h = crypto.createHash("sha256"), stream = fs.createReadStream(abs);
    stream.on("data", b => h.update(b)); let n = 0;
    for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
      n++; if (line.trim()) visit(JSON.parse(line), n);
    }
    const after = fs.statSync(abs); assert(before.size === after.size && before.mtimeMs === after.mtimeMs);
    pins.push({ file, bytes: after.size, sha256: h.digest("hex") });
  }
  const specFile = "research-inputs/ladder-regroup-2026-09-08.json", spec = json(specFile);
  const state = json("bot-state.json"), health = json("data/HYPEUSDT_runtime_health.json"), cfg = json("bot-config.json");
  const short = json("data/HYPEUSDT_hl_short_live_health.json"), watchdog = json("data/HYPEUSDT_operational_watchdog_state.json");
  const cutoff = health.writtenAt, earliest = Math.min(...state.positions.map((p: Row) => p.entryTime));
  assert(state.positions.length && Number.isFinite(earliest));
  const decisions: Row[] = [], shadows: Row[] = [];
  await rows("data/HYPEUSDT_decisions.jsonl", (r, line) => {
    if (r.symbol === "HYPEUSDT" && r.decision === "ladder_add" && r.ts >= earliest && r.ts <= cutoff) decisions.push({ ...r, line });
  });
  await rows("data/HYPEUSDT_sr_shadow_signals.jsonl", (r, line) => {
    const t = r.timestamp ?? Date.parse(r.ts);
    if (t >= earliest - 300000 && t <= state.lastAddTime) shadows.push({ ...r, at: t, line });
  });
  shadows.sort((a, b) => a.at - b.at);
  const rungs = state.positions.map((p: Row, index: number) => {
    const ds = decisions.filter(d => d.ts === p.entryTime && d.rungLevel === p.level); assert.equal(ds.length, 1);
    const d = ds[0], previous = state.positions[index - 1];
    const drop = previous ? d.quotePrice <= previous.entryPrice * (1 - cfg.priceTriggerPct / 100) : false;
    const sr = shadows.filter(s => s.at <= d.ts).at(-1);
    const priorSr = sr && d.ts - sr.at <= 300000 ? { at: sr.at, ageSeconds: (d.ts - sr.at) / 1000,
      line: sr.line, depth: sr.ladder?.depth, price: sr.price, levels: sr.levels, addContext: sr.addContext } : null;
    return { rung: index + 1, at: p.entryTime, iso: iso(p.entryTime), fill: p.entryPrice, quote: d.quotePrice,
      qty: p.qty, cost: p.notional, grossPnlAtCutoff: (health.websocket.bestBid - p.entryPrice) * p.qty,
      minutesAfterPrevious: previous ? (p.entryTime - previous.entryTime) / 60000 : null,
      mode: index === 0 ? "start" : drop ? "price_drop" : "timer_only",
      decisionLine: d.line, hl15: d.hlTaker15m, hl1h: d.hlTaker1h, hlSamples15: d.hlTaker15mSamples,
      hlSamples1h: d.hlTaker1hSamples, hlAgeSec: d.hlTakerAgeSec, book05: d.hlObImbalance05,
      assetOi1hPct: d.hlAssetOi1hPct, assetOi4hPct: d.hlAssetOi4hPct,
      funding: [d.fdByNow, d.fdBnNow, d.fdHlNow], supportReopen: d.supportReopen, precedingSrObservation: priorSr };
  });
  const latestCandles: Candle[] = [];
  await rows("data/HYPEUSDT_1m.jsonl", r => {
    const ts = Number(r.ts ?? r.timestamp);
    if (ts >= earliest && ts + 60000 <= cutoff) latestCandles.push({ ts, endTs: ts + 60000,
      open: Number(r.o ?? r.open), high: Number(r.h ?? r.high), low: Number(r.l ?? r.low), close: Number(r.c ?? r.close),
      volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) });
  });
  latestCandles.sort((a, b) => a.ts - b.ts);
  for (let i = 1; i < latestCandles.length; i++) assert.equal(latestCandles[i].ts - latestCandles[i - 1].ts, 60000, "current episode coverage");
  const fullDepthCandles = latestCandles.filter(c => c.ts >= state.lastAddTime); assert(fullDepthCandles.length);
  const qty = sum(state.positions, "qty"), cost = sum(state.positions, "notional"), avg = cost / qty;
  const max = fullDepthCandles.reduce((a, b) => a.high > b.high ? a : b), min = fullDepthCandles.reduce((a, b) => a.low < b.low ? a : b);
  const ledger = json(`${spec.liveLedger}/summary.json`), batches = json(`${spec.liveLedger}/batch-closes.json`), partials = json(`${spec.liveLedger}/sr-partials.json`);
  assert.equal(Date.parse(ledger.sourceCutoff), cutoff);
  assert(!batches.some((r: Row) => Date.parse(r.ts) >= earliest), "current episode has no close");
  assert(!partials.some((r: Row) => Date.parse(r.ts) >= earliest), "current episode has no partial");
  const periods = ledger.periods.map((p: Row) => {
    const b = batches.filter((r: Row) => Date.parse(r.ts) >= Date.parse(p.start));
    const wins = b.filter((r: Row) => r.totalPnl > 0), losses = b.filter((r: Row) => r.totalPnl < 0);
    return { ...p, batchWins: wins.length, batchLosses: losses.length, winningBatchDollars: sum(wins, "totalPnl"), losingBatchDollars: sum(losses, "totalPnl") };
  });
  const current = { cutoff: iso(cutoff), stateAt: iso(state.lastUpdated), start: iso(earliest), reachedFullDepth: iso(state.lastAddTime),
    buildHours: (state.lastAddTime - earliest) / 3600000, ageHours: (cutoff - earliest) / 3600000,
    qty, cost, avg, bid: health.websocket.bestBid, grossPnl: qty * health.websocket.bestBid - cost,
    grossPct: (health.websocket.bestBid / avg - 1) * 100, entryCostToEquity: cost / health.upsideInputs.equity,
    tp: state.makerTpOrder.exchangePrice, tpQty: state.makerTpOrder.submittedQty,
    reboundToTpPct: (state.makerTpOrder.exchangePrice / health.websocket.bestBid - 1) * 100,
    fullDepthHigh: { at: iso(max.ts), price: max.high, grossPct: (max.high / avg - 1) * 100 },
    fullDepthLow: { at: iso(min.ts), price: min.low, grossPct: (min.low / avg - 1) * 100 },
    rateLimitErrorsNeedSeparateLogReview: true, trend: state.lastTrendCheck, market: health.upsideInputs.market,
    reconciliation: health.reconciliation, recovery: state.recoveryMode, pending: !!state.pendingOrder,
    currentMakerTouched: state.makerTpOrder.touchedAt, makerAppliedQty: state.makerTpOrder.appliedQty,
    watchdogAt: iso(watchdog.updatedAt), activeIncidents: Object.values(watchdog.incidents).filter((x: any) => x.active),
    short: { writtenAt: iso(short.writtenAt), entryEnabled: short.entryEnabled, position: short.position, recovery: short.recovery },
    fundingBookkeeping: { totalFunding: state.totalFunding, lastFundingSettlement: state.lastFundingSettlement },
    rungs, periods };

  // Reconstruct the EXACT captured price prefix, not today's revised historical rows.
  const archive = spec.historicalArchive, oldManifest = json(`${archive}/manifest.json`);
  const baselineBytes = read(`${archive}/baseline.json`); assert.equal(hash(baselineBytes), spec.baselineSha256);
  const baselines: Row[] = JSON.parse(baselineBytes.toString("utf8")), byTs = new Map<number, Candle>();
  const prefixEvidence: Row[] = [];
  for (const file of ["data/HYPEUSDT_1_full.json", "data/HYPEUSDT_1m.jsonl"]) {
    const pin = oldManifest.inputs.find((r: Row) => r.file === file); assert(pin);
    const all = read(file); assert(all.length >= pin.bytes);
    const original = all.subarray(0, pin.bytes); assert.equal(hash(original), pin.sha256, `Archived prefix changed: ${file}`);
    prefixEvidence.push({ file, bytes: pin.bytes, sha256: pin.sha256, matches: true });
    const rs = file.endsWith("jsonl") ? original.toString("utf8").split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x)) : JSON.parse(original.toString("utf8"));
    for (const r of rs) {
      const ts = Number(r.timestamp ?? r.ts); if (ts + 60000 > Date.parse(spec.historicalCutoff)) continue;
      byTs.set(ts, { ts, endTs: ts + 60000, open: Number(r.open ?? r.o), high: Number(r.high ?? r.h),
        low: Number(r.low ?? r.l), close: Number(r.close ?? r.c), volume: Number(r.volume ?? r.v), turnover: Number(r.turnover ?? r.t) });
    }
  }
  read(spec.repairFile);
  const candles = applyCandleRepair([...byTs.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(path.join(root, spec.repairFile)), "HYPEUSDT", Date.parse(spec.historicalCutoff));
  const histories: Row[] = [];
  for (const b of baselines) {
    const events: Row[] = [];
    await rows(`${archive}/${b.model}--baseline-inventory.jsonl`, r => events.push(r));
    const outcomes = new Map<number, Row>(b.audit.episodes.map((x: Row) => [x.episode, x]));
    const all = cohort(b.audit.episodes); assert.equal(all.wins, b.metrics.profitableEpisodes); assert.equal(all.losses, b.metrics.losingEpisodes);
    assert(Math.abs(all.winningDollars + all.losingDollars + b.metrics.unfinishedPartialPnl + b.metrics.openPnl - b.metrics.totalPnl) < 1e-6);
    for (const threshold of spec.descriptiveGrossPnlThresholdsPct) {
      const observations: Row[] = firstDeepObservations(candles, events, b.endMark.at, spec.descriptiveMinimumDepth, threshold)
        .map((x): Row => { const e = outcomes.get(x.episode); assert(e); assert(!e.outcome || Date.parse(e.outcome.close) >= x.at);
          const netEpisodeMark = episodeMarkAt(x, events, cfg.feeRate);
          return { ...x, outcome: e.outcome, netEpisodeMark,
            valueChangeToCompletion: e.outcome ? e.outcome.pnl - netEpisodeMark : null,
            hoursToClose: e.outcome ? (Date.parse(e.outcome.close) - x.at) / 3600000 : null }; });
      const months = [...new Set(observations.map(x => x.iso.slice(0, 7)))].sort().map(month => ({ month,
        ...cohort(observations.filter(x => x.iso.startsWith(month))) }));
      const finished = observations.filter(x => x.outcome);
      histories.push({ model: b.model, threshold, allBaseline: all, selected: cohort(observations),
        completedEpisodeMarksAtObservation: sum(finished, "netEpisodeMark"),
        subsequentEpisodeValueChange: sum(finished, "valueChangeToCompletion"),
        months, observations });
    }
  }
  for (const f of ["scripts/hype-ladder-regroup-audit.ts", "scripts/ladder-regroup-audit-tests.ts", "scripts/replay-candle-repair.ts"]) read(f);
  const out = path.resolve(root, process.env.REGROUP_OUT ?? "backtests/hype/hype-regroup-2026-09-08/diagnostic");
  const rel = path.relative(path.join(root, "backtests"), out); assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel) && !fs.existsSync(out));
  // Recheck every read input before publishing accepted output.
  for (const pin of pins) assert.equal(hash(fs.readFileSync(path.join(root, pin.file))), pin.sha256, `Changed before publish: ${pin.file}`);
  fs.mkdirSync(out, { recursive: true });
  const write = (f: string, value: unknown) => fs.writeFileSync(path.join(out, f), JSON.stringify(value, null, 2) + "\n");
  write("live.json", current); write("historical-cohorts.json", histories);
  write("manifest.json", { at: iso(Date.now()), spec, pins, prefixEvidence, newStrategies: 0,
    baselineAccountingVerified: true, archivedInventoryContinuityVerified: true, outcomeOnly: true });
  console.log(JSON.stringify({ out, current: { start: current.start, grossPnl: current.grossPnl, buildHours: current.buildHours },
    cohorts: histories.map(({ model, threshold, allBaseline, selected }) => ({ model, threshold, allBaseline, selected })) }, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
