import assert from "assert";
import {
  formatQtyForStep,
  isTerminalOrderStatus,
  normalizeQtyDown,
} from "../src/bot/executor";

function closeEnough(actual: number, expected: number, eps = 1e-12): void {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${expected}, got ${actual}`);
}

function testQtyNormalization(): void {
  closeEnough(normalizeQtyDown(183.39999999999998, 0.1), 183.4);
  closeEnough(normalizeQtyDown(183.45, 0.1), 183.4);
  closeEnough(normalizeQtyDown(0.0009999999999999998, 0.001), 0.001);
  closeEnough(normalizeQtyDown(0.0009, 0.001), 0);
  closeEnough(normalizeQtyDown(12.3456789, 0.0001), 12.3456);
  assert.equal(formatQtyForStep(12.3456789, 0.0001), "12.3456");
  assert.equal(formatQtyForStep(183.39999999999998, 0.1), "183.4");
}

function testTerminalStatuses(): void {
  assert.equal(isTerminalOrderStatus("Filled"), true);
  assert.equal(isTerminalOrderStatus("PartiallyFilledCanceled"), true);
  assert.equal(isTerminalOrderStatus("Rejected"), true);
  assert.equal(isTerminalOrderStatus("New"), false);
  assert.equal(isTerminalOrderStatus("PartiallyFilled"), false);
}

testQtyNormalization();
testTerminalStatuses();

console.log("executor normalization tests passed");
