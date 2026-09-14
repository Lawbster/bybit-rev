import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const COLLECTOR_HEALTH_ROTATE_BYTES = 64 * 1024 * 1024;

/** Single-writer observational snapshot. Never writes trading state. */
export function writeCollectorSnapshot(file: string, snapshot: unknown): void {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify(snapshot) + "\n", { flag: "wx" });
    fs.renameSync(temp, file);
  } finally {
    try { fs.unlinkSync(temp); } catch { /* renamed or never created */ }
  }
}

/** Only the collector-health journal is eligible; no arbitrary data-file paths. */
export function publishCollectorHealth(dataDir: string, row: { timestamp: number; perSymbol: unknown[] },
  maxBytes = COLLECTOR_HEALTH_ROTATE_BYTES): { archive: string | null; errors: string[] } {
  if (!Number.isSafeInteger(row.timestamp) || !Array.isArray(row.perSymbol)
    || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("invalid collector health publication");
  const journal = path.join(dataDir, "collector_health.jsonl");
  const errors: string[] = []; let snapshotReady = false, archive: string | null = null;
  try { writeCollectorSnapshot(path.join(dataDir, "collector_health.json"), row); snapshotReady = true; }
  catch (e: any) { errors.push(`snapshot: ${e.message}`); }
  // A readable snapshot must exist before the active journal can disappear.
  // Rename preserves all bytes (including a torn tail); no copytruncate/delete.
  if (snapshotReady) {
    try {
      if (fs.statSync(journal).size >= maxBytes) {
        const root = path.join(dataDir, "archives", "collector-health");
        fs.mkdirSync(root, { recursive: true });
        const uniqueDir = fs.mkdtempSync(path.join(root, `${new Date(row.timestamp).toISOString().replace(/[:.]/g, "-")}-`));
        const target = path.join(uniqueDir, "collector_health.jsonl");
        fs.renameSync(journal, target);
        archive = target;
      }
    } catch (e: any) { if (e.code !== "ENOENT") errors.push(`rotation: ${e.message}`); }
  }
  const fd = fs.openSync(journal, "a+");
  try {
    const size = fs.fstatSync(fd).size, last = Buffer.alloc(1);
    if (size) {
      fs.readSync(fd, last, 0, 1, size - 1);
      if (last[0] !== 10) fs.writeSync(fd, "\n");
    }
    fs.writeFileSync(fd, JSON.stringify(row) + "\n");
  } finally { fs.closeSync(fd); }
  return { archive, errors };
}

/** Historical readers must include archives, not only the active tail. No deletion policy. */
export function collectorHealthHistoryFiles(dataDir: string): string[] {
  const root = path.join(dataDir, "archives", "collector-health");
  let names: string[];
  try { names = fs.readdirSync(root).sort(); }
  catch (e: any) { if (e.code !== "ENOENT") throw e; names = []; }
  return [...names.map(name => path.join(root, name, "collector_health.jsonl")),
    path.join(dataDir, "collector_health.jsonl")].filter(file => fs.existsSync(file));
}
