import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import { TpHlTape, normalize, Kind, Row, epoch, stats, MIN } from "./tp-hl-event-features";
import { EvidenceLine, parseLog, batchLogMatches, classifyBatch, monetaryGroup } from "./tp-hl-event-catalog";

const ROOT = path.resolve(__dirname, "..");
export const CARD = "research-inputs/tp-hl-events-2026-09-07.json";
export const SOURCES: Array<[Kind, string]> = [
  ["taker", "data/HYPEUSDT_taker_hyperliquid.jsonl"], ["book", "data/HYPEUSDT_ob_bands_hyperliquid.jsonl"],
  ["asset", "data/HYPEUSDT_asset_ctx_hyperliquid.jsonl"], ["oi", "data/HYPEUSDT_oi_live_hyperliquid.jsonl"],
  ["funding", "data/HYPEUSDT_funding_live_hyperliquid.jsonl"], ["vault", "data/HYPE_hlp_vault.jsonl"],
  ["candle1m", "data/HYPEUSDT_1m_hyperliquid.jsonl"], ["candle5m", "data/HYPEUSDT_5m_hyperliquid.jsonl"],
];
export async function sha256(file: string): Promise<string> {
  const h = crypto.createHash("sha256"); for await (const c of fs.createReadStream(file)) h.update(c); return h.digest("hex");
}
export class Inputs {
  pins: Row[] = [];
  async lines(file: string, callback: (text: string, line: number) => void): Promise<void> {
    const f = path.resolve(ROOT, file), before = fs.statSync(f), h = crypto.createHash("sha256");
    const stream = fs.createReadStream(f); stream.on("data", c => h.update(c)); let line = 0;
    for await (const text of readline.createInterface({ input: stream, crlfDelay: Infinity })) { line++; if (text.trim()) callback(text, line); }
    const after = fs.statSync(f); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`Input changed: ${file}`);
    this.pins.push({ file, bytes: after.size, sha256: h.digest("hex"), physicalLines: line });
  }
  async rows(file: string, callback: (r: Row, line: number) => void): Promise<void> {
    await this.lines(file, (text, line) => { let r: Row; try { r = JSON.parse(text); } catch { throw new Error(`Malformed JSON ${file}:${line}`); } callback(r, line); });
  }
  async json(file: string): Promise<Row> {
    const f = path.resolve(ROOT, file), b = fs.readFileSync(f); this.pins.push({ file, bytes: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex") });
    return JSON.parse(b.toString("utf8"));
  }
  async verify(): Promise<void> { for (const pin of this.pins) if (await sha256(path.resolve(ROOT, pin.file)) !== pin.sha256) throw new Error(`Fingerprint changed: ${pin.file}`); }
}
const identity = (prefix: string, data: any) => `${prefix}:${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 24)}`;
const iso = (t: number) => new Date(t).toISOString();
const timeFields = (t: number) => ({ eventIso: iso(t), month: iso(t).slice(0, 7), utcHour: new Date(t).getUTCHours(), utcWeekday: new Date(t).getUTCDay(),
  utcDate: iso(t).slice(0, 10), utcFourHourBlock: Math.floor(new Date(t).getUTCHours() / 4) * 4 });
const group = (rows: Row[], key: (r: Row) => string) => {
  const m = new Map<string, Row[]>(); for (const r of rows) { const k = key(r), a = m.get(k) ?? []; a.push(r); m.set(k, a); } return m;
};
export async function loadCatalog(inputs: Inputs, spec: Row): Promise<{ events: Row[]; audit: Row }> {
  const state = await inputs.json("bot-state.json"), short = await inputs.json("data/HYPEUSDT_hl_short_live_state.json");
  const allTrades: Row[] = [], keys = new Set<string>(); let duplicateTradeRows = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "logs")).filter(f => /^trades_\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()) {
    if (Date.parse(f.slice(7, 17) + "T00:00:00Z") > spec.cutoff) continue;
    await inputs.rows(`logs/${f}`, (r, line) => {
      if (r.symbol !== spec.symbol || epoch(r.ts) > spec.cutoff) return;
      const k = JSON.stringify(r); if (keys.has(k)) { duplicateTradeRows++; return; } keys.add(k);
      allTrades.push({ ...r, raw: r, file: `logs/${f}`, line });
    });
  }
  allTrades.sort((a, b) => epoch(a.ts) - epoch(b.ts));
  const batches = allTrades.filter(r => r.action === "BATCH_CLOSE" && epoch(r.ts) >= spec.from);
  const logMatches = new Map<Row, EvidenceLine[]>(), contexts = new Map<Row, EvidenceLine[]>();
  const recent: EvidenceLine[] = []; let relevantLines = 0, unmatchedPm2Closes = 0, ambiguousPm2Closes = 0;
  await inputs.lines("logs/pm2/hedgeguy-bot-out.log", (text, line) => {
    if (!/BATCH CLOSE HYPEUSDT|BATCH TP HIT|FLATTEN:|EMERGENCY KILL:|HARD FLATTEN:|FUNDING SPIKE:|LADDER KILL:/.test(text)) return;
    const p = parseLog("logs/pm2/hedgeguy-bot-out.log", line, text); if (!p) return; relevantLines++;
    if (text.includes("BATCH CLOSE HYPEUSDT")) {
      const matches = batches.filter(b => batchLogMatches(p, b));
      if (matches.length === 1) {
        const b = matches[0]; logMatches.set(b, [...(logMatches.get(b) ?? []), p]); contexts.set(b, [...(contexts.get(b) ?? []), ...recent]);
      } else if (matches.length > 1) ambiguousPm2Closes++; else unmatchedPm2Closes++;
      recent.length = 0;
    } else { recent.push(p); if (recent.length > 1000) recent.shift(); }
  });
  const receipts = [...(state.completedMakerTpOrders ?? []), ...(state.completedLongTransactions ?? []).filter((r: Row) => r.kind === "full_close")];
  const events: Row[] = batches.map(b => ({ id: identity("long", b.raw), side: "long", owner: "ladder", ...classifyBatch(b, logMatches.get(b) ?? [], contexts.get(b) ?? [], receipts, spec) }));
  const partials: Row[] = [], candidates: Row[] = [], partialIds = new Map<string, Row>();
  await inputs.rows("data/HYPEUSDT_sr_partial_exit_actions.jsonl", (r, line) => {
    if (r.symbol !== spec.symbol || r.live !== true || epoch(r.ts) < spec.from || epoch(r.ts) > spec.cutoff) return;
    if (r.event === "candidate") candidates.push({ ...r, file: "data/HYPEUSDT_sr_partial_exit_actions.jsonl", line });
    if (r.event !== "executed") return;
    const k = r.orderLinkId || r.orderId; if (!k) throw new Error("Executed SR partial lacks order identity");
    const prev = partialIds.get(k); if (prev) { if (JSON.stringify(prev) !== JSON.stringify(r)) throw new Error(`Conflicting executed partial ${k}`); return; }
    partialIds.set(k, r);
    const matches = candidates.filter(c => c.candidate === r.candidate && Math.abs(c.closeQty - r.requestedQty) < 1e-8 && epoch(r.ts) - epoch(c.ts) >= 0 && epoch(r.ts) - epoch(c.ts) <= 15000);
    const c = matches.length === 1 ? matches[0] : null;
    const e = { id: `sr:${k}`, owner: "ladder", side: "long", cohort: "sr_partial", eventAt: epoch(r.ts), journalAt: epoch(r.ts), exactFillAt: null,
      timing: "partial_execution_log_proxy", timingExact: false, impactAnalysisEligible: true, bookedPnl: r.realizedPnl, bookedFees: r.fees,
      rungs: r.positionsClosed + r.remainingRungs, positionsClosed: r.positionsClosed, remainingRungs: r.remainingRungs,
      filledQty: r.filledQty, exitPrice: r.fillPrice, avgEntry: null, holdHours: c?.ladder?.oldestAgeHours ?? null,
      reason: r.reason, orderId: r.orderId, orderLinkId: k, resistance: r.resistance ?? null,
      evidence: { journal: { file: "data/HYPEUSDT_sr_partial_exit_actions.jsonl", line, row: r }, candidate: c,
        liveDecisionPulse: c?.pulse ?? null, livePulseAt: c ? epoch(c.ts) : null, candidateMatchCount: matches.length } };
    partials.push(e); events.push(e);
  });
  const shortIds = new Set<string>();
  for (const r of short.receipts ?? []) {
    if (r.kind !== "short_close" || !(r.filledQty > 0) || r.completedAt < spec.from || r.completedAt > spec.cutoff) continue;
    if (shortIds.has(r.orderLinkId)) throw new Error(`Duplicate short receipt ${r.orderLinkId}`); shortIds.add(r.orderLinkId);
    const native = r.outcome === "native_close", exact = r.terminalStatus === "native_execution_evidence";
    const open = (short.receipts ?? []).find((x: Row) => x.kind === "short_open" && x.signalId === r.signalId && x.filledQty > 0);
    events.push({ id: `short:${r.orderLinkId}`, owner: "hl_short", side: "short", cohort: native ? r.pnl > 0 ? "short_native_favorable_untyped" : "short_native_adverse_untyped" : "short_other",
      eventAt: r.completedAt, journalAt: null, exactFillAt: exact ? r.completedAt : null, timing: exact ? "native_last_execution" : r.terminalStatus === "native_closed_pnl_evidence" ? "closed_pnl_update_proxy" : "short_commit_proxy",
      timingExact: exact, impactAnalysisEligible: true, bookedPnl: r.pnl, bookedFees: r.fees, filledQty: r.filledQty, exitPrice: r.avgPrice,
      avgEntry: open?.avgPrice ?? null, holdHours: open ? (r.completedAt - open.completedAt) / 3600000 : null,
      reason: r.reason ?? null, orderId: r.orderId, orderLinkId: r.orderLinkId,
      evidence: { receipt: { file: "data/HYPEUSDT_hl_short_live_state.json", orderLinkId: r.orderLinkId, row: r }, open: open ?? null,
        tpSlTypePersisted: false, note: "native_tp_sl does not persist exact TP versus SL type; favorable is not promoted to confirmed TP" } });
  }
  // Legacy opens are usable only when the complete rung count AND weighted entry agree.
  for (const b of events.filter(e => e.owner === "ladder" && e.cohort !== "sr_partial")) {
    const prev = allTrades.filter(r => r.action === "BATCH_CLOSE" && epoch(r.ts) < b.journalAt).at(-1);
    const opens = allTrades.filter(r => r.action === "OPEN_LONG" && r.success === true && epoch(r.ts) > (prev ? epoch(prev.ts) : 0) && epoch(r.ts) < b.journalAt);
    const qty = opens.reduce((a, r) => a + Number(r.qty), 0), notion = opens.reduce((a, r) => a + Number(r.qty) * Number(r.price), 0);
    const intervening = partials.some(p => p.eventAt > (prev ? epoch(prev.ts) : 0) && p.eventAt < b.journalAt);
    if (!intervening && opens.length === b.rungs && qty > 0 && Math.abs(notion / qty - b.avgEntry) < .0001) {
      b.filledQty ??= qty; b.holdHours ??= (b.eventAt - epoch(opens[0].ts)) / 3600000;
      b.evidence.legacyEntryMatch = { n: opens.length, qty, avg: notion / qty, firstOpenAt: epoch(opens[0].ts), sources: opens.map(r => ({ file: r.file, line: r.line })) };
    }
  }
  events.sort((a, b) => a.eventAt - b.eventAt);
  for (const e of events) { Object.assign(e, timeFields(e.eventAt)); e.depthBand = e.rungs == null ? "unknown" : e.rungs <= 3 ? "1-3" : e.rungs <= 7 ? "4-7" : e.rungs <= 10 ? "8-10" : "11+"; }
  return { events, audit: { journalBatches: batches.length, journalPnl: batches.reduce((s, r) => s + r.totalPnl, 0),
    duplicateTradeRows, relevantPm2Lines: relevantLines, matchedJournalBatches: batches.filter(b => logMatches.has(b)).length,
    unmatchedPm2ClosesOutsideCatalogOrUnmatched: unmatchedPm2Closes, ambiguousPm2Closes, retainedMakerReceipts: state.completedMakerTpOrders?.length ?? 0,
    retainedLongReceipts: state.completedLongTransactions?.length ?? 0, retainedShortCloses: shortIds.size,
    shortReceiptNet: events.filter(e => e.owner === "hl_short").reduce((s, r) => s + r.bookedPnl, 0), shortStateRealized: short.realizedPnl,
    noPrivateExchangeQuery: true, strategyVariants: 0 } };
}

export async function loadTape(inputs: Inputs, spec: Row): Promise<{ tape: TpHlTape; inventory: Row[] }> {
  const tape = new TpHlTape(spec), inventory: Row[] = [];
  for (const [kind, file] of SOURCES) {
    const info: Row = { kind, file, rawRows: 0, retainedRows: 0, afterCutoff: 0, invalidValueRows: 0, modeledPublicationRows: 0, recordedPublicationRows: 0, firstSample: null, lastSample: null, firstSource: null, lastSource: null };
    await inputs.rows(file, (raw, line) => {
      info.rawRows++; const o = normalize(kind, raw, file, line);
      info.firstSample = Math.min(info.firstSample ?? Infinity, o.sampleAt); info.lastSample = Math.max(info.lastSample ?? 0, o.sampleAt);
      info.firstSource = Math.min(info.firstSource ?? Infinity, o.sourceAt); info.lastSource = Math.max(info.lastSource ?? 0, o.sourceAt);
      if (o.baseAvailableAt > spec.cutoff) { info.afterCutoff++; return; }
      if (o.data.valid === false) info.invalidValueRows++;
      if (o.modeledLag) info.modeledPublicationRows++; if (o.recordedPublication) info.recordedPublicationRows++;
      if (kind === "book") { info.coarse01 = (info.coarse01 ?? 0) + Number(o.data.coarse01); info.invalid05 = (info.invalid05 ?? 0) + Number(!o.data.band05.healthy); }
      tape.add(o); info.retainedRows++;
    });
    inventory.push(info); console.log(`Loaded ${kind}: ${info.retainedRows} rows`);
  }
  tape.seal(); return { tape, inventory };
}
export function csv(rows: Row[]): string {
  if (!rows.length) return ""; const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return keys.map(cell).join(",") + "\n" + rows.map(r => keys.map(k => cell(r[k])).join(",")).join("\n") + "\n";
}
export function summarize(events: Row[], impact: Map<string, Row>, references: Row[], trajectories: Row[]): Row {
  const tp = events.filter(e => e.cohort.startsWith("long_tp")), aligned = tp.filter(e => e.impactAnalysisEligible);
  const key = (r: Row) => `${r.month}|${r.utcHour}`;
  const refs = group(references, key), featureNames = Object.keys(references[0]?.features ?? {});
  const comparison = (es: Row[]) => Object.fromEntries(featureNames.map(f => {
    const values = es.map(e => impact.get(e.id)?.features[f] ?? null);
    const paired: Row[] = [];
    for (const e of es) {
      const value = impact.get(e.id)?.features[f]; if (value == null) continue;
      const controls = (refs.get(key(e)) ?? []).map(r => r.features[f]).filter(v => v !== null);
      if (controls.length < 10) continue; const m = controls.reduce((a: number, b: number) => a + b, 0) / controls.length;
      paired.push({ value, reference: m, delta: value - m });
    }
    return [f, { event: stats(values), allClockReference: stats(references.map(r => r.features[f])),
      monthHourStandardized: { n: paired.length, eventMean: stats(paired.map(p => p.value)).mean, referenceMean: stats(paired.map(p => p.reference)).mean, difference: stats(paired.map(p => p.delta)).mean } }];
  }));
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const es = tp.filter(e => e.utcHour === hour), refsHour = references.filter(r => r.utcHour === hour), alignedHour = aligned.filter(e => e.utcHour === hour);
    return { utcHour: hour, ...monetaryGroup(es), alignedN: alignedHour.length, coreHealthyTpN: alignedHour.filter(e => impact.get(e.id)?.quality.coreHealthy).length,
      marketReferenceN: refsHour.length, coreHealthyReferenceN: refsHour.filter(r => r.quality.coreHealthy).length,
      observedReferenceHours: refsHour.filter(r => r.quality.coreHealthy).length * 5 / 60,
      tpPer100CoreReferenceHours: refsHour.some(r => r.quality.coreHealthy) ? 100 * alignedHour.filter(e => impact.get(e.id)?.quality.coreHealthy).length / (refsHour.filter(r => r.quality.coreHealthy).length * 5 / 60) : null };
  });
  const perGroups = (es: Row[], prop: string): Row[] => [...group(es, r => String(r[prop]))].map(([value, rows]) => ({ [prop]: value, ...monetaryGroup(rows),
    alignedN: rows.filter(e => e.impactAnalysisEligible).length, coreHealthyAtRecordedAnchorN: rows.filter(e => impact.get(e.id)?.quality.coreHealthy).length,
    coreHealthyAlignedN: rows.filter(e => e.impactAnalysisEligible && impact.get(e.id)?.quality.coreHealthy).length }));
  const alignedIds = new Set(aligned.map(e => e.id));
  const paths = group(trajectories.filter(t => alignedIds.has(t.eventId)), t => t.eventId);
  const pairedLeadIn = Object.fromEntries(featureNames.map(f => {
    const complete = [...paths.values()].filter(rs => rs.length === 16 && rs.every(r => r.features[f] != null));
    return [f, { n: complete.length, byOffset: Array.from({ length: 16 }, (_, i) => ({ offsetMinutes: i - 15,
      ...stats(complete.map(rs => rs.find(r => r.offsetMinutes === i - 15)!.features[f])) })),
      impactMinusStart: stats(complete.map(rs => rs.find(r => r.offsetMinutes === 0)!.features[f] - rs.find(r => r.offsetMinutes === -15)!.features[f])) }];
  }));
  const timeGroups = (prop: string) => perGroups(tp, prop).map(r => {
    const rs = references.filter(x => String(x[prop]) === r[prop] && x.quality.coreHealthy);
    return { ...r, approximateCoreReferenceHours: rs.length * 5 / 60,
      tpPer100CoreReferenceHours: rs.length ? 100 * r.coreHealthyAlignedN / (rs.length * 5 / 60) : null };
  });
  return { generatedAt: new Date().toISOString(), totalEvents: events.length, allLongCloses: monetaryGroup(events.filter(e => e.owner === "ladder" && e.cohort !== "sr_partial")),
    tp: monetaryGroup(tp), alignedTp: monetaryGroup(aligned), coreHealthyAlignedTp: monetaryGroup(aligned.filter(e => impact.get(e.id)?.quality.coreHealthy)),
    cohorts: perGroups(events, "cohort"), monthlyTp: perGroups(tp, "month"), monthlyAllEvents: [...group(events, e => e.month)].map(([month, es]) => ({ month, cohorts: perGroups(es, "cohort") })),
    hourlyTp: hours, fourHourTp: timeGroups("utcFourHourBlock"), weekdayTp: timeGroups("utcWeekday"), depthTp: perGroups(tp, "depthBand"), subtypeTp: perGroups(tp, "tpSubtype"),
    comparisons: { alignedTp: comparison(aligned), partials: comparison(events.filter(e => e.cohort === "sr_partial")), forcedCloses: comparison(events.filter(e => e.cohort === "long_forced")),
      favorableNativeShorts: comparison(events.filter(e => e.cohort === "short_native_favorable_untyped")) },
    monthlyTpFeatureSummary: [...group(aligned, e => e.month)].map(([month, es]) => ({ month, n: es.length,
      features: Object.fromEntries(["buyShare15", "netTaker15Usd", "bookImbalance05", "assetNativeOiChange15Pct", "hlClosedReturn15Pct"].map(f => [f, stats(es.map(e => impact.get(e.id)?.features[f]))])) })),
    pairedLeadIn,
    leadIn: [...group(trajectories.filter(t => alignedIds.has(t.eventId)), t => String(t.offsetMinutes))].map(([offset, rs]) => ({ offsetMinutes: Number(offset), n: rs.length,
      features: Object.fromEntries(featureNames.map(f => [f, stats(rs.map(r => r.features[f]))])) })).sort((a, b) => a.offsetMinutes - b.offsetMinutes),
    holdHoursTp: stats(tp.map(e => e.holdHours)), referenceSamples: references.length,
    notes: ["Exit-time cohorts across changing historical configurations, not exact-current-stack replay.", "Reference time is all market time, not ladder-at-risk exposure; rates are descriptive capture density, not trade success probability.",
      "Month-hour standardization controls broad sampling composition only, not price path, exposure, regime or selection bias.", "TP-at-impact and lead-in fields are success-conditioned research descriptions, not proven prediction or HL causal impact."] };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2), arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
  if (args.some((a, i) => a.startsWith("--") && a !== "--out" && a !== "--card")) throw new Error("Use --out and/or --card only");
  const inputs = new Inputs(), spec = await inputs.json(arg("--card") ?? CARD);
  const out = path.resolve(ROOT, arg("--out") ?? `backtests/hype/${spec.id}`), relative = path.relative(path.join(ROOT, "backtests"), out);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || fs.existsSync(out)) throw new Error("Choose a NEW output directory inside backtests/");
  const { events, audit } = await loadCatalog(inputs, spec), { tape, inventory } = await loadTape(inputs, spec);
  const sources = ["scripts/hype-tp-hl-event-atlas.ts", "scripts/tp-hl-event-features.ts", "scripts/tp-hl-event-catalog.ts", "scripts/tp-hl-event-tests.ts", "scripts/tp-hl-event-results-check.ts",
    "src/hyperliquid-collector.ts", "src/bot/monitor.ts", "src/bot/hl-short-transaction-coordinator.ts", "src/bot/maker-tp-transaction.ts"];
  for (const file of sources) await inputs.lines(file, () => {});
  const trajectories: Row[] = [], references: Row[] = [], impact = new Map<string, Row>(), sensitivity: Row[] = [];
  for (const e of events) {
    for (const offset of spec.relativeMinutes) {
      const s = tape.snapshot(e.eventAt + offset * MIN), row = { eventId: e.id, cohort: e.cohort, impactAnalysisEligible: e.impactAnalysisEligible, offsetMinutes: offset, ...s };
      trajectories.push(row); if (offset === 0) impact.set(e.id, row);
    }
    const optimistic = tape.snapshot(e.eventAt, spec.optimisticSensitivityLagMs), primary = impact.get(e.id)!;
    sensitivity.push({ eventId: e.id, cohort: e.cohort, asOf: e.eventAt, primaryLagMs: spec.legacyPublicationLagMs, alternativeLagMs: spec.optimisticSensitivityLagMs,
      primaryFeatures: primary.features, optimisticFeatures: optimistic.features, primaryQuality: primary.quality, optimisticQuality: optimistic.quality });
  }
  for (let at = Math.ceil(spec.from / spec.referenceEveryMs) * spec.referenceEveryMs; at <= spec.cutoff; at += spec.referenceEveryMs) {
    const s = tape.snapshot(at); references.push({ asOf: at, ...timeFields(at), features: s.features, quality: s.quality });
  }
  const summary = summarize(events, impact, references, trajectories);
  const changes = events.map(e => {
    const before = trajectories.find(t => t.eventId === e.id && t.offsetMinutes === -15)!, at = impact.get(e.id)!;
    return { eventId: e.id, cohort: e.cohort, eventAt: e.eventAt, eventIso: e.eventIso, impactAnalysisEligible: e.impactAnalysisEligible,
      ...Object.fromEntries(Object.keys(at.features).map(k => [`${k}_changeFrom15mBefore`, at.features[k] !== null && before.features[k] !== null ? at.features[k] - before.features[k] : null])) };
  });
  const bounds = (obj: any, asOf: number): void => { if (!obj || typeof obj !== "object") return;
    if (typeof obj.availableAt === "number" && obj.availableAt > (obj.queryAt ?? asOf)) throw new Error("Future source joined");
    if (typeof obj.sourceAt === "number" && obj.sourceAt > (obj.queryAt ?? asOf)) throw new Error("Future source timestamp joined");
    Object.values(obj).forEach(x => bounds(x, asOf)); };
  trajectories.forEach(t => bounds(t.sources, t.asOf));
  await inputs.verify(); fs.mkdirSync(out, { recursive: true });
  const json = (name: string, x: any) => fs.writeFileSync(path.join(out, name), JSON.stringify(x, null, 2) + "\n");
  const jsonl = (name: string, rows: any[]) => { const fd = fs.openSync(path.join(out, name), "wx"); try { for (const r of rows) fs.writeSync(fd, JSON.stringify(r) + "\n"); } finally { fs.closeSync(fd); } };
  jsonl("events.jsonl", events); jsonl("event-context.jsonl", trajectories); jsonl("market-reference.jsonl", references); jsonl("availability-sensitivity.jsonl", sensitivity);
  json("source-inventory.json", inventory); json("catalog-audit.json", audit); json("summary.json", summary); json("lead-in-changes.json", changes);
  fs.writeFileSync(path.join(out, "events.csv"), csv(events.map(({ evidence, ...e }) => e)));
  fs.writeFileSync(path.join(out, "event-features.csv"), csv(events.map(e => ({ eventId: e.id, cohort: e.cohort, eventAt: e.eventAt, eventIso: e.eventIso, timing: e.timing,
    impactAnalysisEligible: e.impactAnalysisEligible, utcHour: e.utcHour, month: e.month, bookedPnl: e.bookedPnl, rungs: e.rungs, ...impact.get(e.id)!.features, ...impact.get(e.id)!.quality }))));
  fs.writeFileSync(path.join(out, "lead-in-features.csv"), csv(trajectories.map(t => ({ eventId: t.eventId, cohort: t.cohort, offsetMinutes: t.offsetMinutes, asOf: t.asOf, ...t.features, ...t.quality }))));
  fs.writeFileSync(path.join(out, "hourly.csv"), csv(summary.hourlyTp));
  json("manifest.json", { version: 1, spec, inputs: inputs.pins, strategyVariants: 0, liveChanges: 0 });
  await inputs.verify();
  const files = fs.readdirSync(out); const artifacts = []; for (const file of files) artifacts.push({ file, sha256: await sha256(path.join(out, file)) });
  json("validation.json", { complete: true, eventRows: events.length, contextRows: trajectories.length, referenceRows: references.length, sourceBoundsPass: true, inputsUnchanged: true, artifacts });
  console.log(JSON.stringify({ out: path.relative(ROOT, out), events: events.length, contexts: trajectories.length, references: references.length,
    tp: summary.tp, alignedTp: summary.alignedTp, coreHealthyAlignedTp: summary.coreHealthyAlignedTp, cohorts: summary.cohorts }, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
