/** Descriptive location of copied live fills, NOT a counterfactual live decision replay. */
import fs from "fs";
import { prices } from "./hype-failed-recovery-study";
import { fileHash } from "./research-workflow";
async function main() {
  const card = JSON.parse(fs.readFileSync("research-inputs/near-high-ladder-2026-09-10.json", "utf8")).definition;
  const manifest = JSON.parse(fs.readFileSync(`${card.archive}/manifest.json`, "utf8"));
  const state = JSON.parse(fs.readFileSync("bot-state.json", "utf8"));
  const health = JSON.parse(fs.readFileSync("data/HYPEUSDT_runtime_health.json", "utf8"));
  const cs = await prices(Date.parse(card.cutoff), manifest.repairFile);
  const fills = state.positions.map((p: any, k: number) => {
    const at = p.entryTime, end = Math.floor(at / 60000) * 60000;
    if (end > Date.parse(card.cutoff)) return { rung: k + 1, recordedEntryTime: at, excluded: "after_frozen_candle_cutoff" };
    const i = (end - cs[0].endTs) / 60000;
    const references = [1, 7, 30].map(days => {
      const n = days * 1440, window = cs.slice(i - n + 1, i + 1);
      if (i - n + 1 < 0 || window.length !== n || window.at(-1)!.endTs !== end) return { days, ready: false };
      const high = window.reduce((best, c) => c.high >= best.high ? c : best);
      return { days, ready: true, high: high.high, highKnownAt: new Date(high.endTs).toISOString(), sourceEnd: new Date(end).toISOString(),
        observedClose: window.at(-1)!.close, paidPriceDistancePct: Math.max(0, 100 * (1 - p.entryPrice / high.high)),
        closedPriceDistancePct: Math.max(0, 100 * (1 - window.at(-1)!.close / high.high)) };
    });
    return { rung: k + 1, entry: new Date(at).toISOString(), fill: p.entryPrice, notional: p.notional, references };
  });
  console.log(JSON.stringify({ snapshotWrittenAt: new Date(health.writtenAt).toISOString(), candleCutoff: card.cutoff,
    stateSha256: await fileHash("bot-state.json"), runtimeSha256: await fileHash("data/HYPEUSDT_runtime_health.json"),
    caveat: "Current surviving fills only, selection-biased n=1 ladder. Past closed-minute highs before recorded entryTime; paid fill was not known before ordering. This locates fills, does not prove a hypothetical gate would block or save this ladder. Later runtime is NOT covered by the frozen economic replay.", fills }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
