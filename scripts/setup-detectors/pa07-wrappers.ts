/**
 * Wrappers exposing the independently verified PA07 detectors (scripts/price-action-signals.ts) as
 * scanner detectors. Parameters are read from the frozen PA07 card so a scan hit means the same thing
 * as a PA07 event. These require a contiguous minute tape (PA07 asserts it); the scanner trims to the
 * final contiguous segment when the live tape has gaps and says so in the summary.
 */
import fs from 'fs';
import path from 'path';
import { buildPriceActionSignals } from '../price-action-signals';
import { H, ROOT, type DetectorContext, type SetupDetector, type SetupEvent, type Side, type StageMark } from '../setup-scan-core';

const CARD = 'research-inputs/price-action-pa07-2026-09-18.json';
const card = (): Record<string, unknown> => { const c = JSON.parse(fs.readFileSync(path.join(ROOT, CARD), 'utf8')); return c.definition ?? c; };
const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

function toMinutes(ctx: DetectorContext) {
  return ctx.minutes.map(m => ({ ts: m.ts, endTs: m.endTs, open: m.open, high: m.high, low: m.low, close: m.close, volume: m.volume, turnover: m.turnover }));
}

function convert(rows: Record<string, any>[], mechanisms: string[], setup: string, version: string, family: string): SetupEvent[] {
  const out: SetupEvent[] = [];
  for (const e of rows) {
    if (!mechanisms.includes(e.mechanism ?? e.family) && !(e.family === family && !e.mechanism)) continue;
    const side = e.side as Side; if (side !== 1 && side !== -1) continue;
    const stage: SetupEvent['stage'] = e.stage === 'confirmed' ? 'confirmed' : e.stage === 'pending_at_cutoff' ? 'pending_at_cutoff' : e.stage === 'expired' || e.stage === 'expiry' ? 'expired' : e.stage === 'invalidated' ? 'invalidated' : 'rejected';
    const knownAt = num(e.knownAt, num(e.formationKnownAt, num(e.confirmationEnd, e.formationAt) + 60_000));
    const stages: Record<string, StageMark> = {};
    if (e.reference) stages.reference = { at: e.reference.pivotAt, knownAt: e.reference.availableAt, price: e.reference.price };
    if (e.sweepBar) stages.sweep = { at: e.sweepBar.timestamp, knownAt: num(e.formationKnownAt, knownAt), price: side === 1 ? e.sweepBar.low : e.sweepBar.high };
    if (e.breakBar) stages.break = { at: e.breakBar.timestamp, knownAt: num(e.formationKnownAt, knownAt), price: e.breakBar.close };
    if (e.originZone) stages.zone = { at: e.originZone.source?.timestamp ?? e.formationAt, knownAt: num(e.formationKnownAt, knownAt), price: side === 1 ? e.originZone.high : e.originZone.low, note: `[${e.originZone.low}, ${e.originZone.high}]` };
    if (e.impulseBar) stages.impulse = { at: e.impulseBar.timestamp, knownAt, price: e.impulseBar.close };
    if (e.retestBar) stages.retest = { at: e.retestBar.timestamp, knownAt, price: e.retestBar.close };
    out.push({ id: `${setup}:${e.id}`, setup, version, side, stage, reason: e.reason ?? e.failure ?? (stage === 'confirmed' ? undefined : String(e.stage)),
      formationAt: num(e.terminalAt, e.formationAt), knownAt, stages, reference: { pa07Id: e.id, mechanism: e.mechanism ?? e.family, reference: e.reference, targetPivot: e.targetPivot, originZone: e.originZone },
      // PA07 emits the simpler control (sweep reclaim / structure break) as the family row without a `mechanism`;
      // the candidate rows carry `mechanism` sweep_impulse / origin_retest.
      proxies: { entry: null, stop: typeof e.stop === 'number' ? e.stop : null, target: typeof e.target === 'number' ? e.target : null }, notes: !e.mechanism || String(e.mechanism).endsWith('_control') ? ['pa07_control_row'] : [] });
  }
  return out.sort((a, b) => a.knownAt - b.knownAt || a.id.localeCompare(b.id));
}

const shared = (): Record<string, number | string> => {
  const c = card();
  return { pivotWidth: num(c.pivotWidth, 2), levelMaxAgeHours: num(c.levelMaxAgeHours, 168), breakBufferPct: num(c.breakBufferPct, 0.1), stopBufferPct: num(c.stopBufferPct, 0.1), originLookbackBars: num(c.originLookbackBars, 12), retestExpiryHours: num(c.retestExpiryHours, 12), impulseExpiryHours: num(c.impulseExpiryHours, 6), impulseAtrBars: num(c.impulseAtrBars, 14), impulseBodyFraction: num(c.impulseBodyFraction, 0.6), impulseAtrMultiple: num(c.impulseAtrMultiple, 1), discountMax: num(c.discountMax, 0.4), premiumMin: num(c.premiumMin, 0.6), holdHours: num(c.holdHours, 24), triggerMinutes: 60, contextMinutes: 240 };
};

export const pa06SweepImpulse: SetupDetector = {
  id: 'PA06', version: 'pa07-v1', title: 'Sweep plus first opposite impulse (PA07 implementation)', family: 'sweep',
  aliases: ['sweep', 'sweep impulse', 'liquidity sweep', 'sweep and impulse', 'pa6'],
  libraryCard: 'research/setup-library/price-action.md#PA06',
  defaults: shared(), requiresContiguous: true, warmupMs: 21 * 24 * H,
  conventions: ['Exact PA07 frozen definitions (docs/research/price-action-pa07.md): 4h bracket pivots (2/2), first 1h breach/reclaim in the bottom/top 40% of the bracket, impulse within 6h with body >= 60% of range and range >= 14-bar mean true range.', 'Rows tagged pa07_control_row are the sweep-only control; the candidate is the impulse-confirmed row.'],
  detect(ctx) { const built = buildPriceActionSignals(toMinutes(ctx), { ...shared(), ...ctx.params }, ctx.lagMs); return convert(built.events, ['sweep_control', 'sweep_impulse', 'sweep'], 'PA06', 'pa07-v1', 'sweep'); },
};

export const pa03OriginRetest: SetupDetector = {
  id: 'PA03', version: 'pa07-v1', title: 'Origin-zone return after a structure break (PA07 implementation)', family: 'origin',
  aliases: ['origin zone', 'orderblock', 'order block', 'ob retest', 'origin retest', 'supply demand', 'pa3'],
  libraryCard: 'research/setup-library/price-action.md#PA03',
  defaults: shared(), requiresContiguous: true, warmupMs: 21 * 24 * H,
  conventions: ['Exact PA07 frozen definitions: 1h close breaks a known 1h pivot by 0.1%, origin = last opposite-colour 1h candle in the prior 12 bars, full-wick box, first return within 12h closing back beyond the near edge.', 'Rows tagged pa07_control_row are the break-only control; the candidate is the confirmed first return.'],
  detect(ctx) { const built = buildPriceActionSignals(toMinutes(ctx), { ...shared(), ...ctx.params }, ctx.lagMs); return convert(built.events, ['break_control', 'origin_retest', 'origin'], 'PA03', 'pa07-v1', 'origin'); },
};
