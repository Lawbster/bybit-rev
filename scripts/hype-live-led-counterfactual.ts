import fs from "fs";
import path from "path";

type AnyRow = Record<string, any>;

type TradeRow = {
  ts: string;
  action: string;
  symbol: string;
  price?: number;
  qty?: number;
  notional?: number;
  positionsClosed?: number;
  totalPnl?: number;
  totalFees?: number;
  avgEntry?: number;
  exitPrice?: number;
};

type Candle = {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
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
  leftCensored: boolean;
  opens: OpenFill[];
  closeTs: number;
  closeIso: string;
  closePrice: number;
  positionsClosed: number;
  actualPnl: number;
  actualFees: number;
  actualAvgEntry: number | null;
  liveReason: string;
  prekill?: AnyRow;
};

type Position = {
  ep: number;
  et: number;
  qty: number;
  notional: number;
  level: number;
};

type Variant = {
  id: string;
  description: string;
  allowAdd: (open: OpenFill, accepted: Position[], ep: Episode) => boolean;
  afterAdd?: (ctx: SimContext, open: OpenFill) => void;
  onPrekill?: (ctx: SimContext, warning: AnyRow) => void;
};

type SimContext = {
  ep: Episode;
  variantId: string;
  positions: Position[];
  hedge: null | { ts: number; price: number; notional: number; qty: number; reason: string };
  partialDone: boolean;
  hedgeDone: boolean;
  realizedPnl: number;
  realizedFees: number;
  blockedAdds: number;
  acceptedAdds: number;
  notes: string[];
};

type SimResult = {
  episodeId: string;
  variant: string;
  mode: "actual_close" | "tp_path";
  entryIso: string;
  closeIso: string;
  liveReason: string;
  actualPnl: number;
  simPnl: number;
  deltaVsActual: number;
  actualOpens: number;
  acceptedAdds: number;
  blockedAdds: number;
  exitReason: string;
  exitIso: string;
  exitPrice: number;
  hedgePnl: number;
  partialPnl: number;
  endNotional: number;
  avgEntry: number | null;
  notes: string;
};

const ROOT = process.cwd();
const START_TS = Date.parse("2026-04-25T00:00:00Z");
const OUT_DIR = path.join(ROOT, "backtests", "hype");
const REPORT = path.join(ROOT, "research", "codex-5.24-live-led-replay-findings.md");
const FEE = 0.00055;
const TP_PCT = 1.4;
const STALE_HOURS = 4;
const STALE_TP_PCT = 0.5;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function ts(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function num(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function r(value: number | null | undefined, dp = 4): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const m = 10 ** dp;
  return Math.round(value * m) / m;
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

function csvEscape(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, rows: Record<string, any>[]): void {
  const cols = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach(k => set.add(k));
    return set;
  }, new Set<string>()));
  const lines = [cols.join(",")];
  for (const row of rows) lines.push(cols.map(c => csvEscape(row[c])).join(","));
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}

function loadTrades(): TradeRow[] {
  const dir = path.join(ROOT, "logs");
  const files = fs.readdirSync(dir)
    .filter(name => /^trades_\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort();
  const out: TradeRow[] = [];
  for (const file of files) {
    for (const row of readJsonl(path.join(dir, file)) as TradeRow[]) {
      if (row.symbol !== "HYPEUSDT") continue;
      const t = ts(row.ts);
      if (!Number.isFinite(t) || t < START_TS) continue;
      out.push(row);
    }
  }
  return out.sort((a, b) => ts(a.ts) - ts(b.ts));
}

function loadDecisions(): AnyRow[] {
  return (readJsonl(path.join(ROOT, "data", "HYPEUSDT_decisions.jsonl")) as AnyRow[])
    .map((row: AnyRow): AnyRow => ({ ...row, _ts: ts(row.ts ?? row.timestamp ?? row.iso) }))
    .filter(row => row.symbol === "HYPEUSDT" && Number.isFinite(row._ts) && row._ts >= START_TS)
    .sort((a, b) => a._ts - b._ts);
}

function loadPrekill(): AnyRow[] {
  return (readJsonl(path.join(ROOT, "data", "prekill_warnings.jsonl")) as AnyRow[])
    .map((row: AnyRow): AnyRow => ({ ...row, _ts: ts(row.timestamp ?? row.ts) }))
    .filter(row => row.symbol === "HYPEUSDT" && Number.isFinite(row._ts) && row._ts >= START_TS)
    .sort((a, b) => a._ts - b._ts);
}

function loadCandles1m(): Candle[] {
  return readJsonl(path.join(ROOT, "data", "HYPEUSDT_1m.jsonl"))
    .map(row => ({
      ts: Number(row.ts),
      o: Number(row.o),
      h: Number(row.h),
      l: Number(row.l),
      c: Number(row.c),
      v: Number(row.v),
    }))
    .filter(c => [c.ts, c.o, c.h, c.l, c.c].every(Number.isFinite))
    .sort((a, b) => a.ts - b.ts);
}

function lowerBound<T>(arr: T[], target: number, get: (x: T) => number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (get(arr[mid]) < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function nearestDecision(decisions: AnyRow[], fillTs: number, level: number): AnyRow | undefined {
  const idx = lowerBound(decisions, fillTs, x => x._ts);
  let best: AnyRow | undefined;
  let bestDist = Infinity;
  for (let i = Math.max(0, idx - 8); i < Math.min(decisions.length, idx + 8); i++) {
    const row = decisions[i];
    if (row.decision !== "ladder_add") continue;
    if (Number(row.rungLevel) !== level) continue;
    const dist = Math.abs(row._ts - fillTs);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return bestDist <= 5 * 60_000 ? best : undefined;
}

function pm2ReasonNear(closeTs: number): string {
  const file = path.join(ROOT, "logs", "pm2", "hedgeguy-bot-out.log");
  if (!fs.existsSync(file)) return "";
  const target = iso(closeTs).slice(0, 19).replace("T", " ");
  const minute = target.slice(0, 16);
  const hits = fs.readFileSync(file, "utf8").split(/\r?\n/)
    .filter(line => line.includes(minute) && (line.includes("HARD FLATTEN") || line.includes("EMERGENCY KILL") || line.includes("BATCH TP HIT") || line.includes("STALE")));
  return hits.slice(-2).join(" | ");
}

function inferReason(pnl: number, positionsClosed: number, closeTs: number): string {
  const text = pm2ReasonNear(closeTs).toLowerCase();
  if (text.includes("emergency kill")) return "EMERGENCY_KILL";
  if (text.includes("hard flatten")) return "HARD_FLATTEN";
  if (text.includes("stale")) return "STALE_TP";
  if (text.includes("tp")) return "TP";
  if (pnl >= 0) return "PROFIT_CLOSE";
  return positionsClosed >= 10 ? "FORCED_LOSS_FULL_DEPTH" : "LOSS";
}

function buildEpisodes(trades: TradeRow[], decisions: AnyRow[], prekill: AnyRow[]): Episode[] {
  const episodes: Episode[] = [];
  let opens: TradeRow[] = [];
  let closeAll: TradeRow | null = null;
  let seq = 0;

  for (const row of trades) {
    const t = ts(row.ts);
    if (row.action === "OPEN_LONG") {
      opens.push(row);
      continue;
    }
    if (row.action === "CLOSE_ALL") {
      closeAll = row;
      continue;
    }
    if (row.action !== "BATCH_CLOSE") continue;

    seq++;
    const closeTs = t;
    const fills: OpenFill[] = opens.map((open, i) => {
      const fillTs = ts(open.ts);
      const price = Number(open.price ?? 0);
      const qty = Number(open.qty ?? 0);
      const notional = Number(open.notional ?? price * qty);
      return {
        ts: fillTs,
        iso: iso(fillTs),
        level: i,
        price,
        qty,
        notional,
        decision: nearestDecision(decisions, fillTs, i),
      };
    });
    const firstTs = fills.length ? fills[0].ts : closeTs;
    const warning = prekill.find(w => w._ts >= firstTs && w._ts <= closeTs);
    const actualPnl = Number(row.totalPnl ?? 0);
    const positionsClosed = Number(row.positionsClosed ?? fills.length);
    const closePrice = Number(row.exitPrice ?? closeAll?.price ?? row.price ?? 0);
    const rawAvgEntry = num(row.avgEntry);
    episodes.push({
      id: `live_${seq}`,
      leftCensored: fills.length === 0,
      opens: fills,
      closeTs,
      closeIso: iso(closeTs),
      closePrice,
      positionsClosed,
      actualPnl,
      actualFees: Number(row.totalFees ?? 0),
      actualAvgEntry: rawAvgEntry && rawAvgEntry > 0 ? rawAvgEntry : null,
      liveReason: inferReason(actualPnl, positionsClosed, closeTs),
      prekill: warning,
    });
    opens = [];
    closeAll = null;
  }

  return episodes;
}

function avgEntry(positions: Position[]): number | null {
  const qty = positions.reduce((sum, p) => sum + p.qty, 0);
  if (qty <= 0) return null;
  return positions.reduce((sum, p) => sum + p.ep * p.qty, 0) / qty;
}

function positionsFromOpens(opens: OpenFill[]): Position[] {
  return opens.map(open => ({
    ep: open.price,
    et: open.ts,
    qty: open.qty,
    notional: open.notional,
    level: open.level,
  }));
}

function episodeAvgEntry(ep: Episode): number | null {
  return ep.actualAvgEntry ?? avgEntry(positionsFromOpens(ep.opens));
}

function totalNotional(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.notional, 0);
}

function oldestEntry(positions: Position[]): number {
  return Math.min(...positions.map(p => p.et));
}

function closePositions(positions: Position[], price: number, share = 1): { pnl: number; fees: number; notionalClosed: number; qtyClosed: number } {
  let pnl = 0;
  let fees = 0;
  let notionalClosed = 0;
  let qtyClosed = 0;
  for (const p of positions) {
    const closeQty = p.qty * share;
    const openNotionalPart = p.notional * share;
    const closeNotional = closeQty * price;
    const f = openNotionalPart * FEE + closeNotional * FEE;
    pnl += (price - p.ep) * closeQty - f;
    fees += f;
    notionalClosed += openNotionalPart;
    qtyClosed += closeQty;
  }
  if (share >= 0.999999) {
    positions.length = 0;
  } else {
    for (const p of positions) {
      p.qty *= (1 - share);
      p.notional *= (1 - share);
    }
  }
  return { pnl, fees, notionalClosed, qtyClosed };
}

function hedgePnl(ctx: SimContext, closePrice: number): number {
  if (!ctx.hedge) return 0;
  const h = ctx.hedge;
  const closeNotional = h.qty * closePrice;
  return (h.price - closePrice) * h.qty - h.notional * FEE - closeNotional * FEE;
}

function openHedge(ctx: SimContext, ts: number, price: number, pct: number, reason: string): void {
  if (ctx.hedgeDone || ctx.positions.length === 0) return;
  const notional = totalNotional(ctx.positions) * pct;
  ctx.hedge = { ts, price, notional, qty: notional / price, reason };
  ctx.hedgeDone = true;
  ctx.notes.push(`hedge ${Math.round(pct * 100)}% @ ${iso(ts)} $${price.toFixed(4)} ${reason}`);
}

function partialFlat(ctx: SimContext, ts: number, price: number, share: number, reason: string): void {
  if (ctx.partialDone || ctx.positions.length === 0) return;
  const result = closePositions(ctx.positions, price, share);
  ctx.realizedPnl += result.pnl;
  ctx.realizedFees += result.fees;
  ctx.partialDone = true;
  ctx.notes.push(`partial ${Math.round(share * 100)}% @ ${iso(ts)} $${price.toFixed(4)} pnl=${r(result.pnl, 2)} ${reason}`);
}

function hostileCrossVenue(row?: AnyRow): boolean {
  if (!row) return false;
  const oiBn = Number(row.oiBn4hPct);
  const oiHl = Number(row.oiHl4hPct);
  const fdBn = Number(row.fdBnNow);
  return (Number.isFinite(oiBn) && oiBn <= -5)
    || (Number.isFinite(oiHl) && oiHl <= -2)
    || (Number.isFinite(oiBn) && oiBn <= -3 && Number.isFinite(fdBn) && fdBn < 0);
}

function binanceOiUnwind(row?: AnyRow): boolean {
  return binanceOiAtMost(row, -5);
}

function binanceOiAtMost(row: AnyRow | undefined, thresholdPct: number): boolean {
  const oiBn = Number(row?.oiBn4hPct);
  return Number.isFinite(oiBn) && oiBn <= thresholdPct;
}

function binanceOiFundingStress(row?: AnyRow): boolean {
  const oiBn = Number(row?.oiBn4hPct);
  const fdBy = Number(row?.fdByNow);
  const fdBn = Number(row?.fdBnNow);
  return Number.isFinite(oiBn) && oiBn <= -5
    && Number.isFinite(fdBy) && fdBy < 0
    && Number.isFinite(fdBn) && fdBn < 0;
}

function hlOiUnwind(row?: AnyRow): boolean {
  const oiHl = Number(row?.oiHl4hPct);
  return Number.isFinite(oiHl) && oiHl <= -2;
}

function fundingValues(row?: AnyRow): number[] {
  return [row?.fdByNow, row?.fdBnNow, row?.fdHlNow]
    .map(Number)
    .filter(Number.isFinite);
}

function anyFundingNegative(row?: AnyRow): boolean {
  return fundingValues(row).some(v => v < 0);
}

function allFundingNegative(row?: AnyRow): boolean {
  const values = fundingValues(row);
  return values.length >= 2 && values.every(v => v < 0);
}

function binanceOiFundingLoose(row?: AnyRow): boolean {
  return binanceOiAtMost(row, -2) && anyFundingNegative(row);
}

function priceDropOk(open: OpenFill, accepted: Position[]): boolean {
  if (accepted.length === 0) return true;
  const last = accepted[accepted.length - 1];
  return open.price <= last.ep * 0.997;
}

function stressRequiresPriceDrop(open: OpenFill, accepted: Position[], stress: boolean): boolean {
  return !(accepted.length >= 5 && stress && !priceDropOk(open, accepted));
}

function activeTp(positions: Position[], atTs: number, currentPrice: number): { price: number; pct: number; stale: boolean; avg: number } | null {
  const avg = avgEntry(positions);
  if (!avg) return null;
  const ageH = (atTs - oldestEntry(positions)) / 3_600_000;
  const pnlPct = ((currentPrice - avg) / avg) * 100;
  const stale = ageH >= STALE_HOURS && pnlPct < STALE_TP_PCT;
  const pct = stale ? STALE_TP_PCT : TP_PCT;
  return { price: avg * (1 + pct / 100), pct, stale, avg };
}

function scanTp(candles: Candle[], ctx: SimContext, fromTs: number, toTs: number): { hit: boolean; ts?: number; price?: number; stale?: boolean } {
  if (ctx.positions.length === 0 || toTs <= fromTs) return { hit: false };
  let idx = lowerBound(candles, fromTs, c => c.ts);
  while (idx < candles.length && candles[idx].ts <= toTs) {
    const c = candles[idx];
    const tp = activeTp(ctx.positions, c.ts, c.c);
    if (tp && c.h >= tp.price) {
      return { hit: true, ts: Math.max(c.ts, fromTs), price: tp.price, stale: tp.stale };
    }
    idx++;
  }
  return { hit: false };
}

function finish(ctx: SimContext, price: number, closeTs: number, reason: string, hedgeClose = true): SimResult {
  const partialPnl = ctx.realizedPnl;
  const avg = avgEntry(ctx.positions);
  const posClose = closePositions(ctx.positions, price, 1);
  const hPnl = hedgeClose ? hedgePnl(ctx, price) : 0;
  const simPnl = ctx.realizedPnl + posClose.pnl + hPnl;
  return {
    episodeId: ctx.ep.id,
    variant: ctx.variantId,
    mode: "actual_close",
    entryIso: ctx.ep.opens[0]?.iso ?? ctx.ep.closeIso,
    closeIso: ctx.ep.closeIso,
    liveReason: ctx.ep.liveReason,
    actualPnl: r(ctx.ep.actualPnl, 4)!,
    simPnl: r(simPnl, 4)!,
    deltaVsActual: r(simPnl - ctx.ep.actualPnl, 4)!,
    actualOpens: ctx.ep.opens.length,
    acceptedAdds: ctx.acceptedAdds,
    blockedAdds: ctx.blockedAdds,
    exitReason: reason,
    exitIso: iso(closeTs),
    exitPrice: r(price, 8)!,
    hedgePnl: r(hPnl, 4)!,
    partialPnl: r(partialPnl, 4)!,
    endNotional: r(posClose.notionalClosed, 4)!,
    avgEntry: r(avg, 8),
    notes: ctx.notes.join(" | "),
  };
}

function simulateEpisode(ep: Episode, variant: Variant, candles: Candle[], mode: "actual_close" | "tp_path"): SimResult {
  if (ep.leftCensored || ep.opens.length === 0) {
    return {
      episodeId: ep.id,
      variant: variant.id,
      mode,
      entryIso: ep.closeIso,
      closeIso: ep.closeIso,
      liveReason: ep.liveReason,
      actualPnl: r(ep.actualPnl, 4)!,
      simPnl: r(ep.actualPnl, 4)!,
      deltaVsActual: 0,
      actualOpens: 0,
      acceptedAdds: 0,
      blockedAdds: 0,
      exitReason: "left_censored_passthrough",
      exitIso: ep.closeIso,
      exitPrice: ep.closePrice,
      hedgePnl: 0,
      partialPnl: 0,
      endNotional: 0,
      avgEntry: episodeAvgEntry(ep),
      notes: "left-censored actual pnl passthrough",
    };
  }

  const ctx: SimContext = {
    ep,
    variantId: variant.id,
    positions: [],
    hedge: null,
    partialDone: false,
    hedgeDone: false,
    realizedPnl: 0,
    realizedFees: 0,
    blockedAdds: 0,
    acceptedAdds: 0,
    notes: [],
  };

  const events = [
    ...ep.opens.map(open => ({ ts: open.ts, type: "open" as const, open })),
    ...(ep.prekill ? [{ ts: ep.prekill._ts, type: "prekill" as const, warning: ep.prekill }] : []),
  ].sort((a, b) => a.ts - b.ts);

  let lastTs = ep.opens[0].ts;
  for (const event of events) {
    if (mode === "tp_path" && ctx.positions.length > 0) {
      const hit = scanTp(candles, ctx, lastTs, event.ts);
      if (hit.hit && hit.price && hit.ts) {
        const out = finish(ctx, hit.price, hit.ts, hit.stale ? "counterfactual_stale_tp" : "counterfactual_tp");
        out.mode = mode;
        return out;
      }
    }

    if (event.type === "open") {
      const open = event.open;
      if (variant.allowAdd(open, ctx.positions, ep)) {
        ctx.positions.push({ ep: open.price, et: open.ts, qty: open.qty, notional: open.notional, level: open.level });
        ctx.acceptedAdds++;
        variant.afterAdd?.(ctx, open);
      } else {
        ctx.blockedAdds++;
      }
    } else if (event.type === "prekill") {
      variant.onPrekill?.(ctx, event.warning);
    }
    lastTs = event.ts;
  }

  if (mode === "tp_path" && ctx.positions.length > 0) {
    const hit = scanTp(candles, ctx, lastTs, ep.closeTs);
    if (hit.hit && hit.price && hit.ts) {
      const out = finish(ctx, hit.price, hit.ts, hit.stale ? "counterfactual_stale_tp" : "counterfactual_tp");
      out.mode = mode;
      return out;
    }
  }

  const out = finish(ctx, ep.closePrice, ep.closeTs, "actual_close_mark");
  out.mode = mode;
  return out;
}

function summarize(results: SimResult[]): Record<string, any>[] {
  const groups = new Map<string, SimResult[]>();
  for (const row of results) {
    const key = `${row.variant}|${row.mode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const baselineActual = Array.from(groups.values())[0]?.reduce((sum, r) => sum + r.actualPnl, 0) ?? 0;
  const out: Record<string, any>[] = [];
  for (const [key, rows] of groups.entries()) {
    const [variant, mode] = key.split("|");
    const net = rows.reduce((sum, row) => sum + row.simPnl, 0);
    const actual = rows.reduce((sum, row) => sum + row.actualPnl, 0);
    out.push({
      variant,
      mode,
      episodes: rows.length,
      simNet: r(net, 2),
      actualNet: r(actual, 2),
      deltaVsActual: r(net - actual, 2),
      deltaVsBaselineActual: r(net - baselineActual, 2),
      wins: rows.filter(row => row.simPnl > 0).length,
      losses: rows.filter(row => row.simPnl < 0).length,
      acceptedAdds: rows.reduce((sum, row) => sum + row.acceptedAdds, 0),
      blockedAdds: rows.reduce((sum, row) => sum + row.blockedAdds, 0),
      tpPathCloses: rows.filter(row => row.exitReason.includes("tp")).length,
      forcedLossEpisodes: rows.filter(row => row.simPnl < -1000).length,
      hedgePnl: r(rows.reduce((sum, row) => sum + row.hedgePnl, 0), 2),
      partialPnl: r(rows.reduce((sum, row) => sum + row.partialPnl, 0), 2),
    });
  }
  return out.sort((a, b) => String(a.mode).localeCompare(String(b.mode)) || Number(b.deltaVsActual) - Number(a.deltaVsActual));
}

function buildVariants(): Variant[] {
  const acceptAll = (open: OpenFill) => open.price > 0;
  const deep = (accepted: Position[]) => accepted.length >= 5;
  return [
    {
      id: "actual_adds_repriced",
      description: "Accept all actual adds; recompute PnL from fills and live close.",
      allowAdd: acceptAll,
    },
    {
      id: "price_drop_required_all",
      description: "Require each add after rung 0 to be >=0.3% below the last accepted add.",
      allowAdd: (open, accepted) => priceDropOk(open, accepted),
    },
    {
      id: "price_drop_required_after_5",
      description: "Allow first 5 rungs as live; require 0.3% lower fills for deep adds.",
      allowAdd: (open, accepted) => accepted.length < 5 || priceDropOk(open, accepted),
    },
    {
      id: "deep_funding_requires_price_drop",
      description: "At accepted depth >=5, negative funding blocks time-only adds but allows true 0.3% lower DCA adds.",
      allowAdd: (open, accepted) => stressRequiresPriceDrop(open, accepted, anyFundingNegative(open.decision)),
    },
    {
      id: "deep_funding_or_oi_requires_price_drop",
      description: "At accepted depth >=5, negative funding or cross-venue OI stress blocks time-only adds but allows true 0.3% lower DCA adds.",
      allowAdd: (open, accepted) => stressRequiresPriceDrop(open, accepted, anyFundingNegative(open.decision) || hostileCrossVenue(open.decision)),
    },
    {
      id: "block_deep_binance_oi_le_m5",
      description: "Block adds at accepted depth >=5 when Binance OI 4h <= -5%.",
      allowAdd: (open, accepted) => !(deep(accepted) && binanceOiUnwind(open.decision)),
    },
    {
      id: "block_deep_binance_oi_le_m3",
      description: "Block adds at accepted depth >=5 when Binance OI 4h <= -3%.",
      allowAdd: (open, accepted) => !(deep(accepted) && binanceOiAtMost(open.decision, -3)),
    },
    {
      id: "block_deep_binance_oi_le_m2",
      description: "Block adds at accepted depth >=5 when Binance OI 4h <= -2%.",
      allowAdd: (open, accepted) => !(deep(accepted) && binanceOiAtMost(open.decision, -2)),
    },
    {
      id: "block_deep_bn_oi_m2_funding_neg",
      description: "Block adds at accepted depth >=5 when Binance OI 4h <= -2% and any funding venue is negative.",
      allowAdd: (open, accepted) => !(deep(accepted) && binanceOiFundingLoose(open.decision)),
    },
    {
      id: "block_deep_any_funding_neg",
      description: "Block adds at accepted depth >=5 when any available funding stream is negative.",
      allowAdd: (open, accepted) => !(deep(accepted) && anyFundingNegative(open.decision)),
    },
    {
      id: "block_deep_all_funding_neg",
      description: "Block adds at accepted depth >=5 when all available funding streams are negative.",
      allowAdd: (open, accepted) => !(deep(accepted) && allFundingNegative(open.decision)),
    },
    {
      id: "block_any_binance_oi_le_m5",
      description: "Block any add, including rung 0, when Binance OI 4h <= -5%.",
      allowAdd: open => !binanceOiUnwind(open.decision),
    },
    {
      id: "block_entry_binance_oi_le_m5",
      description: "Block only rung-0 entry when Binance OI 4h <= -5%.",
      allowAdd: (open, accepted) => accepted.length > 0 || !binanceOiUnwind(open.decision),
    },
    {
      id: "block_entry_bn_oi_funding_stress",
      description: "Block rung-0 entry when Binance OI 4h <= -5% and Bybit+Binance funding are negative.",
      allowAdd: (open, accepted) => accepted.length > 0 || !binanceOiFundingStress(open.decision),
    },
    {
      id: "block_deep_hl_oi_le_m2",
      description: "Block adds at accepted depth >=5 when Hyperliquid OI 4h <= -2%.",
      allowAdd: (open, accepted) => !(deep(accepted) && hlOiUnwind(open.decision)),
    },
    {
      id: "block_deep_crossvenue_oi",
      description: "Block adds at accepted depth >=5 on Binance/HL OI unwind composite.",
      allowAdd: (open, accepted) => !(deep(accepted) && hostileCrossVenue(open.decision)),
    },
    {
      id: "block_deep_crossvenue_or_funding",
      description: "Block adds at accepted depth >=5 on cross-venue OI unwind or negative funding.",
      allowAdd: (open, accepted) => !(deep(accepted) && (hostileCrossVenue(open.decision) || anyFundingNegative(open.decision))),
    },
    {
      id: "block_any_crossvenue_oi",
      description: "Block any add, including rung 0, on Binance/HL OI unwind composite.",
      allowAdd: open => !hostileCrossVenue(open.decision),
    },
    {
      id: "block_entry_crossvenue_oi",
      description: "Block only rung-0 entry on Binance/HL OI unwind composite.",
      allowAdd: (open, accepted) => accepted.length > 0 || !hostileCrossVenue(open.decision),
    },
    {
      id: "price_drop_plus_crossvenue_oi",
      description: "Require 0.3% lower fills and block deep cross-venue OI unwind.",
      allowAdd: (open, accepted) => priceDropOk(open, accepted) && !(deep(accepted) && hostileCrossVenue(open.decision)),
    },
    {
      id: "hedge20_deep_crossvenue_oi",
      description: "Accept live adds; open 20% notional short once depth >=8 and cross-venue OI unwind fires.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && hostileCrossVenue(open.decision)) {
          openHedge(ctx, open.ts, open.price, 0.20, "deep crossvenue OI");
        }
      },
    },
    {
      id: "hedge20_deep_bn_oi_m2_funding",
      description: "Accept live adds; open 20% notional short once depth >=8 and Binance OI <= -2% with negative funding.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && binanceOiFundingLoose(open.decision)) {
          openHedge(ctx, open.ts, open.price, 0.20, "deep Binance OI + funding");
        }
      },
    },
    {
      id: "hedge20_deep_any_funding_neg",
      description: "Accept live adds; open 20% notional short once depth >=8 and any funding stream is negative.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && anyFundingNegative(open.decision)) {
          openHedge(ctx, open.ts, open.price, 0.20, "deep negative funding");
        }
      },
    },
    {
      id: "partial33_deep_crossvenue_oi",
      description: "Accept live adds; close 33% pro-rata once depth >=8 and cross-venue OI unwind fires.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && hostileCrossVenue(open.decision)) {
          partialFlat(ctx, open.ts, open.price, 0.33, "deep crossvenue OI");
        }
      },
    },
    {
      id: "partial50_deep_bn_oi_m2_funding",
      description: "Accept live adds; close 50% pro-rata once depth >=8 and Binance OI <= -2% with negative funding.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && binanceOiFundingLoose(open.decision)) {
          partialFlat(ctx, open.ts, open.price, 0.50, "deep Binance OI + funding");
        }
      },
    },
    {
      id: "partial50_deep_any_funding_neg",
      description: "Accept live adds; close 50% pro-rata once depth >=8 and any funding stream is negative.",
      allowAdd: acceptAll,
      afterAdd: (ctx, open) => {
        if (ctx.positions.length >= 8 && anyFundingNegative(open.decision)) {
          partialFlat(ctx, open.ts, open.price, 0.50, "deep negative funding");
        }
      },
    },
    {
      id: "hedge20_prekill",
      description: "Accept live adds; open 20% short at first pre-kill warning.",
      allowAdd: acceptAll,
      onPrekill: (ctx, warning) => openHedge(ctx, warning._ts, Number(warning.price), 0.20, "prekill warning"),
    },
    {
      id: "partial50_prekill",
      description: "Accept live adds; close 50% pro-rata at first pre-kill warning.",
      allowAdd: acceptAll,
      onPrekill: (ctx, warning) => partialFlat(ctx, warning._ts, Number(warning.price), 0.50, "prekill warning"),
    },
  ];
}

function episodeRows(episodes: Episode[]): Record<string, any>[] {
  return episodes.map(ep => ({
    episodeId: ep.id,
    entryIso: ep.opens[0]?.iso ?? ep.closeIso,
    lastAddIso: ep.opens[ep.opens.length - 1]?.iso ?? "",
    closeIso: ep.closeIso,
    opens: ep.opens.length,
    positionsClosed: ep.positionsClosed,
    actualPnl: r(ep.actualPnl, 2),
    actualFees: r(ep.actualFees, 2),
    closePrice: r(ep.closePrice, 6),
    avgEntry: r(episodeAvgEntry(ep), 6),
    liveReason: ep.liveReason,
    prekillIso: ep.prekill ? iso(ep.prekill._ts) : "",
    prekillScore: ep.prekill?.score ?? "",
    prekillPnlPct: ep.prekill ? r(Number(ep.prekill.ladderPnlPct), 4) : "",
  }));
}

function rungRows(episodes: Episode[]): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (const ep of episodes) {
    for (const open of ep.opens) {
      rows.push({
        episodeId: ep.id,
        openIso: open.iso,
        level: open.level,
        price: r(open.price, 6),
        qty: r(open.qty, 6),
        notional: r(open.notional, 2),
        decisionTs: open.decision ? iso(open.decision._ts) : "",
        quotePrice: r(num(open.decision?.quotePrice), 6),
        taker4h: r(num(open.decision?.taker4h), 4),
        liq4hLongShortRatio: r(num(open.decision?.liq4hLongShortRatio), 4),
        oiBy4hPct: r(num(open.decision?.oiBy4hPct), 4),
        oiBn4hPct: r(num(open.decision?.oiBn4hPct), 4),
        oiHl4hPct: r(num(open.decision?.oiHl4hPct), 4),
        fdByNow: r(num(open.decision?.fdByNow), 8),
        fdBnNow: r(num(open.decision?.fdBnNow), 8),
        fdHlNow: r(num(open.decision?.fdHlNow), 8),
        btc4hMovePct: r(num(open.decision?.btc4hMovePct), 4),
      });
    }
  }
  return rows;
}

function mdTable(rows: Record<string, any>[], columns: string[], limit = rows.length): string {
  const head = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.slice(0, limit).map(row => `| ${columns.map(c => String(row[c] ?? "")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function episodeOrdinal(id: string): number {
  const m = /^live_(\d+)$/.exec(id);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function main(): void {
  ensureDir(OUT_DIR);
  ensureDir(path.dirname(REPORT));
  const trades = loadTrades();
  const decisions = loadDecisions();
  const prekill = loadPrekill();
  const candles = loadCandles1m();
  const episodes = buildEpisodes(trades, decisions, prekill);
  const variants = buildVariants();

  const results: SimResult[] = [];
  for (const variant of variants) {
    for (const mode of ["actual_close", "tp_path"] as const) {
      for (const ep of episodes) {
        results.push(simulateEpisode(ep, variant, candles, mode));
      }
    }
  }
  const summary = summarize(results);

  writeCsv(path.join(OUT_DIR, "live-led-episodes.csv"), episodeRows(episodes));
  writeCsv(path.join(OUT_DIR, "live-led-rungs.csv"), rungRows(episodes));
  writeCsv(path.join(OUT_DIR, "live-led-counterfactual-episodes.csv"), results);
  writeCsv(path.join(OUT_DIR, "live-led-counterfactual-summary.csv"), summary);

  const actualNet = episodes.reduce((sum, ep) => sum + ep.actualPnl, 0);
  const may = episodes.filter(ep => ep.closeIso >= "2026-05-01T00:00:00.000Z");
  const mayNet = may.reduce((sum, ep) => sum + ep.actualPnl, 0);
  const topActualClose = summary.filter(row => row.mode === "actual_close" && row.variant !== "actual_adds_repriced").slice(0, 6);
  const topPath = summary.filter(row => row.mode === "tp_path" && row.variant !== "actual_adds_repriced").slice(0, 6);
  const hardLosses = episodes.filter(ep => ep.actualPnl < -1000);
  const actualCloseResults = results.filter(row => row.mode === "actual_close");
  const paritySummary = summary.find(row => row.mode === "actual_close" && row.variant === "actual_adds_repriced");
  const parityDeltaAbs = Math.abs(Number(paritySummary?.deltaVsActual ?? 0));
  const hardLossVariantIds = [
    "actual_adds_repriced",
    "price_drop_required_all",
    "price_drop_required_after_5",
    "deep_funding_requires_price_drop",
    "block_deep_any_funding_neg",
    "block_deep_binance_oi_le_m2",
    "partial50_prekill",
    "hedge20_prekill",
  ];
  const hardLossMatrix = actualCloseResults
    .filter(row => hardLosses.some(ep => ep.id === row.episodeId) && hardLossVariantIds.includes(row.variant))
    .sort((a, b) => episodeOrdinal(a.episodeId) - episodeOrdinal(b.episodeId) || hardLossVariantIds.indexOf(a.variant) - hardLossVariantIds.indexOf(b.variant))
    .map(row => ({
      episodeId: row.episodeId,
      variant: row.variant,
      simPnl: r(row.simPnl, 2),
      delta: r(row.deltaVsActual, 2),
      acceptedAdds: row.acceptedAdds,
      blockedAdds: row.blockedAdds,
      hedgePnl: r(row.hedgePnl, 2),
      partialPnl: r(row.partialPnl, 2),
    }));
  const collateralVariantIds = [
    "price_drop_required_all",
    "price_drop_required_after_5",
    "deep_funding_requires_price_drop",
    "block_deep_any_funding_neg",
    "block_deep_binance_oi_le_m2",
    "partial50_prekill",
    "hedge20_prekill",
  ];
  const collateralRows = collateralVariantIds.map(variant => {
    const rows = actualCloseResults.filter(row => row.variant === variant);
    const winCosts = rows.filter(row => row.actualPnl > 0 && row.deltaVsActual < 0);
    const lossSaves = rows.filter(row => row.actualPnl < 0 && row.deltaVsActual > 0);
    const worst = winCosts.sort((a, b) => a.deltaVsActual - b.deltaVsActual)[0];
    return {
      variant,
      positiveEpisodeCost: r(winCosts.reduce((sum, row) => sum + row.deltaVsActual, 0), 2),
      positiveEpisodesHit: winCosts.length,
      lossEpisodeSave: r(lossSaves.reduce((sum, row) => sum + row.deltaVsActual, 0), 2),
      lossEpisodesHelped: lossSaves.length,
      worstCostEpisode: worst?.episodeId ?? "",
      worstCost: r(worst?.deltaVsActual, 2),
    };
  });

  const lines = [
    "# Codex 5.24 - HYPE Live-Led Replay Findings",
    "",
    `Date: ${iso(Date.now()).slice(0, 10)}`,
    "Scope: Apr 25-May 16 HYPE live episodes from actual trade logs. This is a parity/research harness, not a live config recommendation.",
    "",
    "## TL;DR",
    "",
    `1. The live-led baseline reconciles to ${r(actualNet, 2)} across ${episodes.length} closed HYPE episodes; May-to-date reconciles to ${r(mayNet, 2)} across ${may.length} episodes.`,
    `2. The repriced actual-add baseline is within ${r(parityDeltaAbs, 2)} of trade-log PnL in close-at-actual-event mode. This is close enough for first-pass variant ranking, while still not a replacement for a full exchange-exact simulator.`,
    "3. The first-pass overlays point to the same failure surface: time-based expansion is the dangerous piece. Price-drop-required adds materially reduce the two large live hard-flats in close-at-actual-event scoring; simple deep-only OI gates do not yet help.",
    "",
    "## Actual Hard Losses",
    "",
    mdTable(hardLosses.map(ep => ({
      episodeId: ep.id,
      entry: ep.opens[0]?.iso ?? "",
      lastAdd: ep.opens[ep.opens.length - 1]?.iso ?? "",
      close: ep.closeIso,
      opens: ep.opens.length,
      avgEntry: r(episodeAvgEntry(ep), 4),
      closePrice: r(ep.closePrice, 4),
      pnl: r(ep.actualPnl, 2),
      reason: ep.liveReason,
      prekill: ep.prekill ? iso(ep.prekill._ts) : "",
    })), ["episodeId", "entry", "lastAdd", "close", "opens", "avgEntry", "closePrice", "pnl", "reason", "prekill"]),
    "",
    "## Hard-Loss Counterfactual Matrix",
    "",
    "Close-at-actual-event mode. Negative `delta` means the variant was worse than live for that episode; positive means it reduced damage.",
    "",
    mdTable(hardLossMatrix, ["episodeId", "variant", "simPnl", "delta", "acceptedAdds", "blockedAdds", "hedgePnl", "partialPnl"]),
    "",
    "## Counterfactual Summary - Close At Actual Event",
    "",
    "This mode keeps each live episode's actual close time/price and only changes accepted adds or overlay actions. It is conservative for add-blocks because it does not give credit for earlier TPs.",
    "",
    mdTable(topActualClose, ["variant", "episodes", "simNet", "actualNet", "deltaVsActual", "wins", "losses", "acceptedAdds", "blockedAdds", "forcedLossEpisodes", "hedgePnl", "partialPnl"]),
    "",
    "## Counterfactual Summary - 1m TP Path",
    "",
    "This mode lets a variant close early if the 1m high touches its TP/stale TP before the actual live close. It is useful directionally but can be optimistic versus exchange bid/ask and live TP-order state.",
    "",
    mdTable(topPath, ["variant", "episodes", "simNet", "actualNet", "deltaVsActual", "wins", "losses", "acceptedAdds", "blockedAdds", "tpPathCloses", "forcedLossEpisodes", "hedgePnl", "partialPnl"]),
    "",
    "## Collateral Damage",
    "",
    "This is the cost side that can be invisible when staring only at hard flats. A candidate needs both loss savings and tolerable damage to TP episodes.",
    "",
    mdTable(collateralRows, ["variant", "positiveEpisodeCost", "positiveEpisodesHit", "lossEpisodeSave", "lossEpisodesHelped", "worstCostEpisode", "worstCost"]),
    "",
    "## Method Caveats",
    "",
    "- Actual baseline uses exchange trade logs and should be treated as the source of truth.",
    "- Add-block variants are replayed over the same live episode close schedule in `actual_close` mode; they do not yet model how different position size would alter future bot state.",
    "- `tp_path` mode uses 1m candles, so intraminute sequencing and bid/ask order fill are approximate.",
    "- Live patch chosen from this pass: `deepAddStressGuard` in require-price-drop mode. It blocks deep time-only adds under negative funding while still allowing true lower-price DCA adds.",
    "",
    "## Outputs",
    "",
    "- `backtests/hype/live-led-episodes.csv`",
    "- `backtests/hype/live-led-rungs.csv`",
    "- `backtests/hype/live-led-counterfactual-episodes.csv`",
    "- `backtests/hype/live-led-counterfactual-summary.csv`",
  ];
  fs.writeFileSync(REPORT, lines.join("\n") + "\n", "utf8");

  console.log(JSON.stringify({
    episodes: episodes.length,
    actualNet: r(actualNet, 2),
    mayEpisodes: may.length,
    mayNet: r(mayNet, 2),
    variants: variants.length,
    summary: path.relative(ROOT, path.join(OUT_DIR, "live-led-counterfactual-summary.csv")),
    report: path.relative(ROOT, REPORT),
  }, null, 2));
}

main();
