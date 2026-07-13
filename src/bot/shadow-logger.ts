import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

export type DecisionType =
  | "ladder_add"
  | "flatten"
  | "hedge_open"
  | "tp_fill"
  | "wed_short_open"
  | "wed_short_close"
  | "d1_short_open"
  | "d1_short_close"
  | "pf0_short_open"
  | "pf0_short_close";

const DATA_DIR = path.join(process.cwd(), "data");
const FIFTEEN_MIN = 15 * 60_000;
const ONE_HOUR = 60 * 60_000;
const FOUR_HOURS = 4 * 3600_000;

export const SHADOW_CONFIG_VERSION = process.env.SHADOW_CONFIG_VERSION ?? "5.12-phase-A";

interface FileTail {
  rows: any[];
  loadedAt: number;
}
const tailCache = new Map<string, FileTail>();
const TAIL_TTL_MS = 30_000;

async function readTail(filename: string, sinceMs: number): Promise<any[]> {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];

  const cached = tailCache.get(filename);
  const now = Date.now();
  if (cached && now - cached.loadedAt < TAIL_TTL_MS) {
    return cached.rows.filter(r => r.ts >= sinceMs);
  }

  const rows: any[] = [];
  try {
    const stat = fs.statSync(filePath);
    const readBytes = Math.min(stat.size, 4 * 1024 * 1024);
    const start = Math.max(0, stat.size - readBytes);
    const stream = fs.createReadStream(filePath, { start });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let isFirst = start > 0;
    for await (const line of rl) {
      if (isFirst) { isFirst = false; continue; }
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        const ts = o.timestamp ?? (o.ts && typeof o.ts === "string" ? new Date(o.ts).getTime() : o.ts);
        if (typeof ts === "number") rows.push({ ...o, ts });
      } catch {}
    }
  } catch {
    return [];
  }
  rows.sort((a, b) => a.ts - b.ts);
  tailCache.set(filename, { rows, loadedAt: now });
  return rows.filter(r => r.ts >= sinceMs);
}

function lastBefore<T extends { ts: number }>(rows: T[], t: number): T | null {
  let last: T | null = null;
  for (const r of rows) { if (r.ts <= t) last = r; else break; }
  return last;
}

function rowsBetween<T extends { ts: number }>(rows: T[], start: number, end: number): T[] {
  return rows.filter(r => r.ts > start && r.ts <= end);
}

function num(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function pctChange(now: number | null, prev: number | null): number | null {
  if (now === null || prev === null || prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function takerWindow(rows: any[], start: number, end: number) {
  const xs = rowsBetween(rows, start, end);
  const buyVol = xs.reduce((s, r) => s + (num(r.buyVol) ?? 0), 0);
  const sellVol = xs.reduce((s, r) => s + (num(r.sellVol) ?? 0), 0);
  const buyNotional = xs.reduce((s, r) => s + (num(r.buyNotional) ?? 0), 0);
  const sellNotional = xs.reduce((s, r) => s + (num(r.sellNotional) ?? 0), 0);
  return {
    buyVol,
    sellVol,
    buyNotional,
    sellNotional,
    ratioVol: ratio(buyVol, sellVol),
    ratioNotional: ratio(buyNotional, sellNotional),
    netNotional: buyNotional - sellNotional,
    samples: new Set(xs.map(row => Math.floor(row.ts / 60_000))).size,
    latestTs: xs.length ? xs[xs.length - 1].ts : null,
  };
}

function band(row: any, side: "bidBands" | "askBands", key: string): number | null {
  return num(row?.[side]?.[key]);
}

export interface OnChainFeatures {
  taker4h: number | null;
  taker4hBuyVol: number | null;
  taker4hSellVol: number | null;
  taker1h: number | null;
  taker1hBuyVol: number | null;
  taker1hSellVol: number | null;
  hlTaker15m: number | null;
  hlTaker1h: number | null;
  hlTaker4h: number | null;
  hlTaker15mSamples: number;
  hlTaker1hSamples: number;
  hlTakerAgeSec: number | null;
  hlTaker15mNetNotional: number | null;
  hlTaker1hNetNotional: number | null;
  hlTaker4hNetNotional: number | null;
  hlTaker15mBuyNotional: number | null;
  hlTaker15mSellNotional: number | null;
  liq4hLongUsd: number | null;
  liq4hShortUsd: number | null;
  liq4hLongShortRatio: number | null;
  oiBy4hPct: number | null;
  oiBn4hPct: number | null;
  oiHl4hPct: number | null;
  oiHl1hPct: number | null;
  hlAssetOi1hPct: number | null;
  hlAssetOi4hPct: number | null;
  hlAssetFundingNow: number | null;
  hlAssetAgeSec: number | null;
  hlAsset1hAnchorLagSec: number | null;
  hlAsset4hAnchorLagSec: number | null;
  fdByNow: number | null;
  fdBnNow: number | null;
  fdHlNow: number | null;
  hlObBid025Usd: number | null;
  hlObAsk025Usd: number | null;
  hlObBid05Usd: number | null;
  hlObAsk05Usd: number | null;
  hlObBid2Usd: number | null;
  hlObAsk2Usd: number | null;
  hlObImbalance05: number | null;
  hlObImbalance2: number | null;
  hlObAskBid05Ratio: number | null;
  hlObAskBid2Ratio: number | null;
  hlObAgeSec: number | null;
  btc4hMovePct: number | null;
}

export async function computeOnChainFeatures(symbol: string, nowMs: number): Promise<OnChainFeatures> {
  const since = nowMs - FOUR_HOURS;

  const [taker, hlTaker, hlOb, hlAsset, liq, oiBy, oiBn, oiHl, fdBy, fdBn, fdHl, btc] = await Promise.all([
    readTail(`${symbol}_taker_binance.jsonl`, since),
    readTail(`${symbol}_taker_hyperliquid.jsonl`, since),
    readTail(`${symbol}_ob_bands_hyperliquid.jsonl`, since),
    readTail(`${symbol}_asset_ctx_hyperliquid.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_liquidations.jsonl`, since),
    readTail(`${symbol}_oi_live.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_oi_live_binance.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_oi_live_hyperliquid.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_funding_live.jsonl`, since),
    readTail(`${symbol}_funding_live_binance.jsonl`, since),
    readTail(`${symbol}_funding_live_hyperliquid.jsonl`, since),
    readTail(`BTCUSDT_1m.jsonl`, since),
  ]);

  const taker1hWindow = takerWindow(taker, nowMs - ONE_HOUR, nowMs);
  const taker4hWindow = takerWindow(taker, nowMs - FOUR_HOURS, nowMs);
  const hlTaker15mWindow = takerWindow(hlTaker, nowMs - FIFTEEN_MIN, nowMs);
  const hlTaker1hWindow = takerWindow(hlTaker, nowMs - ONE_HOUR, nowMs);
  const hlTaker4hWindow = takerWindow(hlTaker, nowMs - FOUR_HOURS, nowMs);

  const liqLong = liq.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
  const liqShort = liq.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);

  const oiByPre = lastBefore(oiBy, since)?.openInterestValue ?? null;
  const oiByNow = lastBefore(oiBy, nowMs)?.openInterestValue ?? null;
  const oiBnPre = lastBefore(oiBn, since)?.openInterestValue ?? null;
  const oiBnNow = lastBefore(oiBn, nowMs)?.openInterestValue ?? null;
  const oiHlPre = lastBefore(oiHl, since)?.openInterestValue ?? null;
  const oiHlNow = lastBefore(oiHl, nowMs)?.openInterestValue ?? null;
  const oiHl1hPre = lastBefore(oiHl, nowMs - ONE_HOUR)?.openInterestValue ?? null;

  const hlAssetNow = lastBefore(hlAsset, nowMs);
  const hlAssetOiNow = num(hlAssetNow?.openInterestValue) ??
    (num(hlAssetNow?.openInterest) !== null && num(hlAssetNow?.markPrice) !== null
      ? (num(hlAssetNow?.openInterest) as number) * (num(hlAssetNow?.markPrice) as number)
      : null);
  const hlAsset1h = lastBefore(hlAsset, nowMs - ONE_HOUR);
  const hlAsset4h = lastBefore(hlAsset, nowMs - FOUR_HOURS);
  const hlAssetOi1h = num(hlAsset1h?.openInterestValue) ??
    (num(hlAsset1h?.openInterest) !== null && num(hlAsset1h?.markPrice) !== null
      ? (num(hlAsset1h?.openInterest) as number) * (num(hlAsset1h?.markPrice) as number)
      : null);
  const hlAssetOi4h = num(hlAsset4h?.openInterestValue) ??
    (num(hlAsset4h?.openInterest) !== null && num(hlAsset4h?.markPrice) !== null
      ? (num(hlAsset4h?.openInterest) as number) * (num(hlAsset4h?.markPrice) as number)
      : null);

  const hlObNow = lastBefore(hlOb, nowMs);
  const hlObBid05 = band(hlObNow, "bidBands", "pct_0_5");
  const hlObAsk05 = band(hlObNow, "askBands", "pct_0_5");
  const hlObBid2 = band(hlObNow, "bidBands", "pct_2_0");
  const hlObAsk2 = band(hlObNow, "askBands", "pct_2_0");

  const btcStart = btc[0];
  const btcEnd = btc[btc.length - 1];
  const btc4hMovePct = btcStart && btcEnd && btcStart.o ? ((btcEnd.c - btcStart.o) / btcStart.o) * 100 : null;

  return {
    taker4h: taker4hWindow.ratioVol,
    taker4hBuyVol: taker4hWindow.buyVol || null,
    taker4hSellVol: taker4hWindow.sellVol || null,
    taker1h: taker1hWindow.ratioVol,
    taker1hBuyVol: taker1hWindow.buyVol || null,
    taker1hSellVol: taker1hWindow.sellVol || null,
    hlTaker15m: hlTaker15mWindow.ratioNotional,
    hlTaker1h: hlTaker1hWindow.ratioNotional,
    hlTaker4h: hlTaker4hWindow.ratioNotional,
    hlTaker15mSamples: hlTaker15mWindow.samples,
    hlTaker1hSamples: hlTaker1hWindow.samples,
    hlTakerAgeSec: hlTaker1hWindow.latestTs === null ? null : (nowMs - hlTaker1hWindow.latestTs) / 1000,
    hlTaker15mNetNotional: hlTaker15mWindow.netNotional || null,
    hlTaker1hNetNotional: hlTaker1hWindow.netNotional || null,
    hlTaker4hNetNotional: hlTaker4hWindow.netNotional || null,
    hlTaker15mBuyNotional: hlTaker15mWindow.buyNotional || null,
    hlTaker15mSellNotional: hlTaker15mWindow.sellNotional || null,
    liq4hLongUsd: liqLong || null,
    liq4hShortUsd: liqShort || null,
    liq4hLongShortRatio: liqShort > 0 ? liqLong / liqShort : null,
    oiBy4hPct: oiByPre && oiByNow ? ((oiByNow - oiByPre) / oiByPre) * 100 : null,
    oiBn4hPct: oiBnPre && oiBnNow ? ((oiBnNow - oiBnPre) / oiBnPre) * 100 : null,
    oiHl4hPct: oiHlPre && oiHlNow ? ((oiHlNow - oiHlPre) / oiHlPre) * 100 : null,
    oiHl1hPct: oiHl1hPre && oiHlNow ? ((oiHlNow - oiHl1hPre) / oiHl1hPre) * 100 : null,
    hlAssetOi1hPct: pctChange(hlAssetOiNow, hlAssetOi1h),
    hlAssetOi4hPct: pctChange(hlAssetOiNow, hlAssetOi4h),
    hlAssetFundingNow: num(hlAssetNow?.fundingRate),
    hlAssetAgeSec: hlAssetNow ? (nowMs - hlAssetNow.ts) / 1000 : null,
    hlAsset1hAnchorLagSec: hlAsset1h ? ((nowMs - ONE_HOUR) - hlAsset1h.ts) / 1000 : null,
    hlAsset4hAnchorLagSec: hlAsset4h ? ((nowMs - FOUR_HOURS) - hlAsset4h.ts) / 1000 : null,
    fdByNow: lastBefore(fdBy, nowMs)?.fundingRate ?? null,
    fdBnNow: lastBefore(fdBn, nowMs)?.fundingRate ?? null,
    fdHlNow: lastBefore(fdHl, nowMs)?.fundingRate ?? null,
    hlObBid025Usd: band(hlObNow, "bidBands", "pct_0_25"),
    hlObAsk025Usd: band(hlObNow, "askBands", "pct_0_25"),
    hlObBid05Usd: hlObBid05,
    hlObAsk05Usd: hlObAsk05,
    hlObBid2Usd: hlObBid2,
    hlObAsk2Usd: hlObAsk2,
    hlObImbalance05: num(hlObNow?.imbalance_0_5),
    hlObImbalance2: num(hlObNow?.imbalance_2_0),
    hlObAskBid05Ratio: hlObBid05 !== null ? ratio(hlObAsk05 ?? 0, hlObBid05) : null,
    hlObAskBid2Ratio: hlObBid2 !== null ? ratio(hlObAsk2 ?? 0, hlObBid2) : null,
    hlObAgeSec: hlObNow ? (nowMs - hlObNow.ts) / 1000 : null,
    btc4hMovePct,
  };
}

export async function logDecision(
  symbol: string,
  decision: DecisionType,
  context: Record<string, any>,
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    const features = await computeOnChainFeatures(symbol, nowMs);
    const row = {
      ts: nowMs,
      iso: new Date(nowMs).toISOString(),
      symbol,
      decision,
      configVersion: SHADOW_CONFIG_VERSION,
      ...context,
      ...features,
    };
    const outPath = path.join(DATA_DIR, `${symbol}_decisions.jsonl`);
    fs.appendFileSync(outPath, JSON.stringify(row) + "\n");
  } catch {
    // shadow logging must never affect bot operation
  }
}
