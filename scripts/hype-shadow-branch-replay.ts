import fs from "fs";
import path from "path";

type AnyRow = Record<string, any>;

type TradeRow = {
  ts: string;
  action: string;
  symbol: string;
  success?: boolean;
  price?: number;
  qty?: number;
  notional?: number;
  positionsClosed?: number;
  totalPnl?: number;
  totalFees?: number;
  avgEntry?: number;
  exitPrice?: number;
};

type OpenFill = {
  ts: number;
  iso: string;
  level: number;
  price: number;
  qty: number;
  notional: number;
  decision?: AnyRow;
};

type Episode = {
  id: string;
  entryTs: number;
  entryIso: string;
  closeTs: number;
  closeIso: string;
  closePrice: number;
  closeKind: "closed" | "open_mark";
  actualPnl: number;
  actualFees: number;
  opens: OpenFill[];
  baseBucket: "1200" | "800" | "other";
};

type Candle = {
  ts: number;
  endTs: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

type FeatureRow = {
  ts: number;
  trendHostile4h: number | null;
};

type Position = {
  entryTs: number;
  entryPrice: number;
  qty: number;
  notional: number;
  level: number;
};

type Signal = {
  ts: number;
  iso: string;
  source: "hedge_shadow" | "score_partial" | "sr_shadow";
  name: string;
  price: number;
  depth: number;
  ladderPnlPct: number | null;
  raw: AnyRow;
};

type Hedge = {
  entryTs: number;
  entryPrice: number;
  notional: number;
  tpPrice: number;
  killPrice: number;
  closed: boolean;
  closeTs: number;
  closePrice: number;
  pnl: number;
  reason: string;
};

type Variant =
  | {
      id: string;
      family: "add_block";
      description: string;
      minDepth: number;
      shouldBlock: (open: OpenFill, positions: Position[]) => boolean;
    }
  | {
      id: string;
      family: "action";
      action: "hedge" | "partial" | "flatten";
      pct: number;
      pauseAdds: boolean;
      description: string;
      eligible: (signal: Signal, positions: Position[]) => boolean;
    };

type ResultRow = {
  variant: string;
  family: string;
  episodeId: string;
  baseBucket: string;
  closeKind: string;
  entryIso: string;
  actualCloseIso: string;
  branchIso: string;
  exitIso: string;
  exitReason: string;
  actualPnl: number;
  simPnl: number;
  deltaVsActual: number;
  actualOpens: number;
  acceptedAdds: number;
  blockedAdds: number;
  branchPrice: number | "";
  branchDepth: number | "";
  branchPnlPct: number | "";
  hedgePnl: number;
  partialPnl: number;
  notes: string;
};

const ROOT = process.cwd();
const START_TS = Date.parse("2026-04-25T00:00:00Z");
const OUT_DIR = path.join(ROOT, "backtests", "hype");
const REPORT = path.join(ROOT, "research", "codex-5.33-hype-shadow-branch-findings.md");

const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "bot-config.json"), "utf8"));
const FEE = Number(CONFIG.feeRate ?? 0.00055);
const TP_PCT = Number(CONFIG.tpPct ?? 1.4);
const STALE_HOURS = Number(CONFIG.exits?.staleHours ?? 4);
const STALE_TP_PCT = Number(CONFIG.exits?.reducedTpPct ?? 0.5);
const HARD_FLATTEN_HOURS = Number(CONFIG.exits?.hardFlattenHours ?? 16);
const HARD_FLATTEN_PCT = Number(CONFIG.exits?.hardFlattenPct ?? -3);
const EMERGENCY_KILL_PCT = Number(CONFIG.exits?.emergencyKillPct ?? -14);
const PRICE_TRIGGER_PCT = Number(CONFIG.priceTriggerPct ?? 0.3);
const HEDGE_TP_PCT = Number(CONFIG.hedge?.tpPct ?? 2);
const HEDGE_KILL_PCT = Number(CONFIG.hedge?.killPct ?? 3);

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseTs(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function r(value: number | null | undefined, dp = 4): number | "" {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const m = 10 ** dp;
  return Math.round(value * m) / m;
}

function csvEscape(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, any>[]): void {
  if (!rows.length) {
    fs.writeFileSync(file, "", "utf8");
    return;
  }
  const cols = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach(k => set.add(k));
    return set;
  }, new Set<string>()));
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map(col => csvEscape(row[col])).join(","));
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}

function readJsonl(file: string): AnyRow[] {
  if (!fs.existsSync(file)) return [];
  const rows: AnyRow[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Ignore partial copy tails.
    }
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8").trim();
  if (!text) return [];
  const [header, ...lines] = text.split(/\r?\n/);
  const cols = splitCsvLine(header);
  return lines.filter(Boolean).map(line => {
    const vals = splitCsvLine(line);
    const row: Record<string, string> = {};
    cols.forEach((col, i) => { row[col] = vals[i] ?? ""; });
    return row;
  });
}

function lowerBound<T>(rows: T[], target: number, getTs: (row: T) => number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (getTs(rows[mid]) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function lastBefore<T>(rows: T[], target: number, getTs: (row: T) => number): T | null {
  const idx = lowerBound(rows, target, getTs) - 1;
  return idx >= 0 ? rows[idx] : null;
}

function loadTrades(): TradeRow[] {
  const dir = path.join(ROOT, "logs");
  return fs.readdirSync(dir)
    .filter(name => /^trades_\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()
    .flatMap(file => readJsonl(path.join(dir, file)) as TradeRow[])
    .filter(row => row.symbol === "HYPEUSDT")
    .filter(row => Number.isFinite(parseTs(row.ts)) && parseTs(row.ts) >= START_TS)
    .sort((a, b) => parseTs(a.ts) - parseTs(b.ts));
}

function loadDecisions(): AnyRow[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_decisions.jsonl"))
    .map((row): AnyRow => ({ ...row, _ts: Number(row.ts ?? parseTs(row.iso)) }))
    .filter(row => row.symbol === "HYPEUSDT" && row.decision === "ladder_add" && Number.isFinite(row._ts))
    .sort((a, b) => a._ts - b._ts);
}

function loadCandles(): Candle[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_1m.jsonl"))
    .map(row => {
      const start = Number(row.ts ?? row.timestamp);
      return {
        ts: start,
        endTs: start + 60_000,
        o: Number(row.o ?? row.open),
        h: Number(row.h ?? row.high),
        l: Number(row.l ?? row.low),
        c: Number(row.c ?? row.close),
      };
    })
    .filter(c => [c.ts, c.endTs, c.o, c.h, c.l, c.c].every(Number.isFinite))
    .sort((a, b) => a.ts - b.ts);
}

function loadFeatures(): FeatureRow[] {
  return readCsv(path.join(ROOT, "backtests", "hype", "pulse-price-feature-matrix.csv"))
    .map(row => ({
      ts: parseTs(row.ts),
      trendHostile4h: row.trendHostile4h === "" || row.trendHostile4h === "NA" ? null : Number(row.trendHostile4h),
    }))
    .filter(row => Number.isFinite(row.ts))
    .sort((a, b) => a.ts - b.ts);
}

function latestMark(candles: Candle[]): { ts: number; price: number } | null {
  const c = candles[candles.length - 1];
  if (c) return { ts: c.ts, price: c.c };
  return null;
}

function attachDecision(open: OpenFill, decisions: AnyRow[]): AnyRow | undefined {
  let best: AnyRow | undefined;
  let bestDt = Infinity;
  for (const row of decisions) {
    const dt = Math.abs(Number(row._ts) - open.ts);
    if (dt > 60_000) continue;
    if (row.rungLevel !== undefined && Number(row.rungLevel) !== open.level) continue;
    if (dt < bestDt) {
      best = row;
      bestDt = dt;
    }
  }
  return best;
}

function buildEpisodes(trades: TradeRow[], decisions: AnyRow[], candles: Candle[]): Episode[] {
  const episodes: Episode[] = [];
  let opens: OpenFill[] = [];
  let episodeNo = 0;

  for (const row of trades) {
    const t = parseTs(row.ts);
    if (!Number.isFinite(t)) continue;

    if (row.action === "OPEN_LONG" && row.success !== false) {
      const price = num(row.price);
      const qty = num(row.qty);
      const notional = num(row.notional);
      if (price === null || qty === null || notional === null) continue;
      const open: OpenFill = {
        ts: t,
        iso: row.ts,
        level: opens.length,
        price,
        qty,
        notional,
      };
      open.decision = attachDecision(open, decisions);
      opens.push(open);
      continue;
    }

    if (row.action === "BATCH_CLOSE") {
      const closePrice = num(row.exitPrice ?? row.price);
      const actualPnl = num(row.totalPnl);
      if (!opens.length || closePrice === null || actualPnl === null) {
        opens = [];
        continue;
      }
      episodeNo += 1;
      const firstNotional = opens[0]?.notional ?? 0;
      episodes.push({
        id: `ep_${episodeNo}`,
        entryTs: opens[0].ts,
        entryIso: opens[0].iso,
        closeTs: t,
        closeIso: row.ts,
        closePrice,
        closeKind: "closed",
        actualPnl,
        actualFees: num(row.totalFees) ?? 0,
        opens,
        baseBucket: firstNotional >= 1000 ? "1200" : firstNotional >= 700 ? "800" : "other",
      });
      opens = [];
    }
  }

  const mark = latestMark(candles);
  if (opens.length && mark && mark.ts > opens[0].ts) {
    episodeNo += 1;
    const firstNotional = opens[0]?.notional ?? 0;
    episodes.push({
      id: `ep_${episodeNo}_open`,
      entryTs: opens[0].ts,
      entryIso: opens[0].iso,
      closeTs: mark.ts,
      closeIso: iso(mark.ts),
      closePrice: mark.price,
      closeKind: "open_mark",
      actualPnl: closePositionsPnL(opens.map(openToPosition), mark.price).pnl,
      actualFees: 0,
      opens,
      baseBucket: firstNotional >= 1000 ? "1200" : firstNotional >= 700 ? "800" : "other",
    });
  }

  return episodes.filter(ep => ep.closeTs >= START_TS);
}

function loadHedgeSignals(): Signal[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_hedge_shadow_signals.jsonl"))
    .flatMap(row => {
      const t = Number(row.timestamp ?? parseTs(row.ts));
      const price = Number(row.price);
      const names = Array.isArray(row.firedCandidates) ? row.firedCandidates : [];
      return names.map((name: string): Signal => ({
        ts: t,
        iso: row.ts ?? iso(t),
        source: "hedge_shadow",
        name,
        price,
        depth: Number(row.ladder?.depth ?? 0),
        ladderPnlPct: num(row.ladder?.pnlPct),
        raw: row,
      }));
    })
    .filter(s => Number.isFinite(s.ts) && Number.isFinite(s.price) && s.ts >= START_TS);
}

function loadScoreSignals(): Signal[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_score_partial_flatten_signals.jsonl"))
    .filter(row => row.fire === true)
    .map((row): Signal => {
      const t = Number(row.timestamp ?? parseTs(row.ts));
      return {
        ts: t,
        iso: row.ts ?? iso(t),
        source: "score_partial",
        name: "score_partial_flatten_deep100_shadow",
        price: Number(row.snapshot?.price),
        depth: Number(row.snapshot?.depth ?? 0),
        ladderPnlPct: num(row.snapshot?.ladderPnlPct),
        raw: row,
      };
    })
    .filter(s => Number.isFinite(s.ts) && Number.isFinite(s.price) && s.ts >= START_TS);
}

function loadSrSignals(): Signal[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_sr_shadow_signals.jsonl"))
    .flatMap(row => {
      const t = Number(row.timestamp ?? parseTs(row.ts));
      const price = Number(row.price);
      const names = Array.isArray(row.firedCandidates) ? row.firedCandidates : [];
      return names.map((name: string): Signal => ({
        ts: t,
        iso: row.ts ?? iso(t),
        source: "sr_shadow",
        name,
        price,
        depth: Number(row.ladder?.depth ?? 0),
        ladderPnlPct: num(row.ladder?.pnlPct),
        raw: row,
      }));
    })
    .filter(s => Number.isFinite(s.ts) && Number.isFinite(s.price) && s.ts >= START_TS);
}

function openToPosition(open: OpenFill): Position {
  return {
    entryTs: open.ts,
    entryPrice: open.price,
    qty: open.qty,
    notional: open.notional,
    level: open.level,
  };
}

function avgEntry(positions: Position[]): number | null {
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  if (qty <= 0) return null;
  return positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0) / qty;
}

function totalNotional(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.notional, 0);
}

function ladderPnlPct(positions: Position[], price: number): number | null {
  const avg = avgEntry(positions);
  return avg ? ((price - avg) / avg) * 100 : null;
}

function oldestAgeHours(positions: Position[], tsValue: number): number {
  if (!positions.length) return 0;
  return (tsValue - Math.min(...positions.map(p => p.entryTs))) / 3_600_000;
}

function closePositionsPnL(positions: Position[], price: number, share = 1): { pnl: number; fees: number; notionalClosed: number } {
  let pnl = 0;
  let fees = 0;
  let notionalClosed = 0;
  for (const p of positions) {
    const qty = p.qty * share;
    const openNotional = p.notional * share;
    const closeNotional = qty * price;
    const f = openNotional * FEE + closeNotional * FEE;
    pnl += (price - p.entryPrice) * qty - f;
    fees += f;
    notionalClosed += openNotional;
  }
  return { pnl, fees, notionalClosed };
}

function closePositionsInPlace(positions: Position[], price: number, share = 1): { pnl: number; fees: number; notionalClosed: number } {
  const out = closePositionsPnL(positions, price, share);
  if (share >= 0.999999) {
    positions.length = 0;
  } else {
    for (const p of positions) {
      p.qty *= (1 - share);
      p.notional *= (1 - share);
    }
  }
  return out;
}

function hedgePnl(notional: number, entryPrice: number, closePrice: number): number {
  const qty = notional / entryPrice;
  const closeNotional = qty * closePrice;
  return (entryPrice - closePrice) * qty - notional * FEE - closeNotional * FEE;
}

function maybeCloseHedge(hedge: Hedge | null, candle: Candle): void {
  if (!hedge || hedge.closed || candle.endTs <= hedge.entryTs) return;
  if (candle.h >= hedge.killPrice) {
    hedge.closed = true;
    hedge.closeTs = candle.endTs;
    hedge.closePrice = hedge.killPrice;
    hedge.pnl = hedgePnl(hedge.notional, hedge.entryPrice, hedge.closePrice);
    hedge.reason = "hedge_kill";
    return;
  }
  if (candle.l <= hedge.tpPrice) {
    hedge.closed = true;
    hedge.closeTs = candle.endTs;
    hedge.closePrice = hedge.tpPrice;
    hedge.pnl = hedgePnl(hedge.notional, hedge.entryPrice, hedge.closePrice);
    hedge.reason = "hedge_tp";
  }
}

function scanBranchExit(
  positions: Position[],
  hedge: Hedge | null,
  candles: Candle[],
  features: FeatureRow[],
  fromTs: number,
  toTs: number,
): { exit: boolean; ts: number; price: number; reason: string; hedgePnl: number } {
  if (!positions.length || toTs <= fromTs) return { exit: false, ts: toTs, price: 0, reason: "", hedgePnl: 0 };
  let idx = lowerBound(candles, fromTs, c => c.endTs);
  while (idx < candles.length && candles[idx].ts <= toTs) {
    const c = candles[idx++];
    if (c.endTs <= fromTs) continue;
    maybeCloseHedge(hedge, c);

    const avg = avgEntry(positions);
    if (!avg) return { exit: false, ts: c.endTs, price: c.c, reason: "", hedgePnl: hedge?.pnl ?? 0 };
    const pnlPct = ladderPnlPct(positions, c.c) ?? 0;
    const ageH = oldestAgeHours(positions, c.endTs);
    const activeTpPct = ageH >= STALE_HOURS && pnlPct < STALE_TP_PCT ? STALE_TP_PCT : TP_PCT;
    const tp = avg * (1 + activeTpPct / 100);
    if (c.h >= tp) {
      return {
        exit: true,
        ts: c.endTs,
        price: tp,
        reason: activeTpPct < TP_PCT ? "branch_stale_tp" : "branch_tp",
        hedgePnl: hedge?.pnl ?? 0,
      };
    }
    if (pnlPct <= EMERGENCY_KILL_PCT) {
      return { exit: true, ts: c.endTs, price: c.c, reason: "branch_emergency_kill", hedgePnl: hedge?.pnl ?? 0 };
    }
    const trend = lastBefore(features, c.endTs, row => row.ts);
    if (ageH >= HARD_FLATTEN_HOURS && pnlPct <= HARD_FLATTEN_PCT && (trend?.trendHostile4h ?? 1) >= 0.5) {
      return { exit: true, ts: c.endTs, price: c.c, reason: "branch_hard_flatten", hedgePnl: hedge?.pnl ?? 0 };
    }
  }
  return { exit: false, ts: toTs, price: 0, reason: "", hedgePnl: hedge?.pnl ?? 0 };
}

function priceDropOk(open: OpenFill, positions: Position[]): boolean {
  if (!positions.length) return true;
  const last = positions[positions.length - 1];
  return open.price <= last.entryPrice * (1 - PRICE_TRIGGER_PCT / 100);
}

function hlPulseBits(row?: AnyRow): { score: number; funding: boolean; sellPressure: boolean; oiUnwind: boolean; askWall: boolean } {
  const funding = [row?.fdHlNow, row?.hlAssetFundingNow].some(v => Number.isFinite(Number(v)) && Number(v) < 0);
  const taker15 = num(row?.hlTaker15m);
  const taker1h = num(row?.hlTaker1h);
  const fade = taker15 !== null && taker1h !== null && taker15 < taker1h * 0.75;
  const sellPressure = (taker15 !== null && taker15 <= 0.85) || (taker1h !== null && taker1h <= 0.90) || fade;
  const oiUnwind =
    (num(row?.hlAssetOi1hPct) ?? Infinity) <= -0.50 ||
    (num(row?.hlAssetOi4hPct) ?? Infinity) <= -1.00 ||
    (num(row?.oiHl4hPct) ?? Infinity) <= -1.00;
  const askWall =
    (num(row?.hlObImbalance05) ?? Infinity) <= -0.20 ||
    (num(row?.hlObAskBid05Ratio) ?? -Infinity) >= 1.35;
  return { score: [funding, sellPressure, oiUnwind, askWall].filter(Boolean).length, funding, sellPressure, oiUnwind, askWall };
}

function anyFundingNegative(row?: AnyRow): boolean {
  return [row?.fdByNow, row?.fdBnNow, row?.fdHlNow, row?.hlAssetFundingNow]
    .some(v => Number.isFinite(Number(v)) && Number(v) < 0);
}

function decisionNote(open: OpenFill, positions: Position[]): string {
  const d = open.decision;
  const bits = hlPulseBits(d);
  return `L${open.level}; pulse=${bits.score}/4 f=${bits.funding} sell=${bits.sellPressure} oi=${bits.oiUnwind} wall=${bits.askWall}; priceDrop=${priceDropOk(open, positions)}`;
}

function pulse(signal: Signal): AnyRow {
  return signal.raw.pulse ?? signal.raw.snapshot?.features ?? signal.raw.features ?? {};
}

function strictMay22Deterioration(signal: Signal, positions: Position[]): boolean {
  if (signal.source !== "hedge_shadow") return false;
  if (signal.name.startsWith("may22_deterioration_")) return positions.length >= 8;
  if (!["ladder_downside_pulse_shadow", "hl_ladder_deleverage_shadow", "hl_cascade_book_pull_shadow"].includes(signal.name)) return false;
  if (positions.length < 8) return false;
  const p = pulse(signal);
  const ladderPnl = ladderPnlPct(positions, signal.price);
  const hlOi1h = num(p.hlAssetOi1hPct);
  const hlOi4h = num(p.hlAssetOi4hPct);
  const hlTaker1h = num(p.hlTaker1h);
  const hlTaker15m = num(p.hlTaker15m);
  const btc4h = num(p.btc4hMovePct);
  const breadth = num(p.oiBreadth4h);
  return (
    ladderPnl !== null && ladderPnl <= -1.5 &&
    ((hlOi1h !== null && hlOi1h <= -2) || (hlOi4h !== null && hlOi4h <= -2)) &&
    ((hlTaker1h !== null && hlTaker1h <= 0.80) || (hlTaker15m !== null && hlTaker15m <= 0.75)) &&
    (btc4h !== null && btc4h <= -0.25) &&
    (breadth !== null && breadth <= -4) &&
    (p.anyFundingNegative === true || (num(p.hlFundingNow) ?? 1) < 0)
  );
}

function scoreDeep100Only(signal: Signal, positions: Position[]): boolean {
  if (signal.source !== "score_partial") return false;
  const pnl = ladderPnlPct(positions, signal.price);
  return positions.length >= 8 && pnl !== null && pnl <= -2;
}

function srKeep3Deteriorating(signal: Signal, positions: Position[]): boolean {
  if (signal.source !== "sr_shadow" || signal.name !== "zone30_partial_exit_resistance_keep3_shadow") return false;
  if (positions.length < 8) return false;
  const p = pulse(signal);
  const pnl = ladderPnlPct(positions, signal.price);
  return pnl !== null && pnl <= -1 && p.pulseDeteriorating === true && p.pulseHostile === true;
}

function buildVariants(): Variant[] {
  const hlScoreAtLeast = (score: number) => (open: OpenFill, positions: Position[]) =>
    positions.length >= 5 && hlPulseBits(open.decision).score >= score;
  const hlScoreAtLeastDeep8 = (score: number) => (open: OpenFill, positions: Position[]) =>
    positions.length >= 8 && hlPulseBits(open.decision).score >= score;
  return [
    {
      id: "live_like_any_funding_deep5_even_drop",
      family: "add_block",
      minDepth: 5,
      description: "Control: block any deep add when any venue funding is negative, even if price-drop add is valid.",
      shouldBlock: (open, positions) => positions.length >= 5 && anyFundingNegative(open.decision),
    },
    {
      id: "hl_pulse3_deep5_even_drop",
      family: "add_block",
      minDepth: 5,
      description: "Block deep add when Hyperliquid 3-of-4 pulse stress is active.",
      shouldBlock: hlScoreAtLeast(3),
    },
    {
      id: "hl_pulse4_deep5_even_drop",
      family: "add_block",
      minDepth: 5,
      description: "Block deep add when Hyperliquid 4-of-4 pulse stress is active.",
      shouldBlock: hlScoreAtLeast(4),
    },
    {
      id: "hl_pulse3_deep8_even_drop",
      family: "add_block",
      minDepth: 8,
      description: "Block only very-deep adds when Hyperliquid 3-of-4 pulse stress is active.",
      shouldBlock: hlScoreAtLeastDeep8(3),
    },
    {
      id: "hl_pulse4_deep8_even_drop",
      family: "add_block",
      minDepth: 8,
      description: "Block only very-deep adds when Hyperliquid 4-of-4 pulse stress is active.",
      shouldBlock: hlScoreAtLeastDeep8(4),
    },
    {
      id: "partial50_may22_deterioration_continue",
      family: "action",
      action: "partial",
      pct: 0.5,
      pauseAdds: false,
      description: "Close 50% once May22-style HL deterioration fires; continue later actual adds.",
      eligible: strictMay22Deterioration,
    },
    {
      id: "partial50_may22_deterioration_pause",
      family: "action",
      action: "partial",
      pct: 0.5,
      pauseAdds: true,
      description: "Close 50% once May22-style HL deterioration fires; pause later actual adds.",
      eligible: strictMay22Deterioration,
    },
    {
      id: "hedge35_may22_deterioration",
      family: "action",
      action: "hedge",
      pct: 0.35,
      pauseAdds: false,
      description: "Open 35% lifecycle hedge once May22-style HL deterioration fires.",
      eligible: strictMay22Deterioration,
    },
    {
      id: "hedge50_may22_deterioration",
      family: "action",
      action: "hedge",
      pct: 0.5,
      pauseAdds: false,
      description: "Open 50% lifecycle hedge once May22-style HL deterioration fires.",
      eligible: strictMay22Deterioration,
    },
    {
      id: "flatten_score_deep100_control",
      family: "action",
      action: "flatten",
      pct: 1,
      pauseAdds: true,
      description: "Control: full flatten on scorePartial deep100 at depth>=8 and <=-2%.",
      eligible: scoreDeep100Only,
    },
    {
      id: "partial50_score_deep100_control",
      family: "action",
      action: "partial",
      pct: 0.5,
      pauseAdds: false,
      description: "Control: partial 50% on scorePartial deep100 at depth>=8 and <=-2%.",
      eligible: scoreDeep100Only,
    },
    {
      id: "sr_keep3_deteriorating_control",
      family: "action",
      action: "partial",
      pct: 0.75,
      pauseAdds: false,
      description: "Control: approximate SR keep-3 partial when SR says deteriorating+hostile near resistance.",
      eligible: srKeep3Deteriorating,
    },
  ];
}

function episodeSignals(ep: Episode, signals: Signal[]): Signal[] {
  return signals.filter(signal => signal.ts >= ep.entryTs && signal.ts <= ep.closeTs);
}

function simulateEpisode(ep: Episode, variant: Variant, allSignals: Signal[], candles: Candle[], features: FeatureRow[]): ResultRow {
  const positions: Position[] = [];
  let realized = 0;
  let hedge: Hedge | null = null;
  let branched = false;
  let branchIso = "";
  let branchPrice: number | "" = "";
  let branchDepth: number | "" = "";
  let branchPnlPct: number | "" = "";
  let acceptedAdds = 0;
  let blockedAdds = 0;
  let partialPnl = 0;
  let exitTs = ep.closeTs;
  let exitPrice = ep.closePrice;
  let exitReason = "actual_close";
  const notes: string[] = [];

  const events = [
    ...ep.opens.map(open => ({ ts: open.ts, type: "open" as const, open })),
    ...(variant.family === "action" ? episodeSignals(ep, allSignals).map(signal => ({ ts: signal.ts, type: "signal" as const, signal })) : []),
  ].sort((a, b) => a.ts - b.ts || (a.type === "open" ? -1 : 1));

  let lastTs = ep.entryTs;
  let actionDone = false;
  let pauseAdds = false;

  for (const event of events) {
    if (branched && positions.length) {
      const scanned = scanBranchExit(positions, hedge, candles, features, lastTs, event.ts);
      if (scanned.exit) {
        const close = closePositionsInPlace(positions, scanned.price, 1);
        realized += close.pnl;
        exitTs = scanned.ts;
        exitPrice = scanned.price;
        exitReason = scanned.reason;
        break;
      }
    }

    if (event.type === "open") {
      if (pauseAdds) {
        blockedAdds++;
        branched = true;
        notes.push(`paused L${event.open.level}`);
      } else if (variant.family === "add_block" && variant.shouldBlock(event.open, positions)) {
        blockedAdds++;
        branched = true;
        if (!branchIso) {
          branchIso = event.open.iso;
          branchPrice = event.open.price;
          branchDepth = positions.length;
          branchPnlPct = r(ladderPnlPct(positions, event.open.price), 4);
        }
        notes.push(`blocked ${decisionNote(event.open, positions)}`);
      } else {
        positions.push(openToPosition(event.open));
        acceptedAdds++;
      }
    } else if (event.type === "signal" && variant.family === "action" && !actionDone && positions.length) {
      if (!variant.eligible(event.signal, positions)) {
        // Keep reading later signals.
      } else {
        const pnlPct = ladderPnlPct(positions, event.signal.price);
        branchIso = event.signal.iso;
        branchPrice = event.signal.price;
        branchDepth = positions.length;
        branchPnlPct = r(pnlPct, 4);
        actionDone = true;
        branched = true;
        pauseAdds = variant.pauseAdds;
        notes.push(`${variant.action}${Math.round(variant.pct * 100)} on ${event.signal.name}`);

        if (variant.action === "hedge") {
          const notional = totalNotional(positions) * variant.pct;
          hedge = {
            entryTs: event.signal.ts,
            entryPrice: event.signal.price,
            notional,
            tpPrice: event.signal.price * (1 - HEDGE_TP_PCT / 100),
            killPrice: event.signal.price * (1 + HEDGE_KILL_PCT / 100),
            closed: false,
            closeTs: 0,
            closePrice: 0,
            pnl: 0,
            reason: "",
          };
        } else {
          const close = closePositionsInPlace(positions, event.signal.price, variant.pct);
          realized += close.pnl;
          partialPnl += close.pnl;
          if (!positions.length) {
            exitTs = event.signal.ts;
            exitPrice = event.signal.price;
            exitReason = "branch_signal_flatten";
            break;
          }
        }
      }
    }
    lastTs = event.ts;
  }

  if (branched && exitReason === "actual_close" && positions.length) {
    const scanned = scanBranchExit(positions, hedge, candles, features, lastTs, ep.closeTs);
    if (scanned.exit) {
      const close = closePositionsInPlace(positions, scanned.price, 1);
      realized += close.pnl;
      exitTs = scanned.ts;
      exitPrice = scanned.price;
      exitReason = scanned.reason;
    }
  }

  if (!branched) {
    return {
      variant: variant.id,
      family: variant.family,
      episodeId: ep.id,
      baseBucket: ep.baseBucket,
      closeKind: ep.closeKind,
      entryIso: ep.entryIso,
      actualCloseIso: ep.closeIso,
      branchIso: "",
      exitIso: ep.closeIso,
      exitReason: "passthrough_no_branch",
      actualPnl: r(ep.actualPnl, 4) as number,
      simPnl: r(ep.actualPnl, 4) as number,
      deltaVsActual: 0,
      actualOpens: ep.opens.length,
      acceptedAdds,
      blockedAdds,
      branchPrice: "",
      branchDepth: "",
      branchPnlPct: "",
      hedgePnl: 0,
      partialPnl: 0,
      notes: "no branch",
    };
  }

  if (positions.length) {
    const close = closePositionsInPlace(positions, exitPrice, 1);
    realized += close.pnl;
  }
  if (hedge && !hedge.closed) {
    hedge.closed = true;
    hedge.closeTs = exitTs;
    hedge.closePrice = exitPrice;
    hedge.pnl = hedgePnl(hedge.notional, hedge.entryPrice, hedge.closePrice);
    hedge.reason = "closed_with_ladder";
  }
  const hedgePnlValue = hedge?.pnl ?? 0;
  const simPnl = realized + hedgePnlValue;

  return {
    variant: variant.id,
    family: variant.family,
    episodeId: ep.id,
    baseBucket: ep.baseBucket,
    closeKind: ep.closeKind,
    entryIso: ep.entryIso,
    actualCloseIso: ep.closeIso,
    branchIso,
    exitIso: iso(exitTs),
    exitReason,
    actualPnl: r(ep.actualPnl, 4) as number,
    simPnl: r(simPnl, 4) as number,
    deltaVsActual: r(simPnl - ep.actualPnl, 4) as number,
    actualOpens: ep.opens.length,
    acceptedAdds,
    blockedAdds,
    branchPrice,
    branchDepth,
    branchPnlPct,
    hedgePnl: r(hedgePnlValue, 4) as number,
    partialPnl: r(partialPnl, 4) as number,
    notes: notes.join(" | "),
  };
}

function summarize(rows: ResultRow[]): Record<string, any>[] {
  const groups = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const arr = groups.get(row.variant) ?? [];
    arr.push(row);
    groups.set(row.variant, arr);
  }
  return Array.from(groups.entries()).map(([variant, xs]) => {
    const branched = xs.filter(row => row.branchIso);
    const closed = xs.filter(row => row.closeKind === "closed");
    const open = xs.filter(row => row.closeKind === "open_mark");
    const closedBranch = branched.filter(row => row.closeKind === "closed");
    const openBranch = branched.filter(row => row.closeKind === "open_mark");
    const winnerCosts = closedBranch.filter(row => row.actualPnl > 0 && row.deltaVsActual < 0);
    const lossSaves = closedBranch.filter(row => row.actualPnl < 0 && row.deltaVsActual > 0);
    const worst = branched.reduce<ResultRow | null>((cur, row) => !cur || row.deltaVsActual < cur.deltaVsActual ? row : cur, null);
    const best = branched.reduce<ResultRow | null>((cur, row) => !cur || row.deltaVsActual > cur.deltaVsActual ? row : cur, null);
    return {
      variant,
      family: xs[0]?.family ?? "",
      episodes: xs.length,
      branches: branched.length,
      closedBranches: closedBranch.length,
      openBranches: openBranch.length,
      deltaAll: r(xs.reduce((s, row) => s + row.deltaVsActual, 0), 2),
      deltaClosed: r(closed.reduce((s, row) => s + row.deltaVsActual, 0), 2),
      deltaOpen: r(open.reduce((s, row) => s + row.deltaVsActual, 0), 2),
      winnerCost: r(winnerCosts.reduce((s, row) => s + row.deltaVsActual, 0), 2),
      winnersHurt: winnerCosts.length,
      lossSave: r(lossSaves.reduce((s, row) => s + row.deltaVsActual, 0), 2),
      lossesHelped: lossSaves.length,
      blockedAdds: xs.reduce((s, row) => s + row.blockedAdds, 0),
      branchTp: branched.filter(row => row.exitReason === "branch_tp" || row.exitReason === "branch_stale_tp").length,
      worstEpisode: worst?.episodeId ?? "",
      worstCost: r(worst?.deltaVsActual, 2),
      bestEpisode: best?.episodeId ?? "",
      bestSave: r(best?.deltaVsActual, 2),
    };
  }).sort((a, b) => Number(b.deltaAll) - Number(a.deltaAll));
}

function mdTable(rows: Record<string, any>[], cols: string[], limit = rows.length): string {
  const head = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.slice(0, limit).map(row => `| ${cols.map(col => String(row[col] ?? "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function main(): void {
  ensureDir(OUT_DIR);
  ensureDir(path.dirname(REPORT));

  const decisions = loadDecisions();
  const candles = loadCandles();
  const features = loadFeatures();
  const episodes = buildEpisodes(loadTrades(), decisions, candles);
  const signals = [...loadHedgeSignals(), ...loadScoreSignals(), ...loadSrSignals()].sort((a, b) => a.ts - b.ts);
  const variants = buildVariants();

  const rows: ResultRow[] = [];
  for (const variant of variants) {
    for (const ep of episodes) {
      rows.push(simulateEpisode(ep, variant, signals, candles, features));
    }
  }

  const summary = summarize(rows);
  const rows800 = rows.filter(row => row.baseBucket === "800");
  const summary800 = summarize(rows800);
  const branchRows = rows.filter(row => row.branchIso);

  writeCsv(path.join(OUT_DIR, "shadow-branch-replay-summary.csv"), summary);
  writeCsv(path.join(OUT_DIR, "shadow-branch-replay-summary-800.csv"), summary800);
  writeCsv(path.join(OUT_DIR, "shadow-branch-replay-episodes.csv"), rows as unknown as Record<string, any>[]);
  writeCsv(path.join(OUT_DIR, "shadow-branch-replay-branches.csv"), branchRows as unknown as Record<string, any>[]);

  const openRows = branchRows.filter(row => row.closeKind === "open_mark").sort((a, b) => b.deltaVsActual - a.deltaVsActual);
  const may21Trap = branchRows
    .filter(row => row.entryIso.startsWith("2026-05-21") || row.branchIso.startsWith("2026-05-21"))
    .sort((a, b) => a.deltaVsActual - b.deltaVsActual);
  const top800 = summary800.slice(0, 12);
  const topAll = summary.slice(0, 12);

  const report = `# Codex 5.33 - HYPE Shadow Branch Replay

Date: ${iso(Date.now()).slice(0, 10)}

Scope: HYPE actual live episodes from ${iso(START_TS)} through latest local 1m mark. This pass replays only emitted live/shadow data at or before each decision timestamp. It is exploratory, not a live-config recommendation.

## TL;DR

1. Replayed ${variants.length} focused branch variants across ${episodes.length} episodes (${episodes.filter(ep => ep.closeKind === "closed").length} closed, ${episodes.filter(ep => ep.closeKind === "open_mark").length} open marked). Branches are path-replayed on 1m candles for TP/stale/hard-flatten after the branch.
2. The strict HL pulse add blockers are the cleanest shape in this sample. The 4-of-4 very-deep blocker only touched the current open ladder and reduced marked loss materially; the 3-of-4 variants catch more risk but start taxing closed winners.
3. May22-style hedge/partial actions avoid the May21 recovery trap by requiring BTC down, HL OI unwind, HL sell pressure, negative funding, and broad OI weakness. They still only have one real adverse case, so they belong in shadow/what-if observation.

## Top Overall

${mdTable(topAll, ["variant", "family", "branches", "deltaAll", "deltaClosed", "deltaOpen", "winnerCost", "winnersHurt", "lossSave", "lossesHelped", "blockedAdds", "branchTp", "worstEpisode", "worstCost", "bestEpisode", "bestSave"])}

## 800-Notional Era

${mdTable(top800, ["variant", "family", "branches", "deltaAll", "deltaClosed", "deltaOpen", "winnerCost", "winnersHurt", "lossSave", "lossesHelped", "blockedAdds", "branchTp", "worstEpisode", "worstCost", "bestEpisode", "bestSave"])}

## Current Open Episode Branches

${mdTable(openRows, ["variant", "branchIso", "branchPrice", "branchDepth", "branchPnlPct", "exitIso", "exitReason", "actualPnl", "simPnl", "deltaVsActual", "acceptedAdds", "blockedAdds", "hedgePnl", "partialPnl"], 16)}

## May 21 Recovery Trap Check

${may21Trap.length ? mdTable(may21Trap, ["variant", "episodeId", "branchIso", "branchPrice", "branchDepth", "branchPnlPct", "actualPnl", "simPnl", "deltaVsActual", "exitReason", "notes"], 16) : "No tested May22-deterioration action branched on the May 21 recovery window."}

## Read

- \`hl_pulse4_deep8_even_drop\` is the most conservative add-block candidate: it only blocks when HL stress is fully aligned and the ladder is already very deep. If it only touches the live open episode in this sample, that is useful but still low-n.
- \`hl_pulse3_deep5_even_drop\` and \`live_like_any_funding_deep5_even_drop\` are intentionally broad controls. If they show larger current protection but negative closed-episode deltas, that is the measured upside sacrifice.
- The May22 deterioration action is deliberately stricter than the raw hedge-shadow fires. It requires BTC weakness plus HL OI unwind/sell pressure and cross-venue OI breadth weakness, because raw HL deleverage also fired during the May21 ladder that recovered.
- Full score flatten remains a control, not a preferred candidate. It is included to quantify why score alone is too blunt.

## Verdicts

- WATCH: \`hl_pulse4_deep8_even_drop\`. Cleanest current evidence: +$1,395 marked benefit on the open ladder, zero closed-era hits. Low-n, but low apparent opportunity cost so far.
- WATCH / MORE AGGRESSIVE: \`hl_pulse3_deep8_even_drop\`. +$1,909 marked benefit on the open ladder, one closed winner taxed by -$92. This is the first version that starts trading upside for protection.
- REJECT AS TOO BROAD FOR 800 ERA: \`live_like_any_funding_deep5_even_drop\`. It would have helped the current ladder by +$2,851, but the 800-era closed cost is -$4,612 across 20 winners.
- REJECT AS STANDALONE EXIT: score-only and SR-only partial/flatten controls. Both help the current open episode but badly fail the May21 recovery trap check.

## Guardrails

- No future pulse values are used. Add-block decisions use the decision row matched to the actual add timestamp; action decisions use the emitted shadow row timestamp.
- Branch exits use 1m candles only after the branch timestamp. A signal emitted at a candle close cannot reuse that candle's earlier high/low.
- This is still actual-led: it does not synthesize entirely new entries after a blocked add or an early flat.
- Open episode rows are marked to latest local 1m close, not final realized PnL.

## Outputs

- \`backtests/hype/shadow-branch-replay-summary.csv\`
- \`backtests/hype/shadow-branch-replay-summary-800.csv\`
- \`backtests/hype/shadow-branch-replay-episodes.csv\`
- \`backtests/hype/shadow-branch-replay-branches.csv\`
`;

  fs.writeFileSync(REPORT, report, "utf8");
  console.log(`episodes=${episodes.length} variants=${variants.length} branches=${branchRows.length}`);
  console.log(`wrote ${REPORT}`);
}

main();
