/** Post-verification attribution only. Does not run or select trading rules. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory, atomicJson, verifyPins } from "./research-workflow";
type R = Record<string, any>;
const PARENT = "age10__minus_deep_stress__minus_tp_cooldown", sum = (xs: R[], k: string) => xs.reduce((n, x) => n + x[k], 0);
async function main() {
  const root = process.cwd(), dir = jobDirectory(root, process.argv[2]), out = path.join(dir, "output");
  const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(out, f));
  assert(read(path.join(dir, "verification.json")).passed); assert(!fs.existsSync(path.join(dir, "analysis.json")));
  const state = read(path.join(dir, "state.json")); await verifyPins(root, state.artifacts);
  const rows: R[] = load("results.json"), comps: R[] = load("comparisons.json");
  const summary = rows.map(x => { const m = x.metrics, c = comps.find(c => c.name === x.name)!;
    return { name: x.name, window: x.window, tp: x.tp, policy: x.policy, lag: x.lag,
      net: m.totalPnl, realized: m.realized, openPnl: m.openPnl, wins: m.profitableEpisodes, losses: m.losingEpisodes,
      grossWin: m.grossWin, grossLoss: -m.grossLoss, averageLoss: m.losingEpisodes ? -m.grossLoss / m.losingEpisodes : 0,
      dd: m.maxDrawdownPct, tpCycles: m.tpCycles, forcedCloses: m.forcedCloses, minEquity: m.minEquity, maxNotional: m.maxNotional,
      changedEpisodes: x.counts.episodesChanged, coveragePct: x.counts.deep ? x.counts.ready / x.counts.deep * 100 : null,
      fees: x.accounting.modeledFees, extra5bpsNet: x.accounting.fixedPathExtra5bpsNet,
      parentDelta: c.parent.pnlDelta, baselineDelta: c.baseline.pnlDelta, parentDdChange: -c.parent.ddReductionPp,
      worstParentMonth: c.parent.worstMonthDelta, worstBaselineMonth: c.baseline.worstMonthDelta,
      parentAttribution: c.parentAttribution, parentExtraTpCycles: c.parent.tpCycleDelta,
      parentExtraForcedCloses: c.parent.forcedCloseDelta };
  });
  const months = rows.filter(x => !x.lag).flatMap(x => {
    const c = comps.find(c => c.name === x.name)!;
    return x.accounting.monthly.map((m: R) => ({ window: x.window, tp: x.tp, policy: x.policy, ...m,
      averageLoss: m.losses ? m.lossDollars / m.losses : 0, parentDelta: c.parent.monthly.find((v: R) => v.month === m.month).mtmDelta,
      baselineDelta: c.baseline.monthly.find((v: R) => v.month === m.month).mtmDelta }));
  });
  const details: R[] = [], cohorts: R[] = [];
  for (const x of rows.filter(x => x.window === "hl_extended" && !x.lag)) {
    const attempts: R[] = load(`${x.name}-attempts.json`), events: R[] = fs.readFileSync(path.join(out, `${x.name}-inventory.jsonl`), "utf8").trim().split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    const episodeEntry = new Map<number, string>(); for (const e of events) if (e.event.kind === "open" && !episodeEntry.has(e.episode)) episodeEntry.set(e.episode, new Date(e.event.fillAt).toISOString());
    const outcome = (ep: number) => x.metrics.episodes.find((e: R) => e.entry === episodeEntry.get(ep));
    if (x.policy === PARENT) {
      const first = new Map<number, R>();
      for (const a of attempts) if (a.feature?.ready && a.feature.acceleration && !first.has(a.episode)) first.set(a.episode, a);
      for (const response of ["selling_with_impact", "absorption_compatible", "small_decline"]) {
        const as = [...first.values()].filter(a => a.feature.response === response), es = as.map(a => outcome(a.episode)).filter(Boolean);
        cohorts.push({ model: x.model, response, firstAccelerationEpisodes: as.length, completed: es.length,
          open: as.length - es.length, wins: es.filter(e => e.pnl > 0).length, losses: es.filter(e => e.pnl < 0).length,
          episodeNet: sum(es, "pnl"), averageEpisode: es.length ? sum(es, "pnl") / es.length : null,
          interpretation: "Disjoint by FIRST acceleration at eligible deep add on unchanged parent; full episode outcomes are descriptive, not profits saved or predictor validation." });
      }
    }
    if (x.control) continue;
    const parent = rows.find(r => r.control && r.policy === PARENT && r.model === x.model)!;
    const bm = new Map<string, R>(parent.metrics.episodes.map((e: R) => [e.entry, e]));
    const common = x.metrics.episodes.filter((e: R) => bm.has(e.entry)).map((e: R) => ({ entry: e.entry,
      baselineClose: bm.get(e.entry)!.close, variantClose: e.close, baselineReason: bm.get(e.entry)!.reason, variantReason: e.reason,
      baselineNet: bm.get(e.entry)!.pnl, variantNet: e.pnl, delta: e.pnl - bm.get(e.entry)!.pnl }));
    const changed = attempts.filter(a => a.fire), first = changed[0];
    const trace = first ? { ...first, atIso: new Date(first.at).toISOString(), sourceEndIso: new Date(first.feature.end).toISOString(),
      latestAvailableIso: new Date(first.feature.latestAvailable).toISOString(),
      followingOpen: events.find(e => e.event.kind === "open" && e.event.decisionIndex >= first.index)?.event ?? null,
      episodeEntry: episodeEntry.get(first.episode), outcome: outcome(first.episode) ?? null } : null;
    details.push({ name: x.name, counts: x.counts,
      depth: [8, 9, 10, 11].map(depth => { const as = changed.filter(a => a.nextDepth === depth); return { depth, checks: as.length,
        episodes: new Set(as.map(a => a.episode)).size, drop: as.filter(a => a.priceDropOk).length, timer: as.filter(a => !a.priceDropOk).length }; }),
      topGains: [...common].sort((a: R, b: R) => b.delta - a.delta).slice(0, 5), topCosts: [...common].sort((a: R, b: R) => a.delta - b.delta).slice(0, 5), trace });
  }
  const report = { summary, months, details, cohorts, ranking: load("ranking.json"), flowAudit: load("flow-input-audit.json") };
  atomicJson(path.join(dir, "analysis.json"), report);
  console.log(JSON.stringify({ summary, cohorts, flowAudit: report.flowAudit }, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
