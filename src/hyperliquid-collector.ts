// Hyperliquid native data collector — separate process from bybit-collect.
//
// Two streams, both REST-polled (no auth required):
//
// 1. HYPE perp ticker (60s) → data/HYPEUSDT_oi_live_hyperliquid.jsonl
//                            data/HYPEUSDT_funding_live_hyperliquid.jsonl
//    Provides: markPx, oraclePx, midPx, premium, openInterest, funding,
//    dayNtlVlm, dayBaseVlm. Joins with existing Bybit/Binance OI/funding
//    files on (symbol, timestamp) — research can compute Hyperliquid vs
//    Bybit perp-perp spread, OI breadth across 3 venues, funding divergence.
//
// 2. HLP vault state (5min) → data/HYPE_hlp_vault.jsonl
//    Provides: apr, maxDistributable (TVL proxy), maxWithdrawable, follower
//    count. HLP-vault-bleed is a unique HYPE-ecosystem stress signal that
//    no other venue exposes.
//
// HYPE-specific by design — Hyperliquid is the ecosystem this token lives on.
// Other Hyperliquid perps could be added if research demands; not in v1.

import fs from "fs";
import path from "path";
import https from "https";

const DATA_DIR = path.resolve(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
const HLP_VAULT_ADDRESS = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";
const HYPE_PERP_NAME = "HYPE";

const PERP_POLL_MS = 60_000;       // ticker (mark/OI/funding) every 60s
const VAULT_POLL_MS = 5 * 60_000;   // HLP vault state every 5min
const HEALTH_LOG_MS = 5 * 60_000;   // periodic status line

const PERP_OI_FILE = path.join(DATA_DIR, "HYPEUSDT_oi_live_hyperliquid.jsonl");
const PERP_FUNDING_FILE = path.join(DATA_DIR, "HYPEUSDT_funding_live_hyperliquid.jsonl");
const VAULT_FILE = path.join(DATA_DIR, "HYPE_hlp_vault.jsonl");

function timeStr(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ── Hyperliquid REST helper ──────────────────────────────────────
function hlPost<T>(body: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HL HTTP ${res.statusCode}: ${d.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(d) as T); }
        catch (e) { reject(new Error(`HL JSON parse: ${(e as Error).message}`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("HL request timeout")));
    req.write(data);
    req.end();
  });
}

// Cached perp index for HYPE (resolved once at startup; never changes)
let hypePerpIndex = -1;

async function resolveHypeIndex(): Promise<void> {
  const meta = await hlPost<{ universe: { name: string }[] }>({ type: "meta" });
  hypePerpIndex = meta.universe.findIndex(u => u.name === HYPE_PERP_NAME);
  if (hypePerpIndex < 0) throw new Error(`HYPE not in Hyperliquid perp universe (${meta.universe.length} entries scanned)`);
  console.log(`  [hl-perp] HYPE resolved at universe index ${hypePerpIndex}`);
}

interface PerpAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: string[];
  dayBaseVlm: string;
}

async function pollHypePerp(): Promise<void> {
  if (hypePerpIndex < 0) return;
  try {
    const arr = await hlPost<[any, PerpAssetCtx[]]>({ type: "metaAndAssetCtxs" });
    const ctx = arr[1][hypePerpIndex];
    if (!ctx) {
      console.error("[hl-perp] HYPE ctx missing in response");
      return;
    }
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    const markPx = parseFloat(ctx.markPx);
    const oraclePx = parseFloat(ctx.oraclePx);
    const midPx = parseFloat(ctx.midPx);
    const premium = parseFloat(ctx.premium);
    const oiBase = parseFloat(ctx.openInterest);
    const oiUsd = Number.isFinite(oiBase) && Number.isFinite(markPx) ? oiBase * markPx : null;
    const fundingRate = parseFloat(ctx.funding);
    const dayNtlVlm = parseFloat(ctx.dayNtlVlm);
    const dayBaseVlm = parseFloat(ctx.dayBaseVlm);

    fs.appendFileSync(PERP_OI_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      symbol: "HYPEUSDT",
      venue: "hyperliquid",
      openInterest: oiBase,
      openInterestValue: oiUsd,
      markPrice: markPx,
      oraclePrice: oraclePx,
      midPrice: midPx,
      premium,
      dayNtlVlm,
      dayBaseVlm,
      source: "rest_poll",
    }) + "\n");

    // Hyperliquid funding is hourly (not 8h like Bybit/Binance) — the rate here
    // is the per-hour rate that's actively accruing. Capture for HF research.
    fs.appendFileSync(PERP_FUNDING_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      symbol: "HYPEUSDT",
      venue: "hyperliquid",
      fundingRate,
      fundingIntervalHours: 1,
      markPrice: markPx,
      oraclePrice: oraclePx,
      premium,
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    console.error(`[hl-perp] poll failed: ${err.message}`);
  }
}

interface VaultDetails {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: any[];
  apr: number;
  followerState: any;
  leaderFraction: number;
  leaderCommission: number;
  followers: any[];        // can be huge — never write the array, only the count
  maxDistributable: number;
  maxWithdrawable: number;
  isClosed: boolean;
  relationship: any;
  allowDeposits: boolean;
  alwaysCloseOnWithdraw: boolean;
}

async function pollHlpVault(): Promise<void> {
  try {
    const v = await hlPost<VaultDetails>({ type: "vaultDetails", vaultAddress: HLP_VAULT_ADDRESS });
    const ts = new Date().toISOString();
    const tsMs = Date.parse(ts);
    fs.appendFileSync(VAULT_FILE, JSON.stringify({
      ts,
      timestamp: tsMs,
      exchangeTimestamp: tsMs,
      vault: "HLP",
      vaultAddress: HLP_VAULT_ADDRESS,
      apr: v.apr,
      maxDistributable: v.maxDistributable,
      maxWithdrawable: v.maxWithdrawable,
      followerCount: Array.isArray(v.followers) ? v.followers.length : null,
      leaderFraction: v.leaderFraction,
      leaderCommission: v.leaderCommission,
      isClosed: v.isClosed,
      allowDeposits: v.allowDeposits,
      source: "rest_poll",
    }) + "\n");
  } catch (err: any) {
    console.error(`[hl-vault] poll failed: ${err.message}`);
  }
}

async function main() {
  console.log(`\n=== HYPERLIQUID NATIVE COLLECTOR ===`);
  console.log(`Output: ${DATA_DIR}/HYPEUSDT_*_hyperliquid.jsonl + HYPE_hlp_vault.jsonl`);

  try {
    await resolveHypeIndex();
  } catch (err: any) {
    console.error(`Failed to resolve HYPE perp index: ${err.message}`);
    process.exit(1);
  }

  // Initial polls immediately so we have first rows on boot
  await pollHypePerp();
  await pollHlpVault();

  setInterval(pollHypePerp, PERP_POLL_MS);
  setInterval(pollHlpVault, VAULT_POLL_MS);

  // Periodic status
  setInterval(() => {
    const perpSize = fs.existsSync(PERP_OI_FILE) ? fs.statSync(PERP_OI_FILE).size : 0;
    const fundSize = fs.existsSync(PERP_FUNDING_FILE) ? fs.statSync(PERP_FUNDING_FILE).size : 0;
    const vaultSize = fs.existsSync(VAULT_FILE) ? fs.statSync(VAULT_FILE).size : 0;
    console.log(`[${timeStr()}] perp_oi=${(perpSize/1024).toFixed(1)}kb funding=${(fundSize/1024).toFixed(1)}kb hlp_vault=${(vaultSize/1024).toFixed(1)}kb`);
  }, HEALTH_LOG_MS);

  console.log(`\n[${timeStr()}] HL collector running. Perp ticker every ${PERP_POLL_MS/1000}s, HLP vault every ${VAULT_POLL_MS/1000}s.`);
  console.log("Press Ctrl+C to stop\n");
}

main().catch(err => { console.error(err); process.exit(1); });
