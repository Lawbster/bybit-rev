import { execSync } from "child_process";

// Test entry timing sensitivity — run the full exit stack sim
// with different start dates to see how much first-trade timing matters

const dates = [
  "2025-01-16", "2025-01-17", "2025-01-18", "2025-01-19",
  "2025-01-20", // original default
  "2025-01-21", "2025-01-22", "2025-01-23", "2025-01-24",
  "2025-01-25", "2025-01-26",
];

console.log("ENTRY TIMING SENSITIVITY — HYPEUSDT Full Exit Stack\n");
console.log("Start Date  | Return  | Min Equity | Max DD  | Trades | WR   | Funding");
console.log("─".repeat(80));

for (const d of dates) {
  try {
    const out = execSync(
      `npx ts-node src/sim-exits.ts startDate=${d}`,
      { encoding: "utf-8", timeout: 60000 },
    );

    const lines = out.split("\n");

    // Find "Full stack (trend + exits)" result line
    const fullIdx = lines.findIndex(l => l.includes("Full stack (trend + exits)"));
    if (fullIdx === -1) continue;

    const fullLine = lines[fullIdx];
    const feeLine = lines[fullIdx + 1] || "";
    const exitLine = lines[fullIdx + 2] || "";

    const retMatch = fullLine.match(/Return:\s+([\d.-]+%)/);
    const ddMatch = fullLine.match(/DD:\s+([\d.]+)%/);
    const minEqMatch = fullLine.match(/MinEq:\s+\$([\d.-]+)/);
    const tradesMatch = fullLine.match(/Trades:\s+(\d+)/);
    const wrMatch = fullLine.match(/\((\d+)% WR\)/);
    const fundingMatch = feeLine.match(/\$(\d+) funding/);

    const ret = retMatch?.[1] || "?";
    const dd = ddMatch?.[1] || "?";
    const minEq = minEqMatch?.[1]?.trim() || "?";
    const trades = tradesMatch?.[1] || "?";
    const wr = wrMatch?.[1] || "?";
    const funding = fundingMatch?.[1] || "?";

    const marker = d === "2025-01-20" ? " ← default" : "";
    console.log(
      `${d}  | ${ret.padStart(7)} | $${minEq.padStart(9)} | ${dd.padStart(5)}% | ${trades.padStart(6)} | ${wr.padStart(3)}% | $${funding}${marker}`
    );
  } catch (err: any) {
    console.log(`${d}  | ERROR: ${err.message.slice(0, 50)}`);
  }
}

console.log("\nIf returns are stable across dates, entry timing doesn't matter much.");
console.log("If they vary wildly, the first ladder's position in the cycle is critical.");
