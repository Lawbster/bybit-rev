import fs from "fs";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { execFileSync } from "child_process";
import { fileHash } from "./research-workflow";
import type { Series } from "./hype-freerun-canonical-replay";
import type { ResearchInventoryEvent, ResearchTpDecision, ResearchReductionDecision, ResearchTpTarget } from "./replay-causal-engine";
import { AGGRESSIVE10_ID, aggressive10HighExit, aggressive10HighSnapshot, aggressive10TpDecision, type Aggressive10LadderState } from "../src/bot/aggressive10-policy";
import { SoftStaleController } from "./conditional-soft-stale-policy";
import { highExitCooldown } from "../src/bot/close-cooldown";
import { trailingHighIndices } from "./near-high-policy";
import type { BotConfig } from "../src/bot/bot-config";
export type R = Record<string, any>;
export const CARD_FILE = "research-inputs/aggressive10-release-parity-2026-09-11.json";
export const OUT = "backtests/hype/aggressive10-release-parity-2026-09-11";
export const read = (f: string): any => JSON.parse(fs.readFileSync(f, "utf8"));
export const digest = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function write(file: string, data: unknown) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n"); }
export const protectedFiles = ["bot-config.json", "hl-short-live-config.json", "bot-state.json", "src/bot/index.ts", "src/bot/state.ts", "scripts/replay-causal-engine.ts"];
export async function pins(files: string[]) { return Promise.all([...new Set(files)].sort().map(async file => ({ file, sha256: await fileHash(file), bytes: fs.statSync(file).size }))); }
export async function manifest(dir: string, extra: string[]) {
  assert(!fs.existsSync(dir), `Refuse overwrite: ${dir}`); fs.mkdirSync(dir, { recursive: true });
  const state = { createdAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    dirty: execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split("\n"),
    card: read(CARD_FILE), pins: await pins([...protectedFiles, CARD_FILE, "scripts/aggressive10-release-shared.ts", ...extra]) };
  write(path.join(dir, "manifest.json"), state); return state;
}
export async function finish(dir: string, m: R, result: R) {
  assert.deepEqual(await pins(m.pins.map((p: R) => p.file)), m.pins, "Inputs/source changed during run");
  write(path.join(dir, "verification.json"), { ...result, inputsUnchanged: true, liveChanges: 0 });
}
export async function series() {
  const card = read(CARD_FILE);
  process.env.SIM_START = "2025-07-01T00:00:00Z"; process.env.SIM_END = card.cutoff; process.env.SIM_EQUITY = "32000";
  const core = await import("./hype-freerun-canonical-replay");
  const { loadReplayMarketInputs } = await import("./replay-market-inputs");
  const { rebuildDamagedLatch } = await import("./replay-damaged-latch");
  const { missingMinutes } = await import("./replay-candle-repair");
  const cfg: BotConfig = read("bot-config.json"), s = await core.buildSeries({ candleRepairFile: card.repairFile });
  assert.equal(missingMinutes(s.candles).length, 0); assert.equal(s.candles.at(-1)!.endTs, Date.parse(card.cutoff));
  s.marketInputs = await loadReplayMarketInputs(path.resolve("data"), cfg.symbol, Date.parse(card.cutoff));
  const btc = await core.loadCandles1m("BTCUSDT"); let a = 0, b = 0;
  s.btcRet4h = s.candles.map(c => {
    while (a + 1 < btc.length && btc[a + 1].endTs <= c.endTs) a++;
    while (b + 1 < btc.length && btc[b + 1].ts <= c.endTs - 14400000) b++;
    return btc[a]?.endTs <= c.endTs && c.endTs - btc[a].endTs <= 120000 && Math.abs(btc[b]?.ts - (c.endTs - 14400000)) <= 120000
      ? (btc[a].close / btc[b].open - 1) * 100 : null;
  });
  assert(cfg.filters.damagedRegimeLatch);
  const latch = rebuildDamagedLatch(s.candles, cfg.filters.damagedRegimeLatch, new Map(), at => s.marketInputs!.latchPulse(at));
  s.regimeFlat = s.regimeFlat.map((v, i) => v || latch.blocked[i]);
  const highs = trailingHighIndices(s.candles, 2880);
  return { s, cfg, core, highs };
}
/** Production pure decisions, with an independently rolling-max cached source. */
export class LiveCandidateAdapter {
  inventory: ResearchInventoryEvent["after"] = [];
  phase: Aggressive10LadderState["tpPhase"] = "unseen";
  episode = -1;
  pct = 1.4;
  targetChecks = 0; highChecks = 0; fullWindowChecks = 0; highFires = 0;
  private reference = new SoftStaleController("age", 10, 0, () => { throw Error("age only"); });
  constructor(readonly s: Series, readonly highs: Int32Array, readonly enabled: boolean, readonly assertArchive = true,
    readonly extraHighFillDelay = 0, readonly simulatedGaps = false) {}
  readonly observe = (e: Readonly<ResearchInventoryEvent>) => {
    assert.deepEqual(e.before, this.inventory); this.inventory = e.after;
    if (e.event.reason === "research_exit:exit_2d_1pct") {
      const cooldown = highExitCooldown({ kind: "aggressive10_high", requestedAt: e.event.decisionAt, decisionAt: e.event.decisionAt,
        referenceHigh: 1, decisionPrice: 1 }, e.event.fillAt!, e.event.fillAt!);
      assert.equal(cooldown?.until, (Math.floor(e.event.fillAt! / 14400000) + 2) * 14400000);
    }
  };
  readonly defer = (d: Readonly<ResearchTpDecision>) => {
    if (this.episode !== d.episode) { this.phase = "unseen"; this.episode = d.episode; }
    const v = aggressive10TpDecision(this.phase, d.oldestEntryTime, d.at, d.basePct, d.normalPct);
    this.phase = v.phase; this.pct = v.pct; this.targetChecks++;
    const result = v.pct > d.basePct;
    if (this.assertArchive) assert.equal(result, this.reference.decide(d) && d.basePct < d.normalPct);
    return result;
  };
  readonly target = (t: Readonly<ResearchTpTarget>) => { this.pct = t.pct; };
  gapAt(at: number) { return this.simulatedGaps && at % 14400000 === 0; }
  readonly reduce = (d: Readonly<ResearchReductionDecision>) => {
    if (!this.enabled || !d.canReduce) return null;
    assert.equal(this.inventory.length, d.depth);
    if (d.at - Math.min(...this.inventory.map(p => p.entryTime)) < 14400000) return null;
    const j = this.highs[d.index];
    const high = j >= 0 ? this.s.candles[j].high : null;
    const snapshot = { healthy: high !== null && !this.gapAt(d.at), decisionReady: high !== null && !this.gapAt(d.at), reason: "healthy",
      decisionAt: d.at, sourceStart: d.at - 2880 * 60000, bars: j >= 0 ? 2880 : 0,
      high, close: d.price, distancePct: high ? Math.max(0, (1 - d.price / high) * 100) : null };
    this.highChecks++;
    const fire = aggressive10HighExit(snapshot, this.inventory);
    if (fire || this.highChecks % 10000 === 0) {
      const rows = this.s.candles.slice(Math.max(0, d.index - 2879), d.index + 1).map(c => ({ ...c, timestamp: c.ts }));
      const actual = aggressive10HighSnapshot(rows, d.at);
      assert.equal(actual.high, high); assert.equal(actual.distancePct, snapshot.distancePct); this.fullWindowChecks++;
    }
    const alreadyTp = this.inventory.length > 0 && d.price >= (d.cost / d.qty) * (1 + this.pct / 100);
    if (this.assertArchive) assert.equal(fire && !alreadyTp, high !== null && snapshot.distancePct! <= 1 + 1e-10,
      "Live TP priority differs from researched high exit");
    if (!fire || alreadyTp) return null;
    this.highFires++;
    return { fraction: 1, reason: "research_exit:exit_2d_1pct", fillDelayMs: this.extraHighFillDelay };
  };
}
export function candidateConfig(cfg: BotConfig, id: string) {
  const c = structuredClone(cfg); assert(["baseline", AGGRESSIVE10_ID].includes(id));
  if (id !== "baseline") { c.deepAddStressGuard!.enabled = false; c.tpCooldown!.enabled = false; }
  return c;
}
