/** Actual-event attribution. Log timestamps remain proxies unless independent fill evidence exists. */
import { epoch, numberOrNull, Row } from "./tp-hl-event-features";

export type EvidenceLine = { file: string; line: number; text: string; day: string | null; hms: string };
export function parseLog(file: string, line: number, text: string): EvidenceLine | null {
  const m = /\[(?:(\d{4}-\d\d-\d\d) )?(\d\d:\d\d:\d\d)\]/.exec(text);
  return m ? { file, line, text, day: m[1] ?? null, hms: m[2] } : null;
}
export function logAt(r: EvidenceLine, anchor: number): number {
  if (r.day) return Date.parse(`${r.day}T${r.hms}Z`);
  const day = new Date(anchor).toISOString().slice(0, 10), t = Date.parse(`${day}T${r.hms}Z`);
  return [t - 86400000, t, t + 86400000].sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor))[0];
}
export function batchLogMatches(r: EvidenceLine, b: Row): boolean {
  const m = /BATCH CLOSE HYPEUSDT: (\d+) positions, PnL \$(-?[\d.]+), fees \$([\d.]+), avg entry \$([\d.]+).*exit \$([\d.]+)/.exec(r.text);
  return !!m && b.positionsClosed === +m[1] && Math.abs(b.totalPnl - +m[2]) < .006 && Math.abs(b.totalFees - +m[3]) < .006
    && Math.abs(b.avgEntry - +m[4]) < .00006 && Math.abs(b.exitPrice - +m[5]) < .00006 && Math.abs(logAt(r, epoch(b.ts)) - epoch(b.ts)) <= 2000;
}
export function reasonClass(reason: any): "tp" | "forced" | "unknown" {
  if (typeof reason !== "string") return "unknown";
  const r = reason.trim().toUpperCase();
  if (/^(NATIVE_TP|TP(?: \(.*\))?|STALE TP(?: \(.*\))?)$/.test(r)) return "tp";
  if (/HARD FLATTEN|EMERGENCY KILL|LADDER KILL|FUNDING SPIKE|PULLBACK EXIT ACTION|DRAWDOWN|OPERATOR|MANUAL/.test(r)) return "forced";
  return "unknown";
}
export function classifyBatch(b: Row, closeLogs: EvidenceLine[], context: EvidenceLine[], receipts: Row[], spec: Row): Row {
  const journalAt = epoch(b.ts), matches = closeLogs.filter(l => batchLogMatches(l, b));
  const matchedLines = matches.map(l => l.line);
  const contextual = context.filter(l => matches.some(m => l.file === m.file && l.line < m.line) && journalAt - logAt(l, journalAt) >= 0 && journalAt - logAt(l, journalAt) <= spec.tpContextMatchMs);
  const hits = contextual.filter(l => {
    const m = /BATCH TP HIT.*TP \$([\d.]+)(?: \(avg entry \$([\d.]+)\))?/.exec(l.text);
    return !!m && (!m[2] || Math.abs(+m[2] - b.avgEntry) < .00006);
  });
  const forced = contextual.filter(l => /(?:⚠ )?FLATTEN:|EMERGENCY KILL:|HARD FLATTEN:|FUNDING SPIKE:|LADDER KILL:/.test(l.text));
  const exact = reasonClass(b.closeReason);
  const contextualClass = hits.length && !forced.length ? "tp" : forced.length && !hits.length ? "forced" : "unknown";
  const reasonConflict = exact !== "unknown" && contextualClass !== "unknown" && exact !== contextualClass;
  const cohort = reasonConflict ? "long_unclassified" : exact === "tp" ? "long_tp_explicit" : exact === "forced" ? "long_forced"
    : !b.closeReason && contextualClass === "tp" ? "long_tp_log_supported" : !b.closeReason && contextualClass === "forced" ? "long_forced" : "long_unclassified";
  const receiptMatches = receipts.filter(r => r.filledQty > 0 && r.avgPrice > 0 && r.positionsClosed === b.positionsClosed
    && Math.abs(r.completedAt - journalAt) < 10000 && Math.abs(r.totalPnl - b.totalPnl) < 1e-6 && Math.abs(r.totalFees - b.totalFees) < 1e-6 && Math.abs(r.avgPrice - b.exitPrice) < 1e-6);
  const receipt = receiptMatches.length === 1 ? receiptMatches[0] : null;
  const validHits = hits.map(h => ({ ...h, at: logAt(h, journalAt) })).sort((a, b) => a.at - b.at);
  let eventAt = journalAt, timing = "journal_commit_proxy", exactFillAt: number | null = null;
  if (cohort.startsWith("long_tp") && validHits.length) { eventAt = validHits[0].at; timing = "tp_trigger_log_proxy"; }
  let operatorEvidence: Row | null = null;
  for (const e of spec.operatorEvidence ?? []) if (epoch(e.journalAt) === journalAt) {
    const qty = e.executions.reduce((s: number, x: Row) => s + x.qty, 0), notional = e.executions.reduce((s: number, x: Row) => s + x.qty * x.price, 0);
    if (Math.abs(qty - e.closedQty) > 1e-8 || Math.abs(notional / qty - b.exitPrice) > 1e-6 || Math.abs(e.closedPnl - b.totalPnl) > 1e-6 || exact !== "tp") throw new Error("Operator evidence does not exactly match batch");
    exactFillAt = Math.max(...e.executions.map((x: Row) => x.execTime)); eventAt = exactFillAt; timing = "user_export_last_execution"; operatorEvidence = e;
  }
  const hit = validHits[0], targetMatch = hit ? /TP \$([\d.]+)/.exec(hit.text) : null;
  const target = targetMatch ? +targetMatch[1] : null;
  return { cohort, journalAt, eventAt, exactFillAt, timing, timingExact: exactFillAt !== null, journalDelayMs: journalAt - eventAt,
    tpSubtype: b.closeReason?.startsWith("STALE TP") ? "stale_explicit" : b.closeReason === "NATIVE_TP" ? "native_target_unspecified" : b.closeReason?.startsWith("TP") ? "ordinary_explicit" : "legacy_target_unspecified",
    bookedPnl: b.totalPnl, bookedFees: b.totalFees, avgEntry: b.avgEntry, exitPrice: b.exitPrice, rungs: b.positionsClosed,
    priceGainPct: (b.exitPrice / b.avgEntry - 1) * 100, triggerTarget: target,
    triggerTargetGainPct: target ? (target / b.avgEntry - 1) * 100 : null,
    filledQty: receipt?.filledQty ?? operatorEvidence?.closedQty ?? null,
    orderId: receipt?.orderId ?? operatorEvidence?.orderId ?? null, orderLinkId: receipt?.orderLinkId ?? null,
    holdHours: receipt?.preOldestEntryTime ? (eventAt - receipt.preOldestEntryTime) / 3600000 : null,
    reason: b.closeReason ?? (contextualClass === "tp" ? "PM2_BATCH_TP_HIT" : forced.at(-1)?.text ?? null),
    evidence: { journal: { file: b.file, line: b.line, row: b.raw }, pm2Matches: matches, triggerHits: validHits, forcedContext: forced,
      matchedCloseLines: matchedLines, reasonConflict, receiptMatches: receiptMatches.length, receipt, operatorEvidence },
    impactAnalysisEligible: cohort.startsWith("long_tp") && (validHits.length > 0 || exactFillAt !== null),
    impactExclusionReason: cohort.startsWith("long_tp") && !validHits.length && exactFillAt === null ? "exact_tp_reason_but_fill_or_trigger_time_missing" : null };
}

export function monetaryGroup(rows: Row[]): Row {
  return { n: rows.length, wins: rows.filter(x => x.bookedPnl > 0).length, losses: rows.filter(x => x.bookedPnl < 0).length,
    winningDollars: rows.reduce((s, r) => s + Math.max(0, r.bookedPnl), 0), losingDollars: rows.reduce((s, r) => s + Math.min(0, r.bookedPnl), 0),
    bookedPnl: rows.reduce((s, r) => s + r.bookedPnl, 0), bookedFees: rows.reduce((s, r) => s + (numberOrNull(r.bookedFees) ?? 0), 0) };
}
