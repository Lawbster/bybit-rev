import assert from "assert";
import fs from "fs";
import vm from "vm";
import ts from "typescript";

// Production candle callback only, no imports, network clients or actual collector startup.
const file = ts.createSourceFile("data-collector.ts", fs.readFileSync("src/data-collector.ts", "utf8"), ts.ScriptTarget.ES2022, true);
const callback = file.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "onCandle")!;
const now = Date.UTC(2026, 8, 14, 12, 6, 1), start = Date.UTC(2026, 8, 14, 12);
const rows: { file: string; row: any }[] = [];
const context: any = { fs: { appendFileSync: (file: string, line: string) => rows.push({ file, row: JSON.parse(line) }) },
  Date: class extends Date { static now() { return now; } } };
vm.createContext(context);
vm.runInContext(ts.transpileModule(callback.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const state = { candleFile: "1m", candle5mFile: "5m", candleBuffer: [], live5mCandles: [], live5mStart: 0 };
const candle = (timestamp: number, confirmed = true) => ({ timestamp, open: 100, high: 101, low: 99,
  close: 100, volume: 10, turnover: 1000, interval: "1", confirmed });
context.onCandle(state, candle(start, false)); assert.equal(rows.length, 0);
for (let minute = 0; minute <= 5; minute++) context.onCandle(state, candle(start + minute * 60000));
assert.equal(rows.filter(r => r.file === "1m").length, 6);
const first = rows.find(r => r.file === "1m")!.row;
assert.equal(first.ts, start); assert.equal(first.endAt, start + 60000);
assert.equal(first.receivedAt, now); assert.equal(first.availableAt, now);
assert.equal(first.source, "websocket_confirmed");
const five = rows.find(r => r.file === "5m")!.row;
assert.equal(five.ts, start); assert.equal(five.endAt, start + 300000);
assert.equal(five.availableAt, now); assert.equal(five.n1m, 5);
assert.equal(five.v, 50); assert.equal(five.t, 5000);

const text = file.getFullText();
assert(text.includes("new CollectorCandleRepair(DATA_DIR, SYMBOLS, fetchCollectorRepair)"));
assert(text.includes("void repairTick(); }, 30_000)"));
assert(text.includes("publishCollectorHealth(DATA_DIR, row)"));
const repairSource = fs.readFileSync("src/collector-candle-repair.ts", "utf8");
assert(!repairSource.includes("onCandle("), "repair must not replay callbacks into old indicator/flow state");
assert(repairSource.includes('"candle-repairs"'), "separate opt-in journal");
console.log("collector wiring tests passed (actual candle callback; additive availability metadata; no historical injection)");
