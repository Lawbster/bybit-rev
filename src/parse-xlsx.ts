import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { Trade, Side } from "./types";

// Excel serial date → JS Date
function excelDateToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400000);
}

// "PIPPINUSDTLong" → { symbol: "PIPPINUSDT", side: "Long" }
function parsePosition(raw: string): { symbol: string; side: Side } {
  const trimmed = raw.trim();
  const longIdx = trimmed.lastIndexOf("Long");
  const shortIdx = trimmed.lastIndexOf("Short");

  if (longIdx > 0 && longIdx > shortIdx) {
    return { symbol: trimmed.slice(0, longIdx), side: "Long" };
  }
  if (shortIdx > 0) {
    return { symbol: trimmed.slice(0, shortIdx), side: "Short" };
  }
  throw new Error(`Cannot parse position: "${raw}"`);
}

// "0.04552 USDT" → 0.04552
function parsePrice(raw: string): number {
  return parseFloat(raw.split(" ")[0]);
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

/**
 * Parse a single xlsx file from the GUI copy-paste export.
 */
export function parseXlsxFile(filePath: string): Trade[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

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
    });
  }

  // Sort by open time
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
    allTrades.push(...parseXlsxFile(path.join(exportsDir, file)));
  }

  // Deduplicate by orderId
  const seen = new Set<string>();
  return allTrades.filter((t) => {
    if (seen.has(t.orderId)) return false;
    seen.add(t.orderId);
    return true;
  });
}
