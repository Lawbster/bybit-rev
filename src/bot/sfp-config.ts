import fs from 'fs';
import path from 'path';
import { SFP_POLICY } from '../strategies/sfp-policy';

export interface SfpConfig {
  version: 1; policy: string; accountAlias: string; expectedAccountUid: string;
  symbol: 'HYPEUSDT'; enabled: boolean; entryEnabled: boolean;
  notionalUsdt: number; leverage: number; pollIntervalMs: number;
  stateFile: string; healthFile: string; journalFile: string; pauseFile: string;
  candleFile: string; logDir: string;
}
export function loadSfpConfig(file = 'sfp-live-config.json'): SfpConfig {
  const c = JSON.parse(fs.readFileSync(file, 'utf8')) as SfpConfig;
  if (c.version !== 1 || c.policy !== SFP_POLICY || c.symbol !== 'HYPEUSDT'
    || !/^[A-Z][A-Z0-9_]{0,31}$/.test(c.accountAlias)
    || typeof c.expectedAccountUid !== 'string' || !/^(\d+)?$/.test(c.expectedAccountUid)
    || typeof c.enabled !== 'boolean' || typeof c.entryEnabled !== 'boolean'
    || (c.entryEnabled && !c.enabled)
    || ![10_000, 20_000].includes(c.notionalUsdt)
    || !Number.isFinite(c.leverage) || c.leverage < 1 || c.leverage > 3
    || !Number.isInteger(c.pollIntervalMs) || c.pollIntervalMs < 1000 || c.pollIntervalMs > 10_000) {
    throw new Error('invalid SF08 config or policy; leverage must be 1-3, notional 10k/20k');
  }
  const owned = [c.stateFile, c.healthFile, c.journalFile, c.pauseFile];
  if (owned.some(p => typeof p !== 'string' || !path.basename(p).includes('sfp'))
    || new Set(owned.map(p => path.resolve(p))).size !== owned.length
    || typeof c.candleFile !== 'string' || typeof c.logDir !== 'string') throw new Error('invalid isolated SF08 paths');
  if (c.enabled && !c.expectedAccountUid) throw new Error('expectedAccountUid required before enabling execution');
  return Object.freeze(c);
}
