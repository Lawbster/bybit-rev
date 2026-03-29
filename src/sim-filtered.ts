import { loadCandles, Candle } from "./fetch-candles";
import {
  FilterConfig, DEFAULT_FILTERS, FilterState,
  buildFilterState, isLadderKilled,
} from "./regime-filters";

// ─────────────────────────────────────────────
// Filtered DCA Ladder Sim
// Option C baseline + regime filters
// ─────────────────────────────────────────────

interface SimConfig {
  tpPct: number;
  leverage: number;
  maxPositions: number;
  addIntervalMin: number;
  basePositionUsdt: number;
  addScaleFactor: number;
  initialCapital: number;
  feeRate: number;
  startDate: string;
  batchTp: boolean;
}

// Option C baseline
const SIM_CONFIG: SimConfig = {
  tpPct: 1.4,
  leverage: 50,
  maxPositions: 11,
  addIntervalMin: 30,
  basePositionUsdt: 800,
  addScaleFactor: 1.20,
  initialCapital: 5000,
  feeRate: 0.00055,
  startDate: "2026-01-20",
  batchTp: true,
};

interface Pos {
  entryPrice: number;
  entryTime: number;
  qty: number;
  notional: number;
}

interface TradeResult {
  pnl: number;
  holdMs: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  filtered: boolean;  // was this trade opened during a filtered period? (should be false)
}

function runSim(
  candles: Candle[],
  cfg: SimConfig,
  filterState: FilterState | null,
  filterCfg: FilterConfig | null,
) {
  let capital = cfg.initialCapital;
  const positions: Pos[] = [];
  const trades: TradeResult[] = [];
  let lastAddTime = 0;
  let peak = capital, maxDD = 0, maxConc = 0, totalFees = 0, minEq = capital;
  let blockedAdds = 0;
  let ladderKillBlocks = 0;

  const startTs = new Date(cfg.startDate).getTime();
  const snapshots: { ts: number; equity: number; positions: number; blocked: boolean }[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const { high, low, close, timestamp: ts } = c;

    // ── 1. Batch TP ──
    if (cfg.batchTp && positions.length > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const tp = avgEntry * (1 + cfg.tpPct / 100);

      if (high >= tp) {
        for (const p of positions) {
          const pnl = (tp - p.entryPrice) * p.qty - p.notional * cfg.feeRate - tp * p.qty * cfg.feeRate;
          capital += pnl;
          totalFees += p.notional * cfg.feeRate + tp * p.qty * cfg.feeRate;
          trades.push({ pnl, holdMs: ts - p.entryTime, exitTime: ts, entryPrice: p.entryPrice, exitPrice: tp, filtered: false });
        }
        positions.length = 0;
      }
    }

    // ── 2. Equity tracking ──
    const ur = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const eq = capital + ur;
    if (eq < minEq) minEq = eq;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // ── 3. Check filters before opening new position ──
    const timeSinceLastAdd = (ts - lastAddTime) / 60000;
    let canOpen = positions.length < cfg.maxPositions && timeSinceLastAdd >= cfg.addIntervalMin;

    let isBlocked = false;
    let blockReasons: string[] = [];

    if (canOpen && filterState) {
      const reasons = filterState.blocked.get(ts);
      if (reasons && reasons.length > 0) {
        canOpen = false;
        isBlocked = true;
        blockReasons = reasons;
        blockedAdds++;
      }
    }

    // Ladder-local kill (runtime check)
    if (canOpen && filterCfg && isLadderKilled(filterCfg, positions, close, ts)) {
      canOpen = false;
      isBlocked = true;
      blockReasons.push("ladder_local");
      ladderKillBlocks++;
    }

    // ── 4. Open new position ──
    if (canOpen) {
      const sz = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, positions.length);
      const margin = sz / cfg.leverage;
      const usedMargin = positions.reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - usedMargin >= margin && capital > 0) {
        positions.push({ entryPrice: close, entryTime: ts, qty: sz / close, notional: sz });
        lastAddTime = ts;
        if (positions.length > maxConc) maxConc = positions.length;
      }
    }

    // Snapshot every 100 candles
    if (i % 100 === 0) {
      snapshots.push({ ts, equity: eq, positions: positions.length, blocked: isBlocked });
    }
  }

  // Force close remaining
  if (positions.length > 0) {
    const last = candles[candles.length - 1];
    for (const p of positions) {
      const pnl = (last.close - p.entryPrice) * p.qty - p.notional * cfg.feeRate - Math.abs(last.close * p.qty) * cfg.feeRate;
      capital += pnl;
      trades.push({ pnl, holdMs: 0, exitTime: last.timestamp, entryPrice: p.entryPrice, exitPrice: last.close, filtered: false });
    }
  }

  return { trades, capital, maxDD, minEq, maxConc, totalFees, blockedAdds, ladderKillBlocks, snapshots };
}

// ─── Main ───
function main() {
  console.log("\n=== FILTERED DCA LADDER SIM ===\n");

  // Load candle data
  const hype5m = loadCandles("HYPEUSDT", "5");
  const btc5m = loadCandles("BTCUSDT", "5");
  const eth5m = loadCandles("ETHUSDT", "5");

  console.log(`Data: HYPE ${hype5m.length} | BTC ${btc5m.length} | ETH ${eth5m.length} 5m candles`);
  console.log(`Period: ${new Date(hype5m[0].timestamp).toISOString().slice(0, 10)} → ${new Date(hype5m[hype5m.length - 1].timestamp).toISOString().slice(0, 10)}`);

  const cfg = { ...SIM_CONFIG };

  // Parse CLI overrides
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split("=");
    if (k && v && k in cfg) {
      (cfg as any)[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
    }
  }

  console.log(`\nSim config:`, JSON.stringify(cfg, null, 2));

  // ── Run unfiltered baseline ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("1. UNFILTERED BASELINE (Option C: $800 ×1.20)");
  console.log("═".repeat(80));

  const rUnfilt = runSim(hype5m, cfg, null, null);
  printResult("Unfiltered", cfg, rUnfilt);

  // ── Build filter state ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("2. FILTER COVERAGE");
  console.log("═".repeat(80));

  const filterCfg = { ...DEFAULT_FILTERS };
  const filterState = buildFilterState(hype5m, btc5m, eth5m, filterCfg);

  console.log(`\nFilter config:`, JSON.stringify(filterCfg, null, 2));
  console.log(`\nTotal 5m candles: ${filterState.totalCandles}`);
  console.log(`Blocked candles:  ${filterState.blockedCandles} (${((filterState.blockedCandles / filterState.totalCandles) * 100).toFixed(1)}%)`);
  console.log(`Filter breakdown:`);
  for (const [name, count] of Object.entries(filterState.filterCounts)) {
    console.log(`  ${name.padEnd(20)} ${count} candles (${((count / filterState.totalCandles) * 100).toFixed(1)}%)`);
  }

  // ── Run with all filters ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("3. FILTERED (all filters active)");
  console.log("═".repeat(80));

  const rFilt = runSim(hype5m, cfg, filterState, filterCfg);
  printResult("All filters", cfg, rFilt);

  // ── Run with individual filters ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("4. INDIVIDUAL FILTER IMPACT");
  console.log("═".repeat(80));
  console.log(`${"Filter".padEnd(30)} Trades   WR    PnL       Ret    DD   MinEq  Blocked`);

  const filterVariants: [string, Partial<FilterConfig>][] = [
    ["No filters (baseline)", { marketRiskOff: false, trendBreak: false, volExpansion: false, ladderLocalKill: false }],
    ["A: Market risk-off only", { marketRiskOff: true, trendBreak: false, volExpansion: false, ladderLocalKill: false }],
    ["B: Trend-break only", { marketRiskOff: false, trendBreak: true, volExpansion: false, ladderLocalKill: false }],
    ["C: Vol expansion only", { marketRiskOff: false, trendBreak: false, volExpansion: true, ladderLocalKill: false }],
    ["D: Ladder-local only", { marketRiskOff: false, trendBreak: false, volExpansion: false, ladderLocalKill: true }],
    ["A+B: Risk-off + Trend", { marketRiskOff: true, trendBreak: true, volExpansion: false, ladderLocalKill: false }],
    ["A+B+C: Risk+Trend+Vol", { marketRiskOff: true, trendBreak: true, volExpansion: true, ladderLocalKill: false }],
    ["All filters (A+B+C+D)", {}],
  ];

  for (const [label, overrides] of filterVariants) {
    const fc = { ...DEFAULT_FILTERS, ...overrides };
    const fs = buildFilterState(hype5m, btc5m, eth5m, fc);
    const r = runSim(hype5m, cfg, fs, fc);
    const t = r.trades;
    const wins = t.filter(x => x.pnl > 0).length;
    const wr = t.length > 0 ? ((wins / t.length) * 100).toFixed(0) : "0";
    const pnl = t.reduce((s, x) => s + x.pnl, 0);
    const ret = ((r.capital / cfg.initialCapital - 1) * 100).toFixed(0);
    console.log(`  ${label.padEnd(30)}${String(t.length).padStart(5)}  ${wr.padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.padStart(5)}%  ${r.maxDD.toFixed(0).padStart(4)}%  $${r.minEq.toFixed(0).padStart(6)}  ${r.blockedAdds + r.ladderKillBlocks}`);
  }

  // ── Filter parameter sensitivity ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("5. FILTER SENSITIVITY (all filters on, varying thresholds)");
  console.log("═".repeat(80));
  console.log(`${"Config".padEnd(40)} Trades   WR    PnL       Ret    DD   MinEq`);

  const sensitivities: [string, Partial<FilterConfig>][] = [
    // Market risk-off thresholds
    ["BTC drop -2% (stricter)", { btcDropPct: -2 }],
    ["BTC drop -3% (base)", {}],
    ["BTC drop -5% (looser)", { btcDropPct: -5 }],
    ["Cooldown 60m", { riskOffCooldownMin: 60 }],
    ["Cooldown 120m (base)", {}],
    ["Cooldown 240m", { riskOffCooldownMin: 240 }],
    // ATR multiplier
    ["ATR mult 1.5 (stricter)", { atrMultiplier: 1.5 }],
    ["ATR mult 1.8 (base)", {}],
    ["ATR mult 2.5 (looser)", { atrMultiplier: 2.5 }],
    // Ladder local
    ["Underwater 6h / -2%", { maxUnderwaterHours: 6, maxUnderwaterPct: -2 }],
    ["Underwater 12h / -3% (base)", {}],
    ["Underwater 24h / -5%", { maxUnderwaterHours: 24, maxUnderwaterPct: -5 }],
    // Trend EMA
    ["Trend EMA 100/30", { trendEmaLong: 100, trendEmaShort: 30 }],
    ["Trend EMA 200/50 (base)", {}],
  ];

  for (const [label, overrides] of sensitivities) {
    const fc = { ...DEFAULT_FILTERS, ...overrides };
    const fs = buildFilterState(hype5m, btc5m, eth5m, fc);
    const r = runSim(hype5m, cfg, fs, fc);
    const t = r.trades;
    const wins = t.filter(x => x.pnl > 0).length;
    const wr = t.length > 0 ? ((wins / t.length) * 100).toFixed(0) : "0";
    const pnl = t.reduce((s, x) => s + x.pnl, 0);
    const ret = ((r.capital / cfg.initialCapital - 1) * 100).toFixed(0);
    console.log(`  ${label.padEnd(40)}${String(t.length).padStart(5)}  ${wr.padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.padStart(5)}%  ${r.maxDD.toFixed(0).padStart(4)}%  $${r.minEq.toFixed(0).padStart(6)}`);
  }

  // ── Monthly comparison ──
  console.log(`\n${"═".repeat(80)}`);
  console.log("6. MONTHLY COMPARISON (unfiltered vs filtered)");
  console.log("═".repeat(80));

  const months = new Set<string>();
  for (const t of [...rUnfilt.trades, ...rFilt.trades]) {
    months.add(new Date(t.exitTime).toISOString().slice(0, 7));
  }

  console.log(`${"Month".padEnd(10)} ${"Unfilt Trades".padEnd(14)} ${"Unfilt PnL".padEnd(12)} ${"Filt Trades".padEnd(14)} ${"Filt PnL".padEnd(12)} Δ PnL`);
  for (const m of [...months].sort()) {
    const uTrades = rUnfilt.trades.filter(t => new Date(t.exitTime).toISOString().slice(0, 7) === m);
    const fTrades = rFilt.trades.filter(t => new Date(t.exitTime).toISOString().slice(0, 7) === m);
    const uPnl = uTrades.reduce((s, t) => s + t.pnl, 0);
    const fPnl = fTrades.reduce((s, t) => s + t.pnl, 0);
    const delta = fPnl - uPnl;
    console.log(`  ${m.padEnd(10)}${String(uTrades.length).padStart(5)} trades  $${uPnl.toFixed(0).padStart(8)}  ${String(fTrades.length).padStart(5)} trades  $${fPnl.toFixed(0).padStart(8)}  ${delta >= 0 ? "+" : ""}$${delta.toFixed(0)}`);
  }
}

function printResult(label: string, cfg: SimConfig, r: ReturnType<typeof runSim>) {
  const t = r.trades;
  const wins = t.filter(x => x.pnl > 0).length;
  const losses = t.length - wins;
  const pnl = t.reduce((s, x) => s + x.pnl, 0);
  const ret = ((r.capital / cfg.initialCapital - 1) * 100);
  const holdHours = t.filter(x => x.holdMs > 0).map(x => x.holdMs / 3600000);
  holdHours.sort((a, b) => a - b);

  console.log(`\n  ${label}:`);
  console.log(`  Trades:       ${t.length} (${wins}W / ${losses}L = ${t.length > 0 ? ((wins/t.length)*100).toFixed(0) : 0}% WR)`);
  console.log(`  PnL:          $${pnl.toFixed(2)}`);
  console.log(`  Return:       ${ret.toFixed(1)}%`);
  console.log(`  Max DD:       ${r.maxDD.toFixed(1)}%`);
  console.log(`  Min equity:   $${r.minEq.toFixed(0)}`);
  console.log(`  Max conc:     ${r.maxConc}`);
  console.log(`  Fees:         $${r.totalFees.toFixed(0)}`);
  if (r.blockedAdds > 0) console.log(`  Blocked adds: ${r.blockedAdds} (filter) + ${r.ladderKillBlocks} (ladder-local)`);
  if (holdHours.length > 0) {
    console.log(`  Hold time:    med ${holdHours[Math.floor(holdHours.length / 2)]?.toFixed(1)}h | avg ${(holdHours.reduce((s,v)=>s+v,0)/holdHours.length).toFixed(1)}h`);
  }
}

main();
