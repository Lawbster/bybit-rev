import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  HL_SHORT_BREAKDOWN_CANDIDATE,
  HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
  HL_SHORT_BREAKDOWN_POLICY_VERSION,
} from "../src/bot/hl-short-breakdown-policy";
import { HlShortLiveOwner, loadHlShortLiveConfig, readJournalChunk } from "../src/bot/hl-short-live";

async function main(): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hl-short-live-"));
  try {
  const journal = path.join(dir, "signals.jsonl");
  const first = JSON.stringify({ event: "decision", id: 1 });
  const second = JSON.stringify({ event: "signal", id: 2 });
  const third = JSON.stringify({ event: "signal", id: 3 });
  const partial = third.slice(0, Math.floor(third.length / 2));
  fs.writeFileSync(journal, `${first}\n${second}\n${partial}`);

  const chunk1 = readJournalChunk(journal, 0);
  assert.equal(chunk1.rows.length, 2);
  assert.equal((chunk1.rows[1] as any).id, 2);
  assert.ok(chunk1.nextOffset < chunk1.size, "partial trailing row is not consumed");

  fs.appendFileSync(journal, `${third.slice(partial.length)}\n`);
  const chunk2 = readJournalChunk(journal, chunk1.nextOffset);
  assert.equal(chunk2.rows.length, 1);
  assert.equal((chunk2.rows[0] as any).id, 3);
  assert.equal(chunk2.nextOffset, chunk2.size);

  fs.writeFileSync(journal, "{}\n");
  assert.throws(() => readJournalChunk(journal, chunk2.nextOffset), /truncated/);

  const configPath = path.join(dir, "config.json");
  const validConfig = {
    enabled: false,
    entryEnabled: false,
    symbol: "HYPEUSDT",
    notionalUsdt: 25000,
    leverage: 25,
    feeRate: 0.00055,
    pollIntervalMs: 5000,
    maximumSignalAgeMs: 180000,
    maximumShadowHealthAgeMs: 90000,
    signalJournalFile: journal,
    shadowHealthFile: path.join(dir, "shadow-health.json"),
    stateFile: path.join(dir, "state.json"),
    healthFile: path.join(dir, "health.json"),
    logDir: path.join(dir, "logs"),
  };
  fs.writeFileSync(configPath, JSON.stringify(validConfig));
  assert.equal(loadHlShortLiveConfig(configPath).notionalUsdt, 25_000);
  fs.writeFileSync(configPath, JSON.stringify({ ...validConfig, notionalUsdt: 24_999 }));
  assert.throws(() => loadHlShortLiveConfig(configPath), /must remain \$25,000/);
  fs.writeFileSync(configPath, JSON.stringify({ ...validConfig, leverage: 10 }));
  assert.throws(() => loadHlShortLiveConfig(configPath), /must match the 25x long owner/);

  const now = Date.now();
  fs.writeFileSync(journal, JSON.stringify({ event: "decision", timestamp: now - 60_000 }) + "\n");
  fs.writeFileSync(validConfig.shadowHealthFile, JSON.stringify({
    version: 1,
    symbol: "HYPEUSDT",
    candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
    policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
    policySignature: HL_SHORT_BREAKDOWN_POLICY_SIGNATURE,
    shadowOnly: true,
    processStartedAt: now - 600_000,
    writtenAt: now,
    status: "healthy",
    statusReasons: [],
    decision: { lastTs: now, ready: true },
  }));
  fs.writeFileSync(configPath, JSON.stringify(validConfig));
  const owner = new HlShortLiveOwner(loadHlShortLiveConfig(configPath), now);
  await owner.initialize(now);
  const initializedState = JSON.parse(fs.readFileSync(validConfig.stateFile, "utf8"));
  assert.equal(initializedState.eventOffset, fs.statSync(journal).size, "first start skips the historical journal");

  const decisionTs = now - 60_000;
  const signalId = `hlbp-HYPEUSDT-${decisionTs}`;
  fs.appendFileSync(journal, JSON.stringify({
    timestamp: now,
    symbol: "HYPEUSDT",
    candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
    policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
    shadowOnly: true,
    event: "signal",
    eventId: `signal:${signalId}`,
    signalId,
    features: {
      candidate: HL_SHORT_BREAKDOWN_CANDIDATE,
      policyVersion: HL_SHORT_BREAKDOWN_POLICY_VERSION,
      decisionTs,
      ready: true,
      fired: true,
    },
  }) + "\n");
  const health = await owner.poll(now + 1_000);
  assert.equal(health.status, "disabled");
  assert.equal(health.entryEnabled, false);
  const disabledState = JSON.parse(fs.readFileSync(validConfig.stateFile, "utf8"));
  assert.ok(disabledState.processedSignalIds.includes(signalId));
  assert.equal(disabledState.lastSignalOutcome, "live_owner_disabled");
  assert.equal(disabledState.eventOffset, fs.statSync(journal).size);

  console.log("hl short live journal/config tests passed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
