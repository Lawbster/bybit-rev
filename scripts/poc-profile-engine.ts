/** Pure, research-only finalized volume profiles and causal NPOC projection. */
import assert from 'assert/strict';
import { decimal, format, DAY } from './poc-volume-source';
export type Period = 'day' | 'week' | 'month';
export interface ProfileDay {
  venue: string; date: string; start: number;
  minutes: { ts: number; quality: string }[];
  prices: { p: number; q: string; buy: string; n: number; first: number; last: number }[];
}
export interface Profile {
  id: string; venue: string; symbol: string; period: Period; start: number; end: number; availableAt: number;
  width: string; lower: string; upper: string; center: string; volume: string; pocVolume: string; sharePct: number;
  tiedLower: string[]; eligible: boolean; reasons: string[]; expectedMinutes: number; verifiedMinutes: number;
  distribution: { lower: string; volume: string; buyVolume: string; trades: number }[];
  firstObservedRetestAt: number | null; retestKnownAt: number | null; uncertainKnownAt: number | null;
}
export interface Settings { symbol: string; start: number; end: number; widths: string[]; publicationDelayMs: number }
export function periodStart(ts: number, period: Period): number {
  assert(Number.isSafeInteger(ts)); const d = new Date(ts);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return period === 'day' ? day : period === 'week' ? day - ((d.getUTCDay() + 6) % 7) * DAY : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
export function periodEnd(start: number, period: Period): number {
  if (period !== 'month') return start + (period === 'day' ? 1 : 7) * DAY;
  const d = new Date(start); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
export function buildProfiles(days: ProfileDay[], s: Settings): Profile[] {
  assert(s.end > s.start && Number.isSafeInteger(s.publicationDelayMs) && s.publicationDelayMs >= 0);
  const sorted = [...days].sort((a, b) => a.start - b.start), profiles: Profile[] = [];
  const venue = days[0]?.venue; assert(venue && days.every(d => d.venue === venue), 'Single venue required');
  assert.equal(new Set(days.map(d => d.start)).size, days.length, 'Duplicate day');
  for (const d of sorted) {
    assert(Number.isSafeInteger(d.start) && d.start % DAY === 0, 'UTC day alignment'); let previous = -1;
    for (const m of d.minutes) { assert(m.ts > previous && m.ts >= d.start && m.ts < d.start + DAY && m.ts % 60000 === 0, 'Unique ordered minute coverage'); previous = m.ts; }
    const seen = new Set<number>();
    for (const p of d.prices) {
      assert(Number.isSafeInteger(p.p) && p.p > 0 && !seen.has(p.p), 'Unique positive native prices'); seen.add(p.p);
      assert(decimal(p.q) > 0n && decimal(p.buy) <= decimal(p.q), 'Base/buy quantity');
      assert(Number.isSafeInteger(p.first) && Number.isSafeInteger(p.last) && p.first >= d.start && p.last >= p.first && p.last < d.start + DAY, 'Daily trade-time bounds');
    }
  }
  const byDay = new Map(sorted.map(d => [d.start, d]));
  const prepared = new Map<string, Map<number, Map<bigint, { q: bigint; buy: bigint; n: number; first: number }>>>();
  for (const width of s.widths) {
    const w = decimal(width); assert(w > 0n); const days = new Map<number, Map<bigint, { q: bigint; buy: bigint; n: number; first: number }>>();
    for (const d of sorted) {
      const bins = new Map<bigint, { q: bigint; buy: bigint; n: number; first: number }>();
      for (const p of d.prices) {
        const row = BigInt(p.p) / w * w; let b = bins.get(row);
        if (!b) { b = { q: 0n, buy: 0n, n: 0, first: p.first }; bins.set(row, b); }
        b.q += decimal(p.q); b.buy += decimal(p.buy); b.n += p.n; b.first = Math.min(b.first, p.first);
      }
      days.set(d.start, bins);
    }
    prepared.set(width, days);
  }
  const bad = new Map(sorted.map(d => [d.start, d.minutes.find(m => m.ts + 60000 <= s.end && m.quality !== 'verified')?.ts]));
  for (const period of ['day', 'week', 'month'] as Period[]) {
    for (let start = periodStart(s.start, period); start < s.end; start = periodEnd(start, period)) {
      const end = periodEnd(start, period); const parts: ProfileDay[] = []; let verifiedMinutes = 0;
      for (let t = start; t < end; t += DAY) { const d = byDay.get(t); if (d) { parts.push(d); verifiedMinutes += d.minutes.filter(m => m.ts >= s.start && m.ts + 60000 <= s.end && m.quality === 'verified').length; } }
      const expectedMinutes = (end - start) / 60000;
      const reasons: string[] = [];
      if (start < s.start) reasons.push('starts_before_canonical_history');
      if (end > s.end) reasons.push('unfinished_at_cutoff');
      if (verifiedMinutes !== expectedMinutes) reasons.push('unverified_minutes');
      for (const width of s.widths) {
        const w = decimal(width); assert(w > 0n); const bins = new Map<bigint, { q: bigint; buy: bigint; n: number }>();
        for (const d of parts) for (const [row, p] of prepared.get(width)!.get(d.start)!) {
          let b = bins.get(row); if (!b) { b = { q: 0n, buy: 0n, n: 0 }; bins.set(row, b); }
          b.q += p.q; b.buy += p.buy; b.n += p.n;
        }
        if (!bins.size) continue; // No invented POC for unavailable history.
        const ordered = [...bins].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
        const max = ordered.reduce((v, [, b]) => b.q > v ? b.q : v, 0n), ties = ordered.filter(([, b]) => b.q === max).map(([p]) => p);
        const lower = ties[0], total = ordered.reduce((v, [, b]) => v + b.q, 0n);
        const profile: Profile = { id: `${s.symbol}:${venue}:${period}:${start}:${format(w)}`, venue: venue!, symbol: s.symbol, period, start, end,
          availableAt: end + s.publicationDelayMs, width: format(w), lower: format(lower), upper: format(lower + w), center: format(lower + w / 2n),
          volume: format(total), pocVolume: format(max), sharePct: Number(max) / Number(total) * 100, tiedLower: ties.map(p => format(p)),
          eligible: reasons.length === 0, reasons: [...reasons], expectedMinutes, verifiedMinutes,
          distribution: ordered.map(([p, b]) => ({ lower: format(p), volume: format(b.q), buyVolume: format(b.buy), trades: b.n })),
          firstObservedRetestAt: null, retestKnownAt: null, uncertainKnownAt: null };
        if (profile.eligible) {
          // Profiles finish at UTC midnight. Daily native-price first prints suffice to
          // locate their first later touch without scanning the full tape per strategy.
          for (let t = end; t < s.end; t += DAY) {
            const d = byDay.get(t);
            if (!d) { profile.uncertainKnownAt ??= t + 60000; continue; }
            if (bad.get(t) !== undefined) profile.uncertainKnownAt ??= bad.get(t)! + 60000;
            const hit = prepared.get(width)!.get(t)?.get(lower)?.first;
            if (hit !== undefined && hit < s.end) {
              const known = Math.floor(hit / 60000) * 60000 + 60000;
              if (known <= s.end) { profile.firstObservedRetestAt = hit; profile.retestKnownAt = known; break; }
            }
          }
          // Quality gaps after an already observed touch cannot erase that evidence.
          if (profile.retestKnownAt !== null && profile.uncertainKnownAt !== null && profile.uncertainKnownAt > profile.retestKnownAt) profile.uncertainKnownAt = null;
        }
        profiles.push(profile);
      }
    }
  }
  return profiles;
}
export type AsOfProfile = Omit<Profile, 'distribution' | 'firstObservedRetestAt' | 'retestKnownAt' | 'uncertainKnownAt'> & {
  status: 'untested' | 'tested' | 'uncertain'; observedRetestAt: number | null; retestEvidenceAt: number | null; firstRetestExact: boolean | null;
};
export function asOf(profiles: Profile[], at: number, cutoff: number): AsOfProfile[] {
  assert(Number.isSafeInteger(at) && at <= cutoff, 'Query must be a UTC millisecond timestamp no later than dataset cutoff');
  return profiles.filter(p => p.eligible && p.availableAt <= at).map(p => {
    const { distribution, firstObservedRetestAt, retestKnownAt, uncertainKnownAt, ...safe } = p;
    const tested = retestKnownAt !== null && retestKnownAt <= at, uncertain = uncertainKnownAt !== null && uncertainKnownAt <= at;
    return { ...safe, reasons: [...safe.reasons], tiedLower: [...safe.tiedLower], status: tested ? 'tested' : uncertain ? 'uncertain' : 'untested', observedRetestAt: tested ? firstObservedRetestAt : null,
      retestEvidenceAt: tested ? retestKnownAt : null, firstRetestExact: tested ? !(uncertainKnownAt !== null && uncertainKnownAt <= retestKnownAt!) : null };
  });
}
/** Deliberately expose causal rows only to replay code, not the future lifecycle catalog. */
export function createReader(profiles: Profile[], cutoff: number) {
  type Filter = { venue?: string; period?: Period; width?: string };
  const lanes = new Map<string, Profile[]>();
  for (const p of profiles) if (p.eligible) { const key = [p.venue, p.period, p.width].join('|'); const lane = lanes.get(key) ?? []; lane.push(p); lanes.set(key, lane); }
  for (const lane of lanes.values()) lane.sort((a, b) => a.availableAt - b.availableAt);
  const query = (now: number, filter: Filter, naked: boolean) => {
    assert(Number.isSafeInteger(now) && now <= cutoff, 'Timestamp outside map cutoff'); const visible: Profile[] = [];
    for (const lane of lanes.values()) {
      const p = lane[0]; if ((filter.venue && p.venue !== filter.venue) || (filter.period && p.period !== filter.period) || (filter.width && p.width !== format(decimal(filter.width)))) continue;
      let lo = 0, hi = lane.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (lane[mid].availableAt <= now) lo = mid + 1; else hi = mid; }
      for (let i = 0; i < lo; i++) if (!naked || ((lane[i].retestKnownAt === null || lane[i].retestKnownAt! > now) && (lane[i].uncertainKnownAt === null || lane[i].uncertainKnownAt! > now))) visible.push(lane[i]);
    }
    return asOf(visible, now, cutoff);
  };
  return { at: (now: number, filter: Filter = {}) => query(now, filter, false), nakedAt: (now: number, filter: Filter = {}) => query(now, filter, true) };
}
