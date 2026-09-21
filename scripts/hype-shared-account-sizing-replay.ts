/**
 * Shared-account sizing re-anchor replay (research only).
 *
 * Compares the current HYPE long ladder at $800/$500 base with the frozen
 * TP1.95/SL4/12h short at $25k/$16k on the strict common HL decision window.
 * Long strategy parameters and short signal thresholds remain unchanged.
 *
 * Run from PowerShell:
 *   $env:SIM_EQUITY='21614'; npx ts-node scripts/hype-shared-account-sizing-replay.ts
 */

import fs from "fs";
import path from "path";
import {
  advanceHlShortShadowPosition,
  createHlShortShadowPosition,
  HL_SHORT_BREAKDOWN_POLICY,
  HlShortMinuteCandle,
  HlShortShadowClose,
} from "../src/bot/hl-short-breakdown-policy";
import type {
  EngineParams,
  EngineResult,
  EngineSnapshot,
  Series,
} from "./hype-freerun-canonical-replay";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FUNDING_INTERVAL = 8 * HOUR;
const ROOT = process.cwd();
const INITIAL_EQUITY = Number(process.env.SIM_EQUITY ?? 21_614);
const LIVE_FEE_RATE = 0.00055;
const STRESS_FEE_RATE = 0.001;
const LEVERAGE = 25;
const DECISIONS_FILE = path.join(ROOT, "backtests", "hype", "hl-short-study-2026-08-10", "decision-features.csv");
const OUT_DIR = path.join(ROOT, "backtests", "hype", "shared-account-sizing-2026-08-13");

interface DecisionRow {
  ts: number;
  pulseHealthy: boolean;
  red15: boolean;
  breakPrev15Low: boolean;
  ret15: number;
  hlTaker15: number;
  hlOb5: number;
  hlObDelta: number;
}

interface ShortTrade {
  signalTs: number;
  close: HlShortShadowClose;
}

interface FundingSettlement {
  ts: number;
  rate: number;
  price: number;
}

interface PortfolioPoint {
  ts: number;
  equity: number;
  longEquity: number;
  shortContribution: number;
  longFunding: number;
  shortFunding: number;
  longNotional: number;
  shortNotional: number;
  depth: number;
}

interface Scenario {
  id: string;
  longRunId: string;
  longBase: number;
  shortNotional: number;
  entryMode: "decision_open" | "delay_1m_open";
  shortFeeRate: number;
}

function parseCsv(filePath: string): Record<string, string>[] {
  const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
  const header = lines.shift()!.split(",");
  return lines.map(line => Object.fromEntries(line.split(",").map((value, index) => [header[index], value])));
}

function loadDecisions(): DecisionRow[] {
  return parseCsv(DECISIONS_FILE).map(row => ({
    ts: Date.parse(row.ts),
    pulseHealthy: row.pulseHealthy === "true",
    red15: row.red15 === "true",
    breakPrev15Low: row.breakPrev15Low === "true",
    ret15: Number(row.ret15),
    hlTaker15: Number(row.hlTaker15),
    hlOb5: Number(row.hlOb5),
    hlObDelta: Number(row.hlObDelta),
  })).filter(row => Number.isFinite(row.ts)).sort((a, b) => a.ts - b.ts);
}

function fires(row: DecisionRow): boolean {
  return row.pulseHealthy
    && row.red15
    && row.breakPrev15Low
    && row.ret15 <= HL_SHORT_BREAKDOWN_POLICY.minimumReturn15mPct
    && row.hlTaker15 < HL_SHORT_BREAKDOWN_POLICY.maximumHlTaker15mRatio
    && row.hlOb5 < HL_SHORT_BREAKDOWN_POLICY.maximumHlBook5mImbalance
    && row.hlObDelta < HL_SHORT_BREAKDOWN_POLICY.maximumHlBookDelta;
}

function simulateTrack(
  mode: "decision_open" | "delay_1m_open",
  signalTs: number,
  candleByTs: Map<number, HlShortMinuteCandle>,
): HlShortShadowClose | null {
  const entryTime = signalTs + (mode === "delay_1m_open" ? MINUTE : 0);
  const entryCandle = candleByTs.get(entryTime);
  if (!entryCandle) return null;
  let position = createHlShortShadowPosition(mode, entryTime, entryCandle.open);
  for (let ts = entryTime; ts < position.expiresAt; ts += MINUTE) {
    const candle = candleByTs.get(ts);
    if (!candle) continue;
    const advanced = advanceHlShortShadowPosition(position, candle);
    position = advanced.position;
    if (advanced.close) return advanced.close;
  }
  return null;
}

function buildShortTrades(
  decisions: DecisionRow[],
  candles: HlShortMinuteCandle[],
): { immediate: ShortTrade[]; delayed: ShortTrade[]; rawFires: number } {
  const candleByTs = new Map(candles.map(candle => [candle.timestamp, candle]));
  const immediate: ShortTrade[] = [];
  const delayed: ShortTrade[] = [];
  let rawFires = 0;
  let lastRawSignalTs = -Infinity;
  let immediateBusyUntil = -Infinity;
  for (const decision of decisions) {
    if (!fires(decision)) continue;
    if (decision.ts - lastRawSignalTs < HL_SHORT_BREAKDOWN_POLICY.rawSignalCooldownMs) continue;
    lastRawSignalTs = decision.ts;
    rawFires++;
    if (decision.ts < immediateBusyUntil) continue;
    const exact = simulateTrack("decision_open", decision.ts, candleByTs);
    const delay = simulateTrack("delay_1m_open", decision.ts, candleByTs);
    if (!exact || !delay) continue;
    immediate.push({ signalTs: decision.ts, close: exact });
    delayed.push({ signalTs: decision.ts, close: delay });
    immediateBusyUntil = exact.exitTime;
  }
  return { immediate, delayed, rawFires };
}

function longParams(id: string, baseUsdt: number): EngineParams {
  return {
    id,
    baseUsdt,
    maxPositions: 11,
    hardFlattenHours: 12,
    hardFlattenPct: -2,
    cooldownMode: "live4h",
    pullbackMode: "none",
    srExec: {
      partialExit: {
        minDepth: 6,
        keepRungs: 3,
        bufferPct: 0.3,
        minLadderPnlPct: 0.25,
        requirePlanProfit: true,
        pulse: "deteriorating",
        cooldownMin: 60,
      },
      supportReopen: { minNextDepth: 5, bufferPct: 1.0, mode: "buy_pressure" },
    },
  };
}

function lowerBound<T>(rows: T[], value: number, accessor: (row: T) => number): number {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (accessor(rows[middle]) < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function fundingSettlements(series: Series, startIdx: number, endIdx: number): FundingSettlement[] {
  const settlements: FundingSettlement[] = [];
  for (let index = startIdx; index < endIdx; index++) {
    const candle = series.candles[index];
    const rate = series.bybitFunding[index];
    if (candle.endTs % FUNDING_INTERVAL === 0 && rate !== null && Number.isFinite(rate)) {
      settlements.push({ ts: candle.endTs, rate, price: candle.close });
    }
  }
  return settlements;
}

function shortStateAt(
  ts: number,
  price: number,
  trades: ShortTrade[],
  notional: number,
  feeRate: number,
  settlements: FundingSettlement[],
): { contribution: number; funding: number; activeNotional: number } {
  let contribution = 0;
  let funding = 0;
  let activeNotional = 0;
  for (const trade of trades) {
    const close = trade.close;
    if (ts <= close.entryTime) continue;
    const quantity = notional / close.entryPrice;
    const active = ts < close.exitTime;
    const mark = active ? price : close.exitPrice;
    let tradeFunding = 0;
    const through = Math.min(ts, close.exitTime);
    for (const settlement of settlements) {
      if (settlement.ts > close.entryTime && settlement.ts <= through) {
        tradeFunding += settlement.rate * quantity * settlement.price;
      }
    }
    const gross = (close.entryPrice - mark) * quantity;
    const fees = notional * feeRate + quantity * mark * feeRate;
    contribution += gross - fees + tradeFunding;
    funding += tradeFunding;
    if (active) activeNotional += quantity * price;
  }
  return { contribution, funding, activeNotional };
}

function shortContributionByCandleIndex(
  series: Series,
  trades: ShortTrade[],
  notional: number,
  feeRate: number,
  settlements: FundingSettlement[],
  startIdx: number,
  endIdx: number,
): Float64Array {
  const values = new Float64Array(series.candles.length);
  for (let index = startIdx; index < endIdx; index++) {
    const candle = series.candles[index];
    values[index] = shortStateAt(candle.endTs, candle.close, trades, notional, feeRate, settlements).contribution;
  }
  return values;
}

function buildPortfolio(
  snapshots: EngineSnapshot[],
  trades: ShortTrade[],
  shortNotional: number,
  feeRate: number,
  settlements: FundingSettlement[],
): PortfolioPoint[] {
  const settlementByTs = new Map(settlements.map(row => [row.ts, row]));
  const points: PortfolioPoint[] = [];
  let longFunding = 0;
  for (const snapshot of snapshots) {
    const longNotional = snapshot.longQty * snapshot.price;
    const settlement = settlementByTs.get(snapshot.ts);
    if (settlement) longFunding -= settlement.rate * longNotional;
    const short = shortStateAt(snapshot.ts, snapshot.price, trades, shortNotional, feeRate, settlements);
    const longEquity = snapshot.equity + longFunding;
    points.push({
      ts: snapshot.ts,
      equity: longEquity + short.contribution,
      longEquity,
      shortContribution: short.contribution,
      longFunding,
      shortFunding: short.funding,
      longNotional,
      shortNotional: short.activeNotional,
      depth: snapshot.depth,
    });
  }
  return points;
}

function maxDrawdown(points: PortfolioPoint[]): { pct: number; dollars: number; minEquity: number; at: number } {
  let peak = INITIAL_EQUITY;
  let maxPct = 0;
  let maxDollars = 0;
  let minEquity = INITIAL_EQUITY;
  let at = points[0]?.ts ?? 0;
  for (const point of points) {
    peak = Math.max(peak, point.equity);
    minEquity = Math.min(minEquity, point.equity);
    const dollars = peak - point.equity;
    const pct = peak > 0 ? dollars / peak * 100 : Infinity;
    if (pct > maxPct) {
      maxPct = pct;
      maxDollars = dollars;
      at = point.ts;
    }
  }
  return { pct: maxPct, dollars: maxDollars, minEquity, at };
}

function worstRollingChange(points: PortfolioPoint[], horizonMs: number): number {
  let anchor = 0;
  let worst = 0;
  for (let index = 0; index < points.length; index++) {
    const cutoff = points[index].ts - horizonMs;
    while (anchor + 1 < index && points[anchor + 1].ts <= cutoff) anchor++;
    worst = Math.min(worst, points[index].equity - points[anchor].equity);
  }
  return worst;
}

function maximumRecoveryDays(points: PortfolioPoint[]): { days: number; unresolved: boolean } {
  let peak = INITIAL_EQUITY;
  let underwaterSince: number | null = null;
  let maximumMs = 0;
  for (const point of points) {
    if (point.equity >= peak) {
      if (underwaterSince !== null) maximumMs = Math.max(maximumMs, point.ts - underwaterSince);
      peak = point.equity;
      underwaterSince = null;
    } else if (underwaterSince === null) {
      underwaterSince = point.ts;
    }
  }
  const unresolved = underwaterSince !== null;
  if (underwaterSince !== null && points.length) {
    maximumMs = Math.max(maximumMs, points.at(-1)!.ts - underwaterSince);
  }
  return { days: maximumMs / DAY, unresolved };
}

function maintenanceMargin(notional: number): number {
  if (notional <= 0) return 0;
  if (notional <= 5_000) return notional * 0.0067;
  if (notional <= 25_000) return notional * 0.01 - 16.5;
  if (notional <= 50_000) return notional * 0.0111 - 44;
  if (notional <= 100_000) return notional * 0.0125 - 114;
  if (notional <= 200_000) return notional * 0.0143 - 294;
  return notional * 0.02;
}

function summarize(scenario: Scenario, points: PortfolioPoint[], tradeCount: number): Record<string, unknown> {
  const last = points.at(-1)!;
  const dd = maxDrawdown(points);
  const recovery = maximumRecoveryDays(points);
  const minFreeMargin = Math.min(...points.map(point => point.equity - (point.longNotional + point.shortNotional) / LEVERAGE));
  const minLiquidationHeadroom = Math.min(...points.map(point =>
    point.equity - maintenanceMargin(point.longNotional) - maintenanceMargin(point.shortNotional)));
  const stopDollars = scenario.shortNotional * (0.04 + LIVE_FEE_RATE + 1.04 * LIVE_FEE_RATE);
  return {
    scenario: scenario.id,
    longBase: scenario.longBase,
    shortNotional: scenario.shortNotional,
    execution: `${scenario.entryMode}_${scenario.shortFeeRate === LIVE_FEE_RATE ? "live_fee" : "stress_fee"}`,
    trades: tradeCount,
    finalPnl: last.equity - INITIAL_EQUITY,
    finalEquity: last.equity,
    longPnl: last.longEquity - INITIAL_EQUITY,
    shortContribution: last.shortContribution,
    maxDrawdownPct: dd.pct,
    maxDrawdownDollars: dd.dollars,
    minEquity: dd.minEquity,
    worst7dChange: worstRollingChange(points, 7 * DAY),
    worst30dChange: worstRollingChange(points, 30 * DAY),
    maximumRecoveryDays: recovery.days,
    recoveryUnresolvedAtEnd: recovery.unresolved,
    minFreeMargin,
    minLiquidationHeadroom,
    maximumGrossNotional: Math.max(...points.map(point => point.longNotional + point.shortNotional)),
    oneShortStopDollars: stopDollars,
    oneShortStopPctInitialEquity: stopDollars / INITIAL_EQUITY * 100,
  };
}

function monthlyRows(scenario: Scenario, points: PortfolioPoint[]): Record<string, unknown>[] {
  const grouped = new Map<string, PortfolioPoint[]>();
  for (const point of points) {
    const month = new Date(point.ts).toISOString().slice(0, 7);
    const rows = grouped.get(month) ?? [];
    rows.push(point);
    grouped.set(month, rows);
  }
  return [...grouped].map(([month, rows]) => ({
    scenario: scenario.id,
    month,
    startEquity: rows[0].equity,
    endEquity: rows.at(-1)!.equity,
    pnl: rows.at(-1)!.equity - rows[0].equity,
    maxDrawdownPct: maxDrawdown(rows).pct,
  }));
}

function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  fs.writeFileSync(filePath, [header.join(","), ...rows.map(row => header.map(key => String(row[key] ?? "")).join(","))].join("\n") + "\n");
}

async function main(): Promise<void> {
  if (!Number.isFinite(INITIAL_EQUITY) || INITIAL_EQUITY <= 0) throw new Error("SIM_EQUITY must be positive");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const decisions = loadDecisions();
  if (!decisions.length) throw new Error("decision feature grid is empty");
  const start = decisions[0].ts;
  const signalEnd = decisions.at(-1)!.ts;
  const requestedEnd = signalEnd + HL_SHORT_BREAKDOWN_POLICY.maximumHoldMs + MINUTE;

  process.env.SIM_EQUITY = String(INITIAL_EQUITY);
  const replay = await import("./hype-freerun-canonical-replay");
  const dormant = await import("./hype-dormant-edge-replay");
  const series = await replay.buildSeries();
  const startIdx = replay.lowerBound(series.candles, start, candle => candle.endTs);
  const endIdx = replay.lowerBound(series.candles, requestedEnd, candle => candle.endTs);
  await dormant.attachDormantSeries(series, Math.max(0, startIdx - 2 * 1440));
  const end = series.candles[Math.max(startIdx, endIdx - 1)].endTs;

  const policyCandles: HlShortMinuteCandle[] = series.candles.slice(startIdx, endIdx).map(candle => ({
    timestamp: candle.ts,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
  const shortTrades = buildShortTrades(decisions, policyCandles);
  const settlements = fundingSettlements(series, startIdx, endIdx);

  const longRuns = new Map<string, EngineResult>();
  for (const base of [800, 500]) {
    const result = replay.runEngine(longParams(`long_base_${base}`, base), series, {
      startIdx,
      endIdx,
      recordSnapshots: true,
    });
    if (!result.snapshots.length) throw new Error(`long base ${base} produced no snapshots`);
    longRuns.set(`base_${base}`, result);
  }

  const exactShortAdjustment = shortContributionByCandleIndex(
    series, shortTrades.immediate, 25_000, LIVE_FEE_RATE, settlements, startIdx, endIdx,
  );
  const stressShortAdjustment = shortContributionByCandleIndex(
    series, shortTrades.delayed, 25_000, STRESS_FEE_RATE, settlements, startIdx, endIdx,
  );
  for (const [id, adjustment] of [
    ["band20_exact", exactShortAdjustment],
    ["band20_stress", stressShortAdjustment],
  ] as const) {
    const result = replay.runEngine({
      ...longParams(id, 500),
      sizingPolicy: {
        floorBase: 300,
        capBase: 800,
        equityPct: 800 / 34_000 * 100,
        rebalanceBandPct: 20,
      },
      sizingEquityAdjustment: index => adjustment[index] ?? 0,
    }, series, { startIdx, endIdx, recordSnapshots: true });
    longRuns.set(id, result);
  }

  const fixed = [
    { id: "current_800_25k", longRunId: "base_800", longBase: 800, shortNotional: 25_000 },
    { id: "long500_short25k", longRunId: "base_500", longBase: 500, shortNotional: 25_000 },
    { id: "long800_short16k", longRunId: "base_800", longBase: 800, shortNotional: 16_000 },
    { id: "reanchored_500_16k", longRunId: "base_500", longBase: 500, shortNotional: 16_000 },
  ];
  const scenarios: Scenario[] = fixed.flatMap(row => [
    { ...row, entryMode: "decision_open" as const, shortFeeRate: LIVE_FEE_RATE },
    { ...row, id: `${row.id}_delay_stress`, entryMode: "delay_1m_open" as const, shortFeeRate: STRESS_FEE_RATE },
  ]);
  scenarios.push(
    { id: "band20_long_short25k", longRunId: "band20_exact", longBase: -1, shortNotional: 25_000, entryMode: "decision_open", shortFeeRate: LIVE_FEE_RATE },
    { id: "band20_long_short25k_delay_stress", longRunId: "band20_stress", longBase: -1, shortNotional: 25_000, entryMode: "delay_1m_open", shortFeeRate: STRESS_FEE_RATE },
  );
  const summaries: Record<string, unknown>[] = [];
  const months: Record<string, unknown>[] = [];
  for (const scenario of scenarios) {
    const long = longRuns.get(scenario.longRunId)!;
    const trades = scenario.entryMode === "decision_open" ? shortTrades.immediate : shortTrades.delayed;
    const points = buildPortfolio(long.snapshots, trades, scenario.shortNotional, scenario.shortFeeRate, settlements);
    summaries.push(summarize(scenario, points, trades.length));
    months.push(...monthlyRows(scenario, points));
  }
  writeCsv(path.join(OUT_DIR, "summary.csv"), summaries);
  writeCsv(path.join(OUT_DIR, "monthly.csv"), months);
  writeCsv(path.join(OUT_DIR, "short-trades.csv"), shortTrades.immediate.map((trade, index) => ({
    index: index + 1,
    signalTs: trade.signalTs,
    signalIso: new Date(trade.signalTs).toISOString(),
    entryIso: new Date(trade.close.entryTime).toISOString(),
    exitIso: new Date(trade.close.exitTime).toISOString(),
    entryPrice: trade.close.entryPrice,
    exitPrice: trade.close.exitPrice,
    outcome: trade.close.outcome,
    pnlPctAfterFees: trade.close.pnlPctAfterFees,
  })));
  console.log(JSON.stringify({
    window: { start: new Date(start).toISOString(), signalEnd: new Date(signalEnd).toISOString(), portfolioEnd: new Date(end).toISOString() },
    initialEquity: INITIAL_EQUITY,
    parity: {
      decisions: decisions.length,
      rawCooldownedFires: shortTrades.rawFires,
      serialTrades: shortTrades.immediate.length,
      policyTp: HL_SHORT_BREAKDOWN_POLICY.takeProfitPct,
      long800Pnl: longRuns.get("base_800")!.realized + longRuns.get("base_800")!.openPnl,
      long500Pnl: longRuns.get("base_500")!.realized + longRuns.get("base_500")!.openPnl,
      fixedLongScaleRatio: (longRuns.get("base_500")!.realized + longRuns.get("base_500")!.openPnl)
        / (longRuns.get("base_800")!.realized + longRuns.get("base_800")!.openPnl),
    },
    summaries,
    outputs: OUT_DIR,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
