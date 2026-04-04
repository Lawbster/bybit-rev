// river-alarm.ts — RIVER exit alarm monitor
//
// Watches three signals in real-time and fires Discord alerts:
//   1. OI divergence  — price near 7d high AND OI drops >10% in 24h
//   2. Funding alarm  — 8H funding rate < -0.02% (heavy short pressure)
//   3. Price structure — price drops >8% from 3d high on a single candle close
//
// Polls Bybit every 5 minutes. Sends Discord embed on any trigger.
// Re-alerts every 4h if condition persists, not on every poll.
//
// Usage: npx ts-node src/river-alarm.ts
// SYMBOL=VVVUSDT npx ts-node src/river-alarm.ts
// ─────────────────────────────────────────────

import { RestClientV5 } from "bybit-api";
import * as dotenv from "dotenv";
import https from "https";
import { URL } from "url";

dotenv.config();

const SYMBOL        = process.env.SYMBOL ?? "RIVERUSDT";
const WEBHOOK_URL   = process.env[`DISCORD_WEBHOOK_${SYMBOL}`] ?? "";
const POLL_MS       = 5 * 60 * 1000;       // 5 min poll
const REALERT_MS    = 4 * 60 * 60 * 1000;  // re-alert every 4h if still firing

// Thresholds
const OI_DROP_PCT      = 10;    // OI drops >10% while price near 7d high
const OI_NEAR_HIGH_PCT = 5;     // "near high" = within 5% of 7d high
const FUNDING_ALARM    = -0.02; // % per 8H — negative means shorts paying longs
const PRICE_DROP_PCT   = 8;     // single candle drops >8% from 3d high

if (!WEBHOOK_URL) {
  console.error("DISCORD_WEBHOOK_RIVER not set in .env");
  process.exit(1);
}

const client = new RestClientV5();

// ── Discord ───────────────────────────────────────────────────────
async function sendDiscord(title: string, description: string, color: number, fields: { name: string; value: string; inline?: boolean }[]) {
  const body = JSON.stringify({
    embeds: [{
      title,
      description,
      color,
      fields,
      footer: { text: `${SYMBOL} river-alarm • ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC` },
    }]
  });

  const url = new URL(WEBHOOK_URL);
  return new Promise<void>((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, res => {
      res.resume();
      if (res.statusCode && res.statusCode >= 400) reject(new Error(`Discord HTTP ${res.statusCode}`));
      else resolve();
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── State ─────────────────────────────────────────────────────────
interface AlarmState {
  lastFiredAt: number;
  firing: boolean;
}
const alarms: Record<string, AlarmState> = {
  oiDivergence:   { lastFiredAt: 0, firing: false },
  fundingAlarm:   { lastFiredAt: 0, firing: false },
  priceStructure: { lastFiredAt: 0, firing: false },
};

async function maybeAlert(key: string, firing: boolean, title: string, description: string, color: number, fields: { name: string; value: string; inline?: boolean }[]) {
  const s = alarms[key];
  const now = Date.now();
  if (!firing) {
    if (s.firing) {
      s.firing = false;
      await sendDiscord(`✅ ${title} — CLEARED`, `Condition no longer active.`, 0x57F287, []);
    }
    return;
  }
  s.firing = true;
  if (now - s.lastFiredAt > REALERT_MS) {
    s.lastFiredAt = now;
    await sendDiscord(`🚨 ${title}`, description, color, fields);
  }
}

// ── Fetch helpers ─────────────────────────────────────────────────
async function getKlines(interval: string, limit: number) {
  const res = await client.getKline({ category: "linear", symbol: SYMBOL, interval: interval as any, limit });
  if (res.retCode !== 0) throw new Error(`Kline error: ${res.retMsg}`);
  return (res.result.list as string[][]).map(c => ({
    ts:     Number(c[0]),
    open:   Number(c[1]),
    high:   Number(c[2]),
    low:    Number(c[3]),
    close:  Number(c[4]),
    volume: Number(c[5]),
  })).sort((a, b) => a.ts - b.ts);
}

async function getTicker() {
  const res = await client.getTickers({ category: "linear", symbol: SYMBOL });
  if (res.retCode !== 0) throw new Error(`Ticker error: ${res.retMsg}`);
  const t = (res.result.list as any[])[0];
  return {
    lastPrice:    Number(t.lastPrice),
    fundingRate:  Number(t.fundingRate),
    nextFundingTime: Number(t.nextFundingTime),
    openInterest: Number(t.openInterestValue), // USD value
  };
}

async function getOIHistory() {
  // OI history endpoint — 1H intervals, last 48 entries = 2 days
  const res = await client.getOpenInterest({ category: "linear", symbol: SYMBOL, intervalTime: "1h", limit: 48 });
  if (res.retCode !== 0) throw new Error(`OI error: ${res.retMsg}`);
  return ((res.result as any).list as { timestamp: string; openInterest: string }[])
    .map(o => ({ ts: Number(o.timestamp), oi: Number(o.openInterest) }))
    .sort((a, b) => a.ts - b.ts);
}

// ── Signal checks ─────────────────────────────────────────────────
async function check() {
  const [ticker, daily, h1oi] = await Promise.all([
    getTicker(),
    getKlines("D", 10),   // 10 daily candles
    getOIHistory(),
  ]);

  const price = ticker.lastPrice;
  const fundingPct = ticker.fundingRate * 100;

  // ── Signal 1: OI divergence ───────────────────────────────────
  const high7d = Math.max(...daily.slice(-7).map(c => c.high));
  const nearHigh = price >= high7d * (1 - OI_NEAR_HIGH_PCT / 100);
  let oiDivFiring = false;
  let oiChgPct = 0;
  if (h1oi.length >= 25) {
    const oiNow  = h1oi[h1oi.length - 1].oi;
    const oi24h  = h1oi[h1oi.length - 25].oi; // ~24h ago
    oiChgPct = (oiNow - oi24h) / oi24h * 100;
    oiDivFiring = nearHigh && oiChgPct < -OI_DROP_PCT;
  }

  await maybeAlert(
    "oiDivergence",
    oiDivFiring,
    "OI Divergence",
    `Price is near the 7-day high but Open Interest dropped sharply — distribution signal.`,
    0xFEE75C, // yellow
    [
      { name: "Price",      value: `$${price.toFixed(4)}`,            inline: true },
      { name: "7d High",    value: `$${high7d.toFixed(4)}`,           inline: true },
      { name: "OI 24h chg", value: `${oiChgPct.toFixed(1)}%`,         inline: true },
      { name: "Action",     value: "Halt new batch opens. Watch closely.", inline: false },
    ]
  );

  // ── Signal 2: Funding alarm ───────────────────────────────────
  const fundFiring = fundingPct < FUNDING_ALARM;
  const nextFund = new Date(ticker.nextFundingTime).toISOString().replace("T", " ").slice(0, 16);

  await maybeAlert(
    "fundingAlarm",
    fundFiring,
    "Funding Alarm — Heavy Short Pressure",
    `Funding rate is deeply negative. Market is aggressively short. Precursor to sharp sell-off.`,
    0xED4245, // red
    [
      { name: "Funding Rate", value: `${fundingPct.toFixed(4)}% per 8H`, inline: true },
      { name: "Threshold",    value: `${FUNDING_ALARM}%`,                 inline: true },
      { name: "Next Funding", value: nextFund + " UTC",                   inline: true },
      { name: "Action",       value: "Drain open batches. Prepare to close bot.", inline: false },
    ]
  );

  // ── Signal 3: Price structure ─────────────────────────────────
  const high3d = Math.max(...daily.slice(-3).map(c => c.high));
  const dropFromHigh = (high3d - price) / high3d * 100;
  const structFiring = dropFromHigh > PRICE_DROP_PCT;

  await maybeAlert(
    "priceStructure",
    structFiring,
    "Price Structure Break",
    `Price has dropped sharply from the recent high. Trend may be reversing.`,
    0xED4245, // red
    [
      { name: "Price",         value: `$${price.toFixed(4)}`,          inline: true },
      { name: "3d High",       value: `$${high3d.toFixed(4)}`,         inline: true },
      { name: "Drop from High",value: `${dropFromHigh.toFixed(1)}%`,   inline: true },
      { name: "Action",        value: "Close bot immediately. No new batches.", inline: false },
    ]
  );

  // ── Status log ────────────────────────────────────────────────
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const flags = [
    oiDivFiring    ? "OI-DIV" : null,
    fundFiring     ? "FUNDING" : null,
    structFiring   ? "STRUCT"  : null,
  ].filter(Boolean).join("+") || "ok";
  console.log(`[${ts}] ${SYMBOL} $${price.toFixed(4)}  fund=${fundingPct.toFixed(4)}%  OI24h=${oiChgPct.toFixed(1)}%  drop3d=${dropFromHigh.toFixed(1)}%  → ${flags}`);
}

// ── Main loop ─────────────────────────────────────────────────────
async function main() {
  console.log(`river-alarm starting — symbol=${SYMBOL} poll=${POLL_MS/1000}s`);
  console.log(`Thresholds: OI drop >${OI_DROP_PCT}% near 7d high | funding <${FUNDING_ALARM}% | price drop >${PRICE_DROP_PCT}% from 3d high\n`);

  // Send startup ping
  await sendDiscord(
    `🟢 river-alarm started — ${SYMBOL}`,
    `Monitoring for exit signals. Will alert on OI divergence, funding alarm, or price structure break.`,
    0x57F287,
    [
      { name: "OI divergence",   value: `OI drops >${OI_DROP_PCT}% while price within ${OI_NEAR_HIGH_PCT}% of 7d high`, inline: false },
      { name: "Funding alarm",   value: `8H rate < ${FUNDING_ALARM}%`,   inline: false },
      { name: "Price structure", value: `Price drops >${PRICE_DROP_PCT}% from 3d high`, inline: false },
    ]
  );

  // Run immediately, then on interval
  await check().catch(e => console.error("check error:", e.message));
  setInterval(() => check().catch(e => console.error("check error:", e.message)), POLL_MS);
}

main().catch(e => { console.error(e); process.exit(1); });
