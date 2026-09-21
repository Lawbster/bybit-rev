/** F04 report from verified economic paths, not attribution-only projections. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
import { csv } from "./pressure-point-features";
type R = Record<string, any>;
const n = (x: number, dp = 0) => x.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });
const money = (x: number) => `${Math.round(x) < 0 ? "-" : ""}$${n(Math.abs(x))}`;
const table = (h: string[], rs: any[][]) => ["| " + h.join(" | ") + " |", "| " + h.map(() => "---").join(" | ") + " |", ...rs.map(r => "| " + r.join(" | ") + " |")].join("\n");
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-weekly-exit-2026-09-09"), r = (f: string) => read(path.join(out, f));
  const v = r("verification.json"), validation = r("validation.json"); assert(v.passed);
  for (const p of validation.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256);
  assert.equal(await fileHash(path.join(out, "execution-traces.json")), v.traceSha256);
  const results: R[] = r("results.json"), comparisons: R[] = r("comparisons.json"), monthly: R[] = [];
  const names = ["baseline", "mfi_half", "mfi_weekly_half"], labels: R = { baseline: "Current B17", mfi_half: "Original MFI half", mfi_weekly_half: "MFI + weekly context half" };
  const text = ["# F04: verified weekly-VWAP half-exit replay", "",
    "Three fixed setups; one new definition. $32,000 starting capital; $800 x1.35/max11; unchanged B17 protections; 0.055% fee per side. Fees/funding/maker execution are not retroactively adjusted. Each model/window starts flat; overlapping windows and TP models are not independent samples.", "",
    "One checkpoint60m after first depth>=9/gross<=-3%. Same episode/depth>=9, completed30m MFI14<=20; additional variant requires completed1h close below actual UTC-week turnover VWAP and five-hour ROC<=0. Pro-rata50%, no later episode adds, ordinary exits/SR priority. No second loss threshold; no later retry after rejected context.", ""];
  for (const model of ["hl_extended-resting_touch", "hl_extended-close_confirmed", "published_window-resting_touch", "published_window-close_confirmed"]) {
    const rs = names.map(id => results.find(x => x.model === model && x.policy.id === id && x.sensitivity.id === "primary")!);
    text.push(`## ${model}`, "", `UTC ${rs[0].start} through ${rs[0].end}.`, "");
    text.push(table(["Setup", "W/L", "Winning dollars", "Losing dollars", "Net incl.open", "Delta B17", "Max DD", "TP cycles", "Forced closes", "Half cuts"], rs.map(x => {
      const m = x.metrics; return [labels[x.policy.id], `${m.profitableEpisodes}/${m.losingEpisodes}`, money(m.grossWin), money(-m.grossLoss), money(m.totalPnl),
        money(m.totalPnl - rs[0].metrics.totalPnl), n(m.maxDrawdownPct, 2) + "%", m.tpCycles, m.forcedCloses, x.audit.executed];
    })), "", "W/L and winning/losing dollars include all partials in completed episodes. Net also includes unfinished partial cash and final marked open inventory.", "");
    text.push(table(["Setup", "Realized", "Final open", "Unfinished partials", "Modeled fees", "Minimum equity"], rs.map(x => [labels[x.policy.id], money(x.metrics.realized), money(x.metrics.openPnl), money(x.metrics.unfinishedPartialPnl), money(x.accounting.modeledFees), money(x.metrics.minEquity)])), "");
    text.push("### Every month: MTM and delta against identical baseline", "");
    text.push(table(["Month", "B17 MTM", "Original half MTM / delta", "Weekly half MTM / delta"], rs[0].metrics.monthly.map((m: R) => [m.month, money(m.mtmPnl), ...rs.slice(1).map(x => {
      const mm = x.metrics.monthly.find((a: R) => a.month === m.month); return `${money(mm.mtmPnl)} / ${money(mm.mtmPnl - m.mtmPnl)}`;
    })])), "");
    text.push("### Monthly completed episode wins/losses and dollars", "", "Closed episode dollars use final-close month; MTM uses cash plus open exposure in each month. Different ledgers, not contradictory totals.", "");
    const ms = rs[0].accounting.monthly.flatMap((m: R) => rs.map(x => { const mm = x.accounting.monthly.find((a: R) => a.month === m.month);
      monthly.push({ model, policy: x.policy.id, sensitivity: "primary", ...mm });
      return [m.month, labels[x.policy.id], `${mm.wins}/${mm.losses}`, money(mm.winDollars), money(mm.lossDollars)]; }));
    text.push(table(["Month", "Setup", "W/L", "Winning dollars", "Losing dollars"], ms), "");
  }
  text.push("## Changed-path attribution including invisible gains/costs", "",
    "Matched entry identity; total delta = matched change - removed baseline net + replacement net + open/unfinished change. Ordinary forced closes may still occur after a half cut; lower damage is not the same as removing that close.", "");
  text.push(table(["Model", "Setup", "Matched delta", "Removed n/net", "Replacement n/net", "Open/unfinished delta", "Delta vs B17", "Delta vs original half"],
    results.filter(x => x.policy.id !== "baseline" && x.sensitivity.id === "primary").map(x => { const c = comparisons.find(c => c.name === x.name)!, a = c.attribution;
      return [x.model, labels[x.policy.id], money(a.matchedDelta), `${a.removed}/${money(a.removedNet)}`, `${a.replacement}/${money(a.replacementNet)}`,
        money(a.openAndUnfinishedDelta), money(c.delta.pnlDelta), money(c.versusOriginal.pnlDelta)]; })), "");
  text.push("## Delay and fixed-path cost sensitivity", "",
    "Source60 delays both completed indicator inputs; fill60 delays only the experimental exit. Existing protections retain priority. No duplicate baseline latency runs; its path is unaffected. Extra5bps each side is fixed-path cost stress, not an affordability re-simulation.", "");
  text.push(table(["Model", "Setup", "Sensitivity", "B17 net", "Variant net", "Delta", "Max DD", "Cuts / vetoes", "Delta with extra5bps/side"], results.filter(x => x.policy.id !== "baseline").map(x => {
    const b = results.find(b => b.model === x.model && b.policy.id === "baseline")!, c = comparisons.find(c => c.name === x.name)!;
    return [x.model, labels[x.policy.id], x.sensitivity.id, money(b.metrics.totalPnl), money(x.metrics.totalPnl), money(c.delta.pnlDelta), n(x.metrics.maxDrawdownPct, 2) + "%", `${x.audit.executed}/${x.contextAudit.vetoes}`, money(c.extra5bpsDelta)];
  })), "");
  text.push("## Previously descriptive contribution versus actual full replay", "");
  text.push(table(["Model", "F03 projected contribution", "Actual replay delta B17", "Difference", "Projected / actual cuts"], r("diagnostic-versus-replay.json").map((x: R) => [x.model,
    money(x.predictedContribution), money(x.actualDelta), money(x.difference), `${x.selectedF03}/${x.actualCuts}`])), "");
  text.push("## Checkpoints and censoring", "");
  text.push(table(["Model", "Setup", "First distress", "Executed", "After July15", "Checkpoint statuses"], results.filter(x => x.sensitivity.id === "primary").map(x => [x.model,
    labels[x.policy.id], x.audit.firstDistress, x.audit.executed, x.audit.afterJuly15, Object.entries(x.audit.statusCounts).map(([k, v]) => `${k}=${v}`).join("; ")])), "");
  text.push("## Frozen economic screen", "", "Same F02 thresholds: recent net gain >=$1,000; published gain>=0; no DD increase; no month worse than baseline by more than$250; no modeled insolvency. Both TP models must pass. This is already-inspected history, not a holdout; even a screen pass is not a live approval.", "");
  text.push(table(["Setup", "Pass", "Failures"], r("ranking.json").map((x: R) => [labels[x.policy], String(x.passesEconomicScreen), x.failures.join("; ") || "none"])), "");
  text.push(`## Verification\n\n${v.cases} full runs; ${v.controlChecks} exact F02 controls, including four canonical B17 digests; ${n(v.fills)} re-accounted fills and ${n(v.minuteMarks)} minute marks; ${n(v.rawMfiChecks)} raw MFI and ${n(v.rawWeeklyChecks)} weekly VWAP/ROC checks.`, "",
    "No live changes. No funding settlement, real maker queue/fill, shared-account short or maintenance-margin liquidation certification. Evidence-selected context, overlapping paths and thin intervention counts limit confidence. Source/fill60s are sensitivities, not guarantees of live latency.", "");
  const outputs = [{ file: "tables.md", data: text.join("\n") }, { file: "primary-monthly-wl.csv", data: csv(monthly) }];
  for (const x of outputs) fs.writeFileSync(path.join(out, x.file), x.data, { flag: "wx" });
  fs.writeFileSync(path.join(out, "report-validation.json"), JSON.stringify({ at: new Date().toISOString(), verificationSha256: await fileHash(path.join(out, "verification.json")),
    sourceSha256: await fileHash(__filename), artifacts: await Promise.all(outputs.map(async x => ({ file: x.file, sha256: await fileHash(path.join(out, x.file)) }))) }, null, 2) + "\n", { flag: "wx" });
  console.log(`[F04 report] ${monthly.length} primary policy-month pairs`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
