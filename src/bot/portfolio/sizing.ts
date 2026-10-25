import { TERMS, type SetupSource } from './contract';

/** Ticket identity, separate from the unchanged signal/exit policy. Missing tags
 * on old config and reservations ALWAYS mean the original tickets. */
export const BASE_SIZING = 'HS01-base-v1';
export const PA07_SIZING = 'PAL02-PA07-3x-others-1.3x-v1';
export const ADX_SIZING = 'AA01-PA07-3x-L2-R5-2x-others-1.3x-v1';
export type SizingProfile = typeof BASE_SIZING | typeof PA07_SIZING | typeof ADX_SIZING;

export function sizingProfile(value: unknown): SizingProfile | null {
  return value === undefined || value === BASE_SIZING ? BASE_SIZING
    : value === PA07_SIZING ? PA07_SIZING : value === ADX_SIZING ? ADX_SIZING : null;
}
export function ticketNotional(source: SetupSource, profile: SizingProfile = BASE_SIZING): number {
  if (sizingProfile(profile) === null) throw new Error('invalid sizing profile');
  return TERMS[source].notional * (profile === BASE_SIZING ? 1 : source === 'PA07' ? 3
    : profile === ADX_SIZING && (source === 'L2' || source === 'R5') ? 2 : 1.3);
}
export function sizingTickets(profile: SizingProfile): Record<SetupSource, number> {
  return Object.fromEntries((Object.keys(TERMS) as SetupSource[])
    .map(source => [source, ticketNotional(source, profile)])) as Record<SetupSource, number>;
}
