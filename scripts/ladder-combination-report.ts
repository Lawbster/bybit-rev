/** Read-only L13 report generation; stdout is reviewed before storing in research. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { jobDirectory } from "./research-workflow";
type R = Record<string, any>;
const dir = jobDirectory(process.cwd(), process.argv[2]), read = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));
assert(read(path.join(dir, "verification.json")).passed);
const d = read(path.join(dir, "plan.json")).card.definition, all: R[] = read(path.join(dir, "output/results.json")), rows = all.filter(x => x.primary),
  comparisons: R[] = read(path.join(dir, "output/comparisons.json")), ranking: R[] = read(path.join(dir, "output/ranking.json"));
const labels: R = { baseline: "B17 current baseline", age8: "Soft-stale extension to 8h", minus_soft_stale: "No soft-stale reduction", last11_50: "Half-size rung 11",
  minus_deep_stress: "No deep funding guard", mfi_weekly_half: "MFI + weekly-VWAP half-exit", exit_2d_1pct: "4h stale exit near 2-day high (1%)" };
const label = (s: string): string => s.split("__").map(p => labels[p] ?? p).join(" + ");
const n = (v: number, places = 0) => v.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places });
const money = (v: number) => `${v <= -.5 ? "−" : ""}$${n(Math.abs(v))}`, delta = (v: number) => `${v >= .5 ? "+" : ""}${money(v)}`;
const table = (headers: string[], data: unknown[][]) => ["| " + headers.join(" | ") + " |", "|" + headers.map(() => "---").join("|") + "|", ...data.map(r => "| " + r.join(" | ") + " |")].join("\n");
const get = (p: string, w: string, tp: string) => { const x = rows.find(x => x.policy === p && x.window === w && x.tp === tp); assert(x); return x; };
const minDelta = (p: string) => Math.min(...["resting_touch", "close_confirmed"].map(tp => get(p, "hl_extended", tp).metrics.totalPnl - get("baseline", "hl_extended", tp).metrics.totalPnl));
const singles: string[] = [...d.singles.filter((p: string) => p !== "baseline")].sort((a, b) => minDelta(b) - minDelta(a));
const pairs: string[] = [...d.combinations].sort((a, b) => minDelta(b) - minDelta(a));
const best = pairs[0], topFive = [...singles, ...pairs].sort((a, b) => minDelta(b) - minDelta(a)).slice(0, 5);
const netDd = (x: R) => `${money(x.metrics.totalPnl)} / ${n(x.metrics.maxDrawdownPct, 2)}%`;
const report: string[] = ["# L13 — winning ladder singles and eight combination replays", "", "## TL;DR", "",
  `- **86 fresh economic executions, 28 exact archived controls, 8 frozen two-leg combinations.** All 60 primary comparison rows use identical windows, capital and execution assumptions. Seven singles include unchanged B17; no live settings changed.`,
  `- **Highest recent minimum-model combination uplift:** ${label(best)}. Its recent totals are ${netDd(get(best, "hl_extended", "resting_touch"))} resting-touch and ${netDd(get(best, "hl_extended", "close_confirmed"))} close-confirmed, versus baseline ${netDd(get("baseline", "hl_extended", "resting_touch"))} / ${netDd(get("baseline", "hl_extended", "close_confirmed"))}. These are simulated net / max DD, not account returns.`,
  `- **${ranking.filter(x => x.policy.includes("__") && x.passesPrimaryScreen).length}/8 pairs pass the full frozen screen; ${ranking.filter(x => x.policy.includes("__") && x.beatsBothPartsAllFour).length}/8 improve both constituent singles' net without worsening either constituent's DD in all four primary cases.** Aggregate baseline improvement and useful combination synergy are different questions. Monthly failures and sacrificed recovery cycles remain visible below.`, "",
  "## Practical reading of the results", "",
  "**There is meaningful combined improvement versus B17.** Three pairs improve total net and maximum drawdown in both windows and both TP models: age8 + two-day-high exit; no-soft-stale + half11; no-soft-stale + removal of the deep funding guard. None meets the unchanged monthly screen. That is not the same as saying the combinations do nothing.", "",
  "**Most relevant loss-reduction lead: age8 + two-day-high exit.** Recent resting-touch winning dollars rise from $57,130 to $62,655 while losing dollars fall from $33,009 to $25,546. Completed net improves about $12,988; end-inventory/unfinished cash explains another $3,351 of its $16,340 total uplift. Under close-confirmed TP it also improves net and DD versus B17, but June is $2,108 worse. Older totals improve $14,499 touch / $15,705 confirmed, with lower DD in both, yet some older months sacrifice about $5k. Its recent touch drawdown24.35% is worse than age8 alone20.35%, although slightly better than B17's24.69%.", "",
  "**Strongest recent balanced profit/DD pair: age8 + no deep funding guard.** It beats both singles on recent net and DD in both TP models, but older touch DD rises to35.33% versus B17's28.17%. Recent touch losing dollars also rise by$2,503: its gain comes from larger winning dollars, not less bleeding. The no-soft-stale + no-guard version passes aggregate baseline net/DD in all four cases, but loses older profit versus no-soft-stale alone and worsens recent July touch by$2,410.", "",
  "**Defensive alternative: no-soft-stale + half11.** Lower DD and higher net than B17 in all four cases, but it gives up net profit versus no-soft-stale alone in all four. This is a profit/risk exchange, not free added alpha. Adding MFI weekly half-exits to either TP leg reduces recent net versus the TP leg alone in both execution models; retain that negative interaction rather than stacking individually attractive rules automatically.", "",
  "Raw `forcedCloses` includes discretionary research high exits, even profitable ones. For age8 + high, recent touch has31 new high exits but original hard/emergency/funding exits fall from10 to8; confirmed has34 high exits and original forced exits fall from12 to7. These are not39/41 catastrophic flattens. The full occupancy and cooldown costs remain in the earnings.", "",
  "## Scope and selection", "",
  "This is a long-ladder comparison, not a pool of standalone $10k indicator trades, paused short strategies or shared-account returns. The two TP legs are alternative designs: they are never combined with each other. Each is paired separately with four existing mechanisms. No threshold optimization, three-leg portfolio, extra time filter or change to strategy code was introduced.", "",
  "Selection was frozen before any pair outcomes: eight-hour/no-soft-stale profit-taking leads; half11 as an explicitly defensive (not standalone profit-winning) control; removal of the deep funding guard for its four-case aggregate net/DD record; MFI/weekly half-exit for positive net across four cases; two-day-high 1% stale exit as the strongest new L12 recent minimum-model lead. Structure8, other high horizons, hot-RSI TP cooldown removal and broad risk-control removals remain documented, not silently declared dead or added after seeing pair results.", "",
  "### Do not confuse raw recent leaders with safe winners", "",
  "The following preserved component figures end **September 8, 17:47 UTC**, not the September 10 refreshed combination cutoff. Values are net / DD. These controls are diagnostics, not recommendations to dismantle risk gates.", ""];
const archive: R[] = read(`${d.components}/results.json`);
const archiveGet = (p: string, w: string, tp: string) => archive.find(x => x.policy === p && x.window === w && x.tp === tp)!;
const historical: Array<[string, string]> = [["B17", "Current B17"], ["B00", "Bare timer ladder, TP1.4%, no forced exits/gates"], ["B01", "Bare ladder + 0.3% alternative adds"], ["B02", "B01 + 4h soft-stale"], ["B03", "B02 + emergency exit only"], ["minus_tp_cooldown", "Current minus hot-RSI TP cooldown"], ["minus_sr_partial", "Current minus S/R partials"]];
report.push(table(["Setup", "Recent touch", "Recent confirmed", "Older touch", "Older confirmed"], historical.map(([p, label]) => [label,
  ...["hl_extended", "published_window"].flatMap(w => ["resting_touch", "close_confirmed"].map(tp => netDd(archiveGet(p, w, tp))))])), "",
  "These are not the obsolete $65k/$82k pre-repair models. They use the causal B17 component study. Bare setups' high recent totals conceal severe older-period tail exposure. The older touch TP-cooldown-removal loss is about $8.4k versus B17; keeping it outside this small pair set is not a claim its entire family is disproven.", "",
  "## Aligned replay contract", "",
  "Recent: **2026-05-17 20:43 → 2026-09-10 05:08 UTC**. Older: **2025-07-01 00:00 → 2026-08-19 21:32 UTC**. Each starts flat at $32,000; $800 × 1.35, maximum 11 rungs, current 0.3%-OR-timer adds, current guards/SR/forced exits except named legs. Periods overlap and have already been researched repeatedly: they are not independent holdouts.", "",
  "Closed source bars only; market decisions fill at the next minute's open. Resting-touch uses only a previously armed target, not a target invented after observing that minute's high. Close-confirmed is an alternate exit-path sensitivity, not guaranteed worst-case performance. Original **0.055% fees per side** remain; no estimated maker savings are added. Actual funding cash flows, live tick/lot/queue/partial-fill behavior, shared collateral, liquidation and manual pauses are not certified.", "",
  "W/L are completed ladder episodes, including their partial PnL and fees. Losing dollars are shown negative. **Net = winning dollars + losing dollars + final open mark + unfinished-episode partial cash.** The open ladder is never omitted. Max DD includes bar-low marking. Rounded tables can differ by a dollar; raw CSV retains precision.", "",
  "## 1. Singles side by side — refreshed recent window", "");
for (const tp of ["resting_touch", "close_confirmed"]) {
  report.push(`### ${tp}`, "", table(["Setup", "W / L", "Winning $", "Losing $", "Open", "Unfinished partial", "Net", "Δ B17", "Max DD"], ["baseline", ...singles].map(p => {
    const x = get(p, "hl_extended", tp), m = x.metrics, b = get("baseline", "hl_extended", tp).metrics;
    return [label(p), `${m.profitableEpisodes} / ${m.losingEpisodes}`, money(m.grossWin), money(-m.grossLoss), money(m.openPnl), money(m.unfinishedPartialPnl), money(m.totalPnl), delta(m.totalPnl - b.totalPnl), n(m.maxDrawdownPct, 2) + "%"];
  })), "");
}
report.push("## 2. Eight combinations — versus baseline AND each individual leg", "",
  "Sorted by the smaller recent net uplift across the two TP models, not the single best-looking run. A positive baseline delta alone does not establish a useful combination: it can simply inherit one strong leg while the second leg subtracts money.", "");
for (const tp of ["resting_touch", "close_confirmed"]) {
  report.push(`### ${tp}`, "", `Baseline: ${netDd(get("baseline", "hl_extended", tp))}.`, "",
    table(["Pair", "W / L", "Winning $", "Losing $", "Net", "Max DD", "Δ baseline", "Δ TP leg alone", "Δ other leg alone"], pairs.map(p => {
      const x = get(p, "hl_extended", tp), m = x.metrics, [a, b] = p.split("__");
      return [label(p), `${m.profitableEpisodes} / ${m.losingEpisodes}`, money(m.grossWin), money(-m.grossLoss), money(m.totalPnl), n(m.maxDrawdownPct, 2) + "%",
        delta(m.totalPnl - get("baseline", "hl_extended", tp).metrics.totalPnl), delta(m.totalPnl - get(a, "hl_extended", tp).metrics.totalPnl), delta(m.totalPnl - get(b, "hl_extended", tp).metrics.totalPnl)];
    })), "");
}
report.push("### Recent interaction and unfinished inventory", "", "Interaction = pair uplift − (first single uplift + second single uplift). This is occupancy/price-path interaction, not an independent alpha estimate or a significance test.", "",
  table(["Pair / model", "Interaction $", "Open mark", "Unfinished partial", "TP-affected episodes", "Size episodes", "Actual cut episodes", "TP/other overlap"], pairs.flatMap(p => ["resting_touch", "close_confirmed"].map(tp => {
    const x = get(p, "hl_extended", tp), c = comparisons.find(c => c.name === x.name)!;
    return [`${label(p)} / ${tp}`, delta(c.interactionNet), money(x.metrics.openPnl), money(x.metrics.unfinishedPartialPnl), x.counts.targetEpisodes, x.counts.sizeEpisodes, x.counts.reductionEpisodes, x.counts.overlapTargetOther];
  }))), "",
  "The guard-removal leg has no separate exact intervention counter in this wrapper. It is not assigned invented counts: its single is marked n-unmeasured, and pair counts cover the TP leg only. MFI/high cut counts are reported separately; numerous TP deferrals cannot manufacture a large sample for a rare half-exit. Source-delay repetitions are not extra independent trades.", "",
  "## 3. Older-window risk and profit — every single and pair", "",
  table(["Setup", "Touch net / DD", "Touch Δ baseline", "Confirmed net / DD", "Confirmed Δ baseline"], ["baseline", ...singles, ...pairs].map(p => [label(p),
    netDd(get(p, "published_window", "resting_touch")), delta(get(p, "published_window", "resting_touch").metrics.totalPnl - get("baseline", "published_window", "resting_touch").metrics.totalPnl),
    netDd(get(p, "published_window", "close_confirmed")), delta(get(p, "published_window", "close_confirmed").metrics.totalPnl - get("baseline", "published_window", "close_confirmed").metrics.totalPnl)])), "",
  "## 4. All months for the five highest-ranked recent results", "",
  "Each cell is monthly MTM **/ delta versus the baseline in that same row**. Includes the change in open inventory, not just close-date PnL. Boundary months are partial. Complete monthly W/L, winning/losing dollars and realized cash for every setup/model/phase are in `output/monthly.csv`.", "");
for (const w of ["hl_extended", "published_window"]) for (const tp of ["resting_touch", "close_confirmed"]) {
  const b = get("baseline", w, tp); report.push(`### ${w} / ${tp}`, "", table(["UTC month", "Baseline MTM", ...topFive.map(label)], b.metrics.monthly.map((m: R) => [m.month, money(m.mtmPnl), ...topFive.map(p => {
    const v = get(p, w, tp).metrics.monthly.find((x: R) => x.month === m.month)!; return `${money(v.mtmPnl)} / ${delta(v.mtmPnl - m.mtmPnl)}`;
  })])), "");
}
report.push("## 5. Invisible upside and loss contribution", "",
  "Same-entry episodes are matched; removed baseline entries and replacement entries are reported separately. Matching is a historical contribution identity, not proof that intervening at a particular point would preserve the rest of the old path.", "",
  table(["Pair / model", "Matched Δ", "Removed baseline net", "Replacement net", "End/unfinished Δ", "Δ total", "Δ TP cycles", "Δ forced closes"], pairs.flatMap(p => ["resting_touch", "close_confirmed"].map(tp => {
    const x = get(p, "hl_extended", tp), b = get("baseline", "hl_extended", tp), c = comparisons.find(c => c.name === x.name)!, a = c.attribution;
    return [`${label(p)} / ${tp}`, delta(a.matchedDelta), money(a.removedNet), money(a.replacementNet), delta(a.openAndUnfinishedDelta), delta(c.delta.pnlDelta), x.metrics.tpCycles - b.metrics.tpCycles, x.metrics.forcedCloses - b.metrics.forcedCloses];
  }))), "",
  "Identity: matched Δ − removed net + replacement net + end/unfinished Δ = total net Δ. A loss closed earlier is not assumed to save the old flatten amount; subsequent entries and the surviving inventory are replayed.", "",
  "## 6. Source-arrival sensitivity", "",
  "Only new MFI+weekly inputs and the new high reference are delayed by 60 seconds. Existing HL consumers retain canonical timing. The current observed HYPE decision price is not artificially delayed. No new funding-delay experiment or fill-delay parameter was introduced.", "",
  table(["Setup / model", "Primary net / DD", "+60s source net / DD", "Net change"], all.filter(x => x.phase === "source60").map(x => {
    const p = get(x.policy, "hl_extended", x.tp); return [`${label(x.policy)} / ${x.tp}`, netDd(p), netDd(x), delta(x.metrics.totalPnl - p.metrics.totalPnl)];
  })), "",
  "## 7. Qualification — thresholds not changed after results", "",
  "Full screen: recent net uplift ≥$1,000 in both models; older uplift ≥0; no DD increase; every monthly MTM delta ≥−$250; ≥20 recent intervention episodes; no modeled nonpositive equity. Any pass is research-only and still needs forward observation. The half-exit interventions remain a small, conditional sample even when the paired TP leg has many observations.", "",
  table(["Setup", "Full screen", "Beats both constituent net/DD in all four cases", "Failure reasons"], [...singles, ...pairs].map(p => { const r = ranking.find(r => r.policy === p)!; return [label(p), r.passesPrimaryScreen ? "PASS (research only)" : "FAIL", p.includes("__") ? r.beatsBothPartsAllFour ? "YES" : "NO" : "n/a", r.failures.join("; ")]; })), "",
  "## Exact mechanism and interaction notes", "",
  "- **Eight-hour leg:** F06 one-way permission to keep 1.4% when ordinary 4h soft-stale would first reduce TP to0.5%, released by8h oldest surviving rung. Partial exits do not reset original entry timestamps. Once released, permission cannot restart within that episode; ordinary soft-stale predicate resumes. Not the same as unconditionally holding every trade8h.",
  "- **No-soft-stale:** keeps normal target; hard flatten, emergency, S/R partials, funding-spike exit and all existing entry gates remain active. It does not mean 'never close a loss'.",
  "- **Half11:** reduce the requested next-depth11 clip by50% after the original full-size affordability and outer gates pass. Both timer and real price-drop entries are covered; lower rungs, clocks, IDs and post-S/R behavior are unchanged.",
  "- **No deep funding guard:** only that negative-funding/deep time-add restriction is disabled. Existing support-reopen exception becomes redundant; this is not a second added buy signal. No short, portfolio leverage or other regime gate is changed.",
  "- **MFI weekly half-exit:** first deep>=9, gross−3% crossing; assess exactly60minutes later in the same episode while depth>=9. Closed30m MFI14<=20 plus completed1h price below actual UTC-week VWAP and ROC5<=0. Unknown context rejects only experimental action. Pro-rata50% next-open cut; no further episode adds. No second PnL requirement was invented. Original exits/SR partials take priority.",
  "- **Near-high exit:** any depth, oldest surviving rung>=4h, current closed-minute price within1% of the past2880 fully closed minutes' high. Full next-open exit, no PnL floor, normal4–8h forced cooldown. It can pre-empt the 8h target extension; it is not a same-wick exit or a hindsight peak sale.", "",
  "## Reproduction and validation", "",
  `Job: \`${path.basename(dir)}\`. Frozen card: [winning-ladder-combinations-2026-09-11.json](../research-inputs/winning-ladder-combinations-2026-09-11.json).`, "",
  "```powershell", "npx ts-node scripts/ladder-combination-tests.ts", "npx ts-node scripts/hype-ladder-combination-study.ts plan research-inputs/winning-ladder-combinations-2026-09-11.json",
  `npx ts-node scripts/hype-ladder-combination-study.ts run ${path.basename(dir)}`, "npx ts-node scripts/ladder-combination-target-audit-tests.ts", `npx ts-node scripts/ladder-combination-review.ts ${path.basename(dir)}`, "```", "",
  "The run command intentionally refuses to overwrite an already-claimed/completed job. The verifier independently reconstructs raw high, MFI/weekly context, target clocks, sizes/fills, pro-rata cuts/no-rebuild, minute equity/DD, fees, monthly accounting and comparison identities. Canonical engine, production code, live configs and state remain pinned. Raw large outputs stay local under the job directory.", "",
  "```json", JSON.stringify(read(path.join(dir, "verification.json")), null, 2), "```", "",
  "Audit corrections: the original pinned verifier reused an F06 assumption that every market full-close decision precedes TP arm(). L13 near-high research closes are scheduled after arm(), so it incorrectly omitted those bars' legitimate target observations. Also, this wrapper's compressed target-price telemetry omits same-price rearming after pro-rata cuts. The final reviewer reconstructs every arm independently from all-minute target rules and quiesce/fill events, rather than pretending the compressed price changes are a complete arm ledger. Regressions cover ordinary/research closes, pending-cutoff cases and unchanged-price post-partial rearming. These are verification/telemetry limitations, not changes to trading decisions. Audit source hashes are in the verification receipt; original job pins, economic results, policies and engine were not edited or rerun to change outcomes. Do not use the superseded initial verifier for this composite exit path.", "",
  "Side observations: none of this proves global optimality, makes source streams interchangeable, or exhausts other entry/exit combinations. Only the eight named pairs were tested. No live deployment, commit or push is part of this research pass.", "");
console.log(report.join("\n"));
