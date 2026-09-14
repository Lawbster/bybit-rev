import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { installFatalDiagnostics } from "../src/runtime-fatal";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "fatal-tests-"));
const modulePath = path.resolve("src/runtime-fatal.ts");
const sentinel = "test-secret-must-never-appear-987654";
let cases = 0;
function child(name: string, body: string, flags: string[] = [], brokenDisk = false, expectedExit = 1) {
  const dir = path.join(root, name);
  if (brokenDisk) fs.writeFileSync(dir, "not a directory");
  const source = `const { installFatalDiagnostics } = require(${JSON.stringify(modulePath)});
    const fatal = installFatalDiagnostics('fixture', ${JSON.stringify(dir)});
    ${body}`;
  const result = spawnSync(process.execPath, [...flags, "-r", "ts-node/register/transpile-only", "-e", source], {
    cwd: process.cwd(), encoding: "utf8", timeout: 10_000,
    env: { ...process.env, NODE_OPTIONS: "", FIXTURE_API_SECRET: sentinel },
  });
  assert.ifError(result.error);
  assert.equal(result.status, expectedExit, `${name}: ${result.stderr}`);
  assert.equal(result.signal, null);
  const files = fs.existsSync(dir) && !brokenDisk ? fs.readdirSync(dir) : [];
  const rows = files.flatMap(file => fs.readFileSync(path.join(dir, file), "utf8").trim().split("\n").map(s => JSON.parse(s)));
  if (expectedExit === 0) assert.equal(rows.length, 0);
  else if (!brokenDisk) {
    assert.equal(rows.length, 1, "one diagnostic even on strict rejection");
    assert.equal(rows[0].service, "fixture");
    assert.equal(rows[0].pid, result.pid);
    assert(rows[0].timestamp > 0);
    assert(!JSON.stringify(rows).includes(sentinel));
    assert(!JSON.stringify(rows).includes("secret.invalid"));
  } else assert(result.stderr.includes('"service":"fixture"'), "stderr survives disk error");
  cases++;
  return rows[0];
}

const startup = child("partial-startup", `
  setInterval(() => {}, 1000); // emulate a WS/timer already started before startup fails
  Promise.reject(new Error('startup failed')).catch(err => fatal.exit(err));`);
assert.equal(startup.origin, "startup");
const uncaught = child("uncaught", `setTimeout(() => { throw new Error('timer failed'); }, 1);`);
assert.equal(uncaught.origin, "uncaughtException");
assert(uncaught.stack.includes("at "));
for (const mode of ["throw", "warn", "strict"]) {
  child(`rejection-${mode}`, "setInterval(() => {}, 1000); Promise.reject(new Error('async failure'));", [`--unhandled-rejections=${mode}`]);
}
const safe = child("redacted", `fatal.exit(new Error('api_key=anything ' + process.env.FIXTURE_API_SECRET + ' https://secret.invalid/token'))`);
assert(safe.message.includes("[redacted]"));
child("broken-disk", "fatal.exit(new Error('disk failure'));", [], true);
child("normal-exit", "process.exit(0);", [], false, 0);
child("plain-rejection", "Promise.reject('plain string failure');");
child("hostile-error-object", "fatal.exit({ get message() { throw Error('bad getter'); } });");
const before = [process.listenerCount("uncaughtExceptionMonitor"), process.listenerCount("unhandledRejection")];
const installed = installFatalDiagnostics("test-uninstall", root);
installed.uninstall();
assert.deepEqual([process.listenerCount("uncaughtExceptionMonitor"), process.listenerCount("unhandledRejection")], before);

// Entrypoint inventory, checked without importing anything capable of trading.
for (const file of ["src/bot/index.ts", "src/data-collector.ts", "src/hyperliquid-collector.ts",
  "src/bot/operational-watchdog.ts", "src/bot/hl-short-live.ts", "src/bot/hl-short-breakdown-shadow.ts",
  "src/bot/hl-short-bidpullvolume-shadow.ts", "src/bot/maker-tp-fill-shadow.ts"]) {
  const source = fs.readFileSync(file, "utf8");
  assert(source.includes("installFatalDiagnostics("), file);
  assert(source.includes("fatal.exit(err)"), file);
}
console.log(`runtime fatal tests passed (${cases} real child processes; nonzero exits, redaction, failed disk, normal exit)`);
