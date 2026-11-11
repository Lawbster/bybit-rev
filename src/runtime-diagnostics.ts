import fs from 'fs';

/** Shared bounded/redacted error fields. Never serialize an API request/response object. */
export function sanitizeDiagnosticValue(value: unknown): string {
  let text: string;
  try { text = String(value ?? ''); } catch { return 'uninspectable error'; }
  // Redact before truncating: truncation must not leave a prefix of a known secret.
  for (const [key, secret] of Object.entries(process.env)) {
    if (/key|secret|token|password|webhook|authorization/i.test(key) && secret && secret.length >= 4)
      text = text.split(secret).join('[redacted]');
  }
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, '[url removed]')
    .replace(/\b(Bearer|Basic)\s+[^\s,;"'}]+/gi, '$1 [redacted]')
    .replace(/((?:api[-_]?key|secret|token|password|authorization|signature|x-bapi-sign|cookie|set-cookie)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, 4096);
}

export function diagnosticErrorFields(error: unknown) {
  let name: unknown = 'Error', message: unknown = error, code: unknown, stack: unknown = '';
  try {
    if (error && typeof error === 'object') {
      const e = error as Error & { code?: unknown };
      name = e.name; message = e.message; code = e.code;
      stack = typeof e.stack === 'string' ? e.stack.split('\n').filter(s => /^\s+at /.test(s)).slice(0, 12).join('\n') : '';
    }
  } catch { name = 'Error'; message = 'uninspectable error'; code = ''; stack = ''; }
  return { name: sanitizeDiagnosticValue(name), code: sanitizeDiagnosticValue(code),
    message: sanitizeDiagnosticValue(message), stack: sanitizeDiagnosticValue(stack) };
}

export type RuntimeDiagnostic = (origin: string, error: unknown) => void;
/** A broken optional diagnostic sink must not change trading/error semantics. */
export function reportDiagnostic(sink: RuntimeDiagnostic | undefined, origin: string, error: unknown): void {
  try { sink?.(origin, error); } catch { /* diagnostics are never trading authority */ }
}

/** First failure per normalized signature immediately, then at most one/minute.
 * 31 specific signatures + one overflow bucket bound memory/output; expired
 * signatures make room for new failures. PM2 captures stderr;
 * no network, state fsync, new file writer, or Discord message is introduced. */
export function createRuntimeDiagnostics(service: string, options: {
  clock?: () => number; write?: (line: string) => void;
} = {}): RuntimeDiagnostic {
  if (!/^[a-z0-9-]{1,64}$/.test(service)) throw new Error('invalid diagnostic service name');
  const signatures = new Map<string, { at: number; suppressed: number }>();
  const overflowKey = 'overflow', intervalMs = 60_000;
  return (origin, error) => {
    try {
      const at = (options.clock ?? Date.now)();
      if (!Number.isSafeInteger(at) || at < 0) return;
      const safeOrigin = sanitizeDiagnosticValue(origin).slice(0, 120), fields = diagnosticErrorFields(error);
      // Redact first; numeric IDs/timings must not create a distinct key per tick.
      // Error codes remain distinct even when the message is otherwise identical.
      let key = JSON.stringify([safeOrigin, fields.name.slice(0, 80), fields.code.slice(0, 80),
        fields.message.replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 160)]);
      if (!signatures.has(key)) {
        for (const [saved, row] of signatures) if (at - row.at >= intervalMs) signatures.delete(saved);
        const specific = signatures.size - (signatures.has(overflowKey) ? 1 : 0);
        if (specific >= 31) key = overflowKey;
      }
      const old = signatures.get(key);
      if (old && at - old.at < intervalMs) { old.suppressed++; return; }
      const suppressed = old?.suppressed ?? 0;
      signatures.set(key, { at, suppressed: 0 });
      const line = JSON.stringify({ version: 1, timestamp: at, service, severity: 'error',
        pid: process.pid, origin: safeOrigin, ...fields, suppressed, throttleOverflow: key === overflowKey }) + '\n';
      if (options.write) options.write(line);
      else fs.writeSync(2, line);
    } catch { /* no logging failure may suppress exits or turn a failure healthy */ }
  };
}
