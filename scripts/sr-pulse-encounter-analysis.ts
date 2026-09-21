import { blockInterval, direction, mean, month, type Control, type Encounter, type StudySpec } from "./sr-pulse-encounters";

export function summarizeStudy(events: Encounter[], controls: Control[], spec: StudySpec) {
  const common = events.filter(e => e.primaryHealthy && e.future4h), split = Date.parse(spec.split);
  const controlByAt = new Map(controls.map(c => [c.frame.at, c]));
  const stats = (rows: Encounter[], sign: number) => {
    const vals = rows.map(e => sign * e.future4h!.retPct).sort((a, b) => a - b);
    return { n: rows.length, meanPct: mean(vals), medianPct: vals.length ? (vals[Math.floor((vals.length - 1) / 2)] + vals[Math.floor(vals.length / 2)]) / 2 : null,
      configuredMeanPct: vals.length ? mean(vals)! - spec.configuredRoundTripCostPct : null,
      stressMeanPct: vals.length ? mean(vals)! - spec.stressRoundTripCostPct : null,
      delayedStressMeanPct: rows.length ? mean(rows.map(e => sign * e.future4h!.delayedRetPct))! - spec.stressRoundTripCostPct : null,
      mean1hPct: mean(rows.filter(e => e.future1h).map(e => sign * e.future1h!.retPct)),
      meanRelativeVolume15: mean(rows.filter(e => e.decision?.relativeVolume15 != null).map(e => e.decision!.relativeVolume15!)),
      mfePct: mean(rows.map(e => sign > 0 ? e.future4h!.highPct : -e.future4h!.lowPct)),
      maePct: mean(rows.map(e => sign > 0 ? e.future4h!.lowPct : -e.future4h!.highPct)) };
  };
  const cohorts: Record<string, unknown>[] = [], monthly: Record<string, unknown>[] = [], candidates: Record<string, any>[] = [];
  for (const side of ["support", "resistance"] as const) {
    const sideRows = common.filter(e => e.side === side);
    for (const [name, rows, sign] of [
      ["sr_only", sideRows, direction(side, "hold")],
      ...["hold", "break", "unresolved"].map(r => [`price_only_${r}`, sideRows.filter(e => e.response === r), direction(side, r === "break" ? "break" : "hold")]),
      ...["with", "against", "neutral"].map(p => [`pulse_only_at_sr_${p}`, sideRows.filter(e => e.pressure === p), direction(side, "hold")]),
    ] as Array<[string, Encounter[], number]>) cohorts.push({ side, cohort: name, sign, ...stats(rows, sign) });

    for (const response of ["hold", "break"] as const) for (const pulse of ["with", "against"] as const) {
      const id = `${side}_${response}_${pulse}`, sign = direction(side, response);
      const chosen = sideRows.filter(e => e.response === response && e.pressure === pulse);
      const complement = sideRows.filter(e => e.response === response && e.pressure !== pulse);
      const pairs = chosen.filter(e => e.controlAt !== null && controlByAt.get(e.controlAt)?.future4h);
      const difference = (a: Encounter[], b: Encounter[]) => a.length && b.length ? mean(a.map(e => sign * e.future4h!.retPct))! - mean(b.map(e => sign * e.future4h!.retPct))! : null;
      const paired = (a: Encounter[]) => mean(a.map(e => sign * (e.future4h!.retPct - controlByAt.get(e.controlAt!)!.future4h!.retPct)));
      const halves = [false, true].map(later => {
        const keep = (e: Encounter) => (e.decisionAt >= split) === later;
        const a = chosen.filter(keep), b = complement.filter(keep), p = pairs.filter(keep);
        return { half: later ? "later" : "earlier", ...stats(a, sign), complementN: b.length, priceOnlyDeltaPct: difference(a, b), matchedN: p.length, matchedDeltaPct: paired(p) };
      });
      const months = [...new Set(sideRows.map(e => month(e.decisionAt)))].sort().map(m => {
        const a = chosen.filter(e => month(e.decisionAt) === m), b = complement.filter(e => month(e.decisionAt) === m), p = pairs.filter(e => month(e.decisionAt) === m);
        return { id, month: m, ...stats(a, sign), complementN: b.length, priceOnlyDeltaPct: difference(a, b), matchedN: p.length, matchedDeltaPct: paired(p) };
      });
      const ci = blockInterval(chosen.map(e => ({ at: e.decisionAt, value: sign * e.future4h!.retPct })), complement.map(e => ({ at: e.decisionAt, value: sign * e.future4h!.retPct })), spec);
      const pairCi = blockInterval(pairs.map(e => ({ at: e.decisionAt, value: sign * (e.future4h!.retPct - controlByAt.get(e.controlAt!)!.future4h!.retPct) })), pairs.map(e => ({ at: e.decisionAt, value: 0 })), spec);
      const s = stats(chosen, sign), bad: string[] = [];
      if (chosen.length < spec.minimumCandidateN) bad.push("candidate_n");
      if (complement.length < spec.minimumCandidateN) bad.push("complement_n");
      if (halves.some(h => h.n < spec.minimumHalfN || h.complementN < spec.minimumHalfN)) bad.push("half_n");
      if (months.filter(m => m.n >= spec.minimumMonthN && m.complementN >= spec.minimumMonthN).length < spec.minimumPopulatedMonths) bad.push("month_n");
      if (pairs.length < spec.minimumMatchedN || halves.some(h => h.matchedN < spec.minimumMatchedHalfN)) bad.push("matched_n");
      if (s.stressMeanPct === null || s.stressMeanPct <= 0 || s.delayedStressMeanPct === null || s.delayedStressMeanPct <= 0) bad.push("cost_or_delay");
      if (halves.some(h => h.priceOnlyDeltaPct === null || h.priceOnlyDeltaPct <= 0)) bad.push("price_lift_half_stability");
      if (halves.some(h => h.matchedDeltaPct === null || h.matchedDeltaPct <= 0)) bad.push("sr_lift_half_stability");
      if (months.some(m => m.n >= spec.minimumMonthN && m.complementN >= spec.minimumMonthN && m.priceOnlyDeltaPct! < spec.worstMonthlyDeltaFloorPct)) bad.push("price_lift_month_stability");
      if (months.some(m => m.matchedN >= spec.minimumMonthN && m.matchedDeltaPct! < spec.worstMonthlyDeltaFloorPct)) bad.push("sr_lift_month_stability");
      if (ci.low === null || ci.low <= 0) bad.push("price_lift_cluster_interval");
      if (pairCi.low === null || pairCi.low <= 0) bad.push("sr_lift_cluster_interval");
      candidates.push({ id, side, response, pulse, sign, ...s, complementN: complement.length,
        priceOnlyDeltaPct: difference(chosen, complement), priceOnlyInterval: ci, matchedN: pairs.length,
        matchedDeltaPct: paired(pairs), matchedInterval: pairCi, halves, failures: bad, meritsPortfolioReplay: bad.length === 0 });
      monthly.push(...months);
      cohorts.push({ side, cohort: id, sign, ...s });
    }
  }
  const coverage = [...new Set(events.map(e => month(e.at)))].sort().map(m => {
    const rows = events.filter(e => month(e.at) === m);
    return { month: m, encounters: rows.length, responseKnown: rows.filter(e => e.decision).length,
      primaryHealthy: rows.filter(e => e.primaryHealthy).length, labeled4h: rows.filter(e => e.future4h).length,
      common: rows.filter(e => e.primaryHealthy && e.future4h).length,
      healthyBookSequence: rows.filter(e => e.bookPersistence !== "unknown").length,
      matched: rows.filter(e => e.controlAt !== null).length };
  });
  const modifiers: Record<string, unknown>[] = [];
  for (const c of candidates) for (const book of ["bid", "ask", "mixed", "unknown"]) {
    const rows = common.filter(e => e.side === c.side && e.response === c.response && e.pressure === c.pulse && e.bookPersistence === book);
    modifiers.push({ id: c.id, book, ...stats(rows, c.sign), descriptiveOnly: true });
  }
  for (const c of candidates) for (const volume of ["above_prior", "below_prior", "unknown"]) {
    const rows = common.filter(e => e.side === c.side && e.response === c.response && e.pressure === c.pulse &&
      (e.decision?.relativeVolume15 == null ? "unknown" : e.decision.relativeVolume15 >= 1 ? "above_prior" : "below_prior") === volume);
    modifiers.push({ id: c.id, volume, ...stats(rows, c.sign), descriptiveOnly: true });
  }
  return { events: events.length, commonN: common.length, controls: controls.length, coverage, cohorts, candidates, monthly, modifiers,
    passing: candidates.filter(c => c.meritsPortfolioReplay).map(c => c.id), strategyPnlCertified: false };
}
