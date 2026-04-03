import fs from "fs";
import { Candle } from "./fetch-candles";

// ─────────────────────────────────────────────
// Intraday structure analysis — HYPE 5m candles
//
// 1. Hourly return heatmap (UTC) — when does HYPE trend up/down
// 2. Daily range distribution — how much room per day
// 3. Trending vs reverting days — open-to-close vs high-low range
// 4. Volume by hour — where the real moves happen
// 5. Intraday mean reversion — does price return to daily open
// 6. Best/worst hour streaks — momentum continuation by hour
// ─────────────────────────────────────────────

const candles: Candle[] = JSON.parse(fs.readFileSync("data/HYPEUSDT_5_full.json", "utf-8"));

// ── Build daily bars ──
interface DayBar {
  date: string;       // YYYY-MM-DD UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rangePct: number;   // (high - low) / open * 100
  returnPct: number;  // (close - open) / open * 100
  trending: boolean;  // |return| > 0.5 * range (directional day)
  candles: Candle[];
}

const dayMap = new Map<string, Candle[]>();
for (const c of candles) {
  const date = new Date(c.timestamp).toISOString().slice(0, 10);
  if (!dayMap.has(date)) dayMap.set(date, []);
  dayMap.get(date)!.push(c);
}

const days: DayBar[] = [];
for (const [date, cs] of dayMap) {
  if (cs.length < 12) continue; // skip partial days
  cs.sort((a, b) => a.timestamp - b.timestamp);
  const open = cs[0].open;
  const close = cs[cs.length - 1].close;
  const high = Math.max(...cs.map(c => c.high));
  const low = Math.min(...cs.map(c => c.low));
  const volume = cs.reduce((a, c) => a + c.volume, 0);
  const rangePct = (high - low) / open * 100;
  const returnPct = (close - open) / open * 100;
  const trending = Math.abs(returnPct) > 0.5 * rangePct;
  days.push({ date, open, high, low, close, volume, rangePct, returnPct, trending, candles: cs });
}
days.sort((a, b) => a.date.localeCompare(b.date));

// ── Build hourly stats ──
interface HourStats {
  hour: number;
  returns: number[];      // 5m candle returns during this hour
  volumes: number[];
  upCount: number;
  downCount: number;
}

const hourStats: HourStats[] = Array.from({ length: 24 }, (_, h) => ({
  hour: h, returns: [], volumes: [], upCount: 0, downCount: 0,
}));

for (const c of candles) {
  const h = new Date(c.timestamp).getUTCHours();
  const ret = (c.close - c.open) / c.open * 100;
  hourStats[h].returns.push(ret);
  hourStats[h].volumes.push(c.volume);
  if (ret > 0) hourStats[h].upCount++;
  else if (ret < 0) hourStats[h].downCount++;
}

// ── Hour-of-day: cumulative intraday path ──
// For each hour 0-23, what is the avg price change from daily open to end of that hour
interface IntraPath {
  hour: number;
  avgPctFromOpen: number;
  medPctFromOpen: number;
  positive: number; // % of days where price is above open at this hour
}

const intraPaths: IntraPath[] = [];
for (let h = 0; h < 24; h++) {
  const vals: number[] = [];
  for (const day of days) {
    // find the candle closest to end of this hour
    const targetTs = new Date(day.date + "T00:00:00Z").getTime() + (h + 1) * 3600000 - 300000;
    const c = day.candles.filter(x => x.timestamp <= targetTs).pop();
    if (!c) continue;
    vals.push((c.close - day.open) / day.open * 100);
  }
  if (vals.length === 0) { intraPaths.push({ hour: h, avgPctFromOpen: 0, medPctFromOpen: 0, positive: 0 }); continue; }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sorted = [...vals].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const pos = vals.filter(v => v > 0).length / vals.length * 100;
  intraPaths.push({ hour: h, avgPctFromOpen: avg, medPctFromOpen: med, positive: pos });
}

// ── Stats helpers ──
function mean(a: number[]) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function median(a: number[]) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; }
function pct(n: number, d = 1) { return (n >= 0 ? "+" : "") + n.toFixed(d) + "%"; }
function bar(v: number, scale = 5, max = 20): string {
  const len = Math.min(max, Math.round(Math.abs(v) * scale));
  return (v >= 0 ? "▓" : "░").repeat(len);
}

const SEP = "=".repeat(90);
const div = "-".repeat(90);

// ══════════════════════════════════════════════
// 1. DATA OVERVIEW
// ══════════════════════════════════════════════
console.log("\n" + SEP);
console.log("  HYPE INTRADAY STRUCTURE ANALYSIS");
console.log(`  ${candles[0] ? new Date(candles[0].timestamp).toISOString().slice(0,10) : ""} → ${new Date(candles[candles.length-1].timestamp).toISOString().slice(0,10)}`);
console.log(`  ${days.length} trading days | ${candles.length} 5m candles`);
console.log(SEP);

// ══════════════════════════════════════════════
// 2. DAILY RANGE DISTRIBUTION
// ══════════════════════════════════════════════
console.log("\n  ── DAILY RANGE DISTRIBUTION ──");
const ranges = days.map(d => d.rangePct);
const rangeBuckets = [2, 4, 6, 8, 10, 15, 20, 999];
console.log(`  Median daily range: ${median(ranges).toFixed(2)}%  |  Mean: ${mean(ranges).toFixed(2)}%  |  Max: ${Math.max(...ranges).toFixed(2)}%`);
console.log(`  Days < 3% range: ${days.filter(d => d.rangePct < 3).length} (tight/sideways)`);
console.log(`  Days > 10% range: ${days.filter(d => d.rangePct > 10).length} (volatile/trending)`);
console.log();
console.log(`  ${"Range".padEnd(12)} ${"Days".padStart(5)} ${"% of total".padStart(11)}`);
console.log("  " + "-".repeat(32));
let prev = 0;
for (const upper of rangeBuckets) {
  const count = days.filter(d => d.rangePct > prev && d.rangePct <= upper).length;
  const label = upper === 999 ? `> ${prev}%` : `${prev}–${upper}%`;
  console.log(`  ${label.padEnd(12)} ${String(count).padStart(5)} ${"  " + (count/days.length*100).toFixed(1)+"%"}`);
  prev = upper;
}

// ══════════════════════════════════════════════
// 3. TRENDING VS REVERTING DAYS
// ══════════════════════════════════════════════
console.log("\n  ── TRENDING VS REVERTING DAYS ──");
const trendingDays = days.filter(d => d.trending);
const revertingDays = days.filter(d => !d.trending);
const upDays = days.filter(d => d.returnPct > 0);
const downDays = days.filter(d => d.returnPct < 0);
console.log(`  Trending days (|return| > 50% of range): ${trendingDays.length} / ${days.length} (${(trendingDays.length/days.length*100).toFixed(0)}%)`);
console.log(`  Reverting days:                          ${revertingDays.length} / ${days.length} (${(revertingDays.length/days.length*100).toFixed(0)}%)`);
console.log(`  Up days: ${upDays.length} (${(upDays.length/days.length*100).toFixed(0)}%)  |  Down days: ${downDays.length} (${(downDays.length/days.length*100).toFixed(0)}%)`);
console.log(`  Avg return on up days:   ${pct(mean(upDays.map(d => d.returnPct)))}`);
console.log(`  Avg return on down days: ${pct(mean(downDays.map(d => d.returnPct)))}`);
console.log(`  Avg range trending days: ${mean(trendingDays.map(d => d.rangePct)).toFixed(2)}%`);
console.log(`  Avg range reverting days: ${mean(revertingDays.map(d => d.rangePct)).toFixed(2)}%`);

// ══════════════════════════════════════════════
// 4. HOURLY RETURN HEATMAP (UTC)
// ══════════════════════════════════════════════
console.log("\n  ── HOURLY RETURN HEATMAP (UTC) ──");
console.log("  Each bar = avg 5m candle return during that UTC hour");
console.log(`  ${"Hour(UTC)".padEnd(10)} ${"AvgRet".padStart(8)} ${"Bias".padStart(5)} ${"UpPct".padStart(6)} ${"AvgVol".padStart(9)}  ${"Chart"}`);
console.log("  " + "-".repeat(75));
for (const hs of hourStats) {
  if (hs.returns.length === 0) continue;
  const avg = mean(hs.returns);
  const upPct = hs.upCount / (hs.upCount + hs.downCount) * 100;
  const avgVol = mean(hs.volumes);
  const bias = upPct > 55 ? " bull" : upPct < 45 ? " bear" : "  neu";
  const h = String(hs.hour).padStart(2, "0") + ":00";
  console.log(`  ${h.padEnd(10)} ${pct(avg, 3).padStart(8)} ${bias.padStart(5)} ${(upPct.toFixed(0)+"%").padStart(6)} ${avgVol.toFixed(0).padStart(9)}  ${bar(avg, 300)}`);
}

// ══════════════════════════════════════════════
// 5. INTRADAY PATH — avg price vs daily open by hour
// ══════════════════════════════════════════════
console.log("\n  ── INTRADAY CUMULATIVE PATH (vs daily open, UTC) ──");
console.log("  How far is price from the daily open at end of each hour, on average");
console.log(`  ${"Hour(UTC)".padEnd(10)} ${"AvgΔ".padStart(7)} ${"MedianΔ".padStart(9)} ${"Above open".padStart(11)}  ${"Chart"}`);
console.log("  " + "-".repeat(75));
for (const ip of intraPaths) {
  const h = String(ip.hour).padStart(2, "0") + ":00";
  console.log(`  ${h.padEnd(10)} ${pct(ip.avgPctFromOpen, 2).padStart(7)} ${pct(ip.medPctFromOpen, 2).padStart(9)} ${(ip.positive.toFixed(0)+"%").padStart(11)}  ${bar(ip.avgPctFromOpen, 80)}`);
}

// ══════════════════════════════════════════════
// 6. VOLUME HEATMAP
// ══════════════════════════════════════════════
console.log("\n  ── VOLUME BY HOUR (UTC) ──");
const totalVolByHour = hourStats.map(hs => mean(hs.volumes));
const maxVol = Math.max(...totalVolByHour);
console.log(`  ${"Hour(UTC)".padEnd(10)} ${"AvgVol/5m".padStart(12)}  ${"Chart (relative)"}`);
console.log("  " + "-".repeat(60));
for (const hs of hourStats) {
  const avg = mean(hs.volumes);
  const relLen = Math.round(avg / maxVol * 30);
  const h = String(hs.hour).padStart(2, "0") + ":00";
  console.log(`  ${h.padEnd(10)} ${avg.toFixed(0).padStart(12)}  ${"█".repeat(relLen)}`);
}

// ══════════════════════════════════════════════
// 7. OPEN-TO-MIDDAY / MIDDAY-TO-CLOSE SPLIT
// ══════════════════════════════════════════════
console.log("\n  ── HALF-DAY SPLIT ──");
console.log("  Is there a consistent first-half vs second-half bias?");
const firstHalf: number[] = [], secondHalf: number[] = [];
for (const day of days) {
  const noonTs = new Date(day.date + "T12:00:00Z").getTime();
  const noonCandle = day.candles.filter(c => c.timestamp <= noonTs).pop();
  if (!noonCandle) continue;
  firstHalf.push((noonCandle.close - day.open) / day.open * 100);
  secondHalf.push((day.close - noonCandle.close) / noonCandle.close * 100);
}
console.log(`  First half  (00:00–12:00 UTC): avg ${pct(mean(firstHalf))}  |  positive ${(firstHalf.filter(v=>v>0).length/firstHalf.length*100).toFixed(0)}% of days`);
console.log(`  Second half (12:00–24:00 UTC): avg ${pct(mean(secondHalf))}  |  positive ${(secondHalf.filter(v=>v>0).length/secondHalf.length*100).toFixed(0)}% of days`);

// ══════════════════════════════════════════════
// 8. DAY-OF-WEEK PATTERN
// ══════════════════════════════════════════════
console.log("\n  ── DAY-OF-WEEK PATTERN ──");
const dowLabels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const dowStats: { returns: number[]; ranges: number[] }[] = Array.from({length:7}, () => ({returns:[], ranges:[]}));
for (const day of days) {
  const dow = new Date(day.date + "T12:00:00Z").getUTCDay();
  dowStats[dow].returns.push(day.returnPct);
  dowStats[dow].ranges.push(day.rangePct);
}
console.log(`  ${"Day".padEnd(6)} ${"AvgReturn".padStart(10)} ${"AvgRange".padStart(10)} ${"UpDays".padStart(8)} ${"Days".padStart(6)}`);
console.log("  " + "-".repeat(44));
for (let d = 0; d < 7; d++) {
  const r = dowStats[d].returns;
  if (r.length === 0) continue;
  const upPct = r.filter(v => v > 0).length / r.length * 100;
  console.log(`  ${dowLabels[d].padEnd(6)} ${pct(mean(r)).padStart(10)} ${(mean(dowStats[d].ranges).toFixed(2)+"%").padStart(10)} ${(upPct.toFixed(0)+"%").padStart(8)} ${String(r.length).padStart(6)}`);
}

// ══════════════════════════════════════════════
// 9. MEAN REVERSION TO DAILY OPEN — by hour
// ══════════════════════════════════════════════
console.log("\n  ── MEAN REVERSION — does price return to daily open? ──");
console.log("  % of days where price crosses back through the daily open at least once during each hour");
const reversionByHour: { hour: number; pct: number }[] = [];
for (let h = 1; h < 24; h++) {
  let crossCount = 0;
  for (const day of days) {
    const startTs = new Date(day.date + "T00:00:00Z").getTime() + h * 3600000;
    const endTs = startTs + 3600000;
    const hourCandles = day.candles.filter(c => c.timestamp >= startTs && c.timestamp < endTs);
    if (hourCandles.length === 0) continue;
    const crossesOpen = hourCandles.some(c => c.low <= day.open && c.high >= day.open);
    if (crossesOpen) crossCount++;
  }
  reversionByHour.push({ hour: h, pct: crossCount / days.length * 100 });
}
console.log(`  ${"Hour(UTC)".padEnd(10)} ${"Crosses open".padStart(13)}  ${"Chart"}`);
console.log("  " + "-".repeat(55));
for (const rv of reversionByHour) {
  const h = String(rv.hour).padStart(2, "0") + ":00";
  const len = Math.round(rv.pct / 3);
  console.log(`  ${h.padEnd(10)} ${(rv.pct.toFixed(0)+"%").padStart(13)}  ${"▪".repeat(len)}`);
}

// ══════════════════════════════════════════════
// 10. MONTHLY REGIME BREAKDOWN — trending vs reverting
// ══════════════════════════════════════════════
console.log("\n  ── MONTHLY REGIME ──");
console.log(`  ${"Month".padEnd(8)} ${"Days".padStart(5)} ${"AvgRange".padStart(9)} ${"AvgReturn".padStart(10)} ${"UpDays%".padStart(8)} ${"Trending%".padStart(10)}`);
console.log("  " + "-".repeat(54));
const monthMap = new Map<string, DayBar[]>();
for (const d of days) {
  const m = d.date.slice(0, 7);
  if (!monthMap.has(m)) monthMap.set(m, []);
  monthMap.get(m)!.push(d);
}
for (const [month, mdays] of monthMap) {
  const upPct = mdays.filter(d => d.returnPct > 0).length / mdays.length * 100;
  const trendPct = mdays.filter(d => d.trending).length / mdays.length * 100;
  console.log(`  ${month.padEnd(8)} ${String(mdays.length).padStart(5)} ${(mean(mdays.map(d=>d.rangePct)).toFixed(2)+"%").padStart(9)} ${pct(mean(mdays.map(d=>d.returnPct))).padStart(10)} ${(upPct.toFixed(0)+"%").padStart(8)} ${(trendPct.toFixed(0)+"%").padStart(10)}`);
}
