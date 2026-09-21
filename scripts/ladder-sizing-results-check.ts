/** Read-only independent recomputation of saved sizing permissions, inventory and accounting. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { sizedAdd } from "./ladder-sizing-policy";
import { auditInventory } from "./ladder-sizing-audit";
import { exposureDelta, qualifyExposure } from "./ladder-exposure-metrics";
async function main() {
  const dir = process.argv[2] ?? "backtests/hype/hype-ladder-sizing-2026-09-05-validated";
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const lines = (f: string) => fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").filter(Boolean).map(x => JSON.parse(x));
  const manifest = read("manifest.json"), cfg = JSON.parse(fs.readFileSync("bot-config.json", "utf8"));
  const bases = read("baseline.json"), old = read("legacy-baseline.json"), results = read("results.json");
  const expected = JSON.parse(fs.readFileSync(path.join(manifest.baseSpec.baselineDir, "summary.json"), "utf8"));
  let decisions = 0, fills = 0, partials = 0;
  for (const r of [...old, ...bases, ...results]) {
    const isOld = r.clock === "legacy_reanchor", label = `${r.model}--${isOld ? "legacy-baseline" : r.variant}`;
    const v = manifest.spec.variants.find((x: any) => x.id === r.variant) ?? null;
    const ds = lines(`${label}-decisions.jsonl`), inv = lines(`${label}-inventory.jsonl`);
    const permits = new Map<number, any>(); let previousIndex = -1; const episodes = new Set<number>();
    for (const x of ds) {
      assert(x.decision.index > previousIndex); previousIndex = x.decision.index;
      assert.equal(sizedAdd(v, x.decision, cfg.basePositionUsdt, cfg.addScaleFactor, manifest.spec.minimumClippedAddBaseFraction), x.notional);
      permits.set(x.decision.index, x);
      if (x.notional < x.decision.requestedNotional - 1e-8) episodes.add(x.decision.episode);
    }
    assert.equal(episodes.size, r.vetoEpisodes);
    let realized = 0, epPnl = 0, lastAddClock = 0;
    for (const x of inv) {
      if (x.event.kind === "open") {
        const permit = permits.get(x.event.decisionIndex); assert(permit && permit.notional > 0);
        assert.equal(x.event.fillIndex, x.event.decisionIndex + 1);
        assert(Math.abs(x.after.at(-1).notional - permit.notional) < 1e-6);
        assert(Math.abs(permit.decision.entryCostNotional - x.before.reduce((n: number, p: any) => n + p.notional, 0)) < 1e-6);
        assert.equal(permit.decision.nextDepth, x.after.length);
        lastAddClock = x.event.fillAt;
      } else {
        const removed = x.before.filter((p: any) => !x.after.some((a: any) => a.id === p.id));
        const net = removed.reduce((n: number, p: any) => n + (x.event.price - p.entryPrice) * p.qty - cfg.feeRate * (p.notional + p.qty * x.event.price), 0);
        realized += net; epPnl += net;
        if (x.event.kind === "close") {
          const outcome = r.metrics.episodes.find((e: any) => e.close === new Date(x.event.fillAt).toISOString()); assert(outcome);
          assert(Math.abs(outcome.pnl - epPnl) < 1e-6); epPnl = 0; lastAddClock = 0;
        } else if (isOld) lastAddClock = Math.max(...x.after.map((p: any) => p.entryTime));
      }
      assert.equal(x.lastAddTime, lastAddClock);
    }
    assert(Math.abs(realized - r.metrics.realized) < 1e-6);
    const remaining = inv.at(-1)?.after ?? [];
    const openPnl = remaining.reduce((n: number, p: any) => n + (r.endMark.price - p.entryPrice) * p.qty - cfg.feeRate * (p.notional + r.endMark.price * p.qty), 0);
    assert(Math.abs(openPnl - r.metrics.openPnl) < 1e-6);
    const turnover = inv.reduce((n: number, x: any) => n + x.event.qty * x.event.price, 0) + r.endMark.price * r.endMark.qty;
    assert(Math.abs(turnover - r.stress.executedPlusMarkedExitTurnover) < 1e-6);
    assert(Math.abs(r.stress.fixedPathNet - (r.metrics.totalPnl - turnover * .0005)) < 1e-6);
    assert(Math.abs(r.metrics.monthly.reduce((n: number, m: any) => n + m.mtmPnl, 0) - r.metrics.totalPnl) < 1e-6);
    // JSON persists -0 as 0. Compare the recomputed observation in its persisted representation.
    assert.deepEqual(JSON.parse(JSON.stringify(auditInventory(inv, cfg, r.metrics, isOld))), r.audit);
    if (isOld) assert.equal(r.digest, expected.find((x: any) => x.id === r.model).digest);
    if (v) assert.deepEqual(exposureDelta(r.metrics, bases.find((b: any) => b.model === r.model).metrics), r.delta);
    decisions += ds.length; fills += inv.length; partials += r.audit.partials;
  }
  assert.deepEqual(manifest.spec.variants.map((v: any) => ({ ...v, ...qualifyExposure(results.filter((r: any) => r.variant === v.id), manifest.baseSpec) })), read("ranking.json"));
  for (const x of [...manifest.sources, ...manifest.inputs]) {
    const h = crypto.createHash("sha256"); for await (const b of fs.createReadStream(x.file)) h.update(b);
    assert.equal(h.digest("hex"), x.sha256, x.file);
  }
  console.log(JSON.stringify({ passed: true, oldDigests: 4, correctedBaselines: 4, variantCases: results.length, decisions, fills, partials,
    inventoryAllocationAndClock: true, actualOpenPermissions: true, realizedMonthlyAndPairedAccounting: true, hashesUnchanged: true }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
