/** Reporting only: reconstruct monthly drawdown from accepted FR01 fills/prices.
 * No strategy rerun, new signal, exchange access or accepted-output mutation.
 */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, verifyPins, atomicJson, fileHash } from "./research-workflow";
import { auditFlowLedger } from "./flow-response-audit";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";

type R = Record<string, any>;
const START_EQUITY = 32000, FEE = .00055;
const PARENT = "age10__minus_deep_stress__minus_tp_cooldown";
const near = (a: number, b: number) => assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6, `${a} != ${b}`);

class Drawdown {
  peak: number;
  min: number;
  maxPct = 0;
  constructor(equity: number) { this.peak = this.min = equity; }
  mark(equity: number) {
    this.peak = Math.max(this.peak, equity); this.min = Math.min(this.min, equity);
    this.maxPct = Math.max(this.maxPct, (this.peak - equity) / this.peak * 100);
    return (this.peak - equity) / this.peak * 100;
  }
}

function checkFixtures() {
  const overall = new Drawdown(100), may = new Drawdown(100);
  for (const e of [120, 90]) { overall.mark(e); may.mark(e); }
  near(may.maxPct, 25);
  const june = new Drawdown(90);
  for (const e of [95, 85]) { overall.mark(e); june.mark(e); }
  near(june.maxPct, 1000 / 95); near(overall.maxPct, 3500 / 120);
  const flat = new Drawdown(100); for (const e of [100, 100]) flat.mark(e); near(flat.maxPct, 0);
}

function reconstruct(cs: Candle[], events: ResearchInventoryEvent[], row: R) {
  let inv: R[] = [], pointer = 0, realized = 0, lastEquity = START_EQUITY;
  const overall = new Drawdown(START_EQUITY), months = new Map<string, R>();
  const mark = (price: number) => inv.reduce((n, p) => n + p.qty * (price - p.entryPrice) - FEE * p.qty * (price + p.entryPrice), 0);
  function fill(x: ResearchInventoryEvent) {
    assert.deepEqual(x.before, inv);
    if (x.event.kind !== "open") {
      for (const p of inv) {
        const q = p.qty - (x.after.find(v => v.id === p.id)?.qty ?? 0);
        assert(q >= -1e-10);
        realized += q * (x.event.price! - p.entryPrice) - FEE * q * (x.event.price! + p.entryPrice);
      }
    }
    inv = [...x.after];
  }
  for (let i = row.startIdx; i < row.endIdx; i++) {
    const c = cs[i], month = new Date(c.endTs).toISOString().slice(0, 7);
    if (i > row.startIdx) assert.equal(c.ts, cs[i - 1].endTs, "Missing price minute");
    if (!months.has(month)) months.set(month, {
      month, startEquity: lastEquity, startRealized: realized,
      tracker: new Drawdown(lastEquity), maxDrawdownFromRunPeakPct: 0,
    });
    const m = months.get(month)!;
    const record = (price: number) => {
      const equity = START_EQUITY + realized + mark(price);
      m.maxDrawdownFromRunPeakPct = Math.max(m.maxDrawdownFromRunPeakPct, overall.mark(equity));
      m.tracker.mark(equity); return equity;
    };
    while (events[pointer]?.event.fillIndex === i && events[pointer].event.fillAt === c.ts) fill(events[pointer++]);
    // Same conservative minute ordering as the accepted independent ledger:
    // next-open fills, low mark, resting TP fills, close mark (no invented high peaks).
    record(c.low);
    while (events[pointer]?.event.fillIndex === i) fill(events[pointer++]);
    lastEquity = record(c.close); m.endEquity = lastEquity; m.endRealized = realized;
  }
  assert.equal(pointer, events.length);
  near(realized, row.metrics.realized); near(mark(cs[row.endIdx - 1].close), row.metrics.openPnl);
  near(overall.min, row.metrics.minEquity); near(overall.maxPct, row.metrics.maxDrawdownPct);
  near(lastEquity - START_EQUITY, row.metrics.totalPnl);
  const monthly = row.accounting.monthly.map((original: R) => {
    const m = months.get(original.month); assert(m);
    near(m.endEquity, original.endEquity);
    near(m.endEquity - m.startEquity, original.mtmPnl);
    near(m.endRealized - m.startRealized, original.realizedPnl);
    return { ...original, startEquity: m.startEquity, monthlyDrawdownPct: m.tracker.maxPct,
      maxDrawdownFromRunPeakPct: m.maxDrawdownFromRunPeakPct,
      averageLoss: original.losses ? original.lossDollars / original.losses : null };
  });
  assert.equal(monthly.length, months.size);
  return { name: row.name, window: row.window, tp: row.tp, policy: row.policy,
    start: new Date(cs[row.startIdx].ts).toISOString(), end: new Date(cs[row.endIdx - 1].endTs).toISOString(),
    totals: { wins: row.metrics.profitableEpisodes, losses: row.metrics.losingEpisodes,
      winDollars: row.metrics.grossWin, lossDollars: -row.metrics.grossLoss,
      net: row.metrics.totalPnl, dd: overall.maxPct,
      averageLoss: -row.metrics.grossLoss / row.metrics.losingEpisodes,
      worstLoss: row.metrics.worstEpisode, unfinishedPartialPnl: row.metrics.unfinishedPartialPnl, openPnl: row.metrics.openPnl }, monthly };
}

async function main() {
  checkFixtures();
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const target = path.join(dir, "monthly-loss-dd.json");
  assert(!fs.existsSync(target), "Never overwrite a reporting artifact");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
  const plan = read(path.join(dir, "plan.json")), state = read(path.join(dir, "state.json"));
  assert.equal(state.status, "complete"); assert.equal(read(path.join(dir, "verification.json")).passed, true);
  const pins = [...plan.pins, ...plan.protectedPins, ...state.artifacts];
  console.log("Verifying accepted inputs and outputs before monthly reconstruction...");
  await verifyPins(root, pins);
  process.env.SIM_END = plan.card.definition.cutoff;
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  const cs = await loadCandles1m("HYPEUSDT", path.join(root, "data"), Date.parse(plan.card.definition.cutoff), plan.card.definition.repairFile);
  const rows: R[] = read(path.join(out, "results.json"));
  const selected = rows.filter(r => r.window === "hl_extended" && r.lag === 0 && ["baseline", PARENT, "impact_half"].includes(r.policy));
  assert.equal(selected.length, 6);
  const result = [];
  for (const row of selected) {
    const events: ResearchInventoryEvent[] = fs.readFileSync(path.join(out, `${row.name}-inventory.jsonl`), "utf8").trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    const attempts = read(path.join(out, `${row.name}-attempts.json`));
    assert.deepEqual(auditFlowLedger(cs, events, attempts, row.metrics, row.startIdx, row.endIdx), row.accounting);
    result.push(reconstruct(cs, events, row));
    console.log(`Verified monthly and full-period accounting: ${row.name}`);
  }
  await verifyPins(root, pins);
  atomicJson(target, { version: 1, sourceJob: plan.key, createdAt: new Date().toISOString(),
    reporterSha256: await fileHash(__filename), newStrategyRuns: 0, accountingCasesVerified: result.length,
    notes: ["Monthly drawdown uses a running peak reset to the preceding month-end equity, not reset capital or positions.",
      "Also stores within-month drawdown versus the full-run peak to expose drawdowns spanning month boundaries.",
      "Winning/losing completed ladders are assigned to final-close month, including all their partials. MTM net instead measures actual monthly equity change, so columns need not sum.",
      "Fees remain 0.055% per side. No funding, exact maker-fill model or liquidation simulation. May and September are partial months.",
      "DD uses canonical low-before-TP and end-minute equity marks. Both TP sensitivities use identical input periods but different execution assumptions."], rows: result });
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
