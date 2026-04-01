import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Detailed trade-by-trade log for Jan-Feb 2025
// Show every ladder open/close so we can see what happens
// ─────────────────────────────────────────────

interface Cfg {
  tpPct: number; leverage: number; maxPositions: number; addIntervalMin: number;
  basePositionUsdt: number; addScaleFactor: number; initialCapital: number; feeRate: number;
  startDate: string; staleHours: number; reducedTpPct: number; hardFlattenHours: number;
  hardFlattenPct: number; emergencyKillPct: number; fundingRate8h: number;
}

function buildTrendGate(candles: Candle[]) {
  const period = 4 * 3600000;
  const bars: { ts: number; close: number }[] = [];
  let curBar = -1, lastClose = 0, lastTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) { if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose }); curBar = bar; }
    lastClose = c.close; lastTs = c.timestamp;
  }
  if (curBar !== -1) bars.push({ ts: lastTs, close: lastClose });
  const ema = (d: number[], p: number) => { const k = 2 / (p + 1); const r = [d[0]]; for (let i = 1; i < d.length; i++) r.push(d[i] * k + r[i - 1] * (1 - k)); return r; };
  const closes = bars.map(b => b.close), e200 = ema(closes, 200), e50 = ema(closes, 50);
  const hostile = new Map<number, boolean>();
  for (let i = 1; i < bars.length; i++) {
    hostile.set(Math.floor(bars[i].ts / period) * period, closes[i] < e200[i] && e50[i] < e50[i - 1]);
  }
  return hostile;
}

function isHostile(gate: Map<number, boolean>, ts: number) {
  const p = 4 * 3600000;
  return gate.get(Math.floor(ts / p) * p - p) ?? false;
}

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

const cfg: Cfg = {
  tpPct: 1.4, leverage: 50, maxPositions: 11, addIntervalMin: 30,
  basePositionUsdt: 800, addScaleFactor: 1.2, initialCapital: 5000, feeRate: 0.00055,
  startDate: "2025-01-20",
  staleHours: 8, reducedTpPct: 0.3,
  hardFlattenHours: 40, hardFlattenPct: -6, emergencyKillPct: -10,
  fundingRate8h: 0.0001,
};

const gate = buildTrendGate(candles);
let capital = cfg.initialCapital, peakCap = capital;
const pos: { ep: number; et: number; qty: number; notional: number }[] = [];
let lastAdd = 0;
const startTs = new Date(cfg.startDate).getTime();
const endTs = new Date("2025-03-15").getTime(); // just Jan-Feb-early Mar

let ladderNum = 0;

console.log("=".repeat(120));
console.log("  TRADE-BY-TRADE LOG: Jan 20 - Mar 15, 2025 (Config B: 8h/0.3%, $5K start)");
console.log("=".repeat(120));
console.log(`  Starting capital: $${cfg.initialCapital}\n`);

for (let i = 0; i < candles.length; i++) {
  const c = candles[i];
  if (c.timestamp < startTs) continue;
  if (c.timestamp > endTs) break;
  const { close, high, timestamp: ts } = c;

  if (pos.length > 0) {
    const tQty = pos.reduce((s, p) => s + p.qty, 0);
    const avgE = pos.reduce((s, p) => s + p.ep * p.qty, 0) / tQty;
    const avgPnl = ((close - avgE) / avgE) * 100;
    const oldH = (ts - pos[0].et) / 3600000;
    const isStale = cfg.staleHours > 0 && oldH >= cfg.staleHours && avgPnl < 0;
    const tp = isStale ? cfg.reducedTpPct : cfg.tpPct;
    const tpPrice = avgE * (1 + tp / 100);
    const totalNot = pos.reduce((s, p) => s + p.notional, 0);

    let exitType = "";
    let exitPrice = 0;

    if (high >= tpPrice) {
      exitType = isStale ? "STALE TP" : "TP";
      exitPrice = tpPrice;
    } else if (cfg.emergencyKillPct !== 0 && avgPnl <= cfg.emergencyKillPct) {
      exitType = "EM KILL";
      exitPrice = close;
    } else if (cfg.hardFlattenHours > 0 && oldH >= cfg.hardFlattenHours && avgPnl <= cfg.hardFlattenPct && isHostile(gate, ts)) {
      exitType = "HARD FLAT";
      exitPrice = close;
    }

    if (exitType) {
      let netPnl = 0;
      for (const p of pos) {
        const raw = (exitPrice - p.ep) * p.qty;
        const fees = p.notional * cfg.feeRate + exitPrice * p.qty * cfg.feeRate;
        const holdMs = ts - p.et;
        const fund = p.notional * cfg.fundingRate8h * (holdMs / (8 * 3600000));
        netPnl += raw - fees - fund;
        capital += raw - fees - fund;
      }
      const d = new Date(ts).toISOString().slice(0, 16);
      const openD = new Date(pos[0].et).toISOString().slice(0, 16);
      const pctMove = ((exitPrice - avgE) / avgE * 100).toFixed(2);
      const held = ((ts - pos[0].et) / 3600000).toFixed(1);

      const marker = exitType === "EM KILL" ? "  <<<< EMERGENCY KILL" :
                     exitType === "HARD FLAT" ? "  <<<< HARD FLATTEN" :
                     exitType === "STALE TP" ? "  (stale)" : "";

      console.log(`  #${String(ladderNum).padStart(3)} CLOSE ${d} | ${exitType.padEnd(9)} | ${pos.length} pos, $${totalNot.toFixed(0)} notional | avg entry $${avgE.toFixed(2)} → exit $${exitPrice.toFixed(2)} (${pctMove}%) | held ${held}h | PnL: $${netPnl.toFixed(0)} | Capital: $${capital.toFixed(0)}${marker}`);

      pos.length = 0;
      continue;
    }
  }

  const gap = (ts - lastAdd) / 60000;
  if (pos.length < cfg.maxPositions && gap >= cfg.addIntervalMin) {
    if (isHostile(gate, ts)) {
      // silently blocked
    } else {
      const lvl = pos.length;
      const notional = cfg.basePositionUsdt * Math.pow(cfg.addScaleFactor, lvl);
      const margin = notional / cfg.leverage;
      const used = pos.reduce((s, p) => s + p.notional / cfg.leverage, 0);
      if (capital - used >= margin && capital > 0) {
        if (pos.length === 0) {
          ladderNum++;
          const d = new Date(ts).toISOString().slice(0, 16);
          console.log(`\n  #${String(ladderNum).padStart(3)} OPEN  ${d} | price $${close.toFixed(2)} | capital: $${capital.toFixed(0)}`);
        }
        pos.push({ ep: close, et: ts, qty: notional / close, notional });
        lastAdd = ts;
      }
    }
  }
}

// Summary
console.log("\n" + "=".repeat(120));
console.log("  SUMMARY");
console.log("=".repeat(120));
console.log(`  Capital: $5,000 → $${capital.toFixed(0)}`);
console.log(`  Ladders: ${ladderNum}`);

// Now explain the math
console.log(`
==========================================================================
  WHY THE UPSWINGS DON'T SAVE YOU
==========================================================================

  The problem is ASYMMETRY between wins and losses:

  A typical TP win:
  - 1-3 positions, ~$2,000-4,000 notional
  - 1.4% TP on $3,000 notional = ~$42 gross, ~$35 net after fees
  - Maybe $20-80 profit per ladder

  A typical EM kill:
  - 11 positions (fully scaled), $25,720 notional
  - -10% on $25,720 = -$2,572 gross, -$2,600 to -$3,000 net
  - One EM kill wipes out 30-80 winning ladders

  The bot IS making money on the Feb upswings — lots of small TPs.
  But each crash that hits -10% before the bot can exit
  erases weeks of TP profits in one candle.

  On a $5K account, one EM kill is -50% to -60% of your account.
  You need to win back $3K from $2K capital — that's +150% just to break even.
  On $15K, the same EM kill is -18% — painful but recoverable in a week of TPs.
`);
