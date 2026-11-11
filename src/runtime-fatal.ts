import fs from "fs";
import path from "path";
import { diagnosticErrorFields, sanitizeDiagnosticValue as sanitize } from './runtime-diagnostics';

/** Fatal-path diagnostics only: no networking, state saves or trading cleanup. */
export function installFatalDiagnostics(service: string, logDir = path.resolve(process.cwd(), "logs")) {
  if (!/^[a-z0-9-]{1,64}$/.test(service)) throw new Error("invalid fatal diagnostic service name");
  let recorded = false;
  const record = (error: unknown, origin: string): void => {
    if (recorded) return;
    recorded = true;
    let line = "";
    try {
      const now = Date.now();
      line = JSON.stringify({ version: 1, timestamp: now, service, pid: process.pid, node: process.version,
        origin: sanitize(origin), ...diagnosticErrorFields(error) }) + "\n";
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, `fatal-${service}-${new Date(now).toISOString().slice(0, 10)}.jsonl`), line, { mode: 0o600 });
    } catch { /* Disk errors must never mask or suppress termination. */ }
    try { fs.writeSync(2, line || `[fatal] ${service}: diagnostic unavailable\n`); } catch { /* stderr may be broken too */ }
  };
  const exit = (error: unknown, origin = "startup"): never => {
    try { record(error, origin); } finally { process.exit(1); }
  };
  const monitor = (error: Error, origin: string) => { record(error, origin); };
  // Monitoring does not replace Node's fatal uncaught-exception behavior.
  process.on("uncaughtExceptionMonitor", monitor);
  // Explicitly terminate on rejection even if launched with --unhandled-rejections=warn.
  // Unlike a logging-only listener, this cannot leave a partially failed owner alive.
  const rejection = (reason: unknown) => exit(reason, "unhandledRejection");
  process.on("unhandledRejection", rejection);
  return { exit, uninstall() {
    process.removeListener("uncaughtExceptionMonitor", monitor);
    process.removeListener("unhandledRejection", rejection);
  } };
}
