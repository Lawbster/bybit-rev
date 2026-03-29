import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { Trade, Side } from "./types";

// Excel serial date → JS Date
function excelDateToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400000);
}

// Known symbol corrections for GUI export truncation
const SYMBOL_FIXES: Record<string, string> = {
  IPPINUSDT: "PIPPINUSDT",
  THUSDT: "ETHUSDT",
  YPEUSDT: "HYPEUSDT",
};

// "PIPPINUSDTLong" → { symbol: "PIPPINUSDT", side: "Long" }
function parsePosition(raw: string): { symbol: string; side: Side } {
  const trimmed = raw.trim();
  const longIdx = trimmed.lastIndexOf("Long");
  const shortIdx = trimmed.lastIndexOf("Short");

  let symbol: string;
  let side: Side;
  if (longIdx > 0 && longIdx > shortIdx) {
    symbol = trimmed.slice(0, longIdx);
    side = "Long";
  } else if (shortIdx > 0) {
    symbol = trimmed.slice(0, shortIdx);
    side = "Short";
  } else {
    throw new Error(`Cannot parse position: "${raw}"`);
  }

  // Apply known symbol corrections
  if (SYMBOL_FIXES[symbol]) symbol = SYMBOL_FIXES[symbol];

  return { symbol, side };
}

// "0.04552 USDT" or "2,070.28 USDT" → number
function parsePrice(raw: string): number {
  return parseFloat(raw.split(" ")[0].replace(/,/g, ""));
}

// "2,753 PIPPIN" → { qty: 2753, asset: "PIPPIN" }
function parseQty(raw: string): { qty: number; asset: string } {
  const parts = raw.trim().split(" ");
  const qty = parseFloat(parts[0].replace(/,/g, ""));
  const asset = parts.slice(1).join(" ");
  return { qty, asset };
}

// "+1.9150 USDT‏(+15.12‎%)" → { pnl: 1.915, pnlPercent: 15.12 }
function parsePnl(raw: string): { pnl: number; pnlPercent: number } {
  // Strip invisible Unicode characters
  const clean = raw.replace(/[\u200E\u200F\u200B\u202A-\u202E\uFEFF]/g, "");
  // Extract the USDT value
  const pnlMatch = clean.match(/([+-]?[\d.]+)\s*USDT/);
  // Extract the percentage
  const pctMatch = clean.match(/\(([+-]?[\d.]+)%\)/);

  return {
    pnl: pnlMatch ? parseFloat(pnlMatch[1]) : 0,
    pnlPercent: pctMatch ? parseFloat(pctMatch[1]) : 0,
  };
}

// "0.13898973 USDT‏" → 0.13898973
function parseFees(raw: string): number {
  const clean = raw.replace(/[\u200E\u200F\u200B\u202A-\u202E\uFEFF]/g, "");
  const match = clean.match(/([\d.]+)\s*USDT/);
  return match ? parseFloat(match[1]) : 0;
}

// "Cross 10.00x" → { mode: "Cross", leverage: 10 }
function parseLeverage(raw: string): { mode: string; leverage: number } {
  const match = raw.trim().match(/^(\w+)\s+([\d.]+)x$/);
  if (match) {
    return { mode: match[1], leverage: parseFloat(match[2]) };
  }
  return { mode: "Cross", leverage: 1 };
}

// "gui-pull-aristo.xlsx" → "aristo", "gui-pull-caleon.xlsx" → "caleon"
function traderFromFilename(filePath: string): string {
  const base = path.basename(filePath, ".xlsx");
  const match = base.match(/gui-pull-(\w+)/);
  if (match) return match[1];
  // Legacy: "manual export from gui.xlsx" → "caleon"
  if (base.includes("manual export")) return "caleon";
  return base;
}

// "+57.05‎%" → 57.05
function parseRoiPct(raw: string): number {
  const clean = raw.replace(/[\u200E\u200F\u200B\u202A-\u202E\uFEFF]/g, "");
  const m = clean.match(/([+-]?[\d.]+)%/);
  return m ? parseFloat(m[1]) : 0;
}

// Detect which export format a sheet uses
function detectFormat(rows: Record<string, any>[]): "copy" | "leader" | "empty" {
  if (rows.length === 0) return "empty";
  const firstTrade = rows.find((r) => r["Entry Price"]);
  if (!firstTrade) return "empty";
  if (firstTrade["Closed P&L"]) return "copy";
  if (firstTrade["ROI (%)"]) return "leader";
  return "empty";
}

/**
 * Parse a single xlsx file. Auto-detects copy-trade vs leader-profile format.
 */
export function parseXlsxFile(filePath: string): Trade[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
  const trader = traderFromFilename(filePath);
  const format = detectFormat(rows);

  if (format === "empty") return [];
  if (format === "leader") return parseLeaderFormat(rows, trader);
  return parseCopyFormat(rows, trader);
}

function parseCopyFormat(rows: Record<string, any>[], trader: string): Trade[] {
  const trades: Trade[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip leverage-info rows (they follow each trade row)
    if (!row["Closed P&L"] || !row["Entry Price"]) continue;

    // Next row might be leverage info
    const leverageRow = i + 1 < rows.length ? rows[i + 1] : null;
    const leverageInfo =
      leverageRow &&
      !leverageRow["Closed P&L"] &&
      leverageRow["Positions"]
        ? parseLeverage(leverageRow["Positions"])
        : { mode: "Cross", leverage: 10 };

    const { symbol, side } = parsePosition(row["Positions"]);
    const { qty, asset } = parseQty(row["Qty"]);
    const { pnl, pnlPercent } = parsePnl(row["Closed P&L"]);
    const openedAt = excelDateToDate(row["Opened On"]);
    const closedAt = excelDateToDate(row["Closed On"]);

    trades.push({
      symbol,
      side,
      leverage: leverageInfo.leverage,
      marginMode: leverageInfo.mode,
      qty,
      qtyAsset: asset,
      openedAt,
      closedAt,
      entryPrice: parsePrice(row["Entry Price"]),
      exitPrice: parsePrice(row["Closing Price"]),
      closeReason: row["Close By"] || "",
      pnl,
      pnlPercent,
      fees: parseFees(row["Fees"]),
      orderId: row["Order No."] || "",
      holdDurationMs: closedAt.getTime() - openedAt.getTime(),
      trader,
    });
  }

  trades.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  return trades;
}

function parseLeaderFormat(rows: Record<string, any>[], trader: string): Trade[] {
  const trades: Trade[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row["Entry Price"] || !row["ROI (%)"]) continue;

    // Next row is leverage info
    const leverageRow = i + 1 < rows.length ? rows[i + 1] : null;
    const leverageInfo =
      leverageRow &&
      !leverageRow["Entry Price"] &&
      leverageRow["Positions"]
        ? parseLeverage(leverageRow["Positions"])
        : { mode: "Cross", leverage: 10 };

    const { symbol, side } = parsePosition(row["Positions"]);
    const { qty, asset } = parseQty(row["Order Qty"]);
    const entryPrice = parsePrice(row["Entry Price"]);
    const exitPrice = parsePrice(row["Closing Price"]);
    const openedAt = excelDateToDate(row["Opened On"]);
    const closedAt = excelDateToDate(row["Closed On"]);
    const roiPct = parseRoiPct(row["ROI (%)"]);

    // Compute PnL from prices: for shorts (entry - exit) * qty, for longs (exit - entry) * qty
    const rawPnl = side === "Short"
      ? (entryPrice - exitPrice) * qty
      : (exitPrice - entryPrice) * qty;

    trades.push({
      symbol,
      side,
      leverage: leverageInfo.leverage,
      marginMode: leverageInfo.mode,
      qty,
      qtyAsset: asset,
      openedAt,
      closedAt,
      entryPrice,
      exitPrice,
      closeReason: "",
      pnl: Math.round(rawPnl * 100) / 100,
      pnlPercent: roiPct,
      fees: 0,  // not available in leader format
      orderId: `${trader}-${openedAt.getTime()}-${i}`, // synthetic ID
      holdDurationMs: closedAt.getTime() - openedAt.getTime(),
      trader,
    });
  }

  trades.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  return trades;
}

/**
 * Load all xlsx files from the bybit-exports directory.
 * Deduplicates by orderId.
 */
export function loadAllXlsx(
  exportsDir: string = path.resolve(__dirname, "../bybit-exports")
): Trade[] {
  if (!fs.existsSync(exportsDir)) return [];

  const files = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith(".xlsx"))
    .sort();

  const allTrades: Trade[] = [];
  for (const file of files) {
    const parsed = parseXlsxFile(path.join(exportsDir, file));
    if (parsed.length > 0) {
      console.log(`  ${file}: ${parsed.length} trades (${parsed[0].trader})`);
    }
    allTrades.push(...parsed);
  }

  // Deduplicate by orderId (only meaningful for copy-format trades with real IDs)
  const seen = new Set<string>();
  return allTrades.filter((t) => {
    if (seen.has(t.orderId)) return false;
    seen.add(t.orderId);
    return true;
  });
}
