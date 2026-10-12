#!/usr/bin/env node
'use strict';
// Presentation export of sealed receipts/curves. No signal generation or trading calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { deserialize } = require('node:v8');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'backtests/hype-2026-search-hs01';
const JOINT = `${BASE}/phase2-three-slot-macd-r3-20353c1cfb96d6d5`;
const BOOK = `${BASE}/phase2-fungible-crsi-three-slots-9cef77d4cc002770`;
const PARITY = 'backtests/portfolio-joint-receipt-parity/ef58d80524e4f355/verification.json';
const OUTPUT = 'docs/operations/assets/portfolio-replay-data.js';
const MANIFEST = 'docs/operations/assets/portfolio-replay-manifest.json';
const M = 60000, START = Date.parse('2026-01-01T00:00:00Z'), END = Date.parse('2026-10-10T12:51:00Z');
const SEED = 19047.16, FEE = .00055;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = f => fs.readFileSync(path.join(ROOT, f));
const json = f => JSON.parse(bytes(f));
const textHash = f => hash(bytes(f).toString('utf8').replace(/\r\n?/g, '\n'));
const configHash = f => f.endsWith('.json') ? hash(JSON.stringify(json(f))) : textHash(f);
const pins = {};
const sum = a => a.reduce((n, x) => n + x, 0);
function near(a, b, label) { assert(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`); }
function sealed(dir, file, binary = false) {
  const f = `${dir}/${file}`, b = bytes(f), seal = json(`${dir}/complete.json`);
  pins[f] = hash(b); assert.equal(pins[f], seal.outputs[file], `Seal mismatch: ${f}`);
  const raw = file.endsWith('.gz') ? gunzipSync(b) : b;
  return binary ? deserialize(raw) : JSON.parse(raw);
}
function month(at) { return new Date(at).toISOString().slice(0, 7); }

// Drawdowns retain the study convention: prior close-equity peak to the worst
// of the two intraminute OHLC paths. Monthly peak resets at opening equity.
function summarizeCurve(curve, candles, seed, originalSeed) {
  assert.equal(curve.fundedMarks.length, candles.length);
  const shift = seed - originalSeed, months = [], equity = [];
  let previous = seed, peak = seed, ddUsd = 0, ddPct = 0, m;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i], marked = curve.fundedMarks[i] + shift, low = curve.fundedLows[i] + shift, key = month(c.endTs);
    if (!m || m.month !== key) {
      m = { month: key, opening: previous, ending: previous, net: 0, ddUsd: 0, ddPct: 0,
        carriedDdPct: 0, peak: previous, through: c.endTs, wins: 0, losses: 0, breakeven: 0, bySetup: {} };
      months.push(m);
    }
    ddUsd = Math.max(ddUsd, peak - low); ddPct = Math.max(ddPct, 100 * (peak - low) / peak);
    m.ddUsd = Math.max(m.ddUsd, m.peak - low); m.ddPct = Math.max(m.ddPct, 100 * (m.peak - low) / m.peak);
    m.carriedDdPct = Math.max(m.carriedDdPct, 100 * (peak - low) / peak);
    m.net += marked - previous; m.ending = marked; m.through = c.endTs;
    m.peak = Math.max(m.peak, marked); peak = Math.max(peak, marked); previous = marked;
    if (i % 60 === 0 || i === candles.length - 1) equity.push([c.endTs / 1000, +marked.toFixed(4)]);
  }
  months.forEach(x => delete x.peak);
  return { summary: { net: previous - seed, ending: previous, ddUsd, ddPct }, monthly: months, equity };
}

// Allocate actual archived rung closes, NOT a synthetic average-cost partial.
function groupTrades(fills, inventory, settlements, decisions, candles, monthly) {
  const source = new Map(decisions.map(d => [d.id, d.source]));
  const main = fills.filter(f => f.owner === 'main'); assert.equal(main.length, inventory.length);
  const event = new Map(main.map((f, i) => {
    const e = inventory[i]; near(f.qty, e.event.qty, 'rung quantity'); near(f.price, e.event.price, 'rung price');
    assert.equal(f.id, `ladder:${e.episode}`); assert.equal(f.at + f.phase * M, e.event.fillAt);
    return [f, e];
  }));
  const trades = [], active = new Map(), entryFees = new Map(), markers = [];
  const timeline = fills.map(f => ({ at: f.at + f.phase * M, rank: f.phase ? -2 : 0, f }));
  timeline.push(...settlements.filter(s => s.at >= START && s.at < END).map(s => ({ at: s.at, rank: -1, s })));
  timeline.sort((a, b) => a.at - b.at || a.rank - b.rank);
  let cursor = 0;
  function apply(row) {
    if (row.s) {
      for (const t of active.values()) t.funding += t.side * t.qty * row.s.mark * row.s.rate;
      return;
    }
    const f = row.f, e = event.get(f);
    let t = active.get(f.owner);
    if (f.kind === 'open') {
      if (!t) {
        t = { id: f.id, setup: f.owner === 'main' ? 'Ladder' : f.owner === 'R3' ? 'R3' : source.get(f.id),
          owner: f.owner, side: f.side, entryAt: row.at, entryPrice: f.price, exitAt: null, exitPrice: null,
          qty: 0, cost: 0, pricePnl: 0, fees: 0, funding: 0, notional: 0, peakNotional: 0,
          adds: 0, maxRungs: 0, partials: [], events: [], reason: 'open_at_cutoff' };
        assert(t.setup, 'Missing setup source'); trades.push(t); active.set(f.owner, t);
      }
      assert.equal(t.id, f.id); assert.equal(t.side, f.side);
      t.qty += f.qty; t.cost += f.qty * f.price; t.notional += f.qty * f.price; t.fees += f.fee; t.adds++;
      if (e) {
        const added = e.after.filter(p => !e.before.some(b => b.id === p.id)); assert.equal(added.length, 1);
        entryFees.set(added[0].id, f.fee);
        t.maxRungs = Math.max(t.maxRungs, e.after.length);
      }
      t.peakNotional = Math.max(t.peakNotional, t.cost);
    } else {
      assert(t && t.id === f.id && t.qty >= f.qty - 1e-7, 'Orphan close');
      let releasedCost, releasedEntryFees = 0;
      if (e) {
        const after = new Map(e.after.map(p => [p.id, p]));
        let closedQty = 0; releasedCost = 0;
        for (const p of e.before) {
          const qty = p.qty - (after.get(p.id)?.qty ?? 0); closedQty += qty; releasedCost += qty * p.entryPrice;
          const allocated = (entryFees.get(p.id) ?? 0) * qty / p.qty;
          releasedEntryFees += allocated; entryFees.set(p.id, (entryFees.get(p.id) ?? 0) - allocated);
        }
        near(closedQty, f.qty, 'Partial rung allocation');
      } else { releasedCost = t.cost * f.qty / t.qty; releasedEntryFees = t.fees; }
      const realized = t.side * (f.qty * f.price - releasedCost);
      t.pricePnl += realized; t.fees += f.fee; t.qty -= f.qty; t.cost -= releasedCost;
      if (e) { near(t.qty, sum(e.after.map(p => p.qty)), 'Surviving rung quantity'); near(t.cost, sum(e.after.map(p => p.qty * p.entryPrice)), 'Surviving cost'); }
      if (t.qty < 1e-7) { t.qty = 0; t.cost = 0; t.exitAt = row.at; t.exitPrice = f.price; t.reason = f.reason; active.delete(f.owner); }
      else {
        t.partials.push({ at: row.at, price: f.price, qty: f.qty, notional: f.qty * f.price,
          netBeforeFunding: realized - f.fee - releasedEntryFees, reason: f.reason });
      }
    }
    t.events.push({ at: row.at, kind: f.kind, price: f.price, qty: f.qty, reason: f.reason ?? 'entry' });
    markers.push({ at: row.at, id: t.id, setup: t.setup, side: t.side, kind: f.kind,
      entry: f.kind === 'open' && t.adds === 1, partial: f.kind === 'close' && t.qty > 0, price: f.price });
  }
  const contribution = (t, price) => t.pricePnl - t.fees - t.funding + t.side * (t.qty * price - t.cost) - t.qty * price * FEE;
  let previousBySetup = {};
  for (const m of monthly) {
    while (timeline[cursor] && (timeline[cursor].at < m.through || timeline[cursor].at === m.through && timeline[cursor].rank <= -2)) apply(timeline[cursor++]);
    const c = candles[(m.through - M - START) / M]; assert.equal(c.endTs, m.through);
    const cumulative = {};
    for (const t of trades) cumulative[t.setup] = (cumulative[t.setup] ?? 0) + contribution(t, c.close);
    for (const setup of new Set([...Object.keys(previousBySetup), ...Object.keys(cumulative)]))
      m.bySetup[setup] = (cumulative[setup] ?? 0) - (previousBySetup[setup] ?? 0);
    near(sum(Object.values(m.bySetup)), m.net, `Per-setup month ${m.month}`);
    previousBySetup = cumulative;
  }
  assert.equal(cursor, timeline.length, 'Unconsumed cutoff receipts');
  for (const t of trades) {
    t.net = contribution(t, candles.at(-1).close);
    t.unrealized = t.side * (t.qty * candles.at(-1).close - t.cost) - t.qty * candles.at(-1).close * FEE;
    if (t.exitAt !== null) {
      const m = monthly.find(m => m.month === month(t.exitAt)); assert(m);
      m[t.net > 1e-7 ? 'wins' : t.net < -1e-7 ? 'losses' : 'breakeven']++;
    }
    delete t.qty; delete t.cost; delete t.pricePnl;
  }
  return { trades, markers };
}

function aggregate(candles, minutes) {
  const rows = []; let b;
  for (const c of candles) {
    const at = Math.floor(c.ts / (minutes * M)) * minutes * 60;
    if (!b || b[0] !== at) { b = [at, c.open, c.high, c.low, c.close]; rows.push(b); }
    else { b[2] = Math.max(b[2], c.high); b[3] = Math.min(b[3], c.low); b[4] = c.close; }
  }
  return rows;
}
function build() {
  const parity = json(PARITY); assert(parity.passed); pins[PARITY] = hash(bytes(PARITY));
  const config = json('portfolio-live-config.json');
  assert.equal(config.policy, 'HS01-P2-THREE-SLOT-MACD-R3:v1'); assert.equal(config.initialEquity, SEED);
  assert.equal(hash(JSON.stringify(json('bot-config.json'))), config.mainConfigSha256, 'Ladder config no longer matches portfolio pin');
  const baselineSeal = json(`${BASE}/batch1-8ba35b11707731ad/complete.json`);
  assert.equal(hash(bytes('bot-config.json')), baselineSeal.pins.find(p => p.file === 'bot-config.json').sha256,
    'Current ladder config differs from the archived parent input; review before refreshing');
  const candles = sealed(`${BASE}/series-651090cf9a5e415d`, 'series.v8.gz', true).s.candles.filter(c => c.ts >= START && c.ts < END);
  assert.equal(candles.length, 406851);
  candles.forEach((c, i) => { assert.equal(c.ts, START + i * M); assert.equal(c.endTs, c.ts + M); });
  const book = sealed(BOOK, 'fresh-structural-control.json.gz');
  const settlements = sealed(`${BASE}/funding-extension`, 'settlements.json');
  const paths = [];
  for (const tp of ['resting_touch', 'close_confirmed']) {
    const id = `three_slot_macd_r3-${tp}-32000`;
    const curves = sealed(JOINT, `${id}-curves.json.gz`), fills = sealed(JOINT, `${id}-fills.json.gz`);
    const inventory = sealed(`${BASE}/batch1-8ba35b11707731ad`, `baseline-${tp}-32000-inventory.json.gz`);
    const p = summarizeCurve(curves, candles, SEED, 32000);
    const reference = parity.results.find(r => r.tp === tp && r.seed === SEED); assert(reference);
    near(p.summary.net, reference.fundedNet, 'Net parity'); near(p.summary.ddPct, reference.fundedDrawdownPct, 'DD parity');
    assert.equal(fills.length, reference.receipts);
    p.monthly.forEach(m => near(m.net, reference.monthly[m.month], 'Archived month'));
    const grouped = groupTrades(fills, inventory, settlements, book.decisions, candles, p.monthly);
    near(sum(grouped.trades.map(t => t.net)), p.summary.net, 'All episode totals incl open mark');
    near(sum(grouped.trades.map(t => t.fees)), curves.summary.fees, 'Trading fees');
    near(sum(grouped.trades.map(t => t.funding)), curves.summary.funding, 'Funding allocations');
    p.summary.fees = curves.summary.fees; p.summary.funding = curves.summary.funding;
    p.summary.closed = grouped.trades.filter(t => t.exitAt !== null).length;
    p.summary.open = grouped.trades.length - p.summary.closed;
    p.summary.wins = sum(p.monthly.map(m => m.wins)); p.summary.losses = sum(p.monthly.map(m => m.losses));
    p.summary.partials = sum(grouped.trades.map(t => t.partials.length));
    p.summary.receipts = fills.length;
    paths.push({ key: tp, ...p, ...grouped });
  }
  const stress = sealed(`${BASE}/phase2-three-slot-macd-19k`, 'results.json').rows
    .filter(r => r.mode === 'market5').map(r => ({ tp: r.tp, seed: r.seed, net: r.summary.fundedNet, ddPct: r.summary.fundedDd }));
  const data = { version: 1, policy: config.policy, start: START, end: END, seed: SEED,
    candleMinutes: 15, candles: aggregate(candles, 15), paths, stress,
    evidence: { receiptsAudit: PARITY, study: 'research/codex-astra-hype-2026-three-slot-macd-19k-findings-2026-10-10.md' } };
  const compact = JSON.stringify(data).replace(/</g, '\\u003c');
  const script = '// Generated by scripts/build-portfolio-replay-reference.cjs. Simulated history, not live fills.\nwindow.PORTFOLIO_REPLAY = ' + compact + ';\n';
  const manifest = { version: 1, output: OUTPUT, sha256: hash(script), sourcePins: pins,
    configPins: Object.fromEntries(['bot-config.json', 'portfolio-live-config.json', 'src/bot/portfolio/contract.ts'].map(f => [f, configHash(f)])),
    generator: textHash('scripts/build-portfolio-replay-reference.cjs'),
    checks: { sealedSources: true, receiptGrouping: true, monthlyAttribution: true, feeFundingTotals: true, capitalAndDDSeed: SEED },
    counts: paths.map(p => ({ tp: p.key, ...p.summary })) };
  for (const [f, pin] of Object.entries(pins)) assert.equal(hash(bytes(f)), pin, `Changed input ${f}`);
  fs.mkdirSync(path.dirname(path.join(ROOT, OUTPUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUTPUT), script);
  fs.writeFileSync(path.join(ROOT, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output: OUTPUT, bytes: Buffer.byteLength(script), months: 10, paths: manifest.counts }));
}
function check() {
  const m = json(MANIFEST); assert.equal(textHash(OUTPUT), m.sha256);
  assert.equal(textHash('scripts/build-portfolio-replay-reference.cjs'), m.generator);
  for (const [f, pin] of Object.entries(m.configPins)) assert.equal(configHash(f), pin, `Historical reference needs review: ${f}`);
  console.log('Historical reference bundle, generator and config pins match.');
}
function test() {
  const cs = [{ ts: START, endTs: START + M }, { ts: START + M, endTs: START + 2 * M }];
  const c = summarizeCurve({ fundedMarks: [110, 105], fundedLows: [95, 90] }, cs, 100, 100);
  near(c.summary.net, 5, 'Synthetic net'); near(c.summary.ddUsd, 20, 'DD dollars'); near(c.summary.ddPct, 100 * 20 / 110, 'DD percent');
  const a = { id: 'a', qty: 1, entryPrice: 100 }, b = { id: 'b', qty: 1, entryPrice: 90 };
  const fills = [[0, 'open', 100], [1, 'open', 90], [2, 'close', 110], [3, 'close', 95]]
    .map(([i, kind, price]) => ({ at: START + i * M, phase: 0, owner: 'main', id: 'ladder:1', kind, side: 1, qty: 1, price, fee: price * FEE, reason: kind === 'open' ? 'time_add' : i === 2 ? 'sr_partial' : 'tp' }));
  const inv = [[[], [a]], [[a], [a, b]], [[a, b], [b]], [[b], []]].map(([before, after], i) => ({
    episode: 1, before, after, event: { qty: 1, price: fills[i].price, fillAt: fills[i].at } }));
  const monthly = [{ month: '2026-01', through: START + 4 * M, net: 14.58275, wins: 0, losses: 0, breakeven: 0, bySetup: {} }];
  const grouped = groupTrades(fills, inv, [{ at: START + 2 * M, mark: 100, rate: .001 }], [],
    [100, 90, 110, 95].map((close, i) => ({ ts: START + i * M, endTs: START + (i + 1) * M, close })), monthly);
  assert.equal(grouped.trades.length, 1); assert.equal(grouped.trades[0].partials.length, 1);
  near(grouped.trades[0].partials[0].netBeforeFunding, 9.8845, 'Exact removed-rung partial, not average-cost profit');
  near(grouped.trades[0].funding, .2, 'Funding before boundary close');
  near(grouped.trades[0].net, 14.58275, 'Parent counts partial once');
  assert.equal(grouped.trades[0].entryAt, START); assert.equal(grouped.trades[0].exitAt, START + 3 * M);
  check(); console.log('Drawdown fixture and artifact checks passed.');
}
if (require.main === module) {
  try { const arg = process.argv[2]; assert(process.argv.length <= 3 && [undefined, '--check', '--test'].includes(arg));
    if (arg === '--check') check(); else if (arg === '--test') test(); else build();
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { summarizeCurve, groupTrades, aggregate, check };
