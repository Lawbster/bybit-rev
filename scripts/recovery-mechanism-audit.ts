/** F05 reference checks: raw frames, inventory arming and independent transition predicates. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent } from "./replay-causal-engine";
import type { Policy } from "./recovery-mechanism-policy";
type R = Record<string, any>;
const M = 60000, B = 5 * M;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
export function auditFrames(cs: Candle[], obs: R[], lag: number) {
  let frames = 0;
  for (const o of obs) if (o.frame) {
    const end = o.at - lag - (o.at - lag) % B, j = (end - cs[0].endTs) / M;
    const a = o.frame, raw = cs.slice(j - 4, j + 1); assert.equal(raw.length, 5);
    assert.equal(a.end, end); assert.equal(a.availableAt, end + lag); assert(a.availableAt <= o.at);
    raw.forEach((c, i) => assert.equal(c.endTs, end - (4 - i) * M));
    near(a.close, raw[4].close); near(a.open, raw[0].open); near(a.high, Math.max(...raw.map(x => x.high))); near(a.low, Math.min(...raw.map(x => x.low)));
    near(a.roc15, 100 * (raw[4].close / cs[j - 15].close - 1));
    const k = (Math.floor(end / (15 * M)) * 15 * M - cs[0].endTs) / M; near(a.prior15High, Math.max(...cs.slice(k - 14, k + 1).map(x => x.high)));
    frames++;
  }
  return frames;
}
export function auditMfiRaw(cs: Candle[], obs: R[], lag: number) {
  let checked = 0;
  for (const o of obs) if (o.mfi) {
    const end = Math.floor((o.dueAt - lag) / (30 * M)) * 30 * M, bars: R[] = [];
    for (let k = 15; k >= 1; k--) {
      const start = end - k * 30 * M, i = (start - cs[0].ts) / M, xs = cs.slice(i, i + 30); assert.equal(xs.length, 30);
      bars.push({ typical: (Math.max(...xs.map(c => c.high)) + Math.min(...xs.map(c => c.low)) + xs[29].close) / 3, volume: xs.reduce((n, c) => n + c.volume, 0) });
    }
    let plus = 0, minus = 0;
    for (let k = 1; k < bars.length; k++) { if (bars[k].typical > bars[k - 1].typical) plus += bars[k].typical * bars[k].volume; if (bars[k].typical < bars[k - 1].typical) minus += bars[k].typical * bars[k].volume; }
    if (plus + minus === 0) assert.equal(o.mfi.value, null); else near(o.mfi.value, 100 * plus / (plus + minus));
    assert.equal(o.mfi.sourceEnd, end); assert.equal(o.mfi.availableAt, end + lag); checked++;
  } return checked;
}
export function auditRecovery(cs: Candle[], events: ResearchInventoryEvent[], obs: R[], vetoes: R[], policy: Policy, cfg: R, lag: number, delay: number, start: number, end: number) {
  const signals = obs.filter(o => o.status === "signal"), frames = auditFrames(cs, obs, lag);
  const signalMap = new Map(signals.map(o => [o.episode, o])); assert.equal(signalMap.size, signals.length);
  const arms = obs.filter(o => o.status === "armed"), inventoryByIndex = new Map<number, ResearchInventoryEvent>();
  for (const e of events) inventoryByIndex.set(e.event.fillIndex!, e);
  const recordAt = new Map<number, R[]>(obs.filter(o => o.at != null).map(o => [o.at, []]));
  for (const o of obs) if (o.at != null) recordAt.get(o.at)!.push(o);
  let inventory: ResearchInventoryEvent["after"] = [], episode = 0, lastFrame = -Infinity;
  const first = new Map<number, number>();
  for (let i = start; i < end; i++) {
    const e = inventoryByIndex.get(i); if (e) { inventory = e.after; episode = e.episode; }
    const at = cs[i].endTs, qty = inventory.reduce((n, p) => n + p.qty, 0), cost = inventory.reduce((n, p) => n + p.notional, 0);
    const gross = qty ? 100 * (cs[i].close * qty / cost - 1) : null;
    for (const o of recordAt.get(at) ?? []) { assert.equal(o.episode, episode); assert.equal(o.depth, inventory.length); near(o.price, cs[i].close);
      if (gross === null) assert.equal(o.grossPct, null); else near(o.grossPct, gross); }
    const frame = Math.floor((at - lag) / B) * B;
    if (frame > lastFrame) { lastFrame = frame; if (!first.has(episode) && inventory.length >= cfg.minDepth && gross !== null && gross <= cfg.armGrossPct) first.set(episode, at); }
  }
  if (policy.family !== "weekly") assert.deepEqual(arms.map(o => [o.episode, o.at]), [...first], "all first eligible distress arms, not only future losers");
  // Independent local state progression: checks transition necessity and signal completeness.
  if (policy.family !== "weekly") for (const arm of arms) {
    let phase = "watch", low = arm.frame.close, failLow = NaN, high = NaN;
    const rows = obs.filter(o => o.episode === arm.episode && o.at > arm.at && ["observe", "transition", "ordinary_exit_priority"].includes(o.status));
    let prevEnd = arm.frame.end;
    for (const o of rows) {
      const f = o.frame; assert.equal(f.end, prevEnd + B); prevEnd = f.end; assert.equal(o.phase, phase); assert(o.at <= arm.expiresAt);
      let transition = "", fire = false;
      if (policy.family === "support") {
        assert(arm.support.knownAt <= arm.frame.end && arm.support.distancePct <= cfg.supportMaxDistancePct);
        const boundary = arm.support.price * (1 - cfg.breakBufferPct / 100);
        if (phase === "watch" && f.close < boundary) transition = "broken";
        else if (phase === "broken" && f.high >= boundary && f.close < boundary) { transition = "retested"; failLow = f.low; }
        else if (phase === "retested") fire = f.close < failLow * (1 - cfg.breakBufferPct / 100);
      } else if (policy.family === "rebound") {
        if (phase === "watch") { if ((f.close / low - 1) * 100 >= cfg.reboundPct - 1e-10) { transition = "bounced"; failLow = f.low; } else low = Math.min(low, f.close); }
        else fire = f.close < failLow * (1 - cfg.breakBufferPct / 100);
      } else {
        assert(o.pulse.flowHealthy); if (policy.family === "sell_oi") assert(o.pulse.oiHealthy && o.previousPulse.flowHealthy);
        const condition = policy.family === "buy_failure" ? o.pulse.ratio >= cfg.flowBuyRatio && f.roc15 <= 0
          : o.pulse.ratio <= cfg.flowSellRatio && o.pulse.ratio < o.previousPulse.ratio && o.pulse.nativeOi1hPct >= cfg.nativeOiMinPct;
        if (phase === "watch" && condition) { transition = "pressure"; failLow = f.low; high = f.high; }
        else if (phase === "pressure") { assert(f.close < high * (1 + cfg.reclaimBufferPct / 100)); fire = f.close < failLow * (1 - cfg.breakBufferPct / 100); }
      }
      if (transition) { assert.equal(o.status, "transition"); assert.equal(o.nextPhase, transition); phase = transition; }
      else assert.notEqual(o.status, "transition");
      const actual = signalMap.get(arm.episode); assert.equal(!!actual && actual.at === o.at, fire && o.canReduce, "actual rule truth versus signal");
      if (fire) { assert.equal(o.canReduce, !o.pendingReason); break; }
    }
  }
  let cuts = 0; const locks = new Set<number>();
  for (const e of events) {
    const x = e.event;
    if (x.kind === "open") {
      assert(!locks.has(e.episode), "no rebuild after half+freeze");
      const signal = signalMap.get(e.episode);
      if (signal && policy.action === "freeze") assert(x.decisionAt < signal.effectiveAt, "no order decided after freeze effective time");
    }
    if (x.reason.startsWith("research_exit:")) {
      const signal = signalMap.get(e.episode); assert(signal); assert.equal(x.decisionAt, signal.at); assert.equal(x.fillAt, signal.at + delay);
      assert.equal(x.fillIndex, x.decisionIndex + 1 + delay / M); assert.equal(x.kind, "partial"); assert.notEqual(policy.action, "freeze");
      near(x.qty, .5 * e.before.reduce((n, p) => n + p.qty, 0)); if (policy.action === "half_freeze") locks.add(e.episode); cuts++;
    }
  }
  for (const v of vetoes) { assert.equal(policy.action, "freeze"); const s = signalMap.get(v.episode); assert(s && v.at >= s.effectiveAt); }
  return { frames, arms: arms.length, signals: signals.length, cuts, vetoes: vetoes.length,
    signalTimes: signals.map(s => ({ episode: s.episode, at: s.at, effectiveAt: s.effectiveAt })),
    notFilled: policy.action === "freeze" ? [] : signals.filter(s => !events.some(e => e.episode === s.episode && e.event.reason.startsWith("research_exit:"))).map(s => ({ episode: s.episode, at: s.at })) };
}
