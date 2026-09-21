/** Independent artifact/raw-row checker: does not import atlas feature or classification code. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";

type R = Record<string, any>;
const ROOT = path.resolve(__dirname, ".."), MIN = 60000;
const out = path.resolve(ROOT, process.argv[2] ?? "backtests/hype/hype-tp-hl-event-atlas-2026-09-07-v2");
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
const epoch = (x: any): number => typeof x === "number" ? x : /^\d+$/.test(x) ? Number(x) : Date.parse(x);
async function lines(f: string, cb: (text: string, line: number) => void) {
  let n = 0; for await (const s of readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity })) { n++; if (s.trim()) cb(s, n); }
}
async function jsonl(f: string): Promise<R[]> { const rs: R[] = []; await lines(path.join(out, f), s => rs.push(JSON.parse(s))); return rs; }
async function hash(f: string): Promise<string> { const h = crypto.createHash("sha256"); for await (const c of fs.createReadStream(f)) h.update(c); return h.digest("hex"); }
let assertions = 0;
function near(a: any, b: any, label: string) { assertions++; if (a == null || b == null) assert.equal(a ?? null, b ?? null, label);
  else assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`); }
const stats = (rs: R[]) => ({ n: rs.length, wins: rs.filter(r => r.bookedPnl > 0).length, losses: rs.filter(r => r.bookedPnl < 0).length,
  bookedPnl: rs.reduce((s, r) => s + r.bookedPnl, 0), bookedFees: rs.reduce((s, r) => s + (r.bookedFees ?? 0), 0),
  winningDollars: rs.reduce((s, r) => s + Math.max(0, r.bookedPnl), 0), losingDollars: rs.reduce((s, r) => s + Math.min(0, r.bookedPnl), 0) });
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') { assert.equal(cell, "", "quote must begin field"); quoted = true; }
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  assert.equal(quoted, false); assert.equal(cell, ""); assert.equal(row.length, 0); return rows;
}

async function main() {
  const rel = path.relative(path.join(ROOT, "backtests"), out); assert.ok(rel && !rel.startsWith("..") && !path.isAbsolute(rel));
  const manifest = read("manifest.json"), validation = read("validation.json"), summary = read("summary.json"), spec = manifest.spec;
  assert.equal(validation.complete, true);
  for (const a of validation.artifacts) assert.equal(await hash(path.join(out, a.file)), a.sha256, `artifact ${a.file}`);
  for (const p of manifest.inputs) assert.equal(await hash(path.resolve(ROOT, p.file)), p.sha256, `input ${p.file}`);
  const events = await jsonl("events.jsonl"), contexts = await jsonl("event-context.jsonl"), references = await jsonl("market-reference.jsonl");
  assert.equal(new Set(events.map(e => e.id)).size, events.length); assert.equal(contexts.length, events.length * 16);
  const byId = new Map(events.map(e => [e.id, e])), impact = new Map<string, R>();
  const required = new Map<string, Set<number>>(), raw = new Map<string, Map<number, any>>(); let sourceReferences = 0;
  const need = (file: string, line: number) => { const set = required.get(file) ?? new Set<number>(); set.add(line); required.set(file, set); };
  const walk = (x: any, cb: (x: R) => void) => { if (x && typeof x === "object") { cb(x); Object.values(x).forEach(v => walk(v, cb)); } };
  const offsets = new Map<string, Set<number>>();
  for (const c of contexts) {
    const e = byId.get(c.eventId)!; assert.ok(e); assert.equal(c.asOf, e.eventAt + c.offsetMinutes * MIN);
    const os = offsets.get(e.id) ?? new Set<number>(); assert.ok(!os.has(c.offsetMinutes)); os.add(c.offsetMinutes); offsets.set(e.id, os);
    if (c.offsetMinutes === 0) impact.set(e.id, c);
    walk(c.sources, r => { if (!r.file || !r.line) return; need(r.file, r.line); sourceReferences++;
      assert.ok(r.sourceAt <= (r.queryAt ?? c.asOf) && r.availableAt <= (r.queryAt ?? c.asOf) && (r.queryAt ?? c.asOf) <= c.asOf); });
  }
  for (const os of offsets.values()) assert.deepEqual([...os].sort((a, b) => a - b), spec.relativeMinutes);
  for (const e of events) walk(e.evidence, r => { if (r.file && r.line) need(r.file, r.line); });
  // Independent full-file as-of selection at eight fixed trajectory locations.
  const probeIndices = [...new Set([0, 15, Math.floor(contexts.length / 4), Math.floor(contexts.length / 2), Math.floor(contexts.length * .75), contexts.length - 1,
    contexts.findIndex(c => c.asOf === 1787240408797), contexts.findIndex(c => c.quality.coreHealthy)])].filter(i => i >= 0);
  const probes = probeIndices.map(i => ({ context: contexts[i], taker: [] as R[], best: {} as R }));
  const kinds: R = Object.fromEntries(read("source-inventory.json").map((r: R) => [r.file, r.kind]));
  const clock = (r: R, kind: string) => {
    const sample = epoch(r.timestamp ?? r.ts), clocks = [r.receivedAt, r.observedAt, r.writtenAt, r.ingestedAt].filter(v => v != null).map(epoch);
    const source = kind === "book" ? epoch(r.exchangeTimestamp) : kind === "asset" ? Math.min(sample, r.receivedAt == null ? sample : epoch(r.receivedAt))
      : kind === "taker" ? epoch(r.windowEnd ?? sample) : kind === "candle1m" ? sample + MIN : kind === "candle5m" ? sample + 5 * MIN : sample;
    const base = Math.max(sample, source, ...clocks), modeled = (kind === "taker" || kind.startsWith("candle")) && !clocks.length;
    return { sample, source, base, available: Math.max(base, modeled ? source + spec.legacyPublicationLagMs : 0) };
  };
  let journalCount = 0, journalPnl = 0; const tradeKeys = new Set<string>();
  for (const pin of manifest.inputs) {
    const isTrade = /^logs\/trades_/.test(pin.file), wanted = required.get(pin.file), kind = kinds[pin.file];
    if (!isTrade && !wanted && !kind) continue;
    const records = new Map<number, any>(); raw.set(pin.file, records);
    await lines(path.resolve(ROOT, pin.file), (text, line) => {
      const r = kind || isTrade || (wanted?.has(line) && !pin.file.includes("pm2/")) ? JSON.parse(text) : null;
      if (wanted?.has(line)) records.set(line, r ?? text);
      if (isTrade && r.symbol === spec.symbol && r.action === "BATCH_CLOSE" && epoch(r.ts) >= spec.from && epoch(r.ts) <= spec.cutoff) {
        const k = JSON.stringify(r); if (!tradeKeys.has(k)) { tradeKeys.add(k); journalCount++; journalPnl += r.totalPnl; }
      }
      if (!kind) return;
      const times = clock(r, kind);
      for (const p of probes) {
        const t = p.context.asOf; if (times.available > t || times.source > t) continue;
        if (kind === "taker" && times.source > t - 15 * MIN) p.taker.push({ r, line, ...times });
        if (kind !== "book" && kind !== "asset") continue;
        const prior = p.best[kind];
        if (!prior || times.source > prior.source || times.source === prior.source && (times.base > prior.base || times.base === prior.base && line > prior.line)) p.best[kind] = { r, line, ...times };
      }
    });
    if (wanted) assert.equal(records.size, wanted.size, `all requested rows ${pin.file}`);
  }
  const get = (ref: R): R => { const r = raw.get(ref.file)?.get(ref.line); assert.ok(r, `missing pointer ${ref.file}:${ref.line}`); return r; };
  for (const e of events) {
    assert.equal(e.month, new Date(e.eventAt).toISOString().slice(0, 7)); assert.equal(e.utcHour, new Date(e.eventAt).getUTCHours());
    if (e.evidence.journal) { const r = get(e.evidence.journal); assert.deepEqual(r, e.evidence.journal.row);
      near(e.bookedPnl, r.totalPnl ?? r.realizedPnl, "journal pnl"); near(e.bookedFees, r.totalFees ?? r.fees, "journal fees"); }
    for (const p of e.evidence.pm2Matches ?? []) assert.equal(get(p), p.text);
    if (e.timingExact && e.evidence.operatorEvidence) {
      const xs = e.evidence.operatorEvidence.executions; assert.equal(e.eventAt, Math.max(...xs.map((r: R) => r.execTime)), "export time");
      near(e.exitPrice, xs.reduce((s: number, r: R) => s + r.qty * r.price, 0) / xs.reduce((s: number, r: R) => s + r.qty, 0), "export weighted price");
    }
  }
  for (const c of contexts) {
    walk(c.sources, ref => { if (!ref.file || !ref.line) return;
      const t = clock(get(ref), kinds[ref.file]); assert.equal(ref.sampleAt, t.sample, "sample clock"); assert.equal(ref.sourceAt, t.source, "source clock"); assert.equal(ref.availableAt, t.available, "availability clock"); });
    const rows = c.sources.taker15.sources.map((s: R) => get(s)), buy = rows.reduce((s: number, r: R) => s + r.buyNotional, 0), sell = rows.reduce((s: number, r: R) => s + r.sellNotional, 0);
    near(c.observedFlow15.buy, rows.length ? buy : null, "observed buy"); near(c.observedFlow15.sell, rows.length ? sell : null, "observed sell");
    if (c.quality.flow15Healthy) { near(c.features.buyShare15, buy / (buy + sell), "weighted buy share"); near(c.features.netTaker15Usd, buy - sell, "net taker"); near(c.features.turnover15Usd, buy + sell, "taker turnover"); }
    if (c.features.bookImbalance05 != null) { const r = get(c.sources.book), bid = r.bidBands.pct_0_5, ask = r.askBands.pct_0_5;
      near(c.features.bookImbalance05, (bid - ask) / (bid + ask), "book imbalance"); }
    for (const k of ["asset", "oi"]) {
      const a = c.sources[k], b = c.sources[`${k}_15m_anchor`];
      if (a?.fresh && b?.fresh) { const x = get(a), y = get(b); if (x.openInterest != null && y.openInterest > 0) near(c.features[`${k}NativeOiChange15Pct`], (x.openInterest / y.openInterest - 1) * 100, "native OI delta"); }
    }
    if (c.quality.candle15Healthy) {
      const x = get(c.sources.candle1m), y = get(c.sources.candle1m_15m_anchor);
      near(c.features.hlClosedReturn15Pct, (x.close / y.close - 1) * 100, "closed return");
      near(c.features.hlClosedVolume15, c.sources.candle15.sources.reduce((s: number, r: R) => s + get(r).volume, 0), "base volume");
    }
  }
  for (const p of probes) {
    for (const kind of ["book", "asset"]) assert.equal(p.context.sources[kind]?.line ?? null, p.best[kind]?.line ?? null, `independent latest ${kind}`);
    const bins = new Map<number, R[]>(); for (const r of p.taker) { const a = bins.get(r.source) ?? []; a.push(r); bins.set(r.source, a); }
    const values = (r: R) => [r.buyNotional, r.sellNotional, r.buyVol, r.sellVol, r.buyCount, r.sellCount, r.largeBuyNotional, r.largeSellNotional, r.firstTradeTime, r.lastTradeTime];
    const rows = [...bins.values()].filter(rs => new Set(rs.map(r => JSON.stringify(values(r.r)))).size === 1).map(rs => rs[0].r);
    near(p.context.observedFlow15.buy, rows.length ? rows.reduce((s, r) => s + r.buyNotional, 0) : null, "independent full-file window buy");
    near(p.context.observedFlow15.sell, rows.length ? rows.reduce((s, r) => s + r.sellNotional, 0) : null, "independent full-file window sell");
  }
  const allLong = events.filter(e => e.owner === "ladder" && e.cohort !== "sr_partial"), tp = allLong.filter(e => e.cohort.startsWith("long_tp"));
  assert.equal(allLong.length, journalCount); near(stats(allLong).bookedPnl, journalPnl, "all journal accounting");
  for (const [k, v] of Object.entries(stats(tp))) near(summary.tp[k], v, `TP summary ${k}`);
  for (const r of summary.monthlyTp) for (const [k, v] of Object.entries(stats(tp.filter(e => e.month === r.month)))) near(r[k], v, "monthly money");
  for (const r of summary.hourlyTp) for (const [k, v] of Object.entries(stats(tp.filter(e => e.utcHour === r.utcHour)))) near(r[k], v, "hourly money");
  assert.equal(references.length, Math.floor(spec.cutoff / spec.referenceEveryMs) - Math.ceil(spec.from / spec.referenceEveryMs) + 1);
  references.forEach((r, i) => assert.equal(r.asOf, (Math.ceil(spec.from / spec.referenceEveryMs) + i) * spec.referenceEveryMs));
  for (const [file, expected] of [["events.csv", events.length], ["event-features.csv", events.length], ["lead-in-features.csv", contexts.length], ["hourly.csv", 24]] as const) {
    const rows = parseCsv(fs.readFileSync(path.join(out, file), "utf8")); assert.equal(rows.length, expected + 1);
    rows.forEach(row => assert.equal(row.length, rows[0].length, `CSV width ${file}`));
    if (file === "events.csv") { const index = rows[0].indexOf("resistance");
      rows.slice(1).forEach((row, i) => assert.deepEqual(row[index] ? JSON.parse(row[index]) : null, events[i].resistance ?? null, "nested JSON CSV roundtrip")); }
  }
  for (const p of manifest.inputs) assert.equal(await hash(path.resolve(ROOT, p.file)), p.sha256, `end input ${p.file}`);
  const result = { passed: true, checkedAt: new Date().toISOString(), eventRows: events.length, contextRows: contexts.length,
    sourceReferences, distinctRawPointers: [...required.values()].reduce((s, v) => s + v.size, 0), independentAsOfProbes: probes.length,
    numericAssertions: assertions, fullCloseJournalCount: journalCount, fullCloseJournalPnl: journalPnl, allArtifactAndInputHashesPass: true, csvShapeAndNestedJsonRoundtripPass: true,
    scope: "All event source clocks/pointers, primary flow/book/OI/candle arithmetic; independent full-file latest book/asset and flow-window selections at eight fixed probes; accounting and time-group totals. Not historical publication proof or exchange-ledger completeness proof." };
  fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(result, null, 2) + "\n"); console.log(JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
