// sim-river-sweep.ts — run sim-river config across multiple symbols
// Usage: npx ts-node src/sim-river-sweep.ts
// Runs trendGate + drop>0.7% + m=15% on all available small-cap pairs

import { execSync } from "child_process";

const SYMBOLS = [
  "SIRENUSDT",
  "HYPEUSDT",
  "VVVUSDT",
  "TAOUSDT",
  "STGUSDT",
  "BLUAIUSDT",
  "DUSKUSDT",
  "LIGHTUSDT",
  "CUSDT",
  "PIPPINUSDT",
  "RIVERUSDT",
];

for (const sym of SYMBOLS) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${sym}`);
  console.log("═".repeat(70));
  try {
    const out = execSync(
      `npx ts-node src/sim-river.ts`,
      {
        env: { ...process.env, SYMBOL: sym },
        cwd: process.cwd(),
        timeout: 120000,
      }
    ).toString();
    // Print only the results table + best + monthly
    const lines = out.split("\n");
    let inTable = false;
    for (const line of lines) {
      if (line.includes("Config") && line.includes("Equity")) inTable = true;
      if (inTable || line.includes("Best:") || line.includes("Monthly") || line.includes("Month") || line.includes("20") ) {
        console.log(line);
      }
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message?.slice(0, 200)}`);
  }
}
