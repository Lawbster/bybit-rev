/** Independently reconstruct weekly VWAP/ROC from raw minutes, not feature arrays. */
import assert from "assert/strict";
import type { Candle } from "./hype-freerun-canonical-replay";
import type { WeeklyObservation, WeeklyPolicy } from "./mfi-weekly-exit-policy";
const M = 60000, H = 60 * M, DAY = 86400000;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
export function auditWeekly(cs: Candle[], obs: WeeklyObservation[], policy: WeeklyPolicy, lag: number) {
  let checked = 0, vetoes = 0, unknown = 0;
  for (const o of obs) {
    if (!policy.weeklyRequired) { assert.equal(o.weekly, undefined); continue; }
    if (!["scheduled", "weekly_not_weak", "weekly_unknown"].includes(o.status)) { assert.equal(o.weekly, undefined); continue; }
    assert(o.at === o.dueAt && o.mfi?.value !== null && o.mfi!.value! <= 20 && o.weekly);
    const e = o.weekly, end = Math.floor((o.at! - lag) / H) * H, i = (end - cs[0].endTs) / M;
    assert(cs[i]?.endTs === end); assert.equal(e.sourceEnd, end); assert.equal(e.sourceStart, end - H); assert.equal(e.availableAt, end + lag);
    const date = new Date(end - M), day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const week = day - ((date.getUTCDay() + 6) % 7) * DAY;
    let volume = 0, turnover = 0;
    for (let j = (week - cs[0].ts) / M; j <= i; j++) { assert(cs[j].endTs <= end); volume += cs[j].volume; turnover += cs[j].turnover; }
    assert(volume > 0 && e.ready); near(e.close!, cs[i].close); near(e.vwap!, turnover / volume); assert.equal(e.weekStart, week);
    near(e.distancePct!, 100 * (cs[i].close / (turnover / volume) - 1));
    assert.equal(e.rocAnchorEnd, end - 5 * H); near(e.roc5!, 100 * (cs[i].close / cs[i - 300].close - 1));
    const pass = cs[i].close < turnover / volume && cs[i].close <= cs[i - 300].close;
    assert.equal(e.passes, pass); assert.equal(o.status, pass ? "scheduled" : "weekly_not_weak");
    checked++; if (o.status === "weekly_not_weak") vetoes++; if (!e.ready) unknown++;
  }
  return { checked, vetoes, unknown };
}
