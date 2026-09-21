/** Additional independent raw-flow/OI and availability arithmetic. No strategy engine. */
import fs from "fs";
import path from "path";
import assert from "assert/strict";
import { read, lines, fileHash } from "./hype-failed-recovery-study";
type Row = Record<string, any>;
const M = 60000, near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
async function main() {
  const dir = path.resolve(process.argv[2] ?? "backtests/hype/hype-failed-recovery-2026-09-08"), man = read(path.join(dir, "manifest.json"));
  assert.equal(await fileHash(path.join(dir, "source-evidence.jsonl")), man.evidenceSha256);
  const observations: Row[] = read(path.join(dir, "observations.json")), flows: Row[] = [], assets: Row[] = [];
  await lines(path.join(dir, "source-evidence.jsonl"), r => { if (r.kind === "hlTaker") flows.push(r); if (r.kind === "asset") assets.push(r); });
  const available = (r: Row, delay: number) => {
    const x = r.raw, receipts = [x.receivedAt, x.observedAt, x.writtenAt, x.ingestedAt].filter(v => v != null).map(Number);
    let a = Math.max(Number(x.timestamp ?? x.ts), ...receipts);
    if (r.kind === "hlTaker") a = Math.max(a, Number(x.windowEnd ?? x.timestamp) + (receipts.length ? 0 : M));
    else if (x.windowEnd != null) a = Math.max(a, Number(x.windowEnd));
    assert.equal(a, r.availableAt); return Math.ceil((a + delay) / M) * M;
  };
  const seen = new Set<string>(); let flowChecks = 0, oiChecks = 0;
  function checkFlow(f: Row, at: number, delay: number) {
    const key = `${at}|${f.expected}|${delay}`; if (seen.has(key)) return; seen.add(key);
    const rows = flows.filter(r => { const a = available(r, delay), end = Number(r.raw.windowEnd ?? r.raw.timestamp); return a <= at && a > at - f.expected * M && end <= at && end > at - f.expected * M; });
    const valid = rows.filter(r => Number.isFinite(Number(r.raw.buyNotional)) && Number.isFinite(Number(r.raw.sellNotional)) && Number(r.raw.buyNotional) >= 0 && Number(r.raw.sellNotional) >= 0);
    const n = new Set(valid.map(r => Number(r.raw.windowEnd ?? r.raw.timestamp))).size;
    assert.equal(n, f.samples); assert.equal(rows.length, f.sources.length);
    const buy = valid.reduce((s, r) => s + Number(r.raw.buyNotional), 0), sell = valid.reduce((s, r) => s + Number(r.raw.sellNotional), 0);
    if (n) { near(buy, f.buy); near(sell, f.sell); } else assert.equal(f.buy, null);
    if (sell > 0) near(buy / sell, f.ratio); else assert.equal(f.ratio, null);
    const age = n ? (at - Math.max(...valid.map(r => Number(r.raw.windowEnd ?? r.raw.timestamp)))) / 1000 : null;
    assert.equal(age, f.ageSec); assert(!f.healthy || n >= (f.expected === 15 ? 14 : 55) && age !== null && age <= 90 && f.invalid === 0 && f.duplicates === 0);
    flowChecks++;
  }
  const latest = (at: number, delay: number) => {
    let chosen: Row | null = null;
    for (const r of assets) if (available(r, delay) <= at && (!chosen || r.availableAt > chosen.availableAt || r.availableAt === chosen.availableAt && r.line > chosen.line)) chosen = r;
    return chosen;
  };
  const checkedOi = new Set<string>();
  function oi(x: Row, at: number, delay: number) {
    const key = `${at}|${delay}|${x.minutes}`; if (checkedOi.has(key)) return; checkedOi.add(key);
    const current = latest(at, delay), anchor = latest(at - x.minutes * M, delay);
    if (!x.healthy) return;
    assert(current && anchor); assert.equal(anchor.file, x.source.file); assert.equal(anchor.line, x.source.line);
    near((Number(current.raw.openInterest) / Number(anchor.raw.openInterest) - 1) * 100, x.nativeOiChangePct);
    const marked = (r: Row) => Number(r.raw.openInterestValue ?? Number(r.raw.openInterest) * Number(r.raw.markPrice));
    near((marked(current) / marked(anchor) - 1) * 100, x.markedOiChangePct);
    near((Number(current.raw.markPrice) / Number(anchor.raw.markPrice) - 1) * 100, x.markChangePct); oiChecks++;
  }
  for (const x of observations) {
    for (const [at, c] of [[x.at, x.context], [x.at - 15 * M, x.previousContext]]) {
      checkFlow(c.flow15, at, 0); checkFlow(c.flow60, at, 0); c.asset.changes.forEach((a: Row) => oi(a, at, 0));
    }
    for (const delay of [15000, 60000]) { const c = x.delayedHealth[String(delay)]; checkFlow(c.flow15, x.at, delay); checkFlow(c.flow60, x.at, delay);
      checkFlow(c.previousFlow15, x.at - 15 * M, delay); checkFlow(c.previousFlow60, x.at - 15 * M, delay); oi(c.nativeOi1h, x.at, delay); }
  }
  const dest = path.join(dir, "source-verification.json"); assert(!fs.existsSync(dest));
  fs.writeFileSync(dest, JSON.stringify({ passed: true, at: new Date().toISOString(), flowChecks, healthyOiChecks: oiChecks,
    inputSha256: await fileHash(path.join(dir, "observations.json")), evidenceSha256: man.evidenceSha256, checkerSha256: await fileHash(__filename), liveChanges: 0 }, null, 2) + "\n");
  console.log({ passed: true, flowChecks, healthyOiChecks: oiChecks });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
