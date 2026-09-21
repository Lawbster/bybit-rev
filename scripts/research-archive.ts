/** Explicit local research archiving. Never imports a trading owner or deletes a source. */
import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { atomicJson, canonical, fileHash, inside, sha } from "./research-workflow";
import { ArchiveManifest, archiveDirectory, inspectDirectory, readArchiveManifest, restoreArchive, verifyArchive } from "./research-archive-store";

type Target = { source: string; completion: { file: string; field?: string; equals?: string | boolean; sha256?: string } };
export type ArchiveConfig = { version: 1; minAgeHours: number; reserveFreeGiB: number; targets: Target[] };
const CATALOG = "docs/research/archive-catalog";
const HASH = /^[a-f0-9]{64}$/;

function plainRelative(value: unknown): asserts value is string {
  assert(typeof value === "string" && value.length > 0 && !/[\\:]/.test(value), "Expected portable relative path");
  assert(!path.isAbsolute(value) && value.split("/").every(p => p && p !== "." && p !== ".."), "Unsafe path");
}

/** Check every existing ancestor, rather than allowing an in-tree junction redirect. */
function localPath(root: string, relative: string): string {
  plainRelative(relative);
  const result = inside(root, relative);
  let current = path.resolve(root);
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.existsSync(current)) assert(!fs.lstatSync(current).isSymbolicLink(), `Redirected path: ${current}`);
  }
  return result;
}

export function loadArchiveConfig(repo: string, relative: string): ArchiveConfig {
  const file = localPath(repo, relative);
  assert(fs.statSync(file).size < 1024 * 1024, "Archive config too large");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(config.version, 1);
  assert(Number.isFinite(config.minAgeHours) && config.minAgeHours >= 0, "Invalid minimum age");
  assert(Number.isFinite(config.reserveFreeGiB) && config.reserveFreeGiB >= 1, "Reserve must be at least 1 GiB");
  assert(Array.isArray(config.targets) && config.targets.length > 0, "Queue must list explicit completed directories");
  const sources: string[] = [];
  for (const target of config.targets) {
    plainRelative(target.source);
    assert(target.source.startsWith("backtests/") && target.source.split("/").length >= 3, "Only specific backtest directories allowed");
    assert(target.completion && typeof target.completion === "object", "Completion proof is required");
    plainRelative(target.completion.file);
    assert(/\.json$/i.test(target.completion.file), "Completion proof must be JSON");
    if (target.completion.sha256 !== undefined) {
      assert(typeof target.completion.sha256 === "string" && HASH.test(target.completion.sha256), "Invalid completion-receipt SHA-256");
      assert(target.completion.field === undefined && target.completion.equals === undefined, "Choose checksum OR field completion proof");
    } else {
      assert(typeof target.completion.field === "string" && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(target.completion.field));
      assert(target.completion.equals === true || target.completion.equals === "complete" || target.completion.equals === "completed",
        "Completion proof must assert true, complete or completed");
    }
    const source = target.source.toLowerCase();
    assert(!sources.some(p => source === p || source.startsWith(p + "/") || p.startsWith(source + "/")), "Duplicate or overlapping queue directories");
    sources.push(source);
  }
  return config;
}

export function resolveArchiveVault(env: NodeJS.ProcessEnv, override?: string): string {
  if (override || env.RESEARCH_ARCHIVE_ROOT) {
    const selected = override || env.RESEARCH_ARCHIVE_ROOT!;
    assert(path.isAbsolute(selected), "Archive root override must be absolute");
    return path.resolve(selected);
  }
  const home = env.OneDriveConsumer || env.OneDrive;
  assert(home && path.isAbsolute(home), "Set RESEARCH_ARCHIVE_ROOT or configure personal OneDrive");
  return path.join(home, "TradingResearch", "reverse-copy");
}

export function checkCompletion(repo: string, target: Target): void {
  const file = localPath(repo, `${target.source}/${target.completion.file}`);
  assert(fs.statSync(file).isFile() && fs.statSync(file).size <= 4 * 1024 * 1024, "Completion receipt missing or too large");
  const raw = fs.readFileSync(file), receipt = JSON.parse(raw.toString("utf8"));
  if (target.completion.sha256) assert.equal(sha(raw), target.completion.sha256, "Completion receipt changed");
  else {
    assert(Object.prototype.hasOwnProperty.call(receipt, target.completion.field!));
    assert.equal(receipt[target.completion.field!], target.completion.equals, `Not completed: ${target.source}`);
  }
}

function totals(manifest: ArchiveManifest) {
  const unique = new Map(manifest.files.map(f => [f.objectPath, f]));
  return {
    files: manifest.files.length,
    sourceBytes: manifest.files.reduce((n, f) => n + f.bytes, 0),
    uniqueStoredBytes: [...unique.values()].reduce((n, f) => n + f.storedBytes, 0),
  };
}

function saveCatalog(repo: string, manifest: ArchiveManifest): void {
  const directory = localPath(repo, CATALOG);
  fs.mkdirSync(directory, { recursive: true });
  const file = localPath(repo, `${CATALOG}/${manifest.id}.json`);
  if (fs.existsSync(file)) {
    assert.equal(canonical(JSON.parse(fs.readFileSync(file, "utf8"))), canonical(manifest), "Local catalog conflicts with vault manifest");
  } else {
    // Single CLI writer; the vault serializes archive operations. Never replace accepted receipts.
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  }
}

function requireSpace(directory: string, bytes: number, reserveGiB: number) {
  const stat = fs.statfsSync(directory);
  const free = stat.bavail * stat.bsize;
  const required = bytes + reserveGiB * 1024 ** 3;
  assert(free >= required, `Insufficient staging space: ${(free / 1e9).toFixed(2)} GB free; ${(required / 1e9).toFixed(2)} GB required (conservative, including reserve)`);
}

function compactFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("compact.exe", ["/C", "/Q", file], { windowsHide: true, shell: false });
    let output = "";
    const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16_384); };
    child.stdout.on("data", capture); child.stderr.on("data", capture);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(`NTFS compression failed (${code}): ${output}`)));
  });
}

const HELP = `Research archive (local only; sources are NEVER deleted)
  npm run research:archive -- plan              Preview explicit completed-study queue
  npm run research:archive -- run               Compress, verify and publish queued studies
  npm run research:archive -- status            Read local catalog; no cloud data hydration
  npm run research:archive -- verify <ID>       Verify archived bytes (may download objects)
  npm run research:archive -- restore <ID>      Restore missing original paths; reject conflicts
  npm run research:archive -- restore-test <ID> Full restore into disposable local scratch
  npm run research:archive -- compress-local <ID> NTFS-compress an archived queued job (Windows)
Optional: --config <repo-relative JSON> --vault <absolute directory>
Default vault: OneDrive/TradingResearch/reverse-copy, or RESEARCH_ARCHIVE_ROOT.
Successful publication verifies the LOCAL OneDrive copy, not remote upload completion.
Queue membership asserts a completed, quiescent job. Do not run research writers on it.
`;

export async function archiveMain(argv: string[], repo: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  let configFile = "research-archive-config.json", vaultArg: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config" || arg === "--vault") {
      assert(argv[i + 1] && !argv[i + 1].startsWith("--"), `Value required for ${arg}`);
      if (arg === "--config") configFile = argv[++i]; else vaultArg = argv[++i];
    } else { assert(!arg.startsWith("--") || arg === "--help", `Unknown option: ${arg}`); positional.push(arg); }
  }
  const [command = "help", id, ...extra] = positional;
  assert.equal(extra.length, 0, "Unexpected arguments");
  if (command === "help" || command === "--help") { console.log(HELP); return; }
  assert(["plan", "run", "status", "verify", "restore", "restore-test", "compress-local"].includes(command), "Unknown archive command");
  if (["verify", "restore", "restore-test", "compress-local"].includes(command)) assert(id && HASH.test(id), "Full 64-character archive ID required");
  else assert(!id, "This command takes no archive ID");

  if (command === "status") {
    const directory = localPath(repo, CATALOG);
    const rows = fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => /^[a-f0-9]{64}\.json$/.test(n)).sort().map(name => {
      const manifest: ArchiveManifest = JSON.parse(fs.readFileSync(localPath(repo, `${CATALOG}/${name}`), "utf8"));
      return { id: manifest.id, source: manifest.source, ...totals(manifest), cloudSync: "not_checked" };
    }) : [];
    console.log(JSON.stringify({ archives: rows, note: "Catalog only; use verify for current archive integrity" }, null, 2));
    return;
  }
  const vault = resolveArchiveVault(env, vaultArg);
  assert(fs.existsSync(vault) && fs.statSync(vault).isDirectory(), "Archive root must already exist; confirm the correct OneDrive directory");
  const progress = (message: string) => console.log(`[archive] ${message}`);
  if (command === "plan" || command === "run") {
    const config = loadArchiveConfig(repo, configFile);
    // Validate the entire queue before publishing any job.
    const entries = config.targets.map(target => {
      checkCompletion(repo, target);
      return { source: target.source, ...inspectDirectory(repo, target.source, config.minAgeHours) };
    });
    console.log(JSON.stringify({ command, vault, entries, deletesOriginals: false, cloudSync: "not_checked" }, null, 2));
    if (command === "plan") return;
    for (const target of config.targets) {
      checkCompletion(repo, target);
      const inspected = inspectDirectory(repo, target.source, config.minAgeHours);
      requireSpace(vault, inspected.bytes * 1.02 + inspected.files * 4096, config.reserveFreeGiB);
      requireSpace(repo, inspected.bytes * 1.02 + inspected.files * 4096, config.reserveFreeGiB);
      const manifest = await archiveDirectory(repo, vault, target.source, { minAgeHours: config.minAgeHours, onProgress: progress });
      checkCompletion(repo, target);
      saveCatalog(repo, manifest);
      console.log(JSON.stringify({ id: manifest.id, source: manifest.source, ...totals(manifest), originalsRetained: true, cloudSync: "not_checked" }));
    }
  } else if (command === "verify") {
    const listed = readArchiveManifest(vault, id!);
    requireSpace(vault, totals(listed).uniqueStoredBytes, 2);
    const manifest = await verifyArchive(vault, id!);
    saveCatalog(repo, manifest);
    console.log(JSON.stringify({ id, integrity: "verified", ...totals(manifest), cloudSync: "not_checked" }));
  } else if (command === "restore") {
    const listed = readArchiveManifest(vault, id!);
    requireSpace(vault, totals(listed).uniqueStoredBytes, 2);
    // Both roots may be on the same volume: reserve for hydration AND restore.
    requireSpace(repo, totals(listed).sourceBytes + totals(listed).uniqueStoredBytes, 2);
    const result = await restoreArchive(repo, vault, id!, { onProgress: progress });
    saveCatalog(repo, result.manifest);
    console.log(JSON.stringify({ id, restored: result.restored, existing: result.existing }));
  } else if (command === "compress-local") {
    assert.equal(process.platform, "win32", "NTFS compression is a Windows-only optional operation");
    const config = loadArchiveConfig(repo, configFile);
    const listed = readArchiveManifest(vault, id!);
    requireSpace(vault, totals(listed).uniqueStoredBytes, 2);
    const manifest = await verifyArchive(vault, id!);
    const target = config.targets.find(t => t.source === manifest.source);
    assert(target, "Only an explicitly queued completed job may be NTFS-compressed");
    checkCompletion(repo, target);
    const before = inspectDirectory(repo, target.source, config.minAgeHours);
    assert.equal(before.files, manifest.files.length, "Source file set changed since archive");
    // Preflight all source content before changing even compression attributes.
    for (const entry of manifest.files) {
      const file = localPath(repo, entry.path);
      assert.equal(fs.statSync(file).size, entry.bytes, `Source changed: ${entry.path}`);
      assert.equal(await fileHash(file), entry.sha256, `Source changed: ${entry.path}`);
    }
    const results: { file: string; output: string }[] = [];
    for (const entry of manifest.files.filter(f => f.codec === "gzip")) {
      const file = localPath(repo, entry.path);
      progress(`NTFS compression: ${entry.path}`);
      const output = await compactFile(file);
      assert.equal(await fileHash(file), entry.sha256, "Content hash changed after NTFS compression");
      results.push({ file: entry.path, output });
    }
    saveCatalog(repo, manifest);
    const receipt = { version: 1, id, compressedAt: new Date().toISOString(), checkedOriginalHashes: true, results };
    atomicJson(localPath(repo, `${CATALOG}/${id}.ntfs-compression.json`), receipt);
    console.log(JSON.stringify({ id, processedFiles: results.length, originalContentHashes: "unchanged", originalsRetained: true }));
  } else {
    const listed = readArchiveManifest(vault, id!);
    requireSpace(vault, totals(listed).uniqueStoredBytes, 2);
    requireSpace(repo, totals(listed).sourceBytes + totals(listed).uniqueStoredBytes, 2);
    const manifest = listed; // restoreArchive verifies all objects under its writer lock.
    const scratchBase = localPath(repo, ".research-archive");
    fs.mkdirSync(scratchBase, { recursive: true });
    const scratch = fs.mkdtempSync(path.join(scratchBase, "restore-test-"));
    // On failure leave our scratch visible for inspection; never touch original source directories.
    const result = await restoreArchive(scratch, vault, id!, { onProgress: progress });
    assert.equal(result.restored, manifest.files.length);
    saveCatalog(repo, manifest);
    const receipt = { version: 1, id, testedAt: new Date().toISOString(), restoredFiles: result.restored, ...totals(manifest), cloudSync: "not_checked" };
    atomicJson(localPath(repo, `${CATALOG}/${id}.restore-test.json`), receipt);
    // The only recursive deletion in this CLI: freshly created, verified scratch below this repo.
    const resolved = fs.realpathSync(scratch), expectedBase = fs.realpathSync(scratchBase);
    assert(path.dirname(resolved) === expectedBase && /^restore-test-/.test(path.basename(resolved)));
    assert(!fs.lstatSync(scratch).isSymbolicLink());
    fs.rmSync(resolved, { recursive: true });
    console.log(JSON.stringify({ ...receipt, scratchRemoved: true, originalsRetained: true }));
  }
}

if (require.main === module) {
  const repo = path.resolve(__dirname, "..");
  archiveMain(process.argv.slice(2), repo).catch(error => {
    console.error(`[archive] FAILED: ${error instanceof Error ? error.message : String(error)}\nOriginal research files were not deleted.`);
    process.exitCode = 1;
  });
}
