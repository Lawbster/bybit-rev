/** Verified, opt-in historical price repair. Never evidence of original live receipt. */
import fs from "fs";
import crypto from "crypto";
import type { Candle } from "./hype-freerun-canonical-replay";

export const MINUTE = 60_000;
const ENDPOINT = "https://api.bybit.com/v5/market/kline";
const FIELDS = ["open", "high", "low", "close", "volume", "turnover"] as const;
export const REPAIR_PURPOSE = "corrected_exchange_history_not_recorded_arrival";

export interface CandleResponse {
  url: string;
  requestedAt: number;
  receivedAt: number;
  sha256: string;
  body: string;
}
export interface GapEvidence {
  missingTs: number;
  minute: CandleResponse;
  fiveMinute: CandleResponse;
}
export interface CandleRepairBundle {
  version: 1;
  purpose: typeof REPAIR_PURPOSE;
  symbol: string;
  category: "linear";
  intervalMs: 60000;
  cutoff: number;
  retrievedAt: number;
  originalInputs: Array<{ file: string; bytes: number; sha256: string }>;
  generatorSha256: string;
  evidence: GapEvidence[];
}
export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
export function candleRequestUrl(symbol: string, interval: "1" | "5", start: number, end: number): string {
  return `${ENDPOINT}?category=linear&symbol=${encodeURIComponent(symbol)}&interval=${interval}&start=${start}&end=${end}&limit=10`;
}
export function missingMinutes(candles: Candle[], maxGaps = 20): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].ts <= candles[i - 1].ts || candles[i].ts % MINUTE !== 0) throw new Error("Unsorted/unaligned candle archive");
    for (let ts = candles[i - 1].endTs; ts < candles[i].ts; ts += MINUTE) {
      gaps.push(ts);
      if (gaps.length > maxGaps) throw new Error(`More than ${maxGaps} gaps; review scope before downloading`);
    }
  }
  return gaps;
}
function same(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-7 + 1e-10 * Math.max(Math.abs(a), Math.abs(b));
}
function parseResponse(proof: CandleResponse, symbol: string, interval: "1" | "5", start: number, end: number): Candle[] {
  if (proof.url !== candleRequestUrl(symbol, interval, start, end) || sha256(proof.body) !== proof.sha256) throw new Error("Repair evidence URL/hash mismatch");
  if (!Number.isSafeInteger(proof.requestedAt) || !Number.isSafeInteger(proof.receivedAt) || proof.requestedAt > proof.receivedAt || proof.receivedAt <= end) throw new Error("Invalid repair retrieval timestamps");
  const response = JSON.parse(proof.body);
  if (response.retCode !== 0 || response.result?.symbol !== symbol || response.result?.category !== "linear" || !Array.isArray(response.result.list)) throw new Error("Invalid candle exchange response");
  const span = Number(interval) * MINUTE, seen = new Set<number>();
  const rows: Candle[] = response.result.list.map((row: unknown) => {
    if (!Array.isArray(row) || row.length !== 7 || row.some(x => !["number", "string"].includes(typeof x) || String(x).trim() === "")) throw new Error("Invalid exchange candle row");
    const [ts, open, high, low, close, volume, turnover] = row.map(Number);
    if (![ts, open, high, low, close, volume, turnover].every(Number.isFinite) || !Number.isSafeInteger(ts) || ts % span !== 0 || ts < start || ts > end || ts + span > proof.receivedAt ||
      Math.min(open, high, low, close) <= 0 || low > Math.min(open, close) || high < Math.max(open, close) || volume < 0 || turnover < 0 || seen.has(ts)) throw new Error("Invalid, duplicate or out-of-window repair candle");
    seen.add(ts); return { ts, endTs: ts + span, open, high, low, close, volume, turnover };
  });
  return rows.sort((a, b) => a.ts - b.ts);
}

/** Revalidate exchange witnesses on every load, including known local neighbours. */
export function validateCandleRepair(bundle: CandleRepairBundle, base: Candle[], symbol: string, cutoff: number) {
  if (bundle.version !== 1 || bundle.purpose !== REPAIR_PURPOSE || bundle.symbol !== symbol || bundle.category !== "linear" || bundle.intervalMs !== MINUTE ||
    !Array.isArray(bundle.evidence) || bundle.evidence.length === 0 || bundle.evidence.length > 20 || !Number.isSafeInteger(bundle.cutoff) || !Number.isSafeInteger(bundle.retrievedAt)) throw new Error("Wrong/invalid candle repair identity");
  const expectedInputs = [`data/${symbol}_1_full.json`, `data/${symbol}_1m.jsonl`];
  if (!Array.isArray(bundle.originalInputs) || bundle.originalInputs.length !== 2 || expectedInputs.some(file => !bundle.originalInputs.some(x => x.file === file && Number.isSafeInteger(x.bytes) && x.bytes > 0 && /^[a-f0-9]{64}$/.test(x.sha256)))) throw new Error("Missing/invalid original archive fingerprints");
  const local = new Map(base.map(c => [c.ts, c])), seen = new Set<number>(), inserts: Candle[] = [];
  let neighboursChecked = 0, native5mChecks = 0;
  for (const e of bundle.evidence) {
    const ts = e.missingTs, start = Math.floor(ts / (5 * MINUTE)) * 5 * MINUTE;
    if (!Number.isSafeInteger(ts) || ts % MINUTE !== 0 || ts + MINUTE > bundle.cutoff || seen.has(ts)) throw new Error("Invalid/duplicate repair target");
    seen.add(ts);
    const minutes = parseResponse(e.minute, symbol, "1", start - MINUTE, start + 6 * MINUTE - 1);
    const fives = parseResponse(e.fiveMinute, symbol, "5", start, start + 5 * MINUTE - 1);
    if (Math.max(e.minute.receivedAt, e.fiveMinute.receivedAt) > bundle.retrievedAt) throw new Error("Repair publication precedes retrieval");
    const target = minutes.find(c => c.ts === ts), block = minutes.filter(c => c.ts >= start && c.ts < start + 5 * MINUTE), native = fives.find(c => c.ts === start);
    if (!target || !native || block.length !== 5 || block.some((c, i) => c.ts !== start + i * MINUTE)) throw new Error("Missing exact target or complete five-minute witness");
    const aggregate = { open: block[0].open, high: Math.max(...block.map(c => c.high)), low: Math.min(...block.map(c => c.low)), close: block[4].close,
      volume: block.reduce((sum, c) => sum + c.volume, 0), turnover: block.reduce((sum, c) => sum + c.turnover, 0) };
    if (FIELDS.some(k => !same(aggregate[k], native[k]))) throw new Error("Native five-minute aggregate mismatch");
    native5mChecks++;
    for (const c of minutes) {
      const existing = local.get(c.ts);
      if (!existing) continue;
      if (FIELDS.some(k => !same(c[k], existing[k]))) throw new Error(`Archive neighbour mismatch at ${c.ts}`);
      neighboursChecked++;
    }
    // This is corrected exchange history, NOT a backdated receipt. A future
    // candle must still not enter the prefix requested by the research caller.
    if (target.endTs > cutoff) continue;
    // The full recovery snapshot must have known candles on both sides. A
    // shorter requested prefix can end in the missing minute itself, however:
    // its right neighbour is deliberately excluded until that neighbour closes.
    // The verified bundle still pins the original full snapshot and cutoff.
    if (!base.length || ts <= base[0].ts || (cutoff >= bundle.cutoff && ts >= base[base.length - 1].ts)) throw new Error("Repair target outside the archive's internal gaps");
    if (local.has(ts)) throw new Error(`Refusing to overwrite an existing candle at ${ts}`);
    inserts.push(target);
  }
  inserts.sort((a, b) => a.ts - b.ts);
  return { inserts, neighboursChecked, native5mChecks };
}

export function applyCandleRepair(base: Candle[], bundle: CandleRepairBundle, symbol: string, cutoff: number): Candle[] {
  const { inserts } = validateCandleRepair(bundle, base, symbol, cutoff);
  return [...base, ...inserts].sort((a, b) => a.ts - b.ts);
}
export function readCandleRepair(file: string): CandleRepairBundle {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
