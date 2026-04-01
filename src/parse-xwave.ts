/**
 * Parser for xwave's leader-profile trade export (GUI-pull XLSX).
 *
 * Format quirks:
 *  - Header row has 11 columns but trade rows have 7–8 (no Close By / Fees / Order No.)
 *  - An extra PnL% column sits between Qty and Entry Price (not in header)
 *  - Every trade row is followed by a leverage row ("Cross 35.00x")
 *  - Dates are Excel serial numbers
 *  - Prices have " USDT" suffix, quantities have coin suffix
 *  - PnL% has invisible Unicode LTR marks
 */

import XLSX from "xlsx";
import path from "path";

// ── Interfaces ──────────────────────────────────────────────────────

export type Side = "Long" | "Short";

export interface XwaveTrade {
  pair: string;        // "HYPEUSDT"
  side: Side;
  leverage: number;    // 35
  qty: number;         // 1.24
  entryPrice: number;  // 36.464
  closePrice: number;  // 36.719
  openedAt: number;    // unix ms timestamp
  closedAt: number;    // unix ms timestamp
  closedPnl: number;   // 37 (USDT)
  pnlPct: number;      // 19.73 (leveraged %)
}

export interface XwaveBatch {
  pair: string;
  leverage: number;
  anchorPrice: number;   // the shared entry price
  closePrice: number;
  trades: XwaveTrade[];
  totalNotional: number;
  totalPnl: number;
  openedFirst: number;   // earliest open timestamp
  closedAt: number;
  holdMinutes: number;   // from first open to close
  tpPct: number;         // actual unleveraged TP %
  scaleFactor: number;   // average ratio between consecutive notionals
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Excel serial date → unix ms */
function excelToUnixMs(serial: number): number {
  return (serial - 25569) * 86400000;
}

/** "HYPEUSDTLong " → { pair: "HYPEUSDT", side: "Long" } */
function parsePosition(raw: string): { pair: string; side: Side } {
  const s = raw.trim();
  const longIdx = s.lastIndexOf("Long");
  const shortIdx = s.lastIndexOf("Short");

  if (longIdx > 0 && longIdx > shortIdx) {
    return { pair: s.slice(0, longIdx), side: "Long" };
  }
  if (shortIdx > 0) {
    return { pair: s.slice(0, shortIdx), side: "Short" };
  }
  throw new Error(`Cannot parse position: "${raw}"`);
}

/** "36.464 USDT" → 36.464 */
function parsePrice(raw: string): number {
  return parseFloat(raw.split(" ")[0].replace(/,/g, ""));
}

/** "1.24 HYPE" → 1.24 */
function parseQty(raw: string): number {
  return parseFloat(raw.trim().split(" ")[0].replace(/,/g, ""));
}

/** "+19.73‎%" → 19.73  (strips Unicode LTR / RTL marks) */
function parsePnlPct(raw: string): number {
  const clean = raw.replace(/[\u200E\u200F\u200B\u202A-\u202E\uFEFF]/g, "");
  const m = clean.match(/([+-]?[\d.]+)%/);
  return m ? parseFloat(m[1]) : 0;
}

/** "Cross 35.00x" → 35 */
function parseLeverage(raw: string): number {
  const m = raw.trim().match(/([\d.]+)x$/);
  return m ? parseFloat(m[1]) : 1;
}

// ── Main parser ─────────────────────────────────────────────────────

/**
 * Parse an xwave leader-profile XLSX export into typed trades.
 *
 * Column layout (by index in raw array rows):
 *   [0] Positions   – "HYPEUSDTLong "
 *   [1] Qty         – "1.24 HYPE"
 *   [2] PnL%        – "+19.73‎%"          (extra column, not in header)
 *   [3] Entry Price  – "36.464 USDT"
 *   [4] Opened On    – Excel serial number
 *   [5] Closing Price – "36.719 USDT"
 *   [6] Closed On    – Excel serial number
 *   [7] Closed P&L   – 37               (may be absent)
 */
export function parseXwaveExport(filePath: string): XwaveTrade[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const trades: XwaveTrade[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue;           // skip leverage rows (1 col) and empty
    if (typeof row[0] !== "string") continue;
    if (row[0].trim().startsWith("Cross")) continue; // skip leverage rows that snuck through

    const { pair, side } = parsePosition(row[0]);
    const qty = parseQty(row[1]);
    const pnlPct = parsePnlPct(String(row[2]));
    const entryPrice = parsePrice(String(row[3]));
    const openedAt = excelToUnixMs(row[4]);
    const closePrice = parsePrice(String(row[5]));
    const closedAt = excelToUnixMs(row[6]);
    const closedPnl = row.length >= 8 && row[7] != null ? Number(row[7]) : 0;

    // Look ahead for leverage row
    let leverage = 1;
    const next = rows[i + 1];
    if (next && next.length === 1 && typeof next[0] === "string" && next[0].includes("x")) {
      leverage = parseLeverage(next[0]);
    }

    trades.push({
      pair,
      side,
      leverage,
      qty,
      entryPrice,
      closePrice,
      openedAt,
      closedAt,
      closedPnl,
      pnlPct,
    });
  }

  // Sort oldest first
  trades.sort((a, b) => a.openedAt - b.openedAt);
  return trades;
}

// ── Batch grouping ──────────────────────────────────────────────────

/**
 * Group trades into batches where all trades share the same entry price
 * and the same close time. This represents a single DCA position that
 * was closed at once.
 */
export function groupIntoBatches(trades: XwaveTrade[]): XwaveBatch[] {
  // Build a composite key: pair + entryPrice + closedAt (rounded to nearest minute)
  const buckets = new Map<string, XwaveTrade[]>();

  for (const t of trades) {
    // Round closedAt to the minute for grouping (handles tiny serial differences)
    const closedMinute = Math.round(t.closedAt / 60000);
    const key = `${t.pair}|${t.entryPrice}|${closedMinute}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(t);
  }

  const batches: XwaveBatch[] = [];

  for (const group of buckets.values()) {
    // Sort trades by openedAt ascending (earliest first)
    group.sort((a, b) => a.openedAt - b.openedAt);

    const first = group[0];
    const totalNotional = group.reduce((s, t) => s + t.qty * t.entryPrice, 0);
    const totalPnl = group.reduce((s, t) => s + t.closedPnl, 0);
    const openedFirst = group[0].openedAt;
    const closedAt = group[group.length - 1].closedAt;

    // Unleveraged TP%: price move / entry
    const priceDelta = first.side === "Long"
      ? first.closePrice - first.entryPrice
      : first.entryPrice - first.closePrice;
    const tpPct = (priceDelta / first.entryPrice) * 100;

    // Scale factor: average ratio between consecutive notionals
    let scaleFactor = 1;
    if (group.length >= 2) {
      const notionals = group.map((t) => t.qty * t.entryPrice);
      const ratios: number[] = [];
      for (let i = 1; i < notionals.length; i++) {
        if (notionals[i - 1] > 0) {
          ratios.push(notionals[i] / notionals[i - 1]);
        }
      }
      if (ratios.length > 0) {
        scaleFactor = ratios.reduce((s, r) => s + r, 0) / ratios.length;
      }
    }

    batches.push({
      pair: first.pair,
      leverage: first.leverage,
      anchorPrice: first.entryPrice,
      closePrice: first.closePrice,
      trades: group,
      totalNotional: Math.round(totalNotional * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      openedFirst,
      closedAt,
      holdMinutes: Math.round((closedAt - openedFirst) / 60000),
      tpPct: Math.round(tpPct * 10000) / 10000,  // 4 decimal places
      scaleFactor: Math.round(scaleFactor * 1000) / 1000,
    });
  }

  // Sort batches by closedAt
  batches.sort((a, b) => a.closedAt - b.closedAt);
  return batches;
}

// ── CLI summary ─────────────────────────────────────────────────────

function formatTs(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
}

function main() {
  const filePath = process.argv[2]
    || path.resolve(__dirname, "../bybit-exports/gui-pull-xwave.xlsx");

  console.log(`\nParsing: ${filePath}\n`);

  const trades = parseXwaveExport(filePath);
  console.log(`Total trades: ${trades.length}`);

  // Trades by pair
  const byPair = new Map<string, XwaveTrade[]>();
  for (const t of trades) {
    if (!byPair.has(t.pair)) byPair.set(t.pair, []);
    byPair.get(t.pair)!.push(t);
  }

  console.log("\n── Trades by pair ──");
  for (const [pair, pts] of byPair) {
    const pnl = pts.reduce((s, t) => s + t.closedPnl, 0);
    const leverages = [...new Set(pts.map((t) => t.leverage))];
    console.log(
      `  ${pair}: ${pts.length} trades, PnL ${pnl.toFixed(2)} USDT, leverage ${leverages.join("/")}x`
    );
  }

  // Batches
  const batches = groupIntoBatches(trades);
  console.log(`\n── Batches: ${batches.length} ──`);

  let grandPnl = 0;
  for (const b of batches) {
    grandPnl += b.totalPnl;
    const notionals = b.trades.map((t) => t.qty * t.entryPrice);
    const notionalStr = notionals.map((n) => n.toFixed(0)).join(" → ");
    console.log(
      `  ${b.pair} ${b.leverage}x | entry ${b.anchorPrice} → ${b.closePrice} ` +
      `| TP ${b.tpPct.toFixed(4)}% (${(b.tpPct * b.leverage).toFixed(2)}% lev) ` +
      `| ${b.trades.length} legs [${notionalStr}] ` +
      `| scale ${b.scaleFactor.toFixed(3)} ` +
      `| ${b.holdMinutes}m ` +
      `| PnL ${b.totalPnl} USDT ` +
      `| ${formatTs(b.openedFirst)} → ${formatTs(b.closedAt)}`
    );
  }

  console.log(`\n── Summary ──`);
  console.log(`  Total batches: ${batches.length}`);
  console.log(`  Total PnL: ${grandPnl.toFixed(2)} USDT`);

  // Parameter extraction
  const tpPcts = batches.map((b) => b.tpPct);
  const scaleFactors = batches.filter((b) => b.trades.length > 1).map((b) => b.scaleFactor);
  const holdMins = batches.map((b) => b.holdMinutes);
  const leverages = [...new Set(batches.map((b) => b.leverage))];
  const legCounts = batches.map((b) => b.trades.length);

  console.log(`\n── Detected parameters ──`);
  console.log(`  Leverages: ${leverages.join(", ")}x`);
  console.log(`  Legs/batch: ${Math.min(...legCounts)}–${Math.max(...legCounts)} (median ${legCounts.sort((a, b) => a - b)[Math.floor(legCounts.length / 2)]})`);
  console.log(`  TP% (unleveraged): ${Math.min(...tpPcts).toFixed(4)}–${Math.max(...tpPcts).toFixed(4)}% (median ${tpPcts.sort((a, b) => a - b)[Math.floor(tpPcts.length / 2)]?.toFixed(4)}%)`);
  if (scaleFactors.length > 0) {
    console.log(`  Scale factor: ${Math.min(...scaleFactors).toFixed(3)}–${Math.max(...scaleFactors).toFixed(3)} (median ${scaleFactors.sort((a, b) => a - b)[Math.floor(scaleFactors.length / 2)]?.toFixed(3)})`);
  }
  console.log(`  Hold time: ${Math.min(...holdMins)}–${Math.max(...holdMins)}m (median ${holdMins.sort((a, b) => a - b)[Math.floor(holdMins.length / 2)]}m)`);
}

// Run directly
if (require.main === module) {
  main();
}
