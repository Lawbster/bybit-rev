/** Read-only I07 report supplement. No new signals, exits or strategy runs. */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as assert from "assert";
import * as readline from "readline";

async function hash(file: string): Promise<string> {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}

async function main(): Promise<void> {
  const root = path.resolve(__dirname, "..");
  const out = path.resolve(root, process.argv[2] ?? "backtests/hype/hype-bollinger-standalone-2026-09-06");
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
  const manifest = read("manifest.json"), verification = read("verification.json");
  assert.strictEqual(verification.passed, true);
  // Includes the loader/repair sources, not just the raw minute tape.
  for (const pin of [...manifest.inputs, ...manifest.sources]) {
    assert.strictEqual(await hash(path.resolve(root, pin.file)), pin.sha256, `Changed input/source ${pin.file}`);
  }
  for (const pin of verification.artifacts) {
    assert.strictEqual(await hash(path.join(out, pin.file)), pin.sha256, `Changed artifact ${pin.file}`);
  }
  const spec = manifest.spec;
  process.env.SIM_START = spec.indicatorSeedBarStart;
  process.env.SIM_END = spec.historyEnd;
  const { loadCandles1m } = await import("./hype-freerun-canonical-replay");
  const candles = await loadCandles1m(spec.symbol, path.join(root, "data"), Date.parse(spec.historyEnd), path.resolve(root, spec.repairFile));
  const indices = new Map(candles.map((c, i) => [c.ts, i]));
  const ids = ["clock_long", "clock_short", ...read("shortlist.json").topFiveIds, ...read("ranking.json").slice(0,5).map((r:any)=>r.id)];
  const trades: any[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(out, "trades.jsonl")), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const trade = JSON.parse(line);
    if (trade.delayMs === 0 && ids.includes(trade.id)) trades.push(trade);
  }
  const results: object[] = [];
  for (const id of [...new Set<string>(ids)]) for (const window of ["full", "recent"]) {
    const selected = trades.filter(t => t.id === id && t.window === window && t.delayMs === 0);
    if (!selected.length) { results.push({ id, window, delayMs: 0, n: 0, worst: null, top5PctClosedNet: null }); continue; }
    let worst: null | { entry: string; at: string; entryPrice: number; adversePrice: number; grossAdverseUsd: number; grossAdversePct: number; closedNet: number } = null;
    for (const t of selected) {
      const start = indices.get(t.entryAt), finish = indices.get(t.exitAt);
      assert.ok(start != null && finish != null && finish > start, `Missing/nonpositive trade interval ${id}`);
      for (let i = start!; i < finish!; i++) {
        const c = candles[i];
        assert.strictEqual(c.ts, t.entryAt + (i - start!) * 60_000, "Minute continuity");
        // Exit-minute H/L are deliberately excluded: position exits at its open.
        const adversePrice = t.side === "long" ? c.low : c.high;
        const loss = (adversePrice - t.entryPrice) * t.qty * (t.side === "long" ? 1 : -1);
        if (!worst || loss < worst.grossAdverseUsd) worst = {
          entry: new Date(t.entryAt).toISOString(), at: new Date(c.ts).toISOString(),
          entryPrice: t.entryPrice, adversePrice, grossAdverseUsd: loss,
          grossAdversePct: loss / (t.entryPrice * t.qty) * 100, closedNet: t.net,
        };
      }
    }
    const sorted = [...selected].sort((a, b) => b.net - a.net);
    const winning = sorted.filter(t => t.net > 0);
    const top5WinningDollars = winning.slice(0, 5).reduce((sum, t) => sum + t.net, 0);
    const closedNet = selected.reduce((sum, t) => sum + t.net, 0);
    const last = sorted[sorted.length - 1];
    results.push({ id, window, delayMs: 0, n: selected.length, top5WinningDollars,
      top5PctClosedNet: closedNet > 0 ? 100 * top5WinningDollars / closedNet : null,
      worstClosed: { entry: new Date(last.entryAt).toISOString(), exit: new Date(last.exitAt).toISOString(), net: last.net }, worst });
  }
  console.log(JSON.stringify({ readOnly: true, allPinsMatched: true,
    scope: "Completed trades only, immediate model; no liquidation/queue claims, no new strategy definitions", results }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
