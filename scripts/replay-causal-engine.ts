/** Current long policy, causal minute execution. Not an exchange/maker simulator. */
import type { BotConfig } from "../src/bot/bot-config";
import type { LadderPosition } from "../src/bot/state";
import { canAffordAdd, checkBatchTp, checkDeepAddStressGuard, checkEmergencyKill, checkFundingSpike, checkHardFlatten, checkLadderKill, checkSoftStale } from "../src/bot/strategy";
import { evaluateSRSupportReopen } from "../src/bot/sr-support-reopen";
import { evaluateSRShadowCandidates, canExecuteSRPartialAction } from "../src/bot/sr-shadow";
import { ReplaySrContext } from "./replay-sr-context";
import { emptyReplayPulse } from "./replay-market-inputs";
import type { EngineParams, EngineResult, Series } from "./hype-freerun-canonical-replay";
import { levelAdapter, type LevelStudy } from "./sr-level-ablation-policy";

export interface CausalRunOptions {
  startIdx: number; endIdx?: number; seed?: { ts: number; price: number; notional?: number };
  stopWhenFlat?: boolean; recordSnapshots?: boolean;
  /** Local research only. Can veto an otherwise affordable/gate-approved add, never authorize one. */
  researchAddVeto?: (decision: Readonly<ResearchAddDecision>) => boolean;
  /** Research-only reduction of an otherwise permitted, affordable add. Never increases size. */
  researchAddSize?: (decision: Readonly<ResearchSizeDecision>) => number;
  researchInventoryObserver?: (event: Readonly<ResearchInventoryEvent>) => void;
  /** F06 only: defer a reduced target to the configured normal target, never invent a price. */
  researchTpDeferral?: (decision: Readonly<ResearchTpDecision>) => boolean;
  researchTpObserver?: (target: Readonly<ResearchTpTarget>) => void;
  /** SRT03 only: choose one lower ordinary target after all existing mutation priorities.
   * Held until inventory or ordinary/stale phase changes; never uses this bar's high. */
  researchTpShade?: (decision: Readonly<ResearchTpTarget>) => number | null;
  /** Research only: called after ordinary exits, before entries. No future series exposed. */
  researchReduction?: (decision: Readonly<ResearchReductionDecision>) => ResearchReductionIntent | null;
  /** F05 action-isolation control only. Default retains the original episode add lock. */
  researchPartialAddPolicy?: "freeze" | "ordinary";
  /** Reproduce pre-audit archives ONLY; current transactional live partials preserve the add clock. */
  partialClockModel?: "transactional" | "legacy_reanchor";
  /** SRP01 research only: replace the candidate gate, never the shared action safety gates. */
  researchSrPartialGate?: (decision: Readonly<ResearchSrPartialDecision>) => boolean;
  /** SRL01 only: independently rebuild the same plan, optionally remove the two level gates. */
  researchSrPartialLevelStudy?: LevelStudy;
}
export type ResearchSrPartialDecision = { at: number; index: number; episode: number; depth: number; price: number;
  requiredCandidate: boolean; baseCandidate: boolean; nonPulseEligible: boolean;
  deteriorating: boolean; hostile: boolean; resistancePrice: number; resistanceDistPct: number;
  pnlPct: number | null; planNet: number; closeIds: readonly string[] };
export type ResearchReductionDecision = { at: number; index: number; episode: number; depth: number;
  price: number; qty: number; cost: number; grossPct: number | null; canReduce: boolean; existingPendingReason: string | null };
export type ResearchReductionIntent = { fraction: number; reason: string; fillDelayMs?: number };
export type ResearchTpDecision = { at: number; index: number; episode: number; depth: number; price: number;
  qty: number; avgEntry: number; oldestEntryTime: number; basePct: number; normalPct: number; normalTarget: number };
export type ResearchTpTarget = ResearchTpDecision & { pct: number; targetPrice: number; armedAt: number; armedIndex: number };
export type ResearchSizeDecision = { at: number; index: number; episode: number; nextDepth: number; price: number;
  priceDropOk: boolean; requestedNotional: number; entryCostNotional: number; qty: number; equity: number };
export type ResearchInventoryEvent = { event: ExecutionEvent; episode: number; decisionPrice: number;
  before: readonly Readonly<LadderPosition>[]; after: readonly Readonly<LadderPosition>[]; lastAddTime: number };
export type ResearchAddDecision = {
  at: number; index: number; episode: number; nextDepth: number; price: number; priceDropOk: boolean;
  aboveEma200: boolean; ret12h: number | null; ret15m: number | null; srHealthy: boolean;
  resistancePrice: number | null; resistanceDistPct: number | null; resistanceKnownAt: number | null;
  taker15m: number | null; taker1h: number | null; samples15m: number; samples1h: number; takerAgeSec: number | null;
};
type Pending = { kind: "open" | "close" | "partial"; decisionAt: number; decisionIndex: number; reason: string; notional?: number; ids?: string[]; rsi: number | null;
  researchFraction?: number; researchExecuteAt?: number };
export type ExecutionEvent = { kind: string; decisionAt: number; fillAt: number | null; decisionIndex: number; fillIndex: number | null; price: number | null; qty: number; reason: string };

export function runCausalLongReplay(params: EngineParams, s: Series, opts: CausalRunOptions, liveConfig: BotConfig, initialEquity: number): EngineResult {
  if (opts.researchSrPartialGate && opts.researchSrPartialLevelStudy) throw new Error("Conflicting partial research adapters");
  const allowed = new Set(["id", "executionModel", "tpExecutionModel", "maxPositions", "hardFlattenHours", "hardFlattenPct", "cooldownMode", "pullbackMode", "baseUsdt", "addScale", "priceTriggerPct", "addIntervalMin", "srExec"]);
  for (const k of Object.keys(params)) if (!allowed.has(k) && (params as any)[k] !== undefined) throw new Error(`Causal replay does not support legacy variant ${k}`);
  if (params.pullbackMode !== "none") throw new Error("Causal replay supports the current disabled pullback actions only");
  const config: BotConfig = structuredClone(liveConfig);
  Object.assign(config, { basePositionUsdt: params.baseUsdt ?? config.basePositionUsdt, addScaleFactor: params.addScale ?? config.addScaleFactor,
    priceTriggerPct: params.priceTriggerPct ?? config.priceTriggerPct, addIntervalMin: params.addIntervalMin ?? config.addIntervalMin, maxPositions: params.maxPositions });
  config.exits.hardFlattenHours = params.hardFlattenHours; config.exits.hardFlattenPct = params.hardFlattenPct;
  if (config.hedge.enabled || config.pullbackAction?.enabled || config.pullbackExitAction?.enabled || config.filters.volExpansion || (config.scorePartialFlatten?.enabled && !config.scorePartialFlatten.shadowOnly)) throw new Error("Unsupported enabled live policy in causal replay");
  if (params.srExec) {
    const ro = params.srExec.supportReopen, pe = params.srExec.partialExit;
    if (Object.keys(params.srExec).some(k => !["supportReopen", "partialExit"].includes(k)) || ro && ro.mode !== "buy_pressure" || pe && pe.pulse !== "deteriorating") throw new Error("Unsupported S/R variant; use shared current policies");
    if (ro && config.srSupportReopenAction) Object.assign(config.srSupportReopenAction, { minNextDepth: ro.minNextDepth, supportBufferPct: ro.bufferPct });
    if (pe && config.srPartialExitAction && config.srShadow) {
      Object.assign(config.srPartialExitAction, { minDepth: pe.minDepth, keepRungs: pe.keepRungs, resistanceBufferPct: pe.bufferPct, minLadderPnlPct: pe.minLadderPnlPct, requirePlanProfit: pe.requirePlanProfit, cooldownMin: pe.cooldownMin });
      Object.assign(config.srShadow, { keepRungs: pe.keepRungs, partialBufferPct: pe.bufferPct });
    }
  }
  const end = Math.min(opts.endIdx ?? s.candles.length, s.candles.length);
  if (!Number.isInteger(opts.startIdx) || !Number.isInteger(end) || opts.startIdx < 0 || opts.startIdx >= end) throw new Error("Invalid causal replay window");
  if (config.maxDrawdownPct > 0) throw new Error("Account-level drawdown kill requires a portfolio replay, not this long-only engine");
  for (let i = opts.startIdx; i < end; i++) {
    const c = s.candles[i];
    if (c.endTs !== c.ts + 60000 || i > 0 && c.ts <= s.candles[i - 1].ts ||
      ![c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0) || c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close) ||
      [s.rsi1H[i], s.crsi4H[i], s.slope12h[i], s.ret6h[i]].some(x => x === null || !Number.isFinite(x))) throw new Error(`Invalid candle/context at ${c.ts}`);
  }
  const sr = config.srShadow ? new ReplaySrContext(s.candles, config.srShadow) : null;
  if ((config.srPartialExitAction?.enabled || config.srSupportReopenAction?.enabled) && !s.marketInputs) throw new Error("Causal S/R requires quality-aware marketInputs");
  let positions: LadderPosition[] = [];
  const txn: { pending: Pending | null; target: { price: number; pct: number; at: number; index: number } | null } = { pending: null, target: null };
  let researchShade: { price: number; phasePct: number } | null = null;
  let researchArm: ResearchTpTarget | null = null;
  let lastAddTime = 0, cooldownUntil = 0, srCooldownUntil = 0, episode = 0, episodeStart = 0, episodeDepth = 0, trimPnl = 0, trimCount = 0, minPnlPct = 0;
  let researchNoAdds = false;
  let realized = 0, peak = initialEquity, minEquity = initialEquity, dd = 0, maxDepth = 0, maxNotional = 0, endedFlatAtIdx: number | null = null;
  const closes: EngineResult["closes"] = [], trims: EngineResult["trims"] = [], snapshots: EngineResult["snapshots"] = [], executions: ExecutionEvent[] = [];
  const blocked: Record<string, number> = { trend: 0, riskOff: 0, regime: 0, cooldown: 0, ladderKill: 0, deepStress: 0, overextended: 0, srContext: 0, margin: 0, staleEntryCancelled: 0, gaps: 0 };
  const pnl = (xs: LadderPosition[], price: number) => xs.reduce((v, p) => v + (price - p.entryPrice) * p.qty - config.feeRate * (p.notional + price * p.qty), 0);
  const copyInventory = () => opts.researchInventoryObserver ? positions.map(p => ({ ...p })) : [];
  const observeInventory = (before: LadderPosition[]) => {
    if (!opts.researchInventoryObserver) return;
    const event = executions.at(-1)!;
    opts.researchInventoryObserver(Object.freeze({ event: Object.freeze({ ...event }), episode,
      decisionPrice: s.candles[event.decisionIndex]?.close ?? event.price!, lastAddTime,
      before: Object.freeze(before.map(p => Object.freeze({ ...p }))),
      after: Object.freeze(positions.map(p => Object.freeze({ ...p }))) }));
  };
  const avg = () => positions.reduce((v, p) => v + p.notional, 0) / positions.reduce((v, p) => v + p.qty, 0);
  const updateEquity = (price: number) => {
    const eq = initialEquity + realized + pnl(positions, price);
    peak = Math.max(peak, eq); minEquity = Math.min(minEquity, eq); dd = Math.max(dd, (peak - eq) / peak * 100);
  };
  function arm(price: number, at: number, index: number) {
    if (!positions.length) { txn.target = null; return; }
    const stale = checkSoftStale(positions, price, at, config);
    const basePct = stale.action === "reduce_tp" ? stale.reducedTpPct! : config.tpPct;
    const d = opts.researchTpDeferral || opts.researchTpObserver || opts.researchTpShade ? Object.freeze({ at, index, episode, depth: positions.length, price,
      qty: positions.reduce((n, p) => n + p.qty, 0), avgEntry: avg(), oldestEntryTime: Math.min(...positions.map(p => p.entryTime)),
      basePct, normalPct: config.tpPct, normalTarget: checkBatchTp(positions, config.tpPct, price).tpPrice }) : null;
    const defer = opts.researchTpDeferral && d ? opts.researchTpDeferral(d) : false;
    const pct = defer ? config.tpPct : basePct;
    if (researchShade && researchShade.phasePct !== pct) researchShade = null;
    const tpPrice = researchShade?.price ?? checkBatchTp(positions, pct, price).tpPrice;
    if (!txn.target || txn.target.price !== tpPrice || txn.target.pct !== pct) txn.target = { price: tpPrice, pct, at, index };
    if (opts.researchTpShade && d) researchArm = { ...d, pct, targetPrice: tpPrice, armedAt: txn.target.at, armedIndex: txn.target.index };
    if (opts.researchTpObserver && d) opts.researchTpObserver(Object.freeze({ ...d, pct, targetPrice: tpPrice, armedAt: txn.target.at, armedIndex: txn.target.index }));
  }
  function close(price: number, at: number, index: number, intent: Pending) {
    const before = positions, qty = before.reduce((v, p) => v + p.qty, 0), net = pnl(before, price), entry = avg();
    realized += net;
    closes.push({ variant: params.id, episode, entryIso: new Date(episodeStart).toISOString(), closeIso: new Date(at).toISOString(), closeTs: at,
      reason: intent.reason, rungs: before.length, maxDepth: episodeDepth, avgEntry: entry, exitPrice: price, pnl: net,
      holdHours: (at - Math.min(...before.map(p => p.entryTime))) / 3600000, minPnlPct, trimsInEpisode: trimCount, trimPnlInEpisode: trimPnl, hedgePnlInEpisode: 0, baseUsed: config.basePositionUsdt });
    executions.push({ kind: "close", decisionAt: intent.decisionAt, fillAt: at, decisionIndex: intent.decisionIndex, fillIndex: index, price, qty, reason: intent.reason });
    positions = []; txn.target = null; txn.pending = null; lastAddTime = 0; episodeDepth = 0; trimCount = 0; trimPnl = 0; minPnlPct = 0;
    researchShade = null; researchArm = null;
    researchNoAdds = false;
    observeInventory(before);
    if (["tp", "stale_tp"].includes(intent.reason)) {
      if (config.tpCooldown?.enabled && intent.rsi !== null && intent.rsi > config.tpCooldown.rsi1hThreshold) cooldownUntil = at + config.tpCooldown.cooldownMin * 60000;
    } else cooldownUntil = params.cooldownMode === "live4h" ? (Math.floor(at / 14400000) + 2) * 14400000 : at + Number(params.cooldownMode.replace("h", "")) * 3600000;
    endedFlatAtIdx = index;
  }
  if (opts.seed) {
    if (opts.seed.ts > s.candles[opts.startIdx].ts) throw new Error("Seed must exist before the first execution bar");
    const notional = opts.seed.notional ?? config.basePositionUsdt;
    positions = [{ id: "seed", entryTime: opts.seed.ts, entryPrice: opts.seed.price, notional, qty: notional / opts.seed.price, level: 0 }];
    episode = 1; episodeStart = opts.seed.ts; lastAddTime = opts.seed.ts; episodeDepth = 1; maxDepth = 1;
    arm(opts.seed.price, opts.seed.ts, opts.startIdx - 1);
  }
  for (let i = opts.startIdx; i < end; i++) {
    const c = s.candles[i], now = c.endTs;
    const gap = i > opts.startIdx && c.ts !== s.candles[i - 1].endTs;
    if (gap) blocked.gaps++;
    let closedThisBar = false;
    // Phase 1: only decisions from a PREVIOUS bar can execute at this open.
    if (txn.pending && txn.pending.decisionIndex < i && (txn.pending.researchExecuteAt ?? txn.pending.decisionAt) <= c.ts) {
      const intent: Pending = txn.pending; txn.pending = null;
      if (intent.kind === "open") {
        if (c.ts !== intent.decisionAt) blocked.staleEntryCancelled++;
        else {
          if (!positions.length) { episode++; episodeStart = c.ts; }
          const notional = intent.notional!;
          const inventoryBefore = copyInventory();
          positions.push({ id: `replay-${i}-${positions.length}`, entryTime: c.ts, entryPrice: c.open, notional, qty: notional / c.open, level: positions.length });
          lastAddTime = c.ts; episodeDepth = Math.max(episodeDepth, positions.length); maxDepth = Math.max(maxDepth, positions.length);
          executions.push({ kind: "open", decisionAt: intent.decisionAt, fillAt: c.ts, decisionIndex: intent.decisionIndex, fillIndex: i, price: c.open, qty: notional / c.open, reason: intent.reason });
          observeInventory(inventoryBefore);
          // Model protection as active only after this bar's close, not instantly at the fill.
          txn.target = null;
          researchShade = null; researchArm = null;
        }
      } else if (intent.kind === "close") { close(c.open, c.ts, i, intent); closedThisBar = true; }
      else {
        const inventoryBefore = copyInventory();
        const ids = new Set(intent.ids), fraction = intent.researchFraction;
        const selected = fraction === undefined ? positions.filter(p => ids.has(p.id))
          : positions.map(p => ({ ...p, qty: p.qty * fraction, notional: p.notional * fraction }));
        if (fraction === undefined && selected.length !== ids.size) throw new Error("Pending partial allocation changed before execution");
        const qty = selected.reduce((v, p) => v + p.qty, 0), preQty = positions.reduce((v, p) => v + p.qty, 0), net = pnl(selected, c.open);
        realized += net; trimPnl += net; trimCount++;
        trims.push({ variant: params.id, episode, ts: c.ts, iso: new Date(c.ts).toISOString(), price: c.open, closedShare: qty / preQty, pnl: net, depth: positions.length });
        executions.push({ kind: "partial", decisionAt: intent.decisionAt, fillAt: c.ts, decisionIndex: intent.decisionIndex, fillIndex: i, price: c.open, qty, reason: intent.reason });
        positions = fraction === undefined ? positions.filter(p => !ids.has(p.id))
          : positions.map(p => ({ ...p, qty: p.qty * (1 - fraction), notional: p.notional * (1 - fraction) }));
        if (fraction !== undefined && opts.researchPartialAddPolicy !== "ordinary") researchNoAdds = true;
        if (!positions.length) lastAddTime = 0;
        else if (opts.partialClockModel === "legacy_reanchor") lastAddTime = Math.max(...positions.map(p => p.entryTime));
        observeInventory(inventoryBefore);
        if (fraction === undefined) srCooldownUntil = intent.decisionAt + config.srPartialExitAction!.cooldownMin * 60000;
        txn.target = null;
        researchShade = null; researchArm = null;
      }
    }
    maxNotional = Math.max(maxNotional, positions.reduce((v, p) => v + p.notional, 0));
    // Adverse-path mark, not an assumption that a TP preceded an unseen intrabar low.
    updateEquity(c.low);
    // Phase 2: a prior target may be touched; newly computed targets never see this high.
    if (positions.length && txn.target && txn.target.at <= c.ts && txn.target.index < i && !gap && params.tpExecutionModel === "resting_touch" && c.high >= txn.target.price) {
      // The intrabar touch time is unknown: use context known BEFORE this bar,
      // never this bar's final RSI or the stale RSI from when the target was armed.
      close(txn.target.price, now, i, { kind: "close", decisionAt: txn.target.at, decisionIndex: txn.target.index, reason: txn.target.pct < config.tpPct ? "stale_tp" : "tp", rsi: i > 0 ? s.rsi1H[i - 1] : null });
      closedThisBar = true;
    }
    updateEquity(c.close);
    if (closedThisBar && opts.stopWhenFlat) break;
    const pulse = s.marketInputs?.snapshot(now).pulse ?? emptyReplayPulse();
    // Historical Bybit funding series is explicit model input, not a settlement ledger.
    pulse.fdByNow = pulse.fdByNow ?? s.bybitFunding[i];
    pulse.btc4hMovePct = s.btcRet4h?.[i] ?? null;
    const ctx = sr?.at(now);
    if (ctx && !ctx.coverage.healthy) blocked.srContext++;
    const schedule = (kind: Pending["kind"], reason: string, extra: Partial<Pending> = {}) => {
      txn.pending = { kind, reason, decisionAt: now, decisionIndex: i, rsi: s.rsi1H[i], ...extra };
      if (kind !== "open") txn.target = null; // quiesced for the pending reduction
    };
    // Phase 3: decisions use only the now-closed bar and as-of market evidence.
    if (positions.length) {
      minPnlPct = Math.min(minPnlPct, (c.close / avg() - 1) * 100);
      if (txn.target && c.close >= txn.target.price) schedule("close", txn.target.pct < config.tpPct ? "stale_tp" : "tp");
      else if (checkEmergencyKill(positions, c.close, config).action === "flatten") schedule("close", "emergency_kill");
      else if (checkFundingSpike(positions, pulse.fdByNow, config).action === "flatten") schedule("close", "funding_spike");
      else if (checkHardFlatten(positions, c.close, now, s.trendBlocked[i], config).action === "flatten") schedule("close", "hard_flatten");
      if (!txn.pending) arm(c.close, now, i);
      const action = config.srPartialExitAction;
      if (!txn.pending && action?.enabled && now >= srCooldownUntil && ctx) {
        const d = evaluateSRShadowCandidates({ symbol: config.symbol, nowMs: now, price: c.close, positions, pulse, config, zoneEngine: ctx.engine,
          contextCoverage: ctx.coverage, contextCoverageHorizonDays: config.srShadow!.recentDays,
          addContext: { canAddTiming: false, timeGateOk: false, priceDropOk: false, atOldCap: false, tpPct: txn.target?.pct ?? config.tpPct } });
        let plan = d?.partialExitPlan;
        const resistance = d?.levels.nearestResistance;
        let actionGates = plan && resistance ? { contextHealthy: ctx.coverage.healthy, hasDecision: !!d,
          hasRequiredCandidate: d!.firedCandidates.includes(action.requiredCandidate), hasPlan: true, hasResistance: true,
          depthOk: positions.length >= action.minDepth, remainingDepthOk: positions.length > action.keepRungs,
          ladderPnlOk: d!.ladder.pnlPct !== null && d!.ladder.pnlPct >= action.minLadderPnlPct,
          planProfitOk: !action.requirePlanProfit || plan.estimatedNetPnl > 0, resistanceOk: resistance.distPct <= action.resistanceBufferPct, keepOk: plan.keepRungs === action.keepRungs } : null;
        if (opts.researchSrPartialLevelStudy) {
          const study = opts.researchSrPartialLevelStudy;
          const rebuilt = levelAdapter(positions, c.close, config, d, ctx.coverage.healthy, study.mode);
          plan = rebuilt.plan; actionGates = rebuilt.gates;
          if (rebuilt.nonLevelEligible) {
            const q = Object.freeze({ at: now, index: i, episode, depth: positions.length, price: c.close,
              pnlPct: d!.ladder.pnlPct!, planNet: plan!.estimatedNetPnl,
              closeIds: Object.freeze(plan!.closeIndices.map(j => positions[j].id)), levelEligible: rebuilt.levelEligible,
              resistancePrice: resistance?.price ?? null, resistanceDistPct: resistance?.distPct ?? null,
              deteriorating: d!.pulse.pulseDeteriorating === true, hostile: d!.pulse.pulseHostile === true });
            const pulseChoice = study.pulseGate(q);
            if (typeof pulseChoice !== 'boolean') throw new Error('Research partial pulse gate must return boolean');
            actionGates.hasRequiredCandidate = rebuilt.baseCandidate && pulseChoice;
            study.observe(Object.freeze({ ...q, pulseChoice, fire: canExecuteSRPartialAction(actionGates) }));
          }
        }
        if (actionGates && opts.researchSrPartialGate) {
          const choice = opts.researchSrPartialGate(Object.freeze({ at: now, index: i, episode, depth: positions.length, price: c.close,
            requiredCandidate: actionGates.hasRequiredCandidate,
            baseCandidate: d!.firedCandidates.includes("zone30_partial_exit_resistance_deep6_profit_shadow"),
            nonPulseEligible: canExecuteSRPartialAction({ ...actionGates, hasRequiredCandidate: true }),
            deteriorating: d!.pulse.pulseDeteriorating === true, hostile: d!.pulse.pulseHostile === true,
            resistancePrice: resistance!.price, resistanceDistPct: resistance!.distPct,
            pnlPct: d!.ladder.pnlPct, planNet: plan!.estimatedNetPnl,
            closeIds: Object.freeze(plan!.closeIndices.map(j => positions[j].id)) }));
          if (typeof choice !== "boolean") throw new Error("Research S/R candidate gate must return boolean");
          actionGates.hasRequiredCandidate = choice;
        }
        if (plan && actionGates && canExecuteSRPartialAction(actionGates)) {
          schedule("partial", "sr_partial", { ids: plan.closeIndices.map(j => positions[j].id) });
        }
      }
    }
    if (opts.researchReduction) {
      const qty = positions.reduce((n, p) => n + p.qty, 0), cost = positions.reduce((n, p) => n + p.notional, 0);
      const canReduce = positions.length > 0 && !txn.pending && !closedThisBar;
      const r = opts.researchReduction(Object.freeze({ at: now, index: i, episode, depth: positions.length,
        price: c.close, qty, cost, grossPct: positions.length ? (c.close / avg() - 1) * 100 : null,
        canReduce, existingPendingReason: txn.pending?.reason ?? null }));
      if (r) {
        const delay = r.fillDelayMs ?? 0;
        if (!canReduce || !(r.fraction > 0 && r.fraction <= 1) || !Number.isFinite(r.fraction)
          || !r.reason.startsWith("research_exit:") || !Number.isSafeInteger(delay) || delay < 0 || delay % 60000 !== 0)
          throw new Error("Invalid research reduction or ordinary exit priority violation");
        schedule(r.fraction === 1 ? "close" : "partial", r.reason,
          { researchFraction: r.fraction, researchExecuteAt: now + delay });
      }
    }
    if (!txn.pending && !closedThisBar && researchNoAdds) blocked.researchExitLock = (blocked.researchExitLock ?? 0) + 1;
    if (!txn.pending && !closedThisBar && !researchNoAdds) {
      if (now < cooldownUntil) blocked.cooldown++;
      else if (s.trendBlocked[i]) blocked.trend++;
      else if (s.riskOffBlocked[i]) blocked.riskOff++;
      else if (s.regimeFlat[i]) blocked.regime++;
      else if (checkLadderKill(positions, c.close, now, config).blocked) blocked.ladderKill++;
      else if (positions.length < config.maxPositions) {
        const ext = config.filters.overextendedEntry;
        const over = !positions.length && ext?.enabled && s.slope12h[i]! >= ext.slope12hMin && s.crsi4H[i]! <= ext.crsi4HMax && s.rsi1H[i]! >= ext.rsi1HMin;
        let interval = config.addIntervalMin;
        if (config.addThrottle?.enabled && positions.length >= config.addThrottle.depth && s.ret6h[i] <= config.addThrottle.slopeThreshold) interval *= config.addThrottle.mult;
        const timeOk = now - lastAddTime >= interval * 60000;
        const drop = config.priceTriggerPct > 0 && positions.length > 0 && c.close <= positions.at(-1)!.entryPrice * (1 - config.priceTriggerPct / 100);
        if (over) blocked.overextended++;
        else if (timeOk || drop) {
          const guard = checkDeepAddStressGuard(positions, drop, pulse, config);
          let allowed = !guard.blocked;
          if (!allowed && ctx && config.srSupportReopenAction) allowed = evaluateSRSupportReopen({ contextHealthy: ctx.coverage.healthy,
            liveGuardBlocked: guard.blocked, liveGuardReasons: guard.reasons, fundingStressOnly: guard.stressKinds.length > 0 && guard.stressKinds.every(k => k === "funding"),
            priceDropOk: drop, nextDepth: positions.length + 1, support: ctx.engine.nearestSupport(now, c.close), pulse, config: config.srSupportReopenAction }).eligible;
          if (!allowed) blocked.deepStress++;
          else {
            const notional = config.basePositionUsdt * config.addScaleFactor ** positions.length;
            // Same live affordability predicate; capital here is explicitly a
            // long-only equity model, not the real shared-account wallet.
            if (!canAffordAdd(positions, notional, config.leverage, initialEquity + realized + pnl(positions, c.close))) blocked.margin++;
            else {
              let veto = false;
              if (opts.researchAddVeto) {
                const r = ctx?.engine.getZones(now).filter(z => z.price > c.close).sort((a, b) => a.price - b.price)[0];
                const previous = s.candles[i - 15];
                // Scalars only: no mutable engine state or future series are exposed.
                veto = opts.researchAddVeto(Object.freeze({ at: now, index: i, episode: positions.length ? episode : episode + 1,
                  nextDepth: positions.length + 1, price: c.close, priceDropOk: drop, aboveEma200: s.aboveEma200[i],
                  ret12h: s.ret12h[i], ret15m: previous?.endTs === now - 900000 ? (c.close / previous.close - 1) * 100 : null,
                  srHealthy: ctx?.coverage.healthy ?? false, resistancePrice: r?.price ?? null,
                  resistanceDistPct: r ? (r.price / c.close - 1) * 100 : null,
                  resistanceKnownAt: r ? Math.max(...r.touchData.map(t => t.ts)) : null,
                  taker15m: pulse.hlTaker15m ?? null, taker1h: pulse.hlTaker1h ?? null,
                  samples15m: pulse.hlTaker15mSamples ?? 0, samples1h: pulse.hlTaker1hSamples ?? 0, takerAgeSec: pulse.hlTakerAgeSec ?? null }));
              }
              if (veto) blocked.researchAddVeto = (blocked.researchAddVeto ?? 0) + 1;
              else {
                const requested = opts.researchAddSize?.(Object.freeze({ at: now, index: i, episode: positions.length ? episode : episode + 1,
                  nextDepth: positions.length + 1, price: c.close, priceDropOk: drop, requestedNotional: notional,
                  entryCostNotional: positions.reduce((v, p) => v + p.notional, 0), qty: positions.reduce((v, p) => v + p.qty, 0),
                  equity: initialEquity + realized + pnl(positions, c.close) })) ?? notional;
                if (!Number.isFinite(requested) || requested < 0 || requested > notional) throw new Error("Research sizing must be finite and within [0, requestedNotional]");
                if (requested === 0) blocked.researchAddSize = (blocked.researchAddSize ?? 0) + 1;
                else schedule("open", drop ? "price_drop" : "time_add", { notional: requested });
              }
            }
          }
        }
      }
    }
    // New price selection cannot supersede an existing exit, partial or approved add.
    // Its ordinary TP identity is retained: shading is not a stale/forced close.
    if (opts.researchTpShade && !txn.pending && !closedThisBar && positions.length && txn.target && !researchShade
        && txn.target.pct === config.tpPct && researchArm) {
      const d: ResearchTpTarget = researchArm;
      const selected = opts.researchTpShade(Object.freeze({ ...d }));
      if (selected !== null) {
        if (!Number.isFinite(selected) || selected < d.avgEntry * 1.01 - 1e-9 || selected >= d.normalTarget)
          throw new Error("Research TP shade must be finite, >= gross1%, and below ordinary TP");
        researchShade = { price: selected, phasePct: d.pct };
        txn.target = { price: selected, pct: d.pct, at: now, index: i };
        opts.researchTpObserver?.(Object.freeze({ ...d, targetPrice: selected, armedAt: now, armedIndex: i }));
        if (c.close >= selected) schedule("close", "tp"); // next open; never retroactive target fill
      }
    }
    if (opts.recordSnapshots) snapshots.push({ candleTs: c.ts, ts: now, price: c.close, realizedPnl: realized, longOpenPnl: pnl(positions, c.close), engineOpenPnl: pnl(positions, c.close),
      equity: initialEquity + realized + pnl(positions, c.close), longNotional: positions.reduce((v, p) => v + p.notional, 0), longQty: positions.reduce((v, p) => v + p.qty, 0), longAvgEntry: positions.length ? avg() : null, depth: positions.length });
  }
  return { closes, trims, actions: [], realized, openPnl: pnl(positions, s.candles[end - 1].close), openDepth: positions.length, maxDepthSeen: maxDepth,
    worstClose: closes.length ? Math.min(...closes.map(c => c.pnl)) : 0, bestClose: closes.length ? Math.max(...closes.map(c => c.pnl)) : 0,
    maxDrawdownPct: dd, minEquity, blocked, endedFlatAtIdx, flips: 0, flipPnl: 0, flipFunding: 0, maxOpenNotional: maxNotional, snapshots,
    executionAudit: { model: "causal_next_open", tpModel: params.tpExecutionModel ?? "close_confirmed", events: executions, pendingAtEnd: txn.pending,
      lastAddTime, srCooldownUntil, fundingIncluded: false, makerCertified: false } };
}
