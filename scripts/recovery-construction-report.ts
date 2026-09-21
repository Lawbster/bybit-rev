/** Render accepted RR03/L10 results to stdout; does not modify research or live files. */
import fs from "fs";
import path from "path";
import { jobDirectory } from "./research-workflow";
const dir = jobDirectory(path.resolve(__dirname, ".."), process.argv[2]), out = path.join(dir, "output");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
const results: any[] = read("results.json"), comparisons: any[] = read("comparisons.json");
const dollars = (n: number) => Math.round(n).toLocaleString("en-US");
const number = (n: number) => n.toFixed(2);
for (const model of [...new Set(results.map(x => x.model))]) {
  const base = results.find(x => x.model === model && x.policy === "baseline" && (x.window === "published_window" || x.phase === "primary"))!;
  const variants = results.filter(x => x.model === model && x.policy !== "baseline" && x.phase === "primary").sort((a, b) => b.metrics.totalPnl - a.metrics.totalPnl);
  console.log(`\n### ${model}\n\n${base.start} → ${base.end}\n`);
  console.log("| Policy | W / L | Win$ | Loss$ | Open$ | Net$ | Δ net$ | DD% | Intervened episodes |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const x of [base, ...variants]) {
    const m = x.metrics;
    console.log(`| ${x.policy} | ${m.profitableEpisodes} / ${m.losingEpisodes} | ${dollars(m.grossWin)} | ${dollars(-m.grossLoss)} | ${dollars(m.openPnl)} | ${dollars(m.totalPnl)} | ${dollars(m.totalPnl - base.metrics.totalPnl)} | ${number(m.maxDrawdownPct)} | ${x.interventions} |`);
  }
  console.log("\n| Month | Baseline$ | " + variants.map(x => `${x.policy} Δ$`).join(" | ") + " |\n|---|---:|" + variants.map(() => "---:").join("|") + "|");
  for (const m of base.metrics.monthly) console.log(`| ${m.month} | ${dollars(m.mtmPnl)} | ` + variants.map(x => dollars(x.metrics.monthly.find((v: any) => v.month === m.month).mtmPnl - m.mtmPnl)).join(" | ") + " |");
  console.log("\n| Policy | Win$ change | Loss$ avoided | TP cycle Δ | Forced close Δ | Worst monthly Δ$ |\n|---|---:|---:|---:|---:|---:|");
  for (const x of variants) {
    const c = comparisons.find(v => v.name === x.name).delta;
    console.log(`| ${x.policy} | ${dollars(c.grossWinDelta)} | ${dollars(-c.grossLossDelta)} | ${c.tpCycleDelta} | ${c.forcedCloseDelta} | ${dollars(c.worstMonthDelta)} |`);
  }
}
console.log("\n### Sensitivity: 60s source availability\n\n| Model | Policy | Primary net$ | Source60 net$ | Primary DD% | Source60 DD% |\n|---|---|---:|---:|---:|---:|");
for (const x of results.filter(x => x.phase === "source60")) {
  const p = results.find(p => p.model === x.model && p.policy === x.policy && p.phase === "primary")!;
  console.log(`| ${x.model} | ${x.policy} | ${dollars(p.metrics.totalPnl)} | ${dollars(x.metrics.totalPnl)} | ${number(p.metrics.maxDrawdownPct)} | ${number(x.metrics.maxDrawdownPct)} |`);
}
console.log("\n### Qualification\n"); console.log(JSON.stringify(read("ranking.json"), null, 2));
