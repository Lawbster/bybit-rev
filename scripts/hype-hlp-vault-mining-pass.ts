/**
 * HLP vault stream mining pass (research only, writes to backtests/ only).
 *
 * Question: do HLP vault features (APR, free-capital level/flows) carry
 * forward-return information for HYPE beyond the existing HL taker/book pulse?
 *
 * Grid: the strict 15m decision grid from the 2026-08-10 short study
 * (backtests/hype/hl-short-study-2026-08-10/decision-features.csv), joined with
 * vault rows using collector timestamps strictly before each decision T.
 * Forward returns computed from Bybit 1m closes strictly after T.
 *
 * Usage: npx ts-node scripts/hype-hlp-vault-mining-pass.ts
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ROOT = process.cwd();
const CSV = path.join(ROOT, "backtests", "hype", "hl-short-study-2026-08-10", "decision-features.csv");
const OUT = path.join(ROOT, "backtests", "hype", "hlp-vault-mining-2026-08-12");

interface VaultRow { ts: number; apr: number; md: number; }
interface Decision {
  ts: number;
  price: number;
  pulseHealthy: boolean;
  red15: boolean;
  breakPrev15Low: boolean;
  ret15: number;
  hlTaker15: number;
  hlOb5: number;
  hlObDelta: number;
  downRegime: boolean;
}

function loadCsv(): Decision[] {
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`missing column ${name}`);
    return index;
  };
  const c = {
    ts: col("ts"), price: col("price"), pulseHealthy: col("pulseHealthy"), red15: col("red15"),
    breakPrev15Low: col("breakPrev15Low"), ret15: col("ret15"), hlTaker15: col("hlTaker15"),
    hlOb5: col("hlOb5"), hlObDelta: col("hlObDelta"), downRegime: col("downRegime"),
  };
  return lines.slice(1).map(line => {
    const parts = line.split(",");
    return {
      ts: Date.parse(parts[c.ts]),
      price: Number(parts[c.price]),
      pulseHealthy: parts[c.pulseHealthy] === "true",
      red15: parts[c.red15] === "true",
      breakPrev15Low: parts[c.breakPrev15Low] === "true",
      ret15: Number(parts[c.ret15]),
      hlTaker15: Number(parts[c.hlTaker15]),
      hlOb5: Number(parts[c.hlOb5]),
      hlObDelta: Number(parts[c.hlObDelta]),
      downRegime: parts[c.downRegime] === "true",
    };
  });
}

async function loadVault(): Promise<VaultRow[]> {
  const rows: VaultRow[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(ROOT, "data", "HYPE_hlp_vault.jsonl")), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const ts = Number(row.timestamp ?? row.ts);
      const apr = Number(row.apr);
      const md = Number(row.maxDistributable);
      if (Number.isFinite(ts) && Number.isFinite(apr) && Number.isFinite(md)) rows.push({ ts, apr, md });
    } catch { /* skip malformed */ }
  }
  rows.sort((a, b) => a.ts - b.ts);
  return rows;
}

interface Candle { ts: number; open: number; high: number; low: number; close: number; }

async function loadCandles(): Promise<{ byTs: Map<number, Candle>; list: Candle[] }> {
  const byTs = new Map<number, Candle>();
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(ROOT, "data", "HYPEUSDT_1m.jsonl")), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const ts = Number(row.ts ?? row.timestamp);
      const candle = { ts, open: Number(row.o ?? row.open), high: Number(row.h ?? row.high), low: Number(row.l ?? row.low), close: Number(row.c ?? row.close) };
      if ([ts, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) byTs.set(ts, candle);
    } catch { /* skip */ }
  }
  const list = [...byTs.values()].sort((a, b) => a.ts - b.ts);
  return { byTs, list };
}

function latestBefore(rows: VaultRow[], ts: number, maxAgeMs: number): VaultRow | null {
  let lo = 0, hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].ts < ts) lo = mid + 1;
    else hi = mid;
  }
  const row = rows[lo - 1];
  if (!row || ts - row.ts > maxAgeMs) return null;
  return row;
}

function mean(values: number[]): number { return values.length ? values.reduce((s, v) => s + v, 0) / values.length : NaN; }
function stderr(values: number[]): number {
  if (values.length < 2) return NaN;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}
function quantileEdges(values: number[], buckets: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const edges: number[] = [];
  for (let i = 1; i < buckets; i++) edges.push(sorted[Math.floor((i * sorted.length) / buckets)]);
  return edges;
}
function bucketOf(value: number, edges: number[]): number {
  let bucket = 0;
  while (bucket < edges.length && value >= edges[bucket]) bucket++;
  return bucket;
}

function ensureDir(dir: string): void { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const header = Object.keys(rows[0]);
  fs.writeFileSync(filePath, [header.join(","), ...rows.map(row => header.map(key => String(row[key] ?? "")).join(","))].join("\n") + "\n");
}

async function main(): Promise<void> {
  ensureDir(OUT);
  const decisions = loadCsv();
  const vault = await loadVault();
  const { byTs, list } = await loadCandles();
  console.log(`decisions=${decisions.length} vaultRows=${vault.length} candles=${list.length}`);

  // Per-decision features. All vault lookups strictly prior to T; the 5m poll
  // cadence means "now" is typically 0-5 minutes old. Change features compare
  // against the latest row before T-h. 30m staleness bound fails the row out.
  type Enriched = Decision & {
    apr: number; aprChg4h: number; aprChg24h: number;
    mdChgPct1h: number; mdChgPct4h: number; mdChgPct24h: number;
    aprZ7d: number; mdChg4hZ7d: number;
    fwd1h: number; fwd4h: number; fwd12h: number;
  };
  const enriched: Enriched[] = [];
  // Rolling 7d windows for causal z-scores, sampled from prior decisions only.
  const aprHistory: Array<{ ts: number; value: number }> = [];
  const mdChgHistory: Array<{ ts: number; value: number }> = [];
  const zOf = (history: Array<{ ts: number; value: number }>, ts: number, value: number): number => {
    while (history.length && history[0].ts < ts - 7 * 24 * HOUR) history.shift();
    if (history.length < 96) return NaN;
    const values = history.map(row => row.value);
    const m = mean(values);
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
    return sd > 0 ? (value - m) / sd : NaN;
  };

  for (const decision of decisions) {
    const T = decision.ts;
    const now = latestBefore(vault, T, 30 * MINUTE);
    const ago1h = latestBefore(vault, T - HOUR, 30 * MINUTE);
    const ago4h = latestBefore(vault, T - 4 * HOUR, 30 * MINUTE);
    const ago24h = latestBefore(vault, T - 24 * HOUR, 30 * MINUTE);
    const priceAt = (ts: number) => byTs.get(ts - MINUTE)?.close ?? NaN;
    const p0 = decision.price;
    const fwd = (h: number) => {
      const p = priceAt(T + h);
      return Number.isFinite(p) && p0 > 0 ? ((p - p0) / p0) * 100 : NaN;
    };
    const apr = now ? now.apr : NaN;
    const aprChg4h = now && ago4h ? now.apr - ago4h.apr : NaN;
    const aprChg24h = now && ago24h ? now.apr - ago24h.apr : NaN;
    const mdChgPct1h = now && ago1h && ago1h.md > 0 ? ((now.md - ago1h.md) / ago1h.md) * 100 : NaN;
    const mdChgPct4h = now && ago4h && ago4h.md > 0 ? ((now.md - ago4h.md) / ago4h.md) * 100 : NaN;
    const mdChgPct24h = now && ago24h && ago24h.md > 0 ? ((now.md - ago24h.md) / ago24h.md) * 100 : NaN;
    const aprZ7d = Number.isFinite(apr) ? zOf(aprHistory, T, apr) : NaN;
    const mdChg4hZ7d = Number.isFinite(mdChgPct4h) ? zOf(mdChgHistory, T, mdChgPct4h) : NaN;
    if (Number.isFinite(apr)) aprHistory.push({ ts: T, value: apr });
    if (Number.isFinite(mdChgPct4h)) mdChgHistory.push({ ts: T, value: mdChgPct4h });
    enriched.push({ ...decision, apr, aprChg4h, aprChg24h, mdChgPct1h, mdChgPct4h, mdChgPct24h, aprZ7d, mdChg4hZ7d, fwd1h: fwd(HOUR), fwd4h: fwd(4 * HOUR), fwd12h: fwd(12 * HOUR) });
  }

  const features = ["apr", "aprChg4h", "aprChg24h", "mdChgPct1h", "mdChgPct4h", "mdChgPct24h", "aprZ7d", "mdChg4hZ7d"] as const;
  const horizons = ["fwd1h", "fwd4h", "fwd12h"] as const;
  const midpoint = enriched[Math.floor(enriched.length / 2)].ts;

  // 1) Quintile conditional forward returns (full-window edges, descriptive).
  const quintileRows: Record<string, unknown>[] = [];
  for (const feature of features) {
    const usable = enriched.filter(row => Number.isFinite(row[feature]) && Number.isFinite(row.fwd4h));
    if (usable.length < 500) continue;
    const edges = quantileEdges(usable.map(row => row[feature]), 5);
    for (let q = 0; q < 5; q++) {
      const cell = usable.filter(row => bucketOf(row[feature], edges) === q);
      const record: Record<string, unknown> = { feature, quintile: q + 1, n: cell.length, featureMean: mean(cell.map(row => row[feature])).toFixed(6) };
      for (const horizon of horizons) {
        const values = cell.map(row => row[horizon]).filter(Number.isFinite);
        record[`${horizon}Mean`] = mean(values).toFixed(4);
        record[`${horizon}Se`] = stderr(values).toFixed(4);
      }
      const firstHalf = cell.filter(row => row.ts < midpoint).map(row => row.fwd4h).filter(Number.isFinite);
      const secondHalf = cell.filter(row => row.ts >= midpoint).map(row => row.fwd4h).filter(Number.isFinite);
      record.fwd4hFirstHalf = mean(firstHalf).toFixed(4);
      record.fwd4hSecondHalf = mean(secondHalf).toFixed(4);
      quintileRows.push(record);
    }
  }
  writeCsv(path.join(OUT, "quintiles.csv"), quintileRows);

  // 2) Orthogonality double-sort: within HL taker terciles, vault-feature terciles.
  const doubleRows: Record<string, unknown>[] = [];
  for (const feature of ["aprChg24h", "mdChgPct4h", "mdChgPct24h", "aprZ7d", "mdChg4hZ7d"] as const) {
    const usable = enriched.filter(row => Number.isFinite(row[feature]) && Number.isFinite(row.fwd4h) && Number.isFinite(row.hlTaker15));
    if (usable.length < 500) continue;
    const takerEdges = quantileEdges(usable.map(row => row.hlTaker15), 3);
    const featureEdges = quantileEdges(usable.map(row => row[feature]), 3);
    for (let takerBucket = 0; takerBucket < 3; takerBucket++) {
      for (let featureBucket = 0; featureBucket < 3; featureBucket++) {
        const cell = usable.filter(row => bucketOf(row.hlTaker15, takerEdges) === takerBucket && bucketOf(row[feature], featureEdges) === featureBucket);
        const values = cell.map(row => row.fwd4h).filter(Number.isFinite);
        doubleRows.push({
          feature, takerTercile: takerBucket + 1, featureTercile: featureBucket + 1,
          n: cell.length, fwd4hMean: mean(values).toFixed(4), fwd4hSe: stderr(values).toFixed(4),
        });
      }
    }
  }
  writeCsv(path.join(OUT, "double-sort-taker.csv"), doubleRows);

  // 3) Frozen break-signal trades conditioned on vault state.
  //    Reconstructs raw hl_bid_pull_break fires from the grid, applies the 60m
  //    cooldown and serial ownership, simulates TP1.95/SL4/12h stop-first.
  const fires = enriched.filter(row =>
    row.pulseHealthy && row.red15 && row.breakPrev15Low && row.ret15 <= -0.20
    && Number.isFinite(row.hlTaker15) && row.hlTaker15 < 0.90
    && Number.isFinite(row.hlOb5) && row.hlOb5 < -0.05
    && Number.isFinite(row.hlObDelta) && row.hlObDelta < -0.15);
  const trades: Array<Enriched & { outcome: string; pnlPct: number; holdMin: number }> = [];
  let lastFire = -Infinity;
  let busyUntil = -Infinity;
  for (const fire of fires) {
    if (fire.ts - lastFire < HOUR) continue;
    lastFire = fire.ts;
    if (fire.ts < busyUntil) continue;
    const entryCandle = byTs.get(fire.ts);
    if (!entryCandle) continue;
    const entry = entryCandle.open;
    const tp = entry * (1 - 0.0195);
    const stop = entry * (1 + 0.04);
    let outcome = "open";
    let exitPrice = NaN;
    let exitTs = fire.ts;
    for (let ts = fire.ts; ts < fire.ts + 12 * HOUR; ts += MINUTE) {
      const candle = byTs.get(ts);
      if (!candle) continue;
      exitTs = ts + MINUTE;
      if (candle.high >= stop) { outcome = "stop"; exitPrice = stop; break; }
      if (candle.low <= tp) { outcome = "tp"; exitPrice = tp; break; }
      exitPrice = candle.close;
    }
    if (outcome === "open") {
      if (exitTs < fire.ts + 12 * HOUR) continue; // truncated tail: not a timeout
      outcome = "timeout";
    }
    busyUntil = exitTs;
    const pnlPct = ((entry - exitPrice) / entry) * 100 - 0.11;
    trades.push({ ...fire, outcome, pnlPct, holdMin: (exitTs - fire.ts) / MINUTE });
  }
  const tradeSplitRows: Record<string, unknown>[] = [];
  for (const feature of ["aprChg24h", "mdChgPct4h", "mdChgPct24h", "aprZ7d"] as const) {
    const usable = trades.filter(trade => Number.isFinite(trade[feature]));
    if (usable.length < 10) continue;
    const median = quantileEdges(usable.map(trade => trade[feature]), 2)[0];
    for (const side of ["below_median", "above_median"] as const) {
      const cell = usable.filter(trade => (side === "below_median" ? trade[feature] < median : trade[feature] >= median));
      tradeSplitRows.push({
        feature, side, median: median.toFixed(6), n: cell.length,
        meanPnlPct: mean(cell.map(trade => trade.pnlPct)).toFixed(4),
        tp: cell.filter(trade => trade.outcome === "tp").length,
        stop: cell.filter(trade => trade.outcome === "stop").length,
        timeout: cell.filter(trade => trade.outcome === "timeout").length,
      });
    }
  }
  writeCsv(path.join(OUT, "break-trades-vault-split.csv"), tradeSplitRows);
  writeCsv(path.join(OUT, "break-trades.csv"), trades.map(trade => ({
    ts: new Date(trade.ts).toISOString(), outcome: trade.outcome, pnlPct: trade.pnlPct.toFixed(4), holdMin: trade.holdMin,
    apr: trade.apr.toFixed(6), aprChg24h: trade.aprChg24h.toFixed(6), mdChgPct4h: trade.mdChgPct4h.toFixed(4), mdChgPct24h: trade.mdChgPct24h.toFixed(4),
  })));

  const unconditional = enriched.map(row => row.fwd4h).filter(Number.isFinite);
  console.log(JSON.stringify({
    window: { start: new Date(enriched[0].ts).toISOString(), end: new Date(enriched.at(-1)!.ts).toISOString(), midpoint: new Date(midpoint).toISOString() },
    decisions: enriched.length,
    vaultJoin: enriched.filter(row => Number.isFinite(row.apr)).length,
    unconditionalFwd4h: { mean: mean(unconditional).toFixed(4), se: stderr(unconditional).toFixed(4), n: unconditional.length },
    breakTrades: { n: trades.length, meanPnlPct: mean(trades.map(trade => trade.pnlPct)).toFixed(4), tp: trades.filter(t => t.outcome === "tp").length, stop: trades.filter(t => t.outcome === "stop").length, timeout: trades.filter(t => t.outcome === "timeout").length },
    outputs: OUT,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
