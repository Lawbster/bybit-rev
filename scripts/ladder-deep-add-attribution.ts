/** Read-only attribution of the unchanged causal engine's actual decisions/fills. */
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import type { LadderPosition } from "../src/bot/state";
import type { EngineResult, Series } from "./hype-freerun-canonical-replay";
import { ReplaySrContext } from "./replay-sr-context";
import { emptyReplayPulse } from "./replay-market-inputs";
import { checkBatchTp, checkDeepAddStressGuard, checkSoftStale } from "../src/bot/strategy";
import { evaluateSRSupportReopen } from "../src/bot/sr-support-reopen";
import { evaluateSRShadowCandidates } from "../src/bot/sr-shadow";

const M = 60_000;
export interface DeepAddSpec {
  version: number; id: string; symbol: string; baselineDir: string; repairFile: string; sourceManifest: string;
  historyEnd: string; pulseStart: string; split: string; minimumNextDepth: number; nearResistancePct: number;
  farResistancePct: number; takerSellMax: number; takerBuyMin: number; minimumTaker15mSamples: number;
  maximumTakerAgeSec: number; delayMinutes: number[]; minimumCellAdds: number; minimumCellEpisodes: number; minimumHalfEpisodes: number;
}
export type AddFeature = {
  id: string; model: string; episode: number; at: number; iso: string; index: number; nextDepth: number;
  reason: string; timeOk: boolean; priceDropOk: boolean; intervalMinutes: number; lastAddTime: number;
  decisionPrice: number; intendedNotional: number; priorNotional: number; priorQty: number; priorAvg: number | null;
  ladderPnlPct: number | null; oldestAgeHours: number | null; activeTpPct: number; tpPrice: number | null; tpDistancePct: number | null;
  srHealthy: boolean; srBuildBoundary: number; resistance: { price: number; distPct: number; touches: number; latestConfirmationAt: number } | null;
  support: { price: number; distPct: number } | null; resistanceBand: string; ret15m: number | null;
  aboveEma200: boolean; trendBlocked: boolean; riskOffBlocked: boolean; regimeBlocked: boolean; rsi1h: number | null; crsi4h: number | null;
  pulseHealthy: boolean; pulseClass: string; taker15m: number | null; taker1h: number | null; takerSamples: number; takerAgeSec: number | null;
  buy15m: number | null; sell15m: number | null; bookImbalance: number | null; bookAgeSec: number | null;
  nativeOi1hPct: number | null; markedOi1hPct: number | null; funding: Array<number | null>;
  deepStressBlocked: boolean; stressKinds: string[]; supportReopened: boolean;
};
export type AddOutcome = {
  id: string; episode: number; fillAt: number; fillPrice: number; qty: number; notional: number;
  exitAt: number | null; exitPrice: number | null; exitReason: string; pnl: number; netReturnPct: number; closed: boolean;
  episodeCloseAt: number | null; episodeReason: string; episodeNetPnl: number | null;
  waits: Array<{ minutes: number; at: number; available: boolean; buyPriceSavingPct: number | null; rungClosedBeforeWait: boolean; episodeClosedBeforeWait: boolean }>;
};
export type AttributedAdd = { feature: AddFeature; outcome: AddOutcome };
const near = (a: number, b: number, label: string) => assert(Math.abs(a - b) <= 1e-7 + 1e-10 * Math.max(Math.abs(a), Math.abs(b)), `${label}: ${a} != ${b}`);
const sum = (xs: LadderPosition[], key: "qty" | "notional") => xs.reduce((v, p) => v + p[key], 0);
const net = (p: LadderPosition, price: number, fee: number) => (price - p.entryPrice) * p.qty - fee * (p.notional + price * p.qty);

/** Mimic EVERY engine query, including its rebuild cadence; sparse queries drift. */
export class DecisionSrClock {
  private next: number;
  private context: ReturnType<ReplaySrContext["at"]> | null = null;
  constructor(private series: Pick<Series, "candles">, private sr: ReplaySrContext, startIndex: number) { this.next = startIndex; }
  at(index: number) {
    assert(index >= this.next - 1, "Decision context cannot run backward");
    while (this.next <= index) this.context = this.sr.at(this.series.candles[this.next++].endTs);
    assert(this.context); return this.context;
  }
}

export function attributeAdds(result: EngineResult, s: Series, config: BotConfig, spec: DeepAddSpec, startIndex: number, endIndex: number, model: string) {
  assert(result.executionAudit && result.snapshots.length === endIndex - startIndex, "Complete unchanged-engine snapshots required");
  assert(config.srShadow && s.marketInputs, "Current shared context and pulse tape required");
  const clock = new DecisionSrClock(s, new ReplaySrContext(s.candles, config.srShadow), startIndex);
  const snapshots = result.snapshots;
  let positions: LadderPosition[] = [], episode = 0;
  const rows: AttributedAdd[] = [], byPosition = new Map<string, AttributedAdd>();
  const closes = new Map(result.closes.map(c => [c.episode, c]));
  const index = new Map(s.candles.map((c, i) => [c.ts, i]));
  let realized = 0, allocationChecks = 0, snapshotChecks = 0;
  const snapshotAt = (i: number) => { const snap = snapshots[i - startIndex]; assert(snap && snap.ts === s.candles[i].endTs); return snap; };
  function settle(p: LadderPosition, price: number, at: number, reason: string) {
    const row = byPosition.get(p.id)!; assert(row && !row.outcome.closed);
    const pnl = net(p, price, config.feeRate); realized += pnl;
    Object.assign(row.outcome, { exitAt: at, exitPrice: price, exitReason: reason, pnl, netReturnPct: pnl / p.notional * 100, closed: true });
  }
  for (const event of result.executionAudit.events) {
    assert(event.fillAt !== null && event.fillIndex !== null && event.price !== null);
    const at = event.decisionAt, i = event.decisionIndex;
    if (event.kind === "open") {
      const c = s.candles[i], before = snapshotAt(i), ctx = clock.at(i);
      assert.equal(at, c.endTs); assert.equal(event.fillIndex, i + 1); assert.equal(event.fillAt, at);
      assert.equal(before.depth, positions.length); near(before.longQty, sum(positions, "qty"), "pre-add qty");
      near(before.longNotional, sum(positions, "notional"), "pre-add cost"); snapshotChecks++;
      const snapshot = s.marketInputs.snapshot(at), pulse = snapshot.pulse;
      pulse.fdByNow = pulse.fdByNow ?? s.bybitFunding[i]; pulse.btc4hMovePct = s.btcRet4h?.[i] ?? null;
      const lastAddTime = positions.length ? Math.max(...positions.map(p => p.entryTime)) : 0;
      let interval = config.addIntervalMin;
      if (config.addThrottle?.enabled && positions.length >= config.addThrottle.depth && s.ret6h[i] <= config.addThrottle.slopeThreshold) interval *= config.addThrottle.mult;
      const timeOk = at - lastAddTime >= interval * M;
      const drop = config.priceTriggerPct > 0 && positions.length > 0 && c.close <= positions.at(-1)!.entryPrice * (1 - config.priceTriggerPct / 100);
      assert(timeOk || drop); assert.equal(event.reason, drop ? "price_drop" : "time_add");
      assert(!s.trendBlocked[i] && !s.riskOffBlocked[i] && !s.regimeFlat[i]);
      const guard = checkDeepAddStressGuard(positions, drop, pulse, config);
      const reopened = guard.blocked && !!config.srSupportReopenAction && evaluateSRSupportReopen({ contextHealthy: ctx.coverage.healthy,
        liveGuardBlocked: guard.blocked, liveGuardReasons: guard.reasons, fundingStressOnly: guard.stressKinds.length > 0 && guard.stressKinds.every(k => k === "funding"),
        priceDropOk: drop, nextDepth: positions.length + 1, support: ctx.engine.nearestSupport(at, c.close), pulse, config: config.srSupportReopenAction }).eligible;
      assert(!guard.blocked || reopened, "An actual add must pass the same live guard/support policy");
      const zones = ctx.engine.getZones(at), r = zones.filter(z => z.price > c.close).sort((a, b) => a.price - b.price)[0];
      const support = zones.filter(z => z.price < c.close).sort((a, b) => b.price - a.price)[0];
      const resistance = r ? { price: r.price, distPct: (r.price / c.close - 1) * 100, touches: r.touches, latestConfirmationAt: Math.max(...r.touchData.map(t => t.ts)) } : null;
      if (resistance) assert(resistance.latestConfirmationAt <= at);
      const rawAge = pulse.hlTakerAgeSec ?? null, samples = pulse.hlTaker15mSamples ?? 0;
      const pulseHealthy = pulse.hlTaker15m != null && samples >= spec.minimumTaker15mSamples && rawAge !== null && rawAge >= 0 && rawAge <= spec.maximumTakerAgeSec;
      const pulseClass = !pulseHealthy ? "unknown" : pulse.hlTaker15m! <= spec.takerSellMax ? "selling" : pulse.hlTaker15m! >= spec.takerBuyMin ? "buying" : "neutral";
      const activeTpPct = checkSoftStale(positions, c.close, at, config).reducedTpPct ?? config.tpPct;
      const tpPrice = positions.length ? checkBatchTp(positions, activeTpPct, c.close).tpPrice : null;
      const lag = index.get(at - 16 * M), ret15m = lag !== undefined && s.candles[lag].endTs === at - 15 * M ? (c.close / s.candles[lag].close - 1) * 100 : null;
      if (!positions.length) episode++;
      const p: LadderPosition = { id: `replay-${event.fillIndex}-${positions.length}`, entryTime: event.fillAt, entryPrice: event.price,
        notional: config.basePositionUsdt * config.addScaleFactor ** positions.length, qty: event.qty, level: positions.length };
      near(p.qty * p.entryPrice, p.notional, "add notional");
      const feature: AddFeature = { id: p.id, model, episode, at, iso: new Date(at).toISOString(), index: i, nextDepth: positions.length + 1,
        reason: event.reason, timeOk, priceDropOk: drop, intervalMinutes: interval, lastAddTime, decisionPrice: c.close, intendedNotional: p.notional,
        priorNotional: before.longNotional, priorQty: before.longQty, priorAvg: before.longAvgEntry,
        ladderPnlPct: before.longAvgEntry ? (c.close / before.longAvgEntry - 1) * 100 : null,
        oldestAgeHours: positions.length ? (at - Math.min(...positions.map(p => p.entryTime))) / 3600000 : null,
        activeTpPct, tpPrice, tpDistancePct: tpPrice === null ? null : (tpPrice / c.close - 1) * 100,
        srHealthy: ctx.coverage.healthy, srBuildBoundary: Math.floor(at / (config.srShadow.tfMin * M)) * config.srShadow.tfMin * M, resistance,
        support: support ? { price: support.price, distPct: (1 - support.price / c.close) * 100 } : null,
        resistanceBand: !ctx.coverage.healthy ? "unknown" : !resistance ? "no_level_above" : resistance.distPct <= spec.nearResistancePct ? "near" : resistance.distPct <= spec.farResistancePct ? "intermediate" : "far",
        ret15m, aboveEma200: s.aboveEma200[i], trendBlocked: s.trendBlocked[i], riskOffBlocked: s.riskOffBlocked[i], regimeBlocked: s.regimeFlat[i],
        rsi1h: s.rsi1H[i], crsi4h: s.crsi4H[i], pulseHealthy, pulseClass, taker15m: pulse.hlTaker15m ?? null, taker1h: pulse.hlTaker1h ?? null,
        takerSamples: samples, takerAgeSec: rawAge, buy15m: pulse.hlTaker15mBuyNotional ?? null, sell15m: pulse.hlTaker15mSellNotional ?? null,
        bookImbalance: pulse.hlObImbalance05, bookAgeSec: pulse.hlObAgeSec, nativeOi1hPct: snapshot.research.nativeOi1hPct, markedOi1hPct: snapshot.research.markedOi1hPct,
        funding: [pulse.fdByNow, pulse.fdBnNow, pulse.fdHlNow], deepStressBlocked: guard.blocked, stressKinds: guard.stressKinds, supportReopened: reopened };
      const outcome: AddOutcome = { id: p.id, episode, fillAt: p.entryTime, fillPrice: p.entryPrice, qty: p.qty, notional: p.notional,
        exitAt: null, exitPrice: null, exitReason: "open_at_end", pnl: 0, netReturnPct: 0, closed: false,
        episodeCloseAt: null, episodeReason: "open_at_end", episodeNetPnl: null, waits: [] };
      const row = { feature, outcome }; rows.push(row); byPosition.set(p.id, row); positions.push(p);
    } else if (event.kind === "partial") {
      const ctx = clock.at(i), c = s.candles[i], before = snapshotAt(i);
      assert.equal(positions.length, before.depth); near(sum(positions, "qty"), before.longQty, "pre-partial qty"); snapshotChecks++;
      const pulse = s.marketInputs.snapshot(at).pulse ?? emptyReplayPulse();
      pulse.fdByNow = pulse.fdByNow ?? s.bybitFunding[i]; pulse.btc4hMovePct = s.btcRet4h?.[i] ?? null;
      const pct = checkSoftStale(positions, c.close, at, config).reducedTpPct ?? config.tpPct;
      const d = evaluateSRShadowCandidates({ symbol: config.symbol, nowMs: at, price: c.close, positions, pulse, config, zoneEngine: ctx.engine,
        contextCoverage: ctx.coverage, contextCoverageHorizonDays: config.srShadow.recentDays,
        addContext: { canAddTiming: false, timeGateOk: false, priceDropOk: false, atOldCap: false, tpPct: pct } });
      assert(d?.partialExitPlan && d.firedCandidates.includes(config.srPartialExitAction!.requiredCandidate));
      const ids = new Set(d.partialExitPlan.closeIndices.map(j => positions[j].id));
      const selected = positions.filter(p => ids.has(p.id)); near(sum(selected, "qty"), event.qty, "exact selected-rung partial qty");
      const record = result.trims.find(t => t.ts === event.fillAt && t.episode === episode); assert(record);
      near(selected.reduce((v, p) => v + net(p, event.price!, config.feeRate), 0), record.pnl, "partial net PnL"); allocationChecks++;
      selected.forEach(p => settle(p, event.price!, event.fillAt!, "sr_partial")); positions = positions.filter(p => !ids.has(p.id));
    } else if (event.kind === "close") {
      const record = closes.get(episode); assert(record && record.closeTs === event.fillAt);
      near(sum(positions, "qty"), event.qty, "full close qty");
      near(positions.reduce((v, p) => v + net(p, event.price!, config.feeRate), 0), record.pnl, "full close PnL");
      positions.forEach(p => settle(p, event.price!, event.fillAt!, event.reason)); positions = [];
    } else throw new Error(`Unexpected execution kind: ${event.kind}`);
  }
  const endPrice = s.candles[endIndex - 1].close;
  for (const p of positions) { const o = byPosition.get(p.id)!.outcome; o.pnl = net(p, endPrice, config.feeRate); o.netReturnPct = o.pnl / p.notional * 100; }
  near(realized, result.realized, "all realized rung contributions");
  near(positions.reduce((v, p) => v + net(p, endPrice, config.feeRate), 0), result.openPnl, "open rung contributions");
  for (const row of rows) {
    const o = row.outcome, close = closes.get(o.episode);
    if (close) Object.assign(o, { episodeCloseAt: close.closeTs, episodeReason: close.reason, episodeNetPnl: close.pnl + close.trimPnlInEpisode });
    o.waits = spec.delayMinutes.map(minutes => {
      const at = row.feature.at + minutes * M, j = index.get(at);
      const available = j !== undefined && j < endIndex;
      return { minutes, at, available, buyPriceSavingPct: available ? (1 - s.candles[j!].open / o.fillPrice) * 100 : null,
        rungClosedBeforeWait: o.exitAt !== null && o.exitAt <= at, episodeClosedBeforeWait: o.episodeCloseAt !== null && o.episodeCloseAt <= at };
    });
  }
  return { rows, validation: { adds: rows.length, episodes: episode, snapshotChecks, exactPartialAllocationChecks: allocationChecks,
    attributedRealized: realized, attributedOpen: result.openPnl, noExecutionPolicyChange: true, counterfactualPnl: false } };
}

export const average = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function summarizeAdds(rows: AttributedAdd[], spec: DeepAddSpec) {
  const deep = rows.filter(r => r.feature.nextDepth >= spec.minimumNextDepth), pulseEra = deep.filter(r => r.feature.at >= Date.parse(spec.pulseStart));
  const eligible = pulseEra.filter(r => r.feature.srHealthy && r.feature.pulseHealthy);
  function stats(xs: AttributedAdd[]) {
    const episodes = [...new Map(xs.map(r => [r.feature.episode, r.outcome])).values()], closed = xs.filter(r => r.outcome.closed);
    return { adds: xs.length, episodes: episodes.length, closedAdds: closed.length, openAdds: xs.length - closed.length,
      realizedContribution: closed.reduce((v, r) => v + r.outcome.pnl, 0), openContribution: xs.filter(r => !r.outcome.closed).reduce((v, r) => v + r.outcome.pnl, 0),
      meanRungNetPct: average(closed.map(r => r.outcome.netReturnPct)), profitableRungs: closed.filter(r => r.outcome.pnl > 0).length,
      positiveRungPnl: closed.filter(r => r.outcome.pnl > 0).reduce((v, r) => v + r.outcome.pnl, 0),
      negativeRungPnl: closed.filter(r => r.outcome.pnl <= 0).reduce((v, r) => v + r.outcome.pnl, 0),
      tpEpisodes: episodes.filter(e => ["tp", "stale_tp"].includes(e.episodeReason)).length,
      forcedEpisodes: episodes.filter(e => !["tp", "stale_tp", "open_at_end"].includes(e.episodeReason)).length,
      openEpisodes: episodes.filter(e => e.episodeReason === "open_at_end").length,
      partialClosedAdds: closed.filter(r => r.outcome.exitReason === "sr_partial").length,
      // Unique within each cohort only. Never add episode PnL across overlapping cohorts.
      uniqueEpisodePnl: episodes.reduce((v, e) => v + (e.episodeNetPnl ?? 0), 0),
      ...(Object.fromEntries(spec.delayMinutes.flatMap(m => {
        const ws = xs.map(r => r.outcome.waits.find(w => w.minutes === m)!);
        return [[`wait${m}Known`, ws.filter(w => w.available).length], [`wait${m}MeanSavingPct`, average(ws.filter(w => w.available).map(w => w.buyPriceSavingPct!))],
          [`wait${m}RungAlreadyClosed`, ws.filter(w => w.rungClosedBeforeWait).length], [`wait${m}EpisodeAlreadyClosed`, ws.filter(w => w.episodeClosedBeforeWait).length]];
      })) as { wait15MeanSavingPct: number | null; wait60MeanSavingPct: number | null; [key: string]: number | null }) };
  }
  const cohorts: Record<string, any>[] = [], monthly: Record<string, any>[] = [];
  const record = (id: string, xs: AttributedAdd[]) => {
    assert(!cohorts.some(c => c.id === id), `Duplicate cohort: ${id}`);
    cohorts.push({ id, ...stats(xs) });
    for (const month of [...new Set(pulseEra.map(r => r.feature.iso.slice(0, 7)))].sort()) monthly.push({ id, month, ...stats(xs.filter(r => r.feature.iso.startsWith(month))) });
  };
  record("all_deep_all_history", deep); record("deep_pulse_era_all", pulseEra); record("deep_pulse_era_healthy", eligible);
  for (const reason of ["time_add", "price_drop"]) for (const band of ["near", "intermediate", "far", "no_level_above", "unknown"]) {
    record(`${reason}_${band}`, eligible.filter(r => r.feature.reason === reason && r.feature.resistanceBand === band));
  }
  for (const d of [6, 7, 8, 9, 10, 11]) for (const nearR of [true, false]) record(`rung${d}_${nearR ? "near" : "not_near"}`, eligible.filter(r => r.feature.nextDepth === d && (r.feature.resistanceBand === "near") === nearR));
  const root = eligible.filter(r => r.feature.reason === "time_add"), nearRows = root.filter(r => r.feature.resistanceBand === "near");
  for (const p of ["buying", "selling", "neutral"]) record(`near_time_pulse_${p}`, nearRows.filter(r => r.feature.pulseClass === p));
  const cells = [
    { id: "near_time_all", match: (_r: AttributedAdd) => true },
    { id: "near_time_selling", match: (r: AttributedAdd) => r.feature.pulseClass === "selling" },
    { id: "near_time_buying_no_progress", match: (r: AttributedAdd) => r.feature.pulseClass === "buying" && r.feature.ret15m !== null && r.feature.ret15m <= 0 },
  ];
  const hypotheses = cells.map(cell => {
    const chosen = nearRows.filter(cell.match); record(cell.id, chosen);
    const split = Date.parse(spec.split);
    const halves = [false, true].map(later => {
      const rs = chosen.filter(r => (r.feature.at >= split) === later), peers = root.filter(r => r.feature.resistanceBand !== "near" && cell.match(r) && (r.feature.at >= split) === later && r.outcome.closed);
      // Coarse within-half standardization, NOT label-blind causal matching or holdout validation.
      const diffs = rs.filter(r => r.outcome.closed).flatMap(r => {
        const group = peers.filter(p => p.feature.nextDepth === r.feature.nextDepth && p.feature.aboveEma200 === r.feature.aboveEma200);
        return group.length >= 5 ? [r.outcome.netReturnPct - average(group.map(g => g.outcome.netReturnPct))!] : [];
      });
      return { half: later ? "later" : "earlier", ...stats(rs), comparableAdds: diffs.length, withinStratumDeltaPct: average(diffs) };
    });
    const failures: string[] = [], st = stats(chosen);
    if (st.adds < spec.minimumCellAdds || st.episodes < spec.minimumCellEpisodes || halves.some(h => h.episodes < spec.minimumHalfEpisodes)) failures.push("insufficient_episode_support");
    if (halves.some(h => h.withinStratumDeltaPct === null || h.withinStratumDeltaPct >= 0 || h.comparableAdds < 10)) failures.push("no_stable_underperformance_vs_peers");
    if (halves.some(h => typeof h.wait15MeanSavingPct !== "number" || h.wait15MeanSavingPct <= 0)) failures.push("waiting_not_consistently_cheaper");
    return { id: cell.id, ...st, halves, failures, meritsSeparateTimingExperiment: failures.length === 0, deploymentCandidate: false };
  });
  return { allAdds: rows.length, allDeepAdds: deep.length, pulseEraDeepAdds: pulseEra.length, healthyPulseEraDeepAdds: eligible.length,
    coverage: { missingPulse: pulseEra.filter(r => !r.feature.pulseHealthy).length, missingSr: pulseEra.filter(r => !r.feature.srHealthy).length },
    cohorts, monthly, hypotheses, strategyVariantsTested: 0, incrementalPortfolioPnlMeasured: false };
}
