/** Tests for the weak-week time stop predicate and its exact-minute seven-day reference adapter. */
import assert from "assert/strict";
import { evaluateTimeStop, validateTimeStopParams, TIME_STOP_RESEARCH_PARAMS, TIME_STOP_LOOKBACK_MS, type TimeStopPosition } from "../src/bot/time-stop";
import { ExactMinuteHistory, referenceMinuteStart, MINUTE_MS } from "../src/bot/time-stop-history";
import { isTpLifecycleClose } from "../src/bot/long-close-finalizer";
import type { Candle } from "../src/fetch-candles";

const H = 3_600_000, P = TIME_STOP_RESEARCH_PARAMS, T = Date.UTC(2026, 8, 25, 12, 0);
const rung = (entryTime: number, entryPrice: number, notional: number): TimeStopPosition => ({ entryTime, notional, qty: notional / entryPrice });
const ladder = (oldest: number) => [rung(oldest, 100, 800), rung(oldest + H, 100, 1080)];
const input = (positions: TimeStopPosition[], close: number, ref: number | null, refTime: number | null = T - TIME_STOP_LOOKBACK_MS) =>
  ({ positions, decisionClose: close, decisionCloseTime: T, referenceClose: ref, referenceCloseTime: ref === null ? null : refTime });

// ---- predicate ----
{
  assert.equal(evaluateTimeStop(input([], 100, 100), P).blockedBy, "no_inventory");
  assert.equal(evaluateTimeStop(input([{ entryTime: T - 50 * H, notional: 800, qty: 0 }], 100, 100), P).blockedBy, "invalid_input");
  // age boundary: 40h - 1ms holds, exactly 40h passes
  assert.equal(evaluateTimeStop(input(ladder(T - 40 * H + 1), 99, 100), P).blockedBy, "age");
  const at40 = evaluateTimeStop(input(ladder(T - 40 * H), 99, 100), P);
  assert.equal(at40.fire, true); assert.equal(at40.ageHours, 40);
  // gross boundary: exactly break-even fires (<= 0), any profit holds
  const even = evaluateTimeStop(input(ladder(T - 50 * H), 100, 100), P);
  assert.equal(even.grossPct, 0); assert.equal(even.fire, true);
  assert.equal(evaluateTimeStop(input(ladder(T - 50 * H), 100.0001, 101), P).blockedBy, "gross");
  // ret7d boundary: flat week fires, up week holds
  assert.equal(evaluateTimeStop(input(ladder(T - 50 * H), 99, 99), P).ret7dPct, 0);
  assert.equal(evaluateTimeStop(input(ladder(T - 50 * H), 99, 99), P).fire, true);
  assert.equal(evaluateTimeStop(input(ladder(T - 50 * H), 99, 98.99), P).blockedBy, "ret7d");
  // reference missing / misaligned by one minute either way: never fire, but the ladder is reported age-eligible
  const missing = evaluateTimeStop(input(ladder(T - 50 * H), 99, null), P);
  assert.equal(missing.blockedBy, "reference_missing"); assert.equal(missing.ageEligible, true); assert.equal(missing.fire, false);
  for (const off of [-MINUTE_MS, MINUTE_MS]) assert.equal(evaluateTimeStop(input(ladder(T - 50 * H), 99, 100, T - TIME_STOP_LOOKBACK_MS + off), P).blockedBy, "reference_misaligned");
  // the oldest SURVIVING rung sets the age: after an S/R partial removed the oldest rung, a 39h ladder holds
  const survivors = [rung(T - 39 * H, 100, 1080), rung(T - 30 * H, 98, 1458)];
  assert.equal(evaluateTimeStop(input(survivors, 97, 100), P).blockedBy, "age");
  // average is sum(notional)/sum(qty) across mixed entries
  const mixed = [rung(T - 45 * H, 110, 800), rung(T - 44 * H, 90, 1080)];
  const avg = (800 + 1080) / (800 / 110 + 1080 / 90);
  assert.equal(evaluateTimeStop(input(mixed, 97, 100), P).grossPct, (97 / avg - 1) * 100);
  // reason is a forced-close reason, never a TP lifecycle close
  assert.match(at40.reason, /^TIME STOP: oldest 40\.0h, gross -1\.00%, ret7d -1\.00%$/);
  assert.equal(isTpLifecycleClose(at40.reason), false);
  // params
  assert.throws(() => validateTimeStopParams({ minAgeHours: 0, maxGrossPct: 0, ret7dMaxPct: 0 }));
  assert.throws(() => validateTimeStopParams({ minAgeHours: 40, maxGrossPct: NaN, ret7dMaxPct: 0 }));
  validateTimeStopParams(P); assert.equal(Object.isFrozen(P), true);
  assert.deepEqual({ ...P }, { minAgeHours: 40, maxGrossPct: 0, ret7dMaxPct: 0 });
}

// ---- timing: decision minute -> reference minute ----
{
  const decisionStart = Date.UTC(2026, 8, 25, 12, 34), decisionClose = decisionStart + MINUTE_MS;
  assert.equal(referenceMinuteStart(decisionClose, TIME_STOP_LOOKBACK_MS), decisionStart - TIME_STOP_LOOKBACK_MS);
  // the reference candle closes exactly 7 days before the decision candle closes
  assert.equal(decisionClose - (referenceMinuteStart(decisionClose, TIME_STOP_LOOKBACK_MS) + MINUTE_MS), TIME_STOP_LOOKBACK_MS);
}

// ---- exact-minute adapter ----
async function adapterTests() {
  let now = Date.UTC(2026, 8, 25, 12, 0, 30);
  const calls: Array<{ limit: number; end: number }> = [];
  const candle = (ts: number, close: number): Candle => ({ timestamp: ts, open: close, high: close, low: close, close, volume: 1, turnover: close });
  let respond: (limit: number, end: number) => Candle[] = (limit, end) => Array.from({ length: limit }, (_, i) => { const ts = end + 1 - (limit - i) * MINUTE_MS; return candle(ts, 50 + ts / 1e12); });
  let pending: Array<() => void> = [], hold = false;
  const fetcher = (_s: string, interval: string, limit: number, end?: number) => {
    assert.equal(interval, "1"); calls.push({ limit, end: end! });
    const rows = respond(limit, end!);
    return hold ? new Promise<Candle[]>(res => pending.push(() => res(rows))) : Promise.resolve(rows);
  };
  const h = new ExactMinuteHistory(fetcher, "HYPEUSDT", { now: () => now, retryBaseMs: 5_000, retryMaxMs: 60_000, prefetchMinutes: 60, cacheSize: 120 });
  const ref = Date.UTC(2026, 8, 18, 11, 58);

  // a minute that has not closed yet is never fetched
  await h.request(Math.floor(now / MINUTE_MS) * MINUTE_MS);
  assert.equal(calls.length, 0);

  // one fetch caches the minute and the next 59; exact end/limit
  await h.request(ref);
  assert.deepEqual(calls[0], { limit: 60, end: ref + 60 * MINUTE_MS - 1 });
  assert.notEqual(h.get(ref), null); assert.notEqual(h.get(ref + 59 * MINUTE_MS), null); assert.equal(h.get(ref + 60 * MINUTE_MS), null);
  assert.equal(h.status().unansweredSince, null); assert.equal(h.status().wanted, null);
  await h.request(ref + 30 * MINUTE_MS); assert.equal(calls.length, 1, "cached minute: no refetch");

  // single request in flight
  hold = true;
  const p1 = h.request(ref + 60 * MINUTE_MS), p2 = h.request(ref + 60 * MINUTE_MS);
  assert.equal(h.status().inFlight, true); await new Promise(r => setImmediate(r));
  assert.equal(calls.length, 2, "second request while in flight does not fetch again");
  pending.forEach(f => f()); pending = []; hold = false; await Promise.all([p1, p2]);
  assert.equal(h.status().inFlight, false); assert.notEqual(h.get(ref + 60 * MINUTE_MS), null);

  // a response missing the exact minute (neighbours only) does not satisfy it: no substitute
  const gap = ref + 400 * MINUTE_MS;
  respond = (limit, end) => Array.from({ length: limit }, (_, i) => candle(end + 1 - (limit - i) * MINUTE_MS, 77)).filter(c => c.timestamp !== gap);
  await h.request(gap);
  assert.equal(h.get(gap), null); assert.equal(h.get(gap + MINUTE_MS), 77); assert.match(h.status().lastError!, /not returned/);
  respond = (limit, end) => Array.from({ length: limit }, (_, i) => candle(end + 1 - (limit - i) * MINUTE_MS, 77));
  now += 5_000; await h.request(gap); assert.equal(h.get(gap), 77);
  // misaligned timestamps (off by 30s) are rejected outright
  const target = ref + 200 * MINUTE_MS;
  respond = (limit, end) => Array.from({ length: limit }, (_, i) => candle(end + 1 - (limit - i) * MINUTE_MS + 30_000, 99));
  await h.request(target);
  assert.equal(h.get(target), null); assert.equal(h.get(target + MINUTE_MS), null); assert.equal(h.status().failures, 1); assert.match(h.status().lastError!, /not returned/);
  const since = h.status().unansweredSince; assert.equal(since, now);

  // backoff is global: a NEW wanted minute inside the backoff window does not refetch
  const n = calls.length;
  now += 1_000; await h.request(target + MINUTE_MS); assert.equal(calls.length, n);
  assert.equal(h.status().unansweredSince, since, "still unanswered since the first miss");
  // second failure doubles the wait
  now += 5_000; await h.request(target + MINUTE_MS); assert.equal(calls.length, n + 1); assert.equal(h.status().failures, 2);
  assert.equal(h.status().nextAttemptAt, now + 10_000);
  // a thrown fetch error is contained
  respond = () => { throw new Error("network down"); };
  now += 10_000; await h.request(target + MINUTE_MS); assert.equal(h.status().failures, 3); assert.match(h.status().lastError!, /network down/);
  // recovery resets failures and clears the unanswered clock
  respond = (limit, end) => Array.from({ length: limit }, (_, i) => candle(end + 1 - (limit - i) * MINUTE_MS, 42));
  now += 20_000; await h.request(target + MINUTE_MS);
  assert.equal(h.get(target + MINUTE_MS), 42); assert.equal(h.status().failures, 0); assert.equal(h.status().unansweredSince, null);

  // cache stays bounded
  assert.ok(h.status().cached <= 120);
  assert.throws(() => h.request(ref + 1), /whole minute/);
  assert.throws(() => new ExactMinuteHistory(fetcher, "X", { prefetchMinutes: 100, cacheSize: 50 }));
}

adapterTests().then(() => console.log("time stop tests passed")).catch(e => { console.error(e); process.exitCode = 1; });
