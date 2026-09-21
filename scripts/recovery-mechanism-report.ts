/** F05 baseline-adjacent W/L, monthly, occupancy and source-availability report. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
import { csv } from "./pressure-point-features";
type R = Record<string, any>;
const money = (v: number) => `${v <= -.5 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const num = (v: number) => v.toFixed(2);
const table = (headers: string[], rows: any[][]) => ["| " + headers.join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |", ...rows.map(r => "| " + r.join(" | ") + " |")].join("\n");
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-recovery-mechanisms-2026-09-10"), get = (f: string) => read(path.join(out, f));
  const v = get("verification.json"), validation = get("validation.json"); assert(v.passed);
  assert.equal(await fileHash(path.join(out, "validation.json")), v.validationHash); assert.equal(await fileHash(path.join(out, "execution-traces.json")), v.traceHash);
  for (const p of validation.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256, p.file);
  const results: R[] = get("results.json"), comparisons: R[] = get("comparisons.json"), traces: R[] = get("execution-traces.json"), ranking: R[] = get("ranking.json");
  const text = ["# F05: event-driven recovery mechanisms and action isolation", "", "124 full-path cases: 28 archived F04 controls, 96 new cases, ten new definitions. No live change.", "",
    "Published: July 1, 2025-August 19, 2026 21:32 UTC. Recent HL: May 17, 2026 20:43-September 8, 2026 17:47 UTC. Independent flat $32k starts, unchanged B17 $800 x1.35/max11, fees 0.055% each side. Overlapping mined windows, not holdouts; TP models not certified live bounds.", ""];
  const allMonthly: R[] = [], opportunity: R[] = [];
  for (const model of [...new Set(results.map(x => x.model))]) {
    const xs = results.filter(x => x.model === model && x.sensitivity.id === "primary"), b = xs.find(x => x.policy.id === "baseline")!;
    text.push(`## ${model}`, "", table(["Setup", "W/L", "Winning $", "Losing $", "Unfinished partial PnL", "Open mark", "Net incl. open", "Delta B17", "DD", "Min equity", "Worst MTM month", "TP/forced", "Signals/cuts"], xs.map(x => [x.policy.id,
      `${x.metrics.profitableEpisodes}/${x.metrics.losingEpisodes}`, money(x.metrics.grossWin), money(-x.metrics.grossLoss), money(x.metrics.unfinishedPartialPnl), money(x.metrics.openPnl), money(x.metrics.totalPnl), money(x.metrics.totalPnl - b.metrics.totalPnl), num(x.metrics.maxDrawdownPct),
      money(x.metrics.minEquity), money(Math.min(...x.metrics.monthly.map((m: R) => m.mtmPnl))),
      `${x.metrics.tpCycles}/${x.metrics.forcedCloses}`, `${x.audit.signals ?? x.audit.scheduled}/${x.audit.executed}`])), "");
    text.push("### Every month: absolute B17 and deltas", "", table(["Month", "B17 MTM", ...xs.filter(x => x.policy.id !== "baseline").map(x => x.policy.id)], b.accounting.monthly.map((m: R) => [m.month, money(m.mtmPnl),
      ...xs.filter(x => x.policy.id !== "baseline").map(x => money(x.accounting.monthly.find((a: R) => a.month === m.month).mtmPnl - m.mtmPnl))])), "");
    for (const x of xs) for (const m of x.accounting.monthly) allMonthly.push({ model, policy: x.policy.id, ...m, deltaB17: m.mtmPnl - b.accounting.monthly.find((a: R) => a.month === m.month).mtmPnl });
    text.push("### Occupancy attribution", "", table(["Setup", "Matched delta", "Removed baseline net", "Replacement net", "Open/unfinished delta", "Changed TP/forced"], xs.filter(x => !x.control).map(x => {
      const c = comparisons.find(c => c.name === x.name)!; return [x.policy.id, money(c.attribution.matchedDelta), money(c.attribution.removedNet), money(c.attribution.replacementNet), money(c.attribution.openAndUnfinishedDelta), `${c.delta.tpCycleDelta}/${c.delta.forcedCloseDelta}`];
    })), "");
    text.push("### Source and execution delay", "", table(["Setup", "Clock", "Net", "Delta same B17", "DD", "Signals/cuts", "Unknown pulse cancellations"], results.filter(x => x.model === model && !x.control).map(x => [x.policy.id, x.sensitivity.id,
      money(x.metrics.totalPnl), money(x.metrics.totalPnl - b.metrics.totalPnl), num(x.metrics.maxDrawdownPct), `${x.audit.signals}/${x.audit.executed}`, x.audit.statusCounts.pulse_unknown ?? 0])), "");
  }
  for (const x of results.filter(x => !x.control)) {
    const obs: R[] = get(`${x.name}-observations.json`), armObs: R[] = x.policy.family === "weekly" ? get(`${x.name}-weekly.json`) : obs;
    const arms = armObs.filter(o => x.policy.family === "weekly" ? o.firstAt != null : o.status === "armed").map(o => ({ at: o.firstAt ?? o.at, depth: o.firstDepth ?? o.depth }));
    const signals = obs.filter(o => o.status === "signal"), months = [...new Set([...obs, ...arms].filter(o => o.at != null).map(o => new Date(o.at).toISOString().slice(0, 7)))];
    for (const month of months) {
      const rows = obs.filter(o => o.at != null && new Date(o.at).toISOString().startsWith(month)), fire = signals.filter(o => new Date(o.at).toISOString().startsWith(month));
      opportunity.push({ model: x.model, policy: x.policy.id, sensitivity: x.sensitivity.id, month,
        armed: arms.filter(o => new Date(o.at).toISOString().startsWith(month)).length, signals: fire.length, knownFlowObservations: rows.filter(o => o.pulse?.flowHealthy).length,
        armedAtDepth11: arms.filter(o => o.depth === 11 && new Date(o.at).toISOString().startsWith(month)).length, signalsAtDepth11: fire.filter(o => o.depth === 11).length,
        unknownPulseCancellations: rows.filter(o => o.reason === "pulse_unknown").length, actualCuts: traces.filter(t => t.name === x.name && t.fill && new Date(t.fill.fillAt).toISOString().startsWith(month)).length });
    }
  }
  const shortlist: R[] = ranking.map((x): R => { const cases = results.filter(r => !r.control && r.policy.id === x.policy && r.sensitivity.id === "primary");
    const ds = cases.map(c => ({ model: c.model, ...comparisons.find(v => v.name === c.name)!.delta }));
    return { ...x, minimumRecentDelta: Math.min(...ds.filter(d => d.model.startsWith("hl_extended")).map(d => d.pnlDelta)), comparisons: ds };
  }).sort((a, b) => b.minimumRecentDelta - a.minimumRecentDelta);
  text.push("## Ranking: minimum net increment across the two recent TP models", "", "This ordering is descriptive, not a new acceptance criterion. All frozen monthly/DD/net requirements remain authoritative. HL older-history absence is not a full-screen pass.", "",
    table(["Setup", "Worst recent increment", "Complete screen", "Failures"], shortlist.map(x => [x.policy, money(x.minimumRecentDelta), x.passesEconomicScreen, x.failures.join("; ") || "none"])), "");
  text.push("## Intervention concentration and actual paths", "", table(["Setup", "Window / model", "Signals", "Distinct UTC dates", "Helpful/harmful matched episodes", "Matched net contribution"], results.filter(x => !x.control && x.sensitivity.id === "primary").map(x => {
    const ts = traces.filter(t => t.name === x.name), known = ts.filter(t => t.matchedEpisodeDelta !== null), dates = new Set(ts.map(t => new Date(t.signal.at).toISOString().slice(0, 10)));
    return [x.policy.id, x.model, ts.length, dates.size, `${known.filter(t => t.matchedEpisodeDelta > 1e-7).length}/${known.filter(t => t.matchedEpisodeDelta < -1e-7).length}`, money(known.reduce((n, t) => n + t.matchedEpisodeDelta, 0))];
  })), "", "These matched signal-episode contributions do not include replaced entry episodes or final inventory; use the full occupancy table for complete economic attribution. Models/windows/sensitivities overlap.", "");
  const concentration = results.filter(x => !x.control && x.sensitivity.id === "primary").map(x => {
    const ts = traces.filter(t => t.name === x.name && t.matchedEpisodeDelta !== null), byDate = new Map<string, number>();
    for (const t of ts) { const day = new Date(t.signal.at).toISOString().slice(0, 10); byDate.set(day, (byDate.get(day) ?? 0) + t.matchedEpisodeDelta); }
    const dates = [...byDate].map(([date, delta]) => ({ date, delta })).sort((a, b) => b.delta - a.delta), delta = comparisons.find(c => c.name === x.name)!.delta.pnlDelta;
    return { name: x.name, netDeltaB17: delta, helpfulMatched: ts.filter(t => t.matchedEpisodeDelta > 0).reduce((n, t) => n + t.matchedEpisodeDelta, 0),
      harmfulMatched: ts.filter(t => t.matchedEpisodeDelta < 0).reduce((n, t) => n + t.matchedEpisodeDelta, 0), dateContributions: dates,
      deltaMinusLargestHelpfulMatchedDate: delta - Math.max(0, dates[0]?.delta ?? 0),
      caveat: "Attribution subtraction only, not a no-event or holdout policy replay. Other occupancy and unfinished contributions remain unchanged." };
  });
  text.push(`## Verification\n\n${v.cases} cases; ${v.controls} exact archived controls; ${v.fills} fills and ${v.minuteMarks} minute marks independently accounted; ${v.rawMfi} raw MFI, ${v.rawPulse} unique raw pulse queries and ${v.prefixSrChecks} closed-prefix S/R checks. All outcomes include recoveries, non-events and censored inventory.`, "",
    "Unknown inputs never prove a profitable veto. This study does not certify maker fees/queues, funding settlements, exact live execution, exchange liquidation or joint long/short margin. Research is not deployment approval.", "");
  const outputs = [{ file: "tables.md", data: text.join("\n") }, { file: "primary-monthly-wl.csv", data: csv(allMonthly) }, { file: "opportunity-monthly.csv", data: csv(opportunity) }, { file: "ranked-summary.json", data: JSON.stringify(shortlist, null, 2) + "\n" },
    { file: "concentration.json", data: JSON.stringify(concentration, null, 2) + "\n" }];
  for (const x of outputs) fs.writeFileSync(path.join(out, x.file), x.data, { flag: "wx" });
  fs.writeFileSync(path.join(out, "report-validation.json"), JSON.stringify({ at: new Date().toISOString(), verificationHash: await fileHash(path.join(out, "verification.json")), reporterHash: await fileHash(__filename),
    artifacts: await Promise.all(outputs.map(async x => ({ file: x.file, sha256: await fileHash(path.join(out, x.file)) }))) }, null, 2) + "\n", { flag: "wx" });
  console.log({ report: out, monthlyRows: allMonthly.length, opportunityRows: opportunity.length });
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
