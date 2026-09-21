/**
 * Parity check: the live hl_bid_pull_volume policy implementation
 * (src/bot/hl-short-bidpullvolume-policy.ts) replayed over raw collector JSONL
 * must reproduce the 2026-08-10 study's per-decision features and fires
 * (backtests/hype/hl-short-study-2026-08-10/decision-features.csv).
 *
 * Research-only. Reads data/ and backtests/; writes nothing.
 *
 * Usage: npx ts-node scripts/hl-short-bidpullvolume-parity-check.ts
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import {
  computeHlShortBidPullVolumeFeatures,
  HL_SHORT_BIDPULLVOLUME_POLICY,
} from "../src/bot/hl-short-bidpullvolume-policy";
import type {
  HlShortAssetSample,
  HlShortBookSample,
  HlShortMinuteCandle,
  HlShortTakerMinute,
} from "../src/bot/hl-short-breakdown-policy";

const MINUTE = 60_000;
const ROOT = process.cwd();
const CSV = path.join(ROOT, "backtests", "hype", "hl-short-study-2026-08-10", "decision-features.csv");

interface CsvDecision {
  ts: number;
  pulseHealthy: boolean;
  hlTakerCount15: number;
  hlObCount15: number;
  red15: boolean;
  volumeRatio15: number;
  hlTaker15: number;
  hlObDelta: number;
}

function loadCsv(): CsvDecision[] {
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`missing CSV column ${name}`);
    return index;
  };
  const cTs = col("ts");
  const cHealthy = col("pulseHealthy");
  const cTakerCount = col("hlTakerCount15");
  const cObCount = col("hlObCount15");
  const cRed = col("red15");
  const cVol = col("volumeRatio15");
  const cTaker = col("hlTaker15");
  const cObDelta = col("hlObDelta");
  return lines.slice(1).map(line => {
    const parts = line.split(",");
    return {
      ts: Date.parse(parts[cTs]),
      pulseHealthy: parts[cHealthy] === "true",
      hlTakerCount15: Number(parts[cTakerCount]),
      hlObCount15: Number(parts[cObCount]),
      red15: parts[cRed] === "true",
      volumeRatio15: Number(parts[cVol]),
      hlTaker15: Number(parts[cTaker]),
      hlObDelta: Number(parts[cObDelta]),
    };
  });
}

class StreamBuffer<T> {
  private iterator: AsyncIterator<string>;
  private pendingRow: T | null = null;
  private done = false;
  readonly rows: T[] = [];

  constructor(
    filePath: string,
    private readonly parse: (line: string) => T | null,
    private readonly timestampOf: (row: T) => number,
  ) {
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    this.iterator = readline.createInterface({ input: stream, crlfDelay: Infinity })[Symbol.asyncIterator]();
  }

  /** Pull rows with timestamp < untilExclusive into the buffer. */
  async pull(untilExclusive: number): Promise<void> {
    if (this.pendingRow !== null) {
      if (this.timestampOf(this.pendingRow) >= untilExclusive) return;
      this.rows.push(this.pendingRow);
      this.pendingRow = null;
    }
    while (!this.done) {
      const next = await this.iterator.next();
      if (next.done) {
        this.done = true;
        return;
      }
      const row = this.parse(next.value);
      if (row === null) continue;
      if (this.timestampOf(row) >= untilExclusive) {
        this.pendingRow = row;
        return;
      }
      this.rows.push(row);
    }
  }

  prune(cutoff: number): void {
    let drop = 0;
    while (drop < this.rows.length && this.timestampOf(this.rows[drop]) < cutoff) drop++;
    if (drop > 0) this.rows.splice(0, drop);
  }
}

function tsField(line: string): number {
  const match = /"(?:timestamp|ts)":(\d+)/.exec(line);
  return match ? Number(match[1]) : NaN;
}

function near(a: number | null, b: number, tolerance: number): boolean {
  if (a === null || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));
}

async function main(): Promise<void> {
  const decisions = loadCsv();
  const start = decisions[0].ts;
  console.log(`decisions=${decisions.length} window=${new Date(start).toISOString()} -> ${new Date(decisions.at(-1)!.ts).toISOString()}`);

  const earliest = start - 1470 * MINUTE;
  const candles = new StreamBuffer<HlShortMinuteCandle>(
    path.join(ROOT, "data", "HYPEUSDT_1m.jsonl"),
    line => {
      if (tsField(line) < earliest) return null;
      try {
        const row = JSON.parse(line);
        const timestamp = Number(row.ts ?? row.timestamp);
        if (!Number.isFinite(timestamp)) return null;
        return {
          timestamp,
          open: Number(row.o ?? row.open),
          high: Number(row.h ?? row.high),
          low: Number(row.l ?? row.low),
          close: Number(row.c ?? row.close),
          volume: Number.isFinite(Number(row.v ?? row.volume)) ? Number(row.v ?? row.volume) : undefined,
        };
      } catch { return null; }
    },
    row => row.timestamp,
  );
  const taker = new StreamBuffer<HlShortTakerMinute>(
    path.join(ROOT, "data", "HYPEUSDT_taker_hyperliquid.jsonl"),
    line => {
      if (tsField(line) < start - 20 * MINUTE) return null;
      try {
        const row = JSON.parse(line);
        const timestamp = Number(row.timestamp ?? row.ts);
        const buyNotional = Number(row.buyNotional ?? row.buyVol);
        const sellNotional = Number(row.sellNotional ?? row.sellVol);
        if (!Number.isFinite(timestamp) || !Number.isFinite(buyNotional) || !Number.isFinite(sellNotional)) return null;
        return { timestamp, buyNotional, sellNotional };
      } catch { return null; }
    },
    row => row.timestamp,
  );
  const book = new StreamBuffer<HlShortBookSample>(
    path.join(ROOT, "data", "HYPEUSDT_ob_bands_hyperliquid.jsonl"),
    line => {
      if (tsField(line) < start - 20 * MINUTE) return null;
      try {
        const row = JSON.parse(line);
        const timestamp = Number(row.timestamp ?? row.ts);
        const imbalance05 = Number(row.imbalance_0_5);
        if (!Number.isFinite(timestamp) || !Number.isFinite(imbalance05)) return null;
        return { timestamp, imbalance05 };
      } catch { return null; }
    },
    row => row.timestamp,
  );
  const asset = new StreamBuffer<HlShortAssetSample>(
    path.join(ROOT, "data", "HYPEUSDT_asset_ctx_hyperliquid.jsonl"),
    line => {
      if (tsField(line) < start - 20 * MINUTE) return null;
      try {
        const row = JSON.parse(line);
        const timestamp = Number(row.timestamp ?? row.ts);
        if (!Number.isFinite(timestamp)) return null;
        if (!Number.isFinite(Number(row.openInterestValue))) return null;
        return { timestamp };
      } catch { return null; }
    },
    row => row.timestamp,
  );

  let compared = 0;
  let fireMatches = 0;
  const mismatches: string[] = [];
  const availabilityStricter: string[] = [];
  const myFires: number[] = [];
  const csvFires: number[] = [];
  const volDiffs: number[] = [];

  for (const decision of decisions) {
    const ts = decision.ts;
    await Promise.all([candles.pull(ts), taker.pull(ts), book.pull(ts), asset.pull(ts)]);
    candles.prune(ts - 1460 * MINUTE);
    taker.prune(ts - 16 * MINUTE);
    book.prune(ts - 16 * MINUTE);
    asset.prune(ts - 6 * MINUTE);

    const features = computeHlShortBidPullVolumeFeatures({
      decisionTs: ts,
      candles: candles.rows,
      taker: taker.rows,
      book: book.rows,
      asset: asset.rows,
    });
    compared++;

    const csvFire = decision.pulseHealthy
      && decision.red15
      && Number.isFinite(decision.volumeRatio15) && decision.volumeRatio15 > HL_SHORT_BIDPULLVOLUME_POLICY.minimumVolumeRatio15
      && Number.isFinite(decision.hlTaker15) && decision.hlTaker15 < HL_SHORT_BIDPULLVOLUME_POLICY.maximumHlTaker15mRatio
      && Number.isFinite(decision.hlObDelta) && decision.hlObDelta < HL_SHORT_BIDPULLVOLUME_POLICY.maximumHlBookDelta;

    if (csvFire) csvFires.push(ts);
    if (features.fired) myFires.push(ts);

    if (features.fired === csvFire) {
      fireMatches++;
    } else if (csvFire && !features.fired && features.blockers.some(blocker => blocker.endsWith("_incomplete") || blocker === "hl_asset_context_stale")) {
      availabilityStricter.push(`${new Date(ts).toISOString()} blockers=${features.blockers.join(",")}`);
    } else if (mismatches.length < 20) {
      mismatches.push(`${new Date(ts).toISOString()} mine=${features.fired} csv=${csvFire}`
        + ` volMine=${features.price.volumeRatio15?.toFixed(6)} volCsv=${decision.volumeRatio15.toFixed(6)}`
        + ` takerMine=${features.pulse.hlTaker15mRatio?.toFixed(6)} takerCsv=${decision.hlTaker15.toFixed(6)}`
        + ` obDeltaMine=${features.pulse.hlBookDelta?.toFixed(6)} obDeltaCsv=${decision.hlObDelta.toFixed(6)}`
        + ` red15Mine=${features.price.red15m} red15Csv=${decision.red15} blockers=${features.blockers.join(",")}`);
    }

    if (Number.isFinite(decision.volumeRatio15) && features.price.volumeRatio15 !== null) {
      volDiffs.push(Math.abs(features.price.volumeRatio15 - decision.volumeRatio15) / Math.max(1e-12, Math.abs(decision.volumeRatio15)));
      if (!near(features.price.volumeRatio15, decision.volumeRatio15, 1e-6) && mismatches.length < 20) {
        mismatches.push(`${new Date(ts).toISOString()} VOLUME mine=${features.price.volumeRatio15} csv=${decision.volumeRatio15}`);
      }
    }
    if (compared % 1000 === 0) console.log(`...${compared}/${decisions.length}`);
  }

  const cooled = (fires: number[]): number[] => {
    const out: number[] = [];
    let last = -Infinity;
    for (const ts of fires) {
      if (ts - last >= HL_SHORT_BIDPULLVOLUME_POLICY.rawSignalCooldownMs) {
        out.push(ts);
        last = ts;
      }
    }
    return out;
  };
  const myCooled = cooled(myFires);
  const csvCooled = cooled(csvFires);
  const missing = csvCooled.filter(ts => !myCooled.includes(ts)).map(ts => new Date(ts).toISOString());
  const extra = myCooled.filter(ts => !csvCooled.includes(ts)).map(ts => new Date(ts).toISOString());
  const maxVolDiff = volDiffs.length ? Math.max(...volDiffs) : null;

  console.log(JSON.stringify({
    compared,
    fireMatches,
    fireMismatches: compared - fireMatches - availabilityStricter.length,
    availabilityStricterBlocks: availabilityStricter.length,
    volumeRatioComparisons: volDiffs.length,
    maxVolumeRatioRelDiff: maxVolDiff,
    rawFires: { mine: myFires.length, csv: csvFires.length },
    cooldownedFires: { mine: myCooled.length, csv: csvCooled.length },
    missingVsCsv: missing,
    extraVsCsv: extra,
  }, null, 2));
  if (availabilityStricter.length) {
    console.log("availability-stricter blocks (mine fail-closed, study fired):");
    for (const row of availabilityStricter) console.log("  " + row);
  }
  if (mismatches.length) {
    console.log("mismatches:");
    for (const row of mismatches) console.log("  " + row);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
