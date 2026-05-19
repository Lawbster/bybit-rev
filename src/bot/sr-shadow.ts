import fs from "fs";
import path from "path";
import { BotConfig } from "./bot-config";
import { LadderPosition } from "./state";
import { OnChainFeatures } from "./shadow-logger";
import { SRMemoryZoneEngine, SRMemoryZoneHit, SRMemoryZoneLevel } from "./sr-memory-zones";

type Candidate = {
  name: string;
  fired: boolean;
  reason: string;
  action: "skip_add" | "partial_exit" | "boost_add" | "profit_protect";
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
    tpPct: number;
    tpPrice: number | null;
    totalNotional: number;
    oldestAgeHours: number | null;
  };
  addContext: {
    canAddTiming: boolean;
    timeGateOk: boolean;
    priceDropOk: boolean;
    atOldCap: boolean;
    timeOnlyAdd: boolean;
    truePriceDropAdd: boolean;
    tpPct: number;
  };
  levels: {
    tf: string;
    nearestResistance: LevelPayload;
    nearestSupport: LevelPayload;
    wideResistance: LevelPayload;
    wideSupport: LevelPayload;
    tpResistance: LevelPayload;
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

function ladderStats(positions: LadderPosition[], price: number, nowMs: number, tpPct: number) {
  const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = totalQty > 0 ? positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty : null;
  const oldest = positions.length ? Math.min(...positions.map(p => p.entryTime)) : null;
  const tpPrice = avgEntry ? avgEntry * (1 + tpPct / 100) : null;
  return {
    depth: positions.length,
    nextDepth: positions.length + 1,
    avgEntry,
    pnlPct: avgEntry ? ((price - avgEntry) / avgEntry) * 100 : null,
    tpPct,
    tpPrice,
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

function nearestZoneAbove(zones: SRMemoryZoneLevel[], price: number, bufferPct: number): SRMemoryZoneHit | null {
  const maxDist = bufferPct / 100;
  let best: SRMemoryZoneLevel | null = null;
  let bestDist = Infinity;
  for (const lv of zones) {
    if (lv.price <= price) continue;
    const dist = (lv.price - price) / price;
    if (dist <= maxDist && dist < bestDist) {
      best = lv;
      bestDist = dist;
    }
  }
  return best ? { lv: best, dist: bestDist } : null;
}

function nearestZoneBelow(zones: SRMemoryZoneLevel[], price: number, bufferPct: number): SRMemoryZoneHit | null {
  const maxDist = bufferPct / 100;
  let best: SRMemoryZoneLevel | null = null;
  let bestDist = Infinity;
  for (const lv of zones) {
    if (lv.price >= price) continue;
    const dist = (price - lv.price) / price;
    if (dist <= maxDist && dist < bestDist) {
      best = lv;
      bestDist = dist;
    }
  }
  return best ? { lv: best, dist: bestDist } : null;
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
    timeOnlyAdd?: boolean;
    truePriceDropAdd?: boolean;
    tpPct?: number;
  };
}): SRShadowDecision | null {
  const shadowCfg = args.config.srShadow;
  if (!shadowCfg?.enabled) return null;

  const tpPct = args.addContext.tpPct ?? args.config.tpPct;
  const ladder = ladderStats(args.positions, args.price, args.nowMs, tpPct);
  const resistance = args.zoneEngine.nearestResistance(args.nowMs, args.price);
  const support = args.zoneEngine.nearestSupport(args.nowMs, args.price);
  const zones = args.zoneEngine.getZones(args.nowMs);
  const wideBufferPct = shadowCfg.wideBufferPct ?? 3.0;
  const tpResistanceBufferPct = shadowCfg.tpResistanceBufferPct ?? 0.75;
  const wideResistance = nearestZoneAbove(zones, args.price, wideBufferPct);
  const wideSupport = nearestZoneBelow(zones, args.price, wideBufferPct);
  const tpResistance = ladder.tpPrice !== null
    ? nearestZoneAbove(zones, ladder.tpPrice, tpResistanceBufferPct)
    : null;
  const oiBreadth4h = avg([args.pulse.oiBy4hPct, args.pulse.oiBn4hPct, args.pulse.oiHl4hPct]);
  const anyFundingNegative = [args.pulse.fdByNow, args.pulse.fdBnNow, args.pulse.fdHlNow]
    .some(v => typeof v === "number" && v < 0);
  const fundingHot = [args.pulse.fdByNow, args.pulse.fdBnNow, args.pulse.fdHlNow]
    .some(v => typeof v === "number" && v >= (shadowCfg.highFundingRate ?? 0.00006));
  const oiHot =
    (oiBreadth4h !== null && oiBreadth4h >= 1.25) ||
    (args.pulse.oiBn4hPct !== null && args.pulse.oiBn4hPct >= 2.0) ||
    (args.pulse.oiBy4hPct !== null && args.pulse.oiBy4hPct >= 2.0) ||
    (args.pulse.oiHl4hPct !== null && args.pulse.oiHl4hPct >= 2.0);
  const pulseHostile =
    (oiBreadth4h !== null && oiBreadth4h < 0) ||
    (args.pulse.taker4h !== null && args.pulse.taker4h < 1) ||
    anyFundingNegative;
  const pulseReclaim =
    (oiBreadth4h !== null && oiBreadth4h > 0) &&
    (args.pulse.taker4h !== null && args.pulse.taker4h > 1) &&
    !anyFundingNegative;
  const pulseDeteriorating =
    (oiBreadth4h !== null && oiBreadth4h <= -0.25) ||
    (args.pulse.taker4h !== null && args.pulse.taker4h <= 0.98) ||
    (args.pulse.btc4hMovePct !== null && args.pulse.btc4hMovePct <= -0.25) ||
    (anyFundingNegative && (
      (oiBreadth4h !== null && oiBreadth4h <= 0) ||
      (args.pulse.taker4h !== null && args.pulse.taker4h <= 1.05)
    ));
  const hlOi1hPct = args.pulse.hlAssetOi1hPct ?? args.pulse.oiHl1hPct;
  const hlOi4hPct = args.pulse.hlAssetOi4hPct ?? args.pulse.oiHl4hPct;
  const hlFundingNow = args.pulse.hlAssetFundingNow ?? args.pulse.fdHlNow;
  const hlAskWall05 =
    (args.pulse.hlObImbalance05 !== null && args.pulse.hlObImbalance05 <= -0.20) ||
    (args.pulse.hlObAskBid05Ratio !== null && args.pulse.hlObAskBid05Ratio >= 1.35);
  const hlBidWall05 =
    (args.pulse.hlObImbalance05 !== null && args.pulse.hlObImbalance05 >= 0.20) ||
    (args.pulse.hlObAskBid05Ratio !== null && args.pulse.hlObAskBid05Ratio <= 0.75);
  const hlBuyPressure =
    (args.pulse.hlTaker15m !== null && args.pulse.hlTaker15m >= 1.20) ||
    (args.pulse.hlTaker1h !== null && args.pulse.hlTaker1h >= 1.20);
  const hlSellPressure =
    (args.pulse.hlTaker15m !== null && args.pulse.hlTaker15m <= 0.85) ||
    (args.pulse.hlTaker1h !== null && args.pulse.hlTaker1h <= 0.90);
  const hlTakerFade =
    args.pulse.hlTaker15m !== null &&
    args.pulse.hlTaker1h !== null &&
    args.pulse.hlTaker15m < args.pulse.hlTaker1h * 0.75;
  const hlOiExpansion =
    (hlOi1hPct !== null && hlOi1hPct >= 0.25) ||
    (hlOi4hPct !== null && hlOi4hPct >= 0.75);
  const hlOiUnwind =
    (hlOi1hPct !== null && hlOi1hPct <= -0.50) ||
    (hlOi4hPct !== null && hlOi4hPct <= -1.00);
  const nearResistance = !!resistance;
  const nearSupport = !!support;
  const tpPathIntoResistance = !!tpResistance && ladder.tpPrice !== null;
  const wideResistanceAhead = !!wideResistance;
  const hlHotAtResistance = (nearResistance || wideResistanceAhead || tpPathIntoResistance) &&
    (hlOiExpansion || hlBuyPressure) &&
    hlAskWall05;
  const addEligible = args.addContext.canAddTiming;
  const timeOnlyAdd = addEligible && args.addContext.timeGateOk && !args.addContext.priceDropOk && !args.addContext.atOldCap;
  const truePriceDropAdd = addEligible && args.addContext.priceDropOk;
  const deep5 = ladder.nextDepth >= 5;
  const deep8 = ladder.nextDepth >= 8;
  const partialPlan = resistance && resistance.dist <= (shadowCfg.partialBufferPct ?? 0.3) / 100
    ? buildPartialExitPlan(args.positions, args.price, shadowCfg.keepRungs ?? 3)
    : null;
  const partialProfitOk = !!partialPlan &&
    partialPlan.closeCount > 0 &&
    partialPlan.estimatedPnl > 0 &&
    ladder.pnlPct !== null &&
    ladder.pnlPct >= 0.25;

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
      name: "zone30_skip_resistance_deep5_timeonly_hostile_shadow",
      action: "skip_add",
      fired: timeOnlyAdd && deep5 && nearResistance && pulseHostile,
      reason: `timeOnlyAdd=${timeOnlyAdd}; nextDepth=${ladder.nextDepth}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_skip_resistance_deep8_timeonly_hostile_shadow",
      action: "skip_add",
      fired: timeOnlyAdd && deep8 && nearResistance && pulseHostile,
      reason: `timeOnlyAdd=${timeOnlyAdd}; nextDepth=${ladder.nextDepth}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_skip_resistance_deep8_timeonly_deteriorating_shadow",
      action: "skip_add",
      fired: timeOnlyAdd && deep8 && nearResistance && pulseDeteriorating,
      reason: `timeOnlyAdd=${timeOnlyAdd}; nextDepth=${ladder.nextDepth}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; pulseDeteriorating=${pulseDeteriorating}`,
    },
    {
      name: "zone30_partial_exit_resistance_keep3_shadow",
      action: "partial_exit",
      fired: !!partialPlan && partialPlan.closeCount > 0,
      reason: `depth=${ladder.depth}; keep=${shadowCfg.keepRungs ?? 3}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; estPnl=${partialPlan ? partialPlan.estimatedPnl.toFixed(2) : "NA"}`,
    },
    {
      name: "zone30_partial_exit_resistance_deep6_profit_shadow",
      action: "partial_exit",
      fired: ladder.depth >= 6 && partialProfitOk,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; estPnl=${partialPlan ? partialPlan.estimatedPnl.toFixed(2) : "NA"}`,
    },
    {
      name: "zone30_partial_exit_resistance_deep6_profit_deteriorating_shadow",
      action: "partial_exit",
      fired: ladder.depth >= 6 && partialProfitOk && pulseDeteriorating,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; estPnl=${partialPlan ? partialPlan.estimatedPnl.toFixed(2) : "NA"}; pulseDeteriorating=${pulseDeteriorating}`,
    },
    {
      name: "zone30_partial_exit_resistance_deep7_profit_hostile_shadow",
      action: "partial_exit",
      fired: ladder.depth >= 7 && partialProfitOk && pulseHostile,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; estPnl=${partialPlan ? partialPlan.estimatedPnl.toFixed(2) : "NA"}; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_boost_support_deep5_reclaim_pulse_shadow",
      action: "boost_add",
      fired: addEligible && deep5 && nearSupport && pulseReclaim,
      reason: `addEligible=${addEligible}; nextDepth=${ladder.nextDepth}; Sdist=${support ? (support.dist * 100).toFixed(2) : "NA"}%; pulseReclaim=${pulseReclaim}`,
    },
    {
      name: "zone30_boost_support_deep5_price_drop_reclaim_shadow",
      action: "boost_add",
      fired: truePriceDropAdd && deep5 && nearSupport && pulseReclaim,
      reason: `truePriceDropAdd=${truePriceDropAdd}; nextDepth=${ladder.nextDepth}; Sdist=${support ? (support.dist * 100).toFixed(2) : "NA"}%; pulseReclaim=${pulseReclaim}`,
    },
    {
      name: "zone30_tp_path_into_resistance_shadow",
      action: "profit_protect",
      fired: ladder.depth > 0 && tpPathIntoResistance,
      reason: `depth=${ladder.depth}; tp=${ladder.tpPrice?.toFixed(4) ?? "NA"}; R=${tpResistance ? tpResistance.lv.price.toFixed(4) : "NA"}; tpToR=${tpResistance ? (tpResistance.dist * 100).toFixed(2) : "NA"}%`,
    },
    {
      name: "zone30_ath_hot_tp_resistance_shadow",
      action: "profit_protect",
      fired: ladder.depth >= 3 && tpPathIntoResistance && (fundingHot || oiHot),
      reason: `depth=${ladder.depth}; tp=${ladder.tpPrice?.toFixed(4) ?? "NA"}; R=${tpResistance ? tpResistance.lv.price.toFixed(4) : "NA"}; fundingHot=${fundingHot}; oiHot=${oiHot}`,
    },
    {
      name: "zone30_ath_wide_resistance_timeonly_block_shadow",
      action: "skip_add",
      fired: timeOnlyAdd && ladder.nextDepth >= 3 && wideResistanceAhead && (fundingHot || oiHot || pulseHostile),
      reason: `timeOnlyAdd=${timeOnlyAdd}; nextDepth=${ladder.nextDepth}; wideR=${wideResistance ? wideResistance.lv.price.toFixed(4) : "NA"}; dist=${wideResistance ? (wideResistance.dist * 100).toFixed(2) : "NA"}%; fundingHot=${fundingHot}; oiHot=${oiHot}; pulseHostile=${pulseHostile}`,
    },
    {
      name: "zone30_hl_ask_wall_profit_protect_shadow",
      action: "profit_protect",
      fired: ladder.depth >= 3 && (tpPathIntoResistance || (nearResistance && (ladder.pnlPct ?? -999) >= 0.25)) && hlAskWall05,
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; tpPath=${tpPathIntoResistance}; Rdist=${resistance ? (resistance.dist * 100).toFixed(2) : "NA"}%; hlAskWall05=${hlAskWall05}; hlObImb05=${args.pulse.hlObImbalance05?.toFixed(3) ?? "NA"}; hlAskBid05=${args.pulse.hlObAskBid05Ratio?.toFixed(3) ?? "NA"}`,
    },
    {
      name: "zone30_hl_buy_exhaustion_profit_protect_shadow",
      action: "profit_protect",
      fired: ladder.depth >= 5 && (nearResistance || wideResistanceAhead || tpPathIntoResistance) && (ladder.pnlPct ?? -999) >= 0.25 && hlAskWall05 && (hlSellPressure || hlTakerFade || hlOiUnwind),
      reason: `depth=${ladder.depth}; pnl=${ladder.pnlPct?.toFixed(2) ?? "NA"}%; hlAskWall05=${hlAskWall05}; hlSellPressure=${hlSellPressure}; hlTakerFade=${hlTakerFade}; hlOiUnwind=${hlOiUnwind}; hlTaker15m=${args.pulse.hlTaker15m?.toFixed(3) ?? "NA"}; hlTaker1h=${args.pulse.hlTaker1h?.toFixed(3) ?? "NA"}; hlOi1h=${hlOi1hPct?.toFixed(3) ?? "NA"}%`,
    },
    {
      name: "zone30_hl_timeonly_askwall_block_shadow",
      action: "skip_add",
      fired: timeOnlyAdd && ladder.nextDepth >= 5 && wideResistanceAhead && hlAskWall05 && !hlBidWall05,
      reason: `timeOnlyAdd=${timeOnlyAdd}; nextDepth=${ladder.nextDepth}; wideR=${wideResistance ? wideResistance.lv.price.toFixed(4) : "NA"}; dist=${wideResistance ? (wideResistance.dist * 100).toFixed(2) : "NA"}%; hlAskWall05=${hlAskWall05}; hlBidWall05=${hlBidWall05}`,
    },
    {
      name: "zone30_hl_support_reclaim_boost_shadow",
      action: "boost_add",
      fired: truePriceDropAdd && deep5 && nearSupport && hlBuyPressure && hlBidWall05 && hlOiExpansion,
      reason: `truePriceDropAdd=${truePriceDropAdd}; nextDepth=${ladder.nextDepth}; Sdist=${support ? (support.dist * 100).toFixed(2) : "NA"}%; hlBuyPressure=${hlBuyPressure}; hlBidWall05=${hlBidWall05}; hlOiExpansion=${hlOiExpansion}`,
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
    addContext: {
      ...args.addContext,
      timeOnlyAdd,
      truePriceDropAdd,
      tpPct,
    },
    levels: {
      tf: `${shadowCfg.tfMin ?? 30}m_memory`,
      nearestResistance: levelPayload(resistance),
      nearestSupport: levelPayload(support),
      wideResistance: levelPayload(wideResistance),
      wideSupport: levelPayload(wideSupport),
      tpResistance: levelPayload(tpResistance),
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
      fundingHot,
      oiHot,
      pulseHostile,
      pulseReclaim,
      pulseDeteriorating,
      hlTaker15m: args.pulse.hlTaker15m,
      hlTaker1h: args.pulse.hlTaker1h,
      hlTaker4h: args.pulse.hlTaker4h,
      hlTaker15mNetNotional: args.pulse.hlTaker15mNetNotional,
      hlAssetOi1hPct: args.pulse.hlAssetOi1hPct,
      hlAssetOi4hPct: args.pulse.hlAssetOi4hPct,
      hlFundingNow,
      hlObImbalance05: args.pulse.hlObImbalance05,
      hlObImbalance2: args.pulse.hlObImbalance2,
      hlObAskBid05Ratio: args.pulse.hlObAskBid05Ratio,
      hlObAskBid2Ratio: args.pulse.hlObAskBid2Ratio,
      hlAskWall05,
      hlBidWall05,
      hlBuyPressure,
      hlSellPressure,
      hlTakerFade,
      hlOiExpansion,
      hlOiUnwind,
      hlHotAtResistance,
      hlObAgeSec: args.pulse.hlObAgeSec,
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
