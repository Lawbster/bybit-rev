import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
  evaluateCounterfactual,
  IntentAnchor,
  MakerTpFillShadow,
  PublicPrint,
} from "../src/bot/maker-tp-fill-shadow";

const MINUTE = 60_000;
const TAKER = 0.00055;
const MAKER = 0.0002;
const T = Date.UTC(2026, 7, 12, 12, 0, 0);

function anchor(overrides: Partial<IntentAnchor> = {}): IntentAnchor {
  return {
    price: 100,
    qtyBasis: 200,
    activeTpPct: 1.4,
    firstSeenAt: T - 60 * MINUTE,
    marketAtFirstSeen: 98.6,
    marketObservedAt: T - 60 * MINUTE,
    marketSource: "websocket_best_bid",
    postableAtFirstSeen: true,
    ...overrides,
  };
}

// qty inference: fees on both legs at taker recover the closed quantity.
const qty = 200;
const avgEntry = 98.62;
const exitPrice = 100.01;
const totalFees = TAKER * qty * (avgEntry + exitPrice);

function prints(sizeAbove: number, sizeAt = 0): PublicPrint[] {
  const rows: PublicPrint[] = [];
  if (sizeAbove > 0) rows.push({ price: 100.02, size: sizeAbove, time: T - MINUTE });
  if (sizeAt > 0) rows.push({ price: 100, size: sizeAt, time: T - MINUTE });
  rows.push({ price: 99.5, size: 5_000, time: T - MINUTE }); // below-level prints never count
  return rows;
}

// Full maker fill: enough printed volume strictly above the level.
const full = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.4,
});
assert.equal(full.eligible, true);
assert.equal(full.reason, "full_maker_fill_supported");
assert.ok(Math.abs(full.qtyClosed - qty) < 1e-9, `qty inference ${full.qtyClosed}`);
assert.equal(full.fillRatioStrict, 1);
assert.ok(Math.abs((full.touchMarginPct ?? 0) - 0.4) < 1e-9);
const expectedActualFee = TAKER * exitPrice * qty;
const expectedMakerFee = MAKER * 100 * qty;
assert.ok(Math.abs(full.actualExitFee - expectedActualFee) < 1e-9);
assert.ok(Math.abs((full.makerExitFee ?? 0) - expectedMakerFee) < 1e-9);
assert.ok(Math.abs((full.estFeeSaving ?? 0) - (expectedActualFee - expectedMakerFee)) < 1e-9);
// Maker fills at the limit price 100 while the market close got 100.01.
assert.ok(Math.abs((full.estPriceDelta ?? 0) - (100 - exitPrice) * qty) < 1e-6);

// Partial fill: half the quantity printed above the level; remainder falls back to taker.
const partial = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(100),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.05,
});
assert.equal(partial.reason, "partial_maker_fill");
assert.ok(Math.abs((partial.fillRatioStrict ?? 0) - 0.5) < 1e-9);
const blended = MAKER * 100 * 100 + TAKER * exitPrice * 100;
assert.ok(Math.abs((partial.makerExitFee ?? 0) - blended) < 1e-9);

// Prints exactly at the level are tracked separately and never counted as fills.
const atLevel = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(0, 5_000),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.0,
});
assert.equal(atLevel.fillRatioStrict, 0);
assert.ok((atLevel.printedQtyAt ?? 0) >= 5_000);

// Not postable: market was already at/above the level when the intent was set.
const notPostable = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor({ postableAtFirstSeen: false }),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.4,
});
assert.equal(notPostable.reason, "not_postable_market_at_or_above_tp_when_intent_set");
assert.equal(notPostable.estFeeSaving, null);

const unknownPostability = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor({
    marketAtFirstSeen: null,
    marketObservedAt: null,
    marketSource: "legacy_unknown",
    postableAtFirstSeen: null,
  }),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.4,
  closeReason: "TP",
});
assert.equal(unknownPostability.reason, "postability_unknown_missing_exact_best_bid");
assert.equal(unknownPostability.estFeeSaving, null);

const explicitNativeTpSlip = evaluateCounterfactual({
  closeTs: T,
  exitPrice: 99.85,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.4,
  closeReason: "NATIVE_TP",
});
assert.equal(explicitNativeTpSlip.reason, "full_maker_fill_supported", "exact native-TP reason overrides price-slip heuristic");

const explicitFlatten = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.4,
  closeReason: "HARD FLATTEN: hostile trend",
});
assert.equal(explicitFlatten.eligible, false);
assert.equal(explicitFlatten.reason, "explicit_non_tp_close:HARD FLATTEN: hostile trend");

// A forced exit fills far below the intent price and is not a TP close.
const forced = evaluateCounterfactual({
  closeTs: T,
  exitPrice: 95,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: prints(500),
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 99,
});
assert.equal(forced.eligible, false);
assert.equal(forced.reason, "exit_below_tp_intent_not_a_tp_close");

// Missing print evidence stays honest: no fee claim.
const noEvidence = evaluateCounterfactual({
  closeTs: T,
  exitPrice,
  avgEntry,
  totalFees,
  anchor: anchor(),
  prints: null,
  printsWindowStart: T - 30 * MINUTE,
  candleHighAfterAnchor: 100.2,
});
assert.equal(noEvidence.reason, "postable_no_print_evidence");
assert.equal(noEvidence.estFeeSaving, null);

// ---- process-level test with a temp dir and stub print fetcher ----

async function processTest(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hype-maker-tp-shadow-"));
  try {
  const data = path.join(root, "data");
  const logs = path.join(root, "logs");
  fs.mkdirSync(data, { recursive: true });
  fs.mkdirSync(logs, { recursive: true });

  const writeHealth = (present: boolean, price: number, writtenAt: number, bestBid = 98.6) => {
    fs.writeFileSync(path.join(data, "HYPEUSDT_runtime_health.json"), JSON.stringify({
      writtenAt,
      desiredLongTp: present
        ? {
            present: true,
            price,
            positionQtyBasis: 200,
            activeTpPct: 1.4,
            syncStatus: "confirmed",
            updatedAt: writtenAt,
            bestBidAtIntent: bestBid,
            bestBidObservedAt: writtenAt,
          }
        : { present: false },
      websocket: { bestBid, lastPriceAt: writtenAt },
    }));
  };
  const appendCandle = (ts: number, close: number, high: number) => {
    fs.appendFileSync(path.join(data, "HYPEUSDT_1m.jsonl"), JSON.stringify({ ts, o: close, h: high, l: close - 0.5, c: close, v: 100 }) + "\n");
  };

  const t0 = T;
  writeHealth(true, 100, t0);
  appendCandle(t0 - MINUTE, 98.6, 98.8);
  const tradesFile = path.join(logs, `trades_${new Date(t0).toISOString().slice(0, 10)}.jsonl`);
  fs.writeFileSync(tradesFile, "");

  let stubPrints: PublicPrint[] = [];
  const shadow = new MakerTpFillShadow(root, t0, async () => stubPrints);

    const first = await shadow.poll(t0);
    assert.notEqual(first.status, "degraded", `reasons: ${first.statusReasons.join(",")}`);
    assert.ok(first.anchor, "anchor should be set from TP intent");
    assert.equal(first.anchor!.postableAtFirstSeen, true, "market 98.6 below TP 100 must be postable");
    assert.equal(first.counters.intentChanges, 1);

    // A TP close appears; the same poll window also clears the intent (as the
    // live bot does after a fill). The counterfactual must use the old anchor.
    const tClose = t0 + 10 * MINUTE;
    appendCandle(tClose - MINUTE, 100.05, 100.3);
    fs.appendFileSync(tradesFile, JSON.stringify({
      ts: new Date(tClose).toISOString(), action: "BATCH_CLOSE", symbol: "HYPEUSDT",
      positionsClosed: 5, totalPnl: 250, totalFees: TAKER * 200 * (98.62 + 100.01),
      avgEntry: 98.62, exitPrice: 100.01, closeReason: "TP",
    }) + "\n");
    writeHealth(false, 0, tClose);
    stubPrints = [{ price: 100.05, size: 800, time: tClose - 30_000 }];

    const second = await shadow.poll(tClose + 5_000);
    assert.equal(second.counters.closesSeen, 1);
    assert.equal(second.counters.tpCloses, 1);
    assert.equal(second.counters.fullFillSupported, 1);
    assert.ok(second.counters.estFeeSavingUsd > 0, "fee saving must accrue");
    assert.equal(second.anchor, null, "intent cleared after fill");

    // Restart: the processed close must not be double-counted.
    const restarted = new MakerTpFillShadow(root, tClose + 10_000, async () => stubPrints);
    const third = await restarted.poll(tClose + 15_000);
    assert.equal(third.counters.closesSeen, 1, "restart must not reprocess closes");

    const events = fs.readFileSync(path.join(data, "HYPEUSDT_maker_tp_shadow.jsonl"), "utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
    assert.equal(events.filter(event => event.event === "maker_tp_counterfactual").length, 1);
    assert.ok(events.every(event => event.shadowOnly === true));

    console.log("maker-tp-fill-shadow-tests passed");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

processTest().catch(err => {
  console.error(err);
  process.exit(1);
});
