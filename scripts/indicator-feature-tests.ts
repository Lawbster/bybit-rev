import assert from "assert/strict";
import { ADX, ATR, RSI } from "technicalindicators";
import type { Candle } from "../src/fetch-candles";
import { computeResearchFeatures, type ResearchFeature } from "../src/research/indicator-features";

// Independent validation: these fixtures/references are not imported from the
// feature implementation. Wilder references use explicit decay weights rather
// than copying its running accumulator. No files, exchange calls or orders.
const M = 60_000, H = 60 * M, D = 24 * H, T = Date.UTC(2026, 7, 1);
const fields = ["rsi14", "crsi", "roc5", "atr14", "atrPct", "adx14",
  "plusDI14", "minusDI14", "vwapUtcDay", "rvol20"] as const;
let groups = 0;
function test(name: string, body: () => void): void {
  body(); groups++; console.log(`PASS ${name}`);
}
function near(actual: number | null, expected: number | null, label: string, tolerance = 1e-9): void {
  if (expected === null) { assert.equal(actual, null, label); return; }
  assert.ok(actual !== null && Number.isFinite(actual), `${label}: expected finite ${expected}, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: ${actual} differs from ${expected} by ${Math.abs(actual - expected)} (limit ${tolerance})`);
}
function fromCloses(closes: readonly number[], interval = H, start = T): Candle[] {
  return closes.map((close, i) => ({ timestamp: start + i * interval,
    open: close, high: close + 0.5, low: close - 0.5, close,
    volume: 10, turnover: close * 10 }));
}
function mixed(count: number, interval = H, start = T): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const close = 100 + 0.025 * i + 8 * Math.sin(i / 7) + 2 * Math.cos(i / 3);
    const open = close + Math.sin(i * 1.7);
    const volume = i % 13 === 0 ? 0 : 10 + i % 17;
    return { timestamp: start + i * interval, open, high: Math.max(open, close) + 1 + i % 3,
      low: Math.min(open, close) - 0.7 - i % 5 / 10, close,
      volume, turnover: volume * (open + close) / 2 };
  });
}

// Batch reference with first complete seed at values[period-1].
function weightedWilder(values: readonly number[], period: number, end: number): number | null {
  if (end < period - 1) return null;
  const decay = (period - 1) / period;
  let result = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period
    * Math.pow(decay, end - (period - 1));
  for (let j = period; j <= end; j++) result += values[j] / period * Math.pow(decay, end - j);
  return result;
}
function batchRsi(values: readonly number[], period: number, end: number): number | null {
  if (end < period) return null;
  const changes = values.slice(1, end + 1).map((value, i) => value - values[i]);
  const gains = weightedWilder(changes.map(x => Math.max(x, 0)), period, end - 1)!;
  const losses = weightedWilder(changes.map(x => Math.max(-x, 0)), period, end - 1)!;
  if (gains === 0 && losses === 0) return 50;
  return 100 * gains / (gains + losses);
}
function batchReference(candles: readonly Candle[], interval: number): ResearchFeature[] {
  const closes = candles.map(c => c.close);
  const changes = closes.slice(1).map((close, i) => close - closes[i]);
  // Count each streak backwards, independently of the production recurrence.
  const streak = closes.map((_, i) => {
    if (i === 0 || changes[i - 1] === 0) return 0;
    const direction = Math.sign(changes[i - 1]);
    let length = 0;
    for (let j = i - 1; j >= 0 && Math.sign(changes[j]) === direction; j--) length++;
    return direction * length;
  });
  const returns = changes.map((change, i) => change / closes[i] * 100);
  const tr = candles.slice(1).map((c, j) => Math.max(c.high - c.low,
    Math.abs(c.high - candles[j].close), Math.abs(c.low - candles[j].close)));
  const plusDm = candles.slice(1).map((c, j) => {
    const up = c.high - candles[j].high, down = candles[j].low - c.low;
    return up > 0 && up > down ? up : 0;
  });
  const minusDm = candles.slice(1).map((c, j) => {
    const up = c.high - candles[j].high, down = candles[j].low - c.low;
    return down > 0 && down > up ? down : 0;
  });
  const di = candles.map((_, i) => {
    if (i < 14) return null;
    const range = weightedWilder(tr, 14, i - 1)!;
    const plus = range === 0 ? 0 : 100 * weightedWilder(plusDm, 14, i - 1)! / range;
    const minus = range === 0 ? 0 : 100 * weightedWilder(minusDm, 14, i - 1)! / range;
    return { plus, minus, dx: plus + minus === 0 ? 0 : Math.abs(plus - minus) / (plus + minus) * 100 };
  });
  const dx = di.slice(14).map(v => v!.dx);
  return candles.map((c, i) => {
    const atr = weightedWilder(tr, 14, i - 1);
    const dayStart = Math.floor(c.timestamp / D) * D;
    const dayFirstIndex = candles.findIndex(row => row.timestamp === dayStart);
    const dayRows = dayFirstIndex < 0 ? [] : candles.slice(dayFirstIndex, i + 1);
    const completeDay = dayFirstIndex >= 0 && dayRows.length === (c.timestamp - dayStart) / interval + 1;
    const dayVolume = dayRows.reduce((sum, row) => sum + row.volume, 0);
    const priorVolume = i < 20 ? 0 : candles.slice(i - 20, i).reduce((sum, row) => sum + row.volume, 0) / 20;
    const rank = i < 101 ? null : 100 * returns.slice(i - 101, i - 1).filter(r => r < returns[i - 1]).length / 100;
    return { timestamp: c.timestamp,
      rsi14: batchRsi(closes, 14, i),
      crsi: rank === null ? null : (batchRsi(closes, 3, i)! + batchRsi(streak, 2, i)! + rank) / 3,
      roc5: i < 5 ? null : (c.close / closes[i - 5] - 1) * 100,
      atr14: atr, atrPct: atr === null ? null : 100 * atr / c.close,
      adx14: i < 27 ? null : weightedWilder(dx, 14, i - 14),
      plusDI14: di[i]?.plus ?? null, minusDI14: di[i]?.minus ?? null,
      vwapUtcDay: !completeDay || dayVolume === 0 ? null : dayRows.reduce((sum, row) => sum + row.turnover, 0) / dayVolume,
      rvol20: i < 20 || priorVolume === 0 ? null : c.volume / priorVolume };
  });
}

test("warmup indices are per-feature, not a blanket bundle warmup", () => {
  const result = computeResearchFeatures(mixed(103), H);
  const warmup = { rsi14: 14, crsi: 101, roc5: 5, atr14: 14, atrPct: 14,
    adx14: 27, plusDI14: 14, minusDI14: 14, vwapUtcDay: 1, rvol20: 20 } as const;
  for (const field of fields) {
    assert.equal(result.findIndex(row => row[field] !== null), warmup[field], `${field} first valid index`);
    for (let i = 0; i < warmup[field]; i++) assert.equal(result[i][field], null, `${field}[${i}]`);
  }
  assert.deepEqual(computeResearchFeatures([], H), []);
});

test("hand-computed RSI initialization and subsequent Wilder update", () => {
  const closes = Array.from({ length: 15 }, (_, i) => 100 + i % 2);
  closes.push(107);
  const result = computeResearchFeatures(fromCloses(closes), H);
  near(result[14].rsi14, 50, "seven unit gains, seven unit losses");
  near(result[15].rsi14, 67.5, "Wilder averages after seven-point gain");
});

test("hand-computed ATR accounts for previous close gaps, not high-low alone", () => {
  const cs = fromCloses(Array.from({ length: 16 }, (_, i) => i < 15 ? 100 + i : 121));
  const result = computeResearchFeatures(cs, H);
  near(result[14].atr14, 1.5, "first fourteen TRs all 1.5");
  near(result[15].atr14, 27 / 14, "seven-point upward gap gives TR 7.5");
  near(result[15].atrPct, (27 / 14) / 121 * 100, "ATR percent uses contemporaneous close");
  near(result[5].roc5, 5, "five-bar ROC");
});

test("monotonic trend direction and ADX require all 14 initial DX values", () => {
  for (const direction of [-1, 1]) {
    const rows = computeResearchFeatures(fromCloses(Array.from({ length: 40 }, (_, i) => 100 + direction * i)), H);
    near(rows[14].rsi14, direction === 1 ? 100 : 0, "one-sided RSI");
    near(rows[14].plusDI14, direction === 1 ? 100 / 1.5 : 0, "positive DI");
    near(rows[14].minusDI14, direction === -1 ? 100 / 1.5 : 0, "negative DI");
    near(rows[26].adx14, null, "only thirteen DX values");
    near(rows[27].adx14, 100, "fourteen DX values");
  }
});

test("flat prices and equal outside-bar movements have explicit zero/neutral semantics", () => {
  const cs = fromCloses(Array(120).fill(100)).map(c => ({ ...c, high: 100, low: 100 }));
  const rows = computeResearchFeatures(cs, H);
  for (const field of ["atr14", "atrPct", "plusDI14", "minusDI14", "adx14", "roc5"] as const)
    near(rows[119][field], 0, field);
  near(rows[119].rsi14, 50, "flat RSI is neutral, unlike technicalindicators' flat=100 convention");
  near(rows[101].crsi, 100 / 3, "flat CRSI: RSI3=50, streakRSI2=50, strict-less rank=0");
  const outside = fromCloses(Array(30).fill(100)).map((c, i) => ({ ...c, high: 101 + i, low: 99 - i }));
  const result = computeResearchFeatures(outside, H);
  near(result[29].plusDI14, 0, "tied up/down movement excludes plus DM");
  near(result[29].minusDI14, 0, "tied up/down movement excludes minus DM");
  near(result[29].adx14, 0, "zero DI sum gives zero DX");
});

test("CRSI rank excludes current return and becomes usable at 102 closes", () => {
  for (const [lastClose, expected] of [[110, 100], [90, 0]] as const) {
    const cs = fromCloses([...Array(101).fill(100), lastClose]);
    const result = computeResearchFeatures(cs, H);
    assert.equal(result[100].crsi, null);
    near(result[101].crsi, expected, `current return ${lastClose > 100 ? "above" : "below"} all prior returns`);
  }
  const ties = computeResearchFeatures(fromCloses(Array(102).fill(100)), H);
  near(ties[101].crsi, 100 / 3, "100 tied prior returns must not count as lower");
});

test("UTC VWAP uses actual turnover and resets; partial first day fails closed", () => {
  const cs = fromCloses(Array(26).fill(105));
  cs[0] = { ...cs[0], open: 100, high: 110, low: 90, volume: 2, turnover: 200 };
  cs[1] = { ...cs[1], open: 110, high: 115, low: 100, close: 112, volume: 1, turnover: 108 };
  cs[2] = { ...cs[2], volume: 0, turnover: 0 };
  cs[24] = { ...cs[24], volume: 3, turnover: 315 };
  const rows = computeResearchFeatures(cs, H);
  near(rows[0].vwapUtcDay, 100, "first actual quote/base VWAP");
  near(rows[1].vwapUtcDay, 308 / 3, "not typical-price or closing-price proxy");
  near(rows[2].vwapUtcDay, 308 / 3, "zero-volume bar retains cumulative VWAP");
  near(rows[24].vwapUtcDay, 105, "UTC midnight resets accumulated turnover");
  const partial = computeResearchFeatures(cs.slice(1), H);
  assert.ok(partial.slice(0, 23).every(row => row.vwapUtcDay === null));
  near(partial[23].vwapUtcDay, 105, "first observed complete UTC day begins at next midnight");
});

test("RVOL excludes current volume; zero denominators are null, not infinity", () => {
  const cs = fromCloses(Array(23).fill(100));
  cs[20] = { ...cs[20], volume: 100, turnover: 10_000 };
  cs[21] = { ...cs[21], volume: 0, turnover: 0 };
  const rows = computeResearchFeatures(cs, H);
  near(rows[20].rvol20, 10, "100 / prior twenty mean10, not current-inclusive mean14.5");
  near(rows[21].rvol20, 0, "zero current volume divided by positive prior mean");
  near(rows[22].rvol20, 10 / 14, "rolling window excludes expired first two bars");
  const zeros = computeResearchFeatures(cs.map(c => ({ ...c, volume: 0, turnover: 0 })), H);
  assert.ok(zeros.every(row => row.vwapUtcDay === null && row.rvol20 === null));
});

test("all feature values match independently weighted batch formulas", () => {
  for (const interval of [M, 5 * M, H, 4 * H, D]) {
    const cs = mixed(280, interval);
    const expected = batchReference(cs, interval), actual = computeResearchFeatures(cs, interval);
    assert.equal(actual.length, cs.length);
    for (let i = 0; i < cs.length; i++) {
      assert.equal(actual[i].timestamp, cs[i].timestamp);
      for (const field of fields) near(actual[i][field], expected[i][field], `${interval}ms ${field}[${i}]`);
    }
  }
});

test("independent technicalindicators RSI/ATR/ADX reference agrees on mixed nondegenerate candles", () => {
  const cs = mixed(300), actual = computeResearchFeatures(cs, H);
  const close = cs.map(c => c.close), high = cs.map(c => c.high), low = cs.map(c => c.low);
  const rsis = RSI.calculate({ values: close, period: 14 });
  const atrs = ATR.calculate({ close, high, low, period: 14 });
  const adxs = ADX.calculate({ close, high, low, period: 14 });
  assert.equal(rsis.length, cs.length - 14); assert.equal(atrs.length, cs.length - 14);
  assert.equal(adxs.length, cs.length - 27);
  rsis.forEach((value, i) => near(actual[i + 14].rsi14, value, `library RSI[${i + 14}] (library rounds 2 decimals)`, 0.0051));
  atrs.forEach((value, i) => near(actual[i + 14].atr14, value, `library ATR[${i + 14}]`));
  adxs.forEach((value, i) => {
    near(actual[i + 27].adx14, value.adx, `library ADX[${i + 27}]`);
    near(actual[i + 27].plusDI14, value.pdi, `library +DI[${i + 27}]`);
    near(actual[i + 27].minusDI14, value.mdi, `library -DI[${i + 27}]`);
  });
});

test("exact prefix invariance for every feature, frozen inputs and extreme future append", () => {
  const cs = mixed(300), before = JSON.stringify(cs);
  const frozen = Object.freeze(cs.map(c => Object.freeze({ ...c })));
  const all = computeResearchFeatures(frozen, H);
  for (const length of [0, 1, 5, 14, 15, 20, 21, 27, 28, 100, 101, 102, 199, 250, 300]) {
    assert.deepEqual(computeResearchFeatures(frozen.slice(0, length), H), all.slice(0, length), `prefix length ${length}`);
  }
  const future = fromCloses([1_000_000, 1, 999_999, 2], H, T + cs.length * H);
  const appended = computeResearchFeatures([...frozen, ...future], H);
  assert.deepEqual(appended.slice(0, all.length), all, "future extremes do not rewrite past indicators");
  assert.equal(JSON.stringify(cs), before, "input not mutated");
});

test("invalid, gapped, unsorted or duplicated inputs fail rather than stitch/reseed", () => {
  const cs = mixed(4);
  for (const interval of [0, -1, 1.5, NaN, Infinity, 7 * M, 2 * D])
    assert.throws(() => computeResearchFeatures(cs, interval), `invalid interval ${interval}`);
  assert.throws(() => computeResearchFeatures([cs[0], cs[2]], H), "gap");
  assert.throws(() => computeResearchFeatures([...cs].reverse(), H), "unsorted");
  assert.throws(() => computeResearchFeatures([cs[0], cs[0]], H), "duplicate");
  for (const changes of [
    { timestamp: T + 1 }, { timestamp: -H }, { timestamp: 1.5 }, { timestamp: Infinity },
    { open: 0 }, { close: -1 }, { high: 1 }, { low: 1_000 }, { high: NaN },
    { volume: -1 }, { volume: Infinity }, { turnover: -1 }, { turnover: NaN },
  ]) assert.throws(() => computeResearchFeatures([{ ...cs[0], ...changes }], H), JSON.stringify(changes));
  const afterWarmup = mixed(200);
  assert.throws(() => computeResearchFeatures(afterWarmup.filter((_, i) => i !== 110), H),
    "a gap after warmup may not silently preserve indicator eligibility");
});

console.log(`indicator feature tests passed (${groups} groups; hand fixtures, independent references, causality and validation)`);
