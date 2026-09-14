import fs from "fs";
import path from "path";

/** Fatal-path diagnostics only: no networking, state saves or trading cleanup. */
export function installFatalDiagnostics(service: string, logDir = path.resolve(process.cwd(), "logs")) {
  if (!/^[a-z0-9-]{1,64}$/.test(service)) throw new Error("invalid fatal diagnostic service name");
  let recorded = false;
  const sanitize = (value: unknown): string => {
    let text: string;
    try { text = String(value ?? "").slice(0, 16_384); } catch { return "uninspectable error"; }
    for (const [key, secret] of Object.entries(process.env)) {
      if (/key|secret|token|password|webhook|authorization/i.test(key) && secret && secret.length >= 4) {
        text = text.split(secret).join("[redacted]");
      }
    }
    return text.replace(/https?:\/\/[^\s"'<>]+/gi, "[url removed]")
      .replace(/((?:api[-_]?key|secret|token|password|authorization|signature)\s*[=:]\s*)[^\s,;}]+/gi, "$1[redacted]")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(0, 4_096);
  };
  const record = (error: unknown, origin: string): void => {
    if (recorded) return;
    recorded = true;
    let line = "";
    try {
      let name: unknown = "Error", message: unknown = error, code: unknown, stack: unknown = "";
      try {
        if (error && typeof error === "object") {
          const e = error as Error & { code?: unknown };
          name = e.name; message = e.message; code = e.code;
          // Exclude arbitrary multiline error bodies from stack diagnostics.
          stack = typeof e.stack === "string" ? e.stack.split("\n").filter(s => /^\s+at /.test(s)).slice(0, 12).join("\n") : "";
        }
      } catch { message = "uninspectable error"; }
      const now = Date.now();
      line = JSON.stringify({ version: 1, timestamp: now, service, pid: process.pid, node: process.version,
        origin: sanitize(origin), name: sanitize(name), code: sanitize(code), message: sanitize(message), stack: sanitize(stack) }) + "\n";
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
