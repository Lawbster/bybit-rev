import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";

interface FileStats {
  file: string;
  rows: number;
  firstTs: number;
  lastTs: number;
  medianIntervalSec: number;
  p95IntervalSec: number;
  maxIntervalSec: number;
  gaps5x: { startISO: string; endISO: string; gapSec: number }[];
  gaps5min: { startISO: string; endISO: string; gapSec: number }[];
}

async function scanFile(filePath: string): Promise<FileStats | null> {
  const tsList: number[] = [];
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const t = o.timestamp ?? (o.ts ? new Date(o.ts).getTime() : null);
      if (typeof t === "number" && Number.isFinite(t)) tsList.push(t);
    } catch {}
  }
  if (tsList.length < 2) return null;

  tsList.sort((a, b) => a - b);
  const intervals: number[] = [];
  const gaps5x: { startISO: string; endISO: string; gapSec: number }[] = [];
  const gaps5min: { startISO: string; endISO: string; gapSec: number }[] = [];
  for (let i = 1; i < tsList.length; i++) {
    intervals.push(tsList[i] - tsList[i - 1]);
  }
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];

  const fiveMinMs = 5 * 60_000;
  for (let i = 1; i < tsList.length; i++) {
    const dt = tsList[i] - tsList[i - 1];
    if (dt > median * 5 && dt > 30_000) {
      gaps5x.push({
        startISO: new Date(tsList[i - 1]).toISOString(),
        endISO: new Date(tsList[i]).toISOString(),
        gapSec: Math.round(dt / 1000),
      });
    }
    if (dt > fiveMinMs && median < fiveMinMs) {
      gaps5min.push({
        startISO: new Date(tsList[i - 1]).toISOString(),
        endISO: new Date(tsList[i]).toISOString(),
        gapSec: Math.round(dt / 1000),
      });
    }
  }
  return {
    file: path.basename(filePath),
    rows: tsList.length,
    firstTs: tsList[0],
    lastTs: tsList[tsList.length - 1],
    medianIntervalSec: median / 1000,
    p95IntervalSec: p95 / 1000,
    maxIntervalSec: max / 1000,
    gaps5x: gaps5x.slice(0, 12),
    gaps5min: gaps5min.slice(0, 12),
  };
}

(async () => {
  const dataDir = path.join(process.cwd(), "data");
  const onlyArg = process.argv[2];
  const symbolsArg = process.env.SYMBOLS?.split(",");

  const candidates = fs.readdirSync(dataDir).filter((f) => {
    if (!f.endsWith(".jsonl")) return false;
    if (f.includes("hedge_partial") || f.includes("hedge_signals")) return false;
    if (f.includes("bot_state") || f.includes("zone_events")) return false;
    if (f.includes("collector_health")) return false;
    if (f.includes("_1m") || f.includes("_5m")) return false;
    if (f.includes("market.jsonl")) return false;
    if (f.includes("ob_bands")) return false;
    if (onlyArg && !f.toLowerCase().includes(onlyArg.toLowerCase())) return false;
    if (symbolsArg && !symbolsArg.some((s) => f.startsWith(s))) return false;
    return true;
  });

  console.log(`scanning ${candidates.length} files…\n`);
  const results: FileStats[] = [];
  for (const f of candidates) {
    const r = await scanFile(path.join(dataDir, f));
    if (r) results.push(r);
  }

  results.sort((a, b) => a.file.localeCompare(b.file));

  console.log("=== summary ===");
  console.log(
    "file".padEnd(50) +
      "rows".padStart(8) +
      "first".padStart(22) +
      "last".padStart(22) +
      "med(s)".padStart(10) +
      "p95(s)".padStart(10) +
      "max(s)".padStart(10) +
      "gaps>5min".padStart(12)
  );
  for (const r of results) {
    console.log(
      r.file.padEnd(50) +
        String(r.rows).padStart(8) +
        new Date(r.firstTs).toISOString().slice(0, 19).padStart(22) +
        new Date(r.lastTs).toISOString().slice(0, 19).padStart(22) +
        r.medianIntervalSec.toFixed(2).padStart(10) +
        r.p95IntervalSec.toFixed(2).padStart(10) +
        r.maxIntervalSec.toFixed(0).padStart(10) +
        String(r.gaps5min.length).padStart(12)
    );
  }

  console.log("\n=== notable gaps (>5min on sub-5min feeds) ===");
  for (const r of results) {
    if (r.gaps5min.length === 0) continue;
    console.log(`\n${r.file}  med=${r.medianIntervalSec.toFixed(1)}s  rows=${r.rows}`);
    for (const g of r.gaps5min) {
      const hours = g.gapSec / 3600;
      console.log(
        `  ${g.startISO}  →  ${g.endISO}  Δ=${(g.gapSec / 60).toFixed(1)}min` +
          (hours >= 1 ? `  (${hours.toFixed(1)}h)` : "")
      );
    }
  }
})();
