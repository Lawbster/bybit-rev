/** RR01: historical feature diagnostics, NOT a strategy backtest. Local files only. */
import fs from "fs";
import path from "path";
import readline from "readline";
import assert from "assert/strict";
import { ClosedBarSeries } from "../src/research/closed-bars";
import { RelativeTape, HOUR, type Features } from "./relative-reversion-features";
import { applyCandleRepair, readCandleRepair, MINUTE } from "./replay-candle-repair";
import { atomicJson, inside, fileHash, type Plan } from "./research-workflow";
import { summarize } from "./failed-recovery-analysis";
import type { Candle } from "./hype-freerun-canonical-replay";
type R = Record<string, any>;

export function validateDefinition(d: R): void {
  assert(/^[A-Z0-9]+USDT$/.test(d.asset) && /^[A-Z0-9]+USDT$/.test(d.market) && d.asset !== d.market);
  for (const k of ["start", "cutoff"]) assert(typeof d[k] === "string" && d[k].endsWith("Z") && Number.isSafeInteger(Date.parse(d[k])));
  assert(Date.parse(d.cutoff) > Date.parse(d.start) && (Date.parse(d.cutoff) - Date.parse(d.start)) <= 370 * 86400000);
  assert.equal(d.trainingHours, 168); assert.equal(d.minimumPairs, 160);
  assert.deepEqual(d.publicationLagsMs, [0, 60000]);
  assert.equal(d.gridHours, 4); assert.equal(d.outcomeHours, 12);
  assert.equal(d.landmarkThreshold, -3); assert.equal(d.landmarkMinutes, 60);
  assert.equal(d.newTradingDefinitions, 0);
  assert(d.limits.includes("not a strategy") && d.limits.includes("not cointegration"));
}
export async function loadMinutes(root: string, symbol: string, cutoff: number, repair?: string,
  historicalFile: string | null = `data/${symbol}_1_full.json`) {
  const map = new Map<number, Candle>(); let duplicates = 0, revisions = 0, excludedUnclosed = 0;
  const add = (r: R) => {
    const ts = Number(r.timestamp ?? r.ts);
    assert(Number.isSafeInteger(ts) && ts >= 0 && ts % MINUTE === 0, "Invalid candle clock");
    if (ts + MINUTE > cutoff) { excludedUnclosed++; return; }
    const c: Candle = { ts, endTs: ts + MINUTE, open: Number(r.open ?? r.o), high: Number(r.high ?? r.h),
      low: Number(r.low ?? r.l), close: Number(r.close ?? r.c), volume: Number(r.volume ?? r.v), turnover: Number(r.turnover ?? r.t) };
    assert(Object.values(c).every(Number.isFinite) && Math.min(c.open, c.high, c.low, c.close) > 0
      && c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close) && c.volume >= 0 && c.turnover >= 0, `Invalid OHLCV: ${symbol}/${ts}`);
    const prev = map.get(ts); if (prev) { duplicates++; if (JSON.stringify(prev) !== JSON.stringify(c)) revisions++; }
    map.set(ts, c);
  };
  // Explicit collector-only mode for assets such as SOL. Missing default archives
  // still fail; do not silently pretend a nonexistent historical file was loaded.
  if (historicalFile !== null) {
    const historical = JSON.parse(fs.readFileSync(inside(root, historicalFile), "utf8"));
    assert(Array.isArray(historical)); for (const c of historical) add(c);
  }
  const stream = readline.createInterface({ input: fs.createReadStream(inside(root, `data/${symbol}_1m.jsonl`)), crlfDelay: Infinity });
  for await (const line of stream) if (line.trim()) add(JSON.parse(line));
  const raw = [...map.values()].sort((a, b) => a.ts - b.ts);
  const gaps: R[] = [];
  for (let i = 1; i < raw.length; i++) if (raw[i].ts !== raw[i - 1].endTs) gaps.push({ start: raw[i - 1].endTs, end: raw[i].ts, minutes: (raw[i].ts - raw[i - 1].endTs) / MINUTE });
  const candles = repair ? applyCandleRepair(raw, readCandleRepair(inside(root, repair)), symbol, cutoff) : raw;
  return { candles, audit: { symbol, first: raw[0]?.ts, lastClosedEnd: raw.at(-1)?.endTs, rows: raw.length, duplicates,
    revisions, excludedUnclosed, gaps, repairsApplied: candles.length - raw.length, historicalFile,
    precedence: "historical then collector last-row-wins, matches canonical loader; corrected history, not original arrival" } };
}
export function hours(cs: Candle[], start: number) {
  return ClosedBarSeries.fromHistorical(cs.filter(c => c.ts >= start).map(c => ({ timestamp: c.ts, ...c })),
    { sourceIntervalMs: MINUTE, targetIntervalMs: HOUR, publicationLagMs: 0 }).bars.map(b => ({ end: b.barEnd, close: b.candle.close }));
}
export function futureOutcome(cs: Map<number, Candle>, at: number, horizon: number, cutoff: number): R {
  const first = cs.get(at), end = at + horizon * HOUR;
  if (end > cutoff) return { ready: false, reason: "right_censored" };
  if (!first) return { ready: false, reason: "missing_entry_minute" };
  let low = first.open, high = first.open, last: Candle | undefined;
  for (let ts = at; ts < end; ts += MINUTE) {
    const c = cs.get(ts); if (!c) return { ready: false, reason: "outcome_gap" };
    low = Math.min(low, c.low); high = Math.max(high, c.high); last = c;
  }
  return { ready: true, entryAt: at, entry: first.open, end, returnPct: (last!.close / first.open - 1) * 100,
    adversePct: (low / first.open - 1) * 100, favorablePct: (high / first.open - 1) * 100 };
}
function bucket(f: Features): string {
  if (!f.ready || !f.persistence.ready || f.persistence.deviationZ === null) return "unknown";
  if (f.persistence.deviationZ >= 0) return "not_below_trend";
  return f.persistence.halfLifeHours! <= 4 ? "below_fast_le4h" : f.persistence.halfLifeHours! <= 8 ? "below_mid4to8h" : "below_slow_gt8h";
}
function gridSummary(rows: R[]): R {
  const done = rows.filter(x => x.outcome.ready), avg = (k: string) => done.length ? done.reduce((s, x) => s + x.outcome[k], 0) / done.length : null;
  return { n: rows.length, completed: done.length, censoredOrMissing: rows.length - done.length,
    positive: done.filter(x => x.outcome.returnPct > 0).length, negative: done.filter(x => x.outcome.returnPct < 0).length,
    meanReturnPct: avg("returnPct"), meanAdversePct: avg("adversePct"), meanFavorablePct: avg("favorablePct"),
    dropAtLeast2Pct: done.filter(x => x.outcome.adversePct <= -2).length };
}
function group<T>(rows: T[], value: (r: T) => string, summary: (xs: T[]) => R) {
  const keys = [...new Set(rows.map(value))].sort();
  return Object.fromEntries(keys.map(k => [k, summary(rows.filter(x => value(x) === k))]));
}
function cuts(rows: R[], summarizeRows: (rs: R[]) => R): R {
  return { baseline: summarizeRows(rows), relative: group(rows, x => String(x.features.relativeWeak), summarizeRows),
    raw: group(rows, x => String(x.features.rawWeak), summarizeRows),
    incrementalCells: group(rows, x => `raw=${x.features.rawWeak}/relative=${x.features.relativeWeak}`, summarizeRows),
    persistence: group(rows, x => bucket(x.features), summarizeRows),
    byMonth: group(rows, x => x.iso.slice(0, 7), xs => ({ baseline: summarizeRows(xs),
      relative: group(xs, x => String(x.features.relativeWeak), summarizeRows), persistence: group(xs, x => bucket(x.features), summarizeRows) })) };
}
export async function runRelativeStudy(root: string, plan: Plan, out: string): Promise<void> {
  const d = plan.card.definition; validateDefinition(d);
  const start = Date.parse(d.start), cutoff = Date.parse(d.cutoff);
  for (const file of [`data/${d.asset}_1_full.json`, `data/${d.asset}_1m.jsonl`, `data/${d.market}_1_full.json`,
    `data/${d.market}_1m.jsonl`, d.repair, d.landmarks, d.acceptedResults]) assert(plan.card.inputs.includes(file), `Unpinned dependency: ${file}`);
  for (const artifact of [d.landmarks, d.acceptedResults]) {
    const dir = path.posix.dirname(artifact); let certified = false;
    for (const name of ["validation.json", "verification.json"]) {
      const file = `${dir}/${name}`; assert(plan.card.inputs.includes(file));
      const v = JSON.parse(fs.readFileSync(inside(root, file), "utf8")); assert.equal(v.passed, true, file);
      const p = v.artifacts?.find((x: R) => x.file === path.posix.basename(artifact));
      if (p) {
        assert.equal(await fileHash(inside(root, artifact)), p.sha256, `Changed parent artifact: ${artifact}`);
        certified = true;
      }
    }
    assert(certified, `Uncertified parent artifact: ${artifact}`);
  }
  console.log("[RR01] loading exact closed-minute archives and verified HYPE repair");
  const asset = await loadMinutes(root, d.asset, cutoff, d.repair), market = await loadMinutes(root, d.market, cutoff);
  assert(asset.candles.at(-1)!.endTs >= cutoff && market.candles.at(-1)!.endTs >= cutoff, "Cutoff not reached by both inputs");
  const seed = Math.floor(start / HOUR) * HOUR - (d.trainingHours + 8) * HOUR;
  const tape = new RelativeTape(hours(asset.candles, seed), hours(market.candles, seed));
  const prices = new Map(asset.candles.filter(c => c.ts >= seed).map(c => [c.ts, c]));
  const featureRows: R[] = [], grid: R[] = [], landmarks: R[] = [];
  const archived: R[] = JSON.parse(fs.readFileSync(inside(root, d.landmarks), "utf8"));
  const primary = archived.filter(x => x.model.startsWith("hl_extended-") && x.threshold === d.landmarkThreshold
    && x.landmarkMinutes === d.landmarkMinutes && x.at >= start && x.at <= cutoff);
  assert(primary.length > 0);
  console.log(`[RR01] fixed 4h grid and ${primary.length} archived primary pressure landmarks (two model paths, not independent)`);
  for (const lag of d.publicationLagsMs) {
    const opts = { trainingHours: d.trainingHours, minimumPairs: d.minimumPairs, publicationLagMs: lag };
    for (let at = Math.ceil(start / (d.gridHours * HOUR)) * d.gridHours * HOUR; at <= cutoff; at += d.gridHours * HOUR) {
      const features = tape.feature(at, opts), row = { at, iso: new Date(at).toISOString(), lag, features };
      featureRows.push({ kind: "grid", ...row }); grid.push({ ...row, outcome: futureOutcome(prices, at, d.outcomeHours, cutoff) });
    }
    for (const x of primary) {
      const features = tape.feature(x.at, opts);
      const row = { key: x.key, model: x.model, at: x.at, iso: x.iso, lag, features,
        outcome: x.outcome, remainingValueChange: x.remainingValueChange, netEpisodeMark: x.netEpisodeMark,
        existingWeakVwapRoc: x.warnings[String(lag)]?.D2 ?? null };
      featureRows.push({ kind: "landmark", key: x.key, at: x.at, lag, features }); landmarks.push(row);
    }
  }
  const report: R = { mode: "descriptive_only", newTradingDefinitions: 0, fees: "No new economics. Archived baseline retains 0.055% each side.",
    window: { start: d.start, cutoff: d.cutoff }, limitations: d.limits, data: [asset.audit, market.audit],
    grid: group(grid, x => String(x.lag), xs => cuts(xs, gridSummary)),
    landmarks: group(landmarks, x => `${x.model}/lag${x.lag}`, xs => ({ ...cuts(xs, summarize),
      vwapRocCells: group(xs, x => `existingWeak=${x.existingWeakVwapRoc}/relative=${x.features.relativeWeak}`, summarize) })),
    currentFeatures: d.publicationLagsMs.map((lag: number) => ({ lag, features: tape.feature(cutoff,
      { trainingHours: d.trainingHours, minimumPairs: d.minimumPairs, publicationLagMs: lag }) })),
    attrition: { grid: group(grid, x => x.features.ready ? "ready" : x.features.reasons.join(","), gridSummary),
      persistence: group(grid, x => x.features.persistence.reason ?? "ready", gridSummary) } };
  // Import, do not pretend to rerun or advance the cutoff of accepted economics.
  const accepted: R[] = JSON.parse(fs.readFileSync(inside(root, d.acceptedResults), "utf8"));
  report.acceptedScorecard = accepted.filter(x => ["baseline", "age8", "minus_soft_stale"].includes(x.policy.id)
    && x.sensitivity.id === "primary").map(x => ({ model: x.model, policy: x.policy.id, start: x.start, end: x.end, digest: x.digest,
      importedNotRerun: true, net: x.metrics.totalPnl, wins: x.metrics.profitableEpisodes, losses: x.metrics.losingEpisodes,
      winningDollars: x.metrics.grossWin, losingDollars: -x.metrics.grossLoss, openPnl: x.metrics.openPnl,
      maxDrawdownPct: x.metrics.maxDrawdownPct, monthly: x.metrics.monthly }));
  assert.equal(report.acceptedScorecard.length, 12);
  for (const row of featureRows) {
    assert(row.features.sourceAvailableAt <= row.at && row.features.trainingEnd < row.features.sourceEnd);
    assert(row.features.sourceEnd - row.features.trainingEnd === 4 * HOUR);
  }
  const json = (name: string, value: unknown) => atomicJson(path.join(out, name), value);
  json("coverage.json", report.data); json("summary.json", report); json("landmarks.json", landmarks);
  // Separate file: downstream feature consumers cannot accidentally read outcome labels.
  fs.writeFileSync(path.join(out, "features.jsonl"), featureRows.map(x => JSON.stringify(x)).join("\n") + "\n");
  fs.writeFileSync(path.join(out, "grid-outcomes.jsonl"), grid.map(({ features: _, ...x }) => JSON.stringify(x)).join("\n") + "\n");
  json("validation.json", { passed: true, kind: "feature_and_join_checks_not_economic_parity", featureRows: featureRows.length,
    gridRows: grid.length, landmarkRows: landmarks.length, sourceClockChecks: featureRows.length, newTradingDefinitions: 0,
    acceptedEconomicsRerun: false, liveChanges: 0 });
  console.log(`[RR01] ${grid.length} grid rows / ${landmarks.length} landmark rows written; no strategy PnL estimated`);
}
