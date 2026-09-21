/** Independent raw-price/flow formulas and event-ledger accounting. Does not import the policy or replay engine. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import readline from "readline";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import type { Candle } from "./hype-freerun-canonical-replay";
const hash = (v: string | Buffer) => crypto.createHash("sha256").update(v).digest("hex");
const near = (a: number, b: number, message = "numeric parity") => assert(Math.abs(a - b) < 1e-6, `${message}: ${a} != ${b}`);
const M = 60000, H = 3600000, D = 24 * H;
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const lines = (file: string) => fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x));
const epoch = (x: any) => typeof x === "number" ? x : /^\d{13}$/.test(x) ? Number(x) : Date.parse(x);
async function main() {
  const root = path.resolve(__dirname, ".."), dir = path.resolve(root, process.argv[2] ?? "backtests/hype/hype-conditional-half11-2026-09-08");
  const rel = path.relative(path.join(root, "backtests"), dir); assert(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
  const manifest = read(path.join(dir, "manifest.json")), results = read(path.join(dir, "results.json"));
  assert(read(path.join(dir, "validation.json")).passed); assert.equal(results.length, 34);
  const oldBases = read(path.join(root, manifest.spec.baselineDir, "baseline.json"));
  const oldVariants = read(path.join(root, manifest.spec.baselineDir, "results.json"));
  let controls = 0;
  for (const r of results.filter((x: any) => !x.model.startsWith("hl_extended") && ["baseline", "last11_50"].includes(x.variant))) {
    const expected = (r.variant === "baseline" ? oldBases : oldVariants).find((x: any) => x.model === r.model && x.variant === r.variant);
    assert(expected); assert.equal(r.digest, expected.digest); controls++;
  }
  assert.equal(controls, 8);
  const output = path.join(dir, "verification.json"); assert(!fs.existsSync(output), "Do not overwrite accepted verification");
  for (const p of [...manifest.inputs, ...manifest.sources, ...manifest.protectedFiles]) {
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(path.join(root, p.file))) h.update(b);
    assert.equal(h.digest("hex"), p.sha256, p.file);
  }
  console.log("[verify] all source, raw-data and protected-state hashes match");
  const cutoff = Date.parse(manifest.spec.latestEnd), priceMap = new Map<number, Candle>();
  function add(r: any) {
    const ts = Number(r.ts ?? r.timestamp); if (ts + M > cutoff) return;
    const c = { ts, endTs: ts + M, open: Number(r.o ?? r.open), high: Number(r.h ?? r.high), low: Number(r.l ?? r.low),
      close: Number(r.c ?? r.close), volume: Number(r.v ?? r.volume), turnover: Number(r.t ?? r.turnover) };
    assert(Object.values(c).every(Number.isFinite)); priceMap.set(ts, c);
  }
  read(path.join(root, "data/HYPEUSDT_1_full.json")).forEach(add);
  for await (const row of readline.createInterface({ input: fs.createReadStream(path.join(root, "data/HYPEUSDT_1m.jsonl")), crlfDelay: Infinity })) if (row.trim()) add(JSON.parse(row));
  const candles = applyCandleRepair([...priceMap.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(path.join(root, manifest.baseSpec.repairFile)), "HYPEUSDT", cutoff);
  priceMap.clear(); candles.forEach((c, i) => { assert.equal(c.ts, candles[0].ts + i * M); });
  function indexAtEnd(at: number) { const i = (at - candles[0].endTs) / M; assert(Number.isInteger(i) && i >= 0 && i < candles.length); return i; }
  const hourly = new Map<number, { ts: number; close: number; volume: number; turnover: number; count: number }>();
  const four = new Map<number, number>();
  for (const c of candles) {
    const ts = Math.floor(c.ts / H) * H, old = hourly.get(ts) ?? { ts, close: c.close, volume: 0, turnover: 0, count: 0 };
    old.close = c.close; old.volume += c.volume; old.turnover += c.turnover; old.count++; hourly.set(ts, old);
    four.set(Math.floor(c.ts / (4 * H)) * 4 * H, c.close);
  }
  const structureCache = new Map<number, { close: number; ema200: number }>();
  function structure(at: number) {
    const end = Math.floor(at / (4 * H)) * 4 * H, existing = structureCache.get(end); if (existing) return existing;
    const closes: number[] = [];
    for (let t = end - 249 * 4 * H; t < end; t += 4 * H) { assert(four.has(t), "249 complete historical4h bars"); closes.push(four.get(t)!); }
    let ema = closes.slice(0, 200).reduce((v, x) => v + x, 0) / 200;
    for (const c of closes.slice(200)) ema = ema + (c - ema) * (2 / 201);
    const value = { close: closes.at(-1)!, ema200: ema }; structureCache.set(end, value); return value;
  }
  type Flow = { available: number; event: number; buy: number; sell: number };
  const flows: Flow[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(root, "data/HYPEUSDT_taker_hyperliquid.jsonl")), crlfDelay: Infinity })) {
    if (!line.trim()) continue; const x = JSON.parse(line);
    if (x.buyNotional === null || x.sellNotional === null || !Number.isFinite(Number(x.buyNotional)) || !Number.isFinite(Number(x.sellNotional)) || x.buyNotional < 0 || x.sellNotional < 0) continue;
    const ts = epoch(x.timestamp ?? x.ts), event = epoch(x.windowEnd ?? x.timestamp);
    const receipts = [x.receivedAt, x.observedAt, x.writtenAt, x.ingestedAt].filter(v => v !== undefined && v !== null).map(epoch);
    flows.push({ available: Math.max(ts, ...receipts, event + (receipts.length ? 0 : M)), event, buy: Number(x.buyNotional), sell: Number(x.sellNotional) });
  }
  flows.sort((a, b) => a.available - b.available);
  const flowCache = new Map<string, any>();
  function flow(at: number, lag: number) {
    const key = `${at}/${lag}`; if (flowCache.has(key)) return flowCache.get(key);
    const available = (f: Flow) => Math.ceil((f.available + lag * 1000) / M) * M;
    let lo = 0, hi = flows.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (available(flows[m]) <= at) lo = m + 1; else hi = m; }
    const windows = [15 * M, H].map(span => {
      let buy = 0, sell = 0, latest: number | null = null; const samples = new Set<number>();
      for (let i = lo - 1; i >= 0 && available(flows[i]) > at - span; i--) {
        const f = flows[i]; if (f.event <= at - span || f.event > at) continue;
        buy += f.buy; sell += f.sell; samples.add(Math.floor(f.event / M)); latest = Math.max(latest ?? 0, f.event);
      }
      return { ratio: sell > 0 ? buy / sell : null, samples: samples.size, latest };
    });
    const value = { taker15m: windows[0].ratio, taker1h: windows[1].ratio, samples15m: windows[0].samples,
      samples1h: windows[1].samples, takerAgeSec: windows[1].latest === null ? null : (at - windows[1].latest) / 1000 };
    flowCache.set(key, value); return value;
  }
  let deepChecks = 0, fills = 0, closed = 0, totalDecisions = 0, minuteChecks = 0;
  const comparisons: any[] = [], traces: any[] = [];
  for (const r of results) {
    const label = `${r.model}--${r.variant}${r.lagSeconds ? `--lag${r.lagSeconds}s` : ""}`;
    const ds = lines(path.join(dir, `${label}-decisions.jsonl`)), inv = lines(path.join(dir, `${label}-inventory.jsonl`));
    const permits = new Map<number, any>(), affected = new Set<number>(); let unknownCount = 0, changed = 0;
    for (const x of ds) {
      const d = x.decision, input = x.input, ctx = x.context, i = indexAtEnd(d.at);
      assert.equal(d.index, i); assert.equal(ctx.index, i); assert.equal(ctx.at, d.at); near(d.price, candles[i].close);
      near(d.requestedNotional, 800 * 1.35 ** (d.nextDepth - 1)); assert.equal(input.nextDepth, d.nextDepth);
      let weak = false, unknown = false;
      if (d.nextDepth === 11) {
        const st = structure(d.at), ret = (candles[i].close - candles[i - 720].close) / candles[i - 720].close * 100;
        assert.equal(ctx.aboveEma200, st.close >= st.ema200); near(ctx.ret12h, ret); assert.equal(input.aboveEma200, ctx.aboveEma200); near(input.ret12h, ret);
        const hour = input.hour, expected = Math.floor(d.at / H) * H - H, rawHour = hourly.get(expected)!;
        assert.equal(rawHour.count, 60); assert(hour); assert.equal(hour.barStart, expected); assert.equal(hour.barEnd, expected + H);
        assert.equal(hour.availableAt, expected + H); near(hour.close, rawHour.close);
        let volume = 0, turnover = 0;
        for (let t = Math.floor(expected / D) * D; t <= expected; t += H) { const h = hourly.get(t)!; assert.equal(h.count, 60); volume += h.volume; turnover += h.turnover; }
        const vwap = volume > 0 ? turnover / volume : null, roc = (rawHour.close / hourly.get(expected - 5 * H)!.close - 1) * 100;
        if (vwap === null) assert.equal(hour.features.vwapUtcDay, null); else near(hour.features.vwapUtcDay, vwap);
        near(hour.features.roc5, roc);
        const f = flow(d.at, r.lagSeconds);
        for (const k of ["taker15m", "taker1h", "samples15m", "samples1h", "takerAgeSec"] as const) {
          if (f[k] === null) assert.equal(input[k], null); else near(input[k], f[k], `raw flow ${k}`);
        }
        if (r.variant === "last11_50") weak = true;
        else if (r.variant === "structure_half11") weak = st.close < st.ema200 || ret <= -2;
        else if (r.variant === "vwap_roc_half11") { unknown = vwap === null; weak = !unknown && rawHour.close < vwap! && roc <= 0; }
        else if (r.variant === "hl_two_window_half11") {
          unknown = f.taker15m === null || f.taker1h === null || f.samples15m < 14 || f.samples1h < 55 || f.takerAgeSec === null || f.takerAgeSec < 0 || f.takerAgeSec > 90;
          weak = !unknown && f.taker15m <= .85 && f.taker1h <= .9;
        }
        if (weak && !traces.some(t => t.variant === r.variant && t.lagSeconds === r.lagSeconds && t.model === r.model)) {
          traces.push({ model: r.model, variant: r.variant, lagSeconds: r.lagSeconds, at: d.at, iso: new Date(d.at).toISOString(),
            structure: { ...st, closed4hAt: Math.floor(d.at / (4 * H)) * 4 * H, ret12h: ret },
            hour: { start: expected, end: expected + H, close: rawHour.close, vwap, roc }, flow: f, decision: d });
        }
        deepChecks++;
      }
      assert.equal(x.result.weak, weak); assert.equal(x.result.unknown, unknown);
      near(x.result.notional, d.requestedNotional * (weak ? .5 : 1));
      if (weak) { affected.add(d.episode); changed++; } if (unknown) unknownCount++;
      permits.set(d.index, x); totalDecisions++;
    }
    assert.equal(affected.size, r.vetoEpisodes); assert.equal(changed, r.changedDecisions); assert.equal(unknownCount, r.unknownDecisions);
    let realized = 0, ep = 0, positions: any[] = [], lastAdd = 0, pointer = 0;
    let peak = 32000, minEquity = 32000, maxDD = 0, maxCost = 0;
    const months = new Map<string, { equity: number; realized: number }>(); let carry: any = null;
    const settle = (x: any) => {
      assert.deepEqual(x.before, positions); const e = x.event; assert(e.fillIndex > e.decisionIndex);
      if (e.kind === "open") {
        const p = permits.get(e.decisionIndex); assert(p); assert.equal(e.fillIndex, e.decisionIndex + 1); assert.equal(e.fillAt, candles[e.fillIndex].ts);
        near(e.price, candles[e.fillIndex].open); near(e.qty * e.price, p.result.notional); assert.equal(x.after.length, x.before.length + 1);
        near(p.decision.entryCostNotional, x.before.reduce((n: number, v: any) => n + v.notional, 0));
        assert.deepEqual(x.after.slice(0, -1), x.before); lastAdd = e.fillAt;
      } else {
        if (e.fillAt === candles[e.fillIndex].ts) near(e.price, candles[e.fillIndex].open);
        else { assert.equal(e.fillAt, candles[e.fillIndex].endTs); assert(r.model.endsWith("resting_touch")); assert(e.price <= candles[e.fillIndex].high); }
        for (const p of x.before) {
          const q = p.qty - (x.after.find((v: any) => v.id === p.id)?.qty ?? 0);
          const net = q * (e.price - p.entryPrice) - q * (e.price + p.entryPrice) * .00055;
          realized += net; ep += net;
        }
        if (e.kind === "close") {
          assert.equal(x.after.length, 0); const outcome = r.metrics.episodes.find((v: any) => v.close === new Date(e.fillAt).toISOString()); assert(outcome);
          near(outcome.pnl, ep); ep = 0; lastAdd = 0; closed++;
        } else assert.equal(e.kind, "partial");
      }
      assert.equal(x.lastAddTime, lastAdd); positions = x.after; fills++;
    };
    const mark = (price: number) => positions.reduce((n, p) => n + p.qty * (price - p.entryPrice) - p.qty * (price + p.entryPrice) * .00055, 0);
    const update = (price: number) => { const equity = 32000 + realized + mark(price); peak = Math.max(peak, equity);
      minEquity = Math.min(minEquity, equity); maxDD = Math.max(maxDD, (peak - equity) / peak * 100); return equity; };
    for (let i = indexAtEnd(Date.parse(r.start)); i <= indexAtEnd(Date.parse(r.end)); i++) {
      const c = candles[i];
      while (inv[pointer]?.event.fillIndex === i && inv[pointer].event.fillAt === c.ts) settle(inv[pointer++]);
      maxCost = Math.max(maxCost, positions.reduce((n, p) => n + p.notional, 0)); update(c.low);
      while (inv[pointer]?.event.fillIndex === i) settle(inv[pointer++]);
      const equity = update(c.close), month = new Date(c.endTs).toISOString().slice(0, 7);
      months.set(month, { equity, realized });
      if (c.endTs === Date.parse(manifest.baseSpec.historyEnd)) carry = { equity, realized, open: mark(c.close) };
      minuteChecks++;
    }
    assert.equal(pointer, inv.length); near(realized, r.metrics.realized); near(mark(r.endMark.price), r.metrics.openPnl);
    near(realized + mark(r.endMark.price), r.metrics.totalPnl); near(maxDD, r.metrics.maxDrawdownPct); near(minEquity, r.metrics.minEquity); near(maxCost, r.metrics.maxNotional);
    let priorEquity = 32000, priorRealized = 0;
    for (const m of r.monthly) { const rebuilt = months.get(m.month)!; near(m.mtmPnl, rebuilt.equity - priorEquity); near(m.realizedPnl, rebuilt.realized - priorRealized);
      const eps = r.metrics.episodes.filter((e: any) => e.close.slice(0, 7) === m.month);
      assert.equal(m.wins, eps.filter((e: any) => e.pnl > 0).length); assert.equal(m.losses, eps.filter((e: any) => e.pnl < 0).length);
      near(m.winDollars, eps.reduce((n: number, e: any) => n + Math.max(0, e.pnl), 0)); near(m.lossDollars, eps.reduce((n: number, e: any) => n + Math.min(0, e.pnl), 0));
      priorEquity = rebuilt.equity; priorRealized = rebuilt.realized; }
    if (r.extension) { assert(carry); near(carry.equity, r.extension.carryInEquity); near(carry.open, r.extension.carryInOpenPnl);
      near(32000 + r.metrics.totalPnl - carry.equity, r.extension.mtmPnl); near(realized - carry.realized, r.extension.realizedPnl); }
    near(r.metrics.grossWin - r.metrics.grossLoss + r.metrics.unfinishedPartialPnl + r.metrics.openPnl, r.metrics.totalPnl);
    const turnover = inv.reduce((v: number, e: any) => v + e.event.qty * e.event.price, 0) + r.endMark.qty * r.endMark.price;
    near(turnover, r.stress.turnover); near(r.stress.fixedPathNet, r.metrics.totalPnl - turnover * .0005);
    for (const parentVariant of ["baseline", "last11_50"]) {
      if (r.variant === parentVariant) continue;
      const parent = results.find((p: any) => p.model === r.model && p.variant === parentVariant && p.lagSeconds === 0); assert(parent);
      const parents = new Map(parent.metrics.episodes.map((e: any) => [e.entry, e])), current = new Map(r.metrics.episodes.map((e: any) => [e.entry, e]));
      const common = r.metrics.episodes.filter((e: any) => parents.has(e.entry));
      const removed = parent.metrics.episodes.filter((e: any) => !current.has(e.entry)), replacements = r.metrics.episodes.filter((e: any) => !parents.has(e.entry));
      const matchedDelta = common.reduce((n: number, e: any) => n + e.pnl - (parents.get(e.entry) as any).pnl, 0);
      const removedNet = removed.reduce((n: number, e: any) => n + e.pnl, 0), replacementNet = replacements.reduce((n: number, e: any) => n + e.pnl, 0);
      const openAndUnfinishedDelta = r.metrics.openPnl + r.metrics.unfinishedPartialPnl - parent.metrics.openPnl - parent.metrics.unfinishedPartialPnl;
      near(matchedDelta - removedNet + replacementNet + openAndUnfinishedDelta, r.metrics.totalPnl - parent.metrics.totalPnl);
      comparisons.push({ model: r.model, variant: r.variant, lagSeconds: r.lagSeconds, parent: parentVariant,
        common: common.length, matchedDelta, removedCount: removed.length, removedNet, replacementCount: replacements.length, replacementNet,
        openAndUnfinishedDelta, totalDelta: r.metrics.totalPnl - parent.metrics.totalPnl });
    }
    console.log(`[verified] ${label}: ${ds.length} decisions /${inv.length} fills; raw context, cash, DD and monthlies`);
  }
  const ranking = read(path.join(dir, "ranking.json"));
  for (const r of ranking) {
    const xs = results.filter((x: any) => x.variant === r.variant && !x.model.startsWith("hl_extended")); assert.equal(xs.length, 4);
    for (const x of xs) { const b = results.find((y: any) => y.model === x.model && y.variant === "baseline"); near(x.delta.pnlDelta, x.metrics.totalPnl - b.metrics.totalPnl); }
    const recent = xs.filter((x: any) => x.model.startsWith("hl_window")), older = xs.filter((x: any) => !x.model.startsWith("hl_window"));
    const p = manifest.baseSpec.profitUpgrade, d = manifest.baseSpec.defensiveTradeoff;
    const enough = recent.every((x: any) => x.vetoEpisodes >= 20);
    const profit = enough && recent.every((x: any) => x.delta.pnlDelta >= p.minimumHlPnlDelta && x.delta.grossLossReductionPct >= p.minimumHlGrossLossReductionPct)
      && xs.every((x: any) => x.delta.ddReductionPp >= -p.maximumDdIncreasePp - 1e-9 && x.delta.worstMonthDelta >= p.minimumMonthlyMtmDelta)
      && older.every((x: any) => x.delta.pnlDelta >= p.minimumPublishedPnlDelta);
    const defensive = enough && recent.every((x: any) => x.delta.grossLossReductionPct >= d.minimumHlGrossLossReductionPct && x.delta.ddReductionPp >= d.minimumHlDdReductionPp)
      && xs.every((x: any) => x.delta.pnlRetention >= d.minimumPnlRetention && x.delta.worstMonthDelta >= d.minimumMonthlyMtmDelta)
      && older.every((x: any) => x.delta.ddReductionPp >= -d.maximumPublishedDdIncreasePp);
    assert.equal(r.profitUpgrade, profit); assert.equal(r.defensiveTradeoff, defensive);
  }
  const result = { passed: true, cases: results.length, archivedControlsExact: controls, deepRawFormulaChecks: deepChecks, decisions: totalDecisions,
    fills, closedEpisodeRecords: closed, independentMinuteEquityChecks: minuteChecks, rawHLWindows: flowCache.size,
    independentClosedBarAndFlowMath: true, independentSizing: true, independentPerPositionPnlAndMonthlyAndDrawdown: true,
    extensionCarryAccounting: true, hashesUnchanged: true, liveChanges: 0, checkerSha256: hash(fs.readFileSync(__filename)), at: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, "independent-attribution.json"), JSON.stringify({ comparisons, traces }, null, 2) + "\n");
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n"); console.log(result);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
