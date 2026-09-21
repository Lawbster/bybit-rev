/** Named account credentials are independent of the strategy using them. */
export function namedBybitCredentials(alias: string, env = process.env) {
  if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(alias)) throw new Error('invalid account alias');
  const keyName = `BYBIT_API_KEY_${alias}`, secretName = `BYBIT_API_SECRET_${alias}`;
  const key = env[keyName], secret = env[secretName];
  if (!key || !secret) throw new Error(`populate ${keyName} and ${secretName}`);
  if (key === env.BYBIT_API_KEY) throw new Error('named account key matches ladder key');
  return { key, secret };
}

export function requireDistinctAccount(actualUid: string, expectedUid: string, ladderUid: string) {
  if (!actualUid || !expectedUid || !ladderUid || actualUid !== expectedUid || actualUid === ladderUid) {
    throw new Error('account UID not pinned or not isolated from ladder account');
  }
}

export function accountDiagnostic(error: unknown): string {
  let text = error instanceof Error ? error.message : 'exchange operation failed';
  for (const [key, value] of Object.entries(process.env)) {
    if (/key|secret|token|password|webhook/i.test(key) && value && value.length >= 4) text = text.split(value).join('[redacted]');
  }
  return text.replace(/https?:\/\/\S+/gi, '[url]').slice(0, 240);
}
