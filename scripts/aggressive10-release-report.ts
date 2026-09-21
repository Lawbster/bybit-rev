/** Render only verified results. Emits an apply_patch document, never changes live files. */
import fs from "fs";
import { OUT, CARD_FILE, read, type R } from "./aggressive10-release-shared";
import assert from "assert/strict";
const file = "research/codex-astra-aggressive10-release-parity-findings-2026-09-11.md";
const card = read(CARD_FILE), p = read(`${OUT}/parity/verification.json`), v = read(`${OUT}/scenarios/verification.json`);
assert(p.passed && p.inputsUnchanged && v.passed && v.inputsUnchanged && v.cases === 44);
assert(!fs.existsSync(file), "Refuse overwrite of findings");
const rs: R[] = read(`${OUT}/scenarios/results.json`), parity: R[] = read(`${OUT}/parity/results.json`);
const current = card.initialEquities[1];
const usd = (n: number) => `${n <= -.5 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(2)}%`;
const scenarios = [
  { id: "standard_taker", tp: "close_confirmed", label: "Standard fees / close-confirmed" },
  { id: "standard_taker", tp: "resting_touch", label: "Standard fees / resting-touch" },
  ...card.makerScenarios.map((s: R) => ({ id: s.id, tp: "resting_touch", label: s.id }))
];
function row(window: string, scenario: R, equity: number, baseline: boolean, sensitivity = "none"): R {
  const r = rs.find(r => r.model === `${window}-${scenario.tp}` && r.scenario === scenario.id && r.equity === equity
    && (r.policy === "baseline") === baseline && r.sensitivity === sensitivity);
  assert(r); return r;
}
function delta(a: R, b: R) {
  return { net: a.metrics.totalPnl - b.metrics.totalPnl, dd: a.metrics.maxDrawdownPct - b.metrics.maxDrawdownPct,
    worstMonth: Math.min(...a.metrics.monthly.map((m: R) => m.mtmPnl - b.metrics.monthly.find((x: R) => x.month === m.month).mtmPnl)) };
}
const primary = rs.filter(r => r.policy !== "baseline" && r.sensitivity === "none");
const improvements = primary.filter(a => { const b = rs.find(b => b.policy === "baseline" && b.equity === a.equity && b.model === a.model && b.scenario === a.scenario && b.sensitivity === a.sensitivity)!;
  const d = delta(a, b); return d.net > 0 && d.dd < 0; });
const drawdownWorse = primary.filter(a => { const b = rs.find(b => b.policy === "baseline" && b.equity === a.equity && b.model === a.model && b.scenario === a.scenario && b.sensitivity === a.sensitivity)!;
  return delta(a, b).dd > 1e-8; });
const mixed = scenarios.find(s => s.id === "half_maker_then_market")!;
const bRecent = row("hl_extended", mixed, current, true), aRecent = row("hl_extended", mixed, current, false);
const out: string[] = [
  "# Aggressive10 release checkpoint: policy parity and maker scenarios",
  "", "Date: September 11, 2026. Production commit tested: `4029d80`. Local research only.", "", "## TL;DR", "",
  `- **Policy parity passed:** eight exact archived outputs using production pure decisions; eight further exact controls with the fee-study engine disabled. 52 replay runs total, not 52 independent market samples.`,
  `- Aggressive10 improves net **and** drawdown in **${improvements.length}/${primary.length}** paired main comparisons. At the ${usd(current)} capital anchor, recent half-maker scenario: B17 ${usd(bRecent.metrics.totalPnl)} / ${pct(bRecent.metrics.maxDrawdownPct)} DD versus aggressive10 ${usd(aRecent.metrics.totalPnl)} / ${pct(aRecent.metrics.maxDrawdownPct)}.`,
  `- Drawdown is **worse in ${drawdownWorse.length}/${primary.length} paired main comparisons**. This is not an unconditional engineering/economic green light or a monthly-screen waiver. Maker shares are assumptions; no historical queue/two-second fill proof. No live config/state changes, activation, commit or push.`,
  "", "## Scope and dates", "",
  "B17 is the current policy with aggressive10 disabled. Candidate is exactly `age10__minus_deep_stress__minus_tp_cooldown`: unchanged $800 x1.35/max11, one-way soft-stale deferral to oldest-surviving age10h, separate age4h two-day-high exit within1%, disabled deep funding timer guard and hot-RSI TP cooldown. All other modeled gates/exits/SR actions remain. High-exit cooldown stays the inherited4–8h boundary rule.", "",
  "- Older: **2025-07-01 00:00 through 2026-08-19 21:32 UTC**.",
  "- Recent: **2026-05-17 20:43 through 2026-09-10 05:08 UTC**.",
  "- Each run starts **flat**, independently, at $32,000 or **$27,870.93**. The latter is the user-reported VPS wallet equity at September11 18:52:58 UTC; it is not an import of the currently open eleven-rung ladder.",
  "- Original dates retained intentionally. These are overlapping, previously mined windows—not new holdouts. No missing older HL context is fabricated.",
  "- Net = realized plus final marked open PnL, after modeled fees; DD includes adverse minute lows before unknown TP/low ordering. No annualization or claim of realized live dollars.",
  "", "## Verified parity", "",
  `Exact archived result digests, accounting, episodes and headline metrics reproduced in all eight cases. Production TP decisions checked ${parity.reduce((n, r) => n + r.targetChecks, 0).toLocaleString('en-US')} times; ${parity.reduce((n, r) => n + r.highFires, 0)} high-exit decisions across overlapping cases. All fired high windows plus periodic samples were independently reconstructed with the production 2,880-bar function (${parity.reduce((n, r) => n + r.fullWindowChecks, 0)} full-window checks). Cooldown compared at every high-exit fill.`, "",
  "The derived maker engine is an asserted 14-replacement source delta; when its option is absent it reproduces the eight original digests exactly. The canonical replay and production executor/coordinators are unchanged.",
  "", "## Execution and fee assumptions", "",
  "- Entry, forced exit, S/R partial, market/native-fallback class: **0.055%**. Assumed maker-filled exit quantity: **0.020%**. These are current config rates, not a new exchange fee-tier verification.",
  "- Prior resting TP only; long maker limit rounded upward using assumed tick0.01. No newly armed target receives an earlier high from the same minute. Closed price is a postability proxy, not a recovered historical best bid.",
  "- Three separate scenarios: 100% maker fill on prior-limit touch; 50% pro-rata maker fill then residual market; 0% maker fill then full market. Residual market price is the next minute OPEN even after a reversal—not the best subsequent price.",
  "- The next-minute fallback is a coarse sensitivity, **not** a simulation of the live two-second grace, order queue, cancellation latency or native-trigger race. Native market fills are not separately reconstructible here. Scenarios are neither probabilities nor certified upper/lower bounds.",
  "- Maker prefix keeps surviving rung identities/add clock. No extra add is permitted before its residual fallback. Entry fees are allocated proportionally once; open inventory retains a taker exit reserve. No blanket average fee-saving credit.",
  "- Original synthetic fractional quantities retained; historical quantity/tick rule changes, spreads/impact, funding settlements, shared short equity and actual liquidation/maintenance-margin mechanics are not certified.",
  "", "## Paired net / drawdown", ""
];
for (const equity of card.initialEquities) for (const w of ["published_window", "hl_extended"]) {
  out.push(`### ${w === "hl_extended" ? "Recent" : "Older"}; independent ${usd(equity)} start`, "",
    "| Scenario | B17 net / DD | Aggressive10 net / DD | Net delta | DD change pp | Worst month delta |",
    "|---|---:|---:|---:|---:|---:|");
  for (const s of scenarios) { const a = row(w, s, equity, false), b = row(w, s, equity, true), d = delta(a, b);
    out.push(`| ${s.label} | ${usd(b.metrics.totalPnl)} / ${pct(b.metrics.maxDrawdownPct)} | ${usd(a.metrics.totalPnl)} / ${pct(a.metrics.maxDrawdownPct)} | ${usd(d.net)} | ${d.dd.toFixed(2)} | ${usd(d.worstMonth)} |`);
  } out.push("");
}
out.push("## Winning and losing dollars: current-equity half-maker scenario", "",
  "Episodes combine maker prefixes and S/R partials with the final close. Winning/losing dollars below are sums of **net-after-fee** episode outcomes, not gross-before-fee trading profits.", "",
  "| Period / policy | Wins | Win dollars | Losses | Loss dollars | Average loss | Open + unfinished PnL | Modeled fees incl. open reserve |",
  "|---|---:|---:|---:|---:|---:|---:|---:|");
for (const w of ["published_window", "hl_extended"]) for (const baseline of [true, false]) {
  const r = row(w, mixed, current, baseline), m = r.metrics;
  out.push(`| ${w === "hl_extended" ? "Recent" : "Older"} / ${baseline ? "B17" : "Aggressive10"} | ${m.profitableEpisodes} | ${usd(m.grossWin)} | ${m.losingEpisodes} | ${usd(-m.grossLoss)} | ${usd(-m.grossLoss / m.losingEpisodes)} | ${usd(m.openPnl + m.unfinishedPartialPnl)} | ${usd(r.audit.modeledFees)} |`);
}
out.push("", "## Monthly net: every main scenario", "",
  "Each cell is **B17 / aggressive10**, in dollars; current-equity independent starts. Monthly marked PnL includes the changing open inventory, not just close receipts. Partial first/last months follow the exact windows above.", "");
for (const w of ["published_window", "hl_extended"]) {
  out.push(`### ${w === "hl_extended" ? "Recent" : "Older"} monthly`, "",
    "| Month | Standard confirmed B/A | Standard touch B/A | Full-maker B/A | Half-maker B/A | Market-fallback B/A |",
    "|---|---:|---:|---:|---:|---:|");
  for (const m of row(w, mixed, current, true).metrics.monthly) {
    out.push(`| ${m.month} | ` + scenarios.map(s => {
      const b = row(w, s, current, true).metrics.monthly.find((x: R) => x.month === m.month).mtmPnl;
      const a = row(w, s, current, false).metrics.monthly.find((x: R) => x.month === m.month).mtmPnl;
      return `${usd(b)} / ${usd(a)}`;
    }).join(" | ") + " |");
  } out.push("");
}
out.push("## Frozen timing / availability sensitivities", "",
  "Recent window, current-equity start, half-maker scenario. The first delays **only high-rule market fills** by one additional minute. The second withholds high-context readiness for the first minute at each4h boundary, then restores the historical minute on the next evaluation: blocks candidate adds/high exits only; ordinary exits remain. Synthetic stresses, not measured outages. B17 is rerun identically for each comparison.", "",
  "| Sensitivity | B17 net / DD | Aggressive10 net / DD | Candidate delta vs no stress | High exits |",
  "|---|---:|---:|---:|---:|");
for (const sensitivity of ["none", ...card.sensitivities]) {
  const a = row("hl_extended", mixed, current, false, sensitivity), b = row("hl_extended", mixed, current, true, sensitivity);
  out.push(`| ${sensitivity} | ${usd(b.metrics.totalPnl)} / ${pct(b.metrics.maxDrawdownPct)} | ${usd(a.metrics.totalPnl)} / ${pct(a.metrics.maxDrawdownPct)} | ${usd(a.metrics.totalPnl - aRecent.metrics.totalPnl)} | ${a.highFires} |`);
}
out.push("", "## Decision and limitations", "",
  "**Closed-minute production-policy parity: PASS. Independent scenario accounting: PASS. Exact live exchange execution: NOT CERTIFIED by candle data. Complete historical acceptance screen: still FAIL.** The prior L15 monthly floor remains -$250 per month relative to B17; inspect the worst-month column above. Aggregate improvement is not permission to erase those failures or declare the lead LIVE_QUALIFIED.", "",
  "The material new finding is execution sensitivity: the previously observed all-case drawdown advantage does not survive partial/no-maker fallback assumptions. Increased net remains a possible trade-off, not dominance. These scenario changes include target rounding/postability, fallback price and subsequent inventory/entry timing, so the difference from the original replay is not attributable to fee rate alone. A fixed-path fee saving is separately recorded in each audit; it must not be confused with total strategy uplift.", "",
  "The existing crash suite passed again (18 cases,10 actual child-process exits,4 timestamp-evidence rejection checks); policy/context/profile tests,10 maker-scenario unit cases, root and VPS no-emit TypeScript checks passed. Unit cases include adverse fallback, prefix conservation and fees, no intervening add, pending at end, future-prefix invariance, prior-target-only execution, price rounding and unchanged market fees on emergency exits.", "",
  "No live strategy, config, state, executor or coordinator was edited for this study. The existing carry-in ladder is not migrated to aggressive10. This report does not authorize arming; any activation remains a separate user decision and the existing profile/runbook safeguards still apply.", "",
  "## Artifacts and reproduction", "",
  "- [Frozen study card](../research-inputs/aggressive10-release-parity-2026-09-11.json)",
  "- [Production-policy parity runner](../scripts/aggressive10-release-parity.ts)",
  "- [Scenario runner](../scripts/aggressive10-release-scenarios.ts)",
  "- [Exact source delta](../scripts/aggressive10-release-maker-source.ts) / [independent fee ledger](../scripts/aggressive10-release-maker-audit.ts) / [unit tests](../scripts/aggressive10-release-maker-tests.ts)",
  `- [Parity verification](../${OUT}/parity/verification.json) / [scenario verification](../${OUT}/scenarios/verification.json) / [all scenario results](../${OUT}/scenarios/results.json)`,
  `- Per-case inventory/event ledgers: numbered files in \`${OUT}/scenarios/\`. Manifests pin local inputs/source and assert no changes at completion.`,
  "- [Original candidate and known costs](AGGRESSIVE-10H-CANDIDATE.md) / [live runbook](../docs/operations/aggressive10-live.md)", "",
  "```text", "npx ts-node scripts/aggressive10-release-maker-tests.ts", "npx ts-node scripts/aggressive10-release-parity.ts", "npx ts-node scripts/aggressive10-release-scenarios.ts", "```", "",
  "Runners deliberately refuse to overwrite existing result directories. Reproduction requires an explicitly separate output directory; do not delete or relabel prior evidence.", ""
);
process.stdout.write(`*** Begin Patch\n*** Add File: ${file}\n${out.join('\n').trimEnd().split('\n').map(s => '+' + s).join('\n')}\n*** End Patch`);
