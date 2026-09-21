import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import assert from "assert/strict";
import { archiveDirectory, inspectDirectory, restoreArchive, verifyArchive } from "./research-archive-store";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "research-archive-store-"));
function write(file: string, data: string | Buffer): void { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); }
function job(repo: string, name = "alpha"): string { const d = path.join(repo, "backtests", "completed", name); fs.mkdirSync(d, { recursive: true }); return d; }
async function rejects(fn: () => Promise<unknown> | unknown, pattern: RegExp): Promise<void> { await assert.rejects(Promise.resolve().then(fn), pattern); }
async function run(): Promise<void> {
    try {
        const repo = path.join(root, "repo"), vault = path.join(root, "vault"), src = job(repo);
        write(path.join(src, "a.txt"), "hello archive");
        write(path.join(src, "nested", "b.json"), "{\"ok\":true}");
        fs.mkdirSync(path.join(src, "empty"), { recursive: true });
        const m = await archiveDirectory(repo, vault, "backtests/completed/alpha", { minAgeHours: 0 });
        assert.equal(m.files.length, 2);
        assert(m.directories.includes("backtests/completed/alpha/empty"));
        await verifyArchive(vault, m.id);
        const twice = await archiveDirectory(repo, vault, "backtests/completed/alpha", { minAgeHours: 0 });
        assert.equal(twice.id, m.id);
        assert.equal(fs.readdirSync(path.join(vault, "studies")).length, 1);
        const restore = path.join(root, "restore");
        fs.mkdirSync(restore);
        const r = await restoreArchive(restore, vault, m.id);
        assert.equal(r.restored, 2);
        assert.equal(fs.readFileSync(path.join(restore, "backtests", "completed", "alpha", "a.txt"), "utf8"), "hello archive");
        assert(fs.existsSync(path.join(restore, "backtests", "completed", "alpha", "empty")));
        const zipped = job(repo, "zipped");
        const gz = path.join(zipped, "data.gz");
        write(gz, crypto.randomBytes(800));
        const zm = await archiveDirectory(repo, vault, "backtests/completed/zipped", { minAgeHours: 0 });
        assert.equal(zm.files[0].codec, "identity");
        assert.equal(fs.readFileSync(path.join(vault, zm.files[0].objectPath)).compare(fs.readFileSync(gz)), 0);
        const corrupt = path.join(vault, zm.files[0].objectPath);
        fs.writeFileSync(corrupt, Buffer.from("corrupt"));
        await rejects(() => verifyArchive(vault, zm.id), /Corrupt stored object|Original hash mismatch/);
        fs.unlinkSync(path.join(vault, m.files[0].objectPath));
        await rejects(() => verifyArchive(vault, m.id), /Missing object/);
        // Rebuild the first archive under a fresh vault for conflict/preflight tests.
        const vault2 = path.join(root, "vault2");
        const clean = await archiveDirectory(repo, vault2, "backtests/completed/alpha", { minAgeHours: 0 });
        const conflict = path.join(root, "conflict");
        write(path.join(conflict, "backtests", "completed", "alpha", "a.txt"), "wrong");
        await rejects(() => restoreArchive(conflict, vault2, clean.id), /Restore conflict/);
        assert(!fs.existsSync(path.join(conflict, "backtests", "completed", "alpha", "nested", "b.json")));
        const manifestFile = path.join(vault2, "studies", `${clean.id}.json`), tampered = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
        tampered.files[0].path = "../escape";
        fs.writeFileSync(manifestFile, JSON.stringify(tampered));
        await rejects(() => verifyArchive(vault2, clean.id), /Invalid manifest|Unsafe manifest|Manifest identity/);
        const tmp = job(repo, "tmp");
        write(path.join(tmp, "partial.part"), "x");
        const failedVault = path.join(root, "failed-vault");
        await rejects(() => archiveDirectory(repo, failedVault, "backtests/completed/tmp", { minAgeHours: 0 }), /Rejected archive input/);
        assert(!fs.existsSync(path.join(failedVault, "studies")));
        const fresh = job(repo, "fresh");
        write(path.join(fresh, "a"), "x");
        await rejects(() => archiveDirectory(repo, vault, "backtests/completed/fresh"), /Input too new/);
        assert.equal(inspectDirectory(repo, "backtests/completed/fresh", 0).files, 1);
        fs.mkdirSync(path.join(vault, ".archive-writer.lock"));
        await rejects(() => archiveDirectory(repo, vault, "backtests/completed/zipped", { minAgeHours: 0 }), /EEXIST/);
        fs.rmdirSync(path.join(vault, ".archive-writer.lock"));
        const link = job(repo, "link");
        write(path.join(link, "safe"), "x");
        try {
            fs.symlinkSync(path.join(root, "outside"), path.join(link, "escape"), "junction");
            await rejects(() => archiveDirectory(repo, vault, "backtests/completed/link", { minAgeHours: 0 }), /Symlink|Non-regular/);
        }
        catch (e: any) {
            if (e?.code !== "EPERM")
                throw e;
        }
        console.log("research archive store tests: ok");
    }
    finally {
        const resolved = path.resolve(root), base = path.resolve(os.tmpdir());
        assert(resolved.startsWith(base + path.sep) && path.basename(resolved).startsWith("research-archive-store-"));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
