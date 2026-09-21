/** Same-path counterfactual gate observations, NEVER a policy or outcome input. */
import assert from "assert/strict";
import type { BotConfig } from "../src/bot/bot-config";
import { checkDeepAddStressGuard } from "../src/bot/strategy";
import { evaluateSRSupportReopen } from "../src/bot/sr-support-reopen";
import { ReplaySrContext } from "./replay-sr-context";
import type { ResearchInventoryEvent, ResearchSizeDecision } from "./replay-causal-engine";
import type { Series } from "./hype-freerun-canonical-replay";
import type { R } from "./age10-gate-policy";

export class GateObserver {
  inventory: ResearchInventoryEvent["after"] = [];
  hotUntil = 0;
  lastTp: R | null = null;
  context: ReturnType<ReplaySrContext["at"]> | null = null;
  readonly sr: ReplaySrContext;
  constructor(readonly s: Series, readonly cfg: BotConfig) { this.sr = new ReplaySrContext(s.candles, cfg.srShadow!); }
  clock(index: number) { this.context = this.sr.at(this.s.candles[index].endTs); }
  observe(e: Readonly<ResearchInventoryEvent>) {
    assert.deepEqual(this.inventory, e.before); this.inventory = e.after;
    if (e.event.kind !== "close") return;
    const v = e.event;
    if (["tp", "stale_tp"].includes(v.reason)) {
      const rsiIndex = v.fillAt === this.s.candles[v.fillIndex!].endTs ? v.fillIndex! - 1 : v.decisionIndex;
      const rsi = this.s.rsi1H[rsiIndex];
      this.hotUntil = rsi !== null && rsi > this.cfg.tpCooldown!.rsi1hThreshold ? v.fillAt! + this.cfg.tpCooldown!.cooldownMin * 60000 : 0;
      this.lastTp = { at: v.fillAt, reason: v.reason, rsi, rsiIndex, rsiKnownAt: this.s.candles[rsiIndex].endTs };
    } else { this.hotUntil = 0; this.lastTp = null; }
  }
  entry(d: Readonly<ResearchSizeDecision>, actual: BotConfig) {
    assert.equal(d.nextDepth, this.inventory.length + 1); assert(this.context);
    const snap = this.s.marketInputs!.snapshot(d.at), pulse = snap.pulse;
    const bybitFallback = pulse.fdByNow === null;
    pulse.fdByNow = pulse.fdByNow ?? this.s.bybitFunding[d.index]; pulse.btc4hMovePct = this.s.btcRet4h?.[d.index] ?? null;
    const guard = checkDeepAddStressGuard([...this.inventory], d.priceDropOk, pulse, this.cfg), ctx = this.context;
    const support = ctx.engine.nearestSupport(d.at, d.price);
    const reopen = guard.blocked && evaluateSRSupportReopen({ contextHealthy: ctx.coverage.healthy,
      liveGuardBlocked: guard.blocked, liveGuardReasons: guard.reasons,
      fundingStressOnly: guard.stressKinds.length > 0 && guard.stressKinds.every(k => k === "funding"),
      priceDropOk: d.priceDropOk, nextDepth: d.nextDepth, support, pulse, config: this.cfg.srSupportReopenAction! }).eligible;
    const deepWouldBlock = guard.blocked && !reopen, hotWouldBlock = d.at < this.hotUntil;
    if (actual.deepAddStressGuard!.enabled) assert(!deepWouldBlock, "Observed permitted add must pass actual deep/support guard");
    if (actual.tpCooldown!.enabled) assert(!hotWouldBlock, "Observed permitted add must pass actual TP cooldown");
    return { at: d.at, index: d.index, episode: d.episode, nextDepth: d.nextDepth, priceDropOk: d.priceDropOk,
      deepWouldBlock, hotWouldBlock, deepRawBlocked: guard.blocked, supportReopen: reopen,
      guardReasons: guard.reasons, hotUntil: this.hotUntil, lastTp: this.lastTp,
      rsi1h: this.s.rsi1H[d.index], crsi4h: this.s.crsi4H[d.index], aboveEma200: this.s.aboveEma200[d.index],
      ret6h: this.s.ret6h[d.index], ret12h: this.s.ret12h[d.index], btcRet4h: pulse.btc4hMovePct,
      fdByNow: pulse.fdByNow, fdBnNow: pulse.fdBnNow, fdHlNow: pulse.fdHlNow, bybitFallback,
      hl15: pulse.hlTaker15m, hl1h: pulse.hlTaker1h, hl15Samples: pulse.hlTaker15mSamples,
      hl1hSamples: pulse.hlTaker1hSamples, hlAgeSec: pulse.hlTakerAgeSec,
      srHealthy: ctx.coverage.healthy, supportPrice: support?.lv.price ?? null, sources: snap.sources };
  }
}
