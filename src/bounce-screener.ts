import { loadCandles, Candle } from "./fetch-candles";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// Rolling Bounce Score Screener
//
// For each sample point (every 30m), simulate entering a long
// and measure:
//   - Does price hit +TP% within 24h?
//   - What is the max adverse excursion (MAE) before TP?
//   - How long does it take to hit TP?
//   - Does price hit -X% before TP? (trap rate)
// ─────────────────────────────────────────────

interface BounceProbe {
  timestamp: number;
  entryPrice: number;
  hitTp: boolean;
  hoursToTp: number;      // Infinity if never hit
  maeBeforeTp: number;    // max % drawdown before TP (negative number)
  exitType: "tp" | "timeout" | "trap";
}

interface MonthlyScore {
  month: string;
  probes: number;
  tpHitRate: number;       // % of probes that hit TP within 24h
  medianHoursToTp: number;
  meanHoursToTp: number;
  medianMae: number;       // median MAE before TP (negative)
  trapRate: number;        // % that hit -5% before TP
  deepTrapRate: number;    // % that hit -8% before TP
  atr1hPct: number;        // median 1h ATR as % of price
}

interface PairScore {
  symbol: string;
  days: number;
  overallTpRate: number;
  medianHoursToTp: number;
  medianMae: number;
  trapRate5: number;
  trapRate8: number;
  medianAtr1hPct: number;
  trendBreakFraction: number;
  monthly: MonthlyScore[];
  verdict: string;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function runBounceProbes(
  candles: Candle[],
  tpPct: number = 1.4,
  sampleIntervalMin: number = 30,
  maxHoldH: number = 24,
  trapThresholds: number[] = [5, 8],
): BounceProbe[] {
  const probes: BounceProbe[] = [];
  const intervalMs = sampleIntervalMin * 60000;
  const maxHoldMs = maxHoldH * 3600000;

  let lastSampleTs = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp - lastSampleTs < intervalMs) continue;
    lastSampleTs = c.timestamp;

    const entry = c.close;
    const tpPrice = entry * (1 + tpPct / 100);
    const deadline = c.timestamp + maxHoldMs;

    let hitTp = false;
    let hoursToTp = Infinity;
    let worstDraw = 0; // MAE as negative %
    let exitType: "tp" | "timeout" | "trap" = "timeout";

    for (let j = i + 1; j < candles.length; j++) {
      const f = candles[j];
      if (f.timestamp > deadline) break;

      // Track MAE
      const drawPct = ((f.low - entry) / entry) * 100;
      if (drawPct < worstDraw) worstDraw = drawPct;

      // Check TP hit
      if (f.high >= tpPrice) {
        hitTp = true;
        hoursToTp = (f.timestamp - c.timestamp) / 3600000;
        exitType = "tp";
        break;
      }
    }

    // Classify trap
    if (!hitTp && worstDraw <= -trapThresholds[0]) {
      exitType = "trap";
    }

    probes.push({
      timestamp: c.timestamp,
      entryPrice: entry,
      hitTp,
      hoursToTp,
      maeBeforeTp: worstDraw,
      exitType,
    });
  }

  return probes;
}

function compute1hAtr(candles: Candle[]): number[] {
  // Resample to 1h and compute ATR%
  const hourly: { high: number; low: number; close: number }[] = [];
  let curHour = -1;
  let h = 0, l = Infinity, lastClose = 0;

  for (const c of candles) {
    const hour = Math.floor(c.timestamp / 3600000);
    if (hour !== curHour) {
      if (curHour !== -1) {
        hourly.push({ high: h, low: l, close: lastClose });
      }
      curHour = hour;
      h = c.high;
      l = c.low;
    } else {
      if (c.high > h) h = c.high;
      if (c.low < l) l = c.low;
    }
    lastClose = c.close;
  }
  if (curHour !== -1) hourly.push({ high: h, low: l, close: lastClose });

  // ATR% = (high - low) / close * 100 for each hour
  return hourly.map(bar => ((bar.high - bar.low) / bar.close) * 100);
}

function computeTrendBreakFraction(candles: Candle[]): number {
  // Resample to 4h, compute EMA200 + EMA50 slope, count fraction where trend gate would block
  const period4h = 4 * 3600000;
  const bars4h: number[] = []; // close prices
  let curBar = -1;
  let lastClose = 0;

  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period4h);
    if (bar !== curBar) {
      if (curBar !== -1) bars4h.push(lastClose);
      curBar = bar;
    }
    lastClose = c.close;
  }
  if (curBar !== -1) bars4h.push(lastClose);

  if (bars4h.length < 210) return 0;

  // Compute EMAs
  const ema = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };

  const ema200 = ema(bars4h, 200);
  const ema50 = ema(bars4h, 50);

  // Count blocks: close < EMA200 AND EMA50 slope < 0
  let blocked = 0;
  const checkFrom = 200; // only check after EMA200 has warmed up
  for (let i = checkFrom; i < bars4h.length; i++) {
    const slopeEma50 = ema50[i] - ema50[i - 1];
    if (bars4h[i] < ema200[i] && slopeEma50 < 0) {
      blocked++;
    }
  }

  return blocked / (bars4h.length - checkFrom);
}

function scoreProbes(probes: BounceProbe[]): {
  tpRate: number;
  medianHours: number;
  meanHours: number;
  medianMae: number;
  trapRate5: number;
  trapRate8: number;
} {
  if (probes.length === 0) return { tpRate: 0, medianHours: 0, meanHours: 0, medianMae: 0, trapRate5: 0, trapRate8: 0 };

  const tpHits = probes.filter(p => p.hitTp);
  const tpRate = (tpHits.length / probes.length) * 100;
  const hours = tpHits.map(p => p.hoursToTp);
  const maes = probes.map(p => p.maeBeforeTp);
  const trap5 = probes.filter(p => p.maeBeforeTp <= -5).length / probes.length * 100;
  const trap8 = probes.filter(p => p.maeBeforeTp <= -8).length / probes.length * 100;

  return {
    tpRate,
    medianHours: median(hours),
    meanHours: hours.length > 0 ? hours.reduce((s, v) => s + v, 0) / hours.length : Infinity,
    medianMae: median(maes),
    trapRate5: trap5,
    trapRate8: trap8,
  };
}

function scorePair(symbol: string, candles: Candle[]): PairScore {
  const probes = runBounceProbes(candles);
  const overall = scoreProbes(probes);
  const atr1h = compute1hAtr(candles);
  const trendBreak = computeTrendBreakFraction(candles);
  const days = Math.round((candles[candles.length - 1].timestamp - candles[0].timestamp) / 86400000);

  // Monthly breakdown
  const byMonth: Record<string, BounceProbe[]> = {};
  for (const p of probes) {
    const m = new Date(p.timestamp).toISOString().slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(p);
  }

  // Monthly ATR
  const atrByMonth: Record<string, number[]> = {};
  let hourIdx = 0;
  for (const c of candles) {
    const m = new Date(c.timestamp).toISOString().slice(0, 7);
    if (!atrByMonth[m]) atrByMonth[m] = [];
  }
  // Simpler: recompute per month from hourly
  const hourlyCandles: { ts: number; atr: number }[] = [];
  {
    let curH = -1, h = 0, l = Infinity, cl = 0, ts = 0;
    for (const c of candles) {
      const hour = Math.floor(c.timestamp / 3600000);
      if (hour !== curH) {
        if (curH !== -1) hourlyCandles.push({ ts, atr: ((h - l) / cl) * 100 });
        curH = hour; h = c.high; l = c.low; ts = c.timestamp;
      } else {
        if (c.high > h) h = c.high;
        if (c.low < l) l = c.low;
      }
      cl = c.close;
    }
    if (curH !== -1) hourlyCandles.push({ ts, atr: ((h - l) / cl) * 100 });
  }

  const monthly: MonthlyScore[] = [];
  for (const [m, mProbes] of Object.entries(byMonth).sort()) {
    const ms = scoreProbes(mProbes);
    const mAtr = hourlyCandles.filter(h => new Date(h.ts).toISOString().slice(0, 7) === m).map(h => h.atr);
    monthly.push({
      month: m,
      probes: mProbes.length,
      tpHitRate: ms.tpRate,
      medianHoursToTp: ms.medianHours,
      meanHoursToTp: ms.meanHours,
      medianMae: ms.medianMae,
      trapRate: ms.trapRate5,
      deepTrapRate: ms.trapRate8,
      atr1hPct: median(mAtr),
    });
  }

  // Verdict based on Codex thresholds
  let verdict = "REJECT";
  if (days < 90) {
    verdict = "INSUFFICIENT DATA";
  } else if (
    overall.tpRate >= 72 &&
    overall.medianHours <= 3 &&
    median(atr1h) >= 1.2 && median(atr1h) <= 2.5 &&
    overall.trapRate5 <= 8
  ) {
    verdict = "STRONG CANDIDATE";
  } else if (
    overall.tpRate >= 68 &&
    overall.medianHours <= 4 &&
    median(atr1h) >= 0.8 && median(atr1h) <= 3.5
  ) {
    verdict = "MARGINAL";
  }

  return {
    symbol,
    days,
    overallTpRate: overall.tpRate,
    medianHoursToTp: overall.medianHours,
    medianMae: overall.medianMae,
    trapRate5: overall.trapRate5,
    trapRate8: overall.trapRate8,
    medianAtr1hPct: median(atr1h),
    trendBreakFraction: trendBreak,
    monthly,
    verdict,
  };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
function main() {
  const symbols = [
    "HYPEUSDT", "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "SUIUSDT", "TAOUSDT",
    "STGUSDT", "VVVUSDT", "RIVERUSDT", "SIRENUSDT", "BLUAIUSDT", "CUSDT", "DUSKUSDT",
    "LIGHTUSDT", "PIPPINUSDT",
  ];

  // Check for full HYPE data
  const hypeFullPath = path.resolve(process.cwd(), "data/HYPEUSDT_5_full.json");

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BOUNCE SCORE SCREENER — Pair Viability for DCA Ladder");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("Thresholds (from Codex):");
  console.log("  TP<24h ≥ 72% | Median hours ≤ 3h | 1h ATR% 1.2-2.5% | Trap rate <8%\n");

  const results: PairScore[] = [];

  for (const sym of symbols) {
    try {
      let candles: Candle[];
      if (sym === "HYPEUSDT" && fs.existsSync(hypeFullPath)) {
        candles = JSON.parse(fs.readFileSync(hypeFullPath, "utf-8"));
        console.log(`${sym}: using full history (${candles.length} candles)`);
      } else {
        candles = loadCandles(sym, "5");
        console.log(`${sym}: ${candles.length} candles`);
      }

      const score = scorePair(sym, candles);
      results.push(score);
    } catch (e: any) {
      console.log(`${sym}: ERROR — ${e.message.slice(0, 60)}`);
    }
  }

  // Summary table
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(
    "Symbol".padEnd(14) +
    "Days".padStart(5) +
    "TP<24h".padStart(8) +
    "MedH".padStart(7) +
    "MedMAE".padStart(8) +
    "Trap5%".padStart(8) +
    "Trap8%".padStart(8) +
    "ATR1h%".padStart(8) +
    "TrBrk%".padStart(8) +
    "  Verdict"
  );
  console.log("─".repeat(90));

  // Sort by TP rate descending
  results.sort((a, b) => b.overallTpRate - a.overallTpRate);

  for (const r of results) {
    console.log(
      r.symbol.padEnd(14) +
      String(r.days).padStart(5) +
      (r.overallTpRate.toFixed(1) + "%").padStart(8) +
      (r.medianHoursToTp === Infinity ? "  n/a" : r.medianHoursToTp.toFixed(1) + "h").padStart(7) +
      (r.medianMae.toFixed(2) + "%").padStart(8) +
      (r.trapRate5.toFixed(1) + "%").padStart(8) +
      (r.trapRate8.toFixed(1) + "%").padStart(8) +
      (r.medianAtr1hPct.toFixed(2) + "%").padStart(8) +
      (r.trendBreakFraction > 0 ? (r.trendBreakFraction * 100).toFixed(0) + "%" : "n/a").padStart(8) +
      "  " + r.verdict
    );
  }

  // Detailed monthly for top candidates
  const candidates = results.filter(r => r.verdict !== "REJECT" && r.verdict !== "INSUFFICIENT DATA");
  if (candidates.length === 0) {
    // Show top 3 anyway
    candidates.push(...results.slice(0, 3));
  }

  for (const r of candidates) {
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  ${r.symbol} — Monthly Detail [${r.verdict}]`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);

    console.log(
      "Month".padEnd(10) +
      "Probes".padStart(7) +
      "TP<24h".padStart(8) +
      "MedH".padStart(7) +
      "MedMAE".padStart(8) +
      "Trap5%".padStart(8) +
      "ATR1h%".padStart(8)
    );
    console.log("─".repeat(56));

    for (const m of r.monthly) {
      const flag = m.tpHitRate >= 72 ? " ✓" : m.tpHitRate < 50 ? " ✗" : "";
      console.log(
        m.month.padEnd(10) +
        String(m.probes).padStart(7) +
        (m.tpHitRate.toFixed(1) + "%").padStart(8) +
        (m.medianHoursToTp === Infinity ? "  n/a" : m.medianHoursToTp.toFixed(1) + "h").padStart(7) +
        (m.medianMae.toFixed(2) + "%").padStart(8) +
        (m.trapRate.toFixed(1) + "%").padStart(8) +
        (m.atr1hPct.toFixed(2) + "%").padStart(8) +
        flag
      );
    }
  }
}

main();
