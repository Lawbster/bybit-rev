import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { archiveMain, checkCompletion, loadArchiveConfig, resolveArchiveVault } from "./research-archive";
import { sha } from "./research-workflow";

async function main() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "research-archive-cli-tests-"));
  const repo = path.join(parent, "repo"), vault = path.join(parent, "vault");
  fs.mkdirSync(repo); fs.mkdirSync(vault);
  const source = "backtests/example/completed-job";
  const sourceDir = path.join(repo, source);
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(path.join(sourceDir, "verification.json"), JSON.stringify({ passed: true }));
  fs.writeFileSync(path.join(sourceDir, "trades.jsonl"), '{"trade":1}\n'.repeat(500));
  const config = {
    version: 1, minAgeHours: 0, reserveFreeGiB: 1,
    targets: [{ source, completion: { file: "verification.json", field: "passed", equals: true } }],
  };
  const configPath = path.join(repo, "research-archive-config.json");
  const writeConfig = (value: unknown) => fs.writeFileSync(configPath, JSON.stringify(value));
  writeConfig(config);
  const env = { RESEARCH_ARCHIVE_ROOT: vault };
  const messages: string[] = [];
  const originalLog = console.log;
  let checks = 0;
  try {
    console.log = (...args) => messages.push(args.map(String).join(" "));
    assert.deepEqual(loadArchiveConfig(repo, "research-archive-config.json"), config); checks++;
    assert.equal(resolveArchiveVault(env), vault); checks++;
    assert.equal(resolveArchiveVault({ OneDriveConsumer: parent }), path.join(parent, "TradingResearch", "reverse-copy")); checks++;
    assert.throws(() => resolveArchiveVault({}), /OneDrive/); checks++;
    assert.throws(() => resolveArchiveVault({}, "relative"), /absolute/); checks++;
    checkCompletion(repo, config.targets[0]); checks++;
    checkCompletion(repo, { source, completion: { file: "verification.json", sha256: sha(fs.readFileSync(path.join(sourceDir, "verification.json"))) } }); checks++;
    assert.throws(() => checkCompletion(repo, { source, completion: { file: "verification.json", sha256: "0".repeat(64) } })); checks++;
    await archiveMain(["status"], repo, {}); // No OneDrive configured and no cloud reads.
    assert(!fs.existsSync(path.join(repo, "docs"))); checks++;
    await archiveMain(["plan"], repo, env);
    assert.equal(fs.readdirSync(vault).length, 0, "Preview must not write to vault"); checks++;
    await assert.rejects(archiveMain(["run", "--garbage"], repo, env)); checks++;
    await assert.rejects(archiveMain(["verify", "../escape"], repo, env)); checks++;

    for (const bad of [
      { ...config, minAgeHours: -1 },
      { ...config, reserveFreeGiB: 0 },
      { ...config, targets: [config.targets[0], config.targets[0]] },
      { ...config, targets: [{ ...config.targets[0], source: "data/HYPEUSDT" }] },
      { ...config, targets: [{ ...config.targets[0], source: "backtests/hype" }] },
      { ...config, targets: [{ ...config.targets[0], source: "backtests/../secrets" }] },
      { ...config, targets: [{ ...config.targets[0], completion: { file: "../../secret.json", field: "passed", equals: true } }] },
      { ...config, targets: [{ ...config.targets[0], completion: { file: "verification.json", field: "passed", equals: false } }] },
    ]) {
      writeConfig(bad);
      assert.throws(() => loadArchiveConfig(repo, "research-archive-config.json")); checks++;
    }
    writeConfig(config);
    fs.writeFileSync(path.join(sourceDir, "verification.json"), '{"passed":false}');
    await assert.rejects(archiveMain(["run"], repo, env), /Not completed/);
    assert.equal(fs.readdirSync(vault).length, 0); checks++;
    fs.writeFileSync(path.join(sourceDir, "verification.json"), '{"passed":true}');

    await archiveMain(["run"], repo, env);
    const catalog = path.join(repo, "docs/research/archive-catalog");
    const name = fs.readdirSync(catalog).find(n => /^[a-f0-9]{64}\.json$/.test(n))!;
    assert(name, "Manifest copied to local catalog"); checks++;
    const id = name.slice(0, -5);
    const original = fs.readFileSync(path.join(sourceDir, "trades.jsonl"));
    await archiveMain(["run"], repo, env); // Idempotent.
    assert.equal(fs.readdirSync(catalog).length, 1); checks++;
    await archiveMain(["verify", id], repo, env); checks++;
    await archiveMain(["restore", id], repo, env);
    assert.deepEqual(fs.readFileSync(path.join(sourceDir, "trades.jsonl")), original); checks++;
    if (process.platform === "win32") {
      await archiveMain(["compress-local", id], repo, env);
      assert.deepEqual(fs.readFileSync(path.join(sourceDir, "trades.jsonl")), original); checks++;
    }
    await archiveMain(["restore-test", id], repo, env);
    const receipt = JSON.parse(fs.readFileSync(path.join(catalog, `${id}.restore-test.json`), "utf8"));
    assert.equal(receipt.restoredFiles, 2);
    assert.equal(receipt.cloudSync, "not_checked");
    assert.deepEqual(fs.readdirSync(path.join(repo, ".research-archive")).filter(n => n.startsWith("restore-test-")), []);
    assert.deepEqual(fs.readdirSync(path.join(repo, ".research-archive/staging")), []); checks++;
    await archiveMain(["status"], repo, {}); checks++;
    assert(messages.some(x => x.includes('"originalsRetained":true'))); checks++;
  } finally {
    console.log = originalLog;
    const resolved = fs.realpathSync(parent), temp = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), temp);
    assert(path.basename(resolved).startsWith("research-archive-cli-tests-"));
    fs.rmSync(resolved, { recursive: true });
  }
  console.log(`Research archive CLI: ${checks} checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
