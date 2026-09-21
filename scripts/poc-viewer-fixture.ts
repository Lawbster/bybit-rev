/** Synthetic UI fixture only, never a research map. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderPocViewer } from './poc-map-viewer';
import { buildProfiles, ProfileDay } from './poc-profile-engine';
import { DAY } from './poc-volume-source';
const start = Date.UTC(2025, 0, 1), end = start + 365 * DAY, profiles = [], candles: any = {};
for (const venue of ['bybit', 'binance']) {
  const days: ProfileDay[] = Array.from({ length: 365 }, (_, i) => ({ venue, date: '', start: start + i * DAY,
    minutes: Array.from({ length: 1440 }, (_, j) => ({ ts: start + i * DAY + j * 60000, quality: 'verified' })),
    prices: [{ p: (10 + i) * 1e8, q: '100', buy: '50', n: 10, first: start + i * DAY + 1000, last: start + i * DAY + 2000 }] }));
  profiles.push(...buildProfiles(days, { symbol: 'SYNTHETIC', start, end, widths: ['0.1', '0.05', '0.2'], publicationDelayMs: 60000 }));
  candles[venue] = days.map((d, i) => ({ t: d.start, end: d.start + 3600000, o: 10 + i, h: 11 + i, l: 9 + i, c: 10 + i }));
}
const file = path.join(os.tmpdir(), 'poc-synthetic-viewer-' + Date.now() + '.html');
fs.writeFileSync(file, renderPocViewer({ symbol: 'SYNTHETIC', start, end, profiles, candles })); console.log(file);
