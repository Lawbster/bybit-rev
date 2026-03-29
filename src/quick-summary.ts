import { loadAllXlsx } from "./parse-xlsx";

const trades = loadAllXlsx();
const aristo = trades.filter((t) => t.trader === "aristo");

console.log(`\nARISTO: ${aristo.length} trades | ${aristo[0].openedAt.toISOString().slice(0, 10)} → ${aristo[aristo.length - 1].openedAt.toISOString().slice(0, 10)}`);
console.log(`WR: ${((aristo.filter((t) => t.pnl > 0).length / aristo.length) * 100).toFixed(0)}% | Total PnL: $${aristo.reduce((s, t) => s + t.pnl, 0).toFixed(0)}`);

const syms: Record<string, { L: number; S: number; pnl: number; avgHold: number }> = {};
for (const t of aristo) {
  if (!syms[t.symbol]) syms[t.symbol] = { L: 0, S: 0, pnl: 0, avgHold: 0 };
  syms[t.symbol][t.side === "Long" ? "L" : "S"]++;
  syms[t.symbol].pnl += t.pnl;
  syms[t.symbol].avgHold += t.holdDurationMs;
}
console.log("\nSymbol breakdown:");
for (const [sym, v] of Object.entries(syms)) {
  const total = v.L + v.S;
  const avgH = v.avgHold / total / 3600000;
  console.log(`  ${sym.padEnd(16)} ${String(v.L).padStart(3)}L / ${String(v.S).padStart(3)}S  PnL: $${v.pnl.toFixed(0).padStart(8)}  avg hold: ${avgH.toFixed(1)}h`);
}

console.log("\nLeverage breakdown:");
const levs: Record<string, number> = {};
aristo.forEach((t) => { levs[t.leverage + "x"] = (levs[t.leverage + "x"] || 0) + 1; });
Object.entries(levs).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v} trades`));
