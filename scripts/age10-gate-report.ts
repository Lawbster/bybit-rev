/** Read-only rendering of verified L15 results. Does not run or alter simulations. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory } from "./research-workflow";
import { PARENT, AGGRESSIVE, VARIANTS, type R } from "./age10-gate-policy";
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const dd = (n: number) => n.toFixed(2) + "%";
export const labels: R = { baseline: "B17 current", age8__exit_2d_1pct: "8h safeguarded", tp_age10: "10h safeguarded",
  plus_minus_deep_stress: "8h no funding guard", plus_minus_tp_cooldown: "8h no RSI cooldown",
  [AGGRESSIVE]: "8h aggressive", age10__minus_tp_cooldown: "10h no RSI cooldown", age10__minus_deep_stress: "10h no funding guard",
  age10__minus_deep_stress__minus_tp_cooldown: "10h aggressive" };
export const table = (h: string[], r: unknown[][]) => `| ${h.join(" | ")} |\n|${h.map(() => "---").join("|")}|\n${r.map(x => `| ${x.join(" | ")} |`).join("\n")}\n\n`;
export function report(key: string) {
  const dir = jobDirectory(path.resolve(__dirname, ".."), key), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
  assert(JSON.parse(fs.readFileSync(path.join(dir, "verification.json"), "utf8")).passed);
  const all: R[] = read("results.json"), rows = all.filter(x => x.primary), ranks: R[] = read("ranking.json"), attr = read("entry-attribution.json");
  const select = ["baseline", PARENT, AGGRESSIVE, ...VARIANTS.map(v => v.id)];
  const find = (id: string, w: string, tp: string) => { const x = rows.find(x => x.policy === id && x.window === w && x.tp === tp); assert(x); return x; };
  let md = "## Full factorial overview\n\nNet includes ending marked inventory; fees unchanged. Periods overlap and start flat independently.\n\n";
  for (const w of ["hl_extended", "published_window"]) {
    md += `### ${w === "hl_extended" ? "Recent: May 17-Sep 10, 2026" : "Older: Jul 1, 2025-Aug 19, 2026"}\n\n`;
    md += table(["Setup", "Touch net $", "Touch DD", "Confirmed net $", "Confirmed DD"], Object.keys(labels).map(id => {
      const a = find(id, w, "resting_touch").metrics, b = find(id, w, "close_confirmed").metrics;
      return [labels[id], money(a.totalPnl), dd(a.maxDrawdownPct), money(b.totalPnl), dd(b.maxDrawdownPct)];
    }));
  }
  md += "## Complete ladder W/L dollars\n\nOne W/L is a flat-to-flat ladder including partials and fees. Open + unfinished includes marked inventory and partial cash from an unclosed episode.\n\n";
  for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
    md += `### ${w} / ${tp}\n\n`;
    md += table(["Setup", "W/L", "Winning $", "Losing $", "Completed net $", "Open + unfinished $", "Total net $", "TP / other full"], select.map(id => {
      const m = find(id, w, tp).metrics;
      return [labels[id], `${m.profitableEpisodes}/${m.losingEpisodes}`, money(m.grossWin), money(-m.grossLoss), money(m.grossWin - m.grossLoss),
        money(m.openPnl + m.unfinishedPartialPnl), money(m.totalPnl), `${m.tpCycles}/${m.forcedCloses}`];
    }));
  }
  md += "## Monthly MTM: baseline absolute net, others delta vs B17\n\nPartial first/last months are not complete calendar months. G=guarded10h, A=aggressive8h; N1=10h no RSI cooldown, N2=10h no funding guard, N3=aggressive10h.\n\n";
  for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
    const b = find("baseline", w, tp);
    md += `### ${w} / ${tp}\n\n` + table(["Month", "B17 net $", "G delta $", "A delta $", "N1 delta $", "N2 delta $", "N3 delta $"], b.metrics.monthly.map((m: R) =>
      [m.month, money(m.mtmPnl), ...select.slice(1).map(id => money(find(id, w, tp).metrics.monthly.find((n: R) => n.month === m.month).mtmPnl - m.mtmPnl))]));
  }
  md += "## Monthly losing dollars: baseline and candidates\n\nNegative numbers are the sum of losing completed ladders assigned to close month, not monthly net or drawdown.\n\n";
  for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
    const b = find("baseline", w, tp);
    md += `### ${w} / ${tp}\n\n` + table(["Month", "B17 losses $", "G losses $", "A losses $", "N1 losses $", "N2 losses $", "N3 losses $"], b.accounting.monthly.map((m: R) =>
      [m.month, ...select.map(id => money(find(id, w, tp).accounting.monthly.find((n: R) => n.month === m.month).lossDollars))]));
  }
  md += "## Screening and non-additive interactions\n\n" + table(["New setup", "Recent minimum-model uplift $", "Aggregate net/DD better all four", "Complete screen", "Failures"], ranks.map(r =>
    [labels[r.policy], money(r.minRecentNetDelta), r.aggregateBaselineAllFour, r.passesScreen, r.failures.join(", ")]));
  md += "Age benefit below is 10h minus the corresponding 8h cell; interaction = both - deep-only - RSI-only + safeguarded. These are historical accounting contrasts, not significance tests.\n\n";
  md += table(["Case", "Age gain guarded $", "Age gain no funding $", "Age gain no RSI $", "Age gain aggressive $", "8h guard interaction $", "10h guard interaction $"], attr.factorial.map((x: R) =>
    [x.model, ...[x.ageBenefit.guarded, x.ageBenefit.deepOnly, x.ageBenefit.hotOnly, x.ageBenefit.both, x.age8.interaction, x.age10.interaction].map(money)]));
  md += "## Entry-path attribution versus same-age safeguarded control\n\nSame-entry ladders can have different later rungs. Removed and replacement sets are completed-episode classifications. Do not sum an extra rung's associated whole-episode PnL as its marginal benefit.\n\n";
  const comparisons = attr.analyses.filter((x: R) => x.peer === (x.policy === AGGRESSIVE ? "age8__exit_2d_1pct" : PARENT));
  md += table(["Case / setup", "Matched delta $", "Removed peer net $", "Replacement net $", "End delta $", "Total delta $", "Matched / removed / replacement"], comparisons.map((x: R) => {
    const a = x.accounting; return [`${x.model} / ${labels[x.policy]}`, money(a.matchedDelta), money(a.removedNet), money(a.replacementNet), money(a.openAndUnfinishedDelta),
      money(x.delta.pnlDelta), `${a.matched}/${a.removed}/${a.replacement}`];
  }));
  md += "Direct flag means original guard would block this accepted add ON THE OBSERVED PATH, after the support exception. Cohort whole-ladder PnL is association, not causal earnings from the flagged adds. Counts can overlap.\n\n";
  md += table(["Case / setup", "Extra opens", "Deep flagged adds", "Hot cooldown flagged adds", "Flagged cohort W/L", "Cohort winning $", "Cohort losing $"], comparisons.map((x: R) => {
    const a = x.directGateAssociated; return [`${x.model} / ${labels[x.policy]}`, a.extraOpens, a.directDeepAdds, a.directHotAdds, `${a.wins}/${a.losses}`, money(a.winDollars), money(a.lossDollars)];
  }));
  md += "## High-source60 sensitivity\n\nOnly high-reference availability is delayed; this is not market execution latency.\n\n";
  md += table(["Setup", "Model", "Net change $", "DD change pp"], all.filter(x => !x.primary).map(x => { const b = find(x.policy, x.window, x.tp).metrics;
    return [labels[x.policy], x.tp, money(x.metrics.totalPnl - b.totalPnl), (x.metrics.maxDrawdownPct - b.maxDrawdownPct).toFixed(4)]; }));
  return md;
}
if (require.main === module) console.log(report(process.argv[2]));
