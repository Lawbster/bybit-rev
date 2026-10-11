import { epoch, owner, source, type Owner, type Source } from './contract';

export interface OwnedExitRequest {
  owner: Owner; source: Source; reason: string; requestedAt: number; notBefore: number;
  lotIds: string[]; marketLinks: string[]; completedAt?: number;
}
export function validateOwnedExit(r: OwnedExitRequest): void {
  owner(r.owner); source(r.source); epoch(r.requestedAt); epoch(r.notBefore);
  if ((r.owner === 'main') !== (r.source === 'main') || (r.owner === 'R3') !== (r.source === 'R3')
    || !r.reason || r.notBefore < r.requestedAt || !Array.isArray(r.lotIds) || !r.lotIds.length
    || r.lotIds.some(id => typeof id !== 'string' || !id) || new Set(r.lotIds).size !== r.lotIds.length
    || !Array.isArray(r.marketLinks) || r.marketLinks.some(id => typeof id !== 'string' || !id)
    || new Set(r.marketLinks).size !== r.marketLinks.length) throw new Error('invalid owned exit request');
  if (r.completedAt !== undefined) { epoch(r.completedAt); if (r.completedAt < r.requestedAt) throw new Error('invalid exit completion'); }
}
