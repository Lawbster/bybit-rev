/** Human-readable F03 attribution tables; never synthesizes a filtered portfolio return. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
import { csv } from "./pressure-point-features";
type R = Record<string, any>;
const usd = (n: number) => Math.round(n).toLocaleString("en-US"), pc = (n: number) => n.toFixed(2) + "%";
function table(headers: string[], rows: any[][]) { return ["| " + headers.join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |", ...rows.map(r => "| " + r.join(" | ") + " |")].join("\n"); }
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-mfi-recovery-context-2026-09-09"), r = (f: string) => read(path.join(out, f));
  assert(r("verification.json").passed); const val = r("validation.json");
  for (const p of val.artifacts) assert.equal(await fileHash(path.join(out, p.file)), p.sha256);
  const bs: R[] = r("baseline-and-half.json"), splits: R[] = r("contrasts.json"), cases: R[] = r("rows.json");
  const text = ["# F03: archived half-exit attribution and causal context", "",
    "Fees stay 0.055% per side. Actual economic paths below are unchanged F02 baseline/MFI-half results. Context buckets are NOT new strategy backtests, and their contribution sums are NOT portfolio PnL or DD. Overlapping models/windows are separate, not independent samples.", ""];
  text.push(table(["Window/model", "Setup", "Wins/losses", "Winning USD", "Losing USD", "Net incl. open USD", "Max DD"], bs.map(b => {
    const m = b.metrics; return [b.model, b.policy.id, `${m.profitableEpisodes}/${m.losingEpisodes}`, usd(m.grossWin), usd(-m.grossLoss), usd(m.totalPnl), pc(m.maxDrawdownPct)]; })), "");
  const flat: R[] = [], monthly: R[] = [];
  for (const b of bs.filter(x => x.policy.id === "baseline")) {
    const h = bs.find(x => x.model === b.model && x.policy.id === "mfi_half")!;
    text.push(`## ${b.model}`, "", `UTC ${b.start} through ${b.end}. Both independently start flat with $32,000.`, "");
    for (const sensitivity of ["primary", "source60"]) {
      text.push(`### ${sensitivity}: selected MFI-half cases only`, "",
        "Helpful/harmful means positive/negative episode delta against unchanged B17. A positive balance in a bucket does not prove its complement is safe to leave uncut.", "");
      text.push(table(["ID/context", "Flagged helpful/harmful", "Saved USD", "Cost USD", "Flagged balance USD", "Unflagged n / balance", "Unknown n / balance"],
        splits.filter(x => x.model === b.model && x.month === "all" && x.sensitivity === sensitivity).map(x => [x.id + " " + x.name,
          `${x.flagged.helpful}/${x.flagged.harmful}`, usd(x.flagged.saved), usd(-x.flagged.cost), usd(x.flagged.balance),
          `${x.unflagged.selected} / ${usd(x.unflagged.balance)}`, `${x.unknown.selected} / ${usd(x.unknown.balance)}`])), "");
    }
    text.push("### Monthly control versus original half exits; C3 attribution only", "",
      "Months are full or partial per the UTC run endpoints. Baseline and half are actual MTM path totals. C3 contributions group completed episodes by checkpoint month; they are not separately replayed monthly returns.", "");
    const mm = b.metrics.monthly.map((m: R) => {
      const half = h.metrics.monthly.find((x: R) => x.month === m.month)!;
      const c = splits.find(x => x.model === b.model && x.month === m.month && x.sensitivity === "primary" && x.id === "C3");
      const row = { model: b.model, month: m.month, baselineMtm: m.mtmPnl, halfMtm: half.mtmPnl, halfDelta: half.mtmPnl - m.mtmPnl,
        c3FlaggedContribution: c?.flagged.balance ?? 0, c3UnflaggedContribution: c?.unflagged.balance ?? 0 };
      monthly.push(row); return [m.month, usd(row.baselineMtm), usd(row.halfMtm), usd(row.halfDelta), usd(row.c3FlaggedContribution), usd(row.c3UnflaggedContribution)];
    }); text.push(table(["Month", "Baseline MTM USD", "Original MFI-half MTM USD", "Half delta", "C3 flagged contribution", "C3 unflagged contribution"], mm), "");
    text.push("### Every actual half intervention", "");
    text.push(table(["Checkpoint UTC", "Baseline episode USD", "Half episode USD", "Delta USD", "MFI30", "1h week VWAP distance", "Five-hour ROC", "C3"],
      cases.filter(x => x.model === b.model && x.selected).map(x => { const v = x.trajectory.at(-1); return [x.iso, usd(x.baselineOutcome.pnl), usd(x.halfOutcome.pnl), usd(x.delta),
        v.m30_mfi14.toFixed(2), pc(v.m60_weekVwapDistancePct), pc(v.m60_roc5), String(x.flags.primary.C3)]; })), "");
  }
  for (const x of splits) for (const group of ["all", "flagged", "unflagged", "unknown"]) flat.push({ model: x.model, month: x.month, sensitivity: x.sensitivity, id: x.id, name: x.name, group, ...x[group] });
  text.push("## Interpretation limits", "", "Twelve fixed explanatory contrasts, not twelve new economic variants. No post-hoc threshold or inverse-condition sweep. All families on five clocks are stored in trajectories.csv; primary/delayed source references are in contexts.jsonl. Missing history is unknown, not neutral. Source60 can invalidate 15m flow coverage: do not count absent delayed signals as a stable filter. The economic fee model is unchanged and excludes funding settlements and actual maker matching. No deployment qualification is awarded by this diagnostic.", "");
  const outputs = [{ file: "tables.md", data: text.join("\n") }, { file: "contrast-monthly.csv", data: csv(flat) }, { file: "baseline-monthly.csv", data: csv(monthly) }];
  for (const x of outputs) fs.writeFileSync(path.join(out, x.file), x.data, { flag: "wx" });
  fs.writeFileSync(path.join(out, "report-validation.json"), JSON.stringify({ at: new Date().toISOString(),
    verificationSha256: await fileHash(path.join(out, "verification.json")), sourceSha256: await fileHash(__filename),
    artifacts: await Promise.all(outputs.map(async x => ({ file: x.file, sha256: await fileHash(path.join(out, x.file)) }))) }, null, 2) + "\n", { flag: "wx" });
  console.log(`[F03 report] ${flat.length} all-month/group/sensitivity rows, ${monthly.length} paired economic months`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
