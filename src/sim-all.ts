import { loadCandles } from "./fetch-candles";

const symbols = [
  "HYPEUSDT","BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","SUIUSDT","TAOUSDT",
  "STGUSDT","VVVUSDT","RIVERUSDT","SIRENUSDT","BLUAIUSDT","CUSDT","DUSKUSDT",
  "LIGHTUSDT","PIPPINUSDT"
];

const cfg = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
};

console.log("Symbol       | Days | Trades |  WR  |  Return  | MaxDD  | MinEquity | Final   | MaxPos | Alive");
console.log("-------------|------|--------|------|----------|--------|-----------|---------|--------|------");

for (const sym of symbols) {
  try {
    const candles = loadCandles(sym, "5");
    let capital = cfg.initialCapital;
    const positions: { entryPrice: number; entryTime: number; qty: number; notional: number }[] = [];
    let lastAddTime = 0, peakCap = capital, maxDD = 0, maxConc = 0, totalTrades = 0, wins = 0, minEq = capital;

    for (const c of candles) {
      if (positions.length > 0) {
        const tQty = positions.reduce((s, p) => s + p.qty, 0);
        const avg = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / tQty;
        const tp = avg * (1 + cfg.tpPct / 100);
        if (c.high >= tp) {
          for (const p of positions) {
            const pnl = (tp - p.entryPrice) * p.qty - p.notional * cfg.feeRate - tp * p.qty * cfg.feeRate;
            capital += pnl; totalTrades++; if (pnl > 0) wins++;
          }
          positions.length = 0;
        }
      }

      const ur = positions.reduce((s, p) => s + (c.close - p.entryPrice) * p.qty, 0);
      const eq = capital + ur;
      if (eq < minEq) minEq = eq;
      if (eq > peakCap) peakCap = eq;
      const dd = peakCap > 0 ? ((peakCap - eq) / peakCap) * 100 : 0;
      if (dd > maxDD) maxDD = dd;

      if (positions.length < cfg.maxPositions && (c.timestamp - lastAddTime) / 60000 >= cfg.addIntervalMin) {
        const n = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, positions.length);
        const usedM = positions.reduce((s, p) => s + p.notional / cfg.leverage, 0);
        if (capital - usedM >= n / cfg.leverage && capital > 0) {
          positions.push({ entryPrice: c.close, entryTime: c.timestamp, qty: n / c.close, notional: n });
          lastAddTime = c.timestamp;
          if (positions.length > maxConc) maxConc = positions.length;
        }
      }
    }

    if (positions.length > 0) {
      const lc = candles[candles.length - 1];
      for (const p of positions) {
        const pnl = (lc.close - p.entryPrice) * p.qty - p.notional * cfg.feeRate - lc.close * p.qty * cfg.feeRate;
        capital += pnl; totalTrades++; if (pnl > 0) wins++;
      }
      positions.length = 0;
    }

    const days = Math.round((candles[candles.length - 1].timestamp - candles[0].timestamp) / 86400000);
    const ret = ((capital / cfg.initialCapital - 1) * 100);
    const wr = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
    const surv = minEq > 0 ? "YES" : "NO ";

    console.log(
      sym.padEnd(13) + "| " +
      String(days).padStart(4) + " | " +
      String(totalTrades).padStart(6) + " | " +
      wr.toFixed(1).padStart(4) + "% | " +
      (ret.toFixed(1) + "%").padStart(8) + " | " +
      maxDD.toFixed(1).padStart(5) + "% | $" +
      minEq.toFixed(0).padStart(8) + " | $" +
      capital.toFixed(0).padStart(6) + " | " +
      String(maxConc).padStart(6) + " | " + surv
    );
  } catch (e: any) {
    console.log(sym.padEnd(13) + "| ERROR: " + (e.message || "").slice(0, 50));
  }
}
