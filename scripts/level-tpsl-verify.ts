/** LV02 independent receipts/first-touch/ownership/monthly audit. No replay call. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { gunzipSync } from 'zlib';
import { cachedCandles, ROOT } from './level-playbook-study';
import { atomicJson, fileHash } from './research-workflow';
const M = 60000, H = 60 * M;
const read = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, f), 'utf8'));
const near = (a: number, b: number, text = '') => assert(Math.abs(a - b) < 1e-6 + Math.abs(b) * 1e-10, `${text}: ${a} != ${b}`);
const nextMonth = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); };
export async function main() {
  const latest = read('backtests/level-tpsl/latest.json'), dir = process.argv[2] ?? latest.directory;
  const plan = read(dir + '/plan.json'), seal = read(dir + '/complete.json'), c = plan.card;
  assert.equal(seal.key, plan.key);
  for (const p of plan.pins) assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256, p.file);
  for (const a of seal.artifacts) assert.equal(await fileHash(path.resolve(ROOT, dir, a.file)), a.sha256, a.file);
  const cs = cachedCandles(c.cache), start = cs[0].ts, gs = read(dir + '/groups.json'), results = read(dir + '/results.json');
  const primaryRows = new Map(results.filter((r: any) => !r.targetFirst).map((r: any) => [r.id + ':' + r.window + ':' + r.delay, r])) as Map<string, any>;
  const original = read(c.parent + '/signals.json').signals, touch = read(c.pocParent + '/signals.json');
  assert.equal(read(dir + '/baseline-parity.json').paths, 198); assert(read(c.parent + '/independent-verification.json').passed);
  for (const g of gs) {
    const expected = g.entry === 'pb02_daily_naked_touch' ? touch.map((s: any) => ({ id: s.id, at: s.signalAt, side: 1 }))
      : original[g.entry].filter((s: any) => s.side === g.side).map((s: any) => ({ id: s.id, at: s.at, side: s.side }));
    assert.deepEqual(g.signals, expected);
  }
  const bar = (at: number) => { const b = cs[(at - start) / M]; assert(b && b.ts === at); return b; };
  // Each signal's future price path is scanned only for execution outcomes,
  // never for entry eligibility. Record first barrier hits independently of
  // producer, then truncate at each window/timeout during ownership audit.
  const hits = new Map<string, { target: number[]; stop: number[] }>(); let hitMinutes = 0;
  function firstHits(entryAt: number, side: number, delay: number) {
    const key = `${entryAt}:${side}:${delay}`, old = hits.get(key); if (old) return old;
    const p = bar(entryAt).open, target = c.tpPct.map(() => Infinity), stop = c.slPct.map(() => Infinity);
    const tp = c.tpPct.map((v: number) => p * (1 + side * v / 100)), sl = c.slPct.map((v: number) => p * (1 - side * v / 100));
    for (let at = entryAt; at < Math.min(entryAt + c.holdHours * H + delay, cs.at(-1)!.endTs); at += M) {
      const b = bar(at); hitMinutes++;
      for (let j = 0; j < tp.length; j++) if (target[j] === Infinity && (side === 1 ? b.high >= tp[j] : b.low <= tp[j])) target[j] = at;
      for (let j = 0; j < sl.length; j++) if (stop[j] === Infinity && (side === 1 ? b.low <= sl[j] : b.high >= sl[j])) stop[j] = at;
    }
    const value = { target, stop }; hits.set(key, value); return value;
  }
  let paths = 0, receipts = 0, ddPaths = 0, ddMinutes = 0, monthRows = 0;
  const already = new Set<string>();
  for (const g of gs) {
    const fd = fs.openSync(path.resolve(ROOT, dir, g.id + '.journals.gz'), 'r');
    const times = new Set<number>(g.signals.map((s: any) => s.at));
    for (const row of results.filter((r: any) => r.group === g.id)) {
      const identity = row.journal + ':' + row.journalOffset;
      if (already.has(identity)) {
        // A reused target-first journal is legal only for an ambiguity-free
        // stop-first path and must retain every reported economic metric.
        const primary = primaryRows.get(row.id + ':' + row.window + ':' + row.delay);
        assert(row.targetFirst && !row.ambiguous);
        for (const k of Object.keys(row).filter(k => k !== 'targetFirst')) assert.deepEqual(row[k], primary[k], k);
        paths++; continue;
      }
      already.add(identity);
      const bytes = Buffer.alloc(row.journalBytes); let received = 0;
      while (received < bytes.length) { const n = fs.readSync(fd, bytes, received, bytes.length - received, row.journalOffset + received); assert(n > 0); received += n; }
      const run = JSON.parse(gunzipSync(bytes).toString('utf8')), o = run.options;
      assert.equal(o.delay, row.delay); assert.equal(o.targetFirst, row.targetFirst);
      const isTimed = row.tpPct === null;
      const minuteAudit = isTimed || row.tpPct === row.slPct || (row.tpPct === 2 && row.slPct === 5) || (row.tpPct === 5 && row.slPct === 2);
      const ms = new Map<string, any>(run.monthly.map((m: any) => [m.month, { wins: 0, losses: 0, winningDollars: 0, losingDollars: 0, closedNet: 0, markedNet: 0 }]));
      let mEnd = 0, currentMonth: any, cash = c.equity, lastMark = cash, peak = cash, dd = 0, closeDd = 0, bankrupt = false;
      const observe = (at: number, value: number, adverse: number) => {
        if (at >= mEnd) { currentMonth = ms.get(new Date(at).toISOString().slice(0, 7)); mEnd = nextMonth(at); }
        if (minuteAudit) { dd = Math.max(dd, (peak - adverse) / peak * 100); peak = Math.max(peak, value);
          closeDd = Math.max(closeDd, (peak - value) / peak * 100); bankrupt ||= adverse <= 0; }
        currentMonth.markedNet += value - lastMark; lastMark = value;
      };
      let freeAt = o.start, raw = 0, skipped = 0, pending = false, fees = 0, turnover = 0, exposure = 0, ti = 0, closed = 0, ambiguities = 0;
      const accepted: any[] = []; let open: any = null;
      for (const s of g.signals) {
        if (s.at < o.start || s.at >= o.end) continue; raw++;
        if (s.at < freeAt) { skipped++; continue; }
        const entryAt = s.at + o.delay; if (entryAt >= o.end) { pending = true; break; }
        accepted.push({ at: s.at, id: s.id });
        const price = bar(entryAt).open, qty = c.notional / price, feeIn = c.notional * c.fee;
        const tp = isTimed ? null : price * (1 + s.side * row.tpPct / 100), sl = isTimed ? null : price * (1 - s.side * row.slPct / 100);
        const deadline = entryAt + o.hold + o.delay, cap = Math.min(deadline, o.end);
        let exitAt = deadline, reason = 'timeout', exit: number | null = null, both = false, adversePrice: number | null = null;
        if (!isTimed) {
          const first = firstHits(entryAt, s.side, o.delay), tt = first.target[c.tpPct.indexOf(row.tpPct)], st = first.stop[c.slPct.indexOf(row.slPct)];
          const hit = Math.min(tt, st);
          if (hit < cap) {
            const b = bar(hit), gapStop = s.side * (b.open - sl!) <= 0, gapTarget = s.side * (b.open - tp!) >= 0;
            both = !gapStop && !gapTarget && tt === st; if (both) ambiguities++;
            reason = gapStop ? 'stop' : gapTarget ? 'target' : st === hit && (tt !== hit || !row.targetFirst) ? 'stop' : 'target';
            exitAt = hit; exit = gapStop || gapTarget ? b.open : reason === 'stop' ? sl : tp;
            adversePrice = gapStop || gapTarget ? b.open : reason === 'stop' || both ? sl : s.side === 1 ? b.low : b.high;
          }
        }
        cash -= feeIn; fees += feeIn; turnover += c.notional;
        const mark = (p: number) => cash + s.side * qty * (p - price) - qty * p * c.fee;
        const finalAt = exitAt < o.end ? exitAt : o.end - M;
        if (minuteAudit) {
          for (let at = entryAt; at < Math.min(exitAt, o.end); at += M) { const b = bar(at);
            observe(at, mark(b.close), mark(s.side === 1 ? b.low : b.high)); ddMinutes++; }
        } else for (let boundary = nextMonth(entryAt); boundary <= finalAt; boundary = nextMonth(boundary))
          observe(boundary - M, mark(bar(boundary - M).close), 0);
        exposure += (Math.min(exitAt, o.end) - entryAt) / M + (reason !== 'timeout' ? 1 : 0);
        if (exitAt < o.end) {
          exit ??= bar(exitAt).open;
          const pricePnl = s.side * qty * (exit - price), feeOut = qty * exit * c.fee, net = pricePnl - feeIn - feeOut;
          const t = run.trades[ti++]; assert(t && t.id === s.id);
          assert.equal(t.entryAt, entryAt); assert.equal(t.exitAt, exitAt); assert.equal(t.side, s.side); assert.equal(t.reason, reason);
          assert.equal(t.touchedBoth, both); near(t.entryPrice, price); near(t.exitPrice, exit); near(t.qty, qty);
          near(t.pricePnl, pricePnl); near(t.fees, feeIn + feeOut); near(t.net, net);
          if (isTimed) { assert.equal(t.stop, null); assert.equal(t.target, null); assert.equal(t.r, null); }
          else { near(t.stop, sl!); near(t.target, tp!); near(t.r, net / (qty * Math.abs(price - sl!))); }
          const adverse = adversePrice === null ? null : mark(adversePrice);
          cash += pricePnl - feeOut; fees += feeOut; turnover += qty * exit; closed += net;
          if (!minuteAudit || !(isTimed && !o.delay && times.has(exitAt))) observe(exitAt, cash, Math.min(cash, adverse ?? cash));
          const m = ms.get(new Date(exitAt).toISOString().slice(0, 7)); m.closedNet += net;
          if (net > 1e-8) { m.wins++; m.winningDollars += net; } else if (net < -1e-8) { m.losses++; m.losingDollars += net; }
          freeAt = exitAt + (reason === 'timeout' ? 0 : M); receipts++;
        } else {
          const markedPrice = bar(o.end - M).close;
          open = { id: s.id, signalAt: s.at, entryAt, entryPrice: price, qty, side: s.side, markedPrice,
            net: s.side * qty * (markedPrice - price) - feeIn - qty * markedPrice * c.fee };
          if (!minuteAudit) observe(o.end - M, mark(markedPrice), 0);
          turnover += qty * markedPrice; freeAt = deadline; pending = deadline - o.delay < o.end;
        }
      }
      assert.deepEqual(accepted, run.accepted); assert.deepEqual(open, run.open); assert.equal(ti, run.trades.length);
      near(closed, run.stats.closedNet); near(lastMark - c.equity, run.stats.net); near(fees, run.stats.feesPaid); near(turnover, run.stats.turnoverIncludingMarkedExit);
      near(exposure / 60, run.stats.exposureHours); assert.equal(raw, run.stats.rawSignals); assert.equal(skipped, run.stats.skippedOccupied);
      assert.equal(pending, run.stats.pendingAtEnd); assert.equal(run.stats.cancelled, 0); assert.equal(ambiguities, run.stats.ambiguous);
      if (minuteAudit) { near(dd, run.stats.maxAdverseDrawdownPct, row.id + '/DD'); near(closeDd, run.stats.maxCloseDrawdownPct); assert.equal(bankrupt, run.stats.bankrupt); ddPaths++; }
      for (const m of run.monthly) { for (const [k, v] of Object.entries(ms.get(m.month))) near(m[k], v as number, row.id + '/' + m.month + '/' + k); monthRows++; }
      for (const [k, v] of Object.entries(run.stats)) assert.deepEqual(row[k], v, row.id + '/' + k);
      const wins = run.trades.filter((t: any) => t.net > 1e-8), losses = run.trades.filter((t: any) => t.net < -1e-8);
      assert.equal(row.wins, wins.length); assert.equal(row.losses, losses.length); assert.equal(row.trades, run.trades.length);
      near(row.winningDollars, wins.reduce((v: number, t: any) => v + t.net, 0));
      near(row.losingDollars, losses.reduce((v: number, t: any) => v + t.net, 0));
      if (losses.length) near(row.avgLoss, row.losingDollars / losses.length); else assert.equal(row.avgLoss, null);
      if (row.trades) { near(row.winRate, wins.length / row.trades); near(row.targetRate, row.targets / row.trades); near(row.timeoutRate, row.timeouts / row.trades); }
      else { assert.equal(row.winRate, null); assert.equal(row.targetRate, null); assert.equal(row.timeoutRate, null); }
      for (const name of ['target', 'stop', 'timeout']) { const xs = run.trades.filter((t: any) => t.reason === name);
        assert.equal(row[name === 'target' ? 'targets' : name === 'stop' ? 'stops' : 'timeouts'], xs.length);
        near(row[name + 'Net'], xs.reduce((v: number, t: any) => v + t.net, 0)); }
      near(row.stressNet, run.stats.net - turnover * c.extraCostBpsPerSide / 10000);
      paths++;
    }
    fs.closeSync(fd); console.log(`[LV02 audit ${gs.indexOf(g) + 1}/65] ${paths} paths, ${receipts} receipts`);
  }
  assert.equal(paths, seal.paths);
  atomicJson(path.resolve(ROOT, dir, 'independent-verification.json'), { passed: true, key: plan.key, paths, uniqueJournals: already.size,
    receipts, hitMinutes, ddPaths, ddMinutes, monthRows, checks: 'all source/entry groups, first barriers, gaps, ambiguity, fill-relative targets, fees, R, ownership, cutoff inventory, monthly MTM; minute DD on timed/diagonal/corner paths' });
  if (latest.key === plan.key) atomicJson(path.join(ROOT, 'backtests/level-tpsl/latest.json'), { ...latest, accepted: true });
  console.log(JSON.stringify({ passed: true, paths, receipts, ddPaths, ddMinutes, hitMinutes, monthRows }));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
