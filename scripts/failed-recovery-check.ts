/** Separately reconstruct selection, labels and source arithmetic from saved evidence. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { EMA } from "technicalindicators";
import { prices, fileHash, lines, read } from "./hype-failed-recovery-study";
import { M, H } from "./failed-recovery-analysis";
type Row = Record<string, any>;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
async function main() {
  const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-failed-recovery-2026-09-08"), dest = path.join(dir, "verification.json"); assert(!fs.existsSync(dest));
  const man = read(path.join(dir, "manifest.json")), spec = man.spec, obs: Row[] = read(path.join(dir, "observations.json"));
  for (const p of [...man.pins, ...man.protectedFiles]) assert.equal(await fileHash(p.file), p.sha256, p.file);
  assert.equal(await fileHash(path.join(dir, "source-evidence.jsonl")), man.evidenceSha256);
  const base: Row[] = read(path.join(dir, "baseline.json")), old = read(`${spec.archive}/manifest.json`);
  const cs = await prices(Date.parse(spec.cutoff), old.spec.repairFile), idx = (t: number) => (t - cs[0].endTs) / M;
  let selected = 0, sources = 0;
  for (const b of base) {
    const ev: Row[] = []; await lines(`${spec.archive}/${b.model}--B17-inventory.jsonl`, r => ev.push(r));
    const first = new Map<string, number>(); let held: Row[] = [], cursor = 0, episode = 0;
    for (let i = idx(Date.parse(b.start)); i <= idx(Date.parse(b.end)); i++) {
      while (ev[cursor]?.event.fillIndex === i) { assert.deepEqual(held, ev[cursor].before); held = ev[cursor].after; episode = ev[cursor++].episode; }
      if (held.length < 9) continue;
      const qty = held.reduce((s, p) => s + p.qty, 0), cost = held.reduce((s, p) => s + p.notional, 0), pct = (qty * cs[i].close / cost - 1) * 100;
      for (const th of [-3, -5]) if (pct <= th && !first.has(`${episode}|${th}`)) first.set(`${episode}|${th}`, cs[i].endTs);
    }
    for (const th of [-3, -5]) assert.equal(obs.filter(x => x.model === b.model && x.threshold === th && x.landmarkMinutes === 0).length, [...first.keys()].filter(k => k.endsWith(`|${th}`)).length);
    const entry = new Map<number, number>(); ev.filter(e => e.event.kind === "open" && !e.before.length).forEach(e => entry.set(e.episode, e.event.fillAt));
    for (const x of obs.filter(x => x.model === b.model)) {
      selected++; const firstAt = first.get(`${x.episode}|${x.threshold}`); assert(firstAt !== undefined);
      assert.equal(x.firstAt, firstAt); assert.equal(x.at, firstAt + x.landmarkMinutes * M);
      const previous = ev.filter(e => e.event.fillIndex <= idx(x.at)), state = previous.at(-1)!; assert.equal(state.episode, x.episode); assert(state.after.length >= 9);
      const c = cs[idx(x.at)], remaining = state.after.reduce((s: number, p: Row) => s + p.qty * (c.close - p.entryPrice) - p.qty * (c.close + p.entryPrice) * spec.feeRate, 0);
      let realized = 0;
      for (const e of previous.filter(e => e.episode === x.episode && e.event.kind === "partial")) {
        for (const p of e.before) { const q = p.qty - (e.after.find((a: Row) => a.id === p.id)?.qty ?? 0);
          realized += q * (e.event.price - p.entryPrice) - q * (e.event.price + p.entryPrice) * spec.feeRate; }
      }
      near(remaining + realized, x.netEpisodeMark); const outcome = b.metrics.episodes.find((e: Row) => Date.parse(e.entry) === entry.get(x.episode)) ?? null;
      assert.deepEqual(outcome, x.outcome); if (outcome) near(outcome.pnl - x.netEpisodeMark, x.remainingValueChange); else assert.equal(x.remainingValueChange, null);
      const win = cs.slice(idx(x.at) - 59, idx(x.at) + 1); near(win.reduce((s, c) => s + c.turnover, 0) / win.reduce((s, c) => s + c.volume, 0), x.priceContext.vwap60);
      near((c.close / cs[idx(x.at - H)].close - 1) * 100, x.priceContext.roc60);
      const end = Math.floor(x.at / (4 * H)) * 4 * H, closes = Array.from({ length: 249 }, (_, n) => cs[idx(end - (248 - n) * 4 * H)].close);
      near(EMA.calculate({ period: 200, values: closes }).at(-1)!, x.priceContext.trend.ema200);
      assert(x.support.bars.every((c: Row) => c.end % (5 * M) === 0 && c.end <= x.at));
      for (const bar of x.support.bars) { near(cs[idx(bar.end)].close, bar.close); const rows = cs.slice(idx(bar.end) - 4, idx(bar.end) + 1); near(Math.max(...rows.map(c => c.high)), bar.high); }
      if (x.support.frozenLevel) assert(x.support.frozenLevel.touchData.every((t: Row) => t.ts <= x.support.knownAt));
      for (const delay of spec.additionalArrivalDelayMs) {
        const d = x.warnings[String(delay)]; assert.equal(Object.keys(d).length, 10);
        const p = delay ? x.delayedHealth[String(delay)] : { flow15: x.context.flow15, flow60: x.context.flow60, nativeOi1h: x.context.asset.changes[0], previousFlow15: x.previousContext.flow15, previousFlow60: x.previousContext.flow60 };
        const flow = (f: Row, at: number) => { if (f.samples) { assert(f.sources.every((s: Row) => s.eligibleAt <= at && s.sourceAt > f.start && s.sourceAt <= at)); near(f.buy / f.sell, f.ratio); } };
        flow(p.flow15, x.at); flow(p.flow60, x.at); flow(p.previousFlow15, x.at - 15 * M);
        const sell = p.flow15.healthy ? p.flow15.ratio <= .85 : null;
        const both = p.flow15.healthy && p.flow60.healthy ? p.flow15.ratio <= .85 && p.flow60.ratio <= .9 : null;
        assert.equal(d.D4, sell); assert.equal(d.D5, both);
        assert.equal(d.D7, both === null || !p.nativeOi1h.healthy ? null : both && p.nativeOi1h.nativeOiChangePct < 0);
        assert.equal(d.D8, both === null || !p.nativeOi1h.healthy ? null : both && p.nativeOi1h.markedOiChangePct < 0);
      }
    }
  }
  // Validate original file/line provenance rather than trusting an extracted JSON row.
  const requested = new Map<string, Map<number, string>>();
  await lines(path.join(dir, "source-evidence.jsonl"), r => { if (!requested.has(r.file)) requested.set(r.file, new Map()); requested.get(r.file)!.set(r.line, JSON.stringify(r.raw)); });
  for (const [file, wanted] of requested) { await lines(file, (r, n) => { if (wanted.has(n)) { assert.equal(JSON.stringify(r), wanted.get(n)); wanted.delete(n); sources++; } }); assert.equal(wanted.size, 0); }
  // Independent grouped dollar/count checks; these are diagnostic cohorts, NOT variant PnL.
  const groups: Row[] = read(path.join(dir, "groups.json")), monthly: Row[] = read(path.join(dir, "monthly.json"));
  for (const g of [...groups, ...monthly]) {
    const xs = obs.filter(x => x.model === g.model && x.threshold === g.threshold && x.landmarkMinutes === g.landmarkMinutes && (!g.month || x.iso.startsWith(g.month)));
    for (const [key, match] of [["baseline", undefined], ["flagged", true], ["unflagged", false], ["unknown", null]] as const) {
      const selected = match === undefined ? xs : xs.filter(x => x.warnings[String(g.delay ?? 0)][g.id] === match), done = selected.filter(x => x.outcome !== null), v = g[key];
      assert.equal(v.observations, selected.length); assert.equal(v.completed, done.length); assert.equal(v.censored, selected.length - done.length);
      near(done.reduce((s, x) => s + Math.max(0, -x.remainingValueChange), 0), v.subsequentDownside);
      near(done.reduce((s, x) => s + Math.max(0, x.remainingValueChange), 0), v.subsequentRecovery);
      near(v.subsequentDownside - v.subsequentRecovery, v.diagnosticBalance);
      near(done.reduce((s, x) => s + x.outcome.pnl, 0), v.completedNet);
    }
    assert.equal(g.flagged.observations + g.unflagged.observations + g.unknown.observations, g.baseline.observations);
  }
  const artifacts = await Promise.all(fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile()).map(async file => ({ file, sha256: await fileHash(path.join(dir, file)) })));
  fs.writeFileSync(dest, JSON.stringify({ passed: true, at: new Date().toISOString(), baselineControls: 4, landmarks: selected, rawSourceRowsVerified: sources,
    cohortChecks: groups.length + monthly.length, artifacts, checkerSha256: await fileHash(__filename), independentStrategyReplay: false, economicPolicyTested: false, liveChanges: 0 }, null, 2) + "\n");
  console.log({ passed: true, landmarks: selected, rawSourceRowsVerified: sources, cohortChecks: groups.length + monthly.length });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
