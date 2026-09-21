import assert from "assert/strict";
import type { Candle } from "../src/fetch-candles";
import type { ResearchFeature } from "../src/research/indicator-features";
import { HOUR as H, LadderIndicatorTape, INDICATOR_VARIANTS, indicatorVeto,
  type IndicatorContext } from "./ladder-indicator-policy";

const M = 60_000, T = Date.UTC(2026, 7, 1);
let groups = 0;
function test(name: string, body: () => void): void { body(); groups++; console.log(`PASS ${name}`); }
function minutes(count: number, start = T): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = 100 + Math.floor(i / 60);
    return { timestamp: start + i * M, open: price, high: price + 1, low: price - 1,
      close: price, volume: 10 + i % 3, turnover: (10 + i % 3) * price };
  });
}
function context(changes: Partial<ResearchFeature> = {}, close = 100): IndicatorContext {
  const features: ResearchFeature = { timestamp: T, rsi14: 50, crsi: 50, roc5: 1,
    atr14: 2, atrPct: 2, adx14: 20, plusDI14: 10, minusDI14: 20,
    vwapUtcDay: 100, rvol20: 1, ...changes };
  return { barStart: T, barEnd: T + H, availableAt: T + H, close, features };
}
const decision = (nextDepth = 11) => ({ at: T + H, nextDepth });
const byFamily = (family: string) => {
  const variant = INDICATOR_VARIANTS.find(v => v.family === family); assert.ok(variant, family); return variant;
};

test("exactly the four declared overlay identities, no hidden combinations", () => {
  assert.deepEqual(INDICATOR_VARIANTS.map(v => ({ id: v.id, family: v.family })), [
    { id: "rsi_hot_d11", family: "rsi_hot" }, { id: "crsi_hot_d11", family: "crsi_hot" },
    { id: "roc_weak_d11", family: "roc_weak" }, { id: "below_vwap_d11", family: "below_vwap" },
  ]);
});

test("rungs below eleven remain untouched even with missing or extreme context", () => {
  for (const variant of INDICATOR_VARIANTS) for (const depth of [1, 5, 9, 10]) {
    for (const ctx of [null, context({ rsi14: 100, crsi: 100, roc5: -20, vwapUtcDay: 200 })]) {
      const result = indicatorVeto(variant, decision(depth), ctx);
      assert.equal(result.veto, false); assert.equal(result.unknown, false);
      assert.equal(typeof result.reason, "string");
    }
  }
});

test("RSI and CRSI hot thresholds are inclusive, independent and apply at eleven or deeper", () => {
  for (const [family, field, threshold] of [["rsi_hot", "rsi14", 70], ["crsi_hot", "crsi", 80]] as const) {
    for (const depth of [11, 12]) for (const [value, expected] of [[threshold - 0.001, false], [threshold, true], [threshold + 0.001, true], [0, false]] as const) {
      const result = indicatorVeto(byFamily(family), decision(depth), context({ [field]: value }));
      assert.equal(result.veto, expected, `${family} at ${value}`); assert.equal(result.unknown, false);
    }
  }
});

test("ROC zero is known and weak; VWAP comparison is strict below, not at equality", () => {
  for (const [roc5, veto] of [[-0.01, true], [0, true], [0.01, false]] as const) {
    const result = indicatorVeto(byFamily("roc_weak"), decision(), context({ roc5 }));
    assert.equal(result.veto, veto); assert.equal(result.unknown, false);
  }
  for (const [close, veto] of [[99.99, true], [100, false], [100.01, false]] as const) {
    const result = indicatorVeto(byFamily("below_vwap"), decision(), context({ vwapUtcDay: 100 }, close));
    assert.equal(result.veto, veto); assert.equal(result.unknown, false);
  }
});

test("null or nonfinite required metrics deactivate only the overlay and are counted unknown", () => {
  for (const [family, field] of [["rsi_hot", "rsi14"], ["crsi_hot", "crsi"], ["roc_weak", "roc5"], ["below_vwap", "vwapUtcDay"]] as const) {
    for (const missing of [null, NaN, Infinity]) {
      const result = indicatorVeto(byFamily(family), decision(), context({ [field]: missing }));
      assert.equal(result.veto, false); assert.equal(result.unknown, true, `${family} missing metric`);
    }
    const missingContext = indicatorVeto(byFamily(family), decision(), null);
    assert.equal(missingContext.veto, false); assert.equal(missingContext.unknown, true);
  }
});

test("each family uses only its declared field and never silently combines indicator gates", () => {
  const empty: Partial<ResearchFeature> = { rsi14: null, crsi: null, roc5: null, vwapUtcDay: null,
    atr14: null, atrPct: null, adx14: null, plusDI14: null, minusDI14: null, rvol20: null };
  for (const [family, field, trigger, safe] of [["rsi_hot", "rsi14", 70, 50], ["crsi_hot", "crsi", 80, 50],
    ["roc_weak", "roc5", 0, 1], ["below_vwap", "vwapUtcDay", 101, 99]] as const) {
    const onlyRequired = indicatorVeto(byFamily(family), decision(), context({ ...empty, [field]: trigger }));
    assert.equal(onlyRequired.veto, true); assert.equal(onlyRequired.unknown, false);
    const otherIndicatorsExtreme = indicatorVeto(byFamily(family), decision(), context({ rsi14: 100, crsi: 100,
      roc5: -100, vwapUtcDay: 9999, [field]: safe }));
    assert.equal(otherIndicatorsExtreme.veto, false); assert.equal(otherIndicatorsExtreme.unknown, false);
  }
});

test("corrupt, future or stale context cannot produce a known overlay decision", () => {
  for (const variant of INDICATOR_VARIANTS) {
    const valid = context({ rsi14: 100, crsi: 100, roc5: -1, vwapUtcDay: 101 });
    const corrupt: IndicatorContext[] = [
      { ...valid, barStart: valid.barStart - H },
      { ...valid, barEnd: valid.barEnd + H },
      { ...valid, features: { ...valid.features, timestamp: valid.features.timestamp + H } },
      ...[NaN, -Infinity, valid.barEnd - 1, valid.barEnd + 1].map(availableAt => ({ ...valid, availableAt })),
    ];
    for (const c of corrupt) {
      const result = indicatorVeto(variant, decision(), c);
      assert.equal(result.veto, false); assert.equal(result.unknown, true);
    }
    const stale = indicatorVeto(variant, { at: T + 2 * H, nextDepth: 11 }, valid);
    assert.equal(stale.veto, false); assert.equal(stale.unknown, true);
  }
  for (const close of [NaN, Infinity, 0, -1]) {
    const result = indicatorVeto(byFamily("below_vwap"), decision(), context({ vwapUtcDay: 100 }, close));
    assert.equal(result.veto, false); assert.equal(result.unknown, true, "VWAP comparison requires a real positive closed price");
  }
});

test("tape selects the exact last completed hour at boundary and one millisecond before", () => {
  const cs = minutes(120 * 60), tape = new LadderIndicatorTape(cs);
  assert.equal(tape.at(T + H - 1), null, "forming first hour is unavailable");
  const first = tape.at(T + H); assert.ok(first);
  assert.equal(first.barStart, T); assert.equal(first.barEnd, T + H); assert.equal(first.availableAt, T + H);
  assert.equal(first.close, 100); assert.equal(first.features.timestamp, T);
  assert.equal(first.features.rsi14, null, "individual feature warmup remains null");
  const before = tape.at(T + 15 * H - 1), exact = tape.at(T + 15 * H); assert.ok(before && exact);
  assert.equal(before.barStart, T + 13 * H); assert.equal(before.close, 113);
  assert.equal(exact.barStart, T + 14 * H); assert.equal(exact.close, 114);
  assert.equal(exact.features.rsi14, 100, "fifteen completed hourly closes seed Wilder RSI14");
  assert.deepEqual(tape.at(T + 15 * H + 20 * M), exact, "forming hour must not alter latest closed context");
  assert.equal(tape.at(T + 121 * H), null, "no fallback to stale last archived hour");
});

test("partial trailing hour cannot affect prior context and cannot become a synthetic completed hour", () => {
  const complete = minutes(110 * 60), trailing = minutes(17, T + 110 * H).map(c => ({ ...c,
    open: 999_999, high: 1_000_000, low: 999_998, close: 999_999, turnover: c.volume * 999_999 }));
  const base = new LadderIndicatorTape(complete), append = new LadderIndicatorTape([...complete, ...trailing]);
  assert.deepEqual(append.at(T + 110 * H), base.at(T + 110 * H));
  assert.deepEqual(append.at(T + 110 * H + 17 * M), base.at(T + 110 * H));
  assert.equal(append.at(T + 111 * H), null, "seventeen minutes do not make an hour");
});

test("fixed-seed context and all policy decisions are invariant to later full-history append", () => {
  const prefix = minutes(105 * 60), future = minutes(6 * 60, T + 105 * H).map((c, i) => {
    const close = i % 2 ? 1_000_000 : 2;
    return { ...c, open: close, high: close + 1, low: close - 1, close, turnover: close * c.volume };
  });
  const original = JSON.stringify(prefix), frozen = Object.freeze(prefix.map(c => Object.freeze({ ...c })));
  const a = new LadderIndicatorTape(frozen), b = new LadderIndicatorTape([...frozen, ...future]);
  for (const at of [T + H, T + 15 * H, T + 101 * H, T + 102 * H, T + 105 * H]) {
    assert.deepEqual(a.at(at), b.at(at), `prefix context ${at}`);
    for (const variant of INDICATOR_VARIANTS)
      assert.deepEqual(indicatorVeto(variant, { at, nextDepth: 11 }, a.at(at)), indicatorVeto(variant, { at, nextDepth: 11 }, b.at(at)));
  }
  assert.equal(JSON.stringify(prefix), original, "input remains unchanged");
});

test("invalid/gapped/duplicate minute source and invalid lookup times fail explicitly", () => {
  const cs = minutes(120);
  assert.throws(() => new LadderIndicatorTape([]), "missing fixed seed");
  assert.throws(() => new LadderIndicatorTape(cs.slice(1)), "partial leading hour cannot silently move fixed seed");
  assert.throws(() => new LadderIndicatorTape(cs.filter((_, i) => i !== 30)), "missing source minute");
  assert.throws(() => new LadderIndicatorTape([...cs.slice(0, 30), cs[29], ...cs.slice(30)]), "duplicate source minute");
  assert.throws(() => new LadderIndicatorTape([...cs].reverse()), "unordered source minute");
  assert.throws(() => new LadderIndicatorTape([{ ...cs[0], timestamp: T + 1 }, ...cs.slice(1)]), "nonaligned minute");
  assert.throws(() => new LadderIndicatorTape([{ ...cs[0], close: NaN }, ...cs.slice(1)]), "invalid OHLC");
  const tape = new LadderIndicatorTape(cs);
  for (const invalid of [NaN, Infinity, T + 0.5, -1]) assert.throws(() => tape.at(invalid), `invalid as-of ${invalid}`);
});

console.log(`ladder indicator tests passed (${groups} groups; independent thresholds, isolation and closed-bar timing)`);
