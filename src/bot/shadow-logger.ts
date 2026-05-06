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
  tailCache.set(filename, { rows, loadedAt: now });
  return rows.filter(r => r.ts >= sinceMs);
}

function lastBefore<T extends { ts: number }>(rows: T[], t: number): T | null {
  let last: T | null = null;
  for (const r of rows) { if (r.ts <= t) last = r; else break; }
  return last;
}

export interface OnChainFeatures {
  taker4h: number | null;
  taker4hBuyVol: number | null;
  taker4hSellVol: number | null;
  liq4hLongUsd: number | null;
  liq4hShortUsd: number | null;
  liq4hLongShortRatio: number | null;
  oiBy4hPct: number | null;
  oiBn4hPct: number | null;
  oiHl4hPct: number | null;
  fdByNow: number | null;
  fdBnNow: number | null;
  fdHlNow: number | null;
  btc4hMovePct: number | null;
}

export async function computeOnChainFeatures(symbol: string, nowMs: number): Promise<OnChainFeatures> {
  const since = nowMs - FOUR_HOURS;

  const [taker, liq, oiBy, oiBn, oiHl, fdBy, fdBn, fdHl, btc] = await Promise.all([
    readTail(`${symbol}_taker_binance.jsonl`, since),
    readTail(`${symbol}_liquidations.jsonl`, since),
    readTail(`${symbol}_oi_live.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_oi_live_binance.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_oi_live_hyperliquid.jsonl`, since - FOUR_HOURS),
    readTail(`${symbol}_funding_live.jsonl`, since),
    readTail(`${symbol}_funding_live_binance.jsonl`, since),
    readTail(`${symbol}_funding_live_hyperliquid.jsonl`, since),
    readTail(`BTCUSDT_1m.jsonl`, since),
  ]);

  const takerBuy = taker.reduce((s, r) => s + (r.buyVol || 0), 0);
  const takerSell = taker.reduce((s, r) => s + (r.sellVol || 0), 0);
  const taker4h = takerSell > 0 ? takerBuy / takerSell : null;

  const liqLong = liq.filter(r => r.liquidatedSide === "long").reduce((s, r) => s + (r.notionalUsd || 0), 0);
  const liqShort = liq.filter(r => r.liquidatedSide === "short").reduce((s, r) => s + (r.notionalUsd || 0), 0);

  const oiByPre = lastBefore(oiBy, since)?.openInterestValue ?? null;
  const oiByNow = lastBefore(oiBy, nowMs)?.openInterestValue ?? null;
  const oiBnPre = lastBefore(oiBn, since)?.openInterestValue ?? null;
  const oiBnNow = lastBefore(oiBn, nowMs)?.openInterestValue ?? null;
  const oiHlPre = lastBefore(oiHl, since)?.openInterestValue ?? null;
  const oiHlNow = lastBefore(oiHl, nowMs)?.openInterestValue ?? null;

  const btcStart = btc[0];
  const btcEnd = btc[btc.length - 1];
  const btc4hMovePct = btcStart && btcEnd && btcStart.o ? ((btcEnd.c - btcStart.o) / btcStart.o) * 100 : null;

  return {
    taker4h,
    taker4hBuyVol: takerBuy || null,
    taker4hSellVol: takerSell || null,
    liq4hLongUsd: liqLong || null,
    liq4hShortUsd: liqShort || null,
    liq4hLongShortRatio: liqShort > 0 ? liqLong / liqShort : null,
    oiBy4hPct: oiByPre && oiByNow ? ((oiByNow - oiByPre) / oiByPre) * 100 : null,
    oiBn4hPct: oiBnPre && oiBnNow ? ((oiBnNow - oiBnPre) / oiBnPre) * 100 : null,
    oiHl4hPct: oiHlPre && oiHlNow ? ((oiHlNow - oiHlPre) / oiHlPre) * 100 : null,
    fdByNow: lastBefore(fdBy, nowMs)?.fundingRate ?? null,
    fdBnNow: lastBefore(fdBn, nowMs)?.fundingRate ?? null,
    fdHlNow: lastBefore(fdHl, nowMs)?.fundingRate ?? null,
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
