// ─────────────────────────────────────────────
// S/R level engine — pure functions, no I/O.
// Mirrors the validated logic in src/sim-exact.ts (skip-flatten mode).
//
// Pipeline:
//   1. Aggregate raw 5m candles to the SR pivot timeframe (default 4H)
//   2. Detect swing pivots: bar i is a high if no bar in [i-LEFT, i+RIGHT]
//      has a higher high (low pivots: mirror)
//   3. Cluster pivots within CLUSTER_PCT into single levels (count touches)
//   4. Filter to levels with >= MIN_TOUCHES
//   5. Mark each level "broken" once close ≥ level×(1+BREAK_BUF) for
//      BREAK_CONFIRM_BARS consecutive SR-tf closes
//
// All "active" checks are time-gated by confirmTs (level usable only after
// the right-side window completes) and brokenAt (set to END of breaking bar
// to avoid look-ahead).
//
// Live usage (bot/index.ts):
//   const engine = new SRLevelEngine(config);
//   engine.rebuild(ctxMgr.getCandles());      // on startup + on each new SR-tf bar close
//   const r = engine.nearestActiveResistance(Date.now(), price);
//   if (r) ... // gate add or trigger partial flatten
// ─────────────────────────────────────────────

import { Candle } from "../fetch-candles";

export interface SRConfig {
  pivotTfMin: number;        // SR pivot timeframe in minutes (240 = 4H)
  pivotLeft: number;         // bars to the left for pivot test (6)
  pivotRight: number;        // bars to the right (6) — also confirmation lag
  clusterPct: number;        // pivot merge threshold as fraction (0.012 = 1.2%)
  minTouches: number;        // minimum touches for a level to be tradeable (2)
  breakBufPct: number;       // break trigger as fraction above level (0.01 = 1%)
  breakConfirmBars: number;  // consecutive SR-tf closes required to confirm break (2)
  bufferPct: number;         // skip/scale window in % (0.5)
  flattenBufferPct: number;  // tighter buffer in % for partial flatten trigger (0.3)
  keepRungs: number;         // rungs to keep alive on partial flatten (3)
  enabled: boolean;          // master gate
}

export const DEFAULT_SR_CONFIG: SRConfig = {
  pivotTfMin: 240,
  pivotLeft: 6,
  pivotRight: 6,
  clusterPct: 0.012,
  minTouches: 2,
  breakBufPct: 0.01,
  breakConfirmBars: 2,
  bufferPct: 0.5,
  flattenBufferPct: 0.3,
  keepRungs: 3,
  enabled: false,
};

export interface SRLevel {
  price: number;
  confirmTs: number;     // ms — earliest tick this level can be queried
  touches: number;
  brokenAt: number;      // ms — 0 if still active, else end-of-bar of break
}

export interface NearestLevel {
  lv: SRLevel;
  dist: number;          // fractional distance (0..bufferPct/100)
}

// ── Helpers ───────────────────────────────────────────────

export function aggregate(candles: Candle[], minutes: number): Candle[] {
  const ms = minutes * 60000;
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const k = Math.floor(c.timestamp / ms) * ms;
    const bar = map.get(k);
    if (!bar) {
      map.set(k, { timestamp: k, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, turnover: c.turnover ?? 0 });
    } else {
      bar.high = Math.max(bar.high, c.high);
      bar.low  = Math.min(bar.low,  c.low);
      bar.close = c.close;
      bar.volume += c.volume;
    }
  }
  return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
}

// ── Engine ────────────────────────────────────────────────

export class SRLevelEngine {
  private cfg: SRConfig;
  private resistance: SRLevel[] = [];
  private support: SRLevel[] = [];
  private lastBuildTfBarTs = 0;  // start ts of latest SR-tf bar used in last build

  constructor(cfg: SRConfig) {
    this.cfg = cfg;
  }

  /** Rebuild S/R levels from a fresh candle window. Call on startup and on
   *  each new SR-tf bar close. Cheap enough to call freely (one full O(N) scan). */
  rebuild(candles5m: Candle[]): void {
    if (!this.cfg.enabled || candles5m.length === 0) {
      this.resistance = [];
      this.support = [];
      return;
    }

    const tf = aggregate(candles5m, this.cfg.pivotTfMin);
    if (tf.length < this.cfg.pivotLeft + this.cfg.pivotRight + 2) return;

    const tfMs = this.cfg.pivotTfMin * 60000;
    const rPiv: { ts: number; price: number }[] = [];
    const sPiv: { ts: number; price: number }[] = [];

    for (let i = this.cfg.pivotLeft; i < tf.length - this.cfg.pivotRight; i++) {
      const bar = tf[i];
      let isHigh = true, isLow = true;
      for (let j = i - this.cfg.pivotLeft; j <= i + this.cfg.pivotRight; j++) {
        if (j === i) continue;
        if (tf[j].high >= bar.high) isHigh = false;
        if (tf[j].low  <= bar.low ) isLow  = false;
      }
      const confirmTs = tf[i + this.cfg.pivotRight].timestamp + tfMs;
      if (isHigh) rPiv.push({ ts: confirmTs, price: bar.high });
      if (isLow ) sPiv.push({ ts: confirmTs, price: bar.low  });
    }

    this.resistance = this.cluster(rPiv, "R");
    this.support    = this.cluster(sPiv, "S");
    this.markBroken(tf);
    this.lastBuildTfBarTs = tf[tf.length - 1].timestamp;
  }

  private cluster(piv: { ts: number; price: number }[], type: "R" | "S"): SRLevel[] {
    const levels: SRLevel[] = [];
    for (const p of piv.sort((a, b) => a.ts - b.ts)) {
      let merged = false;
      for (const lv of levels) {
        if (Math.abs(lv.price - p.price) / lv.price <= this.cfg.clusterPct) {
          if (type === "R" && p.price > lv.price) lv.price = p.price;
          if (type === "S" && p.price < lv.price) lv.price = p.price;
          lv.touches++;
          merged = true;
          break;
        }
      }
      if (!merged) levels.push({ price: p.price, confirmTs: p.ts, touches: 1, brokenAt: 0 });
    }
    return levels.filter(l => l.touches >= this.cfg.minTouches);
  }

  private markBroken(tf: Candle[]): void {
    const tfMs = this.cfg.pivotTfMin * 60000;
    for (const lv of this.resistance) {
      const trigger = lv.price * (1 + this.cfg.breakBufPct);
      let streak = 0;
      for (const bar of tf) {
        if (bar.timestamp < lv.confirmTs) continue;
        if (bar.close >= trigger) {
          streak++;
          if (streak >= this.cfg.breakConfirmBars) { lv.brokenAt = bar.timestamp + tfMs; break; }
        } else streak = 0;
      }
    }
    for (const lv of this.support) {
      const trigger = lv.price * (1 - this.cfg.breakBufPct);
      let streak = 0;
      for (const bar of tf) {
        if (bar.timestamp < lv.confirmTs) continue;
        if (bar.close <= trigger) {
          streak++;
          if (streak >= this.cfg.breakConfirmBars) { lv.brokenAt = bar.timestamp + tfMs; break; }
        } else streak = 0;
      }
    }
  }

  /** Should rebuild() be called now? True when a new SR-tf bar has closed
   *  since the last build. Cheap O(1) check based on bar boundaries. */
  needsRebuild(nowMs: number): boolean {
    if (!this.cfg.enabled) return false;
    const tfMs = this.cfg.pivotTfMin * 60000;
    const currentBarStart = Math.floor(nowMs / tfMs) * tfMs;
    return currentBarStart > this.lastBuildTfBarTs;
  }

  /** Nearest active R above `price`, within bufferPct. Null if none. */
  nearestActiveResistance(ts: number, price: number): NearestLevel | null {
    if (!this.cfg.enabled) return null;
    const buf = this.cfg.bufferPct / 100;
    let nearest: SRLevel | null = null;
    let nearestDist = Infinity;
    for (const lv of this.resistance) {
      if (lv.confirmTs > ts) continue;
      if (lv.brokenAt > 0 && ts >= lv.brokenAt) continue;
      if (lv.price <= price) continue;
      const dist = (lv.price - price) / price;
      if (dist <= buf && dist < nearestDist) { nearest = lv; nearestDist = dist; }
    }
    return nearest ? { lv: nearest, dist: nearestDist } : null;
  }

  /** Nearest active S below `price`, within bufferPct. Null if none. */
  nearestActiveSupport(ts: number, price: number): NearestLevel | null {
    if (!this.cfg.enabled) return null;
    const buf = this.cfg.bufferPct / 100;
    let nearest: SRLevel | null = null;
    let nearestDist = Infinity;
    for (const lv of this.support) {
      if (lv.confirmTs > ts) continue;
      if (lv.brokenAt > 0 && ts >= lv.brokenAt) continue;
      if (lv.price >= price) continue;
      const dist = (price - lv.price) / price;
      if (dist <= buf && dist < nearestDist) { nearest = lv; nearestDist = dist; }
    }
    return nearest ? { lv: nearest, dist: nearestDist } : null;
  }

  /** Skip-on-add gate. Returns true when a new rung should be blocked. */
  shouldSkipAdd(ts: number, price: number): boolean {
    if (!this.cfg.enabled) return false;
    return this.nearestActiveResistance(ts, price) !== null;
  }

  /** Partial-flatten trigger. Returns the indices of rungs to close
   *  (most-profitable first), or null if no flatten should fire.
   *
   *  Behavior matches sim-exact partialFlattenAtR:
   *   - Requires longs.length >= keepRungs + 1
   *   - Requires nearest active R within flattenBufferPct of current price
   *   - Closes (longs.length - keepRungs) rungs sorted by individual unrealized
   *     PnL descending (banks the deepest cushion, leaves the worst rungs alive)
   *
   *  Caller is responsible for executing the close, updating state, and
   *  reanchoring lastEntryPrice/lastAdd to the latest kept rung.
   */
  partialFlattenIndices(
    longs: { entryPrice: number; qty: number }[],
    ts: number,
    price: number,
  ): number[] | null {
    if (!this.cfg.enabled) return null;
    if (longs.length < this.cfg.keepRungs + 1) return null;
    const r = this.nearestActiveResistance(ts, price);
    if (!r) return null;
    if (r.dist > this.cfg.flattenBufferPct / 100) return null;

    const indexed = longs.map((p, i) => ({ i, upnl: (price - p.entryPrice) * p.qty }));
    indexed.sort((a, b) => b.upnl - a.upnl);
    const closeN = longs.length - this.cfg.keepRungs;
    return indexed.slice(0, closeN).map(x => x.i);
  }

  // ── Diagnostics ──
  countActiveResistance(ts: number): number {
    return this.resistance.filter(l => l.confirmTs <= ts && (l.brokenAt === 0 || ts < l.brokenAt)).length;
  }
  countActiveSupport(ts: number): number {
    return this.support.filter(l => l.confirmTs <= ts && (l.brokenAt === 0 || ts < l.brokenAt)).length;
  }
  totalResistance(): number { return this.resistance.length; }
  totalSupport(): number { return this.support.length; }
  getResistance(): SRLevel[] { return this.resistance; }
  getSupport(): SRLevel[] { return this.support; }
}
