import fs from "fs";
import path from "path";
import { Candle } from "./fetch-candles";
import { EMA } from "technicalindicators";
import { computeIndicators, getSnapshotAt, IndicatorSnapshot } from "./indicators";

interface OiRow {
  timestamp: number;
  openInterest: number;
}

interface FundingRow {
  timestamp: number;
  fundingRate: number;
}

interface HourRow {
  ts: number;
  price: number;
  fundingRate: number;
  oi: number;
  priceRet1h: number;
  priceRet4h: number;
  priceRet12h: number;
  priceRet24h: number;
  oiDelta1h: number;
  oiDelta4h: number;
  oiDelta12h: number;
  oiDelta24h: number;
  futureRet4h: number;
  futureRet12h: number;
  futureRet24h: number;
  hitTp24h: boolean;
  hitDown3_24h: boolean;
  hitDown5_24h: boolean;
  rsi1h: number;
  priceVsEma50_1h: number;
  roc5_1h: number;
}

interface FundingEval {
  timestamp: number;
  fundingRate: number;
  futureRet24h: number;
  futureRet12h: number;
  hitTp24h: boolean;
  hitDown5_24h: boolean;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(0)}%` : "n/a";
}

function fmtPct(value: number, digits: number = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function loadCandlesAuto(symbol: string): Candle[] {
  const full = path.resolve(process.cwd(), `data/${symbol}_5_full.json`);
  const plain = path.resolve(process.cwd(), `data/${symbol}_5.json`);
  const file = fs.existsSync(full) ? full : plain;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function loadOi(symbol: string): OiRow[] {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `data/${symbol}_oi.json`), "utf-8"));
}

function loadFunding(symbol: string): FundingRow[] {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `data/${symbol}_funding.json`), "utf-8"));
}

function resampleCandles(source: Candle[], periodMs: number): Candle[] {
  const out: Candle[] = [];
  let currentBucket = -1;
  let bucketStart = 0;
  let open = 0;
  let high = 0;
  let low = 0;
  let close = 0;
  let volume = 0;
  let turnover = 0;

  for (const c of source) {
    const bucket = Math.floor(c.timestamp / periodMs);
    if (bucket !== currentBucket) {
      if (currentBucket !== -1) {
        out.push({ timestamp: bucketStart, open, high, low, close, volume, turnover });
      }
      currentBucket = bucket;
      bucketStart = bucket * periodMs;
      open = c.open;
      high = c.high;
      low = c.low;
      close = c.close;
      volume = c.volume;
      turnover = c.turnover;
    } else {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      close = c.close;
      volume += c.volume;
      turnover += c.turnover;
    }
  }

  if (currentBucket !== -1) {
    out.push({ timestamp: bucketStart, open, high, low, close, volume, turnover });
  }

  return out;
}

function closeAtOrBefore(candles: Candle[], targetTs: number): Candle {
  let lo = 0;
  let hi = candles.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].timestamp <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return candles[best];
}

function futureWindow(candles: Candle[], targetTs: number, hours: number): { high: number; low: number; close: number } {
  const endTs = targetTs + hours * 3600000;
  let started = false;
  let high = 0;
  let low = Infinity;
  let close = closeAtOrBefore(candles, targetTs).close;
  for (const c of candles) {
    if (c.timestamp <= targetTs) continue;
    if (c.timestamp > endTs) break;
    if (!started) {
      high = c.high;
      low = c.low;
      started = true;
    } else {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    close = c.close;
  }
  if (!started) {
    const price = closeAtOrBefore(candles, targetTs).close;
    return { high: price, low: price, close: price };
  }
  return { high, low, close };
}

function findFundingAtOrBefore(rows: FundingRow[], ts: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].timestamp <= ts) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return rows[best]?.fundingRate ?? 0;
}

function buildHourRows(symbol: string): HourRow[] {
  const candles5 = loadCandlesAuto(symbol);
  const oi = loadOi(symbol);
  const funding = loadFunding(symbol);
  const candles1h = resampleCandles(candles5, 3600000);
  const ind1h = computeIndicators(candles1h);

  const rows: HourRow[] = [];
  for (let i = 24; i < oi.length - 24; i++) {
    const row = oi[i];
    const price = closeAtOrBefore(candles5, row.timestamp).close;
    const prev1 = closeAtOrBefore(candles5, oi[i - 1].timestamp).close;
    const prev4 = closeAtOrBefore(candles5, oi[i - 4].timestamp).close;
    const prev12 = closeAtOrBefore(candles5, oi[i - 12].timestamp).close;
    const prev24 = closeAtOrBefore(candles5, oi[i - 24].timestamp).close;
    const fw4 = futureWindow(candles5, row.timestamp, 4);
    const fw12 = futureWindow(candles5, row.timestamp, 12);
    const fw24 = futureWindow(candles5, row.timestamp, 24);
    const snap1h = getSnapshotAt(ind1h, row.timestamp, 3600000);

    rows.push({
      ts: row.timestamp,
      price,
      fundingRate: findFundingAtOrBefore(funding, row.timestamp),
      oi: row.openInterest,
      priceRet1h: ((price - prev1) / prev1) * 100,
      priceRet4h: ((price - prev4) / prev4) * 100,
      priceRet12h: ((price - prev12) / prev12) * 100,
      priceRet24h: ((price - prev24) / prev24) * 100,
      oiDelta1h: ((row.openInterest - oi[i - 1].openInterest) / oi[i - 1].openInterest) * 100,
      oiDelta4h: ((row.openInterest - oi[i - 4].openInterest) / oi[i - 4].openInterest) * 100,
      oiDelta12h: ((row.openInterest - oi[i - 12].openInterest) / oi[i - 12].openInterest) * 100,
      oiDelta24h: ((row.openInterest - oi[i - 24].openInterest) / oi[i - 24].openInterest) * 100,
      futureRet4h: ((fw4.close - price) / price) * 100,
      futureRet12h: ((fw12.close - price) / price) * 100,
      futureRet24h: ((fw24.close - price) / price) * 100,
      hitTp24h: fw24.high >= price * 1.014,
      hitDown3_24h: fw24.low <= price * 0.97,
      hitDown5_24h: fw24.low <= price * 0.95,
      rsi1h: snap1h?.rsi14 ?? 0,
      priceVsEma50_1h: snap1h?.priceVsEma50 ?? 0,
      roc5_1h: snap1h?.roc5 ?? 0,
    });
  }
  return rows;
}

function summarizeGroup(label: string, rows: HourRow[]) {
  console.log(
    `${label.padEnd(30)} ${String(rows.length).padStart(6)} | ` +
    `f12 ${fmtPct(mean(rows.map((r) => r.futureRet12h)), 2).padStart(8)} | ` +
    `f24 ${fmtPct(mean(rows.map((r) => r.futureRet24h)), 2).padStart(8)} | ` +
    `TP24 ${pct(rows.filter((r) => r.hitTp24h).length, rows.length).padStart(5)} | ` +
    `Down5 ${pct(rows.filter((r) => r.hitDown5_24h).length, rows.length).padStart(5)}`
  );
}

function evaluateOiSign(rows: HourRow[], window: 1 | 4 | 12 | 24) {
  const priceKey = `priceRet${window}h` as const;
  const oiKey = `oiDelta${window}h` as const;
  const down = rows.filter((r) => r[priceKey] < 0);
  const downOiDown = down.filter((r) => r[oiKey] < 0);
  const downOiUp = down.filter((r) => r[oiKey] > 0);
  console.log(`\nPrice down over ${window}h`);
  summarizeGroup("OI down", downOiDown);
  summarizeGroup("OI up", downOiUp);
}

type Rule = {
  name: string;
  predicate: (row: HourRow) => boolean;
};

function evaluateRules(title: string, rows: HourRow[], rules: Rule[]) {
  console.log(`\n${title}`);
  console.log("-".repeat(110));
  console.log("Rule".padEnd(42) + "Count".padStart(7) + " f12".padStart(9) + " f24".padStart(9) + " TP24".padStart(7) + " Down5".padStart(8));
  for (const rule of rules) {
    const hit = rows.filter(rule.predicate);
    console.log(
      rule.name.padEnd(42) +
      String(hit.length).padStart(7) +
      fmtPct(mean(hit.map((r) => r.futureRet12h)), 2).padStart(9) +
      fmtPct(mean(hit.map((r) => r.futureRet24h)), 2).padStart(9) +
      pct(hit.filter((r) => r.hitTp24h).length, hit.length).padStart(7) +
      pct(hit.filter((r) => r.hitDown5_24h).length, hit.length).padStart(8),
    );
  }
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((s.length - 1) * q);
  return s[idx];
}

function fundingRegimeAnalysis(rows: HourRow[]) {
  const fundingRows = loadFunding("HYPEUSDT");
  const candles5 = loadCandlesAuto("HYPEUSDT");
  const evals: FundingEval[] = fundingRows.map((f) => {
    const price = closeAtOrBefore(candles5, f.timestamp).close;
    const fw12 = futureWindow(candles5, f.timestamp, 12);
    const fw24 = futureWindow(candles5, f.timestamp, 24);
    return {
      timestamp: f.timestamp,
      fundingRate: f.fundingRate,
      futureRet12h: ((fw12.close - price) / price) * 100,
      futureRet24h: ((fw24.close - price) / price) * 100,
      hitTp24h: fw24.high >= price * 1.014,
      hitDown5_24h: fw24.low <= price * 0.95,
    };
  });
  const funding = evals.map((r) => r.fundingRate);
  const exactFloor = evals.filter((r) => Math.abs(r.fundingRate - 0.0001) < 1e-8).length;
  console.log(`\nFunding distribution (HYPE)`);
  console.log("-".repeat(110));
  console.log(`Snapshots: ${evals.length}`);
  console.log(`Mean: ${(mean(funding) * 100).toFixed(4)}% | Median: ${(median(funding) * 100).toFixed(4)}% | Min: ${(Math.min(...funding) * 100).toFixed(4)}% | Max: ${(Math.max(...funding) * 100).toFixed(4)}%`);
  console.log(`p90: ${(quantile(funding, 0.9) * 100).toFixed(4)}% | p95: ${(quantile(funding, 0.95) * 100).toFixed(4)}% | p99: ${(quantile(funding, 0.99) * 100).toFixed(4)}%`);
  console.log(`Exactly +0.0100% floor: ${exactFloor}/${evals.length} (${pct(exactFloor, evals.length)})`);

  const p95 = quantile(funding, 0.95);
  const groups = [
    { name: "funding < 0", rows: evals.filter((r) => r.fundingRate < 0) },
    { name: "0 to 0.01%", rows: evals.filter((r) => r.fundingRate >= 0 && r.fundingRate <= 0.0001) },
    { name: "0.01% to 0.03%", rows: evals.filter((r) => r.fundingRate > 0.0001 && r.fundingRate <= 0.0003) },
    { name: "> 0.03%", rows: evals.filter((r) => r.fundingRate > 0.0003) },
    { name: "> p95", rows: evals.filter((r) => r.fundingRate >= p95) },
  ];
  console.log(`\nFunding predictive value (8h snapshots)`);
  console.log("-".repeat(110));
  console.log("Regime".padEnd(24) + "Count".padStart(7) + " f12".padStart(9) + " f24".padStart(9) + " TP24".padStart(7) + " Down5".padStart(8));
  for (const g of groups) {
    console.log(
      g.name.padEnd(24) +
      String(g.rows.length).padStart(7) +
      fmtPct(mean(g.rows.map((r) => r.futureRet12h)), 2).padStart(9) +
      fmtPct(mean(g.rows.map((r) => r.futureRet24h)), 2).padStart(9) +
      pct(g.rows.filter((r) => r.hitTp24h).length, g.rows.length).padStart(7) +
      pct(g.rows.filter((r) => r.hitDown5_24h).length, g.rows.length).padStart(8),
    );
  }
}

function crossAssetComparison(symbols: string[], window: 4 | 12) {
  console.log(`\nCross-asset OI sign comparison (${window}h window, price down only)`);
  console.log("-".repeat(110));
  console.log("Symbol".padEnd(12) + "Count".padStart(7) + " OI↓ f24".padStart(10) + " OI↓ TP".padStart(8) + " OI↑ f24".padStart(10) + " OI↑ TP".padStart(8));
  for (const symbol of symbols) {
    const rows = buildHourRows(symbol);
    const priceKey = `priceRet${window}h` as const;
    const oiKey = `oiDelta${window}h` as const;
    const down = rows.filter((r) => r[priceKey] < 0);
    const oiDown = down.filter((r) => r[oiKey] < 0);
    const oiUp = down.filter((r) => r[oiKey] > 0);
    console.log(
      symbol.padEnd(12) +
      String(down.length).padStart(7) +
      fmtPct(mean(oiDown.map((r) => r.futureRet24h)), 2).padStart(10) +
      pct(oiDown.filter((r) => r.hitTp24h).length, oiDown.length).padStart(8) +
      fmtPct(mean(oiUp.map((r) => r.futureRet24h)), 2).padStart(10) +
      pct(oiUp.filter((r) => r.hitTp24h).length, oiUp.length).padStart(8),
    );
  }
}

function main() {
  const rows = buildHourRows("HYPEUSDT");

  console.log("=".repeat(110));
  console.log("  HYPE OI + FUNDING ANALYSIS");
  console.log("=".repeat(110));
  console.log(`Rows: ${rows.length} hourly points`);
  console.log(`Range: ${new Date(rows[0].ts).toISOString().slice(0, 10)} -> ${new Date(rows[rows.length - 1].ts).toISOString().slice(0, 10)}`);

  console.log(`\nOI delta distribution (HYPE)`);
  console.log("-".repeat(110));
  for (const w of [1, 4, 12, 24] as const) {
    const vals = rows.map((r) => r[`oiDelta${w}h`]);
    console.log(
      `${String(w).padStart(2)}h: mean ${fmtPct(mean(vals), 2)} | median ${fmtPct(median(vals), 2)} | ` +
      `p10 ${fmtPct(quantile(vals, 0.1), 2)} | p90 ${fmtPct(quantile(vals, 0.9), 2)}`
    );
  }

  console.log(`\nHYPE OI divergence sign tests`);
  console.log("-".repeat(110));
  for (const w of [1, 4, 12, 24] as const) {
    evaluateOiSign(rows, w);
  }

  const hypeRules: Rule[] = [
    { name: "4h price<-3 + RSI1h<=42 + ROC1h<=-3", predicate: (r) => r.priceRet4h <= -3 && r.rsi1h <= 42 && r.roc5_1h <= -3 },
    { name: "4h price<-3 and 4h OI<-2", predicate: (r) => r.priceRet4h <= -3 && r.oiDelta4h <= -2 },
    { name: "4h price<-3 and 4h OI>+2", predicate: (r) => r.priceRet4h <= -3 && r.oiDelta4h >= 2 },
    { name: "12h price<-5 and 12h OI<-3", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h <= -3 },
    { name: "12h price<-5 and 12h OI>+3", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h >= 3 },
    { name: "4h price<-3 + OI<-2 + RSI1h<=42", predicate: (r) => r.priceRet4h <= -3 && r.oiDelta4h <= -2 && r.rsi1h <= 42 },
    { name: "4h price<-3 + OI>+2 + RSI1h<=42", predicate: (r) => r.priceRet4h <= -3 && r.oiDelta4h >= 2 && r.rsi1h <= 42 },
    { name: "4h price<-3 + OI<-2 + price<EMA50", predicate: (r) => r.priceRet4h <= -3 && r.oiDelta4h <= -2 && r.priceVsEma50_1h < -1 },
    { name: "12h price<-5 + OI<-3 + RSI1h<=38", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h <= -3 && r.rsi1h <= 38 },
    { name: "12h price<-5 + OI<-3 + RSI1h>38", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h <= -3 && r.rsi1h > 38 },
    { name: "12h price<-5 + OI<-3 + funding>0.03%", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h <= -3 && r.fundingRate > 0.0003 },
    { name: "12h price<-5 + OI>+3 + funding<0.01%", predicate: (r) => r.priceRet12h <= -5 && r.oiDelta12h >= 3 && r.fundingRate <= 0.0001 },
  ];
  evaluateRules("Candidate HYPE gating rules", rows, hypeRules);

  fundingRegimeAnalysis(rows);

  crossAssetComparison(["BTCUSDT", "ETHUSDT", "SOLUSDT"], 4);
  crossAssetComparison(["BTCUSDT", "ETHUSDT", "SOLUSDT"], 12);
}

main();
