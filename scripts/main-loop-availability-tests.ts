import assert from "assert";
import fs from "fs";
import vm from "vm";
import ts from "typescript";
import { AddRetryBackoff, RuntimePositionCap, validPositionCapOverride } from "../src/bot/entry-availability";
import { LongSideGuard } from "../src/bot/long-side-guard";
import { buildSelectedIdsAllocation } from "../src/bot/partial-close-transaction";
import { canExecuteSRPartialAction } from "../src/bot/sr-shadow";
import { BoundedRefresh } from "../src/bot/bounded-refresh";
import { LiveCandleSource } from "../src/bot/live-candle-source";

// Execute the ACTUAL production loop and guard wrapper, not a second copy of
// their ordering. Only these AST nodes are evaluated: no main(), imports,
// credentials, process startup, real filesystem or exchange can run here.
const source = ts.createSourceFile("index.ts", fs.readFileSync("src/bot/index.ts", "utf8"), ts.ScriptTarget.ES2022, true);
const main = source.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "main")!;
const loop = main.body!.statements.find(ts.isWhileStatement)!;
assert(loop && loop.expression.kind === ts.SyntaxKind.TrueKeyword);
function functionSource(name: string): string {
  const node = main.body!.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert(node, `production function ${name} missing`);
  return node.getText(source);
}
const compiled = ts.transpileModule(`${functionSource("runLongSideMutation")}
${functionSource("applyOverride")}
${functionSource("clearOverrideIfOneShot")}
${functionSource("entryCandleBlockReason")}
${functionSource("executeGuardedPartialClose")}
async function runLoopUnderTest() { ${loop.getText(source)} }
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

const NOW = 1_800_000_060_000;
type Exit = "emergency" | "funding" | "hard" | "high" | "stale" | "none";
function fixture(options: { paused?: boolean; exit?: Exit; reconcile?: boolean; open?: boolean; badConfig?: boolean; pending?: boolean; aggressive10?: boolean } = {}) {
  const events: string[] = [], errors: string[] = [], sleeps: number[] = [];
  let sleepReached!: () => void;
  const atSleep = new Promise<void>(resolve => { sleepReached = resolve; });
  const positions = [{ id: "rung", entryPrice: 100, entryTime: NOW - 13 * 3_600_000, qty: 1, notional: 100, level: 0 }];
  const data: any = { positions, lastAddTime: options.open ? 0 : NOW, peakEquity: 10000,
    lastFundingSettlement: NOW, totalFunding: 0, riskOffUntil: 0, forcedExitCooldownUntil: 0,
    lastTrendCheck: { blocked: false }, regime: { flatActive: false } };
  const exit = (kind: Exit) => {
    events.push(`check:${kind}`);
    return options.exit === kind ? { action: kind === "stale" ? "reduce_tp" : "flatten", reason: kind, reducedTpPct: .5 }
      : { action: "hold", reason: "hold" };
  };
  const context: any = {
    runtimePerformance: { beginCycle: () => {} },
    hasRecoveryInventory: () => false,
    Date: class extends Date { static now() { return NOW; } },
    cycleCount: 0, lastMainLoopCycleAt: 0, lastPendingResolutionSignature: "",
    config: { mode: "live", symbol: "HYPEUSDT", pollIntervalSec: 10, feeRate: .00055, tpPct: 1.4,
      maxDrawdownPct: 0, maxPositions: 11, addIntervalMin: 30, priceTriggerPct: .3,
      basePositionUsdt: 800, addScaleFactor: 1.35, leverage: 25,
      hedge: { enabled: false }, sr: { enabled: false }, filters: {}, exits: {} },
    configPath: "config.json", OVERRIDE_FILE: "override.json", SIGNAL_PAUSE: "bot-pause",
    fs: { existsSync: (p: string) => p === "config.json" },
    path: { resolve: (...p: string[]) => p.join("/") },
    readOverride: () => null,
    loadRuntimePositionCap: () => { if (options.badConfig) throw new Error("malformed JSON"); return { maxPositions: 11 }; },
    validPositionCapOverride,
    positionCap: new RuntimePositionCap(11, message => events.push(message)),
    candleSources: {},
    addRetryBackoff: new AddRetryBackoff(),
    latestPrice: { bid1: 100, fundingRate: .0001 },
    state: { get: () => data, getMakerTpOrder: () => null, getPendingOrder: () => null,
      getRecoveryTpOrderId: () => "",
      isRecoveryMode: () => false, isForcedExitCooldown: () => false,
      updateEquity: () => {}, updateTrendCheck: (_at: number, blocked: boolean) => { data.lastTrendCheck.blocked = blocked; },
      setForcedExitCooldown: () => events.push("cooldown"), save: () => {}, updateRiskOff: () => {}, recordBlockedAdd: () => {} },
    executor: { getMode: () => "LIVE" }, isExchangeMode: () => true,
    refreshAggressive10Profile: () => {}, aggressive10Active: options.aggressive10 ?? options.exit === "high",
    aggressive10Context: { refresh: async () => {}, snapshot: () => ({ healthy: true, decisionReady: true, decisionAt: NOW, high: 101, close: 100 }) },
    lastAggressive10DecisionAt: 0, AGGRESSIVE10_HIGH_REASON: "high",
    aggressive10HighExit: () => options.exit === "high", aggressive10TargetPct: () => options.exit === "stale" ? .5 : 1.4,
    ctxMgr: { refresh: async () => {}, getCandles: () => [], getContext: () => null },
    refreshSrContextCoverage: () => {}, srContextCoverage: { healthy: true },
    latestUpsideMarketClampAt: NOW, srEngine: { needsRebuild: () => false }, srMemoryEngine: { needsRebuild: () => false },
    refreshDamagedRegimeLatch: async () => {}, latestDamagedRegimeDecision: { blocked: false },
    checkSignalFiles: () => ({ paused: !!options.paused, flattenRequested: false }),
    lastReconcileTime: options.reconcile ? 0 : NOW, RECONCILE_INTERVAL_MS: 60000,
    reconcilePositions: async () => { events.push("reconcile"); return { synced: true, exchangeFlat: false, status: "synced" }; },
    reconciliationHealth: {}, publishRuntimeHealth: () => {},
    calcEquity: () => ({ equity: 10000 }), capital: 10000, activeTpPct: 1.4, wsFeedStale: false,
    getHype4h: async () => [], getBtc1h: async () => [], getHype1h: async () => [], getHype1d: async () => [],
    checkTrendGate: () => ({ blocked: false, reason: "clear" }), checkPreKillWarning: () => ({ score: 0 }),
    checkEmergencyKill: () => exit("emergency"), checkFundingSpike: () => exit("funding"),
    checkHardFlatten: () => exit("hard"), checkSoftStale: () => exit("stale"),
    updateExchangeTp: async () => { events.push("update-tp"); },
    logger: { warn: (m: string) => events.push(m), info: () => {}, logError: (m: string) => {
      if (options.open && m === "Failed to commit long open (rejected/Rejected): position limit") events.push(m);
      else errors.push(m);
    },
      printStatus: () => {}, logEquity: () => {}, logFilterBlock: () => {}, logFilterShadow: () => {} },
    alerter: {}, orderInFlight: false, longSideGuard: new LongSideGuard(),
    sleep: async (ms: number) => { sleeps.push(ms); sleepReached(); await new Promise(() => {}); },
    SAVE_INTERVAL: 60, preKillLastLog: 0,
    checkMarketRiskOff: () => ({ blocked: false, riskOffUntil: 0 }),
    checkLadderKill: () => ({ blocked: false }), checkVolExpansion: () => ({ blocked: false }),
    checkOverextendedEntry: () => ({ blocked: false }), checkRegimeBreaker: () => ({ blocked: false }),
    calcAddSize: () => 800, canAffordAdd: () => true,
    quiesceMakerTpForMutation: async () => { events.push("quiesce"); return true; },
    logDecision: () => {},
    executeLongOpenTransaction: async () => { events.push("submit-open"); return {
      outcome: "rejected", status: "Rejected", avgPrice: null, error: "position limit" }; },
  };
  const sandbox = vm.createContext(context);
  vm.runInContext(compiled, sandbox);
  // A fake execution effect under the real wrapper makes guard ownership
  // observable, without reproducing coordinator internals in this test.
  context.flattenLadder = async (reason: string) => sandbox.runLongSideMutation(`flatten:${reason}`, async () => {
    assert(context.orderInFlight && context.longSideGuard.isBusy);
    events.push(`close:${reason}`); return true;
  });
  context.fs.appendFileSync = () => {}; context.path.join = (...p: string[]) => p.join("/");
  if (options.pending) {
    const pending = { kind: "long_open", orderLinkId: "pending-open" };
    context.state.getPendingOrder = () => pending;
    context.combineMakerTpFallbackResult = (_state: unknown, result: unknown) => result;
    context.resolvePendingLongTransaction = async () => {
      events.push("resolve-pending");
      return { kind: "long_open", orderLinkId: "pending-open", outcome: "pending", status: "unknown", filledQty: 0, remainingQty: 1 };
    };
    context.lastPendingResolutionLogAt = 0;
    context.PENDING_RESOLUTION_LOG_INTERVAL_MS = 60000;
  }
  return { context, data, events, errors, sleeps, async run() {
    sandbox.runLoopUnderTest().catch((e: Error) => { errors.push(e.message); sleepReached(); });
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([atSleep, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("loop never reached poll sleep")), 1500); })]);
    } finally { clearTimeout(timeout); }
    assert.deepEqual(errors, [], `unexpected loop error: ${errors.join("; ")}`);
  }};
}

async function mainTest() {
  for (const aggressive10 of [false, true]) for (const kind of ["emergency", "funding", "hard", "high", "stale"] as Exit[]) {
    if (kind === "high" && !aggressive10) continue;
    const f = fixture({ paused: true, exit: kind, reconcile: true, aggressive10 });
    await f.run();
    assert(f.events.includes("reconcile"), `pause must permit reconciliation (${kind})`);
    assert(f.events.includes(kind === "stale" ? "update-tp" : `close:${kind}`), `pause must permit ${kind}`);
    assert(!f.events.includes("submit-open"));
    assert(!f.context.orderInFlight && !f.context.longSideGuard.isBusy);
  }
  const paused = fixture({ paused: true, open: true }); await paused.run();
  assert(!paused.events.includes("quiesce"), "pause blocks entry before maker cancellation");
  for (const path of ["pause", "cooldown", "pending", "emergency"] as const) {
    const f = fixture({ paused: path === "pause", pending: path === "pending",
      exit: path === "emergency" ? "emergency" : "none" });
    let requests = 0;
    const source = new LiveCandleSource(() => {
      requests++;
      return new Promise(() => {});
    }, 3_600_000, 2, 15);
    const prefetch = source.prefetch.bind(source);
    source.prefetch = () => {
      assert(!f.context.longSideGuard.isBusy, "maintenance is scheduled outside the mutation guard");
      prefetch();
    };
    f.context.candleSources.btc1h = source;
    if (path === "cooldown") {
      f.context.state.isForcedExitCooldown = () => true;
      f.data.forcedExitCooldownUntil = NOW + 3_600_000;
    }
    await f.run();
    assert.equal(requests, 1, `maintenance runs before ${path}'s early return`);
    assert(source.refresh.pending, "an unresolved candle request must not hold up the loop");
    assert(!f.events.includes("submit-open"));
    if (path === "emergency") assert(f.events.includes("close:emergency"));
    if (path === "pending") assert(f.events.includes("resolve-pending"));
  }
  const manual = fixture({ paused: true, exit: "emergency" });
  manual.context.checkSignalFiles = () => ({ paused: true, flattenRequested: true });
  await manual.run();
  assert(manual.events.includes("close:MANUAL FLATTEN via bot-flatten signal"));
  assert(!manual.events.includes("check:emergency"), "manual flatten retains priority");
  for (const kind of ["emergency", "funding", "high", "none"] as Exit[]) {
    const missing = fixture({ paused: true, exit: kind });
    const hung = new BoundedRefresh<void>(15);
    missing.context.ctxMgr.refresh = () => hung.run(() => new Promise(() => {}));
    const source = new LiveCandleSource(async () => { throw new Error("rate limited"); }, 14_400_000, 201, 15);
    missing.context.getHype4h = () => source.get();
    await missing.run();
    if (kind !== "none") assert(missing.events.includes(`close:${kind}`), `candle failure must not suppress ${kind}`);
    assert(!missing.events.includes("check:hard"), "unknown trend must not reuse an old hostile flag");
    assert(!missing.events.includes("submit-open"));
  }
  const missingEntry = fixture({ open: true });
  missingEntry.context.config.filters.trendBreak = true;
  missingEntry.context.candleSources.hype4h = { prefetch: () => {}, health: () => ({ healthy: false, reason: "missing" }) };
  missingEntry.context.getHype4h = async () => { throw new Error("missing"); };
  await missingEntry.run(); assert(!missingEntry.events.includes("quiesce"));
  const missingThrottle = fixture({ open: true });
  missingThrottle.context.config.addThrottle = { enabled: true, depth: 1, mult: 2, slopeThreshold: -1 };
  missingThrottle.context.ctxMgr.getClosedCoverageStatus = (_now: number, days: number) => {
    assert.equal(days, 6 / 24, "throttle readiness uses its six-hour window"); return { healthy: false };
  };
  await missingThrottle.run(); assert(!missingThrottle.events.includes("quiesce"));
  const recovered = fixture({ paused: true });
  recovered.context.hasRecoveryInventory = () => true;
  recovered.context.lastRecoveryProtectionAttemptAt = 0;
  recovered.context.state.getDesiredLongTp = () => null;
  recovered.context.maintainRecoveryProtection = async () => {
    assert(recovered.context.longSideGuard.isBusy);
    recovered.events.push("recovery-protection"); return { success: true };
  };
  await recovered.run();
  assert(recovered.events.indexOf("recovery-protection") > recovered.events.indexOf("check:hard"));
  assert(!recovered.events.includes("submit-open"));
  const recoveredKill = fixture({ paused: true, exit: "emergency" });
  recoveredKill.context.hasRecoveryInventory = () => true;
  recoveredKill.context.maintainRecoveryProtection = async () => { throw new Error("exit must precede TP maintenance"); };
  await recoveredKill.run(); assert(recoveredKill.events.includes("close:emergency"));
  const config = fixture({ badConfig: true }); await config.run();
  assert(config.events.includes("check:hard"));
  assert(config.events.some(e => e.includes("retaining maxPositions=11")));
  assert.equal(config.context.config.maxPositions, 11);
  assert.deepEqual(config.sleeps, [10000], "bad config must not invoke the outer 30s catch");
  const overrides = fixture();
  let override: any = { symbol: "HYPEUSDT", maxPositions: 15, oneShot: true };
  overrides.context.readOverride = () => override;
  overrides.context.fs.unlinkSync = (p: string) => { assert.equal(p, "override.json"); override = null; };
  assert.equal(overrides.context.applyOverride().overrideActive, true);
  assert.equal(overrides.context.config.maxPositions, 15);
  overrides.context.loadRuntimePositionCap = () => { throw new Error("missing file"); };
  overrides.context.applyOverride(); assert.equal(overrides.context.config.maxPositions, 15);
  overrides.context.clearOverrideIfOneShot();
  overrides.context.applyOverride(); assert.equal(overrides.context.config.maxPositions, 11, "reset uses last base, never override cap");
  overrides.context.loadRuntimePositionCap = () => ({ maxPositions: 10 });
  overrides.context.applyOverride(); assert.equal(overrides.context.config.maxPositions, 10);
  for (const symbol of ["HYPEUSDT", "SUIUSDT"]) {
    const bridge = fixture({ open: true });
    bridge.data.positions = Array.from({ length: 11 }, (_, i) => ({ ...bridge.data.positions[0], id: `rung-${i}`, level: i }));
    bridge.data.lastAddTime = NOW;
    bridge.context.readOverride = () => ({ symbol, maxPositions: 12, oneShot: true });
    await bridge.run();
    assert.equal(bridge.events.includes("submit-open"), symbol === "HYPEUSDT", "only a valid matching override gets its cap-boundary bridge");
  }
  const rejected = fixture({ open: true }); await rejected.run();
  assert(rejected.events.includes("submit-open"));
  assert.deepEqual(rejected.sleeps, [10000], "no rejection sleep under guard");
  assert.equal(rejected.context.addRetryBackoff.until, NOW + 300000);
  assert(!rejected.context.orderInFlight && !rejected.context.longSideGuard.isBusy);
  const backoff = fixture({ open: true, exit: "emergency" });
  backoff.context.addRetryBackoff.recordFailure("leverage", NOW);
  await backoff.run(); assert(backoff.events.includes("close:emergency"));
  const blocked = fixture({ open: true }); blocked.context.addRetryBackoff.recordFailure("position", NOW);
  await blocked.run(); assert(!blocked.events.includes("quiesce")); assert(blocked.events.includes("check:hard"));
  const pending = fixture({ open: true, pending: true }); await pending.run();
  assert(pending.events.includes("resolve-pending"));
  assert(!pending.events.includes("submit-open"));
  assert.equal(pending.context.state.getPendingOrder().orderLinkId, "pending-open");
  const latePause = fixture({ open: true });
  latePause.context.quiesceMakerTpForMutation = async () => {
    latePause.events.push("quiesce");
    latePause.context.fs.existsSync = () => true;
    return true;
  };
  await latePause.run(); assert(latePause.events.includes("quiesce")); assert(!latePause.events.includes("submit-open"));
  assert(!latePause.context.longSideGuard.isBusy);
  const tp = await rejected.context.runLongSideMutation("ws-tp", async () => "closed");
  assert.equal(tp, "closed", "WS TP can acquire the real guard during rejected-add backoff");
  const partial = fixture({ paused: true });
  partial.data.positions.push({ ...partial.data.positions[0], id: "rung-2", level: 1 });
  Object.assign(partial.context, {
    canExecuteSRPartialAction, buildSelectedIdsAllocation,
    srCoverageHorizonDays: 14,
    computeOnChainFeatures: async () => ({}),
    evaluateSRShadowCandidates: () => ({
      partialExitPlan: { keepRungs: 1, closeCount: 1, closeIndices: [0], estimatedNetPnl: 1, estimatedPnl: 2 },
      levels: { nearestResistance: { price: 101, distPct: .1 } },
      candidates: [], firedCandidates: ["test"], ladder: { pnlPct: 1 }, pulse: { pulseDeteriorating: true },
    }),
    writeSRShadowSignal: () => {}, writeSrPartialExitAction: () => {},
    refreshCapital: async () => 10000,
    executePartialCloseTransaction: async () => {
      assert(partial.context.orderInFlight && partial.context.longSideGuard.isBusy);
      partial.events.push("partial-close");
      return { outcome: "committed", filledQty: 1, fillPrice: 101, positionsClosed: 1, totalPnl: 1, totalFees: .1, remainingRungs: 1 };
    },
  });
  partial.context.config.srPartialExitAction = { enabled: true, requiredCandidate: "test", minDepth: 1, keepRungs: 1,
    minLadderPnlPct: 0, requirePlanProfit: true, resistanceBufferPct: 1, cooldownMin: 60 };
  partial.context.state.isSrPartialExitActionCooldown = () => false;
  partial.context.alerter.notifySrPartialExit = async () => {};
  await partial.run(); assert(partial.events.includes("partial-close"), "paused loop still executes eligible S/R partials");
  assert(!partial.context.longSideGuard.isBusy);
  console.log("main loop availability tests passed (actual loop AST, no production startup)");
}
mainTest().catch(e => { console.error(e); process.exitCode = 1; });
