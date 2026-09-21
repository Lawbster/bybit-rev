/** Frozen archived-path attribution. This does not execute filtered strategies. */
import fs from "fs";
import crypto from "crypto";
import readline from "readline";
import assert from "assert/strict";
import { read, fileHash } from "./hype-failed-recovery-study";
import { atomicJson, verifyPins } from "./research-workflow";
import { applyCandleRepair, readCandleRepair } from "./replay-candle-repair";
import { auditCombinationAccounting } from "./ladder-combination-accounting";
import { observationAvailability } from "./replay-causality";
import { PriceContext, PulseContext, descriptors, IDS, M, H, type R } from "./aggressive10-discriminator-context";
import type { Candle } from "./hype-freerun-canonical-replay";
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
export async function prefixLines(pin: R, cb: (row: R, line: number) => void) {
  let line = 0;
  for await (const s of readline.createInterface({ input: fs.createReadStream(pin.file, { end: pin.bytes - 1 }), crlfDelay: Infinity })) {
    line++; if (s.trim()) cb(JSON.parse(s), line);
  }
}
export async function verifyPrefixes(pins: R[]) {
  for (const p of pins) {
    assert(fs.statSync(p.file).size >= p.bytes, `Truncated archive: ${p.file}`);
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(p.file, { end: p.bytes - 1 })) h.update(b);
    assert.equal(h.digest("hex"), p.sha256, `Changed historical prefix: ${p.file}`);
  }
}
export async function candles(plan: R, prefixes: R[]) {
  const cutoff = Date.parse(plan.card.definition.cutoff), map = new Map<number, Candle>();
  const add = (r: R) => { const ts = Number(r.ts ?? r.timestamp); if (ts + M > cutoff) return;
    const c = { ts, endTs: ts + M, open: +(r.o ?? r.open), high: +(r.h ?? r.high), low: +(r.l ?? r.low), close: +(r.c ?? r.close),
      volume: +(r.v ?? r.volume), turnover: +(r.t ?? r.turnover) }; assert(Object.values(c).every(Number.isFinite)); map.set(ts, c); };
  read("data/HYPEUSDT_1_full.json").forEach(add); await prefixLines(prefixes.find(p => p.file === "data/HYPEUSDT_1m.jsonl")!, add);
  const repair = read(`${plan.card.definition.archive}/manifest.json`).repairFile;
  const cs = applyCandleRepair([...map.values()].sort((a, b) => a.ts - b.ts), readCandleRepair(repair), "HYPEUSDT", cutoff);
  cs.forEach((c, i) => assert.equal(c.ts, cs[0].ts + i * M)); assert.equal(cs.at(-1)!.endTs, cutoff); return cs;
}
export function summarize(rows: R[], labels: Map<string, R>) {
  const ls = rows.map(r => labels.get(r.labelId)!); assert(ls.every(Boolean));
  const completed = ls.filter(x => x.pnl !== null), losses = completed.filter(x => x.pnl < 0), wins = completed.filter(x => x.pnl > 0);
  const winDollars = wins.reduce((n, x) => n + x.pnl, 0), lossDollars = losses.reduce((n, x) => n + x.pnl, 0);
  const matched = completed.filter(x => x.guardedSameEntryPnl !== null);
  return { observations: rows.length, completed: completed.length, unfinished: rows.length - completed.length,
    wins: wins.length, losses: losses.length, winDollars, lossDollars, net: winDollars + lossDollars,
    worstLoss: losses.length ? Math.min(...losses.map(x => x.pnl)) : 0,
    netWithoutLargestLoss: winDollars + lossDollars - (losses.length ? Math.min(...losses.map(x => x.pnl)) : 0),
    largestLossShare: losses.length ? Math.min(...losses.map(x => x.pnl)) / lossDollars : null,
    matched: matched.length, matchedDelta: matched.reduce((n, x) => n + x.pnl - x.guardedSameEntryPnl, 0),
    replacementOrUnfinishedPeer: completed.length - matched.length };
}
async function main() {
  const cardFile = "research-inputs/aggressive10-discriminators-2026-09-11.json", spec = read(cardFile), accepted = spec.accepted;
  const plan = read(`${accepted}/plan.json`), state = read(`${accepted}/state.json`); assert.equal(state.status, "complete"); assert(read(`${accepted}/verification.json`).passed);
  assert.equal(spec.cutoff, plan.card.definition.cutoff); assert.deepEqual(spec.features.map((f: R) => f.id), IDS);
  const out = `backtests/hype/${spec.id}`; assert(!fs.existsSync(out), "Use a fresh output directory; never overwrite accepted evidence");
  const prefixes = plan.pins.filter((p: R) => p.file.startsWith("data/") && p.file.endsWith(".jsonl")), prefixNames = new Set(prefixes.map((p: R) => p.file));
  const pins = [...plan.pins, ...plan.protectedPins, ...state.artifacts].filter((p: R) => p.file !== "bot-state.json" && !prefixNames.has(p.file));
  const protectedState = { file: "bot-state.json", bytes: fs.statSync("bot-state.json").size, sha256: await fileHash("bot-state.json") };
  const sourcePins = await Promise.all([cardFile, "scripts/aggressive10-discriminator-context.ts", "scripts/aggressive10-discriminator-study.ts", "scripts/aggressive10-discriminator-tests.ts"].map(async file => ({ file, sha256: await fileHash(file) })));
  await verifyPins(process.cwd(), pins); await verifyPrefixes(prefixes);
  console.log("[AG10-D1] Accepted artifacts/prefixes exact; building closed-price contexts");
  const cs = await candles(plan, prefixes), price = new PriceContext(cs);
  const original: R[] = read(`${accepted}/output/results.json`), all = original.filter(r => r.primary && [spec.lead, ...spec.controls].includes(r.policy)); assert.equal(all.length, 12);
  const eventsByName = new Map<string, R[]>(), controls: R[] = [];
  for (const x of all) {
    const events: R[] = fs.readFileSync(`${accepted}/output/${x.name}-inventory.jsonl`, "utf8").trim().split("\n").map(l => JSON.parse(l));
    assert.deepEqual(auditCombinationAccounting(cs, events as any, x.metrics, x.startIdx, x.endIdx, 32000, .00055, { fraction: 1, fillDelayMs: 0 }), x.accounting);
    eventsByName.set(x.name, events); controls.push({ model: x.model, policy: x.policy, start: x.start, end: x.end, metrics: x.metrics });
    console.log(`[AG10-D1] Original net/DD/months reverified: ${x.model}/${x.policy}`);
  }
  const pulse = new PulseContext(spec.quality), cutoff = Date.parse(spec.cutoff);
  for (const [kind, file] of [["hlTaker", "data/HYPEUSDT_taker_hyperliquid.jsonl"], ["book", "data/HYPEUSDT_ob_bands_hyperliquid.jsonl"], ["asset", "data/HYPEUSDT_asset_ctx_hyperliquid.jsonl"]] as const) {
    console.log(`[AG10-D1] Loading accepted ${kind} prefix`);
    await prefixLines(prefixes.find((p: R) => p.file === file), (r, line) => {
      if (observationAvailability(r, kind === "hlTaker" ? "hl_taker" : "point") <= cutoff) pulse.add(kind, r, line);
    });
  }
  pulse.seal();
  const features: R[] = [], labels = new Map<string, R>(), cohortAudit: R[] = [];
  const pcache = new Map<string, R>(), getPulse = (at: number, lag: number): R => {
    const key = `${at}/${lag}`; if (!pcache.has(key)) pcache.set(key, pulse.at(at - lag, at)); return pcache.get(key)!;
  };
  for (const x of all.filter(r => r.policy === spec.lead)) {
    const events = eventsByName.get(x.name)!, contexts: R[] = read(`${accepted}/output/${x.name}-entry-contexts.json`), contextAt = new Map(contexts.map(c => [c.index, c]));
    const first = new Map<number, R>(), closes = new Map(events.filter(e => e.event.kind === "close").map(e => [e.event.fillAt, e]));
    const outcomes = new Map(x.metrics.episodes.map((e: R) => [e.entry, e]));
    const peer = all.find(r => r.policy === "tp_age10" && r.model === x.model)!;
    const peerOutcomes = new Map(peer.metrics.episodes.map((e: R) => [e.entry, e]));
    const seen = new Set<string>(); let hot = 0, deep = 0, originalFlowChecks = 0;
    for (const e of events) {
      if (e.event.kind !== "open") continue;
      if (!first.has(e.episode)) first.set(e.episode, e);
      const c = contextAt.get(e.event.decisionIndex)!; assert(c); assert.equal(c.at, cs[c.index].endTs); assert.equal(c.nextDepth, e.after.length);
      const scopes = [c.nextDepth === 1 && c.hotWouldBlock ? "hot_reopen" : null, c.deepWouldBlock ? "deep_timer" : null].filter(Boolean) as string[];
      for (const scope of scopes) {
        const group = `${e.episode}/${scope}`; if (seen.has(group)) continue; seen.add(group);
        if (scope === "hot_reopen") hot++; else { deep++; assert(!c.priceDropOk); assert(c.nextDepth >= 6); assert(!c.supportReopen); }
        const entryAt = first.get(e.episode)!.event.fillAt, entry = new Date(entryAt).toISOString(), id = `${x.model}/${e.episode}`;
        const outcome: R | undefined = outcomes.get(entry) as R, peerOutcome: R | undefined = peerOutcomes.get(entry) as R;
        labels.set(id, { id, model: x.model, episode: e.episode, entry, close: outcome?.close ?? null, reason: outcome?.reason ?? "unfinished", pnl: outcome?.pnl ?? null,
          guardedSameEntryPnl: peerOutcome?.pnl ?? null });
        const tpEvent = c.lastTp ? closes.get(c.lastTp.at) : null;
        if (c.lastTp) { assert(tpEvent); assert(c.lastTp.at <= c.at); assert(c.lastTp.rsiKnownAt <= c.lastTp.at); }
        const lastTp = c.lastTp ? { ...c.lastTp, price: tpEvent!.event.price } : null;
        const raw: R = getPulse(c.at, 0).original;
        for (const key of ["hl15", "hl1h", "hl15Samples", "hl1hSamples", "hlAgeSec"]) {
          if (raw[key] === null || c[key] === null) assert.equal(raw[key], c[key]); else near(raw[key], c[key]); originalFlowChecks++;
        }
        for (const lag of spec.sourceLagMs) {
          const pf = price.at(c.at - lag, entryAt), now = getPulse(c.at, lag), prev = getPulse(c.at - 15 * M, lag);
          const flags = descriptors(pf, now, prev, c.at, lastTp), qty = e.before.reduce((n: number, p: R) => n + p.qty, 0), cost = e.before.reduce((n: number, p: R) => n + p.notional, 0);
          features.push({ id: `${id}/${scope}/${lag}`, labelId: id, model: x.model, scope, lag, at: c.at, iso: new Date(c.at).toISOString(),
            episode: e.episode, entryAt, nextDepth: c.nextDepth, priceDropOk: c.priceDropOk,
            preQty: qty, preCost: cost, grossMarkAtDecisionPct: cost ? (cs[c.index].close * qty / cost - 1) * 100 : null,
            lastTp, archived: c, price: pf, pulse: now, priorPulse: prev, flags });
        }
      }
    }
    cohortAudit.push({ model: x.model, hotReopens: hot, firstDeepTimers: deep, originalFlowChecks });
    console.log(`[AG10-D1] ${x.model}: ${hot} hot reopens, ${deep} first deep timers; archived flow exact`);
  }
  const summaries: R[] = [];
  for (const model of [...new Set(features.map(x => x.model))]) for (const scope of ["hot_reopen", "deep_timer"]) for (const lag of spec.sourceLagMs) {
    const rows = features.filter(r => r.model === model && r.scope === scope && r.lag === lag);
    for (const definition of spec.features) {
      const selected = rows.filter(r => r.flags[definition.id] === true), complement = rows.filter(r => r.flags[definition.id] === false), unknown = rows.filter(r => r.flags[definition.id] === null);
      const total = summarize(rows, labels), yes = summarize(selected, labels), no = summarize(complement, labels), missing = summarize(unknown, labels);
      assert.equal(total.observations, yes.observations + no.observations + missing.observations); near(total.net, yes.net + no.net + missing.net);
      const knownWins = yes.winDollars + no.winDollars, knownLoss = yes.lossDollars + no.lossDollars;
      summaries.push({ model, scope, lag, descriptor: definition.id, direction: definition.direction, baseline: total, selected: yes, complement: no, unknown: missing,
        winDollarShareOfKnown: knownWins ? yes.winDollars / knownWins : null, lossDollarShareOfKnown: knownLoss ? yes.lossDollars / knownLoss : null,
        decisionMonths: [...new Set(rows.map(r => r.iso.slice(0, 7)))].sort().map(month => ({ month,
          baseline: summarize(rows.filter(r => r.iso.startsWith(month)), labels), selected: summarize(selected.filter(r => r.iso.startsWith(month)), labels) })) });
    }
  }
  for (const p of sourcePins) assert.equal(await fileHash(p.file), p.sha256);
  await verifyPins(process.cwd(), [...pins, protectedState]); await verifyPrefixes(prefixes);
  fs.mkdirSync(out, { recursive: true });
  atomicJson(`${out}/features.json`, features); atomicJson(`${out}/outcome-labels.json`, [...labels.values()]); atomicJson(`${out}/summaries.json`, summaries);
  atomicJson(`${out}/controls.json`, controls); atomicJson(`${out}/manifest.json`, { spec, sourcePins, accepted, pins, archivedPrefixes: prefixes, protectedState,
    rawPulseCounts: pulse.counts, newTradingDefinitions: 0, newEconomicReplays: 0, liveChanges: 0 });
  atomicJson(`${out}/verification.json`, { passed: true, independentlyReaccountedPaths: controls.length, cohortAudit, featureRows: features.length,
    uniqueLabelledEpisodes: labels.size, originalFlowExact: true, descriptorCount: IDS.length, economicQualification: "NOT_EVALUATED_NO_FILTER_REPLAY" });
  console.log(`[AG10-D1] Complete: ${features.length} feature rows; ${labels.size} unique labelled episodes. Cohorts are NOT block savings.`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
