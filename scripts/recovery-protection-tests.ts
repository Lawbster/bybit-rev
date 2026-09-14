import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import vm from "vm";
import ts from "typescript";
import { LiveExecutor } from "../src/bot/executor";
import { StateManager, RecoveryStateError } from "../src/bot/state";
import { maintainRecoveryProtection, retireRecoveryOrder } from "../src/bot/recovery-protection";

const logger = { info() {}, warn() {}, logError() {} } as any;
function fake() {
  let size = 1, takeProfit = 0, tick = ".05", qtyStep = ".01", reads = 0;
  let mode = "ok", status = "New", filled = "0", missing = false, foreign = false;
  const calls: any[] = [];
  const client: any = {
    getInstrumentsInfo: async () => { reads++; return { retCode: 0, result: { list: [{ symbol: "HYPEUSDT",
      lotSizeFilter: { qtyStep, minOrderQty: qtyStep }, priceFilter: { tickSize: tick } }] } }; },
    getPositionInfo: async () => ({ retCode: 0, result: { list: [{ symbol: "HYPEUSDT", positionIdx: 1,
      side: size ? "Buy" : "", size: String(size), takeProfit: String(takeProfit), stopLoss: "90", updatedTime: "1" }] } }),
    setTradingStop: async (req: any) => {
      calls.push(req);
      if (mode !== "mismatch") takeProfit = Number(req.takeProfit);
      if (mode === "flat") size = 0;
      if (mode === "unknown") throw new Error("ack lost");
      return { retCode: 0 };
    },
    getActiveOrders: async () => ({ retCode: 0, result: { list: missing ? [] : [{ symbol: "HYPEUSDT", orderId: "legacy",
      orderLinkId: foreign ? "somebody_else" : "recovery_tp_123", positionIdx: 1, side: "Sell", reduceOnly: true,
      orderType: "Limit", orderStatus: status, cumExecQty: filled }] } }),
    getHistoricOrders: async () => ({ retCode: 0, result: { list: [] } }),
    cancelOrder: async (req: any) => { calls.push({ cancel: req }); if (mode !== "cancel_pending") status = "Cancelled"; return { retCode: 0 }; },
    submitOrder: async () => { throw new Error("standalone recovery order must never be submitted"); },
  };
  const executor = new LiveExecutor("test", "test", logger); (executor as any).client = client;
  return { executor, client, calls, setSize: (n: number) => { size = n; }, setMode: (m: string) => { mode = m; },
    missing: () => { missing = true; }, foreign: () => { foreign = true; }, setFilled: (n: string) => { filled = n; },
    metadata: (t: string, q: string) => { tick = t; qtyStep = q; }, reads: () => reads };
}
const pos = { entryPrice: 100, entryTime: 1000, qty: 1, notional: 100, level: 0, orderId: "recovered_from_exchange" };
async function main() {
  const ex = fake();
  const first = await ex.executor.setRecoveryPositionTp("HYPEUSDT", 101.4321, 1);
  assert(first.success); assert.equal(first.normalizedPrice, 101.4);
  assert.equal(ex.calls[0].positionIdx, 1); assert.equal(ex.calls[0].takeProfit, "101.40");
  assert.equal(ex.calls[0].tpslMode, "Full"); assert(!("qty" in ex.calls[0])); assert(!("stopLoss" in ex.calls[0]));
  ex.setMode("unknown"); assert((await ex.executor.setRecoveryPositionTp("HYPEUSDT", 101.5, 1)).success);
  ex.setMode("mismatch"); assert(!(await ex.executor.setRecoveryPositionTp("HYPEUSDT", 102, 1)).success);
  const before = ex.calls.length;
  assert(!(await ex.executor.setRecoveryPositionTp("HYPEUSDT", 102, 2)).success); assert.equal(ex.calls.length, before);
  ex.setMode("flat"); assert(!(await ex.executor.setRecoveryPositionTp("HYPEUSDT", 102, 1)).success);
  assert(!(await ex.executor.setRecoveryPositionTp("HYPEUSDT", NaN, 1)).success);

  const meta = fake(), old = await meta.executor.getInstrumentLotInfo("HYPEUSDT");
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 3_600_001;
    meta.metadata(".25", ".1");
    const [a, b] = await Promise.all([meta.executor.getInstrumentLotInfo("HYPEUSDT"), meta.executor.getInstrumentLotInfo("HYPEUSDT")]);
    assert.equal(meta.reads(), 2, "one coherent metadata reload shared by callers");
    assert.equal(a.priceTick, .25); assert.equal(b.qtyStep, .1); assert.equal(old.qtyStep, .01);
    assert.equal((await meta.executor.setRecoveryPositionTp("HYPEUSDT", 101.4, 1)).normalizedPrice, 101.25);
  } finally { Date.now = realNow; }

  const legacy = fake(); legacy.setMode("cancel_pending");
  assert(!(await legacy.executor.retireLegacyRecoveryTpOrder("HYPEUSDT", "legacy")).terminal);
  legacy.setMode("ok"); assert((await legacy.executor.retireLegacyRecoveryTpOrder("HYPEUSDT", "legacy")).terminal);
  const notFound = fake(); notFound.missing();
  assert(!(await notFound.executor.retireLegacyRecoveryTpOrder("HYPEUSDT", "legacy")).terminal);
  assert.equal(notFound.calls.length, 0);
  const foreign = fake(); foreign.foreign();
  assert(!(await foreign.executor.retireLegacyRecoveryTpOrder("HYPEUSDT", "legacy")).terminal);
  assert.equal(foreign.calls.length, 0);
  const missingQuantity = fake(); missingQuantity.setFilled("");
  assert(!(await missingQuantity.executor.retireLegacyRecoveryTpOrder("HYPEUSDT", "legacy")).terminal);
  assert.equal(missingQuantity.calls.length, 0, "missing fill evidence must not be treated as zero");
  const wrongInstrument = fake();
  wrongInstrument.client.getInstrumentsInfo = async () => ({ retCode: 0, result: { list: [{ symbol: "SUIUSDT",
    lotSizeFilter: { qtyStep: ".01", minOrderQty: ".01" }, priceFilter: { tickSize: ".01" } }] } });
  assert(!(await wrongInstrument.executor.setRecoveryPositionTp("HYPEUSDT", 101, 1)).success);
  assert.equal(wrongInstrument.calls.length, 0);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "recovery-safety-")), file = path.join(dir, "state.json");
  try {
    const state = new StateManager(file);
    let saves = 0; const save = state.save.bind(state);
    state.save = () => { saves++; save(); };
    state.importRecoveryLong(pos); assert.equal(saves, 1);
    assert(new StateManager(file, { requireExisting: true }).isRecoveryMode());
    const execute = fake(); execute.setMode("mismatch");
    const failed = await maintainRecoveryProtection(state, execute.executor, "HYPEUSDT", 1.4);
    assert(!failed.success); assert.equal(state.getDesiredLongTp()!.syncStatus, "failed");
    assert.equal(state.get().positions.length, 1);
    execute.setMode("ok");
    assert((await maintainRecoveryProtection(state, execute.executor, "HYPEUSDT", 1.4)).success);
    assert(state.isRecoveryMode(), "protection confirmation does not clear generic recovery");
    state.setRecoveryTpOrderId("legacy");
    execute.setMode("cancel_pending");
    assert(!(await maintainRecoveryProtection(state, execute.executor, "HYPEUSDT", .5)).success);
    assert.equal(state.getRecoveryTpOrderId(), "legacy");
    execute.setMode("ok");
    const priorCalls = execute.calls.length;
    assert((await maintainRecoveryProtection(state, execute.executor, "HYPEUSDT", .5)).success);
    assert(execute.calls.slice(priorCalls)[0].takeProfit, "native TP set/readback precedes legacy cancellation");
    assert(execute.calls.slice(priorCalls).some(c => c.cancel));
    assert.equal(state.getRecoveryTpOrderId(), "");
    state.setRecoveryTpOrderId("legacy"); execute.setFilled(".1");
    assert(!(await retireRecoveryOrder(state, execute.executor, "HYPEUSDT")), "unaccounted fills retain identity");
    state.setRecoveryTpOrderId("");

    for (const checkpoint of ["import", "intent", "confirmed"]) {
      const childFile = path.join(dir, `${checkpoint}.json`);
      try {
        const source = `const {StateManager}=require('./src/bot/state'); const {maintainRecoveryProtection}=require('./src/bot/recovery-protection');
          const state=new StateManager(process.argv[1]);state.importRecoveryLong(${JSON.stringify(pos)});
          if(process.argv[2]==='import')process.exit(27);
          if(process.argv[2]==='confirmed')state.markDesiredLongTpConfirmed=()=>process.exit(27);
          maintainRecoveryProtection(state,{setRecoveryPositionTp:async()=>{if(process.argv[2]==='intent')process.exit(27);return {success:true};}},'HYPEUSDT',1.4);`;
        const child = spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", source, childFile, checkpoint],
          { encoding: "utf8", timeout: 10000, windowsHide: true });
        assert.equal(child.status, 27, child.stderr);
        const restart = new StateManager(childFile, { requireExisting: true });
        assert(restart.isRecoveryMode()); assert.equal(restart.get().positions.length, 1);
        if (checkpoint !== "import") assert.equal(restart.getDesiredLongTp()!.syncStatus, "pending");
        assert((await maintainRecoveryProtection(restart, fake().executor, "HYPEUSDT", 1.4)).success);
        assert(restart.isRecoveryMode()); assert.equal(restart.get().realizedPnl, 0);
      } finally { if (fs.existsSync(childFile)) fs.unlinkSync(childFile); }
    }
    // Persist failure cannot expose an imported-but-unlocked ladder.
    const empty = new StateManager(path.join(dir, "missing.json"));
    empty.save = () => { throw new Error("disk full"); };
    assert.throws(() => empty.importRecoveryLong(pos), RecoveryStateError);
    assert.equal(empty.get().positions.length, 0);
    // Invoke the actual startup function without evaluating imports or main().
    // Its broad reconciliation catch must not swallow a failed durable import.
    const src = ts.createSourceFile("index.ts", fs.readFileSync("src/bot/index.ts", "utf8"), ts.ScriptTarget.ES2022, true);
    const startup = src.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === "reconcileOnStartup")!;
    const sandbox = vm.createContext({ LiveExecutor, RecoveryStateError, maintainRecoveryProtection });
    vm.runInContext(ts.transpileModule(startup.getText(src), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText, sandbox);
    await assert.rejects(sandbox.reconcileOnStartup(fake().executor, empty, { symbol: "HYPEUSDT", tpPct: 1.4 }, logger), RecoveryStateError);
    assert.equal(empty.get().positions.length, 0);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
  console.log("recovery protection tests passed (3 actual process exits)");
}
main().catch(err => { console.error(err); process.exitCode = 1; });
