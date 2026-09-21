/** Descriptive breakdowns of accepted actual-event artifacts. No signal thresholds or replays. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
type R = Record<string, any>;
const root = path.resolve(__dirname, ".."), out = path.resolve(root, process.argv[2] ?? "backtests/hype/hype-tp-hl-event-atlas-2026-09-07-v2");
const json = (f: string) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
const rows = (f: string): R[] => fs.readFileSync(path.join(out, f), "utf8").trim().split(/\r?\n/).map(s => JSON.parse(s));
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const sum = (es: R[]) => es.reduce((s, e) => s + e.bookedPnl, 0);
const money = (es: R[]) => ({ n: es.length, wins: es.filter(e => e.bookedPnl > 0).length, losses: es.filter(e => e.bookedPnl < 0).length,
  winningDollars: es.reduce((s, e) => s + Math.max(0, e.bookedPnl), 0), losingDollars: es.reduce((s, e) => s + Math.min(0, e.bookedPnl), 0), net: sum(es) });
const fmt = (v: number | null, n = 2) => v == null ? "unknown" : v.toFixed(n);
function table(headers: string[], rs: any[][]): string { return [headers, headers.map(() => "---"), ...rs].map(r => `| ${r.join(" | ")} |`).join("\n"); }
async function hash(f: string) { const h = crypto.createHash("sha256"); for await (const c of fs.createReadStream(f)) h.update(c); return h.digest("hex"); }
async function main() {
  const relative = path.relative(path.join(root, "backtests"), out); assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  for (const f of ["descriptive-breakdowns.json", "descriptive-breakdowns.md", "descriptive-validation.json"]) assert.ok(!fs.existsSync(path.join(out, f)), `refuse overwrite ${f}`);
  const validation = json("validation.json"); assert.equal(json("verification.json").passed, true);
  for (const a of validation.artifacts) assert.equal(await hash(path.join(out, a.file)), a.sha256);
  const summary = json("summary.json"), events = rows("events.jsonl"), contexts = rows("event-context.jsonl"), reference = rows("market-reference.jsonl"), sensitivity = rows("availability-sensitivity.jsonl");
  const impact = new Map(contexts.filter(c => c.offsetMinutes === 0).map(c => [c.eventId, c]));
  const all = events.filter(e => e.owner === "ladder" && e.cohort !== "sr_partial"), tp = all.filter(e => e.cohort.startsWith("long_tp")), aligned = tp.filter(e => e.impactAnalysisEligible), ids = new Set(aligned.map(e => e.id));
  const features = ["buyShare15", "bookImbalance05", "assetNativeOiChange15Pct", "assetMarkedOiChange15Pct", "hlClosedReturn15Pct", "fundingPerHour", "vaultDistributableChange15Pct"];
  const profile = (es: R[]) => Object.fromEntries(features.map(f => {
    const values = es.map(e => impact.get(e.id)!.features[f]).filter(v => v != null);
    return [f, { n: values.length, mean: mean(values), aboveNeutralN: values.filter(v => v > (f === "buyShare15" ? .5 : 0)).length }];
  }));
  const monthly = [...new Set(events.map(e => e.month))].sort().map(month => {
    const ms = all.filter(e => e.month === month), parts = events.filter(e => e.month === month && e.cohort === "sr_partial"), mts = aligned.filter(e => e.month === month);
    return { month, allFullCloses: money(ms), tp: money(ms.filter(e => e.cohort.startsWith("long_tp"))), forced: money(ms.filter(e => e.cohort === "long_forced")),
      unclassified: money(ms.filter(e => e.cohort === "long_unclassified")), srPartial: money(parts), tpProfile: profile(mts),
      referenceComparison: Object.fromEntries(features.map(f => {
        const valid = mts.filter(e => impact.get(e.id)!.features[f] != null), pairs: R[] = [];
        for (const e of valid) { const rs = reference.filter(r => r.month === e.month && r.utcHour === e.utcHour && r.features[f] != null); if (rs.length >= 10) pairs.push({ event: impact.get(e.id)!.features[f], reference: mean(rs.map(r => r.features[f])) }); }
        return [f, { n: pairs.length, eventMean: mean(pairs.map(r => r.event)), monthHourReferenceMean: mean(pairs.map(r => r.reference)), difference: mean(pairs.map(r => r.event - r.reference)) }];
      })) };
  });
  const fourHour = summary.fourHourTp.sort((a: R, b: R) => +a.utcFourHourBlock - +b.utcFourHourBlock).map((r: R) => ({ ...r,
    allFullCloseBaseline: money(all.filter(e => String(e.utcFourHourBlock) === r.utcFourHourBlock)) }));
  const profiles = ["long_forced", "sr_partial", "short_native_favorable_untyped", "short_native_adverse_untyped", "short_other"].map(cohort => ({ cohort, ...money(events.filter(e => e.cohort === cohort)), features: profile(events.filter(e => e.cohort === cohort)) }));
  const pairs = sensitivity.filter(r => ids.has(r.eventId) && r.primaryFeatures.buyShare15 != null && r.optimisticFeatures.buyShare15 != null);
  const latency = { pairedN: pairs.length, primaryMeanBuyShare: mean(pairs.map(r => r.primaryFeatures.buyShare15)), optimisticMeanBuyShare: mean(pairs.map(r => r.optimisticFeatures.buyShare15)),
    directionFlips: pairs.filter(r => (r.primaryFeatures.buyShare15 > .5) !== (r.optimisticFeatures.buyShare15 > .5)).length,
    maxAbsoluteShareDifference: Math.max(...pairs.map(r => Math.abs(r.primaryFeatures.buyShare15 - r.optimisticFeatures.buyShare15))) };
  const bookFlow = aligned.filter(e => impact.get(e.id)!.features.buyShare15 != null && impact.get(e.id)!.features.bookImbalance05 != null);
  const jointDescription = { n: bookFlow.length, cells: [true, false].flatMap(buying => [true, false].map(bidHeavy => ({ buying, bidHeavy,
    ...money(bookFlow.filter(e => (impact.get(e.id)!.features.buyShare15 > .5) === buying && (impact.get(e.id)!.features.bookImbalance05 > 0) === bidHeavy)) }))),
    note: "Sign cross-tab within already-realized TPs; not a tested combination, prediction or gating rule." };
  const output = { monthly, fourHour, profiles, latency, jointDescription, missingTiming: tp.filter(e => !e.impactAnalysisEligible).map(e => ({ id: e.id, at: e.eventIso, reason: e.reason, pnl: e.bookedPnl })),
    unclassified: all.filter(e => e.cohort === "long_unclassified").map(e => ({ id: e.id, at: e.eventIso, reason: e.reason, pnl: e.bookedPnl })),
    coverage: { allContextRows: contexts.length, arrivalProvenContextRows: contexts.filter(c => c.quality.historicalArrivalProven).length,
      referenceRows: reference.length, coreReferenceRows: reference.filter(r => r.quality.coreHealthy).length,
      srCandidatesMatched: events.filter(e => e.cohort === "sr_partial" && e.evidence.candidateMatchCount === 1).length } };
  assert.ok(Math.abs(monthly.reduce((s, m) => s + m.allFullCloses.net, 0) - summary.allLongCloses.bookedPnl) < 1e-6);
  assert.equal(jointDescription.cells.reduce((s, c) => s + c.n, 0), jointDescription.n);
  const report = ["# TP/HL atlas: generated descriptive tables", "", "All times UTC. Actual recorded exits under changing configurations; not a replay, entry recommendation or funding-inclusive wallet return.", "",
    "## Monthly full-close baseline beside TPs and forced closes", "",
    table(["Month", "All full closes W/L", "All full-close net $", "TP n", "TP net $", "Forced n", "Forced net $", "Other net $", "S/R partial n", "S/R partial net $"], monthly.map(m => [m.month, `${m.allFullCloses.wins}/${m.allFullCloses.losses}`, fmt(m.allFullCloses.net), m.tp.n, fmt(m.tp.net), m.forced.n, fmt(m.forced.net), fmt(m.unclassified.net), m.srPartial.n, fmt(m.srPartial.net)])), "",
    "## Four-hour TP capture, with all-full-close baseline", "",
    table(["UTC", "TP n", "TP net $", "All full-close net $", "Usable HL TP n", "Approx healthy hours", "TP /100 healthy hours"], fourHour.map((r: R) => [String(r.utcFourHourBlock).padStart(2, "0") + ":00–" + String(+r.utcFourHourBlock + 4).padStart(2, "0") + ":00", r.n, fmt(r.bookedPnl), fmt(r.allFullCloseBaseline.net), r.coreHealthyAlignedN, fmt(r.approximateCoreReferenceHours), fmt(r.tpPer100CoreReferenceHours)])), "",
    "## Every UTC hour", "",
    table(["Hour", "TP n", "TP net $", "Usable HL TP n", "TP /100 healthy hours"], summary.hourlyTp.map((r: R) => [r.utcHour, r.n, fmt(r.bookedPnl), r.coreHealthyTpN, fmt(r.tpPer100CoreReferenceHours)])), "",
    "## TP context versus ordinary-market baseline", "", "Means. The standardized baseline weights month/hour reference cells to the events with valid features. Rates and shares below use their exported raw units.", "",
    table(["Feature", "TP n", "TP mean", "Raw baseline n", "Raw baseline mean", "Month/hour baseline mean"], Object.entries(summary.comparisons.alignedTp).map(([f, r]: [string, any]) => [f, r.event.n, fmt(r.event.mean, 6), r.allClockReference.n, fmt(r.allClockReference.mean, 6), fmt(r.monthHourStandardized.referenceMean, 6)])), "",
    "## Paired lead-in (same events at every checkpoint, means)", "",
    table(["Feature", "n", "-15m", "-10m", "-5m", "-1m", "0m"], Object.entries(summary.pairedLeadIn).map(([f, r]: [string, any]) => [f, r.n, ...[-15, -10, -5, -1, 0].map(o => fmt(r.byOffset.find((x: R) => x.offsetMinutes === o).mean, 6))])), "",
    "Missing-time TPs, unclassified closes, monthly standardized contrasts, non-TP cohort profiles and latency sensitivity are in descriptive-breakdowns.json. See the checked-in method/findings for interpretation."
  ].join("\n") + "\n";
  fs.writeFileSync(path.join(out, "descriptive-breakdowns.json"), JSON.stringify(output, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "descriptive-breakdowns.md"), report);
  const files = ["descriptive-breakdowns.json", "descriptive-breakdowns.md"];
  fs.writeFileSync(path.join(out, "descriptive-validation.json"), JSON.stringify({ passed: true, checkedAt: new Date().toISOString(),
    scriptSha256: await hash(__filename), coreArtifactHashesPass: true, monthlyAccountingAndCrossTabCountsPass: true,
    artifacts: await Promise.all(files.map(async file => ({ file, sha256: await hash(path.join(out, file)) }))) }, null, 2) + "\n");
  console.log(JSON.stringify({ tables: files, latency, jointDescription, coverage: output.coverage }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
