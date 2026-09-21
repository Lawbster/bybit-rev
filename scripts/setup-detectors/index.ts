/** Detector registry and natural-language resolution for the setup scanner. */
import { pa02Breaker } from './pa02-breaker';
import { pa04Reclaim } from './pa04-reclaim';
import { mr01MondayRange } from './mr01-monday-range';
import { ob01PersonalOb } from './ob01-personal-ob';
import { pa05ThreeTap } from './pa05-three-tap';
import { pa03OriginRetest, pa06SweepImpulse } from './pa07-wrappers';
import { rs01Reversal } from './rs01-reversal';
import { sf01RangeLow } from './sf01-range-low';
import type { SetupDetector } from '../setup-scan-core';

export const DETECTORS: SetupDetector[] = [mr01MondayRange, ob01PersonalOb, pa02Breaker, pa03OriginRetest, pa04Reclaim, pa05ThreeTap, pa06SweepImpulse, rs01Reversal, sf01RangeLow];

/** Files whose content identifies a detector implementation; pinned (hashed) into every scan key so a code change without a version bump still yields a new scan. */
const DETECTOR_FILES: Record<string, string[]> = {
  MR01: ["scripts/setup-detectors/mr01-monday-range.ts"],
  OB01: ["scripts/setup-detectors/ob01-personal-ob.ts"],
  PA02: ["scripts/setup-detectors/pa02-breaker.ts"],
  PA03: ["scripts/setup-detectors/pa07-wrappers.ts", "scripts/price-action-signals.ts", "research-inputs/price-action-pa07-2026-09-18.json"],
  PA04: ["scripts/setup-detectors/pa04-reclaim.ts"],
  PA05: ["scripts/setup-detectors/pa05-three-tap.ts"],
  PA06: ["scripts/setup-detectors/pa07-wrappers.ts", "scripts/price-action-signals.ts", "research-inputs/price-action-pa07-2026-09-18.json"],
  RS01: ["scripts/setup-detectors/rs01-reversal.ts"],
  SF01: ["scripts/setup-detectors/sf01-range-low.ts", "src/strategies/sfp-detector.ts"],
};
export function detectorSources(d: SetupDetector): string[] {
  const own = DETECTOR_FILES[d.id]; if (!own) throw new Error(`no source pin registered for detector ${d.id}`);
  return ["scripts/setup-scan-core.ts", "src/strategies/setup-context.ts", "scripts/setup-detectors/index.ts", ...own];
}

const normalize = (s: string) => s.toLowerCase().replace(/\b(rf|rektproof|rekt proof|setup|setups|the|a|an|any|on|hype|hypeusdt)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

export type Resolution =
  | { status: 'detector'; detector: SetupDetector; matchedBy: string }
  | { status: 'library_only'; id: string; title: string }
  | { status: 'unknown'; query: string; suggestions: string[] };

export function resolveSetup(query: string, library?: { records: { id: string; title: string; tags: string[] }[] }): Resolution {
  const q = normalize(query);
  const byId = DETECTORS.find(d => d.id.toLowerCase() === query.trim().toLowerCase() || normalize(d.id) === q);
  if (byId) return { status: 'detector', detector: byId, matchedBy: 'id' };
  for (const d of DETECTORS) for (const a of d.aliases) { const na = normalize(a); if (na && (na === q || q.includes(na))) return { status: 'detector', detector: d, matchedBy: `alias:${a}` }; }
  if (library) {
    const terms = q.split(' ').filter(Boolean);
    const rec = library.records.find(r => r.id.toLowerCase() === q) ?? library.records.find(r => terms.length && terms.every(t => [r.id, r.title, ...r.tags].join(' ').toLowerCase().includes(t)));
    if (rec) return { status: 'library_only', id: rec.id, title: rec.title };
  }
  return { status: 'unknown', query, suggestions: DETECTORS.map(d => `${d.id} (${d.aliases[0]})`) };
}
