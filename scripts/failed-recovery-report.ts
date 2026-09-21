/** Derived tables only. The authored interpretation lives in research/. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
type Row = Record<string, any>;
const money = (v: number) => Math.round(v).toLocaleString("en-US"), pct = (v: number | null) => v === null ? "n/a" : (v * 100).toFixed(1) + "%";
const table = (header: string[], rows: any[][]) => ["| " + header.join(" | ") + " |", "| " + header.map(() => "---").join(" | ") + " |", ...rows.map(r => "| " + r.join(" | ") + " |")].join("\n");
async function main() {
  const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-failed-recovery-2026-09-08"), verify = read(path.join(dir, "verification.json"));
  assert(verify.passed && read(path.join(dir, "source-verification.json")).passed);
  for (const p of verify.artifacts) assert.equal(await fileHash(path.join(dir, p.file)), p.sha256, p.file);
  const gs: Row[] = read(path.join(dir, "groups.json")), bases: Row[] = read(path.join(dir, "baseline.json")), monthly: Row[] = read(path.join(dir, "monthly.json"));
  const names: Record<string, string> = { "published_window-resting_touch": "Long / touch", "published_window-close_confirmed": "Long / confirmed", "hl_extended-resting_touch": "Recent / touch", "hl_extended-close_confirmed": "Recent / confirmed" };
  const models = Object.keys(names), out: string[] = [];
  const add = (title: string, text: string) => out.push(`## ${title}\n\n${text}\n`);
  add("Unchanged full-stack baselines", table(["Period / TP model", "Wins", "Losses", "Winning $", "Losing $", "Realized $", "Open $", "Net $", "Max DD"], models.map(model => {
    const m = bases.find(b => b.model === model)!.metrics; return [names[model], m.profitableEpisodes, m.losingEpisodes, money(m.grossWin), money(m.grossLoss), money(m.realized), money(m.openPnl), money(m.totalPnl), m.maxDrawdownPct.toFixed(2) + "%"]; })));
  add("All deep-loss cohorts, including recoveries", table(["Period / TP", "First loss", "Checkpoint", "Completed + open", "Wins / losses", "Winning $", "Losing $", "Already marked $", "Further downside $", "Subsequent recovery $"], models.flatMap(model => [-3, -5].flatMap(threshold => [0, 60].map(landmarkMinutes => {
    const b = gs.find(g => g.model === model && g.threshold === threshold && g.landmarkMinutes === landmarkMinutes && g.id === "D1" && g.delay === 0)!.baseline;
    return [names[model], `${threshold}%`, `+${landmarkMinutes}m`, `${b.completed} + ${b.censored}`, `${b.wins} / ${b.losses}`, money(b.winningDollars), money(b.losingDollars), money(b.marksAtObservation), money(b.subsequentDownside), money(b.subsequentRecovery)]; })))));
  for (const model of models) {
    const rows = gs.filter(g => g.model === model && g.threshold === -3 && g.landmarkMinutes === 60 && g.delay === 0);
    add(`${names[model]}: primary warning cohorts`, table(["Diagnostic", "W/L", "Winning $", "Losing $", "Further declines / completed", "Remaining downside $", "Subsequent recovery $", "Balance, NOT PnL", "Unflagged decline rate", "Unknown / open flagged"], [
      ["All baseline deep landmarks", `${rows[0].baseline.wins}/${rows[0].baseline.losses}`, money(rows[0].baseline.winningDollars), money(rows[0].baseline.losingDollars), `${rows[0].baseline.furtherDeclines}/${rows[0].baseline.completed}`, money(rows[0].baseline.subsequentDownside), money(rows[0].baseline.subsequentRecovery), money(rows[0].baseline.diagnosticBalance), "n/a", `${0}/${rows[0].baseline.censored}`],
      ...rows.map(g => { const f = g.flagged; return [g.id, `${f.wins}/${f.losses}`, money(f.winningDollars), money(f.losingDollars), `${f.furtherDeclines}/${f.completed}`, money(f.subsequentDownside), money(f.subsequentRecovery), money(f.diagnosticBalance), pct(g.unflagged.declineFraction), `${g.unknown.observations}/${f.censored}`]; })]));
  }
  add("Threshold/checkpoint sensitivity: flagged diagnostic balance, NOT policy PnL", table(["Diagnostic", "Recent touch -3/0m", "Recent confirmed -3/0m", "Recent touch -3/60m", "Recent confirmed -3/60m", "Recent touch -5/60m", "Recent confirmed -5/60m"],
    Array.from({ length: 10 }, (_, i) => `D${i + 1}`).map(id => [id, ...[[-3, 0], [-3, 60], [-5, 60]].flatMap(([threshold, landmarkMinutes]) => ["hl_extended-resting_touch", "hl_extended-close_confirmed"].map(model => {
      const g = gs.find(g => g.model === model && g.id === id && g.threshold === threshold && g.landmarkMinutes === landmarkMinutes && g.delay === 0)!;
      return `${money(g.flagged.diagnosticBalance)} (n=${g.flagged.completed})`; }))])));
  for (const model of models) for (const ids of [["D1", "D2", "D3", "D4", "D5"], ["D6", "D7", "D8", "D9", "D10"]]) {
    const b = bases.find(b => b.model === model)!;
    add(`${names[model]} monthly ${ids[0]}-${ids.at(-1)}: diagnostic balance, NOT monthly profit delta`, table(["Observation month", "Full baseline MTM $", "Deep baseline W/L", ...ids], b.metrics.monthly.map((m: Row) => {
      const cell = (id: string) => monthly.find(g => g.model === model && g.id === id && g.threshold === -3 && g.landmarkMinutes === 60 && g.month === m.month);
      const first = cell(ids[0]); return [m.month, money(m.mtmPnl), first ? `${first.baseline.wins}/${first.baseline.losses}` : "0/0",
        ...ids.map(id => { const g = cell(id); return g ? `${money(g.flagged.diagnosticBalance)} (n=${g.flagged.completed}, ?=${g.unknown.observations})` : "0 (n=0)"; })]; })));
  }
  add("Arrival sensitivity at primary recent landmarks", table(["Period / TP", "Diagnostic", "Extra lag", "Known / all", "Flagged completed", "Balance, NOT PnL"],
    gs.filter(g => g.model.startsWith("hl_extended") && g.threshold === -3 && g.landmarkMinutes === 60 && ["D4", "D5", "D7"].includes(g.id)).map(g => [names[g.model], g.id, `${g.delay / 1000}s`, `${g.flagged.observations + g.unflagged.observations}/${g.baseline.observations}`, g.flagged.completed, money(g.flagged.diagnosticBalance)])));
  fs.writeFileSync(path.join(dir, "tables.md"), out.join("\n"), { flag: "wx" }); console.log(`Wrote ${out.length} accepted table sections`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
