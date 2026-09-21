/** Independent minute-by-minute accounting from saved fills + pinned repaired OHLC.
 * Does not call the strategy/engine, re-evaluate exits, or invent new fills.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
async function main() {
  const dir = process.argv[2] ?? "backtests/hype/hype-ladder-sizing-2026-09-05-validated";
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const m = read("manifest.json"), cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
  const expected = JSON.parse(fs.readFileSync(path.join(m.baseSpec.baselineDir, "summary.json"), "utf8"));
  const { loadCandles1m, lowerBound } = await import("./hype-freerun-canonical-replay");
  const candles = await loadCandles1m("HYPEUSDT", path.resolve("data"), Date.parse(m.baseSpec.historyEnd), path.resolve(m.baseSpec.repairFile));
  const all = [...read("legacy-baseline.json"), ...read("baseline.json"), ...read("results.json")];
  const near = (a: number, b: number, why: string) => assert(Math.abs(a - b) < 2e-6, `${why}: ${a} != ${b}`);
  let checkedMinutes = 0, checkedMonths = 0;
  for (const r of all) {
    const prior = expected.find((e: any) => e.id === r.model);
    const label = `${r.model}--${r.clock === "legacy_reanchor" ? "legacy-baseline" : r.variant}`;
    const inv = fs.readFileSync(path.join(dir, `${label}-inventory.jsonl`), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
    const ds = fs.readFileSync(path.join(dir, `${label}-decisions.jsonl`), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
    let pointer = 0, dp = 0, positions: any[] = [], realized = 0, peak = m.baseSpec.initialEquity, minEquity = peak, dd = 0;
    let closePeak = m.baseSpec.initialEquity, underwaterAt: number | null = null, maxUnderwaterHours = 0;
    const months = new Map<string, any>(), pnl = (price: number) => positions.reduce((v: number, p: any) => v + (price - p.entryPrice) * p.qty - cfg.feeRate * (p.notional + price * p.qty), 0);
    const mark = (price: number) => {
      const equity = m.baseSpec.initialEquity + realized + pnl(price);
      peak = Math.max(peak, equity); minEquity = Math.min(minEquity, equity); dd = Math.max(dd, (peak - equity) / peak * 100);
      return equity;
    };
    const apply = (x: any) => {
      assert.deepEqual(positions, x.before);
      const removed = x.before.filter((p: any) => !x.after.some((a: any) => a.id === p.id));
      realized += removed.reduce((v: number, p: any) => v + (x.event.price - p.entryPrice) * p.qty - cfg.feeRate * (p.notional + x.event.price * p.qty), 0);
      positions = x.after;
    };
    const start = lowerBound(candles, Date.parse(prior.start), c => c.endTs), end = lowerBound(candles, Date.parse(prior.end) + 1, c => c.endTs);
    for (let i = start; i < end; i++) {
      const c = candles[i];
      while (pointer < inv.length && inv[pointer].event.fillIndex === i && inv[pointer].event.fillAt === c.ts) apply(inv[pointer++]);
      mark(c.low);
      while (pointer < inv.length && inv[pointer].event.fillIndex === i) {
        const x = inv[pointer++]; assert.equal(x.event.kind, "close"); assert.equal(x.event.fillAt, c.endTs); apply(x);
      }
      const equity = mark(c.close);
      if (equity >= closePeak) { closePeak = equity; underwaterAt = null; }
      else { underwaterAt ??= c.endTs; maxUnderwaterHours = Math.max(maxUnderwaterHours, (c.endTs - underwaterAt) / 3600000); }
      while (dp < ds.length && ds[dp].decision.index === i) {
        const x = ds[dp++].decision;
        assert.equal(x.at, c.endTs); near(x.price, c.close, "decision source price");
        near(x.equity, equity, "decision equity"); assert.equal(x.nextDepth, positions.length + 1);
        near(x.entryCostNotional, positions.reduce((v: number, p: any) => v + p.notional, 0), "decision cost");
        near(x.qty, positions.reduce((v: number, p: any) => v + p.qty, 0), "decision qty");
      }
      const key = new Date(c.endTs).toISOString().slice(0, 7), old = months.get(key);
      months.set(key, { equity, realized, maxNotional: Math.max(old?.maxNotional ?? 0, positions.reduce((v: number, p: any) => v + p.notional, 0)),
        deepMinutes: (old?.deepMinutes ?? 0) + Number(positions.length >= 9) });
    }
    assert.equal(pointer, inv.length); assert.equal(dp, ds.length);
    near(realized, r.metrics.realized, "realized total"); near(dd, r.metrics.maxDrawdownPct, "adverse-path DD");
    near(minEquity, r.metrics.minEquity, "minimum equity");
    near(maxUnderwaterHours, r.maxCloseMarkedUnderwaterHours, "close-marked underwater duration");
    let prevEquity = m.baseSpec.initialEquity, prevRealized = 0;
    assert.equal(months.size, r.metrics.monthly.length);
    for (const [month, x] of months) {
      const saved = r.metrics.monthly.find((x: any) => x.month === month); assert(saved);
      near(saved.mtmPnl, x.equity - prevEquity, "month MTM"); near(saved.realizedPnl, x.realized - prevRealized, "month realized");
      near(saved.maxNotional, x.maxNotional, "month peak cost"); assert.equal(saved.deepMinutes, x.deepMinutes);
      prevEquity = x.equity; prevRealized = x.realized; checkedMonths++;
    }
    near(prevEquity - m.baseSpec.initialEquity, r.metrics.totalPnl, "total with final mark");
    checkedMinutes += end - start;
  }
  for (const x of [...m.inputs, ...m.sources]) {
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(x.file)) h.update(b);
    assert.equal(h.digest("hex"), x.sha256, x.file);
  }
  console.log(JSON.stringify({ passed: true, cases: all.length, checkedMinutes, checkedMonths, independentRawCandleAccounting: true,
    adversePathDrawdown: true, monthlyRealizedAndMtm: true, decisionTimePriceInventoryAndEquity: true,
    sourceSha256: crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex") }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
