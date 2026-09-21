/** Independent negative checks beyond the storage worker's round-trip suite. */
import assert from "assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { archiveDirectory, ArchiveManifest, readArchiveManifest, restoreArchive, verifyArchive } from "./research-archive-store";
import { canonical, sha } from "./research-workflow";

async function main() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "research-archive-adversarial-"));
  const repo = path.join(home, "repo"), vault = path.join(home, "vault");
  const source = "backtests/example/job";
  const dir = path.join(repo, source);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "a.json"), '{"one":1}\n');
  fs.writeFileSync(path.join(dir, "b.json"), '{"two":2}\n');
  let checks = 0;
  const forged = (parent: ArchiveManifest, mutate: (value: ArchiveManifest) => void) => {
    const m = JSON.parse(JSON.stringify(parent)) as ArchiveManifest;
    mutate(m);
    m.id = sha(canonical({ version: m.version, source: m.source, directories: m.directories, files: m.files }));
    fs.writeFileSync(path.join(vault, "studies", `${m.id}.json`), JSON.stringify(m));
    return m.id;
  };
  try {
    const original = await archiveDirectory(repo, vault, source, { minAgeHours: 0 });
    const outsideSource = forged(original, m => { m.files[0].path = "bot-config.json"; });
    assert.throws(() => readArchiveManifest(vault, outsideSource)); checks++;
    const outsideDir = forged(original, m => { m.directories.push("backtests/other/job"); });
    assert.throws(() => readArchiveManifest(vault, outsideDir)); checks++;
    const dotted = forged(original, m => { m.files[0].path = `${source}/tricky. `; });
    assert.throws(() => readArchiveManifest(vault, dotted)); checks++;
    const alias = forged(original, m => { m.files[1].path = m.files[0].path.toUpperCase(); });
    assert.throws(() => readArchiveManifest(vault, alias)); checks++;
    const undersized = forged(original, m => { m.files[0].bytes = 1; });
    await assert.rejects(verifyArchive(vault, undersized)); checks++;

    // A concurrent target appearing AFTER preflight must not be replaced.
    const restored = path.join(home, "restore"); fs.mkdirSync(restored);
    const concurrent = path.join(restored, source, "b.json");
    await assert.rejects(restoreArchive(restored, vault, original.id, {
      onProgress: message => {
        if (message.includes("a.json")) fs.writeFileSync(concurrent, "new writer owns this");
      },
    }));
    assert.equal(fs.readFileSync(concurrent, "utf8"), "new writer owns this"); checks++;

    // Restore's empty-directory path cannot escape via an ancestor junction.
    const emptySource = "backtests/example/emptyjob";
    fs.mkdirSync(path.join(repo, emptySource, "empty"), { recursive: true });
    const emptyManifest = await archiveDirectory(repo, vault, emptySource, { minAgeHours: 0 });
    const linkRepo = path.join(home, "links"), outside = path.join(home, "outside");
    fs.mkdirSync(linkRepo); fs.mkdirSync(outside);
    let linkAvailable = true;
    try { fs.symlinkSync(outside, path.join(linkRepo, "backtests"), "junction"); }
    catch (error: any) { if (error.code === "EPERM") linkAvailable = false; else throw error; }
    if (linkAvailable) {
      await assert.rejects(restoreArchive(linkRepo, vault, emptyManifest.id));
      assert.deepEqual(fs.readdirSync(outside), []); checks++;
      const linkedVault = path.join(home, "linked-vault");
      fs.symlinkSync(outside, linkedVault, "junction");
      await assert.rejects(archiveDirectory(repo, linkedVault, source, { minAgeHours: 0 }));
      assert.deepEqual(fs.readdirSync(outside), []); checks++;
      for (const component of ["objects", "studies"]) {
        const routedVault = path.join(home, `redirected-${component}`);
        fs.mkdirSync(routedVault);
        fs.symlinkSync(outside, path.join(routedVault, component), "junction");
        await assert.rejects(archiveDirectory(repo, routedVault, source, { minAgeHours: 0 }));
        assert.deepEqual(fs.readdirSync(outside), [], `Nothing written through ${component} junction`); checks++;
      }
    }

    const secretSource = "backtests/example/secret";
    fs.mkdirSync(path.join(repo, secretSource), { recursive: true });
    fs.writeFileSync(path.join(repo, secretSource, ".env.local"), "NOT_A_REAL_SECRET=fixture");
    await assert.rejects(archiveDirectory(repo, vault, secretSource, { minAgeHours: 0 })); checks++;

    // Mutation discovered after object publication must never seal a manifest.
    const changedVault = path.join(home, "changed-vault");
    let mutated = false;
    await assert.rejects(archiveDirectory(repo, changedVault, source, {
      minAgeHours: 0, onProgress: message => {
        if (!mutated && message.includes("archived")) {
          mutated = true; fs.writeFileSync(path.join(dir, "b.json"), "changed mid-snapshot");
        }
      },
    }));
    assert(!fs.existsSync(path.join(changedVault, "studies")) || fs.readdirSync(path.join(changedVault, "studies")).length === 0); checks++;

    // A syntactically valid checksum receipt must not make truncated gzip valid.
    const first = original.files[0], object = path.join(vault, first.objectPath);
    const truncated = fs.readFileSync(object).subarray(0, 12);
    fs.writeFileSync(object, truncated);
    const truncatedId = forged(original, m => {
      m.files[0].storedSha256 = sha(truncated); m.files[0].storedBytes = truncated.length;
    });
    await assert.rejects(verifyArchive(vault, truncatedId)); checks++;
    console.log(`Research archive independent safety: ${checks} checks passed.`);
  } finally {
    const resolved = fs.realpathSync(home), base = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), base);
    assert(path.basename(resolved).startsWith("research-archive-adversarial-"));
    fs.rmSync(resolved, { recursive: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
