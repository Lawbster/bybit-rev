import fs from 'fs';
import { createHash } from 'crypto';
import { PORTFOLIO_POLICY } from './contract';
export interface PortfolioLiveConfig {
  version: 1; policy: string; enabled: boolean; mode: 'observe' | 'live'; entryEnabled: boolean;
  expectedAccountUid: '555249668'; exchangeLeverage: 25; initialEquity: number;
  mainConfig: string; mainConfigSha256: string; legacyState: string;
  stateFile: string; healthFile: string; lockDirectory: string;
  bootstrap: string; bootstrapSha256: string; dataDir: string; logDir: string;
  pollIntervalMs: number;
}
export function loadPortfolioConfig(file = 'portfolio-live-config.json'): PortfolioLiveConfig {
  const c: PortfolioLiveConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (c.version !== 1 || c.policy !== PORTFOLIO_POLICY || !['observe', 'live'].includes(c.mode)
    || typeof c.enabled !== 'boolean' || typeof c.entryEnabled !== 'boolean' || c.expectedAccountUid !== '555249668' || c.exchangeLeverage !== 25
    || !(c.initialEquity > 0) || c.pollIntervalMs < 1000 || c.pollIntervalMs > 10000
    || !Number.isInteger(c.pollIntervalMs) || !/^[a-f0-9]{64}$/.test(c.mainConfigSha256)
    || !/^[a-f0-9]{64}$/.test(c.bootstrapSha256)) throw new Error('invalid portfolio live configuration');
  for (const key of ['mainConfig', 'legacyState', 'stateFile', 'healthFile', 'lockDirectory', 'bootstrap', 'dataDir', 'logDir'] as const)
    if (typeof c[key] !== 'string' || !c[key]) throw new Error('invalid portfolio path');
  if (new Set([c.mainConfig, c.legacyState, c.stateFile, c.healthFile]).size !== 4) throw new Error('portfolio paths must not overlap');
  return c;
}
/** JSON content pin: unaffected by checkout CRLF conversion or indentation. */
export function portfolioMainConfigHash(file: string): string {
  return createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')))).digest('hex');
}
/** Old owners must not start after the explicit portfolio takeover switch. */
export function assertLegacyOwnerAllowed(): void {
  if (!fs.existsSync('portfolio-live-config.json')) return;
  const config = loadPortfolioConfig(); // Unreadable config is not permission.
  if (config.enabled) throw new Error('portfolio takeover enabled; legacy trading owners must remain stopped');
}
