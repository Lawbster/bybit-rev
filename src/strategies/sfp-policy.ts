import { buildActions } from './setup-actions';
import { type SetupEvent, H } from './setup-context';

export const SFP_POLICY = 'SF08:SF01-v1:4h:range:r2:pad5:hold24:lag60:v1';
export interface SfpSignal {
  id: string; at: number; expiresAt: number; entryDeadline: number;
  reference: number; originalStop: number; stop: number; target: number;
}
export function sfpActions(events: readonly SetupEvent[]): SfpSignal[] {
  const { actions } = buildActions(events, { side: 1, target: 'r2', holdHours: 24 }, {
    riskMinPct: 0.2, riskMaxPct: 5, stopBufferPct: 0, includeControls: false,
    exitStopPaddingPct: 5,
  });
  return actions.map(a => ({ id: a.id, at: a.at, expiresAt: a.at + 24 * H,
    entryDeadline: a.at + 60_000, reference: Number(a.evidence!.refPrice),
    originalStop: a.stop! / 0.95, stop: a.stop!, target: a.target! }));
}
