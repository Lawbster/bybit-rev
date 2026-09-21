/** Tabulate accepted local outputs; never writes research docs or production files. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-ladder-components-2026-09-08");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
assert(read("verification.json").passed);
const results: any[] = read("results.json"), manifest = read("manifest.json"), comparisons: any[] = read("comparisons.json");
const core = results.filter(r => r.window !== "hl_window_latest"), find = (model: string, policy: string) => core.find(r => r.model === model && r.policy === policy)!;
const money = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const num = (n: number) => n.toFixed(2), lines: string[] = [];
const table = (header: string[], rows: (string | number)[][]) => { lines.push(`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`, ...rows.map(r => `| ${r.join(" | ")} |`), ""); };
const models = manifest.spec.windows.flatMap((w: any) => manifest.spec.tpModels.map((tp: string) => `${w.id}-${tp}`));
lines.push("# Exact accepted tables", "");
for (const window of manifest.spec.windows) {
  lines.push(`## Build-up: ${window.id}`, "");
  table(["ID", "Added component", "Touch net", "Touch DD", "Confirmed net", "Confirmed DD"], manifest.policies.cumulative.map((p: any) => {
    const t = find(`${window.id}-resting_touch`, p.id), c = find(`${window.id}-close_confirmed`, p.id);
    return [p.id, p.label, money(t.metrics.totalPnl) + (t.accounting.firstNonpositive ? " *FAILED*" : ""), num(t.metrics.maxDrawdownPct) + "%", money(c.metrics.totalPnl) + (c.accounting.firstNonpositive ? " *FAILED*" : ""), num(c.metrics.maxDrawdownPct) + "%"];
  }));
}
lines.push("## Full-minus-one net deltas vs B17", "");
table(["Removed", ...models], manifest.policies.removals.map((p: any) => [p.component, ...models.map((m: string) => money(find(m, p.policy).metrics.totalPnl - find(m, "B17").metrics.totalPnl))]));
lines.push("## Full-minus-one drawdown changes vs B17 (positive = WORSE)", "");
table(["Removed", ...models], manifest.policies.removals.map((p: any) => [p.component, ...models.map((m: string) => num(find(m, p.policy).metrics.maxDrawdownPct - find(m, "B17").metrics.maxDrawdownPct))]));
for (const model of models) {
  lines.push(`## W/L ${model}`, "");
  const a = ["B00", "B01", "B17"].map(id => find(model, id));
  table(["Metric", "Bare B00", "Bare+drop B01", "Current B17"], [
    ["Wins /losses", ...a.map(r => `${r.metrics.profitableEpisodes} /${r.metrics.losingEpisodes}`)],
    ["Winning dollars", ...a.map(r => money(r.metrics.grossWin))], ["Losing dollars", ...a.map(r => money(-r.metrics.grossLoss))],
    ["Realized", ...a.map(r => money(r.metrics.realized))], ["Open", ...a.map(r => money(r.metrics.openPnl))],
    ["Total", ...a.map(r => money(r.metrics.totalPnl))], ["Max DD", ...a.map(r => num(r.metrics.maxDrawdownPct) + "%")],
    ["Min equity", ...a.map(r => money(r.metrics.minEquity))], ["Longest episode days", ...a.map(r => num(r.accounting.maxHeldHours / 24))],
    ["TP /forced /partial", ...a.map(r => `${r.metrics.tpCycles} /${r.metrics.forcedCloses} /${r.metrics.partials}`)],
    ["Fees incl open mark", ...a.map(r => money(-r.accounting.modeledFees))]
  ]);
}
const ranked = manifest.policies.removals.map((p: any) => ({ ...p, score: Math.min(...models.filter((m: string) => m.startsWith("hl_extended")).map((m: string) => find(m, p.policy).metrics.totalPnl - find(m, "B17").metrics.totalPnl)) })).sort((a: any, b: any) => b.score - a.score);
lines.push("## Top five by smaller recent net delta across TP models (not qualification)", "", ranked.slice(0, 5).map((p: any) => `${p.component}:${money(p.score)}`).join(", "), "");
for (const model of models) {
  const base = find(model, "B17"); lines.push(`## Monthly MTM ${model}`, "");
  table(["Month", "Bare absolute", "Current absolute", ...ranked.slice(0, 5).map((p: any) => `minus_${p.component} delta`)], base.accounting.monthly.map((m: any) => [m.month,
    money(find(model, "B00").accounting.monthly.find((x: any) => x.month === m.month).mtmPnl), money(m.mtmPnl),
    ...ranked.slice(0, 5).map((p: any) => money(find(model, p.policy).accounting.monthly.find((x: any) => x.month === m.month).mtmPnl - m.mtmPnl))]));
}
lines.push("## Screen", "", "```json", JSON.stringify(read("ranking.json"), null, 2), "```", "");
const out = path.join(dir, "tables.md"); assert(!fs.existsSync(out)); fs.writeFileSync(out, lines.join("\n"));
console.log(out);
