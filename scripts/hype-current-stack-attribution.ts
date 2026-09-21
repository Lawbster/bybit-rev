/** Local evidence audit only. No executor, exchange, signal-file or process-control imports.
 * npx ts-node scripts/hype-current-stack-attribution.ts
 * Uses existing copied logs/state, writes only a fresh backtests/ output directory.
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";

type Row = Record<string, any>;
const ROOT = path.resolve(__dirname, "..");
const DAY = 86_400_000;
export function epoch(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(n)) throw new Error(`Invalid UTC timestamp: ${String(value)}`);
  return n;
}
const sum = (rows: Row[], key: string) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
export function uniqueReceipts(rows: Row[]): Row[] {
  const seen = new Map<string, Row>();
  for (const row of rows) {
    const key = row.orderLinkId || row.orderId;
    if (!key) throw new Error("Receipt without order identity");
    if (seen.has(key) && JSON.stringify(seen.get(key)) !== JSON.stringify(row)) throw new Error(`Conflicting receipts: ${key}`);
    seen.set(key, row);
  }
  return [...seen.values()];
}
export function matchMakerClose(receipt: Row, closes: Row[]): Row | null {
  // Batch journal has no orderId: require a UNIQUE multi-field match, never time alone.
  const candidates = closes.filter(c => Math.abs(epoch(c.ts) - receipt.completedAt) <= 5000
    && Math.abs(c.totalPnl - receipt.totalPnl) < 1e-6
    && Math.abs(c.totalFees - receipt.totalFees) < 1e-6
    && Math.abs(c.exitPrice - receipt.avgPrice) < 1e-6
    && c.positionsClosed === receipt.positionsClosed);
  return candidates.length === 1 ? candidates[0] : null;
}
export function feeArithmetic(receipt: Row, entryRate: number, makerRate: number) {
  if (!(receipt.filledQty > 0 && receipt.avgPrice > 0 && receipt.preAvgEntry > 0)) throw new Error("Invalid fill evidence");
  const entryNotional = receipt.preAvgEntry * receipt.filledQty;
  const exitNotional = receipt.avgPrice * receipt.filledQty;
  const modeledFees = entryNotional * entryRate + exitNotional * makerRate;
  return { entryNotional, exitNotional, modeledFees, bookedFees: receipt.totalFees,
    feeResidual: receipt.totalFees - modeledFees,
    pnlResidual: receipt.totalPnl - (exitNotional - entryNotional - receipt.totalFees),
    sameFillModeledSaving: exitNotional * (entryRate - makerRate),
    actualExchangeFeesVerified: false };
}

async function main(): Promise<void> {
  const out = path.resolve(ROOT, process.env.ATTRIBUTION_OUT || "backtests/hype/current-stack-parity-2026-09-04/ledger");
  const relative = path.relative(path.join(ROOT, "backtests"), out);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output must be inside backtests/");
  if (fs.existsSync(out)) throw new Error(`Refusing to overwrite ${out}; choose ATTRIBUTION_OUT`);
  fs.mkdirSync(out, { recursive: true });
  const inputs: Row[] = [];
  const capture = (file: string, hash: string, before: fs.Stats) => {
    const after = fs.statSync(path.join(ROOT, file));
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`Input changed during audit: ${file}`);
    inputs.push({ file, bytes: after.size, mtime: after.mtime.toISOString(), sha256: hash });
  };
  const readJson = (file: string) => {
    const before = fs.statSync(path.join(ROOT, file)); const bytes = fs.readFileSync(path.join(ROOT, file));
    capture(file, crypto.createHash("sha256").update(bytes).digest("hex"), before);
    return JSON.parse(bytes.toString("utf8"));
  };
  const readLines = async (file: string, callback: (line: string, lineNo: number) => void) => {
    const before = fs.statSync(path.join(ROOT, file)); const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(path.join(ROOT, file)); stream.on("data", chunk => hash.update(chunk));
    const reader = readline.createInterface({ input: stream, crlfDelay: Infinity }); let lineNo = 0;
    for await (const line of reader) { lineNo++; if (line.trim()) callback(line, lineNo); }
    capture(file, hash.digest("hex"), before);
  };
  const readRows = (file: string, callback: (row: Row) => void) => readLines(file, (line, lineNo) => {
    let row: Row; try { row = JSON.parse(line); } catch { throw new Error(`Malformed JSON ${file}:${lineNo}`); }
    callback(row); // Do not swallow callback errors like the older replay reader.
  });
  const write = (file: string, value: unknown) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + "\n");
  const config = readJson("bot-config.json");
  const shortConfig = readJson("hl-short-live-config.json");
  const state = readJson("bot-state.json");
  const health = readJson("data/HYPEUSDT_runtime_health.json");
  const shortState = readJson(shortConfig.stateFile);
  const shortHealth = readJson(shortConfig.healthFile);
  const cutoff = epoch(health.writtenAt); const from = cutoff - 60 * DAY;
  const latchStart = Date.parse("2026-08-14T18:40:11Z");
  const makerStart = Date.parse("2026-08-31T23:15:57Z");
  const pauseStart = Date.parse("2026-09-04T00:24:31Z");
  const windowRows = (rows: Row[], start: number, end = cutoff) => rows.filter(x => epoch(x.ts ?? x.completedAt) >= start && epoch(x.ts ?? x.completedAt) <= end);
  const trades: Row[] = []; let lastLegacyOpen = 0; let duplicateTradeRows = 0; const tradeKeys = new Set<string>();
  for (const file of fs.readdirSync(path.join(ROOT, "logs")).filter(f => /^trades_\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()) {
    await readRows(`logs/${file}`, row => {
      if (row.symbol !== "HYPEUSDT") return;
      const ts = epoch(row.ts);
      if (row.action === "OPEN_LONG" && row.success) lastLegacyOpen = Math.max(lastLegacyOpen, ts);
      if (ts < from || ts > cutoff) return;
      const key = JSON.stringify(row); if (tradeKeys.has(key)) { duplicateTradeRows++; return; }
      tradeKeys.add(key); trades.push(row);
    });
  }
  const closes = trades.filter(x => x.action === "BATCH_CLOSE").sort((a, b) => epoch(a.ts) - epoch(b.ts));
  const partials: Row[] = []; const partialIds = new Set<string>();
  await readRows("data/HYPEUSDT_sr_partial_exit_actions.jsonl", r => {
    if (r.symbol !== "HYPEUSDT" || r.event !== "executed" || !r.live || epoch(r.ts) < from || epoch(r.ts) > cutoff) return;
    const identity = r.orderLinkId || r.orderId;
    if (!identity) throw new Error("Executed partial lacks identity");
    if (partialIds.has(identity)) throw new Error(`Duplicate executed partial ${identity}`);
    partialIds.add(identity); partials.push(r);
  });
  const shortReceipts = uniqueReceipts(shortState.receipts.filter((r: Row) => r.kind !== "signal_skip"));
  const shortCloses = shortReceipts.filter(r => r.kind === "short_close" && r.filledQty > 0);
  const makerReceipts = uniqueReceipts(state.completedMakerTpOrders);
  const filledMakers = makerReceipts.filter(r => r.outcome === "full_committed" && r.filledQty > 0);
  const makerAudit = filledMakers.map(r => ({ orderLinkId: r.orderLinkId, orderId: r.orderId, ts: new Date(r.completedAt).toISOString(), qty: r.filledQty, exitPrice: r.avgPrice, bookedPnl: r.totalPnl, executionIds: r.executionIds.length, matchedBatch: !!matchMakerClose(r, closes), ...feeArithmetic(r, config.feeRate, config.makerTp.makerFeeRate) }));
  const equities: Row[] = [];
  for (const file of fs.readdirSync(path.join(ROOT, "logs")).filter(f => /^equity_\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort()) {
    if (Date.parse(file.slice(7, 17) + "T00:00:00Z") + DAY < from) continue;
    await readRows(`logs/${file}`, r => { if (epoch(r.ts) >= from && epoch(r.ts) <= cutoff) equities.push(r); });
  }
  equities.sort((a, b) => epoch(a.ts) - epoch(b.ts));
  const equityResiduals: Row[] = [];
  for (let i = 1; i < equities.length; i++) {
    const previous = equities[i - 1], current = equities[i];
    const batch = windowRows(closes, epoch(previous.ts) + 1, epoch(current.ts));
    const partial = windowRows(partials, epoch(previous.ts) + 1, epoch(current.ts));
    const residual = current.realizedPnl - previous.realizedPnl - sum(batch, "totalPnl") - sum(partial, "realizedPnl");
    if (Math.abs(residual) > .02) equityResiduals.push({ start: previous.ts, end: current.ts, residual, batchCloses: batch.length, partials: partial.length });
  }
  const grouped = (rows: Row[], key: (r: Row) => string, pnl: string) => {
    const groups: Record<string, Row> = {};
    for (const r of rows) { const k = key(r); const g = groups[k] ||= { count: 0, pnl: 0 }; g.count++; g.pnl += Number(r[pnl]); }
    return groups;
  };
  const periods = [
    { id: "last_60_days_mixed_configs", start: from }, { id: "latch_deployment_onward", start: latchStart },
    { id: "maker_stable_onward", start: makerStart }, { id: "exact_current_short_paused", start: pauseStart },
  ].map(p => {
    const b = windowRows(closes, p.start); const sr = windowRows(partials, p.start); const sh = windowRows(shortCloses, p.start); const eq = windowRows(equities, p.start);
    const first = eq[0], last = eq.at(-1);
    const journalBetweenEquity = first && last ? windowRows(closes, epoch(first.ts) + 1, epoch(last.ts)) : [];
    const partialBetweenEquity = first && last ? windowRows(partials, epoch(first.ts) + 1, epoch(last.ts)) : [];
    return { id: p.id, start: new Date(p.start).toISOString(), end: new Date(cutoff).toISOString(), days: (cutoff - p.start) / DAY,
      batchCloses: b.length, batchPnl: sum(b, "totalPnl"), srPartials: sr.length, srPnl: sum(sr, "realizedPnl"),
      longRealizedJournal: sum(b, "totalPnl") + sum(sr, "realizedPnl"), shortCloses: sh.length, shortNetPnl: sum(sh, "pnl"),
      longBookedRoundTripFees: sum(b, "totalFees") + sum(sr, "fees"), batchReasons: grouped(b, r => r.closeReason || "unclassified", "totalPnl"),
      equityStart: first || null, equityEnd: last || null, equityChange: first && last ? last.equity - first.equity : null,
      realizedReconciliationResidual: first && last ? last.realizedPnl - first.realizedPnl - sum(journalBetweenEquity, "totalPnl") - sum(partialBetweenEquity, "realizedPnl") : null,
      note: "Exit-time accounting cohort, includes carry-in ladders; not all trades originated under this config. Fees already included in PnL. Equity delta includes unrealized PnL, funding, short activity and any cash flows." };
  });
  const decisions: Row[] = []; let decisionCount = 0; let firstDecision = Infinity;
  await readRows("data/HYPEUSDT_decisions.jsonl", r => {
    if (r.symbol !== "HYPEUSDT" || r.decision !== "ladder_add" || epoch(r.ts) < from || epoch(r.ts) > cutoff) return;
    decisionCount++; firstDecision = Math.min(firstDecision, r.ts);
    if (r.ts >= makerStart) decisions.push({ ts: r.ts, iso: r.iso, rungLevel: r.rungLevel, quotePrice: r.quotePrice, existingRungs: r.existingRungs, notional: r.notional, configVersion: r.configVersion, inCooldown: r.inCooldown, recovery: r.recovery, hlTaker15m: r.hlTaker15m, hlTaker1h: r.hlTaker1h, supportReopen: r.supportReopen });
  });
  const longOpens = uniqueReceipts(state.completedLongTransactions).filter(r => r.kind === "long_open" && r.outcome === "committed");
  const openMatches = longOpens.map(r => {
    const matches = decisions.filter(d => d.ts === r.completedAt);
    return { orderLinkId: r.orderLinkId, decisionAt: new Date(r.completedAt).toISOString(), qty: r.filledQty, fillPrice: r.avgPrice, executionIds: r.executionIds.length,
      matchCount: matches.length, quotePrice: matches.length === 1 ? matches[0].quotePrice : null,
      quoteVsFillBps: matches.length === 1 ? (r.avgPrice / matches[0].quotePrice - 1) * 1e4 : null,
      note: "completedAt is caller/decision time, not authoritative exchange execTime" };
  });
  const transitions: Row[] = []; const operationalCounts: Record<string, number> = {};
  for (const file of ["logs/pm2/hedgeguy-bot-out.log", "logs/pm2/hedgeguy-bot-error.log", "logs/pm2/hype-hl-short-live-out.log"]) {
    await readLines(file, (line, lineNo) => {
      const match = /\[(2026-\d\d-\d\d \d\d:\d\d:\d\d)\]/.exec(line); if (!match) return;
      const at = Date.parse(match[1].replace(" ", "T") + "Z"); if (at < latchStart || at > cutoff) return;
      if (/Bot starting:|Damaged-regime latch|damaged-regime latch (released|armed)|bootstrap|Maker TP LIVE|SIGNAL: bot-resume|native TP verification mismatch|HL short startup reconciliation/.test(line)) {
        const category = line.includes("native TP verification mismatch") ? "native_tp_rounding_mismatch_attempt" : "transition";
        operationalCounts[category] = (operationalCounts[category] || 0) + 1;
        transitions.push({ file, lineNo, ts: new Date(at).toISOString(), category, line });
      }
    });
  }
  const latest = equities.at(-1);
  // Reproduce the dormant replay's minuteLast lookup without changing its code.
  // A raw timestamp later than decisionAt cannot be available at that decision,
  // even when flooring it makes the map key equal to decisionAt.
  const probeAt = Date.parse("2026-09-04T07:40:00Z");
  const pulseAsOfProbes: Row[] = [];
  for (const spec of [
    { file: "data/HYPEUSDT_ob_bands_hyperliquid.jsonl", field: "imbalance_0_5" },
    { file: "data/HYPEUSDT_asset_ctx_hyperliquid.jsonl", field: "openInterestValue" },
  ]) {
    let exact: Row | null = null; let floored: Row | null = null; let lateBuckets = 0;
    const buckets = new Map<number, number>();
    await readRows(spec.file, r => {
      const ts = Number(r.timestamp ?? Date.parse(r.ts));
      if (!Number.isFinite(ts)) throw new Error(`Invalid source timestamp ${spec.file}`);
      if (ts < from || ts > cutoff) return;
      buckets.set(Math.floor(ts / 60_000) * 60_000, ts);
      const pick = { sourceAt: new Date(ts).toISOString(), sourceTs: ts, value: r[spec.field] };
      if (ts <= probeAt && (!exact || ts > exact.sourceTs)) exact = pick;
      if (Math.floor(ts / 60_000) * 60_000 === probeAt) floored = pick;
    });
    for (const [key, source] of buckets) if (source > key) lateBuckets++;
    pulseAsOfProbes.push({ ...spec, decisionAt: new Date(probeAt).toISOString(), trueAsOf: exact, legacyMinuteLookup: floored, observedMinuteBuckets: buckets.size, bucketsUsingLaterSourceAtMinuteStart: lateBuckets });
  }
  const currentQty = sum(state.positions, "qty");
  const currentEntryNotional = sum(state.positions, "notional");
  const summary = {
    capturedAt: new Date().toISOString(), sourceCutoff: new Date(cutoff).toISOString(), periods,
    monthly: [...new Set(closes.map(r => r.ts.slice(0, 7)))].sort().map(month => ({ month, batchCloses: closes.filter(r => r.ts.startsWith(month)).length, batchPnl: sum(closes.filter(r => r.ts.startsWith(month)), "totalPnl"), srPnl: sum(partials.filter(r => r.ts.startsWith(month)), "realizedPnl"), shortPnl: sum(shortCloses.filter(r => new Date(r.completedAt).toISOString().startsWith(month)), "pnl") })),
    evidenceCoverage: { lastLegacyOpen: lastLegacyOpen ? new Date(lastLegacyOpen).toISOString() : null, legacyOpensIn60d: trades.filter(r => r.action === "OPEN_LONG" && r.success).length, duplicateTradeRows, liveDecisionAttempts60d: decisionCount, firstDecision: Number.isFinite(firstDecision) ? new Date(firstDecision).toISOString() : null, makerEraDecisionAttempts: decisions.length, retainedLongOpenReceipts: longOpens.length, makerRetainedReceipts: makerReceipts.length, makerRetainedFilled: filledMakers.length, matchingMakerBatches: makerAudit.filter(r => r.matchedBatch).length, currentDecisionConfigLabels: [...new Set(decisions.map(r => r.configVersion))] },
    funding: { totalFunding: state.totalFunding, lastFundingSettlement: state.lastFundingSettlement, exactExchangeSettlementsAvailableInThisAudit: false },
    shortLedger: { closes: shortCloses.length, wins: shortCloses.filter(r => r.pnl > 0).length, netPnl: sum(shortCloses, "pnl"), stateRealized: shortState.realizedPnl, residual: shortState.realizedPnl - sum(shortCloses, "pnl"), closeReceiptFees: sum(shortCloses, "fees"), stateFees: shortState.totalFees, entryEnabled: shortConfig.entryEnabled, active: !!shortState.position, pending: !!shortState.pending, recovery: shortState.recoveryMode, healthWrittenAt: shortHealth.writtenAt },
    makerArithmetic: { coveredFilledOrders: makerAudit.length, sameFillModeledSaving: sum(makerAudit, "sameFillModeledSaving"), maxAbsFeeResidual: Math.max(0, ...makerAudit.map(r => Math.abs(r.feeResidual))), maxAbsPnlResidual: Math.max(0, ...makerAudit.map(r => Math.abs(r.pnlResidual))), actualExchangeFeesVerified: false },
    current: { rungs: state.positions.length, qty: currentQty, entryNotional: currentEntryNotional, grossUnrealizedAtLastEquityQuote: latest ? latest.price * currentQty - currentEntryNotional : null, priceTimestamp: latest?.ts, equity: latest?.equity, cumulativeLongRealized: state.realizedPnl, cumulativeLongFees: state.totalFees, recovery: state.recoveryMode, pending: !!state.pendingOrder, makerEnabled: health.makerTp.enabled, makerActive: health.makerTp.active, reconciliation: health.reconciliation },
    operationalCounts, pulseAsOfProbes, noLookaheadCertification: false,
    limitations: ["Logs/state are copied snapshots, not fresh exchange queries", "Periods group realized exits, not causal feature uplift", "Bounded receipt rings prevent full execution reconstruction", "Minute replay cannot certify historical live arrival-time availability", "Short native close fees/order evidence differ from model estimates; no funding/cash-flow export"] };
  write("summary.json", summary); write("batch-closes.json", closes); write("sr-partials.json", partials); write("short-closes.json", shortCloses);
  write("maker-matches.json", makerAudit); write("open-matches.json", openMatches); write("decision-attempts.json", decisions); write("operational-timeline.json", transitions);
  write("equity-realized-residuals.json", equityResiduals);
  for (const file of ["scripts/hype-current-stack-attribution.ts", "src/bot/state.ts", "src/bot/index.ts", "src/bot/long-transaction-coordinator.ts"]) await readLines(file, () => {});
  write("manifest.json", { capturedAt: new Date().toISOString(), inputs });
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
