import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { BotLogger } from "../src/bot/monitor";
import { LadderPosition } from "../src/bot/state";

const position: LadderPosition = {
  id: "test-position",
  entryPrice: 100,
  entryTime: 1,
  qty: 1,
  notional: 100,
  level: 0,
};

function readStatus(root: string): any {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "TESTUSDT_status.json"), "utf8"));
}

function main(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reverse-copy-monitor-"));
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const output: string[] = [];

  try {
    process.chdir(root);
    console.log = (...args: any[]) => output.push(args.join(" "));
    const logger = new BotLogger("logs");

    logger.printStatus("LIVE", "TESTUSDT", 100, [position], 1000, 1000, 0, false, false, 11, 0.5);
    const stale = readStatus(root);
    assert.equal(stale.activeTpPct, 0.5);
    assert.equal(stale.tpPrice, 100.5);
    assert.ok(output.some(line => line.includes("Batch TP: $100.5000")));

    output.length = 0;
    logger.printStatus("LIVE", "TESTUSDT", 100, [position], 1000, 1000, 0, false, false, 11, 1.4);
    const normal = readStatus(root);
    assert.equal(normal.activeTpPct, 1.4);
    assert.equal(normal.tpPrice, 101.4);
    assert.ok(output.some(line => line.includes("Batch TP: $101.4000")));

    logger.printStatus("LIVE", "TESTUSDT", 100, [], 1000, 1000, 0, false, false, 11, 0.5);
    const flat = readStatus(root);
    assert.equal(flat.activeTpPct, null);
    assert.equal(flat.tpPrice, null);
    assert.equal(flat.tpDistPct, null);
  } finally {
    console.log = originalLog;
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }

  console.log("monitor status tests passed");
}

main();
