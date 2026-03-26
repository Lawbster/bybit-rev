import fs from "fs";
import path from "path";
import { RawCsvRow } from "./types";

/**
 * Parse a Bybit copy trading CSV export into typed rows.
 * Skips the first line (UID header) and uses the second line as column headers.
 */
export function parseCsvFile(filePath: string): RawCsvRow[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  // Line 0: "UID: 3674537,Company Name: ,Country: "
  // Line 1: column headers
  // Line 2+: data
  if (lines.length < 3) return [];

  const rows: RawCsvRow[] = [];

  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 17) continue;

    rows.push({
      uid: cols[0].trim(),
      time: cols[1].trim(),
      currency: cols[2].trim(),
      contract: cols[3].trim(),
      type: cols[4].trim(),
      direction: cols[5].trim(),
      quantity: parseFloat(cols[6]) || 0,
      position: parseFloat(cols[7]) || 0,
      filledPrice: parseFloat(cols[8]) || 0,
      funding: parseFloat(cols[9]) || 0,
      feePaid: parseFloat(cols[10]) || 0,
      cashFlow: parseFloat(cols[11]) || 0,
      change: parseFloat(cols[12]) || 0,
      walletBalance: parseFloat(cols[13]) || 0,
      feeRate: parseFloat(cols[14]) || 0,
      tradeId: cols[15].trim(),
      orderId: cols[16].trim(),
    });
  }

  return rows;
}

/**
 * Load all CSV files from the bybit-exports directory.
 */
export function loadAllExports(
  exportsDir: string = path.resolve(__dirname, "../bybit-exports")
): RawCsvRow[] {
  if (!fs.existsSync(exportsDir)) return [];

  const files = fs
    .readdirSync(exportsDir)
    .filter((f) => f.endsWith(".csv"))
    .sort();

  const allRows: RawCsvRow[] = [];
  for (const file of files) {
    const rows = parseCsvFile(path.join(exportsDir, file));
    allRows.push(...rows);
  }

  // Deduplicate by tradeId (in case overlapping exports)
  const seen = new Set<string>();
  return allRows.filter((r) => {
    if (!r.tradeId) return true; // keep non-trade rows (funding etc.)
    if (seen.has(r.tradeId)) return false;
    seen.add(r.tradeId);
    return true;
  });
}
