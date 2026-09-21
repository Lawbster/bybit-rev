/** Render verified F06 comparisons; no strategy selection or live writes. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, csv, fileHash } from "./hype-failed-recovery-study";
type R = Record<string, any>;
const dollar = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(2)}%`;
async function main() {
  const out = path.resolve(process.argv[2] ?? "backtests/hype/hype-conditional-soft-stale-2026-09-10"), load = (f: string) => read(path.join(out, f));
  const v = load("verification.json"); assert(v.passed); const spec = load("manifest.json").spec, results: R[] = load("results.json"), comp: R[] = load("comparisons.json"), rank: R[] = load("ranking.json");
  const labels: R = { baseline: "B17 unchanged", minus_soft_stale: "No soft-stale (control)", structure8: "Structure / 8h", vwap_roc8: "VWAP + ROC / 8h", resistance_room8: "Resistance room / 8h", age8: "Unconditional / 8h" };
  const models = ["published_window-resting_touch", "published_window-close_confirmed", "hl_extended-resting_touch", "hl_extended-close_confirmed"];
  const row = (model: string, policy: string, sens = "primary") => results.find(x => x.model === model && x.policy.id === policy && x.sensitivity.id === sens)!;
  const comparison = (r: R) => comp.find(c => c.name === r.name)!;
  const ids = ["baseline", "minus_soft_stale", ...spec.policies.map((p: R) => p.id)];
  const winners = rank.filter(r => r.passesEconomicScreen);
  const parts = ["# F06: conditional soft-stale TP findings", "", "September 10, 2026. Local research only. Live configuration, execution, state and shorts unchanged.", "", "## TL;DR", "",
    `- **${winners.length ? `${winners.length} reference/policies pass the frozen primary screen` : "No policy passes the complete cross-period screen"}.** Four new definitions, eight exact controls and 48 variant paths; 56 verified runs. No deployment recommendation.`,
    "- B17 is the exact unchanged causal current-stack replay. Published July 1, 2025–August 19, 2026 21:32 UTC; recent May 17, 2026 20:43–September 8, 2026 17:47 UTC. Separate flat $32,000 starts; windows overlap and are not independent evidence.",
    "- Test mechanism: retain 1.4% instead of accepting eligible 0.5% soft-stale, conditionally and only until 8h. No new half-exits, construction changes or fee assumptions. Fees remain 0.055% per side.", "", "## What exactly changed", "",
    "Ordinary eligibility is oldest remaining rung age >=4h **and current gross PnL <0.5%**, not age alone. The experiment grants a one-way permission to defer at first eligibility. Failed/unknown context or age 8h ends permission; it cannot restart in the same episode. After release, the ordinary soft-stale predicate applies. It is not a permanently latched reduced target.", "",
    "| Setup | Condition permitting extension |", "|---|---|",
    "| B17 unchanged | Original4h /0.5% rule |", "| No soft-stale reference | Reduction disabled entirely; previously tested, not a new definition |",
    "| Structure /8h | Closed4h close>=EMA200 AND EMA50>=previous EMA50; canonical249-bar seed |",
    "| VWAP + ROC /8h | Closed1h close>UTC-day VWAP AND hourly ROC5>0 |",
    "| Resistance room /8h | Known confirmed resistance>=normal target*1.001, healthy14d coverage |",
    "| Unconditional /8h | Same bounded extension without a context filter |", "",
    "All S/R trims, entry gates, sizes, hard/emergency exits, actual remaining-rung age and last-add clocks stay in force. Unknown context declines extension, not normal protection. Every changed target becomes usable only after its decision bar.", "", "## Wins and losses beside the baseline", "",
    "Winning/losing dollars include all realized partials of each completed episode and both-side fees. Net also includes partial cash in any unfinished episode and final open PnL. Win/loss is the whole episode's net outcome, not the exit label: a forced close can belong to a profitable episode after earlier partials. Drawdown includes bar-low stress, not just closes. Rounded display only; CSV/JSON retain precision."];
  for (const model of models) {
    parts.push("", `### ${model.startsWith("published") ? "Published window" : "Recent HL window"} — ${model.endsWith("resting_touch") ? "prior-armed touch" : "close-confirmed / next open"}`, "",
      "| Setup | Wins / losses | Winning $ | Losing $ | Realized | Open PnL | Net | Δ B17 | Max DD | Min equity | TP / forced |",
      "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    const b = row(model, "baseline");
    for (const id of ids) { const m = row(model, id).metrics;
      parts.push(`| ${labels[id]} | ${m.profitableEpisodes} / ${m.losingEpisodes} | ${dollar(m.grossWin)} | ${dollar(-m.grossLoss)} | ${dollar(m.realized)} | ${dollar(m.openPnl)} | ${dollar(m.totalPnl)} | ${signed(m.totalPnl - b.metrics.totalPnl)} | ${pct(m.maxDrawdownPct)} | ${dollar(m.minEquity)} | ${m.tpCycles} / ${m.forcedCloses} |`);
    }
  }
  const ageTouch = row("hl_extended-resting_touch", "age8"), ageConfirmed = row("hl_extended-close_confirmed", "age8"), olderAge = row("published_window-resting_touch", "age8"), olderBase = row("published_window-resting_touch", "baseline");
  assert.equal(ageTouch.tp, "resting_touch"); assert.equal(ageConfirmed.tp, "close_confirmed"); assert.equal(olderAge.tp, "resting_touch");
  const ageDelta = comparison(ageTouch).delta, contexts = spec.policies.filter((p: R) => p.family !== "age");
  const allContextsTrailAge = contexts.every((p: R) => models.slice(2).every(m => row(m, p.id).metrics.totalPnl < row(m, "age8").metrics.totalPnl));
  parts.push("", "## What this tells us", "",
    `The unconditional 8h control improves recent net by **${signed(ageDelta.pnlDelta)} touch / ${signed(comparison(ageConfirmed).delta.pnlDelta)} confirmed**. ${allContextsTrailAge ? "All three context-filtered versions earn less than that simple 8h control in both recent models." : "Context filters must be judged against that age-only control, not just against B17."}`, "",
    `For recent touch, age8 changes winning dollars by **${signed(ageDelta.grossWinDelta)}** but losing dollars by **${signed(ageDelta.grossLossDelta)}** (positive means more losses). This is not uniformly smaller losers. It changes cycle occupancy and winner capture as well as exit prices.`, "",
    `The older touch drawdown moves **${pct(olderBase.metrics.maxDrawdownPct)} -> ${pct(olderAge.metrics.maxDrawdownPct)}** under age8. Its worst older month delta is **${signed(comparison(olderAge).delta.worstMonthDelta)}**. Recent improvement therefore does not establish cross-regime safety.`, "",
    "Conclusion is restricted to these four 8h definitions. It does not prove B17 globally optimal, reject all conditional TP ideas, or justify switching off soft-stale. The next requested experiment should address exposure while the ladder is being built, without combining changes or rescuing F05 half-exits.");
  parts.push("", "## Ranking and fixed screen", "", "Ranking below uses the smaller of the two recent-model net improvements, not pooled/average PnL. The full screen additionally requires recent+$1,000 in both models, nonnegative published improvement, no worse drawdown and **every month Δ>=-$250**. A single positive headline is insufficient.", "",
    "| Setup | Recent touch Δ | Recent confirmed Δ | Published touch Δ | Published confirmed Δ | Screen |", "|---|---:|---:|---:|---:|---|");
  const sorted = rank.slice().sort((a, b) => Math.min(...models.slice(2).map(m => comparison(row(m, b.policy)).delta.pnlDelta)) - Math.min(...models.slice(2).map(m => comparison(row(m, a.policy)).delta.pnlDelta)));
  for (const p of sorted) { const ds = [...models.slice(2), ...models.slice(0, 2)].map(m => signed(comparison(row(m, p.policy)).delta.pnlDelta)); parts.push(`| ${labels[p.policy]} | ${ds.join(" | ")} | ${p.passesEconomicScreen ? "PASS primary only" : "FAIL"} |`); }
  for (const p of sorted) parts.push("", `**${labels[p.policy]}:** ${p.failures.length ? p.failures.join("; ") : "No primary economic screen failures; still research, not live approval."}`);
  parts.push("", "## Every month, including adverse trade-offs", "", "Cells show marked-to-market month PnL; variant cells include Δ versus that row's B17. Boundary months are partial. Complete per-month W/L, winning/losing dollars and realized PnL are in `monthly.csv`.");
  for (const model of models) {
    const b = row(model, "baseline"); parts.push("", `### ${model}`, "", `| Month | ${ids.map(id => labels[id]).join(" | ")} |`, `|---|${ids.map(() => "---:").join("|")}|`);
    for (const bm of b.metrics.monthly) {
      const cells = ids.map(id => { const m = row(model, id).metrics.monthly.find((m: R) => m.month === bm.month); return `${dollar(m.mtmPnl)}${id === "baseline" ? "" : ` (${signed(m.mtmPnl - bm.mtmPnl)})`}`; });
      parts.push(`| ${bm.month} | ${cells.join(" | ")} |`);
    }
  }
  parts.push("", "## Invisible upside and occupancy", "", "A changed target changes how long a ladder occupies the account and which later ladders are possible. This table includes all replacement trades; it is not a cherry-picked review of eventual flattens.", "",
    "| Model / setup | Winning $ Δ | Losing $ Δ (positive = worse) | TP Δ | Forced Δ | Matched contribution | Removed count / net | Replacement count / net | Open + unfinished Δ |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const model of models) for (const id of ids.slice(1)) { const r = row(model, id), c = comparison(r), d = c.delta, a = c.attribution;
    parts.push(`| ${model} / ${labels[id]} | ${signed(d.grossWinDelta)} | ${signed(d.grossLossDelta)} | ${d.tpCycleDelta} | ${d.forcedCloseDelta} | ${signed(a.matchedDelta)} | ${a.removed} / ${dollar(a.removedNet)} | ${a.replacement} / ${dollar(a.replacementNet)} | ${signed(a.openAndUnfinishedDelta)} |`);
  }
  parts.push("", "Identity: total Δ = matched Δ − removed baseline net + replacement net + open/unfinished Δ. Removed/replacement episodes are whole-path attribution, not a claim that their loss/win was predictable at entry.", "", "## Source/release-delay sensitivity", "",
    "Extra60s source lag changes only new context availability. Extra60s release delay retains an already active normal target briefly before relinquishing deferral; it does not delay hard exits, initial refusal, or every exchange action. No fee/price improvement is assumed.", "",
    "| Model / setup | Primary net Δ | Source +60s Δ | Release +60s Δ | Primary extra5bps/side Δ | Extensions / refusals / releases |", "|---|---:|---:|---:|---:|---:|");
  for (const model of models) for (const p of spec.policies) { const r = row(model, p.id), a = r.audit.statuses, c = comparison(r);
    parts.push(`| ${model} / ${labels[p.id]} | ${signed(c.delta.pnlDelta)} | ${signed(comparison(row(model, p.id, "source60")).delta.pnlDelta)} | ${signed(comparison(row(model, p.id, "release60")).delta.pnlDelta)} | ${signed(c.extra5bpsDelta)} | ${a.extended ?? 0} / ${a.refused ?? 0} / ${a.release_requested ?? 0} |`);
  }
  const traces: R[] = load("causal-traces.json"), trace = traces.find(t => t.name.includes("hl_extended-resting_touch--vwap_roc8")) ?? traces[0];
  if (trace) {
    const e = trace.extension, f = e.context.evidence;
    parts.push("", "## One causal decision trace", "",
      `Case \`${trace.name}\`: at **${new Date(e.at).toISOString()}**, actual depth${e.depth}, oldest remaining age${e.age.toFixed(2)}h, price${e.price.toFixed(4)}, average${e.avgEntry.toFixed(4)}. Ordinary TP was eligible for0.5%; the experiment retained1.4%.`, "",
      `The selected completed source frame ended **${new Date(f.endTs ?? f.sourceAt ?? e.at).toISOString()}**, no later than the decision. Evidence: \`${JSON.stringify(f)}\`.`, "",
      trace.resolution ? `Permission was relinquished at **${new Date(trace.resolution.at).toISOString()}**; effective release **${new Date(trace.resolution.releaseAt).toISOString()}**. Reason/evidence: \`${JSON.stringify(trace.resolution.context)}\`.` : "This episode completed or reached the data boundary without a logged context/age release; do not invent a release.", "",
      "A resulting new target is usable only on subsequent bars. The independent checker matches every TP close to its previously armed target; the fixture explicitly rejects a high that occurred earlier in the target-change candle.");
  }
  parts.push("", "## Integrity and limitations", "",
    `- ${v.controls} exact archived digests/metrics/ledgers reproduced before variants. ${v.cases} cases checked independently: ${v.fills.toLocaleString()} fills, ${v.independentMinutes.toLocaleString()} minute marks, ${v.targetChanges.toLocaleString()} target changes and ${v.observations.toLocaleString()} policy transitions.`,
    `- Raw recomputation: ${v.sources.raw4hFrames.toLocaleString()} 4h EMA frames, ${v.sources.rawHourlyFrames.toLocaleString()} hourly VWAP/ROC frames; ${v.prefixChecks} nonempty S/R prefix checks. Target evidence traces stored in causal-traces.json.`,
    "- Input/source/protected-file hashes retained. No live config, state, production order behavior, shorts, deployment, commit or push changed.",
    "- The archived historical engine is not silently rehashed: an exact pre-F06 copy and repeated controls establish the research-only hook bridge. Historical runs retain their original pins.",
    "- An initial implementation attempt was stopped after20 completed cases: a1%-bounded proximity helper did not implement the frozen nearest-known-resistance rule. Its source/results are preserved in the sibling invalidated-buffer-lookup directory. Corrected lookup uses all confirmed zones without geometry/threshold changes, a beyond-buffer regression passes, and all56 final paths were rerun fresh. The invalidated paths are not extra accepted strategies or evidence against the intended resistance rule.",
    "- No untouched holdout; already examined overlapping periods. Intrabar fills are a model, not proof of maker queue priority. Fees are unchanged taker assumptions; no funding-settlement, liquidation or joint-account certification.",
    "- Unconditional no-soft-stale remains an informative reference, not a new validated optimum. Positive net and a failed monthly/DD screen can coexist.", "", "## Next separate experiment", "",
    "Exposure control **during construction**, as requested. Keep unchanged B17 as its reference and avoid combining F06 with sizing/spacing on the first pass. No further filters are attached to F05 half-exits. Freeze a small construction-specific card before economic runs; distinguish losses avoided, TP cycles sacrificed and replacement occupancy.", "", "## Files", "",
    "- [Frozen F06 design and commands](../docs/research/conditional-soft-stale-f06.md).",
    "- [Frozen card](../research-inputs/conditional-soft-stale-2026-09-10.json).",
    `- Results: \`${path.relative(process.cwd(), out).replace(/\\/g, "/")}\`: overview.csv, monthly.csv, results.json, comparisons.json, ranking.json, verification.json and per-case inventories/targets/observations.`,
    "- [Earlier component audit](codex-astra-ladder-components-findings-2026-09-08.md); [F05 outcomes](codex-astra-recovery-mechanism-findings-2026-09-10.md).", "");
  fs.writeFileSync("research/codex-astra-conditional-soft-stale-findings-2026-09-10.md", parts.join("\n"));
  const monthly = results.flatMap(r => r.accounting.monthly.map((m: R) => ({ model: r.model, policy: r.policy.id, sensitivity: r.sensitivity.id, ...m })));
  fs.writeFileSync(path.join(out, "monthly-wins-losses.csv"), csv(monthly));
  const report = "research/codex-astra-conditional-soft-stale-findings-2026-09-10.md";
  fs.writeFileSync(path.join(out, "report-validation.json"), JSON.stringify({ verificationHash: await fileHash(path.join(out, "verification.json")), reporterHash: await fileHash(__filename),
    artifacts: [{ file: report, sha256: await fileHash(report) }, { file: "monthly-wins-losses.csv", sha256: await fileHash(path.join(out, "monthly-wins-losses.csv")) }] }, null, 2) + "\n", { flag: "wx" });
  console.log("F06 verified findings rendered");
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
