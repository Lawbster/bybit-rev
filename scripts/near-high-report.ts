/** Render L11 economic tables to stdout; never writes strategy or runtime files. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory } from "./research-workflow";
const dir = jobDirectory(path.resolve(__dirname, ".."), process.argv[2]), out = path.join(dir, "output");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
assert(JSON.parse(fs.readFileSync(path.join(dir, "verification.json"), "utf8")).passed);
const results: any[] = read("results.json"), comparisons: any[] = read("comparisons.json");
const dollar = (x: number) => (Math.round(x) || 0).toLocaleString("en-US"), pct = (x: number) => x.toFixed(2);
const models = [...new Set(results.map(x => x.model))];
console.log("## Complete primary comparisons\n\nW/L counts completed episodes, with any S/R partial profits included in the episode. Win$/Loss$ are completed winning/losing episode sums, not gross-before-fee trades. Net also includes the remaining open mark and any partial PnL in an unfinished episode. DD is marked drawdown. No account-equity percentage uplift is implied.\n");
for (const model of models) {
  const b = results.find(x => x.model === model && x.policy === "baseline" && (x.window === "published_window" || x.phase === "primary"))!;
  const vs = results.filter(x => x.model === model && x.policy !== "baseline" && x.phase === "primary").sort((a, b) => b.metrics.totalPnl - a.metrics.totalPnl);
  console.log(`### ${model}\n\n${b.start} through ${b.end}.\n`);
  console.log("| Rule | W/L | Win$ | Loss$ | Open$ | Unfinished partial$ | Net$ | Delta$ | DD% | Affected episodes |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const x of [b, ...vs]) {
    const m = x.metrics;
    console.log(`| ${x.policy} | ${m.profitableEpisodes}/${m.losingEpisodes} | ${dollar(m.grossWin)} | ${dollar(-m.grossLoss)} | ${dollar(m.openPnl)} | ${dollar(m.unfinishedPartialPnl)} | ${dollar(m.totalPnl)} | ${dollar(m.totalPnl - b.metrics.totalPnl)} | ${pct(m.maxDrawdownPct)} | ${x.interventions} |`);
  }
  for (const action of ["block", "exit"]) {
    const subset = vs.filter(x => x.policy.startsWith(action));
    console.log(`\nMonthly MTM: ${action}. Baseline is actual dollars; rule columns are DELTAS, including open mark changes.\n`);
    console.log("| Month | Baseline$ | " + subset.map(x => `${x.policy} delta$`).join(" | ") + " |\n|---|---:|" + subset.map(() => "---:").join("|") + "|");
    for (const m of b.metrics.monthly) console.log(`| ${m.month} | ${dollar(m.mtmPnl)} | ` + subset.map(x => dollar(x.metrics.monthly.find((v: any) => v.month === m.month).mtmPnl - m.mtmPnl)).join(" | ") + " |");
  }
  console.log("\nInvisible upside / loss trade-off. Negative Win$ change means winning dollars sacrificed. Positive losses avoided means less losing dollars. Forced counts include the new research exits, not just hard flattens.\n");
  console.log("| Rule | Win$ change | Loss$ avoided | TP cycle delta | Forced close delta | Fees$ | Baseline fees$ | Worst month delta$ |\n|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const x of vs) {
    const c = comparisons.find(y => y.name === x.name).delta;
    console.log(`| ${x.policy} | ${dollar(c.grossWinDelta)} | ${dollar(-c.grossLossDelta)} | ${c.tpCycleDelta} | ${c.forcedCloseDelta} | ${dollar(x.accounting.modeledFees)} | ${dollar(b.accounting.modeledFees)} | ${dollar(c.worstMonthDelta)} |`);
  }
}
console.log("\n## Source-delay sensitivity (recent window)\n\nRolling-high availability delayed 60 seconds; current closed price still observed. Same economic window, starting capital, fees and TP model.\n\n| Model | Rule | Baseline net$ | Primary net$ | Source60 net$ | Baseline DD% | Primary DD% | Source60 DD% |\n|---|---|---:|---:|---:|---:|---:|---:|");
for (const x of results.filter(x => x.phase === "source60")) {
  const p = results.find(y => y.model === x.model && y.policy === x.policy && y.phase === "primary")!;
  const b = results.find(y => y.model === x.model && y.policy === "baseline" && y.phase === "primary")!;
  console.log(`| ${x.model} | ${x.policy} | ${dollar(b.metrics.totalPnl)} | ${dollar(p.metrics.totalPnl)} | ${dollar(x.metrics.totalPnl)} | ${pct(b.metrics.maxDrawdownPct)} | ${pct(p.metrics.maxDrawdownPct)} | ${pct(x.metrics.maxDrawdownPct)} |`);
}
console.log("\n## Primary qualification\n\n| Rule | Pass | Failed dimensions |\n|---|---|---|");
for (const r of read("ranking.json")) console.log(`| ${r.policy} | ${r.passesPrimaryScreen} | ${[...new Set(r.failures.map((x: string) => x.split(":").at(-1)))].join(", ")} |`);
