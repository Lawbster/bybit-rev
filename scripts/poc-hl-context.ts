/** PH01: unchanged NPOC trade outcomes joined to strictly pre-entry HL context. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { atomicJson, fileHash, sha } from './research-workflow';
import { TpHlTape, normalize, availableAt, reference, stats, MIN, type Kind, type Row, type Observation } from './tp-hl-event-features';
import { Inputs, SOURCES, csv } from './hype-tp-hl-event-atlas';
import { loadMinutes } from './relative-reversion-study';
export const ROOT = path.resolve(__dirname, '..'), CARD = 'research-inputs/poc-hl-context-ph01-2026-09-17.json';
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
export function money(xs: Row[]) {
  const wins = xs.filter(x => x.net > 0), losses = xs.filter(x => x.net < 0);
  const sum = (a: Row[]) => a.reduce((s, x) => s + x.net, 0);
  return { n: xs.length, wins: wins.length, losses: losses.length, winningDollars: sum(wins), losingDollars: sum(losses), net: sum(xs),
    average: xs.length ? sum(xs) / xs.length : null, avgWin: wins.length ? sum(wins) / wins.length : null,
    avgLoss: losses.length ? sum(losses) / losses.length : null, winRate: xs.length ? wins.length / xs.length : null,
    largestWin: Math.max(0, ...wins.map(x => x.net)), largestLoss: Math.min(0, ...losses.map(x => x.net)) };
}
export function predicate(f: Row, conditions: any[]): boolean | null {
  if (conditions.some(([k]) => typeof f[k] !== 'number' || !Number.isFinite(f[k]))) return null;
  return conditions.every(([k, op, v]) => op === '<' ? f[k] < v : op === '>' ? f[k] > v : op === '<=' ? f[k] <= v : op === '>=' ? f[k] >= v : (() => { throw new Error(op); })());
}
export function extraSnapshot(tape: TpHlTape, now: number, card: Row): Row {
  const s = tape.snapshot(now), flow = tape.flow(now, 60, card.legacyPublicationLagMs), f = s.features;
  f.takerRatio60 = flow.healthy ? flow.buySellRatio : null;
  f.buyShare60 = flow.healthy ? flow.buyShare : null;
  s.quality.flow60Healthy = flow.healthy;
  s.sources.taker60 = { sources: flow.sources, samples: flow.samples, start: flow.start, end: flow.end, ambiguous: flow.ambiguous };
  f.largeNetShare15 = f.largeBuy15Usd !== null && f.largeSell15Usd !== null && f.turnover15Usd > 0 ? (f.largeBuy15Usd - f.largeSell15Usd) / f.turnover15Usd : null;
  const current = tape.latest('asset', now, card.legacyPublicationLagMs);
  for (const span of [60, 240]) {
    const at = now - span * MIN, old = tape.latest('asset', at, card.legacyPublicationLagMs);
    const healthy = current && old && now - current.sourceAt <= card.freshnessMs.asset && at - old.sourceAt <= card.freshnessMs.asset;
    f[`assetNativeOiChange${span}Pct`] = healthy && current.data.openInterest > 0 && old.data.openInterest > 0 ? (current.data.openInterest / old.data.openInterest - 1) * 100 : null;
    s.sources[`asset_${span}m_anchor`] = old ? { ...reference(old, card.legacyPublicationLagMs), queryAt: at, fresh: healthy } : null;
  }
  return s;
}
export function featureRows(events: Row[], feature: string, split: number): Row {
  const known = events.filter(e => typeof e.features[feature] === 'number' && Number.isFinite(e.features[feature]));
  const compare = (xs: Row[]) => {
    const w = xs.filter(e => e.net > 0), l = xs.filter(e => e.net < 0);
    let winsHigher = 0; for (const x of w) for (const y of l) winsHigher += x.features[feature] > y.features[feature] ? 1 : x.features[feature] === y.features[feature] ? .5 : 0;
    return { all: money(xs), winners: stats(w.map(x => x.features[feature])), losers: stats(l.map(x => x.features[feature])),
      aucHigherPredictsWin: w.length && l.length ? winsHigher / (w.length * l.length) : null };
  };
  return { feature, missing: events.length - known.length, all: compare(known), early: compare(known.filter(e => e.signalAt < split)), late: compare(known.filter(e => e.signalAt >= split)) };
}
export function partition(events: Row[], definition: Row, split: number): Row {
  const a = events.filter(e => predicate(e.features, definition.conditions) === true), b = events.filter(e => predicate(e.features, definition.conditions) === false);
  const valid = [...a, ...b], unknown = events.filter(e => predicate(e.features, definition.conditions) === null);
  const groups = (xs: Row[]) => ({ baselineKnown: money(xs), condition: money(xs.filter(e => predicate(e.features, definition.conditions))),
    other: money(xs.filter(e => predicate(e.features, definition.conditions) === false)) });
  const early = groups(valid.filter(e => e.signalAt < split)), late = groups(valid.filter(e => e.signalAt >= split));
  const monthly = [...new Set(events.map(e => e.month))].sort().map(month => ({ month, ...groups(valid.filter(e => e.month === month)), missing: money(unknown.filter(e => e.month === month)) }));
  return { id: definition.id, conditions: definition.conditions, ...groups(valid), missing: money(unknown), early, late, monthly,
    conditionIds: a.map(e => e.id), otherIds: b.map(e => e.id),
    conditionWithoutLargestWin: money(a.filter(e => e.id !== [...a].sort((x, y) => y.net - x.net)[0]?.id)),
    otherWithoutLargestLoss: money(b.filter(e => e.id !== [...b].sort((x, y) => x.net - y.net)[0]?.id)) };
}
export function sourceReferences(s: Row): Row[] {
  return Object.values(s.sources).flatMap((x: any) => !x ? [] : x.sources ? x.sources.map((r: Row) => ({ ...r, queryAt: s.asOf })) : [{ ...x, queryAt: x.queryAt ?? s.asOf }]);
}
export async function main() {
  const c = read(CARD), parent = path.resolve(ROOT, c.parent), plan = read(c.parent + '/plan.json'), seal = read(c.parent + '/complete.json');
  assert(read(c.parent + '/independent-verification.json').passed); assert.equal(plan.key, seal.key);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(parent, a.file)), a.sha256);
  const base = read(c.parent + '/' + c.baselineFile), delayed = read(c.parent + '/' + c.delayFile), signals = read(c.parent + '/signals.json');
  const firstParent = read(plan.card.parent + '/plan.json');
  const old = read(plan.card.parent + '/full-0-naked_day_touch.json');
  for (const k of ['trades', 'open', 'stats', 'monthly', 'accepted']) assert.deepEqual(base[k], old[k]);
  assert.equal(base.trades.length, 238); assert.equal(base.stats.wins, 125); assert.equal(base.stats.losses, 113);
  assert(Math.abs(base.stats.net - 15962.223502909226) < 1e-7);
  const end = Date.parse(c.end), from = Date.parse(c.from), split = Date.parse(c.chronologicalSplit);
  const selected: Row[] = base.trades.filter((t: Row) => t.signalAt >= from);
  console.log(`[PH01] exact accepted baseline: 238 trades; ${selected.length} entries since earliest HL period`);
  const pins: Row[] = [];
  for (const file of [CARD, 'scripts/poc-hl-context.ts', 'scripts/poc-hl-context-tests.ts', 'scripts/poc-hl-context-verify.ts',
    'scripts/tp-hl-event-features.ts', 'scripts/hype-tp-hl-event-atlas.ts', 'scripts/relative-reversion-study.ts',
    c.parent + '/plan.json', c.parent + '/complete.json', c.parent + '/independent-verification.json']) pins.push({ file, sha256: await fileHash(path.resolve(ROOT, file)) });
  // Reuse the exact candle inputs of the accepted parent. No refresh/download.
  for (const p of plan.pins.filter((p: Row) => p.file.startsWith('data/') || p.file.endsWith('/repair.json'))) {
    assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, 'Accepted candle input changed: ' + p.file); pins.push(p);
  }
  const { candles } = await loadMinutes(ROOT, 'HYPEUSDT', end, firstParent.card.repair);
  const cs = new Map(candles.map(x => [x.ts, x]));
  const pct = (x: number, y: number) => (x / y - 1) * 100;
  const bybitFeatures = (at: number) => {
    const close = cs.get(at - MIN), prev = cs.get(at - 16 * MIN);
    const complete = Array.from({ length: 16 }, (_, i) => cs.has(at - (i + 1) * MIN)).every(Boolean);
    return { bybitReturn15Pct: complete && close && prev ? pct(close.close, prev.close) : null };
  };
  const ranges = selected.map(t => [t.signalAt - 260 * MIN, t.signalAt]);
  const retain = (at: number) => ranges.some(([a, b]) => at >= a && at <= b);
  const inputs = new Inputs(), tape = new TpHlTape(c), inventory: Row[] = [];
  for (const [kind, file] of SOURCES) {
    const inv: Row = { kind, file, rows: 0, retained: 0, first: null, last: null, malformed: 0 };
    await inputs.rows(file, (raw, line) => {
      inv.rows++; const o = normalize(kind, raw, file, line);
      inv.first = Math.min(inv.first ?? Infinity, o.sourceAt); inv.last = Math.max(inv.last ?? 0, o.sourceAt);
      if (o.sourceAt <= end && retain(o.sourceAt)) { tape.add(o); inv.retained++; }
    });
    inventory.push(inv); console.log(`[PH01] ${kind}: ${inv.retained}/${inv.rows} rows retained`);
  }
  tape.seal(); pins.push(...inputs.pins);
  const key = sha(JSON.stringify({ card: c, pins })), out = path.resolve(ROOT, 'backtests/poc-hl-context', key);
  assert(!fs.existsSync(out), 'Immutable job already exists'); fs.mkdirSync(out, { recursive: true });
  const write = (file: string, value: any) => atomicJson(path.join(out, file), value);
  write('plan.json', { key, card: c, pins, createdAt: Date.now() });
  write('baseline-parity.json', { passed: true, exactArchivedFields: ['trades', 'open', 'stats', 'monthly', 'accepted'], stats: base.stats });
  write('source-inventory.json', inventory); write('retained-observations.json', tape.rows);
  const events: Row[] = [], paths: Row[] = [];
  for (const t of selected) {
    const s = signals.find((s: Row) => s.id === t.id); assert(s && s.signalAt === s.touchStart + MIN && t.entryAt === s.signalAt);
    assert(s.availableAt <= s.touchStart);
    const snapshots = c.relativeMinutes.map((offset: number) => {
      const at = s.signalAt + offset * MIN, snap = extraSnapshot(tape, at, c);
      Object.assign(snap.features, bybitFeatures(at));
      for (const r of sourceReferences(snap)) assert(r.availableAt <= r.queryAt && r.sourceAt <= r.queryAt, 'Future source');
      const row = { eventId: t.id, offset, ...snap }; paths.push(row); return row;
    });
    const snap = snapshots.at(-1)!, delay = snapshots.find((s: Row) => s.offset === -1)!;
    const inside: any[] = [];
    for (let at = t.entryAt; at < t.exitAt; at += MIN) { const x = cs.get(at); assert(x); inside.push(x); }
    const mfe = pct(Math.max(...inside.map(x => x.high)), t.entryPrice), mae = pct(Math.min(...inside.map(x => x.low)), t.entryPrice);
    const e: Row = { ...t, entryIso: new Date(t.entryAt).toISOString(), exitIso: new Date(t.exitAt).toISOString(),
      month: new Date(t.entryAt).toISOString().slice(0, 7), closeMonth: new Date(t.exitAt).toISOString().slice(0, 7),
      split: t.signalAt < split ? 'early' : 'late', outcome: t.net > 0 ? 'win' : t.net < 0 ? 'loss' : 'flat',
      pocLower: s.lower, pocUpper: s.upper, profileEnd: s.profileEnd, touchStart: s.touchStart,
      entryDistancePocPct: pct(t.entryPrice, (s.lower + s.upper) / 2),
      features: snap.features, quality: snap.quality, sourceDelayFeatures: delay.features, sourceDelayQuality: delay.quality,
      delayedExecution: delayed.trades.find((x: Row) => x.id === t.id) ?? null,
      outcomePath: { mfePct: mfe, maePct: mae, ralliedOnePct: mfe >= 1,
        return1hPct: pct(cs.get(t.entryAt + 60 * MIN)!.open, t.entryPrice), return3hPct: pct(cs.get(t.entryAt + 180 * MIN)!.open, t.entryPrice),
        diagnosticOnly: true } };
    events.push(e);
  }
  const rich = events.filter(e => e.quality.coreHealthy), lagEvents = events.map(e => ({ ...e, features: e.sourceDelayFeatures, quality: e.sourceDelayQuality }));
  const fields = [...new Set(events.flatMap(e => Object.keys(e.features)))];
  const summaries = fields.map(f => featureRows(events, f, split));
  const partitions = c.diagnosticPredicates.map((d: Row) => partition(events, d, split));
  const lagPartitions = c.diagnosticPredicates.map((d: Row) => partition(lagEvents, d, split));
  const commonPartitions = c.diagnosticPredicates.map((d: Row) => partition(rich, d, split));
  const monthlies = [...new Set(events.map(e => e.month))].sort().map(month => ({ month, all: money(events.filter(e => e.month === month)), core: money(rich.filter(e => e.month === month)) }));
  const pairedLeadIn = c.primaryFeatures.map((feature: string) => {
    const ids = events.filter(e => paths.filter(p => p.eventId === e.id).every(p => p.features[feature] !== null)).map(e => e.id);
    return { feature, covered: ids.length, offsets: c.relativeMinutes.map((offset: number) => {
      const rows = paths.filter(p => p.offset === offset && ids.includes(p.eventId));
      return { offset, wins: stats(rows.filter(p => events.find(e => e.id === p.eventId)!.net > 0).map(p => p.features[feature])),
        losses: stats(rows.filter(p => events.find(e => e.id === p.eventId)!.net < 0).map(p => p.features[feature])) };
    }) };
  });
  const summary = { fullBaseline: money(base.trades), earliestHlPeriod: money(events), coreCovered: money(rich),
    coreEarly: money(rich.filter(e => e.signalAt < split)), coreLate: money(rich.filter(e => e.signalAt >= split)),
    noCoreInHlPeriod: money(events.filter(e => !e.quality.coreHealthy)), beforeEarliestHl: money(base.trades.filter((t: Row) => t.signalAt < from)),
    firstCoreEntry: rich[0]?.entryIso, lastCoreEntry: rich.at(-1)?.entryIso, monthlies,
    corePathLabels: { winning: { n: rich.filter(e => e.net > 0).length, firstHourNegative: rich.filter(e => e.net > 0 && e.outcomePath.return1hPct < 0).length },
      losing: { n: rich.filter(e => e.net < 0).length, ralliedOnePct: rich.filter(e => e.net < 0 && e.outcomePath.ralliedOnePct).length,
        neverOnePct: rich.filter(e => e.net < 0 && !e.outcomePath.ralliedOnePct).length } },
    empiricalSignalsNotCausalReasons: true, historicalReceiptNotProven: true, economicVariants: 0 };
  write('summary.json', summary); write('events.json', events); write('pre-entry-trajectories.json', paths);
  write('feature-comparisons.json', summaries); write('partitions.json', partitions); write('source-delay-partitions.json', lagPartitions);
  write('core-cohort-partitions.json', commonPartitions); write('paired-lead-in.json', pairedLeadIn);
  fs.writeFileSync(path.join(out, 'events.csv'), csv(events.map(e => ({ id: e.id, dateUtc: e.entryIso, exitUtc: e.exitIso, pocLower: e.pocLower, pocUpper: e.pocUpper,
    entryPrice: e.entryPrice, exitPrice: e.exitPrice, net: e.net, outcome: e.outcome, coreHealthy: e.quality.coreHealthy, ...e.features, ...e.outcomePath }))));
  fs.writeFileSync(path.join(out, 'partitions-monthly.csv'), csv(partitions.flatMap((p: Row) => p.monthly.map((m: Row) => ({ id: p.id, month: m.month,
    baselineN: m.baselineKnown.n, baselineNet: m.baselineKnown.net, conditionN: m.condition.n, conditionWins: m.condition.wins,
    conditionLosses: m.condition.losses, conditionWinDollars: m.condition.winningDollars, conditionLossDollars: m.condition.losingDollars,
    conditionNet: m.condition.net, otherN: m.other.n, otherNet: m.other.net, missingN: m.missing.n })))));
  const fmt = (x: number | null, p = 0) => x === null ? 'NA' : x.toFixed(p);
  let report = '# PH01: HL context at daily NPOC touch\n\nDescriptive fixed-cohort attribution; not a filter replay. $10k, fixed12h, taker fees; funding excluded.\n\n';
  report += '| Cohort | W/L | Win$ | Loss$ | Net$ | Avg loss$ |\n|---|---:|---:|---:|---:|---:|\n';
  for (const [name, m] of Object.entries({ fullBaseline: summary.fullBaseline, earliestHlPeriod: summary.earliestHlPeriod, coreCovered: summary.coreCovered,
    coreEarly: summary.coreEarly, coreLate: summary.coreLate, noCoreInHlPeriod: summary.noCoreInHlPeriod }))
    report += `|${name}|${m.wins}/${m.losses}|${fmt(m.winningDollars)}|${fmt(m.losingDollars)}|${fmt(m.net)}|${fmt(m.avgLoss)}|\n`;
  report += '\n## Fixed diagnostic partitions\n\nEach row has its own known-feature denominator. No subset DD or strategy uplift claimed.\n\n| Condition | Known baseline n/net$ | True W/L, net$ | False W/L, net$ | Early true/false avg$ | Later true/false avg$ | Unknown n |\n|---|---:|---:|---:|---:|---:|---:|\n';
  for (const p of partitions) report += `|${p.id}|${p.baselineKnown.n}/${fmt(p.baselineKnown.net)}|${p.condition.wins}/${p.condition.losses}, ${fmt(p.condition.net)}|${p.other.wins}/${p.other.losses}, ${fmt(p.other.net)}|${fmt(p.early.condition.average)}/${fmt(p.early.other.average)}|${fmt(p.late.condition.average)}/${fmt(p.late.other.average)}|${p.missing.n}|\n`;
  report += '\n## Primary feature distributions\n\n| Feature | Known W/L | Winner median | Loser median | Early AUC | Later AUC |\n|---|---:|---:|---:|---:|---:|\n';
  for (const f of summaries.filter(r => c.primaryFeatures.includes(r.feature))) report += `|${f.feature}|${f.all.all.wins}/${f.all.all.losses}|${fmt(f.all.winners.median, 4)}|${fmt(f.all.losers.median, 4)}|${fmt(f.early.aucHigherPredictsWin, 3)}|${fmt(f.late.aucHigherPredictsWin, 3)}|\n`;
  report += '\nAUC is descriptive ranking probability (higher feature in a winner than a loser), not validated model accuracy.\n\n## Every trade\n\n| UTC entry | POC band | W/L | Net$ | Taker15 | Taker60 | Book0.5 | OI15% | Core |\n|---|---|---|---:|---:|---:|---:|---:|---|\n';
  for (const e of events) report += `|${e.entryIso}|${e.pocLower}-${e.pocUpper}|${e.outcome}|${fmt(e.net)}|${fmt(e.features.takerRatio15, 3)}|${fmt(e.features.takerRatio60, 3)}|${fmt(e.features.bookImbalance05, 3)}|${fmt(e.features.assetNativeOiChange15Pct, 3)}|${e.quality.coreHealthy}|\n`;
  fs.writeFileSync(path.join(out, 'report.md'), report);
  for (const pin of pins) assert.equal(await fileHash(path.resolve(ROOT, pin.file)), pin.sha256, 'Changed input ' + pin.file);
  const artifacts = []; for (const f of fs.readdirSync(out).sort()) artifacts.push({ file: f, sha256: await fileHash(path.join(out, f)) });
  write('complete.json', { key, artifacts, generationChecks: true, economicVariants: 0 });
  console.log('[PH01] ' + out); console.log(JSON.stringify(summary, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
