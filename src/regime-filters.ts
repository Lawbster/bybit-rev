import { Candle } from "./fetch-candles";
import { EMA, ATR, BollingerBands } from "technicalindicators";

// ─────────────────────────────────────────────
// Regime filters for 2Moon DCA ladder
// ─────────────────────────────────────────────
// These filters gate whether the ladder is allowed to open new positions.
// They do NOT close existing positions — only suppress new adds.

export interface FilterConfig {
  // A. Market risk-off (BTC/ETH crash)
  marketRiskOff: boolean;
  btcDropPct: number;          // pause if BTC 1h return < this (e.g. -3)
  ethDropPct: number;          // pause if ETH 1h return < this (e.g. -4)
  riskOffCooldownMin: number;  // stay paused for N minutes after trigger

  // B. HYPE trend-break
  trendBreak: boolean;
  trendEmaLong: number;       // e.g. 200 (4h EMA period, in 4h candles)
  trendEmaShort: number;      // e.g. 50 (4h EMA period for slope check)

  // C. Volatility expansion
  volExpansion: boolean;
  atrMultiplier: number;      // pause when 1h ATR% > this × 30-day median (e.g. 1.8)
  atrLookbackDays: number;    // baseline lookback in days (e.g. 30)

  // D. Ladder-local kill
  ladderLocalKill: boolean;
  maxUnderwaterHours: number;  // stop adding after N hours if avg PnL still negative (e.g. 12)
  maxUnderwaterPct: number;    // stop adding if avg ladder PnL% < this (e.g. -3)
}

export const DEFAULT_FILTERS: FilterConfig = {
  marketRiskOff: true,
  btcDropPct: -3,
  ethDropPct: -4,
  riskOffCooldownMin: 120,

  trendBreak: true,
  trendEmaLong: 200,
  trendEmaShort: 50,

  volExpansion: true,
  atrMultiplier: 1.8,
  atrLookbackDays: 30,

  ladderLocalKill: true,
  maxUnderwaterHours: 12,
  maxUnderwaterPct: -3,
};

// ─────────────────────────────────────────────
// Aggregate 5m candles into higher timeframes
// ─────────────────────────────────────────────
export function aggregate(candles5m: Candle[], periodMin: number): Candle[] {
  const periodMs = periodMin * 60000;
  const buckets = new Map<number, Candle>();

  for (const c of candles5m) {
    const bucketTs = Math.floor(c.timestamp / periodMs) * periodMs;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, {
        timestamp: bucketTs,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        turnover: c.turnover,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
      existing.turnover += c.turnover;
    }
  }

  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

// ─────────────────────────────────────────────
// Pre-computed filter state for fast per-candle lookup
// ─────────────────────────────────────────────
export interface FilterState {
  // Per-timestamp lookup: is the filter blocking entries?
  blocked: Map<number, string[]>;  // ts → list of active filter reasons
  // Stats
  totalCandles: number;
  blockedCandles: number;
  filterCounts: Record<string, number>;
}

export function buildFilterState(
  hypeCandles5m: Candle[],
  btcCandles5m: Candle[],
  ethCandles5m: Candle[],
  config: FilterConfig,
): FilterState {
  const blocked = new Map<number, string[]>();
  const filterCounts: Record<string, number> = {
    "market_riskoff": 0,
    "trend_break": 0,
    "vol_expansion": 0,
  };

  // ── Precompute higher-timeframe data ──

  // 1h candles for BTC, ETH, HYPE
  const btc1h = aggregate(btcCandles5m, 60);
  const eth1h = aggregate(ethCandles5m, 60);
  const hype1h = aggregate(hypeCandles5m, 60);

  // 4h candles for HYPE trend
  const hype4h = aggregate(hypeCandles5m, 240);

  // ── A. Market risk-off: BTC/ETH 1h returns ──
  const riskOffPeriods = new Set<number>(); // set of 5m timestamps blocked
  if (config.marketRiskOff) {
    // Compute 1h returns for BTC and ETH
    const btc1hReturns = new Map<number, number>();
    for (let i = 1; i < btc1h.length; i++) {
      const ret = ((btc1h[i].close - btc1h[i - 1].close) / btc1h[i - 1].close) * 100;
      btc1hReturns.set(btc1h[i].timestamp, ret);
    }
    const eth1hReturns = new Map<number, number>();
    for (let i = 1; i < eth1h.length; i++) {
      const ret = ((eth1h[i].close - eth1h[i - 1].close) / eth1h[i - 1].close) * 100;
      eth1hReturns.set(eth1h[i].timestamp, ret);
    }

    // For each 5m candle, check if the LAST COMPLETED 1h candle triggered risk-off
    // A candle at 10:05 uses the 09:00 hour (not the still-forming 10:00 hour)
    const cooldownMs = config.riskOffCooldownMin * 60000;
    let riskOffUntil = 0;

    for (const c of hypeCandles5m) {
      const hourTs = Math.floor(c.timestamp / 3600000) * 3600000 - 3600000; // previous completed hour
      const btcRet = btc1hReturns.get(hourTs);
      const ethRet = eth1hReturns.get(hourTs);

      if ((btcRet !== undefined && btcRet < config.btcDropPct) ||
          (ethRet !== undefined && ethRet < config.ethDropPct)) {
        riskOffUntil = c.timestamp + cooldownMs;
      }

      if (c.timestamp < riskOffUntil) {
        riskOffPeriods.add(c.timestamp);
      }
    }
  }

  // ── B. HYPE trend-break: 4h EMA200 + EMA50 slope ──
  const trendBreakPeriods = new Set<number>();
  if (config.trendBreak) {
    const closes4h = hype4h.map(c => c.close);
    const emaLong = EMA.calculate({ period: config.trendEmaLong, values: closes4h });
    const emaShort = EMA.calculate({ period: config.trendEmaShort, values: closes4h });

    // Align: emaLong starts at index (trendEmaLong-1), emaShort at (trendEmaShort-1)
    const longOffset = config.trendEmaLong - 1;
    const shortOffset = config.trendEmaShort - 1;

    // Build 4h-level trend state
    const trendState = new Map<number, boolean>(); // true = trend broken (bearish)
    for (let i = longOffset; i < hype4h.length; i++) {
      const emaL = emaLong[i - longOffset];
      const emaS = i >= shortOffset + 1 ? emaShort[i - shortOffset] : undefined;
      const emaSPrev = i >= shortOffset + 2 ? emaShort[i - shortOffset - 1] : undefined;

      // Trend break: price below EMA200 AND EMA50 slope negative
      const belowEmaLong = hype4h[i].close < emaL;
      const emaSlopeNeg = emaS !== undefined && emaSPrev !== undefined && emaS < emaSPrev;

      trendState.set(hype4h[i].timestamp, belowEmaLong && emaSlopeNeg);
    }

    // Map 4h trend state to 5m candles — use LAST COMPLETED 4h candle
    // A candle at 10:05 uses the 04:00-07:59 4h candle, not the still-forming 08:00-11:59
    const fourHourMs = 240 * 60000;
    for (const c of hypeCandles5m) {
      const h4Ts = Math.floor(c.timestamp / fourHourMs) * fourHourMs - fourHourMs; // previous completed 4h
      if (trendState.get(h4Ts)) {
        trendBreakPeriods.add(c.timestamp);
      }
    }
  }

  // ── C. Volatility expansion: 1h ATR% vs 30-day median ──
  const volExpPeriods = new Set<number>();
  if (config.volExpansion) {
    const highs1h = hype1h.map(c => c.high);
    const lows1h = hype1h.map(c => c.low);
    const closes1h = hype1h.map(c => c.close);

    const atr14 = ATR.calculate({ period: 14, high: highs1h, low: lows1h, close: closes1h });
    const atrOffset = 14; // ATR starts at index 14

    // 30-day median of ATR% (30 days = 720 1h candles)
    const lookback1h = config.atrLookbackDays * 24;

    const volState = new Map<number, boolean>(); // true = vol expanded
    for (let i = atrOffset; i < hype1h.length; i++) {
      const atrPct = (atr14[i - atrOffset] / closes1h[i]) * 100;

      // Compute median ATR% over lookback
      const start = Math.max(atrOffset, i - lookback1h);
      const window: number[] = [];
      for (let j = start; j < i; j++) {
        window.push((atr14[j - atrOffset] / closes1h[j]) * 100);
      }
      if (window.length < 24) continue; // need at least 1 day of data
      window.sort((a, b) => a - b);
      const median = window[Math.floor(window.length / 2)];

      volState.set(hype1h[i].timestamp, atrPct > median * config.atrMultiplier);
    }

    // Map 1h vol state to 5m candles — use LAST COMPLETED 1h candle
    for (const c of hypeCandles5m) {
      const h1Ts = Math.floor(c.timestamp / 3600000) * 3600000 - 3600000; // previous completed hour
      if (volState.get(h1Ts)) {
        volExpPeriods.add(c.timestamp);
      }
    }
  }

  // ── Merge all filters into per-5m-candle blocked map ──
  let totalCandles = 0;
  let blockedCandles = 0;

  for (const c of hypeCandles5m) {
    totalCandles++;
    const reasons: string[] = [];

    if (riskOffPeriods.has(c.timestamp)) {
      reasons.push("market_riskoff");
      filterCounts["market_riskoff"]++;
    }
    if (trendBreakPeriods.has(c.timestamp)) {
      reasons.push("trend_break");
      filterCounts["trend_break"]++;
    }
    if (volExpPeriods.has(c.timestamp)) {
      reasons.push("vol_expansion");
      filterCounts["vol_expansion"]++;
    }

    if (reasons.length > 0) {
      blocked.set(c.timestamp, reasons);
      blockedCandles++;
    }
  }

  return { blocked, totalCandles, blockedCandles, filterCounts };
}

// ─────────────────────────────────────────────
// Ladder-local kill check (runtime, not precomputed)
// ─────────────────────────────────────────────
// Called per-candle during sim to check if the current ladder state
// should suppress new adds.
export function isLadderKilled(
  config: FilterConfig,
  positions: { entryPrice: number; entryTime: number; qty: number }[],
  currentPrice: number,
  currentTime: number,
): boolean {
  if (!config.ladderLocalKill || positions.length === 0) return false;

  // Check if oldest position has been underwater too long
  const oldestEntry = Math.min(...positions.map(p => p.entryTime));
  const hoursUnderwater = (currentTime - oldestEntry) / 3600000;

  // Compute weighted avg entry PnL%
  const totalQty = positions.reduce((s, p) => s + p.qty, 0);
  const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
  const avgPnlPct = ((currentPrice - avgEntry) / avgEntry) * 100;

  // Kill if both conditions met: underwater too long AND too deep
  return hoursUnderwater >= config.maxUnderwaterHours && avgPnlPct <= config.maxUnderwaterPct;
}
