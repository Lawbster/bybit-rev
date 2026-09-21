import assert from "assert/strict";
import { regime } from "./age10-regime-attribution";
assert.equal(regime(-5.01, 10), "down");
assert.equal(regime(-5, -20), "sideways");
assert.equal(regime(5, 20), "sideways");
assert.equal(regime(5.01, -5), "uptrend_pullback");
assert.equal(regime(10, -4.99), "other_uptrend");
assert.throws(() => regime(NaN, 0));
console.log("Price-only regime boundaries passed; analysis labels never enter strategy decisions");
