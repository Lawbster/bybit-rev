/** Discord/file control boundary. Never creates an exchange client or edits inventory. */
import fs from 'fs';
import path from 'path';
import { loadPortfolioConfig } from './live-config';
import { PORTFOLIO_POLICY } from './contract';
import { sizingProfile } from './sizing';
import { ACCOUNT_MAX_AGE, HEALTH_MAX_AGE, formatPortfolioStatus, fresh, type StatusHealth } from './status';

export const PORTFOLIO_HELP = [
  'HYPE portfolio commands (all owners on hypehedgeguy):',
  '-status: ladder, slots, MACD short and health',
  '-pause: block new entries/adds; keep exits running',
  '-resume: remove entry pause only after health checks',
  '-flatten: request ALL positions closed, then remain paused',
  'Aliases: append hype or portfolio; -close hype and -closeladder flatten ALL portfolio owners.',
  'Requests are not fill confirmations. Check -status afterward. No config or regime override.',
  'Explicit SUI/FART commands still address their separate legacy bots.',
].join('\n');

function readHealth(file: string): StatusHealth {
  const h = JSON.parse(fs.readFileSync(file, 'utf8')) as StatusHealth;
  if (!h || h.policy !== PORTFOLIO_POLICY || h.uid !== '555249668') throw new Error('health identity mismatch');
  return h;
}
export function portfolioStatusFromDisk(root = process.cwd(), now = Date.now()): string {
  let file = path.resolve(root, 'data/HYPEUSDT_portfolio_health.json'), configWarning = '';
  try { file = path.resolve(root, loadPortfolioConfig(path.join(root, 'portfolio-live-config.json')).healthFile); }
  catch { configWarning = 'CONFIG UNAVAILABLE/INVALID; showing default portfolio health only.\n'; }
  let status: string;
  try { status = formatPortfolioStatus(readHealth(file), now); }
  catch { status = 'Portfolio health unavailable/invalid. Execution status UNKNOWN; no legacy-state fallback.'; }
  const paused = fs.existsSync(path.join(root, 'portfolio-pause'));
  const flatten = fs.existsSync(path.join(root, 'portfolio-flatten'));
  return configWarning + status + `\nControl files NOW: pause=${paused}, flatten=${flatten} (may be newer than snapshot).`;
}

/** null means explicitly another bot/unrecognised command, never HYPE fallback.
 * All HYPE aliases permanently target the new owner, even with broken config. */
export function handlePortfolioCommand(content: string, commandAt: number, root = process.cwd(), now = Date.now()): string | null {
  const text = content.trim().toLowerCase();
  if (text === '-help' || /^-help\s+(hype|portfolio)$/.test(text)) return PORTFOLIO_HELP;
  if (/^-(override|regime-arm)\s+(hype|portfolio)(\s|$)/.test(text))
    return 'Portfolio overrides/regime resets are not exposed in Commander. Legacy HYPE files were NOT changed.';
  const match = /^-(status|pause|resume|flatten|close)(?:\s+(hype|portfolio))?$/.exec(text);
  const action = text === '-closeladder' ? 'flatten' : match?.[1];
  if (!action) return null;
  if (action === 'status') return portfolioStatusFromDisk(root, now);
  if (!fresh(commandAt, now, 90_000)) return 'Command expired or timestamp invalid. Nothing changed; send it again.';
  const pause = path.join(root, 'portfolio-pause'), flatten = path.join(root, 'portfolio-flatten');
  const signal = `discord portfolio ${action} at ${new Date(now).toISOString()}\n`;
  if (action === 'pause' || action === 'flatten' || action === 'close') {
    // Pause first: a failed flatten-file write must never leave new entries enabled.
    fs.writeFileSync(pause, signal);
    if (action !== 'pause') fs.writeFileSync(flatten, signal);
    return action === 'pause'
      ? 'Portfolio PAUSE saved. New entries/adds blocked when the owner next checks; exits continue. In-flight orders may still fill. Check -status.'
      : 'Portfolio FLATTEN requested for ALL owners (ladder, 3 slots, MACD). Entries paused. Not a fill confirmation; requires a running owner and reachable exchange. Check -status; pause remains after closing.';
  }
  // Resume is intentionally stricter than pause/flatten. No enabling config,
  // clearing a flatten/recovery/regime latch, or touching old owners' pauses.
  try {
    const config = loadPortfolioConfig(path.join(root, 'portfolio-live-config.json'));
    if (!config.enabled || config.mode !== 'live' || !config.entryEnabled) throw new Error('config not live and entry-enabled');
    const h = readHealth(path.resolve(root, config.healthFile));
    if (sizingProfile(config.sizingProfile) === null || sizingProfile(h.sizingProfile) !== sizingProfile(config.sizingProfile))
      throw new Error('config not loaded: sizing profile mismatch/invalid');
    if (!fresh(h.writtenAt, now, HEALTH_MAX_AGE) || !fresh(h.reconciliation?.at, now, ACCOUNT_MAX_AGE))
      throw new Error('health/account evidence stale');
    if (h.enabled !== true || h.mode !== 'live' || h.configuredEntryEnabled !== true || h.status !== 'healthy'
      || h.error !== null || h.recovery !== null) throw new Error('owner not healthy/live or in recovery');
    if (h.monitor?.version !== 1 || !Array.isArray(h.pending)) throw new Error('deploy the owner status/control update first');
    if (fs.existsSync(flatten) || h.monitor.flattenRequested || h.monitor.activeExits !== 0)
      throw new Error('flatten/exit still active');
    if (h.pending.some(p => p.resting !== true) || h.monitor.pendingMutations !== 0 || h.monitor.reservations !== 0)
      throw new Error('transaction/reservation still pending');
    if (fs.existsSync(pause)) fs.unlinkSync(pause);
    return 'Portfolio entry pause removed. Normal gates still apply; no config or regime changed. Check -status for owner acknowledgement.';
  } catch (e) {
    const message = e instanceof Error && /^(config not|health\/account|owner not|deploy the|flatten\/exit|transaction\/reservation)/.test(e.message)
      ? e.message : 'config/health unreadable, invalid or wrong account';
    return `Resume refused: ${message}. Pause not removed.`;
  }
}
