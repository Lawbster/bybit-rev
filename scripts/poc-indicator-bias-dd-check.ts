/** Independent accounting reconstruction from sealed journals, not strategy execution. */
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { fileHash, atomicJson } from './research-workflow';
import { loadMinutes } from './relative-reversion-study';
const ROOT = path.resolve(__dirname, '..'), M = 60000;
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
async function main() {
  const dir = path.resolve(ROOT, process.argv[2]), plan = read(path.join(dir, 'plan.json')), c = plan.card;
  const seal = read(path.join(dir, 'complete.json'));
  for (const a of seal.artifacts) assert.equal(await fileHash(path.join(dir, a.file)), a.sha256);
  const loaded = await loadMinutes(ROOT, 'HYPEUSDT', Date.parse(c.end), c.repair), cs = loaded.candles, base = cs[0].ts;
  const bar = (at: number) => { const b = cs[(at - base) / M]; assert(b && b.ts === at); return b; };
  const defs = read(path.join(dir, 'signals.json')), results = read(path.join(dir, 'results.json'));
  let checked = 0, minutes = 0;
  for (const r of results) {
    const run = read(path.join(dir, r.file)), o = run.options;
    const times = new Set(defs.find((d: any) => d.id === r.id).signals.map((s: any) => s.at));
    let settled = o.equity, priorMark = settled, peak = settled, dd = 0, closeDd = 0;
    const months = new Map<string, number>();
    let month = '', until = -1;
    const record = (at: number, mark: number, adverse: number) => {
      if (at >= until) { const d = new Date(at); month = d.toISOString().slice(0, 7); until = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
      dd = Math.max(dd, 100 * (peak - adverse) / peak); peak = Math.max(peak, mark);
      closeDd = Math.max(closeDd, 100 * (peak - mark) / peak);
      months.set(month, (months.get(month) ?? 0) + mark - priorMark); priorMark = mark;
    };
    for (const t of [...run.trades, ...(run.open ? [run.open] : [])]) {
      const stopAt = t.exitAt ?? o.end, side = t.side;
      const liquidate = (price: number) => settled + side * t.qty * (price - t.entryPrice) - o.notional * o.fee - t.qty * price * o.fee;
      for (let at = t.entryAt; at < stopAt; at += M) {
        const b = bar(at); minutes++;
        record(at, liquidate(b.close), liquidate(side === 1 ? b.low : b.high));
      }
      if (t.exitAt === undefined) continue;
      let adverse = settled + t.net;
      if (t.reason === 'stop' || t.reason === 'target') {
        const b = bar(t.exitAt);
        const gap = side * (b.open - t.stop) <= 0 || side * (b.open - t.target) >= 0;
        const bound = gap ? b.open : t.reason === 'stop' || t.touchedBoth ? t.stop : side === 1 ? b.low : b.high;
        adverse = Math.min(adverse, liquidate(bound));
      }
      settled += t.net;
      if (!(t.stop === null && o.delay === 0 && times.has(t.exitAt))) record(t.exitAt, settled, adverse);
    }
    assert(Math.abs(dd - run.stats.maxAdverseDrawdownPct) < 1e-8, `${r.file} adverse DD`);
    assert(Math.abs(closeDd - run.stats.maxCloseDrawdownPct) < 1e-8, `${r.file} close DD`);
    for (const m of run.monthly) assert(Math.abs((months.get(m.month) ?? 0) - m.markedNet) < 1e-7, `${r.file} month${m.month}`);
    checked++;
  }
  for (const p of plan.pins.filter((p: any) => p.file.startsWith('data/') || p.file === c.repair))
    assert.equal(await fileHash(path.resolve(ROOT, p.file)), p.sha256);
  atomicJson(path.join(dir, 'drawdown-verification.json'), { passed: true, key: plan.key, checked, minutes,
    verifierSha256: await fileHash(__filename), note: 'Independent equity/adverse-DD/close-DD/monthly MTM reconstruction from sealed trade journals and source minutes. No new strategy outcome or parameter changes.' });
  console.log(JSON.stringify({ passed: true, checked, minutes }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
