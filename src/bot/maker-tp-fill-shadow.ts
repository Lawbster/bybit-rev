import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { RestClientV5 } from "bybit-api";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Stage-1 observability for the maker-TP fee optimization (no live change).
//
// For every real long TP/stale-TP batch close, this read-only observer answers:
// had a post-only reduce-only sell limit been resting at the bot's TP intent
// price instead of the current market close on touch, (a) would it have been
// postable before the touch, (b) did the market trade through the level with
// enough printed volume to fill the full quantity as maker, and (c) what fee
// and price delta would that have produced.
//
// Inputs are the atomic runtime health snapshot (TP intent timeline), the 1m
// candle journal, the daily trade log (actual closes), and Bybit's public
// recent-trades endpoint fetched at close time for volume-at-level evidence.
// It cannot submit orders and holds no API keys.

const POLL_MS = 5_000;
const MINUTE = 60_000;
const TAKER_FEE = 0.00055;
const MAKER_FEE = 0.0002;
// Backwards-compatible fallback for historical rows without closeReason.
// New rows are classified from their durable transaction/exchange close cause.
const TP_MATCH_TOLERANCE_PCT = 0.1;
// Prints strictly above the limit price are guaranteed fills for a resting
// sell at that price; prints exactly at the level depend on queue position.
const STRICT_FILL_EPS = 1e-9;

export interface TpIntentSnapshot {
  present: boolean;
  price: number | null;
  qtyBasis: number | null;
  activeTpPct: number | null;
  syncStatus: string | null;
  updatedAt: number | null;
  bestBidAtIntent: number | null;
  bestBidObservedAt: number | null;
}

export interface IntentAnchor {
  price: number;
  qtyBasis: number;
  activeTpPct: number | null;
  firstSeenAt: number;
  marketAtFirstSeen: number | null;
  marketObservedAt: number | null;
  marketSource: "websocket_best_bid" | "legacy_unknown";
  postableAtFirstSeen: boolean | null;
}

export interface PublicPrint {
  price: number;
  size: number;
  time: number;
}

export interface CounterfactualInputs {
  closeTs: number;
  exitPrice: number;
  avgEntry: number;
  totalFees: number;
  anchor: IntentAnchor;
  prints: PublicPrint[] | null;
  printsWindowStart: number;
  candleHighAfterAnchor: number | null;
  closeReason?: string | null;
}

export interface CounterfactualResult {
  eligible: boolean;
  reason: string;
  qtyClosed: number;
  postable: boolean;
  anchorLeadMs: number;
  touchMarginPct: number | null;
  printedQtyAbove: number | null;
  printedQtyAt: number | null;
  fillRatioStrict: number | null;
  actualExitFee: number;
  makerExitFee: number | null;
  estFeeSaving: number | null;
  estPriceDelta: number | null;
  estTotalDelta: number | null;
}

export function evaluateCounterfactual(inputs: CounterfactualInputs): CounterfactualResult {
  const { anchor, exitPrice, avgEntry, totalFees, prints } = inputs;
  // The batch-close row does not carry quantity; both legs of totalFees are
  // taker at the configured rate, which recovers it exactly.
  const qtyClosed = totalFees > 0 && avgEntry + exitPrice > 0
    ? totalFees / (TAKER_FEE * (avgEntry + exitPrice))
    : anchor.qtyBasis;
  const actualExitFee = TAKER_FEE * exitPrice * qtyClosed;
  const base: CounterfactualResult = {
    eligible: false,
    reason: "",
    qtyClosed,
    postable: anchor.postableAtFirstSeen === true,
    anchorLeadMs: inputs.closeTs - anchor.firstSeenAt,
    touchMarginPct: null,
    printedQtyAbove: null,
    printedQtyAt: null,
    fillRatioStrict: null,
    actualExitFee,
    makerExitFee: null,
    estFeeSaving: null,
    estPriceDelta: null,
    estTotalDelta: null,
  };

  const explicitReason = inputs.closeReason?.trim() ?? "";
  const normalizedReason = explicitReason.toUpperCase();
  const explicitTp = normalizedReason === "TP"
    || normalizedReason === "STALE TP"
    || normalizedReason === "TP (REST)"
    || normalizedReason === "STALE TP (REST)"
    || normalizedReason === "NATIVE_TP";
  if (explicitReason && !explicitTp) {
    return { ...base, reason: `explicit_non_tp_close:${explicitReason}` };
  }
  const tpMatch = explicitTp || exitPrice >= anchor.price * (1 - TP_MATCH_TOLERANCE_PCT / 100);
  if (!tpMatch) return { ...base, reason: "exit_below_tp_intent_not_a_tp_close" };
  if (anchor.postableAtFirstSeen === null) {
    return { ...base, eligible: true, reason: "postability_unknown_missing_exact_best_bid" };
  }
  if (!anchor.postableAtFirstSeen) return { ...base, eligible: true, reason: "not_postable_market_at_or_above_tp_when_intent_set" };

  const touchMarginPct = inputs.candleHighAfterAnchor !== null
    ? ((inputs.candleHighAfterAnchor - anchor.price) / anchor.price) * 100
    : null;

  if (!prints || prints.length === 0) {
    return {
      ...base,
      eligible: true,
      reason: "postable_no_print_evidence",
      touchMarginPct,
    };
  }

  const relevant = prints.filter(print => print.time >= inputs.printsWindowStart && print.time <= inputs.closeTs + 2 * MINUTE);
  const printedQtyAbove = relevant.filter(print => print.price > anchor.price + STRICT_FILL_EPS)
    .reduce((sum, print) => sum + print.size, 0);
  const printedQtyAt = relevant.filter(print => Math.abs(print.price - anchor.price) <= STRICT_FILL_EPS)
    .reduce((sum, print) => sum + print.size, 0);
  const fillRatioStrict = qtyClosed > 0 ? Math.min(1, printedQtyAbove / qtyClosed) : null;

  const filledQty = qtyClosed * (fillRatioStrict ?? 0);
  const fallbackQty = qtyClosed - filledQty;
  // Maker fill executes at the limit price; the unfilled remainder falls back
  // to the actual market close it received today.
  const makerExitFee = MAKER_FEE * anchor.price * filledQty + TAKER_FEE * exitPrice * fallbackQty;
  const estFeeSaving = actualExitFee - makerExitFee;
  const estPriceDelta = (anchor.price - exitPrice) * filledQty;
  return {
    ...base,
    eligible: true,
    reason: fillRatioStrict !== null && fillRatioStrict >= 1 ? "full_maker_fill_supported" : "partial_maker_fill",
    touchMarginPct,
    printedQtyAbove,
    printedQtyAt,
    fillRatioStrict,
    makerExitFee,
    estFeeSaving,
    estPriceDelta,
    estTotalDelta: estFeeSaving + estPriceDelta,
  };
}

interface ShadowCounters {
  polls: number;
  intentChanges: number;
  closesSeen: number;
  tpCloses: number;
  postable: number;
  postabilityUnknown: number;
  fullFillSupported: number;
  partialFill: number;
  noPrintEvidence: number;
  estFeeSavingUsd: number;
  estTotalDeltaUsd: number;
}

interface MakerTpShadowStateV1 {
  version: 1;
  symbol: "HYPEUSDT";
  shadowOnly: true;
  createdAt: number;
  updatedAt: number;
  lastPollAt: number | null;
  anchor: IntentAnchor | null;
  lastProcessedCloseTs: number;
  counters: ShadowCounters;
}

export interface MakerTpShadowHealthV1 {
  version: 1;
  symbol: "HYPEUSDT";
  shadowOnly: true;
  processStartedAt: number;
  writtenAt: number;
  status: "warming_up" | "healthy" | "degraded";
  statusReasons: string[];
  sources: Array<{ name: string; ageMs: number | null; error: string | null }>;
  anchor: IntentAnchor | null;
  counters: ShadowCounters;
}

function defaultCounters(): ShadowCounters {
  return {
    polls: 0,
    intentChanges: 0,
    closesSeen: 0,
    tpCloses: 0,
    postable: 0,
    postabilityUnknown: 0,
    fullFillSupported: 0,
    partialFill: 0,
    noPrintEvidence: 0,
    estFeeSavingUsd: 0,
    estTotalDeltaUsd: 0,
  };
}

function defaultState(now: number): MakerTpShadowStateV1 {
  return {
    version: 1,
    symbol: "HYPEUSDT",
    shadowOnly: true,
    createdAt: now,
    updatedAt: now,
    lastPollAt: null,
    anchor: null,
    // Fresh cohorts evaluate only closes after process birth; historical
    // closes have no trustworthy intent anchor.
    lastProcessedCloseTs: now,
    counters: defaultCounters(),
  };
}

function atomicWriteJson(filePath: string, value: unknown): { success: boolean; error?: string } {
  const dir = path.dirname(filePath);
  const temp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(value));
    fs.renameSync(temp, filePath);
    return { success: true };
  } catch (err: any) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* best effort */ }
    return { success: false, error: err?.message ?? String(err) };
  }
}

export type PrintFetcher = () => Promise<PublicPrint[] | null>;

export class MakerTpFillShadow {
  private readonly symbol = "HYPEUSDT" as const;
  private readonly rootDir: string;
  private readonly dataDir: string;
  private readonly logsDir: string;
  private readonly stateFile: string;
  private readonly healthFile: string;
  private readonly eventsFile: string;
  private readonly processStartedAt: number;
  private readonly fetchPrints: PrintFetcher;
  private state: MakerTpShadowStateV1;
  private runtimeErrors: string[] = [];
  private healthAgeMs: number | null = null;
  private candleAgeMs: number | null = null;
  private tradeLogError: string | null = null;

  constructor(rootDir: string = process.cwd(), now: number = Date.now(), fetchPrints?: PrintFetcher) {
    this.rootDir = path.resolve(rootDir);
    this.dataDir = path.join(this.rootDir, "data");
    this.logsDir = path.join(this.rootDir, "logs");
    this.stateFile = path.join(this.dataDir, `${this.symbol}_maker_tp_shadow_state.json`);
    this.healthFile = path.join(this.dataDir, `${this.symbol}_maker_tp_shadow_health.json`);
    this.eventsFile = path.join(this.dataDir, `${this.symbol}_maker_tp_shadow.jsonl`);
    this.processStartedAt = now;
    this.state = this.readState(now);
    if (fetchPrints) {
      this.fetchPrints = fetchPrints;
    } else {
      const client = new RestClientV5({});
      this.fetchPrints = async () => {
        const res = await client.getPublicTradingHistory({ category: "linear", symbol: this.symbol, limit: 1000 });
        if (res.retCode !== 0 || !Array.isArray(res.result?.list)) return null;
        return res.result.list.map((row: any) => ({
          price: Number(row.price),
          size: Number(row.size),
          time: Number(row.time),
        })).filter(print => Number.isFinite(print.price) && Number.isFinite(print.size) && Number.isFinite(print.time));
      };
    }
  }

  private readState(now: number): MakerTpShadowStateV1 {
    if (!fs.existsSync(this.stateFile)) return defaultState(now);
    const parsed = JSON.parse(fs.readFileSync(this.stateFile, "utf8")) as Partial<MakerTpShadowStateV1>;
    if (parsed.version !== 1 || parsed.symbol !== "HYPEUSDT") throw new Error("unsupported maker-tp shadow state");
    const anchor = parsed.anchor
      ? {
          ...parsed.anchor,
          marketObservedAt: parsed.anchor.marketObservedAt ?? null,
          marketSource: parsed.anchor.marketSource ?? "legacy_unknown" as const,
          postableAtFirstSeen: parsed.anchor.marketSource === "websocket_best_bid"
            ? parsed.anchor.postableAtFirstSeen
            : null,
        }
      : null;
    return {
      ...defaultState(now),
      ...parsed,
      anchor,
      counters: { ...defaultCounters(), ...(parsed.counters ?? {}) },
    } as MakerTpShadowStateV1;
  }

  private appendEvent(type: string, now: number, detail: Record<string, unknown>): void {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      fs.appendFileSync(this.eventsFile, JSON.stringify({
        ts: new Date(now).toISOString(),
        timestamp: now,
        symbol: this.symbol,
        shadowOnly: true,
        event: type,
        ...detail,
      }) + "\n");
    } catch (err: any) {
      this.runtimeErrors.push(`event_write:${err?.message ?? err}`);
    }
  }

  private readTpIntent(now: number): TpIntentSnapshot | null {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.dataDir, `${this.symbol}_runtime_health.json`), "utf8"));
      this.healthAgeMs = Number.isFinite(raw?.writtenAt) ? Math.max(0, now - raw.writtenAt) : null;
      const tp = raw?.desiredLongTp;
      const intent: TpIntentSnapshot = {
        present: tp?.present === true,
        price: Number.isFinite(tp?.price) ? tp.price : null,
        qtyBasis: Number.isFinite(tp?.positionQtyBasis) ? tp.positionQtyBasis : null,
        activeTpPct: Number.isFinite(tp?.activeTpPct) ? tp.activeTpPct : null,
        syncStatus: typeof tp?.syncStatus === "string" ? tp.syncStatus : null,
        updatedAt: Number.isFinite(tp?.updatedAt) ? tp.updatedAt : null,
        bestBidAtIntent: Number.isFinite(tp?.bestBidAtIntent) ? tp.bestBidAtIntent : null,
        bestBidObservedAt: Number.isFinite(tp?.bestBidObservedAt) ? tp.bestBidObservedAt : null,
      };
      return intent;
    } catch (err: any) {
      this.healthAgeMs = null;
      this.runtimeErrors.push(`runtime_health:${err?.message ?? err}`);
      return null;
    }
  }

  private latestCandle(now: number): { ts: number; close: number; high: number } | null {
    try {
      const filePath = path.join(this.dataDir, `${this.symbol}_1m.jsonl`);
      const stat = fs.statSync(filePath);
      const length = Math.min(stat.size, 16 * 1024);
      const buffer = Buffer.alloc(length);
      const fd = fs.openSync(filePath, "r");
      try {
        fs.readSync(fd, buffer, 0, length, stat.size - length);
      } finally {
        fs.closeSync(fd);
      }
      const lines = buffer.toString("utf8").trim().split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const row = JSON.parse(lines[i]);
          const ts = Number(row.ts ?? row.timestamp);
          const close = Number(row.c ?? row.close);
          const high = Number(row.h ?? row.high);
          if (Number.isFinite(ts) && Number.isFinite(close) && Number.isFinite(high)) {
            this.candleAgeMs = Math.max(0, now - ts);
            return { ts, close, high };
          }
        } catch { /* partial last line */ }
      }
    } catch (err: any) {
      this.runtimeErrors.push(`candles:${err?.message ?? err}`);
    }
    this.candleAgeMs = null;
    return null;
  }

  private highSince(sinceTs: number): number | null {
    try {
      const filePath = path.join(this.dataDir, `${this.symbol}_1m.jsonl`);
      const stat = fs.statSync(filePath);
      const length = Math.min(stat.size, 4 * 1024 * 1024);
      const buffer = Buffer.alloc(length);
      const fd = fs.openSync(filePath, "r");
      try {
        fs.readSync(fd, buffer, 0, length, stat.size - length);
      } finally {
        fs.closeSync(fd);
      }
      let high: number | null = null;
      for (const line of buffer.toString("utf8").split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          const ts = Number(row.ts ?? row.timestamp);
          const value = Number(row.h ?? row.high);
          if (Number.isFinite(ts) && ts >= sinceTs && Number.isFinite(value)) high = high === null ? value : Math.max(high, value);
        } catch { /* skip */ }
      }
      return high;
    } catch {
      return null;
    }
  }

  private readNewCloses(now: number): Array<{
    ts: number;
    exitPrice: number;
    avgEntry: number;
    totalFees: number;
    positionsClosed: number;
    closeReason: string | null;
  }> {
    const out: Array<{
      ts: number;
      exitPrice: number;
      avgEntry: number;
      totalFees: number;
      positionsClosed: number;
      closeReason: string | null;
    }> = [];
    this.tradeLogError = null;
    const dates = [new Date(now - 24 * 60 * MINUTE), new Date(now)].map(date => date.toISOString().slice(0, 10));
    for (const date of [...new Set(dates)]) {
      const filePath = path.join(this.logsDir, `trades_${date}.jsonl`);
      if (!fs.existsSync(filePath)) continue;
      try {
        for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
          if (!line.includes("BATCH_CLOSE")) continue;
          try {
            const row = JSON.parse(line);
            if (row.action !== "BATCH_CLOSE") continue;
            const ts = Date.parse(row.ts);
            if (!Number.isFinite(ts) || ts <= this.state.lastProcessedCloseTs) continue;
            const exitPrice = Number(row.exitPrice);
            const avgEntry = Number(row.avgEntry);
            const totalFees = Number(row.totalFees);
            if (!Number.isFinite(exitPrice) || !Number.isFinite(avgEntry) || !Number.isFinite(totalFees)) continue;
            out.push({
              ts,
              exitPrice,
              avgEntry,
              totalFees,
              positionsClosed: Number(row.positionsClosed) || 0,
              closeReason: typeof row.closeReason === "string" ? row.closeReason : null,
            });
          } catch { /* skip malformed */ }
        }
      } catch (err: any) {
        this.tradeLogError = err?.message ?? String(err);
      }
    }
    return out.sort((a, b) => a.ts - b.ts);
  }

  private updateAnchor(intent: TpIntentSnapshot | null, now: number): void {
    if (!intent || !intent.present || intent.price === null || intent.qtyBasis === null) {
      if (this.state.anchor !== null) {
        this.appendEvent("tp_intent_cleared", now, { previous: this.state.anchor });
        this.state.anchor = null;
        this.state.counters.intentChanges++;
      }
      return;
    }
    const current = this.state.anchor;
    const exactBestBidAvailable = intent.bestBidAtIntent !== null && intent.bestBidObservedAt !== null;
    const priceChanged = !current
      || Math.abs(current.price - intent.price) / intent.price > 1e-9
      || (current.marketSource !== "websocket_best_bid" && exactBestBidAvailable);
    if (!priceChanged) {
      // Same level re-confirmed; keep the original anchor so postability and
      // lead time reflect when the level first became active.
      this.state.anchor = { ...current!, qtyBasis: intent.qtyBasis, activeTpPct: intent.activeTpPct };
      return;
    }
    const postable = exactBestBidAvailable ? intent.bestBidAtIntent! < intent.price : null;
    this.state.anchor = {
      price: intent.price,
      qtyBasis: intent.qtyBasis,
      activeTpPct: intent.activeTpPct,
      firstSeenAt: exactBestBidAvailable ? intent.bestBidObservedAt! : (intent.updatedAt ?? now),
      marketAtFirstSeen: intent.bestBidAtIntent,
      marketObservedAt: intent.bestBidObservedAt,
      marketSource: exactBestBidAvailable ? "websocket_best_bid" : "legacy_unknown",
      postableAtFirstSeen: postable,
    };
    this.state.counters.intentChanges++;
    this.appendEvent("tp_intent", now, { anchor: this.state.anchor, syncStatus: intent.syncStatus });
  }

  private health(now: number): MakerTpShadowHealthV1 {
    const statusReasons = [...this.runtimeErrors];
    if (this.healthAgeMs === null || this.healthAgeMs > 2 * MINUTE) statusReasons.push("runtime_health_stale");
    if (this.candleAgeMs === null || this.candleAgeMs > 5 * MINUTE) statusReasons.push("candles_stale");
    if (this.tradeLogError) statusReasons.push(`trade_log:${this.tradeLogError}`);
    const warming = now - this.processStartedAt < 3 * MINUTE && this.state.counters.polls < 3;
    return {
      version: 1,
      symbol: this.symbol,
      shadowOnly: true,
      processStartedAt: this.processStartedAt,
      writtenAt: now,
      status: warming ? "warming_up" : statusReasons.length > 0 ? "degraded" : "healthy",
      statusReasons: [...new Set(statusReasons)],
      sources: [
        { name: "runtime_health", ageMs: this.healthAgeMs, error: null },
        { name: "bybit_1m", ageMs: this.candleAgeMs, error: null },
        { name: "trade_log", ageMs: null, error: this.tradeLogError },
      ],
      anchor: this.state.anchor,
      counters: { ...this.state.counters },
    };
  }

  async poll(now: number = Date.now()): Promise<MakerTpShadowHealthV1> {
    this.runtimeErrors = [];
    this.state.counters.polls++;
    const intent = this.readTpIntent(now);
    this.latestCandle(now);
    // Snapshot the anchor before applying intent changes: a TP fill clears the
    // intent in the same window the close row appears, and the counterfactual
    // must use the level that was resting when the exit happened.
    const anchorAtPollStart = this.state.anchor;
    const closes = this.readNewCloses(now);
    this.updateAnchor(intent, now);

    for (const close of closes) {
      this.state.counters.closesSeen++;
      this.state.lastProcessedCloseTs = Math.max(this.state.lastProcessedCloseTs, close.ts);
      const anchor = anchorAtPollStart ?? this.state.anchor;
      if (!anchor) {
        this.appendEvent("close_without_tp_intent", now, { close });
        continue;
      }
      let prints: PublicPrint[] | null = null;
      try {
        prints = await this.fetchPrints();
      } catch (err: any) {
        this.runtimeErrors.push(`prints_fetch:${err?.message ?? err}`);
      }
      const result = evaluateCounterfactual({
        closeTs: close.ts,
        exitPrice: close.exitPrice,
        avgEntry: close.avgEntry,
        totalFees: close.totalFees,
        anchor,
        prints,
        printsWindowStart: Math.max(anchor.firstSeenAt, close.ts - 30 * MINUTE),
        candleHighAfterAnchor: this.highSince(anchor.firstSeenAt),
        closeReason: close.closeReason,
      });
      if (result.eligible && result.reason !== "exit_below_tp_intent_not_a_tp_close") {
        this.state.counters.tpCloses++;
        if (result.postable) this.state.counters.postable++;
        if (result.reason === "postability_unknown_missing_exact_best_bid") this.state.counters.postabilityUnknown++;
        if (result.reason === "full_maker_fill_supported") this.state.counters.fullFillSupported++;
        else if (result.reason === "partial_maker_fill") this.state.counters.partialFill++;
        else if (result.reason === "postable_no_print_evidence") this.state.counters.noPrintEvidence++;
        if (result.estFeeSaving !== null) this.state.counters.estFeeSavingUsd += result.estFeeSaving;
        if (result.estTotalDelta !== null) this.state.counters.estTotalDeltaUsd += result.estTotalDelta;
      }
      this.appendEvent("maker_tp_counterfactual", now, { close, anchor, result, printCount: prints?.length ?? 0 });
      console.log(`[maker-tp-shadow] close ${new Date(close.ts).toISOString()} reason=${result.reason} feeSaving=${result.estFeeSaving?.toFixed(2) ?? "n/a"} totalDelta=${result.estTotalDelta?.toFixed(2) ?? "n/a"}`);
    }

    this.state.lastPollAt = now;
    this.state.updatedAt = now;
    const health = this.health(now);
    const stateWrite = atomicWriteJson(this.stateFile, this.state);
    if (!stateWrite.success) console.error(`[maker-tp-shadow] state write failed: ${stateWrite.error}`);
    const healthWrite = atomicWriteJson(this.healthFile, health);
    if (!healthWrite.success) console.error(`[maker-tp-shadow] health write failed: ${healthWrite.error}`);
    return health;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const rootDir = args.find(arg => arg.startsWith("--root="))?.slice("--root=".length) ?? process.cwd();
  const shadow = new MakerTpFillShadow(rootDir);
  if (once) {
    const health = await shadow.poll();
    console.log(JSON.stringify(health, null, 2));
    if (health.status === "degraded") process.exitCode = 2;
    return;
  }
  console.log(`[maker-tp-shadow] HYPEUSDT started; shadowOnly=true poll=${POLL_MS / 1000}s taker=${TAKER_FEE} maker=${MAKER_FEE}`);
  while (true) {
    try {
      const health = await shadow.poll();
      if (health.status !== "healthy") console.log(`[maker-tp-shadow] status=${health.status} reasons=${health.statusReasons.join(",") || "none"}`);
    } catch (err: any) {
      console.error(`[maker-tp-shadow] poll failed: ${err?.message ?? err}`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[maker-tp-shadow] fatal: ${err?.message ?? err}`);
    process.exit(1);
  });
}
