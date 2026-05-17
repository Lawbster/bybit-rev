import { Candle } from "../fetch-candles";
import { aggregate } from "./sr-levels";

export type SRMemorySide = "resistance" | "support";

export interface SRMemoryZoneConfig {
  enabled: boolean;
  tfMin: number;
  pivotLeft: number;
  pivotRight: number;
  clusterPct: number;
  minTouches: number;
  bufferPct: number;
  recentDays: number;
}

export interface SRMemoryZoneTouch {
  ts: number;
  price: number;
  side: SRMemorySide;
}

export interface SRMemoryZoneLevel {
  price: number;
  confirmTs: number;
  touches: number;
  highTouches: number;
  lowTouches: number;
  touchData: SRMemoryZoneTouch[];
}

export interface SRMemoryZoneHit {
  lv: SRMemoryZoneLevel;
  dist: number;
}

export const DEFAULT_SR_MEMORY_ZONE_CONFIG: SRMemoryZoneConfig = {
  enabled: false,
  tfMin: 30,
  pivotLeft: 4,
  pivotRight: 4,
  clusterPct: 0.0045,
  minTouches: 2,
  bufferPct: 1.0,
  recentDays: 14,
};

export class SRMemoryZoneEngine {
  private cfg: SRMemoryZoneConfig;
  private levels: SRMemoryZoneLevel[] = [];
  private lastBuildTfBarTs = 0;

  constructor(cfg: SRMemoryZoneConfig) {
    this.cfg = cfg;
  }

  rebuild(candles5m: Candle[], nowMs: number = Date.now()): void {
    if (!this.cfg.enabled || candles5m.length === 0) {
      this.levels = [];
      return;
    }

    const tf = aggregate(candles5m, this.cfg.tfMin);
    const tfMs = this.cfg.tfMin * 60000;
    if (tf.length < this.cfg.pivotLeft + this.cfg.pivotRight + 2) {
      this.levels = [];
      return;
    }

    const minConfirmTs = nowMs - this.cfg.recentDays * 86400000;
    const pivots: SRMemoryZoneTouch[] = [];

    for (let i = this.cfg.pivotLeft; i < tf.length - this.cfg.pivotRight; i++) {
      const bar = tf[i];
      let isHigh = true;
      let isLow = true;
      for (let j = i - this.cfg.pivotLeft; j <= i + this.cfg.pivotRight; j++) {
        if (j === i) continue;
        if (tf[j].high >= bar.high) isHigh = false;
        if (tf[j].low <= bar.low) isLow = false;
      }

      const confirmTs = tf[i + this.cfg.pivotRight].timestamp + tfMs;
      if (confirmTs < minConfirmTs || confirmTs > nowMs) continue;
      if (isHigh) pivots.push({ ts: confirmTs, price: bar.high, side: "resistance" });
      if (isLow) pivots.push({ ts: confirmTs, price: bar.low, side: "support" });
    }

    const levels: SRMemoryZoneLevel[] = [];
    for (const p of pivots.sort((a, b) => a.ts - b.ts)) {
      let target: SRMemoryZoneLevel | null = null;
      for (const lv of levels) {
        if (Math.abs(lv.price - p.price) / lv.price <= this.cfg.clusterPct) {
          target = lv;
          break;
        }
      }

      if (!target) {
        target = {
          price: p.price,
          confirmTs: p.ts,
          touches: 0,
          highTouches: 0,
          lowTouches: 0,
          touchData: [],
        };
        levels.push(target);
      }

      target.price = ((target.price * target.touches) + p.price) / (target.touches + 1);
      target.confirmTs = Math.min(target.confirmTs, p.ts);
      target.touches++;
      target.touchData.push(p);
      if (p.side === "resistance") target.highTouches++;
      else target.lowTouches++;
    }

    this.levels = levels.filter(lv => lv.touches >= this.cfg.minTouches).sort((a, b) => a.price - b.price);
    this.lastBuildTfBarTs = tf[tf.length - 1].timestamp;
  }

  needsRebuild(nowMs: number): boolean {
    if (!this.cfg.enabled) return false;
    const tfMs = this.cfg.tfMin * 60000;
    const currentBarStart = Math.floor(nowMs / tfMs) * tfMs;
    return currentBarStart > this.lastBuildTfBarTs;
  }

  nearestResistance(ts: number, price: number): SRMemoryZoneHit | null {
    return this.nearest(ts, price, "resistance");
  }

  nearestSupport(ts: number, price: number): SRMemoryZoneHit | null {
    return this.nearest(ts, price, "support");
  }

  countZones(ts: number): number {
    return this.levels.filter(lv => this.confirmedTouches(lv, ts).length >= this.cfg.minTouches).length;
  }

  getZones(ts: number): SRMemoryZoneLevel[] {
    return this.levels.map(lv => {
      const touches = this.confirmedTouches(lv, ts);
      const price = touches.length ? touches.reduce((s, t) => s + t.price, 0) / touches.length : lv.price;
      return {
        ...lv,
        price,
        touches: touches.length,
        touchData: touches,
        highTouches: touches.filter(t => t.side === "resistance").length,
        lowTouches: touches.filter(t => t.side === "support").length,
      };
    }).filter(lv => lv.touches >= this.cfg.minTouches);
  }

  private confirmedTouches(lv: SRMemoryZoneLevel, ts: number): SRMemoryZoneTouch[] {
    return lv.touchData.filter(t => t.ts <= ts);
  }

  private nearest(ts: number, price: number, side: SRMemorySide): SRMemoryZoneHit | null {
    const buf = this.cfg.bufferPct / 100;
    let best: SRMemoryZoneLevel | null = null;
    let bestDist = Infinity;

    for (const lv of this.levels) {
      const touches = this.confirmedTouches(lv, ts);
      if (touches.length < this.cfg.minTouches) continue;
      const levelPrice = touches.reduce((s, t) => s + t.price, 0) / touches.length;
      if (side === "resistance" && levelPrice <= price) continue;
      if (side === "support" && levelPrice >= price) continue;

      const dist = side === "resistance" ? (levelPrice - price) / price : (price - levelPrice) / price;
      if (dist <= buf && dist < bestDist) {
        best = {
          ...lv,
          price: levelPrice,
          touches: touches.length,
          touchData: touches,
          highTouches: touches.filter(t => t.side === "resistance").length,
          lowTouches: touches.filter(t => t.side === "support").length,
        };
        bestDist = dist;
      }
    }

    return best ? { lv: best, dist: bestDist } : null;
  }
}
