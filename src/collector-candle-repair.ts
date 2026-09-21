import fs from "fs";
import path from "path";
import type { Candle } from "./fetch-candles";

const MINUTE = 60_000;
const WINDOW_MS = 48 * 60 * MINUTE;
const TAIL_BYTES = 4 * 1024 * 1024;
type Interval = "1" | "5";
export interface CandleRepairRow extends Candle {
  version: 1; venue: "bybit"; symbol: string; interval: Interval;
  source: "rest_gap_repair"; requestedAt: number; receivedAt: number;
  writtenAt: number; availableAt: number;
}
export interface CandleRepairHealth {
  symbol: string; interval: Interval; lastAttemptAt: number | null;
  lastSuccessAt: number | null; missingBefore: number | null; inserted: number;
  remainingMissing: number | null; error: string | null;
  windowStart: number | null; latestExpected: number | null;
}

function candle(row: any, span: number): Candle | null {
  if (!row || typeof row !== "object") return null;
  const values = [row.timestamp ?? row.ts, row.open ?? row.o, row.high ?? row.h,
    row.low ?? row.l, row.close ?? row.c, row.volume ?? row.v, row.turnover ?? row.t];
  if (values.some(v => v === null || v === undefined || String(v).trim() === "")) return null;
  const [timestamp, open, high, low, close, volume, turnover] = values.map(Number);
  if (![timestamp, open, high, low, close, volume, turnover].every(Number.isFinite)
    || !Number.isSafeInteger(timestamp) || timestamp % span !== 0 || timestamp < 0
    || Math.min(open, high, low, close) <= 0 || low > Math.min(open, close)
    || high < Math.max(open, close) || volume < 0 || turnover < 0) return null;
  // Old collector five-minute buckets can explicitly contain missing minutes.
  if (span === 5 * MINUTE && row.n1m !== undefined && row.n1m !== 5) return null;
  return { timestamp, open, high, low, close, volume, turnover };
}

/** Repaired price history is opt-in. Never silently backdate it to candle close. */
export function availableCandleRepairs(rows: unknown[], symbol: string, interval: Interval, asOf: number): CandleRepairRow[] {
  if (!Number.isSafeInteger(asOf) || asOf < 0) return [];
  const span = Number(interval) * MINUTE;
  return rows.filter((r: any): r is CandleRepairRow => {
    if (!r || r.version !== 1 || r.source !== "rest_gap_repair" || r.venue !== "bybit"
      || r.symbol !== symbol || r.interval !== interval || !Number.isSafeInteger(r.timestamp) || !candle(r, span)) return false;
    const clocks = [r.requestedAt, r.receivedAt, r.writtenAt, r.availableAt];
    return clocks.every(Number.isSafeInteger) && r.timestamp + span + 10_000 <= r.requestedAt
      && r.requestedAt <= r.receivedAt && r.receivedAt <= r.writtenAt
      && r.writtenAt <= r.availableAt && r.availableAt <= asOf;
  });
}

/** Bounded tail scan; malformed/unfinished rows are not evidence. No file mutation. */
export async function readCandleTail(file: string, since: number, span: number, maxBytes = TAIL_BYTES): Promise<any[]> {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024 * 1024) throw new Error("invalid candle tail bound");
  let handle: fs.promises.FileHandle;
  try { handle = await fs.promises.open(file, "r"); }
  catch (e: any) { if (e.code === "ENOENT") return []; throw e; }
  try {
    const stat = await handle.stat(), start = Math.max(0, stat.size - maxBytes);
    const bytes = Buffer.alloc(stat.size - start);
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, start + offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    const lines = bytes.subarray(0, offset).toString("utf8").split("\n");
    if (start > 0) lines.shift();
    // An unterminated final record is not a completed journal record.
    if (offset > 0 && bytes[offset - 1] !== 10) lines.pop();
    const rows: any[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try { const row = JSON.parse(line), c = candle(row, span); if (c && c.timestamp >= since) rows.push(row); }
      catch { /* preserve raw bytes for investigation; skip as evidence */ }
    }
    return rows;
  } finally { await handle.close(); }
}

export function parseRepairResponse(response: any, symbol: string, interval: Interval, start: number, end: number, requestedAt: number): Candle[] {
  if (response?.retCode !== 0 || response?.result?.symbol !== symbol || response?.result?.category !== "linear"
    || !Array.isArray(response.result.list) || response.result.list.length > 1000) throw new Error("invalid repair response identity/status");
  const span = Number(interval) * MINUTE, seen = new Set<number>();
  const rows = response.result.list.map((r: any) => {
    if (!Array.isArray(r) || r.length !== 7) throw new Error("invalid repair candle columns");
    const c = candle({ ts: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5], t: r[6] }, span);
    if (!c || c.timestamp < start || c.timestamp > end || c.timestamp + span + 10_000 > requestedAt
      || seen.has(c.timestamp)) throw new Error("invalid/duplicate/out-of-window repair candle");
    seen.add(c.timestamp); return c;
  });
  return rows.sort((a: Candle, b: Candle) => a.timestamp - b.timestamp);
}

function appendRepair(file: string, rows: CandleRepairRow[]): void {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "a+");
  try {
    const size = fs.fstatSync(fd).size, last = Buffer.alloc(1);
    if (size > 0) {
      fs.readSync(fd, last, 0, 1, size - 1);
      if (last[0] !== 10) fs.writeSync(fd, "\n"); // separate a torn tail; never overwrite it
    }
    const bytes = Buffer.from(rows.map(row => JSON.stringify(row) + "\n").join(""));
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw new Error("repair journal short write");
      offset += written;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

export class CollectorCandleRepair {
  private busy = false;
  private cursor = 0;
  private readonly pageBefore = new Map<string, number>();
  private readonly streams: CandleRepairHealth[];
  constructor(private readonly dataDir: string, symbols: string[],
    private readonly fetch: (symbol: string, interval: Interval, start: number, end: number) => Promise<unknown>,
    private readonly clock: () => number = Date.now) {
    if (!symbols.length || symbols.some(s => !/^[A-Z0-9]{2,30}$/.test(s))) throw new Error("invalid repair symbols");
    this.streams = [...new Set(symbols)].flatMap(symbol => (["1", "5"] as Interval[]).map(interval => ({
      symbol, interval, lastAttemptAt: null, lastSuccessAt: null, missingBefore: null,
      inserted: 0, remainingMissing: null, error: null, windowStart: null, latestExpected: null,
    })));
  }
  health() { return { version: 1, writtenAt: this.clock(), venue: "bybit", busy: this.busy,
    windowMs: WINDOW_MS, tailBytes: TAIL_BYTES, repairOnly: true, streams: this.streams.map(s => ({ ...s })) }; }

  async poll(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    let stream: CandleRepairHealth | undefined;
    try {
      const now = this.clock();
      stream = this.streams[this.cursor++ % this.streams.length];
      if (stream.lastAttemptAt !== null && now - stream.lastAttemptAt < 30_000) return;
      stream.lastAttemptAt = now; stream.inserted = 0; stream.error = null;
      stream.missingBefore = null; stream.remainingMissing = null;
      const span = Number(stream.interval) * MINUTE;
      const latest = Math.floor((now - 10_000) / span) * span - span;
      const since = latest - WINDOW_MS + span;
      stream.windowStart = since; stream.latestExpected = latest;
      const file = path.join(this.dataDir, `${stream.symbol}_${stream.interval}m.jsonl`);
      const repairsFile = path.join(this.dataDir, "candle-repairs", `${stream.symbol}_${stream.interval}m.jsonl`);
      const [live, repairs] = await Promise.all([readCandleTail(file, since, span), readCandleTail(repairsFile, since, span)]);
      const known = new Set([...live, ...availableCandleRepairs(repairs, stream.symbol, stream.interval, now)]
        .map(row => Number(row.timestamp ?? row.ts)));
      const missing: number[] = [];
      for (let ts = since; ts <= latest; ts += span) if (!known.has(ts)) missing.push(ts);
      stream.missingBefore = missing.length; stream.remainingMissing = missing.length;
      if (missing.length) {
        const key = `${stream.symbol}:${stream.interval}`;
        const before = this.pageBefore.get(key) ?? latest;
        // A venue-unavailable recent candle must not starve older gaps forever.
        const end = missing.filter(ts => ts <= before).at(-1) ?? missing[missing.length - 1];
        const start = Math.max(since, end - 999 * span);
        this.pageBefore.set(key, start - span);
        const requestedAt = this.clock();
        const response = await this.fetch(stream.symbol, stream.interval, start, end);
        const receivedAt = this.clock();
        const rows = parseRepairResponse(response, stream.symbol, stream.interval, start, end, requestedAt);
        // A websocket fill of the gap during the REST await takes precedence.
        const concurrentLive = await readCandleTail(file, since, span);
        for (const row of concurrentLive) known.add(Number(row.timestamp ?? row.ts));
        const pending: CandleRepairRow[] = [];
        for (const c of rows) {
          if (known.has(c.timestamp)) continue;
          const writtenAt = this.clock();
          const row: CandleRepairRow = { ...c, version: 1, venue: "bybit", symbol: stream.symbol,
            interval: stream.interval, source: "rest_gap_repair", requestedAt, receivedAt, writtenAt, availableAt: writtenAt };
          if (!availableCandleRepairs([row], stream.symbol, stream.interval, writtenAt).length) throw new Error("repair clock sequence invalid");
          pending.push(row);
        }
        appendRepair(repairsFile, pending);
        for (const row of pending) known.add(row.timestamp);
        stream.inserted = pending.length;
        stream.remainingMissing = missing.filter(ts => !known.has(ts)).length;
        if (stream.remainingMissing) stream.error = "gaps remain: bounded page or exchange candles unavailable";
      }
      stream.lastSuccessAt = this.clock();
    } catch (e: any) { if (stream) stream.error = e?.message ?? String(e); }
    finally { this.busy = false; }
  }
}
