/** Generate detailed tables from verified saved results; never invokes a replay. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-distress-exit-2026-09-09");
const read = (f: string) => JSON.parse(fs.readFileSync(`${out}/${f}`, "utf8"));
assert(read("verification.json").passed);
const rows = read("results.json"), comparisons = read("comparisons.json"), ranking = read("ranking.json"), verification = read("verification.json");
const num = (n: number, decimals = 0) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const money = (n: number) => `${Math.round(n) < 0 ? "−" : ""}$${num(Math.abs(n))}`;
const signed = (n: number) => `${Math.round(n) >= 0 ? "+" : "−"}$${num(Math.abs(n))}`;
const table = (headers: string[], cells: any[][]) => ["| " + headers.join(" | ") + " |", "|" + headers.map(() => "---").join("|") + "|",
  ...cells.map(r => "| " + r.join(" | ") + " |")].join("\n");
const policies = ["baseline", "blind_half", "blind_full", "mfi_half", "mfi_full"];
const labels: Record<string, string> = { baseline: "Current B17", blind_half: "Unfiltered half", blind_full: "Unfiltered full", mfi_half: "MFI half", mfi_full: "MFI full" };
const models = ["hl_extended-resting_touch", "hl_extended-close_confirmed", "published_window-resting_touch", "published_window-close_confirmed"];
const primary = (model: string, policy: string) => rows.find((r: any) => r.model === model && r.policy.id === policy && r.sensitivity.id === "primary");
const comp = (r: any) => comparisons.find((c: any) => c.name === r.name);
let text = "# F02 MFI distress exits: verified full comparison tables\n\n";
text += "Research only; current B17 baseline, $32,000 initial capital, unchanged ordinary ladder. Prices/costs are modeled, not actual live wallet returns.\n\n";
text += "Recent: **May17,2026 20:43–Sep8,2026 17:47 UTC**. Published: **Jul1,2025–Aug19,2026 21:32 UTC**. Overlapping paths, never pooled.\n\n";
text += "First depth>=9 at gross−3%, then one checkpoint +60m while same episode remains depth>=9. No requirement to still be below−3%. MFI is completed30m MFI14<=20. Half exits pro rata, block later episode adds; full exits use existing forced cooldown. Ordinary exits have priority.\n\n";
for (const model of models) {
  const rs = policies.map(p => primary(model, p));
  text += `## ${model}\n\n`;
  text += table(["Setup", "W / L", "Winning $", "Losing $", "Net incl. open", "Δ baseline", "DD", "TP cycles", "Forced closes", "Extra exits"], rs.map(r => {
    const m = r.metrics;
    return [labels[r.policy.id], `${m.profitableEpisodes} / ${m.losingEpisodes}`, money(m.grossWin), money(-m.grossLoss), money(m.totalPnl),
      r.policy.id === "baseline" ? "—" : signed(comp(r).delta.pnlDelta), num(m.maxDrawdownPct, 2) + "%", m.tpCycles, m.forcedCloses, r.audit.executed];
  })) + "\n\n";
  text += "W/L is completed episode PnL **including its partials**; zero-PnL episodes are neither. Winning−losing dollars plus unfinished partials and final open mark reconcile to total. Experimental full exits count as forced closes even if they avoid a later hard flatten.\n\n";
  text += table(["Setup", "Realized", "Final open mark", "Unfinished partials", "Modeled fees", "Minimum equity"], rs.map(r => [labels[r.policy.id], money(r.metrics.realized), money(r.metrics.openPnl), money(r.metrics.unfinishedPartialPnl), money(r.accounting.modeledFees), money(r.metrics.minEquity)])) + "\n\n";
  text += "### Monthly MTM (net, then delta against the same baseline)\n\n";
  text += table(["Month", ...policies.map(p => labels[p])], rs[0].metrics.monthly.map((m: any) => [m.month, ...rs.map(r => {
    const v = r.metrics.monthly.find((x: any) => x.month === m.month).mtmPnl;
    return r.policy.id === "baseline" ? money(v) : `${money(v)} (${signed(v - m.mtmPnl)})`;
  })])) + "\n\n";
  text += "### Monthly completed-episode wins/losses and dollars\n\n";
  text += "Episode dollars are assigned to the final close month, whereas MTM includes open exposure and partial cash when it occurred. They are different ledgers, not contradictory totals.\n\n";
  text += table(["Month", "Setup", "W / L", "Winning $", "Losing $"], rs[0].accounting.monthly.flatMap((m: any) => rs.map(r => {
    const v = r.accounting.monthly.find((x: any) => x.month === m.month);
    return [m.month, labels[r.policy.id], `${v.wins} / ${v.losses}`, money(v.winDollars), money(v.lossDollars)];
  }))) + "\n\n";
}
text += "## Changed-path attribution: visible losses and invisible replacement trades\n\n";
text += "Identity is matched **entry timestamp**, not rung number or retrospective nearest trade. The decomposition is matched PnL change − removed baseline net + replacement net + open/unfinished change. It is accounting attribution, not proof that one event independently caused all later differences.\n\n";
text += table(["Model", "Setup", "Matched Δ", "Removed N / net", "Replacement N / net", "Open/unfinished Δ", "Total Δ", "Δ versus equal blind exit"],
  models.flatMap(model => policies.slice(1).map(p => { const r = primary(model, p), c = comp(r), a = c.attribution;
    return [model, labels[p], signed(a.matchedDelta), `${a.removed} / ${money(a.removedNet)}`, `${a.replacement} / ${money(a.replacementNet)}`,
      signed(a.openAndUnfinishedDelta), signed(c.delta.pnlDelta), c.versusBlindNetDelta === null ? "—" : signed(c.versusBlindNetDelta)];
  }))) + "\n\n";
text += "## Delay and extra-cost sensitivity\n\n";
text += "Same B17 control for each model; additional lag changes only experimental source availability/order execution. Blind source lag is identical to primary. 5bps stress is fixed-path extra entry+exit costs, not an affordability rerun.\n\n";
text += table(["Model", "Setup", "Sensitivity", "Baseline net", "Variant net", "Δ", "DD", "Extra exits", "Δ with extra5bps/side"],
  rows.filter((r: any) => r.policy.id !== "baseline").map((r: any) => [r.model, labels[r.policy.id], r.sensitivity.id, money(primary(r.model, "baseline").metrics.totalPnl),
    money(r.metrics.totalPnl), signed(comp(r).delta.pnlDelta), num(r.metrics.maxDrawdownPct, 2) + "%", r.audit.executed, signed(comp(r).extra5bpsDelta)])) + "\n\n";
text += "## Checkpoint counts and temporal concentration\n\n";
text += table(["Model", "Setup", "First distress", "Scheduled", "Executed", "Executed after July15", "Reasons for non-action"], models.flatMap(model => policies.map(p => {
  const r = primary(model, p); return [model, labels[p], r.audit.firstDistress, r.audit.scheduled, r.audit.executed, r.audit.afterJuly15,
    Object.entries(r.audit.statusCounts).map(([k, v]) => `${k}=${v}`).join("; ")];
}))) + "\n\n";
text += "## Frozen economic screen\n\n";
text += "Recent net gain >=$1,000 in both TP models; published net nonnegative vs baseline; no DD increase; no individual month worse by more than$250; no modeled insolvency. This screen is not adjusted after seeing the result. Passing still needs out-of-sample/forward evidence.\n\n";
text += table(["Setup", "Pass", "Failures"], ranking.map((r: any) => [labels[r.policy], r.passesEconomicScreen ? "yes" : "no", r.failures.join("; ") || "none"])) + "\n\n";
text += `## Verification and limitations\n\n44 cases; four exact archive digests; ${num(verification.fills)} fills, ${num(verification.independentMinuteMarks)} raw minute marks, ${num(verification.rawMfiChecks)} independent MFI reconstructions, ${num(verification.experimentalFills)} experimental fills across overlapping cases. Protected source/config/state hashes unchanged.\n\n`;
text += "MFI was selected after109 P01 diagnostic bins on already-examined history. No new untouched holdout. Funding settlements, exact maker queue/fill effects, margin liquidation and the real shared account are not modeled. These are two TP assumptions, not guaranteed upper/lower bounds. Do not call gross baseline losing dollars avoidable loss, or assume delayed executions on every live venue are bounded by60seconds. No live configuration change or deployment recommendation is encoded in this report.\n";
fs.writeFileSync(`${out}/tables.md`, text);
console.log(`Wrote ${out}/tables.md`);
