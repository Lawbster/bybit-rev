import fs from "fs";
import path from "path";
import { OrderResult } from "./executor";
import { LadderPosition, BotState } from "./state";

// ─────────────────────────────────────────────
// Logger — trade log, filter log, equity log
// ─────────────────────────────────────────────

export class BotLogger {
  private logDir: string;
  private currentDate: string;

  constructor(logDir: string) {
    this.logDir = path.resolve(process.cwd(), logDir);
    if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
    this.currentDate = new Date().toISOString().slice(0, 10);
  }

  private logFile(prefix: string): string {
    const now = new Date().toISOString().slice(0, 10);
    if (now !== this.currentDate) {
      this.currentDate = now;
      this.info(`Log rollover → ${now}`);
    }
    return path.join(this.logDir, `${prefix}_${this.currentDate}.jsonl`);
  }

  private append(file: string, data: any): void {
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...data }) + "\n");
  }

  // ── Console output ──

  info(msg: string): void {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ${msg}`);
  }

  warn(msg: string): void {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}] ⚠ ${msg}`);
  }

  logError(msg: string): void {
    const ts = new Date().toISOString().slice(11, 19);
    console.error(`[${ts}] ERROR: ${msg}`);
    this.append(path.join(this.logDir, "errors.jsonl"), { level: "error", msg });
  }

  // ── Trade logging ──

  logTrade(action: string, symbol: string, result: OrderResult): void {
    const entry = { action, symbol, ...result };
    this.append(this.logFile("trades"), entry);
    if (result.success) {
      this.info(`${action} ${symbol}: $${result.notional.toFixed(2)} @ $${result.price.toFixed(4)} (${result.orderId})`);
    } else {
      this.warn(`${action} ${symbol} FAILED: ${result.error}`);
    }
  }

  logBatchClose(
    symbol: string,
    positionsClosed: number,
    totalPnl: number,
    totalFees: number,
    avgEntry: number,
    exitPrice: number,
  ): void {
    const entry = {
      action: "BATCH_CLOSE",
      symbol,
      positionsClosed,
      totalPnl,
      totalFees,
      avgEntry,
      exitPrice,
    };
    this.append(this.logFile("trades"), entry);
    this.info(`BATCH CLOSE ${symbol}: ${positionsClosed} positions, PnL $${totalPnl.toFixed(2)}, fees $${totalFees.toFixed(2)}, avg entry $${avgEntry.toFixed(4)} → exit $${exitPrice.toFixed(4)}`);
  }

  // ── Filter logging ──

  logFilterBlock(reason: string, details?: Record<string, any>): void {
    this.append(this.logFile("filters"), { action: "BLOCKED", reason, ...details });
    this.info(`BLOCKED: ${reason}`);
  }

  logFilterShadow(filterName: string, triggered: boolean, details: Record<string, any>): void {
    // Shadow signals — logged but not enforced
    this.append(this.logFile("filters"), { action: "SHADOW", filter: filterName, triggered, ...details });
    if (triggered) {
      this.info(`SHADOW ${filterName}: would block (${details.reason || ""})`);
    }
  }

  // ── Equity logging ──

  logEquity(state: BotState, price: number, equity: number, dd: number): void {
    this.append(this.logFile("equity"), {
      price,
      equity: +equity.toFixed(2),
      positions: state.positions.length,
      realizedPnl: +state.realizedPnl.toFixed(2),
      peakEquity: +state.peakEquity.toFixed(2),
      drawdownPct: +dd.toFixed(2),
    });
  }

  // ── Status display ──

  printStatus(
    mode: string,
    symbol: string,
    price: number,
    positions: LadderPosition[],
    equity: number,
    capital: number,
    dd: number,
    trendBlocked: boolean,
    riskOffBlocked: boolean,
    maxPositions?: number,
  ): void {
    const posCount = positions.length;
    const totalNotional = positions.reduce((s, p) => s + p.notional, 0);
    const ur = positions.reduce((s, p) => s + (price - p.entryPrice) * p.qty, 0);

    let avgEntry = 0;
    let tpPrice = 0;
    if (posCount > 0) {
      const totalQty = positions.reduce((s, p) => s + p.qty, 0);
      avgEntry = positions.reduce((s, p) => s + p.entryPrice * p.qty, 0) / totalQty;
      tpPrice = avgEntry * 1.014; // hardcoded 1.4% for display
    }

    const gates = [
      trendBlocked ? "TREND-BREAK" : null,
      riskOffBlocked ? "RISK-OFF" : null,
    ].filter(Boolean);

    console.log(`\n─── 2Moon Bot [${mode}] ───`);
    console.log(`  ${symbol}: $${price.toFixed(4)}`);
    console.log(`  Positions: ${posCount}/${maxPositions ?? "?"} | Notional: $${totalNotional.toFixed(0)} | UR PnL: $${ur.toFixed(2)}`);
    if (posCount > 0) {
      console.log(`  Avg entry: $${avgEntry.toFixed(4)} | Batch TP: $${tpPrice.toFixed(4)} (${((tpPrice / price - 1) * 100).toFixed(2)}% away)`);
    }
    console.log(`  Equity: $${equity.toFixed(2)} | Capital: $${capital.toFixed(2)} | DD: ${dd.toFixed(1)}%`);
    console.log(`  Gates: ${gates.length > 0 ? gates.join(", ") : "all clear"}`);
    console.log(`──────────────────────────\n`);
  }
}
