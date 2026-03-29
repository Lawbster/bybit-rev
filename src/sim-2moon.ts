import { loadCandles, Candle } from "./fetch-candles";

// ──────────────────────────────────────────────
// Parameters — tweak these
// ──────────────────────────────────────────────
interface SimConfig {
  symbol: string;
  tpPct: number;           // take-profit % (unlevered), e.g. 1.4
  leverage: number;        // e.g. 50
  maxPositions: number;    // max concurrent open positions
  addIntervalMin: number;  // minimum minutes between adds at same level
  basePositionUsdt: number;// notional of first add in a ladder (~$16 for 2moon)
  addScaleFactor: number;  // each subsequent add is this × previous (1.32 for 2moon)
  initialCapital: number;  // wallet balance (copy-trade allocation, not full wallet)
  feeRate: number;         // taker fee per side (e.g. 0.00055 for 0.055%)
  stopLossPct: number;     // 0 = no stop, or e.g. 5 for -5% unlevered kill switch
  maxDrawdownPct: number;  // account-level kill switch, e.g. 30 for -30%
  staleHours: number;      // 0 = hold forever, or e.g. 72 = close after 72h if TP not hit
  reducedTpPct: number;    // TP% to use when closing stale (e.g. 0.9 matches 2moon's secondary cluster)
  startDate: string;       // ISO date to start sim (skip earlier candles)
  batchTp: boolean;        // true = TP on weighted avg entry of all positions (batch close)
}

const DEFAULT_CONFIG: SimConfig = {
  symbol: "HYPEUSDT",
  tpPct: 1.4,
  leverage: 50,
  maxPositions: 11,
  addIntervalMin: 30,
  basePositionUsdt: 16,    // ~$16 first add (matches 2moon data)
  addScaleFactor: 1.32,    // each add 1.32x previous (median from trade data)
  initialCapital: 100,     // best-fit: $100 cap × 497% ≈ 2moon's 463% ROI
  feeRate: 0.00055,
  stopLossPct: 0,          // 0 = no stop (matches 2moon)
  maxDrawdownPct: 0,       // 0 = no kill (2moon uses large cross-margin buffer)
  staleHours: 0,           // 0 = hold forever (matches 2moon's 100% WR)
  reducedTpPct: 0.9,       // reduced TP for stale positions
  startDate: "2026-01-20", // 2moon's first trade date
  batchTp: true,           // close entire ladder when avg entry + TP% is hit
};

// ──────────────────────────────────────────────
// Position tracking
// ──────────────────────────────────────────────
interface Position {
  entryPrice: number;
  entryTime: number;
  qty: number;           // in base asset
  tpPrice: number;
  notional: number;      // USDT value at entry
}

interface TradeResult {
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  roiPct: number;
  holdMs: number;
}

// ──────────────────────────────────────────────
// Simulator
// ──────────────────────────────────────────────
function runSim(candles: Candle[], config: SimConfig) {
  const {
    tpPct, leverage, maxPositions, addIntervalMin,
    basePositionUsdt, addScaleFactor, initialCapital, feeRate,
    stopLossPct, maxDrawdownPct,
  } = config;

  let capital = initialCapital;
  const positions: Position[] = [];
  const closedTrades: TradeResult[] = [];
  let lastAddTime = 0;

  // Tracking
  let peakCapital = capital;
  let maxDrawdown = 0;
  let maxConcurrent = 0;
  let totalFees = 0;
  let killed = false;
  let killReason = "";

  // Equity snapshots (every 100 candles for charting)
  const equitySnapshots: { ts: number; equity: number; positions: number }[] = [];

  // Filter candles by start date
  const startTs = config.startDate ? new Date(config.startDate).getTime() : 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.timestamp < startTs) continue;
    const high = c.high;
    const low = c.low;
    const close = c.close;
    const ts = c.timestamp;

    if (killed) break;

    // 1. Check TPs
    let batchClosed = false;
    if (config.batchTp && positions.length > 0) {
      // Batch TP: compute weighted avg entry, close ALL when avg + tpPct% hit
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      const avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      const batchTpPrice = avgEntry * (1 + tpPct / 100);

      if (high >= batchTpPrice) {
        // Close entire ladder at batch TP price
        for (const pos of positions) {
          const exitPrice = batchTpPrice;
          const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
          const entryFee = pos.notional * feeRate;
          const exitFee = (exitPrice * pos.qty) * feeRate;
          const pnl = pnlRaw - entryFee - exitFee;
          totalFees += entryFee + exitFee;
          capital += pnl;
          closedTrades.push({
            entryPrice: pos.entryPrice,
            exitPrice,
            entryTime: pos.entryTime,
            exitTime: ts,
            pnl,
            roiPct: (pnl / (pos.notional / leverage)) * 100,
            holdMs: ts - pos.entryTime,
          });
        }
        positions.length = 0;
        batchClosed = true;
      }
    } else {
      // Per-position TP: each position has its own TP
      const toClose: number[] = [];
      for (let j = 0; j < positions.length; j++) {
        if (high >= positions[j].tpPrice) {
          toClose.push(j);
        }
      }
      toClose.sort((a, b) => b - a);
      for (const idx of toClose) {
        const pos = positions[idx];
        const exitPrice = pos.tpPrice;
        const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
        const entryFee = pos.notional * feeRate;
        const exitFee = (exitPrice * pos.qty) * feeRate;
        const pnl = pnlRaw - entryFee - exitFee;
        totalFees += entryFee + exitFee;
        capital += pnl;
        closedTrades.push({
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: ts,
          pnl,
          roiPct: (pnl / (pos.notional / leverage)) * 100,
          holdMs: ts - pos.entryTime,
        });
        positions.splice(idx, 1);
      }
      if (toClose.length > 0 && positions.length === 0) batchClosed = true;
    }
    if (batchClosed) {
      // ladder level auto-resets since it's based on positions.length
    }

    // 2. Check stale positions — close and free slot if held too long
    if (config.staleHours > 0) {
      const staleToClose: number[] = [];
      for (let j = 0; j < positions.length; j++) {
        const heldHours = (ts - positions[j].entryTime) / 3600000;
        if (heldHours >= config.staleHours) {
          // Check if reduced TP is within this candle
          const reducedTp = positions[j].entryPrice * (1 + config.reducedTpPct / 100);
          if (high >= reducedTp) {
            // Close at reduced TP
            staleToClose.push(j);
          } else {
            // Close at market (current close) — take the loss to free up slot
            staleToClose.push(j);
          }
        }
      }
      staleToClose.sort((a, b) => b - a);
      for (const idx of staleToClose) {
        const pos = positions[idx];
        const reducedTp = pos.entryPrice * (1 + config.reducedTpPct / 100);
        const exitPrice = high >= reducedTp ? reducedTp : close;
        const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
        const fees = pos.notional * feeRate + Math.abs(exitPrice * pos.qty) * feeRate;
        capital += pnlRaw - fees;
        totalFees += fees;
        closedTrades.push({
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: ts,
          pnl: pnlRaw - fees,
          roiPct: ((pnlRaw - fees) / (pos.notional / leverage)) * 100,
          holdMs: ts - pos.entryTime,
        });
        positions.splice(idx, 1);
      }
      // Reset ladder if stale cleanup emptied everything
      // ladder level auto-resets since it's based on positions.length
    }

    // 3. Check per-position stop loss
    if (stopLossPct > 0) {
      const slToClose: number[] = [];
      for (let j = 0; j < positions.length; j++) {
        const slPrice = positions[j].entryPrice * (1 - stopLossPct / 100);
        if (low <= slPrice) {
          slToClose.push(j);
        }
      }
      slToClose.sort((a, b) => b - a);
      for (const idx of slToClose) {
        const pos = positions[idx];
        const exitPrice = pos.entryPrice * (1 - stopLossPct / 100);
        const pnlRaw = (exitPrice - pos.entryPrice) * pos.qty;
        const entryFee = pos.notional * feeRate;
        const exitFee = Math.abs(exitPrice * pos.qty) * feeRate;
        const pnl = pnlRaw - entryFee - exitFee;
        totalFees += entryFee + exitFee;

        capital += pnl;
        closedTrades.push({
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: ts,
          pnl,
          roiPct: (pnl / (pos.notional / leverage)) * 100,
          holdMs: ts - pos.entryTime,
        });
        positions.splice(idx, 1);
      }
    }

    // 3. Check account-level drawdown kill switch
    const unrealizedPnl = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
    const equity = capital + unrealizedPnl;

    if (equity > peakCapital) peakCapital = equity;
    const dd = ((peakCapital - equity) / peakCapital) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (maxDrawdownPct > 0 && dd >= maxDrawdownPct) {
      // Force close everything
      for (const pos of positions) {
        const pnlRaw = (close - pos.entryPrice) * pos.qty;
        const fees = pos.notional * feeRate + Math.abs(close * pos.qty) * feeRate;
        capital += pnlRaw - fees;
        totalFees += fees;
        closedTrades.push({
          entryPrice: pos.entryPrice,
          exitPrice: close,
          entryTime: pos.entryTime,
          exitTime: ts,
          pnl: pnlRaw - fees,
          roiPct: ((pnlRaw - fees) / (pos.notional / leverage)) * 100,
          holdMs: ts - pos.entryTime,
        });
      }
      positions.length = 0;
      killed = true;
      killReason = `Account drawdown hit ${dd.toFixed(1)}% at ${new Date(ts).toISOString().slice(0, 16)}`;
      break;
    }

    // 4. Open new position if allowed (Martingale DCA scaling)
    const timeSinceLastAdd = (ts - lastAddTime) / 60000;
    if (positions.length < maxPositions && timeSinceLastAdd >= addIntervalMin) {
      // Scale based on current open count (not cumulative) — resets naturally as positions close
      const level = positions.length;  // 0 when empty, grows with each open pos
      const positionSizeUsdt = basePositionUsdt * Math.pow(addScaleFactor, level);
      const marginNeeded = positionSizeUsdt / leverage;
      const usedMargin = positions.reduce((s, p) => s + p.notional / leverage, 0);
      const availableMargin = capital - usedMargin;

      if (availableMargin >= marginNeeded && capital > 0) {
        const qty = positionSizeUsdt / close;
        positions.push({
          entryPrice: close,
          entryTime: ts,
          qty,
          tpPrice: close * (1 + tpPct / 100),
          notional: positionSizeUsdt,
        });
        lastAddTime = ts;
        if (positions.length > maxConcurrent) maxConcurrent = positions.length;
      }
    }

    // Snapshot every 100 candles
    if (i % 100 === 0) {
      const ur = positions.reduce((s, p) => s + (close - p.entryPrice) * p.qty, 0);
      equitySnapshots.push({ ts, equity: capital + ur, positions: positions.length });
    }
  }

  // Force close remaining at last candle
  if (positions.length > 0 && !killed) {
    const lastClose = candles[candles.length - 1].close;
    const lastTs = candles[candles.length - 1].timestamp;
    for (const pos of positions) {
      const pnlRaw = (lastClose - pos.entryPrice) * pos.qty;
      const fees = pos.notional * feeRate + Math.abs(lastClose * pos.qty) * feeRate;
      capital += pnlRaw - fees;
      totalFees += fees;
      closedTrades.push({
        entryPrice: pos.entryPrice,
        exitPrice: lastClose,
        entryTime: pos.entryTime,
        exitTime: lastTs,
        pnl: pnlRaw - fees,
        roiPct: ((pnlRaw - fees) / (pos.notional / leverage)) * 100,
        holdMs: lastTs - pos.entryTime,
      });
    }
    positions.length = 0;
  }

  return { closedTrades, capital, totalFees, maxDrawdown, maxConcurrent, killed, killReason, equitySnapshots, peakCapital };
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
function main() {
  const config = { ...DEFAULT_CONFIG };

  // Parse CLI args
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split("=");
    if (k && v && k in config) {
      (config as any)[k] = v === "true" ? true : v === "false" ? false : isNaN(Number(v)) ? v : Number(v);
    }
  }

  console.log(`\n=== 2MOON DCA LADDER SIM ===`);
  console.log(`Config:`, JSON.stringify(config, null, 2));

  const candles = loadCandles(config.symbol, "5");
  console.log(`\nLoaded ${candles.length} candles (${new Date(candles[0].timestamp).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].timestamp).toISOString().slice(0, 10)})`);
  console.log(`Price range: $${Math.min(...candles.map((c) => c.low)).toFixed(2)} → $${Math.max(...candles.map((c) => c.high)).toFixed(2)}`);

  const result = runSim(candles, config);
  const { closedTrades, capital, totalFees, maxDrawdown, maxConcurrent, killed, killReason, peakCapital } = result;

  // Results
  const wins = closedTrades.filter((t) => t.pnl > 0);
  const losses = closedTrades.filter((t) => t.pnl <= 0);
  const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const holdHours = closedTrades.map((t) => t.holdMs / 3600000);
  holdHours.sort((a, b) => a - b);

  console.log(`\n${"=".repeat(70)}`);
  console.log("RESULTS");
  console.log("=".repeat(70));
  console.log(`Total trades:     ${closedTrades.length}`);
  console.log(`Winners:          ${wins.length} (${((wins.length / closedTrades.length) * 100).toFixed(1)}%)`);
  console.log(`Losers:           ${losses.length} (${((losses.length / closedTrades.length) * 100).toFixed(1)}%)`);
  console.log(`Total PnL:        $${totalPnl.toFixed(2)}`);
  console.log(`Total fees:       $${totalFees.toFixed(2)}`);
  console.log(`Final capital:    $${capital.toFixed(2)} (${((capital / config.initialCapital - 1) * 100).toFixed(1)}% return)`);
  console.log(`Peak capital:     $${peakCapital.toFixed(2)}`);
  console.log(`Max drawdown:     ${maxDrawdown.toFixed(1)}%`);
  console.log(`Max concurrent:   ${maxConcurrent}`);
  if (killed) console.log(`KILLED:           ${killReason}`);

  console.log(`\nHold time (hours): med ${holdHours[Math.floor(holdHours.length / 2)]?.toFixed(1)} | avg ${(holdHours.reduce((s, v) => s + v, 0) / holdHours.length).toFixed(1)} | max ${holdHours[holdHours.length - 1]?.toFixed(1)}`);

  if (wins.length > 0) {
    const winPnls = wins.map((t) => t.pnl);
    console.log(`Avg win:          $${(winPnls.reduce((s, v) => s + v, 0) / winPnls.length).toFixed(3)}`);
  }
  if (losses.length > 0) {
    const lossPnls = losses.map((t) => t.pnl);
    console.log(`Avg loss:         $${(lossPnls.reduce((s, v) => s + v, 0) / lossPnls.length).toFixed(3)}`);
    console.log(`Worst loss:       $${Math.min(...lossPnls).toFixed(3)}`);
  }

  // Monthly breakdown
  console.log(`\n${"=".repeat(70)}`);
  console.log("MONTHLY BREAKDOWN");
  console.log("=".repeat(70));
  const byMonth: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of closedTrades) {
    const m = new Date(t.exitTime).toISOString().slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { trades: 0, pnl: 0, wins: 0 };
    byMonth[m].trades++;
    byMonth[m].pnl += t.pnl;
    if (t.pnl > 0) byMonth[m].wins++;
  }
  for (const [m, v] of Object.entries(byMonth).sort()) {
    console.log(`  ${m}: ${String(v.trades).padStart(4)} trades | PnL: $${v.pnl.toFixed(2).padStart(8)} | WR: ${((v.wins / v.trades) * 100).toFixed(0)}%`);
  }

  // Equity curve summary (start, worst, end)
  const eqSnaps = result.equitySnapshots;
  if (eqSnaps.length > 0) {
    const worstEq = Math.min(...eqSnaps.map((s) => s.equity));
    const worstTime = eqSnaps.find((s) => s.equity === worstEq);
    console.log(`\nEquity curve: $${config.initialCapital} → low $${worstEq.toFixed(2)} (${worstTime ? new Date(worstTime.ts).toISOString().slice(0, 10) : "?"}) → final $${capital.toFixed(2)}`);
  }

  // Compare with different configs
  console.log(`\n${"=".repeat(70)}`);
  console.log("SENSITIVITY ANALYSIS");
  console.log("=".repeat(70));

  // Grid search: find best ROI with MaxDD < 100% (survivable)
  interface GridResult {
    label: string;
    trades: number;
    wr: number;
    pnl: number;
    ret: number;
    maxDD: number;
    minEquity: number;
    killed: boolean;
  }

  const results: GridResult[] = [];

  // Search across key dimensions
  const tpValues = [0.8, 1.0, 1.2, 1.4, 1.6];
  const capValues = [100, 150, 200, 300, 500];
  const scaleValues = [1.0, 1.1, 1.2, 1.32];
  const maxPosValues = [5, 7, 9, 11];
  const intervalValues = [20, 30, 45, 60];

  // Full grid would be 5*5*4*4*4=1600 combos — too slow
  // Do targeted sweeps instead

  // Sweep 1: TP × capital (hold other params at base)
  console.log("\n  --- TP% × Capital ---");
  console.log(`  ${"Config".padEnd(28)} Trades   WR   PnL        Return    MaxDD   MinEq`);
  for (const tp of tpValues) {
    for (const cap of capValues) {
      const tc = { ...config, tpPct: tp, initialCapital: cap };
      const r = runSim(candles, tc);
      const t = r.closedTrades;
      const wr = t.length > 0 ? (t.filter(x => x.pnl > 0).length / t.length) * 100 : 0;
      const pnl = t.reduce((s, x) => s + x.pnl, 0);
      const ret = ((r.capital / cap - 1) * 100);
      const minEq = r.equitySnapshots.length > 0 ? Math.min(...r.equitySnapshots.map(s => s.equity)) : cap;
      const label = `TP${tp}% $${cap}`;
      const flag = minEq > 0 && ret > 400 ? " ★" : minEq > 0 && ret > 200 ? " ✓" : minEq <= 0 ? " ⚠" : "";
      console.log(`  ${label.padEnd(28)} ${String(t.length).padStart(5)}  ${wr.toFixed(0).padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.toFixed(0).padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${minEq.toFixed(0).padStart(6)}${flag}`);
    }
  }

  // Sweep 2: Scale × MaxPositions (best TP from above, cap=200)
  console.log("\n  --- Scale × MaxPositions (TP 1.4%, $200 cap) ---");
  console.log(`  ${"Config".padEnd(28)} Trades   WR   PnL        Return    MaxDD   MinEq`);
  for (const scale of scaleValues) {
    for (const maxPos of maxPosValues) {
      const tc = { ...config, addScaleFactor: scale, maxPositions: maxPos, initialCapital: 200 };
      const r = runSim(candles, tc);
      const t = r.closedTrades;
      const wr = t.length > 0 ? (t.filter(x => x.pnl > 0).length / t.length) * 100 : 0;
      const pnl = t.reduce((s, x) => s + x.pnl, 0);
      const ret = ((r.capital / 200 - 1) * 100);
      const minEq = r.equitySnapshots.length > 0 ? Math.min(...r.equitySnapshots.map(s => s.equity)) : 200;
      const label = `×${scale} max${maxPos}`;
      const flag = minEq > 0 && ret > 200 ? " ★" : minEq > 0 ? " ✓" : minEq <= 0 ? " ⚠" : "";
      console.log(`  ${label.padEnd(28)} ${String(t.length).padStart(5)}  ${wr.toFixed(0).padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.toFixed(0).padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${minEq.toFixed(0).padStart(6)}${flag}`);
    }
  }

  // Sweep 3: Add interval × stale timeout
  console.log("\n  --- Interval × Stale (TP 1.4%, $200 cap, ×1.32, max 11) ---");
  console.log(`  ${"Config".padEnd(28)} Trades   WR   PnL        Return    MaxDD   MinEq`);
  for (const interval of intervalValues) {
    for (const stale of [0, 24, 48, 72]) {
      const tc = { ...config, addIntervalMin: interval, staleHours: stale, initialCapital: 200 };
      const r = runSim(candles, tc);
      const t = r.closedTrades;
      const wr = t.length > 0 ? (t.filter(x => x.pnl > 0).length / t.length) * 100 : 0;
      const pnl = t.reduce((s, x) => s + x.pnl, 0);
      const ret = ((r.capital / 200 - 1) * 100);
      const minEq = r.equitySnapshots.length > 0 ? Math.min(...r.equitySnapshots.map(s => s.equity)) : 200;
      const label = `${interval}m stale${stale}h`;
      const flag = minEq > 0 && ret > 200 ? " ★" : minEq > 0 ? " ✓" : minEq <= 0 ? " ⚠" : "";
      console.log(`  ${label.padEnd(28)} ${String(t.length).padStart(5)}  ${wr.toFixed(0).padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.toFixed(0).padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${minEq.toFixed(0).padStart(6)}${flag}`);
    }
  }

  // Best survivable combos
  console.log("\n  --- Best combos (no negative equity, target 400%+ ROI) ---");
  console.log(`  ${"Config".padEnd(44)} Trades   WR   PnL        Return    MaxDD   MinEq`);
  const combos: [string, Partial<SimConfig>][] = [
    ["2Moon replica (base)", {}],
    ["Conservative: ×1.1 max7 $300", { addScaleFactor: 1.1, maxPositions: 7, initialCapital: 300 }],
    ["Moderate: ×1.2 max9 $200", { addScaleFactor: 1.2, maxPositions: 9, initialCapital: 200 }],
    ["Aggressive: ×1.32 max11 $150", { addScaleFactor: 1.32, maxPositions: 11, initialCapital: 150 }],
    ["Safe high-freq: ×1.0 max11 stale48 $100", { addScaleFactor: 1.0, maxPositions: 11, staleHours: 48, initialCapital: 100 }],
    ["Scalp: TP0.8 ×1.2 max9 stale24 $200", { tpPct: 0.8, addScaleFactor: 1.2, maxPositions: 9, staleHours: 24, initialCapital: 200 }],
    ["Wide TP: TP2.0 ×1.1 max7 $200", { tpPct: 2.0, addScaleFactor: 1.1, maxPositions: 7, initialCapital: 200 }],
    ["Balanced: TP1.2 ×1.2 max9 60m $200", { tpPct: 1.2, addScaleFactor: 1.2, maxPositions: 9, addIntervalMin: 60, initialCapital: 200 }],
    ["Max safe: TP1.4 ×1.2 max11 $250", { tpPct: 1.4, addScaleFactor: 1.2, maxPositions: 11, initialCapital: 250 }],
  ];
  for (const [label, overrides] of combos) {
    const tc = { ...config, ...overrides };
    const r = runSim(candles, tc);
    const t = r.closedTrades;
    const wr = t.length > 0 ? (t.filter(x => x.pnl > 0).length / t.length) * 100 : 0;
    const pnl = t.reduce((s, x) => s + x.pnl, 0);
    const ret = ((r.capital / tc.initialCapital - 1) * 100);
    const minEq = r.equitySnapshots.length > 0 ? Math.min(...r.equitySnapshots.map(s => s.equity)) : tc.initialCapital;
    const flag = minEq > 0 && ret > 400 ? " ★★" : minEq > 0 && ret > 200 ? " ★" : minEq > 0 ? " ✓" : " ⚠";
    console.log(`  ${label.padEnd(44)} ${String(t.length).padStart(5)}  ${wr.toFixed(0).padStart(3)}%  $${pnl.toFixed(0).padStart(7)}  ${ret.toFixed(0).padStart(6)}%  ${r.maxDrawdown.toFixed(0).padStart(5)}%  $${minEq.toFixed(0).padStart(6)}${flag}`);
  }
}

main();
