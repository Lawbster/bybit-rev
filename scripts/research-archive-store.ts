/** Explicit, local-only content-addressed archive storage for completed backtests. */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import assert from "assert/strict";
import { pipeline } from "stream/promises";
import { PassThrough, Transform, Writable } from "stream";
import { canonical, sha } from "./research-workflow";
export interface ArchiveFile {
    path: string;
    bytes: number;
    sha256: string;
    codec: "gzip" | "identity";
    objectPath: string;
    storedBytes: number;
    storedSha256: string;
}
export interface ArchiveManifest {
    version: 1;
    id: string;
    source: string;
    createdAt: string;
    directories: string[];
    files: ArchiveFile[];
    inputBytes?: number;
    storedBytes?: number;
}
type Options = {
    minAgeHours?: number;
    onProgress?: (message: string) => void;
};
const SECRET = /(^|\/)(?:\.env(?:\.[^/]*)?|[^/]*\.(?:pem|key|p12|pfx)|id_(?:rsa|dsa|ecdsa|ed25519))(?:$|\/)/i;
const INCOMPLETE = /(^|\/)[^/]*\.(?:tmp|part)$/i;
const COMPRESSED = /\.(?:gz|zip|7z|png|jpe?g|webp|parquet|zst|bz2|xz|mp4|pdf)$/i;
const MAX_FILE = 1024 * 1024 * 1024 * 16; // archive files are deliberately bounded during restore
function fail(ok: unknown, message: string): asserts ok { assert(ok, message); }
function badSegment(s: string): boolean { return !s || s === "." || s === ".." || s.startsWith(".") || s.includes(":") || /[. ]$/.test(s) || /[<>:"|?*\x00-\x1f]/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s); }
function sourcePath(repo: string, source: string): {
    root: string;
    source: string;
    absolute: string;
} {
    fail(typeof source === "string" && source === source.replace(/\\/g, "/"), "Source must use forward-slash repo-relative paths");
    const parts = source.split("/");
    fail(parts.length >= 3 && parts[0] === "backtests" && !parts.some(badSegment), "Source must be a specific backtests/<category>/<job> directory");
    const root = path.resolve(repo), absolute = path.resolve(root, ...parts);
    fail(path.relative(root, absolute) && !path.relative(root, absolute).startsWith(`..${path.sep}`), "Source outside repo");
    return { root, source: parts.join("/"), absolute };
}
function noLinks(root: string, target: string): void {
    let cur = path.resolve(root);
    const end = path.resolve(target);
    fail(fs.existsSync(cur), "Repository missing");
    while (true) {
        const s = fs.lstatSync(cur);
        fail(!s.isSymbolicLink(), `Symlink/junction rejected: ${cur}`);
        if (cur === end)
            return;
        const next = path.join(cur, path.relative(cur, end).split(path.sep)[0]);
        fail(next !== cur && next.startsWith(cur + path.sep), "Path outside repo");
        cur = next;
    }
}
function noLinksExisting(target: string): void { const absolute = path.resolve(target), parsed = path.parse(absolute); let cur = parsed.root; for (const piece of path.relative(parsed.root, absolute).split(path.sep).filter(Boolean)) {
    cur = path.join(cur, piece);
    let s: fs.Stats;
    try { s = fs.lstatSync(cur); }
    catch (error: any) { if (error.code === "ENOENT") return; throw error; }
    fail(!s.isSymbolicLink(), `Symlink/junction rejected: ${cur}`);
} }
function rootsSafe(repo: string, vault: string): void {
    const r = path.resolve(repo), v = path.resolve(vault);
    const norm = (x: string) => process.platform === "win32" ? x.toLowerCase() : x, rr = norm(r), vv = norm(v);
    fail(rr !== vv && !vv.startsWith(rr + path.sep) && !rr.startsWith(vv + path.sep), "Repository and vault must not contain each other");
    noLinksExisting(r);
    noLinksExisting(v);
}
function enumerate(repo: string, source: string, minAgeHours = 24): {
    dirs: string[];
    records: Array<{
        path: string;
        abs: string;
        bytes: number;
        mtimeMs: number;
    }>;
    newest: number;
} {
    fail(Number.isFinite(minAgeHours) && minAgeHours >= 0, "Invalid minimum source age");
    const sp = sourcePath(repo, source);
    noLinks(sp.root, sp.absolute);
    const cutoff = Date.now() - minAgeHours * 3600000, dirs: string[] = [], records: Array<{
        path: string;
        abs: string;
        bytes: number;
        mtimeMs: number;
    }> = [];
    let newest = 0;
    const walk = (abs: string, rel: string) => {
        noLinks(sp.root, abs);
        const stat = fs.lstatSync(abs);
        fail(stat.isDirectory(), `Non-directory encountered: ${rel}`);
        dirs.push(rel);
        for (const ent of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            fail(!badSegment(ent.name), `Unsafe path segment: ${ent.name}`);
            const child = path.join(abs, ent.name), childRel = `${rel}/${ent.name}`;
            noLinks(sp.root, child);
            const s = fs.lstatSync(child);
            if (s.isDirectory())
                walk(child, childRel);
            else {
                fail(s.isFile(), `Non-regular file rejected: ${childRel}`);
                fail(s.size <= MAX_FILE, `File exceeds 16 GiB archive limit; partition explicitly: ${childRel}`);
                fail(!SECRET.test(childRel) && !INCOMPLETE.test(childRel), `Rejected archive input: ${childRel}`);
                // An explicit zero disables age checks (fixtures/manual override); NTFS timestamps have sub-ms precision.
                fail(minAgeHours === 0 || s.mtimeMs <= cutoff, `Input too new: ${childRel}`);
                newest = Math.max(newest, s.mtimeMs);
                records.push({ path: childRel, abs: child, bytes: s.size, mtimeMs: s.mtimeMs });
            }
        }
    };
    walk(sp.absolute, sp.source);
    return { dirs: dirs.sort(), records: records.sort((a, b) => a.path.localeCompare(b.path)), newest };
}
async function digest(file: string): Promise<{
    sha256: string;
    bytes: number;
}> { const h = crypto.createHash("sha256"); let bytes = 0; for await (const b of fs.createReadStream(file)) {
    h.update(b);
    bytes += b.length;
} return { sha256: h.digest("hex"), bytes }; }
function sameSnapshot(a: ReturnType<typeof enumerate>, b: ReturnType<typeof enumerate>): void { fail(canonical(a.dirs) === canonical(b.dirs) && canonical(a.records.map(x => [x.path, x.bytes, x.mtimeMs])) === canonical(b.records.map(x => [x.path, x.bytes, x.mtimeMs])), "Source changed while archiving"); }
function fsyncFile(fd: number): void { try {
    fs.fsyncSync(fd);
}
catch (e: any) {
    if (e?.code !== "EPERM" && e?.code !== "ENOTSUP" && e?.code !== "EINVAL")
        throw e; /* Windows filesystems may not expose fsync */
} }
function fsyncDir(dir: string): void { try {
    const fd = fs.openSync(dir, "r");
    try {
        fsyncFile(fd);
    }
    finally {
        fs.closeSync(fd);
    }
}
catch { /* Windows directory fsync is unavailable */ } }
async function pipeStore(input: string, dest: string, codec: "gzip" | "identity"): Promise<{
    bytes: number;
    sha256: string;
}> {
    await pipeline(fs.createReadStream(input), codec === "gzip" ? zlib.createGzip({ level: 6 }) : new PassThrough(), fs.createWriteStream(dest, { flags: "wx" }));
    const fd = fs.openSync(dest, "r+");
    try {
        fsyncFile(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    return digest(dest);
}
async function checkObject(vault: string, f: ArchiveFile): Promise<void> {
    const full = path.resolve(vault, f.objectPath);
    fail(full.startsWith(path.resolve(vault) + path.sep), "Unsafe object path");
    fail(fs.existsSync(full), `Missing object: ${f.objectPath}`);
    noLinksExisting(full);
    const stored = await digest(full);
    fail(stored.bytes === f.storedBytes && stored.sha256 === f.storedSha256, `Corrupt stored object: ${f.objectPath}`);
    const h = crypto.createHash("sha256");
    let bytes = 0;
    const bounded = new Transform({ transform(chunk, _enc, cb) { const b = chunk as Buffer; bytes += b.length; if (bytes > MAX_FILE || bytes > f.bytes)
            cb(new Error(`Object exceeds manifest size: ${f.objectPath}`));
        else {
            h.update(b);
            cb(null, b);
        } } });
    const sink = new Writable({ write(_chunk, _enc, cb) { cb(); } });
    const source = fs.createReadStream(full);
    if (f.codec === "gzip")
        await pipeline(source, zlib.createGunzip(), bounded, sink);
    else
        await pipeline(source, bounded, sink);
    fail(bytes === f.bytes && h.digest("hex") === f.sha256, `Original hash mismatch: ${f.objectPath}`);
}
function lock(vault: string): () => void { fs.mkdirSync(vault, { recursive: true }); const file = path.join(vault, ".archive-writer.lock"), token = `${process.pid}:${crypto.randomBytes(16).toString("hex")}`; const fd = fs.openSync(file, "wx"); fs.writeFileSync(fd, token); fsyncFile(fd); fs.closeSync(fd); return () => { try {
    if (fs.readFileSync(file, "utf8") === token)
        fs.unlinkSync(file);
}
catch { } }; }
function manifestPath(vault: string, id: string): string { fail(/^[a-f0-9]{64}$/.test(id), "Invalid archive id"); return path.join(vault, "studies", `${id}.json`); }
function validateManifest(m: any): asserts m is ArchiveManifest { fail(m && m.version === 1 && /^[a-f0-9]{64}$/.test(m.id) && typeof m.source === "string" && Array.isArray(m.directories) && Array.isArray(m.files), "Invalid manifest schema"); const src = sourcePath(process.cwd(), m.source).source, prefix = src + "/"; const seen = new Set<string>(), dirs = new Set<string>(); for (const d of m.directories) {
    fail(typeof d === "string" && (d === src || d.startsWith(prefix)) && !d.startsWith("/") && !d.includes("\\") && !d.split("/").some(badSegment), "Unsafe manifest directory");
    const key = d.toLowerCase();
    fail(!dirs.has(key), "Duplicate manifest directory");
    dirs.add(key);
} for (const f of m.files) {
    fail(f && typeof f.path === "string" && f.path.startsWith(prefix) && /^[a-f0-9]{64}$/.test(f.sha256) && /^[a-f0-9]{64}$/.test(f.storedSha256) && Number.isSafeInteger(f.bytes) && f.bytes >= 0 && Number.isSafeInteger(f.storedBytes) && f.storedBytes >= 0 && (f.codec === "gzip" || f.codec === "identity"), "Invalid manifest file");
    fail(!f.path.startsWith("/") && !f.path.includes("\\") && !f.path.split("/").some(badSegment), "Unsafe manifest file path");
    const key = f.path.toLowerCase();
    fail(!seen.has(key) && !dirs.has(key), "Duplicate manifest path");
    seen.add(key);
    const ext = f.codec === "gzip" ? ".gz" : ".raw";
    fail(f.objectPath === `objects/sha256/${f.sha256.slice(0, 2)}/${f.sha256}${ext}`, "Inconsistent object path");
} for (const d of dirs)
    for (const f of seen)
        fail(!d.startsWith(f + "/"), "Manifest file/directory prefix collision"); const expected = sha(canonical({ version: 1, source: src, directories: m.directories, files: m.files })); fail(m.id === expected, "Manifest identity mismatch"); }
export function inspectDirectory(repo: string, source: string, minAgeHours = 24): {
    files: number;
    bytes: number;
    newestMtimeMs: number;
} { const x = enumerate(repo, source, minAgeHours); return { files: x.records.length, bytes: x.records.reduce((n, f) => n + f.bytes, 0), newestMtimeMs: x.newest }; }
export async function archiveDirectory(repo: string, vault: string, source: string, options: Options = {}): Promise<ArchiveManifest> {
    rootsSafe(repo, vault);
    const normalized = sourcePath(repo, source).source;
    const release = lock(vault);
    let staging: string | undefined;
    try {
        const initial = enumerate(repo, normalized, options.minAgeHours ?? 24);
        // Compress outside OneDrive: it must not upload a slowly growing gzip file.
        const stagingBase = path.join(path.resolve(repo), ".research-archive", "staging");
        noLinksExisting(stagingBase);
        fs.mkdirSync(stagingBase, { recursive: true });
        noLinksExisting(stagingBase);
        staging = fs.mkdtempSync(path.join(stagingBase, "objects-"));
        const hashed: ArchiveFile[] = [];
        for (const r of initial.records) {
            options.onProgress?.(`hashing: ${r.path}`);
            const d = await digest(r.abs);
            fail(d.bytes === r.bytes, `Source changed while hashing: ${r.path}`);
            const codec: ArchiveFile["codec"] = COMPRESSED.test(r.path) ? "identity" : "gzip";
            const objectPath = `objects/sha256/${d.sha256.slice(0, 2)}/${d.sha256}${codec === "gzip" ? ".gz" : ".raw"}`;
            hashed.push({ path: r.path, bytes: r.bytes, sha256: d.sha256, codec, objectPath, storedBytes: 0, storedSha256: "" });
        }
        sameSnapshot(initial, enumerate(repo, normalized, options.minAgeHours ?? 24));
        for (let i = 0; i < hashed.length; i++) {
            const f = hashed[i], r = initial.records[i], target = path.join(vault, f.objectPath);
            noLinksExisting(path.dirname(target));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            noLinksExisting(path.dirname(target));
            options.onProgress?.(`storing ${i + 1}/${hashed.length}: ${f.path}`);
            noLinksExisting(target);
            if (fs.existsSync(target)) {
                const st = await digest(target);
                f.storedBytes = st.bytes;
                f.storedSha256 = st.sha256;
                await checkObject(vault, f);
            }
            else {
                const tmp = path.join(staging, `${path.basename(target)}.${crypto.randomBytes(8).toString("hex")}.tmp`);
                const st = await pipeStore(r.abs, tmp, f.codec);
                f.storedBytes = st.bytes;
                f.storedSha256 = st.sha256;
                await checkObject(path.dirname(tmp), { ...f, objectPath: path.basename(tmp) });
                try { fs.renameSync(tmp, target); }
                catch (error: any) {
                    if (error.code !== "EXDEV") throw error;
                    // Different volumes: copy the already verified complete object, not the compressor stream.
                    const transfer = `${target}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
                    fs.copyFileSync(tmp, transfer, fs.constants.COPYFILE_EXCL);
                    const fd = fs.openSync(transfer, "r+");
                    try { fsyncFile(fd); } finally { fs.closeSync(fd); }
                    await checkObject(path.dirname(transfer), { ...f, objectPath: path.basename(transfer) });
                    noLinksExisting(target);
                    fs.renameSync(transfer, target);
                    fs.unlinkSync(tmp);
                }
                fsyncDir(path.dirname(target));
                await checkObject(vault, f);
            }
            options.onProgress?.(`archived ${i + 1}/${hashed.length}: ${f.path}`);
        }
        const final = enumerate(repo, normalized, options.minAgeHours ?? 24);
        sameSnapshot(initial, final);
        for (let i = 0; i < hashed.length; i++) {
            const d = await digest(final.records[i].abs);
            fail(d.bytes === hashed[i].bytes && d.sha256 === hashed[i].sha256, `Source content changed: ${hashed[i].path}`);
        }
        sameSnapshot(initial, enumerate(repo, normalized, options.minAgeHours ?? 24));
        const id = sha(canonical({ version: 1, source: normalized, directories: initial.dirs, files: hashed }));
        const manifest: ArchiveManifest = { version: 1, id, source: normalized, createdAt: new Date().toISOString(), directories: initial.dirs, files: hashed, inputBytes: hashed.reduce((n, x) => n + x.bytes, 0), storedBytes: hashed.reduce((n, x) => n + x.storedBytes, 0) };
        const out = manifestPath(vault, id);
        noLinksExisting(path.dirname(out));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        noLinksExisting(path.dirname(out));
        validateManifest(manifest);
        noLinksExisting(out);
        if (fs.existsSync(out)) {
            const prior = JSON.parse(fs.readFileSync(out, "utf8"));
            validateManifest(prior);
            const { createdAt: _a, inputBytes: _b, storedBytes: _c, ...priorStable } = prior, { createdAt: _d, inputBytes: _e, storedBytes: _f, ...newStable } = manifest;
            fail(canonical(priorStable) === canonical(newStable), "Existing manifest differs; refusing overwrite");
            return prior;
        }
        const tmp = `${out}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
        const fd = fs.openSync(tmp, "wx");
        try {
            fs.writeFileSync(fd, JSON.stringify(manifest, null, 2) + "\n");
            fsyncFile(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, out);
        fsyncDir(path.dirname(out));
        return manifest;
    }
    finally {
        // Remove only our empty staging directory. Failed payloads remain for diagnosis.
        if (staging) { try { fs.rmdirSync(staging); } catch { } }
        release();
    }
}
export function readArchiveManifest(vault: string, id: string): ArchiveManifest { rootsSafe(process.cwd(), vault); const file = manifestPath(vault, id); noLinksExisting(file); const s = fs.statSync(file); fail(s.isFile() && s.size <= 32 * 1024 * 1024, "Invalid manifest size"); const m = JSON.parse(fs.readFileSync(file, "utf8")); validateManifest(m); fail(m.id === id, "Requested archive id mismatch"); return m; }
export async function verifyArchive(vault: string, id: string): Promise<ArchiveManifest> { const m = readArchiveManifest(vault, id); for (const f of m.files)
    await checkObject(vault, f); return m; }
export async function restoreArchive(repo: string, vault: string, id: string, options: Pick<Options, "onProgress"> = {}): Promise<{
    manifest: ArchiveManifest;
    restored: number;
    existing: number;
}> {
    rootsSafe(repo, vault);
    const release = lock(vault);
    try {
        const m = await verifyArchive(vault, id), root = path.resolve(repo);
        noLinks(root, root);
        const planned: Array<{
            f: ArchiveFile;
            target: string;
            exists: boolean;
        }> = [];
        for (const d of m.directories) {
            const target = path.resolve(root, ...d.split("/"));
            fail(target.startsWith(root + path.sep), "Unsafe restore directory");
            noLinksExisting(target);
            if (fs.existsSync(target))
                fail(fs.lstatSync(target).isDirectory() && !fs.lstatSync(target).isSymbolicLink(), `Restore directory conflict: ${d}`);
        }
        for (const f of m.files) {
            const target = path.resolve(root, ...f.path.split("/"));
            fail(target.startsWith(root + path.sep), "Unsafe restore target");
            noLinksExisting(target);
            const exists = fs.existsSync(target);
            if (exists) {
                const s = fs.lstatSync(target);
                fail(s.isFile() && !s.isSymbolicLink(), `Restore conflict: ${f.path}`);
                const d = await digest(target);
                fail(d.bytes === f.bytes && d.sha256 === f.sha256, `Restore conflict: ${f.path}`);
            }
            planned.push({ f, target, exists });
        }
        for (const d of m.directories) {
            const directory = path.resolve(root, ...d.split("/"));
            noLinksExisting(directory);
            fs.mkdirSync(directory, { recursive: true });
            noLinksExisting(directory);
        }
        let restored = 0, existing = 0;
        for (const p of planned) {
            if (p.exists) {
                existing++;
                continue;
            }
            noLinksExisting(path.dirname(p.target));
            fs.mkdirSync(path.dirname(p.target), { recursive: true });
            noLinks(root, path.dirname(p.target));
            options.onProgress?.(`restoring ${p.f.path}`);
            fail(!fs.existsSync(p.target), `Restore conflict: ${p.f.path}`);
            const tmp = `${p.target}.${process.pid}.${crypto.randomBytes(8).toString("hex")}.tmp`;
            try {
                const decoded = new Transform({ transform(chunk, _enc, cb) { const b = chunk as Buffer; (this as any).total = ((this as any).total || 0) + b.length; cb((this as any).total > p.f.bytes || (this as any).total > MAX_FILE ? new Error(`Restore decoded size overflow: ${p.f.path}`) : null, b); } }), sourceStream = fs.createReadStream(path.join(vault, p.f.objectPath)), output = fs.createWriteStream(tmp, { flags: "wx" });
                if (p.f.codec === "gzip")
                    await pipeline(sourceStream, zlib.createGunzip(), decoded, output);
                else
                    await pipeline(sourceStream, decoded, output);
                const d = await digest(tmp);
                fail(d.bytes === p.f.bytes && d.sha256 === p.f.sha256, `Restore verification failed: ${p.f.path}`);
                const fd = fs.openSync(tmp, "r+");
                try { fsyncFile(fd); } finally { fs.closeSync(fd); }
                noLinksExisting(p.target);
                fs.linkSync(tmp, p.target);
                fs.unlinkSync(tmp);
                restored++;
                options.onProgress?.(`restored ${p.f.path}`);
            }
            catch (e) {
                try {
                    fs.unlinkSync(tmp);
                }
                catch { }
                throw e;
            }
        }
        return { manifest: m, restored, existing };
    }
    finally {
        release();
    }
}
