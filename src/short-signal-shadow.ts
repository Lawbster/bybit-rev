import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// SHORT SIGNAL SHADOW LOGGER
// Tails market.jsonl files, detects S/B > 3.0 short signals,
// logs them to logs/short_signals.jsonl with forward price tracking.
//
// Usage:
//   npx tsx src/short-signal-shadow.ts              # live tail mode (VPS)
//   npx tsx src/short-signal-shadow.ts --replay      # replay existing data
//   npx tsx src/short-signal-shadow.ts --replay HYPEUSDT  # replay single symbol
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");
const LOG_DIR = path.resolve(__dirname, "../logs");

// Only track symbols we actually trade / care about
const SYMBOLS = ["HYPEUSDT"];

// ── Signal config (validated on 2.3 days of HYPE data) ──
const CFG = {
  flowWindow: 5,         // 5 snaps (~5min) rolling S/B
  sbThreshold: 3.0,      // sell/buy volume ratio
  cooldownMs: 30 * 60000, // 30min between signals per symbol
  // Forward tracking windows (snaps ≈ minutes)
  fwdWindows: [5, 15, 30, 60],
  // Candle spike detection
  spikeThreshold: 1.0,   // 1% range on a single 1m candle = spike
  candleWindow: 5,        // look at last 5 1m candles for context
};

interface Snap {
  ts: string;
  tsMs: number;
  price: number;
  fundingRate: number;
  openInterest: number;
  ob: {
    imbalance: number;
    thinSide: string;
    bidDepth: number;
    askDepth: number;
  };
  flow: {
    buyVol: number;
    sellVol: number;
    buyCount: number;
    sellCount: number;
  };
}

interface Candle1m {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

interface CandleContext {
  range1m: number;       // (high-low)/low % of the latest 1m candle
  maxRange5m: number;    // max 1m range in last 5 candles
  avgRange5m: number;    // avg 1m range in last 5 candles
  spike: boolean;        // any candle in window exceeded spikeThreshold
  spikeDir: "up" | "down" | "none"; // direction of largest spike
  vol5m: number;         // total volume over last 5 1m candles
  high5m: number;        // highest price in last 5 candles
  low5m: number;         // lowest price in last 5 candles
  range5m: number;       // (high5m - low5m) / low5m %
}

interface ShortSignal {
  ts: string;
  symbol: string;
  price: number;
  sb: number;              // sell/buy ratio at trigger
  priceDelta5: number;     // 5-snap price change %
  oiDelta15: number;       // 15-snap OI change %
  imbalance: number;
  thinSide: string;
  fundingRate: number;
  // Candle context
  candle?: CandleContext;
  // Forward price tracking (filled in later for replay, null for live)
  fwd5m?: number | null;
  fwd15m?: number | null;
  fwd30m?: number | null;
  fwd60m?: number | null;
  maxAdverse60?: number | null;   // worst bounce against short in 60m
  maxFavorable60?: number | null; // best move in short direction in 60m
}

function parseSnap(line: string): Snap | null {
  try {
    const j = JSON.parse(line);
    return { ...j, tsMs: new Date(j.ts).getTime() };
  } catch { return null; }
}

function parseCandle(line: string): Candle1m | null {
  try { return JSON.parse(line); } catch { return null; }
}

function computeCandleContext(candles: Candle1m[], atTs: number): CandleContext | undefined {
  // Find candles up to atTs
  const relevant = candles.filter(c => c.ts <= atTs);
  const window = relevant.slice(-CFG.candleWindow);
  if (window.length === 0) return undefined;

  const latest = window[window.length - 1];
  const range1m = latest.l > 0 ? ((latest.h - latest.l) / latest.l) * 100 : 0;

  const ranges = window.map(c => c.l > 0 ? ((c.h - c.l) / c.l) * 100 : 0);
  const maxRange5m = Math.max(...ranges);
  const avgRange5m = ranges.reduce((a, b) => a + b, 0) / ranges.length;

  const spike = maxRange5m >= CFG.spikeThreshold;

  // Direction of largest spike candle
  let spikeDir: "up" | "down" | "none" = "none";
  if (spike) {
    const spikeIdx = ranges.indexOf(maxRange5m);
    const sc = window[spikeIdx];
    spikeDir = sc.c > sc.o ? "up" : sc.c < sc.o ? "down" : "none";
  }

  const vol5m = window.reduce((s, c) => s + c.v, 0);
  const high5m = Math.max(...window.map(c => c.h));
  const low5m = Math.min(...window.map(c => c.l));
  const range5m = low5m > 0 ? ((high5m - low5m) / low5m) * 100 : 0;

  return { range1m, maxRange5m, avgRange5m, spike, spikeDir, vol5m, high5m, low5m, range5m };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Replay mode: process existing data, compute forward returns ──
function replay(symbol: string) {
  const file = path.join(DATA_DIR, `${symbol}_market.jsonl`);
  if (!fs.existsSync(file)) { console.log(`  No data for ${symbol}`); return; }

  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  const snaps: Snap[] = [];
  for (const line of lines) {
    const s = parseSnap(line);
    if (s) snaps.push(s);
  }

  // Load 1m candles if available
  const candleFile = path.join(DATA_DIR, `${symbol}_1m.jsonl`);
  const candles1m: Candle1m[] = [];
  if (fs.existsSync(candleFile)) {
    const cLines = fs.readFileSync(candleFile, "utf-8").trim().split("\n");
    for (const line of cLines) {
      const c = parseCandle(line);
      if (c) candles1m.push(c);
    }
  }

  console.log(`\n── ${symbol}: ${snaps.length} snaps, ${candles1m.length} 1m candles, ${snaps[0].ts.slice(0, 16)} → ${snaps[snaps.length - 1].ts.slice(0, 16)} ──`);

  const signals: ShortSignal[] = [];
  let lastSignalTs = 0;

  for (let i = 15; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.tsMs - lastSignalTs < CFG.cooldownMs) continue;

    // 5-snap rolling S/B
    let buyV = 0, sellV = 0;
    for (let j = i - CFG.flowWindow + 1; j <= i; j++) {
      buyV += snaps[j].flow.buyVol;
      sellV += snaps[j].flow.sellVol;
    }
    const sb = buyV > 0 ? sellV / buyV : 0;
    if (sb < CFG.sbThreshold) continue;

    // Context metrics
    const priceDelta5 = ((s.price - snaps[i - 4].price) / snaps[i - 4].price) * 100;
    const oiDelta15 = ((s.openInterest - snaps[i - 14].openInterest) / snaps[i - 14].openInterest) * 100;

    // Forward returns
    const fwd = (mins: number): number | null => {
      const target = i + mins;
      if (target >= snaps.length) return null;
      return ((snaps[target].price - s.price) / s.price) * 100;
    };

    // Max adverse/favorable in 60 snaps
    let maxAdv = 0, maxFav = 0;
    for (let j = i + 1; j < Math.min(i + 60, snaps.length); j++) {
      const move = ((snaps[j].price - s.price) / s.price) * 100;
      if (move > maxAdv) maxAdv = move;  // adverse for short
      if (move < maxFav) maxFav = move;  // favorable for short
    }

    // Candle context
    const candleCtx = candles1m.length > 0 ? computeCandleContext(candles1m, s.tsMs) : undefined;

    const sig: ShortSignal = {
      ts: s.ts, symbol, price: s.price,
      sb, priceDelta5, oiDelta15,
      imbalance: s.ob.imbalance, thinSide: s.ob.thinSide,
      fundingRate: s.fundingRate,
      candle: candleCtx,
      fwd5m: fwd(5), fwd15m: fwd(15), fwd30m: fwd(30), fwd60m: fwd(60),
      maxAdverse60: maxAdv, maxFavorable60: maxFav,
    };

    signals.push(sig);
    lastSignalTs = s.tsMs;
  }

  // Print results
  console.log(`  Signals (S/B>${CFG.sbThreshold}, ${CFG.cooldownMs / 60000}min cooldown): ${signals.length}`);
  if (signals.length === 0) return;

  console.log(`\n  ${"Time".padEnd(17)} ${"Price".padStart(8)} ${"S/B".padStart(5)} ${"5mΔ%".padStart(7)} ${"1mRng%".padStart(7)} ${"5mRng%".padStart(7)} ${"Spike".padStart(6)} ${"Fwd30m".padStart(8)} ${"Fwd60m".padStart(8)} ${"MaxDD".padStart(7)}`);
  console.log(`  ${"-".repeat(100)}`);

  for (const sig of signals) {
    const f30 = sig.fwd30m !== null ? (sig.fwd30m >= 0 ? "+" : "") + sig.fwd30m.toFixed(3) + "%" : "n/a";
    const f60 = sig.fwd60m !== null ? (sig.fwd60m >= 0 ? "+" : "") + sig.fwd60m.toFixed(3) + "%" : "n/a";
    const dd = sig.maxAdverse60 !== null ? "+" + sig.maxAdverse60.toFixed(2) + "%" : "n/a";
    const r1m = sig.candle ? sig.candle.range1m.toFixed(2) + "%" : "n/a";
    const r5m = sig.candle ? sig.candle.range5m.toFixed(2) + "%" : "n/a";
    const spk = sig.candle ? (sig.candle.spike ? sig.candle.spikeDir : "-") : "n/a";

    console.log(`  ${sig.ts.slice(5, 19).padEnd(17)} $${sig.price.toFixed(3).padStart(7)} ${sig.sb.toFixed(1).padStart(5)} ${(sig.priceDelta5 >= 0 ? "+" : "") + sig.priceDelta5.toFixed(2) + "%"} ${r1m.padStart(7)} ${r5m.padStart(7)} ${spk.padStart(6)} ${f30.padStart(8)} ${f60.padStart(8)} ${dd.padStart(7)}`);
  }

  // Stats
  const with60 = signals.filter(s => s.fwd60m !== null);
  const win60 = with60.filter(s => s.fwd60m! < 0);
  const avg60 = with60.length ? with60.reduce((a, s) => a + s.fwd60m!, 0) / with60.length : 0;
  const avgDD = with60.length ? with60.reduce((a, s) => a + (s.maxAdverse60 ?? 0), 0) / with60.length : 0;
  const avgGain = with60.length ? with60.reduce((a, s) => a + (s.maxFavorable60 ?? 0), 0) / with60.length : 0;

  console.log(`\n  60m short stats: ${win60.length}/${with60.length} wins (${(win60.length / with60.length * 100).toFixed(0)}%) | avg PnL=${(-avg60).toFixed(3)}% | avg maxDD=${avgDD.toFixed(3)}% | avg maxGain=${(-avgGain).toFixed(3)}%`);

  // Spike breakdown: signals with vs without 1m spike
  const withCandle = signals.filter(s => s.candle && s.fwd60m !== null);
  if (withCandle.length > 0) {
    const spikeSignals = withCandle.filter(s => s.candle!.spike);
    const noSpike = withCandle.filter(s => !s.candle!.spike);
    const spikeDown = withCandle.filter(s => s.candle!.spikeDir === "down");

    const statLine = (label: string, arr: typeof withCandle) => {
      if (arr.length === 0) return `  ${label}: n=0`;
      const w = arr.filter(s => s.fwd60m! < 0).length;
      const avg = arr.reduce((a, s) => a + s.fwd60m!, 0) / arr.length;
      return `  ${label}: n=${arr.length} | 60m win=${w}/${arr.length} (${(w / arr.length * 100).toFixed(0)}%) | avg=${(-avg).toFixed(3)}%`;
    };

    console.log(`\n  Candle context breakdown:`);
    console.log(statLine("    With spike (≥1%)", spikeSignals));
    console.log(statLine("    Spike down       ", spikeDown));
    console.log(statLine("    No spike         ", noSpike));

    // Range quintiles
    const sorted = [...withCandle].sort((a, b) => a.candle!.range5m - b.candle!.range5m);
    const q = Math.floor(sorted.length / 3);
    if (q > 0) {
      console.log(`\n  5m range terciles:`);
      console.log(statLine("    Low range  ", sorted.slice(0, q)));
      console.log(statLine("    Mid range  ", sorted.slice(q, q * 2)));
      console.log(statLine("    High range ", sorted.slice(q * 2)));
    }
  }

  // Save signals
  ensureDir(LOG_DIR);
  const outFile = path.join(LOG_DIR, `short_signals_${symbol}.jsonl`);
  fs.writeFileSync(outFile, signals.map(s => JSON.stringify(s)).join("\n") + "\n");
  console.log(`  Saved ${signals.length} signals → ${path.relative(process.cwd(), outFile)}`);
}

// ── Live tail mode: watch market.jsonl files and log signals in real-time ──
function liveTail() {
  ensureDir(LOG_DIR);
  const logFile = path.join(LOG_DIR, "short_signals_live.jsonl");

  console.log("SHORT SIGNAL SHADOW — LIVE TAIL MODE");
  console.log(`Watching: ${SYMBOLS.join(", ")}`);
  console.log(`Config: S/B>${CFG.sbThreshold} | flow window=${CFG.flowWindow} | cooldown=${CFG.cooldownMs / 60000}min`);
  console.log(`Output: ${logFile}`);
  console.log("-".repeat(60));

  // Per-symbol state
  const state = new Map<string, {
    snaps: Snap[];
    candles: Candle1m[];
    lastSignalTs: number;
    marketFileSize: number;
    candleFileSize: number;
  }>();

  for (const sym of SYMBOLS) {
    const mFile = path.join(DATA_DIR, `${sym}_market.jsonl`);
    const cFile = path.join(DATA_DIR, `${sym}_1m.jsonl`);
    const mSize = fs.existsSync(mFile) ? fs.statSync(mFile).size : 0;
    const cSize = fs.existsSync(cFile) ? fs.statSync(cFile).size : 0;

    // Pre-load last 20 snaps for rolling window warmup
    const snaps: Snap[] = [];
    if (fs.existsSync(mFile)) {
      const content = fs.readFileSync(mFile, "utf-8");
      const lines = content.trim().split("\n");
      for (const line of lines.slice(-20)) {
        const s = parseSnap(line);
        if (s) snaps.push(s);
      }
    }

    // Pre-load last 10 candles for context warmup
    const candles: Candle1m[] = [];
    if (fs.existsSync(cFile)) {
      const content = fs.readFileSync(cFile, "utf-8");
      const lines = content.trim().split("\n");
      for (const line of lines.slice(-10)) {
        const c = parseCandle(line);
        if (c) candles.push(c);
      }
    }

    state.set(sym, { snaps, candles, lastSignalTs: 0, marketFileSize: mSize, candleFileSize: cSize });
    console.log(`  ${sym}: warmup=${snaps.length} snaps + ${candles.length} candles, watching from byte ${mSize}/${cSize}`);
  }

  // Poll every 30s for new lines
  const POLL_MS = 30_000;

  function poll() {
    for (const sym of SYMBOLS) {
      const mFile = path.join(DATA_DIR, `${sym}_market.jsonl`);
      const cFile = path.join(DATA_DIR, `${sym}_1m.jsonl`);
      if (!fs.existsSync(mFile)) continue;

      const st = state.get(sym)!;

      // Ingest new 1m candles
      if (fs.existsSync(cFile)) {
        const cCurSize = fs.statSync(cFile).size;
        if (cCurSize > st.candleFileSize) {
          const fd = fs.openSync(cFile, "r");
          const buf = Buffer.alloc(cCurSize - st.candleFileSize);
          fs.readSync(fd, buf, 0, buf.length, st.candleFileSize);
          fs.closeSync(fd);
          st.candleFileSize = cCurSize;
          for (const line of buf.toString("utf-8").trim().split("\n")) {
            const c = parseCandle(line);
            if (c) st.candles.push(c);
          }
          // Keep rolling buffer at 30 candles
          if (st.candles.length > 30) st.candles.splice(0, st.candles.length - 30);
        }
      }

      // Ingest new market snaps
      const mCurSize = fs.statSync(mFile).size;
      if (mCurSize <= st.marketFileSize) continue;

      const fd = fs.openSync(mFile, "r");
      const buf = Buffer.alloc(mCurSize - st.marketFileSize);
      fs.readSync(fd, buf, 0, buf.length, st.marketFileSize);
      fs.closeSync(fd);
      st.marketFileSize = mCurSize;

      const newLines = buf.toString("utf-8").trim().split("\n");
      for (const line of newLines) {
        const snap = parseSnap(line);
        if (!snap) continue;

        st.snaps.push(snap);
        // Keep rolling buffer at 120 snaps max
        if (st.snaps.length > 120) st.snaps.splice(0, st.snaps.length - 120);

        if (st.snaps.length < CFG.flowWindow + 1) continue;
        if (snap.tsMs - st.lastSignalTs < CFG.cooldownMs) continue;

        // Compute S/B
        const idx = st.snaps.length - 1;
        let buyV = 0, sellV = 0;
        for (let j = idx - CFG.flowWindow + 1; j <= idx; j++) {
          buyV += st.snaps[j].flow.buyVol;
          sellV += st.snaps[j].flow.sellVol;
        }
        const sb = buyV > 0 ? sellV / buyV : 0;
        if (sb < CFG.sbThreshold) continue;

        // Context
        const priceDelta5 = idx >= 4 ? ((snap.price - st.snaps[idx - 4].price) / st.snaps[idx - 4].price) * 100 : 0;
        const oiRef = idx >= 14 ? st.snaps[idx - 14] : st.snaps[0];
        const oiDelta15 = ((snap.openInterest - oiRef.openInterest) / oiRef.openInterest) * 100;

        // Candle context
        const candleCtx = st.candles.length > 0 ? computeCandleContext(st.candles, snap.tsMs) : undefined;

        const sig: ShortSignal = {
          ts: snap.ts, symbol: sym, price: snap.price,
          sb, priceDelta5, oiDelta15,
          imbalance: snap.ob.imbalance, thinSide: snap.ob.thinSide,
          fundingRate: snap.fundingRate,
          candle: candleCtx,
        };

        // Log it
        fs.appendFileSync(logFile, JSON.stringify(sig) + "\n");
        st.lastSignalTs = snap.tsMs;

        const timeStr = snap.ts.slice(11, 19);
        const spikeStr = candleCtx?.spike ? ` SPIKE ${candleCtx.spikeDir} ${candleCtx.maxRange5m.toFixed(2)}%` : "";
        console.log(`  [${timeStr}] ${sym} SHORT SIGNAL | $${snap.price.toFixed(3)} | S/B=${sb.toFixed(1)} | 5mΔ=${priceDelta5 >= 0 ? "+" : ""}${priceDelta5.toFixed(2)}% | OI15Δ=${oiDelta15.toFixed(2)}% | 1mRng=${candleCtx?.range1m.toFixed(2) ?? "?"}% | imbal=${snap.ob.imbalance.toFixed(2)}${spikeStr}`);
      }
    }
  }

  // Initial poll then interval
  poll();
  setInterval(poll, POLL_MS);
  console.log(`\nPolling every ${POLL_MS / 1000}s... (Ctrl+C to stop)`);
}

// ── Main ──
const args = process.argv.slice(2);
const replayMode = args.includes("--replay");

if (replayMode) {
  const sym = args.find(a => !a.startsWith("--"));
  const syms = sym ? [sym] : SYMBOLS;
  console.log("=".repeat(80));
  console.log("  SHORT SIGNAL SHADOW — REPLAY MODE");
  console.log(`  S/B threshold: ${CFG.sbThreshold} | Flow window: ${CFG.flowWindow} | Cooldown: ${CFG.cooldownMs / 60000}min`);
  console.log("=".repeat(80));
  for (const s of syms) replay(s);
} else {
  liveTail();
}
