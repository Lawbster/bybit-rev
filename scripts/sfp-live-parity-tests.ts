/** Verify shared policy against saved SF08 evidence; no strategy search or HTTP. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert/strict';
import { readSealedMinutes, ROOT } from './setup-scan-core';
import { buildContext, M, H, D, type Minute, type SetupEvent } from '../src/strategies/setup-context';
import { sf01RangeLow } from '../src/strategies/sfp-detector';
import { sfpActions } from '../src/strategies/sfp-policy';
import { sfpDecision } from '../src/bot/sfp-candles';

const job = 'backtests/sfp-latest-candles/54be78de76c7ad891c249711ce5d0f8144dbdc9b8604e193f9a355c1b117f73e';
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, job, f), 'utf8'));
const digest = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const narrow = (a: any) => ({ id: a.id, at: a.at, expiresAt: a.expiresAt, stop: a.stop, target: a.target });
const card = read('plan.json').card, start = Date.parse('2024-12-27T00:00:00Z'), end = Date.parse(card.cutoff);
let checks = 0;
for (const f of read('complete.json').artifacts) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, job, f.file))).digest('hex'), f.sha256); checks++;
}
let rolling = 0, controls = 0, warmupUnavailable = 0;
for (const lag of [M, 2 * M]) {
  const prefix = readSealedMinutes(ROOT, card.sealedPrefix, lag).minutes;
  const tail: Minute[] = read('extension-candles.json').map((m: Minute) => ({ ...m, availableAt: m.endTs + lag }));
  const minutes = [...prefix, ...tail];
  const saved: SetupEvent[] = fs.readFileSync(path.join(ROOT, job, `events-modeled-${lag}.jsonl`), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const ctx = buildContext({ symbol: 'HYPEUSDT', minutes, lagMs: lag, window: { start, end }, params: {} });
  const current = sf01RangeLow.detect(ctx).filter(e => e.knownAt >= start && e.knownAt < end);
  assert.equal(digest(current.filter(e => e.stage === 'confirmed')), digest(saved.filter(e => e.stage === 'confirmed')),
    `shared detector changed confirmed events at lag ${lag}`);
  const actions = read(`pad5-10000-lag${lag}-full-delay0-stop-normal-actions.json`).actions;
  assert.deepEqual(sfpActions(current).map(narrow), actions.map(narrow), 'shared action policy changed frozen brackets');
  checks += 2;
  if (lag !== M) continue; // Deployed clock is 60s; 120s remains a full-stream sensitivity.
  const times = new Set(saved.filter(e => e.stage === 'confirmed').map(e => e.knownAt));
  // Negative-control boundaries distributed over the entire history.
  for (let t = Math.ceil((start + 32 * D) / (4 * H)) * 4 * H + M; t < end; t += 7 * D) times.add(t);
  const locate = (t: number) => { let l = 0, r = minutes.length; while (l < r) { const mid = (l + r) >>> 1; if (minutes[mid].ts < t) l = mid + 1; else r = mid; } return l; };
  for (const at of [...times].sort((a, b) => a - b)) {
    const since = Math.floor((at - 32 * D) / (4 * H)) * 4 * H;
    if (minutes[0].ts > since) { warmupUnavailable++; continue; }
    const rows = minutes.slice(locate(since), locate(at));
    const d = sfpDecision(rows, at, start);
    assert(d.healthy, `${new Date(at).toISOString()}: ${d.reason}`);
    const expected = sfpActions(saved).filter(a => a.at === at);
    assert.deepEqual(d.signals, expected, `rolling context mismatch ${at}`);
    rolling++; if (!expected.length) controls++;
    if (rolling <= 3) {
      const poisoned = [...rows, { ...rows.at(-1)!, ts: at + M, endTs: at + 2 * M, high: 1e9, availableAt: at + 3 * M }];
      assert.deepEqual(sfpDecision(poisoned, at, start).signals, d.signals, 'future candle leaked');
      const late = rows.map(m => m.endTs === at - M ? { ...m, availableAt: at + M } : m);
      assert.equal(sfpDecision(late, at, start).healthy, false, 'late finalized minute accepted');
      assert.equal(sfpDecision(rows.filter(m => m.endTs !== at - M), at, start).healthy, false, 'missing latest minute accepted');
      checks += 3;
    }
  }
}
const report = { job, checks, rollingBoundaries: rolling, negativeControls: controls, initialWarmupUnavailable: warmupUnavailable,
  exactConfirmedEventsAndActionsAt60And120s: true, futureLateGapChecks: true, historicalArtifactsUnmodified: true };
console.log(JSON.stringify(report));
