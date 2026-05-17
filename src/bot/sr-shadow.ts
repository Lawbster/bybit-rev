import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { OnChainFeatures } from "./shadow-logger";
import { SRMemoryZoneEngine, SRMemoryZoneHit } from "./sr-memory-zones";

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
  action: "skip_add" | "partial_exit" | "boost_add";
};

type LevelPayload = {
  price: number;
  distPct: number;
  touches: number;
  highTouches: number;
  lowTouches: number;
  confirmTs: number;
  confirmIso: string;
} | null;

export type SRShadowDecision = {
  ts: string;
  timestamp: number;
  source: string;
  symbol: string;
  price: number;
  fired: boolean;
  firedCandidates: string[];
  candidates: Candidate[];
  ladder: {
    depth: number;
    nextDepth: number;
    avgEntry: number | null;
    pnlPct: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  addContext: {
    canAddTiming: boolean;
    timeGateOk: boolean;
    priceDropOk: boolean;
    atOldCap: boolean;
  };
  levels: {
    tf: string;
    nearestResistance: LevelPayload;
    nearestSupport: LevelPayload;
  };
  pulse: Record<string, number | boolean | null>;
  partialExitPlan: {
    keepRungs: number;
    closeCount: number;
    closeQty: number;
    closeNotional: number;
    estimatedPnl: number;
    closeLevels: number[];
  } | null;
};

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

function levelPayload(hit: SRMemoryZoneHit | null): LevelPayload {
  if (!hit) return null;
  return {
    price: hit.lv.price,
    distPct: hit.dist * 100,
    touches: hit.lv.touches,
    highTouches: hit.lv.highTouches,
    lowTouches: hit.lv.lowTouches,
    confirmTs: hit.lv.confirmTs,
    confirmIso: new Date(hit.lv.confirmTs).toISOString(),
  };
}

function ladderStats(positions: LadderPosition[], price: number, nowMs: number) {
  const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = totalQty > 0 ? positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty : null;
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  return {
    depth: positions.length,
    nextDepth: positions.length + 1,
    avgEntry,
    pnlPct: avgEntry ? ((price - avgEntry) / avgEntry) * 100 : null,
    totalNotional,
    oldestAgeHours: oldest ? (nowMs - oldest) / 3600000 : null,
  };
}

function buildPartialExitPlan(positions: LadderPosition[], price: number, keepRungs: number) {
  if (positions.length <= keepRungs) return null;
  const indexed = positions
    .map((p, i) => ({ i, position: p, pnl: (price - p.entryPrice) * p.qty }))
    .sort((a, b) => b.pnl - a.pnl);
  const close = indexed.slice(0, positions.length - keepRungs);
  return {
    keepRungs,
    closeCount: close.length,
    closeQty: close.reduce((s, x) => s + x.position.qty, 0),
    closeNotional: close.reduce((s, x) => s + x.position.notional, 0),
    estimatedPnl: close.reduce((s, x) => s + x.pnl, 0),
    closeLevels: close.map(x => x.position.level),
  };
}

export function evaluateSRShadowCandidates(args: {
  symbol: string;
  nowMs: number;
  price: number;
  positions: LadderPosition[];
  pulse: OnChainFeatures;
  config: BotConfig;
  zoneEngine: SRMemoryZoneEngine;
  addContext: {
    canAddTiming: boolean;
    timeGateOk: boolean;
    priceDropOk: boolean;
    atOldCap: boolean;
  };
}): SRShadowDecision | null {
  const shadowCfg = args.config.srShadow;
  if (!shadowCfg?.enabled) return null;

  const ladder = ladderStats(args.positions, args.price, args.nowMs);
  const resistance = args.zoneEngine.nearestResistance(args.nowMs, args.price);
  const support = args.zoneEngine.nearestSupport(args.nowMs, args.price);
  const oiBreadth4h = avg([args.pulse.oiBy4hPct, args.pulse.oiBn4hPct, args.pulse.oiHl4hPct]);
  const anyFundingNegative = [args.pulse.fdByNow, args.pulse.fdBnNow, args.pulse.fdHlNow]
    .some(v => typeof v === "number" && v < 0);
  const pulseHostile =
    (oiBreadth4h !== null && oiBreadth4h < 0) ||
    (args.pulse.taker4h !== null && args.pulse.taker4h < 1) ||
    anyFundingNegative;
  const pulseReclaim =
    (oiBreadth4h !== null && oiBreadth4h > 0) &&
    (args.pulse.taker4h !== null && args.pulse.taker4h > 1) &&
    !anyFundingNegative;

  const nearResistance = !!resistance;
  const nearSupport = !!support;
  const addEligible = args.addContext.canAddTiming;
  const deep5 = ladder.nextDepth >= 5;
  const deep8 = ladder.nextDepth >= 8;
  const partialPlan = resistance && resistance.dist <= (shadowCfg.partialBufferPct ?? 0.3) / 100
    ? buildPartialExitPlan(args.positions, args.price, shadowCfg.keepRungs ?? 3)
    : null;

  const candidates: Candidate[] = [
    {
      name: "zone30_skip_resistance_deep5_hostile_pulse_shadow",
      action: "skip_add",
      fired: addEligible && deep5 && nearResistance && pulseHostile,
      reason: `addEligible=${addEligible}; nextDepth=${ladder.nextDepth}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_skip_resistance_deep8_hostile_pulse_shadow",
      action: "skip_add",
      fired: addEligible && deep8 && nearResistance && pulseHostile,
      reason: `addEligible=${addEligible}; nextDepth=${ladder.nextDepth}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_partial_exit_resistance_keep3_shadow",
      action: "partial_exit",
      fired: !!partialPlan && partialPlan.closeCount > 0,
      reason: `depth=${ladder.depth}; keep=${shadowCfg.keepRungs ?? 3}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; estPnl=${partialPlan ? partialPlan.estimatedPnl.toFixed(2) : "NA"}`,
    },
    {
      name: "zone30_boost_support_deep5_reclaim_pulse_shadow",
      action: "boost_add",
      fired: addEligible && deep5 && nearSupport && pulseReclaim,
      reason: `addEligible=${addEligible}; nextDepth=${ladder.nextDepth}; Sdist=${support ? (support.dist * 100).toFixed(2) : "NA"}%; pulseReclaim=${pulseReclaim}`,
    },
  ];

  const firedCandidates = candidates.filter(c => c.fired).map(c => c.name);

  return {
    ts: new Date(args.nowMs).toISOString(),
    timestamp: args.nowMs,
    source: "hedgeguy-bot",
    symbol: args.symbol,
    price: args.price,
    fired: firedCandidates.length > 0,
    firedCandidates,
    candidates,
    ladder,
    addContext: args.addContext,
    levels: {
      tf: `${shadowCfg.tfMin ?? 30}m_memory`,
      nearestResistance: levelPayload(resistance),
      nearestSupport: levelPayload(support),
    },
    pulse: {
      taker4h: args.pulse.taker4h,
      oiBy4hPct: args.pulse.oiBy4hPct,
      oiBn4hPct: args.pulse.oiBn4hPct,
      oiHl4hPct: args.pulse.oiHl4hPct,
      oiBreadth4h,
      fdByNow: args.pulse.fdByNow,
      fdBnNow: args.pulse.fdBnNow,
      fdHlNow: args.pulse.fdHlNow,
      anyFundingNegative,
      pulseHostile,
      pulseReclaim,
      btc4hMovePct: args.pulse.btc4hMovePct,
      liq4hLongUsd: args.pulse.liq4hLongUsd,
      liq4hShortUsd: args.pulse.liq4hShortUsd,
      liq4hLongShortRatio: args.pulse.liq4hLongShortRatio,
    },
    partialExitPlan: partialPlan,
  };
}

export function writeSRShadowSignal(symbol: string, decision: SRShadowDecision): void {
  const outPath = path.resolve(process.cwd(), "data", `${symbol}_sr_shadow_signals.jsonl`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(outPath, JSON.stringify(decision) + "\n");
}
