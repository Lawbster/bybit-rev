import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────
// Historical OI + Funding regime analysis
// Uses 1h OI and 8h funding against 5m candles
// Goal: find slow regime signals that predict directional moves
// ─────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../data");

interface OiRow { timestamp: number; openInterest: number }
interface FundingRow { timestamp: number; fundingRate: number }
interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; turnover: number }

function load<T>(file: string): T[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

// Build 4h bars from 5m candles
function build4hBars(candles: Candle[]): { ts: number; open: number; close: number; high: number; low: number; volume: number }[] {
  const period = 4 * 3600000;
  const bars: { ts: number; open: number; close: number; high: number; low: number; volume: number }[] = [];
  let curBar = -1, open = 0, high = -Infinity, low = Infinity, close = 0, vol = 0, barTs = 0;
  for (const c of candles) {
    const bar = Math.floor(c.timestamp / period);
    if (bar !== curBar) {
      if (curBar !== -1) bars.push({ ts: barTs, open, close, high, low, volume: vol });
      curBar = bar; open = c.open; high = c.high; low = c.low; vol = 0; barTs = bar * period;
    }
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    close = c.close;
    vol += c.volume;
  }
  if (curBar !== -1) bars.push({ ts: barTs, open, close, high, low, volume: vol });
  return bars;
}

// Get OI at or near a timestamp
function getOiAt(oi: OiRow[], ts: number): number | null {
  // Find closest OI within 2h
  let best: OiRow | null = null, bestDist = Infinity;
  for (const r of oi) {
    const d = Math.abs(r.timestamp - ts);
    if (d < bestDist) { best = r; bestDist = d; }
    if (r.timestamp > ts + 7200000) break; // past window
  }
  return best && bestDist <= 7200000 ? best.openInterest : null;
}

// Get average funding rate over a window ending at ts
function getAvgFunding(funding: FundingRow[], ts: number, windowMs: number): number | null {
  const start = ts - windowMs;
  const inWindow = funding.filter(f => f.timestamp >= start && f.timestamp <= ts);
  if (inWindow.length === 0) return null;
  return inWindow.reduce((s, f) => s + f.fundingRate, 0) / inWindow.length;
}

// ── Analysis functions ──

interface RegimeBar {
  ts: number;
  price: number;
  priceChg4h: number;     // % change this 4h bar
  oiNow: number;
  oiChg4h: number;        // OI % change over 4h
  oiChg24h: number;       // OI % change over 24h
  oiChg72h: number;       // OI % change over 72h
  funding8h: number;      // current funding rate
  fundingAvg3d: number;   // avg funding over 3 days
  // Forward returns
  fwd4h: number;
  fwd12h: number;
  fwd24h: number;
  fwd48h: number;
}

function analyze(symbol: string) {
  const candleFile = fs.existsSync(path.join(DATA_DIR, `${symbol}_5_full.json`))
    ? `${symbol}_5_full.json` : `${symbol}_5.json`;
  const candles: Candle[] = load(candleFile);
  const oi: OiRow[] = load(`${symbol}_oi.json`);
  const funding: FundingRow[] = load(`${symbol}_funding.json`);

  if (candles.length < 1000 || oi.length < 100) {
    console.log(`  ${symbol}: insufficient data (${candles.length} candles, ${oi.length} OI rows)`);
    return null;
  }

  const bars = build4hBars(candles);

  // Build regime bars with OI + funding overlay
  const regimeBars: RegimeBar[] = [];
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const oiNow = getOiAt(oi, bar.ts);
    if (!oiNow) continue;

    const oi4hAgo = getOiAt(oi, bar.ts - 4 * 3600000);
    const oi24hAgo = getOiAt(oi, bar.ts - 24 * 3600000);
    const oi72hAgo = getOiAt(oi, bar.ts - 72 * 3600000);
    const fundNow = getAvgFunding(funding, bar.ts, 8 * 3600000);
    const fundAvg3d = getAvgFunding(funding, bar.ts, 72 * 3600000);

    if (!oi4hAgo || !oi24hAgo || !fundNow) continue;

    const priceChg4h = ((bar.close - bars[i - 1].close) / bars[i - 1].close) * 100;
    const oiChg4h = ((oiNow - oi4hAgo) / oi4hAgo) * 100;
    const oiChg24h = ((oiNow - oi24hAgo) / oi24hAgo) * 100;
    const oiChg72h = oi72hAgo ? ((oiNow - oi72hAgo) / oi72hAgo) * 100 : 0;

    // Forward returns
    const fwd = (hrs: number) => {
      const target = bar.ts + hrs * 3600000;
      const fBar = bars.find(b => b.ts >= target);
      return fBar ? ((fBar.close - bar.close) / bar.close) * 100 : NaN;
    };

    regimeBars.push({
      ts: bar.ts,
      price: bar.close,
      priceChg4h,
      oiNow,
      oiChg4h,
      oiChg24h,
      oiChg72h,
      funding8h: fundNow,
      fundingAvg3d: fundAvg3d ?? fundNow,
      fwd4h: fwd(4),
      fwd12h: fwd(12),
      fwd24h: fwd(24),
      fwd48h: fwd(48),
    });
  }

  console.log(`\n${"=".repeat(100)}`);
  console.log(`  ${symbol} — ${regimeBars.length} regime bars (4h) with OI + funding overlay`);
  console.log(`  Price range: $${bars[0]?.close.toFixed(4)} → $${bars[bars.length - 1]?.close.toFixed(4)}`);
  console.log(`  OI range: ${(oi[0]?.openInterest / 1e6).toFixed(2)}M → ${(oi[oi.length - 1]?.openInterest / 1e6).toFixed(2)}M`);
  console.log(`${"=".repeat(100)}`);

  // ── Study 1: OI divergence (OI dropping while price dropping) ──
  console.log(`\n  ── OI DIVERGENCE STUDY ──`);
  console.log(`  When OI and price move together vs diverge, what happens next?\n`);

  const buckets: Record<string, { label: string; bars: RegimeBar[] }> = {
    "oi_up_price_up":    { label: "OI↑ Price↑ (bullish consensus)", bars: [] },
    "oi_up_price_down":  { label: "OI↑ Price↓ (shorts piling in)", bars: [] },
    "oi_down_price_down":{ label: "OI↓ Price↓ (long capitulation)", bars: [] },
    "oi_down_price_up":  { label: "OI↓ Price↑ (short squeeze / profit taking)", bars: [] },
  };

  for (const r of regimeBars) {
    if (isNaN(r.fwd24h)) continue;
    const oiDir = r.oiChg24h > 0.5 ? "up" : r.oiChg24h < -0.5 ? "down" : null;
    const priceDir = r.priceChg4h > 0.3 ? "up" : r.priceChg4h < -0.3 ? "down" : null;
    if (!oiDir || !priceDir) continue;
    const key = `oi_${oiDir}_price_${priceDir}`;
    if (buckets[key]) buckets[key].bars.push(r);
  }

  console.log(`  ${"Regime".padEnd(42)} ${"Count".padStart(6)}  ${"Avg 4h".padStart(7)}  ${"Avg 12h".padStart(8)}  ${"Avg 24h".padStart(8)}  ${"Avg 48h".padStart(8)}  ${"% Up 24h".padStart(8)}`);
  console.log(`  ${"-".repeat(95)}`);

  for (const [, bucket] of Object.entries(buckets)) {
    const b = bucket.bars.filter(r => !isNaN(r.fwd24h));
    if (b.length < 5) { console.log(`  ${bucket.label.padEnd(42)} ${String(b.length).padStart(6)}  (too few)`); continue; }
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const pctUp = (arr: number[]) => (arr.filter(v => v > 0).length / arr.length * 100);
    const f4 = avg(b.map(r => r.fwd4h));
    const f12 = avg(b.map(r => r.fwd12h).filter(v => !isNaN(v)));
    const f24 = avg(b.map(r => r.fwd24h));
    const f48 = avg(b.map(r => r.fwd48h).filter(v => !isNaN(v)));
    const up24 = pctUp(b.map(r => r.fwd24h));
    console.log(`  ${bucket.label.padEnd(42)} ${String(b.length).padStart(6)}  ${(f4 >= 0 ? "+" : "") + f4.toFixed(2) + "%"}${" ".repeat(Math.max(0, 5 - f4.toFixed(2).length))}  ${(f12 >= 0 ? "+" : "") + f12.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f12.toFixed(2).length))}  ${(f24 >= 0 ? "+" : "") + f24.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f24.toFixed(2).length))}  ${(f48 >= 0 ? "+" : "") + f48.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f48.toFixed(2).length))}  ${up24.toFixed(0) + "%"}`);
  }

  // ── Study 2: Extreme OI changes ──
  console.log(`\n  ── EXTREME OI MOVES ──`);
  console.log(`  What happens after large 24h OI shifts?\n`);

  const oiThresholds = [
    { label: "OI 24h drop > 5%", filter: (r: RegimeBar) => r.oiChg24h < -5 },
    { label: "OI 24h drop > 10%", filter: (r: RegimeBar) => r.oiChg24h < -10 },
    { label: "OI 24h rise > 5%", filter: (r: RegimeBar) => r.oiChg24h > 5 },
    { label: "OI 24h rise > 10%", filter: (r: RegimeBar) => r.oiChg24h > 10 },
    { label: "OI 72h drop > 10%", filter: (r: RegimeBar) => r.oiChg72h < -10 },
    { label: "OI 72h rise > 10%", filter: (r: RegimeBar) => r.oiChg72h > 10 },
  ];

  console.log(`  ${"Condition".padEnd(30)} ${"Count".padStart(6)}  ${"Avg 4h".padStart(7)}  ${"Avg 12h".padStart(8)}  ${"Avg 24h".padStart(8)}  ${"Avg 48h".padStart(8)}  ${"% Up 24h".padStart(8)}`);
  console.log(`  ${"-".repeat(85)}`);

  for (const t of oiThresholds) {
    const b = regimeBars.filter(r => t.filter(r) && !isNaN(r.fwd24h));
    if (b.length < 3) { console.log(`  ${t.label.padEnd(30)} ${String(b.length).padStart(6)}  (too few)`); continue; }
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const pctUp = (arr: number[]) => (arr.filter(v => v > 0).length / arr.length * 100);
    const f4 = avg(b.map(r => r.fwd4h));
    const f12 = avg(b.map(r => r.fwd12h).filter(v => !isNaN(v)));
    const f24 = avg(b.map(r => r.fwd24h));
    const f48 = avg(b.map(r => r.fwd48h).filter(v => !isNaN(v)));
    const up24 = pctUp(b.map(r => r.fwd24h));
    console.log(`  ${t.label.padEnd(30)} ${String(b.length).padStart(6)}  ${(f4 >= 0 ? "+" : "") + f4.toFixed(2) + "%"}${" ".repeat(Math.max(0, 5 - f4.toFixed(2).length))}  ${(f12 >= 0 ? "+" : "") + f12.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f12.toFixed(2).length))}  ${(f24 >= 0 ? "+" : "") + f24.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f24.toFixed(2).length))}  ${(f48 >= 0 ? "+" : "") + f48.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f48.toFixed(2).length))}  ${up24.toFixed(0) + "%"}`);
  }

  // ── Study 3: Funding regimes ──
  console.log(`\n  ── FUNDING REGIME STUDY ──`);
  console.log(`  Forward returns by funding rate level\n`);

  const fundThresholds = [
    { label: "Funding < -0.01%", filter: (r: RegimeBar) => r.funding8h < -0.0001 },
    { label: "Funding -0.01% to 0", filter: (r: RegimeBar) => r.funding8h >= -0.0001 && r.funding8h < 0 },
    { label: "Funding 0 to 0.01%", filter: (r: RegimeBar) => r.funding8h >= 0 && r.funding8h <= 0.0001 },
    { label: "Funding 0.01% to 0.03%", filter: (r: RegimeBar) => r.funding8h > 0.0001 && r.funding8h <= 0.0003 },
    { label: "Funding > 0.03%", filter: (r: RegimeBar) => r.funding8h > 0.0003 },
    { label: "Funding > 0.05%", filter: (r: RegimeBar) => r.funding8h > 0.0005 },
    { label: "3d avg funding > 0.03%", filter: (r: RegimeBar) => r.fundingAvg3d > 0.0003 },
    { label: "3d avg funding < -0.01%", filter: (r: RegimeBar) => r.fundingAvg3d < -0.0001 },
  ];

  console.log(`  ${"Condition".padEnd(30)} ${"Count".padStart(6)}  ${"Avg 4h".padStart(7)}  ${"Avg 12h".padStart(8)}  ${"Avg 24h".padStart(8)}  ${"Avg 48h".padStart(8)}  ${"% Up 24h".padStart(8)}`);
  console.log(`  ${"-".repeat(85)}`);

  for (const t of fundThresholds) {
    const b = regimeBars.filter(r => t.filter(r) && !isNaN(r.fwd24h));
    if (b.length < 3) { console.log(`  ${t.label.padEnd(30)} ${String(b.length).padStart(6)}  (too few)`); continue; }
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const pctUp = (arr: number[]) => (arr.filter(v => v > 0).length / arr.length * 100);
    const f4 = avg(b.map(r => r.fwd4h));
    const f12 = avg(b.map(r => r.fwd12h).filter(v => !isNaN(v)));
    const f24 = avg(b.map(r => r.fwd24h));
    const f48 = avg(b.map(r => r.fwd48h).filter(v => !isNaN(v)));
    const up24 = pctUp(b.map(r => r.fwd24h));
    console.log(`  ${t.label.padEnd(30)} ${String(b.length).padStart(6)}  ${(f4 >= 0 ? "+" : "") + f4.toFixed(2) + "%"}${" ".repeat(Math.max(0, 5 - f4.toFixed(2).length))}  ${(f12 >= 0 ? "+" : "") + f12.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f12.toFixed(2).length))}  ${(f24 >= 0 ? "+" : "") + f24.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f24.toFixed(2).length))}  ${(f48 >= 0 ? "+" : "") + f48.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f48.toFixed(2).length))}  ${up24.toFixed(0) + "%"}`);
  }

  // ── Study 4: Combined OI + Funding signals ──
  console.log(`\n  ── COMBINED SIGNALS ──`);
  console.log(`  OI + Funding combos as directional predictors\n`);

  const combos = [
    { label: "OI↓24h>5% + Fund>0.01% (crowded flush)", filter: (r: RegimeBar) => r.oiChg24h < -5 && r.funding8h > 0.0001 },
    { label: "OI↓24h>5% + Fund<0 (bearish + shorts paying)", filter: (r: RegimeBar) => r.oiChg24h < -5 && r.funding8h < 0 },
    { label: "OI↑24h>5% + Fund>0.03% (euphoria)", filter: (r: RegimeBar) => r.oiChg24h > 5 && r.funding8h > 0.0003 },
    { label: "OI↑24h>5% + Fund<0 (squeeze setup)", filter: (r: RegimeBar) => r.oiChg24h > 5 && r.funding8h < 0 },
    { label: "OI↑ + Price↓ + Fund>0.01% (trapped longs)", filter: (r: RegimeBar) => r.oiChg24h > 2 && r.priceChg4h < -1 && r.funding8h > 0.0001 },
    { label: "OI↓ + Price↓ + Fund<0 (capitulation)", filter: (r: RegimeBar) => r.oiChg24h < -2 && r.priceChg4h < -1 && r.funding8h < 0 },
    { label: "OI↑ + Price↑ + Fund<0 (bullish + shorts pay)", filter: (r: RegimeBar) => r.oiChg24h > 2 && r.priceChg4h > 1 && r.funding8h < 0 },
    { label: "OI flat + Fund normal (baseline)", filter: (r: RegimeBar) => Math.abs(r.oiChg24h) < 2 && Math.abs(r.funding8h) < 0.0001 },
  ];

  console.log(`  ${"Condition".padEnd(48)} ${"Count".padStart(6)}  ${"Avg 12h".padStart(8)}  ${"Avg 24h".padStart(8)}  ${"Avg 48h".padStart(8)}  ${"% Up 24h".padStart(8)}`);
  console.log(`  ${"-".repeat(95)}`);

  for (const t of combos) {
    const b = regimeBars.filter(r => t.filter(r) && !isNaN(r.fwd24h));
    if (b.length < 3) { console.log(`  ${t.label.padEnd(48)} ${String(b.length).padStart(6)}  (too few)`); continue; }
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const pctUp = (arr: number[]) => (arr.filter(v => v > 0).length / arr.length * 100);
    const f12 = avg(b.map(r => r.fwd12h).filter(v => !isNaN(v)));
    const f24 = avg(b.map(r => r.fwd24h));
    const f48 = avg(b.map(r => r.fwd48h).filter(v => !isNaN(v)));
    const up24 = pctUp(b.map(r => r.fwd24h));
    console.log(`  ${t.label.padEnd(48)} ${String(b.length).padStart(6)}  ${(f12 >= 0 ? "+" : "") + f12.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f12.toFixed(2).length))}  ${(f24 >= 0 ? "+" : "") + f24.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f24.toFixed(2).length))}  ${(f48 >= 0 ? "+" : "") + f48.toFixed(2) + "%"}${" ".repeat(Math.max(0, 6 - f48.toFixed(2).length))}  ${up24.toFixed(0) + "%"}`);
  }

  // ── Study 5: Worst drawdown periods — what did OI/funding look like before? ──
  console.log(`\n  ── PRE-CRASH OI/FUNDING ──`);
  console.log(`  What did OI/funding look like 24h BEFORE the worst 4h bars?\n`);

  const sorted = [...regimeBars].filter(r => !isNaN(r.fwd24h)).sort((a, b) => a.priceChg4h - b.priceChg4h);
  const worst20 = sorted.slice(0, 20);
  const best20 = sorted.slice(-20);

  console.log(`  Worst 20 bars (4h):`);
  console.log(`  ${"Date".padEnd(12)} ${"Price∆".padStart(7)} ${"OI∆4h".padStart(7)} ${"OI∆24h".padStart(7)} ${"Fund".padStart(8)} ${"Fwd24h".padStart(8)}`);
  console.log(`  ${"-".repeat(55)}`);
  for (const r of worst20) {
    console.log(`  ${new Date(r.ts).toISOString().slice(0, 10)} ${(r.priceChg4h.toFixed(1) + "%").padStart(7)} ${(r.oiChg4h.toFixed(1) + "%").padStart(7)} ${(r.oiChg24h.toFixed(1) + "%").padStart(7)} ${(r.funding8h * 100).toFixed(3).padStart(7)}% ${((r.fwd24h >= 0 ? "+" : "") + r.fwd24h.toFixed(1) + "%").padStart(8)}`);
  }

  console.log(`\n  Best 20 bars (4h):`);
  console.log(`  ${"Date".padEnd(12)} ${"Price∆".padStart(7)} ${"OI∆4h".padStart(7)} ${"OI∆24h".padStart(7)} ${"Fund".padStart(8)} ${"Fwd24h".padStart(8)}`);
  console.log(`  ${"-".repeat(55)}`);
  for (const r of best20) {
    console.log(`  ${new Date(r.ts).toISOString().slice(0, 10)} ${(r.priceChg4h.toFixed(1) + "%").padStart(7)} ${(r.oiChg4h.toFixed(1) + "%").padStart(7)} ${(r.oiChg24h.toFixed(1) + "%").padStart(7)} ${(r.funding8h * 100).toFixed(3).padStart(7)}% ${((r.fwd24h >= 0 ? "+" : "") + r.fwd24h.toFixed(1) + "%").padStart(8)}`);
  }

  // Summary stats for worst vs best
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  console.log(`\n  Summary: worst 20 vs best 20`);
  console.log(`  ${"".padEnd(20)} ${"Worst 20".padStart(10)} ${"Best 20".padStart(10)}`);
  console.log(`  ${"Avg OI∆4h".padEnd(20)} ${avg(worst20.map(r => r.oiChg4h)).toFixed(2).padStart(9)}% ${avg(best20.map(r => r.oiChg4h)).toFixed(2).padStart(9)}%`);
  console.log(`  ${"Avg OI∆24h".padEnd(20)} ${avg(worst20.map(r => r.oiChg24h)).toFixed(2).padStart(9)}% ${avg(best20.map(r => r.oiChg24h)).toFixed(2).padStart(9)}%`);
  console.log(`  ${"Avg Funding".padEnd(20)} ${(avg(worst20.map(r => r.funding8h)) * 100).toFixed(4).padStart(9)}% ${(avg(best20.map(r => r.funding8h)) * 100).toFixed(4).padStart(9)}%`);
  console.log(`  ${"Avg Fwd24h".padEnd(20)} ${avg(worst20.map(r => r.fwd24h)).toFixed(2).padStart(9)}% ${avg(best20.map(r => r.fwd24h)).toFixed(2).padStart(9)}%`);

  return regimeBars;
}

// ── Main ──
const symbols = process.argv[2] ? [process.argv[2]] : ["HYPEUSDT", "BTCUSDT", "ETHUSDT"];

for (const sym of symbols) {
  analyze(sym);
}
