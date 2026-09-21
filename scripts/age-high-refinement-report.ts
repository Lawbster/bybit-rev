/** Read-only tables; refuses unverified jobs. No research or production writes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory } from "./research-workflow";
import { PARENT, VARIANTS } from "./age-high-refinement-policy";
type R = Record<string, any>;
const usd = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const pct = (n: number) => n.toFixed(2) + "%";
function table(headers: string[], rows: unknown[][]) {
  return `| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|\n` + rows.map(r => `| ${r.join(" | ")} |`).join("\n") + "\n";
}
const legLabel: R = { last11_50: "half11", minus_deep_stress: "no deep funding guard", minus_sr_partial: "no S/R partial", minus_tp_cooldown: "no hot-RSI cooldown" };
const label = (id: string): string => {
  const fixed = ({ baseline: "B17 current", age8: "8h alone", exit_2d_1pct: "High exit alone", [PARENT]: "Original 8h + high pair",
    minus_sr_partial: "B17 no S/R partial", minus_tp_cooldown: "B17 no hot-RSI cooldown" } as R)[id];
  if (fixed) return fixed;
  if (id.startsWith("plus_")) return "Pair + " + id.slice(5).split("__").map(l => legLabel[l]).join(" + ");
  if (id.startsWith("tp_age")) return `TP cap ${id.slice(6)}h + high`;
  if (id.startsWith("exit_age")) return `Pair: high exit from ${id.slice(8)}h`;
  if (id.startsWith("near_")) return `Pair: high zone ${id.slice(5).replace("pct", "%")}`;
  if (id.startsWith("high_")) return `Pair: ${id.slice(5)} high`;
  return id;
};
export function report(key: string) {
  const root = path.resolve(__dirname, ".."), dir = jobDirectory(root, key), out = path.join(dir, "output");
  const read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8")); assert(read(path.join(dir, "verification.json")).passed);
  const rows: R[] = read(path.join(out, "results.json")), primary = rows.filter(x => x.primary), ranking: R[] = read(path.join(out, "ranking.json")), comps: R[] = read(path.join(out, "comparisons.json"));
  const find = (id: string, w: string, tp: string) => { const r = primary.find(x => x.policy === id && x.window === w && x.tp === tp); assert(r); return r; };
  const top = ranking.slice(0, 5).map(r => r.policy), selected = ["baseline", PARENT, ...top], ordered = ["baseline", PARENT, "age8", "exit_2d_1pct", "minus_sr_partial", "minus_tp_cooldown", ...ranking.map(r => r.policy)];
  const modelLabel = (tp: string) => tp === "resting_touch" ? "resting-touch" : "close-confirmed";
  let md = `## All tested settings: baseline and original pair always shown\n\nRanking: smaller recent uplift across the two TP models; not independent validation. Values are dollars after unchanged modeled fees, including ending inventory.\n\n`;
  for (const w of ["hl_extended", "published_window"]) {
    md += `### ${w === "hl_extended" ? "Recent: May 17-Sep 10, 2026" : "Older: Jul 1, 2025-Aug 19, 2026"}\n\n`;
    md += table(["Setup", "Touch net $", "Touch DD", "Confirmed net $", "Confirmed DD"], ordered.map(id => {
      const a = find(id, w, "resting_touch"), b = find(id, w, "close_confirmed"); return [label(id), usd(a.metrics.totalPnl), pct(a.metrics.maxDrawdownPct), usd(b.metrics.totalPnl), pct(b.metrics.maxDrawdownPct)];
    })) + "\n";
  }
  md += "## Qualification and parent comparison\n\n" + table(["New setup", "Net/DD better than B17 all four?", "Net/DD better than pair all four?", "Complete screen", "Failures"], ranking.map(r => [label(r.policy), r.aggregateBaselineAllFour, r.improvesParentAllFour, r.passesScreen, r.failures.join(", ")])) + "\n";
  md += "Top-five shorthand used in the monthly tables:\n\n" + top.map((id, i) => `- ${String.fromCharCode(65 + i)}: ${label(id)} (\`${id}\`).`).join("\n") + "\n\n";
  md += "## Complete-episode wins and losses: five highest-ranked new definitions\n\nOne W/L is a complete flat-to-flat ladder, including earlier partials and fees. Non-TP full closes include research high exits, some profitable, not just bad flattens.\n\n";
  for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
    md += `### ${w} / ${modelLabel(tp)}\n\n`;
    md += table(["Setup", "W/L", "Win $", "Loss $", "Completed net $", "Open + unfinished $", "Total net $", "DD", "TP / other full"], selected.map(id => {
      const m = find(id, w, tp).metrics; return [label(id), `${m.profitableEpisodes}/${m.losingEpisodes}`, usd(m.grossWin), usd(-m.grossLoss), usd(m.grossWin - m.grossLoss), usd(m.openPnl + m.unfinishedPartialPnl), usd(m.totalPnl), pct(m.maxDrawdownPct), `${m.tpCycles}/${m.forcedCloses}`];
    })) + "\n";
  }
  md += "## Monthly MTM: baseline absolute dollars; every other column is delta vs B17\n\nPartial first/last months are not full months. Older/recent windows overlap, and are different initially-flat paths. Every top-five variant is included, even when it fails.\n\n";
  for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
    const base = find("baseline", w, tp), ids = [PARENT, ...top];
    md += `### ${w} / ${modelLabel(tp)}\n\n`;
    md += table(["Month", "B17 net $", "Pair delta $", ...top.map((_, i) => String.fromCharCode(65 + i) + " delta $")], base.metrics.monthly.map((m: R) => [m.month, usd(m.mtmPnl), ...ids.map(id => usd(find(id, w, tp).metrics.monthly.find((q: R) => q.month === m.month).mtmPnl - m.mtmPnl))])) + "\n";
  }
  md += "## Attribution: losing dollars, replacement cycles and unfinished inventory\n\nThese are accounting identities and ex-post attribution, not predictive labels. Same-entry episodes may still have different later adds/partials.\n\n";
  for (const tp of ["resting_touch", "close_confirmed"]) {
    md += `### Recent / ${modelLabel(tp)}\n\n`;
    md += table(["Setup", "Win-income delta $", "Loss dollars avoided $", "Completed delta $", "End delta $", "Total vs B17 $", "Total vs pair $"], [PARENT, ...top].map(id => {
      const x = find(id, "hl_extended", tp), c = comps.find(c => c.name === x.name)!, b = c.baseline;
      return [label(id), usd(b.grossWinDelta), usd(-b.grossLossDelta), usd(b.grossWinDelta - b.grossLossDelta), usd(c.attributionBaseline.openAndUnfinishedDelta), usd(b.pnlDelta), usd(c.parent.pnlDelta)];
    })) + "\n";
    md += table(["Setup", "Matched entry delta $", "Removed baseline net $", "Replacement net $", "End delta $", "Matched / removed / new"], [PARENT, ...top].map(id => {
      const c = comps.find(c => c.name === find(id, "hl_extended", tp).name)!, a = c.attributionBaseline;
      return [label(id), usd(a.matchedDelta), usd(a.removedNet), usd(a.replacementNet), usd(a.openAndUnfinishedDelta), `${a.matched}/${a.removed}/${a.replacement}`];
    })) + "\n";
    md += table(["Setup", "High exits", "Hard flatten", "Emergency", "Funding spike", "S/R partials", "Target episodes", "Half-size episodes"], selected.map(id => {
      const x = find(id, "hl_extended", tp), c = x.accounting.reasonCounts;
      return [label(id), x.counts.highEpisodes, c.hard_flatten ?? 0, c.emergency_kill ?? 0, c.funding_spike ?? 0, c.sr_partial ?? 0, x.counts.targetEpisodes, x.counts.sizeEpisodes];
    })) + "\n";
  }
  md += "## One-minute high-source delay\n\nCurrent decision price and ordinary fills are unchanged. This does not certify market-fill latency.\n\n";
  md += table(["Setup", "Touch net change $", "Touch DD change pp", "Confirmed net change $", "Confirmed DD change pp"], [PARENT, ...VARIANTS.map(p => p.id)].map(id => {
    const vals = ["resting_touch", "close_confirmed"].flatMap(tp => { const p = find(id, "hl_extended", tp), x = rows.find(r => r.phase === "source60" && r.policy === id && r.tp === tp)!;
      return [usd(x.metrics.totalPnl - p.metrics.totalPnl), (x.metrics.maxDrawdownPct - p.metrics.maxDrawdownPct).toFixed(3)]; }); return [label(id), ...vals];
  })) + "\n";
  return md;
}
if (require.main === module) console.log(report(process.argv[2]));
