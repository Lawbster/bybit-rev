/** The existing Agg10 policy on OWNED main rungs. No exchange writes, no new
 * thresholds. Inputs must already be published; a missing source disables only
 * its dependent action. Independent price exits remain reachable while paused.
 */
import type { Candle } from '../../fetch-candles';
import type { BotConfig } from '../bot-config';
import { validateAggressive10Basis } from '../bot-config';
import { checkTrendGate, checkMarketRiskOff, checkOverextendedEntry, checkRegimeBreaker,
  checkLadderKill, checkEmergencyKill, checkFundingSpike, checkHardFlatten, calcAddSize } from '../strategy';
import { buildDamagedRegimeStructure, evaluateDamagedRegimeLatch } from '../damaged-regime-latch';
import { aggressive10HighExit, AGGRESSIVE10_HIGH_REASON, type Aggressive10HighSnapshot } from '../aggressive10-policy';
import { evaluateTimeStop, TIME_STOP_RESEARCH_PARAMS } from '../time-stop';
import { canExecuteSRPartialAction, evaluateSRShadowCandidates, type SRShadowDecision } from '../sr-shadow';
import type { MainCloseTerms, MainPartialAction } from './main-control-state';
import { ownedMainPositions, mainInventoryKey } from './main-bridge';
import type { PortfolioLedger } from './ledger';
import { epoch, MINUTE as M } from './contract';

const H = 60 * M, DAY = 24 * H;
export interface Published<T> { at: number; value: T }
export interface MainCandleInput extends Published<Candle[]> { healthy: boolean }
type SRInput = Pick<Parameters<typeof evaluateSRShadowCandidates>[0], 'zoneEngine' | 'contextCoverage' | 'contextCoverageHorizonDays'>;
export interface MainPolicyInputs {
  quote: Published<{ bid: number; tick: number; qtyStep: number }> | null;
  funding: Published<number> | null;
  hype4h: MainCandleInput | null; btc1h: MainCandleInput | null;
  hype1h: MainCandleInput | null; hype1d: MainCandleInput | null;
  fiveMinute: MainCandleInput | null;
  indicators: Published<{ crsi4H: number | null; rsi1H: number | null }> | null;
  pulse: Published<Parameters<typeof evaluateSRShadowCandidates>[0]['pulse']> | null;
  sr: Published<SRInput> | null;
  high: Published<Aggressive10HighSnapshot> | null;
  reference7d: Published<{ close: number; closeTime: number }> | null;
}
export type MainAction = { kind: 'flatten'; reason: string; terms: MainCloseTerms; inventory: string }
  | { kind: 'partial'; action: Omit<MainPartialAction, 'completedAt' | 'outcome'> };
export interface MainPolicyReport {
  action: MainAction | null; issues: string[]; srDecision: SRShadowDecision | null;
  trend: ReturnType<typeof checkTrendGate> | null;
}
export function published<T>(x: Published<T> | null, now: number, age = 5000): x is Published<T> {
  return !!x && Number.isSafeInteger(x.at) && x.at <= now && now - x.at <= age;
}
/** Latest required finalized bar plus contiguous, finite closed history. A feed
 * cannot accidentally label a forming or stale bar healthy. Ten-second grace is
 * identical to the existing finalized-candle sources, not an added trade lag.
 */
export function mainCandles(x: MainCandleInput | null, tf: number, count: number, now: number, grace = 10_000, tailOnly = false): Candle[] | null {
  if (!published(x, now) || !x.healthy || x.value.length < count) return null;
  const rows = tailOnly ? x.value.slice(-count) : x.value, expected = (Math.floor((now - grace) / tf) - 1) * tf;
  if (rows.at(-1)!.timestamp !== expected) return null;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];
    if (!Number.isSafeInteger(c.timestamp) || c.timestamp % tf !== 0 || c.timestamp + tf + grace > now
      || (i > 0 && c.timestamp !== rows[i - 1].timestamp + tf)
      || ![c.open, c.high, c.low, c.close].every(v => Number.isFinite(v) && v > 0)
      || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) return null;
  }
  return rows;
}
export function validateMainPolicyConfig(c: BotConfig): void {
  validateAggressive10Basis(c);
  if (!c.aggressive10?.enabled || c.timeStop?.mode !== 'live' || c.hedge.enabled || c.maxDrawdownPct !== 0
    || !c.makerTp?.enabled || c.maxPositions !== 11 || c.basePositionUsdt !== 800 || c.addScaleFactor !== 1.35
    || (c.scorePartialFlatten?.enabled && !c.scorePartialFlatten.shadowOnly)
    || c.pullbackExitAction?.enabled || c.pullbackAction?.enabled || c.srLevels?.enabled)
    throw new Error('unsupported main policy; requires frozen portfolio Agg10 actions');
}
export function mainQuote(x: MainPolicyInputs, now: number): NonNullable<MainPolicyInputs['quote']> | null {
  const q = x.quote;
  return published(q, now) && [q.value.bid, q.value.tick, q.value.qtyStep].every(v => Number.isFinite(v) && v > 0) ? q : null;
}
function highSnapshot(x: MainPolicyInputs, now: number): Aggressive10HighSnapshot | null {
  if (!published(x.high, now)) return null;
  const h = x.high.value, at = Math.floor(now / M) * M;
  if (!h.healthy || h.decisionAt !== at || h.sourceStart !== at - 2880 * M || h.bars !== 2880
    || h.high === null || h.close === null || ![h.high, h.close].every(v => Number.isFinite(v) && v > 0)
    || h.high < h.close || h.distancePct === null
    || Math.abs(h.distancePct - Math.max(0, (1 - h.close / h.high) * 100)) > 1e-8) return null;
  return { ...h, decisionReady: h.decisionReady && now - at <= 30_000 };
}
/** Mutates only the supplied draft's durable policy memory. Caller commits it
 * atomically before sending the returned action, then rechecks the inventory.
 */
export function evaluateMainExits(s: PortfolioLedger, c: BotConfig, x: MainPolicyInputs, now: number): MainPolicyReport {
  epoch(now); const m = s.mainControl!;
  if (!m) throw new Error('missing main control');
  const clock = m.policy ??= { lastLatchAt: 0, lastHighDecisionAt: 0, addRetryAfter: 0 };
  const p = ownedMainPositions(s), inv = mainInventoryKey(s);
  const h4 = mainCandles(x.hype4h, 4 * H, c.filters.trendEmaLong + 1, now);
  const trend = h4 ? checkTrendGate(h4, c, now) : null;
  const out: MainPolicyReport = { action: null, issues: [], srDecision: null, trend };
  if (trend) m.memory.lastTrendCheck = { timestamp: now, blocked: trend.blocked, reason: trend.reason };
  else out.issues.push('hype4h_unavailable');
  if (c.filters.damagedRegimeLatch?.enabled && now - clock.lastLatchAt >= M) {
    clock.lastLatchAt = now;
    const pulse = published(x.pulse, now, 30_000) ? x.pulse.value : null;
    const d = evaluateDamagedRegimeLatch({ previous: m.memory.damagedRegimeLatch, config: c.filters.damagedRegimeLatch,
      structure: h4 ? buildDamagedRegimeStructure(h4, c.filters.trendEmaLong, c.filters.damagedRegimeLatch.releaseBars, now) : null,
      pulse: pulse ? { taker15m: pulse.hlTaker15m, taker1h: pulse.hlTaker1h,
        taker15mSamples: pulse.hlTaker15mSamples, taker1hSamples: pulse.hlTaker1hSamples,
        takerAgeSec: pulse.hlTakerAgeSec === null ? null : pulse.hlTakerAgeSec + (now - x.pulse!.at) / 1000 } : null, nowMs: now });
    m.memory.damagedRegimeLatch = d.state;
    if (d.pulseStatus === 'incomplete') out.issues.push('damaged_pulse_incomplete');
  }
  if (!p.length || m.closeTerms || (m.partial && m.partial.completedAt === undefined)) return out;
  const q = mainQuote(x, now); if (!q) { out.issues.push('quote_unavailable'); return out; }
  const full = (reason: string, terms: MainCloseTerms): MainPolicyReport => {
    out.action = { kind: 'flatten', reason, terms, inventory: inv }; return out;
  };
  const emergency = checkEmergencyKill(p, q.value.bid, c);
  if (emergency.action === 'flatten') return full(emergency.reason, { kind: 'forced', requestedAt: now });
  const funding = published(x.funding, now) && Number.isFinite(x.funding.value) ? x.funding.value : null;
  if (funding === null) out.issues.push('funding_unavailable');
  const spike = checkFundingSpike(p, funding, c);
  if (spike.action === 'flatten') return full(spike.reason, { kind: 'forced', requestedAt: now });
  const hard = checkHardFlatten(p, q.value.bid, now, trend?.blocked ?? false, c);
  if (hard.action === 'flatten') return full(hard.reason, { kind: 'forced', requestedAt: now });
  const cfg = c.srPartialExitAction;
  if (cfg?.enabled && now >= m.memory.srPartialExitActionUntil) {
    if (published(x.sr, now) && published(x.pulse, now, 30_000) && !x.sr.value.zoneEngine.needsRebuild(now)) {
      const d = evaluateSRShadowCandidates({ ...x.sr.value, symbol: c.symbol, nowMs: now, price: q.value.bid,
        positions: p, pulse: x.pulse.value, config: c,
        addContext: { canAddTiming: false, timeGateOk: false, priceDropOk: false, atOldCap: false, tpPct: c.tpPct } });
      out.srDecision = d;
      const plan = d?.partialExitPlan, r = d?.levels.nearestResistance;
      if (d && plan && r && canExecuteSRPartialAction({ contextHealthy: x.sr.value.contextCoverage.healthy,
        hasDecision: true, hasPlan: true, hasResistance: true, hasRequiredCandidate: d.firedCandidates.includes(cfg.requiredCandidate),
        depthOk: p.length >= cfg.minDepth, remainingDepthOk: p.length > cfg.keepRungs,
        ladderPnlOk: d.ladder.pnlPct !== null && d.ladder.pnlPct >= cfg.minLadderPnlPct,
        planProfitOk: !cfg.requirePlanProfit || plan.estimatedNetPnl > 0,
        resistanceOk: r.distPct <= cfg.resistanceBufferPct, keepOk: plan.keepRungs === cfg.keepRungs })) {
        const idx = plan.closeIndices;
        if (idx.length === plan.closeCount && new Set(idx).size === idx.length && idx.every(i => Number.isInteger(i) && i >= 0 && i < p.length)
          && p.length - idx.length >= cfg.keepRungs && idx.length > 0) {
          out.action = { kind: 'partial', action: { id: `sr:${now}:${inv}`, at: now, inventory: inv,
            positionIds: idx.map(i => p[i].id), reason: `SR PARTIAL EXIT ACTION: ${cfg.requiredCandidate}`,
            cooldownUntil: now + cfg.cooldownMin * M, qtyStep: q.value.qtyStep } }; return out;
        }
      }
    } else out.issues.push('sr_context_unavailable');
  }
  const high = highSnapshot(x, now);
  if (!high) out.issues.push('high_context_unavailable');
  if (high?.decisionReady && high.decisionAt! > clock.lastHighDecisionAt) {
    if (aggressive10HighExit(high, p)) return full(AGGRESSIVE10_HIGH_REASON, { kind: 'high', requestedAt: now,
      policy: { kind: 'aggressive10_high', requestedAt: now, decisionAt: high.decisionAt!, referenceHigh: high.high!, decisionPrice: high.close! } });
    // A firing signal is consumed by the durable exit request, NOT this cursor.
    // Crashing between a policy-memory write and requestExit must not lose it.
    clock.lastHighDecisionAt = high.decisionAt!;
  }
  if (high?.decisionReady) {
    const ref = published(x.reference7d, now) ? x.reference7d.value : null;
    const d = evaluateTimeStop({ positions: p, decisionClose: high.close!, decisionCloseTime: high.decisionAt!,
      referenceClose: ref?.close ?? null, referenceCloseTime: ref?.closeTime ?? null }, TIME_STOP_RESEARCH_PARAMS);
    if (d.fire) return full(d.reason, { kind: 'high', requestedAt: now,
      policy: { kind: 'weak_week_time_stop', requestedAt: now, decisionAt: high.decisionAt!, decisionPrice: high.close!,
        referenceAt: ref!.closeTime, referencePrice: ref!.close } });
    if (d.ageEligible && d.blockedBy?.startsWith('reference_')) out.issues.push(d.blockedBy);
  }
  return out;
}
export interface MainAddDecision { approved: boolean; reasons: string[]; timeGateOk: boolean; priceDropOk: boolean; level: number; notional: number }
export function evaluateMainAdd(s: PortfolioLedger, c: BotConfig, x: MainPolicyInputs, now: number, paused: boolean): MainAddDecision {
  const m = s.mainControl!, p = ownedMainPositions(s), reasons: string[] = [];
  const out: MainAddDecision = { approved: false, reasons, timeGateOk: false, priceDropOk: false,
    level: p.length, notional: calcAddSize(p.length, c.basePositionUsdt, c.addScaleFactor) };
  if (paused) reasons.push('paused');
  if (s.recovery || m.memory.recoveryMode) reasons.push('recovery');
  if (m.closeTerms || (m.partial && m.partial.completedAt === undefined)) reasons.push('main_action_pending');
  if (m.memory.forcedExitCooldownUntil > now) reasons.push('forced_cooldown');
  if ((m.policy?.addRetryAfter ?? 0) > now) reasons.push('add_retry_backoff');
  if (p.length >= c.maxPositions) reasons.push('max_rungs');
  if (!highSnapshot(x, now)) reasons.push('high_context_unavailable');
  const q = mainQuote(x, now); if (!q) reasons.push('quote_unavailable');
  if (reasons.length || !q) return out;
  let interval = c.addIntervalMin;
  if (c.addThrottle?.enabled && p.length >= c.addThrottle.depth) {
    const rows = mainCandles(x.fiveMinute, 5 * M, 72, now, 0, true);
    if (!rows) reasons.push('throttle_context_unavailable');
    else if ((rows.at(-1)!.close / rows.at(-72)!.close - 1) * 100 <= c.addThrottle.slopeThreshold) interval *= c.addThrottle.mult;
  }
  out.timeGateOk = now - m.memory.lastAddTime >= interval * M;
  out.priceDropOk = c.priceTriggerPct > 0 && p.length > 0 && q.value.bid <= p.at(-1)!.entryPrice * (1 - c.priceTriggerPct / 100);
  if (!out.timeGateOk && !out.priceDropOk) reasons.push('timing');
  if (reasons.length) return out;
  const h4 = mainCandles(x.hype4h, 4 * H, c.filters.trendEmaLong + 1, now);
  const btc = mainCandles(x.btc1h, H, 2, now), h1 = mainCandles(x.hype1h, H, 15, now), day = mainCandles(x.hype1d, DAY, 2, now, 0);
  if (c.filters.trendBreak) {
    if (!h4) reasons.push('hype4h_unavailable');
    else { const trend = checkTrendGate(h4, c, now); if (trend.blocked) reasons.push(trend.reason); }
  }
  if (m.memory.damagedRegimeLatch.active && c.filters.damagedRegimeLatch?.enabled) reasons.push('damaged_regime');
  if (c.filters.marketRiskOff) {
    if (!btc) reasons.push('btc1h_unavailable');
    else { const r = checkMarketRiskOff(btc, c, now, m.memory.riskOffUntil, now);
      if (r.riskOffUntil > 0) m.memory.riskOffUntil = r.riskOffUntil;
      if (r.blocked) reasons.push(r.reason); }
  }
  const local = checkLadderKill(p, q.value.bid, now, c); if (local.blocked) reasons.push(local.reason);
  if (c.filters.overextendedEntry?.enabled && !p.length) {
    if (!h1 || !mainCandles(x.fiveMinute, 5 * M, (c.srShadow?.recentDays ?? 14) * 288, now, 0, true)
      || !published(x.indicators, now) || ![x.indicators.value.crsi4H, x.indicators.value.rsi1H]
        .every(v => v !== null && Number.isFinite(v))) reasons.push('overextended_context_unavailable');
    else { const v = x.indicators.value, r = checkOverextendedEntry(p, h1, v.crsi4H, v.rsi1H, c, now);
      if (r.blocked) reasons.push(r.reason); }
  }
  if (c.filters.regimeBreaker?.enabled) {
    if (!day) reasons.push('hype1d_unavailable');
    else { const r = checkRegimeBreaker(day, m.memory.regime, c, now); m.memory.regime = r.state;
      if (r.blocked) reasons.push(r.reason); }
  }
  // Agg10 disables deep-funding stress/support-reopen and post-TP cooldown. The
  // old 4h S/R engine is disabled; shadow-only actions never enter this driver.
  out.approved = reasons.length === 0; return out;
}
