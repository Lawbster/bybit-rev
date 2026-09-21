/** Verified L12 tables to stdout only. Reused L11 peers are labelled, not new runs. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory } from "./research-workflow";
type R = Record<string, any>;
const root = path.resolve(__dirname, ".."), dir = jobDirectory(root, process.argv[2]);
const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")), load = (f: string) => read(path.join(dir, "output", f));
const plan = read(path.join(dir, "plan.json")); assert(read(path.join(dir, "verification.json")).passed);
const fresh: R[] = load("results.json"), prior: R[] = read(path.join(root, plan.card.definition.acceptedResults, "output/results.json"));
const rows = [...fresh, ...prior.filter(x => x.policy !== "baseline")], comparisons: R[] = load("comparisons.json");
const n = (v: number) => { assert(Number.isFinite(v), "Missing/nonfinite report dollar field"); return (Math.round(v) || 0).toLocaleString("en-US"); };
const p = (v: number) => { assert(Number.isFinite(v), "Missing/nonfinite report percentage field"); return v.toFixed(2); };
const recent = (tp: string, policy: string) => rows.find(x => x.window === "hl_extended" && x.phase === "primary" && x.tp === tp && x.policy === policy)!;
const base = (x: R) => fresh.find(b => b.policy === "baseline" && b.model === x.model && b.end === x.end)!;
const models = [...new Set(fresh.map(x => x.model))], days = [1, 2, 3, 4, 5, 6, 7, 30];
const cases = fresh.filter(x => x.policy !== "baseline" && x.phase === "primary");
console.log("## Exact baseline and economic conventions\n\nB17, unchanged current-stack replay; $32,000 starting equity, $800 x1.35, max11, existing gates/latch/SR/TP/forced exits. Short overlay excluded. Fees 0.055% per side; no maker uplift, long funding settlement or liquidation certification.\n\nW/L counts completed episodes; Win$/Loss$ include episode fees and S/R partial PnL. Net also includes the unfinished episode's realized partial PnL and open mark. MTM drawdown, not realized-only drawdown. All amounts are dollars, not account-return percentages.\n");
console.log("| Baseline/window/TP model | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | DD% |\n|---|---:|---:|---:|---:|---:|---:|---:|");
for (const b of fresh.filter(x => x.policy === "baseline" && (x.window === "published_window" || x.phase === "primary"))) {
  const m = b.metrics; console.log(`| ${b.model} | ${m.profitableEpisodes}/${m.losingEpisodes} | ${n(m.grossWin)} | ${n(-m.grossLoss)} | ${n(m.openPnl)} | ${n(m.unfinishedPartialPnl)} | ${n(m.totalPnl)} | ${p(m.maxDrawdownPct)} |`);
}
console.log("\nPublished: 2025-07-01 00:00 through 2026-08-19 21:32 UTC. Recent: 2026-05-17 20:43 through 2026-09-10 05:08 UTC. Overlapping researched windows, not independent holdouts. Later September10 copied candles are not included.\n");
console.log("## Recent horizon comparisons\n\nEvery cell is **net$ / max DD%**. Block=otherwise-approved rung8+ adds vetoed near high. BTC=the same block with the fixed BTC-strength exception. Exit=oldest surviving rung>=4h, full exit near high plus unchanged 4–8h cooldown. Raw 1/7/30d block/exit rows are reused from L11; all BTC rows and raw 2–6d rows are new L12 runs.\n");
for (const tp of ["close_confirmed", "resting_touch"]) for (const pct of [1, 2]) {
  const b = recent(tp, "baseline"); console.log(`### ${tp}, within ${pct}% of high\n\nBaseline **$${n(b.metrics.totalPnl)} / ${p(b.metrics.maxDrawdownPct)}% DD**.\n\n| Days | Raw block | BTC exception | Stale exit |\n|---:|---:|---:|---:|`);
  for (const d of days) console.log(`| ${d} | ` + [`block_${d}d_${pct}pct`, `btc_block_${d}d_${pct}pct`, `exit_${d}d_${pct}pct`].map(id => {
    const x = recent(tp, id); assert(x); return `$${n(x.metrics.totalPnl)} / ${p(x.metrics.maxDrawdownPct)}%`;
  }).join(" | ") + " |");
}
console.log("\n## Complete new primary results, baseline-adjacent\n");
for (const model of models) {
  const subset = cases.filter(x => x.model === model).sort((a, b) => b.metrics.totalPnl - a.metrics.totalPnl), b = base(subset[0]);
  console.log(`### ${model}\n\n| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const x of [b, ...subset]) { const m = x.metrics;
    console.log(`| ${x.policy} | ${m.profitableEpisodes}/${m.losingEpisodes} | ${n(m.grossWin)} | ${n(-m.grossLoss)} | ${n(m.openPnl)} | ${n(m.unfinishedPartialPnl)} | ${n(m.totalPnl)} | ${n(m.totalPnl - b.metrics.totalPnl)} | ${p(m.maxDrawdownPct)} | ${x.interventions} |`);
  }
}
const leaders = [...new Set(cases.map(x => x.policy))].map(policy => ({ policy, score: Math.min(...cases.filter(x => x.policy === policy && x.window === "hl_extended").map(x => x.metrics.totalPnl - base(x).metrics.totalPnl)) }))
  .sort((a, b) => b.score - a.score).slice(0, 5).map(x => x.policy);
console.log("\n## Monthly stability: five strongest new results across BOTH recent TP assumptions\n\nDescriptive ranking by the lower recent net uplift, not a new strategy selection or untouched validation. These same five rules are shown in all four economic windows/models. Baseline column is MTM dollars; other columns are deltas. Complete new-rule monthly values are in `output/monthly.csv`; reused raw 1/7/30-day peers retain their original L11 monthly artifacts.\n");
for (const model of models) {
  const xs = leaders.map(policy => cases.find(x => x.model === model && x.policy === policy)!), b = base(xs[0]);
  console.log(`### ${model}\n\n| Month | Baseline$ | ${leaders.join(" delta$ | ")} delta$ |\n|---|---:|${leaders.map(() => "---:").join("|")}|`);
  for (const m of b.metrics.monthly) console.log(`| ${m.month} | ${n(m.mtmPnl)} | ` + xs.map(x => n(x.metrics.monthly.find((v: R) => v.month === m.month).mtmPnl - m.mtmPnl)).join(" | ") + " |");
}
console.log("\n## Attribution and invisible upside: same five new leaders\n\nMatched=episodes with the same initial entry timestamp; removed/replacement are occupied strategy paths lost/gained after intervention. This is path attribution, not paired randomized trades. Final open and unfinished partial changes are separated. Forced counts include research exits, not just hard flattens.\n\n| Model | Rule | Matched delta$ | Removed completed net$ | Replacement completed net$ | Open+unfinished delta$ | Win$ change | Loss$ avoided | TP cycles delta | Forced delta |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const x of cases.filter(x => leaders.includes(x.policy))) {
  const c = comparisons.find(y => y.name === x.name)!, a = c.attribution;
  console.log(`| ${x.model} | ${x.policy} | ${n(a.matchedDelta)} | ${n(a.removedNet)} | ${n(a.replacementNet)} | ${n(a.openAndUnfinishedDelta)} | ${n(c.delta.grossWinDelta)} | ${n(-c.delta.grossLossDelta)} | ${c.delta.tpCycleDelta} | ${c.delta.forcedCloseDelta} |`);
}
console.log("\n## BTC coverage and actual exceptions\n\nKnown context requires the complete contiguous lookback. Unknown is not classified as weak. Check counts are repeated decision opportunities, not independent trades. The raw-veto path in these counts is the gated run's own evolving inventory; dollar benefit versus a separate raw replay is shown explicitly.\n\n| Lookback | Published BTC known% | Recent BTC known% | Recent BTC strong% of all minutes |\n|---:|---:|---:|---:|");
const coverage: R[] = load("btc-source-meta.json").coverage;
for (const d of days) {
  const a = coverage.find(x => x.days === d && x.start.startsWith("2025"))!, b = coverage.find(x => x.days === d && x.start.startsWith("2026"))!;
  console.log(`| ${d}d | ${p(100 * a.ready / a.total)} | ${p(100 * b.ready / b.total)} | ${p(100 * b.strong / b.total)} |`);
}
console.log("\n| Model | Rule | Raw checks | BTC unknown checks | Relaxed checks | Relaxed episodes | Raw net$ | BTC net$ | BTC-minus-raw$ | BTC-minus-baseline$ |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|");
const bc: R[] = load("btc-comparisons.json");
for (const x of cases.filter(x => x.policy.startsWith("btc_"))) {
  const c = bc.find(y => y.name === x.name)!;
  console.log(`| ${x.model} | ${x.policy} | ${x.counts.btcChecks} | ${x.counts.btcUnknown} | ${x.counts.relaxed} | ${x.counts.relaxedEpisodes} | ${n(c.rawNet)} | ${n(x.metrics.totalPnl)} | ${n(c.delta.pnlDelta)} | ${n(x.metrics.totalPnl - base(x).metrics.totalPnl)} |`);
}
console.log("\n## One-minute source delay, all new rules\n\n| Model | Rule | Baseline net$ | Primary net$ | Delayed net$ | Baseline DD% | Primary DD% | Delayed DD% |\n|---|---|---:|---:|---:|---:|---:|---:|");
for (const x of fresh.filter(x => x.phase === "source60")) {
  const b = base(x), primary = cases.find(y => y.policy === x.policy && y.model === x.model)!;
  console.log(`| ${x.model} | ${x.policy} | ${n(b.metrics.totalPnl)} | ${n(primary.metrics.totalPnl)} | ${n(x.metrics.totalPnl)} | ${p(b.metrics.maxDrawdownPct)} | ${p(primary.metrics.maxDrawdownPct)} | ${p(x.metrics.maxDrawdownPct)} |`);
}
console.log("\n## Frozen-screen outcome\n\n| Rule | Pass | Failed dimensions |\n|---|---|---|");
for (const r of load("ranking.json")) console.log(`| ${r.policy} | ${r.passesPrimaryScreen} | ${[...new Set(r.failures.map((x: string) => x.split(":").at(-1)))].join(", ")} |`);
